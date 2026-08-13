import http from '@ohos.net.http';
import url from '@ohos.url';
import util from '@ohos.util';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { encodeSharedText, type JsonObject } from '@reader/core-harmony';
import { CookieSessionStore } from './CookieSessionStore';
import {
  allowNextRedirect,
  isCrossOriginSensitiveHeader,
  mergeCookieHeader,
  redirectMethodDecision,
  resolveResponseCharset,
  retryBackoffMillis,
} from './HttpTransportPolicy';

const LOG_DOMAIN = 0x5244;
const DEFAULT_CONNECT_TIMEOUT_MS = 30000;
const DEFAULT_READ_TIMEOUT_MS = 60000;
const MAX_RETRY_BACKOFF_MILLIS = 3000;
const MAX_RETRY_ATTEMPTS = 5;
const MAX_REDIRECTS = 20;
const DEFAULT_MAX_REDIRECTS = 10;
// Reject oversized responses before TextDecoder/base64 allocation (which would
// roughly triple peak memory). The platform has already buffered the bytes at
// this point, so this is a post-hoc guard, not an allocation preventer.
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const MAX_REQUEST_BODY_BYTES = 16 * 1024 * 1024;
// Host total deadline must not exceed Core's default 30s request timeout, so
// a Core caller that gives up never leaves this Host running in the
// background beyond its own budget.
const TOTAL_DEADLINE_MS = 25000;

type RetryPolicy = {
  maxAttempts: number;
  backoffMillis: number | null;
};

type ResponseHeaders = Record<string, string>;

type DeadlineState = {
  deadlineAt: number;
  cancelled: boolean;
  activeRequest: http.HttpRequest | null;
  timer: number | undefined;
  expired: Promise<JsonObject>;
  rejectExpired: (reason?: Error) => void;
};

type EncodedBody =
  | { kind: 'none' }
  | { kind: 'text'; text: string }
  | { kind: 'form'; fields: Array<[string, string]> }
  | { kind: 'multipart'; contentType: string; bytes: Uint8Array };

type ParsedMethod = {
  wireMethod: string;
  enumMethod: http.RequestMethod;
  customVerb: string | undefined;
};

type RedirectHop = {
  status: number;
  fromUrl: string;
  toUrl: string;
  headers: ResponseHeaders;
};

type HopResponse = {
  status: number;
  headers: ResponseHeaders;
  rawHeaders: Object;
  bytes: Uint8Array;
};

type MultipartFileWire = {
  fieldName: string;
  filename: string;
  contentType: string;
  data: number[];
  filePath?: string;
};

type SourceHttpDiagnosticContext = {
  traceId: string;
  requestId: number;
  sourceId: string;
  stage: string;
};

/**
 * Sanitized, bounded Host evidence for one real `source.check.run` request.
 * Response bodies, headers, cookies, query strings, URL fragments, and raw
 * platform error text are deliberately excluded to reduce credential
 * exposure in the product debug view.
 */
export type SourceHttpDiagnosticRecord = {
  traceId: string;
  requestId: number;
  sourceId: string;
  stage: string;
  method: string;
  url: string;
  timestampMs: number;
  durationMs: number;
  statusCode?: number;
  finalUrl?: string;
  errorMessage?: string;
};

/**
 * API 23 exposes redirect interception before the platform follows a hop.
 * Returning false terminates the platform chain and returns that redirect
 * response to `request()`, which lets the Host apply method/header/cookie
 * policy itself without relying on the unsupported `maxRedirects: 0` trick.
 */
class StopBeforeRedirectInterceptor implements http.HttpInterceptor {
  interceptorType: http.InterceptorType = http.InterceptorType.REDIRECTION;

  async interceptorHandle(
    _request: http.HttpRequestContext,
    _response: http.HttpResponse,
  ): Promise<http.ChainContinue> {
    return false;
  }
}

/**
 * Host-side `http.execute` adapter for the API-23 HarmonyOS transport.
 *
 * Wire contract (`HostHttpRequest`, camelCase): url, method, headers,
 * body (Raw=string | Form={fields:[[k,v]]} | Multipart={fields,files}),
 * charset (request-body encoding), followRedirects, maxRedirects, retry,
 * usePlatformCookieJar, session, diagnostic (opaque recorder context).
 *
 * Redirects are stopped one hop at a time through API-23's REDIRECTION
 * interceptor, so Core receives an accurate finalUrl and hop list. Method rewriting follows the
 * browser/Legado-compatible 301/302/303/307/308 rules; cross-origin hops drop
 * authorization, proxy authorization, cookie, and origin headers. Cookies
 * are applied and captured on every hop through the shared Host store.
 *
 * Custom verbs: the RequestMethod enum has no PATCH or WebDAV verbs.
 * API 23's `customMethod` passes those through verbatim; nothing is
 * substituted.
 *
 * Non-UTF-8 request bytes use Core's bounded shared encoder; ArkTS carries no
 * private GBK/Big5 tables. Text responses are decoded using response
 * Content-Type charset, then the Core descriptor charset, then UTF-8. Raw
 * bytes are retained as bodyBase64 for Core.
 *
 * Fail-closed, never silently substituted: Multipart `filePath` (Core turns a
 * source `@/path` verbatim into
 * `filePath`; with no user-authorized attachment-handle mapping this Host
 * refuses to read a source-supplied path — inline `data` is the only accepted
 * upload form). A fresh HttpRequest is created/destroyed per hop; every
 * failure throws so the SDK routes `host.error`.
 */
export class HttpExecuteHost {
  static readonly instance: HttpExecuteHost = new HttpExecuteHost();
  private readonly activeByRequestId = new Map<number, DeadlineState>();
  private readonly sourceDiagnosticsByRequestId = new Map<number, SourceHttpDiagnosticRecord[]>();

  async execute(
    params: JsonObject,
    requestId?: number,
    isCancelled?: () => boolean,
  ): Promise<JsonObject> {
    const requestUrl = params['url'];
    if (typeof requestUrl !== 'string' || requestUrl.trim().length === 0) {
      throw new Error('http.execute requires non-empty url');
    }
    this.requireHttpUrl(requestUrl);
    const parsedMethod = this.parseMethod(params['method']);
    const headers = this.parseHeaders(params['headers']);
    const body = this.parseBody(params['body']);
    const requestCharset = this.parseCharset(params['charset']);
    const retry = this.parseRetry(params['retry']);
    const maxRedirects = this.parseRedirect(params['followRedirects'], params['maxRedirects']);
    const sessionId = this.parseSession(params['session']);
    const useCookieJar = params['usePlatformCookieJar'] === true || sessionId !== null;
    if (params['usePlatformCookieJar'] !== undefined && params['usePlatformCookieJar'] !== null &&
      typeof params['usePlatformCookieJar'] !== 'boolean') {
      throw new Error('http.execute: usePlatformCookieJar must be a boolean');
    }
    if (useCookieJar && sessionId === null) {
      throw new Error('http.execute: platform cookie jar requires opaque session.id');
    }
    // `diagnostic` is recorder-only context. The Host request `requestId`
    // argument remains the sole operation key for host.complete / host.error.
    const diagnostic = this.parseSourceDiagnostic(params['diagnostic']);
    const diagnosticStartedAt = Date.now();
    const deadline = this.createDeadline(TOTAL_DEADLINE_MS);
    let cancellationPoll: number | undefined = undefined;
    if (requestId !== undefined) {
      this.activeByRequestId.set(requestId, deadline);
    }
    if (isCancelled !== undefined) {
      const pollCancellation = (): void => {
        if (deadline.cancelled) {
          return;
        }
        let cancelled = true;
        try {
          cancelled = isCancelled();
        } catch (_) {
          // A failed ownership probe cannot authorize more network work.
        }
        if (cancelled) {
          this.cancelDeadline(deadline, 'http.execute: cancelled by caller');
          return;
        }
        cancellationPoll = setTimeout(pollCancellation, 50);
      };
      pollCancellation();
    }
    try {
      // Race guarantees the caller settles on time even if the platform's
      // destroy() does not settle request.request() promptly; the shared
      // `cancelled` flag still stops background retries and the post-await
      // check rejects a success that lands after the deadline.
      const response = await Promise.race([
        this.requestWithPolicy(
          requestUrl, parsedMethod, headers, body, requestCharset,
          maxRedirects, retry, deadline, useCookieJar ? sessionId : null,
        ),
        deadline.expired,
      ]);
      this.recordSourceDiagnostic(
        diagnostic,
        parsedMethod.wireMethod,
        requestUrl,
        diagnosticStartedAt,
        response,
      );
      return response;
    } catch (error) {
      this.recordSourceDiagnostic(
        diagnostic,
        parsedMethod.wireMethod,
        requestUrl,
        diagnosticStartedAt,
        undefined,
        error instanceof Error ? error.message : `${error}`,
      );
      throw error;
    } finally {
      if (cancellationPoll !== undefined) {
        clearTimeout(cancellationPoll);
      }
      if (requestId !== undefined && this.activeByRequestId.get(requestId) === deadline) {
        this.activeByRequestId.delete(requestId);
      }
      this.disposeDeadline(deadline);
    }
  }

  cancel(requestId: number): void {
    const state = this.activeByRequestId.get(requestId);
    if (state !== undefined) {
      this.cancelDeadline(state, 'http.execute: cancelled by Core request');
    }
  }

  /** Consume all HTTP evidence captured for one original Core command. */
  takeSourceDiagnostics(requestId: number): SourceHttpDiagnosticRecord[] {
    const records = this.sourceDiagnosticsByRequestId.get(requestId) ?? [];
    this.sourceDiagnosticsByRequestId.delete(requestId);
    return records.map((record: SourceHttpDiagnosticRecord): SourceHttpDiagnosticRecord => ({ ...record }));
  }

  private parseSourceDiagnostic(value: unknown): SourceHttpDiagnosticContext | undefined {
    if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const diagnostic = value as JsonObject;
    const traceId = diagnostic['traceId'];
    const requestId = diagnostic['requestId'];
    const sourceId = diagnostic['sourceId'];
    const stage = diagnostic['stage'];
    if (typeof traceId !== 'string' || traceId.trim().length === 0 ||
      typeof requestId !== 'number' || !Number.isSafeInteger(requestId) || requestId <= 0 ||
      typeof sourceId !== 'string' || sourceId.trim().length === 0 ||
      typeof stage !== 'string' || !['L2', 'L3', 'L4', 'L5'].includes(stage)) {
      return undefined;
    }
    return { traceId, requestId, sourceId, stage };
  }

  private recordSourceDiagnostic(
    diagnostic: SourceHttpDiagnosticContext | undefined,
    method: string,
    requestUrl: string,
    startedAt: number,
    response?: JsonObject,
    errorMessage?: string,
  ): void {
    if (diagnostic === undefined) {
      return;
    }
    const timestampMs = Date.now();
    const record: SourceHttpDiagnosticRecord = {
      traceId: diagnostic.traceId,
      requestId: diagnostic.requestId,
      sourceId: diagnostic.sourceId,
      stage: diagnostic.stage,
      method,
      url: this.sanitizeDiagnosticUrl(requestUrl),
      timestampMs,
      durationMs: Math.max(0, timestampMs - startedAt),
    };
    const statusCode = response?.['status'];
    const finalUrl = response?.['finalUrl'];
    if (typeof statusCode === 'number' && Number.isSafeInteger(statusCode)) {
      record.statusCode = statusCode;
    }
    if (typeof finalUrl === 'string' && finalUrl.length > 0) {
      record.finalUrl = this.sanitizeDiagnosticUrl(finalUrl);
    }
    if (errorMessage !== undefined && errorMessage.length > 0) {
      record.errorMessage = this.sanitizeDiagnosticError(errorMessage);
    }

    let records = this.sourceDiagnosticsByRequestId.get(diagnostic.requestId);
    if (records === undefined) {
      // Core request ids are monotonic, but keep the recorder bounded even if
      // a caller never consumes an old command's evidence.
      if (this.sourceDiagnosticsByRequestId.size >= 64) {
        for (const oldestRequestId of this.sourceDiagnosticsByRequestId.keys()) {
          this.sourceDiagnosticsByRequestId.delete(oldestRequestId);
          break;
        }
      }
      records = [];
      this.sourceDiagnosticsByRequestId.set(diagnostic.requestId, records);
    }
    if (records.length < 32) {
      records.push(record);
    }
  }

  private sanitizeDiagnosticUrl(value: string): string {
    try {
      const parsed = url.URL.parseURL(value);
      const port = parsed.port.length > 0 ? `:${parsed.port}` : '';
      return `${parsed.protocol}//${parsed.hostname}${port}${parsed.pathname}`;
    } catch (_) {
      return '[invalid URL]';
    }
  }

  private sanitizeDiagnosticError(value: string): string {
    const normalized = value.toLowerCase();
    if (normalized.includes('cancel')) {
      return 'Host 请求已取消';
    }
    if (normalized.includes('deadline') || normalized.includes('timeout')) {
      return 'Host 请求超时';
    }
    if (normalized.includes('decode') || normalized.includes('charset')) {
      return 'Host 响应解码失败';
    }
    if (normalized.includes('response exceeds')) {
      return 'Host 响应体超过限制';
    }
    if (normalized.includes('redirect')) {
      return 'Host 重定向失败';
    }
    return 'Host 网络请求失败';
  }

  /**
   * Shared cancellation state. On expiry the timer marks the cycle cancelled,
   * destroys the in-flight `HttpRequest`, and rejects `expired` so a caller
   * awaiting `Promise.race` settles immediately rather than when the aborted
   * platform request happens to surface its error.
   */
  private createDeadline(deadlineMs: number): DeadlineState {
    let rejectDeadline: (reason?: Error) => void = (): void => undefined;
    const expired = new Promise<JsonObject>((
      _resolve: (value: JsonObject) => void,
      reject: (reason?: Error) => void,
    ): void => {
      rejectDeadline = reject;
    });
    const state: DeadlineState = {
      deadlineAt: Date.now() + deadlineMs,
      cancelled: false,
      activeRequest: null,
      timer: undefined,
      expired,
      rejectExpired: rejectDeadline,
    };
    state.timer = setTimeout((): void => {
      this.cancelDeadline(state, 'http.execute: exceeded total deadline');
    }, deadlineMs);
    return state;
  }

  private cancelDeadline(state: DeadlineState, message: string): void {
    if (state.cancelled) {
      return;
    }
    state.cancelled = true;
    const active = state.activeRequest;
    if (active !== null) {
      try {
        active.destroy();
      } catch (_) {
        // destroy may already be running; cancellation is already marked.
      }
    }
    state.rejectExpired(new Error(message));
  }

  private disposeDeadline(state: DeadlineState): void {
    if (state.timer !== undefined) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }
  }

  private assertWithinDeadline(state: DeadlineState): void {
    if (state.cancelled || state.deadlineAt - Date.now() <= 0) {
      throw new Error('http.execute: exceeded total deadline');
    }
  }

  private async requestWithPolicy(
    url: string,
    method: ParsedMethod,
    headers: Record<string, string>,
    body: EncodedBody,
    requestCharset: string | undefined,
    maxRedirects: number,
    retry: RetryPolicy | null,
    deadline: DeadlineState,
    sessionId: string | null,
  ): Promise<JsonObject> {
    const attempts = retry === null ? 1 : Math.max(1, Math.floor(retry.maxAttempts));
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      this.assertWithinDeadline(deadline);
      try {
        return await this.requestRedirectChain(
          url, method, headers, body, requestCharset, maxRedirects, deadline, sessionId,
        );
      } catch (error) {
        if (deadline.cancelled) {
          throw new Error('http.execute: cancelled');
        }
        lastError = error instanceof Error ? error : new Error(`${error}`);
        if (attempt < attempts) {
          const remaining = deadline.deadlineAt - Date.now();
          if (remaining <= 0) {
            throw new Error('http.execute: exceeded total deadline');
          }
          await this.sleepRetryBackoff(retry, attempt, remaining);
        }
      }
    }
    hilog.error(LOG_DOMAIN, 'Reader', 'http.execute failed after %{public}d attempt(s): %{public}s',
      attempts, lastError === null ? 'unknown' : lastError.message);
    throw lastError ?? new Error('http.execute request failed');
  }

  private async requestRedirectChain(
    initialUrl: string,
    initialMethod: ParsedMethod,
    headers: Record<string, string>,
    body: EncodedBody,
    requestCharset: string | undefined,
    maxRedirects: number,
    deadline: DeadlineState,
    sessionId: string | null,
  ): Promise<JsonObject> {
    let currentUrl = initialUrl;
    let currentMethod = initialMethod;
    let currentBody = body;
    let currentHeaders = this.copyHeaders(headers);
    const redirects: RedirectHop[] = [];
    const observedCookies: JsonObject[] = [];
    while (true) {
      this.assertWithinDeadline(deadline);
      const effectiveHeaders = this.copyHeaders(currentHeaders);
      if (sessionId !== null) {
        const cookieHeader = await CookieSessionStore.instance.cookieHeader(sessionId, currentUrl);
        if (cookieHeader.length > 0) {
          const explicitCookie = this.headerValue(effectiveHeaders, 'cookie');
          this.setHeader(effectiveHeaders, 'Cookie', mergeCookieHeader(explicitCookie ?? '', cookieHeader));
        }
      }
      const response = await this.singleHop(
        currentUrl, currentMethod, effectiveHeaders, currentBody, requestCharset, deadline,
      );
      if (sessionId !== null) {
        const setCookies = this.headerValues(response.rawHeaders, 'set-cookie');
        const stored = await CookieSessionStore.instance.storeResponseCookies(
          sessionId, currentUrl, setCookies,
        );
        observedCookies.push(...stored);
      }
      const location = this.headerValue(response.headers, 'location');
      if (!this.isRedirectStatus(response.status) || location === null || maxRedirects === 0) {
        return this.buildResponse(
          response, currentUrl, redirects, observedCookies, sessionId, requestCharset,
        );
      }
      if (!allowNextRedirect(true, maxRedirects, redirects.length)) {
        throw new Error(`http.execute: exceeded redirect limit ${maxRedirects}`);
      }
      const nextUrl = this.resolveRedirectUrl(location, currentUrl);
      const hop: RedirectHop = {
        status: response.status,
        fromUrl: currentUrl,
        toUrl: nextUrl,
        headers: response.headers,
      };
      redirects.push(hop);
      const rewritten = this.redirectMethod(response.status, currentMethod, currentBody);
      currentMethod = rewritten.method;
      currentBody = rewritten.body;
      if (rewritten.body.kind === 'none') {
        this.deleteHeader(currentHeaders, 'content-type');
        this.deleteHeader(currentHeaders, 'content-length');
        this.deleteHeader(currentHeaders, 'transfer-encoding');
      }
      if (!this.sameOrigin(currentUrl, nextUrl)) {
        for (const name of Object.keys(currentHeaders)) {
          if (isCrossOriginSensitiveHeader(name)) {
            delete currentHeaders[name];
          }
        }
      }
      currentUrl = nextUrl;
    }
  }

  private async singleHop(
    requestUrl: string,
    method: ParsedMethod,
    headers: Record<string, string>,
    body: EncodedBody,
    requestCharset: string | undefined,
    deadline: DeadlineState,
  ): Promise<HopResponse> {
    const request = http.createHttp();
    deadline.activeRequest = request;
    try {
      const interceptors = new http.HttpInterceptorChain();
      if (!interceptors.addChain([new StopBeforeRedirectInterceptor()]) ||
        !interceptors.apply(request)) {
        throw new Error('http.execute: cannot attach redirect interceptor');
      }
      this.assertWithinDeadline(deadline);
      const effectiveHeaders = this.copyHeaders(headers);
      const payload: string | ArrayBuffer | undefined = this.requestPayload(
        body, requestCharset, effectiveHeaders,
      );
      const remaining = deadline.deadlineAt - Date.now();
      if (remaining <= 0) {
        // The deadline may have elapsed while a (large) payload was built;
        // never hand the platform a negative timeout.
        throw new Error('http.execute: exceeded total deadline');
      }
      const options: http.HttpRequestOptions = {
        method: method.enumMethod,
        header: effectiveHeaders,
        // Preserve bytes so the Host—not an undocumented platform default—
        // owns the Core response conversion decision.
        expectDataType: http.HttpDataType.ARRAY_BUFFER,
        usingCache: false,
        // Clamp every per-request timeout to the remaining deadline budget.
        connectTimeout: Math.min(DEFAULT_CONNECT_TIMEOUT_MS, remaining),
        readTimeout: Math.min(DEFAULT_READ_TIMEOUT_MS, remaining),
        // The REDIRECTION interceptor stops before each automatic hop. A
        // positive platform limit is still required; zero is surfaced by
        // NetStack as 2300047 before returning the 3xx response.
        maxRedirects: MAX_REDIRECTS,
      };
      if (method.customVerb !== undefined) {
        options.customMethod = method.customVerb;
      }
      if (payload !== undefined) {
        options.extraData = payload;
      }
      const response = await request.request(requestUrl, options);
      // A response that lands after the deadline is a stale success: reject
      // it so a cancelled cycle never returns a late result.
      this.assertWithinDeadline(deadline);
      let bytes: Uint8Array;
      if (response.result instanceof ArrayBuffer) {
        bytes = new Uint8Array(response.result);
      } else if (this.isRedirectStatus(response.responseCode)) {
        // An intercepted 3xx hop has no body the Host consumes: the platform
        // surfaces it with an empty result instead of the requested
        // ArrayBuffer. Keep the Location header flowing to the redirect chain.
        bytes = new Uint8Array(0);
      } else {
        throw new Error('http.execute: platform did not return the requested raw response bytes');
      }
      if (bytes.length > MAX_RESPONSE_BYTES) {
        throw new Error(`http.execute: response exceeds ${MAX_RESPONSE_BYTES} byte limit`);
      }
      return {
        status: response.responseCode,
        headers: this.flattenHeaders(response.header),
        rawHeaders: response.header,
        bytes,
      };
    } finally {
      if (deadline.activeRequest === request) {
        deadline.activeRequest = null;
      }
      // Cleanup must not replace the request/decoding error that reached the
      // Core host boundary. The request object is otherwise short lived.
      try {
        request.destroy();
      } catch (_) {
        hilog.warn(LOG_DOMAIN, 'Reader', 'http.execute request cleanup failed');
      }
    }
  }

  private buildResponse(
    response: HopResponse,
    finalUrl: string,
    redirects: RedirectHop[],
    cookies: JsonObject[],
    sessionId: string | null,
    requestCharset: string | undefined,
  ): JsonObject {
    const contentType = this.headerValue(response.headers, 'content-type');
    // Binary payloads (images, fonts, downloads) have no text representation;
    // the strict TextDecoder below must never be asked to fail on them. The
    // reading body image flow consumes `bodyBase64`, so `body` is left empty
    // and the raw bytes remain the authoritative transport value.
    const binaryBody = contentType !== null && this.isBinaryContentType(contentType);
    const responseCharset = resolveResponseCharset(
      response.headers,
      binaryBody ? undefined : requestCharset,
    );
    let decoded = '';
    if (!binaryBody) {
      try {
        decoded = util.TextDecoder.create(responseCharset, { fatal: true }).decodeToString(response.bytes);
      } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        throw new Error(`http.execute: cannot decode response as ${responseCharset}: ${message}`);
      }
    }
    const result: JsonObject = {
      status: response.status,
      body: '',
      headers: response.headers,
      finalUrl,
      redirects,
      cookies,
    };
    if (responseCharset !== undefined) {
      result['charsetHint'] = responseCharset;
    }
    if (response.bytes.length > 0) {
      result['bodyBase64'] = new util.Base64Helper().encodeToStringSync(response.bytes);
    }
    if (sessionId !== null) {
      result['session'] = { id: sessionId };
    }
    return result;
  }

  /**
   * Returns the extraData payload (if any) for a body, applying request
   * charset encoding and, for Multipart, overriding the Content-Type header
   * with the generated boundary.
   */
  private requestPayload(
    body: EncodedBody,
    requestCharset: string | undefined,
    headers: Record<string, string>,
  ): string | ArrayBuffer | undefined {
    if (body.kind === 'none') {
      return undefined;
    }
    if (body.kind === 'multipart') {
      if (body.bytes.length > MAX_REQUEST_BODY_BYTES) {
        throw new Error(`http.execute: multipart body exceeds ${MAX_REQUEST_BODY_BYTES} byte limit`);
      }
      headers['Content-Type'] = body.contentType;
      return body.bytes.buffer;
    }
    if (body.kind === 'form') {
      const bytes = this.encodeFormFields(body.fields, requestCharset);
      return bytes.buffer;
    }
    return this.encodeRequestText(body.text, requestCharset);
  }

  private encodeRequestText(text: string, requestCharset: string | undefined): string | ArrayBuffer {
    const charset = requestCharset === undefined ? 'utf-8' : requestCharset;
    const normalized = charset.toLowerCase();
    if (normalized === 'utf-8' || normalized === 'utf8') {
      const length = new util.TextEncoder('utf-8').encode(text).length;
      if (length > MAX_REQUEST_BODY_BYTES) {
        throw new Error(`http.execute: request body exceeds ${MAX_REQUEST_BODY_BYTES} byte limit`);
      }
      return text;
    }
    return encodeSharedText(text, charset, MAX_REQUEST_BODY_BYTES).buffer;
  }

  private encodeFormFields(
    fields: Array<[string, string]>,
    requestCharset: string | undefined,
  ): Uint8Array {
    const charset = requestCharset === undefined ? 'utf-8' : requestCharset;
    const parts: string[] = [];
    for (const [name, fieldValue] of fields) {
      parts.push(`${this.formPercentEncode(name, charset)}=${this.formPercentEncode(fieldValue, charset)}`);
    }
    return new util.TextEncoder('utf-8').encode(parts.join('&'));
  }

  private formPercentEncode(value: string, charset: string): string {
    const bytes = encodeSharedText(value, charset, MAX_REQUEST_BODY_BYTES);
    let out = '';
    for (let index = 0; index < bytes.length; index += 1) {
      const byte = bytes[index];
      const alphaNumeric = byte >= 0x30 && byte <= 0x39 || byte >= 0x41 && byte <= 0x5a ||
        byte >= 0x61 && byte <= 0x7a;
      if (alphaNumeric || byte === 0x2d || byte === 0x2e || byte === 0x5f || byte === 0x2a) {
        out += String.fromCharCode(byte);
      } else if (byte === 0x20) {
        out += '+';
      } else {
        out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
      }
    }
    return out;
  }

  private parseMethod(value: unknown): ParsedMethod {
    const raw = typeof value === 'string' ? value.trim() : 'GET';
    if (raw.length === 0) {
      throw new Error('http.execute: method must be a non-empty HTTP token');
    }
    switch (raw.toUpperCase()) {
      case 'GET':
        return { wireMethod: 'GET', enumMethod: http.RequestMethod.GET, customVerb: undefined };
      case 'POST':
        return { wireMethod: 'POST', enumMethod: http.RequestMethod.POST, customVerb: undefined };
      case 'PUT':
        return { wireMethod: 'PUT', enumMethod: http.RequestMethod.PUT, customVerb: undefined };
      case 'DELETE':
        return { wireMethod: 'DELETE', enumMethod: http.RequestMethod.DELETE, customVerb: undefined };
      case 'HEAD':
        return { wireMethod: 'HEAD', enumMethod: http.RequestMethod.HEAD, customVerb: undefined };
      case 'OPTIONS':
        return { wireMethod: 'OPTIONS', enumMethod: http.RequestMethod.OPTIONS, customVerb: undefined };
      case 'CONNECT':
        return { wireMethod: 'CONNECT', enumMethod: http.RequestMethod.CONNECT, customVerb: undefined };
      case 'TRACE':
        return { wireMethod: 'TRACE', enumMethod: http.RequestMethod.TRACE, customVerb: undefined };
      default:
        if (!this.isValidHttpToken(raw)) {
          throw new Error('http.execute: method must be a valid HTTP token');
        }
        // WebDAV/PATCH verbs are not in the enum; API 23's customMethod passes
        // the exact token through (HTTP methods are case-sensitive). Never
        // send a wrong substitute method.
        return { wireMethod: raw, enumMethod: http.RequestMethod.GET, customVerb: raw };
    }
  }

  private redirectMethod(
    status: number,
    method: ParsedMethod,
    body: EncodedBody,
  ): { method: ParsedMethod; body: EncodedBody } {
    const decision = redirectMethodDecision(status, method.wireMethod, body.kind !== 'none');
    if (decision.method === method.wireMethod) {
      return { method, body };
    }
    return {
      method: this.parseMethod('GET'),
      body: { kind: 'none' },
    };
  }

  private isRedirectStatus(status: number): boolean {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
  }

  private resolveRedirectUrl(location: string, baseUrl: string): string {
    let resolved: string;
    try {
      resolved = url.URL.parseURL(location, baseUrl).toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      throw new Error(`http.execute: invalid redirect Location: ${message}`);
    }
    this.requireHttpUrl(resolved);
    return resolved;
  }

  private sameOrigin(left: string, right: string): boolean {
    return url.URL.parseURL(left).origin.toLowerCase() === url.URL.parseURL(right).origin.toLowerCase();
  }

  private requireHttpUrl(value: string): void {
    let parsed: url.URL;
    try {
      parsed = url.URL.parseURL(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      throw new Error(`http.execute: invalid url: ${message}`);
    }
    const protocol = parsed.protocol.toLowerCase();
    if ((protocol !== 'http:' && protocol !== 'https:') || parsed.hostname.length === 0) {
      throw new Error('http.execute: url must use http or https');
    }
  }

  private parseSession(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('http.execute: session must be an object');
    }
    const id = (value as Record<string, unknown>)['id'];
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('http.execute: session.id must be a non-empty string');
    }
    return id.trim();
  }

  private copyHeaders(headers: Record<string, string>): Record<string, string> {
    const copy: Record<string, string> = {};
    for (const key of Object.keys(headers)) {
      copy[key] = headers[key];
    }
    return copy;
  }

  private headerValue(headers: ResponseHeaders, wanted: string): string | null {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === wanted.toLowerCase()) {
        return headers[key];
      }
    }
    return null;
  }

  private setHeader(headers: Record<string, string>, preferredName: string, value: string): void {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === preferredName.toLowerCase()) {
        headers[key] = value;
        return;
      }
    }
    headers[preferredName] = value;
  }

  private deleteHeader(headers: Record<string, string>, wanted: string): void {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === wanted.toLowerCase()) {
        delete headers[key];
      }
    }
  }

  private isValidHttpToken(value: string): boolean {
    if (value.length === 0) {
      return false;
    }
    for (const ch of value) {
      const code = ch.charCodeAt(0);
      const alpha = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
      const digit = code >= 48 && code <= 57;
      const tchar = '!#$%&\'*+-.^_`|~'.indexOf(ch) >= 0;
      if (!alpha && !digit && !tchar) {
        return false;
      }
    }
    return true;
  }

  private parseRedirect(followRedirects: unknown, maxRedirects: unknown): number {
    if (followRedirects !== undefined && followRedirects !== null && typeof followRedirects !== 'boolean') {
      throw new Error('http.execute: followRedirects must be a boolean');
    }
    let requestedMax: number | undefined = undefined;
    if (maxRedirects !== undefined && maxRedirects !== null) {
      if (typeof maxRedirects !== 'number' || !Number.isFinite(maxRedirects) ||
        !Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > MAX_REDIRECTS) {
        throw new Error(`http.execute: maxRedirects must be an integer between 0 and ${MAX_REDIRECTS}`);
      }
      requestedMax = maxRedirects;
    }
    if (followRedirects === false) {
      if (requestedMax !== undefined && requestedMax !== 0) {
        throw new Error('http.execute: followRedirects=false conflicts with maxRedirects > 0');
      }
      return 0;
    }
    if (requestedMax !== undefined) {
      return requestedMax;
    }
    // Contract: the Host always enforces a redirect cap — Core's explicit
    // value, or this controlled default — for both `true` and omitted
    // followRedirects. It never delegates to an unbounded platform default.
    return DEFAULT_MAX_REDIRECTS;
  }

  private parseHeaders(value: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (value === undefined || value === null) {
      return out;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('http.execute: headers must be an object');
    }
    for (const key of Object.keys(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error(`http.execute: header name ${key} is not allowed`);
      }
      if (!this.isValidHttpToken(key)) {
        throw new Error(`http.execute: header name ${key} must be a valid HTTP token`);
      }
      const raw = (value as Record<string, unknown>)[key];
      if (typeof raw !== 'string') {
        throw new Error(`http.execute: header ${key} must be a string`);
      }
      this.assertNoCrLf(raw, `header ${key}`);
      out[key] = raw;
    }
    return out;
  }

  /**
   * Core serializes `HttpBody` on the wire as:
   *   None -> null | Raw -> JSON string | Form -> { fields: [[k, v]] }
   *   | Multipart -> { fields, files }.
   */
  private parseBody(value: unknown): EncodedBody {
    if (value === undefined || value === null) {
      return { kind: 'none' };
    }
    if (typeof value === 'string') {
      return { kind: 'text', text: value };
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if (obj['files'] !== undefined) {
        const fields = this.parseFormFields(obj['fields']);
        const files = this.parseMultipartFiles(obj['files']);
        const multipart = this.buildMultipart(fields, files);
        return { kind: 'multipart', contentType: multipart.contentType, bytes: multipart.bytes };
      }
      if (obj['fields'] !== undefined) {
        return { kind: 'form', fields: this.parseFormFields(obj['fields']) };
      }
    }
    throw new Error('http.execute: unsupported body shape');
  }

  private parseFormFields(value: unknown): Array<[string, string]> {
    const fields: Array<[string, string]> = [];
    if (value === undefined || value === null) {
      return fields;
    }
    if (!Array.isArray(value)) {
      throw new Error('http.execute: form fields must be an array of [name, value]');
    }
    const entries = value as Array<unknown>;
    for (const entry of entries) {
      if (Array.isArray(entry) && entry.length === 2 &&
        typeof entry[0] === 'string' && typeof entry[1] === 'string') {
        fields.push([entry[0], entry[1]]);
      }
    }
    return fields;
  }

  private parseMultipartFiles(value: unknown): MultipartFileWire[] {
    const files: MultipartFileWire[] = [];
    if (!Array.isArray(value)) {
      throw new Error('http.execute: multipart files must be an array');
    }
    const entries = value as Array<unknown>;
    for (const entry of entries) {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error('http.execute: multipart file entry must be an object');
      }
      const obj = entry as Record<string, unknown>;
      const fieldName = obj['fieldName'];
      const filename = obj['filename'];
      const contentType = obj['contentType'];
      if (typeof fieldName !== 'string' || typeof filename !== 'string' || typeof contentType !== 'string') {
        throw new Error('http.execute: multipart file requires fieldName, filename, contentType');
      }
      const data = obj['data'];
      if (data !== undefined && !Array.isArray(data)) {
        throw new Error('http.execute: multipart file data must be a byte array');
      }
      const filePath = obj['filePath'];
      if (typeof filePath !== 'string' && filePath !== undefined && filePath !== null) {
        throw new Error('http.execute: multipart file filePath must be a string');
      }
      const bytes: number[] = data === undefined ? [] : (data as Array<unknown>) as number[];
      if (bytes.length === 0 && typeof filePath === 'string' && filePath.trim().length > 0) {
        // Security: Core turns a source `@/path` verbatim into filePath
        // (analyze_url.rs:1674). This Host has no user-authorized
        // attachment-handle -> restricted-path mapping, so reading a
        // source-supplied path would expose every App-readable file to a
        // malicious source. Refuse until such an authorized handle exists;
        // inline `data` remains the only accepted upload form.
        throw new Error('http.execute: multipart filePath is not authorized by this Host; no attachment-handle mapping exists');
      }
      files.push({
        fieldName,
        filename,
        contentType,
        data: bytes,
        filePath: typeof filePath === 'string' ? filePath : undefined,
      });
    }
    return files;
  }

  private buildMultipart(
    fields: Array<[string, string]>,
    files: MultipartFileWire[],
  ): { contentType: string; bytes: Uint8Array } {
    const boundary = `reader-${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
    const encoder = new util.TextEncoder('utf-8');
    const chunks: Uint8Array[] = [];
    const pushText = (text: string): void => {
      chunks.push(encoder.encode(text));
    };
    const pushBytes = (bytes: Uint8Array): void => {
      chunks.push(bytes);
    };
    for (const [name, fieldValue] of fields) {
      this.assertNoCrLf(name, 'multipart field name');
      pushText(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${fieldValue}\r\n`);
    }
    for (const file of files) {
      this.assertNoCrLf(file.fieldName, 'multipart field name');
      this.assertNoCrLf(file.filename, 'multipart filename');
      this.assertNoCrLf(file.contentType, 'multipart Content-Type');
      pushText(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; ` +
        `filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
      );
      pushBytes(this.numberArrayToBytes(file.data));
      pushText('\r\n');
    }
    pushText(`--${boundary}--\r\n`);
    let total = 0;
    for (const chunk of chunks) {
      total += chunk.length;
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return { contentType: `multipart/form-data; boundary=${boundary}`, bytes };
  }

  private numberArrayToBytes(data: number[]): Uint8Array {
    const bytes = new Uint8Array(data.length);
    for (let index = 0; index < data.length; index += 1) {
      const value = data[index];
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new Error('http.execute: multipart file data must contain integers in 0..255');
      }
      bytes[index] = value;
    }
    return bytes;
  }

  private assertNoCrLf(value: string, field: string): void {
    if (value.indexOf('\r') >= 0 || value.indexOf('\n') >= 0) {
      throw new Error(`http.execute: ${field} must not contain CR/LF`);
    }
  }

  private parseCharset(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error('http.execute: charset must be a non-empty string');
    }
    return value.trim();
  }

  private parseRetry(value: unknown): RetryPolicy | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('http.execute: retry must be an object');
    }
    const obj = value as Record<string, unknown>;
    const attempts = obj['maxAttempts'];
    if (typeof attempts !== 'number' || !Number.isFinite(attempts) ||
      !Number.isInteger(attempts) || attempts < 1 || attempts > MAX_RETRY_ATTEMPTS) {
      throw new Error(`http.execute: retry.maxAttempts must be an integer between 1 and ${MAX_RETRY_ATTEMPTS}`);
    }
    const backoff = obj['backoffMillis'];
    if (backoff !== undefined && (typeof backoff !== 'number' || !Number.isFinite(backoff) || backoff < 0)) {
      throw new Error('http.execute: retry.backoffMillis must be a non-negative number');
    }
    return {
      maxAttempts: attempts,
      backoffMillis: typeof backoff === 'number' ? backoff : null,
    };
  }

  private async sleepRetryBackoff(retry: RetryPolicy | null, attempt: number, remainingMs: number): Promise<void> {
    if (retry === null || retry.backoffMillis === null || retry.backoffMillis <= 0) {
      return;
    }
    const backoff = retryBackoffMillis(
      retry.backoffMillis,
      attempt,
      MAX_RETRY_BACKOFF_MILLIS,
      remainingMs,
    );
    if (backoff <= 0) {
      throw new Error('http.execute: exceeded total deadline');
    }
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, backoff);
    });
  }

  private flattenHeaders(header: Object): ResponseHeaders {
    const out: ResponseHeaders = {};
    for (const key of Object.keys(header)) {
      const value = (header as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        const parts: string[] = [];
        for (const item of value) {
          parts.push(typeof item === 'string' ? item : `${item}`);
        }
        // Set-Cookie cannot be comma-folded because Expires itself contains a
        // comma. Cookie metadata is returned separately; newline keeps the
        // diagnostic header readable without inventing a different cookie.
        out[key] = key.toLowerCase() === 'set-cookie' ? parts.join('\n') : parts.join(', ');
      } else {
        out[key] = typeof value === 'string' ? value : `${value}`;
      }
    }
    return out;
  }

  private headerValues(header: Object, wanted: string): string[] {
    const values: string[] = [];
    for (const key of Object.keys(header)) {
      if (key.toLowerCase() !== wanted.toLowerCase()) {
        continue;
      }
      const value = (header as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          values.push(...this.splitCombinedSetCookie(typeof item === 'string' ? item : `${item}`));
        }
      } else {
        values.push(...this.splitCombinedSetCookie(typeof value === 'string' ? value : `${value}`));
      }
    }
    return values;
  }

  private splitCombinedSetCookie(value: string): string[] {
    // Some transports collapse repeated Set-Cookie headers. Split only at a
    // comma followed by a new cookie-name token and '=', never at the comma
    // inside `Expires=Wed, 09 Jun ...`.
    const parts: string[] = [];
    let start = 0;
    for (let index = 0; index < value.length; index += 1) {
      if (value.charAt(index) !== ',') {
        continue;
      }
      let cursor = index + 1;
      while (cursor < value.length && value.charAt(cursor) === ' ') {
        cursor += 1;
      }
      const tokenStart = cursor;
      while (cursor < value.length &&
        ('!#$%&\'*+-.^_`|~'.indexOf(value.charAt(cursor)) >= 0 ||
          /[A-Za-z0-9]/.test(value.charAt(cursor)))) {
        cursor += 1;
      }
      if (cursor > tokenStart && value.charAt(cursor) === '=') {
        const part = value.substring(start, index).trim();
        if (part.length > 0) {
          parts.push(part);
        }
        start = index + 1;
      }
    }
    const tail = value.substring(start).trim();
    if (tail.length > 0) {
      parts.push(tail);
    }
    return parts;
  }

  private isBinaryContentType(contentType: string): boolean {
    const normalized = contentType.trim().toLowerCase();
    if (normalized.startsWith('image/') || normalized.startsWith('audio/') ||
      normalized.startsWith('video/') || normalized.startsWith('font/')) {
      return true;
    }
    return normalized === 'application/octet-stream' || normalized === 'application/pdf' ||
      normalized === 'application/zip' || normalized === 'application/gzip';
  }

}

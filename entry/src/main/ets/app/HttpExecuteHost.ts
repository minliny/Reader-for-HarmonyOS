import http from '@ohos.net.http';
import url from '@ohos.url';
import util from '@ohos.util';
import connection from '@ohos.net.connection';
import { prepareNetworkTarget, NetworkEnvironmentError, type NetworkTarget } from './NetworkRoutePolicy';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { encodeSharedText, type JsonObject, type ReaderCoreAssetBridge } from '@reader/core-harmony';
import { CookieSessionStore } from './CookieSessionStore';
import { errorMessageOf } from './ErrorMessage';
import {
  allowNextRedirect,
  isCrossOriginSensitiveHeader,
  isPrivateNetworkTarget,
  mergeCookieHeader,
  normalizeCharsetLabel,
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
// Applied to the platform's maxLimit and checked again before TextDecoder/base64.
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const MAX_REQUEST_BODY_BYTES = 16 * 1024 * 1024;
const MAX_REQUEST_HEADERS = 128;
const MAX_HEADER_NAME_LENGTH = 256;
const MAX_HEADER_VALUE_LENGTH = 64 * 1024;
const MAX_FORM_FIELDS = 256;
const MAX_FORM_FIELD_CHARS = 1024 * 1024;
const MAX_MULTIPART_FILES = 64;
const MAX_MULTIPART_METADATA_CHARS = 64 * 1024;
// Host total deadline must not exceed Core's default 30s request timeout, so
// a Core caller that gives up never leaves this Host running in the
// background beyond its own budget.
const TOTAL_DEADLINE_MS = 25000;

type RetryPolicy = {
  maxAttempts: number;
  backoffMillis: number | null;
};

type ResponseHeaders = Record<string, string>;

export interface HttpBytesResponse {
  status: number;
  headers: ResponseHeaders;
  bytes: Uint8Array;
  finalUrl: string;
}

interface BinaryResponseSink {
  maxBytes: number;
  response?: HttpBytesResponse;
}

/** Optional Core-owned sink for a host.request response body. */
export interface HttpAssetSink {
  bridge: ReaderCoreAssetBridge;
  requestId: number;
  operationId: number;
}

type DeadlineState = {
  binarySink?: BinaryResponseSink;
  responseMaxBytes?: number;
  deadlineAt: number;
  cookieGeneration?: number;
  /** Restrict this request and every redirect hop to HTTPS. */
  httpsOnly?: boolean;
  /** Do not carry credential-bearing URL query values to another origin. */
  sameOriginRedirectsOnly?: boolean;
  cancelled: boolean;
  failureReason?: string;
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

/** Every native request rejection is transport evidence, not a rule verdict. */
class SourceHttpTransportError extends Error {
  readonly code: string = 'INTERNAL';
  readonly retryable: boolean;
  readonly details: JsonObject;

  constructor(message: string, platformCode: number | undefined) {
    super(message);
    this.name = 'SourceHttpTransportError';
    this.retryable = platformCode !== undefined &&
      [2300006, 2300007, 2300028, 2300052, 2300055, 2300056, 2300999].includes(platformCode);
    this.details = { category: 'SOURCE_HTTP_FAILED', phase: 'transport',
      stage: 'request.dispatch', transient: this.retryable };
    if (platformCode !== undefined) this.details['platformCode'] = platformCode;
  }
}

/**
 * Host-side `http.execute` adapter for the API-23 HarmonyOS transport.
 *
 * Wire contract (`HostHttpRequest`, camelCase): url, method, headers,
 * body (Raw=string | Form={fields:[[k,v]]} | Multipart={fields,files}),
 * charset (request-body encoding), followRedirects, maxRedirects, retry,
 * usePlatformCookieJar, session, diagnostic (opaque recorder context), and
 * the optional Host-only `httpsOnly` and `sameOriginRedirectsOnly` redirect
 * policies.
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
 * All request text bytes use Core's bounded shared encoder; ArkTS carries no
 * private GBK/Big5 tables. Text responses are decoded using response
 * Content-Type charset, then the Core descriptor charset, then UTF-8. Raw
 * bytes are retained as bodyBase64 only for binary responses.
 *
 * Fail-closed, never silently substituted: Multipart `filePath` (Core turns a
 * source `@/path` verbatim into
 * `filePath`; with no user-authorized attachment-handle mapping this Host
 * refuses to read a source-supplied path — inline `data` is the only accepted
 * upload form). A fresh HttpRequest is created/destroyed per hop; every
 * failure throws so the SDK routes `host.error`.
 */
export class HttpExecuteHost {
  private static targetTails: Map<string, Promise<void>> = new Map();
  private static reportedDiagnostics: Set<string> = new Set();
  static readonly instance: HttpExecuteHost = new HttpExecuteHost();
  private readonly activeByRequestId = new Map<number, DeadlineState>();
  private readonly sourceDiagnosticsByRequestId = new Map<number, SourceHttpDiagnosticRecord[]>();

  async execute(params: JsonObject, requestId?: number, isCancelled?: () => boolean): Promise<JsonObject> {
    return this.executeRequest(params, requestId, isCancelled);
  }

  /** Host-only text/document consumers can set a transport limit before decoding. */
  async executeBounded(params: JsonObject, maxBytes: number, requestId?: number,
    isCancelled?: () => boolean): Promise<JsonObject> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_RESPONSE_BYTES) {
      throw new Error('http.execute: invalid response limit');
    }
    return this.executeRequest(params, requestId, isCancelled, undefined, undefined, maxBytes);
  }

  /** Execute a Core host request and stream binary response bytes into its asset store. */
  async executeForCore(
    params: JsonObject,
    requestId: number,
    operationId: number,
    bridge: ReaderCoreAssetBridge,
    isCancelled?: () => boolean,
  ): Promise<JsonObject> {
    return this.executeRequest(params, requestId, isCancelled, undefined, {
      bridge, requestId, operationId,
    });
  }

  /** Host-only consumers share the exact network policy and cancellation path. */
  async executeBytes(params: JsonObject, maxBytes: number, requestId?: number, isCancelled?: () => boolean): Promise<HttpBytesResponse> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_RESPONSE_BYTES) {
      throw new Error('http.execute: invalid binary response limit');
    }
    const sink: BinaryResponseSink = { maxBytes };
    await this.executeRequest(params, requestId, isCancelled, sink);
    if (sink.response === undefined) throw new Error('http.execute: missing binary response');
    return sink.response;
  }

  private async executeRequest(
    params: JsonObject,
    requestId?: number,
    isCancelled?: () => boolean,
    binarySink?: BinaryResponseSink,
    assetSink?: HttpAssetSink,
    responseMaxBytes?: number,
  ): Promise<JsonObject> {
    const inputUrl = params['url'];
    if (typeof inputUrl !== 'string' || inputUrl.trim().length === 0) {
      throw new Error('http.execute requires non-empty url');
    }
    // The same serialized URL must reach admission, cookies and transport.
    // In particular, nested source JS can supply literal spaces/Unicode;
    // validating a parsed copy but sending the original gives native HTTP a
    // different representation. The platform URL API preserves existing
    // percent escapes, including source-selected legacy charset bytes.
    const requestUrl = this.requireHttpUrl(inputUrl);
    const httpsOnly = params['httpsOnly'];
    if (httpsOnly !== undefined && httpsOnly !== null && typeof httpsOnly !== 'boolean') {
      throw new Error('http.execute: httpsOnly must be a boolean');
    }
    const sameOriginRedirectsOnly = params['sameOriginRedirectsOnly'];
    if (sameOriginRedirectsOnly !== undefined && sameOriginRedirectsOnly !== null &&
      typeof sameOriginRedirectsOnly !== 'boolean') {
      throw new Error('http.execute: sameOriginRedirectsOnly must be a boolean');
    }
    // Final-look SSRF gate at the request execution boundary (P1-5). Every
    // fetch this Host issues enters here or through the redirect chain, both
    // of which run the shared private-target judge before any byte moves.
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
    deadline.binarySink = binarySink;
    deadline.responseMaxBytes = responseMaxBytes;
    deadline.httpsOnly = httpsOnly === true;
    deadline.sameOriginRedirectsOnly = sameOriginRedirectsOnly === true;
    if (sessionId !== null) {
      deadline.cookieGeneration = CookieSessionStore.instance.sessionGeneration(sessionId);
    }
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
        this.requestAfterTargetValidation(
          requestUrl, parsedMethod, headers, body, requestCharset,
          maxRedirects, retry, deadline, useCookieJar ? sessionId : null,
          assetSink,
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
      if (error instanceof SourceHttpTransportError && !deadline.cancelled) {
        // One summary per failed execute, after retries. Unlike the process
        // code inventory below, repeated native codes retain their request
        // association. Only numeric identity/timing and fixed tokens are logged.
        const safeRequestId = requestId !== undefined && Number.isSafeInteger(requestId) && requestId > 0
          ? requestId : 0;
        const elapsedMs = Math.max(0, Date.now() - diagnosticStartedAt);
        if (safeRequestId > 0) error.details['requestId'] = safeRequestId;
        error.details['elapsedMs'] = elapsedMs;
        const code = error.details['platformCode'];
        hilog.warn(LOG_DOMAIN, 'Reader',
          'http.execute failure requestId=%{public}d stage=request.dispatch code=%{public}s elapsedMs=%{public}d transient=%{public}s',
          safeRequestId, typeof code === 'number' ? `${code}` : 'none', elapsedMs, `${error.retryable}`);
      }
      this.recordSourceDiagnostic(
        diagnostic,
        parsedMethod.wireMethod,
        requestUrl,
        diagnosticStartedAt,
        undefined,
        errorMessageOf(error),
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
      httpsOnly: false,
      sameOriginRedirectsOnly: false,
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
    state.failureReason = message;
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
      throw new Error(state.failureReason ?? 'http.execute: exceeded total deadline');
    }
  }

  private raceDeadline<T>(operation: Promise<T>, state: DeadlineState): Promise<T> {
    // destroy() is not guaranteed to settle the platform request promise.
    // Keep the deadline inside the DNS lease as well as at the public entry.
    const expiry: Promise<T> = state.expired.then((): T => {
      throw new Error('http.execute: exceeded total deadline');
    });
    return Promise.race([operation, expiry]);
  }

  private async requestAfterTargetValidation(
    url: string,
    method: ParsedMethod,
    headers: Record<string, string>,
    body: EncodedBody,
    requestCharset: string | undefined,
    maxRedirects: number,
    retry: RetryPolicy | null,
    deadline: DeadlineState,
    sessionId: string | null,
    assetSink?: HttpAssetSink,
  ): Promise<JsonObject> {
    this.assertWithinDeadline(deadline);
    this.requireHttpsIfNeeded(url, deadline);
    this.rejectPrivateNetworkUrl(url);
    this.assertWithinDeadline(deadline);
    return this.requestWithPolicy(url, method, headers, body, requestCharset, maxRedirects, retry, deadline, sessionId, assetSink);
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
    assetSink?: HttpAssetSink,
  ): Promise<JsonObject> {
    const attempts = retry === null ? 1 : Math.max(1, Math.floor(retry.maxAttempts));
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      this.assertWithinDeadline(deadline);
      try {
        return await this.requestRedirectChain(
          url, method, headers, body, requestCharset, maxRedirects, deadline, sessionId, assetSink,
        );
      } catch (error) {
        if (deadline.cancelled) {
          throw new Error('http.execute: cancelled');
        }
        lastError = error instanceof Error ? error : new Error(errorMessageOf(error));
        if (attempt < attempts) {
          const remaining = deadline.deadlineAt - Date.now();
          if (remaining <= 0) {
            throw new Error('http.execute: exceeded total deadline');
          }
          await this.sleepRetryBackoff(retry, attempt, remaining);
        }
      }
    }
    this.reportTypeError(lastError, 'request.chain');
    hilog.error(LOG_DOMAIN, 'Reader', 'http.execute failed after %{public}d attempt(s): %{private}s',
      attempts, lastError === null ? 'unknown' : lastError.message);
    throw lastError ?? new Error('http.execute request failed');
  }

  private reportTypeError(error: unknown, stage: string): void {
    if (!(error instanceof TypeError) || HttpExecuteHost.reportedDiagnostics.size >= 16) return;
    // Only local source basenames and bounded line/column numbers may leave
    // the stack. Never log the stack itself, message, path or request data.
    const stack = typeof error.stack === 'string' ? error.stack.slice(0, 8192) : '';
    const match = /(?:^|[\s/(])(HttpExecuteHost|CookieSessionStore|NetworkRoutePolicy)\.(ts|ets):(\d{1,7})(?::(\d{1,7}))?/.exec(stack);
    const frame = match === null ? 'no-frame' : `${match[1]}.${match[2]}:${match[3]}:${match[4] ?? '0'}`;
    const key = `${stage}:${frame}`;
    if (HttpExecuteHost.reportedDiagnostics.has(key)) return;
    HttpExecuteHost.reportedDiagnostics.add(key);
    hilog.error(LOG_DOMAIN, 'Reader', 'http.execute TypeError stage=%{public}s frame=%{public}s', stage, frame);
  }

  private platformErrorCode(error: unknown): number | undefined {
    if (error === null || typeof error !== 'object') return undefined;
    const value = (error as { code?: unknown }).code;
    if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
    if (typeof value === 'string' && /^-?\d{1,15}$/.test(value)) return Number(value);
    return undefined;
  }

  private reportPlatformError(code: number | undefined): void {
    if (code === undefined || HttpExecuteHost.reportedDiagnostics.size >= 16) return;
    const key = `request.dispatch:${code}`;
    if (HttpExecuteHost.reportedDiagnostics.has(key)) return;
    HttpExecuteHost.reportedDiagnostics.add(key);
    hilog.error(LOG_DOMAIN, 'Reader', 'http.execute native failure phase=transport stage=request.dispatch code=%{public}d', code);
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
    assetSink?: HttpAssetSink,
  ): Promise<JsonObject> {
    let currentUrl = initialUrl;
    let currentMethod = initialMethod;
    let currentBody = body;
    let currentHeaders = this.copyHeaders(headers);
    const redirects: RedirectHop[] = [];
    const observedCookies: JsonObject[] = [];
    while (true) {
      this.assertWithinDeadline(deadline);
      this.requireHttpsIfNeeded(currentUrl, deadline);
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
          sessionId, currentUrl, setCookies, deadline.cookieGeneration,
        );
        observedCookies.push(...stored);
      }
      const location = this.headerValue(response.headers, 'location');
      if (!this.isRedirectStatus(response.status) || location === null || maxRedirects === 0) {
        return this.buildResponse(
          response, currentUrl, redirects, observedCookies, sessionId, requestCharset, deadline.binarySink, assetSink,
        );
      }
      if (!allowNextRedirect(true, maxRedirects, redirects.length)) {
        throw new Error(`http.execute: exceeded redirect limit ${maxRedirects}`);
      }
      const nextUrl = this.resolveRedirectUrl(location, currentUrl);
      this.requireHttpsIfNeeded(nextUrl, deadline);
      if (deadline.sameOriginRedirectsOnly && !this.sameOrigin(currentUrl, nextUrl)) {
        throw new Error('http.execute: cross-origin redirect is not allowed for this request');
      }
      // A public source must not be able to redirect into private address
      // space either: every hop target passes the same byte/DNS gate as the
      // entry URL before the next hop is issued.
      this.rejectPrivateNetworkUrl(nextUrl);
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
        // A source's explicit virtual-host override belongs to this origin.
        // Let native HTTP derive the new authority after a cross-origin hop.
        this.deleteHeader(currentHeaders, 'host');
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
    const target = await prepareNetworkTarget(requestUrl);
    this.assertWithinDeadline(deadline);
    const hostname = target.host;
    if (target.route === 'systemProxy' || hostname.includes(':') || /^[0-9.]+$/.test(hostname)) {
      return this.singleHopTransport(requestUrl, method, headers, body, requestCharset, deadline, target.route);
    }
    // The platform DNS override is application-wide. Serialize leases for
    // this host so another hop cannot remove a pin while it is in use.
    const priorLease = HttpExecuteHost.targetTails.get(hostname);
    const prior = priorLease ?? Promise.resolve();
    let release: () => void = (): void => {};
    const held = new Promise<void>((resolve): void => { release = resolve; });
    const tail = prior.catch((): void => {}).then((): Promise<void> => held);
    HttpExecuteHost.targetTails.set(hostname, tail);
    void tail.then((): void => {
      // A cancelled waiter must not erase the still-active predecessor's lock.
      if (HttpExecuteHost.targetTails.get(hostname) === tail) HttpExecuteHost.targetTails.delete(hostname);
    });
    let pinned = false;
    try {
      await this.raceDeadline(prior.catch((): void => {}), deadline);
      this.assertWithinDeadline(deadline);
      // Recheck after waiting for the host lease; network/proxy settings may
      // have changed while another request held the direct DNS pin.
      const admitted = priorLease === undefined ? target : await prepareNetworkTarget(requestUrl);
      if (admitted.route === 'systemProxy') {
        return await this.raceDeadline(this.singleHopTransport(requestUrl, method, headers, body, requestCharset, deadline, admitted.route), deadline);
      }
      const addresses = admitted.addresses;
      this.assertWithinDeadline(deadline);
      await connection.addCustomDnsRule(hostname, addresses);
      pinned = true;
      this.assertWithinDeadline(deadline);
      return await this.raceDeadline(this.singleHopTransport(requestUrl, method, headers, body, requestCharset, deadline, admitted.route), deadline);
    } finally {
      if (pinned) {
        try { await connection.removeCustomDnsRule(hostname); } catch (_) {
          // A retained rule contains only addresses admitted for the system route.
          hilog.warn(LOG_DOMAIN, 'Reader', 'DNS pin cleanup deferred');
        }
      }
      release();
    }
  }

  private async singleHopTransport(
    requestUrl: string,
    method: ParsedMethod,
    headers: Record<string, string>,
    body: EncodedBody,
    requestCharset: string | undefined,
    deadline: DeadlineState,
    route: NetworkTarget['route'] = 'direct',
  ): Promise<HopResponse> {
    const request = http.createHttp();
    deadline.activeRequest = request;
    let stage = 'request.interceptors';
    try {
      const interceptors = new http.HttpInterceptorChain();
      if (!interceptors.addChain([new StopBeforeRedirectInterceptor()]) ||
        !interceptors.apply(request)) {
        throw new Error('http.execute: cannot attach redirect interceptor');
      }
      this.assertWithinDeadline(deadline);
      const effectiveHeaders = this.copyHeaders(headers);
      stage = 'request.payload';
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
        usingProxy: route === 'systemProxy',
        maxLimit: deadline.responseMaxBytes ?? deadline.binarySink?.maxBytes ?? MAX_RESPONSE_BYTES,
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
      let response: http.HttpResponse;
      stage = 'request.dispatch';
      try {
        response = await request.request(requestUrl, options);
      } catch (error) {
        // A native rejection caused by our destroy() belongs to cancellation,
        // even when the platform supplies an otherwise valid transport code.
        if (deadline.cancelled) throw error;
        const platformCode = this.platformErrorCode(error);
        this.reportPlatformError(platformCode);
        this.reportTypeError(error, stage);
        // libcurl-derived platform codes: unresolved proxy, proxy peer connect,
        // and proxy handshake failure. Source TLS/body/timeout failures retain
        // their source-local classification so another candidate can be tried.
        if (route !== 'direct' &&
          (platformCode === 2300005 || platformCode === 2300007 || platformCode === 2300097)) {
          throw NetworkEnvironmentError.fromPlatform('transport', '当前代理连接未能完成请求，请检查代理后重试',
            'request.dispatch', error);
        }
        // TLS/URL/other native failures, including an Error with no code, must
        // retain their observed HTTP origin through SDK normalization and a
        // source's catch. Retryability is independent of that origin.
        throw new SourceHttpTransportError(errorMessageOf(error), platformCode);
      }
      stage = 'response.policy';
      if (route === 'systemProxy' && response.responseCode === 407) {
        throw new NetworkEnvironmentError('transport', '系统代理需要认证，请在代理设置中完成认证后重试');
      }
      // A response that lands after the deadline is a stale success: reject
      // it so a cancelled cycle never returns a late result.
      this.assertWithinDeadline(deadline);
      const maxResponseBytes = deadline.responseMaxBytes ?? deadline.binarySink?.maxBytes ?? MAX_RESPONSE_BYTES;
      stage = 'response.headers';
      const responseHeaders = this.flattenHeaders(response.header);
      const declaredLength = this.headerValue(responseHeaders, 'content-length');
      // HEAD/304 metadata may describe a representation that was not sent.
      // Native maxLimit bounds reception; this also rejects an oversized
      // declaration before text/audio/image decoding occurs.
      const permitsBody = method.wireMethod !== 'HEAD' && response.responseCode !== 204 &&
        response.responseCode !== 205 && response.responseCode !== 304 && !this.isRedirectStatus(response.responseCode);
      if (permitsBody && declaredLength !== null && /^\d+$/.test(declaredLength.trim()) &&
        Number(declaredLength) > maxResponseBytes) {
        throw new Error(`http.execute: declared response exceeds ${maxResponseBytes} byte limit`);
      }
      stage = 'response.bytes';
      let bytes: Uint8Array;
      if (response.result instanceof ArrayBuffer) {
        bytes = new Uint8Array(response.result);
      } else if (this.isRedirectStatus(response.responseCode)) {
        // An intercepted 3xx hop has no body the Host consumes: the platform
        // surfaces it with an empty result instead of the requested
        // ArrayBuffer. Keep the Location header flowing to the redirect chain.
        bytes = new Uint8Array(0);
      } else if (response.result === '' ||
        ((method.wireMethod === 'HEAD' || response.responseCode === 204 || response.responseCode === 205 ||
          response.responseCode === 304) && (response.result === undefined || response.result === null))) {
        // Empty strings have an exact zero-byte representation. Missing data
        // is valid only when HTTP semantics forbid content (RFC 9110 sections
        // 6.4.1 and 15.3.6); HEAD/304 Content-Length may describe a GET body.
        // A normal 200 with missing bytes or nonempty decoded text still fails.
        bytes = new Uint8Array(0);
      } else {
        const status = Number.isInteger(response.responseCode) && response.responseCode >= 100 &&
          response.responseCode <= 599 ? response.responseCode : 0;
        const resultType = response.result === null ? 'null' : typeof response.result;
        if (status >= 400 && (response.result === undefined || response.result === null)) {
          // A bodyless source rejection is already a known HTTP failure.
          // Preserve that status; neither invent success content nor blame
          // byte conversion for a 403/404/5xx response with no representation.
          throw new Error(`http.execute: source returned HTTP ${status} without response content`);
        }
        throw new Error(`http.execute: platform did not return the requested raw response bytes (status=${status}, type=${resultType})`);
      }
      if (bytes.length > maxResponseBytes) {
        throw new Error(`http.execute: response exceeds ${maxResponseBytes} byte limit`);
      }
      stage = 'response.headers';
      return {
        status: response.responseCode,
        headers: responseHeaders,
        rawHeaders: response.header,
        bytes,
      };
    } catch (error) {
      this.reportTypeError(error, stage);
      throw error;
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
    binarySink?: BinaryResponseSink,
    assetSink?: HttpAssetSink,
  ): JsonObject {
    const contentType = this.headerValue(response.headers, 'content-type');
    // Binary payloads (images, fonts, downloads) have no text representation;
    // the strict TextDecoder below must never be asked to fail on them. The
    // reading body image flow consumes `bodyBase64`, so `body` is left empty
    // and the raw bytes remain the authoritative transport value.
    const binaryBody = contentType !== null && this.isBinaryContentType(contentType);
    let responseCharset = 'utf-8';
    let decoded = '';
    if (binarySink !== undefined) {
      if (!binaryBody && response.bytes.length > 0) {
        throw new Error('http.execute: binary consumer requires a binary content type');
      }
      binarySink.response = { status: response.status, headers: response.headers, bytes: response.bytes, finalUrl };
    }
    if (!binaryBody && binarySink === undefined) {
      responseCharset = resolveResponseCharset(response.headers, requestCharset);
      decoded = this.decodeTextStrictly(response.bytes, responseCharset, requestCharset);
    }
    const result: JsonObject = {
      status: response.status,
      body: decoded,
      headers: response.headers,
      charsetHint: responseCharset,
      finalUrl,
      redirects,
      cookies,
    };
    // Text rules consume the already-decoded body. Keeping a second Base64
    // string for the same payload adds another full encoding pass and roughly
    // four thirds of the response size. Binary consumers still need it.
    if (binaryBody && response.bytes.length > 0 && binarySink === undefined && assetSink === undefined) {
      result['bodyBase64'] = new util.Base64Helper().encodeToStringSync(response.bytes);
    }
    if (binaryBody && response.bytes.length > 0 && binarySink === undefined && assetSink !== undefined) {
      let assetId: number | undefined;
      try {
        assetId = assetSink.bridge.begin(assetSink.requestId, assetSink.operationId, response.bytes.byteLength);
        const chunkBytes = 1024 * 1024;
        for (let offset = 0; offset < response.bytes.byteLength; offset += chunkBytes) {
          assetSink.bridge.write(
            assetSink.requestId,
            assetSink.operationId,
            assetId,
            response.bytes.subarray(offset, Math.min(response.bytes.byteLength, offset + chunkBytes)),
          );
        }
        const committedBytes = assetSink.bridge.commit(assetSink.requestId, assetSink.operationId, assetId);
        if (committedBytes !== response.bytes.byteLength) {
          throw new Error('Core response asset length mismatch after commit');
        }
        result['body'] = '';
        result['bodyAsset'] = {
          assetId,
          operationId: assetSink.operationId,
          bytes: committedBytes,
          contentType: contentType ?? undefined,
        };
      } catch (error) {
        if (assetId !== undefined) {
          try { assetSink.bridge.release(assetSink.requestId, assetSink.operationId, assetId); } catch (_) { /* Core teardown owns cleanup. */ }
        }
        throw error;
      }
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
      if (bytes.length > MAX_REQUEST_BODY_BYTES) {
        throw new Error(`http.execute: form body exceeds ${MAX_REQUEST_BODY_BYTES} byte limit`);
      }
      return bytes.buffer;
    }
    return this.encodeRequestText(body.text, requestCharset);
  }

  private encodeRequestText(text: string, requestCharset: string | undefined): ArrayBuffer {
    const charset = requestCharset === undefined ? 'utf-8' : requestCharset;
    // Use the same Core encoder for UTF-8 and legacy charsets, including
    // empty input. This preserves byte limits without relying on the native
    // util.TextEncoder.encode result shape or asking HTTP to encode again.
    return encodeSharedText(text, charset, MAX_REQUEST_BODY_BYTES).buffer;
  }

  private encodeFormFields(
    fields: Array<[string, string]>,
    requestCharset: string | undefined,
  ): Uint8Array {
    const charset = requestCharset === undefined ? 'utf-8' : requestCharset;
    const parts: string[] = [];
    let encodedBytes = 0;
    for (const [name, fieldValue] of fields) {
      const encodedName = this.formPercentEncode(name, charset);
      const encodedValue = this.formPercentEncode(fieldValue, charset);
      const partBytes = encodedName.length + 1 + encodedValue.length + (parts.length > 0 ? 1 : 0);
      if (partBytes > MAX_REQUEST_BODY_BYTES - encodedBytes) {
        throw new Error(`http.execute: form body exceeds ${MAX_REQUEST_BODY_BYTES} byte limit`);
      }
      encodedBytes += partBytes;
      parts.push(`${encodedName}=${encodedValue}`);
    }
    return encodeSharedText(parts.join('&'), 'utf-8', MAX_REQUEST_BODY_BYTES);
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
      const message = errorMessageOf(error);
      throw new Error(`http.execute: invalid redirect Location: ${message}`);
    }
    return this.requireHttpUrl(resolved);
  }

  private requireHttpsIfNeeded(value: string, deadline: DeadlineState): void {
    if (!deadline.httpsOnly) return;
    let parsed: url.URL;
    try {
      parsed = url.URL.parseURL(value);
    } catch (error) {
      const message = errorMessageOf(error);
      throw new Error(`http.execute: invalid url: ${message}`);
    }
    if (parsed.protocol.toLowerCase() !== 'https:') {
      throw new Error('http.execute: HTTPS is required for this request and its redirects');
    }
  }

  private sameOrigin(left: string, right: string): boolean {
    const leftUrl = url.URL.parseURL(left);
    const rightUrl = url.URL.parseURL(right);
    const effectivePort = (parsed: url.URL): string => {
      if (parsed.port.length > 0) {
        const numeric = Number(parsed.port);
        return Number.isSafeInteger(numeric) ? `${numeric}` : parsed.port;
      }
      return parsed.protocol.toLowerCase() === 'https:' ? '443' : '80';
    };
    return leftUrl.protocol.toLowerCase() === rightUrl.protocol.toLowerCase() &&
      leftUrl.hostname.toLowerCase() === rightUrl.hostname.toLowerCase() &&
      effectivePort(leftUrl) === effectivePort(rightUrl);
  }

  private requireHttpUrl(value: string): string {
    let parsed: url.URL;
    try {
      parsed = url.URL.parseURL(value);
    } catch (error) {
      const message = errorMessageOf(error);
      throw new Error(`http.execute: invalid url: ${message}`);
    }
    const protocol = parsed.protocol.toLowerCase();
    if ((protocol !== 'http:' && protocol !== 'https:') || parsed.hostname.length === 0) {
      throw new Error('http.execute: url must use http or https');
    }
    return parsed.toString();
  }

  /** Literal targets are checked at entry and before following a redirect.
   * DNS and the selected system route are validated together in singleHop.
   */
  private rejectPrivateNetworkUrl(requestUrl: string): void {
    const hostname = url.URL.parseURL(requestUrl).hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
    if (isPrivateNetworkTarget(hostname)) {
      throw new Error('http.execute: url targets a private, loopback, or link-local address and is not allowed');
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
    const keys = Object.keys(value);
    if (keys.length > MAX_REQUEST_HEADERS) {
      throw new Error(`http.execute: headers exceed ${MAX_REQUEST_HEADERS} entries`);
    }
    let totalBytes = 0;
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error(`http.execute: header name ${key} is not allowed`);
      }
      if (key.length > MAX_HEADER_NAME_LENGTH || !this.isValidHttpToken(key)) {
        throw new Error(`http.execute: header name ${key} must be a valid HTTP token`);
      }
      const raw = (value as Record<string, unknown>)[key];
      if (typeof raw !== 'string') {
        throw new Error(`http.execute: header ${key} must be a string`);
      }
      this.assertNoCrLf(raw, `header ${key}`);
      if (raw.length > MAX_HEADER_VALUE_LENGTH ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw)) {
        throw new Error(`http.execute: header ${key} contains an invalid value`);
      }
      totalBytes += key.length + raw.length;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        throw new Error(`http.execute: headers exceed ${MAX_REQUEST_BODY_BYTES} bytes`);
      }
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
    if (entries.length > MAX_FORM_FIELDS) {
      throw new Error(`http.execute: form fields exceed ${MAX_FORM_FIELDS} entries`);
    }
    let totalBytes = 0;
    for (const entry of entries) {
      if (Array.isArray(entry) && entry.length === 2 &&
        typeof entry[0] === 'string' && typeof entry[1] === 'string') {
        if (entry[0].length > MAX_FORM_FIELD_CHARS || entry[1].length > MAX_FORM_FIELD_CHARS) {
          throw new Error(`http.execute: form field exceeds ${MAX_FORM_FIELD_CHARS} characters`);
        }
        totalBytes += entry[0].length + entry[1].length;
        if (totalBytes > MAX_REQUEST_BODY_BYTES) {
          throw new Error(`http.execute: form fields exceed ${MAX_REQUEST_BODY_BYTES} bytes`);
        }
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
    if (entries.length > MAX_MULTIPART_FILES) {
      throw new Error(`http.execute: multipart files exceed ${MAX_MULTIPART_FILES} entries`);
    }
    let totalDataBytes = 0;
    let totalMetadataBytes = 0;
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
      if (fieldName.length > MAX_MULTIPART_METADATA_CHARS ||
        filename.length > MAX_MULTIPART_METADATA_CHARS ||
        contentType.length > MAX_MULTIPART_METADATA_CHARS) {
        throw new Error(`http.execute: multipart metadata exceeds ${MAX_MULTIPART_METADATA_CHARS} characters`);
      }
      totalMetadataBytes += fieldName.length + filename.length + contentType.length;
      if (totalMetadataBytes > MAX_REQUEST_BODY_BYTES) {
        throw new Error(`http.execute: multipart metadata exceeds ${MAX_REQUEST_BODY_BYTES} bytes`);
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
      if (bytes.length > MAX_REQUEST_BODY_BYTES ||
        totalDataBytes > MAX_REQUEST_BODY_BYTES - bytes.length) {
        throw new Error(`http.execute: multipart file data exceeds ${MAX_REQUEST_BODY_BYTES} bytes`);
      }
      totalDataBytes += bytes.length;
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
    const chunks: Uint8Array[] = [];
    const pushText = (text: string): void => {
      chunks.push(encodeSharedText(text, 'utf-8', MAX_REQUEST_BODY_BYTES));
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
    if (total > MAX_REQUEST_BODY_BYTES) {
      throw new Error(`http.execute: multipart body exceeds ${MAX_REQUEST_BODY_BYTES} byte limit`);
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

  /**
   * Every candidate label is decoded strictly (fatal:true); only the label
   * list grows. HarmonyOS TextDecoder rejects the legacy 'gb2312' label
   * Chinese sources declare (normalizeCharsetLabel maps it to 'gbk'), some
   * servers send unusable charset values, and legacy pages omit the header
   * entirely — so the attempt list walks declared charsets first, then
   * UTF-8, then GBK for undeclared GB-family pages. All candidates failing
   * still throws, keeping the Host fail-closed.
   */
  private decodeTextStrictly(
    bytes: Uint8Array,
    primaryCharset: string,
    descriptorCharset?: string,
  ): string {
    const candidates: string[] = [];
    for (const label of [primaryCharset, descriptorCharset, 'utf-8', 'gbk']) {
      if (label === undefined || label.trim().length === 0) {
        continue;
      }
      const normalized = normalizeCharsetLabel(label);
      if (!candidates.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
        candidates.push(normalized);
      }
    }
    const failures: string[] = [];
    for (const candidate of candidates) {
      try {
        return util.TextDecoder.create(candidate, { fatal: true }).decodeToString(bytes);
      } catch (error) {
        const message = errorMessageOf(error);
        failures.push(`${candidate}: ${message}`);
      }
    }
    throw new Error(
      `http.execute: cannot decode response (tried ${candidates.join(', ')}): ${failures.join('; ')}`,
    );
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

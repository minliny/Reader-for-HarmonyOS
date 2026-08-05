import http from '@ohos.net.http';
import util from '@ohos.util';
import { hilog } from '@kit.PerformanceAnalysisKit';
import type { JsonObject } from '@reader/core-harmony';

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
};

type EncodedBody =
  | { kind: 'none' }
  | { kind: 'text'; text: string }
  | { kind: 'multipart'; contentType: string; bytes: Uint8Array };

type MultipartFileWire = {
  fieldName: string;
  filename: string;
  contentType: string;
  data: number[];
  filePath?: string;
};

/**
 * Host-side `http.execute` adapter for the API-23 HarmonyOS transport.
 *
 * Wire contract (`HostHttpRequest`, camelCase): url, method, headers,
 * body (Raw=string | Form={fields:[[k,v]]} | Multipart={fields,files}),
 * charset (request-body encoding), followRedirects, maxRedirects, retry,
 * usePlatformCookieJar, session, diagnostic (opaque, ignored).
 *
 * Redirects: the API-23 transport follows redirects and exposes
 * `HttpRequestOptions.maxRedirects`. The Host always enforces a cap — Core's
 * explicit value, or a controlled default of 10 — for both `true` and omitted
 * `followRedirects`; `false` maps to 0 (best effort). It never delegates to
 * an unbounded platform default. The Host total deadline (25s, ≤ Core's 30s
 * default request timeout) cancels the in-flight request and suppresses
 * further retries, so a Core caller that gives up does not leave this Host
 * running behind.
 *
 * Custom verbs: the RequestMethod enum has no PATCH or WebDAV verbs.
 * API 23's `customMethod` passes those through verbatim; nothing is
 * substituted.
 *
 * Charset is separated: this Host can safely send Raw/Form text only as
 * UTF-8, because the platform TextEncoder contract is UTF-8. A requested
 * non-UTF-8 request charset is rejected rather than mislabeled. Responses are
 * decoded using their Content-Type charset or UTF-8; bytes are retained as
 * `bodyBase64` for Core.
 *
 * Fail-closed, never silently substituted: usePlatformCookieJar, session,
 * and Multipart `filePath` (Core turns a source `@/path` verbatim into
 * `filePath`; with no user-authorized attachment-handle mapping this Host
 * refuses to read a source-supplied path — inline `data` is the only accepted
 * upload form). The platform does not report the post-redirect final URL, so
 * `finalUrl` is omitted — Core's relative-link resolution after a redirect
 * falls back to the request URL (a device-verification gap). A fresh
 * HttpRequest is created/destroyed per attempt; every failure throws so the
 * SDK routes `host.error`.
 */
export class HttpExecuteHost {
  static readonly instance: HttpExecuteHost = new HttpExecuteHost();

  async execute(params: JsonObject): Promise<JsonObject> {
    const url = params['url'];
    if (typeof url !== 'string' || url.trim().length === 0) {
      throw new Error('http.execute requires non-empty url');
    }
    const parsedMethod = this.parseMethod(params['method']);
    const headers = this.parseHeaders(params['headers']);
    const body = this.parseBody(params['body']);
    const requestCharset = this.parseCharset(params['charset']);
    const retry = this.parseRetry(params['retry']);
    const maxRedirects = this.parseRedirect(params['followRedirects'], params['maxRedirects']);
    if (params['usePlatformCookieJar'] === true) {
      throw new Error('http.execute: usePlatformCookieJar is not supported by this Host');
    }
    if (params['session'] !== undefined && params['session'] !== null) {
      throw new Error('http.execute: session is not supported by this Host');
    }
    // `diagnostic` is opaque recorder context; operationId is the only
    // protocol correlation key for host.complete / host.error.
    const deadline = this.createDeadline(TOTAL_DEADLINE_MS);
    try {
      // Race guarantees the caller settles on time even if the platform's
      // destroy() does not settle request.request() promptly; the shared
      // `cancelled` flag still stops background retries and the post-await
      // check rejects a success that lands after the deadline.
      return await Promise.race([
        this.requestWithPolicy(
          url, parsedMethod.enumMethod, parsedMethod.customVerb,
          headers, body, requestCharset, maxRedirects, retry, deadline,
        ),
        deadline.expired,
      ]);
    } finally {
      this.disposeDeadline(deadline);
    }
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
    };
    state.timer = setTimeout((): void => {
      state.cancelled = true;
      const active = state.activeRequest;
      if (active !== null) {
        try {
          active.destroy();
        } catch (_) {
          // destroy may already be running; cancellation is already marked.
        }
      }
      rejectDeadline(new Error('http.execute: exceeded total deadline'));
    }, deadlineMs);
    return state;
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
    method: http.RequestMethod,
    customVerb: string | undefined,
    headers: Record<string, string>,
    body: EncodedBody,
    requestCharset: string | undefined,
    maxRedirects: number,
    retry: RetryPolicy | null,
    deadline: DeadlineState,
  ): Promise<JsonObject> {
    const attempts = retry === null ? 1 : Math.max(1, Math.floor(retry.maxAttempts));
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      this.assertWithinDeadline(deadline);
      try {
        return await this.singleRequest(url, method, customVerb, headers, body, requestCharset, maxRedirects, deadline);
      } catch (error) {
        if (deadline.cancelled) {
          throw new Error('http.execute: exceeded total deadline; cancelled');
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

  private async singleRequest(
    url: string,
    method: http.RequestMethod,
    customVerb: string | undefined,
    headers: Record<string, string>,
    body: EncodedBody,
    requestCharset: string | undefined,
    maxRedirects: number,
    deadline: DeadlineState,
  ): Promise<JsonObject> {
    const request = http.createHttp();
    deadline.activeRequest = request;
    try {
      this.assertWithinDeadline(deadline);
      const effectiveHeaders: Record<string, string> = {};
      for (const key of Object.keys(headers)) {
        effectiveHeaders[key] = headers[key];
      }
      const payload: string | ArrayBuffer | undefined = this.requestPayload(body, requestCharset, effectiveHeaders);
      const remaining = deadline.deadlineAt - Date.now();
      if (remaining <= 0) {
        // The deadline may have elapsed while a (large) payload was built;
        // never hand the platform a negative timeout.
        throw new Error('http.execute: exceeded total deadline');
      }
      const options: http.HttpRequestOptions = {
        method,
        header: effectiveHeaders,
        // Preserve bytes so the Host—not an undocumented platform default—
        // owns the Core response conversion decision.
        expectDataType: http.HttpDataType.ARRAY_BUFFER,
        usingCache: false,
        // Clamp every per-request timeout to the remaining deadline budget.
        connectTimeout: Math.min(DEFAULT_CONNECT_TIMEOUT_MS, remaining),
        readTimeout: Math.min(DEFAULT_READ_TIMEOUT_MS, remaining),
        maxRedirects,
      };
      if (customVerb !== undefined) {
        options.customMethod = customVerb;
      }
      if (payload !== undefined) {
        options.extraData = payload;
      }
      const response = await request.request(url, options);
      // A response that lands after the deadline is a stale success: reject
      // it so a cancelled cycle never returns a late result.
      this.assertWithinDeadline(deadline);
      const responseHeaders = this.flattenHeaders(response.header);
      const bytes = this.requireResponseBytes(response.result);
      if (bytes.length > MAX_RESPONSE_BYTES) {
        throw new Error(`http.execute: response exceeds ${MAX_RESPONSE_BYTES} byte limit`);
      }
      const responseCharset = this.resolveResponseCharset(responseHeaders);
      let decoded: string;
      try {
        decoded = util.TextDecoder.create(responseCharset, { fatal: true }).decodeToString(bytes);
      } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        throw new Error(`http.execute: cannot decode response as ${responseCharset}: ${message}`);
      }
      const result: JsonObject = {
        status: response.responseCode,
        body: decoded,
        headers: responseHeaders,
        charsetHint: responseCharset,
      };
      if (bytes.length > 0) {
        result['bodyBase64'] = new util.Base64Helper().encodeToStringSync(bytes);
      }
      // The API gives no trustworthy final URL or redirect-hop chain. Omit
      // both fields; pretending the initial URL is final would corrupt Core
      // redirect-sensitive rules.
      return result;
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
      headers['Content-Type'] = body.contentType;
      return body.bytes.buffer;
    }
    return this.encodeRequestText(body.text, requestCharset);
  }

  private encodeRequestText(text: string, requestCharset: string | undefined): string {
    const charset = requestCharset === undefined ? 'utf-8' : requestCharset;
    const normalized = charset.toLowerCase();
    if (normalized === 'utf-8' || normalized === 'utf8') {
      return text;
    }
    throw new Error(`http.execute: non-UTF-8 request charset is not supported: ${charset}`);
  }

  private parseMethod(value: unknown): { enumMethod: http.RequestMethod; customVerb: string | undefined } {
    const raw = typeof value === 'string' ? value.trim() : 'GET';
    if (raw.length === 0) {
      throw new Error('http.execute: method must be a non-empty HTTP token');
    }
    switch (raw.toUpperCase()) {
      case 'GET':
        return { enumMethod: http.RequestMethod.GET, customVerb: undefined };
      case 'POST':
        return { enumMethod: http.RequestMethod.POST, customVerb: undefined };
      case 'PUT':
        return { enumMethod: http.RequestMethod.PUT, customVerb: undefined };
      case 'DELETE':
        return { enumMethod: http.RequestMethod.DELETE, customVerb: undefined };
      case 'HEAD':
        return { enumMethod: http.RequestMethod.HEAD, customVerb: undefined };
      case 'OPTIONS':
        return { enumMethod: http.RequestMethod.OPTIONS, customVerb: undefined };
      case 'CONNECT':
        return { enumMethod: http.RequestMethod.CONNECT, customVerb: undefined };
      case 'TRACE':
        return { enumMethod: http.RequestMethod.TRACE, customVerb: undefined };
      default:
        if (!this.isValidHttpToken(raw)) {
          throw new Error('http.execute: method must be a valid HTTP token');
        }
        // WebDAV/PATCH verbs are not in the enum; API 23's customMethod passes
        // the exact token through (HTTP methods are case-sensitive). Never
        // send a wrong substitute method.
        return { enumMethod: http.RequestMethod.GET, customVerb: raw };
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
        return { kind: 'text', text: this.buildFormEncoded(this.parseFormFields(obj['fields'])) };
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

  private buildFormEncoded(fields: Array<[string, string]>): string {
    const pairs: string[] = [];
    for (const [name, fieldValue] of fields) {
      pairs.push(`${encodeURIComponent(name)}=${encodeURIComponent(fieldValue)}`);
    }
    return pairs.join('&');
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
    const backoff = Math.min(retry.backoffMillis * attempt, MAX_RETRY_BACKOFF_MILLIS, remainingMs);
    if (backoff <= 0) {
      throw new Error('http.execute: exceeded total deadline');
    }
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, backoff);
    });
  }

  private requireResponseBytes(result: string | Object | ArrayBuffer): Uint8Array {
    if (!(result instanceof ArrayBuffer)) {
      throw new Error('http.execute: platform did not return the requested raw response bytes');
    }
    return new Uint8Array(result);
  }

  private flattenHeaders(header: Object): ResponseHeaders {
    const out: ResponseHeaders = {};
    for (const key of Object.keys(header)) {
      const value = (header as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        // RFC 7230 §3.2.2: combine repeated fields with a comma. Core reads
        // response headers via `Value::as_str()`, so an array value would be
        // treated as absent.
        const parts: string[] = [];
        for (const item of value) {
          parts.push(typeof item === 'string' ? item : `${item}`);
        }
        out[key] = parts.join(', ');
      } else {
        out[key] = typeof value === 'string' ? value : `${value}`;
      }
    }
    return out;
  }

  private resolveResponseCharset(headers: ResponseHeaders): string {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() !== 'content-type') {
        continue;
      }
      const match = /charset\s*=\s*([^;\s]+)/i.exec(headers[key]);
      if (match !== null && match[1].trim().length > 0) {
        return match[1].trim();
      }
    }
    return 'utf-8';
  }
}

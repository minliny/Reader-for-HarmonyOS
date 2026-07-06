// MediaDownloadHandler — handles the 'media.download' capability.
//
// Mirrors the Core contract in crates/reader-contract/src/host.rs
// (HostMediaDownloadRequest / HostMediaDownloadResponse, commit 3e4fcb7b).
// Core emits host.request with capability='media.download' and params matching
// HostMediaDownloadRequest (camelCase JSON keys); this handler validates the
// params, delegates to a MediaDownloadExecutor, and wraps the
// MediaDownloadResult as hostReplySuccess.result (for host.complete).
//
// The host owns the network + filesystem — Core never opens a socket or writes
// files directly (charter §4 Core/Host boundary). The executor abstraction lets
// the handler be proven headless via StubMediaDownloadExecutor while production
// wires ArkMediaDownloadExecutor (real @ohos.net.http + filesystem cache
// backend, future increment).
//
// Mirrors WebViewEvaluateJavaScriptHandler.ets / AntiBotChallengeHandler.ets
// (executor + Stub + Ark stub pattern) for 3/3 parity with iOS/Android
// media.download handlers.
import { CapabilityHandler } from './CapabilityHandler';
import { HostReply, hostReplySuccess, hostReplyError } from './HostReply';
import { http } from '@kit.NetworkKit';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';

export const MEDIA_DOWNLOAD_CAPABILITY = 'media.download';

// Request mirroring HostMediaDownloadRequest (Core host.rs). camelCase JSON
// keys match the Rust serde rename_all = "camelCase" convention.
export interface MediaDownloadRequest {
  url: string;
  method?: string;               // GET or HEAD (default GET)
  headers?: Record<string, string>;
  rangeStart?: number;
  rangeEnd?: number;             // requires rangeStart, >= rangeStart
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  cacheKey?: string;
  savePath?: string;
  maxBytes?: number;
  sessionId?: string;
  timeoutMillis?: number;
}

// Result mirroring HostMediaDownloadResponse (Core host.rs).
export interface MediaDownloadResult {
  resourceId: string;
  tempPath?: string;
  statusCode: number;            // 200/206/304
  contentType?: string;
  contentLength?: number;
  etag?: string;
  byteLength: number;
  sha256?: string;
  fromCache: boolean;
  finalUrl?: string;
}

// Executor abstraction — production wires ArkMediaDownloadExecutor (real
// @ohos.net.http + filesystem cache + sha256 hashing); tests wire
// StubMediaDownloadExecutor. Mirrors WebViewExecutor / AntiBotExecutor.
export interface MediaDownloadExecutor {
  execute(request: MediaDownloadRequest): Promise<MediaDownloadResult>;
}

// StubMediaDownloadExecutor — hermetic canned-response executor for proof
// tests. Captures every request in capturedRequests so proofs can assert the
// handler parsed params correctly before delegating. Mirrors
// StubWebViewExecutor / StubAntiBotExecutor, with the addition of the
// capturedRequests array (media.download needs request-shape verification for
// range / cacheKey threading).
export class StubMediaDownloadExecutor implements MediaDownloadExecutor {
  private result: MediaDownloadResult | null;
  capturedRequests: MediaDownloadRequest[] = [];

  constructor(result?: MediaDownloadResult) {
    this.result = result ?? null;
  }

  async execute(request: MediaDownloadRequest): Promise<MediaDownloadResult> {
    this.capturedRequests.push(request);
    if (this.result === null) {
      // Default: 200 OK empty body (matches a clean successful download).
      return {
        resourceId: 'stub-default',
        statusCode: 200,
        byteLength: 0,
        fromCache: false
      } as MediaDownloadResult;
    }
    return this.result as MediaDownloadResult;
  }
}

// ArkMediaDownloadExecutor — production executor (Phase 2). Uses @ohos.net.http
// to download media content and @kit.CryptoArchitectureKit for SHA-256 hashing.
// Mirrors OHOSHTTPHostTransport's @ohos.net.http usage pattern (http.createHttp
// → client.request → resp handling → client.destroy in finally).
//
// Tier: REAL EXECUTOR. Replaces the device-headless beta stub with real network
// I/O. The handler catches executor throws and wraps them as structured
// HostReply errors (code=INTERNAL). Non-2xx/304 responses are returned as
// MediaDownloadResult with the actual statusCode (caller decides how to handle
// 4xx/5xx); network failures throw Error.
//
// Per charter §4 / §10.2: Host owns real HTTP/TLS — Core only produces request
// descriptors, never opens sockets. ArkMediaDownloadExecutor is the media.download
// execution path in the HarmonyOS host layer.
//
// canEnterMainline remains false — this is executor layer, not App-level.
// In-memory download (no tempPath) — the executor does not have cacheDir access;
// tempPath is left undefined. Future increments can wire a cacheDir via the
// constructor (mirrors DownloadAdapter pattern).
export class ArkMediaDownloadExecutor implements MediaDownloadExecutor {
  async execute(request: MediaDownloadRequest): Promise<MediaDownloadResult> {
    const client = http.createHttp();
    try {
      // Build headers — copy request.headers (don't mutate the original), then
      // add Range / If-None-Match / If-Modified-Since as conditional headers.
      const headers: Record<string, string> = {} as Record<string, string>;
      if (request.headers !== undefined && request.headers !== null) {
        const srcKeys = Object.keys(request.headers);
        for (let i = 0; i < srcKeys.length; i++) {
          const k = srcKeys[i];
          headers[k] = request.headers[k];
        }
      }
      if (request.rangeStart !== undefined) {
        const end = request.rangeEnd !== undefined ? String(request.rangeEnd) : '';
        headers['Range'] = `bytes=${request.rangeStart}-${end}`;
      }
      if (request.ifNoneMatch !== undefined) {
        headers['If-None-Match'] = request.ifNoneMatch;
      }
      if (request.ifModifiedSince !== undefined) {
        headers['If-Modified-Since'] = request.ifModifiedSince;
      }

      const method = (request.method ?? 'GET').toUpperCase();
      const timeout = request.timeoutMillis ?? 30000;
      const options: http.HttpRequestOptions = {
        method: method === 'HEAD' ? http.RequestMethod.HEAD : http.RequestMethod.GET,
        header: headers,
        expectDataType: http.HttpDataType.ARRAY_BUFFER,
        connectTimeout: timeout,
        readTimeout: timeout
      } as http.HttpRequestOptions;

      let resp: http.HttpResponse;
      try {
        resp = await client.request(request.url, options);
      } catch (e) {
        // Network/DNS/timeout error. Wrap as Error to satisfy
        // arkts-limited-throw. Handler catches and wraps as INTERNAL.
        const msg = e instanceof Error ? (e as Error).message : String(e);
        throw new Error(`media.download network error: ${msg}`);
      }

      const statusCode = resp.responseCode;
      const respHeaders = this.parseHeaders(resp.header);
      const contentType = respHeaders['Content-Type'] ?? respHeaders['content-type'] ?? '';
      const etag = respHeaders['ETag'] ?? respHeaders['etag'] ?? undefined;
      const contentLengthStr = respHeaders['Content-Length'] ?? respHeaders['content-length'] ?? '';
      const contentLength = contentLengthStr.length > 0 ? parseInt(contentLengthStr, 10) : undefined;

      // Extract body bytes. ARRAY_BUFFER should return ArrayBuffer, but handle
      // all possible result types for robustness (mirrors OHOSHTTPHostTransport
      // normalizeResult but keeps bytes rather than converting to string).
      let bodyBytes: Uint8Array = new Uint8Array(0);
      const result = resp.result;
      if (result !== undefined && result !== null) {
        if (result instanceof ArrayBuffer) {
          bodyBytes = new Uint8Array(result);
        } else if (typeof result === 'string') {
          bodyBytes = this.stringToBytes(result as string);
        } else {
          // Object — JSON.stringify fallback (shouldn't happen for ARRAY_BUFFER).
          const json = JSON.stringify(result);
          bodyBytes = this.stringToBytes(json);
        }
      }

      // Enforce maxBytes cap (throws if exceeded — handler wraps as INTERNAL).
      if (request.maxBytes !== undefined && bodyBytes.length > request.maxBytes) {
        throw new Error(
          `media.download exceeded maxBytes: ${bodyBytes.length} > ${request.maxBytes}`
        );
      }

      // Compute SHA-256 of downloaded bytes via @kit.CryptoArchitectureKit.
      const sha256 = this.computeSha256(bodyBytes);
      const resourceId = `media-${sha256.substring(0, 16)}`;

      return {
        resourceId: resourceId,
        statusCode: statusCode,
        contentType: contentType.length > 0 ? contentType : undefined,
        contentLength: contentLength,
        etag: etag,
        byteLength: bodyBytes.length,
        sha256: sha256,
        fromCache: false,
        finalUrl: request.url
      } as MediaDownloadResult;
    } finally {
      client.destroy();
    }
  }

  private parseHeaders(header: Object): Record<string, string> {
    const result: Record<string, string> = {};
    if (!header) { return result; }
    const keys = Object.keys(header);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = (header as Record<string, Object>)[k];
      result[k] = Array.isArray(v) ? (v as string[]).join(', ') : String(v);
    }
    return result;
  }

  private computeSha256(bytes: Uint8Array): string {
    const md = cryptoFramework.createMd('SHA256');
    md.updateSync({ data: bytes } as cryptoFramework.DataBlob);
    const digest = md.digestSync();
    let hex = '';
    for (let i = 0; i < digest.data.length; i++) {
      const b = digest.data[i];
      hex += (b < 16 ? '0' : '') + b.toString(16);
    }
    return hex;
  }

  private stringToBytes(s: string): Uint8Array {
    // Encode string as bytes (ASCII-safe, mirrors LegadoNonUIParityServices
    // bytes() helper). Used only as a fallback when @ohos.net.http returns a
    // string result instead of the requested ARRAY_BUFFER.
    const output = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      output[i] = s.charCodeAt(i) & 0xff;
    }
    return output;
  }
}

// Factory: makeMediaDownloadHandler
// Mirrors makeWebViewEvaluateJavaScriptHandler: takes the executor dependency,
// returns a CapabilityHandler that validates params, calls the executor, and
// builds the HostReply.
export function makeMediaDownloadHandler(executor: MediaDownloadExecutor): CapabilityHandler {
  const handler: CapabilityHandler = async (params: Record<string, Object>): Promise<HostReply> => {
    // 1. Parse + validate url (required, non-blank, http(s) scheme)
    const urlValue = params['url'];
    if (typeof urlValue !== 'string' || (urlValue as string).length === 0) {
      return hostReplyError(
        'INVALID_ARGUMENT',
        'media.download requires non-blank url',
        false
      );
    }
    const url = urlValue as string;
    const lowerUrl = url.toLowerCase();
    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      const colonIdx = url.indexOf(':');
      const scheme = colonIdx > 0 ? url.substring(0, colonIdx) : '(none)';
      return hostReplyError(
        'INVALID_ARGUMENT',
        `media.download url must use http or https scheme (got "${scheme}")`,
        false
      );
    }

    // 2. Parse + validate method (optional, GET or HEAD only; default GET)
    const methodValue = params['method'];
    let method: string | undefined = undefined;
    if (methodValue !== null && methodValue !== undefined) {
      if (typeof methodValue !== 'string') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download method must be a string',
          false
        );
      }
      const rawMethod = methodValue as string;
      const m = rawMethod.toUpperCase();
      if (m !== 'GET' && m !== 'HEAD') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          `media.download method must be GET or HEAD (got "${rawMethod}")`,
          false
        );
      }
      method = m;
    }

    // 3. Parse + validate headers (optional, Record<string, string>)
    const headersValue = params['headers'];
    let headers: Record<string, string> = {} as Record<string, string>;
    if (headersValue !== null && headersValue !== undefined) {
      if (typeof headersValue !== 'object') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download headers must be an object',
          false
        );
      }
      headers = headersValue as Record<string, string>;
    }

    // 4. Parse + validate rangeStart / rangeEnd
    const rangeStartValue = params['rangeStart'];
    let rangeStart: number | undefined = undefined;
    if (rangeStartValue !== null && rangeStartValue !== undefined) {
      if (typeof rangeStartValue !== 'number') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download rangeStart must be a number',
          false
        );
      }
      rangeStart = rangeStartValue as number;
    }

    const rangeEndValue = params['rangeEnd'];
    let rangeEnd: number | undefined = undefined;
    if (rangeEndValue !== null && rangeEndValue !== undefined) {
      if (typeof rangeEndValue !== 'number') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download rangeEnd must be a number',
          false
        );
      }
      rangeEnd = rangeEndValue as number;
      // rangeEnd requires rangeStart
      if (rangeStart === undefined) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download rangeEnd requires rangeStart',
          false
        );
      }
      // rangeEnd must be >= rangeStart
      if ((rangeEnd as number) < (rangeStart as number)) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          `media.download rangeEnd (${rangeEnd as number}) must be >= rangeStart (${rangeStart as number})`,
          false
        );
      }
    }

    // 5. Parse + validate ifNoneMatch / ifModifiedSince (optional strings)
    const ifNoneMatchValue = params['ifNoneMatch'];
    let ifNoneMatch: string | undefined = undefined;
    if (ifNoneMatchValue !== null && ifNoneMatchValue !== undefined) {
      if (typeof ifNoneMatchValue !== 'string') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download ifNoneMatch must be a string',
          false
        );
      }
      ifNoneMatch = ifNoneMatchValue as string;
    }

    const ifModifiedSinceValue = params['ifModifiedSince'];
    let ifModifiedSince: string | undefined = undefined;
    if (ifModifiedSinceValue !== null && ifModifiedSinceValue !== undefined) {
      if (typeof ifModifiedSinceValue !== 'string') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download ifModifiedSince must be a string',
          false
        );
      }
      ifModifiedSince = ifModifiedSinceValue as string;
    }

    // 6. Parse + validate cacheKey / savePath / sessionId (optional strings)
    const cacheKeyValue = params['cacheKey'];
    let cacheKey: string | undefined = undefined;
    if (cacheKeyValue !== null && cacheKeyValue !== undefined) {
      if (typeof cacheKeyValue !== 'string') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download cacheKey must be a string',
          false
        );
      }
      cacheKey = cacheKeyValue as string;
    }

    const savePathValue = params['savePath'];
    let savePath: string | undefined = undefined;
    if (savePathValue !== null && savePathValue !== undefined) {
      if (typeof savePathValue !== 'string') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download savePath must be a string',
          false
        );
      }
      savePath = savePathValue as string;
    }

    const sessionIdValue = params['sessionId'];
    let sessionId: string | undefined = undefined;
    if (sessionIdValue !== null && sessionIdValue !== undefined) {
      if (typeof sessionIdValue !== 'string') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download sessionId must be a string',
          false
        );
      }
      sessionId = sessionIdValue as string;
    }

    // 7. Parse + validate maxBytes (optional, must be > 0)
    const maxBytesValue = params['maxBytes'];
    let maxBytes: number | undefined = undefined;
    if (maxBytesValue !== null && maxBytesValue !== undefined) {
      if (typeof maxBytesValue !== 'number') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download maxBytes must be a number',
          false
        );
      }
      const mb = maxBytesValue as number;
      if (mb <= 0) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download maxBytes must be greater than 0',
          false
        );
      }
      maxBytes = mb;
    }

    // 8. Parse + validate timeoutMillis (optional, must be > 0)
    const timeoutMillisValue = params['timeoutMillis'];
    let timeoutMillis: number | undefined = undefined;
    if (timeoutMillisValue !== null && timeoutMillisValue !== undefined) {
      if (typeof timeoutMillisValue !== 'number') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download timeoutMillis must be a number',
          false
        );
      }
      const tm = timeoutMillisValue as number;
      if (tm <= 0) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'media.download timeoutMillis must be greater than 0',
          false
        );
      }
      timeoutMillis = tm;
    }

    // 9. Build the MediaDownloadRequest for the executor. method defaults to
    // GET (mirrors Core's HostMediaDownloadRequest::default_method).
    const dlRequest: MediaDownloadRequest = {
      url: url,
      method: method ?? 'GET',
      headers: headers,
      rangeStart: rangeStart,
      rangeEnd: rangeEnd,
      ifNoneMatch: ifNoneMatch,
      ifModifiedSince: ifModifiedSince,
      cacheKey: cacheKey,
      savePath: savePath,
      maxBytes: maxBytes,
      sessionId: sessionId,
      timeoutMillis: timeoutMillis
    } as MediaDownloadRequest;

    // 10. Call the executor + build the response
    try {
      const dlResult: MediaDownloadResult = await executor.execute(dlRequest);
      // SDK-COMPAT: build result via typed record to satisfy
      // arkts-no-untyped-obj-literals. Mirrors AntiBotChallengeHandler result
      // building (direct assignment auto-boxes primitives to Object).
      const result: Record<string, Object> = {} as Record<string, Object>;
      result['resourceId'] = dlResult.resourceId;
      result['statusCode'] = dlResult.statusCode;
      result['byteLength'] = dlResult.byteLength;
      result['fromCache'] = dlResult.fromCache;
      if (dlResult.tempPath !== undefined && dlResult.tempPath !== null) {
        result['tempPath'] = dlResult.tempPath;
      }
      if (dlResult.contentType !== undefined && dlResult.contentType !== null) {
        result['contentType'] = dlResult.contentType;
      }
      if (dlResult.contentLength !== undefined && dlResult.contentLength !== null) {
        result['contentLength'] = dlResult.contentLength;
      }
      if (dlResult.etag !== undefined && dlResult.etag !== null) {
        result['etag'] = dlResult.etag;
      }
      if (dlResult.sha256 !== undefined && dlResult.sha256 !== null) {
        result['sha256'] = dlResult.sha256;
      }
      if (dlResult.finalUrl !== undefined && dlResult.finalUrl !== null) {
        result['finalUrl'] = dlResult.finalUrl;
      }
      return hostReplySuccess(result);
    } catch (e) {
      const msg = e instanceof Error ? (e as Error).message : String(e);
      return hostReplyError('INTERNAL', `media.download failed: ${msg}`, true);
    }
  };
  return handler;
}

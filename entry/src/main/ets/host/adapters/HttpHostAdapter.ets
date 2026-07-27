// HttpHostAdapter — HarmonyOS @ohos.net.http backed Host adapter for http.execute.
// Source of truth: Reader-Core-Native docs/host-app-contracts/01-network-session.md §3.1/§3.2.
// Phase 4 implementation; consumed by HostDispatcher / CapabilityRouter.
//
// Method mapping: standard verbs use http.RequestMethod. WebDAV verbs are
// passed through as their wire strings; the native HTTP stack accepts custom
// method strings even though the ArkTS enum does not enumerate them.
//
// Error mapping: timeout → HTTP_TRANSPORT_TIMEOUT, DNS → HTTP_TRANSPORT_DNS,
// TLS/SSL/certificate → HTTP_TRANSPORT_TLS, everything else → HTTP_TRANSPORT_CONNECT.
//
// finalUrl: HarmonyOS http module does not expose the post-redirect URL, so the
// original request URL is returned as finalUrl. Core falls back to this value.
import http from '@ohos.net.http';
import {
  HostHttpRequest,
  HostHttpResponse,
  HostHttpCancelResponse,
  HostCookieRecord,
  HostError,
  HostErrorWrapper,
  createTransportTimeoutError,
  createTransportDnsError,
  createTransportTlsError,
} from '../types';
import { SourceSessionHostStore } from './SourceSessionHostStore';
import { type SourceImageHeaderResolver } from './SourceImageCache';
import type { WebDavHttpExecutor } from './WebDavHostAdapter';
import { FileHostAdapter } from './FileHostAdapter';

export const MEDIA_DOWNLOAD_DEFAULT_MAX_BYTES: number = 512 * 1024 * 1024;

interface HttpErrorLike {
  code?: number;
  message?: string;
}

class PreparedRequestHeader {
  key: string;
  value: string;

  constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
}

/**
 * Narrow seam around @ohos.net.http so cancellation behavior can be verified
 * without performing a real network request in the host unit-test runner.
 */
interface DestroyableHostHttpClient {
  destroy(): void;
}

export interface HostHttpClient extends DestroyableHostHttpClient {
  request(url: string, options: http.HttpRequestOptions): Promise<http.HttpResponse>;
}

export interface HostHttpClientFactory {
  create(): HostHttpClient;
}

class PlatformHttpClientFactory implements HostHttpClientFactory {
  create(): HostHttpClient {
    return http.createHttp();
  }
}

export interface HostHttpStreamClient extends DestroyableHostHttpClient {
  onHeaders(callback: (headers: Object) => void): void;
  onData(callback: (chunk: ArrayBuffer) => void): void;
  onEnd(callback: () => void): void;
  request(url: string, options: http.HttpRequestOptions): Promise<number>;
}

export interface HostHttpStreamClientFactory {
  create(): HostHttpStreamClient;
}

class PlatformHostHttpStreamClient implements HostHttpStreamClient {
  private readonly client: http.HttpRequest = http.createHttp();

  onHeaders(callback: (headers: Object) => void): void {
    this.client.on('headersReceive', callback);
  }

  onData(callback: (chunk: ArrayBuffer) => void): void {
    this.client.on('dataReceive', callback);
  }

  onEnd(callback: () => void): void {
    this.client.on('dataEnd', callback);
  }

  request(url: string, options: http.HttpRequestOptions): Promise<number> {
    return this.client.requestInStream(url, options);
  }

  destroy(): void {
    this.client.destroy();
  }
}

class PlatformHostHttpStreamClientFactory implements HostHttpStreamClientFactory {
  create(): HostHttpStreamClient {
    return new PlatformHostHttpStreamClient();
  }
}

export interface HostBinaryFileResponse {
  response: HostHttpResponse;
  byteLength: number;
}

class ActiveHostHttpRequest {
  readonly client: DestroyableHostHttpClient;
  private destroyed: boolean = false;
  private cancelAction: (() => void) | null = null;

  constructor(client: DestroyableHostHttpClient) {
    this.client = client;
  }

  setCancelAction(action: () => void): void {
    this.cancelAction = action;
  }

  cancel(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.client.destroy();
    if (this.cancelAction !== null) this.cancelAction();
  }

  dispose(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.client.destroy();
  }
}

export class HttpHostAdapter implements SourceImageHeaderResolver, WebDavHttpExecutor {
  private readonly sessionStore: SourceSessionHostStore;
  private readonly httpClientFactory: HostHttpClientFactory;
  private readonly httpStreamClientFactory: HostHttpStreamClientFactory;
  private readonly activeRequests: Map<string, ActiveHostHttpRequest> = new Map<string, ActiveHostHttpRequest>();

  constructor(sessionStore: SourceSessionHostStore = SourceSessionHostStore.shared(),
    httpClientFactory: HostHttpClientFactory = new PlatformHttpClientFactory(),
    httpStreamClientFactory: HostHttpStreamClientFactory = new PlatformHostHttpStreamClientFactory()) {
    this.sessionStore = sessionStore;
    this.httpClientFactory = httpClientFactory;
    this.httpStreamClientFactory = httpStreamClientFactory;
  }

  /**
   * Execute one request on its own HarmonyOS HttpRequest instance.
   *
   * @param requestId Stable HostRequest id used by http.cancel. Core-originated
   * requests pass their numeric request id as a string; reducer-originated
   * requests pass the UI Contract HostRequest requestId. Requests without an id
   * still execute, but cannot later claim request-scoped cancellation support.
   */
  async execute(request: HostHttpRequest, requestId?: string): Promise<HostHttpResponse> {
    return this.executeWithTimeout(request, requestId, 15000);
  }

  /**
   * Stream a binary GET/HEAD response directly into FileHostAdapter's atomic
   * part transaction. The body is never materialized as a whole ArrayBuffer.
   */
  downloadToFile(request: HostHttpRequest, fileAdapter: FileHostAdapter, savePath: string,
    requestId?: string, maxBytes: number = MEDIA_DOWNLOAD_DEFAULT_MAX_BYTES,
    timeoutMillis: number = 15000): Promise<HostBinaryFileResponse> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return Promise.reject(new HostErrorWrapper({
        code: 'DOWNLOAD_FAILED',
        message: 'binary download supports only GET or HEAD',
        retryable: false,
        details: { phase: 'Transport', url: request.url },
      }));
    }
    if (!Number.isFinite(maxBytes) || maxBytes < 0 || Math.floor(maxBytes) !== maxBytes) {
      return Promise.reject(new HostErrorWrapper({
        code: 'DOWNLOAD_FAILED',
        message: 'binary download maxBytes must be a non-negative integer',
        retryable: false,
        details: { phase: 'Transport', url: request.url },
      }));
    }
    const timeout = Number.isFinite(timeoutMillis) && timeoutMillis > 0
      ? Math.floor(timeoutMillis)
      : 15000;
    const normalizedRequestId = requestId?.trim();
    if (normalizedRequestId !== undefined && normalizedRequestId.length > 0 &&
      this.activeRequests.has(normalizedRequestId)) {
      return Promise.reject(new HostErrorWrapper({
        code: 'HTTP_TRANSPORT_CONNECT',
        message: `duplicate active http requestId: ${normalizedRequestId}`,
        retryable: false,
        details: { phase: 'Transport', url: request.url },
      }));
    }

    const requestHeaders = this.buildRequestHeaders(request);
    const client = this.httpStreamClientFactory.create();
    const activeRequest = new ActiveHostHttpRequest(client);
    if (normalizedRequestId !== undefined && normalizedRequestId.length > 0) {
      this.activeRequests.set(normalizedRequestId, activeRequest);
    }

    return new Promise<HostBinaryFileResponse>((resolve: (value: HostBinaryFileResponse) => void,
      reject: (error: HostErrorWrapper) => void): void => {
      let settled = false;
      let status: number | null = null;
      let responseHeaders: Record<string, string | string[]> | null = null;
      let streamEnded = false;
      let partOpened = false;
      let bytesReceived = 0;
      let declaredLength: number | null = null;

      const unregister = (): void => {
        if (normalizedRequestId !== undefined && normalizedRequestId.length > 0 &&
          this.activeRequests.get(normalizedRequestId) === activeRequest) {
          this.activeRequests.delete(normalizedRequestId);
        }
      };
      const dispose = (): void => {
        unregister();
        activeRequest.dispose();
      };
      const fail = (error: HostErrorWrapper): void => {
        if (settled) return;
        settled = true;
        if (partOpened) fileAdapter.discardAtomicPart(savePath);
        dispose();
        reject(error);
      };
      const failUnexpected = (error: Error): void => {
        if (error instanceof HostErrorWrapper) {
          fail(error);
          return;
        }
        const hostError: HostError = {
          code: 'DOWNLOAD_FAILED',
          message: error.message,
          retryable: false,
          details: { phase: 'Storage', path: savePath },
        };
        fail(new HostErrorWrapper(hostError));
      };
      const succeed = (): void => {
        if (settled || status === null || responseHeaders === null || !streamEnded) return;
        if (status === 304) {
          if (partOpened) fileAdapter.discardAtomicPart(savePath);
          partOpened = false;
        } else if (status < 200 || status >= 300) {
          fail(new HostErrorWrapper({
            code: 'DOWNLOAD_FAILED',
            message: `binary download returned HTTP ${status}`,
            retryable: status >= 500,
            details: { phase: 'Transport', url: request.url, status: status },
          }));
          return;
        } else if (request.method === 'GET') {
          if (declaredLength !== null && bytesReceived !== declaredLength) {
            fail(new HostErrorWrapper({
              code: 'DOWNLOAD_FAILED',
              message: 'binary download ended before the declared content length',
              retryable: true,
              details: { phase: 'Transport', url: request.url },
            }));
            return;
          }
          try {
            fileAdapter.commitAtomicPart(savePath);
            partOpened = false;
          } catch (e) {
            failUnexpected(e instanceof Error ? e : new Error(String(e)));
            return;
          }
        }
        settled = true;
        dispose();
        const response: HostHttpResponse = {
          status: status,
          body: '',
          headers: responseHeaders,
          finalUrl: request.url,
          sessionId: request.sessionId,
        };
        resolve({ response: response, byteLength: bytesReceived });
      };

      activeRequest.setCancelAction((): void => {
        fail(new HostErrorWrapper({
          code: 'HTTP_TRANSPORT_CANCELED',
          message: 'binary download cancelled',
          retryable: true,
          details: { phase: 'Transport', url: request.url },
        }));
      });
      client.onHeaders((headersEvent: Object): void => {
        if (settled) return;
        responseHeaders = this.extractHeaders(headersEvent);
        this.captureResponseCookies(request, responseHeaders);
        declaredLength = this.parseContentLength(this.headerValue(responseHeaders, 'content-length'));
        if (declaredLength === -1 || (declaredLength !== null && declaredLength > maxBytes)) {
          fail(new HostErrorWrapper({
            code: 'DOWNLOAD_FAILED',
            message: 'binary download content length exceeds the admitted limit',
            retryable: false,
            details: { phase: 'Transport', url: request.url },
          }));
          return;
        }
        if (request.method === 'GET') {
          try {
            fileAdapter.openAtomicPart(savePath, true);
            partOpened = true;
          } catch (e) {
            failUnexpected(e instanceof Error ? e : new Error(String(e)));
            return;
          }
        }
        succeed();
      });
      client.onData((chunk: ArrayBuffer): void => {
        if (settled) return;
        if (responseHeaders === null || request.method !== 'GET' || !partOpened) {
          fail(new HostErrorWrapper({
            code: 'DOWNLOAD_FAILED',
            message: 'binary data arrived before an admitted response header',
            retryable: false,
            details: { phase: 'Transport', url: request.url },
          }));
          return;
        }
        const nextTotal = bytesReceived + chunk.byteLength;
        if (nextTotal > maxBytes) {
          fail(new HostErrorWrapper({
            code: 'DOWNLOAD_FAILED',
            message: 'binary download body exceeds the admitted limit',
            retryable: false,
            details: { phase: 'Transport', url: request.url },
          }));
          return;
        }
        try {
          fileAdapter.appendAtomicPart(savePath, chunk);
          bytesReceived = nextTotal;
        } catch (e) {
          failUnexpected(e instanceof Error ? e : new Error(String(e)));
        }
      });
      client.onEnd((): void => {
        if (settled) return;
        streamEnded = true;
        succeed();
      });

      const options: http.HttpRequestOptions = {
        method: this.mapMethod(request.method),
        header: requestHeaders,
        connectTimeout: timeout,
        readTimeout: timeout,
      };
      client.request(request.url, options).then((responseStatus: number): void => {
        if (settled) return;
        status = responseStatus;
        succeed();
      }).catch((e: Error): void => {
        const candidate = e as HttpErrorLike;
        fail(new HostErrorWrapper(this.mapError(
          candidate.code ?? 0,
          candidate.message ?? 'binary download failed',
          request.url,
        )));
      });
    });
  }

  private async executeWithTimeout(request: HostHttpRequest,
    requestId: string | undefined, timeoutMillis: number): Promise<HostHttpResponse> {
    const method = this.mapMethod(request.method);
    const requestHeaders = this.buildRequestHeaders(request);
    const options: http.HttpRequestOptions = {
      method: method,
      header: requestHeaders,
      expectDataType: http.HttpDataType.STRING,
      // Default timeouts: 15s connect + 15s read. Prevents indefinite hangs
      // when a source is unreachable (e.g. yodu.org behind GFW). Callers that
      // need longer can override via request.timeoutMs if the contract grows.
      connectTimeout: timeoutMillis,
      readTimeout: timeoutMillis,
    };
    if (request.body !== undefined) {
      options.extraData = request.body;
    }

    const normalizedRequestId = requestId?.trim();
    if (normalizedRequestId !== undefined && normalizedRequestId.length > 0 &&
      this.activeRequests.has(normalizedRequestId)) {
      const duplicateError: HostError = {
        code: 'HTTP_TRANSPORT_CONNECT',
        message: `duplicate active http requestId: ${normalizedRequestId}`,
        retryable: false,
        details: { phase: 'Transport', url: request.url },
      };
      throw new HostErrorWrapper(duplicateError);
    }

    // @ohos.net.http exposes destroy() on an HttpRequest object, not a
    // cancel(requestId) API. Giving every execution its own client turns that
    // primitive into honest request-scoped cancellation and prevents one
    // cancellation from aborting unrelated requests.
    const httpClient = this.httpClientFactory.create();
    const activeRequest = new ActiveHostHttpRequest(httpClient);
    if (normalizedRequestId !== undefined && normalizedRequestId.length > 0) {
      this.activeRequests.set(normalizedRequestId, activeRequest);
    }

    try {
      const response = await httpClient.request(request.url, options);
      const headers = this.extractHeaders(response.header);
      this.captureResponseCookies(request, headers);
      let body = '';
      if (typeof response.result === 'string') {
        body = response.result;
      } else if (response.result !== null && response.result !== undefined) {
        body = String(response.result);
      }
      const httpResp: HostHttpResponse = {
        status: response.responseCode,
        body: body,
        headers: headers,
        finalUrl: request.url,
        sessionId: request.sessionId,
      };
      return httpResp;
    } catch (e) {
      const err = e as HttpErrorLike;
      const code = err.code ?? 0;
      const message = err.message ?? 'http request failed';
      throw new HostErrorWrapper(this.mapError(code, message, request.url));
    } finally {
      if (normalizedRequestId !== undefined && normalizedRequestId.length > 0) {
        const registeredRequest = this.activeRequests.get(normalizedRequestId);
        if (registeredRequest === activeRequest) {
          this.activeRequests.delete(normalizedRequestId);
        }
      }
      activeRequest.dispose();
    }
  }

  destroy(): void {
    this.activeRequests.forEach((request: ActiveHostHttpRequest) => {
      request.cancel();
    });
    this.activeRequests.clear();
  }

  /**
   * http.cancel — cancel an in-flight HTTP request by requestId.
   * Returns false for a blank, unknown, or already-completed request. It never
   * reports success merely because a shared client was destroyed.
   */
  cancel(requestId: string): HostHttpCancelResponse {
    const normalizedRequestId = requestId.trim();
    if (normalizedRequestId.length === 0) {
      const result: HostHttpCancelResponse = { cancelled: false };
      return result;
    }
    const activeRequest = this.activeRequests.get(normalizedRequestId);
    if (activeRequest === undefined) {
      const result: HostHttpCancelResponse = { cancelled: false };
      return result;
    }
    // Delete before destroy so a re-entrant error/completion cannot be mistaken
    // for a second active request with the same id.
    this.activeRequests.delete(normalizedRequestId);
    activeRequest.cancel();
    const result: HostHttpCancelResponse = { cancelled: true };
    return result;
  }

  // ── internal ──

  private mapMethod(method: string): http.RequestMethod {
    switch (method) {
      case 'GET':
        return http.RequestMethod.GET;
      case 'POST':
        return http.RequestMethod.POST;
      case 'PUT':
        return http.RequestMethod.PUT;
      case 'DELETE':
        return http.RequestMethod.DELETE;
      case 'HEAD':
        return http.RequestMethod.HEAD;
      case 'OPTIONS':
        return http.RequestMethod.OPTIONS;
      case 'PATCH':
        // HarmonyOS http module does not support PATCH — fall back to POST.
        return http.RequestMethod.POST;
      case 'PROPFIND':
      case 'MKCOL':
      case 'MOVE':
      case 'COPY':
        return method as Object as http.RequestMethod;
      default:
        return http.RequestMethod.GET;
    }
  }

  /**
   * Build the final Host-owned request headers for both text http.execute and
   * the binary SourceImageCache path.  Header names are case-insensitive by
   * HTTP definition: descriptor headers override equal login headers without
   * leaving a duplicate `Cookie`/`cookie` pair on the wire.  Cookie values are
   * merged by name so a Core static source cookie, login state, and platform
   * session jar can coexist without exposing any of them to UI code.
  */
  buildRequestHeaders(request: HostHttpRequest): Record<string, string> {
    const normalizedHeaders: Map<string, PreparedRequestHeader> = new Map<string, PreparedRequestHeader>();
    if (request.sourceId !== undefined && request.sourceId.length > 0) {
      const loginState = this.sessionStore.getLoginHeaderMap(request.sourceId, request.sessionId);
      const loginKeys = Object.keys(loginState.headers);
      for (let i = 0; i < loginKeys.length; i++) {
        const key = loginKeys[i];
        this.mergeRequestHeader(normalizedHeaders, key, loginState.headers[key], true);
      }
    }

    const requestKeys = Object.keys(request.headers);
    for (let i = 0; i < requestKeys.length; i++) {
      const key = requestKeys[i];
      // The Core descriptor is authoritative for source-level Referer / UA /
      // static Cookie headers. It may intentionally override a generic login
      // header, while cookie pairs are merged by name below.
      this.mergeRequestHeader(normalizedHeaders, key, request.headers[key], true);
    }

    if (request.usePlatformCookieJar === true) {
      const cookieHeader = this.sessionStore.buildCookieHeader(request.url, request.sessionId);
      if (cookieHeader.length > 0) {
        // The in-memory source session jar fills cookie names that Core's
        // static source header did not already supply. This preserves auth
        // established by prior http.execute calls without duplicating keys.
        this.mergeRequestHeader(normalizedHeaders, 'Cookie', cookieHeader, false);
      }
    }
    const headers: Record<string, string> = {};
    normalizedHeaders.forEach((header: PreparedRequestHeader): void => {
      headers[header.key] = header.value;
    });
    return headers;
  }

  private extractHeaders(rawHeader: Object): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    if (rawHeader === null || rawHeader === undefined) {
      return headers;
    }
    const headerRecord = rawHeader as Record<string, string | string[]>;
    const keys = Object.keys(headerRecord);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = headerRecord[key];
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (value instanceof Array) {
        const arr: string[] = [];
        for (let j = 0; j < value.length; j++) {
          arr.push(String(value[j]));
        }
        headers[key] = arr;
      } else {
        headers[key] = String(value);
      }
    }
    return headers;
  }

  private headerValue(headers: Record<string, string | string[]>, name: string): string {
    const keys = Object.keys(headers);
    const normalizedName = name.toLowerCase().replace(/[-_]/g, '');
    for (let index = 0; index < keys.length; index++) {
      if (keys[index].toLowerCase().replace(/[-_]/g, '') !== normalizedName) continue;
      const value = headers[keys[index]];
      return value instanceof Array ? (value[0] ?? '') : value;
    }
    return '';
  }

  private parseContentLength(value: string): number | null {
    const normalized = value.trim();
    if (normalized.length === 0) return null;
    if (!/^[0-9]+$/.test(normalized)) return -1;
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) ? parsed : -1;
  }

  private captureResponseCookies(request: HostHttpRequest, headers: Record<string, string | string[]>): void {
    const setCookieValues = this.headerValues(headers, 'set-cookie');
    if (setCookieValues.length === 0) {
      return;
    }
    const fallbackDomain = this.resolveDomain(request.url);
    for (let i = 0; i < setCookieValues.length; i++) {
      const parsed = this.parseSetCookie(setCookieValues[i], fallbackDomain);
      if (parsed !== null) {
        this.sessionStore.setCookie(parsed, request.sessionId);
      }
    }
  }

  private parseSetCookie(raw: string, fallbackDomain: string | undefined): HostCookieRecord | null {
    const segments = raw.split(';');
    if (segments.length === 0) {
      return null;
    }
    const first = segments[0].trim();
    const eq = first.indexOf('=');
    if (eq <= 0) {
      return null;
    }
    const cookie: HostCookieRecord = {
      name: first.substring(0, eq).trim(),
      value: first.substring(eq + 1).trim(),
    };
    if (fallbackDomain !== undefined) {
      cookie.domain = fallbackDomain;
    }
    for (let i = 1; i < segments.length; i++) {
      const part = segments[i].trim();
      const partEq = part.indexOf('=');
      const attrName = (partEq >= 0 ? part.substring(0, partEq) : part).trim().toLowerCase();
      const attrValue = partEq >= 0 ? part.substring(partEq + 1).trim() : '';
      if (attrName === 'domain' && attrValue.length > 0) {
        cookie.domain = attrValue;
      } else if (attrName === 'path' && attrValue.length > 0) {
        cookie.path = attrValue;
      } else if (attrName === 'expires' && attrValue.length > 0) {
        const expires = Date.parse(attrValue);
        if (!Number.isNaN(expires)) {
          cookie.expires = expires;
        }
      } else if (attrName === 'secure') {
        cookie.secure = true;
      } else if (attrName === 'httponly') {
        cookie.httpOnly = true;
      }
    }
    return cookie;
  }

  private headerValues(headers: Record<string, string | string[]>, needle: string): string[] {
    const values: string[] = [];
    const keys = Object.keys(headers);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key.toLowerCase() !== needle) {
        continue;
      }
      const value = headers[key];
      if (typeof value === 'string') {
        values.push(value);
      } else {
        for (let j = 0; j < value.length; j++) {
          values.push(value[j]);
        }
      }
    }
    return values;
  }

  private mergeRequestHeader(headers: Map<string, PreparedRequestHeader>, key: string, value: string,
    incomingWins: boolean): void {
    const normalized = key.toLowerCase();
    const existing = headers.get(normalized);
    if (normalized === 'cookie') {
      const merged = this.mergeCookieHeader(existing === undefined ? '' : existing.value, value, incomingWins);
      headers.set(normalized, new PreparedRequestHeader(key, merged));
      return;
    }
    headers.set(normalized, new PreparedRequestHeader(key, value));
  }

  private mergeCookieHeader(existing: string, incoming: string, incomingWins: boolean): string {
    const pairs: Map<string, string> = new Map<string, string>();
    const order: string[] = [];
    const add = (raw: string, overwrite: boolean): void => {
      const segments = raw.split(';');
      for (let index = 0; index < segments.length; index++) {
        const pair = segments[index].trim();
        const equals = pair.indexOf('=');
        if (equals <= 0) continue;
        const name = pair.substring(0, equals).trim();
        const value = pair.substring(equals + 1).trim();
        if (name.length === 0) continue;
        const normalized = name.toLowerCase();
        if (!pairs.has(normalized)) {
          order.push(normalized);
          pairs.set(normalized, `${name}=${value}`);
        } else if (overwrite) {
          pairs.set(normalized, `${name}=${value}`);
        }
      }
    };
    add(existing, true);
    add(incoming, incomingWins);
    const output: string[] = [];
    for (let index = 0; index < order.length; index++) {
      const pair = pairs.get(order[index]);
      if (pair !== undefined) output.push(pair);
    }
    return output.join('; ');
  }

  private resolveDomain(url: string): string | undefined {
    const match = url.match(/^https?:\/\/([^/:]+)(?::\d+)?(?:\/|$)/);
    if (match !== null && match.length >= 2) {
      return match[1];
    }
    return undefined;
  }

  private mapError(code: number, message: string, url: string): HostError {
    const msg = message.toLowerCase();
    // HarmonyOS http error codes (subset):
    //   2300003 — timed out
    //   2300005 — unknown host / DNS resolution failed
    //   2300023 / 2300025 — TLS handshake / SSL errors
    if (code === 2300003 || msg.includes('timeout') || msg.includes('timed out')) {
      return createTransportTimeoutError(url, 'read');
    }
    if (code === 2300005 || msg.includes('dns') || msg.includes('resolve') || msg.includes('unknown host')) {
      return createTransportDnsError(url);
    }
    if (msg.includes('ssl') || msg.includes('tls') || msg.includes('certificate') || msg.includes('handshake')) {
      return createTransportTlsError(url, message);
    }
    const connectError: HostError = {
      code: 'HTTP_TRANSPORT_CONNECT',
      message: message,
      retryable: true,
      details: { phase: 'Transport', url: url },
    };
    return connectError;
  }
}

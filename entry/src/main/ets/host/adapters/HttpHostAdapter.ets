// HttpHostAdapter — HarmonyOS @ohos.net.http backed Host adapter for http.execute.
// Source of truth: Reader-Core-Native docs/host-app-contracts/01-network-session.md §3.1/§3.2.
// Phase 4 implementation; consumed by HostDispatcher / CapabilityRouter.
//
// Method mapping: GET/POST/PUT/DELETE/HEAD/OPTIONS map directly to http.RequestMethod.
// PATCH is not supported by HarmonyOS http module — it is sent as POST (caller may
// include X-HTTP-Method-Override header if the server requires the original verb).
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
  HostCookieRecord,
  HostError,
  HostErrorWrapper,
  createTransportTimeoutError,
  createTransportDnsError,
  createTransportTlsError,
} from '../types';
import { SourceSessionHostStore } from './SourceSessionHostStore';

interface HttpErrorLike {
  code?: number;
  message?: string;
}

export class HttpHostAdapter {
  private httpClient: http.HttpRequest;
  private readonly sessionStore: SourceSessionHostStore;

  constructor(sessionStore: SourceSessionHostStore = SourceSessionHostStore.shared()) {
    this.httpClient = http.createHttp();
    this.sessionStore = sessionStore;
  }

  async execute(request: HostHttpRequest): Promise<HostHttpResponse> {
    const method = this.mapMethod(request.method);
    const requestHeaders = this.buildRequestHeaders(request);
    const options: http.HttpRequestOptions = {
      method: method,
      header: requestHeaders,
      expectDataType: http.HttpDataType.STRING,
      // Default timeouts: 15s connect + 15s read. Prevents indefinite hangs
      // when a source is unreachable (e.g. yodu.org behind GFW). Callers that
      // need longer can override via request.timeoutMs if the contract grows.
      connectTimeout: 15000,
      readTimeout: 15000,
    };
    if (request.body !== undefined) {
      options.extraData = request.body;
    }

    try {
      const response = await this.httpClient.request(request.url, options);
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
    }
  }

  destroy(): void {
    this.httpClient.destroy();
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
      default:
        return http.RequestMethod.GET;
    }
  }

  private buildRequestHeaders(request: HostHttpRequest): Record<string, string> {
    const headers: Record<string, string> = {};
    if (request.sourceId !== undefined && request.sourceId.length > 0) {
      const loginState = this.sessionStore.getLoginHeaderMap(request.sourceId, request.sessionId);
      const loginKeys = Object.keys(loginState.headers);
      for (let i = 0; i < loginKeys.length; i++) {
        const key = loginKeys[i];
        headers[key] = loginState.headers[key];
      }
    }

    const requestKeys = Object.keys(request.headers);
    for (let i = 0; i < requestKeys.length; i++) {
      const key = requestKeys[i];
      headers[key] = request.headers[key];
    }

    if (request.usePlatformCookieJar === true && !this.hasHeader(headers, 'cookie')) {
      const cookieHeader = this.sessionStore.buildCookieHeader(request.url, request.sessionId);
      if (cookieHeader.length > 0) {
        headers['Cookie'] = cookieHeader;
      }
    }
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

  private hasHeader(headers: Record<string, string>, needle: string): boolean {
    const keys = Object.keys(headers);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === needle) {
        return true;
      }
    }
    return false;
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

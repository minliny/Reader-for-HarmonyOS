// OHOSHTTPHostTransport — implements HostTransport using @ohos.net.http.
//
// Mirrors Android bindings/android/.../ReaderCoreHostTransport.java (OkHttp-based)
// and the existing HarmonyOS HTTPAdapter.ets (@ohos.net.http usage). Executes
// Core's HostHttpRequest (url/method/headers/body/timeoutMs) and returns a
// HostHttpResponse (status/headers/body/finalUrl/charsetHint/cookies) that
// Core's host.complete expects.
//
// Per charter §4 / §10.2: Host owns real HTTP/TLS — Core only produces request
// descriptors, never opens sockets. OHOSHTTPHostTransport is the only HTTP
// execution path in the HarmonyOS host layer. The legacy BridgeHTTPClient /
// HTTPAdapter are marked @deprecated in the strangler pattern (Task 6).
//
// finalUrl limitation (Plan C): @ohos.net.http HttpRequestOptions does NOT
// expose a `followRedirects` switch (verified against API V2/V5 docs — only
// method/extraData/expectDataType/usingCache/priority/header/readTimeout/
// connectTimeout/usingProtocol/usingProxy/caPath/clientCert/certificatePinning/
// multiFormDataList are supported). The underlying stack follows redirects
// automatically (error 2300047 fires when the redirect cap is hit) and does
// NOT surface the post-redirect URL on HttpResponse. on('headersReceive')
// fires per response in the redirect chain but does not carry the final URL
// either. Until the platform exposes the resolved URL, finalUrl stays at
// request.url. The login_cookie proof (HostLoginCookieProof.ets) uses a stub
// transport that simulates 302→200 so handler-level finalUrl plumbing is
// still verified end-to-end without depending on this platform gap.

import { http } from '@kit.NetworkKit';
import { HostTransport } from './HostTransport';
import { HostHttpRequest, HostHttpResponse } from './HttpRequest';

export class OHOSHTTPHostTransport implements HostTransport {
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  async execute(request: HostHttpRequest): Promise<HostHttpResponse> {
    const client = http.createHttp();
    try {
      const method = request.method.toUpperCase();
      const fallbackHeaders: Record<string, string> = {};
      const header: Record<string, string> = request.headers ?? fallbackHeaders;
      const options: http.HttpRequestOptions = {
        method: this.mapMethod(method),
        header: header,
        extraData: request.body,
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: request.timeoutMs ?? this.defaultTimeout,
        readTimeout: request.timeoutMs ?? this.defaultTimeout
      };
      const resp = await client.request(request.url, options);
      const headers = this.parseHeaders(resp.header);
      const charsetHint = this.extractCharset(headers);
      // finalUrl: Plan C — @ohos.net.http does not expose the post-redirect URL.
      // See file header for the full rationale; proof tests use a stub transport.
      return {
        status: resp.responseCode,
        headers: headers,
        body: this.normalizeResult(resp.result),
        finalUrl: request.url,
        charsetHint: charsetHint
      } as HostHttpResponse;
    } finally {
      client.destroy();
    }
  }

  private mapMethod(method: string): http.RequestMethod {
    switch (method) {
      case 'GET': return http.RequestMethod.GET;
      case 'POST': return http.RequestMethod.POST;
      case 'PUT': return http.RequestMethod.PUT;
      case 'DELETE': return http.RequestMethod.DELETE;
      case 'HEAD': return http.RequestMethod.HEAD;
      case 'OPTIONS': return http.RequestMethod.OPTIONS;
      default: return http.RequestMethod.GET;
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

  private normalizeResult(result: string | Object | ArrayBuffer): string {
    if (typeof result === 'string') { return result; }
    if (result instanceof ArrayBuffer) {
      return String.fromCharCode(...new Uint8Array(result));
    }
    if (result === undefined || result === null) { return ''; }
    return JSON.stringify(result);
  }

  private extractCharset(headers: Record<string, string>): string {
    const ct = headers['Content-Type'] ?? headers['content-type'] ?? '';
    const lower = ct.toLowerCase();
    const idx = lower.indexOf('charset=');
    if (idx === -1) { return ''; }
    const rest = ct.substring(idx + 8);
    const semi = rest.indexOf(';');
    const raw = semi === -1 ? rest : rest.substring(0, semi);
    return raw.trim();
  }
}

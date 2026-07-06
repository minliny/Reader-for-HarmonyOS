// OHOSHTTPHostTransport — implements HostTransport using @ohos.net.http.
//
// Mirrors Android bindings/android/.../ReaderCoreHostTransport.java (OkHttp-based)
// and the existing HarmonyOS HTTPAdapter.ets (@ohos.net.http usage). Executes
// Core's HostHttpRequest (url/method/headers/body/timeoutMs) and returns a
// HostHttpResponse (status/headers/body/finalUrl/charsetHint/cookies/redirects)
// that Core's host.complete expects.
//
// Per charter §4 / §10.2: Host owns real HTTP/TLS — Core only produces request
// descriptors, never opens sockets. OHOSHTTPHostTransport is the only HTTP
// execution path in the HarmonyOS host layer. The legacy BridgeHTTPClient /
// HTTPAdapter are marked @deprecated in the strangler pattern (Task 6).
//
// ----------------------------------------------------------------------------
// finalUrl strategy — Approach A hybrid (auto-follow + on('headersReceive')
// observation). Replaces the previous "Plan C" workaround that hardcoded
// finalUrl = request.url.
//
// Background: @ohos.net.http HttpRequestOptions does NOT expose a
// `followRedirects` switch (verified against API V2/V5 docs — only
// method/extraData/expectDataType/usingCache/priority/header/readTimeout/
// connectTimeout/usingProtocol/usingProxy/caPath/clientCert/certificatePinning/
// multiFormDataList are supported). The underlying stack follows redirects
// automatically. Crucially, `on('headersReceive', (header: Object) => ...)`
// fires for EACH response in the redirect chain (3xx hops included) and the
// header object DOES carry `Location` and `Set-Cookie` for those hops. The
// final 2xx response's URL, however, is still NOT surfaced on HttpResponse.
//
// Approach A hybrid:
//   1. Create a RedirectChainCollector seeded with request.url.
//   2. Register `httpReq.on('headersReceive', ...)` BEFORE calling
//      `client.request()`. The handler feeds each header object to the
//      collector, which records a hop whenever `Location` is present.
//   3. After `request()` resolves:
//      - If the collector captured redirects: finalUrl = collector.getFinalUrl()
//        (the last captured Location target), and `redirects` is populated.
//      - If no redirects were captured: fall back to finalUrl = request.url
//        (the pre-fix behavior — safe default when on('headersReceive') does
//        not fire or does not surface Location for some reason).
//   4. Intermediate Set-Cookie values captured at redirect hops are merged
//      into the response headers under `Set-Cookie` so the existing
//      extractCookies pipeline can parse them.
//   5. Error 2300047 (platform redirect cap hit): if the collector captured
//      partial hops, finalUrl is the last captured Location; if no hops were
//      captured, finalUrl is `undefined` (signal degradation — callers must
//      NOT assume request.url is correct in this state).
//
// Known platform limitations (documented for beta):
//   - `follow_redirects=false` CANNOT be honored on HarmonyOS — the platform
//     auto-follows redirects with no opt-out. The transport reads the flag
//     for observability (logs) but cannot disable auto-follow.
//   - Real device verification of on('headersReceive') firing semantics
//     (ordering, header key casing, whether 3xx responses are surfaced before
//     the final 2xx) is deferred to beta. The headless proof
//     (HostFinalUrlProof.ets) verifies the reconstruction logic with stubbed
//     header objects; device-tier RustCoreEndToEndValidator exercises the real
//     transport.

import { http } from '@kit.NetworkKit';
import { HostTransport } from './HostTransport';
import { HostHttpRequest, HostHttpResponse } from './HttpRequest';
import { RedirectChainCollector, RedirectHop } from './RedirectChainCollector';

export class OHOSHTTPHostTransport implements HostTransport {
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  async execute(request: HostHttpRequest): Promise<HostHttpResponse> {
    // Observe (do not enforce) follow_redirects / max_redirects hints. The
    // platform auto-follows and exposes no opt-out; logging only.
    if (request.follow_redirects === false) {
      console.warn(
        '[OHOSHTTPHostTransport] follow_redirects=false requested but cannot be honored on HarmonyOS ' +
        '(platform auto-follows). url=' + request.url
      );
    }
    if (request.max_redirects !== undefined) {
      console.info(
        '[OHOSHTTPHostTransport] max_redirects=' + request.max_redirects +
        ' hint received; platform redirect cap is not configurable. url=' + request.url
      );
    }

    const client = http.createHttp();
    const collector = new RedirectChainCollector(request.url);
    // Register the headersReceive listener BEFORE calling request() — events
    // fire during request() execution and would be missed if registered after.
    // The collector is a pure utility and does no platform I/O here.
    client.on('headersReceive', (header: Object) => {
      collector.onHeadersReceived(header as Record<string, string>);
    });

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
      let resp: http.HttpResponse;
      try {
        resp = await client.request(request.url, options);
      } catch (e) {
        // Error 2300047 = platform redirect cap hit. The request never
        // produced a final 2xx response. If the collector captured partial
        // hops, the last Location is the best finalUrl estimate; otherwise
        // signal degradation with undefined.
        const errStr = String(e);
        if (errStr.indexOf('2300047') !== -1) {
          if (collector.hasRedirects()) {
            const partialFinalUrl = collector.getFinalUrl();
            const partialRedirects = collector.getRedirects();
            const partialHeaders = this.mergeIntermediateCookies(
              {} as Record<string, string>,
              collector.getIntermediateSetCookies()
            );
            return {
              status: 0,
              headers: partialHeaders,
              body: '',
              finalUrl: partialFinalUrl,
              charsetHint: '',
              redirects: partialRedirects
            } as HostHttpResponse;
          }
          // No Location captured and redirect cap hit — finalUrl is unknown.
          return {
            status: 0,
            headers: {} as Record<string, string>,
            body: '',
            finalUrl: undefined,
            charsetHint: '',
            redirects: []
          } as HostHttpResponse;
        }
        // Other errors propagate. Wrap in Error to satisfy arkts-limited-throw
        // (SDK 6.0 strict mode requires throw operands to be Error subclasses).
        throw e instanceof Error ? e : new Error(String(e));
      }
      const headers = this.parseHeaders(resp.header);
      const charsetHint = this.extractCharset(headers);
      // Merge intermediate Set-Cookie values (captured at redirect hops) into
      // the final response headers so the existing extractCookies pipeline
      // can parse them alongside the final response's Set-Cookie.
      const mergedHeaders = this.mergeIntermediateCookies(
        headers,
        collector.getIntermediateSetCookies()
      );
      // Derive finalUrl + redirects from the collector. When no Location was
      // captured, fall back to request.url (pre-fix behavior — safe default).
      let finalUrl: string | undefined;
      let redirects: RedirectHop[] | undefined;
      if (collector.hasRedirects()) {
        finalUrl = collector.getFinalUrl();
        redirects = collector.getRedirects();
      } else {
        finalUrl = request.url;
        redirects = undefined;
      }
      return {
        status: resp.responseCode,
        headers: mergedHeaders,
        body: this.normalizeResult(resp.result),
        finalUrl: finalUrl,
        charsetHint: charsetHint,
        redirects: redirects
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

  // Merge Set-Cookie values captured at intermediate redirect hops into the
  // final response headers. If the final response also carries Set-Cookie,
  // the values are joined with ', ' (mirrors parseHeaders' multi-value join
  // and lets extractCookies split them back into individual cookies).
  private mergeIntermediateCookies(
    headers: Record<string, string>,
    intermediate: string[]
  ): Record<string, string> {
    if (intermediate.length === 0) {
      return headers;
    }
    const existing = this.extractSetCookie(headers);
    const merged = existing.length > 0
      ? existing + ', ' + intermediate.join(', ')
      : intermediate.join(', ');
    // Find the existing Set-Cookie key (case-insensitive) or insert a new one.
    const keys = Object.keys(headers);
    let found = false;
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === 'set-cookie') {
        headers[keys[i]] = merged;
        found = true;
        break;
      }
    }
    if (!found) {
      headers['Set-Cookie'] = merged;
    }
    return headers;
  }

  private extractSetCookie(headers: Record<string, string>): string {
    const keys = Object.keys(headers);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === 'set-cookie') {
        return headers[keys[i]];
      }
    }
    return '';
  }
}

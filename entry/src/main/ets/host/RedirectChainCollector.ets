// RedirectChainCollector — pure utility that reconstructs the redirect chain
// from on('headersReceive') events emitted by @ohos.net.http.
//
// Background: @ohos.net.http HttpRequestOptions does NOT expose a
// `followRedirects` switch and does NOT surface the post-redirect URL on
// HttpResponse. The platform auto-follows redirects, but it DOES fire
// `on('headersReceive', (header: Object) => ...)` for each response in the
// redirect chain (including 3xx hops that carry a `Location` header).
//
// Approach A hybrid: register `on('headersReceive')` BEFORE calling
// `client.request()`. For each event, inspect the header object for a
// `Location` field (case-insensitive). If present, record a `RedirectHop`
// from the current URL to the resolved Location target, then advance
// `currentUrl` to that target. Also capture `Set-Cookie` values present at
// redirect hops (intermediate cookies the platform would otherwise swallow
// when auto-following).
//
// Pure utility contract: this class has NO `@ohos.net.http` import and NO
// platform API dependency. It can be unit-tested in headless mode by feeding
// it canned `Record<string, string>` header objects — that is exactly what
// HostFinalUrlProof.ets does for cases 1-5.
//
// URL resolution rules (resolveUrl):
//   - `http://` / `https://` prefix     -> absolute, returned as-is
//   - `/` prefix (root-relative)        -> protocol + host of currentUrl
//   - `./` prefix or no leading slash   -> resolved against currentUrl's
//                                         directory (path component up to
//                                         and including the last `/`)
//
// Limitations (deferred to real-device beta verification):
//   - on('headersReceive') is documented to fire per response in the redirect
//     chain, but the exact firing semantics (ordering, header key casing,
//     whether 3xx responses are surfaced before the final 2xx) have not been
//     verified on a real HarmonyOS device. The collector degrades safely:
//     if no Location header is observed, getFinalUrl() returns the initial
//     URL (callers fall back to request.url), preserving current behavior.

export interface RedirectHop {
  status: number;       // assumed 302 when Location is present (on('headersReceive') may not surface the status code)
  fromUrl: string;
  toUrl: string;
  headers?: Record<string, string>;
}

export class RedirectChainCollector {
  private hops: RedirectHop[] = [];
  private currentUrl: string;
  private setCookieValues: string[] = [];

  constructor(initialUrl: string) {
    this.currentUrl = initialUrl;
  }

  // Called from on('headersReceive') handler. If a Location header is present,
  // records a redirect hop from currentUrl to the resolved Location target and
  // advances currentUrl. Also captures Set-Cookie values present at the hop.
  //
  // No-op when no Location header is present (final 2xx response or a non-3xx
  // response): preserves safe fallback behavior.
  onHeadersReceived(headers: Record<string, string>): void {
    if (headers === null || headers === undefined) {
      return;
    }
    const location = this.extractHeader(headers, 'location');
    if (location === undefined || location.length === 0) {
      // Not a redirect hop — no state change.
      return;
    }
    const toUrl = this.resolveUrl(location);
    const setCookie = this.extractHeader(headers, 'set-cookie');
    if (setCookie !== undefined && setCookie.length > 0) {
      this.setCookieValues.push(setCookie);
    }
    const hop: RedirectHop = {
      status: 302,
      fromUrl: this.currentUrl,
      toUrl: toUrl,
      headers: headers
    };
    this.hops.push(hop);
    this.currentUrl = toUrl;
  }

  // Resolve a Location header value against currentUrl.
  // See file header for the resolution rules.
  private resolveUrl(location: string): string {
    if (location.startsWith('http://') || location.startsWith('https://')) {
      return location;
    }
    const protocolEnd = this.currentUrl.indexOf('://');
    if (protocolEnd === -1) {
      // currentUrl is not absolute — cannot resolve reliably. Return location
      // unchanged so the caller can observe the raw value.
      return location;
    }
    const protocol = this.currentUrl.substring(0, protocolEnd);
    const rest = this.currentUrl.substring(protocolEnd + 3); // strip "://"
    let host: string;
    let path: string;
    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) {
      host = rest;
      path = '';
    } else {
      host = rest.substring(0, slashIdx);
      path = rest.substring(slashIdx); // includes leading '/'
    }
    if (location.startsWith('/')) {
      // Root-relative
      return `${protocol}://${host}${location}`;
    }
    // Relative path — resolve against currentUrl's directory.
    // Strip query and fragment from path.
    let pathOnly = path;
    const queryIdx = pathOnly.indexOf('?');
    if (queryIdx !== -1) {
      pathOnly = pathOnly.substring(0, queryIdx);
    }
    const fragIdx = pathOnly.indexOf('#');
    if (fragIdx !== -1) {
      pathOnly = pathOnly.substring(0, fragIdx);
    }
    const lastSlash = pathOnly.lastIndexOf('/');
    let dir: string;
    if (lastSlash === -1) {
      dir = '/';
    } else {
      dir = pathOnly.substring(0, lastSlash + 1); // includes trailing '/'
    }
    let locPath = location;
    if (locPath.startsWith('./')) {
      locPath = locPath.substring(2);
    }
    return `${protocol}://${host}${dir}${locPath}`;
  }

  // Extract a header value case-insensitively. Returns undefined when absent.
  private extractHeader(headers: Record<string, string>, name: string): string | undefined {
    const keys = Object.keys(headers);
    const target = name.toLowerCase();
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k.toLowerCase() === target) {
        const v = headers[k];
        if (v === undefined || v === null) {
          return undefined;
        }
        return String(v);
      }
    }
    return undefined;
  }

  // Get the final URL — the last redirect target, or the initial URL when no
  // redirects were captured. Callers should treat the initial-URL fallback as
  // "no redirect observed" (equivalent to the pre-fix behavior).
  getFinalUrl(): string {
    return this.currentUrl;
  }

  // Whether any redirect hops were captured.
  hasRedirects(): boolean {
    return this.hops.length > 0;
  }

  // The redirect chain (may be empty).
  getRedirects(): RedirectHop[] {
    return this.hops;
  }

  // Set-Cookie values captured at intermediate redirect hops. The final
  // response's Set-Cookie (if any) is handled by the transport's header
  // parsing, NOT by this collector.
  getIntermediateSetCookies(): string[] {
    return this.setCookieValues;
  }
}

// HostHttpCookieRealNetworkProof — headless proof for the http.execute + cookie
// lanes with REAL production handlers (Phase 2).
//
// Tier: REAL EXECUTOR. Unlike HostLoginCookieProof (which uses StubHostTransport
// for handler-layer plumbing) and HostRouterDispatchProof (which uses .invalid
// TLD to avoid real network), this proof exercises the production
// OHOSHTTPHostTransport that makes real HTTP requests via @ohos.net.http, plus
// the production InMemoryCookieStore-backed cookie.get/cookie.set handlers.
//
// This is the proof that the http.execute lane executes REAL network I/O on a
// physical HarmonyOS device — not a stub, not a synthetic-param test. The
// transport is wired in the ReaderCoreClient constructor
// (new OHOSHTTPHostTransport() → makeHttpExecuteHandler(transport)). Dispatching
// http.execute through the HostAdapter reaches the real transport + real
// @ohos.net.http client. The cookie.get/cookie.set handlers use the same
// production InMemoryCookieStore wired in the constructor.
//
// Test cases:
//   1. init                — ReaderCoreClient initialized (NAPI + handlers)
//   2. http.success        — real URL returns 2xx status + non-empty body + finalUrl
//   3. http.body           — body is non-empty string
//   4. http.finalUrl       — finalUrl is non-empty string
//   5. http.headers        — response headers include Content-Type
//   6. http.error          — .invalid URL returns structured error (not throw)
//   7. http.errorCode      — error reply has non-empty code + message
//   8. cookie.set          — cookie.set for real domain returns stored=true
//   9. cookie.get          — cookie.get for same URL returns the cookie
//  10. cookie.match        — returned cookie matches name/value/domain
//
// canEnterMainline remains false — this is executor layer proof, not App-level.
// Real network I/O targets stable public URLs (w3.org); .invalid TLD is used
// for the error case to ensure DNS resolution failure without hitting any real
// server. Cookie round-trip uses the production InMemoryCookieStore (host-owned
// cookie jar — Core never touches the platform cookie store directly, charter §4).

import { ReaderCoreClient } from '../api/ReaderCoreClient';
import { HostAdapter } from '../host/HostAdapter';
import { HostReply } from '../host/HostReply';

interface TestResult { name: string; passed: boolean; error?: string; }

class TestRunner {
  results: TestResult[] = [];
  passed: number = 0;
  failed: number = 0;
  assert(c: boolean, n: string, e?: string): void {
    this.results.push({ name: n, passed: c, error: c ? undefined : e });
    if (c) { this.passed++; } else { this.failed++; }
  }
  summary(): string { return `${this.passed}P ${this.failed}F / ${this.results.length}`; }
}

// Stable small public URL for real HTTP verification. Mirrors
// HostMediaRealDownloadProof — w3c_main.png is a 2.6KB PNG at a well-known
// stable URL. Using the same target keeps the real-network proofs consistent
// across lanes.
const REAL_HTTP_URL = 'https://www.w3.org/Icons/w3c_main.png';
const INVALID_URL = 'https://example.invalid/http-cookie-real-network-proof';

// Real domain used for cookie round-trip scoping. The InMemoryCookieStore uses
// URL-based scope matching — cookie.set writes under the URL's scope,
// cookie.get reads back for the same URL. Using a real domain URL verifies the
// production handler wiring (no network call is made for cookie.set/get).
const COOKIE_URL = 'https://www.w3.org/';

export async function runHostHttpCookieRealNetworkProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // ---------- Step 1: Initialize ReaderCoreClient ----------
  // ReaderCoreClient.init() creates a ReaderCoreRuntime via the NAPI bridge
  // (libreader_core_napi.so) and registers all 6 host capability handlers in
  // its HostAdapter, including:
  //   - http.execute -> OHOSHTTPHostTransport (real @ohos.net.http)
  //   - cookie.get   -> makeCookieGetHandler(InMemoryCookieStore)
  //   - cookie.set   -> makeCookieSetHandler(InMemoryCookieStore)
  // Idempotent: if EntryAbility already initialized the singleton, reuse it.
  let client: ReaderCoreClient;
  try {
    if (ReaderCoreClient.isInitialized()) {
      client = ReaderCoreClient.get();
    } else {
      client = ReaderCoreClient.init();
    }
  } catch (e) {
    const msg = e instanceof Error ? (e as Error).message : String(e);
    r.assert(
      false,
      'init: ReaderCoreClient initialized (NAPI + handlers wired)',
      `init threw (NAPI module not loaded? requires DevEco Studio): ${msg}`
    );
    return r;
  }
  r.assert(true, 'init: ReaderCoreClient initialized (NAPI + handlers wired)');
  const adapter: HostAdapter = client.hostAdapter;

  // ---------- Step 2: Real HTTP GET — success ----------
  // Dispatch http.execute to a real public URL. The production
  // OHOSHTTPHostTransport makes a real HTTP GET via @ohos.net.http, reads the
  // response body as STRING, parses headers, derives finalUrl (via
  // RedirectChainCollector + fallback to request.url), and returns a
  // HostHttpResponse. The handler wraps it as hostReplySuccess with
  // {status, headers, body, finalUrl, charsetHint}.
  let httpReply: HostReply;
  try {
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = REAL_HTTP_URL;
    params['method'] = 'GET';
    httpReply = await adapter.dispatch('http.execute', params);
  } catch (e) {
    const msg = e instanceof Error ? (e as Error).message : String(e);
    r.assert(
      false,
      'http.success: http.execute to real URL does not throw',
      `dispatch threw: ${msg}`
    );
    return r;
  }

  r.assert(
    httpReply.ok === true,
    'http.success: http.execute to real URL returns ok',
    `expected ok=true, got ok=${httpReply.ok} code=${httpReply.code} message=${httpReply.message}`
  );

  if (httpReply.ok && httpReply.result !== undefined) {
    const result = httpReply.result as Record<string, Object>;
    const statusVal = result['status'];
    const bodyVal = result['body'];
    const finalUrlVal = result['finalUrl'];
    const headersVal = result['headers'];

    r.assert(
      typeof statusVal === 'number' &&
      (statusVal as number) >= 200 && (statusVal as number) < 300,
      'http.success: status is 2xx (200 expected)',
      `got ${statusVal}`
    );

    r.assert(
      typeof bodyVal === 'string' && (bodyVal as string).length > 0,
      'http.body: body is non-empty string (real bytes downloaded)',
      `got type=${typeof bodyVal} length=${typeof bodyVal === 'string' ? (bodyVal as string).length : 0}`
    );

    // finalUrl may be the request URL (no redirect) or a redirected URL.
    // Either way it must be a non-empty string.
    r.assert(
      typeof finalUrlVal === 'string' && (finalUrlVal as string).length > 0,
      'http.finalUrl: finalUrl is non-empty string',
      `got type=${typeof finalUrlVal} value=${finalUrlVal}`
    );

    // Response headers must be an object (Record<string, string>) containing
    // at least Content-Type. PNG responses should carry image/png.
    r.assert(
      headersVal !== null && headersVal !== undefined && typeof headersVal === 'object',
      'http.headers: response headers object present',
      `got type=${typeof headersVal}`
    );
    if (headersVal !== null && headersVal !== undefined && typeof headersVal === 'object') {
      const headers = headersVal as Record<string, string>;
      // Case-insensitive Content-Type lookup (parseHeaders preserves original
      // key casing from the platform).
      let contentType = '';
      const keys = Object.keys(headers);
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].toLowerCase() === 'content-type') {
          contentType = headers[keys[i]];
          break;
        }
      }
      r.assert(
        contentType.length > 0,
        'http.headers: Content-Type header is non-empty',
        `got "${contentType}"`
      );
    }
  } else if (httpReply.ok) {
    r.assert(false, 'http.success: result present', 'ok=true but result undefined');
  }

  // ---------- Step 3: Error case — .invalid URL returns structured error ----------
  // Dispatch http.execute to a .invalid URL. The production transport attempts
  // a real HTTP GET; DNS resolution fails for .invalid TLD (RFC 6761). The
  // transport throws Error; the handler catches and returns a structured
  // HostReply error (ok=false, code=NETWORK_ERROR). The proof verifies dispatch
  // DOES NOT throw (structured error, not unhandled exception) and the reply
  // carries a non-empty code + message.
  let errorReply: HostReply;
  try {
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = INVALID_URL;
    params['method'] = 'GET';
    errorReply = await adapter.dispatch('http.execute', params);
  } catch (e) {
    const msg = e instanceof Error ? (e as Error).message : String(e);
    r.assert(
      false,
      'http.error: .invalid URL returns structured error (not throw)',
      `dispatch threw: ${msg}`
    );
    return r;
  }

  r.assert(
    errorReply.ok === false,
    'http.error: .invalid URL returns structured error (not throw)',
    `expected ok=false, got ok=${errorReply.ok}`
  );

  if (!errorReply.ok) {
    r.assert(
      typeof errorReply.code === 'string' && (errorReply.code as string).length > 0,
      'http.errorCode: error reply has non-empty code',
      `got ${errorReply.code}`
    );
    r.assert(
      typeof errorReply.message === 'string' && (errorReply.message as string).length > 0,
      'http.errorMessage: error reply has non-empty message',
      `got ${errorReply.message}`
    );
  }

  // ---------- Step 4: cookie.set — write cookie for real domain ----------
  // Dispatch cookie.set with a real-domain URL. The production
  // makeCookieSetHandler(InMemoryCookieStore) validates params, builds a
  // CookieRecord, and persists it via cookieStore.save(url, [record]). No
  // network call is made — the cookie jar is host-owned in-memory storage.
  // Using a real domain URL (https://www.w3.org/) verifies the production
  // handler wiring and URL-based scope matching.
  const cookieName = 'http-cookie-proof';
  const cookieValue = 'real-network-session-token';
  const cookieDomain = 'www.w3.org';

  let setReply: HostReply;
  try {
    const cookieObj: Record<string, Object> = {} as Record<string, Object>;
    cookieObj['name'] = cookieName;
    cookieObj['value'] = cookieValue;
    cookieObj['domain'] = cookieDomain;
    cookieObj['path'] = '/';
    cookieObj['secure'] = true;
    cookieObj['httpOnly'] = true;
    const setParams: Record<string, Object> = {} as Record<string, Object>;
    setParams['url'] = COOKIE_URL;
    setParams['cookie'] = cookieObj;
    setReply = await adapter.dispatch('cookie.set', setParams);
  } catch (e) {
    const msg = e instanceof Error ? (e as Error).message : String(e);
    r.assert(
      false,
      'cookie.set: dispatch does not throw',
      `dispatch threw: ${msg}`
    );
    return r;
  }

  r.assert(
    setReply.ok === true,
    'cookie.set: returns ok for real-domain URL',
    `expected ok=true, got ok=${setReply.ok} code=${setReply.code} message=${setReply.message}`
  );

  if (setReply.ok && setReply.result !== undefined) {
    const setResult = setReply.result as Record<string, Object>;
    const storedVal = setResult['stored'];
    r.assert(
      storedVal === true,
      'cookie.set: returns stored=true',
      `got ${storedVal}`
    );
  } else if (setReply.ok) {
    r.assert(false, 'cookie.set: result present', 'ok=true but result undefined');
  }

  // ---------- Step 5: cookie.get — read cookie back for same URL ----------
  // Dispatch cookie.get with the same URL. The production
  // makeCookieGetHandler(InMemoryCookieStore) calls cookieStore.get(url) which
  // returns the CookieScope for that URL. The proof verifies the cookie set in
  // Step 4 is returned with matching name/value/domain.
  let getReply: HostReply;
  try {
    const getParams: Record<string, Object> = {} as Record<string, Object>;
    getParams['url'] = COOKIE_URL;
    getReply = await adapter.dispatch('cookie.get', getParams);
  } catch (e) {
    const msg = e instanceof Error ? (e as Error).message : String(e);
    r.assert(
      false,
      'cookie.get: dispatch does not throw',
      `dispatch threw: ${msg}`
    );
    return r;
  }

  r.assert(
    getReply.ok === true,
    'cookie.get: returns ok for same URL',
    `expected ok=true, got ok=${getReply.ok} code=${getReply.code} message=${getReply.message}`
  );

  if (getReply.ok && getReply.result !== undefined) {
    const getResult = getReply.result as Record<string, Object>;
    const cookiesVal = getResult['cookies'];
    r.assert(
      cookiesVal !== undefined && cookiesVal !== null && Array.isArray(cookiesVal),
      'cookie.get: cookies array present',
      `got type=${typeof cookiesVal}`
    );

    if (cookiesVal !== undefined && cookiesVal !== null && Array.isArray(cookiesVal)) {
      const cookies = cookiesVal as Object[];
      r.assert(
        cookies.length > 0,
        'cookie.get: at least 1 cookie returned',
        `got ${cookies.length} cookies`
      );

      // Find the cookie set in Step 4 by name.
      let foundProofCookie = false;
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i] as Record<string, Object>;
        if (cookie['name'] === cookieName) {
          foundProofCookie = true;
          r.assert(
            cookie['value'] === cookieValue,
            'cookie.match: value matches what was set',
            `got ${cookie['value']}`
          );
          r.assert(
            cookie['domain'] === cookieDomain,
            'cookie.match: domain matches what was set',
            `got ${cookie['domain']}`
          );
          break;
        }
      }
      r.assert(
        foundProofCookie,
        'cookie.match: cookie.get returned the cookie set by cookie.set',
        `cookie name "${cookieName}" not found in ${cookies.length} cookies`
      );
    }
  } else if (getReply.ok) {
    r.assert(false, 'cookie.get: result present', 'ok=true but result undefined');
  }

  // NOTE: do NOT call client.close() — the singleton lifecycle is owned by
  // EntryAbility. Closing here would break subsequent app code that calls
  // ReaderCoreClient.get(). The NAPI runtime is released when the app exits.

  return r;
}

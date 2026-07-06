// HostLoginCookieProof — headless proof for the login_cookie lane.
//
// Mirrors Android `HostLoginCookieProofTest.kt` and iOS
// `HostLoginCookieProofTests.swift`. Proves the three HarmonyOS host-side
// capability handlers honour the same JSON contract as Android/iOS so the
// login_cookie lane reaches 3/3 parity:
//
//   1. httpExecuteReturnsFinalUrlAfterRedirect
//      Stub transport simulates 302→200 (returns finalUrl = ".../final");
//      http.execute handler must surface finalUrl + status 200 + final body.
//
//   2. httpExecuteCapturesSetCookieHeader
//      Stub transport returns 200 + Set-Cookie header; http.execute handler
//      must parse it into result.cookies with the right name/value.
//
//   3. cookieSetAndGetRoundTrip
//      cookie.set writes a cookie via InMemoryCookieStore, cookie.get reads
//      it back for the same URL; the returned cookie must match.
//
// Why stub transport (not MockWebServer): HarmonyOS has no MockWebServer
// equivalent and @ohos.net.http does not expose the post-redirect URL
// (see OHOSHTTPHostTransport.ets file header — Plan C). The stub transport
// lets us verify the handler-layer plumbing (finalUrl threading, Set-Cookie
// parsing, cookie store round-trip) without depending on that platform gap.
// The real OHOSHTTPHostTransport is exercised by the device-tier
// RustCoreEndToEndValidator.
//
// Tier: HEADLESS. Does NOT load libreader_core_napi.so — tests handlers
// directly, not through HostRuntime/HostAdapter dispatch.

import { HostTransport } from '../host/HostTransport';
import { HostHttpRequest, HostHttpResponse } from '../host/HttpRequest';
import { makeHttpExecuteHandler } from '../host/HttpExecuteHandler';
import { makeCookieGetHandler } from '../host/CookieGetHandler';
import { makeCookieSetHandler } from '../host/CookieSetHandler';
import { InMemoryCookieStore } from '../host/CookieStore';
import { HostReply } from '../host/HostReply';
import { CapabilityHandler } from '../host/CapabilityHandler';

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

// StubHostTransport — canned-response HostTransport for proof tests.
// Each instance holds a single queued HostHttpResponse returned by execute().
// Mirrors Android MockWebServer.enqueue(MockResponse) semantics for the
// login_cookie proof: the test pre-programs the response, the handler calls
// execute(), and we assert on the handler's result.
class StubHostTransport implements HostTransport {
  private queued: HostHttpResponse[];

  constructor(responses: HostHttpResponse[]) {
    this.queued = responses;
  }

  async execute(request: HostHttpRequest): Promise<HostHttpResponse> {
    if (this.queued.length === 0) {
      throw new Error('StubHostTransport: no queued response');
    }
    const next = this.queued.shift();
    if (next === undefined) {
      throw new Error('StubHostTransport: shift returned undefined');
    }
    return next;
  }
}

export async function runHostLoginCookieProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // ---------- Proof 1: http.execute returns finalUrl after redirect ----------
  // Stub simulates OkHttp's post-redirect state: status 200, body "final page",
  // finalUrl = "https://example.test/final" (the URL after the 302 chain).
  // The handler must thread finalUrl through to the host.complete result.
  {
    const redirectResponse: HostHttpResponse = {
      status: 200,
      headers: {} as Record<string, string>,
      body: 'final page',
      finalUrl: 'https://example.test/final',
      charsetHint: ''
    } as HostHttpResponse;
    const transport = new StubHostTransport([redirectResponse]);
    const handler: CapabilityHandler = makeHttpExecuteHandler(transport);

    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = 'https://example.test/redirect';
    params['method'] = 'GET';
    const reply: HostReply = await handler(params);

    r.assert(reply.ok === true, 'proof1: http.execute reply ok');
    if (!reply.ok || reply.result === undefined) {
      r.assert(false, 'proof1: result present', 'reply not ok or missing result');
    } else {
      const result = reply.result as Record<string, Object>;
      const finalUrlVal = result['finalUrl'];
      const statusVal = result['status'];
      const bodyVal = result['body'];
      r.assert(typeof finalUrlVal === 'string', 'proof1: finalUrl is string');
      r.assert(
        typeof finalUrlVal === 'string' && (finalUrlVal as string).endsWith('/final'),
        'proof1: finalUrl ends with /final',
        `got ${finalUrlVal}`
      );
      r.assert(typeof statusVal === 'number' && statusVal === 200, 'proof1: status 200', `got ${statusVal}`);
      r.assert(typeof bodyVal === 'string' && bodyVal === 'final page', 'proof1: body is final page', `got ${bodyVal}`);
    }
  }

  // ---------- Proof 2: http.execute captures Set-Cookie header ----------
  // Stub returns 200 + Set-Cookie header; the handler must parse it into
  // result.cookies with name="session" value="abc123".
  {
    const headers: Record<string, string> = {};
    headers['Set-Cookie'] = 'session=abc123; Path=/; HttpOnly';
    const cookieResponse: HostHttpResponse = {
      status: 200,
      headers: headers,
      body: 'ok',
      finalUrl: 'https://example.test/',
      charsetHint: ''
    } as HostHttpResponse;
    const transport = new StubHostTransport([cookieResponse]);
    const handler: CapabilityHandler = makeHttpExecuteHandler(transport);

    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = 'https://example.test/';
    params['method'] = 'GET';
    const reply: HostReply = await handler(params);

    r.assert(reply.ok === true, 'proof2: http.execute reply ok');
    if (!reply.ok || reply.result === undefined) {
      r.assert(false, 'proof2: result present', 'reply not ok or missing result');
    } else {
      const result = reply.result as Record<string, Object>;
      const cookiesVal = result['cookies'];
      r.assert(cookiesVal !== undefined && Array.isArray(cookiesVal), 'proof2: cookies array present');
      if (cookiesVal !== undefined && Array.isArray(cookiesVal)) {
        const cookies = cookiesVal as Object[];
        r.assert(cookies.length === 1, 'proof2: exactly 1 cookie captured', `got ${cookies.length}`);
        if (cookies.length >= 1) {
          const cookie = cookies[0] as Record<string, string>;
          r.assert(cookie['name'] === 'session', 'proof2: cookie name session', `got ${cookie['name']}`);
          r.assert(cookie['value'] === 'abc123', 'proof2: cookie value abc123', `got ${cookie['value']}`);
        }
      }
    }
  }

  // ---------- Proof 3: cookie.set + cookie.get round-trip ----------
  // cookie.set writes a cookie via InMemoryCookieStore; cookie.get reads it
  // back for the same URL. The returned cookie must match name/value/domain.
  {
    const cookieStore = new InMemoryCookieStore();
    const setHandler: CapabilityHandler = makeCookieSetHandler(cookieStore);
    const getHandler: CapabilityHandler = makeCookieGetHandler(cookieStore);

    // 1. cookie.set
    const cookieObj: Record<string, Object> = {} as Record<string, Object>;
    cookieObj['name'] = 'sid';
    cookieObj['value'] = 'session-token-xyz';
    cookieObj['domain'] = 'example.test';
    cookieObj['path'] = '/';
    cookieObj['secure'] = true;
    cookieObj['httpOnly'] = true;
    const setParams: Record<string, Object> = {} as Record<string, Object>;
    setParams['url'] = 'https://example.test/login';
    setParams['cookie'] = cookieObj;
    const setReply: HostReply = await setHandler(setParams);

    r.assert(setReply.ok === true, 'proof3: cookie.set reply ok');
    if (!setReply.ok || setReply.result === undefined) {
      r.assert(false, 'proof3: cookie.set result present', 'reply not ok or missing result');
    } else {
      const setResult = setReply.result as Record<string, Object>;
      const storedVal = setResult['stored'];
      r.assert(storedVal === true, 'proof3: cookie.set returns stored=true', `got ${storedVal}`);
    }

    // 2. cookie.get — read back for the same URL
    const getParams: Record<string, Object> = {} as Record<string, Object>;
    getParams['url'] = 'https://example.test/login';
    const getReply: HostReply = await getHandler(getParams);

    r.assert(getReply.ok === true, 'proof3: cookie.get reply ok');
    if (!getReply.ok || getReply.result === undefined) {
      r.assert(false, 'proof3: cookie.get result present', 'reply not ok or missing result');
    } else {
      const getResult = getReply.result as Record<string, Object>;
      const cookiesVal = getResult['cookies'];
      r.assert(cookiesVal !== undefined && Array.isArray(cookiesVal), 'proof3: cookies array present');
      if (cookiesVal !== undefined && Array.isArray(cookiesVal)) {
        const cookies = cookiesVal as Object[];
        r.assert(cookies.length > 0, 'proof3: at least 1 cookie returned', `got ${cookies.length}`);
        let foundSid = false;
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i] as Record<string, Object>;
          if (cookie['name'] === 'sid') {
            foundSid = true;
            r.assert(cookie['value'] === 'session-token-xyz', 'proof3: sid value matches', `got ${cookie['value']}`);
            r.assert(cookie['domain'] === 'example.test', 'proof3: sid domain matches', `got ${cookie['domain']}`);
          }
        }
        r.assert(foundSid, 'proof3: cookie.get returned the sid cookie set by cookie.set');
      }
    }
  }

  return r;
}

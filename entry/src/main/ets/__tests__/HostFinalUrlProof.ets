// HostFinalUrlProof — headless proof for the finalUrl redirect-reconstruction
// lane (item 4 — HarmonyOS finalUrl fix).
//
// Tier: HEADLESS / UNIT. Mirrors the HostLoginCookieProof.ets and
// HostWebViewRenderProof.ets patterns: a headless test runner that does NOT
// load libreader_core_napi.so and does NOT touch the real @ohos.net.http
// runtime. The RedirectChainCollector is a pure utility (no platform API
// dependency), so cases 1-5 exercise it directly with canned header objects.
// Case 6 simulates the error 2300047 degradation path via a stub transport
// that returns finalUrl=undefined.
//
// Why headless (not device-tier): on('headersReceive') firing semantics on a
// real HarmonyOS device are deferred to beta. The reconstruction LOGIC,
// however, is platform-independent and can be fully verified here by feeding
// the collector the same header shapes the real handler is expected to emit.
// This is the same stub-vs-real split used by HostLoginCookieProof (stub
// transport for handler plumbing; RustCoreEndToEndValidator for real device
// HTTP).
//
// Proof cases (6 total):
//   1. singleRedirectReconstructsFinalUrl        — one Location hop
//   2. multipleRedirectsReconstructChain         — A->B->C chain
//   3. setCookieAtRedirectHopCaptured            — Set-Cookie at intermediate hop
//   4. noRedirectReturnsRequestUrl               — no Location -> fallback
//   5. relativeLocationResolved                  — `/path` resolved absolute
//   6. finalUrlUnavailableWhenNoLocationCaptured — error 2300047 degradation

import { RedirectChainCollector } from '../host/RedirectChainCollector';
import { HostTransport } from '../host/HostTransport';
import { HostHttpRequest, HostHttpResponse } from '../host/HttpRequest';
import { HostReply } from '../host/HostReply';
import { CapabilityHandler } from '../host/CapabilityHandler';
import { makeHttpExecuteHandler } from '../host/HttpExecuteHandler';

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

// StubHostTransport — canned-response HostTransport for proof case 6.
// Mirrors the stub in HostLoginCookieProof.ets but supports a "degradation"
// mode where finalUrl is undefined (simulating the redirect-cap error path
// where the transport could not determine the post-redirect URL).
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

export async function runHostFinalUrlProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // ---------- Proof 1: singleRedirectReconstructsFinalUrl ----------
  // Collector receives one Location header. getFinalUrl() must return the
  // Location target; getRedirects() must contain exactly 1 hop with the
  // correct fromUrl/toUrl.
  {
    const collector = new RedirectChainCollector('https://example.test/start');
    const headers: Record<string, string> = {};
    headers['Location'] = 'https://example.test/final';
    collector.onHeadersReceived(headers);

    const finalUrl = collector.getFinalUrl();
    const redirects = collector.getRedirects();
    r.assert(
      finalUrl === 'https://example.test/final',
      'proof1: getFinalUrl returns Location target',
      `got ${finalUrl}`
    );
    r.assert(collector.hasRedirects() === true, 'proof1: hasRedirects is true');
    r.assert(
      redirects.length === 1,
      'proof1: exactly 1 redirect hop',
      `got ${redirects.length}`
    );
    if (redirects.length >= 1) {
      const hop = redirects[0];
      r.assert(
        hop.fromUrl === 'https://example.test/start',
        'proof1: hop.fromUrl is start URL',
        `got ${hop.fromUrl}`
      );
      r.assert(
        hop.toUrl === 'https://example.test/final',
        'proof1: hop.toUrl is final URL',
        `got ${hop.toUrl}`
      );
      r.assert(hop.status === 302, 'proof1: hop.status assumed 302', `got ${hop.status}`);
    }
  }

  // ---------- Proof 2: multipleRedirectsReconstructChain ----------
  // Collector receives Location A->B then B->C. getFinalUrl() must return C;
  // getRedirects() must contain 2 hops with correct chaining.
  {
    const collector = new RedirectChainCollector('https://a.test/');
    const h1: Record<string, string> = {};
    h1['Location'] = 'https://b.test/';
    collector.onHeadersReceived(h1);
    const h2: Record<string, string> = {};
    h2['Location'] = 'https://c.test/';
    collector.onHeadersReceived(h2);

    const finalUrl = collector.getFinalUrl();
    const redirects = collector.getRedirects();
    r.assert(
      finalUrl === 'https://c.test/',
      'proof2: getFinalUrl returns last Location target (C)',
      `got ${finalUrl}`
    );
    r.assert(
      redirects.length === 2,
      'proof2: exactly 2 redirect hops',
      `got ${redirects.length}`
    );
    if (redirects.length >= 2) {
      const hop1 = redirects[0];
      const hop2 = redirects[1];
      r.assert(
        hop1.fromUrl === 'https://a.test/' && hop1.toUrl === 'https://b.test/',
        'proof2: hop1 A->B',
        `got ${hop1.fromUrl} -> ${hop1.toUrl}`
      );
      r.assert(
        hop2.fromUrl === 'https://b.test/' && hop2.toUrl === 'https://c.test/',
        'proof2: hop2 B->C',
        `got ${hop2.fromUrl} -> ${hop2.toUrl}`
      );
    }
  }

  // ---------- Proof 3: setCookieAtRedirectHopCaptured ----------
  // Collector receives Set-Cookie at a redirect hop. getIntermediateSetCookies()
  // must return the captured value. The Set-Cookie must NOT be lost just
  // because the platform auto-followed the redirect.
  {
    const collector = new RedirectChainCollector('https://login.test/');
    const headers: Record<string, string> = {};
    headers['Location'] = 'https://app.test/dashboard';
    headers['Set-Cookie'] = 'session=abc123; Path=/; HttpOnly';
    collector.onHeadersReceived(headers);

    const intermediate = collector.getIntermediateSetCookies();
    r.assert(
      intermediate.length === 1,
      'proof3: exactly 1 intermediate Set-Cookie captured',
      `got ${intermediate.length}`
    );
    if (intermediate.length >= 1) {
      r.assert(
        intermediate[0].indexOf('session=abc123') !== -1,
        'proof3: Set-Cookie value contains session=abc123',
        `got ${intermediate[0]}`
      );
    }
    // finalUrl should still be the Location target.
    r.assert(
      collector.getFinalUrl() === 'https://app.test/dashboard',
      'proof3: getFinalUrl still returns Location target',
      `got ${collector.getFinalUrl()}`
    );
  }

  // ---------- Proof 4: noRedirectReturnsRequestUrl ----------
  // Collector receives headers with NO Location (a final 2xx response).
  // getFinalUrl() must return the initial URL; hasRedirects() must be false;
  // getRedirects() must be empty. This is the safe fallback path.
  {
    const collector = new RedirectChainCollector('https://example.test/page');
    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'text/html; charset=utf-8';
    headers['Set-Cookie'] = 'tracking=xyz; Path=/';
    collector.onHeadersReceived(headers);

    r.assert(
      collector.hasRedirects() === false,
      'proof4: hasRedirects is false when no Location'
    );
    r.assert(
      collector.getFinalUrl() === 'https://example.test/page',
      'proof4: getFinalUrl returns initial URL (fallback)',
      `got ${collector.getFinalUrl()}`
    );
    r.assert(
      collector.getRedirects().length === 0,
      'proof4: getRedirects is empty',
      `got ${collector.getRedirects().length}`
    );
    // Set-Cookie at the final (non-redirect) response is NOT captured as
    // intermediate — the transport's parseHeaders handles it.
    r.assert(
      collector.getIntermediateSetCookies().length === 0,
      'proof4: no intermediate Set-Cookie at non-redirect response',
      `got ${collector.getIntermediateSetCookies().length}`
    );
  }

  // ---------- Proof 5: relativeLocationResolved ----------
  // Collector receives `Location: /path`. The relative URL must be resolved
  // against currentUrl to form an absolute URL.
  {
    const collector = new RedirectChainCollector('https://example.test/foo/bar');
    const headers: Record<string, string> = {};
    headers['Location'] = '/baz';
    collector.onHeadersReceived(headers);

    const finalUrl = collector.getFinalUrl();
    r.assert(
      finalUrl === 'https://example.test/baz',
      'proof5: root-relative Location resolved to absolute URL',
      `got ${finalUrl}`
    );
  }

  // Also verify a relative path (no leading slash) resolves against the
  // currentUrl's directory.
  {
    const collector = new RedirectChainCollector('https://example.test/foo/bar');
    const headers: Record<string, string> = {};
    headers['Location'] = 'baz';
    collector.onHeadersReceived(headers);

    const finalUrl = collector.getFinalUrl();
    r.assert(
      finalUrl === 'https://example.test/foo/baz',
      'proof5b: relative Location resolved against directory',
      `got ${finalUrl}`
    );
  }

  // ---------- Proof 6: finalUrlUnavailableWhenNoLocationCaptured ----------
  // Simulate the error 2300047 degradation path: the stub transport returns
  // finalUrl=undefined (the transport could not determine the post-redirect
  // URL because on('headersReceive') did not fire and the redirect cap was
  // hit with no Location captured). The http.execute handler must thread
  // finalUrl=undefined through to the host.complete result — callers can then
  // distinguish "unknown finalUrl" from "no redirect occurred".
  {
    const degradationResponse: HostHttpResponse = {
      status: 0,
      headers: {} as Record<string, string>,
      body: '',
      finalUrl: undefined,
      charsetHint: '',
      redirects: []
    } as HostHttpResponse;
    const transport = new StubHostTransport([degradationResponse]);
    const handler: CapabilityHandler = makeHttpExecuteHandler(transport);

    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = 'https://example.test/redirect-cap';
    params['method'] = 'GET';
    const reply: HostReply = await handler(params);

    r.assert(reply.ok === true, 'proof6: http.execute reply ok (degradation is not an error)');
    if (!reply.ok || reply.result === undefined) {
      r.assert(false, 'proof6: result present', 'reply not ok or missing result');
    } else {
      const result = reply.result as Record<string, Object>;
      const finalUrlVal = result['finalUrl'];
      r.assert(
        finalUrlVal === undefined,
        'proof6: finalUrl is undefined (signal degradation, NOT request.url)',
        `got ${finalUrlVal}`
      );
      r.assert(
        result['status'] === 0,
        'proof6: status is 0 (no final response received)',
        `got ${result['status']}`
      );
    }
  }

  return r;
}

// HostAntiBotProof — headless proof for the anti_bot lane (item 3b).
//
// Tier: HANDLER/ROUTER. Mirrors HostLoginCookieProof.ets / HostWebViewRenderProof.ets
// pattern: calls the AntiBotChallengeHandler directly with StubAntiBotExecutor
// (no libreader_core_napi.so, no HostRuntime/HostAdapter dispatch, no real
// @ohos.net.http runtime).
//
// (1) This is handler/router tier proof — verifies the handler-layer plumbing
//     (executor fetch delegation, detector classification, ChallengeRequired
//     diagnostic building, cookieJarId threading) against the Core contract
//     in crates/reader-contract/src/host.rs (lines 683-708).
//
// (2) Device-headless/App tier (real anti_bot source L1-L5) requires
//     @ohos.net.http + persistent cookie store + DevEco Studio emulator —
//     pending device proof, out of scope for this increment.
//
// (3) Mirrors iOS/Android proof structure: anti_bot handler parity target
//     (3/3) uses the same stub-executor + canned-response approach for
//     handler/router proof.
//
// (4) WHY stub executor (not real @ohos.net.http): headless proof verifies
//     handler-layer plumbing (detector classification, ChallengeRequired
//     diagnostic shape, cookieJarId preservation) without depending on the
//     device network runtime. The ArkAntiBotExecutor (production) throws
//     not_implemented — the real backend will be wired in a future increment.
//     The stub executor lets us prove the handler honours the JSON contract
//     (lane="anti_bot", challengeType, url, autoRetryable=false, cookieJarId)
//     the same way StubHostTransport proves the http.execute handler without
//     real network I/O.

import {
  AntiBotChallengeHandler,
  AntiBotChallengeDetector,
  AntiBotChallengeReply,
  AntiBotExecutor,
  AntiBotHttpResponse,
  StubAntiBotExecutor
} from '../host/AntiBotChallengeHandler';
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

export async function runHostAntiBotProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // ---------- Proof 1: cleanResponseReturnsCompletedResult ----------
  // StubAntiBotExecutor returns 200 OK HTML body. Detector returns NONE.
  // Handler returns success with the response body.
  {
    const stubResponse: AntiBotHttpResponse = {
      statusCode: 200,
      body: '<html><body><h1>Welcome</h1><p>Real content here.</p></body></html>',
      headers: {} as Record<string, string>,
      finalUrl: 'https://example.test/article'
    } as AntiBotHttpResponse;
    const executor: AntiBotExecutor = new StubAntiBotExecutor(stubResponse);
    const detector: AntiBotChallengeDetector = new AntiBotChallengeDetector();
    const handler: AntiBotChallengeHandler = new AntiBotChallengeHandler(executor, detector);

    const reply: HostReply = await handler.handle(
      'https://example.test/article',
      {} as Record<string, string>
    );

    r.assert(reply.ok === true, 'proof1: anti_bot clean response reply ok');
    if (!reply.ok || reply.result === undefined) {
      r.assert(false, 'proof1: result present', 'reply not ok or missing result');
    } else {
      const result = reply.result as Record<string, Object>;
      const bodyVal = result['body'];
      const statusVal = result['statusCode'];
      const finalUrlVal = result['finalUrl'];
      r.assert(
        typeof bodyVal === 'string' && (bodyVal as string).includes('Welcome'),
        'proof1: body contains "Welcome"',
        `got ${bodyVal}`
      );
      r.assert(
        typeof statusVal === 'number' && statusVal === 200,
        'proof1: statusCode === 200',
        `got ${statusVal}`
      );
      r.assert(
        typeof finalUrlVal === 'string' && (finalUrlVal as string).endsWith('/article'),
        'proof1: finalUrl ends with /article',
        `got ${finalUrlVal}`
      );
    }
  }

  // ---------- Proof 2: cloudflareJsChallengeReturnsChallengeRequired ----------
  // Stub returns 503 with Cloudflare "Just a moment" markers (jschl +
  // cf-browser-verification). Handler returns ChallengeRequired error with
  // challengeType="cloudflare_js".
  {
    const stubResponse: AntiBotHttpResponse = {
      statusCode: 503,
      body: '<html><head><title>Just a moment...</title></head><body>' +
        '<script src="/cdn-cgi/challenge-platform/h/g/jschl/v1"></script>' +
        '<div class="cf-browser-verification"></div></body></html>',
      headers: {} as Record<string, string>,
      finalUrl: 'https://protected.test/list'
    } as AntiBotHttpResponse;
    const executor: AntiBotExecutor = new StubAntiBotExecutor(stubResponse);
    const detector: AntiBotChallengeDetector = new AntiBotChallengeDetector();
    const handler: AntiBotChallengeHandler = new AntiBotChallengeHandler(executor, detector);

    const reply: HostReply = await handler.handle(
      'https://protected.test/list',
      {} as Record<string, string>
    );

    r.assert(reply.ok === false, 'proof2: cloudflare_js challenge reply is error (not ok)');
    if (reply.ok) {
      r.assert(false, 'proof2: expected error reply', 'got ok reply');
    } else {
      r.assert(
        typeof reply.code === 'string' && reply.code === 'CHALLENGE_REQUIRED',
        'proof2: error code === "CHALLENGE_REQUIRED"',
        `got ${reply.code}`
      );
      r.assert(
        reply.retryable === false,
        'proof2: ChallengeRequired is NOT retryable (fail-closed)',
        `got retryable=${reply.retryable}`
      );
      const challengeReply = reply as AntiBotChallengeReply;
      const details = challengeReply.details;
      r.assert(details !== undefined && details !== null, 'proof2: details present');
      if (details !== undefined && details !== null) {
        r.assert(
          details['lane'] === 'anti_bot',
          'proof2: details.lane === "anti_bot"',
          `got ${details['lane']}`
        );
        r.assert(
          details['challengeType'] === 'cloudflare_js',
          'proof2: details.challengeType === "cloudflare_js"',
          `got ${details['challengeType']}`
        );
        r.assert(
          details['url'] === 'https://protected.test/list',
          'proof2: details.url === challenge URL',
          `got ${details['url']}`
        );
        r.assert(
          details['autoRetryable'] === false,
          'proof2: details.autoRetryable === false',
          `got ${details['autoRetryable']}`
        );
      }
    }
  }

  // ---------- Proof 3: sliderCaptchaReturnsChallengeRequired ----------
  // Stub returns 200 OK HTML with slider captcha markers (body contains both
  // "slider" and "captcha"). Handler returns ChallengeRequired error with
  // challengeType="slider_captcha".
  {
    const stubResponse: AntiBotHttpResponse = {
      statusCode: 200,
      body: '<html><body><div class="captcha-container">' +
        '<div class="slider-track"></div><div class="slider-handle"></div>' +
        '<p>Please complete the captcha to continue.</p></div></body></html>',
      headers: {} as Record<string, string>,
      finalUrl: 'https://gate.test/search'
    } as AntiBotHttpResponse;
    const executor: AntiBotExecutor = new StubAntiBotExecutor(stubResponse);
    const detector: AntiBotChallengeDetector = new AntiBotChallengeDetector();
    const handler: AntiBotChallengeHandler = new AntiBotChallengeHandler(executor, detector);

    const reply: HostReply = await handler.handle(
      'https://gate.test/search',
      {} as Record<string, string>
    );

    r.assert(reply.ok === false, 'proof3: slider_captcha challenge reply is error (not ok)');
    if (reply.ok) {
      r.assert(false, 'proof3: expected error reply', 'got ok reply');
    } else {
      r.assert(
        typeof reply.code === 'string' && reply.code === 'CHALLENGE_REQUIRED',
        'proof3: error code === "CHALLENGE_REQUIRED"',
        `got ${reply.code}`
      );
      const challengeReply = reply as AntiBotChallengeReply;
      const details = challengeReply.details;
      r.assert(details !== undefined && details !== null, 'proof3: details present');
      if (details !== undefined && details !== null) {
        r.assert(
          details['challengeType'] === 'slider_captcha',
          'proof3: details.challengeType === "slider_captcha"',
          `got ${details['challengeType']}`
        );
        r.assert(
          details['lane'] === 'anti_bot',
          'proof3: details.lane === "anti_bot"',
          `got ${details['lane']}`
        );
      }
    }
  }

  // ---------- Proof 4: recaptchaReturnsChallengeRequired ----------
  // Stub returns 200 OK HTML with g-recaptcha marker. Handler returns
  // ChallengeRequired error with challengeType="recaptcha_v2".
  {
    const stubResponse: AntiBotHttpResponse = {
      statusCode: 200,
      body: '<html><body><form action="/verify">' +
        '<div class="g-recaptcha" data-sitekey="6Le-wvkSVVABBPB"></div>' +
        '<script src="https://www.google.com/recaptcha/api.js"></script>' +
        '</form></body></html>',
      headers: {} as Record<string, string>,
      finalUrl: 'https://verify.test/login'
    } as AntiBotHttpResponse;
    const executor: AntiBotExecutor = new StubAntiBotExecutor(stubResponse);
    const detector: AntiBotChallengeDetector = new AntiBotChallengeDetector();
    const handler: AntiBotChallengeHandler = new AntiBotChallengeHandler(executor, detector);

    const reply: HostReply = await handler.handle(
      'https://verify.test/login',
      {} as Record<string, string>
    );

    r.assert(reply.ok === false, 'proof4: recaptcha_v2 challenge reply is error (not ok)');
    if (reply.ok) {
      r.assert(false, 'proof4: expected error reply', 'got ok reply');
    } else {
      r.assert(
        typeof reply.code === 'string' && reply.code === 'CHALLENGE_REQUIRED',
        'proof4: error code === "CHALLENGE_REQUIRED"',
        `got ${reply.code}`
      );
      const challengeReply = reply as AntiBotChallengeReply;
      const details = challengeReply.details;
      r.assert(details !== undefined && details !== null, 'proof4: details present');
      if (details !== undefined && details !== null) {
        r.assert(
          details['challengeType'] === 'recaptcha_v2',
          'proof4: details.challengeType === "recaptcha_v2"',
          `got ${details['challengeType']}`
        );
        r.assert(
          details['url'] === 'https://verify.test/login',
          'proof4: details.url preserved',
          `got ${details['url']}`
        );
      }
    }
  }

  // ---------- Proof 5: cookieJarIdPreservedInErrorDetails ----------
  // Handler is called with cookieJarId="source-abc-123". When a challenge is
  // detected, the cookieJarId must be threaded into the error details so
  // Core can correlate the challenge with the per-source cookie session.
  // Uses a Cloudflare JS challenge response to trigger the error path.
  {
    const stubResponse: AntiBotHttpResponse = {
      statusCode: 503,
      body: '<html><body><script>jschl_answer=1;</script>' +
        '<div class="cf-browser-verification">checking browser</div></body></html>',
      headers: {} as Record<string, string>,
      finalUrl: 'https://cf.test/catalog'
    } as AntiBotHttpResponse;
    const executor: AntiBotExecutor = new StubAntiBotExecutor(stubResponse);
    const detector: AntiBotChallengeDetector = new AntiBotChallengeDetector();
    const handler: AntiBotChallengeHandler = new AntiBotChallengeHandler(executor, detector);

    const reply: HostReply = await handler.handle(
      'https://cf.test/catalog',
      {} as Record<string, string>,
      'source-abc-123'
    );

    r.assert(reply.ok === false, 'proof5: cookieJarId challenge reply is error (not ok)');
    if (reply.ok) {
      r.assert(false, 'proof5: expected error reply', 'got ok reply');
    } else {
      r.assert(
        typeof reply.code === 'string' && reply.code === 'CHALLENGE_REQUIRED',
        'proof5: error code === "CHALLENGE_REQUIRED"',
        `got ${reply.code}`
      );
      const challengeReply = reply as AntiBotChallengeReply;
      const details = challengeReply.details;
      r.assert(details !== undefined && details !== null, 'proof5: details present');
      if (details !== undefined && details !== null) {
        r.assert(
          details['cookieJarId'] === 'source-abc-123',
          'proof5: details.cookieJarId === "source-abc-123" (preserved from handle call)',
          `got ${details['cookieJarId']}`
        );
        r.assert(
          details['lane'] === 'anti_bot',
          'proof5: details.lane === "anti_bot"',
          `got ${details['lane']}`
        );
        r.assert(
          details['challengeType'] === 'cloudflare_js',
          'proof5: details.challengeType === "cloudflare_js"',
          `got ${details['challengeType']}`
        );
      }
    }
  }

  // ---------- Proof 6: unsupportedChallengeReturnsChallengeRequired ----------
  // Stub returns 403 with no known challenge markers. Handler returns
  // ChallengeRequired error with challengeType="unsupported" (host_required,
  // fail-closed — Core marks source host_required, no retry).
  {
    const stubResponse: AntiBotHttpResponse = {
      statusCode: 403,
      body: '<html><body><h1>403 Forbidden</h1><p>Access denied.</p></body></html>',
      headers: {} as Record<string, string>,
      finalUrl: 'https://strict.test/protected'
    } as AntiBotHttpResponse;
    const executor: AntiBotExecutor = new StubAntiBotExecutor(stubResponse);
    const detector: AntiBotChallengeDetector = new AntiBotChallengeDetector();
    const handler: AntiBotChallengeHandler = new AntiBotChallengeHandler(executor, detector);

    const reply: HostReply = await handler.handle(
      'https://strict.test/protected',
      {} as Record<string, string>
    );

    r.assert(reply.ok === false, 'proof6: unsupported challenge reply is error (not ok)');
    if (reply.ok) {
      r.assert(false, 'proof6: expected error reply', 'got ok reply');
    } else {
      r.assert(
        typeof reply.code === 'string' && reply.code === 'CHALLENGE_REQUIRED',
        'proof6: error code === "CHALLENGE_REQUIRED"',
        `got ${reply.code}`
      );
      r.assert(
        reply.retryable === false,
        'proof6: unsupported challenge is NOT retryable (fail-closed)',
        `got retryable=${reply.retryable}`
      );
      const challengeReply = reply as AntiBotChallengeReply;
      const details = challengeReply.details;
      r.assert(details !== undefined && details !== null, 'proof6: details present');
      if (details !== undefined && details !== null) {
        r.assert(
          details['challengeType'] === 'unsupported',
          'proof6: details.challengeType === "unsupported"',
          `got ${details['challengeType']}`
        );
        r.assert(
          details['autoRetryable'] === false,
          'proof6: details.autoRetryable === false',
          `got ${details['autoRetryable']}`
        );
        r.assert(
          details['url'] === 'https://strict.test/protected',
          'proof6: details.url preserved',
          `got ${details['url']}`
        );
      }
    }
  }

  return r;
}

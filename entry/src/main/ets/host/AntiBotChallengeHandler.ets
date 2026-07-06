// AntiBotChallengeHandler — anti-bot challenge detection + handler.
//
// Alpha proof: handler/router layer with StubAntiBotExecutor. Device-headless/
// App layer (real anti_bot source L1-L5) deferred to beta.
//
// Mirrors the Core contract in crates/reader-contract/src/host.rs (lines
// 683-708): HostErrorDiagnostics::challenge_required(lane, challenge_type,
// url) builds a ChallengeRequired diagnostic with code="CHALLENGE_REQUIRED",
// details={lane, challengeType, url, autoRetryable: false}. Core uses this
// to mark the source as host_required and skip retries — a fail-closed
// signal, not a transient failure.
//
// The anti_bot lane is a lane coordinator (not a single capability) — it
// composes http.execute + cookie jar + challenge detection. This handler
// owns the detection + routing decision; the executor abstraction mirrors
// HostTransport (login_cookie lane) and WebViewExecutor (webview_render
// lane): production wires ArkAntiBotExecutor (real @ohos.net.http + cookie
// store); tests wire StubAntiBotExecutor (canned responses).
//
// Anti-bot is a lane coordinator, not a CapabilityHandler — but the
// structural pattern (executor interface + StubExecutor + ArkExecutor stub +
// structured executor error) mirrors WebViewEvaluateJavaScriptHandler.ets
// for 3/3 parity with iOS/Android anti_bot handlers.
//
// Alpha scope: detection + handler/router plumbing proven via
// StubAntiBotExecutor. Beta scope: real anti_bot source L1-L5 with
// ArkAntiBotExecutor + persistent cookie jar + cf_clearance/__jsluid
// cookie lifecycle.
import { HostReply, hostReplySuccess, hostReplyError } from './HostReply';

export const ANTI_BOT_LANE = 'anti_bot';
export const CHALLENGE_REQUIRED_CODE = 'CHALLENGE_REQUIRED';

// Challenge type enum. Mirrors the free-form `challenge_type` string in
// HostErrorDiagnostics::challenge_required (host.rs:689-690). Serialized as
// snake_case to match Core's challenge_type convention
// (e.g. "cloudflare_js", "slider_captcha", "recaptcha_v2").
export enum AntiBotChallengeType {
  NONE = 'none',
  CLOUDFLARE_JS = 'cloudflare_js',
  SLIDER_CAPTCHA = 'slider_captcha',
  RECAPTCHA_V2 = 'recaptcha_v2',
  UNSUPPORTED = 'unsupported'
}

// Detection result returned by AntiBotChallengeDetector.detect().
export interface AntiBotChallengeDetection {
  challengeType: AntiBotChallengeType;
  challengeUrl: string;
  cookieJarId?: string;
}

// HTTP response shape consumed by the detector. Mirrors HostHttpResponse
// (login_cookie lane) — statusCode, body, headers, finalUrl (post-redirect
// URL). The detector inspects body + statusCode to classify challenges.
export interface AntiBotHttpResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  finalUrl: string;
}

// Executor abstraction — production wires ArkAntiBotExecutor (real
// @ohos.net.http + persistent cookie store); tests wire StubAntiBotExecutor.
// Mirrors HostTransport / WebViewExecutor.
export interface AntiBotExecutor {
  fetch(url: string, headers: Record<string, string>, cookieJarId?: string): Promise<AntiBotHttpResponse>;
}

// Structured executor error. Mirrors WebViewExecutorError categories:
// - timeout: fetch exceeded timeout (retryable)
// - not_implemented: host cannot serve anti_bot fetch (ArkAntiBotExecutor stub)
// - network: transport failure (retryable)
//
// Extends Error to satisfy arkts-limited-throw (SDK 6.0 strict mode requires
// `throw` operands to be Error subclasses). Instance checks still use
// `instanceof AntiBotExecutorError`.
export class AntiBotExecutorError extends Error {
  readonly kind: string;
  readonly cause?: string;

  private constructor(kind: string, message: string, cause?: string) {
    super(message);
    this.kind = kind;
    this.name = 'AntiBotExecutorError';
    this.cause = cause;
  }

  static timeout(): AntiBotExecutorError {
    return new AntiBotExecutorError('timeout', 'anti_bot fetch timed out');
  }

  static notImplemented(): AntiBotExecutorError {
    return new AntiBotExecutorError(
      'not_implemented',
      'anti_bot executor not implemented (ArkAntiBotExecutor stub — real @ohos.net.http backend pending)'
    );
  }

  static network(cause: string): AntiBotExecutorError {
    return new AntiBotExecutorError('network', `anti_bot fetch network error: ${cause}`, cause);
  }
}

// StubAntiBotExecutor — hermetic canned-response executor for proof tests.
// Returns the configured response on every fetch() call, or throws the
// configured error. Mirrors StubWebViewExecutor / StubHostTransport.
export class StubAntiBotExecutor implements AntiBotExecutor {
  private response: AntiBotHttpResponse | null;
  private error: AntiBotExecutorError | null;

  constructor(response?: AntiBotHttpResponse, error?: AntiBotExecutorError) {
    this.response = response ?? null;
    this.error = error ?? null;
  }

  async fetch(url: string, _headers: Record<string, string>, _cookieJarId?: string): Promise<AntiBotHttpResponse> {
    if (this.error !== null) {
      throw this.error as AntiBotExecutorError;
    }
    if (this.response === null) {
      // Default: 200 OK empty body (matches a clean non-challenge response).
      return {
        statusCode: 200,
        body: '',
        headers: {} as Record<string, string>,
        finalUrl: url
      } as AntiBotHttpResponse;
    }
    return this.response as AntiBotHttpResponse;
  }
}

// ArkAntiBotExecutor — production placeholder. Throws not_implemented because
// real anti_bot fetch requires @ohos.net.http + persistent cookie store +
// cf_clearance/__jsluid cookie lifecycle. The handler/router proof uses
// StubAntiBotExecutor; the device-headless/App tier (real anti_bot L1-L5)
// will wire a live backend in a future increment.
export class ArkAntiBotExecutor implements AntiBotExecutor {
  async fetch(_url: string, _headers: Record<string, string>, _cookieJarId?: string): Promise<AntiBotHttpResponse> {
    throw AntiBotExecutorError.notImplemented();
  }
}

// AntiBotChallengeDetector — classifies HTTP responses by challenge signature.
// Detection rules (evaluated in priority order):
//   1. statusCode == 503 + body contains "jschl" OR "cf-browser-verification"
//      → CLOUDFLARE_JS (Cloudflare "Just a moment" JS challenge)
//   2. body contains "slider" AND "captcha" → SLIDER_CAPTCHA
//   3. body contains "recaptcha" OR "g-recaptcha" → RECAPTCHA_V2
//   4. statusCode == 403 + none of the above → UNSUPPORTED (host_required)
//   5. otherwise → NONE (clean response)
//
// Detection is body-signature based (case-insensitive) to match Legado's
// SourceRedirection parser which inspects response body for challenge
// markers. Header-based detection (e.g. Server: cloudflare) is intentionally
// NOT used — too brittle and easily spoofed.
export class AntiBotChallengeDetector {
  detect(response: AntiBotHttpResponse, url: string, cookieJarId?: string): AntiBotChallengeDetection {
    const body: string = response.body ?? '';
    const status: number = response.statusCode;
    const lowerBody: string = body.toLowerCase();

    // 1. Cloudflare JS challenge — 503 + jschl/cf-browser-verification marker
    if (status === 503 && (lowerBody.includes('jschl') || lowerBody.includes('cf-browser-verification'))) {
      return {
        challengeType: AntiBotChallengeType.CLOUDFLARE_JS,
        challengeUrl: url,
        cookieJarId: cookieJarId
      } as AntiBotChallengeDetection;
    }

    // 2. Slider captcha — body contains both "slider" and "captcha"
    if (lowerBody.includes('slider') && lowerBody.includes('captcha')) {
      return {
        challengeType: AntiBotChallengeType.SLIDER_CAPTCHA,
        challengeUrl: url,
        cookieJarId: cookieJarId
      } as AntiBotChallengeDetection;
    }

    // 3. reCAPTCHA v2 — body contains "recaptcha" or "g-recaptcha"
    if (lowerBody.includes('recaptcha') || lowerBody.includes('g-recaptcha')) {
      return {
        challengeType: AntiBotChallengeType.RECAPTCHA_V2,
        challengeUrl: url,
        cookieJarId: cookieJarId
      } as AntiBotChallengeDetection;
    }

    // 4. 403 with no known markers — unsupported challenge (host_required)
    if (status === 403) {
      return {
        challengeType: AntiBotChallengeType.UNSUPPORTED,
        challengeUrl: url,
        cookieJarId: cookieJarId
      } as AntiBotChallengeDetection;
    }

    // 5. Otherwise — clean response, no challenge
    return {
      challengeType: AntiBotChallengeType.NONE,
      challengeUrl: url,
      cookieJarId: cookieJarId
    } as AntiBotChallengeDetection;
  }
}

// Local extension of HostReply to carry ChallengeRequired diagnostics.
// Core's HostErrorDiagnostics includes a `details: Value` JSON object
// (host.rs:628-639); HostReply.ets does not surface `details` directly
// (existing handlers thread structured data through `result` for success).
// For challenge errors we surface details (lane, challengeType, url,
// autoRetryable, cookieJarId) so Core can mark the source host_required —
// extend locally without modifying HostReply.ets.
export interface AntiBotChallengeReply extends HostReply {
  details?: Record<string, Object>;
}

// Build a ChallengeRequired error reply matching Core's
// HostErrorDiagnostics::challenge_required contract (host.rs:691-708).
// details = {lane: "anti_bot", challengeType, url, autoRetryable: false, cookieJarId?}
function buildChallengeRequiredReply(
  challengeType: AntiBotChallengeType,
  url: string,
  cookieJarId?: string
): HostReply {
  const message: string = `Host lane anti_bot encountered an unsolvable challenge (${challengeType}) at ${url}`;
  const details: Record<string, Object> = {} as Record<string, Object>;
  details['lane'] = ANTI_BOT_LANE;
  details['challengeType'] = challengeType as string;
  details['url'] = url;
  details['autoRetryable'] = false;
  if (cookieJarId !== undefined && cookieJarId !== null && cookieJarId.length > 0) {
    details['cookieJarId'] = cookieJarId;
  }
  const reply: AntiBotChallengeReply = {
    ok: false,
    code: CHALLENGE_REQUIRED_CODE,
    message: message,
    retryable: false,
    details: details
  } as AntiBotChallengeReply;
  return reply as HostReply;
}

// AntiBotChallengeHandler — fetches a URL via the executor, runs the detector
// on the response, and routes to HostReply:
//   - NONE → hostReplySuccess with body/statusCode/finalUrl
//   - challenge → ChallengeRequired error with diagnostics (fail-closed)
//
// Anti-bot is a lane coordinator (not a single capability), so this handler
// exposes a typed `handle(url, headers, cookieJarId?)` method rather than the
// CapabilityHandler `(params: Record<string, Object>) => Promise<HostReply>`
// signature. The structural pattern (executor + detector + stub/Ark split)
// mirrors WebViewEvaluateJavaScriptHandler for consistency.
export class AntiBotChallengeHandler {
  private executor: AntiBotExecutor;
  private detector: AntiBotChallengeDetector;

  constructor(executor: AntiBotExecutor, detector: AntiBotChallengeDetector) {
    this.executor = executor;
    this.detector = detector;
  }

  async handle(url: string, headers: Record<string, string>, cookieJarId?: string): Promise<HostReply> {
    let response: AntiBotHttpResponse;
    try {
      response = await this.executor.fetch(url, headers, cookieJarId);
    } catch (e) {
      // Distinguish timeout / not-implemented / network so Core can react
      // with the right error code (mirrors host.rs validation + WebView
      // handler error discrimination).
      if (e instanceof AntiBotExecutorError) {
        const aerr = e as AntiBotExecutorError;
        if (aerr.kind === 'timeout') {
          return hostReplyError('TIMEOUT', aerr.message, true);
        }
        if (aerr.kind === 'not_implemented') {
          return hostReplyError('NOT_IMPLEMENTED', aerr.message, false);
        }
        return hostReplyError('NETWORK_ERROR', aerr.message, true);
      }
      return hostReplyError('INTERNAL', `anti_bot fetch failed: ${e}`, true);
    }

    const detection: AntiBotChallengeDetection = this.detector.detect(response, url, cookieJarId);

    if (detection.challengeType === AntiBotChallengeType.NONE) {
      // Clean response — return body + metadata as success result.
      const result: Record<string, Object> = {} as Record<string, Object>;
      result['body'] = response.body;
      result['statusCode'] = response.statusCode;
      result['finalUrl'] = response.finalUrl;
      return hostReplySuccess(result);
    }

    // Challenge detected — fail-closed with ChallengeRequired diagnostics.
    return buildChallengeRequiredReply(detection.challengeType, detection.challengeUrl, detection.cookieJarId);
  }
}

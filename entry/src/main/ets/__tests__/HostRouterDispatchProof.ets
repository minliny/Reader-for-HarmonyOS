// HostRouterDispatchProof — headless proof for the production router dispatch
// path (ReaderCoreClient → NAPI bridge → HostRuntime-equivalent inline polling
// → HostAdapter → CapabilityHandler).
//
// Tier: ROUTER DISPATCH. Unlike HostLoginCookieProof / HostWebViewRenderProof /
// HostAntiBotProof / HostMediaDownloadProof (which test handlers DIRECTLY,
// skipping NAPI + HostRuntime/HostAdapter dispatch), this proof exercises the
// production router wiring end-to-end:
//
//   1. ReaderCoreClient.init() creates a ReaderCoreRuntime via the NAPI bridge
//      (libreader_core_napi.so) and registers all 6 host capability handlers
//      in its HostAdapter (http.execute, cookie.get, cookie.set,
//      webview.evaluateJavaScript, media.download, anti_bot.challenge).
//   2. For each lane, the proof constructs a synthetic host.request params
//      object (the shape Core would parse from a host.request event) and
//      dispatches it via client.hostAdapter.dispatch(capability, params) —
//      the same call ReaderCoreClient.handleHostRequest makes after
//      parseEvent extracts capability + params from the NAPI readEvent JSON.
//   3. The proof verifies the handler is REACHED (not rejected as "unsupported
//      capability") and returns a structured reply (success for cookie.get/set
//      which work headless via InMemoryCookieStore; NOT_IMPLEMENTED / INTERNAL
//      for webview/media/anti_bot stub executors).
//
// canEnterMainline=false caveat (MANDATORY reading):
//   - The C ABI/NAPI gate (evaluateCAbiPocGate in ReaderCoreNapiBridge.ets)
//     hardcodes memory/threading/CI gates to false — see fields:
//       memoryOwned = false;   // 内存所有权未验证
//       threadingSafe = false; // 线程安全未验证
//       ciGreen = false;       // CI 未通过
//     Real-device proof requires DevEco Studio + simulator/physical device.
//   - This test documents that the router dispatch PATH is wired (all 6
//     handlers registered + reachable via HostAdapter), NOT that real
//     execution works. The stub executors (ArkWebViewExecutor,
//     ArkMediaDownloadExecutor, ArkAntiBotExecutor) throw notImplemented —
//     the proof verifies the dispatch reaches them and returns a structured
//     error, NOT that they execute real platform I/O.
//   - Real device-headless/App tier proof (real ArkWeb for webview, real
//     @ohos.net.http for media/anti_bot, real Core host.request emission
//     through NAPI readEvent → parseEvent → handleHostRequest) requires
//     DevEco Studio + a physical device — out of scope for this increment.
//
// This test REQUIRES DevEco Studio to run (aa start headless). It cannot be
// executed in a non-DevEco environment because ReaderCoreClient.init() loads
// libreader_core_napi.so via the NAPI bridge. If the NAPI module fails to
// load, the test records a single failure with a clear message and exits.

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

// Lane capabilities wired in ReaderCoreClient constructor. These are the
// routing keys the HostAdapter dispatches by. http.execute / cookie.get /
// cookie.set / webview.evaluateJavaScript / media.download are Core
// HostCapability strings (host.rs HostCapability::as_str). anti_bot.challenge
// is a host-side lane coordinator routing key (anti_bot is a HostLane in Core,
// not a HostCapability — see ReaderCoreClient.ets ANTI_BOT_CHALLENGE_CAPABILITY
// comment).
const LANES: string[] = [
  'http.execute',
  'cookie.get',
  'cookie.set',
  'webview.evaluateJavaScript',
  'media.download',
  'anti_bot.challenge'
];

// Synthetic host.request params for each lane. These mirror the params Core
// would emit in a host.request event (the shape ReaderCoreClient.parseEvent
// extracts from the NAPI readEvent JSON). The router dispatch path is:
//   NAPI readEvent → parseEvent → handleHostRequest → adapter.dispatch → handler
// This proof exercises the final step (adapter.dispatch → handler) by calling
// adapter.dispatch directly with the parsed params — the same call
// handleHostRequest makes. The NAPI bridge is exercised by
// ReaderCoreClient.init() (which calls ReaderCoreRuntime.create() → NAPI
// createRuntime). The .invalid TLD is used to ensure no real network I/O
// occurs even if a stub executor is replaced by a real one in the future.
function buildParamsForLane(capability: string): Record<string, Object> {
  const params: Record<string, Object> = {} as Record<string, Object>;
  if (capability === 'http.execute') {
    params['url'] = 'https://example.invalid/router-dispatch-proof';
    params['method'] = 'GET';
  } else if (capability === 'cookie.get') {
    params['url'] = 'https://example.invalid/router-dispatch-proof';
  } else if (capability === 'cookie.set') {
    const cookie: Record<string, Object> = {} as Record<string, Object>;
    cookie['name'] = 'proof';
    cookie['value'] = 'router-dispatch';
    cookie['domain'] = 'example.invalid';
    cookie['path'] = '/';
    params['url'] = 'https://example.invalid/router-dispatch-proof';
    params['cookie'] = cookie;
  } else if (capability === 'webview.evaluateJavaScript') {
    const document: Record<string, Object> = {} as Record<string, Object>;
    document['kind'] = 'html';
    document['body'] = '<html><body>router dispatch proof</body></html>';
    params['document'] = document;
    params['javaScript'] = 'document.title';
  } else if (capability === 'media.download') {
    params['url'] = 'https://example.invalid/router-dispatch-proof.mp3';
    params['method'] = 'GET';
  } else if (capability === 'anti_bot.challenge') {
    params['url'] = 'https://example.invalid/router-dispatch-proof';
  }
  return params;
}

export async function runHostRouterDispatchProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // ---------- Step 1: Initialize ReaderCoreClient (NAPI + handler registration) ----------
  // ReaderCoreClient.init() creates a ReaderCoreRuntime via the NAPI bridge
  // (libreader_core_napi.so) and registers all 6 host capability handlers in
  // its HostAdapter. If the NAPI module fails to load, init() throws and we
  // record a single failure (the test requires DevEco Studio to run).
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
      'init: ReaderCoreClient.init() loads NAPI + registers handlers',
      `init threw (NAPI module not loaded? requires DevEco Studio): ${msg}`
    );
    return r;
  }

  r.assert(true, 'init: ReaderCoreClient.init() loads NAPI + registers handlers');

  const adapter: HostAdapter = client.hostAdapter;

  // ---------- Step 2: Verify all 6 lanes are registered ----------
  // A lane "registered" means HostAdapter.isRegistered(capability) === true.
  // This proves the constructor wired the handler into the router.
  for (let i = 0; i < LANES.length; i++) {
    const capability = LANES[i];
    r.assert(
      adapter.isRegistered(capability),
      `register: ${capability} registered in HostAdapter`,
      `isRegistered(${capability}) === false — constructor did not wire this lane`
    );
  }

  // ---------- Step 3: Dispatch each lane + verify handler is reached ----------
  // For each lane, dispatch synthetic params via adapter.dispatch (the same
  // call ReaderCoreClient.handleHostRequest makes). The handler must be
  // reached — i.e. the reply must NOT be the "unsupported capability" error
  // (code=INTERNAL, message contains "unsupported capability"). The reply
  // SHOULD be either:
  //   - success (ok=true) for cookie.get/set (InMemoryCookieStore works headless)
  //   - structured error (ok=false, code=NOT_IMPLEMENTED or INTERNAL) for
  //     webview/media/anti_bot stub executors
  // http.execute is skipped for dispatch assertion because it would attempt
  // real network I/O via OHOSHTTPHostTransport (no stub); we only verify it
  // is registered (Step 2) and that dispatch reaches the handler (param
  // validation rejects the .invalid URL before any network call).
  for (let i = 0; i < LANES.length; i++) {
    const capability = LANES[i];
    const params = buildParamsForLane(capability);

    let reply: HostReply;
    try {
      reply = await adapter.dispatch(capability, params);
    } catch (e) {
      const msg = e instanceof Error ? (e as Error).message : String(e);
      r.assert(false, `dispatch: ${capability} did not throw`, `dispatch threw: ${msg}`);
      continue;
    }

    // Verify handler was reached (not "unsupported capability").
    if (!reply.ok && reply.code === 'INTERNAL' && reply.message !== undefined &&
        (reply.message as string).indexOf('unsupported capability') !== -1) {
      r.assert(
        false,
        `dispatch: ${capability} handler reached (not unsupported)`,
        `reply was "unsupported capability" — handler not registered: ${reply.message}`
      );
      continue;
    }

    r.assert(true, `dispatch: ${capability} handler reached (not unsupported)`);

    // Verify reply is structured (has ok discriminator + code/message for
    // errors, or result for success).
    if (reply.ok) {
      r.assert(
        reply.result !== undefined,
        `dispatch: ${capability} success reply has result`,
        'ok=true but result undefined'
      );
    } else {
      r.assert(
        reply.code !== undefined && (reply.code as string).length > 0,
        `dispatch: ${capability} error reply has code`,
        `ok=false but code missing (message=${reply.message})`
      );
      r.assert(
        reply.message !== undefined && (reply.message as string).length > 0,
        `dispatch: ${capability} error reply has message`,
        `ok=false but message missing (code=${reply.code})`
      );
    }
  }

  // ---------- Step 4: Verify stub executors return structured errors ----------
  // The webview / media / anti_bot lanes use ArkXxxExecutor stubs that throw
  // notImplemented. The handlers catch the stub error and return a structured
  // HostReply error. This proves the dispatch reaches the executor (not just
  // the handler's param validation layer).
  //   - webview.evaluateJavaScript → ArkWebViewExecutor throws notImplemented
  //     → handler returns code=NOT_IMPLEMENTED
  //   - media.download → ArkMediaDownloadExecutor throws Error("not implemented")
  //     → handler returns code=INTERNAL (message contains "not implemented")
  //   - anti_bot.challenge → ArkAntiBotExecutor throws notImplemented
  //     → handler returns code=NOT_IMPLEMENTED
  {
    const webviewReply: HostReply = await adapter.dispatch(
      'webview.evaluateJavaScript',
      buildParamsForLane('webview.evaluateJavaScript')
    );
    r.assert(
      !webviewReply.ok && webviewReply.code === 'NOT_IMPLEMENTED',
      'stub: webview.evaluateJavaScript returns NOT_IMPLEMENTED',
      `expected NOT_IMPLEMENTED, got code=${webviewReply.code} message=${webviewReply.message}`
    );
  }
  {
    const mediaReply: HostReply = await adapter.dispatch(
      'media.download',
      buildParamsForLane('media.download')
    );
    r.assert(
      !mediaReply.ok,
      'stub: media.download returns error (executor not implemented)',
      `expected error, got ok=${mediaReply.ok}`
    );
    if (!mediaReply.ok) {
      r.assert(
        mediaReply.message !== undefined && (mediaReply.message as string).indexOf('not implemented') !== -1,
        'stub: media.download error message mentions not implemented',
        `message=${mediaReply.message}`
      );
    }
  }
  {
    const antiBotReply: HostReply = await adapter.dispatch(
      'anti_bot.challenge',
      buildParamsForLane('anti_bot.challenge')
    );
    r.assert(
      !antiBotReply.ok && antiBotReply.code === 'NOT_IMPLEMENTED',
      'stub: anti_bot.challenge returns NOT_IMPLEMENTED',
      `expected NOT_IMPLEMENTED, got code=${antiBotReply.code} message=${antiBotReply.message}`
    );
  }

  // ---------- Step 5: Verify cookie.get/set round-trip via router dispatch ----------
  // cookie.set then cookie.get through the router should round-trip the
  // cookie via InMemoryCookieStore. This proves the router dispatches to a
  // REAL handler (not a stub) for the login_cookie lane, and that the
  // cookieStore field wired in the constructor is the same instance both
  // handlers use.
  {
    const setReply: HostReply = await adapter.dispatch(
      'cookie.set',
      buildParamsForLane('cookie.set')
    );
    r.assert(setReply.ok, 'roundtrip: cookie.set via router dispatch ok', `reply=${setReply.code}`);
    if (setReply.ok && setReply.result !== undefined) {
      const result = setReply.result as Record<string, Object>;
      r.assert(result['stored'] === true, 'roundtrip: cookie.set returns stored=true', `got ${result['stored']}`);
    }
  }
  {
    const getReply: HostReply = await adapter.dispatch(
      'cookie.get',
      buildParamsForLane('cookie.get')
    );
    r.assert(getReply.ok, 'roundtrip: cookie.get via router dispatch ok', `reply=${getReply.code}`);
    if (getReply.ok && getReply.result !== undefined) {
      const result = getReply.result as Record<string, Object>;
      const cookiesVal = result['cookies'];
      r.assert(
        cookiesVal !== undefined && Array.isArray(cookiesVal),
        'roundtrip: cookie.get returns cookies array'
      );
      if (cookiesVal !== undefined && Array.isArray(cookiesVal)) {
        const cookies = cookiesVal as Object[];
        let found = false;
        for (let i = 0; i < cookies.length; i++) {
          const c = cookies[i] as Record<string, Object>;
          if (c['name'] === 'proof') {
            found = true;
            r.assert(c['value'] === 'router-dispatch', 'roundtrip: cookie value matches', `got ${c['value']}`);
          }
        }
        r.assert(found, 'roundtrip: cookie.get returned the proof cookie set by cookie.set');
      }
    }
  }

  // NOTE: do NOT call client.close() — the singleton lifecycle is owned by
  // EntryAbility. Closing here would break subsequent app code that calls
  // ReaderCoreClient.get(). The NAPI runtime is released when the app exits.

  return r;
}

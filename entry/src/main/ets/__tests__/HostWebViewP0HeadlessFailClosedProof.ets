// HostWebViewP0HeadlessFailClosedProof — headless proof for the webview lane
// fail-closed behavior in headless mode (Phase 2 step 4b).
//
// Tier: REAL EXECUTOR (fail-closed). This proof acknowledges that headless
// mode cannot run real WebView L1-L5 (needs UI Web component binding). The
// ArkWebViewExecutor attempts real ArkWeb calls but the platform throws
// synchronously in headless mode (no Web component bound), and the executor
// returns a structured REQUIRES_UI_CONTEXT error. This is the EXPECTED and
// CORRECT behavior — it proves the executor is wired and attempting real
// ArkWeb calls, not that it can execute them without a UI context.
//
// Headless mode limitations (acknowledged in this proof):
//   - WebView L1-L5 needs UI Web component binding (headless returns
//     REQUIRES_UI_CONTEXT — not NOT_IMPLEMENTED, not a throw).
//   - No file picker UI in headless (use app sandbox pre-placed files).
//   - App-level reading chain = Core commands chain (no UI/reducer/ViewState
//     integration in headless — see AppLevelReadingChainProof.ets).
//
// Test cases:
//   1. init                  — ReaderCoreClient initialized (NAPI + handlers)
//   2. webview.dispatch      — webview.evaluateJavaScript with a real URL returns
//                              REQUIRES_UI_CONTEXT (not NOT_IMPLEMENTED, not throw)
//   3. webview.errorCode     — error reply has non-empty code + message
//   4. webview.errorMentionsUi — error message mentions "UI Web component" /
//                              "headless" / "requiresUiContext"
//
// canEnterMainline remains false — this is executor layer proof, not App-level.
// Real WebView L1-L5 requires DevEco Studio UI run + Web component binding
// (Phase 4 App-tier proof, out of scope here).

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

// A stable public URL used as the WebView document URL. In headless mode the
// executor cannot actually load this URL (no UI Web component), but it
// attempts the real ArkWeb call (controller.loadUrl) which throws
// synchronously — proving the executor is wired and the error discrimination
// path returns REQUIRES_UI_CONTEXT.
const REAL_URL = 'https://www.w3.org/';

export async function runHostWebViewP0HeadlessFailClosedProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // ---------- Step 1: Initialize ReaderCoreClient ----------
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

  // ---------- Step 2: webview.dispatch returns REQUIRES_UI_CONTEXT ----------
  // Dispatch webview.evaluateJavaScript with a real URL document. The
  // production ArkWebViewExecutor attempts controller.loadUrl(url) which
  // throws synchronously in headless mode (no UI Web component bound). The
  // executor catches the platform error and throws WebViewExecutorError with
  // kind='requires_ui_context'. The handler maps this to code='REQUIRES_UI_CONTEXT'.
  //
  // Key assertion: code === 'REQUIRES_UI_CONTEXT' (NOT 'NOT_IMPLEMENTED').
  // This proves the executor is the REAL executor (not a stub) and the error
  // discrimination path works correctly.
  let reply: HostReply;
  try {
    const document: Record<string, Object> = {} as Record<string, Object>;
    document['kind'] = 'url';
    document['url'] = REAL_URL;
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['document'] = document;
    params['javaScript'] = 'document.title';
    params['timeoutMillis'] = 5000;
    reply = await adapter.dispatch('webview.evaluateJavaScript', params);
  } catch (e) {
    const msg = e instanceof Error ? (e as Error).message : String(e);
    r.assert(
      false,
      'webview.dispatch: webview.evaluateJavaScript does not throw (returns structured error)',
      `dispatch threw: ${msg}`
    );
    return r;
  }

  r.assert(
    reply.ok === false,
    'webview.dispatch: returns error (not ok) in headless mode',
    `expected ok=false, got ok=${reply.ok}`
  );

  if (!reply.ok) {
    r.assert(
      typeof reply.code === 'string' && reply.code === 'REQUIRES_UI_CONTEXT',
      'webview.dispatch: error code === "REQUIRES_UI_CONTEXT" (real executor wired)',
      `expected REQUIRES_UI_CONTEXT, got code=${reply.code}`
    );

    r.assert(
      typeof reply.code === 'string' && reply.code !== 'NOT_IMPLEMENTED',
      'webview.dispatch: error code is NOT "NOT_IMPLEMENTED" (distinct from stub)',
      `got code=${reply.code}`
    );

    // ---------- Step 3: webview.errorCode — non-empty code + message ----------
    r.assert(
      typeof reply.code === 'string' && (reply.code as string).length > 0,
      'webview.errorCode: error reply has non-empty code',
      `got ${reply.code}`
    );
    r.assert(
      typeof reply.message === 'string' && (reply.message as string).length > 0,
      'webview.errorCode: error reply has non-empty message',
      `got ${reply.message}`
    );

    // ---------- Step 4: webview.errorMentionsUi ----------
    // The REQUIRES_UI_CONTEXT error message must mention "Web component" or
    // "headless" or "UI" — proving the error is descriptive (not a generic
    // failure). This helps debugging when the executor is reached in headless mode.
    const message = typeof reply.message === 'string' ? reply.message as string : '';
    const mentionsWebComponent = message.indexOf('Web component') !== -1;
    const mentionsHeadless = message.indexOf('headless') !== -1;
    const mentionsUI = message.indexOf('UI') !== -1;
    r.assert(
      mentionsWebComponent || mentionsHeadless || mentionsUI,
      'webview.errorMentionsUi: error message mentions Web component / headless / UI',
      `message=${message}`
    );
  }

  // NOTE: do NOT call client.close() — the singleton lifecycle is owned by
  // EntryAbility. Closing here would break subsequent app code that calls
  // ReaderCoreClient.get(). The NAPI runtime is released when the app exits.

  return r;
}

// HostWebViewRealExecutorProof — Phase 2 proof for the real ArkWebViewExecutor.
//
// Tier: REAL EXECUTOR (Phase 2). Unlike HostWebViewRenderProof (which uses
// StubWebViewExecutor for hermetic handler-layer proof), this proof exercises
// the REAL ArkWebViewExecutor that is wired in ReaderCoreClient production
// router. The executor creates a real webview.WebviewController and attempts
// to load the document — in headless mode (no UI Web component bound), the
// platform throws synchronously and the executor returns a structured
// REQUIRES_UI_CONTEXT error.
//
// What this proof verifies:
//   1. ArkWebViewExecutor.evaluate() attempts real ArkWeb calls (not a stub
//      that throws notImplemented unconditionally).
//   2. In headless mode, the executor throws WebViewExecutorError with
//      kind='requires_ui_context' — DISTINCT from kind='not_implemented'.
//   3. The handler maps requires_ui_context to code='REQUIRES_UI_CONTEXT'
//      (NOT 'NOT_IMPLEMENTED') — proving the error discrimination path works.
//   4. The production router (ReaderCoreClient.hostAdapter) dispatches to the
//      real ArkWebViewExecutor and returns REQUIRES_UI_CONTEXT.
//   5. The error message mentions "Web component" / "headless" / "UI" —
//      proving the error is descriptive (not a generic failure).
//
// canEnterMainline=false caveat (MANDATORY reading):
//   - This proof verifies the executor LAYER (real ArkWeb attempt + structured
//     error). It does NOT verify real WebView L1-L5 execution (navigate, render,
//     execute JS against real book source pages).
//   - Real ArkWeb L1-L5 requires a UI Web component bound at the page layer +
//     DevEco Studio device run — Phase 4 App-tier proof, out of scope here.
//   - The REQUIRES_UI_CONTEXT error is the EXPECTED and CORRECT behavior in
//     headless mode — it proves the executor is wired and attempting real
//     ArkWeb calls, not that it can execute them without a UI context.

import { ArkWebViewExecutor } from '../host/WebViewEvaluateJavaScriptHandler';
import {
  WebViewExecutor,
  WebViewExecutorError,
  WebViewEvaluationRequest,
  WebViewDocument,
  makeWebViewEvaluateJavaScriptHandler
} from '../host/WebViewEvaluateJavaScriptHandler';
import { HostReply } from '../host/HostReply';
import { CapabilityHandler } from '../host/CapabilityHandler';
import { ReaderCoreClient } from '../api/ReaderCoreClient';
import { HostAdapter } from '../host/HostAdapter';

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

// Helper: build a WebViewEvaluationRequest for kind="html".
function buildHtmlRequest(script: string): WebViewEvaluationRequest {
  const doc: WebViewDocument = {
    kind: 'html',
    body: '<html><body><h1>Real Executor Proof</h1></body></html>'
  } as WebViewDocument;
  return {
    document: doc,
    javaScript: script,
    timeoutMillis: 5000
  } as WebViewEvaluationRequest;
}

// Helper: build a WebViewEvaluationRequest for kind="url".
function buildUrlRequest(script: string): WebViewEvaluationRequest {
  const doc: WebViewDocument = {
    kind: 'url',
    url: 'https://example.invalid/real-executor-proof'
  } as WebViewDocument;
  return {
    document: doc,
    javaScript: script,
    timeoutMillis: 5000
  } as WebViewEvaluationRequest;
}

// Helper: build handler params for kind="html".
function buildHtmlParams(): Record<string, Object> {
  const document: Record<string, Object> = {} as Record<string, Object>;
  document['kind'] = 'html';
  document['body'] = '<html><body><h1>Real Executor Proof</h1></body></html>';
  const params: Record<string, Object> = {} as Record<string, Object>;
  params['document'] = document;
  params['javaScript'] = 'document.title';
  params['timeoutMillis'] = 5000;
  return params;
}

// Helper: build handler params for kind="url".
function buildUrlParams(): Record<string, Object> {
  const document: Record<string, Object> = {} as Record<string, Object>;
  document['kind'] = 'url';
  document['url'] = 'https://example.invalid/real-executor-proof';
  const params: Record<string, Object> = {} as Record<string, Object>;
  params['document'] = document;
  params['javaScript'] = 'document.title';
  params['timeoutMillis'] = 5000;
  return params;
}

export async function runHostWebViewRealExecutorProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // ---------- Proof 1: Direct executor — html document throws requiresUiContext ----------
  // The real ArkWebViewExecutor must attempt to load the HTML body via
  // controller.loadData(). In headless mode (no Web component bound), this
  // throws synchronously. The executor catches the platform error and throws
  // WebViewExecutorError.requiresUiContext().
  // Key assertion: kind === 'requires_ui_context' (NOT 'not_implemented').
  {
    const executor: WebViewExecutor = new ArkWebViewExecutor();
    let threw = false;
    let threwCorrectKind = false;
    let errorMsg = '';
    try {
      await executor.evaluate(buildHtmlRequest('document.title'));
    } catch (e) {
      threw = true;
      if (e instanceof WebViewExecutorError) {
        const werr = e as WebViewExecutorError;
        threwCorrectKind = werr.kind === 'requires_ui_context';
        errorMsg = werr.message;
      } else {
        errorMsg = e instanceof Error ? (e as Error).message : String(e);
      }
    }
    r.assert(threw, 'proof1: html document throws (executor attempted ArkWeb)', `did not throw`);
    r.assert(
      threwCorrectKind,
      'proof1: throws WebViewExecutorError with kind=requires_ui_context (not not_implemented)',
      `threw but wrong kind. message=${errorMsg}`
    );
  }

  // ---------- Proof 2: Direct executor — url document throws requiresUiContext ----------
  // Same as Proof 1 but for kind="url" (controller.loadUrl).
  {
    const executor: WebViewExecutor = new ArkWebViewExecutor();
    let threw = false;
    let threwCorrectKind = false;
    let errorMsg = '';
    try {
      await executor.evaluate(buildUrlRequest('document.title'));
    } catch (e) {
      threw = true;
      if (e instanceof WebViewExecutorError) {
        const werr = e as WebViewExecutorError;
        threwCorrectKind = werr.kind === 'requires_ui_context';
        errorMsg = werr.message;
      } else {
        errorMsg = e instanceof Error ? (e as Error).message : String(e);
      }
    }
    r.assert(threw, 'proof2: url document throws (executor attempted ArkWeb)', `did not throw`);
    r.assert(
      threwCorrectKind,
      'proof2: throws WebViewExecutorError with kind=requires_ui_context (not not_implemented)',
      `threw but wrong kind. message=${errorMsg}`
    );
  }

  // ---------- Proof 3: Handler maps requiresUiContext to code=REQUIRES_UI_CONTEXT ----------
  // The handler (makeWebViewEvaluateJavaScriptHandler) wired with the real
  // ArkWebViewExecutor must return a HostReply with code='REQUIRES_UI_CONTEXT'
  // (NOT 'NOT_IMPLEMENTED'). This proves the handler's error discrimination
  // path maps the new 'requires_ui_context' kind correctly.
  {
    const executor: WebViewExecutor = new ArkWebViewExecutor();
    const handler: CapabilityHandler = makeWebViewEvaluateJavaScriptHandler(executor);
    const reply: HostReply = await handler(buildHtmlParams());

    r.assert(
      !reply.ok,
      'proof3: handler reply is error (not ok)',
      `expected error, got ok=${reply.ok}`
    );
    if (!reply.ok) {
      r.assert(
        typeof reply.code === 'string' && reply.code === 'REQUIRES_UI_CONTEXT',
        'proof3: error code === "REQUIRES_UI_CONTEXT"',
        `expected REQUIRES_UI_CONTEXT, got code=${reply.code}`
      );
      r.assert(
        typeof reply.code === 'string' && reply.code !== 'NOT_IMPLEMENTED',
        'proof3: error code is NOT "NOT_IMPLEMENTED" (distinct from stub)',
        `got code=${reply.code}`
      );
    }
  }

  // ---------- Proof 4: Handler — url document returns REQUIRES_UI_CONTEXT ----------
  {
    const executor: WebViewExecutor = new ArkWebViewExecutor();
    const handler: CapabilityHandler = makeWebViewEvaluateJavaScriptHandler(executor);
    const reply: HostReply = await handler(buildUrlParams());

    r.assert(
      !reply.ok,
      'proof4: handler reply is error (not ok) for url document',
      `expected error, got ok=${reply.ok}`
    );
    if (!reply.ok) {
      r.assert(
        typeof reply.code === 'string' && reply.code === 'REQUIRES_UI_CONTEXT',
        'proof4: error code === "REQUIRES_UI_CONTEXT" for url document',
        `expected REQUIRES_UI_CONTEXT, got code=${reply.code}`
      );
    }
  }

  // ---------- Proof 5: Error message is descriptive ----------
  // The REQUIRES_UI_CONTEXT error message must mention "Web component" or
  // "headless" or "UI" — proving the error is descriptive (not a generic
  // failure). This helps debugging when the executor is reached in headless mode.
  {
    const executor: WebViewExecutor = new ArkWebViewExecutor();
    let message = '';
    try {
      await executor.evaluate(buildHtmlRequest('document.title'));
    } catch (e) {
      if (e instanceof WebViewExecutorError) {
        message = (e as WebViewExecutorError).message;
        const cause = (e as WebViewExecutorError).cause;
        if (cause !== undefined) {
          message = message + ' ' + cause;
        }
      } else {
        message = e instanceof Error ? (e as Error).message : String(e);
      }
    }
    const mentionsWebComponent = message.indexOf('Web component') !== -1;
    const mentionsHeadless = message.indexOf('headless') !== -1;
    const mentionsUI = message.indexOf('UI') !== -1;
    r.assert(
      mentionsWebComponent || mentionsHeadless || mentionsUI,
      'proof5: error message mentions Web component / headless / UI',
      `message=${message}`
    );
  }

  // ---------- Proof 6: Production router dispatch returns REQUIRES_UI_CONTEXT ----------
  // The production router (ReaderCoreClient.hostAdapter) has the real
  // ArkWebViewExecutor wired (see ReaderCoreClient constructor line 64).
  // Dispatching webview.evaluateJavaScript through the router must reach the
  // real executor (not a stub) and return code='REQUIRES_UI_CONTEXT'.
  // This proves the production wiring is correct.
  // Requires NAPI bridge (DevEco/device) — gracefully handles init failure.
  let client: ReaderCoreClient;
  let napiAvailable = true;
  try {
    if (ReaderCoreClient.isInitialized()) {
      client = ReaderCoreClient.get();
    } else {
      client = ReaderCoreClient.init();
    }
  } catch (_e) {
    napiAvailable = false;
  }

  if (!napiAvailable) {
    r.assert(
      false,
      'proof6: ReaderCoreClient.init() loads NAPI (requires DevEco/device)',
      'NAPI module not loaded — skip router dispatch proof'
    );
  } else {
    const adapter: HostAdapter = client!.hostAdapter;
    r.assert(
      adapter.isRegistered('webview.evaluateJavaScript'),
      'proof6: webview.evaluateJavaScript registered in production router'
    );

    const reply: HostReply = await adapter.dispatch(
      'webview.evaluateJavaScript',
      buildHtmlParams()
    );
    r.assert(
      !reply.ok,
      'proof6: production router dispatch returns error (not ok)',
      `expected error, got ok=${reply.ok}`
    );
    if (!reply.ok) {
      r.assert(
        typeof reply.code === 'string' && reply.code === 'REQUIRES_UI_CONTEXT',
        'proof6: production router returns code=REQUIRES_UI_CONTEXT (real executor wired)',
        `expected REQUIRES_UI_CONTEXT, got code=${reply.code} message=${reply.message}`
      );
      r.assert(
        typeof reply.code === 'string' && reply.code !== 'NOT_IMPLEMENTED',
        'proof6: production router returns NOT NOT_IMPLEMENTED (real executor, not stub)',
        `got code=${reply.code}`
      );
    }
  }

  // NOTE: do NOT call client.close() — the singleton lifecycle is owned by
  // EntryAbility. Closing here would break subsequent app code that calls
  // ReaderCoreClient.get(). The NAPI runtime is released when the app exits.

  return r;
}

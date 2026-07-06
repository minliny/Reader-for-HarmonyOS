// HostWebViewRenderProof — headless proof for the webview_render lane (item 2c).
//
// Tier: HANDLER/ROUTER. Mirrors HostLoginCookieProof.ets pattern: calls the
// capability handler directly with StubWebViewExecutor (no libreader_core_napi.so,
// no HostRuntime/HostAdapter dispatch, no real ArkWeb runtime).
//
// (1) This is handler/router tier proof — verifies the handler-layer plumbing
//     (request parsing, document kind validation, executor delegation, response
//     building, error discrimination) against the Core contract in
//     crates/reader-contract/src/host.rs (lines 679-820).
//
// (2) Device-headless/App tier (real ArkWeb L1-L5) requires a Web component
//     bound at the page layer + DevEco Studio emulator — pending device proof,
//     out of scope for this increment.
//
// (3) Mirrors iOS/Android proof structure: Android HostWebViewRenderProofTest.kt
//     and iOS HostWebViewRenderProofTests.swift use the same stub-executor +
//     canned-result approach for handler/router parity.
//
// (4) WHY stub executor (not real ArkWeb): headless proof verifies handler-layer
//     plumbing without depending on the device ArkWeb runtime. The
//     ArkWebViewExecutor (production) throws not_implemented — the real ArkWeb
//     backend will be wired in a future increment via ArkWebPlatformAdapter.
//     The stub executor lets us prove the handler honours the JSON contract
//     (document kind validation, executor delegation, response threading, error
//     discrimination) the same way StubHostTransport proves the http.execute
//     handler without real network I/O.

import { makeWebViewEvaluateJavaScriptHandler } from '../host/WebViewEvaluateJavaScriptHandler';
import {
  WebViewExecutor,
  WebViewEvaluationResult,
  WebViewExecutorError,
  StubWebViewExecutor
} from '../host/WebViewEvaluateJavaScriptHandler';
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

export async function runHostWebViewRenderProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // ---------- Proof 1: webViewEvaluatesJavaScriptReturnsValue ----------
  // StubWebViewExecutor returns value="hello from JS", finalUrl=".../rendered",
  // title="Rendered Page". Handler is called with document.kind="html",
  // document.body="<html>...</html>", javaScript="document.body.innerText".
  // Assert reply ok, result.value === "hello from JS", finalUrl ends with
  // "/rendered", title === "Rendered Page".
  {
    const stubResult: WebViewEvaluationResult = {
      value: 'hello from JS',
      finalUrl: 'https://example.test/rendered',
      title: 'Rendered Page'
    } as WebViewEvaluationResult;
    const executor: WebViewExecutor = new StubWebViewExecutor(stubResult);
    const handler: CapabilityHandler = makeWebViewEvaluateJavaScriptHandler(executor);

    const document: Record<string, Object> = {} as Record<string, Object>;
    document['kind'] = 'html';
    document['body'] = '<html><body>test</body></html>';
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['document'] = document;
    params['javaScript'] = 'document.body.innerText';
    const reply: HostReply = await handler(params);

    r.assert(reply.ok === true, 'proof1: webview.evaluateJavaScript reply ok');
    if (!reply.ok || reply.result === undefined) {
      r.assert(false, 'proof1: result present', 'reply not ok or missing result');
    } else {
      const result = reply.result as Record<string, Object>;
      const valueVal = result['value'];
      const finalUrlVal = result['finalUrl'];
      const titleVal = result['title'];
      r.assert(
        typeof valueVal === 'string' && valueVal === 'hello from JS',
        'proof1: value === "hello from JS"',
        `got ${valueVal}`
      );
      r.assert(
        typeof finalUrlVal === 'string' && (finalUrlVal as string).endsWith('/rendered'),
        'proof1: finalUrl ends with /rendered',
        `got ${finalUrlVal}`
      );
      r.assert(
        typeof titleVal === 'string' && titleVal === 'Rendered Page',
        'proof1: title === "Rendered Page"',
        `got ${titleVal}`
      );
    }
  }

  // ---------- Proof 2: webViewLoadsUrlAndReturnsDom ----------
  // StubWebViewExecutor returns value="<html>rendered</html>", finalUrl=".../final".
  // Handler is called with document.kind="url", document.url="https://example.test/start",
  // javaScript="document.documentElement.outerHTML".
  // Assert reply ok, result.value contains "rendered", finalUrl ends with "/final".
  {
    const stubResult: WebViewEvaluationResult = {
      value: '<html>rendered</html>',
      finalUrl: 'https://example.test/final'
    } as WebViewEvaluationResult;
    const executor: WebViewExecutor = new StubWebViewExecutor(stubResult);
    const handler: CapabilityHandler = makeWebViewEvaluateJavaScriptHandler(executor);

    const document: Record<string, Object> = {} as Record<string, Object>;
    document['kind'] = 'url';
    document['url'] = 'https://example.test/start';
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['document'] = document;
    params['javaScript'] = 'document.documentElement.outerHTML';
    const reply: HostReply = await handler(params);

    r.assert(reply.ok === true, 'proof2: webview.evaluateJavaScript reply ok');
    if (!reply.ok || reply.result === undefined) {
      r.assert(false, 'proof2: result present', 'reply not ok or missing result');
    } else {
      const result = reply.result as Record<string, Object>;
      const valueVal = result['value'];
      const finalUrlVal = result['finalUrl'];
      r.assert(
        typeof valueVal === 'string' && (valueVal as string).includes('rendered'),
        'proof2: value contains "rendered"',
        `got ${valueVal}`
      );
      r.assert(
        typeof finalUrlVal === 'string' && (finalUrlVal as string).endsWith('/final'),
        'proof2: finalUrl ends with /final',
        `got ${finalUrlVal}`
      );
    }
  }

  // ---------- Proof 3: webViewEvaluatesJavaScriptTimeoutFailsClosed ----------
  // StubWebViewExecutor throws WebViewExecutorError.timeout(5000). Handler is
  // called with document.kind="url", document.url="https://slow.test/",
  // javaScript="document.body", timeoutMillis=5000.
  // Assert reply is error (not ok) AND the error code is TIMEOUT (distinguishes
  // timeout from other failures like execution_failed or internal).
  {
    const executor: WebViewExecutor = new StubWebViewExecutor(
      undefined,
      WebViewExecutorError.timeout(5000)
    );
    const handler: CapabilityHandler = makeWebViewEvaluateJavaScriptHandler(executor);

    const document: Record<string, Object> = {} as Record<string, Object>;
    document['kind'] = 'url';
    document['url'] = 'https://slow.test/';
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['document'] = document;
    params['javaScript'] = 'document.body';
    params['timeoutMillis'] = 5000;
    const reply: HostReply = await handler(params);

    r.assert(reply.ok === false, 'proof3: webview.evaluateJavaScript reply is error (not ok)');
    if (reply.ok) {
      r.assert(false, 'proof3: expected error reply', 'got ok reply');
    } else {
      const codeVal = reply.code;
      r.assert(
        typeof codeVal === 'string' && codeVal === 'TIMEOUT',
        'proof3: error code === "TIMEOUT" (distinguishes timeout from other failures)',
        `got ${codeVal}`
      );
      r.assert(
        reply.retryable === true,
        'proof3: timeout is retryable',
        `got retryable=${reply.retryable}`
      );
    }
  }

  // ---------- Validation 1: webViewRejectsHtmlDocumentWithUrl ----------
  // document.kind="html" with document.url present should return error reply
  // (html documents must not include url — mirrors host.rs:719-724).
  {
    const executor: WebViewExecutor = new StubWebViewExecutor();
    const handler: CapabilityHandler = makeWebViewEvaluateJavaScriptHandler(executor);

    const document: Record<string, Object> = {} as Record<string, Object>;
    document['kind'] = 'html';
    document['body'] = '<html><body>test</body></html>';
    document['url'] = 'https://example.test/should-not-be-here';
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['document'] = document;
    params['javaScript'] = 'document.body.innerText';
    const reply: HostReply = await handler(params);

    r.assert(
      reply.ok === false,
      'validation1: html document with url rejected (not ok)'
    );
    if (!reply.ok) {
      r.assert(
        typeof reply.code === 'string' && reply.code === 'INVALID_ARGUMENT',
        'validation1: error code === "INVALID_ARGUMENT"',
        `got ${reply.code}`
      );
    }
  }

  // ---------- Validation 2: webViewRejectsUrlDocumentWithBody ----------
  // document.kind="url" with document.body present should return error reply
  // (url documents must not include body — mirrors host.rs:739-744).
  {
    const executor: WebViewExecutor = new StubWebViewExecutor();
    const handler: CapabilityHandler = makeWebViewEvaluateJavaScriptHandler(executor);

    const document: Record<string, Object> = {} as Record<string, Object>;
    document['kind'] = 'url';
    document['url'] = 'https://example.test/start';
    document['body'] = '<html><body>should-not-be-here</body></html>';
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['document'] = document;
    params['javaScript'] = 'document.documentElement.outerHTML';
    const reply: HostReply = await handler(params);

    r.assert(
      reply.ok === false,
      'validation2: url document with body rejected (not ok)'
    );
    if (!reply.ok) {
      r.assert(
        typeof reply.code === 'string' && reply.code === 'INVALID_ARGUMENT',
        'validation2: error code === "INVALID_ARGUMENT"',
        `got ${reply.code}`
      );
    }
  }

  return r;
}

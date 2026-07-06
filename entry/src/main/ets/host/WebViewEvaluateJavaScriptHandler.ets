// WebViewEvaluateJavaScriptHandler — handles the 'webview.evaluateJavaScript'
// capability.
//
// Mirrors the Core contract in crates/reader-contract/src/host.rs (lines
// 679-820). Core emits host.request with capability='webview.evaluateJavaScript'
// and params matching HostWebViewEvaluateJavaScriptRequest; this handler
// validates the params, delegates to a WebViewExecutor, and wraps the
// WebViewEvaluationResult as HostReplySuccess.result (for host.complete).
//
// JSON contract (aligned with Core host.rs):
//   request  params : {document: {kind: "html"|"url", body?, url?, baseUrl?},
//                      javaScript: string, timeoutMillis?: number, profileId?: string}
//   result          : {value: any, finalUrl?: string, title?: string}
//
// The host owns the WebView runtime — Core never touches the platform WebView
// directly (charter §4 / §10.2). The executor abstraction lets the handler be
// proven headless via StubWebViewExecutor while production wires a real ArkWeb
// backend (future increment; ArkWebPlatformAdapter.ets operates on a live
// controller and is a separate abstraction).
//
// Mirrors Android bindings/android/.../WebViewEvaluateJavaScriptHandler and
// Swift WebViewEvaluateJavaScriptHandler (3/3 parity target for the
// webview_render lane).
import { CapabilityHandler } from './CapabilityHandler';
import { HostReply, hostReplySuccess, hostReplyError } from './HostReply';

export const WEBVIEW_EVALUATE_JAVASCRIPT_CAPABILITY = 'webview.evaluateJavaScript';

// Document kind: "html" loads the body string as the document; "url" navigates
// to the URL. Mirrors HostWebViewDocumentKind in host.rs (lines 680-685).
export type WebViewDocumentKind = 'html' | 'url';

// Document input mirroring HostWebViewDocument (host.rs:692-702).
// kind="html": body required (non-blank), url must NOT be present, baseUrl optional.
// kind="url": url required (non-blank), body and baseUrl must NOT be present.
export interface WebViewDocument {
  kind: WebViewDocumentKind;
  body?: string;
  url?: string;
  baseUrl?: string;
}

// Request mirroring HostWebViewEvaluateJavaScriptRequest (host.rs:758-767).
export interface WebViewEvaluationRequest {
  document: WebViewDocument;
  javaScript: string;
  timeoutMillis?: number;
  profileId?: string;
}

// Result mirroring HostWebViewEvaluateJavaScriptResponse (host.rs:795-803).
// value is any JSON value (default null when the script returns nothing).
export interface WebViewEvaluationResult {
  value: Object | string | number | boolean | null;
  finalUrl?: string;
  title?: string;
}

// Executor abstraction — production wires ArkWebViewExecutor (or a future
// ArkWebPlatformAdapter-backed executor); tests wire StubWebViewExecutor.
// Mirrors HostTransport for the http.execute lane.
export interface WebViewExecutor {
  evaluate(request: WebViewEvaluationRequest): Promise<WebViewEvaluationResult>;
}

// Structured executor error. Mirrors the error categories Core distinguishes:
// - timeout: executor exceeded timeoutMillis (retryable)
// - not_implemented: host cannot serve webview.evaluateJavaScript (e.g. ArkWeb
//   not yet wired) — Core should fail-closed via HostCapabilityManifest
// - execution_failed: ArkWeb ran but the script/parse failed (retryable case-by-case)
//
// Extends Error to satisfy arkts-limited-throw (SDK 6.0 strict mode requires
// `throw` operands to be Error subclasses). Instance checks still use
// `instanceof WebViewExecutorError`.
export class WebViewExecutorError extends Error {
  readonly kind: string;
  readonly timeoutMillis?: number;
  readonly cause?: string;

  private constructor(kind: string, message: string, timeoutMillis?: number, cause?: string) {
    super(message);
    this.kind = kind;
    this.name = 'WebViewExecutorError';
    this.timeoutMillis = timeoutMillis;
    this.cause = cause;
  }

  static timeout(timeoutMillis: number): WebViewExecutorError {
    return new WebViewExecutorError(
      'timeout',
      `webview.evaluateJavaScript timed out after ${timeoutMillis}ms`,
      timeoutMillis
    );
  }

  static notImplemented(): WebViewExecutorError {
    return new WebViewExecutorError(
      'not_implemented',
      'webview.evaluateJavaScript executor not implemented (ArkWeb backend pending)'
    );
  }

  static executionFailed(cause: string): WebViewExecutorError {
    return new WebViewExecutorError(
      'execution_failed',
      `webview.evaluateJavaScript execution failed: ${cause}`,
      undefined,
      cause
    );
  }
}

// StubWebViewExecutor — hermetic canned-response executor for proof tests.
// Returns the configured result on every evaluate() call, or throws the
// configured error. Mirrors StubHostTransport in HostLoginCookieProof.ets.
export class StubWebViewExecutor implements WebViewExecutor {
  private result: WebViewEvaluationResult | null;
  private error: WebViewExecutorError | null;

  constructor(result?: WebViewEvaluationResult, error?: WebViewExecutorError) {
    this.result = result ?? null;
    this.error = error ?? null;
  }

  async evaluate(_request: WebViewEvaluationRequest): Promise<WebViewEvaluationResult> {
    if (this.error !== null) {
      throw this.error as WebViewExecutorError;
    }
    if (this.result === null) {
      // Default: null value (matches Core's default for
      // HostWebViewEvaluateJavaScriptResponse.value).
      return { value: null } as WebViewEvaluationResult;
    }
    return this.result as WebViewEvaluationResult;
  }
}

// ArkWebViewExecutor — production placeholder. Throws not_implemented because
// real ArkWeb execution requires a Web component bound at the page layer
// (ArkWebPlatformAdapter.ets operates on a live controller). The
// handler/router proof uses StubWebViewExecutor; the device-headless/App tier
// (real ArkWeb L1-L5) will wire a live controller in a future increment.
export class ArkWebViewExecutor implements WebViewExecutor {
  async evaluate(_request: WebViewEvaluationRequest): Promise<WebViewEvaluationResult> {
    throw WebViewExecutorError.notImplemented();
  }
}

// Factory: makeWebViewEvaluateJavaScriptHandler
// Mirrors makeHttpExecuteHandler / makeCookieGetHandler: takes the executor
// dependency, returns a CapabilityHandler that validates params, calls the
// executor, and builds the HostReply.
export function makeWebViewEvaluateJavaScriptHandler(executor: WebViewExecutor): CapabilityHandler {
  const handler: CapabilityHandler = async (params: Record<string, Object>): Promise<HostReply> => {
    // 1. Parse + validate document
    const documentObj = params['document'];
    if (documentObj === null || documentObj === undefined || typeof documentObj !== 'object') {
      return hostReplyError(
        'INVALID_ARGUMENT',
        'webview.evaluateJavaScript requires document object',
        false
      );
    }
    const document = documentObj as Record<string, Object>;
    const kindValue = document['kind'];
    if (typeof kindValue !== 'string') {
      return hostReplyError(
        'INVALID_ARGUMENT',
        'webview.evaluateJavaScript document.kind must be a string',
        false
      );
    }
    const kind = kindValue as string;
    if (kind !== 'html' && kind !== 'url') {
      return hostReplyError(
        'INVALID_ARGUMENT',
        `webview.evaluateJavaScript document.kind must be "html" or "url" (got "${kind}")`,
        false
      );
    }
    const bodyValue = document['body'];
    const urlValue = document['url'];
    const baseUrlValue = document['baseUrl'];

    if (kind === 'html') {
      // body required (non-blank), url must NOT be present, baseUrl optional
      if (typeof bodyValue !== 'string' || (bodyValue as string).length === 0) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'webview.evaluateJavaScript html document requires non-blank body',
          false
        );
      }
      if (urlValue !== null && urlValue !== undefined) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'webview.evaluateJavaScript html document must not include url',
          false
        );
      }
      if (
        baseUrlValue !== null &&
        baseUrlValue !== undefined &&
        typeof baseUrlValue !== 'string'
      ) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'webview.evaluateJavaScript html document baseUrl must be a string',
          false
        );
      }
    } else {
      // kind === 'url': url required (non-blank), body and baseUrl must NOT be present
      if (typeof urlValue !== 'string' || (urlValue as string).length === 0) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'webview.evaluateJavaScript url document requires non-blank url',
          false
        );
      }
      if (bodyValue !== null && bodyValue !== undefined) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'webview.evaluateJavaScript url document must not include body',
          false
        );
      }
      if (baseUrlValue !== null && baseUrlValue !== undefined) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'webview.evaluateJavaScript url document must not include baseUrl',
          false
        );
      }
    }

    // 2. Parse + validate javaScript (required, non-blank)
    const javaScriptValue = params['javaScript'];
    if (typeof javaScriptValue !== 'string' || (javaScriptValue as string).length === 0) {
      return hostReplyError(
        'INVALID_ARGUMENT',
        'webview.evaluateJavaScript requires non-blank javaScript',
        false
      );
    }

    // 3. Parse + validate timeoutMillis (optional, must be > 0)
    const timeoutMillisValue = params['timeoutMillis'];
    let timeoutMillis: number | undefined = undefined;
    if (timeoutMillisValue !== null && timeoutMillisValue !== undefined) {
      if (typeof timeoutMillisValue !== 'number') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'webview.evaluateJavaScript timeoutMillis must be a number',
          false
        );
      }
      const tm = timeoutMillisValue as number;
      if (tm <= 0) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'webview.evaluateJavaScript timeoutMillis must be greater than 0',
          false
        );
      }
      timeoutMillis = tm;
    }

    // 4. Parse + validate profileId (optional, non-blank)
    const profileIdValue = params['profileId'];
    let profileId: string | undefined = undefined;
    if (profileIdValue !== null && profileIdValue !== undefined) {
      if (typeof profileIdValue !== 'string') {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'webview.evaluateJavaScript profileId must be a string',
          false
        );
      }
      const pid = profileIdValue as string;
      if (pid.length === 0) {
        return hostReplyError(
          'INVALID_ARGUMENT',
          'webview.evaluateJavaScript profileId must be non-blank',
          false
        );
      }
      profileId = pid;
    }

    // 5. Build the WebViewEvaluationRequest for the executor
    const evalDocument: WebViewDocument = {
      kind: kind as WebViewDocumentKind,
      body: typeof bodyValue === 'string' ? bodyValue as string : undefined,
      url: typeof urlValue === 'string' ? urlValue as string : undefined,
      baseUrl: typeof baseUrlValue === 'string' ? baseUrlValue as string : undefined
    } as WebViewDocument;
    const evalRequest: WebViewEvaluationRequest = {
      document: evalDocument,
      javaScript: javaScriptValue as string,
      timeoutMillis: timeoutMillis,
      profileId: profileId
    } as WebViewEvaluationRequest;

    // 6. Call the executor + build the response
    try {
      const evalResult: WebViewEvaluationResult = await executor.evaluate(evalRequest);
      // SDK-COMPAT: build result via typed record to satisfy arkts-no-untyped-obj-literals.
      const result: Record<string, Object> = {} as Record<string, Object>;
      // value type is `Object | string | number | boolean | null`; direct cast
      // satisfies arkts strict mode (no null-as-Object conversion needed).
      result['value'] = evalResult.value as Object;
      if (evalResult.finalUrl !== undefined && evalResult.finalUrl !== null) {
        result['finalUrl'] = evalResult.finalUrl as Object;
      }
      if (evalResult.title !== undefined && evalResult.title !== null) {
        result['title'] = evalResult.title as Object;
      }
      return hostReplySuccess(result);
    } catch (e) {
      // Distinguish timeout / not-implemented / execution-failed so Core can
      // fail-closed with the right error code (mirrors host.rs validation).
      if (e instanceof WebViewExecutorError) {
        const werr = e as WebViewExecutorError;
        if (werr.kind === 'timeout') {
          return hostReplyError('TIMEOUT', werr.message, true);
        }
        if (werr.kind === 'not_implemented') {
          return hostReplyError('NOT_IMPLEMENTED', werr.message, false);
        }
        return hostReplyError('EXECUTION_FAILED', werr.message, true);
      }
      // Unknown error — treat as internal/execution failure
      return hostReplyError('INTERNAL', `webview.evaluateJavaScript failed: ${e}`, true);
    }
  };
  return handler;
}

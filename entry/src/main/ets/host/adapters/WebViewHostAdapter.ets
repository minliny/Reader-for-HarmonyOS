// WebViewHostAdapter — Host adapter for webview.evaluateJavaScript,
// webview.open, webview.close, webview.evaluate.
//
// Sources of truth:
//   - Core closed-set: `webview.evaluateJavaScript` (host.rs HostCapability).
//   - UI Contract: `webview.open`, `webview.close`, `webview.evaluate`
//     (host-request.schema.json — UI-Contract-only).
//
// Design: HarmonyOS Web components are UI-layer owned. The Web()/controller
// attachment happens in ArkUI page components. This adapter exposes a
// controller registry: the UI layer registers a `WebviewController` when it
// creates a Web component, and HostDispatcher routes script-execution
// capabilities to the right controller by profileId.
//
// `webview.open` / `webview.close` are cooperative: the adapter tracks the
// open/close state per profileId, but the actual Web component lifecycle is
// driven by the UI layer (which calls registerController on create and
// unregisterController on destroy). open() / close() here only manage the
// bookkeeping and call into the controller's access interfaces where possible.
//
// Error mapping: timeout → WEBVIEW_TIMEOUT, everything else → WEBVIEW_SCRIPT_ERROR.
// When timeoutMillis is provided (>0), a manual Promise.race deadline is applied
// because HarmonyOS runJavaScript has no built-in timeout.
import webview from '@ohos.web.webview';
import {
  HostWebViewEvaluateJavaScriptRequest,
  HostWebViewEvaluateJavaScriptResponse,
  HostWebViewOpenRequest,
  HostWebViewOpenResponse,
  HostWebViewCloseRequest,
  HostWebViewCloseResponse,
  HostWebViewEvaluateRequest,
  HostWebViewEvaluateResponse,
  HostError,
  HostErrorWrapper,
  createWebViewTimeoutError,
} from '../types';

const DEFAULT_PROFILE_ID: string = 'default';

interface ErrorLike {
  message?: string;
  code?: number;
}

interface WebViewProfileEntry {
  controller: webview.WebviewController;
  url: string;
  open: boolean;
}

export class WebViewHostAdapter {
  private profiles: Map<string, WebViewProfileEntry> = new Map<string, WebViewProfileEntry>();

  // ── Controller lifecycle (called by UI layer) ──

  registerController(profileId: string, controller: webview.WebviewController): void {
    const existing = this.profiles.get(profileId);
    if (existing !== undefined) {
      existing.controller = controller;
      return;
    }
    const entry: WebViewProfileEntry = {
      controller: controller,
      url: '',
      open: false,
    };
    this.profiles.set(profileId, entry);
  }

  unregisterController(profileId: string): void {
    this.profiles.delete(profileId);
  }

  hasController(profileId: string): boolean {
    return this.profiles.has(profileId);
  }

  // ── webview.open (UI Contract) ──

  /**
   * webview.open — mark a profile as open and record the URL.
   * The UI layer must have already registered a controller for this profileId
   * (by creating a Web component). open() sets the entry's url + open flag.
   *
   * If no controller is registered, returns opened: false — the UI layer must
   * create the Web component first. This is a cooperative open: the adapter
   * does not create Web components itself.
   */
  async open(request: HostWebViewOpenRequest): Promise<HostWebViewOpenResponse> {
    const profileId = request.profileId ?? DEFAULT_PROFILE_ID;
    const entry = this.profiles.get(profileId);
    if (entry === undefined) {
      return { opened: false };
    }
    entry.url = request.url;
    entry.open = true;
    return { opened: true, profileId: profileId };
  }

  // ── webview.close (UI Contract) ──

  /**
   * webview.close — mark a profile as closed.
   * Does NOT destroy the Web component (the UI layer owns that). close() only
   * clears the open flag; the controller stays registered so the UI layer can
   * cleanly dispose of it.
   */
  async close(request?: HostWebViewCloseRequest): Promise<HostWebViewCloseResponse> {
    const profileId = request?.profileId ?? DEFAULT_PROFILE_ID;
    const entry = this.profiles.get(profileId);
    if (entry === undefined) {
      return { closed: false };
    }
    entry.open = false;
    return { closed: true };
  }

  // ── webview.evaluate (UI Contract) ──

  /**
   * webview.evaluate — run a script on the profile's controller and return
   * the result object. Same as evaluateJavaScript but with a different
   * capability name in the UI Contract.
   */
  async evaluate(request: HostWebViewEvaluateRequest): Promise<HostWebViewEvaluateResponse> {
    const profileId = request.profileId ?? DEFAULT_PROFILE_ID;
    const entry = this.profiles.get(profileId);
    if (entry === undefined) {
      const err: HostError = {
        code: 'WEBVIEW_SCRIPT_ERROR',
        message: `No webview controller registered for profileId: ${profileId}`,
        retryable: false,
        details: { phase: 'Script' },
      };
      throw new HostErrorWrapper(err);
    }
    try {
      await entry.controller.runJavaScript(request.script);
      const result: Record<string, Object> = {};
      return { result: result };
    } catch (e) {
      const err = e as ErrorLike;
      const scriptError: HostError = {
        code: 'WEBVIEW_SCRIPT_ERROR',
        message: err.message ?? 'webview evaluate error',
        retryable: false,
        details: { phase: 'Script', script: request.script },
      };
      throw new HostErrorWrapper(scriptError);
    }
  }

  // ── webview.evaluateJavaScript (Core closed-set) ──

  async evaluateJavaScript(
    event: HostWebViewEvaluateJavaScriptRequest
  ): Promise<HostWebViewEvaluateJavaScriptResponse> {
    const profileId = event.profileId ?? DEFAULT_PROFILE_ID;
    const entry = this.profiles.get(profileId);
    if (entry === undefined) {
      const err: HostError = {
        code: 'WEBVIEW_SCRIPT_ERROR',
        message: `No webview controller registered for profileId: ${profileId}`,
        retryable: false,
        details: { phase: 'Script' },
      };
      throw new HostErrorWrapper(err);
    }

    const timeoutMs = event.timeoutMillis ?? 0;
    try {
      if (timeoutMs > 0) {
        await this.raceWithTimeout(entry.controller, event.javaScript, timeoutMs);
      } else {
        await entry.controller.runJavaScript(event.javaScript);
      }
      const result: Record<string, Object> = {};
      const response: HostWebViewEvaluateJavaScriptResponse = {
        value: result,
      };
      return response;
    } catch (e) {
      const err = e as ErrorLike;
      const message = err.message ?? 'webview script error';
      if (message.includes('timed out') || message.includes('timeout')) {
        throw new HostErrorWrapper(createWebViewTimeoutError(event.document.url ?? event.document.body ?? event.document.kind, timeoutMs));
      }
      const scriptError: HostError = {
        code: 'WEBVIEW_SCRIPT_ERROR',
        message: message,
        retryable: false,
        details: { phase: 'Script', script: event.javaScript },
      };
      throw new HostErrorWrapper(scriptError);
    }
  }

  // ── internal ──

  private raceWithTimeout(
    controller: webview.WebviewController,
    script: string,
    timeoutMs: number
  ): Promise<void> {
    const runPromise: Promise<void> = controller.runJavaScript(script).then((): void => {});
    const timeoutPromise = new Promise<void>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`webview script timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    return Promise.race<void>([runPromise, timeoutPromise]);
  }
}

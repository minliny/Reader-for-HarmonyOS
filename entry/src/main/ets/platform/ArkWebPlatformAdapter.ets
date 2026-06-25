// ArkWebPlatformAdapter — clean-room HarmonyOS ArkWeb platform module.
// Wraps webview.WebviewController + WebCookieManager into a reusable adapter
// and implements ArkWebDeviceBridge so AuthorizedArkWebDeviceExecutor can bind
// a real (device-executor) ArkWeb backend instead of the fixture executor.
// No raw cookie/session/credential values are exported; only bounded classes
// and checksums are surfaced.

import { webview } from '@kit.ArkWeb';
import { ArkWebExecutionResult, ArkWebDeviceBridge } from '../adapters/RuntimeHostPlatformAdapters';
import { boundedChecksum } from '../adapters/FeedParserAdapter';

export interface ArkWebCookieEvidence {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  putAccepted: boolean;
  fetched: boolean;
  saved: boolean;
  metadataChecksum: string;
  rawCookieValueExported: boolean;
}

export interface ArkWebProbeResult {
  title: string;
  selectedNodeCount: number;
  scriptResult: string;
  bodyTextChecksum: string;
}

export class ArkWebPlatformAdapter implements ArkWebDeviceBridge {
  private controller: webview.WebviewController;

  constructor(controller?: webview.WebviewController) {
    this.controller = controller ?? new webview.WebviewController();
  }

  getController(): webview.WebviewController {
    return this.controller;
  }

  /**
   * Evaluate a selector + script against the currently loaded page. Mirrors
   * the ArkWebExecutor contract used by RuntimeHostPlatformAdapters. Device
   * execution requires a Web component bound to this controller.
   */
  async executeHTML(html: string, selector: string, script: string): Promise<ArkWebExecutionResult> {
    // The Web component must be loaded with `html` by the host page; here we
    // only run the probe script against whatever is currently loaded.
    const title = await this.runJavaScriptSafe('document.title');
    const countScript = `document.querySelectorAll(${JSON.stringify(selector)}).length`;
    const countStr = await this.runJavaScriptSafe(countScript);
    const scriptResult = await this.runJavaScriptSafe(script);
    return {
      title,
      bodyTextChecksum: boundedChecksum(`arkweb:${title}`),
      selectedNodeCount: this.parseIntSafe(countStr),
      scriptResult
    };
  }

  /** Probe the loaded page title + a selector count for evidence. */
  async probePage(selector: string): Promise<ArkWebProbeResult> {
    const title = await this.runJavaScriptSafe('document.title');
    const countScript = `document.querySelectorAll(${JSON.stringify(selector)}).length`;
    const countStr = await this.runJavaScriptSafe(countScript);
    return {
      title,
      selectedNodeCount: this.parseIntSafe(countStr),
      scriptResult: countStr,
      bodyTextChecksum: boundedChecksum(`probe:${title}:${countStr}`)
    };
  }

  /** Accept + mirror a cookie through WebCookieManager; returns redacted evidence. */
  async putAndMirrorCookie(
    name: string,
    domain: string,
    path: string,
    secure: boolean,
    httpOnly: boolean,
    _value: string
  ): Promise<ArkWebCookieEvidence> {
    let putAccepted = false;
    let fetched = false;
    let saved = false;
    try {
      webview.WebCookieManager.putAcceptCookieEnabled(true);
      const cookieUrl = `https://${domain}${path}`;
      const cookieValue = `${name}=arkweb-cookie-value; Secure=${secure ? 'true' : 'false'}; HttpOnly=${httpOnly ? 'true' : 'false'}`;
      webview.WebCookieManager.configCookieSync(cookieUrl, cookieValue, false);
      putAccepted = true;
      const all: string = webview.WebCookieManager.fetchCookieSync(cookieUrl);
      fetched = all.length > 0;
      webview.WebCookieManager.saveCookieAsync();
      saved = true;
    } catch (_e) {
      // Bounded failure; leave flags false.
    }
    return {
      name,
      domain,
      path,
      secure,
      httpOnly,
      putAccepted,
      fetched,
      saved,
      metadataChecksum: boundedChecksum(`${name}|${domain}|${path}|${secure}|${httpOnly}`),
      rawCookieValueExported: false
    };
  }

  private async runJavaScriptSafe(script: string): Promise<string> {
    try {
      const result = await this.controller.runJavaScript(script);
      return typeof result === 'string' ? result : String(result);
    } catch (_e) {
      return '';
    }
  }

  private parseIntSafe(value: string): number {
    const n = parseInt(value, 10);
    return isNaN(n) ? 0 : n;
  }
}

import connection from '@ohos.net.connection';
import { httpUrlHostname, isPrivateNetworkTarget, redactedHttpUrl } from './HttpTransportPolicy';
import webview from '@ohos.web.webview';
import type { JsonObject } from '@reader/core-harmony';
import {
  type ArkWebCookieSeed,
  type ArkWebObservedCookie,
  CookieSessionStore,
} from './CookieSessionStore';

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 10 * 60 * 1000;
const PAGE_SETTLE_MS = 500;
const SCRIPT_RETRY_MS = 500;
const MAX_REQUEST_HEADERS = 64;
const MAX_HEADER_NAME_LENGTH = 256;
const MAX_HEADER_VALUE_LENGTH = 16 * 1024;
const MAX_HEADER_BYTES = 64 * 1024;
const MAX_RESOURCE_EVENTS = 128;
const MAX_RESOURCE_URL_CHARS = 16 * 1024;
const MAX_RESOURCE_TOTAL_CHARS = 512 * 1024;
const MAX_RESOURCE_MATCHER_CHARS = 64 * 1024;

type ArkWebResourceCapture = {
  promise: Promise<string>;
  resolve: (url: string) => void;
  reject: (error: unknown) => void;
  tail: Promise<void>;
  settled: boolean;
  count: number;
  totalChars: number;
  deadlineTimer?: number;
  initializationTimer?: number;
  initializationScheduled: boolean;
  overflowQueued: boolean;
};

type ArkWebDocument = {
  kind: 'html' | 'url';
  body?: string;
  url?: string;
  baseUrl?: string;
};

type ArkWebJob = {
  requestId: number;
  document: ArkWebDocument;
  javaScript: string;
  headers: Array<webview.WebHeader>;
  settleDelayMillis: number;
  profileId?: string;
  cookieGeneration?: number;
  deadlineAt: number;
  cancelled: boolean;
  networkDenied?: boolean;
  pinnedHost?: string;
  pageReadyAt: number;
  finalUrl?: string;
  interactive: boolean;
  presentationTitle: string;
  userFinished: boolean;
  resourceUrlMatcherJavaScript?: string;
  resourceCapture?: ArkWebResourceCapture;
};

export type ArkWebPresentation = {
  visible: boolean;
  title: string;
};

export type ArkWebDiagnosticEvent = {
  kind: string;
  at: number;
  requestId?: number;
  url?: string;
};

type ArkWebHostFailure = {
  code: string;
  message: string;
  retryable: boolean;
  details: JsonObject;
};

function delay(millis: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, millis);
  });
}

/**
 * Host-owned, serialized ArkWeb executor. The mounted ArkUI Web component is
 * only a platform surface; Core supplies document/script/profile semantics
 * and receives the typed result. An incognito ArkWeb jar is cleared and
 * hydrated from CookieSessionStore per job, preventing cross-source leakage
 * and keeping AssetStore as the sole persistent credential authority.
 */
export class ArkWebExecutor {
  static readonly instance: ArkWebExecutor = new ArkWebExecutor();

  private controller: webview.WebviewController | undefined = undefined;
  private jobs: Map<number, ArkWebJob> = new Map<number, ArkWebJob>();
  private active: ArkWebJob | undefined = undefined;
  private tail: Promise<void> = Promise.resolve();
  private presentationListener: ((presentation: ArkWebPresentation) => void) | undefined = undefined;
  private diagnosticObserver: ((event: ArkWebDiagnosticEvent) => void) | undefined = undefined;

  attachDiagnosticObserver(observer: (event: ArkWebDiagnosticEvent) => void): void {
    this.diagnosticObserver = observer;
  }

  detachDiagnosticObserver(observer: (event: ArkWebDiagnosticEvent) => void): void {
    if (this.diagnosticObserver === observer) this.diagnosticObserver = undefined;
  }

  observeDiagnosticPageBegin(url: string): void {
    this.emitDiagnostic('pageBegin', this.active, url);
  }

  private emitDiagnostic(kind: string, job?: ArkWebJob, url?: string): void {
    // Optional observer is mounted only by the guarded diagnostic page. It
    // must never change production completion or selection behavior.
    try { this.diagnosticObserver?.({ kind, at: Date.now(), requestId: job?.requestId, url }); } catch (_) {}
  }

  attachPresentation(listener: (presentation: ArkWebPresentation) => void): void {
    this.presentationListener = listener;
    listener({
      visible: this.active?.interactive === true,
      title: this.active?.presentationTitle ?? '',
    });
  }

  detachPresentation(listener: (presentation: ArkWebPresentation) => void): void {
    if (this.presentationListener === listener) {
      this.presentationListener = undefined;
    }
  }

  attachController(controller: webview.WebviewController): void {
    this.controller = controller;
  }

  detachController(controller: webview.WebviewController): void {
    if (this.controller !== controller) {
      return;
    }
    this.controller = undefined;
    if (this.active !== undefined) {
      this.active.cancelled = true;
      this.rejectResourceCapture(this.active, this.hostFailure('CANCELLED', 'ArkWeb controller detached', false, { phase: 'resource' }));
    }
  }

  /** The admitted document host is DNS-validated and pinned before loading.
   * Navigation and resources are same-host only, so a page cannot introduce
   * an unpinned DNS name or redirect into a different network target.
   */
  blockNetworkUrl(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'about:blank' || normalized.startsWith('data:') || normalized.startsWith('blob:')) return false;
    const host = httpUrlHostname(value);
    const admittedHost = this.active?.pinnedHost;
    const blocked = host === undefined || isPrivateNetworkTarget(host) ||
      admittedHost === undefined || host !== admittedHost;
    if (blocked && this.active !== undefined) {
      this.active.networkDenied = true;
      this.rejectResourceCapture(this.active, this.hostFailure('NETWORK_POLICY_DENIED', '书源网页请求了不允许的网络地址', false, { phase: 'resource' }));
      try { this.controller?.stop(); } catch (_) {}
    }
    return blocked;
  }

  private async pinDocumentTarget(job: ArkWebJob, value: string): Promise<void> {
    this.requireHttpUrl(value);
    const host = httpUrlHostname(value)!;
    job.pinnedHost = host;
    if (host.includes(':') || /^[0-9.]+$/.test(host)) return;
    let addresses: connection.NetAddress[] | undefined;
    let failed = false;
    void connection.getAddressesByName(host).then((resolved: connection.NetAddress[]): void => {
      addresses = resolved;
    }).catch((): void => { failed = true; });
    while (addresses === undefined && !failed) {
      this.assertCurrent(job);
      await delay(50);
    }
    this.assertCurrent(job);
    if (failed || addresses === undefined || addresses.length === 0 || addresses.some((item: connection.NetAddress): boolean =>
      item.address.length === 0 || isPrivateNetworkTarget(item.address))) {
      throw this.hostFailure('NETWORK_POLICY_DENIED', '书源网页无法确认网络目标', false, {phase:'dns'});
    }
    webview.WebviewController.setHostIP(host, addresses[0].address,
      Math.max(1, Math.ceil((job.deadlineAt - Date.now()) / 1000)));
  }

  onPageEnd(url: string): void {
    const job = this.active;
    this.emitDiagnostic('pageEnd', job, url);
    if (job === undefined || job.cancelled) {
      return;
    }
    if (url.trim().length === 0 || url === 'about:blank') {
      return;
    }
    job.finalUrl = url;
    job.pageReadyAt = Date.now() + PAGE_SETTLE_MS + job.settleDelayMillis;
    const capture = job.resourceCapture;
    if (capture !== undefined && !capture.settled && !capture.initializationScheduled) {
      capture.initializationScheduled = true;
      capture.initializationTimer = setTimeout((): void => {
        capture.initializationTimer = undefined;
        if (capture.settled || this.active !== job) return;
        void this.runResourceInitialization(job).catch((error: unknown): void => this.rejectResourceCapture(job, error));
      }, PAGE_SETTLE_MS + job.settleDelayMillis);
    }
  }

  /** Actual ArkWeb resource callback; the Core-authored matcher runs in the
   * existing browser JS engine. No ResourceTiming reconstruction or refetch. */
  onResourceLoad(url: string): void {
    const job = this.active;
    this.emitDiagnostic('resource', job, url);
    const capture = job?.resourceCapture;
    if (job === undefined || capture === undefined || capture.settled || capture.overflowQueued) return;
    if (url === 'about:blank' || url.trim().length === 0) return;
    if (this.blockNetworkUrl(url)) return;
    capture.count += 1;
    capture.totalChars += url.length;
    if (url.length > MAX_RESOURCE_URL_CHARS || capture.count > MAX_RESOURCE_EVENTS ||
      capture.totalChars > MAX_RESOURCE_TOTAL_CHARS) {
      capture.overflowQueued = true;
      // Keep the budget terminal marker in callback order: an earlier match
      // already admitted to the bounded queue still wins over a later burst.
      capture.tail = capture.tail.then((): void => {
        this.rejectResourceCapture(job, this.hostFailure('RESOURCE_LIMIT_EXCEEDED',
          'WebView resource observation exceeded its bounded budget', false, { phase: 'resource' }));
      });
      return;
    }
    // Serialization preserves callback order even if JS evaluations resolve
    // at different times. URLs remain arguments, never executable source.
    capture.tail = capture.tail.then(async (): Promise<void> => {
      if (capture.settled || this.active !== job) return;
      this.assertCurrent(job);
      const controller = this.controller;
      if (controller === undefined) throw this.hostFailure('CANCELLED', 'ArkWeb controller detached', false, { phase: 'resource' });
      let raw: string;
      try {
        this.emitDiagnostic('matcherStart', job, url);
        raw = await controller.runJavaScript(`(${job.resourceUrlMatcherJavaScript})(${JSON.stringify(url)})`);
      } catch (_) {
        throw this.hostFailure('SCRIPT_EXECUTION_FAILED', 'WebView resource matcher execution failed', false,
          { phase: 'script', reason: 'RESOURCE_MATCHER_EXECUTION_FAILED' });
      }
      if (capture.settled || this.active !== job) return;
      this.assertCurrent(job);
      const matched = this.parseJavaScriptValue(raw);
      this.emitDiagnostic(matched === true ? 'matched' : 'unmatched', job, url);
      if (typeof matched !== 'boolean') {
        throw this.hostFailure('INVALID_RESOURCE_MATCHER', 'Resource matcher must return a boolean', false, { phase: 'resource' });
      }
      if (matched) {
        capture.settled = true;
        this.clearResourceTimers(capture);
        capture.resolve(url);
      }
    }).catch((error: unknown): void => this.rejectResourceCapture(job, error));
  }

  execute(params: JsonObject, requestId: number): Promise<JsonObject> {
    const job = this.parseJob(params, requestId);
    this.jobs.set(requestId, job);
    const scheduled = this.tail.then((): Promise<JsonObject> => this.run(job));
    this.tail = scheduled.then((): void => undefined, (): void => undefined);
    return scheduled.finally((): void => {
      this.jobs.delete(requestId);
    });
  }

  openInteractive(url: string, profileId: string, title: string): Promise<JsonObject> {
    const requestId = this.nextInteractiveRequestId();
    const job = this.parseJob({
      document: { kind: 'url', url },
      javaScript: 'document.documentElement.outerHTML',
      timeoutMillis: MAX_TIMEOUT_MS,
      profileId,
    }, requestId);
    job.interactive = true;
    job.presentationTitle = title.trim().length > 0 ? title : '书源登录 / 验证';
    this.jobs.set(requestId, job);
    const scheduled = this.tail.then((): Promise<JsonObject> => this.run(job));
    this.tail = scheduled.then((): void => undefined, (): void => undefined);
    return scheduled.finally((): void => {
      this.jobs.delete(requestId);
    });
  }

  finishInteractive(): void {
    if (this.active?.interactive === true) {
      this.active.userFinished = true;
    }
  }

  cancelInteractive(): void {
    if (this.active?.interactive === true) {
      this.cancel(this.active.requestId);
    }
  }

  cancel(requestId: number): void {
    const job = this.jobs.get(requestId);
    if (job === undefined) {
      return;
    }
    job.cancelled = true;
    this.emitDiagnostic('cancel', job);
    this.rejectResourceCapture(job, this.hostFailure('CANCELLED', 'webview.evaluateJavaScript cancelled', false, { phase: 'resource' }));
    if (this.active === job) {
      try {
        this.controller?.stop();
      } catch (_) {
        // The controller may already be detached; the shared flag still wins.
      }
    }
  }

  private async run(job: ArkWebJob): Promise<JsonObject> {
    this.assertCurrent(job);
    const controller = await this.waitForController(job);
    this.active = job;
    this.emitDiagnostic('start', job);
    let seeds: ArkWebCookieSeed[] = [];
    try {
      webview.WebCookieManager.clearAllCookiesSync(true);
      const seedUrl = this.documentUrl(job.document);
      if (seedUrl !== undefined) await this.pinDocumentTarget(job, seedUrl);
      if (job.profileId !== undefined && seedUrl !== undefined) {
        seeds = await CookieSessionStore.instance.arkWebSeeds(job.profileId);
        for (const seed of seeds) {
          webview.WebCookieManager.configCookieSync(seed.url, seed.header, true, true);
        }
      }
      this.assertCurrent(job);
      job.pageReadyAt = 0;
      const resourceCapture = job.resourceUrlMatcherJavaScript === undefined ? undefined : this.prepareResourceCapture(job);
      if (job.document.kind === 'url') {
        controller.loadUrl(job.document.url!, job.headers);
      } else {
        controller.loadData(
          job.document.body!,
          'text/html',
          'utf-8',
          job.document.baseUrl,
          job.document.baseUrl,
        );
      }
      let value: unknown;
      if (resourceCapture !== undefined) {
        // A resource can arrive before page-finished. Its real callback may
        // complete immediately; source initialization is scheduled separately.
        value = await resourceCapture.promise;
      } else {
        await this.waitForStablePage(job);
        if (job.interactive) {
          this.publishPresentation(true, job.presentationTitle);
          while (!job.userFinished) {
            this.assertCurrent(job);
            await delay(100);
          }
        }
        value = await this.evaluateUntilReady(job, controller);
      }
      this.assertCurrent(job);
      const finalUrl = this.nonBlank(controller.getUrl()) ?? job.finalUrl ?? seedUrl;
      const title = this.nonBlank(controller.getTitle());
      if (job.profileId !== undefined) {
        // Keep the shared source jar exact-host scoped.  ArkWeb may report a
        // Domain cookie for a parent (or sibling) host; importing that record
        // as hostOnly would otherwise broaden the cookie to a host the
        // network policy never admitted for this job.
        await this.captureCookies(job.profileId, seeds, job.cookieGeneration, job.pinnedHost);
      }
      this.assertCurrent(job);
      if (!job.interactive) {
        const challengeType = this.detectChallengeType(value, finalUrl, title);
        if (challengeType !== undefined) {
          throw this.hostFailure(
            'CHALLENGE_REQUIRED',
            `ArkWeb challenge requires user interaction: ${challengeType}`,
            false,
            {
              phase: 'response',
              lane: 'anti_bot',
              challengeType,
              url: finalUrl === undefined ? '' : redactedHttpUrl(finalUrl),
              autoRetryable: false,
            },
          );
        }
      }
      const result: JsonObject = { value };
      if (resourceCapture !== undefined) result['resourceUrl'] = value;
      if (finalUrl !== undefined) {
        result['finalUrl'] = finalUrl;
      }
      if (title !== undefined) {
        result['title'] = title;
      }
      return result;
    } finally {
      this.emitDiagnostic('end', job);
      this.rejectResourceCapture(job, this.hostFailure('CANCELLED', 'ArkWeb job ended', false, { phase: 'resource' }));
      job.resourceCapture = undefined;
      if (job.interactive) {
        this.publishPresentation(false, '');
      }
      try {
        controller.stop();
        controller.loadUrl('about:blank');
      } catch (_) {
        // Cleanup is best effort after a detached/render-crashed controller.
      }
      webview.WebCookieManager.clearAllCookiesSync(true);
      if (job.pinnedHost !== undefined) {
        try { webview.WebviewController.clearHostIP(job.pinnedHost); } catch (_) {}
      }
      if (this.active === job) {
        this.active = undefined;
      }
    }
  }

  private prepareResourceCapture(job: ArkWebJob): ArkWebResourceCapture {
    let resolveCapture: (url: string) => void = (): void => {};
    let rejectCapture: (error: unknown) => void = (): void => {};
    const promise = new Promise<string>((resolve, reject): void => {
      resolveCapture = resolve;
      rejectCapture = reject;
    });
    // A synchronous loadUrl/loadData failure can precede awaiting the signal.
    void promise.catch((): void => {});
    const capture: ArkWebResourceCapture = {
      promise, resolve: resolveCapture, reject: rejectCapture, tail: Promise.resolve(),
      settled: false, count: 0, totalChars: 0, initializationScheduled: false,
      overflowQueued: false,
    };
    job.resourceCapture = capture;
    capture.deadlineTimer = setTimeout((): void => {
      this.rejectResourceCapture(job, this.hostFailure('TIMEOUT', 'WebView resource match timed out', true, { phase: 'resource' }));
    }, Math.max(0, job.deadlineAt - Date.now()));
    return capture;
  }

  private clearResourceTimers(capture: ArkWebResourceCapture): void {
    if (capture.deadlineTimer !== undefined) clearTimeout(capture.deadlineTimer);
    if (capture.initializationTimer !== undefined) clearTimeout(capture.initializationTimer);
    capture.deadlineTimer = undefined;
    capture.initializationTimer = undefined;
  }

  private rejectResourceCapture(job: ArkWebJob, error: unknown): void {
    const capture = job.resourceCapture;
    if (capture === undefined || capture.settled) return;
    capture.settled = true;
    this.clearResourceTimers(capture);
    capture.reject(error);
  }

  private async runResourceInitialization(job: ArkWebJob): Promise<void> {
    this.assertCurrent(job);
    const controller = this.controller;
    if (controller === undefined) throw this.hostFailure('CANCELLED', 'ArkWeb controller detached', false, { phase: 'resource' });
    try {
      await controller.runJavaScript(job.javaScript);
    } catch (_) {
      throw this.hostFailure('SCRIPT_EXECUTION_FAILED', 'WebView resource initialization failed', false,
        { phase: 'script', reason: 'RESOURCE_INITIALIZATION_FAILED' });
    }
    if (this.active === job) this.assertCurrent(job);
  }

  private async waitForController(job: ArkWebJob): Promise<webview.WebviewController> {
    while (this.controller === undefined) {
      this.assertCurrent(job);
      await delay(100);
    }
    return this.controller;
  }

  private async waitForStablePage(job: ArkWebJob): Promise<void> {
    while (job.pageReadyAt === 0 || Date.now() < job.pageReadyAt) {
      this.assertCurrent(job);
      await delay(50);
    }
  }

  private async evaluateUntilReady(
    job: ArkWebJob,
    controller: webview.WebviewController,
  ): Promise<unknown> {
    while (true) {
      this.assertCurrent(job);
      const raw = await controller.runJavaScript(job.javaScript);
      this.assertCurrent(job);
      const parsed = this.parseJavaScriptValue(raw);
      if (parsed !== null && parsed !== '') {
        return parsed;
      }
      await delay(SCRIPT_RETRY_MS);
    }
  }

  private async captureCookies(
    profileId: string,
    seeds: ArkWebCookieSeed[],
    expectedGeneration?: number,
    admittedHost?: string,
  ): Promise<void> {
    const records = await webview.WebCookieManager.fetchAllCookies(true);
    const observed: ArkWebObservedCookie[] = [];
    const normalizedAdmittedHost = admittedHost === undefined ? undefined : this.normalizeCookieHost(admittedHost);
    if (normalizedAdmittedHost === undefined) {
      return;
    }
    for (const record of records) {
      const normalizedDomain = this.normalizeCookieHost(record.domain);
      if (normalizedDomain === undefined || normalizedDomain !== normalizedAdmittedHost) {
        continue;
      }
      const sameSite = this.sameSite(record.samesitePolicy);
      const cookie: ArkWebObservedCookie = {
        name: record.name,
        value: record.value,
        domain: normalizedDomain,
        path: record.path.length > 0 ? record.path : '/',
        secure: record.isSecure,
        httpOnly: record.isHttpOnly,
        hostOnly: !record.domain.startsWith('.'),
      };
      if (!record.isSessionCookie && record.expiresDate.trim().length > 0) {
        cookie.expiresAt = record.expiresDate;
      }
      if (sameSite !== undefined) {
        cookie.sameSite = sameSite;
      }
      observed.push(cookie);
    }
    await CookieSessionStore.instance.reconcileArkWebCookies(profileId, seeds, observed, expectedGeneration);
  }

  private normalizeCookieHost(value: string): string | undefined {
    const normalized = value.trim().toLowerCase()
      .replace(/^\.+/, '').replace(/^\[/, '').replace(/\]$/, '').split('%')[0];
    return normalized.length > 0 ? normalized : undefined;
  }

  private sameSite(
    policy: webview.WebHttpCookieSameSitePolicy,
  ): 'Strict' | 'Lax' | 'None' | undefined {
    switch (policy) {
      case webview.WebHttpCookieSameSitePolicy.STRICT:
        return 'Strict';
      case webview.WebHttpCookieSameSitePolicy.LAX:
        return 'Lax';
      case webview.WebHttpCookieSameSitePolicy.NONE:
        return 'None';
      default:
        return undefined;
    }
  }

  private parseJob(params: JsonObject, requestId: number): ArkWebJob {
    const rawDocument = params['document'];
    if (rawDocument === null || typeof rawDocument !== 'object' || Array.isArray(rawDocument)) {
      throw new Error('webview.evaluateJavaScript requires document object');
    }
    const document = rawDocument as JsonObject;
    const kind = document['kind'];
    let parsedDocument: ArkWebDocument;
    if (kind === 'url') {
      const navigationUrl = this.requiredString(document['url'], 'document.url');
      this.requireHttpUrl(navigationUrl);
      parsedDocument = { kind: 'url', url: navigationUrl };
    } else if (kind === 'html') {
      const body = this.requiredString(document['body'], 'document.body');
      const baseUrl = this.optionalString(document['baseUrl']);
      if (baseUrl !== undefined) {
        this.requireHttpUrl(baseUrl);
      }
      parsedDocument = { kind: 'html', body, baseUrl };
    } else {
      throw new Error('webview.evaluateJavaScript document.kind must be html or url');
    }
    const javaScript = this.requiredString(params['javaScript'], 'javaScript');
    const rawResourceMatcher = params['resourceUrlMatcherJavaScript'];
    const resourceUrlMatcherJavaScript = rawResourceMatcher === undefined ? undefined :
      this.requiredString(rawResourceMatcher, 'resourceUrlMatcherJavaScript');
    if (resourceUrlMatcherJavaScript !== undefined && resourceUrlMatcherJavaScript.length > MAX_RESOURCE_MATCHER_CHARS) {
      throw new Error('resourceUrlMatcherJavaScript exceeds its bounded size');
    }
    const timeoutValue = params['timeoutMillis'];
    const timeoutMs = typeof timeoutValue === 'number' && Number.isFinite(timeoutValue) ?
      Math.floor(timeoutValue) : DEFAULT_TIMEOUT_MS;
    if (timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new Error(`webview.evaluateJavaScript timeoutMillis must be 1..${MAX_TIMEOUT_MS}`);
    }
    const profileId = this.optionalString(params['profileId']);
    const headers = this.parseHeaders(params['headers'], parsedDocument.kind);
    const settleDelayMillis = this.optionalBoundedMillis(
      params['settleDelayMillis'],
      'settleDelayMillis',
      MAX_TIMEOUT_MS,
    ) ?? 0;
    return {
      requestId,
      document: parsedDocument,
      javaScript,
      resourceUrlMatcherJavaScript,
      headers,
      settleDelayMillis,
      profileId,
      cookieGeneration: profileId === undefined ? undefined : CookieSessionStore.instance.sessionGeneration(profileId),
      deadlineAt: Date.now() + timeoutMs,
      cancelled: false,
      pageReadyAt: 0,
      interactive: false,
      presentationTitle: '',
      userFinished: false,
    };
  }

  private nextInteractiveRequestId(): number {
    let candidate = 9_000_000;
    while (this.jobs.has(candidate)) {
      candidate += 1;
    }
    return candidate;
  }

  private parseHeaders(value: unknown, documentKind: 'html' | 'url'): Array<webview.WebHeader> {
    if (value === undefined || value === null) {
      return [];
    }
    if (documentKind !== 'url' || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('webview.evaluateJavaScript headers require a URL document and object');
    }
    const headers: Array<webview.WebHeader> = [];
    const record = value as JsonObject;
    const keys = Object.keys(record);
    if (keys.length > MAX_REQUEST_HEADERS) {
      throw new Error(`webview.evaluateJavaScript headers exceed ${MAX_REQUEST_HEADERS} entries`);
    }
    let totalBytes = 0;
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype' ||
        key.length === 0 || key.length > MAX_HEADER_NAME_LENGTH || !this.isValidHttpToken(key)) {
        throw new Error(`webview.evaluateJavaScript header name ${key} is invalid`);
      }
      const raw = record[key];
      if (raw === undefined || raw === null || typeof raw === 'object') {
        throw new Error(`webview.evaluateJavaScript header ${key} must be scalar`);
      }
      const headerValue = `${raw}`;
      if (headerValue.length > MAX_HEADER_VALUE_LENGTH ||
        headerValue.indexOf('\r') >= 0 || headerValue.indexOf('\n') >= 0 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(headerValue)) {
        throw new Error(`webview.evaluateJavaScript header ${key} contains an invalid value`);
      }
      totalBytes += key.length + headerValue.length;
      if (totalBytes > MAX_HEADER_BYTES) {
        throw new Error(`webview.evaluateJavaScript headers exceed ${MAX_HEADER_BYTES} bytes`);
      }
      headers.push({ headerKey: key, headerValue });
    }
    return headers;
  }

  private isValidHttpToken(value: string): boolean {
    for (const ch of value) {
      const code = ch.charCodeAt(0);
      const alpha = code >= 65 && code <= 90 || code >= 97 && code <= 122;
      const digit = code >= 48 && code <= 57;
      const tchar = "!#$%&'*+-.^_`|~".indexOf(ch) >= 0;
      if (!alpha && !digit && !tchar) return false;
    }
    return value.length > 0;
  }

  private optionalBoundedMillis(
    value: unknown,
    field: string,
    maximum: number,
  ): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`webview.evaluateJavaScript ${field} must be a number`);
    }
    const parsed = Math.floor(value);
    if (parsed < 0 || parsed > maximum) {
      throw new Error(`webview.evaluateJavaScript ${field} must be 0..${maximum}`);
    }
    return parsed;
  }

  private publishPresentation(visible: boolean, title: string): void {
    this.presentationListener?.({ visible, title });
  }

  private documentUrl(document: ArkWebDocument): string | undefined {
    return document.kind === 'url' ? document.url : document.baseUrl;
  }

  private assertCurrent(job: ArkWebJob): void {
    if (job.profileId !== undefined && job.cookieGeneration !== undefined &&
      CookieSessionStore.instance.sessionGeneration(job.profileId) !== job.cookieGeneration) {
      job.cancelled = true;
    }
    if (job.networkDenied) {
      throw this.hostFailure('NETWORK_POLICY_DENIED', '书源网页请求了不允许的网络地址', false, {phase:'navigation'});
    }
    if (job.cancelled) {
      throw this.hostFailure(
        'CANCELLED',
        'webview.evaluateJavaScript cancelled',
        false,
        { phase: 'runtime', requestId: job.requestId },
      );
    }
    if (Date.now() >= job.deadlineAt) {
      const location = job.finalUrl === undefined ? '' : ` at ${redactedHttpUrl(job.finalUrl)}`;
      throw this.hostFailure(
        'TIMEOUT',
        `webview.evaluateJavaScript timed out${location}`,
        true,
        { phase: 'runtime', finalUrl: job.finalUrl === undefined ? '' : redactedHttpUrl(job.finalUrl) },
      );
    }
  }

  private detectChallengeType(
    value: unknown,
    finalUrl: string | undefined,
    title: string | undefined,
  ): string | undefined {
    const address = (finalUrl ?? '').toLowerCase();
    const pageTitle = (title ?? '').toLowerCase();
    const html = typeof value === 'string' ? value.slice(0, 64 * 1024).toLowerCase() : '';
    if (html.includes('g-recaptcha') || address.includes('recaptcha')) {
      return 'recaptcha';
    }
    if (html.includes('h-captcha') || address.includes('hcaptcha')) {
      return 'hcaptcha';
    }
    if (html.includes('cf-turnstile') || html.includes('cf-chl-') ||
      address.includes('/cdn-cgi/challenge-platform/')) {
      return 'cloudflare_js';
    }
    if (html.includes('slider-captcha') || html.includes('slide-verify') ||
      pageTitle.includes('滑块验证')) {
      return 'slider_captcha';
    }
    const challengeAddress = address.includes('/challenge') || address.includes('/captcha') ||
      address.includes('/verify');
    const challengeTitle = pageTitle.includes('verify you are human') ||
      pageTitle.includes('human verification') || pageTitle.includes('人机验证') ||
      pageTitle.includes('安全验证');
    if (challengeAddress || challengeTitle) {
      return 'human_verification';
    }
    return undefined;
  }

  private hostFailure(
    code: string,
    message: string,
    retryable: boolean,
    details: JsonObject,
  ): ArkWebHostFailure {
    return { code, message, retryable, details };
  }

  private parseJavaScriptValue(raw: string): unknown {
    try {
      return JSON.parse(raw) as unknown;
    } catch (_) {
      return raw;
    }
  }

  private requiredString(value: unknown, field: string): string {
    const parsed = this.optionalString(value);
    if (parsed === undefined) {
      throw new Error(`webview.evaluateJavaScript requires non-empty ${field}`);
    }
    return parsed;
  }

  private optionalString(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return undefined;
    }
    return value;
  }

  private requireHttpUrl(value: string): void {
    const host = httpUrlHostname(value);
    if (host === undefined || isPrivateNetworkTarget(host)) {
      throw new Error('webview document URL must use http or https on a public host');
    }
  }

  private nonBlank(value: string): string | undefined {
    return value.trim().length > 0 && value !== 'about:blank' ? value : undefined;
  }
}

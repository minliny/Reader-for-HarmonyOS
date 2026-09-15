import { NetworkEnvironmentError, prepareNetworkTarget, type NetworkTarget } from './NetworkRoutePolicy';
import { httpUrlHostname, isPrivateNetworkTarget, redactedHttpUrl } from './HttpTransportPolicy';
import webview from '@ohos.web.webview';
import { WebNetErrorList } from '@ohos.web.netErrorList';
import type { JsonObject } from '@reader/core-harmony';
import {
  type ArkWebCookieSeed,
  type ArkWebObservedCookie,
  CookieSessionStore,
} from './CookieSessionStore';

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 10 * 60 * 1000;
const PAGE_SETTLE_MS = 500;
const PROXY_ACK_TIMEOUT_MS = 5000;
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
  surface?: ArkWebSurface;
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
  dnsPinned?: boolean;
  route?: NetworkTarget;
  proxyLease?: ArkWebProxyLease;
  nativeFailure?: ArkWebHostFailure | NetworkEnvironmentError;
  httpFailure?: ArkWebHostFailure;
  loadStarted?: boolean;
  pendingWaitReject?: (error: unknown) => void;
  pageReadyAt: number;
  finalUrl?: string;
  interactive: boolean;
  presentationTitle: string;
  userFinished: boolean;
  resourceUrlMatcherJavaScript?: string;
  resourceCapture?: ArkWebResourceCapture;
};

export type ArkWebPresentation = {
  surfaceId: number;
  visible: boolean;
  title: string;
};

export type ArkWebSurface = {
  readonly id: number;
  readonly requestId: number;
  readonly controller: webview.WebviewController;
};

type ArkWebSurfaceLease = {
  surface: ArkWebSurface;
  attached: boolean;
  retired: boolean;
};

type ArkWebProxyLease = {
  direct: boolean;
  phase: 'configuring' | 'ready' | 'removing' | 'retired' | 'failed';
  releaseRequested: boolean;
  error?: NetworkEnvironmentError;
  listeners: Set<() => void>;
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

  private surfaceLease: ArkWebSurfaceLease | undefined = undefined;
  private nextSurfaceId: number = 1;
  private proxyLease: ArkWebProxyLease | undefined = undefined;
  private surfaceListener: ((surface: ArkWebSurface | undefined) => void) | undefined = undefined;
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

  observeDiagnosticPageBegin(url: string, surface: ArkWebSurface): void {
    this.emitDiagnostic(this.isSurfaceCurrent(surface) ? 'pageBegin' : 'pageBeginDiscarded', surface, url);
  }

  private emitDiagnostic(kind: string, job?: ArkWebJob | ArkWebSurface, url?: string): void {
    // Optional observer is mounted only by the guarded diagnostic page. It
    // must never change production completion or selection behavior.
    try { this.diagnosticObserver?.({ kind, at: Date.now(), requestId: job?.requestId, url }); } catch (_) {}
  }

  attachPresentation(listener: (presentation: ArkWebPresentation) => void): void {
    this.presentationListener = listener;
    listener({
      surfaceId: this.active?.surface?.id ?? 0,
      visible: this.active?.interactive === true,
      title: this.active?.presentationTitle ?? '',
    });
  }

  detachPresentation(listener: (presentation: ArkWebPresentation) => void): void {
    if (this.presentationListener === listener) {
      this.presentationListener = undefined;
    }
  }

  attachSurfaceHost(listener: (surface: ArkWebSurface | undefined) => void): void {
    this.surfaceListener = listener;
    const surface = this.active?.surface;
    listener(surface !== undefined && this.isSurfaceCurrent(surface) ? surface : undefined);
  }

  detachSurfaceHost(listener: (surface: ArkWebSurface | undefined) => void): void {
    if (this.surfaceListener !== listener) return;
    this.surfaceListener = undefined;
    const lease = this.surfaceLease;
    if (lease !== undefined) {
      const job = this.active;
      if (job?.surface === lease.surface) this.cancel(job.requestId);
      if (!lease.attached) lease.retired = true;
    }
  }

  attachController(surface: ArkWebSurface): void {
    const lease = this.surfaceLease;
    if (lease?.surface !== surface || lease.retired || this.active?.surface !== surface || this.active.cancelled) {
      try { surface.controller.stop(); } catch (_) {}
      return;
    }
    lease.attached = true;
  }

  detachController(surface: ArkWebSurface): void {
    const lease = this.surfaceLease;
    if (lease?.surface !== surface) return;
    lease.attached = false;
    lease.retired = true;
    const job = this.active;
    if (job?.surface === surface) {
      this.cancel(job.requestId);
      this.rejectResourceCapture(job, this.hostFailure('CANCELLED', 'ArkWeb controller detached', false, { phase: 'resource' }));
    }
  }

  isSurfaceCurrent(surface: ArkWebSurface): boolean {
    return this.surfaceLease?.surface === surface && !this.surfaceLease.retired &&
      this.active?.surface === surface && !this.active.cancelled;
  }

  /** The admitted document host is DNS-validated and pinned before loading.
   * Navigation and resources are same-host only, so a page cannot introduce
   * an unpinned DNS name or redirect into a different network target.
   */
  blockNetworkUrl(value: string, surface: ArkWebSurface): boolean {
    if (!this.isSurfaceCurrent(surface)) return true;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'about:blank' || normalized.startsWith('data:') || normalized.startsWith('blob:')) return false;
    const host = httpUrlHostname(value);
    const admittedHost = this.active?.pinnedHost;
    const blocked = host === undefined || isPrivateNetworkTarget(host) ||
      admittedHost === undefined || host !== admittedHost;
    if (blocked && this.active !== undefined) {
      this.active.networkDenied = true;
      this.rejectResourceCapture(this.active, this.hostFailure('NETWORK_POLICY_DENIED', '书源网页请求了不允许的网络地址', false, { phase: 'resource' }));
      try { surface.controller.stop(); } catch (_) {}
    }
    return blocked;
  }

  private async pinDocumentTarget(job: ArkWebJob, value: string): Promise<void> {
    this.requireHttpUrl(value);
    const host = httpUrlHostname(value)!;
    job.pinnedHost = host;
    // IP literals still select the system route. Otherwise a public literal
    // could accidentally bypass PAC/exclusion handling in the Web transport.
    const target = await this.waitForOperation(job, prepareNetworkTarget(value));
    this.assertCurrent(job);
    job.route = target;
    if (target.route !== 'systemProxy' && !host.includes(':') && !/^[0-9.]+$/.test(host)) {
      webview.WebviewController.setHostIP(host, target.addresses[0],
        Math.max(1, Math.ceil((job.deadlineAt - Date.now()) / 1000)));
      job.dnsPinned = true;
    }
  }

  /** Native errors carry their originating immutable surface, just like
   * resource events. An about:blank callback or a failed image is not evidence
   * that the admitted main document failed. Never persist raw error text/URLs. */
  onNativeError(url: string, mainFrame: boolean, code: number, info: string, surface: ArkWebSurface): void {
    const job = this.nativeErrorJob(url, mainFrame, surface);
    if (job === undefined) return;
    // Reuse the platform's WebNetErrorList (API 12). Generic connect/DNS
    // failures are not proof of a proxy outage. Older mapped errors can also
    // identify an exact net::ERR_* reason; never search inside raw URL text.
    const proxy = [WebNetErrorList.ERR_PROXY_CONNECTION_FAILED,
      WebNetErrorList.ERR_TUNNEL_CONNECTION_FAILED, WebNetErrorList.ERR_PROXY_AUTH_UNSUPPORTED,
      WebNetErrorList.ERR_PROXY_AUTH_REQUESTED, WebNetErrorList.ERR_MANDATORY_PROXY_CONFIGURATION_FAILED,
      WebNetErrorList.ERR_PROXY_CERTIFICATE_INVALID, WebNetErrorList.ERR_HTTPS_PROXY_TUNNEL_RESPONSE_REDIRECT,
      WebNetErrorList.ERR_UNABLE_TO_REUSE_CONNECTION_FOR_PROXY_AUTH, WebNetErrorList.ERR_UNEXPECTED_PROXY_AUTH,
      WebNetErrorList.ERR_PROXY_AUTH_REQUESTED_WITH_NO_CONNECTION, WebNetErrorList.ERR_PROXY_HTTP_1_1_REQUIRED].includes(code) ||
      /^(?:net::)?ERR_(PROXY_[A-Z_]+|TUNNEL_CONNECTION_FAILED|MANDATORY_PROXY_CONFIGURATION_FAILED)$/.test(info.trim());
    const tls = (code <= WebNetErrorList.ERR_CERT_COMMON_NAME_INVALID && code > WebNetErrorList.ERR_CERT_END) ||
      [WebNetErrorList.ERR_SSL_PROTOCOL_ERROR, WebNetErrorList.ERR_SSL_VERSION_OR_CIPHER_MISMATCH,
        WebNetErrorList.ERR_BAD_SSL_CLIENT_AUTH_CERT, WebNetErrorList.ERR_SSL_CLIENT_AUTH_CERT_NEEDED].includes(code) ||
      /^(?:net::)?ERR_(CERT_[A-Z_]+|SSL_[A-Z_]+|BAD_SSL_CLIENT_AUTH_CERT)$/.test(info.trim());
    const failure = proxy ? new NetworkEnvironmentError('transport', '系统代理连接或认证失败，请检查代理后重试') :
      this.hostFailure(tls ? 'TLS_ERROR' : 'NETWORK_ERROR', '书源网页加载失败', true,
        { phase: 'transport', nativeCode: code });
    this.failNativeJob(job, failure);
  }

  onNativeHttpError(url: string, mainFrame: boolean, status: number, surface: ArkWebSurface): void {
    const job = this.nativeErrorJob(url, mainFrame, surface);
    if (job === undefined || status < 400) return;
    if (status === 407 && job.route?.route === 'systemProxy') {
      this.failNativeJob(job, new NetworkEnvironmentError('transport', '系统代理需要认证，请检查代理后重试'));
      return;
    }
    // Login/challenge pages often deliberately return 401/403/429. Preserve
    // the existing interactive browser and HTML challenge detection first.
    if (job.interactive) return;
    const failure = this.hostFailure('NETWORK_ERROR', `书源网页返回 HTTP ${status}`, status >= 500,
      { phase: 'response', status });
    if (status === 401 || status === 403 || status === 429) job.httpFailure = failure;
    else this.failNativeJob(job, failure);
  }

  private nativeErrorJob(url: string, mainFrame: boolean, surface: ArkWebSurface): ArkWebJob | undefined {
    if (!this.isSurfaceCurrent(surface)) {
      this.emitDiagnostic('nativeErrorDiscarded', surface);
      return undefined;
    }
    const job = this.active;
    if (!mainFrame || job === undefined || !job.loadStarted || job.nativeFailure !== undefined ||
      httpUrlHostname(url) !== job.pinnedHost) return undefined;
    return job;
  }

  private failNativeJob(job: ArkWebJob, failure: ArkWebHostFailure | NetworkEnvironmentError): void {
    job.nativeFailure = failure;
    this.rejectResourceCapture(job, failure);
    job.pendingWaitReject?.(failure);
    try { job.surface?.controller.stop(); } catch (_) {}
  }

  /** Event-driven admission has no extra polling delay on every request. */
  private waitForOperation<T>(job: ArkWebJob, operation: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject): void => {
      let settled = false;
      const finish = (value: T | undefined, error?: unknown): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (job.pendingWaitReject === fail) job.pendingWaitReject = undefined;
        if (error !== undefined) reject(error); else resolve(value!);
      };
      const fail = (error: unknown): void => finish(undefined, error);
      const timer = setTimeout((): void => {
        try { this.assertCurrent(job); } catch (error) { fail(error); return; }
        fail(this.hostFailure('TIMEOUT', 'WebView network admission timed out', true, { phase: 'route' }));
      }, Math.max(0, job.deadlineAt - Date.now()));
      job.pendingWaitReject = fail;
      operation.then((value: T): void => finish(value), fail);
      try { this.assertCurrent(job); } catch (error) { fail(error); }
    });
  }

  private notifyProxyLease(lease: ArkWebProxyLease): void {
    lease.listeners.forEach((listener: () => void): void => listener());
  }

  private waitForProxyLease(job: ArkWebJob, lease: ArkWebProxyLease, retired: boolean): Promise<void> {
    return new Promise<void>((resolve, reject): void => {
      const finish = (error?: unknown): void => {
        clearTimeout(timer);
        lease.listeners.delete(check);
        if (job.pendingWaitReject === finish) job.pendingWaitReject = undefined;
        if (error !== undefined) reject(error); else resolve();
      };
      const check = (): void => {
        try { this.assertCurrent(job); } catch (error) { finish(error); return; }
        if (lease.error !== undefined) { finish(lease.error); return; }
        if (lease.phase === (retired ? 'retired' : 'ready')) finish();
      };
      const timer = setTimeout((): void => {
        finish(new NetworkEnvironmentError('route', '系统网页代理配置尚未生效，请稍后重试', retired ? 'proxy.restoreAck' : 'proxy.configureAck'));
      }, Math.max(0, Math.min(PROXY_ACK_TIMEOUT_MS, job.deadlineAt - Date.now())));
      job.pendingWaitReject = finish;
      lease.listeners.add(check);
      check();
    });
  }

  private async configureProxy(job: ArkWebJob): Promise<void> {
    const lease: ArkWebProxyLease = {
      direct: job.route?.bypassSystemProxy === true,
      phase: 'configuring', releaseRequested: false, listeners: new Set<() => void>(),
    };
    this.proxyLease = lease;
    job.proxyLease = lease;
    const configured = (): void => {
      if (lease.phase !== 'configuring') return;
      lease.phase = 'ready';
      this.notifyProxyLease(lease);
      if (lease.releaseRequested) this.releaseProxyLease(lease);
    };
    let operation = 'proxy.removeProxyOverride';
    try {
      if (lease.direct) {
        operation = 'proxy.config';
        const config = new webview.ProxyConfig();
        operation = 'proxy.insertDirectRule';
        config.insertDirectRule();
        operation = 'proxy.applyProxyOverride';
        webview.ProxyController.applyProxyOverride(config, configured);
      } else {
        webview.ProxyController.removeProxyOverride(configured);
      }
    } catch (error) {
      // These synchronous SDK errors mean the configuration was not accepted.
      lease.phase = 'ready';
      lease.error = NetworkEnvironmentError.fromPlatform('route', '无法设置系统网页代理，请检查网络后重试', operation, error);
    }
    await this.waitForProxyLease(job, lease, false);
  }

  private releaseProxyLease(lease: ArkWebProxyLease): void {
    lease.releaseRequested = true;
    if (lease.phase !== 'ready') return;
    if (!lease.direct) {
      lease.phase = 'retired';
      lease.error = undefined;
      this.notifyProxyLease(lease);
      return;
    }
    lease.phase = 'removing';
    lease.error = undefined;
    try {
      webview.ProxyController.removeProxyOverride((): void => {
        if (lease.phase !== 'removing') return;
        lease.phase = 'retired';
        this.notifyProxyLease(lease);
      });
    } catch (error) {
      // Fail closed: no later job may load with an unacknowledged old override.
      lease.phase = 'failed';
      lease.error = NetworkEnvironmentError.fromPlatform('route', '系统网页代理尚未恢复，请重新打开应用后重试',
        'proxy.removeProxyOverride', error);
      this.notifyProxyLease(lease);
    }
  }

  onPageEnd(url: string, surface: ArkWebSurface): void {
    if (!this.isSurfaceCurrent(surface)) {
      this.emitDiagnostic('pageEndDiscarded', surface, url);
      return;
    }
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
  onResourceLoad(url: string, surface: ArkWebSurface): void {
    if (!this.isSurfaceCurrent(surface)) {
      this.emitDiagnostic('resourceDiscarded', surface, url);
      return;
    }
    const job = this.active;
    this.emitDiagnostic('resource', job, url);
    const capture = job?.resourceCapture;
    if (job === undefined || capture === undefined || capture.settled || capture.overflowQueued) return;
    if (url === 'about:blank' || url.trim().length === 0) return;
    if (this.blockNetworkUrl(url, surface)) return;
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
      const controller = surface.controller;
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

  finishInteractive(surface: ArkWebSurface): void {
    if (this.isSurfaceCurrent(surface) && this.active?.interactive === true) {
      this.active.userFinished = true;
    }
  }

  cancelInteractive(surface: ArkWebSurface): void {
    if (this.isSurfaceCurrent(surface) && this.active?.interactive === true) {
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
    job.pendingWaitReject?.(this.hostFailure('CANCELLED', 'webview.evaluateJavaScript cancelled', false, { phase: 'runtime' }));
    this.rejectResourceCapture(job, this.hostFailure('CANCELLED', 'webview.evaluateJavaScript cancelled', false, { phase: 'resource' }));
    if (this.active === job) {
      try {
        job.surface?.controller.stop();
      } catch (_) {
        // The controller may already be detached; the shared flag still wins.
      }
    }
  }

  private async run(job: ArkWebJob): Promise<JsonObject> {
    this.assertCurrent(job);
    await this.waitForRetiredSurface(job);
    if (this.proxyLease !== undefined) await this.waitForProxyLease(job, this.proxyLease, true);
    let seeds: ArkWebCookieSeed[] = [];
    let controller: webview.WebviewController | undefined;
    try {
      this.assertCurrent(job);
      this.active = job;
      const id = this.nextSurfaceId++;
      const surface: ArkWebSurface = {
        id, requestId: job.requestId,
        controller: new webview.WebviewController(`reader-source-executor-${id}`),
      };
      job.surface = surface;
      this.surfaceLease = { surface, attached: false, retired: false };
      this.surfaceListener?.(surface);
      controller = await this.waitForController(job);
      this.emitDiagnostic('start', job);
      webview.WebCookieManager.clearAllCookiesSync(true);
      const seedUrl = this.documentUrl(job.document);
      if (seedUrl !== undefined) await this.pinDocumentTarget(job, seedUrl);
      await this.configureProxy(job);
      if (job.profileId !== undefined && seedUrl !== undefined) {
        seeds = await CookieSessionStore.instance.arkWebSeeds(job.profileId);
        this.assertCurrent(job);
        for (const seed of seeds) {
          webview.WebCookieManager.configCookieSync(seed.url, seed.header, true, true);
        }
      }
      this.assertCurrent(job);
      job.pageReadyAt = 0;
      const resourceCapture = job.resourceUrlMatcherJavaScript === undefined ? undefined : this.prepareResourceCapture(job);
      job.loadStarted = true;
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
          this.publishPresentation(job, true, job.presentationTitle);
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
      if (job.httpFailure !== undefined) throw job.httpFailure;
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
        try { this.publishPresentation(job, false, ''); } catch (_) {}
      }
      try {
        controller?.stop();
      } catch (_) {
        // Cleanup is best effort after a detached/render-crashed controller.
      }
      try {
        webview.WebCookieManager.clearAllCookiesSync(true);
      } finally {
        if (job.dnsPinned && job.pinnedHost !== undefined) {
          try { webview.WebviewController.clearHostIP(job.pinnedHost); } catch (_) {}
        }
        if (this.active === job) this.active = undefined;
        const lease = this.surfaceLease;
        if (lease !== undefined && job.surface !== undefined && lease.surface === job.surface) {
          // Revoke callbacks before requesting removal. Only the owning native
          // disappear ACK retires an attached surface; an unmounted request can
          // be withdrawn immediately. Late attach is then rejected by identity.
          if (!lease.attached) lease.retired = true;
          try { this.surfaceListener?.(undefined); } catch (_) {}
        }
        if (job.proxyLease !== undefined) this.releaseProxyLease(job.proxyLease);
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
    const controller = job.surface?.controller;
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
    while (true) {
      this.assertCurrent(job);
      const lease = this.surfaceLease;
      if (lease !== undefined && job.surface !== undefined && lease.surface === job.surface && lease.attached) {
        return lease.surface.controller;
      }
      await delay(100);
    }
  }

  private async waitForRetiredSurface(job: ArkWebJob): Promise<void> {
    while (this.surfaceLease !== undefined && !this.surfaceLease.retired) {
      // Deadline/cancellation bounds a missing native ACK without reusing a
      // still-live Web. The next queued job has its own independent deadline.
      this.assertCurrent(job);
      await delay(50);
    }
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

  private publishPresentation(job: ArkWebJob, visible: boolean, title: string): void {
    if (this.active !== job || job.surface === undefined) return;
    this.presentationListener?.({ visible, title, surfaceId: job.surface.id });
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
    if (job.nativeFailure !== undefined) throw job.nativeFailure;
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

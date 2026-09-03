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
  deadlineAt: number;
  cancelled: boolean;
  pageReadyAt: number;
  finalUrl?: string;
  interactive: boolean;
  presentationTitle: string;
  userFinished: boolean;
};

export type ArkWebPresentation = {
  visible: boolean;
  title: string;
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
    }
  }

  onPageEnd(url: string): void {
    const job = this.active;
    if (job === undefined || job.cancelled) {
      return;
    }
    if (url.trim().length === 0 || url === 'about:blank') {
      return;
    }
    job.finalUrl = url;
    job.pageReadyAt = Date.now() + PAGE_SETTLE_MS + job.settleDelayMillis;
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
    let seeds: ArkWebCookieSeed[] = [];
    try {
      webview.WebCookieManager.clearAllCookiesSync(true);
      const seedUrl = this.documentUrl(job.document);
      if (job.profileId !== undefined && seedUrl !== undefined) {
        seeds = await CookieSessionStore.instance.arkWebSeeds(job.profileId);
        for (const seed of seeds) {
          webview.WebCookieManager.configCookieSync(seed.url, seed.header, true, true);
        }
      }
      this.assertCurrent(job);
      job.pageReadyAt = 0;
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
      await this.waitForStablePage(job);
      if (job.interactive) {
        this.publishPresentation(true, job.presentationTitle);
        while (!job.userFinished) {
          this.assertCurrent(job);
          await delay(100);
        }
      }
      const value = await this.evaluateUntilReady(job, controller);
      this.assertCurrent(job);
      const finalUrl = this.nonBlank(controller.getUrl()) ?? job.finalUrl ?? seedUrl;
      const title = this.nonBlank(controller.getTitle());
      if (job.profileId !== undefined) {
        await this.captureCookies(job.profileId, seeds);
      }
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
              url: finalUrl ?? '',
              autoRetryable: false,
            },
          );
        }
      }
      const result: JsonObject = { value };
      if (finalUrl !== undefined) {
        result['finalUrl'] = finalUrl;
      }
      if (title !== undefined) {
        result['title'] = title;
      }
      return result;
    } finally {
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
      if (this.active === job) {
        this.active = undefined;
      }
    }
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

  private async captureCookies(profileId: string, seeds: ArkWebCookieSeed[]): Promise<void> {
    const records = await webview.WebCookieManager.fetchAllCookies(true);
    const observed: ArkWebObservedCookie[] = [];
    for (const record of records) {
      const normalizedDomain = record.domain.replace(/^\.+/, '');
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
    await CookieSessionStore.instance.reconcileArkWebCookies(profileId, seeds, observed);
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
      headers,
      settleDelayMillis,
      profileId,
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
    for (const key of Object.keys(record)) {
      const raw = record[key];
      if (raw === undefined || raw === null || typeof raw === 'object') {
        throw new Error(`webview.evaluateJavaScript header ${key} must be scalar`);
      }
      headers.push({ headerKey: key, headerValue: `${raw}` });
    }
    return headers;
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
    if (job.cancelled) {
      throw this.hostFailure(
        'CANCELLED',
        'webview.evaluateJavaScript cancelled',
        false,
        { phase: 'runtime', requestId: job.requestId },
      );
    }
    if (Date.now() >= job.deadlineAt) {
      const location = job.finalUrl === undefined ? '' : ` at ${job.finalUrl}`;
      throw this.hostFailure(
        'TIMEOUT',
        `webview.evaluateJavaScript timed out${location}`,
        true,
        { phase: 'runtime', finalUrl: job.finalUrl ?? '' },
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
    const normalized = value.trim().toLowerCase();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      throw new Error('webview document URL must use http or https');
    }
  }

  private nonBlank(value: string): string | undefined {
    return value.trim().length > 0 && value !== 'about:blank' ? value : undefined;
  }
}

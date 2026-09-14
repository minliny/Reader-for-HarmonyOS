import { hilog } from '@kit.PerformanceAnalysisKit';
import type { JsonObject } from '@reader/core-harmony';
import { ArkWebExecutor, type ArkWebDiagnosticEvent } from './ArkWebExecutor';

type DiagnosticRecord = { kind: string; at: number; requestId?: number; resource?: string };
type DiagnosticFailure = { code?: string; details?: JsonObject };
const ORIGIN = 'https://93.184.216.34';
const FIRST_ID = 7600001;
const SECOND_ID = 7600002;

/** Fixed in-memory fixtures for the existing DEBUG pilot. Requests still go
 * through the real ArkWeb kernel and production executor. The provider never
 * forwards network traffic, accepts a user URL, or writes a source/book. */
export class ArkWebResourceDiagnostic {
  private prefix: string = '';
  private records: DiagnosticRecord[] = [];
  private delayed: Map<number, WebResourceResponse> = new Map<number, WebResourceResponse>();
  private intercepted: Set<string> = new Set<string>();
  private interceptionWaiter: (() => void) | undefined = undefined;
  private waitTimer: number | undefined = undefined;
  private running: boolean = false;
  private disposed: boolean = false;
  private runNumber: number = 0;
  private readonly observer = (event: ArkWebDiagnosticEvent): void => {
    const admittedJob = event.requestId === FIRST_ID || event.requestId === SECOND_ID;
    const controlledResource = event.url !== undefined && this.prefix.length > 0 && event.url.startsWith(this.prefix);
    if (!admittedJob && !controlledResource) return;
    // Persist only our generated token/resource label, never a user URL.
    if (event.url !== undefined && !controlledResource && event.kind !== 'pageBegin' && event.kind !== 'pageEnd') return;
    const resource = controlledResource ? event.url!.slice(this.prefix.length) : undefined;
    const label = resource === undefined ? undefined :
      ['early.css', 'hold.js', 'old.js', 'new.js', 'page'].includes(resource) ? resource : 'other-controlled-resource';
    this.record(event.kind, event.requestId, label ??
      (event.url === undefined ? undefined : 'unlabelled-document'), event.at);
  };

  readonly provide = (url: string): WebResourceResponse => {
    if (url === 'about:blank') return null!;
    const response = new WebResourceResponse();
    response.setResponseCode(403);
    response.setReasonMessage('Diagnostic fixture only');
    response.setResponseMimeType('text/plain');
    response.setResponseData('');
    if (this.disposed || !this.running || this.prefix.length === 0 || !url.startsWith(this.prefix)) return response;
    const resource = url.slice(this.prefix.length);
    if (!['early.css', 'hold.js', 'old.js', 'new.js'].includes(resource)) return response;
    response.setResponseCode(200);
    response.setReasonMessage('OK');
    response.setResponseMimeType(resource === 'early.css' ? 'text/css' : 'application/javascript');
    response.setResponseData(resource === 'early.css' ? 'body { color: black; }' : 'void 0;');
    this.intercepted.add(resource);
    this.record('intercept', undefined, resource);
    if (resource === 'old.js') this.interceptionWaiter?.();
    const delay = resource === 'early.css' ? 0 : resource === 'new.js' ? 1000 : 700;
    if (delay > 0) {
      response.setResponseIsReady(false);
      const timer = setTimeout((): void => {
        this.delayed.delete(timer);
        this.record('responseReady', undefined, resource);
        response.setResponseIsReady(true);
      }, delay);
      this.delayed.set(timer, response);
    }
    return response;
  };

  async run(scenario: 'early' | 'cancel'): Promise<string> {
    if (this.disposed || this.running) throw new Error('诊断任务已结束或仍在运行');
    this.running = true;
    this.runNumber += 1;
    this.prefix = `${ORIGIN}/reader-ph76/${Date.now()}-${this.runNumber}/`;
    this.records = [];
    this.intercepted.clear();
    ArkWebExecutor.instance.attachDiagnosticObserver(this.observer);
    try {
      return scenario === 'early' ? await this.runEarly() : await this.runCancel();
    } catch (error) {
      const failure = error as DiagnosticFailure;
      return this.finish(scenario, false, {
        code: typeof failure?.code === 'string' ? failure.code : 'DIAGNOSTIC_FAILURE',
        reason: typeof failure?.details?.['reason'] === 'string' ? failure.details['reason'] :
          'execution-failed-or-fixture-callback-missing',
      });
    } finally {
      ArkWebExecutor.instance.cancel(FIRST_ID);
      ArkWebExecutor.instance.cancel(SECOND_ID);
      this.clearPendingResponses();
      ArkWebExecutor.instance.detachDiagnosticObserver(this.observer);
      this.running = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    ArkWebExecutor.instance.detachDiagnosticObserver(this.observer);
    ArkWebExecutor.instance.cancel(FIRST_ID);
    ArkWebExecutor.instance.cancel(SECOND_ID);
    this.clearPendingResponses();
  }

  private params(body: string, pattern: string): JsonObject {
    const encoded = JSON.stringify(pattern);
    return {
      document: { kind: 'html', body, baseUrl: `${this.prefix}page` },
      javaScript: 'null', timeoutMillis: 4000,
      resourceUrlMatcherJavaScript: `(url) => { const match = new RegExp(${encoded}).exec(url); return match !== null && match.index === 0 && match[0].length === url.length; }`,
    };
  }

  private pattern(resource: string): string {
    return `${this.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${resource}`;
  }

  private async runEarly(): Promise<string> {
    const html = `<html><head><link rel="stylesheet" href="${this.prefix}early.css"><script src="${this.prefix}hold.js"></script></head><body>PH76 early</body></html>`;
    const result = await ArkWebExecutor.instance.execute(this.params(html, this.pattern('early\\.css')), FIRST_ID);
    const resource = this.records.find((event): boolean => event.kind === 'resource' && event.resource === 'early.css');
    const matched = this.records.find((event): boolean => event.kind === 'matched' && event.resource === 'early.css');
    const pageEnd = this.records.find((event): boolean => event.kind === 'pageEnd' && event.requestId === FIRST_ID);
    const pass = result['resourceUrl'] === `${this.prefix}early.css` && resource !== undefined && matched !== undefined &&
      (pageEnd === undefined || matched.at < pageEnd.at);
    return this.finish('early', pass, {
      callbackToMatchMs: resource !== undefined && matched !== undefined ? matched.at - resource.at : -1,
      matchedBeforePageEnd: pageEnd === undefined || (matched !== undefined && matched.at < pageEnd.at),
    });
  }

  private async runCancel(): Promise<string> {
    const oldHtml = `<html><head><script src="${this.prefix}old.js"></script></head><body>old</body></html>`;
    const old = ArkWebExecutor.instance.execute(this.params(oldHtml, this.pattern('never')), FIRST_ID);
    const oldOutcome = old.then((): boolean => false,
      (error: unknown): boolean => (error as DiagnosticFailure).code === 'CANCELLED');
    await this.waitForOldInterception();
    ArkWebExecutor.instance.cancel(FIRST_ID);
    if (!await oldOutcome) throw new Error('旧任务未按取消结束，不能判定跨导航行为');
    if (this.disposed) throw new Error('诊断页面已卸载');
    const newHtml = `<html><head><script src="${this.prefix}new.js"></script></head><body>new</body></html>`;
    const result = await ArkWebExecutor.instance.execute(this.params(newHtml, this.pattern('(old|new)\\.js')), SECOND_ID);
    const late = this.records.filter((event): boolean => event.kind === 'resource' && event.requestId === SECOND_ID && event.resource === 'old.js');
    const newEvent = this.records.find((event): boolean => event.kind === 'resource' && event.requestId === SECOND_ID && event.resource === 'new.js');
    const matched = this.records.find((event): boolean => event.kind === 'matched' && event.requestId === SECOND_ID);
    return this.finish('cancel', result['resourceUrl'] === `${this.prefix}new.js` && late.length === 0, {
      returnedResource: result['resourceUrl'] === `${this.prefix}new.js` ? 'new.js' : 'unexpected',
      observedLateOldCallbacks: late.length,
      callbackToMatchMs: newEvent !== undefined && matched !== undefined ? matched.at - newEvent.at : -1,
    });
  }

  private waitForOldInterception(): Promise<void> {
    if (this.intercepted.has('old.js')) return Promise.resolve();
    return new Promise<void>((resolve, reject): void => {
      this.interceptionWaiter = (): void => {
        if (this.waitTimer !== undefined) clearTimeout(this.waitTimer);
        this.waitTimer = undefined;
        this.interceptionWaiter = undefined;
        if (this.disposed) reject(new Error('诊断页面已卸载')); else resolve();
      };
      this.waitTimer = setTimeout((): void => {
        this.waitTimer = undefined;
        this.interceptionWaiter = undefined;
        reject(new Error('未收到受控 old.js 请求，不能判定跨导航行为'));
      }, 2000);
    });
  }

  private clearPendingResponses(): void {
    this.interceptionWaiter?.();
    if (this.waitTimer !== undefined) clearTimeout(this.waitTimer);
    this.waitTimer = undefined;
    this.interceptionWaiter = undefined;
    this.delayed.forEach((response: WebResourceResponse, timer: number): void => {
      clearTimeout(timer);
      try { response.setResponseIsReady(true); } catch (_) {}
    });
    this.delayed.clear();
  }

  private record(kind: string, requestId?: number, resource?: string, at: number = Date.now()): void {
    if (this.records.length >= 256) return;
    this.records.push({ kind, at, requestId, resource });
  }

  private finish(scenario: string, pass: boolean, measurements: JsonObject): string {
    const result = { scenario, pass, runToken: this.prefix.slice(`${ORIGIN}/reader-ph76/`.length, -1), measurements,
      events: this.records, network: 'in-memory-only', scope: 'one controlled run; not proof of all native callback schedules' };
    const message = JSON.stringify(result);
    hilog.info(0x5244, 'ReaderPh76Pilot', 'READER_PH76_RESULT %{public}s', message);
    return `${pass ? '通过' : '未通过'}：${scenario === 'early' ? '早期资源回调' : '取消后资源归属'}；${JSON.stringify(measurements)}。仅代表本次受控样本，详见 ReaderPh76Pilot。`;
  }
}

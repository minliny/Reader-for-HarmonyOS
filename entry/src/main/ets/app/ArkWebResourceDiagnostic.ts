import { hilog } from '@kit.PerformanceAnalysisKit';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';
import { ArkWebExecutor, type ArkWebDiagnosticEvent } from './ArkWebExecutor';

type DiagnosticDataDocumentShape = {
  metadata: string;
  metadataTruncated: boolean;
  metadataSanitized: boolean;
  hasComma: boolean;
  bodyLength: number;
  hasCurrentDocument: boolean;
  withinLengthBound: boolean;
  matchesCurrentBody: boolean;
  matchesCurrentBase64: boolean;
  uriDecodeAttempted: boolean;
  uriDecodeSucceeded: boolean;
  uriDecodedMatchesCurrentBody: boolean;
  uriDecodedMatchesCurrentBase64: boolean;
};
type DiagnosticRecord = { kind: string; at: number; requestId?: number; resource?: string;
  dataDocument?: DiagnosticDataDocumentShape; currentDocument?: boolean };
type DiagnosticFailure = { code?: string; message?: string; details?: JsonObject };
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
  private documentBody: string = '';
  private documentBodyBase64: string = '';
  private readonly observer = (event: ArkWebDiagnosticEvent): void => {
    const admittedJob = event.requestId === FIRST_ID || event.requestId === SECOND_ID;
    const controlledResource = event.url !== undefined && this.prefix.length > 0 && event.url.startsWith(this.prefix);
    if (!admittedJob && !controlledResource) return;
    // Persist only our generated token/resource label, never a user URL.
    if (event.url !== undefined && !controlledResource && event.kind !== 'pageBegin' && event.kind !== 'pageEnd') return;
    const resource = controlledResource ? event.url!.slice(this.prefix.length) : undefined;
    const label = resource === undefined ? undefined :
      ['early.css', 'hold.js', 'old.js', 'new.js', 'page'].includes(resource) ? resource : 'other-controlled-resource';
    const lifecycle = event.kind === 'pageBegin' || event.kind === 'pageEnd';
    const currentDocument = lifecycle && event.url !== undefined ?
      event.url === `${this.prefix}page` || this.isCurrentDataDocument(event.url) : undefined;
    this.record(event.kind, event.requestId, label ??
      (event.url === undefined ? undefined : this.documentLabel(event.url)), event.at, undefined, currentDocument);
  };

  readonly provide = (url: string): WebResourceResponse => {
    if (url === 'about:blank') return null!;
    const response = new WebResourceResponse();
    response.setResponseCode(403);
    response.setReasonMessage('Diagnostic fixture only');
    response.setResponseMimeType('text/plain');
    response.setResponseData('');
    const active = !this.disposed && this.running && this.prefix.length > 0 && this.documentBody.length > 0;
    if (this.running && this.records.length < 256 && url.startsWith('data:')) {
      this.record('dataDocumentShape', undefined, 'data-document', Date.now(), this.dataDocumentShape(url, active));
    }
    if (active && this.isCurrentDataDocument(url)) {
      this.record('documentAllowed', undefined, 'data-document');
      return null!;
    }
    if (active && url === `${this.prefix}page`) {
      // If a native callback identifies loadData by its base/history URL,
      // Serve our exact HTML here; returning null would permit real HTTP.
      response.setResponseCode(200);
      response.setReasonMessage('OK');
      response.setResponseMimeType('text/html');
      response.setResponseData(this.documentBody);
      this.record('documentProvided', undefined, 'page');
      return response;
    }
    if (!active || !url.startsWith(this.prefix)) {
      if (this.running) this.record('interceptDenied', undefined, this.documentLabel(url));
      return response;
    }
    const resource = url.slice(this.prefix.length);
    if (!['early.css', 'hold.js', 'old.js', 'new.js'].includes(resource)) {
      this.record('interceptDenied', undefined, 'other-controlled-resource');
      return response;
    }
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
      return this.finish(scenario, false, this.failureMeasurements(error));
    } finally {
      ArkWebExecutor.instance.cancel(FIRST_ID);
      ArkWebExecutor.instance.cancel(SECOND_ID);
      this.clearPendingResponses();
      ArkWebExecutor.instance.detachDiagnosticObserver(this.observer);
      this.running = false;
      this.clearDocument();
    }
  }

  private failureMeasurements(error: unknown): JsonObject {
    const failure = error as DiagnosticFailure;
    const details = failure?.details;
    const codes = ['NETWORK_ERROR', 'NETWORK_POLICY_DENIED', 'TLS_ERROR', 'CANCELLED', 'TIMEOUT',
      'RESOURCE_LIMIT_EXCEEDED', 'SCRIPT_EXECUTION_FAILED', 'INVALID_RESOURCE_MATCHER', 'CHALLENGE_REQUIRED'];
    const messages = ['无法读取系统网络代理配置，请检查网络连接后重试', '系统代理配置尚未就绪，请稍后重试',
      '无法设置系统网页代理，请检查网络后重试', '系统网页代理尚未恢复，请重新打开应用后重试',
      '系统网页代理配置尚未生效，请稍后重试', '当前没有可用的系统网络，请检查代理或网络连接后重试',
      '无法确定当前系统网络，请检查代理或网络连接后重试', '当前网络无法解析书源域名，请检查代理或网络连接后重试',
      '当前网络未返回书源地址，请稍后重试', '代理合成地址缺少可用的系统网络路由，请检查代理连接后重试',
      '系统网络已切换，请稍后重试', '系统网络状态已变化，请稍后重试',
      '系统代理连接或认证失败，请检查代理后重试', '系统代理需要认证，请检查代理后重试', '书源网页加载失败'];
    const measurements: JsonObject = {
      code: typeof failure?.code === 'string' && codes.includes(failure.code) ? failure.code : 'DIAGNOSTIC_FAILURE',
      message: typeof failure?.message === 'string' && messages.includes(failure.message) ?
        failure.message : '受控网页执行失败（原始错误信息已省略）',
      reason: 'execution-failed-or-fixture-callback-missing',
    };
    const phase = details?.['phase'];
    if (typeof phase === 'string' && ['dns', 'route', 'transport', 'runtime', 'response', 'resource', 'script', 'navigation'].includes(phase)) {
      measurements['phase'] = phase;
    }
    const operation = details?.['operation'];
    if (typeof operation === 'string' && ['getDefaultHttpProxy', 'getPacUrl', 'getPacFileUrl', 'findProxyForUrl',
      'proxy.configuration', 'proxy.config', 'proxy.insertDirectRule', 'proxy.applyProxyOverride',
      'proxy.removeProxyOverride', 'proxy.configureAck', 'proxy.restoreAck'].includes(operation)) {
      measurements['operation'] = operation;
    }
    const platformCode = details?.['platformCode'];
    if (typeof platformCode === 'number' && Number.isSafeInteger(platformCode)) measurements['platformCode'] = platformCode;
    const platformType = details?.['platformType'];
    if (typeof platformType === 'string' && ['TypeError', 'RangeError', 'Error', 'object', 'string', 'number',
      'undefined', 'null', 'boolean', 'symbol', 'bigint', 'function'].includes(platformType)) {
      measurements['platformType'] = platformType;
    }
    return measurements;
  }

  dispose(): void {
    this.disposed = true;
    ArkWebExecutor.instance.detachDiagnosticObserver(this.observer);
    ArkWebExecutor.instance.cancel(FIRST_ID);
    ArkWebExecutor.instance.cancel(SECOND_ID);
    this.clearPendingResponses();
    this.clearDocument();
  }

  private params(body: string, pattern: string): JsonObject {
    this.documentBody = body;
    this.documentBodyBase64 = new util.Base64Helper().encodeToStringSync(new util.TextEncoder('utf-8').encode(body));
    const encoded = JSON.stringify(pattern);
    return {
      document: { kind: 'html', body, baseUrl: `${this.prefix}page` },
      javaScript: 'null', timeoutMillis: 4000,
      resourceUrlMatcherJavaScript: `(url) => { const match = new RegExp(${encoded}).exec(url); return match !== null && match.index === 0 && match[0].length === url.length; }`,
    };
  }

  private isCurrentDataDocument(url: string): boolean {
    // This is an exact fixture identity check, not a general data-URL policy.
    // Native codecs remain platform-owned; arbitrary HTML is never admitted.
    if (url.length > this.documentBody.length * 4 + 128) return false;
    const comma = url.indexOf(',');
    if (comma < 0) return false;
    const type = url.slice(0, comma).toLowerCase();
    const body = url.slice(comma + 1);
    if (type === 'data:text/html;base64' || type === 'data:text/html;charset=utf-8;base64') {
      if (body === this.documentBodyBase64) return true;
      // Native loadData percent-encodes its Base64 data body. The decoded
      // value must still equal this run's exact platform-generated encoding.
      try { return decodeURIComponent(body) === this.documentBodyBase64; } catch (_) { return false; }
    }
    if (type !== 'data:text/html' && type !== 'data:text/html;charset=utf-8') return false;
    if (body === this.documentBody) return true;
    try { return decodeURIComponent(body) === this.documentBody; } catch (_) { return false; }
  }

  private dataDocumentShape(url: string, active: boolean): DiagnosticDataDocumentShape {
    const comma = url.indexOf(',');
    // No comma means there is no proven metadata/body boundary to log.
    const metadata = comma < 0 ? '' : url.slice(5, Math.min(comma, 101));
    // Redact the entire header rather than leak pieces of an embedded URL or
    // arbitrary text after replacing only its punctuation.
    const safeMetadata = /^[A-Za-z0-9 /;=+._%-]*$/.test(metadata) && !/(\/\/|%3a|%2f%2f)/i.test(metadata);
    const sanitized = safeMetadata ? metadata : 'redacted';
    const withinLengthBound = url.length <= this.documentBody.length * 4 + 128;
    const shape: DiagnosticDataDocumentShape = {
      metadata: sanitized, metadataTruncated: comma > 101, metadataSanitized: metadata !== sanitized,
      hasComma: comma >= 0, bodyLength: comma < 0 ? 0 : url.length - comma - 1,
      hasCurrentDocument: active, withinLengthBound,
      matchesCurrentBody: false, matchesCurrentBase64: false,
      uriDecodeAttempted: false, uriDecodeSucceeded: false,
      uriDecodedMatchesCurrentBody: false, uriDecodedMatchesCurrentBase64: false,
    };
    // Diagnostics never decode an unbounded/unowned body, and never return
    // body text, decoded text or the original URL to the public log.
    if (!active || comma < 0 || !withinLengthBound) return shape;
    const body = url.slice(comma + 1);
    shape.matchesCurrentBody = body === this.documentBody;
    shape.matchesCurrentBase64 = body === this.documentBodyBase64;
    shape.uriDecodeAttempted = true;
    try {
      const decoded = decodeURIComponent(body);
      shape.uriDecodeSucceeded = true;
      shape.uriDecodedMatchesCurrentBody = decoded === this.documentBody;
      shape.uriDecodedMatchesCurrentBase64 = decoded === this.documentBodyBase64;
    } catch (_) {}
    return shape;
  }

  private documentLabel(url: string): string {
    if (url === 'about:blank') return 'about-blank';
    if (url.startsWith('data:')) return 'data-document';
    if (url.startsWith('blob:')) return 'blob-document';
    if (url.startsWith('http:') || url.startsWith('https:')) return 'other-http-document';
    return 'other-document';
  }

  private clearDocument(): void {
    this.documentBody = '';
    this.documentBodyBase64 = '';
  }

  private pattern(resource: string): string {
    return `${this.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${resource}`;
  }

  private async runEarly(): Promise<string> {
    const html = `<html><head><link rel="stylesheet" href="${this.prefix}early.css"><script src="${this.prefix}hold.js"></script></head><body>PH76 early</body></html>`;
    const result = await ArkWebExecutor.instance.execute(this.params(html, this.pattern('early\\.css')), FIRST_ID);
    const started = this.records.findIndex((event): boolean => event.kind === 'start' && event.requestId === FIRST_ID);
    const events = started < 0 ? [] : this.records.slice(started + 1).filter((event): boolean => event.requestId === FIRST_ID);
    const resource = events.find((event): boolean => event.kind === 'resource' && event.resource === 'early.css');
    const matcher = events.find((event): boolean => event.kind === 'matcherStart' && event.resource === 'early.css');
    const matched = events.find((event): boolean => event.kind === 'matched' && event.resource === 'early.css');
    // The native Web mounts about:blank before the requested loadData. Keep
    // those callbacks in the receipt, but never treat them as the fixture's
    // completion. Exact body/base-URL identity also excludes stale data pages.
    const pageEnd = events.find((event): boolean => event.kind === 'pageEnd' && event.currentDocument === true);
    const unexpectedDocument = events.some((event): boolean => (event.kind === 'pageBegin' || event.kind === 'pageEnd') &&
      event.resource !== 'about-blank' && event.currentDocument !== true);
    const orderedMatch = resource !== undefined && matcher !== undefined && matched !== undefined &&
      events.indexOf(resource) < events.indexOf(matcher) && events.indexOf(matcher) < events.indexOf(matched) &&
      resource.at <= matcher.at && matcher.at <= matched.at;
    const beforePageEnd = orderedMatch && !unexpectedDocument &&
      (pageEnd === undefined || (matched !== undefined && matched.at < pageEnd.at));
    const pass = result['resourceUrl'] === `${this.prefix}early.css` && beforePageEnd;
    return this.finish('early', pass, {
      callbackToMatchMs: resource !== undefined && matched !== undefined ? matched.at - resource.at : -1,
      matchedBeforePageEnd: beforePageEnd,
      observedTargetPageEnd: pageEnd !== undefined,
      unexpectedDocument,
      orderedMatch,
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
    const matched = this.records.find((event): boolean => event.kind === 'matched' && event.requestId === SECOND_ID && event.resource === 'new.js');
    const newCallbackMatched = newEvent !== undefined && matched !== undefined && matched.at >= newEvent.at &&
      this.records.indexOf(matched) > this.records.indexOf(newEvent);
    return this.finish('cancel', result['resourceUrl'] === `${this.prefix}new.js` && late.length === 0 && newCallbackMatched, {
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

  private record(kind: string, requestId?: number, resource?: string, at: number = Date.now(),
    dataDocument?: DiagnosticDataDocumentShape, currentDocument?: boolean): void {
    if (this.records.length >= 256) return;
    this.records.push({ kind, at, requestId, resource, dataDocument, currentDocument });
  }

  private finish(scenario: string, pass: boolean, measurements: JsonObject): string {
    const result = { scenario, pass, runToken: this.prefix.slice(`${ORIGIN}/reader-ph76/`.length, -1), measurements,
      events: this.records, network: 'in-memory-only', scope: 'one controlled run; not proof of all native callback schedules' };
    const message = JSON.stringify(result);
    hilog.info(0x5244, 'ReaderPh76Pilot', 'READER_PH76_RESULT %{public}s', message);
    return `${pass ? '通过' : '未通过'}：${scenario === 'early' ? '早期资源回调' : '取消后资源归属'}；${JSON.stringify(measurements)}。仅代表本次受控样本，详见 ReaderPh76Pilot。`;
  }
}

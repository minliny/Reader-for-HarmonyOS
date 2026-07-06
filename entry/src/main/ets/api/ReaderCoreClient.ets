// ReaderCoreClient — App-level singleton holding ReaderCoreRuntime + HostAdapter.
//
// Initialized in EntryAbility.onCreate(). Routes Core events:
//   - result/error → resolved by awaitResult(requestId)
//   - host.request → HostAdapter.dispatch → completeHostRequest/failHostRequest
//
// S6 simplification: awaitResult polls readEvent inline and routes host.request
// events itself. This avoids the race the original plan acknowledged between
// a separate HostRuntime event loop and awaitResult polling. S6 accepts serial
// business requests; S7 needs a proper event multiplexer for concurrency.
//
// Host capability registration (production router wiring — 3/3 lane parity with
// Android / iOS and with the non-production HostRuntime.ets):
//   - http.execute                → makeHttpExecuteHandler(transport)  [login_cookie]
//   - cookie.get / cookie.set     → makeCookieGet/SetHandler(cookieStore)  [login_cookie]
//   - webview.evaluateJavaScript  → makeWebViewEvaluateJavaScriptHandler(ArkWebViewExecutor stub)  [webview_render]
//   - media.download              → makeMediaDownloadHandler(ArkMediaDownloadExecutor stub)  [media_download]
//   - anti_bot.challenge          → AntiBotChallengeHandler adapter (ArkAntiBotExecutor stub)  [anti_bot]
//
// Executors for webview / media / anti_bot remain stubs (notImplemented) — this
// wiring makes the production router dispatch path complete so a Core host.request
// for these lanes reaches the handler. Real device-headless execution requires
// DevEco Studio + simulator/device (canEnterMainline=false — see
// HostRouterDispatchProof.ets header).
import { ReaderCoreRuntime } from '../cabi/ReaderCoreNapiBridge';
import { HostAdapter } from '../host/HostAdapter';
import { HostTransport } from '../host/HostTransport';
import { OHOSHTTPHostTransport } from '../host/OHOSHTTPHostTransport';
import { makeHttpExecuteHandler } from '../host/HttpExecuteHandler';
import { makeCookieGetHandler } from '../host/CookieGetHandler';
import { makeCookieSetHandler } from '../host/CookieSetHandler';
import { CookieStore, InMemoryCookieStore } from '../host/CookieStore';
import { makeWebViewEvaluateJavaScriptHandler, ArkWebViewExecutor } from '../host/WebViewEvaluateJavaScriptHandler';
import { makeMediaDownloadHandler, ArkMediaDownloadExecutor } from '../host/MediaDownloadHandler';
import { AntiBotChallengeHandler, ArkAntiBotExecutor, AntiBotChallengeDetector } from '../host/AntiBotChallengeHandler';
import { CapabilityHandler } from '../host/CapabilityHandler';
import { HostReply, hostReplyError } from '../host/HostReply';

// Capability string for the anti_bot lane coordinator. anti_bot is a HostLane
// (not a HostCapability) in Core — it composes http.execute + cookie + challenge
// detection. This string is the routing key the HostAdapter uses to dispatch
// anti_bot challenge requests; Core does not emit this capability directly
// (the lane coordinator is host-side), but registering it makes the router
// dispatch path complete for the anti_bot lane.
const ANTI_BOT_CHALLENGE_CAPABILITY = 'anti_bot.challenge';

export class ReaderCoreClient {
  private runtime: ReaderCoreRuntime;
  private adapter: HostAdapter;
  private cookieStore: CookieStore;
  private nextRequestId: number = 1;
  private static INSTANCE: ReaderCoreClient | null = null;

  private constructor() {
    this.runtime = ReaderCoreRuntime.create();
    this.adapter = new HostAdapter();
    this.cookieStore = new InMemoryCookieStore();
    const transport: HostTransport = new OHOSHTTPHostTransport();
    // login_cookie lane: http.execute + cookie.get + cookie.set
    this.adapter.register('http.execute', makeHttpExecuteHandler(transport));
    this.adapter.register('cookie.get', makeCookieGetHandler(this.cookieStore));
    this.adapter.register('cookie.set', makeCookieSetHandler(this.cookieStore));
    // webview_render lane: webview.evaluateJavaScript (ArkWebViewExecutor stub)
    this.adapter.register('webview.evaluateJavaScript', makeWebViewEvaluateJavaScriptHandler(new ArkWebViewExecutor()));
    // media_download lane: media.download (ArkMediaDownloadExecutor stub)
    this.adapter.register('media.download', makeMediaDownloadHandler(new ArkMediaDownloadExecutor()));
    // anti_bot lane: anti_bot.challenge (ArkAntiBotExecutor stub — lane coordinator adapter)
    this.adapter.register(
      ANTI_BOT_CHALLENGE_CAPABILITY,
      makeAntiBotChallengeCapabilityHandler(new ArkAntiBotExecutor(), new AntiBotChallengeDetector())
    );
  }

  static init(): ReaderCoreClient {
    if (ReaderCoreClient.INSTANCE === null) {
      ReaderCoreClient.INSTANCE = new ReaderCoreClient();
    }
    return ReaderCoreClient.INSTANCE;
  }

  static get(): ReaderCoreClient {
    if (ReaderCoreClient.INSTANCE === null) {
      throw new Error('ReaderCoreClient not initialized. Call init() in EntryAbility.onCreate().');
    }
    return ReaderCoreClient.INSTANCE;
  }

  static isInitialized(): boolean {
    return ReaderCoreClient.INSTANCE !== null;
  }

  // Read-only access to the HostAdapter for router-dispatch proofs. Production
  // dispatch flows through handleHostRequest → adapter.dispatch (the same
  // adapter exposed here). Mirrors HostRuntime.hostAdapter getter.
  get hostAdapter(): HostAdapter {
    return this.adapter;
  }

  // Read-only access to the CookieStore for proofs that need to verify
  // cookie.get / cookie.set side effects via the router dispatch path.
  get hostCookieStore(): CookieStore {
    return this.cookieStore;
  }

  // Send a JSON command to Core and return the requestId for awaitResult.
  sendCommand(method: string, params: object): number {
    const requestId = this.nextRequestId;
    this.nextRequestId = requestId + 1;
    this.runtime.sendCommand(method, params, requestId);
    return requestId;
  }

  // Wait for the result/error event for the given requestId. Polls readEvent
  // inline; host.request events encountered are dispatched to HostAdapter and
  // replied via completeHostRequest/failHostRequest. Events for other
  // requestIds are dropped (S6 serial — only one business request in flight).
  async awaitResult(requestId: number, timeoutMs: number = 60000): Promise<object> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.runtime.pendingEventCount() === 0) {
        await this.sleep(10);
        continue;
      }
      const raw = this.runtime.readEvent(0);
      if (raw === null) {
        continue;
      }
      const parsed = this.parseEvent(raw);
      if (parsed === null) {
        continue; // malformed event, drop
      }
      if (parsed.type === 'host.request') {
        await this.handleHostRequest(parsed);
        continue;
      }
      if (parsed.requestId !== requestId) {
        continue; // not our event — drop (S6 serial). S7 needs a multiplexer.
      }
      if (parsed.type === 'result') {
        return parsed.data ?? ({} as Record<string, Object>);
      }
      if (parsed.type === 'error' && parsed.error !== null) {
        throw new Error(`Core error: ${parsed.error.code} — ${parsed.error.message}`);
      }
    }
    throw new Error(`Timeout waiting for Core response (requestId=${requestId}, timeoutMs=${timeoutMs})`);
  }

  private async handleHostRequest(parsed: ParsedEvent): Promise<void> {
    if (parsed.capability === null || parsed.operationId === null) {
      return;
    }
    const params = (parsed.params ?? ({} as Record<string, Object>)) as Record<string, Object>;
    const reply: HostReply = await this.adapter.dispatch(parsed.capability, params);
    if (reply.ok) {
      const result = reply.result ?? ({} as Record<string, Object>);
      this.runtime.completeHostRequest(parsed.operationId, result);
    } else {
      const errorObj: Record<string, Object> = {} as Record<string, Object>;
      errorObj['code'] = reply.code ?? 'INTERNAL';
      errorObj['message'] = reply.message ?? '';
      errorObj['retryable'] = reply.retryable ?? false;
      this.runtime.failHostRequest(parsed.operationId, errorObj);
    }
  }

  private parseEvent(raw: string): ParsedEvent | null {
    let parsed: Record<string, Object>;
    try {
      parsed = JSON.parse(raw) as Record<string, Object>;
    } catch (_e) {
      return null;
    }
    const typeValue = parsed['type'];
    if (typeof typeValue !== 'string') {
      return null;
    }
    const type = typeValue as string;
    const requestIdValue = parsed['requestId'];
    const requestId = typeof requestIdValue === 'number' ? (requestIdValue as number) : 0;
    if (type === 'result') {
      const dataValue = parsed['data'];
      const data = (dataValue !== null && dataValue !== undefined && typeof dataValue === 'object')
        ? dataValue as object
        : null;
      return { requestId, type: 'result', data, error: null, capability: null, operationId: null, params: null };
    }
    if (type === 'error') {
      const errValue = parsed['error'];
      const errRecord = (errValue !== null && errValue !== undefined && typeof errValue === 'object')
        ? errValue as Record<string, Object>
        : ({} as Record<string, Object>);
      const error: CoreError = {
        code: typeof errRecord['code'] === 'string' ? (errRecord['code'] as string) : 'UNKNOWN',
        message: typeof errRecord['message'] === 'string' ? (errRecord['message'] as string) : '',
        retryable: typeof errRecord['retryable'] === 'boolean' ? (errRecord['retryable'] as boolean) : false
      };
      return { requestId, type: 'error', data: null, error, capability: null, operationId: null, params: null };
    }
    if (type === 'host.request') {
      const capabilityValue = parsed['capability'];
      const operationIdValue = parsed['operationId'];
      const paramsValue = parsed['params'];
      return {
        requestId,
        type: 'host.request',
        data: null,
        error: null,
        capability: typeof capabilityValue === 'string' ? (capabilityValue as string) : null,
        operationId: typeof operationIdValue === 'number' ? (operationIdValue as number) : null,
        params: (paramsValue !== null && paramsValue !== undefined && typeof paramsValue === 'object')
          ? paramsValue as Record<string, Object>
          : null
      };
    }
    return null;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, ms);
    });
  }

  close(): void {
    this.runtime.release();
    ReaderCoreClient.INSTANCE = null;
  }
}

// Adapter: wraps AntiBotChallengeHandler.handle into a CapabilityHandler so the
// anti_bot lane can be routed through HostAdapter like the other lanes. anti_bot
// is a lane coordinator (not a single Core HostCapability — see
// AntiBotChallengeHandler.ets header), so this adapter extracts url / headers /
// cookieJarId from params and delegates to AntiBotChallengeHandler.handle.
// Mirrors the makeXxxHandler factory pattern (makeHttpExecuteHandler,
// makeCookieGetHandler, makeWebViewEvaluateJavaScriptHandler,
// makeMediaDownloadHandler) but kept module-local because the anti_bot handler
// is a lane coordinator (not a Core HostCapability).
function makeAntiBotChallengeCapabilityHandler(
  executor: ArkAntiBotExecutor,
  detector: AntiBotChallengeDetector
): CapabilityHandler {
  const handler: AntiBotChallengeHandler = new AntiBotChallengeHandler(executor, detector);
  const capabilityHandler: CapabilityHandler = async (params: Record<string, Object>): Promise<HostReply> => {
    const urlValue = params['url'];
    if (typeof urlValue !== 'string' || (urlValue as string).length === 0) {
      return hostReplyError('INVALID_ARGUMENT', 'anti_bot.challenge requires non-empty url', false);
    }
    const url = urlValue as string;
    const headersValue = params['headers'];
    let headers: Record<string, string> = {} as Record<string, string>;
    if (headersValue !== null && headersValue !== undefined && typeof headersValue === 'object') {
      headers = headersValue as Record<string, string>;
    }
    const cookieJarIdValue = params['cookieJarId'];
    const cookieJarId: string | undefined =
      typeof cookieJarIdValue === 'string' ? cookieJarIdValue as string : undefined;
    return handler.handle(url, headers, cookieJarId);
  };
  return capabilityHandler;
}

interface CoreError {
  code: string;
  message: string;
  retryable: boolean;
}

interface ParsedEvent {
  requestId: number;
  type: 'result' | 'error' | 'host.request';
  data: object | null;
  error: CoreError | null;
  capability: string | null;
  operationId: number | null;
  params: Record<string, Object> | null;
}

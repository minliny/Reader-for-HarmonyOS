// HostSmoke.test — Host integration smoke tests.
//
// Host unit layer — structural registry and adapter behavior. It does not require a live
//     NAPI runtime. CoreRuntime is constructed with a no-op native module stub
//     so it can be exercised in the unit-test environment without
//     libreader_core_napi.so. Failures here indicate a wiring regression in
//     CoreRuntime.registerHandlers() that would also break on device.
//
// Real NAPI ping/coreInfo proof is deliberately outside this host suite.
// `npm run test:device` launches EntryAbility's CoreSelfCheck on an hdc target
// and fails unless fresh [CoreSelfCheck] evidence is verified.
import { describe, it, expect } from '@ohos/hypium';
import http from '@ohos.net.http';
import common from '@ohos.app.ability.common';
import { CoreRuntime, type LocalBookParseOptions, type CoreTxtTocRuleCreateInput,
  type CoreTxtTocRuleUpdateInput, type CoreTtsConfigInput, type CoreBookmarkUpdateInput } from '../../bridge/CoreRuntime';
import {
  type NativeReaderCoreModule,
  type JsonObject,
  type NativeRuntimeHandle,
  type ReaderCoreLastError,
  type ReaderCoreError,
} from '../../bridge/core/sdk/reader_core';
import {
  type HostCapability,
  type HostHttpRequest,
} from '../types';
import { SourceSessionHostStore } from '../adapters/SourceSessionHostStore';
import {
  HttpHostAdapter,
  type HostHttpClient,
  type HostHttpClientFactory,
  type HostHttpStreamClient,
  type HostHttpStreamClientFactory,
} from '../adapters/HttpHostAdapter';
import {
  SourceImageCache,
  SourceImageResponsePolicy,
  SOURCE_IMAGE_MAX_BYTES,
  type SourceImageFileStore,
  type SourceImageHeaderResolver,
  type SourceImageStreamClient,
  type SourceImageStreamClientFactory,
} from '../adapters/SourceImageCache';
import { FileHostAdapter } from '../adapters/FileHostAdapter';
import { CoreHostAdapter } from '../adapters/CoreHostAdapter';

// Stub class that satisfies NativeReaderCoreModule without touching
// libreader_core_napi.so. ArkTS requires object literals to correspond to a
// declared class/interface, so we use a class instead of an inline object.
class StubNativeReaderCore implements NativeReaderCoreModule {
  abiVersion(): number { return 1; }
  lastError(): ReaderCoreLastError { return { code: 0, message: '' }; }
  createRuntime(_config?: JsonObject | string): NativeRuntimeHandle {
    return new Object() as Object as NativeRuntimeHandle;
  }
  releaseRuntime(_runtime: NativeRuntimeHandle): void { /* no-op */ }
  sendCommand(_runtime: NativeRuntimeHandle, _command: JsonObject | string): void { /* no-op */ }
  cancelRequest(_runtime: NativeRuntimeHandle, _requestId: number): void { /* no-op */ }
  readEvent(_runtime: NativeRuntimeHandle, _timeoutMs?: number): string | null { return null; }
  pendingEventCount(_runtime: NativeRuntimeHandle): number { return 0; }
  completeHostRequest(_runtime: NativeRuntimeHandle, _operationId: number, _result: JsonObject | string, _requestId?: number): void { /* no-op */ }
  failHostRequest(_runtime: NativeRuntimeHandle, _operationId: number, _error: ReaderCoreError | JsonObject | string, _requestId?: number): void { /* no-op */ }
  pingSmoke(): string { return '{"protocolVersion":1,"requestId":1,"type":"result","data":{"stub":true}}'; }
  hostSmoke(): string { return '{"protocolVersion":1,"requestId":1,"type":"result","data":{"stub":true}}'; }
  lifecycleSmoke(_iterations?: number): string { return '{"protocolVersion":1,"requestId":1,"type":"result","data":{"stub":true}}'; }
}

function makeStubNativeModule(): NativeReaderCoreModule {
  return new StubNativeReaderCore();
}

/** Native stub that records the exact command envelope and returns a result. */
class RecordingNativeReaderCore extends StubNativeReaderCore {
  lastMethod: string = '';
  lastRequestId: number = 0;
  cancelledRequestIds: number[] = [];
  autoRespond: boolean = true;
  nextSuccessData: JsonObject | null = null;
  private lastParams: JsonObject = {};
  private nextEvent: string | null = null;

  sendCommand(_runtime: NativeRuntimeHandle, command: JsonObject | string): void {
    const envelope = (typeof command === 'string'
      ? JSON.parse(command)
      : command) as Object as JsonObject;
    const stringEnvelope = envelope as Object as Record<string, string>;
    const objectEnvelope = envelope as Object as Record<string, JsonObject>;
    const numberEnvelope = envelope as Object as Record<string, number>;
    const method: string = stringEnvelope['method'];
    const params: JsonObject = objectEnvelope['params'];
    const requestId: number = numberEnvelope['requestId'];
    this.lastMethod = typeof method === 'string' ? method : '';
    this.lastRequestId = requestId;
    this.lastParams = params;
    if (this.autoRespond) {
      this.queueSuccess(requestId);
    }
  }

  queueSuccess(requestId: number): void {
    const resultData: JsonObject = this.nextSuccessData ?? {};
    if (this.nextSuccessData === null) {
      resultData['acknowledged'] = true;
    }
    this.nextSuccessData = null;
    const resultEvent: JsonObject = {};
    resultEvent['protocolVersion'] = 1;
    resultEvent['requestId'] = requestId;
    resultEvent['type'] = 'result';
    resultEvent['data'] = resultData;
    this.nextEvent = JSON.stringify(resultEvent);
  }

  cancelRequest(_runtime: NativeRuntimeHandle, requestId: number): void {
    this.cancelledRequestIds.push(requestId);
  }

  readEvent(_runtime: NativeRuntimeHandle, _timeoutMs?: number): string | null {
    const event = this.nextEvent;
    this.nextEvent = null;
    return event;
  }

  pendingEventCount(_runtime: NativeRuntimeHandle): number {
    return this.nextEvent === null ? 0 : 1;
  }

  stringParam(key: string): string {
    const fields = this.lastParams as Object as Record<string, string>;
    const value: string = fields[key];
    return typeof value === 'string' ? value : '';
  }

  numberParam(key: string): number {
    const fields = this.lastParams as Object as Record<string, number>;
    const value: number = fields[key];
    return typeof value === 'number' ? value : 0;
  }

  objectParam(key: string): JsonObject {
    const fields = this.lastParams as Object as Record<string, JsonObject>;
    const value: JsonObject = fields[key];
    return value;
  }

  booleanParam(key: string): boolean {
    const fields = this.lastParams as Object as Record<string, boolean>;
    const value: boolean = fields[key];
    return typeof value === 'boolean' ? value : false;
  }

  stringArrayParam(key: string): string[] {
    const fields = this.lastParams as Object as Record<string, Object>;
    return fields[key] as Object as string[];
  }

  hasParam(key: string): boolean {
    const fields = this.lastParams as Object as Record<string, Object>;
    return fields[key] !== undefined;
  }
}

class ImmediateHttpResponse {
  result: string = 'ok';
  resultType: http.HttpDataType = http.HttpDataType.STRING;
  responseCode: number = 200;
  header: Object = new Object();
  cookies: string = '';
  performanceTiming: Object = new Object();
}

class ImmediateHostHttpClient implements HostHttpClient {
  destroyCount: number = 0;

  request(_url: string, _options: http.HttpRequestOptions): Promise<http.HttpResponse> {
    const response = new ImmediateHttpResponse() as Object as http.HttpResponse;
    return Promise.resolve(response);
  }

  destroy(): void {
    this.destroyCount += 1;
  }
}

class RecordingHostHttpClientFactory implements HostHttpClientFactory {
  clients: ImmediateHostHttpClient[] = [];

  create(): HostHttpClient {
    const client = new ImmediateHostHttpClient();
    this.clients.push(client);
    return client;
  }
}

class RecordingMediaFileAdapter {
  openedPath: string = '';
  appendedBytes: number = 0;
  committed: boolean = false;
  discarded: boolean = false;

  openAtomicPart(path: string, _createDirectories: boolean): void {
    this.openedPath = path;
    this.appendedBytes = 0;
    this.committed = false;
    this.discarded = false;
  }

  appendAtomicPart(path: string, chunk: ArrayBuffer): void {
    if (path !== this.openedPath) throw new Error('unexpected media part path');
    this.appendedBytes += chunk.byteLength;
  }

  commitAtomicPart(path: string): void {
    if (path !== this.openedPath) throw new Error('unexpected media commit path');
    this.committed = true;
  }

  discardAtomicPart(path: string): void {
    if (path === this.openedPath) this.discarded = true;
  }
}

class SourceImageTestHeaderResolver implements SourceImageHeaderResolver {
  lastRequestUrl: string = '';

  buildRequestHeaders(request: HostHttpRequest): Record<string, string> {
    this.lastRequestUrl = request.url;
    const headers: Record<string, string> = {};
    const keys = Object.keys(request.headers);
    for (let index = 0; index < keys.length; index++) headers[keys[index]] = request.headers[keys[index]];
    headers['X-Host-Session'] = 'present';
    return headers;
  }
}

class MemorySourceImageFileStore implements SourceImageFileStore {
  private files: Map<string, string> = new Map<string, string>();
  private parts: Map<string, number> = new Map<string, number>();
  openCount: number = 0;
  discardCount: number = 0;
  cleanupCount: number = 0;

  getCachedUri(key: string): string | null {
    return this.files.get(key) ?? null;
  }

  openPart(key: string): void {
    this.openCount += 1;
    this.parts.set(key, 0);
  }

  appendPart(key: string, chunk: ArrayBuffer): void {
    const current = this.parts.get(key);
    if (current === undefined) throw new Error('part missing');
    this.parts.set(key, current + chunk.byteLength);
  }

  commitPart(key: string): string {
    const size = this.parts.get(key);
    if (size === undefined || size <= 0) throw new Error('missing bytes');
    this.parts.delete(key);
    const uri = `file://memory/${key}.img`;
    this.files.set(key, uri);
    return uri;
  }

  discardPart(key: string): void {
    this.discardCount += 1;
    this.parts.delete(key);
  }

  cleanup(): void {
    this.cleanupCount += 1;
  }
}

class SourceImageTestHeaders {
  contentType: string;
  contentLength: string;

  constructor(contentType: string, contentLength: string = '') {
    this.contentType = contentType;
    this.contentLength = contentLength;
  }
}

class ManualSourceImageStreamClient implements SourceImageStreamClient, HostHttpStreamClient {
  private headerCallback: ((headers: Object) => void) | null = null;
  private dataCallback: ((chunk: ArrayBuffer) => void) | null = null;
  private endCallback: (() => void) | null = null;
  private resolveStatus: ((status: number) => void) | null = null;
  private rejectStatus: ((error: Error) => void) | null = null;
  requestUrl: string = '';
  requestHeaders: Record<string, string> = {};
  destroyed: boolean = false;

  onHeaders(callback: (headers: Object) => void): void {
    this.headerCallback = callback;
  }

  onData(callback: (chunk: ArrayBuffer) => void): void {
    this.dataCallback = callback;
  }

  onEnd(callback: () => void): void {
    this.endCallback = callback;
  }

  request(url: string, options: http.HttpRequestOptions): Promise<number> {
    this.requestUrl = url;
    this.requestHeaders = options.header as Record<string, string>;
    return new Promise<number>((resolve: (status: number) => void, reject: (error: Error) => void): void => {
      this.resolveStatus = resolve;
      this.rejectStatus = reject;
    });
  }

  destroy(): void {
    this.destroyed = true;
  }

  emitHeaders(contentType: string, contentLength: string = ''): void {
    if (this.headerCallback !== null) {
      this.headerCallback(new SourceImageTestHeaders(contentType, contentLength) as Object);
    }
  }

  emitData(bytes: number): void {
    if (this.dataCallback !== null) this.dataCallback(new ArrayBuffer(bytes));
  }

  emitEnd(): void {
    if (this.endCallback !== null) this.endCallback();
  }

  emitStatus(status: number): void {
    if (this.resolveStatus !== null) this.resolveStatus(status);
  }

  emitFailure(): void {
    if (this.rejectStatus !== null) this.rejectStatus(new Error('network failed'));
  }
}

class ManualSourceImageStreamClientFactory implements SourceImageStreamClientFactory, HostHttpStreamClientFactory {
  clients: ManualSourceImageStreamClient[] = [];

  create(): ManualSourceImageStreamClient {
    const client = new ManualSourceImageStreamClient();
    this.clients.push(client);
    return client;
  }
}

class FakeContextDirectories {
  filesDir: string = '/sandbox/files';
  cacheDir: string = '/sandbox/cache';
}

export default function HostSmokeTest(): void {
  describe('HostSmoke', () => {

    // ── Layer A: structural — registry wiring, no NAPI required ──
    // These must pass in BOTH the unit-test environment and on device.

    it('registry_should_have_http_execute', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getRegistry().has('http.execute')).assertTrue();
    });

    it('http_cancel_is_request_scoped_and_unknown_ids_fail_closed', 0, async () => {
      const factory = new RecordingHostHttpClientFactory();
      const adapter = new HttpHostAdapter(SourceSessionHostStore.shared(), factory);
      const first = adapter.execute({
        url: 'https://example.org/one',
        method: 'GET',
        headers: {},
      }, 'request-one');
      const second = adapter.execute({
        url: 'https://example.org/two',
        method: 'GET',
        headers: {},
      }, 'request-two');

      expect(factory.clients.length).assertEqual(2);
      expect(adapter.cancel('missing-request').cancelled).assertFalse();
      expect(factory.clients[0].destroyCount).assertEqual(0);
      expect(factory.clients[1].destroyCount).assertEqual(0);

      expect(adapter.cancel('request-one').cancelled).assertTrue();
      expect(factory.clients[0].destroyCount).assertEqual(1);
      expect(factory.clients[1].destroyCount).assertEqual(0);
      expect(adapter.cancel('request-one').cancelled).assertFalse();

      expect(adapter.cancel('request-two').cancelled).assertTrue();
      expect(factory.clients[1].destroyCount).assertEqual(1);
      expect(adapter.cancel('').cancelled).assertFalse();
      await first;
      await second;
      expect(factory.clients[0].destroyCount).assertEqual(1);
      expect(factory.clients[1].destroyCount).assertEqual(1);
    });

    it('media_download_preserves_binary_bytes_and_honors_range_validators_and_limit', 0, async () => {
      const streamFactory = new ManualSourceImageStreamClientFactory();
      const httpAdapter = new HttpHostAdapter(
        SourceSessionHostStore.shared(),
        new RecordingHostHttpClientFactory(),
        streamFactory,
      );
      const fileRecorder = new RecordingMediaFileAdapter();
      const coreAdapter = new CoreHostAdapter();
      const pending = coreAdapter.mediaDownload({
        url: 'https://cdn.example.test/book.pdf',
        rangeStart: 2,
        rangeEnd: 5,
        ifNoneMatch: 'etag-v1',
        maxBytes: 4,
        savePath: 'cache://downloads/book.pdf',
      }, httpAdapter, fileRecorder as Object as FileHostAdapter);
      expect(streamFactory.clients.length).assertEqual(1);
      const client = streamFactory.clients[0];
      client.emitHeaders('application/pdf', '4');
      client.emitData(4);
      client.emitEnd();
      client.emitStatus(206);
      const response = await pending;

      expect(client.requestHeaders['Range']).assertEqual('bytes=2-5');
      expect(client.requestHeaders['If-None-Match']).assertEqual('etag-v1');
      expect(fileRecorder.openedPath).assertEqual('cache://downloads/book.pdf');
      expect(fileRecorder.appendedBytes).assertEqual(4);
      expect(fileRecorder.committed).assertTrue();
      expect(fileRecorder.discarded).assertFalse();
      expect(response.statusCode).assertEqual(206);
      expect(response.byteLength).assertEqual(4);
      expect(response.tempPath).assertEqual('cache://downloads/book.pdf');
      expect(client.destroyed).assertTrue();
    });

    it('media_download_discards_atomic_part_when_stream_exceeds_limit', 0, async () => {
      const streamFactory = new ManualSourceImageStreamClientFactory();
      const httpAdapter = new HttpHostAdapter(
        SourceSessionHostStore.shared(),
        new RecordingHostHttpClientFactory(),
        streamFactory,
      );
      const fileRecorder = new RecordingMediaFileAdapter();
      const pending = new CoreHostAdapter().mediaDownload({
        url: 'https://cdn.example.test/chapter.zip',
        maxBytes: 3,
        savePath: 'cache://downloads/chapter.zip',
      }, httpAdapter, fileRecorder as Object as FileHostAdapter);
      const client = streamFactory.clients[0];
      client.emitHeaders('application/zip');
      client.emitData(4);
      let rejected = false;
      try {
        await pending;
      } catch (_error) {
        rejected = true;
      }
      expect(rejected).assertTrue();
      expect(fileRecorder.committed).assertFalse();
      expect(fileRecorder.discarded).assertTrue();
      expect(client.destroyed).assertTrue();
    });

    it('source_image_request_wrapper_keeps_persisted_source_and_host_session_ownership', 0, async () => {
      const native = new RecordingNativeReaderCore();
      const core = CoreRuntime.createForTest(native, {});
      const headers: JsonObject = {};
      headers['Referer'] = 'https://source.example.test/';
      headers['User-Agent'] = 'CoreSource/1.0';
      headers['Cookie'] = 'static=1';
      const rawRequest: JsonObject = {};
      rawRequest['url'] = 'https://cdn.example.test/covers/1.png';
      rawRequest['method'] = 'GET';
      rawRequest['headers'] = headers;
      rawRequest['followRedirects'] = true;
      rawRequest['maxRedirects'] = 5;
      const session: JsonObject = {};
      session['id'] = 'core-image-session';
      rawRequest['session'] = session;
      const resultData: JsonObject = {};
      resultData['request'] = rawRequest;
      native.nextSuccessData = resultData;

      const descriptor = await core.sourceImageRequest('persisted-source', '/covers/1.png');
      expect(native.lastMethod).assertEqual('source.imageRequest');
      expect(native.stringParam('sourceId')).assertEqual('persisted-source');
      expect(native.stringParam('imageUrl')).assertEqual('/covers/1.png');
      expect(native.hasParam('source')).assertFalse();
      expect(descriptor.request.sourceId).assertEqual('persisted-source');
      expect(descriptor.request.usePlatformCookieJar).assertTrue();
      expect(descriptor.request.method).assertEqual('GET');
      expect(descriptor.request.followRedirects).assertTrue();
      expect(descriptor.request.maxRedirects).assertEqual(5);
      expect(descriptor.request.sessionId).assertEqual('core-image-session');
      expect(descriptor.request.headers['Referer']).assertEqual('https://source.example.test/');
      expect(descriptor.request.headers['Cookie']).assertEqual('static=1');
    });

    it('source_image_headers_merge_core_cookie_login_and_session_case_insensitively', 0, () => {
      SourceSessionHostStore.resetForTest();
      const store = SourceSessionHostStore.shared();
      const loginHeaders: Record<string, string> = {};
      loginHeaders['authorization'] = 'login-token';
      loginHeaders['cookie'] = 'sid=login; loginOnly=1';
      store.setLoginHeaderMap('source-header-proof', loginHeaders);
      store.setCookie({ name: 'jarOnly', value: 'yes', domain: 'cdn.example.test', path: '/' });
      const adapter = new HttpHostAdapter(store, new RecordingHostHttpClientFactory());
      const descriptorHeaders: Record<string, string> = {};
      descriptorHeaders['Authorization'] = 'core-token';
      descriptorHeaders['Cookie'] = 'sid=core; staticOnly=1';
      descriptorHeaders['Referer'] = 'https://source.example.test/';
      const headers = adapter.buildRequestHeaders({
        url: 'https://cdn.example.test/covers/1.png',
        method: 'GET',
        headers: descriptorHeaders,
        sourceId: 'source-header-proof',
        usePlatformCookieJar: true,
      });
      const keys = Object.keys(headers);
      let authorizationCount = 0;
      let cookieCount = 0;
      for (let index = 0; index < keys.length; index++) {
        if (keys[index].toLowerCase() === 'authorization') authorizationCount += 1;
        if (keys[index].toLowerCase() === 'cookie') cookieCount += 1;
      }
      expect(authorizationCount).assertEqual(1);
      expect(cookieCount).assertEqual(1);
      expect(headers['Authorization']).assertEqual('core-token');
      expect(headers['Cookie'].indexOf('sid=core') >= 0).assertTrue();
      expect(headers['Cookie'].indexOf('staticOnly=1') >= 0).assertTrue();
      expect(headers['Cookie'].indexOf('loginOnly=1') >= 0).assertTrue();
      expect(headers['Cookie'].indexOf('jarOnly=yes') >= 0).assertTrue();
    });

    it('source_image_response_policy_accepts_png_jpeg_and_rejects_html_or_oversize', 0, () => {
      expect(SourceImageResponsePolicy.isAllowedMime('image/png; charset=binary')).assertTrue();
      expect(SourceImageResponsePolicy.isAllowedMime('IMAGE/JPEG')).assertTrue();
      expect(SourceImageResponsePolicy.isAllowedMime('text/html')).assertFalse();
      expect(SourceImageResponsePolicy.accepts(200, 'image/png', 32)).assertTrue();
      expect(SourceImageResponsePolicy.accepts(200, 'image/jpeg', SOURCE_IMAGE_MAX_BYTES)).assertTrue();
      expect(SourceImageResponsePolicy.accepts(200, 'text/html', 32)).assertFalse();
      expect(SourceImageResponsePolicy.accepts(200, 'image/png', SOURCE_IMAGE_MAX_BYTES + 1)).assertFalse();
    });

    it('source_image_stream_cache_commits_png_and_reuses_file_uri_on_hit', 0, async () => {
      const resolver = new SourceImageTestHeaderResolver();
      const store = new MemorySourceImageFileStore();
      const factory = new ManualSourceImageStreamClientFactory();
      const cache = new SourceImageCache('/unused', resolver, factory, store);
      const descriptor: HostHttpRequest = {
        url: 'https://cdn.example.test/covers/1.png',
        method: 'GET',
        headers: { 'Referer': 'https://source.example.test/' },
        sourceId: 'source-cache-proof',
        usePlatformCookieJar: true,
      };
      const first = cache.beginLoad(descriptor);
      expect(factory.clients.length).assertEqual(1);
      // ContinueReadingCard and BookGrid can request the same cover in one
      // frame. They must share one protected stream; cancelling the first
      // visual consumer must not unlink the second consumer's .part file.
      const duplicate = cache.beginLoad(descriptor);
      expect(factory.clients.length).assertEqual(1);
      first.cancel();
      const client = factory.clients[0];
      client.emitHeaders('image/png', '32');
      client.emitData(32);
      client.emitEnd();
      client.emitStatus(200);
      const firstUri = await duplicate.result;
      expect(firstUri.startsWith('file://memory/')).assertTrue();
      expect(client.requestHeaders['Referer']).assertEqual('https://source.example.test/');
      expect(client.requestHeaders['X-Host-Session']).assertEqual('present');
      expect(client.destroyed).assertTrue();
      expect(store.openCount).assertEqual(1);

      const second = cache.beginLoad(descriptor);
      const secondUri = await second.result;
      expect(secondUri).assertEqual(firstUri);
      expect(factory.clients.length).assertEqual(1);
    });

    it('source_image_stream_rejects_html_length_and_chunk_limits_with_part_cleanup', 0, async () => {
      const descriptor: HostHttpRequest = {
        url: 'https://cdn.example.test/covers/2.png',
        method: 'GET',
        headers: {},
        sourceId: 'source-reject-proof',
        usePlatformCookieJar: true,
      };

      const htmlStore = new MemorySourceImageFileStore();
      const htmlFactory = new ManualSourceImageStreamClientFactory();
      const htmlCache = new SourceImageCache('/unused', new SourceImageTestHeaderResolver(), htmlFactory, htmlStore);
      const html = htmlCache.beginLoad(descriptor);
      htmlFactory.clients[0].emitHeaders('text/html');
      let htmlRejected = false;
      try {
        await html.result;
      } catch (_error) {
        htmlRejected = true;
      }
      expect(htmlRejected).assertTrue();
      expect(htmlStore.openCount).assertEqual(0);
      expect(htmlFactory.clients[0].destroyed).assertTrue();

      const lengthStore = new MemorySourceImageFileStore();
      const lengthFactory = new ManualSourceImageStreamClientFactory();
      const lengthCache = new SourceImageCache('/unused', new SourceImageTestHeaderResolver(), lengthFactory, lengthStore);
      const overLength = lengthCache.beginLoad(descriptor);
      lengthFactory.clients[0].emitHeaders('image/jpeg', `${SOURCE_IMAGE_MAX_BYTES + 1}`);
      let lengthRejected = false;
      try {
        await overLength.result;
      } catch (_error) {
        lengthRejected = true;
      }
      expect(lengthRejected).assertTrue();
      expect(lengthStore.openCount).assertEqual(0);

      const chunkStore = new MemorySourceImageFileStore();
      const chunkFactory = new ManualSourceImageStreamClientFactory();
      const chunkCache = new SourceImageCache('/unused', new SourceImageTestHeaderResolver(), chunkFactory, chunkStore);
      const overChunk = chunkCache.beginLoad(descriptor);
      chunkFactory.clients[0].emitHeaders('image/png');
      chunkFactory.clients[0].emitData(SOURCE_IMAGE_MAX_BYTES + 1);
      let chunkRejected = false;
      try {
        await overChunk.result;
      } catch (_error) {
        chunkRejected = true;
      }
      expect(chunkRejected).assertTrue();
      expect(chunkStore.openCount).assertEqual(1);
      expect(chunkStore.discardCount >= 1).assertTrue();
      expect(chunkFactory.clients[0].destroyed).assertTrue();
    });

    it('slice2_core_wrappers_send_exact_core_methods_and_payloads', 0, async () => {
      const native = new RecordingNativeReaderCore();
      const core = CoreRuntime.createForTest(native, {});

      await core.readingProgressUpdate('book-1', 'source-1', 2, 128, 0.5, 'revision-1');
      expect(native.lastMethod).assertEqual('reading.progress.update');
      expect(native.stringParam('bookId')).assertEqual('book-1');
      expect(native.stringParam('sourceId')).assertEqual('source-1');
      expect(native.numberParam('chapterIndex')).assertEqual(2);
      expect(native.numberParam('chapterOffset')).assertEqual(128);
      expect(native.numberParam('chapterProgress')).assertEqual(0.5);
      expect(native.stringParam('locationRevision')).assertEqual('revision-1');

      await core.bookshelfList('lastReadAt', 'descending', 5, 20);
      expect(native.lastMethod).assertEqual('bookshelf.list');
      expect(native.stringParam('sortBy')).assertEqual('lastReadAt');
      expect(native.stringParam('sortDirection')).assertEqual('descending');
      expect(native.numberParam('offset')).assertEqual(5);
      expect(native.numberParam('limit')).assertEqual(20);

      await core.readerLocationResolve('book-1', 2, 128, 0.5, 390, 844, 1.0);
      expect(native.lastMethod).assertEqual('reader.location.resolve');
      expect(native.stringParam('bookId')).assertEqual('book-1');
      expect(native.numberParam('chapterIndex')).assertEqual(2);
      const anchor = native.objectParam('anchor') as Object as Record<string, number>;
      expect(anchor['chapterOffset']).assertEqual(128);
      expect(anchor['chapterProgress']).assertEqual(0.5);
      const layout = native.objectParam('layout') as Object as Record<string, number>;
      expect(layout['viewportWidth']).assertEqual(390);
      expect(layout['viewportHeight']).assertEqual(844);
      expect(layout['fontScale']).assertEqual(1.0);
    });

    it('book_open_handles_keep_request_ids_cancellation_and_typed_variables', 0, async () => {
      const native = new RecordingNativeReaderCore();
      const core = CoreRuntime.createForTest(native, {});
      const baseBook: JsonObject = {};
      baseBook['bookId'] = 'book-1';

      const detail = core.beginBookDetailFromSource('source-1', '/book/1', baseBook);
      expect(detail.requestId).assertEqual(native.lastRequestId);
      expect(detail.requestId > 0).assertTrue();
      expect(native.lastMethod).assertEqual('book.detail');
      expect(native.stringParam('sourceId')).assertEqual('source-1');
      expect(native.stringParam('bookUrl')).assertEqual('/book/1');
      await detail.result;

      const detailVariables: JsonObject = {};
      detailVariables['csrf'] = 'token-1';
      const toc = core.beginBookTocFromSource('source-1', 'book-1', '/book/1/toc', detailVariables);
      expect(toc.requestId).assertEqual(native.lastRequestId);
      expect(toc.requestId > detail.requestId).assertTrue();
      expect(native.lastMethod).assertEqual('book.toc');
      expect(native.objectParam('variables') as Object === detailVariables as Object).assertTrue();
      await toc.result;

      const chapterVariables: JsonObject = {};
      chapterVariables['chapterToken'] = 'chapter-2';
      const content = core.beginChapterContentFromSource(
        'source-1', 'book-1', '/book/1/chapter/2', '第二章', 1, chapterVariables,
      );
      expect(content.requestId).assertEqual(native.lastRequestId);
      expect(native.lastMethod).assertEqual('chapter.content');
      expect(native.numberParam('chapterIndex')).assertEqual(1);
      expect(native.objectParam('variables') as Object === chapterVariables as Object).assertTrue();
      await content.result;

      const location = core.beginReaderLocationResolve('book-1', 1, 0, 0, 390, 844, 1.0);
      expect(location.requestId).assertEqual(native.lastRequestId);
      expect(location.isCancellationRequested).assertFalse();
      expect(location.cancel()).assertTrue();
      expect(location.cancel()).assertFalse();
      expect(location.isCancellationRequested).assertTrue();
      expect(native.cancelledRequestIds.length).assertEqual(1);
      expect(native.cancelledRequestIds[0]).assertEqual(location.requestId);
      await location.result;

      const localToc = core.beginLocalBookToc('local-1');
      expect(native.lastMethod).assertEqual('local_book.toc');
      expect(localToc.requestId).assertEqual(native.lastRequestId);
      await localToc.result;

      const localContent = core.beginLocalBookChapterContent('local-1', 3);
      expect(native.lastMethod).assertEqual('local_book.chapter.content');
      expect(localContent.requestId).assertEqual(native.lastRequestId);
      expect(native.numberParam('chapterIndex')).assertEqual(3);
      await localContent.result;
    });

    it('book_open_handle_cancels_the_exact_inflight_native_request', 0, async () => {
      const native = new RecordingNativeReaderCore();
      native.autoRespond = false;
      const core = CoreRuntime.createForTest(native, {});
      const book: JsonObject = {};
      book['bookId'] = 'book-inflight';

      const handle = core.beginBookDetailFromSource('source-1', '/book/inflight', book);
      // No result has been made available yet, so this is an actual in-flight
      // bridge command rather than a convenience Promise after completion.
      expect(native.lastRequestId).assertEqual(handle.requestId);
      expect(native.cancelledRequestIds.length).assertEqual(0);
      expect(handle.cancel()).assertTrue();
      expect(native.cancelledRequestIds.length).assertEqual(1);
      expect(native.cancelledRequestIds[0]).assertEqual(handle.requestId);

      // Release the fake native waiter so the async unit test completes. The
      // assertion above is the cancellation contract; a real Core cancel emits
      // its own terminal result/error for this same request id.
      native.queueSuccess(handle.requestId);
      await handle.result;
    });

    it('w1_w3_w5_and_webdav_wrappers_match_core_dtos', 0, async () => {
      const native = new RecordingNativeReaderCore();
      const core = CoreRuntime.createForTest(native, {});

      const book: JsonObject = {};
      book['sourceId'] = 'local';
      book['bookId'] = 'local-1';
      book['title'] = 'Local Book';
      book['author'] = 'Author';
      await core.bookshelfAdd(book);
      expect(native.lastMethod).assertEqual('bookshelf.add');
      expect(native.stringParam('sourceId')).assertEqual('local');
      expect(native.stringParam('bookId')).assertEqual('local-1');
      expect(native.stringParam('title')).assertEqual('Local Book');
      expect(native.hasParam('book')).assertFalse();

      await core.changeBookSource('book-1', ['source-2'], 'Book Name');
      expect(native.lastMethod).assertEqual('change.bookSource');
      const sourceIds = native.stringArrayParam('sourceIds');
      expect(sourceIds.length).assertEqual(1);
      expect(sourceIds[0]).assertEqual('source-2');
      expect(native.stringParam('keyword')).assertEqual('Book Name');
      expect(native.hasParam('sourceId')).assertFalse();

      await core.readingProgressGet('book-1', 'source-2');
      expect(native.lastMethod).assertEqual('reading.progress.get');
      expect(native.stringParam('bookId')).assertEqual('book-1');
      expect(native.stringParam('sourceId')).assertEqual('source-2');

      // Core allocates replacement-rule ids.  Even a caller/UI provisional id
      // must not turn create into an upsert of an existing Core rule.
      const createRule: JsonObject = {};
      createRule['id'] = 'pending-rule-7';
      createRule['pattern'] = 'create-old';
      createRule['replacement'] = 'create-new';
      createRule['scope'] = 'chapter';
      createRule['enabled'] = true;
      await core.replaceRuleCreate(createRule);
      expect(native.lastMethod).assertEqual('replace-rule.create');
      expect(native.hasParam('id')).assertFalse();
      expect(native.stringParam('pattern')).assertEqual('create-old');

      const rule: JsonObject = {};
      rule['id'] = 'rule-7';
      rule['pattern'] = 'old';
      rule['replacement'] = 'new';
      rule['scope'] = 'chapter';
      rule['enabled'] = true;
      await core.replaceRuleUpdate(rule);
      expect(native.lastMethod).assertEqual('replace-rule.update');
      expect(native.numberParam('id')).assertEqual(7);
      expect(native.stringParam('pattern')).assertEqual('old');
      expect(native.booleanParam('isEnabled')).assertTrue();
      expect(native.hasParam('rule')).assertFalse();

      await core.replaceRuleDelete('rule-7');
      expect(native.lastMethod).assertEqual('replace-rule.delete');
      expect(native.numberParam('id')).assertEqual(7);
      expect(native.hasParam('ruleId')).assertFalse();

      const webdavRequest: JsonObject = {};
      webdavRequest['method'] = 'PROPFIND';
      webdavRequest['path'] = 'Reader';
      webdavRequest['headers'] = [] as Object;
      webdavRequest['depth'] = 0;
      await core.syncWebdavPlan('https://dav.example.com/', 'Basic abc', [webdavRequest]);
      expect(native.lastMethod).assertEqual('sync.webdav.plan');
      expect(native.stringParam('baseUrl')).assertEqual('https://dav.example.com/');
      expect(native.stringParam('auth')).assertEqual('Basic abc');
      expect(native.hasParam('requests')).assertTrue();
      expect(native.hasParam('serverUrl')).assertFalse();
      expect(native.hasParam('username')).assertFalse();

      await core.sourceCheckRun(['source-1'], '诊断关键词', ['L1', 'L2', 'L3', 'L4', 'L5'], 90000);
      expect(native.lastMethod).assertEqual('source.check.run');
      const checkSourceIds = native.stringArrayParam('sourceIds');
      expect(checkSourceIds.length).assertEqual(1);
      expect(checkSourceIds[0]).assertEqual('source-1');
      expect(native.stringParam('keyword')).assertEqual('诊断关键词');
      const checkLevels = native.stringArrayParam('levels');
      expect(checkLevels.length).assertEqual(5);
      expect(checkLevels[4]).assertEqual('L5');
      expect(native.numberParam('timeoutMs')).assertEqual(90000);
      expect(native.hasParam('responses')).assertFalse();

      const localOptions: LocalBookParseOptions = {
        text: '第一章\n正文',
        fileName: 'fixture.txt',
        format: 'txt',
      };
      await core.localBookImport('local-1', localOptions);
      expect(native.lastMethod).assertEqual('local_book.import');
      expect(native.stringParam('bookId')).assertEqual('local-1');
      expect(native.stringParam('text')).assertEqual('第一章\n正文');
      expect(native.stringParam('fileName')).assertEqual('fixture.txt');
      expect(native.stringParam('format')).assertEqual('txt');

      await core.localBookToc('local-1');
      expect(native.lastMethod).assertEqual('local_book.toc');
      expect(native.stringParam('bookId')).assertEqual('local-1');

      await core.localBookChapterContent('local-1', 3);
      expect(native.lastMethod).assertEqual('local_book.chapter.content');
      expect(native.stringParam('bookId')).assertEqual('local-1');
      expect(native.numberParam('chapterIndex')).assertEqual(3);
    });

    it('slice10_typed_wrappers_preserve_exact_core_dtos', 0, async () => {
      const native = new RecordingNativeReaderCore();
      const core = CoreRuntime.createForTest(native, {});

      const bookmark: CoreBookmarkUpdateInput = { time: 7, content: '更正后的书签备注' };
      await core.bookmarkUpdate(bookmark);
      expect(native.lastMethod).assertEqual('bookmark.update');
      expect(native.numberParam('time')).assertEqual(7);
      expect(native.stringParam('content')).assertEqual('更正后的书签备注');

      const createRule: CoreTxtTocRuleCreateInput = {
        name: '中文章节',
        rule: '第[\\d]+章',
        serialNumber: 0,
        enable: true,
      };
      await core.txtTocRuleCreate(createRule);
      expect(native.lastMethod).assertEqual('txt-toc-rule.create');
      expect(native.stringParam('name')).assertEqual('中文章节');
      expect(native.stringParam('rule')).assertEqual('第[\\d]+章');
      expect(native.numberParam('serialNumber')).assertEqual(0);
      expect(native.booleanParam('enable')).assertTrue();

      const updateRule: CoreTxtTocRuleUpdateInput = { id: 9, enable: false };
      await core.txtTocRuleUpdate(updateRule);
      expect(native.lastMethod).assertEqual('txt-toc-rule.update');
      expect(native.numberParam('id')).assertEqual(9);
      expect(native.booleanParam('enable')).assertFalse();

      await core.txtTocRuleDelete(9);
      expect(native.lastMethod).assertEqual('txt-toc-rule.delete');
      expect(native.numberParam('id')).assertEqual(9);

      const ttsConfig: CoreTtsConfigInput = { rate: 5, pitch: 0, followSys: true };
      await core.ttsConfigPut(ttsConfig);
      expect(native.lastMethod).assertEqual('tts.config.put');
      expect(native.numberParam('rate')).assertEqual(5);
      expect(native.numberParam('pitch')).assertEqual(0);
      expect(native.booleanParam('followSys')).assertTrue();

      await core.bookChapterReview(
        'source-1', 'book-1', 'https://reviews.example.test/chapter/1',
        'https://reviews.example.test/chapter/1',
      );
      expect(native.lastMethod).assertEqual('book.chapterReview');
      expect(native.stringParam('sourceId')).assertEqual('source-1');
      expect(native.stringParam('bookId')).assertEqual('book-1');
      expect(native.stringParam('reviewUrl')).assertEqual('https://reviews.example.test/chapter/1');
      expect(native.hasParam('source')).assertFalse();
      expect(native.hasParam('reviewResponse')).assertFalse();
    });

    it('storage_path_maps_sandbox_scopes_and_rejects_external_scope', 0, () => {
      const context = new FakeContextDirectories() as Object as common.Context;
      const adapter = new FileHostAdapter(context);
      expect(adapter.storagePath('files').path).assertEqual('/sandbox/files');
      expect(adapter.storagePath('cache').path).assertEqual('/sandbox/cache');
      let externalRejected = false;
      try {
        adapter.storagePath('external');
      } catch (e) {
        externalRejected = true;
      }
      expect(externalRejected).assertTrue();
    });

    it('registry_should_have_cookie_capabilities', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getRegistry().has('cookie.get')).assertTrue();
      expect(core.getRegistry().has('cookie.set')).assertTrue();
    });

    it('cookie_session_survives_runtime_adapter_rebuild', 0, async () => {
      SourceSessionHostStore.resetForTest();
      const firstRuntime = CoreRuntime.createForTest(makeStubNativeModule(), {});
      await firstRuntime.getCookieAdapter().set({
        sessionId: 'same-key-host-proof',
        cookie: {
          name: 'session',
          value: 'abc123',
          domain: 'example.org',
          path: '/',
        },
      });

      const rebuiltRuntime = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const response = await rebuiltRuntime.getCookieAdapter().get({
        sessionId: 'same-key-host-proof',
        url: 'https://example.org/book/1',
      });
      expect(response.cookies.length).assertEqual(1);
      expect(response.cookies[0].name).assertEqual('session');
      expect(response.cookies[0].value).assertEqual('abc123');
    });

    it('source_session_state_survives_runtime_adapter_rebuild', 0, () => {
      SourceSessionHostStore.resetForTest();
      const firstRuntime = CoreRuntime.createForTest(makeStubNativeModule(), {});
      firstRuntime.getSourceSessionStore().setSourceVariable(
        'src-367',
        'chapterId',
        '/book/367/1.html',
        'same-key-host-proof',
      );
      const loginHeaders: Record<string, string> = {};
      loginHeaders['Cookie'] = 'token=from-login-store';
      loginHeaders['Authorization'] = 'Bearer local-proof';
      firstRuntime.getSourceSessionStore().setLoginHeaderMap(
        'src-342',
        loginHeaders,
        'same-key-host-proof',
      );

      const rebuiltRuntime = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const variable = rebuiltRuntime.getSourceSessionStore().getSourceVariable(
        'src-367',
        'chapterId',
        'same-key-host-proof',
      );
      const missingLogin = rebuiltRuntime.getSourceSessionStore().getLoginHeaderMap(
        'missing-source',
        'same-key-host-proof',
      );
      const login = rebuiltRuntime.getSourceSessionStore().getLoginHeaderMap(
        'src-342',
        'same-key-host-proof',
      );

      expect(variable).assertEqual('/book/367/1.html');
      expect(missingLogin.found).assertFalse();
      expect(Object.keys(missingLogin.headers).length).assertEqual(0);
      expect(login.found).assertTrue();
      expect(login.headers['Cookie']).assertEqual('token=from-login-store');
      expect(login.headers['Authorization']).assertEqual('Bearer local-proof');
    });

    it('registry_should_have_webview_capability', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getRegistry().has('webview.evaluateJavaScript')).assertTrue();
    });

    it('registry_should_have_core_closed_set_non_context_capabilities', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const expected: HostCapability[] = [
        'host.smoke.echo',
        'cache.get',
        'cache.put',
        'persistence.get',
        'persistence.put',
        'log.emit',
        'time.now',
        'system.info',
        'media.download',
      ];
      for (let i = 0; i < expected.length; i++) {
        expect(core.getRegistry().has(expected[i])).assertTrue();
      }
    });

    it('registry_should_have_file_capabilities_without_context', 0, () => {
      // Without a UIAbility context (unit-test environment), FileHostAdapter
      // cannot be constructed, so file.read/file.write are NOT registered.
      // This mirrors file.delete: Core cannot request what is not registered.
      // On device, EntryAbility passes a context and these DO register; that
      // path is covered by Layer B / CoreSelfCheck, not here.
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getRegistry().has('file.read')).assertFalse();
      expect(core.getRegistry().has('file.write')).assertFalse();
      // file.delete is never registered (UI-Contract-only, not Core closed-set).
      expect(core.getRegistry().has('file.delete')).assertFalse();
    });

    it('registry_should_NOT_have_cache_set_only_cache_put', 0, () => {
      // Core closed-set is `cache.put`, never `cache.set`. Drift check via the
      // raw registered-capability list, because `has()` is typed to
      // HostCapability and 'cache.set' is intentionally not in that union.
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const registered = core.getRegistry().getRegisteredCapabilities();
      const hasCacheSet = registered.indexOf('cache.set' as HostCapability) >= 0;
      expect(hasCacheSet).assertFalse();
    });

    // ── Layer A: Phase 4 UI-Contract-only adapters exist on CoreRuntime ──
    // These are NOT registered with HostCapabilityRegistry (Core never
    // requests them), so we assert presence via CoreRuntime getters, not
    // registry.has(). Adapters that need a UIAbilityContext are null when
    // constructed without one (the unit-test environment).

    it('phase4_clipboard_adapter_always_present', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getClipboardAdapter() === null).assertFalse();
    });

    it('phase4_tts_adapter_always_present', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getTtsAdapter() === null).assertFalse();
    });

    it('phase4_background_adapter_always_present', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getBackgroundAdapter() === null).assertFalse();
    });

    it('phase4_context_dependent_adapters_null_without_context', 0, () => {
      // screen / notification / share / permission / credential require a
      // UIAbilityContext. Without one (unit-test env), they MUST be null —
      // not throwing, not faking. This documents the boundary: Reducer must
      // check for null before dispatching these capabilities.
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getScreenAdapter()).assertNull();
      expect(core.getNotificationAdapter()).assertNull();
      expect(core.getShareAdapter()).assertNull();
      expect(core.getPermissionAdapter()).assertNull();
      expect(core.getCredentialAdapter()).assertNull();
    });

    it('phase4_ui_contract_only_capabilities_NOT_in_registry', 0, () => {
      // Drift check: UI-Contract-only capabilities must NOT be registered with
      // HostCapabilityRegistry (Core will never request them). If any of
      // these appeared in the registry, it would imply Core might request
      // them over NAPI, which is a contract lie.
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const registered = core.getRegistry().getRegisteredCapabilities();
      const forbidden: HostCapability[] = [
        'clipboard.copy', 'clipboard.paste',
        'tts.system.start', 'tts.system.stop',
        'device.screen.keep-on', 'device.screen.release',
        'notification.show', 'notification.cancel',
        'background.schedule', 'background.cancel',
        'share.invoke',
        'permission.request', 'permission.check',
        'credential.get', 'credential.set', 'credential.delete',
        'webview.open', 'webview.close', 'webview.evaluate',
        'file.delete',
      ];
      for (let i = 0; i < forbidden.length; i++) {
        const cap = forbidden[i];
        const present = registered.indexOf(cap) >= 0;
        expect(present).assertFalse();
      }
    });

    // ── Layer A: HostCapabilityManifest structure & availability ──
    // Locks the manifest as the single source of truth for capability
    // routing/requirements. Drift in counts catches new capabilities that
    // were added to the union but not described here.

    it('manifest_covers_all_declared_capabilities', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const manifest = core.getCapabilityManifest();
      // 15 Core closed-set + 28 UI-Contract-only = 43 total.
      expect(manifest.all().length).assertEqual(43);
    });

    it('reader_ui_1_2_manifest_and_dispatcher_are_separate_exact_58_boundaries', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const manifest = core.getReaderUiHostCapabilityManifest();
      expect(manifest.entries().length).assertEqual(58);
      expect(core.getReaderUiHostDispatcher().registeredTypes().length).assertEqual(58);
      // Context-free host unit truth: non-UI capabilities remain registered,
      // while UI/picker/WebDAV operations report unavailable rather than a
      // synthetic success. The production EntryAbility supplies these adapters.
      expect(manifest.entries().find((entry) => entry.type === 'network.status')!.available).assertTrue();
      expect(manifest.entries().find((entry) => entry.type === 'persistence.get')!.available).assertTrue();
      expect(manifest.entries().find((entry) => entry.type === 'persistence.put')!.available).assertTrue();
      expect(manifest.entries().find((entry) => entry.type === 'file.select')!.available).assertFalse();
      expect(manifest.entries().find((entry) => entry.type === 'font.unregisterFile')!.available).assertFalse();
      expect(manifest.entries().find((entry) => entry.type === 'webdav.backup')!.available).assertFalse();
      // These two legacy callback-bearing requests are registered but remain
      // unavailable in the generic dispatcher until a semantic callback is set.
      expect(manifest.entries().find((entry) => entry.type === 'background.schedule')!.available).assertFalse();
      expect(manifest.entries().find((entry) => entry.type === 'timer.foreground.arm')!.available).assertFalse();
    });

    it('manifest_registry_count_matches_core_closed_set', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const manifest = core.getCapabilityManifest();
      // 15 Core closed-set capabilities are registry-routed.
      expect(manifest.registeredWithRegistry().length).assertEqual(15);
    });

    it('manifest_marks_device_vibrate_as_reducer_direct', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const manifest = core.getCapabilityManifest();
      // device.vibrate now has a DeviceHostAdapter (reducer-direct), no longer
      // unimplemented. Adapter is always present (vibrator needs no context).
      const unimpl = manifest.unimplemented();
      expect(unimpl.length).assertEqual(0);
      expect(manifest.isAvailable('device.vibrate')).assertTrue();
    });

    it('manifest_availability_reflects_runtime_adapters', 0, () => {
      // Without context (unit-test env):
      //  - registry-routed caps that need no context ARE available
      //  - file.read/file.write are NOT registered (no FileHostAdapter)
      //  - screen/notification/etc. are null (no UIAbilityContext)
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const manifest = core.getCapabilityManifest();
      expect(manifest.isAvailable('http.execute')).assertTrue();
      expect(manifest.isAvailable('host.smoke.echo')).assertTrue();
      expect(manifest.isAvailable('cache.get')).assertTrue();
      // file.* require a context — not available here.
      expect(manifest.isAvailable('file.read')).assertFalse();
      expect(manifest.isAvailable('file.write')).assertFalse();
      expect(manifest.isAvailable('file.delete')).assertFalse();
      expect(manifest.isAvailable('storage.path')).assertFalse();
      // UIAbilityContext-dependent caps — not available here.
      expect(manifest.isAvailable('device.screen.keep-on')).assertFalse();
      expect(manifest.isAvailable('notification.show')).assertFalse();
      expect(manifest.isAvailable('share.invoke')).assertFalse();
      // Always-constructed adapters — available.
      expect(manifest.isAvailable('clipboard.copy')).assertTrue();
      expect(manifest.isAvailable('tts.system.start')).assertTrue();
      expect(manifest.isAvailable('background.schedule')).assertTrue();
      expect(manifest.isAvailable('timer.foreground.arm')).assertTrue();
      expect(manifest.isAvailable('timer.foreground.cancel')).assertTrue();
    });

    it('manifest_describes_storage_path_as_context_bound_reducer_dispatch', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const descriptor = core.getCapabilityManifest().get('storage.path');
      expect(descriptor === undefined).assertFalse();
      if (descriptor !== undefined) {
        expect(descriptor.dispatch).assertEqual('reducer-direct');
        expect(descriptor.adapter).assertEqual('FileHostAdapter');
        expect(descriptor.requiresContext).assertTrue();
      }
    });

    it('manifest_summary_line_is_nonempty', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const line = core.getCapabilityManifest().toSummaryLine();
      expect(line.startsWith('total=')).assertTrue();
      expect(line.indexOf('deviceVerified=0') >= 0).assertTrue();
    });

    it('host_unit_runner_has_no_runtime_singleton', 0, () => {
      // Host tests use createForTest(); they must not smuggle a fake singleton
      // into the device-proof boundary.
      let threw: boolean;
      try {
        CoreRuntime.get();
        threw = false;
      } catch (e) {
        threw = true;
      }
      expect(threw).assertTrue();
    });
  });
}

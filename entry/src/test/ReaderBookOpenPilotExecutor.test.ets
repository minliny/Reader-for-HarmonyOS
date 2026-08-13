// ReaderBookOpenPilotExecutor.test — Store-level proof for the opt-in W2
// book.open executor. The fake Core gateway keeps every command deferred so
// these tests can assert correlation ownership, actual cancellation, and
// measured-layout admission without a device NAPI runtime.
import { describe, it, expect } from '@ohos/hypium';
import type { ReaderUIBookOpenLayout } from 'reader_ui_runtime';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import {
  ReaderBookOpenCommandHandle,
  ReaderBookOpenCoreGateway,
} from '../main/ets/ui/store/ReaderBookOpenPilot';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import { UiEvent } from '../main/ets/ui/store/ReaderUiState';

class DeferredBookOpenHandle implements ReaderBookOpenCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  cancelCalls: number = 0;
  private resultResolver: ((value: JsonObject) => void) | undefined = undefined;

  constructor(requestId: number) {
    this.requestId = requestId;
    this.result = new Promise<JsonObject>((resolve): void => {
      this.resultResolver = (data: JsonObject): void => {
        resolve(data);
      };
    });
  }

  cancel(): boolean {
    this.cancelCalls += 1;
    return this.cancelCalls === 1;
  }

  resolve(data: JsonObject): void {
    const resolver = this.resultResolver;
    if (resolver === undefined) throw new Error('deferred book.open result has no resolver');
    resolver(data);
  }

}

class RecordedLocationRequest {
  readonly bookId: string;
  readonly chapterIndex: number;
  readonly chapterOffset: number;
  readonly chapterProgress: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly fontScale: number;

  constructor(bookId: string, chapterIndex: number, chapterOffset: number,
    chapterProgress: number, viewportWidth: number, viewportHeight: number, fontScale: number) {
    this.bookId = bookId;
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.chapterProgress = chapterProgress;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.fontScale = fontScale;
  }
}

class RecordingBookOpenCoreGateway implements ReaderBookOpenCoreGateway {
  detailHandles: DeferredBookOpenHandle[] = [];
  tocHandles: DeferredBookOpenHandle[] = [];
  contentHandles: DeferredBookOpenHandle[] = [];
  locationHandles: DeferredBookOpenHandle[] = [];
  localTocHandles: DeferredBookOpenHandle[] = [];
  localContentHandles: DeferredBookOpenHandle[] = [];
  effectOrder: string[] = [];
  locationRequests: RecordedLocationRequest[] = [];
  localContentBookIds: string[] = [];
  localContentChapterIndexes: number[] = [];
  private nextRequestId: number = 1;

  beginBookDetailFromSource(_sourceId: string, _bookUrl: string,
    _book: JsonObject): ReaderBookOpenCommandHandle {
    this.effectOrder.push('source.detail');
    return this.newHandle(this.detailHandles);
  }

  beginBookTocFromSource(_sourceId: string, _bookId: string, _tocUrl: string,
    _variables?: JsonObject): ReaderBookOpenCommandHandle {
    this.effectOrder.push('chapter.list');
    return this.newHandle(this.tocHandles);
  }

  beginChapterContentFromSource(_sourceId: string, _bookId: string, _chapterUrl: string,
    _chapterTitle?: string, _chapterIndex?: number, _variables?: JsonObject): ReaderBookOpenCommandHandle {
    this.effectOrder.push('content.load');
    return this.newHandle(this.contentHandles);
  }

  beginLocalBookToc(_bookId: string): ReaderBookOpenCommandHandle {
    this.effectOrder.push('chapter.list');
    return this.newHandle(this.localTocHandles);
  }

  beginLocalBookChapterContent(bookId: string, chapterIndex: number): ReaderBookOpenCommandHandle {
    this.effectOrder.push('content.load');
    this.localContentBookIds.push(bookId);
    this.localContentChapterIndexes.push(chapterIndex);
    return this.newHandle(this.localContentHandles);
  }

  beginReaderLocationResolve(bookId: string, chapterIndex: number, chapterOffset: number,
    chapterProgress: number, viewportWidth: number, viewportHeight: number,
    fontScale: number): ReaderBookOpenCommandHandle {
    this.effectOrder.push('reader.location.resolve');
    this.locationRequests.push(new RecordedLocationRequest(
      bookId, chapterIndex, chapterOffset, chapterProgress, viewportWidth, viewportHeight, fontScale,
    ));
    return this.newHandle(this.locationHandles);
  }

  private newHandle(target: DeferredBookOpenHandle[]): DeferredBookOpenHandle {
    const handle = new DeferredBookOpenHandle(this.nextRequestId);
    this.nextRequestId += 1;
    target.push(handle);
    return handle;
  }
}

function sourceListLoaded(): void {
  ReaderUiStore.dispatch({
    type: 'source-list-loaded',
    sources: [{
      sourceId: 'source-1',
      name: '真实书源',
      baseUrl: 'https://source.example',
      enabled: true,
    }],
  });
}

function localBookshelfLoaded(): void {
  ReaderUiStore.dispatch({
    type: 'bookshelf-list-loaded',
    bookshelfBooks: [{
      sourceId: 'local',
      bookId: 'local-book-1',
      title: '本地测试书',
      author: '本地作者',
      coverUrl: '',
      intro: '本地导入的真实持久书架记录。',
      kind: 'txt',
      lastChapter: '第二章',
      group: '',
    }],
  });
}

function readerEntry(bookId: string = 'book-1'): UiEvent {
  return {
    type: 'bookshelf-book-open',
    bookId: bookId,
    sourceId: 'source-1',
    sourceKind: 'remote',
    chapterIndex: 0,
    readerEntry: true,
  };
}

function localReaderEntry(): UiEvent {
  return {
    type: 'bookshelf-book-open',
    bookId: 'local-book-1',
    sourceId: 'local',
    sourceKind: 'local',
    chapterIndex: 1,
    readerEntry: true,
  };
}

function measuredLayout(): ReaderUIBookOpenLayout {
  return {
    chapterOffset: 0,
    chapterProgress: 0,
    viewportWidth: 412,
    viewportHeight: 892,
    fontScale: 1.125,
  };
}

async function flushBookOpenResult(): Promise<void> {
  // One turn resolves the fake Core promise and a second runs the executor's
  // chained runtime transition. Keep this microtask-only: no timing-based UI
  // proof is substituted for ArkUI's real measurement callback.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function detailResult(bookId: string): JsonObject {
  return JSON.parse('{' +
    `"book":{"bookId":"${bookId}","title":"测试书","author":"测试作者"},` +
    '"tocUrl":"/toc","variables":{"csrf":"detail-token"}' +
    '}') as JsonObject;
}

function tocResult(): JsonObject {
  return JSON.parse('{' +
    '"toc":[{"index":0,"title":"第一章","url":"/chapter/1","variables":{"chapter":"token"}}]' +
    '}') as JsonObject;
}

function localTocResult(): JsonObject {
  return JSON.parse('{' +
    '"toc":[' +
    '{"index":4,"title":"第一章","url":"local-book-1#4"},' +
    '{"index":9,"title":"第二章","url":"local-book-1#9"}' +
    ']' +
    '}') as JsonObject;
}

function contentResult(): JsonObject {
  return JSON.parse('{"content":"第一段<br><br>第二段"}') as JsonObject;
}

function locationResult(bookId: string, chapterIndex: number): JsonObject {
  return JSON.parse('{' +
    '"canonicalLocation":{' +
    `"bookId":"${bookId}",` +
    `"chapterIndex":${chapterIndex},` +
    '"chapterOffset":0,"chapterProgress":0,' +
    `"locationRevision":"reader-location-v1:${bookId}:${chapterIndex}:0"` +
    '},' +
    '"resolverVersion":"reader.location.resolve.v1.reflow",' +
    '"resolved":true,' +
    '"reflow":{' +
    '"strategy":"offsetAnchor",' +
    '"primaryAnchor":"chapterOffset",' +
    '"fallbackAnchor":"chapterProgress",' +
    '"layoutIndependent":true' +
    '}' +
    '}') as JsonObject;
}

async function startRemoteThroughMeasuredLayout(core: RecordingBookOpenCoreGateway,
  bookId: string = 'book-1'): Promise<DeferredBookOpenHandle> {
  ReaderUiStore.init(undefined, core);
  sourceListLoaded();
  ReaderUiStore.setBookOpenPilotEnabledForTest(true);
  ReaderUiStore.dispatch(readerEntry(bookId));
  core.detailHandles[0].resolve(detailResult(bookId));
  await flushBookOpenResult();
  core.tocHandles[0].resolve(tocResult());
  await flushBookOpenResult();
  core.contentHandles[0].resolve(contentResult());
  await flushBookOpenResult();
  const awaitingMeasurement = ReaderUiStore.bookOpenPilotSnapshot();
  if (!ReaderUiStore.provideBookOpenMeasuredLayout(
    awaitingMeasurement.activeCorrelationId, awaitingMeasurement.contentGeneration, measuredLayout(),
  )) {
    throw new Error('test setup did not reach reader.location.resolve');
  }
  return core.locationHandles[0];
}

export default function ReaderBookOpenPilotExecutorTests(): void {
  describe('ReaderUIRuntime book.open Pilot executor', () => {
    it('defaultsToPilotModeAndDoesNotAdmitCoreWithoutContext', 0, () => {
      const core = new RecordingBookOpenCoreGateway();
      ReaderUiStore.init(undefined, core);

      // Production instances now start Pilot-enabled; the Shadow fallback is
      // only reachable through setBookOpenPilotEnabledForTest(false). Without a
      // Store-projected Core source the coordinator must still refuse to admit
      // the Core executor, keeping immersive-reading observation-only.
      expect(ReaderUiStore.isBookOpenPilotEnabled()).assertTrue();
      ReaderUiStore.dispatch(readerEntry());

      expect(core.detailHandles.length).assertEqual(0);
      expect(ReaderUiStore.bookOpenPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.runtimeShadowSnapshot().metrics.executedEffects).assertEqual(0);
    });

    it('executesOneSerialCoreEffectPerStageAndOnlyAdvancesAfterMeasuredLayout', 0, async () => {
      const core = new RecordingBookOpenCoreGateway();
      ReaderUiStore.init(undefined, core);
      sourceListLoaded();

      // A native-only round trip can resync the generated runtime. The
      // executor must retain the live coordinator driver, not its init-time
      // instance, when the later reader CTA is admitted.
      ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
      ReaderUiStore.dispatch({ type: 'route-pop' });
      expect(ReaderUiStore.runtimeShadowSnapshot().metrics.resync > 0).assertTrue();

      ReaderUiStore.setBookOpenPilotEnabledForTest(true);
      ReaderUiStore.dispatch(readerEntry());
      expect(core.effectOrder.join(',')).assertEqual('source.detail');
      expect(core.detailHandles.length).assertEqual(1);
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');
      expect(ReaderUiStore.snapshot().loading).assertTrue();

      core.detailHandles[0].resolve(detailResult('book-1'));
      await flushBookOpenResult();
      expect(core.effectOrder.join(',')).assertEqual('source.detail,chapter.list');
      expect(core.tocHandles.length).assertEqual(1);
      const currentBook = ReaderUiStore.snapshot().currentBook;
      expect(currentBook !== null).assertTrue();
      if (currentBook !== null) expect(currentBook.title).assertEqual('测试书');

      core.tocHandles[0].resolve(tocResult());
      await flushBookOpenResult();
      expect(core.effectOrder.join(',')).assertEqual('source.detail,chapter.list,content.load');
      expect(core.contentHandles.length).assertEqual(1);
      expect(ReaderUiStore.snapshot().chapterToc.length).assertEqual(1);

      core.contentHandles[0].resolve(contentResult());
      await flushBookOpenResult();
      const awaitingMeasurement = ReaderUiStore.bookOpenPilotSnapshot();
      expect(awaitingMeasurement.activeCorrelationId.length > 0).assertTrue();
      expect(awaitingMeasurement.contentGeneration > 0).assertTrue();
      expect(ReaderUiStore.snapshot().chapterContent.length).assertEqual(2);
      expect(core.locationHandles.length).assertEqual(0);

      // A stale subtree or generation cannot turn a replacement transaction
      // into a reader.location.resolve request.
      expect(ReaderUiStore.provideBookOpenMeasuredLayout(
        'stale-correlation', awaitingMeasurement.contentGeneration, measuredLayout(),
      )).assertFalse();
      expect(ReaderUiStore.provideBookOpenMeasuredLayout(
        awaitingMeasurement.activeCorrelationId, awaitingMeasurement.contentGeneration + 1, measuredLayout(),
      )).assertFalse();
      expect(ReaderUiStore.provideBookOpenMeasuredLayout(
        awaitingMeasurement.activeCorrelationId,
        awaitingMeasurement.contentGeneration,
        {
          chapterOffset: 0,
          chapterProgress: 0,
          viewportWidth: 0,
          viewportHeight: 892,
          fontScale: 1.125,
        },
      )).assertFalse();
      expect(core.locationHandles.length).assertEqual(0);

      expect(ReaderUiStore.provideBookOpenMeasuredLayout(
        awaitingMeasurement.activeCorrelationId, awaitingMeasurement.contentGeneration, measuredLayout(),
      )).assertTrue();
      expect(core.effectOrder.join(',')).assertEqual(
        'source.detail,chapter.list,content.load,reader.location.resolve',
      );
      expect(core.locationHandles.length).assertEqual(1);
      expect(core.locationRequests[0].viewportWidth).assertEqual(412);
      expect(core.locationRequests[0].viewportHeight).assertEqual(892);
      expect(core.locationRequests[0].fontScale).assertEqual(1.125);

      core.locationHandles[0].resolve(locationResult('book-1', 0));
      await flushBookOpenResult();
      expect(ReaderUiStore.snapshot().loading).assertFalse();
      expect(ReaderUiStore.bookOpenPilotSnapshot().activeCorrelationId).assertEqual('');
      const canonicalLocation = ReaderUiStore.snapshot().canonicalReaderLocation;
      expect(canonicalLocation !== null).assertTrue();
      if (canonicalLocation !== null) {
        expect(canonicalLocation.bookId).assertEqual('book-1');
        expect(canonicalLocation.chapterIndex).assertEqual(0);
        expect(canonicalLocation.locationRevision).assertEqual('reader-location-v1:book-1:0:0');
        expect(canonicalLocation.resolverVersion).assertEqual('reader.location.resolve.v1.reflow');
      }
      expect(ReaderUiStore.bookOpenPilotSnapshot().executedEffects).assertEqual(4);
      expect(ReaderUiStore.runtimeShadowSnapshot().metrics.admittedTransactions).assertEqual(1);
      expect(ReaderUiStore.runtimeShadowSnapshot().metrics.executedEffects).assertEqual(4);
    });

    it('usesDurableLocalShelfContextWithoutRemoteDetailOrSourceCommands', 0, async () => {
      const core = new RecordingBookOpenCoreGateway();
      ReaderUiStore.init(undefined, core);
      localBookshelfLoaded();
      ReaderUiStore.setBookOpenPilotEnabledForTest(true);
      ReaderUiStore.dispatch(localReaderEntry());

      expect(core.effectOrder.join(',')).assertEqual('chapter.list');
      expect(core.localTocHandles.length).assertEqual(1);
      expect(core.detailHandles.length).assertEqual(0);
      expect(core.tocHandles.length).assertEqual(0);
      expect(core.contentHandles.length).assertEqual(0);
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');

      core.localTocHandles[0].resolve(localTocResult());
      await flushBookOpenResult();
      expect(core.effectOrder.join(',')).assertEqual('chapter.list,content.load');
      expect(core.localContentHandles.length).assertEqual(1);
      // Runtime selected position 1; Core's durable TOC row identity is 9.
      expect(core.localContentBookIds[0]).assertEqual('local-book-1');
      expect(core.localContentChapterIndexes[0]).assertEqual(9);
      expect(core.detailHandles.length).assertEqual(0);
      expect(core.tocHandles.length).assertEqual(0);
      expect(core.contentHandles.length).assertEqual(0);

      core.localContentHandles[0].resolve(contentResult());
      await flushBookOpenResult();
      const awaitingMeasurement = ReaderUiStore.bookOpenPilotSnapshot();
      expect(awaitingMeasurement.activeCorrelationId.length > 0).assertTrue();
      expect(ReaderUiStore.provideBookOpenMeasuredLayout(
        awaitingMeasurement.activeCorrelationId, awaitingMeasurement.contentGeneration, measuredLayout(),
      )).assertTrue();
      expect(core.locationHandles.length).assertEqual(1);
      expect(core.locationRequests[0].bookId).assertEqual('local-book-1');
      expect(core.locationRequests[0].chapterIndex).assertEqual(9);
      expect(core.detailHandles.length).assertEqual(0);
      expect(core.tocHandles.length).assertEqual(0);
      expect(core.contentHandles.length).assertEqual(0);

      core.locationHandles[0].resolve(locationResult('local-book-1', 9));
      await flushBookOpenResult();
      expect(ReaderUiStore.snapshot().loading).assertFalse();
      expect(ReaderUiStore.bookOpenPilotSnapshot().activeCorrelationId).assertEqual('');
      const canonicalLocation = ReaderUiStore.snapshot().canonicalReaderLocation;
      expect(canonicalLocation !== null).assertTrue();
      if (canonicalLocation !== null) {
        expect(canonicalLocation.bookId).assertEqual('local-book-1');
        expect(canonicalLocation.chapterIndex).assertEqual(9);
      }
      expect(ReaderUiStore.bookOpenPilotSnapshot().executedEffects).assertEqual(3);
      expect(ReaderUiStore.runtimeShadowSnapshot().metrics.executedEffects).assertEqual(3);
    });

    it('rejectsMalformedLocationResultBeforeCompletingTheRuntimeTransaction', 0, async () => {
      const core = new RecordingBookOpenCoreGateway();
      const location = await startRemoteThroughMeasuredLayout(core);

      location.resolve(JSON.parse('{"resolved":false}') as JsonObject);
      await flushBookOpenResult();

      const state = ReaderUiStore.snapshot();
      expect(state.loading).assertFalse();
      expect(state.canonicalReaderLocation).assertEqual(null);
      expect(state.error !== null).assertTrue();
      if (state.error !== null) {
        expect(state.error.code).assertEqual('BOOK_OPEN_PILOT_FAILED');
        expect(state.error.message.includes('resolved=true')).assertTrue();
      }
      expect(ReaderUiStore.bookOpenPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.bookOpenPilotSnapshot().executedEffects).assertEqual(4);
    });

    it('rejectsLocationIdentityDriftBeforeCompletingTheRuntimeTransaction', 0, async () => {
      const core = new RecordingBookOpenCoreGateway();
      const location = await startRemoteThroughMeasuredLayout(core);

      location.resolve(locationResult('foreign-book', 0));
      await flushBookOpenResult();

      const state = ReaderUiStore.snapshot();
      expect(state.loading).assertFalse();
      expect(state.canonicalReaderLocation).assertEqual(null);
      expect(state.error !== null).assertTrue();
      if (state.error !== null) {
        expect(state.error.code).assertEqual('BOOK_OPEN_PILOT_FAILED');
        expect(state.error.message.includes('identity mismatch')).assertTrue();
      }
      expect(ReaderUiStore.bookOpenPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.bookOpenPilotSnapshot().executedEffects).assertEqual(4);
    });

    it('readerExitCancelsTheExactCoreHandleRestoresRuntimeAndIgnoresLateResult', 0, async () => {
      const core = new RecordingBookOpenCoreGateway();
      ReaderUiStore.init(undefined, core);
      sourceListLoaded();
      ReaderUiStore.setBookOpenPilotEnabledForTest(true);
      ReaderUiStore.dispatch(readerEntry());

      const inFlight = core.detailHandles[0];
      const correlationId = ReaderUiStore.bookOpenPilotSnapshot().activeCorrelationId;
      expect(correlationId.length > 0).assertTrue();
      ReaderUiStore.dispatch({ type: 'reader-exit' });

      expect(inFlight.cancelCalls).assertEqual(1);
      expect(ReaderUiStore.snapshot().routeId).assertEqual('bookshelf');
      expect(ReaderUiStore.snapshot().loading).assertFalse();
      expect(ReaderUiStore.bookOpenPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.runtimeShadowSnapshot().runtimeState.bookOpenTransaction).assertEqual(undefined);

      inFlight.resolve(detailResult('book-1'));
      await flushBookOpenResult();
      expect(core.tocHandles.length).assertEqual(0);
      expect(ReaderUiStore.snapshot().currentBook).assertEqual(null);
      expect(ReaderUiStore.bookOpenPilotSnapshot().ignoredLateResults > 0).assertTrue();
    });

    it('supersedeCancelsThePriorHandleAndKeepsOnlyTheLatestCorrelationActive', 0, async () => {
      const core = new RecordingBookOpenCoreGateway();
      ReaderUiStore.init(undefined, core);
      sourceListLoaded();
      ReaderUiStore.setBookOpenPilotEnabledForTest(true);
      ReaderUiStore.dispatch(readerEntry('book-1'));
      const first = core.detailHandles[0];
      const firstCorrelation = ReaderUiStore.bookOpenPilotSnapshot().activeCorrelationId;

      ReaderUiStore.dispatch(readerEntry('book-2'));
      const latest = ReaderUiStore.bookOpenPilotSnapshot();
      expect(first.cancelCalls).assertEqual(1);
      expect(core.detailHandles.length).assertEqual(2);
      expect(latest.activeCorrelationId === firstCorrelation).assertFalse();
      expect(latest.activeRequestId).assertEqual(core.detailHandles[1].requestId);

      first.resolve(detailResult('book-1'));
      await flushBookOpenResult();
      expect(core.tocHandles.length).assertEqual(0);
      expect(ReaderUiStore.bookOpenPilotSnapshot().activeRequestId).assertEqual(core.detailHandles[1].requestId);

      // Leave no active deferred transaction for any following Store test.
      ReaderUiStore.dispatch({ type: 'reader-exit' });
      expect(core.detailHandles[1].cancelCalls).assertEqual(1);
    });

    it('failedContextAdmissionCancelsRuntimeTransactionAndAllowsANewStart', 0, () => {
      const core = new RecordingBookOpenCoreGateway();
      ReaderUiStore.init(undefined, core);
      ReaderUiStore.setBookOpenPilotEnabledForTest(true);

      // No Store-projected Core source exists yet, so admission fails after
      // runtime dispatch. The coordinator must cancel that transaction rather
      // than leaving a loading immersive screen behind.
      ReaderUiStore.dispatch(readerEntry());
      expect(core.detailHandles.length).assertEqual(0);
      expect(ReaderUiStore.snapshot().routeId).assertEqual('bookshelf');
      expect(ReaderUiStore.snapshot().loading).assertFalse();
      expect(ReaderUiStore.bookOpenPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.runtimeShadowSnapshot().runtimeState.bookOpenTransaction).assertEqual(undefined);

      sourceListLoaded();
      ReaderUiStore.dispatch(readerEntry());
      expect(core.detailHandles.length).assertEqual(1);
      expect(ReaderUiStore.bookOpenPilotSnapshot().activeCorrelationId.length > 0).assertTrue();

      ReaderUiStore.dispatch({ type: 'reader-exit' });
      expect(core.detailHandles[0].cancelCalls).assertEqual(1);
    });
  });
}

import { describe, it, expect } from '@ohos/hypium';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import type { ForegroundTimerFiredCallback } from '../main/ets/host/adapters/ForegroundTimerHostAdapter';
import type { TtsCompletionCallback, TtsFailureCallback } from '../main/ets/host/adapters/TtsHostAdapter';
import {
  HostForegroundTimerRequest,
  HostTtsSystemStartRequest,
} from '../main/ets/host/types';
import {
  ReaderPlaybackCommandHandle,
  ReaderPlaybackCoreGateway,
  ReaderPlaybackPlatformGateway,
} from '../main/ets/ui/store/ReaderPlaybackPilot';
import type { ReaderPlaybackProgressUpdate } from '../main/ets/ui/store/ReaderPlaybackDomainMapper';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';

class ImmediatePlaybackHandle implements ReaderPlaybackCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  cancelled: boolean = false;

  constructor(requestId: number, data: JsonObject) {
    this.requestId = requestId;
    this.result = Promise.resolve(data);
  }

  cancel(): boolean {
    if (this.cancelled) return false;
    this.cancelled = true;
    return true;
  }
}

class DeferredPlaybackHandle implements ReaderPlaybackCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  cancelled: boolean = false;
  private resultResolver: ((data: JsonObject) => void) | undefined = undefined;

  constructor(requestId: number) {
    this.requestId = requestId;
    this.result = new Promise<JsonObject>((resolve): void => {
      this.resultResolver = (data: JsonObject): void => resolve(data);
    });
  }

  cancel(): boolean {
    if (this.cancelled) return false;
    this.cancelled = true;
    const resolver = this.resultResolver;
    if (resolver !== undefined) resolver({} as JsonObject);
    return true;
  }
}

class FakePlaybackCore implements ReaderPlaybackCoreGateway {
  operations: string[] = [];
  locationHandles: ReaderPlaybackCommandHandle[] = [];
  progressUpdates: ReaderPlaybackProgressUpdate[] = [];
  deferFirstLocation: boolean = false;
  deferProgress: boolean = false;
  failProgress: boolean = false;
  mismatchProgressRevision: boolean = false;
  progressStored: boolean = true;
  private nextRequestId: number = 1;
  private nextCallCount: number = 0;
  private lastPlan: JsonObject | null = null;
  private lastChapter: JsonObject | null = null;
  private progressResolver: ((data: JsonObject) => void) | undefined = undefined;
  private progressRejecter: ((error: Error) => void) | undefined = undefined;

  beginReaderLocationResolve(bookId: string, chapterIndex: number, chapterOffset: number,
    chapterProgress: number, _viewportWidth: number, _viewportHeight: number,
    _fontScale: number, _sourceId: string = '', _chapterTitle: string = ''): ReaderPlaybackCommandHandle {
    this.operations.push(`location:${chapterOffset}`);
    if (this.deferFirstLocation && this.locationHandles.length === 0) {
      const deferred = new DeferredPlaybackHandle(this.nextRequestId++);
      this.locationHandles.push(deferred);
      return deferred;
    }
    const canonical: JsonObject = {};
    canonical['bookId'] = bookId;
    canonical['chapterIndex'] = chapterIndex;
    canonical['chapterOffset'] = chapterOffset;
    canonical['chapterProgress'] = chapterProgress;
    canonical['locationRevision'] = `location-revision-${chapterOffset}`;
    const reflow: JsonObject = {};
    reflow['strategy'] = 'offsetAnchor';
    reflow['primaryAnchor'] = 'chapterOffset';
    reflow['fallbackAnchor'] = 'chapterProgress';
    reflow['layoutIndependent'] = true;
    const data: JsonObject = {};
    data['canonicalLocation'] = canonical;
    data['resolverVersion'] = 'reader.location.resolve.v1.reflow';
    data['resolved'] = true;
    data['reflow'] = reflow;
    const handle = new ImmediatePlaybackHandle(this.nextRequestId++, data);
    this.locationHandles.push(handle);
    return handle;
  }

  updateReaderProgress(progress: ReaderPlaybackProgressUpdate): Promise<JsonObject> {
    this.operations.push(`progress:${progress.chapterOffset}`);
    this.progressUpdates.push(progress);
    if (this.deferProgress) {
      return new Promise<JsonObject>((resolve, reject): void => {
        this.progressResolver = (data: JsonObject): void => resolve(data);
        this.progressRejecter = (error: Error): void => reject(error);
      });
    }
    if (this.failProgress) return Promise.reject(new Error('progress-store-failed'));
    return Promise.resolve(this.progressData(progress));
  }

  completeProgress(): void {
    const resolver = this.progressResolver;
    const progress = this.progressUpdates[this.progressUpdates.length - 1];
    this.progressResolver = undefined;
    this.progressRejecter = undefined;
    if (resolver !== undefined && progress !== undefined) resolver(this.progressData(progress));
  }

  rejectProgress(message: string): void {
    const rejecter = this.progressRejecter;
    this.progressResolver = undefined;
    this.progressRejecter = undefined;
    if (rejecter !== undefined) rejecter(new Error(message));
  }

  beginTtsSlice(chapter: JsonObject, _content: string,
    _strategy: string = 'paragraph-then-sentence'): ReaderPlaybackCommandHandle {
    this.operations.push('tts.slice');
    this.lastChapter = chapter;
    const first: JsonObject = {};
    first['index'] = 0;
    first['text'] = '第一段';
    first['charStart'] = 0;
    first['charEnd'] = 3;
    first['paragraphIndex'] = 0;
    const second: JsonObject = {};
    second['index'] = 1;
    second['text'] = '第二段';
    second['charStart'] = 4;
    second['charEnd'] = 7;
    second['paragraphIndex'] = 1;
    const plan: JsonObject = {};
    plan['chapter'] = chapter;
    plan['strategy'] = 'paragraph-then-sentence';
    plan['slices'] = [first, second];
    plan['sourceCharCount'] = 7;
    this.lastPlan = plan;
    const data: JsonObject = {};
    data['plan'] = plan;
    return new ImmediatePlaybackHandle(this.nextRequestId++, data);
  }

  beginTtsPlay(plan: JsonObject, _startSliceIndex: number = 0): ReaderPlaybackCommandHandle {
    this.operations.push('tts.play');
    this.lastPlan = plan;
    return new ImmediatePlaybackHandle(this.nextRequestId++, this.queueData('playing', 0, 0));
  }

  beginTtsStop(_chapter: JsonObject): ReaderPlaybackCommandHandle {
    this.operations.push('tts.stop');
    return new ImmediatePlaybackHandle(this.nextRequestId++, this.queueData('stopped', 1, 2));
  }

  beginTtsNext(_chapter: JsonObject): ReaderPlaybackCommandHandle {
    this.operations.push('tts.next');
    this.nextCallCount += 1;
    return new ImmediatePlaybackHandle(
      this.nextRequestId++,
      this.nextCallCount === 1 ? this.queueData('playing', 1, 1) : this.queueData('completed', 1, 2),
    );
  }

  beginTtsReportStatus(_chapter: JsonObject, sliceIndex: number,
    status: string): ReaderPlaybackCommandHandle {
    this.operations.push(`tts.report:${sliceIndex}:${status}`);
    return new ImmediatePlaybackHandle(this.nextRequestId++, this.queueData('playing', sliceIndex, sliceIndex));
  }

  private queueData(state: string, current: number, completed: number): JsonObject {
    const snapshot: JsonObject = {};
    snapshot['state'] = state;
    snapshot['currentSliceIndex'] = current;
    snapshot['totalSlices'] = 2;
    snapshot['completedSlices'] = completed;
    snapshot['chapter'] = this.lastChapter ?? {} as JsonObject;
    const data: JsonObject = {};
    data['snapshot'] = snapshot;
    return data;
  }

  private progressData(progress: ReaderPlaybackProgressUpdate): JsonObject {
    const data: JsonObject = {};
    data['bookId'] = progress.bookId;
    data['sourceId'] = progress.sourceId;
    data['deviceId'] = progress.deviceId ?? null;
    data['updatedAt'] = progress.updatedAt ?? 1700000000;
    data['chapterIndex'] = progress.chapterIndex;
    data['chapterOffset'] = progress.chapterOffset;
    data['chapterProgress'] = progress.chapterProgress;
    data['stored'] = this.progressStored;
    data['locationRevision'] = this.mismatchProgressRevision
      ? `${progress.locationRevision}-mismatch` : progress.locationRevision;
    return data;
  }
}

class FakePlaybackPlatform implements ReaderPlaybackPlatformGateway {
  operations: string[] = [];
  timerArmCount: number = 0;
  timerCancelCount: number = 0;
  private completion: TtsCompletionCallback | null = null;
  private failure: TtsFailureCallback | null = null;
  private speechRequest: HostTtsSystemStartRequest | null = null;
  private timerCallback: ForegroundTimerFiredCallback | null = null;
  private timerRequest: HostForegroundTimerRequest | null = null;

  startSpeech(request: HostTtsSystemStartRequest,
    callback: TtsCompletionCallback, failureCallback: TtsFailureCallback): Promise<boolean> {
    this.operations.push(`speech.start:${request.sliceIndex ?? -1}`);
    this.speechRequest = request;
    this.completion = callback;
    this.failure = failureCallback;
    return Promise.resolve(true);
  }

  stopSpeech(): Promise<boolean> {
    this.operations.push('speech.stop');
    this.completion = null;
    this.failure = null;
    this.speechRequest = null;
    return Promise.resolve(true);
  }

  armTimer(request: HostForegroundTimerRequest, callback: ForegroundTimerFiredCallback): boolean {
    this.operations.push(`timer.arm:${request.generation}`);
    this.timerArmCount += 1;
    this.timerRequest = request;
    this.timerCallback = callback;
    return true;
  }

  cancelTimer(request: HostForegroundTimerRequest): boolean {
    this.operations.push(`timer.cancel:${request.generation}`);
    this.timerCancelCount += 1;
    const matches = this.timerRequest !== null && this.timerRequest.timerId === request.timerId &&
      this.timerRequest.generation === request.generation;
    this.timerRequest = null;
    this.timerCallback = null;
    return matches;
  }

  cancelAllTimers(): void {
    this.timerRequest = null;
    this.timerCallback = null;
  }

  completeSpeech(): void {
    const callback = this.completion;
    const request = this.speechRequest;
    if (callback === null || request === null) return;
    callback(
      request.articleId ?? '', request.correlationId ?? '', request.generation ?? -1,
      request.sliceIndex ?? -1,
    );
  }

  failSpeech(message: string): void {
    const callback = this.failure;
    const request = this.speechRequest;
    if (callback === null || request === null) return;
    callback(
      request.articleId ?? '', request.correlationId ?? '', request.generation ?? -1,
      request.sliceIndex ?? -1, message,
    );
  }

  fireTimer(): void {
    const callback = this.timerCallback;
    const request = this.timerRequest;
    this.timerCallback = null;
    this.timerRequest = null;
    if (callback === null || request === null) return;
    callback(request.timerId, request.correlationId, request.generation);
  }
}

function configureActiveReader(core: FakePlaybackCore, platform: FakePlaybackPlatform): void {
  ReaderUiStore.init(undefined, undefined, core, platform);
  ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
  const state = ReaderUiStore.snapshot();
  state.currentBook = {
    bookId: 'book-1', sourceId: 'source-1', title: '测试书', author: '作者', coverUrl: '',
    summary: '', sourceName: '测试源', sourceUrl: 'https://example.com',
    latestChapter: '第一章', chapterListUrl: '/toc',
  };
  state.chapterContent = ['第一段正文内容用于第一页分页锚点', '第二段正文内容用于第二页分页锚点'];
  state.chapterToc = [{ index: 4, title: '第一章', chapterId: '/chapter/4' }];
  state.currentChapterTitle = '第一章';
  state.activeReaderContentIdentity = { bookId: 'book-1', sourceId: 'source-1', chapterIndex: 4 };
  state.canonicalReaderLocation = {
    bookId: 'book-1', chapterIndex: 4, chapterOffset: 0, chapterProgress: 0,
    locationRevision: 'location-revision-0', resolverVersion: 'reader.location.resolve.v1.reflow',
  };
  state.readerPageIndex = 0;
  ReaderUiStore.dispatch({ type: 'set-reader-page-count', readerPageCount: 3 });
}

function pageLayout(correlationId: string, target: number, offset: number): boolean {
  return ReaderUiStore.providePlaybackMeasuredLayout(correlationId, {
    anchor: `book-1:4:${offset}`,
    targetPageIndex: target,
    chapterIndex: 4,
    chapterOffset: offset,
    chapterProgress: offset / 100,
    viewportWidth: 412,
    viewportHeight: 915,
    fontScale: 1,
  });
}

export default function ReaderPlaybackPilotExecutorTests(): void {
  describe('Reader playback Pilot executor', () => {
    it('page pair stays Shadow in default Pilot mode', 0, () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      // No setPlaybackPilotPairsForTest: the page pair remains Shadow by default
      // while TTS and auto-page pairs are Pilot. The native page owner must move
      // the integer index without engaging Core or the playback executor.
      ReaderUiStore.dispatch({ type: 'reader-page-next' });
      expect(ReaderUiStore.snapshot().readerPageIndex).assertEqual(1);
      expect(core.operations.length).assertEqual(0);
      expect(ReaderUiStore.playbackPilotSnapshot().executedEffects).assertEqual(0);
    });

    it('defaults to Pilot: TTS start executes without explicit pair enable', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      // No setPlaybackPilotPairsForTest: the TTS pair is Pilot by default.
      ReaderUiStore.dispatch({ type: 'tts-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('tts');
      expect(core.operations.join(',')).assertEqual('tts.slice,tts.play');
      expect(platform.operations.join(',')).assertEqual('speech.start:0');
    });

    it('defaults to Pilot: TTS stop terminates speech without explicit pair enable', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      // No setPlaybackPilotPairsForTest: the TTS pair is Pilot by default.
      ReaderUiStore.dispatch({ type: 'tts-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('tts');
      // Dispatch the toggle again to stop TTS while speech is in flight.
      ReaderUiStore.dispatch({ type: 'tts-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(core.operations[core.operations.length - 1]).assertEqual('tts.stop');
      expect(platform.operations[platform.operations.length - 1]).assertEqual('speech.stop');
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('');
    });

    it('defaults to Pilot: auto-page start arms timer without explicit pair enable', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      // No setPlaybackPilotPairsForTest: the auto-page pair is Pilot by default.
      ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(platform.timerArmCount).assertEqual(1);
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('auto-page');
    });

    it('defaults to Pilot: auto-page stop cancels timer without explicit pair enable', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      // No setPlaybackPilotPairsForTest: the auto-page pair is Pilot by default.
      ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(platform.timerArmCount).assertEqual(1);
      // Dispatch the toggle again to stop auto-page while the timer is armed.
      ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(platform.timerCancelCount).assertEqual(1);
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('');
    });

    it('defaults to Pilot: TTS to auto-page handoff works without explicit pair enable', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      // No setPlaybackPilotPairsForTest: both TTS and auto-page pairs are Pilot
      // by default. Starting auto-page while TTS is active must tear down speech
      // and Core before arming the timer.
      ReaderUiStore.dispatch({ type: 'tts-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('tts');
      ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(core.operations[core.operations.length - 1]).assertEqual('tts.stop');
      expect(platform.operations.includes('timer.arm:1')).assertTrue();
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('auto-page');
    });

    it('defaults to Pilot: Shadow fallback can be restored via setPlaybackPilotPairsForTest', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      // Explicitly disable all three pairs to exercise the Shadow fallback and
      // prove the default is Pilot-enabled rather than hard-wired.
      ReaderUiStore.setPlaybackPilotPairsForTest(false, false, false);
      ReaderUiStore.dispatch({ type: 'tts-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(core.operations.length).assertEqual(0);
      expect(platform.operations.length).assertEqual(0);
      ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(platform.timerArmCount).assertEqual(0);
    });

    it('page pair waits for measured layout and matching Core location before commit', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      ReaderUiStore.setPlaybackPilotPairsForTest(true, false, false);
      ReaderUiStore.dispatch({ type: 'reader-page-next' });
      const correlation = ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId;
      expect(correlation.length > 0).assertTrue();
      expect(ReaderUiStore.snapshot().readerPageIndex).assertEqual(0);
      expect(core.operations.length).assertEqual(0);
      expect(pageLayout(correlation, 1, 40)).assertTrue();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(ReaderUiStore.snapshot().readerPageIndex).assertEqual(1);
      expect(ReaderUiStore.snapshot().canonicalReaderLocation?.chapterOffset).assertEqual(40);
      expect(ReaderUiStore.snapshot().canonicalReaderLocation?.locationRevision)
        .assertEqual('location-revision-40');
      expect(core.operations.join(',')).assertEqual('location:40,progress:40');
      expect(core.progressUpdates[0].bookId).assertEqual('book-1');
      expect(core.progressUpdates[0].sourceId).assertEqual('source-1');
      expect(core.progressUpdates[0].chapterIndex).assertEqual(4);
      expect(core.progressUpdates[0].chapterOffset).assertEqual(40);
      expect(core.progressUpdates[0].chapterProgress).assertEqual(0.4);
      expect(core.progressUpdates[0].locationRevision).assertEqual('location-revision-40');
    });

    it('page pair keeps the old visible page until the durable progress row succeeds', 0, async () => {
      const core = new FakePlaybackCore();
      core.deferProgress = true;
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      ReaderUiStore.setPlaybackPilotPairsForTest(true, false, false);
      ReaderUiStore.dispatch({ type: 'reader-page-next' });
      const correlation = ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId;
      expect(pageLayout(correlation, 1, 40)).assertTrue();
      for (let tick = 0; tick < 20 && core.progressUpdates.length === 0; tick += 1) {
        await Promise.resolve();
      }
      expect(core.progressUpdates.length).assertEqual(1);
      expect(ReaderUiStore.snapshot().readerPageIndex).assertEqual(0);
      expect(ReaderUiStore.snapshot().canonicalReaderLocation?.chapterOffset).assertEqual(0);
      expect(ReaderUiStore.runtimeShadowSnapshot().runtimeState.pageTransaction?.stage)
        .assertEqual('persisting-progress');

      core.completeProgress();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(ReaderUiStore.snapshot().readerPageIndex).assertEqual(1);
      expect(ReaderUiStore.snapshot().canonicalReaderLocation?.chapterOffset).assertEqual(40);
      expect(ReaderUiStore.runtimeShadowSnapshot().runtimeState.pageTransaction === undefined).assertTrue();
    });

    it('progress failure and mismatched raw Core rows preserve the last committed page', 0, async () => {
      const failingCore = new FakePlaybackCore();
      failingCore.failProgress = true;
      const failingPlatform = new FakePlaybackPlatform();
      configureActiveReader(failingCore, failingPlatform);
      ReaderUiStore.setPlaybackPilotPairsForTest(true, false, false);
      ReaderUiStore.dispatch({ type: 'reader-page-next' });
      const failedCorrelation = ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId;
      expect(pageLayout(failedCorrelation, 1, 40)).assertTrue();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(ReaderUiStore.snapshot().readerPageIndex).assertEqual(0);
      expect(ReaderUiStore.snapshot().canonicalReaderLocation?.chapterOffset).assertEqual(0);
      expect(ReaderUiStore.snapshot().error?.message).assertEqual('progress-store-failed');

      const mismatchCore = new FakePlaybackCore();
      mismatchCore.mismatchProgressRevision = true;
      const mismatchPlatform = new FakePlaybackPlatform();
      configureActiveReader(mismatchCore, mismatchPlatform);
      ReaderUiStore.setPlaybackPilotPairsForTest(true, false, false);
      ReaderUiStore.dispatch({ type: 'reader-page-next' });
      const mismatchCorrelation = ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId;
      expect(pageLayout(mismatchCorrelation, 1, 40)).assertTrue();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(ReaderUiStore.snapshot().readerPageIndex).assertEqual(0);
      expect(ReaderUiStore.snapshot().canonicalReaderLocation?.chapterOffset).assertEqual(0);
      expect(ReaderUiStore.snapshot().error?.message)
        .assertEqual('reading.progress.update returned a mismatched durable progress row');
    });

    it('progress commit boundary blocks route replacement and survives destroy teardown', 0, async () => {
      const core = new FakePlaybackCore();
      core.deferProgress = true;
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      ReaderUiStore.setPlaybackPilotPairsForTest(true, false, false);
      ReaderUiStore.dispatch({ type: 'reader-page-next' });
      const correlation = ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId;
      expect(pageLayout(correlation, 1, 40)).assertTrue();
      for (let tick = 0; tick < 20 && core.progressUpdates.length === 0; tick += 1) {
        await Promise.resolve();
      }
      expect(core.progressUpdates.length).assertEqual(1);

      ReaderUiStore.dispatch({ type: 'route-replace', id: 'settings' });
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');
      expect(ReaderUiStore.runtimeShadowSnapshot().metrics.lastRuntimeError.indexOf(
        'PAGE_PROGRESS_COMMIT_PENDING',
      ) >= 0).assertTrue();
      expect(ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId).assertEqual(correlation);

      const teardown = ReaderUiStore.teardownPlaybackForDestroy();
      core.completeProgress();
      await teardown;
      expect(ReaderUiStore.snapshot().readerPageIndex).assertEqual(1);
      expect(ReaderUiStore.snapshot().canonicalReaderLocation?.chapterOffset).assertEqual(40);
      expect(core.progressUpdates.length).assertEqual(1);
    });

    it('superseding page intent cancels the exact request handle', 0, async () => {
      const core = new FakePlaybackCore();
      core.deferFirstLocation = true;
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      ReaderUiStore.setPlaybackPilotPairsForTest(true, false, false);
      ReaderUiStore.dispatch({ type: 'reader-page-next' });
      const first = ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId;
      expect(pageLayout(first, 1, 40)).assertTrue();
      // Let the serialized executor materialize the request-scoped handle;
      // supersession before this point correctly prevents the request entirely
      // and therefore has nothing to cancel.
      for (let tick = 0; tick < 20 && core.locationHandles.length === 0; tick += 1) {
        await Promise.resolve();
      }
      expect(core.locationHandles.length).assertEqual(1);
      ReaderUiStore.dispatch({ type: 'reader-page-next' });
      const second = ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId;
      expect(second === first).assertFalse();
      expect((core.locationHandles[0] as DeferredPlaybackHandle).cancelled).assertTrue();
      expect(pageLayout(second, 1, 45)).assertTrue();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect((core.locationHandles[0] as DeferredPlaybackHandle).cancelled).assertTrue();
      expect(ReaderUiStore.snapshot().readerPageIndex).assertEqual(1);
      expect(ReaderUiStore.snapshot().canonicalReaderLocation?.chapterOffset).assertEqual(45);
    });

    it('TTS performs plan play speech then done next and final Completed stop', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      ReaderUiStore.setPlaybackPilotPairsForTest(false, true, false);
      ReaderUiStore.dispatch({ type: 'tts-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('tts');
      expect(core.operations.join(',')).assertEqual('tts.slice,tts.play');
      expect(platform.operations.join(',')).assertEqual('speech.start:0');

      platform.completeSpeech();
      platform.completeSpeech();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(core.operations.join(','))
        .assertEqual('tts.slice,tts.play,tts.report:0:done,tts.next');
      expect(platform.operations.join(',')).assertEqual('speech.start:0,speech.start:1');
      expect(ReaderUiStore.playbackPilotSnapshot().ignoredLateCallbacks > 0).assertTrue();

      platform.completeSpeech();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(core.operations.join(','))
        .assertEqual('tts.slice,tts.play,tts.report:0:done,tts.next,tts.report:1:done,tts.next,tts.stop');
      expect(platform.operations.join(','))
        .assertEqual('speech.start:0,speech.start:1,speech.stop');
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('');
      expect(ReaderUiStore.snapshot().ttsSession.playback).assertEqual('idle');
    });

    it('auto-page uses one-shot timer page transaction rearm and manual cancellation', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      ReaderUiStore.setPlaybackPilotPairsForTest(true, false, true);
      ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(platform.timerArmCount).assertEqual(1);
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('auto-page');

      platform.fireTimer();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      const pageCorrelation = ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId;
      expect(pageCorrelation.length > 0).assertTrue();
      expect(pageLayout(pageCorrelation, 1, 40)).assertTrue();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(ReaderUiStore.snapshot().readerPageIndex).assertEqual(1);
      expect(platform.timerArmCount).assertEqual(2);

      ReaderUiStore.dispatch({ type: 'reader-page-next' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(platform.timerCancelCount).assertEqual(1);
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('');
      expect(ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId.length > 0).assertTrue();
    });

    it('auto-page progress failure preserves the old page and terminates the session', 0, async () => {
      const core = new FakePlaybackCore();
      core.failProgress = true;
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      ReaderUiStore.setPlaybackPilotPairsForTest(true, false, true);
      ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      platform.fireTimer();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      const pageCorrelation = ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId;
      expect(pageLayout(pageCorrelation, 1, 40)).assertTrue();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(ReaderUiStore.snapshot().readerPageIndex).assertEqual(0);
      expect(ReaderUiStore.snapshot().canonicalReaderLocation?.chapterOffset).assertEqual(0);
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('');
      expect(platform.timerArmCount).assertEqual(1);
      expect(ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId).assertEqual('');
      expect(ReaderUiStore.playbackPilotSnapshot().activeAutoPageCorrelationId).assertEqual('');
    });

    it('asynchronous speech failure reports failed and performs terminal teardown', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      ReaderUiStore.setPlaybackPilotPairsForTest(false, true, false);
      ReaderUiStore.dispatch({ type: 'tts-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      platform.failSpeech('speech-engine-failed');
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(core.operations.join(','))
        .assertEqual('tts.slice,tts.play,tts.report:0:failed,tts.stop');
      expect(platform.operations.join(',')).assertEqual('speech.start:0,speech.stop');
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('');
      expect(ReaderUiStore.snapshot().error?.message).assertEqual('speech-engine-failed');
    });

    it('TTS to auto-page waits for speech and Core teardown before timer arm', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      ReaderUiStore.setPlaybackPilotPairsForTest(true, true, true);
      ReaderUiStore.dispatch({ type: 'tts-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      const combined = core.operations.concat(platform.operations).join(',');
      expect(core.operations[core.operations.length - 1]).assertEqual('tts.stop');
      expect(platform.operations.join(',')).assertEqual('speech.start:0,speech.stop,timer.arm:1');
      expect(combined.indexOf('tts.stop') >= 0).assertTrue();
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('auto-page');
    });

    it('background invalidates the auto-page generation and cancels its timer', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      ReaderUiStore.setPlaybackPilotPairsForTest(true, false, true);
      ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      await ReaderUiStore.suspendPlaybackForBackground();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(platform.timerCancelCount).assertEqual(1);
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('');
      expect(ReaderUiStore.playbackPilotSnapshot().activeAutoPageCorrelationId).assertEqual('');
    });

    it('page boundary fails closed instead of leaving auto-page pending forever', 0, async () => {
      const core = new FakePlaybackCore();
      const platform = new FakePlaybackPlatform();
      configureActiveReader(core, platform);
      ReaderUiStore.setPlaybackPilotPairsForTest(true, false, true);
      ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
      await ReaderUiStore.waitForPlaybackPilotIdle();
      platform.fireTimer();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      const pageCorrelation = ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId;
      expect(ReaderUiStore.rejectPlaybackPageProposal(
        pageCorrelation, 'PAGE_BOUNDARY_NEXT_CHAPTER_REQUIRED',
      )).assertTrue();
      await ReaderUiStore.waitForPlaybackPilotIdle();
      expect(ReaderUiStore.playbackPilotSnapshot().activePageCorrelationId).assertEqual('');
      expect(ReaderUiStore.playbackPilotSnapshot().activeAutoPageCorrelationId).assertEqual('');
      expect(ReaderUiStore.snapshot().activeSession).assertEqual('');
      expect(ReaderUiStore.snapshot().error?.message).assertEqual('PAGE_BOUNDARY_NEXT_CHAPTER_REQUIRED');
      expect(core.operations.length).assertEqual(0);
    });
  });
}

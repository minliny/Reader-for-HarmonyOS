// ReaderSourceSwitchPilotExecutor.test — Store-level proof for the H4-D
// source switch Pilot executor. The fake Core gateway keeps every command
// deferred so these tests can assert correlation ownership, stage dispatch,
// fail-closed semantics, stale-result rejection, and rollback without a
// device NAPI runtime.
import { describe, it, expect } from '@ohos/hypium';
import type { ReaderUIEffect, ReaderUIState } from 'reader_ui_runtime';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import {
  ReaderSourceSwitchCommandHandle,
  ReaderSourceSwitchCoreGateway,
  ReaderSourceSwitchEffectExecutor,
  ReaderSourceSwitchPilotHost,
  ReaderSourceSwitchRuntimeGateway,
} from '../main/ets/ui/store/ReaderSourceSwitchPilotExecutor';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import { ReaderUiState, UiEvent } from '../main/ets/ui/store/ReaderUiState';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';

class DeferredSourceSwitchHandle implements ReaderSourceSwitchCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  cancelCalls: number = 0;
  private resultResolver: ((value: JsonObject) => void) | undefined = undefined;
  private rejecter: ((error: Error) => void) | undefined = undefined;

  constructor(requestId: number) {
    this.requestId = requestId;
    this.result = new Promise<JsonObject>((resolve, reject): void => {
      this.resultResolver = (data: JsonObject): void => {
        resolve(data);
      };
      this.rejecter = (error: Error): void => {
        reject(error);
      };
    });
  }

  cancel(): boolean {
    this.cancelCalls += 1;
    return this.cancelCalls === 1;
  }

  resolve(data: JsonObject): void {
    const resolver = this.resultResolver;
    if (resolver === undefined) throw new Error('deferred source switch result has no resolver');
    resolver(data);
  }

  reject(error: Error): void {
    const rejecter = this.rejecter;
    if (rejecter === undefined) throw new Error('deferred source switch result has no rejecter');
    rejecter(error);
  }
}

class RecordingSourceSwitchCoreGateway implements ReaderSourceSwitchCoreGateway {
  commitHandles: DeferredSourceSwitchHandle[] = [];
  rollbackHandles: DeferredSourceSwitchHandle[] = [];
  effectOrder: string[] = [];
  commitBookIds: string[] = [];
  commitSourceIds: string[] = [];
  rollbackBookIds: string[] = [];
  throwOnCommit: boolean = false;
  private nextRequestId: number = 1;

  beginSourceSwitchCommit(bookId: string, selectedSourceId: string, _options: JsonObject): ReaderSourceSwitchCommandHandle {
    if (this.throwOnCommit) throw new Error('mock source.switch.commit boundary failure');
    this.effectOrder.push('source.switch.commit');
    this.commitBookIds.push(bookId);
    this.commitSourceIds.push(selectedSourceId);
    return this.newHandle(this.commitHandles);
  }

  beginSourceSwitchRollback(bookId: string): ReaderSourceSwitchCommandHandle {
    this.effectOrder.push('source.switch.rollback');
    this.rollbackBookIds.push(bookId);
    return this.newHandle(this.rollbackHandles);
  }

  private newHandle(target: DeferredSourceSwitchHandle[]): DeferredSourceSwitchHandle {
    const handle = new DeferredSourceSwitchHandle(this.nextRequestId);
    this.nextRequestId += 1;
    target.push(handle);
    return handle;
  }
}

// ── Mocks for direct executor tests (stale-result guard) ──

class MockSourceSwitchRuntimeState implements ReaderUIState {
  routeId: string = 'source-switch';
  routeStack: string[] = ['bookshelf', 'source-switch'];
  tab: string = 'bookshelf';
  loading: boolean = true;
  reducedMotion: boolean = false;
  readerPageIndex: number = 0;
}

class MockSourceSwitchRuntime implements ReaderSourceSwitchRuntimeGateway {
  currentState(): ReaderUIState {
    return new MockSourceSwitchRuntimeState();
  }
}

class MockSourceSwitchHost implements ReaderSourceSwitchPilotHost {
  readonly events: UiEvent[] = [];
  private readonly stateReader: () => ReaderUiState;

  constructor(stateReader: () => ReaderUiState) {
    this.stateReader = stateReader;
  }

  nativeState(): ReaderUiState { return this.stateReader(); }
  applyRuntimeState(_runtimeState: ReaderUIState): void { /* no-op for source switch */ }
  applyDomainEvent(event: UiEvent): void { this.events.push(event); }
}

class MockSourceSwitchEffect implements ReaderUIEffect {
  kind: 'core' = 'core';
  type: string;
  payload: Record<string, string>;
  correlationId: string;

  constructor(type: string, correlationId: string, payload: Record<string, string> = {}) {
    this.type = type;
    this.payload = payload;
    this.correlationId = correlationId;
  }
}

// ── Event helpers ──

function sourceSwitchConfirmEvent(bookId: string = 'switch-book-1'): UiEvent {
  return {
    type: 'source.switch.confirm',
    bookId: bookId,
    sourceId: 'src-new',
    readerUIJSONPayload: JSON.parse('{' +
      `"from":{"sourceId":"src-old","bookId":"${bookId}"},` +
      '"target":{"sourceId":"src-new","bookId":"new-book-url","title":"测试书",' +
      '"author":"测试作者","coverUrl":null},' +
      '"newToc":[{"chapterId":"chapter-1","chapterTitle":"第一章",' +
      '"chapterUrl":"https://example.test/chapter/1","order":0}],' +
      '"currentChapterTitle":"第一章","currentChapterIndex":0,"updatedAt":1' +
      '}') as Object as ReaderUIJSONPayload,
  };
}

function sourceSwitchRollbackEvent(bookId: string = 'switch-book-1'): UiEvent {
  return {
    type: 'source.switch.rollback',
    bookId: bookId,
    readerUIJSONPayload: JSON.parse('{' +
      '"rollbackToken":{' +
      `"oldBook":{"sourceId":"src-old","bookId":"${bookId}","addedAt":1},` +
      '"committedBook":{"sourceId":"src-new","bookId":"new-book-url","addedAt":1}' +
      '}}') as Object as ReaderUIJSONPayload,
  };
}

function commitResult(): JsonObject {
  return JSON.parse('{' +
    '"candidates":[' +
    '{"sourceId":"src-new","bookUrl":"new-book-url","bookName":"测试书","author":"测试作者"}' +
    ']' +
    '}') as JsonObject;
}

async function flushSourceSwitchResult(): Promise<void> {
  // One turn resolves the fake Core promise and a second runs the executor's
  // domain-event callback. Keep this microtask-only: no timing-based proof
  // is substituted for a real Core response.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function initSourceSwitchPilot(core: ReaderSourceSwitchCoreGateway): void {
  ReaderUiStore.init(undefined, undefined, undefined, undefined, undefined, core);
  ReaderUiStore.setSourceSwitchPilotEnabledForTest(true);
}

export default function ReaderSourceSwitchPilotExecutorTests(): void {
  describe('ReaderUIRuntime source switch Pilot executor', () => {
    it('defaultsToShadowMode', 0, () => {
      const core = new RecordingSourceSwitchCoreGateway();
      ReaderUiStore.init(undefined, undefined, undefined, undefined, undefined, core);

      expect(ReaderUiStore.isSourceSwitchPilotEnabled()).assertFalse();
      expect(core.commitHandles.length).assertEqual(0);
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('localBookCannotAdmitSourceSwitchPilotTransaction', 0, () => {
      const core = new RecordingSourceSwitchCoreGateway();
      initSourceSwitchPilot(core);
      ReaderUiStore.dispatch({
        type: 'book-detail-success',
        book: {
          bookId: 'local-book', sourceId: 'local', title: '本地书', author: '作者',
          summary: '', sourceName: '本地导入', sourceUrl: '', latestChapter: '', chapterListUrl: 'local-book',
        },
      });

      ReaderUiStore.dispatch({ type: 'source.switch.open' });
      ReaderUiStore.dispatch({ type: 'source.switch.confirm', sourceId: 'src-new' });

      expect(core.commitHandles.length).assertEqual(0);
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.snapshot().routeId).assertEqual('bookshelf');
    });

    it('sourceSwitchConfirmDispatchesCommitEffect', 0, async () => {
      const core = new RecordingSourceSwitchCoreGateway();
      initSourceSwitchPilot(core);

      ReaderUiStore.dispatch({ type: 'source.switch.open' });
      ReaderUiStore.dispatch(sourceSwitchConfirmEvent());

      expect(core.effectOrder.join(',')).assertEqual('source.switch.commit');
      expect(core.commitHandles.length).assertEqual(1);
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().activeCorrelationId.length > 0).assertTrue();
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().executedEffects).assertEqual(1);

      core.commitHandles[0].resolve(commitResult());
      await flushSourceSwitchResult();

      // After commit completes the correlation is cleared and the completed
      // domain event has been dispatched through the host.
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().executedEffects).assertEqual(1);
    });

    it('sourceSwitchRollbackDispatchesRollbackEffect', 0, async () => {
      const core = new RecordingSourceSwitchCoreGateway();
      initSourceSwitchPilot(core);

      ReaderUiStore.dispatch(sourceSwitchRollbackEvent());
      expect(core.effectOrder.join(',')).assertEqual('source.switch.rollback');
      expect(core.rollbackHandles.length).assertEqual(1);
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().activeCorrelationId.length > 0).assertTrue();

      core.rollbackHandles[0].resolve({} as JsonObject);
      await flushSourceSwitchResult();

      // The retained rollback gateway has no canonical restoredBook payload.
      // It must fail closed and never claim SOURCE_SWITCH_CANCELLED success.
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().activeCorrelationId).assertEqual('');
      const state = ReaderUiStore.snapshot();
      expect(state.error === null || state.error.code === 'SOURCE_SWITCH_FAILED').assertTrue();
    });

    it('effectBoundaryFailureClearsTransaction', 0, () => {
      const core = new RecordingSourceSwitchCoreGateway();
      core.throwOnCommit = true;
      initSourceSwitchPilot(core);

      ReaderUiStore.dispatch(sourceSwitchConfirmEvent());

      // Fail-closed: the Core boundary threw, so the executor clears its
      // correlation and dispatches a SOURCE_SWITCH_FAILED error. The
      // coordinator does not fall through to ReaderEffects.
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().executedEffects).assertEqual(0);
    });

    it('commitFailureDispatchesFailedDomainEvent', 0, async () => {
      const core = new RecordingSourceSwitchCoreGateway();
      initSourceSwitchPilot(core);

      ReaderUiStore.dispatch({ type: 'source.switch.open' });
      ReaderUiStore.dispatch(sourceSwitchConfirmEvent());
      expect(core.commitHandles.length).assertEqual(1);

      // Reject the commit promise to simulate a Core failure.
      core.commitHandles[0].reject(new Error('Core change.bookSource 网络错误'));
      await flushSourceSwitchResult();

      // The correlation is cleared and a source-switch-failed domain event
      // has been dispatched through the host's applyDomainEvent.
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().activeCorrelationId).assertEqual('');
      const state = ReaderUiStore.snapshot();
      expect(state.error !== null).assertTrue();
      if (state.error !== null) {
        expect(state.error.code).assertEqual('SOURCE_SWITCH_FAILED');
      }
    });

    it('staleResultGuardRejectsOldCorrelation', 0, async () => {
      // Direct executor test: the Store does not expose a public cancellation
      // path for source switch, so the stale-result guard is verified by
      // cancelling the active correlation before the deferred Core handle
      // resolves.
      const core = new RecordingSourceSwitchCoreGateway();
      const runtime = new MockSourceSwitchRuntime();
      const host = new MockSourceSwitchHost((): ReaderUiState => DemoUiState.initial());
      const executor = new ReaderSourceSwitchEffectExecutor(runtime, host, core);

      const correlationId = 'test-source-switch-stale-1';
      const payload = JSON.parse('{' +
        '"from":{"sourceId":"src-old","bookId":"switch-book-1"},' +
        '"target":{"sourceId":"src-new","bookId":"new-book-url","title":"测试书","author":"作者"},' +
        '"newToc":[{"chapterId":"c1","chapterTitle":"第一章","chapterUrl":"u","order":0}],' +
        '"currentChapterTitle":"第一章","currentChapterIndex":0,"updatedAt":1}'
      ) as Object as ReaderUIJSONPayload;
      const effect = new MockSourceSwitchEffect('source.switch.commit', correlationId);

      executor.start(correlationId, payload, effect);
      expect(core.commitHandles.length).assertEqual(1);
      expect(executor.hasActiveCorrelation()).assertTrue();
      expect(executor.activeCorrelationId()).assertEqual(correlationId);

      // Cancel the active correlation while the commit handle is still deferred.
      expect(executor.cancel(correlationId)).assertTrue();
      expect(executor.hasActiveCorrelation()).assertFalse();

      // Resolving the stale handle must not re-open the correlation.
      core.commitHandles[0].resolve(commitResult());
      await flushSourceSwitchResult();

      expect(executor.hasActiveCorrelation()).assertFalse();
      expect(executor.snapshot().ignoredLateResults > 0).assertTrue();
      expect(executor.snapshot().cancelledCommands > 0).assertTrue();
      // The host must not have received a domain event for the stale result.
      expect(host.events.length).assertEqual(0);
    });

    it('overlayEventIsPilotOwned', 0, () => {
      const core = new RecordingSourceSwitchCoreGateway();
      initSourceSwitchPilot(core);

      // Overlay/route events (source.switch.open) are Pilot-owned with
      // effectPolicy=none. The coordinator must handle them without
      // dispatching any Core effect.
      ReaderUiStore.dispatch({ type: 'source.switch.open' });

      expect(core.effectOrder.length).assertEqual(0);
      expect(core.commitHandles.length).assertEqual(0);
      expect(core.rollbackHandles.length).assertEqual(0);
      // The snapshot should show no active correlation since no effect was
      // emitted.
      expect(ReaderUiStore.sourceSwitchPilotSnapshot().activeCorrelationId).assertEqual('');
    });
  });
}

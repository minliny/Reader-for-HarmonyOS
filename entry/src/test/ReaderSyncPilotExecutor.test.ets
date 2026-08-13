// ReaderSyncPilotExecutor.test — isolated proof for the disabled H4-H Sync
// experiment. The injected mock keeps generated effects deferred so tests can
// exercise correlation and fail-closed behavior. These tests do not claim the
// generated effect names are production Core commands or Host capabilities.
import { describe, it, expect } from '@ohos/hypium';
import type { ReaderUIEffect, ReaderUIState } from 'reader_ui_runtime';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import {
  ReaderSyncCommandHandle,
  ReaderSyncEffectExecutor,
  ReaderSyncExperimentalGateway,
  ReaderSyncPilotHost,
  ReaderSyncPilotRuntimeGateway,
} from '../main/ets/ui/store/ReaderSyncPilotExecutor';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import { ReaderUiState, UiEvent } from '../main/ets/ui/store/ReaderUiState';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';

class DeferredSyncHandle implements ReaderSyncCommandHandle {
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
    if (resolver === undefined) throw new Error('deferred sync result has no resolver');
    resolver(data);
  }

  reject(error: Error): void {
    const rejecter = this.rejecter;
    if (rejecter === undefined) throw new Error('deferred sync result has no rejecter');
    rejecter(error);
  }
}

class RecordingSyncCoreGateway implements ReaderSyncExperimentalGateway {
  snapshotHandles: DeferredSyncHandle[] = [];
  pushHandles: DeferredSyncHandle[] = [];
  conflictDetectHandles: DeferredSyncHandle[] = [];
  conflictResolveHandles: DeferredSyncHandle[] = [];
  httpExecuteHandles: DeferredSyncHandle[] = [];
  rollbackHandles: DeferredSyncHandle[] = [];
  effectOrder: string[] = [];
  throwOnSnapshot: boolean = false;
  throwOnPush: boolean = false;
  throwOnConflictDetect: boolean = false;
  throwOnConflictResolve: boolean = false;
  throwOnHttpExecute: boolean = false;
  private nextRequestId: number = 1;

  beginSnapshot(_params: JsonObject): ReaderSyncCommandHandle {
    if (this.throwOnSnapshot) throw new Error('mock sync.snapshot boundary failure');
    this.effectOrder.push('sync.snapshot');
    return this.newHandle(this.snapshotHandles);
  }

  beginPush(_params: JsonObject): ReaderSyncCommandHandle {
    if (this.throwOnPush) throw new Error('mock sync.push boundary failure');
    this.effectOrder.push('sync.push');
    return this.newHandle(this.pushHandles);
  }

  beginConflictDetect(_params: JsonObject): ReaderSyncCommandHandle {
    if (this.throwOnConflictDetect) throw new Error('mock sync.conflict.detect boundary failure');
    this.effectOrder.push('sync.conflict.detect');
    return this.newHandle(this.conflictDetectHandles);
  }

  beginConflictResolve(_params: JsonObject): ReaderSyncCommandHandle {
    if (this.throwOnConflictResolve) throw new Error('mock sync.conflict.resolve boundary failure');
    this.effectOrder.push('sync.conflict.resolve');
    return this.newHandle(this.conflictResolveHandles);
  }

  beginHttpExecute(_params: JsonObject): ReaderSyncCommandHandle {
    if (this.throwOnHttpExecute) throw new Error('mock http.execute boundary failure');
    this.effectOrder.push('http.execute');
    return this.newHandle(this.httpExecuteHandles);
  }

  beginRollback(): ReaderSyncCommandHandle {
    this.effectOrder.push('sync.rollback');
    return this.newHandle(this.rollbackHandles);
  }

  private newHandle(target: DeferredSyncHandle[]): DeferredSyncHandle {
    const handle = new DeferredSyncHandle(this.nextRequestId);
    this.nextRequestId += 1;
    target.push(handle);
    return handle;
  }
}

// ── Mocks for direct executor tests ──

class MockSyncRuntimeState implements ReaderUIState {
  routeId: string = 'settings';
  routeStack: string[] = ['bookshelf', 'settings'];
  tab: string = 'settings';
  loading: boolean = false;
  reducedMotion: boolean = false;
  readerPageIndex: number = 0;
}

class MockSyncRuntime implements ReaderSyncPilotRuntimeGateway {
  currentState(): ReaderUIState {
    return new MockSyncRuntimeState();
  }
}

class MockSyncHost implements ReaderSyncPilotHost {
  readonly events: UiEvent[] = [];
  private readonly stateReader: () => ReaderUiState;

  constructor(stateReader: () => ReaderUiState) {
    this.stateReader = stateReader;
  }

  nativeState(): ReaderUiState { return this.stateReader(); }
  applyRuntimeState(_runtimeState: ReaderUIState): void { /* no-op for sync */ }
  applyDomainEvent(event: UiEvent): void { this.events.push(event); }
}

class MockSyncEffect implements ReaderUIEffect {
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

function syncRunEvent(): UiEvent {
  return {
    type: 'sync-run',
    readerUIJSONPayload: JSON.parse('{"local":{},"remote":{},' +
      '"baseUrl":"https://dav.test/reader","requests":[]}') as Object as ReaderUIJSONPayload,
  };
}

function webdavConfigTestEvent(): UiEvent {
  return {
    type: 'webdav-config-test',
    readerUIJSONPayload: { 'baseUrl': 'https://dav.test/reader', 'requests': [] },
  };
}

function syncStartEvent(): UiEvent {
  return {
    type: 'sync-start',
    readerUIJSONPayload: JSON.parse('{' +
      '"local":{"snapshotId":"local","deviceId":"device-a","createdAt":1,"records":[]},' +
      '"remote":{"snapshotId":"remote","deviceId":"device-b","createdAt":1,"records":[]},' +
      '"mergedSnapshotId":"merged","mergedDeviceId":"device-a"}') as Object as ReaderUIJSONPayload,
  };
}

function syncProgressEvent(): UiEvent {
  return {
    type: 'sync-progress', value: 50,
    readerUIJSONPayload: { 'baseUrl': 'https://dav.test/reader', 'requests': [] },
  };
}

function syncCompleteEvent(): UiEvent {
  return {
    type: 'sync-complete', success: true,
    readerUIJSONPayload: { 'baseUrl': 'https://dav.test/reader', 'requests': [] },
  };
}

function syncConflictEvent(): UiEvent {
  return {
    type: 'sync-conflict', message: 'Local vs remote chapter mismatch',
    readerUIJSONPayload: JSON.parse('{' +
      '"local":{"snapshotId":"local","deviceId":"device-a","createdAt":1,"records":[]},' +
      '"remote":{"snapshotId":"remote","deviceId":"device-b","createdAt":2,"records":[]},' +
      '"mergedSnapshotId":"merged","mergedDeviceId":"merge-device"}') as Object as ReaderUIJSONPayload,
  };
}

function syncResolveEvent(): UiEvent {
  return {
    type: 'sync-resolve', message: 'keep-remote',
    readerUIJSONPayload: JSON.parse('{"local":{},"remote":{},"resolutions":[]}') as Object as ReaderUIJSONPayload,
  };
}

function emptyResult(): JsonObject {
  return {} as JsonObject;
}

async function flushSyncResult(): Promise<void> {
  // One turn resolves the fake Core promise and a second runs the executor's
  // domain-event callback. Keep this microtask-only: no timing-based proof
  // is substituted for a real Core response.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function initSyncExperiment(core: ReaderSyncExperimentalGateway): void {
  ReaderUiStore.init(undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, core);
  ReaderUiStore.setSyncPilotEnabledForTest(true);
}

export default function ReaderSyncPilotExecutorTests(): void {
  describe('ReaderUIRuntime disabled Sync experiment', () => {
    it('defaultsToShadowWithNoProductionExecutor', 0, () => {
      ReaderUiStore.init();
      expect(ReaderUiStore.isSyncPilotEnabled()).assertFalse();
      expect(ReaderUiStore.syncPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.syncPilotSnapshot().executedEffects).assertEqual(0);
    });

    it('syncRunDoesNotClaimTheGeneratedMultiEffectSequenceAsExecutable', 0, () => {
      const core = new RecordingSyncCoreGateway();
      initSyncExperiment(core);

      ReaderUiStore.dispatch(syncRunEvent());

      // The runtime emits two generated effects. The experiment admits only a
      // single effect and therefore fails closed before touching the injected
      // mock. This is intentionally not evidence for production Core support.
      expect(core.effectOrder.length).assertEqual(0);
      expect(ReaderUiStore.syncPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.syncPilotSnapshot().executedEffects).assertEqual(0);
      expect(ReaderUiStore.runtimeShadowSnapshot().metrics.pilotFailure).assertEqual(1);
    });

    it('webdavConfigTestDoesNotTreatHttpExecuteAsACoreCommand', 0, () => {
      const core = new RecordingSyncCoreGateway();
      initSyncExperiment(core);

      ReaderUiStore.dispatch(webdavConfigTestEvent());

      // The generated action combines a Core effect and a Host request. Until
      // a typed Host adapter is mapped, the disabled experiment fails closed
      // and never forwards http.execute through a Core gateway.
      expect(core.effectOrder.length).assertEqual(0);
      expect(core.httpExecuteHandles.length).assertEqual(0);
      expect(ReaderUiStore.syncPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.runtimeShadowSnapshot().metrics.pilotFailure).assertEqual(1);
    });

    it('syncStartDispatchesSnapshotEffectWithStaleResultGuard', 0, async () => {
      const core = new RecordingSyncCoreGateway();
      const runtime = new MockSyncRuntime();
      const host = new MockSyncHost((): ReaderUiState => DemoUiState.initial());
      const executor = new ReaderSyncEffectExecutor(runtime, host, core);

      const correlationId = 'test-sync-start-stale-1';
      const payload: Record<string, string> = {};
      payload['action'] = 'start';
      const effect = new MockSyncEffect('sync.snapshot', correlationId, payload);

      executor.start(correlationId, payload, effect);
      expect(core.snapshotHandles.length).assertEqual(1);
      expect(executor.hasActiveCorrelation()).assertTrue();
      expect(executor.activeCorrelationId()).assertEqual(correlationId);

      // Cancel the active correlation while the snapshot handle is deferred.
      // This exercises the staleResultGuard.
      expect(executor.cancel(correlationId)).assertTrue();
      expect(executor.hasActiveCorrelation()).assertFalse();

      // Resolving the stale handle must not re-open the correlation.
      core.snapshotHandles[0].resolve(emptyResult());
      await flushSyncResult();

      expect(executor.hasActiveCorrelation()).assertFalse();
      expect(executor.snapshot().ignoredLateResults > 0).assertTrue();
      expect(executor.snapshot().cancelledCommands > 0).assertTrue();
    });

    it('syncProgressDispatchesPushEffect', 0, async () => {
      const core = new RecordingSyncCoreGateway();
      initSyncExperiment(core);

      ReaderUiStore.dispatch(syncProgressEvent());

      expect(core.effectOrder.join(',')).assertEqual('sync.push');
      expect(core.pushHandles.length).assertEqual(1);
      expect(ReaderUiStore.syncPilotSnapshot().activeCorrelationId.length > 0).assertTrue();

      core.pushHandles[0].resolve(emptyResult());
      await flushSyncResult();

      expect(ReaderUiStore.syncPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('syncCompleteDispatchesPushEffect', 0, async () => {
      const core = new RecordingSyncCoreGateway();
      initSyncExperiment(core);

      ReaderUiStore.dispatch(syncCompleteEvent());

      expect(core.effectOrder.join(',')).assertEqual('sync.push');
      expect(core.pushHandles.length).assertEqual(1);

      core.pushHandles[0].resolve(emptyResult());
      await flushSyncResult();

      expect(ReaderUiStore.syncPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('syncConflictDispatchesConflictDetectEffect', 0, async () => {
      const core = new RecordingSyncCoreGateway();
      initSyncExperiment(core);

      ReaderUiStore.dispatch(syncConflictEvent());

      expect(core.effectOrder.join(',')).assertEqual('sync.conflict.detect');
      expect(core.conflictDetectHandles.length).assertEqual(1);
      expect(ReaderUiStore.syncPilotSnapshot().activeCorrelationId.length > 0).assertTrue();

      core.conflictDetectHandles[0].resolve(emptyResult());
      await flushSyncResult();

      expect(ReaderUiStore.syncPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('syncResolveDispatchesConflictResolveEffectAndRollbackOnFailure', 0, async () => {
      const core = new RecordingSyncCoreGateway();
      initSyncExperiment(core);

      ReaderUiStore.dispatch(syncResolveEvent());

      expect(core.effectOrder.join(',')).assertEqual('sync.conflict.resolve');
      expect(core.conflictResolveHandles.length).assertEqual(1);

      // Reject the resolve promise to simulate a Core failure.
      core.conflictResolveHandles[0].reject(new Error('Core sync.conflict.resolve 失败'));
      await flushSyncResult();

      // The correlation is cleared and a rollback was attempted.
      expect(ReaderUiStore.syncPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(core.rollbackHandles.length).assertEqual(1);
      const state = ReaderUiStore.snapshot();
      expect(state.error !== null).assertTrue();
      if (state.error !== null) {
        expect(state.error.code).assertEqual('SYNC_PILOT_FAILED');
      }
    });

    it('failClosedClearsCorrelationWhenEffectExecutorThrows', 0, async () => {
      // Direct executor test: when the effect executor's Core boundary throws,
      // the executor must clear its correlation and dispatch a SYNC_PILOT_FAILED
      // error. No orphan ledger remains.
      const core = new RecordingSyncCoreGateway();
      core.throwOnPush = true;
      const runtime = new MockSyncRuntime();
      const host = new MockSyncHost((): ReaderUiState => DemoUiState.initial());
      const executor = new ReaderSyncEffectExecutor(runtime, host, core);

      const correlationId = 'test-sync-fail-closed-1';
      const payload: Record<string, string> = {};
      payload['action'] = 'progress';
      const effect = new MockSyncEffect('sync.push', correlationId, payload);

      // start() should invoke the Core gateway which throws; the executor's
      // fail path clears the correlation and dispatches an error.
      executor.start(correlationId, payload, effect);

      // The correlation must be cleared (no orphan ledger).
      expect(executor.hasActiveCorrelation()).assertFalse();
      expect(executor.snapshot().executedEffects).assertEqual(0);
      // The host must have received a set-error domain event.
      let sawError = false;
      for (let i = 0; i < host.events.length; i += 1) {
        if (host.events[i].type === 'set-error') sawError = true;
      }
      expect(sawError).assertTrue();
    });

    it('injectedMockSnapshotFailureClearsTheExperimentalCorrelation', 0, async () => {
      const core = new RecordingSyncCoreGateway();
      const runtime = new MockSyncRuntime();
      const host = new MockSyncHost((): ReaderUiState => DemoUiState.initial());
      const executor = new ReaderSyncEffectExecutor(runtime, host, core);
      const correlationId = 'test-sync-run-failure-1';
      const payload = JSON.parse('{"local":{},"remote":{},' +
        '"baseUrl":"https://dav.test/reader","requests":[]}') as Object as ReaderUIJSONPayload;
      const effect = new MockSyncEffect('sync.snapshot', correlationId);

      executor.start(correlationId, payload, effect);
      expect(core.snapshotHandles.length).assertEqual(1);

      // This is an injected-mock failure only; no production Core method is
      // invoked by the disabled experiment.
      core.snapshotHandles[0].reject(new Error('mock sync.snapshot failure'));
      await flushSyncResult();

      expect(executor.activeCorrelationId()).assertEqual('');
      expect(core.rollbackHandles.length).assertEqual(1);
      let sawFailure = false;
      for (let index = 0; index < host.events.length; index += 1) {
        if (host.events[index].type === 'set-error' &&
          host.events[index].error?.code === 'SYNC_PILOT_FAILED') {
          sawFailure = true;
        }
      }
      expect(sawFailure).assertTrue();
    });
  });
}

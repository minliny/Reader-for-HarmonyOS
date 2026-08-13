// ReaderImportPilotExecutor.test — Store-level proof for the H4-C import
// Pilot executor. The fake Core gateway keeps every command deferred so these
// tests can assert correlation ownership, stage dispatch, fail-closed
// semantics, and stale-result rejection without a device NAPI runtime.
import { describe, it, expect } from '@ohos/hypium';
import type { ReaderUIEffect, ReaderUIJSONPayload, ReaderUIState } from 'reader_ui_runtime';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import {
  ReaderImportCommandHandle,
  ReaderImportCoreGateway,
  ReaderImportEffectExecutor,
  ReaderImportPilotHost,
  ReaderImportRuntimeGateway,
} from '../main/ets/ui/store/ReaderImportPilotExecutor';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import { ReaderUiState, UiEvent } from '../main/ets/ui/store/ReaderUiState';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';

class DeferredImportHandle implements ReaderImportCommandHandle {
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
    if (resolver === undefined) throw new Error('deferred import result has no resolver');
    resolver(data);
  }
}

class RecordingImportCoreGateway implements ReaderImportCoreGateway {
  parseHandles: DeferredImportHandle[] = [];
  persistHandles: DeferredImportHandle[] = [];
  rollbackHandles: DeferredImportHandle[] = [];
  effectOrder: string[] = [];
  parseOptions: JsonObject[] = [];
  persistOptions: JsonObject[] = [];
  rollbackBookIds: string[] = [];
  throwOnParse: boolean = false;
  private nextRequestId: number = 1;

  beginImportParse(_bookId: string, options: JsonObject): ReaderImportCommandHandle {
    if (this.throwOnParse) throw new Error('mock import.parse boundary failure');
    this.effectOrder.push('import.parse');
    this.parseOptions.push(options);
    return this.newHandle(this.parseHandles);
  }

  beginImportPersist(_bookId: string, options: JsonObject): ReaderImportCommandHandle {
    this.effectOrder.push('import.persist');
    this.persistOptions.push(options);
    return this.newHandle(this.persistHandles);
  }

  beginImportRollback(bookId: string): ReaderImportCommandHandle {
    this.effectOrder.push('import.rollback');
    this.rollbackBookIds.push(bookId);
    return this.newHandle(this.rollbackHandles);
  }

  private newHandle(target: DeferredImportHandle[]): DeferredImportHandle {
    const handle = new DeferredImportHandle(this.nextRequestId);
    this.nextRequestId += 1;
    target.push(handle);
    return handle;
  }
}

// ── Mocks for direct executor tests (stale-result guard) ──

class MockImportRuntimeState implements ReaderUIState {
  routeId: string = 'local-import';
  routeStack: string[] = ['local-import'];
  tab: string = 'bookshelf';
  loading: boolean = true;
  reducedMotion: boolean = false;
  readerPageIndex: number = 0;
}

class MockImportRuntime implements ReaderImportRuntimeGateway {
  currentState(): ReaderUIState {
    return new MockImportRuntimeState();
  }
}

class MockImportHost implements ReaderImportPilotHost {
  readonly events: UiEvent[] = [];
  private readonly stateReader: () => ReaderUiState;

  constructor(stateReader: () => ReaderUiState) {
    this.stateReader = stateReader;
  }

  nativeState(): ReaderUiState { return this.stateReader(); }
  applyRuntimeState(_runtimeState: ReaderUIState): void { /* no-op for import */ }
  applyDomainEvent(event: UiEvent): void { this.events.push(event); }
}

class MockImportEffect implements ReaderUIEffect {
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

function importStartEvent(bookId: string = 'import-book-1'): UiEvent {
  return {
    type: 'import.start',
    bookId: bookId,
    sourceImportPayload: 'base64-bytes',
    importFormat: 'txt',
    sourceImportOrigin: '测试导入',
    readerUIJSONPayload: JSON.parse('{' +
      '"kind":"localBook",' +
      `"input":{"bookId":"${bookId}","title":"导入测试书",` +
      `"fileName":"${bookId}.txt","text":"第一章\\n正文"}` +
      '}') as Object as ReaderUIJSONPayload,
  };
}

function importApplyEvent(bookId: string = 'import-book-1'): UiEvent {
  return {
    type: 'import.apply',
    bookId: bookId,
    sourceImportPayload: 'base64-bytes',
    importFormat: 'txt',
    readerUIJSONPayload: JSON.parse('{' +
      '"transactionId":"tx-local-1",' +
      '"parsed":{"kind":"localBook","preview":{' +
      `"input":{"bookId":"${bookId}","text":"第一章\\n正文"},` +
      '"summary":{"book":{"book":{"bookId":"import-book-1","title":"导入测试书","author":"","variables":{}},' +
      '"format":"txt","encoding":"utf8","byteLen":16,"charLen":8,"toc":[],"chapters":[]},' +
      '"format":"txt","encoding":"utf8","byteLen":16,"charLen":8,"chapterCount":1,' +
      '"toc":[{"index":0,"title":"第一章","url":"local://import-book-1/chapter/0","variables":{}}]},' +
      '"contentSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}}') as Object as ReaderUIJSONPayload,
  };
}

function importCancelEvent(bookId: string = 'import-book-1'): UiEvent {
  return {
    type: 'import.cancel',
    bookId: bookId,
    sourceImportPayload: 'base64-bytes',
    readerUIJSONPayload: JSON.parse('{' +
      '"rollbackToken":{"kind":"localBook","token":{' +
      '"transactionId":"tx-local-1","journal":{' +
      `"transactionId":"tx-local-1","sourceId":"local","bookId":"${bookId}",` +
      '"previousBook":null,"previousTocCache":null,"previousChapters":[],' +
      '"committedBook":{"bookId":"import-book-1","title":"导入测试书","author":"","variables":{}},' +
      '"committedTocCache":{"key":"toc:import-book-1","payload":"[]"},"committedChapters":[],' +
      '"previousMarker":null,"committedMarker":{"key":"reader.ui.import.v1.marker:localBook:import-book-1","payload":"marker"}' +
      '}}}}') as Object as ReaderUIJSONPayload,
  };
}

function parseResult(bookId: string = 'import-book-1'): JsonObject {
  return JSON.parse('{' +
    `"book":{"bookId":"${bookId}","title":"导入测试书","author":"测试作者"},` +
    '"chapterCount":3,' +
    '"format":"txt",' +
    '"encoding":"UTF-8"' +
    '}') as JsonObject;
}

function persistResult(bookId: string = 'import-book-1'): JsonObject {
  return JSON.parse('{' +
    `"book":{"bookId":"${bookId}","title":"导入测试书","author":"测试作者"}` +
    '}') as JsonObject;
}

async function flushImportResult(): Promise<void> {
  // One turn resolves the fake Core promise and a second runs the executor's
  // domain-event callback. Keep this microtask-only: no timing-based proof
  // is substituted for a real Core response.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function initImportPilot(core: ReaderImportCoreGateway): void {
  ReaderUiStore.init(undefined, undefined, undefined, undefined, core);
  ReaderUiStore.setImportPilotEnabledForTest(true);
}

export default function ReaderImportPilotExecutorTests(): void {
  describe('ReaderUIRuntime import Pilot executor', () => {
    it('defaultsToShadowMode', 0, () => {
      const core = new RecordingImportCoreGateway();
      ReaderUiStore.init(undefined, undefined, undefined, undefined, core);

      expect(ReaderUiStore.isImportPilotEnabled()).assertFalse();
      expect(core.parseHandles.length).assertEqual(0);
      expect(ReaderUiStore.importPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('importStartDispatchesParseEffect', 0, async () => {
      const core = new RecordingImportCoreGateway();
      initImportPilot(core);

      ReaderUiStore.dispatch(importStartEvent());

      expect(core.effectOrder.join(',')).assertEqual('import.parse');
      expect(core.parseHandles.length).assertEqual(1);
      expect(ReaderUiStore.importPilotSnapshot().activeCorrelationId.length > 0).assertTrue();
      expect(ReaderUiStore.importPilotSnapshot().executedEffects).assertEqual(1);

      core.parseHandles[0].resolve(parseResult());
      await flushImportResult();

      // After parse completes the correlation is cleared and the preview
      // domain event has been dispatched through the host.
      expect(ReaderUiStore.importPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.importPilotSnapshot().executedEffects).assertEqual(1);
    });

    it('importApplyDispatchesPersistEffect', 0, async () => {
      const core = new RecordingImportCoreGateway();
      initImportPilot(core);

      // Complete import.start first so the executor is idle for import.apply.
      ReaderUiStore.dispatch(importStartEvent());
      core.parseHandles[0].resolve(parseResult());
      await flushImportResult();
      expect(ReaderUiStore.importPilotSnapshot().activeCorrelationId).assertEqual('');

      ReaderUiStore.dispatch(importApplyEvent());
      expect(core.effectOrder.join(',')).assertEqual('import.parse,import.persist');
      expect(core.persistHandles.length).assertEqual(1);
      expect(ReaderUiStore.importPilotSnapshot().activeCorrelationId.length > 0).assertTrue();

      core.persistHandles[0].resolve(persistResult());
      await flushImportResult();

      expect(ReaderUiStore.importPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('importCancelDispatchesRollbackEffect', 0, async () => {
      const core = new RecordingImportCoreGateway();
      initImportPilot(core);

      ReaderUiStore.dispatch(importCancelEvent());
      expect(core.effectOrder.join(',')).assertEqual('import.rollback');
      expect(core.rollbackHandles.length).assertEqual(1);
      expect(ReaderUiStore.importPilotSnapshot().activeCorrelationId.length > 0).assertTrue();

      core.rollbackHandles[0].resolve({} as JsonObject);
      await flushImportResult();

      // The retained Host rollback gateway returns no canonical W1 restore
      // record. Strict result validation therefore fails closed instead of
      // fabricating an IMPORT_CANCELLED success.
      expect(ReaderUiStore.importPilotSnapshot().activeCorrelationId).assertEqual('');
      const state = ReaderUiStore.snapshot();
      expect(state.error !== null).assertTrue();
      if (state.error !== null) {
        expect(state.error.code).assertEqual('IMPORT_PILOT_FAILED');
      }
    });

    it('effectBoundaryFailureClearsTransaction', 0, () => {
      const core = new RecordingImportCoreGateway();
      core.throwOnParse = true;
      initImportPilot(core);

      ReaderUiStore.dispatch(importStartEvent());

      // Fail-closed: the Core boundary threw, so the executor clears its
      // correlation and dispatches an IMPORT_PILOT_FAILED error. The
      // coordinator does not fall through to ReaderEffects.
      expect(ReaderUiStore.importPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.importPilotSnapshot().executedEffects).assertEqual(0);
      const state = ReaderUiStore.snapshot();
      expect(state.error !== null).assertTrue();
      if (state.error !== null) {
        expect(state.error.code).assertEqual('IMPORT_PILOT_FAILED');
      }
    });

    it('staleResultGuardRejectsOldCorrelation', 0, async () => {
      // Direct executor test: the Store does not expose a public cancellation
      // path for import, so the stale-result guard is verified by cancelling
      // the active correlation before the deferred Core handle resolves.
      const core = new RecordingImportCoreGateway();
      const runtime = new MockImportRuntime();
      const host = new MockImportHost((): ReaderUiState => DemoUiState.initial());
      const executor = new ReaderImportEffectExecutor(runtime, host, core);

      const correlationId = 'test-import-stale-1';
      const payload = JSON.parse('{' +
        '"kind":"localBook","input":{' +
        '"bookId":"import-book-1","fileName":"import-book-1.txt","text":"第一章\\n正文"}}'
      ) as Object as ReaderUIJSONPayload;
      const effect = new MockImportEffect('import.parse', correlationId);

      executor.start(correlationId, payload, effect);
      expect(core.parseHandles.length).assertEqual(1);
      expect(executor.hasActiveCorrelation()).assertTrue();
      expect(executor.activeCorrelationId()).assertEqual(correlationId);

      // Cancel the active correlation while the parse handle is still deferred.
      expect(executor.cancel(correlationId)).assertTrue();
      expect(executor.hasActiveCorrelation()).assertFalse();

      // Resolving the stale handle must not re-open the correlation.
      core.parseHandles[0].resolve(parseResult());
      await flushImportResult();

      expect(executor.hasActiveCorrelation()).assertFalse();
      expect(executor.snapshot().ignoredLateResults > 0).assertTrue();
      expect(executor.snapshot().cancelledCommands > 0).assertTrue();
      // The host must not have received a domain event for the stale result.
      expect(host.events.length).assertEqual(0);
    });
  });
}

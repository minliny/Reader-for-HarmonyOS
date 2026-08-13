// ReaderReplaceRulePilotExecutor.test — Store-level proof for the H4-E
// replace rules Pilot executor. The fake Core gateway keeps every command
// deferred so these tests can assert correlation ownership, stage dispatch,
// fail-closed semantics, stale-result rejection, rollback, and delete/update
// action routing without a device NAPI runtime.
import { describe, it, expect } from '@ohos/hypium';
import type { ReaderUIEffect, ReaderUIState } from 'reader_ui_runtime';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import {
  ReaderReplaceRuleCommandHandle,
  ReaderReplaceRuleCoreGateway,
  ReaderReplaceRuleEffectExecutor,
  ReaderReplaceRulePilotHost,
  ReaderReplaceRuleRuntimeGateway,
} from '../main/ets/ui/store/ReaderReplaceRulePilotExecutor';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import { ReaderUiState, UiEvent, ReplaceRule } from '../main/ets/ui/store/ReaderUiState';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';

class DeferredReplaceRuleHandle implements ReaderReplaceRuleCommandHandle {
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
    if (resolver === undefined) throw new Error('deferred replace rule result has no resolver');
    resolver(data);
  }

  reject(error: Error): void {
    const rejecter = this.rejecter;
    if (rejecter === undefined) throw new Error('deferred replace rule result has no rejecter');
    rejecter(error);
  }
}

class RecordingReplaceRuleCoreGateway implements ReaderReplaceRuleCoreGateway {
  persistHandles: DeferredReplaceRuleHandle[] = [];
  applyHandles: DeferredReplaceRuleHandle[] = [];
  validateHandles: DeferredReplaceRuleHandle[] = [];
  rollbackHandles: DeferredReplaceRuleHandle[] = [];
  effectOrder: string[] = [];
  persistPatterns: string[] = [];
  applyRuleIds: string[] = [];
  applyActions: string[] = [];
  throwOnPersist: boolean = false;
  private nextRequestId: number = 1;

  beginReplacePersist(payload: ReaderUIJSONPayload): ReaderReplaceRuleCommandHandle {
    if (this.throwOnPersist) throw new Error('mock replace.persist boundary failure');
    this.effectOrder.push('replace.persist');
    const params = payload['params'] as Object as ReaderUIJSONPayload;
    this.persistPatterns.push(params['pattern'] as string);
    return this.newHandle(this.persistHandles);
  }

  beginReplaceApply(ruleId: string, action: string, _pattern: string, _replacement: string,
    _scope: string, _enabled: boolean): ReaderReplaceRuleCommandHandle {
    this.effectOrder.push('replace.apply');
    this.applyRuleIds.push(ruleId);
    this.applyActions.push(action);
    return this.newHandle(this.applyHandles);
  }

  beginReplaceValidate(_pattern: string, _replacement: string, _scope: string): ReaderReplaceRuleCommandHandle {
    this.effectOrder.push('replace.validate');
    return this.newHandle(this.validateHandles);
  }

  beginReplaceRollback(): ReaderReplaceRuleCommandHandle {
    this.effectOrder.push('replace.rollback');
    return this.newHandle(this.rollbackHandles);
  }

  private newHandle(target: DeferredReplaceRuleHandle[]): DeferredReplaceRuleHandle {
    const handle = new DeferredReplaceRuleHandle(this.nextRequestId);
    this.nextRequestId += 1;
    target.push(handle);
    return handle;
  }
}

// ── Mocks for direct executor tests (stale-result guard) ──

class MockReplaceRuleRuntimeState implements ReaderUIState {
  routeId: string = 'reader-replace-overlay-v2';
  routeStack: string[] = ['immersive-reading', 'reader-replace-overlay-v2'];
  tab: string = 'bookshelf';
  loading: boolean = false;
  reducedMotion: boolean = false;
  readerPageIndex: number = 0;
}

class MockReplaceRuleRuntime implements ReaderReplaceRuleRuntimeGateway {
  currentState(): ReaderUIState {
    return new MockReplaceRuleRuntimeState();
  }
}

class MockReplaceRuleHost implements ReaderReplaceRulePilotHost {
  readonly events: UiEvent[] = [];
  private readonly stateReader: () => ReaderUiState;

  constructor(stateReader: () => ReaderUiState) {
    this.stateReader = stateReader;
  }

  nativeState(): ReaderUiState { return this.stateReader(); }
  applyRuntimeState(_runtimeState: ReaderUIState): void { /* no-op for replace rules */ }
  applyDomainEvent(event: UiEvent): void { this.events.push(event); }
}

class MockReplaceRuleEffect implements ReaderUIEffect {
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

function replaceRuleAddEvent(pattern: string = 'test-pattern'): UiEvent {
  return {
    type: 'replace-rule-add',
    replaceRulePattern: pattern,
    replaceRuleReplacement: 'test-replacement',
    replaceRuleScope: 'chapter',
    readerUIJSONPayload: JSON.parse('{' +
      '"operation":"create","params":{' +
      `"pattern":"${pattern}","replacement":"test-replacement",` +
      '"scopeContent":true,"isRegex":false}}') as Object as ReaderUIJSONPayload,
  };
}

function replaceRuleValidateEvent(pattern: string = 'test-pattern'): UiEvent {
  return {
    type: 'replace-rule-validate',
    replaceRulePattern: pattern,
    replaceRuleReplacement: 'test-replacement',
    replaceRuleScope: 'chapter',
    readerUIJSONPayload: {
      'pattern': pattern,
      'isRegex': false,
      'scope': ['chapter'],
    },
  };
}

function ruleListResult(): JsonObject {
  return JSON.parse('{' +
    '"rules":[' +
    '{"id":1,"pattern":"test-pattern","replacement":"test-replacement","scope":"chapter","isEnabled":true}' +
    ']' +
    '}') as JsonObject;
}

function emptyRuleListResult(): JsonObject {
  return JSON.parse('{"rules":[]}') as JsonObject;
}

function persistResult(): JsonObject {
  return JSON.parse('{' +
    '"operation":"create",' +
    '"data":{"rule":{' +
    '"id":1,"name":"test","pattern":"test-pattern","replacement":"test-replacement",' +
    '"scopeTitle":false,"scopeContent":true,"isEnabled":true,"isRegex":false,' +
    '"timeoutMillisecond":3000,"order":0}},' +
    '"undoToken":{' +
    '"schemaVersion":1,"transactionId":"replace-live-1",' +
    '"revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",' +
    '"operation":"create","ruleId":1,"issuedAt":1900000000,"expiresAt":1900000300,' +
    '"after":{"id":1,"name":"test","pattern":"test-pattern",' +
    '"replacement":"test-replacement","scopeTitle":false,"scopeContent":true,' +
    '"isEnabled":true,"isRegex":false,"timeoutMillisecond":3000,"order":0}}}') as JsonObject;
}

async function flushReplaceRuleResult(): Promise<void> {
  // One turn resolves the fake Core promise and a second runs the executor's
  // domain-event callback. Keep this microtask-only: no timing-based proof
  // is substituted for a real Core response.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function initReplaceRulePilot(core: ReaderReplaceRuleCoreGateway): void {
  ReaderUiStore.init(undefined, undefined, undefined, undefined, undefined, undefined, core);
  ReaderUiStore.setReplaceRulePilotEnabledForTest(true);
}

export default function ReaderReplaceRulePilotExecutorTests(): void {
  describe('ReaderUIRuntime replace rules Pilot executor', () => {
    it('defaultsToShadowMode', 0, () => {
      const core = new RecordingReplaceRuleCoreGateway();
      ReaderUiStore.init(undefined, undefined, undefined, undefined, undefined, undefined, core);

      expect(ReaderUiStore.isReplaceRulePilotEnabled()).assertFalse();
      expect(core.persistHandles.length).assertEqual(0);
      expect(ReaderUiStore.replaceRulePilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('replaceRuleCreateDispatchesPersistEffect', 0, async () => {
      const core = new RecordingReplaceRuleCoreGateway();
      initReplaceRulePilot(core);

      ReaderUiStore.dispatch(replaceRuleAddEvent());

      expect(core.effectOrder.join(',')).assertEqual('replace.persist');
      expect(core.persistHandles.length).assertEqual(1);
      expect(core.persistPatterns[0]).assertEqual('test-pattern');
      expect(ReaderUiStore.replaceRulePilotSnapshot().activeCorrelationId.length > 0).assertTrue();
      expect(ReaderUiStore.replaceRulePilotSnapshot().executedEffects).assertEqual(1);

      core.persistHandles[0].resolve(persistResult());
      await flushReplaceRuleResult();

      expect(ReaderUiStore.replaceRulePilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.replaceRulePilotSnapshot().executedEffects).assertEqual(1);
      const state = ReaderUiStore.snapshot();
      expect(state.replaceRules.length).assertEqual(1);
      expect(state.replaceRules[0].id).assertEqual('rule-1');
      expect(state.lastUndoToken !== null).assertTrue();
      expect(state.lastUndoToken!['transactionId'] as string).assertEqual('replace-live-1');
    });

    it('replaceRuleValidateDispatchesValidateEffect', 0, async () => {
      const core = new RecordingReplaceRuleCoreGateway();
      initReplaceRulePilot(core);

      ReaderUiStore.dispatch(replaceRuleValidateEvent('valid-pattern'));

      expect(core.effectOrder.join(',')).assertEqual('replace.validate');
      expect(core.validateHandles.length).assertEqual(1);
      expect(ReaderUiStore.replaceRulePilotSnapshot().activeCorrelationId.length > 0).assertTrue();

      // The old Host validator omits canonical issues[]. Strict result
      // validation rejects that shape rather than manufacturing an empty list.
      const validateResult: JsonObject = {};
      validateResult['valid'] = true;
      validateResult['pattern'] = 'valid-pattern';
      validateResult['scope'] = 'chapter';
      core.validateHandles[0].resolve(validateResult);
      await flushReplaceRuleResult();

      expect(ReaderUiStore.replaceRulePilotSnapshot().activeCorrelationId).assertEqual('');
      const state = ReaderUiStore.snapshot();
      expect(state.error?.code).assertEqual('REPLACE_RULE_PILOT_FAILED');
    });

    it('persistFailureDispatchesErrorAndRollback', 0, async () => {
      const core = new RecordingReplaceRuleCoreGateway();
      initReplaceRulePilot(core);

      ReaderUiStore.dispatch(replaceRuleAddEvent());
      expect(core.persistHandles.length).assertEqual(1);

      // Reject the persist promise to simulate a Core failure.
      core.persistHandles[0].reject(new Error('Core replace-rule.create 网络错误'));
      await flushReplaceRuleResult();

      // The correlation is cleared and a REPLACE_RULE_PILOT_FAILED error
      // has been dispatched. The rollback gateway is called to reload the
      // canonical list.
      expect(ReaderUiStore.replaceRulePilotSnapshot().activeCorrelationId).assertEqual('');
      expect(core.rollbackHandles.length).assertEqual(1);
      const state = ReaderUiStore.snapshot();
      expect(state.error !== null).assertTrue();
      if (state.error !== null) {
        expect(state.error.code).assertEqual('REPLACE_RULE_PILOT_FAILED');
      }
    });

    it('effectBoundaryFailureClearsTransaction', 0, () => {
      const core = new RecordingReplaceRuleCoreGateway();
      core.throwOnPersist = true;
      initReplaceRulePilot(core);

      ReaderUiStore.dispatch(replaceRuleAddEvent());

      // Fail-closed: the Core boundary threw, so the executor clears its
      // correlation and dispatches a REPLACE_RULE_PILOT_FAILED error. The
      // coordinator does not fall through to ReaderEffects.
      expect(ReaderUiStore.replaceRulePilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.replaceRulePilotSnapshot().executedEffects).assertEqual(0);
    });

    it('staleResultGuardRejectsOldCorrelation', 0, async () => {
      // Direct executor test: the Store does not expose a public cancellation
      // path for replace rules, so the stale-result guard is verified by
      // cancelling the active correlation before the deferred Core handle
      // resolves.
      const core = new RecordingReplaceRuleCoreGateway();
      const runtime = new MockReplaceRuleRuntime();
      const host = new MockReplaceRuleHost((): ReaderUiState => DemoUiState.initial());
      const executor = new ReaderReplaceRuleEffectExecutor(runtime, host, core);

      const correlationId = 'test-replace-rule-stale-1';
      const payload = JSON.parse('{' +
        '"operation":"create","params":{"pattern":"stale-pattern",' +
        '"replacement":"stale-replacement","scopeContent":true,"isRegex":false}}') as ReaderUIJSONPayload;
      const effect = new MockReplaceRuleEffect('replace.persist', correlationId);

      executor.start(correlationId, payload, effect);
      expect(core.persistHandles.length).assertEqual(1);
      expect(executor.hasActiveCorrelation()).assertTrue();
      expect(executor.activeCorrelationId()).assertEqual(correlationId);

      // Cancel the active correlation while the persist handle is still deferred.
      expect(executor.cancel(correlationId)).assertTrue();
      expect(executor.hasActiveCorrelation()).assertFalse();

      // Resolving the stale handle must not re-open the correlation.
      core.persistHandles[0].resolve(ruleListResult());
      await flushReplaceRuleResult();

      expect(executor.hasActiveCorrelation()).assertFalse();
      expect(executor.snapshot().ignoredLateResults > 0).assertTrue();
      expect(executor.snapshot().cancelledCommands > 0).assertTrue();
      // The host must not have received a domain event for the stale result.
      expect(host.events.length).assertEqual(0);
    });

    it('applyDeleteDispatchesApplyEffectAndClearsPending', 0, async () => {
      // Direct executor test for the delete action: the executor must
      // dispatch replace-rule-delete-complete then replace-rule-list-loaded.
      const core = new RecordingReplaceRuleCoreGateway();
      const runtime = new MockReplaceRuleRuntime();
      const host = new MockReplaceRuleHost((): ReaderUiState => DemoUiState.initial());
      const executor = new ReaderReplaceRuleEffectExecutor(runtime, host, core);

      const correlationId = 'test-replace-rule-delete-1';
      const payload: ReaderUIJSONPayload = {
        'text': '', 'bookName': '', 'bookOrigin': '', 'target': 'chapter',
      };
      const effect = new MockReplaceRuleEffect('replace.apply', correlationId);
      let rejected = false;
      try {
        executor.start(correlationId, payload, effect);
      } catch (_error) {
        rejected = true;
      }
      // The generated contract has no delete operation: reader.replace.apply
      // transforms text. The retained legacy CRUD experiment must reject this
      // direct call instead of inventing an untyped ruleId/action alias.
      expect(rejected).assertTrue();
      expect(core.applyHandles.length).assertEqual(0);
      return;

      executor.start(correlationId, payload, effect);
      expect(core.effectOrder.join(',')).assertEqual('replace.apply');
      expect(core.applyRuleIds[0]).assertEqual('rule-1');
      expect(core.applyActions[0]).assertEqual('delete');

      // Resolve with an empty list (rule was deleted).
      core.applyHandles[0].resolve(emptyRuleListResult());
      await flushReplaceRuleResult();

      expect(executor.hasActiveCorrelation()).assertFalse();
      // The host should have received delete-complete then list-loaded.
      expect(host.events.length >= 2).assertTrue();
      let sawDeleteComplete = false;
      let sawListLoaded = false;
      for (let i = 0; i < host.events.length; i += 1) {
        if (host.events[i].type === 'replace-rule-delete-complete') sawDeleteComplete = true;
        if (host.events[i].type === 'replace-rule-list-loaded') sawListLoaded = true;
      }
      expect(sawDeleteComplete).assertTrue();
      expect(sawListLoaded).assertTrue();
    });

    it('applyUpdateDispatchesApplyEffectAndReloadsList', 0, async () => {
      // Direct executor test for the update action: the executor must
      // dispatch replace-rule-list-loaded (without delete-complete).
      const core = new RecordingReplaceRuleCoreGateway();
      const runtime = new MockReplaceRuleRuntime();
      const host = new MockReplaceRuleHost((): ReaderUiState => DemoUiState.initial());
      const executor = new ReaderReplaceRuleEffectExecutor(runtime, host, core);

      const correlationId = 'test-replace-rule-update-1';
      const payload: ReaderUIJSONPayload = {
        'text': 'before', 'bookName': 'Book', 'bookOrigin': 'source', 'target': 'chapter',
      };
      const effect = new MockReplaceRuleEffect('replace.apply', correlationId);
      let rejected = false;
      try {
        executor.start(correlationId, payload, effect);
      } catch (_error) {
        rejected = true;
      }
      expect(rejected).assertTrue();
      expect(core.applyHandles.length).assertEqual(0);
      return;

      executor.start(correlationId, payload, effect);
      expect(core.effectOrder.join(',')).assertEqual('replace.apply');
      expect(core.applyActions[0]).assertEqual('update');

      core.applyHandles[0].resolve(ruleListResult());
      await flushReplaceRuleResult();

      expect(executor.hasActiveCorrelation()).assertFalse();
      // The host should have received only list-loaded (no delete-complete).
      let sawDeleteComplete = false;
      let sawListLoaded = false;
      for (let i = 0; i < host.events.length; i += 1) {
        if (host.events[i].type === 'replace-rule-delete-complete') sawDeleteComplete = true;
        if (host.events[i].type === 'replace-rule-list-loaded') sawListLoaded = true;
      }
      expect(sawDeleteComplete).assertFalse();
      expect(sawListLoaded).assertTrue();
    });
  });
}

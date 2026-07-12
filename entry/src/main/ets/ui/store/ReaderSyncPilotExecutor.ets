// Correlation-scoped executor for the disabled Reader-UI Sync experiment.
//
// ReaderUIRuntime owns only the generated effect-emission boundary. The
// generated names below are contract proposals, not proof that matching Core
// commands or Host requests exist in the HarmonyOS production bridge. This
// executor therefore accepts only an explicitly injected experimental gateway
// and is disabled by default in ReaderUIRuntimeShadowCoordinator. It models:
//   sync.run           → sync.snapshot + sync.push  (two-stage sequence)
//   webdav.config.test → sync.push + http.execute   (push + host request)
//   sync.start         → sync.snapshot              (staleResultGuard)
//   sync.progress      → sync.push
//   sync.complete      → sync.push
//   sync.conflict      → sync.conflict.detect       (staleResultGuard)
//   sync.resolve       → sync.conflict.resolve      (rollback on failure)
import {
  type ReaderUIEffect,
  type ReaderUIJSONPayload,
  type ReaderUIJSONResult,
  type ReaderUIState,
  validateReaderUITypedResult,
} from 'reader_ui_runtime';
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import {
  ReaderUiState,
  UiEvent,
} from './ReaderUiState';

/** Experimental mode. Production always leaves this seam in SHADOW. */
export enum ReaderSyncPilotMode {
  SHADOW = 0,
  PILOT = 1,
}

/** Result of a Pilot dispatch. Fail-closed returns FAILED_CLOSED. */
export interface ReaderSyncPilotDispatchResult {
  status: 'DISPATCHED' | 'FAILED_CLOSED';
  canonicalEvent: string;
  correlationId: string;
}

/** Named transition shape; ArkTS forbids inline object-literal type syntax. */
export interface ReaderSyncRuntimeTransition {
  effects: ReaderUIEffect[];
  cancelledCorrelationIds: string[];
}

/** Narrow structural view of a cancellable Core command handle for sync. */
export interface ReaderSyncCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  cancel(): boolean;
}

/**
 * Simple promise-wrapping handle for injected tests. It sets an internal flag
 * so late mock results are ignored after cancellation.
 */
export class ReaderSyncDeferredHandle implements ReaderSyncCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  private cancelled: boolean = false;

  constructor(requestId: number, result: Promise<JsonObject>) {
    this.requestId = requestId;
    this.result = result;
  }

  cancel(): boolean {
    if (this.cancelled) return false;
    this.cancelled = true;
    return true;
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }
}

/**
 * Experimental injected seam for generated Sync effects. Implementations in
 * tests are mocks; this interface is not a production Core capability claim.
 */
export interface ReaderSyncExperimentalGateway {
  beginSnapshot(params: JsonObject): ReaderSyncCommandHandle;
  beginPush(params: JsonObject): ReaderSyncCommandHandle;
  beginConflictDetect(params: JsonObject): ReaderSyncCommandHandle;
  beginConflictResolve(params: JsonObject): ReaderSyncCommandHandle;
  beginHttpExecute(params: JsonObject): ReaderSyncCommandHandle;
  beginRollback(): ReaderSyncCommandHandle;
}

/** Adapter over ReaderUIRuntime state for the disabled Sync experiment. */
export interface ReaderSyncPilotRuntimeGateway {
  currentState(): ReaderUIState;
}

/** Store-owned projection seam. Domain events bypass ReaderEffects by design. */
export interface ReaderSyncPilotHost {
  nativeState(): ReaderUiState;
  applyRuntimeState(runtimeState: ReaderUIState): void;
  applyDomainEvent(event: UiEvent): void;
}

export interface ReaderSyncPilotContext {
  correlationId: string;
  action: string;          // 'run' | 'config.test' | 'start' | 'progress' |
                            // 'complete' | 'conflict' | 'resolve'
  params: JsonObject;
  pendingStages: string[];  // remaining Core/host stages after the current one
  staleResultGuard: boolean;
  rollback: boolean;
  inFlight?: ReaderSyncCommandHandle;
  currentEffect?: string;
}

export interface ReaderSyncPilotSnapshot {
  activeCorrelationId: string;
  activeRequestId: number;
  executedEffects: number;
  ignoredLateResults: number;
  cancelledCommands: number;
}

/**
 * One executor instance is created by the Store-owned rollout coordinator.
 * It accepts at most one active correlation because ReaderUIRuntime serializes
 * sync events and returns superseded correlation ids explicitly.
 */
export class ReaderSyncEffectExecutor {
  private readonly core: ReaderSyncExperimentalGateway;
  private readonly runtime: ReaderSyncPilotRuntimeGateway;
  private readonly host: ReaderSyncPilotHost;
  private active: ReaderSyncPilotContext | null = null;
  private executedEffects: number = 0;
  private ignoredLateResults: number = 0;
  private cancelledCommands: number = 0;

  constructor(runtime: ReaderSyncPilotRuntimeGateway, host: ReaderSyncPilotHost,
    core: ReaderSyncExperimentalGateway) {
    this.runtime = runtime;
    this.host = host;
    this.core = core;
  }

  start(correlationId: string, payload: ReaderUIJSONPayload, effect: ReaderUIEffect): void {
    if (effect.correlationId !== correlationId) {
      throw new Error('sync effect correlation does not match the runtime transaction');
    }
    if (this.active !== null) {
      throw new Error(`sync executor already owns ${this.active.correlationId}`);
    }
    const context = this.createContext(correlationId, payload, effect);
    this.active = context;
    this.host.applyRuntimeState(this.runtime.currentState());
    this.execute(context, effect.type);
  }

  cancel(correlationId: string): boolean {
    const context = this.active;
    if (context === null || context.correlationId !== correlationId) return false;
    const handle = context.inFlight;
    if (handle !== undefined && handle.cancel()) {
      this.cancelledCommands += 1;
    }
    context.inFlight = undefined;
    context.currentEffect = undefined;
    this.active = null;
    return true;
  }

  hasActiveCorrelation(): boolean {
    return this.active !== null;
  }

  activeCorrelationId(): string {
    return this.active?.correlationId ?? '';
  }

  snapshot(): ReaderSyncPilotSnapshot {
    return {
      activeCorrelationId: this.active?.correlationId ?? '',
      activeRequestId: this.active?.inFlight?.requestId ?? 0,
      executedEffects: this.executedEffects,
      ignoredLateResults: this.ignoredLateResults,
      cancelledCommands: this.cancelledCommands,
    };
  }

  private createContext(correlationId: string, payload: ReaderUIJSONPayload,
    effect: ReaderUIEffect): ReaderSyncPilotContext {
    let action = '';
    if (effect.type === 'sync.conflict.resolve') action = 'resolve';
    if (effect.type === 'sync.conflict.detect') action = 'conflict';
    if (effect.type === 'sync.push') action = 'progress';
    if (effect.type === 'sync.snapshot') {
      action = payload['baseUrl'] !== undefined ? 'run' : 'start';
    }
    if (action.length === 0) throw new Error(`sync Pilot does not support ${effect.type}`);
    // Build the params for Core commands from the effect payload.
    const params: JsonObject = {};
    const keys = Object.keys(payload);
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      params[key] = payload[key];
    }
    // Determine the remaining stages after the first effect.
    // The first effect is emitted by the runtime; the executor handles
    // subsequent stages directly through the Core gateway.
    const pendingStages: string[] = [];
    const staleResultGuard: boolean = action === 'start' || action === 'conflict';
    const rollback: boolean = action === 'resolve';
    if (action === 'run') {
      // sync.run: coreSequence = ["sync.snapshot", "sync.push"]
      // The runtime emits the first effect; the executor handles the second.
      if (effect.type === 'sync.snapshot') {
        pendingStages.push('sync.push');
      }
    } else if (action === 'config.test') {
      // webdav.config.test: coreSequence = ["sync.push"], hostRequest = "http.execute"
      // The runtime emits sync.push; the executor handles http.execute.
      if (effect.type === 'sync.push') {
        pendingStages.push('http.execute');
      }
    }
    return {
      correlationId: correlationId,
      action: action,
      params: params,
      pendingStages: pendingStages,
      staleResultGuard: staleResultGuard,
      rollback: rollback,
    };
  }

  private execute(context: ReaderSyncPilotContext, stage: string): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    if (context.inFlight !== undefined) {
      throw new Error(`sync ${context.correlationId} attempted concurrent Core effect execution`);
    }
    context.currentEffect = stage;
    switch (stage) {
      case 'sync.snapshot':
        this.executeSnapshot(context);
        return;
      case 'sync.push':
        this.executePush(context);
        return;
      case 'sync.conflict.detect':
        this.executeConflictDetect(context);
        return;
      case 'sync.conflict.resolve':
        this.executeConflictResolve(context);
        return;
      case 'http.execute':
        this.executeHttpExecute(context);
        return;
      default:
        this.fail(context, stage, new Error(`unsupported sync Core effect ${stage}`));
    }
  }

  private executeSnapshot(context: ReaderSyncPilotContext): void {
    try {
      const handle = this.core.beginSnapshot(context.params);
      this.attachHandle(context, 'sync.snapshot', handle);
    } catch (error) {
      this.fail(context, 'sync.snapshot', error as Error);
    }
  }

  private executePush(context: ReaderSyncPilotContext): void {
    try {
      const handle = this.core.beginPush(context.params);
      this.attachHandle(context, 'sync.push', handle);
    } catch (error) {
      this.fail(context, 'sync.push', error as Error);
    }
  }

  private executeConflictDetect(context: ReaderSyncPilotContext): void {
    try {
      const handle = this.core.beginConflictDetect(context.params);
      this.attachHandle(context, 'sync.conflict.detect', handle);
    } catch (error) {
      this.fail(context, 'sync.conflict.detect', error as Error);
    }
  }

  private executeConflictResolve(context: ReaderSyncPilotContext): void {
    try {
      const handle = this.core.beginConflictResolve(context.params);
      this.attachHandle(context, 'sync.conflict.resolve', handle);
    } catch (error) {
      this.fail(context, 'sync.conflict.resolve', error as Error);
    }
  }

  private executeHttpExecute(context: ReaderSyncPilotContext): void {
    try {
      const handle = this.core.beginHttpExecute(context.params);
      this.attachHandle(context, 'http.execute', handle);
    } catch (error) {
      this.fail(context, 'http.execute', error as Error);
    }
  }

  private attachHandle(context: ReaderSyncPilotContext, stage: string,
    handle: ReaderSyncCommandHandle): void {
    if (!this.isActive(context)) {
      handle.cancel();
      this.ignoredLateResults += 1;
      return;
    }
    context.currentEffect = stage;
    context.inFlight = handle;
    this.executedEffects += 1;
    handle.result.then((data: JsonObject): void => {
      if (!this.isActive(context) || context.inFlight !== handle) {
        this.ignoredLateResults += 1;
        return;
      }
      context.inFlight = undefined;
      this.acceptCoreData(context, stage, data);
    }).catch((error: Error): void => {
      if (!this.isActive(context) || context.inFlight !== handle) {
        this.ignoredLateResults += 1;
        return;
      }
      context.inFlight = undefined;
      this.fail(context, stage, error);
    });
  }

  private acceptCoreData(context: ReaderSyncPilotContext, stage: string, data: JsonObject): void {
    try {
      let event = '';
      if (context.action === 'run') event = 'sync.run';
      if (context.action === 'config.test') event = 'webdav.config.test';
      if (context.action === 'start') event = 'sync.start';
      if (context.action === 'progress') event = 'sync.progress';
      if (context.action === 'complete') event = 'sync.complete';
      if (context.action === 'conflict') event = 'sync.conflict';
      if (context.action === 'resolve') event = 'sync.resolve';
      validateReaderUITypedResult(event, stage, data as Object as ReaderUIJSONResult);
      // If there are pending stages, begin the next one directly through the
      // Core gateway. The runtime only emits the first effect; the executor
      // owns the rest of the coreSequence.
      if (context.pendingStages.length > 0) {
        const nextStage = context.pendingStages[0];
        context.pendingStages = context.pendingStages.slice(1);
        this.execute(context, nextStage);
        return;
      }
      // All stages complete. Apply the domain event for the action.
      switch (context.action) {
        case 'run': {
          this.host.applyDomainEvent({
            type: 'set-error',
            error: {
              code: 'SYNC_PILOT_COMPLETE',
              message: '同步完成：快照已推送。',
              retryable: false,
            },
          });
          this.complete(context);
          return;
        }
        case 'config.test': {
          this.host.applyDomainEvent({
            type: 'webdav-test-result',
            success: true,
            message: 'WebDAV 配置测试成功。',
          });
          this.complete(context);
          return;
        }
        case 'start': {
          this.host.applyDomainEvent({
            type: 'set-error',
            error: {
              code: 'SYNC_PILOT_SNAPSHOT',
              message: '同步快照已完成。',
              retryable: false,
            },
          });
          this.complete(context);
          return;
        }
        case 'progress': {
          this.host.applyDomainEvent({
            type: 'set-error',
            error: {
              code: 'SYNC_PILOT_PROGRESS',
              message: '同步进度已推送。',
              retryable: false,
            },
          });
          this.complete(context);
          return;
        }
        case 'complete': {
          this.host.applyDomainEvent({
            type: 'set-error',
            error: {
              code: 'SYNC_PILOT_COMPLETE',
              message: '同步完成。',
              retryable: false,
            },
          });
          this.complete(context);
          return;
        }
        case 'conflict': {
          this.host.applyDomainEvent({
            type: 'set-error',
            error: {
              code: 'SYNC_PILOT_CONFLICT',
              message: '同步冲突已检测。',
              retryable: true,
            },
          });
          this.complete(context);
          return;
        }
        case 'resolve': {
          this.host.applyDomainEvent({
            type: 'set-error',
            error: {
              code: 'SYNC_PILOT_RESOLVED',
              message: '同步冲突已解决。',
              retryable: false,
            },
          });
          this.complete(context);
          return;
        }
        default:
          this.fail(context, stage, new Error(`unsupported accepted sync action ${context.action}`));
      }
    } catch (error) {
      this.fail(context, stage, error as Error);
    }
  }

  private complete(context: ReaderSyncPilotContext): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    this.active = null;
  }

  private fail(context: ReaderSyncPilotContext, stage: string, error: Error): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    const message = error.message.length > 0 ? error.message : `sync ${stage} failed`;
    // Rollback: reload Core's canonical sync state so local state does not
    // retain a pending or stale optimistic mutation after a failed write.
    // Only sync.resolve (rollback=true) and sync.run require rollback because
    // they mutate durable state.
    if (context.rollback || context.action === 'run') {
      try {
        const rollbackHandle = this.core.beginRollback();
        rollbackHandle.result.then((_data: JsonObject): void => {
          this.host.applyDomainEvent({
            type: 'set-error',
            error: {
              code: 'SYNC_PILOT_ROLLBACK',
              message: '同步已回滚到上次快照。',
              retryable: false,
            },
          });
        }).catch((_rollbackError: Error): void => {
          // Best-effort rollback; the error below is the surfaced cause.
        });
      } catch (_rollbackError) {
        // Core boundary threw on rollback; surface the original failure.
      }
    }
    this.host.applyDomainEvent({
      type: 'set-error',
      error: {
        code: 'SYNC_PILOT_FAILED',
        message: message,
        retryable: true,
      },
    });
    this.active = null;
  }

  private isActive(context: ReaderSyncPilotContext): boolean {
    return this.active !== null && this.active.correlationId === context.correlationId && this.active === context;
  }
}

/**
 * Top-level Pilot executor that dispatches each sync event to the runtime and
 * the effect executor. It is the single entry point for the coordinator's
 * dispatchSyncPilot path. Fail-closed semantics: any runtime or executor
 * failure returns FAILED_CLOSED and clears the active correlation so no
 * orphan ledger remains.
 */
export class ReaderSyncPilotExecutor {
  private readonly effectExecutor: ReaderSyncEffectExecutor;
  private correlationSequence: number = 0;

  constructor(effectExecutor: ReaderSyncEffectExecutor) {
    this.effectExecutor = effectExecutor;
  }

  /**
   * Dispatches a single sync event through the runtime + effect executor.
   * Returns DISPATCHED on success, FAILED_CLOSED on any failure.
   */
  dispatchSyncPilot(canonicalEvent: string, payload: Record<string, string>,
    runtimeDispatch: (event: string, payload: Record<string, string>, correlationId: string) =>
      ReaderSyncRuntimeTransition): ReaderSyncPilotDispatchResult {
    this.correlationSequence += 1;
    const correlationId = `harmony-sync-pilot-${this.correlationSequence}`;
    try {
      const transition = runtimeDispatch(canonicalEvent, payload, correlationId);
      for (let index = 0; index < transition.cancelledCorrelationIds.length; index += 1) {
        this.effectExecutor.cancel(transition.cancelledCorrelationIds[index]);
      }
      if (transition.effects.length !== 1) {
        throw new Error(`${canonicalEvent} must emit exactly one next Core effect, got ${transition.effects.length}`);
      }
      this.effectExecutor.start(correlationId, transition.effects[0].payload, transition.effects[0]);
      return { status: 'DISPATCHED', canonicalEvent: canonicalEvent, correlationId: correlationId };
    } catch (error) {
      // Fail-closed: cancel the executor's correlation (if any) and clear the
      // ledger so a partially admitted transaction cannot leak into the legacy
      // ReaderEffects sync path.
      if (correlationId.length > 0) {
        this.effectExecutor.cancel(correlationId);
      }
      return {
        status: 'FAILED_CLOSED',
        canonicalEvent: canonicalEvent,
        correlationId: '',
      };
    }
  }

  snapshot(): ReaderSyncPilotSnapshot {
    return this.effectExecutor.snapshot();
  }

  hasActiveCorrelation(): boolean {
    return this.effectExecutor.hasActiveCorrelation();
  }

  cancel(correlationId: string): boolean {
    return this.effectExecutor.cancel(correlationId);
  }
}

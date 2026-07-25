// Correlation-scoped executor for the opt-in Reader-UI `source.switch` Pilot.
//
// ReaderUIRuntime owns only the effect emission boundary. This file owns the
// one-to-one execution of its single next Core effect and retains the bound
// source/book context until that correlation has completed or been cancelled.
// It handles the two Core commands declared by runtime-actions.json:
//   source.switch.confirm  → source.switch.commit   (change.bookSource + shelf replacement)
//   source.switch.rollback → source.switch.rollback  (clear pending switch state)
import {
  type ReaderUIEffect,
  type ReaderUIJSONPayload,
  type ReaderUIJSONResult,
  type ReaderUIState,
  validateReaderUITypedResult,
} from 'reader_ui_runtime';
import { CoreRuntime } from '../../bridge/CoreRuntime';
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import {
  ReaderUiState,
  UiEvent,
  isLocalBookSourceId,
} from './ReaderUiState';

/** Narrow structural view of a cancellable Core command handle for source switch. */
export interface ReaderSourceSwitchCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  cancel(): boolean;
}

/**
 * Simple promise-wrapping handle. The existing CoreRuntime async methods
 * (changeBookSource, bookshelfRemove, bookshelfAdd) do not expose a cancellable
 * CoreCommandHandle; this wrapper sets an internal flag so late results are
 * ignored by the executor after cancellation.
 */
export class ReaderSourceSwitchDeferredHandle implements ReaderSourceSwitchCommandHandle {
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

/** Testable seam for exactly the Core commands used by a source switch sequence. */
export interface ReaderSourceSwitchCoreGateway {
  beginSourceSwitchCommit(bookId: string, selectedSourceId: string, options: JsonObject): ReaderSourceSwitchCommandHandle;
  beginSourceSwitchRollback(bookId: string): ReaderSourceSwitchCommandHandle;
}

/** Production gateway. It is created lazily so Shadow mode never needs Core. */
export class CoreRuntimeSourceSwitchGateway implements ReaderSourceSwitchCoreGateway {
  private nextRequestId: number = 1;

  beginSourceSwitchCommit(bookId: string, selectedSourceId: string, options: JsonObject): ReaderSourceSwitchCommandHandle {
    const runtime = CoreRuntime.get();
    // Commit chains change.bookSource → bookshelf.remove (old) → bookshelf.add (new).
    // The executor consumes the materialized candidate from change.bookSource and
    // performs the durable shelf replacement before resolving the handle.
    const keywordValue: Object = (options as Object as Record<string, Object>)['keyword'];
    const keyword: string | undefined = typeof keywordValue === 'string' && keywordValue.length > 0
      ? keywordValue : undefined;
    const commitPromise = runtime.changeBookSource(bookId, [selectedSourceId], keyword).then((data: JsonObject): Promise<JsonObject> => {
      const fields = data as Object as Record<string, Object>;
      const rawCandidates: Object = fields['candidates'];
      if (rawCandidates === null || typeof rawCandidates !== 'object' || Array.isArray(rawCandidates)) {
        throw new Error('Core change.bookSource 未返回有效 candidates');
      }
      const candidates = rawCandidates as Object as JsonObject[];
      if (!Array.isArray(candidates) || candidates.length === 0) {
        throw new Error('所选书源没有匹配到同名书籍。');
      }
      let chosen: JsonObject | null = null;
      for (let index = 0; index < candidates.length; index += 1) {
        const candidateValue = candidates[index];
        if (candidateValue === null || typeof candidateValue !== 'object' || Array.isArray(candidateValue)) continue;
        const candidate = candidateValue as Object as JsonObject;
        const candidateFields = candidate as Object as Record<string, string>;
        if (candidateFields['sourceId'] === selectedSourceId) {
          chosen = candidate;
          break;
        }
      }
      if (chosen === null) {
        // Fall back to the first candidate if no exact sourceId match.
        chosen = candidates[0] as Object as JsonObject;
      }
      const chosenFields = chosen as Object as Record<string, string>;
      const newBookId: string = chosenFields['bookUrl'] ?? chosenFields['bookId'] ?? '';
      if (newBookId.length === 0) {
        throw new Error('Core 换源候选缺少 bookUrl/bookId。');
      }
      const previousSourceId: string = (options as Object as Record<string, string>)['previousSourceId'] ?? '';
      const previousBookId: string = (options as Object as Record<string, string>)['previousBookId'] ?? bookId;
      // Remove the old shelf entry first so the replacement cannot leave a
      // duplicate when the new source differs only in bookId.
      const removeChain: Promise<JsonObject> = previousSourceId.length === 0
        ? Promise.resolve({} as JsonObject)
        : runtime.bookshelfRemove(previousSourceId, previousBookId);
      return removeChain.then((): Promise<JsonObject> => {
        const newBook: JsonObject = {};
        newBook['sourceId'] = selectedSourceId;
        newBook['bookId'] = newBookId;
        newBook['title'] = chosenFields['bookName'] ?? chosenFields['title'] ?? '';
        newBook['author'] = chosenFields['author'] ?? '';
        const coverValue: string = chosenFields['coverUrl'] ?? '';
        if (coverValue.length > 0) newBook['coverUrl'] = coverValue;
        const introValue: string = chosenFields['intro'] ?? '';
        if (introValue.length > 0) newBook['intro'] = introValue;
        const lastChapterValue: string = chosenFields['lastChapter'] ?? '';
        if (lastChapterValue.length > 0) newBook['lastChapter'] = lastChapterValue;
        return runtime.bookshelfAdd(newBook).then((): JsonObject => data);
      });
    });
    const handle = new ReaderSourceSwitchDeferredHandle(this.nextRequestId, commitPromise);
    this.nextRequestId += 1;
    return handle;
  }

  beginSourceSwitchRollback(_bookId: string): ReaderSourceSwitchCommandHandle {
    // Rollback is a host-side state clear; no Core command is required. Return
    // a resolved handle so the executor follows the same completion path.
    const handle = new ReaderSourceSwitchDeferredHandle(
      this.nextRequestId,
      Promise.resolve({} as JsonObject),
    );
    this.nextRequestId += 1;
    return handle;
  }
}

/** Adapter over ReaderUIRuntime's state observation. The source switch Pilot
  * uses emitEffects which has no acceptResult callback, so the runtime gateway
  * only reads state for the host projection. */
export interface ReaderSourceSwitchRuntimeGateway {
  currentState(): ReaderUIState;
}

/** Store-owned projection seam. Domain events bypass ReaderEffects by design. */
export interface ReaderSourceSwitchPilotHost {
  nativeState(): ReaderUiState;
  applyRuntimeState(runtimeState: ReaderUIState): void;
  applyDomainEvent(event: UiEvent): void;
}

export interface ReaderSourceSwitchPilotContext {
  correlationId: string;
  bookId: string;
  selectedSourceId: string;
  previousSourceId: string;
  previousBookId: string;
  keyword: string;
  inFlight?: ReaderSourceSwitchCommandHandle;
  currentEffect?: string;
}

export interface ReaderSourceSwitchPilotSnapshot {
  activeCorrelationId: string;
  activeRequestId: number;
  executedEffects: number;
  ignoredLateResults: number;
  cancelledCommands: number;
}

/**
 * One executor instance is created by the Store-owned rollout coordinator.
 * It accepts at most one active correlation because ReaderUIRuntime serializes
 * source.switch.confirm/rollback and returns superseded correlation ids
 * explicitly.
 */
export class ReaderSourceSwitchEffectExecutor {
  private readonly core: ReaderSourceSwitchCoreGateway;
  private readonly runtime: ReaderSourceSwitchRuntimeGateway;
  private readonly host: ReaderSourceSwitchPilotHost;
  private active: ReaderSourceSwitchPilotContext | null = null;
  private executedEffects: number = 0;
  private ignoredLateResults: number = 0;
  private cancelledCommands: number = 0;

  constructor(runtime: ReaderSourceSwitchRuntimeGateway, host: ReaderSourceSwitchPilotHost,
    core: ReaderSourceSwitchCoreGateway = new CoreRuntimeSourceSwitchGateway()) {
    this.runtime = runtime;
    this.host = host;
    this.core = core;
  }

  start(correlationId: string, payload: ReaderUIJSONPayload, effect: ReaderUIEffect): void {
    if (effect.correlationId !== correlationId) {
      throw new Error('source.switch effect correlation does not match the runtime transaction');
    }
    if (this.active !== null) {
      throw new Error(`source.switch executor already owns ${this.active.correlationId}`);
    }
    const context = this.createContext(correlationId, payload, effect.type);
    this.active = context;
    this.host.applyRuntimeState(this.runtime.currentState());
    this.execute(context, effect);
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

  snapshot(): ReaderSourceSwitchPilotSnapshot {
    return {
      activeCorrelationId: this.active?.correlationId ?? '',
      activeRequestId: this.active?.inFlight?.requestId ?? 0,
      executedEffects: this.executedEffects,
      ignoredLateResults: this.ignoredLateResults,
      cancelledCommands: this.cancelledCommands,
    };
  }

  private createContext(correlationId: string, payload: ReaderUIJSONPayload,
    effectType: string): ReaderSourceSwitchPilotContext {
    const from = this.payloadObject(payload, 'from');
    const target = this.payloadObject(payload, 'target');
    const rollbackToken = this.payloadObject(payload, 'rollbackToken');
    const oldBook = rollbackToken === undefined ? undefined : this.payloadObject(rollbackToken, 'oldBook');
    const bookId = effectType === 'source.switch.rollback'
      ? this.payloadString(oldBook ?? {}, 'bookId') : this.payloadString(from ?? {}, 'bookId');
    const selectedSourceId = this.payloadString(target ?? {}, 'sourceId');
    const previousSourceId = this.payloadString(from ?? oldBook ?? {}, 'sourceId');
    const previousBookId = this.payloadString(from ?? oldBook ?? {}, 'bookId', bookId);
    const keyword = this.payloadString(target ?? {}, 'title');
    if (bookId.length === 0) {
      throw new Error('source.switch Pilot requires non-empty bookId');
    }
    if (isLocalBookSourceId(previousSourceId)) {
      throw new Error('source.switch Pilot cannot replace a local book source');
    }
    if (effectType === 'source.switch.commit' &&
      selectedSourceId.length === 0) {
      throw new Error('source.switch Pilot requires non-empty selectedSourceId');
    }
    return {
      correlationId: correlationId,
      bookId: bookId,
      selectedSourceId: selectedSourceId,
      previousSourceId: previousSourceId,
      previousBookId: previousBookId,
      keyword: keyword,
    };
  }

  private payloadString(payload: ReaderUIJSONPayload, key: string,
    defaultValue: string = ''): string {
    const value = payload[key];
    return typeof value === 'string' ? value : defaultValue;
  }

  private payloadObject(payload: ReaderUIJSONPayload, key: string): ReaderUIJSONPayload | undefined {
    const value = payload[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Object as ReaderUIJSONPayload;
    }
    return undefined;
  }

  private execute(context: ReaderSourceSwitchPilotContext, effect: ReaderUIEffect): void {
    if (!this.isActive(context) || effect.correlationId !== context.correlationId) {
      this.ignoredLateResults += 1;
      return;
    }
    if (context.inFlight !== undefined) {
      throw new Error(`source.switch ${context.correlationId} attempted concurrent Core effect execution`);
    }
    context.currentEffect = effect.type;
    switch (effect.type) {
      case 'source.switch.commit':
        this.executeCommit(context);
        return;
      case 'source.switch.rollback':
        this.executeRollback(context);
        return;
      default:
        this.fail(context, effect.type, new Error(`unsupported source.switch Core effect ${effect.type}`));
    }
  }

  private executeCommit(context: ReaderSourceSwitchPilotContext): void {
    try {
      const options: JsonObject = {};
      options['previousSourceId'] = context.previousSourceId;
      options['previousBookId'] = context.previousBookId;
      if (context.keyword.length > 0) options['keyword'] = context.keyword;
      const handle = this.core.beginSourceSwitchCommit(context.bookId, context.selectedSourceId, options);
      this.attachHandle(context, 'source.switch.commit', handle);
    } catch (error) {
      this.fail(context, 'source.switch.commit', error as Error);
    }
  }

  private executeRollback(context: ReaderSourceSwitchPilotContext): void {
    try {
      const handle = this.core.beginSourceSwitchRollback(context.bookId);
      this.attachHandle(context, 'source.switch.rollback', handle);
    } catch (error) {
      this.fail(context, 'source.switch.rollback', error as Error);
    }
  }

  private attachHandle(context: ReaderSourceSwitchPilotContext, stage: string,
    handle: ReaderSourceSwitchCommandHandle): void {
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

  private acceptCoreData(context: ReaderSourceSwitchPilotContext, stage: string, data: JsonObject): void {
    try {
      validateReaderUITypedResult(
        stage === 'source.switch.commit' ? 'source.switch.confirm' : 'source.switch.rollback',
        stage,
        data as Object as ReaderUIJSONResult,
      );
      switch (stage) {
        case 'source.switch.commit': {
          this.host.applyDomainEvent({ type: 'source-switch-completed' });
          this.complete(context);
          return;
        }
        case 'source.switch.rollback': {
          this.host.applyDomainEvent({
            type: 'set-error',
            error: {
              code: 'SOURCE_SWITCH_CANCELLED',
              message: '换源已取消。',
              retryable: false,
            },
          });
          this.complete(context);
          return;
        }
        default:
          this.fail(context, stage, new Error(`unsupported accepted source.switch stage ${stage}`));
      }
    } catch (error) {
      this.fail(context, stage, error as Error);
    }
  }

  private complete(context: ReaderSourceSwitchPilotContext): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    this.active = null;
  }

  private fail(context: ReaderSourceSwitchPilotContext, stage: string, error: Error): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    const message = error.message.length > 0 ? error.message : `source.switch ${stage} failed`;
    this.host.applyDomainEvent({
      type: 'source-switch-failed',
      message: message,
    });
    this.active = null;
  }

  private isActive(context: ReaderSourceSwitchPilotContext): boolean {
    return this.active !== null && this.active.correlationId === context.correlationId && this.active === context;
  }
}

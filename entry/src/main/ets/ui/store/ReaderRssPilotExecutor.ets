// Correlation-scoped executor for the opt-in Reader-UI `rss` Pilot (H4-G).
//
// ReaderUIRuntime owns only the effect emission boundary. This file owns the
// one-to-one execution of its single next Core effect and retains the bound
// RSS context until that correlation has completed or been cancelled. It
// handles the seven Core commands declared by runtime-actions.json:
//   rss.refresh             → rss.feed.refresh        (rss.subscription.refresh per source)
//   rss.subscription.add    → rss.subscription.persist (rss.subscription.add)
//   rss.subscription.delete → rss.subscription.remove  (rss.subscription.delete)
//   rss.subscription.edit   → rss.subscription.persist (rss.subscription.update)
//   rss.entry.open          → rss.entry.read           (rss.item.read)
//   rss.favorite.add        → rss.favorite.persist     (rss.favorite.add)
//   rss.favorite.remove     → rss.favorite.remove      (rss.favorite.remove)
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
} from './ReaderUiState';

/** Rollout mode for the RSS Pilot. SHADOW observes only; PILOT owns effects. */
export enum ReaderRssPilotMode {
  SHADOW = 0,
  PILOT = 1,
}

/** Result of a Pilot dispatch. Fail-closed returns FAILED_CLOSED. */
export interface ReaderRssPilotDispatchResult {
  status: 'DISPATCHED' | 'FAILED_CLOSED';
  canonicalEvent: string;
  correlationId: string;
}

/** Named transition shape; ArkTS forbids inline object-literal type syntax. */
export interface ReaderRssRuntimeTransition {
  effects: ReaderUIEffect[];
  cancelledCorrelationIds: string[];
}

/** Narrow structural view of a cancellable Core command handle for RSS. */
export interface ReaderRssCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  cancel(): boolean;
}

/**
 * Simple promise-wrapping handle. The existing CoreRuntime async methods
 * (executeCoreMethod) do not expose a cancellable CoreCommandHandle; this
 * wrapper sets an internal flag so late results are ignored by the executor
 * after cancellation.
 */
export class ReaderRssDeferredHandle implements ReaderRssCommandHandle {
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

/** Testable seam for exactly the Core commands used by an RSS sequence. */
export interface ReaderRssPilotEffectExecutor {
  beginFeedRefresh(subscriptionId: string): ReaderRssCommandHandle;
  beginSubscriptionPersist(action: string, params: JsonObject): ReaderRssCommandHandle;
  beginSubscriptionRemove(subscriptionId: string): ReaderRssCommandHandle;
  beginEntryRead(guid: string, subscriptionId: string): ReaderRssCommandHandle;
  beginFavoritePersist(guid: string, subscriptionId: string, title: string, link: string): ReaderRssCommandHandle;
  beginFavoriteRemove(guid: string, subscriptionId: string): ReaderRssCommandHandle;
  beginRollback(): ReaderRssCommandHandle;
}

/** Production gateway. It is created lazily so Shadow mode never needs Core. */
export class CoreRuntimeRssGateway implements ReaderRssPilotEffectExecutor {
  private nextRequestId: number = 1;

  beginFeedRefresh(subscriptionId: string): ReaderRssCommandHandle {
    const runtime = CoreRuntime.get();
    const params: JsonObject = {};
    params['subscriptionId'] = subscriptionId;
    params['evaluatedAt'] = 0;
    const handle = new ReaderRssDeferredHandle(
      this.nextRequestId,
      runtime.executeCoreMethod('rss.subscription.refresh', params, 20000),
    );
    this.nextRequestId += 1;
    return handle;
  }

  beginSubscriptionPersist(action: string, params: JsonObject): ReaderRssCommandHandle {
    const runtime = CoreRuntime.get();
    const method = action === 'add' ? 'rss.subscription.add' : 'rss.subscription.update';
    const handle = new ReaderRssDeferredHandle(
      this.nextRequestId,
      runtime.executeCoreMethod(method, params, 5000),
    );
    this.nextRequestId += 1;
    return handle;
  }

  beginSubscriptionRemove(subscriptionId: string): ReaderRssCommandHandle {
    const runtime = CoreRuntime.get();
    const params: JsonObject = {};
    params['subscriptionId'] = subscriptionId;
    const handle = new ReaderRssDeferredHandle(
      this.nextRequestId,
      runtime.executeCoreMethod('rss.subscription.delete', params, 5000),
    );
    this.nextRequestId += 1;
    return handle;
  }

  beginEntryRead(guid: string, subscriptionId: string): ReaderRssCommandHandle {
    const runtime = CoreRuntime.get();
    const params: JsonObject = {};
    params['guid'] = guid;
    params['read'] = true;
    params['subscriptionId'] = subscriptionId;
    const handle = new ReaderRssDeferredHandle(
      this.nextRequestId,
      runtime.executeCoreMethod('rss.item.read', params, 5000),
    );
    this.nextRequestId += 1;
    return handle;
  }

  beginFavoritePersist(guid: string, subscriptionId: string, title: string, link: string): ReaderRssCommandHandle {
    const runtime = CoreRuntime.get();
    const params: JsonObject = {};
    params['guid'] = guid;
    params['subscriptionId'] = subscriptionId;
    if (title.length > 0) params['title'] = title;
    if (link.length > 0) params['link'] = link;
    const handle = new ReaderRssDeferredHandle(
      this.nextRequestId,
      runtime.executeCoreMethod('rss.favorite.add', params, 5000),
    );
    this.nextRequestId += 1;
    return handle;
  }

  beginFavoriteRemove(guid: string, subscriptionId: string): ReaderRssCommandHandle {
    const runtime = CoreRuntime.get();
    const params: JsonObject = {};
    params['guid'] = guid;
    params['subscriptionId'] = subscriptionId;
    const handle = new ReaderRssDeferredHandle(
      this.nextRequestId,
      runtime.executeCoreMethod('rss.favorite.remove', params, 5000),
    );
    this.nextRequestId += 1;
    return handle;
  }

  beginRollback(): ReaderRssCommandHandle {
    // Rollback reloads Core's canonical RSS subscription list to restore
    // local state after a failed write. No Core undo command exists; the
    // list refresh is the authoritative restore.
    const runtime = CoreRuntime.get();
    const handle = new ReaderRssDeferredHandle(
      this.nextRequestId,
      runtime.executeCoreMethod('rss.subscription.list', {}, 5000),
    );
    this.nextRequestId += 1;
    return handle;
  }
}

/** Adapter over ReaderUIRuntime's state observation. The RSS Pilot uses
  * emitEffects which has no acceptResult callback, so the runtime gateway
  * only reads state for the host projection. */
export interface ReaderRssPilotRuntimeGateway {
  currentState(): ReaderUIState;
}

/** Store-owned projection seam. Domain events bypass ReaderEffects by design. */
export interface ReaderRssPilotHost {
  nativeState(): ReaderUiState;
  applyRuntimeState(runtimeState: ReaderUIState): void;
  applyDomainEvent(event: UiEvent): void;
}

export interface ReaderRssPilotContext {
  correlationId: string;
  action: string;          // 'refresh' | 'subscription.add' | 'subscription.delete' |
                            // 'subscription.edit' | 'entry.open' | 'favorite.add' | 'favorite.remove'
  subscriptionId: string;
  guid: string;
  title: string;
  link: string;
  persistParams: JsonObject;
  inFlight?: ReaderRssCommandHandle;
  currentEffect?: string;
}

export interface ReaderRssPilotSnapshot {
  activeCorrelationId: string;
  activeRequestId: number;
  executedEffects: number;
  ignoredLateResults: number;
  cancelledCommands: number;
}

/**
 * One executor instance is created by the Store-owned rollout coordinator.
 * It accepts at most one active correlation because ReaderUIRuntime serializes
 * RSS events and returns superseded correlation ids explicitly.
 */
export class ReaderRssEffectExecutor {
  private readonly core: ReaderRssPilotEffectExecutor;
  private readonly runtime: ReaderRssPilotRuntimeGateway;
  private readonly host: ReaderRssPilotHost;
  private active: ReaderRssPilotContext | null = null;
  private executedEffects: number = 0;
  private ignoredLateResults: number = 0;
  private cancelledCommands: number = 0;

  constructor(runtime: ReaderRssPilotRuntimeGateway, host: ReaderRssPilotHost,
    core: ReaderRssPilotEffectExecutor = new CoreRuntimeRssGateway()) {
    this.runtime = runtime;
    this.host = host;
    this.core = core;
  }

  start(correlationId: string, payload: ReaderUIJSONPayload, effect: ReaderUIEffect): void {
    if (effect.correlationId !== correlationId) {
      throw new Error('rss effect correlation does not match the runtime transaction');
    }
    if (this.active !== null) {
      throw new Error(`rss executor already owns ${this.active.correlationId}`);
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

  snapshot(): ReaderRssPilotSnapshot {
    return {
      activeCorrelationId: this.active?.correlationId ?? '',
      activeRequestId: this.active?.inFlight?.requestId ?? 0,
      executedEffects: this.executedEffects,
      ignoredLateResults: this.ignoredLateResults,
      cancelledCommands: this.cancelledCommands,
    };
  }

  private createContext(correlationId: string, payload: ReaderUIJSONPayload,
    effectType: string): ReaderRssPilotContext {
    const operation = this.payloadString(payload, 'operation');
    const params = this.payloadObject(payload, 'params') ?? payload;
    let action = '';
    if (effectType === 'rss.feed.refresh') action = 'refresh';
    if (effectType === 'rss.subscription.persist') {
      action = operation === 'update' ? 'subscription.edit' : 'subscription.add';
    }
    if (effectType === 'rss.subscription.remove') action = 'subscription.delete';
    if (effectType === 'rss.entry.read') action = 'entry.open';
    if (effectType === 'rss.favorite.persist') action = 'favorite.add';
    if (effectType === 'rss.favorite.remove') action = 'favorite.remove';
    const subscriptionId = this.payloadString(params, 'subscriptionId');
    const guid = this.payloadString(params, 'guid');
    const title = this.payloadString(params, 'title');
    const link = this.payloadString(params, 'link');
    if (action.length === 0) {
      throw new Error('rss Pilot requires non-empty action');
    }
    // Validate per-action required fields.
    if (action === 'subscription.add') {
      const feedUrl = this.payloadString(params, 'feedUrl');
      if (feedUrl.length === 0) {
        throw new Error('rss.subscription.add Pilot requires non-empty feedUrl');
      }
    }
    if (action === 'subscription.delete' || action === 'subscription.edit') {
      if (subscriptionId.length === 0) {
        throw new Error(`rss.${action} Pilot requires non-empty subscriptionId`);
      }
    }
    if (action === 'entry.open') {
      if (guid.length === 0 || subscriptionId.length === 0) {
        throw new Error('rss.entry.open Pilot requires non-empty guid and subscriptionId');
      }
    }
    if (action === 'favorite.add' || action === 'favorite.remove') {
      if (guid.length === 0 || subscriptionId.length === 0) {
        throw new Error(`rss.${action} Pilot requires non-empty guid and subscriptionId`);
      }
    }
    // Build the persist params for subscription.add / subscription.edit.
    const persistParams: JsonObject = {};
    if (action === 'subscription.add' || action === 'subscription.edit') {
      if (subscriptionId.length > 0) persistParams['subscriptionId'] = subscriptionId;
      const feedUrl = this.payloadString(params, 'feedUrl');
      if (feedUrl.length > 0) persistParams['feedUrl'] = feedUrl;
      if (title.length > 0) persistParams['title'] = title;
      const enabledValue = params['enabled'];
      if (typeof enabledValue === 'boolean') persistParams['enabled'] = enabledValue;
    }
    return {
      correlationId: correlationId,
      action: action,
      subscriptionId: subscriptionId,
      guid: guid,
      title: title,
      link: link,
      persistParams: persistParams,
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

  private execute(context: ReaderRssPilotContext, effect: ReaderUIEffect): void {
    if (!this.isActive(context) || effect.correlationId !== context.correlationId) {
      this.ignoredLateResults += 1;
      return;
    }
    if (context.inFlight !== undefined) {
      throw new Error(`rss ${context.correlationId} attempted concurrent Core effect execution`);
    }
    context.currentEffect = effect.type;
    switch (effect.type) {
      case 'rss.feed.refresh':
        this.executeFeedRefresh(context);
        return;
      case 'rss.subscription.persist':
        this.executeSubscriptionPersist(context);
        return;
      case 'rss.subscription.remove':
        this.executeSubscriptionRemove(context);
        return;
      case 'rss.entry.read':
        this.executeEntryRead(context);
        return;
      case 'rss.favorite.persist':
        this.executeFavoritePersist(context);
        return;
      case 'rss.favorite.remove':
        this.executeFavoriteRemove(context);
        return;
      default:
        this.fail(context, effect.type, new Error(`unsupported rss Core effect ${effect.type}`));
    }
  }

  private executeFeedRefresh(context: ReaderRssPilotContext): void {
    try {
      const handle = this.core.beginFeedRefresh(context.subscriptionId);
      this.attachHandle(context, 'rss.feed.refresh', handle);
    } catch (error) {
      this.fail(context, 'rss.feed.refresh', error as Error);
    }
  }

  private executeSubscriptionPersist(context: ReaderRssPilotContext): void {
    try {
      const action = context.action === 'subscription.add' ? 'add' : 'edit';
      const handle = this.core.beginSubscriptionPersist(action, context.persistParams);
      this.attachHandle(context, 'rss.subscription.persist', handle);
    } catch (error) {
      this.fail(context, 'rss.subscription.persist', error as Error);
    }
  }

  private executeSubscriptionRemove(context: ReaderRssPilotContext): void {
    try {
      const handle = this.core.beginSubscriptionRemove(context.subscriptionId);
      this.attachHandle(context, 'rss.subscription.remove', handle);
    } catch (error) {
      this.fail(context, 'rss.subscription.remove', error as Error);
    }
  }

  private executeEntryRead(context: ReaderRssPilotContext): void {
    try {
      const handle = this.core.beginEntryRead(context.guid, context.subscriptionId);
      this.attachHandle(context, 'rss.entry.read', handle);
    } catch (error) {
      this.fail(context, 'rss.entry.read', error as Error);
    }
  }

  private executeFavoritePersist(context: ReaderRssPilotContext): void {
    try {
      const handle = this.core.beginFavoritePersist(
        context.guid, context.subscriptionId, context.title, context.link,
      );
      this.attachHandle(context, 'rss.favorite.persist', handle);
    } catch (error) {
      this.fail(context, 'rss.favorite.persist', error as Error);
    }
  }

  private executeFavoriteRemove(context: ReaderRssPilotContext): void {
    try {
      const handle = this.core.beginFavoriteRemove(context.guid, context.subscriptionId);
      this.attachHandle(context, 'rss.favorite.remove', handle);
    } catch (error) {
      this.fail(context, 'rss.favorite.remove', error as Error);
    }
  }

  private attachHandle(context: ReaderRssPilotContext, stage: string,
    handle: ReaderRssCommandHandle): void {
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

  private acceptCoreData(context: ReaderRssPilotContext, stage: string, data: JsonObject): void {
    try {
      let event = '';
      if (stage === 'rss.feed.refresh') event = 'rss.refresh';
      if (stage === 'rss.subscription.persist') {
        event = context.action === 'subscription.edit' ? 'rss.subscription.edit' : 'rss.subscription.add';
      }
      if (stage === 'rss.subscription.remove') event = 'rss.subscription.delete';
      if (stage === 'rss.entry.read') event = 'rss.entry.open';
      if (stage === 'rss.favorite.persist') event = 'rss.favorite.add';
      if (stage === 'rss.favorite.remove') event = 'rss.favorite.remove';
      validateReaderUITypedResult(event, stage, data as Object as ReaderUIJSONResult);
      switch (stage) {
        case 'rss.feed.refresh': {
          this.host.applyDomainEvent({
            type: 'rss-refresh-success',
            rssRefreshMessage: 'RSS 刷新完成，已重新读取 Core 缓存。',
          });
          this.complete(context);
          return;
        }
        case 'rss.subscription.persist': {
          // Persist completes; the host reloads the canonical list via the
          // rss-data-loaded event emitted by the Store's reload path.
          this.host.applyDomainEvent({ type: 'rss-subscription-persisted' });
          this.complete(context);
          return;
        }
        case 'rss.subscription.remove': {
          this.host.applyDomainEvent({ type: 'rss-subscription-delete-complete' });
          this.complete(context);
          return;
        }
        case 'rss.entry.read': {
          this.host.applyDomainEvent({
            type: 'rss-item-read-confirmed',
            rssGuid: context.guid,
            rssSubscriptionId: context.subscriptionId,
          });
          this.complete(context);
          return;
        }
        case 'rss.favorite.persist': {
          this.host.applyDomainEvent({ type: 'rss-favorite-persisted' });
          this.complete(context);
          return;
        }
        case 'rss.favorite.remove': {
          this.host.applyDomainEvent({ type: 'rss-favorite-removed' });
          this.complete(context);
          return;
        }
        default:
          this.fail(context, stage, new Error(`unsupported accepted rss stage ${stage}`));
      }
    } catch (error) {
      this.fail(context, stage, error as Error);
    }
  }

  private complete(context: ReaderRssPilotContext): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    this.active = null;
  }

  private fail(context: ReaderRssPilotContext, stage: string, error: Error): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    const message = error.message.length > 0 ? error.message : `rss ${stage} failed`;
    // Rollback: reload Core's canonical list so local state does not retain a
    // pending id or a stale optimistic mutation after a failed write. Only
    // subscription.add / subscription.delete / subscription.edit require
    // rollback because they mutate durable state.
    if (context.action === 'subscription.add' || context.action === 'subscription.delete' ||
      context.action === 'subscription.edit') {
      try {
        const rollbackHandle = this.core.beginRollback();
        rollbackHandle.result.then((_data: JsonObject): void => {
          this.host.applyDomainEvent({ type: 'rss-load' });
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
        code: 'RSS_PILOT_FAILED',
        message: message,
        retryable: true,
      },
    });
    this.active = null;
  }

  private isActive(context: ReaderRssPilotContext): boolean {
    return this.active !== null && this.active.correlationId === context.correlationId && this.active === context;
  }
}

/**
 * Top-level Pilot executor that dispatches each RSS event to the runtime and
 * the effect executor. It is the single entry point for the coordinator's
 * dispatchRssPilot path. Fail-closed semantics: any runtime or executor
 * failure returns FAILED_CLOSED and clears the active correlation so no
 * orphan ledger remains.
 */
export class ReaderRssPilotExecutor {
  private readonly effectExecutor: ReaderRssEffectExecutor;
  private correlationSequence: number = 0;

  constructor(effectExecutor: ReaderRssEffectExecutor) {
    this.effectExecutor = effectExecutor;
  }

  /**
   * Dispatches a single RSS event through the runtime + effect executor.
   * Returns DISPATCHED on success, FAILED_CLOSED on any failure.
   */
  dispatchRssPilot(canonicalEvent: string, payload: Record<string, string>,
    runtimeDispatch: (event: string, payload: Record<string, string>, correlationId: string) =>
      ReaderRssRuntimeTransition): ReaderRssPilotDispatchResult {
    this.correlationSequence += 1;
    const correlationId = `harmony-rss-pilot-${this.correlationSequence}`;
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
      // ReaderEffects RSS path.
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

  snapshot(): ReaderRssPilotSnapshot {
    return this.effectExecutor.snapshot();
  }

  hasActiveCorrelation(): boolean {
    return this.effectExecutor.hasActiveCorrelation();
  }

  cancel(correlationId: string): boolean {
    return this.effectExecutor.cancel(correlationId);
  }
}

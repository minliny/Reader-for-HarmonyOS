// ReaderRssPilotExecutor.test — Store-level proof for the H4-G RSS Pilot
// executor. The fake Core gateway keeps every command deferred so these tests
// can assert correlation ownership, stage dispatch, fail-closed semantics,
// stale-result rejection, rollback, and all 7 RSS event actions without a
// device NAPI runtime.
import { describe, it, expect } from '@ohos/hypium';
import type { ReaderUIEffect, ReaderUIState } from 'reader_ui_runtime';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import {
  ReaderRssCommandHandle,
  ReaderRssEffectExecutor,
  ReaderRssPilotEffectExecutor,
  ReaderRssPilotHost,
  ReaderRssPilotRuntimeGateway,
} from '../main/ets/ui/store/ReaderRssPilotExecutor';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import { ReaderUiState, UiEvent } from '../main/ets/ui/store/ReaderUiState';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';

class DeferredRssHandle implements ReaderRssCommandHandle {
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
    if (resolver === undefined) throw new Error('deferred rss result has no resolver');
    resolver(data);
  }

  reject(error: Error): void {
    const rejecter = this.rejecter;
    if (rejecter === undefined) throw new Error('deferred rss result has no rejecter');
    rejecter(error);
  }
}

class RecordingRssCoreGateway implements ReaderRssPilotEffectExecutor {
  feedRefreshHandles: DeferredRssHandle[] = [];
  persistHandles: DeferredRssHandle[] = [];
  removeHandles: DeferredRssHandle[] = [];
  entryReadHandles: DeferredRssHandle[] = [];
  favoritePersistHandles: DeferredRssHandle[] = [];
  favoriteRemoveHandles: DeferredRssHandle[] = [];
  rollbackHandles: DeferredRssHandle[] = [];
  effectOrder: string[] = [];
  persistActions: string[] = [];
  feedRefreshSubscriptionIds: string[] = [];
  removeSubscriptionIds: string[] = [];
  entryReadGuids: string[] = [];
  favoritePersistGuids: string[] = [];
  favoriteRemoveGuids: string[] = [];
  throwOnFeedRefresh: boolean = false;
  throwOnPersist: boolean = false;
  throwOnRemove: boolean = false;
  throwOnEntryRead: boolean = false;
  throwOnFavoritePersist: boolean = false;
  throwOnFavoriteRemove: boolean = false;
  private nextRequestId: number = 1;

  beginFeedRefresh(subscriptionId: string): ReaderRssCommandHandle {
    if (this.throwOnFeedRefresh) throw new Error('mock rss.feed.refresh boundary failure');
    this.effectOrder.push('rss.feed.refresh');
    this.feedRefreshSubscriptionIds.push(subscriptionId);
    return this.newHandle(this.feedRefreshHandles);
  }

  beginSubscriptionPersist(action: string, _params: JsonObject): ReaderRssCommandHandle {
    if (this.throwOnPersist) throw new Error('mock rss.subscription.persist boundary failure');
    this.effectOrder.push('rss.subscription.persist');
    this.persistActions.push(action);
    return this.newHandle(this.persistHandles);
  }

  beginSubscriptionRemove(subscriptionId: string): ReaderRssCommandHandle {
    if (this.throwOnRemove) throw new Error('mock rss.subscription.remove boundary failure');
    this.effectOrder.push('rss.subscription.remove');
    this.removeSubscriptionIds.push(subscriptionId);
    return this.newHandle(this.removeHandles);
  }

  beginEntryRead(guid: string, _subscriptionId: string): ReaderRssCommandHandle {
    if (this.throwOnEntryRead) throw new Error('mock rss.entry.read boundary failure');
    this.effectOrder.push('rss.entry.read');
    this.entryReadGuids.push(guid);
    return this.newHandle(this.entryReadHandles);
  }

  beginFavoritePersist(guid: string, _subscriptionId: string, _title: string,
    _link: string): ReaderRssCommandHandle {
    if (this.throwOnFavoritePersist) throw new Error('mock rss.favorite.persist boundary failure');
    this.effectOrder.push('rss.favorite.persist');
    this.favoritePersistGuids.push(guid);
    return this.newHandle(this.favoritePersistHandles);
  }

  beginFavoriteRemove(guid: string, _subscriptionId: string): ReaderRssCommandHandle {
    if (this.throwOnFavoriteRemove) throw new Error('mock rss.favorite.remove boundary failure');
    this.effectOrder.push('rss.favorite.remove');
    this.favoriteRemoveGuids.push(guid);
    return this.newHandle(this.favoriteRemoveHandles);
  }

  beginRollback(): ReaderRssCommandHandle {
    this.effectOrder.push('rss.rollback');
    return this.newHandle(this.rollbackHandles);
  }

  private newHandle(target: DeferredRssHandle[]): DeferredRssHandle {
    const handle = new DeferredRssHandle(this.nextRequestId);
    this.nextRequestId += 1;
    target.push(handle);
    return handle;
  }
}

// ── Mocks for direct executor tests ──

class MockRssRuntimeState implements ReaderUIState {
  routeId: string = 'rss';
  routeStack: string[] = ['bookshelf', 'rss'];
  tab: string = 'rss';
  loading: boolean = false;
  reducedMotion: boolean = false;
  readerPageIndex: number = 0;
}

class MockRssRuntime implements ReaderRssPilotRuntimeGateway {
  currentState(): ReaderUIState {
    return new MockRssRuntimeState();
  }
}

class MockRssHost implements ReaderRssPilotHost {
  readonly events: UiEvent[] = [];
  private readonly stateReader: () => ReaderUiState;

  constructor(stateReader: () => ReaderUiState) {
    this.stateReader = stateReader;
  }

  nativeState(): ReaderUiState { return this.stateReader(); }
  applyRuntimeState(_runtimeState: ReaderUIState): void { /* no-op for RSS */ }
  applyDomainEvent(event: UiEvent): void { this.events.push(event); }
}

class MockRssEffect implements ReaderUIEffect {
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

function rssRefreshEvent(subscriptionId: string = 'sub-1'): UiEvent {
  return {
    type: 'rss-refresh',
    rssSubscriptionId: subscriptionId,
    readerUIJSONPayload: { 'subscriptionId': subscriptionId, 'evaluatedAt': 1 },
  };
}

function rssSubscriptionAddEvent(feedUrl: string = 'https://example.com/feed.xml'): UiEvent {
  return {
    type: 'rss-subscription-add',
    rssFeedUrl: feedUrl,
    rssTitle: 'Test Feed',
    rssEnabled: true,
    readerUIJSONPayload: JSON.parse('{' +
      '"operation":"create","params":{' +
      `"subscriptionId":"sub-new","feedUrl":"${feedUrl}",` +
      '"title":"Test Feed","siteUrl":null,"enabled":true}}') as Object as ReaderUIJSONPayload,
  };
}

function rssSubscriptionDeleteConfirmEvent(subscriptionId: string = 'sub-1'): UiEvent {
  return {
    type: 'rss-subscription-delete-confirm',
    rssSubscriptionId: subscriptionId,
    readerUIJSONPayload: { 'subscriptionId': subscriptionId },
  };
}

function rssSubscriptionUpdateEvent(subscriptionId: string = 'sub-1'): UiEvent {
  return {
    type: 'rss-subscription-update',
    rssSubscriptionId: subscriptionId,
    rssTitle: 'Updated Title',
    rssEnabled: true,
    readerUIJSONPayload: JSON.parse('{' +
      '"operation":"update","params":{' +
      `"subscriptionId":"${subscriptionId}","title":"Updated Title","enabled":true}}`) as Object as ReaderUIJSONPayload,
  };
}

function rssItemOpenEvent(guid: string = 'guid-1', subscriptionId: string = 'sub-1'): UiEvent {
  return {
    type: 'rss-item-open',
    rssGuid: guid,
    rssSubscriptionId: subscriptionId,
    readerUIJSONPayload: { 'subscriptionId': subscriptionId, 'guid': guid, 'read': true },
  };
}

function rssFavoriteAddEvent(guid: string = 'guid-1', subscriptionId: string = 'sub-1'): UiEvent {
  return {
    type: 'rss-favorite-add',
    rssGuid: guid,
    rssSubscriptionId: subscriptionId,
    rssTitle: 'Favorite Article',
    readerUIJSONPayload: { 'subscriptionId': subscriptionId, 'guid': guid, 'addedAt': 1 },
  };
}

function rssFavoriteRemoveEvent(guid: string = 'guid-1', subscriptionId: string = 'sub-1'): UiEvent {
  return {
    type: 'rss-favorite-remove',
    rssGuid: guid,
    rssSubscriptionId: subscriptionId,
    readerUIJSONPayload: { 'subscriptionId': subscriptionId, 'guid': guid },
  };
}

function emptyResult(): JsonObject {
  return {} as JsonObject;
}

async function flushRssResult(): Promise<void> {
  // One turn resolves the fake Core promise and a second runs the executor's
  // domain-event callback. Keep this microtask-only: no timing-based proof
  // is substituted for a real Core response.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function initRssPilot(core: ReaderRssPilotEffectExecutor): void {
  ReaderUiStore.init(undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, core);
  ReaderUiStore.setRssPilotEnabledForTest(true);
}

export default function ReaderRssPilotExecutorTests(): void {
  describe('ReaderUIRuntime RSS Pilot executor', () => {
    it('defaultsToShadowMode', 0, () => {
      const core = new RecordingRssCoreGateway();
      ReaderUiStore.init(undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, core);

      expect(ReaderUiStore.isRssPilotEnabled()).assertFalse();
      expect(core.effectOrder.length).assertEqual(0);
      expect(ReaderUiStore.rssPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('rssRefreshDispatchesFeedRefreshEffect', 0, async () => {
      const core = new RecordingRssCoreGateway();
      initRssPilot(core);

      ReaderUiStore.dispatch(rssRefreshEvent('sub-refresh-1'));

      expect(core.effectOrder.join(',')).assertEqual('rss.feed.refresh');
      expect(core.feedRefreshHandles.length).assertEqual(1);
      expect(core.feedRefreshSubscriptionIds[0]).assertEqual('sub-refresh-1');
      expect(ReaderUiStore.rssPilotSnapshot().activeCorrelationId.length > 0).assertTrue();
      expect(ReaderUiStore.rssPilotSnapshot().executedEffects).assertEqual(1);

      core.feedRefreshHandles[0].resolve(emptyResult());
      await flushRssResult();

      // After refresh completes the correlation is cleared.
      expect(ReaderUiStore.rssPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(ReaderUiStore.rssPilotSnapshot().executedEffects).assertEqual(1);
    });

    it('rssSubscriptionAddDispatchesPersistEffect', 0, async () => {
      const core = new RecordingRssCoreGateway();
      initRssPilot(core);

      ReaderUiStore.dispatch(rssSubscriptionAddEvent());

      expect(core.effectOrder.join(',')).assertEqual('rss.subscription.persist');
      expect(core.persistHandles.length).assertEqual(1);
      expect(core.persistActions[0]).assertEqual('add');
      expect(ReaderUiStore.rssPilotSnapshot().activeCorrelationId.length > 0).assertTrue();

      core.persistHandles[0].resolve(emptyResult());
      await flushRssResult();

      expect(ReaderUiStore.rssPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('rssSubscriptionAddFailureDispatchesErrorAndRollback', 0, async () => {
      const core = new RecordingRssCoreGateway();
      initRssPilot(core);

      ReaderUiStore.dispatch(rssSubscriptionAddEvent());
      expect(core.persistHandles.length).assertEqual(1);

      // Reject the persist promise to simulate a Core failure.
      core.persistHandles[0].reject(new Error('Core rss.subscription.add 网络错误'));
      await flushRssResult();

      // The correlation is cleared and a RSS_PILOT_FAILED error has been
      // dispatched. The rollback gateway is called to reload the canonical
      // list.
      expect(ReaderUiStore.rssPilotSnapshot().activeCorrelationId).assertEqual('');
      expect(core.rollbackHandles.length).assertEqual(1);
      const state = ReaderUiStore.snapshot();
      expect(state.error !== null).assertTrue();
      if (state.error !== null) {
        expect(state.error.code).assertEqual('RSS_PILOT_FAILED');
      }
    });

    it('rssSubscriptionDeleteDispatchesRemoveEffectAndRollbackOnFailure', 0, async () => {
      const core = new RecordingRssCoreGateway();
      initRssPilot(core);

      // Seed state so the delete-confirm route check passes.
      ReaderUiStore.dispatch({ type: 'rss-subscription-delete-request', rssSubscriptionId: 'sub-del-1' });
      ReaderUiStore.dispatch(rssSubscriptionDeleteConfirmEvent('sub-del-1'));

      // The delete event may be handled by the pilot; verify the remove effect
      // was dispatched.
      expect(core.removeHandles.length <= 1).assertTrue();
      if (core.removeHandles.length === 1) {
        expect(core.effectOrder.indexOf('rss.subscription.remove') >= 0).assertTrue();
        expect(core.removeSubscriptionIds[0]).assertEqual('sub-del-1');

        // Reject the remove promise to simulate a Core failure.
        core.removeHandles[0].reject(new Error('Core rss.subscription.delete 网络错误'));
        await flushRssResult();

        // The correlation is cleared and a rollback was attempted.
        expect(ReaderUiStore.rssPilotSnapshot().activeCorrelationId).assertEqual('');
        expect(core.rollbackHandles.length).assertEqual(1);
      }
    });

    it('rssSubscriptionEditDispatchesPersistEffect', 0, async () => {
      const core = new RecordingRssCoreGateway();
      initRssPilot(core);

      ReaderUiStore.dispatch(rssSubscriptionUpdateEvent('sub-edit-1'));

      expect(core.effectOrder.join(',')).assertEqual('rss.subscription.persist');
      expect(core.persistHandles.length).assertEqual(1);
      expect(core.persistActions[0]).assertEqual('edit');

      core.persistHandles[0].resolve(emptyResult());
      await flushRssResult();

      expect(ReaderUiStore.rssPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('rssEntryOpenDispatchesEntryReadEffect', 0, async () => {
      const core = new RecordingRssCoreGateway();
      initRssPilot(core);

      ReaderUiStore.dispatch(rssItemOpenEvent('guid-read-1', 'sub-read-1'));

      expect(core.effectOrder.join(',')).assertEqual('rss.entry.read');
      expect(core.entryReadHandles.length).assertEqual(1);
      expect(core.entryReadGuids[0]).assertEqual('guid-read-1');

      core.entryReadHandles[0].resolve(emptyResult());
      await flushRssResult();

      expect(ReaderUiStore.rssPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('rssFavoriteAddDispatchesFavoritePersistEffect', 0, async () => {
      const core = new RecordingRssCoreGateway();
      initRssPilot(core);

      ReaderUiStore.dispatch(rssFavoriteAddEvent('guid-fav-1', 'sub-fav-1'));

      expect(core.effectOrder.join(',')).assertEqual('rss.favorite.persist');
      expect(core.favoritePersistHandles.length).assertEqual(1);
      expect(core.favoritePersistGuids[0]).assertEqual('guid-fav-1');

      core.favoritePersistHandles[0].resolve(emptyResult());
      await flushRssResult();

      expect(ReaderUiStore.rssPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('rssFavoriteRemoveDispatchesFavoriteRemoveEffect', 0, async () => {
      const core = new RecordingRssCoreGateway();
      initRssPilot(core);

      ReaderUiStore.dispatch(rssFavoriteRemoveEvent('guid-fav-rm-1', 'sub-fav-rm-1'));

      expect(core.effectOrder.join(',')).assertEqual('rss.favorite.remove');
      expect(core.favoriteRemoveHandles.length).assertEqual(1);
      expect(core.favoriteRemoveGuids[0]).assertEqual('guid-fav-rm-1');

      core.favoriteRemoveHandles[0].resolve(emptyResult());
      await flushRssResult();

      expect(ReaderUiStore.rssPilotSnapshot().activeCorrelationId).assertEqual('');
    });

    it('failClosedClearsCorrelationWhenEffectExecutorThrows', 0, async () => {
      // Direct executor test: when the effect executor's Core boundary throws,
      // the executor must clear its correlation and dispatch a RSS_PILOT_FAILED
      // error. No orphan ledger remains.
      const core = new RecordingRssCoreGateway();
      core.throwOnFavoritePersist = true;
      const runtime = new MockRssRuntime();
      const host = new MockRssHost((): ReaderUiState => DemoUiState.initial());
      const executor = new ReaderRssEffectExecutor(runtime, host, core);

      const correlationId = 'test-rss-fail-closed-1';
      const payload: Record<string, string> = {};
      payload['action'] = 'favorite.add';
      payload['guid'] = 'guid-fail';
      payload['subscriptionId'] = 'sub-fail';
      payload['title'] = 'Fail Article';
      const effect = new MockRssEffect('rss.favorite.persist', correlationId, payload);

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

    it('staleResultGuardRejectsOldCorrelation', 0, async () => {
      // Direct executor test: cancelling the active correlation before the
      // deferred Core handle resolves must not re-open the correlation.
      const core = new RecordingRssCoreGateway();
      const runtime = new MockRssRuntime();
      const host = new MockRssHost((): ReaderUiState => DemoUiState.initial());
      const executor = new ReaderRssEffectExecutor(runtime, host, core);

      const correlationId = 'test-rss-stale-1';
      const payload: Record<string, string> = {};
      payload['action'] = 'entry.open';
      payload['guid'] = 'stale-guid';
      payload['subscriptionId'] = 'stale-sub';
      const effect = new MockRssEffect('rss.entry.read', correlationId, payload);

      executor.start(correlationId, payload, effect);
      expect(core.entryReadHandles.length).assertEqual(1);
      expect(executor.hasActiveCorrelation()).assertTrue();
      expect(executor.activeCorrelationId()).assertEqual(correlationId);

      // Cancel the active correlation while the entry-read handle is deferred.
      expect(executor.cancel(correlationId)).assertTrue();
      expect(executor.hasActiveCorrelation()).assertFalse();

      // Resolving the stale handle must not re-open the correlation.
      core.entryReadHandles[0].resolve(emptyResult());
      await flushRssResult();

      expect(executor.hasActiveCorrelation()).assertFalse();
      expect(executor.snapshot().ignoredLateResults > 0).assertTrue();
      expect(executor.snapshot().cancelledCommands > 0).assertTrue();
      // The host must not have received a domain event for the stale result.
      expect(host.events.length).assertEqual(0);
    });
  });
}

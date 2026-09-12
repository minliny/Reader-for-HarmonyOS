import {
  RssGateway,
  type RssItem,
  type RssSourceExportResult,
  type RssSourceImportResult,
  type RssSubscription,
  type RssSubscriptionItemsResult,
} from './RssGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { isReaderCoreTransactionPendingError } from '@reader/core-harmony';

const DOMAIN = 0x5244;

function delay(millis: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, millis);
  });
}

/**
 * Core exposes its temporary persistence/Host-operation gate through the
 * stable typed `TRANSACTION_PENDING` error.
 */
function isPendingTransactionError(error: Error): boolean {
  return isReaderCoreTransactionPendingError(error);
}

type RssMutation = () => Promise<void>;

export interface RssSourceSnapshot {
  subscriptions: RssSubscription[];
  subscription: RssSubscription;
  items: RssItem[];
}

export interface RssEntrySnapshot {
  subscriptions: RssSubscription[];
  subscription: RssSubscription;
  items: RssItem[];
  item: RssItem;
  favorite: boolean;
}

type RssSourceSnapshotEmitter = (snapshot: RssSourceSnapshot) => void;
type RssEntrySnapshotEmitter = (snapshot: RssEntrySnapshot) => void;
type RssOperationFailure = (error: Error) => void;
type RssRouteGuard = () => boolean;

/**
 * Owns the single RSS transaction chain shared by management and child routes.
 * Mutations are serialized because Core admits only one persistence/Host
 * continuation at a time. Pages are never updated optimistically: every
 * emitted projection is reloaded from Core after the requested transaction.
 */
export class RssOrchestrator {
  private readonly owner: ReaderRuntimeOwner;
  private readonly gateway: RssGateway;
  private readonly emit: (subscriptions: RssSubscription[]) => void;
  private readonly isCurrent: () => boolean;
  /** Bumped on every management-page entry; stale write-backs are discarded. */
  private session: number = 0;
  /** One chain for toggle, refresh, and remove across page entries. */
  private mutationChain: Promise<void> = Promise.resolve();

  constructor(
    emit: (subscriptions: RssSubscription[]) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.owner = owner;
    this.gateway = new RssGateway(owner);
    this.emit = emit;
    this.isCurrent = isCurrent;
  }

  /** Enter management: wait for prior mutations, then read Core truth. */
  open(): void {
    this.session += 1;
    const session = this.session;
    void this.loadList(session);
  }

  toggleSubscription(subscriptionId: string, enabled: boolean): void {
    this.enqueueMutation(
      'toggle',
      subscriptionId,
      async (): Promise<void> => {
        await this.gateway.updateSubscriptionEnabled(subscriptionId, enabled);
      },
    );
  }

  refreshSubscription(subscriptionId: string): void {
    this.enqueueMutation(
      'refresh',
      subscriptionId,
      async (): Promise<void> => {
        await this.gateway.refreshSubscription(subscriptionId);
      },
    );
  }

  removeSubscription(subscriptionId: string): void {
    this.enqueueMutation(
      'remove',
      subscriptionId,
      async (): Promise<void> => {
        await this.gateway.removeSubscription(subscriptionId);
      },
    );
  }

  importSources(
    replaceExisting: boolean,
    onComplete: (result: RssSourceImportResult | undefined) => void,
    onFailure: RssOperationFailure,
    onlineUrl?: string,
  ): void {
    const session = this.session;
    this.enqueueRouteTask(
      'source-import',
      replaceExisting ? 'replace' : 'merge',
      async (): Promise<void> => {
        const result = await this.gateway.importSources(replaceExisting, onlineUrl);
        if (result === undefined) {
          if (this.isCurrentSession(session)) onComplete(undefined);
          return;
        }
        const subscriptions = await this.loadSubscriptionsWithRetry();
        if (this.isCurrentSession(session)) {
          this.emit(subscriptions);
          onComplete(result);
        }
      },
      onFailure,
      (): boolean => this.isCurrentSession(session),
    );
  }

  exportSources(
    onComplete: (result: RssSourceExportResult) => void,
    onFailure: RssOperationFailure,
  ): void {
    const session = this.session;
    this.enqueueRouteTask(
      'source-export',
      'all',
      async (): Promise<void> => {
        const result = await this.gateway.exportSources();
        if (this.isCurrentSession(session)) onComplete(result);
      },
      onFailure,
      (): boolean => this.isCurrentSession(session),
    );
  }

  /** Read one SourceFeed snapshot on the same chain as all RSS mutations. */
  loadSourceFeed(
    subscriptionId: string,
    emit: RssSourceSnapshotEmitter,
    onFailure: RssOperationFailure,
    isCurrent: RssRouteGuard,
  ): void {
    this.enqueueRouteTask(
      'source-load',
      subscriptionId,
      async (): Promise<void> => {
        const snapshot = await this.loadSourceSnapshotWithRetry(subscriptionId);
        if (isCurrent()) {
          emit(snapshot);
        }
      },
      onFailure,
      isCurrent,
    );
  }

  /** Refresh one feed, then publish only a fresh list + cached-item snapshot. */
  refreshSourceFeed(
    subscriptionId: string,
    emit: RssSourceSnapshotEmitter,
    onFailure: RssOperationFailure,
    isCurrent: RssRouteGuard,
  ): void {
    this.enqueueRouteTask(
      'source-refresh',
      subscriptionId,
      async (): Promise<void> => {
        await this.runMutationWithRetry(async (): Promise<void> => {
          await this.gateway.refreshSubscription(subscriptionId);
        });
        const snapshot = await this.loadSourceSnapshotWithRetry(subscriptionId);
        if (isCurrent()) {
          emit(snapshot);
        }
      },
      onFailure,
      isCurrent,
    );
  }

  /** Opening an entry performs the real scoped read mutation before reload. */
  openEntry(
    subscriptionId: string,
    guid: string,
    emit: RssEntrySnapshotEmitter,
    onFailure: RssOperationFailure,
    isCurrent: RssRouteGuard,
  ): void {
    this.enqueueRouteTask(
      'entry-read',
      `${subscriptionId}:${guid}`,
      async (): Promise<void> => {
        await this.runMutationWithRetry(async (): Promise<void> => {
          await this.gateway.setEntryRead(subscriptionId, guid, true);
        });
        const snapshot = await this.loadEntrySnapshotWithRetry(subscriptionId, guid);
        if (isCurrent()) {
          emit(snapshot);
        }
      },
      onFailure,
      isCurrent,
    );
  }

  /**
   * Re-read favorite membership inside the serial chain, mutate only when the
   * requested truth differs, then reload authoritative entry state.
   */
  setEntryFavorite(
    subscriptionId: string,
    guid: string,
    favorite: boolean,
    emit: RssEntrySnapshotEmitter,
    onFailure: RssOperationFailure,
    isCurrent: RssRouteGuard,
  ): void {
    this.enqueueRouteTask(
      'entry-favorite',
      `${subscriptionId}:${guid}`,
      async (): Promise<void> => {
        const current = await this.loadFavoriteMembershipWithRetry(subscriptionId, guid);
        if (current !== favorite) {
          if (favorite) {
            const addedAt = Date.now();
            await this.runMutationWithRetry(async (): Promise<void> => {
              await this.gateway.persistFavorite(subscriptionId, guid, addedAt);
            });
          } else {
            await this.runMutationWithRetry(async (): Promise<void> => {
              await this.gateway.removeFavorite(subscriptionId, guid);
            });
          }
        }
        const snapshot = await this.loadEntrySnapshotWithRetry(subscriptionId, guid);
        if (isCurrent()) {
          emit(snapshot);
        }
      },
      onFailure,
      isCurrent,
    );
  }

  private enqueueMutation(
    action: string,
    subscriptionId: string,
    mutation: RssMutation,
  ): void {
    const session = this.session;
    this.mutationChain = this.mutationChain
      .then((): Promise<void> => this.applyMutation(
        action,
        subscriptionId,
        mutation,
        session,
      ))
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader',
          'RSS management mutation failed; projection unchanged: action=%{private}s subscriptionId=%{private}s err=%{private}s',
          action, subscriptionId, error.message);
      });
  }

  /** Route-scoped work shares `mutationChain`; Index never owns a queue. */
  private enqueueRouteTask(
    action: string,
    identity: string,
    task: RssMutation,
    onFailure: RssOperationFailure,
    isCurrent: RssRouteGuard,
  ): void {
    this.mutationChain = this.mutationChain
      .then((): Promise<void> => task())
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader',
          'RSS route operation failed: action=%{private}s identity=%{private}s err=%{private}s',
          action, identity, error.message);
        if (isCurrent()) {
          onFailure(error);
        }
      });
  }

  private async applyMutation(
    action: string,
    subscriptionId: string,
    mutation: RssMutation,
    session: number,
  ): Promise<void> {
    await this.runMutationWithRetry(mutation);
    let subscriptions: RssSubscription[];
    try {
      subscriptions = await this.loadSubscriptionsWithRetry();
    } catch (error) {
      hilog.warn(DOMAIN, 'Reader',
        'RSS management mutation persisted but list reload failed: action=%{private}s subscriptionId=%{private}s err=%{private}s',
        action, subscriptionId, (error as Error).message);
      return;
    }
    // Mutations and their reloads share one chain, so every emitted snapshot
    // is authoritative for all transactions completed before it. Publishing
    // each successful step also ensures a later failed intent cannot conceal
    // an earlier persisted change.
    if (this.isCurrentSession(session)) {
      this.emit(subscriptions);
    }
  }

  private async loadList(session: number): Promise<void> {
    await this.waitForMutations(3000);
    let subscriptions: RssSubscription[];
    try {
      subscriptions = await this.loadSubscriptionsWithRetry();
    } catch (error) {
      if (this.isCurrentSession(session)) {
        hilog.error(DOMAIN, 'Reader',
          'RSS subscription management load failed: %{private}s', (error as Error).message);
      }
      return;
    }
    if (this.isCurrentSession(session)) {
      this.emit(subscriptions);
    }
  }

  private async runMutationWithRetry(mutation: RssMutation): Promise<void> {
    try {
      await mutation();
      return;
    } catch (error) {
      const err = error as Error;
      if (!isPendingTransactionError(err)) {
        throw err;
      }
      await this.waitForCoreIdle(5000);
      await mutation();
    }
  }

  private async loadSubscriptionsWithRetry(): Promise<RssSubscription[]> {
    try {
      return await this.gateway.loadSubscriptions();
    } catch (error) {
      const err = error as Error;
      if (!isPendingTransactionError(err)) {
        throw err;
      }
      await this.waitForCoreIdle(5000);
      return await this.gateway.loadSubscriptions();
    }
  }

  private async loadSourceSnapshotWithRetry(subscriptionId: string): Promise<RssSourceSnapshot> {
    const subscriptions = await this.loadSubscriptionsWithRetry();
    const subscription = subscriptions.find(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    );
    if (subscription === undefined) {
      throw new Error(`RSS subscription ${subscriptionId} is no longer available`);
    }
    const itemResult = await this.loadItemsWithRetry(subscriptionId);
    const reconciledSubscriptions = subscriptions.map(
      (candidate: RssSubscription): RssSubscription =>
        candidate.subscriptionId === subscriptionId ? itemResult.subscription : candidate,
    );
    return {
      subscriptions: reconciledSubscriptions,
      subscription: itemResult.subscription,
      items: itemResult.items,
    };
  }

  private async loadEntrySnapshotWithRetry(
    subscriptionId: string,
    guid: string,
  ): Promise<RssEntrySnapshot> {
    const source = await this.loadSourceSnapshotWithRetry(subscriptionId);
    const item = source.items.find(
      (candidate: RssItem): boolean => candidate.subscriptionId === subscriptionId &&
        candidate.guid === guid,
    );
    if (item === undefined) {
      throw new Error(`RSS entry ${subscriptionId}:${guid} is no longer available`);
    }
    const favorite = await this.loadFavoriteMembershipWithRetry(subscriptionId, guid);
    return {
      subscriptions: source.subscriptions,
      subscription: source.subscription,
      items: source.items,
      item,
      favorite,
    };
  }

  private async loadItemsWithRetry(
    subscriptionId: string,
  ): Promise<RssSubscriptionItemsResult> {
    try {
      return await this.gateway.loadItems(subscriptionId);
    } catch (error) {
      const err = error as Error;
      if (!isPendingTransactionError(err)) {
        throw err;
      }
      await this.waitForCoreIdle(5000);
      return await this.gateway.loadItems(subscriptionId);
    }
  }

  private async loadFavoriteMembershipWithRetry(
    subscriptionId: string,
    guid: string,
  ): Promise<boolean> {
    try {
      return await this.gateway.isFavorite(subscriptionId, guid);
    } catch (error) {
      const err = error as Error;
      if (!isPendingTransactionError(err)) {
        throw err;
      }
      await this.waitForCoreIdle(5000);
      return await this.gateway.isFavorite(subscriptionId, guid);
    }
  }

  /** Poll `runtime.status`, bounded, until no Host continuation is pending. */
  private async waitForCoreIdle(maxMillis: number): Promise<void> {
    const deadline = Date.now() + maxMillis;
    while (Date.now() < deadline) {
      try {
        const result = await this.owner.request('runtime.status', {});
        const pending = result.data['pendingHostOperationCount'] as number | undefined;
        if (pending === 0) {
          return;
        }
      } catch (error) {
        hilog.warn(DOMAIN, 'Reader',
          'runtime.status probe failed during RSS idle wait: %{private}s',
          (error as Error).message);
      }
      await delay(250);
    }
  }

  private waitForMutations(maxMillis: number): Promise<void> {
    return Promise.race([this.mutationChain, delay(maxMillis)]);
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && session === this.session;
  }
}

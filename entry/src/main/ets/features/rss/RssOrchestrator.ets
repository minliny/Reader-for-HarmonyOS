import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { RssRouteOperationHost, type RssRouteOperationProjection, type RssRouteBinding } from './RssRouteOperationHost';
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
import {
  projectPersistedReceipt,
  type PersistedReceiptProjection,
} from '../../app/ReaderPersistedReceiptProjection';
import {
  projectOperationFacts,
  type CommitConfirmationKind,
  type OperationFacts,
} from '../../app/ReaderOperationFacts';

const DOMAIN = 0x5244;
// A page @Prop may clone a projection. A process-wide token remains stable
// across that clone and never collides when the RuntimeOwner is replaced.
let rssProjectionGeneration: number = 0;

function logRssError(format: string, ...values: string[]): void {
  try { hilog.error(DOMAIN, 'Reader', format, ...values); } catch (_) {}
}

function logRssWarning(format: string, ...values: string[]): void {
  try { hilog.warn(DOMAIN, 'Reader', format, ...values); } catch (_) {}
}

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

/**
 * Durable mutation/read-back facts for the management route. The write is
 * confirmed independently from the follow-up list read, so a transient list
 * failure cannot erase the fact that Core already applied the mutation.
 */
export interface RssManagementOperationProjection {
  action: string;
  subscriptionId: string;
  projection: PersistedReceiptProjection<RssSubscription[]>;
}

type RssOperationProjectionEmitter = (operation: RssManagementOperationProjection) => void;

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
  private static readonly retained: WeakMap<ReaderRuntimeOwner, RssOrchestrator> = new WeakMap();

  /** One original RSS lane per Runtime; obsolete factories cannot evict it.
   * Warm ownership is not an operation receipt or a cold recovery journal. */
  static forRuntime(owner: ReaderRuntimeOwner): RssOrchestrator | undefined {
    if (!ReaderRuntimeOwner.isCurrent(owner)) return undefined;
    const retained = RssOrchestrator.retained.get(owner);
    if (retained !== undefined) return retained;
    const orchestrator = new RssOrchestrator((_value: RssSubscription[]): void => {},
      (): boolean => false, owner);
    // Native WeakMap ownership cannot pin a closed Runtime solely because
    // RSS was its last visited feature. Accepted tasks keep their own owner.
    RssOrchestrator.retained.set(owner, orchestrator);
    return orchestrator;
  }

  private readonly owner: ReaderRuntimeOwner;
  private readonly gateway: RssGateway;
  private readonly routeOperations: RssRouteOperationHost;
  private feedRead: OperationFacts<RssSubscription[]> = projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
  private feedValue: RssSubscription[] | undefined = undefined;
  private emit: (subscriptions: RssSubscription[]) => void;
  private isCurrent: () => boolean;
  private emitOperation: RssOperationProjectionEmitter;
  private emitRead: (facts: OperationFacts<RssSubscription[]>) => void;
  private presentationIdentity: string | undefined = undefined;
  /** Bumped on every management-page entry; stale write-backs are discarded. */
  private session: number = 0;
  /** One chain for toggle, refresh, and remove across page entries. */
  private mutationChain: Promise<void> = Promise.resolve();
  private lastSubscriptions: RssSubscription[] = [];
  private hasSubscriptions: boolean = false;
  private latestRead: OperationFacts<RssSubscription[]> = projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
  private latestOperation: RssManagementOperationProjection | undefined;

  constructor(
    emit: (subscriptions: RssSubscription[]) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
    emitOperation: RssOperationProjectionEmitter = (_operation: RssManagementOperationProjection): void => {},
    emitRead: (facts: OperationFacts<RssSubscription[]>) => void =
      (_facts: OperationFacts<RssSubscription[]>): void => {},
  ) {
    this.owner = owner;
    this.gateway = new RssGateway(owner);
    this.routeOperations = new RssRouteOperationHost({ gateway: this.gateway,
      ownsRuntime: (): boolean => this.ownsRuntime(),
      enqueue: (work: () => Promise<void>): void => {
        void this.runSerialized(work).catch((error: Error): void => logRssError('%{private}s', error.message));
      },
      mutate: (work: () => Promise<void>, admitted: () => boolean): Promise<void> => this.runMutationWithRetry(work, admitted),
      readSource: (id: string): Promise<RssSourceSnapshot> => this.loadSourceSnapshotWithRetry(id),
      readEntry: (id: string, guid: string): Promise<RssEntrySnapshot> => this.loadEntrySnapshotWithRetry(id, guid),
      readMembership: (id: string, guid: string): Promise<boolean> => this.loadFavoriteMembershipWithRetry(id, guid),
      deliveryFailed: (error: Error): void => logRssError('%{private}s', error.message),
    });
    this.emit = emit;
    this.isCurrent = isCurrent;
    this.emitOperation = emitOperation;
    this.emitRead = emitRead;
  }

  owns(owner: ReaderRuntimeOwner): boolean {
    return this.owner === owner;
  }

  /** A physical view captures identity before dispatch. Replacing its delivery
   * retires queued intents, while accepted writes retain this original lane. */
  attachPresentation(identity: string, emit: (subscriptions: RssSubscription[]) => void,
    isCurrent: () => boolean, emitOperation: RssOperationProjectionEmitter,
    emitRead: (facts: OperationFacts<RssSubscription[]>) => void,
    admitted: () => boolean): boolean {
    if (!this.ownsRuntime() || identity.length === 0) return false;
    try { if (!admitted()) return false; } catch (_error) { return false; }
    if (this.presentationIdentity !== identity) this.session += 1;
    this.presentationIdentity = identity;
    this.emit = emit;
    this.isCurrent = isCurrent;
    this.emitOperation = emitOperation;
    this.emitRead = emitRead;
    const session = this.session;
    this.deliverRoute((): boolean => this.isCurrentSession(session), (): void => {
      if (this.hasSubscriptions) this.emit(this.lastSubscriptions);
      this.emitRead(this.latestRead);
      if (this.latestOperation !== undefined) this.emitOperation(this.latestOperation);
    });
    return true;
  }

  /** An old view cannot detach a newer view or discard its pending truth. */
  detachPresentation(identity: string): void {
    if (this.presentationIdentity !== identity) return;
    this.presentationIdentity = undefined;
    this.session += 1;
    this.isCurrent = (): boolean => false;
    this.emit = (_value: RssSubscription[]): void => {};
    this.emitOperation = (_value: RssManagementOperationProjection): void => {};
    this.emitRead = (_value: OperationFacts<RssSubscription[]>): void => {};
  }

  /** Last durable mutation fact, retained for a late route/read-back observer. */
  latestOperationProjection(): RssManagementOperationProjection | undefined {
    return this.latestOperation;
  }

  /** Enter management: wait for prior mutations, then read Core truth. */
  open(): void {
    this.session += 1;
    const session = this.session;
    this.publishRead(session, 'loading');
    const operation = this.latestOperation;
    if (operation !== undefined && operation.projection.receipt.fact !== 'confirmedCurrent') {
      this.publishOperation(operation.action, operation.subscriptionId, session, 'reading',
        undefined, undefined, operation.projection.receipt.confirmation);
    }
    this.mutationChain = this.mutationChain.then((): Promise<void> => this.loadList(session));
  }

  /** Retry a failed read only. Generation rejects stale or double-click intents. */
  retryManagementRead(facts: OperationFacts<RssSubscription[]>): void {
    const session = this.session;
    this.mutationChain = this.mutationChain.then(async (): Promise<void> => {
      if (!this.isCurrentSession(session) || this.latestRead.generation !== facts.generation ||
        !this.latestRead.canRetry) return;
      this.publishRead(session, 'loading');
      await this.loadList(session);
    });
  }

  /** Never replay the write: a matching read is not a lost commit acknowledgement. */
  reconcileManagementOperation(expected: RssManagementOperationProjection): void {
    const session = this.session;
    this.mutationChain = this.mutationChain.then(async (): Promise<void> => {
      const operation = this.latestOperation;
      if (!this.isCurrentSession(session) || operation === undefined ||
        operation.projection.facts.generation !== expected.projection.facts.generation ||
        !operation.projection.facts.canRetry) return;
      await this.readBack(operation.action, operation.subscriptionId, session,
        operation.projection.receipt.confirmation);
    });
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
    if (!this.isCurrentSession(session)) return;
    this.enqueueRouteTask(
      'source-import',
      replaceExisting ? 'replace' : 'merge',
      async (): Promise<void> => {
        if (await this.reconcileUnknownManagementWrite(session)) return;
        let dispatched = false;
        let result: RssSourceImportResult | undefined;
        const evidence = new ReaderWriteEvidence();
        this.gateway.observeWrites(evidence, (): boolean => this.isCurrentSession(session));
        try {
          result = await this.gateway.importSources(replaceExisting, onlineUrl,
            (): void => {
              dispatched = true;
              this.publishOperation('source-import', replaceExisting ? 'replace' : 'merge',
                session, 'reading', undefined, undefined, 'unknown');
            });
        } catch (error) {
          if (!dispatched) throw error;
          this.publishOperation('source-import', replaceExisting ? 'replace' : 'merge',
            session, 'failed', (error as Error).message, undefined,
            evidence.confirmation());
          return;
        } finally { this.gateway.observeWrites(undefined); }
        if (result === undefined) {
          if (this.isCurrentSession(session)) onComplete(undefined);
          return;
        }
        // The import acknowledgement is durable even if the list read fails.
        this.publishOperation('source-import', replaceExisting ? 'replace' : 'merge', session,
          'reading', undefined, undefined, 'confirmed');
        await this.readBack('source-import', replaceExisting ? 'replace' : 'merge', session, 'confirmed');
        if (this.isCurrentSession(session)) onComplete(result);
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

  /** Main feed is a subscription projection only; global query remains unadmitted. */
  loadFeed(emit: (value: RssSubscription[]) => void, emitRead: (facts: OperationFacts<RssSubscription[]>) => void,
    isCurrent: RssRouteGuard, expectedGeneration?: number): void {
    void this.runSerialized(async (): Promise<void> => {
      if (!this.ownsRuntime() || !isCurrent() ||
        (expectedGeneration !== undefined && (this.feedRead.generation !== expectedGeneration || !this.feedRead.canRetry))) return;
      this.feedRead = projectOperationFacts<RssSubscription[]>({ phase: 'loading', value: this.feedValue, generation: ++rssProjectionGeneration });
      this.deliverRoute(isCurrent, (): void => emitRead(this.feedRead));
      try {
        const subscriptions = await this.loadSubscriptionsWithRetry();
        if (!this.ownsRuntime()) return;
        this.feedValue = subscriptions;
        this.feedRead = projectOperationFacts<RssSubscription[]>({ phase: 'succeeded', value: subscriptions, generation: ++rssProjectionGeneration });
        this.deliverRoute(isCurrent, (): void => emitRead(this.feedRead));
        this.deliverRoute(isCurrent, (): void => emit(subscriptions));
      } catch (error) {
        this.feedRead = projectOperationFacts<RssSubscription[]>({ phase: 'failed', value: this.feedValue,
          message: (error as Error).message, canRetry: true, generation: ++rssProjectionGeneration });
        this.deliverRoute(isCurrent, (): void => emitRead(this.feedRead));
      }
    }).catch((error: Error): void => logRssError('%{private}s', error.message));
  }

  /** Also used by the editor: every RSS write/read shares this actual lane. */
  runSerialized(work: () => Promise<void>): Promise<void> {
    const result = this.mutationChain.then(async (): Promise<void> => {
      if (!this.ownsRuntime()) throw new Error('RSS runtime owner retired');
      await work();
    });
    this.mutationChain = result.catch((error: Error): void => logRssError('%{private}s', error.message));
    return result;
  }

  loadSourceFeed(subscriptionId: string, emit: RssSourceSnapshotEmitter, onFailure: RssOperationFailure,
    isCurrent: RssRouteGuard, emitOperation?: (operation: RssRouteOperationProjection<RssSourceSnapshot>) => void,
    emitRead?: (facts: OperationFacts<RssSourceSnapshot>) => void): void {
    this.routeOperations.loadSource(subscriptionId, { emit, failed: onFailure, current: isCurrent, emitOperation, emitRead });
  }

  refreshSourceFeed(subscriptionId: string, emit: RssSourceSnapshotEmitter, onFailure: RssOperationFailure,
    isCurrent: RssRouteGuard, emitOperation?: (operation: RssRouteOperationProjection<RssSourceSnapshot>) => void,
    emitRead?: (facts: OperationFacts<RssSourceSnapshot>) => void): void {
    this.routeOperations.refreshSource(subscriptionId, { emit, failed: onFailure, current: isCurrent, emitOperation, emitRead });
  }

  openEntry(subscriptionId: string, guid: string, emit: RssEntrySnapshotEmitter, onFailure: RssOperationFailure,
    isCurrent: RssRouteGuard, emitOperation?: (operation: RssRouteOperationProjection<RssEntrySnapshot>) => void,
    emitRead?: (facts: OperationFacts<RssEntrySnapshot>) => void): void {
    this.routeOperations.openEntry(subscriptionId, guid, { emit, failed: onFailure, current: isCurrent, emitOperation, emitRead });
  }

  setEntryFavorite(subscriptionId: string, guid: string, favorite: boolean, emit: RssEntrySnapshotEmitter,
    onFailure: RssOperationFailure, isCurrent: RssRouteGuard,
    emitOperation?: (operation: RssRouteOperationProjection<RssEntrySnapshot>) => void,
    emitRead?: (facts: OperationFacts<RssEntrySnapshot>) => void): void {
    this.routeOperations.setFavorite(subscriptionId, guid, favorite, { emit, failed: onFailure, current: isCurrent, emitOperation, emitRead });
  }

  reconcileSourceOperation(expected: RssRouteOperationProjection<RssSourceSnapshot>, binding: RssRouteBinding<RssSourceSnapshot>): void {
    this.routeOperations.reconcileSource(expected, binding);
  }

  reconcileEntryOperation(expected: RssRouteOperationProjection<RssEntrySnapshot>, binding: RssRouteBinding<RssEntrySnapshot>): void {
    this.routeOperations.reconcileEntry(expected, binding);
  }

  retrySourceRead(id: string, expected: OperationFacts<RssSourceSnapshot>, binding: RssRouteBinding<RssSourceSnapshot>): void {
    this.routeOperations.retrySourceRead(id, expected, binding);
  }

  retryEntryRead(id: string, guid: string, expected: OperationFacts<RssEntrySnapshot>, binding: RssRouteBinding<RssEntrySnapshot>): void {
    this.routeOperations.retryEntryRead(id, guid, expected, binding);
  }

  private enqueueMutation(
    action: string,
    subscriptionId: string,
    mutation: RssMutation,
  ): void {
    const session = this.session;
    if (!this.isCurrentSession(session)) return;
    this.mutationChain = this.mutationChain
      .then((): Promise<void> => this.applyMutation(
        action,
        subscriptionId,
        mutation,
        session,
      ))
      .catch((error: Error): void => {
        this.publishOperation(action, subscriptionId, session, 'failed', error.message,
          undefined, isPendingTransactionError(error) ? 'undispatched' : 'unknown');
        logRssError(
          'RSS management mutation acknowledgement unavailable: action=%{private}s subscriptionId=%{private}s err=%{private}s',
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
      .then(async (): Promise<void> => {
        if (!this.ownsRuntime() || !isCurrent()) return;
        await task();
      })
      .catch((error: Error): void => {
        logRssError(
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
    if (!this.isCurrentSession(session) || await this.reconcileUnknownManagementWrite(session)) return;
    const evidence = new ReaderWriteEvidence();
    this.gateway.observeWrites(evidence, (): boolean => this.isCurrentSession(session));
    this.publishOperation(action, subscriptionId, session, 'reading', undefined, undefined, 'undispatched');
    try {
      await this.runMutationWithRetry(mutation, (): boolean => this.isCurrentSession(session));
    } catch (error) {
      this.publishOperation(action, subscriptionId, session, 'failed', (error as Error).message, undefined, evidence.confirmation());
      return;
    } finally { this.gateway.observeWrites(undefined); }
    // Receipt settlement is owned here even after the original view/Runtime
    // retired. Runtime admission only controls subsequent reads and delivery.
    this.publishOperation(action, subscriptionId, session, 'reading', undefined, undefined, evidence.confirmation());
    await this.readBack(action, subscriptionId, session, evidence.confirmation());
  }

  private deliverRoute(isCurrent: RssRouteGuard, delivery: () => void): void {
    try {
      if (!this.ownsRuntime() || !isCurrent()) return;
      delivery();
    } catch (error) { logRssError('%{private}s', (error as Error).message); }
  }

  private async reconcileUnknownManagementWrite(session: number): Promise<boolean> {
    const operation = this.latestOperation;
    if (operation?.projection.receipt.confirmation !== 'unknown') return false;
    await this.readBack(operation.action, operation.subscriptionId, session, 'unknown');
    return true;
  }

  private async readBack(
    action: string,
    subscriptionId: string,
    session: number,
    confirmation: CommitConfirmationKind,
  ): Promise<void> {
    if (!this.ownsRuntime()) return;
    this.publishOperation(action, subscriptionId, session, 'reading', undefined, undefined, confirmation);
    let subscriptions: RssSubscription[];
    try {
      subscriptions = await this.loadSubscriptionsWithRetry();
    } catch (error) {
      const refreshError = (error as Error).message;
      this.publishOperation(action, subscriptionId, session, 'failed', refreshError, undefined, confirmation);
      logRssWarning(
        'RSS management readback failed: confirmation=%{private}s action=%{private}s subscriptionId=%{private}s err=%{private}s',
        confirmation, action, subscriptionId, refreshError);
      return;
    }
    this.lastSubscriptions = subscriptions;
    this.hasSubscriptions = true;
    this.publishOperation(action, subscriptionId, session, 'succeeded', undefined, subscriptions, confirmation);
    this.publishRead(session, 'succeeded');
    // Mutations and their reloads share one chain, so every emitted snapshot
    // is authoritative for all transactions completed before it. Publishing
    // each successful step also ensures a later failed intent cannot conceal
    // an earlier persisted change.
    const deliverySession = this.presentationIdentity === undefined ? session : this.session;
    if (this.isCurrentSession(deliverySession)) {
      this.deliverRoute((): boolean => this.isCurrentSession(deliverySession), (): void => this.emit(subscriptions));
    }
  }

  private async loadList(session: number): Promise<void> {
    if (!this.isCurrentSession(session)) return;
    let subscriptions: RssSubscription[];
    try {
      subscriptions = await this.loadSubscriptionsWithRetry();
    } catch (error) {
      this.publishRead(session, 'failed', (error as Error).message);
      const operation = this.latestOperation;
      if (operation !== undefined && operation.projection.receipt.fact !== 'confirmedCurrent') {
        this.publishOperation(operation.action, operation.subscriptionId, session, 'failed',
          (error as Error).message, undefined, operation.projection.receipt.confirmation);
      }
      if (this.isCurrentSession(session)) {
        logRssError(
          'RSS subscription management load failed: %{private}s', (error as Error).message);
      }
      return;
    }
    this.lastSubscriptions = subscriptions;
    this.hasSubscriptions = true;
    const operation = this.latestOperation;
    if (operation !== undefined) {
      this.publishOperation(operation.action, operation.subscriptionId, session, 'succeeded',
        undefined, subscriptions, operation.projection.receipt.confirmation);
    }
    this.publishRead(session, 'succeeded');
    const deliverySession = this.presentationIdentity === undefined ? session : this.session;
    if (this.isCurrentSession(deliverySession)) {
      this.deliverRoute((): boolean => this.isCurrentSession(deliverySession), (): void => this.emit(subscriptions));
    }
  }

  private publishOperation(
    action: string,
    subscriptionId: string,
    session: number,
    readback: 'reading' | 'failed' | 'succeeded',
    refreshError?: string,
    value?: RssSubscription[],
    confirmation: CommitConfirmationKind = 'confirmed',
  ): void {
    const projection = projectPersistedReceipt<RssSubscription[]>({
      confirmation,
      readback,
      value: value ?? (this.hasSubscriptions ? this.lastSubscriptions : undefined),
      refreshError,
      stale: readback === 'failed',
      canRetry: confirmation !== 'undispatched' && readback !== 'reading' &&
        (readback === 'failed' || confirmation === 'unknown'),
      generation: ++rssProjectionGeneration,
    });
    const operation: RssManagementOperationProjection = { action, subscriptionId, projection };
    this.latestOperation = operation;
    const deliverySession = this.presentationIdentity === undefined ? session : this.session;
    if (this.isCurrentSession(deliverySession)) {
      this.deliverRoute((): boolean => this.isCurrentSession(deliverySession), (): void => this.emitOperation(operation));
    }
  }

  private publishRead(session: number, phase: 'loading' | 'failed' | 'succeeded', message?: string): void {
    this.latestRead = projectOperationFacts<RssSubscription[]>({
      phase,
      value: this.hasSubscriptions ? this.lastSubscriptions : undefined,
      canRetry: phase === 'failed',
      generation: ++rssProjectionGeneration,
      message,
    });
    const deliverySession = this.presentationIdentity === undefined ? session : this.session;
    this.deliverRoute((): boolean => this.isCurrentSession(deliverySession), (): void => this.emitRead(this.latestRead));
  }

  private async runMutationWithRetry(mutation: RssMutation, admitted: () => boolean = (): boolean => this.ownsRuntime()): Promise<void> {
    if (!admitted()) throw new Error('RSS operation superseded before dispatch');
    try {
      await mutation();
      return;
    } catch (error) {
      const err = error as Error;
      if (!isPendingTransactionError(err)) {
        throw err;
      }
      await this.waitForCoreIdle(5000);
      if (!this.ownsRuntime() || !admitted()) throw new Error('RSS operation superseded before dispatch');
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
        logRssWarning(
          'runtime.status probe failed during RSS idle wait: %{private}s',
          (error as Error).message);
      }
      await delay(250);
    }
  }

  /** EntryAbility teardown unsets current(); retirement is an admission fact,
   * not a transport failure and must not erase an already accepted receipt. */
  private ownsRuntime(): boolean {
    try { return this.owner === ReaderRuntimeOwner.current(); }
    catch (_error) { return false; }
  }

  private isCurrentSession(session: number): boolean {
    try { return this.ownsRuntime() && this.isCurrent() && session === this.session; }
    catch (_error) { return false; }
  }
}

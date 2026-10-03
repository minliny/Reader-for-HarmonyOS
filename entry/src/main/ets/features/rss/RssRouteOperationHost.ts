import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence.ts';
import { projectOperationFacts, type OperationFacts, type CommitConfirmationKind } from '../../app/ReaderOperationFacts.ts';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection.ts';
import type { RssGateway } from './RssGateway';
import type { RssSourceSnapshot, RssEntrySnapshot } from './RssPresentationContract';
import type { RssOriginalMutationIdentity, RssOriginalMutationProjection } from './RssMutationRecoveryContract';

let routeFactGeneration: number = 0;

export interface RssRouteOperationProjection<T> {
  action: string;
  subscriptionId: string;
  guid: string;
  projection: PersistedReceiptProjection<T>;
  original?: RssOriginalMutationProjection;
}

export interface RssRouteBinding<T> {
  emit: (value: T) => void;
  failed: (error: Error) => void;
  current: () => boolean;
  emitOperation?: (operation: RssRouteOperationProjection<T>) => void;
  emitRead?: (facts: OperationFacts<T>) => void;
  /** Cross-family original authority is independent from this entity's receipt. */
  emitOriginal?: (original: RssOriginalMutationProjection | undefined) => void;
}

interface RssRouteDependencies {
  gateway: RssGateway;
  ownsRuntime: () => boolean;
  enqueue: (work: () => Promise<void>) => void;
  mutate: (work: () => Promise<void>, admitted: () => boolean) => Promise<void>;
  readSource: (subscriptionId: string) => Promise<RssSourceSnapshot>;
  readEntry: (subscriptionId: string, guid: string) => Promise<RssEntrySnapshot>;
  readMembership: (subscriptionId: string, guid: string) => Promise<boolean>;
  deliveryFailed?: (error: Error) => void;
}

class RssRouteState<T> {
  pending: number = 0;
  value: T | undefined = undefined;
  read: OperationFacts<T> = projectOperationFacts<T>({ phase: 'idle' });
  operation: RssRouteOperationProjection<T> | undefined = undefined;
}

/** RSS entity facts and recovery only. Reuses the orchestrator's one serial
 * lane and actual gateway receipts; owns no page/router and no global bus. */
export class RssRouteOperationHost {
  private readonly dependencies: RssRouteDependencies;
  private readonly sources: Map<string, RssRouteState<RssSourceSnapshot>> = new Map();
  private readonly entries: Map<string, RssRouteState<RssEntrySnapshot>> = new Map();

  constructor(dependencies: RssRouteDependencies) { this.dependencies = dependencies; }

  loadSource(subscriptionId: string, binding: RssRouteBinding<RssSourceSnapshot>): void {
    const state = this.source(subscriptionId);
    this.enqueue(state, binding, async (): Promise<void> => this.read(state, binding,
      (): Promise<RssSourceSnapshot> => this.dependencies.readSource(subscriptionId)));
  }

  refreshSource(subscriptionId: string, binding: RssRouteBinding<RssSourceSnapshot>): void {
    const state = this.source(subscriptionId);
    this.enqueue(state, binding, async (): Promise<void> => this.write(state, binding, 'source-refresh', subscriptionId, '',
      async (): Promise<void> => { await this.dependencies.gateway.refreshSubscription(subscriptionId); },
      (): Promise<RssSourceSnapshot> => this.dependencies.readSource(subscriptionId)));
  }

  openEntry(subscriptionId: string, guid: string, binding: RssRouteBinding<RssEntrySnapshot>): void {
    const state = this.entry(subscriptionId, guid);
    this.enqueue(state, binding, async (): Promise<void> => this.write(state, binding, 'entry-read', subscriptionId, guid,
      async (): Promise<void> => { await this.dependencies.gateway.setEntryRead(subscriptionId, guid, true); },
      (): Promise<RssEntrySnapshot> => this.dependencies.readEntry(subscriptionId, guid)));
  }

  setFavorite(subscriptionId: string, guid: string, favorite: boolean, binding: RssRouteBinding<RssEntrySnapshot>): void {
    const state = this.entry(subscriptionId, guid);
    const reader = (): Promise<RssEntrySnapshot> => this.dependencies.readEntry(subscriptionId, guid);
    this.enqueue(state, binding, async (): Promise<void> => {
      if (state.operation?.projection.receipt.confirmation === 'unknown') { await this.read(state, binding, reader); return; }
      this.publishRead(state, binding, 'loading');
      let current: boolean;
      try { current = await this.dependencies.readMembership(subscriptionId, guid); }
      catch (error) { this.publishRead(state, binding, 'failed', (error as Error).message); this.reportFailure(binding, error as Error); return; }
      if (!this.admitted(binding)) return;
      if (current === favorite) { await this.read(state, binding, reader); return; }
      await this.write(state, binding, favorite ? 'favorite-add' : 'favorite-remove', subscriptionId, guid,
        async (): Promise<void> => {
          if (favorite) await this.dependencies.gateway.persistFavorite(subscriptionId, guid, Date.now());
          else await this.dependencies.gateway.removeFavorite(subscriptionId, guid);
        }, reader);
    });
  }

  reconcileSource(expected: RssRouteOperationProjection<RssSourceSnapshot>, binding: RssRouteBinding<RssSourceSnapshot>): void {
    const state = this.source(expected.subscriptionId);
    this.reconcile(state, expected, binding, (): Promise<RssSourceSnapshot> => this.dependencies.readSource(expected.subscriptionId));
  }

  reconcileEntry(expected: RssRouteOperationProjection<RssEntrySnapshot>, binding: RssRouteBinding<RssEntrySnapshot>): void {
    const state = this.entry(expected.subscriptionId, expected.guid);
    this.reconcile(state, expected, binding, (): Promise<RssEntrySnapshot> => this.dependencies.readEntry(expected.subscriptionId, expected.guid));
  }

  reconcileSourceOriginal(expected: RssOriginalMutationIdentity, binding: RssRouteBinding<RssSourceSnapshot>, subscriptionId: string): void {
    this.reconcileOriginal(this.source(subscriptionId), expected, binding,
      (): Promise<RssSourceSnapshot> => this.dependencies.readSource(subscriptionId));
  }

  reconcileEntryOriginal(expected: RssOriginalMutationIdentity, binding: RssRouteBinding<RssEntrySnapshot>, subscriptionId: string, guid: string): void {
    this.reconcileOriginal(this.entry(subscriptionId, guid), expected, binding,
      (): Promise<RssEntrySnapshot> => this.dependencies.readEntry(subscriptionId, guid));
  }

  continueEntryOriginal(expected: RssOriginalMutationIdentity, binding: RssRouteBinding<RssEntrySnapshot>): void {
    if (expected.scope!=='entry') return;
    const state=this.entry(expected.subscriptionId,expected.guid);
    this.enqueue(state,binding,async (): Promise<void> => {
      const result=await this.dependencies.gateway.recoverOriginalRss((): boolean => this.admitted(binding),expected,true);
      if (result.original!==undefined) this.publishOperation(state,binding,'original-recovery',expected.subscriptionId,expected.guid,
        result.original.confirmation,'reading',result.original.message);
      await this.read(state,binding,(): Promise<RssEntrySnapshot> => this.dependencies.readEntry(expected.subscriptionId,expected.guid));
    });
  }

  retrySourceRead(subscriptionId: string, expected: OperationFacts<RssSourceSnapshot>, binding: RssRouteBinding<RssSourceSnapshot>): void {
    this.retryRead(this.source(subscriptionId), expected, binding,
      (): Promise<RssSourceSnapshot> => this.dependencies.readSource(subscriptionId));
  }

  retryEntryRead(subscriptionId: string, guid: string, expected: OperationFacts<RssEntrySnapshot>, binding: RssRouteBinding<RssEntrySnapshot>): void {
    this.retryRead(this.entry(subscriptionId, guid), expected, binding,
      (): Promise<RssEntrySnapshot> => this.dependencies.readEntry(subscriptionId, guid));
  }

  private reconcile<T>(state: RssRouteState<T>, expected: RssRouteOperationProjection<T>, binding: RssRouteBinding<T>, reader: () => Promise<T>): void {
    this.enqueue(state, binding, async (): Promise<void> => {
      const current = state.operation;
      if (current === undefined || current.projection.facts.generation !== expected.projection.facts.generation || !current.projection.facts.canRetry) return;
      if (current.original!==undefined) {
        const result=await this.dependencies.gateway.recoverOriginalRss((): boolean => this.admitted(binding),current.original);
        if (result.original?.operationId===current.original.operationId && result.original.scope==='entry' &&
          result.original.subscriptionId===current.subscriptionId && result.original.guid===current.guid)
          this.publishOperation(state,binding,'original-recovery',current.subscriptionId,current.guid,result.original.confirmation,'reading');
      }
      await this.read(state, binding, reader);
    });
  }

  private retryRead<T>(state: RssRouteState<T>, expected: OperationFacts<T>, binding: RssRouteBinding<T>, reader: () => Promise<T>): void {
    this.enqueue(state, binding, async (): Promise<void> => {
      if (state.read.generation !== expected.generation || !state.read.canRetry) return;
      await this.read(state, binding, reader);
    });
  }

  private reconcileOriginal<T>(state: RssRouteState<T>, expected: RssOriginalMutationIdentity,
    binding: RssRouteBinding<T>, reader: () => Promise<T>): void {
    this.enqueue(state, binding, async (): Promise<void> => {
      // A pure original query does not depend on a fabricated entity receipt
      // or its ordinary retry eligibility. The captured physical identity does.
      if (!this.dependencies.gateway.isOriginalMutationCurrent(expected)) return;
      await this.read(state, binding, reader, expected);
    });
  }

  private async write<T>(state: RssRouteState<T>, binding: RssRouteBinding<T>, action: string,
    subscriptionId: string, guid: string, mutation: () => Promise<void>, reader: () => Promise<T>): Promise<void> {
    if (!this.admitted(binding)) return;
    // Without an RSS operation receipt/generation, a matching snapshot cannot
    // prove a lost ACK or exclude an old submitted mutation committing later.
    if (state.operation?.projection.receipt.confirmation === 'unknown') { await this.read(state, binding, reader); return; }
    const evidence = new ReaderWriteEvidence();
    this.dependencies.gateway.observeWrites(evidence, (): boolean => this.admitted(binding));
    this.publishOperation(state, binding, action, subscriptionId, guid, 'undispatched', 'reading');
    try {
      await this.dependencies.mutate(mutation, (): boolean => this.admitted(binding));
    } catch (error) {
      this.publishOperation(state, binding, action, subscriptionId, guid, evidence.confirmation(), 'failed', (error as Error).message);
      if (evidence.confirmation() === 'undispatched') this.reportFailure(binding, error as Error);
      if (this.dependencies.gateway.originalMutationSnapshot()!==undefined) await this.read(state,binding,reader);
      return;
    } finally { this.dependencies.gateway.observeWrites(undefined); }
    // A dispatched write settles in this owner regardless of route retirement.
    // The binding guards only UI delivery; it cannot cancel or erase durability.
    this.publishOperation(state, binding, action, subscriptionId, guid, evidence.confirmation(), 'reading');
    await this.read(state, binding, reader);
  }

  private async read<T>(state: RssRouteState<T>, binding: RssRouteBinding<T>, reader: () => Promise<T>, expectedOriginal?: RssOriginalMutationIdentity): Promise<void> {
    if (!this.ownsRuntime()) return;
    const recovery=await this.dependencies.gateway.recoverOriginalRss((): boolean => this.admitted(binding), expectedOriginal, false, true);
    this.deliver(binding, (): void => binding.emitOriginal?.(recovery.original));
    if (!this.admitted(binding)) return;
    const original=recovery.original,operation=state.operation;
    if (original!==undefined && operation!==undefined && original.scope==='entry' &&
      original.subscriptionId===operation.subscriptionId && original.guid===operation.guid &&
      (operation.original===undefined || operation.original.operationId===original.operationId))
      this.publishOperation(state,binding,'original-recovery',operation.subscriptionId,operation.guid,original.confirmation,'reading',original.message);
    this.publishRead(state, binding, 'loading');
    this.updateReadback(state, binding, 'reading');
    try {
      const value = await reader();
      if (!this.ownsRuntime()) return;
      state.value = value;
      this.publishRead(state, binding, 'succeeded');
      this.updateReadback(state, binding, 'succeeded');
      this.deliver(binding, (): void => binding.emit(value));
    } catch (error) {
      if (!this.ownsRuntime()) return;
      this.publishRead(state, binding, 'failed', (error as Error).message);
      this.updateReadback(state, binding, 'failed', (error as Error).message);
      this.reportFailure(binding, error as Error);
    }
  }

  private updateReadback<T>(state: RssRouteState<T>, binding: RssRouteBinding<T>, phase: 'reading' | 'failed' | 'succeeded', message?: string): void {
    const operation = state.operation;
    if (operation !== undefined) this.publishOperation(state, binding, operation.action, operation.subscriptionId, operation.guid,
      operation.projection.receipt.confirmation, phase, message);
  }

  private publishRead<T>(state: RssRouteState<T>, binding: RssRouteBinding<T>, phase: 'loading' | 'failed' | 'succeeded', message?: string): void {
    state.read = projectOperationFacts<T>({ phase, value: state.value, canRetry: phase === 'failed',
      generation: ++routeFactGeneration, message });
    this.deliver(binding, (): void => binding.emitRead?.(state.read));
  }

  private publishOperation<T>(state: RssRouteState<T>, binding: RssRouteBinding<T>, action: string, subscriptionId: string,
    guid: string, confirmation: CommitConfirmationKind, readback: 'reading' | 'failed' | 'succeeded', refreshError?: string): void {
    const operation: RssRouteOperationProjection<T> = { action, subscriptionId, guid,
      original:this.dependencies.gateway.originalMutationSnapshot(),
      projection: projectPersistedReceipt<T>({ confirmation, readback, value: state.value, refreshError,
        stale: readback === 'failed', canRetry: confirmation !== 'undispatched' && readback !== 'reading' &&
          (readback === 'failed' || confirmation === 'unknown'), generation: ++routeFactGeneration }) };
    state.operation = operation;
    this.deliver(binding, (): void => binding.emitOperation?.(operation));
  }

  private reportFailure<T>(binding: RssRouteBinding<T>, error: Error): void {
    // Legacy callers retain their failure callback. Projected consumers receive
    // the independent facts instead of collapsing a confirmed write to failure.
    if (binding.emitRead === undefined && binding.emitOperation === undefined) this.deliver(binding, (): void => binding.failed(error));
  }

  private enqueue<T>(state: RssRouteState<T>, binding: RssRouteBinding<T>, work: () => Promise<void>): void {
    if (!this.admitted(binding)) return;
    state.pending += 1;
    this.dependencies.enqueue(async (): Promise<void> => {
      try { if (this.admitted(binding)) await work(); }
      finally { state.pending -= 1; this.releaseSettledSnapshots(this.sources); this.releaseSettledSnapshots(this.entries); }
    });
  }

  private releaseSettledSnapshots<T>(states: Map<string, RssRouteState<T>>): void {
    // Current UI owns its delivered snapshot. Keep at most eight retained
    // settled entity snapshots here; queued jobs and unresolved receipts are
    // never evicted. Unknown receipts retain identity/facts, not every old list.
    const keys = Array.from(states.keys());
    for (let index = 0; index < keys.length - 8; index += 1) {
      const key = keys[index], state = states.get(key);
      if (state === undefined || state.pending > 0) continue;
      const receipt = state.operation?.projection.receipt;
      if (receipt === undefined || receipt.fact === 'confirmedCurrent') { states.delete(key); continue; }
      state.value = undefined;
      state.read = { ...state.read, value: undefined, hasValue: false };
      if (state.operation !== undefined) state.operation = { ...state.operation,
        projection: { ...state.operation.projection, value: undefined, hasValue: false,
          facts: { ...state.operation.projection.facts, value: undefined, hasValue: false } } };
    }
  }

  private deliver<T>(binding: RssRouteBinding<T>, delivery: () => void): void {
    if (!this.admitted(binding)) return;
    try { delivery(); } catch (error) { this.dependencies.deliveryFailed?.(error as Error); }
  }

  private ownsRuntime(): boolean {
    try { return this.dependencies.ownsRuntime(); } catch (_error) { return false; }
  }

  private admitted<T>(binding: RssRouteBinding<T>): boolean {
    try { return this.ownsRuntime() && binding.current(); } catch (_error) { return false; }
  }

  private source(id: string): RssRouteState<RssSourceSnapshot> {
    let state = this.sources.get(id);
    if (state === undefined) { state = new RssRouteState<RssSourceSnapshot>(); this.sources.set(id, state); }
    this.sources.delete(id); this.sources.set(id, state);
    return state;
  }

  private entry(subscriptionId: string, guid: string): RssRouteState<RssEntrySnapshot> {
    const key = JSON.stringify([subscriptionId, guid]);
    let state = this.entries.get(key);
    if (state === undefined) { state = new RssRouteState<RssEntrySnapshot>(); this.entries.set(key, state); }
    this.entries.delete(key); this.entries.set(key, state);
    return state;
  }
}

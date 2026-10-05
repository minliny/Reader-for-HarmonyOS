import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';
import { BookshelfFlowGateway, type BookshelfDataState, type BookshelfFilter, type BookshelfRemovalTarget,
  type BookshelfRemoveOutcome, type BookshelfRemoveBatchOutcome, type BookshelfImportOutcome } from './BookshelfFlowGateway';
import { LocalImportPresentationOwner, type LocalImportPresentation } from './LocalImportPresentationOwner';
import { BookshelfRemovalGateway } from './BookshelfRemovalGateway';
import { BookshelfManagementIntentStore, isBookshelfRemovalMethod, type BookshelfManagementMutationState } from './BookshelfManagementIntentStore';

export interface BookshelfOperationSnapshot {
  generation: number;
  action: 'import' | 'remove';
  filter: BookshelfFilter;
  busy: boolean;
  removalKey: string;
  batchRemovalBusy: boolean;
  reconcileBusy: boolean;
  receipt: PersistedReceiptProjection<BookshelfDataState> | undefined;
  cleanupWarning: string;
  removalMutation?: BookshelfManagementMutationState;
  importPresentation: LocalImportPresentation | undefined;
  importIdentity: number;
  importSerialized: string;
  importFailureMessage: string;
}

export const EMPTY_BOOKSHELF_OPERATION_SNAPSHOT: BookshelfOperationSnapshot = {
  generation: 0, action: 'remove', filter: {readingState: 'all', sourceKind: 'all'}, busy: false, removalKey: '', batchRemovalBusy: false, reconcileBusy: false,
  receipt: undefined, cleanupWarning: '', importPresentation: undefined, importIdentity: 0, importSerialized: '', importFailureMessage: '',
};
let nextOperationGeneration: number = 0;

/** Existing BookshelfHost owns this finite mutation/readback/presentation lane.
 * Leaving a page retires publication into that page; accepted Core work and
 * its mutex/receipt survive until settlement in this exact Runtime owner. */
export class BookshelfOperationOwner {
  private snapshot: BookshelfOperationSnapshot = { ...EMPTY_BOOKSHELF_OPERATION_SNAPSHOT };
  private presentationAdmission: () => boolean = (): boolean => false;
  private presentationInstanceIdentity: number = 0;
  private readonly presentation: LocalImportPresentationOwner = new LocalImportPresentationOwner();

  private readonly subscribers: Set<(snapshot: BookshelfOperationSnapshot) => void> = new Set();
  private readonly authority: BookshelfManagementIntentStore;
  constructor(private readonly owner: ReaderRuntimeOwner) { this.authority = BookshelfManagementIntentStore.forRuntime(owner); }
  subscribe(emit: (snapshot: BookshelfOperationSnapshot) => void): () => void {
    this.subscribers.add(emit);
    return (): void => { this.subscribers.delete(emit); };
  }

  owns(owner: ReaderRuntimeOwner): boolean { return owner === this.owner; }
  current(): BookshelfOperationSnapshot { return this.snapshot; }
  unknown(): boolean { return this.snapshot.receipt?.receipt.confirmation === 'unknown' ||
    this.authority.snapshot().blocked; }
  canMutate(): boolean { return this.liveRuntime() && !this.snapshot.busy && !this.snapshot.reconcileBusy && !this.unknown(); }

  restoreImport(serialized: string, admitted: () => boolean, instanceIdentity: number = 0): void {
    if (!this.admitImportPresentation(admitted, instanceIdentity)) return;
    this.presentationAdmission = admitted; this.presentation.restore(serialized); this.publishPresentation();
  }
  openImport(admitted: () => boolean, instanceIdentity: number = 0): void {
    if (!this.admitImportPresentation(admitted, instanceIdentity)) return;
    this.presentationAdmission = admitted; this.presentation.open(); this.publishPresentation('');
  }
  closeImport(instanceIdentity: number = 0): void {
    if (!this.isImportPresentationInstance(instanceIdentity)) return;
    this.presentation.close(); this.publishPresentation('');
  }
  isImportPresentationInstance(instanceIdentity: number): boolean {
    return this.liveRuntime() && instanceIdentity === this.presentationInstanceIdentity;
  }
  private admitImportPresentation(admitted: () => boolean, instanceIdentity: number): boolean {
    if (!this.liveRuntime() || !this.admitted(admitted) || !Number.isSafeInteger(instanceIdentity) ||
      instanceIdentity < this.presentationInstanceIdentity) return false;
    // Index already supplies a monotonic instance identity. A late older
    // adapter cannot replace the current lease even while its route is live.
    this.presentationInstanceIdentity = instanceIdentity; return true;
  }

  async remove(targets: BookshelfRemovalTarget[], batch: boolean, filter: BookshelfFilter, admitted: () => boolean):
    Promise<BookshelfRemoveOutcome | BookshelfRemoveBatchOutcome | undefined> {
    if (!this.canMutate() || !this.admitted(admitted) || targets.length === 0) return undefined;
    const generation = this.begin('remove', filter);
    this.snapshot = { ...this.snapshot, removalKey: batch ? '' : JSON.stringify([targets[0].sourceId, targets[0].bookId]), batchRemovalBusy: batch };
    this.publish();
    try {
      const gateway = new BookshelfFlowGateway(this.owner, filter);
      const outcome = batch ? await gateway.removeMany(targets) : await gateway.remove(targets[0].sourceId, targets[0].bookId);
      this.receipt(outcome.receipt, generation, outcome.cleanupWarning);
      this.snapshot = { ...this.snapshot, removalMutation: this.authority.snapshot() };
      return outcome;
    } finally { this.finish(generation); }
  }

  async importFiles(filter: BookshelfFilter, admitted: () => boolean): Promise<BookshelfImportOutcome | undefined> {
    if (!this.canMutate() || !this.admitted(admitted) || this.presentation.current()?.state !== 'fileSelection') return undefined;
    const identity = this.presentation.generation();
    // Admission belongs to the currently attached presentation of this exact
    // opening. A rebuilt Index may replace that adapter without replacing the
    // accepted task; close/reopen still revokes the captured opening identity.
    const current = (): boolean => this.liveRuntime() && this.presentation.owns(identity) &&
      this.admitted(this.presentationAdmission);
    const callerCurrent = (): boolean => current() && this.admitted(admitted);
    // Cold original delete/group intent is checked before selecting new files;
    // import must not recreate an asset still owned by a retained delete.
    await this.recoverRemoval(filter, callerCurrent);
    if (!this.canMutate() || !callerCurrent() || this.presentation.current()?.state !== 'fileSelection') return undefined;
    const generation = this.begin('import', filter);
    this.presentation.write(identity, 'pickerOpening'); this.publishPresentation('');
    const gateway = new BookshelfFlowGateway(this.owner, filter);
    const evidence = new ReaderWriteEvidence();
    try {
      const selections = await gateway.selectLocalBookInputs();
      if (!current()) { await gateway.releaseUnusedSelections(selections); return undefined; }
      if (selections.length === 0) { this.presentation.write(identity, 'fileSelection'); this.publishPresentation(); return undefined; }
      this.presentation.write(identity, 'importing'); this.publishPresentation();
      const outcome = await gateway.importPreparedSelections(selections, (): void => evidence.dispatched());
      this.receipt({ receipt: outcome.readback, facts: outcome.operation, value: outcome.shelf,
        hasValue: outcome.shelf !== undefined, refreshError: outcome.refreshWarning }, generation);
      if (current()) {
        this.presentation.write(identity, outcome.batch.state === 'cancelled' ? 'fileSelection' : 'result', outcome.batch);
        this.publishPresentation(outcome.refreshWarning ?? '');
      }
      return outcome;
    } catch (error) {
      // Only the gateway's actual import.persist invocation marks dispatch.
      // A generic throw never proves a mutation was not executed.
      if (evidence.confirmation() === 'unknown') this.receipt(projectPersistedReceipt({ confirmation: 'unknown', readback: 'idle',
        generation, canRetry: true, message: '导入结果待核对；已成功保存的书籍会保留' }), generation);
      if (current()) {
        this.presentation.write(identity, 'fileSelection');
        this.publishPresentation(evidence.confirmation() === 'unknown' ? '导入结果待核对；已成功保存的书籍会保留' :
          '导入未完成，请重试；已成功保存的书籍会保留');
      }
      return undefined;
    } finally { this.finish(generation); }
  }

  async reconcile(generation: number, filter: BookshelfFilter, admitted: () => boolean):
    Promise<PersistedReceiptProjection<BookshelfDataState> | undefined> {
    const receipt = this.snapshot.receipt;
    if (!this.liveRuntime() || !this.admitted(admitted) || receipt === undefined || this.snapshot.generation !== generation ||
      (!receipt.facts.canRetry && !this.snapshot.removalMutation?.blocked) || this.snapshot.busy || this.snapshot.reconcileBusy) return undefined;
    this.snapshot = { ...this.snapshot, reconcileBusy: true,
      receipt: projectPersistedReceipt({ confirmation: receipt.receipt.confirmation, readback: 'reading', value: receipt.value, generation, canRetry: false }) };
    this.publish();
    const current = (): boolean => this.liveRuntime() && this.snapshot.generation === generation && this.admitted(admitted);
    try {
      let original = receipt;
      if (this.snapshot.action === 'remove') {
        try {
          const state = await new BookshelfRemovalGateway(this.owner).recover(current);
          this.snapshot = { ...this.snapshot, removalMutation: state };
          if (isBookshelfRemovalMethod(state.method)) original = projectPersistedReceipt({
            confirmation: state.confirmation, readback: 'idle', value: receipt.value, generation,
            canRetry: state.blocked || state.confirmation === 'unknown', message: state.message || undefined });
        } catch (error) {
          this.snapshot = { ...this.snapshot, removalMutation: this.authority.snapshot() };
          original = projectPersistedReceipt({ confirmation: this.snapshot.removalMutation!.confirmation,
            readback: 'idle', value: receipt.value, generation, canRetry: true, message: (error as Error).message });
        }
      }
      const read = await new BookshelfFlowGateway(this.owner, filter).reconcile(original, generation, current);
      if (!current()) return undefined;
      this.snapshot = { ...this.snapshot, receipt: read, filter: { ...filter },
        importFailureMessage: this.snapshot.action === 'import' ? read.refreshError ?? '' : this.snapshot.importFailureMessage };
      return read;
    } finally {
      if (this.snapshot.generation === generation) {
        this.snapshot = { ...this.snapshot, reconcileBusy: false, receipt: current() ? this.snapshot.receipt : receipt };
        this.publish();
      }
    }
  }

  /** Mount/open reconciliation is only a historical query and current list
   * read. It cannot apply a deletion or release a local asset. */
  async recoverRemoval(filter: BookshelfFilter, admitted: () => boolean): Promise<void> {
    if (!this.liveRuntime() || !this.admitted(admitted) || this.snapshot.busy || this.snapshot.reconcileBusy) return;
    this.snapshot = { ...this.snapshot, reconcileBusy: true }; this.publish();
    try {
      let state: BookshelfManagementMutationState;
      try { state = await new BookshelfRemovalGateway(this.owner).recover(admitted); }
      catch (_) { state = this.authority.snapshot(); }
      if (!this.liveRuntime() || !this.admitted(admitted)) return;
      this.snapshot = { ...this.snapshot, removalMutation: state };
      if (!isBookshelfRemovalMethod(state.method) || state.operationId === undefined || this.authority.original() === undefined) return;
      const generation = this.snapshot.action === 'remove' && this.snapshot.receipt !== undefined ? this.snapshot.generation : ++nextOperationGeneration;
      const original = projectPersistedReceipt<BookshelfDataState>({ confirmation: state.confirmation, readback: 'idle',
        generation, canRetry: state.blocked || state.confirmation === 'unknown', message: state.message || undefined });
      const current = (): boolean => this.liveRuntime() && this.admitted(admitted);
      const read = await new BookshelfFlowGateway(this.owner, filter).reconcile(original, generation, current);
      if (!current()) return;
      this.snapshot = { ...this.snapshot, action: 'remove', generation, filter: { ...filter }, receipt: read };
    } finally { this.snapshot = { ...this.snapshot, reconcileBusy: false }; this.publish(); }
  }

  async continueRemoval(generation: number, filter: BookshelfFilter, admitted: () => boolean):
    Promise<PersistedReceiptProjection<BookshelfDataState> | undefined> {
    const state = this.snapshot.removalMutation;
    if (!this.liveRuntime() || !this.admitted(admitted) || this.snapshot.busy || this.snapshot.reconcileBusy ||
      generation !== this.snapshot.generation || !isBookshelfRemovalMethod(state?.method) || !state?.canContinueOriginal) return undefined;
    const previous = this.snapshot.receipt;
    this.snapshot = { ...this.snapshot, busy: true }; this.publish();
    const current = (): boolean => this.liveRuntime() && this.admitted(admitted) && this.snapshot.generation === generation;
    try {
      let next: BookshelfManagementMutationState;
      try { next = await new BookshelfRemovalGateway(this.owner).recover(current, true); }
      catch (_) { next = this.authority.snapshot(); }
      this.snapshot = { ...this.snapshot, removalMutation: next };
      const original = projectPersistedReceipt<BookshelfDataState>({ confirmation: next.confirmation,
        readback: 'idle', value: previous?.value, generation, canRetry: next.blocked, message: next.message || undefined });
      const read = await new BookshelfFlowGateway(this.owner, filter).reconcile(original, generation, current);
      this.receipt(read, generation); return current() ? read : undefined;
    } finally { this.finish(generation); }
  }

  private begin(action: 'import' | 'remove', filter: BookshelfFilter): number {
    const generation = ++nextOperationGeneration;
    this.snapshot = { ...this.snapshot, generation, action, filter: { ...filter }, busy: true, receipt: undefined, cleanupWarning: '', reconcileBusy: false };
    // State/mutex changes precede callbacks: synchronous publication reentry
    // cannot dispatch a second write before the first promise exists.
    this.publish(); return generation;
  }
  private receipt(receipt: PersistedReceiptProjection<BookshelfDataState>, generation: number, cleanupWarning?: string): void {
    if (this.snapshot.generation !== generation) return;
    this.snapshot = { ...this.snapshot, receipt: { ...receipt, facts: { ...receipt.facts, generation } }, cleanupWarning: cleanupWarning ?? '' };
    this.publish();
  }
  private finish(generation: number): void {
    if (this.snapshot.generation !== generation) return;
    this.snapshot = { ...this.snapshot, busy: false, removalKey: '', batchRemovalBusy: false };
    this.publish();
  }
  private publishPresentation(failureMessage?: string): void {
    this.snapshot = { ...this.snapshot, importPresentation: this.presentation.current(), importIdentity: this.presentation.generation(),
      importSerialized: this.presentation.serialized(), importFailureMessage: failureMessage ?? this.snapshot.importFailureMessage };
    this.publish();
  }
  private liveRuntime(): boolean { return ReaderRuntimeOwner.isCurrent(this.owner); }
  private admitted(current: () => boolean): boolean { try { return current(); } catch (_) { return false; } }
  private publish(): void {
    if (!this.liveRuntime()) return;
    // The UI/diagnostic adapter cannot turn a validated write into failure.
    for (const emit of this.subscribers) { try { emit(this.snapshot); } catch (_) {} }
  }
}

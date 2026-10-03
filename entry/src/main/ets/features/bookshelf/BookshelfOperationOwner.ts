import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';
import { BookshelfFlowGateway, type BookshelfDataState, type BookshelfFilter, type BookshelfRemovalTarget,
  type BookshelfRemoveOutcome, type BookshelfRemoveBatchOutcome, type BookshelfImportOutcome } from './BookshelfFlowGateway';
import { LocalImportPresentationOwner, type LocalImportPresentation } from './LocalImportPresentationOwner';

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
  private readonly presentation: LocalImportPresentationOwner = new LocalImportPresentationOwner();

  private readonly subscribers: Set<(snapshot: BookshelfOperationSnapshot) => void> = new Set();
  constructor(private readonly owner: ReaderRuntimeOwner) {}
  subscribe(emit: (snapshot: BookshelfOperationSnapshot) => void): () => void {
    this.subscribers.add(emit);
    return (): void => { this.subscribers.delete(emit); };
  }

  owns(owner: ReaderRuntimeOwner): boolean { return owner === this.owner; }
  current(): BookshelfOperationSnapshot { return this.snapshot; }
  unknown(): boolean { return this.snapshot.receipt?.receipt.confirmation === 'unknown'; }
  canMutate(): boolean { return this.liveRuntime() && !this.snapshot.busy && !this.snapshot.reconcileBusy && !this.unknown(); }

  restoreImport(serialized: string, admitted: () => boolean): void { this.presentationAdmission = admitted; this.presentation.restore(serialized); this.publishPresentation(); }
  openImport(admitted: () => boolean): void { if (!this.liveRuntime() || !this.admitted(admitted)) return; this.presentationAdmission = admitted; this.presentation.open(); this.publishPresentation(''); }
  closeImport(): void { this.presentation.close(); this.publishPresentation(''); }

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
      return outcome;
    } finally { this.finish(generation); }
  }

  async importFiles(filter: BookshelfFilter, admitted: () => boolean): Promise<BookshelfImportOutcome | undefined> {
    if (!this.canMutate() || !this.admitted(admitted) || this.presentation.current()?.state !== 'fileSelection') return undefined;
    const identity = this.presentation.generation();
    const current = (): boolean => this.liveRuntime() && this.presentation.owns(identity) && this.admitted(this.presentationAdmission);
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
      !receipt.facts.canRetry || this.snapshot.busy || this.snapshot.reconcileBusy) return undefined;
    this.snapshot = { ...this.snapshot, reconcileBusy: true,
      receipt: projectPersistedReceipt({ confirmation: receipt.receipt.confirmation, readback: 'reading', value: receipt.value, generation, canRetry: false }) };
    this.publish();
    const current = (): boolean => this.liveRuntime() && this.snapshot.generation === generation && this.admitted(admitted);
    try {
      const read = await new BookshelfFlowGateway(this.owner, filter).reconcile(receipt, generation, current);
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

import { WebDavCredentialStore } from '../sync/WebDavCredentialStore';
import { ReaderThemeHost } from '../../app/ReaderThemeHost';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { errorMessageOf } from '../../app/ErrorMessage';
import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';

export type BookshelfViewMode = 'cover' | 'list';
export interface BookshelfViewModeSnapshot {
  canonical: BookshelfViewMode | undefined;
  receipt?: PersistedReceiptProjection<BookshelfViewMode>;
  readFacts?: OperationFacts<BookshelfViewMode>;
}
let bookshelfModeGeneration: number = 0;

/** One feature owner shared by both mode consumers. Motion remains page-owned;
 * this owns only the existing local preference's ACK and canonical readback. */
export class BookshelfViewModeHost {
  static readonly instance: BookshelfViewModeHost = new BookshelfViewModeHost();
  private readonly store: WebDavCredentialStore;
  private readonly prepare: () => Promise<void>;
  private snapshot: BookshelfViewModeSnapshot = { canonical: undefined };
  private revision: number = 0;
  private reconcileBusy: boolean = false;
  private writeTail: Promise<void> = Promise.resolve();
  private pendingWrite: Promise<BookshelfViewModeSnapshot | undefined> | undefined;

  constructor(store: WebDavCredentialStore = WebDavCredentialStore.instance,
    prepare: () => Promise<void> = (): Promise<void> => ReaderThemeHost.prepareUserChange()) {
    this.store = store;
    this.prepare = prepare;
  }

  current(): BookshelfViewModeSnapshot { return this.snapshot; }
  canSave(): boolean { return this.snapshot.receipt?.receipt.confirmation !== 'unknown'; }

  async load(isCurrent: () => boolean): Promise<BookshelfViewModeSnapshot | undefined> {
    const pending = this.pendingWrite;
    if (pending !== undefined) await pending;
    if (!isCurrent()) return undefined;
    if (this.snapshot.receipt?.receipt.confirmation === 'unknown') {
      return this.reconcile(this.snapshot.receipt.facts.generation, isCurrent);
    }
    const generation = ++bookshelfModeGeneration;
    const revision = ++this.revision;
    let owner: ReaderRuntimeOwner;
    try { owner = ReaderRuntimeOwner.current(); } catch (_) { return undefined; }
    const context = this.store.bookshelfModeContextGeneration();
    const current = (): boolean => revision === this.revision && ReaderRuntimeOwner.isCurrent(owner) &&
      context === this.store.bookshelfModeContextGeneration() && isCurrent();
    try {
      const value = await this.store.loadBookshelfViewMode();
      if (!current()) return undefined;
      this.snapshot = { canonical: value, readFacts: projectOperationFacts({ phase: 'succeeded', value, generation }) };
    } catch (error) {
      if (!current()) return undefined;
      this.snapshot = { canonical: this.snapshot.canonical,
        readFacts: projectOperationFacts({ phase: 'failed', value: this.snapshot.canonical,
          canRetry: true, generation, message: errorMessageOf(error) }) };
    }
    return this.snapshot;
  }

  save(mode: BookshelfViewMode, isCurrent: () => boolean): Promise<BookshelfViewModeSnapshot | undefined> {
    if (!this.canSave()) return Promise.resolve(this.snapshot);
    const revision = ++this.revision;
    let owner: ReaderRuntimeOwner;
    try { owner = ReaderRuntimeOwner.current(); } catch (_) { return Promise.resolve(undefined); }
    const context = this.store.bookshelfModeContextGeneration();
    const work = this.writeTail.then((): Promise<BookshelfViewModeSnapshot | undefined> =>
      this.performSave(mode, revision, owner, context, isCurrent));
    this.pendingWrite = work;
    this.writeTail = work.then((): void => {}, (): void => {});
    const release = (): void => { if (this.pendingWrite === work) this.pendingWrite = undefined; };
    void work.then(release, release);
    return work;
  }

  private async performSave(mode: BookshelfViewMode, revision: number, owner: ReaderRuntimeOwner,
    context: number, isCurrent: () => boolean): Promise<BookshelfViewModeSnapshot | undefined> {
    if (!this.canSave()) return this.snapshot;
    const generation = ++bookshelfModeGeneration;
    const owns = (): boolean => ReaderRuntimeOwner.isCurrent(owner) &&
      context === this.store.bookshelfModeContextGeneration();
    const admitted = (): boolean => owns() && revision === this.revision && isCurrent();
    const evidence = new ReaderWriteEvidence();
    let canonical = this.store.currentBookshelfViewMode() ?? this.snapshot.canonical;
    let writeError: string | undefined;
    try {
      await this.prepare();
      if (!admitted()) return undefined;
      canonical = await this.store.loadBookshelfViewMode();
      if (!admitted()) return undefined;
      await this.store.saveBookshelfViewMode(mode, undefined, evidence, admitted);
    } catch (error) { writeError = errorMessageOf(error); }
    if (!owns()) {
      if (evidence.confirmation() === 'unknown') {
        // Retain the feature's unresolved write fact across runtime/context
        // replacement, without delivering the old owner's value into its UI.
        this.snapshot = { canonical: undefined, receipt: projectPersistedReceipt({ confirmation: 'unknown',
          readback: 'idle', canRetry: true, generation }) };
      }
      return undefined;
    }
    if (evidence.confirmation() === 'confirmed') canonical = mode;
    // The dispatched task may settle after its page closes. Keep its true
    // receipt here for the other consumer/reopen; page delivery still guards.
    let readback: 'succeeded' | 'failed' = 'failed';
    let refreshError: string | undefined;
    try { canonical = await this.store.loadBookshelfViewMode(false); readback = 'succeeded'; }
    catch (error) { refreshError = errorMessageOf(error); }
    if (!owns()) return undefined;
    const result: BookshelfViewModeSnapshot = { canonical,
      receipt: projectPersistedReceipt({ confirmation: evidence.confirmation(), readback, value: canonical,
        refreshError, canRetry: evidence.confirmation() !== 'undispatched' || readback === 'failed', generation,
        blockedReason: writeError === 'BOOKSHELF_RESTORE_PENDING' ? writeError : undefined }) };
    if (revision === this.revision || evidence.confirmation() === 'unknown') this.snapshot = result;
    return result;
  }

  async reconcile(generation: number, isCurrent: () => boolean): Promise<BookshelfViewModeSnapshot | undefined> {
    const receipt = this.snapshot.receipt;
    const read = this.snapshot.readFacts;
    if (this.pendingWrite !== undefined || this.reconcileBusy || !isCurrent() || (receipt?.facts.generation ?? read?.generation) !== generation ||
      !(receipt?.facts.canRetry ?? read?.canRetry)) return undefined;
    this.reconcileBusy = true;
    const revision = this.revision;
    let owner: ReaderRuntimeOwner;
    try { owner = ReaderRuntimeOwner.current(); } catch (_) { this.reconcileBusy = false; return undefined; }
    const context = this.store.bookshelfModeContextGeneration();
    const current = (): boolean => revision === this.revision && ReaderRuntimeOwner.isCurrent(owner) &&
      context === this.store.bookshelfModeContextGeneration() && isCurrent();
    let canonical = this.snapshot.canonical;
    let refreshError: string | undefined;
    try { canonical = await this.store.loadBookshelfViewMode(false); }
    catch (error) { refreshError = errorMessageOf(error); }
    finally { this.reconcileBusy = false; }
    if (!current()) return undefined;
    const nextGeneration = ++bookshelfModeGeneration;
    this.snapshot = receipt === undefined ? { canonical,
      readFacts: projectOperationFacts({ phase: refreshError === undefined ? 'succeeded' : 'failed', value: canonical,
        generation: nextGeneration, canRetry: refreshError !== undefined, message: refreshError }) } : { canonical,
      receipt: projectPersistedReceipt({ confirmation: receipt.receipt.confirmation,
        readback: refreshError === undefined ? 'succeeded' : 'failed', value: canonical, refreshError,
        canRetry: receipt.receipt.confirmation === 'unknown' || refreshError !== undefined, generation: nextGeneration,
        blockedReason: receipt.facts.blockedReason }) };
    return this.snapshot;
  }
}

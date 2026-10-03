import {
  type BookshelfState,
  type BookshelfListParams,
  ReaderCoreGateway,
  type ShelfBook,
  type BookshelfRemoveBatchReceipt,
} from '../../app/ReaderCoreGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { CommitReadbackSummary, OperationFacts } from '../../app/ReaderOperationFacts';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { errorMessageOf } from '../../app/ErrorMessage';
import {
  type LocalImportBatch,
  LocalBookImportGateway,
} from './LocalBookImportGateway';
import type { LocalBookPreparation } from '../../app/ReaderHostRegistry';

/**
 * Plain page data only. `empty` and `populated` are the two mutually
 * exclusive bookshelf facts derived from the restored Core state; neither
 * value carries a layout or presentation decision.
 */
export type BookshelfFilter = { readingState: string; sourceKind: string };
export const BOOKSHELF_PAGE_SIZE = 48;

export type BookshelfDataState =
  | { kind: 'empty'; shelf: BookshelfState; continueReading: undefined }
  | { kind: 'populated'; shelf: BookshelfState; continueReading: ShelfBook | undefined };

/**
 * A completed import batch and its follow-up shelf read-back are two separate
 * facts. `shelf` is undefined when the follow-up shelf read failed;
 * `readback` preserves whether the batch was confirmed, pending
 * reconciliation, or never dispatched, and `refreshWarning` carries the
 * human-readable read-back cause. A committed batch is never reclassified as
 * an import failure merely because the refresh rejected.
 */
export type BookshelfImportOutcome = {
  batch: LocalImportBatch;
  shelf: BookshelfDataState | undefined;
  readback: CommitReadbackSummary;
  operation: OperationFacts<BookshelfDataState>;
  refreshWarning?: string;
};

/**
 * Derive the write fact from the Core-owned per-file batch before looking at
 * the follow-up shelf read. A cancelled or all-rejected batch did not prove a
 * durable write; a recovery-pending item means the reply for a mutation was
 * lost and must remain pending reconciliation. A successful item is enough
 * to confirm the batch even when another item failed deterministically.
 */
function importConfirmation(batch: LocalImportBatch): 'confirmed' | 'unknown' | 'undispatched' {
  if (batch.state === 'cancelled') return 'undispatched';
  if (batch.items.some((item): boolean => item.failure?.code === 'recoveryPending')) return 'unknown';
  if (batch.imported > 0) return 'confirmed';
  return 'undispatched';
}

export type BookshelfRemoveOutcome = {
  removed: boolean;
  shelf: BookshelfDataState | undefined;
  receipt: PersistedReceiptProjection<BookshelfDataState>;
  /** Core ACK and retained-file cleanup are independent facts. */
  cleanupWarning?: string;
};

export interface BookshelfRemovalTarget {
  sourceId: string;
  bookId: string;
}

export type BookshelfRemoveBatchOutcome = {
  removedCount: number;
  shelf: BookshelfDataState | undefined;
  receipt: PersistedReceiptProjection<BookshelfDataState>;
  cleanupWarning?: string;
};

/**
 * Keeps the bookshelf page on plain state and user-intent boundaries. It is
 * deliberately a feature-local gateway rather than a reusable page engine.
 */
export class BookshelfFlowGateway {
  private readonly bookshelf: ReaderCoreGateway;
  private readonly localImport: LocalBookImportGateway;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
    private readonly filter: BookshelfFilter = { readingState: 'all', sourceKind: 'all' },
    private readonly background: boolean = false) {
    this.bookshelf = new ReaderCoreGateway(runtimeOwner);
    this.localImport = new LocalBookImportGateway(runtimeOwner);
  }

  async load(isCurrent?: () => boolean): Promise<BookshelfDataState> {
    if (!this.bookshelf.supportsShelfPages()) {
      const shelf = await this.bookshelf.loadBookshelf({ sortBy: 'lastReadAt', sortDirection: 'descending' }, isCurrent);
      return this.classify(shelf, shelf.books.find((book: ShelfBook): boolean => book.currentChapterIndex !== undefined));
    }
    if (this.filter.readingState === 'all' && this.filter.sourceKind === 'all') {
      const shelf = await this.loadPage(0, undefined, false, isCurrent);
      // Both Core projections use lastReadAt descending and the same
      // composite-key tie break. readingPosition proves a progress record;
      // currentChapterIndex alone can also come from legacy catalog metadata.
      // An earlier ambiguous row must keep the global summary path. Keep a
      // proven card in this snapshot so no late header moves a book under a tap.
      const candidate = shelf.books.find((book: ShelfBook): boolean =>
        book.currentChapterIndex !== undefined || book.readingPosition !== undefined);
      if (candidate?.readingPosition !== undefined) {
        return this.classify(shelf, candidate);
      }
      if (candidate === undefined && shelf.books.length >= shelf.total) {
        return this.classify(shelf, undefined);
      }
      // A truncated prefix or ambiguous catalog-only position cannot establish
      // the global record. Retain its summary instead of silently dropping it.
      return this.classify(shelf, await this.bookshelf.loadContinueReading(isCurrent));
    }
    // A filtered page cannot establish the global continue-reading book.
    // Keep both requests concurrent and publish their original stable header.
    const results = await Promise.all([this.loadPage(0, undefined, false, isCurrent), this.bookshelf.loadContinueReading(isCurrent)]);
    return this.classify(results[0], results[1]);
  }

  async loadPage(offset: number, projectionRevision?: string, membershipOnly: boolean = false, isCurrent?: () => boolean): Promise<BookshelfState> {
    const params: BookshelfListParams = { pageProjection: true, membershipOnly,
      sortBy: 'lastReadAt', sortDirection: 'descending', limit: BOOKSHELF_PAGE_SIZE, offset,
      readingState: membershipOnly ? 'all' : this.filter.readingState,
      sourceKind: membershipOnly ? 'all' : this.filter.sourceKind };
    if (projectionRevision !== undefined) params.projectionRevision = projectionRevision;
    const page = await this.bookshelf.loadBookshelf(params, isCurrent, this.background);
    if (offset === 0 && page.changed) throw new Error('BOOKSHELF_PROJECTION_CHANGED');
    return page;
  }

  /** Resolve a deep position in SQLite; never load the prefix into ArkUI. */
  async loadAnchor(anchor: BookshelfRemovalTarget, fallbackOffset: number,
    isCurrent: () => boolean): Promise<BookshelfState | undefined> {
    if (!isCurrent()) return undefined;
    if (!this.bookshelf.supportsShelfAnchorPages()) return this.loadPage(0, undefined, false, isCurrent);
    const page = await this.bookshelf.loadBookshelf({ pageProjection: true, anchor,
      sortBy: 'lastReadAt', sortDirection: 'descending', limit: BOOKSHELF_PAGE_SIZE,
      offset: fallbackOffset, readingState: this.filter.readingState, sourceKind: this.filter.sourceKind }, isCurrent);
    if (!isCurrent()) return undefined;
    if (page.changed) throw new Error('BOOKSHELF_PROJECTION_CHANGED');
    return page;
  }

  async extendPage(initial: BookshelfState, minimumCount: number, isCurrent: () => boolean): Promise<BookshelfState | undefined> {
    let snapshot = initial;
    const identities = new Set(snapshot.books.map((book: ShelfBook): string => JSON.stringify([book.sourceId, book.bookId])));
    while (snapshot.projectionRevision !== undefined && snapshot.books.length < Math.min(minimumCount, snapshot.total)) {
      if (!isCurrent()) return undefined;
      const page = await this.loadPage(snapshot.books.length, snapshot.projectionRevision, false, isCurrent);
      if (!isCurrent()) return undefined;
      if (page.changed || page.projectionRevision !== snapshot.projectionRevision || page.total !== snapshot.total || page.books.length === 0)
        throw new Error('BOOKSHELF_PROJECTION_CHANGED');
      for (const book of page.books) {
        const key = JSON.stringify([book.sourceId, book.bookId]);
        if (identities.has(key)) throw new Error('BOOKSHELF_PAGE_DUPLICATE');
        identities.add(key);
      }
      snapshot = { books: snapshot.books.concat(page.books), total: page.total,
        unfilteredOnlineTotal: page.unfilteredOnlineTotal, unfilteredTotal: page.unfilteredTotal, projectionRevision: page.projectionRevision };
    }
    return isCurrent() ? snapshot : undefined;
  }

  /** Explicit management/search work, never a reading-entry prerequisite.
   * Publish only a complete single-revision set. Do not splice changed pages. */
  async loadAll(isCurrent: () => boolean, membershipOnly: boolean = false): Promise<BookshelfState | undefined> {
    if (!this.bookshelf.supportsShelfPages()) {
      const shelf = await this.bookshelf.loadBookshelf({ sortBy: 'lastReadAt', sortDirection: 'descending' }, isCurrent, this.background);
      return isCurrent() ? shelf : undefined;
    }
    for (let attempt = 0; attempt < 2 && isCurrent(); attempt += 1) {
      let snapshot: BookshelfState | undefined;
      while (isCurrent()) {
        const page = await this.loadPage(snapshot?.books.length ?? 0, snapshot?.projectionRevision, membershipOnly, isCurrent);
        if (!isCurrent()) return undefined;
        if (page.changed) break;
        if (snapshot === undefined) snapshot = page;
        else {
          if (page.total !== snapshot.total || page.books.length === 0 ||
            page.projectionRevision !== snapshot.projectionRevision) throw new Error('BOOKSHELF_PAGE_INCONSISTENT');
          snapshot = { books: snapshot.books.concat(page.books), total: page.total, unfilteredOnlineTotal: page.unfilteredOnlineTotal, unfilteredTotal: page.unfilteredTotal, projectionRevision: page.projectionRevision };
        }
        if (snapshot.books.length >= snapshot.total) return snapshot;
        await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      }
    }
    if (isCurrent()) throw new Error('BOOKSHELF_PROJECTION_CHANGED');
    return undefined;
  }

  async importFromSystemPicker(): Promise<BookshelfImportOutcome> {
    const selections = await this.localImport.selectLocalBookInputs();
    return this.importPreparedSelections(selections);
  }

  async selectLocalBookInputs(): Promise<LocalBookPreparation[]> {
    return this.localImport.selectLocalBookInputs();
  }

  async releaseUnusedSelections(selections: LocalBookPreparation[]): Promise<void> {
    return this.localImport.releaseUnusedSelections(selections);
  }

  async importPreparedSelections(selections: LocalBookPreparation[], onDispatched?: () => void): Promise<BookshelfImportOutcome> {
    const batch = await this.localImport.importPreparedSelections(selections, onDispatched);
    // Always re-read after the picker returns. A completed batch can upsert an
    // existing book, and a cancelled batch must still expose the restored
    // Core-owned shelf instead of retaining a UI-side copy.
    //
    // The batch is already committed once importPreparedSelections resolves.
    // A shelf-refresh rejection must not reject the whole operation: that
    // would swallow the committed per-file results and present the import as
    // unfinished. Return the batch together with the shared
    // confirmed/refresh-failed projection so the caller can show the durable
    // truth and offer a targeted re-read instead of a file re-selection.
    const confirmation = importConfirmation(batch);
    try {
      const shelf = await this.load();
      const projection = projectPersistedReceipt<BookshelfDataState>({
        confirmation, readback: 'succeeded', value: shelf, canRetry: confirmation === 'unknown',
      });
      return {
        batch,
        shelf,
        readback: projection.receipt,
        operation: projection.facts,
      };
    } catch (error) {
      const cause = errorMessageOf(error);
      const projection = projectPersistedReceipt<BookshelfDataState>({
        confirmation, readback: 'failed', refreshError: cause, canRetry: true,
      });
      return {
        batch,
        shelf: undefined,
        readback: projection.receipt,
        operation: projection.facts,
        refreshWarning: confirmation === 'confirmed' ?
          `导入已确认，书架刷新失败：${cause}` :
          `导入结果${confirmation === 'unknown' ? '待核对' : '未执行'}，书架刷新失败：${cause}`,
      };
    }
  }

  async remove(sourceId: string, bookId: string): Promise<BookshelfRemoveOutcome> {
    const evidence = new ReaderWriteEvidence();
    let removed = false;
    let issue: string | undefined;
    try {
      await this.bookshelf.removeBook(sourceId, bookId, {
        dispatched: (): void => evidence.dispatched(),
        confirmed: (value: boolean): void => { evidence.confirmed(); removed = value; },
        rejectedBeforeExecution: (): void => evidence.rejectedBeforeExecution(),
      });
    } catch (error) { issue = errorMessageOf(error); }
    const receipt = await this.readAfterRemoval(evidence, issue);
    return { removed, shelf: receipt.value, receipt,
      cleanupWarning: evidence.confirmation() === 'confirmed' ? issue : undefined };
  }

  async removeMany(targets: BookshelfRemovalTarget[]): Promise<BookshelfRemoveBatchOutcome> {
    const evidence = new ReaderWriteEvidence();
    let removedCount = 0;
    let issue: string | undefined;
    try {
      await this.bookshelf.removeBooks(targets, {
        dispatched: (): void => evidence.dispatched(),
        confirmed: (value: BookshelfRemoveBatchReceipt): void => {
          evidence.confirmed(); removedCount = value.removedTargets.length;
        },
        rejectedBeforeExecution: (): void => evidence.rejectedBeforeExecution(),
      });
    } catch (error) { issue = errorMessageOf(error); }
    const receipt = await this.readAfterRemoval(evidence, issue);
    return { removedCount, shelf: receipt.value, receipt,
      cleanupWarning: evidence.confirmation() === 'confirmed' ? issue : undefined };
  }

  /** Read only: absence in a later read cannot manufacture a missing ACK. */
  async reconcile(receipt: PersistedReceiptProjection<BookshelfDataState>, generation: number, current?: () => boolean):
    Promise<PersistedReceiptProjection<BookshelfDataState>> {
    try {
      const shelf = await this.load(current);
      return projectPersistedReceipt({ confirmation: receipt.receipt.confirmation,
        readback: 'succeeded', value: shelf, generation,
        canRetry: receipt.receipt.confirmation === 'unknown' });
    } catch (error) {
      return projectPersistedReceipt({ confirmation: receipt.receipt.confirmation,
        readback: 'failed', value: receipt.value, refreshError: errorMessageOf(error),
        generation, canRetry: true });
    }
  }

  private async readAfterRemoval(evidence: ReaderWriteEvidence, issue?: string):
    Promise<PersistedReceiptProjection<BookshelfDataState>> {
    const confirmation = evidence.confirmation();
    try {
      const shelf = await this.load();
      return projectPersistedReceipt({ confirmation, readback: 'succeeded', value: shelf,
        canRetry: confirmation === 'unknown',
        message: confirmation === 'confirmed' || issue === undefined ? undefined :
          `${confirmation === 'unknown' ? '等待核对' : '尚未执行'}：${issue}` });
    } catch (error) {
      return projectPersistedReceipt({ confirmation, readback: 'failed',
        refreshError: errorMessageOf(error), canRetry: true,
        message: confirmation === 'confirmed' || issue === undefined ? undefined :
          `${confirmation === 'unknown' ? '等待核对' : '尚未执行'}：${issue}` });
    }
  }

  private classify(shelf: BookshelfState, continueReading: ShelfBook | undefined): BookshelfDataState {
    if ((shelf.unfilteredTotal ?? shelf.total) === 0) {
      return { kind: 'empty', shelf, continueReading: undefined };
    }
    return { kind: 'populated', shelf, continueReading };
  }
}

import {
  type BookshelfState,
  type BookshelfListParams,
  ReaderCoreGateway,
  type ShelfBook,
} from '../../app/ReaderCoreGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
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

export type BookshelfImportOutcome = {
  batch: LocalImportBatch;
  shelf: BookshelfDataState;
};

export type BookshelfRemoveOutcome = {
  removed: boolean;
  shelf: BookshelfDataState;
};

export interface BookshelfRemovalTarget {
  sourceId: string;
  bookId: string;
}

export type BookshelfRemoveBatchOutcome = {
  removedCount: number;
  shelf: BookshelfDataState;
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

  async load(): Promise<BookshelfDataState> {
    if (!this.bookshelf.supportsShelfPages()) {
      const shelf = await this.bookshelf.loadBookshelf({ sortBy: 'lastReadAt', sortDirection: 'descending' });
      return this.classify(shelf, shelf.books.find((book: ShelfBook): boolean => book.currentChapterIndex !== undefined));
    }
    if (this.filter.readingState === 'all' && this.filter.sourceKind === 'all') {
      const shelf = await this.loadPage(0);
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
      return this.classify(shelf, await this.bookshelf.loadContinueReading());
    }
    // A filtered page cannot establish the global continue-reading book.
    // Keep both requests concurrent and publish their original stable header.
    const results = await Promise.all([this.loadPage(0), this.bookshelf.loadContinueReading()]);
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

  async importPreparedSelections(selections: LocalBookPreparation[]): Promise<BookshelfImportOutcome> {
    const batch = await this.localImport.importPreparedSelections(selections);
    // Always re-read after the picker returns. A completed batch can upsert an
    // existing book, and a cancelled batch must still expose the restored
    // Core-owned shelf instead of retaining a UI-side copy.
    return { batch, shelf: await this.load() };
  }

  async remove(sourceId: string, bookId: string): Promise<BookshelfRemoveOutcome> {
    const removed = await this.bookshelf.removeBook(sourceId, bookId);
    return { removed, shelf: await this.load() };
  }

  async removeMany(targets: BookshelfRemovalTarget[]): Promise<BookshelfRemoveBatchOutcome> {
    const receipt = await this.bookshelf.removeBooks(targets);
    // Re-read once after the batch rather than after every item. Core remains
    // the source of truth and the UI receives one coherent final shelf.
    return { removedCount: receipt.removedTargets.length, shelf: await this.load() };
  }

  private classify(shelf: BookshelfState, continueReading: ShelfBook | undefined): BookshelfDataState {
    if ((shelf.unfilteredTotal ?? shelf.total) === 0) {
      return { kind: 'empty', shelf, continueReading: undefined };
    }
    return { kind: 'populated', shelf, continueReading };
  }
}

import {
  type BookshelfState,
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

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.bookshelf = new ReaderCoreGateway(runtimeOwner);
    this.localImport = new LocalBookImportGateway(runtimeOwner);
  }

  async load(): Promise<BookshelfDataState> {
    // SHF-02: the shelf projection defaults to recent-reading order. Core
    // already honors this pair for loadContinueReading; books never opened
    // carry no lastReadAt and sink to the tail like Legado's default sort.
    const shelf = await this.bookshelf.loadBookshelf({ sortBy: 'lastReadAt', sortDirection: 'descending' });
    let continueReading: ShelfBook | undefined = undefined;
    for (const book of shelf.books) {
      if (book.currentChapterIndex !== undefined) {
        continueReading = book;
        break;
      }
    }
    return this.classify(shelf, continueReading);
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
    if (shelf.total === 0) {
      return { kind: 'empty', shelf, continueReading: undefined };
    }
    return { kind: 'populated', shelf, continueReading };
  }
}

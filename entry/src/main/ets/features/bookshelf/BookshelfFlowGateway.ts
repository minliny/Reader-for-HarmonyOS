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
    const [shelf, continueReading] = await Promise.all([
      this.bookshelf.loadBookshelf(),
      this.bookshelf.loadContinueReading(),
    ]);
    return this.classify(shelf, continueReading);
  }

  async importFromSystemPicker(): Promise<BookshelfImportOutcome> {
    const batch = await this.localImport.importFromSystemPicker();
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
    let removedCount = 0;
    for (const target of targets) {
      if (await this.bookshelf.removeBook(target.sourceId, target.bookId)) {
        removedCount += 1;
      }
    }
    // Re-read once after the batch rather than after every item. Core remains
    // the source of truth and the UI receives one coherent final shelf.
    return { removedCount, shelf: await this.load() };
  }

  private classify(shelf: BookshelfState, continueReading: ShelfBook | undefined): BookshelfDataState {
    if (shelf.total === 0) {
      return { kind: 'empty', shelf, continueReading: undefined };
    }
    return { kind: 'populated', shelf, continueReading };
  }
}

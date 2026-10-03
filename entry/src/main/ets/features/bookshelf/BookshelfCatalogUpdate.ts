import type { ShelfBook } from '../../app/ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { RemoteReadingSession } from '../reading/RemoteReadingContract';

export interface BookshelfCatalogProgress {
  total: number;
  attempted: number;
  succeeded: number;
  failed: number;
  preparationFailed: number;
  cancelled: boolean;
}

/** Domain-local sweep; the existing BookshelfHost owns creation and scans.
 * An exact Runtime/operation predicate is supplied once, never reacquired.
 * Generic source scheduling/acquisition remains the existing Coordinator. */
export class BookshelfCatalogUpdate {
  private readonly owner: ReaderRuntimeOwner;

  constructor(owner: ReaderRuntimeOwner) { this.owner = owner; }

  async run(books: ShelfBook[], automatic: boolean, intervalMs: number, current: () => boolean,
    prefetch: (session: RemoteReadingSession, current: () => boolean) => Promise<void>,
    emit: (progress: BookshelfCatalogProgress) => void): Promise<BookshelfCatalogProgress> {
    const now = Date.now();
    const targets = books.filter((book: ShelfBook): boolean => book.sourceId !== 'local' &&
      (!automatic || book.lastCheckAt === undefined || now - book.lastCheckAt * 1000 >= intervalMs));
    const progress: BookshelfCatalogProgress = { total: targets.length, attempted: 0, succeeded: 0,
      failed: 0, preparationFailed: 0, cancelled: false };
    if (!current()) { progress.cancelled = true; return progress; }
    emit({ ...progress });
    // Preserve the established two-book limit; do not enqueue the full shelf.
    for (let start = 0; start < targets.length; start += 2) {
      if (!current()) { progress.cancelled = true; return progress; }
      const batch = targets.slice(start, Math.min(targets.length, start + 2));
      const outcomes = await Promise.all(batch.map((book: ShelfBook): Promise<BookshelfCatalogProgress> =>
        this.one(book, automatic, current, prefetch)));
      for (const outcome of outcomes) {
        progress.attempted += outcome.attempted;
        progress.succeeded += outcome.succeeded;
        progress.failed += outcome.failed;
        progress.preparationFailed += outcome.preparationFailed;
        progress.cancelled = progress.cancelled || outcome.cancelled;
      }
      if (!current()) { progress.cancelled = true; return progress; }
      emit({ ...progress });
    }
    return progress;
  }

  private async one(book: ShelfBook, automatic: boolean, current: () => boolean,
    prefetch: (session: RemoteReadingSession, current: () => boolean) => Promise<void>): Promise<BookshelfCatalogProgress> {
    const result: BookshelfCatalogProgress = { total: 1, attempted: 0, succeeded: 0,
      failed: 0, preparationFailed: 0, cancelled: false };
    if (!current()) { result.cancelled = true; return result; }
    result.attempted = 1;
    try {
      const session = await this.owner.bookAcquisitions().acquireBook({ sourceId: book.sourceId, bookId: book.bookId,
        detailUrl: book.bookId, title: book.title, author: book.author, coverUrl: book.coverUrl,
        intro: book.intro, lastChapter: book.lastChapter },
        { forceRefresh: true, isCurrent: current, canDispatch: current }, automatic ? 'background' : 'foreground');
      if (!current()) { result.cancelled = true; return result; }
      // Acquired fresh catalog and optional body preparation are two facts.
      result.succeeded = 1;
      if (!automatic) {
        try { await prefetch(session, current); }
        catch (_error) { if (current()) result.preparationFailed = 1; }
      }
      if (!current()) result.cancelled = true;
    } catch (_error) {
      if (current()) result.failed = 1;
      else result.cancelled = true;
    }
    return result;
  }
}

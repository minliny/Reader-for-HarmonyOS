import type { ShelfBook } from '../../../app/ReaderCoreGateway';

const MAX_ATTEMPTED_BOOKS = 200;

export interface BookshelfLocalMetricsBackfillPorts {
  readonly requestMetrics: (bookId: string, current: () => boolean) => Promise<void>;
  readonly onRefreshed?: () => void;
}

/**
 * Core evicts rebuildable `local_book.scalar-facts.v1:*` cache rows whenever
 * `reader_document_clock.generation` advances (e.g. background online source updates).
 * This coordinator detects local non-manga books that retain a reading position
 * with missing `readProgress` on shelf projection and requests `local_book.content.metrics`
 * once per `(bookId, revision)` sequentially so exact progress recovers automatically.
 */
export function localBookNeedsScalarMetrics(book: ShelfBook): boolean {
  if (book.sourceId !== 'local' || book.contentKind === 'manga') return false;
  if (book.readProgress !== undefined && Number.isFinite(book.readProgress) && book.readProgress >= 0) {
    return false;
  }
  const hasChapterTitle = (book.currentChapterTitle?.trim().length ?? 0) > 0;
  return hasChapterTitle || book.readingPosition !== undefined;
}

export class BookshelfLocalMetricsBackfill {
  private readonly ports: BookshelfLocalMetricsBackfillPorts;
  private readonly attemptedRevisionByBookId: Map<string, string> = new Map<string, string>();
  private readonly queuedBookIds: Set<string> = new Set<string>();
  private readonly pendingQueue: string[] = [];
  private draining: boolean = false;
  private activeGeneration: number = 0;

  constructor(ports: BookshelfLocalMetricsBackfillPorts) {
    this.ports = ports;
  }

  reset(): void {
    this.activeGeneration += 1;
    this.pendingQueue.length = 0;
    this.queuedBookIds.clear();
  }

  schedule(books: readonly ShelfBook[], revision: string, isCurrent: () => boolean): void {
    if (!isCurrent()) return;
    const revKey = revision.length > 0 ? revision : '__no_revision__';
    let enqueued = false;
    for (const book of books) {
      if (!localBookNeedsScalarMetrics(book)) continue;
      if (this.attemptedRevisionByBookId.get(book.bookId) === revKey) continue;
      if (this.queuedBookIds.has(book.bookId)) continue;
      this.queuedBookIds.add(book.bookId);
      this.pendingQueue.push(book.bookId);
      enqueued = true;
    }
    if (enqueued && !this.draining) {
      void this.drain(revKey, isCurrent);
    }
  }

  private rememberAttempt(bookId: string, revision: string): void {
    if (this.attemptedRevisionByBookId.has(bookId)) {
      this.attemptedRevisionByBookId.delete(bookId);
    } else if (this.attemptedRevisionByBookId.size >= MAX_ATTEMPTED_BOOKS) {
      const oldest = this.attemptedRevisionByBookId.keys().next();
      if (!oldest.done) this.attemptedRevisionByBookId.delete(oldest.value);
    }
    this.attemptedRevisionByBookId.set(bookId, revision);
  }

  private async drain(revision: string, isCurrent: () => boolean): Promise<void> {
    this.draining = true;
    const drainGeneration = this.activeGeneration;
    let anySucceeded = false;
    try {
      while (this.pendingQueue.length > 0) {
        if (drainGeneration !== this.activeGeneration || !isCurrent()) {
          this.pendingQueue.length = 0;
          this.queuedBookIds.clear();
          return;
        }
        const bookId = this.pendingQueue.shift();
        if (bookId === undefined) continue;
        this.queuedBookIds.delete(bookId);
        if (this.attemptedRevisionByBookId.get(bookId) === revision) continue;
        this.rememberAttempt(bookId, revision);
        try {
          await this.ports.requestMetrics(bookId, (): boolean =>
            drainGeneration === this.activeGeneration && isCurrent());
          anySucceeded = true;
        } catch (_error) {
          // Leave attemptedRevisionByBookId marked for this revision so unreadable books never spin.
        }
      }
    } finally {
      this.draining = false;
    }
    if (anySucceeded && drainGeneration === this.activeGeneration && isCurrent()) {
      this.ports.onRefreshed?.();
    }
  }
}

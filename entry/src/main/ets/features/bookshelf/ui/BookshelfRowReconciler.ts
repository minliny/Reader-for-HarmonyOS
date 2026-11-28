import type { ShelfBook } from '../../../app/ReaderCoreGateway.ts';

export interface BookshelfBookSlotLike {
  readonly key: string;
  book: ShelfBook;
  columnIndex: number;
  signature: string;
}

export interface BookshelfRowSlotLike<TBook extends BookshelfBookSlotLike> {
  readonly rowIndex: number;
  books: ShelfBook[];
  slots: TBook[];
  signature: string;
}

export type BookshelfRowDeltaKind = 'none' | 'add' | 'delete';

export interface BookshelfRowReconcileResult {
  readonly kind: BookshelfRowDeltaKind;
  readonly index: number;
  readonly count: number;
  readonly addedKeys: string[];
}

export function bookshelfBookIdentityKey(book: ShelfBook): string {
  return `${book.sourceId}:${book.bookId}`;
}

export function bookshelfBookRenderKey(book: ShelfBook): string {
  return JSON.stringify([
    book.sourceId, book.bookId, book.addedAt, book.title, book.author,
    book.sourceName ?? '', book.coverUrl ?? '', book.kind ?? '', book.contentKind ?? '', book.currentChapterTitle ?? '',
    book.currentChapterIndex ?? -1, book.chapterCount ?? -1, book.lastChapter ?? '',
    book.unreadCount ?? 0, book.readProgress ?? -1,
    book.readingPosition?.chapterIndex ?? -1, book.readingPosition?.chapterOffset ?? -1,
    book.readingPosition?.updatedAt ?? -1, book.readingPosition?.locationRevision ?? '',
    book.readingPosition?.bodyVersion ?? '', book.readingPosition?.processingVersion ?? '',
  ]);
}

export function bookshelfRowRenderKey(row: ShelfBook[], _rowIndex: number): string {
  return JSON.stringify(row.map((book: ShelfBook): string => bookshelfBookRenderKey(book)));
}

export function bookshelfRowSlotKey(rowIndex: number): string {
  return `shelf-row:${rowIndex}`;
}

export function reconcileBookshelfRows<
  TBook extends BookshelfBookSlotLike,
  TRow extends BookshelfRowSlotLike<TBook>,
>(
  rows: TRow[],
  nextItems: ShelfBook[][],
  createBookSlot: (key: string, book: ShelfBook, columnIndex: number, signature: string) => TBook,
  createRowSlot: (rowIndex: number, books: ShelfBook[], slots: TBook[], signature: string) => TRow,
): BookshelfRowReconcileResult {
  const previousCount = rows.length;
  const sharedCount = Math.min(previousCount, nextItems.length);
  for (let rowIndex = 0; rowIndex < sharedCount; rowIndex += 1) {
    const nextBooks = nextItems[rowIndex];
    const nextRowSignature = bookshelfRowRenderKey(nextBooks, rowIndex);
    const existingRow = rows[rowIndex];
    if (existingRow.signature === nextRowSignature) continue;

    const existingSlots = existingRow.slots;
    const sameIdentitiesInOrder = existingSlots.length === nextBooks.length &&
      existingSlots.every((slot: TBook, col: number): boolean => slot.key === bookshelfBookIdentityKey(nextBooks[col]));
    if (sameIdentitiesInOrder) {
      for (let col = 0; col < nextBooks.length; col += 1) {
        const nextBook = nextBooks[col];
        const nextSignature = bookshelfBookRenderKey(nextBook);
        const slot = existingSlots[col];
        if (slot.signature !== nextSignature) {
          slot.book = nextBook;
          slot.signature = nextSignature;
        }
        if (slot.columnIndex !== col) {
          slot.columnIndex = col;
        }
      }
      existingRow.books = nextBooks;
      existingRow.signature = nextRowSignature;
      continue;
    }

    const existingByKey = new Map<string, TBook>();
    for (const slot of existingSlots) {
      existingByKey.set(slot.key, slot);
    }
    const nextSlots: TBook[] = [];
    for (let col = 0; col < nextBooks.length; col += 1) {
      const nextBook = nextBooks[col];
      const key = bookshelfBookIdentityKey(nextBook);
      const nextSignature = bookshelfBookRenderKey(nextBook);
      const reused = existingByKey.get(key);
      if (reused !== undefined) {
        if (reused.columnIndex !== col) reused.columnIndex = col;
        if (reused.signature !== nextSignature) {
          reused.book = nextBook;
          reused.signature = nextSignature;
        }
        nextSlots.push(reused);
      } else {
        nextSlots.push(createBookSlot(key, nextBook, col, nextSignature));
      }
    }
    existingRow.slots = nextSlots;
    existingRow.books = nextBooks;
    existingRow.signature = nextRowSignature;
  }

  if (nextItems.length > previousCount) {
    const addedKeys: string[] = [];
    for (let rowIndex = previousCount; rowIndex < nextItems.length; rowIndex += 1) {
      const books = nextItems[rowIndex];
      const slots: TBook[] = books.map((book: ShelfBook, col: number): TBook =>
        createBookSlot(bookshelfBookIdentityKey(book), book, col, bookshelfBookRenderKey(book)));
      rows.push(createRowSlot(rowIndex, books, slots, bookshelfRowRenderKey(books, rowIndex)));
      addedKeys.push(bookshelfRowSlotKey(rowIndex));
    }
    return { kind: 'add', index: previousCount, count: nextItems.length - previousCount, addedKeys };
  }

  if (nextItems.length < previousCount) {
    rows.splice(nextItems.length, previousCount - nextItems.length);
    return { kind: 'delete', index: nextItems.length, count: previousCount - nextItems.length, addedKeys: [] };
  }

  return { kind: 'none', index: 0, count: 0, addedKeys: [] };
}

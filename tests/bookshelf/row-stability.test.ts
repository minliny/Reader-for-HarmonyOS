import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ShelfBook } from '../../entry/src/main/ets/app/ReaderCoreGateway.ts';
import {
  bookshelfBookIdentityKey,
  bookshelfBookRenderKey,
  bookshelfRowRenderKey,
  bookshelfRowSlotKey,
  reconcileBookshelfRows,
  type BookshelfBookSlotLike,
  type BookshelfRowSlotLike,
} from '../../entry/src/main/ets/features/bookshelf/ui/BookshelfRowReconciler.ts';

class TestBookSlot implements BookshelfBookSlotLike {
  readonly key: string;
  book: ShelfBook;
  columnIndex: number;
  signature: string;

  constructor(key: string, book: ShelfBook, columnIndex: number, signature: string) {
    this.key = key;
    this.book = book;
    this.columnIndex = columnIndex;
    this.signature = signature;
  }
}

class TestRowSlot implements BookshelfRowSlotLike<TestBookSlot> {
  readonly rowIndex: number;
  books: ShelfBook[];
  slots: TestBookSlot[];
  signature: string;

  constructor(rowIndex: number, books: ShelfBook[], slots: TestBookSlot[], signature: string) {
    this.rowIndex = rowIndex;
    this.books = books;
    this.slots = slots;
    this.signature = signature;
  }
}

function makeBook(id: string, extra: Partial<ShelfBook> = {}): ShelfBook {
  return {
    sourceId: extra.sourceId ?? 'src-1',
    bookId: id,
    title: extra.title ?? `Book ${id}`,
    author: extra.author ?? 'Author',
    addedAt: extra.addedAt ?? 1000,
    coverUrl: extra.coverUrl ?? `https://covers.example/${id}.jpg`,
    readProgress: extra.readProgress ?? 1000,
    unreadCount: extra.unreadCount ?? 0,
    currentChapterTitle: extra.currentChapterTitle ?? '第1章',
  };
}

function reconcile(rows: TestRowSlot[], nextItems: ShelfBook[][]) {
  return reconcileBookshelfRows<TestBookSlot, TestRowSlot>(
    rows,
    nextItems,
    (key, book, columnIndex, signature) => new TestBookSlot(key, book, columnIndex, signature),
    (rowIndex, books, slots, signature) => new TestRowSlot(rowIndex, books, slots, signature),
  );
}

test('metadata-only updates mutate only the changed book slot without reloading rows', () => {
  const rows: TestRowSlot[] = [];
  const row0Before = [makeBook('b1'), makeBook('b2'), makeBook('b3')];
  const row1Before = [makeBook('b4'), makeBook('b5')];

  const initial = reconcile(rows, [row0Before, row1Before]);
  assert.equal(initial.kind, 'add');
  assert.equal(initial.count, 2);
  assert.deepEqual(initial.addedKeys, [bookshelfRowSlotKey(0), bookshelfRowSlotKey(1)]);

  const row0Ref = rows[0];
  const row1Ref = rows[1];
  const b1Ref = rows[0].slots[0];
  const b2Ref = rows[0].slots[1];
  const b4Ref = rows[1].slots[0];

  const updated = reconcile(rows, [
    [makeBook('b1', { readProgress: 4200, currentChapterTitle: '第12章' }), makeBook('b2'), makeBook('b3')],
    [makeBook('b4'), makeBook('b5')],
  ]);

  assert.equal(updated.kind, 'none');
  assert.equal(rows[0], row0Ref);
  assert.equal(rows[1], row1Ref);
  assert.equal(rows[0].slots[0], b1Ref);
  assert.equal(rows[0].slots[1], b2Ref);
  assert.equal(rows[1].slots[0], b4Ref);
  assert.equal(b1Ref.book.readProgress, 4200);
  assert.equal(b1Ref.book.currentChapterTitle, '第12章');
  assert.equal(b2Ref.book, row0Before[1], 'unchanged book slots must retain exact DTO object');
});

test('reordering books within and across rows reuses existing book slots without emitting reload', () => {
  const rows: TestRowSlot[] = [];
  reconcile(rows, [
    [makeBook('b1'), makeBook('b2'), makeBook('b3')],
    [makeBook('b4'), makeBook('b5')],
  ]);
  const b2Ref = rows[0].slots[1];
  const b1Ref = rows[0].slots[0];

  const reordered = reconcile(rows, [
    [makeBook('b4'), makeBook('b1'), makeBook('b2')],
    [makeBook('b3'), makeBook('b5')],
  ]);

  assert.equal(reordered.kind, 'none');
  assert.equal(rows[0].slots[1], b1Ref);
  assert.equal(b1Ref.columnIndex, 1);
  assert.equal(rows[0].slots[2], b2Ref);
  assert.equal(b2Ref.columnIndex, 2);
  assert.equal(rows[0].slots[0].key, bookshelfBookIdentityKey(makeBook('b4')));
});

test('appending or removing tail rows emits targeted add and delete deltas only', () => {
  const rows: TestRowSlot[] = [];
  reconcile(rows, [[makeBook('b1'), makeBook('b2')]]);
  const row0Ref = rows[0];

  const added = reconcile(rows, [
    [makeBook('b1'), makeBook('b2')],
    [makeBook('b3')],
  ]);
  assert.equal(added.kind, 'add');
  assert.equal(added.index, 1);
  assert.equal(added.count, 1);
  assert.equal(rows[0], row0Ref);
  assert.equal(rows[1].signature, bookshelfRowRenderKey([makeBook('b3')], 1));
  assert.equal(rows[1].slots[0].signature, bookshelfBookRenderKey(makeBook('b3')));

  const deleted = reconcile(rows, [[makeBook('b1'), makeBook('b2')]]);
  assert.equal(deleted.kind, 'delete');
  assert.equal(deleted.index, 1);
  assert.equal(deleted.count, 1);
  assert.equal(rows[0], row0Ref);
});

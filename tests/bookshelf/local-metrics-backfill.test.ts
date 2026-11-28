import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ShelfBook } from '../../entry/src/main/ets/app/ReaderCoreGateway.ts';
import {
  BookshelfLocalMetricsBackfill,
  localBookNeedsScalarMetrics,
} from '../../entry/src/main/ets/features/bookshelf/application/BookshelfLocalMetricsBackfill.ts';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

const epubWithMissingProgress: ShelfBook = {
  sourceId: 'local',
  bookId: 'epub-1',
  title: 'Test EPUB',
  author: 'Author',
  addedAt: 1,
  kind: 'epub',
  contentKind: 'text',
  chapterCount: 20,
  currentChapterTitle: 'Chapter 3',
  readingPosition: { chapterIndex: 2, chapterOffset: 120, updatedAt: 10 },
};

test('localBookNeedsScalarMetrics matches read local text books missing readProgress', () => {
  assert.equal(localBookNeedsScalarMetrics(epubWithMissingProgress), true);
  assert.equal(localBookNeedsScalarMetrics({ ...epubWithMissingProgress, readProgress: 1700 }), false);
  assert.equal(localBookNeedsScalarMetrics({ ...epubWithMissingProgress, readProgress: -1 }), true);
  assert.equal(localBookNeedsScalarMetrics({ ...epubWithMissingProgress, currentChapterTitle: '', readingPosition: undefined }), false);
  assert.equal(localBookNeedsScalarMetrics({ ...epubWithMissingProgress, contentKind: 'manga' }), false);
  assert.equal(localBookNeedsScalarMetrics({ ...epubWithMissingProgress, sourceId: 'online-src' }), false);
});

test('backfill runs sequentially at most once per (bookId, revision) and triggers refresh', async () => {
  const calls: string[] = [];
  let refreshes = 0;
  let current = true;
  const backfill = new BookshelfLocalMetricsBackfill({
    requestMetrics: async (bookId: string) => {
      calls.push(bookId);
    },
    onRefreshed: () => {
      refreshes += 1;
    },
  });

  backfill.schedule([epubWithMissingProgress], 'rev-1', () => current);
  backfill.schedule([epubWithMissingProgress], 'rev-1', () => current);
  await flushMicrotasks();

  assert.deepEqual(calls, ['epub-1']);
  assert.equal(refreshes, 1);

  // Same revision does not retry.
  backfill.schedule([epubWithMissingProgress], 'rev-1', () => current);
  await flushMicrotasks();
  assert.deepEqual(calls, ['epub-1']);
  assert.equal(refreshes, 1);

  // Advancing revision after external clock wipe permits one fresh backfill.
  backfill.schedule([epubWithMissingProgress], 'rev-2', () => current);
  await flushMicrotasks();
  assert.deepEqual(calls, ['epub-1', 'epub-1']);
  assert.equal(refreshes, 2);

  // Stops when session becomes non-current.
  current = false;
  backfill.schedule([epubWithMissingProgress], 'rev-3', () => current);
  await flushMicrotasks();
  assert.deepEqual(calls, ['epub-1', 'epub-1']);
});

test('failing request does not spin on the same revision and still completes queue', async () => {
  const calls: string[] = [];
  let refreshes = 0;
  const backfill = new BookshelfLocalMetricsBackfill({
    requestMetrics: async (bookId: string) => {
      calls.push(bookId);
      if (bookId === 'broken') throw new Error('unreadable');
    },
    onRefreshed: () => {
      refreshes += 1;
    },
  });

  const brokenBook: ShelfBook = { ...epubWithMissingProgress, bookId: 'broken' };
  const validBook: ShelfBook = { ...epubWithMissingProgress, bookId: 'valid' };
  backfill.schedule([brokenBook, validBook], 'rev-a', () => true);
  await flushMicrotasks();

  assert.deepEqual(calls, ['broken', 'valid']);
  assert.equal(refreshes, 1);

  backfill.schedule([brokenBook], 'rev-a', () => true);
  await flushMicrotasks();
  assert.deepEqual(calls, ['broken', 'valid']);
});

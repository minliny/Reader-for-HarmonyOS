import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ShelfBook } from '../../entry/src/main/ets/app/ReaderCoreGateway.ts';
import { ShelfBookPresentation } from '../../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts';

const localBook: ShelfBook = {
  sourceId: 'local', bookId: 'book', title: '本地 TXT', author: '', addedAt: 1,
  contentKind: 'text', chapterCount: 32,
};

test('a saved chapter with no exact percentage has a shared unknown label', () => {
  assert.equal(ShelfBookPresentation.listProgress({
    ...localBook, currentChapterTitle: '第二章',
  }), '进度未知');
  assert.equal(ShelfBookPresentation.listProgress({
    ...localBook, readingPosition: { chapterIndex: 1, chapterOffset: 0, updatedAt: 1 },
  }), '进度未知');
});

test('the shared label preserves unread and distinguishes a measured zero from an unknown value', () => {
  assert.equal(ShelfBookPresentation.listProgress(localBook), '未读');
  for (const invalid of [-1, Infinity, NaN]) {
    assert.equal(ShelfBookPresentation.listProgress({
      ...localBook, currentChapterTitle: '第一章', readProgress: invalid,
    }), '进度未知');
  }
  for (const [basisPoints, label] of [[0, '0%'], [21, '<1%'], [4312, '43%']] as const) {
    assert.equal(ShelfBookPresentation.listProgress({
      ...localBook, currentChapterTitle: '第一章', readProgress: basisPoints,
    }), label);
  }
});

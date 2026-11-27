import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDownloadBookView, sameDownloadBookView } from
  '../../entry/src/main/ets/features/downloads/presentation/SharedDownloadProjection.ts';

test('download row comparison ignores DTO member order and keeps nested chapters and position authoritative', () => {
  const left = createDownloadBookView({ sourceId: 'source', bookId: 'book', title: 'Title',
    author: 'Author', contentKind: 'manga', addedAt: 20,
    readingPosition: { chapterIndex: 3, chapterOffset: 123, updatedAt: 25 } });
  left.chapters = [{ key: 'chapter', sourceId: 'source', bookId: 'book', index: 3, title: 'Chapter',
    chapterId: 'c3', navigable: true, localComplete: false, stateLabel: '', queueState: 'paused',
    mangaManifestVersion: 'm1', mangaTotalPages: 100, mangaSavedPages: 1 }];
  const reordered = Object.fromEntries(Object.entries(left).reverse()) as typeof left;
  assert.equal(sameDownloadBookView(left, reordered), true);
  assert.equal(sameDownloadBookView(left, { ...left, chapters: [{ ...left.chapters[0], mangaSavedPages: 2 }] }), false);
  assert.equal(sameDownloadBookView(left, { ...left, shelfBook: { ...left.shelfBook,
    readingPosition: { ...left.shelfBook.readingPosition!, chapterOffset: 124 } } }), false);
});

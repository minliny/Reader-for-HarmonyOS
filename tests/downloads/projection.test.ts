import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDownloadBookView, filterDownloadBooks, projectDownloadBookAvailability,
  type DownloadChapterView } from '../../entry/src/main/ets/features/downloads/presentation/SharedDownloadProjection.ts';

const book = { sourceId: 'source-a', bookId: 'book-a', title: '书', author: '作者', contentKind: 'text' as const, addedAt: 0 };
function chapter(chapterIndex: number, queueState: DownloadChapterView['queueState'], localComplete = false): DownloadChapterView {
  return { chapterIndex, chapterId: `chapter-${chapterIndex}`, title: `章节${chapterIndex}`, queueState, localComplete,
    navigable: true, stateLabel: '' };
}

test('a queued chapter keeps the pause action when a sibling failed', () => {
  const view = projectDownloadBookAvailability(createDownloadBookView(book), [chapter(1, 'failed'), chapter(2, 'queued')], 2);
  assert.equal(view.statusAction, 'pause');
  assert.equal(view.downloadedChapters, 0);
  assert.equal(view.progressPercent, 0);
});

test('verified availability excludes non-navigable rows and leaves unknown sort values last', () => {
  const ready = projectDownloadBookAvailability(createDownloadBookView(book),
    [chapter(1, 'cached', true), { ...chapter(2, 'cached', true), navigable: false }], 1, 33);
  const missing = createDownloadBookView({ ...book, bookId: 'book-b' });
  assert.equal(ready.statusAction, 'completed');
  assert.equal(ready.downloadedChapters, 1);
  assert.equal(ready.progressPercent, 100);
  for (const direction of ['asc', 'desc'] as const) {
    const sorted = filterDownloadBooks([missing, ready], { query: '', type: 'all', state: 'all', sourceId: 'all',
      sort: 'size', direction });
    assert.deepEqual(sorted.map(row => row.bookId), ['book-a', 'book-b']);
  }
});

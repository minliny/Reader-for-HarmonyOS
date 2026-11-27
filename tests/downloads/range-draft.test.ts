import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseSharedDownloadRange, editSharedDownloadRangeBound, observeSharedDownloadRangeCatalog,
  openSharedDownloadRangeDraft, resetSharedDownloadRangeDraft, sharedDownloadCustomRangeProof }
  from '../../entry/src/main/ets/features/downloads/application/SharedDownloadRangeDraft.ts';
import { createDownloadBookView, projectDownloadBookAvailability, type DownloadChapterView }
  from '../../entry/src/main/ets/features/downloads/presentation/SharedDownloadProjection.ts';

function catalog(secondId: string) {
  const book = createDownloadBookView({ sourceId: 'source-a', bookId: 'book-a', title: '书', author: '作者',
    contentKind: 'text', addedAt: 0 });
  const chapter = (index: number, chapterId: string, navigable: boolean): DownloadChapterView => ({
    key: JSON.stringify(['source-a', 'book-a', index]), sourceId: 'source-a', bookId: 'book-a',
    index, chapterId, title: chapterId, navigable, localComplete: false, stateLabel: '', queueState: 'queued',
  });
  return projectDownloadBookAvailability(book,
    [chapter(2, 'section', false), chapter(3, 'chapter-a', true), chapter(7, secondId, true)], 2);
}

test('a different chapter at the same index expires the exact custom range without dropping typed bounds', () => {
  const first = catalog('chapter-b');
  const replacement = catalog('chapter-new');
  let draft = resetSharedDownloadRangeDraft(openSharedDownloadRangeDraft(), first.key);
  draft = observeSharedDownloadRangeCatalog(chooseSharedDownloadRange(draft, 'custom'), first);
  const originalRevision = draft.revision;
  draft = editSharedDownloadRangeBound(draft, originalRevision, true, '1');
  draft = editSharedDownloadRangeBound(draft, originalRevision, false, '2');
  assert.deepEqual(sharedDownloadCustomRangeProof(draft, first), [
    { chapterIndex: 3, chapterId: 'chapter-a' }, { chapterIndex: 7, chapterId: 'chapter-b' },
  ]);
  assert.equal(sharedDownloadCustomRangeProof(draft, replacement), undefined);
  draft = observeSharedDownloadRangeCatalog(draft, replacement);
  assert.equal(draft.catalogChanged, true);
  assert.deepEqual([draft.start, draft.end], ['1', '2']);
  assert.equal(editSharedDownloadRangeBound(draft, originalRevision, true, '2'), draft);
  assert.equal(sharedDownloadCustomRangeProof(draft, first), undefined);

  draft = observeSharedDownloadRangeCatalog(resetSharedDownloadRangeDraft(draft, replacement.key), replacement);
  assert.equal(editSharedDownloadRangeBound(draft, originalRevision, true, '2'), draft);
  draft = editSharedDownloadRangeBound(draft, draft.revision, true, '2');
  draft = editSharedDownloadRangeBound(draft, draft.revision, false, '2');
  assert.deepEqual(sharedDownloadCustomRangeProof(draft, replacement), [{ chapterIndex: 7, chapterId: 'chapter-new' }]);
});

import assert from 'node:assert/strict';
import { MangaBookPresentation } from '../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';
const identity = { sourceId: 'source-a', bookId: 'book-a', chapterId: 'chapter-4' };
const location = { kind: 'manga', chapter: identity, manifestVersion: 'manifest-1', pageId: 'page-8',
  pageOrdinalFallback: 7, x: 0, y: 0, progressRevision: 3 };
const chapter = { chapterIndex: 4, chapterTitle: '原始可读卷名', totalPages: 24,
  manifest: { chapter: identity, manifestVersion: 'manifest-1', pages: [{ pageId: 'page-8', ordinal: 7 }] } };
const entry = { chapter, progress: { location, token: { epoch: 1, revision: 3 } }, targetOrdinal: 7 };
const book = { sourceId: identity.sourceId, bookId: identity.bookId, contentKind: 'manga', title: '漫画', author: '',
  addedAt: 1, readProgress: 5700, currentChapterTitle: '错误文字章节' };
assert.equal(ShelfBookPresentation.progress(book), '*%', 'text basis points cannot certify comic progress');
assert.equal(ShelfBookPresentation.progressPercent(book), 0, 'unknown track stays empty');
assert.equal(MangaBookPresentation.admitEntry('source-b', identity.bookId, entry), false);
assert.equal(MangaBookPresentation.get('source-b', identity.bookId), undefined, 'source identity cannot alias');
assert.equal(MangaBookPresentation.admitEntry(identity.sourceId, identity.bookId, entry), true);
assert.equal(ShelfBookPresentation.readingPosition(book), '原始可读卷名 · 第 8 页 / 24 页');
assert.equal(ShelfBookPresentation.visible([book], '', 'reading').length, 1);
assert.equal(ShelfBookPresentation.visible([book], '', 'finished').length, 0, 'chapter progress does not prove book completion');
const confirmed = MangaBookPresentation.get(identity.sourceId, identity.bookId);
assert.equal(MangaBookPresentation.admitConfirmedLocation(identity.sourceId, identity.bookId,
  { ...location, manifestVersion: 'stale' }, chapter, 24), false);
assert.equal(MangaBookPresentation.get(identity.sourceId, identity.bookId), confirmed, 'stale receipt leaves known display facts intact');
assert.equal(MangaBookPresentation.admitConfirmedLocation(identity.sourceId, identity.bookId,
  { ...location, pageId: 'wrong-page' }, chapter, 24), false);
assert.equal(MangaBookPresentation.admitConfirmedLocation(identity.sourceId, identity.bookId, location, chapter, 7), false);
assert.equal(MangaBookPresentation.admitConfirmedLocation(identity.sourceId, identity.bookId, location, chapter, 24), true);
const farPage = { pageId: 'page-20', ordinal: 19 };
assert.equal(MangaBookPresentation.admitConfirmedLocation(identity.sourceId, identity.bookId, { ...location, pageId: farPage.pageId, pageOrdinalFallback: farPage.ordinal, progressRevision: 4 }, chapter, 24, farPage), true, 'admitted controller page map supplies the identity outside the initial bounded window');
assert.equal(MangaBookPresentation.admitProgress(identity.sourceId, identity.bookId,
  { token: { epoch: 1, revision: 5 }, location: { ...location, progressRevision: 5, chapter: { ...identity, chapterId: 'chapter-5' } } }), true);
assert.equal(ShelfBookPresentation.readingPosition(book), '第 8 页', 'bare progress never borrows previous chapter title or total');
assert.equal(MangaBookPresentation.admitEntry(identity.sourceId, identity.bookId, { ...entry, progress: { token: { epoch: 1, revision: 6 }, location: null } }), true, 'Core-confirmed absent progress clears previous display state');
assert.equal(ShelfBookPresentation.readingPosition(book), '尚未阅读');
assert.equal(MangaBookPresentation.admitEntry(identity.sourceId, identity.bookId, entry), false, 'obsolete Core progress cannot resurrect the cleared display');
assert.equal(MangaBookPresentation.admitProgress(identity.sourceId, identity.bookId, { token: { epoch: 2, revision: 0 }, location: null }), true, 'a newer Core epoch admits a reset with lower per-epoch revision');
assert.equal(ShelfBookPresentation.visible([book], '', 'unread').length, 1);
assert.equal(ShelfBookPresentation.progress({ ...book, contentKind: 'text' }), '已读 57%', 'text projection keeps its own contract');
{
  const owner = {};
  MangaBookPresentation.useOwner(owner);
  const identityFor = index => ({ sourceId: 'bounded', bookId: `book-${index}` });
  for (let index = 0; index < 145; index++) {
    const identity = identityFor(index);
    assert.equal(MangaBookPresentation.admitProgress(identity.sourceId, identity.bookId, {
      token: { epoch: 1, revision: index + 1 },
      location: { chapter: { ...identity, chapterId: 'chapter-1' }, pageOrdinalFallback: index },
    }), true);
  }
  MangaBookPresentation.retainIdentities(Array.from({ length: 144 }, (_, index) => identityFor(index)));
  assert.ok(MangaBookPresentation.get('bounded', 'book-143'), 'the admitted shelf window retains its final visible identity');
  assert.equal(MangaBookPresentation.get('bounded', 'book-144'), undefined,
    'display facts outside the admitted shelf window are pruned');
  MangaBookPresentation.useOwner({});
  assert.equal(MangaBookPresentation.get('bounded', 'book-143'), undefined,
    'a new runtime owner cannot reuse a prior session display projection');
}
console.log('PASS manga display facts: identity, immutable receipt, unknown percentage, source isolation and independent text progress');

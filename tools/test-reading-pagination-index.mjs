import assert from 'node:assert/strict';

import {
  ReadingPaginationIndex,
  ReadingPaginationPrefix,
  createReadingPaginationLayoutSignature,
  deriveReadingContentVersion,
} from '../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';

const layoutFacts = {
  deviceForm: 'phone',
  viewportWidth: 390,
  viewportHeight: 844,
  fontFamily: 'ReaderNotoSerifSCRegular',
  fontWeight: 'regular',
  fontSize: 18,
  fontScale: 1,
  lineHeight: 35.28,
  topInset: 72,
  bottomInset: 47.99,
  leftInset: 32,
  rightInset: 32,
  titleLineHeight: 28.75,
  titleToBodySpacing: 18,
  paragraphSpacing: 15.8,
  paragraphIndent: 36,
  letterSpacing: 0,
  textAlignment: 'start',
  writingMode: 'horizontal-tb',
};

const layoutSignature = createReadingPaginationLayoutSignature(layoutFacts);
assert.equal(layoutSignature, createReadingPaginationLayoutSignature({ ...layoutFacts }),
  'identical pagination facts must produce a stable signature');
for (const [field, value] of [
  ['deviceForm', 'tablet'],
  ['viewportWidth', 391],
  ['viewportHeight', 845],
  ['fontFamily', 'AnotherSerif'],
  ['fontWeight', 'medium'],
  ['fontSize', 19],
  ['fontScale', 1.1],
  ['lineHeight', 36],
  ['topInset', 73],
  ['bottomInset', 49],
  ['leftInset', 33],
  ['rightInset', 34],
  ['titleLineHeight', 29],
  ['titleToBodySpacing', 19],
  ['paragraphSpacing', 16],
  ['paragraphIndent', 37],
  ['letterSpacing', 0.5],
  ['textAlignment', 'justify'],
  ['writingMode', 'vertical-rl'],
]) {
  assert.notEqual(createReadingPaginationLayoutSignature({ ...layoutFacts, [field]: value }), layoutSignature,
    `${field} must participate in the physical-page layout signature`);
}
assert.throws(() => createReadingPaginationLayoutSignature({ ...layoutFacts, viewportWidth: 0 }),
  /viewportWidth/);
assert.throws(() => createReadingPaginationLayoutSignature({ ...layoutFacts, letterSpacing: Number.NaN }),
  /letterSpacing/);
assert.throws(() => createReadingPaginationLayoutSignature({ ...layoutFacts, textAlignment: 'center' }),
  /textAlignment/);

const actualBody = '第一段\n\n第二段😀';
assert.equal(deriveReadingContentVersion(actualBody), deriveReadingContentVersion(actualBody),
  'the same materialized body must have a stable content version');
assert.notEqual(deriveReadingContentVersion(actualBody), deriveReadingContentVersion(`${actualBody}。`),
  'the version must change with the actual chapter body');
assert.notEqual(deriveReadingContentVersion('😀'), deriveReadingContentVersion('😁'),
  'content versioning must include the complete UTF-16 body, including surrogate pairs');

function key(chapterIndex, layoutSignature = 'phone-390x844-font18-line35.28', contentVersion = 'body-v1') {
  return {
    sourceId: 'local',
    bookId: 'book-1',
    chapterIndex,
    layoutSignature,
    contentVersion,
  };
}

const prefixKey = key(3);
const prefix = new ReadingPaginationPrefix(prefixKey, {
  requestScalar: 2,
  startScalar: 2,
  endScalarExclusive: 30,
});
assert.equal(prefix.startsAtRequest(2), true);
assert.equal(prefix.startsAtRequest(3), false);
assert.equal(prefix.admit({
  requestScalar: 30,
  // A real paragraph delimiter can make the next renderable glyph begin
  // after the preceding page's exact request anchor.
  startScalar: 32,
  endScalarExclusive: 70,
}), true);
assert.equal(prefix.admit({
  requestScalar: 70,
  startScalar: 70,
  endScalarExclusive: 95,
}), true);
assert.deepEqual(prefix.pageStartScalars(), [2, 32, 70]);
assert.equal(prefix.previousRequestForPageStart(32), 2,
  'the second measured page must return the exact request for page one');
assert.equal(prefix.previousRequestForPageStart(70), 30,
  'later pages must return the preceding page original request, not estimate its start');
assert.equal(prefix.previousRequestForPageStart(2), undefined,
  'a measured prefix cannot fabricate a page before its chapter-head page');
assert.equal(prefix.containsAnchor(45), true,
  'the continuous prefix must recognize a non-linear anchor inside a measured page');
assert.equal(prefix.previousRequestForAnchor(45), 2,
  'a non-linear anchor must resolve to the exact request for the preceding physical page');
assert.equal(prefix.previousRequestForAnchor(75), 30,
  'later non-linear anchors must retain the preceding observation request');
assert.equal(prefix.previousRequestForAnchor(10), undefined,
  'an anchor in the first physical page cannot fabricate a same-chapter predecessor');
assert.equal(prefix.containsAnchor(120), false,
  'an unmeasured suffix must remain outside the pagination truth');
assert.equal(prefix.admit({
  requestScalar: 30,
  startScalar: 32,
  endScalarExclusive: 70,
}), true, 'an exact backward/forward re-observation must preserve the prefix');
assert.deepEqual(prefix.pageStartScalars(), [2, 32, 70],
  're-observing a known page must not duplicate the manifest prefix');
assert.equal(prefix.admit({
  requestScalar: 40,
  startScalar: 40,
  endScalarExclusive: 60,
}), false, 'an unmeasured jump must not enter the chapter-head prefix');
assert.equal(prefix.admit({
  requestScalar: 30,
  startScalar: 33,
  endScalarExclusive: 70,
}), false, 'changed boundaries for an old request must fail closed');
assert.equal(prefix.matches({ ...prefixKey, contentVersion: 'body-v2' }), false,
  'a changed body cannot reuse the measured prefix');
assert.throws(() => new ReadingPaginationPrefix(prefixKey, {
  requestScalar: 10,
  startScalar: 9,
  endScalarExclusive: 20,
}), /must not precede/);

const index = new ReadingPaginationIndex();
const chapter = key(4);
const mutablePageStarts = [4, 30, 70];
index.recordChapter({
  key: chapter,
  contentScalarLength: 100,
  pageStartScalars: mutablePageStarts,
});

mutablePageStarts[1] = 45;
assert.deepEqual(index.findContainingPage(chapter, 30), {
  key: chapter,
  pageIndex: 1,
  startScalar: 30,
  endScalarExclusive: 70,
}, 'the index must own a defensive copy of measured page starts');

assert.deepEqual(index.findContainingPage(chapter, 0), {
  key: chapter,
  pageIndex: 0,
  startScalar: 4,
  endScalarExclusive: 30,
}, 'an anchor before the first renderable scalar belongs to the first physical page');
assert.equal(index.findContainingPage(chapter, 29)?.pageIndex, 0);
assert.equal(index.findContainingPage(chapter, 30)?.pageIndex, 1,
  'an exact physical page start belongs to that page');
assert.equal(index.findContainingPage(chapter, 69)?.pageIndex, 1);
assert.equal(index.findContainingPage(chapter, 70)?.pageIndex, 2);
assert.equal(index.findContainingPage(chapter, 500)?.pageIndex, 2,
  'a stale anchor after EOF resolves to the final measured page');

assert.deepEqual(index.findPreviousPage(chapter, 69, null), {
  kind: 'page',
  page: {
    key: chapter,
    pageIndex: 0,
    startScalar: 4,
    endScalarExclusive: 30,
  },
}, 'previous-page lookup must derive from physical boundaries, not navigation history');
assert.equal(index.findPreviousPage(chapter, 70, null).kind, 'page');

const previousChapter = key(2, chapter.layoutSignature, 'previous-body-v7');
assert.deepEqual(index.findPreviousPage(chapter, 4, previousChapter), {
  kind: 'manifestRequired',
  key: previousChapter,
}, 'chapter-boundary lookup must fail closed until the exact previous manifest exists');

index.recordChapter({
  key: previousChapter,
  contentScalarLength: 50,
  pageStartScalars: [0, 25],
});
assert.deepEqual(index.findPreviousPage(chapter, 4, previousChapter), {
  kind: 'page',
  page: {
    key: previousChapter,
    pageIndex: 1,
    startScalar: 25,
    endScalarExclusive: 50,
  },
}, 'the first current page must resolve to the measured final page of the TOC-previous chapter');
assert.deepEqual(index.findPreviousPage(chapter, 4, null), { kind: 'bookStart' });

const missingCurrent = key(8);
assert.deepEqual(index.findPreviousPage(missingCurrent, 0, chapter), {
  kind: 'manifestRequired',
  key: missingCurrent,
}, 'a missing current manifest must be requested before any previous-page answer');

const landscape = key(4, 'tablet-760x960-font18-line35.28');
assert.equal(index.findContainingPage(landscape, 30), undefined,
  'a different layout signature must never reuse a physical-page manifest');
index.recordChapter({
  key: landscape,
  contentScalarLength: 100,
  pageStartScalars: [4, 45, 90],
});
assert.equal(index.findContainingPage(landscape, 45)?.pageIndex, 1);
assert.equal(index.findContainingPage(chapter, 45)?.pageIndex, 1,
  'separate layout manifests may coexist');

const revisedChapter = key(4, chapter.layoutSignature, 'body-v2');
index.recordChapter({
  key: revisedChapter,
  contentScalarLength: 80,
  pageStartScalars: [3, 40],
});
assert.equal(index.findContainingPage(chapter, 30), undefined,
  'recording a new body version must evict the stale version for the same layout');
assert.equal(index.findContainingPage(revisedChapter, 40)?.pageIndex, 1);
assert.equal(index.findContainingPage(landscape, 45)?.pageIndex, 1,
  'a body-version replacement must not evict another layout signature');

assert.equal(index.invalidate(revisedChapter), true);
assert.equal(index.invalidate(revisedChapter), false);
assert.equal(index.has(revisedChapter), false);
assert.equal(index.invalidateLayout('local', 'book-1', landscape.layoutSignature), 1);
assert.equal(index.has(landscape), false);
assert.equal(index.invalidateChapter('local', 'book-1', previousChapter.chapterIndex), 1);
assert.equal(index.has(previousChapter), false);

const windowIndex = new ReadingPaginationIndex();
windowIndex.recordChapter({
  key: key(10),
  contentScalarLength: 10,
  pageStartScalars: [0],
});
windowIndex.recordChapter({
  key: key(11),
  contentScalarLength: 10,
  pageStartScalars: [0],
});
windowIndex.recordChapter({
  key: key(12),
  contentScalarLength: 10,
  pageStartScalars: [0],
});
windowIndex.recordChapter({
  key: key(13),
  contentScalarLength: 10,
  pageStartScalars: [0],
});
assert.equal(windowIndex.retainChapterWindow('local', 'book-1', [10, 11, 12]), 1,
  'the session window must evict manifests outside previous/current/next');
assert.equal(windowIndex.has(key(10)), true);
assert.equal(windowIndex.has(key(11)), true);
assert.equal(windowIndex.has(key(12)), true);
assert.equal(windowIndex.has(key(13)), false);

const emptyChapter = key(9);
index.recordChapter({
  key: emptyChapter,
  contentScalarLength: 0,
  pageStartScalars: [0],
});
assert.deepEqual(index.findLastPage(emptyChapter), {
  key: emptyChapter,
  pageIndex: 0,
  startScalar: 0,
  endScalarExclusive: 0,
});
assert.equal(index.invalidateBook('local', 'book-1'), 1);

assert.throws(() => index.recordChapter({
  key: key(1),
  contentScalarLength: 10,
  pageStartScalars: [],
}), /at least one physical page/);
assert.throws(() => index.recordChapter({
  key: key(1),
  contentScalarLength: 10,
  pageStartScalars: [0, 5, 5],
}), /strictly increasing/);
assert.throws(() => index.recordChapter({
  key: key(1),
  contentScalarLength: 10,
  pageStartScalars: [0, 10],
}), /outside chapter content/);
assert.throws(() => index.recordChapter({
  key: key(1, ' ', 'body-v1'),
  contentScalarLength: 10,
  pageStartScalars: [0],
}), /layoutSignature must be a non-blank string/);
assert.throws(() => index.recordChapter({
  key: key(1, 'phone', ' '),
  contentScalarLength: 10,
  pageStartScalars: [0],
}), /contentVersion must be a non-blank string/);
assert.throws(() => index.findContainingPage(key(1), -1), /anchorScalar/);
assert.throws(() => index.findPreviousPage(key(1), 0, {
  ...key(0),
  bookId: 'another-book',
}), /same book/);
assert.throws(() => index.findPreviousPage(key(1), 0, key(0, 'another-layout')), /same layoutSignature/);

console.log('reading pagination index: PASS');

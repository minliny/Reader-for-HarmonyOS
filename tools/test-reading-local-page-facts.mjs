import assert from 'node:assert/strict';

import { ReadingPaginationPrefix } from '../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';

const key = {
  sourceId: 'local', bookId: 'local-page-facts', chapterIndex: 3,
  layoutSignature: 'portrait-font18-line35', contentVersion: 'body-v1',
};
const page = (requestScalar, startScalar, endScalarExclusive) => ({
  requestScalar, startScalar, endScalarExclusive,
});

// A request in a paragraph delimiter still owns that delimiter. Prepending to
// the rendered start would consume it twice and lose the original page seam.
const gapFirst = page(100, 104, 160);
const gap = new ReadingPaginationPrefix(key, gapFirst);
assert.equal(gap.isCanonicalPrefixForChapterStart(0), false);
assert.equal(gap.admit(page(40, 40, 104)), false,
  'a previous page must not run past the original request through a delimiter');
assert.equal(gap.admit(page(40, 40, 99)), false, 'a gap in the measured seam is rejected');
assert.equal(gap.admit(page(40, 40, 101)), false, 'an overlapping seam is rejected');
assert.equal(gap.admit(page(40, 40, 100)), true);
assert.equal(gap.nextRequestForPageStart(40), 100,
  'forward reuse must request the original anchor, not the rendered start');
assert.equal(gap.previousRequestForPageStart(104), 40);
assert.deepEqual(gap.observationForRequest(100), gapFirst);
assert.deepEqual(gap.observationForPageStart(104), gapFirst);
assert.equal(gap.observationForPageStart(100), undefined,
  'a request anchor is not automatically an observed page start');
assert.equal(gap.nextRequestForPageStart(100), undefined);
assert.equal(gap.previousRequestForPageStart(100), undefined);

// Restoring inside a shaped line keeps the complete line. The previous page
// must end at that line's start, while revisiting still uses the interior anchor.
const lineFirst = page(106, 100, 160);
const line = new ReadingPaginationPrefix(key, lineFirst);
assert.equal(line.admit(page(40, 40, 106)), false,
  'the earlier page must not overlap the retained first line');
assert.equal(line.admit(page(40, 40, 100)), true);
assert.equal(line.nextRequestForPageStart(40), 106);
assert.equal(line.previousRequestForPageStart(100), 40);
assert.deepEqual(line.observationForRequest(106), lineFirst);
assert.deepEqual(line.observationForPageStart(100), lineFirst);
assert.equal(line.admit(page(0, 0, 40)), true);
assert.equal(line.startsAtRequest(0), true);
assert.equal(line.isCanonicalPrefixForChapterStart(0), false,
  'reaching chapter head backward does not establish the chapter-head page grid');

// Appending, prepending, and replaying both directions preserve every bound.
assert.equal(line.admit(page(160, 164, 220)), true);
assert.equal(line.admit(page(220, 220, 280)), true);
const starts = [0, 40, 100, 164, 220];
const requests = [0, 40, 106, 160, 220];
assert.deepEqual(line.pageStartScalars(), starts);
assert.equal(line.nextRequestScalar(), 280);
for (let index = 0; index < starts.length; index += 1) {
  assert.equal(line.previousRequestForPageStart(starts[index]), requests[index - 1]);
  assert.equal(line.nextRequestForPageStart(starts[index]), requests[index + 1]);
}
for (const request of [...requests].reverse().concat(requests)) {
  const observed = line.observationForRequest(request);
  assert.ok(observed);
  assert.equal(line.admit(observed), true,
    'backward and forward rematerialization must admit exactly the same physical page');
}
assert.deepEqual(line.pageStartScalars(), starts, 'exact replay never duplicates a fact');
assert.equal(line.nextRequestScalar(), 280, 'replay never shrinks the forward frontier');
assert.equal(line.isCanonicalPrefixForChapterStart(0), false,
  'replay cannot undo the local-grid provenance');

// New requests cannot silently alter an existing range, and original requests
// cannot be assigned changed starts or ends.
for (const invalid of [
  page(106, 101, 160), page(106, 100, 161), page(105, 100, 160),
  page(120, 120, 150), page(281, 281, 340), page(280, 279, 340),
]) {
  assert.equal(line.admit(invalid), false, `reject changed or disjoint fact ${JSON.stringify(invalid)}`);
}
assert.deepEqual(line.pageStartScalars(), starts);
assert.equal(line.observationForRequest(120), undefined);
assert.equal(line.observationForPageStart(120), undefined);
assert.equal(line.nextRequestForPageStart(120), undefined);

// Returning facts or passing mutable inputs must not grant permission to
// mutate the stored original requests/bounds or key.
const mutableKey = { ...key };
const mutableFirst = page(100, 104, 160);
const copies = new ReadingPaginationPrefix(mutableKey, mutableFirst);
mutableFirst.requestScalar = 102;
mutableKey.contentVersion = 'changed-outside';
const mutablePrevious = page(40, 40, 100);
assert.equal(copies.admit(mutablePrevious), true);
mutablePrevious.endScalarExclusive = 101;
const byRequest = copies.observationForRequest(100);
const byStart = copies.observationForPageStart(104);
byRequest.startScalar = 105;
byStart.endScalarExclusive = 161;
const returnedStarts = copies.pageStartScalars();
returnedStarts[0] = 1;
assert.deepEqual(copies.observationForRequest(100), gapFirst);
assert.deepEqual(copies.observationForPageStart(40), page(40, 40, 100));
assert.deepEqual(copies.pageStartScalars(), [40, 104]);
assert.equal(copies.matches(key), true);
for (const changedKey of [
  { ...key, layoutSignature: 'landscape-font18-line35' },
  { ...key, contentVersion: 'body-v2' },
  { ...key, sourceId: 'other-source' },
  { ...key, bookId: 'other-book' },
  { ...key, chapterIndex: 4 },
]) {
  assert.equal(copies.matches(changedKey), false,
    'callers must reject local facts belonging to another layout/body/read scope');
}

// Initial chapter-head runs retain canonical eligibility after append/replay;
// delimiter-only leading text need not itself be a rendered page start.
const canonical = new ReadingPaginationPrefix(key, page(0, 4, 60));
assert.equal(canonical.isCanonicalPrefixForChapterStart(0), true);
assert.equal(canonical.isCanonicalPrefixForChapterStart(4), false);
assert.equal(canonical.admit(page(60, 60, 120)), true);
assert.equal(canonical.admit(page(0, 4, 60)), true);
assert.equal(canonical.admit(page(10, 10, 50)), false);
assert.equal(canonical.isCanonicalPrefixForChapterStart(0), true);
const nonzeroHead = new ReadingPaginationPrefix(key, page(2, 2, 60));
assert.equal(nonzeroHead.isCanonicalPrefixForChapterStart(2), true);
assert.equal(nonzeroHead.isCanonicalPrefixForChapterStart(0), false);
assert.equal(nonzeroHead.admit(page(0, 0, 2)), true);
assert.equal(nonzeroHead.isCanonicalPrefixForChapterStart(0), false);

// A prepended page may itself retain a complete line before its request;
// adjoining end equality already proves that it cannot overlap the next page.
const earlierInterior = new ReadingPaginationPrefix(key, page(100, 100, 160));
assert.equal(earlierInterior.admit(page(45, 40, 100)), true);
assert.equal(earlierInterior.admit(page(0, 0, 40)), true);
assert.equal(earlierInterior.nextRequestForPageStart(0), 45);
assert.equal(earlierInterior.nextRequestForPageStart(40), 100);
assert.equal(earlierInterior.isCanonicalPrefixForChapterStart(0), false);

for (const lookup of [
  'observationForRequest', 'observationForPageStart', 'nextRequestForPageStart',
  'isCanonicalPrefixForChapterStart',
]) {
  assert.throws(() => line[lookup](-1), /non-negative safe integer/);
  assert.throws(() => line[lookup](0.5), /non-negative safe integer/);
}
assert.throws(() => line.admit(page(0, 0, 0)), /must follow requestScalar/);

console.log('reading local page facts: exact bidirectional seams, replay, scope and canonical eligibility passed');

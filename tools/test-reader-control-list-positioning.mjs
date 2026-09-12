import assert from 'node:assert/strict';
import {
  beginReaderControlListOpen,
  commitReaderControlListPosition,
  createReaderControlListPositioning,
  endReaderControlListOpen,
  markReaderControlListUserScrolled,
  prepareReaderControlListPosition,
  readerControlCenteredListOffset,
  readerControlDirectoryTargetRow,
  readerControlListPositionIsCurrent,
  readerControlNearestBookmarkRow,
  readerControlUniformListViewport,
  retainReaderControlListPositioning,
} from '../entry/src/main/ets/features/reading/ReaderControlListPositioning.ts';

// Expectations come from execution reference D-01/D-03, not a copied sampler.
const bookmarks = [
  { chapterOrdinal: 12, chapterOffset: 1, time: 1 },
  { chapterOrdinal: 8, chapterOffset: 900, time: 2 },
  { chapterOrdinal: 8, chapterOffset: 20, time: 9000 },
  { chapterOrdinal: 30, chapterOffset: 0, time: 0 },
];
const originalBookmarks = structuredClone(bookmarks);
assert.equal(readerControlNearestBookmarkRow(bookmarks, 10), 2,
  'equidistant chapters choose the earlier chapter, then earlier scalar, not creation time');
assert.equal(readerControlNearestBookmarkRow(bookmarks, 11), 0,
  'chapter distance wins over an earlier chapter when distances differ');
assert.equal(readerControlNearestBookmarkRow(bookmarks, 8), 2,
  'same-chapter proximity ignores the current scalar and chooses the earlier reading anchor');
assert.deepEqual(bookmarks, originalBookmarks, 'position selection must never sort the business projection');
assert.equal(readerControlNearestBookmarkRow([
  { chapterOrdinal: 4, chapterOffset: 8 },
  { chapterOrdinal: 4, chapterOffset: 8 },
], 4), 0, 'identical reading anchors retain deterministic existing order');
assert.equal(readerControlNearestBookmarkRow([], 4), undefined);
assert.equal(readerControlNearestBookmarkRow(bookmarks, -1), undefined);
assert.equal(readerControlNearestBookmarkRow(bookmarks, NaN), undefined);
assert.equal(readerControlNearestBookmarkRow([
  { chapterOrdinal: -1, chapterOffset: 0 },
  { chapterOrdinal: 1, chapterOffset: NaN },
  { chapterOrdinal: 2.5, chapterOffset: 0 },
  { chapterOrdinal: 3, chapterOffset: -2 },
], 2), undefined, 'invalid data cannot fabricate an anchor');

const descendingDirectory = [
  { coreIndex: 900, chapterOrdinal: 2 },
  { coreIndex: 100, chapterOrdinal: 1 },
  { coreIndex: 7, chapterOrdinal: 0 },
];
assert.equal(readerControlDirectoryTargetRow(descendingDirectory, 1), 1);
assert.equal(readerControlDirectoryTargetRow(descendingDirectory, 0), 2,
  'the visible row need not equal its canonical ordinal or Core id');
assert.equal(readerControlDirectoryTargetRow(descendingDirectory, 7), undefined);
assert.equal(readerControlDirectoryTargetRow([], 0), undefined);

const layout = {
  rowCount: 20, rowIndex: 10, rowHeight: 40, rowSpacing: 2,
  paddingTop: 3, paddingBottom: 5, viewportHeight: 200,
};
const viewport = readerControlUniformListViewport(layout);
assert.deepEqual(viewport, { viewportHeight: 200, contentHeight: 846, targetTop: 423, targetHeight: 40 });
assert.equal(readerControlCenteredListOffset(viewport), 343);
assert.equal(readerControlCenteredListOffset(readerControlUniformListViewport({ ...layout, rowIndex: 0 })), 0);
assert.equal(readerControlCenteredListOffset(readerControlUniformListViewport({ ...layout, rowIndex: 19 })), 646,
  'last row clamps to real content bounds, without extra blank padding');
assert.equal(readerControlCenteredListOffset(readerControlUniformListViewport({ ...layout, viewportHeight: 400 })), 243,
  'the actual viewport, not a hardcoded Quick height, controls centering');
assert.equal(readerControlCenteredListOffset(readerControlUniformListViewport({ ...layout, viewportHeight: 1000 })), 0);
assert.equal(readerControlCenteredListOffset({ viewportHeight: 100, contentHeight: 150, targetTop: 41, targetHeight: 63 }), 22.5,
  'measured variable-height target rows are supported');
for (const invalid of [
  { ...layout, rowCount: 0 }, { ...layout, rowCount: 1.5 }, { ...layout, rowIndex: -1 },
  { ...layout, rowIndex: 20 }, { ...layout, rowHeight: 0 }, { ...layout, rowSpacing: -1 },
  { ...layout, viewportHeight: 0 }, { ...layout, paddingTop: -1 }, { ...layout, paddingBottom: NaN },
]) {
  assert.equal(readerControlUniformListViewport(invalid), undefined);
}
for (const invalid of [
  { ...viewport, viewportHeight: 0 }, { ...viewport, contentHeight: 0 },
  { ...viewport, targetTop: -1 }, { ...viewport, targetHeight: 0 },
  { ...viewport, targetTop: 840 }, { ...viewport, viewportHeight: Infinity },
]) {
  assert.equal(readerControlCenteredListOffset(invalid), undefined);
}

let state = createReaderControlListPositioning();
assert.equal(state.status, 'inactive');
assert.throws(() => beginReaderControlListOpen(state, '', 1));
assert.throws(() => beginReaderControlListOpen(state, 'book-A:directory', -1));
state = beginReaderControlListOpen(state, 'book-A:directory', 10);
const firstOpen = state.listOpenRevision;
assert.equal(state.status, 'pending');
assert.equal(state.currentChapterOrdinal, 10);
let prepared = prepareReaderControlListPosition(state, firstOpen, false, viewport);
state = prepared.state;
assert.equal(prepared.command, undefined, 'loading does not fake a scroll');
prepared = prepareReaderControlListPosition(state, firstOpen, true, undefined);
state = prepared.state;
assert.equal(prepared.command, undefined, 'empty, missing or unmeasured target does not fake a scroll');
prepared = prepareReaderControlListPosition(state, firstOpen, true, viewport);
state = prepared.state;
assert.equal(prepared.command.yOffset, 343, 'late data may position once when the user has not scrolled');
const firstCommand = prepared.command;
assert.equal(readerControlListPositionIsCurrent(state, firstCommand), true);
const sameList = retainReaderControlListPositioning(state);
assert.equal(sameList, state, 'Quick/Full morph, re-grab and close cancellation do not reopen the list');
assert.equal(readerControlListPositionIsCurrent(sameList, firstCommand), true);
state = commitReaderControlListPosition(state, firstCommand);
assert.equal(state.status, 'positioned');
assert.equal(readerControlListPositionIsCurrent(state, firstCommand), false);
assert.equal(commitReaderControlListPosition(state, firstCommand), state, 'a queued command is consumed only once');
assert.equal(prepareReaderControlListPosition(state, firstOpen, true, { ...viewport, targetTop: 0 }).command, undefined,
  'data refresh and resize after positioning cannot recenter this opening');

state = beginReaderControlListOpen(state, 'book-A:bookmarks', 10);
const bookmarkOpen = state.listOpenRevision;
prepared = prepareReaderControlListPosition(state, bookmarkOpen, true, viewport);
state = prepared.state;
const queuedBeforeDrag = prepared.command;
state = markReaderControlListUserScrolled(state, bookmarkOpen);
assert.equal(state.status, 'userScrolled');
assert.equal(readerControlListPositionIsCurrent(state, queuedBeforeDrag), false,
  'the user may start scrolling between scheduling and applying the placement');
assert.equal(commitReaderControlListPosition(state, queuedBeforeDrag), state);
assert.equal(prepareReaderControlListPosition(state, bookmarkOpen, true, viewport).command, undefined,
  'late data cannot steal the viewport after user scroll');
assert.equal(retainReaderControlListPositioning(state), state, 'cancelled close preserves the user-scroll guard');

state = beginReaderControlListOpen(state, 'book-A:bookmarks', 30);
const reopened = state.listOpenRevision;
assert.ok(reopened > bookmarkOpen, 'new opening must allocate a fresh token even for the same list key');
assert.equal(state.currentChapterOrdinal, 30, 'reopening captures the current reading chapter, not the old one');
assert.equal(state.status, 'pending');
assert.equal(markReaderControlListUserScrolled(state, bookmarkOpen), state, 'old List callbacks cannot mark a new opening');
assert.equal(prepareReaderControlListPosition(state, bookmarkOpen, true, viewport).state, state);
prepared = prepareReaderControlListPosition(state, reopened, true, viewport);
state = prepared.state;
const staleProjectionCommand = prepared.command;
prepared = prepareReaderControlListPosition(state, reopened, false, undefined);
state = prepared.state;
assert.equal(readerControlListPositionIsCurrent(state, staleProjectionCommand), false,
  'replacement data going back to loading invalidates an already queued old projection');
prepared = prepareReaderControlListPosition(state, reopened, true, { ...viewport, targetTop: 213 });
state = prepared.state;
const latestCommand = prepared.command;
assert.equal(latestCommand.yOffset, 133);
assert.equal(readerControlListPositionIsCurrent(state, latestCommand), true);
assert.equal(readerControlListPositionIsCurrent(state, { ...latestCommand, listKey: 'book-B:bookmarks' }), false);
assert.equal(readerControlListPositionIsCurrent(state, { ...latestCommand, yOffset: NaN }), false);
state = endReaderControlListOpen(state);
assert.equal(state.status, 'inactive');
assert.equal(readerControlListPositionIsCurrent(state, latestCommand), false, 'committed close invalidates old placement');
assert.equal(markReaderControlListUserScrolled(state, state.listOpenRevision), state);
state = beginReaderControlListOpen(state, 'book-B:directory', 0);
assert.equal(state.status, 'pending');
assert.equal(readerControlListPositionIsCurrent(state, latestCommand), false);
assert.throws(() => beginReaderControlListOpen({ ...state, listOpenRevision: Number.MAX_SAFE_INTEGER }, 'book-B:directory', 0),
  'revision exhaustion must not recycle a token that could admit an ancient callback');

console.log('reader control list positioning: production policy tests passed');

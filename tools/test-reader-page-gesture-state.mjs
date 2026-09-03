import assert from 'node:assert/strict';

import {
  READER_PAGE_GESTURE_BOOKMARK_SLOP,
  READER_PAGE_GESTURE_LONG_PRESS_MS,
  READER_PAGE_GESTURE_TOUCH_SLOP,
  READER_PAGE_GESTURE_VERTICAL_PREVIOUS_SLOP,
  abandonReaderPageGestureTracking,
  beginReaderPageGesture,
  cancelReaderPagePan,
  completeReaderPageGestureSettlement,
  createReaderPageGestureState,
  finishReaderPagePan,
  moveReaderPageGesture,
  readerPageGestureCanTap,
  readerPagePointerCoordinate,
  readerPageTapIntent,
  settleReaderPageGesture,
  startReaderPagePan,
  updateReaderPagePan,
  updateReaderPagePanInPlace,
} from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';

assert.equal(READER_PAGE_GESTURE_TOUCH_SLOP, 8);
assert.equal(READER_PAGE_GESTURE_LONG_PRESS_MS, 500);
assert.equal(READER_PAGE_GESTURE_VERTICAL_PREVIOUS_SLOP, 24);
assert.equal(READER_PAGE_GESTURE_BOOKMARK_SLOP, 48);

assert.equal(readerPagePointerCoordinate(240, 320, 320), 240);
assert.equal(readerPagePointerCoordinate(240, 320, 400), 300);
assert.equal(readerPagePointerCoordinate(180, 0, 720), 180);

let state = createReaderPageGestureState();
assert.equal(state.phase, 'idle');
assert.equal(state.owner, 'undecided');

// The live path mutates one object and preserves physical P0/current coordinates.
state = beginReaderPageGesture(300, 290, 450, 900, 800);
const same = state;
assert.equal(updateReaderPagePanInPlace(state, -30, 12, -500, 260, 462, 120, 916), same);
assert.equal(state.startLocalX, 290);
assert.equal(state.startLocalY, 450);
assert.equal(state.currentLocalX, 260);
assert.equal(state.currentLocalY, 462);
assert.equal(state.owner, 'horizontalPage');
assert.equal(state.direction, 'next');

// Below 8vp has no owner and no preview; a clean release remains a tap candidate.
state = beginReaderPageGesture(300, 150, 400, 1000, 800);
state = moveReaderPageGesture(state, 7.9, 0, 0, 157.9, 400, 0, 1100);
assert.equal(state.phase, 'tracking');
assert.equal(state.owner, 'undecided');
assert.equal(readerPageGestureCanTap(state, 1200), true);
let decision = settleReaderPageGesture(state, 7.9, 0, 5000, 157.9, 400, 0, 1200);
assert.equal(decision.direction, undefined, 'velocity cannot replace the frozen distance result');

// Exactly 8vp locks horizontally. Same-sample vertical threshold crossings lose to X.
state = beginReaderPageGesture(300, 200, 400, 0, 800);
state = moveReaderPageGesture(state, -8, 100, 0, 192, 500, 0, 16);
assert.equal(state.owner, 'horizontalPage');
assert.equal(state.axis, 'horizontal');
assert.equal(state.direction, 'next');

// Once horizontal ownership locks, arbitrary later vertical travel cannot revoke it.
state = moveReaderPageGesture(state, -20, -700, 0, 180, -300, 0, 32);
assert.equal(state.owner, 'horizontalPage');
assert.equal(state.direction, 'next');
decision = settleReaderPageGesture(state, -8, 1200, 0, 192, 1600, 0, 48);
assert.equal(decision.direction, 'next');

// Final relative displacement alone decides. Returning inside 8vp rolls back;
// a very fast 8vp light flick commits immediately.
state = beginReaderPageGesture(300, 200, 400, 0, 800);
state = moveReaderPageGesture(state, -80, 0, 0, 120, 400, 0, 16);
decision = settleReaderPageGesture(state, -7.99, 0, -9000, 192.01, 400, 0, 32);
assert.equal(decision.direction, undefined);
assert.equal(decision.state.settleTarget, 'rollback');
state = beginReaderPageGesture(300, 200, 400, 0, 800);
decision = settleReaderPageGesture(state, -8, 0, -1, 192, 400, 0, 1);
assert.equal(decision.direction, 'next');
assert.equal(decision.state.settleTarget, 'commit');

// Crossing P0 cannot switch the locked direction, even if opposite travel is large.
state = beginReaderPageGesture(300, 200, 400, 0, 800);
state = moveReaderPageGesture(state, -20, 0, 0, 180, 400, 0, 16);
state = moveReaderPageGesture(state, 120, 0, 0, 320, 400, 0, 32);
assert.equal(state.direction, 'next');
assert.equal(state.reversed, true);
decision = settleReaderPageGesture(state, 120, 0, 5000, 320, 400, 0, 48);
assert.equal(decision.direction, undefined);

// Pure up within |dx|<8 owns previous page at 24vp and stays page-owned.
state = beginReaderPageGesture(300, 180, 500, 0, 800);
state = moveReaderPageGesture(state, 2, -24, 0, 182, 476, 0, 16);
assert.equal(state.owner, 'verticalPrevious');
assert.equal(state.verticalPrevious, true);
assert.equal(state.direction, 'previous');
state = moveReaderPageGesture(state, 100, -40, 0, 280, 460, 0, 32);
assert.equal(state.owner, 'verticalPrevious', 'later X cannot create a second gesture segment');
decision = settleReaderPageGesture(state, 100, -24, 0, 280, 476, 0, 48);
assert.equal(decision.direction, 'previous');

// Downward bookmark owns at 48vp, moves the page at 1:2, and caps at H/2.
state = beginReaderPageGesture(300, 150, 100, 0, 800);
state = moveReaderPageGesture(state, 0, 48, 0, 150, 148, 0, 16);
assert.equal(state.owner, 'bookmark');
assert.equal(state.bookmarkOffsetY, 24);
assert.equal(state.bookmarkPreviewChanged, true);
state = moveReaderPageGesture(state, 0, 800, 0, 150, 900, 0, 32);
assert.equal(state.bookmarkOffsetY, 400);
assert.equal(state.bookmarkPeakDistance, 800);
state = moveReaderPageGesture(state, 0, 399, 0, 150, 499, 0, 48);
assert.equal(state.bookmarkPreviewChanged, false, 'below half peak withdraws the preview toggle');
state = moveReaderPageGesture(state, 0, 401, 0, 150, 501, 0, 64);
assert.equal(state.bookmarkPreviewChanged, true);
decision = settleReaderPageGesture(state, 0, 401, 0, 150, 501, 0, 80);
assert.equal(decision.bookmarkChanged, true);
assert.equal(decision.direction, undefined);

// A 500ms stationary stream belongs to long press; historical movement >=8
// can never return to tap merely because the finger came back to P0.
state = beginReaderPageGesture(300, 150, 400, 1000, 800);
state = moveReaderPageGesture(state, 0, 0, 0, 150, 400, 0, 1500);
assert.equal(state.owner, 'longPress');
assert.equal(readerPageGestureCanTap(state, 1500), false);
state = beginReaderPageGesture(300, 150, 400, 1000, 800);
state = moveReaderPageGesture(state, 7, 4, 0, 157, 404, 0, 1100);
state = moveReaderPageGesture(state, 0, 0, 0, 150, 400, 0, 1200);
assert.ok(state.maxDistance2D >= 8);
assert.equal(readerPageGestureCanTap(state, 1200), false);

// System CANCEL always produces rollback and cannot emit a page/bookmark result.
state = beginReaderPageGesture(300, 280, 400, 0, 800);
state = moveReaderPageGesture(state, -60, 0, 0, 220, 400, 0, 16);
state = cancelReaderPagePan(state);
assert.equal(state.phase, 'settling');
assert.equal(state.settleTarget, 'rollback');
assert.equal(finishReaderPagePan(state, -100, 0, -2000).direction, undefined);
state = completeReaderPageGestureSettlement(state);
assert.equal(state.phase, 'idle');

state = beginReaderPageGesture(300, 150, 400, 0, 800);
state = abandonReaderPageGestureTracking(state);
assert.equal(state.phase, 'idle');

// Compatibility wrappers use the same frozen semantics.
state = startReaderPagePan(300, 200, 400, 0, 800);
state = updateReaderPagePan(state, 8, 0, 0);
decision = finishReaderPagePan(state, 8, 0, 0);
assert.equal(decision.direction, 'previous');

assert.equal(readerPageTapIntent(10, 300), 'previous');
assert.equal(readerPageTapIntent(150, 300), 'control');
assert.equal(readerPageTapIntent(290, 300), 'next');
assert.equal(readerPageTapIntent(-1, 300), undefined);

console.log('reader page-gesture pure state: PASS');

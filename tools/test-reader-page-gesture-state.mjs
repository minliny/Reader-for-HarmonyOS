import assert from 'node:assert/strict';

import {
  READER_PAGE_GESTURE_BOOKMARK_SLOP,
  READER_PAGE_GESTURE_AXIS_DOMINANCE,
  READER_PAGE_GESTURE_DIRECTION_CONFIRM_SLOP,
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
  resumeReaderPagePan,
  settleReaderPageGesture,
  startReaderPagePan,
  updateReaderPagePan,
  updateReaderPagePanInPlace,
} from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';

assert.equal(READER_PAGE_GESTURE_TOUCH_SLOP, 8);
assert.equal(READER_PAGE_GESTURE_DIRECTION_CONFIRM_SLOP, 16);
assert.equal(READER_PAGE_GESTURE_AXIS_DOMINANCE, 1.5);
assert.equal(READER_PAGE_GESTURE_LONG_PRESS_MS, 500);
assert.equal(READER_PAGE_GESTURE_VERTICAL_PREVIOUS_SLOP, 24);
assert.equal(READER_PAGE_GESTURE_BOOKMARK_SLOP, 48);

assert.equal(readerPagePointerCoordinate(240, 320, 320), 240);
assert.equal(readerPagePointerCoordinate(240, 320, 400), 300);
assert.equal(readerPagePointerCoordinate(180, 0, 720), 180);

let state = createReaderPageGestureState();
assert.equal(state.phase, 'idle');
assert.equal(state.owner, 'undecided');
assert.equal(state.inputOffsetX, 0);
assert.equal(state.inputOffsetY, 0);

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
assert.equal(decision.direction, undefined, 'velocity cannot replace the physical distance result');

// 8vp rules out a tap but remains a spatial candidate until a clear 16vp axis.
state = beginReaderPageGesture(300, 200, 400, 0, 800);
state = moveReaderPageGesture(state, -8, 0, 0, 192, 400, 0, 16);
assert.equal(state.owner, 'undecided');
assert.equal(state.axis, 'undecided');
assert.equal(state.phase, 'tracking');
assert.equal(readerPageGestureCanTap(state, 16), false);
state = moveReaderPageGesture(state, -15.99, 0, -9000, 184.01, 400, 0, 17);
assert.equal(state.owner, 'undecided', 'fast motion cannot bypass spatial confirmation');
state = moveReaderPageGesture(state, -16, 0, 0, 184, 400, 0, 18);
assert.equal(state.owner, 'horizontalPage');
assert.equal(state.axis, 'horizontal');
assert.equal(state.direction, 'next');

// A published horizontal page keeps its owner but rolls back after a clear
// vertical redirection. It never converts the same pointer into a bookmark.
state = moveReaderPageGesture(state, -20, -700, 0, 180, -300, 0, 32);
assert.equal(state.owner, 'horizontalPage');
assert.equal(state.direction, 'next');
decision = settleReaderPageGesture(state, -8, 1200, 0, 192, 1600, 0, 48);
assert.equal(decision.direction, undefined);
assert.equal(decision.bookmarkChanged, false);
assert.equal(decision.state.owner, 'horizontalPage');
assert.equal(decision.state.settleTarget, 'rollback');
for (const sign of [-1, 1]) for (const verticalSign of [-1, 1]) {
  const horizontal = moveReaderPageGesture(beginReaderPageGesture(300), sign * 20, 0);
  assert.equal(settleReaderPageGesture(horizontal, sign * 20, verticalSign * 29.99).direction,
    sign < 0 ? 'next' : 'previous', 'small vertical drift retains the confirmed horizontal owner');
  assert.equal(settleReaderPageGesture(horizontal, sign * 20, verticalSign * 30).direction,
    undefined, 'clear final vertical dominance cancels either horizontal direction');
}

// Early X noise can change candidate before any page-owned visual is admitted.
state = beginReaderPageGesture(300, 200, 400, 0, 800);
state = moveReaderPageGesture(state, 9, 2, 5000, 209, 402, 0, 16);
assert.equal(state.owner, 'undecided');
state = moveReaderPageGesture(state, 10, 120, 5000, 210, 520, 0, 32);
assert.equal(state.owner, 'bookmark');
assert.equal(state.direction, undefined);
assert.equal(state.currentDirection, undefined);
assert.equal(state.bookmarkOffsetY, 52);
decision = settleReaderPageGesture(state, 10, 120);
assert.equal(decision.bookmarkChanged, true);
assert.equal(decision.direction, undefined);

// One large sample uses the main axis, including the old X-first failure.
state = moveReaderPageGesture(beginReaderPageGesture(300, 200, 400, 0, 800), -8, 100);
assert.equal(state.owner, 'bookmark');
assert.equal(state.direction, undefined);
assert.equal(settleReaderPageGesture(state, -8, 100).bookmarkChanged, true);

for (const sign of [-1, 1]) {
  state = moveReaderPageGesture(beginReaderPageGesture(300), sign * 23.99, 16);
  assert.equal(state.owner, 'undecided', 'an ambiguous diagonal has no published owner');
  state = moveReaderPageGesture(state, sign * 24, 16);
  assert.equal(state.owner, 'horizontalPage', 'exact 1.5 main-axis dominance is admitted');
}
state = moveReaderPageGesture(beginReaderPageGesture(300, 0, 0, 0, 800), 16, 24);
assert.equal(state.owner, 'bookmark');
assert.equal(state.direction, undefined);

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

// Upward motion confirms at16vp, commits at24vp and stays page-owned.
state = beginReaderPageGesture(300, 180, 500, 0, 800);
state = moveReaderPageGesture(state, 2, -16, 0, 182, 484, 0, 8);
assert.equal(state.owner, 'verticalPrevious');
assert.equal(settleReaderPageGesture(state, 2, -23.99).direction, undefined);
state = moveReaderPageGesture(state, 2, -24, 0, 182, 476, 0, 16);
assert.equal(state.owner, 'verticalPrevious');
assert.equal(state.verticalPrevious, true);
assert.equal(state.direction, 'previous');
state = moveReaderPageGesture(state, 100, -40, 0, 280, 460, 0, 32);
assert.equal(state.owner, 'verticalPrevious', 'later X cannot create a second gesture segment');
decision = settleReaderPageGesture(state, 100, -24, 0, 280, 476, 0, 48);
assert.equal(decision.direction, 'previous');

// Bookmark ownership is admitted before its commit threshold. Only travel
// beyond the16vp confirmation band moves the page, retaining the H/2 cap.
state = beginReaderPageGesture(300, 150, 100, 0, 800);
state = moveReaderPageGesture(state, 0, 16, 0, 150, 116, 0, 8);
assert.equal(state.owner, 'bookmark');
assert.equal(state.bookmarkOffsetY, 0);
assert.equal(state.bookmarkPreviewChanged, false);
state = moveReaderPageGesture(state, 0, 48, 0, 150, 148, 0, 16);
assert.equal(state.owner, 'bookmark');
assert.equal(state.bookmarkOffsetY, 16);
assert.equal(state.bookmarkPreviewChanged, true);
state = moveReaderPageGesture(state, 0, 800, 0, 150, 900, 0, 32);
assert.equal(state.bookmarkOffsetY, 392);
assert.equal(state.bookmarkPeakDistance, 800);
state = moveReaderPageGesture(state, 0, 399, 0, 150, 499, 0, 48);
assert.equal(state.bookmarkPreviewChanged, false, 'below half peak withdraws the preview toggle');
state = moveReaderPageGesture(state, 0, 401, 0, 150, 501, 0, 64);
assert.equal(state.bookmarkPreviewChanged, true);
decision = settleReaderPageGesture(state, 0, 401, 0, 150, 501, 0, 80);
assert.equal(decision.bookmarkChanged, true);
assert.equal(decision.direction, undefined);
state = moveReaderPageGesture(beginReaderPageGesture(300, 0, 0, 0, 800), 0, 1000);
assert.equal(state.bookmarkOffsetY, 400);
state = moveReaderPageGesture(state, 500, 1000);
assert.equal(state.owner, 'bookmark', 'later X never steals an admitted bookmark');
assert.equal(state.direction, undefined);
assert.equal(state.currentDirection, undefined);
assert.equal(settleReaderPageGesture(state, 500, 1000).direction, undefined);

for (const sign of [-1, 1]) {
  state = moveReaderPageGesture(beginReaderPageGesture(300, 0, 0, 0, 800), 0, 60);
  state = moveReaderPageGesture(state, sign * 12, 60);
  assert.equal(state.bookmarkPreviewChanged, true, 'small left/right drift preserves the bookmark');
  const changed = moveReaderPageGesture(state, sign * 150, 60);
  assert.equal(changed.owner, 'bookmark');
  assert.equal(changed.direction, undefined);
  assert.equal(changed.bookmarkPreviewChanged, false, 'a clear horizontal redirection withdraws the bookmark');
  const cancelled = settleReaderPageGesture(changed, sign * 150, 60);
  assert.equal(cancelled.direction, undefined);
  assert.equal(cancelled.bookmarkChanged, false);
  assert.equal(cancelled.state.settleTarget, 'rollback');
  state = moveReaderPageGesture(changed, sign * 12, 60);
  assert.equal(state.bookmarkPreviewChanged, true, 'returning to the admitted pull restores its preview');
  assert.equal(settleReaderPageGesture(state, sign * 12, 60).bookmarkChanged, true);
}

// Classification and tap history use physical vp, while rendering keeps the
// independent stage coordinates and progress. Large stage scale is not slop.
state = beginReaderPageGesture(300, 200, 100, 0, 800);
state = moveReaderPageGesture(state, -80, 0, 0, 120, 100, 0, 16, -7.4, 0);
assert.equal(state.currentOffsetX, -80);
assert.equal(state.inputOffsetX, -7.4);
assert.equal(state.progress, 80 / 300);
assert.equal(state.owner, 'undecided');
assert.equal(readerPageGestureCanTap(state, 16), true);
decision = settleReaderPageGesture(state, -90, 0, -9000, 110, 100, 0, 32, -7.99, 0);
assert.equal(decision.direction, undefined);
state = moveReaderPageGesture(beginReaderPageGesture(300), 30, 200, 0, 30, 200, 0, 16, 16, 0);
assert.equal(state.owner, 'horizontalPage');
assert.equal(settleReaderPageGesture(state, 15, 900, 0, 15, 900, 0, 32, 8, 0).direction, 'previous',
  'stage Y cannot cancel a physically horizontal release');
state = beginReaderPageGesture(300, 200, 100, 0, 800);
state = moveReaderPageGesture(state, 0, 160, 0, 200, 260, 0, 16, 0, 16);
assert.equal(state.owner, 'bookmark');
assert.equal(state.bookmarkOffsetY, 0);
state = moveReaderPageGesture(state, 0, 480, 0, 200, 580, 0, 32, 0, 48);
assert.equal(state.currentOffsetY, 480);
assert.equal(state.inputOffsetY, 48);
assert.equal(state.bookmarkPeakDistance, 48);
assert.equal(state.bookmarkOffsetY, 16);
assert.equal(settleReaderPageGesture(state, 0, 240, 0, 200, 340, 0, 48, 0, 24).bookmarkChanged, true);
assert.equal(settleReaderPageGesture(state, 0, 240, 0, 200, 340, 0, 48, 0, 23.99).bookmarkChanged, false);
state = moveReaderPageGesture(beginReaderPageGesture(300, 0, 0, 0, 800), 180, 120, 0, 180, 120, 0, 16, 12, 60);
assert.equal(state.owner, 'bookmark', 'raw Y selects bookmark even if stage X is larger');
assert.equal(state.bookmarkPreviewChanged, true);
state = moveReaderPageGesture(state, 20, 120, 0, 20, 120, 0, 32, 150, 60);
assert.equal(state.bookmarkPreviewChanged, false, 'raw horizontal redirection cancels despite stage Y dominance');

// The UP admission pass can be called in-place before final dispatch; all
// wrappers propagate its physical input and consume the segment only once.
state = beginReaderPageGesture(300, 200, 400, 0, 800);
const finalObject = state;
updateReaderPagePanInPlace(state, -24, 0, 0, 176, 400, 0, 16, -8, 0, true);
assert.equal(state, finalObject);
assert.equal(state.owner, 'horizontalPage');
assert.equal(state.inputOffsetX, -8);
assert.equal(state.currentOffsetX, -24);
decision = finishReaderPagePan(state, -24, 0, 0, 176, 400, 0, 16, -8, 0);
assert.equal(decision.direction, 'next');
assert.equal(finishReaderPagePan(decision.state, -24, 0).direction, undefined);
state = updateReaderPagePan(beginReaderPageGesture(300), 24, 0, 0, 24, 0, 0, 16, 8, 0, true);
assert.equal(state.owner, 'horizontalPage');
assert.equal(state.inputOffsetX, 8);

// Straight trajectories have one terminal action regardless of MOVE density;
// no mandatory second sample or elapsed-time recognition delay is introduced.
for (const [endX, endY] of [[12, 120], [-12, 120], [64, 12.8], [-64, 12.8], [12, -60], [8, 0], [7.99, 0], [0, 48], [0, 47.99], [0, -24], [0, -23.99], [80, 80]]) {
  const outcomes = [];
  for (const fractions of [[0.1, 0.2, 0.3, 0.5, 0.8], [0.6], []]) {
    let path = beginReaderPageGesture(300, 150, 100, 0, 800);
    for (const fraction of fractions) {
      path = moveReaderPageGesture(path, endX * fraction, endY * fraction,
        9000, 150 + endX * fraction, 100 + endY * fraction, -9000, fraction * 100);
    }
    const result = settleReaderPageGesture(path, endX, endY, -9000,
      150 + endX, 100 + endY, 9000, 100);
    outcomes.push([result.direction, result.bookmarkChanged, result.state.settleTarget]);
  }
  assert.deepEqual(outcomes[1], outcomes[0], `sparse MOVE agrees for ${endX}/${endY}`);
  assert.deepEqual(outcomes[2], outcomes[0], `UP-only agrees for ${endX}/${endY}`);
}

// A known re-grab pose bypasses candidate confirmation, even near rest.
state = resumeReaderPagePan('next', -3, 300, 800, 200, 400, 100);
assert.equal(state.owner, 'horizontalPage');
assert.equal(state.phase, 'dragging');
assert.equal(state.currentOffsetX, -3);
assert.equal(state.inputOffsetX, -3);
state = moveReaderPageGesture(state, -30, 0, 0, 173, 400, 0, 116, -20, 0);
assert.equal(state.owner, 'horizontalPage');
assert.equal(finishReaderPagePan(state, -30, 0, 0, 173, 400, 0, 132, -20, 0).direction, 'next');

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

// Compatibility wrappers retain old call signatures and use the same UP rule.
state = startReaderPagePan(300, 200, 400, 0, 800);
state = updateReaderPagePan(state, 8, 0, 0);
decision = finishReaderPagePan(state, 8, 0, 0);
assert.equal(decision.direction, 'previous');

assert.equal(readerPageTapIntent(10, 300), 'previous');
assert.equal(readerPageTapIntent(150, 300), 'control');
assert.equal(readerPageTapIntent(290, 300), 'next');
assert.equal(readerPageTapIntent(-1, 300), undefined);

console.log('reader page-gesture pure state: PASS');

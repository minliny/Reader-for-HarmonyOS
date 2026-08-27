import assert from 'node:assert/strict';

import {
  READER_PAGE_GESTURE_COMMIT_RATIO,
  READER_PAGE_GESTURE_FLICK_MIN_RATIO,
  READER_PAGE_GESTURE_FLICK_VELOCITY,
  READER_PAGE_GESTURE_HORIZONTAL_BIAS,
  READER_PAGE_GESTURE_MAX_DRAG_RATIO,
  READER_PAGE_GESTURE_TOUCH_SLOP,
  abandonReaderPageGestureTracking,
  beginReaderPageGesture,
  cancelReaderPagePan,
  completeReaderPageGestureSettlement,
  createReaderPageGestureState,
  finishReaderPagePan,
  moveReaderPageGesture,
  projectReaderPageCurlGesture,
  readerPageTapIntent,
  settleReaderPageGesture,
  startReaderPagePan,
  updateReaderPagePan,
} from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';

assert.equal(READER_PAGE_GESTURE_TOUCH_SLOP, 8);
assert.equal(READER_PAGE_GESTURE_HORIZONTAL_BIAS, 0.9);
assert.equal(READER_PAGE_GESTURE_MAX_DRAG_RATIO, 0.75);
assert.equal(READER_PAGE_GESTURE_COMMIT_RATIO, 0.28);
assert.equal(READER_PAGE_GESTURE_FLICK_MIN_RATIO, 0.08);
assert.equal(READER_PAGE_GESTURE_FLICK_VELOCITY, 900);

let state = createReaderPageGestureState();
assert.equal(state.phase, 'idle');
assert.equal(state.active, false);
assert.equal(state.consumed, false);
assert.equal(state.direction, undefined);
assert.equal(state.currentOffsetX, 0);
assert.equal(state.currentOffsetY, 0);
assert.equal(state.progress, 0);

// Page-local pointer coordinates are preserved independently from total Pan
// displacement so native curl can anchor to the actual finger height/corner.
state = beginReaderPageGesture(300, 0, 0, 285, 700, 1000);
state = moveReaderPageGesture(state, -45, -18, -420, 240, 682, 0, 1016);
assert.equal(state.startLocalX, 285);
assert.equal(state.startLocalY, 700);
assert.equal(state.currentLocalX, 240);
assert.equal(state.currentLocalY, 682);
assert.equal(state.eventTimeMs, 1016);

// Native receives the physical DOWN and every real two-dimensional MOVE. It
// derives the stable free-edge presentation grip without losing commit delta.
let projection = projectReaderPageCurlGesture(state, 900);
assert.deepEqual(projection, {
  originX: 285 / 300,
  originY: 700 / 900,
  currentX: 240 / 300,
  currentY: 682 / 900,
});
state = beginReaderPageGesture(300, 0, 0, 30, 120);
state = moveReaderPageGesture(state, 5, 1, 0, 35, 121);
state = moveReaderPageGesture(state, 330, 360, 0, 360, 480);
projection = projectReaderPageCurlGesture(state, 900);
assert.deepEqual(projection, {
  originX: 30 / 300,
  originY: 120 / 900,
  currentX: 360 / 300,
  currentY: 480 / 900,
});
assert.equal(projection.originY, 120 / 900,
  'crossing the page midpoint must not replace the DOWN origin');

state = beginReaderPageGesture(300, 0, 0, 180, 450);
state = moveReaderPageGesture(state, -60, 45, -600, 120, 495, 320);
assert.equal(state.velocityY, 320, 'the native settlement must receive the real vertical release velocity');

// Motion below the 8vp touch slop stays undecided and cannot commit.
state = beginReaderPageGesture(300);
state = moveReaderPageGesture(state, -7.9, 1);
assert.equal(state.phase, 'tracking');
assert.equal(state.axis, 'undecided');
let decision = settleReaderPageGesture(state, -7.9, 1, -2000);
assert.equal(decision.direction, undefined);
assert.equal(decision.state.phase, 'settling');
assert.equal(decision.state.settleTarget, 'rollback');

// One noisy diagonal MOVE remains undecided; a later horizontal path must
// still admit instead of being permanently rejected by the first noisy sample.
state = beginReaderPageGesture(300);
state = moveReaderPageGesture(state, -3, 5);
assert.equal(state.axis, 'undecided');
state = moveReaderPageGesture(state, -120, 15, -1500);
assert.equal(state.axis, 'horizontal');
decision = settleReaderPageGesture(state, -120, 15, -1500);
assert.equal(decision.direction, 'next');

// Slightly diagonal human motion gets horizontal priority as soon as the
// normal touch slop is crossed.
state = beginReaderPageGesture(300, 0, 0, 150, 450);
state = moveReaderPageGesture(state, -8.1, 8.8, 0, 141.9, 458.8);
assert.equal(state.axis, 'horizontal');
assert.equal(state.direction, 'next');

// Once a sheet has been picked up, an upward finger path changes the curl
// geometry but can never revoke the already visible page actor. Horizontal
// distance alone still decides whether release commits.
state = moveReaderPageGesture(state, -75, -360, -50, 75, 90, -1200);
assert.equal(state.phase, 'dragging');
assert.equal(state.axis, 'horizontal');
assert.equal(state.direction, 'next');
assert.notEqual(projectReaderPageCurlGesture(state, 900), undefined);
decision = settleReaderPageGesture(state, -75, -410, 0, 75, 40, -1800);
assert.equal(decision.direction, undefined,
  'vertical travel must neither revoke the curl nor replace the horizontal commit threshold');

// A useful diagonal page turn remains horizontal when vertical displacement
// does not dominate the total physical path.
state = beginReaderPageGesture(300);
state = moveReaderPageGesture(state, -120, -100, -900, 180, 400, -500);
assert.equal(state.phase, 'dragging');
assert.equal(state.axis, 'horizontal');
decision = settleReaderPageGesture(state, -120, -100, -900, 180, 400, -500);
assert.equal(decision.direction, 'next');

// A vertical-first pickup in a side page zone is still a real sheet gesture.
// It follows upward immediately but rolls back until horizontal progress wins.
state = beginReaderPageGesture(300, 0, 0, 270, 700);
state = moveReaderPageGesture(state, -3, 8.1);
assert.equal(state.axis, 'horizontal');
assert.equal(state.direction, 'next');
decision = settleReaderPageGesture(state, -3, -120, 0, 267, 580, -1200);
assert.equal(decision.direction, undefined);

// A centre vertical gesture belongs to neither page direction and cannot be
// converted into a late page turn after control/selection arbitration.
state = beginReaderPageGesture(300, 0, 0, 150, 450);
state = moveReaderPageGesture(state, -3, -8.1);
assert.equal(state.axis, 'vertical');
state = moveReaderPageGesture(state, -120, -15, -1500);
assert.equal(state.axis, 'vertical');
decision = settleReaderPageGesture(state, -120, -15, -1500);
assert.equal(decision.direction, undefined);

// A horizontal drag follows total displacement and commits at 0.28W.
state = beginReaderPageGesture(300);
state = moveReaderPageGesture(state, -8.1, 2);
assert.equal(state.phase, 'dragging');
assert.equal(state.axis, 'horizontal');
assert.equal(state.direction, 'next');
state = moveReaderPageGesture(state, -90, 3);
assert.equal(state.progress, 0.3);
decision = settleReaderPageGesture(state, -84, 3, 0);
assert.equal(decision.direction, 'next');
assert.equal(decision.state.phase, 'settling');
assert.equal(decision.state.settleTarget, 'commit');
assert.equal(decision.state.active, false);
assert.equal(decision.state.consumed, true);
assert.equal(settleReaderPageGesture(decision.state, -100, 0, -2000).direction, undefined,
  'one gesture generation must emit at most one decision');

// Finger-driven geometry stops at three quarters of the horizontal axis. The
// last quarter is settlement-only, so the sheet cannot be pulled through its
// fixed binding edge even when the raw pointer leaves the viewport.
state = beginReaderPageGesture(300, 0, 0, 290, 450);
state = moveReaderPageGesture(state, -600, 0, -2000, -310, 450, 0);
assert.equal(state.progress, READER_PAGE_GESTURE_MAX_DRAG_RATIO);

// Returning a few pixels near release is not a reversal when total displacement
// still points in the locked direction.
state = beginReaderPageGesture(300, -13, 0);
state = moveReaderPageGesture(state, -100, 0);
state = moveReaderPageGesture(state, -88, 0);
assert.equal(state.reversed, false);
decision = settleReaderPageGesture(state, -86, 0, 0);
assert.equal(decision.direction, 'next');

// Crossing the origin is a true reversal. The captured target rolls back even
// if the final opposite displacement is otherwise large enough to turn.
state = beginReaderPageGesture(300, -13, 0);
state = moveReaderPageGesture(state, -100, 0);
state = moveReaderPageGesture(state, 100, 0, 1500);
assert.equal(state.currentDirection, 'previous');
assert.equal(state.reversed, true);
decision = settleReaderPageGesture(state, 100, 0, 1500);
assert.equal(decision.direction, undefined);
assert.equal(decision.state.settleTarget, 'rollback');

// A fast flick commits after 0.08W even when it is shorter than 0.28W.
state = beginReaderPageGesture(300, 13, 0);
decision = settleReaderPageGesture(state, 24, 0, 900);
assert.equal(decision.direction, 'previous');

state = beginReaderPageGesture(300, 13, 0);
decision = settleReaderPageGesture(state, 23.9, 0, 1200);
assert.equal(decision.direction, undefined, 'a flick shorter than 0.08W must roll back');

state = beginReaderPageGesture(300, 13, 0);
decision = settleReaderPageGesture(state, 40, 0, 899);
assert.equal(decision.direction, undefined, 'a sub-threshold velocity cannot replace distance');

state = beginReaderPageGesture(300, 13, 0);
decision = settleReaderPageGesture(state, 40, 0, -1500);
assert.equal(decision.direction, undefined, 'flick velocity must agree with drag direction');

// Exactly 0.28W is accepted in both directions and just below is rejected.
state = beginReaderPageGesture(320, -13, 0);
decision = settleReaderPageGesture(state, -89.6, 0, 0);
assert.equal(decision.direction, 'next');
state = beginReaderPageGesture(320, 13, 0);
decision = settleReaderPageGesture(state, 89.59, 0, 0);
assert.equal(decision.direction, undefined);

// Cancelling never emits a decision and retains a rollback state for animation.
state = beginReaderPageGesture(300, -60, 0);
state = cancelReaderPagePan(state);
assert.equal(state.phase, 'settling');
assert.equal(state.settleTarget, 'rollback');
assert.equal(state.consumed, true);
assert.equal(finishReaderPagePan(state, -100, 0, -2000).direction, undefined);
state = completeReaderPageGestureSettlement(state);
assert.equal(state.phase, 'idle');
assert.equal(state.consumed, false);

state = beginReaderPageGesture(300, 0, 0, 150, 400);
state = moveReaderPageGesture(state, 2, 3);
state = abandonReaderPageGestureTracking(state);
assert.equal(state.phase, 'idle', 'tap/long-press/vertical tracking must release the input arena directly');

// Invalid values cannot poison the reducer or accidentally commit.
state = beginReaderPageGesture(300, -20, 0);
const beforeInvalidSample = state;
state = moveReaderPageGesture(state, Number.NaN, 0, -2000);
assert.equal(state, beforeInvalidSample);
decision = settleReaderPageGesture(state, -20, Number.NaN, Number.NaN);
assert.equal(decision.direction, undefined);
assert.equal(decision.state.currentOffsetY, 0);

// Compatibility wrappers preserve the existing call names. New callers pass
// viewportWidth explicitly; legacy callers still get touch-slop-scale behavior.
state = startReaderPagePan(-13, 300, 0);
state = updateReaderPagePan(state, -90, 0, 0);
decision = finishReaderPagePan(state, -84, 0, 0);
assert.equal(decision.direction, 'next');
state = startReaderPagePan(12);
decision = finishReaderPagePan(state, 30);
assert.equal(decision.direction, 'previous');

state = startReaderPagePan(-12);
decision = finishReaderPagePan(state, -30);
assert.equal(decision.direction, 'next');
state = startReaderPagePan(12);
assert.equal(state.direction, 'previous', 'a new pan must not inherit prior direction');
assert.equal(state.consumed, false, 'a new pan must clear prior consumed state');

assert.equal(readerPageTapIntent(10, 300), 'previous');
assert.equal(readerPageTapIntent(150, 300), 'control');
assert.equal(readerPageTapIntent(290, 300), 'next');
assert.equal(readerPageTapIntent(-1, 300), undefined);
assert.equal(readerPageTapIntent(150, 0), undefined);

console.log('reader page-gesture pure state: PASS');

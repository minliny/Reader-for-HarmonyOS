import assert from 'node:assert/strict';

import {
  READER_PAGE_GESTURE_COMMIT_RATIO,
  READER_PAGE_GESTURE_FLICK_MIN_RATIO,
  READER_PAGE_GESTURE_FLICK_VELOCITY,
  READER_PAGE_GESTURE_TOUCH_SLOP,
  beginReaderPageGesture,
  cancelReaderPagePan,
  completeReaderPageGestureSettlement,
  createReaderPageGestureState,
  finishReaderPagePan,
  moveReaderPageGesture,
  readerPageTapIntent,
  settleReaderPageGesture,
  startReaderPagePan,
  updateReaderPagePan,
} from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';

assert.equal(READER_PAGE_GESTURE_TOUCH_SLOP, 12);
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

// Motion below the 12vp touch slop stays undecided and cannot commit.
state = beginReaderPageGesture(300);
state = moveReaderPageGesture(state, -11, 1);
assert.equal(state.phase, 'tracking');
assert.equal(state.axis, 'undecided');
let decision = settleReaderPageGesture(state, -11, 1, -2000);
assert.equal(decision.direction, undefined);
assert.equal(decision.state.phase, 'settling');
assert.equal(decision.state.settleTarget, 'rollback');

// A vertical-dominant sample permanently rejects horizontal page turning.
state = beginReaderPageGesture(300);
state = moveReaderPageGesture(state, -10, 14);
assert.equal(state.axis, 'vertical');
state = moveReaderPageGesture(state, -120, 15, -1500);
assert.equal(state.axis, 'vertical');
decision = settleReaderPageGesture(state, -120, 15, -1500);
assert.equal(decision.direction, undefined);

// A horizontal drag follows total displacement and commits at 0.28W.
state = beginReaderPageGesture(300);
state = moveReaderPageGesture(state, -12.1, 2);
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

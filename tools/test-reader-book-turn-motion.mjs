import assert from 'node:assert/strict';

import {
  BOOK_TURN_CATCH_LOCK_VP,
  BOOK_TURN_CATCH_SPEED_VIEWPORTS_PER_SECOND,
  BOOK_TURN_EDGE_BAND_VP,
  BOOK_TURN_HORIZONTAL_START_VP,
  BOOK_TURN_VERTICAL_PREVIOUS_START_VP,
  beginBookTurnMotion,
  bookTurnCatchNearDistance,
  bookTurnFollowX,
  updateBookTurnMotionInPlace,
} from '../entry/src/main/ets/features/reading/BookTurnMotionState.ts';

assert.equal(BOOK_TURN_EDGE_BAND_VP, 12);
assert.equal(BOOK_TURN_HORIZONTAL_START_VP, 8);
assert.equal(BOOK_TURN_VERTICAL_PREVIOUS_START_VP, 24);
assert.equal(BOOK_TURN_CATCH_SPEED_VIEWPORTS_PER_SECOND, 5);
assert.equal(BOOK_TURN_CATCH_LOCK_VP, 4);
assert.equal(bookTurnCatchNearDistance(300), 36);
assert.equal(bookTurnCatchNearDistance(600), 48);

// A right-edge next-page gesture consumes the threshold-crossing MOVE itself.
let motion = beginBookTurnMotion(1, 'next', false, 300, 600, 292, 120, 282, 120, 16);
assert.equal(motion.edgeOrigin, true);
assert.equal(motion.edgeX, 282);
updateBookTurnMotionInPlace(motion, 210, 120, 32);
assert.equal(motion.edgeX, 210);

// A horizontal move at constant Y keeps the physical edge Y and never invents a corner.
assert.equal(motion.edgeY, 120);
updateBookTurnMotionInPlace(motion, 180, 120, 48);
assert.equal(motion.edgeY, 120);

// An interior origin starts at the source edge and catches at exactly 5W/s while far.
motion = beginBookTurnMotion(2, 'next', false, 300, 600, 240, 300, 220, 300, 0);
assert.equal(motion.edgeOrigin, false);
assert.equal(motion.edgeX, 300, 'zero elapsed time cannot teleport an interior edge');
updateBookTurnMotionInPlace(motion, 180, 300, 20);
assert.equal(motion.edgeX, 270, '5W/s for 20ms on W=300 is 30vp');

// Every MOVE reuses the same state object and the near region snaps without a tail.
const same = motion;
assert.equal(updateBookTurnMotionInPlace(motion, 267.5, 300, 40), same);
assert.ok(Math.abs(motion.edgeX - bookTurnFollowX(motion)) <= BOOK_TURN_CATCH_LOCK_VP);
updateBookTurnMotionInPlace(motion, motion.edgeX - 2, 300, 56);
assert.equal(motion.edgeX, bookTurnFollowX(motion));

// Reversing toward P0 continuously returns the target to the source edge.
motion = beginBookTurnMotion(3, 'next', false, 300, 600, 200, 300, 150, 300, 0);
updateBookTurnMotionInPlace(motion, 150, 300, 100);
const exposedEdge = motion.edgeX;
updateBookTurnMotionInPlace(motion, 199, 300, 200);
assert.ok(bookTurnFollowX(motion) > exposedEdge);
updateBookTurnMotionInPlace(motion, 200, 300, 300);
assert.equal(bookTurnFollowX(motion), 300);

// Pure vertical previous uses the real X as its free-edge target after 24vp.
motion = beginBookTurnMotion(4, 'previous', true, 300, 600, 190, 400, 190, 375, 16);
assert.equal(bookTurnFollowX(motion), 190);
assert.equal(motion.edgeY, 375);
updateBookTurnMotionInPlace(motion, 210, 330, 32);
assert.equal(bookTurnFollowX(motion), 210);
assert.equal(motion.pointerY, 330);

console.log('reader book-turn motion state: PASS');

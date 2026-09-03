import assert from 'node:assert/strict';

import {
  beginBookTurnMotion,
  bookTurnInput,
  stopBookTurnMotion,
  updateBookTurnMotionInPlace,
} from '../entry/src/main/ets/features/reading/BookTurnMotionState.ts';

// Contract V2 §5.3: ArkTS keeps only the newest raw gesture sample. Edge
// chasing, velocity, and frame advance all live in native state, so the
// mailbox must carry no edge/velocity semantics at all.
let motion = beginBookTurnMotion(1, 'next', false, 300, 600, 292, 120, 282, 120, 16);
assert.equal(motion.active, true);
assert.equal(motion.startX, 292);
assert.equal(motion.pointerX, 282);
assert.equal(motion.pointerY, 120);
assert.equal(motion.eventTimeMs, 16);
assert.equal('edgeX' in motion, false);
assert.equal('edgeY' in motion, false);
assert.equal('velocity' in motion, false);

// Every MOVE reuses the same state object: no allocation on the input path,
// newest sample wins outright (no EMA, spring, or replay queue).
const same = motion;
assert.equal(updateBookTurnMotionInPlace(motion, 210, 132, 48), same);
assert.equal(motion.pointerX, 210);
assert.equal(motion.pointerY, 132);
assert.equal(motion.eventTimeMs, 48);

// A non-finite pointer discards the whole sample, timestamp included.
updateBookTurnMotionInPlace(motion, Number.NaN, Number.POSITIVE_INFINITY, 64);
assert.equal(motion.pointerX, 210);
assert.equal(motion.pointerY, 132);
assert.equal(motion.eventTimeMs, 48);

// The defaulted start edge is direction-dependent: 'next' sources from the
// right edge, 'previous' from the left edge.
motion = beginBookTurnMotion(2, 'next', false, 300, 600, Number.NaN, 40, Number.NaN, 40, 0);
assert.equal(motion.startX, 300, 'next starts from the source right edge');
assert.equal(motion.pointerX, 300, 'pointer defaults to the start edge');
motion = beginBookTurnMotion(3, 'previous', true, 300, 600, Number.NaN, 40, Number.NaN, 40, 0);
assert.equal(motion.startX, 0, 'previous starts from the source left edge');
assert.equal(motion.pointerY, 40);

// A non-finite viewport collapses the mailbox to a guarded no-op state.
motion = beginBookTurnMotion(4, 'next', false, Number.NaN, 600, 100, 0, 100, 0, 0);
assert.equal(motion.viewportWidth, 0);
const untouched = motion;
assert.equal(updateBookTurnMotionInPlace(motion, 80, 0, 32), untouched);
assert.equal(motion.pointerX, 0, 'updates never consume samples on a dead viewport');

// A negative or non-finite timestamp falls back to the last known good time.
motion = beginBookTurnMotion(5, 'next', false, 300, 600, 292, 120, 292, 120, Number.NaN);
assert.equal(motion.eventTimeMs, 0);
updateBookTurnMotionInPlace(motion, 280, 120, 24);
updateBookTurnMotionInPlace(motion, 270, 120, -8);
assert.equal(motion.eventTimeMs, 24);

// stop ends consumption: later MOVEs cannot resurrect the sample stream.
stopBookTurnMotion(motion);
assert.equal(motion.active, false);
updateBookTurnMotionInPlace(motion, 100, 120, 96);
assert.equal(motion.pointerX, 270);
assert.equal(motion.eventTimeMs, 24);

// The mailbox record is handed to the session as a raw BookTurnInput.
const input = bookTurnInput(motion);
assert.equal(input, motion);
assert.equal(input.generation, 5);
assert.equal(input.verticalPrevious, false);

console.log('reader book-turn motion state: PASS');

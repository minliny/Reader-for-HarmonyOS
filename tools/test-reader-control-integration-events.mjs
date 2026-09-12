import assert from 'node:assert/strict';
import {
  advanceReaderControlSession,
  backReaderControlSession,
  createReaderControlSessionState,
  dismissReaderControlSession,
  enterReaderControlModule,
  expandReaderControlSession,
  openReaderControlSession,
  readerControlContentLocation,
  readerControlTargetLocation,
  sampleReaderControlSession,
} from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import {
  beginReaderControlGesture,
  cancelReaderControlGesture,
  createReaderControlGestureState,
  readerControlGrabberScreenY,
  updateReaderControlGesture,
} from '../entry/src/main/ets/features/reading/ReaderControlGestureDriver.ts';

const durationMs = 400;
const pointerId = 11;
const config = {
  axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 },
  tapMaxDurationMs: 350,
  directionSlopVp: 2,
  settleDurationMs: durationMs,
};

function finish(initial) {
  let current = initial;
  for (let count = 0; count < 8 && current.transition !== undefined; count += 1) {
    current = advanceReaderControlSession(current, 10_000, current.epoch);
  }
  assert.equal(current.transition, undefined);
  return current;
}

function home() {
  return finish(openReaderControlSession(createReaderControlSessionState(), durationMs));
}

function quick(module = 'appearance', directoryTab = 'directory') {
  return finish(enterReaderControlModule(home(), module, durationMs, directoryTab));
}

function downAtCurrent(session, timeMs = 0) {
  const screenY = readerControlGrabberScreenY(sampleReaderControlSession(session), config.axis);
  return beginReaderControlGesture(
    session,
    createReaderControlGestureState(config),
    pointerId,
    screenY,
    timeMs,
  );
}

function move(pair, screenY, timeMs) {
  return updateReaderControlGesture(pair.session, pair.gesture, pointerId, screenY, timeMs);
}

function cancel(pair) {
  return cancelReaderControlGesture(pair.session, pair.gesture, pointerId);
}

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-7,
    `${message}: expected ${expected}, received ${actual}`);
}

// DOWN interrupted an automatic Quick -> Full goal. The pointer then traverses
// back through Quick and into the dismiss segment. CANCEL must resume the goal
// captured on DOWN, not merely return to the source of the newest segment.
let expanding = expandReaderControlSession(quick('directory', 'bookmarks'), durationMs);
expanding = advanceReaderControlSession(expanding, 100, expanding.epoch);
let pair = downAtCurrent(expanding);
pair = move(pair, 709, 100); // cross Quick, then half of MR1's 18vp dismissal
assert.equal(pair.session.transition?.kind, 'dismiss');
pair = cancel(pair);
assert.equal(readerControlTargetLocation(pair.session).form, 'full');

// Resuming that saved Full goal starts at expansion=0, visibility<1, so its
// captured grabber uses MR1's additive 18vp path. Re-grab mid-flight: every slow
// MOVE, including a direction reversal, must reproduce the pointer's exact
// screen-space delta must agree with the same production spatial sampler.
let mixedRestoration = advanceReaderControlSession(pair.session, 100, pair.session.epoch);
let mixedPair = downAtCurrent(mixedRestoration, 200);
close(readerControlGrabberScreenY(sampleReaderControlSession(mixedPair.session), config.axis),
  mixedPair.gesture.lastPointerScreenY, 'mixed restore DOWN freeze');
let expectedY = mixedPair.gesture.lastPointerScreenY - 37;
mixedPair = move(mixedPair, expectedY, 300);
close(readerControlGrabberScreenY(sampleReaderControlSession(mixedPair.session), config.axis),
  expectedY, 'mixed restore slow MOVE');
expectedY += 23;
mixedPair = move(mixedPair, expectedY, 400);
close(readerControlGrabberScreenY(sampleReaderControlSession(mixedPair.session), config.axis),
  expectedY, 'mixed restore reverse MOVE');

// Continue beyond the mixed segment's source. The first segment must consume
// exactly to its real source Y, then carry the remaining delta into dismissal.
const mixedSourceY = readerControlGrabberScreenY(mixedPair.session.transition.from, config.axis);
expectedY = mixedSourceY + 4;
mixedPair = move(mixedPair, expectedY, 500);
assert.equal(mixedPair.session.transition?.kind, 'dismiss');
close(readerControlGrabberScreenY(sampleReaderControlSession(mixedPair.session), config.axis),
  expectedY, 'mixed restore cross-segment MOVE');
mixedPair = cancel(mixedPair);
assert.equal(readerControlTargetLocation(mixedPair.session).form, 'full');

const restoredFull = finish(pair.session);
assert.equal(restoredFull.location.form, 'full');
assert.equal(restoredFull.location.directoryTab, 'bookmarks');
assert.equal(restoredFull.closeRevision, 0);

// Symmetric case: DOWN interrupted an automatic Quick -> Hidden close, then
// crossed Quick into Full. CANCEL must continue to Hidden. This is control UI
// restoration only; no business-state rollback is represented by this state.
let closing = dismissReaderControlSession(quick('directory', 'bookmarks'), durationMs);
closing = advanceReaderControlSession(closing, 100, closing.epoch);
pair = downAtCurrent(closing);
pair = move(pair, 300, 100); // traverse dismiss source and the full morph segment
assert.equal(readerControlContentLocation(pair.session).directoryTab, 'bookmarks');
pair = cancel(pair);
assert.equal(readerControlTargetLocation(pair.session).level, 'hidden');
const closed = finish(pair.session);
assert.equal(closed.location.level, 'hidden');
assert.equal(closed.closeRevision, 1);

// A stable source has no prior automatic goal. CANCEL restores the exact source,
// including the Directory/Bookmarks context, and does not commit a close.
const stableBookmark = quick('directory', 'bookmarks');
pair = downAtCurrent(stableBookmark);
pair = move(pair, 500, 100);
pair = cancel(pair);
const restoredBookmark = finish(pair.session);
assert.equal(restoredBookmark.location.form, 'quick');
assert.equal(restoredBookmark.location.directoryTab, 'bookmarks');
assert.equal(restoredBookmark.closeRevision, 0);

// A newer explicit command revokes ownership. A late CANCEL from the old touch
// must be ignored and must not restore the goal captured by that touch.
expanding = expandReaderControlSession(quick('tts'), durationMs);
expanding = advanceReaderControlSession(expanding, 100, expanding.epoch);
pair = downAtCurrent(expanding);
pair = move(pair, 500, 100);
const commanded = dismissReaderControlSession(pair.session, durationMs);
const staleCancel = cancelReaderControlGesture(commanded, pair.gesture, pointerId);
assert.equal(staleCancel.consumed, false);
assert.strictEqual(staleCancel.session, commanded);
assert.equal(readerControlTargetLocation(staleCancel.session).level, 'hidden');

// Back is another explicit takeover and likewise wins over a stale CANCEL.
pair = downAtCurrent(finish(expandReaderControlSession(quick('settings'), durationMs)));
pair = move(pair, 309, 100);
const backed = backReaderControlSession(pair.session, durationMs).state;
const cancelAfterBack = cancelReaderControlGesture(backed, pair.gesture, pointerId);
assert.equal(cancelAfterBack.consumed, false);
assert.strictEqual(cancelAfterBack.session, backed);

console.log('reader control integration event ownership, CANCEL, and exact mixed-path behavior: PASS');

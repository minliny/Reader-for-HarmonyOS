import assert from 'node:assert/strict';
import {
  advanceReaderControlSession, createReaderControlSessionState, dismissReaderControlSession,
  enterReaderControlModule, expandReaderControlSession, openReaderControlSession,
  readerControlTargetLocation, rebaseReaderControlTransitionProgress,
  resumeReaderControlSessionTarget, sampleReaderControlSession,
} from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import {
  beginReaderControlGesture, cancelReaderControlGesture, createReaderControlGestureState,
  endReaderControlGesture, readerControlGrabberScreenY, updateReaderControlGesture,
} from '../entry/src/main/ets/features/reading/ReaderControlGestureDriver.ts';
import {
  advanceReaderControlLayoutCompensation, createReaderControlLayoutCompensation,
  pauseReaderControlLayoutCompensation, rebaseReaderControlLayout,
  settleReaderControlLayoutCompensation,
} from '../entry/src/main/ets/features/reading/ReaderControlLayoutRebase.ts';

const oldAxis = { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 };
const newAxis = { quickGrabberScreenY: 900, fullGrabberScreenY: 400, hiddenGrabberScreenY: 918 };
const config = { axis: oldAxis, tapMaxDurationMs: 350, directionSlopVp: 2, settleDurationMs: 400 };
function home() { return openReaderControlSession(createReaderControlSessionState(), 0); }
function quick() { return enterReaderControlModule(home(), 'directory', 0, 'bookmarks'); }
function full() { return expandReaderControlSession(quick(), 0); }
function down(session, pointerY) {
  return beginReaderControlGesture(session, createReaderControlGestureState(config), 1, pointerY, 0);
}
function close(a, b) { assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`); }
function y(pair) {
  return readerControlGrabberScreenY(sampleReaderControlSession(pair.session), pair.gesture.config.axis) +
    pair.compensation.offsetY;
}
function rebased(pair, axis = newAxis, compensation = createReaderControlLayoutCompensation()) {
  return rebaseReaderControlLayout(pair.session, pair.gesture, compensation, axis);
}
function assertIdentity(before, after) {
  assert.deepEqual(after.location, before.location);
  assert.deepEqual(readerControlTargetLocation(after), readerControlTargetLocation(before));
  assert.equal(after.epoch, before.epoch);
  assert.equal(after.closeRevision, before.closeRevision);
  assert.equal(after.heldPointerId, before.heldPointerId);
}
function finish(session) {
  for (let i = 0; i < 8 && session.transition !== undefined; i += 1) {
    session = advanceReaderControlSession(session, 10000, session.epoch);
  }
  assert.equal(session.transition, undefined);
  return session;
}

// The user's contact is 13 vp below the handle: anchor the handle, not pointerY.
let pair = down(quick(), 713);
pair = updateReaderControlGesture(pair.session, pair.gesture, 1, 613, 100);
const original = structuredClone(pair);
let next = rebased(pair);
assert.equal(next.reason, 'projected');
assert.equal(next.accepted, true);
close(y(next), 600);
close(next.session.transition.progress, 0.6);
assertIdentity(pair.session, next.session);
assert.equal(next.gesture.lastPointerScreenY, 613);
assert.equal(next.gesture.directionAnchorScreenY, 613);
assert.equal(next.gesture.recentDirection, 'up');
assert.equal(next.gesture.velocityYVpPerSecond, 0);
assert.equal(next.gesture.velocitySampleIntervalMs, 0);
assert.deepEqual(next.gesture.pausedTargetLocation, pair.gesture.pausedTargetLocation);
let moved = updateReaderControlGesture(next.session, next.gesture, 1, 593, 116);
close(readerControlGrabberScreenY(sampleReaderControlSession(moved.session), newAxis) +
  next.compensation.offsetY, 580);
assert.deepEqual(pair, original, 'atomic rebase does not mutate caller state');

// Duplicate area notifications are idempotent, including the automatic clock.
const repeated = rebaseReaderControlLayout(next.session, next.gesture, next.compensation, newAxis);
assert.equal(repeated.reason, 'unchanged');
assert.strictEqual(repeated.session, next.session);
assert.strictEqual(repeated.gesture, next.gesture);
assert.strictEqual(repeated.compensation, next.compensation);

// Automatic segment keeps the old logical endpoint and ONLY remaining time.
let expanding = expandReaderControlSession(quick(), 400);
expanding = advanceReaderControlSession(expanding, 100, expanding.epoch);
next = rebased({ session: expanding, gesture: createReaderControlGestureState(config) });
close(y(next), 600);
assertIdentity(expanding, next.session);
close(next.session.transition.startProgress, 0.6);
assert.equal(next.session.transition.elapsedMs, 0);
assert.equal(next.session.transition.durationMs, 300);
let afterFrame = advanceReaderControlSession(next.session, 0, next.session.epoch);
close(readerControlGrabberScreenY(sampleReaderControlSession(afterFrame), newAxis), 600);
afterFrame = advanceReaderControlSession(afterFrame, 150, afterFrame.epoch);
close(readerControlGrabberScreenY(sampleReaderControlSession(afterFrame), newAxis), 500);
assert.equal(finish(afterFrame).location.form, 'full');

// Stable held Home/Quick/Full has no transition to reparameterize. Never infer
// a drag direction or make initial Home expandable just because layout changed.
for (const stable of [home(), quick(), full()]) {
  const beforeY = readerControlGrabberScreenY(sampleReaderControlSession(stable), oldAxis);
  pair = down(stable, beforeY + 11);
  next = rebased(pair);
  assert.equal(next.reason, 'compensated-stable-hold');
  assert.strictEqual(next.session, pair.session);
  assert.equal(next.session.transition, undefined);
  close(y(next), beforeY);
  assert.equal(next.compensation.running, false);
  const frozen = advanceReaderControlLayoutCompensation(next.compensation, next.session, 1000,
    next.compensation.revision);
  assert.strictEqual(frozen, next.compensation);
  const canceled = cancelReaderControlGesture(next.session, next.gesture, 1);
  assert.deepEqual(readerControlTargetLocation(canceled.session), readerControlTargetLocation(stable));
  const heldLong = endReaderControlGesture(next.session, next.gesture, 1, 2000);
  assert.equal(heldLong.session.transition, undefined);
  assert.deepEqual(heldLong.session.location, stable.location);
  let correction = settleReaderControlLayoutCompensation(next.compensation, heldLong.session, 400);
  const releasedY = readerControlGrabberScreenY(sampleReaderControlSession(heldLong.session), newAxis) + correction.offsetY;
  close(releasedY, beforeY);
  correction = advanceReaderControlLayoutCompensation(correction, heldLong.session, 200, correction.revision);
  close(correction.offsetY, next.compensation.offsetY / 2);
  correction = advanceReaderControlLayoutCompensation(correction, heldLong.session, 200, correction.revision);
  assert.equal(correction.offsetY, 0);
  assert.equal(correction.running, false);
  assert.equal(heldLong.session.closeRevision, 0);
}

// A stable compensated hold can subsequently start a real drag with exact delta.
next = rebased(down(quick(), 711));
moved = updateReaderControlGesture(next.session, next.gesture, 1, 691, 100);
close(readerControlGrabberScreenY(sampleReaderControlSession(moved.session), newAxis) +
  next.compensation.offsetY, 680);
assert.equal(readerControlTargetLocation(moved.session).form, 'full');

// Unreachable anchors retain progress/visibility; they are not secretly clamped
// to an endpoint (especially an invisible/committed dismissal endpoint).
const farAxis = { quickGrabberScreenY: 1800, fullGrabberScreenY: 1500, hiddenGrabberScreenY: 1818 };
for (const initial of [expandReaderControlSession(quick(), 400), dismissReaderControlSession(full(), 400)]) {
  const midway = advanceReaderControlSession(initial, 100, initial.epoch);
  const beforeY = readerControlGrabberScreenY(sampleReaderControlSession(midway), oldAxis);
  next = rebased({ session: midway, gesture: createReaderControlGestureState(config) }, farAxis);
  assert.equal(next.reason, 'compensated-outside-segment');
  assertIdentity(midway, next.session);
  assert.deepEqual(sampleReaderControlSession(next.session), sampleReaderControlSession(midway));
  close(y(next), beforeY);
  assert.notEqual(next.compensation.offsetY, 0);
  assert.equal(next.compensation.running, true);
  const sessionHalf = advanceReaderControlSession(next.session, 150, next.session.epoch);
  const correctionHalf = advanceReaderControlLayoutCompensation(next.compensation, sessionHalf, 150,
    next.compensation.revision);
  close(correctionHalf.offsetY, next.compensation.offsetY / 2);
  assert.equal(next.session.closeRevision, 0);
}

// No automatic progress/close under a held pointer, even at the hidden endpoint.
pair = down(full(), 300);
pair = updateReaderControlGesture(pair.session, pair.gesture, 1, 318, 100);
next = rebased(pair, farAxis);
assert.equal(next.session.transition.progress, 1);
assert.equal(next.session.closeRevision, 0);
assert.equal(next.session.heldPointerId, 1);
close(y(next), 318);
assert.strictEqual(advanceReaderControlSession(next.session, 10000, next.session.epoch), next.session);
const reverse = updateReaderControlGesture(next.session, next.gesture, 1, 314, 200);
close(readerControlGrabberScreenY(sampleReaderControlSession(reverse.session), farAxis) +
  next.compensation.offsetY, 314);
assert.equal(reverse.session.closeRevision, 0);

// A collapsed but finite axis is representable via compensation; invalid
// ordering/NaN is rejected atomically so the host can retain its last bounds.
const collapsedAxis = { quickGrabberScreenY: 200, fullGrabberScreenY: 200, hiddenGrabberScreenY: 200 };
next = rebased(down(expanding, 611), collapsedAxis);
assert.equal(next.accepted, true);
assert.equal(next.reason, 'compensated-static-segment');
close(y(next), 600);
for (const invalid of [
  { ...newAxis, quickGrabberScreenY: Number.NaN },
  { ...newAxis, fullGrabberScreenY: 901 },
  { ...newAxis, hiddenGrabberScreenY: 899 },
]) {
  pair = down(expanding, 611);
  const compensation = createReaderControlLayoutCompensation();
  const rejected = rebaseReaderControlLayout(pair.session, pair.gesture, compensation, invalid);
  assert.equal(rejected.accepted, false);
  assert.strictEqual(rejected.session, pair.session);
  assert.strictEqual(rejected.gesture, pair.gesture);
  assert.strictEqual(rejected.compensation, compensation);
}

// Restoring a partially hidden Full composition to Quick changes both frame
// axes. Verify the same additive MR1 sampler as MOVE and the visible actors.
let closing = dismissReaderControlSession(full(), 400);
closing = advanceReaderControlSession(closing, 100, closing.epoch);
let restoring = resumeReaderControlSessionTarget(closing, quick().location, 400);
restoring = advanceReaderControlSession(restoring, 100, restoring.epoch);
const mixedY = readerControlGrabberScreenY(sampleReaderControlSession(restoring), oldAxis);
const nearbyAxis = { quickGrabberScreenY: 720, fullGrabberScreenY: 310, hiddenGrabberScreenY: 738 };
next = rebased({ session: restoring, gesture: createReaderControlGestureState(config) }, nearbyAxis);
assert.equal(next.reason, 'projected');
close(y(next), mixedY);
close(next.compensation.offsetY, 0);
assertIdentity(restoring, next.session);

// Re-grabbing a geometry-only return freezes its displayed offset. Stale clock
// revisions and a still-held session cannot advance or silently discard it.
next = rebased(down(quick(), 700));
const released = endReaderControlGesture(next.session, next.gesture, 1, 2000);
let correction = settleReaderControlLayoutCompensation(next.compensation, released.session, 400);
const oldRevision = correction.revision;
correction = advanceReaderControlLayoutCompensation(correction, released.session, 100, oldRevision);
const frozen = pauseReaderControlLayoutCompensation(correction);
close(frozen.offsetY, correction.offsetY);
assert.equal(frozen.running, false);
assert.notEqual(frozen.revision, oldRevision);
assert.strictEqual(advanceReaderControlLayoutCompensation(frozen, released.session, 1000, oldRevision), frozen);
const anotherResize = rebaseReaderControlLayout(released.session, next.gesture, correction, farAxis);
close(y(anotherResize), readerControlGrabberScreenY(sampleReaderControlSession(released.session), newAxis) +
  correction.offsetY);
assert.equal(anotherResize.compensation.durationMs, 300);

// Stable unheld controls may adopt normal responsive layout; this is explicitly
// different from claiming that a held or moving screen anchor was preserved.
next = rebased({ session: quick(), gesture: createReaderControlGestureState(config) });
assert.equal(next.reason, 'stable-layout');
assert.equal(next.anchorPreserved, false);
assert.equal(next.compensation.offsetY, 0);

// Narrow helper never changes epochs/goals or completes even an unheld close.
closing = dismissReaderControlSession(full(), 400);
const atHidden = rebaseReaderControlTransitionProgress(closing, 1, closing.epoch);
assertIdentity(closing, atHidden);
assert.notEqual(atHidden.transition, undefined);
assert.equal(atHidden.closeRevision, 0);
assert.strictEqual(rebaseReaderControlTransitionProgress(closing, 0.5, closing.epoch + 1), closing);
assert.strictEqual(rebaseReaderControlTransitionProgress(closing, Number.NaN, closing.epoch), closing);
console.log('reader control atomic layout rebase production policy: PASS (no Stage/runtime visual claim)');

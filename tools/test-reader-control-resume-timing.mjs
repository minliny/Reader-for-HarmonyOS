import assert from 'node:assert/strict';
import {
  advanceReaderControlSession, backReaderControlSession, collapseReaderControlSession, createReaderControlSessionState,
  dismissReaderControlSession, enterReaderControlModule, expandReaderControlSession,
  openReaderControlSession, readerControlTargetLocation, retargetReaderControlTransition, sampleReaderControlSession,
} from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import {
  beginReaderControlGesture, cancelReaderControlGesture, createReaderControlGestureState,
  endReaderControlGesture, readerControlGrabberScreenY, readerControlGestureToggleDuration,
  updateReaderControlGesture,
} from '../entry/src/main/ets/features/reading/ReaderControlGestureDriver.ts';
import {
  createReaderControlLayoutCompensation, rebaseReaderControlLayout,
} from '../entry/src/main/ets/features/reading/ReaderControlLayoutRebase.ts';

const config = {
  axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 },
  tapMaxDurationMs: 350, directionSlopVp: 2,
  settleDurationMs: 1150, showDurationMs: 420, dismissDurationMs: 360,
};
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const quick = () => enterReaderControlModule(openReaderControlSession(createReaderControlSessionState(), 0),
  'directory', 0, 'bookmarks');
const full = () => expandReaderControlSession(quick(), 0);
const advance = (s, ms, curve) => advanceReaderControlSession(s, ms, s.epoch, curve);
const hold = s => beginReaderControlGesture(s, createReaderControlGestureState(config), 1,
  readerControlGrabberScreenY(sampleReaderControlSession(s), config.axis), 0);
const move = (p, y, ms) => updateReaderControlGesture(p.session, p.gesture, 1, y, ms);
const release = (p, ms = 1000) => endReaderControlGesture(p.session, p.gesture, 1, ms);
const cancel = p => cancelReaderControlGesture(p.session, p.gesture, 1);

// A stationary hold suspends the ORIGINAL timeline, including its source and
// easing phase. It must not restart 1150ms for the last 150ms of an expansion.
let original = advance(expandReaderControlSession(quick(), 1150), 1000);
let pair = hold(original);
pair = move(pair, pair.gesture.lastPointerScreenY, 500); // stationary MOVE is not a new path
pair = release(pair);
assert.deepEqual(pair.session.transition, original.transition);
assert.deepEqual(sampleReaderControlSession(pair.session), sampleReaderControlSession(original));
assert.equal(readerControlTargetLocation(backReaderControlSession(pair.session, 1150).state).form, 'quick');
assert.ok(advance(pair.session, 149).transition);
assert.equal(advance(pair.session, 150).location.form, 'full');

const curve = fraction => fraction * fraction;
original = advance(expandReaderControlSession(quick(), 1150), 500, curve);
pair = release(hold(original));
assert.deepEqual(sampleReaderControlSession(advance(pair.session, 40, curve)),
  sampleReaderControlSession(advance(original, 40, curve)), 'resume must retain the original curve phase');
assert.deepEqual(cancel(hold(original)).session.transition, original.transition,
  'stationary CANCEL resumes the same operation, not a newly inferred source');

// A sub-slop displacement follows the finger but does not rewrite intent. Its
// continuation starts at that sample, retaining the original source and only
// the original unspent time; it cannot jump back to the pre-jitter clock sample.
original = advance(expandReaderControlSession(quick(), 1150), 1000);
pair = hold(original);
pair = move(pair, pair.gesture.lastPointerScreenY - 1, 500);
const jitterFrame = sampleReaderControlSession(pair.session);
pair = release(pair);
assert.deepEqual(sampleReaderControlSession(pair.session), jitterFrame);
assert.deepEqual(pair.session.transition.fromLocation, original.transition.fromLocation);
near(pair.session.transition.durationMs - pair.session.transition.elapsedMs, 150);
assert.equal(readerControlTargetLocation(backReaderControlSession(pair.session, 1150).state).form, 'quick');

// Resize may reproject the same held timeline, but cannot turn a stationary
// release into a restart of the pre-resize geometry or full nominal duration.
pair = hold(original);
const rebased = rebaseReaderControlLayout(pair.session, pair.gesture, createReaderControlLayoutCompensation(),
  { quickGrabberScreenY: 720, fullGrabberScreenY: 280, hiddenGrabberScreenY: 738 });
pair = release({ session: rebased.session, gesture: rebased.gesture });
assert.deepEqual(pair.session.transition, rebased.session.transition);
near(pair.session.transition.durationMs - pair.session.transition.elapsedMs, 150);

// Pure MR1 show and hide retain 420/360, including their elapsed curve phase.
for (const [initial, elapsed, remaining] of [
  [openReaderControlSession(createReaderControlSessionState(), 420), 120, 300],
  [dismissReaderControlSession(full(), 360), 90, 270],
]) {
  original = advance(initial, elapsed);
  pair = release(hold(original));
  assert.deepEqual(pair.session.transition, original.transition);
  near(pair.session.transition.durationMs - pair.session.transition.elapsedMs, remaining);
  assert.ok(advance(pair.session, remaining - 1).transition);
  assert.equal(advance(pair.session, remaining).transition, undefined);
}
pair = release(hold(quick()));
assert.equal(pair.session.transition, undefined, 'stable long hold does not manufacture an operation');

// Crossing Quick into a half-hidden close then cancelling back to the saved
// Full target changes BOTH composition and visibility on one 1150ms timeline.
original = advance(expandReaderControlSession(quick(), 1150), 100);
pair = move(hold(original), 709, 100);
const mixedFrame = sampleReaderControlSession(pair.session);
assert.deepEqual(mixedFrame, { expansionProgress: 0, visibilityProgress: 0.5 });
pair = cancel(pair);
assert.deepEqual(sampleReaderControlSession(pair.session), mixedFrame);
assert.equal(pair.session.transition.kind, 'morph');
near(pair.session.transition.durationMs, 1150);
assert.ok(advance(pair.session, 420).transition, 'MR1 show duration cannot compress a full morph');
const mixedEnd = advance(pair.session, 1150);
assert.equal(mixedEnd.location.form, 'full');
assert.equal(mixedEnd.location.directoryTab, 'bookmarks');
assert.equal(mixedEnd.closeRevision, 0);

// Reversing a pure 18vp MR1 path remains a 420ms show, for Quick and Full.
for (const visible of [quick(), full()]) {
  original = advance(dismissReaderControlSession(visible, 360), 90);
  near(readerControlGestureToggleDuration(original, config), 420);
  pair = release(hold(original), 100);
  near(pair.session.transition.durationMs, 420);
  assert.equal(advance(pair.session, 420).transition, undefined);
}

// Closing an unfinished morph freezes its composition. Undo first retraces
// that exact MR1 path; reaching the captured frame resumes only the interrupted
// operation with its original source, target, curve phase and remaining 575ms.
const interrupted = advance(expandReaderControlSession(quick(), 1150), 575);
original = advance(dismissReaderControlSession(interrupted, 360), 90);
assert.deepEqual(sampleReaderControlSession(original), { expansionProgress: 0.5, visibilityProgress: 0.75 });
near(readerControlGestureToggleDuration(original, config), 420);
pair = release(hold(original), 100);
near(pair.session.transition.durationMs, 420);
let restored = advance(pair.session, 420);
assert.deepEqual(sampleReaderControlSession(restored), { expansionProgress: 0.5, visibilityProgress: 1 });
assert.deepEqual(restored.transition, interrupted.transition);
near(restored.transition.durationMs - restored.transition.elapsedMs, 575);
assert.equal(readerControlTargetLocation(backReaderControlSession(restored, 1150).state).form, 'quick');
assert.equal(advance(restored, 575).location.form, 'full');
assert.equal(restored.closeRevision, 0);

// Repeated close commands must not crop the undo path at an intermediate v.
// They still capture the current picture, but undo can reach the original
// captured composition and then resume that original operation.
for (const duringUndo of [false, true]) {
  original = advance(dismissReaderControlSession(interrupted, 360), 90);
  if (duringUndo) original = advance(release(hold(original), 100).session, 210);
  const capture = sampleReaderControlSession(original);
  original = dismissReaderControlSession(original, 360);
  assert.deepEqual(sampleReaderControlSession(original), capture);
  original = advance(original, 90);
  pair = release(hold(original), 100);
  near(pair.session.transition.durationMs, 420);
  restored = advance(pair.session, 420);
  assert.deepEqual(sampleReaderControlSession(restored), sampleReaderControlSession(interrupted));
  assert.deepEqual(restored.transition, interrupted.transition);
  assert.equal(readerControlTargetLocation(backReaderControlSession(restored, 1150).state).form, 'quick');
}

// An explicit close can capture a finger-driven frame before UP. The restored
// clock must start at that frame, never jump back to the old automatic sample.
pair = move(hold(quick()), 500, 100);
const dragged = sampleReaderControlSession(pair.session);
original = advance(dismissReaderControlSession(pair.session, 360), 90);
pair = release(hold(original), 100);
restored = advance(pair.session, 420);
assert.deepEqual(sampleReaderControlSession(restored), dragged);
assert.deepEqual(sampleReaderControlSession(advance(restored, 0)), dragged);
assert.equal(readerControlTargetLocation(backReaderControlSession(restored, 1150).state).form, 'quick');

// Operation identity also includes the reverse endpoint and back intent, not
// merely "Full". Exercise both authored directions and both local targets.
for (const collapsing of [false, true]) {
  for (const reversing of [false, true]) {
    let operation = advance(collapsing ? collapseReaderControlSession(full(), 1150) :
      expandReaderControlSession(quick(), 1150), 575);
    if (reversing) operation = advance(retargetReaderControlTransition(operation, 0, 400), 100);
    const expectedBack = readerControlTargetLocation(backReaderControlSession(operation, 1150).state);
    pair = release(hold(operation));
    assert.deepEqual(pair.session.transition, operation.transition);
    original = advance(dismissReaderControlSession(operation, 360), 90);
    pair = release(hold(original), 100);
    restored = advance(pair.session, 420);
    assert.deepEqual(restored.transition, operation.transition);
    assert.deepEqual(readerControlTargetLocation(backReaderControlSession(restored, 1150).state), expectedBack);
    const remaining = operation.transition.durationMs - operation.transition.elapsedMs;
    const end = advance(restored, remaining);
    assert.deepEqual(end.location, readerControlTargetLocation(operation));
    assert.equal(end.closeRevision, 0);
  }
}

console.log('reader control original-operation resume, MR1 timing and mixed restoration: PASS');

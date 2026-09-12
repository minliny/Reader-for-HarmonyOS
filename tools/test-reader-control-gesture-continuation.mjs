import assert from 'node:assert/strict';
import {
  advanceReaderControlSession, createReaderControlSessionState, dismissReaderControlSession,
  enterReaderControlModule, expandReaderControlSession, openReaderControlSession,
  readerControlTargetLocation, sampleReaderControlSession,
} from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import {
  beginReaderControlGesture, cancelReaderControlGesture, createReaderControlGestureState,
  endReaderControlGesture, readerControlGestureTargetDuration,
  updateReaderControlGesture, readerControlGrabberScreenY,
} from '../entry/src/main/ets/features/reading/ReaderControlGestureDriver.ts';

const config = {
  axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 },
  tapMaxDurationMs: 350, directionSlopVp: 2,
  settleDurationMs: 1150, showDurationMs: 420, dismissDurationMs: 360,
};
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const quick = () => enterReaderControlModule(openReaderControlSession(createReaderControlSessionState(), 0), 'directory', 0, 'bookmarks');
const full = () => expandReaderControlSession(quick(), 0);
const hold = (s, y) => beginReaderControlGesture(s, createReaderControlGestureState(config), 1, y, 0);
const move = (p, y, t) => updateReaderControlGesture(p.session, p.gesture, 1, y, t);
const release = (p, t) => endReaderControlGesture(p.session, p.gesture, 1, t);

// Finger goes 582vp beyond the authored 18vp close path. A 1vp return cannot
// expose a new frame at a screen position hundreds of vp from the finger.
let pair = hold(full(), 300);
pair = move(pair, 900, 100);
assert.equal(sampleReaderControlSession(pair.session).visibilityProgress, 0);
near(pair.gesture.blockedDeltaVp, 582);
assert.equal(pair.session.closeRevision, 0);
pair = move(pair, 899, 200);
assert.equal(sampleReaderControlSession(pair.session).visibilityProgress, 0);
near(pair.gesture.blockedDeltaVp, 581);
pair = move(pair, 318, 300);
assert.equal(sampleReaderControlSession(pair.session).visibilityProgress, 0);
near(pair.gesture.blockedDeltaVp, 0);
pair = move(pair, 309, 400);
near(sampleReaderControlSession(pair.session).visibilityProgress, 0.5);
assert.equal(sampleReaderControlSession(pair.session).expansionProgress, 1);
pair = move(pair, 309, 1400);
pair = release(pair, 1500);
near(pair.session.transition.durationMs, 210);
assert.equal(readerControlTargetLocation(pair.session).directoryTab, 'bookmarks');
assert.equal(readerControlTargetLocation(pair.session).form, 'full');

// Speed affects continuation time, never target choice; use a real stationary
// sample here to measure nominal show/hide/morph timing independently.
pair = hold(full(), 300);
pair = move(pair, 309, 100);
pair = move(pair, 309, 1000);
pair = release(pair, 1100);
near(pair.session.transition.durationMs, 180);
assert.equal(readerControlTargetLocation(pair.session).level, 'hidden');

pair = hold(quick(), 700);
pair = move(pair, 684, 100);
pair = move(pair, 684, 1000);
pair = release(pair, 1100);
near(pair.session.transition.durationMs, 1104);
assert.equal(readerControlTargetLocation(pair.session).form, 'full');

// CANCEL retains the pre-hold logical closing goal and uses its own duration.
let closing = dismissReaderControlSession(full(), 360);
closing = advanceReaderControlSession(closing, 90, closing.epoch);
pair = hold(closing, 304.5);
pair = move(pair, 900, 100);
pair = cancelReaderControlGesture(pair.session, pair.gesture, 1);
assert.equal(pair.session.location.level, 'hidden');
assert.equal(pair.session.closeRevision, 1);

// Upward travel outside Full also has a residue; no made-up elastic bounce.
pair = hold(quick(), 700);
pair = move(pair, 200, 100);
near(sampleReaderControlSession(pair.session).expansionProgress, 1);
near(pair.gesture.blockedDeltaVp, -100);
pair = move(pair, 250, 200);
near(sampleReaderControlSession(pair.session).expansionProgress, 1);
pair = move(pair, 309, 300);
near(sampleReaderControlSession(pair.session).visibilityProgress, 0.5);
assert.equal(pair.session.transition.kind, 'dismiss');

assert.equal(readerControlGestureTargetDuration(closing, config, { ...full().location }), 420);
assert.equal(readerControlGestureTargetDuration(closing, { ...config, showDurationMs: 0 }, full().location), 0);
assert.equal(readerControlGestureTargetDuration(closing, { ...config, showDurationMs: -1 }, full().location), 1150);

// Replay subpixel input on the VM's measured axis. Previously a reconstruction
// error became a negative blockedDeltaVp around halfway through expansion:
// later MOVE coordinates arrived but the handle stayed at 55-70% until UP.
for (const density of [1, 2.75, 3.5]) {
  for (const steps of [36, 60, 90, 120]) {
    const measured = { ...config, axis: { quickGrabberScreenY: 1628 / density,
      fullGrabberScreenY: 357 / density, hiddenGrabberScreenY: 1628 / density + 18 } };
    let p = beginReaderControlGesture(quick(), createReaderControlGestureState(measured),
      7, 1628 / density, 0);
    let previousPx = 1628;
    let timeMs = 0;
    for (const targetPx of [1374, 992, 611, 1374, 611]) {
      for (let i = 1; i <= steps; i += 1) {
        const y = (previousPx + (targetPx - previousPx) * i / steps) / density;
        timeMs += 8;
        p = updateReaderControlGesture(p.session, p.gesture, 7, y, timeMs);
        near(readerControlGrabberScreenY(sampleReaderControlSession(p.session), measured.axis), y);
        assert.equal(p.gesture.blockedDeltaVp, 0, 'reachable movement has no out-of-bounds residue');
        assert.equal(p.session.heldPointerId, 7);
      }
      previousPx = targetPx;
    }
    p = endReaderControlGesture(p.session, p.gesture, 7, timeMs + 3000);
    assert.equal(p.session.heldPointerId, -1);
    assert.equal(readerControlTargetLocation(p.session).form, 'full');
  }
}
console.log('reader control bounded finger residue and distinct continuation timings: PASS');

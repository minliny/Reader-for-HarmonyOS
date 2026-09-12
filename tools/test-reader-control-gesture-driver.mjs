import assert from 'node:assert/strict';
import {
  advanceReaderControlSession, backReaderControlSession, createReaderControlSessionState,
  dismissReaderControlSession, enterReaderControlModule, expandReaderControlSession,
  openReaderControlSession, readerControlContentLocation, readerControlTargetLocation,
  sampleReaderControlSession,
} from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import {
  beginReaderControlGesture, cancelReaderControlGesture, createReaderControlGestureState,
  endReaderControlGesture, readerControlGrabberScreenY, rebaseReaderControlGesture,
  updateReaderControlGesture,
} from '../entry/src/main/ets/features/reading/ReaderControlGestureDriver.ts';

const config = {
  axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 },
  tapMaxDurationMs: 350, directionSlopVp: 2, settleDurationMs: 400,
};
const modules = ['directory', 'tts', 'appearance', 'settings', 'search', 'autoPage', 'replace'];
function finish(initial) {
  let current = initial;
  for (let i = 0; i < 8 && current.transition !== undefined; i += 1) {
    current = advanceReaderControlSession(current, 10000, current.epoch);
  }
  assert.equal(current.transition, undefined);
  return current;
}
function home() { return openReaderControlSession(createReaderControlSessionState(), 0); }
function quick(module, tab = 'directory') { return enterReaderControlModule(home(), module, 0, tab); }
function down(session, y, time = 0) {
  return beginReaderControlGesture(session, createReaderControlGestureState(config), 1, y, time);
}
function move(pair, y, time) { return updateReaderControlGesture(pair.session, pair.gesture, 1, y, time); }
function up(pair, time) { return endReaderControlGesture(pair.session, pair.gesture, 1, time); }
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }

for (const module of modules) {
  // Low-position, very slow upward motion must still expand; no midpoint/fling gate.
  let pair = down(quick(module), 700);
  const onDown = sampleReaderControlSession(pair.session);
  assert.deepEqual(onDown, { expansionProgress: 0, visibilityProgress: 1 });
  pair = move(pair, 684, 1000);
  close(sampleReaderControlSession(pair.session).expansionProgress, 0.04);
  close(readerControlGrabberScreenY(sampleReaderControlSession(pair.session), config.axis), 684);
  pair = move(pair, 684, 2000); // Stop: zero speed must not erase the upward intent.
  assert.equal(pair.gesture.velocityYVpPerSecond, 0);
  const beforeUp = sampleReaderControlSession(pair.session);
  pair = up(pair, 2100);
  assert.deepEqual(sampleReaderControlSession(pair.session), beforeUp);
  assert.equal(readerControlTargetLocation(pair.session).form, 'full');
  const full = finish(pair.session);
  assert.equal(full.location.form, 'full');

  // Full near the upper endpoint + slow down => direct dismissal, not Quick collapse.
  pair = down(full, 300);
  pair = move(pair, 316, 1000);
  assert.equal(pair.session.transition.kind, 'dismiss');
  assert.equal(sampleReaderControlSession(pair.session).expansionProgress, 1);
  close(readerControlGrabberScreenY(sampleReaderControlSession(pair.session), config.axis), 316);
  pair = up(pair, 1100);
  assert.equal(readerControlTargetLocation(pair.session).level, 'hidden');
  assert.equal(finish(pair.session).location.level, 'hidden');
}

// Home never expands by click, slow drag or fling; downward close still works.
let pair = up(down(home(), 700), 100);
assert.equal(finish(pair.session).location.level, 'home');
pair = down(home(), 700);
pair = move(pair, 300, 16);
pair = up(pair, 16);
assert.equal(pair.session.transition, undefined);
assert.equal(pair.session.location.level, 'home');
pair = down(home(), 700);
pair = move(pair, 720, 1000);
pair = up(pair, 1100);
assert.equal(finish(pair.session).location.level, 'hidden');

// Direction reversal after a long drag, then holding still, must not fall back to p > .5.
pair = down(quick('appearance'), 700);
pair = move(pair, 380, 16);
pair = move(pair, 400, 1016);
pair = move(pair, 400, 2016);
close(sampleReaderControlSession(pair.session).expansionProgress, 0.75);
assert.equal(pair.gesture.recentDirection, 'down');
pair = up(pair, 2200);
assert.equal(readerControlTargetLocation(pair.session).form, 'quick');
assert.equal(finish(pair.session).location.form, 'quick');

// A full bookmark panel can become completely invisible under the finger and be restored.
const fullBookmark = expandReaderControlSession(quick('directory', 'bookmarks'), 0);
pair = down(fullBookmark, 300);
pair = move(pair, 318, 100);
assert.equal(sampleReaderControlSession(pair.session).visibilityProgress, 0);
assert.equal(pair.session.closeRevision, 0);
assert.equal(readerControlContentLocation(pair.session).directoryTab, 'bookmarks');
pair = move(pair, 314, 1100);
close(readerControlGrabberScreenY(sampleReaderControlSession(pair.session), config.axis), 314);
pair = move(pair, 314, 2100);
pair = up(pair, 2200);
let restored = finish(pair.session);
assert.equal(restored.location.form, 'full');
assert.equal(restored.location.directoryTab, 'bookmarks');
assert.equal(restored.closeRevision, 0);
pair = down(restored, 300);
pair = move(pair, 318, 100);
pair = up(pair, 100);
assert.equal(pair.session.location.level, 'hidden');
assert.equal(pair.session.closeRevision, 1);

// Stable long hold is no action. Animated long hold pauses and resumes the old target.
pair = down(quick('tts'), 700);
pair = up(pair, 2000);
assert.equal(pair.session.location.form, 'quick');
let expanding = expandReaderControlSession(quick('tts'), 400);
expanding = advanceReaderControlSession(expanding, 100, expanding.epoch);
const regrabFrame = sampleReaderControlSession(expanding);
const staleEpoch = expanding.epoch;
pair = down(expanding, 600, 100);
assert.deepEqual(sampleReaderControlSession(pair.session), regrabFrame);
assert.strictEqual(advanceReaderControlSession(pair.session, 10000, staleEpoch), pair.session);
assert.strictEqual(advanceReaderControlSession(pair.session, 10000, pair.session.epoch), pair.session);
pair = up(pair, 2100);
assert.equal(finish(pair.session).location.form, 'full');
pair = down(expanding, 600, 100);
pair = up(pair, 200);
assert.equal(finish(pair.session).location.form, 'quick', 'short tap in flight changes the target');

// Stable short clicks classify on UP, including sub-slop jitter.
pair = down(quick('settings'), 700);
pair = move(pair, 701, 20);
assert.equal(pair.gesture.moved, false);
pair = up(pair, 100);
assert.equal(finish(pair.session).location.form, 'full');

// Re-grab follows actual displacement; resize rebases input without editing the frame.
pair = down(expanding, 600, 100);
pair = move(pair, 599, 116);
close(sampleReaderControlSession(pair.session).expansionProgress, 0.2525);
const resizeFrame = sampleReaderControlSession(pair.session);
const resizedAxis = { quickGrabberScreenY: 900, fullGrabberScreenY: 400, hiddenGrabberScreenY: 918 };
pair.gesture = rebaseReaderControlGesture(pair.gesture, resizedAxis, 599);
assert.deepEqual(sampleReaderControlSession(pair.session), resizeFrame);
pair = move(pair, 574, 132);
close(sampleReaderControlSession(pair.session).expansionProgress, 0.3025);

// Later fingers do not steal/end the active pointer. A released UP is consumed once.
pair = down(quick('search'), 700);
const secondDown = beginReaderControlGesture(pair.session, pair.gesture, 2, 700, 1);
assert.equal(secondDown.consumed, false);
assert.strictEqual(secondDown.session, pair.session);
assert.equal(endReaderControlGesture(pair.session, pair.gesture, 2, 100).consumed, false);
pair = up(pair, 100);
assert.equal(pair.finishedTouch, true);
assert.equal(up(pair, 101).consumed, false);

// Explicit Back revokes the pointer epoch: late MOVE/UP cannot overwrite it.
pair = down(fullBookmark, 300);
pair = move(pair, 316, 20);
const afterBack = backReaderControlSession(pair.session, 400).state;
assert.equal(updateReaderControlGesture(afterBack, pair.gesture, 1, 200, 40).consumed, false);
assert.equal(endReaderControlGesture(afterBack, pair.gesture, 1, 80).consumed, false);
assert.equal(readerControlTargetLocation(afterBack).level, 'hidden');

// CANCEL never generates a click or treats the last pointer velocity as a fling.
pair = down(quick('replace'), 700);
pair = move(pair, 500, 16);
pair = cancelReaderControlGesture(pair.session, pair.gesture, 1);
assert.equal(finish(pair.session).location.form, 'quick');
let closing = dismissReaderControlSession(fullBookmark, 400);
closing = advanceReaderControlSession(closing, 100, closing.epoch);
pair = down(closing, 304.5, 100);
pair = cancelReaderControlGesture(pair.session, pair.gesture, 1);
assert.equal(finish(pair.session).location.level, 'hidden', 'cancel resumes the pre-hold close');

// UP normally follows MOVE on a later event timestamp: retain the measured tail
// speed instead of silently turning every short fling into a zero-speed release.
pair = down(quick('appearance'), 700);
pair = move(pair, 620, 16);
const flingAtMove = pair.gesture.velocityYVpPerSecond;
pair = up(pair, 24);
assert.ok(Math.abs(pair.gesture.velocityYVpPerSecond) > 0);
assert.ok(Math.abs(pair.gesture.velocityYVpPerSecond) < Math.abs(flingAtMove));
assert.ok(pair.session.transition.durationMs < config.settleDurationMs * 0.8);
const fastTarget = readerControlTargetLocation(pair.session);
let slow = down(quick('appearance'), 700);
slow = move(slow, 620, 1000);
slow = up(slow, 1500);
assert.deepEqual(readerControlTargetLocation(slow.session), fastTarget, 'speed changes time, not endpoint');
assert.ok(slow.session.transition.durationMs > pair.session.transition.durationMs);

// The same held pointer can reverse through Quick and continue into dismissal
// without losing the distance beyond the boundary or needing another gesture.
pair = down(quick('appearance'), 700);
pair = move(pair, 500, 100);
pair = move(pair, 710, 200);
assert.equal(pair.session.transition.kind, 'dismiss');
close(readerControlGrabberScreenY(sampleReaderControlSession(pair.session), config.axis), 710);
pair = move(pair, 660, 300);
assert.equal(pair.session.transition.kind, 'morph');
close(readerControlGrabberScreenY(sampleReaderControlSession(pair.session), config.axis), 660);
pair = up(pair, 400);
assert.equal(finish(pair.session).location.form, 'full');

// Module navigation has no handle travel of its own; dragging it must acquire
// the same spatial driver, not silently discard MOVE because travel is zero.
let navigating = enterReaderControlModule(home(), 'search', 400);
pair = down(navigating, 700);
pair = move(pair, 660, 100);
close(readerControlGrabberScreenY(sampleReaderControlSession(pair.session), config.axis), 660);
pair = up(pair, 200);
assert.equal(finish(pair.session).location.form, 'full');

console.log('reader control gesture production driver behavior: PASS');

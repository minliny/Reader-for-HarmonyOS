import assert from 'node:assert/strict';

import {
  advanceReaderAppearanceMotion,
  beginReaderAppearanceTracking,
  cancelReaderAppearanceMotion,
  createReaderAppearanceMotionState,
  readerAppearanceMotionIsActive,
  releaseReaderAppearanceTracking,
  sampleReaderAppearanceMotionState,
  setReaderAppearanceMeasuredAxis,
  setReaderAppearanceMotionTimeScale,
  startReaderAppearanceProgrammatic,
  updateReaderAppearanceTracking,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionState.ts';
import {
  readerAppearanceCubicBezierProgress,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts';

const axis = { quickGrabberScreenY: 740, fullGrabberScreenY: 340 };

function yFor(p, measuredAxis = axis) {
  return measuredAxis.quickGrabberScreenY +
    (measuredAxis.fullGrabberScreenY - measuredAxis.quickGrabberScreenY) * p;
}

function close(actual, expected, message, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`);
}

function beginAt(state, p, eventTimeMs = 0, measuredAxis = axis) {
  const pointerY = yFor(p, measuredAxis);
  return beginReaderAppearanceTracking(state, pointerY, pointerY, measuredAxis, eventTimeMs);
}

function finish(initial, deltas = [8.33, 16.67, 33, 50]) {
  let state = initial;
  const completed = [];
  for (let index = 0; index < 1000 && state.phase === 'settling'; index += 1) {
    const result = advanceReaderAppearanceMotion(
      state,
      deltas[index % deltas.length],
      state.epoch,
    );
    state = result.state;
    if (result.completedEndpoint !== undefined) completed.push(result.completedEndpoint);
  }
  assert.notEqual(state.phase, 'settling', 'motion failed to finish');
  return { state, completed };
}

let state = createReaderAppearanceMotionState('quick');
assert.equal(state.phase, 'idleQuick');
assert.equal(state.masterProgress, 0);
assert.equal(readerAppearanceMotionIsActive(state), false);
assert.equal(Object.hasOwn(state, 'profile'), false);
assert.equal(Object.hasOwn(state, 'rawExpansionProgress'), false);
assert.equal(Object.hasOwn(state, 'elasticOffsetVp'), false);

// Programmatic expand/collapse traverses one symmetric p axis.
state = startReaderAppearanceProgrammatic(state, 'full');
assert.equal(state.phase, 'settling');
assert.equal(state.settleDurationMs, 420);
const expandEpoch = state.epoch;
state = advanceReaderAppearanceMotion(state, 210, expandEpoch).state;
close(state.masterProgress, 0.5, 'expand half-time p');
state = advanceReaderAppearanceMotion(state, 210, expandEpoch).state;
assert.equal(state.phase, 'idleFull');
assert.equal(state.stableEndpoint, 'full');
close(state.masterProgress, 1, 'expanded endpoint');

state = startReaderAppearanceProgrammatic(state, 'quick');
assert.equal(state.settleDurationMs, 420, 'collapse cannot select a second profile duration');
const collapseEpoch = state.epoch;
state = advanceReaderAppearanceMotion(state, 210, collapseEpoch).state;
close(state.masterProgress, 0.5, 'collapse half-time p');
assert.deepEqual(
  sampleReaderAppearanceMotionState(state),
  sampleReaderAppearanceMotionState({ ...state, masterProgress: 0.5 }),
  'the same p must have one frame',
);
state = advanceReaderAppearanceMotion(state, 210, collapseEpoch).state;
assert.equal(state.phase, 'idleQuick');

// Time scale changes time only, preserving the exact current p/frame.
let scaled = startReaderAppearanceProgrammatic(
  createReaderAppearanceMotionState('quick', false, 0.75),
  'full',
);
close(scaled.settleDurationMs, 315, 'scaled full duration');
scaled = advanceReaderAppearanceMotion(scaled, 157.5, scaled.epoch).state;
const scaledFrame = sampleReaderAppearanceMotionState(scaled);
const oldEpoch = scaled.epoch;
scaled = setReaderAppearanceMotionTimeScale(scaled, 1.5);
assert.ok(scaled.epoch > oldEpoch);
assert.deepEqual(sampleReaderAppearanceMotionState(scaled), scaledFrame);
close(scaled.settleElapsedMs / scaled.settleDurationMs, 0.5, 'clock fraction preserved');

// Measured-axis refresh cannot move visual p.
const resizedAxis = { quickGrabberScreenY: 1010, fullGrabberScreenY: 510 };
const beforeAxisRefresh = sampleReaderAppearanceMotionState(scaled);
const settlingProgressBeforeAxisRefresh = scaled.masterProgress;
const settlingPointerBeforeAxisRefresh = scaled.lastPointerScreenY;
scaled = setReaderAppearanceMeasuredAxis(scaled, resizedAxis);
assert.deepEqual(sampleReaderAppearanceMotionState(scaled), beforeAxisRefresh);
close(scaled.masterProgress, settlingProgressBeforeAxisRefresh,
  'settling axis refresh preserves master p');
close(scaled.trackingPointerStartScreenY, settlingPointerBeforeAxisRefresh,
  'settling axis refresh rebases the pointer anchor');
close(scaled.trackingGrabberStartScreenY,
  yFor(settlingProgressBeforeAxisRefresh, resizedAxis),
  'settling axis refresh rebases the grabber anchor');

// DOWN preserves p; actual grabber screenY + pointer delta produces p.
let drag = beginAt(createReaderAppearanceMotionState('quick'), 0);
const trackingEpoch = drag.epoch;
drag = updateReaderAppearanceTracking(drag, 640, 16, -625);
close(drag.masterProgress, 0.25, '100vp upward over measured 400vp');
drag = updateReaderAppearanceTracking(drag, 540, 32, -625);
close(drag.masterProgress, 0.5, '200vp upward over measured 400vp');
drag = updateReaderAppearanceTracking(drag, 620, 48, 500);
close(drag.masterProgress, 0.3, 'reverse drag follows same screen axis');
assert.equal(drag.epoch, trackingEpoch, 'MOVE cannot create a competing epoch');

// A different measured travel changes only the screenY-to-p scale.
let resizedDrag = beginReaderAppearanceTracking(
  createReaderAppearanceMotionState('quick'),
  1010,
  1010,
  resizedAxis,
  0,
);
resizedDrag = updateReaderAppearanceTracking(resizedDrag, 885, 16, 0);
close(resizedDrag.masterProgress, 0.25, '125vp over measured 500vp');

// If the measured axis changes during a drag, preserve the current frame and
// rebase both anchors. The very next MOVE continues from that exact p using
// the new measured travel instead of stale pre-resize screen coordinates.
let resizedMidDrag = beginAt(createReaderAppearanceMotionState('quick'), 0);
resizedMidDrag = updateReaderAppearanceTracking(resizedMidDrag, 540, 16, 0);
close(resizedMidDrag.masterProgress, 0.5, 'pre-resize tracking p');
const frameBeforeTrackingAxisRefresh = sampleReaderAppearanceMotionState(resizedMidDrag);
const pointerBeforeTrackingAxisRefresh = resizedMidDrag.lastPointerScreenY;
resizedMidDrag = setReaderAppearanceMeasuredAxis(resizedMidDrag, resizedAxis);
assert.deepEqual(
  sampleReaderAppearanceMotionState(resizedMidDrag),
  frameBeforeTrackingAxisRefresh,
  'tracking axis refresh changed the current frame',
);
close(resizedMidDrag.trackingPointerStartScreenY, pointerBeforeTrackingAxisRefresh,
  'tracking axis refresh pointer anchor');
close(resizedMidDrag.trackingGrabberStartScreenY, yFor(0.5, resizedAxis),
  'tracking axis refresh grabber anchor');
resizedMidDrag = updateReaderAppearanceTracking(
  resizedMidDrag,
  pointerBeforeTrackingAxisRefresh - 25,
  32,
  0,
);
close(resizedMidDrag.masterProgress, 0.55,
  'first MOVE after resize uses new 500vp axis without a jump');

// Release begins at the exact current p/frame and settles monotonically.
drag = updateReaderAppearanceTracking(drag, 500, 64, 0);
close(drag.masterProgress, 0.6, 'release start p');
const releaseFrame = sampleReaderAppearanceMotionState(drag);
drag = releaseReaderAppearanceTracking(drag, 0, 64);
assert.equal(drag.target, 'full');
assert.equal(drag.phase, 'settling');
close(drag.masterProgress, 0.6, 'release changed p synchronously');
assert.deepEqual(sampleReaderAppearanceMotionState(drag), releaseFrame,
  'release must not jump any actor');
let previous = drag.masterProgress;
while (drag.phase === 'settling') {
  const result = advanceReaderAppearanceMotion(drag, 16.67, drag.epoch);
  drag = result.state;
  assert.ok(drag.masterProgress >= previous - 1e-9);
  previous = drag.masterProgress;
}
assert.equal(drag.phase, 'idleFull');

// Velocity can select the endpoint, but never a different sampler/profile.
let fling = beginAt(createReaderAppearanceMotionState('quick'), 0);
fling = updateReaderAppearanceTracking(fling, 660, 16, -500);
close(fling.masterProgress, 0.2, 'fling position');
fling = releaseReaderAppearanceTracking(fling, -500, 16);
assert.equal(fling.target, 'full');

fling = beginAt(createReaderAppearanceMotionState('full'), 1);
fling = updateReaderAppearanceTracking(fling, 420, 16, 500);
close(fling.masterProgress, 0.8, 'reverse fling position');
fling = releaseReaderAppearanceTracking(fling, 500, 16);
assert.equal(fling.target, 'quick');

// Settlement can be re-grabbed without a frame change. The next 1vp movement
// changes p by exactly 1 / measuredTravel.
let interruptible = startReaderAppearanceProgrammatic(
  createReaderAppearanceMotionState('quick'),
  'full',
);
const staleEpoch = interruptible.epoch;
interruptible = advanceReaderAppearanceMotion(interruptible, 120, staleEpoch).state;
const pBeforeRegrab = interruptible.masterProgress;
const frameBeforeRegrab = sampleReaderAppearanceMotionState(interruptible);
const currentY = yFor(pBeforeRegrab);
interruptible = beginReaderAppearanceTracking(
  interruptible,
  currentY,
  currentY,
  axis,
  120,
);
assert.deepEqual(sampleReaderAppearanceMotionState(interruptible), frameBeforeRegrab);
const stale = advanceReaderAppearanceMotion(interruptible, 100, staleEpoch);
assert.equal(stale.state, interruptible);
assert.equal(stale.shouldContinue, false);
interruptible = updateReaderAppearanceTracking(interruptible, currentY - 1, 136, 0);
close(interruptible.masterProgress, pBeforeRegrab + 1 / 400,
  'one vp re-grab movement');

// CANCEL starts a continuous settlement to the source; it cannot snap.
const cancelStartFrame = sampleReaderAppearanceMotionState(interruptible);
const revisionBeforeCancel = interruptible.completionRevision;
interruptible = cancelReaderAppearanceMotion(interruptible);
assert.equal(interruptible.phase, 'settling');
assert.equal(interruptible.target, 'quick');
assert.deepEqual(sampleReaderAppearanceMotionState(interruptible), cancelStartFrame);
interruptible = finish(interruptible).state;
assert.equal(interruptible.phase, 'idleQuick');
assert.equal(interruptible.completionRevision, revisionBeforeCancel,
  'returning to the stable source is not a route commit');

// Reduced motion still follows screenY directly, then snaps on release.
let reduced = beginAt(createReaderAppearanceMotionState('quick', true), 0);
reduced = updateReaderAppearanceTracking(reduced, 460, 16, 0);
close(reduced.masterProgress, 0.7, 'reduced-motion direct drag');
reduced = releaseReaderAppearanceTracking(reduced, 0, 16);
assert.equal(reduced.phase, 'idleFull');

// Runtime full height is supplied at sampling and remains driven by the same p.
const tallFrame = sampleReaderAppearanceMotionState({ ...reduced, masterProgress: 0.5 }, 900);
const figmaStageHalf = readerAppearanceCubicBezierProgress(0.5, 0, 0, 0.58, 1);
close(tallFrame.shellHeight, 330 + (900 - 330) * figmaStageHalf,
  'runtime-height shell midpoint');
close(tallFrame.shellTranslateY, 900 - tallFrame.shellHeight,
  'runtime-height shell top');

console.log('reader appearance master motion state: PASS');

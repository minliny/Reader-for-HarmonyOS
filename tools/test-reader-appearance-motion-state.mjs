import assert from 'node:assert/strict';

import {
  advanceReaderAppearanceMotion,
  beginReaderAppearanceTracking,
  cancelReaderAppearanceMotion,
  createReaderAppearanceMotionState,
  readerAppearanceMotionIsActive,
  releaseReaderAppearanceTracking,
  sampleReaderAppearanceMotionState,
  setReaderAppearanceMotionTimeScale,
  startReaderAppearanceProgrammatic,
  updateReaderAppearanceTracking,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionState.ts';

function close(actual, expected, epsilon = 1e-5, message = '') {
  assert.ok(Math.abs(actual - expected) <= epsilon,
    `${message} expected ${expected}, received ${actual}`);
}

let state = createReaderAppearanceMotionState('quick');
assert.equal(state.phase, 'idleQuick');
assert.equal(state.profile, 'expandN');
assert.equal(state.epoch, 0);
assert.equal(state.expansionProgress, 0);
assert.equal(readerAppearanceMotionIsActive(state), false);

// Full-distance clicks retain the product timing while every spatial actor is
// sampled from physical expansion rather than a root handoff timeline.
state = startReaderAppearanceProgrammatic(state, 'full');
assert.equal(state.phase, 'settling');
assert.equal(state.profile, 'expandN');
assert.equal(state.settleMode, 'programmatic');
close(state.settleDurationMs, 420);
const nEpoch = state.epoch;
let advanced = advanceReaderAppearanceMotion(state, 128, nEpoch);
state = advanced.state;
assert.ok(state.expansionProgress > 0 && state.expansionProgress < 1,
  'the 128ms frame must stay inside the physical expansion interval');
assert.equal(advanced.shouldContinue, true);
advanced = advanceReaderAppearanceMotion(state, 292, nEpoch);
state = advanced.state;
assert.equal(advanced.completedEndpoint, 'full');
assert.equal(advanced.shouldContinue, false);
assert.equal(state.phase, 'idleFull');
assert.equal(state.stableEndpoint, 'full');
assert.equal(state.completionRevision, 1);
close(state.expansionProgress, 1);
close(state.elasticOffsetVp, 0);

// Stable Full keeps the 360ms collapse clock, but its geometry is the exact
// reverse of the same persistent actor tree.
state = startReaderAppearanceProgrammatic(state, 'quick');
assert.equal(state.profile, 'collapseO');
close(state.settleDurationMs, 360);
const oEpoch = state.epoch;
advanced = advanceReaderAppearanceMotion(state, 360, oEpoch);
state = advanced.state;
assert.equal(advanced.completedEndpoint, 'quick');
assert.equal(state.phase, 'idleQuick');
assert.equal(state.completionRevision, 2);

// One global time scale changes total time without altering normalized tracks.
let scaled = createReaderAppearanceMotionState('quick', false, 0.75);
scaled = startReaderAppearanceProgrammatic(scaled, 'full');
close(scaled.settleDurationMs, 315);
let scaledHalf = advanceReaderAppearanceMotion(scaled, 157.5, scaled.epoch).state;
assert.ok(scaledHalf.expansionProgress > 0 && scaledHalf.expansionProgress < 1);

// Live time-scale changes preserve the rendered frame and only change the
// rate at which the remaining shared timeline is traversed.
const scaledBeforeChange = sampleReaderAppearanceMotionState(scaledHalf);
const scaledOldEpoch = scaledHalf.epoch;
scaledHalf = setReaderAppearanceMotionTimeScale(scaledHalf, 1.5);
assert.ok(scaledHalf.epoch > scaledOldEpoch);
close(scaledHalf.expansionProgress, scaledBeforeChange.expansionProgress);
close(sampleReaderAppearanceMotionState(scaledHalf).shellHeight, scaledBeforeChange.shellHeight);
close(scaledHalf.settleElapsedMs / scaledHalf.settleDurationMs, 0.5);
close(scaledHalf.settleDurationMs, 630);

// A programmatic redirect from an interrupted frame starts at the currently
// rendered physical expansion. Duration is target-direction base time times
// remaining physical distance, never the old origin profile/timeline span.
let redirected = createReaderAppearanceMotionState('quick');
redirected = startReaderAppearanceProgrammatic(redirected, 'full');
redirected = advanceReaderAppearanceMotion(redirected, 126, redirected.epoch).state;
const redirectStartExpansion = redirected.expansionProgress;
const redirectStartFrame = sampleReaderAppearanceMotionState(redirected);
redirected = startReaderAppearanceProgrammatic(redirected, 'quick');
close(redirected.expansionProgress, redirectStartExpansion);
close(sampleReaderAppearanceMotionState(redirected).quickMorph.y, redirectStartFrame.quickMorph.y,
  1e-5, 'programmatic redirect jumped the persistent surface');
close(redirected.settleDurationMs, 360 * redirectStartExpansion, 1e-4);
const redirectedNext = advanceReaderAppearanceMotion(redirected, 1, redirected.epoch).state;
assert.ok(redirectedNext.expansionProgress < redirectStartExpansion,
  'redirected programmatic motion must continue from the current frame toward source');

// Half-distance settlement is deterministic in physical space: 210ms upward,
// 180ms downward. Both source endpoints and an in-flight redirect use the same
// rule, and timeScale applies only after the remaining-distance calculation.
for (const source of ['quick', 'full']) {
  let half = beginReaderAppearanceTracking(createReaderAppearanceMotionState(source), 0);
  half = updateReaderAppearanceTracking(half, 0.5, 16, 0);
  const halfFrame = sampleReaderAppearanceMotionState(half);
  const toFull = startReaderAppearanceProgrammatic(half, 'full');
  close(toFull.expansionProgress, 0.5);
  close(toFull.settleDurationMs, 210, 1e-5, `${source} half -> Full duration`);
  close(sampleReaderAppearanceMotionState(toFull).fontItems[0].y, halfFrame.fontItems[0].y,
    1e-5, `${source} half -> Full jumped Font0`);
  const toQuick = startReaderAppearanceProgrammatic(half, 'quick');
  close(toQuick.expansionProgress, 0.5);
  close(toQuick.settleDurationMs, 180, 1e-5, `${source} half -> Quick duration`);
  close(sampleReaderAppearanceMotionState(toQuick).fontItems[0].y, halfFrame.fontItems[0].y,
    1e-5, `${source} half -> Quick jumped Font0`);

  let scaledHalf = beginReaderAppearanceTracking(
    createReaderAppearanceMotionState(source, false, 1.5),
    0,
  );
  scaledHalf = updateReaderAppearanceTracking(scaledHalf, 0.5, 16, 0);
  close(startReaderAppearanceProgrammatic(scaledHalf, 'full').settleDurationMs, 315,
    1e-5, `${source} scaled half -> Full duration`);
  close(startReaderAppearanceProgrammatic(scaledHalf, 'quick').settleDurationMs, 270,
    1e-5, `${source} scaled half -> Quick duration`);
}

// Reduced motion snaps programmatic and release paths to their endpoint.
let reduced = createReaderAppearanceMotionState('quick', true);
reduced = startReaderAppearanceProgrammatic(reduced, 'full');
assert.equal(reduced.phase, 'idleFull');
assert.equal(reduced.stableEndpoint, 'full');
assert.equal(reduced.completionRevision, 1);
reduced = beginReaderAppearanceTracking(reduced, 0);
reduced = updateReaderAppearanceTracking(reduced, 0.35, 16, 0);
reduced = releaseReaderAppearanceTracking(reduced, 0, 16);
assert.equal(reduced.phase, 'idleQuick');
assert.equal(reduced.stableEndpoint, 'quick');

// Direct manipulation is genuinely bidirectional on one physical expansion
// coordinate; the compatibility profile cannot alter actor geometry.
state = createReaderAppearanceMotionState('quick');
state = beginReaderAppearanceTracking(state, 0);
assert.equal(state.phase, 'tracking');
assert.equal(state.epoch, 1);
state = updateReaderAppearanceTracking(state, 0.65, 100, -1200);
const forwardExpansion = state.expansionProgress;
close(state.expansionProgress, 0.65);
state = updateReaderAppearanceTracking(state, 0.35, 200, 1200);
assert.ok(state.expansionProgress < forwardExpansion,
  'reverse drag must reverse the physical shared-actor coordinate');
assert.equal(state.profile, 'expandN', 'branch cannot switch in the middle of an interaction');

// A low-speed release over halfway settles monotonically to Full.
state = updateReaderAppearanceTracking(state, 0.6, 240, 0);
state = releaseReaderAppearanceTracking(state, 0, 240);
assert.equal(state.target, 'full');
assert.equal(state.phase, 'settling');
assert.equal(state.settleMode, 'gesture');
const settleEpoch = state.epoch;
let previousExpansion = state.expansionProgress;
const irregularFrames = [8.33, 16.67, 33, 50, 100, 250];
let completed = undefined;
for (const delta of irregularFrames) {
  advanced = advanceReaderAppearanceMotion(state, delta, settleEpoch);
  state = advanced.state;
  assert.ok(state.expansionProgress + 1e-9 >= previousExpansion,
    'gesture settlement must be monotonic even across long frames');
  previousExpansion = state.expansionProgress;
  if (advanced.completedEndpoint !== undefined) {
    completed = advanced.completedEndpoint;
  }
  if (!advanced.shouldContinue) {
    break;
  }
}
assert.equal(completed, 'full');
assert.equal(state.stableEndpoint, 'full');

// A decisive downward fling overrides an 80% position and keeps the O branch.
state = beginReaderAppearanceTracking(state, 1000);
assert.equal(state.profile, 'collapseO');
state = updateReaderAppearanceTracking(state, 0.8, 1016, 1000);
state = releaseReaderAppearanceTracking(state, 1000, 1016);
assert.equal(state.target, 'quick');
assert.equal(state.profile, 'collapseO');
const reverseEpoch = state.epoch;
previousExpansion = state.expansionProgress;
while (state.phase === 'settling') {
  advanced = advanceReaderAppearanceMotion(state, 33, reverseEpoch);
  state = advanced.state;
  assert.ok(state.expansionProgress <= previousExpansion + 1e-9,
    'reverse settlement must remain monotonic toward Quick');
  previousExpansion = state.expansionProgress;
}

// Stale frame callbacks are rejected after a re-grab.
let interruptible = createReaderAppearanceMotionState('quick');
interruptible = startReaderAppearanceProgrammatic(interruptible, 'full');
const staleEpoch = interruptible.epoch;
interruptible = advanceReaderAppearanceMotion(interruptible, 120, staleEpoch).state;
const actorsBeforeSettleRegrab = sampleReaderAppearanceMotionState(interruptible).actorSamples;
interruptible = beginReaderAppearanceTracking(interruptible, 120);
const regrabEpoch = interruptible.epoch;
assert.ok(regrabEpoch > staleEpoch);
assert.deepEqual(sampleReaderAppearanceMotionState(interruptible).actorSamples,
  actorsBeforeSettleRegrab,
  're-grabbing a settlement must preserve every shared/reveal actor bbox and alpha');
const stale = advanceReaderAppearanceMotion(interruptible, 200, staleEpoch);
assert.equal(stale.state, interruptible);
assert.equal(stale.shouldContinue, false);
assert.equal(interruptible.phase, 'tracking');

// CANCEL returns to the interaction source without producing a new commit.
const revisionBeforeCancel = interruptible.completionRevision;
interruptible = updateReaderAppearanceTracking(interruptible, 0.75, 160, 0);
interruptible = cancelReaderAppearanceMotion(interruptible);
assert.equal(interruptible.phase, 'idleQuick');
assert.equal(interruptible.stableEndpoint, 'quick');
assert.equal(interruptible.completionRevision, revisionBeforeCancel);

// Gesture overscroll is shell-only; actor progress remains clamped.
let overflow = createReaderAppearanceMotionState('quick');
overflow = beginReaderAppearanceTracking(overflow, 0);
overflow = updateReaderAppearanceTracking(overflow, -1, 16, 500);
const overflowFrame = sampleReaderAppearanceMotionState(overflow);
assert.ok(overflowFrame.shellHeight >= 326 && overflowFrame.shellHeight < 330);
close(overflowFrame.expansionProgress, 0);
close(overflowFrame.header.opacity, 0);

// Fast release creates at most 4vp shell-only elastic and remains re-grabbable.
let elastic = createReaderAppearanceMotionState('quick');
elastic = beginReaderAppearanceTracking(elastic, 0);
elastic = updateReaderAppearanceTracking(elastic, 0.7, 16, -1000);
elastic = releaseReaderAppearanceTracking(elastic, -1000, 16);
assert.equal(elastic.target, 'full');
assert.ok(Math.abs(elastic.elasticAmplitudeVp) <= 4);
const elasticEpoch = elastic.epoch;
advanced = advanceReaderAppearanceMotion(elastic, elastic.settleDurationMs, elasticEpoch);
elastic = advanced.state;
assert.equal(advanced.completedEndpoint, 'full');
assert.equal(elastic.phase, 'elastic');
elastic = advanceReaderAppearanceMotion(elastic, 45, elasticEpoch).state;
const beforeRegrab = sampleReaderAppearanceMotionState(elastic);
assert.ok(beforeRegrab.shellHeight >= 732 && beforeRegrab.shellHeight <= 740);
close(beforeRegrab.header.opacity, 1, 1e-4, 'content stays at the clamped endpoint');
elastic = beginReaderAppearanceTracking(elastic, 100);
const afterRegrab = sampleReaderAppearanceMotionState(elastic);
close(afterRegrab.shellHeight, beforeRegrab.shellHeight, 1e-5,
  're-grab must preserve the rendered shell top');
assert.deepEqual(afterRegrab.actorSamples, beforeRegrab.actorSamples,
  're-grabbing rebound must not jump any persistent actor');
close(elastic.elasticOffsetVp, 0);
assert.equal(elastic.phase, 'tracking');
assert.equal(elastic.profile, 'collapseO',
  'the endpoint is committed before elastic, so a re-grab starts the next O branch');

console.log('reader appearance motion state: PASS');

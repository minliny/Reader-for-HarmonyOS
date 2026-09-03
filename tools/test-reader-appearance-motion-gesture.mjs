import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  READER_APPEARANCE_FULL_HEIGHT,
  READER_APPEARANCE_QUICK_HEIGHT,
  READER_APPEARANCE_SHELL_TRAVEL_VP,
  readerAppearanceExpansionFromDrag,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts';
import {
  advanceReaderAppearanceMotion,
  beginReaderAppearanceTracking,
  cancelReaderAppearanceMotion,
  createReaderAppearanceMotionState,
  releaseReaderAppearanceTracking,
  sampleReaderAppearanceMotionState,
  startReaderAppearanceProgrammatic,
  updateReaderAppearanceTracking,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionState.ts';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/reader-appearance-motion-figma-n-o.json', import.meta.url),
  'utf8',
));
const stageSource = readFileSync(new URL(
  '../entry/src/main/ets/features/reading/ReaderAppearanceMotionStage.ets',
  import.meta.url,
), 'utf8');

function close(actual, expected, message, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`);
}

function advanceSequence(initial, deltas) {
  let state = initial;
  let completed = [];
  for (const delta of deltas) {
    const result = advanceReaderAppearanceMotion(state, delta, state.epoch);
    state = result.state;
    if (result.completedEndpoint !== undefined) {
      completed.push(result.completedEndpoint);
    }
    if (!result.shouldContinue) {
      break;
    }
  }
  return { state, completed };
}

function finishMotion(initial, framePattern = [8.33, 16.67, 33, 50, 16.67]) {
  let state = initial;
  let completed = [];
  let index = 0;
  for (; index < 1000 && (state.phase === 'settling' || state.phase === 'elastic'); index += 1) {
    const result = advanceReaderAppearanceMotion(
      state,
      framePattern[index % framePattern.length],
      state.epoch,
    );
    state = result.state;
    if (result.completedEndpoint !== undefined) {
      completed.push(result.completedEndpoint);
    }
  }
  assert.ok(index < 1000, 'motion failed to reach a stable endpoint');
  return { state, completed };
}

assert.equal(fixture.productSupplement.notAuthoredByFigma, true);
assert.equal(READER_APPEARANCE_SHELL_TRAVEL_VP,
  fixture.productSupplement.directManipulation.physicalTravelVp);

// The stage owns a persistent raw-touch grabber and a single VSync clock. A
// PanGesture translation followed by animateTo would fail the direct-manipulation contract.
assert.match(stageSource, /class ReaderAppearanceStageFrameCallback extends FrameCallback/);
assert.match(stageSource, /\.onTouch\(\(event: TouchEvent\): void => this\.handleGrabberTouch\(event\)\)/);
assert.doesNotMatch(stageSource, /PanGesture\s*\(/);
assert.doesNotMatch(stageSource, /animateTo\s*\(/);
assert.match(stageSource, /expectedEpoch !== this\.motionState\.epoch/,
  'posted frames must reject a stale epoch after re-grab');
assert.match(stageSource, /this\.brightnessRail\s*\(/);
assert.match(stageSource, /this\.moduleNav\s*\(/);
assert.match(stageSource,
  /private brightnessLayer\(\)[\s\S]*?y: READER_APPEARANCE_BRIGHTNESS_FIXED_Y/,
  'BrightnessRail must stay at its fixed screen y outside MorphStage');
assert.match(stageSource,
  /private moduleNavLayer\(\)[\s\S]*?\.height\(READER_APPEARANCE_MOTION_STAGE_HEIGHT\)/,
  'ModuleNav must stay bottom-aligned in the fixed stage outside MorphStage');
assert.doesNotMatch(stageSource, /FullOutgoing|QuickIncoming|quickDockOpacity|fullDockOpacity/,
  'the persistent Stage must not retain either legacy Quick/Full root crossfade');
assert.doesNotMatch(stageSource, /\.opacity\(this\.renderFrame\.quickMorph\.opacity\)/,
  'the shared surface cannot dissolve at the Stage root');

// Physical drag is one-to-one over the exact 406vp shell travel.
close(readerAppearanceExpansionFromDrag(0, -READER_APPEARANCE_SHELL_TRAVEL_VP), 1,
  'full upward travel must reach full');
close(readerAppearanceExpansionFromDrag(1, READER_APPEARANCE_SHELL_TRAVEL_VP), 0,
  'full downward travel must reach quick');

let state = createReaderAppearanceMotionState('quick');
assert.equal(state.phase, 'idleQuick');
assert.equal(state.profile, 'expandN');
state = beginReaderAppearanceTracking(state, 0);
const trackingEpoch = state.epoch;
for (const [timeMs, rawExpansion] of [[16, 0.2], [32, 0.65], [48, 0.35], [64, 0.8]]) {
  state = updateReaderAppearanceTracking(state, rawExpansion, timeMs);
  close(state.expansionProgress, rawExpansion, `drag expansion at ${timeMs}ms`);
  const frame = sampleReaderAppearanceMotionState(state);
  close(frame.shellHeight,
    READER_APPEARANCE_QUICK_HEIGHT + rawExpansion * READER_APPEARANCE_SHELL_TRAVEL_VP,
  `direct shell height at ${timeMs}ms`);
  close(frame.shellHeight + frame.shellTranslateY, READER_APPEARANCE_FULL_HEIGHT,
    `bottom anchor at ${timeMs}ms`);
}
assert.equal(state.epoch, trackingEpoch, 'MOVE must not create competing animation epochs');

// Low-speed release uses the projected 0.5 endpoint threshold.
let lowQuick = beginReaderAppearanceTracking(createReaderAppearanceMotionState('quick'), 0);
lowQuick = updateReaderAppearanceTracking(lowQuick, 0.49, 16, 0);
lowQuick = releaseReaderAppearanceTracking(lowQuick, 0, 16);
assert.equal(lowQuick.target, 'quick');
assert.equal(finishMotion(lowQuick).state.phase, 'idleQuick');

let lowFull = beginReaderAppearanceTracking(createReaderAppearanceMotionState('quick'), 0);
lowFull = updateReaderAppearanceTracking(lowFull, 0.51, 16, 0);
lowFull = releaseReaderAppearanceTracking(lowFull, 0, 16);
assert.equal(lowFull.target, 'full');
assert.equal(finishMotion(lowFull).state.phase, 'idleFull');

// Velocity at or above 400vp/s wins over position: negative y expands, positive y collapses.
let flingFull = beginReaderAppearanceTracking(createReaderAppearanceMotionState('quick'), 0);
flingFull = updateReaderAppearanceTracking(flingFull, 0.2, 16, -500);
flingFull = releaseReaderAppearanceTracking(flingFull, -500, 16);
assert.equal(flingFull.target, 'full');

let flingQuick = beginReaderAppearanceTracking(createReaderAppearanceMotionState('full'), 0);
flingQuick = updateReaderAppearanceTracking(flingQuick, 0.8, 16, 500);
flingQuick = releaseReaderAppearanceTracking(flingQuick, 500, 16);
assert.equal(flingQuick.target, 'quick');

// Gesture settlement is monotonic and cannot overshoot physical actor space.
let monotonic = flingFull;
let previousExpansion = monotonic.expansionProgress;
for (let index = 0; index < 100 && monotonic.phase === 'settling'; index += 1) {
  const result = advanceReaderAppearanceMotion(monotonic, 16.67, monotonic.epoch);
  monotonic = result.state;
  assert.ok(monotonic.expansionProgress >= previousExpansion - 1e-9,
    'settlement reversed away from its target');
  assert.ok(monotonic.expansionProgress >= 0 && monotonic.expansionProgress <= 1,
    'main expansion overshot its authored endpoint');
  previousExpansion = monotonic.expansionProgress;
}

// A re-grab invalidates the posted settle epoch and keeps the current profile.
let interruptible = beginReaderAppearanceTracking(createReaderAppearanceMotionState('quick'), 0);
interruptible = updateReaderAppearanceTracking(interruptible, 0.72, 16, -300);
interruptible = releaseReaderAppearanceTracking(interruptible, -300, 16);
const settleEpoch = interruptible.epoch;
const partial = advanceReaderAppearanceMotion(interruptible, 60, settleEpoch).state;
const expansionBeforeRegrab = partial.expansionProgress;
const profileBeforeRegrab = partial.profile;
const frameBeforeRegrab = sampleReaderAppearanceMotionState(partial);
const regrabbed = beginReaderAppearanceTracking(partial, 80);
assert.ok(regrabbed.epoch > settleEpoch);
assert.equal(regrabbed.profile, profileBeforeRegrab,
  're-grab must not switch N/O in the middle of a profile');
close(regrabbed.expansionProgress, expansionBeforeRegrab, 'settle re-grab continuity');
assert.deepEqual(sampleReaderAppearanceMotionState(regrabbed).actorSamples,
  frameBeforeRegrab.actorSamples,
  'settle re-grab must preserve every persistent actor bbox and reveal value');
const staleResult = advanceReaderAppearanceMotion(regrabbed, 100, settleEpoch);
assert.equal(staleResult.state, regrabbed, 'stale frame mutated the re-grabbed state');
assert.equal(staleResult.shouldContinue, false);

// Reversing a quick-origin interaction stays on N until it reaches an endpoint.
let reverseN = updateReaderAppearanceTracking(regrabbed, 0.3, 96, 300);
reverseN = releaseReaderAppearanceTracking(reverseN, 300, 96);
assert.equal(reverseN.profile, 'expandN');
assert.equal(reverseN.target, 'quick');
assert.equal(finishMotion(reverseN).state.phase, 'idleQuick');

// Programmatic paths keep the audited 420/360 endpoint durations, use no
// elastic channel, and scale as a whole.
for (const timeScale of fixture.productSupplement.timeScale.verificationValues) {
  let expand = startReaderAppearanceProgrammatic(
    createReaderAppearanceMotionState('quick', false, timeScale),
    'full',
  );
  assert.equal(expand.profile, 'expandN');
  close(expand.settleDurationMs, fixture.profiles.N.productDurationMs * timeScale,
    `N time scale ${timeScale}`);
  assert.equal(expand.elasticAmplitudeVp, 0);
  const expandDone = finishMotion(expand);
  assert.equal(expandDone.state.phase, 'idleFull');
  assert.deepEqual(expandDone.completed, ['full']);

  let collapse = startReaderAppearanceProgrammatic(
    createReaderAppearanceMotionState('full', false, timeScale),
    'quick',
  );
  assert.equal(collapse.profile, 'collapseO');
  close(collapse.settleDurationMs, fixture.profiles.O.productDurationMs * timeScale,
    `O time scale ${timeScale}`);
  assert.equal(collapse.elasticAmplitudeVp, 0);
  const collapseDone = finishMotion(collapse);
  assert.equal(collapseDone.state.phase, 'idleQuick');
  assert.deepEqual(collapseDone.completed, ['quick']);
}

// Elapsed-time integration is frame-rate independent, including one 100ms long frame.
const deterministicBase = startReaderAppearanceProgrammatic(
  createReaderAppearanceMotionState('quick'),
  'full',
);
const regular = advanceSequence(deterministicBase, [16, 16, 16, 16, 16, 16, 4]).state;
const irregular = advanceSequence(deterministicBase, [33, 17, 50]).state;
close(regular.expansionProgress, irregular.expansionProgress,
  'physical shell depends on frame count rather than elapsed time');

// CANCEL returns to the interaction source without committing a new endpoint.
let cancelled = beginReaderAppearanceTracking(createReaderAppearanceMotionState('quick'), 0);
cancelled = updateReaderAppearanceTracking(cancelled, 0.8, 16, -200);
const revisionBeforeCancel = cancelled.completionRevision;
cancelled = cancelReaderAppearanceMotion(cancelled);
assert.equal(cancelled.phase, 'idleQuick');
assert.equal(cancelled.completionRevision, revisionBeforeCancel);

// Raw overflow is limited to 4vp and cannot leak into opacity/blur/shared actors.
let overflow = beginReaderAppearanceTracking(createReaderAppearanceMotionState('quick'), 0);
overflow = updateReaderAppearanceTracking(overflow, 2, 16, -1000);
close(overflow.expansionProgress, 1, 'content progress must clamp at full');
const overflowFrame = sampleReaderAppearanceMotionState(overflow);
assert.ok(overflowFrame.shellHeight <= READER_APPEARANCE_FULL_HEIGHT +
  fixture.productSupplement.elastic.maxOffsetVp + 1e-6);
close(overflowFrame.header.opacity, 1, 'raw overflow leaked into Header opacity');
close(overflowFrame.header.blurVp, 0, 'raw overflow leaked into Header blur');

// Reduced motion keeps direct manipulation, but release/programmatic settlement snaps.
let reduced = createReaderAppearanceMotionState('quick', true);
reduced = beginReaderAppearanceTracking(reduced, 0);
reduced = updateReaderAppearanceTracking(reduced, 0.7, 16, 0);
close(reduced.expansionProgress, 0.7, 'reduced-motion drag stopped following the finger');
reduced = releaseReaderAppearanceTracking(reduced, 0, 16);
assert.equal(reduced.phase, 'idleFull');
assert.equal(reduced.elasticOffsetVp, 0);
const reducedClick = startReaderAppearanceProgrammatic(
  createReaderAppearanceMotionState('quick', true),
  'full',
);
assert.equal(reducedClick.phase, 'idleFull');
assert.equal(reducedClick.settleDurationMs, 0);

// Repeated endpoint alternation must not accumulate raw, elastic, or route state.
let repeated = createReaderAppearanceMotionState('quick');
for (let index = 0; index < 10; index += 1) {
  const target = index % 2 === 0 ? 'full' : 'quick';
  repeated = startReaderAppearanceProgrammatic(repeated, target);
  repeated = finishMotion(repeated, [16.67, 33, 8.33, 50]).state;
  assert.equal(repeated.phase, target === 'full' ? 'idleFull' : 'idleQuick');
  close(repeated.rawExpansionProgress, target === 'full' ? 1 : 0,
    `repeat ${index} raw endpoint`);
  close(repeated.elasticOffsetVp, 0, `repeat ${index} elastic residue`);
}

console.log('reader appearance interruptible gesture: PASS');

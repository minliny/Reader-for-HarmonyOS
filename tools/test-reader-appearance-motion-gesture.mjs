import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  advanceReaderAppearanceMotion,
  beginReaderAppearanceTracking,
  createReaderAppearanceMotionState,
  releaseReaderAppearanceTracking,
  sampleReaderAppearanceMotionState,
  updateReaderAppearanceTracking,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionState.ts';

const stageSource = readFileSync(new URL(
  '../entry/src/main/ets/features/reading/ReaderAppearanceMotionStage.ets',
  import.meta.url,
), 'utf8');

const axis = { quickGrabberScreenY: 760, fullGrabberScreenY: 280 };

function close(actual, expected, message, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`);
}

function finish(initial, framePattern = [8.33, 16.67, 33, 50]) {
  let state = initial;
  for (let index = 0; index < 1000 && state.phase === 'settling'; index += 1) {
    state = advanceReaderAppearanceMotion(
      state,
      framePattern[index % framePattern.length],
      state.epoch,
    ).state;
  }
  assert.notEqual(state.phase, 'settling');
  return state;
}

// The presentation host must use raw touch + measured screen-space geometry;
// direction profiles and fixed-travel conversion are forbidden.
assert.match(stageSource, /class ReaderAppearanceStageFrameCallback extends FrameCallback/);
assert.match(stageSource, /\.onTouch\(\(event: TouchEvent\): void => this\.handleGrabberTouch\(event\)\)/);
assert.doesNotMatch(stageSource, /PanGesture\s*\(/);
assert.doesNotMatch(stageSource, /animateTo\s*\(/);
assert.doesNotMatch(stageSource, /collapseO|expandN|\.profile/);
assert.doesNotMatch(stageSource, /rawExpansionProgress|elasticOffsetVp|trackingStartRawExpansion/);
assert.doesNotMatch(stageSource, /readerAppearanceExpansionFromDrag/);
assert.doesNotMatch(stageSource,
  /motionState\.profile\s*===\s*['"]expandN['"]\s*\?\s*this\.renderFrame/,
  'fixed actors cannot be direction-gated');
assert.match(stageSource, /masterProgress/);
assert.match(stageSource, /fullHeight|availableHeight/,
  'Stage must pass current runtime height into the sampler');

// A noisy bidirectional pointer path follows actual screenY one-to-one.
let state = beginReaderAppearanceTracking(
  createReaderAppearanceMotionState('quick'),
  axis.quickGrabberScreenY,
  axis.quickGrabberScreenY,
  axis,
  0,
);
const epoch = state.epoch;
for (const [timeMs, screenY, expectedP] of [
  [16, 664, 0.2],
  [32, 448, 0.65],
  [48, 592, 0.35],
  [64, 376, 0.8],
]) {
  state = updateReaderAppearanceTracking(state, screenY, timeMs);
  close(state.masterProgress, expectedP, `screenY drag at ${timeMs}ms`);
  close(sampleReaderAppearanceMotionState(state, 820).masterProgress, expectedP,
    `actor master p at ${timeMs}ms`);
}
assert.equal(state.epoch, epoch, 'MOVE cannot start parallel animation clocks');

// Release preserves the exact frame, and settlement remains monotonic.
const frameAtRelease = sampleReaderAppearanceMotionState(state, 820);
state = releaseReaderAppearanceTracking(state, 0, 64);
assert.equal(state.target, 'full');
assert.deepEqual(sampleReaderAppearanceMotionState(state, 820), frameAtRelease);
let previous = state.masterProgress;
while (state.phase === 'settling') {
  state = advanceReaderAppearanceMotion(state, 16.67, state.epoch).state;
  assert.ok(state.masterProgress >= previous - 1e-9);
  previous = state.masterProgress;
}
assert.equal(state.phase, 'idleFull');

// A downward path is the same screen mapping and the same frame sampler.
state = beginReaderAppearanceTracking(
  state,
  axis.fullGrabberScreenY,
  axis.fullGrabberScreenY,
  axis,
  1000,
);
state = updateReaderAppearanceTracking(state, 520, 1016, 0);
close(state.masterProgress, 0.5, 'downward screenY mapping');
const downwardHalf = sampleReaderAppearanceMotionState(state, 820);

let upwardHalfState = beginReaderAppearanceTracking(
  createReaderAppearanceMotionState('quick'),
  axis.quickGrabberScreenY,
  axis.quickGrabberScreenY,
  axis,
  0,
);
upwardHalfState = updateReaderAppearanceTracking(upwardHalfState, 520, 16, 0);
assert.deepEqual(sampleReaderAppearanceMotionState(upwardHalfState, 820), downwardHalf,
  'direction/history changed the p=.5 frame');

// Re-grab an in-flight settle at its actual grabber screenY: DOWN is exactly
// frame-stable and the next pointer movement continues from there.
state = releaseReaderAppearanceTracking(state, 0, 1016);
const settlingEpoch = state.epoch;
state = advanceReaderAppearanceMotion(state, 60, settlingEpoch).state;
const beforeRegrab = sampleReaderAppearanceMotionState(state, 820);
const currentY = axis.quickGrabberScreenY -
  (axis.quickGrabberScreenY - axis.fullGrabberScreenY) * state.masterProgress;
state = beginReaderAppearanceTracking(state, currentY, currentY, axis, 1076);
assert.deepEqual(sampleReaderAppearanceMotionState(state, 820), beforeRegrab);
assert.equal(advanceReaderAppearanceMotion(state, 100, settlingEpoch).shouldContinue, false,
  'stale settle frame survived re-grab');
const beforeMoveP = state.masterProgress;
state = updateReaderAppearanceTracking(state, currentY + 24, 1092, 0);
close(state.masterProgress, beforeMoveP - 0.05, 're-grab continuation uses measured travel');

// Pointer movement clamps to the single p; no shell-only/raw overscroll exists.
let clamped = beginReaderAppearanceTracking(
  createReaderAppearanceMotionState('quick'),
  760,
  760,
  axis,
  0,
);
clamped = updateReaderAppearanceTracking(clamped, 100, 16, -1000);
close(clamped.masterProgress, 1, 'upper overscroll clamps master p');
const clampedFrame = sampleReaderAppearanceMotionState(clamped, 820);
close(clampedFrame.shellHeight, 820, 'shell reads the same clamped p');
close(clampedFrame.morphStage.trackProgress, 1, 'MorphStage reads the same clamped p');

// Elapsed-time integration is deterministic across frame patterns.
const base = releaseReaderAppearanceTracking(
  updateReaderAppearanceTracking(
    beginReaderAppearanceTracking(
      createReaderAppearanceMotionState('quick'), 760, 760, axis, 0,
    ),
    616,
    16,
    0,
  ),
  0,
  16,
);
let regular = base;
for (const delta of [16, 16, 16, 16, 16, 16, 4]) {
  regular = advanceReaderAppearanceMotion(regular, delta, regular.epoch).state;
}
let irregular = base;
for (const delta of [33, 17, 50]) {
  irregular = advanceReaderAppearanceMotion(irregular, delta, irregular.epoch).state;
}
close(regular.masterProgress, irregular.masterProgress,
  'settlement depends on frame count rather than elapsed time');

// Repeated alternation cannot accumulate a hidden secondary coordinate.
let repeated = createReaderAppearanceMotionState('quick');
for (let index = 0; index < 8; index += 1) {
  const startY = repeated.stableEndpoint === 'quick' ?
    axis.quickGrabberScreenY : axis.fullGrabberScreenY;
  repeated = beginReaderAppearanceTracking(repeated, startY, startY, axis, index * 1000);
  const targetY = repeated.stableEndpoint === 'quick' ? 280 : 760;
  repeated = updateReaderAppearanceTracking(repeated, targetY, index * 1000 + 16, 0);
  repeated = releaseReaderAppearanceTracking(repeated, 0, index * 1000 + 16);
  repeated = finish(repeated);
  close(repeated.masterProgress, repeated.stableEndpoint === 'full' ? 1 : 0,
    `repeat endpoint ${index}`);
  assert.equal(Object.hasOwn(repeated, 'rawExpansionProgress'), false);
}

console.log('reader appearance measured-screen gesture: PASS');

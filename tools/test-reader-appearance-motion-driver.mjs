import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  READER_APPEARANCE_COLLAPSE_DURATION_MS,
  READER_APPEARANCE_EXPAND_DURATION_MS,
  READER_APPEARANCE_FULL_ONLY_ACTOR_IDS,
  READER_APPEARANCE_SHARED_ACTOR_IDS,
  readerAppearanceTrajectoryFromExpansion,
  sampleReaderAppearanceExpansion,
  sampleReaderAppearanceMotion,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/reader-appearance-motion-figma-n-o.json', import.meta.url),
  'utf8',
));
const contract = fixture.implementationContract;
const contractById = new Map(contract.sharedActors.map((actor) => [actor.id, actor]));

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function cubicCoordinate(parameter, first, second) {
  const inverse = 1 - parameter;
  return 3 * inverse * inverse * parameter * first +
    3 * inverse * parameter * parameter * second + parameter ** 3;
}

// Independent CSS/Figma cubic evaluator. Production easing must not be used to
// manufacture the expected intermediate bounding boxes.
function easeOut(progress) {
  const input = clamp01(progress);
  if (input === 0 || input === 1) return input;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 32; index += 1) {
    const parameter = (low + high) / 2;
    if (cubicCoordinate(parameter, 0, 0.58) < input) {
      low = parameter;
    } else {
      high = parameter;
    }
  }
  return cubicCoordinate((low + high) / 2, 0, 1);
}

function close(actual, expected, message, tolerance = 0.002) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`);
}

function actorFrame(sample, actorId) {
  const matches = sample.actorSamples.filter((candidate) => candidate.id === actorId);
  assert.equal(matches.length, 1, `sample must contain exactly one ${actorId}`);
  return matches[0].frame;
}

function expectedRect(actor, expansion) {
  const progress = actor.curve === 'linear-in-physical-expansion' ? expansion : easeOut(expansion);
  const rect = {};
  for (const field of ['x', 'y', 'width', 'height']) {
    rect[field] = actor.sourceRectVp[field] +
      (actor.targetRectVp[field] - actor.sourceRectVp[field]) * progress;
  }
  return rect;
}

function compareRect(frame, expected, label, tolerance = 0.002) {
  for (const field of ['x', 'y', 'width', 'height']) {
    close(frame[field], expected[field], `${label}.${field}`, tolerance);
  }
}

function compareActorFrames(actual, expected, label) {
  for (const field of ['x', 'y', 'width', 'height', 'translateX', 'translateY', 'opacity', 'blurVp']) {
    close(actual[field], expected[field], `${label}.${field}`, 1e-5);
  }
}

assert.equal(READER_APPEARANCE_EXPAND_DURATION_MS, contract.timing.expandFullDistanceMs);
assert.equal(READER_APPEARANCE_COLLAPSE_DURATION_MS, contract.timing.collapseFullDistanceMs);
assert.deepEqual(READER_APPEARANCE_SHARED_ACTOR_IDS, contract.actorGroups.shared,
  'runtime shared registry must exactly match the audited persistent tree');
assert.deepEqual(READER_APPEARANCE_FULL_ONLY_ACTOR_IDS, contract.actorGroups.fullOnly,
  'runtime Full-only registry must exactly match the staged reveal contract');

for (const expansion of [0, ...contract.sampleExpansionProgress, 1]) {
  const sample = sampleReaderAppearanceExpansion(expansion);
  close(sample.expansionProgress, expansion, `physical expansion @${expansion}`);
  assert.equal(new Set(sample.actorSamples.map((actor) => actor.id)).size,
    sample.actorSamples.length, `actor inventory duplicated at e=${expansion}`);
  for (const forbidden of contract.actorGroups.forbiddenRootCrossfade) {
    assert.equal(sample.actorSamples.some((actor) => actor.id === forbidden), false,
      `${forbidden} root crossfade re-entered the V2 tree at e=${expansion}`);
  }
  for (const actorId of READER_APPEARANCE_SHARED_ACTOR_IDS) {
    const frame = actorFrame(sample, actorId);
    const actorContract = contractById.get(actorId);
    compareRect(frame, expectedRect(actorContract, expansion), `${actorId}@e=${expansion}`);
    close(frame.translateX, 0, `${actorId} must expose a direct bbox, not a second x transform`);
    close(frame.translateY, 0, `${actorId} must expose a direct bbox, not a second y transform`);
    close(frame.opacity, contract.sharedActorOpacity, `${actorId} must never crossfade`);
    close(frame.blurVp, contract.sharedActorBlurVp, `${actorId} must never dissolve`);
  }
}

// The split must continue after the old 183/420 cutoff. At e=.75 every shared
// actor is still between its endpoints, and e=.75 -> 1 produces another bbox
// change rather than a frozen root dissolve.
const threeQuarter = sampleReaderAppearanceExpansion(0.75);
const full = sampleReaderAppearanceExpansion(1);
for (const actorId of READER_APPEARANCE_SHARED_ACTOR_IDS) {
  const actor = contractById.get(actorId);
  const atThreeQuarter = actorFrame(threeQuarter, actorId);
  const atFull = actorFrame(full, actorId);
  assert.notDeepEqual(
    ['x', 'y', 'width', 'height'].map((field) => atThreeQuarter[field]),
    ['x', 'y', 'width', 'height'].map((field) => atFull[field]),
    `${actorId} froze before physical expansion reached 1`,
  );
  compareRect(atFull, actor.targetRectVp, `${actorId} Full endpoint`);
}

// Each card owns its own displacement vector. Moving one parent rectangle
// would make all four first-row x deltas equal and fails this check.
const themeXTravel = ['ThemeDay', 'ThemeWarm', 'ThemeNight', 'ThemeWarmNight']
  .map((id) => contractById.get(id).targetRectVp.x - contractById.get(id).sourceRectVp.x);
assert.equal(new Set(themeXTravel.map((value) => value.toFixed(3))).size, 4,
  'theme cards must fan out with four independent horizontal trajectories');
const fontXTravel = ['Font0', 'Font1', 'Font2', 'Font3']
  .map((id) => contractById.get(id).targetRectVp.x - contractById.get(id).sourceRectVp.x);
assert.equal(new Set(fontXTravel.map((value) => value.toFixed(3))).size, 4,
  'font cards must redistribute independently into the corrected Full grid');

// Compatibility N/O clocks may have different temporal easing, but at the
// same physical e they must evaluate the exact same persistent tree and
// Full-only reveal. Collapse retraces Expand instead of crossfading roots.
for (const expansion of contract.sampleExpansionProgress) {
  const canonical = sampleReaderAppearanceExpansion(expansion);
  for (const profile of ['expandN', 'collapseO']) {
    const trajectory = readerAppearanceTrajectoryFromExpansion(profile, expansion);
    const sampled = sampleReaderAppearanceMotion(profile, trajectory);
    close(sampled.expansionProgress, expansion, `${profile} recovered e=${expansion}`, 1e-5);
    for (const actorId of [...READER_APPEARANCE_SHARED_ACTOR_IDS,
      ...READER_APPEARANCE_FULL_ONLY_ACTOR_IDS]) {
      compareActorFrames(actorFrame(sampled, actorId), actorFrame(canonical, actorId),
        `${profile}/${actorId}@e=${expansion}`);
    }
  }
}

// Full-only content reveals after geometry creates room. It is absent at
// Quick, monotonic inside its phase, and complete at Full. Shared actors above
// remain opaque throughout, so this is not a disguised root fade.
for (const reveal of contract.fullOnlyReveal) {
  const before = sampleReaderAppearanceExpansion(Math.max(0, reveal.startExpansion - 0.01));
  const start = sampleReaderAppearanceExpansion(reveal.startExpansion);
  const middle = sampleReaderAppearanceExpansion((reveal.startExpansion + reveal.endExpansion) / 2);
  const end = sampleReaderAppearanceExpansion(reveal.endExpansion);
  close(actorFrame(before, reveal.id).opacity, 0, `${reveal.id} revealed before its phase`);
  close(actorFrame(start, reveal.id).opacity, 0, `${reveal.id} phase start`);
  assert.ok(actorFrame(middle, reveal.id).opacity > 0 && actorFrame(middle, reveal.id).opacity < 1,
    `${reveal.id} must have an independently observable reveal midpoint`);
  close(actorFrame(end, reveal.id).opacity, 1, `${reveal.id} phase end`);
}

console.log('reader appearance Motion V2 driver: PASS');

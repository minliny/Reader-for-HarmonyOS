import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  READER_APPEARANCE_FINAL_N2_PUBLISHED,
  READER_APPEARANCE_LEGACY_ACTOR_TRACKS,
  READER_APPEARANCE_LEGACY_SHARED_GEOMETRY_END_PROGRESS,
  READER_APPEARANCE_QUICK_HEIGHT,
  readerAppearanceFigmaFramePercent,
  readerAppearanceGrabberScreenYFromMasterProgress,
  readerAppearanceMasterProgressFromScreenY,
  readerAppearanceMeasuredTravelVp,
  readerAppearanceMotionStageSupported,
  readerAppearanceMotionViewportHeight,
  readerAppearanceMotionViewportWidth,
  readerAppearanceScrollCompensationVp,
  readerAppearanceTrackProgress,
  sampleReaderAppearanceMasterProgress,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/reader-appearance-motion-figma-n-o.json', import.meta.url),
  'utf8',
));
const legacyN = fixture.legacyEvidence.N;

function fixtureTrack(actorId, property) {
  const actor = legacyN.actors.find((candidate) => candidate.id === actorId);
  assert.ok(actor, `fixture actor missing: ${actorId}`);
  const matches = actor.tracks.filter((track) => track.property === property);
  assert.equal(matches.length, 1, `fixture track missing: ${actorId}.${property}`);
  return matches[0];
}

function fixtureMasterProgress(reviewMs) {
  const [start, end] = legacyN.activeReviewWindowMs;
  return (reviewMs - start) / (end - start);
}

function close(actual, expected, message, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`);
}

assert.equal(READER_APPEARANCE_FINAL_N2_PUBLISHED, false);

// The same percentage comes from actual screen Y over any measured travel.
for (const axis of [
  { quickGrabberScreenY: 740, fullGrabberScreenY: 340 },
  { quickGrabberScreenY: 1010, fullGrabberScreenY: 510 },
  { quickGrabberScreenY: 320, fullGrabberScreenY: 120 },
]) {
  const travel = axis.quickGrabberScreenY - axis.fullGrabberScreenY;
  close(readerAppearanceMeasuredTravelVp(axis), travel, 'measured travel');
  for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const y = axis.quickGrabberScreenY - travel * p;
    close(readerAppearanceMasterProgressFromScreenY(y, axis), p,
      `screenY -> p for travel ${travel}`);
    close(readerAppearanceGrabberScreenYFromMasterProgress(p, axis), y,
      `p -> screenY for travel ${travel}`);
  }
}
close(readerAppearanceMasterProgressFromScreenY(50, {
  quickGrabberScreenY: 100,
  fullGrabberScreenY: 100,
}), 0, 'zero measured travel is safe');

assert.equal(readerAppearanceMotionStageSupported(364, 736), true);
assert.equal(readerAppearanceMotionStageSupported(363.99, 736), false,
  'fixed 364vp legacy coordinates must not clip on narrow windows');
assert.equal(readerAppearanceMotionStageSupported(364, 330), false,
  'zero measured travel must use the responsive static fallback');
assert.equal(readerAppearanceMotionStageSupported(364, 373), false,
  'a sub-touch-target axis is too sensitive for direct manipulation');
assert.equal(readerAppearanceMotionStageSupported(364, 374), true,
  'a grabber-hit-height travel is the minimum supported interaction axis');
close(readerAppearanceScrollCompensationVp(120, 0), 120, 'Quick cancels retained scroll');
close(readerAppearanceScrollCompensationVp(120, 0.25), 90, 'scroll cancellation follows master p');
close(readerAppearanceScrollCompensationVp(120, 1), 0, 'Full preserves retained scroll');
close(readerAppearanceScrollCompensationVp(-30, 0), 0, 'negative overscroll cannot offset Quick content');

const expectedFigmaPercent = [1 / 9, 13 / 48, 31 / 72, 85 / 144, 3 / 4];
for (const [index, p] of [0, 0.25, 0.5, 0.75, 1].entries()) {
  close(readerAppearanceFigmaFramePercent(p), expectedFigmaPercent[index],
    `Figma effective-axis mapping at p=${p}`);
}

// Shell/grabber geometry is linear in p and respects the current full height.
for (const fullHeight of [620, 736, 900]) {
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    const frame = sampleReaderAppearanceMasterProgress(p, fullHeight);
    const expectedHeight = READER_APPEARANCE_QUICK_HEIGHT +
      (fullHeight - READER_APPEARANCE_QUICK_HEIGHT) * p;
    close(frame.masterProgress, p, `master p at ${fullHeight}/${p}`);
    close(frame.shellHeight, expectedHeight, `shell height at ${fullHeight}/${p}`);
    close(frame.shellTranslateY, fullHeight - expectedHeight,
      `shell top at ${fullHeight}/${p}`);
    close(frame.morphStage.trackProgress, p, `shell local progress at ${p}`);
  }
}

// Bottom-anchored source positions move with runtime height; full/held target
// positions stay in full-panel design coordinates.
const referenceQuick = sampleReaderAppearanceMasterProgress(0, 736);
const tallQuick = sampleReaderAppearanceMasterProgress(0, 900);
close(readerAppearanceMotionViewportWidth(referenceQuick, 364), 286,
  'reference Quick viewport fits its sheet');
close(readerAppearanceMotionViewportWidth(referenceQuick, 280), 280 - referenceQuick.quickMorph.x,
  'viewport width clamps to a short sheet edge');
close(readerAppearanceMotionViewportHeight(referenceQuick), 190,
  'reference Quick viewport fits its shell');
const shortFull = sampleReaderAppearanceMasterProgress(1, 500);
close(readerAppearanceMotionViewportHeight(shortFull), 443,
  'Full scroll viewport clamps to the reachable live shell bottom');
close(tallQuick.quickMorph.y - referenceQuick.quickMorph.y, 164,
  'QuickMorph source y follows runtime bottom edge');
const legacyEnd = fixtureMasterProgress(fixtureTrack('quickMorph', 'height').activeReviewMs[1]);
close(READER_APPEARANCE_LEGACY_SHARED_GEOMETRY_END_PROGRESS, legacyEnd,
  'runtime legacy boundary comes from fixture evidence');
close(
  sampleReaderAppearanceMasterProgress(legacyEnd, 900).quickMorph.y,
  sampleReaderAppearanceMasterProgress(legacyEnd, 736).quickMorph.y,
  'QuickMorph evidenced target y is not runtime-offset',
);

// Each actor/property owns local timing. QuickMorph geometry ends at 10/23;
// brightness starts there. No global easing or invented .4348 -> 1 geometry.
const quickTracks = READER_APPEARANCE_LEGACY_ACTOR_TRACKS
  .find((actor) => actor.id === 'QuickMorph');
const brightnessTracks = READER_APPEARANCE_LEGACY_ACTOR_TRACKS
  .find((actor) => actor.id === 'BrightnessRail');
const rawQuickWidth = fixtureTrack('quickMorph', 'width');
const rawBrightnessOpacity = fixtureTrack('brightnessRail', 'opacity');
close(quickTracks.width.startMasterProgress,
  fixtureMasterProgress(rawQuickWidth.activeReviewMs[0]), 'QuickMorph fixture start');
close(quickTracks.width.endMasterProgress,
  fixtureMasterProgress(rawQuickWidth.activeReviewMs[1]), 'QuickMorph fixture end');
close(quickTracks.width.from, rawQuickWidth.from, 'QuickMorph fixture from');
close(quickTracks.width.to, rawQuickWidth.to, 'QuickMorph fixture to');
assert.equal(quickTracks.width.easing, rawQuickWidth.easing);
close(brightnessTracks.opacity.startMasterProgress,
  fixtureMasterProgress(rawBrightnessOpacity.activeReviewMs[0]),
  'brightness own boundary');
close(brightnessTracks.opacity.endMasterProgress,
  fixtureMasterProgress(rawBrightnessOpacity.activeReviewMs[1]),
  'brightness fixture end');
close(brightnessTracks.opacity.from, rawBrightnessOpacity.from, 'brightness fixture from');
close(brightnessTracks.opacity.to, rawBrightnessOpacity.to, 'brightness fixture to');
assert.equal(brightnessTracks.opacity.easing, rawBrightnessOpacity.easing);
assert.ok(readerAppearanceTrackProgress(0.25, quickTracks.width) > 0);
close(readerAppearanceTrackProgress(0.25, brightnessTracks.opacity), 0,
  'brightness must not consume QuickMorph local easing');

const atLegacyEnd = sampleReaderAppearanceMasterProgress(legacyEnd);
const afterLegacyEnd = sampleReaderAppearanceMasterProgress(0.75);
const full = sampleReaderAppearanceMasterProgress(1);
for (const field of ['x', 'y', 'width', 'height']) {
  close(afterLegacyEnd.quickMorph[field], atLegacyEnd.quickMorph[field],
    `QuickMorph ${field} held after legacy evidence`);
  close(full.quickMorph[field], atLegacyEnd.quickMorph[field],
    `QuickMorph ${field} not extrapolated to p=1`);
}
close(atLegacyEnd.quickMorph.trackProgress, 1, 'QuickMorph local track ends at 10/23');
close(afterLegacyEnd.quickMorph.trackProgress, 1, 'QuickMorph local track stays held');
close(full.quickMorph.opacity, 1, 'persistent surface cannot use legacy root fade');
close(full.quickMorph.blurVp, 0, 'persistent surface cannot root blur');
assert.equal(Object.hasOwn(full, 'contentSurface'), false,
  'unrendered ContentSurface leaked into the runtime frame');
assert.equal(Object.hasOwn(full, 'appearanceContent'), false,
  'unused AppearanceContent alias leaked into the runtime frame');
assert.equal(Object.hasOwn(full, 'themeLibrary'), false,
  'unused ThemeLibrary alias leaked into the runtime frame');
assert.equal(Object.hasOwn(full, 'fontLibrary'), false,
  'unused FontLibrary alias leaked into the runtime frame');
assert.ok(afterLegacyEnd.brightnessRail.opacity < 1,
  'brightness must independently fade after shared geometry finishes');

// Sampling history and direction cannot alter a frame at the same p.
for (const p of [0, 0.25, 0.5, 0.75, 1]) {
  const upward = sampleReaderAppearanceMasterProgress(p);
  const downward = sampleReaderAppearanceMasterProgress(p);
  assert.deepEqual(downward, upward, `direction changed frame at p=${p}`);
}

const geometrySource = readFileSync(new URL(
  '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts',
  import.meta.url,
), 'utf8');
assert.doesNotMatch(geometrySource, /collapseO|ReaderAppearanceMotionProfile|inverse trajectory/);
assert.doesNotMatch(geometrySource, /readerAppearanceExpansionFromTrajectory|readerAppearanceTrajectoryFromExpansion/);

console.log('reader appearance master-axis sampler: PASS');

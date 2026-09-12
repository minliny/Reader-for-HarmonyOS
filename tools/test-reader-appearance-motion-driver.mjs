import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  READER_APPEARANCE_ACTOR_TRACKS,
  READER_APPEARANCE_FIXED_SCREEN_ACTOR_IDS,
  READER_APPEARANCE_FULL_ONLY_ACTOR_IDS,
  READER_APPEARANCE_SHARED_ACTOR_IDS,
  readerAppearanceCubicBezierProgress,
  sampleReaderAppearanceMasterProgress,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/reader-appearance-motion-figma-n-o.json', import.meta.url),
  'utf8',
));
const figmaN = fixture.legacyEvidence.N;
const runtimeTracks = new Map(READER_APPEARANCE_ACTOR_TRACKS.map((actor) => [actor.id, actor]));
const runtimeId = new Map([
  ['brightnessRail', 'BrightnessRail'], ['moduleNav', 'ModuleNav'],
  ['morphStage', 'MorphStage'], ['contentSurface', 'ContentSurface'],
  ['appearanceContent', 'AppearanceContent'], ['themeLibrary', 'ThemeLibrary'],
  ['fontLibrary', 'FontLibrary'], ['typography', 'Typography'],
  ['fullHeader', 'Header'], ['quickMorph', 'QuickMorph'],
  ['themeHeader', 'ThemeHeader'], ['themeDay', 'ThemeDay'],
  ['themeWarm', 'ThemeWarm'], ['themeNight', 'ThemeNight'],
  ['themeWarmNight', 'ThemeWarmNight'], ['themePaperActive', 'ThemePaper'],
  ['themeGreen', 'ThemeGreen'], ['themePaperNight', 'ThemePaperNight'],
  ['themeGreenNight', 'ThemeGreenNight'], ['sectionDivider', 'QuickDivider'],
  ['fontHeader', 'FontHeader'], ['fontSystem', 'Font0'],
  ['fontSerifActive', 'Font1'], ['fontSans', 'Font2'], ['fontKai', 'Font3'],
  ['fontFangSong', 'Font4'], ['fontMono', 'Font5'],
  ['fontSourceHanSerif', 'Font6'], ['fontLXGWWenKai', 'Font7'],
]);

function close(actual, expected, message, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`);
}

function normalized(reviewMs) {
  const [start, end] = figmaN.activeReviewWindowMs;
  return (reviewMs - start) / (end - start);
}

function expectedLocal(rawTrack, p) {
  const start = normalized(rawTrack.activeReviewMs[0]);
  const end = normalized(rawTrack.activeReviewMs[1]);
  if (p <= start) return 0;
  if (p >= end) return 1;
  const local = (p - start) / (end - start);
  if (rawTrack.easing === 'ease-out') {
    return readerAppearanceCubicBezierProgress(local, 0, 0, 0.58, 1);
  }
  if (rawTrack.easing === 'ease-in-out') {
    return readerAppearanceCubicBezierProgress(local, 0.42, 0, 0.58, 1);
  }
  return local;
}

function expectedValue(rawTrack, p, component) {
  const from = component === undefined ? rawTrack.from : rawTrack.from[component];
  const to = component === undefined ? rawTrack.to : rawTrack.to[component];
  return from + (to - from) * expectedLocal(rawTrack, p);
}

function runtimeFrame(sample, id) {
  const match = sample.actorSamples.find((actor) => actor.id === id);
  assert.ok(match, `runtime sample missing: ${id}`);
  return match.frame;
}

const expectedGroups = fixture.runtimeContract.actorGroups;
assert.deepEqual(READER_APPEARANCE_FIXED_SCREEN_ACTOR_IDS, expectedGroups.fixedScreen);
assert.deepEqual(READER_APPEARANCE_SHARED_ACTOR_IDS,
  [...expectedGroups.stage, ...expectedGroups.quickTree]);
assert.deepEqual(READER_APPEARANCE_FULL_ONLY_ACTOR_IDS, expectedGroups.fullTree);
assert.equal(runtimeTracks.size, fixture.runtimeContract.actorCount);
assert.equal(runtimeId.size, figmaN.actorCount);
assert.equal(figmaN.actors.reduce((sum, actor) => sum + actor.tracks.length, 0),
  fixture.runtimeContract.rawTrackCount);
assert.deepEqual(new Set(runtimeTracks.keys()), new Set(runtimeId.values()));
for (const actor of READER_APPEARANCE_ACTOR_TRACKS) {
  assert.equal(actor.authority, 'figma-n', `${actor.id} authority`);
}

const samples = new Map([0, 0.25, 10 / 23, 0.5, 0.75, 1]
  .map((p) => [p, sampleReaderAppearanceMasterProgress(p)]));
let comparedRawTracks = 0;
for (const rawActor of figmaN.actors) {
  const targetId = runtimeId.get(rawActor.id);
  assert.ok(targetId, `no runtime mapping for Figma actor ${rawActor.id}`);
  const production = runtimeTracks.get(targetId);
  assert.ok(production, `runtime registry missing ${targetId}`);
  for (const rawTrack of rawActor.tracks) {
    comparedRawTracks += 1;
    const start = normalized(rawTrack.activeReviewMs[0]);
    const end = normalized(rawTrack.activeReviewMs[1]);
    const propertyMap = {
      opacity: 'opacity', blur: 'blurVp', translateY: 'translateY',
      width: 'width', height: 'height',
    };

    if (rawActor.id === 'morphStage') {
      const property = rawTrack.property === 'translateY' ? 'y' : rawTrack.property;
      for (const [p, sample] of samples) {
        close(runtimeFrame(sample, targetId)[property], expectedValue(rawTrack, p),
          `${rawActor.id}.${rawTrack.property}@${p}`);
      }
      continue;
    }

    if (rawTrack.property === 'translate') {
      for (const [runtimeProperty, component] of [['translateX', 0], ['translateY', 1]]) {
        const actualTrack = production[runtimeProperty];
        close(actualTrack.startMasterProgress, start,
          `${rawActor.id}.${runtimeProperty}.start`);
        close(actualTrack.endMasterProgress, end,
          `${rawActor.id}.${runtimeProperty}.end`);
        close(actualTrack.from, rawTrack.from[component], `${rawActor.id}.${runtimeProperty}.from`);
        close(actualTrack.to, rawTrack.to[component], `${rawActor.id}.${runtimeProperty}.to`);
        assert.equal(actualTrack.easing, rawTrack.easing, `${rawActor.id}.${runtimeProperty}.easing`);
        for (const [p, sample] of samples) {
          close(runtimeFrame(sample, targetId)[runtimeProperty], expectedValue(rawTrack, p, component),
            `${rawActor.id}.${runtimeProperty}@${p}`);
        }
      }
      continue;
    }

    const runtimeProperty = propertyMap[rawTrack.property];
    assert.ok(runtimeProperty, `unhandled raw property ${rawActor.id}.${rawTrack.property}`);
    const actualTrack = production[runtimeProperty];
    close(actualTrack.startMasterProgress, start, `${rawActor.id}.${runtimeProperty}.start`);
    close(actualTrack.endMasterProgress, end, `${rawActor.id}.${runtimeProperty}.end`);
    close(actualTrack.from, rawTrack.from, `${rawActor.id}.${runtimeProperty}.from`);
    close(actualTrack.to, rawTrack.to, `${rawActor.id}.${runtimeProperty}.to`);
    assert.equal(actualTrack.easing, rawTrack.easing, `${rawActor.id}.${runtimeProperty}.easing`);
    for (const [p, sample] of samples) {
      close(runtimeFrame(sample, targetId)[runtimeProperty], expectedValue(rawTrack, p),
        `${rawActor.id}.${runtimeProperty}@${p}`);
    }
  }
}
assert.equal(comparedRawTracks, 60, 'every current Figma N track must drive production');

// Static geometry in the Figma QuickMorph subtree remains local to that root.
// Production must not flatten the parent translates into rewritten child paths.
for (const rawActor of figmaN.actors.filter((actor) => actor.targetGeometryVp)) {
  const targetId = runtimeId.get(rawActor.id);
  const production = runtimeTracks.get(targetId);
  close(production.x.from, 13 + rawActor.targetGeometryVp.x, `${rawActor.id}.local x`);
  close(production.x.to, 13 + rawActor.targetGeometryVp.x, `${rawActor.id}.local x hold`);
  close(production.y.from, 57 + rawActor.targetGeometryVp.y, `${rawActor.id}.local y`);
  close(production.y.to, 57 + rawActor.targetGeometryVp.y, `${rawActor.id}.local y hold`);
}

console.log('reader appearance Figma N per-actor driver: PASS');

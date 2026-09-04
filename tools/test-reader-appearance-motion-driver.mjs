import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  READER_APPEARANCE_FIXED_SCREEN_ACTOR_IDS,
  READER_APPEARANCE_FULL_ONLY_ACTOR_IDS,
  READER_APPEARANCE_ACTOR_TRACKS,
  READER_APPEARANCE_SHARED_ACTOR_IDS,
  sampleReaderAppearanceMasterProgress,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/reader-appearance-motion-figma-n-o.json', import.meta.url),
  'utf8',
));
const legacyN = fixture.legacyEvidence.N;
const disposition = fixture.runtimeContract.legacyNTrackDisposition;
const rawActors = new Map(legacyN.actors.map((actor) => [actor.id, actor]));
const runtimeTracks = new Map(
  READER_APPEARANCE_ACTOR_TRACKS.map((actor) => [actor.id, actor]),
);

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function cubicCoordinate(parameter, first, second) {
  const inverse = 1 - parameter;
  return 3 * inverse * inverse * parameter * first +
    3 * inverse * parameter * parameter * second + parameter ** 3;
}

function bezier(progress, x1, y1, x2, y2) {
  const x = clamp01(progress);
  if (x === 0 || x === 1) return x;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 52; index += 1) {
    const parameter = (low + high) / 2;
    if (cubicCoordinate(parameter, x1, x2) < x) low = parameter;
    else high = parameter;
  }
  return cubicCoordinate((low + high) / 2, y1, y2);
}

function localProgress(track, master) {
  if (master <= track.startMasterProgress) return 0;
  if (master >= track.endMasterProgress ||
    track.endMasterProgress <= track.startMasterProgress) return 1;
  const local = (master - track.startMasterProgress) /
    (track.endMasterProgress - track.startMasterProgress);
  if (track.easing === 'ease-out') return bezier(local, 0, 0, 0.58, 1);
  if (track.easing === 'ease-in-out') return bezier(local, 0.42, 0, 0.58, 1);
  return local;
}

function expected(track, master) {
  return track.from + (track.to - track.from) * localProgress(track, master);
}

function close(actual, wanted, message, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - wanted) <= tolerance,
    `${message}: expected ${wanted}, got ${actual}`);
}

function frameFor(sample, id) {
  const matches = sample.actorSamples.filter((actor) => actor.id === id);
  assert.equal(matches.length, 1, `expected exactly one ${id}`);
  return matches[0].frame;
}

function rawTrack(actorId, property) {
  const actor = rawActors.get(actorId);
  assert.ok(actor, `raw Figma N actor missing: ${actorId}`);
  const matches = actor.tracks.filter((track) => track.property === property);
  assert.equal(matches.length, 1, `expected one raw Figma N track ${actorId}.${property}`);
  return matches[0];
}

function masterProgress(reviewMs) {
  const [start, end] = legacyN.activeReviewWindowMs;
  return (reviewMs - start) / (end - start);
}

function expectedNumberTrack(raw) {
  return {
    startMasterProgress: masterProgress(raw.activeReviewMs[0]),
    endMasterProgress: masterProgress(raw.activeReviewMs[1]),
    from: raw.from,
    to: raw.to,
    easing: raw.easing,
  };
}

function expectedMappedTrack(raw, mappingAuthority) {
  const mapped = expectedNumberTrack(raw);
  if (mappingAuthority !== 'product-direct-manipulation') {
    return mapped;
  }
  return {
    ...mapped,
    startMasterProgress: 0,
    endMasterProgress: 1,
  };
}

function compareNumberTrack(actual, expectedTrack, label) {
  close(actual.startMasterProgress, expectedTrack.startMasterProgress, `${label}.start`);
  close(actual.endMasterProgress, expectedTrack.endMasterProgress, `${label}.end`);
  close(actual.from, expectedTrack.from, `${label}.from`);
  close(actual.to, expectedTrack.to, `${label}.to`);
  assert.equal(actual.easing, expectedTrack.easing, `${label}.easing`);
}

function composedPositionEndpoints(actorId) {
  const [originX, originY] = fixture.geometry.quickMorph.fullOriginVp;
  const stageTranslate = rawTrack('morphStage', 'translateY');
  const quickTranslate = rawTrack('quickMorph', 'translate');
  if (actorId === 'quickMorph') {
    return {
      x: [originX + quickTranslate.from[0], originX + quickTranslate.to[0]],
      y: [
        originY + stageTranslate.from + quickTranslate.from[1],
        originY + stageTranslate.to + quickTranslate.to[1],
      ],
    };
  }
  const actor = rawActors.get(actorId);
  assert.ok(actor?.targetGeometryVp, `${actorId} lacks audited target geometry`);
  const ownTranslate = rawTrack(actorId, 'translate');
  return {
    x: [
      originX + quickTranslate.from[0] + actor.targetGeometryVp.x + ownTranslate.from[0],
      originX + quickTranslate.to[0] + actor.targetGeometryVp.x + ownTranslate.to[0],
    ],
    y: [
      originY + stageTranslate.from + quickTranslate.from[1] +
        actor.targetGeometryVp.y + ownTranslate.from[1],
      originY + stageTranslate.to + quickTranslate.to[1] +
        actor.targetGeometryVp.y + ownTranslate.to[1],
    ],
  };
}

const rawTrackKeys = legacyN.actors.flatMap((actor) =>
  actor.tracks.map((track) => `${actor.id}.${track.property}`));
const dispositionTrackKeys = [
  ...disposition.mapped.flatMap((mapping) => [
    ...Object.keys(mapping.direct ?? {}),
    ...Object.keys(mapping.composed ?? {}),
  ].map((property) => `${mapping.sourceActorId}.${property}`)),
  ...disposition.intentionallyIgnored.flatMap((entry) =>
    entry.properties.map((property) => `${entry.sourceActorId}.${property}`)),
];
assert.equal(new Set(dispositionTrackKeys).size, dispositionTrackKeys.length,
  'legacy N track disposition is not exactly-once');
assert.deepEqual(new Set(dispositionTrackKeys), new Set(rawTrackKeys),
  'driver evidence does not cover every raw legacy N track');

const expectedIds = [
  ...fixture.runtimeContract.actorGroups.fixedScreen,
  ...fixture.runtimeContract.actorGroups.shared,
  ...fixture.runtimeContract.actorGroups.fullOnly,
];
assert.equal(new Set(expectedIds).size, expectedIds.length, 'actor groups overlap');
assert.deepEqual(READER_APPEARANCE_FIXED_SCREEN_ACTOR_IDS,
  fixture.runtimeContract.actorGroups.fixedScreen);
assert.deepEqual(READER_APPEARANCE_SHARED_ACTOR_IDS,
  fixture.runtimeContract.actorGroups.shared);
assert.deepEqual(READER_APPEARANCE_FULL_ONLY_ACTOR_IDS,
  fixture.runtimeContract.actorGroups.fullOnly);
assert.deepEqual(
  new Set(READER_APPEARANCE_ACTOR_TRACKS.map((actor) => actor.id)),
  new Set(expectedIds),
  'every runtime actor must own one independent track set',
);

// Direct legacy mappings are checked against the fixture, never against values
// manufactured from the production registry under test.
const samples = new Map([0, 0.25, 10 / 23, 0.5, 0.75, 1]
  .map((p) => [p, sampleReaderAppearanceMasterProgress(p)]));
for (const mapping of disposition.mapped) {
  const productionActor = runtimeTracks.get(mapping.runtimeActorId);
  assert.ok(productionActor, `runtime actor missing: ${mapping.runtimeActorId}`);
  if (mapping.mappingAuthority === 'product-mapping-alias') {
    assert.equal(productionActor.authority, 'product-mapping-alias',
      `${mapping.runtimeActorId} must not claim direct Figma actor authority`);
  }
  if (mapping.mappingAuthority === 'product-direct-manipulation') {
    assert.equal(productionActor.authority, 'product-direct-manipulation',
      `${mapping.runtimeActorId} must declare the user-corrected spatial authority`);
  }
  for (const [sourceProperty, runtimeProperty] of Object.entries(mapping.direct ?? {})) {
    const expectedTrack = expectedMappedTrack(
      rawTrack(mapping.sourceActorId, sourceProperty),
      mapping.mappingAuthority,
    );
    compareNumberTrack(productionActor[runtimeProperty], expectedTrack,
      `${mapping.sourceActorId}.${sourceProperty}->${mapping.runtimeActorId}.${runtimeProperty}`);
    for (const [p, sample] of samples) {
      close(
        frameFor(sample, mapping.runtimeActorId)[runtimeProperty],
        expected(expectedTrack, p),
        `${mapping.runtimeActorId}.${runtimeProperty}@${p} from fixture`,
      );
    }
  }
  for (const [sourceProperty, runtimeProperties] of Object.entries(mapping.composed ?? {})) {
    assert.deepEqual(runtimeProperties, ['x', 'y']);
    const raw = rawTrack(mapping.sourceActorId, sourceProperty);
    const expectedWindow = expectedMappedTrack(
      { ...raw, from: 0, to: 1 },
      mapping.mappingAuthority,
    );
    const endpoints = composedPositionEndpoints(mapping.sourceActorId);
    for (const runtimeProperty of runtimeProperties) {
      const expectedTrack = {
        ...expectedWindow,
        from: endpoints[runtimeProperty][0],
        to: endpoints[runtimeProperty][1],
      };
      compareNumberTrack(productionActor[runtimeProperty], expectedTrack,
        `${mapping.sourceActorId}.${sourceProperty}->${mapping.runtimeActorId}.${runtimeProperty}`);
      for (const [p, sample] of samples) {
        close(
          frameFor(sample, mapping.runtimeActorId)[runtimeProperty],
          expected(expectedTrack, p),
          `${mapping.runtimeActorId}.${runtimeProperty}@${p} from composed fixture`,
        );
      }
    }
  }
}

// Actor-local windows must be observably different at one master p. This
// catches any future return of one global easing applied before sampling.
const quarter = sampleReaderAppearanceMasterProgress(0.25);
assert.ok(quarter.quickMorph.trackProgress > 0 && quarter.quickMorph.trackProgress < 1);
close(quarter.brightnessRail.trackProgress, 0, 'brightness starts on its own later track');
close(quarter.themeActions.trackProgress, 0, 'theme actions use their own later track');

const half = sampleReaderAppearanceMasterProgress(0.5);
assert.ok(half.quickMorph.trackProgress > 0 && half.quickMorph.trackProgress < 1,
  'QuickMorph geometry must remain in flight at half grabber travel');
assert.ok(half.brightnessRail.trackProgress > 0 && half.brightnessRail.trackProgress < 1);
assert.ok(half.themeActions.trackProgress > 0 && half.themeActions.trackProgress < 1);
assert.notEqual(half.brightnessRail.trackProgress, half.themeActions.trackProgress,
  'independent tracks collapsed into one global progress');

// The approved product contract covers every shared actor, including font
// cells whose Full endpoints come from the audited static design.
const productSharedActors = fixture.productDirectManipulationContract.sharedActors;
assert.deepEqual(
  new Set(productSharedActors.map((actor) => actor.id)),
  new Set(READER_APPEARANCE_SHARED_ACTOR_IDS),
  'approved product contract must cover every shared actor',
);
for (const actorContract of productSharedActors) {
  const runtimeActor = runtimeTracks.get(actorContract.id);
  assert.ok(runtimeActor, `approved runtime actor missing: ${actorContract.id}`);
  if (actorContract.id === 'MorphStage') {
    assert.equal(runtimeActor.authority, 'interaction-axis');
  } else {
    assert.equal(runtimeActor.authority, 'product-direct-manipulation');
  }
  for (const property of ['x', 'y', 'width', 'height']) {
    close(runtimeActor[property].startMasterProgress, 0,
      `${actorContract.id}.${property} full-axis start`);
    close(runtimeActor[property].endMasterProgress, 1,
      `${actorContract.id}.${property} full-axis end`);
    close(runtimeActor[property].from, actorContract.sourceRectVp[property],
      `${actorContract.id}.${property} source endpoint`);
    close(runtimeActor[property].to, actorContract.targetRectVp[property],
      `${actorContract.id}.${property} target endpoint`);
  }
}

// Runtime keeps one persistent surface even though the immutable legacy
// fixture contains a raw QuickMorph/root opacity track.
for (const p of [0, 0.25, 0.5, 0.75, 1]) {
  const sample = sampleReaderAppearanceMasterProgress(p);
  close(sample.quickMorph.opacity, 1, `persistent surface opacity at p=${p}`);
  close(sample.quickMorph.blurVp, 0, `persistent surface blur at p=${p}`);
  assert.equal(Object.hasOwn(sample, 'contentSurface'), false);
  assert.equal(Object.hasOwn(sample, 'appearanceContent'), false);
  assert.equal(Object.hasOwn(sample, 'themeLibrary'), false);
  assert.equal(Object.hasOwn(sample, 'fontLibrary'), false);
}

// Reversing traversal order cannot change any frame value.
const ascending = new Map();
for (const p of [0, 0.25, 0.5, 0.75, 1]) {
  ascending.set(p, sampleReaderAppearanceMasterProgress(p));
}
for (const p of [1, 0.75, 0.5, 0.25, 0]) {
  assert.deepEqual(sampleReaderAppearanceMasterProgress(p), ascending.get(p),
    `reverse sampling changed p=${p}`);
}

console.log('reader appearance per-actor master driver: PASS');

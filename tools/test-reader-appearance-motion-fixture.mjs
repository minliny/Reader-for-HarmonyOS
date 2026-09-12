import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/reader-appearance-motion-figma-n-o.json', import.meta.url),
  'utf8',
));

assert.equal(fixture.schemaVersion, 5);
assert.equal(fixture.contractId, 'reader.appearance.phone.figma-n-1505-18040');
assert.equal(fixture.source.authority, 'figma-get-motion-context');
assert.equal(fixture.source.fileKey, 'klhs2jMM4MncaJFqZMfqEK');
assert.equal(fixture.source.profiles.N.nodeId, '1505:18040');
assert.equal(fixture.source.profiles.O.nodeId, '1505:18349');
assert.equal(fixture.masterAxis.spatialDriver, 'measured-grabber-screen-y');
assert.equal(fixture.masterAxis.runtimeTravel, 'measured');
assert.deepEqual(fixture.masterAxis.figmaEffectiveReviewPercent, [1 / 9, 3 / 4]);
assert.equal(fixture.masterAxis.directionIndependentSampler, true);
assert.equal(fixture.masterAxis.globalEasing, false);
assert.equal(fixture.masterAxis.shellAndGrabberLinear, false);
assert.equal(fixture.masterAxis.visualStageEasing, 'ease-out');

const runtime = fixture.runtimeContract;
assert.equal(runtime.authority, 'figma-node-1505-18040');
assert.equal(runtime.exactFigmaParityTarget, true);
assert.equal(runtime.parityStatus, 'source-aligned-awaiting-runtime-frame-verification');
assert.equal(runtime.singleMasterProgress, true);
assert.equal(runtime.layeredComposition, true);
assert.equal(runtime.reverseUsesSameSampler, true);
assert.equal(runtime.rootCrossfadeRequired, true);
assert.equal(runtime.quickGeometryEndMasterProgress, 10 / 23);
assert.equal(runtime.actorCount, 29);
assert.equal(runtime.rawTrackCount, 60);
assert.deepEqual(runtime.actorGroups.fixedScreen, ['BrightnessRail', 'ModuleNav']);
assert.deepEqual(runtime.actorGroups.stage, ['MorphStage']);
assert.equal(runtime.actorGroups.quickTree.length, 20);
assert.deepEqual(runtime.actorGroups.fullTree,
  ['ContentSurface', 'AppearanceContent', 'ThemeLibrary', 'FontLibrary', 'Typography', 'Header']);

const figmaN = fixture.legacyEvidence.N;
assert.equal(figmaN.authority, 'figma-get-motion-context');
assert.deepEqual(figmaN.activeReviewWindowMs, [200, 1350]);
assert.equal(figmaN.reviewDurationMs, 1800);
assert.equal(figmaN.actorCount, figmaN.actors.length);
assert.equal(figmaN.actorCount, runtime.actorCount);
assert.equal(new Set(figmaN.actors.map((actor) => actor.id)).size, figmaN.actorCount);
assert.equal(new Set(figmaN.actors.map((actor) => actor.nodeId)).size, figmaN.actorCount);
const rawTracks = figmaN.actors.flatMap((actor) =>
  actor.tracks.map((track) => `${actor.id}.${track.property}`));
assert.equal(rawTracks.length, runtime.rawTrackCount);
assert.equal(new Set(rawTracks).size, rawTracks.length);

for (const actor of figmaN.actors) {
  assert.ok(actor.nodeId && actor.figmaName, `${actor.id} lacks Figma provenance`);
  assert.ok(actor.tracks.length > 0, `${actor.id} lacks tracks`);
  for (const track of actor.tracks) {
    assert.equal(track.easing, 'ease-out', `${actor.id}.${track.property} easing`);
    assert.ok(track.activeReviewMs[0] >= figmaN.activeReviewWindowMs[0]);
    assert.ok(track.activeReviewMs[1] <= figmaN.activeReviewWindowMs[1]);
    assert.ok(track.activeReviewMs[0] < track.activeReviewMs[1]);
    assert.notDeepEqual(track.from, track.to);
  }
}

const raw = (actorId, property) => figmaN.actors
  .find((actor) => actor.id === actorId).tracks
  .find((track) => track.property === property);
assert.deepEqual(raw('morphStage', 'height').activeReviewMs, [200, 1350]);
assert.deepEqual(raw('quickMorph', 'height').activeReviewMs, [200, 700]);
assert.deepEqual(raw('quickMorph', 'opacity').activeReviewMs, [600, 1100]);
assert.deepEqual(raw('contentSurface', 'opacity').activeReviewMs, [550, 900]);
assert.deepEqual(raw('appearanceContent', 'opacity').activeReviewMs, [600, 900]);
assert.deepEqual(raw('typography', 'opacity').activeReviewMs, [900, 1350]);

// The previous full-axis product interpolation is retained only as rejected
// provenance. No active runtime field may point at or approve it.
assert.equal(fixture.supersededProductDirectManipulationContract.status, 'rejected');
assert.equal(fixture.supersededProductDirectManipulationContract.historicalOnly, true);
assert.equal(fixture.supersededProductDirectManipulationContract.mustNotDriveRuntimeOrTests, true);
assert.equal(fixture.supersededProductDirectManipulationContract.notAuthoredByFigma, true);
assert.match(fixture.supersededProductDirectManipulationContract.reason,
  /Figma 1505:18040 as the sole motion authority/);
assert.equal(fixture.supersededProductRuntimeContract.status, 'rejected');
assert.equal(fixture.supersededProductRuntimeContract.historicalOnly, true);
assert.equal(fixture.supersededProductRuntimeContract.mustNotDriveRuntimeOrTests, true);
assert.match(fixture.supersededProductRuntimeContract.reason, /Replaced by the active Figma/);
assert.equal(fixture.supersededFinalN2ProductProposal.status, 'superseded');
assert.equal(fixture.supersededFinalN2ProductProposal.historicalOnly, true);
assert.equal(fixture.supersededFinalN2ProductProposal.mustNotDriveRuntimeOrTests, true);
assert.equal(fixture.legacyRejectedProductSupplement.status, 'rejected');
assert.equal(fixture.legacyRejectedProductSupplement.historicalOnly, true);
assert.equal(fixture.legacyRejectedProductSupplement.mustNotDriveRuntimeOrTests, true);
assert.equal(Object.hasOwn(fixture, 'productDirectManipulationContract'), false);
assert.equal(Object.hasOwn(fixture, 'finalN2'), false);

const figmaO = fixture.legacyEvidence.O;
assert.equal(figmaO.authority, 'legacy-figma-evidence-only-not-runtime');
assert.deepEqual(figmaO.activeReviewWindowMs, [600, 2400]);
assert.ok(figmaO.actors.some((actor) => actor.id === 'quickDock'));

console.log('reader appearance Figma N fixture: PASS');

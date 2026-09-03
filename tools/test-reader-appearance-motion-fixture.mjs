import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fixtureUrl = new URL('./fixtures/reader-appearance-motion-figma-n-o.json', import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, 'utf8'));

const EXPECTED_N_NODE_IDS = [
  '1532:1312',
  '1532:1313',
  '1532:1049',
  '1532:1051',
  '1561:9622',
  'I1561:9622;1082:236',
  'I1561:9622;1082:238',
  'I1561:9622;1082:237',
  '1532:1053',
  '1539:702',
  '1539:754',
  '1539:775',
  '1539:776',
  '1539:777',
  '1539:778',
  '1539:779',
  '1539:780',
  '1539:781',
  '1539:782',
  '1539:792',
  '1539:793',
  '1539:821',
  '1539:822',
  '1539:823',
  '1539:824',
  '1539:825',
  '1539:826',
  '1539:827',
  '1539:828',
];

const EXPECTED_O_NODE_IDS = [
  '1505:18390',
  '1505:18392',
  '1505:18497',
];

function normalizeReviewTime(profile, reviewMs) {
  const [reviewStart, reviewEnd] = profile.activeReviewWindowMs;
  return Math.round(
    ((reviewMs - reviewStart) / (reviewEnd - reviewStart)) * profile.productDurationMs,
  );
}

function assertProfile(profileName, expectedNodeIds) {
  const profile = fixture.profiles[profileName];
  assert.ok(profile, `missing ${profileName} profile`);
  assert.equal(profile.actors.length, profile.actorCount, `${profileName} actorCount drift`);
  assert.equal(profile.actorCount, expectedNodeIds.length, `${profileName} inventory size drift`);
  assert.deepEqual(
    profile.actors.map((actor) => actor.nodeId),
    expectedNodeIds,
    `${profileName} Figma node inventory or order drift`,
  );
  assert.equal(new Set(profile.actors.map((actor) => actor.nodeId)).size, profile.actorCount,
    `${profileName} has duplicate Figma node ids`);
  assert.equal(new Set(profile.actors.map((actor) => actor.id)).size, profile.actorCount,
    `${profileName} has duplicate semantic actor ids`);

  const [reviewStart, reviewEnd] = profile.activeReviewWindowMs;
  assert.ok(reviewStart >= 0 && reviewEnd <= profile.reviewDurationMs && reviewStart < reviewEnd,
    `${profileName} active review window is invalid`);

  const productBoundaries = new Set([0, profile.productDurationMs]);
  for (const actor of profile.actors) {
    assert.ok(actor.id.length > 0 && actor.figmaName.length > 0,
      `${profileName}/${actor.nodeId} lacks its semantic mapping`);
    assert.ok(Array.isArray(actor.tracks) && actor.tracks.length > 0,
      `${profileName}/${actor.id} has no changing tracks`);
    assert.equal(new Set(actor.tracks.map((track) => track.property)).size, actor.tracks.length,
      `${profileName}/${actor.id} duplicates a property track`);

    for (const track of actor.tracks) {
      assert.deepEqual(track.activeReviewMs.length, 2,
        `${profileName}/${actor.id}/${track.property} review interval malformed`);
      assert.deepEqual(track.productMs.length, 2,
        `${profileName}/${actor.id}/${track.property} product interval malformed`);
      const [trackReviewStart, trackReviewEnd] = track.activeReviewMs;
      const [trackProductStart, trackProductEnd] = track.productMs;
      assert.ok(trackReviewStart >= reviewStart && trackReviewEnd <= reviewEnd &&
        trackReviewStart < trackReviewEnd,
      `${profileName}/${actor.id}/${track.property} escapes the authored active window`);
      assert.ok(trackProductStart >= 0 && trackProductEnd <= profile.productDurationMs &&
        trackProductStart < trackProductEnd,
      `${profileName}/${actor.id}/${track.property} escapes the product timeline`);
      assert.equal(trackProductStart, normalizeReviewTime(profile, trackReviewStart),
        `${profileName}/${actor.id}/${track.property} start normalization drift`);
      assert.equal(trackProductEnd, normalizeReviewTime(profile, trackReviewEnd),
        `${profileName}/${actor.id}/${track.property} end normalization drift`);
      assert.notDeepEqual(track.from, track.to,
        `${profileName}/${actor.id}/${track.property} must be a changing track`);
      assert.ok(track.easing === 'ease-out' || track.easing === 'ease-in-out',
        `${profileName}/${actor.id}/${track.property} has an unreviewed easing`);
      productBoundaries.add(trackProductStart);
      productBoundaries.add(trackProductEnd);
    }
  }

  assert.deepEqual(
    profile.mandatoryProductSamplesMs,
    [...productBoundaries].sort((left, right) => left - right),
    `${profileName} mandatory samples must cover every actor boundary exactly once`,
  );
}

assert.equal(fixture.schemaVersion, 2);
assert.equal(fixture.source.fileKey, 'klhs2jMM4MncaJFqZMfqEK');
assert.equal(fixture.source.pageNodeId, '1246:26829');
assert.equal(fixture.source.profiles.N.nodeId, '1505:18040');
assert.equal(fixture.source.profiles.O.nodeId, '1505:18349');
assert.equal(fixture.scope.viewport, 'Phone');
assert.equal(fixture.scope.tabletParity, 'open');

assert.equal(fixture.profiles.N.reviewDurationMs, 1800);
assert.deepEqual(fixture.profiles.N.activeReviewWindowMs, [200, 1350]);
assert.equal(fixture.profiles.N.productDurationMs, 420);
assert.equal(fixture.profiles.O.reviewDurationMs, 4000);
assert.deepEqual(fixture.profiles.O.activeReviewWindowMs, [600, 2400]);
assert.equal(fixture.profiles.O.productDurationMs, 360);

assertProfile('N', EXPECTED_N_NODE_IDS);
assertProfile('O', EXPECTED_O_NODE_IDS);

const fixedScreenNActors = fixture.profiles.N.actors
  .filter((actor) => actor.figmaName.includes('fixed screen position'));
assert.deepEqual(
  fixedScreenNActors.map((actor) => actor.id),
  ['brightnessRail', 'moduleNav'],
  'Figma N has exactly two fixed-screen siblings outside MorphStage',
);
assert.ok(!fixture.profiles.N.actors
  .find((actor) => actor.id === 'morphStage')
  .figmaName.includes('fixed screen position'),
'MorphStage is the moving/clipped parent only for the morphing content tree');
assert.equal(fixture.profiles.O.actors.filter((actor) => actor.id === 'quickDock').length, 1,
  'O has one QuickDock incoming actor for the fixed wrapper');

assert.deepEqual(fixture.geometry.shell, {
  quickHeightVp: 330,
  fullHeightVp: 736,
  travelVp: 406,
  bottomAnchored: true,
});
assert.deepEqual(fixture.geometry.quickMorph, {
  quickSizeVp: [286, 190],
  fullSizeVp: [338, 666],
});
assert.deepEqual(fixture.geometry.themeCell, {
  quickSizeVp: [62.5, 24],
  fullSizeVp: [73.5, 58.8],
});

const themeActors = fixture.profiles.N.actors.filter((actor) => actor.id.startsWith('theme') &&
  actor.id !== 'themeLibrary' && actor.id !== 'themeHeader');
assert.equal(themeActors.length, 8, 'N must preserve all eight theme actors');
for (const actor of themeActors) {
  assert.equal(actor.targetGeometryVp.width, 73.5);
  assert.equal(actor.targetGeometryVp.height, 58.8);
}

const fontActors = fixture.profiles.N.actors.filter((actor) => actor.id.startsWith('font') &&
  actor.id !== 'fontLibrary' && actor.id !== 'fontHeader');
assert.equal(fontActors.length, 8, 'N must preserve all eight quick font actors');
for (const actor of fontActors) {
  assert.deepEqual(actor.staticSizeVp, [62.5, 27]);
  assert.equal(actor.targetGeometryVp.width, 62.5);
  assert.equal(actor.targetGeometryVp.height, 27);
}

// Motion V2 is an explicit product correction layered over the immutable
// Figma export above.  Keeping the two authorities separate prevents the
// corrected full Font grid and reversible gesture path from being reported as
// values authored by N/O.
const v2 = fixture.implementationContract;
assert.equal(v2.authority, 'reader-motion-v2-correction');
assert.equal(v2.notAuthoredByFigma, true);
assert.equal(v2.spatialDriver, 'physicalExpansionProgress');
assert.equal(v2.singlePersistentTree, true);
assert.equal(v2.reverseUsesSameSpatialFunction, true);
assert.deepEqual(v2.sampleExpansionProgress, [0.25, 0.5, 0.75]);
assert.deepEqual(v2.timing, {
  expandFullDistanceMs: 420,
  collapseFullDistanceMs: 360,
  settlementScalesByRemainingDistance: true,
  timeScaleAppliesAfterRemainingDistance: true,
});
assert.deepEqual(v2.actorGroups.fixedScreen, ['BrightnessRail', 'ModuleNav']);
assert.deepEqual(v2.actorGroups.forbiddenRootCrossfade, ['FullOutgoing', 'QuickIncoming']);
assert.deepEqual(v2.actorGroups.fullOnly,
  ['ContentSurface', 'Header', 'ThemeActions', 'FontImport', 'Typography']);
assert.equal(v2.sharedActors.length, v2.actorGroups.shared.length,
  'every persistent shared actor must own one audited source/target rect');
assert.deepEqual(v2.sharedActors.map((actor) => actor.id), v2.actorGroups.shared,
  'shared actor geometry order must stay stable');
assert.equal(new Set(v2.actorGroups.shared).size, v2.actorGroups.shared.length,
  'the persistent tree cannot mount one shared actor twice');
assert.equal(v2.actorGroups.shared.some((id) => v2.actorGroups.fullOnly.includes(id)), false,
  'a Full-only reveal cannot duplicate a persistent shared actor');
assert.equal(v2.actorGroups.shared.some((id) => v2.actorGroups.forbiddenRootCrossfade.includes(id)), false,
  'legacy Quick/Full root crossfade actors cannot re-enter the shared inventory');

function assertRect(rect, label) {
  assert.deepEqual(Object.keys(rect), ['x', 'y', 'width', 'height'], `${label} rect shape drift`);
  for (const [field, value] of Object.entries(rect)) {
    assert.ok(Number.isFinite(value), `${label}.${field} must be finite`);
  }
  assert.ok(rect.width > 0 && rect.height > 0, `${label} must have positive size`);
}

for (const actor of v2.sharedActors) {
  assertRect(actor.sourceRectVp, `${actor.id}.source`);
  assertRect(actor.targetRectVp, `${actor.id}.target`);
  assert.notDeepEqual(actor.sourceRectVp, actor.targetRectVp,
    `${actor.id} must own an actual split/reflow trajectory`);
  assert.ok(actor.curve === 'linear-in-physical-expansion' ||
    actor.curve === 'shared-actor-ease-out', `${actor.id} has an unaudited V2 actor curve`);
}

const v2ById = new Map(v2.sharedActors.map((actor) => [actor.id, actor]));
assert.deepEqual(v2ById.get('MorphStage').sourceRectVp,
  { x: 0, y: 406, width: 364, height: 330 });
assert.deepEqual(v2ById.get('MorphStage').targetRectVp,
  { x: 0, y: 0, width: 364, height: 736 });
assert.deepEqual(v2ById.get('QuickMorph').sourceRectVp,
  { x: 12.104, y: 434.993, width: 286, height: 190 });
assert.deepEqual(v2ById.get('QuickMorph').targetRectVp,
  { x: 13, y: 57, width: 338, height: 666 });

const rawToRuntimeId = new Map([
  ['themeHeader', 'ThemeHeader'],
  ['themeDay', 'ThemeDay'],
  ['themeWarm', 'ThemeWarm'],
  ['themeNight', 'ThemeNight'],
  ['themeWarmNight', 'ThemeWarmNight'],
  ['themePaperActive', 'ThemePaper'],
  ['themeGreen', 'ThemeGreen'],
  ['themePaperNight', 'ThemePaperNight'],
  ['themeGreenNight', 'ThemeGreenNight'],
  ['sectionDivider', 'QuickDivider'],
  ['fontHeader', 'FontHeader'],
]);
for (const [rawId, runtimeId] of rawToRuntimeId) {
  const raw = fixture.profiles.N.actors.find((actor) => actor.id === rawId).targetGeometryVp;
  const corrected = v2ById.get(runtimeId).targetRectVp;
  assert.deepEqual(corrected, {
    x: raw.x + 13,
    y: raw.y + 57,
    width: raw.width,
    height: raw.height,
  }, `${runtimeId} must preserve the Figma N endpoint in Stage coordinates`);
  assert.equal(v2ById.get(runtimeId).endpointAuthority, 'figma-n');
}

const expectedFontTargets = [
  [24, 307.98], [105, 307.98], [186, 307.98], [267, 307.98],
  [24, 345.98], [105, 345.98], [186, 345.98], [267, 345.98],
];
for (let index = 0; index < expectedFontTargets.length; index += 1) {
  const actor = v2ById.get(`Font${index}`);
  assert.equal(actor.endpointAuthority, 'full-static-design-correction',
    `Font${index} must not claim its corrected endpoint came from N`);
  assert.deepEqual(actor.targetRectVp, {
    x: expectedFontTargets[index][0],
    y: expectedFontTargets[index][1],
    width: 73,
    height: 30,
  }, `Font${index} must terminate on live Full static node 1082:235`);
}

assert.deepEqual(v2.fullOnlyReveal.map((actor) => actor.id), v2.actorGroups.fullOnly,
  'every Full-only actor needs one independent reveal phase');
for (const actor of v2.fullOnlyReveal) {
  assert.ok(actor.startExpansion >= 0 && actor.endExpansion <= 1 &&
    actor.startExpansion < actor.endExpansion,
  `${actor.id} reveal phase must live inside physical expansion 0..1`);
}
assert.equal(v2.fullOnlyReveal.find((actor) => actor.id === 'Typography').endExpansion, 1,
  'the last Full-only module must keep revealing through the physical endpoint');

assert.equal(fixture.productSupplement.authority, 'reader-product-contract');
assert.equal(fixture.productSupplement.notAuthoredByFigma, true,
  'drag, interrupt and elastic rules must never be labelled as Figma-authored');
assert.equal(fixture.productSupplement.elastic.neverAppliesToFigmaActors, true);
assert.deepEqual(fixture.productSupplement.elastic.appliesTo, ['shell', 'grabber']);
assert.equal(fixture.productSupplement.directManipulation.physicalTravelVp,
  fixture.geometry.shell.travelVp);
assert.equal(fixture.productSupplement.directManipulation.trajectoryRecoveredByInverseShellCurve, false);
assert.equal(fixture.productSupplement.directManipulation.actorSamplingUsesPhysicalExpansion, true);
assert.equal(fixture.productSupplement.interrupt.staleFrameInvalidation, 'epoch');
assert.equal(fixture.productSupplement.interrupt.targetDirectionSelectsClock, true);
assert.equal(fixture.productSupplement.reducedMotion.releaseSnapsToEndpoint, true);

console.log('reader appearance Figma N/O fixture: PASS');

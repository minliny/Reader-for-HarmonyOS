import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/reader-appearance-motion-figma-n-o.json', import.meta.url),
  'utf8',
));

assert.equal(fixture.schemaVersion, 4);
assert.equal(fixture.contractId, 'reader.appearance.phone.master-axis.direct-manipulation');
assert.equal(fixture.source.fileKey, 'klhs2jMM4MncaJFqZMfqEK');
assert.equal(fixture.source.profiles.N.nodeId, '1505:18040');
assert.equal(fixture.source.profiles.O.nodeId, '1505:18349');
assert.deepEqual(fixture.source.auditedStaticEndpoint, {
  nodeId: '1082:235',
  name: 'Reader 2/Full/AppearanceContent',
  authority: 'figma-get-design-context',
  usage: 'full-endpoint-metadata-only',
  trajectoryAuthority: false,
});

assert.deepEqual(fixture.finalN2, {
  status: 'unpublished',
  nodeId: null,
  authorityAvailable: false,
  visualParityBlocked: true,
  requiredEvidence: [
    'one persistent component tree',
    'every actor/property keyframe over the full effective axis',
    'per-track easing and start/end percentages',
    'scroll-offset behavior during collapse and re-expand',
    'responsive width/height support or an explicit static fallback boundary',
    'runtime frame captures at p=0,.25,.5,.75,1',
  ],
  prohibition: 'Legacy N/O values must not be represented as final N2-authored motion.',
});

assert.equal(fixture.masterAxis.spatialDriver, 'measured-grabber-screen-y');
assert.equal(fixture.masterAxis.runtimeTravel, 'measured');
assert.deepEqual(fixture.masterAxis.figmaEffectiveReviewPercent, [1 / 9, 3 / 4]);
assert.equal(fixture.masterAxis.directionIndependentSampler, true);
assert.equal(fixture.masterAxis.globalEasing, false);
assert.equal(fixture.masterAxis.shellAndGrabberLinear, true);

const runtime = fixture.runtimeContract;
assert.equal(runtime.authority, 'user-approved-product-direct-manipulation');
assert.equal(runtime.notFinalFigmaParity, true);
assert.equal(runtime.singleMasterProgress, true);
assert.equal(runtime.singlePersistentTree, true);
assert.equal(runtime.reverseUsesSameSampler, true);
assert.equal(runtime.rootCrossfadeForbidden, true);
assert.equal(runtime.quickMorphRuntimeOpacity, 1);
assert.equal(runtime.quickMorphRuntimeBlurVp, 0);
assert.deepEqual(runtime.unrenderedLegacyActorsExcluded,
  ['contentSurface', 'appearanceContent']);
assert.deepEqual(runtime.runtimeFrameAliases, [
  {
    runtimeActorId: 'ThemeActions',
    sourceActorId: 'themeLibrary',
    sourceProperty: 'opacity',
    authority: 'product-mapping-alias',
    notDirectFigmaActor: true,
  },
  {
    runtimeActorId: 'FontImport',
    sourceActorId: 'fontLibrary',
    sourceProperty: 'opacity',
    authority: 'product-mapping-alias',
    notDirectFigmaActor: true,
  },
]);
assert.deepEqual(runtime.actorGroups.fullOnly,
  ['Header', 'ThemeActions', 'FontImport', 'Typography']);
assert.deepEqual(runtime.directManipulation, {
  authority: 'user-approved-product-correction',
  sharedGeometryMasterProgress: [0, 1],
  behavior: 'move-and-deform-until-fully-expanded',
  samplesEachActorFromSameMasterProgress: true,
  notAuthoredByFinalFigmaN2: true,
});

assert.equal(fixture.geometry.authority, 'legacy-evidence-only');
assert.deepEqual(fixture.geometry.shell, {
  quickHeightVp: 330,
  fullHeightVp: 736,
  referenceTravelVp: 406,
  runtimeTravel: 'measured',
  bottomAnchored: true,
});

assert.equal(fixture.productDirectManipulationContract.status, 'approved');
assert.equal(fixture.productDirectManipulationContract.authority,
  'user-corrected-motion-model');
assert.equal(fixture.productDirectManipulationContract.notAuthoredByFigma, true);
assert.equal(fixture.legacyRejectedProductSupplement.notAuthoredByFigma, true);
assert.equal(Object.hasOwn(fixture, 'implementationContract'), false);
assert.equal(Object.hasOwn(fixture, 'productSupplement'), false);
assert.equal(Object.hasOwn(fixture, 'profiles'), false);

const legacyN = fixture.legacyEvidence.N;
const legacyO = fixture.legacyEvidence.O;
assert.equal(legacyN.authority, 'legacy-figma-evidence-only');
assert.equal(legacyO.authority, 'legacy-figma-evidence-only-not-runtime');
assert.deepEqual(legacyN.activeReviewWindowMs, [200, 1350]);
assert.equal(legacyN.reviewDurationMs, 1800);
assert.deepEqual(legacyO.activeReviewWindowMs, [600, 2400]);
assert.equal(legacyN.actorCount, legacyN.actors.length);
assert.equal(new Set(legacyN.actors.map((actor) => actor.id)).size, legacyN.actors.length,
  'legacy N actor ids must be unique');
assert.equal(new Set(legacyN.actors.map((actor) => actor.nodeId)).size, legacyN.actors.length,
  'legacy N node ids must be unique');

function normalizedNProgress(reviewMs) {
  return (reviewMs - legacyN.activeReviewWindowMs[0]) /
    (legacyN.activeReviewWindowMs[1] - legacyN.activeReviewWindowMs[0]);
}

const quickMorph = legacyN.actors.find((actor) => actor.id === 'quickMorph');
assert.ok(quickMorph, 'legacy QuickMorph evidence missing');
const legacyGeometry = quickMorph.tracks.find((track) => track.property === 'height');
assert.equal(normalizedNProgress(legacyGeometry.activeReviewMs[0]), 0);
assert.equal(normalizedNProgress(legacyGeometry.activeReviewMs[1]), 10 / 23);
const rawRootFade = quickMorph.tracks.find((track) => track.property === 'opacity');
assert.deepEqual(rawRootFade.activeReviewMs, [600, 1100]);
assert.deepEqual([rawRootFade.from, rawRootFade.to], [1, 0]);
assert.equal(runtime.quickMorphRuntimeOpacity, 1,
  'legacy root fade must remain evidence and never become runtime opacity');
assert.ok(legacyN.actors.some((actor) => actor.id === 'contentSurface'),
  'unrendered ContentSurface must remain only as immutable legacy evidence');
assert.ok(legacyN.actors.some((actor) => actor.id === 'appearanceContent'),
  'unrendered AppearanceContent must remain only as immutable legacy evidence');

for (const actor of legacyN.actors) {
  assert.ok(actor.nodeId && actor.figmaName, `${actor.id} lacks legacy provenance`);
  assert.ok(actor.tracks.length > 0, `${actor.id} lacks property tracks`);
  for (const track of actor.tracks) {
    assert.ok(track.activeReviewMs[0] >= legacyN.activeReviewWindowMs[0]);
    assert.ok(track.activeReviewMs[1] <= legacyN.activeReviewWindowMs[1]);
    assert.ok(track.activeReviewMs[0] < track.activeReviewMs[1]);
    assert.notDeepEqual(track.from, track.to);
  }
}

// Every raw N track must be accounted for exactly once. This inventory is
// fixture-owned evidence: production registries are deliberately not imported.
function rawTrackKey(actorId, property) {
  return `${actorId}.${property}`;
}

const rawTrackKeys = legacyN.actors.flatMap((actor) =>
  actor.tracks.map((track) => rawTrackKey(actor.id, track.property)));
assert.equal(new Set(rawTrackKeys).size, rawTrackKeys.length,
  'legacy N actor/property tracks must be unique');

const disposition = runtime.legacyNTrackDisposition;
assert.equal(disposition.coverage, 'every-raw-track-exactly-once');
const mappedTrackKeys = disposition.mapped.flatMap((mapping) => [
  ...Object.keys(mapping.direct ?? {}),
  ...Object.keys(mapping.composed ?? {}),
].map((property) => rawTrackKey(mapping.sourceActorId, property)));
const ignoredTrackKeys = disposition.intentionallyIgnored.flatMap((entry) =>
  entry.properties.map((property) => rawTrackKey(entry.sourceActorId, property)));
const dispositionKeys = [...mappedTrackKeys, ...ignoredTrackKeys];
assert.equal(new Set(dispositionKeys).size, dispositionKeys.length,
  'a raw N track cannot be both mapped and intentionally ignored');
assert.deepEqual(new Set(dispositionKeys), new Set(rawTrackKeys),
  'mapped plus intentionallyIgnored must exactly cover raw legacy N tracks');

for (const mapping of disposition.mapped) {
  assert.ok(mapping.runtimeActorId && mapping.mappingAuthority);
  const sourceActor = legacyN.actors.find((actor) => actor.id === mapping.sourceActorId);
  assert.ok(sourceActor, `mapped actor ${mapping.sourceActorId} is absent from raw N evidence`);
  for (const sourceProperty of [
    ...Object.keys(mapping.direct ?? {}),
    ...Object.keys(mapping.composed ?? {}),
  ]) {
    assert.ok(sourceActor.tracks.some((track) => track.property === sourceProperty),
      `${mapping.sourceActorId}.${sourceProperty} is not a raw N track`);
  }
}
for (const ignored of disposition.intentionallyIgnored) {
  assert.ok(ignored.reason, `${ignored.sourceActorId} ignored without a product reason`);
}
for (const rootId of ['contentSurface', 'appearanceContent']) {
  const rootIgnore = disposition.intentionallyIgnored.find((entry) =>
    entry.sourceActorId === rootId && entry.properties.includes('opacity'));
  assert.equal(rootIgnore?.reason, 'persistent-root-product-contract',
    `${rootId}.opacity must be explicitly ignored by the persistent-root contract`);
}

for (const [runtimeActorId, sourceActorId] of [
  ['ThemeActions', 'themeLibrary'],
  ['FontImport', 'fontLibrary'],
]) {
  const alias = disposition.mapped.find((entry) =>
    entry.runtimeActorId === runtimeActorId && entry.sourceActorId === sourceActorId);
  assert.equal(alias?.mappingAuthority, 'product-mapping-alias');
  assert.deepEqual(alias?.direct, { opacity: 'opacity' });
}

const rawOTrackKeys = legacyO.actors.flatMap((actor) =>
  actor.tracks.map((track) => rawTrackKey(actor.id, track.property)));
const ignoredOTrackKeys = runtime.legacyOTrackDisposition.intentionallyIgnored.flatMap((entry) =>
  entry.properties.map((property) => rawTrackKey(entry.sourceActorId, property)));
assert.equal(runtime.legacyOTrackDisposition.coverage,
  'every-raw-track-intentionally-ignored');
assert.equal(new Set(ignoredOTrackKeys).size, ignoredOTrackKeys.length,
  'a raw O track cannot be intentionally ignored twice');
assert.deepEqual(new Set(ignoredOTrackKeys), new Set(rawOTrackKeys),
  'the rejected O profile must explicitly account for every raw track');
for (const ignored of runtime.legacyOTrackDisposition.intentionallyIgnored) {
  assert.equal(ignored.reason,
    'directional-profile-rejected-same-sampler-product-contract');
}

assert.equal(legacyO.actors.some((actor) => actor.id === 'quickDock'), true);
assert.equal(runtime.actorGroups.shared.includes('QuickIncoming'), false);
assert.equal(runtime.actorGroups.shared.includes('FullOutgoing'), false);

console.log('reader appearance direct-manipulation fixture: PASS');

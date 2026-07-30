// enforce-implementation-ready-gate.mjs — meta-gate that enforces the
// execution gate semantics BEFORE any test or build runs.
//
// On 2026-07-27 an agent advanced a virtual-machine cycle on a page family
// whose Figma → Reader-UI → HarmonyOS chain was not actually complete. The
// root cause was that the generated visual-admission artifact collapsed
// `sourceBound` (Figma identity registered) and `implementationReady` (page
// family delivered) into a single `admitted` flag. A `candidate-backport`
// route was therefore treated the same as a deliverable surface at the
// renderer gate.
//
// A second 2026-07-27 audit found a deeper bypass: an agent had hand-edited
// `harmony.status` to `implementation-ready` in the registry without completing
// source-side conversion (local.status was still `candidate-backport`) and
// without regenerating the artifact. The generator only checked
// `harmony.status`, so this bypass was invisible at the renderer gate.
//
// This script is now the meta-gate across THREE dimensions:
//   A-F. The generated artifact and renderers encode the two-dimensional gate.
//   G.   The generated artifact is synchronized to the current registry
//        (generator --check passes — no stale artifact).
//   H.   Every implementation-ready registry record has local.status ===
//        implementation-ready (source-side self-promotion happened first).
//   I.   Every implementation-ready registry record has a tamper-evident
//        promotion ledger entry from promote-family.mjs (no hand-edited bypass).
//   J.   Every implementation-ready B3 record set has an immutable native A2
//        pre-promotion receipt and a B4/B5 consumption receipt.
//
// Run this BEFORE `test:static`, `test:arkts-emulator`, `test:device`,
// `test:raw`, `build`, or any VM/device cycle. It is wired as `pretest`,
// `prebuild`, and `pretest:*` hooks in package.json, AND re-run inside each
// runner — npm lifecycle hooks alone are not sufficient because an agent can
// invoke node/hdc directly.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const ETS = path.join(REPO, 'entry/src/main/ets');
const READER_UI = process.env.READER_UI_ROOT || path.resolve(REPO, '../Reader-UI');

function read(relativePath) {
  return fs.readFileSync(path.join(REPO, relativePath), 'utf8');
}

function fail(message) {
  console.error(`✗ implementation-ready gate: ${message}`);
  process.exit(1);
}

let pass = 0;
function ok(message) {
  pass += 1;
  console.log(`  ✓ ${message}`);
}

const visualAdmission = read('entry/src/main/ets/contract/reader_ui/VisualAdmission.ets');
const routeTable = read('entry/src/main/ets/contract/generated/RouteTable.ets');
const viewStateTable = read('entry/src/main/ets/contract/generated/ViewStateTable.ets');
const routeRenderer = read('entry/src/main/ets/ui/router/RouteRenderer.ets');
const viewStateRenderer = read('entry/src/main/ets/ui/components/ViewStateRenderer.ets');
const overlayHost = read('entry/src/main/ets/ui/slots/OverlayHost.ets');
const stateHost = read('entry/src/main/ets/ui/slots/StateHost.ets');
const routeReconstructionQuarantinePath = path.join(
  READER_UI,
  'contracts',
  'fixtures',
  'route-reconstruction-quarantine.fixtures.json',
);
const visualAdmissionRegistryPath = path.join(READER_UI, 'docs', 'design', 'FIGMA_VISUAL_ADMISSION_REGISTRY.json');

console.log('enforce-implementation-ready-gate: verifying execution gate semantics...\n');

// ─── Gate A: the generated artifact must use the two-dimensional gate ───

// The old single `admitted` status must not survive. If it does, a
// candidate-backport route would be confused with a deliverable surface.
assert.ok(!visualAdmission.includes("'admitted'"),
  'generated artifact must not use the retired admitted status');
assert.ok(visualAdmission.includes("'implementation-ready'"),
  'generated artifact must define implementation-ready status');
assert.ok(visualAdmission.includes("'candidate-backport'"),
  'generated artifact must define candidate-backport status');
ok('generated artifact uses the two-dimensional admission gate (no retired admitted status)');

// The status type must include all four dimensions.
assert.ok(visualAdmission.includes("'implementation-ready' | 'candidate-backport' | 'blocked' | 'retired'"),
  'generated artifact must declare all four admission statuses');
ok('generated artifact declares all four admission statuses');

// Every entry must carry sourceBound and implementationReady fields.
const entryPattern = /\{ (routeId|overlayKind): '[^']*', (?:stateId: '[^']*', )?admission: '(implementation-ready|candidate-backport|blocked|retired)', sourceBound: (true|false), implementationReady: (true|false), recordIds: \[[^\]]*\] \}/g;
const entries = [...visualAdmission.matchAll(entryPattern)];
assert.ok(entries.length > 0, 'generated artifact has no admission entries');
ok(`generated artifact has ${entries.length} admission entries with sourceBound + implementationReady fields`);

// ─── Gate B: every entry must be internally consistent ───

let inconsistent = 0;
for (const match of entries) {
  const admission = match[2];
  const sourceBound = match[3] === 'true';
  const implementationReady = match[4] === 'true';

  if (admission === 'implementation-ready') {
    if (!implementationReady || !sourceBound) {
      console.error(`  ✗ implementation-ready entry must have sourceBound=true AND implementationReady=true: ${match[0]}`);
      inconsistent += 1;
    }
  } else if (admission === 'candidate-backport') {
    if (implementationReady || !sourceBound) {
      console.error(`  ✗ candidate-backport entry must have sourceBound=true AND implementationReady=false: ${match[0]}`);
      inconsistent += 1;
    }
  } else {
    // blocked or retired: must NOT be implementation-ready
    if (implementationReady) {
      console.error(`  ✗ ${admission} entry must have implementationReady=false: ${match[0]}`);
      inconsistent += 1;
    }
  }
}
if (inconsistent > 0) {
  fail(`${inconsistent} admission entries are internally inconsistent (admission ↔ sourceBound ↔ implementationReady)`);
}
ok('all admission entries are internally consistent (admission ↔ sourceBound ↔ implementationReady)');

// ─── Gate C: the gate methods must check === 'implementation-ready' ───

// This is the critical check: if any gate method uses a looser comparison
// (e.g., truthiness, or !== 'blocked'), a candidate-backport route would
// pass the gate. The comparison must be exactly === 'implementation-ready'.
const gateMethods = [
  { method: 'isRouteAdmitted', pattern: "admissionForRoute(routeId) === 'implementation-ready'" },
  { method: 'isRouteAdmittedForViewport', pattern: "admissionForRouteViewport(routeId, viewport) === 'implementation-ready'" },
  { method: 'isOverlayAdmitted', pattern: "admissionForOverlay(overlayKind) === 'implementation-ready'" },
  { method: 'isStateAdmitted', pattern: "admissionForState(routeId, stateId) === 'implementation-ready'" },
];
for (const gate of gateMethods) {
  assert.ok(visualAdmission.includes(gate.pattern),
    `generated artifact: ${gate.method} must gate on === 'implementation-ready'`);
}
ok('all four gate methods (route, viewport-route, overlay, state) check === implementation-ready');

// ─── Gate D: every renderer must document candidate-backport as fail-closed ───

// The renderers must explicitly mention both `implementation-ready` (the
// only passing status) and `candidate-backport` (the fail-closed status) in
// their comments. This makes the execution gate enforceable in source, not
// just in the generated artifact. A future edit that removes these comments
// would signal that someone is trying to collapse the two dimensions again.
const renderers = [
  { name: 'RouteRenderer', source: routeRenderer },
  { name: 'ViewStateRenderer', source: viewStateRenderer },
  { name: 'OverlayHost', source: overlayHost },
];
for (const renderer of renderers) {
  assert.ok(renderer.source.includes('implementation-ready'),
    `${renderer.name} must document implementation-ready as its execution gate`);
  assert.ok(renderer.source.includes('candidate-backport'),
    `${renderer.name} must document candidate-backport as a fail-closed stop condition`);
}
ok('all active renderers (RouteRenderer, ViewStateRenderer, OverlayHost) document the execution gate');

// ─── Gate E: RouteRenderer must name its gate method after implementation-ready ───

// The old `isDisplayedRouteVisuallyAdmitted` name collapsed the two
// dimensions. The new `isDisplayedRouteImplementationReady` name makes the
// gate's semantics explicit in the method name itself.
assert.ok(routeRenderer.includes('isDisplayedRouteImplementationReady'),
  'RouteRenderer must name its gate method isDisplayedRouteImplementationReady, not the old isDisplayedRouteVisuallyAdmitted');
assert.ok(!routeRenderer.includes('isDisplayedRouteVisuallyAdmitted'),
  'RouteRenderer must not retain the old isDisplayedRouteVisuallyAdmitted method name');
ok('RouteRenderer gate method is named after implementation-ready');

// ─── Gate F: source route extraction must replace hidden fail-closed slots ───

// A candidate-backport route must not receive a local diagnostic, fallback
// page, or a hidden width(0) hit node. The A3 source fixture removes the old
// Reader route mappings from generated RouteTable/ViewStateTable, and the
// renderer only mounts a shell when that generated mapping is still present.
assert.ok(fs.existsSync(routeReconstructionQuarantinePath),
  'Reader-UI route reconstruction quarantine fixture is missing');
const routeReconstructionQuarantine = JSON.parse(fs.readFileSync(routeReconstructionQuarantinePath, 'utf8'));
assert.equal(routeReconstructionQuarantine.status, 'active',
  'A3 route extraction must remain active while any Reader record is still isolated');
assert.ok(fs.existsSync(visualAdmissionRegistryPath),
  'Reader-UI visual admission registry is missing');
const visualAdmissionRegistry = JSON.parse(fs.readFileSync(visualAdmissionRegistryPath, 'utf8'));
const admissionRecordIds = new Set(visualAdmissionRegistry.records.map((record) => record.id));
const physicallyRetiredRouteIds = [];
for (const record of visualAdmissionRegistry.records) {
  const retiredRouteIds = record.reconstruction?.retiredRouteIds;
  if (retiredRouteIds === undefined) continue;
  assert.ok(Array.isArray(retiredRouteIds),
    `${record.id} reconstruction.retiredRouteIds must be an array when present`);
  for (const routeId of retiredRouteIds) {
    assert.ok(typeof routeId === 'string' && routeId.length > 0,
      `${record.id} reconstruction.retiredRouteIds contains an invalid route id`);
    physicallyRetiredRouteIds.push(routeId);
  }
}
for (const routeId of routeReconstructionQuarantine.entries
  .filter((entry) => {
    assert.ok(admissionRecordIds.has(entry.recordId),
      `route reconstruction quarantine references missing admission record ${entry.recordId}`);
    return entry.status === 'active';
  })
  .flatMap((entry) => entry.routeIds || [])) {
  physicallyRetiredRouteIds.push(routeId);
}
assert.equal(new Set(physicallyRetiredRouteIds).size, physicallyRetiredRouteIds.length,
  'a physically retired route must have exactly one source owner');
for (const routeId of physicallyRetiredRouteIds) {
  // Strict A2 removal: no compatibility union, no active table entry, no
  // shell mapping, and no generated view-state may retain a historical route.
  assert.equal(routeTable.includes(`'${routeId}'`), false,
    `physically retired route ${routeId} remains in generated RouteTable`);
  assert.equal(routeTable.includes(`case '${routeId}': return`), false,
    `physically retired route ${routeId} still has a generated shell mapping`);
  assert.equal(viewStateTable.includes(`\"routeId\": \"${routeId}\"`), false,
    `physically retired route ${routeId} remains in generated ViewStateTable`);
}
assert.ok(routeRenderer.includes("this.isDisplayedRouteImplementationReady() && this.shellOfDisplayedRoute() === 'ReaderShell'"),
  'RouteRenderer must require both implementation readiness and a source-generated Reader shell mapping');
for (const source of [routeRenderer, viewStateRenderer, overlayHost, stateHost]) {
  assert.ok(!source.includes('Column().width(0).height(0)'),
    'RouteRenderer, ViewStateRenderer, OverlayHost, and the retired StateHost must not use a zero-size hiding node');
  assert.equal(/(?:width\(0\)[\s\S]{0,120}height\(0\)|height\(0\)[\s\S]{0,120}width\(0\))/.test(source), false,
    'active renderer hosts must physically omit rejected nodes, not hide them behind reordered or multiline zero-size geometry');
}
assert.ok(stateHost.includes('STATE_HOST_RETIRED') && !stateHost.includes('@Component'),
  'generic StateHost must be explicitly retired, not preserved as an inert visual component');
ok('A3 source route extraction replaces zero-size hidden route/slot fallbacks');

// ─── Gate G: the generated artifact must be synchronized to the current registry ───

// The 2026-07-27 audit found 28 records with harmony.status: implementation-ready
// in the registry but 0 implementation-ready entries in the generated artifact.
// That means someone hand-edited the registry without regenerating. The generator's
// --check mode regenerates to a temp buffer and diffs against the committed file.
// If they differ, the artifact is stale and the renderer gate is operating on
// outdated data.
const generatorPath = path.join(READER_UI, 'tools', 'design', 'generate-visual-admission-contract.mjs');
if (!fs.existsSync(generatorPath)) {
  fail(`Reader-UI generator not found at ${generatorPath} — READER_UI_ROOT may be wrong`);
}
const generatorCheck = spawnSync('node', [generatorPath, '--check'], {
  cwd: READER_UI,
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (generatorCheck.status !== 0) {
  const stderr = generatorCheck.stderr?.toString().trim();
  const stdout = generatorCheck.stdout?.toString().trim();
  fail(`generated VisualAdmission.ets is STALE — registry was edited without regenerating.\n  generator --check output: ${stderr || stdout}\n  Run 'node tools/design/generate-visual-admission-contract.mjs' in Reader-UI to regenerate.`);
}
ok('generated VisualAdmission.ets is synchronized to the current registry (generator --check passes)');

// ─── Gate G2: upstream and HarmonyOS consumer copy must be byte-identical ───

// The 2026-07-27 audit found Reader-UI's generated/arkts/VisualAdmission.ets
// and Reader-for-HarmonyOS's entry/.../contract/reader_ui/VisualAdmission.ets
// had diverged (different SHA-256). The HarmonyOS build consumes the consumer
// copy, so if it differs from upstream, the build is running against a stale
// or hand-modified artifact — even if generator --check passes upstream. This
// gate makes the divergence a hard failure.
const upstreamArtifact = path.join(READER_UI, 'generated', 'arkts', 'VisualAdmission.ets');
const consumerArtifact = path.join(REPO, 'entry/src/main/ets/contract/reader_ui/VisualAdmission.ets');
if (!fs.existsSync(upstreamArtifact)) {
  fail(`upstream VisualAdmission.ets not found at ${upstreamArtifact} — has the generator ever been run?`);
}
if (!fs.existsSync(consumerArtifact)) {
  fail(`HarmonyOS consumer copy not found at ${consumerArtifact} — run 'npm run gen:contracts' to sync, or run promote-family.mjs which syncs atomically.`);
}
const upstreamHash = crypto.createHash('sha256').update(fs.readFileSync(upstreamArtifact)).digest('hex');
const consumerHash = crypto.createHash('sha256').update(fs.readFileSync(consumerArtifact)).digest('hex');
if (upstreamHash !== consumerHash) {
  fail(`upstream and HarmonyOS consumer VisualAdmission.ets have diverged:\n` +
    `  upstream  (${path.relative(READER_UI, upstreamArtifact)}): ${upstreamHash}\n` +
    `  consumer  (${path.relative(REPO, consumerArtifact)}): ${consumerHash}\n` +
    `  The HarmonyOS build consumes the consumer copy, so this divergence means\n` +
    `  the build is running against a stale or hand-modified artifact. Run\n` +
    `  'node tools/design/promote-family.mjs <recordId>' in Reader-UI (which\n` +
    `  syncs the consumer copy atomically) or 'npm run gen:contracts' in\n` +
    `  Reader-for-HarmonyOS to resync.`);
}
ok('upstream VisualAdmission.ets == HarmonyOS consumer copy (byte-identical)');

// ─── Gate H: every implementation-ready record must have local.status === implementation-ready ───

// This is the core anti-bypass check. The generator only reads harmony.status to
// derive implementationReady. An agent can hand-edit harmony.status to
// 'implementation-ready' without completing source-side conversion. Checking
// local.status here closes that bypass: if local.status is still
// 'candidate-backport', the source side has not self-promoted, so harmony.status
// must not be implementation-ready either.
const registryPath = path.join(READER_UI, 'docs', 'design', 'FIGMA_VISUAL_ADMISSION_REGISTRY.json');
if (!fs.existsSync(registryPath)) {
  fail(`Reader-UI registry not found at ${registryPath}`);
}
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const localStatusMismatches = [];
for (const record of registry.records) {
  if (record.classification !== 'exact-figma-binding') continue;
  if (record.harmony?.status === 'implementation-ready' && record.local?.status !== 'implementation-ready') {
    localStatusMismatches.push(
      `  - ${record.id}: harmony.status='implementation-ready' but local.status='${record.local?.status}'`,
    );
  }
}
if (localStatusMismatches.length > 0) {
  fail(`${localStatusMismatches.length} record(s) have harmony.status=implementation-ready without local.status=implementation-ready.\n` +
    `  This is the hand-edit bypass: harmony.status was set without source-side conversion.\n` +
    `  Use 'node tools/design/promote-family.mjs <recordId>' in Reader-UI to promote atomically.\n` +
    localStatusMismatches.join('\n'));
}
ok('every implementation-ready record has local.status === implementation-ready (no hand-edit bypass)');

// ─── Gate I: every implementation-ready record must have a promotion ledger entry ───

// Even if local.status matches, an agent could have hand-edited BOTH fields. The
// promotion ledger is the tamper-evident record that promote-family.mjs was
// actually run. Every implementation-ready record must have a corresponding
// ledger entry with a valid hash chain. This makes the bypass detectable after
// the fact, even if the agent edits both fields consistently.
const promoteFamilyPath = path.join(READER_UI, 'tools', 'design', 'promote-family.mjs');
if (!fs.existsSync(promoteFamilyPath)) {
  fail(`promote-family.mjs not found at ${promoteFamilyPath}`);
}
const ledgerCheck = spawnSync('node', [promoteFamilyPath, '--check'], {
  cwd: READER_UI,
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (ledgerCheck.status !== 0) {
  const stderr = ledgerCheck.stderr?.toString().trim();
  const stdout = ledgerCheck.stdout?.toString().trim();
  fail(`promotion ledger check failed — implementation-ready records are missing tamper-evident ledger entries.\n` +
    `  This means harmony.status was hand-edited, not promoted through promote-family.mjs.\n` +
    `  ${stderr || stdout}`);
}
ok('every implementation-ready record has a tamper-evident promotion ledger entry');

// ─── Gate J: every implementation-ready record set must have native receipts ───

// The promotion ledger proves that the registry transaction ran. It does not,
// by itself, prove that the old native route closure was independently cleaned
// before promotion. Reader-UI owns that cross-repository receipt index and its
// verifier; the HarmonyOS gate executes the verifier against both current
// repositories so a documentary-only A2 claim cannot authorize rendering.
const nativeConsumerReceiptsPath = path.join(
  READER_UI,
  'tools',
  'design',
  'native-consumer-receipts.mjs',
);
if (!fs.existsSync(nativeConsumerReceiptsPath)) {
  fail(`native consumer receipt verifier not found at ${nativeConsumerReceiptsPath}`);
}
const nativeConsumerReceiptsCheck = spawnSync(
  process.execPath,
  [nativeConsumerReceiptsPath],
  {
    cwd: READER_UI,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
if (nativeConsumerReceiptsCheck.status !== 0) {
  const stderr = nativeConsumerReceiptsCheck.stderr?.toString().trim();
  const stdout = nativeConsumerReceiptsCheck.stdout?.toString().trim();
  fail(
    `native A2/B4 consumer receipt check failed — an implementation-ready ` +
    `record set lacks independently verifiable native cleanup/consumption evidence.\n` +
    `  ${stderr || stdout}`,
  );
}
ok('every implementation-ready record set has verified native A2/B4 consumer receipts');

// ─── Summary ───

console.log(`\n✓ implementation-ready gate passed (${pass} checks).`);
console.log('  The execution gate is structurally sound AND source-consistent:');
console.log('    - artifact ↔ registry are synchronized');
console.log('    - local.status === harmony.status for every implementation-ready record');
console.log('    - every promotion has a tamper-evident ledger entry');
console.log('    - every promoted family has verified native A2/B4 consumer receipts');
console.log('  candidate-backport page families will fail closed at every renderer.');
console.log('  This gate does NOT verify Figma parity, Reader-UI source-side conversion');
console.log('  quality, or device delivery — it only verifies that the gate itself cannot');
console.log('  be silently bypassed by hand-editing the registry or skipping regeneration.');

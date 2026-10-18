import { resolveHostTool } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  deploymentRoute,
  parseBundleMetadata,
  profileIdentity,
  sourceSnapshot,
  composeSigningProfile,
  resolveSigningMode,
  freezeSigningMaterial,
  assertResolvedCorePackage,
  buildContractScope,
  controllerSnapshot,
  workspaceContractSnapshot,
  snapshotDescriptor,
  publishContractEvidence,
  verifyContractEvidence,
  assertSnapshotUnchanged,
  contractToolchainSnapshot,
  remainingContractBudget,
  run as runPipelineCommand,
} from '../scripts/hap-pipeline.mjs';
import { runContractsBounded } from './run-contract-tests.mjs';
import { contentSnapshot } from '../../Reader-Core-Native/scripts/build-input-snapshot.mjs';

const { assertCanonicalHapInvocation, assertReaderHapInvocation, isPackageTask, isBuildResourceTask } = createRequire(import.meta.url)('../hvigor/reader-hap-guard.cjs');
for (const task of ['entry:default@CompileArkTS', 'entry:default@CompileTS', 'entry:default@CompileJS',
  'entry:default@compileNative', 'entry:default@BuildNativeWithNinja', 'assembleHap']) {
  assert.equal(isBuildResourceTask(task), true, `${task} must use the shared build resource`);
}
for (const task of ['entry:default@GenerateMetadata', 'help', 'tasks']) assert.equal(isBuildResourceTask(task), false);
const baseline = { app: { products: [{ name: 'default', compileSdkVersion: 'current-sdk' }] }, modules: [{ name: 'entry' }] };
const local = { app: { products: [{ name: 'default', signingConfig: 'fixture', compileSdkVersion: 'stale-sdk' }],
  signingConfigs: [{ name: 'fixture', material: Object.fromEntries(
    ['certpath', 'profile', 'storeFile', 'keyAlias', 'keyPassword', 'storePassword'].map(key => [key, 'fixture-secret'])) }] } };
const composed = composeSigningProfile(baseline, local);
assert.equal(composed.app.products[0].compileSdkVersion, 'current-sdk');
assert.equal(composed.app.products[0].signingConfig, 'fixture');
assert.equal(baseline.app.signingConfigs, undefined, 'composition must never mutate the tracked baseline');
for (const invalid of [ {}, { app: { ...local.app, products: [{ name: 'default' }] } },
  { app: { ...local.app, signingConfigs: [...local.app.signingConfigs, ...local.app.signingConfigs] } },
  { app: { ...local.app, signingConfigs: [{ name: 'fixture', material: {} }] } } ]) {
  assert.throws(() => composeSigningProfile(baseline, invalid));
}
assert.throws(() => resolveSigningMode('auto', false), /never fall back to unsigned/);
assert.equal(resolveSigningMode('auto', true), 'local');
assert.equal(resolveSigningMode('unsigned', false), 'unsigned');

const materialFixture = mkdtempSync(join(tmpdir(), 'reader-signing-material-test-'));
try {
  const input = structuredClone(composed);
  for (const field of ['certpath', 'profile', 'storeFile']) {
    input.app.signingConfigs[0].material[field] = resolve(materialFixture, field);
    writeFileSync(resolve(materialFixture, field), `original-${field}`);
  }
  mkdirSync(resolve(materialFixture, 'material/private-components'), { recursive: true });
  writeFileSync(resolve(materialFixture, 'material/private-components/fixture'), 'encrypted-password-support');
  const frozen = freezeSigningMaterial(input, resolve(materialFixture, 'frozen'));
  writeFileSync(input.app.signingConfigs[0].material.storeFile, 'later-IDE-regeneration');
  assert.equal(readFileSync(frozen.app.signingConfigs[0].material.storeFile, 'utf8'), 'original-storeFile');
  assert.equal(readFileSync(resolve(frozen.app.signingConfigs[0].material.storeFile, '../material/private-components/fixture'), 'utf8'), 'encrypted-password-support');
  assert.equal(frozen.app.signingConfigs[0].material.storePassword, input.app.signingConfigs[0].material.storePassword);
} finally { rmSync(materialFixture, { recursive: true, force: true }); }

const guardFixture = mkdtempSync(join(tmpdir(), 'reader-hap-guard-test-'));
try {
  const profile = '{}';
  writeFileSync(resolve(guardFixture, 'build-profile.json5'), profile);
  writeFileSync(resolve(guardFixture, '.reader-pipeline-session.json'), JSON.stringify({
    token: 'test-token', profileSha256: createHash('sha256').update(profile).digest('hex'),
  }), { mode: 0o600 });
  const env = { READER_HAP_PIPELINE_ROOT: guardFixture, READER_HAP_PIPELINE_TOKEN: 'test-token' };
  for (const task of ['assembleHap', ':entry:assembleHap', 'entry:default@PackageHap', 'default@SignHap', 'assembleApp']) {
    assert.equal(isPackageTask(task), true);
    assert.throws(() => assertCanonicalHapInvocation([task], guardFixture, {}), /pipeline/);
    assert.doesNotThrow(() => assertCanonicalHapInvocation([task], guardFixture, env));
  }
  assert.doesNotThrow(() => assertCanonicalHapInvocation(['compileNative', 'PreviewArkTS'], guardFixture, {}));
  assert.throws(() => assertCanonicalHapInvocation(['assembleHap'], guardFixture, { ...env, READER_HAP_PIPELINE_TOKEN: 'wrong' }));
  assert.throws(() => assertCanonicalHapInvocation(['assembleHap'], process.cwd(), env), /pipeline/);
  const changedSigning = { pipeline: { assertIdeSigningUnchanged() { throw new Error('Private signing inputs changed'); } }, session: {} };
  assert.throws(() => assertReaderHapInvocation(['assembleHap'], changedSigning, guardFixture, {}), /Private signing inputs changed/,
    'native IDE admission must recheck the private signing inputs before packaging');
  assert.throws(() => assertReaderHapInvocation(['assembleHap'], changedSigning, guardFixture,
    { ...env, READER_HAP_PIPELINE_TOKEN: 'wrong' }), /pipeline/,
    'an IDE signing session must never bypass an invalid canonical marker');
  assert.throws(() => assertReaderHapInvocation(['assembleHap'], undefined, guardFixture, {}), /pipeline/,
    'raw packaging without a configured private signing session remains blocked');
  writeFileSync(resolve(guardFixture, 'build-profile.json5'), '{"changed":true}');
  assert.throws(() => assertCanonicalHapInvocation(['assembleHap'], guardFixture, env), /pipeline/);
} finally { rmSync(guardFixture, { recursive: true, force: true }); }

const fixture = mkdtempSync(join(tmpdir(), 'reader-hap-pipeline-test-'));
try {
  mkdirSync(resolve(fixture, 'entry/src'), { recursive: true });
  writeFileSync(resolve(fixture, 'entry/src/main.ets'), 'first\n');
  writeFileSync(resolve(fixture, 'build-profile.json5'), '{ "app": {} }\n');
  const first = sourceSnapshot(fixture);
  writeFileSync(resolve(fixture, 'entry/src/main.ets'), 'second\n');
  const second = sourceSnapshot(fixture);
  assert.notEqual(first.fingerprint, second.fingerprint,
    'a build-input mutation must change the source fingerprint');
  assert.equal(first.files.some((entry) => entry.path === 'entry/src/main.ets'), true);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

const signedDebug = {
  signature: { status: 'signed', verified: true, profileType: 'debug', appIdSha256: 'same-app' },
};
const unsigned = {
  signature: { status: 'unsigned', verified: false, profileType: 'none' },
};
assert.equal(deploymentRoute({ targetKind: 'vm', installed: { bundlePresent: false }, artifact: unsigned }).allowed, false,
  'even a fresh VM must never acquire an empty signing identity from unsigned deployment');
assert.equal(deploymentRoute({ targetKind: 'vm', installed: { bundlePresent: false },
  artifact: { signature: { status: 'signed', verified: false } } }).allowed, false);
const installedDebugNone = {
  bundlePresent: true,
  appProvisionType: 'debug',
  appSignType: 'none',
  appIdSha256: 'same-app',
};
assert.deepEqual(
  deploymentRoute({ targetKind: 'vm', installed: installedDebugNone, artifact: signedDebug }),
  { allowed: true, reason: 'matching-identity-signed-update-candidate', preservesData: true },
  'appSignType=none must not override an independently established application identity',
);
for (const appIdSha256 of ['', 'different-app']) {
  assert.equal(deploymentRoute({ targetKind: 'vm', installed: { ...installedDebugNone, appIdSha256 },
    artifact: signedDebug }).allowed, false, 'debug Profile type alone cannot establish update identity');
}
assert.equal(deploymentRoute({ targetKind: 'vm',
  installed: { ...installedDebugNone, appIdSha256: 'old-key', appIdentifierSha256: 'stable-app' },
  artifact: { signature: { ...signedDebug.signature, appIdentifierSha256: 'stable-app' } } }).allowed, true,
  'a matching nonempty appIdentifier supports legitimate signing key renewal');
assert.throws(() => parseBundleMetadata('Connect server failed'), /absence is not established/);
assert.throws(() => parseBundleMetadata('error: failed to get bundle info'), /absence is not established/);
assert.equal(parseBundleMetadata('error: bundle [io.reader.minliny] not found').bundlePresent, false);
const missingBundle = 'error: failed to get information and the parameters may be wrong.';
assert.equal(parseBundleMetadata(missingBundle, 'ID: 100:\n\tcom.ohos.sceneboard\n\tohos.global.systemres').bundlePresent, false,
  'the device generic lookup error needs an independent successful inventory to prove absence');
for (const inventory of ['', 'Connect server failed', 'ID: 100:',
  'ID: 100:\n\tio.reader.minliny', 'ID: 100:\n\tcom.ohos.sceneboard\nerror: timeout',
  'com.ohos.sceneboard']) {
  assert.throws(() => parseBundleMetadata(missingBundle, inventory), /absence is not established/);
}
const installedMetadata = parseBundleMetadata('io.reader.minliny:\n' + JSON.stringify({
  name: 'io.reader.minliny', appId: 'io.reader.minliny_', appIdentifier: '',
  versionCode: 1000000, versionName: '1.0.0',
  applicationInfo: { bundleName: 'io.reader.minliny', appSignType: 'none', appProvisionType: 'debug' },
}));
assert.equal(installedMetadata.bundlePresent, true);
assert.equal(installedMetadata.appIdentifierSha256, '');
assert.equal(deploymentRoute({ targetKind: 'vm', installed: installedMetadata, artifact: signedDebug }).allowed, false);
assert.doesNotMatch(JSON.stringify(installedMetadata), /io\.reader\.minliny_/,
  'raw installed application identities must not enter deployment evidence');

const certificateFixture = mkdtempSync(join(tmpdir(), 'reader-profile-identity-test-'));
const hash = value => createHash('sha256').update(value).digest('hex');
try {
  for (const algorithm of ['ec', 'rsa']) {
    const certPath = resolve(certificateFixture, `${algorithm}.pem`);
    execFileSync(resolveHostTool('openssl'), ['req', '-x509', '-newkey', algorithm === 'ec' ? 'ec' : 'rsa:2048',
      ...(algorithm === 'ec' ? ['-pkeyopt', 'ec_paramgen_curve:P-256'] : []), '-nodes',
      '-keyout', resolve(certificateFixture, `${algorithm}.key`), '-out', certPath,
      '-subj', '/CN=Reader pipeline test', '-days', '1'], { stdio: 'pipe' });
    const pem = readFileSync(certPath, 'utf8');
    const cert = new X509Certificate(pem);
    const spki = cert.publicKey.export({ format: 'der', type: 'spki' });
    // P-256 SPKI wraps the 65-byte uncompressed point; RSA wraps PKCS#1.
    const publicBytes = algorithm === 'ec' ? spki.subarray(-65) :
      cert.publicKey.export({ format: 'der', type: 'pkcs1' });
    const info = { 'bundle-name': 'io.reader.minliny', 'development-certificate': pem,
      'app-identifier': 'stable-fixture-id' };
    const identity = profileIdentity({ 'bundle-info': info });
    assert.equal(identity.appIdSha256, hash(`io.reader.minliny_${publicBytes.toString('base64')}`));
    assert.notEqual(identity.appIdSha256, hash(`io.reader.minliny_${spki.toString('base64')}`));
    assert.equal(identity.appIdentifierSha256, hash('stable-fixture-id'));
    assert.equal(identity.certificateSha256, hash(cert.raw));
    assert.deepEqual(profileIdentity({ 'bundle-info': { ...info,
      'distribution-certificate': pem, 'development-certificate': 'unused invalid certificate' } }), identity);
    assert.throws(() => profileIdentity({ 'bundle-info': { ...info, 'bundle-name': 'wrong.bundle' } }));
  }
} finally {
  rmSync(certificateFixture, { recursive: true, force: true });
}
assert.deepEqual(
  deploymentRoute({ targetKind: 'vm', installed: installedDebugNone, artifact: unsigned }),
  { allowed: false, reason: 'installed-bundle-rejects-unsigned-preserve-data-route' },
  'an installed debug provision must reject the unsigned preserve-data route',
);
assert.deepEqual(
  deploymentRoute({
    targetKind: 'physical',
    installed: { bundlePresent: false, appProvisionType: '', appSignType: '' },
    artifact: unsigned,
  }),
  { allowed: false, reason: 'physical-device-requires-signed-hap' },
);

const pipeline = readFileSync(new URL('../scripts/hap-pipeline.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(pipeline, /sourceNewerThanArtifact|\$HOME\/\.claude/,
  'the new pipeline must not use mtime freshness or obsolete user-specific skill paths');
assert.match(pipeline, /mkdtempSync\(join\(tmpdir\(\), 'reader-hap-build-'\)\)/,
  'every build must use an isolated temporary source/output sandbox');
assert.match(pipeline, /assertSnapshotUnchanged\(sourceBefore, sourceAfter/,
  'source build inputs must be fingerprinted before and after the isolated build');
assert.match(pipeline, /controller-snapshot\.json/,
  'the exact build controller and tests must be bound to the artifact manifest');
assert.match(pipeline, /workspace-contract-snapshot\.json/,
  'the exact workspace contract and project skills must be bound to the artifact manifest');

const trackedBuildProfile = readFileSync(new URL('../build-profile.json5', import.meta.url), 'utf8');
assert.doesNotMatch(
  trackedBuildProfile,
  /signingConfigs|storePassword|keyPassword|certpath|profile|storeFile|keyAlias/,
  'the tracked build profile must not contain signing configuration or secret-bearing paths',
);
const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
assert.match(gitignore, /^\.reader-artifacts\/$/m);
assert.match(gitignore, /^\.reader-local\/$/m);

const harmonyReadme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
assert.doesNotMatch(harmonyReadme, /\.\/scripts\/check-local\.sh --hap/,
  'the retired check-local HAP entry must not return');

const dependencies = mkdtempSync(join(tmpdir(), 'reader-hap-dependency-test-'));
try {
  const vendor = join(dependencies, 'entry/vendor/core-harmony');
  const store = join(dependencies, 'entry/oh_modules/.ohpm/core');
  const alias = join(dependencies, 'entry/oh_modules/@reader/core-harmony');
  for (const dir of [vendor, store, join(dependencies, 'entry/oh_modules/@reader')]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(vendor, 'Index.ts'), 'export const version = 1;\n');
  writeFileSync(join(store, 'Index.ts'), 'export const version = 1;\n');
  symlinkSync('../.ohpm/core', alias);
  assert.doesNotThrow(() => assertResolvedCorePackage(dependencies), 'OHPM internal aliases must compare resolved content');
  writeFileSync(join(store, 'Index.ts'), 'export const version = 2;\n');
  assert.throws(() => assertResolvedCorePackage(dependencies), /resolved Core package changed/);
  rmSync(alias);
  const hoisted = join(dependencies, 'oh_modules/.ohpm/core');
  mkdirSync(hoisted, { recursive: true });
  writeFileSync(join(hoisted, 'Index.ts'), 'export const version = 1;\n');
  symlinkSync(hoisted, alias);
  assert.doesNotThrow(() => assertResolvedCorePackage(dependencies), 'full projects hoist packages to sandbox root');
  rmSync(alias);
  symlinkSync(vendor, alias);
  assert.throws(() => assertResolvedCorePackage(dependencies), /escapes the isolated dependency directory/,
    'even matching bytes outside the dependency store must not be inherited');
  rmSync(alias);
  rmSync(join(dependencies, 'entry/oh_modules'), { recursive: true });
  const outside = mkdtempSync(join(tmpdir(), 'reader-hap-external-dependencies-'));
  try {
    mkdirSync(join(outside, '@reader/core-harmony'), { recursive: true });
    writeFileSync(join(outside, '@reader/core-harmony/Index.ts'), 'export const version = 1;\n');
    symlinkSync(outside, join(dependencies, 'entry/oh_modules'));
    assert.throws(() => assertResolvedCorePackage(dependencies), /escapes the isolated dependency directory/,
      'the dependency directory itself must remain inside the build sandbox');
  } finally { rmSync(outside, { recursive: true, force: true }); }
} finally { rmSync(dependencies, { recursive: true, force: true }); }

const scoped = mkdtempSync(join(tmpdir(), 'reader-hap-scoped-contracts-'));
try {
  const run = join(scoped, 'run'); mkdirSync(run);
  mkdirSync(join(scoped, 'tools')); mkdirSync(join(scoped, 'entry/src'), { recursive: true }); mkdirSync(join(scoped, 'sdk'));
  writeFileSync(join(scoped, 'entry/src/App.ets'), 'original source');
  writeFileSync(join(scoped, 'sdk/compiler.js'), 'original compiler');
  const loaderFixture = join(scoped, 'sdk/build-tools/ets-loader');
  for (const name of ['lib', 'declarations', 'node_modules/typescript', 'node_modules/json5']) {
    mkdirSync(join(loaderFixture, name), { recursive: true });
  }
  writeFileSync(join(loaderFixture, 'main.js'), 'original SDK main');
  writeFileSync(join(loaderFixture, 'package.json'), '{"name":"SDK fixture"}');
  writeFileSync(join(loaderFixture, 'node_modules/json5/index.js'), 'original dependency');
  const sdkBefore = contractToolchainSnapshot([loaderFixture]);
  for (const path of ['main.js', 'package.json', 'node_modules/json5/index.js']) {
    const file = join(loaderFixture, path), original = readFileSync(file);
    writeFileSync(file, 'changed actual SDK input');
    assert.throws(() => assertSnapshotUnchanged(sdkBefore, contractToolchainSnapshot([loaderFixture]), 'actual SDK dependency'), /changed/);
    writeFileSync(file, original);
  }
  assert.ok(remainingContractBudget(performance.now(), 2000) <= 108000);
  assert.throws(() => remainingContractBudget(performance.now() - 110001), /deadline exceeded/);
  assert.throws(() => runPipelineCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 120 }),
    error => error.code === 'ETIMEDOUT', 'actual synchronous stage child is killed at its remaining budget');
  for (const name of ['test-selected.mjs', 'test-omitted.mjs']) writeFileSync(join(scoped, 'tools', name), 'console.log("actual child PASS");');
  const classification = { schemaVersion: 1, source: ['test-selected.mjs'], integration: ['test-omitted.mjs'],
    scopes: { 'manga-image-cache': ['test-selected.mjs'], 'search-return-runtime': ['test-selected.mjs'] },
    scopePolicies: { 'search-return-runtime': { timeoutMs: 120000, failFast: true, layers: [{ id: 'fixture', tests: ['test-selected.mjs'],
      proves: 'Runs the real selected runtime-policy fixture.', doesNotProve: 'No native ICU responsiveness or full-suite acceptance.' }] } } };
  writeFileSync(join(scoped, 'tools/contract-test-tiers.json'), JSON.stringify(classification));
  mkdirSync(join(scoped, 'scripts'));
  copyFileSync(new URL('../scripts/hap-pipeline.mjs', import.meta.url), join(scoped, 'scripts/hap-pipeline.mjs'));
  copyFileSync(new URL('./hap-contract-evidence-policy.json', import.meta.url), join(scoped, 'tools/hap-contract-evidence-policy.json'));
  assert.equal(buildContractScope(new Map(), scoped), undefined);
  assert.equal(buildContractScope(new Map([['--contracts-scope', 'manga-image-cache']]), scoped), 'manga-image-cache');
  assert.equal(buildContractScope(new Map([['--contracts-scope', 'search-return-runtime']]), scoped), 'search-return-runtime');
  for (const options of [new Map([['--class', 'acceptance'], ['--contracts-scope', 'manga-image-cache']]),
    new Map([['--class', 'acceptance'], ['--contracts-scope', 'search-return-runtime']]),
    new Map([['--contracts-scope', 'unknown']]), new Map([['--contracts-scope', 'search-message-ui']]), new Map([['--contracts-scope', '']]), new Map([['--resume', 'old']])]) {
    assert.throws(() => buildContractScope(options, scoped), /contracts-scope|unknown build argument|missing/);
  }
  // Actual canonical argv rejects before signing, Native admission or any build.
  for (const argv of [['--class', 'acceptance', '--contracts-scope', 'manga-image-cache'],
    ['--class', 'acceptance', '--contracts-scope', 'search-return-runtime'],
    ['--contracts-scope', 'unknown'], ['--contracts-scope', 'search-message-ui'], ['--resume', 'old'], ['--contracts-scope', '--signing', 'unsigned'],
    ['--class', 'iteration', '--class', 'acceptance']]) {
    let rejected;
    try { execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/hap-pipeline.mjs', import.meta.url)), 'build', ...argv],
      { encoding: 'utf8', timeout: 5000 }); } catch (error) { rejected = error; }
    assert.ok(rejected); assert.equal(rejected.status, 2);
    assert.match(rejected.stderr, /contracts-scope|unknown build argument|invalid argument|duplicate argument/);
  }
  const snapshots = { source: sourceSnapshot(scoped), controller: controllerSnapshot(scoped),
    workspace: workspaceContractSnapshot(scoped), toolchain: contentSnapshot(scoped, ['sdk']) };
  const names = { source: 'source-snapshot.json', controller: 'controller-snapshot.json',
    workspace: 'workspace-contract-snapshot.json', toolchain: 'contract-toolchain-snapshot.json' };
  const inputs = Object.fromEntries(Object.entries(snapshots).map(([key, snapshot]) => {
    writeFileSync(join(run, names[key]), JSON.stringify(snapshot));
    return [key, snapshotDescriptor(snapshot, names[key])];
  }));
  const actual = await runContractsBounded(scoped, 'full', 1, { scope: 'manga-image-cache', timeoutMs: 2000 });
  actual.pipelineGateMilliseconds = actual.millisecondsTotal;
  for (const state of [{ cancelled: true }, { treeSettled: false }, { treeRecoveryBlocked: true }]) {
    assert.throws(() => publishContractEvidence(run, { ...actual, ...state }, 'manga-image-cache', inputs, scoped),
      /deadline or settlement/, 'cancelled or unreclaimed execution cannot publish passing evidence');
  }
  const contracts = publishContractEvidence(run, actual, 'manga-image-cache', inputs, scoped);
  const manifest = { buildClass: 'iteration', acceptanceEligible: false, source: { buildInputs: inputs.source }, gates: {
    harmonyContracts: 'PARTIAL', contracts, controllerInputs: inputs.controller,
    workspaceContractInputs: inputs.workspace, contractToolchainInputs: inputs.toolchain } };
  verifyContractEvidence(run, manifest);
  assert.deepEqual(contracts.selected, ['test-selected.mjs']); assert.deepEqual(contracts.omitted, ['test-omitted.mjs']);
  assert.equal(contracts.fullSuite, 'NOT_RUN');
  for (const change of [value => { value.gates.harmonyContracts = 'PASS'; }, value => { value.buildClass = 'acceptance'; },
    value => { value.acceptanceEligible = true; }, value => { delete value.gates.contracts; },
    value => { value.gates.contracts.selected.push('test-omitted.mjs'); }, value => { value.gates.contracts.fullSuite = 'PASS'; },
    value => { delete value.gates.contracts; delete value.gates.contractToolchainInputs; value.gates.harmonyContracts = 'PASS'; },
    value => { delete value.gates.contracts; delete value.gates.contractToolchainInputs; delete value.gates.controllerInputs; value.gates.harmonyContracts = 'PASS'; },
    value => { delete value.gates.controllerInputs; }]) {
    const invalid = structuredClone(manifest); change(invalid); assert.throws(() => verifyContractEvidence(run, invalid));
  }
  const controllerPath = join(run, 'controller-snapshot.json'), controllerBytes = readFileSync(controllerPath);
  const strippedController = JSON.parse(controllerBytes);
  strippedController.files = strippedController.files.filter(file => file.path !== 'tools/hap-contract-evidence-policy.json');
  writeFileSync(controllerPath, JSON.stringify(strippedController));
  const strippedManifest = structuredClone(manifest);
  delete strippedManifest.gates.contracts; delete strippedManifest.gates.contractToolchainInputs; strippedManifest.gates.harmonyContracts = 'PASS';
  assert.throws(() => verifyContractEvidence(run, strippedManifest), /controller snapshot identity mismatch/,
    'deleting the saved policy record cannot reuse its original controller fingerprint');
  writeFileSync(controllerPath, controllerBytes);
  rmSync(controllerPath);
  assert.throws(() => verifyContractEvidence(run, strippedManifest), /ENOENT/,
    'deleting the saved controller file cannot create a legacy fallback');
  writeFileSync(controllerPath, controllerBytes);

  // Genuine pre-policy v2 shape: a bound legacy controller and full PASS,
  // without the new mandatory-policy record or detailed contract ledger.
  const legacyRoot = join(scoped, 'legacy-source'), legacyRun = join(scoped, 'legacy-run');
  mkdirSync(join(legacyRoot, 'scripts'), { recursive: true }); mkdirSync(legacyRun);
  writeFileSync(join(legacyRoot, 'scripts/hap-pipeline.mjs'), 'pre-policy full controller fixture\n');
  const legacyController = controllerSnapshot(legacyRoot);
  writeFileSync(join(legacyRun, 'controller-snapshot.json'), JSON.stringify(legacyController));
  const legacyManifest = { schemaVersion: 2, buildClass: 'iteration', acceptanceEligible: false,
    gates: { harmonyContracts: 'PASS', controllerInputs: snapshotDescriptor(legacyController, 'controller-snapshot.json') } };
  assert.doesNotThrow(() => verifyContractEvidence(legacyRun, legacyManifest));
  const legacyWithoutController = structuredClone(legacyManifest); delete legacyWithoutController.gates.controllerInputs;
  assert.throws(() => verifyContractEvidence(legacyRun, legacyWithoutController), /controller snapshot path/);
  const legacyPartial = structuredClone(legacyManifest); legacyPartial.gates.harmonyContracts = 'PARTIAL';
  assert.throws(() => verifyContractEvidence(legacyRun, legacyPartial), /evidence is missing/);
  const legacyWithNewLedger = structuredClone(legacyManifest); legacyWithNewLedger.gates.contracts = contracts;
  assert.throws(() => verifyContractEvidence(legacyRun, legacyWithNewLedger), /not bound to its controller policy/);
  const receiptPath = join(run, 'contracts/results.json'), receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  const saveReceipt = value => {
    writeFileSync(receiptPath, JSON.stringify(value));
    const bytes = readFileSync(receiptPath);
    manifest.gates.contracts.evidence = { path: 'contracts/results.json', bytes: bytes.length, sha256: hash(bytes) };
  };
  for (const change of [value => { value.results = []; }, value => { value.results.push(value.results[0]); },
    value => { value.results[0].timedOut = true; }, value => { value.results[0].status = 7; },
    value => { value.selected.push('test-omitted.mjs'); }, value => { value.omitted = []; },
    value => { value.inputs.controller.fingerprint = 'bad'; }, value => { value.timeoutMs = 110001; },
    value => { value.scope = 'full'; }, value => { value.scopeExpired = true; },
    value => { value.unrun = ['test-selected.mjs']; }, value => { value.millisecondsTotal = 110001; },
    value => { value.pipelineGateMilliseconds = 110001; }, value => { value.scopeTimeoutMs = null; },
    value => { value.results[0].milliseconds = value.millisecondsTotal + 1; }]) {
    const invalid = structuredClone(receipt); change(invalid); saveReceipt(invalid);
    assert.throws(() => verifyContractEvidence(run, manifest), /contract evidence/);
  }
  saveReceipt(receipt);
  const logPath = join(run, receipt.results[0].log.path), log = readFileSync(logPath);
  writeFileSync(logPath, 'altered log'); assert.throws(() => verifyContractEvidence(run, manifest), /file identity mismatch/);
  writeFileSync(logPath, log);
  const selectedPath = join(run, receipt.selection.path), selectionBytes = readFileSync(selectedPath);
  writeFileSync(selectedPath, JSON.stringify({ ...classification, scopes: { 'manga-image-cache': ['test-omitted.mjs'] } }));
  const newSelection = readFileSync(selectedPath), altered = structuredClone(receipt);
  altered.selection.bytes = newSelection.length; altered.selection.sha256 = hash(newSelection); saveReceipt(altered);
  assert.throws(() => verifyContractEvidence(run, manifest), /tested controller snapshot/);
  writeFileSync(selectedPath, selectionBytes); saveReceipt(receipt); verifyContractEvidence(run, manifest);
  rmSync(logPath); symlinkSync(join(scoped, 'sdk/compiler.js'), logPath);
  assert.throws(() => verifyContractEvidence(run, manifest), /symbolic links/);
  rmSync(logPath); writeFileSync(logPath, log);

  // Full remains all selected, with no omissions; a scope cannot be laundered
  // into full by changing only the outer status labels.
  const fullRun = join(scoped, 'full-run'); mkdirSync(fullRun);
  const fullReport = await runContractsBounded(scoped, 'full', 1, { timeoutMs: 2000 });
  fullReport.pipelineGateMilliseconds = fullReport.millisecondsTotal;
  for (const [key, snapshot] of Object.entries(snapshots)) writeFileSync(join(fullRun, names[key]), JSON.stringify(snapshot));
  const fullContracts = publishContractEvidence(fullRun, fullReport, undefined, inputs, scoped);
  const fullManifest = structuredClone(manifest); fullManifest.gates.harmonyContracts = 'PASS'; fullManifest.gates.contracts = fullContracts;
  verifyContractEvidence(fullRun, fullManifest); assert.equal(fullContracts.selected.length, 2); assert.deepEqual(fullContracts.omitted, []);
  for (const change of [value => { value.results.reverse(); }, value => { value.selected.reverse(); }]) {
    const invalid = structuredClone(fullReport); change(invalid);
    assert.throws(() => publishContractEvidence(fullRun, invalid, undefined, inputs, scoped), /contract evidence/,
      'the same deterministic selection/result order is required for a generic complete fixture receipt');
  }

  const failedReport = structuredClone(actual); failedReport.results[0].timedOut = true;
  assert.throws(() => publishContractEvidence(join(scoped, 'failed'), failedReport, 'manga-image-cache', inputs, scoped), /unsuccessful/);

  const returnRun=join(scoped,'return-runtime-run');mkdirSync(returnRun);
  for(const[key,snapshot]of Object.entries(snapshots))writeFileSync(join(returnRun,names[key]),JSON.stringify(snapshot));
  const returnReport=await runContractsBounded(scoped,'full',1,{scope:'search-return-runtime',timeoutMs:2000});
  returnReport.pipelineGateMilliseconds=returnReport.millisecondsTotal;
  assert.equal(returnReport.scopeTimeoutMs,120000);assert.equal(returnReport.failFast,true);
  assert.deepEqual(returnReport.selected,['test-selected.mjs']);assert.deepEqual(returnReport.omitted,['test-omitted.mjs']);
  assert.deepEqual(returnReport.inventory,['test-omitted.mjs','test-selected.mjs']);
  assert.equal(returnReport.fullSuite,'NOT_RUN');assert.equal(returnReport.acceptanceEligible,false);
  const returnContracts=publishContractEvidence(returnRun,returnReport,'search-return-runtime',inputs,scoped);
  const returnManifest=structuredClone(manifest);returnManifest.gates.contracts=returnContracts;
  verifyContractEvidence(returnRun,returnManifest);
  for(const change of[
    value=>{value.failFast=false;},value=>{value.failureStopped=true;},value=>{value.fullSuite='PASS';},
    value=>{value.acceptanceEligible=true;},value=>{value.selected.push('test-omitted.mjs');},value=>{value.omitted=[];},
    value=>{value.inventory=[];},value=>{value.unrun=['test-selected.mjs'];},value=>{value.results[0].timedOut=true;},
    value=>{value.evidenceLayers[0].doesNotProve='native accepted';},
    value=>{value.scopeTimeoutMs=120001;},value=>{value.pipelineGateMilliseconds=120001;},
  ]){const invalid=structuredClone(returnReport);change(invalid);assert.throws(()=>publishContractEvidence(returnRun,invalid,'search-return-runtime',inputs,scoped),/contract evidence/);}
  const returnAcceptance=structuredClone(returnManifest);returnAcceptance.buildClass='acceptance';returnAcceptance.acceptanceEligible=true;
  assert.throws(()=>verifyContractEvidence(returnRun,returnAcceptance),/scoped contracts cannot be acceptance evidence/);
  const returnUnknown=structuredClone(returnManifest);returnUnknown.gates.contracts.scope='search-return-runtime-unknown';
  assert.throws(()=>verifyContractEvidence(returnRun,returnUnknown),/contract evidence build class is inconsistent/);
  console.log('PASS separate search-return-runtime immutable receipt: exact subset/omissions, 120s policy, fail-fast/PARTIAL and deadline/selection/settlement/log-input policy tamper rejection; no production build');

  writeFileSync(join(scoped, 'entry/src/App.ets'), 'changed during contracts');
  assert.throws(() => assertSnapshotUnchanged(snapshots.source, sourceSnapshot(scoped), 'source inputs during contracts'), /changed/);
  writeFileSync(join(scoped, 'tools/test-selected.mjs'), 'changed during contracts');
  assert.throws(() => assertSnapshotUnchanged(snapshots.controller, controllerSnapshot(scoped), 'controller inputs during contracts'), /changed/);
  writeFileSync(join(scoped, 'sdk/compiler.js'), 'changed during contracts');
  assert.throws(() => assertSnapshotUnchanged(snapshots.toolchain, contentSnapshot(scoped, ['sdk']), 'toolchain inputs during contracts'), /changed/);
  assert.ok(pipeline.indexOf('const sourceBefore = sourceSnapshot(REPO_ROOT)') < pipeline.indexOf('const contractsResultPath'),
    'tested source snapshot must be captured before the selected gate');
  assert.match(pipeline, /source inputs during contracts/); assert.match(pipeline, /contract toolchain inputs during contracts/);
  assert.match(pipeline, /contract toolchain inputs'\)/);
  assert.match(pipeline, /nativeProvenanceArguments\(\), '--preflight'/);
  assert.match(pipeline, /assertSigningMaterialAuthority\(signingProfile/);
  assert.match(pipeline, /'--no-daemon', '--no-incremental'/);
  console.log('PASS scoped HAP contracts: actual children, full inventory, early argv rejection, exact receipt/log/input binding and tamper rejection');
} finally { rmSync(scoped, { recursive: true, force: true }); }

console.log('HarmonyOS HAP pipeline contract: PASS');

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

import {
  deploymentRoute,
  parseBundleMetadata,
  profileIdentity,
  sourceSnapshot,
  composeSigningProfile,
  resolveSigningMode,
  freezeSigningMaterial,
} from '../scripts/hap-pipeline.mjs';

const { assertCanonicalHapInvocation, isPackageTask } = createRequire(import.meta.url)('../hvigor/reader-hap-guard.cjs');
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
assert.equal(parseBundleMetadata('error: bundle [io.reader.harmonyos] not found').bundlePresent, false);
const missingBundle = 'error: failed to get information and the parameters may be wrong.';
assert.equal(parseBundleMetadata(missingBundle, 'ID: 100:\n\tcom.ohos.sceneboard\n\tohos.global.systemres').bundlePresent, false,
  'the device generic lookup error needs an independent successful inventory to prove absence');
for (const inventory of ['', 'Connect server failed', 'ID: 100:',
  'ID: 100:\n\tio.reader.harmonyos', 'ID: 100:\n\tcom.ohos.sceneboard\nerror: timeout',
  'com.ohos.sceneboard']) {
  assert.throws(() => parseBundleMetadata(missingBundle, inventory), /absence is not established/);
}
const installedMetadata = parseBundleMetadata('io.reader.harmonyos:\n' + JSON.stringify({
  name: 'io.reader.harmonyos', appId: 'io.reader.harmonyos_', appIdentifier: '',
  versionCode: 1000000, versionName: '1.0.0',
  applicationInfo: { bundleName: 'io.reader.harmonyos', appSignType: 'none', appProvisionType: 'debug' },
}));
assert.equal(installedMetadata.bundlePresent, true);
assert.equal(installedMetadata.appIdentifierSha256, '');
assert.equal(deploymentRoute({ targetKind: 'vm', installed: installedMetadata, artifact: signedDebug }).allowed, false);
assert.doesNotMatch(JSON.stringify(installedMetadata), /io\.reader\.harmonyos_/,
  'raw installed application identities must not enter deployment evidence');

const certificateFixture = mkdtempSync(join(tmpdir(), 'reader-profile-identity-test-'));
const hash = value => createHash('sha256').update(value).digest('hex');
try {
  for (const algorithm of ['ec', 'rsa']) {
    const certPath = resolve(certificateFixture, `${algorithm}.pem`);
    execFileSync('/usr/bin/openssl', ['req', '-x509', '-newkey', algorithm === 'ec' ? 'ec' : 'rsa:2048',
      ...(algorithm === 'ec' ? ['-pkeyopt', 'ec_paramgen_curve:P-256'] : []), '-nodes',
      '-keyout', resolve(certificateFixture, `${algorithm}.key`), '-out', certPath,
      '-subj', '/CN=Reader pipeline test', '-days', '1'], { stdio: 'pipe' });
    const pem = readFileSync(certPath, 'utf8');
    const cert = new X509Certificate(pem);
    const spki = cert.publicKey.export({ format: 'der', type: 'spki' });
    // P-256 SPKI wraps the 65-byte uncompressed point; RSA wraps PKCS#1.
    const publicBytes = algorithm === 'ec' ? spki.subarray(-65) :
      cert.publicKey.export({ format: 'der', type: 'pkcs1' });
    const info = { 'bundle-name': 'io.reader.harmonyos', 'development-certificate': pem,
      'app-identifier': 'stable-fixture-id' };
    const identity = profileIdentity({ 'bundle-info': info });
    assert.equal(identity.appIdSha256, hash(`io.reader.harmonyos_${publicBytes.toString('base64')}`));
    assert.notEqual(identity.appIdSha256, hash(`io.reader.harmonyos_${spki.toString('base64')}`));
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

console.log('HarmonyOS HAP pipeline contract: PASS');

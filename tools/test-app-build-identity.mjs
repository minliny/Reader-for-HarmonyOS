#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { APP_IDENTITY_METADATA, APP_IDENTITY_SCHEMA, appContentSnapshot, appContentHash, createAppBuildIdentity,
  injectAppIdentity, packagedAppVersion, assertAppVersion, validateReleaseLedger, validateReleaseLedgerAdvance } from '../scripts/lib/app-build-identity.mjs';
import { parseBundleMetadata, assertInstalledAppVersion, verifyAppIdentityEvidence, buildContractScope, prepareIdeAppBuildIdentity } from '../scripts/hap-pipeline.mjs';
import { verifyAppContentEvidence } from '../scripts/lib/app-build-context.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledger = { schemaVersion: 1, productVersion: '0.2.0', versionCode: 1000000, developmentChannel: 'DEV', releases: [] };
const tools = { sdk: Object.fromEntries(['ets', 'native', 'toolchains'].map(key => [key, { apiVersion: '23', version: '6.1.0.105', releaseType: 'Release' }])),
  hvigor: '6.23.7', hvigorPlugin: '6.23.7', node: 'v22.0.0', nativeCompiler: 'clang version 17', java: 'openjdk 17' };
const buildInputs = abi => ({ abi, buildMode: 'debug', product: 'default', toolchain: tools });
const put = (dir, name, bytes) => { const p = resolve(dir, name); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, bytes); return p; };
const json = (dir, name, value) => put(dir, name, JSON.stringify(value, null, 2) + '\n');
const record = (dir, name) => { const bytes = readFileSync(resolve(dir, name)); return { path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; };
const fixture = action => {
  const dir = mkdtempSync(resolve(tmpdir(), 'reader-app-identity-test-'));
  try {
    json(dir, 'AppScope/app.json5', { app: { bundleName: 'io.reader.minliny', versionName: '0.2.0', versionCode: 1000000 } });
    json(dir, 'entry/src/main/module.json5', { module: { name: 'entry', metadata: [{ name: 'unrelated', value: 'keep' }] } });
    json(dir, 'entry/build-profile.json5', { buildOption: { externalNativeOptions: { abiFilters: ['arm64-v8a'], cppFlags: '-std=c++17' } } });
    json(dir, 'build-profile.json5', { app: { products: [{ name: 'default', compatibleSdkVersion: '6.1.0(23)' }] } });
    put(dir, 'entry/src/main/ets/z.ets', 'export const value = 1;\n');
    put(dir, 'entry/libs/arm64-v8a/libreader_core_napi.so', Buffer.from([0, 13, 10, 255]));
    put(dir, 'entry/libs/x86_64/libreader_core_napi.so', Buffer.from([0, 13, 10, 254]));
    return action(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
};
const inputs = ['AppScope', 'entry/src', 'entry/libs', 'entry/build-profile.json5', 'build-profile.json5'];
const snapshot = (dir, abi = 'x86_64') => appContentSnapshot(dir, inputs, { abi });
const make = (files, overrides = {}) => createAppBuildIdentity({ files, buildIdentityInputs: buildInputs('x86_64'),
  ledger, channel: 'DEV', buildClass: 'iteration', signed: true, ...overrides });
const cases = {
  'host-neutral-inputs': () => fixture(dir => {
    const before = snapshot(dir), hash = appContentHash(before, buildInputs('x86_64'));
    chmodSync(resolve(dir, 'entry/src/main/ets/z.ets'), 0o755);
    const config = JSON.parse(readFileSync(resolve(dir, 'AppScope/app.json5'), 'utf8'));
    put(dir, 'AppScope/app.json5', JSON.stringify(config).replaceAll(',', ',\r\n'));
    assert.equal(appContentHash(snapshot(dir), buildInputs('x86_64')), hash);
    assert.deepEqual(snapshot(dir), appContentSnapshot(dir, [...inputs].reverse(), { abi: 'x86_64' }));
    assert(before.every(file => !file.path.includes('\\') && !('mode' in file)));
    put(dir, 'entry/src/main/resource.bin', Buffer.from([13, 10, 255]));
    const binaryHash = appContentHash(snapshot(dir), buildInputs('x86_64'));
    put(dir, 'entry/src/main/resource.bin', Buffer.from([10, 255]));
    assert.notEqual(appContentHash(snapshot(dir), buildInputs('x86_64')), binaryHash);
    symlinkSync(resolve(dir, 'AppScope/app.json5'), resolve(dir, 'entry/src/linked.json'));
    assert.throws(() => snapshot(dir), /symbolic/);
  }),
  'identity-exclusions-abi': () => fixture(dir => {
    const files = snapshot(dir), identity = make(files);
    const injected = injectAppIdentity(JSON.parse(readFileSync(resolve(dir, 'AppScope/app.json5'))),
      JSON.parse(readFileSync(resolve(dir, 'entry/src/main/module.json5'))), identity);
    injected.app.app.versionName = '9.8.7'; injected.app.app.versionCode = 123;
    json(dir, 'AppScope/app.json5', injected.app); json(dir, 'entry/src/main/module.json5', injected.module);
    const profile = JSON.parse(readFileSync(resolve(dir, 'build-profile.json5')));
    profile.app.signingConfigs = [{ name: 'private', material: { storeFile: '/different/host' } }];
    profile.app.products[0].signingConfig = 'private';
    json(dir, 'build-profile.json5', profile);
    assert.equal(make(snapshot(dir)).appContentHash, identity.appContentHash);
    put(dir, 'entry/libs/arm64-v8a/libreader_core_napi.so', 'not-selected');
    assert.equal(make(snapshot(dir)).appContentHash, identity.appContentHash);
    put(dir, 'entry/libs/x86_64/libreader_core_napi.so', 'selected-changed');
    assert.notEqual(make(snapshot(dir)).appContentHash, identity.appContentHash);
    assert.notEqual(appContentHash(snapshot(dir, 'arm64-v8a'), buildInputs('arm64-v8a')), identity.appContentHash);
    const changed = buildInputs('x86_64'); changed.toolchain = { ...tools, node: 'v23.0.0' };
    assert.notEqual(appContentHash(files, changed), identity.appContentHash);
  }),
  'channel-release-ledger': () => fixture(dir => {
    assert.equal(buildContractScope(new Map([['--channel', 'DEV'], ['--abi', 'x86_64']])), 'none');
    assert.throws(() => buildContractScope(new Map([['--channel', 'auto']])), /channel/);
    const files = snapshot(dir), dev = make(files), rcId = `0.2.0.RC.${dev.contentId}`;
    const published = { ...ledger, versionCode: 1000001, releases: [{ versionName: '0.2.0', versionCode: 1000001,
      channel: 'RC', appContentHash: dev.appContentHash, appBuildId: rcId }] };
    assert.throws(() => make(files, { channel: 'RC', ledger: published }), /acceptance/);
    assert.throws(() => make(files, { channel: 'RC', buildClass: 'acceptance', signed: false, ledger: published }), /acceptance/);
    assert.throws(() => make(files, { channel: 'RC', buildClass: 'acceptance' }), /assignment/);
    validateReleaseLedgerAdvance(published, ledger);
    assert.throws(() => validateReleaseLedgerAdvance({ ...ledger, versionCode: 999999 }, ledger), /regress/);
    assert.throws(() => validateReleaseLedgerAdvance({ ...published, releases: [] }, published), /unchanged/);
    const rc = make(files, { channel: 'RC', buildClass: 'acceptance', ledger: published });
    assert.equal(rc.appContentHash, dev.appContentHash); assert.notEqual(rc.appBuildId, dev.appBuildId);
    assert.equal(rc.versionCode, 1000001);
    assert.throws(() => validateReleaseLedger({ ...published, releases: [...published.releases, published.releases[0]] }), /duplicate|regressing/);
    assert.throws(() => make(files, { channel: 'auto' }), /explicit/);
    assert.throws(() => make(files, { ledger: { ...ledger, productVersion: '0.2.0.RC' } }), /ledger/);
  }),
  'packaged-metadata': () => fixture(dir => {
    const identity = make(snapshot(dir));
    const packaged = injectAppIdentity({ app: { versionName: '1.0.0', versionCode: 1 } }, { module: { name: 'entry' } }, identity);
    const config = { app: packaged.app.app, module: packaged.module.module };
    assertAppVersion(identity, packagedAppVersion(config, { required: true }));
    assert.throws(() => packagedAppVersion({ app: config.app, module: {} }, { required: true }), /missing/);
    assert.throws(() => packagedAppVersion({ app: { ...config.app, versionCode: 1 }, module: config.module }), /disagree/);
    const duplicate = structuredClone(config); duplicate.module.metadata.push(duplicate.module.metadata[0]);
    assert.throws(() => packagedAppVersion(duplicate), /duplicated/);
    assert.throws(() => assertAppVersion(identity, { ...identity, appContentHash: 'f'.repeat(64) }), /identity|match/);
    assert.deepEqual(packagedAppVersion({ app: config.app, module: {} }), { versionName: '0.2.0', versionCode: 1000000 });
  }),
  'installed-version': () => fixture(dir => {
    const identity = make(snapshot(dir));
    const raw = { name: 'io.reader.minliny', versionName: identity.versionName, versionCode: identity.versionCode,
      applicationInfo: { appProvisionType: 'debug', uid: 200001 },
      hapModulesInfo: [{ name: 'entry', metadata: [{ name: APP_IDENTITY_METADATA, value: JSON.stringify(identity) }] }] };
    const installed = parseBundleMetadata(JSON.stringify(raw));
    assertInstalledAppVersion(identity, installed);
    assert.throws(() => assertInstalledAppVersion(identity, { ...installed, versionCode: 1 }), /system version/);
    assert.throws(() => assertInstalledAppVersion(identity, { ...installed, appVersion: undefined }), /identity/);
    put(dir, 'entry/src/main/ets/z.ets', 'export const value = 2;');
    const other = make(snapshot(dir));
    assert.throws(() => assertInstalledAppVersion(other, installed), /match/);
    assert.throws(() => parseBundleMetadata(JSON.stringify({ ...raw, versionCode: 1 })), /disagree/);
    const internalBms = structuredClone(raw); internalBms.hapModuleInfos = internalBms.hapModulesInfo; delete internalBms.hapModulesInfo;
    assertInstalledAppVersion(identity, parseBundleMetadata(JSON.stringify(internalBms)));
    const legacy = structuredClone(raw); delete legacy.hapModulesInfo;
    assert.equal(parseBundleMetadata(JSON.stringify(legacy)).appVersion, undefined);
  }),
  'public-hvigor-injection': async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'reader-hvigor-identity-test-'));
    try {
      let expected;
      fixture(source => { expected = make(snapshot(source)); });
      put(dir, 'scripts/lib/app-build-identity.mjs', readFileSync(resolve(root, 'scripts/lib/app-build-identity.mjs')));
      json(dir, 'build-profile.json5', { app: { products: [{ name: 'default' }] } });
      json(dir, '.reader-app-build.json', expected);
      const profileSha256 = record(dir, 'build-profile.json5').sha256;
      const appIdentitySha256 = record(dir, '.reader-app-build.json').sha256;
      const marker = json(dir, '.reader-pipeline-session.json', { token: 'test-session', profileSha256, appIdentitySha256 }); chmodSync(marker, 0o600);
      const originalApp = { app: { versionName: '0.0.1', versionCode: 1, bundleName: 'io.reader.minliny' } };
      const originalModule = { module: { name: 'entry', metadata: [{ name: 'other', value: 'preserved' }] } };
      let app, module;
      let configuredProfile;
      const appContext = { getAppJsonOpt: () => originalApp, setAppJsonOpt: value => { app = value; },
        getBuildProfileOpt: () => ({ app: { products: [{ name: 'default', versionName: '9.9.9', versionCode: 9 }] } }),
        setBuildProfileOpt: value => { configuredProfile = value; } };
      const moduleContext = { getModuleName: () => 'entry', getModuleJsonOpt: () => originalModule, setModuleJsonOpt: value => { module = value; } };
      const { configureAppBuildIdentity } = createRequire(import.meta.url)('../hvigor/reader-hap-guard.cjs');
      const profileBefore = readFileSync(resolve(dir, 'build-profile.json5'));
      await configureAppBuildIdentity(appContext, [moduleContext], undefined, dir,
        { READER_HAP_PIPELINE_ROOT: dir, READER_HAP_PIPELINE_TOKEN: 'test-session' });
      assertAppVersion(expected, packagedAppVersion({ app: app.app, module: module.module }, { required: true }));
      assert.equal(configuredProfile.app.products[0].versionName, expected.versionName);
      assert.equal(configuredProfile.app.products[0].versionCode, expected.versionCode);
      assert.equal(originalApp.app.versionName, '0.0.1'); assert.equal(originalModule.module.metadata.length, 1);
      assert.deepEqual(readFileSync(resolve(dir, 'build-profile.json5')), profileBefore);
      assert.equal(module.module.metadata[0].name, 'other');
      // Exercise the native IDE branch with the real shared generator, selected
      // SDK and current source inputs; public setters remain a private fixture.
      appContext.getBuildMode = () => 'debug';
      appContext.getCurrentProduct = () => ({ getProductName: () => 'default' });
      const ide = { session: {}, pipeline: { prepareIdeAppBuildIdentity } };
      const sourcePaths = ['AppScope/app.json5', 'entry/src/main/module.json5', 'build-profile.json5'];
      const sourceBefore = sourcePaths.map(path => readFileSync(resolve(root, path)));
      await configureAppBuildIdentity(appContext, [moduleContext], ide, dir, { ...process.env, READER_HARMONY_ABI: 'x86_64', READER_APP_CHANNEL: 'DEV' });
      assertAppVersion(ide.session.appIdentity.expectedVersion, packagedAppVersion({ app: app.app, module: module.module }, { required: true }));
      sourcePaths.forEach((path, index) => assert.deepEqual(readFileSync(resolve(root, path)), sourceBefore[index]));
      assert.equal(ide.session.appIdentity.expectedVersion.channel, 'DEV');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  },
  'manifest-evidence': () => fixture(dir => {
    const files = snapshot(dir), expected = make(files);
    const evidence = { schema: APP_IDENTITY_SCHEMA, appContentHash: expected.appContentHash, buildIdentityInputs: buildInputs('x86_64'), files };
    json(dir, 'controller-snapshot.json', { files: [{ path: 'scripts/lib/app-build-identity.mjs' }] });
    json(dir, 'app-content-snapshot.json', evidence); json(dir, 'app-release-ledger.json', ledger);
    const manifest = { appIdentitySchema: APP_IDENTITY_SCHEMA, expectedVersion: expected, abi: 'x86_64', buildClass: 'iteration',
      appContentInputs: record(dir, 'app-content-snapshot.json'), appReleaseLedger: record(dir, 'app-release-ledger.json'), artifacts: [{ kind: 'signed' }] };
    assert.equal(verifyAppIdentityEvidence(dir, manifest), 'PASS');
    assert.throws(() => verifyAppIdentityEvidence(dir, { ...manifest, expectedVersion: undefined }), /missing/);
    json(dir, 'controller-snapshot.json', { files: [{ path: 'scripts\\lib\\app-build-identity.mjs' }] });
    assert.throws(() => verifyAppIdentityEvidence(dir, {}), /missing/);
    assert.equal(verifyAppIdentityEvidence(dir, manifest), 'PASS');
    assert.throws(() => verifyAppContentEvidence({ ...evidence, appContentHash: 'f'.repeat(64) }, expected), /reproduce/);
    json(dir, 'app-content-snapshot.json', { ...evidence, files: [] });
    assert.throws(() => verifyAppIdentityEvidence(dir, manifest), /mismatch/);
    json(dir, 'controller-snapshot.json', { files: [] });
    assert.equal(verifyAppIdentityEvidence(dir, {}), 'LEGACY_NOT_PRESENT');
  }),
};

const args = process.argv.slice(2);
if (!args.length || args[0] === '--list') {
  console.log(JSON.stringify({ status: 'NOT_RUN', cases: Object.keys(cases) }));
} else {
  assert(args.length === 2 && args[0] === '--case' && cases[args[1]], 'Select exactly one declared --case');
  await cases[args[1]]();
  console.log(JSON.stringify({ status: 'PASS', case: args[1] }));
}

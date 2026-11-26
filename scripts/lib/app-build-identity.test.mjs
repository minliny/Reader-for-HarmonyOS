import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { APP_RELEASE_LEDGER, appContentHash, appContentSnapshot } from './app-build-identity.mjs';

const arm = 'entry/libs/arm64-v8a/libreader_core_napi.so';
const x86 = 'entry/libs/x86_64/libreader_core_napi.so';
const resource = 'entry/src/main/resources/base/media/reading.woff2';
const uncached = 'entry/src/main/resources/base/media/uncached.woff2';
const appConfig = 'AppScope/app.json5';
const moduleConfig = 'entry/src/main/module.json5';
const profileConfig = 'entry/build-profile.json5';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'reader-app-identity-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, contents) => {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  };
  const digestRecord = path => {
    const bytes = readFileSync(join(root, path));
    return { path, type: 'file', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  };
  return { root, put, digestRecord };
}

const toolchain = {
  hvigor: '1.0.0', hvigorPlugin: '1.0.0', node: 'v26.0.0', nativeCompiler: 'fixture clang', java: 'fixture java',
  sdk: Object.fromEntries(['ets', 'native', 'toolchains'].map(component =>
    [component, { version: '1.0.0', apiVersion: '1' }])),
};

test('raw digest reuse preserves sorted records and the App hash for each ABI', t => {
  const { root, put, digestRecord } = fixture(t);
  const configPaths = [appConfig, moduleConfig, profileConfig];
  put(appConfig, '{"app": {"versionName": "1.0.0", "versionCode": 1, "bundleName": "io.reader.fixture"}}');
  put(moduleConfig, '{"module": {"name": "entry", "metadata": [{"name": "reader.appBuildIdentity", "value": "transient"}]}}');
  put(profileConfig, '{"buildOption":{"externalNativeOptions":{"abiFilters":["arm64-v8a","x86_64"]}}}');
  put(resource, Buffer.from([0, 128, 255, 13, 10]));
  put(uncached, 'ordinary fallback');
  put(arm, 'arm fixture');
  put(x86, 'x86 fixture');
  put(APP_RELEASE_LEDGER, 'excluded ledger');
  const precomputedRecords = new Map([...configPaths, arm, x86, resource, APP_RELEASE_LEDGER].map(path =>
    [path, digestRecord(path)]));
  const inputs = ['AppScope', 'entry/src', 'entry/libs', resource, profileConfig, 'hvigor-config.json5', APP_RELEASE_LEDGER];

  for (const [abi, selected, excluded] of [['arm64-v8a', arm, x86], ['x86_64', x86, arm]]) {
    const parsed = [];
    const parseJson5 = content => { parsed.push(content); return JSON.parse(content); };
    const expected = appContentSnapshot(root, inputs, { abi });
    const actual = appContentSnapshot(root, inputs, { abi, parseJson5, precomputedRecords });
    assert.deepEqual(actual, expected);
    assert.equal(parsed.length, configPaths.length);
    assert.equal(actual.filter(record => record.path === resource).length, 1);
    assert.ok(actual.some(record => record.path === selected));
    assert.ok(actual.some(record => record.path === uncached));
    assert.ok(!actual.some(record => record.path === excluded || record.path === APP_RELEASE_LEDGER));
    for (const configPath of configPaths) {
      const record = actual.find(record => record.path === configPath);
      assert.equal(record.encoding, 'canonical-json-lf');
      assert.notEqual(record.sha256, precomputedRecords.get(configPath).sha256);
    }
    const buildIdentityInputs = { abi, buildMode: 'debug', product: 'default', toolchain };
    assert.equal(appContentHash(actual, buildIdentityInputs), appContentHash(expected, buildIdentityInputs));
  }
});

test('config identity tracks canonical values despite a raw digest for the same file', t => {
  const { root, put, digestRecord } = fixture(t);
  const snapshot = () => {
    const precomputedRecords = new Map([[appConfig, digestRecord(appConfig)]]);
    return appContentSnapshot(root, [appConfig], { abi: 'arm64-v8a', precomputedRecords });
  };
  put(appConfig, '{"app":{"versionName":"1.0.0","bundleName":"io.reader.fixture","label":"label"}}');
  const original = snapshot();
  put(appConfig, '{\r\n "app" : { "label":"label", "bundleName":"io.reader.fixture", "versionName":"2.0.0" }\r\n}');
  assert.deepEqual(snapshot(), original);
  put(appConfig, '{"app":{"bundleName":"io.reader.fixture","label":"changed"}}');
  assert.notDeepEqual(snapshot(), original);
});

test('absent or invalid same-process records fall back to reading the current file', t => {
  const { root, put, digestRecord } = fixture(t);
  put(resource, 'resource bytes');
  const snapshot = precomputedRecords => appContentSnapshot(root, [resource], { abi: 'arm64-v8a', precomputedRecords });
  const expected = snapshot(undefined);
  const record = digestRecord(resource);
  const wrongDigest = '0'.repeat(64);
  const invalidRecords = [
    { ...record, path: uncached, sha256: wrongDigest },
    { ...record, type: 'symlink', sha256: wrongDigest },
    { ...record, bytes: record.bytes - 1, sha256: wrongDigest },
    { ...record, sha256: 'not a digest' },
  ];
  for (const invalid of invalidRecords) assert.deepEqual(snapshot(new Map([[resource, invalid]])), expected);
  assert.deepEqual(snapshot(new Map()), expected);
});

test('a precomputed digest does not bypass regular-file or root checks', t => {
  const { root, put, digestRecord } = fixture(t);
  put(resource, 'resource bytes');
  const precomputedRecords = new Map([[resource, digestRecord(resource)]]);
  const options = { abi: 'arm64-v8a', precomputedRecords };
  assert.throws(() => appContentSnapshot(root, ['../outside'], options), /Invalid app identity input root/);
  rmSync(join(root, resource));
  assert.throws(() => appContentSnapshot(root, [resource], options), /App identity input is missing/);
  try { symlinkSync(join(root, 'elsewhere'), join(root, resource), 'file'); }
  catch (error) {
    if (process.platform !== 'win32' || error.code !== 'EPERM') throw error;
    return;
  }
  assert.throws(() => appContentSnapshot(root, [resource], options), /symbolic-link parent/);
  assert.throws(() => appContentSnapshot(root, ['entry/src'], options), /cannot follow symbolic links/);
});

import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, utimesSync,
  writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { copySourceSandbox, isCleanArkTsCompileFailure, sourceSnapshot } from '../hap-pipeline.mjs';
import { publishVerifiedHapRun } from './hap-delivery-evidence.mjs';

const asset = 'entry/src/main/resources/base/media/font.bin';
const profile = 'build-profile.json5';
const otherAbi = join('entry', 'libs', 'x86_64');

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'reader-hap-copy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const cache = join(root, 'cache');
  const destination = join(cache, 'project');
  const put = (repo, path, bytes) => {
    const target = join(repo, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  };
  put(source, asset, 'original payload');
  put(source, profile, '{"source": true}');
  put(source, join(otherAbi, 'libreader_core_napi.so'), 'unused ABI');
  return { source, destination, cache, put };
}

test('warm sandbox verification matches a full snapshot and retains deletions and overrides', t => {
  const { source, destination, cache, put } = fixture(t);
  const cold = copySourceSandbox(source, destination, cache);
  assert.deepEqual(cold, sourceSnapshot(destination));
  put(destination, 'entry/src/obsolete.txt', 'stale source');
  put(destination, 'entry/build/generated.txt', 'excluded output');
  const overrides = new Map([[profile, { mode: 0o600, bytes: Buffer.from('{"effective": true}') }]]);
  const warm = copySourceSandbox(source, destination, cache, { incremental: true, overrides, omitted: [otherAbi] });
  assert.deepEqual(warm, sourceSnapshot(destination));
  assert.equal(existsSync(join(destination, 'entry/src/obsolete.txt')), false);
  assert.equal(existsSync(join(destination, otherAbi)), false);
  assert.equal(readFileSync(join(destination, 'entry/build/generated.txt'), 'utf8'), 'excluded output');
  assert.equal(readFileSync(join(destination, profile), 'utf8'), '{"effective": true}');
});

test('post-comparison same-size replacement cannot reuse the earlier digest', t => {
  const { source, destination, cache } = fixture(t);
  copySourceSandbox(source, destination, cache);
  const target = join(destination, asset);
  const timestamp = new Date('2020-01-01T00:00:00Z');
  utimesSync(target, timestamp, timestamp);
  const original = lstatSync(target, { bigint: true });
  const overrides = new Map();
  // The override iterable runs after differential copy and before final
  // validation. Replace the previously matched leaf without changing mtime.
  overrides[Symbol.iterator] = function* () {
    const replacement = `${target}.next`;
    writeFileSync(replacement, 'modified payload', { mode: Number(original.mode & 0o777n) });
    utimesSync(replacement, timestamp, timestamp);
    renameSync(replacement, target);
    const replaced = lstatSync(target, { bigint: true });
    assert.equal(replaced.size, original.size);
    assert.equal(replaced.mtimeNs, original.mtimeNs);
    assert.notEqual(replaced.ino, original.ino);
  };
  assert.throws(() => copySourceSandbox(source, destination, cache, { incremental: true, overrides }),
    /copied sandbox inputs changed/);
});

test('an incremental copy rejects a linked destination ancestor', { skip: process.platform === 'win32' }, t => {
  const { source, destination, cache } = fixture(t);
  mkdirSync(cache, { recursive: true });
  symlinkSync(source, destination, 'dir');
  assert.throws(() => copySourceSandbox(source, join(destination, 'file'), cache, { incremental: true }),
    /sandbox destination must contain real directories/);
});

test('incremental recovery remains required until a verified run has been published', t => {
  const { cache, put } = fixture(t);
  const staging = join(cache, 'staging');
  const published = join(cache, 'published');
  const marker = join(cache, 'build-in-progress');
  put(staging, 'manifest.json', '{}');
  put(cache, 'build-in-progress', 'unfinished');
  assert.throws(() => publishVerifiedHapRun(staging, published, () => {
    throw new Error('a sealed input changed');
  }, marker), /a sealed input changed/);
  assert.equal(existsSync(marker), true);
  assert.equal(existsSync(staging), true);
  assert.equal(existsSync(published), false);

  put(published, 'previous.json', '{}');
  assert.throws(() => publishVerifiedHapRun(staging, published, () => {}, marker));
  assert.equal(existsSync(marker), true);
  rmSync(published, { recursive: true });

  publishVerifiedHapRun(staging, published, () => {}, marker);
  assert.equal(existsSync(staging), false);
  assert.equal(existsSync(marker), false);
  assert.equal(readFileSync(join(published, 'manifest.json'), 'utf8'), '{}');
});

test('a recovery marker cleanup failure leaves publication committed and requires cache recovery', t => {
  const { cache, put } = fixture(t);
  const staging = join(cache, 'staging');
  const published = join(cache, 'published');
  const marker = join(cache, 'build-in-progress');
  put(staging, 'manifest.json', '{}');
  put(marker, 'unexpected-content', 'retain for recovery');

  const cleanupError = publishVerifiedHapRun(staging, published, () => {}, marker);

  assert.ok(cleanupError instanceof Error);
  assert.equal(existsSync(staging), false);
  assert.equal(readFileSync(join(published, 'manifest.json'), 'utf8'), '{}');
  assert.equal(readFileSync(join(marker, 'unexpected-content'), 'utf8'), 'retain for recovery');
});

test('isCleanArkTsCompileFailure admits ArkTS compiler errors and rejects daemon or native/packaging failures', () => {
  assert.equal(isCleanArkTsCompileFailure({
    status: 255,
    signal: null,
    stdout: '> hvigor ERROR: Failed :entry:default@CompileArkTS...\nCOMPILE RESULT:FAIL {ERROR:2 WARN:462}\n> hvigor ERROR: BUILD FAILED in 19 s 761 ms',
    stderr: '',
  }), true);
  assert.equal(isCleanArkTsCompileFailure({
    status: 255,
    signal: null,
    stdout: '> hvigor \x1b[91mERROR: Failed :entry:default@CompileArkTS... \x1b[39m\n\x1b[31mCOMPILE RESULT:FAIL {ERROR:2 WARN:458}\x1b[39m\n',
    stderr: '',
  }), true);
  assert.equal(isCleanArkTsCompileFailure({
    status: 0,
    signal: null,
    stdout: '> hvigor ERROR: Failed :entry:default@CompileArkTS...\nCOMPILE RESULT:FAIL {ERROR:1 WARN:0}',
    stderr: '',
  }), false);
  assert.equal(isCleanArkTsCompileFailure({
    status: null,
    signal: 'SIGKILL',
    stdout: '> hvigor ERROR: Failed :entry:default@CompileArkTS...\nCOMPILE RESULT:FAIL {ERROR:1 WARN:0}',
    stderr: '',
  }), false);
  assert.equal(isCleanArkTsCompileFailure({
    status: 255,
    signal: null,
    error: new Error('ETIMEDOUT'),
    stdout: '> hvigor ERROR: Failed :entry:default@CompileArkTS...\nCOMPILE RESULT:FAIL {ERROR:1 WARN:0}',
    stderr: '',
  }), false);
  assert.equal(isCleanArkTsCompileFailure({
    status: 255,
    signal: null,
    stdout: '> hvigor ERROR: Failed :entry:default@CompileArkTS...\nCOMPILE RESULT:FAIL {ERROR:1 WARN:0}\nServer has disconnected',
    stderr: '',
  }), false);
  assert.equal(isCleanArkTsCompileFailure({
    status: 255,
    signal: null,
    stdout: '> hvigor ERROR: Failed :entry:default@CompileArkTS...\nCOMPILE RESULT:FAIL {ERROR:1 WARN:0}\nABORT_WORK sent to workers.',
    stderr: '',
  }), false);
  assert.equal(isCleanArkTsCompileFailure({
    status: 255,
    signal: null,
    stdout: '> hvigor ERROR: Failed :entry:default@PackageHap...\nCOMPILE RESULT:FAIL {ERROR:1 WARN:0}',
    stderr: '',
  }), false);
});

test('copySourceSandbox omits docs, tests, and CI metadata directories outside BUILD_INPUTS', t => {
  const { source, destination, cache, put } = fixture(t);
  put(source, 'docs/guide.md', 'documentation');
  put(source, 'tests/sample.test.ts', 'unit test');
  put(source, '.github/workflows/ci.yml', 'workflow');
  put(source, '.pytest_cache/README.md', 'pytest');
  const snapshot = copySourceSandbox(source, destination, cache, { incremental: true });
  assert.deepEqual(snapshot, sourceSnapshot(destination));
  for (const omitted of ['docs', 'tests', '.github', '.pytest_cache']) {
    assert.equal(existsSync(join(destination, omitted)), false, `${omitted} should not be copied into Hvigor sandbox`);
  }
});

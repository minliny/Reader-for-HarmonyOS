import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { coreSourceSnapshot } from '../../Reader-Core-Native/scripts/core-source-snapshot.mjs';
import { syncCoreInputs, assertCoreInputs } from './reader-core-inputs.mjs';
import { assertBuildTools, REQUIRED_PNPM } from './reader-build-tools.mjs';

const root = mkdtempSync(resolve(tmpdir(), 'reader-input-safety-'));
const sha = data => createHash('sha256').update(data).digest('hex');
const write = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };
try {
  const tools = resolve(root, 'tools');
  assert.throws(() => assertBuildTools(tools), /Prepare Hvigor/);
  write(resolve(tools, 'node_modules/pnpm/package.json'), JSON.stringify({ version: '10.27.0' }));
  assert.throws(() => assertBuildTools(tools), /Prepare Hvigor/);
  write(resolve(tools, 'node_modules/pnpm/package.json'), JSON.stringify({ version: REQUIRED_PNPM }));
  write(resolve(tools, 'node_modules/pnpm/bin/pnpm.cjs'), `console.log('${REQUIRED_PNPM}');`);
  assert.deepEqual(assertBuildTools(tools), { pnpm: REQUIRED_PNPM });
  write(resolve(tools, 'node_modules/pnpm/bin/pnpm.cjs'), "console.log('10.27.0');");
  assert.throws(() => assertBuildTools(tools), /executable\/version mismatch/);

  const core = resolve(root, 'Core'), app = resolve(root, 'App');
  mkdirSync(core);
  const git = args => execFileSync('git', ['-C', core, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init']); write(resolve(core, 'Cargo.toml'), '# input\n'); git(['add', '.']);
  git(['-c', 'user.name=Reader test', '-c', 'user.email=reader-test@example.invalid', 'commit', '-m', 'fixture']);
  write(resolve(core, 'Cargo.toml'), '# dirty input\n');
  const base = resolve(core, 'target/harmony-napi/arm64-v8a');
  const snapshot = JSON.stringify(coreSourceSnapshot(core), null, 2) + '\n';
  const identity = JSON.stringify({ gitCommit: git(['rev-parse', 'HEAD']), gitDirty: true, buildId: 'fixture' });
  const native = Buffer.from('fixture Native bytes: no executable or device access');
  const member = 'libs/arm64-v8a/libreader_core_napi.so';
  const manifest = `${sha(native)}  ${native.length}  ${member}\n`;
  write(resolve(base, 'package', member), native); write(resolve(base, 'libreader_core_napi.so'), native);
  write(resolve(base, 'core-source-snapshot.json'), snapshot); write(resolve(base, 'core-build-identity.json'), identity);
  write(resolve(base, 'harmony-package-manifest.sha256'), manifest);
  write(resolve(base, 'harmony-napi-build-evidence.txt'), [
    `core_source_snapshot_sha256=${sha(snapshot)}`, `core_build_identity_sha256=${sha(identity)}`,
    `package_manifest_sha256=${sha(manifest)}`, `artifact_sha256=${sha(native)}`, `artifact_bytes=${native.length}`,
  ].join('\n'));
  assert.equal(syncCoreInputs(core, app).nativeSha256, sha(native));
  // Two dirty worktrees with the same HEAD/dirty bit must never share evidence.
  write(resolve(core, 'Cargo.toml'), '# different dirty input\n');
  assert.throws(() => assertCoreInputs(core, app), /source changed/);
  write(resolve(core, 'Cargo.toml'), '# dirty input\n');
  write(resolve(app, 'entry/libs/arm64-v8a/libreader_core_napi.so'), 'stale Native');
  assert.throws(() => assertCoreInputs(core, app), /Application Native differs/);
  syncCoreInputs(core, app);
  write(resolve(app, 'entry/vendor/core-harmony', member), 'stale vendor');
  assert.throws(() => assertCoreInputs(core, app), /Vendored Core differs/);

  // Exercise the real default lease path under a custom temp directory, with
  // Node standing in for HDC. No actual device operation can occur.
  const env = { ...process.env, TMPDIR: root }; delete env.READER_HDC_LEASE_ROOT;
  const defaultLease = spawnSync(process.execPath, [resolve('tools/reader-hdc-lease.mjs'),
    '--target', 'fixture', '--hdc', process.execPath, '--', '-e', 'process.exit(0)'], { encoding: 'utf8', env });
  assert.equal(defaultLease.status, 0, defaultLease.stderr);
  assert.match(readFileSync(resolve(root, 'reader-hdc-target-leases/events.jsonl'), 'utf8'), /"type":"release"/);
  console.log('PASS build input safety: cold/vulnerable pnpm, dirty Core drift, stale native/vendor, portable HDC lease');
} finally { rmSync(root, { recursive: true, force: true }); }

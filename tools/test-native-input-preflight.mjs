import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coreBuildSnapshot } from '../../Reader-Core-Native/scripts/build-input-snapshot.mjs';

const root = mkdtempSync(join(tmpdir(), 'reader-native-preflight-'));
const sha = value => createHash('sha256').update(value).digest('hex');
const put = (path, value) => writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value));
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
try {
  const core = join(root, 'core'), host = join(root, 'host'), vendor = join(host, 'vendor');
  for (const dir of [core, host, vendor, ...['crates', 'include', 'third_party', 'scripts'].map(path => join(core, path))]) mkdirSync(dir, { recursive: true });
  put(join(core, 'crates/input.rs'), 'original source');
  const additionalInputs = ['include/reader_core.h', 'third_party/input.c', 'scripts/check-harmony-napi-host.sh'];
  for (const path of additionalInputs) put(join(core, path), 'original input');
  const readme = join(core, 'README.md');
  put(readme, 'original documentation');
  put(join(host, 'anchor'), 'synthetic Host');
  for (const repo of [core, host]) {
    git(repo, 'init', '-q'); git(repo, 'add', '.');
    git(repo, '-c', 'user.name=Reader Test', '-c', 'user.email=reader@example.invalid', 'commit', '-qm', 'fixture');
  }
  const native = join(root, 'native.so'), app = join(host, 'native.so');
  // Synthetic bytes exercise integrity rejection, never runtime/ARM support.
  put(native, 'synthetic native'); put(app, readFileSync(native).toString());
  put(join(vendor, 'Index.ts'), 'synthetic SDK');
  const snapshot = join(root, 'inputs.json'), identity = join(root, 'identity.json');
  put(snapshot, coreBuildSnapshot(core));
  put(identity, { schemaVersion: 1, buildId: '1'.repeat(64), gitCommit: git(core, 'rev-parse', 'HEAD'),
    gitDirty: false, cargoLockSha256: '2'.repeat(64), protocolSha256: '3'.repeat(64), rustProfile: 'release' });
  const manifest = join(root, 'package.sha256'), evidence = join(root, 'build.txt');
  const record = (file, path) => `${sha(readFileSync(file))}  ${readFileSync(file).length}  ${path}`;
  put(manifest, record(native, 'libs/arm64-v8a/libreader_core_napi.so') + '\n' + record(join(vendor, 'Index.ts'), 'Index.ts') + '\n');
  const values = { artifact_sha256: sha(readFileSync(native)), artifact_bytes: String(readFileSync(native).length),
    core_build_identity_sha256: sha(readFileSync(identity)), core_input_snapshot_sha256: sha(readFileSync(snapshot)),
    package_manifest_sha256: sha(readFileSync(manifest)), sdk_smoke: 'pass' };
  const writeEvidence = () => put(evidence, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
  // Simulate a producer's complete synthetic output, never a real Native build.
  const refreshSyntheticPair = () => {
    const current = coreBuildSnapshot(core);
    const data = JSON.parse(readFileSync(identity));
    Object.assign(data, current.gitIdentity, { buildId: sha(JSON.stringify(current.gitIdentity)) });
    put(identity, data); put(snapshot, current);
    values.core_build_identity_sha256 = sha(readFileSync(identity));
    values.core_input_snapshot_sha256 = sha(readFileSync(snapshot));
    writeEvidence();
  };
  writeEvidence();
  const args = [fileURLToPath(new URL('./generate-build-provenance-manifest.mjs', import.meta.url)),
    '--preflight', '--allow-dirty', '--core-repo', core, '--harmony-repo', host, '--core-identity', identity,
    '--core-input-snapshot', snapshot, '--napi-manifest', manifest, '--native-so', native,
    '--app-native-so', app, '--harmony-vendor', vendor, '--core-build-evidence', evidence, '--output', join(root, 'result.json')];
  const run = () => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 15000 });
  const baseline = run(); assert.equal(baseline.status, 0, baseline.stderr);
  const cleanInputs = coreBuildSnapshot(core);
  git(core, '-c', 'user.name=Reader Test', '-c', 'user.email=reader@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', 'same input bytes, new commit');
  const recommitted = coreBuildSnapshot(core);
  assert.equal(recommitted.fingerprint, cleanInputs.fingerprint);
  assert.deepEqual(recommitted.files, cleanInputs.files);
  assert.notEqual(recommitted.gitIdentity.gitCommit, cleanInputs.gitIdentity.gitCommit);
  const staleCommit = run(); assert.notEqual(staleCommit.status, 0);
  assert.match(staleCommit.stderr, /Core build identity does not match/,
    'a same-content commit cannot reuse the previous embedded Git identity');
  const commitIdentity = JSON.parse(readFileSync(identity));
  Object.assign(commitIdentity, recommitted.gitIdentity, { buildId: sha(JSON.stringify(recommitted.gitIdentity)) });
  put(identity, commitIdentity); values.core_build_identity_sha256 = sha(readFileSync(identity)); writeEvidence();
  const staleSnapshot = run(); assert.notEqual(staleSnapshot.status, 0);
  assert.match(staleSnapshot.stderr, /Core build inputs changed/,
    'updating identity alone cannot admit a snapshot bound to the old Git identity');
  put(snapshot, recommitted);
  const staleEvidence = run(); assert.notEqual(staleEvidence.status, 0);
  assert.match(staleEvidence.stderr, /does not bind the actual source input snapshot/);
  refreshSyntheticPair(); assert.equal(run().status, 0);
  put(readme, 'documentation-only dirty state');
  assert.equal(coreBuildSnapshot(core).fingerprint, cleanInputs.fingerprint);
  const dirtyDocs = run(); assert.notEqual(dirtyDocs.status, 0);
  assert.match(dirtyDocs.stderr, /Core build identity does not match/);
  refreshSyntheticPair(); assert.equal(run().status, 0);
  put(readme, 'original documentation');
  const restoredDocs = run(); assert.notEqual(restoredDocs.status, 0);
  assert.match(restoredDocs.stderr, /Core build identity does not match/,
    'restoring documentation must reject the previous dirty identity even with identical build inputs');
  refreshSyntheticPair(); assert.equal(run().status, 0);
  symlinkSync(native, join(vendor, 'escaped-input'));
  assert.match(run().stderr, /must not contain symbolic links/);
  rmSync(join(vendor, 'escaped-input'));
  put(app, 'wrong native'); assert.match(run().stderr, /app native input does not match/); put(app, readFileSync(native).toString());
  put(join(vendor, 'Index.ts'), 'wrong SDK'); assert.match(run().stderr, /vendored SDK does not match/); put(join(vendor, 'Index.ts'), 'synthetic SDK');
  values.sdk_smoke = 'skipped'; writeEvidence(); assert.match(run().stderr, /SDK smoke must pass/); values.sdk_smoke = 'pass'; writeEvidence();
  const data = JSON.parse(readFileSync(identity)); data.gitDirty = true; put(identity, data);
  values.core_build_identity_sha256 = sha(readFileSync(identity)); writeEvidence();
  put(join(core, 'crates/input.rs'), 'dirty source one'); put(snapshot, coreBuildSnapshot(core));
  values.core_input_snapshot_sha256 = sha(readFileSync(snapshot)); writeEvidence(); assert.equal(run().status, 0);
  const savedInclude = join(root, 'include-original');
  renameSync(join(core, 'include'), savedInclude);
  symlinkSync(savedInclude, join(core, 'include'));
  assert.match(run().stderr, /Core build inputs may not contain unbound symlink targets/);
  rmSync(join(core, 'include'));
  renameSync(savedInclude, join(core, 'include'));
  assert.equal(run().status, 0);
  for (const path of additionalInputs) {
    put(join(core, path), 'changed input');
    const result = run();
    assert.notEqual(result.status, 0, path);
    assert.match(result.stderr, /Core build inputs changed/, path);
    put(join(core, path), 'original input');
    assert.equal(run().status, 0, path);
  }
  put(join(core, 'crates/input.rs'), 'dirty source two'); assert.match(run().stderr, /Core build inputs changed/);
  put(join(core, 'crates/input.rs'), 'dirty source one'); assert.equal(run().status, 0);
  const builtDirtyInputs = coreBuildSnapshot(core);
  git(core, 'add', 'crates/input.rs');
  git(core, '-c', 'user.name=Reader Test', '-c', 'user.email=reader@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-qm', 'commit the previously built dirty source');
  const committedInputs = coreBuildSnapshot(core);
  assert.equal(committedInputs.fingerprint, builtDirtyInputs.fingerprint);
  assert.deepEqual(committedInputs.files, builtDirtyInputs.files);
  assert.equal(builtDirtyInputs.gitIdentity.gitDirty, true); assert.equal(committedInputs.gitIdentity.gitDirty, false);
  const dirtyToClean = run(); assert.notEqual(dirtyToClean.status, 0);
  assert.match(dirtyToClean.stderr, /Core build identity does not match/,
    'committing already built source must refresh the full pair before preflight admission');
  refreshSyntheticPair(); assert.equal(run().status, 0);
  put(manifest, readFileSync(manifest, 'utf8') + '\n'); assert.match(run().stderr, /does not bind the NAPI package manifest/);
  console.log('PASS Native preflight: same-content commit and dirty/clean identity rejection, complete pair refresh, SDK bytes, skipped smoke, dirty input drift and manifest binding');
} finally { rmSync(root, { recursive: true, force: true }); }

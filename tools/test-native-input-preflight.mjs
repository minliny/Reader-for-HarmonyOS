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
  writeEvidence();
  const args = [fileURLToPath(new URL('./generate-build-provenance-manifest.mjs', import.meta.url)),
    '--preflight', '--allow-dirty', '--core-repo', core, '--harmony-repo', host, '--core-identity', identity,
    '--core-input-snapshot', snapshot, '--napi-manifest', manifest, '--native-so', native,
    '--app-native-so', app, '--harmony-vendor', vendor, '--core-build-evidence', evidence, '--output', join(root, 'result.json')];
  const run = () => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 15000 });
  assert.equal(run().status, 0);
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
  put(manifest, readFileSync(manifest, 'utf8') + '\n'); assert.match(run().stderr, /does not bind the NAPI package manifest/);
  console.log('PASS Native preflight: paired inputs, SDK bytes, skipped smoke, dirty input drift and manifest binding');
} finally { rmSync(root, { recursive: true, force: true }); }

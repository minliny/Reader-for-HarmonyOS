import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyCachedNativePackage } from '../../scripts/ci/verify-cached-native.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const ciWorkflowPath = resolve(repoRoot, '.github/workflows/ci.yml');
const buildScriptPath = resolve(repoRoot, 'scripts/ci/build-unsigned-hap.sh');
const ciText = readFileSync(ciWorkflowPath, 'utf8');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function extractGateScript() {
  const gateSection = ciText.split(/\n  harmonyos-ci-gate:\n/)[1];
  assert.ok(gateSection, 'harmonyos-ci-gate job must exist');
  const marker = '        run: |\n';
  const start = gateSection.indexOf(marker);
  assert.notEqual(start, -1, 'harmonyos-ci-gate run block must exist');
  return gateSection
    .slice(start + marker.length)
    .split('\n')
    .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
    .join('\n');
}

function runGateScript(overrides = {}) {
  const script = extractGateScript();
  const env = {
    ...process.env,
    GITHUB_REPOSITORY: 'minliny/Reader-for-HarmonyOS',
    GITHUB_ACTOR: 'minliny',
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_REF: 'refs/pull/42/merge',
    HOST_RESULT: 'success',
    CORE_FIXTURE_RESULT: 'success',
    BUILD_RESULT: 'success',
    NON_DOCUMENT: 'true',
    SELECTED: '2',
    EXECUTED: '2',
    SAME_REPO_PR: 'true',
    DRAFT_PR: 'false',
    DELETED_PUSH: 'false',
    ...overrides,
  };
  return spawnSync('bash', ['-c', script], { env, encoding: 'utf8' });
}

function buildSyntheticCacheFixture(tempRoot) {
  const abi = 'arm64-v8a';
  const rustTarget = 'aarch64-unknown-linux-ohos';
  const coreCommit = 'a'.repeat(40);
  const coreInputFingerprint = 'b'.repeat(64);

  const lockPath = join(tempRoot, 'core-dependency.json');
  writeFileSync(
    lockPath,
    JSON.stringify({
      coreCommit,
      coreInputFingerprint,
      abis: [abi],
      rustTarget,
      rustToolchain: '1.97.1',
      canonicalBuild: 'scripts/build-harmony-napi.sh',
      ciUnsignedOnly: true,
    }),
  );

  const cacheDir = join(tempRoot, 'native-cache');
  const pkgDir = join(cacheDir, 'package');
  mkdirSync(join(pkgDir, 'libs', abi), { recursive: true });
  mkdirSync(join(pkgDir, 'sdk'), { recursive: true });

  const nativeBytes = Buffer.from('ELF-synthetic-native-so');
  const storageBytes = Buffer.from('{"schemaVersion":1,"contract":"synthetic"}\n');
  const indexBytes = Buffer.from('export const version = 1;\n');

  writeFileSync(join(pkgDir, 'libs', abi, 'libreader_core_napi.so'), nativeBytes);
  writeFileSync(join(pkgDir, 'storage-contract.v1.json'), storageBytes);
  writeFileSync(join(pkgDir, 'sdk', 'index.ts'), indexBytes);

  const manifestLines = [
    `${sha256(nativeBytes)}  ${nativeBytes.length}  libs/${abi}/libreader_core_napi.so`,
    `${sha256(indexBytes)}  ${indexBytes.length}  sdk/index.ts`,
    `${sha256(storageBytes)}  ${storageBytes.length}  storage-contract.v1.json`,
  ].join('\n') + '\n';
  const manifestPath = join(cacheDir, 'harmony-package-manifest.sha256');
  writeFileSync(manifestPath, manifestLines);

  const identityPath = join(cacheDir, 'core-build-identity.json');
  const identityBytes = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      gitCommit: coreCommit,
      gitDirty: false,
      rustProfile: 'release',
      buildId: 'c'.repeat(64),
      cargoLockSha256: 'd'.repeat(64),
      protocolSha256: 'e'.repeat(64),
    }),
  );
  writeFileSync(identityPath, identityBytes);

  const snapshotPath = join(cacheDir, 'core-input-snapshot.json');
  const snapshotBytes = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      fingerprint: coreInputFingerprint,
      files: [],
    }),
  );
  writeFileSync(snapshotPath, snapshotBytes);

  const evidencePath = join(cacheDir, 'harmony-napi-build-evidence.txt');
  const evidenceLines = [
    'name=reader-core-native-harmony-napi',
    `target=${rustTarget}`,
    'rust_profile=release',
    `ohos_arch=${abi}`,
    `artifact_sha256=${sha256(nativeBytes)}`,
    `artifact_bytes=${nativeBytes.length}`,
    `package_manifest_sha256=${sha256(Buffer.from(manifestLines))}`,
    `core_build_identity_sha256=${sha256(identityBytes)}`,
    `core_input_snapshot_sha256=${sha256(snapshotBytes)}`,
    `storage_contract_sha256=${sha256(storageBytes)}`,
  ].join('\n') + '\n';
  writeFileSync(evidencePath, evidenceLines);

  return { cacheDir, lockPath, abi, rustTarget, pkgDir, nativeBytes, storageBytes };
}

test('ci.yml pins actions, includes ready_for_review, withholds gate on draft PRs, and uses exact-key native cache', () => {
  assert.match(ciText, /pull_request:\s*\n\s*types:\s*\[opened,\s*synchronize,\s*reopened,\s*ready_for_review\]/);
  assert.match(ciText, /!github\.event\.pull_request\.draft/);
  assert.match(
    ciText,
    /name:\s*\$\{\{\s*github\.event_name == 'pull_request' && github\.base_ref == 'main' && !github\.event\.pull_request\.draft && 'harmonyos-ci-gate' \|\| 'harmonyos-ci-result'\s*\}\}/,
  );
  assert.match(ciText, /if:\s*matrix\.sdk == 'api26r' && github\.event_name != 'schedule'/);
  assert.match(ciText, /uses:\s*actions\/cache@[0-9a-f]{40}\b/);
  assert.match(
    ciText,
    /key:\s*harmony-core-native-v1-\$\{\{\s*matrix\.sdk\s*\}\}-\$\{\{\s*steps\.sdk\.outputs\.digest\s*\}\}-\$\{\{\s*steps\.core\.outputs\.commit\s*\}\}-\$\{\{\s*steps\.core\.outputs\.fingerprint\s*\}\}-\$\{\{\s*steps\.core\.outputs\.rust_toolchain\s*\}\}-\$\{\{\s*steps\.core\.outputs\.abi\s*\}\}/,
  );
  assert.doesNotMatch(ciText, /restore-keys:/);

  for (const match of ciText.matchAll(/uses:\s*([^\s]+)/g)) {
    const ref = match[1];
    if (!ref.startsWith('./')) {
      assert.match(ref, /^[\w./-]+@[0-9a-f]{40}$/, `Action must be pinned to a 40-hex commit SHA: ${ref}`);
    }
  }
});

test('harmonyos-ci-gate script enforces draft PR, ready PR, docs-only PR, and push rules', () => {
  // Draft PR skips trusted jobs and passes when host-fast-checks passes.
  assert.equal(
    runGateScript({ DRAFT_PR: 'true', CORE_FIXTURE_RESULT: 'skipped', BUILD_RESULT: 'skipped' }).status,
    0,
  );
  assert.notEqual(
    runGateScript({ DRAFT_PR: 'true', CORE_FIXTURE_RESULT: 'success', BUILD_RESULT: 'success' }).status,
    0,
  );
  assert.notEqual(
    runGateScript({ DRAFT_PR: 'true', HOST_RESULT: 'failure', CORE_FIXTURE_RESULT: 'skipped', BUILD_RESULT: 'skipped' }).status,
    0,
  );

  // Ready PR with code changes requires both host checks and trusted HAP build.
  assert.equal(runGateScript().status, 0);
  assert.notEqual(runGateScript({ BUILD_RESULT: 'skipped' }).status, 0);
  assert.notEqual(runGateScript({ CORE_FIXTURE_RESULT: 'failure' }).status, 0);

  // Docs-only PR skips trusted jobs.
  assert.equal(
    runGateScript({
      NON_DOCUMENT: 'false',
      SELECTED: '0',
      EXECUTED: '0',
      CORE_FIXTURE_RESULT: 'skipped',
      BUILD_RESULT: 'skipped',
    }).status,
    0,
  );

  // Push to main requires trusted jobs; feature branch push skips them.
  assert.equal(
    runGateScript({ GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main' }).status,
    0,
  );
  assert.equal(
    runGateScript({
      GITHUB_EVENT_NAME: 'push',
      GITHUB_REF: 'refs/heads/feat/example',
      CORE_FIXTURE_RESULT: 'skipped',
      BUILD_RESULT: 'skipped',
    }).status,
    0,
  );
});

test('build-unsigned-hap.sh passes bash syntax check', () => {
  execFileSync('bash', ['-n', buildScriptPath], { stdio: 'pipe' });
});

test('verifyCachedNativePackage validates exact lock/manifest/evidence and fails closed on tampering', async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'reader-native-cache-test-'));
  try {
    const valid = buildSyntheticCacheFixture(tempRoot);
    const verified = await verifyCachedNativePackage({
      cacheDir: valid.cacheDir,
      lockPath: valid.lockPath,
      abi: valid.abi,
      rustTarget: valid.rustTarget,
    });
    assert.equal(verified.coreCommit, 'a'.repeat(40));
    assert.equal(verified.coreInputFingerprint, 'b'.repeat(64));
    assert.equal(verified.nativeBytes, valid.nativeBytes.length);
    assert.equal(verified.packageFileCount, 3);

    // 1. Tampered native SO fails.
    const soPath = join(valid.pkgDir, 'libs', valid.abi, 'libreader_core_napi.so');
    writeFileSync(soPath, Buffer.from('tampered-so'));
    await assert.rejects(
      () => verifyCachedNativePackage({ cacheDir: valid.cacheDir, lockPath: valid.lockPath, abi: valid.abi, rustTarget: valid.rustTarget }),
      /mismatch/i,
    );
    writeFileSync(soPath, valid.nativeBytes);

    // 2. Unexpected extra file fails.
    const extraPath = join(valid.cacheDir, 'unexpected.txt');
    writeFileSync(extraPath, 'noise');
    await assert.rejects(
      () => verifyCachedNativePackage({ cacheDir: valid.cacheDir, lockPath: valid.lockPath, abi: valid.abi, rustTarget: valid.rustTarget }),
      /Unexpected entry/,
    );
    rmSync(extraPath);

    // 3. Symlink inside package fails.
    const linkPath = join(valid.pkgDir, 'evil-link');
    symlinkSync('/etc/passwd', linkPath);
    await assert.rejects(
      () => verifyCachedNativePackage({ cacheDir: valid.cacheDir, lockPath: valid.lockPath, abi: valid.abi, rustTarget: valid.rustTarget }),
      /symbolic links/,
    );
    rmSync(linkPath);

    // 4. Mismatched lock fingerprint fails.
    const lockObj = JSON.parse(readFileSync(valid.lockPath, 'utf8'));
    writeFileSync(valid.lockPath, JSON.stringify({ ...lockObj, coreInputFingerprint: 'f'.repeat(64) }));
    await assert.rejects(
      () => verifyCachedNativePackage({ cacheDir: valid.cacheDir, lockPath: valid.lockPath, abi: valid.abi, rustTarget: valid.rustTarget }),
      /fingerprint/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

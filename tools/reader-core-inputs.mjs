import { createHash } from 'node:crypto';
import { cpSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { coreSourceSnapshot } from '../../Reader-Core-Native/scripts/core-source-snapshot.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = resolve(ROOT, '../Reader-Core-Native');
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));

export function verifyCorePackage(core = CORE) {
  const base = resolve(core, 'target/harmony-napi/arm64-v8a');
  const snapshotFile = resolve(base, 'core-source-snapshot.json');
  const snapshot = json(snapshotFile);
  const current = coreSourceSnapshot(core);
  if (JSON.stringify(snapshot) !== JSON.stringify(current)) {
    throw new Error('Core source changed since native compilation; rebuild and sync Core');
  }
  const evidence = Object.fromEntries(readFileSync(resolve(base, 'harmony-napi-build-evidence.txt'), 'utf8')
    .trim().split('\n').map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
  const identityFile = resolve(base, 'core-build-identity.json');
  const identity = json(identityFile);
  const git = args => execFileSync('git', ['-C', core, ...args], { encoding: 'utf8' }).trim();
  if (identity.gitCommit !== git(['rev-parse', 'HEAD']) ||
      identity.gitDirty !== (git(['status', '--porcelain', '--untracked-files=normal']).length > 0)) {
    throw new Error('Core native build identity no longer matches the worktree');
  }
  if (evidence.core_source_snapshot_sha256 !== digest(snapshotFile) ||
      evidence.core_build_identity_sha256 !== digest(identityFile)) throw new Error('Core build evidence identity mismatch');
  const manifestFile = resolve(base, 'harmony-package-manifest.sha256');
  if (evidence.package_manifest_sha256 !== digest(manifestFile)) throw new Error('Core package manifest mismatch');
  const records = readFileSync(manifestFile, 'utf8').trim().split('\n').map(line => {
    const match = /^([0-9a-f]{64})  ([0-9]+)  (.+)$/.exec(line);
    if (!match || match[3].split('/').some(part => !part || part === '.' || part === '..') ||
        /[\\:\0]/.test(match[3])) throw new Error('Invalid Core package member');
    const path = match[3], full = resolve(base, 'package', path), bytes = readFileSync(full);
    if (digest(full) !== match[1] || bytes.length !== Number(match[2])) throw new Error(`Core package changed: ${path}`);
    return { path, sha256: match[1], bytes: bytes.length };
  });
  if (new Set(records.map(record => record.path)).size !== records.length) throw new Error('Duplicate Core package member');
  const native = records.find(record => record.path === 'libs/arm64-v8a/libreader_core_napi.so');
  if (!native || native.sha256 !== evidence.artifact_sha256 || String(native.bytes) !== evidence.artifact_bytes ||
      native.sha256 !== digest(resolve(base, 'libreader_core_napi.so'))) throw new Error('Core native evidence mismatch');
  return { base, snapshot, records, native, identity };
}

export function assertCoreInputs(core = CORE, app = ROOT) {
  const result = verifyCorePackage(core);
  for (const record of result.records) {
    if (digest(resolve(app, 'entry/vendor/core-harmony', record.path)) !== record.sha256) {
      throw new Error(`Vendored Core differs from verified package: ${record.path}; run sync-core`);
    }
  }
  if (digest(resolve(app, 'entry/libs/arm64-v8a/libreader_core_napi.so')) !== result.native.sha256) {
    throw new Error('Application Native differs from verified Core; run sync-core');
  }
  return { fingerprint: result.snapshot.fingerprint, fileCount: result.snapshot.fileCount,
    buildId: result.identity.buildId, nativeSha256: result.native.sha256 };
}

export function syncCoreInputs(core = CORE, app = ROOT) {
  const before = verifyCorePackage(core);
  // Only copy files named by the verified upstream package manifest. No deletion
  // of unrelated worktree files, and no compiler/build side effects in this step.
  for (const record of before.records) {
    const destination = resolve(app, 'entry/vendor/core-harmony', record.path);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(resolve(before.base, 'package', record.path), destination);
  }
  const destination = resolve(app, 'entry/libs/arm64-v8a/libreader_core_napi.so');
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(resolve(before.base, 'package', before.native.path), destination);
  return assertCoreInputs(core, app);
}

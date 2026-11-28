import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync,
  rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { acquireBuildLease, acquireBuildWorkspace } from '../../../Reader-Core/scripts/lib/build-resource-lock.mjs';
import { latestSignedRun } from '../lib/hap-mainline-provenance.mjs';
import { REPO_ROOT, fail, sha256Bytes } from './workspace-fingerprint.mjs';

export const DEFAULT_ARTIFACT_ROOT = resolve(REPO_ROOT, '.reader-artifacts/hap');
export const DEFAULT_RETAIN_RUNS = 10;
export const LOCK_ROOT = resolve(process.env.READER_LOCK_DIR || tmpdir());

function regularFile(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`retention refuses non-regular file: ${path}`);
  return stat;
}

function retentionJson(path) {
  if (regularFile(path).size > 16 * 1024 * 1024) fail(`retention metadata exceeds budget: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Pure inventory/decision; only manifest-owned HAP files can be selected. */
export function planHapRetention(root, keepRuns = DEFAULT_RETAIN_RUNS, reserve = 0) {
  root = resolve(root);
  if (!Number.isInteger(keepRuns) || keepRuns < 1 || keepRuns > 100 || ![0, 1].includes(reserve))
    fail('invalid HAP retention budget');
  const runs = [];
  const deployed = new Map();
  const protectedRuns = new Set();
  if (!existsSync(root)) return { root, keepRuns, reserve, retained: [], remove: [], bytes: 0 };
  if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) fail('retention root must be a real directory');
  const pinsPath = resolve(root, 'retention-pins.json');
  const pins = existsSync(pinsPath) ? retentionJson(pinsPath) : { runIds: [] };
  if (!Array.isArray(pins.runIds) || pins.runIds.some(id => typeof id !== 'string' || basename(id) !== id || id.startsWith('.')))
    fail('invalid retention-pins.json runIds');
  for (const id of pins.runIds) protectedRuns.add(id);
  for (const name of readdirSync(root)) {
    if (name.startsWith('.') || name === 'retention-pins.json') continue;
    const directory = resolve(root, name);
    const stat = lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`unrecognized artifact-root entry: ${name}`);
    const manifest = retentionJson(resolve(directory, 'manifest.json'));
    if (manifest.schemaVersion !== 2 || manifest.name !== 'reader-harmonyos-hap-run' || manifest.runId !== name ||
        !Array.isArray(manifest.artifacts) || !Number.isFinite(Date.parse(manifest.finishedAt)))
      fail(`invalid retention manifest: ${name}`);
    const files = [];
    const names = new Set();
    for (const artifact of manifest.artifacts) {
      if (!/^entry-default-(signed|unsigned)\.hap$/.test(artifact.path) || names.has(artifact.path) ||
          !/^[a-f0-9]{64}$/.test(artifact.sha256)) fail(`invalid retention artifact: ${name}`);
      names.add(artifact.path);
      const path = resolve(directory, artifact.path);
      if (existsSync(path)) files.push({ path, bytes: regularFile(path).size, sha256: artifact.sha256 });
    }
    // Unknown packages must be resolved by the owner rather than silently ignored.
    for (const entry of readdirSync(directory)) {
      if (entry.endsWith('.hap') && !names.has(entry)) fail(`unowned HAP in run: ${name}/${entry}`);
      if (/^retention-install-.*\.json$/.test(entry)) {
        const pin = retentionJson(resolve(directory, entry));
        if (pin.name !== 'reader-hap-install-protection' || pin.runId !== name)
          fail(`invalid incomplete-install protection: ${name}/${entry}`);
        protectedRuns.add(name);
      }
      if (!/^deploy-.*\.json$/.test(entry)) continue;
      const receipt = retentionJson(resolve(directory, entry));
      if (receipt.name !== 'reader-harmonyos-deployment-receipt' || receipt.runId !== name ||
          receipt.install !== 'PASS' || !Number.isFinite(Date.parse(receipt.completedAt)) ||
          typeof receipt.targetRef !== 'string' || !['vm', 'physical'].includes(receipt.targetKind))
        fail(`invalid deployment receipt: ${name}/${entry}`);
      const target = `${receipt.targetKind}:${receipt.targetRef}`;
      const history = deployed.get(target) ?? [];
      history.push({ runId: name, time: Date.parse(receipt.completedAt) });
      deployed.set(target, history);
    }
    runs.push({ runId: name, time: Date.parse(manifest.finishedAt), files });
  }
  // The two newest distinct successful deployments per target are the current
  // and rollback candidates. A receipt is historical evidence, not live state.
  for (const history of deployed.values()) {
    const ids = [...new Set(history.sort((a, b) => b.time - a.time || b.runId.localeCompare(a.runId)).map(row => row.runId))];
    for (const id of ids.slice(0, 2)) protectedRuns.add(id);
  }
  for (const id of pins.runIds) {
    if (!runs.some(run => run.runId === id && run.files.length > 0)) fail(`pinned recovery package is missing: ${id}`);
  }
  const available = runs.filter(run => run.files.length > 0);
  const latestCandidate = [...available].sort((a, b) => b.time - a.time || b.runId.localeCompare(a.runId))[0];
  if (latestCandidate) protectedRuns.add(latestCandidate.runId);
  const protectedAvailable = available.filter(run => protectedRuns.has(run.runId));
  if (protectedAvailable.length + reserve > keepRuns)
    fail(`HAP retention budget ${keepRuns} cannot fit ${protectedAvailable.length} protected runs plus ${reserve} new run; review pins/deployment recovery or raise --keep-runs`);
  const retained = new Set(protectedAvailable.map(run => run.runId));
  for (const run of available.sort((a, b) => b.time - a.time || b.runId.localeCompare(a.runId))) {
    if (retained.size < keepRuns - reserve) retained.add(run.runId);
  }
  const remove = available.filter(run => !retained.has(run.runId));
  return { root, keepRuns, reserve, retained: [...retained], remove,
    bytes: remove.reduce((sum, run) => sum + run.files.reduce((total, file) => total + file.bytes, 0), 0) };
}

/** Lock immutable runs, rather than an unrelated workspace's entire build. */
export function withHapRunLock(directory, action) {
  const canonical = realpathSync(directory);
  const lock = join(LOCK_ROOT,
    `reader-harmony-hap-run-${sha256Bytes(canonical)}.lock`);
  acquireLock(lock, { pid: process.pid, directory: canonical,
    startedAt: new Date().toISOString(), protocol: 'hap-run-lock-v1' }, false);
  try { return action(); } finally { rmSync(lock, { recursive: true, force: true }); }
}

function withHapRunLocks(directories, action, index = 0) {
  return index === directories.length ? action() :
    withHapRunLock(directories[index], () => withHapRunLocks(directories, action, index + 1));
}

/** Recheck the inventory and every byte under the same locks used by install. */
export function applyHapRetention(plan) {
  const directories = plan.remove.map(run => resolve(plan.root, run.runId)).sort();
  return withHapRunLocks(directories, () => applyLockedHapRetention(plan));
}

function applyLockedHapRetention(plan) {
  // Verify every candidate before deleting any file. Never trust arbitrary paths
  // passed back by a caller or a stale dry-run plan.
  const current = planHapRetention(plan.root, plan.keepRuns, plan.reserve);
  if (JSON.stringify(current) !== JSON.stringify(plan)) fail('HAP retention inventory changed; retry planning');
  for (const run of current.remove) for (const file of run.files) {
    if (sha256Bytes(readFileSync(file.path)) !== file.sha256) fail(`retention artifact hash changed: ${file.path}`);
  }
  for (const run of current.remove) {
    for (const file of run.files) rmSync(file.path);
    writeJson(resolve(current.root, run.runId, 'retention-receipt.json'), {
      schemaVersion: 1, name: 'reader-hap-retention-receipt', runId: run.runId,
      removedAt: new Date().toISOString(), keepRuns: current.keepRuns,
      artifacts: run.files.map(file => ({ path: basename(file.path), sha256: file.sha256, bytes: file.bytes })),
      packageAvailable: false, manifestAndEvidencePreserved: true,
    });
  }
  return { removedRuns: current.remove.map(run => run.runId), removedBytes: current.bytes };
}

export function withArtifactLock(action) {
  const lease = acquireBuildLease();
  try { return action(lease.env); } finally { lease.release(); }
}

export function latestPublishedSignedHap(abi, root = DEFAULT_ARTIFACT_ROOT) {
  const directory = resolve(root);
  if (!existsSync(directory)) return undefined;
  if (!lstatSync(directory).isDirectory()) fail('artifact root must be a real directory');
  const candidates = readdirSync(directory).filter(name => !name.startsWith('.') && name !== 'retention-pins.json').map(name => {
    const run = resolve(directory, name);
    if (!lstatSync(run).isDirectory()) fail(`invalid published run directory: ${name}`);
    const manifest = retentionJson(resolve(run, 'manifest.json'));
    if (manifest.schemaVersion !== 2 || manifest.name !== 'reader-harmonyos-hap-run' || manifest.runId !== name ||
        !Array.isArray(manifest.artifacts) || !Number.isFinite(Date.parse(manifest.finishedAt))) fail(`invalid published HAP manifest: ${name}`);
    return manifest;
  });
  const selected = latestSignedRun(candidates, abi);
  return selected ? { path: resolve(directory, selected.runId, 'manifest.json'), manifest: selected } : undefined;
}

export function acquireHapBuildWorkspace(abi, incremental) {
  if (!incremental) {
    return acquireBuildWorkspace({ create: () => mkdtempSync(join(tmpdir(), 'reader-hap-build-')),
      remove: path => rmSync(path, { recursive: true, force: true }) });
  }
  const lease = acquireBuildLease();
  const local = resolve(REPO_ROOT, '.reader-local');
  const caches = resolve(local, 'hap-incremental');
  const path = resolve(caches, abi);
  const lock = resolve(path, '.build-lock');
  try {
    for (const directory of [local, caches, path]) {
      if (!lstatSync(directory, { throwIfNoEntry: false })) mkdirSync(directory, { mode: 0o700 });
      const stat = lstatSync(directory);
      if (!stat.isDirectory() || (directory !== local && ((stat.mode & 0o077) !== 0 ||
          (process.getuid && stat.uid !== process.getuid())))) {
        fail('incremental HAP cache requires private, owner-controlled directories');
      }
    }
    const owner = { pid: process.pid, startedAt: new Date().toISOString(), protocol: 'hap-incremental-lock-v1' };
    try { acquireLock(lock, owner, false); }
    catch (error) {
      let previous;
      try { previous = JSON.parse(readFileSync(resolve(lock, 'owner.json'), 'utf8')); } catch { throw error; }
      if (previous.protocol !== owner.protocol || !Number.isInteger(previous.pid) || previous.pid < 1 || processExists(previous.pid)) throw error;
      // Serialize stale-owner recovery even for callers configured with
      // different resource lock roots or sharing an inherited build lease.
      const recovery = `${lock}.recovery`;
      acquireLock(recovery, owner, false);
      try { acquireLock(lock, owner); } finally { rmSync(recovery, { recursive: true }); }
    }
    return { path, env: lease.env, release() {
      try { rmSync(lock, { recursive: true }); } finally { lease.release(); }
    } };
  } catch (error) { lease.release(); throw error; }
}

export function timestampId() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    return true;
  }
}

export function acquireLock(lockDir, owner, reclaimStale = true) {
  mkdirSync(dirname(lockDir), { recursive: true });
  try {
    mkdirSync(lockDir);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const ownerPath = resolve(lockDir, 'owner.json');
    let previous = null;
    try {
      previous = JSON.parse(readFileSync(ownerPath, 'utf8'));
    } catch (_) {
      fail(`lock exists without a readable owner: ${lockDir}`);
    }
    if (!Number.isInteger(previous.pid) || processExists(previous.pid)) {
      fail(`lock is busy: ${lockDir}`);
    }
    // Concurrent run/target users cannot safely delete a dead owner's lock:
    // a second contender could remove the first contender's replacement.
    if (!reclaimStale) fail(`stale lock requires coordinated recovery: ${lockDir}`);
    rmSync(lockDir, { recursive: true, force: true });
    mkdirSync(lockDir);
  }
  writeJson(resolve(lockDir, 'owner.json'), owner);
}

export function latestHapInstallReceipt(directory, { targetKind, targetRef }) {
  if (!['vm', 'physical'].includes(targetKind) || !/^[a-f0-9]{12}$/.test(targetRef)) fail('invalid deployment receipt target');
  const prefix = `deploy-${targetKind}-${targetRef}-`;
  const receipts = readdirSync(directory).filter(file => file.startsWith(prefix) && file.endsWith('.json')).map(file => {
    const receipt = retentionJson(resolve(directory, file));
    if (!Number.isFinite(Date.parse(receipt.completedAt))) fail(`invalid receipt completion time: ${file}`);
    return { file, receipt };
  }).sort((left, right) => Date.parse(right.receipt.completedAt) - Date.parse(left.receipt.completedAt));
  if (receipts.length > 1 && Date.parse(receipts[0].receipt.completedAt) === Date.parse(receipts[1].receipt.completedAt)) {
    fail('ambiguous latest deployment receipt');
  }
  return receipts[0];
}

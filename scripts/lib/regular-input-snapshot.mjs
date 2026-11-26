import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readdirSync, readSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';

const CHUNK_BYTES = 1024 ** 2;
const MAX_WORKERS = 2;

function requireInput(condition, label, message) {
  if (!condition) throw new Error(label + ': ' + message);
}

const stat = path => lstatSync(path, { bigint: true, throwIfNoEntry: false });
const sameNode = (before, after) => after && after.dev === before.dev && after.ino === before.ino && after.mode === before.mode;
export const sameIdentity = (before, after) => sameNode(before, after) &&
  after.size === before.size && after.mtimeNs === before.mtimeNs && after.ctimeNs === before.ctimeNs;

function fileIdentity({ dev, ino, mode, size, mtimeNs, ctimeNs }) {
  return { dev, ino, mode, size, mtimeNs, ctimeNs };
}

function sealMatches(seal, current, recheckMembers = false) {
  if (seal.identity === undefined) return current === undefined;
  if (!sameNode(seal.identity, current)) return false;
  if (!seal.full || sameIdentity(seal.identity, current)) return true;
  if (!recheckMembers || !seal.members) return false;
  // Build tooling can touch directory timestamps after its task has returned.
  // Keep directory identity and membership sealed, and check file bytes through
  // each file's own identity seal.
  const members = readdirSync(seal.path).sort();
  return sameIdentity(current, stat(seal.path)) && members.length === seal.members.length &&
    members.every((name, index) => name === seal.members[index]);
}

function fileRecord(repo, path, before, buffer, label) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const assertCurrent = () => requireInput(sameIdentity(before, fstatSync(fd, { bigint: true })) &&
      sameIdentity(before, stat(path)), label, 'regular input changed while it was being read: ' + relative(repo, path));
    assertCurrent();
    requireInput(before.size <= BigInt(Number.MAX_SAFE_INTEGER), label, 'file exceeds the safe size range');
    const bytes = Number(before.size);
    const hash = createHash('sha256');
    for (let offset = 0; offset < bytes;) {
      const count = readSync(fd, buffer, 0, Math.min(buffer.length, bytes - offset), offset);
      requireInput(count > 0, label, 'file truncated while it was being read: ' + relative(repo, path));
      hash.update(buffer.subarray(0, count));
      offset += count;
    }
    assertCurrent();
    return { path: relative(repo, path), type: 'file', mode: Number(before.mode & 0o777n), bytes, sha256: hash.digest('hex') };
  } finally {
    closeSync(fd);
  }
}

function captureRegularInputSnapshot(repo, inputs, label = 'Build inputs', validatedDigests) {
  repo = resolve(repo);
  const records = [];
  const seals = new Map();
  const buffer = Buffer.allocUnsafe(CHUNK_BYTES);
  const root = stat(repo);
  requireInput(root?.isDirectory(), label, 'snapshot root must be a real directory');
  const recordSeal = (path, before, full, members) => {
    const previous = seals.get(path);
    requireInput(!previous || sealMatches(previous, before), label, 'snapshot input changed: ' + relative(repo, path));
    if (!previous || (!previous.full && full)) {
      seals.set(path, { path, identity: before && fileIdentity(before), full, members });
    }
  };
  recordSeal(repo, root, false);
  const visit = (path, before) => {
    if (before.isDirectory()) {
      const members = readdirSync(path).sort();
      recordSeal(path, before, true, members);
      for (const name of members) {
        const child = resolve(path, name);
        const childStat = stat(child);
        requireInput(childStat, label, 'directory entry disappeared while taking the snapshot: ' + relative(repo, child));
        visit(child, childStat);
      }
      requireInput(sameIdentity(before, stat(path)), label, 'directory changed while taking the snapshot: ' + relative(repo, path));
    } else {
      requireInput(before.isFile(), label, 'snapshot inputs must contain only regular files and real directories: ' + relative(repo, path));
      recordSeal(path, before, true);
      const cached = validatedDigests?.get(path);
      if (cached && sameIdentity(cached.stat, before)) {
        records.push({ path: relative(repo, path), type: 'file', mode: Number(before.mode & 0o777n),
          bytes: Number(before.size), sha256: cached.sha256 });
        requireInput(sameIdentity(before, stat(path)), label, 'regular input changed while verifying the cached digest: ' + relative(repo, path));
      } else {
        records.push(fileRecord(repo, path, before, buffer, label));
      }
    }
  };
  for (const input of inputs) {
    const path = resolve(repo, input);
    const local = relative(repo, path);
    requireInput(local !== '..' && !local.startsWith('..' + sep) && !isAbsolute(local), label, 'input escapes the snapshot root');
    const ancestors = [[repo, root]];
    const parents = [];
    for (let parent = dirname(path); path !== repo && parent !== repo; parent = dirname(parent)) parents.push(parent);
    for (const parent of parents.reverse()) {
      const before = stat(parent);
      requireInput(!before || before.isDirectory(), label, 'snapshot input ancestor must be a real directory: ' + relative(repo, parent));
      ancestors.push([parent, before]);
      recordSeal(parent, before, false);
    }
    const before = stat(path);
    if (before) visit(path, before);
    else {
      recordSeal(path, undefined, true);
      requireInput(!stat(path), label, 'missing input appeared while taking the snapshot: ' + local);
    }
    for (const [parent, captured] of ancestors) {
      const current = stat(parent);
      requireInput(captured ? sameNode(captured, current) : !current,
        label, 'snapshot input ancestor changed: ' + relative(repo, parent));
    }
  }
  records.sort((left, right) => left.path.localeCompare(right.path));
  return { snapshot: snapshotFileRecords(records, inputs), seals: [...seals.values()], repo, label };
}

export function snapshotFileRecords(files, inputs) {
  const hash = createHash('sha256');
  for (const record of files) hash.update(JSON.stringify(record) + '\n');
  return { schemaVersion: 1, inputs, fileCount: files.length, fingerprint: hash.digest('hex'), files };
}

export function regularInputSnapshot(repo, inputs, label, validatedDigests) {
  return captureRegularInputSnapshot(repo, inputs, label, validatedDigests).snapshot;
}

/** Schedule one or two independent snapshots while the owning process performs other build checks. */
export function startRegularInputSnapshots(requests) {
  if (!Array.isArray(requests) || requests.length < 1 || requests.length > MAX_WORKERS) {
    throw new Error('Expected one or two regular input snapshots');
  }
  const workers = [];
  try {
    const tasks = requests.map(({ repo, inputs, label }) => {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: { readerSnapshotWorker: true, repo: resolve(repo), inputs, label },
      });
      workers.push(worker);
      const task = new Promise((resolveResult, reject) => {
        worker.once('message', resolveResult);
        worker.once('error', reject);
        worker.once('exit', code => reject(new Error('Snapshot worker exited without a result (' + code + ')')));
      });
      task.catch(() => {});
      return task;
    });
    let captured;
    const result = Promise.all(tasks).then(results => {
      captured = results;
      return results.map(({ snapshot }) => snapshot);
    });
    // The caller may launch a synchronous signer before awaiting the workers.
    result.catch(() => {});
    return {
      result,
      timingsMs() { return captured.map(({ milliseconds }) => milliseconds); },
      assertUnchanged() {
        if (!captured) throw new Error('Snapshot results must be awaited before checking their input identities');
        for (const { seals, repo, label } of captured) for (const seal of seals) {
          requireInput(sealMatches(seal, stat(seal.path), true), label, 'snapshot input changed before publication: ' + relative(repo, seal.path));
        }
      },
      async stop() { await Promise.allSettled(workers.map(worker => worker.terminate())); },
    };
  } catch (error) {
    // A worker that already started must not continue after partial setup fails.
    for (const worker of workers) void worker.terminate().catch(() => {});
    throw error;
  }
}

if (!isMainThread && workerData?.readerSnapshotWorker) {
  const started = performance.now();
  const captured = captureRegularInputSnapshot(workerData.repo, workerData.inputs, workerData.label);
  parentPort.postMessage({ ...captured, milliseconds: performance.now() - started });
}

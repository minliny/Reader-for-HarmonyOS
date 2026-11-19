// Fixed production collector: official bundle sandbox, stopped application UID,
// complete DB/WAL/SHM bytes, then the candidate's compiled read-only inspector.
// There is deliberately no CLI argument for an externally asserted PASS JSON.
import { randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { portableSpawnSync, resolveHarmonyTool } from './harmony-toolchain.mjs';
import { storageSha256 as sha } from '../../../Reader-Core/scripts/storage-build-contract.mjs';
import { verifyStorageInspector } from '../../../Reader-Core/scripts/storage-inspector-identity.mjs';
import { installedStorageIdentity } from './storage-deployment-admission.mjs';
import { assertSameTargetBoot } from './hap-delivery-evidence.mjs';

const hostRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const coreRoot = resolve(hostRoot, '../Reader-Core');
const storageRoot = 'data/storage/el2/base/haps/entry/files/reader-core';
const names = ['reader-core.sqlite3', 'reader-core.sqlite3-wal', 'reader-core.sqlite3-shm', 'storage-meta.json', 'reader-core.sqlite3-journal'];
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const json = value => JSON.stringify(value);
const errorText = /Permission denied|No such file|Connect server failed|Device not found|No devices|\berror:|\bfailed\b/i;
function successful(result, label) {
  const output = `${result.stdout ?? ''}`;
  if (result.error || result.status !== 0 || result.stderr?.trim() || errorText.test(output)) throw new Error(`${label} did not complete with verified output`);
  return output;
}
function localCommand(program, args, label) {
  const result = portableSpawnSync(program, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    timeout: 120000, killSignal: 'SIGKILL', cwd: hostRoot });
  if (result.status !== 0) {
    let refused;
    try { refused = JSON.parse(result.stdout); } catch { /* Preserve non-JSON process failure below. */ }
    if (refused?.format === 'reader.storage-observation' && typeof refused.error === 'string') throw new Error(`${label}: ${refused.error}`);
  }
  return successful(result, label);
}
function localRecord(path) {
  if (!lstatSync(path).isFile()) throw new Error('storage transferred input must be a regular file');
  const bytes = readFileSync(path);
  return { bytes: bytes.length, sha256: sha(bytes) };
}
function checkedShell(context, command, sandbox = false) {
  const sentinel = `READER_STORAGE_OK_${randomUUID().replaceAll('-', '')}`;
  const guarded = `set -e; ${command}; printf '\\n${sentinel}\\n'`;
  const result = sandbox ? context.runHdc(['-t', context.target, 'shell', '-b', context.bundleName, guarded], { timeoutMs: 30000 }) :
    context.query(guarded, { timeoutMs: 30000 });
  const output = successful(result, 'official storage shell');
  const marker = `\n${sentinel}\n`;
  if (!output.endsWith(marker)) throw new Error('storage shell did not return its success sentinel');
  return output.slice(0, -marker.length).trim();
}
export function parseStorageBundleDetails(output, bundleName) {
  const value = JSON.parse(output.slice(output.indexOf('{')));
  const uid = value.applicationInfo?.uid;
  if ((value.name ?? value.bundleName) !== bundleName || !Number.isSafeInteger(uid) || uid <= 0) throw new Error('installed application UID is unavailable');
  return { uid, metadataSha256: sha(json(value)), value };
}
function bundleDetails(context) {
  const output = successful(context.query(`bm dump -n ${context.bundleName}`, { timeoutMs: 30000 }), 'installed bundle metadata');
  return parseStorageBundleDetails(output, context.bundleName);
}
export function assertStorageProcessInventory(output, uid) {
  if (!Number.isSafeInteger(uid) || uid <= 0) throw new Error('application UID is not established');
  const rows = output.split(/\r?\n/);
  if (!/^\s*UID\s+PID\s+PPID\s+NAME\s*$/.test(rows.shift() ?? '') || rows.length === 0 ||
      rows.some(row => !/^\s*\d+\s+\d+\s+\d+\s+.+$/.test(row))) throw new Error('complete application process inventory is unavailable');
  if (rows.some(row => Number(row.trim().split(/\s+/)[0]) === uid)) throw new Error('application UID still has a writer process; no storage admission');
}
function requireStopped(context, uid) {
  assertStorageProcessInventory(checkedShell(context, 'ps -A -o UID,PID,PPID,NAME'), uid);
}
export function parseStorageFileObservation(output) {
  const lines = output.split(/\r?\n/);
  if (lines.length !== names.length) throw new Error('storage file observation is incomplete');
  const records = names.map((name, index) => {
    if (lines[index] === `MISSING ${name}`) return { name, sha256: null };
    const match = /^([a-f0-9]{64})\s+(.+)$/.exec(lines[index]);
    if (!match || match[2] !== `${storageRoot}/${name}`) throw new Error('storage file identity response is invalid');
    return { name, sha256: match[1] };
  });
  if (records.at(-1).sha256 !== null) throw new Error('SQLite rollback journal needs a separately supported consistent snapshot path');
  return records;
}
export function assertStorageFilesUnchanged(expected, observed) {
  if (json(observed) !== json(expected)) throw new Error('device DB/WAL/SHM/sidecar changed after storage admission');
}
function deviceFiles(context) {
  const output = checkedShell(context, `test -d ${quote(storageRoot)}; test ! -L ${quote(storageRoot)}; ` +
    names.map(name => { const path = `${storageRoot}/${name}`; return `if test -e ${quote(path)}; then test -f ${quote(path)}; test ! -L ${quote(path)}; sha256sum ${quote(path)}; else printf 'MISSING ${name}\\n'; fi`; }).join('; '), true);
  return parseStorageFileObservation(output);
}
function probeCopy(inspector, database) {
  const output = localCommand(inspector.binaryPath, [dirname(database)], 'candidate Core storage inspector');
  const observed = JSON.parse(output);
  const admission = observed.admission;
  if (observed.format !== 'reader.storage-observation' || observed.version !== 1 || observed.admitted !== true ||
      admission?.freshStorage !== false || typeof admission.requiresMigration !== 'boolean' ||
      (admission.requiresMigration ? admission.layout !== null || !admission.explicitMigration : !admission.layout || admission.explicitMigration !== null)) throw new Error('candidate Core storage admission is incomplete');
  return admission;
}

export function collectStorageDeviceEvidence(context) {
  if (context.bundleName !== 'io.reader.minliny' || !context.installed?.bundlePresent) throw new Error('a readable installed Reader sandbox is required to establish retained storage facts');
  // Missing/stale tools fail before stopping the application or acquiring data.
  const inspector = verifyStorageInspector(resolve(coreRoot, process.env.CARGO_TARGET_DIR || 'target', 'storage-inspector'), context.candidate);
  const python = resolveHarmonyTool('python', { cwd: hostRoot });
  const bundle = bundleDetails(context);
  if (context.mode === 'install') {
    const stopped = successful(context.query(`aa force-stop ${context.bundleName}`, { timeoutMs: 30000 }), 'application force-stop');
    if (!/force stop process successfully\./.test(stopped)) throw new Error('application stop was not acknowledged');
  }
  requireStopped(context, bundle.uid);
  const before = deviceFiles(context);
  if (before[0].sha256 === null) throw new Error('no database found; missing or empty storage has not been proven by this collector');
  const directory = resolve(hostRoot, '.reader-local/storage-deployment', randomUUID());
  const raw = resolve(directory, 'raw');
  mkdirSync(raw, { recursive: true, mode: 0o700 });
  try {
  const records = [];
  for (const source of before.filter(row => row.sha256 !== null)) {
    const destination = resolve(raw, source.name);
    const output = successful(context.runHdc(['-t', context.target, 'file', 'recv', '-b', context.bundleName,
      `${storageRoot}/${source.name}`, destination], { timeoutMs: 120000 }), 'official sandbox transfer');
    if (!/FileTransfer finish,.*File count = 1\b/.test(output)) throw new Error('sandbox transfer has no complete-file receipt');
    const actual = localRecord(destination);
    if (actual.sha256 !== source.sha256) throw new Error('transferred storage bytes do not match the stopped application');
    records.push({ name: source.name, ...actual });
  }
  requireStopped(context, bundle.uid);
  assertStorageFilesUnchanged(before, deviceFiles(context));
  const snapshotOutput = localCommand(python, [resolve(hostRoot, 'scripts/lib/storage-snapshot.py'), raw, resolve(directory, 'analysis')], 'SQLite consistent snapshot');
  const backup = JSON.parse(snapshotOutput);
  if (backup.format !== 'reader.storage-snapshot' || backup.version !== 1 || backup.quickCheck !== 'ok' ||
      json([...backup.rawFiles].sort((a, b) => a.name.localeCompare(b.name))) !== json([...records].sort((a, b) => a.name.localeCompare(b.name)))) throw new Error('consistent storage backup receipt does not bind the transferred files');
  const database = resolve(directory, 'analysis/admission/reader-core.sqlite3');
  if (localRecord(database).sha256 !== backup.logical?.sha256) throw new Error('logical storage backup changed');
  const sidecar = resolve(directory, 'analysis/admission/storage-meta.json');
  const sourceSidecar = before.find(record => record.name === 'storage-meta.json');
  if (sourceSidecar.sha256 !== null && localRecord(sidecar).sha256 !== sourceSidecar.sha256) throw new Error('storage admission sidecar is not the captured source');
  const observation = probeCopy(inspector, database);
  const layout = observation.layout === null ? null : { ...observation.layout, dataFormatGeneration: observation.observedDataFormatGeneration };
  const backupBytes = JSON.stringify(backup, null, 2) + '\n';
  writeFileSync(resolve(directory, 'backup.json'), backupBytes, { flag: 'wx', mode: 0o600 });
  const binding = { serverKey: context.serverKey, target: context.target, bootIdSha256: context.bootIdSha256,
    bundleName: context.bundleName, installedIdentitySha256: context.installedIdentitySha256 };
  const manifest = { format: 'reader.storage-device-snapshot', version: 1, binding, readiness: context.initialReadiness, uid: bundle.uid,
    files: before, transferred: records, logicalSha256: backup.logical.sha256,
    inspector: inspector.identity, layout, storageObservation: observation, candidateHapSha256: context.candidate.hapSha256 };
  const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
  writeFileSync(resolve(directory, 'snapshot.json'), manifestBytes, { flag: 'wx', mode: 0o600 });
  const facts = { binding, barrier: { kind: 'stopped-application-uid-and-frozen-files', held: context.mode === 'install',
      tokenSha256: sha(`${randomUUID()}:${bundle.uid}:${json(before)}`) },
    snapshot: { manifestSha256: sha(manifestBytes), databaseSha256: before[0].sha256,
      walSha256: before[1].sha256, backupReceiptSha256: sha(backupBytes) }, layout,
    dataFormatGeneration: observation.observedDataFormatGeneration,
    requiresMigration: observation.requiresMigration, explicitMigration: observation.explicitMigration };
  let active = true;
  return { facts, recovery: { directory, snapshot: 'snapshot.json', backup: 'backup.json' },
    revalidate() {
      if (!active) throw new Error('storage collector was released');
      const current = context.observeInstalled();
      if (installedStorageIdentity(current) !== context.installedIdentitySha256 || bundleDetails(context).metadataSha256 !== bundle.metadataSha256) throw new Error('installed application changed during storage admission');
      assertSameTargetBoot(context.initialReadiness, context.observeReadiness());
      requireStopped(context, bundle.uid);
      assertStorageFilesUnchanged(before, deviceFiles(context));
      if (localRecord(resolve(directory, 'snapshot.json')).sha256 !== facts.snapshot.manifestSha256 ||
          localRecord(resolve(directory, 'backup.json')).sha256 !== facts.snapshot.backupReceiptSha256 ||
          records.some(record => localRecord(resolve(raw, record.name)).sha256 !== record.sha256) ||
          (sourceSidecar.sha256 !== null && localRecord(sidecar).sha256 !== sourceSidecar.sha256) ||
          localRecord(database).sha256 !== backup.logical.sha256) throw new Error('retained storage recovery bytes changed');
      return facts;
    },
    // Do not restart an old application on failure or kill the newly launched
    // application after success. The pipeline releases its own server lease.
    release() { active = false; },
  };
  } catch (error) {
    throw new Error(`${error.message}; retained storage evidence: ${directory}`, { cause: error });
  }
}

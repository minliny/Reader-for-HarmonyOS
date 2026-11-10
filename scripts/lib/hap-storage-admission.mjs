import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const MARKER = Buffer.from('READER_SQLITE_COMPAT_V1:');

function validStorageCompatibility(value) {
  return Number.isSafeInteger(value?.sqliteMaxUserVersion) && value.sqliteMaxUserVersion > 0 &&
    value.sqliteMaxUserVersion <= 0x7fffffff && typeof value.sqliteStorageSourceSha256 === 'string' &&
    /^[0-9a-f]{64}$/.test(value.sqliteStorageSourceSha256);
}

// Read only the compiled marker from the verified HAP entry. A missing,
// ambiguous or malformed marker cannot establish candidate compatibility.
export function embeddedStorageCompatibility(bytes) {
  const start = bytes.indexOf(MARKER);
  if (start < 0 || bytes.indexOf(MARKER, start + MARKER.length) >= 0) return null;
  const value = bytes.subarray(start + MARKER.length, start + MARKER.length + 76).toString('latin1');
  const match = /^(\d{1,10}):([0-9a-f]{64})\0/.exec(value);
  if (!match) return null;
  const compatibility = { sqliteMaxUserVersion: Number(match[1]), sqliteStorageSourceSha256: match[2] };
  return validStorageCompatibility(compatibility) ? compatibility : null;
}

export function readInstalledSqliteVersion({ bundleName, uid, querySandbox }) {
  if (!/^[A-Za-z][A-Za-z0-9_.]+$/.test(bundleName) || !Number.isSafeInteger(uid) || uid <= 0) return null;
  const cwd = /^\/mnt\/debug\/(0|[1-9]\d*)\/debug_hap\/([A-Za-z][A-Za-z0-9_.]+)$/.exec(querySandbox('pwd').trim());
  if (!cwd || cwd[2] !== bundleName) return null;
  const directory = `/data/app/el2/${cwd[1]}/base/${bundleName}/haps/entry/files/reader-core`;
  const db = `${directory}/reader-core.sqlite3`;
  // A shell-owned read-only SQLite connection can still create WAL/SHM files
  // beside an app's DB. Read only the header and reject an active WAL or journal.
  const noJournal = `test ! -s ${db}-wal && test ! -s ${db}-journal`;
  const stat = `stat -c '%u:%i:%s:%Y' ${db}`;
  const output = querySandbox(`test -r ${directory} && test -x ${directory} && ${noJournal} && ${stat} && ` +
    `od -An -v -N 100 -t u1 ${db} && ${noJournal} && ${stat}`);
  const lines = output.trim().split(/\r?\n/);
  const metadata = /^(\d+):\d+:([1-9]\d*):\d+$/.exec(lines[0]);
  if (!metadata || Number(metadata[1]) !== uid || Number(metadata[2]) < 100 || lines[0] !== lines.at(-1)) return null;
  const fields = lines.slice(1, -1).join(' ').trim().split(/\s+/);
  if (fields.length !== 100 || fields.some(field => !/^\d{1,3}$/.test(field) || Number(field) > 255)) return null;
  const header = Buffer.from(fields.map(Number));
  if (header.subarray(0, 16).toString('latin1') !== 'SQLite format 3\0') return null;
  const version = header.readUInt32BE(60);
  return Number.isSafeInteger(version) && version > 0 && version <= 0x7fffffff ? version : null;
}

export function readInstalledStorageLineage({ bundleName, query }) {
  if (!/^[A-Za-z][A-Za-z0-9_.]+$/.test(bundleName)) return null;
  const pidCommand = `pidof ${bundleName}`;
  const pid = query(pidCommand).trim();
  if (!/^[1-9]\d*$/.test(pid)) return null;
  const log = query(`hilog -x -P ${pid} -T Reader`);
  if (query(pidCommand).trim() !== pid) return null;
  let storage = null;
  let published = false;
  for (const line of log.split(/\r?\n/)) {
    const identity = /\/Reader: Core build identity: (\{.+\})$/.exec(line);
    const event = /\/Reader: READER_STARTUP (\{.+\})$/.exec(line);
    try {
      if (identity) {
        const data = JSON.parse(identity[1]);
        storage = data.schemaVersion === 1 && /^[0-9a-f]{64}$/.test(data.buildId ?? '') &&
          validStorageCompatibility(data.storageCompatibility) ? { ...data.storageCompatibility,
            sqliteUserVersion: Number.isSafeInteger(data.sqliteUserVersion) && data.sqliteUserVersion > 0 &&
              data.sqliteUserVersion <= data.storageCompatibility.sqliteMaxUserVersion ? data.sqliteUserVersion : null } : null;
        published = false;
      } else if (event) {
        const data = JSON.parse(event[1]);
        if (data.stage === 'startup.native-open') {
          storage = null;
          published = false;
        } else if (data.stage === 'startup.runtime-published') {
          published = data.status === 'ready';
        }
      }
    } catch {
      return null;
    }
  }
  return published ? storage : null;
}

export function storageUpdateRoute({ targetSqliteVersion, installedStorage, candidateStorage, transition, candidateNativeSha256, candidateHapSha256 }) {
  if (!Number.isSafeInteger(targetSqliteVersion) || targetSqliteVersion <= 0) {
    return { allowed: false, reason: 'target-sqlite-version-unresolved' };
  }
  if (!validStorageCompatibility(candidateStorage)) {
    return { allowed: false, reason: 'candidate-native-storage-identity-unresolved' };
  }
  if (targetSqliteVersion > candidateStorage.sqliteMaxUserVersion) {
    return { allowed: false, reason: 'candidate-core-cannot-open-target-sqlite' };
  }
  const verifiedTransition = transitionBindings.get(transition);
  if (verifiedTransition?.bound && targetSqliteVersion === 47 &&
      verifiedTransition.expected.nativeSha256 === candidateNativeSha256 &&
      verifiedTransition.expected.hapSha256 === candidateHapSha256 &&
      equalJson(verifiedTransition.expected.storageCompatibility, candidateStorage)) {
    return { allowed: true, reason: 'verified-directed-storage-transition' };
  }
  if (!validStorageCompatibility(installedStorage) || targetSqliteVersion > installedStorage.sqliteMaxUserVersion) {
    return { allowed: false, reason: 'installed-core-storage-lineage-unresolved' };
  }
  if (installedStorage.sqliteStorageSourceSha256 !== candidateStorage.sqliteStorageSourceSha256 ||
      installedStorage.sqliteMaxUserVersion !== candidateStorage.sqliteMaxUserVersion) {
    return { allowed: false, reason: 'core-storage-lineage-changed' };
  }
  return { allowed: true, reason: 'verified-same-storage-lineage' };
}

// This is one reviewed compatibility edge, not a numeric schema allowlist.
export const STORAGE_TRANSITION_CONTRACT = 'reader-library47-compatible-open-v1';
export const LIBRARY47_OBJECT_SET_SHA256 = '0f6c1a16e758e4b85d2b974ca7a8d972982a64755f3cc1b5e561576aa19146b8';
export const STORAGE_TRANSITION_CASES = Object.freeze([
  'format-admission', 'formal-runtime-bootstrap', 'l0-writer-preservation', 'cold-reopen', 'whole-snapshot-rejection',
]);
const transitionBindings = new WeakMap();
const HASH = /^[0-9a-f]{64}$/;
const MAX_EVIDENCE_BYTES = 16 * 1024 * 1024;
const equalJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');
const reject = field => { throw new Error(`storage transition evidence rejected: ${field}`); };
const expect = (condition, field) => { if (!condition) reject(field); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names, field) => expect(record(value) && Object.keys(value).every(k => names.includes(k)), field);
const digest = (value, field) => expect(typeof value === 'string' && HASH.test(value), field);
const resourcePath = value => typeof value === 'string' && /^[A-Za-z0-9_./-]+$/.test(value) &&
  value.split('/').every(part => part !== '' && part !== '.' && part !== '..');

function sourceFiles(value, field) {
  expect(Array.isArray(value) && value.length >= 1 && value.length <= 2, field);
  const names = new Set();
  for (const file of value) {
    keys(file, ['name', 'bytes', 'sha256'], field);
    expect(['reader-core.sqlite3', 'reader-core.sqlite3-wal'].includes(file.name) && !names.has(file.name), field);
    names.add(file.name);
    expect(Number.isSafeInteger(file.bytes) && file.bytes >= (file.name === 'reader-core.sqlite3' ? 100 : 0), field);
    digest(file.sha256, field);
  }
  expect(names.has('reader-core.sqlite3'), field);
  return value.map(file => ({ name: file.name, bytes: file.bytes, sha256: file.sha256 })).sort((a, b) => a.name.localeCompare(b.name));
}

// readResource is supplied by the on-disk loader (or controlled metadata fixtures).
// A raw object or a caller-written `allowed: true` never enters the update route.
export function validateStorageTransitionProof(receipt, expected, readResource, receiptSha256) {
  keys(receipt, ['schemaVersion', 'name', 'transition', 'generatedAt', 'from', 'to', 'evidence', 'evidenceBoundary'], 'receipt');
  expect(receipt.schemaVersion === 1 && receipt.name === 'reader-storage-transition' &&
    receipt.transition === STORAGE_TRANSITION_CONTRACT, 'contract');
  digest(receiptSha256, 'receiptSha256');
  const from = receipt.from, to = receipt.to;
  keys(from, ['targetRef', 'targetKind', 'bundleName', 'uid', 'appIdSha256', 'appIdentifierSha256', 'updateTime',
    'abi', 'sqliteUserVersion', 'layoutObjectSetSha256', 'snapshot'], 'from');
  expect(/^[0-9a-f]{12}$/.test(from.targetRef ?? '') && ['vm', 'physical'].includes(from.targetKind) &&
    from.bundleName === 'io.reader.minliny' && Number.isSafeInteger(from.uid) && from.uid > 0 &&
    Number.isSafeInteger(from.updateTime) && from.updateTime > 0 && from.abi === 'x86_64', 'from identity');
  for (const field of ['appIdSha256', 'appIdentifierSha256']) {
    expect(from[field] === '' || (typeof from[field] === 'string' && HASH.test(from[field])), `from.${field}`);
  }
  expect(Boolean(from.appIdSha256 || from.appIdentifierSha256), 'from signing identity');
  expect(from.sqliteUserVersion === 47 && from.layoutObjectSetSha256 === LIBRARY47_OBJECT_SET_SHA256, 'directed source contract');
  const snapshotFiles = sourceFiles(from.snapshot, 'from.snapshot');
  const toFields = ['runId', 'manifestSha256', 'hapSha256', 'nativeSha256', 'abi', 'coreBuildId',
    'coreInputFingerprint', 'protocolSha256', 'storageCompatibility', 'controllerFingerprint'];
  keys(to, toFields, 'to');
  expect(typeof to.runId === 'string' && to.runId.length > 0 && toFields.every(field => equalJson(to[field], expected[field])), 'candidate identity');
  expect(validStorageCompatibility(to.storageCompatibility) && to.storageCompatibility.sqliteMaxUserVersion === 47 &&
    to.abi === from.abi, 'candidate support/direction');
  for (const field of ['manifestSha256', 'hapSha256', 'nativeSha256', 'coreBuildId', 'coreInputFingerprint', 'protocolSha256', 'controllerFingerprint']) digest(to[field], `to.${field}`);
  const boundary = receipt.evidenceBoundary;
  keys(boundary, ['sourceRuntime', 'nativeBuild', 'targetInteraction'], 'evidenceBoundary');
  expect(boundary.sourceRuntime === 'PASS' && boundary.nativeBuild === 'PASS' && boundary.targetInteraction === 'NOT_RUN', 'evidence layer');
  const evidence = receipt.evidence;
  keys(evidence, ['coreInputSnapshot', 'validation', 'definitions', 'logs'], 'evidence');
  expect(Array.isArray(evidence.definitions) && evidence.definitions.length > 0 &&
    Array.isArray(evidence.logs) && evidence.logs.length > 0, 'definitions/logs');
  const resources = new Map();
  const read = (descriptor, label) => {
    keys(descriptor, ['path', 'sourcePath', 'bytes', 'sha256'], label);
    expect(resourcePath(descriptor.path) && descriptor.path !== 'receipt.json' && Number.isSafeInteger(descriptor.bytes) &&
      descriptor.bytes > 0 && descriptor.bytes <= MAX_EVIDENCE_BYTES, label);
    digest(descriptor.sha256, label);
    const bytes = Buffer.from(readResource(descriptor.path));
    expect(bytes.length === descriptor.bytes && hashBytes(bytes) === descriptor.sha256, `${label} bytes`);
    const previous = resources.get(descriptor.path);
    expect(!previous || previous.sha256 === descriptor.sha256, `${label} collision`);
    resources.set(descriptor.path, { path: descriptor.path, sha256: descriptor.sha256, bytes });
    return bytes;
  };
  const inputBytes = read(evidence.coreInputSnapshot, 'Core input snapshot');
  expect(evidence.coreInputSnapshot.sha256 === expected.coreInputSnapshotSha256 &&
    evidence.coreInputSnapshot.bytes === expected.coreInputSnapshotBytes, 'published Core snapshot identity');
  const inputs = JSON.parse(inputBytes);
  expect(inputs.schemaVersion === 1 && inputs.fingerprint === to.coreInputFingerprint && Array.isArray(inputs.files), 'Core input fingerprint');
  const inputFiles = new Map(inputs.files.map(file => [file.path, file]));
  const definitions = new Map(), definitionBodies = new Map();
  for (const definition of evidence.definitions) {
    const definitionBytes = read(definition, 'definition');
    const original = inputFiles.get(definition.sourcePath);
    expect(resourcePath(definition.sourcePath) && /^crates\/reader-(?:ffi|runtime|storage)\/.+\.rs$/.test(definition.sourcePath) &&
      original?.type === 'file' && original.bytes === definition.bytes &&
      original.sha256 === definition.sha256 && !definitions.has(definition.sourcePath), 'recorded Core definition identity');
    definitions.set(definition.sourcePath, definition);
    definitionBodies.set(definition.sourcePath, definitionBytes.toString('utf8'));
  }
  const logs = new Map();
  for (const log of evidence.logs) {
    expect(log.path?.endsWith('.log') && !logs.has(log.path), 'log identity');
    logs.set(log.path, read(log, 'execution log').toString('utf8').replace(/\x1b\[[0-9;]*m/g, ''));
  }
  const validation = JSON.parse(read(evidence.validation, 'validation'));
  expect(validation.schemaVersion === 1 && validation.name === 'reader-library47-validation' && validation.status === 'PASS' &&
    validation.coreInputFingerprint === to.coreInputFingerprint && validation.protocolSha256 === to.protocolSha256 &&
    validation.storageSourceSha256 === to.storageCompatibility.sqliteStorageSourceSha256 &&
    validation.layoutObjectSetSha256 === from.layoutObjectSetSha256 && validation.sqliteUserVersion === 47 &&
    validation.constructor === 'rc_runtime_create' &&
    equalJson(sourceFiles(validation.sourceSnapshot, 'validation.sourceSnapshot'), snapshotFiles), 'validation source');
  const flags = ['formalPersistentConstructor', 'sourceCopiesUnchanged', 'schemaObjectsUnchanged', 'userVersionUnchanged',
    'unrelatedFactsPreserved', 'originalUnknownIntentUntouched', 'coldReopenSucceeded', 'wholeSnapshotRejectedBeforeWrite'];
  expect(record(validation.preservation) && flags.every(flag => validation.preservation[flag] === true), 'preservation assertions');
  expect(Array.isArray(validation.cases) && validation.cases.length === STORAGE_TRANSITION_CASES.length, 'finite selected cases');
  const cases = new Set();
  for (const result of validation.cases) {
    expect(STORAGE_TRANSITION_CASES.includes(result.id) && !cases.has(result.id) && result.status === 'PASS' &&
      result.exitCode === 0 && result.testsFailed === 0 && Array.isArray(result.testNames) && result.testNames.length > 0 &&
      new Set(result.testNames).size === result.testNames.length &&
      result.testsPassed === result.testNames.length && definitions.has(result.definitionSourcePath), 'selected case result');
    cases.add(result.id);
    expect(Array.isArray(result.command) && /(?:^|\/)cargo$/.test(result.command[0] ?? '') && result.command.includes('test'), 'actual Cargo test command');
    const log = logs.get(result.logPath);
    expect(typeof log === 'string' && /test result: ok\. [1-9]\d* passed; 0 failed;/.test(log), 'actual successful Rust log');
    for (const name of result.testNames) {
      expect(typeof name === 'string' && /^[A-Za-z0-9_:]+$/.test(name), 'test name');
      expect(log.includes(`test ${name} ... ok`), 'selected test present in log');
      const leaf = name.split('::').at(-1);
      expect(new RegExp(`\\bfn\\s+${leaf}\\s*\\(`).test(definitionBodies.get(result.definitionSourcePath)), 'actual Rust test definition');
    }
  }
  const handle = Object.freeze({ status: 'VERIFIED_STORAGE_TRANSITION_LOCAL_EVIDENCE', contract: STORAGE_TRANSITION_CONTRACT,
    receiptSha256, candidateNativeSha256: to.nativeSha256,
    sourceLineage: 'observed-stopped-library47-data',
    coreInputFingerprint: to.coreInputFingerprint, sourceLayoutObjectSetSha256: from.layoutObjectSetSha256,
    evidenceLayer: 'same-source-persistent-runtime-clone; target-interaction-NOT_RUN' });
  transitionBindings.set(handle, { receipt: JSON.parse(JSON.stringify(receipt)), expected: JSON.parse(JSON.stringify(expected)),
    sourceFiles: snapshotFiles, resources, bound: false });
  return handle;
}

export function loadStorageTransitionProof(path, expected) {
  const proofPath = resolve(path), directory = realpathSync(dirname(proofPath));
  expect(lstatSync(proofPath).isFile() && !lstatSync(proofPath).isSymbolicLink(), 'proof must be a regular file');
  const bytes = readFileSync(proofPath);
  expect(bytes.length > 0 && bytes.length <= 64 * 1024, 'proof size');
  const handle = validateStorageTransitionProof(JSON.parse(bytes), expected, name => {
    expect(resourcePath(name), 'resource path');
    const file = resolve(directory, name), actual = realpathSync(file), within = relative(directory, actual);
    expect(within !== '' && within !== '..' && !within.startsWith(`..${sep}`) && !isAbsolute(within) &&
      !lstatSync(file).isSymbolicLink() && lstatSync(file).isFile(), 'resource containment');
    return readFileSync(actual);
  }, hashBytes(bytes));
  transitionBindings.get(handle).resources.set('receipt.json', { path: 'receipt.json', bytes: Buffer.from(bytes), sha256: hashBytes(bytes) });
  return handle;
}

export function bindStorageTransitionTarget(handle, observed) {
  const binding = transitionBindings.get(handle);
  expect(binding, 'unvalidated transition object');
  const from = binding.receipt.from;
  expect(record(observed) && observed.stopped === true && observed.bundleName === from.bundleName &&
    observed.targetRef === from.targetRef && observed.targetKind === from.targetKind && observed.uid === from.uid &&
    observed.abi === from.abi && observed.updateTime === from.updateTime &&
    observed.appIdSha256 === from.appIdSha256 && observed.appIdentifierSha256 === from.appIdentifierSha256 &&
    equalJson(sourceFiles(observed.snapshot, 'current snapshot'), binding.sourceFiles), 'current target/snapshot');
  const result = Object.freeze({ ...handle, status: 'VERIFIED_STORAGE_TRANSITION', sourceSqliteUserVersion: 47 });
  transitionBindings.set(result, { ...binding, bound: true });
  return result;
}

export function storageTransitionResources(handle) {
  const binding = transitionBindings.get(handle);
  expect(binding?.bound, 'target not bound');
  return [...binding.resources.values()].map(value => ({ path: value.path, sha256: value.sha256, bytes: Buffer.from(value.bytes) }));
}

// Observe the current stopped app-owned data. Source code bytes are not a
// storage format identity: the candidate is admitted only through the exact
// current DB/WAL snapshot, known layout and real formal-FFI preservation proof.
export function readStoppedStorageTransitionState({ bundleName, installed, abi, targetRef, targetKind, query, querySandbox }) {
  expect(bundleName === 'io.reader.minliny' && Number.isSafeInteger(installed.uid) && installed.uid > 0 &&
    installed.cpuAbi === abi && ['x86_64', 'arm64-v8a'].includes(abi), 'target UID/ABI');
  const stopped = () => {
    const lines = query('ps -A -o UID,PID').trim().split(/\r?\n/);
    expect(/^\s*UID\s+PID\s*$/.test(lines.shift() ?? '') && lines.length > 0 &&
      lines.every(line => /^\s*\d+\s+\d+\s*$/.test(line)) &&
      lines.every(line => Number(line.trim().split(/\s+/)[0]) !== installed.uid), 'target application must remain stopped');
  };
  stopped();
  const cwd = /^\/mnt\/debug\/(0|[1-9]\d*)\/debug_hap\/([A-Za-z][A-Za-z0-9_.]+)$/.exec(querySandbox('pwd').trim());
  expect(cwd?.[2] === bundleName, 'app sandbox identity');
  const core = `/data/app/el2/${cwd[1]}/base/${bundleName}/haps/entry/files/reader-core/reader-core.sqlite3`;
  const command = `test ! -s ${core}-journal && for file in ${core} ${core}-wal; do ` +
    'if test -f $file; then test ! -L $file && test $(readlink -f $file) = $file && ' +
    'stat -c F:%u:%i:%s:%Y $file && sha256sum $file && stat -c F:%u:%i:%s:%Y $file || exit 1; ' +
    'else echo MISSING:$file; fi; done && ' + `test ! -s ${core}-journal`;
  const lines = querySandbox(command).trim().split(/\r?\n/), files = [];
  for (const name of ['reader-core.sqlite3', 'reader-core.sqlite3-wal']) {
    const path = name.endsWith('-wal') ? `${core}-wal` : core;
    const first = lines.shift();
    if (first === `MISSING:${path}`) { expect(name.endsWith('-wal'), 'primary DB missing'); continue; }
    const stat = /^F:(\d+):(\d+):(\d+):(-?\d+)$/.exec(first ?? ''), sha = lines.shift(), last = lines.shift();
    const match = /^([0-9a-f]{64})  (.+)$/.exec(sha ?? '');
    expect(stat && Number(stat[1]) === installed.uid && first === last && match?.[2] === path, 'stable app-owned source file');
    files.push({ name, bytes: Number(stat[3]), sha256: match[1] });
  }
  expect(lines.length === 0, 'unparsed source output');
  stopped();
  return { bundleName, targetRef, targetKind, uid: installed.uid, abi, updateTime: installed.updateTime,
    appIdSha256: installed.appIdSha256, appIdentifierSha256: installed.appIdentifierSha256,
    stopped: true, snapshot: sourceFiles(files, 'observed source snapshot') };
}
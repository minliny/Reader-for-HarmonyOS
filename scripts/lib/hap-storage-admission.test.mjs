import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { deploymentRoute } from '../hap-pipeline.mjs';
import { embeddedStorageCompatibility, readInstalledSqliteVersion, readInstalledStorageLineage, storageUpdateRoute, validateStorageTransitionProof, bindStorageTransitionTarget, storageTransitionResources, readStoppedStorageTransitionState, STORAGE_TRANSITION_CONTRACT, STORAGE_TRANSITION_CASES, LIBRARY47_OBJECT_SET_SHA256 } from './hap-storage-admission.mjs';

const bundleName = 'io.reader.minliny';
const uid = 20020064;
const hash = 'a'.repeat(64);
const compatible = { sqliteMaxUserVersion: 47, sqliteStorageSourceSha256: hash };

test('only one complete compiled marker establishes candidate storage compatibility', () => {
  const marker = Buffer.from(`READER_SQLITE_COMPAT_V1:47:${hash}\0`);
  assert.deepEqual(embeddedStorageCompatibility(Buffer.concat([Buffer.from([0x7f, 0, 0]), marker])), compatible);
  assert.equal(embeddedStorageCompatibility(Buffer.concat([marker, marker])), null);
  assert.equal(embeddedStorageCompatibility(marker.subarray(0, -1)), null);
  assert.equal(embeddedStorageCompatibility(Buffer.from(`READER_SQLITE_COMPAT_V1:0:${hash}\0`)), null);
});

test('target schema header is read without opening the live DB or ignoring a WAL', () => {
  const commands = [];
  const read = (path, output, expectedUid = uid) => readInstalledSqliteVersion({ bundleName, uid: expectedUid,
    querySandbox: command => { commands.push(command); return command === 'pwd' ? path : output; } });
  const cwd = `/mnt/debug/100/debug_hap/${bundleName}`;
  const header = Buffer.alloc(100);
  header.write('SQLite format 3\0', 'latin1');
  header.writeUInt32BE(47, 60);
  const stat = `${uid}:1234:1048576:1793836352`;
  const sample = `${stat}\n${[...header].join(' ')}\n${stat}\n`;
  assert.equal(read(cwd, sample), 47);
  const command = commands.at(-1);
  assert.match(command, /od -An -v -N 100 -t u1 \/data\/app\/el2\/100\/base\/io\.reader\.minliny\/haps\/entry\/files\/reader-core\/reader-core\.sqlite3/);
  assert.match(command, /test ! -s [^ ]+\.sqlite3-wal/);
  assert.doesNotMatch(command, /\bsqlite3\s+-(?:readonly|batch)|\bPRAGMA\b/);
  assert.equal(read(cwd, ''), null);
  assert.equal(read(cwd, sample.replaceAll(String(uid), '20020065')), null);
  assert.equal(read(cwd, sample.replace(/1793836352\n$/, '1793836353\n')), null);
  assert.equal(read('/mnt/debug/100/debug_hap/other.bundle', sample), null);
  assert.equal(read(cwd, sample, null), null);
});

test('installed lineage requires the current process to publish a usable runtime', () => {
  const prefix = '11-05 15:18:22.000 123 123 I A05244/Reader: ';
  const identity = `${prefix}Core build identity: ${JSON.stringify({ schemaVersion: 1, buildId: hash,
    storageCompatibility: compatible, sqliteUserVersion: 47 })}`;
  const trace = (stage, status) => `${prefix}READER_STARTUP ${JSON.stringify({ stage, status })}`;
  const ready = trace('startup.runtime-published', 'ready');
  const read = (lines, pidAfter = '123') => {
    let pidQueries = 0;
    return readInstalledStorageLineage({ bundleName, query: command => {
      if (command === `pidof ${bundleName}`) return pidQueries++ === 0 ? '123' : pidAfter;
      assert.equal(command, 'hilog -x -P 123 -T Reader');
      return lines.join('\n');
    } });
  };
  assert.deepEqual(read([trace('startup.native-open', 'ready'), identity, ready]), { ...compatible, sqliteUserVersion: 47 });
  assert.equal(read([identity]), null);
  assert.equal(read([identity, ready, trace('startup.native-open', 'failed')]), null);
  assert.equal(read([identity, ready], '234'), null);
});

test('rejects the observed 47-to-38 replacement, unknown input and a different storage lineage', () => {
  const route = (candidateStorage, installedStorage = compatible, targetSqliteVersion = 47) =>
    storageUpdateRoute({ targetSqliteVersion, installedStorage, candidateStorage });
  assert.equal(route({ ...compatible, sqliteMaxUserVersion: 38 }).reason, 'candidate-core-cannot-open-target-sqlite');
  assert.equal(route(null).reason, 'candidate-native-storage-identity-unresolved');
  assert.equal(route(compatible, compatible, null).reason, 'target-sqlite-version-unresolved');
  assert.equal(route(compatible, null).reason, 'installed-core-storage-lineage-unresolved');
  assert.equal(route({ ...compatible, sqliteStorageSourceSha256: 'b'.repeat(64) }).reason, 'core-storage-lineage-changed');
  assert.equal(route(compatible).allowed, true);
});

test('a matching signature is insufficient for preserve-data deployment', () => {
  const installed = { bundlePresent: true, appProvisionType: 'debug', appIdSha256: hash };
  const artifact = { signature: { status: 'signed', verified: true, profileType: 'debug', appIdSha256: hash } };
  const route = storageEvidence => deploymentRoute({ targetKind: 'vm', installed, artifact, storageEvidence });
  assert.equal(route().allowed, false);
  assert.equal(route({ targetSqliteVersion: 47, candidateStorage: compatible, installedStorage: compatible }).allowed, true);
  assert.equal(route({ targetSqliteVersion: 47, candidateStorage: { ...compatible, sqliteMaxUserVersion: 38 },
    installedStorage: compatible }).allowed, false);
});

function transitionFixture() {
  const bytesHash = value => createHash('sha256').update(value).digest('hex');
  const definitionBytes = Buffer.from(STORAGE_TRANSITION_CASES.map((_, index) => `#[test]\nfn library47_case_${index}() {}`).join('\n'));
  const definitionSource = 'crates/reader-runtime/tests/library47_compatibility.rs';
  const definition = { path: 'definitions/library47_compatibility.rs', sourcePath: definitionSource,
    bytes: definitionBytes.length, sha256: bytesHash(definitionBytes) };
  const fingerprint = 'c'.repeat(64), storage = { sqliteMaxUserVersion: 47, sqliteStorageSourceSha256: 'b'.repeat(64) };
  const inputBytes = Buffer.from(JSON.stringify({ schemaVersion: 1, fingerprint, files: [
    { path: definitionSource, type: 'file', bytes: definition.bytes, sha256: definition.sha256 },
  ] }));
  const snapshot = [
    { name: 'reader-core.sqlite3', bytes: 1048576, sha256: 'd'.repeat(64) },
    { name: 'reader-core.sqlite3-wal', bytes: 32768, sha256: 'e'.repeat(64) },
  ];
  const from = { targetRef: '0123456789ab', targetKind: 'vm', bundleName, uid,
    appIdSha256: hash, appIdentifierSha256: '', updateTime: 1794210000000, abi: 'x86_64',
    sqliteUserVersion: 47,
    layoutObjectSetSha256: LIBRARY47_OBJECT_SET_SHA256, snapshot };
  const expected = { runId: '20261109T100000Z-source-input', manifestSha256: 'f'.repeat(64), hapSha256: '1'.repeat(64),
    nativeSha256: '2'.repeat(64), abi: 'x86_64', coreBuildId: '3'.repeat(64), coreInputFingerprint: fingerprint,
    protocolSha256: '4'.repeat(64), storageCompatibility: storage, controllerFingerprint: '5'.repeat(64),
    coreInputSnapshotSha256: bytesHash(inputBytes), coreInputSnapshotBytes: inputBytes.length };
  const resources = new Map([[definition.path, definitionBytes], ['evidence/core-input-snapshot.json', inputBytes]]);
  const descriptor = (path, bytes) => { resources.set(path, bytes); return { path, bytes: bytes.length, sha256: bytesHash(bytes) }; };
  const cases = STORAGE_TRANSITION_CASES.map((id, index) => ({ id, status: 'PASS', exitCode: 0,
    testsPassed: 1, testsFailed: 0, testNames: [`library47_case_${index}`], definitionSourcePath: definitionSource,
    command: ['cargo', 'test', '--locked', `library47_case_${index}`, '--', '--exact'], logPath: `logs/${id}.log` }));
  const logs = cases.map(row => descriptor(row.logPath, Buffer.from(
    `running 1 test\ntest ${row.testNames[0]} ... ok\n\ntest result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out\n`)));
  const validation = { schemaVersion: 1, name: 'reader-library47-validation', status: 'PASS', constructor: 'rc_runtime_create',
    coreInputFingerprint: fingerprint, protocolSha256: expected.protocolSha256, storageSourceSha256: storage.sqliteStorageSourceSha256,
    layoutObjectSetSha256: from.layoutObjectSetSha256, sqliteUserVersion: 47, sourceSnapshot: structuredClone(snapshot),
    preservation: { formalPersistentConstructor: true, sourceCopiesUnchanged: true, schemaObjectsUnchanged: true,
      userVersionUnchanged: true, unrelatedFactsPreserved: true, originalUnknownIntentUntouched: true,
      coldReopenSucceeded: true, wholeSnapshotRejectedBeforeWrite: true }, cases };
  const receipt = { schemaVersion: 1, name: 'reader-storage-transition', transition: STORAGE_TRANSITION_CONTRACT,
    from, to: Object.fromEntries(Object.entries(expected).filter(([key]) => !key.startsWith('coreInputSnapshot'))),
    evidence: { coreInputSnapshot: descriptor('evidence/core-input-snapshot.json', inputBytes),
      validation: descriptor('evidence/validation.json', Buffer.from(JSON.stringify(validation))), definitions: [definition], logs },
    evidenceBoundary: { sourceRuntime: 'PASS', nativeBuild: 'PASS', targetInteraction: 'NOT_RUN' } };
  const observed = { ...from, snapshot: structuredClone(snapshot), stopped: true };
  delete observed.sqliteUserVersion; delete observed.layoutObjectSetSha256;
  const validate = () => validateStorageTransitionProof(receipt, expected, path => resources.get(path), '6'.repeat(64));
  const refreshValidation = () => { receipt.evidence.validation = descriptor('evidence/validation.json', Buffer.from(JSON.stringify(validation))); };
  return { receipt, expected, resources, validation, observed, validate, refreshValidation };
}

test('directed transition needs all compiled definitions and actual selected Rust results before binding the current target', () => {
  const f = transitionFixture(), local = f.validate();
  const route = transition => storageUpdateRoute({ targetSqliteVersion: 47, installedStorage: null,
    candidateStorage: f.expected.storageCompatibility, candidateNativeSha256: f.expected.nativeSha256,
    candidateHapSha256: f.expected.hapSha256, transition });
  assert.equal(route(local).allowed, false);
  assert.equal(route({ ...local, status: 'VERIFIED_STORAGE_TRANSITION' }).allowed, false);
  const bound = bindStorageTransitionTarget(local, f.observed);
  assert.equal(route(bound).reason, 'verified-directed-storage-transition');
  const retained = storageTransitionResources(bound);
  assert.equal(retained.length, f.resources.size);
  const installed = { bundlePresent: true, appProvisionType: 'debug', appIdSha256: hash };
  const artifact = { sha256: f.expected.hapSha256, embeddedCoreNapi: { sha256: f.expected.nativeSha256 },
    signature: { status: 'signed', verified: true, profileType: 'debug', appIdSha256: hash } };
  const args = { targetKind: 'vm', installed, artifact, storageEvidence: {
    targetSqliteVersion: 47, installedStorage: null, candidateStorage: f.expected.storageCompatibility, transition: bound } };
  assert.equal(deploymentRoute(args).allowed, true);
  assert.equal(deploymentRoute({ ...args, artifact: { ...artifact, sha256: '9'.repeat(64) } }).allowed, false);
  assert.equal(deploymentRoute({ ...args, artifact: { ...artifact, embeddedCoreNapi: { sha256: '9'.repeat(64) } } }).allowed, false);
});

test('directed proof rejects a different candidate, source layout, scope, input snapshot, definition or missing execution', () => {
  const failures = [
    f => { f.receipt.to.coreBuildId = '7'.repeat(64); },
    f => { f.receipt.to.abi = 'arm64-v8a'; },
    f => { f.receipt.from.nativeSha256 = '7'.repeat(64); },
    f => { f.receipt.from.storageCompatibility = compatible; },
    f => { f.receipt.from.layoutObjectSetSha256 = '7'.repeat(64); },
    f => { f.receipt.from.sqliteUserVersion = 46; },
    f => { f.receipt.evidenceBoundary.targetInteraction = 'PASS'; },
    f => { f.receipt.evidence.coreInputSnapshot.sha256 = '7'.repeat(64); },
    f => { f.receipt.evidence.definitions[0].sourcePath = 'uncompiled.rs'; },
    f => { f.resources.set(f.receipt.evidence.definitions[0].path, Buffer.from('changed')); },
    f => { f.receipt.evidence.logs.pop(); },
    f => { f.validation.cases.pop(); f.refreshValidation(); },
    f => { f.validation.cases[0].exitCode = 1; f.refreshValidation(); },
    f => { f.validation.cases[0].testNames = ['absent_test']; f.refreshValidation(); },
    f => { f.validation.cases[0].testNames = ['library47_case_0', 'library47_case_0']; f.validation.cases[0].testsPassed = 2; f.refreshValidation(); },
    f => { f.validation.preservation.formalPersistentConstructor = false; f.refreshValidation(); },
    f => { f.validation.constructor = 'internal-test-only-storage'; f.refreshValidation(); },
    f => { f.validation.preservation.originalUnknownIntentUntouched = false; f.refreshValidation(); },
    f => { f.validation.sourceSnapshot[0].sha256 = '7'.repeat(64); f.refreshValidation(); },
    f => { f.receipt.evidence.validation.path = '../escape.json'; },
  ];
  for (const corrupt of failures) { const f = transitionFixture(); corrupt(f); assert.throws(f.validate, /storage transition evidence rejected/); }
});

test('valid local proof never authorizes a stale, running or different physical target snapshot', () => {
  const fields = ['targetRef', 'targetKind', 'uid', 'updateTime', 'abi', 'appIdSha256', 'appIdentifierSha256'];
  for (const field of fields) {
    const f = transitionFixture(), local = f.validate();
    const changed = { ...f.observed, [field]: typeof f.observed[field] === 'number' ? f.observed[field] + 1 : 'different' };
    assert.throws(() => bindStorageTransitionTarget(local, changed), /current target\/snapshot/);
  }
  for (const change of [
    f => { f.observed.stopped = false; },
    f => { f.observed.snapshot = f.observed.snapshot.map(x => ({ ...x, sha256: '7'.repeat(64) })); },
    f => { f.observed.snapshot = f.observed.snapshot.slice(0, 1); },
  ]) {
    const f = transitionFixture(), local = f.validate(); change(f);
    assert.throws(() => bindStorageTransitionTarget(local, f.observed), /current target\/snapshot/);
  }
});

test('stopped target capture hashes app-owned DB/WAL without reading source Native or opening SQLite', () => {
  const f = transitionFixture(), nativeDirectory = `/data/app/el1/bundle/public/${bundleName}/entry/libs/x86_64`;
  const core = `/data/app/el2/100/base/${bundleName}/haps/entry/files/reader-core/reader-core.sqlite3`;
  const files = f.observed.snapshot;
  const sample = files.flatMap(file => {
    const path = file.name.endsWith('-wal') ? `${core}-wal` : core;
    return [`F:${uid}:1234:${file.bytes}:1794210000`, `${file.sha256}  ${path}`, `F:${uid}:1234:${file.bytes}:1794210000`];
  }).join('\n');
  const commands = [], query = command => {
    commands.push(command);
    if (command === 'ps -A -o UID,PID') return '  UID PID\n0 1\n2000 20\n';
    throw new Error(`unexpected source-code query: ${command}`);
  };
  const querySandbox = command => {
    commands.push(command);
    return command === 'pwd' ? `/mnt/debug/100/debug_hap/${bundleName}` : sample;
  };
  const installed = { uid, cpuAbi: 'x86_64', nativeLibraryPath: nativeDirectory, updateTime: f.observed.updateTime,
    appIdSha256: hash, appIdentifierSha256: '' };
  const observed = readStoppedStorageTransitionState({ bundleName, installed, abi: 'x86_64',
    targetRef: f.observed.targetRef, targetKind: 'vm', query, querySandbox });
  assert.deepEqual(observed, f.observed);
  for (const command of commands) {
    assert.doesNotMatch(command, /(?:^|[;&|]\s*)sqlite3(?:\s|$)|\bPRAGMA\b/);
    assert.doesNotMatch(command, /["']/); // Windows HDC transport strips quotes.
  }
  assert.ok(commands.some(command => command.includes('stat -c F:%u:%i:%s:%Y $file')));
  assert.throws(() => readStoppedStorageTransitionState({ bundleName, installed, abi: 'x86_64',
    targetRef: f.observed.targetRef, targetKind: 'vm', query: () => `UID PID\n${uid} 200\n`, querySandbox }), /must remain stopped/);
  assert.throws(() => readStoppedStorageTransitionState({ bundleName, installed,
    abi: 'x86_64', targetRef: f.observed.targetRef, targetKind: 'vm', query,
    querySandbox: command => command === 'pwd' ? '/mnt/debug/100/debug_hap/other.bundle' : sample }), /app sandbox identity/);
  assert.throws(() => readStoppedStorageTransitionState({ bundleName, installed, abi: 'x86_64',
    targetRef: f.observed.targetRef, targetKind: 'vm', query,
    querySandbox: command => command === 'pwd' ? `/mnt/debug/100/debug_hap/${bundleName}` : sample.replaceAll(`F:${uid}:`, 'F:1:') }), /app-owned/);
});


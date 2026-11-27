import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deploymentRoute, deploymentSigningRoute, assertInstalledDeploymentIdentity, hdcRouteEvidence,
  resolveHdcServer } from '../hap-pipeline.mjs';
import { embeddedStorageCompatibility, readInstalledSqliteVersion, readInstalledStorageLineage, storageUpdateRoute, validateStorageTransitionProof, bindStorageTransitionTarget, storageTransitionResources, readStoppedStorageTransitionState, STORAGE_TRANSITION_CONTRACT, STORAGE_TRANSITION_CASES, LIBRARY47_OBJECT_SET_SHA256 } from './hap-storage-admission.mjs';
import { collectStorageAdmission, installedStorageIdentity, releaseStorageAdmission, revalidateStorageAdmission,
  storageAdmissionAllowed } from './storage-deployment-admission.mjs';
import { collectStorageDeviceEvidence } from './storage-device-evidence.mjs';
import { readinessQueryOutput } from './hap-delivery-evidence.mjs';

const bundleName = 'io.reader.minliny';
const uid = 20020064;
const hash = 'a'.repeat(64);
const compatible = { sqliteMaxUserVersion: 47, sqliteStorageSourceSha256: hash };
const pipelineSource = readFileSync(new URL('../hap-pipeline/deploy-and-verify.mjs', import.meta.url), 'utf8');
const legacyPipelineSource = readFileSync(new URL('./fixtures/hap-install-before-uid-fence.mjs.txt', import.meta.url), 'utf8');

test('only one complete compiled marker establishes candidate storage compatibility', () => {
  const marker = Buffer.from(`READER_SQLITE_COMPAT_V1:47:${hash}\0`);
  assert.deepEqual(embeddedStorageCompatibility(Buffer.concat([Buffer.from([0x7f, 0, 0]), marker])), compatible);
  assert.equal(embeddedStorageCompatibility(Buffer.concat([marker, marker])), null);
  assert.equal(embeddedStorageCompatibility(marker.subarray(0, -1)), null);
  assert.equal(embeddedStorageCompatibility(Buffer.from(`READER_SQLITE_COMPAT_V1:0:${hash}\0`)), null);
});

test('retired live header reader performs no path or byte query without an atomic safe boundary', () => {
  let queries = 0;
  assert.equal(readInstalledSqliteVersion({ bundleName, uid,
    querySandbox: () => { queries++; throw new Error('retired header must not reach even pwd'); } }), null);
  assert.equal(queries, 0); // A swallowed query error must also fail this assertion.
  assert.equal(readInstalledSqliteVersion(), null);
  const legacy = productionFunction(legacyPipelineSource, 'readInstalledSqliteVersion', 'installDeployment', {});
  assert.equal(legacy({ bundleName, uid, querySandbox: command => {
    queries++;
    return command === 'pwd' ? `/mnt/debug/100/debug_hap/${bundleName}` : 'not-a-header';
  } }), null);
  assert.equal(queries, 2); // Original code reaches the read even though parsing rejects it.
});

test('diagnostic lineage requires an exact OS prefix and body while remaining non-authoritative', () => {
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
  assert.equal(read([`${prefix}Copied /Reader: ${identity.split('/Reader: ')[1]}`, ready]), null);
  assert.equal(read([identity, `${prefix}Copied /Reader: ${ready.split('/Reader: ')[1]}`]), null);
  assert.equal(read([identity.replace('123 123 I', '456 456 I'), ready]), null);
  assert.equal(read([identity, ready.replace('123 123 I', '456 456 I')]), null);
  assert.equal(storageUpdateRoute({ targetSqliteVersion: 47, installedStorage: read([identity, ready]),
    candidateStorage: compatible }).allowed, false);
});

test('rejects the observed 47-to-38 replacement, unknown input and a different storage lineage', () => {
  const route = (candidateStorage, installedStorage = compatible, targetSqliteVersion = 47) =>
    storageUpdateRoute({ targetSqliteVersion, installedStorage, candidateStorage });
  assert.equal(route({ ...compatible, sqliteMaxUserVersion: 38 }).reason, 'candidate-core-cannot-open-target-sqlite');
  assert.equal(route(null).reason, 'candidate-native-storage-identity-unresolved');
  assert.equal(route(compatible, compatible, null).reason, 'verified-storage-transition-required');
  assert.equal(route(compatible, null).reason, 'verified-storage-transition-required');
  assert.equal(route({ ...compatible, sqliteStorageSourceSha256: 'b'.repeat(64) }).allowed, false);
  assert.equal(route(compatible).allowed, false);
});

test('a matching signature is insufficient for preserve-data deployment', () => {
  const installed = { bundlePresent: true, appProvisionType: 'debug', appIdSha256: hash, uid, cpuAbi: 'x86_64' };
  const artifact = { signature: { status: 'signed', verified: true, profileType: 'debug', appIdSha256: hash } };
  const route = storageEvidence => deploymentRoute({ targetKind: 'vm', installed, artifact, storageEvidence, candidateAbi: 'x86_64' });
  assert.equal(route().allowed, false);
  assert.equal(route({ targetSqliteVersion: 47, candidateStorage: compatible, installedStorage: compatible }).allowed, false);
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
  const installed = { bundlePresent: true, appProvisionType: 'debug', appIdSha256: hash, uid, cpuAbi: 'x86_64' };
  const artifact = { sha256: f.expected.hapSha256, embeddedCoreNapi: { sha256: f.expected.nativeSha256 },
    signature: { status: 'signed', verified: true, profileType: 'debug', appIdSha256: hash } };
  const args = { targetKind: 'vm', installed, artifact, candidateAbi: 'x86_64', storageEvidence: {
    targetSqliteVersion: 47, installedStorage: null, candidateStorage: f.expected.storageCompatibility, transition: bound } };
  assert.equal(deploymentRoute(args).allowed, true);
  assert.equal(deploymentRoute({ ...args, artifact: { ...artifact, sha256: '9'.repeat(64) } }).allowed, false);
  assert.equal(deploymentRoute({ ...args, artifact: { ...artifact, embeddedCoreNapi: { sha256: '9'.repeat(64) } } }).allowed, false);
  assert.equal(deploymentRoute({ ...args, candidateAbi: 'arm64-v8a' }).allowed, false);
  assert.equal(deploymentRoute({ ...args, candidateAbi: undefined }).allowed, false);
  assert.equal(deploymentRoute({ ...args, installed: { ...installed, uid: undefined } }).allowed, false);
});

test('post-install UID and ABI must be established before any launch', () => {
  const before = { bundlePresent: true, uid, cpuAbi: 'x86_64' };
  const after = { ...before, appProvisionType: 'debug', appIdSha256: hash };
  const artifact = { signature: { status: 'signed', verified: true, profileType: 'debug', appIdSha256: hash } };
  const args = { before, after, artifact, candidateAbi: 'x86_64', targetKind: 'vm' };
  assert.doesNotThrow(() => assertInstalledDeploymentIdentity(args));
  for (const badUid of [undefined, null, uid + 1, 0]) {
    assert.throws(() => assertInstalledDeploymentIdentity({ ...args, after: { ...after, uid: badUid } }), /UID/);
  }
  assert.throws(() => assertInstalledDeploymentIdentity({ ...args, before: { ...before, uid: undefined } }), /UID/);
  assert.throws(() => assertInstalledDeploymentIdentity({ ...args, after: { ...after, cpuAbi: 'arm64-v8a' } }), /ABI/);
  assert.throws(() => assertInstalledDeploymentIdentity({ ...args, after: { ...after, appIdSha256: 'b'.repeat(64) } }), /signing identity/);
  assert.throws(() => assertInstalledDeploymentIdentity({ ...args, expectedVersion: { versionName: '0.2.0', versionCode: 1000000 } }), /system version/);
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

function productionFunction(source, name, next, ports) {
  const start = source.indexOf(`function ${name}(`);
  const nextDeclaration = next ? source.indexOf(`function ${next}(`, start) : source.length;
  const end = next && nextDeclaration >= 0 ? source.lastIndexOf('\n', nextDeclaration) : nextDeclaration;
  assert.ok(start >= 0 && end > start, `actual production ${name} boundary`);
  return new Function(...Object.keys(ports), `return (${source.slice(start, end)});`)(...Object.values(ports));
}
const requiredOption = (options, key) => { assert.ok(options.has(key)); return options.get(key); };
const fail = message => { throw new Error(message); };

test('actual deployment resolution never reads live headers or logs and revalidates the bound source', () => {
  const contractBytes = readFileSync(new URL('../../../Reader-Core/storage/storage-contract.v1.json', import.meta.url));
  const candidateSha256 = '1'.repeat(64), nativeSha256 = '2'.repeat(64);
  const artifact = { kind: 'signed', sha256: candidateSha256, path: 'signed.hap',
    embeddedCoreNapi: { sha256: nativeSha256 },
    storageCapability: { hapSha256: candidateSha256, nativeSha256, coreBuildId: '3'.repeat(64),
      coreInputFingerprint: '4'.repeat(64), contract: JSON.parse(contractBytes),
      contractSha256: createHash('sha256').update(contractBytes).digest('hex') },
    signature: { status: 'signed', verified: true, profileType: 'debug', appIdSha256: hash } };
  let installed = { bundlePresent: true, uid, cpuAbi: 'x86_64', updateTime: 1794210000000,
    appProvisionType: 'debug', appIdSha256: hash };
  const target = 'synthetic-target', serverKey = '192.168.1.10:8710';
  const readiness = { status: 'PASS', bootIdSha256: '1'.repeat(64) };
  const layout = { schemaVersion: 47, layoutId: 'reader-sqlite-47-remote', schemaCookie: 452,
    schemaFingerprint: '78ec3da13ad542c869b6825e4c008ddffe8310edf0fc268ceb80f0e42203d28b',
    dataFormatGeneration: 1, directoryPolicyId: 'reader-directory-visible-content-v2', syncEpochOwner: 'none' };
  let databaseSha256 = 'd'.repeat(64);
  let collections = 0, rechecks = 0, releases = 0, metadataReads = 0, transportQueries = 0, manifestAbi = 'x86_64';
  const options = new Map([['--manifest', '/synthetic/manifest.json'], ['--artifact', 'signed'],
    ['--target', target], ['--target-kind', 'vm'], ['--vm-location', 'remote']]);
  const collect = context => {
    collections++;
    assert.equal(context.target, target);
    assert.equal(context.serverKey, serverKey);
    assert.equal(context.candidate, artifact.storageCapability);
    const binding = { target, serverKey, bootIdSha256: readiness.bootIdSha256, bundleName,
      installedIdentitySha256: installedStorageIdentity(context.installed) };
    const facts = () => ({ binding, barrier: { kind: 'stopped-application-uid-and-frozen-files',
      held: context.mode === 'install', tokenSha256: hash },
      snapshot: { databaseSha256, walSha256: 'e'.repeat(64),
        manifestSha256: '8'.repeat(64), backupReceiptSha256: '9'.repeat(64) },
      layout, requiresMigration: false, explicitMigration: null });
    return { facts: facts(), revalidate: () => {
      rechecks++;
      assert.deepEqual(context.observeReadiness(), readiness);
      return { ...facts(), binding: { ...binding, installedIdentitySha256: installedStorageIdentity(context.observeInstalled()) } };
    }, release: () => { releases++; } };
  };
  const ports = { requiredOption, fail, verifyManifest: () => ({ artifacts: [artifact], directory: '/synthetic',
    manifest: { abi: manifestAbi } }), resolve, hdcBinary: () => '/synthetic/hdc',
    assertTargetConnected: (hdc, actualTarget, actualServer) => {
      assert.deepEqual([hdc, actualTarget, actualServer], ['/synthetic/hdc', target, serverKey]);
    },
    runTargetHdc: () => { transportQueries++; throw new Error('no direct header or log queries'); },
    BUNDLE_NAME: bundleName, process: { env: {} },
    resolveHdcServer, targetReadiness: () => readiness, readinessQueryOutput, option: (o, key) => o.get(key),
    installedMetadata: () => { metadataReads++; return structuredClone(installed); },
    deploymentSigningRoute, installedStorageIdentity, storageAdmissionAllowed, collectStorageDeviceEvidence,
    targetReference: () => '0123456789ab',
    collectStorageAdmission: (context, collector) => {
      assert.equal(collector, collectStorageDeviceEvidence);
      return collectStorageAdmission(context, collect);
    } };
  const resolveActual = productionFunction(pipelineSource, 'resolveDeployment', 'inspectDeployment', ports);
  const inspected = resolveActual(options);
  assert.equal(inspected.route.allowed, true, inspected.route.reason);
  assert.equal(inspected.storageAdmission.status, 'OBSERVED');
  assert.throws(() => revalidateStorageAdmission(inspected.storageAdmission), /untrusted/);
  releaseStorageAdmission(inspected.storageAdmission);

  options.set('--storage-transition', '/synthetic/proof.json');
  assert.throws(() => resolveActual(options, 'install'), /requires live storage admission/);
  assert.equal(collections, 1);
  assert.equal(metadataReads, 1);
  options.delete('--storage-transition');

  const admitted = resolveActual(options, 'install');
  assert.equal(admitted.route.allowed, true);
  assert.equal(admitted.storageAdmission.status, 'READY');
  assert.deepEqual(admitted.storageAdmission.storageLayout, layout);
  assert.equal(revalidateStorageAdmission(admitted.storageAdmission).status, 'PASS');
  releaseStorageAdmission(admitted.storageAdmission);

  const changedFiles = resolveActual(options, 'install').storageAdmission;
  databaseSha256 = '9'.repeat(64);
  assert.throws(() => revalidateStorageAdmission(changedFiles), /storage facts changed/);
  releaseStorageAdmission(changedFiles);

  const changedIdentity = resolveActual(options, 'install').storageAdmission;
  installed = { ...installed, uid: uid + 1 };
  assert.throws(() => revalidateStorageAdmission(changedIdentity), /installed identity changed/);
  releaseStorageAdmission(changedIdentity);
  assert.equal(rechecks, 3);
  assert.equal(releases, 4);

  manifestAbi = undefined;
  const legacyAbi = resolveActual(options, 'install');
  assert.equal(legacyAbi.candidateAbi, 'arm64-v8a');
  assert.equal(legacyAbi.route.reason, 'installed-abi-or-uid-does-not-match-candidate');
  assert.equal(collections, 4);
  assert.equal(transportQueries, 0);
});

test('actual install checks UID before start and rejects the old missing-UID-fence implementation', () => {
  function invoke(source, { changedUid = false, noLaunch = false, staleBeforeReplacement = false } = {}) {
    const calls = [], before = { bundlePresent: true, uid, cpuAbi: 'x86_64' };
    const target = 'synthetic-target', serverKey = '192.168.1.10:8710';
    const artifact = { kind: 'signed', sha256: '1'.repeat(64), bytes: 50,
      signature: { status: 'signed', verified: true, profileType: 'debug', appIdSha256: hash } };
    const storageAdmission = Object.freeze({ status: 'READY', candidateSha256: artifact.sha256 });
    const dataRecheck = { status: 'PASS', candidateSha256: artifact.sha256 };
    const storageCandidateBinding = { status: 'CANDIDATE_BOUND', actualNativeIdentity: 'OPEN' };
    const options = new Map([['--target', 'synthetic-target'], ['--target-kind', 'vm']]);
    if (noLaunch) options.set('--no-launch', true);
    const revalidate = () => { calls.push('revalidate'); if (staleBeforeReplacement) throw new Error('stale source'); };
    const resolved = { route: { allowed: true }, artifact, installed: before, targetKind: 'vm', targetRef: 'fake',
      artifactPath: '/synthetic/signed.hap', candidateAbi: 'x86_64', hdc: '/synthetic/hdc', target,
      hdcRoute: { serverKey, vmLocation: 'remote' }, storageAdmission, readiness: { status: 'PASS' },
      verified: { directory: '/synthetic', manifest: { abi: 'x86_64', runId: 'synthetic' } },
      revalidateStorageTransition: revalidate };
    let receipt;
    const ports = { requiredOption, fail, targetReference: () => 'fake', LOCK_ROOT: '/synthetic', join, resolve,
      acquireLock: () => calls.push('lock'), resolveDeployment: (_options, mode) => {
        if (source === pipelineSource) assert.equal(mode, 'install');
        return resolved;
      },
      writeJson: (_path, value) => {
        if (value.name === 'reader-harmonyos-deployment-receipt') {
          calls.push('write-receipt');
          receipt = value;
        }
      },
      fileRecord: path => {
        assert.equal(path, resolved.artifactPath);
        return { sha256: artifact.sha256, bytes: artifact.bytes };
      },
      revalidateStorageAdmission: session => {
        assert.equal(session, storageAdmission);
        revalidate();
        return dataRecheck;
      },
      recordInstalledStorageCandidate: (session, installed) => {
        assert.equal(session, storageAdmission);
        assert.equal(installed.uid, uid);
        calls.push('bind');
        return storageCandidateBinding;
      },
      releaseStorageAdmission: session => {
        assert.equal(session, storageAdmission);
        calls.push('release');
      },
      hdcRouteEvidence,
      runTargetHdc: (hdc, actualTarget, serverOrArgs, currentArgs) => {
        assert.deepEqual([hdc, actualTarget], [resolved.hdc, target]);
        const argv = Array.isArray(serverOrArgs) ? serverOrArgs : currentArgs;
        if (source === pipelineSource) assert.equal(serverOrArgs, serverKey);
        if (argv[2] === 'install') {
          assert.deepEqual(argv, ['-t', target, 'install', '-r', resolved.artifactPath]);
          calls.push('install');
          return { status: 0, stdout: 'install bundle successfully' };
        }
        assert.deepEqual(argv, ['-t', target, 'shell', `aa start -a EntryAbility -b ${bundleName} -m entry`]);
        calls.push('start');
        return { status: 0, stdout: 'start ability successfully' };
      },
      installedMetadata: () => ({ ...before, uid: changedUid ? uid + 1 : uid, appProvisionType: 'debug', appIdSha256: hash }),
      deploymentSigningRoute, assertInstalledDeploymentIdentity,
      BUNDLE_NAME: bundleName, timestampId: () => 'synthetic', rmSync: () => calls.push('cleanup'),
      console: { log: () => {} } };
    const install = productionFunction(source, 'installDeployment', source === legacyPipelineSource ? 'usage' : undefined, ports);
    let error;
    try { install(options); } catch (caught) { error = caught; }
    return { calls, error, receipt, storageAdmission, dataRecheck, storageCandidateBinding };
  }
  const changed = invoke(pipelineSource, { changedUid: true });
  assert.match(changed.error?.message ?? '', /UID/);
  assert.deepEqual(changed.calls, ['lock', 'revalidate', 'install', 'release', 'cleanup']);
  const legacy = invoke(legacyPipelineSource, { changedUid: true });
  assert.equal(legacy.error, undefined);
  assert.ok(legacy.calls.includes('start')); // actual prior source fails the safety assertion
  const ok = invoke(pipelineSource);
  assert.equal(ok.error, undefined);
  assert.deepEqual(ok.calls, ['lock', 'revalidate', 'install', 'bind', 'start', 'write-receipt', 'cleanup', 'release', 'cleanup']);
  assert.equal(ok.receipt.storageAdmission, ok.storageAdmission);
  assert.equal(ok.receipt.dataRecheck, ok.dataRecheck);
  assert.equal(ok.receipt.storageCandidateBinding, ok.storageCandidateBinding);
  const noLaunch = invoke(pipelineSource, { noLaunch: true });
  assert.equal(noLaunch.error, undefined);
  assert.equal(noLaunch.receipt.launch, 'NOT_RUN');
  assert.ok(!noLaunch.calls.includes('start'));
  const stale = invoke(pipelineSource, { staleBeforeReplacement: true });
  assert.match(stale.error?.message ?? '', /stale source/);
  assert.deepEqual(stale.calls, ['lock', 'revalidate', 'release', 'cleanup']);
});


import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { captureRecord } from '../../lib/native-ui-evidence.mjs';
import { readProbeEvents, checkpoint, logCommand } from '../collectors/harmonyos/records.mjs';
import { loadCandidate } from '../collectors/harmonyos/run.mjs';
import { loadCase } from '../lib/cases.mjs';
import { evidenceStore, jsonBytes, jsonDigest, sealChain, sha256, verifyChain } from '../lib/evidence.mjs';
import { replayReceipt, sealReceipt } from '../lib/receipt.mjs';

const searchId = 'bookshelf.search-input-ime';
const readingId = 'reading.control-open-motion';
const targetRef = '123456789abc';
const syntheticServer = '127.0.0.1:8710';
const completedAt = '2026-11-19T06:00:00Z';

function scratch(t) {
  const directory = mkdtempSync(join(tmpdir(), 'reader-phase0-synthetic-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function appBuild(char) {
  const contentId = char.repeat(12);
  return { schema: 'reader-app-build-v1', versionName: '0.2.0', versionCode: 1000000, channel: 'DEV',
    contentId, appContentHash: char.repeat(64), appBuildId: `0.2.0.DEV.${contentId}` };
}

// These records are intentionally synthetic. There is no HAP, device session,
// real source capture or product-verification PASS in any fixture.
function fixture(t, id = searchId, mutate) {
  const directory = scratch(t);
  const bundle = join(directory, 'bundle');
  mkdirSync(bundle);
  const store = evidenceStore(bundle);
  const contract = loadCase(id);
  const ownerSources = Object.fromEntries(contract.ownerSources.map((path, index) => [
    path, store.write(`candidate/owner/${path}`, `Synthetic source fixture ${index}\n`),
  ]));
  const files = Object.entries(ownerSources).map(([path, ref]) =>
    ({ path, type: 'file', mode: 0o644, bytes: ref.bytes, sha256: ref.sha256 }));
  const sourceFingerprint = sha256(files.map(file => `${JSON.stringify(file)}\n`).join(''));
  const expectedVersion = appBuild('a');
  const hapSha256 = 'b'.repeat(64);
  const manifest = {
    schemaVersion: 2, name: 'synthetic-test-candidate', abi: 'x86_64', runId: 'synthetic-build',
    artifacts: [{ kind: 'signed', path: 'synthetic.hap', sha256: hapSha256, signature: { verified: true } }],
    source: { buildInputs: { snapshot: 'source-snapshot.json', fileCount: files.length, fingerprint: sourceFingerprint } },
    expectedVersion,
  };
  const deployment = {
    runId: manifest.runId, dataPolicy: 'preserve', targetKind: 'vm', hdcServer: syntheticServer,
    install: 'PASS', launch: 'PASS', appVersionCheck: 'PASS',
    artifact: { kind: 'signed', sha256: hapSha256 }, targetRef, completedAt,
    postInstall: { bundlePresent: true, bundleName: 'io.reader.minliny', appVersion: appBuild('a'),
      cpuAbi: 'x86_64', appProvisionType: 'debug', appIdSha256: 'c'.repeat(64),
      appIdentifierSha256: 'd'.repeat(64), updateTime: 1795068000000 },
  };
  const snapshot = { schemaVersion: 1, fingerprint: sourceFingerprint, files };
  const publicFixture = {
    schema: 'reader-ui-public-fixture-v1', caseId: id, fixtureId: contract.fixture.id, targetRef,
    hdcServer: syntheticServer, vmName: 'Synthetic fixture with no target',
    checkedAt: completedAt, publicBooks: true, publicHistory: true, publicEnabledSource: true,
    publicImeCandidates: true, developerMode: true, noPersonalData: true,
    directRoute: Object.fromEntries(['clientToServer', 'serverToTarget'].map(leg =>
      [leg, { direct: true, socketObservation: 'Synthetic socket', routeObservation: 'Synthetic route' }])),
  };
  mutate?.({ manifest, deployment, snapshot, publicFixture, ownerSources, store, contract });
  const refs = {
    manifest: store.writeJson('candidate/manifest.json', manifest),
    deployment: store.writeJson('candidate/deployment.json', deployment),
    // This format matches the pipeline snapshot's original per-record key order.
    snapshot: store.write('candidate/source-snapshot.json', `${JSON.stringify(snapshot)}\n`),
    ownerSources,
  };
  const session = {
    runId: `synthetic-incomplete-${id}`, platform: 'harmonyos', instanceId: null, result: 'INCOMPLETE', reason: 'Synthetic no-device fixture',
    commands: store.write('session/commands.ndjson', '\n'),
    fixture: store.writeJson('session/fixture.json', publicFixture),
    chain: [],
  };
  const sessionRef = store.writeJson('session/session.json', session);
  return { directory, bundle, store, refs, contract, session, sessionRef };
}

function replay(path, rootSha256, contract) {
  return replayReceipt({ receiptPath: path, expectedRoot: rootSha256, contract });
}

test('canonical digests are independent of insertion order and nested evidence bytes are verified', t => {
  const directory = scratch(t);
  const bundle = join(directory, 'bundle');
  mkdirSync(bundle);
  const store = evidenceStore(bundle);
  assert.equal(jsonDigest({ b: [true, 2], a: 1 }), jsonDigest({ a: 1, b: [true, 2] }));
  const ref = store.write('raw/source', 'initial');
  assert.throws(() => store.write(ref.path, 'replacement'), /EEXIST/);
  assert.throws(() => store.reference('../outside'), /Invalid evidence-relative path/);
  assert.throws(() => store.reference(join(directory, 'absolute')), /Invalid evidence-relative path/);
  writeFileSync(join(bundle, 'raw/source'), 'changed');
  assert.throws(() => store.bytes(ref), /Changed evidence bytes/);
  writeFileSync(join(directory, 'elsewhere'), 'initial');
  symlinkSync(join(directory, 'elsewhere'), join(bundle, 'raw/link'));
  assert.throws(() => store.reference('raw/link'), /symbolic link/);
  assert.throws(() => store.write('raw/link/forged', 'nested'), /symbolic link/);
});

test('ordered predecessor digest rejects altered, reordered and duplicate chunks', () => {
  const chain = sealChain([{ kind: 'synthetic-start' }, { kind: 'synthetic-sample' }, { kind: 'synthetic-close' }]);
  assert.equal(verifyChain(chain), chain[2].sha256);
  assert.equal(verifyChain([]), null);
  const changed = structuredClone(chain);
  changed[1].entry.kind = 'synthetic-substitute';
  assert.throws(() => verifyChain(changed), /Broken evidence chain at index 1/);
  assert.throws(() => verifyChain([chain[0], chain[2], chain[1]]), /Broken evidence chain at index 1/);
  assert.throws(() => verifyChain([chain[0], chain[1], chain[1]]), /Broken evidence chain at index 2/);
});

test('relocates both synthetic receipts and preserves exact assertion sets and page disposition', t => {
  for (const id of [searchId, readingId]) {
    const run = fixture(t, id);
    const { receipt, rootSha256 } = sealReceipt(run, run.contract);
    const moved = join(run.directory, 'relocated-bundle');
    renameSync(run.bundle, moved);
    assert.equal(existsSync(run.bundle), false);
    const result = replay(join(moved, 'receipt.json'), rootSha256, run.contract);
    assert.deepEqual(result.receipt, receipt);
    assert.deepEqual(receipt.assertions.map(item => item.id), run.contract.assertions.map(item => item.id));
    assert.ok(receipt.assertions.every(item => item.verdict === 'NOT_RUN'));
    assert.equal(receipt.page.registration, 'UNREGISTERED_PAGE');
    assert.equal(receipt.execution, 'INCOMPLETE');
    assert.equal(receipt.behavior, 'NOT_RUN');
    for (const platform of ['android', 'ios']) {
      assert.ok(Object.values(receipt.capabilities[platform]).every(item => item.status === 'UNSUPPORTED'));
    }
  }
});

test('combines distinct runs on one HDC server and refuses identical target references across servers', t => {
  function seal(run) {
    const { rootSha256 } = sealReceipt(run, run.contract);
    return { path: join(run.bundle, 'receipt.json'), rootSha256 };
  }

  const search = seal(fixture(t));
  const localReading = seal(fixture(t, readingId));
  const remoteReading = seal(fixture(t, readingId, ({ deployment, publicFixture }) => {
    deployment.hdcServer = '192.168.1.10:8710';
    publicFixture.hdcServer = deployment.hdcServer;
  }));

  function cover(reading) {
    return spawnSync(process.execPath, [fileURLToPath(new URL('../coverage.mjs', import.meta.url)),
      '--search', search.path, '--search-root', search.rootSha256,
      '--reading', reading.path, '--reading-root', reading.rootSha256],
    { encoding: 'utf8', timeout: 3000 });
  }

  const sameServer = cover(localReading);
  assert.ifError(sameServer.error);
  assert.equal(sameServer.stderr, '');
  assert.equal(sameServer.status, 1);
  const report = JSON.parse(sameServer.stdout);
  assert.equal(report.observationStatus, 'INCOMPLETE');
  assert.equal(report.cases.length, 2);
  assert.ok(report.cases.every(item => item.candidate.targetRef === targetRef &&
    item.candidate.hdcServer === syntheticServer && item.candidate.targetKind === 'vm'));

  const otherServer = cover(remoteReading);
  assert.ifError(otherServer.error);
  assert.equal(otherServer.status, 1);
  assert.equal(otherServer.stdout, '');
  assert.match(JSON.parse(otherServer.stderr).reason, /same server and target/u);
});

test('rejects a substituted case, altered receipt root and omitted assertion even with a new root', t => {
  const run = fixture(t);
  const { receipt, rootSha256 } = sealReceipt(run, run.contract);
  const receiptPath = join(run.bundle, 'receipt.json');
  assert.throws(() => replay(receiptPath, rootSha256, loadCase(readingId)), /case or trusted tool version mismatch/);
  const shortened = { ...receipt, assertions: receipt.assertions.slice(1) };
  const alteredBytes = jsonBytes(shortened);
  writeFileSync(receiptPath, alteredBytes);
  assert.throws(() => replay(receiptPath, rootSha256, run.contract), /sealed handoff root/);
  assert.throws(() => replay(receiptPath, sha256(alteredBytes), run.contract), /independently recomputed assertions/);
});

test('rejects substituted signed HAP metadata, installed identities and scoped target evidence', t => {
  const wrongHap = fixture(t, searchId, ({ deployment }) => {
    deployment.artifact.sha256 = 'f'.repeat(64);
  });
  assert.throws(() => loadCandidate(wrongHap.store, wrongHap.refs, wrongHap.contract), /does not bind the signed Reader candidate/);
  const wrongApp = fixture(t, searchId, ({ deployment }) => {
    deployment.postInstall.appVersion = appBuild('f');
  });
  assert.throws(() => loadCandidate(wrongApp.store, wrongApp.refs, wrongApp.contract), /does not match the expected app version/);
  const wrongTarget = fixture(t, searchId, ({ deployment }) => {
    deployment.targetRef = '000000000001';
  });
  assert.throws(() => sealReceipt(wrongTarget, wrongTarget.contract), /scope-matched isolated public fixture/);
});

test('requires candidate source fingerprint and the deployed digest of each owner', t => {
  const wrongSnapshot = fixture(t, searchId, ({ snapshot }) => {
    snapshot.files[0].sha256 = 'f'.repeat(64);
  });
  assert.throws(() => loadCandidate(wrongSnapshot.store, wrongSnapshot.refs, wrongSnapshot.contract), /Source snapshot differs/);
  const wrongOwner = fixture(t, searchId, ({ contract, ownerSources, store }) => {
    ownerSources[contract.ownerSources[0]] = store.write('candidate/substitute-owner', 'Synthetic substitution');
  });
  assert.throws(() => loadCandidate(wrongOwner.store, wrongOwner.refs, wrongOwner.contract), /owner not included in deployed source/);
});

test('native capture binds the selected successful primitive, transfer, byte count and digest', () => {
  const bytes = Buffer.from('Synthetic raw capture');
  const reference = { path: 'raw/reader-control-synthetic.json', bytes: bytes.length, sha256: sha256(bytes) };
  const remote = '/data/local/tmp/reader-control-synthetic.json';
  const local = '/synthetic/bundle/raw/reader-control-synthetic.json';
  const commands = [
    { event: 'ready' },
    { event: 'command', ok: true, args: ['shell', 'uitest', 'dumpLayout', '-p', remote] },
    { event: 'command', ok: true, args: ['file', 'recv', remote, local] },
    { event: 'capture-integrity', path: local, bytes: bytes.length, sha256: reference.sha256 },
  ];
  assert.deepEqual(captureRecord(commands, reference, bytes, 'dumpLayout'), { bytes, entry: 3, capture: 1 });
  assert.throws(() => captureRecord(commands, reference, bytes, 'screenCap'), /No successful native|one successful native/);
  assert.throws(() => captureRecord(commands, reference, Buffer.from('modified'), 'dumpLayout'), /matching device capture/);
  const changed = structuredClone(commands);
  changed[2].args[3] = '/synthetic/different-local.json';
  assert.throws(() => captureRecord(changed, reference, bytes, 'dumpLayout'), /No matching native readback/);
});

test('app log parser rejects incomplete and mixed-instance checkpoints', () => {
  const instanceId = '11111111-1111-4111-8111-111111111111';
  const foreignInstance = '22222222-2222-4222-8222-222222222222';
  const make = (id, seq) => ({ instanceId: id, eventSeq: seq, semanticSeq: 0, deviceMonoMs: seq,
    windowRevision: 8, kind: 'window-stable', channel: 'probe', payload: {} });
  function chunks(id, seq) {
    const json = JSON.stringify(make(id, seq));
    return [json.slice(0, 40), json.slice(40)].map((part, index) =>
      `11-19 06:00:00.000 123 456 I A05244/ReaderUIContract: RUI1 ${id}/${seq}/${index}/2 ${part}`);
  }
  const log = lines => ({ event: 'command', ok: true, args: logCommand, stdout: lines.join('\n') });
  const [first, second] = chunks(instanceId, 3);
  assert.deepEqual(readProbeEvents(log([first, second])), [make(instanceId, 3)]);
  assert.deepEqual(readProbeEvents(log([first])), []);
  assert.deepEqual(readProbeEvents(log([first, first, second])), []);
  assert.throws(() => checkpoint(log([first, second, ...chunks(foreignInstance, 1)]), instanceId), /instance changed/);
});

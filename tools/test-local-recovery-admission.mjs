import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { localRecoveryFileProbe } from './lib/local-recovery-file-probe.mjs';

const source = new URL('../entry/src/main/ets/features/bookshelf/application/LocalRecoveryGateway.ts', import.meta.url);
const passphrase = 'fixture recovery passphrase';
const packageContent = 'sealed recovery metadata';
const rollbackContent = 'sealed rollback metadata';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const operationId = 'quarantined-v1-12345678-1234-4123-8123-123456789abc';
const rollbackId = '7'.repeat(32);

async function recoveryFixture(t, kind, rollbackRequested = false) {
  const root = await mkdtemp(join(tmpdir(), 'reader-recovery-admission-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { support, io, util } = localRecoveryFileProbe();
  const directory = join(root, 'reader-local-recovery');
  const journalPath = join(directory, 'restore.json');
  const packagePath = join(directory, 'pending.readerbackup');
  await mkdir(directory);

  const requests = [];
  const mutations = [];
  let onRequest = async () => {};
  let onJournalSaved = async () => {};
  let parentCommitted = false;
  const runtime = {
    getUIAbilityContext: () => ({ filesDir: root }),
    async request(method, params) {
      requests.push({ method, params });
      await onRequest(method, params);
      switch (method) {
        case 'library.package.inspect':
          assert.equal(params.password, passphrase);
          return { data: { packageSha256: sha256(params.content), scope: 'coreLibraryMetadata', localOriginals: [] } };
        case 'library.package.restore.status':
          return { data: { ...params, status: parentCommitted ? 'committedCurrent' : 'missing' } };
        case 'library.package.restore.apply':
          mutations.push({ method, params });
          parentCommitted = true;
          return { data: {} };
        case 'runtime.storage.backup.restore':
          mutations.push({ method, params });
          return { data: { restored: true, backupId: params.backupId, sha256: params.expectedSha256 } };
        default:
          assert.fail(`Unexpected request ${method}`);
      }
    },
  };
  const { LocalRecoveryGateway: Gateway } = pureModuleProbe(readFileSync(source, 'utf8'), 'LocalRecoveryGateway.ts', {
    ...support, fileIo: io, util, readerHostFilesDirectory: path => path,
    async replaceReaderAtomicSnapshot(path, _directory, content) {
      assert.equal(path, journalPath);
      mutations.push({ method: 'journal', content });
      await writeFile(path, content);
      await onJournalSaved();
    },
  }, ['LocalRecoveryGateway']);
  const gateway = new Gateway(runtime);
  const packageSha256 = sha256(packageContent);
  const header = Buffer.from(JSON.stringify({ content: packageContent, packageSha256, rows: [] }));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length);
  await support.sealRecoveryFile(packagePath, passphrase, async emit => {
    await emit(length);
    await emit(header);
  });
  const bundleSha256 = sha256(await readFile(packagePath));
  const rollbackSha256 = sha256(rollbackContent);
  if (kind === 'portable') await writeFile(join(directory, 'rollback.metadata'), rollbackContent);
  const journal = { schemaVersion: 1, operationId, packageSha256, bundleSha256, rollbackKind: kind, rollbackSha256 };
  if (kind === 'physical') journal.rollbackId = rollbackId;
  if (rollbackRequested) journal.rollbackRequested = true;
  const originalJournal = JSON.stringify(journal);
  await writeFile(journalPath, originalJournal);

  let current = true;
  const retire = () => { current = false; };
  async function admit() {
    if (!current) throw new Error('Local recovery opening retired');
  }
  async function assertPreserved(expected = originalJournal) {
    assert.equal(await readFile(journalPath, 'utf8'), expected);
    assert.equal(sha256(await readFile(packagePath)), bundleSha256);
    assert.equal((await readdir(directory)).some(name => name.startsWith('work-')), false);
  }
  return { gateway, requests, mutations, admit, retire, assertPreserved, journal, rollbackSha256,
    commitParent() { parentCommitted = true; },
    onRequest(callback) { onRequest = callback; },
    onJournalSaved(callback) { onJournalSaved = callback; } };
}

test('resume rechecks a retired opening after the metadata status read and retains the exact pending restore', async t => {
  const fixture = await recoveryFixture(t, 'portable');
  fixture.onRequest(method => { if (method === 'library.package.restore.status') fixture.retire(); });
  assert.deepEqual(await fixture.gateway.resumePackage(passphrase, fixture.admit), { state: 'interrupted' });
  assert.deepEqual(fixture.requests.map(item => item.method), ['library.package.inspect', 'library.package.restore.status']);
  assert.deepEqual(fixture.mutations, []);
  await fixture.assertPreserved();
  assert.deepEqual(await fixture.gateway.resumePackage(passphrase, async () => {}), {
    state: 'restored', included: 0, missing: 0,
  });
  assert.equal(fixture.mutations.length, 1);
  assert.equal(fixture.mutations[0].params.operationId, operationId);
});

for (const kind of ['physical', 'portable']) {
  test(`retiring during authenticated ${kind} rollback leaves the user's previous recovery decision unchanged`, async t => {
    const fixture = await recoveryFixture(t, kind);
    fixture.onRequest(method => { if (method === 'library.package.inspect') fixture.retire(); });
    assert.deepEqual(await fixture.gateway.rollbackPackage(passphrase, fixture.admit), { state: 'interrupted' });
    assert.deepEqual(fixture.requests.map(item => item.method), ['library.package.inspect']);
    assert.deepEqual(fixture.mutations, []);
    await fixture.assertPreserved();
  });
}

test('a durable physical rollback choice can be continued only by an admitted opening', async t => {
  const fixture = await recoveryFixture(t, 'physical', true);
  fixture.retire();
  assert.deepEqual(await fixture.gateway.resumePackage(passphrase, fixture.admit), { state: 'interrupted' });
  assert.deepEqual(fixture.requests, []);
  assert.deepEqual(fixture.mutations, []);
  await fixture.assertPreserved();
  assert.deepEqual(await fixture.gateway.resumePackage(passphrase, async () => {}), { state: 'rolledBack' });
  assert.deepEqual(fixture.mutations, [{
    method: 'runtime.storage.backup.restore',
    params: { backupId: rollbackId, expectedSha256: fixture.rollbackSha256 },
  }]);
});

test('a durable portable rollback choice keeps the original recovery receipt when the opening retires during status lookup', async t => {
  const fixture = await recoveryFixture(t, 'portable', true);
  fixture.onRequest(method => { if (method === 'library.package.restore.status') fixture.retire(); });
  assert.deepEqual(await fixture.gateway.resumePackage(passphrase, fixture.admit), { state: 'interrupted' });
  assert.deepEqual(fixture.requests.map(item => item.method), ['library.package.inspect', 'library.package.restore.status']);
  assert.deepEqual(fixture.mutations, []);
  await fixture.assertPreserved();
  assert.deepEqual(await fixture.gateway.resumePackage(passphrase, async () => {}), { state: 'rolledBack' });
  assert.equal(fixture.mutations.length, 1);
  assert.equal(fixture.mutations[0].params.operationId, 'rollback-v1-12345678-1234-4123-8123-123456789abc');
});

test('retiring while the rollback decision is saved defers physical dispatch without losing that choice', async t => {
  const fixture = await recoveryFixture(t, 'physical');
  fixture.onJournalSaved(() => fixture.retire());
  assert.deepEqual(await fixture.gateway.rollbackPackage(passphrase, fixture.admit), { state: 'interrupted' });
  assert.deepEqual(fixture.mutations.map(item => item.method), ['journal']);
  await fixture.assertPreserved(JSON.stringify({ ...fixture.journal, rollbackRequested: true }));
});

test('an already committed restore is finalized only by a current opening without issuing a duplicate write', async t => {
  const fixture = await recoveryFixture(t, 'portable');
  fixture.commitParent();
  fixture.onRequest(method => { if (method === 'library.package.restore.status') fixture.retire(); });
  assert.deepEqual(await fixture.gateway.resumePackage(passphrase, fixture.admit), { state: 'interrupted' });
  await fixture.assertPreserved();
  assert.deepEqual(await fixture.gateway.resumePackage(passphrase, async () => {}), {
    state: 'restored', included: 0, missing: 0,
  });
  assert.deepEqual(fixture.mutations, []);
});

test('an admitted restore finishes under its receipt if the opening retires during the Core write', async t => {
  const fixture = await recoveryFixture(t, 'portable');
  fixture.onRequest(method => { if (method === 'library.package.restore.apply') fixture.retire(); });
  assert.deepEqual(await fixture.gateway.resumePackage(passphrase, fixture.admit), {
    state: 'restored', included: 0, missing: 0,
  });
  assert.equal(fixture.mutations.length, 1);
  assert.equal(await fixture.gateway.pendingAction(), undefined);
});

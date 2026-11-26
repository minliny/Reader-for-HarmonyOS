import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { localRecoveryFileProbe } from './lib/local-recovery-file-probe.mjs';
import * as policy from '../entry/src/main/ets/backup/ReaderSystemMigrationPolicy.ts';

const root = new URL('../entry/src/main/', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const buffer = Buffer.from('portable system restore fixture\n'.repeat(22000));
const manifest = { format: 'reader.system-migration', version: 1, secret: 'f'.repeat(64),
  packageSha256: sha(buffer), packageBytes: buffer.length, includeOriginals: false };

function module(path, dependencies, ports) {
  return pureModuleProbe(readFileSync(new URL(path, root), 'utf8'), path.split('/').at(-1), dependencies, ports);
}

test('backup profile allows only the Reader payload and manifest in system temporary restore mode', () => {
  const profile = JSON.parse(readFileSync(new URL('resources/base/profile/reader_system_backup.json', root), 'utf8'));
  assert.deepEqual(profile, { allowToBackupRestore: true, fullBackupOnly: true, includes: [
    '/data/storage/el2/base/files/reader-system-migration-v1/manifest.json',
    '/data/storage/el2/base/files/reader-system-migration-v1/library.readerbackup',
  ] });
  const settings = readFileSync(new URL('ets/features/settings/ui/SettingsPage.ets', root), 'utf8');
  assert.match(settings, /系统备份包含本地原书/);
  assert.doesNotMatch(settings, /立即整机备份/);
});

test('system manifest admits bounded exact formats and rejects injected or malformed fields', () => {
  assert.equal(policy.readReaderSystemMigrationManifest(manifest), manifest);
  for (const bad of [
    { version: 2 }, { secret: '../old-secret' }, { packageBytes: 0 }, { packageBytes: 512 * 1024 * 1024 + 1 },
    { packageSha256: 'pretend-checksum' }, { includeOriginals: 'true' }, { originalPath: '/private/user/local.txt' },
  ]) {
    assert.throws(() => policy.readReaderSystemMigrationManifest({ ...manifest, ...bad }), /MANIFEST_INVALID/);
  }
});

async function sandbox(run) {
  const directory = await mkdtemp(join(tmpdir(), 'reader-system-migration-'));
  try {
    const incoming = join(directory, 'incoming'), pending = join(directory, 'pending');
    await mkdir(incoming);
    await writeFile(join(incoming, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(join(incoming, 'library.readerbackup'), buffer);
    const { io, support, util } = localRecoveryFileProbe();
    const filesystem = { ...io, rename: io.moveFile };
    const files = module('ets/backup/ReaderSystemMigrationFiles.ts', {
      fileIo: filesystem, util, ...policy, ...support,
      replaceReaderAtomicSnapshot: async (path, _parent, json) => writeFile(path, json),
    }, ['stageSystemMigration', 'readSystemMigrationManifest', 'finishSystemMigration',
      'copySystemMigrationPayload', 'systemMigrationPendingDirectory', 'systemMigrationPendingPayload']);
    await run({ incoming, pending, directory, files });
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('extension staging is idempotent for the exact package and preserves an earlier pending transfer', async () => {
  await sandbox(async ({ incoming, pending, files }) => {
    await files.stageSystemMigration(incoming, pending);
    await files.stageSystemMigration(incoming, pending);
    assert.deepEqual(await files.readSystemMigrationManifest(pending), manifest);
    assert.deepEqual(await readFile(files.systemMigrationPendingPayload(pending, manifest)), buffer);
    await writeFile(join(incoming, 'manifest.json'), JSON.stringify({ ...manifest, secret: 'e'.repeat(64) }));
    await assert.rejects(files.stageSystemMigration(incoming, pending), /ALREADY_PENDING/);
    assert.deepEqual(await files.readSystemMigrationManifest(pending), manifest);
  });
});

test('corrupt restored bytes and a linked extraction directory cannot create a pending journal', async () => {
  await sandbox(async ({ incoming, pending, directory, files }) => {
    await writeFile(join(incoming, 'library.readerbackup'), Buffer.from(buffer).fill(0x51));
    await assert.rejects(files.stageSystemMigration(incoming, pending), /PAYLOAD_CHANGED/);
    assert.equal(await files.readSystemMigrationManifest(pending), undefined);
    const link = join(directory, 'link');
    await symlink(incoming, link);
    await assert.rejects(files.stageSystemMigration(link, pending), /DIRECTORY_INVALID/);
    assert.equal(await files.readSystemMigrationManifest(pending), undefined);
  });
});

test('cold startup retains interrupted data, then consumes exactly the verified journal after restore', async () => {
  await sandbox(async ({ incoming, directory, files }) => {
    const pending = files.systemMigrationPendingDirectory(directory);
    await files.stageSystemMigration(incoming, pending);
    const received = join(directory, 'received.readerbackup');
    const owner = {};
    let fail = true;
    const start = module('ets/backup/ReaderSystemMigrationStartup.ts', {
      ...files,
      LocalRecoveryGateway: class {
        constructor(runtime) { assert.equal(runtime, owner); }
        async restoreSystemStagedPackage(secret, hash, receive) {
          assert.equal(secret, manifest.secret);
          assert.equal(hash, manifest.packageSha256);
          assert.equal(await receive(received), true);
          return { state: fail ? 'interrupted' : 'restored' };
        }
      },
    }, ['resumeReaderSystemMigration']).resumeReaderSystemMigration;
    assert.equal(await start(directory, owner, () => true), 'interrupted');
    assert.deepEqual(await files.readSystemMigrationManifest(pending), manifest);
    fail = false;
    assert.equal(await start(directory, owner, () => true), 'restored');
    assert.deepEqual(await readFile(received), buffer);
    assert.equal(await files.readSystemMigrationManifest(pending), undefined);
    assert.equal(await start(directory, owner, () => true), 'none');
  });
});

test('the system restore callback queues only the extraction directory and reports a missing manifest with payload', async () => {
  let accepted = true;
  const queued = [];
  const Backup = selectedProductionMethods(new URL('ets/backup/ReaderBackupExtensionAbility.ets', root),
    'ReaderBackupExtensionAbility', ['onRestoreEx'], {
      ...policy,
      migrationResult: (error = '') => ({ error }),
      fileIo: { access: async () => true },
      readSystemMigrationManifest: async () => accepted ? manifest : undefined,
      systemMigrationPayload: directory => join(directory, 'library.readerbackup'),
      systemMigrationPendingDirectory: directory => join(directory, 'pending'),
      stageSystemMigration: async (from, to) => queued.push([from, to]),
    });
  const backup = Object.assign(new Backup(), { context: {
    backupDir: '/sdk-private', getApplicationContext: () => ({ filesDir: '/reader-files' }),
  } });
  assert.deepEqual(await backup.onRestoreEx({}, '{}'), { error: '' });
  assert.deepEqual(queued, [['/sdk-private/restore/data/storage/el2/base/files/reader-system-migration-v1', '/reader-files/pending']]);
  accepted = false;
  assert.deepEqual(await backup.onRestoreEx({}, '{}'), { error: 'READER_SYSTEM_MIGRATION_MANIFEST_MISSING' });
  assert.equal(queued.length, 1);
});

test('backup reserves before preferences, releases the owner after failure, and retains release cleanup', async () => {
  let settlePreferences;
  const prefs = new Promise(resolve => { settlePreferences = resolve; });
  let attempts = 0;
  const removed = [];
  const Backup = selectedProductionMethods(new URL('ets/backup/ReaderBackupExtensionAbility.ets', root),
    'ReaderBackupExtensionAbility', ['generation', 'backup', 'releaseTask', 'onBackupEx', 'prepareBackup', 'onRelease', 'clearReleasedArchive'], {
      ...policy,
      migrationResult: (error = '') => ({ error }),
      fileIo: {
        lstat: async path => ({ isDirectory: () => path.endsWith(policy.READER_SYSTEM_MIGRATION_DIRECTORY), isFile: () => true }),
        listFile: async () => [], unlink: async path => removed.push(path),
      },
      systemMigrationPayload: directory => join(directory, 'library.readerbackup'),
      readerSystemMigrationIncludesOriginals: () => prefs,
      createReaderSystemMigrationArchive: async (_extension, directory, include, current) => {
        assert.equal(directory, '/reader-files');
        assert.equal(include, false);
        assert.equal(current(), true);
        if (++attempts === 1) throw new Error('transient export failure');
      },
    });
  const backup = Object.assign(new Backup(), { context: {
    filesDir: '/extension-files', getApplicationContext: () => ({ filesDir: '/reader-files' }),
  } });
  const first = backup.onBackupEx('{}');
  assert.deepEqual(await backup.onBackupEx('{}'), { error: 'READER_SYSTEM_MIGRATION_EXPORT_BUSY' });
  settlePreferences(false);
  assert.deepEqual(await first, { error: 'READER_SYSTEM_MIGRATION_EXPORT_FAILED' });
  assert.equal(backup.backup, undefined);
  assert.deepEqual(await backup.onBackupEx('{}'), { error: '' });
  assert.equal(backup.backup, undefined);
  await backup.onRelease(1);
  assert.deepEqual(removed, ['/reader-files/reader-system-migration-v1/manifest.json',
    '/reader-files/reader-system-migration-v1/library.readerbackup']);
});

test('release waits for export, reclaims only owned staging and is safe to repeat', async () => {
  await sandbox(async ({ directory }) => {
    const app = join(directory, 'app'), extension = join(directory, 'extension');
    const published = join(app, policy.READER_SYSTEM_MIGRATION_DIRECTORY);
    const work = join(extension, policy.READER_SYSTEM_MIGRATION_EXPORT_WORK_DIRECTORY);
    const stale = join(published, 'library-stale.stage');
    const linkedStage = join(published, 'library-linked.stage');
    const original = join(app, 'retained.txt');
    const pending = join(app, policy.READER_SYSTEM_MIGRATION_PENDING_DIRECTORY, 'manifest.json');
    for (const output of [stale, join(published, 'library.readerbackup'), join(published, 'manifest.json'),
      join(published, 'other.stage'), join(work, 'reader-local-recovery', 'work-interrupted', 'quarantine'), original, pending]) {
      await mkdir(join(output, '..'), { recursive: true });
      await writeFile(output, 'retained fixture');
    }
    await symlink(original, linkedStage);
    let started, finish;
    const exporting = new Promise(resolve => { started = resolve; });
    const exportHeld = new Promise(resolve => { finish = resolve; });
    const Backup = selectedProductionMethods(new URL('ets/backup/ReaderBackupExtensionAbility.ets', root),
      'ReaderBackupExtensionAbility', ['generation', 'backup', 'releaseTask', 'onBackupEx', 'prepareBackup', 'onRelease', 'clearReleasedArchive'], {
        ...policy, migrationResult: (error = '') => ({ error }),
        fileIo: { lstat, listFile: readdir, unlink, rmdir: path => rm(path, { recursive: true }) },
        systemMigrationPayload: path => join(path, 'library.readerbackup'),
        readerSystemMigrationIncludesOriginals: async () => false,
        createReaderSystemMigrationArchive: async () => { started(); await exportHeld; },
      });
    const backup = Object.assign(new Backup(), { context: {
      filesDir: extension, getApplicationContext: () => ({ filesDir: app }),
    } });
    const completing = backup.onBackupEx('{}');
    await exporting;
    const firstRelease = backup.onRelease(1);
    const secondRelease = backup.onRelease(1);
    try {
      assert.deepEqual(await backup.onBackupEx('{}'), { error: 'READER_SYSTEM_MIGRATION_EXPORT_BUSY' });
      assert.ok((await lstat(work)).isDirectory());
      assert.ok((await lstat(stale)).isFile());
    } finally { finish(); }
    assert.deepEqual(await completing, { error: 'READER_SYSTEM_MIGRATION_EXPORT_CANCELLED' });
    await Promise.all([firstRelease, secondRelease]);
    await backup.onRelease(1);
    await assert.rejects(lstat(work), { code: 'ENOENT' });
    assert.deepEqual((await readdir(published)).sort(), ['library-linked.stage', 'other.stage']);
    assert.equal(await readFile(original, 'utf8'), 'retained fixture');
    assert.equal(await readFile(pending, 'utf8'), 'retained fixture');
    assert.ok((await lstat(linkedStage)).isSymbolicLink());

    await symlink(app, work);
    await backup.onRelease(1);
    assert.ok((await lstat(work)).isSymbolicLink());
    assert.equal(await readFile(original, 'utf8'), 'retained fixture');
  });
});

test('system archive reads the admitted application database through the read-only SDK port', async () => {
  const identity = { format: 'reader.storage-bootstrap-identity', version: 1, buildId: 'b', contractSha256: 'c', coreInputFingerprint: 'd' };
  const calls = [];
  const create = module('ets/backup/ReaderSystemMigrationExport.ts', {
    ...policy,
    fileIo: { access: async path => path === '/reader-files/reader-core' },
    util: { generateRandomUUID: () => 'f'.repeat(32),
      TextDecoder: { create: () => ({ decodeToString: bytes => Buffer.from(bytes).toString('utf-8') }) } },
    probeReaderCoreStorageAsync: async (path, current) => {
      calls.push(['readOnlyAdmission', path]); assert.equal(current(), true);
      return { buildIdentity: { buildId: 'b' }, contractSha256: 'c', coreInputFingerprint: 'd',
        observation: { freshStorage: false, requiresMigration: false } };
    },
    exportReaderCoreLibraryReadOnlyAsync: async (path, secret, current) => {
      calls.push(['readOnlyExport', path]); assert.equal(current(), true); assert.match(secret, /^f{64}$/);
      return { content: 'ciphertext', packageSha256: sha('ciphertext'), localOriginals: [] };
    },
    ensureSystemMigrationDirectory: async () => {}, systemMigrationPayload: directory => join(directory, 'library.readerbackup'),
    ReaderLocalRecoveryExportPort: class { constructor(path) { assert.equal(path, '/reader-files'); } },
    LocalRecoveryGateway: class {
      constructor(runtime, port) { assert.equal(runtime, undefined); this.port = port; }
      async exportStagedPackage(phrase, include) {
        assert.equal(include, false);
        assert.match(this.port.filesDir, /^\/extension-private\//);
        assert.equal((await this.port.capture(phrase)).content, 'ciphertext');
        return { state: 'exported' };
      }
    },
  }, ['createReaderSystemMigrationArchive']).createReaderSystemMigrationArchive;
  await create({ filesDir: '/extension-private', resourceManager: {
    getRawFileContent: async () => Buffer.from(JSON.stringify(identity)),
  } }, '/reader-files', false, () => true);
  assert.deepEqual(calls, [['readOnlyAdmission', '/reader-files/reader-core'], ['readOnlyExport', '/reader-files/reader-core']]);
});

test('lost startup acknowledgement reuses the exact library restore identity and rejects a different local recovery', async () => {
  const functions = module('ets/features/bookshelf/application/LocalRecoveryGateway.ts', {},
    ['systemRecoveryOperationId', 'isSystemRecovery']);
  const Gateway = selectedProductionMethods(new URL('ets/features/bookshelf/application/LocalRecoveryGateway.ts', root),
    'LocalRecoveryGateway', ['restoreSystemStagedPackage'], {
      ...functions, HASH: /^[a-f0-9]{64}$/, MAX_ORIGINAL_BYTES: 67108864,
      fileIo: { stat: async () => ({ size: manifest.packageBytes }), moveFile: async () => {} },
      recoveryReserve: async () => {}, recoveryHashFile: async () => manifest.packageSha256,
      replaceReaderAtomicSnapshot: async (_path, _parent, json) => { accepted = JSON.parse(json); },
    });
  let accepted;
  const applied = [];
  const archive = { packageSha256: 'a'.repeat(64), rows: [] };
  const gateway = Object.assign(new Gateway(), {
    requireRuntime() {}, perform: (_passphrase, operation) => operation('/staging'),
    reject() { throw new Error('invalid'); }, checkCurrent() {},
    readJournal: async () => accepted, open: async () => archive, openPending: async () => archive,
    checkOriginalsReadable: async () => {}, syncDirectory: async () => {}, clearUnaccepted: async () => {},
    request: async (_method, intent) => ({ ...intent, status: applied.length === 0 ? 'missing' : 'committedCurrent' }),
    packagePath: () => '/staged.readerbackup', journalPath: () => '/restore.json',
    prepareJournal: async (packageSha256, bundleSha256, _password, operationId) => ({ packageSha256, bundleSha256, operationId }),
    apply: async (_work, _archive, journal) => { applied.push(journal.operationId); return { state: 'restored' }; },
  });
  const run = receive => gateway.restoreSystemStagedPackage(manifest.secret, manifest.packageSha256, receive, () => true);
  assert.equal((await run(async () => true)).state, 'restored');
  assert.equal((await run(async () => assert.fail('already-staged package is reused'))).state, 'restored');
  accepted = undefined;
  assert.equal((await run(async () => true)).state, 'restored');
  assert.deepEqual(new Set(applied).size, 1);
  accepted = { ...accepted, operationId: 'different-local-restore' };
  assert.equal((await run(async () => assert.fail('a different local restore keeps its owner'))).state, 'interrupted');
});

test('legacy and new system-owned recovery receipts cannot be adopted or rolled back by password UI', async () => {
  const url = 'ets/features/bookshelf/application/LocalRecoveryGateway.ts';
  const functions = module(url, {}, ['systemRecoveryOperationId', 'isSystemRecovery']);
  const Gateway = selectedProductionMethods(new URL(url, root), 'LocalRecoveryGateway',
    ['pendingAction', 'resumePackage', 'rollbackPackage'], functions);
  for (const origin of [undefined, 'system']) {
    const journal = { origin, operationId: functions.systemRecoveryOperationId(manifest.packageSha256), bundleSha256: manifest.packageSha256 };
    const gateway = Object.assign(new Gateway(), { requireRuntime() {}, readJournal: async () => journal,
      perform: (_passphrase, run) => run('/staging') });
    assert.equal(await gateway.pendingAction(), 'system');
    assert.deepEqual(await gateway.resumePackage('some user phrase'), { state: 'interrupted' });
    assert.deepEqual(await gateway.rollbackPackage('some user phrase'), { state: 'interrupted' });
  }
});

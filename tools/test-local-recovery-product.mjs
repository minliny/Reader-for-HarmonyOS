import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, readFileSync, renameSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localRecoveryFileProbe } from './lib/local-recovery-file-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { readerHostFilesDirectory } from '../entry/src/main/ets/app/diagnostics/ReaderPublicFixtureScope.ts';
import { isReaderLocalBookFileName } from '../entry/src/main/ets/app/ReaderLocalBookFormatAdmission.ts';
import { localImportFailure } from '../entry/src/main/ets/app/LocalImportFailure.ts';
import { ReaderDocumentPickerActivity } from '../entry/src/main/ets/platform/ReaderDocumentPickerActivity.ts';

const nativePath = process.env.READER_LOCAL_RECOVERY_TEST_NATIVE;
assert.ok(nativePath, 'READER_LOCAL_RECOVERY_TEST_NATIVE must point to the desktop Core reader.node');
const native = createRequire(import.meta.url)(resolve(nativePath));
const { support, io, util, statvfs, crypto, handles, setPicker } = localRecoveryFileProbe();
const unlink = io.unlink;
let failWebDavCiphertextCleanup = false;
io.unlink = async path => {
  if (failWebDavCiphertextCleanup && path.includes('/reader-webdav-library/') && path.endsWith('.readerbackup')) {
    failWebDavCiphertextCleanup = false;
    throw Object.assign(new Error('controlled WebDAV ciphertext unlink failure'), { code: 'EACCES' });
  }
  return unlink(path);
};
const etsRoot = new URL('../entry/src/main/ets/', import.meta.url);
function actualModule(path, dependencies, names) {
  return pureModuleProbe(readFileSync(new URL(path, etsRoot), 'utf8'), basename(path), dependencies, names);
}
const fileUri = { getUriFromPath: path => pathToFileURL(path).href,
  FileUri: class { constructor(uri) { this.name = basename(fileURLToPath(uri)); } } };
const errorMessageOf = error => error instanceof Error ? error.message : String(error);
const HostRegistry = selectedProductionMethods(new URL('app/ReaderHostRegistry.ts', etsRoot), 'ReaderHostRegistry', [
  'LocalBookLimitBytes', 'StageSpaceReserveBytes', 'HashChunkBytes', 'stageSequences', 'stagingReservations', 'deferredStages',
  'prepareSystemLocalBookInput', 'ensureStageRecovery', 'requireSelectedFileName', 'stageLocalBook', 'copyAndHashLocalBook',
  'digestToHex', 'commitLocalBookInput', 'discardLocalBookInput', 'retainedLocalBookSourcePath', 'rollbackLocalBookAsset',
  'localBookStageDirectory', 'localBookAssetDirectory', 'requireLocalBookHash', 'requireLocalBookStagePath',
  'requireLocalBookAssetPath', 'unlinkIfPresent', 'isMissingFile', 'ensureDirectory', 'nextStagePath', 'pendingLocalImportFinalizeDirectory',
], { fileIo: io, fileUri, statvfs, cryptoFramework: crypto, isReaderLocalBookFileName, localImportFailure, errorMessageOf });

// AtomicFile is the platform seam. SDK-emitted production code retains the
// actual write/finish/fsync order, including both file and directory syncs.
io.AtomicFile = class {
  constructor(path) { this.path = path; this.temporary = `${path}.writing`; }
  startWrite() { return createWriteStream(this.temporary); }
  finishWrite() { renameSync(this.temporary, this.path); }
  failWrite() { rmSync(this.temporary, { force: true }); }
};
const { replaceReaderAtomicSnapshot } = actualModule('app/ReaderAtomicSnapshotFile.ts', { fileIo: io }, ['replaceReaderAtomicSnapshot']);
let currentRuntime;
const ReaderRuntimeOwner = { current: () => currentRuntime, isCurrent: runtime => runtime === currentRuntime };
const gatewayPath = new URL('features/bookshelf/application/LocalRecoveryGateway.ts', etsRoot);
const gatewaySource = readFileSync(gatewayPath, 'utf8');
const { LocalRecoveryGateway } = pureModuleProbe(gatewaySource, 'LocalRecoveryGateway.ts',
  { fileIo: io, fileUri, util, ReaderRuntimeOwner, replaceReaderAtomicSnapshot, readerHostFilesDirectory,
    isReaderLocalBookFileName, ...support }, ['LocalRecoveryGateway']);
const { LocalBookImportGateway } = actualModule('features/bookshelf/application/LocalBookImportGateway.ts', {
  ReaderRuntimeOwner, localImportFailure, errorMessageOf, hilog: { warn() {}, error() {} },
  ReaderCoreGateway: class { constructor(runtime) { this.runtime = runtime; }
    async upsertBook(params) { return (await this.runtime.request('bookshelf.add', params)).data; } },
}, ['LocalBookImportGateway']);

const root = await mkdtemp(join(tmpdir(), 'reader-local-recovery-product-'));
const alive = new Set();
async function openRuntime(name, receiverEvents = []) {
  const filesDir = join(root, name), dataDirectory = join(filesDir, 'reader-core');
  await mkdir(filesDir, { recursive: true });
  // Match the normal Host startup protocol, including explicit migration
  // only when the actual Core storage admission reports one.
  const admission = JSON.parse(await native.probeStorageAsync(dataDirectory)).observation;
  assert.ok(admission);
  const config = admission.requiresMigration ? { dataDirectory, storageMigration: admission.explicitMigration } : { dataDirectory };
  const handle = await native.createRuntimeAsync(config);
  alive.add(handle);
  const host = Object.assign(new HostRegistry(), { context: { filesDir }, stageRecovery: Promise.resolve() });
  let requestId = 20;
  const runtime = { dataDirectory, filesDir,
    readLibraryBackupIdentity: async () => name === 'webdav-receiver' ?
      { libraryId: 'b'.repeat(32), writerInstanceId: '2'.repeat(64) } :
      { libraryId: 'a'.repeat(32), writerInstanceId: '1'.repeat(64) },
    getUIAbilityContext: () => host.context,
    prepareSystemLocalBookInput: uri => host.prepareSystemLocalBookInput(uri),
    commitLocalBookInput: input => host.commitLocalBookInput(input),
    discardLocalBookInput: input => host.discardLocalBookInput(input),
    rollbackLocalBookAsset: commit => host.rollbackLocalBookAsset(commit),
    retainedLocalBookSourcePath: (bookId, current) => host.retainedLocalBookSourcePath(bookId, current),
    enqueuePendingLocalImportFinalize: async () => assert.fail('fresh donor should finalize'),
    async request(method, params) {
      const id = requestId++;
      native.sendCommand(handle, { protocolVersion: 1, requestId: id, method, params });
      const end = Date.now() + 120_000;
      while (Date.now() < end) {
        const raw = native.readEvent(handle, 0);
        if (raw == null) { await delay(5); continue; }
        const event = JSON.parse(raw);
        if (event.requestId !== id) continue;
        if (event.type === 'error') {
          console.log(JSON.stringify({ method, status: 'error', code: event.error?.code, message: event.error?.message }));
          throw { event };
        }
        if (event.type === 'result') {
          receiverEvents.push({ method, status: event.data?.status, packageSha256: event.data?.packageSha256 });
          if (runtime.loseApplyAck && method === 'library.package.restore.apply') {
            runtime.loseApplyAck = false;
            throw Error('controlled loss of actual Core apply terminal');
          }
          return event;
        }
        if (event.type === 'hostRequest') throw Error(`unexpected platform request during local ${method}`);
      }
      throw Error(`Desktop Core request timed out: ${method}`);
    },
    close() { if (alive.delete(handle)) native.releaseRuntime(handle); },
  };
  return runtime;
}

const current = () => true;
const hash = data => createHash('sha256').update(data).digest('hex');
async function hashFile(path) {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(path)) digest.update(bytes);
  return digest.digest('hex');
}
async function importBook(runtime, filename, line) {
  const bytes = Buffer.from(`第一章 开始\n${line}。\n这里有完整的测试正文。\n第二章 继续\n正文依旧可以阅读。`);
  const path = join(root, filename);
  await writeFile(path, bytes);
  const prepared = await runtime.prepareSystemLocalBookInput(pathToFileURL(path).href);
  assert.equal(prepared.state, 'ready');
  const result = await new LocalBookImportGateway(runtime).importPreparedSelections([prepared]);
  assert.equal(result.imported, 1, JSON.stringify(result));
  assert.equal(result.items[0].cleanupDeferred, undefined);
  return { bookId: prepared.input.bookId, bytes, line };
}
async function shelf(runtime) { return (await runtime.request('bookshelf.list', { limit: 40 })).data; }
async function chapter(runtime, bookId) {
  return (await runtime.request('chapter.content', { sourceId: 'local', bookId, chapterIndex: 0, cacheOnly: true })).data;
}
function choose(kind, path) {
  setPicker(async actual => {
    assert.equal(actual, kind);
    assert.equal(ReaderDocumentPickerActivity.isPending(), true);
    return [pathToFileURL(path).href];
  });
}

function simulatedWebDav() {
  const base = 'https://backup.example.invalid/dav';
  const directory = '/ReaderLibrary';
  const collection = new URL(base + directory + '/');
  const remote = new Map();
  const requests = [];
  let failManifestReadback = false;
  let manifestDispatched = false;
  let uptime = 9000000;
  let failPartDeletion = false;
  const systemDateTime = { TimeType: { STARTUP: 0 }, getUptime: () => uptime };
  let saved = {
    saveOperationId: 'f022f1c7-7003-476b-a280-c0f10447f75d', savePayloadHash: 'a'.repeat(64),
    config: { url: base, directory, user: '', password: '', backupPassword: 'fixture recovery passphrase' },
  };
  const http = {
    async executeWebDav(endpoint, params, maximum, cancelled) {
      assert.equal(endpoint, base);
      assert.equal(cancelled(), false);
      const target = new URL(params.url);
      assert.equal(target.origin, collection.origin);
      assert.ok(target.pathname === collection.pathname.slice(0, -1) || target.pathname.startsWith(collection.pathname));
      const name = target.pathname.slice(collection.pathname.length);
      requests.push([params.method, name]);
      const response = (status, bytes = Buffer.alloc(0), headers = {}) => {
        assert.ok(bytes.length <= maximum);
        return { status, bytes, headers, finalUrl: target.href };
      };
      if (params.method === 'PROPFIND') return response(207, Buffer.from(
        `<D:multistatus xmlns:D="DAV:">${Array.from(remote.keys(), key =>
          `<D:response><D:href>${collection.pathname}${key}</D:href><D:propstat><D:prop><D:getlastmodified>Wed, 25 Nov 2026 02:00:00 GMT</D:getlastmodified></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`).join('')}</D:multistatus>`));
      if (params.method === 'DELETE') {
        if (failPartDeletion && name.endsWith('.part')) { failPartDeletion = false; return response(503); }
        const current = remote.get(name);
        if (current === undefined) return response(404);
        if (params.headers['If-Match'] !== `"${hash(current)}"`) return response(412);
        remote.delete(name);
        return response(204);
      }
      if (params.method === 'GET') {
        if (failManifestReadback && manifestDispatched && name.endsWith('.manifest')) {
          failManifestReadback = false;
          throw Error('controlled loss of readback');
        }
        const body = remote.get(name);
        if (body === undefined) return response(404);
        const ETag = `"${hash(body)}"`;
        if (params.headers['If-Match'] !== undefined && params.headers['If-Match'] !== ETag) return response(412);
        return response(200, body, { ETag, 'Content-Type': 'text/plain; charset=UTF-8' });
      }
      assert.equal(params.method, 'PUT');
      assert.equal(params.headers['If-None-Match'], '*');
      if (remote.has(name)) return response(412);
      remote.set(name, Buffer.from(params.body));
      if (name.endsWith('.manifest')) manifestDispatched = true;
      return response(201);
    },
  };
  const url = { URL: { parseURL: (value, parent) => new URL(value, parent) } };
  const transportUtil = { ...util, Base64Helper: class {
    encodeToStringSync(bytes) { return Buffer.from(bytes).toString('base64'); }
    decodeSync(value) { return Buffer.from(value, 'base64'); }
  } };
  const HttpExecuteHost = { instance: http };
  const transport = actualModule('features/sync/application/WebDavLibraryBackup.ts',
    { ...support, HttpExecuteHost, url, util: transportUtil, systemDateTime },
    ['WebDavLibraryBackup', 'WebDavLibraryBackupError', 'WEB_DAV_ARCHIVE_READ_WINDOW']);
  const { SyncGateway } = actualModule('features/sync/application/SyncGateway.ts', {
    ...transport, ...support, fileIo: io, replaceReaderAtomicSnapshot, readerHostFilesDirectory, HttpExecuteHost,
    url, util: transportUtil, systemDateTime, ReaderRuntimeOwner, SyncHostConfigurationGateway: class {},
  }, ['SyncGateway']);
  const credentials = { async requireConfigSettled() {}, async reconcileConfigIntent() {}, loadSerializedState: async () => saved };
  return {
    remote, requests, gateway: runtime => new SyncGateway(runtime, credentials),
    loseReadback: () => { failManifestReadback = true; },
    moveClock: (millis) => { uptime += millis; },
    failNextPartDeletion: () => { failPartDeletion = true; },
    setConfigRevision(other) {
      saved = { ...saved, saveOperationId: other ? 'cb49db58-9038-4e28-869f-3dd66f2d1b11' : 'f022f1c7-7003-476b-a280-c0f10447f75d' };
    },
  };
}

try {
  ReaderDocumentPickerActivity.bind(7);
  ReaderDocumentPickerActivity.setForeground(true);
  const donor = await openRuntime('donor');
  const info = (await donor.request('core.info', {})).data;
  console.log(JSON.stringify({ coreBuild: info.buildIdentity?.buildId, nativeSha256: await hashFile(nativePath),
    gatewaySha256: hash(gatewaySource) }));
  const complete = await importBook(donor, 'Donor.txt', '这是恢复后必须重新读取的原书内容');
  const missing = await importBook(donor, 'Missing.txt', '这本书不带原件');
  await rm(await donor.retainedLocalBookSourcePath(missing.bookId, current));
  const packagePath = join(root, 'fixture.readerbackup'), passphrase = 'fixture recovery passphrase';
  currentRuntime = donor;
  choose('save', packagePath);
  const exported = await new LocalRecoveryGateway().exportPackage(passphrase, current);
  assert.deepEqual(exported, { state: 'exported', included: 1, missing: 1 });
  assert.ok((await stat(packagePath)).size > complete.bytes.length);
  donor.close();
  console.log('PASS actual donor import, metadata/original manifest, encrypted local export and exact file readback');

  const events = [];
  let receiver = await openRuntime('receiver', events);
  const receiverInfo = (await receiver.request('core.info', {})).data;
  console.log(JSON.stringify({ receiverFormat: receiverInfo.storageFormat?.format, userVersion: receiverInfo.sqliteUserVersion }));
  assert.equal(receiverInfo.storageFormat?.format, 'legacy');
  const old = await importBook(receiver, 'Receiver.txt', '接收端的旧原书保持可读');
  const before = await shelf(receiver);
  const beforeChapter = await chapter(receiver, old.bookId);
  currentRuntime = receiver;
  let gateway = new LocalRecoveryGateway();
  const changed = join(root, 'damaged.readerbackup');
  const tampered = Buffer.from(await readFile(packagePath));
  tampered[tampered.length - 17] ^= 1;
  await writeFile(changed, tampered);
  const beforeCheck = events.length;
  for (const [path, phrase] of [[packagePath, 'wrong fixture phrase'], [changed, passphrase]]) {
    choose('select', path);
    assert.deepEqual(await gateway.inspectPackage(phrase, current), { state: 'rejected' });
    assert.deepEqual(await shelf(receiver), before);
    assert.deepEqual(await chapter(receiver, old.bookId), beforeChapter);
    assert.equal(await gateway.pending(), false);
  }
  assert.ok(events.slice(beforeCheck).every(event => ['bookshelf.list', 'chapter.content'].includes(event.method)));
  console.log('PASS wrong passphrase and ciphertext tampering preserve the native receiver library and readable original');

  choose('select', packagePath);
  assert.deepEqual(await gateway.inspectPackage(passphrase, current), { state: 'preview', included: 1, missing: 1 });
  assert.deepEqual(await shelf(receiver), before);
  receiver.loseApplyAck = true;
  assert.deepEqual(await gateway.applyPackage(passphrase), { state: 'interrupted' });
  assert.equal(await gateway.pending(), true);
  const journalPath = join(receiver.filesDir, 'reader-local-recovery', 'restore.json');
  const journal = JSON.parse(await readFile(journalPath, 'utf8'));
  assert.equal(journal.rollbackKind, 'portable');
  const rollback = join(receiver.filesDir, 'reader-local-recovery', 'rollback.metadata');
  const rollbackBytes = await readFile(rollback);
  assert.equal(hash(rollbackBytes), journal.rollbackSha256);
  const rollbackCapture = events.filter(event => event.method === 'library.package.export');
  assert.deepEqual(rollbackCapture.map(event => event.packageSha256), [journal.rollbackSha256]);
  assert.equal(events.filter(event => event.method === 'library.package.restore.apply').length, 1);
  receiver.close();

  receiver = await openRuntime('receiver', events);
  currentRuntime = receiver;
  gateway = new LocalRecoveryGateway();
  assert.equal(await gateway.pending(), true);
  const rollbackChanged = Buffer.from(rollbackBytes);
  rollbackChanged[0] ^= 1;
  await writeFile(rollback, rollbackChanged);
  const attempts = events.length;
  assert.deepEqual(await gateway.resumePackage(passphrase), { state: 'interrupted' });
  assert.equal(await gateway.pending(), true);
  assert.equal(events.length, attempts, 'changed rollback material must be rejected before Core dispatch');
  await writeFile(rollback, rollbackBytes);
  const resumed = await gateway.resumePackage(passphrase);
  assert.deepEqual(resumed, { state: 'restored', included: 1, missing: 1 });
  assert.equal(await gateway.pending(), false);
  assert.equal(events.filter(event => event.method === 'library.package.restore.apply').length, 1, 'resume observes original committed Core operation');
  assert.equal(events.filter(event => event.method === 'library.package.export').length, 1);
  const restoredShelf = JSON.stringify(await shelf(receiver));
  assert.match(restoredShelf, new RegExp(complete.bookId));
  assert.match(restoredShelf, new RegExp(missing.bookId));
  assert.doesNotMatch(restoredShelf, new RegExp(old.bookId));
  assert.ok(JSON.stringify(await chapter(receiver, complete.bookId)).includes(complete.line));
  assert.equal(await receiver.retainedLocalBookSourcePath(missing.bookId, current), undefined);
  assert.deepEqual(await readFile(await receiver.retainedLocalBookSourcePath(complete.bookId, current)), complete.bytes);
  assert.deepEqual(await readFile(await receiver.retainedLocalBookSourcePath(old.bookId, current)), old.bytes);
  receiver.close();
  console.log('PASS interrupted Core apply survives cold reopen, retains the exact rollback point and restores raw TXT with a separate missing-original fact');

  const rollbackEvents = [];
  let rollbackReceiver = await openRuntime('rollback-receiver', rollbackEvents);
  const prior = await importBook(rollbackReceiver, 'RollbackBefore.txt', '回退后仍必须能够读取');
  currentRuntime = rollbackReceiver;
  gateway = new LocalRecoveryGateway();
  choose('select', packagePath);
  assert.deepEqual(await gateway.inspectPackage(passphrase, current), { state: 'preview', included: 1, missing: 1 });
  rollbackReceiver.loseApplyAck = true;
  assert.deepEqual(await gateway.applyPackage(passphrase), { state: 'interrupted' });
  assert.equal(await gateway.pendingAction(), 'restore');
  assert.deepEqual(await gateway.rollbackPackage('wrong recovery password'), { state: 'rejected' });
  assert.equal(await gateway.pendingAction(), 'restore', 'an unverified rollback does not replace the pending restore decision');
  rollbackReceiver.loseApplyAck = true;
  assert.deepEqual(await gateway.rollbackPackage(passphrase), { state: 'interrupted' });
  assert.equal(await gateway.pendingAction(), 'rollback', 'rollback decision is durable before its Core mutation');
  rollbackReceiver.close();
  rollbackReceiver = await openRuntime('rollback-receiver', rollbackEvents);
  currentRuntime = rollbackReceiver;
  gateway = new LocalRecoveryGateway();
  assert.equal(await gateway.pendingAction(), 'rollback');
  assert.deepEqual(await gateway.resumePackage(passphrase), { state: 'rolledBack' });
  assert.equal(await gateway.pending(), false);
  assert.equal(rollbackEvents.filter(event => event.method === 'library.package.restore.apply').length, 2,
    'retry observes the original restore and rollback receipts without another apply');
  const rolledBackShelf = JSON.stringify(await shelf(rollbackReceiver));
  assert.match(rolledBackShelf, new RegExp(prior.bookId));
  assert.doesNotMatch(rolledBackShelf, new RegExp(complete.bookId));
  assert.ok(JSON.stringify(await chapter(rollbackReceiver, prior.bookId)).includes(prior.line));
  rollbackReceiver.close();
  console.log('PASS portable rollback admission rejects wrong passphrase and cold-resumes one exact rollback with readable original');

  let webDavDonor = await openRuntime('donor');
  currentRuntime = webDavDonor;
  const provider = simulatedWebDav();
  let sync = provider.gateway(webDavDonor);
  gateway = new LocalRecoveryGateway();
  provider.loseReadback();
  assert.deepEqual(await sync.backupLibrary(gateway, true, current), { state: 'unconfirmed' });
  assert.equal((await sync.libraryBackupConfiguration()).pendingPublication, true);
  const objectNames = Array.from(provider.remote.keys());
  const publishActions = provider.requests.filter(([verb, name]) => verb === 'PUT' && name.endsWith('.manifest'));
  webDavDonor.close();
  webDavDonor = await openRuntime('donor');
  currentRuntime = webDavDonor;
  sync = provider.gateway(webDavDonor);
  assert.equal((await sync.libraryBackupConfiguration()).pendingPublication, true);
  failWebDavCiphertextCleanup = true;
  assert.deepEqual(await sync.backupLibrary(new LocalRecoveryGateway(), false, current), { state: 'cleanupPending' });
  assert.deepEqual(Array.from(provider.remote.keys()), objectNames, 'cold retry reuses identical provider objects and original inclusion');
  assert.deepEqual(provider.requests.filter(([verb, name]) => verb === 'PUT' && name.endsWith('.manifest')), publishActions);
  assert.equal((await sync.libraryBackupConfiguration()).pendingPublication, false);
  const cleanupReceipt = (await sync.libraryBackupConfiguration()).cleanupReceipt;
  assert.match(cleanupReceipt, /^[a-f0-9-]{36}\/[a-f0-9]{64}$/);
  const remoteActions = [...provider.requests];
  webDavDonor.close();
  webDavDonor = await openRuntime('donor');
  currentRuntime = webDavDonor;
  sync = provider.gateway(webDavDonor);
  assert.equal((await sync.libraryBackupConfiguration()).cleanupReceipt, cleanupReceipt);
  assert.deepEqual(await sync.backupLibrary(new LocalRecoveryGateway(), false, current, 'stale receipt'), { state: 'cancelled' });
  assert.deepEqual(await sync.backupLibrary(new LocalRecoveryGateway(), false, current, cleanupReceipt), { state: 'exported' });
  assert.equal((await sync.libraryBackupConfiguration()).cleanupReceipt, undefined);
  assert.deepEqual(await sync.backupLibrary(new LocalRecoveryGateway(), false, current, cleanupReceipt), { state: 'cancelled' });
  assert.deepEqual(provider.requests, remoteActions, 'acknowledged cleanup and stale cleanup taps do not access the provider');
  console.log('PASS verified WebDAV publication survives failed local cleanup and reopens for cleanup without provider requests');
  webDavDonor.close();

  const webDavReceiver = await openRuntime('webdav-receiver');
  currentRuntime = webDavReceiver;
  const priorRemote = await importBook(webDavReceiver, 'BeforeWebDav.txt', '远端预览前的本地原书');
  const beforeWebDav = await shelf(webDavReceiver);
  gateway = new LocalRecoveryGateway();
  sync = provider.gateway(webDavReceiver);
  assert.deepEqual(await sync.previewLibraryBackup(gateway, current), { state: 'preview', included: 1, missing: 1 });
  assert.deepEqual(await shelf(webDavReceiver), beforeWebDav, 'remote preview is read-only locally');
  provider.setConfigRevision(true);
  assert.deepEqual(await sync.restoreLibraryBackup(gateway, current), { state: 'providerChanged' });
  assert.deepEqual(await shelf(webDavReceiver), beforeWebDav);
  provider.setConfigRevision(false);
  assert.deepEqual(await sync.previewLibraryBackup(gateway, current), { state: 'preview', included: 1, missing: 1 });
  assert.deepEqual(await sync.restoreLibraryBackup(gateway, current), { state: 'restored', included: 1, missing: 1 });
  assert.ok(JSON.stringify(await chapter(webDavReceiver, complete.bookId)).includes(complete.line));
  assert.deepEqual(await readFile(await webDavReceiver.retainedLocalBookSourcePath(priorRemote.bookId, current)), priorRemote.bytes);
  assert.equal(provider.requests.some(([method]) => method === 'DELETE'), false);
  webDavReceiver.close();
  console.log('PASS WebDAV and actual Core roundtrip preserves pending upload across reopen, binds previews to provider and restores readable original');

  webDavDonor = await openRuntime('donor');
  currentRuntime = webDavDonor;
  gateway = new LocalRecoveryGateway();
  sync = provider.gateway(webDavDonor);
  assert.deepEqual(await sync.backupLibrary(gateway, true, current), { state: 'exported' });
  const list = await sync.listLibraryArchives(current);
  assert.equal(list.state, 'listed');
  assert.equal(list.archives.length, 2);
  const [latest, older] = list.archives;
  assert.equal(latest.library, 'same');
  assert.equal(latest.latest, true);
  assert.equal(latest.canDelete, false);
  assert.equal(older.canDelete, true);
  provider.setConfigRevision(true);
  const beforeStaleSelection = [...provider.requests];
  assert.deepEqual(await sync.removeLibraryArchive(older, current), { state: 'providerChanged' });
  assert.deepEqual(await sync.previewLibraryBackup(gateway, current, older), { state: 'providerChanged' });
  assert.deepEqual(provider.requests, beforeStaleSelection, 'stale selections never reach a new configuration');
  provider.setConfigRevision(false);
  assert.deepEqual(await sync.removeLibraryArchive(latest, current), { state: 'conflict' });
  const oldManifest = `reader-library-v1-${older.sha256}.manifest`;
  const oldPart = Array.from(provider.remote.keys()).find(name => name.includes(older.sha256) && name.endsWith('.part'));
  assert.ok(oldPart);
  assert.deepEqual(await sync.removeLibraryArchive(older, current), { state: 'retirementPending' });
  assert.equal(provider.remote.has(oldManifest), false);
  assert.equal(provider.remote.has(oldPart), true, 'the manifest-first transition keeps parts during admitted reads');
  const pendingRetirement = (await sync.libraryBackupConfiguration()).removal;
  assert.equal(pendingRetirement.phase, 'waiting');
  const beforePendingRetry = [...provider.requests];
  assert.deepEqual(await sync.resumeLibraryRetirement(pendingRetirement.receipt, current), { state: 'retirementPending' });
  assert.deepEqual(provider.requests, beforePendingRetry);
  webDavDonor.close();

  provider.moveClock(31 * 60_000);
  webDavDonor = await openRuntime('donor');
  currentRuntime = webDavDonor;
  sync = provider.gateway(webDavDonor);
  assert.equal((await sync.libraryBackupConfiguration()).removal.phase, 'parts');
  provider.failNextPartDeletion();
  const requestStart = provider.requests.length;
  assert.deepEqual(await sync.resumeLibraryRetirement(pendingRetirement.receipt, current), { state: 'cleanupFailed' });
  assert.equal(provider.remote.has(oldPart), true);
  assert.deepEqual(await sync.resumeLibraryRetirement(pendingRetirement.receipt, current), { state: 'retirementCompleted' });
  assert.equal((await sync.libraryBackupConfiguration()).removal, undefined);
  assert.equal(provider.remote.has(oldPart), false);
  assert.equal(provider.remote.has(`reader-library-v1-${latest.sha256}.manifest`), true);
  assert.equal(provider.requests.slice(requestStart).some(([method, name]) => method === 'PUT' && name.endsWith('.manifest')), false);
  webDavDonor.close();
  console.log('PASS user-selected remote retirement removes the exact manifest first and resumes only its parts after monotonic grace');

  assert.equal(handles.size, 0);
  assert.equal(hash(await readFile(gatewayPath)), hash(gatewaySource), 'Gateway source stayed stable during the native probe');
} finally {
  for (const handle of alive) native.releaseRuntime(handle);
  ReaderDocumentPickerActivity.destroy();
  await rm(root, { recursive: true, force: true });
}

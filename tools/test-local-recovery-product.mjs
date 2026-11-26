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
const ReaderRuntimeOwner = { current: () => currentRuntime };
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
  assert.equal(handles.size, 0);
  assert.equal(hash(await readFile(gatewayPath)), hash(gatewaySource), 'Gateway source stayed stable during the native probe');
  console.log('PASS interrupted Core apply survives cold reopen, retains the exact rollback point and restores raw TXT with a separate missing-original fact');
} finally {
  for (const handle of alive) native.releaseRuntime(handle);
  ReaderDocumentPickerActivity.destroy();
  await rm(root, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { recordContractCasePass, selectContractCases } from './lib/contract-case-selection.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { localRecoveryFileProbe } from './lib/local-recovery-file-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { localImportFailure } from '../entry/src/main/ets/app/LocalImportFailure.ts';
import { isReaderLocalBookFileName } from '../entry/src/main/ets/app/ReaderLocalBookFormatAdmission.ts';
import { readerHostFilesDirectory } from '../entry/src/main/ets/app/diagnostics/ReaderPublicFixtureScope.ts';
import { ReaderDocumentPickerActivity } from '../entry/src/main/ets/platform/ReaderDocumentPickerActivity.ts';

export const CONTRACT_CASES = {
  'archive-primary-error': { description: 'Recovery file preserves primary errors while closing and wipes derived bytes when cipher creation fails', resources: [] },
  'archive-stale-work': { description: 'Recovery gateway skips a disappeared owned work directory and completes normal picker cancellation', resources: [] },
  'local-book-stage-retry': { description: 'Host startup keeps unreadable completed stages, processes siblings, and retries that same stage on import', resources: [] },
  'text-clear-disappearance': { description: 'Durable book clear continues and acknowledges idempotent concurrent directory and byte removal', resources: [] },
  'storage-policy-read-retry': { description: 'A transient metadata worker failure allows retry of the persisted disk policy', resources: [] },
  'manga-grant-reconcile': { description: 'Cold pending-grant read and lost completion acknowledgement reconcile before manga readmission', resources: [] },
  'cache-write-primary-error': { description: 'Cache writes preserve primary I/O errors, reclaim incomplete files and reopen the write lane', resources: [] },
  'manga-display-disappearance': { description: 'Manga retention and Body handle missing inventory roots, display lookup and eviction without leaking pins', resources: [] },
};

const sourceRoot = new URL('../entry/src/main/ets/', import.meta.url);
const missing = code => Object.assign(new Error('fixture path disappeared'), { code });
const current = () => true;
const errorMessageOf = error => error instanceof Error ? error.message : String(error);
const fileUri = { FileUri: class { constructor(uri) { this.name = basename(new URL(uri).pathname); } } };

function productionClass(path, name, dependencies) {
  const file = new URL(path, sourceRoot);
  return pureModuleProbe(readFileSync(file, 'utf8'), basename(path), dependencies, [name])[name];
}

class TestLru {
  values = new Map();
  get(key) { return this.values.get(key); }
  put(key, value) { this.values.set(key, value); }
  remove(key) { this.values.delete(key); }
  keys() { return this.values.keys(); }
  clear() { this.values.clear(); }
}

async function archivePrimaryError(root) {
  const { support, io, crypto, handles } = localRecoveryFileProbe();
  const path = join(root, 'input');
  await fs.writeFile(path, 'source');
  const close = io.close;
  const closeError = new Error('injected descriptor close failure');
  const primary = new support.LocalRecoveryFileError('cancelled');
  io.close = async file => { await close(file); throw closeError; };
  await assert.rejects(support.recoveryVisitFile(path, async () => { throw primary; }, current), error => error === primary);
  await assert.rejects(support.recoveryOutput(join(root, 'output'), async () => { throw primary; }), error => error === primary);
  await assert.rejects(support.recoveryVisitFile(path, async () => {}, current), error => error === closeError);
  assert.equal(handles.size, 0, 'both original operation and cleanup release the descriptor');
  io.close = close;

  const material = { data: new Uint8Array(32).fill(7) };
  const cipherError = new Error('cipher capability unavailable');
  crypto.createKdf = () => ({ generateSecret: async () => material });
  crypto.createCipher = () => { throw cipherError; };
  await assert.rejects(support.sealRecoveryFile(join(root, 'cipher'), 'fixture', async () => {}), error => error === cipherError);
  assert.deepEqual(material.data, new Uint8Array(32), 'derived bytes are wiped even if cipher construction rejects');
}

async function archiveStaleWork(root) {
  const { io, util, support, setPicker } = localRecoveryFileProbe();
  const runtime = { getUIAbilityContext: () => ({ filesDir: root }) };
  const Recovery = productionClass('features/bookshelf/application/LocalRecoveryGateway.ts', 'LocalRecoveryGateway', {
    fileIo: io, util, fileUri, ...support, ReaderRuntimeOwner: { current: () => runtime }, readerHostFilesDirectory,
  });
  const recovery = new Recovery();
  const base = join(root, 'reader-local-recovery');
  await fs.mkdir(join(base, 'work-kept'), { recursive: true });
  const list = io.listFile;
  io.listFile = async path => path === base ? ['work-vanished', ...await list(path)] : list(path);
  const rmdir = io.rmdir;
  io.rmdir = async path => {
    if (path.endsWith('work-vanished')) throw missing(13900002);
    await rmdir(path);
  };
  let pickerCalls = 0;
  setPicker(async () => { pickerCalls++; return []; });
  ReaderDocumentPickerActivity.bind(1);
  ReaderDocumentPickerActivity.setForeground(true);
  try {
    assert.deepEqual(await recovery.inspectPackage('fixture', current), { state: 'cancelled' });
    assert.deepEqual(await fs.readdir(base), []);
    assert.deepEqual(await recovery.inspectPackage('fixture', current), { state: 'cancelled' });
    assert.equal(pickerCalls, 2, 'the operation lane is reusable after the first cleanup');
  } finally { ReaderDocumentPickerActivity.destroy(); }
}

const hostPath = new URL('app/ReaderHostRegistry.ts', sourceRoot);
const stageMethods = [
  'LocalBookLimitBytes', 'StageSpaceReserveBytes', 'HashChunkBytes', 'stageSequences', 'stagingReservations',
  'stageRecoveries', 'stageRecoveryFor', 'prepareSystemLocalBookInput', 'ensureStageRecovery', 'requireSelectedFileName',
  'stageLocalBook', 'copyAndHashLocalBook', 'digestToHex', 'recoverAbandonedStages', 'hashLocalBookFile',
  'localBookStageDirectory', 'localBookAssetDirectory', 'pendingLocalImportFinalizeDirectory',
  'unlinkIfPresent', 'isMissingFile', 'ensureDirectory', 'nextStagePath',
];

async function localBookStageRetry(root) {
  const { io, statvfs, crypto, handles } = localRecoveryFileProbe();
  const Host = selectedProductionMethods(hostPath, 'ReaderHostRegistry', stageMethods, {
    fileIo: io, statvfs, cryptoFramework: crypto, fileUri, errorMessageOf, isReaderLocalBookFileName, localImportFailure,
    LOG_DOMAIN: 0, hilog: { warn() {}, error() {} },
  });
  const host = Object.assign(new Host(), { context: { filesDir: root } });
  const stage = host.localBookStageDirectory(), assets = host.localBookAssetDirectory();
  await fs.mkdir(stage, { recursive: true });
  const firstBytes = Buffer.from('first-completed'), siblingBytes = Buffer.from('sibling-completed');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const first = join(stage, `1-1-${hash(firstBytes)}.source`);
  const sibling = join(stage, `1-2-${hash(siblingBytes)}.source`);
  const raced = join(stage, '1-3.book');
  await fs.writeFile(first, firstBytes);
  await fs.writeFile(sibling, siblingBytes);
  await fs.writeFile(raced, 'incomplete');
  const open = io.open, unlink = io.unlink;
  let fail = true;
  io.open = async (path, mode) => {
    if (path === first && fail) throw Object.assign(new Error('injected stage read failure'), { code: 'EIO' });
    return open(path, mode);
  };
  io.unlink = async path => {
    await unlink(path);
    if (path === raced) throw missing('ENOENT');
  };
  host.stageRecovery = Host.stageRecoveryFor(stage, () => host.recoverAbandonedStages());
  await assert.rejects(host.stageRecovery, /injected stage read failure/);
  assert.deepEqual(await fs.readFile(first), firstBytes);
  assert.deepEqual(await fs.readFile(join(assets, `${hash(siblingBytes)}.source`)), siblingBytes);
  fail = false;
  const newBook = join(root, 'next.txt');
  await fs.writeFile(newBook, 'new selection');
  assert.equal((await host.prepareSystemLocalBookInput(pathToFileURL(newBook).href)).state, 'ready');
  assert.deepEqual(await fs.readFile(join(assets, `${hash(firstBytes)}.source`)), firstBytes);
  assert.equal(handles.size, 0);

  const write = io.write, close = io.close;
  const writeError = new Error('injected book staging write failure');
  io.write = async () => { throw writeError; };
  io.close = async file => { await close(file); throw new Error('injected stage descriptor close failure'); };
  await assert.rejects(host.stageLocalBook(pathToFileURL(newBook).href, 'next.txt'), error => error === writeError);
  assert.equal(handles.size, 0);
  assert.ok((await fs.readdir(stage)).every(name => !name.endsWith('.book')));
  io.close = close;
  io.write = write;
  assert.equal((await host.prepareSystemLocalBookInput(pathToFileURL(newBook).href)).state, 'ready');
}

const cacheName = 'platform/reading-resources/ReadingImageDiskCache.ts';

function diskFixture(root, readMetadata = async path => new Uint8Array(await fs.readFile(path))) {
  const { io, util, crypto } = localRecoveryFileProbe();
  util.LRUCache = TestLru;
  io.rename = fs.rename;
  io.AtomicFile = class {
    constructor(path) { this.path = path; }
    readFully() { return new Uint8Array(readFileSync(this.path)).buffer; }
  };
  const Cache = productionClass(cacheName, 'ReadingImageDiskCache', {
    fileIo: io, util, cryptoFramework: crypto, statfs: { getFreeSize: async () => 2e9 }, readerHostFilesDirectory,
    canonicalReadingImageBaseUrl: value => value, assertReadingOfflineWriteCapacity: () => {}, readMangaAtomicPayload: readMetadata,
  });
  return { io, cache: new Cache({ filesDir: root }) };
}

async function textClearDisappearance(root) {
  const { cache, io } = diskFixture(root);
  const rmdir = io.rmdir, resourceBytes = new Uint8Array([1, 2, 3]);
  io.rmdir = path => fs.rmdir(path);
  for (const operation of ['listFile', 'stat', 'unlink', 'rmdir']) {
    const selected = { sourceId: 'source', bookId: `disappearance-${operation}`, chapterIndex: 1,
      contentVersion: 'v1', imageUrl: 'https://example.test/image' };
    const sibling = { ...selected, chapterIndex: 2 };
    await cache.storeResource(selected, resourceBytes);
    await cache.storeResource(sibling, resourceBytes);
    const selectedDirectory = await cache.chapterDirectory(selected);
    const target = operation === 'listFile' ? join(selectedDirectory, '..') : operation === 'unlink' ?
      await cache.resourcePath(selected) : selectedDirectory;
    const original = io[operation];
    let injected = 0;
    io[operation] = async path => {
      if (path === target && injected === 0) {
        injected++;
        if (operation === 'unlink') await fs.unlink(path); else await rmdir(path);
        throw missing(operation === 'stat' ? 13900002 : 'ENOENT');
      }
      return original(path);
    };
    try { await cache.clearBook(selected.sourceId, selected.bookId); }
    finally { io[operation] = original; }
    assert.equal(injected, 1, operation);
    assert.equal(await cache.loadResource(sibling), undefined, 'a disappeared entry cannot strand its siblings');
    assert.equal(await io.access(await cache.clearMarkerPath(selected.sourceId, selected.bookId)), false);
    await cache.storeResource(sibling, resourceBytes);
    assert.deepEqual(await cache.loadResource(sibling), resourceBytes, 'fresh publication remains possible');
  }
}

async function storagePolicyReadRetry(root) {
  const path = join(root, 'reader-offline', 'storage-policy.json');
  await fs.mkdir(join(root, 'reader-offline'));
  await fs.writeFile(path, JSON.stringify({ version: 1, limitMb: 128, cleanupAfterDays: 19 }));
  const fault = Object.assign(new Error('injected storage policy worker failure'), { code: 'EIO' });
  let attempts = 0;
  const { cache } = diskFixture(root, async value => {
    assert.equal(value, path);
    if (++attempts === 1) throw fault;
    return new Uint8Array(await fs.readFile(value));
  });
  const first = cache.readPolicy(), concurrent = cache.readPolicy();
  await assert.rejects(first, error => error === fault);
  await assert.rejects(concurrent, error => error === fault);
  assert.equal(attempts, 1, 'concurrent callers share the failed read');
  assert.deepEqual(await cache.readPolicy(), { capacityBytes: 128 * 1024 ** 2, expiryDays: 19 });
  assert.equal(attempts, 2);
}

async function mangaGrantReconcile(root) {
  const { cache } = diskFixture(root);
  const chapter = { sourceId: 'source', bookId: 'book', chapterId: 'chapter', contentVersion: 'v1' };
  const grant = { ...chapter, grantToken: 'one-authoritative-grant' };
  const unavailable = new Error('injected pending-grant read failure');
  const lostAck = new Error('injected completion receipt loss');
  let pending = [grant], pendingReads = 0, completions = 0, rejectPending = false;
  cache.setMangaStorageAuthority({
    async pending() {
      if (++pendingReads === 1 || rejectPending) throw unavailable;
      return pending;
    },
    async candidates() { return []; },
    async complete(actual, removed) {
      assert.deepEqual(actual, grant);
      assert.equal(removed, true);
      completions++;
      pending = [];
      throw lostAck;
    },
  });
  await assert.rejects(cache.captureReadingStorageInventory(), error => error === unavailable);
  await cache.captureReadingStorageInventory();
  assert.throws(() => cache.pinMangaChapter(chapter), /MANGA_CACHE_EVICTING/);
  await assert.rejects(cache.clearMangaRebuildableCache(), error => error === lostAck);
  assert.throws(() => cache.pinMangaChapter(chapter), /MANGA_CACHE_EVICTING/);
  await cache.clearMangaRebuildableCache();
  cache.pinMangaChapter(chapter)();
  assert.equal(completions, 1, 'authoritative absence reconciles the receipt without writing twice');

  rejectPending = true;
  const restoreError = new Error('injected failed restore');
  await assert.rejects(cache.withMangaStorageRestore(async () => { throw restoreError; }), error => error === restoreError);
  assert.throws(() => cache.pinMangaChapter(chapter), /MANGA_CACHE_STORAGE_RESTORING/);
  rejectPending = false;
  await cache.maintainMangaStorage('clear');
  cache.pinMangaChapter(chapter)();
}

async function cacheWritePrimaryError(root) {
  const { cache, io } = diskFixture(root);
  const write = io.write, close = io.close;
  const primary = new Error('injected cache write failure');
  io.write = async () => { throw primary; };
  io.close = async file => { await close(file); throw new Error('injected cache descriptor close failure'); };
  const identity = { sourceId: 'source', bookId: 'cache-write', chapterIndex: 1, contentVersion: 'v1',
    imageUrl: 'https://example.test/image' };
  const bytes = new Uint8Array([1, 2, 3]);
  await assert.rejects(cache.storeResource(identity, bytes), error => error === primary);
  const dir = await cache.chapterDirectory(identity);
  assert.ok((await fs.readdir(dir)).every(name => !name.includes('.tmp-')));

  const Body = productionClass('platform/reading-resources/ReadingBodyImageHost.ts', 'ReadingBodyImageHost', { fs: io });
  const body = new Body();
  const display = join(root, 'display'), out = join(display, 'image.png');
  await assert.rejects(body.performDisplayFileWrite(display, out, bytes, {}, 'a'.repeat(64), false), error => error === primary);
  assert.deepEqual(await fs.readdir(display), []);
  io.close = close;
  io.write = write;
  await cache.storeResource(identity, bytes);
  assert.deepEqual(await cache.loadResource(identity), bytes);
  await body.performDisplayFileWrite(display, out, bytes, {}, 'a'.repeat(64), false);
  assert.deepEqual(new Uint8Array(await fs.readFile(out)), bytes);
}

async function mangaDisplayDisappearance(root) {
  const { io, util, crypto } = localRecoveryFileProbe();
  util.LRUCache = TestLru;
  util.TextDecoder = class {
    static create() { return new this(); }
    decodeToString(bytes) { return new TextDecoder().decode(bytes); }
  };
  io.rename = fs.rename;
  const readMangaAtomicPayload = async path => new Uint8Array(await fs.readFile(path));
  const Retention = productionClass('platform/reading-resources/MangaDisplayRetention.ts', 'MangaDisplayRetention', {
    fs: io, util, readMangaAtomicPayload,
  });
  const Body = productionClass('platform/reading-resources/ReadingBodyImageHost.ts', 'ReadingBodyImageHost', {
    fs: io, util, cryptoFramework: crypto, MangaDisplayRetention: Retention,
  });
  const body = new Body();
  body.configureMangaDisplayCache(root);
  const dir = join(root, 'reader-manga-display-v1');
  const list = io.listFile;
  io.listFile = async path => { if (path === dir) throw missing(13900002); return list(path); };
  await fs.mkdir(dir);
  assert.deepEqual(await body.mangaDisplayInventory(), [], 'directory gone after access is an empty inventory');
  io.listFile = list;

  const hash = async bytes => createHash('sha256').update(bytes).digest('hex');
  const chapter = { sourceId: 'source', bookId: 'book', chapterId: 'chapter', contentVersion: 'v1' };
  const retention = new Retention(dir, hash, () => false);
  const key = await retention.key(chapter, 'source-hash');
  const path = join(dir, `reading-body-manga-${key}-test.png`);
  const payload = { fileUri: `file://${path}`, width: 2, height: 3, intrinsicWidth: 2, intrinsicHeight: 3, revision: 'test' };
  await fs.writeFile(path, 'display');
  await retention.store(key, chapter, payload, current);
  const write = io.write, close = io.close;
  const writeError = new Error('injected sidecar write failure');
  io.write = async () => { throw writeError; };
  io.close = async file => { await close(file); throw new Error('injected sidecar close failure'); };
  await assert.rejects(retention.store(key, chapter, payload, current), error => error === writeError);
  assert.ok((await fs.readdir(dir)).every(name => !name.endsWith('.tmp')));
  io.write = write;
  io.close = close;
  await retention.store(key, chapter, payload, current);
  const cold = new Retention(dir, hash, () => false);
  const stat = io.stat;
  io.stat = async value => { if (value === path) throw missing('ENOENT'); return stat(value); };
  assert.equal(await cold.lookup(key, chapter, current), undefined, 'concurrent eviction is a cache miss');
  io.stat = stat;
  const files = await cold.inventory();
  assert.equal(files.find(file => file.path === path)?.live, false, 'the miss released the lookup pin');
  assert.deepEqual(files.find(file => file.path === path)?.owners, [chapter]);
  const unlink = io.unlink;
  io.unlink = async value => { await unlink(value); if (value === path) throw missing(13900002); };
  assert.equal(await cold.remove(chapter, files), true);
  assert.deepEqual(await cold.inventory(), [], 'absence reconciles both the payload and its sidecar');
}

const cases = {
  'archive-primary-error': archivePrimaryError,
  'archive-stale-work': archiveStaleWork,
  'local-book-stage-retry': localBookStageRetry,
  'text-clear-disappearance': textClearDisappearance,
  'storage-policy-read-retry': storagePolicyReadRetry,
  'manga-grant-reconcile': mangaGrantReconcile,
  'cache-write-primary-error': cacheWritePrimaryError,
  'manga-display-disappearance': mangaDisplayDisappearance,
};
for (const name of selectContractCases(CONTRACT_CASES)) {
  const root = await fs.mkdtemp(join(tmpdir(), 'reader-arkts-persistence-fault-'));
  try { await cases[name](root); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
  recordContractCasePass(name);
}

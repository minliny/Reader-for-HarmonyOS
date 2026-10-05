import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import * as nfs from 'node:fs';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMangaAtomicPayloadReaderFixture } from './lib/manga-atomic-payload-probe.mjs';

const directory = await mkdtemp(join(tmpdir(), 'reader-manga-display-regression-'));
const fs = {
  OpenMode: { CREATE: 1, READ_WRITE: 2, TRUNC: 4 },
  async access(path) { return nfs.existsSync(path); },
  async stat(path) { return nfs.statSync(path); },
  async listFile(path) { return nfs.readdirSync(path); },
  async mkdir(path) { nfs.mkdirSync(path, { recursive: true }); },
  async open(path) { return { fd: nfs.openSync(path, 'w+') }; },
  async write(fd, value) { return nfs.writeSync(fd, new Uint8Array(value)); },
  async close(file) { nfs.closeSync(file.fd); },
  async rename(a, b) { nfs.renameSync(a, b); },
  async unlink(path) { nfs.unlinkSync(path); },
  AtomicFile: class { constructor(path) { this.path = path; } readFully() { const bytes = nfs.readFileSync(this.path); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } },
};
class LRUCache { constructor(capacity) { this.capacity = capacity; this.data = new Map(); } get(key) { return this.data.get(key); } put(key, value) { this.data.set(key, value); } remove(key) { this.data.delete(key); } clear() { this.data.clear(); } }
const util = { LRUCache, TextEncoder: class { encodeInto(text) { return new TextEncoder().encode(text); } }, TextDecoder: class { decodeWithStream(bytes) { return new TextDecoder().decode(bytes); } } };
const cryptoFramework = { createMd() { const hash = createHash('sha256'); return { async update({ data }) { hash.update(data); }, async digest() { return { data: new Uint8Array(hash.digest()) }; } }; } };
function load(name, dependencies) {
  const text = nfs.readFileSync(new URL(`../entry/src/main/ets/app/${name}.ts`, import.meta.url), 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(text)}\nreturn ${name}`)(...Object.values(dependencies));
}
const atomicReadHooks = {};
const readMangaAtomicPayload = createMangaAtomicPayloadReaderFixture(fs, atomicReadHooks);
const MangaDisplayRetention = load('MangaDisplayRetention', { fs, util, readMangaAtomicPayload });
const Body = load('ReadingBodyImageHost', { fs, util, cryptoFramework, MangaDisplayRetention });
class MaterializationError extends Error { constructor(kind, message) { super(message); this.kind = kind; } }
const Disk = load('ReadingImageDiskCache', { fileIo: fs, util, cryptoFramework,
  statfs: { getFreeSize: async () => 8 * 1024 ** 3 }, canonicalReadingImageBaseUrl: () => undefined,
  assertReadingOfflineWriteCapacity: () => {}, ReadingOfflineMaterializationError: MaterializationError, readMangaAtomicPayload });
const owner = (chapterId, contentVersion = 'v1') => ({ sourceId: 'source', bookId: 'book', chapterId, contentVersion });
const source = new Uint8Array([1, 2, 3, 4]);
let decodes = 0, reservations = 0;
function body() {
  const result = new Body();
  result.configureDisplayCache(directory);
  result.setMangaDisplayReserve(async () => { reservations++; return { release() { reservations--; } }; });
  result.decodeBytes = async function(bytes, current, position, preview, key) {
    assert.equal(current(), true); decodes++;
    const path = `${this.mangaDisplayDir ?? this.displayCacheDir}/reading-body-manga-${key}-600x800.png`;
    await mkdir(this.mangaDisplayDir ?? this.displayCacheDir, { recursive: true });
    nfs.writeFileSync(path, bytes);
    this.displayFileReferences.set(path, 1);
    return { pixelMap: undefined, fileUri: `file://${path}`, width: 600, height: 800, intrinsicWidth: 600, intrinsicHeight: 800, revision: 'test-decoder' };
  };
  return result;
}
const focus = process.argv[2];
async function regressions() {
  if (focus === undefined || focus === 'worker-wait') {
    const dir = `${directory}/worker-wait`; await mkdir(dir, { recursive:true });
    const live = new Set(), chapter = owner('worker-wait');
    const retention = new MangaDisplayRetention(dir, async value => createHash('sha256').update(value).digest('hex'), path => live.has(path));
    const key = await retention.key(chapter, 'original-digest'), path = `${dir}/reading-body-manga-${key}-600x800.png`;
    nfs.writeFileSync(path, source);
    const payload = { fileUri:`file://${path}`, width:600, height:800, intrinsicWidth:600, intrinsicHeight:800, revision:'worker' };
    await retention.store(key, chapter, payload, () => true);
    let entered, proceed, current = true;
    const atWorker = new Promise(resolve => { entered = resolve; }), heldWorker = new Promise(resolve => { proceed = resolve; });
    atomicReadHooks.beforeExecute = async args => { if (args[0] === path) { entered(); await heldWorker; } };
    let read;
    try {
      read = retention.lookup(key, chapter, () => current, value => live.add(value.fileUri.slice(7)));
      const rejected = assert.rejects(read, /MANGA_RESOURCE_CANCELLED/);
      await atWorker;
      const files = await retention.inventory();
      assert.equal(files.find(file => file.path === path)?.live, true, 'read pin spans the queued/native payload wait');
      assert.equal(await retention.remove(chapter, files), false, 'eviction cannot unlink a payload during its worker wait');
      current = false; proceed(); await rejected;
      assert.equal(retention.reads.size, 0); assert.equal(live.size, 0);
      assert.deepEqual(new Uint8Array(nfs.readFileSync(path)), source, 'cancelled acquisition retains the immutable payload');
    } finally { proceed(); await Promise.allSettled([read]); delete atomicReadHooks.beforeExecute; }
    const reused = await retention.lookup(key, chapter, () => true, value => live.add(value.fileUri.slice(7)));
    assert.equal(reused.fileUri, payload.fileUri);
    assert.equal(await retention.remove(chapter, await retention.inventory()), false, 'a live lease follows the read pin without a deletion gap');
    live.clear(); assert.equal(await retention.remove(chapter, await retention.inventory()), true);
    console.log('PASS actual display worker-wait pin, cancellation cleanup and acquire-before-unpin lease continuity');
  }
  if (focus === undefined || focus === 'files-dir-leases') {
    const fresh = body(); fresh.configureMangaDisplayCache(`${directory}/lease-files`);
    const durable = await fresh.loadMangaBytes(source, owner('durable-lease'), () => true);
    const path = durable.fileUri.slice(7);
    assert.equal((await fresh.mangaDisplayInventory()).find(file => file.path === path)?.live, true);
    assert.equal(await fresh.removeMangaDerived(owner('durable-lease'), await fresh.mangaDisplayInventory(), async () => true), false);
    fresh.release(durable.fileUri);
    assert.equal((await fresh.mangaDisplayInventory()).find(file => file.path === path)?.live, false,
      'release recognizes the distinct filesDir manga namespace without a teardown clearing leaked references');
    const cold = body(); cold.configureMangaDisplayCache(`${directory}/lease-files`);
    const before = decodes, reused = await cold.loadMangaBytes(source, owner('durable-lease'), () => true);
    assert.equal(decodes, before);
    assert.equal((await cold.mangaDisplayInventory()).find(file => file.path === path)?.live, true,
      'cold lookup acquires the physical filesDir path before its checksum read pin is released');
    assert.equal(await cold.removeMangaDerived(owner('durable-lease'), await cold.mangaDisplayInventory(), async () => true), false);
    cold.release(reused.fileUri);
    assert.equal((await cold.mangaDisplayInventory()).find(file => file.path === path)?.live, false);
    assert.equal(await cold.removeMangaDerived(owner('durable-lease'), await cold.mangaDisplayInventory(), async () => true), true);
    assert.equal(nfs.existsSync(path), false);
    assert.equal(cold.pathFromFileUri(`file://${cold.displayCacheDir}/reading-body-g1-example.png`), `${cold.displayCacheDir}/reading-body-g1-example.png`);
    for (const uri of [`file://${cold.mangaDisplayDir}/reading-body-manga-key/../secret`,
      `file://${cold.mangaDisplayDir}/reading-body-g1-novel.png`, 'file:///unowned/reading-body-manga-x.png']) {
      assert.equal(cold.pathFromFileUri(uri), undefined, 'only exact files in their respective owned namespaces are released');
    }
    fresh.releaseAllDisplayFiles(); cold.releaseAllDisplayFiles();
    console.log('PASS distinct filesDir live references: initial release, cold lease, safe removal and unchanged novel namespace');
  }
  if (focus === undefined || focus === 'same-key-store') {
    const dir = `${directory}/parallel-records`; await mkdir(dir, { recursive: true });
    const retention = new MangaDisplayRetention(dir, async bytes => createHash('sha256').update(bytes).digest('hex'), () => false);
    const chapter = owner('parallel'), key = await retention.key(chapter, 'source-hash');
    const path = `${dir}/reading-body-manga-${key}-600x800.png`; nfs.writeFileSync(path, source);
    const payload = { fileUri: `file://${path}`, width: 600, height: 800, intrinsicWidth: 600, intrinsicHeight: 800, revision: 'parallel' };
    const rename = fs.rename; let entered, proceed, renames = 0;
    const atRename = new Promise(resolve => { entered = resolve; });
    const heldRename = new Promise(resolve => { proceed = resolve; });
    fs.rename = async (a, b) => { if (a.includes('.manga-display-')) { renames++; if (renames === 1) { entered(); await heldRename; } } return rename(a, b); };
    let first, second, results;
    try {
      first = retention.store(key, chapter, payload, () => true);
      await atRename;
      second = retention.store(key, chapter, payload, () => true);
      results = Promise.allSettled([first, second]);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(renames, 1, 'same display proof is serialized through publication instead of racing on one temp file');
      assert.equal((await retention.inventory()).find(file => file.path === path)?.live, true);
    } finally { proceed(); await results; fs.rename = rename; }
    assert.ok((await results).every(result => result.status === 'fulfilled'), 'both physical store callers finish successfully');
    assert.equal((await retention.inventory()).find(file => file.path === path)?.live, false);
    assert.ok(await retention.lookup(key, chapter, () => true));
    fs.rename = async () => { throw Error('sidecar rename failure'); };
    try { await assert.rejects(retention.store(key, chapter, payload, () => true), /sidecar rename failure/); }
    finally { fs.rename = rename; }
    assert.equal(nfs.readdirSync(dir).filter(name => name.startsWith('.manga-display-')).length, 0,
      'an owned metadata temporary file is reclaimed even when publication fails');
    console.log('PASS same-key display proof serialization, live write fencing and owned temporary-file failure cleanup');
  }
  if (focus === undefined || focus === 'temp-recovery') {
    const host = body(), filesDir = `${directory}/recover-files`;
    host.configureMangaDisplayCache(filesDir); await mkdir(host.mangaDisplayDir, { recursive: true });
    const digest = createHash('sha256').update(source).digest('hex');
    const stale = `${host.mangaDisplayDir}/.reading-body-tmp-${digest}-1`;
    const unknown = `${host.mangaDisplayDir}/.reading-body-tmp-not-an-owned-hash-1`;
    const unknownImage = `${host.mangaDisplayDir}/reading-body-manga-unproven.png`;
    const unknownSidecar = `${host.mangaDisplayDir}/manga-display-unproven.json`;
    nfs.writeFileSync(stale, source); nfs.truncateSync(stale, 2 * 1024 ** 3);
    for (const path of [unknown, unknownImage, unknownSidecar]) nfs.writeFileSync(path, source);
    const disk = new Disk({ filesDir });
    disk.setMangaStorageAuthority({ classify: async () => 'cache', pending: async () => [], candidates: async () => [],
      claim: async () => { throw Error('temporary recovery does not claim original chapter bytes'); }, complete: async () => {} });
    disk.setMangaExternalStorage({ inventory: () => host.mangaDisplayInventory(), remove: async () => false });
    assert.equal((await disk.mangaStorageUsage()).ordinaryBytes, 12,
      'cold dedicated manga inventory recovers exact Body-generated abandoned temporary bytes');
    assert.equal(nfs.existsSync(stale), false);
    const admission = await disk.reserveExternalWrite(owner('after-crash'), 32 * 1024 ** 2, 'background', 'derived'); admission.release();
    for (const path of [unknown, unknownImage, unknownSidecar]) assert.equal(nfs.existsSync(path), true, 'unknown payload or sidecar is never inferred disposable');
    const unlinkRetry = fs.unlink;
    nfs.writeFileSync(stale, source);
    fs.unlink = async path => { if (path === stale) throw Error('temporary unlink retry'); return unlinkRetry(path); };
    try { assert.ok((await host.mangaDisplayInventory()).some(file => file.path === stale), 'failed cleanup remains inventoried instead of granting imaginary free space'); }
    finally { fs.unlink = unlinkRetry; }
    await host.mangaDisplayInventory(); assert.equal(nfs.existsSync(stale), false, 'subsequent inventory retries a physical temporary cleanup failure');
    nfs.writeFileSync(stale, source);
    const access = fs.access; let accessEntered, accessResume;
    const atAccess = new Promise(resolve => { accessEntered = resolve; }), heldAccess = new Promise(resolve => { accessResume = resolve; });
    fs.access = async path => { if (path === stale) { accessEntered(); await heldAccess; } return access(path); };
    let staleCleanup;
    try {
      staleCleanup = host.mangaDisplayInventory(); await atAccess;
      host.releaseAllDisplayFiles(); accessResume(); await staleCleanup;
      assert.equal(nfs.existsSync(stale), true, 'a replaced Body generation cancels temporary removal before entering unlink');
    } finally { accessResume(); await staleCleanup; fs.access = access; }
    await host.mangaDisplayInventory(); assert.equal(nfs.existsSync(stale), false);
    const shared = body(); await new Promise(resolve => setImmediate(resolve));
    await mkdir(shared.displayCacheDir, { recursive: true });
    const sharedTemporary = `${shared.displayCacheDir}/.reading-body-tmp-${digest}-1`; nfs.writeFileSync(sharedTemporary, source);
    await shared.mangaDisplayInventory(); assert.equal(nfs.existsSync(sharedTemporary), true, 'this recovery never targets the legacy shared novel cache directory');
    const write = fs.write; let entered, proceed;
    const atWrite = new Promise(resolve => { entered = resolve; }), heldWrite = new Promise(resolve => { proceed = resolve; });
    fs.write = async (fd, bytes) => { entered(); await heldWrite; return write(fd, bytes); };
    const finalPath = `${host.mangaDisplayDir}/reading-body-manga-${digest}-4x1.png`;
    let active;
    try {
      active = host.performDisplayFileWrite(host.mangaDisplayDir, finalPath, source, {}, digest, false);
      await atWrite;
      assert.ok((await host.mangaDisplayInventory()).some(file => file.path === stale && file.live), 'inventory never reclaims a currently owned temporary write');
      assert.equal(nfs.existsSync(stale), true);
    } finally { proceed(); await active; fs.write = write; }
    assert.deepEqual(new Uint8Array(nfs.readFileSync(finalPath)), source);
    const collision = body(); collision.configureMangaDisplayCache(`${directory}/collision-files`);
    await mkdir(collision.mangaDisplayDir, { recursive: true });
    const collisionTemp = `${collision.mangaDisplayDir}/.reading-body-tmp-${digest}-1`;
    const collisionFinal = `${collision.mangaDisplayDir}/reading-body-manga-${digest}-4x1.png`;
    nfs.writeFileSync(collisionTemp, new Uint8Array([99]));
    const unlink = fs.unlink, open = fs.open; let unlinkEntered, unlinkResume, opened = false;
    const atUnlink = new Promise(resolve => { unlinkEntered = resolve; }), heldUnlink = new Promise(resolve => { unlinkResume = resolve; });
    fs.unlink = async path => { if (path === collisionTemp) { unlinkEntered(); await heldUnlink; } return unlink(path); };
    fs.open = async path => { if (path === collisionTemp) opened = true; return open(path); };
    let cleanup, rewrite;
    try {
      cleanup = collision.mangaDisplayInventory(); await atUnlink;
      rewrite = collision.performDisplayFileWrite(collision.mangaDisplayDir, collisionFinal, source, {}, digest, false);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(opened, false, 'a new write of the same temporary basename waits for prior cleanup to finish');
    } finally { unlinkResume(); await Promise.all([cleanup, rewrite]); fs.unlink = unlink; fs.open = open; }
    assert.deepEqual(new Uint8Array(nfs.readFileSync(collisionFinal)), source, 'late old unlink cannot remove the new payload');
    console.log('PASS cold exact Body temporary recovery, resumed capacity, active temporary protection and cleanup/write interlock');
  }
  if (focus === undefined || focus === 'temporary-inventory') {
    const host = body(); host.configureMangaDisplayCache(`${directory}/temporary-files`);
    await mkdir(host.mangaDisplayDir, { recursive: true });
    const stale = `${host.mangaDisplayDir}/.reading-body-tmp-crash-1`, original = `${host.mangaDisplayDir}/unowned-original.png`;
    nfs.writeFileSync(stale, new Uint8Array(29)); nfs.writeFileSync(original, source);
    let inventory = await host.mangaDisplayInventory();
    assert.ok(inventory.some(file => file.path === stale && file.owners.length === 0 && !file.live),
      'crash-leftover manga body temporary bytes reach the shared actual-byte inventory without guessed chapter ownership');
    assert.ok(!inventory.some(file => file.path === original), 'unrelated unknown original is outside display adapter ownership');
    const disk = new Disk({ filesDir: `${directory}/temporary-files` });
    disk.setMangaStorageAuthority({ classify: async () => 'cache', pending: async () => [], candidates: async () => [],
      claim: async () => { throw Error('unknown crash temp cannot grant chapter deletion'); }, complete: async () => {} });
    disk.setMangaExternalStorage({ inventory: () => host.mangaDisplayInventory(),
      remove: async () => { throw Error('unknown crash temp cannot be physically removed through a chapter grant'); } });
    assert.equal((await disk.mangaStorageUsage()).ordinaryBytes, 29, 'actual Body temporary inventory reaches production shared Disk accounting');
    nfs.truncateSync(stale, 2 * 1024 ** 3);
    assert.equal((await disk.mangaStorageUsage()).ordinaryBytes, 2 * 1024 ** 3);
    await assert.rejects(disk.reserveExternalWrite(owner('admitted-next'), 1, 'background', 'derived'), /MANGA_CACHE_STORAGE_FULL/,
      'sparse crash-temp bytes consume ordinary cache quota after a cold process loses its write reservations');
    nfs.truncateSync(stale, 29);
    const finalPath = `${host.mangaDisplayDir}/reading-body-manga-temporary-4x1.png`, write = fs.write;
    let entered, proceed;
    const writing = new Promise(resolve => { entered = resolve; }), heldWrite = new Promise(resolve => { proceed = resolve; });
    fs.write = async (fd, bytes) => { entered(); await heldWrite; return write(fd, bytes); };
    let active;
    try {
      active = host.performDisplayFileWrite(host.mangaDisplayDir, finalPath, source, {}, 'temporary', false);
      await writing;
      inventory = await host.mangaDisplayInventory();
      assert.ok(inventory.some(file => file.path.includes('.reading-body-tmp-temporary-') && file.live),
        'an in-flight temporary body write remains live while its bytes are inventoried');
    } finally { proceed(); await active; fs.write = write; }
    assert.equal(nfs.existsSync(stale), true); assert.equal(nfs.existsSync(original), true);
    console.log('PASS manga body crash-temp accounting, active-write liveness and conservative unknown-file preservation');
  }
}
try {
  if (focus === undefined) {
  const first = body(); await new Promise(resolve => setImmediate(resolve));
  const a = await first.loadMangaBytes(source, owner('A'), () => true);
  first.release(a.fileUri);
  assert.equal(nfs.existsSync(a.fileUri.slice(7)), true, 'releasing display lease keeps valid chapter bytes');
  const b = await first.loadMangaBytes(source, owner('B'), () => true); first.release(b.fileUri);
  const before = decodes;
  const returned = await first.loadMangaBytes(source, owner('A'), () => true);
  assert.equal(returned.fileUri, a.fileUri); assert.equal(decodes, before, 'A -> B -> A reuses display without native decode');
  const inventory = await first.mangaDisplayInventory();
  assert.equal(await first.removeMangaDisplay({ ...owner('A'), grantToken: 'grant' }, inventory), false, 'actual active display lease blocks deletion');
  first.release(returned.fileUri); first.releaseAllDisplayFiles();
  const cold = body(); await new Promise(resolve => setImmediate(resolve));
  const coldA = await cold.loadMangaBytes(source, owner('A'), () => true);
  assert.equal(decodes, before, 'cold owner reuses verified version and geometry'); cold.release(coldA.fileUri);
  const v2 = await cold.loadMangaBytes(source, owner('A', 'v2'), () => true); cold.release(v2.fileUri);
  const files = await cold.mangaDisplayInventory();
  assert.equal(await cold.removeMangaDisplay({ ...owner('A'), grantToken: 'grant' }, files), true);
  assert.equal(nfs.existsSync(a.fileUri.slice(7)), false); assert.equal(nfs.existsSync(v2.fileUri.slice(7)), true, 'exact-version eviction preserves newer version');
  const goodB = await cold.loadMangaBytes(source, owner('B'), () => true); cold.release(goodB.fileUri);
  nfs.writeFileSync(goodB.fileUri.slice(7), new Uint8Array([9, 9, 9, 9]));
  const count = decodes;
  const repaired = await cold.loadMangaBytes(source, owner('B'), () => true);
  assert.equal(decodes, count + 1, 'same-sized corrupt derivative cannot reuse hash proof'); cold.release(repaired.fileUri);
  assert.equal(reservations, 0, 'all display writes release budget reservations');
  const retention = cold.mangaDisplay, originalHash = retention.hash;
  let unblockHash, hashEntered;
  const hashing = new Promise(resolve => { hashEntered = resolve; });
  const holdHash = new Promise(resolve => { unblockHash = resolve; });
  retention.hash = async bytes => { if (bytes.length === 4) { hashEntered(); await holdHash; } return originalHash(bytes); };
  const reading = cold.loadMangaBytes(source, owner('B'), () => true);
  await hashing;
  assert.equal(await cold.removeMangaDerived(owner('B'), await cold.mangaDisplayInventory(), async () => true), false,
    'in-flight checksum lookup cannot be removed before it obtains a display lease');
  unblockHash(); const held = await reading; retention.hash = originalHash;
  assert.equal(await cold.removeMangaDerived(owner('B'), await cold.mangaDisplayInventory(), async () => true), false,
    'lookup acquires the actual display lease before releasing its read pin');
  cold.release(held.fileUri);
  assert.equal(await cold.removeMangaDerived(owner('B'), await cold.mangaDisplayInventory(), async () => false), false);
  assert.equal(nfs.existsSync(held.fileUri.slice(7)), true, 'late Core protection cancels physical trim');
  const unlink = fs.unlink; let injected = false;
  fs.unlink = async path => { if (!path.endsWith('.json') && !injected) { injected = true; throw Error('derived unlink failed'); } return unlink(path); };
  try { await assert.rejects(cold.removeMangaDerived(owner('B'), await cold.mangaDisplayInventory(), async () => true), /derived unlink failed/); }
  finally { fs.unlink = unlink; }
  const retryFiles = await cold.mangaDisplayInventory();
  assert.ok(retryFiles.some(file => file.path.endsWith('.json') && file.owners.some(value => value.chapterId === 'B')),
    'failed payload removal retains its ownership sidecar for a cold retry');
  assert.equal(await cold.removeMangaDerived(owner('B'), retryFiles, async () => true), true);
  assert.equal(nfs.existsSync(held.fileUri.slice(7)), false); assert.equal(nfs.existsSync(v2.fileUri.slice(7)), true);
  const dedicated = body(), novelDirectory = dedicated.displayCacheDir;
  dedicated.configureMangaDisplayCache(`${directory}/files`);
  const durable = await dedicated.loadMangaBytes(source, owner('durable'), () => true);
  assert.ok(durable.fileUri.startsWith(`file://${directory}/files/reader-manga-display-v1/`),
    'actual manga display inventory stays beneath filesDir admitted by the shared storage owner');
  assert.equal(dedicated.displayCacheDir, novelDirectory, 'manga durability does not move novel transient display files');
  dedicated.release(durable.fileUri); dedicated.releaseAllDisplayFiles();
  const durableCold = body(); durableCold.configureMangaDisplayCache(`${directory}/files`);
  const durableBefore = decodes, durableAgain = await durableCold.loadMangaBytes(source, owner('durable'), () => true);
  assert.equal(decodes, durableBefore); assert.equal(durableAgain.fileUri, durable.fileUri);
  durableCold.release(durableAgain.fileUri); durableCold.releaseAllDisplayFiles();
  cold.releaseAllDisplayFiles();
  console.log('PASS production display retention: A/B/A reuse, cold reuse, no retained pixels, exact-version/live protection, corruption and reservation cleanup');
  console.log('PASS actual derived trim: suspended checksum pin, lease acquisition without a deletion gap, late protection, payload-before-sidecar failure recovery and exact-version retry');
  console.log('PASS separate durable filesDir manga namespace and cold reuse with unchanged novel display-cache directory');
  }
  await regressions();
} finally { await rm(directory, { recursive: true, force: true }); }

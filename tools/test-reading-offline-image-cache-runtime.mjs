import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

// Execute the whole production class. Only Harmony's platform APIs are adapted
// to a real temporary filesystem; this is not device or platform durability proof.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(repo, 'entry/src/main/ets/app/ReadingImageDiskCache.ts'), 'utf8');
const executable = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
const handles = new Map();
let failRename = () => false;
let failUnlink = () => false;
let nanosecondStats = true;
let resourceReads = 0;
let beforeSync = async () => {};
let beforeWrite = async () => {};
let writeLimit = Infinity;
const writeSizes = [];
const io = {
  OpenMode: { CREATE: 1, READ_WRITE: 2, TRUNC: 4 },
  access: async path => fs.access(path).then(() => true, () => false),
  stat: async path => {
    const stat = await fs.stat(path); const ns = await fs.stat(path, { bigint: true });
    return { size:stat.size,dev:stat.dev,ino:stat.ino,mtime:Math.floor(stat.mtimeMs/1000),ctime:Math.floor(stat.ctimeMs/1000),
      mtimeNs:nanosecondStats ? ns.mtimeNs : undefined,ctimeNs:nanosecondStats ? ns.ctimeNs : undefined,
      isFile:()=>stat.isFile(),isDirectory:()=>stat.isDirectory() };
  },
  mkdir: (path, recursive) => fs.mkdir(path, { recursive }),
  listFile: path => fs.readdir(path),
  rmdir: path => fs.rmdir(path),
  unlink: async path => {
    if (failUnlink(path)) throw new Error('injected unlink failure');
    await fs.unlink(path);
  },
  open: async path => {
    const handle = await fs.open(path, 'w+');
    handles.set(handle.fd, handle);
    return handle;
  },
  write: async (fd, bytes) => {
    writeSizes.push(bytes.byteLength);await beforeWrite(bytes);
    return (await handles.get(fd).write(new Uint8Array(bytes,0,Math.min(bytes.byteLength,writeLimit)))).bytesWritten;
  },
  fsync: async fd => { await beforeSync(); await handles.get(fd).sync(); },
  close: async handle => { handles.delete(handle.fd); await handle.close(); },
  rename: async (from, to) => {
    if (failRename(to)) throw new Error('injected rename failure');
    await fs.rename(from, to);
  },
  AtomicFile: class {
    constructor(path) { this.path = path; }
    readFully() { if(this.path.endsWith('.bin')) resourceReads++; const bytes = readFileSync(this.path); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }
  },
};
const util = {
  // Platform LRU substitute only for the native API boundary; cache validity
  // policy remains the production class exercised below.
  LRUCache: class { constructor(capacity){this.capacity=capacity;this.items=new Map();} get(key){return this.items.get(key);} put(key,value){this.items.delete(key);this.items.set(key,value);if(this.items.size>this.capacity)this.items.delete(this.items.keys().next().value);} remove(key){this.items.delete(key);} keys(){return [...this.items.keys()];} clear(){this.items.clear();} },
  TextEncoder: class { encodeInto(value) { return new TextEncoder().encode(value); } },
  TextDecoder: { create: (_, options) => ({ decodeToString: bytes => new TextDecoder('utf-8', options).decode(bytes) }) },
};
const crypto = { createMd: () => {
  const hash = createHash('sha256');
  return { update: async ({ data }) => { hash.update(data); }, digest: async () => ({ data: hash.digest() }) };
} };
const canonicalBase = base => base?.trim().split('#')[0] || undefined;
class MaterializationError extends Error {}
const Cache = new Function('fileIo', 'statfs', 'cryptoFramework', 'util', 'canonicalReadingImageBaseUrl',
  'assertReadingOfflineWriteCapacity', 'ReadingOfflineMaterializationError', `${executable}\nreturn ReadingImageDiskCache;`)(
  io, { getFreeSize: async () => 1e9 }, crypto, util, canonicalBase,
  (free, bytes, reserve) => { if (free < bytes + reserve) throw new Error('storage_full'); }, MaterializationError,
);
const root = await fs.mkdtemp(join(tmpdir(), 'reader-image-cache-'));
const cache = new Cache({ filesDir: root });
const hash = value => createHash('sha256').update(value).digest('hex');
const chapter = { sourceId: 'source', bookId: 'book', chapterIndex: 1, contentVersion: 'A' };
const image = { ...chapter, imageUrl: 'https://img/1.png', baseUrl: 'https://book/1#fragment' };
const bytes = new Uint8Array([1, 2, 3]);
const checks = [];
const pass = name => checks.push(name);
const legacyDir = identity => join(root, 'reader-offline/images-v1', hash(`${identity.sourceId}\0${identity.bookId}`), `${identity.chapterIndex}`);
async function seedLegacy(identity, override = {}) {
  const directory = legacyDir(identity);
  const resourceHash = hash(`${identity.contentVersion}\0${identity.imageUrl}\0${canonicalBase(identity.baseUrl) ?? ''}`);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(join(directory, `${resourceHash}.bin`), bytes);
  await fs.writeFile(join(directory, 'manifest.json'), JSON.stringify({ formatVersion: 1, ...identity, resourceHashes: [resourceHash], ...override }));
  return directory;
}
try {
  // Historical v2 contains prepared JPEG bytes, without a processing profile.
  // This fixture deliberately interprets the independent regional BGRA golden
  // as RGBA via Pillow JPEG; it models the old channel mistake, not native codec proof.
  const scripted = { ...image, bookId: 'profile-upgrade', contentVersion: 'stable-manga',
    resourceRef: `manga:mp1:${'c'.repeat(64)}`, mangaDecodeRevision: 'bytes-v1' };
  const profileDir = await cache.chapterDirectory(scripted);
  const legacyHash = hash(JSON.stringify(['manga-resource-v1', scripted.contentVersion, scripted.resourceRef]));
  const oldPath = join(profileDir, `${legacyHash}.bin`), oldManifestPath = join(profileDir, 'manifest.json');
  const oldBytes = new Uint8Array(readFileSync(join(repo, 'tools/fixtures/manga-graphics/legacy-rgba-misread.jpg')));
  const corrected = new Uint8Array(readFileSync(join(repo, 'tools/fixtures/manga-graphics/expected.jpg')));
  assert.notDeepEqual(oldBytes, corrected);
  const oldManifest = JSON.stringify({ formatVersion: 2, ...scripted, manga: true,
    resourceHashes: [legacyHash], resourceDigests: { [legacyHash]: hash(oldBytes) }, completedAt: 1 });
  await fs.mkdir(profileDir, { recursive: true });
  await fs.writeFile(oldPath, oldBytes);await fs.writeFile(oldManifestPath, oldManifest);
  await assert.rejects(cache.loadResource(scripted), /READING_IMAGE_REPROCESS_REQUIRED/,
    'a valid old wrong-channel JPEG must not bypass the fixed graphics path');
  assert.equal(await cache.isChapterComplete(scripted), false, 'old matching digest is not the current Host processing receipt');
  const rawManga = { ...scripted, mangaDecodeRevision: 'identity-v1' };
  assert.deepEqual(await cache.loadResource(rawManga), oldBytes, 'identity-v1 retains its existing exact cache key');
  assert.equal(await cache.isChapterComplete(rawManga), true);
  assert.equal(await cache.isChapterComplete({ ...scripted, mangaDecodeRevision: undefined }), false, 'Disk API cannot certify an unknown manga profile as raw identity');
  for (const revision of [undefined, '', 'bytes-v99']) {
    await assert.rejects(cache.loadResource({ ...scripted, mangaDecodeRevision: revision }), /MANGA_CACHE_PROFILE_REQUIRED/);
  }
  let prepareCalls = 0, current = true, prepareFailure = false;
  const Owner = productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url),
    ['loadReadingImageOwned', 'prefetchReadingImageOwned', 'prepareReadingImageBytes'], {
      MangaImageDecodeHost: { instance: { async prepare(params, request, valid) {
        prepareCalls++;if (prepareFailure) throw Error('injected prepare failure');
        assert.equal(valid(), true);await request(params);return corrected;
      } } },
      ReadingBodyImageHost: { instance: { async loadBytes(value) { assert.deepEqual(value, corrected);return { fileUri: 'file://prepared', width: 8, height: 103 }; },
        async validateBytes(value) { assert.deepEqual(value, corrected); } } },
      hilog: { error() {} }, LOG_DOMAIN: 0,
    });
  const owner = Object.assign(new Owner(), { readingImageDiskCache: cache,
    async request(method) { assert.equal(method, 'manga.resource.prepare');return { data: {} }; },
    admitReadingImage(value) { return value; }, assertReadingImageCurrent(valid) { if (valid?.() === false) throw Error('cancelled'); } });
  await assert.rejects(owner.loadReadingImageOwned(scripted, false, () => current, 0, 'source-rules'), /REPROCESS_REQUIRED/);
  await assert.rejects(owner.prefetchReadingImageOwned(scripted, () => current, 'source-rules', false), /REPROCESS_REQUIRED/);
  assert.equal(prepareCalls, 0, 'offline cold entry with opaque resourceRef does not fetch or replay a script');
  prepareFailure = true;
  await assert.rejects(owner.prefetchReadingImageOwned(scripted, () => current, 'source-rules', true), /prepare failure/);
  prepareFailure = false;
  beforeSync = async () => { current = false; };
  await assert.rejects(owner.prefetchReadingImageOwned(scripted, () => current, 'source-rules', true), /superseded/);
  beforeSync = async () => {};current = true;
  assert.equal(await cache.isChapterComplete(scripted), false);
  assert.deepEqual(new Uint8Array(await fs.readFile(oldPath)), oldBytes);assert.equal(await fs.readFile(oldManifestPath, 'utf8'), oldManifest);
  const work = {};
  await owner.loadReadingImageOwned(scripted, true, () => current, 0, 'source-rules', false, work);await work.drain;
  assert.deepEqual(await cache.loadResource(scripted), corrected);
  assert.notEqual(await cache.resourcePath(scripted), oldPath);
  await cache.markChapterComplete(scripted, [scripted]);
  assert.equal(await cache.isChapterComplete(scripted), true);
  const profileManifestPath = join(profileDir, 'manifest-script-bgra-v2.json');
  const profileManifest = JSON.parse(await fs.readFile(profileManifestPath, 'utf8'));assert.equal(profileManifest.mangaCacheProfile, 'script-bgra-v2');
  assert.deepEqual(profileManifest.resourceHashes, [hash(JSON.stringify(['manga-resource-v2', 'script-bgra-v2', scripted.contentVersion, scripted.resourceRef]))]);
  await fs.writeFile(profileManifestPath, JSON.stringify({ ...profileManifest, mangaCacheProfile: 'unknown-profile' }));
  assert.equal(await cache.isChapterComplete(scripted), false, 'a filename alone is not a current processing receipt');
  await fs.writeFile(profileManifestPath, JSON.stringify(profileManifest));
  await assert.rejects(cache.markChapterComplete(scripted, [rawManga]), /MANGA_CACHE_PROFILE_REQUIRED/, 'raw and transformed receipts cannot be mixed');
  const cold = new Cache({ filesDir: root });assert.equal(await cold.isChapterComplete(scripted), true);
  assert.deepEqual(await cold.loadResource({ ...scripted, imageUrl: scripted.resourceRef }), corrected, 'cold entry needs no transport URL');
  const callsAfterRepair = prepareCalls;owner.readingImageDiskCache = cold;
  await owner.loadReadingImageOwned({ ...scripted, imageUrl: scripted.resourceRef }, false, () => current, 0, 'source-rules');
  assert.equal(prepareCalls, callsAfterRepair, 'actual Runtime cold path reads only the new profile without any URL');
  await owner.prefetchReadingImageOwned(scripted, () => current, 'source-rules', false);assert.equal(prepareCalls, callsAfterRepair);
  assert.deepEqual(new Uint8Array(await fs.readFile(oldPath)), oldBytes);assert.equal(await fs.readFile(oldManifestPath, 'utf8'), oldManifest);
  pass('scripted profile isolates legacy wrong-channel JPEG and completion; cold opaque refs, online repair, failed/cancelled repair preserve old bytes; identity-v1 retains the original path');
  // >2MiB and a nonzero view prevent an accidental whole-backing-buffer write.
  // Partial writes must preserve all bytes while each platform call is <=1MiB.
  const chunked={...image,bookId:'bounded-write'};
  const backing=new Uint8Array(2*1024*1024+173);for(let i=0;i<backing.length;i++)backing[i]=(i*13)%251;
  const window=backing.subarray(19,backing.length-37),expected=window.slice();
  writeSizes.length=0;writeLimit=333333;
  const storing=cache.storeResource(chunked,window);window.fill(7);await storing;writeLimit=Infinity;
  assert.deepEqual(await cache.loadResource(chunked),expected,'store snapshot isolates caller mutation and respects the input view');
  assert.ok(writeSizes.length>3);assert.ok(Math.max(...writeSizes)<=1024*1024,'every platform write uses at most a 1MiB source window');
  const stablePath=await cache.resourcePath(chunked);let live=true,writes=0;writeSizes.length=0;
  beforeWrite=async()=>{writes++;live=false;};
  await assert.rejects(cache.storeResource(chunked,expected,()=>live),/superseded/);beforeWrite=async()=>{};
  assert.equal(writes,1,'cancellation is checked before the next byte window');
  assert.deepEqual(new Uint8Array(await fs.readFile(stablePath)),expected,'cancelled replacement preserves the previous file');
  assert.equal((await fs.readdir(dirname(stablePath))).some(name=>name.includes('.tmp-')),false,'cancelled temporary output is removed');
  assert.equal(handles.size,0,'cancelled write closes its descriptor');
  beforeWrite=async()=>{throw Object.assign(Error('injected disk full'),{code:13900025});};
  await assert.rejects(cache.storeResource(chunked,expected),/storage_full/);beforeWrite=async()=>{};
  assert.deepEqual(new Uint8Array(await fs.readFile(stablePath)),expected);
  assert.equal(handles.size,0);assert.equal((await fs.readdir(dirname(stablePath))).some(name=>name.includes('.tmp-')),false);
  pass('1MiB partial-write windows preserve nonzero-view snapshots; cancellation and ENOSPC keep old bytes and close/delete partial output');
  const manga = { ...image, contentVersion: 'manga-v1', mangaDecodeRevision: 'identity-v1', resourceRef: `manga:mp1:${'a'.repeat(64)}` };
  await cache.storeResource(manga, bytes);
  const renewed = { ...manga, imageUrl: 'https://new-cdn/image?signature=renewed', baseUrl: 'https://new-cdn/' };
  assert.deepEqual(await cache.loadResource(renewed), bytes, 'signed transport changes do not change page identity');
  const duplicate = { ...manga, resourceRef: `manga:mp1:${'b'.repeat(64)}` };
  assert.equal(await cache.loadResource(duplicate), undefined, 'same URL is not a second logical page receipt');
  await cache.storeResource(duplicate, new Uint8Array([8, 9]));
  assert.deepEqual(await cache.loadResource(manga), bytes);
  assert.deepEqual(await cache.loadResource(duplicate), new Uint8Array([8, 9]));
  assert.notEqual(await cache.resourcePath(manga), await cache.resourcePath({ ...manga, contentVersion: 'manga-v2' }));
  pass('manga stable resource refs survive signed URL changes; duplicate logical pages and manifest versions remain isolated');
  await cache.markChapterComplete(manga, [manga, duplicate]);
  assert.equal(await cache.isChapterComplete(manga), true);
  resourceReads = 0;
  for(let i=0;i<5;i++) assert.equal(await cache.isChapterComplete(manga), true);
  assert.equal(resourceReads,0,'unchanged high-resolution file identities avoid repeated whole-image reads');
  const mangaPath=await cache.resourcePath(manga);
  await fs.writeFile(mangaPath,new Uint8Array([9,2,3])); // Same length, same second.
  assert.equal(await cache.isChapterComplete(manga),false,'same-size corruption must invalidate verification proof');
  await cache.storeResource(manga,bytes);assert.equal(await cache.isChapterComplete(manga),true);
  nanosecondStats=false;resourceReads=0;
  assert.equal(await cache.isChapterComplete(manga),true);assert.equal(await cache.isChapterComplete(manga),true);
  assert.ok(resourceReads>=4,'coarse timestamp platforms retain complete digest verification');
  nanosecondStats=true;
  await cache.clearBook(manga.sourceId,manga.bookId);
  assert.equal(await cache.isChapterComplete(manga),false,'clear cannot reuse an old digest proof');
  await cache.storeResource(manga,bytes);await cache.storeResource(duplicate,new Uint8Array([8,9]));
  await cache.markChapterComplete(manga,[manga,duplicate]);
  const reopenedProofs=new Cache({filesDir:root});resourceReads=0;
  assert.equal(await reopenedProofs.isChapterComplete(manga),true);assert.ok(resourceReads>=2,'cold cache must verify bytes again');
  pass('bounded native LRU skips repeated hash I/O only with nanosecond identity; same-size damage, coarse clocks, clear and restart remain verified');
  await cache.storeResource(image, bytes);
  await cache.markChapterComplete(chapter, [image, image]);
  const second = { ...image, contentVersion: 'B' };
  await cache.storeResource(second, new Uint8Array([4, 5]));
  await cache.markChapterComplete(second, [second]);
  await cache.markChapterComplete(chapter, [image]); // A late old-version publication.
  assert.equal(await cache.isChapterComplete(chapter), true);
  assert.equal(await cache.isChapterComplete(second), true);
  assert.deepEqual(await cache.loadResource(image), bytes);
  assert.deepEqual(await cache.loadResource(second), new Uint8Array([4, 5]));
  assert.notEqual(await cache.chapterDirectory(image), await cache.chapterDirectory(second));
  assert.equal(await cache.isChapterMaterialized('source', 'book', 1), false);
  pass('old/new versions and late old manifest coexist; ordinal alone does not prove completion');

  const corrupt = { ...image, contentVersion: 'corrupt' };
  const corruptPath = await cache.resourcePath(corrupt);
  await fs.mkdir(dirname(corruptPath), { recursive: true });
  await fs.writeFile(corruptPath, new Uint8Array());
  await assert.rejects(cache.markChapterComplete(corrupt, [corrupt]), /missing bytes/);
  await fs.unlink(await cache.resourcePath(second));
  assert.equal(await cache.isChapterComplete(second), false);
  assert.equal(await cache.isChapterComplete(chapter), true);
  pass('zero-length/missing resources cannot certify completion or harm another version');

  const legacy = { ...image, bookId: 'legacy' };
  await seedLegacy(legacy);
  assert.deepEqual(await cache.loadResource(legacy), bytes);
  assert.deepEqual(new Uint8Array(await fs.readFile(await cache.resourcePath(legacy))), bytes);
  assert.equal(await cache.isChapterComplete(legacy), false);
  await cache.markChapterComplete(legacy, [legacy]);
  assert.equal(await cache.isChapterComplete(legacy), true);
  const mismatch = { ...image, bookId: 'mismatch' };
  await seedLegacy(mismatch, { contentVersion: 'wrong-version' });
  assert.equal(await cache.loadResource(mismatch), undefined);
  assert.equal(await cache.loadResource({ ...legacy, chapterIndex: 2 }), undefined);
  const collisionA = { ...image, sourceId: 'a\0b', bookId: 'c' };
  const collisionB = { ...image, sourceId: 'a', bookId: 'b\0c' };
  assert.notEqual(await cache.bookHash(collisionA.sourceId, collisionA.bookId), await cache.bookHash(collisionB.sourceId, collisionB.bookId));
  await seedLegacy(collisionA);
  assert.equal(await cache.loadResource(collisionB), undefined);
  await cache.clearBook(collisionB.sourceId, collisionB.bookId);
  assert.deepEqual(await cache.loadResource(collisionA), bytes);
  const ambiguous = { ...image, bookId: 'legacy-ambiguous', imageUrl: 'https://img/x\0suffix' };
  await seedLegacy(ambiguous);
  assert.equal(await cache.loadResource(ambiguous), undefined);
  await cache.storeResource(ambiguous, bytes); // v2's tuple encoding remains exact.
  assert.deepEqual(await cache.loadResource(ambiguous), bytes);
  pass('legacy migration requires exact identity/version; neither ordinal nor delimiter collision is trusted');

  const failed = { ...image, contentVersion: 'failed-publication' };
  await cache.storeResource(failed, bytes);
  const failedManifest = join(await cache.chapterDirectory(failed), 'manifest.json');
  failRename = path => path === failedManifest;
  await assert.rejects(cache.markChapterComplete(failed, [failed]), /rename failure/);
  failRename = () => false;
  assert.equal(await cache.isChapterComplete(failed), false);
  assert.equal(await cache.isChapterComplete(chapter), true);
  assert.equal((await fs.readdir(dirname(failedManifest))).some(name => name.includes('.tmp-')), false);
  // A process dying before rename can leave a temp file; it is never evidence.
  await fs.writeFile(`${failedManifest}.tmp-crash`, '{"formatVersion":2');
  assert.equal(await new Cache({ filesDir: root }).isChapterComplete(failed), false);
  pass('failed manifest rename/crash temp cannot complete a chapter or replace the prior version');

  const stale = cache.captureValidity(image.sourceId, image.bookId);
  await cache.clearBook(image.sourceId, image.bookId);
  await assert.rejects(cache.storeResource(image, bytes, stale), /superseded/);
  assert.equal(await cache.loadResource(image), undefined);
  await cache.storeResource(image, bytes);
  pass('a request captured before clear cannot republish; a fresh request can');

  let reachedSync;
  let releaseSync;
  const reached = new Promise(resolve => { reachedSync = resolve; });
  const release = new Promise(resolve => { releaseSync = resolve; });
  beforeSync = async () => { reachedSync(); await release; };
  const racing = { ...image, bookId: 'racing' };
  const write = cache.storeResource(racing, bytes);
  const rejectedWrite = assert.rejects(write, /superseded/);
  await reached;
  const clear = cache.clearBook(racing.sourceId, racing.bookId);
  beforeSync = async () => {};
  releaseSync();
  await rejectedWrite;
  await clear;
  assert.equal(await cache.loadResource(racing), undefined);
  assert.deepEqual(await cache.loadResource(legacy), bytes);
  pass('clear during fsync invalidates publication before rename and preserves unrelated books');

  const interrupted = { ...image, bookId: 'interrupted-clear' };
  await seedLegacy(interrupted);
  await cache.loadResource(interrupted);
  const blockedPath = await cache.resourcePath(interrupted);
  failUnlink = path => path === blockedPath;
  await assert.rejects(cache.clearBook(interrupted.sourceId, interrupted.bookId), /unlink failure/);
  const reopened = new Cache({ filesDir: root });
  await assert.rejects(reopened.loadResource(interrupted), /unlink failure/);
  failUnlink = () => false;
  assert.equal(await reopened.loadResource(interrupted), undefined);
  // Even an unidentifiable v1 leftover becoming readable cannot revive after clear.
  await seedLegacy(interrupted);
  assert.equal(await reopened.loadResource(interrupted), undefined);
  await reopened.storeResource(interrupted, bytes);
  assert.deepEqual(await reopened.loadResource(interrupted), bytes);
  pass('failed clear survives restart, denies reads until cleanup completes, and permanently revokes v1 fallback');

  const closing = new Cache({ filesDir: root });
  const beforeClose = closing.captureValidity(image.sourceId, image.bookId);
  closing.close();
  await assert.rejects(closing.storeResource(image, bytes, beforeClose), /superseded/);
  await assert.rejects(closing.loadResource(image), /superseded/);
  pass('runtime close invalidates queued and newly requested cache operations');

  console.log(JSON.stringify({ status: 'PASS', productionSourceSha256: hash(source), checks }, null, 2));
} finally {
  failUnlink = () => false;
  await fs.rm(root, { recursive: true, force: true });
}

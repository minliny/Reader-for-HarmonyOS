import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const fs=await import('node:fs/promises');
const { readFileSync }=await import('node:fs');
const { tmpdir }=await import('node:os');
const { dirname, join, resolve }=await import('node:path');
const { fileURLToPath }=await import('node:url');
const { createHash }=await import('node:crypto');
const { stripTypeScriptTypes }=await import('node:module');
const { productionMotionMethods }=await import('./lib/reader-motion-method-probe.mjs');
const { createMangaAtomicPayloadReaderFixture, createMangaAtomicPayloadBindingFixture, checkMangaAtomicPayloadSdk }=await import('./lib/manga-atomic-payload-probe.mjs');

if(id.startsWith('worker-'))checkMangaAtomicPayloadSdk();

// Execute the whole production class. Only Harmony's platform APIs are adapted
// to a real temporary filesystem; this is not device or platform durability proof.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(repo, 'entry/src/main/ets/app/ReadingImageDiskCache.ts'), 'utf8');
// Negative control restores the former whole-book deletion in the executed
// class. The same filesystem assertions must catch its ownership violation.
const negativeControl=id==='negative-whole-tree-clear';
const broadClear = `const removeTree = async (path) => {
  if (!(await fileIo.access(path))) return;
  for (const name of await fileIo.listFile(path)) {
    const child = path + '/' + name;
    if ((await fileIo.stat(child)).isDirectory()) await removeTree(child);
    else await fileIo.unlink(child);
  }
  await fileIo.rmdir(path);
};
await removeTree(this.rootDirectory() + '/' + await this.bookHash(sourceId, bookId));
    const legacyBook`;
const testedSource = negativeControl ? source.replace(/const book = `\$\{this\.rootDirectory\(\)\}[\s\S]*?\n    const legacyBook/, broadClear) : source;
if (negativeControl) assert.notEqual(testedSource, source, 'negative control must mutate the production clear');
let executable = stripTypeScriptTypes(testedSource.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
const handles = new Map();
let failRename = () => false;
let failUnlink = () => false;
let failRead = () => false;
// Focused RED control: replay the former synchronous payload call inside the
// unchanged production class. It must fail the worker-wait regression below.
if (id==='worker-sync-negative') executable = executable.replace(
  'await readMangaAtomicPayload(path, stat.size, MAX_READING_IMAGE_BYTES, isCurrent)',
  'new Uint8Array(new fileIo.AtomicFile(path).readFully())');
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
    readFully() {
      if(this.path.endsWith('.bin')) resourceReads++;
      if (failRead(this.path)) throw new Error('injected ownership read failure');
      const bytes = readFileSync(this.path); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  },
};
const {createRequire}=await import('node:module');const {resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');const sdkLru=createRequire(import.meta.url)(resolveEtsLoaderRoot()+'/node_modules/lru-cache');
const util = {
  // Platform LRU substitute only for the native API boundary; cache validity
  // policy remains the production class exercised below.
  LRUCache: class {constructor(capacity){this.cache=new sdkLru({max:capacity});}get(k){return this.cache.get(k);}put(k,v){this.cache.set(k,v);}remove(k){this.cache.del(k);}keys(){return this.cache.keys();}clear(){this.cache.reset();}},
  TextEncoder: class { encodeInto(value) { return new TextEncoder().encode(value); } },
  TextDecoder: { create: (_, options) => ({ decodeToString: bytes => new TextDecoder('utf-8', options).decode(bytes) }) },
};
const crypto = { createMd: () => {
  const hash = createHash('sha256');
  return { update: async ({ data }) => { hash.update(data); }, digest: async () => ({ data: hash.digest() }) };
} };
const canonicalBase = base => base?.trim().split('#')[0] || undefined;
const atomicReadHooks = {};
const readMangaAtomicPayload = createMangaAtomicPayloadReaderFixture(io, atomicReadHooks);
class MaterializationError extends Error {}
const Cache = new Function('fileIo', 'statfs', 'cryptoFramework', 'util', 'canonicalReadingImageBaseUrl',
  'assertReadingOfflineWriteCapacity', 'ReadingOfflineMaterializationError', 'readMangaAtomicPayload', `${executable}\nreturn ReadingImageDiskCache;`)(
  io, { getFreeSize: async () => 1e9 }, crypto, util, canonicalBase,
  (free, bytes, reserve) => { if (free < bytes + reserve) throw new Error('storage_full'); }, MaterializationError, readMangaAtomicPayload,
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
const exists = path => fs.access(path).then(() => true, () => false);
async function seedFile(path, value = bytes) {
  await fs.mkdir(dirname(path), { recursive: true }); await fs.writeFile(path, value);
  return path;
}
async function seedLegacy(identity, override = {}) {
  const directory = legacyDir(identity);
  const resourceHash = hash(`${identity.contentVersion}\0${identity.imageUrl}\0${canonicalBase(identity.baseUrl) ?? ''}`);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(join(directory, `${resourceHash}.bin`), bytes);
  await fs.writeFile(join(directory, 'manifest.json'), JSON.stringify({ formatVersion: 1, ...identity, resourceHashes: [resourceHash], ...override }));
  return directory;
}

try{
if(id==='profile-upgrade'){
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
    ['loadReadingImageOwned', 'prefetchReadingImageOwned', 'prepareReadingImageBytes', 'mangaStorageChapter'], {
      MangaImageDecodeHost: { instance: { async prepare(params, request, valid) {
        prepareCalls++;if (prepareFailure) throw Error('injected prepare failure');
        assert.equal(valid(), true);await request(params);return corrected;
      } } },
      ReadingBodyImageHost: { instance: { async loadBytes(value) { assert.deepEqual(value, corrected);return { fileUri: 'file://prepared', width: 8, height: 103 }; },
        async loadMangaBytes(value) { assert.deepEqual(value, corrected);return {fileUri:'file://prepared',width:8,height:103}; },
        async prepareMangaDisplay(value) { assert.deepEqual(value, corrected); },
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

}
if(id==='bounded-write'){
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

}
if(id==='manga-identity-proof'){
  const manga = { ...image, bookId: 'manga-proof-book', contentVersion: 'manga-v1', mangaDecodeRevision: 'identity-v1', resourceRef: `manga:mp1:${'a'.repeat(64)}` };
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
  assert.equal(await cache.isChapterComplete(manga),true,'ordinary clear preserves an old manga whose Core retention is unknown');
  await fs.writeFile(mangaPath,new Uint8Array([9,2,3]));
  assert.equal(await cache.isChapterComplete(manga),false,'a preserved file still cannot reuse a stale digest proof');
  await cache.storeResource(manga,bytes);await cache.storeResource(duplicate,new Uint8Array([8,9]));
  await cache.markChapterComplete(manga,[manga,duplicate]);
  const reopenedProofs=new Cache({filesDir:root});resourceReads=0;
  assert.equal(await reopenedProofs.isChapterComplete(manga),true);assert.ok(resourceReads>=2,'cold cache must verify bytes again');
  pass('bounded native LRU skips repeated hash I/O only with nanosecond identity; same-size damage, coarse clocks, conservative manga clear and restart remain verified');

}
if(id==='version-isolation'){
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
  assert.equal(await cache.isChapterMaterialized(chapter.sourceId, chapter.bookId, chapter.chapterIndex), false,
    'an ordinal alone cannot certify assets without the exact body version');
  pass('old/new versions and late old manifest coexist; completeness requires exact identity');

  const corrupt = { ...image, contentVersion: 'corrupt' };
  const corruptPath = await cache.resourcePath(corrupt);
  await fs.mkdir(dirname(corruptPath), { recursive: true });
  await fs.writeFile(corruptPath, new Uint8Array());
  await assert.rejects(cache.markChapterComplete(corrupt, [corrupt]), /missing bytes/);
  await fs.unlink(await cache.resourcePath(second));
  assert.equal(await cache.isChapterComplete(second), false);
  assert.equal(await cache.isChapterComplete(chapter), true);
  pass('zero-length/missing resources cannot certify completion or harm another version');


}
if(id==='legacy-migration'){
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


}
if(id==='manifest-atomic'){
await cache.storeResource(image,bytes);await cache.markChapterComplete(chapter,[image]);
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


}
if(id==='clear-generation'){
  const stale = cache.captureValidity(image.sourceId, image.bookId);
  await cache.clearBook(image.sourceId, image.bookId);
  await assert.rejects(cache.storeResource(image, bytes, stale), /superseded/);
  assert.equal(await cache.loadResource(image), undefined);
  await cache.storeResource(image, bytes);
  pass('a request captured before clear cannot republish; a fresh request can');


}
if(id==='clear-fsync'){
const legacy={...image,bookId:'legacy'};await seedLegacy(legacy);await cache.loadResource(legacy);
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


}
if(id==='clear-restart'){
  const interrupted = { ...image, bookId: 'interrupted-clear' };
  await seedLegacy(interrupted);
  await cache.loadResource(interrupted);
  const blockedPath = await cache.resourcePath(interrupted);
  const pendingPath = await cache.clearMarkerPath(interrupted.sourceId, interrupted.bookId);
  failUnlink = path => path === blockedPath;
  await assert.rejects(cache.clearBook(interrupted.sourceId, interrupted.bookId), /unlink failure/);
  assert.equal(await exists(pendingPath), true);
  assert.equal(await exists(`${pendingPath}.legacy-revoked`), false);
  assert.equal(await exists(join(dirname(blockedPath), 'text-identity.json')), true);
  const reopened = new Cache({ filesDir: root });
  await assert.rejects(reopened.loadResource(interrupted), /unlink failure/);
  failUnlink = () => false;
  assert.equal(await reopened.loadResource(interrupted), undefined);
  assert.equal(await exists(pendingPath), false);
  assert.equal(await exists(`${pendingPath}.legacy-revoked`), true);
  // Even an unidentifiable v1 leftover becoming readable cannot revive after clear.
  await seedLegacy(interrupted);
  assert.equal(await reopened.loadResource(interrupted), undefined);
  await reopened.storeResource(interrupted, bytes);
  assert.deepEqual(await reopened.loadResource(interrupted), bytes);
  pass('failed clear survives restart, denies reads until cleanup completes, and permanently revokes v1 fallback');


}
if(['mixed-clear','negative-whole-tree-clear'].includes(id)){
const check=async()=>{
  const mixed = { ...image, bookId: 'mixed-owners' };
  await cache.storeResource(mixed, bytes);
  assert.equal(await cache.isChapterComplete(mixed), false, 'text ownership is not an offline-completion manifest');
  await cache.markChapterComplete(mixed, [mixed]);
  const mixedDirectory = await cache.chapterDirectory(mixed);
  const mixedBook = dirname(dirname(mixedDirectory));
  const preserved = [];
  const keep = async (path, value = bytes) => { await seedFile(path, value); preserved.push([path, new Uint8Array(await fs.readFile(path))]); };
  await keep(join(mixedBook, '.manga', hash('stable-chapter'), hash('read-version'), 'manga-identity.json'),
    JSON.stringify({ sourceId: mixed.sourceId, bookId: mixed.bookId, chapterId: 'stable-chapter', contentVersion: 'read-version' }));
  await keep(join(mixedBook, '.manga', hash('stable-chapter'), hash('read-version'), 'original.bin'));
  const oldManga = { ...mixed, chapterIndex: 8, contentVersion: 'old-manga' };
  const oldMangaDirectory = await cache.chapterDirectory(oldManga);
  await keep(join(oldMangaDirectory, 'manifest.json'), JSON.stringify({ formatVersion: 2, ...oldManga,
    manga: true, resourceHashes: [hash('old manga resource')], completedAt: 1 }));
  await keep(join(oldMangaDirectory, `${hash('old manga resource')}.bin`));
  const legacyManga = { ...mixed, chapterIndex: 9, contentVersion: 'legacy-manga' };
  await seedLegacy(legacyManga, { manga: true, chapterId: 'legacy-chapter' });
  for (const name of await fs.readdir(legacyDir(legacyManga))) {
    const path = join(legacyDir(legacyManga), name); preserved.push([path, new Uint8Array(await fs.readFile(path))]);
  }
  const profiledDirectory = await cache.chapterDirectory({ ...mixed, chapterIndex: 10, contentVersion: 'profiled' });
  await keep(join(profiledDirectory, 'manifest-script-bgra-v2.json'), JSON.stringify({ formatVersion: 2,
    ...mixed, chapterIndex: 10, contentVersion: 'profiled', manga: true, mangaCacheProfile: 'script-bgra-v2' }));
  await keep(join(profiledDirectory, 'profile.bin'));
  const identityDirectory = await cache.chapterDirectory({ ...mixed, chapterIndex: 11, contentVersion: 'partial-manga' });
  await keep(join(identityDirectory, 'manga-identity.json'), JSON.stringify({ sourceId: mixed.sourceId,
    bookId: mixed.bookId, chapterId: 'partial-manga', contentVersion: 'partial-manga' }));
  await keep(join(identityDirectory, 'partial.bin'));
  // Unknown bytes can even occupy an exact-looking ordinal/version path.
  // Their shape alone must not authorize deletion or post-clear admission.
  const unowned = { ...mixed, chapterIndex: 12, contentVersion: 'unowned' };
  await keep(await cache.resourcePath(unowned));
  await keep(join(mixedBook, 'another-owner', 'private.db'));
  await keep(join(mixedDirectory, 'another-owner', 'private.db'));
  await keep(join(mixedDirectory, `${hash('unlisted resource')}.bin`));
  await keep(join(mixedBook, '13', hash('corrupt'), 'manifest.json'), '{broken');
  await keep(join(mixedBook, '13', hash('corrupt'), 'unknown.bin'));
  const foreign = { ...mixed, chapterIndex: 14, contentVersion: 'foreign' };
  const foreignDirectory = await cache.chapterDirectory(foreign);
  await keep(join(foreignDirectory, 'manifest.json'), JSON.stringify({ formatVersion: 2, ...foreign,
    sourceId: 'another-source', resourceHashes: [hash('foreign resource')], completedAt: 1 }));
  await keep(join(foreignDirectory, `${hash('foreign resource')}.bin`));
  const mixedLegacyText = { ...mixed, chapterIndex: 15, contentVersion: 'legacy-text' };
  await seedLegacy(mixedLegacyText);
  const beforeMixedClear = cache.captureValidity(mixed.sourceId, mixed.bookId);
  await cache.clearBook(mixed.sourceId, mixed.bookId);
  assert.equal(await exists(await cache.resourcePath(mixed)), false);
  assert.equal(await exists(join(mixedDirectory, 'manifest.json')), false);
  assert.equal(await exists(join(mixedDirectory, 'text-identity.json')), false);
  assert.equal(await exists(legacyDir(mixedLegacyText)), false);
  for (const [path, expected] of preserved) assert.deepEqual(new Uint8Array(await fs.readFile(path)), expected,
    `clear must preserve foreign/manga bytes: ${path}`);
  assert.equal(await cache.loadResource(unowned), undefined, 'unowned historical bytes must not revive after clear');
  await assert.rejects(cache.storeResource(mixed, bytes, beforeMixedClear), /superseded/);
  await cache.storeResource(unowned, new Uint8Array([7, 8]));
  assert.deepEqual(await new Cache({ filesDir: root }).loadResource(unowned), new Uint8Array([7, 8]),
    'fresh partial text ownership must survive restart without completing a chapter');
  assert.equal(await cache.isChapterComplete(unowned), false);
  pass('mixed clear removes only exact text resources; manga, unknown owners and unlisted nested files stay byte-identical');


};if(id==='negative-whole-tree-clear')await assert.rejects(check,e=>e.code==='ENOENT'&&e.path.includes('manga-identity.json'));else await check();
}
if(id==='old-pending'){
  const pendingMixed = { ...image, bookId: 'old-pending-mixed' };
  await cache.storeResource(pendingMixed, bytes); await cache.markChapterComplete(pendingMixed, [pendingMixed]);
  const pendingMixedBook = dirname(dirname(await cache.chapterDirectory(pendingMixed)));
  const pendingManga = await seedFile(join(pendingMixedBook, '.manga', 'retained', 'bytes.bin'));
  const pendingUnknown = await seedFile(join(pendingMixedBook, 'unknown-owner', 'bytes.bin'));
  const oldPending = await cache.clearMarkerPath(pendingMixed.sourceId, pendingMixed.bookId);
  await seedFile(oldPending, 'clear');
  const pendingReopened = new Cache({ filesDir: root });
  assert.equal(await pendingReopened.loadResource(pendingMixed), undefined);
  assert.equal(await exists(oldPending), false);
  assert.equal(await exists(`${oldPending}.legacy-revoked`), true);
  assert.deepEqual(new Uint8Array(await fs.readFile(pendingManga)), bytes);
  assert.deepEqual(new Uint8Array(await fs.readFile(pendingUnknown)), bytes);
  pass('a historical broad pending intent resumes with current text ownership, preserving other owners');


}
if(id==='ownership-read'){
  const ownershipReadFailure = { ...image, bookId: 'ownership-read-failure' };
  await cache.storeResource(ownershipReadFailure, bytes); await cache.markChapterComplete(ownershipReadFailure, [ownershipReadFailure]);
  const ownershipManifest = join(await cache.chapterDirectory(ownershipReadFailure), 'manifest.json');
  const readFailurePending = await cache.clearMarkerPath(ownershipReadFailure.sourceId, ownershipReadFailure.bookId);
  failRead = path => path === ownershipManifest;
  await assert.rejects(cache.clearBook(ownershipReadFailure.sourceId, ownershipReadFailure.bookId), /ownership read failure/);
  assert.equal(await exists(readFailurePending), true);
  assert.equal(await exists(`${readFailurePending}.legacy-revoked`), false);
  assert.deepEqual(new Uint8Array(await fs.readFile(await cache.resourcePath(ownershipReadFailure))), bytes);
  failRead = () => false;
  assert.equal(await new Cache({ filesDir: root }).loadResource(ownershipReadFailure), undefined);
  assert.equal(await exists(readFailurePending), false);
  pass('ownership I/O failure remains retryable and never publishes a completed clear');


}
if(id==='clear-markers'){
  const markerFailure = { ...image, bookId: 'marker-failure' };
  await cache.storeResource(markerFailure, bytes);
  const markerPending = await cache.clearMarkerPath(markerFailure.sourceId, markerFailure.bookId);
  failRename = path => path === `${markerPending}.legacy-revoked`;
  await assert.rejects(cache.clearBook(markerFailure.sourceId, markerFailure.bookId), /rename failure/);
  assert.equal(await exists(markerPending), true);
  assert.equal(await exists(`${markerPending}.legacy-revoked`), false);
  failRename = () => false;
  failUnlink = path => path === markerPending;
  await assert.rejects(new Cache({ filesDir: root }).loadResource(markerFailure), /unlink failure/);
  assert.equal(await exists(markerPending), true);
  failUnlink = () => false;
  assert.equal(await new Cache({ filesDir: root }).loadResource(markerFailure), undefined);
  assert.equal(await exists(markerPending), false);
  pass('revocation publication and pending-marker removal failures cannot falsely settle clear and retry after restart');


}
if(id==='close'){
  const closing = new Cache({ filesDir: root });
  const beforeClose = closing.captureValidity(image.sourceId, image.bookId);
  closing.close();
  await assert.rejects(closing.storeResource(image, bytes, beforeClose), /superseded/);
  await assert.rejects(closing.loadResource(image), /superseded/);
  pass('runtime close invalidates queued and newly requested cache operations');


}
if(['worker-ownership','worker-sync-negative'].includes(id)){
const check=async()=>{
  const foreground = { ...image, bookId:'worker-foreground', chapterId:'https://chapter/foreground',
    resourceRef:`manga:mp1:${'7'.repeat(64)}`, mangaDecodeRevision:'identity-v1' };
  const waiting = { ...foreground, bookId:'worker-waiting', chapterId:'https://chapter/waiting', resourceRef:`manga:mp1:${'8'.repeat(64)}` };
  await cache.storeResource(foreground, bytes); await cache.storeResource(waiting, bytes);
  const foregroundPath = await cache.resourcePath(foreground), waitingPath = await cache.resourcePath(waiting);
  let entered, proceed, admitted;
  const atWorker = new Promise(resolve => { entered = resolve; });
  const heldWorker = new Promise(resolve => { proceed = resolve; });
  const atWaiting = new Promise(resolve => { admitted = resolve; });
  const jobs = []; let waitingCurrent = true, first = true;
  atomicReadHooks.onAdmission = args => { if (args[0] === waitingPath) admitted(); };
  atomicReadHooks.beforeExecute = async args => {
    jobs.push(args[0]);
    if (args[0] === foregroundPath && first) { first = false; entered(); await heldWorker; }
  };
  let foregroundRead, waitingRead;
  try {
    const beforeRead = resourceReads;
    foregroundRead = cache.loadResource(foreground);
    await Promise.race([atWorker, foregroundRead.then(() => { throw Error('payload returned before any SDK worker dispatch'); })]);
    assert.equal(resourceReads, beforeRead, 'the held SDK dispatch must precede any original payload read');
    assert.ok(cache.mangaBusy.size > 0, 'chapter pin spans queued/active platform work');
    waitingRead = cache.loadResource(waiting, () => waitingCurrent);
    const waitingRejected = assert.rejects(waitingRead, /MANGA_RESOURCE_CANCELLED/);
    await atWaiting; waitingCurrent = false;
    assert.equal(jobs.includes(waitingPath), false, 'a second book is only a descriptor while the native read is active');
    proceed();
    assert.deepEqual(await foregroundRead, bytes); await waitingRejected;
    assert.equal(jobs.includes(waitingPath), false, 'invalidated queued content must not reach AtomicFile');
    assert.equal(cache.mangaBusy.size, 0, 'both chapter pins release after their owned waits settle');
    assert.deepEqual(new Uint8Array(await fs.readFile(waitingPath)), bytes, 'cancellation preserves valid original bytes');
  } finally {
    proceed(); await Promise.allSettled([foregroundRead, waitingRead]);
    delete atomicReadHooks.onAdmission; delete atomicReadHooks.beforeExecute;
  }
  pass('SDK worker wait retains chapter pins; cross-book queued cancellation reads no original bytes and preserves downloads');

  let readCompleted, settle, activeCurrent = true, activeFirst = true;
  const atRead = new Promise(resolve => { readCompleted = resolve; });
  const heldReceipt = new Promise(resolve => { settle = resolve; });
  atomicReadHooks.afterExecute = async args => {
    if (args[0] === waitingPath && activeFirst) { activeFirst = false; readCompleted(); await heldReceipt; }
  };
  let activeRead;
  try {
    const beforeRead = resourceReads;
    activeRead = cache.loadResource(waiting, () => activeCurrent);
    const rejected = assert.rejects(activeRead, /MANGA_RESOURCE_CANCELLED/);
    await atRead;
    assert.ok(resourceReads > beforeRead, 'the real AtomicFile port read has already executed');
    activeCurrent = false;
    assert.ok(cache.mangaBusy.size > 0, 'invalidation cannot release a pin before platform completion settles');
    settle(); await rejected;
    assert.equal(cache.mangaBusy.size, 0); assert.deepEqual(new Uint8Array(await fs.readFile(waitingPath)), bytes);
  } finally { settle(); await Promise.allSettled([activeRead]); delete atomicReadHooks.afterExecute; }
  pass('started read keeps its chapter pin until completion settles, then rejects stale bytes without deleting originals');

  atomicReadHooks.beforeExecute = () => { throw Error('injected worker initialization failure'); };
  try { await assert.rejects(cache.loadResource(waiting), /worker initialization failure/); }
  finally { delete atomicReadHooks.beforeExecute; }
  assert.deepEqual(new Uint8Array(await fs.readFile(waitingPath)), bytes);
  assert.deepEqual(await cache.loadResource(waiting), bytes, 'a failed worker must not poison the admission lane');
  await assert.rejects(readMangaAtomicPayload(waitingPath, 0, 16 * 1024 * 1024, () => true), /MANGA_ATOMIC_PAYLOAD_BUDGET/);
  await assert.rejects(readMangaAtomicPayload(waitingPath, bytes.length + 1, 16 * 1024 * 1024, () => true), /MANGA_ATOMIC_PAYLOAD_CHANGED/);
  pass('worker failure has no synchronous fallback/deletion; later reads recover and byte/extent budgets remain enforced');

  // Native taskpool results may cross a realm boundary as a typed-array view.
  // The production envelope must validate byte length without relying on
  // `instanceof ArrayBuffer`, while still returning the same bytes.
  atomicReadHooks.afterExecute = (_args, result) => new Uint8Array(result);
  try {
    assert.deepEqual(await readMangaAtomicPayload(waitingPath, bytes.length, 16 * 1024 * 1024, () => true), bytes,
      'cross-thread typed-array payloads remain readable');
  } finally { delete atomicReadHooks.afterExecute; }
  pass('cross-thread binary result accepts a typed-array transport envelope');

  const binding = createMangaAtomicPayloadBindingFixture(io), beforeBindingRead = resourceReads;
  await assert.rejects(binding.readMangaAtomicPayload(waitingPath, bytes.length, 16 * 1024 * 1024, () => true), /MANGA_ATOMIC_READER_UNAVAILABLE/);
  assert.equal(resourceReads, beforeBindingRead, 'missing ETS installation fails closed without a synchronous payload fallback');
  assert.equal(binding.installMangaAtomicPayloadReader(), undefined);
  assert.equal(binding.installMangaAtomicPayloadReader(), undefined, 'the same process worker installs idempotently');
  assert.deepEqual(await binding.readMangaAtomicPayload(waitingPath, bytes.length, 16 * 1024 * 1024, () => true), bytes);
  assert.throws(() => binding.bindMangaAtomicPayloadReader(async () => new Uint8Array([99])), /MANGA_ATOMIC_READER_ALREADY_INSTALLED/);
  assert.deepEqual(await binding.readMangaAtomicPayload(waitingPath, bytes.length, 16 * 1024 * 1024, () => true), bytes,
    'a conflicting late install cannot replace the stable worker binding');
  pass('actual TS port fails closed before ETS install, installs idempotently and rejects conflicting rebinding');


};if(id==='worker-sync-negative')await assert.rejects(check,/payload returned before any SDK worker dispatch/);else await check();
}
}finally{failUnlink=()=>false;failRead=()=>false;failRename=()=>false;for(const handle of handles.values())await handle.close().catch(()=>{});await fs.rm(root,{recursive:true,force:true});}
}
const definitions={"profile-upgrade": "profile-upgrade actual scoped owner/gateway/storage path; controlled Core/OS ports", "bounded-write": "bounded-write actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-identity-proof": "manga-identity-proof actual scoped owner/gateway/storage path; controlled Core/OS ports", "version-isolation": "version-isolation actual scoped owner/gateway/storage path; controlled Core/OS ports", "legacy-migration": "legacy-migration actual scoped owner/gateway/storage path; controlled Core/OS ports", "manifest-atomic": "manifest-atomic actual scoped owner/gateway/storage path; controlled Core/OS ports", "clear-generation": "clear-generation actual scoped owner/gateway/storage path; controlled Core/OS ports", "clear-fsync": "clear-fsync actual scoped owner/gateway/storage path; controlled Core/OS ports", "clear-restart": "clear-restart actual scoped owner/gateway/storage path; controlled Core/OS ports", "mixed-clear": "mixed-clear actual scoped owner/gateway/storage path; controlled Core/OS ports", "old-pending": "old-pending actual scoped owner/gateway/storage path; controlled Core/OS ports", "ownership-read": "ownership-read actual scoped owner/gateway/storage path; controlled Core/OS ports", "clear-markers": "clear-markers actual scoped owner/gateway/storage path; controlled Core/OS ports", "close": "close actual scoped owner/gateway/storage path; controlled Core/OS ports", "worker-ownership": "worker-ownership actual scoped owner/gateway/storage path; controlled Core/OS ports", "negative-whole-tree-clear": "old whole-tree clear must violate exact preserved manga owner file", "worker-sync-negative": "old synchronous AtomicFile path must violate queued SDK worker ownership"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}

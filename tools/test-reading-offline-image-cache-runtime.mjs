import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';

// Execute the whole production class. Only Harmony's platform APIs are adapted
// to a real temporary filesystem; this is not device or platform durability proof.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(repo, 'entry/src/main/ets/app/ReadingImageDiskCache.ts'), 'utf8');
const executable = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
const handles = new Map();
let failRename = () => false;
let failUnlink = () => false;
let beforeSync = async () => {};
const io = {
  OpenMode: { CREATE: 1, READ_WRITE: 2, TRUNC: 4 },
  access: async path => fs.access(path).then(() => true, () => false),
  stat: path => fs.stat(path),
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
  write: async (fd, bytes) => (await handles.get(fd).write(new Uint8Array(bytes))).bytesWritten,
  fsync: async fd => { await beforeSync(); await handles.get(fd).sync(); },
  close: async handle => { handles.delete(handle.fd); await handle.close(); },
  rename: async (from, to) => {
    if (failRename(to)) throw new Error('injected rename failure');
    await fs.rename(from, to);
  },
  AtomicFile: class {
    constructor(path) { this.path = path; }
    readFully() { const bytes = readFileSync(this.path); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }
  },
};
const util = {
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

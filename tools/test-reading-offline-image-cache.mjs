import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = readFileSync(resolve(repo,
  'entry/src/main/ets/app/ReadingImageDiskCache.ts'), 'utf8');
const owner = readFileSync(resolve(repo,
  'entry/src/main/ets/app/ReaderRuntimeOwner.ts'), 'utf8');

assert.match(cache, /const MAX_READING_IMAGE_BYTES = 16 \* 1024 \* 1024/);
assert.match(cache, /const MIN_READING_IMAGE_FREE_RESERVE_BYTES = 16 \* 1024 \* 1024/);
assert.match(cache, /import statfs from '@ohos\.file\.statvfs'/);
assert.match(cache, /interface ReadingImageFreeSpaceProbe/);
assert.match(cache, /freeSpaceProbe: ReadingImageFreeSpaceProbe = new HarmonyReadingImageFreeSpaceProbe\(\)/);
assert.match(cache, /assertReadingOfflineWriteCapacity\([\s\S]*MIN_READING_IMAGE_FREE_RESERVE_BYTES/);
assert.match(cache, /FILE_SYSTEM_NO_SPACE_ERROR = 13900025/);
assert.match(cache, /ReadingOfflineMaterializationError\([\s\S]*'storage_full'/);
assert.match(cache, /reader-offline\/images-v2/);
assert.match(cache, /legacyRootDirectory[\s\S]*reader-offline\/images-v1/);
assert.match(cache, /bookHash[\s\S]*return this\.sha256\(JSON\.stringify\(\[sourceId, bookId\]\)\)/,
  'book paths must use opaque hashes rather than source URLs or credentials');
assert.match(cache, /new fileIo\.AtomicFile\(path\)/);
assert.match(cache, /manifest cannot reference missing bytes/);
assert.match(cache, /writeAtomicBytes\(`\$\{directory\}\/manifest\.json`, manifestBytes, isCurrent\)/);
assert.match(
  cache,
  /performAtomicWrite[\s\S]*await fileIo\.open\([\s\S]*await fileIo\.write\([\s\S]*await fileIo\.fsync[\s\S]*await fileIo\.rename\(tmpPath, path\)[\s\S]*await fileIo\.unlink\(tmpPath\)/,
  'offline image writes must be asynchronous, durable, atomic, and clean partial temp files',
);
assert.match(cache, /inFlightWrites[\s\S]*writeLaneA[\s\S]*writeLaneB/,
  'ordinary background image persistence must be same-key coalesced and bounded to two lanes');
assert.match(cache, /bookMutationTails[\s\S]*enqueueBookMutation/,
  'clear/remove operations must serialize with background writes for one book');
assert.match(cache, /bookMutationKey\(sourceId: string, bookId: string\)[\s\S]*JSON\.stringify\(\[sourceId, bookId\]\)/,
  'per-book mutation keys must not collide when opaque IDs contain the delimiter');
assert.match(cache, /async storeResource[\s\S]*enqueueBookMutation/,
  'resource writes must enter the per-book mutation lane before filesystem I/O');
assert.match(cache, /async removeResource[\s\S]*enqueueBookMutation/,
  'resource removal must not race an in-flight prefetch write');
assert.match(cache, /async clearBook[\s\S]*enqueueBookMutation/,
  'book deletion must not be followed by a stale queued write');
assert.doesNotMatch(cache, /writeSync|openSync|renameSync/);
assert.doesNotMatch(cache, /pruneUnreferencedResources/,
  'publishing a manifest does not own reclamation of active or old-version resources');
assert.match(cache, /captureValidity[\s\S]*bookClearGenerations[\s\S]*finishPendingClear/);
assert.match(owner, /this\.state = 'closing';\s*ReadingBodyImageHost\.instance\.setMangaMetadataInspector\(undefined\);\s*this\.readingImageDiskCache\.close\(\)/);
assert.doesNotMatch(cache, /bodyBase64|PixelMap/,
  'persistent offline image storage must contain bounded bytes, not protocol Base64 or native handles');

assert.match(cache, /canonicalReadingImageBaseUrl\(identity\.baseUrl\)/,
  'offline disk keys must use the same fragment-free canonical base URL as live requests');

// Run the actual public Runtime entry points and their owned helpers. Optional
// persistence may retain a Promise for manga's allocation lane; the observable
// novel first-frame and explicit offline completion contracts remain distinct.
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function runtimeFixture(cachedBytes) {
  const events = [], failures = [], storage = deferred();
  const identity = { sourceId: 'source', bookId: 'book', chapterIndex: 3,
    contentVersion: 'version', imageUrl: 'https://images.example/page.jpg', baseUrl: 'https://book.example/chapter' };
  const networkBytes = new Uint8Array([1, 2, 3]);
  const payload = { fileUri: 'file://decoded-page', width: 120, height: 180 };
  const assertCurrent = current => assert.equal(current(), true);
  const Runtime = productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url),
    ['loadReadingImage', 'loadReadingImageOwned', 'prefetchReadingImage', 'prefetchReadingImageOwned',
      'prepareReadingImageBytes', 'assertReadingImageCurrent', 'admitReadingImage', 'releaseReadingImage'], {
      ReadingBodyImageHost: { instance: {
        async fetchRequestBytes(request, current) { assertCurrent(current); events.push('http'); return networkBytes; },
        async loadBytes(bytes, current) { assertCurrent(current); events.push('pixels'); assert.equal(bytes, cachedBytes ?? networkBytes); return payload; },
        async validateBytes(bytes, current) { assertCurrent(current); events.push('validate'); assert.equal(bytes, cachedBytes ?? networkBytes); },
        release() { assert.fail('a current admitted image must not be released'); },
      } },
      hilog: { error(...args) { failures.push(args.at(-1)); } }, LOG_DOMAIN: 0,
    });
  const runtime = new Runtime(); runtime.state = 'ready';
  runtime.runMangaImageWork = () => assert.fail('ordinary novel images must not enter the manga lane');
  runtime.readingImageCacheIdentity = (...args) => {
    assert.deepEqual(args, Object.values(identity)); return identity;
  };
  runtime.resolveReadingImageRequest = async (sourceId, imageUrl, baseUrl, current) => {
    assertCurrent(current); assert.deepEqual([sourceId, imageUrl, baseUrl], [identity.sourceId, identity.imageUrl, identity.baseUrl]);
    events.push('descriptor'); return { url: imageUrl };
  };
  runtime.readingImageDiskCache = {
    captureValidity(sourceId, bookId, current) {
      assert.deepEqual([sourceId, bookId], [identity.sourceId, identity.bookId]); return current;
    },
    async loadResource(actual, current) { assert.equal(actual, identity); assertCurrent(current); events.push('disk'); return cachedBytes; },
    async storeResource(actual, bytes, current) {
      assert.equal(actual, identity); assert.equal(bytes, networkBytes); assertCurrent(current);
      events.push('store-start'); await storage.promise; events.push('store-end');
    },
    async removeResource() { assert.fail('these valid/missing fixtures must not remove cached bytes'); },
  };
  return { events, failures, storage, payload,
    load: (allowNetwork = true) => runtime.loadReadingImage(...Object.values(identity), allowNetwork, () => true),
    prefetch: () => runtime.prefetchReadingImage(identity, () => true),
  };
}
{
  const f = runtimeFixture(); let displayed;
  const load = f.load().then(value => { displayed = value; return value; });
  await tick();
  assert.equal(displayed, f.payload, 'decoded first frame must settle while cache persistence is still blocked');
  assert.deepEqual(f.events, ['disk', 'descriptor', 'http', 'pixels', 'store-start']);
  f.storage.reject(new Error('optional cache storage failed'));
  await tick();
  assert.equal(await load, f.payload, 'later optional cache failure must not retract a successful first frame');
  assert.deepEqual(f.failures, ['optional cache storage failed'], 'optional write failure stays caught and observable');
}
{
  const f = runtimeFixture(new Uint8Array([9]));
  assert.equal(await f.load(false), f.payload);
  assert.deepEqual(f.events, ['disk', 'pixels'], 'cache-only hit uses exact stored bytes without source/HTTP/write work');
  const missing = runtimeFixture();
  await assert.rejects(missing.load(false), /REMOTE_READING_IMAGE_NOT_DOWNLOADED/);
  assert.deepEqual(missing.events, ['disk'], 'cache-only miss must reject before constructing any source or HTTP request');
}
{
  const f = runtimeFixture(); let completed = false;
  const prefetch = f.prefetch().then(() => { completed = true; });
  await tick();
  assert.deepEqual(f.events, ['disk', 'descriptor', 'http', 'validate', 'store-start']);
  assert.equal(completed, false, 'explicit offline prefetch must wait for durable image persistence');
  f.storage.resolve(); await prefetch;
  assert.equal(completed, true); assert.equal(f.events.at(-1), 'store-end');
  const failed = runtimeFixture();
  const rejection = assert.rejects(failed.prefetch(), /required offline storage failed/);
  await tick(); failed.storage.reject(new Error('required offline storage failed'));
  await rejection;
  assert.deepEqual(failed.failures, [], 'required offline failure propagates instead of being swallowed as optional maintenance');
}

console.log('reading offline image cache architecture and actual Runtime first-frame/cache-only/awaited-offline behavior: PASS');

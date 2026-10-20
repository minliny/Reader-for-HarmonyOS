import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
// The actual close helper drains dispatched download and storage ownership
// before shutting disk admission, then always closes Core/display resources.
function closeFixture() {
  const events=[],download=deferred(),mutation=deferred();
  const authority={instance:undefined};
  const Runtime=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),
    ['close','closeDownloadsAndRuntime','closeRuntime'],{
      ReaderRuntimeOwner:authority,
      ReadingBodyImageHost:{instance:{setMangaMetadataInspector(value){events.push(['inspector',value]);},releaseAllDisplayFiles(){events.push(['display-release']);}}},
      MangaChapterPreparationCoordinator:{forRuntime:()=>({close:async()=>{events.push(['chapter-close']);}})},
      hilog:{warn(){}},LOG_DOMAIN:0,errorMessageOf:error=>error.message,
    });
  const runtime=new Runtime();authority.instance=runtime;
  Object.assign(runtime,{state:'ready',predecessorClose:Promise.resolve(),sourceSupplyTask:Promise.resolve(),importFinalizeTask:Promise.resolve(),
    mangaImageTail:Promise.resolve(),flushTail:Promise.resolve(),preparationWakeTimer:-1,
    downloadCoordinator:{close:()=>{events.push(['download-close']);return download.promise;}},
    downloadStorageGateway:{waitForActiveMutation:()=>{events.push(['storage-drain']);return mutation.promise;}},
    readingImageDiskCache:{close(){events.push(['disk-close']);}},ttsHost:{close:async()=>{events.push(['tts-close']);}},
    host:{setResponseAssetBridge(value){events.push(['bridge',value]);}},
    runtime:{async request(method){assert.equal(method,'runtime.storage.flush');events.push(['core-flush']);},close(){events.push(['core-close']);}}});
  return{runtime,authority,events,download,mutation};
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
      'prepareReadingImageBytes', 'assertReadingImageCurrent', 'admitReadingImage', 'releaseReadingImage', 'captureReadingContentValidity'], {
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
    async loadResource(actual, current) { assert.deepEqual(actual, identity); assertCurrent(current); events.push('disk'); return cachedBytes; },
    async storeResource(actual, bytes, current) {
      assert.deepEqual(actual, identity); assert.equal(bytes, networkBytes); assertCurrent(current);
      events.push('store-start'); await storage.promise; events.push('store-end');
    },
    async removeResource() { assert.fail('these valid/missing fixtures must not remove cached bytes'); },
  };
  return { events, failures, storage, payload,
    load: (allowNetwork = true) => runtime.loadReadingImage(...Object.values(identity), allowNetwork, () => true),
    prefetch: () => runtime.prefetchReadingImage(identity, () => true),
  };
}

try{
if(id==='profile'){
const Paths=productionMotionMethods(new URL('../entry/src/main/ets/app/ReadingImageDiskCache.ts',import.meta.url),['manifestPath','mangaCacheProfile'],{MANGA_SCRIPT_CACHE_PROFILE:'script-bgra-v2'});
const paths=new Paths();
assert.equal(paths.manifestPath('/chapter',paths.mangaCacheProfile('identity-v1')),'/chapter/manifest.json');
assert.equal(paths.manifestPath('/chapter',paths.mangaCacheProfile('bytes-v1')),'/chapter/manifest-script-bgra-v2.json');
assert.throws(()=>paths.mangaCacheProfile('unknown'),/MANGA_CACHE_PROFILE_REQUIRED/);

}
if(id==='close-drain'){
for(const failure of [undefined,'download','storage']) {
  const f=closeFixture(),error=Error(`${failure} close failed`);
  const closing=f.runtime.close(),other=f.runtime.close();
  const observed=failure===undefined?Promise.all([closing,other]):
    Promise.all([assert.rejects(closing,value=>value===error),assert.rejects(other,value=>value===error)]);
  assert.equal(f.runtime.state,'closing','retire admission synchronously');
  assert.deepEqual(f.events[0],['inspector',undefined]);
  await tick();assert.ok(!f.events.some(event=>event[0]==='disk-close'),'live download owns its finite handoff');
  if(failure==='download')f.download.reject(error);else f.download.resolve();
  await tick();assert.ok(!f.events.some(event=>event[0]==='disk-close'),'live cleanup owns its physical file handoff');
  if(failure==='storage')f.mutation.reject(error);else f.mutation.resolve();
  await observed;
  assert.equal(f.events.filter(event=>event[0]==='disk-close').length,1);
  assert.equal(f.events.filter(event=>event[0]==='core-close').length,1,'concurrent close calls share one actual cleanup');
  assert.equal(f.events.filter(event=>event[0]==='display-release').length,1);
  assert.ok(f.events.findIndex(event=>event[0]==='disk-close')<f.events.findIndex(event=>event[0]==='core-flush'));
  assert.ok(f.events.findIndex(event=>event[0]==='core-close')<f.events.findIndex(event=>event[0]==='display-release'));
  assert.equal(f.runtime.state,'closed');assert.equal(f.authority.instance,undefined);
}
}
if(id==='first-frame'){
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
}
if(id==='cache-only'){
{
  const f = runtimeFixture(new Uint8Array([9]));
  assert.equal(await f.load(false), f.payload);
  assert.deepEqual(f.events, ['disk', 'pixels'], 'cache-only hit uses exact stored bytes without source/HTTP/write work');
  const missing = runtimeFixture();
  await assert.rejects(missing.load(false), /REMOTE_READING_IMAGE_NOT_DOWNLOADED/);
  assert.deepEqual(missing.events, ['disk'], 'cache-only miss must reject before constructing any source or HTTP request');
}
}
if(id==='offline-write'){
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
}
}finally{}
}
const definitions={"profile": "profile actual scoped owner/gateway/storage path; controlled Core/OS ports", "close-drain": "close-drain actual scoped owner/gateway/storage path; controlled Core/OS ports", "first-frame": "first-frame actual scoped owner/gateway/storage path; controlled Core/OS ports", "cache-only": "cache-only actual scoped owner/gateway/storage path; controlled Core/OS ports", "offline-write": "offline-write actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}

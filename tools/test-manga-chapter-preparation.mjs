import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
function load(name, dependencies = {}) {
  const source = readFileSync(new URL(`${name}.ts`, root), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '')
    .replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name.split('/').at(-1)};`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway');
function chapter(count = 75, index = 0) {
  const pages = Array.from({ length: count }, (_, ordinal) => {
    const pageId = `mp1:${String(ordinal).padStart(64, '0')}`;
    return { ordinal, pageId, resourceRef: `manga:${pageId}` };
  });
  return { manifest: { chapter: { sourceId: 's', bookId: 'b', chapterId: `/c${index}` },
    sourceRuleVersion: 'rules', manifestVersion: `v${index}`, decodeRevision: 'identity-v1', pages },
    chapterIndex: index, chapterTitle: `Chapter ${index}`, cached: true,
    resources: pages.map(page => ({ resourceRef: page.resourceRef,
      request: { url: `https://image.test/${page.ordinal}.jpg` } })) };
}
function window(data, start, limit) {
  const pages = data.manifest.pages.slice(start, start + limit);
  const references = new Set(pages.map(page => page.resourceRef));
  return { ...data, manifest: { ...data.manifest, pages },
    resources: data.resources.filter(resource => references.has(resource.resourceRef)),
    pageStart: start, totalPages: data.manifest.pages.length };
}

{
  const full = chapter();
  const requests = [], windows = [];
  const gateway = new MangaSessionGateway({ async request(method, params) {
    requests.push([method, params]);
    assert.equal(method, 'manga.pages.window', 'immutable windows do not fetch or reparse the source chapter');
    assert.equal(params.manifestVersion, full.manifest.manifestVersion);
    assert.ok(params.limit <= 32);
    return { data: window(full, params.start, params.limit) };
  } });
  const complete = await gateway.fullChapter(window(full, 32, 32), 75, () => true,
    value => windows.push(value.pageStart));
  assert.equal(complete.manifest.pages.length, 75);
  assert.equal(complete.resources.length, 75);
  assert.deepEqual(complete.manifest.pages.map(page => page.ordinal), Array.from({ length: 75 }, (_, index) => index));
  assert.deepEqual(windows, [0, 64]);
  assert.equal(requests.length, 2, 'the admitted immutable entry window is reused');
  requests.length = 0;
  await gateway.fullChapter(complete, 75, () => true);
  assert.equal(requests.length, 0, 'a full manifest never repeats metadata windows');
}
{
  const full = chapter();
  const gateway = new MangaSessionGateway({ async request(_method, params) {
    return { data: window(full, params.start, Math.max(1, params.limit - 1)) };
  } });
  await assert.rejects(gateway.fullChapter(window(full, 0, 32), 75, () => true), /MANGA_WINDOW_INCOMPLETE/);
}
{
  const full = chapter();
  let current = true;
  const gateway = new MangaSessionGateway({ async request(_method, params) {
    current = false;
    return { data: window(full, params.start, params.limit) };
  } });
  await assert.rejects(gateway.fullChapter(window(full, 0, 32), 75, () => current), /MANGA_SESSION_CANCELLED/);
}
{
  const full = chapter();
  const gateway = new MangaSessionGateway({ async request(_method, params) {
    const changed = window(full, params.start, params.limit);
    changed.manifest = { ...changed.manifest, manifestVersion: 'replaced' };
    return { data: changed };
  } });
  await assert.rejects(gateway.fullChapter(window(full, 0, 32), 75, () => true), /MANGA_WINDOW_IDENTITY_MISMATCH/);
}
console.log('PASS manga whole-chapter metadata: 75-page prepared entry pagination, exact identity, missing window rejection, cancellation and no redundant source RPC');

const MangaResourceGateway = load('MangaResourceGateway');
const Coordinator = load('MangaChapterPreparationCoordinator', { MangaSessionGateway, MangaResourceGateway });
const Controller = load('MangaSessionController', { MangaSessionGateway, MangaResourceGateway, MangaChapterPreparationCoordinator: Coordinator });
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate, message) {
  for (let count = 0; count < 100; count++) { if (predicate()) return; await tick(); }
  assert.ok(predicate(), message);
}
const chapterKey = data => JSON.stringify([data.manifest.chapter.sourceId, data.manifest.chapter.bookId, data.manifest.chapter.chapterId, data.manifest.manifestVersion]);
function resourceKey(identity) { return JSON.stringify([identity.sourceId, identity.bookId, identity.baseUrl ?? identity.chapterId, identity.contentVersion, identity.resourceRef]); }
function entry(full, start = 0, count = 32) {
  return { chapter: window(full, start, count), targetOrdinal: start,
    progress: { token: { epoch: 1, revision: 0 }, location: null }, recoveryRequired: false };
}
function fixture(chapters, options = {}) {
  const calls = [], pixels = [], prefetches = [], bytes = new Set(), corrupt = new Set(), processed = new Set(), host = new Set(), leases = new Map(), leaseClocks = new Map();
  let protections = [], network = 0, nextToken = 1, alive = true;
  const source = index => chapters.find(ch => ch.chapterIndex === index);
  const get = identity => chapters.find(ch => ch.manifest.chapter.chapterId === (identity.chapterId ?? identity.baseUrl) &&
    ((identity.contentVersion??identity.manifestVersion)===undefined || ch.manifest.manifestVersion===(identity.contentVersion??identity.manifestVersion)));
  const refIdentity = (ch, resourceRef) => ({ sourceId: ch.manifest.chapter.sourceId, bookId: ch.manifest.chapter.bookId,
    baseUrl: ch.manifest.chapter.chapterId, contentVersion: ch.manifest.manifestVersion, resourceRef });
  const rt = {
    supportsCoreCapability: () => true,
    captureReadingContentValidity: () => () => alive,
    allowOptionalMangaPreparation: () => options.optional ?? true,
    async requestBook(method, params, requestOptions, priority) { return this.request(method, params, requestOptions, priority); },
    async request(method, params = {}, _requestOptions, priority) {
      calls.push({ method, params: structuredClone(params), priority });
      await options.beforeRequest?.(method, params);
      if (method === 'manga.session.runtime') return { data: { runtimeEpoch: 41 } };
      if (method === 'manga.session.replace') {
        assert.equal(params.expectedRuntimeEpoch, 41); assert.ok(params.chapters.length <= 3);
        assert.equal(new Set(params.chapters.map(ch => JSON.stringify(ch))).size, params.chapters.length);
        protections = structuredClone(params.chapters);
        return { data: { protected: protections.length, runtimeEpoch: 41 } };
      }
      if (method === 'manga.session.release') {
        assert.equal(params.expectedRuntimeEpoch, 41); protections = [];
        return { data: { released: true } };
      }
      if (method === 'manga.pages.window') {
        const full = get(params); assert.equal(params.manifestVersion, full.manifest.manifestVersion);
        return { data: window(full, params.start, params.limit) };
      }
      if (method === 'manga.chapter.get') return { data: options.chapterResult?.(params)??source(params.chapterIndex) };
      if (method === 'reading.progress.get') return { data: options.getProgress?.()??options.progress??{ token: { epoch: 1, revision: 0 }, location: null } };
      if (method === 'reading.progress.update' && options.saveProgress!==undefined) return {data:options.saveProgress(params)};
      if (method === 'manga.cache.recordRead') {
        assert.ok(pixels.some(image => image.chapterId === params.chapter.chapterId), 'only actual displayed content may renew its read clock');
        return { data: { recorded: true } };
      }
      if (method === 'manga.cache.materialization.prepare') {
        const receipt = { token: `lease-${nextToken++}`, chapter: params.chapter, manifestVersion: params.manifestVersion, intent: params.intent };
        leases.set(receipt.token, receipt); leaseClocks.set(receipt.token, Date.now()); return { data: receipt };
      }
      if (method === 'manga.cache.materialization.complete') {
        const receipt = leases.get(params.token); assert.ok(receipt, 'current preparation lease');
        if (options.checkLeaseTime) assert.ok(Date.now() - leaseClocks.get(params.token) < 300000, 'Core completion requires a live five-minute lease');
        const full = get({...params.chapter,manifestVersion:params.manifestVersion});
        assert.deepEqual(params.resourceRefs, full.manifest.pages.map(page => page.resourceRef));
        assert.ok(host.has(chapterKey(full)), 'Host durable digest validation precedes Core complete receipt');
        leases.delete(params.token);
        return { data: { completed: true, manifestVersion: params.manifestVersion } };
      }
      if (method === 'manga.cache.materialization.abort') return { data: { aborted: leases.delete(params.token) } };
      throw Error(`Unexpected ${method}`);
    },
    async loadReadingImage(sourceId, bookId, chapterIndex, contentVersion, imageUrl, baseUrl, allowNetwork, current, resourceRef) {
      assert.ok(current());
      assert.ok(protections.some(ch => ch.chapterId === baseUrl), 'Core CAS protection must precede all visible byte loads');
      const identity = { sourceId, bookId, chapterIndex, contentVersion, imageUrl, baseUrl, resourceRef };
      const key = resourceKey(identity);
      if (!bytes.has(key)) { assert.ok(allowNetwork); network++; bytes.add(key); processed.add(key); }
      pixels.push({ chapterId: baseUrl, resourceRef });
      return { fileUri: `file://${baseUrl}/${resourceRef}`, width: 600, height: 800, revision: 'image' };
    },
    async prefetchReadingImage(identity, current, _sourceVersion, allowNetwork, priority) {
      assert.ok(current());
      const full = get(identity), ordinal = full.manifest.pages.find(page => page.resourceRef === identity.resourceRef).ordinal;
      prefetches.push({ chapterId: full.manifest.chapter.chapterId, ordinal, priority, allowNetwork });
      await options.beforePrefetch?.(full, ordinal, current);
      assert.ok(current(), 'cancelled optional work cannot publish bytes');
      const key = resourceKey(identity);
      if(corrupt.has(key)) {if(!allowNetwork)throw Error('MANGA_CACHE_RESOURCE_CORRUPT');bytes.delete(key);corrupt.delete(key);}
      if (!bytes.has(key)) { assert.ok(allowNetwork, 'local-only resources cannot silently force a source refresh'); network++; bytes.add(key); processed.add(key); }
    },
    async markOfflineImageChapterComplete(identity, resources, current) {
      assert.ok(current()); const full = get(identity);
      assert.equal(resources.length, full.manifest.pages.length);
      for (const resource of resources) assert.ok(bytes.has(resourceKey(resource)), `missing durable ${resource.resourceRef}`);
      host.add(chapterKey(full));
    },
    async isOfflineImageChapterComplete(identity) {
      const full=get(identity);
      return host.has(chapterKey(full)) && full.manifest.pages.every(page=>bytes.has(resourceKey(refIdentity(full,page.resourceRef))) && !corrupt.has(resourceKey(refIdentity(full,page.resourceRef))));
    },
    releaseReadingImage() {},
  };
  return { rt, calls, pixels, prefetches, bytes, corrupt, processed, leases, refIdentity,
    get network() { return network; }, get protections() { return protections; },
    clearContent() { alive = false; }, full: source };
}
function completed(f, ch, intent = 'cache') {
  return f.calls.some(call => call.method === 'manga.cache.materialization.complete' &&
    call.params.chapter.chapterId === ch.manifest.chapter.chapterId &&
    f.calls.find(prepare => prepare.method === 'manga.cache.materialization.prepare' &&
      prepare.params.chapter.chapterId === ch.manifest.chapter.chapterId && prepare.params.intent === intent));
}

{
  const a = chapter(75, 0), b = chapter(43, 1);
  let unblock, started;
  const blocked = new Promise(resolve => started = resolve);
  const hold = new Promise(resolve => unblock = resolve);
  const f = fixture([a, b], { beforePrefetch: async (ch, ordinal, current) => {
    if (ch.chapterIndex === 0 && ordinal === 5) { started(current); await hold; }
  } });
  const c = new Controller(f.rt);
  await c.openPrepared(entry(a));
  await blocked;
  assert.equal(c.visiblePages().find(page => page.ordinal === 0)?.status, 'ready', 'first region does not wait for entire chapter');
  assert.equal(completed(f, a), false);
  const readsBefore = f.calls.filter(call => call.method === 'manga.cache.recordRead').length;
  assert.ok(readsBefore > 0);
  await c.openPrepared(entry(b));
  assert.deepEqual(f.protections.map(ch => ch.chapterId), ['/c1', '/c0']);
  unblock();
  await until(() => completed(f, a) && completed(f, b), 'both the current and departed chapter complete');
  assert.equal(f.calls.filter(call => call.method === 'manga.cache.recordRead').length, readsBefore + 1,
    'whole-chapter background work does not renew either reading clock');
  const originalNetwork = f.network, originalProcessing = f.processed.size, originalPrefetch = f.prefetches.length;
  await c.openPrepared(entry(a));
  await tick();
  assert.equal(c.chapter.manifest.pages.length, 75, 'return to the chapter reuses the complete metadata owner');
  assert.equal(f.network, originalNetwork, 'A to B to A issues zero additional image network work');
  assert.equal(f.processed.size, originalProcessing, 'completed chapter processing is reused');
  assert.equal(f.prefetches.length, originalPrefetch, 'completed preparation is not restarted');
  assert.equal(f.calls.some(call => call.method.startsWith('cache.download.') || call.method === 'manga.retention.set'), false);
  c.close(); await Coordinator.forRuntime(f.rt).close();
  assert.deepEqual(f.protections, []); assert.equal(f.leases.size, 0);
}
console.log('PASS actual Controller + Coordinator: protected first screen, 75-page complete receipt, departed preparation, A→B→A zero extra network/process, background no TTL/queue mutation and final CAS release');

{
  const full = chapter(8, 2);
  let fail = true;
  const f = fixture([full], { beforePrefetch: async (_ch, ordinal) => {
    if (ordinal === 4 && fail) { fail = false; throw Error('one image failed'); }
  } });
  const owner = Coordinator.forRuntime(f.rt);
  await owner.activate(full, 8, () => true, true, () => true);
  owner.startCurrent(full);
  await until(() => f.calls.some(call => call.method === 'manga.cache.materialization.abort'), 'partial attempt abandons its GC lease');
  assert.equal(completed(f, full), false);
  const before = f.prefetches.map(value => value.ordinal);
  assert.deepEqual(before, [0, 1, 2, 3, 4, 5, 6, 7]);
  owner.startCurrent(full);
  await until(() => completed(f, full), 'retry completes');
  assert.deepEqual(f.prefetches.map(value => value.ordinal), [...before, 4], 'retry prepares only the single missing resource');
  assert.equal(f.calls.filter(call => call.method === 'manga.cache.recordRead').length, 0);
  await owner.close(); assert.equal(f.leases.size, 0);
}
console.log('PASS partial failure retains all successful resources, retries only missing page and aborts the temporary GC lease without touching bytes');

{
  const full = chapter(7, 3);
  const local = { ...full, resources: [] };
  const f = fixture([full]);
  for (const page of full.manifest.pages) f.bytes.add(resourceKey(f.refIdentity(full, page.resourceRef)));
  const owner = Coordinator.forRuntime(f.rt);
  await owner.activate(local, 7, () => true, false, () => true);
  owner.startCurrent(local);
  await until(() => completed(f, full), 'local-only full chapter certifies');
  assert.equal(f.network, 0); assert.ok(f.prefetches.every(value => value.allowNetwork === false));
  assert.equal(f.calls.some(call => call.method === 'manga.chapter.get'), false);
  await owner.close();
}
console.log('PASS cached manifest with no network descriptors uses durable local resources and never forces source refresh');

{
  const full=chapter(6,70),f=fixture([full]);
  const owner=Coordinator.forRuntime(f.rt);
  await owner.activate(full,6,()=>true,true,()=>true);owner.startCurrent(full);
  await until(()=>completed(f,full),'resident chapter initially completes');
  for(const [ordinal,damage] of [[2,'missing'],[4,'corrupt']]) {
    const key=resourceKey(f.refIdentity(full,full.manifest.pages[ordinal].resourceRef));
    if(damage==='missing')f.bytes.delete(key);else f.corrupt.add(key);f.processed.delete(key);
    const network=f.network,before=f.prefetches.length;
    await owner.prepareDownload(full,6,()=>true);
    assert.equal(f.network,network+1,'repair fetches only the missing durable resource');
    assert.deepEqual(f.prefetches.slice(before).filter(item=>item.allowNetwork).map(item=>item.ordinal),[ordinal]);
    assert.equal(f.leases.size,0,'repair settles its lease on every successful retry');
  }
  await owner.close();
}
console.log('PASS resident completed chapter recovers repeated local file loss through existing Host validation and refills only the missing resource');

{
 const full=chapter(5,71),local={...full,resources:[]},f=fixture([full]);
 for(const page of full.manifest.pages)f.bytes.add(resourceKey(f.refIdentity(full,page.resourceRef)));
 const owner=Coordinator.forRuntime(f.rt);await owner.activate(local,5,()=>true,false,()=>true);owner.startCurrent(local);
 await until(()=>completed(f,full),'local-only resident chapter completes');
 const missing=full.manifest.pages[3];f.bytes.delete(resourceKey(f.refIdentity(full,missing.resourceRef)));
 const before=f.prefetches.length;await owner.prepareDownload(local,5,()=>true);
 assert.equal(f.network,1);assert.deepEqual(f.prefetches.slice(before).filter(item=>item.allowNetwork).map(item=>item.ordinal),[3]);
 assert.equal(f.calls.some(call=>call.method==='manga.chapter.get'),false,'explicit refill uses Core resource identity without forcing a source chapter refresh');
 await owner.close();
}
console.log('PASS explicit download repairs a missing ref from a descriptor-free cached manifest while ordinary local-only work stays offline');

{
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const Decode=load('../../app/MangaImageDecodeHost');
 const Runtime=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),
  ['prefetchReadingImageOwned','prepareReadingImageBytes','mangaStorageChapter','assertReadingImageCurrent'],
  {MangaImageDecodeHost:Decode,ReadingBodyImageHost:{instance:{prepareMangaDisplay:()=>assert.fail('disabled source cannot decode newly fetched pixels')}}});
 let core=0,stores=0;
 const rt=Object.assign(new Runtime(),{state:'open',readingImageDiskCache:{loadResource:async()=>undefined,storeResource:async()=>stores++},
  async request(method,params){core++;assert.equal(method,'manga.resource.prepare');assert.equal(params.resourceRef,'manga:stable-ref');
   assert.deepEqual(params.chapter,{sourceId:'s',bookId:'b',chapterId:'/cached'});assert.equal(params.sourceRuleVersion,'rules');
   throw Error('manga.sourceDisabled');},
  prefetchReadingImage(identity,current,version,allowNetwork){return this.prefetchReadingImageOwned(identity,current,version,allowNetwork);}});
 const resources=new MangaResourceGateway(rt);
 await assert.rejects(resources.prefetchPage({sourceId:'s',bookId:'b',chapterIndex:0,chapterUrl:'/cached',contentVersion:'v',sourceRuleVersion:'rules',decodeRevision:'identity-v1'},
  {url:'manga:stable-ref',resourceRef:'manga:stable-ref'},()=>true,true,'download'),/manga.sourceDisabled/);
 assert.equal(core,1);assert.equal(stores,0);assert.equal(Decode.instance.transfers.size,0,'a refused Core descriptor also releases its transfer owner');
}
console.log('PASS actual ResourceGateway/Runtime/MangaImageDecodeHost explicit refill carries exact ref/version to Core; sourceDisabled refusal performs no fetch/decode/store');

{
  const full = chapter(6, 4);
  const f = fixture([full]);
  const owner = Coordinator.forRuntime(f.rt);
  await owner.prepareDownload(full, 6, () => true);
  assert.equal(f.network, 6); assert.ok(f.prefetches.every(value => value.priority === 'download'));
  assert.equal(f.calls.some(call => call.method.startsWith('manga.session.') || call.method === 'manga.cache.recordRead'), false);
  assert.equal(f.calls.some(call => call.method === 'cache.download.resume'), false);
  assert.equal(f.calls.filter(call => call.method === 'manga.cache.materialization.prepare').length, 1);
  assert.equal(f.calls.find(call => call.method === 'manga.cache.materialization.prepare').params.intent, 'download');
  assert.equal(f.leases.size, 0);
}
console.log('PASS explicit download consumes the original queue validity, shares durable bytes, uses download intent, and does not create a reading session or resume tasks');

{
  const full = chapter(9, 5);
  let unblock, started, running;
  const blocked = new Promise(resolve => started = resolve), hold = new Promise(resolve => unblock = resolve);
  const f = fixture([full], { beforePrefetch: async (_ch, ordinal, current) => {
    if (ordinal === 5) { running = current; started(); await hold; }
  } });
  const c = new Controller(f.rt); await c.openPrepared(entry(full)); await blocked;
  const owner = Coordinator.forRuntime(f.rt);
  let queueRunning = true;
  const download = owner.prepareDownload(full, 9, () => queueRunning);
  const cancelled = assert.rejects(download, /MANGA_SESSION_CANCELLED/);
  await until(() => f.calls.some(call => call.method === 'manga.cache.materialization.prepare' && call.params.intent === 'download'), 'download joins active preparation');
  queueRunning = false;
  assert.equal(running(), true, 'pausing explicit download cannot cancel the independent displayed chapter consumer');
  await Promise.race([cancelled, new Promise((_, reject) => setTimeout(() => reject(Error('paused download waits for unrelated live reader cache')), 500))]);
  assert.equal(running(), true, 'download consumer and receipt settle while the independent cache request remains held');
  unblock();
  await until(() => completed(f, full), 'independent cache consumer still completes');
  assert.ok(f.calls.some(call => call.method === 'manga.cache.materialization.abort' && call.params.token === 'lease-2'));
  assert.equal(f.calls.some(call => call.method === 'manga.cache.materialization.complete' && call.params.token === 'lease-2'), false);
  assert.equal(f.calls.some(call => call.method === 'cache.download.resume'), false);
  c.close(); await owner.close(); assert.equal(f.leases.size, 0);
}
console.log('PASS queue pause aborts only its download receipt while a live reader shares and completes the same chapter resources');

{
  const full = chapter(8, 6);
  let fail = true;
  const f = fixture([full], { beforePrefetch: async (_ch, ordinal) => {
    if (ordinal === 3 && fail) { fail = false; throw Error('cache attempt failed'); }
  } });
  const owner = Coordinator.forRuntime(f.rt);
  await owner.activate(full, 8, () => true, true, () => true); owner.startCurrent(full);
  await until(() => f.calls.some(call => call.method === 'manga.cache.materialization.abort'), 'cache failure settled');
  const before = f.prefetches.length, beforeNetwork=f.network;
  await owner.prepareDownload(full, 8, () => true);
  assert.deepEqual(f.prefetches.slice(before).filter(item=>item.allowNetwork).map(item => item.ordinal), [3], 'download recovers a failed cache attempt by filling only the missing resource');
  assert.equal(f.network,beforeNetwork+1,'existing successful pages are checked locally without network');
  assert.equal(f.leases.size, 0); await owner.close();
}
console.log('PASS a failed cache attempt does not poison a later explicit download sharing its successfully acquired pages');

{
  const chapters = Array.from({ length: 4 }, (_, index) => chapter(6, 10 + index));
  let unblock, started, currentCheck;
  const blocked = new Promise(resolve => started = resolve), hold = new Promise(resolve => unblock = resolve);
  const f = fixture(chapters, { beforePrefetch: async (ch, ordinal, current) => {
    if (ch.chapterIndex === 10 && ordinal === 2) { currentCheck = current; started(); await hold; }
  } });
  const c = new Controller(f.rt); await c.openPrepared(entry(chapters[0])); await blocked;
  for (const ch of chapters.slice(1)) await c.openPrepared(entry(ch));
  assert.deepEqual(f.protections.map(ch => ch.chapterId), ['/c13', '/c12', '/c11']);
  assert.equal(currentCheck(), false, 'fourth chapter retires work outside current + two recent chapter ownership');
  const before = f.bytes.size;
  c.close(); const closing = Coordinator.forRuntime(f.rt).close();
  unblock(); await closing;
  assert.ok(f.calls.some(call => call.method === 'manga.cache.materialization.abort' && call.params.token === 'lease-1'));
  assert.equal(f.leases.size, 0, 'final shutdown drains abandoned retired jobs as well as current jobs');
  assert.ok(f.bytes.size >= before, 'cancelled preparation never deletes already acquired bytes');
}
console.log('PASS current + two recent protection bound, retired task cancellation and final drain of all temporary GC leases');

{
  const full = chapter(8, 20);
  let unblock, started, running;
  const blocked = new Promise(resolve => started = resolve), hold = new Promise(resolve => unblock = resolve);
  const f = fixture([full], { beforePrefetch: async (_ch, ordinal, current) => {
    if (ordinal === 2) { running = current; started(); await hold; }
  } });
  // A downloaded first screen can be read with the explicit offline intent.
  for (const page of full.manifest.pages.slice(0, 2)) f.bytes.add(resourceKey(f.refIdentity(full, page.resourceRef)));
  const c = new Controller(f.rt); await c.openPrepared(entry(full), true); await blocked;
  let queueRunning = true;
  const owner = Coordinator.forRuntime(f.rt), download = owner.prepareDownload(full, 8, () => queueRunning);
  const cancelled = assert.rejects(download, /MANGA_SESSION_CANCELLED/);
  await until(() => f.calls.some(call => call.method === 'manga.cache.materialization.prepare' && call.params.intent === 'download'), 'download token exists');
  queueRunning = false; assert.equal(running(), true); unblock(); await cancelled;
  await until(() => f.calls.filter(call => call.method === 'manga.cache.materialization.abort').length >= 2, 'both incomplete receipts released');
  assert.equal(f.network, 0, 'a paused download cannot silently grant network access to offline reading cache work');
  assert.ok(f.prefetches.every(value => value.allowNetwork === false));
  c.close(); await owner.close();
}
console.log('PASS paused explicit download cannot broaden the independent offline reader network policy');

{
  const a = chapter(6, 30), b = chapter(6, 31);
  let optional = false, unblock, started, running;
  const blocked = new Promise(resolve => started = resolve), hold = new Promise(resolve => unblock = resolve);
  const f = fixture([a, b], { beforePrefetch: async (ch, ordinal, current) => {
    if (ch.chapterIndex === 30 && ordinal === 2) { running = current; started(); await hold; }
  } });
  f.rt.allowOptionalMangaPreparation = () => optional;
  const c = new Controller(f.rt); await c.openPrepared(entry(a)); await blocked;
  c.close('chapter'); assert.equal(running(), false, 'departed chapter becomes optional immediately');
  await c.openPrepared(entry(b)); unblock();
  await until(() => f.calls.some(call => call.method === 'manga.cache.materialization.abort' && call.params.token === 'lease-1'), 'metered optional cache attempt stops and releases lease');
  assert.equal(completed(f, a), false);
  optional = true; Coordinator.forRuntime(f.rt).networkChanged();
  await until(() => completed(f, a), 'existing unmetered network observer restarts eligible partial cache work');
  c.close(); await Coordinator.forRuntime(f.rt).close();
}
console.log('PASS optional network revocation pauses departed preparation and the existing network observer resumes only eligible cache consumers');


{
  const full = chapter(7, 40);
  let unavailable = false;
  const f = fixture([full], { beforeRequest: async method => {
    if (method === 'manga.pages.window' && unavailable) throw Error('immutable Core version unavailable');
  } });
  const c = new Controller(f.rt); await c.openPrepared(entry(full));
  await until(() => completed(f, full), 'initial chapter complete');
  const displayed = c.visiblePages().find(page => page.ordinal === 0).image;
  unavailable = true;
  await assert.rejects(c.refreshChapter(0), /immutable Core version unavailable/);
  assert.equal(c.visiblePages().find(page => page.ordinal === 0).image, displayed,
    'failed replacement CAS/version admission keeps the previous readable display lease');
  c.close(); await Coordinator.forRuntime(f.rt).close();
}
console.log('PASS failed Core version revalidation on refresh preserves the existing readable image');

// Production refresh must finish the entire cache receipt before publishing a
// successor, even when its first target image is already available.
{
 const old=chapter(7,80),next=structuredClone(old);next.manifest.manifestVersion='refresh-v2';
 next.manifest.pages=next.manifest.pages.map(page=>{const pageId=`mp1:${(8000+page.ordinal).toString(16).padStart(64,'0')}`;return {...page,pageId,resourceRef:`manga:${pageId}`};});
 next.resources=next.manifest.pages.map(page=>({resourceRef:page.resourceRef,request:{url:`https://refresh/${page.ordinal}`}}));
 const progress={token:{epoch:1,revision:5},location:{kind:'manga',chapter:old.manifest.chapter,manifestVersion:old.manifest.manifestVersion,
  pageId:old.manifest.pages[0].pageId,pageOrdinalFallback:0,x:0.2,y:0.7,progressRevision:5}};
 next.progressMapping={status:'exact',reason:'sourcePageIdentity',fromManifestVersion:old.manifest.manifestVersion,fromPageId:progress.location.pageId,
  progressRevision:5,targetPageId:next.manifest.pages[1].pageId,targetOrdinal:1};
 let fail=true,release,started;
 const gate=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve);
 const f=fixture([old,next],{progress,chapterResult:params=>params.policy==='refresh'?next:old,
  beforePrefetch:async(ch,ordinal)=>{if(ch.manifest.manifestVersion===next.manifest.manifestVersion && ordinal===6 && fail){started();await gate;throw Error('last successor image unavailable');}}});
 const releases=[];f.rt.releaseReadingImage=uri=>releases.push(uri);
 const c=new Controller(f.rt);await c.openPrepared({...entry(old),progress});await until(()=>completed(f,old),'old full chapter ready');
 const original=c.chapter,image=c.visiblePages().find(page=>page.ordinal===0).image;
 const refreshing=c.refreshChapter();const rejected=assert.rejects(refreshing,/last successor image unavailable/);
 await entered;assert.equal(c.chapter,original);assert.equal(c.visiblePages().find(page=>page.ordinal===0).image,image);
 assert.equal(releases.includes(image.fileUri),false,'while the new first image exists, missing final image cannot retire old pixels');
 release();await rejected;assert.equal(c.chapter,original);assert.deepEqual(c.savedLocation,progress.location);
 assert.equal([...f.leases.values()].filter(lease=>lease.manifestVersion===next.manifest.manifestVersion).length,0,'failed replacement revokes all of its temporary leases while the restored old reader may resume');
 assert.ok(f.calls.every(call=>!call.method.startsWith('cache.download.')&&call.method!=='manga.retention.set'),'ordinary refresh cannot become a permanent download');
 fail=false;await c.refreshChapter();
 assert.equal(c.chapter.manifest.manifestVersion,next.manifest.manifestVersion);
 assert.equal(c.displayedOrdinal,1);assert.equal(c.savedLocation.x,0.2);assert.equal(c.savedLocation.y,0.7);
 assert.ok(f.calls.some(call=>call.method==='manga.cache.materialization.complete'&&call.params.manifestVersion===next.manifest.manifestVersion),'complete cache receipt precedes published successor');
 assert.equal(f.network,14,'failed replacement resources are reused locally on retry');
 await c.close();assert.equal(f.leases.size,0);
}
console.log('PASS actual Controller ordinary refresh waits for full cache receipt, retains old chapter/image/xy on a late page failure and installs only after complete retry');

{
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const old=chapter(4,81),next=structuredClone(old);next.manifest.manifestVersion='unmapped-v2';
 next.manifest.pages=next.manifest.pages.map(page=>{const pageId=`mp1:${(9000+page.ordinal).toString(16).padStart(64,'0')}`;return {...page,pageId,resourceRef:`manga:${pageId}`};});
 next.resources=next.manifest.pages.map(page=>({resourceRef:page.resourceRef,request:{url:`https://unmapped/${page.ordinal}`}}));
 let progress={token:{epoch:4,revision:7},location:{kind:'manga',chapter:old.manifest.chapter,manifestVersion:old.manifest.manifestVersion,
  pageId:old.manifest.pages[2].pageId,pageOrdinalFallback:2,x:0.2,y:0.6,progressRevision:7}};
 next.progressMapping={status:'unresolved',reason:'ambiguousPageIdentity',fromManifestVersion:old.manifest.manifestVersion,fromPageId:progress.location.pageId,progressRevision:7};
 const f=fixture([old,next],{getProgress:()=>progress,chapterResult:params=>params.policy==='refresh'?next:old,
  saveProgress:params=>{assert.equal(params.expectedEpoch,4);assert.equal(params.expectedRevision,7);assert.equal(params.location.manifestVersion,'unmapped-v2');
   assert.equal(params.location.pageOrdinalFallback,0);progress={token:{epoch:4,revision:8},location:params.location};return progress;}});
 const c=new Controller(f.rt);await c.openPrepared({...entry(old),targetOrdinal:2,progress});await until(()=>completed(f,old),'prior chapter complete');
 const original=c.chapter;await c.refreshChapter();assert.equal(c.chapter,original);assert.equal(c.replacementRecoveryRequired,true);
 assert.equal(f.calls.some(call=>call.method==='reading.progress.update'),false);
 const phases=[];
 const Surface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),['confirmRecovery']);
 const surface=Object.assign(new Surface(),{controller:c,recovering:true,mounted:true,presentationGeneration:0,first:0,error:'',
  data:{totalCount:()=>1,getData:()=>({ordinal:2})},publish(){phases.push('published');assert.equal(c.chapter.manifest.manifestVersion,'unmapped-v2');},
  restore(...args){phases.push('restored');assert.deepEqual(args,[0,0,0]);},async saveVisible(){phases.push('save');await c.savePosition(0,0,0);}});
 await surface.confirmRecovery();
 assert.deepEqual(phases,['published','restored','save']);assert.equal(surface.recovering,false);assert.equal(c.replacementRecoveryRequired,false);
 assert.equal(progress.location.manifestVersion,'unmapped-v2');assert.equal(progress.token.revision,8);
 assert.ok(f.calls.some(call=>call.method==='manga.cache.materialization.complete'&&call.params.manifestVersion==='unmapped-v2'),'new chapter is completely cached before explicit new-page visibility save');
 await c.close();
}
console.log('PASS actual Surface recovery explicitly selects fully prepared new first page, publishes pixels and awaits CAS save without an old-index guess or permanent download');

for(const sameVersion of [false,true]) {
 const old=chapter(6,sameVersion?83:82),next=structuredClone(old);
 if(!sameVersion)next.manifest.manifestVersion='cancelled-refresh';
 const progress={token:{epoch:1,revision:5},location:{kind:'manga',chapter:old.manifest.chapter,manifestVersion:old.manifest.manifestVersion,
  pageId:old.manifest.pages[0].pageId,pageOrdinalFallback:0,x:0,y:0,progressRevision:5}};
 next.progressMapping={status:'exact',reason:'sourcePageIdentity',fromManifestVersion:old.manifest.manifestVersion,fromPageId:progress.location.pageId,
  progressRevision:5,targetPageId:next.manifest.pages[0].pageId,targetOrdinal:0};
 let release,started,block=false;
 const gate=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve);
 const f=fixture(sameVersion?[old]:[old,next],{progress,chapterResult:params=>params.policy==='refresh'?next:old,
  beforePrefetch:async(ch,ordinal)=>{if(block&&ch.manifest.manifestVersion===next.manifest.manifestVersion&&ordinal===4){started();await gate;}}});
 const c=new Controller(f.rt);await c.openPrepared({...entry(old),progress});await until(()=>completed(f,old),'old chapter completes');
 if(sameVersion)f.bytes.delete(resourceKey(f.refIdentity(old,old.manifest.pages[4].resourceRef)));
 block=true;const refreshing=c.refreshChapter();const rejected=assert.rejects(refreshing,/MANGA_SESSION_CANCELLED/);
 await entered;await c.selectPage(2);release();await rejected;
 const owner=Coordinator.forRuntime(f.rt);
 assert.equal(c.chapter.manifest.manifestVersion,old.manifest.manifestVersion);assert.equal(c.displayedOrdinal,2);
 assert.equal(owner.currentKey,chapterKey(old),'selection cancellation restores the still-visible old preparation owner');
 assert.equal(owner.states.get(chapterKey(old)).cacheRequested,true,'independent old reader whole-fill ownership remains requested');
 assert.equal(c.visiblePages().find(page=>page.ordinal===2)?.status,'ready');
 block=false;owner.networkChanged();await c.close();
}
console.log('PASS cancelled different/same-version refresh restores the still-visible old chapter owner and read preparation without reviving an exited session');

{
 const a=chapter(6,84),b=chapter(6,85);let fail=true;
 const f=fixture([a,b],{beforePrefetch:async(ch,ordinal)=>{if(ch===a&&ordinal===2&&fail)throw Object.assign(Error('MANGA_CACHE_STORAGE_FULL'),{code:'storage_full'});}});
 const c=new Controller(f.rt),events=[];c.onChange=()=>events.push(c.preparationError);
 await c.openPrepared(entry(a));await until(()=>c.preparationError==='MANGA_CHAPTER_CACHE_CAPACITY','capacity failure publishes the current chapter feedback');
 assert.equal(c.visiblePages().find(page=>page.ordinal===0)?.status,'ready');assert.equal(c.chapter.manifest.manifestVersion,a.manifest.manifestVersion);
 assert.deepEqual(f.prefetches.filter(item=>item.chapterId==='/c84').map(item=>item.ordinal),[0,1,2],'real capacity failure stops fill immediately and preserves acquired pages');
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const Surface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),['publish','displayChapterTitle','displayError']);
 const surface=Object.assign(new Surface(),{controller:c,mounted:true,opened:true,error:'',publishedManifestVersion:a.manifest.manifestVersion,layoutGeneration:0,viewportGeneration:0,
  mountedTurnRowKey:'',horizontal:false,rememberVisible(){},notifyPublishedRows(){},
  data:{projection:{publish:()=>false},totalCount:()=>0}});
 surface.publish();assert.equal(surface.error,'MANGA_CHAPTER_CACHE_CAPACITY');
 assert.equal(surface.displayError(surface.error),'整章加载已暂停，缓存空间不足，可清理缓存或下载保留。');
 assert.equal(surface.opened,true);assert.equal(c.visiblePages()[0].status,'ready','feedback does not replace the readable body');
 const first=events.filter(error=>error==='MANGA_CHAPTER_CACHE_CAPACITY').length;
 const owner=Coordinator.forRuntime(f.rt);owner.startCurrent(a);await tick();assert.equal(events.filter(error=>error==='MANGA_CHAPTER_CACHE_CAPACITY').length,first,'same failure does not repeatedly notify');
 await c.openPrepared(entry(b));await until(()=>completed(f,b),'new chapter completes');surface.publish();assert.equal(surface.error,'','old chapter capacity feedback does not follow the new view');
 await c.openPrepared(entry(a));fail=false;await c.refreshChapter(0);await until(()=>owner.states.get(chapterKey(a)).complete,'explicit retry after space recovery completes');
 assert.equal(c.preparationError,undefined);surface.publish();assert.equal(surface.error,'','complete retry clears only its preparation feedback');
 await c.close();
}
console.log('PASS actual current-only capacity feedback retains readable pixels, stops filling, deduplicates failure, fences chapter changes and clears on complete retry');

for(const intent of ['cache','download']) {
 const full=chapter(7,intent==='cache'?86:87);let foreground=true,release,started,once=true;
 const gate=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve);
 const f=fixture([full],{beforePrefetch:async(_ch,ordinal)=>{if(ordinal===2&&once){once=false;started();await gate;}}});
 f.rt.isMangaPreparationForeground=()=>foreground;const owner=Coordinator.forRuntime(f.rt);
 let work;if(intent==='cache'){await owner.activate(full,7,()=>true,true,()=>true);owner.startCurrent(full);}else work=owner.prepareDownload(full,7,()=>true);
 await entered;foreground=false;release();await tick();await tick();
 const pausedNetwork=f.network,pausedCalls=f.calls.length;await new Promise(resolve=>setTimeout(resolve,125));
 assert.equal(f.network,pausedNetwork,'background cannot issue the next image request');assert.equal(f.calls.length,pausedCalls,'background does not renew materialization tokens');
 foreground=true;owner.networkChanged();if(work!==undefined)await work;else await until(()=>completed(f,full),'foreground resumes cache fill');
 assert.equal(f.network,7);assert.equal(f.calls.some(call=>call.method==='cache.download.resume'),false,'foreground never resumes a paused Core task');
 await owner.close();
}
{
 const full=chapter(4,88),f=fixture([full]);f.rt.isMangaPreparationForeground=()=>false;
 const owner=Coordinator.forRuntime(f.rt);let current=true;
 const work=owner.prepareDownload(full,4,()=>current),cancelled=assert.rejects(work,/MANGA_SESSION_CANCELLED/);
 await tick();current=false;await Promise.race([cancelled,new Promise((_,reject)=>setTimeout(()=>reject(Error('cancelled background download did not drain')),500))]);
 assert.equal(f.network,0);assert.equal(f.calls.length,0);assert.equal(f.leases.size,0);await owner.close();
}
console.log('PASS foreground fence pauses automatic/current and explicit work without network/token renewal; wake resumes missing refs and background user cancellation drains promptly without queue resume');

{
  const full = chapter(3, 52); let attempts = 0;
  const f = fixture([full], { beforeRequest: async method => {
    if (method === 'manga.session.runtime' && ++attempts === 1) throw Error('temporary session runtime failure');
  } });
  const owner = Coordinator.forRuntime(f.rt);
  await assert.rejects(owner.activate(full, 3, () => true, true, () => true), /temporary session runtime failure/);
  assert.equal(f.protections.length, 0);
  await owner.activate(full, 3, () => true, true, () => true);
  assert.equal(attempts, 2, 'an explicit opening retry obtains the missing runtime epoch again');
  assert.equal(f.protections.length, 1);
  await owner.close(); assert.equal(f.protections.length, 0);
}
console.log('PASS failed session-runtime initialization remains retryable without closing/reopening the reader and never publishes an undefined epoch');

{
  const full = chapter(3, 50), f = fixture([full]);
  const owner = Coordinator.forRuntime(f.rt);
  const activation = owner.activate(full, 3, () => true, true, () => true);
  const rejected = assert.rejects(activation, /MANGA_SESSION_CANCELLED/);
  await owner.close(); await rejected;
  assert.equal(f.calls.length, 0, 'close fences an activation queued before the first session opens');
  await owner.activate(full, 3, () => true, true, () => true);
  assert.equal(f.protections.length, 1, 'a new explicit activation after close has a new admission');
  await owner.close(); assert.equal(f.protections.length, 0);
}
for (const method of ['manga.session.runtime', 'manga.session.replace', 'manga.pages.window']) {
  const full = chapter(3, 51);
  let unblock, started;
  const hold = new Promise(resolve => unblock = resolve), blocked = new Promise(resolve => started = resolve);
  const f = fixture([full], { beforeRequest: async name => {
    if (name === method) { started(); await hold; }
  } });
  const owner = Coordinator.forRuntime(f.rt);
  const activation = owner.activate(full, 3, () => true, true, () => true);
  const rejected = assert.rejects(activation, /MANGA_SESSION_CANCELLED/);
  await blocked; const closing = owner.close(); unblock();
  await Promise.all([rejected, closing]);
  assert.equal(f.protections.length, 0, `${method}: late Core response cannot retain a closed session`);
  owner.startCurrent(full); await tick();
  assert.equal(f.prefetches.length, 0, `${method}: late admission cannot restart chapter preparation`);
}
console.log('PASS close fences queued activation and late runtime/protection/window replies, drains old protection and admits only a new explicit session');

{
 const realNow=Date.now; let now=realNow(); Date.now=()=>now;
 try {
  for(const intent of ['cache','download']) {
   const full=chapter(7,intent==='cache'?60:61);
   const f=fixture([full], {checkLeaseTime:true, beforePrefetch:async()=>{now+=120000;}});
   const owner=Coordinator.forRuntime(f.rt);
   if(intent==='cache') {await owner.activate(full,7,()=>true,true,()=>true);owner.startCurrent(full);await until(()=>completed(f,full),'slow chapter completes with renewed lease');}
   else await owner.prepareDownload(full,7,()=>true);
   assert.ok(f.calls.filter(c=>c.method==='manga.cache.materialization.prepare').length>1,'long work renews finite Core protection without downloading acquired pages again');
   assert.equal(f.network,7);assert.equal(f.leases.size,0);
   assert.equal(f.calls.some(c=>c.method==='cache.download.resume'),false,'lease renewal never resumes a user-paused queue');
   await owner.close();
  }
 } finally {Date.now=realNow;}
}
console.log('PASS slow whole chapters renew bounded materialization protection; cache and explicit download complete after five minutes without extra image requests or queue resume');

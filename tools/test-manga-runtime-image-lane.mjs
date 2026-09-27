import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const manifest = {chapter:{sourceId:'s',bookId:'b',chapterId:'chapter'},sourceRuleVersion:'rules',manifestVersion:'v',decodeRevision:'bytes-v1',pages:[{ordinal:0,pageId:'page',resourceRef:'page'}]};
const file = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
const methods = ['loadReadingImage', 'loadReadingImageOwned', 'prefetchReadingImage',
  'prefetchReadingImageOwned', 'runMangaImageWork', 'prepareReadingImageBytes',
  'assertReadingImageCurrent', 'admitReadingImage', 'releaseReadingImage',
  'markOfflineImageChapterComplete', 'isOfflineImageChapterComplete'];
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const events = [], failures = [], released = [], stores = new Map(), fetches = new Map(), generations = new Map(), cached = new Map(), seals = new Map(), checks = new Map();
  let liveReads=0, maxReads=0;
  const key = identity => identity.bookId;
  const body = {
    async loadBytes(bytes,current,position) { if (!current()) throw Error('cancelled pixels'); events.push(['pixels',bytes[0],position]); return {fileUri:`file://page-${bytes[0]}`,width:20,height:30}; },
    async validateBytes(bytes,current,position) { if (!current()) throw Error('cancelled validation'); events.push(['validate',bytes[0],position]); },
    async fetchRequestBytes(request,current) { if(!current()) throw Error('cancelled fetch'); events.push(['novel-fetch',request.bookId]); return new Uint8Array([99]); },
    release(uri) { released.push(uri); }
  };
  const Owner = productionMotionMethods(file, methods, {
    ReadingBodyImageHost:{instance:body},
    MangaImageDecodeHost:{instance:{async prepare(params,request,current) {
      const bookId=params.chapter.bookId; events.push(['prepare',bookId]); liveReads++;maxReads=Math.max(maxReads,liveReads);
      try {
        await fetches.get(bookId)?.promise;
        if(!current()) throw Error('cancelled prepare');
        // Models the nested Host validation callback while the outer Runtime
        // job is live. It must not reenter the allocation queue.
        const bytes=new Uint8Array([Number(bookId.replace(/\D/g,''))||1]);
        await body.validateBytes(bytes,current,0);
        return bytes;
      } finally {liveReads--;}
    }}},
    hilog:{error(...args){failures.push(args.at(-1));}},LOG_DOMAIN:0
  });
  const owner = new Owner(); owner.state='ready';owner.mangaImageTail=Promise.resolve();owner.mangaImagePending=0;
  owner.readingImageCacheIdentity=(sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl)=>({sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl});
  owner.resolveReadingImageRequest=async(_sourceId,imageUrl)=>({bookId:imageUrl});
  owner.readingImageDiskCache={
    captureValidity(_sourceId,bookId,current) { const generation=generations.get(bookId)??0;return ()=>owner.state==='ready'&&(generations.get(bookId)??0)===generation&&current?.()!==false; },
    async loadResource(identity,current) { if(identity.resourceRef!==undefined)assert.equal(identity.mangaDecodeRevision,manifest.decodeRevision);assert.equal(current(),true);events.push(['read',key(identity)]);return cached.get(key(identity)); },
    async storeResource(identity,bytes,current) { events.push(['store-start',key(identity)]);await stores.get(key(identity))?.promise;if(!current())throw Error('stale store');events.push(['store-end',key(identity)]); },
    async removeResource(identity){events.push(['remove',key(identity)]);},
    async markChapterComplete(chapter,resources,current) { assert.equal(current(),true);events.push(['seal-start',key(chapter),resources[0]?.resourceRef]);await seals.get(key(chapter))?.promise;if(!current())throw Error('stale seal');events.push(['seal-end',key(chapter)]); },
    async isChapterComplete(chapter) { events.push(['check-start',key(chapter)]);await checks.get(key(chapter))?.promise;events.push(['check-end',key(chapter)]);return true; }
  };
  const load=(bookId,current=()=>true,allowNetwork=true)=>owner.loadReadingImage('s',bookId,0,'v','image','chapter',allowNetwork,current,'page',0,manifest.sourceRuleVersion,false,manifest.decodeRevision);
  const prefetch=(bookId,current=()=>true)=>owner.prefetchReadingImage({sourceId:'s',bookId,chapterIndex:0,contentVersion:'v',imageUrl:'image',baseUrl:'chapter',resourceRef:'page',mangaDecodeRevision:manifest.decodeRevision},current,'rules',true);
  return {owner,body,events,failures,released,stores,fetches,generations,cached,seals,checks,load,prefetch,maxReads:()=>maxReads};
}
// First-frame completion and owned byte drain are different promises. All manga
// paths wait before cache reads/HTTP, but a novel call retains existing behavior.
{
  const f=fixture();const firstStore=deferred(), unrelatedStore=deferred();f.stores.set('b1',firstStore);f.stores.set('novel',unrelatedStore);
  const first=await f.load('b1');assert.equal(first.fileUri,'file://page-1');assert.equal(f.owner.mangaImagePending,1);
  const second=f.load('b2'), offline=f.prefetch('b3');
  await tick();assert.deepEqual(f.events.filter(x=>x[0]==='read').map(x=>x[1]),['b1']);
  await f.owner.loadReadingImage('s','novel',0,'v','novel','chapter',true,()=>true);
  assert.ok(f.events.some(x=>x[0]==='novel-fetch'));assert.ok(!f.events.some(x=>x[0]==='read'&&x[1]==='b2'));
  firstStore.resolve();await Promise.all([second,offline]);await f.owner.mangaImageTail;
  assert.deepEqual(f.events.filter(x=>x[0]==='read').map(x=>x[1]),['b1','novel','b2','b3']);
  assert.equal(f.maxReads(),1);assert.equal(f.owner.mangaImagePending,0);
  assert.ok(!f.events.some(x=>x[0]==='store-end'&&x[1]==='novel'),'never wait unrelated cache write');
  unrelatedStore.resolve();await tick();
}
// Queued cancellation and book clear preserve captured generations and allocate
// no encoded bytes: no cache read, prepare or pixel validation for those jobs.
{
  const f=fixture(), gate=deferred();f.stores.set('b1',gate);await f.load('b1');
  let current=true;const cancelled=assert.rejects(f.load('b2',()=>current),/cancelled/);current=false;
  const cleared=assert.rejects(f.prefetch('b3'),/cancelled/);f.generations.set('b3',1);
  const successor=f.load('b4');await tick();assert.equal(f.events.filter(x=>x[0]==='read').length,1);
  gate.resolve();await Promise.all([cancelled,cleared,successor]);await f.owner.mangaImageTail;
  assert.deepEqual(f.events.filter(x=>x[0]==='read').map(x=>x[1]),['b1','b4']);assert.equal(f.owner.mangaImagePending,0);
}
// A queued caller cannot mutate the identity after generation capture and make
// the job read a different book under the original book's validity guard.
{
  const f=fixture(),gate=deferred();f.stores.set('b1',gate);await f.load('b1');
  const identity={sourceId:'s',bookId:'b2',chapterIndex:0,contentVersion:'v',imageUrl:'image',baseUrl:'chapter',resourceRef:'page',mangaDecodeRevision:manifest.decodeRevision};
  const queued=f.owner.prefetchReadingImage(identity,()=>true,'rules',true);
  identity.bookId='mutated';identity.resourceRef='other-page';gate.resolve();await queued;await f.owner.mangaImageTail;
  assert.deepEqual(f.events.filter(x=>x[0]==='read').map(x=>x[1]),['b1','b2']);
}
// Storage failure cannot turn the already published image into failure or poison
// the lane; it remains observable. Explicit offline writes keep awaited errors.
{
  const f=fixture(), gate=deferred();f.stores.set('b1',gate);assert.equal((await f.load('b1')).fileUri,'file://page-1');
  const next=f.load('b2');gate.reject(Error('disk full'));await next;await f.owner.mangaImageTail;
  assert.deepEqual(f.failures,['disk full']);assert.equal(f.owner.mangaImagePending,0);
  const failedStore=deferred();f.stores.set('b3',failedStore);const failed=assert.rejects(f.prefetch('b3'),/offline failed/);
  await tick();failedStore.reject(Error('offline failed'));await failed;await f.load('b4');await f.owner.mangaImageTail;
  assert.equal(f.owner.mangaImagePending,0);
}
// A stale running transfer never creates a late image. The next live transfer
// can start after the previous failure and all requests retain one lane.
{
  const f=fixture(), fetch=deferred();f.fetches.set('b1',fetch);let current=true;
  const failed=assert.rejects(f.load('b1',()=>current),/cancelled prepare/);await tick();const next=f.prefetch('b2');
  current=false;fetch.resolve();await Promise.all([failed,next]);await f.owner.mangaImageTail;
  assert.ok(!f.events.some(x=>x[0]==='pixels'&&x[1]===1));assert.equal(f.maxReads(),1);
}
// Cache-only direct reads share the same lane; teardown rejects a queued job
// before it touches disk or enters a callback on the closing runtime.
{
  const f=fixture(), gate=deferred();f.stores.set('b1',gate);await f.load('b1');f.cached.set('b2',new Uint8Array([2]));
  const offline= f.load('b2',()=>true,false);await tick();assert.ok(!f.events.some(x=>x[0]==='read'&&x[1]==='b2'));
  gate.resolve();await offline;await f.owner.mangaImageTail;assert.ok(!f.events.some(x=>x[0]==='prepare'&&x[1]==='b2'));
  const gate2=deferred();f.stores.set('b3',gate2);await f.load('b3');const closed=assert.rejects(f.load('b4'),/cancelled|teardown/);f.owner.state='closing';gate2.resolve();await closed;await f.owner.mangaImageTail;
  assert.ok(!f.events.some(x=>x[0]==='read'&&x[1]==='b4'));assert.equal(f.owner.mangaImagePending,0);
}
// Bounded descriptor-only queue. Cancellation checks happen at dispatch, so a
// capped burst neither fetches bytes nor leaves a permanently rejected tail.
{
  const f=fixture(), gate=deferred();f.stores.set('b1',gate);await f.load('b1');let current=true;
  const waiting=Array.from({length:15},(_,i)=>assert.rejects(f.prefetch(`q${i}`,()=>current),/cancelled/));
  await assert.rejects(f.prefetch('over-capacity'),/CAPACITY/);assert.equal(f.events.filter(x=>x[0]==='read').length,1);
  current=false;gate.resolve();await Promise.all(waiting);await f.owner.mangaImageTail;assert.equal(f.owner.mangaImagePending,0);await f.load('b2');await f.owner.mangaImageTail;
}
// Execute the actual gateway against the actual Runtime methods; removing the
// old outer region lock must not strand next-chapter prefetch behind itself.
{
  const source=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaResourceGateway.ts',import.meta.url),'utf8');
  const Gateway=new Function(`${stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''))};return MangaResourceGateway;`)();
  const f=fixture(), gateway=new Gateway(f.owner),scope={sourceId:'s',bookId:'b1',chapterIndex:0,contentVersion:'v',chapterUrl:'chapter',sourceRuleVersion:manifest.sourceRuleVersion,decodeRevision:manifest.decodeRevision},page={url:'image',resourceRef:'page'};
  const image=await gateway.loadPage(scope,page,true,()=>true,0);assert.ok(image.fileUri);
  await gateway.prefetchPage({...scope,bookId:'b2'},page,()=>true);await f.owner.mangaImageTail;assert.equal(f.maxReads(),1);
}
// Completion reads/hash operations own the same lane before book mutation locks.
// A blocked image write may publish first paint, but neither seal nor checksum
// can allocate another encoded image until that write has drained.
{
  const f=fixture(),gate=deferred();f.stores.set('b1',gate);await f.load('b1');
  const chapter={sourceId:'s',bookId:'b2',chapterIndex:0,contentVersion:'v',mangaDecodeRevision:manifest.decodeRevision};
  const resources=[{...chapter,imageUrl:'image',resourceRef:'page',mangaDecodeRevision:manifest.decodeRevision}];
  const seal=f.owner.markOfflineImageChapterComplete(chapter,resources,()=>true);
  const check=f.owner.isOfflineImageChapterComplete({...chapter,bookId:'b3'},true,()=>true);
  chapter.bookId='mutated';resources[0].resourceRef='mutated';await tick();
  assert.ok(!f.events.some(x=>x[0]==='seal-start'||x[0]==='check-start'),'completion reads wait for owned bytes');
  gate.resolve();await Promise.all([seal,check]);await f.owner.mangaImageTail;
  assert.deepEqual(f.events.filter(x=>x[0]==='seal-start'),[['seal-start','b2','page']]);
  assert.deepEqual(f.events.filter(x=>x[0]==='check-start'),[['check-start','b3']]);
}
// The reverse overlap is also prohibited; digest errors release the lane and
// same-book foreground work finishes without a book-lock/lane-lock inversion.
for(const operation of ['seal','check']) {
  const f=fixture(),gate=deferred(),chapter={sourceId:'s',bookId:'b1',chapterIndex:0,contentVersion:'v',mangaDecodeRevision:manifest.decodeRevision};
  f[operation==='seal'?'seals':'checks'].set('b1',gate);
  const start=operation==='seal'?f.owner.markOfflineImageChapterComplete(chapter,[{...chapter,imageUrl:'image',resourceRef:'page',mangaDecodeRevision:manifest.decodeRevision}]):f.owner.isOfflineImageChapterComplete(chapter,true);
  const failure=assert.rejects(start,/digest failed/);await tick();
  const same=f.load('b1'),other=f.prefetch('b2');await tick();assert.equal(f.events.filter(x=>x[0]==='read').length,0);
  gate.reject(Error('digest failed'));await Promise.all([failure,same,other]);await f.owner.mangaImageTail;
  assert.equal(f.owner.mangaImagePending,0);assert.deepEqual(f.events.filter(x=>x[0]==='read').map(x=>x[1]),['b1','b2']);
}
// Queued completion cannot survive cancellation, book clear, or teardown; no
// disk/hash operation occurs for its obsolete descriptor. Novel calls bypass.
{
  const f=fixture(),gate=deferred();f.stores.set('b1',gate);await f.load('b1');
  const chapter=bookId=>({sourceId:'s',bookId,chapterIndex:0,contentVersion:'v',...(bookId==='novel'?{}:{mangaDecodeRevision:manifest.decodeRevision})});let current=true;
  const seal=assert.rejects(f.owner.markOfflineImageChapterComplete(chapter('b2'),[{...chapter('b2'),imageUrl:'image',resourceRef:'page',mangaDecodeRevision:manifest.decodeRevision}],()=>current),/cancelled/);
  const check=assert.rejects(f.owner.isOfflineImageChapterComplete(chapter('b3'),true),/cancelled/);
  current=false;f.generations.set('b3',1);
  await f.owner.markOfflineImageChapterComplete(chapter('novel'),[{...chapter('novel'),imageUrl:'image'}]);
  assert.equal(await f.owner.isOfflineImageChapterComplete(chapter('novel')),true);
  gate.resolve();await Promise.all([seal,check]);await f.owner.mangaImageTail;
  assert.deepEqual(f.events.filter(x=>x[0]==='seal-start'||x[0]==='check-start').map(x=>x[1]),['novel','novel']);
  const gate2=deferred();f.stores.set('b4',gate2);await f.load('b4');
  const closing=assert.rejects(f.owner.isOfflineImageChapterComplete(chapter('b5'),true),/cancelled|teardown/);
  f.owner.state='closing';gate2.resolve();await closing;await f.owner.mangaImageTail;
  assert.ok(!f.events.some(x=>x[0]==='check-start'&&x[1]==='b5'));
}
console.log('PASS production manga Runtime lane: foreground/cache-only/adjacent/offline/seal/checksum serialization before I/O, nested validation, early first frame with owned store drain, unrelated novel writes, queue bounds, cancellation/generation/teardown fencing and failure recovery.');

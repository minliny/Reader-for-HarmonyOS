import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { MangaBookPresentation } from '../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
function load(name, dependencies = {}) {
  const source = readFileSync(new URL(`${name}.ts`, root), 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name};`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway');
const MangaResourceGateway = load('MangaResourceGateway');
const Controller = load('MangaSessionController', { MangaSessionGateway, MangaResourceGateway });
const chapter = { manifest: { chapter: {sourceId:'s', bookId:'b', chapterId:'/c'}, sourceRuleVersion:'r', manifestVersion:'v', decodeRevision:'identity-v1',
  pages: Array.from({length:8}, (_,ordinal) => { const pageId=`mp1:${String(ordinal).padStart(64,'0')}`; return {ordinal,pageId,resourceRef:`manga:${pageId}`}; }) }, chapterIndex:0,chapterTitle:'chapter',cached:false,resources:[] };
chapter.resources = chapter.manifest.pages.map(page => ({ resourceRef:page.resourceRef, request:{url:'https://test/repeated.jpg'} }));
let revision=0, saved=null, pendingImage=null;const loaded=[], released=[], calls=[];
const runtime={ supportsCoreCapability:()=>true,
  async request(method, params){calls.push([method,params]);
    if(method==='manga.chapter.get') return {data:structuredClone(chapter)};
    if(method==='reading.progress.get') return {data:{token:{epoch:1,revision},location:saved}};
    assert.equal(params.expectedRevision,revision); revision++; saved=params.location;
    return {data:{token:{epoch:1,revision},location:saved}};
  },
  async loadReadingImage(...args){loaded.push(args); if(pendingImage) await pendingImage;return {fileUri:`file://${loaded.length}`,width:600,height:800,revision:'pixels'};},
  releaseReadingImage(uri){released.push(uri);}
};
const controller=new Controller(runtime);
await controller.open('s','b',0);
assert.equal(controller.visiblePages().length,2);
assert.equal(loaded[0][8],chapter.manifest.pages[0].resourceRef);
assert.equal(loaded[0][10], chapter.manifest.sourceRuleVersion);
await controller.selectPage(4);
assert.equal(controller.visiblePages().length,3);assert.equal(released.length,2);
await Promise.all([controller.savePosition(4,0,0.2),controller.savePosition(4,0,0.5)]);
assert.equal(revision,2);assert.equal(saved.pageId,chapter.manifest.pages[4].pageId);
await assert.rejects(controller.savePosition(4,0,NaN),/PROGRESS_INVALID/);
controller.close();assert.equal(released.length,5);
let resolve;pendingImage=new Promise(r=>resolve=r);
const opening=controller.open('s','b',0);await new Promise(r=>setImmediate(r));controller.close();resolve();await assert.rejects(opening,/SESSION_CANCELLED/);
assert.equal(controller.visiblePages().length,0);assert.equal(released.length,6);
pendingImage=null;
saved={...saved,manifestVersion:'old'};
await controller.open('s','b',0);assert.equal(controller.recoveryRequired,true);
await assert.rejects(controller.savePosition(0,0,0),/RECOVERY_REQUIRED/);
await controller.selectPage(0);await controller.savePosition(0,0,0);
controller.close();
const offline=structuredClone(chapter);offline.cached=true;offline.resources=[];
const gateway=new MangaSessionGateway({...runtime,request:async()=>({data:offline})});
assert.equal((await gateway.chapter('s','b',0,'cacheOnly',()=>true)).cached,true);
offline.manifest.pages[1].pageId=offline.manifest.pages[0].pageId;
await assert.rejects(gateway.chapter('s','b',0,'cacheOnly',()=>true),/PAGE_IDENTITY_INVALID/);
console.log('PASS manga session: bounded window, stable resources, serialized CAS, invalid anchor, teardown, late release, explicit recovery, offline manifest, duplicate IDs');
// A replaced viewport must not resume inserting the old loop's later tiles.
saved=null;
const tileController=new Controller({...runtime,async loadReadingImage(...args){
  loaded.push(args);if(pendingImage) await pendingImage;
  return {fileUri:`file://tile-${loaded.length}`,width:600,height:800,intrinsicWidth:600,intrinsicHeight:3200,revision:'pixels'};
}});
await tileController.open('s','b',0);
pendingImage=new Promise(r=>resolve=r);
const oldWindow=tileController.setTileWindow([{ordinal:0,tileIndex:0},{ordinal:0,tileIndex:1}]);
await new Promise(r=>setImmediate(r));
const newWindow=tileController.setTileWindow([{ordinal:0,tileIndex:3}]);
resolve();await Promise.all([oldWindow,newWindow]);pendingImage=null;
assert.equal(tileController.tile(0,0),undefined);assert.equal(tileController.tile(0,1),undefined);
assert.ok(tileController.tile(0,3).image);
await assert.rejects(tileController.savePosition(0,0,0.1),/POSITION_NOT_VISIBLE/);
await tileController.savePosition(0,0,0.8);
tileController.close();
console.log('PASS replaced tile windows discard old queued work; only decoded visible regions can save progress');
// First presentation uses its header/region lease before optional neighbor IO.
let finishNeighbor;const neighborWait=new Promise(r=>finishNeighbor=r);let firstCalls=0;
const firstFrame=new Controller({...runtime,
  async request(method){return {data:method==='manga.chapter.get'?structuredClone(chapter):{token:{epoch:1,revision:0},location:null}};},
  async loadReadingImage(){firstCalls++;if(firstCalls>1)await neighborWait;return {fileUri:`file://first-${firstCalls}`,width:600,height:800,intrinsicWidth:600,intrinsicHeight:1600,revision:'pixels'};}
});
let deadline;
await Promise.race([firstFrame.open('s','b',0),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('first frame waited for neighbor')),1000);})]);
clearTimeout(deadline);
await firstFrame.setTileWindow([{ordinal:0,tileIndex:0}]);assert.ok(firstFrame.tile(0,0).image);
assert.ok(firstCalls<=2,'first region is promoted, not decoded again');firstFrame.close();finishNeighbor();
// A failed explicit refresh preserves the old view and never guesses a new anchor.
const refreshFailure=new Controller({...runtime,async request(method,params){
  if(method==='manga.chapter.get'&&params.policy==='refresh')throw new Error('source denied');
  return {data:method==='manga.chapter.get'?structuredClone(chapter):{token:{epoch:1,revision:0},location:null}};
}});
await refreshFailure.open('s','b',0);const originalChapter=refreshFailure.chapter;
await assert.rejects(refreshFailure.refreshChapter(),/source denied/);assert.equal(refreshFailure.chapter,originalChapter);
refreshFailure.close();
console.log('PASS first frame admits before neighbor and reuses first-region lease; failed explicit refresh retains old view');
// Metadata admission alone cannot discard a usable view or its saved anchor.
for (const scenario of ['image-failure', 'unresolved']) {
 const old=structuredClone(chapter),next=structuredClone(chapter);
 next.manifest.manifestVersion='replacement';
 next.manifest.pages=next.manifest.pages.map(page=>{const pageId=`mp1:${(3000+page.ordinal).toString(16).padStart(64,'0')}`;return {...page,pageId,resourceRef:`manga:${pageId}`};});
 next.resources=next.manifest.pages.map(page=>({resourceRef:page.resourceRef,request:{url:`https://replacement/${page.ordinal}`}}));
 const durable={kind:'manga',chapter:old.manifest.chapter,manifestVersion:'v',pageId:old.manifest.pages[0].pageId,pageOrdinalFallback:0,x:0.2,y:0.6,progressRevision:3};
 next.progressMapping=scenario==='image-failure'?{status:'exact',reason:'equivalentRequest',fromManifestVersion:'v',fromPageId:durable.pageId,progressRevision:3,targetPageId:next.manifest.pages[1].pageId,targetOrdinal:1}:{status:'unresolved',reason:'ambiguousPageIdentity',fromManifestVersion:'v',fromPageId:durable.pageId,progressRevision:3};
 const releases=[],replacementLoads=[];
 const c=new Controller({supportsCoreCapability:()=>true,async request(method,params){
  if(method==='manga.chapter.get')return {data:structuredClone(params.policy==='refresh'?next:old)};
  assert.equal(method,'reading.progress.get');return {data:{token:{epoch:8,revision:3},location:structuredClone(durable)}};
 },async loadReadingImage(...args){
  if(args[3]==='replacement'){replacementLoads.push(args);throw Error('replacement bytes unavailable');}
  return {fileUri:`file://old-${args[8]}`,width:600,height:800,revision:'old-pixels'};
 },releaseReadingImage:uri=>releases.push(uri)});
 await c.open('s','b',0);await new Promise(resolve=>setImmediate(resolve));
 const original=c.chapter,location=c.savedLocation,image=c.visiblePages().find(page=>page.ordinal===0).image;
 if(scenario==='image-failure')await assert.rejects(c.refreshChapter(),/replacement bytes unavailable/);
 else await c.refreshChapter();
 assert.equal(c.chapter,original,`${scenario}: the old immutable chapter remains admitted`);
 assert.deepEqual(c.savedLocation,location);assert.equal(c.visiblePages().find(page=>page.ordinal===0).image,image);
 assert.equal(releases.includes(image.fileUri),false,'a failed replacement keeps the old display lease');
 if(scenario==='unresolved'){assert.equal(c.recoveryRequired,true);assert.equal(replacementLoads.length,0,'an unproven page cannot be silently shown at the old ordinal');}
 await c.close();
}
console.log('PASS atomic refresh rejects failed replacement pixels and preserves old chapter/location/lease; unresolved mappings retain old view and require recovery');
// Selecting an in-flight neighbor joins that exact image attempt. A second
// viewport pass can then publish geometry and the visible-region receipt.
let releasePendingNeighbor;
const pendingNeighbor=new Promise(resolve=>releasePendingNeighbor=resolve);
let neighborEntered;
const enteredNeighbor=new Promise(resolve=>neighborEntered=resolve);
let decodeCalls=0;
const joining=new Controller({...runtime,
  async request(method){return {data:method==='manga.chapter.get'?structuredClone(chapter):{token:{epoch:1,revision:0},location:null}};},
  async loadReadingImage(...args){
    decodeCalls++;
    if(args[8]===chapter.manifest.pages[1].resourceRef){neighborEntered();await pendingNeighbor;}
    return {fileUri:`file://join-${decodeCalls}`,width:600,height:800,intrinsicWidth:600,intrinsicHeight:1600,revision:'pixels'};
  }
});
await joining.open('s','b',0);await enteredNeighbor;
let selectionDone=false;
const selection=joining.setVisible(1).then(()=>{selectionDone=true;});
await new Promise(resolve=>setImmediate(resolve));assert.equal(selectionDone,false);
releasePendingNeighbor();await selection;
assert.equal(joining.visiblePages().find(page=>page.ordinal===1).status,'ready');
await joining.setTileWindow([{ordinal:1,tileIndex:0}]);assert.ok(joining.tile(1,0).image);
joining.close();
console.log('PASS pending neighbor selection joins decode and admits a visible tile without a second scroll');
// A cold entry carries three actual facts, never a serialized 10,000-page manifest.
{
 const total=10000; const fact=ordinal=>{const pageId=`mp1:${String(ordinal).padStart(64,'0')}`;return {ordinal,pageId,resourceRef:`manga:${pageId}`};};
 const window=(start,limit)=>({...structuredClone(chapter),pageStart:start,totalPages:total,cached:true,
  manifest:{...structuredClone(chapter.manifest),pages:Array.from({length:Math.min(limit,total-start)},(_,i)=>fact(start+i))},resources:[]});
 const entry={chapter:window(4999,3),targetOrdinal:5000,recoveryRequired:false,progress:{token:{epoch:4,revision:0},location:null}};
 const methods=[];let delayedWindow;
 const rt={supportsCoreCapability:()=>true,request:async(method,params)=>{
  methods.push([method,params]);if(method==='manga.entry.get') return {data:{entry}};
  if(method==='manga.pages.window'){if(delayedWindow)await delayedWindow;return {data:window(params.start,params.limit)};}
  throw Error(`unexpected ${method}`);
 },loadReadingImage:async()=>({fileUri:'file://region',width:600,height:800,revision:'r'}),releaseReadingImage:()=>{}};
 const gateway=new MangaSessionGateway(rt);const prepared=await gateway.entry('s','b',undefined,()=>true);
 const c=new Controller(rt);await c.openPrepared(prepared,true);
 assert.equal(c.totalPages,total);assert.equal(c.chapter.manifest.pages.length,3);assert.equal(c.pageAt(5000).ordinal,5000);
 assert.equal(methods.length,1,'entry-window starts without full chapter, progress or catalog request');
 await c.setVisible(9999);assert.equal(methods.at(-1)[0],'manga.pages.window');assert.equal(methods.at(-1)[1].limit,2);
 assert.equal(c.pageAt(9999).ordinal,9999);assert.equal(c.pageAt(0),undefined);
 let finish;delayedWindow=new Promise(r=>finish=r);const stale=c.setVisible(3);await new Promise(r=>setImmediate(r));
 c.close();finish();await assert.rejects(stale,/SESSION_CANCELLED/);assert.equal(c.totalPages,0);assert.equal(c.pageAt(3),undefined);
 const invalid=structuredClone(entry);invalid.chapter.manifest.pages[0].ordinal=0;
 await assert.rejects(new MangaSessionGateway({...rt,request:async()=>({data:{entry:invalid}})}).entry('s','b',undefined,()=>true),/PAGE_IDENTITY_INVALID/);
}
console.log('PASS narrow cold entry: 3 of 10000 real page facts, no full manifest/catalog/progress RPC, bounded end window, invalid ordinal and disposed request rejected');
// Disposal releases pixels immediately but does not cancel an admitted position.
{
 let finish,fail;const gate=new Promise((resolve,reject)=>{finish=resolve;fail=reject;});let writes=0;let reads=0;let released=0;
 const rt={supportsCoreCapability:()=>true,captureReadingContentValidity:()=>()=>true,request:async(method,params)=>{
  if(method==='manga.chapter.get')return {data:structuredClone(chapter)};
  if(method==='reading.progress.get'){reads++;return {data:{token:{epoch:7,revision:writes},location:null}};}
  await gate;writes++;return {data:{token:{epoch:7,revision:writes},location:params.location}};
 },loadReadingImage:async()=>({fileUri:'file://r',width:600,height:800,revision:'r'}),releaseReadingImage:()=>released++};
 const first=new Controller(rt);await first.open('s','b',0);const saving=first.savePosition(0,0.2,0.7);first.close();
 assert.ok(released>0,'dispose immediately releases display leases');
 const next=new Controller(rt);const reopening=next.open('s','b',0);await new Promise(r=>setImmediate(r));assert.equal(reads,1,'rapid reopen waits for old owner CAS');
 finish();await saving;await reopening;assert.equal(reads,2);assert.equal(writes,1);next.close();
 const broken={...rt,request:async(method,params)=>{if(method==='reading.progress.update')throw Error('durable write failed');return rt.request(method,params);}};
 const c=new Controller(broken);await c.open('s','b',0);const bad=c.savePosition(0,0,0.1);c.close();await assert.rejects(bad,/durable write failed/);
 await assert.rejects(new Controller(broken).awaitPendingProgress('s','b'),/durable write failed/,'reopen observes prior failure');
}
console.log('PASS nonblocking disposal: pixel leases released immediately, admitted CAS survives owner close, rapid reopen waits, failed tail stays observable');
// The actual surface opens narrow pixels before starting the slow wide catalog.
{
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const phases=[];let finishCatalog;
 const catalog=new Promise(resolve=>finishCatalog=resolve);
 const prepared={chapter:{...structuredClone(chapter),pageStart:0,totalPages:8,
  manifest:{...structuredClone(chapter.manifest),pages:structuredClone(chapter.manifest.pages.slice(0,3))},resources:structuredClone(chapter.resources.slice(0,3))},
  targetOrdinal:0,recoveryRequired:false,progress:{token:{epoch:1,revision:0},location:null}};
 const rt={supportsCoreCapability:()=>true,request:async(method)=>{assert.equal(method,'manga.entry.get');phases.push('entry');return {data:{entry:prepared}};},
  loadReadingImage:async()=>{phases.push('pixels');return {fileUri:'file://entry',width:600,height:800,revision:'r'};},releaseReadingImage:()=>{},
  bookAcquisitions:()=>({acquireBook:()=>{phases.push('catalog-start');return catalog;}})};
 const ControllerSurface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),['open','acquireCatalog','effectiveFit','configureAdjacentChapter'],{MangaSessionGateway, MangaBookPresentation, AppStorage:{setOrCreate(){}}});
 const controller=new Controller(rt);
 const surface=Object.assign(new ControllerSurface(),{mounted:true,controller,runtime:rt,sourceId:'s',bookId:'b',offline:false,
  remoteBookSeed:{},opened:false,publish:()=>phases.push('published'),restore:()=>phases.push('restored'),onRemoteSessionReady:()=>phases.push('catalog-ready')});
 await surface.open(controller);assert.equal(surface.opened,true);assert.ok(phases.indexOf('published')<phases.indexOf('catalog-start'));assert.equal(phases.includes('catalog-ready'),false);
 surface.mounted=false;controller.close();finishCatalog({});await new Promise(r=>setImmediate(r));assert.equal(phases.includes('catalog-ready'),false);
}
console.log('PASS actual surface first admits narrow pixels, then starts catalog; stale catalog cannot publish after disposal');

// A removed saved chapter must not silently become chapter zero on cold resume.
{
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const old={kind:'manga',chapter:{sourceId:'s',bookId:'b',chapterId:'/deleted-from-catalog'},manifestVersion:'old-manifest',
  pageId:chapter.manifest.pages[2].pageId,pageOrdinalFallback:2,x:0.25,y:0.75,progressRevision:4};
 let persisted=structuredClone(old),writes=0;
 const rt={supportsCoreCapability:()=>true,request:async(method,params)=>{
  if(method==='manga.entry.get')return {data:{entry:null}};
  if(method==='manga.chapter.get')return {data:structuredClone(chapter)};
  if(method==='reading.progress.get')return {data:{token:{epoch:12,revision:persisted.progressRevision},location:structuredClone(persisted)}};
  assert.equal(method,'reading.progress.update');assert.equal(params.expectedRevision,persisted.progressRevision);
  writes++;persisted=structuredClone(params.location);return {data:{token:{epoch:12,revision:persisted.progressRevision},location:structuredClone(persisted)}};
 },loadReadingImage:async()=>({fileUri:'file://resume',width:600,height:800,revision:'r'}),releaseReadingImage:()=>{}};
 const Surface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),['open','acquireCatalog','effectiveFit','configureAdjacentChapter'],{MangaSessionGateway, MangaBookPresentation, AppStorage:{setOrCreate(){}}});
 const c=new Controller(rt);
 const surface=Object.assign(new Surface(),{mounted:true,controller:c,runtime:rt,sourceId:'s',bookId:'b',offline:false,
  remoteSession:{identity:{sourceId:'s',bookId:'b'},contentKind:'manga',entries:[{index:0,url:'/c'}]},
  publish:()=>{},restore:()=>{},updateViewport:()=>{},onRemoteSessionReady:()=>{}});
 await surface.open(c);assert.equal(surface.opened,true);assert.equal(surface.recovering,true);assert.equal(c.recoveryRequired,true);
 await assert.rejects(c.savePosition(0,0,0),/RECOVERY_REQUIRED/);assert.equal(writes,0);assert.deepEqual(persisted,old);
 await c.refreshChapter();assert.equal(c.recoveryRequired,true,'refreshing fallback pixels is not recovery consent');
 await assert.rejects(c.savePosition(0,0,0),/RECOVERY_REQUIRED/);assert.deepEqual(persisted,old);
 await c.selectPage(0);await c.savePosition(0,0,0.1);assert.equal(writes,1);assert.equal(persisted.chapter.chapterId,'/c');assert.equal(persisted.progressRevision,5);
 c.close();persisted=structuredClone(old);
 const explicit=new Controller(rt);surface.controller=explicit;surface.chapterIndex=0;
 await surface.open(explicit);assert.equal(explicit.recoveryRequired,false,'explicit directory/adjacent chapter navigation remains authorized');
 await explicit.savePosition(0,0,0.2);assert.equal(writes,2);explicit.close();
}
console.log('PASS removed-chapter cold resume retains old CAS position, rejects automatic/refresh save until confirmation, and preserves explicit chapter navigation');

// Production gateway/controller entry must accept the implemented byte revision.
{
 const bytes=structuredClone(chapter); bytes.manifest.decodeRevision='bytes-v1';
 const r={...runtime,request:async method=>({data:method==='manga.chapter.get'?bytes:{token:{epoch:7,revision:0},location:null}})};
 const c=new Controller(r); await c.open('s','b',0); assert.equal(c.visiblePages()[0].status,'ready'); c.close();
 bytes.manifest.decodeRevision='future-unknown'; await assert.rejects(c.open('s','b',0),/MANIFEST_INVALID/);
}
// Refresh restores a uniquely proven page after insertion; the durable CAS and
// both original-image coordinates remain unchanged until real visibility saves.
{
 const old=structuredClone(chapter); const next=structuredClone(chapter); next.manifest.manifestVersion='next';
 next.manifest.pages=Array.from({length:9},(_,ordinal)=>{const pageId=`mp1:${(100+ordinal).toString(16).padStart(64,'0')}`;return {ordinal,pageId,resourceRef:`manga:${pageId}`};});
 next.resources=next.manifest.pages.map(page=>({resourceRef:page.resourceRef,request:{url:`https://manga/${page.ordinal}`}}));
 let durable={kind:'manga',chapter:old.manifest.chapter,manifestVersion:'v',pageId:old.manifest.pages[4].pageId,pageOrdinalFallback:4,x:0.28,y:0.67,progressRevision:9};
 next.progressMapping={status:'exact',reason:'equivalentRequest',fromManifestVersion:'v',fromPageId:durable.pageId,progressRevision:9,targetPageId:next.manifest.pages[5].pageId,targetOrdinal:5};
 let refreshed=false,writes=0; const expected=[];
 const r={...runtime,async request(method,params){
   if(method==='manga.chapter.get'){if(params.policy==='refresh')refreshed=true;return {data:structuredClone(refreshed?next:old)};}
   if(method==='reading.progress.get')return {data:{token:{epoch:7,revision:durable.progressRevision},location:structuredClone(durable)}};
   assert.equal(method,'reading.progress.update'); expected.push([params.expectedEpoch,params.expectedRevision]); writes++; durable=params.location;return {data:{token:{epoch:7,revision:durable.progressRevision},location:durable}};
 }};
 const c=new Controller(r);await c.open('s','b',0);await c.refreshChapter();
 assert.equal(c.recoveryRequired,false);assert.equal(c.savedLocation.pageOrdinalFallback,5);assert.equal(c.savedLocation.x,0.28);assert.equal(c.savedLocation.y,0.67);assert.equal(durable.manifestVersion,'v');assert.equal(writes,0);
 assert.equal(c.visiblePages().find(page=>page.ordinal===5)?.status,'ready');
 await c.savePosition(5,0.28,0.67);assert.deepEqual(expected,[[7,9]]);assert.equal(durable.manifestVersion,'next');assert.equal(durable.progressRevision,10);c.close();
 // Unresolved duplicate identity still requires confirmation, and stale proofs
 // cannot replace a newer progress snapshot.
 durable={...durable,manifestVersion:'v',pageId:old.manifest.pages[4].pageId,pageOrdinalFallback:4,progressRevision:11};
 next.progressMapping={...next.progressMapping,progressRevision:9};
 const stale=new Controller(r);await stale.open('s','b',0);assert.equal(stale.recoveryRequired,true);await assert.rejects(stale.savePosition(0,0,0),/RECOVERY_REQUIRED/);stale.close();
 next.progressMapping={status:'unresolved',reason:'ambiguousPageIdentity',fromManifestVersion:'v',fromPageId:durable.pageId,progressRevision:11};
 const ambiguous=new Controller(r);await ambiguous.open('s','b',0);assert.equal(ambiguous.recoveryRequired,true);ambiguous.close();
}
// Only a visible, explicitly expired resource performs one bounded refresh.
for (const error of ['READING_IMAGE_SIGNATURE_EXPIRED','READING_IMAGE_AUTH_REQUIRED','READING_IMAGE_ACCESS_DENIED']) {
 let refreshes=0;
 const r={...runtime,async request(method,params){
   if(method==='manga.chapter.get'){if(params.policy==='refresh')refreshes++;return {data:structuredClone(chapter)};}
   return {data:{token:{epoch:9,revision:0},location:null}};
 },async loadReadingImage(){throw new Error(error);}};
 const c=new Controller(r);await c.open('s','b',0);assert.equal(refreshes,error==='READING_IMAGE_SIGNATURE_EXPIRED'?1:0);assert.equal(c.visiblePages()[0].status,'failed');c.close();
}
console.log('PASS byte-decode entry, exact refreshed global page and xy/CAS, stale/ambiguous proof fencing, visible-only bounded expiration recovery');

// Contain uses one bounded preview per logical image, never 100 visible crop leases.
{
 const imageCalls=[],leaseReleases=[];let progressWrites=0;
 const rt={supportsCoreCapability:()=>true,request:async(method,params)=>{
  if(method==='manga.chapter.get')return {data:structuredClone(chapter)};
  if(method==='reading.progress.get')return {data:{token:{epoch:1,revision:0},location:null}};
  progressWrites++;return {data:{token:{epoch:1,revision:1},location:params.location}};
 },loadReadingImage:async(...args)=>{imageCalls.push(args);return {fileUri:`file://preview-${imageCalls.length}`,width:args[11]?20:1000,height:args[11]?2000:1000,intrinsicWidth:1000,intrinsicHeight:100000,revision:'pixels'};},releaseReadingImage:uri=>leaseReleases.push(uri)};
 const c=new Controller(rt);await c.setPreviewMode(true);await c.open('s','b',0);
 assert.equal(c.pageGeometry(0).tileHeight,100000);assert.ok(imageCalls.length<=2);assert.equal(imageCalls[0][11],true);
 await c.setTileWindow([{ordinal:0,tileIndex:0}]);assert.ok(c.tile(0,0).image);await c.savePosition(0,0.1,0.75);assert.equal(progressWrites,1);
 const previousProgress=c.savedLocation;await c.setPreviewMode(false,0);
 assert.equal(c.pageGeometry(0).tileHeight,1000);assert.equal(imageCalls.at(-1)[11],false);assert.deepEqual(c.savedLocation,previousProgress,'fit changes preserve normalized location and CAS');
 await c.setTileWindow([{ordinal:0,tileIndex:75}]);assert.equal(imageCalls.at(-1)[9],0.75);assert.equal(imageCalls.at(-1)[11],false);
 assert.ok(leaseReleases.length>0);c.close();
}
console.log('PASS contain preview controller uses one image row, bounds neighbors, forwards preview mode, keeps original geometry/CAS and restores full-resolution region when width mode returns');

// A failed newly selected page is an unsaved viewport intent, not permission to
// navigate back to the old durable progress when a signed request expires.
for (const mappingStatus of ['exact','unresolved']) {
 const old=structuredClone(chapter);const fresh=structuredClone(chapter);fresh.manifest.manifestVersion='signed-next';
 fresh.manifest.pages=fresh.manifest.pages.map(page=>{const pageId=`mp1:${(1000+page.ordinal).toString(16).padStart(64,'0')}`;return {...page,pageId,resourceRef:`manga:${pageId}`};});
 fresh.resources=fresh.manifest.pages.map(page=>({resourceRef:page.resourceRef,request:{url:`https://signed/${page.ordinal}`}}));
 const durable={kind:'manga',chapter:old.manifest.chapter,manifestVersion:'v',pageId:old.manifest.pages[1].pageId,pageOrdinalFallback:1,x:0.23,y:0.78,progressRevision:4};
 fresh.progressMapping={status:'exact',reason:'equivalentRequest',fromManifestVersion:'v',fromPageId:durable.pageId,progressRevision:4,targetPageId:fresh.manifest.pages[2].pageId,targetOrdinal:2};
 fresh.anchorMapping={status:mappingStatus,reason:mappingStatus==='exact'?'sourcePageIdentity':'ambiguousPageIdentity',fromManifestVersion:'v',fromPageId:old.manifest.pages[5].pageId,...(mappingStatus==='exact'?{targetPageId:fresh.manifest.pages[6].pageId,targetOrdinal:6}:{})};
 let refreshes=0,writes=0,refreshed=false;
 const r={...runtime,async request(method,params){
  if(method==='manga.chapter.get'){if(params.policy==='refresh'){assert.deepEqual(params.anchor,{pageId:old.manifest.pages[5].pageId,ordinal:5});refreshes++;refreshed=true;}return {data:structuredClone(refreshed?fresh:old)};}
  if(method==='reading.progress.get')return {data:{token:{epoch:5,revision:4},location:structuredClone(durable)}};
  writes++;throw new Error('unexpected progress write');
 },async loadReadingImage(...args){if(!refreshed&&args[8]===old.manifest.pages[5].resourceRef)throw new Error('READING_IMAGE_SIGNATURE_EXPIRED');return {fileUri:'file://signed',width:600,height:800,revision:'pixels'};}};
 const c=new Controller(r);await c.open('s','b',0);await c.selectPage(5);
 const target=mappingStatus==='exact'?6:5;assert.equal(c.visiblePages().find(page=>page.ordinal===target)?.status,mappingStatus==='exact'?'ready':'failed');
 assert.equal(c.chapter.manifest.manifestVersion,mappingStatus==='exact'?'signed-next':'v','ambiguous refresh preserves the original manifest instead of guessing a new ordinal');
 assert.equal(c.recoveryRequired,mappingStatus!=='exact');assert.equal(refreshes,1);assert.equal(writes,0);assert.equal(durable.pageOrdinalFallback,1);
 if(mappingStatus==='exact'){assert.equal(c.savedLocation.pageOrdinalFallback,6);assert.equal(c.savedLocation.x,0);assert.equal(c.savedLocation.y,0);}
 else await assert.rejects(c.savePosition(target,0,0),/POSITION_NOT_VISIBLE/,'the retained failed old page cannot save guessed replacement progress');
 // Execute the actual ArkUI publication method after the internal recovery.
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const Surface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),['publish','requestedLast','displayChapterTitle']);
 const Projection=load('MangaStripProjection');const projection=new Projection();
 projection.publish(old.manifest,()=>({width:600,height:800,tileHeight:800}),5);
 const restored=[];const surface=Object.assign(new Surface(),{controller:c,mounted:true,opened:true,horizontal:true,horizontalPage:5,publishedManifestVersion:'v',layoutGeneration:0,viewportGeneration:0,first:0,last:0,
  visibleAnchor:{ordinal:5,x:0.9,y:0.9},data:{projection,totalCount:()=>projection.totalCount(),getData:index=>projection.row(index),notify:()=>{}},rememberVisible:()=>{assert.equal(mappingStatus,'unresolved','old viewport geometry cannot anchor a new manifest');},restore:(...args)=>restored.push(args)});
 surface.publish();assert.equal(surface.horizontalPage,target);assert.equal(projection.row(0).ordinal,target);assert.deepEqual(restored,mappingStatus==='exact'?[[target,0,0]]:[]);assert.equal(surface.recovering,mappingStatus!=='exact');
 if(mappingStatus!=='exact') {
  await c.confirmReplacement();
  assert.equal(c.chapter.manifest.manifestVersion,'signed-next');assert.equal(c.displayedOrdinal,0);assert.equal(c.recoveryRequired,false);
  assert.equal(c.visiblePages().find(page=>page.ordinal===0)?.status,'ready');assert.equal(writes,0,'explicit recovery still leaves CAS to actual visibility');
 }
 c.close();
}
{
 let refreshes=0;const c=new Controller({...runtime,async request(method,params){if(method==='manga.chapter.get'){if(params.policy==='refresh')refreshes++;return {data:structuredClone(chapter)};}return {data:{token:{epoch:1,revision:0},location:null}};},async loadReadingImage(){throw new Error('arbitrary text READING_IMAGE_SIGNATURE_EXPIRED is not a status');}});
 await c.open('s','b',0);assert.equal(refreshes,0);c.close();
}
console.log('PASS automatic refresh maps unsaved selected page rather than old durable anchor; ambiguous proof retains confirmation and exact status prevents text-triggered retries');
// A refresh response for a page left by the user cannot navigate their newer
// selection, even when the runtime transport completes after cancellation.
for (const leave of ['select','close']) {
 let releaseRefresh;let beganRefresh;const started=new Promise(resolve=>beganRefresh=resolve);
 const r={...runtime,async request(method,params){
  if(method==='manga.chapter.get'){if(params.policy==='refresh'){beganRefresh();await new Promise(resolve=>releaseRefresh=resolve);}return {data:structuredClone(chapter)};}
  return {data:{token:{epoch:3,revision:0},location:null}};
 },async loadReadingImage(...args){if(args[8]===chapter.manifest.pages[5].resourceRef)throw new Error('READING_IMAGE_SIGNATURE_EXPIRED');return {fileUri:'file://fenced',width:600,height:800,revision:'pixels'};}};
 const c=new Controller(r);await c.open('s','b',0);const old=c.selectPage(5);await started;
 if(leave==='select')await c.selectPage(1);else c.close();releaseRefresh();await assert.rejects(old,/SESSION_CANCELLED/);
 if(leave==='select'){assert.equal(c.displayedOrdinal,1);assert.equal(c.visiblePages().find(page=>page.ordinal===1)?.status,'ready');c.close();}else assert.equal(c.chapter,undefined);
}
console.log('PASS automatic refresh updates actual horizontal surface with current anchor and is fenced by a later selection or close');

// Next-chapter preparation shares canonical Core facts and the Host byte cache.
// Only its manifest is prepared early; at the final two pages just its first
// original image is persisted. A new controller consumes the normal entry path.
{
 const next=structuredClone(chapter);next.chapterIndex=42;next.chapterTitle='Next';next.manifest.chapter.chapterId='/next';next.manifest.manifestVersion='next-v';
 next.manifest.pages=next.manifest.pages.map(page=>{const pageId=`mp1:${(2000+page.ordinal).toString(16).padStart(64,'0')}`;return {...page,pageId,resourceRef:`manga:${pageId}`};});
 next.resources=next.manifest.pages.map(page=>({resourceRef:page.resourceRef,request:{url:`https://next/${page.ordinal}`}}));
 const prepared=new Set(),cache=new Set(),events=[];let nextHttp=0,nextFirstNetwork=0;
 const rt={...runtime,captureReadingContentValidity:()=>()=>true,async request(method,params){events.push(method);
  if(method==='manga.chapter.get'){const value=params.chapterIndex===42?next:chapter;if(params.chapterIndex===42&&!prepared.has(42)){nextHttp++;prepared.add(42);}return {data:{...structuredClone(value),cached:prepared.has(params.chapterIndex)}};}
  if(method==='reading.progress.get')return {data:{token:{epoch:20,revision:0},location:null}};
  if(method==='manga.entry.get'){assert.ok(prepared.has(42));return {data:{entry:{chapter:{...structuredClone(next),cached:true,pageStart:0,totalPages:8,manifest:{...structuredClone(next.manifest),pages:structuredClone(next.manifest.pages.slice(0,3))},resources:structuredClone(next.resources.slice(0,3))},targetOrdinal:0,recoveryRequired:false,progress:{token:{epoch:20,revision:0},location:null}}}};}
  throw Error('optional preparation cannot write progress, shelf or download state');
 },async loadReadingImage(...args){if(args[8]===next.manifest.pages[0].resourceRef&&!cache.has(args[8]))nextFirstNetwork++;return {fileUri:`file://${args[8]}`,width:600,height:800,revision:'pixels'};},
 async prefetchReadingImage(identity,current,version,allowNetwork){assert.equal(version,'r');assert.equal(allowNetwork,true);assert.equal(current(),true);assert.equal(identity.chapterIndex,42);assert.equal(identity.resourceRef,next.manifest.pages[0].resourceRef);events.push('prefetch-first');cache.add(identity.resourceRef);}};
 const c=new Controller(rt);await c.open('s','b',0);await new Promise(r=>setImmediate(r));
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const Surface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),['configureAdjacentChapter']);
 const surface=Object.assign(new Surface(),{runtime:rt,offline:false});
 surface.configureAdjacentChapter({contentKind:'manga',sourceVersion:'r',acquisitionMode:'online',identity:{sourceId:'s',bookId:'b'},entries:[{index:0,url:'/c'},{index:20,url:'/group',navigable:false},{index:42,url:'/next'}]},c);
 await new Promise(r=>setImmediate(r));assert.equal(nextHttp,1);assert.equal(cache.size,0,'opening a chapter must not download the next first image');
 await c.selectPage(6);await new Promise(r=>setImmediate(r));assert.equal(cache.size,1);assert.equal(events.filter(e=>e==='prefetch-first').length,1);
 await c.selectPage(7);await new Promise(r=>setImmediate(r));assert.equal(events.filter(e=>e==='prefetch-first').length,1);
 c.close();const entry=await new MangaSessionGateway(rt).entry('s','b',42,()=>true);const following=new Controller(rt);await following.openPrepared(entry);assert.equal(nextHttp,1);assert.equal(nextFirstNetwork,0);assert.equal(following.visiblePages()[0].status,'ready');following.close();
 assert.equal(events.some(method=>method==='reading.progress.update'||method.startsWith('bookshelf.')||method==='cache.book.prefetch'),false);
}
// Failed optional manifests/images and offline/source changes cannot poison the
// currently visible chapter or cause recurring retries as it scrolls.
for(const scenario of ['manifest-failure','image-failure','offline','source-change']){
 const next=structuredClone(chapter);next.chapterIndex=42;next.manifest.chapter.chapterId='/next';next.manifest.manifestVersion='next';if(scenario==='source-change')next.manifest.sourceRuleVersion='new-source';
 let requests=0,images=0;
 const rt={...runtime,async request(method,params){if(method==='manga.chapter.get'){if(params.chapterIndex===42){requests++;if(scenario==='manifest-failure')throw Error('next unavailable');return {data:next};}return {data:structuredClone(chapter)};}return {data:{token:{epoch:21,revision:0},location:null}};},
 async prefetchReadingImage(){images++;throw Error('next image unavailable');}};
 const c=new Controller(rt);await c.open('s','b',0,scenario==='offline');c.configureNextChapter(42,'/next');await new Promise(r=>setImmediate(r));await c.selectPage(7);await new Promise(r=>setImmediate(r));await c.setVisible(7);await new Promise(r=>setImmediate(r));
 assert.equal(requests,scenario==='offline'?0:1);assert.equal(images,scenario==='image-failure'?1:0);assert.equal(c.visiblePages().find(page=>page.ordinal===7)?.status,'ready');c.close();
}
// Cancel a pending optional image before a new foreground window uses its lane.
{
 const next=structuredClone(chapter);next.chapterIndex=42;next.manifest.chapter.chapterId='/next';next.manifest.manifestVersion='next';
 let release,started;const start=new Promise(resolve=>started=resolve);let currentCheck,commits=0;
 const rt={...runtime,async request(method,params){if(method==='manga.chapter.get')return {data:structuredClone(params.chapterIndex===42?next:chapter)};return {data:{token:{epoch:22,revision:0},location:null}};},
 async prefetchReadingImage(_identity,current){currentCheck=current;started();await new Promise(resolve=>release=resolve);if(!current())throw Error('optional cancelled');commits++;}};
 const c=new Controller(rt);await c.open('s','b',0);c.configureNextChapter(42,'/next');await c.selectPage(7);await start;
 const foreground=c.selectPage(3);assert.equal(currentCheck(),false,'new foreground request revokes optional work before waiting for region lane');release();await foreground;
 assert.equal(commits,0);assert.equal(c.visiblePages().find(page=>page.ordinal===3)?.status,'ready');c.close();
}
console.log('PASS next chapter: canonical nonconsecutive catalog identity, early manifest, near-end first image only, shared-cache next entry, no user-data writes, silent bounded failures/offline/source fences and visible-image priority');
// A delayed manifest cannot start image IO after closing. A content-clear fence
// is captured at admission, never recaptured later to revive optional fetching.
for(const scenario of ['close','clear']){
 const next=structuredClone(chapter);next.chapterIndex=42;next.manifest.chapter.chapterId='/next';next.manifest.manifestVersion='next';
 let alive=true,images=0,release,started;const start=new Promise(resolve=>started=resolve);
 const rt={...runtime,captureReadingContentValidity:()=>{const admitted=alive;return ()=>admitted&&alive;},async request(method,params){
  if(method==='manga.chapter.get'){if(params.chapterIndex===42){started();if(scenario==='close')await new Promise(resolve=>release=resolve);return {data:next};}return {data:structuredClone(chapter)};}return {data:{token:{epoch:23,revision:0},location:null}};
 },async prefetchReadingImage(){images++;}};
 const c=new Controller(rt);await c.open('s','b',0);c.configureNextChapter(42,'/next');await start;
 if(scenario==='close'){c.close();release();}else {await new Promise(r=>setImmediate(r));alive=false;await c.selectPage(7);}
 await new Promise(r=>setImmediate(r));assert.equal(images,0);c.close();
}
console.log('PASS optional adjacent work cannot survive session close or recapture a cleared content scope');

// Directory v2 proof crosses the production Surface, Gateway and Controller in
// both cached and network entry paths. Core refusal cannot admit image pixels.
{
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const Surface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),['open','acquireCatalog','effectiveFit','configureAdjacentChapter'],{MangaSessionGateway, MangaBookPresentation, AppStorage:{setOrCreate(){}}});
 const proof={sourceId:'s',bookId:'b',chapterIndex:0,url:'/c',nodeId:'node-0',catalogRevision:'catalog',structureRevision:'tree',rulesVersion:'rules'};
 for(const mode of ['cached','network','stale-proof']) {
  const requests=[];let pixels=0;
  const rt={supportsCoreCapability:()=>true,async request(method,params){requests.push([method,params]);
   if(method==='manga.entry.get') {
    assert.deepEqual(params.directoryTargetProof,proof);
    if(mode==='stale-proof')throw Error('directory target proof changed');
    return {data:{entry:mode==='network'?null:{chapter:{...structuredClone(chapter),cached:true,totalPages:8,pageStart:0},targetOrdinal:0,recoveryRequired:false,progress:{token:{epoch:91,revision:0},location:null}}}};
   }
   if(method==='manga.chapter.get'){assert.deepEqual(params.directoryTargetProof,proof);return {data:structuredClone(chapter)};}
   assert.equal(method,'reading.progress.get');return {data:{token:{epoch:91,revision:0},location:null}};
  },async loadReadingImage(){pixels++;return {fileUri:'file://proof',width:600,height:800,revision:'pixels'};},releaseReadingImage(){}};
  const controller=new Controller(rt);const surface=Object.assign(new Surface(),{mounted:true,controller,runtime:rt,sourceId:'s',bookId:'b',chapterIndex:0,directoryTargetProof:proof,offline:false,
   publish(){},restore(){},updateViewport(){},onRemoteSessionReady(){}});
  await surface.open(controller);
  if(mode==='stale-proof'){assert.equal(surface.opened,undefined);assert.equal(pixels,0);assert.match(surface.error,/proof changed/);}
  else {assert.equal(surface.opened,true);assert.ok(pixels>0);}
  assert.equal(requests.some(([method])=>method==='reading.progress.update'||method==='chapter.content'||method.startsWith('bookshelf.')),false);
  assert.equal(requests.some(([method])=>method==='manga.chapter.get'),mode==='network');
  controller.close();
 }
 // Historical, implicit cached entry keeps exact image/CAS without adding an
 // explicit directory proof. The group never becomes a fresh chapter pick.
 const saved={kind:'manga',chapter:chapter.manifest.chapter,manifestVersion:'v',pageId:chapter.manifest.pages[3].pageId,pageOrdinalFallback:3,x:.24,y:.68,progressRevision:9};
 const rt={supportsCoreCapability:()=>true,async request(method,params){assert.equal(method,'manga.entry.get');assert.equal(params.chapterIndex,undefined);assert.equal(params.directoryTargetProof,undefined);
  return {data:{entry:{chapter:{...structuredClone(chapter),cached:true,totalPages:8,pageStart:0},targetOrdinal:3,recoveryRequired:false,progress:{token:{epoch:92,revision:9},location:structuredClone(saved)}}}};
 },async loadReadingImage(){return {fileUri:'file://historical',width:600,height:800,revision:'pixels'};},releaseReadingImage(){}};
 const controller=new Controller(rt),restored=[];
 const surface=Object.assign(new Surface(),{mounted:true,controller,runtime:rt,sourceId:'s',bookId:'b',offline:true,
  remoteSession:{contentKind:'manga',identity:{sourceId:'s',bookId:'b'},entries:[{index:0,url:'/c',navigable:false,resumeOnly:true}]},
  publish(){},restore:(...args)=>restored.push(args),onRemoteSessionReady(){}});
 await surface.open(controller);assert.equal(surface.opened,true);assert.deepEqual(restored.at(-1),[3,.68,.24]);
 assert.deepEqual(controller.savedLocation,saved);controller.close();
}
console.log('PASS real manga surface/gateway/controller carries exact directory proof on cached and live paths, rejection admits no pixels/writes, implicit resume retains historical image xy/CAS');

// Source-rule replacement cannot leave an online cold-entry cache miss using
// an obsolete manifest forever. The real Surface renews only the failed,
// descriptor-less target through one forced canonical catalog acquisition.
for (const mode of ['missing', 'reprocess', 'same-exact', 'same-unresolved', 'same-refresh-failure', 'same-repeat-miss', 'same-exit', 'cached-pixels', 'offline-missing', 'offline-pixels', 'disabled', 'disabled-no-session', 'deleted', 'exit', 'live-failure']) {
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const old=structuredClone(chapter);old.cached=true;old.resources=[];
 const durable={kind:'manga',chapter:old.manifest.chapter,manifestVersion:old.manifest.manifestVersion,
   pageId:old.manifest.pages[3].pageId,pageOrdinalFallback:3,x:.24,y:.68,progressRevision:9};
 const prepared={chapter:{...old,totalPages:8,pageStart:2,manifest:{...old.manifest,pages:old.manifest.pages.slice(2,5)}},
   targetOrdinal:3,recoveryRequired:false,progress:{token:{epoch:92,revision:9},location:structuredClone(durable)}};
 if(mode==='live-failure')prepared.chapter.resources=structuredClone(chapter.resources.slice(2,5));
 const sameVersion=mode.startsWith('same');
 const fresh=structuredClone(chapter);fresh.manifest.sourceRuleVersion=sameVersion?'r':'new-source';fresh.manifest.manifestVersion='new-manifest';
 if(sameVersion)fresh.anchorMapping={status:mode==='same-unresolved'?'unresolved':'exact',reason:mode==='same-unresolved'?'ambiguousPageIdentity':'sourcePageIdentity',fromManifestVersion:'v',fromPageId:old.manifest.pages[3].pageId,
   ...(mode==='same-unresolved'?{}:{targetPageId:fresh.manifest.pages[3].pageId,targetOrdinal:3})};
 const catalog={contentKind:'manga',sourceVersion:fresh.manifest.sourceRuleVersion,identity:{sourceId:'s',bookId:'b'},entries:[{index:0,url:'/c',title:'chapter'}]};
 const calls=[],images=[],catalogs=[],restored=[];let writes=0,finishCatalog,finishChapter;
 const rt={supportsCoreCapability:()=>true,async request(method,params){
   calls.push([method,params]);
   if(method==='manga.entry.get')return {data:{entry:structuredClone(prepared)}};
   if(method==='manga.chapter.get'){
     assert.equal(params.policy,sameVersion?'refresh':'cacheFirst');
     if(sameVersion){assert.equal(params.expectedManifestVersion,'v');assert.deepEqual(params.anchor,{pageId:old.manifest.pages[3].pageId,ordinal:3});}
     if(mode==='same-refresh-failure')throw Error('source denied');
     if(mode==='same-exit')await new Promise(resolve=>finishChapter=resolve);
     return {data:structuredClone(fresh)};
   };
   if(method==='reading.progress.get')return {data:{token:{epoch:92,revision:9},location:structuredClone(durable)}};
   writes++;throw Error('reentry cannot write durable progress');
 },async loadReadingImage(...args){
   images.push(args);
   if((args[3]===old.manifest.manifestVersion && !['cached-pixels','offline-pixels'].includes(mode)) || mode==='same-repeat-miss')
     throw Error(mode==='reprocess'?'READING_IMAGE_REPROCESS_REQUIRED':mode==='live-failure'?'READING_IMAGE_HTTP_FAILED':'REMOTE_READING_IMAGE_NOT_DOWNLOADED');
   return {fileUri:'file://pixels',width:600,height:800,revision:'pixels'};
 },releaseReadingImage(){},bookAcquisitions:()=>({async acquireBook(_seed,options){
   catalogs.push(options);
   if(options.forceRefresh && ['disabled','disabled-no-session','deleted'].includes(mode))throw Error('source is unavailable');
   if(options.forceRefresh && mode==='exit')await new Promise(resolve=>finishCatalog=resolve);
   return catalog;
 }})};
 const Surface=productionMotionMethods(new URL('MangaReadingSurface.ets',root),['open','acquireCatalog','effectiveFit','configureAdjacentChapter'],
   {MangaSessionGateway,MangaBookPresentation,AppStorage:{setOrCreate(){}}});
 const c=new Controller(rt),offlineMode=mode.startsWith('offline');
 const surface=Object.assign(new Surface(),{mounted:true,controller:c,runtime:rt,sourceId:'s',bookId:'b',offline:offlineMode,
   fitPreference:'width',horizontal:false,remoteSession:mode==='disabled-no-session'?undefined:catalog,remoteBookSeed:{sourceId:'s',bookId:'b',contentKind:'manga'},
   opened:false,error:'',publish(){},restore:(...args)=>restored.push(args),updateViewport(){},onRemoteSessionReady(){}});
 const opening=surface.open(c);
 if(mode==='exit'){
   while(finishCatalog===undefined)await new Promise(resolve=>setImmediate(resolve));
   surface.mounted=false;c.close();finishCatalog();
 } else if(mode==='same-exit'){
   while(finishChapter===undefined)await new Promise(resolve=>setImmediate(resolve));
   surface.mounted=false;c.close();finishChapter();
 }
 await opening;await new Promise(resolve=>setImmediate(resolve));
 const forced=catalogs.filter(options=>options.forceRefresh===true);
 assert.equal(writes,0);assert.deepEqual(durable,{kind:'manga',chapter:old.manifest.chapter,manifestVersion:'v',
   pageId:old.manifest.pages[3].pageId,pageOrdinalFallback:3,x:.24,y:.68,progressRevision:9});
 if(['missing','reprocess'].includes(mode)){
   assert.equal(forced.length,1);assert.equal(c.chapter.manifest.manifestVersion,'new-manifest');
   assert.ok(c.visiblePages().some(page=>page.status==='ready'));
   assert.equal(surface.recovering,true);assert.equal(c.recoveryRequired,true,'changed source cannot silently map the old saved location');
   assert.equal(c.savedLocation.x,.24);assert.equal(c.savedLocation.y,.68);
   assert.equal(c.savedLocation.pageOrdinalFallback,3);assert.equal(calls.filter(([method])=>method==='manga.chapter.get').length,1);
 } else if(mode==='same-exact'){
   assert.equal(forced.length,1);assert.equal(c.chapter.manifest.manifestVersion,'new-manifest');
   assert.equal(calls.filter(([method])=>method==='manga.chapter.get').length,1,'same-version missing descriptors refresh exactly once');
   assert.equal(surface.recovering,false);assert.equal(c.recoveryRequired,false);
   assert.equal(c.savedLocation.x,.24);assert.equal(c.savedLocation.y,.68);assert.equal(c.savedLocation.pageOrdinalFallback,3);
   assert.equal(c.savedLocation.manifestVersion,'new-manifest','only exact Core anchor proof maps the display position');
   assert.ok(c.visiblePages().some(page=>page.status==='ready'));
   assert.deepEqual(restored.at(-1),[3,.68,.24],'exact anchor retains both coordinates');
 } else if(['same-unresolved','same-repeat-miss'].includes(mode)){
   assert.equal(forced.length,1);assert.equal(c.chapter.manifest.manifestVersion,'v','unresolved or failed replacement never admits the new manifest');
   assert.equal(calls.filter(([method])=>method==='manga.chapter.get').length,1,'one bounded refresh attempt');
   assert.equal(surface.recovering,mode==='same-unresolved');assert.equal(c.recoveryRequired,mode==='same-unresolved');
   assert.deepEqual(c.savedLocation,durable,'old version and both coordinates remain intact');
   assert.equal(c.visiblePages().find(page=>page.ordinal===3).error,'REMOTE_READING_IMAGE_NOT_DOWNLOADED');
 } else if(['exit','same-exit'].includes(mode)){
   assert.equal(forced.length,1);assert.equal(surface.opened,false);
   assert.equal(calls.filter(([method])=>method==='manga.chapter.get').length,mode==='same-exit'?1:0,'disposed renewal admits no subsequent chapter');
   assert.equal(c.chapter,undefined);assert.equal(surface.error,'','late disposed renewal does not write an error');
 } else {
   assert.equal(surface.opened,true);assert.equal(c.chapter.manifest.manifestVersion,'v');
   assert.equal(forced.length,['disabled','disabled-no-session','deleted','same-refresh-failure'].includes(mode)?1:0);
   assert.equal(calls.filter(([method])=>method==='manga.chapter.get').length,mode==='same-refresh-failure'?1:0,'failed refresh retains its old entry, other entries do not force a new manifest');
   if(mode==='disabled-no-session')assert.equal(catalogs.length,1,'failed renewal does not start a second background catalog acquisition');
   if(mode.includes('pixels')){
     assert.deepEqual(restored.at(-1),[3,.68,.24],'exact cached pixels keep the saved image and both coordinates');
   } else {
     assert.equal(c.visiblePages().find(page=>page.ordinal===3).error,mode==='live-failure'?'READING_IMAGE_HTTP_FAILED':'REMOTE_READING_IMAGE_NOT_DOWNLOADED');
     assert.equal(surface.error,'','unavailable renewal preserves the original specific row failure');
   }
   if(offlineMode){assert.equal(catalogs.length,0);assert.ok(images.every(args=>args[6]===false),'offline never enables image network');}
 }
 c.close();
}
console.log('PASS actual Surface/Gateway/Controller cached entry renewal: changed source opens fresh; same source refreshes once using exact/unresolved Core anchor proof; unchanged durable xy/CAS, explicit recovery, bounded failures, cached/offline/live-error exclusions and exit fences');

// Cold shelf entry admits narrow cached pixels before its background catalog.
// Exercise the real SDK parent payload, retained child updater and property
// runtime so a later catalog cannot be lost in a plain initializer field.
{
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const {createRequire}=await import('node:module');
 const surfaceSource=readFileSync(new URL('MangaReadingSurface.ets',root),'utf8');
 const shellSource=readFileSync(new URL('../entry/src/main/ets/features/shell/ReaderShell.ets',import.meta.url),'utf8');
 const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
 const syntax=createRequire(import.meta.url)(`${sdk}/lib/validate_ui_syntax.js`);
 syntax.componentCollection.customComponents.add('MangaReadingSurface');
 syntax.propCollection.set('MangaReadingSurface',new Set([...surfaceSource.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(match=>match[1])));
 const properties=createArkUIPropertyRuntimeProbe();
 const childSdk=createReaderBuilderProbe(surfaceSource,
   ['remoteSession','onSelectDirectoryTarget','open','acquireCatalog','effectiveFit','configureAdjacentChapter','adjacentChapter','directoryEntries','selectDirectoryTarget',
    'performPanelAction','closePanel','dismissPanelKeyboard','panelTravel','panelWidth','panelHeight','widePanel',
    'panel','panelPhase','panelGeneration','panelActionGeneration','panelCloseTask','panelCloseResolve','panelOffset','panelScrimOpacity','reduceMotion',
    'onWindowChromeChanged'],
   {...properties.sdk,MangaSessionGateway,MangaBookPresentation,AppStorage:{setOrCreate(){}},
    inputMethod:{getController:()=>({hideTextInput:async()=>{}})},
    uiContext:{getFocusController:()=>({clearFocus(){}})}},properties.hooks);
 const parentSdk=createReaderBuilderProbe(shellSource,['remoteSession','mangaSurface','mangaIdentityKey'],
   {...properties.sdk,MangaReadingSurface:childSdk.Component,ReaderRuntimeOwner:{current:()=>({})}},properties.hooks);
 const parent=parentSdk.owner;
 Object.assign(parent,{sourceId:'s',bookId:'b',readingReadyGeneration:1,mangaChapterRequestGeneration:0});
 parent.mangaSurface();
 assert.equal(parent.children.size,1);
 const surface=[...parent.children.values()][0];
 surface.isReaderIdentityCurrent=()=>false; // Cold-catalog fixture has no system-window owner.
 const next=structuredClone(chapter);next.chapterIndex=1;next.manifest.chapter.chapterId='/next';next.manifest.manifestVersion='next';
 const catalog={contentKind:'manga',sourceVersion:'r',identity:{sourceId:'s',bookId:'b'},book:{title:'cold manga'},
   entries:[{index:0,url:'/c',title:'chapter'},{index:1,url:'/next',title:'next chapter'}]};
 let finishCatalog,writes=0;const catalogs=new Promise(resolve=>finishCatalog=resolve),requests=[];
 const rt={supportsCoreCapability:()=>true,async request(method,params){
   requests.push([method,params]);
   if(method==='manga.entry.get')return {data:{entry:{chapter:{...structuredClone(chapter),cached:true,totalPages:8,pageStart:0},targetOrdinal:0,recoveryRequired:false,progress:{token:{epoch:93,revision:0},location:null}}}};
   if(method==='manga.chapter.get'){assert.equal(params.chapterIndex,1,'only optional canonical next-chapter preparation may follow cached entry');return {data:structuredClone(next)}};
   writes++;throw Error('cold catalog publication cannot write user data');
 },async loadReadingImage(){return {fileUri:'file://cold-entry',width:600,height:800,revision:'pixels'}},releaseReadingImage(){},
   bookAcquisitions:()=>({acquireBook:()=>catalogs})};
 const controller=new Controller(rt);
 parent.onRemoteSessionReady=session=>{parent.updateStateVars({remoteSession:session});properties.flush();};
 Object.assign(surface,{mounted:true,controller,runtime:rt,sourceId:'s',bookId:'b',offline:false,
   remoteBookSeed:{sourceId:'s',bookId:'b',contentKind:'manga'},fitPreference:'width',horizontal:false,
   publish(){},restore(){},updateViewport(){},onRemoteSessionReady:session=>parent.onRemoteSessionReady(session)});
 await surface.open(controller);
 assert.equal(surface.opened,true);assert.equal(surface.remoteSession,undefined);
 assert.equal(surface.adjacentChapter(1),undefined);
 assert.equal(requests.filter(([method])=>method==='manga.entry.get').length,1);
 finishCatalog(catalog);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(parent.children.size,1);assert.equal([...parent.children.values()][0],surface,'late catalog updates retain the same reader child');
 assert.equal(surface.controller,controller,'catalog publication cannot replace the active pixel/position owner');
 assert.equal(surface.remoteSession.identity.bookId,'b');
 assert.equal(surface.adjacentChapter(1).url,'/next','cold reading can continue after the catalog arrives');
 assert.deepEqual(surface.directoryEntries().map(entry=>entry.index),[0,1]);
 assert.ok(properties.updates.some(update=>update.child===surface&&update.params.remoteSession?.identity.bookId==='b'),
   'actual SDK Shell emits the later session in its retained-child update payload');
 // The emitted Shell adapter forwards flat fallback picks through Index's
 // existing canonical chapter path, while proof-backed v2 targets keep their
 // stricter identity path. No flat row can invent a v2 proof.
 const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
   ['onDirectoryChapterSelected','onDirectoryNavigationTargetSelected','isKnownDetailChapter'],{LOCAL_SOURCE_ID:'local'});
 const indexOwner=Object.assign(new Index(),{detailBook:{sourceId:'s',bookId:'b'},readingContentKind:'manga',
   readingSessionActive:true,remoteReadingSession:{...catalog,entries:[...catalog.entries,{index:9,url:'/group',navigable:false}]},
   mangaChapterRequestGeneration:0,directoryCurrentChapterIndex:0,mangaCommittedRequestGeneration:0,route:'reading',
   nextNavigationGeneration(){},onReaderBookmarkSelected(){throw Error('manga must not enter text bookmark navigation')}});
 parent.onSelectChapter=index=>indexOwner.onDirectoryChapterSelected(index);
 parent.onSelectNavigationTarget=(...args)=>indexOwner.onDirectoryNavigationTargetSelected(...args);
 let saves=0;surface.saveVisible=async()=>{saves++;};surface.panel='directory';surface.panelPhase='open';surface.reduceMotion=true;surface.persistentDirectory=()=>false;
 await surface.selectDirectoryTarget(1);
 assert.equal(indexOwner.requestedChapterIndex,1,'proof-less fallback reaches the existing canonical chapter pick');
 assert.equal(indexOwner.requestedMangaDirectoryTargetProof,undefined);
 assert.equal(indexOwner.mangaChapterRequestGeneration,1);assert.equal(surface.panel,'');
 const proof={sourceId:'s',bookId:'b',chapterIndex:0,url:'/c',nodeId:'node0',catalogRevision:'catalog'};
 surface.panel='directory';surface.panelPhase='open'; // A second user pick starts in a newly opened directory.
 await surface.selectDirectoryTarget(0,proof);
 assert.equal(indexOwner.requestedChapterIndex,0);assert.equal(indexOwner.requestedMangaDirectoryTargetProof,proof,
   'proof-backed v2 selection still reaches the exact Index path with the original proof');
 assert.equal(indexOwner.mangaChapterRequestGeneration,2);
 surface.panel='directory';surface.panelPhase='open';
 await surface.selectDirectoryTarget(9);
 assert.equal(indexOwner.requestedChapterIndex,0);assert.equal(indexOwner.mangaChapterRequestGeneration,2,
   'Index canonical/navigable checks still reject a non-readable group on the fallback path');
 assert.equal(saves,3,'both directory adapters retain Surface save-before-navigation');
 assert.equal(writes,0);controller.close();
}
console.log('PASS actual SDK Shell/retained Surface/property runtime plus cold Controller entry: later catalog updates directory and next chapter; flat/proof-backed picks reach existing Index guards, preserve proof and save ordering; no remount or user-data writes');

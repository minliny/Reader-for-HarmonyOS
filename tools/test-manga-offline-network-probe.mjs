import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as nodeFs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { MangaOfflineNetworkProbe, MANGA_PROBE_REQUEST_LIMIT } from '../entry/src/main/ets/app/MangaOfflineNetworkProbe.ts';
import { MangaBookPresentation } from '../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
import { readerMangaOfflineProbeScope, readerMangaReadingProbeScope, readerMangaProbeSelectionMode, readerControlVerificationColdStartPage, readerDisableOptionalEntryMemory } from '../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts';
import { MangaImageDecodeHost } from '../entry/src/main/ets/app/MangaImageDecodeHost.ts';
import { createMangaAtomicPayloadReaderFixture, createMangaAtomicPayloadInstallerFixture } from './lib/manga-atomic-payload-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { errorMessageOf, localReadFailureSummary } from '../entry/src/main/ets/app/ErrorMessage.ts';

const url = name => new URL('../entry/src/main/ets/' + name, import.meta.url);
const scope = { sourceId:'source-A', bookId:'book-A' };
const snap = probe => JSON.parse(probe.snapshot());
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve=r; });return {promise,resolve}; };

for (const debug of [true,false,1,'true']) for (const mode of ['debug','release','debug '])
  for (const enabled of [true,false,undefined,'true',1]) {
    assert.equal(readerMangaOfflineProbeScope(debug,mode,enabled,scope.sourceId,scope.bookId) !== undefined,
      debug===true && mode==='debug' && enabled===true);
  }
for (const bad of [undefined,{},'', ' x','x\n','x'.repeat(8193)]) {
  assert.equal(readerMangaOfflineProbeScope(true,'debug',true,bad,'book'),undefined);
  assert.equal(readerMangaOfflineProbeScope(true,'debug',true,'source',bad),undefined);
}
const mutable={...scope}; const probe=new MangaOfflineNetworkProbe(mutable);mutable.bookId='other';
assert.equal(probe.protectsAutomaticCatalog(scope.sourceId,scope.bookId),true,'cold arm protects exact catalog identity');
assert.equal(probe.protectsAutomaticCatalog(scope.sourceId,'other'),false);
assert.equal(probe.protectsAutomaticCatalog('other',scope.bookId),false);
assert.equal(probe.ownsCommand('book.toc',scope),true,'exact Want scope is copied and active from cold arm');
assert.equal(probe.ownsCommand('book.toc',{...scope,bookId:'other'}),false);
assert.equal(probe.ownsCommand('source.imageRequest',{sourceId:scope.sourceId}),false,'source-only cannot claim another book request');
assert.equal(probe.ownsCommand('book.detail',{sourceId:scope.sourceId,bookUrl:scope.bookId,book:{title:'title'}}),true);
assert.equal(probe.ownsCommand('manga.resource.prepare',{chapter:scope}),true);
assert.equal(probe.ownsCommand('reading.progress.update',{location:{chapter:scope}}),true);
probe.track(1);assert.throws(()=>probe.beforeCoreHttp(1),/HTTP_BLOCKED/);assert.equal(snap(probe).beforeSelectionCoreHttpAttempts,1);
probe.settle(1);probe.select(scope.sourceId,scope.bookId,true);assert.equal(probe.matches(scope.sourceId,scope.bookId),true);
assert.equal(probe.protectsAutomaticCatalog(scope.sourceId,scope.bookId),true,'selection preserves exact protection');
probe.release('reader-left');assert.equal(probe.ownsCommand('book.toc',scope),false);
assert.equal(probe.protectsAutomaticCatalog(scope.sourceId,scope.bookId),false,'released scope does not suppress later automatic checks');
assert.throws(()=>probe.beforeCoreHttp(1),/HTTP_BLOCKED/,'settled request tombstone still rejects late callbacks');
probe.beforeCoreHttp(2);assert.equal(snap(probe).coreHttpAttempts,2);assert.equal(snap(probe).pendingRequests,0);
for(const [source,book,manga] of [['other','book-A',true],['source-A','other',true],['source-A','book-A',false]]) {
  const p=new MangaOfflineNetworkProbe(scope);p.select(source,book,manga);assert.equal(snap(p).state,'released');
}
const capacity=new MangaOfflineNetworkProbe(scope);
assert.equal(MANGA_PROBE_REQUEST_LIMIT,8192);
for(let i=0;i<MANGA_PROBE_REQUEST_LIMIT;i++){capacity.assertCapacity();capacity.track(i);capacity.settle(i);}
assert.throws(()=>capacity.assertCapacity(),/CAPACITY/);assert.equal(snap(capacity).claimedRequests,MANGA_PROBE_REQUEST_LIMIT);
assert.equal(snap(capacity).requestLimit,MANGA_PROBE_REQUEST_LIMIT);
assert.throws(()=>capacity.beforeCoreHttp(0),/HTTP_BLOCKED/,'the oldest settled offline id is retained at the full capacity boundary');
assert.throws(()=>capacity.beforeImageHttp(MANGA_PROBE_REQUEST_LIMIT-1),/IMAGE_HTTP_BLOCKED/,'the newest settled offline id is retained at the full capacity boundary');
{
 const q=new MangaOfflineNetworkProbe(scope,()=>{},'reading');
 q.track(1,'manga.cache.classify');q.track(1,'book.toc');q.settle(1);
 for(let i=0;i<80;i++)q.track(i+2,`https://private.invalid/credential-${i}`);
 assert.deepEqual(snap(q).requestMethods,{'manga.cache.classify':1,'other-owned':80});
 assert.equal(snap(q).claimedRequests,81,'duplicate ids are not counted as new RPCs');
 assert.equal(q.snapshot().includes('private.invalid'),false,'arbitrary method strings never enter reports');
 assert.equal(Object.keys(snap(q).requestMethods).length,2,'all unknown methods share one fixed bucket');
}
console.log('PASS exact debug cold Want, arm-before-selection scope, immutable identity, wrong/text selection, bounded tombstones and actual nonzero denial counts');

// The explicit selection flags arm no book and never infer one from a URL.
for (const debug of [true,false,1,'true',new Boolean(true)])
 for (const build of ['debug','release','debug '])
 for (const flag of [true,false,undefined,'true',1,new Boolean(true)]) {
  assert.equal(readerMangaProbeSelectionMode(debug,build,flag,undefined),debug===true&&build==='debug'&&flag===true?'offline':undefined);
  assert.equal(readerMangaProbeSelectionMode(debug,build,undefined,flag),debug===true&&build==='debug'&&flag===true?'reading':undefined);
 }
assert.equal(readerMangaProbeSelectionMode(true,'debug',true,true),undefined);
for(const conflict of [true])for(const mode of ['offline','reading']) {
 assert.equal(readerMangaProbeSelectionMode(true,'debug',mode==='offline',mode==='reading',[conflict]),undefined);
}
for(const nonflag of [false,undefined,'true',1,new Boolean(true)])assert.equal(readerMangaProbeSelectionMode(true,'debug',true,undefined,[nonflag]),'offline');
for(const mode of ['offline','reading']) {
 const selected=new MangaOfflineNetworkProbe(undefined,()=>{},mode,true);
 const armed=snap(selected);
 assert.equal(armed.binding,'first-manga-selection');assert.equal(armed.bookCoverage,'selected-only');
 assert.equal(armed.beforeSelectionBookCoverage,'not-covered');assert.equal(armed.identityBound,false);
 assert.equal(armed.beforeSelectionProtected,false);
 assert.equal(selected.ownsCommand('manga.resource.prepare',{chapter:scope}),false);
 assert.equal(selected.protectsAutomaticCatalog(scope.sourceId,scope.bookId),false);
 assert.equal(selected.matches(scope.sourceId,scope.bookId),false);
 selected.track(77);assert.equal(snap(selected).claimedRequests,0,'unbound probe cannot accept a manual request claim either');
 selected.beforeCoreHttp(77);selected.beforeImageHttp(77);
 assert.equal(snap(selected).coreHttpAttempts,0);assert.equal(snap(selected).imageHttpAttempts,0,'unbound scope never claims pre-selection book HTTP');
 selected.select(scope.sourceId,scope.bookId,true);
 assert.equal(snap(selected).identityBound,true);assert.equal(snap(selected).state,'active');
 assert.equal(selected.ownsCommand('manga.resource.prepare',{chapter:scope}),true);
 assert.equal(selected.ownsCommand('manga.resource.prepare',{chapter:{...scope,bookId:'wrong-book'}}),false);
 assert.equal(selected.matches(scope.sourceId,scope.bookId),mode==='offline');
 assert.equal(selected.protectsAutomaticCatalog(scope.sourceId,scope.bookId),mode==='offline');
 selected.select(scope.sourceId,'wrong-book',true);selected.select(scope.sourceId,'wrong-book',true);
 assert.equal(snap(selected).state,'released');assert.equal(selected.ownsCommand('manga.resource.prepare',{chapter:{...scope,bookId:'wrong-book'}}),false,'selection-bound target cannot rebind');
 assert.equal(snap(selected).beforeSelectionBookCoverage,'not-covered');
 for(const terminal of ['ability-background','reader-left']) {
  const p=new MangaOfflineNetworkProbe(undefined,()=>{},mode,true);p.release(terminal);p.select(scope.sourceId,scope.bookId,true);
  assert.equal(snap(p).identityBound,false);assert.equal(snap(p).state,'released');
 }
 for(const [source,book,manga]of [['',scope.bookId,true],[scope.sourceId,'bad\n',true],[scope.sourceId,scope.bookId,false]]) {
  const p=new MangaOfflineNetworkProbe(undefined,()=>{},mode,true);p.select(source,book,manga);p.select(scope.sourceId,scope.bookId,true);
  assert.equal(snap(p).identityBound,false);assert.equal(snap(p).state,'released','invalid/nonmanga initial selection cannot later bind');
 }
 assert.equal(selected.snapshot().includes(scope.sourceId),false);assert.equal(selected.snapshot().includes(scope.bookId),false,'snapshot carries no source/book URLs or credentials');
}
console.log('PASS strict selection-only admission, explicit pre-selection coverage boundary, exact one-time Native identity binding and terminal no-rebind fences');

let byteFetches=0,coreFetches=0,dataDecodes=0;
const HttpExecuteHost={instance:{async execute(){coreFetches++;return {};},async executeForCore(){coreFetches++;return {};},cancel(){},
  async executeBytes(){byteFetches++;return {status:200,headers:{},bytes:new Uint8Array([1,2,3])};}}};
const Body=productionMotionMethods(url('app/ReadingBodyImageHost.ts'),['fetchRequestBytes','readDataUriBytes','assertCurrent'],{
  MAX_READING_IMAGE_BYTES:16777216,MAX_READING_IMAGE_DATA_URI_CHARS:22373720,HttpExecuteHost,readingImageHttpError:()=>Error('status'),
  util:{Type:{MIME:1},Base64Helper:class{decodeSync(text){dataDecodes++;return new Uint8Array(Buffer.from(text,'base64'));}}},
});
const body=new Body();body.validateBytes=async()=>{};
class Router {handlers=new Map();register(name,handler){this.handlers.set(name,handler);}route(event){return this.handlers.get(event.capability)(event);}}
let decodeTransport;
const Registry=productionMotionMethods(url('app/ReaderHostRegistry.ts'),['createCapabilityRouter'],{
  CapabilityRouter:Router,HttpExecuteHost,ReadingBodyImageHost:{instance:body},MangaImageGraphicsHost:{instance:{}},
  MangaImageDecodeHost:{instance:{handle(event,_bridge,transport){decodeTransport=transport;return transport.fetch(event.params.request,()=>true,16777216);},cancel(){}}},
  MangaImageMetadataHost:{instance:{handle:async()=>({}),cancel(){}}},
});
const p=new MangaOfflineNetworkProbe(scope),registry=new Registry();registry.mangaOfflineProbe=p;registry.responseAssetBridge={};
const router=registry.createCapabilityRouter();p.track(9);
for(const responseAsset of [false,true])assert.throws(()=>router.route({capability:'http.execute',requestId:9,params:{responseAsset}}),/HTTP_BLOCKED/);
assert.equal(coreFetches,0);await router.route({capability:'http.execute',requestId:10,params:{}});assert.equal(coreFetches,1);
await assert.rejects(router.route({capability:'manga.resource.transfer',requestId:9,params:{request:{url:'https://fixture.invalid/image'}}}),/IMAGE_HTTP_BLOCKED/);
assert.equal(byteFetches,0);assert.equal(snap(p).imageHttpAttempts,1);
await router.route({capability:'manga.resource.transfer',requestId:9,params:{request:{dataUri:'data:image/png;base64,AQID'}}});
assert.equal(dataDecodes,1);assert.equal(snap(p).imageHttpAttempts,1,'data URI is not a network request');
await body.fetchRequestBytes({},()=>true,16777216,()=>p.beforeImageHttp(10));assert.equal(byteFetches,1,'unowned direct fetch is unchanged');
const savedTransport=decodeTransport;p.release('background');p.settle(9);
await assert.rejects(savedTransport.fetch({url:'https://fixture.invalid/late'},()=>true,16777216),/IMAGE_HTTP_BLOCKED/);
assert.equal(byteFetches,1,'late Host fetch cannot escape after release and SDK waiter settlement');
await assert.rejects(savedTransport.fetch({},()=>false,16777216),/cancelled/);
assert.equal(snap(p).imageHttpAttempts,2,'cancelled work fails before the actual HTTP-attempt boundary');
console.log('PASS actual Registry Core HTTP variants and Body fetch boundaries: non-target preserved, data URI excluded, late callbacks blocked after release/settlement');

// Real DecodeHost holds its own current fence across a suspended transport;
// even a transport callback mistakenly retaining true is blocked by the id tombstone.
{
  const deferredFetch=deferred(), entered=deferred(), decoder=new MangaImageDecodeHost(), q=new MangaOfflineNetworkProbe(scope);
  let current=true;q.track(31);let attemptedAssets=0;
  const result=decoder.prepare({resourceRef:'resource'},async params=>{
    await decoder.handle({requestId:31,operationId:1,params:{...params,stage:'input',maxBytes:16777216,request:{}}},
      {begin(){attemptedAssets++;return 1;}},
      {async fetch(request){entered.resolve();await deferredFetch.promise;return body.fetchRequestBytes(request,()=>true,16777216,()=>q.beforeImageHttp(31));},async validate(){}});
    throw Error('unexpected success');
  },()=>current);
  await entered.promise;current=false;q.release('timeout');q.settle(31);deferredFetch.resolve();
  await assert.rejects(result,/IMAGE_HTTP_BLOCKED/);assert.equal(attemptedAssets,0);assert.equal(snap(q).imageHttpAttempts,1);assert.equal(byteFetches,1);
}
console.log('PASS actual DecodeHost suspended fetch after cancellation/timeout cannot allocate an input asset or dispatch HTTP');

const Owner=productionMotionMethods(url('app/ReaderRuntimeOwner.ts'),['requestDirect','mangaOfflineProbeProtectsAutomaticCatalog','selectMangaOfflineProbe','releaseMangaOfflineProbe','finishMangaOfflineProbe'],{
  DEFAULT_CORE_REQUEST_TIMEOUT_MS:30000,coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined,
});
function ownerFixture(p) {
  let id=100;const calls=[];const owner=new Owner();owner.state='ready';owner.mangaOfflineProbe=p;owner.start=async()=>{};owner.wakeReadingPreparations=()=>{};
  owner.readingEntryPreparations=()=>({beginRequest:()=>false,finishRequest(){}});
  owner.runtime={send(method,params){calls.push(['send',method]);return ++id;},
    async waitForResult(requestId,options){calls.push(['wait',requestId,options]);return {requestId,data:{}};},
    async request(method){calls.push(['ordinary',method]);return {requestId:++id,data:{}};}};
  return {owner,calls};
}
{
  const q=new MangaOfflineNetworkProbe(scope),{owner}=ownerFixture(q);
  assert.equal(owner.mangaOfflineProbeProtectsAutomaticCatalog(scope.sourceId,scope.bookId),true);
  assert.equal(owner.mangaOfflineProbeProtectsAutomaticCatalog(scope.sourceId,'other'),false);
  q.release('reader-left');
  assert.equal(owner.mangaOfflineProbeProtectsAutomaticCatalog(scope.sourceId,scope.bookId),false);
  owner.mangaOfflineProbe=undefined;
  assert.equal(owner.mangaOfflineProbeProtectsAutomaticCatalog(scope.sourceId,scope.bookId),false);
}
{
  const q=new MangaOfflineNetworkProbe(scope),{owner,calls}=ownerFixture(q);
  owner.runtime.waitForResult=async(id,options)=>{assert.equal(q.current(id),true,'tracked before SDK dispatch');q.beforeCoreHttp(id);};
  await assert.rejects(owner.requestDirect('book.toc',scope),/HTTP_BLOCKED/);assert.equal(snap(q).pendingRequests,0);
  await owner.requestDirect('book.toc',{sourceId:scope.sourceId,bookId:'other'});assert.equal(calls.at(-1)[0],'ordinary');
  const wait=deferred(),waiting=deferred();let options;
  owner.runtime.waitForResult=async(id,o)=>{options=o;waiting.resolve(id);await wait.promise;throw Error('waiter timeout');};
  const task=owner.requestDirect('manga.resource.prepare',{chapter:scope});const id=await waiting.promise;
  q.release('reader-left');assert.equal(options.shouldCancel(),true);wait.resolve();await assert.rejects(task,/timeout/);
  assert.throws(()=>q.beforeImageHttp(id),/IMAGE_HTTP_BLOCKED/);assert.equal(snap(q).pendingRequests,0);
}
{
  const q=new MangaOfflineNetworkProbe(scope),{owner}=ownerFixture(q);
  owner.runtime.waitForResult=async(id,options)=>{q.release('reader-left');assert.equal(options.shouldCancel(),false,'exit must preserve CAS progress commit');return {requestId:id,data:{saved:true}};};
  assert.equal((await owner.requestDirect('reading.progress.update',{location:{chapter:scope}})).data.saved,true);
}
{
  const {owner,calls}=ownerFixture(capacity);await assert.rejects(owner.requestDirect('book.toc',scope),/CAPACITY/);assert.equal(calls.length,0,'capacity fails before Core send');
}
console.log('PASS production Runtime send/wait binding, ordinary request isolation, timeout settlement, progress-save survival and capacity before dispatch');
for(const mode of ['offline','reading']) {
 const q=new MangaOfflineNetworkProbe(undefined,()=>{},mode,true),{owner,calls}=ownerFixture(q);
 const options={timeoutMs:8765,pollMs:4,shouldCancel:()=>false,hostRequest:()=>{}};
 let ordinaryOptions;
 owner.runtime.request=async(method,params,value)=>{ordinaryOptions=value;calls.push(['ordinary',method]);return {data:{}};};
 await owner.requestDirect('book.toc',scope,options);assert.equal(ordinaryOptions,options);
 assert.equal(snap(q).claimedRequests,0);assert.equal(owner.mangaOfflineProbeProtectsAutomaticCatalog(scope.sourceId,scope.bookId),false);
 q.select(scope.sourceId,scope.bookId,true);
 owner.runtime.waitForResult=async(id,value)=>{
  if(mode==='reading'){assert.equal(value,options);q.beforeCoreHttp(id);q.beforeImageHttp(id);return {requestId:id,data:{ok:true}};}
  q.beforeCoreHttp(id);throw Error('unexpected network');
 };
 if(mode==='reading')assert.equal((await owner.requestDirect('manga.resource.prepare',{chapter:scope},options)).data.ok,true);
 else await assert.rejects(owner.requestDirect('manga.resource.prepare',{chapter:scope},options),/HTTP_BLOCKED/);
 assert.equal(snap(q).beforeSelectionCoreHttpAttempts,0);assert.equal(snap(q).beforeSelectionImageHttpAttempts,0);
 assert.equal(snap(q).coreHttpAttempts,1);
 await owner.requestDirect('manga.resource.prepare',{chapter:{...scope,bookId:'different'}},options);
 assert.equal(calls.at(-1)[0],'ordinary','binding never claims another Native book identity');
 const claimed=101;q.release('ability-background');q.settle(claimed);q.select(scope.sourceId,'different',true);
 if(mode==='offline')assert.throws(()=>q.beforeCoreHttp(claimed),/HTTP_BLOCKED/,'old selected offline request cannot escape after release');
 else assert.doesNotThrow(()=>q.beforeCoreHttp(claimed),'ordinary mode never denies late requests');
 await owner.requestDirect('manga.resource.prepare',{chapter:scope},options);assert.equal(calls.at(-1)[0],'ordinary');
}
console.log('PASS production requestDirect selected-only identity ownership, unbound unchanged options/catalog/network, reading unchanged HTTP, offline post-selection denial and late tombstones');
for(const mode of ['offline','reading']) {
 for(const active of [false,true]) {
  const q=new MangaOfflineNetworkProbe(undefined,()=>{},mode,true),{owner}=ownerFixture(q),contexts=[];
  if(active)owner.selectMangaOfflineProbe(scope.sourceId,scope.bookId,true);
  owner.setReadingPreparationContext=(...args)=>contexts.push(args);owner.flush=async()=>{};
  const Ability=productionMotionMethods(url('entryability/EntryAbility.ets'),['onBackground','onForeground'],{
   AppStorage:{setOrCreate(){}},ReaderWindowCoordinator:{reapplyChrome(){},reapplyWindowPolicy(){}},hilog:{error(){}},DOMAIN:0});
  const ability=Object.assign(new Ability(),{runtimeOwner:owner});ability.onBackground();ability.onForeground();
  owner.selectMangaOfflineProbe(scope.sourceId,scope.bookId,true);
  assert.equal(snap(q).state,'released');assert.equal(snap(q).reason,'ability-background');assert.equal(snap(q).identityBound,active);
  assert.deepEqual(contexts,[[false,false],[true,false]],'new diagnostics keep original foreground preparation wiring');
 }
 const q=new MangaOfflineNetworkProbe(undefined,()=>{},mode,true),{owner}=ownerFixture(q);
 owner.selectMangaOfflineProbe(scope.sourceId,scope.bookId,true);owner.finishMangaOfflineProbe(scope.sourceId,scope.bookId);
 owner.selectMangaOfflineProbe(scope.sourceId,scope.bookId,true);
 assert.equal(snap(q).state,'released');assert.equal(snap(q).reason,'reader-left');
}
console.log('PASS actual Owner select/finish/release and Ability background/foreground prevent selected or unbound diagnostic rearm');



// Execute the real Surface open/helper. Cached catalog access is its only
// offline dependency, and a missing cached catalog never reaches acquireBook.
let catalogReads=0,onlineAcquires=0,catalogFails=false;const catalogReadInputs=[];
const entry={targetOrdinal:0,recoveryRequired:false,chapter:{chapterIndex:0,chapterTitle:'本章',totalPages:1,pageStart:0,cached:true,resources:[],manifest:{chapter:{sourceId:scope.sourceId,bookId:scope.bookId,chapterId:'/chapter'},sourceRuleVersion:'r',manifestVersion:'v',decodeRevision:'v',pages:[{ordinal:0,pageId:'page-0'}],displayHints:{}}},progress:{token:{epoch:1,revision:0},location:null}};
const Surface=productionMotionMethods(url('features/manga/MangaReadingSurface.ets'),['rollbackChapterImages','open','acquireCatalog','acquirePreparedCatalog','aboutToDisappear'],{
  MangaSessionGateway:class{async entry(){return entry;}},
  RemoteReadingFlowGateway:class{
   async openCachedCatalogSession(seed,current,contextIsCurrent,allowMangaCatalog,requireDirectoryProof=false){
    catalogReads++;catalogReadInputs.push({seed,contextIsCurrent,allowMangaCatalog,requireDirectoryProof});
    assert.equal(current(),true);assert.equal(contextIsCurrent,false,'offline metadata cannot grant online context');
    assert.equal(allowMangaCatalog,true);assert.equal(typeof requireDirectoryProof,'boolean');
    if(catalogFails)throw Error('no cached catalog');
    return {identity:scope,contentKind:'manga',sourceVersion:'r',catalogVersion:'c1',contextVersion:'x1',
     entries:[{index:0,title:'本章',url:'/chapter',navigable:true,proofState:'verified'}],
     acquisitionMode:'offline',requiresContextRefresh:true,hostRequirements:[]};
   }
   async openCachedSession(){return this.openCachedCatalogSession();}
  },
  MangaBookPresentation, AppStorage: { setOrCreate() {} },
});
const makeSurface=()=>{
  const s=new Surface(), events=[],openedEntries=[],publishedCatalogs=[];
  s.controller={async awaitPendingProgress(){},async setPreviewMode(){},async openPrepared(_entry,offline){assert.equal(offline,true);assert.equal(_entry,entry);openedEntries.push(_entry);events.push('open');},savedLocation:null,displayedOrdinal:0,recoveryRequired:false,async close(){events.push('close');}};
  Object.assign(s,{...scope,offline:true,mounted:true,remoteBookSeed:{...scope,contentKind:'manga',title:'Offline book',author:'Writer',detailUrl:'/book'},fitPreference:'width',
    runtime:{bookAcquisitions:()=>({acquireBook:async()=>{onlineAcquires++;throw Error('online');}}),finishMangaOfflineProbe(){events.push('finish');},subscribeMangaOfflineProbe(listener){listener('receipt');return()=>events.push('detach');}},
    retainPreparationOnDisappear:()=>false,publish(){},restore(){},configureAdjacentChapter(){events.push('catalog');},onRemoteSessionReady(session){publishedCatalogs.push(session);},layoutGeneration:0,viewportGeneration:0,loginGeneration:0});
  return {s,events,openedEntries,publishedCatalogs};
};
const {s,events,openedEntries,publishedCatalogs}=makeSurface();await s.open(s.controller);await tick();assert.equal(s.opened,true);assert.equal(catalogReads,1);assert.equal(onlineAcquires,0);
assert.deepEqual(openedEntries,[entry],'cached first entry stays owned by the original controller');
assert.equal(publishedCatalogs.length,1);assert.equal(publishedCatalogs[0].requiresContextRefresh,true);
assert.equal(publishedCatalogs[0].acquisitionMode,'offline');assert.deepEqual(publishedCatalogs[0].hostRequirements,[]);
assert.deepEqual(publishedCatalogs[0].entries.map(row=>[row.index,row.url]),[[0,'/chapter']]);
assert.deepEqual([catalogReadInputs[0].contextIsCurrent,catalogReadInputs[0].allowMangaCatalog,catalogReadInputs[0].requireDirectoryProof],[false,true,true],
 'prepared offline bootstrap explicitly requires Core proof with no online context');
assert.equal(catalogReadInputs[0].seed.sourceVersion,'r');assert.equal(catalogReadInputs[0].seed.detailUrl,'/book');
s.aboutToDisappear();assert.equal(s.mounted,false);assert.deepEqual(events.slice(-3),['close','finish','detach'],'reader/controller fences precede probe release');
catalogFails=true;const f=makeSurface();await assert.rejects(f.s.acquireCatalog(()=>true),/no cached catalog/);assert.equal(onlineAcquires,0);
await f.s.open(f.s.controller);await tick();assert.equal(f.s.opened,true,'missing optional catalog does not hide downloaded pixels');assert.equal(onlineAcquires,0);
assert.deepEqual(f.openedEntries,[entry]);assert.equal(f.publishedCatalogs.length,0,'missing cache cannot publish invented directory facts');
console.log('PASS production offline Surface uses only cached catalog, preserves downloaded entry on absent optional TOC, and fences controller before releasing probe');
// The real cached gateway creates a new mutable session for every read. The
// Surface may tag its owned result without mutating Core data or another owner.
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
 if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(specifier+'.ts',context);throw error;}}});
const {RemoteReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const {ReadingEntryPreparation}=await import('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
{
 const cachedRow=Object.freeze({chapterIndex:0,title:'Chapter',url:'/chapter'});
 const cachedData=Object.freeze({...scope,tocAvailable:true,chapters:Object.freeze([cachedRow])});
 const seed=Object.freeze({...scope,detailUrl:'/book',title:'Book',author:'Author'});
 const requests=[];const runtime={async request(method){requests.push(method);assert.equal(method,'cache.book.status');return {data:cachedData};},
  bookAcquisitions(){throw Error('offline cannot acquire online catalog');}};
 const real=new RemoteReadingFlowGateway(runtime),other=await real.openCachedSession(seed,()=>true);
 const Owned=productionMotionMethods(url('features/manga/MangaReadingSurface.ets'),['acquireCatalog'],{RemoteReadingFlowGateway});
 const owned=Object.assign(new Owned(),{runtime,remoteBookSeed:seed,offline:true});
 const tagged=await owned.acquireCatalog(()=>true),next=await real.openCachedSession(seed,()=>true);
 assert.equal(tagged.contentKind,'manga');assert.equal(tagged.acquisitionMode,'offline');
 assert.notEqual(tagged,other);assert.notEqual(tagged,next);assert.notEqual(tagged.entries,other.entries);
 assert.equal(other.contentKind,undefined);assert.equal(next.contentKind,undefined);
 assert.equal(cachedData.contentKind,undefined);assert.equal(seed.contentKind,undefined);
 assert.deepEqual(requests,['cache.book.status','cache.book.status','cache.book.status']);
}
console.log('PASS actual cached gateway returns fresh owned sessions; offline Surface manga tagging preserves frozen Core input, seed and other session owners');


// Ordinary shelf code must claim the exact clicked manga before selecting the
// usual reader route. No separate probe book or replacement reader is involved.
const q=new MangaOfflineNetworkProbe(scope), owner={selectMangaOfflineProbe:(...args)=>q.select(...args),mangaOfflineProbeFor:(...args)=>q.matches(...args),noteReadingPreparationIntent(){throw Error('offline cannot authorize online preparation');}};
const Index=productionMotionMethods(url('pages/Index.ets'),['openShelfBook'],{ReaderRuntimeOwner:{current:()=>owner},LOCAL_SOURCE_ID:'local'});
const index=Object.assign(new Index(),{route:'bookshelf',shelfEntryTraceAttempt:0,navigationGeneration:1,sourceDisplayName:()=>'',openRemoteBookDetail(seed,_name,_selection,resume){assert.deepEqual([seed.sourceId,seed.bookId],[scope.sourceId,scope.bookId]);assert.equal(seed.contentKind,'manga');assert.equal(resume,true);}});
index.openShelfBook({...scope,contentKind:'manga',title:'漫画'});assert.equal(snap(q).state,'active');
console.log('PASS actual ordinary shelf click claims exact manga and enters existing resume route without authorizing network preparation');
for(const mode of ['offline','reading']) {
 const target={sourceId:'native-source-selection',bookId:'native-book-selection'};
 const q=new MangaOfflineNetworkProbe(undefined,()=>{},mode,true),intents=[],routes=[];
 const owner={selectMangaOfflineProbe:(...args)=>q.select(...args),mangaOfflineProbeFor:(...args)=>q.matches(...args),
  noteReadingPreparationIntent:(...args)=>intents.push(args)};
 const Index=productionMotionMethods(url('pages/Index.ets'),['openShelfBook'],{ReaderRuntimeOwner:{current:()=>owner},LOCAL_SOURCE_ID:'local'});
 const index=Object.assign(new Index(),{route:'bookshelf',shelfEntryTraceAttempt:0,navigationGeneration:1,sourceDisplayName:()=>'',
  openRemoteBookDetail(seed,_name,_selection,resume){routes.push(seed);assert.equal(resume,true);}});
 assert.equal(snap(q).identityBound,false);index.openShelfBook({...target,contentKind:'manga',title:'Native manga'});
 assert.equal(snap(q).state,'active');assert.equal(snap(q).identityBound,true);assert.equal(routes[0].contentKind,'manga');
 assert.deepEqual([routes[0].sourceId,routes[0].bookId],[target.sourceId,target.bookId]);
 assert.deepEqual(intents,mode==='reading'?[[target.sourceId,target.bookId]]:[], 'normal online preparation is preserved only for reading mode');
 index.openShelfBook({...target,bookId:'next-book',contentKind:'manga'});
 assert.equal(snap(q).state,'released');assert.equal(q.matches(target.sourceId,'next-book'),false);
 index.openShelfBook({...target,contentKind:'manga'});assert.equal(snap(q).state,'released','subsequent normal UI clicks cannot rearm the cold probe');
}
console.log('PASS actual normal Index shelf selection binds Native identity once; ordinary reading keeps preparation and offline blocks only selected target');


// Installed official SDK and actual vendored Core SDK types validate the new
// Want/parser + send/wait seam. This is not a substitute for an ArkTS/HAP gate.
if (process.env.READER_SKIP_PROBE_SDK_CHECK !== '1') {
  const require=createRequire(import.meta.url), sdk=process.env.READER_ETS_LOADER_ROOT??
    '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const ts=require(`${sdk}/node_modules/typescript`),sdkRoot=`${sdk}/../..`;
  const ownerSource=readFileSync(url('app/ReaderRuntimeOwner.ts'),'utf8');
  const tree=ts.createSourceFile('Owner.ts',ownerSource,ts.ScriptTarget.Latest,true);
  const ownerClass=tree.statements.find(n=>n.name?.getText(tree)==='ReaderRuntimeOwner');
  const requestMethod=ownerClass.members.find(n=>n.name?.getText(tree)==='requestDirect').getText(tree);
  const virtualPath=url('app/MangaOfflineProbeSdkCheck.ts').pathname;
  // The source gate runs before the HAP pipeline installs generated oh_modules.
  // Use the tracked, Native-sync vendored SDK for this type seam so a fresh
  // isolated worktree remains reproducible; oh_modules is only a build output.
  const coreSdk=new URL('../entry/vendor/core-harmony/sdk/reader_core',import.meta.url).pathname;
  const text=`import type {JsonObject, ReaderCoreRuntime, ReaderCoreResultEvent, RequestOptions} from '${coreSdk}';
import { BookRequestNotDispatchedError as ReaderCoreNotDispatchedError, type BookRequestOptions } from '${url('app/BookRequestScheduler').pathname}';
import { readerRuleMutationEffects } from '${url('app/ReaderRuleMutationEffects').pathname}';
import type {MangaPlatformObservation, MangaBodyDiagnosticState} from '${new URL('../entry/src/main/ets/app/MangaPlatformObservation',import.meta.url).pathname}';
import Want from '@ohos.app.ability.Want';
import {hilog} from '@kit.PerformanceAnalysisKit';
${readFileSync(url('app/MangaOfflineNetworkProbe.ts'),'utf8').replace(/^import .*?;\n/gm,'')}
${readFileSync(url('app/ReaderControlVerificationLaunch.ts'),'utf8').replace(/^import .*?;\n/gm,'')}
declare const LOG_DOMAIN:number,DEFAULT_CORE_REQUEST_TIMEOUT_MS:number;
declare function coreAdmissionFailureSummary(error:unknown,method:string):string|undefined;
declare function httpResponseFailureSummary(error:unknown):string|undefined;
function coldWant(want:Want):MangaOfflineProbeScope|undefined{return readerMangaOfflineProbeScope(true,'debug',
want.parameters?.readerMangaOfflineProbe,want.parameters?.readerMangaOfflineSourceId,want.parameters?.readerMangaOfflineBookId);}
function selectedColdWant(want:Want):MangaProbeSelectionMode|undefined{return readerMangaProbeSelectionMode(true,'debug',
want.parameters?.readerMangaOfflineProbeSelectManga,want.parameters?.readerMangaReadingProbeSelectManga,
[want.parameters?.readerMangaOfflineProbe,want.parameters?.readerMangaReadingProbe,want.parameters?.readerControlMotionVerification,
want.parameters?.readerOpenSourcePilot,want.parameters?.readerEventLoopProbe,want.parameters?.readerDisableOptionalEntryMemory]);}
declare const MangaChapterPreparationCoordinator: {forRuntime(owner:object):{close():Promise<void>}};
class RuntimeSeam {
private state:'new'|'starting'|'ready'|'closing'|'closed'='ready';
private mangaImageTail:Promise<void>=Promise.resolve();
private downloadStorageGateway:{waitForActiveMutation():Promise<void>}|undefined;
private mangaDisplaySessions:Map<number,{current:()=>boolean}>=new Map();
endMangaDisplaySession(sessionId:number):void{}
private readingImageDiskCache:{withMangaStorageRestore<T>(restore:()=>Promise<T>):Promise<T>;
maintainMangaStorage(reason:'clear',scope?:{sourceId:string;bookId:string}):Promise<void>;
clearMangaRebuildableCache(scope?:{sourceId:string;bookId:string}):Promise<{deletedBytes:number;deletedFiles:number}>};
private preparationIntentEpoch=0;private runtime:ReaderCoreRuntime|undefined;private mangaOfflineProbe:MangaOfflineNetworkProbe|undefined;
private async start():Promise<void>{}private wakeReadingPreparations():void{}
private readingEntryPreparations():{beginRequest(method:string,params:JsonObject):boolean;finishRequest(method:string,params:JsonObject):void;invalidateCachedChapters(chapters:{sourceId:string;bookId:string;chapterIndex:number}[]):void}{throw Error();}
${requestMethod}
}`;
  const options={noEmit:true,skipLibCheck:true,moduleResolution:ts.ModuleResolutionKind.NodeJs,target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.ESNext,types:[],baseUrl:'/',paths:{'@reader/core-harmony':[`${coreSdk}.ts`],
      '@ohos.*':[`${sdkRoot}/api/@ohos.*.d.ts`],'@kit.*':[`${sdkRoot}/kits/@kit.*.d.ts`]}};
  const roots=readdirSync(`${sdk}/declarations`).filter(n=>n.endsWith('.d.ts')).map(n=>`${sdk}/declarations/${n}`);
  function errors(source){const host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host);
    host.getSourceFile=(path,...args)=>path===virtualPath?ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true):get(path,...args);
    return ts.getPreEmitDiagnostics(ts.createProgram([virtualPath,...roots],options,host))
      .filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'));}
  assert.deepEqual(errors(text),[],'actual cold Want and production request method match installed official and Core SDK types');
  assert.ok(errors(text.replace('runtime.waitForResult(requestId,','runtime.waitForResult("wrong-id",')).length>0,
    'SDK counterfactual rejects an invalid Host ownership id');
console.log('PASS installed SDK Want and actual Core SDK send/wait types, with invalid request-id counterfactual; no device/Native result claimed');
  // The TS typechecker accepts a nested conditional object which the installed
  // bytecode frontend rejects. Exercise that official frontend on the actual
  // complete production module as well; parse-only neither links nor runs it.
  const frontend=`${sdk}/bin/ark/build-mac/bin/es2abc`;
  const parse=path=>spawnSync(frontend,['--target-api-version','23','--module','--parse-only',path],{encoding:'utf8'});
  for(const path of ['app/ReaderRuntimeOwner.ts','app/MangaOfflineNetworkProbe.ts','app/ReaderControlVerificationLaunch.ts']) {
    const actualParse=parse(url(path).pathname);
    assert.equal(actualParse.status,0,actualParse.stderr||actualParse.stdout||String(actualParse.error));
  }
  const invalidDir=nodeFs.mkdtempSync(join(tmpdir(),'reader-manga-owner-frontend-'));
  try {
    const entryPath=url('entryability/EntryAbility.ets').pathname;
    const etsOptions=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
    const ui=require(`${sdk}/lib/process_ui_syntax.js`);
    const entryTree=ts.createSourceFile(entryPath,readFileSync(entryPath,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,etsOptions);
    assert.deepEqual(entryTree.parseDiagnostics,[],'actual Ability ETS parses with official SDK');
    const transformed=ts.transform(entryTree,[ui.processUISyntax(null,true)],etsOptions);
    const emitted=join(invalidDir,'ActualEntry.ts');nodeFs.writeFileSync(emitted,ts.createPrinter().printFile(transformed.transformed[0]));transformed.dispose();
    assert.deepEqual(ui.transformLog.errors,[],'actual Ability ETS transform must have no diagnostics');
    const abilityParse=parse(emitted);assert.equal(abilityParse.status,0,abilityParse.stderr||abilityParse.stdout||String(abilityParse.error));
    const invalid=join(invalidDir,'invalid.ts');nodeFs.writeFileSync(invalid,'export const invalid = (;\n');
    assert.notEqual(parse(invalid).status,0,'official frontend must reject invalid syntax');
  } finally {nodeFs.rmSync(invalidDir,{recursive:true,force:true});}
  console.log('PASS actual Owner/Probe/Launch and official transformed Entry es2abc parse-only frontend and invalid-syntax control; no HAP/runtime result claimed');
}

{
 const q=new MangaOfflineNetworkProbe(scope,()=>{},'reading');q.track(400);
 assert.doesNotThrow(()=>q.beforeCoreHttp(400),'online observer must allow real Core HTTP');
 assert.doesNotThrow(()=>q.beforeImageHttp(400),'online observer must allow real image HTTP');
 assert.equal(q.matches(scope.sourceId,scope.bookId),false,'observer cannot route normal reading into offline mode');
 assert.equal(q.protectsAutomaticCatalog(scope.sourceId,scope.bookId),false,'observer cannot suppress normal catalogs');
}
console.log('PASS reading observer counts real HTTP without offline routing or catalog protection');

for(const debug of [true,false,1,'true'])for(const mode of ['debug','release','debug '])for(const enabled of [true,false,undefined,'true',1]) {
 assert.equal(readerMangaReadingProbeScope(debug,mode,enabled,scope.sourceId,scope.bookId)!==undefined,debug===true&&mode==='debug'&&enabled===true);
}
for(const bad of [undefined,{},'', ' x','x\n','x'.repeat(8193)])assert.equal(readerMangaReadingProbeScope(true,'debug',true,bad,scope.bookId),undefined);
assert.equal(readerMangaReadingProbeScope(true,'debug',true,scope.sourceId,scope.bookId,true),undefined);
assert.equal(readerMangaOfflineProbeScope(true,'debug',true,scope.sourceId,scope.bookId,true),undefined);
for(const other of [false,undefined,'true',1])assert.notEqual(readerMangaReadingProbeScope(true,'debug',true,scope.sourceId,scope.bookId,other),undefined);
{
 const q=new MangaOfflineNetworkProbe(scope,()=>{},'reading'),{owner,calls}=ownerFixture(q);q.select(scope.sourceId,scope.bookId,true);
 const cancelled=()=>false,options={timeoutMs:9876,pollMs:2,shouldCancel:cancelled,hostRequest:()=>{}};
 owner.runtime.waitForResult=async(id,value)=>{assert.equal(value,options,'observer preserves the original SDK options object');q.release('background');assert.equal(value.shouldCancel(),false);q.beforeCoreHttp(id);q.beforeImageHttp(id);return {requestId:id,data:{ok:true}};};
 assert.equal((await owner.requestDirect('manga.resource.prepare',{chapter:scope},options)).data.ok,true);
 assert.equal(snap(q).coreHttpAttempts,0);assert.equal(snap(q).imageHttpAttempts,0);assert.equal(q.current(101),true);
 await owner.requestDirect('manga.resource.prepare',{chapter:scope},options);assert.equal(calls.at(-1)[0],'ordinary');
}
{
 const q=new MangaOfflineNetworkProbe(scope,()=>{},'reading'),{owner,calls}=ownerFixture(q);q.select(scope.sourceId,scope.bookId,true);
 await owner.requestDirect('book.toc',{...scope,bookId:'different'});await owner.requestDirect('book.toc',{...scope,sourceId:'different'});
 await owner.requestDirect('book.toc',{...scope,contentKind:'text'});assert.equal(calls.filter(call=>call[0]==='send').length,0);
 let cancel=false;const original=()=>cancel;owner.runtime.waitForResult=async(_id,options)=>{assert.equal(options.shouldCancel,original);assert.equal(options.shouldCancel(),false);cancel=true;assert.equal(options.shouldCancel(),true);return {data:{}};};
 await owner.requestDirect('book.toc',scope,{shouldCancel:original});
}
{
 const q=new MangaOfflineNetworkProbe(scope,()=>{},'reading'),{owner}=ownerFixture(q);q.select(scope.sourceId,scope.bookId,true);let completed=0;
 owner.runtime.waitForResult=async(id,options)=>{assert.equal(options.shouldCancel,undefined);q.beforeCoreHttp(id);completed++;return {requestId:id,data:{}};};
 owner.runtime.request=async()=>{completed++;return {data:{}};};
 for(let index=0;index<260;index++)await owner.requestDirect('manga.resource.prepare',{chapter:scope});
 assert.equal(completed,260,'sampling capacity cannot reject normal Core business');assert.equal(snap(q).claimedRequests,260);
 assert.equal(snap(q).coverageIncomplete,false,'the former 256-id limit must not truncate a full chapter observation');
 assert.equal(snap(q).coreHttpAttempts,260);assert.equal(snap(q).capacityRejections,0);
 assert.deepEqual(snap(q).requestMethods,{'manga.resource.prepare':260});
 const attempts=snap(q).coreHttpAttempts;q.beforeCoreHttp(101);assert.equal(snap(q).coreHttpAttempts,attempts+1,'settled exact-id tombstones still count late HTTP within the active reading window');
}
for(const mode of ['reading','offline']) {
 const q=new MangaOfflineNetworkProbe(scope,()=>{},mode),{owner,calls}=ownerFixture(q);q.select(scope.sourceId,scope.bookId,true);
 owner.runtime.waitForResult=async(id)=>{
  if(calls.at(-1)[1]==='manga.resource.prepare')q.beforeImageHttp(id);
  return {requestId:id,data:{}};
 };
 for(const [phase,chapterId]of ['chapter-A','chapter-B','chapter-A'].entries()) {
  await owner.requestDirect('manga.entry.get',{...scope,chapterIndex:phase===1?1:0});
  for(let page=0;page<24;page++) {
   const chapter={...scope,chapterId};
   // A full 24-page cross-chapter window includes local admission/inventory,
   // read clock and progress RPCs as well as any new original's transfer.
   await owner.requestDirect('manga.cache.classify',{chapter});
   await owner.requestDirect('manga.cache.classify',{chapter});
   await owner.requestDirect('manga.cache.recordRead',{chapter});
   await owner.requestDirect('reading.progress.update',{location:{kind:'manga',chapter}});
   if(mode==='reading'&&phase===1)await owner.requestDirect('manga.resource.prepare',{chapter});
  }
 }
 const expected=mode==='reading'?315:291,value=snap(q);
 assert.equal(value.claimedRequests,expected);assert.equal(value.pendingRequests,0);assert.equal(value.coverageIncomplete,false);
 assert.equal(value.requestLimit,MANGA_PROBE_REQUEST_LIMIT);assert.equal(value.coreHttpAttempts,0);
 assert.equal(value.imageHttpAttempts,mode==='reading'?24:0);
 assert.equal(value.requestMethods['manga.entry.get'],3);assert.equal(value.requestMethods['manga.cache.classify'],144);
 assert.equal(value.requestMethods['manga.cache.recordRead'],72);assert.equal(value.requestMethods['reading.progress.update'],72);
 assert.equal(Object.values(value.requestMethods).reduce((sum,count)=>sum+count,0),expected);
 assert.equal(calls.filter(call=>call[0]==='ordinary').length,0,'all >256 owned RPCs retain exact-id coverage');
 if(mode==='offline') {
  assert.throws(()=>q.beforeCoreHttp(101),/HTTP_BLOCKED/);q.release('reader-left');
  assert.throws(()=>q.beforeImageHttp(101),/IMAGE_HTTP_BLOCKED/,'old offline ids remain blocked after the cross-chapter window exits');
 } else {
  q.beforeImageHttp(101);assert.equal(snap(q).imageHttpAttempts,25,'the earliest settled id is still observed after >256 RPCs');
  q.release('reader-left');q.beforeImageHttp(101);assert.equal(snap(q).imageHttpAttempts,25,'released online observation does not change or count late business');
 }
}
{
 const q=new MangaOfflineNetworkProbe(scope,()=>{},'reading'),{owner}=ownerFixture(q);q.select(scope.sourceId,scope.bookId,true);let completed=0;
 owner.runtime.waitForResult=async(id)=>{q.beforeCoreHttp(id);completed++;return {requestId:id,data:{}};};
 owner.runtime.request=async()=>{completed++;return {data:{}};};
 for(let index=0;index<MANGA_PROBE_REQUEST_LIMIT+4;index++)await owner.requestDirect('manga.resource.prepare',{chapter:scope});
 assert.equal(completed,MANGA_PROBE_REQUEST_LIMIT+4,'exhausting diagnostic capacity still cannot reject normal Core business');
 assert.equal(snap(q).claimedRequests,MANGA_PROBE_REQUEST_LIMIT);assert.equal(snap(q).coverageIncomplete,true);
 assert.equal(snap(q).reason,'sampling-capacity');assert.equal(snap(q).capacityRejections,0);
 assert.deepEqual(snap(q).requestMethods,{'manga.resource.prepare':MANGA_PROBE_REQUEST_LIMIT});
 const attempts=snap(q).coreHttpAttempts;q.beforeCoreHttp(101);assert.equal(snap(q).coreHttpAttempts,attempts,'sampling stops explicitly after the bounded capacity is exhausted');
}
console.log('PASS controlled 24-page A/B/A RPC windows beyond 256, exact bounded method counts without caller text, oldest/newest late-id fences and 8192-id capacity without reading business rejection');
{
 const q=new MangaOfflineNetworkProbe(scope,()=>{},'reading'),r=new Registry();r.mangaOfflineProbe=q;r.responseAssetBridge={};q.select(scope.sourceId,scope.bookId,true);q.track(700);
 const owned=r.createCapabilityRouter(),coreBefore=coreFetches,imageBefore=byteFetches;
 await owned.route({capability:'http.execute',requestId:700,params:{}});await owned.route({capability:'http.execute',requestId:700,params:{responseAsset:true}});
 await owned.route({capability:'manga.resource.transfer',requestId:700,params:{request:{url:'https://fixture.invalid/actual-online'}}});
 assert.equal(coreFetches-coreBefore,2);assert.equal(byteFetches-imageBefore,1);assert.equal(snap(q).coreHttpAttempts,2);assert.equal(snap(q).imageHttpAttempts,1);
 const old=decodeTransport;q.release('reader-left');q.settle(700);await old.fetch({url:'https://fixture.invalid/actual-late'},()=>true,16777216);
 assert.equal(byteFetches-imageBefore,2);assert.equal(snap(q).imageHttpAttempts,1,'released observer ids neither block nor count late business');
}
console.log('PASS reading cold/debug/conflict admission, unchanged SDK cancel/options, exact book/text exclusion, capacity coverage without rejection, actual Core/image HTTP and late release continuity');

// Run the actual Body decode/retention and Runtime image lane together. Only
// Harmony native codec and filesystem ports are replaced; no cached-hit,
// source/pixel/packer ownership, diagnostic callback or observer algorithm is
// copied into this fixture. This proves Host calls, not native/compositor cost.
const readingDirectory=await mkdtemp(join(tmpdir(),'reader-manga-reading-observer-'));
try {
 const fs={OpenMode:{CREATE:1,READ_WRITE:2,TRUNC:4},
  async access(path){return nodeFs.existsSync(path);},async stat(path){return nodeFs.statSync(path);},
  async listFile(path){return nodeFs.readdirSync(path);},async mkdir(path){nodeFs.mkdirSync(path,{recursive:true});},
  async open(path){return {fd:nodeFs.openSync(path,'w+')};},async write(fd,value){return nodeFs.writeSync(fd,new Uint8Array(value));},
  async close(file){nodeFs.closeSync(file.fd);},async rename(a,b){nodeFs.renameSync(a,b);},async unlink(path){nodeFs.unlinkSync(path);},
  AtomicFile:class{constructor(path){this.path=path;}readFully(){const b=nodeFs.readFileSync(this.path);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}}};
 class LRUCache{constructor(capacity){this.capacity=capacity;this.data=new Map();}get(key){return this.data.get(key);}put(key,value){this.data.set(key,value);}remove(key){this.data.delete(key);}clear(){this.data.clear();}}
 const util={LRUCache,TextEncoder:class{encodeInto(text){return new TextEncoder().encode(text);}},TextDecoder:class{decodeWithStream(bytes){return new TextDecoder().decode(bytes);}}};
 let hashes=0,atomicReads=0,codecHeight=2;
 const cryptoFramework={createMd(){hashes++;const hash=createHash('sha256');return {async update({data}){hash.update(data);},async digest(){return {data:new Uint8Array(hash.digest())};}};}};
 const encoded=new Uint8Array([0x89,0x50,0x4e,0x47,1,2,3,4]);let nativeSources=0,nativePixels=0,nativePackers=0;
 const image={PixelMapFormat:{RGBA_8888:3},DecodingDynamicRange:{SDR:1},CropAndScaleStrategy:{CROP_FIRST:2},
  createImageSource(){nativeSources++;return {async getFrameCount(){return 1;},async getImageInfo(){return {size:{width:3,height:codecHeight},mimeType:'image/png'};},
   async createPixelMap(options){nativePixels++;const size=options.desiredSize??options.desiredRegion?.size??{width:3,height:codecHeight};return {async getImageInfo(){return {size,pixelFormat:3};},getBytesNumberPerRow(){return size.width*4;},getPixelBytesNumber(){return size.width*size.height*4;},async release(){}};},async release(){}};},
  createImagePacker(){nativePackers++;return {async packToFile(_pixels,fd){nodeFs.writeSync(fd,encoded);},async release(){}};}};
 const loadClass=(name,dependencies)=>new Function(...Object.keys(dependencies),
  stripTypeScriptTypes(readFileSync(url(`app/${name}.ts`),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''))+`;return ${name};`)(...Object.values(dependencies));
 const atomicReader=createMangaAtomicPayloadReaderFixture(fs);
 const readMangaAtomicPayload=(...args)=>{atomicReads++;return atomicReader(...args);};
 const Retention=loadClass('MangaDisplayRetention',{fs,util,readMangaAtomicPayload});
 const FullBody=loadClass('ReadingBodyImageHost',{fs,util,cryptoFramework,image,MangaDisplayRetention:Retention,HttpExecuteHost,
  hilog:{warn(){}},readingImageHttpError:()=>Error('HTTP failure')});
 const makeBody=directory=>{const body=new FullBody();body.configureMangaDisplayCache(directory);body.setMangaDisplayReserve(async()=>({release(){}}));
  body.setMangaMetadataInspector(async(bytes,sha256)=>({status:'absent',orientation:null,sha256,bytes:bytes.length,
   decodeProfile:{format:'png',encodedWidth:3,encodedHeight:codecHeight,allocationClass:'scanline'}}));return body;};
 const makeReadingOwner=(body,probe)=>{
  const originals=new Map(),holds=new Map(),pending=new Map();let id=1000,httpCalls=0,originalReads=0;
  const BodyPort={instance:body};
  const Registry=productionMotionMethods(url('app/ReaderHostRegistry.ts'),['createCapabilityRouter'],{
   CapabilityRouter:Router,ReadingBodyImageHost:BodyPort,HttpExecuteHost,MangaImageGraphicsHost:{instance:{}},MangaImageMetadataHost:{instance:{handle:async()=>({}),cancel(){}}},
   MangaImageDecodeHost:{instance:{handle(event,_bridge,transport){return transport.fetch(event.params.request,()=>true,16777216);},cancel(){}}}});
  const registry=new Registry();registry.mangaOfflineProbe=probe;registry.responseAssetBridge={};const router=registry.createCapabilityRouter();
  const Runtime=productionMotionMethods(url('app/ReaderRuntimeOwner.ts'),['requestDirect','loadReadingImage','loadReadingImageOwned','prefetchReadingImage',
   'prefetchReadingImageOwned','runMangaImageWork','drainMangaImageWork','mangaStorageChapter','prepareReadingImageBytes','assertReadingImageCurrent','admitReadingImage','releaseReadingImage',
   'bindMangaReadingProbe','detachMangaReadingProbe','observeMangaReadingImageWork','captureReadingContentValidity','captureMangaImageContentValidity',
   'mangaDisplaySessions','nextMangaDisplaySession','beginMangaDisplaySession','endMangaDisplaySession',
   'tryAcquireMangaPreparedImage','mangaDisplaySessionKey','publishMangaPreparedImage','clearOfflineBookImages','closeRuntime'],{
   ReadingBodyImageHost:BodyPort,DEFAULT_CORE_REQUEST_TIMEOUT_MS:30000,coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined,
   MangaImageDecodeHost:{instance:{async prepare(params,request,current){assert.equal(current(),true);return (await request(params)).data.bytes;}}},
   MangaChapterPreparationCoordinator:{forRuntime(){return {close:async()=>{}};}},hilog:{error(){},warn(){}},LOG_DOMAIN:0});
  const owner=new Runtime();Object.assign(owner,{state:'ready',mangaOfflineProbe:probe,mangaImageTail:Promise.resolve(),mangaImagePending:0,mangaImageQueue:[],mangaImageActive:false,mangaImageUrgentStreak:0,mangaReadingProbeForeignImages:0});
  owner.start=async()=>{};owner.wakeReadingPreparations=()=>{};
  const preparations=new ReadingEntryPreparation(owner,false);owner.readingEntryPreparations=()=>preparations;
  owner.readingImageCacheIdentity=(sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl)=>({sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl});
  owner.request=(method,params,options)=>owner.requestDirect(method,params,options);
  const key=identity=>`${identity.bookId}:${identity.baseUrl}:${identity.resourceRef}`;
  owner.readingImageDiskCache={captureValidity(_s,_b,current){return ()=>owner.state==='ready'&&current?.()!==false;},
   async loadResource(identity,current){originalReads++;assert.equal(current(),true);return originals.get(key(identity));},
   async storeResource(identity,bytes,current){await holds.get(key(identity))?.promise;assert.equal(current(),true);originals.set(key(identity),new Uint8Array(bytes));},
   async removeResource(identity){originals.delete(key(identity));},async clearBook(){originals.clear();}};
  const transfer=async(requestId,params)=>{httpCalls++;const fetched=await router.route({capability:'manga.resource.transfer',requestId,params:{request:{url:'https://fixture.invalid/actual-image'}}});
   assert.ok(fetched.length>0);return {requestId,data:{bytes:encoded}};};
  owner.runtime={send(_method,params){pending.set(++id,params);return id;},async waitForResult(requestId){return transfer(requestId,pending.get(requestId));},async request(_method,params){return transfer(++id,params);}};
  if(probe?.mode==='reading')owner.bindMangaReadingProbe();
  const load=(chapter,ref,bookId=scope.bookId)=>owner.loadReadingImage(scope.sourceId,bookId,0,'v',`image-${ref}`,chapter,true,()=>true,ref,0,'rules',false,'bytes-v1');
  const prefetch=(chapter,ref)=>owner.prefetchReadingImage({...scope,chapterIndex:0,contentVersion:'v',imageUrl:`image-${ref}`,baseUrl:chapter,resourceRef:ref,mangaDecodeRevision:'bytes-v1'},()=>true,'rules',true,'background');
  return {owner,originals,holds,load,prefetch,key,preparations,http:()=>httpCalls,originalReads:()=>originalReads};
 };
 {
  codecHeight=4097;
  const body=makeBody(`${readingDirectory}/whole-chapter`),f=makeReadingOwner(body);
  const {MangaResourceGateway:Gateway}=await import('../entry/src/main/ets/features/manga/MangaResourceGateway.ts');
  const Scope=productionMotionMethods(url('features/manga/MangaChapterPreparationCoordinator.ts'),['scope']);
  const chapter={chapterIndex:7,manifest:{chapter:{...scope,chapterId:'whole-chapter'},manifestVersion:'v',sourceRuleVersion:'rules',decodeRevision:'bytes-v1'}};
  const resourceScope=new Scope().scope(chapter),resources=new Gateway(f.owner);
  resources.beginDisplaySession(resourceScope,()=>true,false);
  const pages=Array.from({length:24},(_,i)=>({url:`image-${i}`,resourceRef:`ref-${i}`}));
  for(const page of pages)await resources.prefetchPage(resourceScope,page,()=>true,true,'chapter');
  await f.owner.mangaImageTail;
  const session=f.owner.mangaDisplaySessions.values().next().value;
  assert.equal(session.aliases.size,24,'every prepared chapter resource is retained beyond the former eight-tile window');
  assert.equal(session.files.size,3,'identical prepared files share exactly one session owner lease');
  assert.ok([...session.files.values()].every(payload=>payload.pixelMap===undefined));
  assert.deepEqual([...body.displayFileReferences.values()],[1,1,1],'prefetch callers released; each display has its single session lease');
  const before=[f.http(),f.originalReads(),atomicReads,hashes,nativeSources,nativePixels,nativePackers];
  for(const page of [...pages,...pages.toReversed()])for(const position of [0,2048/4097,4096/4097,1]) {
   const payload=resources.tryAcquirePage(resourceScope,page,()=>true,position,false);
   assert.ok(payload && !(payload instanceof Promise),'prepared foreground lookup is synchronous before any pending row');
   assert.equal(payload.regionY,position===0?0:position===2048/4097?2048:4096);
   resources.release(payload);
  }
  const boundary=resources.tryAcquirePage(resourceScope,pages[0],()=>true,(2048-0.0000003)/4097,false);
  assert.equal(boundary.regionY,2048,'round-tripped position uses Body tolerance at the next-tile boundary');resources.release(boundary);
  const laneGate=deferred(),busy=f.owner.runMangaImageWork(()=>true,async()=>{await laneGate.promise;},'background');
  let settled=false;
  const fastLoad=resources.loadPage(resourceScope,pages[23],false,()=>true,4096/4097,false).then(payload=>{settled=true;return payload;});
  await tick();assert.equal(settled,true,'prepared load does not wait behind an occupied allocation lane');
  const fast=await fastLoad;resources.release(fast);laneGate.resolve();await busy;await f.owner.mangaImageTail;
  assert.deepEqual([f.http(),f.originalReads(),atomicReads,hashes,nativeSources,nativePixels,nativePackers],before,
   'whole chapter forward/backward reuse performs zero original/display reads, hashes, HTTP, native source/pixel/packer work');
  assert.equal(f.owner.mangaImagePending,0,'prepared load skips the allocation lane');
  assert.throws(()=>resources.tryAcquirePage({...resourceScope,chapterIndex:-1},pages[0],()=>true),/IDENTITY/);
  assert.throws(()=>resources.tryAcquirePage(resourceScope,{...pages[0],requestRule:''},()=>true),/RULE/);
  assert.throws(()=>resources.tryAcquirePage(resourceScope,{...pages[0],headers:{Referer:'x'}},()=>true),/RULE_REQUIRED/);
  const changedUrl=resources.tryAcquirePage(resourceScope,{...pages[0],url:'renewed-url'},()=>true);
  assert.ok(changedUrl,'immutable manifest resourceRef, not a renewed transport URL, owns prepared identity');resources.release(changedUrl);
  for(const [name,value]of [['sourceId','other'],['bookId','other'],['chapterUrl','other'],['contentVersion','other'],['sourceRuleVersion','other'],['decodeRevision','identity-v1']])
   assert.equal(resources.tryAcquirePage({...resourceScope,[name]:value},pages[0],()=>true),undefined,`${name} never aliases the active chapter`);
  assert.equal(resources.tryAcquirePage(resourceScope,pages[0],()=>true,0,true),undefined,'preview mode owns a distinct presentation');
  resources.endDisplaySession();resources.endDisplaySession();
  assert.equal(f.owner.mangaDisplaySessions.size,0);assert.equal(body.displayFileReferences.size,0,'chapter close releases all owner and caller leases');
  for(const method of ['book.detail','book.toc','bookshelf.add']) {
   resources.beginDisplaySession(resourceScope,()=>true,false);
   await resources.prefetchPage(resourceScope,pages[0],()=>true,false,'chapter');
   const ownerLeases=[...body.displayFileReferences.values()];
   const ioBefore=[f.http(),f.originalReads(),atomicReads,hashes,nativeSources,nativePixels,nativePackers];
   const params={sourceId:scope.sourceId,bookId:scope.bookId};
   f.preparations.beginRequest(method,params);
   const during=resources.tryAcquirePage(resourceScope,pages[0],()=>true);
   assert.ok(during && !(during instanceof Promise),`${method} preserves synchronous prepared acquisition`);
   resources.release(during);
   assert.deepEqual([...body.displayFileReferences.values()],ownerLeases,'metadata keeps the existing owner lease exactly once');
   f.preparations.finishRequest(method,params);
   const after=resources.tryAcquirePage(resourceScope,pages[0],()=>true);
   assert.ok(after,`${method} does not expire immutable manga display after completion`);
   resources.release(after);
   assert.deepEqual([f.http(),f.originalReads(),atomicReads,hashes,nativeSources,nativePixels,nativePackers],ioBefore,
     'metadata refresh cannot cause a network/read/hash/decode/allocation on prepared return');
   resources.endDisplaySession();
   assert.equal(body.displayFileReferences.size,0,'ending this exact session releases its final owner lease');
  }
  resources.beginDisplaySession(resourceScope,()=>true,false);await resources.prefetchPage(resourceScope,pages[0],()=>true,false,'chapter');
  f.preparations.beginRequest('source.update',{sourceId:scope.sourceId});f.preparations.finishRequest('source.update',{sourceId:scope.sourceId});
  assert.equal(resources.tryAcquirePage(resourceScope,pages[0],()=>true),undefined,'real source/content mutation revokes prepared display aliases');
  assert.equal(body.displayFileReferences.size,0);
  resources.endDisplaySession();
  for(const mutation of ['runtime.storage.restore','cache.clear']) {
   resources.beginDisplaySession(resourceScope,()=>true,false);await resources.prefetchPage(resourceScope,pages[0],()=>true,false,'chapter');
   const params=mutation==='cache.clear'?{scope:'book',sourceId:scope.sourceId,bookId:scope.bookId}:{};
   f.preparations.beginRequest(mutation,params);f.preparations.finishRequest(mutation,params);
   assert.equal(resources.tryAcquirePage(resourceScope,pages[0],()=>true),undefined,`${mutation} revokes captured alias ownership`);
   assert.equal(body.displayFileReferences.size,0);resources.endDisplaySession();
  }
  resources.beginDisplaySession(resourceScope,()=>true,false);await resources.prefetchPage(resourceScope,pages[0],()=>true,false,'chapter');
  await f.owner.clearOfflineBookImages(scope.sourceId,scope.bookId,true);
  assert.equal(resources.tryAcquirePage(resourceScope,pages[0],()=>true),undefined,'direct book clear drops aliases before its storage operation');
  assert.equal(body.displayFileReferences.size,0);resources.endDisplaySession();
  resources.beginDisplaySession(resourceScope,()=>true,false);await resources.prefetchPage(resourceScope,pages[0],()=>true,true,'chapter');
  f.owner.state='closing';f.owner.runtime=undefined;f.owner.ttsHost={close:async()=>{}};
  await f.owner.closeRuntime();
  assert.equal(f.owner.mangaDisplaySessions.size,0);assert.equal(body.displayFileReferences.size,0,'real Runtime close finally drains every prepared session lease');
  body.releaseAllDisplayFiles();codecHeight=2;
  console.log('PASS actual Coordinator scope→Gateway prefetch→Runtime→Body all-region prepared publication; 24-page full return is synchronous and zero byte reads/hash/decode/lane, unique file leases, floating boundaries, descriptor/scope fences and source/close cleanup');
 }
 {
  const body=makeBody(`${readingDirectory}/reuse`),q=new MangaOfflineNetworkProbe(scope,()=>{},'reading');q.select(scope.sourceId,scope.bookId,true);
  const f=makeReadingOwner(body,q);await f.prefetch('chapter-A','A-0');await f.prefetch('chapter-A','A-1');await f.prefetch('chapter-B','B-0');
  assert.equal(f.http(),3,'first online preparation reaches the real image HTTP boundary');assert.equal(snap(q).imageHttpAttempts,3);
  const prepared=snap(q),nativeBefore=[nativeSources,nativePixels,nativePackers];
  for(const [chapter,ref]of [['chapter-A','A-0'],['chapter-A','A-1'],['chapter-B','B-0'],['chapter-A','A-0']]){const payload=await f.load(chapter,ref);f.owner.releaseReadingImage(payload.fileUri);}
  await f.owner.mangaImageTail;
  assert.equal(f.http(),3,'online A/B/A and page return use already prepared local bytes');
  assert.deepEqual([nativeSources,nativePixels,nativePackers],nativeBefore,'valid local display proofs avoid repeated processing');
  assert.equal(snap(q).bodySourceOpens,prepared.bodySourceOpens);assert.equal(snap(q).bodyPixelOpens,prepared.bodyPixelOpens);assert.equal(snap(q).bodyPackerOpens,prepared.bodyPackerOpens);
  // The two identical original resources in A share its immutable display
  // proof; the distinct B chapter owns another proof.
  assert.equal(prepared.bodySourceOpens,2);assert.equal(prepared.bodyPixelOpens,2);assert.equal(prepared.bodyPackerOpens,2);
  assert.equal(prepared.bodySourceReleases,2);assert.equal(prepared.bodyPixelReleases,2);assert.equal(prepared.bodyPackerReleases,2);
  assert.equal(snap(q).coverageIncomplete,false);assert.equal(snap(q).bodyStateScope,'process-window');
  assert.equal(snap(q).bodyProcessCurrent.leases,1,'last image-work snapshot precedes the caller releasing its returned display URI');assert.equal(snap(q).bodyObservation,'serial-target-manga-image-work');
  q.release('reader-left');assert.equal(snap(q).bodyProcessCurrent.leases,0,'release captures the process window final state');assert.equal(body.diagnosticObserver,undefined,'normal probe detach frees the existing platform diagnostic slot');
  let platformEvents=0;const platformDetach=body.attachDiagnosticObserver(()=>platformEvents++,true,'debug');f.owner.detachMangaReadingProbe();
  const old=snap(q).bodySourceOpens;await body.validateBytes(encoded,()=>true,0);assert.ok(platformEvents>0);assert.equal(snap(q).bodySourceOpens,old);
  platformDetach();body.releaseAllDisplayFiles();
  // A cold Body reads real persisted sidecar/hash facts rather than the old
  // process's retained metadata or pixels.
  const cold=makeBody(`${readingDirectory}/reuse`),coldProbe=new MangaOfflineNetworkProbe(scope,()=>{},'reading');coldProbe.select(scope.sourceId,scope.bookId,true);
  const coldOwner=makeReadingOwner(cold,coldProbe);coldOwner.originals.set(`${scope.bookId}:chapter-A:A-0`,encoded);
  const restored=await coldOwner.load('chapter-A','A-0');coldOwner.owner.releaseReadingImage(restored.fileUri);await coldOwner.owner.mangaImageTail;
  assert.equal(coldOwner.http(),0);assert.equal(snap(coldProbe).imageHttpAttempts,0);assert.equal(snap(coldProbe).bodySourceOpens,0);assert.equal(snap(coldProbe).bodyPixelOpens,0);assert.equal(snap(coldProbe).bodyPackerOpens,0);
  coldProbe.release('end');cold.releaseAllDisplayFiles();
 }
 {
  const body=makeBody(`${readingDirectory}/drain`),q=new MangaOfflineNetworkProbe(scope,()=>{},'reading');q.select(scope.sourceId,scope.bookId,true);const f=makeReadingOwner(body,q),first=deferred(),second=deferred();
  f.holds.set(`${scope.bookId}:chapter-A:A-0`,first);f.holds.set(`${scope.bookId}:chapter-B:B-0`,second);
  const a=await f.load('chapter-A','A-0');const priorScope=f.owner.mangaReadingProbeImageScope;
  assert.notEqual(priorScope,undefined,'first frame publishes while its owned byte write and observation are still live');
  const b=f.load('chapter-B','B-0');await tick();assert.equal(f.http(),1,'successor does not enter before existing owned drain');
  first.resolve();const result=await b;const successorScope=f.owner.mangaReadingProbeImageScope;
  assert.notEqual(successorScope,undefined);assert.notEqual(successorScope,priorScope,'successor receives a fresh attribution scope after the first drain');
  await tick();assert.equal(f.owner.mangaReadingProbeImageScope,successorScope,'late prior cleanup cannot remove successor scope');
  assert.equal(snap(q).coverageIncomplete,false);assert.equal(snap(q).bodySourceOpens,2);assert.equal(snap(q).bodySourceReleases,2);
  second.resolve();await f.owner.mangaImageTail;await tick();assert.equal(f.owner.mangaReadingProbeImageScope,undefined);
  f.owner.releaseReadingImage(a.fileUri);f.owner.releaseReadingImage(result.fileUri);q.release('end');body.releaseAllDisplayFiles();
 }
 {
  const body=makeBody(`${readingDirectory}/scope`),q=new MangaOfflineNetworkProbe(scope,()=>{},'reading');q.select(scope.sourceId,scope.bookId,true);const f=makeReadingOwner(body,q);
  const wrong=await f.load('chapter-other','other','wrong-book');f.owner.releaseReadingImage(wrong.fileUri);await f.owner.mangaImageTail;
  assert.equal(snap(q).bodySourceOpens,0);assert.equal(snap(q).imageHttpAttempts,0,'wrong book work is not attributed to selected target');
  const held=deferred();const work=f.owner.observeMangaReadingImageWork(scope.sourceId,scope.bookId,true,async()=>{await held.promise;return 'target';});
  assert.equal(await f.owner.observeMangaReadingImageWork(scope.sourceId,'novel',false,async()=> 'novel'),'novel');
  assert.equal(snap(q).coverageIncomplete,true);assert.equal(snap(q).reason,'body-scope-overlap');assert.equal(body.diagnosticObserver,undefined);
  held.resolve();assert.equal(await work,'target','known overlapping foreign work only stops measurement, never business');
  for(const probe of [undefined,new MangaOfflineNetworkProbe(scope),q]){f.owner.mangaOfflineProbe=probe;f.owner.mangaReadingProbeForeignImages=0;assert.equal(await f.owner.observeMangaReadingImageWork(scope.sourceId,'novel',false,async()=> 'normal'),'normal');assert.equal(f.owner.mangaReadingProbeForeignImages,0,'undefined/offline/released/incomplete probe takes the original direct path');}
  const capacityBody=makeBody(`${readingDirectory}/capacity`),capacityProbe=new MangaOfflineNetworkProbe(scope,()=>{},'reading');
  capacityProbe.select(scope.sourceId,scope.bookId,true);const capacityOwner=makeReadingOwner(capacityBody,capacityProbe);
  for(let i=0;i<260;i++)capacityProbe.track(10000+i,'manga.cache.classify');
  assert.notEqual(capacityBody.diagnosticObserver,undefined,'Body observation stays attached after the former 256-id boundary');
  const afterOldCap=await capacityOwner.load('chapter-after-old-cap','cap-0');capacityOwner.owner.releaseReadingImage(afterOldCap.fileUri);await capacityOwner.owner.mangaImageTail;
  assert.equal(snap(capacityProbe).coverageIncomplete,false);assert.equal(snap(capacityProbe).imageHttpAttempts,1);
  assert.equal(snap(capacityProbe).bodySourceOpens,1,'actual Runtime/Body work remains attributed after >256 owned RPCs');
  let syntheticId=20000;
  while(snap(capacityProbe).claimedRequests<MANGA_PROBE_REQUEST_LIMIT)capacityProbe.track(syntheticId++);
  assert.equal(capacityBody.diagnosticObserver,undefined,'coverage cap releases Body diagnostic slot without rejecting business');
  assert.equal(await capacityOwner.owner.observeMangaReadingImageWork(scope.sourceId,scope.bookId,true,async()=> 'after-cap'),'after-cap');
  capacityBody.releaseAllDisplayFiles();body.releaseAllDisplayFiles();
 }
 console.log('PASS actual Runtime/Body/persisted display proofs: online A/B/A and cold cache 0HTTP/0 repeated source-pixel-packer processing, balanced ownership, first-frame/drain scope ordering, wrong-book exclusion and observer detach/overlap/capacity without business changes');
} finally {await rm(readingDirectory,{recursive:true,force:true});}

// Execute actual cold Ability entry; warm Wants cannot rearm either probe.
for(const [debug,buildMode,parameters,expectedOffline,expectedReading,expectedSelection]of [
 [true,'debug',{readerMangaReadingProbe:true},false,true],
 [true,'debug',{readerMangaOfflineProbe:true},true,false],
 [true,'debug',{readerMangaOfflineProbe:true,readerMangaReadingProbe:true},false,false],
 [true,'debug',{readerMangaReadingProbe:'true'},false,false],
 [false,'debug',{readerMangaReadingProbe:true},false,false],
 [true,'release',{readerMangaReadingProbe:true},false,false],
 [true,'debug',{readerMangaReadingProbe:true,readerControlMotionVerification:true},false,false],
 [true,'debug',{readerMangaReadingProbe:true,readerOpenSourcePilot:true},false,false],
 [true,'debug',{readerMangaReadingProbeSelectManga:true},false,false,'reading'],
 [true,'debug',{readerMangaOfflineProbeSelectManga:true},false,false,'offline'],
 [true,'debug',{readerMangaReadingProbeSelectManga:true,readerMangaOfflineProbeSelectManga:true},false,false],
 [true,'debug',{readerMangaReadingProbeSelectManga:'true'},false,false],
 [true,'debug',{readerMangaOfflineProbeSelectManga:1},false,false],
 [false,'debug',{readerMangaReadingProbeSelectManga:true},false,false],
 [true,'release',{readerMangaOfflineProbeSelectManga:true},false,false],
 ...['readerMangaOfflineProbe','readerMangaReadingProbe','readerControlMotionVerification','readerOpenSourcePilot','readerEventLoopProbe','readerDisableOptionalEntryMemory']
  .flatMap(flag=>['readerMangaReadingProbeSelectManga','readerMangaOfflineProbeSelectManga'].map(select=>[true,'debug',{[select]:true,[flag]:true},false,false])),
 ...['readerMangaOfflineProbe','readerMangaReadingProbe'].map(flag=>[true,'debug',{[flag]:true,readerMangaReadingProbeSelectManga:true,readerMangaOfflineProbeSelectManga:true},false,false]),

]) {
 const installs=[],receives=[],owner={start:async()=>{}};
 const installAtomic=createMangaAtomicPayloadInstallerFixture({});let atomicInstalls=0;
 const Ability=productionMotionMethods(url('entryability/EntryAbility.ets'),['onCreate','onNewWant'],{
  DEBUG:debug,BUILD_MODE_NAME:buildMode,readerControlVerificationColdStartPage,readerDisableOptionalEntryMemory,readerMangaOfflineProbeScope,readerMangaReadingProbeScope,readerMangaProbeSelectionMode,
  errorMessageOf,localReadFailureSummary,
  installMangaAtomicPayloadReader(){installAtomic();atomicInstalls++;},
  ReaderMangaPlatformDiagnostic:{install:()=>undefined}, // Official adapter behavior has its focused production-module probe.
  ReaderStartupTrace:{install:()=>({mark(){},measure:(_name,run)=>Promise.resolve().then(run)})},readerMotionNowMs:()=>0,
  readerEventLoopProbeEnabled:()=>false,AppStorage:{setOrCreate(){}},WebDavCredentialStore:{instance:{attachContext(){},loadBookshelfViewMode:async()=>null}},prepareReaderShelfFonts:async()=>{},
  ReaderRuntimeOwner:{install(...args){assert.equal(atomicInstalls,1,'production atomic reader binds synchronously before RuntimeOwner construction');installs.push(args);return owner;}},ReaderThemeHost:{install:async()=>{},setRecoveryBarrier(){}},
  SyncGateway:class{recoverInterruptedRestore=async()=>false;},LocalConfigurationReset:{recover:async()=>false},ReaderSettingsGateway:class{loadAfterConfigurationRecovery=async()=>{};},
  ReaderSystemFileOpenHost:{install(){},receive(want){receives.push(want);}},ConfigurationConstant:{ColorMode:{COLOR_MODE_DARK:1}},hilog:{info(){},error(){}},DOMAIN:0});
 const ability=new Ability();ability.context={config:{colorMode:0}};ability.prepareSelectedReadingFont=async()=>{};
 const selectionFlag=Object.keys(parameters).some(key=>key.endsWith('SelectManga'));
 const want={parameters:selectionFlag?parameters:{...parameters,readerMangaOfflineSourceId:scope.sourceId,readerMangaOfflineBookId:scope.bookId}};
 ability.onCreate(want,{});await ability.recoveryReady;
 assert.equal(installs.length,1);assert.equal(installs[0][4],expectedSelection);assert.equal(installs[0][2]!==undefined,expectedOffline);assert.equal(installs[0][3]!==undefined,expectedReading);
 if(expectedReading)assert.deepEqual(installs[0][3],scope);if(expectedOffline)assert.deepEqual(installs[0][2],scope);
 ability.onNewWant({parameters:{readerMangaReadingProbe:true,readerMangaOfflineProbe:true,readerMangaReadingProbeSelectManga:true,readerMangaOfflineProbeSelectManga:true}},{});assert.equal(installs.length,1);assert.equal(receives.length,2);assert.equal(atomicInstalls,1,'warm Want never rebinds the atomic reader');
 if(parameters.readerMangaOfflineProbe===true&&parameters.readerMangaReadingProbe===true)assert.equal(ability.coldStartPage,'pages/Index','conflicting true probes keep ordinary Index/online routing');
}
console.log('PASS actual EntryAbility cold debug/strict primitive/conflict admission and unchanged warm Want routing; diagnostic flags never persist or replace normal reader flow');

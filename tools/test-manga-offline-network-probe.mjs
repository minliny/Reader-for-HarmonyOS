import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { MangaOfflineNetworkProbe } from '../entry/src/main/ets/app/MangaOfflineNetworkProbe.ts';
import { readerMangaOfflineProbeScope } from '../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts';
import { MangaImageDecodeHost } from '../entry/src/main/ets/app/MangaImageDecodeHost.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

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
for(let i=0;i<256;i++){capacity.assertCapacity();capacity.track(i);capacity.settle(i);}
assert.throws(()=>capacity.assertCapacity(),/CAPACITY/);assert.equal(snap(capacity).claimedRequests,256);
console.log('PASS exact debug cold Want, arm-before-selection scope, immutable identity, wrong/text selection, bounded tombstones and actual nonzero denial counts');

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

const Owner=productionMotionMethods(url('app/ReaderRuntimeOwner.ts'),['requestDirect','mangaOfflineProbeProtectsAutomaticCatalog'],{
  DEFAULT_CORE_REQUEST_TIMEOUT_MS:30000,coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined,
});
function ownerFixture(p) {
  let id=100;const calls=[];const owner=new Owner();owner.mangaOfflineProbe=p;owner.start=async()=>{};owner.wakeReadingPreparations=()=>{};
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

// Execute the real Surface open/helper. Cached catalog access is its only
// offline dependency, and a missing cached catalog never reaches acquireBook.
let catalogReads=0,onlineAcquires=0,catalogFails=false;
const entry={targetOrdinal:0,chapter:{manifest:{displayHints:{}}}};
const Surface=productionMotionMethods(url('features/manga/MangaReadingSurface.ets'),['open','acquireCatalog','aboutToDisappear'],{
  MangaSessionGateway:class{async entry(){return entry;}},
  RemoteReadingFlowGateway:class{async openCachedSession(){catalogReads++;if(catalogFails)throw Error('no cached catalog');return {identity:scope,entries:[],acquisitionMode:'offline'};}},
});
const makeSurface=()=>{
  const s=new Surface(), events=[];
  s.controller={async awaitPendingProgress(){},async setPreviewMode(){},async openPrepared(_entry,offline){assert.equal(offline,true);events.push('open');},savedLocation:null,displayedOrdinal:0,recoveryRequired:false,close(){events.push('close');}};
  Object.assign(s,{...scope,offline:true,mounted:true,remoteBookSeed:{...scope,contentKind:'manga'},fitPreference:'width',
    runtime:{bookAcquisitions:()=>({acquireBook:async()=>{onlineAcquires++;throw Error('online');}}),finishMangaOfflineProbe(){events.push('finish');},subscribeMangaOfflineProbe(listener){listener('receipt');return()=>events.push('detach');}},
    publish(){},restore(){},configureAdjacentChapter(){events.push('catalog');},onRemoteSessionReady(){},layoutGeneration:0,viewportGeneration:0,loginGeneration:0});
  return {s,events};
};
const {s,events}=makeSurface();await s.open(s.controller);await tick();assert.equal(s.opened,true);assert.equal(catalogReads,1);assert.equal(onlineAcquires,0);
s.aboutToDisappear();assert.equal(s.mounted,false);assert.deepEqual(events.slice(-3),['close','finish','detach'],'reader/controller fences precede probe release');
catalogFails=true;const f=makeSurface();await assert.rejects(f.s.acquireCatalog(()=>true),/no cached catalog/);assert.equal(onlineAcquires,0);
await f.s.open(f.s.controller);await tick();assert.equal(f.s.opened,true,'missing optional catalog does not hide downloaded pixels');assert.equal(onlineAcquires,0);
console.log('PASS production offline Surface uses only cached catalog, preserves downloaded entry on absent optional TOC, and fences controller before releasing probe');
// The real cached gateway creates a new mutable session for every read. The
// Surface may tag its owned result without mutating Core data or another owner.
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
 if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(specifier+'.ts',context);throw error;}}});
const {RemoteReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
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

// Installed official SDK and actual vendored Core SDK types validate the new
// Want/parser + send/wait seam. This is not a substitute for an ArkTS/HAP gate.
{
  const require=createRequire(import.meta.url), sdk=process.env.READER_ETS_LOADER_ROOT??
    '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const ts=require(`${sdk}/node_modules/typescript`),sdkRoot=`${sdk}/../..`;
  const ownerSource=readFileSync(url('app/ReaderRuntimeOwner.ts'),'utf8');
  const tree=ts.createSourceFile('Owner.ts',ownerSource,ts.ScriptTarget.Latest,true);
  const ownerClass=tree.statements.find(n=>n.name?.getText(tree)==='ReaderRuntimeOwner');
  const requestMethod=ownerClass.members.find(n=>n.name?.getText(tree)==='requestDirect').getText(tree);
  const virtualPath=url('app/MangaOfflineProbeSdkCheck.ts').pathname;
  const coreSdk=new URL('../entry/oh_modules/@reader/core-harmony/sdk/reader_core',import.meta.url).pathname;
  const text=`import type {JsonObject, ReaderCoreRuntime, ReaderCoreResultEvent, RequestOptions} from '${coreSdk}';
import Want from '@ohos.app.ability.Want';
import {hilog} from '@kit.PerformanceAnalysisKit';
${readFileSync(url('app/MangaOfflineNetworkProbe.ts'),'utf8').replace(/^import .*?;\n/gm,'')}
${readFileSync(url('app/ReaderControlVerificationLaunch.ts'),'utf8').replace(/^import .*?;\n/gm,'')}
declare const LOG_DOMAIN:number,DEFAULT_CORE_REQUEST_TIMEOUT_MS:number;
declare function coreAdmissionFailureSummary(error:unknown,method:string):string|undefined;
declare function httpResponseFailureSummary(error:unknown):string|undefined;
function coldWant(want:Want):MangaOfflineProbeScope|undefined{return readerMangaOfflineProbeScope(true,'debug',
want.parameters?.readerMangaOfflineProbe,want.parameters?.readerMangaOfflineSourceId,want.parameters?.readerMangaOfflineBookId);}
class RuntimeSeam {
private preparationIntentEpoch=0;private runtime:ReaderCoreRuntime|undefined;private mangaOfflineProbe:MangaOfflineNetworkProbe|undefined;
private async start():Promise<void>{}private wakeReadingPreparations():void{}
private readingEntryPreparations():{beginRequest(method:string,params:JsonObject):boolean;finishRequest(method:string,params:JsonObject):void}{throw Error();}
${requestMethod}
}`;
  const options={noEmit:true,skipLibCheck:true,moduleResolution:ts.ModuleResolutionKind.NodeJs,target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.ESNext,types:[],baseUrl:'/',paths:{'@ohos.*':[`${sdkRoot}/api/@ohos.*.d.ts`],'@kit.*':[`${sdkRoot}/kits/@kit.*.d.ts`]}};
  const roots=readdirSync(`${sdk}/declarations`).filter(n=>n.endsWith('.d.ts')).map(n=>`${sdk}/declarations/${n}`);
  function errors(source){const host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host);
    host.getSourceFile=(path,...args)=>path===virtualPath?ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true):get(path,...args);
    return ts.getPreEmitDiagnostics(ts.createProgram([virtualPath,...roots],options,host))
      .filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'));}
  assert.deepEqual(errors(text),[],'actual cold Want and production request method match installed official and Core SDK types');
  assert.ok(errors(text.replace('runtime.waitForResult(requestId,','runtime.waitForResult("wrong-id",')).length>0,
    'SDK counterfactual rejects an invalid Host ownership id');
}
console.log('PASS installed SDK Want and actual Core SDK send/wait types, with invalid request-id counterfactual; no device/Native result claimed');

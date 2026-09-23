import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const {ReaderCoreRequestError}=await import('../entry/vendor/core-harmony/sdk/reader_core.ts');
const readingEvidence=await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const readingAdmission=await import('../entry/src/main/ets/features/reading/RemoteContentAdmission.ts');
const readingContract=await import('../entry/src/main/ets/features/reading/RemoteReadingContract.ts');
const {RemoteChapterCacheRefreshError}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
// Exercise production methods rather than a model of their implementation.
function method(source,name){
 const a=source.indexOf('  private '+name);assert.ok(a>=0,name);
 const b=source.indexOf('\n  private ',a+1);return source.slice(a,b<0?source.length:b).replace(/\n  \/\*\*[\s\S]*$/,'');
}
const index=read('entry/src/main/ets/pages/Index.ets');
const actions=stripTypeScriptTypes(`class Actions {${method(index,'addDetailBook()')} }`);
let pending=deferred();
const ActionClass=new Function('ReaderCoreRequestError','ReaderRuntimeOwner','ReaderCoreGateway','LOCAL_SOURCE_ID','hilog',actions+';return Actions')(
 ReaderCoreRequestError,{current:()=>({})},class{upsertBook(){return pending.promise;}},'local',{warn(){}});
for(const fails of [false,true]){
 pending=deferred();const h=new ActionClass();const book={sourceId:'s',bookId:'b'};
 Object.assign(h,{detailBook:book,remoteReadingSession:{identity:book,book:{title:'b'}},bookshelfRemovalGeneration:0,
 bookshelfAdditionGeneration:0,bookshelfAdditionActiveKey:'',bookshelfAdditionError:'',
 bookshelfRemovalActiveKey:'',canRemoveDetailBook:()=>true,detailBookKey:()=> 's:b',
 isSameDetailBook:b=>h.detailBook===b,refreshBookshelf:()=>{h.refreshes++;},
 prefetchReadingWindow:async()=>{h.prefetches++;},showReadingFailure:()=>{h.failures++;},refreshes:0,prefetches:0,failures:0});
 h.addDetailBook();assert.equal(h.bookshelfRemovalActiveKey,'','pending add cannot block reading a different book');
 assert.equal(h.bookshelfAdditionActiveKey,'s:b');h.detailBook=undefined;
 if(fails)pending.reject(Error('synthetic'));else pending.resolve();
 await tick();assert.equal(h.bookshelfRemovalActiveKey,'');assert.equal(h.bookshelfAdditionActiveKey,'');
 assert.equal(h.refreshes,fails?0:1);assert.equal(h.prefetches,0,'durable preparation belongs to the application owner');
 assert.equal(h.failures,0,'a late add failure never opens a modal over another page');
 assert.equal(h.bookshelfAdditionError.includes('synthetic'),fails);
}
// Cancel has its own exact-book owner. A strict add that commits first is
// retained; cancellation failure remains retryable instead of claiming success.
for (const outcome of ['cancelled', 'already-saved', 'failure', 'other-book']) {
 const cancellation=deferred(), lookup=deferred(); let calls=0;
 const Cancel=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
  ['cancelDetailBookAddition'],{
   ReaderRuntimeOwner:{current:()=>({bookAcquisitions:()=>({cancelReadableBook:async(s,b)=>{
    assert.deepEqual([s,b],['s','b']); calls++; return cancellation.promise;
   }})})},ReaderCoreGateway:class{loadShelfBook(){return lookup.promise;}}
  });
 const book={sourceId:'s',bookId:'b'};
 const h=Object.assign(new Cancel(),{detailBook:book,detailBookKey:()=> 's:b',
  bookshelfAdditionActiveKey:'s:b',bookshelfAdditionCancellingKey:'',bookshelfAdditionGeneration:1,
  bookshelfAdditionError:'',bookshelfAdditionErrorKey:'',detailInBookshelf:false,
  isSameDetailBook:b=>h.detailBook===b,refreshBookshelf:()=>h.refreshes++,
  refreshSearchShelfMembership:()=>h.memberships++,refreshes:0,memberships:0});
 h.cancelDetailBookAddition();h.cancelDetailBookAddition();assert.equal(calls,1);
 assert.equal(h.bookshelfAdditionGeneration,2,'old add callbacks lose UI ownership immediately');
 if(outcome==='other-book'){
  h.detailBook={sourceId:'s',bookId:'next'};h.bookshelfAdditionActiveKey='s:next';
  h.bookshelfAdditionCancellingKey='';h.bookshelfAdditionGeneration++;
 }
 if(outcome==='failure')cancellation.reject(Error('uncertain'));else cancellation.resolve();
 lookup.resolve(outcome==='already-saved'?book:undefined);await tick();
 if(outcome==='other-book')assert.equal(h.bookshelfAdditionActiveKey,'s:next');
 else if(outcome==='failure'){
  assert.equal(h.bookshelfAdditionActiveKey,'s:b');assert.equal(h.bookshelfAdditionCancellingKey,'');
  assert.match(h.bookshelfAdditionError,/取消状态未确认/);
 }else{
  assert.equal(h.bookshelfAdditionActiveKey,'');assert.equal(h.detailInBookshelf,outcome==='already-saved');
  assert.equal(h.refreshes,outcome==='already-saved'?1:0);
  assert.equal(h.bookshelfAdditionError,outcome==='already-saved'?'':'已取消加入书架');
 }
}
const entry=stripTypeScriptTypes(read('entry/src/main/ets/entryability/EntryAbility.ets').replace(/^import[\s\S]*?;\n/gm,''));
let setups=[];const coordinator={install:()=>{const p=deferred();setups.push(p);return p.promise;},detach(){}};
const Entry=new Function('UIAbility','ReaderWindowCoordinator','ReaderStartupTrace','hilog',entry.replace('export default class','return class'))(class{},coordinator,ReaderStartupTrace,{error(){}});
const stage=()=>({loads:0,getMainWindowSync:()=>({}),loadContent(){this.loads++;}});
{
 const e=new Entry(),old=stage(),fresh=stage();e.onWindowStageCreate(old);e.onWindowStageDestroy();e.onWindowStageCreate(fresh);
 setups[0].reject(Error('old setup failed'));setups[1].resolve(true);await tick();assert.equal(old.loads,0);assert.equal(fresh.loads,1);
}
{
 const e=new Entry(),s=stage();e.onWindowStageCreate(s);setups[2].resolve(false);await tick();assert.equal(s.loads,0);
}
console.log('PASS: detail mutation settles after exit; stale window completion cannot load content');
// Cache freshness/request joining live in the coordinator. Exercise the active
// Index admission call and its generation guards, not the removed wrapper.
const admission=index.slice(index.indexOf('class RemoteDetailAdmission {'),index.indexOf('\nclass RemoteSessionAttemptOutcome'));
const RemoteDetailAdmission=new Function(stripTypeScriptTypes(admission)+';return RemoteDetailAdmission;')();
for(const stale of [false,true]) for(const fails of [false,true]) {
 const shared=deferred(),background=deferred(),calls=[],failures=[],refreshes=[];
 const coordinator={readingProjectionRevision:()=>0,setPreparationVisible(value){assert.equal(value,false);},
   acquireBookWithBackgroundRefresh(){assert.fail('a new search preview must use readable candidate-group admission');},
   acquireCandidateGroup(candidates,options){
     assert.equal(options.requireReadable,true,'new-book trial must verify body before admission');
     assert.equal(typeof options.onCatalog,'function','catalog publication is independent of body completion');
     calls.push({seed:candidates[0].seed,options});return shared.promise;
   },
   recentFailures:()=>[]};
 const CacheClass=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
   ['openRemoteBookDetail','nextNavigationGeneration','readingDetailForRemoteSeed','installRemoteReadingSession'],{
     ...readingEvidence,RemoteChapterCacheRefreshError,...readingAdmission,...readingContract,
     ReaderRuntimeOwner:{current:()=>({bookAcquisitions:()=>coordinator})},RemoteDetailAdmission,
     RemoteReadingFlowGateway:class{},ReadingOfflineGateway:class{},
     ReaderCoreGateway:class{async loadShelfBook(){return undefined;}},
     DOMAIN:0,hilog:{info(){},warn(){},error(){}},
   });
 const seed={sourceId:'s',bookId:'b',title:'预览',author:'作者'};
 const session={identity:{sourceId:'s',bookId:'b'},book:{title:'已准入',author:'作者'},entries:[{index:0,title:'第一章',url:'/1'}],acquisitionMode:'cache'};
 const h=Object.assign(new CacheClass(),{remoteSessionGeneration:0,remoteContentProbeGeneration:0,route:'search',navigationGeneration:0,searchDetailCandidates:[],shelfBooks:[],
   remoteCatalogRefreshAt:new Map(),offlineMutationGeneration:0,bookshelfRemovalActiveKey:'',
   probeRemoteContentVerdict:async()=>0,loadRemoteDirectoryProjection:async()=>session.entries,
   showReadingFailure:(...args)=>failures.push(args),
   refreshCachedSearchDetailInBackground:(...args)=>refreshes.push(args)});
 h.openRemoteBookDetail(seed,'书源名称');assert.equal(h.route,'detail');await tick();assert.equal(calls.length,1);assert.equal(calls[0].seed,seed);
 assert.equal(calls[0].options.isCurrent(),true);assert.equal(h.detailReturnRoute,'search');
 if(stale){h.nextNavigationGeneration();h.route='bookshelf';assert.equal(calls[0].options.isCurrent(),false);}
 if(fails)shared.reject(Error('synthetic admission failure'));else shared.resolve({session,backgroundRefresh:background.promise});
 await tick();
 assert.equal(h.route,stale?'bookshelf':'detail');
 assert.equal(failures.length,0,'detail failure stays in the page, with no modal blocking reading');
 if(!stale&&fails)assert.equal(h.detailLoadingMessage,'synthetic admission failure');
 assert.equal(refreshes.length,!stale&&!fails?1:0,'only the current admission hands off the existing background promise');
 if(!stale&&!fails){assert.equal(h.remoteReadingSession,session);assert.equal(refreshes[0][4],background.promise);}
 else assert.equal(h.remoteReadingSession,undefined,'failure/late admission cannot mount a session');
 background.resolve(session);
}
for (const scenario of ['offscreen-existing','not-on-shelf','stale-lookup']) {
 const lookup=deferred(),calls=[];
 const coordinator={readingProjectionRevision:()=>0,setPreparationVisible(){},recentFailures:()=>[],
  acquireBookWithBackgroundRefresh(){calls.push('fixed');return new Promise(()=>{});},
  acquireCandidateGroup(){calls.push('group');return new Promise(()=>{});}};
 const Host=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
  ['openRemoteBookDetail','nextNavigationGeneration','readingDetailForRemoteSeed','installRemoteReadingSession'],{
   ...readingEvidence,RemoteChapterCacheRefreshError,...readingAdmission,...readingContract,
   ReaderRuntimeOwner:{current:()=>({bookAcquisitions:()=>coordinator})},RemoteDetailAdmission,
   RemoteReadingFlowGateway:class{},ReadingOfflineGateway:class{},ReaderCoreGateway:class{loadShelfBook(){return lookup.promise;}},
   DOMAIN:0,hilog:{info(){},warn(){},error(){}}});
 const h=Object.assign(new Host(),{remoteSessionGeneration:0,remoteContentProbeGeneration:0,route:'search',navigationGeneration:0,
  searchDetailCandidates:[],shelfBooks:[],remoteCatalogRefreshAt:new Map(),offlineMutationGeneration:0,bookshelfRemovalActiveKey:''});
 const selected={sourceId:'s',bookId:'offscreen',title:'书',author:'作者'};
 h.openRemoteBookDetail(selected,'书源');assert.equal(h.route,'detail');assert.deepEqual(calls,[]);
 if(scenario==='stale-lookup'){h.nextNavigationGeneration();h.route='bookshelf';}
 lookup.resolve(scenario==='not-on-shelf'?undefined:selected);await tick();
 assert.deepEqual(calls,scenario==='stale-lookup'?[]:[scenario==='offscreen-existing'?'fixed':'group']);
 if(scenario==='offscreen-existing')assert.equal(h.detailInBookshelf,true);
}
console.log('PASS search preview uses exact Core membership before source fallback; partial shelf and stale membership lookup cannot substitute a saved source');
const registry=read('entry/src/main/ets/app/ReaderHostRegistry.ts');
const recoveryMethods=[
 method(registry,'async recoverAbandonedStages()'),
 method(registry,'async hashLocalBookFile('),
 method(registry,'digestToHex('),
].join('').replaceAll('ReaderHostRegistry','Recovery');
const archiveBytes=Buffer.from('archive');
const archiveHash=createHash('sha256').update(archiveBytes).digest('hex');
const files=new Map([['/stage/1-1.book','incomplete'],['/stage/1-2-'+ archiveHash+'.epub','archive'],['/stage/unrelated','preserve']]);
const positions=new Map();
const fakeFileIo={
 OpenMode:{READ_ONLY:1},
 access:async p=>p==='/stage'||p==='/assets'||files.has(p),
 listFile:async()=>[...files.keys()].filter(p=>p.startsWith('/stage/')).map(p=>p.slice(7)),
 moveFile:async(a,b)=>{files.set(b,files.get(a));files.delete(a);},
 stat:async p=>({size:Buffer.byteLength(files.get(p)??''),isDirectory:()=>false}),
 open:async p=>{positions.set(p,0);return {fd:p};},
 read:async(fd,buffer)=>{const bytes=Buffer.from(files.get(fd)??'');const offset=positions.get(fd)??0;const count=Math.min(bytes.length-offset,buffer.byteLength);if(count>0)new Uint8Array(buffer).set(bytes.subarray(offset,offset+count));positions.set(fd,offset+Math.max(0,count));return Math.max(0,count);},
 close:async file=>{positions.delete(file.fd);},
};
const fakeCrypto={createMd:()=>{const chunks=[];return {update:async({data})=>chunks.push(Buffer.from(data)),digest:async()=>({data:Uint8Array.from(createHash('sha256').update(Buffer.concat(chunks)).digest())})};}};
const Recovery=new Function('fileIo','cryptoFramework','hilog','LOG_DOMAIN','errorMessageOf',stripTypeScriptTypes('class Recovery { static LocalBookLimitBytes=64*1024*1024; static HashChunkBytes=1024*1024;'+recoveryMethods+'};')+'return Recovery;')(fakeFileIo,fakeCrypto,{warn(){},error(){}},0x5244,e=>e instanceof Error?e.message:String(e));
{
 const h=new Recovery();Object.assign(h,{localBookStageDirectory:()=>'/stage',localBookAssetDirectory:()=>'/assets',ensureDirectory:async()=>{},unlinkIfPresent:async p=>files.delete(p)});
 await h.recoverAbandonedStages();assert.equal(files.has('/stage/1-1.book'),false);
 assert.equal(files.get('/assets/'+archiveHash+'.epub'),'archive');assert.equal(files.get('/stage/unrelated'),'preserve');
}
// A filename alone is not an integrity proof. Recovery must discard a
// completed-looking stage whose bytes hash to a different identity.
{
 const badHash='b'.repeat(64);
 files.set('/stage/2-1-'+badHash+'.source','tampered');
 const h=new Recovery();Object.assign(h,{localBookStageDirectory:()=>'/stage',localBookAssetDirectory:()=>'/assets',ensureDirectory:async()=>{},unlinkIfPresent:async p=>files.delete(p)});
 await h.recoverAbandonedStages();
 assert.equal(files.has('/stage/2-1-'+badHash+'.source'),false);
 assert.equal(files.has('/assets/'+badHash+'.source'),false);
}
console.log('PASS: active detail admission retains one shared refresh with success/failure/stale guards; startup preserves complete EPUB resources');

// An import.persist reply lost after Core commits must not destroy lazy EPUB resources.
const importSource=read('entry/src/main/ets/features/bookshelf/LocalBookImportGateway.ts');
const importMethods=[
 method(importSource,'async importPreparedSelection('),
 method(importSource,'async finalizeCommittedImport('),
 method(importSource,'async reconcileShelfAdd('),
 method(importSource,'isShelfMutationOutcomeUnknown('),
 method(importSource,'isDeterministicCoreRejection('),
].join('');
const failureSource=stripTypeScriptTypes(read('entry/src/main/ets/app/LocalImportFailure.ts')).replace(/^export /gm,'');
const ImportProbe=new Function('hilog','DOMAIN','errorMessageOf',failureSource+stripTypeScriptTypes('class ImportProbe {'+importMethods+'};')+'return ImportProbe;')({error(){},warn(){}},0,e=>e.message);
for (const failedPhase of ['parse','persist']) {
 let discarded=0;const h=new ImportProbe();
 Object.assign(h,{requiredObject:(obj,key)=>obj[key],localBookParseParams:()=>({}),nextTransactionId:()=> 'tx',runtimeOwner:{
   async request(name) { if(name==='import.'+failedPhase)throw Error('lost reply'); return {data:{preview:{summary:{integrity:{schemaVersion:1,readability:'complete'}}}}}; },
   async discardLocalBookInput() {discarded++;},
 }});
 const result=await h.importPreparedSelection({state:'ready',input:{fileName:'book.epub',bookId:'book'}});
 assert.equal(discarded,failedPhase==='parse'?1:0);
 if(failedPhase==='persist'){
   assert.equal(result.failure.code,'recoveryPending');
   assert.match(result.failure.message,/检查书架/);
 }
}
console.log('PASS: ambiguous persist reply preserves EPUB resources and asks to reconcile before retry');

// A structured Core validation rejection proves import.persist never reached
// its storage mutation. It must discard the staged input immediately instead
// of misclassifying the request as an unknown commit and retaining an orphan.
{
 let discarded = 0;
 const h = new ImportProbe();
 Object.assign(h, {
  requiredObject: (obj, key) => obj[key],
  localBookParseParams: () => ({}),
  nextTransactionId: () => 'tx-deterministic',
  runtimeOwner: {
   async request(name) {
    if (name === 'import.parse') {
     return {data: {preview: {summary: {integrity: {schemaVersion: 1, readability: 'complete'}}}}};
    }
    if (name === 'import.persist') {
     throw Object.assign(Error('invalid params'), {event: {error: {code: 'INVALID_PARAMS'}}});
    }
    throw Error(`unexpected ${name}`);
   },
   async discardLocalBookInput() { discarded += 1; },
  },
 });
 const result = await h.importPreparedSelection({state: 'ready', input: {fileName: 'book.txt', bookId: 'book'}});
 assert.equal(result.state, 'failed');
 assert.equal(result.failure.code, 'unknown');
 assert.equal(discarded, 1);
}
console.log('PASS: deterministic import.persist rejection discards staged input without recovery orphan');

// A lost bookshelf.add reply is reconciled before any body/asset rollback.
for (const shelfVerdict of ['committed', 'absent', 'unknown']) {
 let coreRollbacks=0;let assetRollbacks=0;
 const h=new ImportProbe();
 Object.assign(h,{requiredObject:(obj,key)=>obj[key],requiredString:(obj,key)=>obj[key],
  localBookParseParams:()=>({}),nextTransactionId:()=> 'tx',shelfAddParams:()=>({sourceId:'local',bookId:'book'}),runtimeOwner:{
   async request(name) {
    if(name==='import.parse')return {data:{preview:{summary:{integrity:{schemaVersion:1,readability:'complete'}}}}};
    if(name==='import.persist')return {data:{rollbackToken:{token:'rollback'},persisted:{kind:'localBook',data:{book:{bookId:'book',title:'Book',author:''}}}}};
    if(name==='bookshelf.add')throw Error('lost add reply');
    if(name==='bookshelf.get'){
     if(shelfVerdict==='unknown')throw Error('reconcile unavailable');
     return {data:{book:shelfVerdict==='committed'?{sourceId:'local',bookId:'book'}:null}};
    }
    if(name==='import.rollback'){coreRollbacks++;return {data:{}};}
    throw Error(`unexpected ${name}`);
   },
   async commitLocalBookInput(){return {bookId:'book',assetKind:'source',path:'/book',created:true};},
   async rollbackLocalBookAsset(){assetRollbacks++;},
  }});
 const result=await h.importPreparedSelection({state:'ready',input:{fileName:'book.txt',bookId:'book'}});
 if(shelfVerdict==='committed')assert.equal(result.state,'success');
 else assert.equal(result.failure.code,shelfVerdict==='unknown'?'recoveryPending':'unknown');
 assert.equal(coreRollbacks,shelfVerdict==='absent'?1:0);
 assert.equal(assetRollbacks,shelfVerdict==='absent'?1:0);
}
console.log('PASS: lost bookshelf.add reply reconciles durable shelf truth before compensation');

// A deterministic Core validation error must not be mistaken for a lost
// reply merely because an older shelf row has the same identity.
{
 let bookshelfGets=0;let coreRollbacks=0;let assetRollbacks=0;
 const h=new ImportProbe();
 Object.assign(h,{requiredObject:(obj,key)=>obj[key],requiredString:(obj,key)=>obj[key],
  localBookParseParams:()=>({}),nextTransactionId:()=> 'tx',shelfAddParams:()=>({sourceId:'local',bookId:'book'}),runtimeOwner:{
   async request(name) {
    if(name==='import.parse')return {data:{preview:{summary:{integrity:{schemaVersion:1,readability:'complete'}}}}};
    if(name==='import.persist')return {data:{rollbackToken:{token:'rollback'},persisted:{kind:'localBook',data:{book:{bookId:'book',title:'Book',author:''}}}}};
    if(name==='bookshelf.add')throw Object.assign(Error('invalid params'),{event:{error:{code:'INVALID_PARAMS'}}});
    if(name==='bookshelf.get'){bookshelfGets++;return {data:{book:{sourceId:'local',bookId:'book'}}};}
    if(name==='import.rollback'){coreRollbacks++;return {data:{}};}
    throw Error(`unexpected ${name}`);
   },
   async commitLocalBookInput(){return {bookId:'book',assetKind:'source',path:'/book',created:true};},
   async rollbackLocalBookAsset(){assetRollbacks++;},
  }});
 const result=await h.importPreparedSelection({state:'ready',input:{fileName:'book.txt',bookId:'book'}});
 assert.equal(result.state,'failed');
 assert.equal(result.failure.code,'unknown');
 assert.equal(bookshelfGets,0);
 assert.equal(coreRollbacks,1);
 assert.equal(assetRollbacks,1);
}
console.log('PASS: deterministic bookshelf.add rejection never reports an older shelf row as a new commit');

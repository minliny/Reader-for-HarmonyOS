import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import {makeIndex as compileIndex,failureChain,sourceSwitchLiveSdk} from './lib/source-switch-sdk-consumer.mjs';
import {actualGeneralSettingsTypes,actualGeneralSettingsHostField} from './lib/general-settings-owner-probe.mjs';
import {actualSourceManagementTypes,actualSourceManagementHostField} from './lib/source-management-owner-probe.mjs';
import {actualBookshelfOperationTypes,actualBookshelfHostField} from './lib/bookshelf-operation-owner-probe.mjs';
import {actualCacheAuthorityFixture} from './lib/reading-directory-sdk-consumer.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {fixture,settle as settleOwner,deferred,origin,target,session,rawCandidate,Runtime,read,gatewayExports,setCurrentRuntime,Core} from './lib/source-switch-owner-probe.mjs';
const {ProductionHost:ReadingEntryHost,setRuntime:setEntryRuntime}=await import('./lib/reading-entry-owner-probe.mjs');
const evidence=await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
import * as horizontal from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as authorMetadata from '../entry/src/main/ets/features/common/BookAuthorMetadata.ts';
const {ReaderNativeAlertOwner}=await import('./lib/reader-native-alert-sdk-probe.mjs');
const {ReadingOfflineHost}=await import('./lib/reader-reading-owner-sdk-probe.mjs');
// Compile the fixed production SDK graph once. Every scenario still receives
// its own actual V1 properties, native child tables, Runtime and source owner.
const sourceOwners=new WeakMap(),cacheStores=new WeakMap();
const sourceHostPort={forRuntime(runtime){const type=sourceOwners.get(runtime);assert.ok(type);return type.forRuntime(runtime);}};
class CacheStorePort{constructor(runtime,...args){const Store=cacheStores.get(runtime);assert.ok(Store,'cleanup uses its own sandbox authority');return new Store(runtime,...args);}}
const factorySource=compileIndex.toString(),initializerStart=factorySource.indexOf(' Object.assign(index,'),
 initializerEnd=factorySource.indexOf(' const acquire=f.runtime.bookAcquisitions;');
assert.ok(initializerStart>=0&&initializerEnd>initializerStart,'execute the unchanged finite fixture initializer');
const initializeIndex=new Function('index','f','Runtime','origin','ReaderNativeAlertOwner','actualBookshelfOperationTypes',
 'actualBookshelfHostField','actualSourceManagementTypes','actualSourceManagementHostField','actualGeneralSettingsTypes',
 'actualGeneralSettingsHostField','Core','navigation','reading',factorySource.slice(initializerStart,initializerEnd));
let indexTemplate,indexEmissions=0;
const indexActors=[];
function makeIndex(f,{navigation=1,reading=false,cacheAuthority}={}){
 sourceOwners.set(f.runtime,f.Constructor);if(cacheAuthority)cacheStores.set(f.runtime,cacheAuthority.types.CacheClearOperationIntentStore);
 setEntryRuntime(f.runtime);
 let result;
 if(indexTemplate===undefined){indexEmissions++;indexTemplate=compileIndex({...f,Constructor:sourceHostPort},{navigation,reading,
   cacheAuthority:{types:{CacheClearOperationIntentStore:CacheStorePort}}});result=indexTemplate;}
 else{
  const {p,leafDeps}=indexTemplate,index=new indexTemplate.index.constructor(undefined,{sourceSwitchScopeId:0});
  initializeIndex(index,f,Runtime,origin,ReaderNativeAlertOwner,actualBookshelfOperationTypes,actualBookshelfHostField,
   actualSourceManagementTypes,actualSourceManagementHostField,actualGeneralSettingsTypes,actualGeneralSettingsHostField,Core,navigation,reading);
  const acquire=f.runtime.bookAcquisitions;f.runtime.bookAcquisitions=()=>({...acquire(),readingProjectionRevision:()=>0,setPreparationVisible(){}});
  result={p,index,leafDeps,mount(){index.sourceSwitchOverlayContent();return p.walk(index).filter(x=>x instanceof leafDeps.SourceSwitchPanel).at(-1);},
   rows:()=>p.walk(index).filter(x=>x instanceof leafDeps.SourceSwitchNovelRow)};
 }
 for(const old of indexActors){assert.notEqual(result.index,old);assert.notEqual(result.index.nodes,old.nodes);
  assert.notEqual(result.index.__sourceSwitchState,old.__sourceSwitchState,'V1 state cells remain scenario-local');}
 indexActors.push(result.index);return result;
}
const settle=async()=>{await settleOwner();await new Promise(setImmediate);await settleOwner();};
async function waitForRetiredSourceCleanup(host,identity,previousGeneration,outcome){
 const deadline=performance.now()+15_000;
 for(;;){
  const operation=host.snapshot();
  // Idle before admission and a receipt from earlier work are not completion.
  // The mutex remains active through the exact Core receipt and platform step.
  if(operation?.action==='clear'&&operation.sourceId===identity.sourceId&&operation.bookId===identity.bookId&&
    operation.generation>previousGeneration&&['succeeded','failed','retired'].includes(operation.materialization)&&!host.busy())return operation;
  const remaining=deadline-performance.now();
  assert.ok(remaining>0,`retired source cleanup ${outcome} did not reach its terminal operation: ${JSON.stringify({busy:host.busy(),operation})}`);
  await new Promise(resolve=>setTimeout(resolve,Math.min(5,remaining)));
 }
}
const methods=['getSourceSwitchHost','sourceSwitchContext','sourceSwitchLease','applySourceSwitchSnapshot','retireRssPresentation','retireSourceSwitchPresentation',
 'bindSourceSwitchReader','applySourceSwitchEffect','openSourceSwitch','openDetailSourceSwitch','retrySourceSwitch','refreshSourceSwitch',
 'sourceSwitchProbeQuery','knownSearchSourceCandidates','onPickSource','retryFailedSourceSwitch','dismissSourceSwitchFailure','onRollbackSourceSwitch',
 'closeSourceSwitch','performSourceSwitchSeam','resolveReaderSourceSwitchTransaction','reconcilePendingSourceSwitches','currentSourceSwitchTransactionId',
 'nextNavigationGeneration','isCurrentRuntime','openReading','onRemoteSessionReady','installRemoteReadingSession',
 'getReadingEntryHost','readingEntryLease','applyReadingEntrySnapshot','bindReadingEntryReader','retireReadingEntryPresentation',
 'detailReadableAdmission','detailBookKey','chooseCachedChapterRefresh','showReadingFailure','showIndexAlert',
 'applyReadingCommit','getReadingOfflineHost','cleanupRetiredSourceCache','sourceSwitchOverlayContent'];
const states=['sourceSwitchVisible','sourceSwitchState','sourceSwitchFailureMessage','sourceSwitchScopeId'];
const checks=[];
// Actual SDK row -> Index -> shared Gateway/Host -> first-image admission.
// The only author proof is the exact cold Core row, never a display rewrite.
for(const mode of ['valid','stale-proof','wrong-book','wrong-author','target-version','registry-during-proof',
 'wrong-target-author','registry-during-image','cancel-resolve','cancel-reject']){
 const proof={schemaVersion:1,sourceVersion:'v1',field:'detail',raw:'@Writer',label:'Writer',rule:'author-nickname-at-v1'};
 const targetSession={...session,contentKind:'manga',detailUrl:'target',hostRequirements:[],
  book:{title:'Book',author:mode==='wrong-target-author'?'Other':'Writer'},
  entries:[{index:0,title:'Chapter 1',url:'/target/0',variables:[],navigable:true}]};
 const f=fixture({shared:true,open:false,preview:true,targetSession}),base=f.runtime.request.bind(f.runtime);
 let revision=1,click=false,blocked=false,work,resolvedQuery;const gate=deferred(),entered=deferred(),images=[],released=[],assertQueries=[];
 const acquisitions=f.runtime.bookAcquisitions;
 f.runtime.bookAcquisitions=()=>({...acquisitions(),sourceRegistryRevision:()=>revision});
 f.runtime.supportsCoreCapability=()=>true;
 f.runtime.request=async(method,params,options)=>{
  if(method==='source.list')return{data:{sources:['old','new'].map(sourceId=>({sourceId,name:sourceId,enabled:true,
   sourceVersion:click&&mode==='target-version'&&sourceId==='new'?'v2':'v1',bookSource:{bookSourceType:2}}))}};
  if(method==='search-book.get'){
   assert.deepEqual(params,{origin:'old',bookUrl:'book'});
   if(click&&!blocked&&['registry-during-proof','cancel-resolve','cancel-reject'].includes(mode)){
    blocked=true;entered.resolve();await gate.promise;
   }
   const invalid=click;
   return{data:{book:{origin:'old',bookUrl:invalid&&mode==='wrong-book'?'other':'book',name:'Book',
    author:invalid&&mode==='wrong-author'?'@Other':'@Writer',acquisition:{sourceVersion:invalid&&mode==='stale-proof'?'v0':'v1',
     authorIdentity:invalid&&mode==='stale-proof'?{...proof,sourceVersion:'v0'}:proof}}}};
  }
  if(method==='manga.chapter.get'){
   const pageId='mp1:'+'a'.repeat(64),resourceRef='manga:'+pageId;
   return{data:{manifest:{chapter:{sourceId:'new',bookId:'target',chapterId:'/target/0'},manifestVersion:'m1',
    sourceRuleVersion:'v1',decodeRevision:'identity-v1',pages:[{ordinal:0,pageId,resourceRef}]},chapterIndex:0,
    chapterTitle:'Chapter 1',cached:false,resources:[{resourceRef,request:{url:'https://image.test/first'}}]}};
  }
  return base(method,params,options);
 };
 f.runtime.loadReadingImage=async()=>{images.push('first');if(mode==='registry-during-image')revision++;
  return{fileUri:'file://first',width:600,height:800,revision:'pixels'};};
 f.runtime.releaseReadingImage=uri=>released.push(uri);
 f.setRows([{...rawCandidate,acquisition:{sourceVersion:'v1',contentKind:'manga'}}]);
 const x=makeIndex(f);
 Object.assign(x.index,{detailBook:{...origin,sourceName:'Old',contentKind:'manga',author:'@Writer'},
  readingContentKind:'manga',remoteReadingSession:undefined,remoteReadingSeed:undefined,mangaSourceSwitchPreparationGeneration:0,
  mangaChapterRequestGeneration:0});
 x.index.openDetailSourceSwitch();await settle();
 assert.equal(x.index.sourceSwitchState.kind,'candidates',mode+' first paint');
 assert.deepEqual(f.host.context.query.authorIdentity,proof,'cold exact proof admits the displayed manga row');
 assert.equal(x.index.sourceSwitchProbeQuery().authorIdentity,undefined,'Index retains its raw display projection');
 const gateway=f.host.mangaPreparationGateway(),resolve=gateway.resolveProbeQueryIdentity.bind(gateway),check=gateway.assertAcquiredBook.bind(gateway);
 gateway.resolveProbeQueryIdentity=async(...args)=>{const query=await resolve(...args);if(args[2])resolvedQuery=query;return query;};
 gateway.assertAcquiredBook=(candidate,selected,query)=>{assertQueries.push(query);return check(candidate,selected,query);};
 const start=x.index.switchMangaSource.bind(x.index);x.index.switchMangaSource=(...args)=>work=start(...args);
 const panel=x.mount(),row=x.rows().find(value=>value.candidate.sourceId==='new');assert.ok(row,mode);
 click=true;if(mode==='target-version')revision++;
 row.onSelect();assert.equal(x.index.sourceSwitchState.kind,'switching','click responds before qualification IO');assert.ok(work);
 if(['registry-during-proof','cancel-resolve','cancel-reject'].includes(mode)){
  await entered.promise;
  if(mode==='registry-during-proof')revision++;
  else{
   panel.onClose();assert.equal(x.index.sourceSwitchVisible,false);
   x.index.openDetailSourceSwitch();await settle();assert.equal(x.index.sourceSwitchVisible,true);
   const scope=x.index.sourceSwitchScopeId;
   if(mode==='cancel-reject')gate.reject(Error('late proof IO error'));else gate.resolve();
   await work;await settle();assert.equal(x.index.sourceSwitchScopeId,scope);
   assert.equal(x.index.sourceSwitchVisible,true);assert.equal(x.index.sourceSwitchState.kind,'candidates');
   assert.equal(f.calls.filter(([method])=>method==='acquire').length,0);
   x.mount().onClose();checks.push('actual-cold-manga-SDK-'+mode);continue;
  }
  gate.resolve();
 }
 await work;await settle();
 const opens=x.index.effects.filter(effect=>effect?.validated);
 if(mode==='valid'){
  assert.equal(opens.length,1);assert.equal(opens[0].validated,targetSession);
  assert.deepEqual(resolvedQuery.authorIdentity,proof);assert.equal(assertQueries.length,1);
  assert.equal(assertQueries[0],resolvedQuery,'final target verification uses the same qualified query after Host retirement');
  assert.equal(f.calls.filter(([method])=>method==='acquire').length,1);assert.equal(images.length,1);assert.equal(released.length,1);
 }else{
  assert.equal(opens.length,0);assert.equal(x.index.sourceSwitchState.kind==='switching',false,'qualification failure is recoverable');
  const message=x.index.sourceSwitchState.refreshError??x.index.sourceSwitchFailureMessage;
  assert.ok(message.length>0,mode);
  assert.equal(f.calls.filter(([method])=>method==='acquire').length,['wrong-target-author','registry-during-image'].includes(mode)?1:0);
  if(mode==='registry-during-image'){assert.equal(released.length,1);assert.match(message,/书源配置已变更/);}
  const failedScope=x.index.sourceSwitchScopeId;
  assert.equal(f.host.current().visible,false,'preparation retired discovery');
  panel.onRefresh();await settle();
  assert.equal(f.host.current().visible,true,'actual retry button binds a live owner');
  assert.notEqual(x.index.sourceSwitchScopeId,failedScope);
  const refreshedScope=x.index.sourceSwitchScopeId;
  x.index.refreshSourceSwitch(failedScope);await settle();assert.equal(x.index.sourceSwitchScopeId,refreshedScope,'old button cannot reopen newer scope');
 }
 assert.equal(x.index.detailBook.author,'@Writer','proof recovery never mutates the rendered detail');
 assert.equal(f.calls.some(([method])=>['manga.sourceSwitch.commit','reading.progress.update','bookshelf.add'].includes(method)),false);
 checks.push('actual-cold-manga-SDK-'+mode);
}
for(const late of ['resolve','reject']){
 const gate=deferred(),f=fixture({open:false,shared:true,preview:true,acquireGate:gate}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();const panel=x.mount(),row=x.rows().find(value=>value.candidate.sourceId==='new');
 row.onSelect();await settle();assert.ok(f.calls.some(([method])=>method==='acquire'));
 const preparing=x.mount();assert.equal(preparing.allowCancelWhileSwitching,true,'actual novel preview control admits cancellation after qualification');
 const previous=x.index.sourceSwitchScopeId;preparing.onClose();assert.equal(x.index.sourceSwitchVisible,false);
 x.index.openDetailSourceSwitch();await settle();const next=x.index.sourceSwitchScopeId;assert.notEqual(next,previous);
 if(late==='resolve')gate.resolve();else gate.reject(Error('old preview failed'));await settle();
 assert.equal(x.index.sourceSwitchVisible,true);assert.equal(x.index.sourceSwitchScopeId,next);assert.equal(x.index.sourceSwitchState.kind,'candidates');
 assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
 checks.push('actual-SDK-preview-preparation-close-reopen-before-late-'+late);
}
// The actual Index method must retain a proven author identity when its
// reading session is gone, while refusing a different book or stale/raw proof.
{
 const proof={schemaVersion:1,sourceVersion:'v1',field:'detail',raw:'@Writer',label:'Writer',rule:'author-nickname-at-v1'};
 const seed={sourceId:'old',bookId:'book',title:'Book',author:'@Writer',authorIdentity:proof,sourceVersion:'v1'};
 const create=entries=>{
  const f=fixture({open:false}),x=makeIndex(f);
  Object.assign(x.index,{detailBook:{...origin,sourceName:'Old',author:'@Writer'},detailToc:entries,
   remoteReadingSession:undefined,remoteReadingSeed:undefined});
  return x;
 };
 for(const entries of [[],[{index:325,title:'Chapter 325'}]]){
  const x=create(entries);x.index.remoteReadingSeed=seed;
  const query=x.index.sourceSwitchProbeQuery();
  assert.deepEqual(query.authorIdentity,proof);assert.equal(query.sourceVersion,'v1');
  assert.equal(query.currentChapterIndex,entries.length===0?0:325);
  assert.equal(query.author,'@Writer','the display/raw field remains unchanged');
 }
 for(const [name,selected] of [
  ['other source',{...seed,sourceId:'other'}],['other book',{...seed,bookId:'other'}],
  ['raw mismatch',{...seed,author:'@Other',authorIdentity:{...proof,raw:'@Other',label:'Other'}}],
  ['proof version mismatch',{...seed,authorIdentity:{...proof,sourceVersion:'v0'}}],
  ['unsupported proof',{...seed,authorIdentity:{...proof,rule:'untrusted'}}],
 ]){
  const x=create([]);x.index.remoteReadingSeed=selected;
  assert.equal(x.index.sourceSwitchProbeQuery().authorIdentity,undefined,name);
 }
 {
  const x=create([]);x.index.remoteReadingSeed=seed;
  x.index.remoteReadingSession={identity:{sourceId:'other',bookId:'book'},sourceVersion:'v2',
   book:{authorIdentity:{...proof,sourceVersion:'v2'}}};
  assert.equal(x.index.sourceSwitchProbeQuery().sourceVersion,'v1','another session never overrides the exact seed');
 }
 {
  const x=create([]);x.index.remoteReadingSeed={...seed,authorIdentity:{...proof,sourceVersion:'v0'}};
  x.index.detailBook={...x.index.detailBook,authorIdentity:proof,sourceVersion:'v1'};
  assert.deepEqual(x.index.sourceSwitchProbeQuery().authorIdentity,proof,'exact detail supplies the fallback proof');
  const detail=x.p.consumer(read('pages/Index.ets'),['readingDetailForRemoteSeed'],{...x.leafDeps,...authorMetadata});
  detail.readingContentKind='text';
  const projection=detail.readingDetailForRemoteSeed(seed,'Old');
  assert.deepEqual(projection.authorIdentity,proof);assert.equal(projection.sourceVersion,'v1');
  assert.equal(projection.sourceId,'old');assert.equal(projection.bookId,'book');
  x.index.remoteReadingSeed=undefined;x.index.detailBook=projection;
  assert.deepEqual(x.index.sourceSwitchProbeQuery().authorIdentity,proof,'projected detail survives session/seed retirement');
 }
 checks.push('actual-Index-exact-seed-and-detail-author-proof-without-session-raw-version-and-identity-rejection');
}
for(const outcome of ['resolve','reject']){
 const f=fixture({shared:true,open:false}),x=makeIndex(f),gate=deferred(),base=f.runtime.request.bind(f.runtime);
 const acquisitions=f.runtime.bookAcquisitions;let revision=1,blockNextRegistry=false,started=false;
 f.runtime.bookAcquisitions=()=>({...acquisitions(),sourceRegistryRevision:()=>revision});
 f.runtime.request=async(method,params,options)=>{
  if(method==='source.list'&&blockNextRegistry){
   blockNextRegistry=false;started=true;await gate.promise;
   return{data:{sources:[{sourceId:'old',name:'Old',enabled:true,sourceVersion:'v1'},
    {sourceId:'new',name:'New',enabled:true,sourceVersion:'v1'}]}};
  }
  return base(method,params,options);
 };
 x.index.openDetailSourceSwitch();await settle();const panel=x.mount(),scope=x.index.sourceSwitchScopeId;
 revision=2;blockNextRegistry=true;x.rows().find(row=>row.candidate.sourceId==='new').onSelect();await settle();
 assert.equal(started,true);assert.equal(x.index.sourceSwitchState.kind,'switching');
 panel.onClose();assert.equal(x.index.sourceSwitchVisible,false,'actual SDK close cancels read-only qualification');
 x.index.openDetailSourceSwitch();await settle();assert.equal(x.index.sourceSwitchVisible,true);
 const successor=x.index.sourceSwitchScopeId;assert.notEqual(successor,scope);
 assert.equal(x.index.sourceSwitchState.kind,'candidates');
 if(outcome==='resolve')gate.resolve();else gate.reject(Error('old qualification failed'));
 await settle();assert.equal(x.index.sourceSwitchVisible,true);assert.equal(x.index.sourceSwitchScopeId,successor);
 assert.equal(x.index.sourceSwitchState.kind,'candidates');assert.equal(x.index.detailBook.sourceId,'old');
 assert.equal(f.calls.some(([method])=>method==='acquire'||method==='source.switch.commit'),false);
 x.mount().onClose();checks.push('actual-SDK-close-pending-qualification-reopen-before-late-'+outcome);
}
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f);x.index.openDetailSourceSwitch();await settle();
 assert.equal(x.index.sourceSwitchState.kind,'candidates');assert.equal(x.index.sourceSwitchScopeId,f.host.current().scopeId);
 const panel=x.mount(),row=x.rows().find(r=>r.candidate.sourceId==='new');assert.ok(row);
 const selectedName=row.candidate.sourceName;
 const originalFrame=[...panel.nodes.values()].find(n=>n.type==='Stack'&&n.width==='100%'&&n.height==='100%');
 assert.ok(originalFrame,'the actual picker follows the confirmed full-viewport layout');
 row.onSelect();await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
 assert.equal(x.index.detailBook.sourceId,'new');assert.equal(x.index.route,'reading');assert.equal(x.index.requestedChapterIndex,0);
 assert.equal(x.index.remoteReadingSession.identity.sourceId,'new');assert.equal(x.index.currentSourceSwitchTransactionId(),f.host.current().pending.transactionId);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,1);
 assert.equal(f.calls.filter(([m])=>m==='acquire').length,1);
 const tx=f.host.current().pending.transactionId;
 for(const bad of [undefined,'old-transaction']){
  x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:bad});
  assert.equal(f.host.current().pending.transactionId,tx);assert.equal(x.index.cleanup.length,0);
 }
 x.index.applyReadingCommit({...origin,chapterIndex:0,sourceSwitchTransactionId:tx});assert.equal(f.host.current().pending.transactionId,tx);
 f.setPhase('finalized');x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});await settle();
 assert.equal(f.host.current().pending,undefined);assert.equal(x.index.cleanup.length,1);assert.equal(x.index.cleanup[0].fromSourceId,'old');
 assert.equal(x.index.sourceSwitchNamedCandidate.sourceId,'new');
 assert.equal(x.index.sourceSwitchCompletion.sourceName,selectedName,'actual selected source metadata must supply the novel completion name');
 x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});assert.equal(x.index.cleanup.length,1);
 checks.push('actual-Index-Host-Gateway-SDK-candidate-reader-seam-and-exact-finalization');
}
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f);x.index.openDetailSourceSwitch();await settle();const old=x.mount(),scope=x.index.sourceSwitchScopeId;
 old.onClose();assert.equal(f.host.current().visible,false);x.index.openDetailSourceSwitch();await settle();const current=x.mount();
 assert.notEqual(x.index.sourceSwitchScopeId,scope);old.onClose();old.onRetry();old.onRefresh();old.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.current().visible,true);assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 current.onClose();assert.equal(f.host.current().visible,false);
 checks.push('actual-SDK-detail-overlay-reopen-old-physical-actions-rejected');
}
{
 const f=fixture({shared:true,open:false,loseCommitAck:true,failExactQuery:true}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();const panel=x.mount();panel.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(x.index.sourceSwitchState.confirmation,'unknown');
 const rendered=x.mount();assert.ok(x.p.nodes(rendered).some(n=>n.create==='换源结果未确认'));
 const action=x.p.nodes(rendered).find(n=>n.type==='Button'&&n.createWithLabel?.[0]==='重试核对');assert.ok(action?.onClick);
 panel.onClose();assert.equal(f.host.current().visible,true);
 f.options.failExactQuery=false;action.onClick();await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
 assert.equal(x.index.detailBook.sourceId,'new');assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,1);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.rollback').length,0);
 checks.push('actual-unknown-title-reads-exact-recovery-without-second-commit');
}
{
 const gate=deferred(),f=fixture({shared:true,open:false,commitGate:gate}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();const panel=x.mount();panel.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.consumeBack(x.index.sourceSwitchScopeId),true);assert.equal(f.host.current().visible,true);
 x.index.nextNavigationGeneration();x.index.detailBook={sourceId:'other',bookId:'other'};gate.resolve();await settle();
 assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.targetSourceId,'new');
 assert.equal(x.index.detailBook.sourceId,'other');assert.equal(x.index.sourceSwitchVisible,false);
 checks.push('retired-navigation-keeps-accepted-ACK-without-late-reader-navigation');
}
{
 const f=fixture({shared:true,open:false,preview:true,failAcquire:true}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();const old=x.mount();old.onSelectCandidate(f.candidate());await settle();
 assert.equal(x.index.route,'reading');assert.equal(x.index.readingSessionActive,true);assert.equal(x.index.sourceSwitchFailureMessage,'换源暂时未完成，请重试或选择其他书源。');
 const oldScope=old.owner.sourceSwitchScopeId;const scope=x.index.sourceSwitchScopeId;
 assert.equal(f.host.current().scopeId,scope);const calls=f.calls.length;x.index.retryFailedSourceSwitch(oldScope-1);assert.equal(f.calls.length,calls);
 f.options.failAcquire=false;x.index.retryFailedSourceSwitch(scope);await settle();assert.ok(x.index.effects.some(e=>e.validated));
 checks.push('detail-acquisition-failure-mounts-reader-with-live-explicit-recovery-scope');
}
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f);x.index.openDetailSourceSwitch();await settle();
 const originalScope=x.index.sourceSwitchScopeId;const old=x.mount();
 x.index.retireSourceSwitchPresentation();const successor=makeIndex(f,{navigation:5});successor.index.openDetailSourceSwitch();await settle();
 const scope=successor.index.sourceSwitchScopeId;assert.notEqual(scope,originalScope);
 x.index.retireSourceSwitchPresentation();assert.equal(f.host.current().visible,true,'old detach must not retire a successor presentation');
 old.onClose();assert.equal(f.host.current().visible,true);
 setCurrentRuntime(undefined);successor.index.openSourceSwitch();successor.index.onPickSource(f.candidate(),scope);await settle();
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('same-Runtime-successor-lease-old-detach-and-runtime-unavailable');
}
{
 const f=fixture({shared:true,open:false,preview:true,failAcquire:true}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();x.mount().onSelectCandidate(f.candidate());await settle();
 const chain=failureChain(x),old=chain.render(),oldScope=x.index.sourceSwitchScopeId;
 x.index.nextNavigationGeneration();x.index.bindSourceSwitchReader(f.host);assert.notEqual(x.index.sourceSwitchScopeId,oldScope);
 chain.o.updateStateVars({sourceSwitchScopeId:x.index.sourceSwitchScopeId,sourceSwitchFailureMessage:x.index.sourceSwitchFailureMessage});
 const count=f.calls.length;old.retry();old.dismiss();await settle();assert.equal(f.calls.length,count);assert.equal(f.host.current().failureMessage,'换源暂时未完成，请重试或选择其他书源。');
 f.options.failAcquire=false;chain.render().retry();await settle();assert.ok(x.index.effects.some(e=>e.validated));
 assert.equal(f.calls.filter(([m])=>m==='acquire').length,2);assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('actual-Index-ReaderShell-retained-ReadingExperience-failure-lexical-scope-recovery');
}
for(const outcome of ['confirmed','platform-failure','Core-unknown']){
 const f=fixture({shared:true,open:false}),cacheAuthority=await actualCacheAuthorityFixture(true),x=makeIndex(f,{cacheAuthority});delete x.index.cleanupRetiredSourceCache;
 // Real isolated sandbox IO and actual cold Core receipts replace the obsolete
 // bare cache.clear stub; SourceSwitch keeps its existing controlled RPC seam.
 f.runtime.getUIAbilityContext=()=>({filesDir:cacheAuthority.files});
 const native=f.runtime.request.bind(f.runtime),cleanup=[];
 const admission=outcome==='confirmed'?{entered:deferred(),gate:deferred()}:undefined;
 if(admission){cacheAuthority.options.pauseMethod='cache.clear.operation.query';cacheAuthority.options.gate=admission.gate;}
 if(outcome==='Core-unknown')cacheAuthority.options.beforeMethod='cache.clear';
 f.runtime.request=async(method,params,options)=>{
  if(!method.startsWith('cache.clear'))return native(method,params,options);
  if(method==='cache.clear')cleanup.push(['Core',params]);
  const request=cacheAuthority.runtime.request(method,params,options);
  if(method==='cache.clear.operation.query'&&Object.keys(params).length===0)admission?.entered.resolve();
  return request;
 };
 f.runtime.clearOfflineBookImages=async(sourceId,bookId)=>{cleanup.push(['images',sourceId,bookId]);if(outcome==='platform-failure')throw Error('old cache images unavailable');};
 x.index.openDetailSourceSwitch();await settle();x.mount().onSelectCandidate(f.candidate());
 for(let i=0;i<200&&x.index.detailBook.sourceId!=='new';i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(x.index.detailBook.sourceId,'new','actual accepted source seam completes before visible reading commit');
 assert.equal(f.host.current().write.confirmation,'confirmed');
 const tx=f.host.current().pending.transactionId;f.setPhase('finalized');
 const offline=x.index.getReadingOfflineHost(f.runtime),previousGeneration=offline.snapshot()?.generation??0;
 x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});
 let completed=false;
 const completion=waitForRetiredSourceCleanup(offline,origin,previousGeneration,outcome).then(receipt=>{completed=true;return receipt;});
 if(admission){
  try{
   await Promise.race([admission.entered.promise,completion]);
   assert.equal(offline.busy(),true,'actual cleanup owns its mutex before cold Core admission completes');
   assert.equal(offline.snapshot().materialization,'running');
   assert.equal(cleanup.length,0,'the actual head query precedes the durable cache.clear dispatch');
   await settle();
   assert.equal(completed,false,'a pending admission cannot satisfy the terminal cleanup wait');
  }finally{admission.gate.resolve();}
 }
 const receipt=await completion;
 assert.equal(f.host.current().pending,undefined,'resource cleanup cannot undo actual source finalization');
 assert.equal(cleanup[0][0],'Core');assert.equal(cleanup[0][1].scope,'book');assert.equal(cleanup[0][1].sourceId,'old');assert.equal(cleanup[0][1].bookId,'book');
 assert.match(cleanup[0][1].operationId,/\/1$/);assert.equal(cleanup[0][1].sequence,1,'actual mandatory authority supplies one exact bounded original identity');
 assert.equal(receipt.sourceId,'old');assert.equal(receipt.bookId,'book');
 assert.equal(receipt.projection.receipt.confirmation,outcome==='Core-unknown'?'unknown':'confirmed');
 assert.equal(receipt.materialization,outcome==='confirmed'?'succeeded':'failed');
 assert.equal(cleanup.length,outcome==='Core-unknown'?1:2);
 if(outcome!=='Core-unknown')assert.ok(cacheAuthority.calls.some(c=>c.method==='cache.clear.operation.query'),'actual qualified receipt read precedes platform cleanup');
 x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});await settle();
 assert.equal(cleanup.length,outcome==='Core-unknown'?1:2,'repeated canonical notification cannot repeat old-source cleanup');
 checks.push('actual-Index-OffineHost-atomic-store-cold-Core-retired-source-'+outcome);
}
// The retained reading identity includes readyGeneration, while only the small
// temporary source overlay is keyed by the source owner scope.
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f,{reading:true});x.index.openSourceSwitch();await settle();
 const s=x.p.consumer(read('features/shell/ReaderShell.ets'),['sourceSwitchScopeId','sourceSwitchOverlayContent'],x.leafDeps,{sourceSwitchScopeId:x.index.sourceSwitchScopeId});
 Object.assign(s,{sourceId:'old',sourceSwitchState:x.index.sourceSwitchState,onCloseSourceSwitch:id=>x.index.closeSourceSwitch(id),
   onRetrySourceSwitch:id=>x.index.retrySourceSwitch(id),onRefreshSourceSwitch:id=>x.index.refreshSourceSwitch(id),
   onPickSource:(c,id)=>x.index.onPickSource(c,id),onRollbackSourceSwitch:id=>x.index.onRollbackSourceSwitch(id)});
 s.sourceSwitchOverlayContent();const old=x.p.walk(s).find(c=>c instanceof x.leafDeps.SourceSwitchPanel);old.onClose();
 x.index.openSourceSwitch();await settle();s.sourceSwitchScopeId=x.index.sourceSwitchScopeId;s.sourceSwitchState=x.index.sourceSwitchState;
 s.sourceSwitchOverlayContent();old.onClose();old.onSelectCandidate(f.candidate());await settle();assert.equal(f.host.current().visible,true);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('actual-ReaderShell-overlay-oldscope-preserved-without-reader-tree-remount');
}
// A target source commit still needs the real reader's body, selected physical
// page and canonical progress admission. The UI must follow these facts, and
// must relinquish its surface to the existing reader error on any failure.
{
 const source=read('features/reading/LocalReadingExperience.ets');
 const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
 // The SDK output depends on this fixed source/member/dependency graph, not
 // on scenario fields. Reuse its constructor while retaining a fresh actor,
 // actual property objects and callback ownership for every matrix entry.
 const p=boundedSurfaceSdk(),deps=sourceSwitchLiveSdk(p,{ReaderWindowCoordinator:{metrics:()=>metrics}});
 const compiled=createReaderBuilderProbe(source,['sourceSwitchTransactionId','phase','visibleFragments','sourceSwitchFailureMessage','reduceMotion','onSessionLaunchReduceMotionChanged',
    'shouldShowSourceSwitchPreparation','sourceSwitchPreparationContent',
    'sourceSwitchCompletion','readingReadyGeneration','sourceSwitchCompletionVisible','sourceSwitchRevealOpacity','sourceSwitchToastText',
    'sourceSwitchCompletionEpoch','sourceSwitchRevealAnimator','sourceSwitchToastTimer','consumedSourceSwitchCompletions',
    'sourceSwitchPendingCompletionKey','sourceSwitchPendingCompletionSelectionToken','sourceSwitchPendingCompletionLifecycleToken',
    'sourceSwitchPresentedRevision','sourceSwitchPresentedSelectionToken','sourceSwitchPresentedContinuous',
    'sourceSwitchCanonicalPageCurrent','onSourceSwitchPagePresented','hasContinuousRenderContent',
    'sourceSwitchCompletionKey','sourceSwitchCompletionCurrent','finishSourceSwitchReveal','cancelSourceSwitchCompletion',
    'sourceSwitchCompletionVisibleChanged','sourceSwitchCompletionChanged'],{...p.deps,...deps},p.hooks);
 const actors=[];
 const make=fields=>{
  const o=new compiled.Component(undefined,{});
  assert.equal(o.sourceSwitchToastText,'','each scenario starts with its own pristine completion state');
  for(const previous of actors){
   assert.notEqual(o,previous);assert.notEqual(o.nodes,previous.nodes);assert.notEqual(o.keys,previous.keys);
   assert.notEqual(o.watches,previous.watches);
   assert.notEqual(o.consumedSourceSwitchCompletions,previous.consumedSourceSwitchCompletions,'completion history is actor-local');
  }
  actors.push(o);
  Object.assign(o,{sourceSwitchTransactionId:'tx',phase:'loading',visibleFragments:[],visiblePage:undefined,
    sourceSwitchFailureMessage:'',visiblePageSelectionToken:-1,chapterSelectionToken:2,sessionGateway:undefined,
    isReaderIdentityCurrent:()=>true,sourceName:'新书源',chapterTitle:'第 20 章',chapter:undefined,reduceMotion:false,
    sourceId:'new',bookId:'target',mounted:true,exitRequested:false,appForeground:true,readingReadyGeneration:1,lifecycleToken:1,
    sourceSwitchCompletionVisible:true,materializedChapterSelectionToken:-1,pageTurnRenderRevision:2,
    continuousRenderRevision:4,continuousFragments:[],readerSettingsSnapshot:{navigationMode:'paged'},
    windowChromeActive:true,readerWindowMetricsRevision:1,readerStatusBarMetrics:()=>metrics,...fields});
  return{p,o,deps};
 };
 for(const fields of [{},
  {phase:'measuring',sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {phase:'ready',sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {phase:'ready',visiblePage:{startScalar:20},visibleFragments:[{}],visiblePageSelectionToken:1,sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {sourceSwitchTransactionId:undefined,sessionGateway:{hasPendingSourceSwitch:()=>true}},
 ])assert.equal(make(fields).o.shouldShowSourceSwitchPreparation(),true,'real preparation retains the surface before the current physical page');
 for(const fields of [{sourceSwitchTransactionId:undefined},
  {phase:'failed'}, {sourceSwitchFailureMessage:'目录读取失败'}, {isReaderIdentityCurrent:()=>false},
  {phase:'ready',visiblePage:{startScalar:20},visibleFragments:[{}],visiblePageSelectionToken:2,sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {sessionGateway:{hasPendingSourceSwitch:()=>false}},
 ])assert.equal(make(fields).o.shouldShowSourceSwitchPreparation(),false,'failure, retired owner, ready selected page and canonical completion relinquish preparation');
 const x=make({chapter:{chapterTitle:'准确章节 第 20 章'}});x.o.sourceSwitchPreparationContent();
 const progress=x.p.walk(x.o).find(c=>c instanceof x.deps.SourceSwitchProgress);assert.ok(progress);
 assert.equal(progress.sourceName,'新书源');assert.equal(progress.chapterTitle,'准确章节 第 20 章');
 assert.equal(progress.statusText,'正在载入章节…');assert.ok(x.p.nodes(progress).some(n=>n.create==='正在切换书源'));
 const spinner=x.p.walk(progress).find(c=>c instanceof x.deps.SourceSwitchSpinner);assert.ok(spinner);
 const ring=x.p.nodes(spinner).find(n=>n.type==='Shape');assert.equal(ring.width,36);assert.equal(spinner.shouldAnimate(),true);
 assert.equal(spinner.durationMs,1800);assert.equal(x.p.nodes(spinner).filter(n=>n.type==='Path').length,2);
 spinner.foreground=false;x.p.properties.flush();assert.equal(spinner.shouldAnimate(),false,'background pauses the actual SVG animator');assert.equal(ring.rotate.angle,0);
 spinner.foreground=true;spinner.reduceMotion=true;x.p.properties.flush();assert.equal(spinner.shouldAnimate(),false,'reduced motion keeps the real loading surface static');assert.equal(ring.rotate.angle,0);
 const ready=make({phase:'ready',chapter:{sourceId:'new',bookId:'target',chapterIndex:19,chapterTitle:'第 20 章',content:'当前章节真实正文'},
   visiblePage:{startScalar:0},visibleFragments:[{text:'当前章节真实正文',imageHeight:0}],visiblePageSelectionToken:2,
   materializedChapterSelectionToken:2});
 ready.o.sourceSwitchCompletion=new ready.deps.SourceSwitchCompletionPresentation('tx','new','target',1,'新书源',19,0);
 ready.p.properties.flush();
 assert.equal(ready.o.sourceSwitchToastText,'','phase ready without the resident revision cannot announce success');
 ready.o.onSourceSwitchPagePresented(ready.o.pageTurnRenderRevision-1);
 assert.equal(ready.o.sourceSwitchToastText,'','the prior native page revision cannot announce this chapter');
 ready.o.onSourceSwitchPagePresented(ready.o.pageTurnRenderRevision);
 assert.equal(ready.o.sourceSwitchToastText,'已切换至 新书源','real production canonical and current-revision guards admit completion');
 ready.o.cancelSourceSwitchCompletion();
 assert.equal(actors.length,13,'every positive, negative and rendered reader case retains an independent actor');
 checks.push('actual-target-reader-prepare-current-selection-ready-failure-stale-prop-foreground-reduced-motion');
}
// Exercise the metadata and overlay host on the actual SDK-emitted builders.
// Controlled child ports capture their real payloads; they do not imitate the
// source transaction, native sheet layout or its transition scheduling.
{
 class ChildPort {
  constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}
  updateStateVars(params){Object.assign(this.params,params);}
 }
 const panelSource=read('features/reading/SourceSwitchPanel.ets'),shellSource=read('features/shell/ReaderShell.ets');
 const windowSource=read('features/source/SourceSwitchWindow.ets'),indexSource=read('pages/Index.ets');
 const p=boundedSurfaceSdk(),deps=sourceSwitchLiveSdk(p,{ReaderWindowCoordinator:{metrics:()=>metricsApi.createDefaultReaderWindowMetrics()}});
 const factories=new Map(),actors=[];
 const capture=(source,names,childName,childSource,fields)=>{
  const key=JSON.stringify([source,names,childName,childSource]);
  let compiled=factories.get(key);
  if(compiled===undefined){
   compiled=createReaderBuilderProbe(source,names,{...p.deps,...deps,[childName]:ChildPort},
    {...p.hooks,childSources:{...p.hooks.childSources,[childName]:childSource}});
   factories.set(key,compiled);
  }
  const o=new compiled.Component(undefined,{});
  for(const previous of actors){assert.notEqual(o,previous);assert.notEqual(o.nodes,previous.nodes);assert.notEqual(o.children,previous.children);}
  actors.push(o);Object.assign(o,fields);
  return{p,o,child:()=>[...o.children.values()].find(c=>c instanceof ChildPort)};
 };
 const book={sourceId:'old',bookId:'book',title:'书名',author:'作者',sourceName:'当前书源',coverUrl:'cover',lastChapter:'最新章节 第 120 章'};
 const expectedCurve={kind:'cubic-bezier',values:[0.2,0.7,0.2,1]};
 const assertScrim=(probe,contentKind,scheme,reduceMotion)=>{
  const nodes=probe.p.nodes(probe.o).filter(n=>n.type==='Stack'&&typeof n.onClick==='function');
  assert.equal(nodes.length,1,'the real overlay has one dismissing scrim');
  const scrim=nodes[0];
  const expectedColor=scheme==='day'?'#731F1B17':'#52000000';
  assert.equal(scrim.backgroundColor,expectedColor,'detail and retained reader use the same selected scrim palette for both formats');
  assert.equal(scrim.width,'100%');assert.equal(scrim.height,'100%');
  if(reduceMotion){
   assert.equal(scrim.transition.kind,'identity','reduced motion preserves a static scrim for both formats');
  }else{
   assert.equal(scrim.transition.kind,'asymmetric');
   for(const [phase,duration] of [['appear',320],['disappear',280]]){
    const effect=scrim.transition.parameters[phase];
    assert.equal(effect.kind,'opacity');
    assert.equal(effect.options.duration,duration,'the scrim uses the selected drawer transition duration');
    assert.deepEqual(effect.options.curve,expectedCurve,'both hosts use the selected shared cubic curve');
   }
  }
 };
 for(const contentKind of ['text','manga'])for(const scheme of ['day','night'])for(const reduceMotion of [false,true]){
  const i=capture(indexSource,['sourceSwitchOverlayContent'],'SourceSwitchPanel',panelSource,{
   detailBook:{...book,contentKind},directoryChapterTitle:'正在阅读 第 20 章',sourceSwitchScopeId:7,
   sourceSwitchState:{kind:'candidates',candidates:[]},appThemeScheme:scheme,settingsSnapshot:{reduceMotion},
   canCancelMangaSourcePreparation:()=>false,readerOwnsWindowEdges:()=>false,
  });
  i.o.sourceSwitchOverlayContent();assert.equal(i.child().params.latestChapterTitle,book.lastChapter);
  assert.equal(i.child().params.currentChapterTitle,'正在阅读 第 20 章','the current reading chapter never replaces latest metadata');
  const expectedAlignment='Alignment.Bottom';
  assert.ok(i.p.nodes(i.o).some(n=>n.type==='Stack'&&n.create?.alignContent===expectedAlignment));
  assertScrim(i,contentKind,scheme,reduceMotion);
  const s=capture(shellSource,['sourceSwitchOverlayContent'],'SourceSwitchPanel',panelSource,{
   contentKind,bookTitle:book.title,bookAuthor:book.author,bookCoverUrl:book.coverUrl,sourceName:book.sourceName,
   sourceId:book.sourceId,latestChapterTitle:book.lastChapter,directoryChapterTitle:'正在阅读 第 20 章',
   sourceSwitchScopeId:7,sourceSwitchState:i.o.sourceSwitchState,appThemeScheme:scheme,reduceMotion,
  });
  s.o.sourceSwitchOverlayContent();assert.equal(s.child().params.latestChapterTitle,book.lastChapter);
  assert.ok(s.p.nodes(s.o).some(n=>n.type==='Stack'&&n.create?.alignContent===expectedAlignment));
  assertScrim(s,contentKind,scheme,reduceMotion);
  assert.equal(i.child().params.reduceMotion,reduceMotion);assert.equal(s.child().params.reduceMotion,reduceMotion);
  const panel=capture(panelSource,boundedMembers(panelSource),'SourceSwitchWindow',windowSource,s.child().params);
  panel.o.initialRender();assert.equal(panel.child().params.latestChapterTitle,book.lastChapter);
  assert.equal(panel.child().params.currentChapterTitle,'正在阅读 第 20 章');
 }
 // Select the exact Index -> retained ReaderShell payload rather than a test
 // copy, to catch mistakes between the book field and the shell property.
 const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
 const ts=require(sdk+'/node_modules/typescript'),tree=ts.createSourceFile(virtualFilePath('SourceSwitchMetadataBridge.ets'),indexSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
 let call;const visit=n=>{if(ts.isCallExpression(n)&&n.expression.getText(tree)==='ReaderShell')call=n;ts.forEachChild(n,visit);};visit(tree);
 const names=new Set(['latestChapterTitle','bookTitle','bookAuthor','bookCoverUrl','sourceName','sourceId','contentKind']);
 const fields=call.arguments[0].properties.filter(f=>names.has(f.name?.getText(tree))).map(f=>f.getText(tree));assert.equal(fields.length,names.size);
 const carrier=capture('@Component struct SourceMetadataPayload {@Builder payload(){ReaderShell({'+fields.join(',')+'});}build(){Column(){}}}',
  ['payload'],'ReaderShell',shellSource,{detailBook:book,readingContentKind:'text'});
 carrier.o.payload();assert.equal(carrier.child().params.latestChapterTitle,book.lastChapter);
 carrier.o.detailBook={...book,lastChapter:undefined};carrier.o.replay();assert.equal(carrier.child().params.latestChapterTitle,'','missing latest metadata stays empty');
 assert.equal(factories.size,4,'the exact Index/Shell/Panel/payload source graphs compile once each');
 assert.equal(actors.length,25,'both formats, both schemes and both motion states still execute all 24 independent host actors plus the metadata carrier');
 checks.push('actual-Index-ReaderShell-Panel-latest-chapter-payload-and-shared-drawer-both-content-hosts');
}
assert.equal(indexEmissions,1,'the immutable SDK graph is emitted once; all original independent actors still execute');
console.log(JSON.stringify({status:'PASS',checks,indexActors:indexActors.length,indexEmissions,scope:'actual Host/Gateway/full durable intent + Index delegates/seam + SDK Window/shared Row and metadata/drawer host builders; controlled runtime/native file boundary. Native layout/removal/focus/device remain separate.'}));

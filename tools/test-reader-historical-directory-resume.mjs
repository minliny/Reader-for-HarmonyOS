import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readingParagraphBoundaryMode } from '../entry/src/main/ets/features/reading/ReadingParagraphProjection.ts';
import { ReadingChapterWindow } from '../entry/src/main/ets/features/reading/ReadingChapterWindow.ts';
const {ReadingSessionFlowGateway}=await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const {RemoteChapterCacheRefreshError}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
let runtime;
const Owner=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),
 ['tryInitialEntrySnapshot','openChapter','loadSessionChapter','configureRestoredAnchor','lastVisibleScalar',
  'readingTocEntries','isKnownControlChapter','requireKnownChapter','adjacentChapterIndex','hydrateEntryCatalog',
  'loadNextTtsChapter','ttsChapterRef'],{
 readingParagraphBoundaryMode,RemoteChapterCacheRefreshError,LOCAL_READING_SOURCE_ID:'local',
 ReaderRuntimeOwner:{current:()=>runtime},hilog:{warn(){}},errorMessageOf:e=>e.message,
});
function body(index,resumeOnly,items){
 const current=items.find(e=>e.index===index),content=`cached body ${index}`;
 return{kind:'ready',sourceId:'s',bookId:'b',chapterIndex:index,chapterTitle:current.title,content,
  blocks:[{kind:'text',startScalar:0,endScalar:content.length,text:content}],baseUrl:`https://example.org/${index}`,
  positionScope:{sourceId:'s',bookId:'b',chapterIndex:index,bodyVersion:`body-${index}`,processingVersion:'processing'},
  progress:{sourceId:'s',bookId:'b',chapterIndex:40,chapterOffset:3,chapterProgress:.25,updatedAt:1,
   ...(index===40?{bodyVersion:'body-40',processingVersion:'processing'}:{})},
  ...(resumeOnly?{resumeOnly:true}:{}),
  navigation:{revision:'catalog',chapterCount:items.length,readableChapterCount:items.filter(e=>e.navigable).length,
   current,before:items.filter(e=>e.navigable&&e.position<current.position).slice(-3),
   after:items.filter(e=>e.navigable&&e.position>current.position).slice(0,3)}};
}
async function fixture(onlyGroup=false){
 const items=(onlyGroup?[40]:[10,40,50,60,70]).map((index,position)=>({index,position,title:`chapter ${index}`,
  navigable:![40,60].includes(index),...(![40,60].includes(index)?{readablePosition:[10,50,70].indexOf(index)}:{})}));
 const calls=[],measurements=[],failures=[];let alive=true;
 runtime={supportsCoreCapability:c=>['reading.entry.snapshot.v1','reading.catalog.page.v1'].includes(c),
  captureReadingContentValidity:()=>()=>alive,
  request:async(method,params)=>{
   calls.push({method,params});
   if(method==='reading.catalog.page')return{data:{kind:'ready',sourceId:'s',bookId:'b',revision:'catalog',
    chapterCount:items.length,readableChapterCount:items.filter(e=>e.navigable).length,offset:0,entries:items}};
   assert.equal(method,'reading.entry.snapshot','restoration must not fetch group HTTP/content');
   if(params.chapterIndex===40)return{data:{kind:'missing',sourceId:'s',bookId:'b',reason:'directoryNodeNotReadable'}};
   return{data:body(params.chapterIndex??40,params.chapterIndex===undefined,items)};
  },bookAcquisitions:()=>({acquireBookWithBackgroundRefresh:async()=>{throw Error('unexpected online acquisition');}})};
 const gateway=await ReadingSessionFlowGateway.open({sourceId:'s',bookId:'b',remoteBookSeed:{sourceId:'s',bookId:'b',
  detailUrl:'b',title:'book',author:'author'},isCurrent:()=>alive,resolveSourceSwitchTransactionId:async()=>undefined,
  onRemoteSessionReady(){assert.fail('group restore must remain cache only');}},runtime);
 const owner=Object.assign(new Owner(),{sourceId:'s',bookId:'b',mounted:true,lifecycleToken:1,chapterSelectionToken:1,
  phase:'loading',entryCatalogPending:false,chapterWindow:new ReadingChapterWindow(),
  normalizedRequestedChapter(){return this.requestedChapterIndex;},activeGateway:()=>gateway,
  isSelectionActive:()=>alive,isSessionActive:()=>alive,admitTocEntries(entries){this.tocEntries=entries;},
  ensureCurrentContentMetrics:async()=>true,admitChapterContentVersion(){},retainCurrentChapterWindow(){},
  rebuildChapterImageIndexes(){},hasMeasuredViewport:()=>true,
  beginMeasurement(){measurements.push([this.chapter.chapterIndex,this.desiredChapterOffset]);this.phase='ready';},
  notifyPreservedContentRefresh(){},fail:error=>failures.push(error),releaseUnretainedReadingImages(){},
  onDirectoryProjectionChanged(){},schedulePageTurnPreparation(){},drainRapidPageTurn(){},resumePendingAutoPageTurn(){},
  ttsState:{chapterIndex:40,sessionGeneration:1,positionGeneration:0},ttsTimerMode:'duration',
  ttsPageFollow:{lease:()=>({sessionGeneration:1,positionGeneration:0})},ttsFollowScope:()=>({}),selectChapterAnchor(){},
 });
 return{owner,gateway,calls,measurements,failures,stop(){alive=false;}};
}
for(const onlyGroup of [false,true]){
 const f=await fixture(onlyGroup);
 assert.equal(await f.owner.tryInitialEntrySnapshot(1,1,Promise.resolve([])),true);
 assert.deepEqual(f.failures,[]);assert.deepEqual(f.measurements,[[40,3]],'production openChapter reaches native measurement with saved scalar');
 assert.equal(f.owner.resumeOnlyChapterIndex,40);assert.equal(f.owner.isKnownControlChapter(40),false);
 assert.throws(()=>f.owner.requireKnownChapter(40),/TOC/);
 assert.equal(f.owner.tocEntries.find(e=>e.index===40).navigable,false);
 assert.equal(f.calls.length,1,'snapshot and first body share the same proven Core result');
 await f.owner.hydrateEntryCatalog();assert.equal(f.owner.entryCatalogPending,false);
 assert.deepEqual(f.failures,[]);assert.equal(f.owner.chapterWindow.get(40).bodyVersion,'body-40');
 const next=await f.owner.loadNextTtsChapter({sourceId:'s',bookId:'b',chapterIndex:40},1);
 if(onlyGroup){assert.equal(next,undefined);assert.equal(f.owner.adjacentChapterIndex(40,1),undefined);continue;}
 assert.equal(next.chapter.chapterIndex,50,'TTS continues only to the next true chapter');
 await f.owner.openChapter(50,false,1,1,0);
 assert.deepEqual(f.failures,[]);assert.deepEqual(f.measurements.at(-1),[50,0]);
 assert.equal(f.owner.resumeOnlyChapterIndex,undefined);assert.equal(f.owner.chapterWindow.get(40),undefined);
 assert.equal(f.owner.adjacentChapterIndex(50,-1),10,'going back skips the revoked group');
 assert.equal(f.owner.adjacentChapterIndex(50,1),70,'future group is excluded too');
 assert.equal(f.calls.filter(c=>c.params.chapterIndex===40).length,0);
}
for(const kind of ['explicit','bookmark','unproved','stale']){
 const f=await fixture();
 const snapshot=await f.gateway.loadEntrySnapshot(undefined,()=>true);
 if(kind==='explicit')f.owner.requestedChapterIndex=40;
 if(kind==='bookmark')f.owner.requestedBookmarkAnchor={chapterIndex:40};
 if(kind==='unproved')snapshot.resumeOnly=undefined;
 if(kind==='stale')f.stop();
 assert.equal(f.owner.admitEntryResume(snapshot),false,kind);
 assert.equal(f.owner.resumeOnlyChapterIndex,undefined);
}
console.log('PASS actual snapshot/gateway/reading-owner/window: historical current reaches measurement, hydration and real next chapter; selection/TTS isolation and leave revocation. Native shaping is a fixture, not device first-frame evidence.');

for(const failure of ['none','scope','changed-current','revoked']){
 const f=await fixture();
 const request=runtime.request;
 runtime.supportsCoreCapability=c=>['reading.entry.snapshot.v1','reading.entry.snapshot.window.v1','reading.catalog.page.v1'].includes(c);
 runtime.bookAcquisitions=undefined;
 const fullContent='cached body 40\nsecond paragraph\nlast paragraph';
 runtime.request=async(method,params)=>{
  const result=await request(method,params);
  if(result.data.kind!=='ready'||method!=='reading.entry.snapshot')return result;
  const data=result.data;
  data.content=params.windowScalarLimit===undefined?fullContent:'cached body 40\nsecond';
  data.blocks=[{kind:'text',startScalar:0,endScalar:data.content.length,text:data.content}];
  if(params.windowScalarLimit!==undefined)data.documentWindow={startScalar:0,endScalar:data.content.length,totalScalars:fullContent.length,requestedScalar:3};
  else if(failure==='scope'){
   data.positionScope.bodyVersion='changed';data.progress.bodyVersion='changed';
  }else if(failure==='changed-current'){
   data.chapterIndex=50;data.positionScope.chapterIndex=50;data.progress.chapterIndex=50;
   data.navigation.current={index:50,position:2,readablePosition:1,title:'chapter 50',navigable:true};
   data.navigation.after=data.navigation.after.filter(e=>e.index!==50);
   delete data.resumeOnly;
  }
  return result;
 };
 assert.equal(await f.owner.tryInitialEntrySnapshot(1,1,Promise.resolve([])),true);
 const chapter=f.owner.chapter;
 assert.ok(chapter.documentRange,'actual initial restore supplies a partial body');
 if(failure==='revoked')f.gateway.clearEntryResume();
 if(failure==='none'){
  const full=await f.gateway.completeEntryChapter(chapter,()=>true);
  assert.equal(full.content,fullContent);assert.equal(full.documentRange,undefined);
  assert.equal(f.calls.at(-1).params.chapterIndex,undefined,'Core must reprove the implicit durable resume');
  assert.equal(f.calls.at(-1).params.positionContext,undefined);
 }else await assert.rejects(f.gateway.completeEntryChapter(chapter,()=>true),/expansion/);
}
console.log('PASS partial historical entry full-body expansion reproves implicit current scope; changed identity/version and revoked owner reject');

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
for(const change of ['none','scope','position','late','stale','explicit']){
 const f=await fixture(),request=runtime.request,started=deferred(),release=deferred(),secondRelease=deferred();
 await f.gateway.ensureSourceSwitchAdmission(()=>true);
 let durable={sourceId:'s',bookId:'b',chapterIndex:40,chapterOffset:3,chapterProgress:.25,updatedAt:1,
  bodyVersion:'body-40',processingVersion:'processing',locationRevision:'old'};
 let writes=0,lateWrite;
 const layout={viewportWidth:390,viewportHeight:800,fontScale:1};
 const anchor={chapterIndex:40,chapterOffset:5,chapterProgress:.5,bodyVersion:'body-40',processingVersion:'processing'};
 runtime.request=async(method,params)=>{
  if(method==='reading.progress.get')return{data:{found:true,progress:{...durable}}};
  if(method==='reading.progress.update'){
   writes++;
   if(writes===1){started.resolve();await release.promise;}else await secondRelease.promise;
   durable={...durable,chapterOffset:params.chapterOffset,chapterProgress:params.chapterProgress,locationRevision:`saved-${writes}`};
   return{data:{stored:true,...durable}};
  }
  const result=await request(method,params);
  if(method==='reading.entry.snapshot'&&params.chapterIndex===undefined){
   result.data.progress={...durable};
   if(change==='scope')result.data.positionScope.bodyVersion=result.data.progress.bodyVersion='changed';
   if(change==='position')result.data.progress.chapterOffset=6;
   if(change==='late')lateWrite=f.gateway.persistPresentedProgress('b','chapter 40',{...anchor,chapterOffset:7},layout);
  }
  return result;
 };
 const pending=f.gateway.persistPresentedProgress('b','chapter 40',anchor,layout);
 await started.promise;
 if(change==='explicit')f.owner.requestedChapterIndex=40;
 const restoring=f.owner.tryInitialEntrySnapshot(1,1,Promise.resolve([]));
 await settle();assert.equal(f.calls.some(c=>c.method==='reading.entry.snapshot'&&c.params.chapterIndex===undefined),false,
  'restore cannot reprove durable history before the existing write completes');
 if(change==='stale')f.stop();
 release.resolve();
 await pending.catch(()=>{});
 const result=await restoring;
 secondRelease.resolve();await lateWrite?.catch(()=>{});
 if(change==='none'){
  assert.equal(result,true);assert.deepEqual(f.measurements,[[40,5]]);
  assert.equal(f.owner.resumeOnlyChapterIndex,40);assert.equal(writes,1,'resume uses the existing write without a second progress commit');
 }else{
  assert.deepEqual(f.measurements,[],change);assert.equal(f.owner.resumeOnlyChapterIndex,undefined,change);
  if(change!=='stale')assert.equal(result,false,change);
 }
}
console.log('PASS actual serial progress owner short reopen: durable write before implicit proof, saved offset restored; scope/offset drift, later intent, explicit selection and stale lifecycle reject');

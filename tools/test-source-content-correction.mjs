import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReadingSessionFlowGateway}=await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const {readReadingEntrySnapshot,readPreparedReadingEntrySnapshot}=await import('../entry/src/main/ets/features/reading/ReadingEntrySnapshot.ts');
const {ReadingChapterWindow}=await import('../entry/src/main/ets/features/reading/ReadingChapterWindow.ts');
const {ReadingEntryPreparation}=await import('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
const {BookAcquisitionCoordinator}=await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const Owner=productionMotionMethods(fileURLToPath(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url)),
 ['request','requestDirect','bookAcquisitions','readingEntryPreparations','captureReadingContentValidity'],
 {BookAcquisitionCoordinator,ReadingEntryPreparation,DEFAULT_CORE_REQUEST_TIMEOUT_MS:30000,
  httpResponseFailureSummary:()=>undefined,hilog:{warn(){}},LOG_DOMAIN:0});
const sourceId='https://m.popofree.com#🎃',bookId='b';
function fixture({damaged=true,preserved=false}={}) {
 const calls=[];let corrected=!damaged,live=true;
 const body=()=>{
  const content=corrected?'甲😀"乙"末尾':'甲😀quot;乙quot;末尾';const length=[...content].length;
  const bodyVersion=corrected?'new-body':'old-body',processingVersion=corrected?'new-processing':'old-processing';
  return {kind:'ready',sourceId,bookId,chapterIndex:833,chapterTitle:'章',content,
   blocks:[{kind:'text',text:content,startScalar:0,endScalar:length}],
   positionScope:{sourceId,bookId,chapterIndex:833,bodyVersion,processingVersion},
   progress:{sourceId,bookId,chapterIndex:833,chapterOffset:corrected?3:7,chapterProgress:0.4,updatedAt:20,bodyVersion,processingVersion},
   progressRevision:'p',baseUrl:'https://m.popofree.com/novel/100749/34583368.html',sourceCorrectionRequired:!corrected,
   contentRefreshRequired:false,navigation:{revision:'r',chapterCount:1,readableChapterCount:1,
    current:{index:833,position:0,readablePosition:0,title:'章',navigable:true},before:[],after:[]}};
 };
 const owner=new Owner();
 Object.assign(owner,{state:'ready',optionalEntryMemoryEnabled:true,start:async()=>{},wakeReadingPreparations(){},
  supportsCoreCapability:capability=>['reading.entry.snapshot.v1','reading.entry.firstFrame.v1'].includes(capability),
  readPreparedEntry:()=>body(),runtime:{request:async(method,params,options)=>{
   calls.push({method,params});assert.equal(options.shouldCancel?.(),false,'mutation must not cancel its own foreground intent');
   if(method==='reading.entry.snapshot')return{data:body()};
   assert.equal(method,'chapter.content');assert.equal(params.upgradeCachedContent,true);
   assert.equal(params.chapterUrl,undefined);assert.equal(params.chapterRequest,undefined);assert.equal(params.forceRefresh,undefined);
   const captured=params.positionContext;assert.equal(captured.bodyVersion,'old-body');
   if(!preserved)corrected=true;
   const next=body(),scope=next.positionScope;
   const mapped=captured.anchors.map(a=>({...a,previousOffset:a.offset,offset:preserved?a.offset:a.offset===7?3:a.offset}));
   return{data:{sourceId,bookId,chapterTitle:'章',content:next.content,bodyVersion:scope.bodyVersion,
    processingVersion:scope.processingVersion,sourceCorrectionRequired:!corrected,positionMigration:{
     status:preserved?'preserved':'committed',previousBodyVersion:'old-body',previousProcessingVersion:'old-processing',
     bodyVersion:scope.bodyVersion,processingVersion:scope.processingVersion,anchors:mapped,progress:next.progress}}};
  }}});
 const intent={sourceId,bookId,remoteBookSeed:{sourceId,bookId,detailUrl:bookId,title:'终宋',author:'作者'},
  isCurrent:()=>live,resolveSourceSwitchTransactionId:async()=>undefined};
 return{calls,owner,intent,body,stop:()=>live=false,close(){owner.entryPreparations?.close();owner.bookCoordinator?.close();}};
}

// Actual Owner -> Coordinator -> scheduler -> preparation mutation fences, with
// only the Core transport mocked. Core's transaction itself has Rust coverage.
for(const anchored of [false,true]) {
 const f=fixture(),gateway=await ReadingSessionFlowGateway.open(f.intent,f.owner);
 assert.equal(readPreparedReadingEntrySnapshot(f.owner,sourceId,bookId,undefined,()=>true,'text'),undefined,
  'known damaged prepared body cannot become the first visible page');
 const old=await readReadingEntrySnapshot(f.owner,sourceId,bookId,833,()=>true);
 const revision=f.owner.bookAcquisitions().readingProjectionRevision();
 const context=anchored?{bodyVersion:'old-body',processingVersion:'old-processing',anchors:[{id:'bookmark',offset:7}]}:undefined;
 const result=await gateway.loadEntrySnapshot(833,()=>true,context);
 assert.equal(result.chapter.content,'甲😀"乙"末尾');assert.equal(result.chapter.sourceCorrectionRequired,false);
 assert.equal(result.progress.progress.chapterOffset,3);assert.equal(result.isCurrent(),true);
 assert.equal(old.isCurrent(),false,'upgrade invalidates the old content capture');
 assert.ok(f.owner.bookAcquisitions().readingProjectionRevision()>revision,'old layout/session projections are retired');
 assert.equal(f.calls.filter(c=>c.method==='chapter.content').length,1);
 const admitted=await gateway.loadChapter(bookId,833,()=>true,false,context);
 assert.equal(admitted.content,result.chapter.content,'the original bookmark scope uses its migration receipt');
 assert.equal(f.calls.filter(c=>c.method==='chapter.content').length,1,'retained repaired body is not repaired twice');
 if(anchored)assert.equal(admitted.positionMigration.anchors[0].offset,3);
 f.close();
}
{
 const f=fixture({damaged:false}),gateway=await ReadingSessionFlowGateway.open(f.intent,f.owner);
 const result=await gateway.loadEntrySnapshot(833,()=>true);assert.equal(result.chapter.sourceCorrectionRequired,false);
 assert.equal(f.calls.length,1,'ordinary cached chapters still take one snapshot call');f.close();
}
{
 const f=fixture();f.owner.allowSourceContentCorrection=false;
 const gateway=await ReadingSessionFlowGateway.open(f.intent,f.owner);
 assert.equal(await gateway.loadEntrySnapshot(833,()=>true),undefined,'background work treats damaged content as a miss');
 assert.equal(f.calls.filter(c=>c.method==='chapter.content').length,0);
 assert.equal(gateway.retainedEntrySnapshot,undefined,'background work cannot retain the damaged first page');f.close();
}
{
 const f=fixture(),gateway=await ReadingSessionFlowGateway.open(f.intent,f.owner);
 await assert.rejects(gateway.prefetchChapter(bookId,833,()=>true),/foreground reading/);
 assert.equal(f.calls.filter(c=>c.method==='chapter.content').length,0,'neighbour preparation never repairs');
 const corrected=await gateway.loadEntrySnapshot(833,()=>true);assert.equal(corrected.chapter.sourceCorrectionRequired,false);f.close();
}
{
 const f=fixture({preserved:true}),gateway=await ReadingSessionFlowGateway.open(f.intent,f.owner);
 await assert.rejects(gateway.loadEntrySnapshot(833,()=>true),/source correction publication/);
 assert.equal(gateway.retainedEntrySnapshot,undefined,'preserved old body is not presented as a successful repair');f.close();
}
{
 const f=fixture(),snapshot=await readReadingEntrySnapshot(f.owner,sourceId,bookId,833,()=>true);
 const window=new ReadingChapterWindow();window.configure(sourceId,bookId,[833]);
 assert.throws(()=>window.setCurrent(snapshot.chapter),/foreground reading/);
 assert.equal(window.admitNeighbour(snapshot.chapter),false);f.close();
}
function deferred(){let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};}
async function settle(){for(let n=0;n<40;n++)await Promise.resolve();}
for(const lostReceipt of [false,true]) {
 const f=fixture(),gateway=await ReadingSessionFlowGateway.open(f.intent,f.owner);
 await gateway.ensureSourceSwitchAdmission(()=>true);
 const original=f.owner.runtime.request,capability=f.owner.supportsCoreCapability;
 f.owner.supportsCoreCapability=value=>value==='reading.progress.compareAndSet.v1'||capability(value);
 const submitted=deferred(),releaseWrite=deferred(),upgradeEntered=deferred(),releaseUpgrade=deferred();
 const order=[];let revision=1,writes=0;
 let durable={...f.body().progress,chapterOffset:0,locationRevision:'position-1'};
 f.owner.runtime.request=async(method,params,options)=>{
  if(method==='reading.progress.get'){
   order.push('progress-read');return{data:{found:true,progress:{...durable},progressRevision:`op:${revision}`}};
  }
  if(method==='reading.progress.update'){
   order.push('progress-write');writes++;
   if(writes===1){submitted.resolve();await releaseWrite.promise;}
   assert.equal(options.shouldCancel?.(),false);
   const current=f.body().positionScope;
   assert.equal(params.expectedBodyVersion,current.bodyVersion);
   assert.equal(params.expectedProcessingVersion,current.processingVersion);
   assert.equal(params.expectedProgressRevision,`op:${revision}`);
   durable={sourceId,bookId,chapterIndex:params.chapterIndex,chapterOffset:params.chapterOffset,
    chapterProgress:params.chapterProgress,bodyVersion:params.expectedBodyVersion,
    processingVersion:params.expectedProcessingVersion,updatedAt:++revision,locationRevision:`position-${revision}`};
   if(writes===1&&lostReceipt)throw Error('receipt lost after storage');
   return{data:{stored:true,...durable}};
  }
  if(method==='chapter.content'){
   order.push('upgrade');assert.equal(durable.chapterOffset,7,'prior durable position exists before Core captures it');
   upgradeEntered.resolve();await releaseUpgrade.promise;
   const result=await original(method,params,options);durable={...f.body().progress,locationRevision:'position-repaired'};revision++;
   return result;
  }
  return original(method,params,options);
 };
 const layout={viewportWidth:390,viewportHeight:800,fontScale:1};
 const anchor={chapterIndex:833,chapterOffset:7,chapterProgress:0.4,bodyVersion:'old-body',processingVersion:'old-processing'};
 const pending=gateway.persistPresentedProgress(bookId,'章',anchor,layout);
 const pendingResult=lostReceipt?assert.rejects(pending,/receipt lost/):pending;
 await submitted.promise;
 const repairing=gateway.loadEntrySnapshot(833,()=>true);await settle();
 assert.equal(order.includes('upgrade'),false,'repair waits for an already dispatched progress write');
 releaseWrite.resolve();await pendingResult;await upgradeEntered.promise;
 await assert.rejects(gateway.persistPresentedProgress(bookId,'章',anchor,layout),/TRANSACTION_PENDING/);
 if(lostReceipt)assert.equal(order.at(-2),'progress-read','unknown write is reconciled before body mutation');
 releaseUpgrade.resolve();const corrected=await repairing;
 assert.equal(writes,1,'unknown successful write is not blindly replayed');
 const saved=await gateway.persistPresentedProgress(bookId,'章',{...anchor,chapterOffset:3,
  bodyVersion:corrected.chapter.bodyVersion,processingVersion:corrected.chapter.processingVersion},layout);
 assert.equal(saved.chapterOffset,3);assert.equal(writes,2);f.close();
}
console.log('PASS foreground correction: real Owner/Coordinator/Preparation fencing, no self-cancel, old captures retired, bookmark handoff, normal cache, background and neighbour refusal, preserved-result failure, dispatched/unknown progress serialization and new-scope persistence');

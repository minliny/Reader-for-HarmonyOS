import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const root='file:///Users/minliny/Documents/Reader/Reader-for-HarmonyOS/';
const {BookAcquisitionCoordinator}=await import(root+'entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const {ReadingEntryPreparation}=await import(root+'entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
const {productionMotionMethods}=await import(root+'tools/lib/reader-motion-method-probe.mjs');
const Owner=productionMotionMethods(new URL(root+'entry/src/main/ets/app/ReaderRuntimeOwner.ts'),['request','requestDirect','bookAcquisitions','readingEntryPreparations'],{BookAcquisitionCoordinator,ReadingEntryPreparation,DEFAULT_CORE_REQUEST_TIMEOUT_MS:30000,httpResponseFailureSummary:()=>undefined,hilog:{warn(){}},LOG_DOMAIN:0});
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const background=deferred(),foreground=deferred(),calls=[];
const intent={schemaVersion:1,sourceId:'s',bookId:'b',revision:1,sourceVersion:'v1',reason:'read',state:'active',updatedAt:1};
let bgOptions,fgOptions;
const owner=Object.assign(new Owner(),{state:'ready',optionalEntryMemoryEnabled:true,start:async()=>{},wakeReadingPreparations(){},supportsCoreCapability:()=>true,runtime:{request:async(method,params,options)=>{
 calls.push({method,params,timeout:options.timeoutMs});
 if(method==='reading.preparation'){
  if(params.action==='block')intent.state='blocked';
  return{data:{intents:[{...intent}]}};
 }
 if(method==='reading.entry.prepare')return{data:{sourceId:'s',bookId:'b',chapterIndex:0,kind:'missing',reason:'contentMissing'}};
 assert.equal(method,'cache.book.prefetch');
 if(params.preparationRevision!==undefined){bgOptions=options;return background.promise;}
 fgOptions=options;return foreground.promise;
}}});
const coordinator=owner.bookAcquisitions();
const running=coordinator.resumeReadingPreparations(()=>true);
while(bgOptions===undefined)await tick();
assert.equal(bgOptions.shouldCancel(),false);
const manual=owner.request('cache.book.prefetch',{sourceId:'s',bookId:'b',chapterRange:[0,8],priority:0,requestedAt:1},{timeoutMs:300000,shouldCancel:()=>false});
while(fgOptions===undefined)await tick();
assert.equal(bgOptions.shouldCancel(),true,'manual request preempts only background');
assert.equal(fgOptions.shouldCancel(),false,'manual request remains current');
assert.equal(fgOptions.timeoutMs,300000,'manual timeout preserved across Host stack');
assert.equal(calls.filter(c=>c.method==='cache.book.prefetch').length,2,'foreground dispatch does not await background retirement');
foreground.resolve({data:{sourceId:'s',bookId:'b',materializations:[],prefetchedCount:0}});await manual;
background.reject(Error('Reader-Core request cancelled by caller: 1'));await running;
console.log(JSON.stringify({calls,state:intent.state},null,2));
owner.entryPreparations?.close();coordinator.close();
assert.equal(intent.state,'active','transient foreground preemption must not block durable preparation');

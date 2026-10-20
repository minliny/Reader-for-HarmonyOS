import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReadingEntryPreparation}=await import('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
const {BookAcquisitionCoordinator}=await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const {readerRuleMutationEffects}=await import('../entry/src/main/ets/app/ReaderRuleMutationEffects.ts');
const {RULES_MUTATION_METHODS}=await import('../entry/src/main/ets/features/settings/RulesMutationContract.ts');
const core=process.env.READER_CORE_ROOT??resolve('../Reader-Core');
const {ReaderCoreRuntime}=await import(pathToFileURL(resolve(core,'bindings/harmony/sdk/reader_core.ts')).href);
const file=new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url);
const direct=overrides=>productionMotionMethods(file,['requestDirect'],{DEFAULT_CORE_REQUEST_TIMEOUT_MS:1000,
 coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined,hilog:{warn(){}},...overrides});
const payload=method=>({operationId:'00000000-0000-4000-8000-000000000001',sequence:1,
 mutation:{method,params:method==='replace.persist'?{operation:'update',params:{id:3,replacement:'after'}}:
 method==='source.update'?{sourceId:'s',enabled:false}:method==='source.delete'?{sourceIds:['s']}:{id:3}}});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(negative=false){
 const queue=[],calls=[];let complete=true;
 const native={createRuntime:()=>1,releaseRuntime(){},abiVersion:()=>1,lastError:()=>null,
  sendCommand(_runtime,command){calls.push(command);if(complete)queue.push({protocolVersion:1,type:'result',requestId:command.requestId,data:{qualified:true}});},
  readEvent:()=>{const event=queue.shift();return event===undefined?null:JSON.stringify(event);},cancelRequest(){},completeHostRequest(){},failHostRequest(){}};
 const sdk=new ReaderCoreRuntime(native); const Owner=direct(negative?{readerRuleMutationEffects:(method,params)=>({method,params})}:{});
 const owner=Object.assign(new Owner(),{state:'ready',preparationIntentEpoch:0,start:async()=>{},runtime:sdk,wakes:0,
  wakeReadingPreparations(){this.wakes++;}});
 const preparations=new ReadingEntryPreparation(owner,false);
 owner.readingEntryPreparations=()=>preparations;
 const acquisition=new BookAcquisitionCoordinator((method,params,options)=>owner.requestDirect(method,params,options));
 return{owner,preparations,acquisition,sdk,calls,queue,complete:v=>{complete=v;},close(){preparations.close();acquisition.close();sdk.close();}};
}
const checks=[];
for(const original of RULES_MUTATION_METHODS){
 const f=fixture(),tuple=payload(original);
 const changesBody=['replace.persist','dict-rule.put','dict-rule.delete','rule-bundle.import','reader.chinese-conversion.put','source.import','source.update','source.delete'].includes(original);
 const current=f.preparations.captureContentValidity('s','b');
 await f.acquisition.request('rules.mutation.apply',tuple);
 assert.equal(current(),!changesBody,original+' preserves original preparation semantics');
 assert.equal(f.acquisition.readingProjectionRevision(),changesBody?2:0,original+' preserves original acquisition semantics');
 assert.equal(f.owner.wakes,['replace.persist','reader.chinese-conversion.put','source.update'].includes(original)?1:0,original+' preserves original wake policy');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].method,'rules.mutation.apply');assert.deepEqual(f.calls[0].params,tuple,
  'classification never unwraps the dispatched typed receipt or changes full original DTO');f.close();
}
checks.push('all registered original rules keep preparation/acquisition/wake effects; subscription metadata never invalidates book content');
{
 const f=fixture();f.complete(false);const old=f.preparations.captureContentValidity('s','b');let dispatched=0;
 const request=f.acquisition.request('rules.mutation.apply',payload('replace.persist'),{onDispatch:()=>dispatched++});
 await tick();assert.equal(dispatched,1);assert.equal(f.calls.length,1);assert.equal(old(),false,'content retired before native write');
 let idle=false;const idleWait=f.preparations.waitForContentIdle('s','b').then(()=>{idle=true;});await tick();assert.equal(idle,false);
 const id=f.calls[0].requestId;f.queue.push({protocolVersion:1,type:'error',requestId:id,error:{code:'Internal',message:'original durable outcome unavailable',retryable:false}});
 await assert.rejects(request,/original durable outcome unavailable/);await idleWait;assert.equal(idle,true);
 assert.equal(old(),false,'lost/unknown ACK cannot revive old prepared body');assert.equal(f.owner.wakes,1);f.close();
 checks.push('actual SDK in-flight fence and qualified error retain retired body without replay');
}
for(const [method,tuple] of [['rules.mutation.query',payload('replace.persist')],['rules.mutation.apply',{...payload('replace.persist'),sequence:0}],
 ['rules.mutation.apply',{...payload('replace.persist'),mutation:{method:'future.source.delete',params:{sourceIds:['s']}}}],
 ['rules.mutation.apply',{...payload('replace.persist'),mutation:{method:'replace.persist',params:[]}}]]){
 const f=fixture(),old=f.preparations.captureContentValidity('s','b');
 await f.acquisition.request(method,tuple);assert.equal(old(),true);assert.equal(f.acquisition.readingProjectionRevision(),0);assert.equal(f.owner.wakes,0);f.close();
}
checks.push('pure query and malformed/future envelope cannot impersonate an original reading mutation');
{
 const f=fixture(true);await f.acquisition.request('rules.mutation.apply',payload('replace.persist'));
 assert.throws(()=>assert.equal(f.owner.wakes,1),'removing only actual Runtime unwrap breaks original wake');f.close();
 const tuple=payload('replace.persist');assert.equal(readerRuleMutationEffects('rules.mutation.apply',tuple).method,'replace.persist');
}
checks.push('negative production Runtime dependency proves missing unwrap is detected');
for (const original of ['bookshelf.remove','bookshelf.removeBatch']) {
 const params=original==='bookshelf.remove' ? {sourceId:'s',bookId:'b'} : {targets:[{sourceId:'s',bookId:'b'}]};
 const directCase=fixture(),wrapped=fixture(),negative=fixture(true);
 const beforeDirect=directCase.preparations.captureContentValidity('s','b'),beforeWrapped=wrapped.preparations.captureContentValidity('s','b');
 await directCase.acquisition.request(original,params);
 const tuple={operationId:'00000000-0000-4000-8000-000000000001',sequence:1,mutation:{method:original,params}};
 await wrapped.acquisition.request('bookshelf.management.mutation.apply',tuple);
 assert.equal(beforeDirect(),false);assert.equal(beforeWrapped(),false);
 assert.equal(wrapped.owner.preparationIntentEpoch,directCase.owner.preparationIntentEpoch);
 assert.equal(wrapped.acquisition.preparationGeneration,directCase.acquisition.preparationGeneration);
 assert.equal(wrapped.owner.wakes,0);assert.deepEqual(wrapped.calls[0].params,tuple);
 assert.equal(wrapped.calls[0].method,'bookshelf.management.mutation.apply');
 await negative.acquisition.request('bookshelf.management.mutation.apply',tuple);
 assert.notEqual(negative.owner.preparationIntentEpoch,wrapped.owner.preparationIntentEpoch,'removing actual Runtime classification loses its destructive intent epoch');
 for(const f of [directCase,wrapped,negative])f.close();
}
checks.push('single/batch typed removal preserves existing destructive preparation fences without rewriting SDK dispatch');

console.log(JSON.stringify({pass:true,checks,boundary:'actual three owners and Core SDK; controlled native event transport, no Core atomic receipt or HarmonyOS target claim'},null,2));

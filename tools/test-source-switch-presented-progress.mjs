import assert from 'node:assert/strict';
import {fixture as ownerFixture,deferred,settle as microtasks,ReadingSessionFlowGateway,session} from './lib/source-switch-owner-probe.mjs';
const settle=async()=>{await microtasks();await new Promise(setImmediate);await microtasks();};
const layout={viewportWidth:390,viewportHeight:800,fontScale:1};
const displayed={chapterIndex:988,chapterOffset:125,chapterProgress:0.25,bodyVersion:'body',processingVersion:'processing'};
function fixture({writeGate,failReads=0,failWrites=false,loseReceipt=false,commitGate}={}){
 const f=ownerFixture({commitGate,matchedChapterIndex:988,targetSession:{...session,entries:[{index:988,title:'第982章 国号',url:'https://target/0',variables:[]}]}});
 f.context.toc=[{chapterIndex:17,chapterTitle:'第18章 废物'},{chapterIndex:988,chapterTitle:'第982章 国号'}];
 let durable={sourceId:'old',bookId:'book',chapterIndex:17,chapterOffset:0,chapterProgress:0,updatedAt:1},revision=1,writes=0,failures=failReads;
 const original=f.runtime.request.bind(f.runtime);
 f.runtime.supportsCoreCapability=c=>c==='reading.progress.compareAndSet.v1';f.runtime.captureReadingContentValidity=()=>()=>true;
 f.runtime.request=async(method,params,options={})=>{
  if(method!=='reading.progress.get'&&method!=='reading.progress.update')return original(method,params,options);
  if(options.shouldCancel?.())throw Error('cancelled');
  if(method==='reading.progress.get'){
   if(failures-->0)throw Error('progress read unavailable');
   return{data:{found:true,progress:{...durable},progressRevision:`op:${revision}`}};
  }
  writes++;if(writeGate)await writeGate.promise;if(failWrites)throw Error('progress write unavailable');
  assert.equal(params.expectedProgressRevision,`op:${revision}`);
  durable={sourceId:'old',bookId:'book',chapterIndex:params.chapterIndex,chapterOffset:params.chapterOffset,chapterProgress:params.chapterProgress,
   bodyVersion:params.expectedBodyVersion,processingVersion:params.expectedProcessingVersion,updatedAt:++revision,locationRevision:`r${revision}`};
  if(loseReceipt)throw Error('receipt lost');return{data:{stored:true,...durable}};
 };
 const gateway=new ReadingSessionFlowGateway('old','book',{kind:'remote'},f.runtime);
 const commits=()=>f.calls.filter(([method])=>method==='source.switch.commit').map(([,params])=>({title:params.currentChapterTitle,index:params.currentChapterIndex}));
 const pick=()=>f.host.pick(f.candidate(),f.host.current().scopeId);
 return{...f,gateway,commits,pick,durable:()=>durable,writes:()=>writes};
}
const checks=[];
{
 const gate=deferred(),f=fixture({writeGate:gate});await settle();
 const pending=f.gateway.persistPresentedProgress('book','第982章 国号',displayed,layout);await settle();const switchWork=f.pick();await settle();
 assert.equal(f.commits().length,0,'source switch must wait for the actual displayed-progress producer');
 gate.resolve();await pending;await switchWork;await settle();assert.deepEqual(f.commits(),[{title:'第982章 国号',index:988}]);
 assert.equal(f.effects.at(-1).chapterIndex,988);checks.push('pending-982-write-precedes-switch');
}
{
 const f=fixture({failReads:1});await settle();await assert.rejects(f.gateway.persistPresentedProgress('book','第982章 国号',displayed,layout));
 await f.pick();await settle();assert.equal(f.commits()[0].index,988);checks.push('failed-read-reconciled-at-switch-boundary');
}
{
 const f=fixture({failWrites:true});await settle();await assert.rejects(f.gateway.persistPresentedProgress('book','第982章 国号',displayed,layout));
 await f.pick();await settle();assert.equal(f.commits().length,0);assert.equal(f.effects.filter(e=>e.kind==='acquisitionFailed').length,1);
 assert.equal(f.durable().chapterIndex,17);checks.push('unresolved-write-stops-source-mutation');
}
{
 const f=fixture({loseReceipt:true});await settle();await assert.rejects(f.gateway.persistPresentedProgress('book','第982章 国号',displayed,layout));
 await f.pick();await settle();assert.equal(f.commits()[0].index,988);assert.equal(f.writes(),1);checks.push('lost-receipt-confirmed-without-rewrite');
}
{
 const gate=deferred(),f=fixture({writeGate:gate});await settle();
 const pending=f.gateway.persistPresentedProgress('book','第982章 国号',displayed,layout);await settle();const work=f.pick();await settle();
 f.retire();gate.resolve();await pending;await work;assert.equal(f.commits().length,0);checks.push('cancelled-switch-does-not-mutate-source');
}
{
 const gate=deferred(),f=fixture({commitGate:gate});await settle();const work=f.pick();await settle();assert.equal(f.commits().length,1);
 await assert.rejects(f.gateway.persistPresentedProgress('book','later',displayed,layout),/TRANSACTION_PENDING/);
 gate.resolve();await work;checks.push('ordinary-write-cannot-cross-source-transaction');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual SourceSwitchHost/Intent/Gateway and same per-runtime ReadingSessionFlow progress producer; controlled Core and native file boundary'}));

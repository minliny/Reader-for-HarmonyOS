import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(s,c,next) { try { return next(s,c); } catch(e) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return next(s+'.ts',c); throw e;
} } });
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { BookRequestNotDispatchedError } = await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const sourceURL = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url);
const source=readFileSync(sourceURL,'utf8'), start=source.indexOf('class CoreReadingAnchor implements'), end=source.indexOf('\nclass ',start+1);
const CoreReadingAnchor=new Function(stripTypeScriptTypes(source.slice(start,end))+';return CoreReadingAnchor;')();
const layout={viewportWidth:390,viewportHeight:800,fontScale:1};
const anchor=offset=>({chapterIndex:2,chapterOffset:offset,chapterProgress:offset/100,bodyVersion:'body',processingVersion:'processing'});
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve};};
const settle=async()=>{for(let n=0;n<40;n++)await Promise.resolve();};
function fixture({cap=true}={}) {
  let revision='r:1', valid=true, admitted=true, durable={sourceId:'target',bookId:'book',...anchor(10),updatedAt:1,locationRevision:'before'};
  const calls=[], effects=[], readGates=[], writeGates=[];
  const originalAck=p=>({data:{...p,stored:true,bodyVersion:p.expectedBodyVersion,processingVersion:p.expectedProcessingVersion,
    updatedAt:2,locationRevision:'canonical',progressRevision:'r:2',transactionId:p.transactionId,sourceSwitchFinalized:true}});
  const runtime={captureReadingContentValidity:()=>()=>valid,
    supportsCoreCapability:c=>c==='reading.progress.compareAndSet.v1'||(cap&&c==='reading.progress.sourceFinalizeReceipt.v1'),
    async request(method,p,options={}) {
      calls.push({method,p:structuredClone(p),options});
      if(method==='reading.progress.get') {
        const gate=readGates.shift();if(gate)await gate.promise;
        if(options.shouldCancel?.())throw Error('read consumer retired');
        return{data:{found:true,progress:{...durable},progressRevision:revision}};
      }
      assert.equal(method,'reading.progress.update');
      const gate=writeGates.shift();if(gate)await gate.promise;
      if(options.canContinue?.()===false||options.canDispatch?.()===false)throw new BookRequestNotDispatchedError('before actual SDK entry');
      assert.equal(options.shouldCancel,undefined,'actual write never uses UI post-dispatch cancel');
      const effect=effects.shift();
      if(effect==='before')throw new BookRequestNotDispatchedError('actual SDK refused before send');
      options.onDispatch?.();
      if(effect==='lost')throw Error('accepted native request, ACK missing');
      if(effect==='unknown')throw Error('original receipt still unavailable');
      if(effect==='wrong')return{data:{...originalAck(p).data,transactionId:'foreign'}};
      if(effect==='rejected') {const e=Error('atomic CAS reject');e.event={type:'error',error:{code:'INVALID_PARAMS',details:{reason:'READING_PROGRESS_CHANGED'}}};throw e;}
      if(effect==='historical')return originalAck(p); // Real Core behavior is separately proven by actual SQLite/Runtime tests.
      const ack=originalAck(p);durable={...ack.data};revision='r:2';return ack;
    }};
  const gateway=new ReadingSessionFlowGateway('target','book',{kind:'remote'},runtime,'original');
  const Host=productionMotionMethods(sourceURL,['persistMeasuredCanonicalProgress','persistPreparedPageTurn'],{CoreReadingAnchor,
    ReaderRuntimeOwner:{current:()=>runtime},hilog:{error(){}}});
  let retired=false;
  const owner=Object.assign(new Host(),{sourceId:'target',bookId:'book',activeGateway:()=>gateway,coreLayout:()=>layout,
    isPreparedPageTurnCommitCurrent:()=>!retired,isMountedToken:()=>!retired,errorMessage:e=>e.message});
  const prepared={context:{chapter:{sourceId:'target',bookId:'book',chapterTitle:'two',...anchor(40)},layoutMap:{scalarCount:()=>100}},page:{startScalar:40}};
  return{gateway,runtime,owner,prepared,calls,effects,readGates,writeGates,
    save:()=>owner.persistMeasuredCanonicalProgress('book','two',anchor(40),layout,()=>admitted),
    writes:()=>calls.filter(c=>c.method==='reading.progress.update'),
    retire:()=>{retired=true;admitted=false;},reopen:()=>{admitted=true;},invalidate:()=>{valid=false;},
    move:(offset)=>{durable={...durable,...anchor(offset),updatedAt:3,locationRevision:'later'};revision='r:3';},
    targetAlreadyStored:()=>{durable={...durable,...anchor(40),updatedAt:2,locationRevision:'canonical'};revision='r:2';}};
}
const cases=[];
{
 const f=fixture(),stored=await f.save();assert.equal(stored.sourceSwitchTransactionId,'original');
 assert.equal(f.writes()[0].p.expectedProgressRevision,'r:1');assert.equal(f.gateway.hasPendingSourceSwitch(),false);
 assert.equal(f.writes()[0].p.transactionId,'original');cases.push('first/exact-owned-canonical-ACK');
}
{
 const f=fixture();f.effects.push('lost','unknown');await assert.rejects(f.save());f.targetAlreadyStored();
 await assert.rejects(f.gateway.awaitPresentedProgressPersistence());
 assert.equal(f.writes().length,2,'matching target still requires the exact native receipt');
 assert.deepEqual(f.writes()[1].p,f.writes()[0].p,'replay preserves original complete tuple and CAS observation');
 assert.equal(f.gateway.hasPendingSourceSwitch(),true);cases.push('unknown/current-match-not-receipt');
}
{
 const f=fixture();f.effects.push('lost','historical');await assert.rejects(f.save());f.targetAlreadyStored();
 const stored=await f.save();assert.equal(stored.sourceSwitchTransactionId,'original');assert.equal(f.writes().length,2);
 assert.deepEqual(f.writes()[0].p,f.writes()[1].p);assert.equal(f.gateway.hasPendingSourceSwitch(),false);cases.push('unknown/exact-replay-current-position');
}
{
 const f=fixture();f.effects.push('lost','historical');await assert.rejects(f.save());f.move(60);
 await assert.rejects(f.save(),/HISTORICAL_RECEIPT/);
 assert.equal(f.gateway.hasPendingSourceSwitch(),false,'historical exact ACK releases only original durable unknown');
 assert.equal(f.writes().length,2,'historical recovery cannot issue a new old-anchor save');
 assert.deepEqual(f.writes()[1].p,f.writes()[0].p);assert.equal(f.owner.lastCommittedProgress,undefined);cases.push('unknown/later-position-history-does-not-publish-or-rewind');
}
{
 const f=fixture(),gate=deferred();f.writeGates.push(gate);const work=f.save();await settle();f.retire();gate.resolve();
 await assert.rejects(work);assert.equal(f.gateway.hasPendingSourceSwitch(),true);assert.equal(f.writes().length,1);
 f.reopen();const stored=await f.save();assert.equal(stored.sourceSwitchTransactionId,'original');cases.push('runtime-start/actual-before-dispatch-retirement-and-retry');
}
{
 const f=fixture();f.effects.push('before');await assert.rejects(f.save());
 const stored=await f.save();assert.equal(stored.sourceSwitchTransactionId,'original');assert.equal(f.writes().length,2);
 cases.push('typed-not-dispatched/retry-not-permanently-unknown');
}
{
 const f=fixture();f.effects.push('rejected');await assert.rejects(f.save());
 assert.equal((await f.save()).sourceSwitchTransactionId,'original');cases.push('atomic-CAS-rejected/retry');
}
{
 const f=fixture();f.effects.push('lost','historical');await assert.rejects(f.save());f.targetAlreadyStored();f.invalidate();
 const stored=await f.gateway.awaitPresentedProgressPersistence();assert.equal(stored.sourceSwitchTransactionId,'original');
 assert.equal(f.writes().length,2,'content retirement keeps accepted unknown for exact recovery');cases.push('content-retirement/durable-exact-recovery');
}
{
 const f=fixture();f.effects.push('lost','wrong');await assert.rejects(f.save());f.targetAlreadyStored();
 await assert.rejects(f.save());assert.equal(f.gateway.hasPendingSourceSwitch(),true);cases.push('wrong-transaction/unknown-retained');
}
{
 const f=fixture({cap:false});await assert.rejects(f.save(),/RECEIPT_REQUIRED/);assert.equal(f.writes().length,0);cases.push('old-Native/capability-fails-closed');
}
{
 const f=fixture();f.effects.push('lost','historical');await assert.rejects(f.save());f.targetAlreadyStored();
 f.gateway.sourceSwitchTransactionId='successor';const stored=await f.gateway.awaitPresentedProgressPersistence();
 assert.equal(stored.sourceSwitchTransactionId,'original');assert.equal(f.gateway.sourceSwitchTransactionId,'successor');cases.push('old-ACK/successor-transaction-preserved');
}
{
 const f=fixture();const gate=deferred();const first=f.runtime.request.bind(f.runtime);let seen=false;
 f.runtime.request=async(method,p,options)=>{const operation=first(method,p,options);
 if(method==='reading.progress.update'&&!seen){seen=true;await gate.promise;} return operation;};
 const work=f.owner.persistPreparedPageTurn(f.prepared,1,7);await settle();f.retire();gate.resolve();
 assert.equal(await work,undefined);assert.equal(f.owner.pageTurnStoredProgress,undefined);cases.push('actual-SDK-LRE/late-canonical-ACK-retired-presentation');
}
{
 const f=fixture();f.effects.push('lost');const original=f.gateway.sourceCanonicalProgressAccess.bind(f.gateway);
 f.gateway.sourceCanonicalProgressAccess=id=>({...original(id),requireWriteReceipt:false});
 await assert.rejects(f.save());f.targetAlreadyStored();const match=await f.gateway.awaitPresentedProgressPersistence();
 assert.equal(match.chapterOffset,40);assert.equal(match.sourceSwitchTransactionId,undefined);
 assert.equal(f.writes().length,1,'negative control: old ordinary matching-row rule releases unknown without the source canonical ACK');
 assert.equal(f.gateway.hasPendingSourceSwitch(),true);cases.push('negative-control/ordinary-current-row-reconciliation-is-insufficient');
}

{
 const f=fixture();f.effects.push('lost','historical');await assert.rejects(f.save());f.targetAlreadyStored();
 const reopened=new ReadingSessionFlowGateway('target','book',{kind:'remote'},f.runtime,'original');
 const stored=await reopened.persistCanonicalProgress('book','two',anchor(40),layout,()=>true);
 assert.equal(stored.sourceSwitchTransactionId,'original');assert.equal(reopened.hasPendingSourceSwitch(),false);
 assert.equal(f.gateway.hasPendingSourceSwitch(),false);assert.equal(f.writes().length,2);
 assert.deepEqual(f.writes()[1].p,f.writes()[0].p);cases.push('same-Runtime/re-entry-one-durable-owner-exact-id');
}
{
 const f=fixture();f.effects.push('lost','historical');await assert.rejects(f.save());f.move(60);
 const reopened=new ReadingSessionFlowGateway('target','book',{kind:'remote'},f.runtime,'original');
 await assert.rejects(reopened.persistCanonicalProgress('book','two',anchor(40),layout,()=>true),/HISTORICAL_RECEIPT/);
 assert.equal(reopened.hasPendingSourceSwitch(),false);assert.equal(f.writes().length,2);
 cases.push('same-Runtime/re-entry-old-history-not-current-page');
}
console.log(JSON.stringify({passed:true,scenarios:cases.length,cases,boundary:'Actual production Gateway/ProgressOwner/Remote and SDK-emitted LRE methods; controlled Core IO. Actual SQLite/Runtime replay/CAS/body guards are the independent Core suite, Native/target pending.'}));

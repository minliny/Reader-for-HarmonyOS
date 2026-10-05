import assert from 'node:assert/strict';
import {BookRequestScheduler,BookRequestNotDispatchedError} from '../entry/src/main/ets/app/BookRequestScheduler.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject};};
const tick=()=>new Promise(done=>setImmediate(done));
function fixture(){
 const startup=deferred(),native=deferred(),events=[],requests=[];
 const Owner=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),['requestDirect'],
  {LOG_DOMAIN:0,DEFAULT_CORE_REQUEST_TIMEOUT_MS:30000,hilog:{warn(){}},coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined});
 const owner=Object.assign(new Owner(),{state:'starting',preparationIntentEpoch:0,
  readingEntryPreparations:()=>({beginRequest:()=>{events.push('begin');return true;},finishRequest:()=>events.push('finish')}),
  async start(){await startup.promise;},wakeReadingPreparations(){},runtime:{request(method,params,options){events.push('native');requests.push({method,params,options});return native.promise;}}});
 return{owner,startup,native,events,requests,ready(){owner.state='ready';startup.resolve();}};
}
for(const timeoutMs of [undefined,17]){
 for(const guard of ['canContinue','canDispatch']){
  const f=fixture();let current=true,dispatches=0;const options={timeoutMs,[guard]:()=>current,onDispatch:()=>dispatches++};
  const requested=f.owner.requestDirect('source.switch.commit',{},options);
  const rejected=assert.rejects(requested,error=>error instanceof BookRequestNotDispatchedError);
  current=false;f.ready();await rejected;
  assert.equal(dispatches,0);assert.equal(f.requests.length,0);assert.deepEqual(f.events,['begin','finish']);
 }
}
{
 const f=fixture();let dispatches=0;const requested=f.owner.requestDirect('source.switch.commit',{}, {onDispatch:()=>dispatches++});
 const rejected=assert.rejects(requested,error=>error instanceof BookRequestNotDispatchedError);
 f.owner.state='closing';f.startup.resolve();await rejected;assert.equal(f.requests.length,0);assert.equal(dispatches,0);
}
for(const timeoutMs of [undefined,23]){
 const f=fixture();let current=true,dispatches=0;const requested=f.owner.requestDirect('source.switch.commit',{bookId:'original'},
  {timeoutMs,canContinue:()=>current,canDispatch:()=>current,onDispatch:()=>{assert.equal(f.requests.length,0);dispatches++;}});
 f.ready();await tick();assert.equal(dispatches,1);assert.equal(f.requests.length,1);
 assert.equal(f.requests[0].options.timeoutMs,timeoutMs??30000);assert.equal(f.requests[0].options.shouldCancel,undefined,
  'presentation guard is not installed as cancellation after a durable request entered SDK');
 current=false;f.owner.state='closing';f.native.resolve({data:{transactionId:'original'}});
 assert.equal((await requested).data.transactionId,'original');assert.deepEqual(f.events,['begin','native','finish']);
}
{
 const f=fixture();let dispatched=0;const requested=f.owner.requestDirect('source.switch.commit',{}, {onDispatch:()=>dispatched++});
 const rejected=assert.rejects(requested,/ACK lost/);f.ready();await tick();f.native.reject(Error('ACK lost'));await rejected;
 assert.equal(dispatched,1,'SDK rejection after entry cannot turn into local non-dispatch proof');assert.equal(f.requests.length,1);
}
{
 const f=fixture();let dispatched=0;const scheduler=new BookRequestScheduler((method,params,options)=>f.owner.requestDirect(method,params,options));
 const requested=scheduler.request('book.detail',{}, {canContinue:()=>true,canDispatch:()=>true,onDispatch:()=>dispatched++},'v1','foreground');
 f.ready();await tick();assert.equal(dispatched,1,'existing scheduler filters its admission hooks before the direct executor');
 assert.equal(f.requests.length,1);f.native.resolve({data:{}});await requested;scheduler.close();
}
console.log('PASS actual Runtime direct SDK boundary: two startup-retired guards and timeout paths never dispatch, closed owner rejected, local branded proof, one pre-invocation marker, admitted late durable ACK/lost ACK retained, actual Scheduler has no duplicate hook or UI cancellation. Startup/native IO controlled; no target claim.');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const app=new URL('../entry/src/main/ets/app/',import.meta.url);
const read=name=>readFileSync(new URL(name,app),'utf8');
const source=stripTypeScriptTypes(read('ArkWebResourceDiagnostic.ts').replace(/^import[^\n]*\n/gm,'')).replace('export class','class');
const ticks=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
class Response {
 code=0;ready=true;data='';
 setResponseCode(v){this.code=v;} setReasonMessage(){} setResponseMimeType(){} setResponseData(v){this.data=v;}
 setResponseIsReady(v){this.ready=v;if(v)this.onReady?.();}
}
function harness({lateOld=false,throwEarly=false}={}){
 let now=1000,next=1,observer,diagnostic;const timers=new Map(),jobs=new Map(),logs=[];
 const set=(fn,ms)=>{const id=next++;timers.set(id,{at:now+ms,fn});return id;};const clear=id=>timers.delete(id);
 const emit=(kind,id,url)=>observer?.({kind,requestId:id,url,at:now});
 const executor={attachDiagnosticObserver(fn){observer=fn;},detachDiagnosticObserver(fn){if(observer===fn)observer=undefined;},cancel(id){jobs.get(id)?.reject({code:'CANCELLED'});jobs.delete(id);},execute(params,id){
  const prefix=params.document.baseUrl.slice(0,-4);emit('start',id);
  if(throwEarly)throw new Error('controller unavailable');
  if(params.document.body.includes('early.css')){
   assert.equal(diagnostic.provide(prefix+'early.css').code,200);diagnostic.provide(prefix+'hold.js');
   emit('resource',id,prefix+'early.css');emit('matcherStart',id,prefix+'early.css');emit('matched',id,prefix+'early.css');
   return Promise.resolve({value:prefix+'early.css',resourceUrl:prefix+'early.css'});
  }
  if(params.document.body.includes('old.js')){
   const response=diagnostic.provide(prefix+'old.js');
   response.onReady=()=>{if(lateOld&&jobs.has(7600002)){emit('resource',7600002,prefix+'old.js');emit('matched',7600002,prefix+'old.js');jobs.get(7600002).resolve({resourceUrl:prefix+'old.js'});jobs.delete(7600002);}};
   return new Promise((resolve,reject)=>jobs.set(id,{resolve,reject}));
  }
  const response=diagnostic.provide(prefix+'new.js');
  const pending=new Promise((resolve,reject)=>jobs.set(id,{resolve,reject}));
  response.onReady=()=>{if(!jobs.has(id))return;emit('resource',id,prefix+'new.js');emit('matcherStart',id,prefix+'new.js');emit('matched',id,prefix+'new.js');jobs.get(id).resolve({resourceUrl:prefix+'new.js'});jobs.delete(id);};
  assert.equal(new Function('return ('+params.resourceUrlMatcherJavaScript+')('+JSON.stringify(prefix+'new.js')+')')(),true);
  return pending;
 }};
 const Diagnostic=new Function('hilog','ArkWebExecutor','WebResourceResponse','setTimeout','clearTimeout','Date',source+'; return ArkWebResourceDiagnostic;')({info:(_d,_t,_f,message)=>logs.push(JSON.parse(message))},{instance:executor},Response,set,clear,{now:()=>now});
 diagnostic=new Diagnostic();
 return {diagnostic,timers,jobs,logs,observer:()=>observer,emit,async advance(ms){const end=now+ms;while(true){const entry=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;now=entry[1].at;timers.delete(entry[0]);entry[1].fn();await ticks();}now=end;await ticks();}};
}
{
 const h=harness();assert.equal(h.diagnostic.provide('https://unrelated.example/user-token').code,403);assert.equal(h.diagnostic.provide('about:blank'),null);
 await h.diagnostic.run('early');assert.equal(h.logs[0].pass,true);assert.equal(h.logs[0].measurements.callbackToMatchMs,0);
 assert.equal(h.timers.size,0);assert.equal(h.observer(),undefined);assert.equal(h.diagnostic.provide('https://93.184.216.34/not-a-fixture').code,403);
 assert.ok(!JSON.stringify(h.logs).includes('https://'),'logs contain no raw URL');
 console.log('PASS diagnostic early fixture, fixed admission, measurement and timer/observer cleanup');
}
for(const lateOld of [false,true]){
 const h=harness({lateOld});const result=h.diagnostic.run('cancel');await ticks();await h.advance(1000);await result;
 assert.equal(h.logs[0].pass,!lateOld);assert.equal(h.logs[0].measurements.observedLateOldCallbacks,lateOld?1:0);
 assert.equal(h.timers.size,0);assert.equal(h.jobs.size,0);assert.equal(h.observer(),undefined);
 console.log('PASS diagnostic attributes old resource token during new job: lateOld='+lateOld);
}
{
 const h=harness();const pending=h.diagnostic.run('cancel');await ticks();h.emit('resource',123,'https://user.example/private-token');h.diagnostic.dispose();await pending;
 assert.equal(h.timers.size,0);assert.equal(h.jobs.size,0);assert.equal(h.observer(),undefined);assert.ok(!JSON.stringify(h.logs).includes('private-token'));
 assert.equal(h.diagnostic.provide('https://93.184.216.34/anything').code,403);
 console.log('PASS disposing the pilot cancels only owned jobs and clears response timers/observer');
}
{
 const h=harness({throwEarly:true});await h.diagnostic.run('early');assert.equal(h.logs[0].pass,false);assert.equal(h.observer(),undefined);assert.equal(h.timers.size,0);
 console.log('PASS diagnostic execution errors retain a failure receipt');
}
const host=read('ArkWebExecutionHost.ets');const policyPosition=host.indexOf('if (!ArkWebExecutor.instance.blockNetworkUrl(');
assert.ok(policyPosition>=0&&host.indexOf('return this.diagnosticResourceProvider(',policyPosition)>policyPosition);
assert.match(host,/diagnosticResourceProvider:[^\n]+undefined = undefined/);
assert.ok(!read('ArkWebResourceDiagnostic.ts').includes('onResourceLoad('),'runner never fabricates native callbacks');
assert.ok(!read('ArkWebResourceDiagnostic.ts').includes('performance.getEntries'));
console.log('PH76 diagnostic runner: 5 scenario groups plus production default/policy wiring passed; these are unit checks, not VM evidence');

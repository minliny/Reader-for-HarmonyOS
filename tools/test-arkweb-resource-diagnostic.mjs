import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const app=new URL('../entry/src/main/ets/app/',import.meta.url);
const read=name=>readFileSync(new URL(name,app),'utf8');
const source=stripTypeScriptTypes(read('ArkWebResourceDiagnostic.ts').replace(/^import[^\n]*\n/gm,'')).replace('export class','class');
const ticks=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
class Response {
 code=0;ready=true;data='';
 setResponseCode(v){this.code=v;} setReasonMessage(){} setResponseMimeType(){} setResponseData(v){this.data=v;}
 setResponseIsReady(v){this.ready=v;if(v)this.onReady?.();}
}
const util={TextEncoder,Base64Helper:class {encodeToStringSync(bytes){return Buffer.from(bytes).toString('base64');}}};
function harness({lateOld=false,throwEarly=false}={}){
 let now=1000,next=1,observer,diagnostic;const timers=new Map(),jobs=new Map(),logs=[],documents=[];
 const set=(fn,ms)=>{const id=next++;timers.set(id,{at:now+ms,fn});return id;};const clear=id=>timers.delete(id);
 const emit=(kind,id,url)=>observer?.({kind,requestId:id,url,at:now});
 const executor={attachDiagnosticObserver(fn){observer=fn;},detachDiagnosticObserver(fn){if(observer===fn)observer=undefined;},cancel(id){jobs.get(id)?.reject({code:'CANCELLED'});jobs.delete(id);},execute(params,id){
  const prefix=params.document.baseUrl.slice(0,-4);emit('start',id);
  if(throwEarly)throw new Error('controller unavailable');
  const body=params.document.body, dataUrl='data:text/html;charset=utf-8,'+encodeURIComponent(body);
  const oldDocument=documents.at(-1);documents.push(params.document);
  // Exercise the real provider's main-document boundary, which the original
  // fixture skipped by directly emitting CSS/JS callbacks. This is not a claim
  // about which of these representations the native kernel requests.
  assert.equal(diagnostic.provide(params.document.baseUrl).code,200);
  assert.equal(diagnostic.provide(params.document.baseUrl).data,body);
  assert.equal(diagnostic.provide(dataUrl),null);
  assert.equal(diagnostic.provide('data:text/html,'+body),null);
  assert.equal(diagnostic.provide('data:text/html;charset=utf-8;base64,'+Buffer.from(body).toString('base64')),null);
  assert.equal(diagnostic.provide(dataUrl+'changed').code,403);
  assert.equal(diagnostic.provide('data:text/html,%broken').code,403);
  assert.equal(diagnostic.provide('data:application/javascript,'+encodeURIComponent(body)).code,403);
  if(oldDocument){
   assert.equal(diagnostic.provide('data:text/html,'+oldDocument.body).code,403);
   if(oldDocument.baseUrl!==params.document.baseUrl)assert.equal(diagnostic.provide(oldDocument.baseUrl).code,403);
  }
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
 const Diagnostic=new Function('hilog','ArkWebExecutor','WebResourceResponse','setTimeout','clearTimeout','Date','util',source+'; return ArkWebResourceDiagnostic;')({info:(_d,_t,_f,message)=>logs.push(JSON.parse(message))},{instance:executor},Response,set,clear,{now:()=>now},util);
 diagnostic=new Diagnostic();
 return {diagnostic,timers,jobs,logs,documents,observer:()=>observer,emit,async advance(ms){const end=now+ms;while(true){const entry=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;now=entry[1].at;timers.delete(entry[0]);entry[1].fn();await ticks();}now=end;await ticks();}};
}
{
 const h=harness();assert.equal(h.diagnostic.provide('https://unrelated.example/user-token').code,403);assert.equal(h.diagnostic.provide('about:blank'),null);
 await h.diagnostic.run('early');assert.equal(h.logs[0].pass,true);assert.equal(h.logs[0].measurements.callbackToMatchMs,0);
 assert.equal(h.timers.size,0);assert.equal(h.observer(),undefined);assert.equal(h.diagnostic.provide('https://93.184.216.34/not-a-fixture').code,403);
 assert.ok(!JSON.stringify(h.logs).includes('https://'),'logs contain no raw URL');
 assert.ok(h.logs[0].events.some(e=>e.kind==='documentProvided'&&e.resource==='page'));
 assert.ok(h.logs[0].events.some(e=>e.kind==='documentAllowed'&&e.resource==='data-document'));
 assert.ok(h.logs[0].events.some(e=>e.kind==='interceptDenied'&&e.resource==='data-document'));
 assert.equal(h.diagnostic.provide('data:text/html,'+h.documents[0].body).code,403,'finished run has no admitted document');
 console.log('PASS diagnostic early fixture, fixed admission, measurement and timer/observer cleanup');
}
for(const lateOld of [false,true]){
 const h=harness({lateOld});const result=h.diagnostic.run('cancel');await ticks();await h.advance(1000);await result;
 assert.equal(h.logs[0].pass,!lateOld);assert.equal(h.logs[0].measurements.observedLateOldCallbacks,lateOld?1:0);
 assert.equal(h.timers.size,0);assert.equal(h.jobs.size,0);assert.equal(h.observer(),undefined);
 console.log('PASS diagnostic attributes old resource token during new job: lateOld='+lateOld);
}
{
 const h=harness();const pending=h.diagnostic.run('cancel');await ticks();h.emit('resource',123,'https://user.example/private-token');h.jobs.set(123,{reject:()=>{throw new Error('non-runner request must not be cancelled');}});h.diagnostic.dispose();await pending;
 assert.equal(h.timers.size,0);assert.equal(h.jobs.size,1);assert.ok(h.jobs.has(123));h.jobs.delete(123);assert.equal(h.observer(),undefined);assert.ok(!JSON.stringify(h.logs).includes('private-token'));
 assert.equal(h.diagnostic.provide('https://93.184.216.34/anything').code,403);
 console.log('PASS disposing the pilot cancels only owned jobs and clears response timers/observer');
}
{
 const h=harness({throwEarly:true});await h.diagnostic.run('early');assert.equal(h.logs[0].pass,false);assert.equal(h.observer(),undefined);assert.equal(h.timers.size,0);
 console.log('PASS diagnostic execution errors retain a failure receipt');
}
{
 const h=harness();const pending=h.diagnostic.run('cancel');await ticks();
 let providerCalls=0;
 const {owner}=createReaderBuilderProbe(read('ArkWebExecutionHost.ets'),['build'],{
  ArkWebExecutor:{instance:{blockNetworkUrl:url=>url==='https://denied.example/private-token'}},
  WebResourceResponse:Response,
 });
 Object.assign(owner,{interactive:false,appThemeScheme:'day',controller:{},
  diagnosticResourceProvider:url=>{providerCalls++;return h.diagnostic.provide(url);}});
 owner.initialRender();
 const web=[...owner.nodes.values()].find(n=>n.type==='Web');assert.ok(web);
 const intercept=url=>web.onInterceptRequest({request:{getRequestUrl:()=>url}});
 const current=h.documents.at(-1),dataUrl='data:text/html;charset=utf-8,'+encodeURIComponent(current.body);
 assert.equal(intercept(dataUrl),null);
 assert.equal(intercept(current.baseUrl).data,current.body);
 assert.equal(intercept(dataUrl+'changed').code,403);
 const before=providerCalls;assert.equal(intercept('https://denied.example/private-token').code,403);
 assert.equal(providerCalls,before,'production Host policy executes before diagnostic provider');
 h.emit('pageBegin',7600002,'about:blank');h.emit('pageBegin',7600002,dataUrl);
 h.emit('pageBegin',7600002,'https://user.example/private-token');
 await h.advance(1000);await pending;
 assert.ok(h.logs[0].events.some(e=>e.kind==='pageBegin'&&e.resource==='about-blank'));
 assert.ok(h.logs[0].events.some(e=>e.kind==='pageBegin'&&e.resource==='data-document'));
 assert.ok(h.logs[0].events.some(e=>e.kind==='pageBegin'&&e.resource==='other-http-document'));
 assert.ok(!JSON.stringify(h.logs).includes('private-token'));
 assert.equal(intercept(dataUrl).code,403,'native callback after run completion cannot re-admit old HTML');
 console.log('PASS actual SDK Host callback: exact main document, tamper rejection, policy-first order and redacted navigation labels');
}
{
 const h=harness();await h.diagnostic.run('early');await h.diagnostic.run('early');
 assert.equal(h.logs.length,2);assert.ok(h.logs.every(log=>log.pass));
 assert.notEqual(h.documents[0].baseUrl,h.documents[1].baseUrl);
 console.log('PASS new run rejects previous run main URL and data document');
}
const host=read('ArkWebExecutionHost.ets');const policyPosition=host.indexOf('if (!ArkWebExecutor.instance.blockNetworkUrl(');
assert.ok(policyPosition>=0&&host.indexOf('return this.diagnosticResourceProvider(',policyPosition)>policyPosition);
assert.match(host,/diagnosticResourceProvider:[^\n]+undefined = undefined/);
assert.ok(!read('ArkWebResourceDiagnostic.ts').includes('onResourceLoad('),'runner never fabricates native callbacks');
assert.ok(!read('ArkWebResourceDiagnostic.ts').includes('performance.getEntries'));
console.log('PH76 diagnostic runner: 7 scenario groups plus actual SDK Host callback/default/policy wiring passed; these are local checks, not VM evidence');

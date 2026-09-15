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
function percentBase64(body){const value=Buffer.from(body).toString('base64');return '%'+value.charCodeAt(0).toString(16)+encodeURIComponent(value.slice(1));}
function harness({lateOld=false,throwEarly=false,shapeProbes=false,newEvidence='complete',earlyMode='normal'}={}){
 let now=1000,next=1,observer,diagnostic;const timers=new Map(),jobs=new Map(),logs=[],documents=[];
 const set=(fn,ms)=>{const id=next++;timers.set(id,{at:now+ms,fn});return id;};const clear=id=>timers.delete(id);
 const emit=(kind,id,url)=>observer?.({kind,requestId:id,url,at:now});
 const executor={attachDiagnosticObserver(fn){observer=fn;},detachDiagnosticObserver(fn){if(observer===fn)observer=undefined;},cancel(id){jobs.get(id)?.reject({code:'CANCELLED'});jobs.delete(id);},execute(params,id){
  const prefix=params.document.baseUrl.slice(0,-4);
  if(earlyMode==='blank-before-start'){emit('pageBegin',id,'about:blank');now+=7;emit('pageEnd',id,'about:blank');now+=42;}
  emit('start',id);
  if(throwEarly)throw throwEarly===true?new Error('controller unavailable'):throwEarly;
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
  if(shapeProbes){
   const escapedBase64=percentBase64(body);
   assert.equal(diagnostic.provide('data:text/html;utf-8,'+encodeURIComponent(body)).code,403,
    'unobserved native metadata shapes remain denied even when the decoded body matches');
   assert.equal(diagnostic.provide('data:text/html;base64,'+escapedBase64),null,
    'the native percent-encoded Base64 representation must equal the current fixture after standard URI decoding');
   assert.equal(diagnostic.provide('data:text/html;charset=utf-8;base64,'+escapedBase64),null);
   assert.equal(diagnostic.provide('data:text/html;charset=utf-8;base64,'+escapedBase64+'changed').code,403);
   assert.equal(diagnostic.provide('data:text/html;charset=utf-8;base64,%broken').code,403);
   assert.equal(diagnostic.provide('data:application/javascript;base64,'+escapedBase64).code,403);
   assert.equal(diagnostic.provide('data:text/html;'+('a'.repeat(120))+','+body).code,403);
   assert.equal(diagnostic.provide('data:text/html;"<\\n>"=x,PRIVATE_BODY_NOT_FOR_LOG').code,403);
   assert.equal(diagnostic.provide('data:text/html;base=https://PRIVATE_HOST_NOT_FOR_LOG/x,'+body).code,403);
   assert.equal(diagnostic.provide('data:text/html;base=https%3A%2F%2FPRIVATE_HOST_NOT_FOR_LOG/x,'+body).code,403);
   assert.equal(diagnostic.provide('data:text/html,'+body.repeat(10)).code,403);
   assert.equal(diagnostic.provide('data:NO_COMMA_PRIVATE_BODY_NOT_FOR_LOG').code,403);
  }
  if(oldDocument){
   assert.equal(diagnostic.provide('data:text/html,'+oldDocument.body).code,403);
   assert.equal(diagnostic.provide('data:text/html;charset=utf-8;base64,'+percentBase64(oldDocument.body)).code,403);
   if(oldDocument.baseUrl!==params.document.baseUrl)assert.equal(diagnostic.provide(oldDocument.baseUrl).code,403);
  }
  if(params.document.body.includes('early.css')){
   assert.equal(diagnostic.provide(prefix+'early.css').code,200);diagnostic.provide(prefix+'hold.js');
   if(earlyMode==='blank-after-start')emit('pageEnd',id,'about:blank');
   if(earlyMode==='data-end-before-match')emit('pageEnd',id,dataUrl);
   if(earlyMode==='base-end-before-match')emit('pageEnd',id,params.document.baseUrl);
   if(earlyMode==='foreign-data-end')emit('pageEnd',id,'data:text/html,foreign');
   if(earlyMode==='foreign-http-end')emit('pageEnd',id,'https://user.example/private-token');
   const callbackId=earlyMode==='wrong-request'?7600002:id;
   now+=61;
   if(earlyMode==='reversed')emit('matched',callbackId,prefix+'early.css');
   if(earlyMode!=='missing-resource')emit('resource',callbackId,prefix+'early.css');
   if(earlyMode!=='missing-matcher')emit('matcherStart',callbackId,prefix+'early.css');
   emit('pageBegin',id,dataUrl);now+=6;
   if(earlyMode!=='reversed')emit('matched',callbackId,prefix+'early.css');
   if(earlyMode==='data-end-after-match'){now+=1;emit('pageEnd',id,dataUrl);}
   return Promise.resolve({value:prefix+'early.css',resourceUrl:prefix+'early.css'});
  }
  if(params.document.body.includes('old.js')){
   const response=diagnostic.provide(prefix+'old.js');
   response.onReady=()=>{if(lateOld&&jobs.has(7600002)){emit('resource',7600002,prefix+'old.js');emit('matched',7600002,prefix+'old.js');jobs.get(7600002).resolve({resourceUrl:prefix+'old.js'});jobs.delete(7600002);}};
   return new Promise((resolve,reject)=>jobs.set(id,{resolve,reject}));
  }
  const response=diagnostic.provide(prefix+'new.js');
  const pending=new Promise((resolve,reject)=>jobs.set(id,{resolve,reject}));
  response.onReady=()=>{
   if(!jobs.has(id))return;
   if(newEvidence==='reversed')emit('matched',id,prefix+'new.js');
   if(newEvidence!=='missing-resource')emit('resource',id,prefix+'new.js');
   emit('matcherStart',id,prefix+'new.js');
   if(newEvidence!=='missing-match'&&newEvidence!=='reversed')emit('matched',id,prefix+(newEvidence==='wrong-match'?'old.js':'new.js'));
   jobs.get(id).resolve({resourceUrl:prefix+'new.js'});jobs.delete(id);
  };
  assert.equal(new Function('return ('+params.resourceUrlMatcherJavaScript+')('+JSON.stringify(prefix+'new.js')+')')(),true);
  return pending;
 }};
 const Diagnostic=new Function('hilog','ArkWebExecutor','WebResourceResponse','setTimeout','clearTimeout','Date','util',source+'; return ArkWebResourceDiagnostic;')({info:(_d,_t,_f,message)=>logs.push(JSON.parse(message))},{instance:executor},Response,set,clear,{now:()=>now},util);
 diagnostic=new Diagnostic();
 return {diagnostic,timers,jobs,logs,documents,observer:()=>observer,emit,async advance(ms){const end=now+ms;while(true){const entry=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;now=entry[1].at;timers.delete(entry[0]);entry[1].fn();await ticks();}now=end;await ticks();}};
}
{
 const h=harness();assert.equal(h.diagnostic.provide('https://unrelated.example/user-token').code,403);assert.equal(h.diagnostic.provide('about:blank'),null);
 await h.diagnostic.run('early');assert.equal(h.logs[0].pass,true);assert.equal(h.logs[0].measurements.callbackToMatchMs,6);
 assert.equal(h.timers.size,0);assert.equal(h.observer(),undefined);assert.equal(h.diagnostic.provide('https://93.184.216.34/not-a-fixture').code,403);
 assert.ok(!JSON.stringify(h.logs).includes('https://'),'logs contain no raw URL');
 assert.ok(h.logs[0].events.some(e=>e.kind==='documentProvided'&&e.resource==='page'));
 assert.ok(h.logs[0].events.some(e=>e.kind==='documentAllowed'&&e.resource==='data-document'));
 assert.ok(h.logs[0].events.some(e=>e.kind==='interceptDenied'&&e.resource==='data-document'));
 assert.equal(h.diagnostic.provide('data:text/html,'+h.documents[0].body).code,403,'finished run has no admitted document');
 console.log('PASS diagnostic early fixture, fixed admission, measurement and timer/observer cleanup');
}
for(const earlyMode of ['blank-before-start','blank-after-start','data-end-after-match',
 'data-end-before-match','base-end-before-match','foreign-data-end','foreign-http-end',
 'wrong-request','missing-resource','missing-matcher','reversed']){
 const h=harness({earlyMode});await h.diagnostic.run('early');const result=h.logs[0];
 const expected=['blank-before-start','blank-after-start','data-end-after-match'].includes(earlyMode);
 assert.equal(result.pass,expected,'early lifecycle/identity evidence: '+earlyMode);
 if(expected){assert.equal(result.measurements.callbackToMatchMs,6);assert.equal(result.measurements.matchedBeforePageEnd,true);}
 if(earlyMode.startsWith('blank-'))assert.ok(result.events.some(event=>event.kind==='pageEnd'&&event.resource==='about-blank'),'blank event remains in evidence');
 assert.ok(!JSON.stringify(result).includes('private-token'));
 assert.equal(h.timers.size,0);assert.equal(h.jobs.size,0);assert.equal(h.observer(),undefined);
}
console.log('PASS early timing uses this run and exact target document: native blank initialization excluded, premature/foreign/incomplete evidence still fails (11 scenarios)');
{
 const h=harness({shapeProbes:true});await h.diagnostic.run('early');
 assert.equal(h.logs[0].pass,true,'all exact native document admission and rejection assertions must complete');
 const shapes=h.logs[0].events.filter(e=>e.kind==='dataDocumentShape').map(e=>e.dataDocument);
 const find=metadata=>shapes.find(shape=>shape.metadata===metadata);
 assert.ok(find('text/html').matchesCurrentBody,'raw exact body is reported as a boolean');
 assert.ok(find('text/html;charset=utf-8').uriDecodedMatchesCurrentBody);
 assert.ok(find('text/html;charset=utf-8;base64').matchesCurrentBase64);
 assert.equal(find('text/html;utf-8').matchesCurrentBody,false);
 assert.equal(find('text/html;utf-8').uriDecodedMatchesCurrentBody,true);
 assert.equal(find('text/html;base64').matchesCurrentBase64,false);
 assert.equal(find('text/html;base64').uriDecodedMatchesCurrentBase64,true);
 assert.ok(shapes.some(shape=>shape.uriDecodeAttempted&&!shape.uriDecodeSucceeded),'malformed URI is visible without leaking body');
 assert.ok(shapes.some(shape=>shape.metadataTruncated&&shape.metadata.length===96));
 assert.ok(shapes.some(shape=>shape.metadataSanitized));
 assert.ok(shapes.some(shape=>!shape.withinLengthBound&&shape.bodyLength>0&&!shape.uriDecodeAttempted));
 assert.ok(shapes.some(shape=>!shape.hasComma&&shape.metadata===''&&!shape.uriDecodeAttempted));
 for(const shape of shapes){
  assert.match(shape.metadata,/^[A-Za-z0-9 /;=+._%-]{0,96}$/);
  assert.deepEqual(Object.keys(shape).sort(),['metadata','metadataTruncated','metadataSanitized','hasComma','bodyLength',
   'hasCurrentDocument','withinLengthBound','matchesCurrentBody','matchesCurrentBase64','uriDecodeAttempted',
   'uriDecodeSucceeded','uriDecodedMatchesCurrentBody','uriDecodedMatchesCurrentBase64'].sort());
 }
 const output=JSON.stringify(h.logs);
 assert.ok(!output.includes('PRIVATE_BODY_NOT_FOR_LOG'));
 assert.ok(!output.includes('PRIVATE_HOST_NOT_FOR_LOG'));
 assert.ok(!output.includes('https://')&&!output.includes('<html>'));
 assert.ok(h.logs[0].events.length<=256);
 console.log('PASS bounded data diagnostics and exact native URI-Base64 admission: tamper/unsupported/malformed/oversized remain denied, no URL or body disclosure');
}
for(const newEvidence of ['missing-resource','missing-match','reversed','wrong-match']){
 const h=harness({newEvidence});const result=h.diagnostic.run('cancel');await ticks();await h.advance(1000);await result;
 assert.equal(h.logs[0].pass,false,'a new.js result without its ordered native callback and match evidence is not a pass');
 assert.equal(h.logs[0].measurements.returnedResource,'new.js');
 assert.equal(h.logs[0].measurements.observedLateOldCallbacks,0);
 assert.equal(h.timers.size,0);assert.equal(h.jobs.size,0);assert.equal(h.observer(),undefined);
 console.log('PASS diagnostic rejects incomplete new-surface evidence: '+newEvidence);
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
 const {owner}=createReaderBuilderProbe(read('ArkWebExecutionHost.ets'),['build','surfacesForRender'],{
  ArkWebExecutor:{instance:{blockNetworkUrl:url=>url==='https://denied.example/private-token'}},
  WebResourceResponse:Response,
 });
 Object.assign(owner,{interactive:false,appThemeScheme:'day',surfaceId:1,currentSurface:{id:1,controller:{}},
  diagnosticResourceProvider:url=>{providerCalls++;return h.diagnostic.provide(url);}});
 owner.initialRender();
 const web=[...owner.nodes.values()].find(n=>n.type==='Web');assert.ok(web);
 const intercept=url=>web.onInterceptRequest({request:{getRequestUrl:()=>url}});
 const current=h.documents.at(-1),dataUrl='data:text/html;charset=utf-8,'+encodeURIComponent(current.body);
 const percentBase64Url='data:text/html;charset=utf-8;base64,'+percentBase64(current.body);
 assert.equal(intercept(dataUrl),null);
 assert.equal(intercept(percentBase64Url),null);
 assert.equal(intercept(percentBase64Url+'changed').code,403);
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
 assert.equal(intercept(percentBase64Url).code,403,'completed run cannot re-admit its percent-encoded Base64 document');
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
console.log('PH76 diagnostic runner: 12 scenario groups plus actual SDK Host callback/default/policy wiring passed; these are local checks, not VM evidence');


for(const operation of ['getDefaultHttpProxy','getPacUrl','getPacFileUrl','findProxyForUrl','proxy.applyProxyOverride','proxy.removeProxyOverride']){
 const h=harness({throwEarly:{code:'NETWORK_ERROR',message:'无法读取系统网络代理配置，请检查网络连接后重试',details:{phase:'route',operation,platformCode:2100002,platformType:'Error',cause:'PRIVATE_URL https://secret.invalid'}}});
 await h.diagnostic.run('early');const result=h.logs[0];assert.equal(result.pass,false);
 assert.deepEqual(result.measurements,{code:'NETWORK_ERROR',message:'无法读取系统网络代理配置，请检查网络连接后重试',reason:'execution-failed-or-fixture-callback-missing',phase:'route',operation,platformCode:2100002,platformType:'Error'});
 assert.ok(!JSON.stringify(result).includes('PRIVATE_URL'));assert.equal(h.observer(),undefined);assert.equal(h.timers.size,0);
}
{
 const privateValue='PRIVATE_URL https://user:PRIVATE_PASSWORD@secret.invalid/path';
 const h=harness({throwEarly:{code:privateValue,message:privateValue,details:{reason:privateValue,phase:privateValue,operation:privateValue,platformCode:privateValue,platformType:privateValue}}});
 await h.diagnostic.run('early');assert.ok(!JSON.stringify(h.logs).includes('PRIVATE_'));
 assert.deepEqual(h.logs[0].measurements,{code:'DIAGNOSTIC_FAILURE',message:'受控网页执行失败（原始错误信息已省略）',reason:'execution-failed-or-fixture-callback-missing'});
}
console.log('PASS safe preload diagnostics: 6 native operation receipts and arbitrary-error URL/credential suppression');

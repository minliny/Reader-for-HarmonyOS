import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const app=new URL('../entry/src/main/ets/app/',import.meta.url);
const source=name=>stripTypeScriptTypes(readFileSync(new URL(name,app),'utf8').replace(/^import[\s\S]*?;\n/gm,'')).replace(/^export /gm,'');
const httpSource=source('HttpExecuteHost.ts'),policy=source('HttpTransportPolicy.ts');
const logs=[],requests=[],admissions=[];
const {errorMessageOf,httpTransportFailureSummary}=await import(new URL('ErrorMessage.ts',app));
const {classifyRemoteReadingCommandFailure}=await import(new URL('../features/reading/RemoteReadingContract.ts',app));
let response,requestFailure,cookieFailure;
const http={RequestMethod:Object.fromEntries(['GET','HEAD','POST','PUT','DELETE','OPTIONS','CONNECT','TRACE'].map(method=>[method,method])),
 HttpDataType:{ARRAY_BUFFER:2},InterceptorType:{REDIRECTION:1},
 HttpInterceptorChain:class{addChain(items){assert.equal(items.length,1);this.items=items;return true;}apply(request){request.interceptors=this.items;return true;}},
 createHttp(){const request={destroyed:false,async request(url,options){this.url=url;this.options=options;if(typeof requestFailure==='function')return requestFailure(this);if(requestFailure)throw requestFailure;return response;},destroy(){this.destroyed=true;this.onDestroy?.();}};requests.push(request);return request;}};
const cookieStore={instance:{async cookieHeader(){if(cookieFailure)throw cookieFailure;return '';},async storeResponseCookies(){return [];}}};
const nativeUtil={TextDecoder:{create:(encoding,options)=>({decodeToString:bytes=>new TextDecoder(encoding,options).decode(bytes)})}};
const NetworkEnvironmentError=class extends Error{};
const Host=new Function('http','url','util','connection','prepareNetworkTarget','NetworkEnvironmentError','CookieSessionStore','errorMessageOf','hilog',
 policy+httpSource+';return HttpExecuteHost;')(http,{URL:{parseURL:(value,base)=>new URL(value,base)}},nativeUtil,{},
 async value=>{admissions.push(value);return{host:'93.184.216.34',route:'direct',addresses:['93.184.216.34']};},NetworkEnvironmentError,cookieStore,
 errorMessageOf,{error:(...values)=>logs.push(values),warn:(...values)=>logs.push(values)});
const host=new Host();
const deadline=()=>({deadlineAt:Date.now()+5000,cancelled:false,activeRequest:null,expired:new Promise(()=>{})});
const execute=async({method='GET',status=200,result=new ArrayBuffer(0),header={}}={})=>{
 response={responseCode:status,result,header};const d=deadline();
 try{return await host.singleHopTransport('https://93.184.216.34/PRIVATE_URL',host.parseMethod(method),{}, {kind:'none'},undefined,d);}
 finally{assert.equal(d.activeRequest,null);assert.equal(requests.at(-1).destroyed,true);}
};

for(const [method,status] of [['HEAD',200],['HEAD',404],['GET',204],['GET',205],['GET',304]]){
 for(const kind of ['undefined','null','empty-string','empty-buffer']){
  const result=kind==='undefined'?undefined:kind==='null'?null:kind==='empty-string'?'':new ArrayBuffer(0);
  // Assign explicitly, since a parameter default would hide native undefined.
  response={responseCode:status,result,header:{'content-length':'4096'}};const d=deadline();
  const actual=await host.singleHopTransport('https://93.184.216.34/PRIVATE_URL',host.parseMethod(method),{},{kind:'none'},undefined,d);
  assert.equal(actual.status,status);assert.equal(actual.bytes.length,0,method+' '+status+' '+kind);
  assert.equal(actual.headers['content-length'],'4096','HEAD/304 metadata does not require a payload');
  assert.equal(d.activeRequest,null);assert.equal(requests.at(-1).destroyed,true);
 }
}
assert.equal((await execute({result:''})).bytes.length,0,'a 200 empty string has an exact zero-byte representation');
const payload=new Uint8Array([0xff,0,0x81,0x40]);
assert.deepEqual((await execute({result:payload.buffer})).bytes,payload,'raw non-UTF-8 bytes remain unmodified');
console.log('PASS actual HTTP transport: HEAD/204/205/304 absent or empty bodies, 200 empty string and binary bytes (22 cases)');

for(const result of [undefined,null,'PRIVATE_BODY',{secret:'PRIVATE_HEADER'},new Uint8Array([1]),42]){
 response={responseCode:200,result,header:{}};const d=deadline();
 await assert.rejects(host.singleHopTransport('https://93.184.216.34/PRIVATE_URL',host.parseMethod('GET'),{},{kind:'none'},undefined,d),error=>{
  assert.match(error.message,/requested raw response bytes/);assert.match(error.message,/status=200/);
  assert.match(error.message,/type=(undefined|null|string|object|number)/);assert.ok(!error.message.includes('PRIVATE_'));return true;
 });
 assert.equal(d.activeRequest,null);assert.equal(requests.at(-1).destroyed,true);
}
console.log('PASS nonempty decoded strings and unknown body representations fail with bounded status/type diagnostics');
for(const status of [401,403,404,429,500,503]){
 for(const result of [undefined,null]){
  response={responseCode:status,result,header:{}};
  await assert.rejects(host.singleHopTransport('https://93.184.216.34/PRIVATE_URL',host.parseMethod('GET'),{},{kind:'none'},undefined,deadline()),error=>{
   assert.match(error.message,new RegExp('source returned HTTP '+status+' without response content'));
   assert.ok(!(error instanceof NetworkEnvironmentError));assert.ok(!error.message.includes('raw response bytes'));return true;
  });
 }
}
assert.deepEqual((await execute({status:403,result:payload.buffer})).bytes,payload,'an actual 403 representation remains available to Core');
console.log('PASS bodyless 4xx/5xx keeps explicit HTTP source rejection; actual rejection body remains unchanged');

for(const status of [301,302,303,307,308]){
 response={responseCode:status,result:undefined,header:{location:'http://127.0.0.1/PRIVATE_URL'}};
 const start=requests.length;
 await assert.rejects(host.requestRedirectChain('https://93.184.216.34/start',host.parseMethod('GET'),{}, {kind:'none'},undefined,10,deadline(),null),/private, loopback/);
 assert.equal(requests.length,start+1,'no private redirect is dispatched');
 assert.equal(await requests.at(-1).interceptors[0].interceptorHandle({},response),false,'platform must stop before the next hop');
 assert.equal(requests.at(-1).options.expectDataType,http.HttpDataType.ARRAY_BUFFER);
}
response={responseCode:200,result:'',header:{}};
const empty=await host.requestRedirectChain('https://93.184.216.34/start',host.parseMethod('GET'),{}, {kind:'none'},undefined,10,deadline(),null);
assert.equal(empty.body,'');assert.equal(empty.status,200);
console.log('PASS actual redirect chain keeps empty hop Location and rejects private targets before dispatch; empty success survives final response conversion');

// Keep errors from the real request-body call site and from the outer cookie
// path visible without recording raw messages, stack paths, URLs or secrets.
const payloadOriginal=host.requestPayload;
const failure=new TypeError('Cannot read property length of undefined PRIVATE_BODY');
failure.stack='TypeError PRIVATE_BODY\n at call (/PRIVATE_PATH/HttpExecuteHost.ts:871:9)\n https://user:PRIVATE_PASSWORD@secret.invalid/';
host.requestPayload=()=>{throw failure;};
for(let n=0;n<2;n++)await assert.rejects(execute(),error=>error===failure);
host.requestPayload=payloadOriginal;
const payloadLogs=logs.filter(values=>values.includes('request.payload'));
assert.equal(payloadLogs.length,1,'repeated failures from the same bounded stage/frame are logged once');
assert.ok(payloadLogs[0].includes('HttpExecuteHost.ts:871:9'));
cookieFailure=new TypeError('PRIVATE_COOKIE');cookieFailure.stack='at cookie (/PRIVATE_PATH/CookieSessionStore.ets:221:18)';
for(let n=0;n<2;n++)await assert.rejects(host.requestWithPolicy('https://93.184.216.34/start',host.parseMethod('GET'),{}, {kind:'none'},undefined,10,null,deadline(),'session'),error=>error===cookieFailure);
cookieFailure=undefined;
assert.equal(logs.filter(values=>values.includes('request.chain')&&values.includes('CookieSessionStore.ets:221:18')).length,1);
requestFailure=new TypeError('PRIVATE_DISPATCH');requestFailure.stack='at private (https://user:PRIVATE_PASSWORD@secret.invalid/private.ts:1:2)';
await assert.rejects(execute(),error=>error.details?.category==='SOURCE_HTTP_FAILED'&&error.details.transient===false);requestFailure=undefined;
assert.equal(logs.filter(values=>values.includes('request.dispatch')&&values.includes('no-frame')).length,1,'unknown stack locations become a fixed no-frame marker');
await assert.rejects(execute({header:null}),TypeError);
assert.equal(logs.filter(values=>values.includes('response.headers')).length,1,'header conversion failure keeps a distinct fixed stage');
const safeLogs=logs.filter(values=>values.includes('http.execute TypeError stage=%{public}s frame=%{public}s'));
assert.ok(!JSON.stringify(safeLogs).includes('PRIVATE_'));assert.ok(!JSON.stringify(safeLogs).includes('https://'));
for(const code of [2300002,'2300002',2300060,'-105']){
 requestFailure=Object.assign(new Error('Internal error PRIVATE_URL'),{code});
 await assert.rejects(execute(),error=>{assert.equal(error.details?.category,'SOURCE_HTTP_FAILED');assert.equal(error.details.platformCode,Number(code));assert.equal(error.details.transient,false);assert.equal(error.retryable,false);return true;});requestFailure=undefined;
}
const nativeLogs=logs.filter(values=>values.includes('http.execute native failure phase=transport stage=request.dispatch code=%{public}d'));
assert.deepEqual(nativeLogs.map(values=>values.at(-1)),[2300002,2300060,-105],'decimal string and number codes deduplicate together');
requestFailure={code:'PRIVATE_URL https://secret.invalid',message:'PRIVATE_PASSWORD'};
await assert.rejects(execute(),error=>{assert.equal(error.details?.category,'SOURCE_HTTP_FAILED');assert.equal(error.details.platformCode,undefined);assert.equal(error.retryable,false);return true;});requestFailure=undefined;
assert.equal(logs.filter(values=>values.includes('http.execute native failure phase=transport stage=request.dispatch code=%{public}d')).length,3);
assert.ok(!JSON.stringify(nativeLogs).includes('PRIVATE_'));
for(const code of [2300006,2300007,2300028,2300052,2300055,2300056,2300999,'2300999']) {
requestFailure=Object.assign(new Error('Internal error'),{code});
await assert.rejects(execute(),error=>{
 assert.notEqual(error,requestFailure);assert.equal(error.code,'INTERNAL');assert.equal(error.retryable,true);
 assert.deepEqual(error.details,{category:'SOURCE_HTTP_FAILED',phase:'transport',stage:'request.dispatch',transient:true,platformCode:Number(code)});
 assert.equal(error.message,'Internal error');assert.ok(!(error instanceof NetworkEnvironmentError));return true;
});
}
requestFailure=undefined;
for(let n=1;n<30;n++){
 const error=new TypeError('secret');error.stack='at call (NetworkRoutePolicy.ts:'+n+':3)';host.reportTypeError(error,'request.chain');
}
assert.equal(Host.reportedDiagnostics.size,16,'native-code and TypeError evidence share one fixed process ceiling');
console.log('PASS TypeError stage/source-line diagnostics preserve original failures, deduplicate, cap at 16 and cover payload and outer cookie paths without raw stack');
console.log('PASS native request failure codes retain numeric/string integers, deduplicate and exclude arbitrary messages/URLs while retaining transport origin');
console.log('PASS unknown native 2300999 preserves per-request transient HTTP evidence, not a global network outage or a source rule verdict');


// Exercise the public Host entry and the exact SDK normalization function.
// The Core wrapper input below follows host_error_with_identity; the actual
// QuickJS/wire counterpart is covered by reader-runtime's native cause tests.
const sdk=readFileSync(new URL('../entry/vendor/core-harmony/sdk/reader_core.ts',import.meta.url),'utf8');
const normalizeSource=sdk.slice(sdk.indexOf('function normalizeHostError('),sdk.indexOf('function readTransactionPendingDetails('));
const normalize=new Function(stripTypeScriptTypes(normalizeSource)+";function isJsonObject(v){return typeof v==='object'&&v!==null&&!Array.isArray(v)};return normalizeHostError;")();
const requestLog='http.execute failure requestId=%{public}d stage=request.dispatch code=%{public}s elapsedMs=%{public}d transient=%{public}s';
let requestId=900;
for(const code of [2300023,2300060,'2300060',undefined,2300999,2300060]) {
 requestId++;
 requestFailure=Object.assign(new Error('Internal error PRIVATE_PAYLOAD'),code===undefined?{}:{code});
 const count=requests.length;
 await assert.rejects(host.execute({url:'https://93.184.216.34/PRIVATE_URL',retry:{maxAttempts:2,backoffMillis:0}},requestId),failure=>{
  const normalized=normalize(normalize(failure));
  assert.equal(normalized.code,'INTERNAL');assert.equal(normalized.retryable,code===2300999);
  assert.equal(normalized.details.category,'SOURCE_HTTP_FAILED');
  assert.equal(normalized.details.platformCode,code===undefined?undefined:Number(code));
  assert.equal(Object.hasOwn(normalized.details,'platformCode'),code!==undefined);
  const core={message:normalized.message,event:{requestId,error:{...normalized,details:{category:'SOURCE_HTTP_FAILED',cause:normalized.details,
   host:{operationId:requestId+100,requestId,capability:'http.execute'}}}}};
  const classified=classifyRemoteReadingCommandFailure('chapter.content',core);
  assert.equal(classified.category,'SOURCE_HTTP_FAILED');assert.equal(classified.transientTransport,code===2300999);
  const summary=httpTransportFailureSummary(core);
  assert.equal(summary.requestId,requestId);assert.equal(summary.operationId,requestId+100);
  assert.equal(summary.platformCode,code===undefined?undefined:Number(code));
  assert.ok(summary.elapsedMs>=0);assert.equal(summary.stage,'request.dispatch');
  assert.equal(summary.transient,code===2300999);assert.ok(!JSON.stringify(summary).includes('PRIVATE_'));
  for(const other of ['SOURCE_RULE_FAILED','SOURCE_RESPONSE_FORMAT']){
   assert.equal(httpTransportFailureSummary({...core,event:{requestId,error:{...core.event.error,details:{...core.event.error.details,category:other}}}}),undefined,'later independent errors never inherit old HTTP evidence');
  }
  assert.equal(httpTransportFailureSummary({...core,event:{requestId,error:{...core.event.error,code:'CANCELLED'}}}),undefined);
  return true;
 });
 assert.equal(requests.length,count+2,'explicit retry policy remains unchanged');
 assert.equal(logs.filter(v=>v.includes(requestLog)&&v[3]===requestId).length,1,'one association per final execute failure, even after retry and diagnostic inventory saturation');
}
requestFailure=undefined;
const correlated=logs.filter(v=>v.includes(requestLog));
assert.equal(correlated.length,6);assert.ok(!JSON.stringify(correlated).includes('PRIVATE_'));
assert.ok(!JSON.stringify(correlated).includes('https://'));
assert.equal(correlated.filter(v=>v[4]==='2300060').length,3,'repeated same-code operations retain distinct request IDs');
assert.equal(correlated.filter(v=>v[4]==='none').length,1,'missing code is explicit and not fabricated');
// Our own cancellation can make native request() reject with code 23. It is
// cancellation, not source health evidence, and the following request works.
requestFailure=request=>new Promise((resolve,reject)=>{request.onDestroy=()=>reject(Object.assign(new Error('aborted'),{code:2300023}));});
const before=requests.length;
const cancelled=host.execute({url:'https://93.184.216.34/PRIVATE_URL'},999);
for(let n=0;n<20&&requests.length===before;n++)await new Promise(resolve=>setTimeout(resolve,0));
host.cancel(999);
await assert.rejects(cancelled,error=>{
 assert.match(error.message,/cancelled/);assert.equal(error.details?.category,undefined);return true;
});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(logs.filter(v=>v.includes(requestLog)&&v[3]===999).length,0);
requestFailure=undefined;response={responseCode:200,result:new ArrayBuffer(0),header:{}};
assert.equal((await host.execute({url:'https://93.184.216.34/next'},1000)).status,200);
console.log('PASS actual Host -> SDK -> CoreError input -> reading classifier and safe search summary: TLS/23/no-code retain HTTP cause, only known transient codes retry; per-operation association survives repeats, cancellation and later independent failures stay separate');

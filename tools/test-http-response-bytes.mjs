import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const app=new URL('../entry/src/main/ets/app/',import.meta.url);
const source=name=>stripTypeScriptTypes(readFileSync(new URL(name,app),'utf8').replace(/^import[\s\S]*?;\n/gm,'')).replace(/^export /gm,'');
const httpSource=source('HttpExecuteHost.ts'),policy=source('HttpTransportPolicy.ts');
const logs=[],requests=[],admissions=[];
let response,requestFailure,cookieFailure;
const http={RequestMethod:Object.fromEntries(['GET','HEAD','POST','PUT','DELETE','OPTIONS','CONNECT','TRACE'].map(method=>[method,method])),
 HttpDataType:{ARRAY_BUFFER:2},InterceptorType:{REDIRECTION:1},
 HttpInterceptorChain:class{addChain(items){assert.equal(items.length,1);this.items=items;return true;}apply(request){request.interceptors=this.items;return true;}},
 createHttp(){const request={destroyed:false,async request(url,options){this.url=url;this.options=options;if(requestFailure)throw requestFailure;return response;},destroy(){this.destroyed=true;}};requests.push(request);return request;}};
const cookieStore={instance:{async cookieHeader(){if(cookieFailure)throw cookieFailure;return '';},async storeResponseCookies(){return [];}}};
const nativeUtil={TextDecoder:{create:(encoding,options)=>({decodeToString:bytes=>new TextDecoder(encoding,options).decode(bytes)})}};
const NetworkEnvironmentError=class extends Error{};
const Host=new Function('http','url','util','connection','prepareNetworkTarget','NetworkEnvironmentError','CookieSessionStore','errorMessageOf','hilog',
 policy+httpSource+';return HttpExecuteHost;')(http,{URL:{parseURL:(value,base)=>new URL(value,base)}},nativeUtil,{},
 async value=>{admissions.push(value);return{host:'93.184.216.34',route:'direct',addresses:['93.184.216.34']};},NetworkEnvironmentError,cookieStore,
 error=>error instanceof Error?error.message:String(error),{error:(...values)=>logs.push(values),warn:(...values)=>logs.push(values)});
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
await assert.rejects(execute(),error=>error===requestFailure);requestFailure=undefined;
assert.equal(logs.filter(values=>values.includes('request.dispatch')&&values.includes('no-frame')).length,1,'unknown stack locations become a fixed no-frame marker');
await assert.rejects(execute({header:null}),TypeError);
assert.equal(logs.filter(values=>values.includes('response.headers')).length,1,'header conversion failure keeps a distinct fixed stage');
const safeLogs=logs.filter(values=>values.includes('http.execute TypeError stage=%{public}s frame=%{public}s'));
assert.ok(!JSON.stringify(safeLogs).includes('PRIVATE_'));assert.ok(!JSON.stringify(safeLogs).includes('https://'));
for(let n=1;n<30;n++){
 const error=new TypeError('secret');error.stack='at call (NetworkRoutePolicy.ts:'+n+':3)';host.reportTypeError(error,'request.chain');
}
assert.equal(Host.reportedTypeErrors.size,16,'process-wide TypeError evidence has a fixed ceiling');
console.log('PASS TypeError stage/source-line diagnostics preserve original failures, deduplicate, cap at 16 and cover payload and outer cookie paths without raw stack');

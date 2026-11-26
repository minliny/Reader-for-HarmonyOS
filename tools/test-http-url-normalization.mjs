import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {CapabilityRouter} from '../entry/vendor/core-harmony/sdk/reader_core.ts';

const app=new URL('../entry/src/main/ets/app/',import.meta.url);
const source=name=>stripTypeScriptTypes(readFileSync(new URL(name,app),'utf8')
 .replace(/^import[\s\S]*?;\n/gm,'').replace(/^export \{[^}]*\} from [^;]*;\n/gm,'')).replace(/^export /gm,'');
const dispatched=[],admitted=[],cookieReads=[],cookieWrites=[],pins=[];
let responses=[];
const http={RequestMethod:Object.fromEntries(['GET','HEAD','POST','PUT','DELETE','OPTIONS','CONNECT','TRACE'].map(method=>[method,method])),
 HttpDataType:{ARRAY_BUFFER:2},InterceptorType:{REDIRECTION:1},
 HttpInterceptorChain:class{addChain(){return true;}apply(){return true;}},
 createHttp:()=>({async request(value,options){
  // A platform boundary with the observed libcurl URL-format constraint.
  // It does not normalize input for production; it records exactly what arrived.
  if(/[\u0000-\u0020\u007f]/u.test(value))throw Object.assign(new Error('Invalid URL format or missing URL'),{code:2300003});
  dispatched.push({url:value,options});
  return responses.shift()??{responseCode:200,result:new ArrayBuffer(0),header:{}};
 },destroy(){}})};
const cookieStore={instance:{sessionGeneration:()=>1,
 async cookieHeader(_session,value){cookieReads.push(value);return 'session=fixture';},
 async storeResponseCookies(_session,value){cookieWrites.push(value);return [];}}};
const nativeUtil={TextDecoder:{create:(charset,options)=>({decodeToString:bytes=>new TextDecoder(charset,options).decode(bytes)})}};
const connection={async addCustomDnsRule(host,addresses){pins.push({host,addresses});},async removeCustomDnsRule(){}};
const policy=source('../platform/network/HttpTransportPolicy.ts');
const Host=new Function('http','url','util','connection','prepareNetworkTarget','NetworkEnvironmentError','CookieSessionStore','errorMessageOf','hilog','encodeSharedText',
 policy+source('../platform/network/HttpExecuteHost.ts')+';return HttpExecuteHost;')(
 http,{URL:{parseURL:(value,base)=>new URL(value,base)}},nativeUtil,connection,
 async value=>{admitted.push(value);return{host:new URL(value).hostname,route:'direct',addresses:['93.184.216.34']};},
 class extends Error{},cookieStore,error=>error instanceof Error?error.message:String(error),{error(){},warn(){}},
 text=>Uint8Array.from(Buffer.from(text)));
const host=new Host();
const run=params=>host.execute({url:params.url,...params});

for (const timeoutMs of [0, -1, 0.1, '5', null]) {
 await assert.rejects(run({url:'https://example.test/',timeoutMs}),/timeoutMs must be a positive integer/);
}
assert.equal(dispatched.length,0,'invalid budgets cannot start I/O');
await run({url:'https://example.test/',timeoutMs:17});
assert.ok(dispatched.at(-1).options.connectTimeout<=17);
assert.ok(dispatched.at(-1).options.readTimeout<=17);
const budgets = [];
const createDeadline = host.createDeadline.bind(host);
host.createDeadline = milliseconds => {
  budgets.push(milliseconds);
  return createDeadline(milliseconds);
};
const Registry = new Function('CapabilityRouter', 'HttpExecuteHost', 'readerPublicSearchHttpFixtureMode',
  source('ReaderHostRegistry.ts') + ';return ReaderHostRegistry;')(CapabilityRouter, {instance: host}, () => undefined);
Registry.stageRecoveryFor = () => Promise.resolve(); // No filesystem in this fixture.
const registry = new Registry({filesDir: '/fixture'});
const router = registry.createCapabilityRouter();
const Owner = new Function('readerRuleMutationEffects', 'coreAdmissionFailureSummary', 'httpResponseFailureSummary',
  source('ReaderRuntimeOwner.ts') + ';return ReaderRuntimeOwner;')((method, params) => ({method, params}),
  () => undefined, () => undefined);
let requestId = 10;
let handleCommand;
const runtime = {
  send() { return ++requestId; },
  async waitForResult(id, options) { return {requestId: id, data: await handleCommand(id, options)}; },
  async request(_method, _params, options) { return this.waitForResult(this.send(), options); },
};
const owner = Object.assign(Object.create(Owner.prototype), {host: registry, runtime, state: 'ready',
  start: async () => {}, readingEntryPreparations: () => ({beginRequest: () => false})});
function httpEvent(id, stage, extra = {}, diagnosticId = id) {
  const diagnostic = stage === undefined ? undefined : {traceId: 'fixture', requestId: diagnosticId, sourceId: 'source', stage};
  return {capability: 'http.execute', requestId: id, operationId: 37, params: {url: 'https://example.test/', diagnostic, ...extra}};
}
function assertBudget(total, connect) {
  const options = dispatched.at(-1).options;
  assert.equal(budgets.at(-1), total);
  if (connect === 8000) assert.equal(options.connectTimeout, connect);
  else assert.ok(options.connectTimeout <= connect && options.connectTimeout >= connect - 1000);
}
const stages = [];
for (const method of ['source.check.run', 'source.check.ephemeral.run', 'chapter.content', 'book.search']) {
  const check = method.startsWith('source.check.');
  handleCommand = async id => {
    await router.route(httpEvent(id + 100, 'L3'));
    assertBudget(25000, 25000); // Another live HTTP operation cannot borrow the registered check.
    for (const stage of ['L2', 'L3', 'L4', 'L5', 'L1', undefined]) {
      await router.route(httpEvent(id, stage));
      const eligible = check && stage !== 'L1' && stage !== undefined;
      assertBudget(eligible ? 15000 : 25000, eligible ? 8000 : 25000);
    }
    await router.route(httpEvent(id, 'L2', {}, id + 1));
    assertBudget(25000, 25000);
    await router.route(httpEvent(id, 'L2', {timeoutMs: 5000}));
    assertBudget(5000, 5000);
    return {};
  };
  await owner.requestDirect(method, {}, method === 'source.check.run' ? {onSourceCheckStage: stage => stages.push(stage)} : {});
  await router.route(httpEvent(requestId, 'L2'));
  assertBudget(25000, 25000);
}
assert.deepEqual(stages, ['L2', 'L3', 'L4', 'L5', 'L2']);
handleCommand = async id => {
  const assetCalls = [];
  registry.setResponseAssetBridge({
    begin(...args) { assetCalls.push(args); return 5; },
    write(req, op, asset, bytes) { assetCalls.push([req, op, asset, bytes.byteLength]); },
    commit(...args) { assetCalls.push(args); return 1; },
  });
  responses.push({responseCode: 200, result: Uint8Array.of(1).buffer, header: {'content-type': 'image/png'}});
  const asset = await router.route(httpEvent(id, 'L5', {responseAsset: true}));
  assertBudget(15000, 8000);
  assert.equal(asset.bodyAsset.operationId, 37);
  assert.deepEqual(assetCalls, [[id, 37, 1], [id, 37, 5, 1], [id, 37, 5]]);
  const event = httpEvent(id, 'L2');
  let completeHttp;
  responses.push(new Promise(resolve => { completeHttp = resolve; }));
  const pending = router.route(event);
  await new Promise(resolve => setImmediate(resolve));
  router.cancel(event);
  await assert.rejects(pending, /cancelled by Core request/);
  completeHttp({responseCode: 200, result: new ArrayBuffer(0), header: {}});
  throw new Error('fixture terminal cancellation');
};
await assert.rejects(owner.requestDirect('source.check.run', {}), /fixture terminal cancellation/);
await router.route(httpEvent(requestId, 'L2'));
assertBudget(25000, 25000);
console.log('PASS source-check command budgets, recorder compatibility, reader/search isolation, binary asset routing and cancellation cleanup');
let finishLate;
responses.push(new Promise(resolve=>{finishLate=resolve;}));
await assert.rejects(run({url:'https://example.test/',timeoutMs:20}),/deadline/);
const atTimeout=dispatched.length;
finishLate({responseCode:200,result:new ArrayBuffer(0),header:{}});
await Promise.resolve();
await Promise.resolve();
assert.equal(dispatched.length,atTimeout,'late responses cannot start a new retry');

const examples=[
 ['https://Source.Example/中文 目录?key=鸣龙 公子#章节 一','https://source.example/%E4%B8%AD%E6%96%87%20%E7%9B%AE%E5%BD%95?key=%E9%B8%A3%E9%BE%99%20%E5%85%AC%E5%AD%90#%E7%AB%A0%E8%8A%82%20%E4%B8%80'],
 ['https://source.example/search?q=%D6%D0%CE%C4&literal=%2520&plus=+&amp=%26#kept','https://source.example/search?q=%D6%D0%CE%C4&literal=%2520&plus=+&amp=%26#kept'],
 ['  https://Source.Example:443/a/../search?q=鸣龙  ','https://source.example/search?q=%E9%B8%A3%E9%BE%99'],
];
for(const [input,expected] of examples){
 const result=await run({url:input,session:{id:'opaque'}});
 assert.equal(result.finalUrl,expected);assert.equal(dispatched.at(-1).url,expected);
 assert.equal(admitted.at(-1),expected);assert.equal(cookieReads.at(-1),expected);assert.equal(cookieWrites.at(-1),expected);
 assert.equal(pins.at(-1).host,'source.example');assert.deepEqual(pins.at(-1).addresses,['93.184.216.34']);
}

responses=[{responseCode:307,result:undefined,header:{location:'../第二 章?q=%D6%D0&x=中文#末'}}];
const start=dispatched.length;
const redirect=await run({url:'https://Source.Example/第一/开始',method:'POST',body:'request body',headers:{Host:'custom.source.example'},session:{id:'opaque'}});
assert.equal(dispatched.length,start+2);
assert.equal(redirect.finalUrl,'https://source.example/%E7%AC%AC%E4%BA%8C%20%E7%AB%A0?q=%D6%D0&x=%E4%B8%AD%E6%96%87#%E6%9C%AB');
assert.equal(redirect.redirects.length,1);
assert.equal(cookieReads.at(-1),redirect.finalUrl);assert.equal(cookieWrites.at(-1),redirect.finalUrl);
for(const request of dispatched.slice(start)){
 assert.equal(request.options.method,'POST','URL normalization must not change method');
 assert.equal(Buffer.from(request.options.extraData).toString(),'request body','307 keeps the original body');
 assert.equal(request.options.header.Host,'custom.source.example','same-origin hops retain the source Host override');
}

responses=[{responseCode:302,result:undefined,header:{location:'https://Other.Example/下一 章'}}];
await run({url:'https://Source.Example/first',headers:{Authorization:'fixture',Cookie:'private',Host:'source.example'}});
assert.equal(dispatched.at(-1).url,'https://other.example/%E4%B8%8B%E4%B8%80%20%E7%AB%A0');
for(const name of ['authorization','cookie','host'])assert.ok(!Object.keys(dispatched.at(-1).options.header).some(key=>key.toLowerCase()===name));

for(const value of ['http://127.1/','http://0x7f000001/','http://2130706433/','http://[::1]/','file:///etc/passwd','data:text/plain,test']){
 const count=dispatched.length;await assert.rejects(run({url:value}));assert.equal(dispatched.length,count,'normalization never bypasses target admission');
}
responses=[{responseCode:302,result:undefined,header:{location:'http://0x7f000001/秘密'}}];
const count=dispatched.length;await assert.rejects(run({url:'https://source.example/start'}),/private, loopback/);
assert.equal(dispatched.length,count+1,'a canonical private redirect is rejected before transport');
console.log('PASS actual execute/redirect/cookie/DNS/transport URL normalization: Chinese/space, existing GBK percent escapes, query/fragment, method/body preservation and private target rejection');

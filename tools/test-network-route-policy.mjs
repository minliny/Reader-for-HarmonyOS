import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const app=new URL('../entry/src/main/ets/app/',import.meta.url);
const read=n=>readFileSync(new URL(n,app),'utf8');
const code=n=>stripTypeScriptTypes(read(n).replace(/^import[\s\S]*?;\n/gm,'')).replace(/^export /gm,'');
let proxy,pac,dns,networks,bound,defaultNet,calls,onDns;
async function resolveDns(netId){calls.dns++;calls.dnsNetworks.push(netId);if(dns instanceof Error)throw dns;const result=dns.map(address=>({address}));onDns?.();return result;}
const netHandle=netId=>({netId,getAddressesByName:async()=>resolveDns(netId)});
const connection={
 getDefaultHttpProxy:async()=>{calls.proxy++;return proxy;},getPacUrl:()=>pac===undefined?'':'configured',getPacFileUrl:()=>'',findProxyForUrl:()=>pac,
 getAddressesByName:async()=>resolveDns('system'),
 getAppNet:async()=>bound===null?null:netHandle(bound),getDefaultNet:async()=>netHandle(defaultNet),
 getAllNets:async()=>assert.fail('an unrelated available network cannot authorize this request'),
 getNetCapabilities:async()=>assert.fail('synthetic route admission must not require a local VPN bearer'),
 getConnectionProperties:async net=>networks.find(n=>n.id===net.netId).properties,
 NetBearType:{BEARER_VPN:4},
};
const {prepareNetworkTarget,NetworkEnvironmentError,isSystemProxyExcluded}=new Function('connection',code('HttpTransportPolicy.ts')+code('NetworkRoutePolicy.ts')+';return {prepareNetworkTarget,NetworkEnvironmentError,isSystemProxyExcluded};')(connection);
const {isNetworkEnvironmentFailure}=new Function(code('ErrorMessage.ts')+';return {isNetworkEnvironmentFailure};')();
function reset(){proxy={host:'',port:0,exclusionList:[]};pac=undefined;dns=['93.184.216.34'];networks=[systemNetwork()];bound=0;defaultNet=7;onDns=undefined;calls={dns:0,proxy:0,dnsNetworks:[]};}
function systemNetwork({id=7,route='0.0.0.0',prefix=0,excluded=false,interfaceName='eth0',routeInterface=interfaceName}={}){return {id,properties:{interfaceName,routes:[{interface:routeInterface,destination:{address:{address:route},prefixLength:prefix},gateway:{address:'10.0.2.2'},hasGateway:true,isDefaultRoute:prefix===0,isExcludedRoute:excluded}]}};}
function vpn(options={}){return systemNetwork({interfaceName:'tun0',...options})}
reset();assert.equal((await prepareNetworkTarget('https://source.example/book')).route,'direct');assert.equal(calls.dns,1);
assert.deepEqual(calls.dnsNetworks,['system'],'unbound app retains system/UID VPN DNS instead of explicitly selecting physical default DNS');
for(const address of ['127.0.0.1','10.1.2.3','192.168.2.3','169.254.169.254','[::1]','198.18.0.1','2130706433']){
 reset();proxy={host:'user-proxy',port:8080,exclusionList:[]};await assert.rejects(prepareNetworkTarget('http://'+address+'/'));assert.equal(calls.proxy,0);
}
reset();proxy={host:'user-proxy',port:8080,exclusionList:[]};dns=Error('local DNS unavailable');assert.equal((await prepareNetworkTarget('https://source.example/')).route,'systemProxy');assert.equal(calls.dns,0);
assert.equal((await prepareNetworkTarget('https://93.184.216.34/book')).route,'systemProxy','literal public IP still follows system proxy selection');assert.equal(calls.dns,0);
proxy.exclusionList=['*.example'];await assert.rejects(prepareNetworkTarget('https://source.example/'),e=>e.details.phase==='dns');
for(const [host,patterns,excluded] of [['source.example',['localhost','127.*'],false],['source.example',['*.example'],true],['source.example',['source.example'],true],['source.example',['source.*'],true],['source.example',['*'],true],['source.example',['example'],false],['sourceXexample',['source.example'],false],['source.example',['[invalid]'],false]])assert.equal(isSystemProxyExcluded(host,patterns),excluded);
reset();proxy={host:'local-pac',port:1234,exclusionList:[]};pac='DIRECT';assert.equal((await prepareNetworkTarget('https://source.example')).route,'direct');pac='PROXY upstream:8080; DIRECT';dns=Error('proxy resolves DNS');assert.equal((await prepareNetworkTarget('https://source.example')).route,'systemProxy');pac='';await assert.rejects(prepareNetworkTarget('https://source.example'),e=>e.details.phase==='route');
reset();pac='PROXY upstream:8080';await assert.rejects(prepareNetworkTarget('https://source.example'),e=>e.details.phase==='route','configured PAC without ready system endpoint is not a direct connection');
reset();dns=['198.18.1.2'];assert.equal((await prepareNetworkTarget('https://source.example')).route,'systemSynthetic','VM/router transparent proxy can use the selected gateway default route without a local VPN');
networks=[vpn()];assert.equal((await prepareNetworkTarget('https://source.example')).route,'systemSynthetic');
bound=null;assert.equal((await prepareNetworkTarget('https://source.example')).route,'systemSynthetic','SDK may return null when the app is unbound');bound=0;
networks=[systemNetwork({route:'198.18.0.0',prefix:15})];assert.equal((await prepareNetworkTarget('https://source.example')).route,'systemSynthetic');
networks=[systemNetwork({route:'10.0.0.0',prefix:8})];await assert.rejects(prepareNetworkTarget('https://source.example'),isNetworkEnvironmentFailure);
networks=[systemNetwork({route:'198.18.0.0',prefix:15,excluded:true})];await assert.rejects(prepareNetworkTarget('https://source.example'),isNetworkEnvironmentFailure);
networks=[systemNetwork({routeInterface:'other0'})];await assert.rejects(prepareNetworkTarget('https://source.example'),isNetworkEnvironmentFailure,'a route on a different interface cannot authorize this network');
networks=[systemNetwork()];networks[0].properties.routes=[];await assert.rejects(prepareNetworkTarget('https://source.example'),isNetworkEnvironmentFailure,'missing route is not inferred from DNS');
networks=[systemNetwork()];networks[0].properties.routes.push(systemNetwork({route:'198.18.0.0',prefix:15,excluded:true}).properties.routes[0]);await assert.rejects(prepareNetworkTarget('https://source.example'),isNetworkEnvironmentFailure,'explicit exclusion wins over a covering default route');
networks=[vpn(),systemNetwork({id:8,route:'10.0.0.0',prefix:8})];bound=8;await assert.rejects(prepareNetworkTarget('https://source.example'),isNetworkEnvironmentFailure,'a different network VPN cannot authorize the selected app network');assert.equal(calls.dnsNetworks.at(-1),8,'an already bound app resolves through the bound network');
networks=[systemNetwork({id:8})];assert.equal((await prepareNetworkTarget('https://source.example')).route,'systemSynthetic');
bound=0;dns=['198.18.1.2','192.168.1.1'];await assert.rejects(prepareNetworkTarget('https://source.example'));
for(const address of ['127.0.0.1','10.1.2.3','192.168.2.3','169.254.169.254','::1']){dns=[address];await assert.rejects(prepareNetworkTarget('https://source.example'))}
reset();dns=['198.18.1.2'];assert.equal((await prepareNetworkTarget('https://source.example')).route,'systemSynthetic');networks=[];await assert.rejects(prepareNetworkTarget('https://source.example'),isNetworkEnvironmentFailure);
reset();dns=['198.18.1.2'];defaultNet=0;await assert.rejects(prepareNetworkTarget('https://source.example'),isNetworkEnvironmentFailure);assert.equal(calls.dns,0);
for(const synthetic of [false,true]){
 reset();if(synthetic)dns=['198.18.1.2'];networks.push(systemNetwork({id:8}));onDns=()=>{defaultNet=8};
 await assert.rejects(prepareNetworkTarget('https://source.example'),isNetworkEnvironmentFailure,'a network switch during DNS invalidates the old admission');
 onDns=undefined;assert.equal((await prepareNetworkTarget('https://source.example')).route,synthetic?'systemSynthetic':'direct','a later request recovers using the newly selected network');
}
reset();dns=['198.18.1.2'];onDns=()=>{bound=7};await assert.rejects(prepareNetworkTarget('https://source.example'),isNetworkEnvironmentFailure,'binding change is detected even when its netId equals the default');
const error=new NetworkEnvironmentError('route','safe explanation');assert.equal(error.code,'NETWORK_ERROR');assert.equal(error.retryable,true);
assert.equal(isNetworkEnvironmentFailure(error),true);assert.equal(isNetworkEnvironmentFailure({event:{error:{details:{host:{diagnostics:{details:{category:'NETWORK_ENVIRONMENT'}}}}}}}),true);
assert.equal(isNetworkEnvironmentFailure({message:'NETWORK_ENVIRONMENT'}),false);assert.equal(isNetworkEnvironmentFailure({body:{category:'NETWORK_ENVIRONMENT'}}),false);
const cyclic={};cyclic.error=cyclic;assert.equal(isNetworkEnvironmentFailure(cyclic),false);
console.log('PASS: production proxy/DNS/transparent-gateway admission, selected-network exclusions, PAC, network changes and structured errors');
// Actual HTTP hop uses original hostname, system proxy and no application DNS override.
let pins=0,pinHistory=[],transportCalls=0,destroys=0,optionsSeen,urlSeen,transportError,responseCode=200,requestBehavior;
connection.addCustomDnsRule=async(host,addresses)=>{pins++;pinHistory.push({host,addresses:[...addresses]})};connection.removeCustomDnsRule=async()=>{pins--};
const http={InterceptorType:{REDIRECTION:1},HttpInterceptorChain:class{addChain(){return true}apply(){return true}},HttpDataType:{ARRAY_BUFFER:1},createHttp:()=>({request:async(url,options)=>{transportCalls++;optionsSeen=options;urlSeen=url;if(transportError)throw transportError;if(requestBehavior)return requestBehavior(url,options);return {responseCode,header:{},result:new ArrayBuffer(0)}},destroy(){destroys++}})};
const url={URL:{parseURL:(value,base)=>new URL(value,base)}};
const Host=new Function('connection','http','url','prepareNetworkTarget','NetworkEnvironmentError','hilog',code('HttpTransportPolicy.ts')+code('HttpExecuteHost.ts')+';return HttpExecuteHost;')(connection,http,url,prepareNetworkTarget,NetworkEnvironmentError,{warn(){},error(){}});
const host=new Host(),deadline=()=>({deadlineAt:Date.now()+10000,cancelled:false,expired:new Promise(()=>{})});
reset();proxy={host:'user-proxy',port:8080,exclusionList:[]};dns=Error('no local DNS');await host.singleHop('https://source.example/path',{enumMethod:'GET'}, {},{kind:'none'},undefined,deadline());assert.equal(pins,0);assert.equal(transportCalls,1);assert.equal(urlSeen,'https://source.example/path');assert.equal(optionsSeen.usingProxy,true);
reset();dns=['198.18.1.2'];const syntheticPinCount=pinHistory.length;await host.singleHop('https://source.example/path',{enumMethod:'GET'}, {},{kind:'none'},undefined,deadline());assert.equal(pins,0);assert.equal(transportCalls,2);assert.equal(pinHistory.length,syntheticPinCount+1);assert.deepEqual(pinHistory.at(-1),{host:'source.example',addresses:['198.18.1.2']});assert.equal(urlSeen,'https://source.example/path');assert.equal(optionsSeen.usingProxy,false,'original synthetic address is pinned without bypassing the OS gateway or rewriting Host/TLS');
reset();await host.singleHop('https://source.example/path',{enumMethod:'GET'}, {},{kind:'none'},undefined,deadline());assert.equal(pins,0);assert.equal(calls.dns,1);assert.equal(transportCalls,3);
assert.equal(optionsSeen.usingProxy,false,'direct admission cannot be silently rerouted through a changed system proxy');
for(const kind of ['pac-direct','excluded']){
 reset();proxy={host:'system-proxy',port:8080,exclusionList:kind==='excluded'?['source.example']:[]};if(kind==='pac-direct')pac='DIRECT';
 const target=await prepareNetworkTarget('https://source.example/path');assert.equal(target.bypassSystemProxy,true);
 await host.singleHop('https://source.example/path',{enumMethod:'GET'}, {},{kind:'none'},undefined,deadline());assert.equal(optionsSeen.usingProxy,false);assert.equal(pins,0);
}
reset();proxy={host:'system-proxy',port:8080,exclusionList:[]};responseCode=407;
await assert.rejects(host.singleHop('https://source.example/path',{enumMethod:'GET'}, {},{kind:'none'},undefined,deadline()),isNetworkEnvironmentFailure,'proxy authentication response must not enter source parsing');
responseCode=401;const unauthorized=await host.singleHop('https://source.example/path',{enumMethod:'GET'}, {},{kind:'none'},undefined,deadline());assert.equal(unauthorized.status,401,'origin authentication remains a source response');responseCode=200;
transportError=Object.assign(new Error('proxy resolution failed'),{code:2300005});
await assert.rejects(host.singleHop('https://source.example/path',{enumMethod:'GET'}, {},{kind:'none'},undefined,deadline()),isNetworkEnvironmentFailure);
transportError=Object.assign(new Error('origin peer certificate invalid'),{code:2300060});
await assert.rejects(host.singleHop('https://source.example/path',{enumMethod:'GET'}, {},{kind:'none'},undefined,deadline()),error=>error===transportError&&!isNetworkEnvironmentFailure(error),'one origin TLS failure cannot poison or stop the whole proxy candidate group');transportError=undefined;
console.log('PASS: actual HTTP hop preserves URL/system proxy, never pins proxy DNS, direct DNS queried once');

// A platform request may never settle, even after destroy. Its lease must not
// outlive the cancelled cycle or strand every later request to the same host.
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function until(predicate){for(let i=0;i<200;i++){if(predicate())return;await tick()}assert.fail('timed out waiting for production transition')}
const hop=d=>host.singleHop('https://lease.example/book',{enumMethod:'GET'}, {},{kind:'none'},undefined,d);
{
 reset();const d=host.createDeadline(5000);requestBehavior=()=>new Promise(()=>{});
 try{
  const before=transportCalls,request=hop(d);await until(()=>transportCalls===before+1);assert.equal(pins,1);
  host.cancelDeadline(d,'cancel test cycle');
  await assert.rejects(Promise.race([request,new Promise((_,reject)=>setTimeout(()=>reject(new Error('lease not released after cancellation')),300))]),/cancel test cycle/);
  await until(()=>pins===0&&!Host.targetTails.has('lease.example'));assert.ok(destroys>0);
  requestBehavior=undefined;assert.equal((await hop(deadline())).status,200);assert.equal(pins,0);
 }finally{host.disposeDeadline(d);requestBehavior=undefined}
}
// Cancelling a waiter cannot remove the still-held predecessor's DNS lease.
{
 reset();let releaseFirst;const held=new Promise(resolve=>{releaseFirst=resolve});let visits=0;
 requestBehavior=async()=>{if(++visits===1)await held;return{responseCode:200,header:{},result:new ArrayBuffer(0)}};
 const waitingDeadline=host.createDeadline(5000);let first,third;
 try{
  first=hop(deadline());await until(()=>visits===1);assert.equal(pins,1);
  const second=hop(waitingDeadline);await until(()=>calls.dns>=2);host.cancelDeadline(waitingDeadline,'cancel queued waiter');
  await assert.rejects(Promise.race([second,new Promise((_,reject)=>setTimeout(()=>reject(new Error('waiter did not cancel')),300))]),/cancel queued waiter/);
  assert.equal(pins,1);assert.equal(Host.targetTails.has('lease.example'),true);
  third=hop(deadline());await until(()=>calls.dns>=3);for(let i=0;i<5;i++)await tick();assert.equal(visits,1,'third request cannot pass the held first pin');
  releaseFirst();await first;await third;assert.equal(visits,2);assert.equal(pins,0);await until(()=>!Host.targetTails.has('lease.example'));
 }finally{releaseFirst();host.disposeDeadline(waitingDeadline);requestBehavior=undefined;await first?.catch(()=>{});await third?.catch(()=>{})}
}
console.log('PASS: cancelled never-settling HTTP frees DNS lease; queued cancellation preserves predecessor and same-host recovery');

// The actual SDK must produce the closed CoreError code set accepted by Rust's
// HostErrorParams.error. Host-only semantic codes belong in details, while NAPI
// JSON.stringify must retain Error.message and the environment category.
const sdkSource=stripTypeScriptTypes(readFileSync(new URL('../entry/vendor/core-harmony/sdk/reader_core.ts',import.meta.url),'utf8')).replace(/^export /gm,'');
const normalizeHostError=new Function(sdkSource+';return normalizeHostError;')();
const wire=JSON.parse(JSON.stringify(normalizeHostError(new NetworkEnvironmentError('route','代理路由未就绪'))));
assert.equal(wire.code,'INTERNAL','NETWORK_ERROR is a Host semantic code, not a valid Rust CoreError code');
assert.equal(wire.details.hostErrorCode,'NETWORK_ERROR');
assert.equal(wire.message,'代理路由未就绪');assert.equal(wire.retryable,true);assert.equal(wire.details.category,'NETWORK_ENVIRONMENT');assert.equal(wire.details.phase,'route');
console.log('PASS: vendored SDK emits a legal CoreError code and preserves Host network semantics, message and retryability through NAPI JSON');

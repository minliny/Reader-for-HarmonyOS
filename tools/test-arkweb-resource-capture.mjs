import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const app=new URL('../entry/src/main/ets/app/',import.meta.url);
const read=name=>readFileSync(new URL(name,app),'utf8');
const policy=stripTypeScriptTypes(read('HttpTransportPolicy.ts')).replace(/^export /gm,'');
const routeProduction=stripTypeScriptTypes(read('NetworkRoutePolicy.ts').replace(/^import[\s\S]*?;\n/gm,'')).replace(/^export /gm,'');
const NetworkEnvironmentError=new Function('connection',policy+routeProduction+';return NetworkEnvironmentError;')({});
const WebNetErrorList=Object.fromEntries([...readFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/api/@ohos.web.netErrorList.d.ts','utf8').matchAll(/^\s+(ERR_\w+) = (-?\d+),/gm)].map(match=>[match[1],Number(match[2])]));
assert.equal(WebNetErrorList.ERR_PROXY_CONNECTION_FAILED,-130);
const production=stripTypeScriptTypes(read('ArkWebExecutor.ts').replace(/^import[\s\S]*?;\n/gm,'')).replace('export class','class');
const ticks=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
class Clock {
 now=1000;next=1;timers=new Map();
 set=(fn,ms)=>{const id=this.next++;this.timers.set(id,{at:this.now+ms,fn});return id;};
 clear=id=>{this.timers.delete(id);};
 async advance(ms){const end=this.now+ms;while(true){const next=[...this.timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;this.now=next[1].at;this.timers.delete(next[0]);next[1].fn();await ticks();}this.now=end;await ticks();}
}
const base='https://93.184.216.34';
const matcher='(url) => { const match = new RegExp(".*\\\\.m3u8(?:\\\\?.*)?").exec(url); return match !== null && match.index === 0 && match[0].length === url.length; }';
function setup({autoAttach=true,autoDetach=true,constructorError=false,target={host:'93.184.216.34',addresses:['93.184.216.34'],route:'direct'},proxyAck=true}={}){
 const clock=new Clock();let generation=0;let cookies=[];const reconciled=[],clears=[],seeds=[],scripts=[],surfaces=[],proxyOperations=[],loads=[],admissions=[],pins=[];
 let onLoad=()=>{},evaluate,configureController=()=>{};
 const store={instance:{sessionGeneration:()=>generation,arkWebSeeds:async profile=>[{url:base,header:'sid='+profile}],reconcileArkWebCookies:async(...args)=>{reconciled.push(args);}}};
 class Controller {
  static setHostIP(...args){pins.push(args);} static clearHostIP(){}
  url='about:blank';stopCount=0;
  constructor(tag){if(constructorError)throw new Error('synthetic constructor error');this.tag=tag;configureController(this);}
  loadUrl(url){loads.push(url);this.url=url;if(url!=='about:blank')onLoad(url,surfaces.at(-1));}
  loadData(_body,_mime,_encoding,url){loads.push(url);this.url=url;onLoad(url,surfaces.at(-1));}
  getUrl(){return this.url;} getTitle(){return 'Reader fixture';} stop(){this.stopCount++;}
  async runJavaScript(script){scripts.push(script);if(evaluate)return evaluate(script);return JSON.stringify(new Function('return ('+script+')')());}
 }
 let proxyFailure;
 const proxyOperation=(kind,callback,config)=>{if(proxyFailure===kind)throw new Error('synthetic proxy SDK failure');proxyOperations.push({kind,callback,config});if(proxyAck)callback();};
 const webview={ProxyConfig:class {direct=false;insertDirectRule(){this.direct=true;}},ProxyController:{
  applyProxyOverride:(config,callback)=>proxyOperation('apply',callback,config),
  removeProxyOverride:callback=>proxyOperation('remove',callback),
 },WebviewController:Controller,WebCookieManager:{clearAllCookiesSync:()=>{clears.push(true);cookies=[];},configCookieSync:(_url,header)=>{seeds.push(header);cookies.push({name:'sid',value:header.split('=')[1],domain:'93.184.216.34',path:'/',isSecure:true,isHttpOnly:true,samesitePolicy:0,isSessionCookie:true});},fetchAllCookies:async()=>cookies},WebHttpCookieSameSitePolicy:{STRICT:1,LAX:2,NONE:3}};
 const Executor=new Function('prepareNetworkTarget','NetworkEnvironmentError','WebNetErrorList','webview','CookieSessionStore','setTimeout','clearTimeout','Date',policy+production+';return ArkWebExecutor;')(async url=>{admissions.push(url);return typeof target==='function'?target(url):target;},NetworkEnvironmentError,WebNetErrorList,webview,store,clock.set,clock.clear,{now:()=>clock.now});
 const e=new Executor();
 const host=surface=>{if(surface!==undefined){surfaces.push(surface);if(autoAttach)e.attachController(surface);}else if(autoDetach&&surfaces.length)e.detachController(surfaces.at(-1));};
 e.attachSurfaceHost(host);
 return {e,clock,scripts,seeds,clears,reconciled,surfaces,host,proxyOperations,loads,admissions,pins,
  setTarget:value=>{target=value;},setProxyAck:value=>{proxyAck=value;},setProxyFailure:value=>{proxyFailure=value;},
  get surface(){return surfaces.at(-1);},get controller(){return surfaces.at(-1)?.controller;},
  resource:(url,surface=surfaces.at(-1))=>e.onResourceLoad(url,surface),
  pageEnd:(url,surface=surfaces.at(-1))=>e.onPageEnd(url,surface),
  setLoad:fn=>{onLoad=fn;},setEvaluate:fn=>{evaluate=fn;},
  configureController:fn=>{configureController=fn;},setConstructorError:value=>{constructorError=value;},invalidate:()=>{generation++;}};
}
function params(extra={}){return {document:{kind:'url',url:base+'/page'},javaScript:'null',resourceUrlMatcherJavaScript:matcher,timeoutMillis:2000,...extra};}
function clean(s){assert.equal(s.e.jobs.size,0);assert.equal(s.e.active,undefined);assert.equal(s.clock.timers.size,0,'all deadline/init timers cleared');}
{
 const s=setup();let observerCalls=0;s.e.attachDiagnosticObserver(()=>{observerCalls++;throw new Error('observer must not affect selection');});s.setLoad(()=>{s.resource(base+'/style.css');s.resource(base+'/first.m3u8');s.resource(base+'/second.m3u8');});
 const result=await s.e.execute(params(),1);assert.equal(result.value,base+'/first.m3u8');assert.equal(result.resourceUrl,result.value);assert.equal(result.finalUrl,base+'/page');assert.equal(s.clock.now,1000,'before page-ready, no 500 ms settle wait');assert.equal(s.scripts.length,2);assert.ok(observerCalls>0);clean(s);
 console.log('PASS actual resource callbacks: first full match before page-ready, no timeline or refetch');
}
{
 const s=setup();let release;let first=true;s.setEvaluate(async script=>{if(first){first=false;await new Promise(resolve=>{release=resolve;});}return JSON.stringify(new Function('return ('+script+')')());});
 s.setLoad(()=>{s.resource(base+'/first.m3u8');s.resource(base+'/second.m3u8');});
 const pending=s.e.execute(params(),2);await ticks();assert.equal(s.scripts.length,1);release();const result=await pending;assert.equal(result.value,base+'/first.m3u8');clean(s);
 console.log('PASS serialized matching preserves callback order across delayed evaluations');
}
{
 const s=setup();let initializations=0;s.setEvaluate(async script=>{if(script==='INITIALIZE'){initializations++;s.resource(base+'/after-init.m3u8');return 'null';}return JSON.stringify(new Function('return ('+script+')')());});
 s.setLoad(()=>{s.pageEnd(base+'/page');s.pageEnd(base+'/page');});const pending=s.e.execute(params({javaScript:'INITIALIZE'}),3);await ticks();await s.clock.advance(500);const result=await pending;assert.equal(result.value,base+'/after-init.m3u8');assert.equal(initializations,1);clean(s);
 console.log('PASS source initialization runs once and its real resource event completes capture');
}
{
 const s=setup();s.setLoad(()=>{s.resource(base+'/first.m3u8');for(let i=0;i<200;i++)s.resource(base+'/noise-'+i);});
 const result=await s.e.execute(params(),4);assert.equal(result.value,base+'/first.m3u8');assert.equal(s.scripts.length,1);clean(s);
 console.log('PASS an earlier admitted match wins over a later resource-budget terminal marker');
}
for(const failure of ['timeout','cancel','detach','cookie-generation','network','budget','invalid-matcher']){
 const s=setup();let release;s.setEvaluate(async script=>{if(failure==='cancel'||failure==='detach'){await new Promise(resolve=>{release=resolve;});}if(failure==='invalid-matcher')return '"not boolean"';return JSON.stringify(new Function('return ('+script+')')());});
 const pending=s.e.execute(params({timeoutMillis:50,profileId:failure==='cookie-generation'?'source':undefined}),10);
 const rejected=assert.rejects(pending,error=>error!==undefined);await ticks();
 if(failure==='timeout'){s.resource(base+'/unmatched');await s.clock.advance(50);}
 if(failure==='cancel'){s.resource(base+'/match.m3u8');await ticks();s.e.cancel(10);}
 if(failure==='detach'){s.resource(base+'/match.m3u8');await ticks();s.e.detachController(s.surface);}
 if(failure==='cookie-generation'){s.invalidate();s.resource(base+'/match.m3u8');}
 if(failure==='network')s.resource('https://other.example/secret.m3u8');
 if(failure==='budget')for(let i=0;i<129;i++)s.resource(base+'/unmatched-'+i);
 if(failure==='invalid-matcher')s.resource(base+'/match.m3u8');
 await rejected;release?.();await ticks();s.resource(base+'/late.m3u8');await ticks();clean(s);assert.equal(s.reconciled.length,0);
 console.log('PASS terminal cleanup and late callback suppression: '+failure);
}
{
 const s=setup();s.setLoad(()=>s.resource(base+'/match.m3u8'));
 await s.e.execute(params({profileId:'one'}),20);await s.e.execute(params({profileId:'two'}),21);
 assert.deepEqual(s.seeds,['sid=one','sid=two']);assert.equal(s.clears.length,4);assert.deepEqual(s.reconciled.map(args=>args[0]),['one','two']);assert.deepEqual(s.reconciled.map(args=>args[2][0].value),['one','two']);clean(s);
 console.log('PASS source profiles retain isolated cookie hydration/capture and generation');
}
{
 const s=setup();s.setLoad(()=>s.resource(base+'/html.m3u8'));const result=await s.e.execute(params({document:{kind:'html',body:'<html/>',baseUrl:base+'/post-result'}}),30);assert.equal(result.value,base+'/html.m3u8');clean(s);
 assert.throws(()=>s.e.execute(params({resourceUrlMatcherJavaScript:''}),31));
 assert.throws(()=>s.e.execute(params({resourceUrlMatcherJavaScript:'x'.repeat(65537)}),32));
 assert.match(read('ArkWebExecutionHost.ets'),/\.onResourceLoad\([\s\S]*?onResourceLoad\(event\.url, surface\)/);
 assert.ok(!read('ArkWebExecutor.ts').includes("performance.getEntriesByType"));
 console.log('PASS POST HTML capture, bounded matcher admission and production callback wiring');
}
for(const failure of ['matcher-reject','matcher-sync-throw','initialization-reject','load-throw']){
 const s=setup();
 if(failure==='matcher-reject')s.setEvaluate(async()=>{throw new Error('synthetic matcher error');});
 if(failure==='matcher-sync-throw')s.configureController(controller=>{controller.runJavaScript=()=>{throw new Error('synthetic synchronous controller error');};});
 if(failure==='initialization-reject'){s.setEvaluate(async()=>{throw new Error('synthetic initialization error');});s.setLoad(()=>s.pageEnd(base+'/page'));}
 else if(failure==='load-throw')s.setLoad(()=>{throw new Error('synthetic load error');});
 else s.setLoad(()=>s.resource(base+'/match.m3u8'));
 const pending=s.e.execute(params({javaScript:'INITIALIZE'}),40);
 const rejected=assert.rejects(pending,error=>failure==='load-throw'?error.message==='synthetic load error':
   error.code==='SCRIPT_EXECUTION_FAILED'&&error.details.reason===(failure==='initialization-reject'?'RESOURCE_INITIALIZATION_FAILED':'RESOURCE_MATCHER_EXECUTION_FAILED'));
 await ticks();if(failure==='initialization-reject')await s.clock.advance(500);await rejected;clean(s);
 console.log('PASS execution failure is terminal with bounded cleanup: '+failure);
}
{
 const s=setup();let release;let first=true;
 s.setEvaluate(async script=>{if(first){first=false;await new Promise(resolve=>{release=resolve;});}return JSON.stringify(new Function('return ('+script+')')());});
 const old=s.e.execute(params({profileId:'one'}),50);const rejected=assert.rejects(old);await ticks();s.resource(base+'/old.m3u8');await ticks();s.e.cancel(50);await rejected;
 const current=s.e.execute(params({profileId:'two'}),51);await ticks();release();await ticks();assert.equal(s.e.active?.requestId,51,'late old matcher completion cannot finish the next job');
 s.resource(base+'/new.m3u8');assert.equal((await current).value,base+'/new.m3u8');assert.deepEqual(s.reconciled.map(args=>args[0]),['two']);clean(s);
 console.log('PASS late asynchronous matcher completion cannot publish into the next source profile');
}
{
 const s=setup();const resource=base+'/quoted.m3u8?q=";throw new Error(\'injected\');//';
 s.setLoad(()=>s.resource(resource));assert.equal((await s.e.execute(params(),60)).value,resource);clean(s);
 console.log('PASS quotes and executable-looking text in observed URLs remain JSON-encoded data');
}


// These native event handlers are generated from the production ETS by the
// installed SDK. Preserve an old callback closure across a new keyed surface;
// do not confuse this regression with an already-running JS Promise settling.
{
 const s=setup({autoDetach:false});const events=[];s.e.attachDiagnosticObserver(event=>events.push(event));
 let providerCalls=0;
 class Response {setResponseCode(value){this.code=value;}setReasonMessage(){}setResponseMimeType(){}setResponseData(){}}
 const {owner}=createReaderBuilderProbe(read('ArkWebExecutionHost.ets'),['build','surfacesForRender'],{
  ArkWebExecutor:{instance:s.e},WebResourceResponse:Response,
  redactedHttpUrl:new Function(policy+';return redactedHttpUrl;')(),
 });
 const old=s.e.execute(params(),70);const rejected=assert.rejects(old,error=>error.code==='CANCELLED');await ticks();
 const oldSurface=s.surface;
 Object.assign(owner,{surfaceId:oldSurface.id,currentSurface:oldSurface,interactive:false,appThemeScheme:'day',
  currentUrl:'unchanged',diagnosticResourceProvider:()=>{providerCalls++;return null;}});
 owner.initialRender();
 const oldWeb=[...owner.nodes.values()].find(n=>n.type==='Web');oldWeb.onControllerAttached();
 s.e.cancel(70);await rejected;
 const next=s.e.execute(params(),71);await ticks();
 assert.equal(s.surfaces.length,1,'next native Web must wait for the owning disappear ACK');
 assert.equal(s.clears.length,2,'next profile cannot hydrate or clear cookies before old surface retirement');
 oldWeb.onDisAppear();await s.clock.advance(50);
 const newSurface=s.surface;assert.notEqual(newSurface,oldSurface);assert.notEqual(newSurface.controller,oldSurface.controller);
 owner.surfaceId=newSurface.id;owner.currentSurface=newSurface;
 owner.replayOnly([[...owner.nodes.values()].find(n=>n.type==='ForEach').id]);
 const newWeb=[...owner.nodes.values()].find(n=>n.type==='Web'&&n.create.controller===newSurface.controller);assert.ok(newWeb);
 const active=s.e.active;active.interactive=true;const shared=base+'/same.m3u8';
 assert.equal(s.scripts.length,0,'old resource matcher has never started before cancellation');
 oldWeb.onErrorReceive({request:{getRequestUrl:()=>base+'/page',isMainFrame:()=>true},error:{getErrorCode:()=>-130,getErrorInfo:()=> 'net::ERR_PROXY_CONNECTION_FAILED'}});
 oldWeb.onHttpErrorReceive({request:{getRequestUrl:()=>base+'/page',isMainFrame:()=>true},response:{getResponseCode:()=>407}});
 oldWeb.onResourceLoad({url:shared});oldWeb.onPageEnd({url:base+'/old-page'});oldWeb.onPageBegin({url:base+'/old-page'});
 assert.equal(oldWeb.onOverrideUrlLoading({getRequestUrl:()=> 'https://other.example/private'}),true);
 assert.equal(oldWeb.onInterceptRequest({request:{getRequestUrl:()=>base+'/old-resource'}}).code,403);
 oldWeb.onDisAppear();oldWeb.onControllerAttached();s.e.finishInteractive(oldSurface);s.e.cancelInteractive(oldSurface);await ticks();
 assert.equal(owner.currentUrl,'unchanged');assert.equal(providerCalls,0,'revoked native callbacks never reach the diagnostic provider');
 assert.equal(active.nativeFailure,undefined);assert.equal(active.cancelled,false);assert.equal(active.userFinished,false);assert.equal(active.networkDenied,undefined);
 assert.equal(active.pageReadyAt,0);assert.equal(active.finalUrl,undefined);assert.equal(active.resourceCapture.count,0);
 assert.equal(s.scripts.length,0);assert.equal(newSurface.controller.stopCount,0);assert.equal(s.e.active,active);
 for(const kind of ['resourceDiscarded','pageEndDiscarded','pageBeginDiscarded','nativeErrorDiscarded'])assert.ok(events.some(e=>e.kind===kind&&e.requestId===70));
 newWeb.onResourceLoad({url:shared});assert.equal((await next).value,shared,'the same legitimate URL remains eligible on its new native surface');
 newWeb.onDisAppear();clean(s);
 console.log('PASS SDK native callback isolation: old resource/pageEnd/pageBegin/network/detach/attach/actions cannot contaminate a new surface; same new URL is accepted');
}
{
 const s=setup({autoDetach:false});const old=s.e.execute(params(),80);const rejected=assert.rejects(old);await ticks();const surface=s.surface;s.e.cancel(80);await rejected;
 const seen=[];s.e.attachSurfaceHost(surface=>seen.push(surface));
 assert.deepEqual(seen,[undefined],'a remounted Host never resurrects a revoked surface awaiting native retirement');
 const next=s.e.execute(params({timeoutMillis:50}),81);const timedOut=assert.rejects(next,error=>error.code==='TIMEOUT');await ticks();await s.clock.advance(50);await timedOut;
 assert.equal(s.surfaces.length,1);assert.equal(s.clears.length,2);assert.equal(s.e.active,undefined);assert.equal(s.e.surfaceLease.retired,false);
 s.e.detachController(surface);s.e.attachSurfaceHost(s.host);s.setLoad(()=>s.resource(base+'/recovered.m3u8'));
 assert.equal((await s.e.execute(params(),82)).value,base+'/recovered.m3u8');s.e.detachController(s.surface);clean(s);
 console.log('PASS missing native retirement ACK times out without controller reuse, Host remount or cookie crossover, then recovers after ACK');
}
for(const failure of ['cancel-before-mount','timeout-before-mount','host-detach-before-mount']){
 const s=setup({autoAttach:false});const pending=s.e.execute(params({timeoutMillis:failure==='timeout-before-mount'?50:2000}),90);
 const rejected=assert.rejects(pending,error=>error.code===(failure==='timeout-before-mount'?'TIMEOUT':'CANCELLED'));await ticks();const old=s.surface;
 if(failure==='cancel-before-mount')s.e.cancel(90);
 if(failure==='host-detach-before-mount')s.e.detachSurfaceHost(s.host);
 await s.clock.advance(100);await rejected;assert.equal(s.e.surfaceLease.retired,true);clean(s);
 s.e.attachController(old);assert.equal(s.e.surfaceLease.attached,false,'a withdrawn controller cannot attach late');assert.ok(old.controller.stopCount>0);
 s.e.attachSurfaceHost(s.host);s.setLoad(()=>s.resource(base+'/recovered.m3u8'));
 const next=s.e.execute(params(),91);await ticks();s.e.attachController(s.surface);await s.clock.advance(100);
 assert.equal((await next).value,base+'/recovered.m3u8');clean(s);
 console.log('PASS never-mounted surface cancellation/retirement/recovery: '+failure);
}
for(const priorSurface of [false,true]){
 const s=setup();if(priorSurface){s.setLoad(()=>s.resource(base+'/first.m3u8'));await s.e.execute(params(),100);}
 s.setConstructorError(true);await assert.rejects(s.e.execute(params(),101),error=>error.message==='synthetic constructor error');clean(s);
 s.setConstructorError(false);s.setLoad(()=>s.resource(base+'/recovered.m3u8'));
 assert.equal((await s.e.execute(params(),102)).value,base+'/recovered.m3u8');clean(s);
 console.log('PASS controller constructor failure preserves the original error, clears active state and recovers; prior retired surface='+priorSurface);
}
console.log('PH76 Host production-path resource capture: 26 scenario groups passed; SDK closure checks are local, native lifecycle timing still requires VM evidence');


// PH92: the same production executor and SDK-generated native callbacks cover
// transport selection, global ProxyController ownership and native failures.
{
 const s=setup({proxyAck:false});s.setLoad(()=>s.resource(base+'/selected.m3u8'));
 const job=s.e.execute(params(),200);await ticks();assert.deepEqual(s.admissions,[base+'/page'],'public IP literals still select a route');
 assert.equal(s.loads.length,0);assert.equal(s.proxyOperations[0].kind,'remove');
 s.proxyOperations[0].callback();assert.equal((await job).value,base+'/selected.m3u8');clean(s);
 console.log('PASS system route waits for native restore ACK before loading, including public IP literals');
}
{
 const s=setup({target:{host:'reader.example',addresses:['198.18.2.3'],route:'systemSynthetic'}});
 const pending=s.e.execute(params({document:{kind:'url',url:'https://reader.example/page'}}),201);const rejected=assert.rejects(pending);await ticks();
 assert.equal(s.pins[0][0],'reader.example');assert.equal(s.pins[0][1],'198.18.2.3','preserve OS-owned synthetic DNS mapping without rebinding the hostname');
 s.e.cancel(201);await rejected;clean(s);
 console.log('PASS system synthetic DNS retains the admitted address pin and Host/TLS hostname');
}
for(const stop of ['cancel','timeout']){
 const s=setup({proxyAck:false,target:{host:'93.184.216.34',addresses:['93.184.216.34'],route:'direct',bypassSystemProxy:true}});
 const old=s.e.execute(params({timeoutMillis:stop==='timeout'?50:2000}),210);
 const rejected=assert.rejects(old,e=>stop==='cancel'?e.code==='CANCELLED':e.details.category==='NETWORK_ENVIRONMENT');await ticks();
 assert.equal(s.proxyOperations[0].kind,'apply');assert.equal(s.proxyOperations[0].config.direct,true);assert.equal(s.loads.length,0);
 if(stop==='cancel')s.e.cancel(210);else await s.clock.advance(50);
 await rejected;clean(s);const oldLease=s.e.proxyLease;assert.equal(oldLease.listeners.size,0);
 s.setTarget({host:'93.184.216.34',addresses:[],route:'systemProxy'});s.setLoad(()=>s.resource(base+'/next.m3u8'));
 const next=s.e.execute(params(),211);await ticks();assert.equal(s.surfaces.length,1,'next Web cannot mount while the old global override is pending');
 s.proxyOperations[0].callback();await ticks();assert.equal(s.proxyOperations[1].kind,'remove');assert.equal(s.loads.length,0);
 assert.equal(s.surfaces.length,1,'late apply ACK only requests cleanup, never starts the next document');
 s.proxyOperations[1].callback();await ticks();assert.equal(s.proxyOperations[2].kind,'remove');assert.equal(s.surfaces.length,2);assert.equal(s.loads.length,0);
 s.proxyOperations[0].callback();s.proxyOperations[1].callback();await ticks();assert.equal(s.loads.length,0,'duplicate old ACK cannot acknowledge the new system configuration');
 s.proxyOperations[2].callback();assert.equal((await next).value,base+'/next.m3u8');clean(s);
 assert.equal(oldLease.phase,'retired');assert.equal(oldLease.listeners.size,0);
 console.log('PASS '+stop+' during DIRECT setup: late apply/cleanup ACK is isolated, native configuration serializes and next route restores system');
}
{
 const s=setup({target:{host:'93.184.216.34',addresses:['93.184.216.34'],route:'direct',bypassSystemProxy:true}});
 s.setLoad(()=>{s.setProxyAck(false);s.resource(base+'/done.m3u8');});await s.e.execute(params(),220);
 const oldLease=s.e.proxyLease;assert.equal(oldLease.phase,'removing');assert.equal(s.proxyOperations[1].kind,'remove');
 for(let i=0;i<3;i++){
  const next=s.e.execute(params({timeoutMillis:30}),221+i);const rejected=assert.rejects(next,e=>e.details.category==='NETWORK_ENVIRONMENT');await ticks();await s.clock.advance(30);await rejected;
  assert.equal(oldLease.listeners.size,0,'timed-out jobs unsubscribe instead of accumulating retained listeners');assert.equal(s.surfaces.length,1);clean(s);
 }
 s.proxyOperations[1].callback();s.setProxyAck(true);s.setTarget({host:'93.184.216.34',addresses:[],route:'systemProxy'});s.setLoad(()=>s.resource(base+'/recovered.m3u8'));
 assert.equal((await s.e.execute(params(),225)).value,base+'/recovered.m3u8');clean(s);
 console.log('PASS missing cleanup ACK bounds later jobs, retains no expired waiters, and permits recovery only after real cleanup ACK');
}
for(const kind of ['apply','remove']){
 const s=setup({target:{host:'93.184.216.34',addresses:['93.184.216.34'],route:'direct',bypassSystemProxy:true}});
 if(kind==='apply')s.setProxyFailure('apply');else s.setLoad(()=>{s.setProxyFailure('remove');s.resource(base+'/done.m3u8');});
 if(kind==='apply')await assert.rejects(s.e.execute(params(),230),e=>e.details.category==='NETWORK_ENVIRONMENT');
 else {await s.e.execute(params(),230);await assert.rejects(s.e.execute(params(),231),e=>e.details.category==='NETWORK_ENVIRONMENT');assert.equal(s.loads.length,1);}
 clean(s);assert.equal(s.e.proxyLease.listeners.size,0);
 if(kind==='apply'){s.setProxyFailure(undefined);s.setLoad(()=>s.resource(base+'/recovered.m3u8'));await s.e.execute(params(),232);clean(s);}
 console.log('PASS synchronous proxy '+kind+' failure is typed; setup can recover, unconfirmed cleanup blocks all later loads');
}
function nativeHost(s){
 const {owner}=createReaderBuilderProbe(read('ArkWebExecutionHost.ets'),['build','surfacesForRender'],{ArkWebExecutor:{instance:s.e}});
 Object.assign(owner,{surfaceId:s.surface.id,currentSurface:s.surface,interactive:false,appThemeScheme:'day'});owner.initialRender();
 return [...owner.nodes.values()].find(n=>n.type==='Web');
}
for(const kind of ['proxy','407','TLS','404','generic-connect','numeric-only','direct407','lookalike-url']){
 const s=setup({target:{host:'93.184.216.34',addresses:[],route:kind==='direct407'?'direct':'systemProxy'}});
 const pending=s.e.execute(params(),240);const rejected=assert.rejects(pending,e=>{
  if(kind==='proxy'||kind==='407'||kind==='numeric-only')return e.code==='NETWORK_ERROR'&&e.retryable===true&&e.details.category==='NETWORK_ENVIRONMENT'&&e.details.phase==='transport';
  return e.details.category===undefined&&e.code===(kind==='TLS'?'TLS_ERROR':'NETWORK_ERROR');
 });await ticks();const native=nativeHost(s);const request={getRequestUrl:()=>base+'/page',isMainFrame:()=>true};
 if(kind==='407'||kind==='404'||kind==='direct407')native.onHttpErrorReceive({request,response:{getResponseCode:()=>kind==='404'?404:407}});
 else native.onErrorReceive({request,error:{getErrorCode:()=>kind==='numeric-only'?-130:-2,getErrorInfo:()=>kind==='proxy'?'net::ERR_PROXY_CONNECTION_FAILED':kind==='TLS'?'net::ERR_CERT_AUTHORITY_INVALID':kind==='numeric-only'?'opaque failure':kind==='lookalike-url'?'net::ERR_NAME_NOT_RESOLVED at https://reader.example/ERR_PROXY_CONNECTION_FAILED':'net::ERR_CONNECTION_REFUSED'}});
 await rejected;clean(s);assert.equal(s.reconciled.length,0);
 console.log('PASS SDK main-frame failure classification: '+kind);
}
{
 const s=setup({proxyAck:false,target:{host:'93.184.216.34',addresses:[],route:'systemProxy'}});
 const pending=s.e.execute(params(),250);await ticks();const native=nativeHost(s);
 const request={getRequestUrl:()=>base+'/page',isMainFrame:()=>true};const error={getErrorCode:()=>-130,getErrorInfo:()=> 'net::ERR_PROXY_CONNECTION_FAILED'};
 native.onErrorReceive({request,error});assert.equal(s.e.active.nativeFailure,undefined,'callbacks before admitted load cannot fail the document');
 s.proxyOperations[0].callback();await ticks();
 native.onErrorReceive({request:{...request,isMainFrame:()=>false},error});
 native.onHttpErrorReceive({request:{...request,isMainFrame:()=>false},response:{getResponseCode:()=>407}});
 native.onErrorReceive({request:{...request,getRequestUrl:()=> 'about:blank'},error});
 assert.equal(s.e.active.nativeFailure,undefined);s.resource(base+'/real.m3u8');assert.equal((await pending).value,base+'/real.m3u8');clean(s);
 console.log('PASS pre-load/about:blank/subresource failures cannot poison the main document');
}
console.log('PH92 ArkWeb proxy lifecycle/native failure: 16 additional scenario groups passed; no device or native timing acceptance claimed');

for(const status of [401,403,429]){
 const s=setup();s.setEvaluate(async()=>JSON.stringify('<html>g-recaptcha</html>'));
 const pending=s.e.execute(params({resourceUrlMatcherJavaScript:undefined}),260);
 const rejected=assert.rejects(pending,e=>e.code==='CHALLENGE_REQUIRED');await ticks();const native=nativeHost(s);
 native.onHttpErrorReceive({request:{getRequestUrl:()=>base+'/page',isMainFrame:()=>true},response:{getResponseCode:()=>status}});
 assert.equal(s.e.active.nativeFailure,undefined);s.pageEnd(base+'/page');await s.clock.advance(600);await rejected;clean(s);
 console.log('PASS existing HTML challenge classification precedes ordinary HTTP '+status+' failure');
}
{
 const s=setup();s.setEvaluate(async()=>JSON.stringify('<html>not a challenge</html>'));
 const pending=s.e.execute(params({resourceUrlMatcherJavaScript:undefined}),261);const rejected=assert.rejects(pending,e=>e.details.status===403&&e.details.category===undefined);await ticks();
 const native=nativeHost(s);native.onHttpErrorReceive({request:{getRequestUrl:()=>base+'/page',isMainFrame:()=>true},response:{getResponseCode:()=>403}});
 s.pageEnd(base+'/page');await s.clock.advance(600);await rejected;clean(s);
 console.log('PASS an ordinary forbidden document stays a source HTTP failure after challenge detection');
}
{
 const s=setup({proxyAck:false,target:{host:'93.184.216.34',addresses:['93.184.216.34'],route:'direct',bypassSystemProxy:true}});
 const pending=s.e.execute(params(),262);const rejected=assert.rejects(pending,e=>e.code==='CANCELLED');await ticks();
 s.e.detachController(s.surface);await rejected;clean(s);assert.equal(s.e.proxyLease.releaseRequested,true);
 s.proxyOperations[0].callback();s.proxyOperations[1].callback();assert.equal(s.e.proxyLease.phase,'retired');
 console.log('PASS native detach cancels pending proxy ACK immediately and late configuration is cleaned');
}
console.log('PH92 proxy/challenge compatibility: 5 additional scenario groups passed');

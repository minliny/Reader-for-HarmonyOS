import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const app=new URL('../entry/src/main/ets/app/',import.meta.url);
const read=name=>readFileSync(new URL(name,app),'utf8');
const policy=stripTypeScriptTypes(read('HttpTransportPolicy.ts')).replace(/^export /gm,'');
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
function setup(){
 const clock=new Clock();let generation=0;let cookies=[];const reconciled=[],clears=[],seeds=[],scripts=[];
 const store={instance:{sessionGeneration:()=>generation,arkWebSeeds:async profile=>[{url:base,header:'sid='+profile}],reconcileArkWebCookies:async(...args)=>{reconciled.push(args);}}};
 const webview={WebviewController:{setHostIP:()=>{},clearHostIP:()=>{}},WebCookieManager:{clearAllCookiesSync:()=>{clears.push(true);cookies=[];},configCookieSync:(_url,header)=>{seeds.push(header);cookies.push({name:'sid',value:header.split('=')[1],domain:'93.184.216.34',path:'/',isSecure:true,isHttpOnly:true,samesitePolicy:0,isSessionCookie:true});},fetchAllCookies:async()=>cookies},WebHttpCookieSameSitePolicy:{STRICT:1,LAX:2,NONE:3}};
 const Executor=new Function('connection','webview','CookieSessionStore','setTimeout','clearTimeout','Date',policy+production+';return ArkWebExecutor;')({},webview,store,clock.set,clock.clear,{now:()=>clock.now});
 const e=new Executor();let onLoad=()=>{};let evaluate;
 const controller={url:'about:blank',stopCount:0,loadUrl(url){this.url=url;if(url!=='about:blank')onLoad(url);},loadData(_body,_mime,_encoding,url){this.url=url;onLoad(url);},getUrl(){return this.url;},getTitle(){return 'Reader fixture';},stop(){this.stopCount++;},async runJavaScript(script){scripts.push(script);if(evaluate)return evaluate(script);return JSON.stringify(new Function('return ('+script+')')());}};
 e.attachController(controller);
 return {e,clock,controller,scripts,seeds,clears,reconciled,setLoad:fn=>{onLoad=fn;},setEvaluate:fn=>{evaluate=fn;},invalidate:()=>{generation++;}};
}
function params(extra={}){return {document:{kind:'url',url:base+'/page'},javaScript:'null',resourceUrlMatcherJavaScript:matcher,timeoutMillis:2000,...extra};}
function clean(s){assert.equal(s.e.jobs.size,0);assert.equal(s.e.active,undefined);assert.equal(s.clock.timers.size,0,'all deadline/init timers cleared');}
{
 const s=setup();let observerCalls=0;s.e.attachDiagnosticObserver(()=>{observerCalls++;throw new Error('observer must not affect selection');});s.setLoad(()=>{s.e.onResourceLoad(base+'/style.css');s.e.onResourceLoad(base+'/first.m3u8');s.e.onResourceLoad(base+'/second.m3u8');});
 const result=await s.e.execute(params(),1);assert.equal(result.value,base+'/first.m3u8');assert.equal(result.resourceUrl,result.value);assert.equal(result.finalUrl,base+'/page');assert.equal(s.clock.now,1000,'before page-ready, no 500 ms settle wait');assert.equal(s.scripts.length,2);assert.ok(observerCalls>0);clean(s);
 console.log('PASS actual resource callbacks: first full match before page-ready, no timeline or refetch');
}
{
 const s=setup();let release;let first=true;s.setEvaluate(async script=>{if(first){first=false;await new Promise(resolve=>{release=resolve;});}return JSON.stringify(new Function('return ('+script+')')());});
 s.setLoad(()=>{s.e.onResourceLoad(base+'/first.m3u8');s.e.onResourceLoad(base+'/second.m3u8');});
 const pending=s.e.execute(params(),2);await ticks();assert.equal(s.scripts.length,1);release();const result=await pending;assert.equal(result.value,base+'/first.m3u8');clean(s);
 console.log('PASS serialized matching preserves callback order across delayed evaluations');
}
{
 const s=setup();let initializations=0;s.setEvaluate(async script=>{if(script==='INITIALIZE'){initializations++;s.e.onResourceLoad(base+'/after-init.m3u8');return 'null';}return JSON.stringify(new Function('return ('+script+')')());});
 s.setLoad(()=>{s.e.onPageEnd(base+'/page');s.e.onPageEnd(base+'/page');});const pending=s.e.execute(params({javaScript:'INITIALIZE'}),3);await ticks();await s.clock.advance(500);const result=await pending;assert.equal(result.value,base+'/after-init.m3u8');assert.equal(initializations,1);clean(s);
 console.log('PASS source initialization runs once and its real resource event completes capture');
}
{
 const s=setup();s.setLoad(()=>{s.e.onResourceLoad(base+'/first.m3u8');for(let i=0;i<200;i++)s.e.onResourceLoad(base+'/noise-'+i);});
 const result=await s.e.execute(params(),4);assert.equal(result.value,base+'/first.m3u8');assert.equal(s.scripts.length,1);clean(s);
 console.log('PASS an earlier admitted match wins over a later resource-budget terminal marker');
}
for(const failure of ['timeout','cancel','detach','cookie-generation','network','budget','invalid-matcher']){
 const s=setup();let release;s.setEvaluate(async script=>{if(failure==='cancel'||failure==='detach'){await new Promise(resolve=>{release=resolve;});}if(failure==='invalid-matcher')return '"not boolean"';return JSON.stringify(new Function('return ('+script+')')());});
 const pending=s.e.execute(params({timeoutMillis:50,profileId:failure==='cookie-generation'?'source':undefined}),10);
 const rejected=assert.rejects(pending,error=>error!==undefined);await ticks();
 if(failure==='timeout'){s.e.onResourceLoad(base+'/unmatched');await s.clock.advance(50);}
 if(failure==='cancel'){s.e.onResourceLoad(base+'/match.m3u8');await ticks();s.e.cancel(10);}
 if(failure==='detach'){s.e.onResourceLoad(base+'/match.m3u8');await ticks();s.e.detachController(s.controller);}
 if(failure==='cookie-generation'){s.invalidate();s.e.onResourceLoad(base+'/match.m3u8');}
 if(failure==='network')s.e.onResourceLoad('https://other.example/secret.m3u8');
 if(failure==='budget')for(let i=0;i<129;i++)s.e.onResourceLoad(base+'/unmatched-'+i);
 if(failure==='invalid-matcher')s.e.onResourceLoad(base+'/match.m3u8');
 await rejected;release?.();await ticks();s.e.onResourceLoad(base+'/late.m3u8');await ticks();clean(s);assert.equal(s.reconciled.length,0);
 console.log('PASS terminal cleanup and late callback suppression: '+failure);
}
{
 const s=setup();s.setLoad(()=>s.e.onResourceLoad(base+'/match.m3u8'));
 await s.e.execute(params({profileId:'one'}),20);await s.e.execute(params({profileId:'two'}),21);
 assert.deepEqual(s.seeds,['sid=one','sid=two']);assert.equal(s.clears.length,4);assert.deepEqual(s.reconciled.map(args=>args[0]),['one','two']);assert.deepEqual(s.reconciled.map(args=>args[2][0].value),['one','two']);clean(s);
 console.log('PASS source profiles retain isolated cookie hydration/capture and generation');
}
{
 const s=setup();s.setLoad(()=>s.e.onResourceLoad(base+'/html.m3u8'));const result=await s.e.execute(params({document:{kind:'html',body:'<html/>',baseUrl:base+'/post-result'}}),30);assert.equal(result.value,base+'/html.m3u8');clean(s);
 assert.throws(()=>s.e.execute(params({resourceUrlMatcherJavaScript:''}),31));
 assert.throws(()=>s.e.execute(params({resourceUrlMatcherJavaScript:'x'.repeat(65537)}),32));
 assert.match(read('ArkWebExecutionHost.ets'),/\.onResourceLoad\([\s\S]*?onResourceLoad\(event\.url\)/);
 assert.ok(!read('ArkWebExecutor.ts').includes("performance.getEntriesByType"));
 console.log('PASS POST HTML capture, bounded matcher admission and production callback wiring');
}
for(const failure of ['matcher-reject','matcher-sync-throw','initialization-reject','load-throw']){
 const s=setup();
 if(failure==='matcher-reject')s.setEvaluate(async()=>{throw new Error('synthetic matcher error');});
 if(failure==='matcher-sync-throw')s.controller.runJavaScript=()=>{throw new Error('synthetic synchronous controller error');};
 if(failure==='initialization-reject'){s.setEvaluate(async()=>{throw new Error('synthetic initialization error');});s.setLoad(()=>s.e.onPageEnd(base+'/page'));}
 else if(failure==='load-throw')s.setLoad(()=>{throw new Error('synthetic load error');});
 else s.setLoad(()=>s.e.onResourceLoad(base+'/match.m3u8'));
 const pending=s.e.execute(params({javaScript:'INITIALIZE'}),40);
 const rejected=assert.rejects(pending,error=>failure==='load-throw'?error.message==='synthetic load error':
   error.code==='SCRIPT_EXECUTION_FAILED'&&error.details.reason===(failure==='initialization-reject'?'RESOURCE_INITIALIZATION_FAILED':'RESOURCE_MATCHER_EXECUTION_FAILED'));
 await ticks();if(failure==='initialization-reject')await s.clock.advance(500);await rejected;clean(s);
 console.log('PASS execution failure is terminal with bounded cleanup: '+failure);
}
{
 const s=setup();let release;let first=true;
 s.setEvaluate(async script=>{if(first){first=false;await new Promise(resolve=>{release=resolve;});}return JSON.stringify(new Function('return ('+script+')')());});
 const old=s.e.execute(params({profileId:'one'}),50);const rejected=assert.rejects(old);await ticks();s.e.onResourceLoad(base+'/old.m3u8');await ticks();s.e.cancel(50);await rejected;
 const current=s.e.execute(params({profileId:'two'}),51);await ticks();release();await ticks();assert.equal(s.e.active?.requestId,51,'late old matcher completion cannot finish the next job');
 s.e.onResourceLoad(base+'/new.m3u8');assert.equal((await current).value,base+'/new.m3u8');assert.deepEqual(s.reconciled.map(args=>args[0]),['two']);clean(s);
 console.log('PASS late asynchronous matcher completion cannot publish into the next source profile');
}
{
 const s=setup();const resource=base+'/quoted.m3u8?q=";throw new Error(\'injected\');//';
 s.setLoad(()=>s.e.onResourceLoad(resource));assert.equal((await s.e.execute(params(),60)).value,resource);clean(s);
 console.log('PASS quotes and executable-looking text in observed URLs remain JSON-encoded data');
}
console.log('PH76 Host production-path resource capture: 19 scenarios passed; VM/platform callback behavior remains unverified');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const app=new URL('../entry/src/main/ets/app/',import.meta.url);
const read=name=>readFileSync(new URL(name,app),'utf8');
const policy=stripTypeScriptTypes(read('HttpTransportPolicy.ts')).replace(/^export /gm,'');
const redact=new Function(policy+';return redactedHttpUrl;')();
const routePolicy=stripTypeScriptTypes(read('NetworkRoutePolicy.ts').replace(/^import[\s\S]*?;\n/gm,'')).replace(/^export /gm,'');
const executor=stripTypeScriptTypes(read('ArkWebExecutor.ts').replace(/^import[\s\S]*?;\n/gm,'')).replace('export class','class');
let generation=0;let fetchCookies=async()=>[];let reconciled;
let dns=async()=>[{address:'93.184.216.34'}];const pins=[];
const Executor=new Function('connection','webview','CookieSessionStore',policy+routePolicy+executor+';return ArkWebExecutor;')({getDefaultHttpProxy:async()=>({host:'',port:0,exclusionList:[]}),getPacUrl:()=>'',getPacFileUrl:()=>'',getAddressesByName:host=>dns(host)}, {WebviewController:{setHostIP:(...args)=>pins.push(args)},WebCookieManager:{fetchAllCookies:()=>fetchCookies()},WebHttpCookieSameSitePolicy:{STRICT:1,LAX:2,NONE:3}}, {instance:{sessionGeneration:()=>generation,reconcileArkWebCookies:async(...args)=>{reconciled=args;}}});
const e=new Executor();
const surface={id:1,requestId:1,controller:{stop(){}}};
const job={requestId:1,surface,deadlineAt:Date.now()+10000,cancelled:false};
e.surfaceLease={surface,attached:true,retired:false};e.active=job;
for(const address of ['http://127.0.0.1','https://10.1.2.3','http://[::1]','file:///tmp/file','http://2130706433']) assert.equal(e.blockNetworkUrl(address,surface),true);
assert.equal(e.blockNetworkUrl('https://public.example/page',surface),true,'an unadmitted host is fail-closed');
assert.equal(e.blockNetworkUrl('data:text/plain,hello',surface),false);
job.networkDenied=false;
await e.pinDocumentTarget(job,'https://public.example/page');e.active=job;
assert.equal(job.pinnedHost,'public.example');assert.deepEqual(pins[0].slice(0,2),['public.example','93.184.216.34']);
assert.equal(e.blockNetworkUrl('https://public.example/script.js',surface),false,'same pinned host is admitted');
assert.equal(e.blockNetworkUrl('https://cdn.public.example/script.js',surface),true,'cross-host resources require a separate job');
assert.equal(e.blockNetworkUrl('https://other.example/redirect',surface),true,'cross-host redirects cannot escape the DNS pin');
assert.equal(redact('https://user:secret@public.example:8443/private?token=x#code'),
  'https://public.example/…');
dns=async()=>[{address:'192.168.1.1'}];await assert.rejects(e.pinDocumentTarget({deadlineAt:Date.now()+10000,cancelled:false},'https://private-alias.example/'));
dns=()=>new Promise(()=>{});const cancelled={requestId:99,deadlineAt:Date.now()+10000,cancelled:false};e.jobs.set(99,cancelled);const pending=e.pinDocumentTarget(cancelled,'https://pending.example');e.cancel(99);await assert.rejects(pending);e.jobs.delete(99);
console.log('PASS: ArkWeb document DNS pin plus same-host navigation/resource enforcement');

// Queue admission binds the current login generation; clearing invalidates the job.
const oldJob=e.parseJob({document:{kind:'url',url:'https://public.example/'},javaScript:'document.title',profileId:'session'},9);
assert.equal(oldJob.cookieGeneration,0);generation++;
assert.throws(()=>e.assertCurrent(oldJob));assert.equal(oldJob.cancelled,true);
// Cookie capture can also cross an await after assertCurrent. Preserve its admitted generation.
let completeFetch;fetchCookies=()=>new Promise(resolve=>{completeFetch=resolve;});
const capture=e.captureCookies('session',[],0,'public.example');generation++;completeFetch([]);await capture;
assert.equal(reconciled[3],0);
console.log('PASS: ArkWeb queue and cookie capture retain their admitted session generation');

// A WebView can report a Domain cookie for a parent host. The source session
// must retain only the exact DNS-pinned host, otherwise a later HTTP request
// to that parent could receive credentials captured from this login page.
fetchCookies=async()=>[
  {name:'sid',value:'exact',domain:'public.example',path:'/',isSecure:true,isHttpOnly:true,samesitePolicy:0,isSessionCookie:false,expiresDate:''},
  {name:'sid',value:'parent',domain:'.example',path:'/',isSecure:true,isHttpOnly:true,samesitePolicy:0,isSessionCookie:false,expiresDate:''},
];
await e.captureCookies('session',[],0,'public.example');
assert.equal(reconciled[2].length,1);
assert.equal(reconciled[2][0].domain,'public.example');
console.log('PASS: ArkWeb cookie capture keeps exact admitted host scope');

const hostSource=read('ArkWebExecutionHost.ets');
assert.match(hostSource,/this\.currentUrl = redactedHttpUrl\(pageUrl\)/,
  'interactive chrome must never render a raw page URL');
assert.match(read('ArkWebExecutor.ts'),/finalUrl: job\.finalUrl === undefined \? '' : redactedHttpUrl\(job\.finalUrl\)/,
  'timeout evidence must contain only the redacted URL projection');

import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
const app = new URL('../entry/src/main/ets/app/', import.meta.url);
const common = `const hilog={warn(){},error(){},info(){}}; const errorMessageOf=e=>e instanceof Error?e.message:String(e);const url={URL:{parseURL:(s,b)=>new URL(s,b)}};const util={TextEncoder:globalThis.TextEncoder,TextDecoder:{create:(label,options)=>({decodeToString:bytes=>new TextDecoder(label,options).decode(bytes)})}};`;
async function load(name, extra='') {
  const source=readFileSync(new URL(name,app),'utf8').replace(/^import[\s\S]*?;\n/gm,'');
  return import('data:text/javascript;base64,'+Buffer.from(common+extra+stripTypeScriptTypes(source)).toString('base64'));
}
const cookiePolicy=stripTypeScriptTypes(readFileSync(new URL('CookieSecurityPolicy.ts',app),'utf8')).replace(/^export /gm,'');
const { CookieSessionStore }=await load('CookieSessionStore.ts',cookiePolicy);
function attach(map, fault={}) {
  const jar=new CookieSessionStore(); let writes=0;
  jar.readRecordSecret=async key=>map.get(key)??null;
  jar.writeRecord=async(key,value)=>{
    writes++;
    if(fault.header && key==='reader.cookie.sessions.v1') throw Error('header fault');
    if(writes===fault.at && !fault.after) throw Error('write fault');
    map.set(key,Uint8Array.from(value));
    if(writes===fault.at && fault.after) throw Error('uncertain write fault');
  };
  jar.removeRecord=async key=>{if(fault.remove) throw Error('cleanup fault');map.delete(key);};
  return jar;
}
const cookie=value=>({sessionId:'audit-session',name:'sid',value,domain:'example.test',path:'/',expiresAtMs:Date.now()+1000000,secure:true,httpOnly:true,sameSite:null,hostOnly:true,createdAt:1});
const baseline=new Map();const original=attach(baseline);await original.ensureLoaded();original.cookies.push(cookie('A'.repeat(2400)));await original.persist();
for(const after of [false,true]) for(let at=1;at<=9;at++) {
  const map=new Map(baseline), jar=attach(map,{at,after});await jar.ensureLoaded();jar.cookies[0].value='B'.repeat(2400);
  let succeeded=true;try{await jar.schedulePersist(true);}catch{succeeded=false;}
  const fresh=attach(map);await fresh.ensureLoaded();
  const value=fresh.cookies[0]?.value;
  assert.ok(value==='A'.repeat(2400)||value==='B'.repeat(2400),`torn generation at ${at}/${after}`);
  if(succeeded) assert.equal(value,'B'.repeat(2400));
}
{
  const map=new Map(baseline),jar=attach(map,{remove:true});await jar.ensureLoaded();
  await jar.clearSession('audit-session');
  const fresh=attach(map,{remove:true});assert.equal(await fresh.cookieHeader('audit-session','https://example.test/'),'');
}
{
  const map=new Map(baseline),jar=attach(map,{header:true});await jar.ensureLoaded();
  await assert.rejects(jar.clearSession('audit-session'));
  const fresh=attach(map);assert.ok((await fresh.cookieHeader('audit-session','https://example.test/')).includes('A'));
}
{
  const payload=new TextEncoder().encode(JSON.stringify({formatVersion:1,cookies:[cookie('legacy')]}));
  const map=new Map([['reader.cookie.sessions.v1',new TextEncoder().encode(JSON.stringify({formatVersion:1,chunkCount:1}))],['reader.cookie.sessions.v1#0',payload]]);
  const jar=attach(map);assert.equal(await jar.cookieHeader('audit-session','https://example.test/'),'sid=legacy');await jar.persist();
  assert.equal(map.has('reader.cookie.sessions.v1#0'),false);
  assert.equal(await attach(map).cookieHeader('audit-session','https://example.test/'),'sid=legacy');
}
// A response admitted before clearing a session must never resurrect it.
{
  const map=new Map(baseline),jar=attach(map);await jar.ensureLoaded();
  const oldGeneration=jar.sessionGeneration('audit-session');
  const seeds=await jar.arkWebSeeds('audit-session');
  await jar.clearSession('audit-session');
  assert.deepEqual(await jar.storeResponseCookies('audit-session','https://example.test/',
    ['sid=stale; Max-Age=3600; Secure'],oldGeneration),[]);
  await jar.reconcileArkWebCookies('audit-session',seeds,[{name:'sid',value:'stale-web',domain:'example.test',path:'/',
    expiresAt:new Date(Date.now()+3600000).toISOString(),secure:true,httpOnly:true,hostOnly:true}],oldGeneration);
  assert.equal(await jar.cookieHeader('audit-session','https://example.test/'),'');
  assert.equal(await attach(map).cookieHeader('audit-session','https://example.test/'),'');
  // New explicit login after clearing remains possible.
  await jar.storeResponseCookies('audit-session','https://example.test/',
    ['sid=fresh; Max-Age=3600; Secure'],jar.sessionGeneration('audit-session'));
  await jar.writeTail;
  assert.equal(await attach(map).cookieHeader('audit-session','https://example.test/'),'sid=fresh');
}
// Secure cookies must not be planted by a cleartext origin, and script values
// must not be able to inject control bytes into a later Cookie header.
{
 const jar=attach(new Map());await jar.ensureLoaded();
 assert.deepEqual(await jar.storeResponseCookies('http-session','http://example.test/',
   ['sid=cleartext; Max-Age=3600; Secure']),[]);
 await assert.rejects(jar.setCapability({sessionId:'script-session',url:'http://example.test/',
   cookie:{name:'sid',value:'x',secure:true}}),/Secure cookies from non-HTTPS/);
 await assert.rejects(jar.setCapability({sessionId:'script-session',url:'https://example.test/',
   cookie:{name:'sid',value:'ok\r\nInjected'}}),/cookie value is invalid/);
 assert.equal(await jar.cookieHeader('http-session','https://example.test/'),'');
}
// Session cookies are bounded too: they never reach the durable 4096/512 KiB
// quota, so exercise both the per-session count and byte limits directly.
{
 const jar=attach(new Map());await jar.ensureLoaded();
 for(let index=0;index<256;index++) {
   await jar.setCapability({sessionId:'quota-session',url:'https://example.test/',
     cookie:{name:`c${index}`,value:'v'}});
 }
 await assert.rejects(jar.setCapability({sessionId:'quota-session',url:'https://example.test/',
   cookie:{name:'overflow',value:'v'}}),/quota exceeded/);
 const bytesJar=attach(new Map());await bytesJar.ensureLoaded();
 for(let index=0;index<15;index++) {
   await bytesJar.setCapability({sessionId:'bytes-session',url:'https://example.test/',
     cookie:{name:`b${index}`,value:'x'.repeat(4096)}});
 }
 await assert.rejects(bytesJar.setCapability({sessionId:'bytes-session',url:'https://example.test/',
   cookie:{name:'b-overflow',value:'x'.repeat(4096)}}),/quota exceeded/);
}
globalThis.auditCookieStore=CookieSessionStore;
let endDns;globalThis.auditDns={getDefaultHttpProxy:async()=>({host:'',port:0,exclusionList:[]}),getPacUrl:()=>'',getPacFileUrl:()=>'',getAddressesByName:()=>new Promise((_,reject)=>{endDns=reject;})};
const policy=stripTypeScriptTypes(readFileSync(new URL('HttpTransportPolicy.ts',app),'utf8')).replace(/^export /gm,'');
const routePolicy=stripTypeScriptTypes(readFileSync(new URL('NetworkRoutePolicy.ts',app),'utf8').replace(/^import[\s\S]*?;\n/gm,'')).replace(/^export /gm,'');
const {HttpExecuteHost}=await load('HttpExecuteHost.ts',`const http={InterceptorType:{REDIRECTION:1},RequestMethod:{GET:'GET',POST:'POST',HEAD:'HEAD',PUT:'PUT',DELETE:'DELETE',PATCH:'PATCH',OPTIONS:'OPTIONS',TRACE:'TRACE',CONNECT:'CONNECT'}};const connection=globalThis.auditDns;const CookieSessionStore=globalThis.auditCookieStore;${policy}${routePolicy}`);
{
  const host=new HttpExecuteHost();let probes=0;
  await assert.rejects(host.execute({url:'https://example.test',method:'GET'},42,()=>{probes++;return true;}));
  assert.ok(probes>0);assert.equal(host.activeByRequestId.size,0);
}
{
  const host=new HttpExecuteHost();let cancelled=false;
  const pending=host.execute({url:'https://example.test',method:'GET'},43,()=>cancelled);
  await new Promise(resolve=>setTimeout(resolve,10));cancelled=true;
  await assert.rejects(pending);
  assert.equal(host.activeByRequestId.size,0);
  endDns(Error('release synthetic DNS'));await new Promise(resolve=>setTimeout(resolve,0));
}
console.log('PASS: 18 interrupted writes, durable clears, legacy migration and DNS cancellation');
// Two requests to one hostname must keep the validated pin until the first
// transport finishes. No request may observe a gap or inherit an unvetted IP.
{
 let releaseFirst;const firstDone=new Promise(resolve=>{releaseFirst=resolve;});
 const activePins=new Map();let starts=0;const seen=[];
 Object.assign(globalThis.auditDns,{
  getAddressesByName:async()=>[{address:'93.184.216.34'}],
  addCustomDnsRule:async(host,ips)=>{activePins.set(host,ips);seen.push('pin');},
  removeCustomDnsRule:async host=>{activePins.delete(host);seen.push('unpin');},
 });
 const host=new HttpExecuteHost();
 host.singleHopTransport=async()=>{starts++;assert.deepEqual(activePins.get('example.test'),['93.184.216.34']);if(starts===1)await firstDone;return {};};
 const deadline=()=>({deadlineAt:Date.now()+10000,cancelled:false,activeRequest:null,expired:new Promise(()=>{})});
 const request=()=>host.singleHop('https://example.test/',{wireMethod:'GET',enumMethod:'GET'}, {},{kind:'none'},undefined,deadline());
 const a=request(),b=request();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(starts,1);
 releaseFirst();await Promise.all([a,b]);assert.deepEqual(seen,['pin','unpin','pin','unpin']);assert.equal(HttpExecuteHost.targetTails.size,0);
 globalThis.auditDns.getAddressesByName=async()=>[{address:'127.0.0.1'}];
 await assert.rejects(request());assert.equal(starts,2);assert.equal(HttpExecuteHost.targetTails.size,0);
}
console.log('PASS: DNS pins serialize concurrent leases and reject rebound private addresses');

// Exercise the real HTTP admission and redirect response path with an in-flight clear.
{
 const map=new Map(baseline),jar=attach(map);CookieSessionStore.instance=jar;
 const host=new HttpExecuteHost();let releaseResponse;let started;
 const transportStarted=new Promise(resolve=>{started=resolve;});
 host.rejectPrivateNetworkUrl=()=>['93.184.216.34'];
 host.singleHop=async()=>{started();await new Promise(resolve=>{releaseResponse=resolve;});
   return {status:200,headers:{'content-type':'text/plain'},rawHeaders:{'set-cookie':['sid=late; Max-Age=3600; Secure']},bytes:new TextEncoder().encode('ok')};};
 const pending=host.execute({url:'https://example.test/',session:{id:'audit-session'}},44);
 await transportStarted;await jar.clearSession('audit-session');releaseResponse();await pending;await jar.writeTail;
 assert.equal(await attach(map).cookieHeader('audit-session','https://example.test/'),'');
}
console.log('PASS: clearing a session invalidates late HTTP/WebView cookies and allows a fresh login');

// Per-request HTTPS policy must survive the shared redirect chain. TTS starts
// from a validated HTTPS URL, but a provider-controlled Location must not
// downgrade the follow-up hop to cleartext.
{
 const host = new HttpExecuteHost();
 await assert.rejects(() => host.execute({url: 'https://example.test/start', httpsOnly: 'yes'}),
   /httpsOnly must be a boolean/);
 let hops = 0;
 host.rejectPrivateNetworkUrl = () => ['93.184.216.34'];
 host.singleHop = async () => {
   hops += 1;
   return {status: 302, headers: {Location: 'http://example.test/final'}, rawHeaders: {}, bytes: new Uint8Array(0)};
 };
 await assert.rejects(
   host.execute({url: 'https://example.test/start', followRedirects: true, maxRedirects: 1, httpsOnly: true}),
   /HTTPS is required for this request and its redirects/,
 );
 assert.equal(hops, 1, 'cleartext redirect must be rejected before the second hop');
}
console.log('PASS: HTTPS-only requests reject cleartext redirect downgrades');

// URL-credential requests add a stricter origin boundary: even an HTTPS
// redirect must not move the query secret to another host or effective port.
{
 const host = new HttpExecuteHost();
 let hops = 0;
 host.rejectPrivateNetworkUrl = () => ['93.184.216.34'];
 host.singleHop = async () => {
   hops += 1;
   if (hops === 1) {
     return {status: 302, headers: {Location: 'https://EXAMPLE.test:443/final'}, rawHeaders: {}, bytes: new Uint8Array(0)};
   }
   return {status: 204, headers: {}, rawHeaders: {}, bytes: new Uint8Array(0)};
 };
 const response = await host.execute({url: 'https://example.test/start?token=opaque', followRedirects: true,
   maxRedirects: 1, httpsOnly: true, sameOriginRedirectsOnly: true});
 assert.equal(response.status, 204, 'default HTTPS port and host case are the same effective origin');
 assert.equal(hops, 2);
}
console.log('PASS: same-origin comparison normalizes host case and default HTTPS port');

for (const location of [
  'https://other.example.test/final',
  'https://example.test:8443/final',
]) {
 const host = new HttpExecuteHost();
 let hops = 0;
 host.rejectPrivateNetworkUrl = () => ['93.184.216.34'];
 host.singleHop = async () => {
   hops += 1;
   return {status: 302, headers: {Location: location}, rawHeaders: {}, bytes: new Uint8Array(0)};
 };
 await assert.rejects(
   host.execute({url: 'https://example.test/start?token=opaque', followRedirects: true,
     maxRedirects: 1, httpsOnly: true, sameOriginRedirectsOnly: true}),
   /cross-origin redirect is not allowed/,
 );
 assert.equal(hops, 1, `credential URL redirect must stop before ${location}`);
}
console.log('PASS: credential-bearing URL redirects stay on the same effective origin');

// A custom credential header (for example X-API-Key) is not recognizable by
// the generic sensitive-header table. The Host opts it into the same policy;
// both a host change and an effective-port change must stop before hop two.
for (const location of [
  'https://other.example.test/final',
  'https://example.test:8443/final',
]) {
 const host = new HttpExecuteHost();
 let hops = 0;
 host.rejectPrivateNetworkUrl = () => ['93.184.216.34'];
 host.singleHop = async () => {
   hops += 1;
   return {status: 302, headers: {Location: location}, rawHeaders: {}, bytes: new Uint8Array(0)};
 };
 await assert.rejects(
   host.execute({url: 'https://example.test/start', headers: {'X-API-Key': 'opaque'},
     followRedirects: true, maxRedirects: 1, httpsOnly: true, sameOriginRedirectsOnly: true}),
   /cross-origin redirect is not allowed/,
 );
 assert.equal(hops, 1, `custom credential header redirect must stop before ${location}`);
}
console.log('PASS: custom credential-header redirects stay on the same effective origin');

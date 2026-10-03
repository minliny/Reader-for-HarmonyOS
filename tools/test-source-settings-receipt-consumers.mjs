import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const ordinary=s=>stripTypeScriptTypes(s.replace(/^export type \{[^\n]+from [^\n]+\n/gm,'').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const load=(p,n,deps={})=>new Function(...Object.keys(deps),ordinary(source(p))+`;return ${n};`)(...Object.values(deps));
const facts=load('app/ReaderOperationFacts.ts','{projectOperationFacts,projectCommitReadback}');
const projectPersistedReceipt=load('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
const ReaderWriteEvidence=load('app/ReaderWriteEvidence.ts','ReaderWriteEvidence'),readerRecoveryView=load('app/ReaderRecoveryProjection.ts','readerRecoveryView');
let currentOwner;const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
const helpers={...load('app/ErrorMessage.ts','{errorMessageOf}'),...load('app/HttpTransportPolicy.ts','{httpUrlHostname,isPrivateNetworkTarget}'),...load('features/source/ReaderSourceCategory.ts','{classifyReaderSource}')};
const typed=e=>e.typedAdmission===true;
const SourceGateway=load('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner,isReaderCoreTransactionPendingError:typed,...helpers});
const SourceOrchestrator=load('features/source/SourceOrchestrator.ets','SourceOrchestrator',{SourceGateway,ReaderRuntimeOwner,ReaderWriteEvidence,isReaderCoreTransactionPendingError:typed,hilog:{error(){},warn(){},info(){}},projectPersistedReceipt,...facts,...helpers});
const SourceHost=load('features/source/SourceHost.ets','SourceHost',{ReaderRuntimeOwner,SourceOrchestrator,SourceGateway});
const prefs=new WeakMap();const preferences={getPreferences:async ctx=>prefs.get(ctx)};
const SettingsGateway=load('features/settings/SettingsGateway.ts','SettingsGateway',{preferences,ReaderThemeHost:{async prepareUserChange(){}}});
const SettingsOrchestrator=load('features/settings/SettingsOrchestrator.ets','SettingsOrchestrator',{SettingsGateway,ReaderRuntimeOwner,ReaderWriteEvidence,LocalConfigurationReset:{request(){throw Error('reset tested by full durable reset suite');}},hilog:{error(){}},projectPersistedReceipt,...facts});
const SettingsHost=load('features/settings/SettingsHost.ets','SettingsHost',{SettingsOrchestrator,ReaderRuntimeOwner});
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader',syntax=require(sdk+'/lib/validate_ui_syntax.js');
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
for(const [name,path] of [['SourceManagementPage','features/source/SourceManagementPage.ets'],['SettingsPage','features/settings/SettingsPage.ets'],['ReaderRecoveryAction','features/common/ReaderRecoveryAction.ets']]){syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...source(path).matchAll(/@Prop\s+(?:@Watch\([^\n]+?\)\s+)?(\w+)\s*:/g)].map(m=>m[1])));}
const clone=v=>v===undefined?undefined:structuredClone(v),tick=()=>new Promise(r=>setImmediate(r));
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
const row=()=>({sourceId:'a',name:'A',baseUrl:'https://a.test',enabled:true,enabledExplore:false,bookSource:{bookSourceType:0}});
function rpc(){const context={},disk=new Map(Object.entries({autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:false,crashLog:true}));const r={context,disk,calls:[],rows:[row()],readFail:0,writeFail:false,admission:false,malformed:false,pause:undefined,puts:0,flushes:0,getUIAbilityContext:()=>context,supportsCoreCapability:()=>false,
 async clearSourceCookieSession(){},async request(method,params){this.calls.push(method);if(this.pause?.method===method)await this.pause.promise;
 if(method==='runtime.status')return{data:{pendingHostOperationCount:0}};
 if(method==='source.update'){if(this.admission){this.admission=false;throw Object.assign(Error('gate'),{typedAdmission:true});}this.rows[0].enabled=params.enabled;if(this.writeFail){this.writeFail=false;throw Error('ack lost');}return{data:{source:clone(this.rows[0])}};}
 if(method==='source.list'){if(this.readFail){this.readFail--;throw Error('read unavailable');}return{data:{sources:this.malformed?[{sourceId:'a'}]:clone(this.rows)}};}
 throw Error(method);
 },count(m){return this.calls.filter(x=>x===m).length;}};
 const cache=new Map(disk);prefs.set(context,{async get(k,d){if(r.pause?.method==='get')await r.pause.promise;if(r.readFail){r.readFail--;throw Error('read unavailable');}return r.malformed&&k==='reduceMotion'?'bad':cache.get(k)??d;},async put(k,v){r.puts++;cache.set(k,v);},async flush(){r.flushes++;if(r.pause?.method==='flush')await r.pause.promise;if(r.writeFail){r.writeFail=false;throw Error('flush unknown');}disk.clear();for(const [k,v] of cache)disk.set(k,v);}});return r;}
// Execute the production Index field initializer: the actual callbacks write
// Index @State, then actual SDK child props carry those facts to the page.
function field(index,name,deps){const text=source('pages/Index.ets'),a=text.indexOf('  private '+name+':'),b=text.indexOf('\n  );',a)+6,initializer=text.slice(a,b);const expression=initializer.slice(initializer.indexOf('=')+1).trim().replace(/;$/,'');return new Function(...Object.keys(deps),stripTypeScriptTypes('const value='+expression+';')+'return value;').call(index,...Object.values(deps));}
function fixture(kind){const r=rpc();currentOwner=r;const sourceDomain=kind==='source',method=sourceDomain?'sourceManagementContent':'settingsContent';const index=createReaderBuilderProbe(source('pages/Index.ets'),[method],{SourceManagementPage:Child,SettingsPage:Child,deviceInfo:{deviceType:'phone'}}).owner;
 Object.assign(index,{route:sourceDomain?'source':'settings',sourceSources:[],sourceStatusKind:'idle',sourceStatusMessage:'',sourceOperation:{action:'load',sourceId:''},settingsOperation:{action:'load'},settingsSnapshot:{autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:false,crashLog:true},settingsSection:'general'});
 const host=field(index,sourceDomain?'sourceHost':'settingsHost',{SourceHost,SettingsHost});index[sourceDomain?'sourceHost':'settingsHost']=host;
 const refresh=()=>{index[method]();return [...index.children.values()][0].params;};
 function page(){const params=refresh(),path=sourceDomain?'features/source/SourceManagementPage.ets':'features/settings/SettingsPage.ets';const page=createReaderBuilderProbe(source(path),sourceDomain?['statusBanner','recovery']:['operationFeedback','recovery'],{readerRecoveryView,ReaderRecoveryAction:Child}).owner;Object.assign(page,params,{appThemeScheme:'day',resetMessage:'',contentFrame:()=>({width:350})});page[sourceDomain?'statusBanner':'operationFeedback']();return page;}
 return{r,index,host,refresh,page,write:()=>sourceDomain?host.toggleSource('a',false):host.toggle('reduceMotion',true),settle:async()=>{await tick();if(sourceDomain)await host.orchestrator.operationChain;else for(let i=0;i<5;i++)await tick();},receipt:()=>index[sourceDomain?'sourceOperation':'settingsOperation'],read:()=>index[sourceDomain?'sourceOperation':'settingsOperation'].readFacts,retry:page=>{if(sourceDomain)[...page.nodes.values()].find(n=>n.create==='重试').onClick();else{const c=[...page.children.values()][0];c.params.onReconcile(c.params.generation);}}};}
for(const kind of ['source','settings']){
 const command=kind==='source'?'source.update':undefined;
 {
  const f=fixture(kind);f.host.open();await f.settle();if(kind==='source')f.r.readFail=1;else {const original=prefs.get(f.r.context).flush;prefs.get(f.r.context).flush=async()=>{await original();f.r.readFail=1;};}
  f.write();await f.settle();assert.equal(f.receipt().receipt.receipt.fact,'confirmedRefreshFailed');const p=f.page();assert.match(p.recovery().message,/已确认.*刷新失败/);const writes=kind==='source'?f.r.count(command):f.r.flushes;f.retry(p);f.retry(p);await f.settle();assert.equal(kind==='source'?f.r.count(command):f.r.flushes,writes,'read-only retry never replays mutation');assert.equal(f.receipt().receipt.receipt.fact,'confirmedCurrent');
 }
 {
  const f=fixture(kind);f.host.open();await f.settle();f.r.writeFail=true;f.write();await f.settle();assert.equal(f.receipt().receipt.receipt.confirmation,'unknown');if(kind==='settings')assert.equal(f.index.settingsSnapshot.reduceMotion,false,'failed preference flush rolls back optimistic UI to coherent value');const n=kind==='source'?f.r.count(command):f.r.flushes;f.retry(f.page());await f.settle();assert.equal(f.receipt().receipt.receipt.fact,'pendingReconciliation');assert.equal(kind==='source'?f.r.count(command):f.r.flushes,n);
 }
 {
  const f=fixture(kind);f.r.readFail=1;f.host.open();await f.settle();assert.ok(f.read().canRetry);assert.equal(f.receipt().receipt,undefined);f.retry(f.page());await f.settle();assert.equal(f.read().fact,'current');f.r.malformed=true;f.host.open();await f.settle();assert.equal(f.read().fact,'refreshFailed','bad persisted payload keeps canonical state');
 }
 {
  const f=fixture(kind);f.host.open();await f.settle();if(kind==='source')f.r.readFail=1;if(kind==='settings'){const original=prefs.get(f.r.context).flush;prefs.get(f.r.context).flush=async()=>{await original();f.r.readFail=1;};}f.write();await f.settle();const p=f.page(),old=clone(f.receipt());f.host.open();await f.settle();const n=kind==='source'?f.r.calls.length:f.r.puts;f.retry(p);await f.settle();assert.equal(kind==='source'?f.r.calls.length:f.r.puts,n,'reopen invalidates old recovery');currentOwner=rpc();f.write();await f.settle();assert.equal(kind==='source'?f.r.calls.length:f.r.puts,n,'old runtime owner cannot write');
 }
 {
  const f=fixture(kind);f.host.open();await f.settle();const d=defer();f.r.pause={method:kind==='source'?command:'flush',...d};f.write();await tick();const before=clone(f.receipt()),priorRows=clone(f.index.sourceSources);f.index.route='bookshelf';d.resolve();await f.settle();assert.deepEqual(f.receipt(),before,'closed page rejects late receipt publication');if(kind==='source')assert.deepEqual(f.index.sourceSources,priorRows);const n=kind==='source'?f.r.calls.length:f.r.puts;f.write();await f.settle();assert.equal(kind==='source'?f.r.calls.length:f.r.puts,n,'closed UI actions cannot write');f.index.route=kind==='source'?'source':'settings';f.host.open();await f.settle();
 }
}
{
 const f=fixture('source');f.host.open();await f.settle();f.r.admission=true;f.write();await f.settle();assert.equal(f.r.count('source.update'),2,'only typed admission refusal can retry a write');assert.equal(f.receipt().receipt.receipt.confirmation,'confirmed','actual gateway excludes the pre-execution refusal from dispatched writes');
}

for(const kind of ['source','settings']){
 const f=fixture(kind);f.host.open();await f.settle();const d=defer();f.r.pause={method:kind==='source'?'source.update':'flush',...d};f.write();await tick();
 const before=clone(f.receipt());currentOwner=undefined;d.resolve();await f.settle();assert.deepEqual(f.receipt(),before,'late actual ACK has no retired UI/error publication');
 const count=kind==='source'?f.r.calls.length:f.r.puts;assert.throws(()=>f.write(),/must be installed/,'Host hard acquisition remains explicit; retired owner callbacks were already safely rejected');await f.settle();assert.equal(kind==='source'?f.r.calls.length:f.r.puts,count);
 f.r.pause=undefined;currentOwner=f.r;f.host.open();await f.settle();assert.equal(f.read().fact,'current');
 if(kind==='source')assert.equal(f.index.sourceSources[0].enabled,false);else assert.equal(f.index.settingsSnapshot.reduceMotion,true,'persisted setting read survives retired delivery');
}

console.log('Source/Settings actual Gateway -> Index -> SDK consumers: PASS (ACK/read failure/unknown/read-only retry/close/reopen/late/owner/malformed/typed admission).');

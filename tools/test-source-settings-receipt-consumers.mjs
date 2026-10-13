import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
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
function freshSettingsHost(){
const {SettingsGateway,createDefaultSettingsSnapshot}=load('features/settings/SettingsGateway.ts','{SettingsGateway,createDefaultSettingsSnapshot}',{preferences,ReaderThemeHost:{async prepareUserChange(){}}});
const SettingsOrchestrator=load('features/settings/SettingsOrchestrator.ets','SettingsOrchestrator',{SettingsGateway,createDefaultSettingsSnapshot,ReaderRuntimeOwner,ReaderWriteEvidence,LocalConfigurationReset:{request(){throw Error('reset tested by full durable reset suite');}},hilog:{error(){}},projectPersistedReceipt,...facts});
const SettingsHost=load('features/settings/SettingsHost.ets','SettingsHost',{SettingsOrchestrator,ReaderRuntimeOwner});
return SettingsHost;
}
const SettingsHost=freshSettingsHost();
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader',syntax=require(sdk+'/lib/validate_ui_syntax.js');
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
for(const [name,path] of [['SourceManagementPage','features/source/SourceManagementPage.ets'],['SettingsPage','features/settings/SettingsPage.ets'],['ReaderRecoveryAction','features/common/ReaderRecoveryAction.ets']]){syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...source(path).matchAll(/@Prop\s+(?:@Watch\([^\n]+?\)\s+)?(\w+)\s*:/g)].map(m=>m[1])));}
const clone=v=>v===undefined?undefined:structuredClone(v),tick=()=>new Promise(r=>setImmediate(r));
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
const row=()=>({sourceId:'a',name:'A',baseUrl:'https://a.test',enabled:true,enabledExplore:false,bookSource:{bookSourceType:0}});
function rpc(){const context={},disk=new Map(Object.entries({autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:false,crashLog:true,developerMode:false}));const r={context,disk,calls:[],rows:[row()],readFail:0,writeFail:false,admission:false,malformed:false,pause:undefined,puts:0,flushes:0,getUIAbilityContext:()=>context,supportsCoreCapability:()=>false,
 async clearSourceCookieSession(){},async request(method,params,options={}){if(options.canDispatch?.()===false||options.canContinue?.()===false)throw Error('not dispatched');options.onDispatch?.();this.calls.push(method);if(this.pause?.method===method)await this.pause.promise;
 if(method==='runtime.status')return{data:{pendingHostOperationCount:0}};
 if(method==='source.update'){if(this.admission){this.admission=false;throw Object.assign(Error('gate'),{typedAdmission:true});}this.rows[0].enabled=params.enabled;if(this.writeFail){this.writeFail=false;throw Error('ack lost');}return{data:{source:clone(this.rows[0])}};}
 if(method==='source.list'){if(this.readFail){this.readFail--;throw Error('read unavailable');}return{data:{sources:this.malformed?[{sourceId:'a'}]:clone(this.rows)}};}
 throw Error(method);
 },count(m){return this.calls.filter(x=>x===m).length;}};
 const cache=new Map(disk);prefs.set(context,{async get(k,d){if(r.pause?.method==='get')await r.pause.promise;if(r.readFail){r.readFail--;throw Error('read unavailable');}return r.malformed&&k==='reduceMotion'?'bad':cache.get(k)??d;},async put(k,v){r.puts++;cache.set(k,v);},async flush(){r.flushes++;if(r.pause?.method==='flush')await r.pause.promise;const failure=r.writeFail;r.writeFail=false;if(failure&&failure!=='after')throw Error('flush unknown before durable');disk.clear();for(const [k,v] of cache)disk.set(k,v);if(failure==='after')throw Error('flush unknown after durable');}});return r;}
// Execute the production Index field initializer: the actual callbacks write
// Index @State, then actual SDK child props carry those facts to the page.
function field(index,name,deps){const text=source('pages/Index.ets'),a=text.indexOf('  private '+name+':'),b=text.indexOf('\n  );',a)+6,initializer=text.slice(a,b);const expression=initializer.slice(initializer.indexOf('=')+1).trim().replace(/;$/,'');return new Function(...Object.keys(deps),stripTypeScriptTypes('const value='+expression+';')+'return value;').call(index,...Object.values(deps));}
function fixture(kind){const SettingsHost=freshSettingsHost();const r=rpc();currentOwner=r;const sourceDomain=kind==='source',method=sourceDomain?'sourceManagementContent':'settingsContent';const index=createReaderBuilderProbe(source('pages/Index.ets'),[method,'settingsSurface','bindSettingsPresentation','sourceManagementSurface','bindSourceManagement','isCurrentSourceManagement','retireSourceManagementPresentation','isCurrentSettingsPresentation','isCurrentRuntime','reconcileSettingsCache'],{ReaderRuntimeOwner,SourceManagementPage:Child,SettingsPage:Child,deviceInfo:{deviceType:'phone'}}).owner;
 Object.assign(index,{route:sourceDomain?'source':'settings',sourceSources:[],sourceStatusKind:'idle',sourceStatusMessage:'',sourceOperation:{action:'load',sourceId:''},settingsOperation:{action:'load'},settingsSnapshot:{autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:false,crashLog:true,developerMode:false},settingsSection:'general',mountedRuntimeOwner:r,detailShelfAdmissionMount:1,navigationGeneration:1,shelfReceiptRetired:false,sourcePresentationIdentity:'',settingsPresentationIdentity:'',rssInstanceIdentity:1});
 const host=field(index,sourceDomain?'sourceHost':'settingsHost',{SourceHost,SettingsHost});index[sourceDomain?'sourceHost':'settingsHost']=host;if(sourceDomain)assert.equal(index.bindSourceManagement(),true);else assert.equal(index.bindSettingsPresentation(),true);
 let rendered=false;const refresh=()=>{if(!rendered){index[method]();rendered=true;}else index.replay();return [...index.children.values()].at(-1).params;};
 function page(){const params=refresh(),path=sourceDomain?'features/source/SourceManagementPage.ets':'features/settings/SettingsPage.ets';
  if(sourceDomain){const sdk=boundedSurfaceSdk();const page=sdk.consumer(source(path),['operation','statusKind','statusMessage','onReconcile','onRetryLoad','statusBanner','recovery'],{readerRecoveryView},params);Object.assign(page,{appThemeScheme:'day',resetMessage:'',contentFrame:()=>({width:350})});page.statusBanner();page.actualSdk=sdk;return page;}
  const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
  const page=sdk.consumer(source(path),['operation','cacheCleanup','onCacheCleanupChanged','applyCacheCleanup','temporaryBackIdentity','operationFeedback','recovery','feedbackMessage','recoveryActionIdentities','recoveryActionKind','recoveryActionGeneration',
   'recoveryActionLabel','recoveryActionCurrent','dispatchRecoveryAction'],{readerRecoveryView,ReaderRuntimeOwner});
  Object.assign(page,params,{appThemeScheme:'day',resetMessage:'',mounted:true,themeOwner:r,temporaryBackIdentity:'settings-real:1'});page.operationFeedback();
  page.actualSdk=sdk;return page;
 }
 const native=(page,label)=>{const actor=page.actualSdk.walk(page).find(c=>c.label===label&&c instanceof page.actualSdk.deps.ReaderRecoveryAction);assert.ok(actor,label+' actual native action');
  return [...actor.nodes.values()].find(n=>n.onClick).onClick;};

 return{r,index,host,refresh,page,open:()=>host.open(sourceDomain?index.sourcePresentationIdentity:index.settingsPresentationIdentity),write:()=>sourceDomain?host.toggleSource('a',false,index.sourcePresentationIdentity):host.toggle('reduceMotion',true,index.settingsPresentationIdentity),settle:async()=>{await tick();if(sourceDomain)await host.orchestrator.operationChain;else for(let i=0;i<5;i++)await tick();},receipt:()=>index[sourceDomain?'sourceOperation':'settingsOperation'],read:()=>index[sourceDomain?'sourceOperation':'settingsOperation'].readFacts,native,retry:page=>{if(sourceDomain){const actor=page.actualSdk.walk(page).find(c=>c.specId==='source-management-retry'&&c.label==='重试');assert.ok(actor,'actual shared Source retry component');const hit=page.actualSdk.nodes(actor).find(n=>typeof n.onClick==='function');assert.ok(hit,'actual shared Source retry native action');hit.onClick();}else native(page,'刷新设置')();}};}
for(const kind of ['source','settings']){
 const command=kind==='source'?'source.update':undefined;
 {
  const f=fixture(kind);f.open();await f.settle();if(kind==='source')f.r.readFail=1;else {const original=prefs.get(f.r.context).flush;prefs.get(f.r.context).flush=async()=>{await original();f.r.readFail=1;};}
  f.write();await f.settle();assert.equal(f.receipt().receipt.receipt.fact,'confirmedRefreshFailed');const p=f.page();assert.match(p.recovery().message,/已确认.*刷新失败/);const writes=kind==='source'?f.r.count(command):f.r.flushes;f.retry(p);f.retry(p);await f.settle();assert.equal(kind==='source'?f.r.count(command):f.r.flushes,writes,'read-only retry never replays mutation');assert.equal(f.receipt().receipt.receipt.fact,'confirmedCurrent');
 }
 {
  const f=fixture(kind);f.open();await f.settle();f.r.writeFail=true;f.write();await f.settle();assert.equal(f.receipt().receipt.receipt.confirmation,'unknown');if(kind==='settings')assert.equal(f.index.settingsSnapshot.reduceMotion,true,'failed preference flush retains accepted choice with unknown receipt');const n=kind==='source'?f.r.count(command):f.r.flushes;f.retry(f.page());await f.settle();assert.equal(f.receipt().receipt.receipt.fact,'pendingReconciliation');assert.equal(kind==='source'?f.r.count(command):f.r.flushes,n);
 }
 {
  const f=fixture(kind);f.r.readFail=1;f.open();await f.settle();assert.ok(f.read().canRetry);assert.equal(f.receipt().receipt,undefined);f.retry(f.page());await f.settle();assert.equal(f.read().fact,'current');f.r.malformed=true;f.open();await f.settle();assert.equal(f.read().fact,'refreshFailed','bad persisted payload keeps canonical state');
 }
 {
  const f=fixture(kind);f.open();await f.settle();if(kind==='source')f.r.readFail=1;if(kind==='settings'){const original=prefs.get(f.r.context).flush;prefs.get(f.r.context).flush=async()=>{await original();f.r.readFail=1;};}f.write();await f.settle();const p=f.page(),old=clone(f.receipt());f.open();await f.settle();const n=kind==='source'?f.r.calls.length:f.r.puts;f.retry(p);await f.settle();assert.equal(kind==='source'?f.r.calls.length:f.r.puts,n,'reopen invalidates old recovery');currentOwner=rpc();f.write();await f.settle();assert.equal(kind==='source'?f.r.calls.length:f.r.puts,n,'old runtime owner cannot write');
 }
 {
  const f=fixture(kind);f.open();await f.settle();const d=defer();f.r.pause={method:kind==='source'?command:'flush',...d};f.write();await tick();const before=clone(f.receipt()),priorRows=clone(f.index.sourceSources);f.index.route='bookshelf';d.resolve();await f.settle();assert.deepEqual(f.receipt(),before,'closed page rejects late receipt publication');if(kind==='source')assert.deepEqual(f.index.sourceSources,priorRows);const n=kind==='source'?f.r.calls.length:f.r.puts;f.write();await f.settle();assert.equal(kind==='source'?f.r.calls.length:f.r.puts,n,'closed UI actions cannot write');f.index.route=kind==='source'?'source':'settings';f.open();await f.settle();
 }
}
{
 const f=fixture('source');f.open();await f.settle();f.r.admission=true;f.write();await f.settle();assert.equal(f.r.count('source.update'),2,'only typed admission refusal can retry a write');assert.equal(f.receipt().receipt.receipt.confirmation,'confirmed','actual gateway excludes the pre-execution refusal from dispatched writes');
}

for(const kind of ['source','settings']){
 const f=fixture(kind);f.open();await f.settle();const d=defer();f.r.pause={method:kind==='source'?'source.update':'flush',...d};f.write();await tick();
 const before=clone(f.receipt());currentOwner=undefined;d.resolve();await f.settle();assert.deepEqual(f.receipt(),before,'late actual ACK has no retired UI/error publication');
 const count=kind==='source'?f.r.calls.length:f.r.puts;assert.doesNotThrow(()=>f.write(),'retired physical intent keeps its captured business owner and does not acquire a new Runtime');assert.equal(f.host.orchestrator.owns(f.r),true,'getter does not replace the original finite owner');await f.settle();assert.equal(kind==='source'?f.r.calls.length:f.r.puts,count);
 f.r.pause=undefined;currentOwner=f.r;f.open();await f.settle();assert.equal(f.read().fact,'current');
 if(kind==='source')assert.equal(f.index.sourceSources[0].enabled,false);else assert.equal(f.index.settingsSnapshot.reduceMotion,true,'persisted setting read survives retired delivery');
}

for(const failure of ['before','after']){
 const f=fixture('settings');f.open();await f.settle();f.r.writeFail=failure;f.write();await f.settle();
 const page=f.page(),oldSave=f.native(page,'重试保存当前设置'),refresh=f.native(page,'刷新设置');
 const puts=f.r.puts,flushes=f.r.flushes;refresh();await f.settle();assert.equal(f.r.puts,puts);assert.equal(f.r.flushes,flushes);
 assert.equal(f.receipt().receipt.receipt.confirmation,'unknown');assert.equal(f.index.settingsSnapshot.reduceMotion,true);
 oldSave();await f.settle();assert.equal(f.r.puts,puts,'pure refresh retires the old generation action');
 const debugPage=f.page();const save=f.native(debugPage,'重试保存当前设置');save();save();await f.settle();
 assert.equal(f.r.puts,puts+5);assert.equal(f.r.flushes,flushes+1);
 assert.equal(f.receipt().receipt.receipt.confirmation,'confirmed');
 // A retained SDK physical actor is never upgraded by a new generation.
 f.r.writeFail=true;f.host.toggle('crashLog',false,f.index.settingsPresentationIdentity);await f.settle();const before=f.r.puts;
 Object.assign(page,f.refresh());page.replay();oldSave();await f.settle();assert.equal(f.r.puts,before,'old actor cannot save a newer accepted tuple');
 const next=f.page(),current=f.native(next,'重试保存当前设置');f.index.navigationGeneration++;current();await f.settle();assert.equal(f.r.puts,before,'old physical page callback rejects new navigation');
}
console.log('Source/Settings actual Gateway -> Index -> SDK consumers: PASS (ACK/read failure/unknown/read-only retry/close/reopen/late/owner/malformed/typed admission).');

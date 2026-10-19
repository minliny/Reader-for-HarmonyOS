import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {ReaderWriteEvidence} from '../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {projectOperationFacts,projectCommitReadback} from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {readerRecoveryView} from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import {readerFloatingTabContentInset} from './lib/reader-floating-bar-metrics-probe.mjs';
import {createDefaultReaderWindowMetrics} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const file=p=>new URL('../entry/src/main/ets/'+p,import.meta.url),source=p=>readFileSync(file(p),'utf8');
const projectPersistedReceipt=new Function('projectOperationFacts','projectCommitReadback',stripTypeScriptTypes(source('app/ReaderPersistedReceiptProjection.ts').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''))+';return projectPersistedReceipt;')(projectOperationFacts,projectCommitReadback);
const tick=()=>new Promise(resolve=>setImmediate(resolve)),defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
let runtime;
const Store=productionMotionMethods(file('features/sync/WebDavCredentialStore.ts'),['attachContext','currentBookshelfViewMode','bookshelfModeContextGeneration',
 'loadBookshelfViewMode','saveBookshelfViewMode','readOrMigrateViewMode','writeLocalViewMode','validateRestoreJournal'],
 {LOCAL_VIEW_MODE_KEY:'mode',LOCAL_MIGRATION_KEY:'version',LOCAL_CONFIG_VERSION:1,LOCAL_RESTORE_JOURNAL_KEY:'journal'});
const Host=new Function('WebDavCredentialStore','ReaderThemeHost','ReaderRuntimeOwner','ReaderWriteEvidence','errorMessageOf','projectOperationFacts','projectPersistedReceipt',
 stripTypeScriptTypes(source('features/bookshelf/BookshelfViewModeHost.ts').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''))+';return BookshelfViewModeHost;')(
 {instance:{}},{prepareUserChange:async()=>{}},runtimeOwnerIdentityProbe(()=>runtime),ReaderWriteEvidence,e=>e.message,projectOperationFacts,projectPersistedReceipt);
const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const syntax=require(sdk+'/lib/validate_ui_syntax.js'),maps=require(sdk+'/lib/component_map.js');
for(const name of ['ReaderRecoveryNotice','ReaderRecoveryAction','PageBackBar']){
 syntax.componentCollection.customComponents.add(name);
 syntax.propCollection.set(name,new Set([...source('features/common/'+name+'.ets').matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
}
for(const path of ['features/bookshelf/BookshelfPage.ets','features/bookshelf/BookshelfSettingsPage.ets'])
 for(const m of source(path).matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g))maps.CUSTOM_BUILDER_METHOD.add(m[1]);
class Child {constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
function fixture(){
 runtime={};const values=new Map([['mode','cover'],['version',1]]),calls=[];
 let writeFail=false,readFail=false,afterFlushReadFail=false,flushGate,readGate,prepare=async()=>{};
 const backend={has:async k=>values.has(k),get:async(k,f)=>{calls.push(['read',k]);if(readGate){const g=readGate;readGate=undefined;await g.promise;}if(readFail){readFail=false;throw Error('read unavailable');}return values.get(k)??f;},
  put:async(k,v)=>{calls.push(['put',k,v]);values.set(k,v);},delete:async k=>{calls.push(['delete',k]);values.delete(k);},
  flush:async()=>{calls.push(['flush']);if(flushGate){const d=flushGate;flushGate=undefined;await d.promise;}if(writeFail)throw Error('lost flush ACK');if(afterFlushReadFail){afterFlushReadFail=false;readFail=true;}}};
 const store=Object.assign(new Store(),{localModeWriteTail:Promise.resolve(),contextGeneration:0,pendingBookshelfModeWrites:0,confirmedBookshelfMode:undefined,
  context:{},ensureLocalPreferences:async()=>backend,load:async()=>null});
 const host=new Host(store,()=>prepare());
 const page=(settings=false)=>{
  const path=settings?'features/bookshelf/BookshelfSettingsPage.ets':'features/bookshelf/BookshelfPage.ets';
  const toasts=[];
  const names=settings?['selectMode','persistRequestedMode','viewModeRecovery','applyModeSnapshot','retryMode','loadMode','aboutToDisappear','modePending','modeFeedback']:
   ['setViewMode','persistRequestedViewMode','viewModeRecovery','applyViewModeSnapshot','retryViewMode','loadViewMode','aboutToDisappear','viewModePending','modeFeedback'];
  const Model=productionMotionMethods(file(path),names,{readerRecoveryView});
  const p=Object.assign(new Model(),{viewModeHost:host,viewModeSnapshot:{canonical:undefined},mounted:true,revision:0,viewModeRevision:0,mode:'cover',viewMode:'cover',
   storedViewMode:'cover',confirmed:'cover',confirmedViewMode:'cover',requestedMode:'cover',requestedViewMode:'cover',error:'',viewModeError:'',reduceMotion:true,
   viewSwitchRunning:false,projectionGeneration:0,viewportRestoreGeneration:0,viewState:{},resetViewSwitchMotion(){this.viewSwitchRunning=false;},
   setRestingProjectionOpacity(){},rebuildShelfProjection(){},saveShelfViewport(){},webDavCredentials:store,
   getUIContext:()=>({getPromptAction:()=>({showToast:({message})=>toasts.push(message)})}),lastModeFeedback:''});
  return{p,select:mode=>p[settings?'selectMode':'setViewMode'](mode),load:()=>p[settings?'loadMode':'loadViewMode'](),
   retry:g=>p[settings?'retryMode':'retryViewMode'](g),close:()=>p.aboutToDisappear(),
   // Receipt safety is checked through the actual page methods. The new
   // floating/page-state composition is checked by the shared message SDK
   // and full production assembly; ordinary readback errors are now Toasts.
   toasts};
 };
 return{store,host,page,calls,values,failWrite:()=>writeFail=true,failRead:()=>readFail=true,failReadback:()=>afterFlushReadFail=true,
  gate:()=>{flushGate=defer();return flushGate;},readGate:()=>{readGate=defer();return readGate;},prepare:fn=>prepare=fn,flushes:()=>calls.filter(x=>x[0]==='flush').length};
}

// Startup reads the Store directly before this feature Host has ever loaded.
// Mount the actual settings lifecycle and SDK content together: selecting a
// mode before rendering would warm the Host and hide this first-mount defect.
function settingsLifecycleSdk(f){
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),definition=source('features/bookshelf/BookshelfSettingsPage.ets');
 const names=['appThemeScheme','mode','autoCheckUpdate','operation','navigationGeneration','presentationRevision','error','viewModeSnapshot',
  'viewModeHost','revision','confirmed','requestedMode','mounted','modeLoadBusy','modeReconcileBusy','lastModeFeedback','lastSettingsFeedback',
  'aboutToAppear','aboutToDisappear','settingsPending','modePending','onOperationChanged','viewModeRecovery','modeFeedback','loadMode',
  'applyModeSnapshot','pageContent','modeOption','selectMode','persistRequestedMode','pendingOverlay','settingsRecovery','retryMode'];
 const page=sdk.consumer(definition,names,{readerRecoveryView,BookshelfViewModeHost:{instance:f.host},WebDavCredentialStore:{instance:f.store},registerReaderFonts(){}},
  {operation:{action:'load',readFacts:projectOperationFacts({phase:'idle'})}});
 Object.assign(page,{getUIContext:()=>({getFont:()=>({}),getPromptAction:()=>({showToast(){}})})});
 page.aboutToAppear();page.pageContent();
 return{sdk,page,rawSnapshot:()=>sdk.properties.sdk.ObservedObject.GetRawObject(page.viewModeSnapshot),
  options:()=>sdk.nodes(page).filter(node=>node.type==='Text'&&['封面','列表'].includes(node.create))};
}
let startupLifecycleCases=0;
for(const canonical of ['cover','list']){
 const f=fixture();f.values.set('mode',canonical);await f.store.loadBookshelfViewMode();
 assert.equal(f.store.currentBookshelfViewMode(),canonical);assert.equal(f.host.current().canonical,undefined,'actual startup Store read leaves the feature Host cold');
 const calls=f.calls.length,x=settingsLifecycleSdk(f);
 assert.deepEqual(x.options().map(node=>node.create),['封面','列表'],'acknowledged startup choice must expose both real native settings options on first mount');
 assert.equal(x.page.viewModeSnapshot.canonical,canonical);assert.equal(x.page.mode,canonical);assert.equal(x.page.confirmed,canonical);
 assert.equal(x.page.viewModeSnapshot.receipt,undefined,'cache hydration is not a fabricated write receipt');
 assert.equal(x.page.modeLoadBusy,false);assert.equal(x.sdk.nodes(x.page).some(node=>node.type==='LoadingProgress'),false);
 assert.equal(x.sdk.nodes(x.page).some(node=>node.type==='Text'&&node.create==='显示方式尚未读取'),false);
 await tick();assert.equal(f.calls.length,calls,'startup ACK reuse must not issue another read or write');
 assert.equal(f.host.current().canonical,undefined,'page hydration does not mutate the feature owner');
 const before=f.calls.length;x.page.aboutToDisappear();x.page.aboutToAppear();await tick();
 assert.equal(x.page.viewModeSnapshot.canonical,canonical);assert.equal(f.calls.length,before,'route remount reuses the same acknowledged Store fact');
 startupLifecycleCases++;
}
{
 const f=fixture(),gate=f.gate(),work=f.host.save('list',()=>true);await tick();runtime={};gate.reject(Error('lost flush ACK'));await work;
 assert.equal(f.host.current().canonical,undefined);assert.equal(f.host.current().receipt.receipt.confirmation,'unknown');
 await f.store.loadBookshelfViewMode(false);const original=f.host.current(),calls=f.calls.length,x=settingsLifecycleSdk(f);
 assert.deepEqual(x.options().map(node=>node.create),['封面','列表']);assert.equal(x.rawSnapshot(),original,'any unresolved owner snapshot remains the exact original object under the real SDK State proxy');
 assert.equal(x.page.viewModeSnapshot.canonical,undefined,'the Store value cannot overwrite an unresolved owner snapshot');
 assert.equal(x.rawSnapshot().receipt,original.receipt,'hydration retains the exact unresolved receipt and its generation');
 assert.equal(x.page.modePending(),true);assert.equal(f.host.canSave(),false);x.page.pendingOverlay();
 const notice=x.sdk.walk(x.page).find(actor=>actor instanceof x.sdk.deps.ReaderRecoveryNotice&&actor.tag==='显示方式待确认');
 assert.ok(notice);assert.equal(notice.view.generation,original.receipt.facts.generation);assert.equal(notice.busy,false);
 x.page.selectMode('cover');await tick();assert.equal(f.calls.length,calls,'cached readable choice cannot unlock a second unknown write');
 assert.equal(f.host.current(),original);assert.equal(f.host.current().receipt.receipt.confirmation,'unknown');startupLifecycleCases++;
}
{
 const f=fixture();f.failRead();await f.host.load(()=>true);const original=f.host.current();
 assert.equal(original.readFacts.fact,'failed');await f.store.loadBookshelfViewMode(false);const calls=f.calls.length,x=settingsLifecycleSdk(f);
 assert.equal(x.rawSnapshot(),original,'acknowledged Store cache cannot replace an existing owner read-failure fact');
 assert.equal(x.rawSnapshot().readFacts,original.readFacts);assert.equal(x.page.viewModeSnapshot.readFacts.generation,original.readFacts.generation);
 assert.ok(x.sdk.nodes(x.page).some(node=>node.type==='Text'&&node.create==='显示方式读取失败'));
 await tick();assert.equal(f.calls.length,calls,'preserving the owner fact does not issue a speculative read or write');startupLifecycleCases++;
}
for(const settings of[false,true]){
 {const f=fixture(),p=f.page(settings);f.failReadback();p.select('list');await tick();await tick();assert.equal(p.p.viewModeSnapshot.receipt.receipt.fact,'confirmedRefreshFailed');
  assert.equal(settings?p.p.mode:p.p.viewMode,'list');assert.ok(p.toasts.some(message=>/已确认.*刷新失败/.test(message)));
  const generation=p.p.viewModeSnapshot.receipt.facts.generation;p.retry(generation);p.retry(generation);await tick();await tick();assert.equal(f.flushes(),1,'visible retry only reads; no second write');assert.equal(p.p.viewModeSnapshot.receipt.receipt.fact,'confirmedCurrent');}
 {const f=fixture(),p=f.page(settings);f.failWrite();p.select('list');await tick();await tick();assert.equal(p.p.viewModeSnapshot.receipt.receipt.confirmation,'unknown');
  assert.equal(f.host.canSave(),false);const generation=p.p.viewModeSnapshot.receipt.facts.generation;p.retry(generation);await tick();assert.equal(f.flushes(),1);assert.equal(p.p.viewModeSnapshot.receipt.receipt.confirmation,'unknown','a matching/old read is not this write ACK');
  p.select('cover');await tick();assert.equal(f.flushes(),1,'new UI intent cannot blindly replay unknown mode write');
  const other=f.page(!settings);other.load();await tick();assert.equal(other.p.viewModeSnapshot.receipt.receipt.confirmation,'unknown','two true consumers share unresolved receipt');}
 {const f=fixture(),p=f.page(settings);f.failRead();p.load();await tick();assert.equal(p.p.viewModeSnapshot.readFacts.canRetry,true);
  p.retry(p.p.viewModeSnapshot.readFacts.generation);await tick();assert.equal(f.flushes(),0,'initial read retry is strictly read-only');}
 {const f=fixture(),p=f.page(settings);const gate=f.gate();p.select('list');await tick();p.close();gate.reject(Error('lost ACK'));await tick();await tick();
  assert.equal(p.p.viewModeSnapshot.receipt,undefined,'closed page cannot consume late write');const other=f.page(!settings);other.load();await tick();await tick();
  assert.equal(other.p.viewModeSnapshot.receipt.receipt.confirmation,'unknown','reopen cannot erase late unknown receipt');assert.equal(f.flushes(),1);}
 {const f=fixture(),p=f.page(settings);f.failReadback();p.select('list');await tick();await tick();const generation=p.p.viewModeSnapshot.receipt.facts.generation;await f.host.save('cover',()=>true);const reads=f.calls.length;p.retry(generation);await tick();assert.equal(f.calls.length,reads);
  assert.equal(f.flushes(),2);assert.equal(p.p.viewModeSnapshot.receipt.receipt.fact,'confirmedRefreshFailed','old generation callback ignored');}
 {const f=fixture(),p=f.page(settings);const prepare=defer();f.prepare(()=>prepare.promise);p.select('list');await tick();p.close();prepare.resolve();await tick();assert.equal(f.flushes(),0,'close before dispatch never writes');}
 {const f=fixture(),p=f.page(settings);f.prepare(async()=>{throw Error('BOOKSHELF_RESTORE_PENDING');});p.select('list');await tick();await tick();
  assert.equal(p.p.viewModeSnapshot.receipt.receipt.confirmation,'undispatched');assert.equal(f.flushes(),0);assert.match(settings?p.p.error:p.p.viewModeError,/同步设置/);}
}
{const f=fixture(),p=f.page();p.select('list');p.select('cover');await tick();await tick();assert.equal(f.values.get('mode'),'cover');assert.equal(f.flushes(),1,'retired queued intent cannot dispatch before latest admission');}
{const f=fixture();const blocked=defer();f.store.localModeWriteTail=blocked.promise;const evidence=new ReaderWriteEvidence();const work=f.store.saveBookshelfViewMode('list',undefined,evidence);f.store.attachContext({});blocked.resolve();await assert.rejects(work,/RETIRED/);assert.equal(evidence.confirmation(),'undispatched');assert.equal(f.flushes(),0,'old context queued save cannot write into new context');}
{const f=fixture();f.values.set('mode','invalid');await assert.rejects(f.store.loadBookshelfViewMode(false),/INVALID/);assert.equal(f.flushes(),0,'malformed preference cannot be silently fabricated as cover');}
{const f=fixture();f.values.delete('mode');await assert.rejects(f.store.loadBookshelfViewMode(false),/MISSING/);assert.equal(f.flushes(),0,'strict reconciliation cannot run migration writes');}
{const f=fixture(),p=f.page();const gate=f.gate();p.select('list');await tick();p.select('cover');gate.reject(Error('lost ACK'));await tick();await tick();assert.equal(f.flushes(),1,'queued newer intent cannot replay after previous unknown');assert.equal(p.p.viewModeSnapshot.receipt.receipt.confirmation,'unknown');}
{const f=fixture(),p=f.page();const gate=f.gate();p.select('list');await tick();runtime={};gate.reject(Error('lost ACK'));await tick();await tick();assert.equal(p.p.viewModeSnapshot.receipt,undefined,'retired runtime cannot deliver old value');const next=f.page(true);next.load();await tick();await tick();assert.equal(next.p.viewModeSnapshot.receipt.receipt.confirmation,'unknown','feature retains unknown while new runtime reads current value');assert.equal(f.flushes(),1);}

for(const unknown of [false,true]){
 const f=fixture(),p=f.page();const gate=f.gate();p.select('list');await tick();runtime=undefined;if(unknown)gate.reject(Error('lost ACK'));else gate.resolve();await f.host.writeTail;await tick();
 assert.equal(p.p.viewModeSnapshot.receipt,undefined,'Runtime absence prevents old ACK/error delivery');assert.equal(f.flushes(),1);
 assert.equal(await f.host.load(()=>true),undefined);const denied=await f.host.save('cover',()=>true);if(unknown)assert.equal(denied.receipt.receipt.confirmation,'unknown','blocked optional entry preserves unknown');else assert.equal(denied,undefined,'optional entry rejects unavailable owner');assert.equal(f.flushes(),1);
 runtime={};const next=f.page(true);next.load();for(let i=0;i<6;i++)await tick();assert.equal(next.p.mode,f.values.get('mode'),'new Runtime independently reads actual current preference/cache without assuming unknown outcome');if(!unknown)assert.equal(next.p.mode,'list');
 if(unknown)assert.equal(next.p.viewModeSnapshot.receipt.receipt.confirmation,'unknown','matching read never acknowledges unknown');
 assert.equal(f.flushes(),1,'independent recovery never replays mutation');
}


// Actual SDK page → Notice → native action during the real preference read.
function modeSdk(f,settings){
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),path=settings?'features/bookshelf/BookshelfSettingsPage.ets':'features/bookshelf/BookshelfPage.ets';
 const common=['modeReconcileBusy','viewModeSnapshot','viewModeRecovery','mounted','lastModeFeedback','modeFeedback'];
 const names=settings?[...common,'pendingOverlay','modePending','retryMode','revision','applyModeSnapshot','aboutToDisappear']:
  [...common,'bookshelfTabContent','viewModePending','retryViewMode','viewModeRevision','applyViewModeSnapshot','aboutToDisappear'];
 const owner=sdk.consumer(source(path),names,{readerRecoveryView});
 Object.assign(owner,{viewModeHost:f.host,viewModeSnapshot:f.host.current(),mounted:true,revision:0,viewModeRevision:0,
  settingsRecovery(){},isWideViewport:()=>false,phoneContent(){},tabletContent(){},bookActionSheetContent(){},bookActionSheetOptions:()=>({}),
  headerClearance:74,noticeTopInset:0,viewState:{},saveShelfViewport(){},resetViewSwitchMotion(){},setRestingProjectionOpacity(){},rebuildShelfProjection(){},
  getUIContext:()=>({getPromptAction:()=>({showToast(){}})})});
 owner[settings?'pendingOverlay':'bookshelfTabContent']();
 const action=()=>sdk.walk(owner).find(c=>c instanceof sdk.deps.ReaderRecoveryAction&&c.label==='核对显示方式');
 const native=()=>sdk.nodes(action()).find(n=>n.type==='Stack'&&n.onClick);
 return{sdk,owner,action,native};
}
for(const settings of[false,true]){
 const f=fixture(),page=f.page(settings);f.failWrite();page.select('list');await tick();await tick();
 const x=modeSdk(f,settings),action=x.action(),hit=x.native();assert.ok(action);assert.equal(action.isBusy,false,'idle unknown is not activity');
 const gate=f.readGate(),reads=f.calls.filter(c=>c[0]==='read').length;hit.onClick();hit.onClick();
 assert.equal(x.owner.modeReconcileBusy,true);x.sdk.properties.flush();
 assert.equal(x.action(),action);assert.equal(x.native(),hit,'same-generation busy update keeps the actual action target');
 const nodes=x.sdk.nodes(action);assert.equal(nodes.find(n=>n.type==='Text').opacity,0);assert.equal(hit.constraintSize.minHeight,28);
 const loader=nodes.find(n=>n.type==='LoadingProgress');assert.deepEqual([loader.width,loader.height],[18,18]);
 assert.equal(hit.enabled,false);await tick();assert.equal(f.calls.filter(c=>c[0]==='read').length,reads+1,'duplicate native tap does not start another read');
 gate.resolve();await tick();await tick();await tick();assert.equal(x.owner.modeReconcileBusy,false);
 assert.equal(f.host.current().receipt.receipt.confirmation,'unknown','read completion does not invent a write ACK');
 const quiet=modeSdk(f,settings);assert.equal(quiet.action().isBusy,false);assert.equal(quiet.sdk.nodes(quiet.action()).some(n=>n.type==='LoadingProgress'),false);
 x.owner.aboutToDisappear();assert.equal(x.owner.modeReconcileBusy,false);
}

console.log(`PASS bookshelf mode actual preference gateway→one shared feature owner→both page methods: ${startupLifecycleCases} startup Store-ACK/cold-Host lifecycle SDK groups, readback Toast, real dispatch/flush ACK, readonly reconciliation, unknown across close/reopen/consumer/runtime, rapid identity and restore gates`);

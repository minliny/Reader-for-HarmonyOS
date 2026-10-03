import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {ReaderWriteEvidence} from '../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {projectOperationFacts,projectCommitReadback} from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {readerRecoveryView} from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
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
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
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
 let writeFail=false,readFail=false,afterFlushReadFail=false,flushGate,prepare=async()=>{};
 const backend={has:async k=>values.has(k),get:async(k,f)=>{calls.push(['read',k]);if(readFail){readFail=false;throw Error('read unavailable');}return values.get(k)??f;},
  put:async(k,v)=>{calls.push(['put',k,v]);values.set(k,v);},delete:async k=>{calls.push(['delete',k]);values.delete(k);},
  flush:async()=>{calls.push(['flush']);if(flushGate){const d=flushGate;flushGate=undefined;await d.promise;}if(writeFail)throw Error('lost flush ACK');if(afterFlushReadFail){afterFlushReadFail=false;readFail=true;}}};
 const store=Object.assign(new Store(),{localModeWriteTail:Promise.resolve(),contextGeneration:0,pendingBookshelfModeWrites:0,confirmedBookshelfMode:undefined,
  context:{},ensureLocalPreferences:async()=>backend,load:async()=>null});
 const host=new Host(store,()=>prepare());
 const page=(settings=false)=>{
  const path=settings?'features/bookshelf/BookshelfSettingsPage.ets':'features/bookshelf/BookshelfPage.ets';
  const names=settings?['selectMode','persistRequestedMode','viewModeRecovery','applyModeSnapshot','retryMode','loadMode','aboutToDisappear']:
   ['setViewMode','persistRequestedViewMode','viewModeRecovery','applyViewModeSnapshot','retryViewMode','loadViewMode','aboutToDisappear'];
  const Model=productionMotionMethods(file(path),names,{readerRecoveryView});
  const p=Object.assign(new Model(),{viewModeHost:host,viewModeSnapshot:{canonical:undefined},mounted:true,revision:0,viewModeRevision:0,mode:'cover',viewMode:'cover',
   storedViewMode:'cover',confirmed:'cover',confirmedViewMode:'cover',requestedMode:'cover',requestedViewMode:'cover',error:'',viewModeError:'',reduceMotion:true,
   viewSwitchRunning:false,projectionGeneration:0,viewportRestoreGeneration:0,viewState:{},resetViewSwitchMotion(){this.viewSwitchRunning=false;},
   setRestingProjectionOpacity(){},rebuildShelfProjection(){},saveShelfViewport(){},webDavCredentials:store});
  return{p,select:mode=>p[settings?'selectMode':'setViewMode'](mode),load:()=>p[settings?'loadMode':'loadViewMode'](),
   retry:g=>p[settings?'retryMode':'retryViewMode'](g),close:()=>p.aboutToDisappear(),
   render(){
    const selected=settings?['build','modeOption','settingsRecovery','settingsRecoveryIdentity','settingsRecoveryCurrent','retrySettingsRecovery']:['bookshelfList','shelfPageHandler','shelfScrollHandler','isShelfPresentationCurrent'];
    const deps={readerRecoveryView,ViewStackProcessor:{StartGetAccessRecordingFor(){},StopGetAccessRecording(){}},LazyForEach:{create(){},pop(){}},READER_FLOATING_TOP_BAR_HEIGHT:56,ReaderRecoveryNotice:Child,PageBackBar:Child,Toggle:{create(){},isOn(){},selectedColor(){},onChange(){},pop(){}},ToggleType:{Switch:'Switch'}};
    const b=createReaderBuilderProbe(source(path),selected,deps).owner;
    Object.assign(b,p,{appThemeScheme:'day',books:[],operation:{action:'load'},continueReading:undefined,filterRowVisible:false,visibleBookCount:1,autoCheckUpdate:true,
     shelfContentWidth:()=>300,contentFrame:()=>({left:0,right:0}),bottomContentInset:()=>16,shelfBottomContentInset:()=>16,
     sectionHeader(){},sectionHeaderContent(){},sectionAction(){},filterRow(){},rebuildShelfProjection(){},shelfListHeight:()=>100,gridRows(){},bookList(){},gridBookRows(){},continueReadingCard(){},
     lazyRows(){},shelfRowContent(){},rowDataSource:{},shelfScroller:{},gridShelfRows(){},bookGridRows(){},viewModeRecovery:()=>p.viewModeRecovery(),retryMode:g=>p.retryMode(g),retryViewMode:g=>p.retryViewMode(g),modeOption(){}});
    if(settings)b.initialRender();else {b.bookshelfList(false);for(const node of [...b.nodes.values()])if(node.type==='ListItem'&&Array.isArray(node.create)&&typeof node.create[0]==='function')node.create[0]();}
    const notices=[...b.children.values()].filter(c=>c.params.view?.visible);assert.equal(notices.length,1,'actual page renders exactly one visible shared recovery '+JSON.stringify({settings,error:p.viewModeError,props:[...b.children.values()].map(c=>c.params),view:p.viewModeRecovery()}));
    const n=createReaderBuilderProbe(source('features/common/ReaderRecoveryNotice.ets'),['build'],{ReaderRecoveryAction:Child}).owner;
    Object.assign(n,{appThemeScheme:'day'},notices[0].params);n.initialRender();
    const c=[...n.children.values()].at(-1);if(!c)return{notice:n};
    const a=createReaderBuilderProbe(source('features/common/ReaderRecoveryAction.ets'),['build']).owner;
    Object.assign(a,{appThemeScheme:'day',enabled:true},c.params);a.initialRender();return{notice:n,action:[...a.nodes.values()].find(x=>x.type==='Text'&&x.height===36)};
   }};
 };
 return{store,host,page,calls,values,failWrite:()=>writeFail=true,failRead:()=>readFail=true,failReadback:()=>afterFlushReadFail=true,
  gate:()=>{flushGate=defer();return flushGate;},prepare:fn=>prepare=fn,flushes:()=>calls.filter(x=>x[0]==='flush').length};
}
for(const settings of[false,true]){
 {const f=fixture(),p=f.page(settings);f.failReadback();p.select('list');await tick();await tick();assert.equal(p.p.viewModeSnapshot.receipt.receipt.fact,'confirmedRefreshFailed');
  assert.equal(settings?p.p.mode:p.p.viewMode,'list');const rendered=p.render();assert.match(rendered.notice.view.message,/已确认.*刷新失败/);
  rendered.action.onClick();rendered.action.onClick();await tick();await tick();assert.equal(f.flushes(),1,'visible retry only reads; no second write');assert.equal(p.p.viewModeSnapshot.receipt.receipt.fact,'confirmedCurrent');}
 {const f=fixture(),p=f.page(settings);f.failWrite();p.select('list');await tick();await tick();assert.equal(p.p.viewModeSnapshot.receipt.receipt.confirmation,'unknown');
  assert.equal(f.host.canSave(),false);const r=p.render();r.action.onClick();await tick();assert.equal(f.flushes(),1);assert.equal(p.p.viewModeSnapshot.receipt.receipt.confirmation,'unknown','a matching/old read is not this write ACK');
  p.select('cover');await tick();assert.equal(f.flushes(),1,'new UI intent cannot blindly replay unknown mode write');
  const other=f.page(!settings);other.load();await tick();assert.equal(other.p.viewModeSnapshot.receipt.receipt.confirmation,'unknown','two true consumers share unresolved receipt');}
 {const f=fixture(),p=f.page(settings);f.failRead();p.load();await tick();assert.equal(p.p.viewModeSnapshot.readFacts.canRetry,true);
  const r=p.render();r.action.onClick();await tick();assert.equal(f.flushes(),0,'initial read retry is strictly read-only');}
 {const f=fixture(),p=f.page(settings);const gate=f.gate();p.select('list');await tick();p.close();gate.reject(Error('lost ACK'));await tick();await tick();
  assert.equal(p.p.viewModeSnapshot.receipt,undefined,'closed page cannot consume late write');const other=f.page(!settings);other.load();await tick();await tick();
  assert.equal(other.p.viewModeSnapshot.receipt.receipt.confirmation,'unknown','reopen cannot erase late unknown receipt');assert.equal(f.flushes(),1);}
 {const f=fixture(),p=f.page(settings);f.failReadback();p.select('list');await tick();await tick();const r=p.render();await f.host.save('cover',()=>true);const reads=f.calls.length;r.action.onClick();await tick();assert.equal(f.calls.length,reads);
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

console.log('PASS bookshelf mode actual preference gateway→one shared feature owner→both SDK consumers→shared recovery native actions: real dispatch/flush ACK, readonly reconciliation, unknown across close/reopen/consumer/runtime, rapid identity and restore gates');

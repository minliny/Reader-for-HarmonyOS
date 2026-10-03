import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {fixture,defaults,deferred,settle} from './lib/general-settings-persistence-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {productionReaderPressFeedback} from './lib/reader-press-feedback-probe.mjs';
import {readerRecoveryView} from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
const read=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const indexSource=read('pages/Index.ets'),pageSource=read('features/settings/SettingsPage.ets'),shelfSource=read('features/bookshelf/BookshelfSettingsPage.ets');
const require=createRequire(import.meta.url),sdkRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
require(sdkRoot+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('CategoryRow',new Set(['content']));
let sequence=0,cases=0;
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
const names=['settingsContent','settingsSurface','bookshelfSettingsContent','bookshelfSettingsSurface','bindSettingsPresentation',
 'retireSettingsPresentation','isCurrentSettingsPresentation','isCurrentRuntime','clearTextCache','reconcileSettingsCache'];
function index(f,route='settings',text=indexSource){
 const composition=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 composition.hooks.childSources.SettingsPage=pageSource;composition.hooks.childSources.BookshelfSettingsPage=shelfSource;
 const i=composition.consumer(text,names,{SettingsPage:Child,BookshelfSettingsPage:Child,ReaderRuntimeOwner:f.Runtime,deviceInfo:{deviceType:'phone'}},{});
 Object.assign(i,{route,navigationGeneration:1,mountedRuntimeOwner:f.runtime,detailShelfAdmissionMount:1,shelfReceiptRetired:false,rssInstanceIdentity:++sequence,
  settingsPresentationIdentity:'',settingsSnapshot:{...defaults},settingsOperation:{action:'load'},settingsSection:'general'});
 // Actual Index initializer carries its guarded State publishers unchanged.
 const a=text.indexOf('  private settingsHost:'),b=text.indexOf('\n  );',a)+6;
 const expression=text.slice(a,b).split('=').slice(1).join('=').trim().replace(/;$/,'');
 i.settingsHost=new Function('SettingsHost',stripTypeScriptTypes('const value='+expression+';')+'return value;').call(i,f.Host);
 const routes=[];
 for(const n of ['returnToBookshelf','openSourceManagement','openRulesManagement','openSync','openBookshelfSettings','openRss','openDiscover','returnFromBookshelfSettings'])i[n]=()=>routes.push(n);
 i.registerTemporaryBackBridge=(...a)=>routes.push(a);
 assert.equal(i.bindSettingsPresentation(),true);
 const props=()=>{i[route==='settings'?'settingsContent':'bookshelfSettingsContent']();return [...i.children.values()].at(-1).params;};
 const page=()=>{
  const params=props(),p=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
  if(route==='bookshelfSettings'){
   const o=p.consumer(shelfSource,['operation','navigationGeneration','autoCheckUpdate','onAutoCheckUpdate','onBack','onRetryAccepted','onReconcile','mounted','presentationRevision',
    'settingsRecovery','settingsRecoveryIdentity','settingsRecoveryCurrent','retrySettingsRecovery'],{readerRecoveryView},params);
   Object.assign(o,{mounted:true,presentationRevision:1});
   const native=label=>{o.settingsRecovery();const actor=p.walk(o).find(c=>c instanceof p.deps.ReaderRecoveryAction&&c.label===label);assert.ok(actor,label);return p.nodes(actor).find(n=>n.onClick).onClick;};
   return{o,p,params,toggle:()=>params.onAutoCheckUpdate(!params.autoCheckUpdate),native,refresh(){o.updateStateVars(props());p.properties.flush();}};
  }
  const ReaderPressFeedback=productionReaderPressFeedback();
  for(const [n,path]of [['CategoryRow','features/settings/CategoryRow.ets'],['ReaderToggle','features/common/ReaderToggle.ets']]){
   p.hooks.childSources[n]=read(path);p.deps[n]=createReaderBuilderProbe(read(path),boundedMembers(read(path)),{...p.deps,ReaderPressFeedback},p.hooks).Component;
  }
  const properties=[...pageSource.matchAll(/@Prop\s+(?:@Watch\([^\n]+?\)\s+)?(\w+)\s*:/g)].map(m=>m[1]);
  const callbacks=[...pageSource.matchAll(/^  (on\w+):/gm)].map(m=>m[1]);
  const o=p.consumer(pageSource,[...properties,...callbacks,'appThemeScheme','mounted','themeOwner','temporaryBackIdentity','resetMessage',
   'autoCheckUpdateValue','tapBottomScrollTopValue','reduceMotionValue','crashLogValue','onSnapshotChanged','syncSnapshotValues','onCacheCleanupChanged','applyCacheCleanup',
   'switchRow','toggleSetting','settingValue','operationFeedback','recovery','feedbackMessage','recoveryActionIdentities','recoveryActionKind',
   'recoveryActionGeneration','recoveryActionLabel','recoveryActionCurrent','dispatchRecoveryAction'],{ReaderPressFeedback,ReaderRuntimeOwner:f.Runtime,readerRecoveryView},params);
  Object.assign(o,{mounted:true,themeOwner:f.runtime,temporaryBackIdentity:'actual-settings:'+sequence,resetMessage:''});o.syncSnapshotValues();
  const toggle=()=>{o.switchRow('减少动效',()=>({id:1}),'reduceMotion');const actor=p.walk(o).findLast(c=>c instanceof p.deps.ReaderToggle);assert.ok(actor,'actual shared toggle mounted');return p.nodes(actor).find(n=>n.onClick).onClick;};
  const native=label=>{o.operationFeedback();const actor=p.walk(o).findLast(c=>c instanceof p.deps.ReaderRecoveryAction&&c.label===label);assert.ok(actor,label);return p.nodes(actor).find(n=>n.onClick).onClick;};
  return{o,p,params,toggle,native,refresh(){o.updateStateVars(props());p.properties.flush();}};
 };
 return{i,routes,props,page,open:async()=>{i.settingsHost.open(i.settingsPresentationIdentity);await settle();}};
}
const puts=f=>f.events.filter(e=>e[0]==='put').length;
{
 const f=fixture(),a=index(f);await a.open();const old=a.page(),oldTap=old.toggle(),before=puts(f);
 const b=index(f);await b.open();const id=b.i.settingsPresentationIdentity;
 assert.equal(a.i.bindSettingsPresentation(),false,'alive old Index getter never steals successor attachment');
 assert.equal(b.i.settingsHost.isPresentationCurrent(f.runtime,id),true);
 oldTap();old.params.onBack();old.params.onSectionChange('home');old.params.onOpenSourceManagement();old.params.onOpenRulesManagement();old.params.onOpenSync();
 old.params.onOpenBookshelfSettings();old.params.onRssRequested();old.params.onDiscoverRequested();old.params.onTemporaryBackBridge(()=>true,'old');
 assert.equal(await old.params.onRestoreDefaults(),false);assert.equal(await old.params.onClearCache(),undefined);await old.params.onReconcileCache(1);await old.params.onContinueCache(1);await settle();
 assert.equal(puts(f),before);assert.deepEqual(a.routes,[]);assert.equal(a.i.settingsSection,'general');
 const live=b.page();live.toggle()();await settle();assert.equal(puts(f),before+4);assert.equal(b.i.settingsSnapshot.reduceMotion,true);
 assert.equal(b.i.settingsOperation.receipt.receipt.confirmation,'confirmed');live.params.onOpenSourceManagement();assert.deepEqual(b.routes,['openSourceManagement']);cases++;
}
for(const failure of ['before','after']){
 const f=fixture(),a=index(f);await a.open();f.fail(failure);a.page().toggle()();await settle();
 assert.equal(a.i.settingsOperation.receipt.receipt.confirmation,'unknown');assert.equal(a.i.settingsSnapshot.reduceMotion,true);
 const old=a.page(),oldSave=old.native('重试保存当前设置');a.i.retireSettingsPresentation();
 const b=index(f);await b.open();const n=puts(f);oldSave();await settle();assert.equal(puts(f),n);
 const page=b.page(),refresh=page.native('刷新设置');refresh();refresh();await settle();assert.equal(puts(f),n,'native reconciliation does not issue put');
 assert.equal(b.i.settingsOperation.receipt.receipt.confirmation,'unknown');
 const current=b.page(),save=current.native('重试保存当前设置');save();save();await settle();assert.equal(puts(f),n+4);assert.equal(b.i.settingsOperation.receipt.receipt.confirmation,'confirmed');
 f.fail('after');b.page().toggle()();await settle();const after=puts(f);old.refresh();oldSave();await settle();assert.equal(puts(f),after,'V1 Props update cannot upgrade the old physical generation');cases++;
}
{
 const f=fixture(),a=index(f);await a.open();const gate=deferred();f.hangFlush(gate);a.page().toggle()();await settle();
 const prior={...a.i.settingsSnapshot};const b=index(f);await b.open();assert.equal(a.i.settingsHost.orchestrator,b.i.settingsHost.orchestrator);
 assert.equal(b.i.settingsSnapshot.reduceMotion,true);gate.resolve();await settle();assert.deepEqual(a.i.settingsSnapshot,prior);
 assert.equal(b.i.settingsOperation.receipt.receipt.confirmation,'confirmed');assert.equal(puts(f),4,'one accepted write survives reconstruction in the original chain');cases++;
}
for(const retirement of ['nav','mount','unset','closed']){
 const f=fixture(),a=index(f);await a.open();const old=a.page(),tap=old.toggle();if(retirement==='nav')a.i.navigationGeneration++;
 if(retirement==='mount')a.i.detailShelfAdmissionMount++;if(retirement==='unset')f.retire();if(retirement==='closed')a.i.shelfReceiptRetired=true;
 tap();old.params.onBack();assert.equal(await old.params.onClearCache(),undefined);await settle();assert.equal(puts(f),0);assert.deepEqual(a.routes,[]);cases++;
}
{
 const f=fixture(),a=index(f,'bookshelfSettings');await a.open();const old=a.page();f.fail('after');old.toggle();await settle();assert.equal(a.i.settingsOperation.receipt.receipt.confirmation,'unknown');
 const save=a.page().native('重试保存当前设置'),b=index(f,'bookshelfSettings');await b.open();const n=puts(f);save();old.params.onAutoCheckUpdate(true);await settle();assert.equal(puts(f),n);
 const current=b.page();current.native('重试保存当前设置')();await settle();assert.equal(puts(f),n+4);assert.equal(b.i.settingsSnapshot.autoCheckUpdate,false);cases++;
}
{
 const mutant=indexSource.replace("(!attached || (identity.length > 0 && identity === this.settingsPresentationIdentity && host.isPresentationCurrent(owner, identity)))",'true');
 assert.notEqual(mutant,indexSource);const f=fixture(),a=index(f,'settings',mutant);await a.open();const old=a.page();const b=index(f);await b.open();
 old.params.onOpenSourceManagement();assert.deepEqual(a.routes,['openSourceManagement'],'negative control proves old physical navigation needs owner attachment guard');cases++;
}
console.log(`PASS actual Preferences→shared Settings owner→Index→SDK page/toggle/recovery: ${cases} groups (alive getter, old physical callbacks, all navigation, exact identity, accepted ACK/unknown, pure read, finite retry, V1 Prop updates, runtime/mount/nav and negative control).`);

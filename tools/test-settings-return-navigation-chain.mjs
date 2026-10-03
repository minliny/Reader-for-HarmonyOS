import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, stripTypeScriptTypes} from 'node:module';
import {fixture, defaults, deferred, settle} from './lib/general-settings-persistence-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {cardSdk} from './lib/reader-card-probe.mjs';
import {ReaderNativeAlertOwner} from '../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
import {readerRecoveryView} from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import {isReaderProductSurfaceEnabled} from '../entry/src/main/ets/app/ReaderProductScope.ts';

const read=path=>readFileSync(new URL('../entry/src/main/ets/'+path,import.meta.url),'utf8');
const indexSource=read('pages/Index.ets'), pageSource=read('features/settings/SettingsPage.ets');
const sdkRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url), ts=require(sdkRoot+'/node_modules/typescript');
const syntax=require(sdkRoot+'/lib/validate_ui_syntax.js');
const ordinary=text=>stripTypeScriptTypes(text
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'')
  .replace(/^export (?:type )?\{[\s\S]*?\} from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const load=(path,result,deps={})=>new Function(...Object.keys(deps),ordinary(read(path))+`;return ${result};`)(...Object.values(deps));
const indexMethods=['openSettings','returnToSettings','returnFromSourceManagement','openSourceManagement','nextNavigationGeneration',
  'settingsContent','settingsSurface','bindSettingsPresentation','retireSettingsPresentation','isCurrentSettingsPresentation',
  'sourceManagementContent','sourceManagementSurface','bindSourceManagement','retireSourceManagementPresentation','isCurrentSourceManagement',
  'isCurrentRuntime','reconcileSettingsCache','retireSourceSwitchPresentation','retireRssEditorPresentation','retireRssPresentation',
  'retireReadingEntryPresentation','retireBookshelfCatalogPresentation'];

// The former Settings consumer fixture binds manually before rendering and
// substitutes the route methods with counters. Keep that suite's assertions;
// this separate contract instead invokes the unchanged production navigation.
class PagePayload {
  constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}
  updateStateVars(params){Object.assign(this.params,params);}
}
let instance=0;
function navigation(text=indexSource){
  const f=fixture(), context=f.runtime.getUIAbilityContext(), platformReads=[];
  context.filesDir='/settings-return-test-no-real-files';
  const facts=load('app/ReaderOperationFacts.ts','{projectOperationFacts,projectCommitReadback}');
  const receipt=load('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
  const common={ReaderRuntimeOwner:f.Runtime,ReaderWriteEvidence:f.Write.ReaderWriteEvidence,...facts,projectPersistedReceipt:receipt,
    hilog:{error(){},warn(){},info(){}}};
  // Only official platform IO is substituted. A cache reconciliation reads an
  // absent intent through the actual fixed-domain Store/Gateway/owner, never a
  // dummy successful cache owner. No mutation/Atomic write is admitted here.
  const intents=load('features/reading/ReadingOperationIntents.ts','{CacheClearOperationIntentStore}',{
    ...common,fileIo:{async readText(path){platformReads.push(path);throw Object.assign(Error('ENOENT'),{code:13900002});}},
    replaceReaderAtomicSnapshot:async()=>{throw Error('Unexpected persistent write in return-navigation contract');},
    util:{generateRandomUUID(){throw Error('Unexpected mutation identity');}},isReaderCoreTransactionPendingError:()=>false});
  const CacheGateway=load('features/settings/SettingsCacheGateway.ts','SettingsCacheGateway',intents);
  const CacheOwner=load('features/settings/SettingsCacheCleanupOwner.ts','SettingsCacheCleanupOwner',{...common,SettingsCacheGateway:CacheGateway});
  const createDefaultSettingsSnapshot=load('features/settings/SettingsGateway.ts','createDefaultSettingsSnapshot');
  const SettingsOrchestrator=load('features/settings/SettingsOrchestrator.ets','SettingsOrchestrator',{
    ...common,SettingsGateway:f.Gateway,createDefaultSettingsSnapshot});
  const SettingsHost=load('features/settings/SettingsHost.ets','SettingsHost',{
    ...common,SettingsOrchestrator,SettingsCacheCleanupOwner:CacheOwner});
  const http=load('app/HttpTransportPolicy.ts','{httpUrlHostname,isPrivateNetworkTarget}');
  const category=load('features/source/ReaderSourceCategory.ts','{classifyReaderSource}');
  const errors=load('app/ErrorMessage.ts','{errorMessageOf}');
  const SourceGateway=load('features/source/SourceGateway.ts','SourceGateway',{
    ...common,...http,...category,...errors,isReaderCoreTransactionPendingError:()=>false});
  const SourceOrchestrator=load('features/source/SourceOrchestrator.ets','SourceOrchestrator',{
    ...common,...errors,SourceGateway,isReaderCoreTransactionPendingError:()=>false});
  const SourceHost=load('features/source/SourceHost.ets','SourceHost',{...common,SourceOrchestrator,SourceGateway});
  const BookshelfHost=load('features/bookshelf/BookshelfHost.ets','BookshelfHost',common);
  const calls=[];
  Object.assign(f.runtime,{supportsCoreCapability:()=>false,async request(method,params={},options={}){
    assert.notEqual(options.canDispatch?.(),false,'actual current native RPC admission');
    assert.notEqual(options.canContinue?.(),false,'actual current reply admission');
    options.onDispatch?.();calls.push({method,params:structuredClone(params)});
    if(method==='source.list')return{data:{sources:[{sourceId:'source-a',name:'A',baseUrl:'https://a.test',enabled:true,enabledExplore:false,category:'text'}]}};
    if(method==='runtime.status')return{data:{pendingHostOperationCount:0}};
    throw Error('Unexpected Core mutation/read: '+method);
  }});
  const composition=cardSdk();
  composition.hooks.childSources.SettingsPage=pageSource;
  composition.hooks.childSources.SourceManagementPage=read('features/source/SourceManagementPage.ets');
  const i=createReaderBuilderProbe(text,indexMethods,{...composition.deps,ReaderRuntimeOwner:f.Runtime,
    SettingsPage:PagePayload,SourceManagementPage:PagePayload,deviceInfo:{deviceType:'phone'}},composition.hooks).owner;
  Object.assign(i,{route:'bookshelf',navigationGeneration:0,rssInstanceIdentity:++instance,detailShelfAdmissionMount:1,
    mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,settingsSection:'home',settingsSnapshot:{...defaults},settingsOperation:{action:'load'},
    settingsPresentationIdentity:'',sourcePresentationIdentity:'',sourceSources:[],sourceOperation:{action:'load',sourceId:''},
    sourceStatusKind:'idle',sourceStatusMessage:'',nativeAlertOwner:new ReaderNativeAlertOwner(),
    sourceManagementReturnTarget:'settings',sourceManagementSearchKeyword:'',bookshelfManagementPresentationIdentity:''});
  // These two initialized production fields carry their real guarded emitters.
  const initialize=(name,type)=>{
    const start=text.indexOf('  private '+name+':'),end=text.indexOf('\n  );',start)+6;
    assert.ok(start>=0&&end>start,'actual '+name+' initializer');
    const expression=text.slice(text.indexOf('=',start)+1,end).trim().replace(/;$/,'');
    return new Function(type.name,ordinary('const value='+expression+';')+'return value;').call(i,type);
  };
  i.settingsHost=initialize('settingsHost',SettingsHost);i.sourceHost=initialize('sourceHost',SourceHost);
  // No other feature is mounted. Even its retirement call is the actual Host
  // implementation; route methods and Settings/Source admissions are not stubs.
  i.bookshelfHost=new BookshelfHost(()=>{},()=>false,()=>f.runtime);
  const params=kind=>{
    i[kind==='settings'?'settingsContent':'sourceManagementContent']();
    return [...i.children.values()].findLast(child=>kind==='settings'?Object.hasOwn(child.params,'snapshot'):Object.hasOwn(child.params,'sources')).params;
  };
  const home=()=>{
    const props=params('settings'), sdk=cardSdk();
    for(const [name,path]of [['CategoryRow','features/settings/CategoryRow.ets'],['CategorySection','features/settings/CategorySection.ets']]){
      const source=read(path);sdk.hooks.childSources[name]=source;syntax.builderParamObjectCollection.set(name,new Set(['content']));
      sdk.deps[name]=createReaderBuilderProbe(source,boundedMembers(source),sdk.deps,sdk.hooks).Component;
    }
    const propertyNames=[...pageSource.matchAll(/@Prop\s+(?:@Watch\([^\n]+?\)\s+)?(\w+)\s*:/g)].map(m=>m[1]);
    const callbackNames=[...pageSource.matchAll(/^  (on\w+):/gm)].map(m=>m[1]);
    const page=sdk.consumer(pageSource,[...propertyNames,...callbackNames,'appThemeScheme','mounted','temporaryBackIdentity','resetMessage',
      'onSnapshotChanged','syncSnapshotValues','onCacheCleanupChanged','applyCacheCleanup',
      'buildHome','navRow','operationFeedback','recovery','feedbackMessage','recoveryActionIdentities','recoveryActionKind',
      'recoveryActionGeneration','recoveryActionLabel','recoveryActionCurrent','dispatchRecoveryAction'],
      {readerRecoveryView,isReaderProductSurfaceEnabled},props);
    page.mounted=true;page.temporaryBackIdentity='return-native:'+instance;page.resetMessage='';
    page.buildHome();
    const row=sdk.walk(page).find(child=>child instanceof sdk.deps.CategoryRow&&child.label==='书源管理');
    assert.ok(row,'actual Settings buildHome mounts Source row in the production CategorySection/Card');
    const hit=sdk.nodes(row).find(node=>node.type==='Row'&&typeof node.onClick==='function');
    assert.ok(hit,'actual CategoryRow native click');
    assert.equal(hit.constraintSize.minHeight,58,'original row geometry');
    return{props,page,click:hit.onClick};
  };
  const idle=async()=>{await settle();await i.settingsHost.orchestrator?.operationChain;await i.sourceHost.orchestrator?.operationChain;await settle();};
  return{f,i,calls,platformReads,params,home,idle};
}

let cases=0;
{
  const n=navigation(),{i}=n;
  i.openSettings();await n.idle();const first=n.home(),firstIdentity=i.settingsPresentationIdentity;
  first.click();assert.equal(i.route,'source');await n.idle();
  const firstSource=n.params('source'),sourceGeneration=i.navigationGeneration;
  firstSource.onBack();assert.equal(i.route,'settings');assert.equal(i.settingsSection,'home');
  assert.equal(i.navigationGeneration,sourceGeneration+1,'actual return retires the previous navigation');
  const second=n.home(),returnedIdentity=i.settingsPresentationIdentity;
  second.click();
  assert.equal(i.route,'source','fresh Settings native Source row must navigate after actual Source→Settings return');
  assert.ok(returnedIdentity.length>0,'return synchronously establishes a new attachment');
  assert.notEqual(returnedIdentity,firstIdentity,'return never revives the old identity');
  await n.idle();assert.equal(n.calls.filter(call=>call.method==='source.list').length,2);
  const current={route:i.route,generation:i.navigationGeneration,identity:i.sourcePresentationIdentity};
  first.click();second.click();firstSource.onBack();
  assert.deepEqual({route:i.route,generation:i.navigationGeneration,identity:i.sourcePresentationIdentity},current,
    'both old Settings physical rows and old Source Back reject without a new route');
  i.returnToSettings();await n.idle();const live=n.home(),settingsIdentity=i.settingsPresentationIdentity;
  live.props.onSectionChange('general');assert.equal(i.settingsSection,'general');
  first.props.onSectionChange('home');assert.equal(i.settingsSection,'general','old section callback cannot mutate the new visit');
  i.settingsPresentationIdentity='';live.click();assert.equal(i.route,'settings','empty attachment cannot be bypassed');
  i.settingsPresentationIdentity=settingsIdentity;live.click();assert.equal(i.route,'source');
  i.returnToSettings();assert.equal(i.settingsSection,'general','return preserves the existing section rather than calling openSettings to reset it');
  await n.idle();assert.equal(n.f.events.filter(event=>event[0]==='put').length,0,'navigation does not save settings');
  assert.ok(n.platformReads.length>0,'actual cache reconciliation reads only the fixed local intent');cases++;
}
{
  const n=navigation(),{i}=n;i.openSettings();await n.idle();n.home().click();await n.idle();
  const gate=deferred(),getsBefore=n.f.events.filter(event=>event[0]==='get').length;
  n.f.hangRead(gate);i.returnToSettings();
  const identity=i.settingsPresentationIdentity;
  assert.ok(identity.length>0,'bind is synchronous before the asynchronous preferences reload');
  assert.equal(i.settingsHost.isPresentationCurrent(n.f.runtime,identity),true);
  await settle();
  assert.ok(n.f.events.filter(event=>event[0]==='get').length>getsBefore,'actual Preferences read has begun and is held before reply');
  const returned=n.home(),prior=structuredClone(i.settingsSnapshot);returned.click();assert.equal(i.route,'source');
  gate.resolve();await n.idle();assert.deepEqual(i.settingsSnapshot,prior,'late Settings read cannot publish into Source');
  assert.equal(i.settingsHost.isPresentationCurrent(n.f.runtime,identity),false,'route change retires its pending load');cases++;
}
for(const retirement of ['runtime','mount','closed']){
  const n=navigation(),{i}=n;i.openSettings();await n.idle();n.home().click();await n.idle();
  const gate=deferred(),getsBefore=n.f.events.filter(event=>event[0]==='get').length;
  n.f.hangRead(gate);i.returnToSettings();await settle();
  assert.ok(n.f.events.filter(event=>event[0]==='get').length>getsBefore,'return read is actually in flight');
  const returned=n.home(),before={route:i.route,generation:i.navigationGeneration,identity:i.settingsPresentationIdentity},
    snapshot=structuredClone(i.settingsSnapshot),operation=structuredClone(i.settingsOperation),sourceReads=n.calls.length;
  if(retirement==='runtime')n.f.retire();
  if(retirement==='mount')i.detailShelfAdmissionMount++;
  if(retirement==='closed')i.shelfReceiptRetired=true;
  returned.click();returned.props.onSectionChange('general');
  assert.deepEqual({route:i.route,generation:i.navigationGeneration,identity:i.settingsPresentationIdentity},before,
    retirement+' rejects actual native navigation without reacquiring a new identity');
  assert.equal(i.settingsSection,'home');
  gate.resolve();await n.idle();
  assert.equal(n.calls.length,sourceReads,retirement+' admits no new Core request');
  assert.deepEqual(i.settingsSnapshot,snapshot,retirement+' late Preferences reply cannot publish values');
  assert.deepEqual(i.settingsOperation,operation,retirement+' late Preferences reply cannot publish completion');cases++;
}
{
  const tree=ts.createSourceFile('/tmp/SettingsReturnMutation.ets',indexSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS);
  const method=tree.statements.find(node=>node.members?.some(member=>member.name?.getText(tree)==='returnToSettings'))
    .members.find(member=>member.name?.getText(tree)==='returnToSettings');
  const original=method.getText(tree),mutated=original.replace('this.bindSettingsPresentation()','false');
  assert.notEqual(mutated,original,'negative control removes only the production return attachment');
  const broken=indexSource.slice(0,method.getStart(tree))+mutated+indexSource.slice(method.end);
  const n=navigation(broken);n.i.openSettings();await n.idle();n.home().click();await n.idle();
  n.params('source').onBack();const stale=n.home();stale.click();
  assert.equal(n.i.route,'settings','omitting return bind reproduces the target silent navigation refusal');
  assert.equal(n.i.settingsPresentationIdentity,'');cases++;
}
console.log(`PASS ${cases} actual SettingsHost/SourceHost→Index production navigation→SDK Settings/CategorySection/Card/CategoryRow groups: round trip, synchronous attachment before async read, retained section, old physical/generation/identity rejection, no writes and missing-bind negative control.`);

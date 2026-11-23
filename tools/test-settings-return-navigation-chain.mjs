import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import { formatDownloadStorageBytes } from '../entry/src/main/ets/features/downloads/presentation/SharedDownloadProjection.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, stripTypeScriptTypes} from 'node:module';
import {fixture, deferred, settle} from './lib/general-settings-persistence-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {cardSdk} from './lib/reader-card-probe.mjs';
import {ReaderNativeAlertOwner} from './lib/reader-native-alert-sdk-probe.mjs';
import {readerRecoveryView} from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import {isReaderProductSurfaceEnabled} from '../entry/src/main/ets/app/ReaderProductScope.ts';
import {ReaderNavigation} from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';

const read=path=>readFileSync(new URL('../entry/src/main/ets/'+path,import.meta.url),'utf8');
const indexSource=read('pages/Index.ets'), pageSource=read('features/settings/ui/SettingsPage.ets');
const sourceNavigationPath='app/composition/ReaderSourceJourney.ts';
const sourceNavigationSource=read(sourceNavigationPath);
const sdkRoot=resolveEtsLoaderRoot();
const require=createRequire(import.meta.url), ts=require(sdkRoot+'/node_modules/typescript');
const syntax=require(sdkRoot+'/lib/validate_ui_syntax.js');
const ordinary=text=>stripTypeScriptTypes(text
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'')
  .replace(/^@Observed\s*$/gm,'')
  .replace(/^export (?:type )?\{[\s\S]*?\} from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''),{mode:'transform'});
const load=(path,result,deps={},text=read(path))=>new Function(...Object.keys(deps),ordinary(text)+`;return ${result};`)(...Object.values(deps));
const indexMethods=['settingsNavigationPorts','sourceNavigationPorts','nextNavigationGeneration',
  'navigationOwner','route','navigationGeneration','directoryReturnTarget','publishNavigation','navigateTo','settingsSection',
  'setSettingsSection','onSearchVisibilityChanged','bookshelfModalVisible','settingsContent','openSettingsDestination',
  'sourceJourneyContent','sourceJourneySurface',
  'registerTemporaryBackBridge','isCurrentRuntime','isCurrentRoute','currentReadingRuntime',
  'onBackPress','dispatchBackDestination','retireSourceSwitchPresentation'];

// The former Settings consumer fixture binds manually before rendering and
// substitutes the route methods with counters. Keep that suite's assertions;
// this separate contract instead invokes the unchanged production navigation.
class PagePayload {
  constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}
  updateStateVars(params){Object.assign(this.params,params);}
}
let instance=0;
function navigation(sourceText=sourceNavigationSource){
  const f=fixture(), context=f.runtime.getUIAbilityContext(), platformReads=[];
  context.filesDir='/settings-return-test-no-real-files';
  f.runtime.readSettingsTextCleanup=async()=>undefined;
  const facts=load('app/ReaderOperationFacts.ts','{projectOperationFacts,projectCommitReadback}');
  const receipt=load('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
  const common={ReaderRuntimeOwner:f.Runtime,ReaderWriteEvidence:f.Write.ReaderWriteEvidence,...facts,projectPersistedReceipt:receipt,
    hilog:{error(){},warn(){},info(){}}};
  // Only official platform IO is substituted. A cache reconciliation reads an
  // absent intent through the actual fixed-domain Store/Gateway/owner, never a
  // dummy successful cache owner. No mutation/Atomic write is admitted here.
  const intents=load('features/reading/application/ReadingOperationIntents.ts','{CacheClearOperationIntentStore}',{
    ...common,fileIo:{async readText(path){platformReads.push(path);throw Object.assign(Error('ENOENT'),{code:13900002});}},
    replaceReaderAtomicSnapshot:async()=>{throw Error('Unexpected persistent write in return-navigation contract');},
    util:{generateRandomUUID(){throw Error('Unexpected mutation identity');}},isReaderCoreTransactionPendingError:()=>false});
  const CacheGateway=load('features/settings/application/SettingsCacheGateway.ts','SettingsCacheGateway',intents);
  const CacheOwner=load('features/settings/application/SettingsCacheCleanupOwner.ts','SettingsCacheCleanupOwner',{...common,formatDownloadStorageBytes,SettingsCacheGateway:CacheGateway});
  const createDefaultSettingsSnapshot=load('features/settings/application/SettingsGateway.ts','createDefaultSettingsSnapshot');
  const SettingsOrchestrator=load('features/settings/application/SettingsOrchestrator.ets','SettingsOrchestrator',{
    ...common,SettingsGateway:f.Gateway,createDefaultSettingsSnapshot});
  const SettingsHost=load('features/settings/application/SettingsHost.ets','SettingsHost',{
    ...common,SettingsOrchestrator,SettingsCacheCleanupOwner:CacheOwner});
  const http=load('platform/network/HttpTransportPolicy.ts','{httpUrlHostname,isPrivateNetworkTarget}');
  const category=load('features/source/application/ReaderSourceCategory.ts','{classifyReaderSource}');
  const errors=load('app/ErrorMessage.ts','{errorMessageOf}');
  const SourceGateway=load('features/source/application/SourceGateway.ts','SourceGateway',{
    ...common,...http,...category,...errors,isReaderCoreTransactionPendingError:()=>false});
  const SourceOrchestrator=load('features/source/application/SourceOrchestrator.ets','SourceOrchestrator',{
    ...common,...errors,SourceGateway,isReaderCoreTransactionPendingError:()=>false});
  const SourceHost=load('features/source/application/SourceHost.ets','SourceHost',{...common,SourceOrchestrator,SourceGateway});
  const SettingsPresentation=load('features/settings/presentation/SettingsPresentation.ets','SettingsPresentation',{
    SettingsHost,createDefaultSettingsSnapshot,AppStorage:{setOrCreate(){}},
  });
  const SourceJourneyPresentation=load('features/source/presentation/SourceJourneyPresentation.ets','SourceJourneyPresentation',{
    SourceHost,EMPTY_SOURCE_TOOLS_SNAPSHOT:{},
  });
  const SettingsJourney=load('app/composition/ReaderSettingsJourney.ts','ReaderSettingsJourney');
  const SourceJourney=load(sourceNavigationPath,'ReaderSourceJourney',{},sourceText);
  const calls=[];
  Object.assign(f.runtime,{supportsCoreCapability:()=>false,
    bookAcquisitions:()=>({visibilityChanged(){},setPreparationVisible(){}}),async request(method,params={},options={}){
    assert.notEqual(options.canDispatch?.(),false,'actual current native RPC admission');
    assert.notEqual(options.canContinue?.(),false,'actual current reply admission');
    options.onDispatch?.();calls.push({method,params:structuredClone(params)});
    if(method==='source.list')return{data:{sources:[{sourceId:'source-a',name:'A',baseUrl:'https://a.test',enabled:true,enabledExplore:false,category:'text'}]}};
    if(method==='runtime.status')return{data:{pendingHostOperationCount:0}};
    throw Error('Unexpected Core mutation/read: '+method);
  }});
  const composition=cardSdk();
  composition.hooks.childSources.SettingsPage=pageSource;
  composition.hooks.childSources.BookshelfSettingsPage=read('features/bookshelf/ui/BookshelfSettingsPage.ets');
  composition.hooks.childSources.SourceManagementPage=read('features/source/ui/SourceManagementPage.ets');
  composition.hooks.childSources.SourceToolsPage=read('features/source/ui/SourceToolsPage.ets');
  const deps={...composition.deps,ReaderRuntimeOwner:f.Runtime,ReaderNavigation,SourceJourneyPresentation,
    SettingsPage:PagePayload,BookshelfSettingsPage:PagePayload,SourceManagementPage:PagePayload,SourceToolsPage:PagePayload};
  for(const [name,path] of [['SettingsScenes','app/composition/SettingsScenes.ets'],
    ['SourceJourneySurface','features/source/ui/SourceJourneySurface.ets']]){
    const source=read(path);
    composition.hooks.childSources[name]=source;
    deps[name]=createReaderBuilderProbe(source,boundedMembers(source),deps,composition.hooks).Component;
  }
  const i=createReaderBuilderProbe(indexSource,indexMethods,deps,composition.hooks).owner;
  const retiredSurface={retire(){}};
  const settings=new SettingsPresentation(),source=new SourceJourneyPresentation();
  Object.assign(i,{rssInstanceIdentity:++instance,detailShelfAdmissionMount:1,mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,
    settingsPresentation:settings,sourceJourney:source,nativeAlertOwner:new ReaderNativeAlertOwner(),
    shelfMotion:{clear(){},visibilityChanged(){}},transientFeedback:{reset(){}},
    libraryAcquisition:{currentOwner:()=>f.current(),visibilityChanged(){}},librarySearch:{host:{visibilityChanged(){}}},
    readingEntry:{retire(){},endReading(){},shelfPreparationVisibilityChanged(){}},
    readingEntryActions:{retirePreparation(){},refreshDetailAcquisition(){},shelfPreparing:false},readingExitActions:{navigationSettled(){}},
    bookRemovalConfirmation:{dismiss(){},isOpen:()=>false},jsonImportPresentation:{dismiss(){},opening:undefined},
    mangaSourceSwitch:{selectionVisible:false},sourceSwitchPresentation:{visible:false},
    shelfMutations:{snapshot:{},retireSelection(){}},shelfGroupPresentation:{identity:'',retire(){},back:()=>false},
    downloadPresentation:retiredSurface,readingCommits:retiredSurface,sourceSwitchJourney:retiredSurface,
    rssJourney:retiredSurface,shelfCatalog:retiredSurface,shelfManagement:retiredSurface,
    discoverPresentation:retiredSurface,rulesPresentation:retiredSurface,syncPresentation:retiredSurface,
    expandedLayout:()=>false});
  i.settingsNavigation=new SettingsJourney(i.navigationOwner,i.settingsNavigationPorts());
  i.sourceNavigation=new SourceJourney(i.navigationOwner,i.sourceNavigationPorts());
  const params=kind=>{
    if(kind==='settings')i.settingsContent('settings');
    else i.sourceJourneyContent(false);
    const key=kind==='settings'?'snapshot':'sources';
    const page=composition.walk(i).flatMap(owner=>[...owner.children.values()])
      .findLast(child=>child instanceof PagePayload&&Object.hasOwn(child.params,key));
    assert.ok(page,`actual ${kind} scene publishes its page parameters`);
    return page.params;
  };
  const home=()=>{
    const props=params('settings'), sdk=cardSdk();
    for(const [name,path]of [['CategorySection','features/settings/ui/CategorySection.ets']]){
      const source=read(path);sdk.hooks.childSources[name]=source;syntax.builderParamObjectCollection.set(name,new Set(['content']));
      sdk.deps[name]=createReaderBuilderProbe(source,boundedMembers(source),sdk.deps,sdk.hooks).Component;
    }
    const propertyNames=[...pageSource.matchAll(/@Prop\s+(?:@Watch\([^\n]+?\)\s+)?(\w+)\s*:/g)].map(m=>m[1]);
    const callbackNames=[...pageSource.matchAll(/^  (on\w+):/gm)].map(m=>m[1]);
    const page=sdk.consumer(pageSource,[...propertyNames,...callbackNames,'appThemeScheme','mounted','themeOwner','temporaryBackIdentity','resetMessage',
      'onSnapshotChanged','syncSnapshotValues','onCacheCleanupChanged',
      'buildHome','navRow','operationFeedback','recovery','feedbackMessage','recoveryActionIdentities','recoveryActionKind',
      'recoveryActionGeneration','recoveryActionLabel','recoveryActionCurrent','dispatchRecoveryAction'],
      {ReaderRuntimeOwner:f.Runtime,readerRecoveryView,isReaderProductSurfaceEnabled},props);
    page.mounted=true;page.themeOwner=f.runtime;page.temporaryBackIdentity='return-native:'+instance;page.resetMessage='';
    page.buildHome();
    const hit=sdk.nodes(page).find(node=>node.type==='Button'&&node.accessibilityText==='书源管理');
    assert.ok(hit,'actual Settings buildHome mounts one native Source action in the production CategorySection/Card');
    assert.equal(hit.constraintSize.minHeight,58,'original row geometry');
    const disclosure=sdk.nodes(page).find(node=>node.type==='Image'&&node.create==='app.media.reader_chevron_right');
    assert.deepEqual([disclosure?.width,disclosure?.height,disclosure?.accessibilityLevel],[14,14,'no']);
    return{props,page,click:hit.onClick};
  };
  const idle=async()=>{await settle();await settings.host?.orchestrator?.operationChain;await source.registry.orchestrator?.operationChain;await settle();};
  return{f,i,settings,source,calls,platformReads,params,home,idle};
}

let cases=0;
{
  const n=navigation(),{i,settings,source}=n;
  i.settingsNavigation.openSettings();await n.idle();const first=n.home(),firstIdentity=settings.identity;
  first.click();assert.equal(i.route,'source');await n.idle();
  const firstSource=n.params('source'),sourceGeneration=i.navigationGeneration;
  firstSource.onBack();assert.equal(i.route,'settings');assert.equal(i.settingsSection,'home');
  assert.equal(i.navigationGeneration,sourceGeneration+1,'actual return retires the previous navigation');
  const second=n.home(),returnedIdentity=settings.identity;
  second.click();
  assert.equal(i.route,'source','fresh Settings native Source row must navigate after actual Source→Settings return');
  assert.ok(returnedIdentity.length>0,'return synchronously establishes a new attachment');
  assert.notEqual(returnedIdentity,firstIdentity,'return never revives the old identity');
  await n.idle();assert.equal(n.calls.filter(call=>call.method==='source.list').length,2);
  const current={route:i.route,generation:i.navigationGeneration,identity:source.managementIdentity()};
  first.click();second.click();firstSource.onBack();
  assert.deepEqual({route:i.route,generation:i.navigationGeneration,identity:source.managementIdentity()},current,
    'both old Settings physical rows and old Source Back reject without a new route');
  i.settingsNavigation.returnToSettings();await n.idle();const live=n.home(),settingsIdentity=settings.identity;
  live.props.onSectionChange('general');assert.equal(i.settingsSection,'general');
  first.props.onSectionChange('home');assert.equal(i.settingsSection,'general','old section callback cannot mutate the new visit');
  live.click();assert.equal(i.route,'settings','old home row cannot navigate before section props are updated');
  assert.equal(settings.identity,settingsIdentity,'section change retains the current settings attachment');
  i.settingsNavigation.returnToSettings();assert.equal(i.settingsSection,'general','return preserves the section instead of reopening Settings home');
  const newIdentity=settings.identity;
  assert.notEqual(newIdentity,settingsIdentity);
  assert.equal(i.onBackPress(),true);assert.equal(i.settingsSection,'home','general Back returns to Settings home');
  assert.equal(settings.identity,newIdentity,'general Back does not rebind the Settings visit');
  await n.idle();assert.equal(n.f.events.filter(event=>event[0]==='put').length,0,'navigation does not save settings');
  assert.ok(n.platformReads.length>0,'actual cache reconciliation reads only the fixed local intent');cases++;
}
{
  const n=navigation(),{i,settings}=n;i.settingsNavigation.openSettings();await n.idle();n.home().click();await n.idle();
  const gate=deferred(),getsBefore=n.f.events.filter(event=>event[0]==='get').length;
  n.f.hangRead(gate);i.settingsNavigation.returnToSettings();
  const identity=settings.identity;
  assert.ok(identity.length>0,'bind is synchronous before the asynchronous preferences reload');
  assert.equal(settings.isCurrent(identity),true);
  await settle();
  assert.ok(n.f.events.filter(event=>event[0]==='get').length>getsBefore,'actual Preferences read has begun and is held before reply');
  const returned=n.home(),prior=structuredClone(settings.snapshot);returned.click();assert.equal(i.route,'source');
  gate.resolve();await n.idle();assert.deepEqual(settings.snapshot,prior,'late Settings read cannot publish into Source');
  assert.equal(settings.isCurrent(identity),false,'route change retires its pending load');cases++;
}
for(const retirement of ['runtime','mount','closed']){
  const n=navigation(),{i,settings}=n;i.settingsNavigation.openSettings();await n.idle();n.home().click();await n.idle();
  const gate=deferred(),getsBefore=n.f.events.filter(event=>event[0]==='get').length;
  n.f.hangRead(gate);i.settingsNavigation.returnToSettings();await settle();
  assert.ok(n.f.events.filter(event=>event[0]==='get').length>getsBefore,'return read is actually in flight');
  const returned=n.home(),before={route:i.route,generation:i.navigationGeneration,identity:settings.identity},
    snapshot=structuredClone(settings.snapshot),operation=structuredClone(settings.operation),sourceReads=n.calls.length;
  if(retirement==='runtime')n.f.retire();
  if(retirement==='mount')i.detailShelfAdmissionMount++;
  if(retirement==='closed')i.shelfReceiptRetired=true;
  returned.click();returned.props.onSectionChange('general');
  assert.deepEqual({route:i.route,generation:i.navigationGeneration,identity:settings.identity},before,
    retirement+' rejects actual native navigation without reacquiring a new identity');
  assert.equal(i.settingsSection,'home');
  gate.resolve();await n.idle();
  assert.equal(n.calls.length,sourceReads,retirement+' admits no new Core request');
  assert.deepEqual(settings.snapshot,snapshot,retirement+' late Preferences reply cannot publish values');
  assert.deepEqual(settings.operation,operation,retirement+' late Preferences reply cannot publish completion');cases++;
}
for(const changedKey of ['reduceMotion','developerMode'])for(const failure of ['before','after']){
  const n=navigation(),{i,settings}=n;i.settingsNavigation.openSettings();await n.idle();const initial=n.home();
  n.f.fail(failure);settings.toggle(settings.identity,changedKey,true);await n.idle();
  const owner=settings.host.orchestrator,original=owner.gateway.writeFacts(),writeGeneration=owner.writeGeneration,
    originalReceiptGeneration=settings.operation.receipt.facts.generation;
  assert.equal(settings.snapshot[changedKey],true,'real owner keeps the accepted switch value');
  assert.equal(settings.operation.receipt.receipt.confirmation,'unknown');
  assert.equal(n.f.disk.get(changedKey),failure==='after','fixture distinguishes not-durable and durable-with-lost-ACK flush');
  assert.equal(original.pendingReconciliation,true);assert.equal(original.acceptedRevision,1);assert.equal(original.savedRevision,0);
  const writes=()=>n.f.events.filter(event=>event[0]==='put'||event[0]==='flush');
  const dispatched=structuredClone(writes());
  assert.deepEqual(dispatched.filter(event=>event[0]==='put').map(event=>event[1]),
    ['autoCheckUpdate','tapBottomScrollTop','reduceMotion','crashLog','developerMode','wideNavigationRail']);
  assert.equal(dispatched.filter(event=>event[0]==='flush').length,1);
  const pending=n.home();pending.click();assert.equal(i.route,'source');await n.idle();
  const sourcePage=n.params('source');sourcePage.onBack();assert.equal(i.route,'settings');
  assert.equal(settings.host.orchestrator,owner,'return attaches the original exact Runtime owner');
  assert.equal(settings.operation.receipt.receipt.confirmation,'unknown','synchronous bind does not qualify the missing flush ACK');
  await n.idle();
  assert.equal(settings.snapshot[changedKey],true);assert.equal(settings.operation.action,changedKey);
  assert.equal(settings.operation.receipt.receipt.confirmation,'unknown','open/read cannot promote cached accepted values to durable');
  assert.equal(settings.operation.receipt.facts.fact,'pendingReconciliation');
  assert.ok(settings.operation.receipt.facts.generation>originalReceiptGeneration,'new presentation gets a fresh projection generation');
  assert.deepEqual(owner.gateway.writeFacts(),original,'original accepted/saved revision, action and snapshot identity stay unchanged');
  assert.equal(owner.writeGeneration,writeGeneration,'navigation does not allocate a replacement write');
  assert.equal(settings.operation.canRetryAccepted,true,'the existing explicit same-snapshot recovery remains available without invoking it');
  const returned=n.home(),before={route:i.route,generation:i.navigationGeneration,identity:settings.identity};
  initial.click();pending.click();sourcePage.onBack();initial.props.onToggle(changedKey,false);
  assert.deepEqual({route:i.route,generation:i.navigationGeneration,identity:settings.identity},before,
    'old physical navigation and old accepted setter cannot borrow the new visit');
  returned.click();assert.equal(i.route,'source','fresh native navigation stays usable while the save remains unknown');
  await n.idle();assert.deepEqual(writes(),dispatched,'return/open/navigation issue no extra put or flush and no compensation');
  assert.deepEqual(owner.gateway.writeFacts(),original);cases++;
}
{
  const tree=ts.createSourceFile(sourceNavigationPath,sourceNavigationSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const method=tree.statements.find(node=>node.name?.getText(tree)==='ReaderSourceJourney')
    .members.find(member=>member.name?.getText(tree)==='returnFromManagement');
  const original=method.getText(tree),mutated=original.replace("this.ports.settings().openPresentation('settings');",'');
  assert.notEqual(mutated,original,'negative control removes only the production return attachment');
  const broken=sourceNavigationSource.slice(0,method.getStart(tree))+mutated+sourceNavigationSource.slice(method.end);
  const n=navigation(broken);n.i.settingsNavigation.openSettings();await n.idle();
  const old=n.home();
  old.click();await n.idle();
  n.params('source').onBack();old.click();
  assert.equal(n.i.route,'settings','omitting return binding leaves the old row unable to navigate');
  assert.equal(n.settings.identity,'','SettingsScenes has no current identity to mount');cases++;
}
console.log(`PASS ${cases} actual Settings/Source presentations and navigation→SDK SettingsScenes/SourceJourneySurface/SettingsPage groups: round trip, synchronous attachment before async read, retained section, old physical/generation/identity rejection, before/after flush lost-ACK retained unknown/accepted write identity with no replay, no navigation writes and missing-bind negative control.`);

import { createIndexProductBuilderProbe, extendedProductSurfaceSdk, productSurfaceDescendants } from './lib/reader-extended-product-surface-probe.mjs';
import { projectOperationFacts } from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { MAIN_TAB_LABEL_LINE_HEIGHT } from '../entry/src/main/ets/features/common/ReaderLayoutTokens.ts';
import * as horizontalGeometry from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import * as metrics from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { readerFloatingTabBottomInset } from './lib/reader-floating-bar-metrics-probe.mjs';

import {
  READER_PRODUCT_PROFILE,
  isReaderMainTabEnabled,
  isReaderProductSurfaceEnabled,
} from '../entry/src/main/ets/app/ReaderProductScope.ts';

assert.equal(READER_PRODUCT_PROFILE, 'l0');
assert.equal(isReaderMainTabEnabled('bookshelf'), true);
assert.equal(isReaderMainTabEnabled('settings'), true);
assert.equal(isReaderMainTabEnabled('discover'), false);
assert.equal(isReaderMainTabEnabled('rss'), false);
assert.equal(isReaderMainTabEnabled('unknown'), false);

for (const surface of ['discover', 'rss', 'sync', 'unimplementedSettings']) {
  assert.equal(isReaderProductSurfaceEnabled(surface), false,
    `${surface} must remain outside the default L0 product surface`);
}

const root = new URL('../entry/src/main/ets/', import.meta.url);
const mainTabs = await readFile(new URL('features/shell/MainTabBar.ets', root), 'utf8');
const bookshelf = await readFile(new URL('features/bookshelf/BookshelfPage.ets', root), 'utf8');
const bookshelfShell = await readFile(new URL('features/bookshelf/BookshelfShell.ets', root), 'utf8');
const settings = await readFile(new URL('features/settings/SettingsPage.ets', root), 'utf8');
const index = await readFile(new URL('pages/Index.ets', root), 'utf8');

assert.doesNotMatch(bookshelf, /private tabletNavigation(?:Item)?\(/,
  'bookshelf content delegates navigation to the actual public owner');
const {ts,options}=installedEtsCompiler();
const windowMetrics = metrics.createDefaultReaderWindowMetrics();
windowMetrics.windowRect.width=393; windowMetrics.windowRect.height=852;
const windowPort={metrics:()=>windowMetrics};
const scale=pureModuleProbe(await readFile(new URL('features/common/ReaderSurfaceResolvers.ts',root),'utf8'),
  'ReaderSurfaceResolvers.ts',{},['readerScaledControlHeight']);
const floating=pureModuleProbe(await readFile(new URL('features/common/ReaderFloatingBarMetrics.ts',root),'utf8'),
  'ReaderFloatingBarMetrics.ts',{...metrics,...scale,MAIN_TAB_LABEL_LINE_HEIGHT},['readerMainTabItemHeight','readerFloatingTabBarHeight']);
const navigation=pureModuleProbe(await readFile(new URL('features/shell/MainNavigationSpec.ts',root),'utf8'),
  'MainNavigationSpec.ts',{...metrics,...floating,isReaderMainTabEnabled,ReaderWindowCoordinator:windowPort,AppStorage:{get:()=>undefined}},
  ['MAIN_TABS','MAIN_TAB_RAIL_ITEM_GAP','MAIN_TAB_RAIL_PADDING','MAIN_TAB_RAIL_WIDTH','mainTabBottomWidth','mainTabRailHeight','readerMainViewport']);
assert.deepEqual(navigation.MAIN_TABS.map(tab=>tab.key),['bookshelf','settings']);
// Shadow host is an explicit visual port: this check records actual tab
// closures, labels and actions; it does not claim Canvas shadow rasterization.
class ShadowHost { constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});} updateStateVars(params){this.params=params;} }
for(const vertical of[false,true]){
  const properties=createArkUIPropertyRuntimeProbe();
  const {owner}=createReaderBuilderProbe(mainTabs,boundedMembers(mainTabs),
    {...properties.sdk,...metrics,...horizontalGeometry,...floating,...navigation,readerFloatingTabBottomInset,
      ReaderWindowCoordinator:windowPort,AppStorage:{get:()=>undefined},ReaderRaisedSurface:ShadowHost},
    {...properties.hooks,childSources:{ReaderRaisedSurface:await readFile(new URL('features/common/ReaderRaisedSurface.ets',root),'utf8')}});
  const selected=[],current=[];
  Object.assign(owner,{vertical,current:'bookshelf',appThemeScheme:'day',onSelect:key=>selected.push(key),onCurrentTap:key=>current.push(key)});
  owner.initialRender();
  const nodes=[...owner.nodes.values()];
  assert.deepEqual(nodes.filter(node=>node.type==='Text').map(node=>node.create),['书架','设置'],
    'actual bottom/rail navigation renders only the admitted product tabs');
  for(const node of nodes.filter(node=>node.type==='Column'&&typeof node.onClick==='function'))node.onClick();
  assert.deepEqual(selected,['settings']);assert.deepEqual(current,['bookshelf']);
}


// Execute the real nested settings Builders. Implemented reset/preferences are
// permitted; only currently unimplemented destinations must follow admission.
class SectionHost extends ShadowHost { initialRender(){this.params.content();} }
for(const enabled of[false,true]){
  const rows=[],profile=surface=>enabled;
  const {owner}=createReaderBuilderProbe(settings,['buildHome','preferenceCard','behaviorCard'],
    {CategorySection:SectionHost,isReaderProductSurfaceEnabled:profile},
    {mountChildren:true,childSources:{CategorySection:await readFile(new URL('features/settings/CategorySection.ets',root),'utf8')}});
  Object.assign(owner,{temporaryBackIdentity:'settings:1',originalSyncReadFailed:false,originalSyncOperationId:'',
    operationFeedback(){},segmentRow(label){rows.push(label);},selectRow(_label,_icon,key){rows.push(key);},
    switchRow(_label,_icon,key){rows.push(key);},navRow(label){rows.push(label);},cacheActionRow(){rows.push('cache');}});
  owner.buildHome();owner.preferenceCard();owner.behaviorCard();
  for(const key of['language','startup','tapBottomScrollTop','crashLog','animation','同步与备份','关于与反馈'])
    assert.equal(rows.includes(key),enabled,`${key} follows the actual selected product scope`);
  for(const key of['App主题','autoCheckUpdate','reduceMotion','wideNavigationRail','书架设置','cache'])
    assert.ok(rows.includes(key),`${key} retains the implemented normal product entry`);
  owner.originalSyncOperationId='original-operation';owner.buildHome();
  assert.ok(rows.includes('继续原同步'),'closed new sync UI does not hide an original recovery entry');
}

console.log('reader product scope contract: PASS');

// Execute direct/recovery entry points with the real shipping profile. An empty
// receiver makes any state access or I/O before admission fail deterministically.
const ast=ts.createSourceFile('Index.ets',index,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
assert.deepEqual(ast.parseDiagnostics,[]);
const indexClass=ast.statements.find(node=>node.name?.text==='Index');assert.ok(indexClass);
// Real SDK state declarations start empty. A forbidden getter cannot construct
// any optional presentation; an enabled getter creates just its own group once.
let constructions=[];
const defaults={projectOperationFacts,
  ...pureModuleProbe(await readFile(new URL('features/discover/DiscoverOrchestrator.ets',root),'utf8'),'DiscoverOrchestrator.ets',{},['EMPTY_DISCOVER_PRESENTATION']),
  ...pureModuleProbe(await readFile(new URL('features/rss/RssSubscriptionEditorOrchestrator.ets',root),'utf8'),'RssSubscriptionEditorOrchestrator.ets',{projectOperationFacts},['EMPTY_RSS_EDITOR_SNAPSHOT'])};
const models=pureModuleProbe(await readFile(new URL('app/ReaderExtendedProductPresentation.ets',root),'utf8'),
  'ReaderExtendedProductPresentation.ets',defaults,['ReaderRssProductPresentation','ReaderDiscoverProductPresentation','ReaderSyncProductPresentation']);
const classes=Object.fromEntries(['Rss','Discover','Sync'].map(name=>{const type='Reader'+name+'ProductPresentation';return[type,class extends models[type] {constructor(){super();constructions.push(name);}}];}));
const selectedState=['rssProduct','discoverProduct','syncProduct','rssUi','discoverUi','syncUi'];
const stateFixture=profile=>{const properties=createArkUIPropertyRuntimeProbe();return createReaderBuilderProbe(index,selectedState,{...properties.sdk,...classes,isReaderProductSurfaceEnabled:profile},properties.hooks).owner;};
const shipping=stateFixture(isReaderProductSurfaceEnabled);
for(const group of['rss','discover','sync']){
  assert.equal(shipping[group+'Product'],undefined);
  assert.throws(()=>shipping[group+'Ui'](),/READER_PRODUCT_SURFACE_CLOSED/);
  assert.equal(shipping[group+'Product'],undefined);
}
assert.deepEqual(constructions,[],'L0 owns no optional presentation instance');
const extended=stateFixture(()=>true);
for(const group of['rss','discover','sync'])assert.equal(extended[group+'Ui'](),extended[group+'Ui']());
assert.deepEqual(constructions,['Rss','Discover','Sync'],'enabled presentation groups are lazy and stable per owner');
{
 const properties=createArkUIPropertyRuntimeProbe();
 const composition=extendedProductSurfaceSdk({...properties.sdk,...classes,isReaderProductSurfaceEnabled:()=>true,RssPage:ShadowHost},properties.hooks);
 const {owner}=createReaderBuilderProbe(index,['rssProduct','rssUi','rssPageSurface','expandedLayout'],composition.dependencies,composition.hooks);
 owner.readerWindowMetricsRevision=-1;
 owner.rssPageSurface(1,undefined,1,undefined,'fixture');
 const child=productSurfaceDescendants(owner).find(child=>child instanceof ShadowHost);assert.ok(child);assert.equal(child.params.presentation.subscriptions.length,0);
 owner.rssUi().rssPresentation={kind:'feed',subscriptions:[{subscriptionId:'admitted'}],recentUnread:[]};
 properties.flush();assert.equal(child.params.presentation.subscriptions[0].subscriptionId,'admitted',
   'actual SDK state read crosses the real optional composition Prop and updates the same leaf page');
 assert.equal(productSurfaceDescendants(owner).find(c=>c instanceof ShadowHost),child);
}

// Every optional branch maps the actual current presentation and passes the
// original captured callback by identity. No native wrapper is inserted.
const surfaces=[['discover','discoverEvents','discover'],['sync','syncEvents','sync'],['rss','rssEvents','rss'],
 ['rssEditor','rssEditorEvents','rss'],['rssSource','rssSourceEvents','rss'],['rssEntry','rssEntryEvents','rss'],['rssManagement','rssManagementEvents','rss']];
for(const [surface,events,group] of surfaces){
 const properties=createArkUIPropertyRuntimeProbe();
 const pages=['DiscoverPage','SyncPage','RssPage','RssSubscriptionEditorPage','RssSourceFeedPage','RssEntryDetailPage','RssSubscriptionManagementPage'];
 const composition=extendedProductSurfaceSdk({...properties.sdk,...Object.fromEntries(pages.map(name=>[name,ShadowHost]))},properties.hooks);
 const calls=[],back=()=>calls.push('back'),ports=new Proxy({onBack:back},{get:(target,key)=>target[key]??(()=>{})});
 const presentation=new models['Reader'+group[0].toUpperCase()+group.slice(1)+'ProductPresentation']();
 const owner=new composition.Surface(undefined,{surface,[group]:presentation,[events]:ports,expandedLayout:false,managementItems:[],presentationIdentity:'visit:7'});
 owner.initialRender();const leaf=productSurfaceDescendants(owner).find(c=>c instanceof ShadowHost);
 assert.ok(leaf,`${surface}: actual composition mounts its original page`);
 assert.deepEqual([...owner.nodes.values()].map(node=>node.type),['If',pages[surfaces.findIndex(row=>row[0]===surface)]],
   'only the conditional SDK actor and original page are recorded; no native wrapper');
 assert.equal(leaf.params.onBack,back,'callback identity is not replaced by a wrapper closure');
 leaf.params.onBack();assert.deepEqual(calls,['back']);
 if(surface==='rssEditor'){owner.presentationIdentity='visit:8';properties.flush();assert.equal(leaf.params.presentationIdentity,'visit:8');}
 else {owner.expandedLayout=true;properties.flush();assert.equal(leaf.params.expandedLayout,true,'same leaf receives updated presentation facts');}
 assert.equal(productSurfaceDescendants(owner).find(c=>c instanceof ShadowHost),leaf);
}


const guarded=indexClass.members.filter(member=>{
  const first=member.body?.statements[0],condition=first?.expression;
  return first&&ts.isIfStatement(first)&&condition&&ts.isPrefixUnaryExpression(condition)&&
    condition.operator===ts.SyntaxKind.ExclamationToken&&ts.isCallExpression(condition.operand)&&
    condition.operand.expression.getText(ast)==='isReaderProductSurfaceEnabled' &&
    !['rssUi','discoverUi','syncUi'].includes(member.name?.getText(ast));
}).map(member=>member.name.getText(ast));
// Preserve each of the original 38 direct/recovery entry contracts. Two now
// consume the real captured host guard rather than a duplicated first-line
// product check; they are executed below in both closed and admitted profiles.
const originalEntries=['openRss','openDiscover','onSyncSaveConfig','onSyncTestConnection','onSyncTriggerBackup','onSyncRestoreLatest','onSyncResolveRestore','openSync','refreshRss','onRssManage','onRssManagementViewArticles','onRssSubscriptionSelected','onRssSubscriptionAddRequested','onRssSubscriptionEditRequested','finishRssSubscriptionEdit','returnToRssSubscriptionManagement','requestRssSubscriptionDelete','requestRssSourceImport','importRssSources','exportRssSources','showRssOperationResult','confirmRssSubscriptionDelete','loadRssSourceItems','refreshRssSourceFeed','applyRssSourceSnapshot','onRssItemSelected','onRssSourceItemSelected','openRssEntryDetail','onRssEntryFavoriteRequested','applyRssEntrySnapshot','failRssEntryOperation','returnFromRssEntryDetail','returnToRssSourceFeed','returnFromRssSourceFeed','returnToRss','openRssManagementForSubscription','onRssOpenOriginalRequested','onRssModeRequested'];
const delegated=['importRssSources','confirmRssSubscriptionDelete'];
assert.equal(new Set(originalEntries).size,38);
for(const name of originalEntries){
  assert.ok(indexClass.members.some(member=>member.name?.getText(ast)===name),'original entry remains represented: '+name);
}
const closedMethods=[...new Set([...originalEntries.filter(name=>!delegated.includes(name)),...guarded])];
const Closed = productionMotionMethods(new URL('pages/Index.ets', root), closedMethods, {
  isReaderProductSurfaceEnabled,
});
for (const method of closedMethods) {
  const receiver = Object.create(null);
  await Closed.prototype[method].call(receiver);
  assert.deepEqual(Object.keys(receiver), [], `${method} cannot mutate a closed surface`);
}
{
  const runtime={},calls=[];
  const host={owns:owner=>owner===runtime,isPresentationCurrent:id=>id==='rss:1',
    importSources:(...args)=>calls.push(['import',...args]),removeSubscription:id=>calls.push(['delete',id])};
  const names=["rssUi",...delegated,'isCurrentRssHostPresentation','isCurrentRssPresentation','isCurrentRoute','rssSubscriptions'];
  const dependencies={ReaderRuntimeOwner:{isCurrent:owner=>owner===runtime}};
  const create=profile=>Object.assign(new (productionMotionMethods(new URL('pages/Index.ets',root),names,
    {...dependencies,isReaderProductSurfaceEnabled:profile}))(),{rssOrchestrator:host,readerWindowMetricsRevision:-1,mountedRuntimeOwner:runtime,detailShelfAdmissionMount:1,navigationGeneration:3,rssPresentationIdentity:'rss:1',shelfReceiptRetired:false,route:'rssSubscriptionManagement',rssProduct:{rssPresentation:{kind:'feed',subscriptions:[{subscriptionId:'subscription'}],recentUnread:[]}}});
  const closed=create(isReaderProductSurfaceEnabled),before=structuredClone(closed.rssProduct.rssPresentation);
  closed.importRssSources(false,'https://original.invalid/rss.json');closed.confirmRssSubscriptionDelete('subscription');
  assert.deepEqual(calls,[],'captured real host guard rejects both original entries in the shipping profile');
  assert.deepEqual(closed.rssProduct.rssPresentation,before,'closed delegated entry cannot publish a new state');
  const admitted=create(surface=>surface==='rss');
  admitted.importRssSources(false,'https://original.invalid/rss.json');admitted.confirmRssSubscriptionDelete('subscription');
  assert.deepEqual(calls.map(call=>call[0]),['import','delete'],'the same actual methods remain callable when the explicit profile is admitted');
  calls.length=0;admitted.rssPresentationIdentity='successor';
  admitted.importRssSources(false,undefined,host,'rss:1');admitted.confirmRssSubscriptionDelete('subscription',3,runtime,1,host,'rss:1');
  assert.deepEqual(calls,[],'old captured identity cannot borrow an admitted successor visit');
}
const closedRouteActorFiles={BookshelfMultiSelectPage:'features/bookshelf/BookshelfMultiSelectPage.ets',ReaderShell:'features/shell/ReaderShell.ets',
 ReaderLayoutDebugOverlay:'features/common/ReaderLayoutDebugOverlay.ets',ArkWebExecutionHost:'app/ArkWebExecutionHost.ets',ReaderTransientToast:'features/common/ReaderTransientToast.ets'};
const closedRouteChildSources=Object.fromEntries(await Promise.all(Object.entries(closedRouteActorFiles).map(async([name,path])=>[name,await readFile(new URL(path,root),'utf8')])));
// Restored/direct routes execute the actual dispatcher. A disabled product
// must not create the optional component or consult/allocate any optional UI.
for (const route of ['rss','rssSubscriptionManagement','rssSubscriptionEditor','rssSourceFeed','rssEntryDetail','discover','sync']) {
 const properties=createArkUIPropertyRuntimeProbe();
 const extra={...properties.sdk,...classes,isReaderProductSurfaceEnabled,
  ...Object.fromEntries(Object.keys(closedRouteActorFiles).map(name=>[name,ShadowHost]))};
 const {owner}=createIndexProductBuilderProbe(index,['rssProduct','discoverProduct','syncProduct',
  'indexContent','readerOwnsWindowEdges','mangaOwnsWindowEdges','appContentTopInset'],extra,{...properties.hooks,childSources:closedRouteChildSources});
 Object.assign(owner,{route,readerWindowMetricsRevision:-1,readingSessionActive:false,appThemeScheme:'day',
  retainsShelfOpeningBackground:()=>false,indexRecoveryNoticeContent:()=>{},
  rssUi:()=>assert.fail('closed RSS state read'),discoverUi:()=>assert.fail('closed Discover state read'),syncUi:()=>assert.fail('closed Sync state read')});
 owner.indexContent();
 for(const group of ['rss','discover','sync'])assert.equal(owner[group+'Product'],undefined);
 assert.equal(productSurfaceDescendants(owner).some(child=>child.params?.surface!==undefined),false,
  route+': actual route dispatch never mounts optional product composition');
}
// Development flow remains callable when its explicit scope is admitted.
const Open = productionMotionMethods(new URL('pages/Index.ets', root), ["syncUi",'onSyncTriggerBackup'], {
  isReaderProductSurfaceEnabled: surface => surface === 'sync',
});
let backups = 0;
Open.prototype.onSyncTriggerBackup.call({ getSyncOrchestrator: () => ({ triggerBackup: () => backups++ }) });
assert.equal(backups, 1);
console.log(`reader product scope direct/recovery boundary: all 38 original entries plus ${guarded.filter(name=>!originalEntries.includes(name)).length} new direct entries PASS; real delegated host/profile/identity guards executed`);

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';
import {mangaSurfaceSdkDependencies} from './lib/manga-surface-sdk-probe.mjs';
import {actualGeneralSettingsTypes,actualGeneralSettingsHostField} from './lib/general-settings-owner-probe.mjs';
import {actualSourceManagementTypes,actualSourceManagementHostField} from './lib/source-management-owner-probe.mjs';
import {actualBookshelfOperationTypes,actualBookshelfHostField} from './lib/bookshelf-operation-owner-probe.mjs';
import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
import {ReaderNativeAlertOwner} from './lib/reader-native-alert-sdk-probe.mjs';
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`),options=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`),map=require(`${sdk}/lib/component_map.js`);
const read=relative=>readFileSync(new URL(`../entry/src/main/ets/${relative}`,import.meta.url),'utf8');
const index=read('pages/Index.ets'),shell=read('features/shell/ReaderShell.ets'),panel=read('features/reading/SourceSwitchPanel.ets'),window=read('features/source/SourceSwitchWindow.ets');
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
function component(name,source){syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...source.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(row=>row[1])));}
component('ReaderShell',shell);component('MangaReadingSurface',read('features/manga/MangaReadingSurface.ets'));
component('SourceSwitchPanel',panel);component('SourceSwitchWindow',window);component('ArkWebExecutionHost','');
for(const name of ['ReadingExperience','ReaderFullDirectory','ReaderStatusBarPaper'])component(name,'');
const noOp=()=>{};
// This manga binding probe exercises the native identity branch only. Novel
// opacity/easing and full Window font admission have their actual SDK suites.
const transitionIdentity={kind:'identity'};
const runtimePort={supportsCoreCapability:()=>true},Runtime=runtimeOwnerIdentityProbe(()=>runtimePort);
const settingsTypes=actualGeneralSettingsTypes({ReaderRuntimeOwner:Runtime});
const sourceTypes=actualSourceManagementTypes({ReaderRuntimeOwner:Runtime});
const shelfTypes=actualBookshelfOperationTypes({ReaderRuntimeOwner:Runtime});
// Constructor inputs are copied from the actual selected component declarations.
// In particular, scope identity must come from Index's State initializer, not a
// fixture literal that bypasses the keyed overlay's real constructor.
function constructorFields(source,name,excluded=[]){
 const tree=ts.createSourceFile('/tmp/MangaEntryConstructor.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 const declaration=tree.statements.find(node=>node.name?.getText(tree)===name);
 assert.ok(declaration,`actual constructor ${name}`);
 return declaration.members.filter(ts.isPropertyDeclaration).map(member=>member.name.getText(tree)).filter(name=>!excluded.includes(name));
}
function reactiveBuilder(source,names,deps,hooks={}){
 const properties=createArkUIPropertyRuntimeProbe();
 return createReaderBuilderProbe(source,names,{...deps,...properties.sdk},{...properties.hooks,...hooks}).owner;
}
const sourceSwitchConstructorFields=['sourceSwitchScopeId','sourceSwitchVisible','sourceSwitchState','sourceSwitchFailureMessage',
 'mangaSourceSwitchSelectionVisible','mangaSourceSwitchSelectionBusy','mangaSourceSwitchCommitGeneration','directoryChapterTitle'];
const shellConstructorFields=constructorFields(shell,'ReaderShell',['mangaSettingsGateway']);
const panelConstructorFields=constructorFields(panel,'SourceSwitchPanel');
const retirementMembers=['retireSettingsPresentation','retireSourceManagementPresentation','retireSourceSwitchPresentation',
 'retireRssEditorPresentation','retireRssPresentation','retireReadingEntryPresentation','retireBookshelfCatalogPresentation',
 'bindReadingEntryReader','getReadingEntryHost','isCurrentRuntime','isKnownDetailChapter'];
function indexOwner(overrides={}){
 map.resetComponentMap();
 const tree=ts.createSourceFile('/tmp/MangaEntryIndex.ets',index,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 const localSource=tree.statements.filter(ts.isVariableStatement).flatMap(statement=>[...statement.declarationList.declarations])
  .find(declaration=>declaration.name.getText(tree)==='LOCAL_SOURCE_ID')?.initializer;
 assert.ok(localSource&&ts.isStringLiteral(localSource),'actual Index local-source constant');
 for(const statement of tree.statements)for(const member of statement.members??[])if(member.getText(tree).includes('@Builder'))map.CUSTOM_BUILDER_METHOD.add(member.name.getText(tree));
 const native=new Set(['Stack','Row','Column','Blank','Text','Button','Image','If','ForEach','Scroll']);
 const deps={...mangaSurfaceSdkDependencies,ReaderShell:Child,SourceSwitchPanel:Child,ArkWebExecutionHost:Child,
  deviceInfo:{deviceType:'phone'},ReaderRuntimeOwner:Runtime,LOCAL_SOURCE_ID:localSource.text,
  TransitionEffect:{IDENTITY:transitionIdentity}};
 const visit=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&/^[A-Z]/.test(node.expression.text)&&!native.has(node.expression.text)){
  const name=node.expression.text;if(!syntax.componentCollection.customComponents.has(name))component(name,'');deps[name]=Child;
 }ts.forEachChild(node,visit);};visit(tree);
 const owner=reactiveBuilder(index,[...sourceSwitchConstructorFields,'build','sourceSwitchOverlayContent','canCancelMangaSourcePreparation','nextNavigationGeneration','onDirectoryChapterSelected','directoryRecovery','directoryOperationBindingId','directoryOperationPresentationId',...retirementMembers],deps);
 Object.assign(owner,{route:'reading',readingSessionActive:true,readingContentKind:'manga',detailInBookshelf:false,
  detailBook:{sourceId:'source',bookId:'book',title:'Manga',author:'Author',contentKind:'manga'},detailToc:[{index:3,title:'First'},{index:7,title:'Next'}],
  requestedChapterIndex:3,mangaChapterRequestGeneration:4,mangaChapterStartRequestGeneration:4,navigationGeneration:2,
  mangaSourceSwitchCommitGeneration:-1,sourceSwitchVisible:false,sourceSwitchState:{kind:'switching'},mangaSourceSwitchSelectionVisible:false,
  directoryPresentationGeneration:0,detailShelfAdmissionMount:0,remoteSessionGeneration:0,directoryOperation:undefined,offlineOperation:undefined,settingsSnapshot:{reduceMotion:false},offlineMutationActiveKey:'',directoryReturnTarget:'readerControl',jsonImportVisible:false,
  currentSourceSwitchTransactionId:()=>undefined,detailBookmarkIdentity:()=>undefined,controlBookmarkProjectionMessage:()=>'',
  readerOwnsWindowEdges:()=>true,mangaOwnsWindowEdges:()=>true,appContentTopInset:()=>0,detailContent:noOp,
  directoryCurrentChapterIndex:3,mangaCommittedRequestGeneration:4,
  // This fixture proves SDK bindings without mounting a Runtime-owned reader.
  // Execute the actual absent-owner admission rather than a fake bind method.
  mountedRuntimeOwner:undefined,shelfReceiptRetired:false,settingsPresentationIdentity:'ui-settings',sourcePresentationIdentity:'ui-source',
  bookshelfManagementPresentationIdentity:'ui-management',nativeAlertOwner:new ReaderNativeAlertOwner(),
  sourceSwitchHost:undefined,readingEntryHost:undefined,bookshelfCatalogHost:undefined,bookshelfCatalogBinding:undefined,
  rssEditorOrchestrator:undefined,rssOrchestrator:undefined,discoverOrchestrator:undefined,rulesManagementOrchestrator:undefined,syncOrchestrator:undefined,
  ...overrides});
 owner.settingsHost=actualGeneralSettingsHostField(owner,settingsTypes.SettingsHost);
 owner.sourceHost=actualSourceManagementHostField(owner,sourceTypes.SourceHost);
 owner.bookshelfHost=actualBookshelfHostField(owner,shelfTypes.Host,{setOrCreate(){}});
 return owner;
}
function child(owner,name){return [...owner.children.values()].find(row=>row.constructor.name==='Child'&&row.params&&
 (name==='ReaderShell'?row.params.mangaChapterRequestGeneration!==undefined:row.params.currentSourceId!==undefined))?.params;}
function shellSurface(props){map.resetComponentMap();const owner=createReaderBuilderProbe(shell,['mangaSurface','mangaIdentityKey'],{
 ...mangaSurfaceSdkDependencies,MangaReadingSurface:Child,ReaderRuntimeOwner:{current:()=>({})}}).owner;
 Object.assign(owner,props,{keepsMangaReadingSession:()=>true});owner.mangaSurface();return {owner,props:[...owner.children.values()][0].params};}
{
 const owner=indexOwner();owner.initialRender();const props=child(owner,'ReaderShell');assert.ok(props);assert.equal(props.mangaStartAtChapterFirst,true);
 const surface=shellSurface(props);assert.equal(surface.props.startAtChapterFirst,true);assert.equal(surface.props.chapterIndex,3);
 owner.onDirectoryChapterSelected(999);assert.equal(owner.navigationGeneration,2);assert.equal(owner.mangaChapterRequestGeneration,4,'unknown chapter is rejected by the actual canonical admission');
 owner.onDirectoryChapterSelected(3);assert.equal(owner.navigationGeneration,2);assert.equal(owner.mangaChapterRequestGeneration,4,'already committed first page retains its actual branch');
 owner.onDirectoryChapterSelected(7);assert.equal(owner.mangaChapterRequestGeneration,5);
 assert.equal(owner.navigationGeneration,3);assert.equal(owner.settingsPresentationIdentity,'');assert.equal(owner.sourcePresentationIdentity,'');
 assert.equal(owner.bookshelfManagementPresentationIdentity,'');assert.equal(owner.readingEntryScopeId,-1);
 const later=indexOwner({mangaChapterRequestGeneration:owner.mangaChapterRequestGeneration,mangaChapterStartRequestGeneration:owner.mangaChapterStartRequestGeneration,requestedChapterIndex:7});
 later.initialRender();assert.equal(child(later,'ReaderShell').mangaStartAtChapterFirst,false);
 assert.equal(shellSurface(child(later,'ReaderShell')).props.startAtChapterFirst,false);
 const continued=indexOwner({mangaChapterStartRequestGeneration:-1,requestedChapterIndex:undefined});continued.initialRender();
 assert.equal(child(continued,'ReaderShell').mangaStartAtChapterFirst,false);assert.equal(shellSurface(child(continued,'ReaderShell')).props.chapterIndex,undefined);
}
console.log('PASS SDK actual Index→Shell→Surface exact first-page generation; next chapter invalidates intent; ordinary resume retains undefined chapter and saved-location route');
for(const locked of [false,true]){
 const owner=indexOwner({sourceSwitchVisible:true,mangaSourceSwitchCommitGeneration:locked?2:-1});owner.initialRender();
 const props=child(owner,'ReaderShell');assert.equal(props.allowCancelSourceSwitchWhilePreparing,!locked);
 assert.equal(props.contentKind,'manga','the actual Index payload retains the manga presentation branch');
 // Execute the real reader Shell overlay to preserve the complete binding chain.
 assert.equal(props.sourceSwitchScopeId,owner.sourceSwitchScopeId,'Index forwards its actual initialized keyed-overlay scope');
 const shellOwner=reactiveBuilder(shell,[...shellConstructorFields,'build','mangaSurface','mangaIdentityKey','keepsMangaReadingSession','onMangaChapterReady','selectAdjacentMangaChapter','sourceSwitchOverlayContent','overlayStatusBarUnderlay','chromeMetrics'],{
  ...mangaSurfaceSdkDependencies,MangaReadingSurface:Child,SourceSwitchPanel:Child,TransitionEffect:{IDENTITY:transitionIdentity},ReaderRuntimeOwner:{current:()=>({})}}, {initialParams:props});
 shellOwner.initialRender();
 const scrim=[...shellOwner.nodes.values()].find(node=>node.transition!==undefined);
 assert.equal(scrim.transition,transitionIdentity,'the real manga Shell scrim retains native identity transition');
 const panelProps=[...shellOwner.children.values()].find(row=>row.params.currentSourceId!==undefined).params;
 assert.equal(panelProps.contentKind,'manga');
 assert.equal(panelProps.allowCancelWhileSwitching,!locked);
 const detail=indexOwner({route:'detail',readingSessionActive:false,sourceSwitchVisible:true,mangaSourceSwitchCommitGeneration:locked?2:-1});
 detail.initialRender();assert.equal(child(detail,'SourceSwitchPanel').allowCancelWhileSwitching,!locked);
 const detailScrims=[...detail.nodes.values()].filter(node=>node.type==='Stack'&&typeof node.onClick==='function');
 assert.equal(detailScrims.length,1,'the actual manga Index overlay has one dismissing scrim');
 assert.equal(detailScrims[0].width,'100%');assert.equal(detailScrims[0].height,'100%');
 assert.equal(detailScrims[0].transition,transitionIdentity,'the real manga Index scrim preserves the same native identity transition');
 assert.equal(detailScrims[0].backgroundColor,'#40FFFFFF','the manga detail scrim retains its existing day palette');
 // The SDK emits this outer frame immediately before its inner scrim. Bind
 // alignment to that frame so another centered Index stack cannot satisfy it.
 const detailFrame=detail.nodes.get(detailScrims[0].id-1);
 assert.equal(detailFrame.type,'Stack');assert.equal(detailFrame.create.alignContent,'Alignment.Center');
 assert.equal(detailFrame.width,'100%');assert.equal(detailFrame.height,'100%');
 // Compile the real Panel wrapper to verify it forwards the parent decision.
 const wrapper=reactiveBuilder(panel,[...panelConstructorFields,'build'],{SourceSwitchWindow:Child},{initialParams:panelProps});
 wrapper.initialRender();
 const final=[...wrapper.children.values()][0].params;assert.equal(final.allowCancelWhileSwitching,!locked);
 const visual=reactiveBuilder(window,['appThemeScheme','readerWindowMetricsRevision','selectionPending','allowCancelWhileSwitching','reduceMotion','consumeTopInset',
  'onStop','onClose','onRetry','onRefresh','onSelectCandidate','onRollback',
  'header','busy','rollbackRequired','requiresReconciliation','isSweeping','requestRefresh','safeTop','safeLeft','safeRight'],
  {...mangaSurfaceSdkDependencies,ButtonType:{Normal:'normal'}},{componentName:'SourceSwitchWindow',initialParams:final});
 Object.assign(visual,final,{state:{kind:'switching'},selectionPending:true,appThemeScheme:'day',onClose:noOp});visual.header();
 const back=[...visual.nodes.values()].find(node=>node.accessibilityText==='返回');assert.equal(back.enabled,!locked);
 const refresh=[...visual.nodes.values()].find(node=>node.type==='Button'&&node.createWithLabel);assert.equal(refresh.enabled,false);
}
console.log('PASS SDK actual cancel readiness reaches Panel/Window return button; preparation is cancellable while durable commit and refresh stay locked');
console.log('Boundary: actual production SDK Builder bindings and navigation methods; no native layout/HAP/VM evidence.');

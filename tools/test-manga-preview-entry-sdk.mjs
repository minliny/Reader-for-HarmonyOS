import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"chapter-start": {"description": "实际Index→Shell→Surface章首generation与canonical拒绝", "resources": []}, "source-cancel": {"description": "实际Index/Panel/Window准备cancel与durable commit锁", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire} = await import('node:module');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {createArkUIPropertyRuntimeProbe} = await import('./lib/arkui-property-runtime-probe.mjs');
const {mangaSurfaceSdkDependencies} = await import('./lib/manga-surface-sdk-probe.mjs');
const {actualGeneralSettingsTypes,actualGeneralSettingsHostField} = await import('./lib/general-settings-owner-probe.mjs');
const {actualSourceManagementTypes,actualSourceManagementHostField} = await import('./lib/source-management-owner-probe.mjs');
const {actualBookshelfOperationTypes,actualBookshelfHostField} = await import('./lib/bookshelf-operation-owner-probe.mjs');
const {runtimeOwnerIdentityProbe} = await import('./lib/reader-runtime-admission-probe.mjs');
const {SOURCE_SWITCH_VISUAL} = await import('../entry/src/main/ets/features/source/SourceSwitchVisual.ts');
const {sourceSwitchNovelScale,sourceSwitchNovelHeadingHeight} = await import('../entry/src/main/ets/features/source/SourceSwitchNovelPresentation.ts');
const {ReaderNativeAlertOwner} = await import('./lib/reader-native-alert-sdk-probe.mjs');

const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
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
// Native timing is controlled here; record the actual shared overlay recipe
// without substituting it for compositor/frame evidence.
const transitionIdentity={kind:'identity'};
const effect=(kind,parameters)=>({kind,parameters,animation(options){return{...this,options};}});
const transitionEffects={IDENTITY:transitionIdentity,OPACITY:effect('opacity'),asymmetric:(appear,disappear)=>effect('asymmetric',{appear,disappear})};
const sourceCurves={cubicBezierCurve:(...values)=>({kind:'cubic-bezier',values})};
const assertSharedScrim=transition=>{
 assert.equal(transition.kind,'asymmetric');
 for(const [phase,duration] of [['appear',SOURCE_SWITCH_VISUAL.openDurationMs],['disappear',SOURCE_SWITCH_VISUAL.closeDurationMs]]){
  const action=transition.parameters[phase];assert.equal(action.kind,'opacity');assert.equal(action.options.duration,duration);
  assert.deepEqual(action.options.curve,{kind:'cubic-bezier',values:[SOURCE_SWITCH_VISUAL.easingX1,SOURCE_SWITCH_VISUAL.easingY1,SOURCE_SWITCH_VISUAL.easingX2,SOURCE_SWITCH_VISUAL.easingY2]});
 }
};
const runtimePort={supportsCoreCapability:()=>true},Runtime=runtimeOwnerIdentityProbe(()=>runtimePort);
const settingsTypes=actualGeneralSettingsTypes({ReaderRuntimeOwner:Runtime});
const sourceTypes=actualSourceManagementTypes({ReaderRuntimeOwner:Runtime});
const shelfTypes=actualBookshelfOperationTypes({ReaderRuntimeOwner:Runtime});
// Constructor inputs are copied from the actual selected component declarations.
// In particular, scope identity must come from Index's State initializer, not a
// fixture literal that bypasses the keyed overlay's real constructor.
function constructorFields(source,name,excluded=[]){
 const tree=ts.createSourceFile(virtualFilePath('MangaEntryConstructor.ets'),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
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
 const tree=ts.createSourceFile(virtualFilePath('MangaEntryIndex.ets'),index,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 const localSource=tree.statements.filter(ts.isVariableStatement).flatMap(statement=>[...statement.declarationList.declarations])
  .find(declaration=>declaration.name.getText(tree)==='LOCAL_SOURCE_ID')?.initializer;
 assert.ok(localSource&&ts.isStringLiteral(localSource),'actual Index local-source constant');
 for(const statement of tree.statements)for(const member of statement.members??[])if(member.getText(tree).includes('@Builder'))map.CUSTOM_BUILDER_METHOD.add(member.name.getText(tree));
 const native=new Set(['Stack','Row','Column','Blank','Text','Button','Image','If','ForEach','Scroll']);
 const deps={...mangaSurfaceSdkDependencies,ReaderShell:Child,SourceSwitchPanel:Child,ArkWebExecutionHost:Child,
  deviceInfo:{deviceType:'phone'},ReaderRuntimeOwner:Runtime,LOCAL_SOURCE_ID:localSource.text,
  TransitionEffect:transitionEffects,curves:sourceCurves,SOURCE_SWITCH_VISUAL};
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
if(selectedCase==='chapter-start') {
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

}
if(selectedCase==='source-cancel') {
for(const locked of [false,true]){
 const owner=indexOwner({sourceSwitchVisible:true,mangaSourceSwitchCommitGeneration:locked?2:-1});owner.initialRender();
 const props=child(owner,'ReaderShell');assert.equal(props.allowCancelSourceSwitchWhilePreparing,!locked);
 assert.equal(props.contentKind,'manga','the actual Index payload retains the manga presentation branch');
 // Execute the real reader Shell overlay to preserve the complete binding chain.
 assert.equal(props.sourceSwitchScopeId,owner.sourceSwitchScopeId,'Index forwards its actual initialized keyed-overlay scope');
 const shellOwner=reactiveBuilder(shell,[...shellConstructorFields,'build','mangaSurface','mangaIdentityKey','keepsMangaReadingSession','onMangaChapterReady','selectAdjacentMangaChapter','sourceSwitchOverlayContent','overlayStatusBarUnderlay','chromeMetrics'],{
  ...mangaSurfaceSdkDependencies,MangaReadingSurface:Child,SourceSwitchPanel:Child,TransitionEffect:transitionEffects,curves:sourceCurves,SOURCE_SWITCH_VISUAL,ReaderRuntimeOwner:{current:()=>({})}}, {initialParams:props});
 shellOwner.initialRender();
 const scrim=[...shellOwner.nodes.values()].find(node=>node.transition!==undefined);
 assertSharedScrim(scrim.transition);
 const panelProps=[...shellOwner.children.values()].find(row=>row.params.currentSourceId!==undefined).params;
 assert.equal(panelProps.contentKind,'manga');
 assert.equal(panelProps.allowCancelWhileSwitching,!locked);
 const detail=indexOwner({route:'detail',readingSessionActive:false,sourceSwitchVisible:true,mangaSourceSwitchCommitGeneration:locked?2:-1});
 detail.initialRender();assert.equal(child(detail,'SourceSwitchPanel').allowCancelWhileSwitching,!locked);
 const detailScrims=[...detail.nodes.values()].filter(node=>node.type==='Stack'&&typeof node.onClick==='function');
 assert.equal(detailScrims.length,1,'the actual manga Index overlay has one dismissing scrim');
 assert.equal(detailScrims[0].width,'100%');assert.equal(detailScrims[0].height,'100%');
 assertSharedScrim(detailScrims[0].transition);

 // The SDK emits this outer frame immediately before its inner scrim. Bind
 // alignment to that frame so another bottom-aligned Index stack cannot satisfy it.
 const detailFrame=detail.nodes.get(detailScrims[0].id-1);
 assert.equal(detailFrame.type,'Stack');assert.equal(detailFrame.create.alignContent,'Alignment.Bottom');
 assert.equal(detailFrame.width,'100%');assert.equal(detailFrame.height,'100%');
 // Compile the real Panel wrapper to verify it forwards the parent decision.
 const wrapper=reactiveBuilder(panel,[...panelConstructorFields,'build'],{SourceSwitchWindow:Child},{initialParams:panelProps});
 wrapper.initialRender();
 const final=[...wrapper.children.values()][0].params;assert.equal(final.allowCancelWhileSwitching,!locked);
 const visual=reactiveBuilder(window,['appThemeScheme','readerWindowMetricsRevision','selectionPending','allowCancelWhileSwitching','reduceMotion','consumeTopInset',
  'onStop','onClose','onRetry','onRefresh','onSelectCandidate','onRollback',
  'novelHeading','headingHeight','novelFontScale','busy','rollbackRequired','requiresReconciliation','isSweeping','requestRefresh','safeTop','safeLeft','safeRight'],
  {...mangaSurfaceSdkDependencies,ButtonType:{Normal:'normal'},SOURCE_SWITCH_VISUAL,sourceSwitchNovelScale,sourceSwitchNovelHeadingHeight},{componentName:'SourceSwitchWindow',initialParams:final});
 let cancelled=0,refreshes=0;
 Object.assign(visual,final,{state:{kind:'switching'},selectionPending:true,appThemeScheme:'day',onClose:()=>cancelled++,onStop:()=>refreshes++,onRefresh:()=>refreshes++,onRetry:()=>refreshes++});visual.novelHeading();
 const close=[...visual.nodes.values()].find(node=>node.accessibilityText==='关闭更换书源');assert.equal(close.enabled,!locked);
 if(close.enabled)close.onClick();assert.equal(cancelled,locked?0:1,'the original preparation cancel callback follows the existing durable gate');
 visual.requestRefresh();assert.equal(refreshes,0,'an actual switching owner still rejects every refresh/retry/stop action');
}
console.log('PASS SDK actual cancel readiness reaches Panel/Window shared close button; preparation is cancellable while durable commit and refresh stay locked');
console.log('Boundary: actual production SDK Builder bindings and navigation methods; no native layout/HAP/VM evidence.');

}

}

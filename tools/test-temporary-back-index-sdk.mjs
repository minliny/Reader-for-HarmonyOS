import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"settings": {"description": "实际Index→Settings SDK Back桥/Runtime/nav/instance旧租约", "resources": []}, "source": {"description": "实际Index→Source SDK collapse/route Back桥", "resources": []}, "bookshelf": {"description": "实际Index→Shelf Props/Watch换generation与小trigger退役", "resources": []}, "priority": {"description": "实际Index higher overlay优先级，含真SourceSwitchHost", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {fixture: sourceSwitchFixture} = await import('./lib/source-switch-owner-probe.mjs');
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire,stripTypeScriptTypes} = await import('node:module');
const {ReaderNativeAlertOwner} = await import('./lib/reader-native-alert-sdk-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {createBookshelfReadProjectionProbe,createLibraryShelfChromeProbe,mountBookshelfSceneProbe} = await import('./lib/bookshelf-projection-owner-probe.mjs');
const {boundedSurfaceSdk,boundedMembers} = await import('./lib/bounded-surface-sdk-probe.mjs');
const {choiceSource,resolveReaderChoiceSpec,compileReaderChoiceLabelModifier} = await import('./lib/reader-choice-row-probe.mjs');
const {menuSource,ReaderMenuActionView} = await import('./lib/reader-action-menu-probe.mjs');
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const {runtimeOwnerIdentityProbe} = await import('./lib/reader-runtime-admission-probe.mjs');
const {actualSourceJourneyTypes,actualSourceManagementGeometry} = await import('./lib/source-management-owner-probe.mjs');
const {fixture: generalSettingsFixture} = await import('./lib/general-settings-persistence-probe.mjs');
const readerWindowMetrics = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const {isReaderProductSurfaceEnabled} = await import('../entry/src/main/ets/app/ReaderProductScope.ts');
const {ReaderNavigation} = await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
const horizontalGeometry = await import('../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts');
const sourceSurface=readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceJourneySurface.ets',import.meta.url),'utf8');

const {createTemporaryBackLeafFixtures}=await import('./lib/temporary-back-leaf-fixture.mjs');
const leaf=await createTemporaryBackLeafFixtures();
const syntax=createRequire(import.meta.url)((resolveEtsLoaderRoot())+'/lib/validate_ui_syntax.js');syntax.builderParamObjectCollection.set('BookshelfShell',new Set(['content']));
const indexPath=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),indexSource=readFileSync(indexPath,'utf8');
let installed;const Runtime=runtimeOwnerIdentityProbe(()=>installed);
const methods=['registerTemporaryBackBridge','currentReadingRuntime','isCurrentRuntime','isCurrentBookshelfPresentation',
  'isInteractiveBookshelfPresentation',...(selectedCase==='bookshelf'?['bookshelfScenePorts']:[]),'nextNavigationGeneration','onBackPress',
  'openSourcePresentation','sourceJourneyIdentity','isCurrentRoute','publishNavigation','setSettingsSection'];
const Index=productionMotionMethods(indexPath,methods,{ReaderRuntimeOwner:Runtime,hilog:{error(){}},DOMAIN:0});
class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
function sourceLeaf(params){
  const p=boundedSurfaceSdk(),source=leaf.sourceSource;
  const dataSource=source.slice(source.indexOf('class SourceListDataSource'),source.indexOf('@Component'));
  const SourceListDataSource=new Function(stripTypeScriptTypes(dataSource)+';return SourceListDataSource;')();
  const names=['aboutToAppear','aboutToDisappear','consumeTemporaryBack','retireGroupSelection','ownsGroupSelection','toggleGroupSelection','dismissGroupSelection',
    'sources','groups','operation','statusKind','statusMessage','searchQuery','statusValue','categoryValue','groupValue','groupOpen','groupClosing','groupSelectionId',
    'mounted','lastFeedbackIdentity','temporaryBackIdentity','onTemporaryBackBridge','sourceDataSource','projectedSources','transientFeedback',
    'feedbackIdentity','rebuildSourceProjection','filteredSources','matchesStatus','groupOptions',
    'onGeometryInputsChanged','refreshGeometry','footerFallbackHeight','actionBottomInset','geometry','measurementKey',
    'measurements','viewportWidth','viewportHeight','measurementRevision','readerWindowMetricsRevision'];
  const o=createReaderBuilderProbe(source,names,{...p.deps,...actualSourceManagementGeometry(),SourceListDataSource,sourceTemporaryGeneration:0,
    ReaderTransientFeedback:class{reset(){}},registerReaderFonts(){},uiContext:{getFont:()=>({})}},
    {...p.hooks,initialParams:params}).owner;
  o.aboutToAppear();return{o};
}
const consumeCurrentTemporaryBack=index=>index.navigationOwner.consumeTemporaryBack(
  owner=>index.currentReadingRuntime()===owner,assert.fail);
function fixture(scope){
  const general=scope==='settings'?generalSettingsFixture():undefined,runtime=general?.runtime??{supportsCoreCapability:()=>false,request:async method=>{if(method==='source.list')return{data:{sources:[]}};throw Error('unexpected temporary-back fixture request '+method);}};installed=runtime;
  const index=Object.assign(new Index(),{route:scope,navigationGeneration:1,mountedRuntimeOwner:runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:1,rssInstanceIdentity:1,sourcePresentationIdentity:'',settingsPresentationIdentity:'',settingsSection:'general',settingsSnapshot:{reduceMotion:false},shelfBooks:[],shelfProjectionRevision:'',sourceSources:[],sourceStatusKind:'idle',sourceStatusMessage:'',sourceOperation:undefined});
  const navigationOwner=new ReaderNavigation();
  navigationOwner.advance();
  navigationOwner.show(scope);
  navigationOwner.setSettingsSection('general');
  index.navigationOwner=navigationOwner;
  index.libraryAcquisition={currentOwner:()=>Runtime.isCurrent(runtime)?runtime:undefined};
  if(scope==='settings'){
  const start=indexSource.indexOf('  private settingsHost:'),end=indexSource.indexOf('\n  );',start)+6;
  const expression=indexSource.slice(start,end).split('=').slice(1).join('=').trim().replace(/;$/,'');
  index.settingsHost=new Function('SettingsHost',stripTypeScriptTypes('const value='+expression+';')+'return value;').call(index,general.Host);
  if(scope==='settings')assert.equal(index.bindSettingsPresentation(),true);

}
const sourceTypes=scope==='source'?actualSourceJourneyTypes({ReaderRuntimeOwner:Runtime,hilog:{error(){},warn(){},info(){}}}):undefined;
if(sourceTypes){
  Object.assign(index,{sourceJourney:new sourceTypes.SourceJourneyPresentation(),
    settingsPresentation:{snapshot:{reduceMotion:false},retire(){}},
    sourceSwitchPresentation:{visible:false,retire(){}},mangaSourceSwitch:{selectionVisible:false},shelfMutations:{snapshot:{}},
    shelfGroupPresentation:{back:()=>false,retire(){}},shelfCatalog:{retire(){}},
    shelfMotion:{clear(){}},readingCommits:{retire(){}},transientFeedback:{reset(){}},retireSourceSwitchPresentation(){}});
  index.openSourcePresentation('source');
}
  const calls=[];index.hasVisibleImportDialog=()=>false;index.returnToBookshelf=()=>calls.push('bookshelf');index.returnFromSourceManagement=()=>calls.push('source-route');index.returnToSettings=()=>calls.push('settings-route');index.dismissBookRemovalDialog=()=>calls.push('delete');index.dismissJsonImport=()=>calls.push('json');index.closeSourceSwitch=()=>calls.push('source-switch');index.closeImportDialog=()=>calls.push('import');index.shelfRecovery=()=>({message:'',visible:false,canRetry:false,generation:0});
  const h=scope==='source'?undefined:leaf.harness(),source=scope==='settings'?leaf.settingsSource:scope==='source'?leaf.sourceSource:leaf.shelfSource;
  if(scope==='bookshelf'){
    const recovery=index.shelfRecovery;
    Object.assign(index,{
      libraryAcquisition:{currentOwner:()=>installed},
      shelfRead:createBookshelfReadProjectionProbe(),librarySearch:createLibraryShelfChromeProbe(),
      settingsPresentation:{snapshot:{reduceMotion:false}},searchAppForeground:true,mangaSourceSwitch:{selectionVisible:false},
      shelfCatalog:{snapshot:{},retire(){}},
      shelfGroupPresentation:{identity:'',back:()=>false,retire(){}},
      shelfMutations:{snapshot:{importPresentation:undefined},recovery,canContinueRemoval:()=>false,retireSelection(){},
        openImport(){calls.push('import-open');this.snapshot.importPresentation={state:'fileSelection'};},
        closeImport(){calls.push('import-close');this.snapshot.importPresentation=undefined;}},
    });
    h.p.hooks.childSources.BookshelfMoreActionSheet=leaf.read('features/bookshelf/ui/BookshelfMoreActionSheet');
    Object.assign(h.p.deps,horizontalGeometry,{BookshelfMoreActionSheet:Child,bookshelfHeaderSpec:()=>({frameHeight:58}),
      SheetType:{BOTTOM:'bottom'},SheetSize:{FIT_CONTENT:'fit-content'}});
    Object.assign(h.p.deps.ReaderWindowCoordinator,{requestAppChrome(){},requestOverlayChrome(){}});
  }
  const method=scope==='settings'?'settingsContent':'sourceJourneyContent';
  let parent;
  function props(){
    if(scope==='bookshelf'){
      const scene=mountBookshelfSceneProbe({
        read:index.shelfRead,mutations:index.shelfMutations,catalog:index.shelfCatalog,motion:{},
        navigation:index.navigationGeneration,feedbackEnabled:true,reduceMotion:false,
        ports:index.bookshelfScenePorts(runtime,index.detailShelfAdmissionMount),
      },{BookshelfShell:Child,BookshelfPage:Child,BookshelfEmptyPage:Child,BookshelfStatusContent:Child});
      return [...scene.children.values()].at(-1).params;
    }
    if(scope==='source'){
      const sdk=boundedSurfaceSdk();
      parent=createReaderBuilderProbe(indexSource,['sourceJourneyContent','sourceJourneySurface','sourceJourneyIdentity'],
        {SourceJourneySurface:Child},{childSources:{SourceJourneySurface:sourceSurface}}).owner;
      Object.assign(parent,index,{expandedLayout:()=>false});
      parent.sourceJourneyIdentity=index.sourceJourneyIdentity.bind(index);
      parent.registerTemporaryBackBridge=index.registerTemporaryBackBridge.bind(index);
      parent.sourceJourneyContent(false);
      const bridge=[...parent.children.values()].at(-1).params;
      const surface=createReaderBuilderProbe(sourceSurface,['managementPage','aboutToAppear','view','unsubscribe'],
        {...sdk.deps,SourceManagementPage:Child,EMPTY_SOURCE_JOURNEY:sourceTypes.EMPTY_SOURCE_JOURNEY},
        {...sdk.hooks,childSources:{SourceManagementPage:leaf.sourceSource}}).owner;
      Object.assign(surface,bridge);surface.aboutToAppear();surface.managementPage();
      return [...surface.children.values()].at(-1).params;
    }
    parent=createReaderBuilderProbe(indexSource,[method,...(scope==='settings'?['settingsSurface']:['bookshelfModalVisible'])],{...readerWindowMetrics,isReaderProductSurfaceEnabled,SettingsPage:Child,BookshelfShell:Child,deviceInfo:{deviceType:'phone'}},{childSources:{SettingsPage:leaf.settingsSource,BookshelfShell:leaf.shelfSource}}).owner;
    Object.assign(parent,index);
    parent.registerTemporaryBackBridge=index.registerTemporaryBackBridge.bind(index);
    parent[method]();return [...parent.children.values()].at(-1).params;
  }
  const params={...props(),sources:[],groups:['A','B']};
  const f=scope==='source'?sourceLeaf(params):h.owner(source,params);
  const open=()=>{if(scope==='settings')f.o.toggleSelection('language');else if(scope==='source')f.o.toggleGroupSelection();
    else index.librarySearch.openShelfMore(f.o.temporaryBackIdentity,index.navigationGeneration,index.detailShelfAdmissionMount);};
  const finish=()=>{
    if(scope==='source')f.o.dismissGroupSelection(f.o.groupSelectionId);
    if(scope==='bookshelf')f.o.moreSheetOptions().onDisappear();
  };
  return{index,runtime,calls,h,f,open,finish,props};
}
for(const scope of ['settings','source','bookshelf'].filter(scope=>scope===selectedCase)){
  const x=fixture(scope);assert.ok(x.index.navigationOwner.temporaryBackLease,'actual SDK Index child constructor publishes real leaf lease');x.open();assert.equal(x.index.onBackPress(),true);assert.deepEqual(x.calls,[],'temporary Back never invokes route exit');
  if(scope==='source')assert.equal(x.f.o.groupClosing,true,'Source collapse retains existing finish boundary');else assert.equal(scope==='settings'?x.f.o.openSelect:x.f.o.moreMenuVisible,scope==='settings'?'':false);
  x.finish();assert.equal(x.index.onBackPress(),scope!=='bookshelf');if(scope==='settings')assert.equal(x.index.settingsSection,'home');if(scope==='source')assert.deepEqual(x.calls,['source-route']);
}
for(const scope of ['settings','source','bookshelf'].filter(scope=>scope===selectedCase))for(const retired of ['navigation','route','unset','replacement','unmounted']){
  const x=fixture(scope),callback=x.props().onTemporaryBackBridge,old=x.index.navigationOwner.temporaryBackLease;x.open();
  if(retired==='navigation')x.index.nextNavigationGeneration();if(retired==='route')x.index.publishNavigation(x.index.navigationOwner.show('search'));if(retired==='unset')installed=undefined;if(retired==='replacement')installed={};if(retired==='unmounted')x.index.shelfReceiptRetired=true;
  assert.doesNotThrow(()=>callback(old.handler,old.identity,old.generation));assert.equal(consumeCurrentTemporaryBack(x.index),false);assert.equal(scope==='settings'?x.f.o.openSelect:scope==='source'?x.f.o.groupOpen:x.f.o.moreMenuVisible,scope==='settings'?'language':true,'stale host does not call live leaf close');
  if(retired==='unset')assert.throws(()=>Runtime.current(),/installed by EntryAbility/);
}
for(const scope of ['settings','source','bookshelf'].filter(scope=>scope===selectedCase)){
  const x=fixture(scope),old=x.index.navigationOwner.temporaryBackLease,callback=x.props().onTemporaryBackBridge;
  x.f.o.aboutToDisappear();x.f.o.aboutToAppear();const current=x.index.navigationOwner.temporaryBackLease;assert.notEqual(current.identity,old.identity);callback(undefined,old.identity,old.generation);assert.equal(x.index.navigationOwner.temporaryBackLease,current,'old unregister cannot remove replacement lease');
  x.open();assert.equal(old.handler(),false);assert.equal(consumeCurrentTemporaryBack(x.index),true);
}
if(selectedCase==='priority') for(const layer of ['delete','json','source-switch','import','group','busy-group']){
  const x=fixture('settings');x.open();
  if(layer==='delete')x.index.bookRemovalConfirmation.open(()=>true,()=>{},()=>({open(){},close(){}}));if(layer==='json')x.index.jsonImportVisible=true;if(layer==='source-switch'){const source=sourceSwitchFixture();installed=source.runtime;x.index.mountedRuntimeOwner=source.runtime;x.index.sourceSwitchHost=source.host;x.index.sourceSwitchScopeId=source.changes.at(-1).scopeId;x.index.sourceSwitchVisible=true;x.source=source;}if(layer==='import')x.index.hasVisibleImportDialog=()=>true;
  if(layer.endsWith('group')){x.index.editingShelfGroupBook={bookId:'book'};x.index.editingShelfGroupBusy=layer==='busy-group';}
  assert.equal(x.index.onBackPress(),true);assert.equal(x.f.o.openSelect,'language','Index-owned higher layer wins before settings temporary Back');
  if(layer==='group')assert.equal(x.index.editingShelfGroupBook,undefined);if(layer==='busy-group')assert.ok(x.index.editingShelfGroupBook);if(layer==='source-switch'){assert.deepEqual(x.calls,[]);assert.equal(x.source.changes.at(-1).visible,false,'actual SourceSwitchHost consumes only overlay Back');}else if(!layer.endsWith('group'))assert.deepEqual(x.calls,[layer]);
}
if(selectedCase==='priority'){
  const x=fixture('settings');x.index.registerTemporaryBackBridge('settings',1,x.runtime,()=>{throw Error('native close failure');},'throw');assert.equal(x.index.onBackPress(),true);assert.equal(x.index.settingsSection,'general','failed close cannot claim route is clear');
}
if(selectedCase==='bookshelf'){
  const x=fixture('bookshelf'),o=x.f.o,first=x.index.navigationOwner.temporaryBackLease,firstId=o.temporaryBackIdentity;
  const chrome=x.index.librarySearch, mounting=x.index.detailShelfAdmissionMount;
  const oldAction=o.moreOpenAction(firstId);
  assert.equal(chrome.shelfMoreIdentity(first.generation,mounting),firstId);
  o.content=()=>{};o.initialRender();const children=[...o.children.values()];
  x.open();const disappeared=o.moreSheetOptions().onDisappear;
  x.index.nextNavigationGeneration();assert.equal(x.index.navigationOwner.temporaryBackLease,undefined);
  const p=x.props();o.updateStateVars(p);x.h.p.properties.flush();
  const second=x.index.navigationOwner.temporaryBackLease;assert.equal(second.generation,2);assert.notEqual(second.identity,firstId);assert.equal(o.moreMenuVisible,false,'actual @Prop/@Watch retires old opening');assert.equal(first.handler(),false);
  assert.ok(children.every(c=>[...o.children.values()].includes(c)),'shell/content actors stay mounted through navigation generation');
  disappeared();oldAction();chrome.openShelfMore(firstId,first.generation,mounting);
  assert.equal(o.moreMenuVisible,false,'old top-bar More callback and presentation lease are retired');
  assert.equal(chrome.shelfMoreIdentity(second.generation,mounting),second.identity);
  x.open();assert.equal(o.moreMenuVisible,true,'top-bar More bridge receives the current callback');
  p.onTemporaryBackBridge(undefined,first.identity,first.generation);assert.equal(x.index.navigationOwner.temporaryBackLease,second);assert.equal(x.index.onBackPress(),true);assert.equal(o.moreMenuVisible,false);
  o.aboutToDisappear();assert.equal(x.index.navigationOwner.temporaryBackLease,undefined);o.aboutToAppear();assert.ok(x.index.navigationOwner.temporaryBackLease);assert.equal(second.handler(),false);
}
if(selectedCase==='bookshelf')for(const retired of ['current','navigation','route','unmounted']){
  const x=fixture('bookshelf'),o=x.f.o;
  o.content=()=>{};o.initialRender();x.open();o.replay();
  const host=[...o.nodes.values()].find(node=>node.bindSheet),[visible,body,options]=host.bindSheet;
  assert.equal(visible,true);body.builder();
  const action=[...o.children.values()].find(child=>child.params?.onLocalImport).params.onLocalImport;
  action();action();
  assert.equal(o.moreMenuVisible,false);assert.deepEqual(x.calls,[],'import waits for the native sheet to disappear');
  assert.equal(x.index.onBackPress(),true);assert.equal(x.index.onBackPress(),true);
  assert.deepEqual(x.calls,[],'consecutive Back during native exit stays within the More layer');
  if(retired==='navigation'){
    x.index.nextNavigationGeneration();o.updateStateVars(x.props());x.h.p.properties.flush();
  }
  if(retired==='route')x.index.publishNavigation(x.index.navigationOwner.show('search'));
  if(retired==='unmounted')o.aboutToDisappear();
  options.onDisappear();options.onDisappear();action();
  assert.deepEqual(x.calls,retired==='current'?['import-open']:[],`only the exact current onDisappear can deliver import once (${retired})`);
  if(retired==='current'){
    assert.equal(x.index.onBackPress(),true);assert.deepEqual(x.calls,['import-open','import-close']);
    assert.equal(x.index.onBackPress(),false,'after both surfaces close, no temporary layer owns Back');
  }
}
console.log(`PASS actual Index→SDK ${selectedCase} Back bridge`);

}

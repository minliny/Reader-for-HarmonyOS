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
const {boundedSurfaceSdk,boundedMembers} = await import('./lib/bounded-surface-sdk-probe.mjs');
const {choiceSource,resolveReaderChoiceSpec,compileReaderChoiceLabelModifier} = await import('./lib/reader-choice-row-probe.mjs');
const {menuSource,ReaderMenuActionView} = await import('./lib/reader-action-menu-probe.mjs');
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const {runtimeOwnerIdentityProbe} = await import('./lib/reader-runtime-admission-probe.mjs');
const {actualSourceManagementTypes,actualSourceManagementHostField} = await import('./lib/source-management-owner-probe.mjs');
const {fixture: generalSettingsFixture} = await import('./lib/general-settings-persistence-probe.mjs');
const {admitBookshelfSdkCarrier} = await import('./lib/bookshelf-projection-owner-probe.mjs');
const readerWindowMetrics = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {isReaderProductSurfaceEnabled} = await import('../entry/src/main/ets/app/ReaderProductScope.ts');

const {createTemporaryBackLeafFixtures}=await import('./lib/temporary-back-leaf-fixture.mjs');
const leaf=await createTemporaryBackLeafFixtures();
const syntax=createRequire(import.meta.url)((resolveEtsLoaderRoot())+'/lib/validate_ui_syntax.js');syntax.builderParamObjectCollection.set('BookshelfShell',new Set(['content']));createRequire(import.meta.url)((resolveEtsLoaderRoot())+'/lib/component_map.js').CUSTOM_BUILDER_METHOD.add('bookshelfContent');
const indexPath=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),indexSource=readFileSync(indexPath,'utf8');
let installed;const Runtime=runtimeOwnerIdentityProbe(()=>installed);
const methods=['registerTemporaryBackBridge','consumeTemporaryBackBridge','isCurrentRuntime','shelfReadRecovery','emptyShelfRecovery','nextNavigationGeneration','onBackPress',
  'bindSourceManagement','isCurrentSourceManagement','closeShelfGroup','bindSettingsPresentation','isCurrentSettingsPresentation','retireSettingsPresentation'];
const Index=productionMotionMethods(indexPath,methods,{ReaderRuntimeOwner:Runtime,hilog:{error(){}},DOMAIN:0});
class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
function fixture(scope){
  const general=scope==='settings'?generalSettingsFixture():undefined,runtime=general?.runtime??{supportsCoreCapability:()=>false,request:async method=>{if(method==='source.list')return{data:{sources:[]}};throw Error('unexpected temporary-back fixture request '+method);}};installed=runtime;
  const index=Object.assign(new Index(),{route:scope,navigationGeneration:1,mountedRuntimeOwner:runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:1,rssInstanceIdentity:1,sourcePresentationIdentity:'',settingsPresentationIdentity:'',settingsSection:'general',settingsSnapshot:{reduceMotion:false},shelfBooks:[],shelfProjectionRevision:'',sourceSources:[],sourceStatusKind:'idle',sourceStatusMessage:'',sourceOperation:undefined});
  admitBookshelfSdkCarrier(index,runtime,()=>installed);
  if(scope==='settings'){
  const start=indexSource.indexOf('  private settingsHost:'),end=indexSource.indexOf('\n  );',start)+6;
  const expression=indexSource.slice(start,end).split('=').slice(1).join('=').trim().replace(/;$/,'');
  index.settingsHost=new Function('SettingsHost',stripTypeScriptTypes('const value='+expression+';')+'return value;').call(index,general.Host);
  if(scope==='settings')assert.equal(index.bindSettingsPresentation(),true);

}
if(scope==='source'){
  index.sourceHost=actualSourceManagementHostField(index,actualSourceManagementTypes({ReaderRuntimeOwner:Runtime}).SourceHost);
  if(scope==='source')assert.equal(index.bindSourceManagement(),true);

}
  const calls=[];index.hasVisibleImportDialog=()=>false;index.returnToBookshelf=()=>calls.push('bookshelf');index.returnFromSourceManagement=()=>calls.push('source-route');index.returnToSettings=()=>calls.push('settings-route');index.dismissBookRemovalDialog=()=>calls.push('delete');index.dismissJsonImport=()=>calls.push('json');index.closeSourceSwitch=()=>calls.push('source-switch');index.closeImportDialog=()=>calls.push('import');index.bookshelfContent=()=>{};index.shelfRecovery=()=>({message:'',visible:false,canRetry:false,generation:0});index.shelfReadRecovery=index.shelfReadRecovery.bind(index);
  const h=leaf.harness(),source=scope==='settings'?leaf.settingsSource:scope==='source'?leaf.sourceSource:leaf.shelfSource;
  const method=scope==='settings'?'settingsContent':scope==='source'?'sourceManagementContent':'bookshelfShellContent';
  let parent;
  function props(){parent=createReaderBuilderProbe(indexSource,[method,...(scope==='source'?['sourceManagementSurface']:scope==='settings'?['settingsSurface']:[])],{...readerWindowMetrics,isReaderProductSurfaceEnabled,SettingsPage:Child,SourceManagementPage:Child,BookshelfShell:Child,deviceInfo:{deviceType:'phone'}},{childSources:{SettingsPage:leaf.settingsSource,SourceManagementPage:leaf.sourceSource,BookshelfShell:leaf.shelfSource}}).owner;Object.assign(parent,index);parent.registerTemporaryBackBridge=index.registerTemporaryBackBridge.bind(index);parent.isCurrentSourceManagement=index.isCurrentSourceManagement.bind(index);parent.isCurrentSettingsPresentation=index.isCurrentSettingsPresentation.bind(index);parent[method]();return[...parent.children.values()].at(-1).params;}
  const f=h.owner(source,{...props(),sources:[],groups:['A','B']});
  const open=()=>{if(scope==='settings')f.o.toggleSelection('language');else if(scope==='source')f.o.toggleGroupSelection();else f.o.moreOpenAction(f.o.temporaryBackIdentity)();};
  const finish=()=>{if(scope==='source'){f.o.dismissGroupSelection(f.o.groupSelectionId);}};
  return{index,runtime,calls,h,f,open,finish,props,parent:()=>parent};
}
for(const scope of ['settings','source','bookshelf'].filter(scope=>scope===selectedCase)){
  const x=fixture(scope);assert.ok(x.index.temporaryBackLease,'actual SDK Index child constructor publishes real leaf lease');x.open();assert.equal(x.index.onBackPress(),true);assert.deepEqual(x.calls,[],'temporary Back never invokes route exit');
  if(scope==='source')assert.equal(x.f.o.groupClosing,true,'Source collapse retains existing finish boundary');else assert.equal(scope==='settings'?x.f.o.openSelect:x.f.o.moreMenuVisible,scope==='settings'?'':false);
  x.finish();assert.equal(x.index.onBackPress(),scope!=='bookshelf');if(scope==='settings')assert.equal(x.index.settingsSection,'home');if(scope==='source')assert.deepEqual(x.calls,['source-route']);
}
for(const scope of ['settings','source','bookshelf'].filter(scope=>scope===selectedCase))for(const retired of ['navigation','route','unset','replacement','unmounted']){
  const x=fixture(scope),callback=x.props().onTemporaryBackBridge,old=x.index.temporaryBackLease;x.open();
  if(retired==='navigation')x.index.nextNavigationGeneration();if(retired==='route')x.index.route='search';if(retired==='unset')installed=undefined;if(retired==='replacement')installed={};if(retired==='unmounted')x.index.shelfReceiptRetired=true;
  assert.doesNotThrow(()=>callback(old.handler,old.identity,old.generation));assert.equal(x.index.consumeTemporaryBackBridge(),false);assert.equal(scope==='settings'?x.f.o.openSelect:scope==='source'?x.f.o.groupOpen:x.f.o.moreMenuVisible,scope==='settings'?'language':true,'stale host does not call live leaf close');
  if(retired==='unset')assert.throws(()=>Runtime.current(),/installed by EntryAbility/);
}
for(const scope of ['settings','source','bookshelf'].filter(scope=>scope===selectedCase)){
  const x=fixture(scope),old=x.index.temporaryBackLease,callback=x.props().onTemporaryBackBridge;
  x.f.o.aboutToDisappear();x.f.o.aboutToAppear();const current=x.index.temporaryBackLease;assert.notEqual(current.identity,old.identity);callback(undefined,old.identity,old.generation);assert.equal(x.index.temporaryBackLease,current,'old unregister cannot remove replacement lease');
  x.open();assert.equal(old.handler(),false);assert.equal(x.index.consumeTemporaryBackBridge(),true);
}
if(selectedCase==='priority') for(const layer of ['delete','json','source-switch','import','group','busy-group']){
  const x=fixture('settings');x.open();
  if(layer==='delete')x.index.bookRemovalDialogOpen=true;if(layer==='json')x.index.jsonImportVisible=true;if(layer==='source-switch'){const source=sourceSwitchFixture();installed=source.runtime;x.index.mountedRuntimeOwner=source.runtime;x.index.sourceSwitchHost=source.host;x.index.sourceSwitchScopeId=source.changes.at(-1).scopeId;x.index.sourceSwitchVisible=true;x.source=source;}if(layer==='import')x.index.hasVisibleImportDialog=()=>true;
  if(layer.endsWith('group')){x.index.editingShelfGroupBook={bookId:'book'};x.index.editingShelfGroupBusy=layer==='busy-group';}
  assert.equal(x.index.onBackPress(),true);assert.equal(x.f.o.openSelect,'language','Index-owned higher layer wins before settings temporary Back');
  if(layer==='group')assert.equal(x.index.editingShelfGroupBook,undefined);if(layer==='busy-group')assert.ok(x.index.editingShelfGroupBook);if(layer==='source-switch'){assert.deepEqual(x.calls,[]);assert.equal(x.source.changes.at(-1).visible,false,'actual SourceSwitchHost consumes only overlay Back');}else if(!layer.endsWith('group'))assert.deepEqual(x.calls,[layer]);
}
if(selectedCase==='priority'){
  const x=fixture('settings');x.index.registerTemporaryBackBridge('settings',1,x.runtime,()=>{throw Error('native close failure');},'throw');assert.equal(x.index.onBackPress(),true);assert.equal(x.index.settingsSection,'general','failed close cannot claim route is clear');
}
if(selectedCase==='bookshelf'){
  const x=fixture('bookshelf'),o=x.f.o,first=x.index.temporaryBackLease,firstId=o.temporaryBackIdentity;
  o.content=()=>{};o.initialRender();[...o.children.values()].find(c=>c instanceof x.h.p.deps.AppTopBar).params.trailing();
  const children=[...o.children.values()],oldTrigger=children.filter(c=>c instanceof x.h.p.deps.ReaderIconButton).at(-1);const oldAction=oldTrigger.params.onTap;
  x.open();x.index.nextNavigationGeneration();assert.equal(x.index.temporaryBackLease,undefined);
  const p=x.props();o.updateStateVars(p);x.h.p.properties.flush();
  const second=x.index.temporaryBackLease;assert.equal(second.generation,2);assert.notEqual(second.identity,firstId);assert.equal(o.moreMenuVisible,false,'actual @Prop/@Watch retires old opening');assert.equal(first.handler(),false);
  assert.ok(children.filter(c=>!(c instanceof x.h.p.deps.ReaderIconButton)).every(c=>[...o.children.values()].includes(c)),'shell/content actors stay mounted through navigation generation');
  oldAction();assert.equal(o.moreMenuVisible,false,'old physical More trigger is retired');
  o.topBar();const nextHeader=[...o.children.values()].filter(c=>c instanceof x.h.p.deps.AppTopBar).at(-1);nextHeader.params.trailing();
  const nextTrigger=[...o.children.values()].filter(c=>c instanceof x.h.p.deps.ReaderIconButton).at(-1);assert.notEqual(nextTrigger,oldTrigger);nextTrigger.params.onTap();assert.equal(o.moreMenuVisible,true,'new small trigger gets the current constructor callback');
  p.onTemporaryBackBridge(undefined,first.identity,first.generation);assert.equal(x.index.temporaryBackLease,second);assert.equal(x.index.onBackPress(),true);assert.equal(o.moreMenuVisible,false);
  o.aboutToDisappear();assert.equal(x.index.temporaryBackLease,undefined);o.aboutToAppear();assert.ok(x.index.temporaryBackLease);assert.equal(second.handler(),false);
}
console.log('PASS actual Index→SDK three leaf Back bridges: layer priority, route fallback, Source collapse, captured Runtime/navigation/instance identity, old unregister and unavailable owner; retained bookshelf true Prop/Watch renews lease and only temporary trigger constructor');

}

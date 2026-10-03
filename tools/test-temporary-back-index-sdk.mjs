import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {ReaderNativeAlertOwner} from '../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {choiceSource,resolveReaderChoiceSpec} from './lib/reader-choice-row-probe.mjs';
import {menuSource,ReaderMenuActionView} from './lib/reader-action-menu-probe.mjs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
// Reuse only the real leaf constructors/fixtures, not that test's assertions.
const fixtureUrl=new URL('./test-temporary-back-leaf-sdk.mjs',import.meta.url);
const fixtureSource=readFileSync(fixtureUrl,'utf8').split('function assertCycle(')[0].replace(/^import[^\n]+\n/gm,'').replaceAll('import.meta.url',JSON.stringify(fixtureUrl.href));
const deps={assert,readFileSync,createRequire,stripTypeScriptTypes,ReaderNativeAlertOwner,createReaderBuilderProbe,boundedSurfaceSdk,boundedMembers,choiceSource,resolveReaderChoiceSpec,menuSource,ReaderMenuActionView};
const leaf=new Function(...Object.keys(deps),fixtureSource+';return{harness,settingsSource,sourceSource,shelfSource,read};')(...Object.values(deps));
const syntax=createRequire(import.meta.url)((process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader')+'/lib/validate_ui_syntax.js');syntax.builderParamObjectCollection.set('BookshelfShell',new Set(['content']));createRequire(import.meta.url)((process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader')+'/lib/component_map.js').CUSTOM_BUILDER_METHOD.add('bookshelfContent');
const indexPath=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),indexSource=readFileSync(indexPath,'utf8');
let installed;const Runtime=runtimeOwnerIdentityProbe(()=>installed);
const methods=['registerTemporaryBackBridge','consumeTemporaryBackBridge','isCurrentRuntime','nextNavigationGeneration','onBackPress'];
const Index=productionMotionMethods(indexPath,methods,{ReaderRuntimeOwner:Runtime,hilog:{error(){}},DOMAIN:0});
class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
function fixture(scope){
  const runtime={};installed=runtime;
  const index=Object.assign(new Index(),{route:scope,navigationGeneration:1,mountedRuntimeOwner:runtime,shelfReceiptRetired:false,settingsSection:'general',settingsSnapshot:{reduceMotion:false},shelfBooks:[],shelfProjectionRevision:'',sourceSources:[],sourceStatusKind:'idle',sourceStatusMessage:'',sourceOperation:undefined});
  const calls=[];index.hasVisibleImportDialog=()=>false;index.returnToBookshelf=()=>calls.push('bookshelf');index.returnFromSourceManagement=()=>calls.push('source-route');index.returnToSettings=()=>calls.push('settings-route');index.dismissBookRemovalDialog=()=>calls.push('delete');index.dismissJsonImport=()=>calls.push('json');index.closeSourceSwitch=()=>calls.push('source-switch');index.closeImportDialog=()=>calls.push('import');index.bookshelfContent=()=>{};index.shelfRecovery=()=>({message:'',visible:false,canRetry:false,generation:0});
  const h=leaf.harness(),source=scope==='settings'?leaf.settingsSource:scope==='source'?leaf.sourceSource:leaf.shelfSource;
  const method=scope==='settings'?'settingsContent':scope==='source'?'sourceManagementContent':'bookshelfShellContent';
  let parent;
  function props(){parent=createReaderBuilderProbe(indexSource,[method],{SettingsPage:Child,SourceManagementPage:Child,BookshelfShell:Child,deviceInfo:{deviceType:'phone'}},{childSources:{SettingsPage:leaf.settingsSource,SourceManagementPage:leaf.sourceSource,BookshelfShell:leaf.shelfSource}}).owner;Object.assign(parent,index);parent.registerTemporaryBackBridge=index.registerTemporaryBackBridge.bind(index);parent[method]();return[...parent.children.values()].at(-1).params;}
  const f=h.owner(source,{...props(),sources:[],groups:['A','B']});
  const open=()=>{if(scope==='settings')f.o.toggleSelection('language');else if(scope==='source')f.o.toggleGroupSelection();else f.o.moreOpenAction(f.o.temporaryBackIdentity)();};
  const finish=()=>{if(scope==='source'){f.o.dismissGroupSelection(f.o.groupSelectionId);}};
  return{index,runtime,calls,h,f,open,finish,props,parent:()=>parent};
}
for(const scope of ['settings','source','bookshelf']){
  const x=fixture(scope);assert.ok(x.index.temporaryBackLease,'actual SDK Index child constructor publishes real leaf lease');x.open();assert.equal(x.index.onBackPress(),true);assert.deepEqual(x.calls,[],'temporary Back never invokes route exit');
  if(scope==='source')assert.equal(x.f.o.groupClosing,true,'Source collapse retains existing finish boundary');else assert.equal(scope==='settings'?x.f.o.openSelect:x.f.o.moreMenuVisible,scope==='settings'?'':false);
  x.finish();assert.equal(x.index.onBackPress(),scope!=='bookshelf');if(scope==='settings')assert.equal(x.index.settingsSection,'home');if(scope==='source')assert.deepEqual(x.calls,['source-route']);
}
for(const scope of ['settings','source','bookshelf'])for(const retired of ['navigation','route','unset','replacement','unmounted']){
  const x=fixture(scope),callback=x.props().onTemporaryBackBridge,old=x.index.temporaryBackLease;x.open();
  if(retired==='navigation')x.index.nextNavigationGeneration();if(retired==='route')x.index.route='search';if(retired==='unset')installed=undefined;if(retired==='replacement')installed={};if(retired==='unmounted')x.index.shelfReceiptRetired=true;
  assert.doesNotThrow(()=>callback(old.handler,old.identity,old.generation));assert.equal(x.index.consumeTemporaryBackBridge(),false);assert.equal(scope==='settings'?x.f.o.openSelect:scope==='source'?x.f.o.groupOpen:x.f.o.moreMenuVisible,scope==='settings'?'language':true,'stale host does not call live leaf close');
  if(retired==='unset')assert.throws(()=>Runtime.current(),/installed by EntryAbility/);
}
for(const scope of ['settings','source','bookshelf']){
  const x=fixture(scope),old=x.index.temporaryBackLease,callback=x.props().onTemporaryBackBridge;
  x.f.o.aboutToDisappear();x.f.o.aboutToAppear();const current=x.index.temporaryBackLease;assert.notEqual(current.identity,old.identity);callback(undefined,old.identity,old.generation);assert.equal(x.index.temporaryBackLease,current,'old unregister cannot remove replacement lease');
  x.open();assert.equal(old.handler(),false);assert.equal(x.index.consumeTemporaryBackBridge(),true);
}
for(const layer of ['delete','json','source-switch','import','group','busy-group']){
  const x=fixture('settings');x.open();
  if(layer==='delete')x.index.bookRemovalDialogOpen=true;if(layer==='json')x.index.jsonImportVisible=true;if(layer==='source-switch')x.index.sourceSwitchVisible=true;if(layer==='import')x.index.hasVisibleImportDialog=()=>true;
  if(layer.endsWith('group')){x.index.editingShelfGroupBook={bookId:'book'};x.index.editingShelfGroupBusy=layer==='busy-group';}
  assert.equal(x.index.onBackPress(),true);assert.equal(x.f.o.openSelect,'language','Index-owned higher layer wins before settings temporary Back');
  if(layer==='group')assert.equal(x.index.editingShelfGroupBook,undefined);if(layer==='busy-group')assert.ok(x.index.editingShelfGroupBook);if(!layer.endsWith('group'))assert.deepEqual(x.calls,[layer]);
}
{
  const x=fixture('settings');x.index.registerTemporaryBackBridge('settings',1,x.runtime,()=>{throw Error('native close failure');},'throw');assert.equal(x.index.onBackPress(),true);assert.equal(x.index.settingsSection,'general','failed close cannot claim route is clear');
}
{
  const x=fixture('bookshelf'),o=x.f.o,first=x.index.temporaryBackLease,firstId=o.temporaryBackIdentity;
  o.content=()=>{};o.shellContent();o.topBar();[...o.children.values()].find(c=>c instanceof x.h.p.deps.AppTopBar).params.trailing();
  const children=[...o.children.values()],oldTrigger=children.filter(c=>c instanceof x.h.p.deps.ReaderIconButton).at(-1);const oldAction=oldTrigger.params.onTap;
  x.open();x.index.nextNavigationGeneration();assert.equal(x.index.temporaryBackLease,undefined);
  const p=x.props();o.updateStateVars(p);x.h.p.properties.flush();
  const second=x.index.temporaryBackLease;assert.equal(second.generation,2);assert.notEqual(second.identity,firstId);assert.equal(o.moreMenuVisible,false,'actual @Prop/@Watch retires old opening');assert.equal(first.handler(),false);
  assert.ok(children.filter(c=>!(c instanceof x.h.p.deps.ReaderIconButton)).every(c=>[...o.children.values()].includes(c)),'shell/content actors stay mounted through navigation generation');
  oldAction();assert.equal(o.moreMenuVisible,false,'old physical More trigger is retired');
  const nextTrigger=[...o.children.values()].filter(c=>c instanceof x.h.p.deps.ReaderIconButton).at(-1);assert.notEqual(nextTrigger,oldTrigger);nextTrigger.params.onTap();assert.equal(o.moreMenuVisible,true,'new small trigger gets the current constructor callback');
  p.onTemporaryBackBridge(undefined,first.identity,first.generation);assert.equal(x.index.temporaryBackLease,second);assert.equal(x.index.onBackPress(),true);assert.equal(o.moreMenuVisible,false);
  o.aboutToDisappear();assert.equal(x.index.temporaryBackLease,undefined);o.aboutToAppear();assert.ok(x.index.temporaryBackLease);assert.equal(second.handler(),false);
}
console.log('PASS actual Index→SDK three leaf Back bridges: layer priority, route fallback, Source collapse, captured Runtime/navigation/instance identity, old unregister and unavailable owner; retained bookshelf true Prop/Watch renews lease and only temporary trigger constructor');

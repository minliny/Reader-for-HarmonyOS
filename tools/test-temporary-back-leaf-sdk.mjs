import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { ReaderNativeAlertOwner } from './lib/reader-native-alert-sdk-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { choiceSource, resolveReaderChoiceSpec, compileReaderChoiceLabelModifier } from './lib/reader-choice-row-probe.mjs';
import { menuSource, ReaderMenuActionView } from './lib/reader-action-menu-probe.mjs';
import * as readerWindowMetrics from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const read=path=>readFileSync(new URL(`../entry/src/main/ets/${path}.ets`,import.meta.url),'utf8');
const settingsSource=read('features/settings/SettingsPage'),sourceSource=read('features/source/SourceManagementPage'),shelfSource=read('features/bookshelf/BookshelfShell');
const settingsOverlay=read('features/settings/SettingsSelectOverlay'),selectPanel=read('features/common/ReaderSelectPanel'),moreMenu=read('features/bookshelf/BookshelfMoreMenu');
const require=createRequire(import.meta.url),sdkPath=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax=require(`${sdkPath}/lib/validate_ui_syntax.js`),ts=require(`${sdkPath}/node_modules/typescript`);
function leafMembers(source){
  const tree=ts.createSourceFile('/tmp/TemporaryBackLeaf.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdkPath}/lib/ets_checker.js`).compilerOptions);
  const struct=tree.statements.find(n=>n.members&&n.members.some(m=>m.name?.getText(tree)==='build'));
  const methods=source.includes('export struct SettingsPage')?
    ['aboutToAppear','aboutToDisappear','consumeTemporaryBack','onSnapshotChanged','onCacheCleanupChanged','applyCacheCleanup','syncSnapshotValues','buildOverlay','currentValue','selectOptions','setSelectValue','toggleSelection','retireSelection','ownsSelection','commitSelection','dismissSelection']:
    source.includes('export struct SourceManagementPage')?
    ['aboutToAppear','aboutToDisappear','consumeTemporaryBack','retireGroupSelection','ownsGroupSelection','toggleGroupSelection','groupCloseAction','commitGroupSelection','dismissGroupSelection','build','groupOptions','onSourcesChanged','rebuildSourceProjection','filteredSources','matchesStatus','numericAreaLength']:
    boundedMembers(source);
  return struct.members.filter(m=>m.name&&(ts.isPropertyDeclaration(m)||methods.includes(m.name.getText(tree)))).map(m=>m.name.getText(tree));
}
const classSource=sourceSource.slice(sourceSource.indexOf('class SourceListDataSource'),sourceSource.indexOf('@Component'));
const SourceListDataSource=new Function(stripTypeScriptTypes(classSource)+';return SourceListDataSource;')();
const inertNative=new Proxy({}, {get:(_,key)=>key==='name'?'PointerNativeBoundary':()=>inertNative});
function harness(){
  const p=boundedSurfaceSdk(),finishes=[];
  Object.assign(p.deps,{...readerWindowMetrics,ReaderNativeAlertOwner,SourceListDataSource,ReaderChoiceLabelModifier:compileReaderChoiceLabelModifier(),settingsSelectionGeneration:0,sourceTemporaryGeneration:0,bookshelfTemporaryGeneration:0,
    GROUP_FILTER_WIDTH:350,GROUP_SELECT_WIDTH:276,BOOKSHELF_WIDE_BREAKPOINT:600,READER_FLOATING_TOP_BAR_HEIGHT:58,
    OPTION_H:36,SELECT_PAD:10,CHEVRON_GAP:8,CHEVRON_W:12,CHEVRON_H:8,SELECT_CHROME:40,
    APPEARANCE_SELECT_OPTION_HEIGHT:25,appearanceSelectMenuHeight:n=>n*25,
    PHONE_HORIZONTAL_INSET:14,PHONE_BOTTOM_INSET:20,PHONE_OPTION_HEIGHT:52,PHONE_CANCEL_GAP:10,PHONE_RADIUS:12,
    SURFACE_ASSET_WIDTH:232,SURFACE_ASSET_HEIGHT:268,SURFACE_SHADOW_INSET_X:28,SURFACE_SHADOW_INSET_TOP:18,
    ReaderMenuActionView,resolveReaderChoiceSpec,Polygon:inertNative,Polyline:inertNative,LineJoinStyle:{Round:'LineJoinStyle.Round'},
    registerReaderFonts(){},registerReaderShelfFonts(){},
    ReaderWindowCoordinator:{metrics:()=>{const metrics=readerWindowMetrics.createDefaultReaderWindowMetrics();metrics.windowRect=new readerWindowMetrics.ReaderRectVp(0,0,390,844);return metrics;}},
    motionAnimateParam:(id,onFinish)=>({id,onFinish}),uiContext:{getFont:()=>({}),animateTo:(param,action)=>{action();if(param.onFinish)finishes.push(param.onFinish);}}
  });
  p.hooks.lifecycleChildren=true;
  for(const [name,path,slot] of [['MainTabShell','features/shell/MainTabShell','content'],['AppTopBar','features/common/AppTopBar','trailing'],['ReaderIconButton','features/common/ReaderIconButton'],['ReaderSelect','features/common/ReaderSelect']]){
    const source=read(path);p.hooks.childSources[name]=source;
    if(slot)syntax.builderParamObjectCollection.set(name,new Set(name==='MainTabShell'?['content','header','overlay']:[slot]));
    const NativeChild=class {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}};
    if(name==='MainTabShell'){
      // Back ownership remains in the actual Shell's named slots. Only tab
      // contents are an unrelated actor seam in this leaf lifecycle proof.
      p.hooks.childSources.MainTabBar=read('features/shell/MainTabBar');
      p.deps[name]=createReaderBuilderProbe(source,boundedMembers(source),{...p.deps,MainTabBar:NativeChild},p.hooks).Component;
    }else p.deps[name]=NativeChild;
  }
  for(const [name,source] of [['ReaderChoiceRow',choiceSource],['ReaderSelectPanel',selectPanel],['SettingsSelectOverlay',settingsOverlay],['ReaderActionMenuSurface',menuSource],['BookshelfMoreMenu',moreMenu]]){
    p.hooks.childSources[name]=source;
    p.deps[name]=createReaderBuilderProbe(source,boundedMembers(source),p.deps,p.hooks).Component;
  }
  const leaves=[];
  function owner(source,params={}){
    for(const m of source.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g))require(`${sdkPath}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(m[1]);
    const o=createReaderBuilderProbe(source,leafMembers(source),p.deps,{...p.hooks,initialParams:params}).owner;
    const events=[],publish=o.onTemporaryBackBridge;o.onTemporaryBackBridge=(handler,identity,generation)=>{events.push(generation===undefined?{handler,identity}:{handler,identity,generation});publish(handler,identity,generation);};
    o.aboutToAppear();leaves.push(o);return{o,events,p,finishes};
  }
  return{owner,p,finishes};
}
const child=(p,o,name)=>p.walk(o).find(x=>x instanceof p.deps[name]);
function settingsFixture(input=settingsSource,tablet=false){
  const h=harness(),f=h.owner(input,{isTablet:tablet,activeSection:'general'});f.o.toggleSelection('language');f.o.buildOverlay();return f;
}
function sourceFixture(input=sourceSource){
  const h=harness(),f=h.owner(input,{sources:[],groups:['A','B'],isTablet:false,reduceMotion:false});
  // Unrelated page content is outside this leaf/lifecycle proof. The real root
  // overlay Builder, original panel, real choice actors and exact callbacks run.
  f.o.sourceList=()=>{};f.o.backBar=()=>{};f.o.bottomActionBar=()=>{};f.o.contentFrame=()=>({left:19,right:19});f.o.actionBottomInset=()=>0;f.o.groupSelectWidth=()=>276;
  f.o.toggleGroupSelection();f.o.initialRender();return f;
}
function shelfFixture(input=shelfSource){
  const h=harness(),f=h.owner(input,{populated:true,canCheckUpdates:true});f.calls=[];
  f.o.onImportRequested=()=>f.calls.push('import');f.o.onBatchManageRequested=()=>f.calls.push('batch');f.o.onBookshelfSettingsRequested=()=>f.calls.push('settings');f.o.onCheckUpdatesRequested=()=>f.calls.push('update');f.o.content=()=>{};
  f.o.moreOpenAction(f.events.at(-1).identity)();f.o.initialRender();[...f.o.children.values()].find(x=>x instanceof f.p.deps.AppTopBar).params.trailing();return f;
}
function assertCycle(factory){
  const f=factory(),old=f.events.at(-1);assert.equal(typeof old.handler,'function');assert.equal(old.handler(),true);
  if(factory===sourceFixture){f.p.properties.flush();f.finishes.at(-1)();}
  assert.equal(old.handler(),false,'normal page must fall through to Index route handling');
  f.o.aboutToDisappear();assert.deepEqual(f.events.at(-1),old.generation===undefined?{handler:undefined,identity:old.identity}:{handler:undefined,identity:old.identity,generation:old.generation});assert.equal(old.handler(),false);
  f.o.aboutToAppear();const current=f.events.at(-1);assert.notEqual(current.identity,old.identity,'every appearance gets a new lease');
  if(factory===settingsFixture)f.o.toggleSelection('startup');
  else if(factory===sourceFixture)f.o.toggleGroupSelection();
  else f.o.moreOpenAction(current.identity)();
  assert.equal(old.handler(),false,'old registered handler cannot close a new opening on the same instance');
  assert.equal(current.handler(),true);
  return f;
}
for(const factory of [settingsFixture,sourceFixture,shelfFixture])assertCycle(factory);
for(const tablet of [false,true]){
  const f=settingsFixture(settingsSource,tablet),o=f.o,overlay=child(f.p,o,'SettingsSelectOverlay'),oldId=overlay.selectionId;
  const oldChoose=overlay.onSelect,oldDismiss=overlay.onDismiss;
  const first=f.events.at(-1);assert.equal(first.handler(),true);o.toggleSelection('startup');o.replay();f.p.properties.flush();
  assert.notEqual(overlay.selectionId,oldId);oldChoose('English',oldId);oldDismiss(oldId);assert.equal(o.openSelect,'startup');assert.equal(o.languageValue,'简体中文');
  const row=f.p.walk(o).find(x=>x instanceof f.p.deps.ReaderChoiceRow&&x.label==='RSS');assert.ok(row,'real responsive selector mounts shared choices');
  [...row.nodes.values()].find(n=>n.onClick).onClick();assert.equal(o.startupValue,'RSS');assert.equal(o.openSelect,'');
}
{
  const f=sourceFixture(),o=f.o,panel=child(f.p,o,'ReaderSelectPanel'),oldId=panel.selectionId,oldCommit=panel.onCommit,oldDismiss=panel.onDismiss;
  const oldMask=[...o.nodes.values()].find(n=>n.onClick).onClick;
  const back=f.events.at(-1).handler;assert.equal(back(),true);assert.equal(o.groupClosing,true);assert.equal(back(),true,'collapse in flight retains modal back priority');
  f.p.properties.flush();assert.equal(panel.closeInFlight,true);assert.equal(f.finishes.length,1);const finish=f.finishes[0];finish();assert.equal(o.groupOpen,false);
  o.toggleGroupSelection();o.replay();f.p.properties.flush();assert.notEqual(panel.selectionId,oldId);
  oldCommit('B',oldId);oldDismiss(oldId);oldMask();finish();assert.equal(o.groupValue,'全部分组');assert.equal(o.groupOpen,true);assert.equal(o.groupClosing,false);
  const row=f.p.walk(o).find(x=>x instanceof f.p.deps.ReaderChoiceRow&&x.label==='A');assert.ok(row);[...row.nodes.values()].find(n=>n.onClick).onClick();assert.equal(o.groupValue,'A');
  assert.equal(o.groupOpen,true,'commit precedes existing collapse completion');f.finishes.at(-1)();assert.equal(o.groupOpen,false);
  o.toggleGroupSelection();o.replay();f.p.properties.flush();panel.onCommit('invalid',panel.selectionId);assert.equal(o.groupValue,'A');
  const queuedId=panel.selectionId;o.aboutToDisappear();panel.onCommit('B',queuedId);panel.onDismiss(queuedId);assert.equal(o.groupValue,'A');assert.equal(o.groupOpen,false);
}
{
  const f=shelfFixture(),o=f.o;let menu=child(f.p,o,'BookshelfMoreMenu');const oldDismiss=menu.onDismiss,oldImport=menu.onLocalImport,oldUpdate=menu.onCheckUpdates;
  const oldOpen=[...o.children.values()].filter(x=>x instanceof f.p.deps.ReaderIconButton).at(-1).params.onTap;
  const back=f.events.at(-1).handler;assert.equal(back(),true);
  // The helper does not simulate native If removal. Execute actual disappear
  // and a fresh SDK constructor path for the new overlay, retaining old ACKs.
  menu.aboutToDisappear();o.moreOpenAction(f.events.at(-1).identity)();o.shellOverlay();menu=f.p.walk(o).filter(x=>x instanceof f.p.deps.BookshelfMoreMenu).at(-1);f.p.properties.flush();
  oldDismiss();oldImport();oldUpdate();assert.equal(o.moreMenuVisible,true);assert.deepEqual(f.calls,[],'old menu cannot execute business work');
  o.updateRunning=true;f.p.properties.flush();menu.onCheckUpdates();assert.equal(o.moreMenuVisible,true);assert.deepEqual(f.calls,[]);
  o.updateRunning=false;f.p.properties.flush();menu.onCheckUpdates();assert.equal(o.moreMenuVisible,false);assert.deepEqual(f.calls,['update']);
  menu.aboutToDisappear();o.moreOpenAction(f.events.at(-1).identity)();o.shellOverlay();menu=f.p.walk(o).filter(x=>x instanceof f.p.deps.BookshelfMoreMenu).at(-1);f.p.properties.flush();
  const row=f.p.walk(menu).find(x=>x instanceof f.p.deps.ReaderActionMenuSurface);assert.ok(row);[...row.nodes.values()].find(n=>n.accessibilityText==='本地导入').onClick();assert.equal(o.moreMenuVisible,false);assert.deepEqual(f.calls,['update','import']);
  o.aboutToDisappear();o.aboutToAppear();oldOpen();oldDismiss();assert.equal(o.moreMenuVisible,false,'old trigger and dismiss reject a replaced mounting');
}
// Counterexamples exercise the actual production members, not a parallel model.
for(const [factory,source] of [[settingsFixture,settingsSource],[sourceFixture,sourceSource],[shelfFixture,shelfSource]]){
  const weakened=source.replace('identity !== this.temporaryBackIdentity || ','');assert.notEqual(weakened,source);
  const f=factory(weakened),old=f.events.at(-1);f.o.aboutToDisappear();f.o.aboutToAppear();
  if(factory===settingsFixture)f.o.toggleSelection('language');else if(factory===sourceFixture)f.o.toggleGroupSelection();else f.o.moreOpenAction(f.events.at(-1).identity)();
  assert.equal(old.handler(),true,'removed epoch admission admits an obsolete handler (negative control)');
}
{
  const source=sourceSource.replace('identity === this.groupSelectionId','true'),f=sourceFixture(source),panel=child(f.p,f.o,'ReaderSelectPanel'),oldId=panel.selectionId;
  f.o.dismissGroupSelection(oldId);f.o.toggleGroupSelection();panel.onDismiss(oldId);assert.equal(f.o.groupOpen,false,'removed opening identity lets old ACK close replacement');
}
{
  const source=shelfSource.replace(' || identity !== this.moreSelectionId',''),f=shelfFixture(source),menu=child(f.p,f.o,'BookshelfMoreMenu'),oldDismiss=menu.onDismiss;
  f.events.at(-1).handler();f.o.moreOpenAction(f.events.at(-1).identity)();oldDismiss();assert.equal(f.o.moreMenuVisible,false,'removed menu admission lets old dismiss close replacement');
}
console.log('temporary back leaves SDK PASS: real settings phone/tablet choice and source collapse, shelf menu actions, live registered handlers, same-instance reentry, late callback/ACK rejection, no route consumption without a temporary layer; Index priority/native scheduling remain separate');

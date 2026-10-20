export async function createTemporaryBackLeafFixtures(){
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { ReaderNativeAlertOwner } = await import('./reader-native-alert-sdk-probe.mjs');
const { createReaderBuilderProbe } = await import('./reader-control-builder-probe.mjs');
const { boundedSurfaceSdk, boundedMembers } = await import('./bounded-surface-sdk-probe.mjs');
const { choiceSource, resolveReaderChoiceSpec, compileReaderChoiceLabelModifier } = await import('./reader-choice-row-probe.mjs');
const { menuSource, ReaderMenuActionView } = await import('./reader-action-menu-probe.mjs');
const readerWindowMetrics = await import('../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');

const read=path=>readFileSync(new URL(`../../entry/src/main/ets/${path}.ets`,import.meta.url),'utf8');
const settingsSource=read('features/settings/SettingsPage'),sourceSource=read('features/source/SourceManagementPage'),shelfSource=read('features/bookshelf/BookshelfShell');
const settingsOverlay=read('features/settings/SettingsSelectOverlay'),selectPanel=read('features/common/ReaderSelectPanel'),moreMenu=read('features/bookshelf/BookshelfMoreMenu');
const require=createRequire(import.meta.url),sdkPath=resolveEtsLoaderRoot();
const syntax=require(`${sdkPath}/lib/validate_ui_syntax.js`),ts=require(`${sdkPath}/node_modules/typescript`);
function leafMembers(source){
  const tree=ts.createSourceFile(virtualFilePath('TemporaryBackLeaf.ets'),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdkPath}/lib/ets_checker.js`).compilerOptions);
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
    if(slot)syntax.builderParamObjectCollection.set(name,new Set(name==='MainTabShell'?['content','header','overlayContent']:[slot]));
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

return{harness,settingsFixture,sourceFixture,shelfFixture,settingsSource,sourceSource,shelfSource,read,child};
}

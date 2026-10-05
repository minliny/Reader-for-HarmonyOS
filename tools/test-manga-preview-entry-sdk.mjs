import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {mangaSurfaceSdkDependencies} from './lib/manga-surface-sdk-probe.mjs';
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
function indexOwner(overrides={}){
 map.resetComponentMap();
 const tree=ts.createSourceFile('/tmp/MangaEntryIndex.ets',index,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 for(const statement of tree.statements)for(const member of statement.members??[])if(member.getText(tree).includes('@Builder'))map.CUSTOM_BUILDER_METHOD.add(member.name.getText(tree));
 const native=new Set(['Stack','Row','Column','Blank','Text','Button','Image','If','ForEach','Scroll']);
 const deps={...mangaSurfaceSdkDependencies,ReaderShell:Child,SourceSwitchPanel:Child,ArkWebExecutionHost:Child,
  deviceInfo:{deviceType:'phone'},ReaderRuntimeOwner:{current:()=>({supportsCoreCapability:()=>true})}};
 const visit=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&/^[A-Z]/.test(node.expression.text)&&!native.has(node.expression.text)){
  const name=node.expression.text;if(!syntax.componentCollection.customComponents.has(name))component(name,'');deps[name]=Child;
 }ts.forEachChild(node,visit);};visit(tree);
 const owner=createReaderBuilderProbe(index,['build','canCancelMangaSourcePreparation','nextNavigationGeneration','onDirectoryChapterSelected'],deps).owner;
 Object.assign(owner,{route:'reading',readingSessionActive:true,readingContentKind:'manga',detailInBookshelf:false,
  detailBook:{sourceId:'source',bookId:'book',title:'Manga',author:'Author',contentKind:'manga'},detailToc:[{index:3,title:'First'},{index:7,title:'Next'}],
  requestedChapterIndex:3,mangaChapterRequestGeneration:4,mangaChapterStartRequestGeneration:4,navigationGeneration:2,
  mangaSourceSwitchCommitGeneration:-1,sourceSwitchVisible:false,sourceSwitchState:{kind:'switching'},mangaSourceSwitchSelectionVisible:false,
  settingsSnapshot:{reduceMotion:false},offlineMutationActiveKey:'',directoryReturnTarget:'readerControl',jsonImportVisible:false,
  currentSourceSwitchTransactionId:()=>undefined,detailBookmarkIdentity:()=>undefined,controlBookmarkProjectionMessage:()=>'',
  readerOwnsWindowEdges:()=>true,mangaOwnsWindowEdges:()=>true,appContentTopInset:()=>0,detailContent:noOp,
  isKnownDetailChapter:chapter=>[3,7].includes(chapter),directoryCurrentChapterIndex:3,mangaCommittedRequestGeneration:4,
  ...overrides});
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
 owner.onDirectoryChapterSelected(7);assert.equal(owner.mangaChapterRequestGeneration,5);
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
 // Execute the real reader Shell overlay to preserve the complete binding chain.
 const shellOwner=createReaderBuilderProbe(shell,['build','mangaSurface','mangaIdentityKey','overlayStatusBarUnderlay'],{
  ...mangaSurfaceSdkDependencies,MangaReadingSurface:Child,SourceSwitchPanel:Child,ReaderRuntimeOwner:{current:()=>({})}}).owner;
 Object.assign(shellOwner,props,{mangaSurface:noOp,route:'reading',visible:true});shellOwner.initialRender();
 const panelProps=[...shellOwner.children.values()].find(row=>row.params.currentSourceId!==undefined).params;
 assert.equal(panelProps.allowCancelWhileSwitching,!locked);
 const detail=indexOwner({route:'detail',readingSessionActive:false,sourceSwitchVisible:true,mangaSourceSwitchCommitGeneration:locked?2:-1});
 detail.initialRender();assert.equal(child(detail,'SourceSwitchPanel').allowCancelWhileSwitching,!locked);
 // Compile the real Panel wrapper to verify it forwards the parent decision.
 const wrapper=createReaderBuilderProbe(panel,['build'],{SourceSwitchWindow:Child}).owner;
 Object.assign(wrapper,panelProps);wrapper.initialRender();
 const final=[...wrapper.children.values()][0].params;assert.equal(final.allowCancelWhileSwitching,!locked);
 const visual=createReaderBuilderProbe(window.slice(window.lastIndexOf('@Component',window.indexOf('export struct SourceSwitchWindow'))),['header','busy','rollbackRequired','isSweeping'],{...mangaSurfaceSdkDependencies,ButtonType:{Normal:'normal'}}).owner;
 Object.assign(visual,final,{state:{kind:'switching'},selectionPending:true,appThemeScheme:'day',onClose:noOp});visual.header();
 const back=[...visual.nodes.values()].find(node=>node.accessibilityText==='返回');assert.equal(back.enabled,!locked);
 const refresh=[...visual.nodes.values()].find(node=>node.type==='Button'&&node.createWithLabel);assert.equal(refresh.enabled,false);
}
console.log('PASS SDK actual cancel readiness reaches Panel/Window return button; preparation is cancellable while durable commit and refresh stay locked');
console.log('Boundary: actual production SDK Builder bindings and navigation methods; no native layout/HAP/VM evidence.');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {runtimeOwnerIdentityProbe} from './reader-runtime-admission-probe.mjs';
import {ReaderWindowMetricsSnapshot,ReaderRectVp,readerInteractiveSafeLeft,readerInteractiveSafeRight} from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {resolveHorizontalFrame,SurfaceWidthSpec,SurfaceHorizontalFrame} from '../../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
const read=p=>readFileSync(new URL('../../entry/src/main/ets/'+p,import.meta.url),'utf8');
const require=createRequire(import.meta.url),loader=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax=require(loader+'/lib/validate_ui_syntax.js'),ts=require(loader+'/node_modules/typescript'),options=require(loader+'/lib/ets_checker.js').compilerOptions;
const indexSource=read('pages/Index.ets'),bookSource=read('features/bookshelf/BookRemovalDialog.ets'),surfaceSource=read('features/common/ReaderDialogSurface.ets'),selectorSource=read('features/bookshelf/BookshelfGroupSelector.ets');
for(const[name,text]of[['BookRemovalDialog',bookSource],['ReaderDialogSurface',surfaceSource],['BookshelfGroupSelector',selectorSource]]){
 syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...text.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
}
syntax.componentCollection.customDialogs.add('BookRemovalDialog');syntax.builderParamObjectCollection.set('ReaderDialogSurface',new Set(['body']));
function declaration(text,name){const t=ts.createSourceFile('/tmp/dialog-declaration.ets',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);return t.statements.find(n=>n.name?.text===name).getText(t);}
const model=ts.transpileModule(declaration(surfaceSource,'DialogActionView'),{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
const actionExports={};new Function('exports',model)(actionExports);const DialogActionView=actionExports.DialogActionView;
const specText=read('features/common/ReaderSurfaceSpecs.ets'),specJs=ts.transpileModule(specText,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};new Function('exports','TextAlign',specJs)(exports,{Start:'start',Center:'center'});const resolveDialogSpec=exports.resolveDialogSpec;
const metrics=new ReaderWindowMetricsSnapshot();metrics.windowRect=new ReaderRectVp(0,0,390,844);
const surfaceNames=['body','defaultBody','build','header','actionsRow','actionCell','spec','resolvedFrame','frameWidth','framePadding','actionLabelColor','actionSurfaceRole','actionModifier','actionTouchRegion','bodyActionsInnerMargin'];
function sharedSurface(params){
 const p=createReaderBuilderProbe(surfaceSource,surfaceNames,{ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeLeft,readerInteractiveSafeRight,resolveHorizontalFrame,SurfaceWidthSpec,SurfaceHorizontalFrame,resolveDialogSpec,ButtonType:{Normal:'Normal'}}).owner;
 Object.assign(p,{...params,appThemeScheme:'day',readerWindowMetricsRevision:0,showCloseButton:params.showCloseButton??false});p.initialRender();return p;
}
class SurfaceChild{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});params.body?.();}updateStateVars(params){Object.assign(this.params,params);this.params.body?.();}}
const sdk=boundedSurfaceSdk();
const Book=createReaderBuilderProbe(bookSource,boundedMembers(bookSource),{...sdk.deps,ReaderWindowCoordinator:{metrics:()=>metrics},ReaderDialogSurface:SurfaceChild,DialogActionView},sdk.hooks).Component;
const Group=createReaderBuilderProbe(selectorSource,boundedMembers(selectorSource),sdk.deps,sdk.hooks).Component;
let currentOwner;const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
const methods=['isCurrentRuntime','isCurrentBookshelfPresentation','isCurrentBookRemoval','openBookRemovalDialog','bookRemovalDialogContent','dismissBookRemovalDialog','confirmBookRemovalDialog',
 'openShelfGroup','shelfGroupContent','shelfGroupSurface','shelfGroupBody','isCurrentShelfGroup','assignShelfDefaultGroup'];
const defer=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};};
function fixture(text=indexSource){
 const controllers=[];
 class Controller{constructor(options){this.options=options;this.opens=0;this.closes=0;controllers.push(this);}open(){this.opens++;this.options.builder();}close(){this.closes++;}}
 const r={};currentOwner=r;
 const probe=createReaderBuilderProbe(text,methods,{BookRemovalDialog:Book,CustomDialogController:Controller,DialogAlignment:{Center:'center'},ReaderRuntimeOwner,
  ReaderDialogSurface:SurfaceChild,BookshelfGroupSelector:Group,DOMAIN:0,hilog:{error(){}},errorMessageOf:e=>e.message}, {mountChildren:true});
 const i=probe.owner;Object.assign(i,{mountedRuntimeOwner:r,navigationGeneration:1,detailShelfAdmissionMount:1,route:'bookshelf',shelfReceiptRetired:false,
  bookRemovalPresentation:0,bookRemovalDialogOpen:false,editingShelfGroupPresentation:0,editingShelfGroupBusy:false,appThemeScheme:'day'});
 let refresh=0,invalid=0;const writes=[],toasts=[];let task;
 i.bookshelfHost={assignDefaultGroup:async book=>{writes.push(book);if(task)await task.promise;return book;}};
 i.invalidateBookshelfProjection=()=>invalid++;i.refreshBookshelf=()=>refresh++;i.getUIContext=()=>({getPromptAction:()=>({showToast:v=>toasts.push(v.message)})});
 const leaf=()=>[...i.children.values()].findLast(c=>c instanceof Book);
 const native=()=>{const b=leaf();b.initialRender();const surface=sharedSurface([...b.children.values()][0].params);return{b,surface,
  confirm:[...surface.nodes.values()].filter(n=>n.type==='Button'&&n.onClick)[1],cancel:[...surface.nodes.values()].filter(n=>n.type==='Button'&&n.onClick)[0]};};
 const group=()=>{i.shelfGroupContent();const child=[...i.children.values()].findLast(c=>c instanceof Group);child.initialRender();return{child,select:[...child.nodes.values()].find(n=>n.create==='默认'&&n.onClick),mask:[...i.nodes.values()].findLast(n=>n.type==='Row'&&n.height==='100%'&&n.onClick)};};
 return{i,r,controllers,native,group,writes,toasts,refresh:()=>refresh,invalid:()=>invalid,setTask:t=>task=t,retire:()=>{currentOwner=undefined;}};
}
export {fixture as bookshelfDialogPresentationFixture,indexSource,defer};

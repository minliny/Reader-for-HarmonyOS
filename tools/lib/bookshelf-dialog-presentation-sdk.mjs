import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { virtualFilePath } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {readerRecoveryView} from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import {READER_FEEDBACK_EXTENDED_MS} from '../../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts';
import {runtimeOwnerIdentityProbe} from './reader-runtime-admission-probe.mjs';
import {ReaderWindowMetricsSnapshot,ReaderRectVp,readerInteractiveSafeLeft,readerInteractiveSafeRight} from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import {resolveHorizontalFrame,SurfaceWidthSpec,SurfaceHorizontalFrame} from '../../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts';
import {SOURCE_CHROME_VISUAL} from '../../entry/src/main/ets/ui/foundation/ReaderSourceChromeVisual.ts';
const read=p=>readFileSync(new URL('../../entry/src/main/ets/'+p,import.meta.url),'utf8');
const { require, root: loader, ts, options } = installedEtsCompiler();
const journeyJs=ts.transpileModule(read('app/composition/ReaderLibraryJourney.ets'),{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
const journeyExports={};new Function('exports',journeyJs)(journeyExports);const ReaderLibraryJourney=journeyExports.ReaderLibraryJourney;
const syntax=require(loader+'/lib/validate_ui_syntax.js');
const indexSource=read('pages/Index.ets'),bookSource=read('features/bookshelf/ui/BookRemovalDialog.ets'),surfaceSource=read('ui/surfaces/ReaderDialogSurface.ets'),selectorSource=read('features/bookshelf/ui/BookshelfGroupSelector.ets');
const removalHostSource=read('features/bookshelf/ui/BookRemovalDialogHost.ets');
const groupDialogSource=read('features/bookshelf/ui/BookshelfGroupDialog.ets');
const groupPresentationSource=read('features/bookshelf/presentation/BookshelfGroupPresentation.ets');
assert.match(groupPresentationSource, /@Observed\s+export class BookshelfGroupPresentation/);
syntax.observedClassCollection.add('BookshelfGroupPresentation');
for(const[name,text]of[['BookRemovalDialog',bookSource],['ReaderDialogSurface',surfaceSource],['BookshelfGroupSelector',selectorSource]]){
 syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...text.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
}
syntax.componentCollection.customComponents.add('ReaderRecoveryNotice');syntax.propCollection.set('ReaderRecoveryNotice',new Set(['view','actionLabel']));
syntax.componentCollection.customDialogs.add('BookRemovalDialog');syntax.builderParamObjectCollection.set('ReaderDialogSurface',new Set(['body']));
function declaration(text,name){const t=ts.createSourceFile(virtualFilePath('dialog-declaration.ets'),text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);return t.statements.find(n=>n.name?.text===name).getText(t);}
const model=ts.transpileModule(declaration(surfaceSource,'DialogActionView'),{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
const actionExports={};new Function('exports',model)(actionExports);const DialogActionView=actionExports.DialogActionView;
const specText=read('ui/surfaces/ReaderSurfaceSpecs.ets'),specJs=ts.transpileModule(specText.replace(/^import[^;]+;\s*/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};new Function('exports','TextAlign','SOURCE_SWITCH_VISUAL',specJs)(exports,{Start:'start',Center:'center'},SOURCE_CHROME_VISUAL);const resolveDialogSpec=exports.resolveDialogSpec;
const metrics=new ReaderWindowMetricsSnapshot();metrics.windowRect=new ReaderRectVp(0,0,390,844);
const surfaceNames=['body','defaultBody','build','header','actionsRow','actionCell','spec','resolvedFrame','frameWidth','framePadding','actionHeight','fontScale','actionLabelColor','actionSurfaceRole','actionModifier','actionTouchRegion','bodyActionsInnerMargin'];
function sharedSurface(params){
 const p=createReaderBuilderProbe(surfaceSource,surfaceNames,{...sdk.deps,ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeLeft,readerInteractiveSafeRight,resolveHorizontalFrame,SurfaceWidthSpec,SurfaceHorizontalFrame,resolveDialogSpec,ButtonType:{Normal:'Normal'}}).owner;
 Object.assign(p,{...params,appThemeScheme:'day',readerWindowMetricsRevision:0,showCloseButton:params.showCloseButton??false});p.initialRender();return p;
}
class SurfaceChild{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});params.body?.();}updateStateVars(params){Object.assign(this.params,params);this.params.body?.();}}
const sdk=boundedSurfaceSdk();
const Book=createReaderBuilderProbe(bookSource,boundedMembers(bookSource),{...sdk.deps,ReaderWindowCoordinator:{metrics:()=>metrics},ReaderDialogSurface:SurfaceChild,DialogActionView,
  registerReaderFonts:font=>{assert.ok(font&&typeof font==='object','actual dialog lifecycle receives its platform Font handle');}},sdk.hooks).Component;
const Group=createReaderBuilderProbe(selectorSource,boundedMembers(selectorSource),sdk.deps,sdk.hooks).Component;
const GroupDialog=createReaderBuilderProbe(groupDialogSource,boundedMembers(groupDialogSource),
 { ...sdk.deps, SynchedPropertyNesedObjectPU:sdk.properties.sdk.SynchedPropertyNestedObjectPU,
   ReaderDialogSurface:SurfaceChild, BookshelfGroupSelector:Group },{...sdk.hooks,mountChildren:true}).Component;
let currentOwner;const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
const methods=['isCurrentRuntime','isCurrentBookshelfPresentation','openBookRemovalDialog','libraryJourneyPorts','bookshelfContentAcceptsInput','bookshelfModalVisible'];
const defer=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};};
function fixture(text=indexSource, runtime, groupText=groupPresentationSource, removalText=removalHostSource){
 const controllers=[];
 class Controller{constructor(options){this.options=options;this.opens=0;this.closes=0;controllers.push(this);}open(){this.opens++;this.options.builder();}close(){this.closes++;}}
 const r=runtime??{};currentOwner=r;
 const probe=createReaderBuilderProbe(text,methods,{...sdk.deps,ReaderRuntimeOwner,
  ReaderDialogSurface:SurfaceChild,BookshelfGroupSelector:Group,ReaderRecoveryNotice:sdk.deps.ReaderRecoveryNotice,ReaderRecoveryAction:sdk.deps.ReaderRecoveryAction,readerRecoveryView,READER_FEEDBACK_EXTENDED_MS,DOMAIN:0,hilog:{error(){},warn(){}},errorMessageOf:e=>e.message}, {...sdk.hooks,mountChildren:true});
 const i=probe.owner;Object.assign(i,{mountedRuntimeOwner:r,navigationGeneration:1,detailShelfAdmissionMount:1,route:'bookshelf',shelfReceiptRetired:false,
  libraryAcquisition:{currentOwner:()=>ReaderRuntimeOwner.isCurrent(r)?r:undefined},
  bookshelfManagementSnapshot:{busy:false},bookshelfManagementPresentationIdentity:'',rssInstanceIdentity:1,appThemeScheme:'day',searchAppForeground:true,
  arkWebCapturesInput:false,shelfReadingPreparation:false,readingEntry:{sessionActive:false},shelfMutations:{snapshot:{importPresentation:undefined}}});
 const removalHost=createReaderBuilderProbe(removalText,boundedMembers(removalText),
  {...sdk.deps,BookRemovalDialog:Book,CustomDialogController:Controller,DialogAlignment:{Center:'center'}},
  {...sdk.hooks,mountChildren:true}).owner;
 removalHost.presentation=i.bookRemovalConfirmation;
 removalHost.aboutToAppear();
 let refresh=0,invalid=0;const writes=[],toasts=[],bindings=[],opens=[];let task,management;
 // Match the actual Host's initial current()/Runtime admission. A fixture that
 // unconditionally binds would hide State proxy versus captured raw identity.
 const managementCurrent=(owner,identity)=>management?.owner===owner&&management.identity===identity&&
  ReaderRuntimeOwner.isCurrent(owner)&&management.current();
 class GroupHost {
  constructor(emit){this.emit=emit;}
  bindManagement(owner,identity,current){const accepted=ReaderRuntimeOwner.isCurrent(owner)&&current();bindings.push({owner,identity,accepted});if(!accepted)return false;management={owner,identity,current};return true;}
  openManagement(identity){opens.push(identity);}
  detachManagementPresentation(){management=undefined;}
  isManagementPresentationCurrent(owner,identity){return managementCurrent(owner,identity);}
  async assignDefaultGroup(book,identity){if(!managementCurrent(r,identity))return undefined;writes.push(book);if(task)await task.promise;return{receipt:{receipt:{confirmation:'confirmed',fact:'confirmedCurrent'}}};}
 }
 const groups=ts.transpileModule(groupText.replace(/^import[^;]+;\s*/gm,'').replace(/^@Observed\s*/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
 const groupExports={};
 new Function('exports','BookshelfHost','EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT','readerRecoveryView','hilog','errorMessageOf',groups)(
  groupExports,GroupHost,{busy:false},readerRecoveryView,{error(){}},e=>e.message);
 const presentation=sdk.properties.sdk.ObservedObject.createNew(new groupExports.BookshelfGroupPresentation(),undefined);
 i.shelfGroupPresentation=presentation;
 i.invalidateBookshelfProjection=()=>invalid++;i.refreshBookshelf=()=>refresh++;i.getUIContext=()=>({});
 i.transientFeedback={show(_ui,options,current){if(current())toasts.push(options.message);}};
 i.shelfRead={invalidate:()=>i.invalidateBookshelfProjection()};
 // These are the existing fixture's route facts, not a second navigation flow.
 i.navigationOwner={snapshot:()=>({route:i.route,generation:i.navigationGeneration})};
 i.libraryJourney=new ReaderLibraryJourney(i.navigationOwner,i.libraryJourneyPorts());
 i.openShelfGroup=(book,focusTarget)=>i.libraryJourney.openShelfGroup(book,focusTarget);
 const leaf=()=>[...removalHost.children.values()].findLast(c=>c instanceof Book);
 const native=()=>{const b=leaf();b.initialRender();const surface=sharedSurface([...b.children.values()][0].params);return{b,surface,
  confirm:[...surface.nodes.values()].filter(n=>n.type==='Button'&&n.onClick)[1],cancel:[...surface.nodes.values()].filter(n=>n.type==='Button'&&n.onClick)[0]};};
 const group=()=>{const dialog=new GroupDialog(undefined,{presentation,recoveryTop:0});dialog.initialRender();const child=[...dialog.children.values()].findLast(c=>c instanceof Group);child?.initialRender();return{dialog,child,select:[...(child?.nodes.values()??[])].find(n=>n.type==='Button'&&n.accessibilityText==='默认分组'&&n.onClick),mask:[...dialog.nodes.values()].findLast(n=>n.type==='Row'&&n.height==='100%'&&n.onClick)};};
 return{i,r,controllers,native,group,presentation,writes,toasts,bindings,opens,output:probe.output,raw:value=>sdk.properties.sdk.ObservedObject.GetRawObject(value),refresh:()=>refresh,invalid:()=>invalid,setTask:t=>task=t,retire:()=>{currentOwner=undefined;}};
}
export {fixture as bookshelfDialogPresentationFixture,indexSource,groupPresentationSource,removalHostSource,defer,sdk as bookshelfDialogSdk};

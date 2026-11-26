import { actualReaderPostLayoutFrame } from './reader-post-layout-frame-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {resolveEtsLoaderRoot,virtualFilePath} from './tool-environment.mjs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {compileTailConsumer} from './foundation-tail-consumer-probe.mjs';
import {readerEditingSdk} from './reader-editing-sdk-probe.mjs';
import {searchListLazyRequests} from './reader-content-search-list-probe.mjs';
import {sourceSwitchRowSdk} from './source-switch-row-sdk-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {selectedProductionMethods} from './selected-production-methods.mjs';
import {pureModuleProbe} from './ets-pure-module-probe.mjs';
import {read,gatewayExports} from './source-switch-owner-probe.mjs';
const {currentSourceSwitchOwners}=await import('./source-switch-current-owner-probe.mjs');
import * as horizontal from '../../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import * as scrollLayout from '../../entry/src/main/ets/ui/layout/ReaderScrollLayout.ts';
import * as novelPresentation from '../../entry/src/main/ets/features/source/ui/SourceSwitchNovelPresentation.ts';
import * as sourceVisual from '../../entry/src/main/ets/features/source/ui/SourceSwitchVisual.ts';
import * as motionTiming from '../../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts';
import {readerMotionValueDurationMs as collapseMotionDurationMs} from '../../entry/src/main/ets/ui/foundation/ReaderMotionDurationPolicy.ts';
import {DIRECTORY_CHROME_VISUAL as MANGA_DIRECTORY_VISUAL} from '../../entry/src/main/ets/ui/foundation/ReaderDirectoryChromeVisual.ts';
import * as fontFamilies from '../../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';
import {readerAppColor} from '../../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import {SourceSwitchCompletionPresentation} from '../../entry/src/main/ets/features/source/presentation/SourceSwitchCompletionPresentation.ts';
import {sourceSwitchTriggerFocusId} from '../../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts';
import * as appearanceRender from '../../entry/src/main/ets/features/reading/ui/ReaderAppearanceRenderStyle.ts';
import * as sourceNames from '../../entry/src/main/ets/features/bookshelf/application/BookshelfSourceNameProjection.ts';
import * as providerFamily from '../../entry/src/main/ets/features/source/application/SourceSwitchProviderFamily.ts';
import * as searchGeometry from '../../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts';
import {readerIsExpandedWidth} from '../../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts';
export {novelPresentation};
export function sourceSwitchRecoveryAction(p, owner, label) {
 const notice = p.walk(owner).find(child => child instanceof p.deps.ReaderRecoveryNotice && child.actionLabel === label);
 assert.ok(notice, 'the production picker mounts the shared recovery notice');
 const action = p.walk(notice).find(child => child instanceof p.deps.ReaderRecoveryAction && child.label === label);
 assert.ok(action, 'the recovery notice mounts its labelled action');
 const target = [...action.nodes.values()].find(node => node.accessibilityRole === 'AccessibilityRoleType.BUTTON' &&
  node.accessibilityText === label && typeof node.onClick === 'function');
 assert.ok(target, 'the production recovery actor publishes a labelled click target');
 return target;
}
/** Only the two approved theme resources cross this controlled platform port.
 * Channel values come from the real registry; production ColorMetrics, rather
 * than a string parser in the component, owns alpha composition on HarmonyOS. */
export function sourceSwitchColorMetricsSdk() {
 const registry=JSON.parse(readFileSync(new URL('../../../Reader-UI/theme/registry.json',import.meta.url)));
 const resources=new Map();
 for(const role of ['TOK_GREEN','TOK_ROW_DIVIDER','TOK_PRIMARY_SOFT','app.interaction.press'])for(const scheme of ['day','night']){
  const c=registry.appRoles[role][scheme];
  resources.set(readerAppColor(role,scheme),{red:c.r,green:c.g,blue:c.b,alpha:Math.round(c.a*255)});
 }
 resources.set('Color.Transparent',{red:0,green:0,blue:0,alpha:0});
 return{resourceColor(value){
  assert.ok(resources.has(value),'finite native source-switch color resource');
  return {...resources.get(value), blendColor(overlay){return {color:`sdk-blend:${value}:${overlay.red},${overlay.green},${overlay.blue},${overlay.alpha}`};}};
 },
  rgba(red,green,blue,alpha){return{color:`sdk-rgba:${red},${green},${blue},${alpha}`};}};
}
/** Actual checked-load registrar with a controlled platform receipt boundary.
 * A submitted load never supplies readiness; callers can hold or reject it. */
export function sourceSwitchFontSdk({ready=()=>true,load=async()=>{},warn=()=>{}}={}) {
 const source=read('ui/foundation/ReaderFonts.ets').replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g,'').replace(/^export /gm,'');
 return new Function(...Object.keys(fontFamilies),'$rawfile','loadReaderFontChecked','readerFontLoadReady','hilog',
  stripTypeScriptTypes(source)+';return {registerReaderFonts,sourceSwitchNovelFontsReady,prepareSourceSwitchNovelFonts};')
  (...Object.values(fontFamilies),value=>value,load,ready,{warn});
}
/** Compose the actual exported live picker and its actual row/cover/spinner
 * components. Native lazy ranges, scroller and frame scheduling are controlled ports;
 * production state, UI builders and callback guards are emitted by the SDK. */
export function sourceSwitchMotionSdk(curves, Curve) {
 return pureModuleProbe(read('ui/foundation/MotionSpec.ets'),'MotionSpec.ets',
  {...motionTiming,...sourceVisual,MANGA_DIRECTORY_VISUAL,curves,Curve},['motionAnimateParam','motionSpecGet']);
}

export function sourceSwitchLiveSdk(p,extra={},sources={}) {
 const windowSource=sources.SourceSwitchPanel??read('features/source/ui/SourceSwitchWindow.ets');
 const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
 const ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
 const tree=ts.createSourceFile(virtualFilePath('SourceSwitchLiveFixture.ets'),windowSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 const frame=tree.statements.find(node=>node.name?.getText(tree)==='SourceSwitchLayoutFrame');
 const SourceSwitchLayoutFrame=new Function('FrameCallback','ReaderPostLayoutFrame', stripTypeScriptTypes(frame.getText(tree))+';return SourceSwitchLayoutFrame;')(class FrameCallback{}, actualReaderPostLayoutFrame());
 const {SourceSwitchCandidateRow,SourceSwitchCandidateDataSource}=sourceSwitchRowSdk(p.properties,windowSource);
 require(sdk+'/lib/validate_ui_syntax.js').objectLinkCollection.set('SourceSwitchNovelRow',new Set(['row']));
 const gatewayTree=ts.createSourceFile(virtualFilePath('SourceCountFixture.ts'),read('features/source/application/SourceSwitchGateway.ts'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,options);
 const count=gatewayTree.statements.find(node=>node.name?.getText(gatewayTree)==='sourceSwitchSourceCount');
 const sourceSwitchSourceCount=new Function(stripTypeScriptTypes(count.getText(gatewayTree)).replace(/^export /,'')+';return sourceSwitchSourceCount;')();
 // Request an explicit bounded range using the existing SDK lazy callback
 // probe. Ace's actual visible range and pixel paint remain VM evidence.
 const LazyForEach={create(id,owner,source,generate,key){
   const indices=Array.from({length:Math.min(8,source.totalCount())},(_item,index)=>index);
   searchListLazyRequests(indices).LazyForEach.create(id,owner,source,generate,key);
 },pop(){}};
 const effect=(kind,parameters)=>({kind,parameters,animation(options){return{...this,options,animation:this.animation};}});
 const curves={cubicBezierCurve(...values){return{kind:'cubic-bezier',values};}};
 const Curve={EaseIn:'ease-in',EaseInOut:'ease-in-out',EaseOut:'ease-out',Linear:'linear'};
 const motion=sourceSwitchMotionSdk(curves,Curve);
 const { readerKeyboardHostBottom } = pureModuleProbe(read('ui/layout/ReaderKeyboardGeometry.ts'),
  'ReaderKeyboardGeometry.ts', metricsApi, ['readerKeyboardHostBottom']);
 const motionPolicy=pureModuleProbe(read('ui/foundation/ReaderMotionPolicy.ets'),'ReaderMotionPolicy.ets',
  {...motion,collapseMotionDurationMs},['readerMotionAnimateParam','readerMotionReducedFadeParam']);
 const {readerPaperActionIcon}=pureModuleProbe(read('ui/foundation/ReaderActionIconResources.ets'),
   'ReaderActionIconResources.ets',{$r:name=>name},['readerPaperActionIcon']);
 const deps={...p.deps,SynchedPropertyNesedObjectPU:p.properties.sdk.SynchedPropertyNestedObjectPU,...horizontal,...metricsApi,readerKeyboardHostBottom,...scrollLayout,...novelPresentation,...sourceVisual,...appearanceRender,...sourceNames,...providerFamily,...gatewayExports,...motion,...motionPolicy,SourceSwitchCompletionPresentation,sourceSwitchSourceCount,SourceSwitchLayoutFrame,SourceSwitchCandidateRow,SourceSwitchCandidateDataSource,LazyForEach,ColorMetrics:sourceSwitchColorMetricsSdk(),
   curves,readerIsExpandedWidth,readerPaperActionIcon,
   ViewStackProcessor:{StartGetAccessRecordingFor(){},StopGetAccessRecording(){}},
   Scroller:class Scroller{},ScrollAlign:{START:'start'},TouchType:{Down:'down',Move:'move',Up:'up',Cancel:'cancel'},
   Curve,ImageFit:{Cover:'cover',Fill:'fill'},ButtonType:{Normal:'normal'},
   GradientDirection:{Bottom:'GradientDirection.Bottom'},ImageInterpolation:{High:'ImageInterpolation.High'},ImageRepeat:{XY:'ImageRepeat.XY'},
   TransitionEdge:{BOTTOM:'bottom',END:'end'},TransitionEffect:{IDENTITY:effect('identity'),OPACITY:effect('opacity'),
    move:edge=>effect('move',edge),asymmetric:(appear,disappear)=>effect('asymmetric',{appear,disappear})},
   ...sourceSwitchFontSdk(),uiContext:{getFont:()=>({}),animateTo(_options,action){action();},postFrameCallback(){},
    createAnimator(_options){return{onFrame(){},play(){},cancel(){}};}},...extra};
 p.hooks.lifecycleChildren=true;
 p.hooks.childSources.SourceSwitchPanel=windowSource;
 p.hooks.childSources.SourceSwitchNovelRow=windowSource;
 const fieldSource=read('ui/controls/ReaderSearchField.ets');
 p.hooks.childSources.ReaderSearchField=fieldSource;
 const fieldAdapters=pureModuleProbe(fieldSource.slice(0,fieldSource.indexOf('@Component')),
   'ReaderSearchFieldAdapters.ets',{FrameCallback:class {}},['ReaderSearchInputTarget','ReaderSearchFocusFrame']);
 deps.ReaderSearchField=compileTailConsumer(fieldSource,boundedMembers(fieldSource),
   {...deps,...readerEditingSdk(),...searchGeometry,...fieldAdapters,DEBUG:false,TextInputController:class {}},p.hooks).Component;
 for(const [name,path] of [['NoCoverCover','ui/patterns/NoCoverCover.ets'],['SearchSpinner','features/search/ui/SearchSpinner.ets'],['SourceSwitchSpinner','features/source/ui/SourceSwitchSpinner.ets'],['SourceSwitchProgress','features/source/ui/SourceSwitchProgress.ets'],['ReaderPaperBackground','features/reading/ui/ReaderPaperBackground.ets'],['SourceSwitchCompletionOverlay','features/source/ui/SourceSwitchCompletionOverlay.ets']]){
   p.hooks.childSources[name]=sources[name]??read(path);deps[name]=createReaderBuilderProbe(p.hooks.childSources[name],boundedMembers(p.hooks.childSources[name]),deps,p.hooks).Component;
 }
 // The compiler probe also constructs an unused owner. Supply its required
 // ObjectLink input; real mounted rows still receive the native data-source row.
 const compilerRow=new SourceSwitchCandidateRow({sourceId:'sdk-unmounted-row',bookUrl:'/sdk-unmounted-row'});
 deps.SourceSwitchNovelRow=createReaderBuilderProbe(windowSource,boundedMembers(windowSource,'SourceSwitchNovelRow'),deps,{...p.hooks,componentName:'SourceSwitchNovelRow',initialParams:{row:compilerRow}}).Component;
 deps.SourceSwitchPanel=createReaderBuilderProbe(windowSource,boundedMembers(windowSource,'SourceSwitchWindow'),deps,{...p.hooks,componentName:'SourceSwitchWindow'}).Component;
 return deps;
}
function sourceSwitchOverlaySdk(p, extra, panelFrames) {
 const windowDeps=sourceSwitchLiveSdk(p,extra);
 const source=read('features/source/ui/SourceSwitchPanel.ets');
 p.hooks.childSources.SourceSwitchWindow=p.hooks.childSources.SourceSwitchPanel;
 p.hooks.childSources.SourceSwitchPanel=source;
 const frame=pureModuleProbe(source.slice(0,source.indexOf('@Component')),'SourceSwitchSurfaceFrame.ets',
  {FrameCallback:class {}},['SourceSwitchSurfaceFrame']);
 const deps={...windowDeps,...frame,SourceSwitchWindow:windowDeps.SourceSwitchPanel,
  uiContext:{...windowDeps.uiContext,postFrameCallback:frame=>panelFrames.push(frame)}};
 deps.SourceSwitchPanel=createReaderBuilderProbe(source,boundedMembers(source),deps,p.hooks).Component;
 return deps;
}

/** The current root source-switch carrier owns the live Panel/Window graph. */
export function makeSourceSwitchFixture(f,options={}) {
 const owners=currentSourceSwitchOwners(f,options);
 const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
 const panelFrames=[];
 const leafDeps=sourceSwitchOverlaySdk(p,{ReaderWindowCoordinator:{metrics:()=>metrics}},panelFrames);
 const source=read('app/composition/ReaderSourceSwitchSurfaces.ets');
 const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot(),ts=require(sdk+'/node_modules/typescript');
 const syntax=require(sdk+'/lib/validate_ui_syntax.js');
 for(const path of ['features/reading/presentation/ReadingEntryPresentation.ets','features/source/presentation/SourceSwitchPresentation.ets','features/manga/presentation/MangaSourceSwitchPresentation.ets']){
  const tree=ts.createSourceFile(virtualFilePath(path),read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS);
  for(const node of tree.statements.filter(ts.isClassDeclaration))if(ts.getAllDecorators(node).some(d=>d.getText(tree)==='@Observed'))
   syntax.observedClassCollection.add(node.name.text);
 }
 const observed={reading:p.properties.sdk.ObservedObject.createNew(owners.entry,undefined),
  source:p.properties.sdk.ObservedObject.createNew(owners.source,undefined),manga:p.properties.sdk.ObservedObject.createNew(owners.manga,undefined)};
 const surface=createReaderBuilderProbe(source,boundedMembers(source),leafDeps,{...p.hooks,
  initialParams:observed,
  childSources:{...p.hooks.childSources,BookDirectoryPage:read('features/reading/ui/BookDirectoryPage.ets')}}).owner;
 Object.assign(surface,{entryPickerAllowed:true,interactive:true,actions:owners.sourceActions});
 const flushPanelFrame=()=>{for(const frame of panelFrames.splice(0))frame.onFrame(0);};
 const unmountPanel=()=>{
  for(const panel of p.walk(surface).filter(child=>child instanceof leafDeps.SourceSwitchPanel))panel.aboutToDisappear();
  flushPanelFrame();
  assert.equal(owners.source.surfaceAttached,false,'the disappearing panel releases its exact attachment');
 };
 const mount=()=>{surface.initialRender();flushPanelFrame();p.properties.flush();
  const window=p.walk(surface).filter(child=>child instanceof leafDeps.SourceSwitchWindow).at(-1);
  assert.ok(window,'current source root mounts the actual Panel/Window');return window;};
 return {...owners,p,surface,mount,unmountPanel,rows:()=>p.walk(surface).filter(child=>child instanceof leafDeps.SourceSwitchNovelRow),leafDeps};
}

export function failureChain(x, { retryReading = () => assert.fail('source recovery must not restart ordinary body loading') } = {}){
 const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
 const ts=require(sdk+'/node_modules/typescript'),source=read('app/composition/RetainedReaderScene.ets');
 const ast=ts.createSourceFile(virtualFilePath('ActualSourceFailureBridge.ets'),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
 let actualShell;const visit=n=>{if((ts.isCallExpression(n)||ts.isEtsComponentExpression(n))&&n.expression.getText(ast)==='ReaderShell')actualShell=n;ts.forEachChild(n,visit);};visit(ast);
 const names=new Set(['sourceSwitchScopeId','sourceSwitchFailureMessage','sourceSwitchTransactionId','sourceSwitchRollbackInFlight',
  'onRetryFailedSourceSwitch','onDismissSourceSwitchFailure','onRollbackReaderTarget','onSwitchSource']);
 const fields=actualShell.arguments[0].properties.filter(p=>names.has(p.name?.getText(ast))).map(p=>p.getText(ast));assert.equal(fields.length,names.size);
 class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(p){Object.assign(this.params,p);}}
 const carrier=createReaderBuilderProbe('@Component struct ActualIndexFailurePayload {@Builder payload(){ReaderShell({'+fields.join(',')+'});}build(){Column(){}}}',
  ['payload'],{ReaderShell:Child},{childSources:{ReaderShell:read('features/reading/ui/ReaderShell.ets')}}).owner;
 Object.assign(carrier,{source:x.source,reading:x.entry,ports:{sourceSwitch:x.sourceActions,openSourceSwitch:()=>x.switchJourney.openReader()}});
 carrier.payload();const payload=[...carrier.children.values()][0].params;
 const shell=read('features/reading/ui/ReaderShell.ets'),start=shell.indexOf('        ForEach([this.readingIdentityKey()]'),tail='        }, (identity: string): string => identity);',end=shell.indexOf(tail,start)+tail.length;
 assert.ok(start>=0&&end>start);
 const retained=createReaderBuilderProbe('@Component struct ActualRetainedSourceReader {@Builder readingOwner(){'+shell.slice(start,end)+'}build(){Column(){}}}',
  ['readingOwner'],{ReadingExperience:Child},{childSources:{ReadingExperience:read('features/reading/ui/LocalReadingExperience.ets')}}).owner;
 Object.assign(retained,payload,{sourceId:x.entry.book.sourceId,bookId:x.entry.book.bookId,readingReadyGeneration:1,route:'reading',visible:true,inputAllowed:true,contentKind:x.entry.contentKind,sourceSwitchVisible:false,sourceSwitchCovered:false,
  readingIdentityKey(){return JSON.stringify([this.sourceId,this.bookId,this.readingReadyGeneration]);}});
 const Shell=selectedProductionMethods(new URL('../../entry/src/main/ets/features/reading/ui/ReaderShell.ets',import.meta.url),'ReaderShell',['readingContentIsForeground','acceptsTextInput']);
 retained.readingContentIsForeground=Shell.prototype.readingContentIsForeground;retained.acceptsTextInput=Shell.prototype.acceptsTextInput;
 retained.readingOwner();const actualReaderProps=[...retained.children.values()][0].params;
 const o=x.p.consumer(read('features/reading/ui/LocalReadingExperience.ets'),['sourceSwitchScopeId','sourceSwitchFailureMessage',
  'sourceSwitchTransactionId','sourceSwitchRollbackInFlight','phase','readingFailureContent','readingFailureActions'],
  {LOCAL_READING_SOURCE_ID:'local',sourceSwitchTriggerFocusId,readerAppearanceThemeStyle:()=>({ink:'#111111',paperStart:'#ffffff'})},actualReaderProps);
 Object.assign(o,actualReaderProps,{publishControlVerificationReady(){},cancelSourceSwitchCompletion(){},
  phase:'failed',chapterSelectionToken:1,readerRecoveryView:{visible:false,canRetry:false},
  appearanceSnapshot:{activeTheme:'day'},readingLayout:()=>({bodyWidth:()=>390,bodyHeight:()=>800,contentLeft:0,contentTop:0}),
  openReaderControl(){},readerInputIsCurrent(){return this.isReaderIdentityCurrent() && this.inputCurrent();},retryReading});
 const render=()=>{o.readingFailureContent();const physical=(label,required=true)=>{
  const actor=x.p.walk(o).filter(actor=>actor instanceof x.p.deps.ReaderRecoveryAction&&actor.label===label).at(-1);
  if(required) assert.ok(actor,label+' delegates to the actual shared recovery actor');
  if(!actor) return undefined;
  return [...actor.nodes.values()].find(node=>typeof node.onClick==='function').onClick;
 };return{retry:physical('重试'),dismiss:physical('继续当前书源',false),choose:physical('切换书源'),
  rollback:physical('换回原书源',false)};};
 return{o,retained,render};
}

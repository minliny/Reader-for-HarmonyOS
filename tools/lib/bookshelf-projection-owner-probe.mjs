import { resolveEtsLoaderRoot } from './tool-environment.mjs';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {boundedMembers,boundedSurfaceSdk} from './bounded-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {bookshelfOperationClass} from './bookshelf-operation-owner-probe.mjs';
import {BookshelfReadOwner} from '../../entry/src/main/ets/features/bookshelf/application/BookshelfReadOwner.ts';
import {projectOperationFacts} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {classifyReaderSource} from '../../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts';
import * as names from '../../entry/src/main/ets/features/bookshelf/application/BookshelfSourceNameProjection.ts';
import {runtimeOwnerIdentityProbe} from './reader-runtime-admission-probe.mjs';
import {currentProjectionFixture,currentProjectionIndexMembers,currentReadPresentation,currentLibraryShelfChrome} from './bookshelf-current-projection-probe.mjs';
import assert from 'node:assert/strict';
import {installedEtsCompiler} from './ets-compiler-runtime.mjs';
import {pureModuleProbe} from './ets-pure-module-probe.mjs';
import {actualReaderPageLayout,actualReaderFloatingBarMetrics} from './reader-page-shell-runtime-probe.mjs';
import * as horizontal from '../../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts';
import {selectedProductionMethods} from './selected-production-methods.mjs';
import {isReaderCoreTransactionPendingError} from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
import {errorMessageOf} from '../../entry/src/main/ets/app/ErrorMessage.ts';
import {localImportFailure} from '../../entry/src/main/ets/app/LocalImportFailure.ts';
import * as metricsApi from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import {readerRecoveryView} from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import * as headerMetrics from '../../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
import {readerSurfaceRectValid} from '../../entry/src/main/ets/ui/layout/ReaderSurfaceRect.ts';
import {BookshelfViewState} from '../../entry/src/main/ets/features/bookshelf/presentation/BookshelfViewState.ts';
import {readerFoundationTokens} from './reader-tokens-probe.mjs';

export function createBookshelfReadProjectionProbe() { return currentReadPresentation(); }

export function createLibraryShelfChromeProbe() { return currentLibraryShelfChrome(()=>true,()=>true); }

export function mountBookshelfSceneProbe(params, dependencies, hooks = {}) {
  const read = name => readFileSync(new URL(`../../entry/src/main/ets/features/bookshelf/${name}.ets`, import.meta.url), 'utf8');
  const childSources = Object.fromEntries(['BookshelfShell', 'BookshelfPage', 'BookshelfEmptyPage', 'BookshelfStatusContent']
    .map(name => [name, read('ui/' + name)]));
  const syntax = createRequire(import.meta.url)(resolveEtsLoaderRoot()+'/lib/validate_ui_syntax.js');
  syntax.builderParamObjectCollection.set('BookshelfShell', new Set(['content']));
  const { owner } = createReaderBuilderProbe(read('ui/BookshelfScene'),
    ['build', 'shelfContent', 'isCurrent', 'isInteractive', 'open'], dependencies,
    { ...hooks, childSources: { ...hooks.childSources, ...childSources } });
  Object.assign(owner, params);
  owner.initialRender();
  return owner;
}
export function actualProjectionTypes(readRuntime) {
 const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(readRuntime);
 const ReaderCoreGateway=bookshelfOperationClass('app/ReaderCoreGateway.ts','ReaderCoreGateway',{ReaderRuntimeOwner,isReaderCoreTransactionPendingError});
 const LocalBookImportGateway=bookshelfOperationClass('features/bookshelf/application/LocalBookImportGateway.ts','LocalBookImportGateway',{ReaderCoreGateway,ReaderRuntimeOwner,errorMessageOf,localImportFailure,hilog:{error(){}}});
 const BookshelfFlowGateway=bookshelfOperationClass('features/bookshelf/application/BookshelfFlowGateway.ts','BookshelfFlowGateway',{ReaderCoreGateway,ReaderRuntimeOwner,LocalBookImportGateway});
 const SourceGateway=bookshelfOperationClass('features/source/application/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner,classifyReaderSource});
 const BookshelfProjectionOwner=bookshelfOperationClass('features/bookshelf/application/BookshelfProjectionOwner.ts','BookshelfProjectionOwner',{projectOperationFacts,BookshelfReadOwner,...names});
 const BookshelfCatalogUpdate=bookshelfOperationClass('features/bookshelf/application/BookshelfCatalogUpdate.ts','BookshelfCatalogUpdate');
 const BookshelfCatalogOwner=bookshelfOperationClass('features/bookshelf/application/BookshelfCatalogOwner.ts','BookshelfCatalogOwner',{projectOperationFacts,BookshelfFlowGateway,BookshelfCatalogUpdate});
 const Host=bookshelfOperationClass('features/bookshelf/application/BookshelfHost.ets','BookshelfHost',{ReaderRuntimeOwner,BookshelfFlowGateway,BookshelfProjectionOwner,BookshelfCatalogOwner,SourceGateway});
 return {ReaderRuntimeOwner,ReaderCoreGateway,BookshelfFlowGateway,SourceGateway,BookshelfProjectionOwner,Host,...names};
}
export const projectionIndexMethods=currentProjectionIndexMembers;
export function actualProjectionIndex(runtime,types,options={}) { return currentProjectionFixture(runtime,types,options); }

export function actualProjectionSdkFeedback(f) {
 const read=path=>readFileSync(new URL('../../entry/src/main/ets/'+path,import.meta.url),'utf8');
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),layout=actualReaderPageLayout();
 const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
 const feedbackStore=new Map(),toasts=[];
 const storage={get:key=>feedbackStore.get(key),setOrCreate(key,value){feedbackStore.set(key,value);
  if(key==='readerTransientToast'&&value.visible)toasts.push(value.message);}};
 const feedback=pureModuleProbe(read('ui/feedback/ReaderTransientFeedback.ts'),'ReaderTransientFeedback.ts',
  {AppStorage:storage},['ReaderTransientFeedback','READER_FEEDBACK_BRIEF_MS']);
 class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
 const isReaderMainTabEnabled=bookshelfOperationClass('app/ReaderProductScope.ts','isReaderMainTabEnabled');
 const MAIN_TABS=bookshelfOperationClass('app/navigation/ReaderMainTabs.ts','MAIN_TABS',{isReaderMainTabEnabled});
 const READER_EXPANDED_MIN_WIDTH=bookshelfOperationClass('ui/foundation/ReaderWidthClass.ts','READER_EXPANDED_MIN_WIDTH');
 const nav=bookshelfOperationClass('features/shell/MainNavigationSpec.ts',
  '({readerMainNavigationMode,readerMainViewport,publishReaderMainViewport,readerMainRailLeading,readerMainRailBottomInset})',
  {...metricsApi,...actualReaderFloatingBarMetrics(),MAIN_TABS,READER_EXPANDED_MIN_WIDTH,AppStorage:storage,ReaderWindowCoordinator:{metrics:()=>metrics}});
 const shellTree=installedEtsCompiler().ts.createSourceFile('BookshelfShell.ets',read('features/bookshelf/ui/BookshelfShell.ets'),99,true,installedEtsCompiler().ts.ScriptKind.ETS);
 const declaration=shellTree.statements.flatMap(node=>node.declarationList?.declarations??[]).find(node=>node.name.getText(shellTree)==='bookshelfTemporaryGeneration');
 assert.ok(declaration?.initializer);const bookshelfTemporaryGeneration=Number(declaration.initializer.getText(shellTree));
 const bookshelfHeaderSpec=bookshelfOperationClass('ui/foundation/ReaderHeaderSpecs.ets','bookshelfHeaderSpec',{...headerMetrics,...readerFoundationTokens});
 const deps={...sdk.deps,SynchedPropertyNesedObjectPU:sdk.properties.sdk.SynchedPropertyNestedObjectPU,bookshelfTemporaryGeneration,bookshelfHeaderSpec,...layout,...metricsApi,...horizontal,...nav,...feedback,
  ReaderWindowCoordinator:{metrics:()=>metrics},registerReaderShelfFonts(){},SheetSize:{FIT_CONTENT:'fit-content'},SheetType:{BOTTOM:'bottom'},
  ReaderBottomNavigation:Child,MainNavigationRail:Child,BookshelfPage:Child,BookshelfEmptyPage:Child,BookshelfStatusContent:Child,
  BookshelfMoreActionSheet:Child};
 const sources={...sdk.childSources};
 for(const [name,path] of [['ReaderBottomNavigation','app/navigation/ReaderBottomNavigation.ets'],
  ['MainNavigationRail','features/shell/MainNavigationRail.ets'],['BookshelfPage','features/bookshelf/ui/BookshelfPage.ets'],
  ['BookshelfEmptyPage','features/bookshelf/ui/BookshelfEmptyPage.ets'],['BookshelfStatusContent','features/bookshelf/ui/BookshelfStatusContent.ets'],
  ['BookshelfMoreActionSheet','features/bookshelf/ui/BookshelfMoreActionSheet.ets'],['ReaderStandardPage','ui/layout/ReaderStandardPage.ets']])sources[name]=read(path);
 const hooks={...sdk.hooks,childSources:sources};
 const component=(name,path)=>{sources[name]=read(path);deps[name]=createReaderBuilderProbe(sources[name],boundedMembers(sources[name]),deps,hooks).Component;};
 component('ReaderFixedHeaderHost','ui/layout/ReaderFixedHeaderHost.ets');
 component('ReaderPageScaffold','ui/layout/ReaderPageScaffold.ets');
 component('MainNavigationOverlay','features/shell/MainNavigationOverlay.ets');
 component('MainTabShell','features/shell/MainTabShell.ets');
 component('BookshelfShell','features/bookshelf/ui/BookshelfShell.ets');
 const {ts,options}=installedEtsCompiler(),syntax=createRequire(import.meta.url)(resolveEtsLoaderRoot()+'/lib/validate_ui_syntax.js');
 syntax.builderParamObjectCollection.set('BookshelfShell',new Set([...read('features/bookshelf/ui/BookshelfShell.ets').matchAll(/@BuilderParam\s+(\w+)\s*:/g)].map(match=>match[1])));
 for(const path of ['features/bookshelf/presentation/BookshelfReadPresentation.ets','features/bookshelf/presentation/BookshelfMutationPresentation.ets',
  'features/bookshelf/presentation/BookshelfCatalogPresentation.ets','features/bookshelf/ui/BookshelfNavigationPresentation.ets']){
  const tree=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  for(const node of tree.statements.filter(ts.isClassDeclaration))if(ts.getAllDecorators(node).some(d=>d.getText(tree)==='@Observed'))
   syntax.observedClassCollection.add(node.name.text);
 }
 const index=read('pages/Index.ets'),tree=ts.createSourceFile('Index.ets',index,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options),calls=[];
 const visit=node=>{if((ts.isCallExpression(node)||ts.isEtsComponentExpression(node))&&node.expression.getText(tree)==='BookshelfScene')calls.push(node);ts.forEachChild(node,visit);};visit(tree);
 assert.equal(calls.length,1,'one actual current Index BookshelfScene assembly');
 const sceneText=read('features/bookshelf/ui/BookshelfScene.ets');sources.BookshelfScene=sceneText;
 const parent=createReaderBuilderProbe('@Component struct ActualShelfPayload {@Builder payload(){BookshelfScene('+calls[0].arguments[0].getText(tree)+');}build(){Column(){}}}',
  ['payload'],{BookshelfScene:Child},{childSources:{BookshelfScene:sceneText}}).owner;
 const project=()=>{
  Object.assign(parent,f.index);parent.bookshelfScenePorts=f.index.bookshelfScenePorts.bind(f.index);parent.payload();
  const params=[...parent.children.values()].find(child=>child instanceof Child).params;
  const links=Object.fromEntries(['read','mutations','catalog','motion'].map(name=>[name,sdk.properties.sdk.ObservedObject.createNew(params[name],undefined)]));
  const scene=createReaderBuilderProbe(sceneText,boundedMembers(sceneText),deps,{...hooks,initialParams:{...params,...links}}).owner;
  scene.initialRender();
  const shell=sdk.walk(scene).find(child=>child instanceof deps.BookshelfShell);
  assert.ok(shell,'the actual Scene mounts its original Shell');
  shell.onReadRecoveryChanged();shell.onReadRecoveryChanged();
  const actors=owner=>[owner,...[...(owner.children?.values()??[])].flatMap(actors)];
  const shelf=actors(scene).find(child=>child instanceof Child&&child.params.books);
  const props={readRecovery:shell.readRecovery,navigationGeneration:shell.navigationGeneration,onRetryRead:shell.onRetryRead};
  const notice=sdk.walk(shell).find(owner=>owner instanceof sdk.deps.ReaderRecoveryNotice);
  const action=sdk.walk(shell).find(owner=>owner instanceof sdk.deps.ReaderRecoveryAction);
  const generation=props.readRecovery?.generation;
  const main=sdk.walk(shell).find(child=>child instanceof deps.MainTabShell),scaffold=sdk.walk(shell).find(child=>child instanceof deps.ReaderPageScaffold);
  return {props,shelf,notice,action,shell,scene,main,scaffold,toasts,retry:()=>props.onRetryRead(generation,props.navigationGeneration)};
 };
 return {project,parent};
}

/** Bind the actual Index admission methods to a SDK-only carrier. The opaque
 * Runtime is the instance-storage seam; no guard or navigation logic is mocked. */
export function admitBookshelfSdkCarrier(carrier, runtime = {}, readRuntime = () => runtime) {
  const guardNames = ['isCurrentRuntime','currentReadingRuntime','libraryJourneyPorts','isCurrentSearchPresentation',
    'isCurrentBookshelfPresentation','isInteractiveBookshelfPresentation','bookshelfContentAcceptsInput','bookshelfModalVisible'];
  const Guard=selectedProductionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),'Index',guardNames,
    {ReaderRuntimeOwner:runtimeOwnerIdentityProbe(readRuntime)});
  carrier.mountedRuntimeOwner ??= runtime;carrier.navigationGeneration ??= 1;
  carrier.detailShelfAdmissionMount ??= 1;carrier.shelfReceiptRetired ??= false;carrier.route ??= 'bookshelf';
  carrier.searchAppForeground ??= true;
  carrier.libraryAcquisition ??= {currentOwner: readRuntime};
  carrier.readingEntry ??= {sessionActive: false};
  carrier.readingEntryActions ??= {shelfPreparing:false};
  carrier.shelfMutations ??= {snapshot: {}};
  carrier.shelfGroupPresentation ??= {identity: ''};
  carrier.shelfRead ??= createBookshelfReadProjectionProbe();
  carrier.librarySearch ??= createLibraryShelfChromeProbe();
  for (const name of guardNames) carrier[name] = Guard.prototype[name].bind(carrier);
  const Navigation = bookshelfOperationClass('app/navigation/ReaderNavigation.ts','ReaderNavigation');
  const Journey = bookshelfOperationClass('app/composition/ReaderLibraryJourney.ets','ReaderLibraryJourney');
  const navigation = carrier.navigationOwner ?? new Navigation();
  while(navigation.snapshot().generation<carrier.navigationGeneration)navigation.advance();
  navigation.show(carrier.route);
  carrier.navigationOwner = navigation;
  carrier.libraryJourney ??= new Journey(navigation,carrier.libraryJourneyPorts());
  return carrier;
}

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installedEtsCompiler} from './ets-compiler-runtime.mjs';
import {bookshelfOperationClass,actualBookshelfHostField} from './bookshelf-operation-owner-probe.mjs';
import {actualProjectionTypes} from './bookshelf-projection-owner-probe.mjs';
import {currentProjectionFixture} from './bookshelf-current-projection-probe.mjs';
import {readerRecoveryView} from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import {selectedProductionMethods} from './selected-production-methods.mjs';
import {errorMessageOf} from '../../entry/src/main/ets/app/ErrorMessage.ts';
import {projectOperationFacts} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
export const mutationSource=p=>readFileSync(new URL('../../entry/src/main/ets/'+p,import.meta.url),'utf8');
function field(name,receiver,deps){
 const {ts,options}=installedEtsCompiler(),text=mutationSource('pages/Index.ets');
 const tree=ts.createSourceFile('Index.ets',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 assert.deepEqual(tree.parseDiagnostics,[]);const members=tree.statements.find(n=>n.name?.text==='Index').members.filter(n=>n.name?.getText(tree)===name);
 assert.equal(members.length,1,'exact current Index field '+name);assert.ok(members[0].initializer);
 const code=ts.transpileModule('const value='+members[0].initializer.getText(tree)+';',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(...Object.keys(deps),code+';return value;').call(receiver,...Object.values(deps));
}
const {LOCAL_IMPORT_PRESENTATION_KEY}=bookshelfOperationClass('features/bookshelf/presentation/LocalImportPresentationOwner.ts','({LOCAL_IMPORT_PRESENTATION_KEY})');
const {READER_FEEDBACK_EXTENDED_MS}=bookshelfOperationClass('ui/feedback/ReaderTransientFeedback.ts','({READER_FEEDBACK_EXTENDED_MS})',{AppStorage:{}});
const hostTypes=new WeakMap();
/** Bind the unchanged current Index initializer and actual presentation to the
 * caller's real finite durable owner classes. No legacy Index fields/methods. */
export function currentMutationFixture(runtime,types,{initial,stored='',identity}={}){
 let full=hostTypes.get(types.Host);
 if(full===undefined){
  const projection=actualProjectionTypes(()=>types.ReaderRuntimeOwner.current());
  const BookshelfCatalogUpdate=bookshelfOperationClass('features/bookshelf/application/BookshelfCatalogUpdate.ts','BookshelfCatalogUpdate');
  const BookshelfCatalogOwner=bookshelfOperationClass('features/bookshelf/application/BookshelfCatalogOwner.ts','BookshelfCatalogOwner',
   {projectOperationFacts,BookshelfFlowGateway:types.BookshelfFlowGateway,BookshelfCatalogUpdate});
  const Host=bookshelfOperationClass('features/bookshelf/application/BookshelfHost.ets','BookshelfHost',
   {...types,BookshelfProjectionOwner:projection.BookshelfProjectionOwner,SourceGateway:projection.SourceGateway,BookshelfCatalogOwner});
  full={...types,Host};hostTypes.set(types.Host,full);
 }
 const f=currentProjectionFixture(runtime,full,{initial,identity}),{index,storageValues}=f;
 storageValues.set(LOCAL_IMPORT_PRESENTATION_KEY,stored);
 const messages=[];const storage={get:key=>storageValues.get(key),setOrCreate(key,value){storageValues.set(key,value);
  if(key==='readerTransientToast'&&value.visible)messages.push(value.message);}};
 const feedback=bookshelfOperationClass('ui/feedback/ReaderTransientFeedback.ts','({ReaderTransientFeedback,READER_FEEDBACK_EXTENDED_MS})',{AppStorage:storage});
 const Mutations=bookshelfOperationClass('features/bookshelf/presentation/BookshelfMutationPresentation.ets','BookshelfMutationPresentation',
  {Observed:v=>v,EMPTY_BOOKSHELF_OPERATION_SNAPSHOT:types.EMPTY_BOOKSHELF_OPERATION_SNAPSHOT,
   LOCAL_IMPORT_PRESENTATION_KEY,readerRecoveryView,AppStorage:storage});
 index.transientFeedback=new feedback.ReaderTransientFeedback();index.getUIContext=()=>({});
 index.shelfMutations=field('shelfMutations',index,{BookshelfMutationPresentation:Mutations,READER_FEEDBACK_EXTENDED_MS:feedback.READER_FEEDBACK_EXTENDED_MS});
 index.readingExitActions={navigationSettled(){}};index.shelfManagement={accept(){}};
 const Detail=bookshelfOperationClass('features/bookshelf/presentation/BookshelfDetailPresentation.ets','BookshelfDetailPresentation',
  {Observed:v=>v,EMPTY_READABLE_ADMISSION:types.EMPTY_READABLE_ADMISSION});
 const Dialog=bookshelfOperationClass('features/bookshelf/presentation/BookRemovalDialogPresentation.ts','BookRemovalDialogPresentation');
 index.bookRemovalConfirmation=new Dialog();index.bookRemovalConfirmation.attach(()=>({open(){},close:()=>true}));
 const Ports=selectedProductionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),'Index',
  ['openBookRemovalDialog','nextNavigationGeneration'],{hilog:{warn(){}},DOMAIN:0,errorMessageOf});
 index.openBookRemovalDialog=Ports.prototype.openBookRemovalDialog.bind(index);
 index.nextNavigationGeneration=Ports.prototype.nextNavigationGeneration.bind(index);
 // Unrelated feature retirements are explicit scheduling ports. Shelf, search,
 // mutation, navigation and reading owners remain their actual implementations.
 for(const key of ['downloadPresentation','readingCommits','discoverPresentation','rulesPresentation','syncPresentation','nativeAlertOwner'])index[key]={retire(){}};
 index.settingsPresentation.retire=()=>{};index.sourceJourney.retire=()=>{};
 index.retireSourceSwitchPresentation=()=>{};index.rssJourney={retire(){},clearSelection(){}};
 index.shelfManagement.retire=()=>{};index.shelfGroupPresentation.retire=()=>{};
 index.readingEntryActions.retirePreparation=()=>{};
 index.libraryAcquisition.endSearch=()=>f.scheduling.push('end-search');
 index.sourceSwitchPresentation.host=()=>undefined;
 index.getUIContext=()=>({postFrameCallback:frame=>frame.onFrame(0)});
 index.detailShelf=field('detailShelf',index,{BookshelfDetailPresentation:Detail,ReaderNavigationBackfillFrame:class{constructor(action){this.onFrame=action;}}});
 index.bookshelfHost=actualBookshelfHostField(index,full.Host,storage);
 index.shelfMutations.restore();
 return {...f,mutations:index.shelfMutations,types:full,storage,storageValues,messages,
  serialized:()=>storage.get(LOCAL_IMPORT_PRESENTATION_KEY)??'',
  selectImport(){return index.shelfMutations.selectImport(index.shelfMutations.snapshot.importIdentity,index.navigationGeneration,()=>true);},
  operation:()=>index.bookshelfHost.operations(runtime)};
}

// Exact current Index -> ImportScene -> LocalImportDialog parameter transport.
// The terminal dialog is a params carrier here; the consumer executes its real
// native controls independently with the same unmodified props.
import {createRequire} from 'node:module';
import {resolveEtsLoaderRoot} from './tool-environment.mjs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {boundedMembers,boundedSurfaceSdk} from './bounded-surface-sdk-probe.mjs';
let importFactory,importPayloadFactory;
export const sdkActors=owner=>[owner,...[...(owner.children?.values()??[])].flatMap(sdkActors)];
export function currentImportPayload(f){
 class DialogPort{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
 if(importFactory===undefined){
  const {ts,options}=installedEtsCompiler(),syntax=createRequire(import.meta.url)(resolveEtsLoaderRoot()+'/lib/validate_ui_syntax.js');
  const tree=ts.createSourceFile('Index.ets',mutationSource('pages/Index.ets'),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options),calls=[];
  const visit=n=>{if((ts.isCallExpression(n)||ts.isEtsComponentExpression(n))&&n.expression.getText(tree)==='BookshelfImportScene')calls.push(n);ts.forEachChild(n,visit);};visit(tree);assert.equal(calls.length,1);
  const text=mutationSource('features/bookshelf/ui/BookshelfImportScene.ets'),dialog=mutationSource('features/bookshelf/ui/LocalImportDialog.ets');
  syntax.observedClassCollection.add('BookshelfMutationPresentation');
  const sdk=boundedSurfaceSdk();
  importFactory=createReaderBuilderProbe(text,boundedMembers(text),{...sdk.deps,
   SynchedPropertyNesedObjectPU:sdk.properties.sdk.SynchedPropertyNestedObjectPU,LocalImportDialog:DialogPort},
   {...sdk.hooks,childSources:{...sdk.childSources,LocalImportDialog:dialog}});
  importPayloadFactory=createReaderBuilderProbe('@Component struct CurrentImportPayload{@Builder payload(){BookshelfImportScene('+calls[0].arguments[0].getText(tree)+');}build(){Column(){}}}',
   ['payload'],{BookshelfImportScene:DialogPort},{childSources:{BookshelfImportScene:text}});
  importFactory.sdk=sdk;
 }
 const carrier=new importPayloadFactory.Component(undefined,{});Object.assign(carrier,f.index);carrier.payload();
 const props=[...carrier.children.values()].at(-1).params;
 const actor=new importFactory.Component(undefined,{...props,presentation:importFactory.sdk.properties.sdk.ObservedObject.createNew(props.presentation,undefined)});
 actor.initialRender();const child=sdkActors(actor).find(x=>x!==actor&&x.params?.state!==undefined);
 return {props:child?.params,actor,carrier};
}

import {currentLibraryShelfChrome} from './bookshelf-current-projection-probe.mjs';
/** Current journey/ports on the same SDK detail actor. The SDK fixture's
 * Navigation getters already read this exact Navigation owner, so publication
 * is a consistency assertion rather than a legacy field mirror. */
export function bindCurrentDetailJourney(x){
 const index=x.idx;
 const Journey=bookshelfOperationClass('app/composition/ReaderLibraryJourney.ets','ReaderLibraryJourney');
 const Ports=selectedProductionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),'Index',
  ['libraryJourneyPorts'],{READER_FEEDBACK_EXTENDED_MS});
 index.librarySearch=currentLibraryShelfChrome();index.librarySearch.mount();
 index.libraryAcquisition.endSearch=()=>{}; // outbound acquisition scheduling outside this removal fixture
 index.rssJourney={clearSelection(){}};
 index.publishNavigation=snapshot=>assert.deepEqual(snapshot,x.navigation.snapshot());
 index.libraryJourneyPorts=Ports.prototype.libraryJourneyPorts.bind(index);
 index.libraryJourney=new Journey(x.navigation,index.libraryJourneyPorts());
 return index.libraryJourney;
}
export function bindCurrentRemovalDialog(index){
 const Dialog=bookshelfOperationClass('features/bookshelf/presentation/BookRemovalDialogPresentation.ts','BookRemovalDialogPresentation');
 const Ports=selectedProductionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),'Index',['openBookRemovalDialog'],
  {hilog:{warn(){}},DOMAIN:0,errorMessageOf});
 index.bookRemovalConfirmation=new Dialog();index.bookRemovalConfirmation.attach(()=>({open(){},close:()=>true}));
 index.openBookRemovalDialog=Ports.prototype.openBookRemovalDialog.bind(index);
 return index.bookRemovalConfirmation;
}

/** Cold CLI IO has a finite wall-clock admission window, not an assumed number
 * of event-loop turns. This never retries a business action or relaxes a guard. */
export async function waitForMutationOwner(check){
 const deadline=Date.now()+15000;
 while(Date.now()<deadline){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}
 if(check())return;throw Error('bounded current owner wait failed after 15000ms');
}

/** The shared entry SDK fixture does not exercise import publication. Supply
 * its missing real constant/Storage binding here before subscribing the real
 * durable Host; retain the same Scene, Entry, Navigation and ObjectLink. */
export function bindCurrentSdkMutations(x){
 const values=new Map(),AppStorage={get:key=>values.get(key),setOrCreate:(key,value)=>values.set(key,value)};
 const presentation=bookshelfOperationClass('features/bookshelf/presentation/LocalImportPresentationOwner.ts','({LOCAL_IMPORT_PRESENTATION_KEY})');
 const operation=bookshelfOperationClass('features/bookshelf/application/BookshelfOperationOwner.ts','({EMPTY_BOOKSHELF_OPERATION_SNAPSHOT})');
 const Mutations=bookshelfOperationClass('features/bookshelf/presentation/BookshelfMutationPresentation.ets','BookshelfMutationPresentation',
  {Observed:v=>v,...operation,...presentation,readerRecoveryView,AppStorage});
 const {ReaderTransientFeedback,READER_FEEDBACK_EXTENDED_MS}=bookshelfOperationClass('ui/feedback/ReaderTransientFeedback.ts','({ReaderTransientFeedback,READER_FEEDBACK_EXTENDED_MS})',{AppStorage});
 x.idx.transientFeedback=new ReaderTransientFeedback();
 const mutations=field('shelfMutations',x.idx,{BookshelfMutationPresentation:Mutations,READER_FEEDBACK_EXTENDED_MS});
 x.idx.shelfMutations=x.p.properties.sdk.ObservedObject.createNew(mutations,undefined);
 x.scene.updateStateVars({entry:x.entry,detail:x.idx.detailShelf,mutations:x.idx.shelfMutations,
  identity:x.idx.detailShelf.identity(),foreground:x.idx.detailContentIsForeground(),directoryRetained:x.idx.isDetailDirectoryRoute(),mutationEnabled:x.idx.detailShelf.mutationEnabled(x.entry.book)});
 return x.idx.shelfMutations;
}

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {installedEtsCompiler} from './ets-compiler-runtime.mjs';
import {selectedProductionMethods} from './selected-production-methods.mjs';
import {pureModuleProbe} from './ets-pure-module-probe.mjs';
import {actualReadingEntryPresentation} from './reading-entry-presentation-probe.mjs';
import {readerRecoveryView} from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import {errorMessageOf,localReadFailureSummary} from '../../entry/src/main/ets/app/ErrorMessage.ts';
import {BookshelfViewState} from '../../entry/src/main/ets/features/bookshelf/presentation/BookshelfViewState.ts';
import * as names from '../../entry/src/main/ets/features/bookshelf/application/BookshelfSourceNameProjection.ts';
import * as headerMetrics from '../../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
import {readerFoundationTokens} from './reader-tokens-probe.mjs';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(specifier+'.ts',context);throw error;}}});
const [{SearchViewState},{SearchPublication},{resolveBookshelfBook},{searchCandidateRank},{readerSourceCategoryIsText},{diagnosticCodeOf},{readingFailureHint},{readerSurfaceRectValid}]=await Promise.all([
 import('../../entry/src/main/ets/features/search/presentation/SearchViewState.ts'),
 import('../../entry/src/main/ets/features/search/presentation/SearchPublication.ts'),
 import('../../entry/src/main/ets/features/bookshelf/application/BookshelfBookIdentity.ts'),
 import('../../entry/src/main/ets/features/search/presentation/SearchCandidatePolicy.ts'),
 import('../../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts'),
 import('../../entry/src/main/ets/app/LogPrivacy.ts'),
 import('../../entry/src/main/ets/features/reading/presentation/ReadingFailurePresentation.ts'),
 import('../../entry/src/main/ets/ui/layout/ReaderSurfaceRect.ts')
]);
const root=new URL('../../entry/src/main/ets/',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const emit=(path,exports,deps={})=>pureModuleProbe(read(path),path,{Observed:value=>value,...deps},exports);
const {ReaderNavigation}=emit('app/navigation/ReaderNavigation.ts',['ReaderNavigation']);
const {ReaderLibraryJourney}=emit('app/composition/ReaderLibraryJourney.ets',['ReaderLibraryJourney']);
const {readerPageInitialHeaderHeight}=emit('ui/foundation/ReaderHeaderSpecs.ets',['readerPageInitialHeaderHeight'],
 {...headerMetrics,...readerFoundationTokens});
const {sameBookshelfProjectionScene}=emit('features/bookshelf/presentation/BookshelfReadPresentation.ets',['sameBookshelfProjectionScene']);
const {ReaderLibrarySearchModel}=emit('features/search/presentation/ReaderLibrarySearchModel.ets',['ReaderLibrarySearchModel']);
const {SearchHost}=emit('features/search/application/SearchHost.ets',['SearchHost'],{SearchViewState,SearchPublication,
 SearchOrchestrator:class {constructor(){assert.fail('query/network scheduling is outside shelf projection');}}});
const {LibrarySearchPresentation}=emit('features/search/presentation/LibrarySearchPresentation.ets',['LibrarySearchPresentation'],
 {ReaderLibrarySearchModel,SearchHost,readerPageInitialHeaderHeight,readerSurfaceRectValid,
  resolveBookshelfBook,searchCandidateRank,readerSourceCategoryIsText,diagnosticCodeOf,errorMessageOf,readingFailureHint});
export function currentLibraryShelfChrome(isVisible=()=>false,isDetailCurrent=()=>false){return new LibrarySearchPresentation(isVisible,isDetailCurrent);}
const {BookshelfCatalogPresentation}=emit('features/bookshelf/presentation/BookshelfCatalogPresentation.ets',
 ['BookshelfCatalogPresentation'],{hilog:{warn(){}},sameBookshelfProjectionScene});
const {EMPTY_BOOKSHELF_OPERATION_SNAPSHOT}=emit('features/bookshelf/application/BookshelfOperationOwner.ts',['EMPTY_BOOKSHELF_OPERATION_SNAPSHOT']);
const {LOCAL_IMPORT_PRESENTATION_KEY}=emit('features/bookshelf/presentation/LocalImportPresentationOwner.ts',['LOCAL_IMPORT_PRESENTATION_KEY']);
const {BookshelfMutationPresentation}=emit('features/bookshelf/presentation/BookshelfMutationPresentation.ets',['BookshelfMutationPresentation'],
 {EMPTY_BOOKSHELF_OPERATION_SNAPSHOT,LOCAL_IMPORT_PRESENTATION_KEY,readerRecoveryView});
const {BookshelfNavigationPresentation}=emit('features/bookshelf/ui/BookshelfNavigationPresentation.ets',['BookshelfNavigationPresentation'],
 {FrameCallback:class {}});
const Reading=actualReadingEntryPresentation();
export const currentProjectionIndexMembers=['isCurrentRuntime','currentReadingRuntime','bookshelfProjectionScene',
 'isCurrentBookshelfPresentation','isInteractiveBookshelfPresentation','bookshelfContentAcceptsInput','bookshelfModalVisible',
 'shelfFilter','refreshBookshelf','applyBookshelfState','invalidateBookshelfProjection','refreshSearchShelfMembership',
 'sourceDisplayName','libraryJourneyPorts','bookshelfScenePorts','publishNavigation','navigateTo','registerTemporaryBackBridge'];

/** Execute the exact current Index initializer, not a fixture reimplementation
 * of projection delivery, membership, or accepted-shelf routing. */
function indexField(field,receiver,deps){
 const {ts,options}=installedEtsCompiler(),source=read('pages/Index.ets');
 const tree=ts.createSourceFile('Index.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 assert.deepEqual(tree.parseDiagnostics,[]);
 const members=tree.statements.find(node=>node.name?.text==='Index').members.filter(node=>node.name?.getText(tree)===field);
 assert.equal(members.length,1,'one current Index field '+field);assert.ok(members[0].initializer);
 const code=ts.transpileModule('const result='+members[0].initializer.getText(tree)+';',
 {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(...Object.keys(deps),code+';return result;').call(receiver,...Object.values(deps));
}
function currentReadTypes(storage){
 return emit('features/bookshelf/presentation/BookshelfReadPresentation.ets',
 ['BookshelfReadPresentation'],{BookshelfViewState,readerRecoveryView,readerPageInitialHeaderHeight,...names,
  errorMessageOf,localReadFailureSummary,AppStorage:storage,hilog:{warn(){},error(){}}});
}
export function currentReadPresentation(ports={},storage={get:()=>undefined}){
 const {BookshelfReadPresentation}=currentReadTypes(storage);return new BookshelfReadPresentation(ports);
}
let sequence=0;
export function currentProjectionFixture(runtime,types,{filter={sourceKind:'all',contentKind:'all'},initial,identity}={}){
 const storageValues=new Map([['readerBookshelfSourceFilter',filter.sourceKind??'all'],['readerBookshelfContentFilter',filter.contentKind??'all']]);
 const storage={get:key=>storageValues.get(key),setOrCreate:(key,value)=>storageValues.set(key,value)};
 const Index=selectedProductionMethods(new URL('pages/Index.ets',root),'Index',currentProjectionIndexMembers,
 {ReaderRuntimeOwner:types.ReaderRuntimeOwner,LOCAL_SOURCE_ID:'local'});
 const index=new Index(),navigation=new ReaderNavigation(),member=[],accepted=[],faults=[],scheduling=[];
 Object.assign(index,{navigationOwner:navigation,mountedRuntimeOwner:runtime,shelfReceiptRetired:false,
  detailShelfAdmissionMount:1,rssInstanceIdentity:identity??++sequence,route:navigation.snapshot().route,
  navigationGeneration:navigation.snapshot().generation,searchAppForeground:true,arkWebCapturesInput:false,
  readingEntry:new Reading(),readingEntryActions:{shelfPreparing:false},
  shelfMutations:{snapshot:{},hasUnknownWrite:()=>false},shelfGroupPresentation:{identity:''},
  bookRemovalConfirmation:{dismiss(){}},jsonImportPresentation:{dismiss(){}},
  sourceSwitchPresentation:{namedCandidate:undefined},
  libraryAcquisition:{currentOwner:()=>types.ReaderRuntimeOwner.isCurrent(runtime)?runtime:undefined},
  settingsPresentation:{snapshot:{reduceMotion:false,tapBottomScrollTop:false}},
  sourceJourney:{snapshot:()=>({sources:sources.registry,tools:{sources:sources.tools}})},

  preparePersistedShelfBooks:()=>scheduling.push('prepare'),traceStartupStage:(...args)=>scheduling.push(args),
  beginStartupStage:()=>0,endStartupStage(){},
  prepareVisibleReadingBooks(){assert.fail('old physical callbacks cannot prepare books');},
  openShelfBookWithMotion(){assert.fail('old physical callbacks cannot open a book');},
  openShelfBookInfo(){assert.fail('old physical callbacks cannot open detail');},
 });
 const sources={registry:[],tools:[],search:[]};
 index.librarySearch=currentLibraryShelfChrome(()=>index.route==='search'&&types.ReaderRuntimeOwner.isCurrent(runtime));
 index.librarySearch.mount();
 const updateMembership=index.librarySearch.host.updateShelf.bind(index.librarySearch.host);
 index.librarySearch.host.updateShelf=books=>{member.push(books);return updateMembership(books);};
 index.bookshelfHost=new types.Host(()=>{},()=>true,()=>runtime);
 const {BookshelfReadPresentation}=currentReadTypes(storage);
 index.shelfRead=indexField('shelfRead',index,{BookshelfReadPresentation});
 index.shelfMutations=indexField('shelfMutations',index,{BookshelfMutationPresentation});
 index.shelfMotion=indexField('shelfMotion',index,{BookshelfNavigationPresentation});
 index.shelfCatalog=new BookshelfCatalogPresentation({scene:()=>index.bookshelfProjectionScene(),
  catalog:owner=>index.bookshelfHost.catalog(owner),automaticAllowed:()=>false,revision:()=>index.shelfRead.snapshot.revision,
  filter:()=>index.shelfRead.filter(),project:state=>index.shelfRead.accept(state,true),
  prefetch:async()=>{},feedback(){}});
 index.libraryJourney=indexField('libraryJourney',index,{ReaderLibraryJourney});
 const accept=index.libraryJourney.acceptShelfState.bind(index.libraryJourney);
 index.libraryJourney.acceptShelfState=state=>{accepted.push(state);return accept(state);};
 index.navigateTo('bookshelf');index.publishNavigation(navigation.advance());
 index.shelfRead.attach();
 const owner=index.bookshelfHost.projection(runtime);
 if(initial!==undefined)index.applyBookshelfState(initial);
 return {index,read:index.shelfRead,reading:index.readingEntry,catalog:index.shelfCatalog,owner,navigation,storage,storageValues,
  sources,member,accepted,faults,scheduling,
  advance(){index.publishNavigation(navigation.advance());},show:route=>index.navigateTo(route),
  domainRefresh:filter=>owner.refresh(filter,index.shelfRead.binding,false),
 };
}

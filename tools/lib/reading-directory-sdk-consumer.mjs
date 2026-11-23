import { actualReadingEntryPresentation, bindReadingEntryFixtureFields } from './reading-entry-presentation-probe.mjs';
import { actualReaderDirectoryOperations, directoryOperationIndexMembers, installDirectoryOperationIndex } from './reader-directory-operations-probe.mjs';
import assert from 'node:assert/strict';
import {errorMessageOf} from '../../entry/src/main/ets/app/ErrorMessage.ts';
import {ReaderTransientFeedback} from '../../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts';
import {downloadBookFromReadingDetail} from '../../entry/src/main/ets/features/reading/presentation/ReadingBookDetail.ts';
import {readFileSync} from 'node:fs';
import {fixture,deferred,until,book,session,bookmarkInput} from './reading-operation-durable-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {selectedProductionMethods} from './selected-production-methods.mjs';
import {pureModuleProbe} from './ets-pure-module-probe.mjs';
import {installedEtsCompiler} from './ets-compiler-runtime.mjs';
import {bookshelfOperationClass} from './bookshelf-operation-owner-probe.mjs';
const {readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY}=await import('../../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
const {readingOfflineFailureHint}=await import('../../entry/src/main/ets/features/reading/presentation/ReadingOfflineFailurePresentation.ts');
// Reuse the real SDK-emitted atomic Store + cold Core authority in other Index consumers.
export {fixture as actualCacheAuthorityFixture};
export const read=p=>readFileSync(new URL('../../entry/src/main/ets/'+p,import.meta.url),'utf8');
export const indexSource=read('pages/Index.ets');
const methods=['currentReaderPresentationIdentity','showOfflineDownloadFeedback','isCurrentRuntime','externalDirectory',
 'directoryNavigationPorts','isDirectoryOpeningCurrent'];
const callbacks=['onReconcileBookmarks','onContinueBookmarks','onReconcileOffline','onContinueOffline'];
const {readerDirectoryActions}=pureModuleProbe(read('features/reading/presentation/ReaderDirectoryActions.ets'),
 'ReaderDirectoryActions.ets',{},['readerDirectoryActions']);
function bindLegacyDirectoryPorts(index){
 const operations=()=>index.directoryJourney.operations;
 Object.defineProperty(index,'directoryOperations',{get:operations,configurable:true});
 Object.assign(index,{
  directoryOperationScene:()=>index.directoryJourney.operationScene(),
  deleteDirectoryBookmarks:times=>operations().deleteBookmarks(times),
  createDirectoryChapterStartBookmark:request=>operations().createChapterStart(request),
  toggleReaderPageBookmark:request=>operations().togglePageBookmark(request),
  controlBookmarkProjectionMessage:()=>operations().bookmarkMessage(index.readingEntry.directoryOperation),
  directoryRecovery:()=>operations().recovery(index.readingEntry.directoryOperation,index.readingEntry.offlineOperation),
  reconcileDirectoryOperation:(generation,identity,continuing=false)=>operations().reconcileBookmarks(generation,identity,continuing),
  reconcileOfflineOperation:(generation,identity,continuing=false)=>operations().reconcileOffline(generation,identity,continuing),
  loadControlBookmarks:(sourceId,bookId,current)=>operations().loadControlBookmarks(sourceId,bookId,current),
  downloadDirectoryChapter:chapter=>operations().downloadChapter(chapter),
  downloadDirectoryBook:()=>operations().downloadBook(),
  loadDirectoryOperationProjections:()=>operations().loadDirectory(),
 });
}
export function makeIndex(f,{remote=false,mount=1,index=indexSource,domain='all',operationSource}={}){
 assert.ok(domain==='all'||domain==='bookmark','supported Index consumer domain');
 const ReaderDirectoryOperations=actualReaderDirectoryOperations({ReaderDirectoryHost:f.Directory,ReadingOfflineHost:f.Offline,...f.types},operationSource);
 if(domain==='bookmark'){
  assert.equal(index,indexSource,'bookmark case uses actual current Index source');
  const names=['isCurrentRuntime',...directoryOperationIndexMembers];
  const Index=selectedProductionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),'Index',names,{
   ReaderDirectoryOperations,
   ReaderRuntimeOwner:f.Runtime,readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY,DOMAIN:0,hilog:{warn(){},error(){}}});
  const actor = new Index();
  actor.readingEntry = new (actualReadingEntryPresentation())();
  bindReadingEntryFixtureFields(Index.prototype);
  const idx=Object.assign(actor,{directoryOperation:undefined,offlineOperation:undefined,directoryPresentationGeneration:0,
   mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:mount,navigationGeneration:1,
   remoteSessionGeneration:1,readingEntryScopeId:0,readingSessionActive:true,route:'directory',detailBook:{...book},
   detailToc:structuredClone(f.entries()),getReadingEntryHost:()=>undefined});
  Object.assign(idx,{navigationOwner:{snapshot:()=>({route:idx.route,generation:idx.navigationGeneration,directoryReturnTarget:'detail'})},
   sourceSwitchPresentation:{isSurfacePresented:()=>false},mangaSourceSwitch:{selectionVisible:false},
   currentReadingRuntime:()=>f.runtime});
  installDirectoryOperationIndex(idx,{ReaderDirectoryHost:f.Directory,ReadingOfflineHost:f.Offline,...f.types});
  bindLegacyDirectoryPorts(idx);
  return {idx,domain:'bookmark',boundary:'actual ordinary Index bookmark methods; no recovery UI, offline/download/Settings owners'};
 }

 const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const leaves={};
 for(const [name,path] of [['BookDirectoryPage','features/reading/ui/BookDirectoryPage.ets'],['ReaderFullDirectory','features/reading/ui/ReaderFullDirectory.ets']]){
  const definition=read(path);p.hooks.childSources[name]=definition;
  // The catalog retains the original operation contract while its foreground
  // defers recovery presentation. These leaves deliberately contain no actors.
  assert.doesNotMatch(definition,/\bReaderDirectoryRecoverySurface\s*\(/,name+' defers original recovery presentation');
  leaves[name]=createReaderBuilderProbe(definition,['directoryRecovery',...callbacks],
    {...p.deps,EMPTY_READING_DIRECTORY_RECOVERY},p.hooks).Component;
 }
 const destination=read('features/reading/ui/ReaderDirectoryDestination.ets');
 p.hooks.childSources.ReaderDirectoryDestination=destination;
 const ReaderDirectoryDestination=createReaderBuilderProbe(destination,boundedMembers(destination),{
  ...p.deps,EMPTY_READING_DIRECTORY_RECOVERY,...leaves},p.hooks).Component;
 const detailSource=read('features/reading/ui/DetailDirectoryScene.ets');
 p.hooks.childSources.DetailDirectoryScene=detailSource;
 const compiler=installedEtsCompiler();
 assert.match(read('features/reading/presentation/ReadingEntryPresentation.ets'),/@Observed\s+export class ReadingEntryPresentation/);
 compiler.require(compiler.root+'/lib/validate_ui_syntax.js').observedClassCollection.add('ReadingEntryPresentation');
 const DetailDirectoryScene=createReaderBuilderProbe(detailSource,boundedMembers(detailSource),{
  ...p.deps,SynchedPropertyNesedObjectPU:p.properties.sdk.SynchedPropertyNestedObjectPU,
  EMPTY_READING_DIRECTORY_RECOVERY,readerDirectoryActions,ReaderDirectoryDestination},p.hooks).Component;
 const ReaderDirectoryJourney=bookshelfOperationClass('app/composition/ReaderDirectoryJourney.ets','ReaderDirectoryJourney',
  {ReaderDirectoryOperations,hilog:{warn(){},error(){}}});
 const idx=p.consumer(index,['directoryOperation','offlineOperation','offlineOperationActive','directoryPresentationGeneration',...methods],{
  ReaderDirectoryOperations,ReaderDirectoryJourney,ReaderRuntimeOwner:f.Runtime,ReaderTransientFeedback,downloadBookFromReadingDetail,
  readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY,readingOfflineFailureHint,errorMessageOf,DOMAIN:0,hilog:{warn(){},error(){}},...leaves,ReaderDirectoryDestination,DetailDirectoryScene});
 Object.assign(idx,{mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:mount,navigationGeneration:1,
  remoteSessionGeneration:1,readingEntryScopeId:0,readingSessionActive:true,route:'directory',searchAppForeground:true,detailBook:remote?{...book,sourceId:'source'}:{...book},
  remoteReadingSession:remote?session:undefined,detailToc:structuredClone(f.entries()),getReadingEntryHost:()=>undefined,
  directoryReturnTarget:'detail',mangaSourceSwitch:{selectionVisible:false},settingsPresentation:{snapshot:{reduceMotion:false}},
  isKnownDetailChapter:index=>idx.detailToc.some(e=>e.index===index),getUIContext:()=>({getPromptAction:()=>({showToast(){}})})});
 idx.navigationOwner.snapshot=()=>({route:idx.route,generation:idx.navigationGeneration,directoryReturnTarget:idx.directoryReturnTarget});
 idx.currentReadingRuntime=()=>f.runtime;
 const helpers=selectedProductionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),'Index',
  ['directoryNavigationPorts','isDirectoryOpeningCurrent']);
 for(const name of ['directoryNavigationPorts','isDirectoryOpeningCurrent'])idx[name]=helpers.prototype[name];
 bindLegacyDirectoryPorts(idx);
 function render(name='BookDirectoryPage'){
  if(idx.detailBook!==undefined)idx.detailBook.contentKind=name==='BookDirectoryPage'?'manga':'text';
  idx.externalDirectory();
  const detail=[...idx.children.values()].find(child=>child instanceof DetailDirectoryScene);
  assert.ok(detail);detail.initialRender();
  const scene=[...detail.children.values()].find(child=>child instanceof ReaderDirectoryDestination);
  assert.ok(scene);scene.aboutToAppear();scene.initialRender();
  const leaf=[...scene.children.values()].find(child=>child instanceof leaves[name]);
  assert.ok(leaf);leaf.initialRender();
  assert.equal(p.walk(leaf).filter(child=>child instanceof p.deps.ReaderRecoveryAction).length,0,
   'the actual standalone directory contract has no recovery action actor');
  return leaf;
 }
 const nodes=leaf=>p.nodes(leaf), actions=leaf=>p.walk(leaf).filter(c=>c instanceof p.deps.ReaderRecoveryAction);
 const originalIntent=(leaf,family,continuing=false)=>{
  assert.ok(family==='bookmarks'||family==='offline');
  const recovery=leaf.directoryRecovery,generation=recovery[family].generation,identity=recovery.presentationId;
  const callback=leaf[family==='bookmarks'?(continuing?'onContinueBookmarks':'onReconcileBookmarks'):
   (continuing?'onContinueOffline':'onReconcileOffline')];
  assert.equal(typeof callback,'function');
  // Explicit finite intent port through actual Scene/Destination callback
  // props. This is business delivery and makes no button or physical-hit claim.
  return()=>callback(generation,identity);
 };
 return {p,idx,render,actions,nodes,originalIntent,leaves,
  boundary:'Actual SDK Scene/Destination retained DTO/callback contract. Recovery actors are deferred; originalIntent is an explicit finite business event port.'};
}
export async function settled(f){await until(()=>!f.directory.busy()&&!f.offline.busy());await new Promise(r=>setTimeout(r,5));}

export async function settledBookmarks(f){await until(()=>!f.directory.busy());await new Promise(resolve=>setImmediate(resolve));}

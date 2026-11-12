import { actualReadingEntryPresentation, bindReadingEntryFixtureFields } from './reading-entry-presentation-probe.mjs';
import { actualReaderDirectoryOperations, directoryOperationIndexMembers } from './reader-directory-operations-probe.mjs';
import assert from 'node:assert/strict';
import {errorMessageOf} from '../../entry/src/main/ets/app/ErrorMessage.ts';
import {ReaderTransientFeedback} from '../../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts';
import {downloadBookFromReadingDetail} from '../../entry/src/main/ets/features/reading/presentation/ReadingBookDetail.ts';
import {readFileSync} from 'node:fs';
import {fixture,deferred,until,book,session,bookmarkInput} from './reading-operation-durable-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {selectedProductionMethods} from './selected-production-methods.mjs';
const {readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY}=await import('../../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
const {readingOfflineFailureHint}=await import('../../entry/src/main/ets/features/reading/presentation/ReadingOfflineFailurePresentation.ts');
// Reuse the real SDK-emitted atomic Store + cold Core authority in other Index consumers.
export {fixture as actualCacheAuthorityFixture};
export const read=p=>readFileSync(new URL('../../entry/src/main/ets/'+p,import.meta.url),'utf8');
export const indexSource=read('pages/Index.ets');
const methods=['applyOwnedDirectoryEntries','deleteDirectoryBookmarks','createDirectoryChapterStartBookmark','toggleReaderPageBookmark',
 'controlBookmarkProjectionMessage','directoryRecovery','reconcileDirectoryOperation','reconcileOfflineOperation','loadControlBookmarks',
 'downloadDirectoryChapter','downloadDirectoryBook','currentDownloadBook','requestReaderDownloads','currentReaderPresentationIdentity','showOfflineDownloadFeedback','isCurrentRuntime','externalDirectory','loadDirectoryOperationProjections'];
const callbacks=['onReconcileBookmarks','onContinueBookmarks','onReconcileOffline','onContinueOffline'];
export function makeIndex(f,{remote=false,mount=1,index=indexSource,domain='all',operationSource}={}){
 assert.ok(domain==='all'||domain==='bookmark','supported Index consumer domain');
 const ReaderDirectoryOperations=actualReaderDirectoryOperations({ReaderDirectoryHost:f.Directory,ReadingOfflineHost:f.Offline,...f.types},operationSource);
 if(domain==='bookmark'){
  assert.equal(index,indexSource,'bookmark case uses actual current Index source');
  const names=['applyOwnedDirectoryEntries',
   'deleteDirectoryBookmarks','createDirectoryChapterStartBookmark','toggleReaderPageBookmark',
   'controlBookmarkProjectionMessage','directoryRecovery','reconcileDirectoryOperation','loadControlBookmarks','isCurrentRuntime',
   ...directoryOperationIndexMembers.filter(name=>name!=='applyOwnedDirectoryEntries')];
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
  return {idx,domain:'bookmark',boundary:'actual ordinary Index bookmark methods; no recovery UI, offline/download/Settings owners'};
 }

 const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const src=read('features/reading/ui/ReaderDirectoryRecoverySurface.ets');p.hooks.childSources.ReaderDirectoryRecoverySurface=src;
 const Recovery=createReaderBuilderProbe(src,boundedMembers(src),{...p.deps,EMPTY_READING_DIRECTORY_RECOVERY,ReaderTransientFeedback},p.hooks).Component;
 const leaves={};
 for(const [name,path] of [['BookDirectoryPage','features/reading/ui/BookDirectoryPage.ets'],['ReaderFullDirectory','features/reading/ui/ReaderFullDirectory.ets']]){
  const definition=read(path);p.hooks.childSources[name]=definition;
  // Exercise the actual leaf recovery Builder/Prop payload and every shared
  // actor. Native list/layout/removal remains a separate full SDK/device gate.
  leaves[name]=createReaderBuilderProbe(definition,['directoryRecovery',...callbacks,'recoveryContent'],
    {...p.deps,ReaderDirectoryRecoverySurface:Recovery,EMPTY_READING_DIRECTORY_RECOVERY},p.hooks).Component;
  assert.match(definition,/this\.recoveryContent\(\)/,name+' build consumes the same real Builder');
 }
 const destination=read('features/reading/ui/ReaderDirectoryDestination.ets');
 p.hooks.childSources.ReaderDirectoryDestination=destination;
 const ReaderDirectoryDestination=createReaderBuilderProbe(destination,boundedMembers(destination),{
  ...p.deps,EMPTY_READING_DIRECTORY_RECOVERY,...leaves},p.hooks).Component;
 const idx=p.consumer(index,['directoryOperation','offlineOperation','offlineOperationActive','directoryPresentationGeneration',...methods],{
  ReaderDirectoryOperations,ReaderRuntimeOwner:f.Runtime,ReaderTransientFeedback,downloadBookFromReadingDetail,
  readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY,readingOfflineFailureHint,errorMessageOf,DOMAIN:0,hilog:{warn(){},error(){}},...leaves,ReaderDirectoryDestination});
 Object.assign(idx,{mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:mount,navigationGeneration:1,
  remoteSessionGeneration:1,readingEntryScopeId:0,readingSessionActive:true,route:'directory',searchAppForeground:true,detailBook:remote?{...book,sourceId:'source'}:{...book},
  remoteReadingSession:remote?session:undefined,detailToc:structuredClone(f.entries()),getReadingEntryHost:()=>undefined,
  directoryReturnTarget:'detail',mangaSourceSwitch:{selectionVisible:false},settingsPresentation:{snapshot:{reduceMotion:false}},
  isKnownDetailChapter:index=>idx.detailToc.some(e=>e.index===index),getUIContext:()=>({getPromptAction:()=>({showToast(){}})})});
 function render(name='BookDirectoryPage'){
  let leaf;
  if(name==='BookDirectoryPage'){
   // The production detail route now sends text books through
   // ReaderFullDirectory. This helper explicitly exercises the manga leaf
   // recovery surface, so select the manga branch before invoking the real
   // external-directory Builder.
   if (idx.detailBook !== undefined) idx.detailBook.contentKind = 'manga';
   idx.externalDirectory();
   const scene=[...idx.children.values()].find(c=>c instanceof ReaderDirectoryDestination);
   scene.aboutToAppear();
   scene.initialRender();
   leaf=[...scene.children.values()].find(c=>c instanceof leaves.BookDirectoryPage);
  }
  else leaf=new leaves.ReaderFullDirectory(undefined,{directoryRecovery:idx.directoryRecovery(),
    onReconcileBookmarks:(g,i)=>idx.reconcileDirectoryOperation(g,i),onContinueBookmarks:(g,i)=>idx.reconcileDirectoryOperation(g,i,true),
    onReconcileOffline:(g,i)=>idx.reconcileOfflineOperation(g,i),onContinueOffline:(g,i)=>idx.reconcileOfflineOperation(g,i,true)});
  leaf.recoveryContent();return leaf;
 }
 const nodes=leaf=>p.nodes(leaf), actions=leaf=>p.walk(leaf).filter(c=>c instanceof p.deps.ReaderRecoveryAction);
 const click=(leaf,label)=>{const actor=actions(leaf).find(c=>c.label===label);assert.ok(actor,label+' actual shared native actor');
  const node=[...actor.nodes.values()].find(n=>n.onClick);assert.equal(node.constraintSize.minHeight,actor.variant==='notice'?28:44);assert.equal(node.borderRadius,actor.variant==='notice'?4:12);node.onClick();return actor;};
 return {p,idx,render,actions,nodes,click,leaves,Recovery};
}
export async function settled(f){await until(()=>!f.directory.busy()&&!f.offline.busy());await new Promise(r=>setTimeout(r,5));}
export function pRecovery(p,leaf,type){return p.walk(leaf).find(c=>c instanceof type);}

export async function settledBookmarks(f){await until(()=>!f.directory.busy());await new Promise(resolve=>setImmediate(resolve));}

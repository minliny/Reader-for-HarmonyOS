import assert from 'node:assert/strict';
import {errorMessageOf} from '../../entry/src/main/ets/app/ErrorMessage.ts';
import {readFileSync} from 'node:fs';
import {fixture,deferred,until,book,session,bookmarkInput} from './reading-operation-durable-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
const {readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY}=await import('../../entry/src/main/ets/features/reading/ReadingDirectoryRecovery.ts');
const {readingOfflineFailureHint}=await import('../../entry/src/main/ets/features/reading/ReadingOfflineFailurePresentation.ts');
// Reuse the real SDK-emitted atomic Store + cold Core authority in other Index consumers.
export {fixture as actualCacheAuthorityFixture};
export const read=p=>readFileSync(new URL('../../entry/src/main/ets/'+p,import.meta.url),'utf8');
export const indexSource=read('pages/Index.ets');
const methods=['getReaderDirectoryHost','getReadingOfflineHost','directoryOperationPresentationId','isCurrentDirectoryOperationPresentation',
 'directoryOperationBindingId','isCurrentDirectoryOperationBinding','directoryBinding','offlineBinding','applyOwnedDirectoryEntries','deleteDirectoryBookmarks','createDirectoryChapterStartBookmark','toggleReaderPageBookmark',
 'controlBookmarkProjectionMessage','directoryRecovery','reconcileDirectoryOperation','reconcileOfflineOperation','loadControlBookmarks',
 'downloadDirectoryChapter','downloadDirectoryBook','submitReaderDownload','currentDownloadBook','requestReaderDownloads','currentReaderPresentationIdentity','clearDirectoryBookOffline','offlineDownloadFeedback','showOfflineDownloadFeedback','showChapterDownloadFailure',
 'isCurrentRuntime','externalDirectory','loadDirectoryOperationProjections'];
const callbacks=['onReconcileBookmarks','onContinueBookmarks','onReconcileOffline','onContinueOffline'];
export function makeIndex(f,{remote=false,mount=1,index=indexSource}={}){
 const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const src=read('features/reading/ReaderDirectoryRecoverySurface.ets');p.hooks.childSources.ReaderDirectoryRecoverySurface=src;
 const Recovery=createReaderBuilderProbe(src,boundedMembers(src),{...p.deps,EMPTY_READING_DIRECTORY_RECOVERY},p.hooks).Component;
 const leaves={};
 for(const [name,path] of [['BookDirectoryPage','features/bookshelf/BookDirectoryPage.ets'],['ReaderFullDirectory','features/reading/ReaderFullDirectory.ets']]){
  const definition=read(path);p.hooks.childSources[name]=definition;
  // Exercise the actual leaf recovery Builder/Prop payload and every shared
  // actor. Native list/layout/removal remains a separate full SDK/device gate.
  leaves[name]=createReaderBuilderProbe(definition,['directoryRecovery',...callbacks,'recoveryContent'],
    {...p.deps,ReaderDirectoryRecoverySurface:Recovery,EMPTY_READING_DIRECTORY_RECOVERY},p.hooks).Component;
  assert.match(definition,/this\.recoveryContent\(\)/,name+' build consumes the same real Builder');
 }
 const idx=p.consumer(index,['directoryOperation','offlineOperation','offlineOperationActive','directoryPresentationGeneration',...methods],{
  ReaderDirectoryHost:f.Directory,ReadingOfflineHost:f.Offline,...f.types,ReaderRuntimeOwner:f.Runtime,
  readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY,readingOfflineFailureHint,errorMessageOf,DOMAIN:0,hilog:{warn(){},error(){}},...leaves});
 Object.assign(idx,{mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:mount,navigationGeneration:1,
  remoteSessionGeneration:1,readingEntryScopeId:0,readingSessionActive:true,route:'directory',detailBook:remote?{...book,sourceId:'source'}:{...book},
  remoteReadingSession:remote?session:undefined,detailToc:structuredClone(f.entries()),getReadingEntryHost:()=>undefined,
  isKnownDetailChapter:index=>idx.detailToc.some(e=>e.index===index),getUIContext:()=>({getPromptAction:()=>({showToast(){}})})});
 function render(name='BookDirectoryPage'){
  let leaf;
  if(name==='BookDirectoryPage'){
   // The production detail route now sends text books through
   // ReaderFullDirectory. This helper explicitly exercises the manga leaf
   // recovery surface, so select the manga branch before invoking the real
   // external-directory Builder.
   if (idx.detailBook !== undefined) idx.detailBook.contentKind = 'manga';
   idx.externalDirectory();leaf=[...idx.children.values()].find(c=>c instanceof leaves.BookDirectoryPage);
  }
  else leaf=new leaves.ReaderFullDirectory(undefined,{directoryRecovery:idx.directoryRecovery(),
    onReconcileBookmarks:(g,i)=>idx.reconcileDirectoryOperation(g,i),onContinueBookmarks:(g,i)=>idx.reconcileDirectoryOperation(g,i,true),
    onReconcileOffline:(g,i)=>idx.reconcileOfflineOperation(g,i),onContinueOffline:(g,i)=>idx.reconcileOfflineOperation(g,i,true)});
  leaf.recoveryContent();return leaf;
 }
 const nodes=leaf=>p.nodes(leaf), actions=leaf=>p.walk(leaf).filter(c=>c instanceof p.deps.ReaderRecoveryAction);
 const click=(leaf,label)=>{const actor=actions(leaf).find(c=>c.label===label);assert.ok(actor,label+' actual shared native actor');
  const node=[...actor.nodes.values()].find(n=>n.onClick);assert.equal(node.height,36);assert.equal(node.borderRadius,6);node.onClick();return actor;};
 return {p,idx,render,actions,nodes,click,leaves,Recovery};
}
export async function settled(f){await until(()=>!f.directory.busy()&&!f.offline.busy());await new Promise(r=>setTimeout(r,5));}
export function pRecovery(p,leaf,type){return p.walk(leaf).find(c=>c instanceof type);}

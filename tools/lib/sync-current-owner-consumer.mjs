import assert from 'node:assert/strict';
import { readFileSync, fstatSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolveEtsLoaderRoot } from './tool-environment.mjs';
import { selectedProductionMethods } from './selected-production-methods.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { actualReadingEntryPresentation } from './reading-entry-presentation-probe.mjs';
import { ReaderNavigation } from '../../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { isReaderProductSurfaceEnabled } from '../../entry/src/main/ets/app/ReaderProductScope.ts';
const root=new URL('../../entry/src/main/ets/',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');
const indexSource=read('pages/Index.ets'),surfaceSource=read('features/sync/ui/SyncSurface.ets'),pageSource=read('features/sync/ui/SyncPage.ets');
const openings=new WeakMap();let instance=0;
class Carrier {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(next){Object.assign(this.params,next);}}
export const currentSyncPresentationSource=()=>read('features/sync/presentation/SyncPresentation.ets');
export const currentSyncIdentity=index=>index.syncPresentation.identity;
export const currentSyncOperations=index=>index.syncPresentation.operations(currentSyncIdentity(index));
export function reopenCurrentSyncOpening(index){const args=openings.get(index);assert.ok(args);index.syncPresentation.open(...args);}

/** Windows Node cannot fsync a directory handle (EPERM). Keep all real
 * AtomicFile/file writes and file fsyncs, but require an explicit controlled
 * Harmony platform receipt for this one unavailable boundary. This is not
 * evidence of native directory durability and never alters a Store method. */
export function syncDirectoryFsyncFixturePort(fileIo,directorySync){
 const original=fileIo.fsync;
 if(process.platform!=='win32')return()=>{};
 assert.equal(typeof directorySync,'function');
 fileIo.fsync=async fd=>{
  if(!fstatSync(fd).isDirectory())return original(fd);
  const receipt=await directorySync();
  assert.equal(receipt,'CONTROLLED_PLATFORM_DIRECTORY_SYNC_ACK','explicit directory sync receipt required');
 };
 return()=>{fileIo.fsync=original;};
}

/** Current root wiring, current feature binding and real Navigation. The
 * compatibility gate is an explicit test port; product L0 stays closed.
 * Unrelated retirement fanout is a delivery port, never a business success. */
export function currentSyncIndex(f,runtime,{enabled=()=>isReaderProductSurfaceEnabled('sync'),presentationSource=currentSyncPresentationSource()}={}){
 assert.equal(isReaderProductSurfaceEnabled('sync'),false,'real L0 Sync admission remains closed');
 const {SyncPresentation}=pureModuleProbe(presentationSource,'SyncPresentation.ets',{
  Observed:value=>value,SyncOrchestrator:f.Orchestrator,DEFAULT_SYNC_SNAPSHOT:f.DEFAULT_SYNC_SNAPSHOT},['SyncPresentation']);
 const Index=selectedProductionMethods(new URL('pages/Index.ets',root),'Index',[
  'openSync','syncIdentity','isCurrentRuntime','isCurrentRoute','nextNavigationGeneration','publishNavigation','navigateTo'],
  {ReaderRuntimeOwner:f.ReaderRuntimeOwner,isReaderProductSurfaceEnabled:()=>enabled()});
 const navigation=new ReaderNavigation();navigation.show('settings');
 const presentation=new SyncPresentation(),Reading=actualReadingEntryPresentation();
 const dormant=()=>({retire(){}});
 const index=Object.assign(new Index(),{navigationOwner:navigation,route:'settings',navigationGeneration:0,
  shelfReceiptRetired:false,detailShelfAdmissionMount:1,rssInstanceIdentity:++instance,mountedRuntimeOwner:runtime,
  syncPresentation:presentation,readingEntry:new Reading(),bookRemovalConfirmation:{dismiss(){}},jsonImportPresentation:{dismiss(){}},
  shelfMotion:{clear(){}},transientFeedback:{reset(){}},downloadPresentation:dormant(),readingCommits:dormant(),settingsPresentation:dormant(),
  sourceJourney:dormant(),retireSourceSwitchPresentation(){},rssJourney:dormant(),shelfCatalog:dormant(),shelfMutations:{retireSelection(){}},
  shelfManagement:dormant(),shelfGroupPresentation:dormant(),discoverPresentation:dormant(),rulesPresentation:dormant(),nativeAlertOwner:dormant(),
  readingEntryActions:{retirePreparation(){}},expandedLayout:()=>false,
  settingsNavigation:{returnToSettings(){assert.fail('live return journey is outside this finite stale-callback probe');}}});
 const open=presentation.open.bind(presentation);presentation.open=(...args)=>{openings.set(index,args);return open(...args);};
 return index;
}

/** Execute both current SDK layers. Index only builds SyncSurface; callbacks
 * below come from actual SyncSurface, never a reconstructed Index API. */
export function currentSyncPayload(index,{parent}={}){
 if(parent===undefined){parent=createReaderBuilderProbe(indexSource,['syncContent','syncIdentity'],{SyncSurface:Carrier},
  {allowEmptyBranchAdmission:true,childSources:{SyncSurface:surfaceSource}}).owner;Object.assign(parent,index);parent.syncContent();}
 else {Object.assign(parent,index);parent.replay();}
 const carrier=[...parent.children.values()].at(-1);assert.ok(carrier?.params?.presentation);
 // Metadata matches the production imported @Observed class. No owner state
 // is copied or aliased back onto retired Index fields.
 const syntax=createRequire(import.meta.url)(resolveEtsLoaderRoot()+'/lib/validate_ui_syntax.js');
 syntax.observedClassCollection.add('SyncPresentation');
 const surface=createReaderBuilderProbe(surfaceSource,['build','preparingFrame','preparingContent'],{SyncPage:Carrier},
  {childSources:{SyncPage:pageSource}}).owner;
 Object.assign(surface,carrier.params);assert.equal(surface.presentation.ready,true,'actual binding is ready before a Page payload');surface.initialRender();
 const page=[...surface.children.values()].find(child=>child.params?.onSaveConfig);assert.ok(page,'actual Surface builds Page callbacks');
 return {parent,carrier,surface,page,props:page.params};
}

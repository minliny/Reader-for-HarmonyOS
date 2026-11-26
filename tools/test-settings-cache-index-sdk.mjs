import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const {readFileSync}=await import('node:fs');
const {fixture:productionFixture,until,seedLegacySettingsClear,cleanupDurableFixtures}=await import('./lib/reading-operation-durable-probe.mjs');
const {makeIndex: makeDirectory,settled}=await import('./lib/reading-directory-sdk-consumer.mjs');
const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
const {ReaderNativeAlertOwner}=await import('./lib/reader-native-alert-sdk-probe.mjs');
const {readerRecoveryView}=await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const {effectiveReaderWideNavigationRail}=await import('../entry/src/main/ets/app/ReaderProductScope.ts');
const read=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const emit=(path,type,deps={})=>pureModuleProbe(read(path),path,deps,[type])[type];
const createDefaultSettingsSnapshot=emit('features/settings/application/SettingsGateway.ts','createDefaultSettingsSnapshot');
const ReaderSettingsJourney=emit('app/composition/ReaderSettingsJourney.ets','ReaderSettingsJourney');
class ScenePayload {
 constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}
 updateStateVars(params){Object.assign(this.params,params);}
}
async function makeSettings(f){
 const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),pageSource=read('features/settings/ui/SettingsPage.ets');
 const SettingsPresentation=emit('features/settings/presentation/SettingsPresentation.ets','SettingsPresentation',{
  Observed:value=>value,SettingsHost:f.SettingsHost,createDefaultSettingsSnapshot,effectiveReaderWideNavigationRail,AppStorage:{setOrCreate(){}}});
 const presentation=new SettingsPresentation();
 const sceneSource=read('app/composition/SettingsScenes.ets');
 const idx=createReaderBuilderProbe(read('pages/Index.ets'),['settingsContent','settingsPaintCurrent','settingsNavigationPorts',
  'rulesManagementInputAllowed','isCurrentRuntime','currentReadingRuntime'],
  {ReaderRuntimeOwner:f.Runtime,SettingsScenes:ScenePayload},{childSources:{SettingsScenes:sceneSource}}).owner;
 Object.assign(idx,{route:'settings',navigationGeneration:1,detailShelfAdmissionMount:1,mountedRuntimeOwner:f.runtime,
  shelfReceiptRetired:false,rssInstanceIdentity:1,settingsSection:'general',settingsPresentation:presentation,
  searchAppForeground:true,arkWebCapturesInput:false,jsonImportPresentation:{opening:undefined},expandedLayout:()=>false,
  libraryAcquisition:{currentOwner:()=>f.Runtime.current()}});
 idx.navigationOwner={snapshot:()=>({route:idx.route,generation:idx.navigationGeneration})};
 const journey=new ReaderSettingsJourney(idx.navigationOwner,idx.settingsNavigationPorts());
 journey.openPresentation('settings');
 assert.equal(presentation.isCurrent(presentation.identity),true);
 await until(()=>!f.settings.current().busy);
 idx.settingsContent('settings');
 const scene=createReaderBuilderProbe(sceneSource,['inputIsCurrent','settings'],{SettingsPage:ScenePayload},
  {childSources:{SettingsPage:pageSource}}).owner;
 Object.assign(scene,[...idx.children.values()].find(child=>child instanceof ScenePayload).params);
 scene.settings(presentation.identity);
 const payload=[...scene.children.values()].find(child=>child instanceof ScenePayload);
 const pageNames=['operation','cacheCleanup','isOpeningCurrent','isInputAllowed','onReconcile','onRetryAccepted','onReconcileCache',
  'onContinueCache','onClearCache','appForeground','operationFeedback','pendingFeedback','pendingFeedbackItems','recovery',
  'hasPendingSettings','hasPendingCleanup','hasPendingAppearanceSave','appearanceSaveRecovery','recoveryIdentityFor','capturedPendingAction',
  'controlPlacementRecovery','hasPendingControlPlacement','controlPlacementPending',
  'recoveryActionIdentities','recoveryActionKind','recoveryActionGeneration','recoveryActionLabel','recoveryActionCurrent','dispatchRecoveryAction',
  'settingsInputIsCurrent','openSelect','resetInFlight','onCacheCleanupChanged','cacheFeedbackIdentity','lastCacheFeedback',
  'mounted','themeOwner','temporaryBackIdentity','showFeedbackToast','transientFeedback','lastOperationToast'];
 const page=p.consumer(pageSource,pageNames,{ReaderRuntimeOwner:f.Runtime,readerRecoveryView,ReaderNativeAlertOwner},payload.params);
 Object.assign(page,{mounted:true,themeOwner:f.runtime,temporaryBackIdentity:'settings:initial',appThemeScheme:'day',appForeground:true});
 let rendered=false;
 const render=()=>{
  scene.replay();
  page.updateStateVars(payload.params);
  if(!rendered){page.operationFeedback();page.pendingFeedback();rendered=true;}
  else page.replay();
  p.properties.flush();
  return page;
 };
 const actors=page=>p.walk(page).filter(child=>child instanceof p.deps.ReaderRecoveryAction);
 const native=(page,label)=>{
  const actor=actors(page).find(child=>child.label===label);
  assert.ok(actor,label);
  const button=p.nodes(actor).find(node=>node.type==='Button'&&node.onClick);
  assert.ok(button,'actual recovery button binds its native callback');
  return button.onClick;
 };
 return {idx,presentation,render,actors,native,clear:()=>payload.params.onClearCache()};
}
const checks=[];

const fixture=async(...a)=>{const f=await productionFixture(...a);console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...f.toolEvidence()}));return f;};let passed=false;

try{
if(id==='safe-unknown'){
for(const boundary of ['before','after']){
 const f=await fixture(true),s=await makeSettings(f);f.options[boundary==='before'?'beforeMethod':'afterMethod']='cache.storage.cleanup';
 await s.clear();assert.equal(s.presentation.cacheCleanup.confirmation,'unknown');
 const oldPage=s.render(),oldActor=s.native(oldPage,'核对'),writes=f.writes().length;oldActor();
 assert.equal(f.settings.current().busy,true,'current native action reaches the original cache reconciliation owner');
 await until(()=>!f.settings.current().busy);assert.equal(f.writes().length,writes);
 assert.equal(s.presentation.cacheCleanup.confirmation,'unknown');assert.equal(s.presentation.cacheCleanup.canContinueOriginal,false);
 const page=s.render();assert.equal(s.actors(page).some(actor=>actor.label==='继续'),false,'unknown safe cleanup has no blind replay actor');
 checks.push('actual-Settings-safe-text-ACK-'+boundary+'-pure-private-read-no-replay');
}
}
if(id==='retained-action'){
{
 const f=await fixture(true),s=await makeSettings(f);f.options.beforeMethod='cache.storage.cleanup';await s.clear();
 const page=s.render(),actor=s.actors(page).find(c=>c.label==='核对'),old=s.native(page,'核对');
 const before=f.calls.length;s.idx.navigationGeneration++;old();await new Promise(setImmediate);assert.equal(f.calls.length,before,'old Index page callback cannot borrow new navigation');
 s.idx.navigationGeneration--;page.temporaryBackIdentity='settings:new';page.replay();old();await new Promise(setImmediate);assert.equal(f.calls.length,before,'retained actor never adopts new physical presentation');
 assert.notEqual(actor.generation,undefined);f.unset();old();await new Promise(setImmediate);assert.equal(f.calls.length,before);
 checks.push('actual-settings-close-reopen-V1-retained-physical-and-runtime-unset');
}
}
if(id==='legacy-global'){
for(const boundary of ['before','after']){
 const warm=await fixture(true);warm.options[boundary==='before'?'beforeMethod':'afterMethod']='cache.clear';await seedLegacySettingsClear(warm);
const original=JSON.parse(warm.disk('cacheClear'));
 const f=await fixture(true,warm),directory=makeDirectory(f,{remote:true});f.options.status=true;
 await f.offline.load(directory.idx.directoryOperations.offlineBinding(f.runtime,directory.idx.remoteReadingSession));await settled(f);
 const operation=directory.idx.offlineOperation;assert.equal(operation.sourceId,'cache');assert.equal(operation.bookId,'global-text');
 assert.equal(operation.projection.receipt.confirmation,'unknown');assert.equal(operation.canContinueOriginal,false);
 const recovery=directory.idx.directoryRecovery();assert.match(recovery.offline.message,/原全局.*返回设置/);assert.equal(recovery.offlineBlocked,true);
 const leaf=directory.render('ReaderFullDirectory');assert.equal(directory.actions(leaf).length,0,'foreign origin has no wrong-book reconcile/continue action');
 const writes=f.writes().length;directory.idx.downloadDirectoryChapter(0);directory.idx.directoryOperations.clearOffline();await settled(f);assert.equal(f.writes().length,writes,'original pending global clear blocks new book mutation');
 const settings=await makeSettings(f);
 await settings.presentation.reconcileCache(settings.presentation.identity,undefined);assert.equal(f.writes().length,writes,'cold opening is pure exact receipt query, never a new clear');
 if(boundary==='before'){
  assert.equal(settings.presentation.cacheCleanup.confirmation,'unknown');const page=settings.render();
  assert.equal(settings.actors(page).some(actor=>actor.label==='继续'),false);
  assert.equal(f.writes().length,writes,'unsafe historical global scope cannot be continued');
  assert.deepEqual(JSON.parse(f.disk('cacheClear')).params,original.params);
 }else assert.equal(settings.presentation.cacheCleanup.confirmation,'confirmed');
 await f.offline.load(directory.idx.directoryOperations.offlineBinding(f.runtime,directory.idx.remoteReadingSession));await settled(f);
 assert.equal(directory.idx.directoryRecovery().offlineBlocked,boundary==='before');
 assert.equal(directory.idx.directoryRecovery().offline.visible,boundary==='before');
 assert.equal(directory.idx.offlineOperation.projection.receipt.confirmation,'unknown','absence of original intent changes capacity only, never invents this book ACK');
 checks.push('cold-original-global-intent-other-book-capacity-and-original-settings-authority-'+boundary);
}
}
passed=true;}finally{const cleanup=await cleanupDurableFixtures({retain:!passed});if(!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));}
}
const definitions={"safe-unknown": "safe-unknown actual scoped owner/gateway/storage path; controlled Core/OS ports", "retained-action": "retained-action actual scoped owner/gateway/storage path; controlled Core/OS ports", "legacy-global": "legacy-global actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}

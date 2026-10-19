import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const {readFileSync}=await import('node:fs');
const {fixture:productionFixture,until,seedLegacySettingsClear,cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/reading-operation-durable-probe.mjs');
const {makeIndex: makeDirectory,settled}=await import('./lib/reading-directory-sdk-consumer.mjs');
const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
const {ReaderNativeAlertOwner}=await import('./lib/reader-native-alert-sdk-probe.mjs');
const {readerRecoveryView}=await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const read=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
function makeSettings(f,{mount=1}={}){
 const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),pageSource=read('features/settings/SettingsPage.ets');
 const pageNames=['operation','cacheCleanup','onReconcile','onRetryAccepted','onReconcileCache','onContinueCache','onClearCache',
  'operationFeedback','pendingFeedback','recovery','feedbackMessage','recoveryActionIdentities','recoveryActionKind','recoveryActionGeneration','recoveryActionLabel','recoveryActionCurrent','dispatchRecoveryAction',
  'clearTextCache','applyCacheCleanup','onCacheCleanupChanged','mounted','themeOwner','temporaryBackIdentity','resetMessage','cacheCleanupInFlight','cacheActionLabel'];
 const pageDeps={ReaderRuntimeOwner:f.Runtime,readerRecoveryView,ReaderNativeAlertOwner};p.hooks.childSources.SettingsPage=pageSource;
 const leaf=p.consumer(pageSource,pageNames,pageDeps).constructor;
 const idx=p.consumer(read('pages/Index.ets'),['settingsSnapshot','settingsOperation','settingsCacheCleanup','settingsContent','settingsSurface','bindSettingsPresentation','retireSettingsPresentation','isCurrentSettingsPresentation','isCurrentRuntime','reconcileSettingsCache','clearTextCache'],
  {ReaderRuntimeOwner:f.Runtime,SettingsPage:leaf,deviceInfo:{deviceType:'phone'}});
 Object.assign(idx,{route:'settings',navigationGeneration:1,detailShelfAdmissionMount:mount,mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,
  rssInstanceIdentity:1,settingsPresentationIdentity:'',settingsSnapshot:{autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:false,crashLog:true,developerMode:false},settingsOperation:{action:'load'},settingsSection:'general'});
 const host=new f.SettingsHost(()=>{},()=>idx.settingsSnapshot,()=>idx.route==='settings',()=>f.runtime.getUIAbilityContext(),()=>{},(snapshot,owner)=>{if(idx.isCurrentRuntime(owner)&&idx.route==='settings')idx.settingsCacheCleanup=snapshot;});
 idx.settingsHost=host;assert.equal(idx.bindSettingsPresentation(),true);
 let rendered=false;const render=()=>{if(!rendered){idx.settingsContent();rendered=true;}else idx.replay();const page=[...idx.children.values()].find(c=>c instanceof leaf);Object.assign(page,{mounted:true,themeOwner:f.runtime,temporaryBackIdentity:'settings:'+mount,appThemeScheme:'day'});page.operationFeedback();page.pendingFeedback();return page;};
 const actors=page=>p.walk(page).filter(c=>c instanceof p.deps.ReaderRecoveryAction);
 const native=(page,label)=>{const a=actors(page).find(c=>c.label===(label==='核对清理结果'?'核对':label));assert.ok(a,label);const n=[...a.nodes.values()].find(n=>n.onClick);assert.equal(n.type,'Stack');return n.onClick;};
 return{idx,host,p,render,actors,native};
}
const checks=[];

const fixture=async(...a)=>{const f=await productionFixture(...a);console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...f.toolEvidence()}));return f;};let passed=false;

try{
if(id==='safe-unknown'){
for(const boundary of ['before','after']){
 const f=await fixture(true),s=makeSettings(f);f.options[boundary==='before'?'beforeMethod':'afterMethod']='cache.storage.cleanup';
 await s.idx.clearTextCache();assert.equal(s.idx.settingsCacheCleanup.confirmation,'unknown');
 const oldPage=s.render(),oldActor=s.native(oldPage,'核对清理结果'),writes=f.writes().length;oldActor();
 await until(()=>!f.settings.current().busy);assert.equal(f.writes().length,writes);
 assert.equal(s.idx.settingsCacheCleanup.confirmation,'unknown');assert.equal(s.idx.settingsCacheCleanup.canContinueOriginal,false);
 const page=s.render();assert.equal(s.actors(page).some(actor=>actor.label==='继续原操作'),false,'unknown safe cleanup has no blind replay actor');
 checks.push('actual-Settings-safe-text-ACK-'+boundary+'-pure-private-read-no-replay');
}
}
if(id==='retained-action'){
{
 const f=await fixture(true),s=makeSettings(f);f.options.beforeMethod='cache.storage.cleanup';await s.idx.clearTextCache();
 const page=s.render(),actor=s.actors(page).find(c=>c.label==='核对'),old=s.native(page,'核对清理结果');
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
 const f=await fixture(true,warm),directory=makeDirectory(f,{remote:true}),settings=makeSettings(f);f.options.status=true;
 await f.offline.load(directory.idx.offlineBinding(f.runtime,directory.idx.remoteReadingSession));await settled(f);
 const operation=directory.idx.offlineOperation;assert.equal(operation.sourceId,'cache');assert.equal(operation.bookId,'global-text');
 assert.equal(operation.projection.receipt.confirmation,'unknown');assert.equal(operation.canContinueOriginal,false);
 const recovery=directory.idx.directoryRecovery();assert.match(recovery.offline.message,/原全局.*返回设置/);assert.equal(recovery.offlineBlocked,true);
 const leaf=directory.render('ReaderFullDirectory');assert.equal(directory.actions(leaf).length,0,'foreign origin has no wrong-book reconcile/continue action');
 const writes=f.writes().length;directory.idx.downloadDirectoryChapter(0);directory.idx.clearDirectoryBookOffline();await settled(f);assert.equal(f.writes().length,writes,'original pending global clear blocks new book mutation');
 await settings.idx.reconcileSettingsCache(undefined);assert.equal(f.writes().length,writes,'cold opening is pure exact receipt query, never a new clear');
 if(boundary==='before'){
  assert.equal(settings.idx.settingsCacheCleanup.confirmation,'unknown');const page=settings.render();
  assert.equal(settings.actors(page).some(actor=>actor.label==='继续原操作'),false);
  assert.equal(f.writes().length,writes,'unsafe historical global scope cannot be continued');
  assert.deepEqual(JSON.parse(f.disk('cacheClear')).params,original.params);
 }else assert.equal(settings.idx.settingsCacheCleanup.confirmation,'confirmed');
 await f.offline.load(directory.idx.offlineBinding(f.runtime,directory.idx.remoteReadingSession));await settled(f);
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

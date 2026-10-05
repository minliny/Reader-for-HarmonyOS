import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,until} from './lib/reading-operation-durable-probe.mjs';
import {makeIndex as makeDirectory,settled} from './lib/reading-directory-sdk-consumer.mjs';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {ReaderNativeAlertOwner} from './lib/reader-native-alert-sdk-probe.mjs';
import {readerRecoveryView} from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
const read=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
function makeSettings(f,{mount=1}={}){
 const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),pageSource=read('features/settings/SettingsPage.ets');
 const pageNames=['operation','cacheCleanup','onReconcile','onRetryAccepted','onReconcileCache','onContinueCache','onClearCache',
  'operationFeedback','recovery','feedbackMessage','recoveryActionIdentities','recoveryActionKind','recoveryActionGeneration','recoveryActionLabel','recoveryActionCurrent','dispatchRecoveryAction',
  'clearTextCache','applyCacheCleanup','onCacheCleanupChanged','mounted','themeOwner','temporaryBackIdentity','resetMessage','cacheCleanupInFlight','cacheActionLabel'];
 const pageDeps={ReaderRuntimeOwner:f.Runtime,readerRecoveryView,ReaderNativeAlertOwner};p.hooks.childSources.SettingsPage=pageSource;
 const leaf=p.consumer(pageSource,pageNames,pageDeps).constructor;
 const idx=p.consumer(read('pages/Index.ets'),['settingsSnapshot','settingsOperation','settingsCacheCleanup','settingsContent','settingsSurface','bindSettingsPresentation','retireSettingsPresentation','isCurrentSettingsPresentation','isCurrentRuntime','reconcileSettingsCache','clearTextCache'],
  {ReaderRuntimeOwner:f.Runtime,SettingsPage:leaf,deviceInfo:{deviceType:'phone'}});
 Object.assign(idx,{route:'settings',navigationGeneration:1,detailShelfAdmissionMount:mount,mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,
  rssInstanceIdentity:1,settingsPresentationIdentity:'',settingsSnapshot:{autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:false,crashLog:true},settingsOperation:{action:'load'},settingsSection:'general'});
 const host=new f.SettingsHost(()=>{},()=>idx.settingsSnapshot,()=>idx.route==='settings',()=>f.runtime.getUIAbilityContext(),()=>{},(snapshot,owner)=>{if(idx.isCurrentRuntime(owner)&&idx.route==='settings')idx.settingsCacheCleanup=snapshot;});
 idx.settingsHost=host;assert.equal(idx.bindSettingsPresentation(),true);
 let rendered=false;const render=()=>{if(!rendered){idx.settingsContent();rendered=true;}else idx.replay();const page=[...idx.children.values()].find(c=>c instanceof leaf);Object.assign(page,{mounted:true,themeOwner:f.runtime,temporaryBackIdentity:'settings:'+mount,appThemeScheme:'day'});page.operationFeedback();return page;};
 const actors=page=>p.walk(page).filter(c=>c instanceof p.deps.ReaderRecoveryAction);
 const native=(page,label)=>{const a=actors(page).find(c=>c.label===label);assert.ok(a,label);const n=[...a.nodes.values()].find(n=>n.onClick);assert.equal(n.height,36);assert.equal(n.borderRadius,6);return n.onClick;};
 return{idx,host,p,render,actors,native};
}
const checks=[];
for(const boundary of ['before','after']){
 const f=await fixture(true),s=makeSettings(f);f.options[boundary==='before'?'beforeMethod':'afterMethod']='cache.clear';
 await s.idx.clearTextCache();assert.equal(s.idx.settingsCacheCleanup.confirmation,'unknown');const original=JSON.parse(f.disk('cacheClear'));
 const oldPage=s.render(),oldActor=s.native(oldPage,'核对清理结果'),writes=f.writes().length;oldActor();
 await until(()=>!f.settings.current().busy);assert.equal(f.writes().length,writes);
 if(boundary==='after')assert.equal(s.idx.settingsCacheCleanup.confirmation,'confirmed');
 else{
  assert.equal(s.idx.settingsCacheCleanup.confirmation,'unknown');assert.equal(s.idx.settingsCacheCleanup.canContinueOriginal,true);
  const page=s.render();const continueNative=s.native(page,'继续原操作');continueNative();continueNative();await until(()=>!f.settings.current().busy);
  assert.equal(f.writes().length,2);assert.deepEqual(f.writes()[1].params,original.params);assert.equal(s.idx.settingsCacheCleanup.confirmation,'confirmed');
 }
 checks.push('actual-Settings-Index-decorated-Page-native-pure-read-and-explicit-original-'+boundary);
}
{
 const f=await fixture(true),s=makeSettings(f);f.options.beforeMethod='cache.clear';await s.idx.clearTextCache();
 await s.idx.reconcileSettingsCache(s.idx.settingsCacheCleanup.operation.generation);const page=s.render(),actor=s.actors(page).find(c=>c.label==='继续原操作'),old=s.native(page,'继续原操作');
 const before=f.writes().length;s.idx.navigationGeneration++;old();await new Promise(setImmediate);assert.equal(f.writes().length,before,'old actual Index page callback cannot borrow new navigation');
 s.idx.navigationGeneration--;page.temporaryBackIdentity='settings:new';page.replay();old();await new Promise(setImmediate);assert.equal(f.writes().length,before,'retained actor never adopts the new physical presentation');
 assert.notEqual(actor.generation,undefined);f.unset();old();await new Promise(setImmediate);assert.equal(f.writes().length,before,'runtime unavailable safely refuses old mutation');
 checks.push('actual-settings-close-reopen-V1-retained-physical-and-runtime-unset');
}
for(const boundary of ['before','after']){
 const warm=await fixture(true);warm.options[boundary==='before'?'beforeMethod':'afterMethod']='cache.clear';await warm.settings.clear(()=>true);
 assert.equal(warm.settings.current().confirmation,'unknown');const original=JSON.parse(warm.disk('cacheClear'));
 const f=await fixture(true,warm),directory=makeDirectory(f,{remote:true}),settings=makeSettings(f);f.options.status=true;
 await f.offline.load(directory.idx.offlineBinding(f.runtime,directory.idx.remoteReadingSession));await settled(f);
 const operation=directory.idx.offlineOperation;assert.equal(operation.sourceId,'cache');assert.equal(operation.bookId,'global-text');
 assert.equal(operation.projection.receipt.confirmation,'unknown');assert.equal(operation.canContinueOriginal,false);
 const recovery=directory.idx.directoryRecovery();assert.match(recovery.offline.message,/原全局.*返回设置/);assert.equal(recovery.offlineBlocked,true);
 const leaf=directory.render('ReaderFullDirectory');assert.equal(directory.actions(leaf).length,0,'foreign origin has no wrong-book reconcile/continue action');
 const writes=f.writes().length;directory.idx.downloadDirectoryChapter(0);directory.idx.clearDirectoryBookOffline();await settled(f);assert.equal(f.writes().length,writes,'original pending global clear blocks new book mutation');
 await settings.idx.reconcileSettingsCache(undefined);assert.equal(f.writes().length,writes,'cold opening is pure exact receipt query, never a new clear');
 if(boundary==='before'){
  assert.equal(settings.idx.settingsCacheCleanup.confirmation,'unknown');const page=settings.render();settings.native(page,'继续原操作')();await until(()=>!f.settings.current().busy);
  assert.equal(f.writes().length,writes+1);assert.deepEqual(f.writes().at(-1).params,original.params);
 }else assert.equal(settings.idx.settingsCacheCleanup.confirmation,'confirmed');
 await f.offline.load(directory.idx.offlineBinding(f.runtime,directory.idx.remoteReadingSession));await settled(f);
 assert.equal(directory.idx.directoryRecovery().offlineBlocked,false);assert.equal(directory.idx.directoryRecovery().offline.visible,false);
 assert.equal(directory.idx.offlineOperation.projection.receipt.confirmation,'unknown','absence of original intent changes capacity only, never invents this book ACK');
 checks.push('cold-original-global-intent-other-book-capacity-and-original-settings-authority-'+boundary);
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual installed SDK emit / actual CacheClear atomic store + cold Core SQLite / Index Page and native shared actions; native scheduling/layout/visual acceptance separate'}));

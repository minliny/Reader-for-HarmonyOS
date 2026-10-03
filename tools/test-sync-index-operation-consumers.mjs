import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {syncIndexFixture as f,fullSyncIndexPage} from './lib/sync-index-real-fixture.mjs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {ReaderNativeAlertOwner} from '../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
const clone=v=>structuredClone(v),methods=['isCurrentSyncOwner','isCurrentSyncPresentation','isCurrentRoute','getSyncOrchestrator',
  'onSyncSaveConfig','onSyncTestConnection','onSyncTriggerBackup','onSyncRestoreLatest','onSyncResolveRestore','nextNavigationGeneration'];
let enabled=true;
const deps={ReaderRuntimeOwner:f.ReaderRuntimeOwner,SyncOrchestrator:f.Orchestrator,isReaderProductSurfaceEnabled:()=>enabled,deviceInfo:{deviceType:'phone'}};
const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),methods,deps);
const syntax=createRequire(import.meta.url)((process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader')+'/lib/validate_ui_syntax.js');
for(const [name,path]of[['SyncPage','sync'],['ReaderRecoveryNotice','common'],['ReaderRecoveryAction','common']]){
  syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...f.source('features/'+path+'/'+name+'.ets').matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
}
class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
class Card extends Child{initialRender(){this.params.content?.();}}
function fixture(){
  enabled=true;const index=Object.assign(new Index(),{nativeAlertOwner:new ReaderNativeAlertOwner(),route:'sync',navigationGeneration:1,
    shelfReceiptRetired:false,syncSnapshot:clone(f.DEFAULT_SYNC_SNAPSHOT),syncSnapshotReady:false});
  const real=f.fixture({createOwner:()=>index.getSyncOrchestrator()});
  let parent;
  const props=()=>{parent=createReaderBuilderProbe(f.source('pages/Index.ets'),['syncContent','syncSurface'],{...deps,SyncPage:Child},{allowEmptyBranchAdmission:true}).owner;
    Object.assign(parent,index);for(const name of methods)parent[name]=index[name].bind(index);parent.syncContent();return [...parent.children.values()].at(-1).params;};
  const page=()=>{
    const p=createReaderBuilderProbe(f.source('features/sync/SyncPage.ets'),['manualActionsSection','sectionHeadingMuted','restoreConflictCard','feedbackView','recoveryLabel','canMutate','manualActionButton'],
      {readerRecoveryView:f.readerRecoveryView,ReaderRecoveryNotice:Child,ReaderCard:Card},{mountChildren:true,childSources:{ReaderCard:f.source('features/common/ReaderCard.ets')}}).owner;
    Object.assign(p,props(),{contentFrame:()=>({width:390}),appThemeScheme:'day'});p.manualActionsSection();
    const notice=[...p.children.values()].find(c=>c.params.view);
    const n=createReaderBuilderProbe(f.source('features/common/ReaderRecoveryNotice.ets'),['build'],{ReaderRecoveryAction:Child}).owner;
    Object.assign(n,notice.params,{appThemeScheme:'day'});n.initialRender();const actionChild=[...n.children.values()][0];let action;
    if(actionChild){const a=createReaderBuilderProbe(f.source('features/common/ReaderRecoveryAction.ets'),['build']).owner;
      Object.assign(a,actionChild.params,{enabled:true,appThemeScheme:'day'});a.initialRender();action=[...a.nodes.values()].find(v=>v.height===36);}
    return{page:p,view:notice.params.view,action};
  };
  const open=async()=>{real.owner.open();assert.equal(index.syncSnapshotReady,true,'owner loading is an actual usable Page payload');await real.settle();};
  const retry=async()=>{const p=page();assert.ok(p.action);p.action.onClick();p.action.onClick();await real.settle();};
  return{...real,index,props,page,open,retry,parent:()=>parent};
}
{const x=fixture();f.asset.failQuery=true;await x.open();assert.equal(x.index.syncSnapshot.facts.read.fact,'failed');await x.retry();assert.equal(x.index.syncSnapshot.facts.read.fact,'current');assert.equal(f.asset.calls.filter(v=>v==='query').length,2);}
{const x=fixture();await x.open();f.asset.failAdd=true;x.props().onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);await x.settle();assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.confirmation,'unknown');await x.retry();assert.equal(f.asset.calls.filter(v=>v==='add').length,1);assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.fact,'confirmedCurrent','exact secure receipt read confirms the lost save ACK without replay');}
{const x=fixture();await x.open();f.asset.beforeAdd=()=>{f.asset.failQuery=true;};x.props().onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);await x.settle();assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.fact,'confirmedRefreshFailed');await x.retry();assert.equal(f.asset.calls.filter(v=>v==='add').length,1);assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.fact,'confirmedCurrent');assert.doesNotMatch(JSON.stringify(x.index.syncSnapshot),/transient-secret|independent-secret/);}
{const x=fixture();await x.open();const actual=fullSyncIndexPage(x.props());actual.webdavUrl='https://draft.test';actual.webdavUrlEdited=true;actual.webdavPass='typed-secret';actual.backupPass='backup-secret';
  const save=[...actual.nodes.values()].filter(n=>n.type==='Stack'&&n.height===42).at(-1);assert.ok(save.onClick,'actual complete SDK page save handler');f.asset.beforeAdd=()=>{f.asset.failQuery=true;};save.onClick();await x.settle();
  assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.fact,'confirmedRefreshFailed');actual.updateStateVars(x.props());actual.replay();assert.equal(actual.webdavPass,'','actual @Watch clears acknowledged password');assert.equal(actual.webdavUrl,'https://draft.test','edited draft is retained');
  assert.equal([...actual.children.values()].find(c=>c.params.view)?.params.view.canRetry,true,'real updated recovery child sees operation');await x.retry();assert.equal(f.asset.calls.filter(v=>v==='add').length,1);
  x.index.navigationGeneration++;x.index.route='settings';save.onClick();await x.settle();assert.equal(f.asset.calls.filter(v=>v==='add').length,1,'physical old SDK save handler cannot operate the new route');}
{const x=fixture();await x.open();x.runtime.failBackupAdvance=true;x.props().onTriggerBackup();await x.settle();await x.retry();assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.confirmation,'unknown');}
for(const retired of['route','generation','runtime-unset','hidden','unmounted']){
  const x=fixture();await x.open();const p=x.props(),before=f.asset.calls.length,native=x.runtime.calls.length;
  if(retired==='route')x.index.route='settings';if(retired==='generation')x.index.nextNavigationGeneration();if(retired==='runtime-unset'){f.setRuntimeOwner(undefined);assert.throws(()=>f.ReaderRuntimeOwner.current(),/installed by EntryAbility/);}
  if(retired==='hidden')enabled=false;if(retired==='unmounted')x.index.shelfReceiptRetired=true;
  assert.doesNotThrow(()=>{p.onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);p.onTestConnection(f.config.url,f.config.user,'',f.config.directory);p.onTriggerBackup();p.onRestoreLatest();p.onResolveRestore(true);p.onReconcile(0);p.onBack();});
  await x.settle();assert.equal(f.asset.calls.length,before);assert.equal(x.runtime.calls.length,native);f.setRuntimeOwner(x.runtime);
}
{const x=fixture();await x.open();const old=x.props(),parent=x.parent(),child=[...parent.children.values()].at(-1);x.index.navigationGeneration=2;parent.navigationGeneration=2;parent.replay();const next=[...parent.children.values()].at(-1);assert.notEqual(next.id,child.id);old.onTriggerBackup();await x.settle();assert.equal(x.runtime.count('sync.webdav.transaction.start'),0);next.params.onTriggerBackup();await x.settle();assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);}
{const x=fixture();await x.open();const gate=f.pause();x.runtime.beforeApply=()=>gate.promise;x.props().onRestoreLatest();await x.settle();x.props().onResolveRestore(true);await new Promise(r=>setImmediate(r));const atClose=clone(x.index.syncSnapshot);x.index.nextNavigationGeneration();x.index.route='settings';gate.resolve();await x.settle();assert.deepEqual(x.index.syncSnapshot,atClose,'late accepted write cannot publish into closed route');}
{const x=fixture();await x.open();const gate=f.pause();f.asset.beforeAdd=()=>gate.promise;x.props().onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);await new Promise(r=>setImmediate(r));const atRetirement=clone(x.index.syncSnapshot);f.setRuntimeOwner(undefined);gate.resolve();await assert.doesNotReject(x.settle());assert.deepEqual(x.index.syncSnapshot,atRetirement,'accepted durable save settles after actual Runtime unset without late Index publication');assert.equal(f.asset.calls.filter(v=>v==='add').length,1);f.setRuntimeOwner(x.runtime);}
{const x=fixture();await x.open();const old=x.index.getSyncOrchestrator();const y=fixture();const replacement=x.index.getSyncOrchestrator();assert.notEqual(replacement,old);assert.equal(replacement.ownedBy(y.runtime),true);}
console.log('PASS Sync actual AssetStore→Gateway→owner→Index→SDK Page→shared native recovery: usable first failure, true ACK/readback and unknown, no repeated save/backup, stale runtime/navigation/hidden/close callbacks, identity rebind, late accepted restore, secrets omitted');

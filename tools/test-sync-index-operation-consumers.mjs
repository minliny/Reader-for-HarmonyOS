import {foundationControls} from './lib/reader-foundation-control-probe.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {syncIndexFixture as f,fullSyncIndexPage} from './lib/sync-index-real-fixture.mjs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {ReaderNativeAlertOwner} from './lib/reader-native-alert-sdk-probe.mjs';
const nodes=owner=>[...(owner.nodes?.values()??[]),...[...(owner.children?.values()??[])].flatMap(c=>nodes(c))];
const clone=v=>structuredClone(v),methods=['isCurrentSyncOwner','isCurrentSyncPresentation','isCurrentRoute','getSyncOrchestrator',
  'retireRssEditorPresentation','onSyncSaveConfig','onSyncTestConnection','onSyncTriggerBackup','onSyncRestoreLatest','onSyncResolveRestore','nextNavigationGeneration'];
let enabled=true, instanceIdentity=0;
const deps={ReaderRuntimeOwner:f.ReaderRuntimeOwner,SyncOrchestrator:f.Orchestrator,isReaderProductSurfaceEnabled:()=>enabled,deviceInfo:{deviceType:'phone'}};
const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),methods,deps);
const syntax=createRequire(import.meta.url)((process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader')+'/lib/validate_ui_syntax.js');
for(const [name,path]of[['SyncPage','sync'],['ReaderRecoveryNotice','common'],['ReaderRecoveryAction','common']]){
  syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...f.source('features/'+path+'/'+name+'.ets').matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
}
class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
class Card extends Child{initialRender(){this.params.content?.();}}
const durablePrefix=readFileSync(new URL('./test-sync-backup-durable-receipts.mjs',import.meta.url),'utf8').split('try {')[0]
  .replace(/^import[^\n]+\n/gm,'').replace('function fixture({cold=false}={})','function fixture({cold=false,createOwner}={})')
  .replace('f.fixture({preserveAsset:cold})','f.fixture({preserveAsset:cold,createOwner})');
const {fixture:durableFixture,directory:durableDirectory}=new Function('assert','mkdtempSync','readFileSync','writeFileSync','existsSync','rmSync','tmpdir','join','f',
  durablePrefix+';return {fixture,directory};')(assert,mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync,tmpdir,join,f);
function payload(index,indexText=f.source('pages/Index.ets')) {
  const parent=createReaderBuilderProbe(indexText,['syncContent','syncSurface'],{...deps,SyncPage:Child},{allowEmptyBranchAdmission:true}).owner;
  Object.assign(parent,index);for(const name of methods)parent[name]=index[name].bind(index);
  parent.syncContent();return{parent,props:[...parent.children.values()].at(-1).params};
}
function replacementIndex(x,Type=Index) {
  const index=Object.assign(new Type(),{nativeAlertOwner:new ReaderNativeAlertOwner(),route:'sync',navigationGeneration:1,
    shelfReceiptRetired:false,detailShelfAdmissionMount:1,rssInstanceIdentity:++instanceIdentity,
    mountedRuntimeOwner:x.runtime,syncSnapshot:clone(f.DEFAULT_SYNC_SNAPSHOT),syncSnapshotReady:false});
  index.getSyncOrchestrator();return index;
}
function fixture({durable=false}={}){
  enabled=true;const index=Object.assign(new Index(),{nativeAlertOwner:new ReaderNativeAlertOwner(),route:'sync',navigationGeneration:1,
    shelfReceiptRetired:false,detailShelfAdmissionMount:1,rssInstanceIdentity:++instanceIdentity,
    syncSnapshot:clone(f.DEFAULT_SYNC_SNAPSHOT),syncSnapshotReady:false});
  const real=(durable?durableFixture:f.fixture)({createOwner:()=>{index.mountedRuntimeOwner=f.ReaderRuntimeOwner.current();return index.getSyncOrchestrator();}});
  let parent;
  const props=()=>{const actual=payload(index);parent=actual.parent;return actual.props;};
  const page=()=>{
    const shared=foundationControls();
    const p=createReaderBuilderProbe(f.source('features/sync/SyncPage.ets'),['manualActionsSection','canContinueConfigSave','configSaveContinuationIdentities','configSaveGeneration','effectiveWebdavUrl','effectiveWebdavUser','effectiveWebdavPath','sectionHeadingMuted','restoreConflictCard','feedbackView','recoveryLabel','canMutate','manualActionButton','canSkipBackupRetention','backupRetentionActionIdentities','backupGeneration'],
      {...shared.dependencies,readerRecoveryView:f.readerRecoveryView,ReaderRecoveryNotice:Child,ReaderRecoveryAction:Child,ReaderCard:Card},{...shared.hooks,mountChildren:true,childSources:{...shared.hooks.childSources,ReaderCard:f.source('features/common/ReaderCard.ets')}}).owner;
    Object.assign(p,props(),{contentFrame:()=>({width:390}),appThemeScheme:'day'});p.manualActionsSection();
    const notice=[...p.children.values()].find(c=>c.params?.view);
    const n=createReaderBuilderProbe(f.source('features/common/ReaderRecoveryNotice.ets'),['build'],{ReaderRecoveryAction:Child}).owner;
    Object.assign(n,notice.params,{appThemeScheme:'day'});n.initialRender();const actionChild=[...n.children.values()][0];let action;
    if(actionChild){const a=createReaderBuilderProbe(f.source('features/common/ReaderRecoveryAction.ets'),['build']).owner;
      Object.assign(a,actionChild.params,{actionEnabled:true,appThemeScheme:'day'});a.initialRender();action=[...a.nodes.values()].find(v=>v.height===36);}
    return{page:p,view:notice.params.view,action};
  };
  const open=async()=>{real.owner.open();assert.equal(index.syncSnapshotReady,true,'owner loading is an actual usable Page payload');await real.settle();};
  const retry=async()=>{const p=page();assert.ok(p.action);p.action.onClick();p.action.onClick();await real.settle();};
  return{...real,index,props,page,open,retry,parent:()=>parent};
}
{const x=fixture();f.asset.failQuery=true;await x.open();assert.equal(x.index.syncSnapshot.facts.read.fact,'failed');await x.retry();assert.equal(x.index.syncSnapshot.facts.read.fact,'current');assert.equal(f.asset.calls.filter(v=>v==='query').length,2);}
{const x=fixture();await x.open();f.asset.failAdd=true;x.props().onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);await x.settle();assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.confirmation,'unknown');await x.retry();assert.equal(f.asset.calls.filter(v=>v==='add').length,1);assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.fact,'pendingReconciliation','exact immutable preparation alone cannot commit current head');}
{const x=fixture();await x.open();const load=x.store.loadSerializedState.bind(x.store);let fail=true;x.store.loadSerializedState=async()=>{if(fail){fail=false;throw Error('actual post-save read failed');}return load();};x.props().onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);await x.settle();assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.fact,'confirmedRefreshFailed');await x.retry();assert.equal(f.asset.calls.filter(v=>v==='add').length,1);assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.fact,'confirmedCurrent');assert.doesNotMatch(JSON.stringify(x.index.syncSnapshot),/transient-secret|independent-secret/);}
{const x=fixture();await x.open();const actual=fullSyncIndexPage(x.props());actual.webdavUrl='https://draft.test';actual.webdavUrlEdited=true;actual.webdavPass='typed-secret';actual.backupPass='backup-secret';
  const save=nodes(actual).filter(n=>n.type==='Stack'&&n.height===42).at(-1);assert.ok(save.onClick,'actual complete SDK page save handler');const load=x.store.loadSerializedState.bind(x.store);let fail=true;x.store.loadSerializedState=async()=>{if(fail){fail=false;throw Error('actual post-save read failed');}return load();};save.onClick();await x.settle();
  assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.fact,'confirmedRefreshFailed');actual.updateStateVars(x.props());actual.replay();assert.equal(actual.webdavPass,'','actual @Watch clears acknowledged password');assert.equal(actual.webdavUrl,'https://draft.test','edited draft is retained');
  assert.equal([...actual.children.values()].find(c=>c.params?.view)?.params.view.canRetry,true,'real updated recovery child sees operation');await x.retry();assert.equal(f.asset.calls.filter(v=>v==='add').length,1);
  x.index.navigationGeneration++;x.index.route='settings';save.onClick();await x.settle();assert.equal(f.asset.calls.filter(v=>v==='add').length,1,'physical old SDK save handler cannot operate the new route');}
{const x=fixture();await x.open();x.runtime.failBackupAdvance=true;x.props().onTriggerBackup();await x.settle();await x.retry();assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);assert.equal(x.index.syncSnapshot.facts.operation.projection.receipt.confirmation,'unknown');}
for(const retired of['route','generation','runtime-unset','hidden','unmounted']){
  const x=fixture();await x.open();const p=x.props(),before=f.asset.calls.length,native=x.runtime.calls.length;
  if(retired==='route')x.index.route='settings';if(retired==='generation')x.index.nextNavigationGeneration();if(retired==='runtime-unset'){f.setRuntimeOwner(undefined);assert.throws(()=>f.ReaderRuntimeOwner.current(),/installed by EntryAbility/);}
  if(retired==='hidden')enabled=false;if(retired==='unmounted')x.index.shelfReceiptRetired=true;
  assert.doesNotThrow(()=>{p.onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);p.onTestConnection(f.config.url,f.config.user,'',f.config.directory);p.onTriggerBackup();p.onRestoreLatest();p.onResolveRestore(true);p.onReconcile(0);p.onSkipBackupRetention(0);p.onContinueConfigSave(0,f.config.url,f.config.user,'','',f.config.directory);p.onBack();});
  await x.settle();assert.equal(f.asset.calls.length,before);assert.equal(x.runtime.calls.length,native);f.setRuntimeOwner(x.runtime);
}
{const x=fixture();await x.open();const old=x.props(),parent=x.parent(),child=[...parent.children.values()].at(-1);x.index.navigationGeneration=2;x.index.getSyncOrchestrator();Object.assign(parent,x.index);parent.replay();const next=[...parent.children.values()].at(-1);assert.notEqual(next.id,child.id);old.onTriggerBackup();await x.settle();assert.equal(x.runtime.count('sync.webdav.transaction.start'),0);next.params.onTriggerBackup();await x.settle();assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);}
{const x=fixture();await x.open();const gate=f.pause();x.runtime.beforeApply=()=>gate.promise;x.props().onRestoreLatest();await x.settle();x.props().onResolveRestore(true);for(let n=0;x.runtime.count('runtime.storage.apply')===0&&n<2000;n++)await new Promise(r=>setTimeout(r,1));assert.equal(x.runtime.count('runtime.storage.apply'),1);const atClose=clone(x.index.syncSnapshot);x.index.nextNavigationGeneration();x.index.route='settings';gate.resolve();await x.settle();assert.deepEqual(x.index.syncSnapshot,atClose,'late accepted write cannot publish into closed route');}
{const x=fixture();await x.open();const gate=f.pause();f.asset.beforeAdd=()=>gate.promise;x.props().onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);for(let n=0;!f.asset.calls.includes('add')&&n<2000;n++)await new Promise(r=>setTimeout(r,1));assert.ok(f.asset.calls.includes('add'));const atRetirement=clone(x.index.syncSnapshot);f.setRuntimeOwner(undefined);gate.resolve();await assert.doesNotReject(x.settle());assert.deepEqual(x.index.syncSnapshot,atRetirement,'accepted durable save settles after actual Runtime unset without late Index publication');assert.equal(f.asset.calls.filter(v=>v==='add').length,1);f.setRuntimeOwner(x.runtime);}
{const x=fixture();await x.open();const old=x.index.getSyncOrchestrator();const y=fixture();assert.throws(()=>x.index.getSyncOrchestrator(),/已退役/,'old mounted Index never reacquires the successor Runtime');assert.notEqual(y.index.getSyncOrchestrator(),old);assert.equal(y.index.getSyncOrchestrator().ownedBy(y.runtime),true);}
for(const retired of ['live','route','generation','runtime-unset','hidden','unmounted']) {
  const x=fixture({durable:true});await x.open();x.runtime.failBackupAdvance=true;x.props().onTriggerBackup();await x.settle();
  const pending=x.index.syncSnapshot.facts.operation;x.qualifyRemote();x.props().onReconcile(pending.projection.facts.generation);await x.settle();
  assert.equal(x.index.syncSnapshot.facts.operation.uploadQualified,true);assert.equal(x.index.syncSnapshot.facts.operation.completed,false);
  const props=x.props(),actual=fullSyncIndexPage(props),action=[...actual.children.values()].find(c=>c.params?.label==='保留备份，结束清理');
  assert.ok(action,'actual Index → complete decorated SDK Page mounts exact receipt consent action');
  const before=x.runtime.count('sync.webdav.backup.retention.skip');
  if(retired==='route')x.index.route='settings';if(retired==='generation')x.index.nextNavigationGeneration();
  if(retired==='runtime-unset')f.setRuntimeOwner(undefined);if(retired==='hidden')enabled=false;if(retired==='unmounted')x.index.shelfReceiptRetired=true;
  assert.doesNotThrow(()=>action.params.onReconcile(action.params.generation));await x.settle();
  assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),before+(retired==='live'?1:0));
  if(retired==='live') {
    assert.equal(x.index.syncSnapshot.facts.operation.retentionSkipped,true);assert.equal(x.index.syncSnapshot.facts.operation.completed,false);
    assert.equal(x.index.syncSnapshot.facts.canMutate,true);const count=x.runtime.calls.length;
    action.params.onReconcile(action.params.generation);await x.settle();assert.equal(x.runtime.calls.length,count,'retired actual consent actor never replays terminal mutation');
    assert.equal(x.requests.filter(r=>r.method==='PUT').length,1);assert.equal(x.requests.filter(r=>r.method==='DELETE').length,0);
  }
  f.setRuntimeOwner(x.runtime);
}
// The previous durable backup scenarios injected a distinct native Preferences
// adapter. Restore the original fresh-config transport before this independent family.
for (const retired of ['live', 'route', 'generation', 'runtime-unset', 'hidden', 'unmounted', 'replacement-host']) {
  const preferences = new Map();
  f.setPreferences({ async get(key, fallback) { return preferences.has(key) ? preferences.get(key) : fallback; },
    async has(key) { return preferences.has(key); }, async put(key, value) { preferences.set(key, value); },
    async delete(key) { preferences.delete(key); }, async flush() {} });
  const x = fixture(); await x.open(); f.asset.failAdd = true;
  x.props().onSaveConfig(f.config.url, f.config.user, f.config.password, f.config.backupPassword, f.config.directory);
  await x.settle();
  const initial = x.index.syncSnapshot.facts.operation;
  assert.equal(initial.projection.receipt.confirmation, 'unknown');
  x.props().onReconcile(initial.projection.facts.generation); await x.settle();
  const pending = x.index.syncSnapshot.facts.operation;
  assert.equal(pending.projection.receipt.confirmation, 'unknown');
  assert.equal(pending.canContinueOriginal, true);
  const props = x.props(), actual = fullSyncIndexPage(props);
  const original = [...actual.children.values()].find(child => child.params?.label === '继续原操作');
  assert.ok(original, 'actual Index→decorated Page has original config continuation action');
  const identity = pending.operationId, adds = f.asset.calls.filter(v => v === 'add').length;
  if (retired === 'route') x.index.route = 'settings';
  if (retired === 'generation') x.index.nextNavigationGeneration();
  if (retired === 'runtime-unset') f.setRuntimeOwner(undefined);
  if (retired === 'hidden') enabled = false;
  if (retired === 'unmounted') x.index.shelfReceiptRetired = true;
  if (retired === 'replacement-host') x.index.syncOrchestrator = undefined;
  assert.doesNotThrow(() => original.params.onReconcile(original.params.generation)); await x.settle();
  assert.equal(f.asset.calls.filter(v => v === 'add').length, adds, 'exact prepared original never writes a second immutable record');
  if (retired === 'live') {
    assert.equal(x.index.syncSnapshot.facts.operation.completed, true);
    assert.equal(x.index.syncSnapshot.facts.operation.operationId, identity, 'explicit continuation retains original operation identity');
    assert.equal(x.index.syncSnapshot.facts.canMutate, true);
    original.params.onReconcile(original.params.generation); await x.settle();
    assert.equal(f.asset.calls.filter(v => v === 'add').length, adds, 'old physical config continuation cannot replay terminal save');
  } else assert.equal(x.index.syncSnapshot.facts.operation.completed, false, 'retired or replaced owner cannot settle via old physical actor');
  f.setRuntimeOwner(x.runtime);
}
{
 const x=fixture();await x.open();const old=x.props(),oldHost=x.index.getSyncOrchestrator(),oldID=x.index.syncPresentationIdentity;
 const next=replacementIndex(x),currentID=next.syncPresentationIdentity;
 assert.equal(next.getSyncOrchestrator(),oldHost,'same exact Runtime uses one accepted owner');
 assert.equal(x.index.getSyncOrchestrator(),oldHost,'still-alive old getter returns original owner without attaching again');
 assert.equal(oldHost.isPresentationCurrent(currentID),true);assert.equal(oldHost.isPresentationCurrent(oldID),false);
 const before=x.runtime.calls.length,adds=f.asset.calls.length;
 old.onTriggerBackup();old.onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);old.onReconcile(0);old.onBack();
 await x.settle();assert.equal(x.runtime.calls.length,before);assert.equal(f.asset.calls.length,adds);
 oldHost.detachPresentation(oldID);assert.equal(oldHost.isPresentationCurrent(currentID),true,'old exact detach cannot clear successor');
 const actual=fullSyncIndexPage(payload(next).props),trigger=nodes(actual).find(n=>n.type==='Stack'&&n.height===40&&n.onClick);
 assert.ok(trigger?.onClick,'current complete decorated Page retains a usable native backup button');
 trigger.onClick();await x.settle();assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);
 assert.equal(next.syncSnapshot.facts.operation.completed,true);
}
{
 const x=fixture();await x.open();const gate=f.pause();x.runtime.beforeApply=()=>gate.promise;
 x.props().onRestoreLatest();await x.settle();x.props().onResolveRestore(true);
 for(let n=0;x.runtime.count('runtime.storage.apply')===0&&n<2000;n++)await new Promise(r=>setTimeout(r,1));
 assert.equal(x.runtime.count('runtime.storage.apply'),1);const original=x.index.getSyncOrchestrator(),tail=original.operationChain;
 const next=replacementIndex(x),atRetirement=clone(x.index.syncSnapshot);
 assert.equal(next.getSyncOrchestrator(),original);assert.equal(original.operationChain,tail,'replacement cannot reset accepted mutation drain');
 assert.equal(next.syncSnapshot.facts.busy,true);payload(next).props.onTriggerBackup();
 assert.equal(x.runtime.count('sync.webdav.transaction.start'),1,'replacement cannot open a second mutation chain');
 gate.resolve();await x.settle();assert.deepEqual(x.index.syncSnapshot,atRetirement);
 assert.equal(next.syncSnapshot.facts.operation.completed,true,'accepted actual write settles into new same-Runtime presentation');
 assert.equal(x.runtime.count('runtime.storage.apply'),1);
}
{
 const original=f.source('pages/Index.ets'),mutant=original.replace('if (this.syncOrchestrator !== host || this.syncPresentationIdentity !== identity) {','if (true) {');
 assert.notEqual(mutant,original);const candidateDirectory=mkdtempSync(join(tmpdir(),'reader-sync-attach-negative-')),candidate=join(candidateDirectory,'Index.ets');writeFileSync(candidate,mutant);
 const Mutant=productionMotionMethods(candidate,methods,deps);
 const x=fixture();await x.open();const old=Object.assign(new Mutant(),x.index);old.syncOrchestrator=undefined;old.syncPresentationIdentity='';old.getSyncOrchestrator();
 const next=replacementIndex(x,Mutant);assert.equal(x.owner.isPresentationCurrent(next.syncPresentationIdentity),true);
 old.getSyncOrchestrator();assert.equal(x.owner.isPresentationCurrent(next.syncPresentationIdentity),false,'unconditional attach negative control proves old alive getter steals current lease');
 rmSync(candidateDirectory,{recursive:true,force:true});
}
rmSync(durableDirectory,{recursive:true,force:true});
console.log('PASS Sync actual AssetStore→Gateway→owner→Index→SDK Page→shared native recovery: usable first failure, true ACK/readback and unknown, no repeated save/backup, stale runtime/navigation/hidden/close callbacks, identity rebind, late accepted restore, secrets omitted');

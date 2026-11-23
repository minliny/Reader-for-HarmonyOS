import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const { resolveEtsLoaderRoot }=await import("./lib/tool-environment.mjs");
const {boundedSurfaceSdk}=await import("./lib/bounded-surface-sdk-probe.mjs");
const {foundationControls}=await import("./lib/reader-foundation-control-probe.mjs");
const {createRequire}=await import("node:module");
const {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync}=await import("node:fs");
const {tmpdir}=await import("node:os");
const {join}=await import("node:path");
const {syncIndexFixture: f,fullSyncIndexPage: sharedFullSyncIndexPage}=await import("./lib/sync-index-real-fixture.mjs");
const {productionMotionMethods}=await import("./lib/reader-motion-method-probe.mjs");
const {createReaderBuilderProbe}=await import("./lib/reader-control-builder-probe.mjs");
const {ReaderNativeAlertOwner}=await import("./lib/reader-native-alert-sdk-probe.mjs");
const nodes=owner=>[...(owner.nodes?.values()??[]),...[...(owner.children?.values()??[])].flatMap(c=>nodes(c))];
const {actualReaderPageLayout}=await import('./lib/reader-page-shell-runtime-probe.mjs');
const fullSyncIndexPage=props=>sharedFullSyncIndexPage(props,actualReaderPageLayout());
const clone=v=>structuredClone(v);
const {currentSyncIndex,currentSyncPayload,currentSyncIdentity,currentSyncOperations,currentSyncPresentationSource,reopenCurrentSyncOpening,syncDirectoryFsyncFixturePort}=await import('./lib/sync-current-owner-consumer.mjs');
let enabled=true,directorySyncReceipts=0;
let restoreDirectorySync=()=>{};
const {createBackupJournalFixture}=await import('./fixtures/sync/backup-journal-fixture.mjs');let durableScope;const directories=[];const durableFixture=options=>{durableScope??=createBackupJournalFixture();return durableScope.fixture(options);};
function payload(index,parent) { return currentSyncPayload(index,{parent}); }
function replacementIndex(x,options={}) {
  const index=currentSyncIndex(f,x.runtime,{enabled:()=>enabled,...options});index.openSync();return index;
}
function fixture({durable=false}={}){
  enabled=true;let index;
  const real=(durable?durableFixture:f.fixture)({createOwner:()=>{
    index=currentSyncIndex(f,f.ReaderRuntimeOwner.current(),{enabled:()=>enabled});index.openSync();
    return currentSyncOperations(index);
  }});
  let parent;
  const props=()=>{const actual=payload(index);parent=actual.parent;return actual.props;};
  const page=()=>{
    const shared=foundationControls();
    const p=createReaderBuilderProbe(f.source('features/sync/ui/SyncPage.ets'),['manualActionsSection','canContinueConfigSave','configSaveContinuationIdentities','configSaveGeneration','effectiveWebdavUrl','effectiveWebdavUser','effectiveWebdavPath','sectionHeadingMuted','restoreConflictCard','feedbackView','recoveryLabel','canMutate','manualActionButton','canSkipBackupRetention','backupRetentionActionIdentities','backupGeneration'],
      {...shared.dependencies,readerRecoveryView:f.readerRecoveryView,ReaderRecoveryNotice:Child,ReaderRecoveryAction:Child,ReaderCard:Card},{...shared.hooks,mountChildren:true,childSources:{...shared.hooks.childSources,ReaderCard:f.source('ui/surfaces/ReaderCard.ets')}}).owner;
    Object.assign(p,props(),{contentFrame:()=>({width:390}),appThemeScheme:'day'});p.manualActionsSection();
    const notice=[...p.children.values()].find(c=>c.params?.view);
    const messages=boundedSurfaceSdk(),n=messages.consumer(f.source('ui/feedback/ReaderRecoveryNotice.ets'),undefined,{},notice.params);n.initialRender();
    const actor=messages.walk(n).find(owner=>owner instanceof messages.deps.ReaderRecoveryAction&&owner.label===(notice.params.actionLabel??'刷新列表'));
    const action=actor&&messages.nodes(actor).find(node=>node.type==='Button'&&node.onClick);
    return{page:p,view:notice.params.view,action};
  };
  const open=async()=>{assert.equal(index.syncPresentation.ready,true,'current Presentation loading publishes an actual usable Page payload');await real.settle();};
  const retry=async()=>{const p=page();assert.ok(p.action);p.action.onClick();p.action.onClick();await real.settle();};
  return{...real,index,props,page,open,retry,parent:()=>parent};
}
class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
class Card extends Child{initialRender(){this.params.content?.();}}

try {
restoreDirectorySync=syncDirectoryFsyncFixturePort(f.fileIo,async()=>{directorySyncReceipts++;return 'CONTROLLED_PLATFORM_DIRECTORY_SYNC_ACK';});
if(id==='first-read'){
{const x=fixture();f.asset.failQuery=true;await x.open();assert.equal(x.index.syncPresentation.snapshot.facts.read.fact,'failed');await x.retry();assert.equal(x.index.syncPresentation.snapshot.facts.read.fact,'current');assert.equal(f.asset.calls.filter(v=>v==='query').length,2);}
}
if(id==='unknown-save'){
{const x=fixture();await x.open();f.asset.failAdd=true;x.props().onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);await x.settle();assert.equal(x.index.syncPresentation.snapshot.facts.operation.projection.receipt.confirmation,'unknown');await x.retry();assert.equal(f.asset.calls.filter(v=>v==='add').length,1);assert.equal(x.index.syncPresentation.snapshot.facts.operation.projection.receipt.fact,'pendingReconciliation','exact immutable preparation alone cannot commit current head');}
}
if(id==='save-readback'){
{const x=fixture();await x.open();const load=x.store.loadSerializedState.bind(x.store);let fail=true;x.store.loadSerializedState=async()=>{if(fail){fail=false;throw Error('actual post-save read failed');}return load();};x.props().onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);await x.settle();assert.equal(x.index.syncPresentation.snapshot.facts.operation.projection.receipt.fact,'confirmedRefreshFailed');await x.retry();assert.equal(f.asset.calls.filter(v=>v==='add').length,1);assert.equal(x.index.syncPresentation.snapshot.facts.operation.projection.receipt.fact,'confirmedCurrent');assert.doesNotMatch(JSON.stringify(x.index.syncPresentation.snapshot),/transient-secret|independent-secret/);}
}
if(id==='sdk-drafts'){
{const x=fixture();await x.open();const actual=fullSyncIndexPage(x.props());actual.webdavUrl='https://draft.test';actual.webdavUrlEdited=true;actual.webdavPass='typed-secret';actual.backupPass='backup-secret';
  const save=nodes(actual).find(n=>n.type==='Button'&&n.accessibilityText==='保存配置');assert.ok(save.onClick,'actual complete SDK page save handler');const load=x.store.loadSerializedState.bind(x.store);let fail=true;x.store.loadSerializedState=async()=>{if(fail){fail=false;throw Error('actual post-save read failed');}return load();};save.onClick();await x.settle();
  assert.equal(x.index.syncPresentation.snapshot.facts.operation.projection.receipt.fact,'confirmedRefreshFailed');actual.updateStateVars(x.props());actual.replay();assert.equal(actual.webdavPass,'','actual @Watch clears acknowledged password');assert.equal(actual.webdavUrl,'https://draft.test','edited draft is retained');
  assert.equal([...actual.children.values()].find(c=>c.params?.view)?.params.view.canRetry,true,'real updated recovery child sees operation');await x.retry();assert.equal(f.asset.calls.filter(v=>v==='add').length,1);
  x.index.nextNavigationGeneration();x.index.navigateTo('settings');save.onClick();await x.settle();assert.equal(f.asset.calls.filter(v=>v==='add').length,1,'physical old SDK save handler cannot operate the new route');}
}
if(id==='backup-recovery'){
{const x=fixture();await x.open();x.runtime.failBackupAdvance=true;x.props().onTriggerBackup();await x.settle();await x.retry();assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);assert.equal(x.index.syncPresentation.snapshot.facts.operation.projection.receipt.confirmation,'unknown');}
}
if(id==='callbacks'){
for(const retired of['route','generation','runtime-unset','hidden','unmounted']){
  const x=fixture();await x.open();const p=x.props(),before=f.asset.calls.length,native=x.runtime.calls.length;
  if(retired==='route')x.index.navigateTo('settings');if(retired==='generation')x.index.nextNavigationGeneration();if(retired==='runtime-unset'){f.setRuntimeOwner(undefined);assert.throws(()=>f.ReaderRuntimeOwner.current(),/installed by EntryAbility/);}
  if(retired==='hidden')enabled=false;if(retired==='unmounted')x.index.shelfReceiptRetired=true;
  assert.doesNotThrow(()=>{p.onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);p.onTestConnection(f.config.url,f.config.user,'',f.config.directory);p.onTriggerBackup();p.onRestoreLatest();p.onResolveRestore(true);p.onReconcile(0);p.onSkipBackupRetention(0);p.onContinueConfigSave(0,f.config.url,f.config.user,'','',f.config.directory);p.onBack();});
  await x.settle();assert.equal(f.asset.calls.length,before);assert.equal(x.runtime.calls.length,native);f.setRuntimeOwner(x.runtime);
}
}
if(id==='presentation-key'){
{const x=fixture();await x.open();const old=x.props(),parent=x.parent(),child=[...parent.children.values()].at(-1);x.index.nextNavigationGeneration();x.index.openSync();const updated=payload(x.index,parent),next=updated.carrier;assert.notEqual(next.id,child.id);old.onTriggerBackup();await x.settle();assert.equal(x.runtime.count('sync.webdav.transaction.start'),0);updated.props.onTriggerBackup();await x.settle();assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);}
}
if(id==='restore-retirement'){
{const x=fixture();await x.open();const gate=f.pause();x.runtime.beforeApply=()=>gate.promise;x.props().onRestoreLatest();await x.settle();x.props().onResolveRestore(true);for(let n=0;x.runtime.count('runtime.storage.apply')===0&&n<2000;n++)await new Promise(setImmediate);assert.equal(x.runtime.count('runtime.storage.apply'),1);const atClose=clone(x.index.syncPresentation.snapshot);x.index.nextNavigationGeneration();x.index.navigateTo('settings');gate.resolve();await x.settle();assert.deepEqual(x.index.syncPresentation.snapshot,atClose,'late accepted write cannot publish into closed route');}
}
if(id==='save-retirement'){
{const x=fixture();await x.open();const gate=f.pause();f.asset.beforeAdd=()=>gate.promise;x.props().onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);for(let n=0;!f.asset.calls.includes('add')&&n<2000;n++)await new Promise(setImmediate);assert.ok(f.asset.calls.includes('add'));const atRetirement=clone(x.index.syncPresentation.snapshot);f.setRuntimeOwner(undefined);gate.resolve();await assert.doesNotReject(x.settle());assert.deepEqual(x.index.syncPresentation.snapshot,atRetirement,'accepted durable save settles after actual Runtime unset without late Index publication');assert.equal(f.asset.calls.filter(v=>v==='add').length,1);f.setRuntimeOwner(x.runtime);}
}
if(id==='runtime-getter'){
{const x=fixture();await x.open();const old=currentSyncOperations(x.index);const y=fixture();assert.equal(currentSyncOperations(x.index),undefined,'current Presentation refuses the retired Runtime and never reacquires the successor owner');assert.notEqual(currentSyncOperations(y.index),old);assert.equal(currentSyncOperations(y.index).ownedBy(y.runtime),true);}
}
if(id==='retention-consent'){
for(const retired of ['live','route','generation','runtime-unset','hidden','unmounted']) {
  const x=fixture({durable:true});await x.open();x.runtime.failBackupAdvance=true;x.props().onTriggerBackup();await x.settle();
  const pending=x.index.syncPresentation.snapshot.facts.operation;x.qualifyRemote();x.props().onReconcile(pending.projection.facts.generation);await x.settle();
  assert.equal(x.index.syncPresentation.snapshot.facts.operation.uploadQualified,true);assert.equal(x.index.syncPresentation.snapshot.facts.operation.completed,false);
  const props=x.props(),actual=fullSyncIndexPage(props),action=[...actual.children.values()].find(c=>c.params?.label==='保留备份，结束清理');
  assert.ok(action,'actual Index → complete decorated SDK Page mounts exact receipt consent action');
  const before=x.runtime.count('sync.webdav.backup.retention.skip');
  if(retired==='route')x.index.navigateTo('settings');if(retired==='generation')x.index.nextNavigationGeneration();
  if(retired==='runtime-unset')f.setRuntimeOwner(undefined);if(retired==='hidden')enabled=false;if(retired==='unmounted')x.index.shelfReceiptRetired=true;
  assert.doesNotThrow(()=>action.params.onReconcile(action.params.generation));await x.settle();
  assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),before+(retired==='live'?1:0));
  if(retired==='live') {
    assert.equal(x.index.syncPresentation.snapshot.facts.operation.retentionSkipped,true);assert.equal(x.index.syncPresentation.snapshot.facts.operation.completed,false);
    assert.equal(x.index.syncPresentation.snapshot.facts.canMutate,true);const count=x.runtime.calls.length;
    action.params.onReconcile(action.params.generation);await x.settle();assert.equal(x.runtime.calls.length,count,'retired actual consent actor never replays terminal mutation');
    assert.equal(x.requests.filter(r=>r.method==='PUT').length,1);assert.equal(x.requests.filter(r=>r.method==='DELETE').length,0);
  }
  f.setRuntimeOwner(x.runtime);
}
}
if(id==='config-continuation'){
for (const retired of ['live', 'route', 'generation', 'runtime-unset', 'hidden', 'unmounted', 'replacement-host']) {
  const preferences = new Map();
  f.setPreferences({ async get(key, fallback) { return preferences.has(key) ? preferences.get(key) : fallback; },
    async has(key) { return preferences.has(key); }, async put(key, value) { preferences.set(key, value); },
    async delete(key) { preferences.delete(key); }, async flush() {} });
  const x = fixture(); await x.open(); f.asset.failAdd = true;
  x.props().onSaveConfig(f.config.url, f.config.user, f.config.password, f.config.backupPassword, f.config.directory);
  await x.settle();
  const initial = x.index.syncPresentation.snapshot.facts.operation;
  assert.equal(initial.projection.receipt.confirmation, 'unknown');
  x.props().onReconcile(initial.projection.facts.generation); await x.settle();
  const pending = x.index.syncPresentation.snapshot.facts.operation;
  assert.equal(pending.projection.receipt.confirmation, 'unknown');
  assert.equal(pending.canContinueOriginal, true);
  const props = x.props(), actual = fullSyncIndexPage(props);
  const original = [...actual.children.values()].find(child => child.params?.label === '继续原操作');
  assert.ok(original, 'actual Index→decorated Page has original config continuation action');
  const identity = pending.operationId, adds = f.asset.calls.filter(v => v === 'add').length;
  if (retired === 'route') x.index.navigateTo('settings');
  if (retired === 'generation') x.index.nextNavigationGeneration();
  if (retired === 'runtime-unset') f.setRuntimeOwner(undefined);
  if (retired === 'hidden') enabled = false;
  if (retired === 'unmounted') x.index.shelfReceiptRetired = true;
  if (retired === 'replacement-host') x.index.syncPresentation.retire();
  assert.doesNotThrow(() => original.params.onReconcile(original.params.generation)); await x.settle();
  assert.equal(f.asset.calls.filter(v => v === 'add').length, adds, 'exact prepared original never writes a second immutable record');
  if (retired === 'live') {
    assert.equal(x.index.syncPresentation.snapshot.facts.operation.completed, true);
    assert.equal(x.index.syncPresentation.snapshot.facts.operation.operationId, identity, 'explicit continuation retains original operation identity');
    assert.equal(x.index.syncPresentation.snapshot.facts.canMutate, true);
    original.params.onReconcile(original.params.generation); await x.settle();
    assert.equal(f.asset.calls.filter(v => v === 'add').length, adds, 'old physical config continuation cannot replay terminal save');
  } else assert.equal(x.index.syncPresentation.snapshot.facts.operation.completed, false, 'retired or replaced owner cannot settle via old physical actor');
  f.setRuntimeOwner(x.runtime);
}
}
if(id==='attachment'){
{
 const x=fixture();await x.open();const old=x.props(),oldHost=currentSyncOperations(x.index),oldID=currentSyncIdentity(x.index);
 const next=replacementIndex(x),currentID=currentSyncIdentity(next);
 assert.equal(currentSyncOperations(next),oldHost,'same exact Runtime uses one accepted owner');
 assert.equal(currentSyncOperations(x.index),undefined,'old still-alive Presentation cannot borrow or reattach the successor lease');
 assert.equal(oldHost.isPresentationCurrent(currentID),true);assert.equal(oldHost.isPresentationCurrent(oldID),false);
 await x.settle();const before=x.runtime.calls.length,adds=f.asset.calls.length;
 old.onTriggerBackup();old.onSaveConfig(f.config.url,f.config.user,'','',f.config.directory);old.onReconcile(0);old.onBack();
 await x.settle();assert.equal(x.runtime.calls.length,before);assert.equal(f.asset.calls.length,adds);
 oldHost.detachPresentation(oldID);assert.equal(oldHost.isPresentationCurrent(currentID),true,'old exact detach cannot clear successor');
 const actual=fullSyncIndexPage(payload(next).props),trigger=nodes(actual).find(n=>n.type==='Button'&&n.accessibilityText==='立即备份'&&n.onClick);
 assert.ok(trigger?.onClick,'current complete decorated Page retains a usable native backup button');
 trigger.onClick();await x.settle();assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);
 assert.equal(next.syncPresentation.snapshot.facts.operation.completed,true);
}
}
if(id==='accepted-transfer'){
{
 const x=fixture();await x.open();const gate=f.pause();x.runtime.beforeApply=()=>gate.promise;
 x.props().onRestoreLatest();await x.settle();x.props().onResolveRestore(true);
 for(let n=0;x.runtime.count('runtime.storage.apply')===0&&n<2000;n++)await new Promise(setImmediate);
 assert.equal(x.runtime.count('runtime.storage.apply'),1);const original=currentSyncOperations(x.index),tail=original.operationChain;
 const next=replacementIndex(x),atRetirement=clone(x.index.syncPresentation.snapshot);
 assert.equal(currentSyncOperations(next),original);assert.equal(original.operationChain,tail,'replacement cannot reset accepted mutation drain');
 assert.equal(next.syncPresentation.snapshot.facts.busy,true);payload(next).props.onTriggerBackup();
 assert.equal(x.runtime.count('sync.webdav.transaction.start'),1,'replacement cannot open a second mutation chain');
 gate.resolve();await x.settle();assert.deepEqual(x.index.syncPresentation.snapshot,atRetirement);
 assert.equal(next.syncPresentation.snapshot.facts.operation.completed,true,'accepted actual write settles into new same-Runtime presentation');
 assert.equal(x.runtime.count('runtime.storage.apply'),1);
}
}
if(id==='attach-negative'){
{
 const original=currentSyncPresentationSource(),mutant=original.replace('if (!current() || identity === this.identity) return;','if (!current()) return;');
 assert.notEqual(mutant,original,'negative removes only actual current same-opening attachment guard');
 const candidateDirectory=mkdtempSync(join(tmpdir(),'reader-sync-attach-negative-')),candidate=join(candidateDirectory,'SyncPresentation.ets');directories.push(candidateDirectory);writeFileSync(candidate,mutant);
 const x=fixture();await x.open();
 const old=replacementIndex(x,{presentationSource:readFileSync(candidate,'utf8')}),oldID=currentSyncIdentity(old);
 const next=replacementIndex(x,{presentationSource:readFileSync(candidate,'utf8')}),nextID=currentSyncIdentity(next);
 assert.equal(x.owner.isPresentationCurrent(nextID),true);
 reopenCurrentSyncOpening(old);assert.equal(x.owner.isPresentationCurrent(nextID),false,'negative proves an old live same-opening reattach steals the successor lease');
 assert.equal(x.owner.isPresentationCurrent(oldID),true,'the exact wrong old identity now owns the actual Host');
 rmSync(candidateDirectory,{recursive:true,force:true});
}
}
}finally{restoreDirectorySync();durableScope?.cleanup();f.cleanup();for(const dir of directories)rmSync(dir,{recursive:true,force:true});}
}
const definitions={"first-read": "first-read exact Sync behavior; controlled platform ports", "unknown-save": "unknown-save exact Sync behavior; controlled platform ports", "save-readback": "save-readback exact Sync behavior; controlled platform ports", "sdk-drafts": "sdk-drafts exact Sync behavior; controlled platform ports", "backup-recovery": "backup-recovery exact Sync behavior; controlled platform ports", "callbacks": "callbacks exact Sync behavior; controlled platform ports", "presentation-key": "presentation-key exact Sync behavior; controlled platform ports", "restore-retirement": "restore-retirement exact Sync behavior; controlled platform ports", "save-retirement": "save-retirement exact Sync behavior; controlled platform ports", "runtime-getter": "runtime-getter exact Sync behavior; controlled platform ports", "retention-consent": "retention-consent exact Sync behavior; controlled platform ports", "config-continuation": "config-continuation exact Sync behavior; controlled platform ports", "attachment": "attachment exact Sync behavior; controlled platform ports", "accepted-transfer": "accepted-transfer exact Sync behavior; controlled platform ports", "attach-negative": "attach-negative exact Sync behavior; controlled platform ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}

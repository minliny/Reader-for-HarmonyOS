import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const {createSyncOwnerFixture}=await import('./fixtures/sync/receipt-owner-fixture.mjs');const scope=createSyncOwnerFixture();
const {fixture,asset,config,Store,clone,pause,until,runtime}=scope;
async function open(f){f.owner.open();await f.settle();assert.equal(f.snapshot().facts.read.fact,'current');}
try {
if(id==='read'){
{
  const f=fixture();asset.failQuery=true;f.owner.open();await f.settle();assert.equal(f.snapshot().facts.read.fact,'failed');assert.equal(f.snapshot().facts.canMutate,false);
  const p=f.page();assert.equal(p.view.canRetry,true);p.action.onClick();p.action.onClick();await f.settle();assert.equal(asset.calls.filter(c=>c==='query').length,2);assert.equal(f.snapshot().facts.read.fact,'current');
}
{
  const f=fixture();await open(f);const original=clone(f.snapshot());asset.failQuery=true;f.owner.open();await f.settle();assert.equal(f.snapshot().facts.read.fact,'refreshFailed');assert.equal(f.snapshot().webdavUrl,original.webdavUrl);
  f.page().action.onClick();await f.settle();assert.equal(f.snapshot().facts.read.fact,'current');
}
}
if(id==='config'){
{
  const f=fixture();await open(f);
  const realLoad=f.store.loadSerializedState.bind(f.store);let reads=0;f.store.loadSerializedState=async()=>{reads++;if(reads===1)throw Error('post-write read failed');return realLoad();};
  f.owner.saveConfig(config.url,config.user,'','',config.directory);await f.settle();assert.equal(asset.calls.filter(c=>c==='add').length,1);assert.equal(f.snapshot().facts.operation.projection.receipt.fact,'confirmedRefreshFailed');
  const p=f.page();assert.match(p.view.message,/已确认，刷新失败/);p.action.onClick();p.action.onClick();await f.settle();assert.equal(asset.calls.filter(c=>c==='add').length,1);assert.equal(f.snapshot().facts.operation.projection.receipt.fact,'confirmedCurrent');
  assert.doesNotMatch(JSON.stringify(f.snapshot()),/transient-secret|independent-secret/);
}
{
  const f=fixture();await open(f);asset.failAdd=true;f.owner.saveConfig(config.url,config.user,'','',config.directory);await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'unknown');
  f.page().action.onClick();await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'unknown','immutable staging receipt cannot auto-commit current head');assert.equal(asset.calls.filter(c=>c==='add').length,1);
  const original=f.snapshot().facts.operation.operationId;f.page().continueAction.onClick();await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.fact,'confirmedCurrent');assert.equal(f.snapshot().facts.operation.operationId,original);assert.equal(asset.calls.filter(c=>c==='add').length,1,'explicit continuation commits exact staged head without another add');
  // A separate unresolved attempt must still block replacement and backup.
  asset.failAdd=true;asset.beforeAdd=()=>{asset.failQuery=true;};f.owner.saveConfig(config.url,config.user,'','',config.directory);await f.settle();asset.beforeAdd=undefined;f.owner.saveConfig(config.url,config.user,'','',config.directory);f.owner.triggerBackup();await f.settle();assert.equal(asset.calls.filter(c=>c==='add').length,2);assert.equal(f.runtime.count('sync.webdav.transaction.start'),0,'unknown cannot be overwritten by new intent');
}
{
  const f=fixture();await open(f);f.owner.saveConfig('http://invalid',config.user,'','',config.directory);await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'undispatched');assert.equal(asset.calls.filter(c=>c==='add').length,0);
}
}
if(id==='backup'){
{
  const f=fixture();await open(f);f.runtime.failBackupAdvance=true;f.owner.triggerBackup();await f.settle();const op=f.snapshot().facts.operation;assert.equal(op.projection.receipt.confirmation,'unknown');assert.equal(op.remoteConfirmedCount,1);assert.equal(f.snapshot().history.length,0);
  f.page().action.onClick();await f.settle();assert.equal(f.runtime.count('sync.webdav.transaction.start'),1);assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'unknown');
}
{
  const f=fixture();await open(f);f.owner.triggerBackup();f.owner.triggerBackup();await f.settle();assert.equal(f.runtime.count('sync.webdav.transaction.start'),1);assert.equal(f.snapshot().facts.operation.completed,true);assert.equal(f.snapshot().history.length,1);
}
}
if(id==='restore'){
{
  const f=fixture();await open(f);f.owner.restoreLatest();await f.settle();f.owner.resolveRestore(false);await f.settle();assert.equal(f.runtime.count('runtime.storage.apply'),0);assert.equal(f.snapshot().restoreConflict,undefined);assert.equal(f.snapshot().statusMessage,'已取消恢复');assert.equal(f.snapshot().facts.operation,undefined,'explicit cancellation never fabricates a committed write');
}
for(const fail of ['none','applyAck','commitAck','host']){
  const f=fixture();await open(f);f.owner.restoreLatest();await f.settle();assert.equal(f.snapshot().restoreConflict.transactionId,'restore');assert.equal(f.runtime.count('runtime.storage.apply'),0);
  if(fail==='applyAck')f.runtime.failApplyAck=true;if(fail==='commitAck')f.runtime.failCommit=1;if(fail==='host')scope.controls.hostFailures=1;
  f.owner.resolveRestore(true);await f.settle();assert.equal(f.runtime.count('runtime.storage.apply'),1);assert.equal(f.snapshot().facts.operation.projection.receipt.fact,'confirmedCurrent');assert.equal(f.snapshot().facts.operation.coreApplied,true);assert.equal(f.journal(),undefined);
}
{
  const f=fixture();await open(f);f.owner.restoreLatest();await f.settle();scope.controls.hostFailures=2;f.owner.resolveRestore(true);await f.settle();
  const op=f.snapshot().facts.operation;assert.equal(op.coreApplied,true);assert.equal(op.hostApplied,false);assert.equal(op.completed,false);assert.equal(op.projection.receipt.confirmation,'confirmed');assert.ok(f.journal());assert.match(f.page().view.message,/Core 配置已应用/);
  f.owner.triggerBackup();await f.settle();assert.equal(f.runtime.count('sync.webdav.transaction.start'),1);
  const p=f.page();assert.equal(p.notice.actionLabel,'核对已有恢复');p.action.onClick();p.action.onClick();await f.settle();assert.equal(f.runtime.count('runtime.storage.apply'),1,'partial recovery never reapplies Core descriptor');assert.equal(f.snapshot().facts.operation.completed,true);assert.equal(f.journal(),undefined);
}
{
  const f=fixture();await open(f);f.owner.restoreLatest();await f.settle();f.runtime.failApplyAck=true;f.runtime.failQuery=true;f.owner.resolveRestore(true);await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'unknown');assert.ok(f.journal());
  f.page().action.onClick();await f.settle();assert.equal(f.runtime.count('runtime.storage.apply'),1);assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'confirmed');assert.equal(f.journal(),undefined);
}
}
if(id==='lifecycle'){
{
  const f=fixture();await open(f);const p=pause();asset.beforeAdd=()=>p.promise;f.owner.saveConfig(config.url,config.user,'','',config.directory);await until(()=>asset.calls.includes('add'));const before=f.emitted.length;f.close();p.resolve();await f.settle();assert.equal(f.emitted.length,before,'close discards late ACK publication');f.reopen();await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'unknown','retired staged add is not a committed head');f.page().continueAction.onClick();await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'confirmed');
  const stale=f.snapshot().facts.operation.projection.facts.generation;f.owner.open();await f.settle();const queries=asset.calls.length;f.owner.reconcile(stale);await f.settle();assert.equal(asset.calls.length,queries,'stale recovery token rejected');
}
{
  const f=fixture();await open(f);const gate=pause();Store.writeTail=gate.promise;f.owner.saveConfig(config.url,config.user,'','',config.directory);await new Promise(r=>setImmediate(r));f.close();gate.resolve();await f.settle();assert.equal(asset.calls.filter(c=>c==='add').length,0,'queued intent checks route after prepare/read');
}
{
  const f=fixture();await open(f);f.owner.restoreLatest();await f.settle();const p=pause();f.runtime.beforeApply=()=>p.promise;f.owner.resolveRestore(true);await until(()=>f.runtime.calls.some(c=>c[0]==='runtime.storage.apply'));const count=f.emitted.length;scope.setRuntimeOwner(runtime());p.resolve();await f.settle();assert.equal(scope.controls.hostApplications,0,'retired runtime never applies Host configuration');assert.equal(f.emitted.length,count);assert.ok(f.journal(),'new startup can resolve already-applied Core receipt');f.owner.triggerBackup();await f.settle();assert.equal(f.runtime.count('sync.webdav.transaction.start'),1);
}
{
  const f=fixture();await open(f);f.owner.testConnection(config.url,config.user,'',config.directory);await f.settle();assert.equal(f.snapshot().facts.request.fact,'current');assert.equal(asset.calls.filter(c=>c==='add').length,0);assert.equal(f.snapshot().facts.operation,undefined,'read-only connection test does not fabricate write receipt');
}
}
if(id==='runtime-absence'){
for(const unknown of [false,true]){
 const f=fixture();await open(f);const p=pause();asset.beforeAdd=()=>p.promise;asset.failAdd=unknown;f.owner.saveConfig(config.url,config.user,'','',config.directory);await until(()=>asset.calls.includes('add'));
 const count=f.emitted.length;scope.setRuntimeOwner(undefined);p.resolve();await f.settle();assert.equal(f.emitted.length,count,'actual Asset ACK/lost ACK cannot publish after Runtime absence');
 const writes=asset.calls.filter(c=>c==='add').length;assert.doesNotThrow(()=>f.owner.saveConfig(config.url,config.user,'','',config.directory));await f.settle();assert.equal(asset.calls.filter(c=>c==='add').length,writes);
 scope.setRuntimeOwner(f.runtime);f.owner.open();await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'unknown','retired staging never promotes to a committed current head');
 assert.equal(asset.calls.filter(c=>c==='add').length,writes,'reopen independent read never repeats save');
}
}
}finally{scope.cleanup();}
}
async function sdkDrafts(){
 const {syncIndexFixture:f,fullSyncIndexPage}=await import('./lib/sync-index-real-fixture.mjs');const {config,DEFAULT_SYNC_SNAPSHOT,projectPersistedReceipt,facts}=f;const clone=value=>JSON.parse(JSON.stringify(value));const nodes=owner=>[...(owner.nodes?.values()??[]),...[...(owner.children?.values()??[])].flatMap(nodes)];
 const full=fullSyncIndexPage({snapshot:{...clone(DEFAULT_SYNC_SNAPSHOT),webdavUrl:config.url,webdavUser:config.user,webdavPath:config.directory,facts:{read:facts.projectOperationFacts({phase:'succeeded',value:true}),busy:false,canMutate:true}},isTablet:false});try{
assert.equal(full.webdavUrl,config.url);
  const inputs=nodes(full).filter(n=>n.create&&typeof n.create==='object'&&'placeholder' in n.create);assert.equal(inputs.length,5);assert.equal(inputs.filter(n=>n.enabled).length,5);assert.equal(inputs.filter(n=>n.type==='TextInput').length,5);assert.equal(inputs.filter(n=>n.nativeInputType==='InputType.Password').length,2);
  full.webdavUrlEdited=true;full.webdavUrl='https://draft.test';full.webdavPass='secret-draft';full.backupPass='backup-draft';
  const operation={action:'saveConfig',writeGeneration:1,coreApplied:false,hostApplied:false,completed:true,remoteConfirmedCount:0,projection:projectPersistedReceipt({confirmation:'confirmed',readback:'failed',generation:900,canRetry:true})};
  full.updateStateVars({snapshot:{...clone(full.snapshot),webdavUrl:'https://new.test',facts:{...full.snapshot.facts,operation,busy:false,canMutate:true}}});
  assert.equal(full.webdavUrl,'https://draft.test','ACK/readback keeps edited non-secret draft');assert.equal(full.webdavPass,'','actual @Watch clears acknowledged password draft');assert.equal(full.backupPass,'');
  const recovery=[...full.children.values()].find(c=>c.params?.view);full.replay();assert.equal(recovery.params.view.canRetry,true,'mounted shared child receives live snapshot receipt');
  full.webdavPass='later-draft';full.backupPass='later-backup';
  full.updateStateVars({snapshot:{...clone(full.snapshot),facts:{...full.snapshot.facts,operation:{...operation,projection:projectPersistedReceipt({confirmation:'confirmed',readback:'succeeded',generation:901})}}}});
  assert.equal(full.webdavPass,'later-draft','read-only recovery never re-clears a later secret draft');assert.equal(full.backupPass,'later-backup');
}finally{f.cleanup();}
}
const definitions={"read": "read production Sync scope; controlled Core/Asset boundaries", "config": "config production Sync scope; controlled Core/Asset boundaries", "backup": "backup production Sync scope; controlled Core/Asset boundaries", "restore": "restore production Sync scope; controlled Core/Asset boundaries", "lifecycle": "lifecycle production Sync scope; controlled Core/Asset boundaries", "runtime-absence": "runtime-absence production Sync scope; controlled Core/Asset boundaries", "sdk-drafts": "Actual decorated SyncPage password draft clearing and retained readback"};
for(const id of selectContractCases(definitions)){if(id==='sdk-drafts')await sdkDrafts();else await run(id);recordContractCasePass(id);}

import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const {syncIndexFixture: f,fullSyncIndexPage,syncRecoveryAction,updateSyncRecoveryAction}=await import("./lib/sync-index-real-fixture.mjs");
const {createBackupJournalFixture}=await import('./fixtures/sync/backup-journal-fixture.mjs');const scope=createBackupJournalFixture();const {fixture,directory,operation,open,retry,tick}=scope;
async function unknown(){const x=fixture();await open(x);x.runtime.failBackupAdvance=true;x.owner.triggerBackup();await x.settle();return x;}
async function qualify(x){x.qualifyRemote();await retry(x);assert.equal(operation(x).uploadQualified,true);assert.equal(operation(x).completed,false);}
try {
if(id==='consent'){
{
  const x=await unknown();const generation=operation(x).projection.facts.generation;
  assert.equal(x.page().skipAction,undefined,'unknown upload offers no finish-cleanup action');x.owner.skipBackupRetention(generation);await x.settle();assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0);
  await qualify(x);const old=x.page().skipAction;assert.equal(old.accessibilityText,'保留备份，结束清理');
  assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0,'GET qualification alone never settles');
  x.removeRemote();old.onClick();await x.settle();assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0,'prior UI qualification cannot replace current exact proof');assert.equal(x.snapshot().facts.canMutate,false);
  x.qualifyRemote();const current=x.page().skipAction;current.onClick();current.onClick();await x.settle();
  assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1);assert.equal(operation(x).retentionSkipped,true);assert.equal(operation(x).completed,false);
  assert.equal(x.snapshot().facts.canMutate,true);assert.equal(x.page().skipAction,undefined);assert.match(x.snapshot().statusMessage,/清理.*结束/);assert.doesNotMatch(x.snapshot().statusMessage,/已取消|清理完成/);
  assert.deepEqual(x.requests.map(r=>r.method),['PUT','GET','GET','GET','GET']);assert.equal(x.requests.filter(r=>r.method==='PUT').length,1,'only original publication PUT exists');
  const count=x.runtime.calls.length;old.onClick();await x.settle();assert.equal(x.runtime.calls.length,count,'retired physical generation never submits terminal command');
  const id=operation(x).operationId;const cold=fixture({cold:true});cold.settleCore('retentionSkipped',true,false);await open(cold);
  assert.equal(operation(cold).operationId,id);assert.equal(operation(cold).retentionSkipped,true);assert.equal(operation(cold).completed,false);assert.equal(cold.snapshot().facts.canMutate,true);assert.equal(cold.requests.length,0);
  cold.owner.saveConfig(f.config.url,f.config.user,'','',f.config.directory);await cold.settle();assert.equal(f.asset.calls.filter(v=>v==='add').length,1,'exact local terminal receipt admits a later config save');assert.equal(await cold.store.loadBackupJournal(),undefined);
 }
}
if(id==='lost-ack'){
{
  const x=await unknown();await qualify(x);x.loseSkipAck();x.page().skipAction.onClick();await x.settle();
  assert.equal(operation(x).retentionSkipped,false,'lost terminal ACK does not manufacture local settlement');assert.equal(x.snapshot().facts.canMutate,false);
  const requests=x.requests.length;await retry(x);assert.equal(operation(x).retentionSkipped,true);assert.equal(operation(x).completed,false);assert.equal(x.snapshot().facts.canMutate,true);
  assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1,'read-only exact terminal receipt settles lost ACK without replay');assert.equal(x.requests.length,requests);
 }
}
if(id==='route-retirement'){
{
  const x=await unknown();await qualify(x);const old=x.page().skipAction;
  x.close();const count=x.runtime.calls.length;old.onClick();await x.settle();assert.equal(x.runtime.calls.length,count);
  x.reopen();await x.settle();const before=x.runtime.calls.length;old.onClick();await x.settle();assert.equal(x.runtime.calls.length,before,'old route generation remains retired after reopen');
 }
}
if(id==='runtime-retirement'){
{
  const x=await unknown();await qualify(x);const gate=f.pause();x.pauseSkip(gate);x.page().skipAction.onClick();for(let n=0;x.runtime.count('sync.webdav.backup.retention.skip')===0&&n<2000;n++)await new Promise(setImmediate);assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1,'actual terminal dispatch before retirement');
  const before=x.emitted.length;f.setRuntimeOwner(undefined);gate.resolve();await x.settle();assert.equal(x.emitted.length,before,'late actual terminal ACK cannot publish into retired owner');
  f.setRuntimeOwner(x.runtime);x.reopen();await x.settle();await retry(x);assert.equal(operation(x).retentionSkipped,true);assert.equal(operation(x).completed,false);
 }
}
if(id==='origin'){
{
  const x=await unknown();await qualify(x);const old=x.page().skipAction;
  f.asset.record=new TextEncoder().encode(JSON.stringify({formatVersion:2,config:{...f.config,url:'https://other.test'}}));const count=x.requests.length;old.onClick();await x.settle();assert.equal(x.requests.length,count);assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0,'changed origin cannot end unresolved original publication');
 }
}
if(id==='page-consumer'){
{
  const x=await unknown();await qualify(x);let selected;
  const full=fullSyncIndexPage({snapshot:x.snapshot(),isTablet:false,onSkipBackupRetention:g=>{selected=g;x.owner.skipBackupRetention(g);}});
  const [action]=syncRecoveryAction(full,'保留备份，结束清理');
  assert.ok(action,'the bounded page slot mounts a shared native action');
  action.node.onClick();await x.settle();assert.equal(selected,action.actor.generation);assert.equal(operation(x).retentionSkipped,true);
 }
}
if(id==='retained-actor'){
{
  const x=await unknown();await qualify(x);
  const label='保留备份，结束清理';
  const parent=fullSyncIndexPage({snapshot:x.snapshot(),onSkipBackupRetention:g=>x.owner.skipBackupRetention(g)});
  const [first]=syncRecoveryAction(parent,label);assert.ok(first);
  const old=first.node.onClick,oldGeneration=first.actor.generation;
  updateSyncRecoveryAction(first.actor,{actionEnabled:false,onReconcile:()=>{throw Error('ordinary callback must not be rebound');}});
  old();await x.settle();assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0);
  updateSyncRecoveryAction(first.actor,{actionEnabled:true});
  await retry(x);parent.updateStateVars({snapshot:x.snapshot()});parent.replay();
  const generation=operation(x).projection.facts.generation;
  const current=syncRecoveryAction(parent,label).findLast(item=>item.actor.generation===generation);
  assert.ok(current,'the bounded recovery slot admits a new action');
  assert.notEqual(current.node.onClick,old);
  old();await x.settle();assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0);
  assert.notEqual(current.actor.generation,oldGeneration);
  // The probe retains retired slot actors. Click the current bounded slot in a fresh measured shell.
  const active=fullSyncIndexPage({snapshot:x.snapshot(),onSkipBackupRetention:g=>x.owner.skipBackupRetention(g)});
  const [activeAction]=syncRecoveryAction(active,label);activeAction.node.onClick();await x.settle();
  assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1);
  assert.equal(operation(x).retentionSkipped,true);
 }
}
}finally{scope.cleanup();}
}
const definitions={"consent": "consent; actual production methods with explicit controlled platform ports", "lost-ack": "lost-ack; actual production methods with explicit controlled platform ports", "route-retirement": "route-retirement; actual production methods with explicit controlled platform ports", "runtime-retirement": "runtime-retirement; actual production methods with explicit controlled platform ports", "origin": "origin; actual production methods with explicit controlled platform ports", "page-consumer": "page-consumer; actual production methods with explicit controlled platform ports", "retained-actor": "retained-actor; actual production methods with explicit controlled platform ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}

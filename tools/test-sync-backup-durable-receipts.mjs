import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const {syncIndexFixture:f}=await import('./lib/sync-index-real-fixture.mjs');const {createBackupJournalFixture}=await import('./fixtures/sync/backup-journal-fixture.mjs');const scope=createBackupJournalFixture();const {fixture,directory,disk,operation,open,retry,tick}=scope;const {readFileSync}=await import('node:fs');
try {
if(id==='cold-receipt'){
{
  const x=fixture();await open(x);x.runtime.failBackupAdvance=true;x.owner.triggerBackup();await x.settle();
  assert.equal(operation(x).projection.receipt.confirmation,'unknown');const id=operation(x).operationId;
  const journal=await x.store.loadBackupJournal();assert.equal(journal.phase,'mayDispatch');assert.equal(journal.operationId,id);
  const native=JSON.parse(readFileSync(disk,'utf8'));assert.doesNotMatch(JSON.stringify(native),/transient-secret|independent-secret|Authorization|ciphertext/);
  const cold=fixture({cold:true});await open(cold);assert.equal(operation(cold).operationId,id,'actual disk journal survives new Store/runtime/owner');
  assert.equal(cold.runtime.count('sync.webdav.transaction.start'),0,'cold open never replays start or HTTP mutation');
  assert.equal(operation(cold).projection.receipt.confirmation,'unknown');
  assert.equal(cold.page().notice.actionLabel,'核对本次备份','actual SDK public recovery label describes the exact backup GET query');
  const oldAction=cold.page().action;
  cold.qualifyRemote();await retry(cold);assert.equal(operation(cold).uploadQualified,true);assert.equal(operation(cold).completed,false);
  const currentRequests=cold.requests.length;oldAction.onClick();await cold.settle();assert.equal(cold.requests.length,currentRequests,'old physical generation callback cannot rerun the current query');
  assert.equal(operation(cold).projection.receipt.confirmation,'confirmed');assert.match(cold.page().view.message,/保留清理/);
  assert.deepEqual(cold.requests.map(r=>r.method),['GET'],'physical recovery only dispatches original GET');
  assert.equal(cold.snapshot().facts.canMutate,false);cold.owner.triggerBackup();cold.owner.restoreLatest();cold.owner.saveConfig(f.config.url,f.config.user,'','',f.config.directory);await cold.settle();
  assert.equal(cold.runtime.count('sync.webdav.transaction.start'),0);assert.equal(f.asset.calls.filter(v=>v==='add').length,0);
  const generation=operation(cold).writeGeneration;cold.removeRemote();await retry(cold);
  assert.equal(operation(cold).uploadQualified,true,'later absent GET does not erase already observed upload');assert.equal(operation(cold).writeGeneration,generation);
  assert.ok(await cold.store.loadBackupJournal(),'upload qualification does not clear unresolved retention authority');
  cold.settleCore('retentionCompleted',true,true);await retry(cold);assert.equal(operation(cold).completed,true);assert.equal(cold.snapshot().facts.canMutate,true);
 }
}
if(id==='origin'){
{
  const x=fixture();await open(x);x.runtime.failBackupAdvance=true;x.owner.triggerBackup();await x.settle();
  const original=x.runtime.calls.find(c=>c[0]==='sync.webdav.transaction.start')[1].operationId;
  const next=fixture({cold:true});f.asset.record=new TextEncoder().encode(JSON.stringify({formatVersion:2,config:{...f.config,url:'https://another.test'}}));await open(next);
  await retry(next);assert.equal(next.requests.length,0,'changed configured origin cannot receive original Authorization');
  assert.equal(operation(next).projection.receipt.confirmation,'unknown');assert.equal(operation(next).operationId,original);
 }
}
if(id==='secure-envelope'){
{
  const x=fixture();await open(x);await x.store.save(f.config);
  const configId=(await x.store.loadSerializedState()).saveOperationId;x.runtime.failBackupAdvance=true;x.owner.triggerBackup();await x.settle();
  assert.equal((await x.store.loadBackupJournal()).configSaveOperationId,configId,'same envelope identity survives prepared→mayDispatch');
  await x.store.save(f.config);await retry(x);assert.equal(x.requests.filter(r=>r.method==='GET').length,0,'a newer same-value save is not the original secure envelope');
  assert.equal(operation(x).projection.receipt.confirmation,'unknown');
 }
}
if(id==='zero-dispatch'){
{
  // Before-dispatch flush failure is cleaned only by the actual IO counter's
  // no-dispatch proof. Two failures do not poison a subsequent explicit intent.
  const x=fixture();await open(x);
  for(let n=0;n<2;n++){x.prefs.failFlush=true;x.owner.triggerBackup();await x.settle();assert.equal(operation(x).projection.receipt.confirmation,'undispatched');assert.equal(await x.store.loadBackupJournal(),undefined);}
  assert.equal(x.runtime.count('sync.webdav.transaction.start'),0);assert.equal(x.requests.length,0);
  x.owner.triggerBackup();await x.settle();assert.equal(operation(x).completed,true);assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);
 }
}
if(id==='runtime-absence'){
{
  const x=fixture();await open(x);const gate=f.pause(),previous=x.runtime.request;x.runtime.request=async(method,params,opts)=>{if(method==='sync.webdav.transaction.advance')await gate.promise;return previous(method,params,opts);};
  x.owner.triggerBackup();await tick(()=>x.runtime.calls.some(c=>c[0]==='sync.webdav.transaction.advance')||x.requests.some(r=>r.method==='PUT'));const before=x.emitted.length;f.setRuntimeOwner(undefined);gate.resolve();await x.settle();
  assert.equal(x.emitted.length,before,'late accepted IO cannot publish after Runtime.close identity disappears');
  const count=x.requests.length;assert.doesNotThrow(()=>x.owner.triggerBackup());await x.settle();assert.equal(x.requests.length,count);
  const journal=await x.store.loadBackupJournal();assert.equal(journal.phase,'mayDispatch');
  f.setRuntimeOwner(x.runtime);x.settleCore('retentionCompleted',true,true);x.reopen();await x.settle();
  await retry(x);assert.equal(operation(x).completed,true);assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);
 }
}
}finally{scope.cleanup();}
}
const definitions={"cold-receipt": "cold-receipt; actual production methods with explicit controlled platform ports", "origin": "origin; actual production methods with explicit controlled platform ports", "secure-envelope": "secure-envelope; actual production methods with explicit controlled platform ports", "zero-dispatch": "zero-dispatch; actual production methods with explicit controlled platform ports", "runtime-absence": "runtime-absence; actual production methods with explicit controlled platform ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}

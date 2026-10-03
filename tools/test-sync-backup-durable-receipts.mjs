import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {syncIndexFixture as f} from './lib/sync-index-real-fixture.mjs';
const directory=mkdtempSync(join(tmpdir(),'reader-backup-journal-'));
const disk=join(directory,'preferences.json');
const tick=()=>new Promise(r=>setImmediate(r));
const operation=x=>x.snapshot().facts.operation;
const open=async x=>{x.owner.open();await x.settle();};
const retry=async x=>{const p=x.page();assert.ok(p.action,'real SDK shared recovery native handler');p.action.onClick();p.action.onClick();await x.settle();};
// Preferences performs staged in-memory mutation followed by actual file IO.
// Cold instances reload that file; production journal methods are unmodified.
function preferences(){let data=existsSync(disk)?JSON.parse(readFileSync(disk,'utf8')):{};return {
 failFlush:false, async get(k,fallback){return data[k]??fallback;},async has(k){return k in data;},async put(k,v){data[k]=v;},async delete(k){delete data[k];},
 async flush(){if(this.failFlush){this.failFlush=false;throw Error('injected native flush rejection');}writeFileSync(disk,JSON.stringify(data));}
};}
function fixture({cold=false}={}){
 if(!cold)rmSync(disk,{force:true});const x=f.fixture({preserveAsset:cold});const prefs=preferences();f.setPreferences(prefs);
 const requests=[],original=x.runtime.request.bind(x.runtime);let state='prepared',uploaded=false,retention=false,remoteQualified=false;
 const exactId=()=>x.runtime.backupOperationId;
 // Typed Core result injection here is independent of the paired Rust tests,
 // which exercise actual durable Core/hash/SQLite methods. No hash algorithm
 // or publisher state machine is reproduced in this Host/SDK probe.
 x.runtime.request=async(method,params,options)=>{
  if(method==='sync.webdav.backup.receipt.query'){
   x.runtime.calls.push([method,structuredClone(params)]);
   return {data:{transactionId:params.transactionId,receiptState:state,uploadQualified:uploaded||params.response!==undefined&&remoteQualified,
    retentionCompleted:retention,durable:true,remotePath:'/backup/package',contentBytes:100,
    request:!uploaded&&params.response===undefined&&state!=='undispatched'?{method:'GET',url:'https://example.test/backup/package'}:undefined}};
  }
  return original(method,params,options);
 };
 f.setTransport(async request=>{requests.push(structuredClone(request));return {status:request.method==='GET'?200:201,body:'opaque-core-ciphertext',finalUrl:request.url};});
 return {...x,prefs,requests,qualifyRemote:()=>{remoteQualified=true;},removeRemote:()=>{remoteQualified=false;},settleCore:(s,u,r)=>{state=s;uploaded=u;retention=r;},exactId};
}
try {
 {
  const x=fixture();await open(x);x.runtime.failBackupAdvance=true;x.owner.triggerBackup();await x.settle();
  assert.equal(operation(x).projection.receipt.confirmation,'unknown');const id=operation(x).operationId;
  const journal=await x.store.loadBackupJournal();assert.equal(journal.phase,'mayDispatch');assert.equal(journal.operationId,id);
  const native=JSON.parse(readFileSync(disk,'utf8'));assert.doesNotMatch(JSON.stringify(native),/transient-secret|independent-secret|Authorization|ciphertext/);
  const cold=fixture({cold:true});await open(cold);assert.equal(operation(cold).operationId,id,'actual disk journal survives new Store/runtime/owner');
  assert.equal(cold.runtime.count('sync.webdav.transaction.start'),0,'cold open never replays start or HTTP mutation');
  assert.equal(operation(cold).projection.receipt.confirmation,'unknown');
  cold.qualifyRemote();await retry(cold);assert.equal(operation(cold).uploadQualified,true);assert.equal(operation(cold).completed,false);
  assert.equal(operation(cold).projection.receipt.confirmation,'confirmed');assert.match(cold.page().view.message,/保留清理/);
  assert.deepEqual(cold.requests.map(r=>r.method),['GET'],'physical recovery only dispatches original GET');
  assert.equal(cold.snapshot().facts.canMutate,false);cold.owner.triggerBackup();cold.owner.restoreLatest();cold.owner.saveConfig(f.config.url,f.config.user,'','',f.config.directory);await cold.settle();
  assert.equal(cold.runtime.count('sync.webdav.transaction.start'),0);assert.equal(f.asset.calls.filter(v=>v==='add').length,0);
  const generation=operation(cold).writeGeneration;cold.removeRemote();await retry(cold);
  assert.equal(operation(cold).uploadQualified,true,'later absent GET does not erase already observed upload');assert.equal(operation(cold).writeGeneration,generation);
  assert.ok(await cold.store.loadBackupJournal(),'upload qualification does not clear unresolved retention authority');
  cold.settleCore('retentionCompleted',true,true);await retry(cold);assert.equal(operation(cold).completed,true);assert.equal(cold.snapshot().facts.canMutate,true);
 }
 {
  const x=fixture();await open(x);x.runtime.failBackupAdvance=true;x.owner.triggerBackup();await x.settle();
  const original=x.runtime.calls.find(c=>c[0]==='sync.webdav.transaction.start')[1].operationId;
  const next=fixture({cold:true});f.asset.record=new TextEncoder().encode(JSON.stringify({formatVersion:2,config:{...f.config,url:'https://another.test'}}));await open(next);
  await retry(next);assert.equal(next.requests.length,0,'changed configured origin cannot receive original Authorization');
  assert.equal(operation(next).projection.receipt.confirmation,'unknown');assert.equal(operation(next).operationId,original);
 }
 {
  const x=fixture();await open(x);await x.store.save(f.config);
  const configId=(await x.store.loadSerializedState()).saveOperationId;x.runtime.failBackupAdvance=true;x.owner.triggerBackup();await x.settle();
  assert.equal((await x.store.loadBackupJournal()).configSaveOperationId,configId,'same envelope identity survives prepared→mayDispatch');
  await x.store.save(f.config);await retry(x);assert.equal(x.requests.filter(r=>r.method==='GET').length,0,'a newer same-value save is not the original secure envelope');
  assert.equal(operation(x).projection.receipt.confirmation,'unknown');
 }
 {
  // Before-dispatch flush failure is cleaned only by the actual IO counter's
  // no-dispatch proof. Two failures do not poison a subsequent explicit intent.
  const x=fixture();await open(x);
  for(let n=0;n<2;n++){x.prefs.failFlush=true;x.owner.triggerBackup();await x.settle();assert.equal(operation(x).projection.receipt.confirmation,'undispatched');assert.equal(await x.store.loadBackupJournal(),undefined);}
  assert.equal(x.runtime.count('sync.webdav.transaction.start'),0);assert.equal(x.requests.length,0);
  x.owner.triggerBackup();await x.settle();assert.equal(operation(x).completed,true);assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);
 }
 {
  const x=fixture();await open(x);const gate=f.pause(),previous=x.runtime.request;x.runtime.request=async(method,params,opts)=>{if(method==='sync.webdav.transaction.advance')await gate.promise;return previous(method,params,opts);};
  x.owner.triggerBackup();await tick();const before=x.emitted.length;f.setRuntimeOwner(undefined);gate.resolve();await x.settle();
  assert.equal(x.emitted.length,before,'late accepted IO cannot publish after Runtime.close identity disappears');
  const count=x.requests.length;assert.doesNotThrow(()=>x.owner.triggerBackup());await x.settle();assert.equal(x.requests.length,count);
  const journal=await x.store.loadBackupJournal();assert.equal(journal.phase,'mayDispatch');
  f.setRuntimeOwner(x.runtime);x.settleCore('retentionCompleted',true,true);x.reopen();await x.settle();
  await retry(x);assert.equal(operation(x).completed,true);assert.equal(x.runtime.count('sync.webdav.transaction.start'),1);
 }
 console.log('PASS actual file Preferences→Store→Gateway→owner→SDK shared native recovery: cold exact ID, only GET recovery, upload/retention partial truth, origin/new-envelope rejection, monotone observed ACK, no replay, genuine zero-dispatch flush cleanup, runtime retirement; paired Core cold IO/hash/capacity tests are separate. HAP/VM/device OPEN.');
} finally {rmSync(directory,{recursive:true,force:true});}

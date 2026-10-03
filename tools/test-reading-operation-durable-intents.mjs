import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture, deferred, until, ReaderWriteEvidence, bookmarkContext, cacheContext, bookmarkInput, book } from './lib/reading-operation-durable-probe.mjs';
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
let cases=0;
for(const official of [false,true]){
 {
  const f=await fixture(official);await f.create();assert.equal(f.directory.snapshot().projection.receipt.confirmation,'confirmed');assert.equal(f.entries()[0].bookmarks.length,1);assert.equal(f.disk('bookmark'),'');
  const time=f.entries()[0].bookmarks[0].time;await f.directory.deleteBookmarks([time],f.dirBinding);assert.equal(f.entries()[0].bookmarks.length,0);
  assert.deepEqual(f.writes().map(c=>c.params.sequence),[1,2]);assert.ok(f.writes().every(c=>c.params.operationId.endsWith('/'+c.params.sequence)));cases++;
 }
 {
  const f=await fixture(official);f.options.beforeMethod='bookmark.create';await f.create();
  const cold=await fixture(official,f);cold.options.beforeMethod='bookmark.operation.query';await cold.directory.load(cold.dirBinding);
  assert.equal(cold.directory.snapshot().projection.receipt.confirmation,'unknown');assert.equal(cold.directory.snapshot().projection.facts.blocked,true);
  assert.equal(cold.directory.snapshot().canContinueOriginal,false,'failed exact query does not authorize continuation');
  await cold.directory.continueOriginal(cold.directory.snapshot().generation,cold.dirBinding);assert.equal(cold.writes().length,0);cases++;
 }
 {
  const f=await fixture(official);await f.create();const previous=f.entries();f.options.beforeMethod='bookmark.list';await f.create();
  assert.equal(f.entries(),previous,'readback failure retains the entire last available bookmark projection');
  const writes=f.writes().length;await f.directory.deleteBookmarks(previous[0].bookmarks.map(b=>b.time),f.dirBinding);assert.equal(f.writes().length,writes,'stale snapshot is not canonical toggle admission');
  await f.directory.reconcile(f.directory.snapshot().generation,f.dirBinding);assert.equal(f.entries()[0].bookmarks.length,2);cases++;
 }
 {
  const f=await fixture(official);f.options.afterMethod='bookmark.create';await f.create();const cold=await fixture(official,f);
  cold.options.transformMethod='bookmark.operation.query';cold.options.transform=data=>({...data,head:null});await cold.directory.load(cold.dirBinding);
  assert.equal(cold.directory.snapshot().projection.receipt.confirmation,'unknown');assert.equal(cold.directory.snapshot().canContinueOriginal,false);assert.equal(cold.writes().length,0);assert.notEqual(cold.disk('bookmark'),'');cases++;
 }
 {
  const f=await fixture(official);await f.create();await f.create();await f.create();f.options.afterMethod='bookmark.delete';
  await f.directory.deleteBookmarks(f.entries()[0].bookmarks.map(b=>b.time),f.dirBinding);
  const cold=await fixture(official,f);await cold.directory.load(cold.dirBinding);
  assert.equal(cold.directory.snapshot().requestedCount,3);assert.equal(cold.directory.snapshot().confirmedCount,1);
  assert.equal(cold.directory.snapshot().completion,'partial','cold exact single receipt cannot report entire batch complete');
  assert.equal(cold.writes().length,0);assert.equal(cold.entries()[0].bookmarks.length,2);cases++;
 }
 for(const method of ['bookmark.create','bookmark.delete']){
  const f=await fixture(official);if(method==='bookmark.delete')await f.create();
  f.options.afterMethod=method;
  if(method==='bookmark.create')await f.create();else await f.directory.deleteBookmarks(f.entries()[0].bookmarks.map(b=>b.time),f.dirBinding);
  assert.equal(f.directory.snapshot().projection.receipt.confirmation,'unknown');const original=JSON.parse(f.disk('bookmark'));assert.equal(original.phase,'pending');
  const cold=await fixture(official,f);await cold.directory.load(cold.dirBinding);assert.equal(cold.directory.snapshot().projection.receipt.confirmation,'confirmed');assert.equal(cold.writes().length,0,'cold exact query never repeats original bookmark mutation');assert.equal(cold.disk('bookmark'),'');
  const rows=(await cold.command('bookmark.list',{bookName:'Book',bookAuthor:'Author'})).data.bookmarks;assert.equal(rows.length,method==='bookmark.create'?1:0);cases++;
 }
 {
  const f=await fixture(official);f.options.beforeMethod='bookmark.create';await f.create();const original=JSON.parse(f.disk('bookmark'));
  const cold=await fixture(official,f);await cold.directory.load(cold.dirBinding);assert.equal(cold.writes().length,0);assert.equal(cold.directory.snapshot().projection.receipt.confirmation,'unknown');assert.equal(cold.directory.snapshot().canContinueOriginal,true);
  await cold.create();assert.equal(cold.writes().length,0,'unknown cannot allocate a different ID');
  const generation=cold.directory.snapshot().generation;await cold.directory.continueOriginal(generation+1,cold.dirBinding);assert.equal(cold.writes().length,0,'old callback generation denied');
  await Promise.all([cold.directory.continueOriginal(generation,cold.dirBinding),cold.directory.continueOriginal(generation,cold.dirBinding)]);
  assert.equal(cold.writes().length,1);assert.deepEqual(cold.writes()[0].params,original.params);assert.equal(cold.entries()[0].bookmarks.length,1);cases++;
 }
 {
  const f=await fixture(official);f.options.beforeMethod='bookmark.create';await f.create();const original=f.disk('bookmark');
  const cold=await fixture(official,f);await cold.directory.load(cold.dirBinding);cold.options.typedMethod='bookmark.create';await cold.directory.continueOriginal(cold.directory.snapshot().generation,cold.dirBinding);
  assert.equal(cold.directory.snapshot().projection.receipt.confirmation,'unknown','nonExecution on continuation cannot erase earlier uncertainty');assert.equal(cold.disk('bookmark'),original);assert.equal(cold.directory.snapshot().canContinueOriginal,true);cases++;
 }
 {
  const f=await fixture(official);f.options.afterMethod='cache.clear';await f.settings.clear(()=>true);assert.equal(f.settings.current().confirmation,'unknown');
  const cold=await fixture(official,f);await cold.settings.reconcile(()=>true);assert.equal(cold.settings.current().confirmation,'confirmed');assert.equal(cold.writes().length,0);assert.equal(cold.disk('cacheClear'),'');
  cold.options.status=true;await cold.clear();assert.equal(cold.writes().length,1);assert.equal(cold.writes()[0].params.sequence,2,'Settings and Offline share exact cache-clear head');assert.equal(cold.calls.filter(c=>c.platform).length,1);cases++;
 }
 {
  const f=await fixture(official);f.options.beforeMethod='cache.clear';await f.settings.clear(()=>true);const original=JSON.parse(f.disk('cacheClear'));
  const cold=await fixture(official,f);await cold.settings.reconcile(()=>true);assert.equal(cold.writes().length,0);assert.equal(cold.settings.current().canContinueOriginal,true);
  await cold.offline.downloadChapter(0,cold.offlineBinding);assert.equal(cold.calls.filter(c=>c.method==='cache.book.prefetch').length,0,'cold global pending clear bars overlapping downloads');
  await cold.clear();assert.equal(cold.writes().length,0,'another clear consumer cannot overwrite shared intent');
  await cold.settings.continueOriginal(cold.settings.current().operation.generation,()=>true);assert.equal(cold.settings.current().confirmation,'confirmed');assert.deepEqual(cold.writes()[0].params,original.params);cases++;
 }
 {
  const f=await fixture(official);f.options.beforeMethod='cache.clear.operation.settle';await f.settings.clear(()=>true);
  assert.equal(f.settings.current().confirmation,'confirmed');assert.equal(JSON.parse(f.disk('cacheClear')).phase,'confirmed');
  const cold=await fixture(official,f);cold.options.beforeMethod='cache.clear.operation.query';await cold.settings.reconcile(()=>true);
  assert.equal(cold.settings.current().confirmation,'confirmed','durably retained qualified ACK is not erased by later query failure');assert.equal(cold.settings.current().canContinueOriginal,false);assert.equal(cold.writes().length,0);cases++;
 }
 {
  const f=await fixture(official);f.options.afterMethod='cache.clear.operation.settle';await f.settings.clear(()=>true);assert.equal(f.settings.current().confirmation,'confirmed');assert.equal(f.disk('cacheClear'),'');assert.equal(f.writes().length,1);assert.ok(f.reads().length>=3,'lost metadata ACK proved by exact pure query');cases++;
 }
 {
  const f=await fixture(official);f.options.loseFinishAt=3;await f.settings.clear(()=>true);assert.equal(f.settings.current().confirmation,'confirmed');assert.equal(f.settings.current().operation.fact,'refreshFailed');assert.equal(f.io.failWrites,0,'finish invoked never rolls back the published file');
  assert.equal((await f.clearStore.pending()).phase,'confirmed','warm pending remains after local clear lost ACK');await f.settings.reconcile(()=>true);assert.equal((await f.clearStore.pending()),undefined);assert.equal(f.writes().length,1);cases++;
 }
 {
  const f=await fixture(official);f.options.typedMethod='cache.clear';await f.settings.clear(()=>true);assert.equal(f.settings.current().confirmation,'undispatched');assert.equal(f.disk('cacheClear'),'');await f.settings.clear(()=>true);assert.equal(f.settings.current().confirmation,'confirmed');assert.deepEqual(f.writes().map(c=>c.params.sequence),[1,1],'known nondispatch safely admits head+1 again');cases++;
 }
 {
  const f=await fixture(official);f.options.loseFinishAt=1;await f.settings.clear(()=>true);assert.equal(f.writes().length,0);assert.equal(f.settings.current().confirmation,'undispatched');assert.equal(f.disk('cacheClear'),'');assert.equal(f.io.failWrites,0);cases++;
 }
 {
  const f=await fixture(official);f.options.status=true;f.options.imageFailure=true;await f.clear();assert.equal(f.offline.snapshot().projection.receipt.confirmation,'confirmed');assert.equal(f.offline.snapshot().materialization,'failed');assert.match(f.offline.snapshot().materializationFailure,/image cleanup failed/);
  await f.offline.reconcile(f.offline.snapshot().generation,f.offlineBinding);assert.match(f.offline.snapshot().projection.facts.message,/image cleanup failed/);assert.equal(f.calls.filter(c=>c.platform).length,1);assert.equal(f.writes().length,1);cases++;
 }
 {
  const f=await fixture(official);f.options.beforeMethod='bookmark.create';await f.create();const original=JSON.parse(f.disk('bookmark'));original.params.operationId=original.params.operationId.replace(/\/1$/,'/2');writeFileSync(resolve(f.files,'reader-bookmark-intent-v1.json'),JSON.stringify(original));
  const cold=await fixture(official,f);await assert.rejects(cold.bookmarkStore.pending(),/身份\/内容无效/);assert.equal(cold.calls.length,0);assert.equal(readFileSync(resolve(f.files,'reader-bookmark-intent-v1.json'),'utf8'),JSON.stringify(original));cases++;
 }
 {
  const f=await fixture(official);const readonlyRuntime={...f.runtime};f.install(readonlyRuntime);const early=f.Directory.forRuntime(readonlyRuntime,()=>f.Runtime.isCurrent(readonlyRuntime));assert.ok(early);const store=new f.types.BookmarkOperationIntentStore(readonlyRuntime,()=>f.Runtime.isCurrent(readonlyRuntime));assert.equal(f.Directory.forRuntime(readonlyRuntime,()=>true,undefined,store),early);
  await early.createPosition(bookmarkInput,f.dirBinding);assert.equal(f.writes()[0].params.sequence,1,'readonly-first owner later receives mandatory durable authority');cases++;
 }
 {
  const f=await fixture(official),gate=deferred();f.options.pauseMethod='cache.clear';f.options.pauseAfterDispatch=true;f.options.gate=gate;
  const task=f.settings.clear(()=>true);await until(()=>f.writes().length===1);
  const deliveries=[];const host=new f.SettingsHost(()=>{},()=>({}),()=>true,()=>({filesDir:f.files}),()=>{},s=>deliveries.push(s));
  const joined=host.clearCache(f.runtime,()=>true);assert.equal(host.cacheCleanupSnapshot(f.runtime),f.settings.current());gate.resolve();await Promise.all([task,joined]);
  assert.equal(f.writes().length,1,'same Runtime Index/SettingsHost recreation shares accepted mutation mutex');assert.equal(host.cacheCleanupSnapshot(f.runtime).confirmation,'confirmed');
  assert.ok(deliveries.some(s=>s.confirmation==='confirmed'));const successor={...f.runtime};f.install(successor);
  assert.equal(f.SettingsOwner.forRuntime(f.runtime,()=>{}),undefined,'retired old lookup cannot replace current owner');
  const current=f.SettingsOwner.forRuntime(successor,()=>{});assert.ok(current);assert.notEqual(current,f.settings);cases++;
 }
 {
  const f=await fixture(official);f.options.beforeMethod='cache.clear';await f.settings.clear(()=>true);
  const cold=await fixture(official,f),host=new cold.SettingsHost(()=>{},()=>({}),()=>true,()=>({filesDir:cold.files}));
  await host.reconcileCacheCleanup(cold.runtime,()=>true);const status=host.cacheCleanupSnapshot(cold.runtime);assert.equal(status.canContinueOriginal,true);assert.equal(cold.writes().length,0);
  await host.continueOriginalCacheCleanup(cold.runtime,status.operation.generation+1,()=>true);assert.equal(cold.writes().length,0);
  await host.continueOriginalCacheCleanup(cold.runtime,status.operation.generation,()=>true);assert.equal(cold.writes().length,1);assert.equal(host.cacheCleanupSnapshot(cold.runtime).confirmation,'confirmed');cases++;
 }
 {
  const f=await fixture(official),gate=deferred();const rpc=f.runtime.request.bind(f.runtime);let started=false;
  const Direct=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),['requestDirect'],{
    coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined,LOG_DOMAIN:0,hilog:{warn(){}},DEFAULT_CORE_REQUEST_TIMEOUT_MS:30000});
  const dispatcher=Object.assign(new Direct(),{state:'ready',preparationIntentEpoch:0,runtime:{request:rpc},
    readingEntryPreparations:()=>({beginRequest:()=>false,finishRequest(){}}),wakeReadingPreparations(){},
    async start(){if(this.method==='bookmark.create'){started=true;await gate.promise;}}});
  f.runtime.request=(method,params,options)=>{dispatcher.method=method;return dispatcher.requestDirect(method,params,options);};
  const task=f.create();await until(()=>started);f.retire();gate.resolve();await task;
  assert.equal(f.writes().length,0,'actual Runtime start/fence admission rejects retired UI before native send');
  assert.equal(f.directory.snapshot().projection.receipt.confirmation,'undispatched');assert.equal(await f.bookmarkStore.pending(),undefined);cases++;
 }
 {
  const f=await fixture(official),gate=deferred();f.options.pauseMethod='bookmark.create';f.options.pauseAfterDispatch=true;f.options.gate=gate;const task=f.create();await until(()=>f.writes().length===1);const original=JSON.parse(f.disk('bookmark'));
  f.unset();const cold=await fixture(official,f);await cold.directory.load(cold.dirBinding);assert.equal(cold.writes().length,0);await cold.directory.continueOriginal(cold.directory.snapshot().generation,cold.dirBinding);gate.resolve();await task;
  assert.deepEqual(cold.writes()[0].params,original.params);assert.equal((await cold.command('bookmark.list',{bookName:'Book',bookAuthor:'Author'})).data.bookmarks.length,1,'late old RPC and explicit continuation do not double mutate');assert.equal(cold.disk('bookmark'),'');assert.equal(f.directory.snapshot().projection.receipt.confirmation,'confirmed','late exact ACK remains qualified despite retired publication');cases++;
 }
}
console.log(`PASS ${cases} full-production Host/Gateway/atomic-IO/actual cold Core SQLite cases; repeated in installed SDK whole-source emitter. No VM/native/crash-durability claim.`);

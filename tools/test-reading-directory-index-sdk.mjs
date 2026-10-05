import assert from 'node:assert/strict';
import {fixture,deferred,until,session} from './lib/reading-operation-durable-probe.mjs';
import {makeIndex,settled,indexSource,pRecovery} from './lib/reading-directory-sdk-consumer.mjs';
const checks=[];
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));

{
 const f=await fixture(true),x=makeIndex(f);
 x.idx.createDirectoryChapterStartBookmark({chapterIndex:0,chapterTitle:'Wrong'});assert.equal(f.writes().length,0);
 x.idx.createDirectoryChapterStartBookmark({chapterIndex:0,chapterTitle:'Chapter'});await until(()=>f.writes().length===1);await settled(f);
 assert.equal(x.idx.directoryOperation.projection.receipt.confirmation,'confirmed');assert.equal(x.idx.detailToc[0].bookmarks.length,1);
 assert.equal(x.idx.detailToc[0].level,2);assert.match(f.writes()[0].params.operationId,/\/1$/);assert.equal(x.idx.directoryRecovery().bookmarks.visible,false);
 const leaf=x.render();assert.equal(x.actions(leaf).length,0,'no fault surface/action exists in normal state');checks.push('actual-Index-owner-Core-bookmark-ACK-canonical-SDK-normal-empty');
}
{
 const f=await fixture(true),x=makeIndex(f);f.options.beforeMethod='bookmark.list';
 x.idx.createDirectoryChapterStartBookmark({chapterIndex:0,chapterTitle:'Chapter'});await until(()=>f.writes().length===1);await settled(f);
 assert.equal(x.idx.directoryOperation.projection.receipt.confirmation,'confirmed');assert.equal(x.idx.directoryOperation.projection.receipt.fact,'confirmedRefreshFailed');
 const leaf=x.render();assert.ok(x.nodes(leaf).some(n=>String(n.create).includes('已保存')||String(n.create).includes('已更新')||String(n.create).includes('已确认')));
 const writes=f.writes().length;x.click(leaf,'重新载入核对书签');await until(()=>x.idx.detailToc[0].bookmarks?.length===1);
 assert.equal(f.writes().length,writes);assert.equal(x.idx.directoryOperation.projection.receipt.fact,'confirmedCurrent');checks.push('confirmed-write-refresh-failure-real-native-read-action-no-second-write');
}
{
 const f=await fixture(true),x=makeIndex(f);f.options.afterMethod='bookmark.create';
 x.idx.createDirectoryChapterStartBookmark({chapterIndex:0,chapterTitle:'Chapter'});await until(()=>f.writes().length===1);await settled(f);
 assert.equal(x.idx.directoryOperation.projection.receipt.confirmation,'unknown');const original=JSON.parse(f.disk('bookmark'));
 const leaf=x.render('ReaderFullDirectory');x.click(leaf,'重新载入核对书签');await until(()=>x.idx.directoryOperation.projection.receipt.fact==='confirmedCurrent');
 assert.equal(f.writes().length,1);assert.equal(x.idx.detailToc[0].bookmarks.length,1);assert.equal(original.params.sequence,1);
 checks.push('unknown-lost-ACK-exact-pure-query-real-FullDirectory-action');
}
{
 const f=await fixture(true),x=makeIndex(f);f.options.beforeMethod='bookmark.create';
 x.idx.createDirectoryChapterStartBookmark({chapterIndex:0,chapterTitle:'Chapter'});await until(()=>f.writes().length===1);await settled(f);
 const original=JSON.parse(f.disk('bookmark'));await x.idx.loadControlBookmarks('local','book',()=>true);
 assert.equal(x.idx.directoryRecovery().canContinueBookmarks,true);assert.equal(f.writes().length,1);
 const leaf=x.render(),actor=x.actions(leaf).find(a=>a.label==='继续原操作');assert.ok(actor);
 const native=[...actor.nodes.values()].find(n=>n.onClick).onClick;native();native();await until(()=>x.idx.directoryOperation.projection.receipt.fact==='confirmedCurrent');
 assert.equal(f.writes().length,2);assert.deepEqual(f.writes()[1].params,original.params);assert.equal(x.idx.detailToc[0].bookmarks.length,1);
 checks.push('explicit-original-continuation-exact-ID-payload-double-native-tap-one-write');
}
{
 const f=await fixture(true),x=makeIndex(f);f.options.beforeMethod='bookmark.create';
 x.idx.createDirectoryChapterStartBookmark({chapterIndex:0,chapterTitle:'Chapter'});await until(()=>f.writes().length===1);await settled(f);
 await x.idx.loadControlBookmarks('local','book',()=>true);const leaf=x.render(),actor=x.actions(leaf).find(a=>a.label==='继续原操作');
 const oldNative=[...actor.nodes.values()].find(n=>n.onClick).onClick;
 x.idx.route='reading';oldNative();assert.equal(f.writes().length,1,'closed directory rejects old continuation');
 x.idx.route='directory';x.idx.directoryPresentationGeneration++;oldNative();assert.equal(f.writes().length,1,'same-book reopen rejects the previous physical actor');
 // Actual V1 full Prop update and old observer replay must not upgrade the old
 // actor's generation/presentation. The new tiny key admits a new actor only.
 const recovery=pRecovery(x.p,leaf,x.Recovery);const key=recovery.identities()[0];const generation=recovery.capturedGeneration(key);
 recovery.updateStateVars({recovery:{...x.idx.directoryRecovery(),bookmarks:{...x.idx.directoryRecovery().bookmarks,generation:generation+1}}});
 recovery.replayOnly(recovery.observers.map((fn,i)=>String(fn).includes("new ReaderRecoveryAction")&&!String(fn).includes("If.create")?i:-1).filter(i=>i>=0));assert.equal(actor.generation,generation);oldNative();assert.equal(f.writes().length,1);
 f.unset();x.idx.reconcileDirectoryOperation(generation,x.idx.directoryOperationPresentationId(),true);assert.equal(f.writes().length,1);
 checks.push('closed-reopened-old-physical-V1-retained-observer-and-unset-Runtime-reject');
}
{
 const f=await fixture(true);await f.create();await f.create();await f.create();f.options.afterMethod='bookmark.delete';
 await f.directory.deleteBookmarks(f.entries()[0].bookmarks.map(m=>m.time),f.dirBinding);
 const cold=await fixture(true,f),x=makeIndex(cold);await x.idx.loadControlBookmarks('local','book',()=>true);
 const recovery=x.idx.directoryRecovery();assert.match(recovery.bookmarks.message,/已确认 1\/3/);assert.match(recovery.bookmarks.message,/后续操作未派发/);
 assert.equal(x.idx.detailToc[0].bookmarks.length,2);assert.equal(cold.writes().length,0);assert.equal(x.idx.controlBookmarkProjectionMessage(),'','canonical partial result is not a bookmark-load failure');
 const leaf=x.render();assert.ok(x.nodes(leaf).some(n=>String(n.create).includes('已确认 1/3')));checks.push('actual-cold-Core-partial-batch-never-all-success-no-replay');
}
{
 const f=await fixture(true),x=makeIndex(f,{remote:true});f.options.status=true;f.options.imageFailure=true;
 x.idx.clearDirectoryBookOffline();await until(()=>f.writes().length===1);await settled(f);
 assert.equal(x.idx.offlineOperation.projection.receipt.confirmation,'confirmed');
 assert.equal(x.idx.offlineOperation.materializationFailure,'image cleanup failed','physical failure remains a private owner fact after the Core ACK');
 assert.match(x.idx.directoryRecovery().offline.message,/缓存操作已确认.*请稍后重试/);
 assert.doesNotMatch(JSON.stringify(x.idx.directoryRecovery()),/image cleanup failed|https?:|Cookie|PRIVATE/,
  'the public recovery excludes raw platform diagnostics while retaining confirmed receipt semantics');
 const leaf=x.render('ReaderFullDirectory');x.click(leaf,'核对离线结果');await settled(f);
 assert.equal(f.writes().length,1);assert.equal(f.calls.filter(c=>c.platform).length,1);assert.equal(x.idx.detailToc[0].level,2);
 checks.push('cache-Core-ACK-platform-image-failure-independent-native-pure-reconcile');
}
{
 const f=await fixture(true),x=makeIndex(f,{remote:true});f.options.status=true;f.options.beforeMethod='cache.clear';
 x.idx.clearDirectoryBookOffline();await until(()=>f.writes().length===1);await settled(f);const original=JSON.parse(f.disk('cacheClear'));
 await f.offline.load(x.idx.offlineBinding(f.runtime,session));assert.equal(x.idx.directoryRecovery().canContinueOffline,true);
 const leaf=x.render('ReaderFullDirectory');x.click(leaf,'继续原操作');await until(()=>x.idx.offlineOperation.projection.receipt.fact==='confirmedCurrent');
 assert.equal(f.writes().length,2);assert.deepEqual(f.writes()[1].params,original.params);checks.push('cache-original-continuation-uses-shared-domain-exact-head');
}
for(const domain of ['bookmark','cache']){
 const f=await fixture(true),first=makeIndex(f,{remote:domain==='cache'}),gate=deferred();f.options.status=true;
 f.options.pauseMethod=domain==='bookmark'?'bookmark.create':'cache.clear';f.options.pauseAfterDispatch=true;f.options.gate=gate;
 if(domain==='bookmark')first.idx.createDirectoryChapterStartBookmark({chapterIndex:0,chapterTitle:'Chapter'});else first.idx.clearDirectoryBookOffline();
 await until(()=>f.writes().length===1);first.idx.shelfReceiptRetired=true;
 const superseded=makeIndex(f,{remote:domain==='cache',mount:2});const staleRead=domain==='bookmark'?f.directory.load(superseded.idx.directoryBinding(f.runtime,superseded.idx.detailBook)):f.offline.load(superseded.idx.offlineBinding(f.runtime,session));
 superseded.idx.shelfReceiptRetired=true;
 const current=makeIndex(f,{remote:domain==='cache',mount:3});const freshRead=domain==='bookmark'?current.idx.loadControlBookmarks('local','book',()=>true):f.offline.load(current.idx.offlineBinding(f.runtime,session));
 gate.resolve();await until(()=>(domain==='bookmark'?current.idx.directoryOperation:current.idx.offlineOperation)?.projection.receipt.fact==='confirmedCurrent');await Promise.all([staleRead,freshRead]);await settled(f);
 const state=domain==='bookmark'?current.idx.directoryOperation:current.idx.offlineOperation;
 assert.equal(state.projection.receipt.confirmation,'confirmed');assert.equal(state.projection.receipt.fact,'confirmedCurrent');assert.equal(f.writes().length,1);
 assert.notEqual((domain==='bookmark'?superseded.idx.directoryOperation:superseded.idx.offlineOperation)?.projection.receipt.fact,'confirmedCurrent');
 if(domain==='bookmark')assert.equal(current.idx.detailToc[0].bookmarks.length,1);else assert.equal(current.idx.offlineOperationActive,false);
 checks.push(domain+'-sameRuntime-new-Index-latest-read-joins-late-ACK-no-old-delivery');
}
{
 const f=await fixture(true),first=makeIndex(f),gate=deferred();f.options.pauseMethod='bookmark.create';f.options.pauseAfterDispatch=true;f.options.gate=gate;
 first.idx.createDirectoryChapterStartBookmark({chapterIndex:0,chapterTitle:'Chapter'});await until(()=>f.writes().length===1);first.idx.shelfReceiptRetired=true;
 const next=makeIndex(f,{mount:2});const joined=next.idx.loadControlBookmarks('local','book',()=>true);
 const drain=f.directory.drainPendingRead;f.directory.drainPendingRead=()=>{};
 gate.resolve();await until(()=>!f.directory.busy());await tick();assert.notEqual(next.idx.directoryOperation.projection.receipt.fact,'confirmedCurrent',
  'negative control: removing the production pending-read drain strands the real new consumer');
 f.directory.drainPendingRead=drain;f.directory.drainPendingRead();await joined;assert.equal(next.idx.directoryOperation.projection.receipt.fact,'confirmedCurrent');
 checks.push('actual-read-after-active-drain-negative-control-strands-recreated-consumer');
}
{
 const f=await fixture(true),x=makeIndex(f);f.options.beforeMethod='bookmark.create';x.idx.createDirectoryChapterStartBookmark({chapterIndex:0,chapterTitle:'Chapter'});
 await until(()=>f.writes().length===1);await settled(f);await x.idx.loadControlBookmarks('local','book',()=>true);
 const oldId=x.idx.directoryOperationPresentationId(),g=x.idx.directoryOperation.generation;const before=f.calls.length;
 x.idx.directoryPresentationGeneration++;x.idx.reconcileDirectoryOperation(g,oldId,true);assert.equal(f.calls.length,before);
 const permissive=indexSource.replace("this.route === 'directory' && identity === this.directoryOperationPresentationId() &&", "this.route === 'directory' &&");
 const mutant=makeIndex(f,{index:permissive});mutant.idx.directoryPresentationGeneration++;mutant.idx.reconcileDirectoryOperation(g,oldId,true);
 await until(()=>f.writes().length===2);assert.equal(f.writes()[1].params.operationId,f.writes()[0].params.operationId,'negative control really consumes an obsolete physical intent');
 checks.push('actual-presentation-guard-negative-control-observably-replays-old-intent');
}
assert.doesNotMatch(indexSource,/directoryBookmarkMutationGeneration|offlineMutationGeneration|new LocalReadingFlowGateway|new ReadingOfflineGateway|performDirectoryBookmarkDeletion/);
console.log(JSON.stringify({status:'PASS',checks,scope:'actual SDK-emitted owners/stores + actual cold Core SQLite + Index to actual leaf recovery Builders/shared native actions; native layout/removal/device/crash remain separate'}));

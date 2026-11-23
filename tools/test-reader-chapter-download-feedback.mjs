import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
async function runCase(selectedCase) {
const {registerHooks} = await import('node:module');
const resolution = registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(s+'.ts',c);throw e;}}});
try {
const { currentDirectoryFeedbackOwners, currentCachedChapterFeedbackOwners, currentDownloadPageFeedbackOwners,
 SharedDownloadProjectionRefreshError } = await import('./lib/reader-download-feedback-current-owner-probe.mjs');
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const { ReadingOfflineHost } = await import('../entry/src/main/ets/features/reading/application/ReadingOfflineHost.ts');
const { ReadingOfflineMaterializationError } = await import('../entry/src/main/ets/features/reading/application/ReadingOfflineContract.ts');
const settle=()=>new Promise(r=>setImmediate(r));
const until=async current=>{for(let i=0;i<100;i++){if(current())return;await settle();}assert.fail('actual offline owner did not settle');};
async function fixture(error,mutation,contentKind='manga',confirmation='confirmed'){
 let reject,resolve;const pending=new Promise((a,b)=>{resolve=a;reject=b;});
 const messages=[],states=[],logs=[],calls=[];
 class Gateway{
  async pendingClearOperation(){return undefined;}
  prefetchChapter(session,index,current,evidence){calls.push({session,index,current});evidence.dispatched();
   if(confirmation==='confirmed')evidence.confirmed();return pending;}
  async loadDirectoryProjection(){return [{index:0,title:'Chapter',downloadState:contentKind==='manga'||error===undefined?'completed':'failed'}];}
  async loadProjection(...args){return this.loadDirectoryProjection(...args);}
 }
 const runtime={supportsCoreCapability:()=>true};
 const offline=new ReadingOfflineHost({gateway:new Gateway(),ownsRuntime:()=>true});
 const session={contentKind,identity:{sourceId:'s',bookId:'b'},book:{title:'Book',author:'Author'},entries:[{index:0,title:'Chapter',url:'chapter'}]};
 const owners=currentDirectoryFeedbackOwners({runtime,session,offline,messages,logs,unavailableContext:mutation==='ui-gone',
  entries:[{index:0,title:'Chapter',downloadState:contentKind==='manga'?'completed':'missing',bookmarks:['kept']}]});
 const owner=owners.entry;
 const publish=owners.operations.ports.replaceEntries;
 owners.operations.ports.replaceEntries=entries=>{const next=entries[0].downloadState;
  if(next!==owner.toc[0].downloadState)states.push([0,next]);publish(entries);};
 // This regression owns the retained Host materialization feedback and its
 // actual directory Journey/Entry binding. Shipping chapter buttons now submit to the persistent
 // SharedDownloadCoordinator, whose acceptance/navigation has its own probe.
 void offline.downloadChapter(0,owners.operations.offlineBinding(runtime,session));await until(()=>calls.length===1);
 assert.equal(calls[0].current(),true);assert.deepEqual(states,contentKind==='manga'?[]:[[0,'queued']]);
 if(mutation==='book')owner.session={...session,identity:{sourceId:'s',bookId:'other'}};
 if(mutation==='source')owner.session={...session,identity:{sourceId:'other',bookId:'b'}};
 const successor={generation:99};
 if(mutation==='superseded'){owner.sessionGeneration++;owner.offlineOperation=successor;}
 if(mutation==='closed')owner.session=undefined;
 if(error===undefined)resolve([{index:0,downloadState:'completed'}]);else reject(error);
 await until(()=>!offline.busy());
 if(mutation==='superseded')assert.equal(owner.offlineOperation,successor,'retired callback cannot overwrite a successor operation');
 if(mutation===undefined&&error!==undefined){
  assert.equal(offline.snapshot().materialization,'failed');
  assert.doesNotMatch(JSON.stringify(owners.operations.recovery(owner.directoryOperation,owner.offlineOperation)),/PRIVATE|fixture|https|Cookie/,
    'actual public recovery excludes private facts without modifying the owner receipt');
  assert.equal(offline.snapshot().projection.receipt.confirmation,confirmation);
 }
 return{owner,messages,states,logs,calls,offline};
}
if (selectedCase === 'retained-materialization') {
const secret='https://fixture.invalid/a?token=PRIVATE_TEST_TOKEN&Cookie=PRIVATE_TEST_COOKIE';
const dns=Object.assign(new Error(secret), {
 event: {error: {code: 'NETWORK_ERROR', details: {
  host: {diagnostics: {details: {category: 'NETWORK_ENVIRONMENT', phase: 'dns'}}}
 }}}
});
const current=await fixture(dns);
assert.deepEqual(current.states,[],'manga replacement failure does not relabel an existing downloaded chapter');
assert.equal(current.owner.toc[0].downloadState,'completed','authoritative projection retains the previous completed download');
assert.equal(current.messages.length,1,'current chapter failure must be visible, not only logged');
assert.match(current.messages[0],/无法解析书源域名/);
assert.doesNotMatch(current.messages[0],/PRIVATE|fixture|https|Cookie/);
assert.equal(current.logs.length,1,'existing private diagnostic remains');
const unknown=await fixture(dns,undefined,'manga','unknown');
assert.equal(unknown.messages.length,1);assert.match(unknown.messages[0],/尚未确认/);
assert.doesNotMatch(unknown.messages[0],/本章下载失败|PRIVATE|fixture|https|Cookie/);
assert.equal(unknown.owner.toc[0].downloadState,'completed','unknown ACK cannot erase retained downloaded bytes');
const novel=await fixture(dns,undefined,'text');assert.deepEqual(novel.messages,current.messages,'the shared chapter action retains the same safe feedback for novels');assert.deepEqual(novel.states,[[0,'queued'],[0,'failed']]);
for(const mutation of ['book','source','superseded','closed']){
 const stale=await fixture(dns,mutation);assert.deepEqual(stale.messages,[]);assert.deepEqual(stale.states,[]);assert.equal(stale.logs.length,0);
}
for(const cancelled of [new ReadingOfflineMaterializationError('cancelled',secret),new Error('reading offline request was superseded'),new Error('Reader-Core request cancelled by caller: 7')]){
 const f=await fixture(cancelled);assert.deepEqual(f.messages,[],'current cancellation is not an error popup');
}
for(const [error,expected] of [
 [new ReadingOfflineMaterializationError('storage_full',secret),/存储空间不足/],
 [new Error('MANGA_CACHE_STORAGE_FULL'),/存储空间不足/],
 [new Error('MANGA_CHAPTER_CACHE_CAPACITY'),/存储空间不足/],
 [new Error('ENOSPC'),/存储空间不足/],
 [new Error('deadline exceeded '+secret),/超时/],
 [new Error('opaque private '+secret),/网络|稍后重试/],
 [new Error('opaque PRIVATE_TEST_TOKEN PRIVATE_TEST_COOKIE'),/稍后重试/],
]){
 const f=await fixture(error);assert.equal(f.messages.length,1);assert.match(f.messages[0],expected);assert.doesNotMatch(f.messages[0],/PRIVATE|fixture|https|Cookie/);
}
const ok=await fixture(undefined);assert.deepEqual(ok.messages,['全部 1 章下载完成']);assert.equal(ok.owner.toc[0].downloadState,'completed');assert.deepEqual(ok.owner.toc[0].bookmarks,['kept']);
const gone=await fixture(dns,'ui-gone');assert.deepEqual(gone.messages,[]);assert.deepEqual(gone.states,[]);assert.equal(gone.owner.toc[0].downloadState,'completed');
console.log('PASS retained ReadingOfflineHost chapter materialization→actual directory Journey/Entry binding + production safe classifiers/Recovery/feedback port: current DNS visible; source/book/closed/generation stale silent; cancellation silent; fixed storage/timeout/unknown copy excludes secrets; canonical availability/bookmarks and successor-operation fencing preserved; unavailable UI cannot reject download settlement');

}
if (selectedCase === 'download-page' || selectedCase === 'manga-actions') {
// The coordinator's actual typed error is a committed write/readback split.
// Exercise both current feature consumers with that production class, including
// late completion and repeated read failure; recovery must never replay writes.
{
 const Manga=selectedCase==='manga-actions'?selectedProductionMethods(new URL('../entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets',import.meta.url),
  'MangaReadingSurface',['openDownloadActions']):undefined;
 // The original download-page generic-error "unfinished/no notice" scenario
 // is superseded by the current Host UNKNOWN receipt contract. Its original
 // assertions and observed disagreement remain separate legacy evidence;
 // download-page-unknown is an independent explicit leaf below.
 for(const surface of [selectedCase === 'download-page' ? 'downloads' : 'manga'])for(const outcome of selectedCase==='download-page'?['committed-read-failed','stale']:['committed-read-failed','write-failed','stale']){
  let reject;const task=new Promise((_,no)=>reject=no);let writes=0,reads=0,live=true;
  const messages=[],notices=[],runtime={},session={contentKind:'manga',identity:{sourceId:'s',bookId:'b'}};
  const controls={get live(){return live;}};
  const host={snapshot:()=>undefined,busy:()=>false,
   operateManga:async()=>{writes++;await task;},
   loadMangaActions:async(_chapter,binding)=>{if(!binding.current())return [];reads++;if(reads===1)throw Error('private read error');return [];}};
  const directory=surface==='manga'?currentDirectoryFeedbackOwners({runtime,session,offline:host,controls,messages}):undefined;
  const downloads=surface==='downloads'?currentDownloadPageFeedbackOwners({task,controls,messages,
   counts:{get writes(){return writes;},set writes(value){writes=value;},get reads(){return reads;},set reads(value){reads=value;}}}):undefined;
  const refreshDownloads=downloads?.refresh;
  const manga=surface==='manga'?Object.assign(new Manga(),{mounted:true,downloadEnabled:true,exiting:false,
   downloadActionsGeneration:0,panel:'',isReaderIdentityCurrent:()=>live,
   openPanel:async panel=>{manga.panel=panel;},onLoadDownloadActions:chapter=>directory.operations.loadMangaActions(chapter)}):undefined;
  const readExistingEntry=()=>surface==='downloads'?refreshDownloads():manga.openDownloadActions(undefined);
  const work=surface==='downloads'?downloads.run(downloads.intent):directory.operations.performMangaAction('pause');
  await settle();assert.equal(writes,1);if(outcome==='stale')live=false;
  reject(outcome==='write-failed'?Error('private write failure'):new SharedDownloadProjectionRefreshError('pause',Error('private read failure')));
  await work;await settle();
  if(outcome==='stale'){assert.equal(notices.length,0);assert.equal(messages.length,0);}
  else if(outcome==='write-failed'){assert.equal(notices.length,0);assert.match(messages[0],/未完成/);}
  else{
   assert.deepEqual(messages,['下载状态已保存，列表刷新失败']);assert.equal(notices.length,0);
   assert.equal(reads,0,'feedback itself does not dispatch a hidden reload or repeat a write');
   await readExistingEntry();await settle();assert.equal(reads,1);assert.equal(writes,1);
   if(surface==='manga')assert.equal(manga.downloadActionsFailure,'下载状态暂时无法读取，请重试');
   await readExistingEntry();await settle();assert.equal(reads,2);assert.equal(writes,1);
   if(surface==='manga')assert.equal(manga.downloadActionsFailure,'');
   assert.equal(notices.length,0);assert.equal(messages.length,1,'ordinary re-reads do not recreate a pending write notice');
   live=false;await readExistingEntry();await settle();
   assert.equal(reads,2,'a retired existing refresh entry cannot read for its successor');
  }
  if(outcome==='stale'){await readExistingEntry();await settle();assert.equal(reads,0);assert.equal(writes,1);}
 }
 if(selectedCase==='download-page'){
  const messages=[],counts={writes:0,reads:0},controls={live:true};
  const downloads=currentDownloadPageFeedbackOwners({task:Promise.resolve(),controls,messages,counts});
  await downloads.run(downloads.intent);
  assert.deepEqual(messages,['下载已暂停']);
  assert.equal(counts.writes,1,'normal confirmed operation still executes once');
  assert.equal(counts.reads,1,'normal confirmed operation retains its original automatic list refresh');
 }
 console.log(`PASS actual current owner ${selectedCase}: committed write feedback, current consumer readback retry without write replay, and stale response fencing`);
}

}
if(selectedCase==='download-page-unknown'){
 for(const outcome of ['current','late']){
  let reject;const task=new Promise((_,no)=>{reject=no;});
  const messages=[],counts={writes:0,reads:0},controls={live:true};
  const downloads=currentDownloadPageFeedbackOwners({task,controls,messages,counts});
  const work=downloads.run(downloads.intent);await settle();assert.equal(counts.writes,1);
  const successor=currentDownloadPageFeedbackOwners({task:Promise.resolve(),controls:{live:true},messages:[],counts:{writes:0,reads:0}});
  const successorBefore=structuredClone(successor.presentation.batchRecovery);
  if(outcome==='late')controls.live=false;
  reject(Error('PRIVATE original write ACK unavailable'));await work;await settle();
  assert.equal(counts.writes,1);assert.deepEqual(messages,[],'UNKNOWN cannot emit a settled completion or failure toast');
  assert.deepEqual(successor.presentation.batchRecovery,successorBefore,'old accepted operation cannot publish into a successor owner');
  if(outcome==='late'){
   assert.equal(downloads.presentation.isCurrent('d'),false);
   downloads.refresh();await settle();assert.equal(counts.reads,0,'late unknown response and retired refresh remain silent');
   continue;
  }
  const recovery=structuredClone(downloads.presentation.batchRecovery);
  assert.equal(recovery.visible,true);assert.equal(recovery.canRetry,true);assert.match(recovery.message,/未确认/);
  assert.doesNotMatch(recovery.message,/PRIVATE|ACK|http/);
  assert.equal(counts.reads,1,'UNKNOWN retains the current owner original automatic observation');
  downloads.presentation.refreshBatchRecovery('d',recovery.generation);await settle();
  downloads.refresh();await settle();assert.equal(counts.reads,3);assert.equal(counts.writes,1);
  assert.deepEqual(downloads.presentation.batchRecovery,recovery,'successful list reads cannot confirm the original UNKNOWN write');
  await downloads.run(downloads.intent);assert.equal(counts.writes,1,'same uncertain target cannot blindly replay its original operation');
  controls.live=false;downloads.refresh();await downloads.run(downloads.intent);await settle();
  assert.equal(counts.reads,3);assert.equal(counts.writes,1);assert.deepEqual(messages,[]);
 }
 console.log('PASS actual Host generic failure→Presentation UNKNOWN; explicit observation preserves uncertainty, same target cannot replay, late/retired owners stay silent');
}
if (selectedCase === 'cache-decision') {
{
 const notices=[],messages=[],runtime={};let live=true,refreshes=0;
 const error=Error('https://private.invalid/?token=PRIVATE');
 const host={snapshot:()=>({scopeId:4}),recoverCachedChapter:async(scope,original,current)=>{
  assert.equal(scope,4);assert.equal(original,error);assert.equal(current(),true);refreshes++;
  throw Error('SQLITE_PRIVATE /private/book token=PRIVATE');}};
 const {receiver:index}=currentCachedChapterFeedbackOwners(runtime,host,{get live(){return live;}},messages,notices);
 assert.equal(await index.chooseCachedChapterRefresh(error,()=>live),false);assert.equal(refreshes,0);
 assert.equal(notices.length,1);assert.match(notices[0].message,/本章缓存需要重新验证/);
 const first=notices[0].generation;index.readingEntry.retryRecoveryNotice(first);await settle();
 assert.equal(refreshes,1);assert.equal(messages.length,1);assert.equal(notices.length,2);
 assert.doesNotMatch(messages[0],/SQLITE|private|PRIVATE|token|http/);
 assert.equal(index.readingEntry.recoveryNotice.visible,true);assert.equal(index.readingEntry.recoveryActionLabel,'刷新本章');
 assert.equal(notices[1].message,notices[0].message,'failure reconstructs the original decision, never an actionless error notice');
 assert.ok(notices[1].generation>first);
 index.readingEntry.retryRecoveryNotice(first);await settle();assert.equal(refreshes,1,'consumed generation cannot replay the original refresh');
 index.readingEntry.retryRecoveryNotice(notices[1].generation);await settle();
 assert.equal(refreshes,2);assert.equal(messages.length,2);assert.equal(notices.length,3);
 assert.ok(notices.every(notice=>notice.message===notices[0].message&&notice.label==='刷新本章'));
 assert.ok(messages.every(message=>!/SQLITE|private|PRIVATE|token|http/.test(message)));
 live=false;index.readingEntry.retryRecoveryNotice(notices[2].generation);await settle();
 assert.equal(await index.chooseCachedChapterRefresh(error,()=>live),false);
 assert.equal(refreshes,2);assert.equal(notices.length,3);assert.equal(messages.length,2,'retired current rejects both the old action and a replacement decision');
 live=true;index.readingEntry.retryRecoveryNotice(notices[2].generation);live=false;await settle();
 assert.equal(refreshes,3);assert.equal(notices.length,3);assert.equal(messages.length,2,'late failed refresh cannot reconstruct or notify on a successor presentation');
 console.log('PASS actual cached-refresh consume handler: one explicit refresh, safe short failure, original decision rebuilt with a fresh generation and retry, stale generations/current and late failures stay silent');
}
}

} finally { resolution.deregister(); }
}
for (const id of selectContractCases({
  'download-page': { description: 'Current download-page committed-write/read-refresh feedback without write replay', resources: [] },
  'download-page-unknown': { description: 'Current Host generic-error UNKNOWN remains unresolved by reads, blocks same-target replay and fences late publication', resources: [] },
  'manga-actions': { description: 'Current manga actions committed-write/reopen feedback and stale read fencing', resources: [] },
  'cache-decision': { description: 'Current cached chapter explicit recovery decision/retry generation and privacy', resources: [] },
  'retained-materialization': { description: 'Explicit retained ReadingOfflineHost compatibility; not shipping chapter-button dispatch or release prerequisite', resources: [] },
})) { await runCase(id); recordContractCasePass(id); }

import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import {createRequire,registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(s+'.ts',c);throw e;}}});
const {productionMotionMethods}=await import(pathToFileURL(root+'/tools/lib/reader-motion-method-probe.mjs'));
const {errorMessageOf,isDomainResolutionFailure,isNetworkEnvironmentFailure}=await import(pathToFileURL(root+'/entry/src/main/ets/app/ErrorMessage.ts'));
const {diagnosticCodeOf}=await import(pathToFileURL(root+'/entry/src/main/ets/app/LogPrivacy.ts'));
const {normalizeReadingOfflineMaterializationError,ReadingOfflineMaterializationError}=await import(pathToFileURL(root+'/entry/src/main/ets/features/reading/ReadingOfflineContract.ts'));
const {ReadingOfflineHost}=await import(pathToFileURL(root+'/entry/src/main/ets/features/reading/ReadingOfflineHost.ts'));
const {readingOfflineFailureHint}=await import(pathToFileURL(root+'/entry/src/main/ets/features/reading/ReadingOfflineFailurePresentation.ts'));
const {EMPTY_READING_DIRECTORY_RECOVERY,readingDirectoryRecovery}=await import(pathToFileURL(root+'/entry/src/main/ets/features/reading/ReadingDirectoryRecovery.ts'));
const {runtimeOwnerIdentityProbe}=await import('./lib/reader-runtime-admission-probe.mjs');
const sourceFile=process.env.READER_DOWNLOAD_FEEDBACK_INDEX??root+'/entry/src/main/ets/pages/Index.ets';
const require=createRequire(import.meta.url);
const sdk=resolveEtsLoaderRoot();
const ts=require(sdk+'/node_modules/typescript');
const tree=ts.createSourceFile(virtualFilePath('DownloadFeedbackProbe.ets'),readFileSync(sourceFile,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
assert.equal(tree.parseDiagnostics.length,0);
const memberNames=new Set(tree.statements.find(n=>n.name?.getText(tree)==='Index').members.map(n=>n.name?.getText(tree)));
const methods=['downloadDirectoryChapter','showChapterDownloadFailure','showOfflineDownloadFeedback','offlineDownloadFeedback',
 'offlineBinding','directoryOperationBindingId','directoryOperationPresentationId','isCurrentDirectoryOperationBinding',
 'applyOwnedDirectoryEntries','directoryRecovery'];
for(const method of methods)assert.ok(memberNames.has(method),`actual Index method ${method} exists`);
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
 const Index=productionMotionMethods(sourceFile,methods,{
  ReaderRuntimeOwner:runtimeOwnerIdentityProbe(()=>runtime),hilog:{error:(...args)=>logs.push(args)},DOMAIN:0,
  readingOfflineFailureHint,readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY,
  errorMessageOf,isDomainResolutionFailure,isNetworkEnvironmentFailure,diagnosticCodeOf,normalizeReadingOfflineMaterializationError});
 const session={contentKind,identity:{sourceId:'s',bookId:'b'},book:{title:'Book',author:'Author'},entries:[{index:0,title:'Chapter',url:'chapter'}]};
 const owner=Object.assign(new Index(),{mountedRuntimeOwner:runtime,shelfReceiptRetired:false,route:'detail',
  navigationGeneration:1,detailShelfAdmissionMount:1,remoteSessionGeneration:1,directoryPresentationGeneration:1,
  detailBook:{...session.identity,title:'Book',author:'Author'},remoteReadingSession:session,
  detailToc:[{index:0,title:'Chapter',downloadState:contentKind==='manga'?'completed':'missing',bookmarks:['kept']}],
  getReadingOfflineHost:()=>offline,getReadingEntryHost:()=>undefined,
  isKnownDetailChapter:index=>index===0,
  getUIContext:()=>({getPromptAction:()=>({showToast:({message})=>{if(mutation==='ui-gone')throw new Error('context gone');messages.push(message);}})})});
 const publish=owner.applyOwnedDirectoryEntries.bind(owner);
 owner.applyOwnedDirectoryEntries=entries=>{const next=entries[0].downloadState;
  if(next!==owner.detailToc[0].downloadState)states.push([0,next]);publish(entries);};
 // This regression owns the retained Host materialization feedback and its
 // actual Index binding. Shipping chapter buttons now submit to the persistent
 // SharedDownloadCoordinator, whose acceptance/navigation has its own probe.
 void offline.downloadChapter(0,owner.offlineBinding(runtime,session));await until(()=>calls.length===1);
 assert.equal(calls[0].current(),true);assert.deepEqual(states,contentKind==='manga'?[]:[[0,'queued']]);
 if(mutation==='book')owner.remoteReadingSession={...session,identity:{sourceId:'s',bookId:'other'}};
 if(mutation==='source')owner.remoteReadingSession={...session,identity:{sourceId:'other',bookId:'b'}};
 const successor={generation:99};
 if(mutation==='superseded'){owner.remoteSessionGeneration++;owner.offlineOperation=successor;}
 if(mutation==='closed')owner.remoteReadingSession=undefined;
 if(error===undefined)resolve([{index:0,downloadState:'completed'}]);else reject(error);
 await until(()=>!offline.busy());
 if(mutation==='superseded')assert.equal(owner.offlineOperation,successor,'retired callback cannot overwrite a successor operation');
 if(mutation===undefined&&error!==undefined){
  assert.equal(offline.snapshot().materialization,'failed');
  assert.doesNotMatch(JSON.stringify(owner.directoryRecovery()),/PRIVATE|fixture|https|Cookie/,
    'actual public recovery excludes private facts without modifying the owner receipt');
  assert.equal(offline.snapshot().projection.receipt.confirmation,confirmation);
 }
 return{owner,messages,states,logs,calls,offline};
}
const secret='https://fixture.invalid/a?token=PRIVATE_TEST_TOKEN&Cookie=PRIVATE_TEST_COOKIE';
const dns=Object.assign(new Error(secret), {
 event: {error: {code: 'NETWORK_ERROR', details: {
  host: {diagnostics: {details: {category: 'NETWORK_ENVIRONMENT', phase: 'dns'}}}
 }}}
});
const current=await fixture(dns);
assert.deepEqual(current.states,[],'manga replacement failure does not relabel an existing downloaded chapter');
assert.equal(current.owner.detailToc[0].downloadState,'completed','authoritative projection retains the previous completed download');
assert.equal(current.messages.length,1,'current chapter failure must be visible, not only logged');
assert.match(current.messages[0],/无法解析书源域名/);
assert.doesNotMatch(current.messages[0],/PRIVATE|fixture|https|Cookie/);
assert.equal(current.logs.length,1,'existing private diagnostic remains');
const unknown=await fixture(dns,undefined,'manga','unknown');
assert.equal(unknown.messages.length,1);assert.match(unknown.messages[0],/尚未确认/);
assert.doesNotMatch(unknown.messages[0],/本章下载失败|PRIVATE|fixture|https|Cookie/);
assert.equal(unknown.owner.detailToc[0].downloadState,'completed','unknown ACK cannot erase retained downloaded bytes');
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
const ok=await fixture(undefined);assert.deepEqual(ok.messages,['全部 1 章下载完成']);assert.equal(ok.owner.detailToc[0].downloadState,'completed');assert.deepEqual(ok.owner.detailToc[0].bookmarks,['kept']);
const gone=await fixture(dns,'ui-gone');assert.deepEqual(gone.messages,[]);assert.deepEqual(gone.states,[]);assert.equal(gone.owner.detailToc[0].downloadState,'completed');
console.log('PASS retained ReadingOfflineHost chapter materialization→actual Index binding + production safe classifiers/Recovery/Toast: current DNS visible; source/book/closed/generation stale silent; cancellation silent; fixed storage/timeout/unknown copy excludes secrets; canonical availability/bookmarks and successor-operation fencing preserved; unavailable UI cannot reject download settlement');

// The coordinator's actual typed error is a committed write/readback split.
// Exercise both shipping Index consumers with that production class, including
// late completion and repeated read failure; recovery must never replay writes.
{
 const {stripTypeScriptTypes}=await import('node:module');
 const coordinatorSource=readFileSync(root+'/entry/src/main/ets/features/downloads/SharedDownloadCoordinator.ts','utf8');
 const errorSource=coordinatorSource.slice(coordinatorSource.indexOf('export class SharedDownloadProjectionRefreshError'),coordinatorSource.indexOf('type DownloadOperationStage'));
 const SharedDownloadProjectionRefreshError=new Function(stripTypeScriptTypes(errorSource.replace('export class','class'))+';return SharedDownloadProjectionRefreshError;')();
 const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
  ['markDownloadIntentPending','performMangaDownloadAction'],{SharedDownloadProjectionRefreshError,
   SharedDownloadActionTarget:class {constructor(sourceId,bookId,chapterIndices){Object.assign(this,{sourceId,bookId,chapterIndices});}},
   readingOfflineFailureHint,errorMessageOf,hilog:{warn(){}},DOMAIN:0});
 for(const surface of ['downloads','manga'])for(const outcome of ['committed-read-failed','write-failed','stale']){
  let reject;const task=new Promise((_,no)=>reject=no);let writes=0,reads=0,live=true;
  const messages=[],notices=[],runtime={},session={contentKind:'manga',identity:{sourceId:'s',bookId:'b'}};
  const binding={session,current:()=>live};
  const host={runAction:async()=>{writes++;await task;},operateManga:async()=>{writes++;await task;},
   reload:async current=>{if(current())reads++;},load:async binding=>{if(binding.current())reads++;if(reads===1)throw Error('private read error');}};
  const index=Object.assign(new Index(),{route:'downloads',downloadBooks:[session.identity],mountedRuntimeOwner:runtime,
   navigationGeneration:1,downloadPresentationIdentity:'d',downloadHost:host,remoteReadingSession:session,
   mangaDownloadActionActiveKey:'',mangaDownloadActionGeneration:0,offlineBinding:()=>binding,getReadingOfflineHost:()=>host,
   isCurrentDownloadPresentation:()=>live,showOfflineDownloadFeedback:message=>messages.push(message),
   showIndexRecoveryNotice:(message,label,action,current)=>notices.push({message,label,action,current})});
  const work=surface==='downloads'?index.markDownloadIntentPending({action:'pause',books:[session.identity]}):index.performMangaDownloadAction('pause');
  await settle();assert.equal(writes,1);if(outcome==='stale')live=false;
  reject(outcome==='write-failed'?Error('private write failure'):new SharedDownloadProjectionRefreshError('pause',Error('private read failure')));
  await work;await settle();
  if(outcome==='stale'){assert.equal(notices.length,0);assert.equal(messages.length,0);}
  else if(outcome==='write-failed'){assert.equal(notices.length,0);assert.match(messages[0],/未完成/);}
  else{
   assert.equal(messages.length,0);assert.match(notices[0].message,/已保存/);assert.equal(notices[0].label,'刷新列表');
   notices[0].action();await settle();assert.equal(reads,1);assert.equal(writes,1);
   if(surface==='manga'){assert.equal(notices.length,2);assert.match(notices[1].message,/已保存/);notices[1].action();await settle();assert.equal(reads,2);}
  }
 }
 console.log('PASS actual Index download/manga committed projection failure remains saved with read-only retry; generic write failures and retired responses remain distinct');
}

{
 const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),['chooseCachedChapterRefresh'],{diagnosticCodeOf});
 const notices=[];let live=true,refreshes=0;
 const index=Object.assign(new Index(),{showIndexRecoveryNotice:(message,label,action,current)=>notices.push({message,label,action,current}),
  refreshCachedChapterFromPrompt:async()=>{refreshes++;throw Error('SQLITE_PRIVATE /private/book token=PRIVATE');}});
 const error=Error('https://private.invalid/?token=PRIVATE');
 assert.equal(await index.chooseCachedChapterRefresh(error,()=>live),false);assert.equal(refreshes,0);
 assert.doesNotMatch(notices[0].message,/private|PRIVATE|token|http/);notices[0].action();await settle();
 assert.equal(refreshes,1);assert.equal(notices.length,2);assert.doesNotMatch(notices[1].message,/SQLITE|private|PRIVATE|token/);
 live=false;assert.equal(await index.chooseCachedChapterRefresh(error,()=>live),false);assert.equal(notices.length,2);
 console.log('PASS actual Index cached chapter refresh requires explicit scoped action and keeps raw first/second errors out of public notice');
}

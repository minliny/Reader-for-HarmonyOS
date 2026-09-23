import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderCoreRequestError } from '../entry/vendor/core-harmony/sdk/reader_core.ts';

const file = name => fileURLToPath(new URL(`../entry/src/main/ets/${name}`, import.meta.url));
const source = readFileSync(file('pages/Index.ets'),'utf8');
const pendingSource = source.slice(source.indexOf('class PendingSourceSwitchTransaction {'),source.indexOf('\nclass RemoteDetailAdmission'));
const Pending = new Function(`${stripTypeScriptTypes(pendingSource)};return PendingSourceSwitchTransaction;`)();
const anchorSource=source.slice(source.indexOf('class SourceSwitchAnchor {'),source.indexOf('\nclass PendingSourceSwitchTransaction'));
const Anchor=new Function(`${stripTypeScriptTypes(anchorSource)};return SourceSwitchAnchor;`)();
const runtime = { bookAcquisitions:()=>({setPreparationVisible(){}}) };
let coreProgressCalls=0;
let progressFailure;
let canonicalShelf;
const cleared=[];
class RemoteGateway { async loadProgress(){coreProgressCalls++;if(progressFailure)throw progressFailure;return {kind:'restored',progress:{chapterIndex:11,chapterOffset:52}};} }
let localGatewayConstructions=0;
class LocalGateway {
  constructor(){localGatewayConstructions++;}
  async loadToc(){return {entries:[{index:0,title:'本地第一章'}]};}
  async loadDirectoryProjection(_bookId,_title,_author,entries){return entries;}
}
const Host = productionMotionMethods(file('pages/Index.ets'),[
  'openReading','openLocalBookDetail','openRemoteBookDetail','onRemoteSessionReady',
  'performSourceSwitchSeam','onReadingFailure','openFullDirectory','onPickSource',
  'presentSourceSwitchAcquisitionFailure','retryFailedSourceSwitch','resolveSourceSwitchAnchor',
  'preparePendingSourceSwitchForNextChoice','resolveReaderSourceSwitchTransaction','reconcilePendingSourceSwitches',
  'dismissSourceSwitchFailure','applyReadingCommit','onSearchResultSelected','consumeSystemFileOpen',
],{LOCAL_SOURCE_ID:'local',DOMAIN:0,ReaderRuntimeOwner:{current:()=>runtime},
  LocalReadingFlowGateway:LocalGateway,RemoteReadingFlowGateway:RemoteGateway,
  ReadingOfflineGateway:class {async clearBookIdentity(sourceId,bookId){cleared.push([sourceId,bookId]);}},
  ReaderCoreRequestError,ReaderCoreGateway:class {async loadShelfBook(){return canonicalShelf;}},
  errorMessageOf:error=>error.message,remoteReadingFailureKindOf:error=>error.kind,
  PendingSourceSwitchTransaction:Pending,SourceSwitchAnchor:Anchor,hilog:{info(){},warn(){},error(){}},
  sourceSwitchCandidateKey:(sourceId,bookId)=>JSON.stringify([sourceId,bookId]),
  buildSourceSwitchCommitParams:(identity,candidate,toc,title,index)=>({identity,candidate,toc,title,index}),
});
const book={sourceId:'old-source',bookId:'old-book',title:'书',author:'作者',sourceName:'旧源'};
const candidate={sourceId:'new-source',bookUrl:'new-book',bookName:'书',sourceName:'新源'};
const session={identity:{sourceId:candidate.sourceId,bookId:candidate.bookUrl},book:{title:'书',author:'作者'},
  entries:[{index:17,title:'第十一章',url:'/17'}]};
function fixture(){
  return Object.assign(new Host(),{route:'detail',readingOriginRoute:'detail',detailReturnRoute:'search',
    navigationGeneration:0,readingSessionActive:false,detailBook:{...book},detailToc:[],
    detailInBookshelf:true,bookshelfRemovalActiveKey:'',remoteReadingSession:undefined,
    sourceSwitchState:{kind:'candidates',candidates:[candidate]},sourceSwitchVisible:true,
    shelfBooks:[book],remoteCatalogRefreshAt:new Map(),offlineMutationActiveKey:'',
    directoryBookmarkMutationGeneration:0,directoryBookmarkMutationActiveKey:'',
    refreshBookshelf(){},
    nextNavigationGeneration(){return ++this.navigationGeneration;},
    isKnownDetailChapter:index=>index===11,
    installRemoteReadingSession(value){this.remoteReadingSession=value;},
    readingDetailForShelf:value=>({...value}),readingDetailForRemoteSeed:(seed,name)=>({...seed,sourceName:name}),
    hasDeclaredCoverUrl:()=>true,
    isSourceSwitchActive(generation){return this.sourceSwitchVisible&&this.navigationGeneration===generation;},
    showReadingFailure(){assert.fail('must not trap reading failures in a modal');},
    rollbackPendingSourceSwitch(){assert.fail('body failure must not roll back source identity');},
    reopenSwitchedBook(){assert.fail('committed target session must not reopen detail or refetch catalog');},
  });
}
for(const sourceId of ['local','online']) {
  const host=fixture();host.sourceSwitchVisible=false;host.detailBook={...book,sourceId};
  host.openReading(undefined);
  assert.equal(host.route,'reading');assert.equal(host.readingSessionActive,true);
  assert.equal(host.remoteReadingSession,undefined);assert.deepEqual(host.detailToc,[]);
  const generation=host.navigationGeneration;host.openReading(999);assert.equal(host.navigationGeneration,generation);
}
{
  const host=fixture();host.sourceSwitchVisible=false;host.route='bookshelf';host.readingOriginRoute='bookshelf';
  host.openRemoteBookDetail({...book,detailUrl:book.bookId},book.sourceName,book,true);
  assert.equal(host.route,'reading');assert.equal(host.readingSessionActive,true);
  assert.equal(host.remoteReadingSeed.detailUrl,book.bookId);assert.equal(host.detailInBookshelf,true);
  assert.equal(host.remoteReadingSession,undefined,'network-free first route does not invent a prepared session');
  const local=fixture();local.route='bookshelf';local.readingOriginRoute='bookshelf';
  const beforeLocalGateway=localGatewayConstructions;
  local.openLocalBookDetail({...book,sourceId:'local'},true);
  assert.equal(localGatewayConstructions,beforeLocalGateway,'shelf click must not await a parent TOC acquisition');
  assert.equal(local.route,'reading');assert.equal(local.readingSessionActive,true);
}
{
  const host=fixture();host.sourceSwitchVisible=false;host.openReading(undefined);
  host.onRemoteSessionReady(session);assert.equal(host.remoteReadingSession,undefined,'late other-source callback is ignored');
  const current={...session,identity:{sourceId:book.sourceId,bookId:book.bookId}};
  host.onRemoteSessionReady(current);assert.equal(host.remoteReadingSession,current);
  assert.equal(host.detailToc[0].index,17);assert.equal(host.detailBook.sourceName,book.sourceName);
  const pending={transactionId:'pending'};host.pendingSourceSwitch=pending;
  host.onReadingFailure(book.sourceId,book.bookId,'正文处理设置已改变','POSITION_CONFLICT');
  assert.equal(host.route,'reading');assert.equal(host.pendingSourceSwitch,pending);
  assert.equal(host.readingSessionActive,true);assert.equal(host.detailLoadingMessage,'正文处理设置已改变');
  host.onReadingFailure('other','other','stale');assert.equal(host.detailLoadingMessage,'正文处理设置已改变');
}
{
  const host=fixture();host.sourceSwitchVisible=false;host.openFullDirectory();
  assert.equal(host.route,'directory');assert.equal(host.readingSessionActive,false);
  assert.equal(host.directoryReturnTarget,'detail','empty directory opens independently');
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
// Core's durable chapter remains a valid source-switch anchor when a paged
// shelf/current catalog projection does not carry that row or its title.
for (const oldToc of [[], [{index:2,title:'可见章节',url:'/2'}]]) {
  const host=fixture();host.detailToc=oldToc;host.shelfBooks=[];
  let committed;
  host.getSourceSwitchGateway=()=>({async listPendingSwitches(){return [];},
    async fetchTargetToc(sourceId,bookId,isCurrent,selected){
      assert.equal(selected,candidate);assert.equal(isCurrent(),true);return {readingSession:session};
    },async commitSwitch(params){committed=params;return {status:'success',book:{...book,...session.identity},
      matchedChapter:{order:17},transactionId:'durable-index'};}});
  host.onPickSource(candidate);await settle();
  assert.equal(committed.identity.sourceId,book.sourceId);assert.equal(committed.index,11);
  assert.equal(committed.title,'','unknown title is not invented from a different chapter');
}
{
  const host=fixture();host.detailToc=[];host.shelfBooks=[];
  assert.throws(()=>host.resolveSourceSwitchAnchor({kind:'missing'}),/没有可核对/);
  assert.throws(()=>host.resolveSourceSwitchAnchor({kind:'restored',progress:{chapterIndex:-1}}),/没有可核对/);
}
const oldPending=()=>new Pending('original-source','original-book',book.sourceId,book.bookId,11,'pending-1');
const originalBook={...book,sourceId:'original-source',bookId:'original-book',currentChapterIndex:11,currentChapterTitle:'第十一章'};
{
  const host=fixture();host.readingSessionActive=true;host.sourceSwitchReconciliationGeneration=0;
  const record=oldPending();let reads=0;
  host.getSourceSwitchGateway=()=>({async listPendingSwitches(){reads++;return [{...record},
    {...record,transactionId:'unrelated',targetSourceId:'another'}];},async rollbackSwitch(){assert.fail('startup cannot undo the selected source');}});
  await host.reconcilePendingSourceSwitches();assert.equal(host.pendingSourceSwitch,undefined);
  assert.equal(await host.resolveReaderSourceSwitchTransaction(book.sourceId,book.bookId),'pending-1');
  assert.equal(host.pendingSourceSwitch.targetChapterIndex,-1);
  assert.equal(await host.resolveReaderSourceSwitchTransaction(book.sourceId,book.bookId),'pending-1');
  assert.equal(reads,2,'already restored transaction is reused without another Core list');
  assert.equal(await host.resolveReaderSourceSwitchTransaction('stale','stale'),undefined);
}
{
  const host=fixture();host.readingSessionActive=true;host.route='reading';host.pendingSourceSwitch=oldPending();
  const third={...candidate,sourceId:'third',bookUrl:'third-book'};
  const thirdSession={...session,identity:{sourceId:third.sourceId,bookId:third.bookUrl}};
  const calls=[];host.getSourceSwitchGateway=()=>({async rollbackSwitch(id){calls.push('rollback');assert.equal(id,'pending-1');return {restoredBook:originalBook};},
    async fetchTargetToc(){calls.push('fetch');return {readingSession:thirdSession};},async commitSwitch(params){calls.push('commit');
      assert.equal(params.identity.sourceId,originalBook.sourceId);assert.equal(params.index,11);
      return {status:'success',book:{...book,...thirdSession.identity},matchedChapter:{order:17},transactionId:'pending-2'};}});
  host.onPickSource(third);await settle();
  assert.deepEqual(calls,['rollback','fetch','commit']);assert.equal(host.route,'reading');
  assert.equal(host.pendingSourceSwitch.fromSourceId,originalBook.sourceId);
  assert.equal(host.pendingSourceSwitch.transactionId,'pending-2');assert.equal(host.remoteReadingSession.entries,thirdSession.entries);
}
{
  const host=fixture();host.pendingSourceSwitch=oldPending();let release;
  host.getSourceSwitchGateway=()=>({rollbackSwitch:()=>new Promise(resolve=>{release=resolve;})});
  const pending=host.preparePendingSourceSwitchForNextChoice(host.detailBook,0);
  host.navigationGeneration++;const newerBook={...book,bookId:'newer'};host.detailBook=newerBook;
  release({restoredBook:originalBook});await assert.rejects(pending,/aborted/);
  assert.equal(host.detailBook,newerBook);assert.equal(host.pendingSourceSwitch.transactionId,'pending-1');
}
for(const mode of ['finalized','generic-error','still-pending','missing-target','list-failed']) {
  const host=fixture();host.pendingSourceSwitch=oldPending();canonicalShelf=mode==='missing-target'?undefined:{...book};
  const failure=new ReaderCoreRequestError({error:{code:'INVALID_PARAMS',message:'finalized',details:{reason:'already_finalized',transactionId:'pending-1'}}});
  host.getSourceSwitchGateway=()=>({async rollbackSwitch(){throw mode==='generic-error'?new Error('already_finalized'):failure;},async listPendingSwitches(){
    if(mode==='list-failed')throw new Error('list failure');return mode==='still-pending'?[oldPending()]:[];}});
  if(mode==='finalized'){
    assert.equal((await host.preparePendingSourceSwitchForNextChoice(host.detailBook,0)).sourceId,book.sourceId);
    assert.equal(host.pendingSourceSwitch,undefined);assert.equal(host.route,'reading');
  }else{
    await assert.rejects(host.preparePendingSourceSwitchForNextChoice(host.detailBook,0));
    assert.equal(host.pendingSourceSwitch.transactionId,'pending-1','uncertain compensation never discards durable identity');
  }
}
{
  const host=fixture();host.readingSessionActive=true;host.route='reading';
  host.detailToc=[{index:11,title:'第十一章',navigable:true}];let fetches=0,commits=0;
  coreProgressCalls=0;
  host.getSourceSwitchGateway=()=>({async listPendingSwitches(){return [];},async fetchTargetToc(){fetches++;return {readingSession:session};},
    async commitSwitch(params){commits++;assert.equal(params.index,11);assert.equal(params.title,'第十一章');
      return {status:'success',book:{...book,sourceId:session.identity.sourceId,bookId:session.identity.bookId},matchedChapter:{order:17},transactionId:'opaque'};}});
  host.onPickSource(candidate);await settle();
  assert.equal(fetches,1);assert.equal(commits,1);assert.equal(coreProgressCalls,1);
  assert.equal(host.remoteReadingSession.entries,session.entries);assert.equal(host.requestedChapterIndex,17);
  assert.equal(host.route,'reading');assert.equal(host.sourceSwitchVisible,false);
  assert.equal(host.pendingSourceSwitch.transactionId,'opaque');
  host.onReadingFailure(session.identity.sourceId,session.identity.bookId,'解析失败','SOURCE_CONTENT_EMPTY');
  assert.equal(host.pendingSourceSwitch.transactionId,'opaque');assert.equal(host.route,'reading');
}
{
  const host=fixture();host.readingSessionActive=true;host.route='reading';
  let fetches=0,commits=0;host.getSourceSwitchGateway=()=>({async listPendingSwitches(){return [];},async fetchTargetToc(){fetches++;throw new Error('目标目录解析失败');},async commitSwitch(){commits++;}});
  host.onPickSource(candidate);await settle();
  assert.equal(host.route,'reading');assert.equal(host.detailBook.sourceId,book.sourceId);
  assert.equal(host.sourceSwitchFailureMessage,'目标目录解析失败');assert.equal(host.sourceSwitchVisible,false);
  assert.equal(commits,0);host.retryFailedSourceSwitch();await settle();assert.equal(fetches,2);
  host.detailBook={...book,bookId:'different'};host.retryFailedSourceSwitch();await settle();assert.equal(fetches,2,'stale retry cannot act on another book');
}
{
  const host=fixture();host.readingSessionActive=true;
  const stale={...session,book:{title:'旧别名',author:'旧作者'},contextVersion:'ctx',catalogVersion:'catalog',
    continuationVariables:[{name:'token',value:'kept'}]};
  const canonical={...book,...session.identity,title:'Core规范书名',author:'Core规范作者'};
  host.performSourceSwitchSeam(canonical,stale,17);
  assert.equal(host.detailBook.title,canonical.title);assert.equal(host.detailBook.author,canonical.author);
  assert.equal(host.remoteReadingSession.entries,stale.entries);
  assert.equal(host.remoteReadingSession.continuationVariables,stale.continuationVariables);
  assert.equal(host.remoteReadingSession.contextVersion,'ctx');assert.equal(stale.book.title,'旧别名');
  host.pendingSourceSwitch=new Pending(book.sourceId,book.bookId,session.identity.sourceId,session.identity.bookId,17,'alternate');
  host.remoteReadingSession=undefined;
  host.applyReadingCommit({...session.identity,chapterIndex:22,chapterOffset:61});
  assert.equal(host.pendingSourceSwitch,undefined,'a durable alternative chapter commits and releases its source transaction');
  assert.deepEqual(cleared.at(-1),[book.sourceId,book.bookId]);
}
for(const mode of ['toc-title','no-title','other-error','missing-index','stale']) {
  const host=fixture();host.readingSessionActive=true;host.route='reading';
  host.detailToc=mode==='toc-title'?[{index:11,title:'真实第十一章'}]:[];
  canonicalShelf={...book,currentChapterIndex:mode==='missing-index'?undefined:11,currentChapterTitle:'可能错位的书架标题'};
  progressFailure=Object.assign(new Error('precise position unavailable'),{kind:mode==='other-error'?'NETWORK_FAILED':'POSITION_CONTEXT_STALE'});
  let commits=0;
  host.getSourceSwitchGateway=()=>({async listPendingSwitches(){return [];},async fetchTargetToc(){return {readingSession:session};},
    async commitSwitch(params){commits++;assert.equal(params.index,11);
      assert.equal(params.title,mode==='toc-title'?'真实第十一章':'');
      return {status:'success',book:{...book,...session.identity},matchedChapter:{order:17},transactionId:'coarse'};}});
  host.onPickSource(candidate);
  if(mode==='stale')host.navigationGeneration++;
  await settle();progressFailure=undefined;
  assert.equal(commits,mode==='toc-title'||mode==='no-title'?1:0);
  if(mode==='other-error'||mode==='missing-index')assert.equal(host.sourceSwitchFailureMessage,'precise position unavailable');
}
const Shell=productionMotionMethods(file('features/shell/ReaderShell.ets'),['readingIdentityKey']);
const shell=Object.assign(new Shell(),{sourceId:'source',bookId:'book',fontSize:18});
const key=shell.readingIdentityKey();shell.fontSize=24;assert.equal(shell.readingIdentityKey(),key);
shell.sourceId='another';assert.notEqual(shell.readingIdentityKey(),key);
assert.match(readFileSync(file('features/shell/ReaderShell.ets'),'utf8'),/ForEach\(\[this\.readingIdentityKey\(\)\]/);
{
  const host=fixture();host.route='search';host.shelfBooks=[];
  const localResult={sourceId:'local',sourceName:'本地',bookId:'import-real-id',title:'真实搜索书名',author:'作者',kind:'epub'};
  host.searchPublication={shelfAt:()=>[{...localResult,addedAt:10}]};
  host.onSearchResultSelected(localResult);
  assert.equal(host.route,'detail');assert.equal(host.detailBook.bookId,localResult.bookId);
  assert.equal(host.detailBook.title,localResult.title);assert.equal(host.detailInBookshelf,true);
  assert.equal(host.detailReturnRoute,'search');assert.equal(host.remoteReadingSeed,undefined);
  await settle();assert.equal(host.detailToc[0].title,'本地第一章');
  host.openReading(undefined);assert.equal(host.route,'reading');assert.equal(host.readingSessionActive,true);
}
const Directory=productionMotionMethods(file('features/reading/FullDirectoryPanel.ets'),['catalogEmptyMessage']);
const directory=Object.assign(new Directory(),{entries:[],catalogMessage:'目录解析失败'});
assert.equal(directory.catalogEmptyMessage(),'目录解析失败');directory.catalogMessage='';
assert.match(directory.catalogEmptyMessage(),/暂无可用章节/);directory.entries=[{index:3,title:'已有章'}];
assert.equal(directory.catalogEmptyMessage(),'没有匹配的章节');
assert.match(readFileSync(file('features/reading/ReaderFullDirectory.ets'),'utf8'),/catalogMessage: this\.catalogMessage/);
assert.match(source,/private externalDirectory\([\s\S]*catalogMessage: this\.detailLoadingMessage/);
console.log('PH116 actual entry/recovery/source-switch methods: immediate local/remote routes, exact target session reuse, scoped callbacks/retries, retained failed transaction, semantic reader identity PASS');

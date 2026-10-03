import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {fixture as sourceFixture,origin,target,session as defaultSession,settle as ownerSettled,deferred,gatewayExports,Runtime,read,ReaderCoreRequestError} from './lib/source-switch-owner-probe.mjs';
import {makeIndex} from './lib/source-switch-sdk-consumer.mjs';
import {compileHost,setRuntime} from './lib/reading-entry-owner-probe.mjs';
const {RemoteReadingGatewayError}=await import('../entry/src/main/ets/features/reading/RemoteReadingContract.ts');
const evidence=await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const settle=async()=>{await ownerSettled();await new Promise(setImmediate);await ownerSettled();};
const checks=[];
const book=origin,candidate={sourceId:target.sourceId,bookUrl:target.bookId,bookName:book.title,sourceName:'New'};
const session={...defaultSession,entries:[{index:17,title:'第十一章',url:'https://target/0',variables:[]}]};
let canonicalShelf,localConstructions=0;
function fixture(options={}){
 const f=sourceFixture({shared:true,open:false,targetSession:session,matchedChapterIndex:17,...options});
 const x=makeIndex(f),h=x.index,requests=f.runtime.request.bind(f.runtime);
 const reading=compileHost(undefined,{LocalReadingFlowGateway:class{constructor(){localConstructions++;}async loadToc(){return{entries:[{index:0,title:'本地第一章',url:'/0'}]};}async loadProgress(){return{kind:'missing'};}},
  RemoteReadingFlowGateway:class{async loadProgress(){return{kind:'missing'};}async loadChapter(s,n){return{sourceId:s.identity.sourceId,bookId:s.identity.bookId,chapterIndex:n,chapterUrl:s.entries.find(e=>e.index===n)?.url,content:'正文',contentVersion:'v',images:[]};}},
  ReaderCoreGateway:class{async loadShelfBook(){return canonicalShelf;}},ReadingOfflineGateway:class{async loadDirectoryProjection(s){return s.entries;}}});
 setRuntime(f.runtime);h.readingEntryHost=new reading(f.runtime);
 const Methods=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),[
  'openLocalBookDetail','openRemoteBookDetail','onReadingFailure','onSearchResultSelected','searchAcquisitionCandidate','remoteSeedForSearchBook',
  'openFullDirectory','loadRemoteDirectoryProjection','readingDetailForRemoteSeed','returnFromDetail','returnToSearch','returnToBookshelf',
  'currentReaderPresentationIdentity','consumeSystemFileOpen'],{...gatewayExports,...evidence,ReaderRuntimeOwner:Runtime,LOCAL_SOURCE_ID:'local',DOMAIN:0,
  hilog:{info(){},warn(){},error(){}},errorMessageOf:e=>e.message,ReadingEntryHost:reading,EMPTY_READABLE_ADMISSION:{generation:0,adding:false,cancelling:false,confirmation:'none'}});
 for(const [n,d] of Object.entries(Object.getOwnPropertyDescriptors(Methods.prototype)))if(n!=='constructor'&&typeof d.value==='function')h[n]=d.value;
 Object.assign(h,{route:'detail',readingOriginRoute:'detail',detailReturnRoute:'search',navigationGeneration:0,detailToc:[],readingEntryScopeId:-1,
  sourceSwitchVisible:false,sourceSwitchState:{kind:'discovering'},searchPublicationRevision:0,searchHost:{searchedSourceIds:()=>[],publication:{shelfAt:()=>[]}},
  bookshelfHost:{loadShelfBook:async()=>canonicalShelf},remoteCatalogRefreshAt:new Map(),directoryBookmarkMutationGeneration:0,offlineMutationGeneration:0,
  showReadingFailure(){assert.fail('must not trap body failures in a modal');},showIndexAlert(){assert.fail('unexpected modal');},
  sourceDisplayName:(id,name)=>name??id,hasDeclaredCoverUrl:()=>true,readingDetailForShelf:b=>({...b})});
 f.runtime.noteReadingPreparationIntent=()=>{};
 f.runtime.request=async(m,p,o)=>{
  if(m==='bookmark.list')return{data:{bookmarks:[]}};
  if(m==='reading.progress.get'){
   f.calls.push([m,p,o]);
   if(options.progressFailure)throw options.progressFailure;
   if(options.progressMissing)return{data:{found:false,progress:null,progressRevision:'r1'}};
   return{data:{found:true,progressRevision:'r1',progress:{sourceId:p.sourceId,bookId:p.bookId,chapterIndex:options.progressIndex??11,chapterOffset:52,chapterProgress:0,updatedAt:1}}};
  }
  if(m==='bookshelf.get'&&options.shelfOverride)return{data:{book:canonicalShelf??null}};
  return requests(m,p,o);
 };
 const acquire=f.runtime.bookAcquisitions;f.runtime.bookAcquisitions=()=>({...acquire(),readingProjectionRevision:()=>0,setPreparationVisible(){},endSearch(){}});
 const open=async()=>{h.openDetailSourceSwitch();await settle();assert.equal(h.sourceSwitchState.kind,'candidates');};
 const pick=async()=>{await open();h.onPickSource(f.candidate(),h.sourceSwitchScopeId);await settle();};
 const bind=()=>{h.sourceSwitchHost=f.host;f.host.context=h.sourceSwitchContext();f.host.lease=h.sourceSwitchLease(f.host);};
 return{...f,...x,h,open,pick,bind,options};
}
async function check(name,run){let timer;try{await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('journey did not settle')),2000);})]);checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',error:e.message});}finally{clearTimeout(timer);}}
for(const sourceId of ['local','online'])await check('network-free-reading-route-'+sourceId,async()=>{
 const t=fixture(),h=t.h;h.detailBook={...book,sourceId};h.openReading(undefined);
 assert.equal(h.route,'reading');assert.equal(h.readingSessionActive,true);assert.equal(h.remoteReadingSession,undefined);assert.deepEqual(h.detailToc,[]);
 const n=h.navigationGeneration;h.openReading(999);assert.equal(h.navigationGeneration,n);
});
await check('shelf-immediate-local-and-remote-owner-admission',async()=>{
 const t=fixture(),h=t.h;h.route='bookshelf';h.readingOriginRoute='bookshelf';h.openRemoteBookDetail({...book,detailUrl:book.bookId},'Old',book,true);
 assert.equal(h.route,'reading');assert.equal(h.remoteReadingSeed.detailUrl,book.bookId);assert.equal(h.detailInBookshelf,true);
 assert.equal(h.remoteReadingSession,undefined,'first route does not invent a prepared session');
 const l=fixture().h;l.route='bookshelf';l.readingOriginRoute='bookshelf';const before=localConstructions;l.openLocalBookDetail({...book,sourceId:'local'},true);
 assert.equal(localConstructions,before,'first shelf route does not await TOC');assert.equal(l.route,'reading');assert.equal(l.readingSessionActive,true);
});
await check('body-failure-and-late-session-stay-on-original-reader',async()=>{
 const t=fixture(),h=t.h;h.openReading(undefined);h.onRemoteSessionReady(session);assert.equal(h.remoteReadingSession,undefined);
 const current={...session,identity:{sourceId:book.sourceId,bookId:book.bookId}};h.onRemoteSessionReady(current);assert.equal(h.remoteReadingSession,current);assert.equal(h.detailToc[0].index,17);
 const pending={transactionId:'pending'};h.pendingSourceSwitch=pending;h.onReadingFailure(book.sourceId,book.bookId,'正文处理设置已改变','POSITION_CONFLICT');
 assert.equal(h.route,'reading');assert.equal(h.pendingSourceSwitch,pending);assert.equal(h.detailLoadingMessage,'正文处理设置已改变');
 h.onReadingFailure('other','other','stale');assert.equal(h.detailLoadingMessage,'正文处理设置已改变');
});
await check('empty-independent-directory-route',async()=>{const h=fixture().h;h.openFullDirectory();assert.equal(h.route,'directory');assert.equal(h.readingSessionActive,false);assert.equal(h.directoryReturnTarget,'detail');});
for(const toc of [[],[{index:2,title:'可见章节',navigable:true}]])await check('durable-anchor-with-paged-or-empty-toc-'+toc.length,async()=>{
 const t=fixture();t.h.detailToc=toc;t.h.shelfBooks=[];await t.pick();const p=t.calls.find(([m])=>m==='source.switch.commit')[1];
 assert.equal(p.from.sourceId,book.sourceId);assert.equal(p.currentChapterIndex,11);assert.equal(p.currentChapterTitle,'');
 assert.equal(t.h.remoteReadingSession.entries,session.entries);assert.equal(t.h.requestedChapterIndex,17);
});
await check('missing-and-invalid-anchor-refused-by-original-owner',async()=>{
 const t=fixture();t.bind();assert.throws(()=>t.host.resolveAnchor({kind:'missing'}),/没有可核对/);assert.throws(()=>t.host.resolveAnchor({kind:'restored',progress:{chapterIndex:-1}}),/没有可核对/);
});
const oldPending=()=>({fromSourceId:'original-source',fromBookId:'original-book',targetSourceId:book.sourceId,targetBookId:book.bookId,targetChapterIndex:11,transactionId:'pending-1'});
const originalBook={...book,sourceId:'original-source',bookId:'original-book',currentChapterIndex:11,currentChapterTitle:'第十一章'};
await check('startup-original-pending-selection-does-not-compensate',async()=>{
 const t=fixture(),h=t.h;h.readingSessionActive=true;h.route='reading';let reads=0;
 t.host.gateway.listPendingSwitches=async()=>{reads++;return[oldPending(),{...oldPending(),transactionId:'unrelated',targetSourceId:'another'}];};
 t.host.gateway.rollbackSwitch=async()=>assert.fail('startup cannot undo source');await h.reconcilePendingSourceSwitches();assert.equal(h.pendingSourceSwitch,undefined);
 assert.equal(await h.resolveReaderSourceSwitchTransaction(book.sourceId,book.bookId),'pending-1');assert.equal(h.pendingSourceSwitch.targetChapterIndex,-1);
 assert.equal(await h.resolveReaderSourceSwitchTransaction(book.sourceId,book.bookId),'pending-1');assert.equal(reads,2);assert.equal(await h.resolveReaderSourceSwitchTransaction('stale','stale'),undefined);
});
await check('pending-choice-restores-original-before-next-acquisition',async()=>{
 const t=fixture(),h=t.h,calls=[];
 t.host.gateway.listPendingSwitches=async()=>[oldPending()];
 t.host.gateway.rollbackSwitch=async(id,_current,e)=>{calls.push('rollback');assert.equal(id,'pending-1');e.dispatched();e.confirmed();return{restoredBook:originalBook};};
 const fetch=t.host.gateway.fetchTargetToc.bind(t.host.gateway);t.host.gateway.fetchTargetToc=async(...args)=>{calls.push('fetch');return fetch(...args);};
 const native=t.runtime.request.bind(t.runtime);t.runtime.request=async(m,p,o)=>{if(m==='source.switch.commit'){calls.push('commit');assert.equal(p.from.sourceId,originalBook.sourceId);assert.equal(p.currentChapterIndex,11);}return native(m,p,o);};
 await t.pick();assert.deepEqual(calls,['rollback','fetch','commit'],JSON.stringify(t.host.current()));assert.equal(h.route,'reading');assert.equal(h.remoteReadingSession.entries,session.entries);
 assert.equal(t.host.current().pending.fromSourceId,originalBook.sourceId);assert.notEqual(t.host.current().pending.transactionId,'pending-1');
});
await check('late-compensation-cannot-replace-successor-book',async()=>{
 const t=fixture(),gate=deferred();t.bind();t.host.snapshot={...t.host.snapshot,pending:oldPending()};t.host.gateway.rollbackSwitch=()=>gate.promise;
 const p=t.host.prepareNextChoice(t.host.generation);t.h.navigationGeneration++;const newer={...book,bookId:'newer'};t.h.detailBook=newer;gate.resolve({restoredBook:originalBook});
 await assert.rejects(p,/aborted/);assert.equal(t.h.detailBook,newer);assert.equal(t.host.current().pending.transactionId,'pending-1');
});
for(const mode of ['finalized','generic-error','still-pending','missing-target','list-failed'])await check('uncertain-compensation-'+mode,async()=>{
 const t=fixture();t.bind();t.host.snapshot={...t.host.snapshot,pending:oldPending()};canonicalShelf=mode==='missing-target'?undefined:{...book};
 const error=new ReaderCoreRequestError({error:{code:'INVALID_PARAMS',message:'finalized',details:{reason:'already_finalized',transactionId:'pending-1'}}});
 t.host.gateway.rollbackSwitch=async()=>{throw mode==='generic-error'?Error('already_finalized'):error;};
 t.host.gateway.listPendingSwitches=async()=>{if(mode==='list-failed')throw Error('list failure');return mode==='still-pending'?[oldPending()]:[];};
 t.host.shelf.loadShelfBook=async()=>canonicalShelf;
 if(mode==='finalized'){assert.equal((await t.host.prepareNextChoice(t.host.generation)).sourceId,book.sourceId);assert.equal(t.host.current().pending,undefined);assert.equal(t.h.route,'reading');}
 else{await assert.rejects(t.host.prepareNextChoice(t.host.generation));assert.equal(t.host.current().pending.transactionId,'pending-1');}
});
await check('exact-target-session-and-body-failure-keep-durable-transaction',async()=>{
 const t=fixture();t.h.detailToc=[{index:11,title:'第十一章',navigable:true}];await t.pick();
 const commits=t.calls.filter(([m])=>m==='source.switch.commit');assert.equal(commits.length,1);assert.equal(commits[0][1].currentChapterIndex,11);assert.equal(commits[0][1].currentChapterTitle,'第十一章');
 assert.equal(t.calls.filter(([m])=>m==='reading.progress.get').length,1);
 assert.equal(t.h.remoteReadingSession.entries,session.entries);assert.equal(t.h.route,'reading');const tx=t.h.pendingSourceSwitch.transactionId;
 t.h.onReadingFailure(target.sourceId,target.bookId,'解析失败','SOURCE_CONTENT_EMPTY');assert.equal(t.h.pendingSourceSwitch.transactionId,tx);assert.equal(t.h.route,'reading');
});
await check('failed-target-acquisition-retry-is-scoped',async()=>{
 const t=fixture({failAcquire:true});await t.pick();assert.equal(t.h.route,'reading');assert.equal(t.h.detailBook.sourceId,book.sourceId);assert.equal(t.h.sourceSwitchVisible,false);
 assert.equal(t.calls.filter(([m])=>m==='source.switch.commit').length,0);const before=t.calls.filter(([m])=>m==='acquire').length;t.h.retryFailedSourceSwitch(t.h.sourceSwitchScopeId);await settle();
 assert.equal(t.calls.filter(([m])=>m==='acquire').length,before+1);t.h.detailBook={...book,bookId:'different'};t.h.retryFailedSourceSwitch(t.h.sourceSwitchScopeId);await settle();assert.equal(t.calls.filter(([m])=>m==='acquire').length,before+1);
});
await check('canonical-book-retains-target-body-and-requires-exact-finalization',async()=>{
 const t=fixture();t.h.readingSessionActive=true;const stale={...session,book:{title:'旧别名',author:'旧作者'},contextVersion:'ctx',catalogVersion:'catalog',continuationVariables:[{name:'token',value:'kept'}]};
 const canonical={...book,...session.identity,title:'Core规范书名',author:'Core规范作者'};t.h.performSourceSwitchSeam(canonical,stale,17);
 assert.equal(t.h.detailBook.title,canonical.title);assert.equal(t.h.detailBook.author,canonical.author);assert.equal(t.h.remoteReadingSession.entries,stale.entries);assert.equal(t.h.remoteReadingSession.continuationVariables,stale.continuationVariables);assert.equal(t.h.remoteReadingSession.contextVersion,'ctx');assert.equal(stale.book.title,'旧别名');
 // The earlier identity-only finalization expectation was unsafe: an exact
 // source transaction is now required. Prove both rejection and the real ACK.
 const n=fixture();await n.pick();const tx=n.host.current().pending.transactionId;n.h.remoteReadingSession=undefined;n.h.applyReadingCommit({...target,chapterIndex:22,chapterOffset:61});assert.equal(n.host.current().pending.transactionId,tx);
 n.setPhase('finalized');n.h.applyReadingCommit({...target,chapterIndex:22,chapterOffset:61,sourceSwitchTransactionId:tx});await settle();assert.equal(n.host.current().pending,undefined);assert.equal(n.h.cleanup.length,1);
});
for(const mode of ['toc-title','no-title','other-error','missing-index','stale'])await check('coarse-anchor-fallback-'+mode,async()=>{
 const failure=new RemoteReadingGatewayError(mode==='other-error'?'commandFailed':'positionContextStale','precise position unavailable');
 const t=fixture({progressFailure:failure,shelfOverride:true});canonicalShelf={...book,currentChapterIndex:mode==='missing-index'?undefined:11,currentChapterTitle:'可能错位的书架标题'};
 t.h.detailToc=mode==='toc-title'?[{index:11,title:'真实第十一章'}]:[];await t.open();t.h.onPickSource(t.candidate(),t.h.sourceSwitchScopeId);if(mode==='stale')t.h.navigationGeneration++;await settle();
 const commits=t.calls.filter(([m])=>m==='source.switch.commit');assert.equal(commits.length,mode==='toc-title'||mode==='no-title'?1:0);
 if(commits.length){assert.equal(commits[0][1].currentChapterIndex,11);assert.equal(commits[0][1].currentChapterTitle,mode==='toc-title'?'真实第十一章':'');}
 if(mode==='other-error'||mode==='missing-index')assert.equal(t.h.sourceSwitchFailureMessage,'precise position unavailable');
});
await check('reader-identity-retained-across-appearance',async()=>{
 const Shell=productionMotionMethods(new URL('../entry/src/main/ets/features/shell/ReaderShell.ets',import.meta.url),['readingIdentityKey']);
 const s=Object.assign(new Shell(),{sourceId:'source',bookId:'book',fontSize:18}),key=s.readingIdentityKey();s.fontSize=24;assert.equal(s.readingIdentityKey(),key);s.sourceId='another';assert.notEqual(s.readingIdentityKey(),key);assert.match(read('features/shell/ReaderShell.ets'),/ForEach\(\[this\.readingIdentityKey\(\)\]/);
});
await check('local-sparse-search-membership-loads-real-owner-record',async()=>{
 const t=fixture(),h=t.h;h.route='search';h.shelfBooks=[];const result={sourceId:'local',sourceName:'本地',bookId:'import-real-id',title:'真实搜索书名',author:'作者',kind:'epub'};
 canonicalShelf={...result,addedAt:10,intro:'完整本地简介'};h.onSearchResultSelected(result);assert.equal(h.route,'search');await settle();assert.equal(h.route,'detail');assert.equal(h.detailBook.bookId,result.bookId);assert.equal(h.detailBook.title,result.title);assert.equal(h.detailInBookshelf,true);assert.equal(h.detailBook.intro,'完整本地简介');assert.equal(h.detailReturnRoute,'search');assert.equal(h.remoteReadingSeed,undefined);await settle();assert.equal(h.detailToc[0].title,'本地第一章');h.openReading(undefined);assert.equal(h.route,'reading');
});
await check('directory-honest-empty-error-copy',async()=>{
 const Directory=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/FullDirectoryPanel.ets',import.meta.url),['catalogEmptyMessage']),d=Object.assign(new Directory(),{entries:[],catalogMessage:'目录解析失败'});
 assert.equal(d.catalogEmptyMessage(),'目录解析失败');d.catalogMessage='';assert.match(d.catalogEmptyMessage(),/暂无可用章节/);d.entries=[{index:3,title:'已有章'}];assert.equal(d.catalogEmptyMessage(),'没有匹配的章节');assert.match(read('features/reading/ReaderFullDirectory.ets'),/catalogMessage: this\.catalogMessage/);assert.match(read('pages/Index.ets'),/private externalDirectory\([\s\S]*catalogMessage: this\.detailLoadingMessage/);
});
console.log(JSON.stringify({checks,evidenceLayer:'actual SDK Index methods and whole original ReadingEntry/SourceSwitch owners; controlled gateway/OS seams, no device acceptance'}));

assert.equal(checks.filter(c=>c.status==='FAIL').length,0,'original direct-entry recovery journeys must pass');

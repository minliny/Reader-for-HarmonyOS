import { installContentSearchOwnerProbe } from './lib/reader-content-search-owner-probe.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;
}}});
const { ReadingSessionFlowGateway }=await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { RemoteReadingGatewayError, isRemoteReadingCacheFallbackEligible }=
  await import('../entry/src/main/ets/features/reading/RemoteReadingContract.ts');
const { remoteReadingFailureKindOf }=await import('../entry/src/main/ets/features/reading/RemoteContentAdmission.ts');
const replaceState=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const replaceQuick=await import('../entry/src/main/ets/features/reading/ReaderReplaceQuickState.ts');
const {ReaderControlReplaceGatewayError}=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGateway.ts');
const failure=(reason,code='INVALID_PARAMS')=>Object.assign(new Error(reason==='CONTENT_SEARCH_STALE'
  ? 'Cached content or processing settings changed during search; retry the search'
  : 'text processing settings changed; original reading positions were preserved; restore the previous Chinese conversion or text replacement settings and retry'),
  {event:{requestId:42,error:{code,details:{reason,retryable:true}}}});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(local=false){
  const sourceId=local?'local':'source',bookId='book',requests=[];
  let respond=async()=>({data:{results:[],hasMore:false}});
  const runtime={request:async(method,params,options)=>{requests.push({method,params,options});return respond(method,params,options);}};
  const gateway=new ReadingSessionFlowGateway(sourceId,bookId,local?{kind:'local'}:
    {kind:'remote',session:{identity:{sourceId,bookId},book:{title:'书'},entries:[],acquisitionMode:'cache'}},runtime);
  return{gateway,requests,sourceId,bookId,setResponse:value=>{respond=value;}};
}
for(const local of [false,true])for(const reason of ['PROCESSING_CONTEXT_STALE','POSITION_CONTEXT_STALE','CONTENT_SEARCH_STALE']){
  const f=fixture(local),original=failure(reason);let current=true;
  f.setResponse(async()=>{throw original;});
  let observed;
  await assert.rejects(f.gateway.searchContentPage(f.bookId,'关键词',50,50,()=>current),error=>{
    observed=error;assert.ok(error instanceof RemoteReadingGatewayError);
    assert.equal(error.code,'positionContextStale');assert.equal(error.command,'search.content');
    assert.equal(error.causeValue,original);assert.equal(error.causeValue.event.error.details.reason,reason);
    assert.equal(error.causeValue.event.error.details.retryable,true);
    assert.equal(remoteReadingFailureKindOf(error),'POSITION_CONTEXT_STALE');
    assert.equal(isRemoteReadingCacheFallbackEligible(error),false);
    assert.doesNotMatch(error.message,/text processing settings changed|Cached content or processing settings changed/);
    if(reason==='CONTENT_SEARCH_STALE')assert.equal(error.message,'搜索期间正文或处理状态已更新，请重新搜索。');
    else assert.match(error.message,/原位置|原阅读位置/);
    return true;
  });
  assert.equal(f.requests.length,1,'failure cannot trigger an automatic body or network request');
  assert.equal(f.requests[0].method,'search.content');assert.equal(f.requests[0].params.offset,50);
  assert.equal(f.requests[0].options.shouldCancel(),false);current=false;assert.equal(f.requests[0].options.shouldCancel(),true);
  f.setResponse(async()=>{throw observed;});
  await assert.rejects(f.gateway.searchContentPage(f.bookId,'关键词',50),error=>error===observed,'already classified errors retain their identity');
}
// An explicit cancellation beats a stale reason retained inside the Core envelope.
{
  const f=fixture(),original=failure('PROCESSING_CONTEXT_STALE','CANCELLED');
  f.setResponse(async()=>{throw original;});
  await assert.rejects(f.gateway.searchContentPage(f.bookId,'关键词',50),error=>{
    assert.equal(error.code,'cancelled');assert.equal(error.category,'CANCELLED');assert.equal(error.causeValue,original);
    assert.equal(isRemoteReadingCacheFallbackEligible(error),false);return true;
  });
}
const Reader=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),
  ['runQuickSearch','loadMoreQuickSearch','updateQuickSearchQuery','publishQuickSearchState'],{READER_CONTENT_SEARCH_PAGE_SIZE:50});
function reader(f){
  const publications=[];
  const owner=Object.assign(new Reader(),{sourceId:f.sourceId,bookId:f.bookId,lifecycleToken:1,searchGeneration:0,
    quickSearchQuery:'关键词',quickSearchState:{kind:'idle'},quickSearchRevision:0,
    quickSearchPublication:{publish:state=>publications.push(state)},sessionGateway:f.gateway,
    activeGateway:()=>f.gateway,controlVisible:()=>true,controlPage:()=> 'fullSearch',isSessionActive:()=>true});
  installContentSearchOwnerProbe(owner, publications, f.gateway);
  return{owner,publications};
}
const match=(f,index)=>({sourceId:f.sourceId,bookId:f.bookId,bookName:'书',chapterIndex:index,chapterOffset:3,
  matchLength:3,snippetStart:0,chapterTitle:`第${index}章`,snippet:'包含关键词的正文'});
for(const reason of ['PROCESSING_CONTEXT_STALE','CONTENT_SEARCH_STALE']){
  // The actual first-page catch receives the classified message; manual retry owns the next request.
  const f=fixture(),{owner,publications}=reader(f);
  f.setResponse(async()=>{throw failure(reason);});owner.runQuickSearch();await settle();
  assert.equal(owner.quickSearchState.kind,'error');assert.match(owner.quickSearchState.message,/重试|重新搜索/);
  assert.doesNotMatch(owner.quickSearchState.message,/text processing settings changed|Cached content/);
  assert.equal(f.requests.length,1);assert.deepEqual(publications.map(value=>value.kind),['loading','error']);
  f.setResponse(async()=>({data:{results:[match(f,0)],hasMore:true}}));owner.runQuickSearch();await settle();
  assert.equal(owner.quickSearchState.kind,'results');assert.equal(owner.quickSearchState.results.length,1);
  assert.equal(f.requests.length,2);assert.equal('offset' in f.requests[1].params,false);
  // More failures retain every already visible match and retry the same bounded offset.
  const oldResults=owner.quickSearchState.results;f.setResponse(async()=>{throw failure(reason);});
  owner.loadMoreQuickSearch();await settle();
  assert.equal(owner.quickSearchState.kind,'results');assert.equal(owner.quickSearchState.results,oldResults);
  assert.equal(owner.quickSearchState.loadingMore,false);assert.match(owner.quickSearchState.loadMoreError,/重试|重新搜索/);
  assert.equal(f.requests.at(-1).params.offset,1);
  const count=f.requests.length; owner.loadMoreQuickSearch(); await settle();
  assert.equal(f.requests.length,count,'stale results cannot resume into a new snapshot');
  f.setResponse(async()=>({data:{results:[match(f,0),match(f,1)],hasMore:false}}));owner.runQuickSearch();await settle();
  assert.equal('offset' in f.requests.at(-1).params,false);assert.equal(owner.quickSearchState.results.length,2);
  assert.equal(owner.quickSearchState.hasMore,false);assert.equal(owner.quickSearchState.loadMoreError,undefined);
}
for(const more of [false,true])for(const code of ['INVALID_PARAMS','CANCELLED']){
  const f=fixture(),{owner,publications}=reader(f),late=deferred();
  if(more)owner.quickSearchState={kind:'results',keyword:'关键词',results:[match(f,0)],offset:1,hasMore:true,loadingMore:false};
  f.setResponse(()=>late.promise);if(more)owner.loadMoreQuickSearch();else owner.runQuickSearch();
  assert.equal(f.requests[0].options.shouldCancel(),false);
  owner.updateQuickSearchQuery('新关键词');const count=publications.length;
  assert.equal(f.requests[0].options.shouldCancel(),true);
  late.reject(failure('CONTENT_SEARCH_STALE',code));await settle();
  assert.deepEqual(owner.quickSearchState,{kind:'idle'});assert.equal(publications.length,count,'an obsolete error/cancel cannot publish into a new query');
}
// Successful processing changes invalidate same-control-session results even
// when body reloading must wait for an in-flight page settlement.
const processingMethods=['changeChineseConversionMode','reloadCurrentPageAfterReplacePersist',
  'runControlReplaceMutation','beginReplaceMutation','isReplaceMutationCurrent','finishReplaceMutation'];
const Processing=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),
  processingMethods,{...replaceState,...replaceQuick,ReaderControlReplaceGatewayError});
function processingFixture(settling=false){
  const f=fixture(),r=reader(f),owner=r.owner,reloads=[];
  for(const name of processingMethods)owner[name]=Processing.prototype[name];
  const loading=replaceState.beginReaderControlReplaceLoad(replaceState.createReaderControlReplaceState('source:book:1'));
  const rules=replaceState.admitReaderControlReplaceLoad(loading,replaceState.readerControlReplaceTicket(loading),[]);
  Object.assign(owner,{mounted:true,exitRequested:false,chineseConversionMode:'none',chineseConversionMutationGeneration:0,
    phase:'ready',pageTurnSettlementActive:settling,contentMetrics:{},knownContentVersions:[1],
    chapterWindow:{clear:()=>reloads.push('window')},paginationIndex:{invalidateBook:()=>reloads.push('pagination')},
    invalidatePageTurnRuntime:()=>reloads.push('turn'),resetPaginationDraft:()=>reloads.push('draft'),
    isSessionActive(token){return this.mounted&&!this.exitRequested&&token===this.lifecycleToken;},
    controlReplaceState:rules,replacePanelGeneration:0,
    replaceMutationGeneration:0,replaceMutationActiveGeneration:-1,
    replaceMutationActiveLifecycleToken:-1,replaceMutationActiveBookId:'',replaceMutationActiveRuleId:-1,
    controlReplaceCurrent:()=>true,errorMessage:error=>error.message,
    persistBeforeContentMutation:async()=>()=>true,
    quickSearchState:{kind:'results',keyword:'关键词',results:[match(f,0)],offset:1,hasMore:true,loadingMore:false}});
  return{...f,...r,reloads};
}
for(const outcome of ['success','failure','stale-generation','unmounted']){
  const f=processingFixture(),write=deferred(),prior=f.owner.quickSearchState;
  f.owner.chineseConversionGateway={putMode:()=>write.promise};f.owner.changeChineseConversionMode('t2s');await Promise.resolve();
  assert.equal(f.owner.quickSearchState,prior,'an unacknowledged conversion must retain current search results');
  if(outcome==='stale-generation')f.owner.chineseConversionMutationGeneration++;
  if(outcome==='unmounted')f.owner.mounted=false;
  if(outcome==='failure')write.reject(Error('save failed'));else write.resolve('t2s');await settle();
  assert.equal(f.owner.searchGeneration,outcome==='success'?1:0);
  assert.deepEqual(f.owner.quickSearchState,outcome==='success'?{kind:'idle'}:prior);
  assert.equal(f.owner.quickSearchQuery,'关键词','successful conversion keeps the query for a fresh search');
}
for(const settling of [false,true])for(const outcome of ['success','unchanged','failure','stale-book','unmounted']){
  const f=processingFixture(settling),write=deferred(),prior=f.owner.quickSearchState;
  const save=f.owner.runControlReplaceMutation(4,()=>write.promise);await Promise.resolve();
  assert.equal(f.owner.quickSearchState,prior,'a pending rule write cannot clear results');
  if(outcome==='stale-book')f.owner.bookId='other';
  if(outcome==='unmounted')f.owner.mounted=false;
  if(outcome==='failure'){write.reject(Error('save failed'));await assert.rejects(save,/save failed/);}
  else{write.resolve({changed:outcome!=='unchanged',needsReload:false});await save;}
  const changed=outcome==='success';assert.equal(f.owner.searchGeneration,changed?1:0);
  assert.deepEqual(f.owner.quickSearchState,changed?{kind:'idle'}:prior);
  assert.equal(f.owner.quickSearchQuery,'关键词');
  if(changed&&settling){assert.equal(f.owner.pageTurnPendingReplaceReload,true);assert.deepEqual(f.reloads,[]);}
  if(!changed)assert.deepEqual(f.reloads,[],'failed/obsolete/unchanged rule writes retain the current projection');
}
for(const processing of ['conversion','replacement']){
  const f=processingFixture(true),late=deferred();f.setResponse(()=>late.promise);
  f.owner.loadMoreQuickSearch();assert.equal(f.requests.length,1);
  if(processing==='conversion'){
    f.owner.chineseConversionGateway={putMode:async()=> 't2s'};
    f.owner.changeChineseConversionMode('t2s');await settle();
  }else await f.owner.runControlReplaceMutation(4,async()=>({changed:true,needsReload:false}));
  assert.deepEqual(f.owner.quickSearchState,{kind:'idle'});
  assert.equal(f.requests[0].options.shouldCancel(),true,'successful processing change revokes the old search page');
  late.resolve({data:{results:[match(f,1)],hasMore:true}});await settle();
  assert.deepEqual(f.owner.quickSearchState,{kind:'idle'},'a late page cannot reattach old rows to a new processing context');
  f.owner.loadMoreQuickSearch();assert.equal(f.requests.length,1,'idle cannot fetch another page with the old offset');
  const fresh={...match(f,3),positionScope:{sourceId:f.sourceId,bookId:f.bookId,chapterIndex:3,bodyVersion:'body-new',processingVersion:'processing-new'}};
  f.setResponse(async()=>({data:{results:[fresh],hasMore:false}}));f.owner.runQuickSearch();await settle();
  assert.equal('offset' in f.requests.at(-1).params,false);
  assert.deepEqual(f.owner.quickSearchState.results.map(value=>value.chapterIndex),[3]);
  assert.equal(f.owner.quickSearchState.results[0].positionScope.processingVersion,'processing-new');
}
// Wrong-owner reloads do nothing; an eventual valid drain can clear already
// empty results again without restoring rows or losing the query.
{
  const f=processingFixture(true),prior=f.owner.quickSearchState;
  f.owner.reloadCurrentPageAfterReplacePersist(0,f.bookId);f.owner.reloadCurrentPageAfterReplacePersist(1,'other');
  assert.equal(f.owner.quickSearchState,prior);assert.equal(f.owner.searchGeneration,0);
  f.owner.reloadCurrentPageAfterReplacePersist(1,f.bookId);assert.deepEqual(f.owner.quickSearchState,{kind:'idle'});
  f.owner.pageTurnSettlementActive=false;f.owner.reloadCurrentPageAfterReplacePersist(1,f.bookId);
  assert.deepEqual(f.owner.quickSearchState,{kind:'idle'});assert.equal(f.owner.quickSearchQuery,'关键词');
}
console.log('PH117 actual content-search Gateway/LRE typed errors, retry/cancel, and processing-ACK retained-row invalidation PASS');

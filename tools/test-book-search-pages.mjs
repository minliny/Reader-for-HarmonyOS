import {selectedProductionMethods,selectedProductionComponentCallback} from './lib/selected-production-methods.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import {BookSearchPageProgress,readBookSearchPageReceipt} from '../entry/src/main/ets/app/library/BookSearchPageProgress.ts';
import {gatewayTypes,searchTypes,switchTypes} from './lib/book-search-page-probe.mjs';
const digest=text=>createHash('sha256').update(text).digest('hex');
const source=id=>({sourceId:id,name:id,enabled:true,category:'novel',sourceVersion:digest(id),baseUrl:`https://${id}.test/`});
const row=(id,title='词')=>({bookId:id,title,author:'作者'});
const receipt=(s,page,books,extra={})=>({sourceId:s.sourceId,sourceVersion:s.sourceVersion,query:'词',requestedPage:page,
 state:books.length?'next':'end',...(books.length?{nextPage:page+1}:{}),requestFingerprint:digest(`${s.sourceId}/${page}`),
 responseFingerprint:digest(JSON.stringify(books)),candidateFingerprint:digest(JSON.stringify(books.map(b=>b.bookId))),...extra});
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(setImmediate);};
const defs={'unknown-zero':'Actual owner zero unknown stays unresolved, safe page reason and current task recovery retries the exact source page',
 'unknown-retained':'Actual owner retains results across unknown; task action binds query/generation and retries the unfinished page without repeating exhausted sources','continuation-stop':'Actual SearchPage surface keeps initial loading separate while its existing action stops the current continuation owner',assembly:'Actual SearchPage demand and LibrarySearchResults→SearchHost callback dispatch only for the current visible query',receipt:'Receipt identity/version/order/no-progress and legacy unknown remain separate from failed page',
 gateway:'Real Gateway transmits negotiated exact page/version and validates receipts without guessing from array length',
 orchestrator:'Real query owner fair round demand, page2, dedup/order, same-page failure retry and stop/late guards',
 switch:'Real source-switch worker/decoder finds page2 target, advances fairly and stops duplicate-response source as incomplete'};
for(const id of selectContractCases(defs)){
 if(id==='unknown-zero'||id==='unknown-retained'){
  const retained=id==='unknown-retained',sources=[source('a'),source('ended')],calls=[],emitted=[];
  let recovered=false,visible=true;
  const runtime={supportsCoreCapability:()=>true,async request(method,p,options){options?.onDispatch?.();
   if(method==='source.list')return{data:{sources}};
   if(method!=='book.search')return{data:{}};
   calls.push([p.sourceId,p.page]);const s=sources.find(s=>s.sourceId===p.sourceId);
   const unknown=s.sourceId==='a'&&!recovered&&(!retained||p.page===2);
   const books=s.sourceId==='ended'||unknown?[]:[row(`a:${p.page}`)];
   return{data:{sourceId:s.sourceId,sourceVersion:s.sourceVersion,books,contentKind:'text',
    pageReceipt:receipt(s,p.page,books,unknown?{state:'unknown',reason:'urlGuard'}:{})}};
  }};
  const o=new searchTypes.SearchOrchestrator(p=>emitted.push(p),()=>{},()=>true,runtime),run=new searchTypes.SearchQueryRun('词','q');
  Object.assign(o,{run,sessionOpen:true,work:1,session:1,sources,sweepAlive:true});run.localStatus='done';run.historyWritten=true;
  o.present=p=>{o.presentation=p;emitted.push(p);};
  await o.performSearch(1,1,run,false,true);
  if(retained){o.needMoreResults();await settle();}
  const before=run.results().slice(),incomplete=o.presentation;
  assert.equal(incomplete.kind,retained?'results':'error');
  assert.equal(incomplete.operation.fact,'partial');assert.equal(incomplete.operation.hasValue,retained);
  assert.equal(incomplete.incompleteSourceCount,1);assert.deepEqual(incomplete.incompleteSources,[{
   sourceId:'a',sourceVersion:sources[0].sourceVersion,requestedPage:retained?2:1,reason:'urlGuard'}]);
  assert.equal(incomplete.operation.canRetry,true);assert.equal(run.progress(sources[0]).page,retained?2:1);
  o.entryHistory=['词'];o.historyStatus='ready';o.presentEntryHistory(['另一本']);
  assert.deepEqual(o.presentation.incompleteSources,incomplete.incompleteSources,'history cannot erase unresolved facts');
  const file=path=>new URL('../entry/src/main/ets/'+path,import.meta.url);
  const Page=selectedProductionMethods(file('features/search/ui/SearchPage.ets'),'SearchPage',[
   'captureSearchNoticeFacts','displayedSearchNoticeFacts','acceptResultNoticeFacts','searchProgressText','searchStopped','isSweeping','hasActiveSearchRequest',
   'hasIncompleteSearch','incompleteSearchMessage','partialSearchFailure','searchFailureTitle','searchFailureMessage','hasAnySearchNotice',
   'hasDisplayedSearchNotice','hasSearchNotice','searchNoticeActionEnabled','searchNoticeRetryKind','searchNoticeOffersRetry',
   'searchNoticeActionKey','hasSearchNoticeRetry','retryTaskStatus','retryOperation','operation','searchStatusColor','searchStatusLabel'],
   {readerAppColor:key=>`COLOR:${key}`});
  let dispatches=0;
  const page=Object.assign(new Page(),{presentation:o.presentation,viewState:{revision:3},pageEpoch:'page',
   pageInputCurrent:()=>visible,acceptsTaskStatus:identity=>visible&&identity==='task',onCardDisplayFactsChange(){},onRetry(){dispatches++;o.retry();}});
  if(retained){
   page.presentation={...o.presentation,incompleteSourceCount:0,incompleteSources:[],operation:{...o.presentation.operation,canRetry:false}};
   page.acceptResultNoticeFacts();assert.equal(page.displayedSearchNoticeFacts().partial,false);
   page.presentation=o.presentation;page.acceptResultNoticeFacts();
   assert.equal(page.displayedSearchNoticeFacts().partial,true,'normal retained-list notice admission picks up unknown');
  }
  const facts=page.captureSearchNoticeFacts();assert.equal(facts.partial,true);assert.match(facts.partialText,/尚未执行/);
  assert.equal(page.searchStatusLabel(),'结果未确认');assert.equal(page.searchStatusColor(),'COLOR:app.search.partialStatus');
  if(!retained){assert.equal(page.searchFailureTitle(),'搜索结果未确认');assert.match(page.searchFailureMessage(),/可重试/);}
  assert.equal(page.searchNoticeRetryKind(),'partial');assert.equal(page.hasSearchNoticeRetry(),true);
  // The actual normal assembly forwards the task event to the current page;
  // the task's captured native callback checks both opening and retry key.
  const onRetry=selectedProductionComponentCallback(file('features/search/ui/SearchPage.ets'),'ReaderSearchTaskPanel','onRetry',page);
  const Task=selectedProductionMethods(file('features/search/ui/ReaderSearchTaskPanel.ets'),'ReaderSearchTaskPanel',['accepts','retryAction']);
  const task=Object.assign(new Task(),{mounted:true,expanded:true,presentationIdentity:'task',canRetry:true,
   retryIdentity:page.searchNoticeActionKey('partial'),onRetry});
  const action=task.retryAction('task',task.retryIdentity);
  page.viewState.revision++;action();assert.equal(dispatches,0,'old query action rejected');page.viewState.revision--;
  page.presentation={...page.presentation,operation:{...page.presentation.operation,generation:2}};
  action();assert.equal(dispatches,0,'old operation generation rejected');page.presentation=o.presentation;
  visible=false;action();assert.equal(dispatches,0,'covered/retired host rejected');visible=true;
  recovered=true;action();await settle();assert.equal(dispatches,1);
  assert.equal(calls.filter(([s])=>s==='ended').length,1,'proven exhausted source is not repeated');
  assert.equal(calls.filter(([s,p])=>s==='a'&&p===(retained?2:1)).length,2,'same unresolved source page is retried');
  assert.equal(run.results().length,retained?2:1);assert.equal(o.presentation.kind,'results');
  for(const book of before)assert.equal(run.results().find(b=>b.bookId===book.bookId).admittedOrder,book.admittedOrder);
  assert.equal(o.presentation.incompleteSourceCount,0);
  o.close();
 }
 if(id==='continuation-stop'){
  const file=path=>new URL('../entry/src/main/ets/'+path,import.meta.url);
  const Page=selectedProductionMethods(file('features/search/ui/SearchPage.ets'),'SearchPage',
   ['bindSurface','publishSurface','isSweeping','hasActiveSearchRequest','canSubmit'],{nextSearchSurfaceOwner:0});
  let stops=0,submits=0,current=true;
  const model={claim(){},activate(){}};
  const o=Object.assign(new Page(),{surfaceModel:model,presentation:{kind:'results',searching:false,continuing:true,hasMoreSources:true},keyword:'词',
   surfaceInputCurrent:()=>current,searchPanelOwnsInput:()=>false,publishSurfacePanelInput(){},ownsSurface:()=>true,
   hasSearchSession:()=>true,searchProgressText:()=>'',onStop:()=>stops++,submitSearch:()=>submits++});
  o.bindSurface();assert.equal(o.isSweeping(),false,'no initial loading affordance for a later page');assert.equal(model.sweeping,true);
  model.onAction();assert.equal(stops,1);assert.equal(submits,0);assert.equal(o.presentation.searching,false);
  o.presentation.continuing=false;o.publishSurface();assert.equal(model.sweeping,false);model.onAction();assert.equal(submits,1);
  current=false;o.presentation.continuing=true;model.onAction();assert.equal(stops,1,'old covered input cannot stop a successor');
 }
 if(id==='assembly'){
  const file=path=>new URL('../entry/src/main/ets/'+path,import.meta.url);
  const Host=selectedProductionMethods(file('features/search/application/SearchHost.ets'),'SearchHost',['needMoreResults','getOrchestrator']);
  let demands=0,visible=true,current=true;
  const host=Object.assign(new Host(),{orchestrator:{needMoreResults(){demands++;}}});
  const Results=selectedProductionMethods(file('features/search/ui/LibrarySearchResults.ets'),'LibrarySearchResults',['inputCurrent']);
  const results=Object.assign(new Results(),{isCurrent:()=>current,isVisible:()=>visible,presentation:{host}});
  const callback=selectedProductionComponentCallback(file('features/search/ui/LibrarySearchResults.ets'),'SearchPage','onNeedMore',results);
  const Page=selectedProductionMethods(file('features/search/ui/SearchPage.ets'),'SearchPage',['moreResultsQueued','scheduleMoreResults']);
  const page=Object.assign(new Page(),{viewState:{revision:1},visibleStart:0,visibleEnd:1,visibleGroups:[{},{}],
   ownsPageQuery:()=>current,ownsList:()=>current,isPresentationVisible:()=>visible,presentation:{kind:'results',searching:false,hasMoreSources:true},onNeedMore:callback});
  page.scheduleMoreResults();page.scheduleMoreResults();await settle();assert.equal(demands,1);
  visible=false;page.scheduleMoreResults();await settle();assert.equal(demands,1);
  visible=true;page.scheduleMoreResults();page.viewState.revision++;await settle();assert.equal(demands,1);
  page.presentation.stopped=true;page.scheduleMoreResults();await settle();assert.equal(demands,1);
  page.presentation.stopped=false;page.visibleGroups=[];page.ownsList=()=>false;page.scheduleMoreResults();await settle();assert.equal(demands,2,'filter-empty/no native rows can demand later pages');
  current=false;callback();assert.equal(demands,2);
 }
 if(id==='receipt'){
  const s=source('a'),p=new BookSearchPageProgress(),first=receipt(s,1,[row('x')]);
  p.accept(readBookSearchPageReceipt(first,'a',s.sourceVersion,'词',1));assert.equal(p.page,2);assert.equal(p.state,'ready');
  p.accept({...first,requestedPage:2,nextPage:3});assert.equal(p.state,'unknown');assert.equal(p.page,2);
  for(const key of ['sourceId','sourceVersion','query','requestedPage'])assert.throws(()=>readBookSearchPageReceipt({...first,[key]:'wrong'},'a',s.sourceVersion,'词',1));
  const legacy=new BookSearchPageProgress();legacy.accept(undefined);assert.equal(legacy.state,'unknown');
  const noGrowth=new BookSearchPageProgress();noGrowth.accept(first,['x']);
  noGrowth.accept(receipt(s,2,[row('x','new metadata')]),['x']);assert.equal(noGrowth.state,'unknown');assert.equal(noGrowth.page,2);
  const empty=new BookSearchPageProgress();empty.accept(receipt(s,1,[]));assert.equal(empty.state,'end');
 }
 if(id==='gateway'){
  const s=source('a'),calls=[];let supported=true,wrong=false;
  const runtime={supportsCoreCapability:()=>supported,async request(method,params,options){calls.push({method,params});options?.onDispatch?.();
   if(method==='search-book.put')return{data:{}};
   const books=[row('p2')],r=receipt(s,params.page,books,wrong?{requestedPage:1}:{});
   return{data:{sourceId:s.sourceId,sourceVersion:s.sourceVersion,books,contentKind:'text',...(supported?{pageReceipt:r}:{})}};}};
  const gateway=new gatewayTypes.SearchGateway(runtime);
  let out=await gateway.searchBySource(s,'词',()=>true,'q',()=>true,2);assert.equal(out.ok,true);assert.equal(out.results[0].bookId,'p2');assert.equal(out.pageReceipt.requestedPage,2);
  assert.deepEqual(calls[0].params,{sourceId:'a',keyword:'词',page:2,pageReceipt:true,expectedSourceVersion:s.sourceVersion});
  wrong=true;assert.equal((await gateway.searchBySource(s,'词',()=>true,'q',()=>true,2)).ok,false);
  supported=false;out=await gateway.searchBySource(s,'词',()=>true,'q',()=>true,1);assert.equal(out.ok,true);assert.equal(out.pageReceipt,undefined);
 }
 if(id==='orchestrator'){
  const sources=[source('a'),source('b')],calls=[],emitted=[];let failPage2=true,pause,retired=false;
  const runtime={supportsCoreCapability:()=>true,async request(method,p,options){options?.onDispatch?.();if(method==='source.list')return{data:{sources}};
   if(method!=='book.search')return{data:{}};calls.push([p.sourceId,p.page]);const s=sources.find(s=>s.sourceId===p.sourceId);
   if(pause)await pause;if(options?.shouldCancel?.())throw Error('retired');if(p.sourceId==='a'&&p.page===2&&failPage2)throw Error('temporary');
   const books=p.page===1?[row(`${p.sourceId}:1`)]:p.page===2?[row(`${p.sourceId}:1`),row(`${p.sourceId}:2`)]:[];
   return{data:{sourceId:s.sourceId,sourceVersion:s.sourceVersion,books,contentKind:'text',pageReceipt:receipt(s,p.page,books)}};}};
  const o=new searchTypes.SearchOrchestrator(p=>emitted.push(p),()=>{},()=>!retired,runtime),run=new searchTypes.SearchQueryRun('词','q');
  Object.assign(o,{run,sessionOpen:true,work:1,session:1,sources,sweepAlive:true});run.localStatus='done';run.historyWritten=true;
  o.present=p=>{o.presentation=p;emitted.push(p);};
  await o.performSearch(1,1,run,false,true);assert.deepEqual(calls,[['a',1],['b',1]]);assert.equal(run.completed.size,2);assert.equal(run.results().length,2);
  const firstOrder=run.results().map(b=>[b.bookId,b.admittedOrder]);o.needMoreResults();o.needMoreResults();await settle();
  assert.equal(calls.filter(([s,p])=>s==='a'&&p===2).length,1);assert.equal(run.failures.size,1);assert.equal(run.results().some(b=>b.bookId==='b:2'),true);
  failPage2=false;await o.performSearch(o.work,o.session,run,false,true,true);
  assert.equal(calls.filter(([s,p])=>s==='a'&&p===2).length,2);assert.equal(calls.filter(([s,p])=>s==='b'&&p===1).length,1);
  assert.equal(run.results().length,4);for(const [book,rank] of firstOrder)assert.equal(run.results().find(b=>b.bookId===book).admittedOrder,rank);
  let release;pause=new Promise(r=>release=r);o.needMoreResults();await settle();assert.equal(emitted.at(-1).continuing,true);assert.equal(emitted.at(-1).searching,false);o.stop();const count=run.results().length;release();await settle();
  assert.equal(run.results().length,count);assert.equal(run.stopped,true);assert.equal(run.continuationRunning,false);
  o.close();
 }
 if(id==='switch'){
  const sources=[source('a'),source('b'),source('repeat')],calls=[],progress=[];
  const runtime={supportsCoreCapability:()=>true,async request(method,p){if(method==='source.list')return{data:{sources:sources.map(s=>({...s,bookSource:{bookSourceType:0}}))}};
   if(method!=='book.search')return{data:{}};calls.push([p.sourceId,p.page]);const s=sources.find(s=>s.sourceId===p.sourceId);
   const books=p.sourceId==='repeat'?[row('repeat','其他')]:p.page===1?[row('first','其他')]:[row(p.sourceId+':target')];
   return{data:{sourceId:s.sourceId,sourceVersion:s.sourceVersion,books,contentKind:'text',pageReceipt:receipt(s,p.page,books,p.sourceId==='repeat'?{requestFingerprint:digest('same')}:{} )}};}};
  const gateway=new switchTypes.SourceSwitchGateway(runtime);
  const out=await gateway.discoverCandidates('old','book','词',()=>true,'text',async c=>progress.push(...c));
  assert.equal(out.candidates.length,2);assert.ok(out.candidates.every(c=>c.bookName==='词'));assert.equal(progress.length,2);
  assert.deepEqual(calls.slice(0,3).map(([s,p])=>p),[1,1,1]);assert.equal(calls.length,6);assert.equal(out.incompleteSourceCount,1);
  assert.equal(calls.filter(([s,p])=>s==='repeat').length,2,'duplicate source terminates at unknown without a global page cap');
  const before=calls.length;sources[0].sourceVersion=digest('a:new');
  const next=await gateway.discoverCandidates('old','book','词',()=>true,'text');
  assert.ok(calls.slice(before).some(([s,p])=>s==='a'&&p===1),'new source version starts a new page lineage');
  assert.ok(!calls.slice(before).some(([s])=>s==='b'),'unchanged satisfied source is not searched again');
  assert.ok(next.candidates.every(c=>c.sourceId!=='a'||c.sourceVersion===sources[0].sourceVersion));
 }
 recordContractCasePass(id);
}

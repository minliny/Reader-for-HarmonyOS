import assert from 'node:assert/strict';
import {selectedProductionMethods} from './lib/selected-production-methods.mjs';
import {actualProjectionTypes,actualProjectionIndex,actualProjectionSdkFeedback} from './lib/bookshelf-projection-owner-probe.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
async function until(predicate){for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,1));}assert.fail('actual projection boundary did not settle');}
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
const book=(i,sourceId='local')=>({sourceId,bookId:String(i),title:'Book '+i,author:'Author',addedAt:1,sortIndex:i,sourceName:sourceId==='local'?'本地书籍':undefined});
const plain=rows=>({kind:rows.length?'populated':'empty',shelf:{books:rows,total:rows.length},continueReading:undefined});
function fixture({count=1,pages=false,source='local',contentKindFilter=false}={}){
 let installed,gate,sourceGate,fail=0;
 const model={rows:Array.from({length:count},(_,i)=>book(i,source)),revision:'r1',sourceRows:[],change:false,pageFault:'',duplicateId:0,filterRows:undefined};
 const calls=[];
 const runtime={supportsCoreCapability:c=>(pages&&['bookshelf.pageProjection.v1','bookshelf.anchorPage.v1'].includes(c))||(contentKindFilter&&c==='bookshelf.contentKindFilter.v1'),
 async request(method,params,options={}){
  calls.push({method,params:structuredClone(params),options});
  if(method==='source.list'){const captured=structuredClone(model.sourceRows),wait=sourceGate;sourceGate=undefined;if(wait)await wait.promise;return{data:{sources:captured}};}
  assert.equal(method,'bookshelf.list');
  const rows=model.filterRows?.(params.readingState)??model.rows;
  const offset=params.anchor===undefined?params.offset??0:Math.floor(rows.findIndex(b=>b.sourceId===params.anchor.sourceId&&b.bookId===params.anchor.bookId)/48)*48;
  let selected=structuredClone(rows.slice(Math.max(0,offset),Math.max(0,offset)+(params.limit??rows.length)));
  if(model.pageFault==='duplicate'&&offset>0)selected[0]=book(model.duplicateId,source);
  const result={books:selected,total:rows.length,...(params.pageProjection?{projectionRevision:model.revision,offset:model.pageFault==='offset'?offset+1:offset,
    changed:model.change,unfilteredTotal:model.rows.length,unfilteredOnlineTotal:source==='local'?0:model.rows.length}:{})};
  const wait=gate;gate=undefined;const reject=fail>0;if(reject)fail--;if(wait)await wait.promise;if(reject)throw Error('actual shelf read unavailable');return{data:result};
 }};
 installed=runtime;const types=actualProjectionTypes(()=>installed),x=actualProjectionIndex(runtime,types);
 return {...x,types,runtime,model,calls,fail:n=>fail=n,setOwner:o=>installed=o,pause(){gate=deferred();return gate;},pauseSources(){sourceGate=deferred();return sourceGate;}};
}
const checks=[];
{
 const f=fixture();f.fail(1);f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='current');assert.equal(f.calls.length,2);assert.equal(f.read.snapshot.books[0].bookId,'0');
 assert.equal(f.read.snapshot.visualAdmitted,true);assert.equal(f.read.failed,false);checks.push('actual CoreGateway/Flow/readOwner/Projection/Index first failure retries once');
}
{
 const f=fixture();f.fail(2);f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='failed');assert.equal(f.calls.length,2);
 const g=f.read.snapshot.facts.generation;f.read.retry(g);await until(()=>f.read.snapshot.facts?.fact==='current');assert.equal(f.calls.length,3);f.read.retry(g);await tick();assert.equal(f.calls.length,3);checks.push('actual first failure and exact read-only retry');
}
{
 const f=fixture();f.index.applyBookshelfState(plain([book(99)]));const rows=f.read.snapshot.books;f.fail(1);f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='refreshFailed');assert.equal(f.read.snapshot.books,rows);assert.equal(f.read.snapshot.books[0].bookId,'99');
 const value=f.read.snapshot.facts;f.model.rows=[];f.read.retry(value.generation);await until(()=>f.read.snapshot.facts?.fact==='partial');assert.equal(f.read.snapshot.books,rows);assert.match(f.read.snapshot.facts.message,/读回为空/);checks.push('retained availability/refresh failure/empty read remains honest');
}
{
 const f=fixture({count:220,pages:true});f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='current');const header=f.read.snapshot.continueReading;
 for(let i=0;i<4;i++){f.read.page(false);await until(()=>!f.owner.snapshot().pageLoading);}
 assert.equal(f.read.snapshot.books.length,124);assert.ok(f.read.snapshot.books.length<=144);assert.equal(f.read.snapshot.offset,96);assert.equal(f.read.snapshot.books[0].bookId,'96');assert.equal(f.read.snapshot.continueReading,header);
 f.read.page(true);await until(()=>!f.owner.snapshot().pageLoading);assert.equal(f.read.snapshot.offset,48);assert.equal(f.read.snapshot.books[0].bookId,'48');
 const before=f.read.snapshot.books;f.model.pageFault='duplicate';f.model.duplicateId=48;f.read.page(false);await until(()=>!f.owner.snapshot().pageLoading);assert.equal(f.read.snapshot.books,before);checks.push('actual pages max144/48-step/header/duplicate refusal');
}
{
 const f=fixture({count:120,pages:true});f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='current');
 const old=f.pause();f.read.page(false);await until(()=>f.owner.snapshot().pageLoading);
 f.model.filterRows=filter=>filter==='reading'?[book(999)]:f.model.rows;
 f.domainRefresh({readingState:'reading',sourceKind:'all',contentKind:'all'});await until(()=>f.read.snapshot.books[0]?.bookId==='999');old.resolve();await tick();await tick();
 assert.deepEqual(f.read.snapshot.books.map(b=>b.bookId),['999']);assert.equal(f.read.snapshot.offset,0);assert.equal(f.owner.snapshot().pageLoading,false);checks.push('rapid filter rejects deferred previous-page ACK');
}
for(const retired of ['route','nav','runtime-unset','newRuntime','unmounted']){
 const f=fixture();f.index.applyBookshelfState(plain([book(99)]));const wait=f.pause();f.index.refreshBookshelf();await until(()=>f.calls.length===1);
 const snapshot=f.read.snapshot.facts;
 if(retired==='route')f.show('settings');if(retired==='nav')f.advance();if(retired==='runtime-unset')f.setOwner(undefined);if(retired==='newRuntime')f.setOwner({});if(retired==='unmounted')f.index.shelfReceiptRetired=true;
 wait.resolve();await tick();await tick();assert.equal(f.read.snapshot.facts,snapshot);assert.equal(f.read.snapshot.books[0].bookId,'99');assert.equal(f.calls.length,1);checks.push('exact '+retired+' rejects old read publication');
}
{
 const f=fixture({count:130,pages:true});f.index.applyBookshelfState({kind:'populated',shelf:{books:[book(99)],total:130,projectionRevision:'r0',offset:96},continueReading:undefined});
 f.read.viewState.anchorKey=JSON.stringify(['local','99']);f.read.viewState.anchorOffset=17;
 f.index.refreshBookshelf();await until(()=>f.read.snapshot.books.some(b=>b.bookId==='99'));
 await until(()=>f.calls.some(c=>c.params.anchor));await tick();await tick();assert.equal(f.read.snapshot.offset,96);assert.equal(f.read.viewState.anchorOffset,17);assert.deepEqual(f.calls.find(c=>c.params.anchor).params.anchor,{sourceId:'local',bookId:'99'});checks.push('Core exact anchor preserves UI scroll geometry');
}
{
 const f=fixture({source:'s'});f.model.rows[0]={...book(0,'s'),readProgress:3400,currentChapterIndex:4,readingPosition:{chapterIndex:4,chapterOffset:6,updatedAt:7},group:'group',kind:'novel'};
 f.model.sourceRows=[{sourceId:'s',name:'Actual source',enabled:true}];f.index.refreshBookshelf();await until(()=>f.read.snapshot.books[0]?.sourceName==='Actual source');
 assert.equal(f.read.snapshot.books[0].readProgress,3400);assert.equal(f.read.snapshot.books[0].readingPosition.chapterOffset,6);assert.equal(f.read.snapshot.books[0].group,'group');
 f.model.sourceRows=[];f.model.rows[0].sourceName='书源名称暂不可用';f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='current');assert.equal(f.read.snapshot.books[0].sourceName,'Actual source');
 f.model.rows[0].sourceName='书源已移除';f.index.refreshBookshelf();await until(()=>f.read.snapshot.books[0].sourceName==='书源已移除');assert.equal(f.read.snapshot.books[0].sourceName,'书源已移除');checks.push('one source-name policy preserves exact progress/all metadata and confirmed deletion');
}
{
 const f=fixture({source:'s'}),sourceWait=f.pauseSources();f.model.sourceRows=[{sourceId:'s',name:'Old source',enabled:true}];
 f.index.refreshBookshelf();await until(()=>f.calls.some(c=>c.method==='source.list'));
 f.index.applyBookshelfState(plain([book(99,'other')]));sourceWait.resolve();await tick();await tick();assert.equal(f.read.snapshot.books[0].bookId,'99');assert.notEqual(f.read.snapshot.books[0].sourceName,'Old source');checks.push('late source-name hydration cannot decorate successor book');
}
{
 const f=fixture();f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='current');
 const next=actualProjectionIndex(f.runtime,f.types,{identity:99});assert.equal(next.owner,f.owner);assert.equal(next.read.snapshot.books[0].bookId,'0');
 f.owner.detach(f.read.binding.identity);next.index.applyBookshelfState(plain([book(77)]));assert.equal(next.read.snapshot.books[0].bookId,'77');assert.equal(f.read.snapshot.books[0].bookId,'0');
 f.setOwner(undefined);assert.equal(next.index.bookshelfHost.projection(f.runtime),undefined);checks.push('same Runtime reconstruction shares owner; old detach and retired lookup cannot replace successor');
}
{
 const f=fixture({count:110,pages:true});f.model.filterRows=filter=>filter==='reading'?[book(1)]:f.model.rows;f.domainRefresh({readingState:'reading',sourceKind:'all',contentKind:'all'});await until(()=>f.read.snapshot.facts?.fact==='current');assert.equal(f.member.length,0,'filtered page is not full canonical membership');
 f.index.refreshSearchShelfMembership();await until(()=>f.member.length===1);assert.equal(f.member[0].length,110);assert.equal(f.index.librarySearch.host.shelfMembership().length,110,'actual SearchHost receives the complete canonical membership');assert.ok(f.calls.filter(c=>c.params.membershipOnly).every(c=>c.params.readingState==='all'));checks.push('complete membership stays domain-owned across filtered view');
}

{
  const f=fixture();f.index.applyBookshelfState(plain([book(99)]));f.fail(1);f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='refreshFailed');
  const bridge=actualProjectionSdkFeedback(f),rendered=bridge.project();assert.equal(rendered.shelf.params.books,f.read.snapshot.books);
  assert.equal(rendered.shelf.params.viewState,f.read.viewState);assert.equal(rendered.shelf.params.continueReading,f.read.snapshot.continueReading);
  assert.equal(rendered.notice,undefined,'ordinary retained refresh failure has no pending floating Notice');
  assert.equal(rendered.action,undefined,'no fake inline retry is painted');assert.equal(rendered.toasts.length,1);assert.match(rendered.toasts[0],/保留/);
  rendered.retry();rendered.retry();await until(()=>f.read.snapshot.facts?.fact==='current');assert.equal(f.calls.filter(c=>c.method==='bookshelf.list').length,2,'actual Index read delegate dispatches one read');
  const count=f.calls.length;rendered.retry();await tick();assert.equal(f.calls.length,count,'old recovery actor does not replay');
  const old=rendered.shelf.params;f.advance();old.onFilterRequested('reading','online');old.onNextPageRequested();old.onPreviousPageRequested();
  for(const name of ['onRssRequested','onSettingsRequested','onDiscoverRequested','onVisibleBooksChanged','onBookSelected','onBookMultiSelectRequested','onBookInfoRequested','onBookGroupRequested','onBookRemoveRequested'])old[name](book(99));
  await tick();assert.equal(f.read.filter().readingState,'all');assert.equal(f.read.filter().sourceKind,'all');assert.equal(f.calls.length,count,'old physical page filter/paging intent cannot borrow fresh navigation');
  checks.push('actual Index→SDK Page payload/Shell Toast, existing pure-read retry delegate and old physical filter callbacks');
}
{
  const f=fixture(),apply=f.read.binding.emit;let fail=true;
  f.read.binding.emit=(snapshot,...args)=>{if(fail&&snapshot.facts?.fact==='current')throw Error('physical projection unavailable');return apply(snapshot,...args);};
  f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='partial');assert.equal(f.calls.length,1);assert.match(f.read.snapshot.facts.message,/读取已完成.*显示更新未完成/);assert.equal(f.read.failed,true);
  fail=false;f.read.retry(f.read.snapshot.facts.generation);await until(()=>f.read.snapshot.facts?.fact==='current');assert.equal(f.calls.length,2);assert.equal(f.read.failed,false);
  checks.push('Core successful read/presentation failure are separate and never trigger an automatic second IO');
}
{
  const f=fixture({count:110,pages:true});f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='current');
  const selected=await f.owner.selection(f.read.binding);assert.equal(selected.books.length,110);
  assert.equal(selected.projectionRevision,'r1');
  assert.deepEqual(selected.books.map(b=>b.bookId),Array.from({length:110},(_,i)=>String(i)));
  assert.ok(f.calls.every(c=>['bookshelf.list','source.list'].includes(c.method)),'management selection is only a domain read');
  const wait=f.pause(),pending=f.owner.selection(f.read.binding);await until(()=>f.calls.length>5);
  f.advance();wait.resolve();assert.equal(await pending,undefined);
  checks.push('complete management selection uses the same actual owner/gateway and rejects old navigation without a write');
}
{
  const f=fixture();f.index.beginStartupStage=()=>{throw Error('diagnostic begin unavailable');};f.index.endStartupStage=()=>{throw Error('diagnostic end unavailable');};
  f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='current');await tick();assert.equal(f.calls.length,1);
  checks.push('diagnostic failures neither prevent Core read nor rewrite its successful publication');
}
// HEAD663c and the current Page expose only source/content chips and always
// forward readingState=all. Exercise that actual Page→Scene→read contract.
for(const supported of [false,true]){
 const f=fixture({source:'s',pages:true,contentKindFilter:supported});f.model.rows[0].contentKind='manga';
 f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts?.fact==='current');
 const rendered=actualProjectionSdkFeedback(f).project();
 f.read.viewState.anchorKey='retained-before-filter';f.read.viewState.anchorOffset=17;f.read.viewState.anchorCaptured=true;
 const Page=selectedProductionMethods(new URL('../entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets',import.meta.url),
  'BookshelfPage',['onShelfFiltersChanged']);
 // Controlled StorageLink publication and render scheduling are platform ports;
 // the Page callback, Scene guard, presentation, Host and read owner are real.
 f.storage.setOrCreate('readerBookshelfSourceFilter','online');f.storage.setOrCreate('readerBookshelfContentFilter','manga');
 let queued=0;const before=f.calls.length;
 Page.prototype.onShelfFiltersChanged.call({mounted:true,serverFiltered:true,sourceFilter:'online',contentFilter:'manga',
  navigationGeneration:f.index.navigationGeneration,onFilterRequested:rendered.shelf.params.onFilterRequested,
  queueShelfProjection:()=>queued++});
 if(supported)await until(()=>f.calls.slice(before).some(call=>call.method==='bookshelf.list'&&call.params.sourceKind==='online'&&call.params.contentKind==='manga'));
 else {await until(()=>f.read.snapshot.facts?.fact==='refreshFailed');const reads=f.calls.slice(before).filter(call=>call.method==='bookshelf.list');assert.equal(reads.length,1,'the independent continue summary remains a separate canonical read');assert.equal(reads[0].params.hasReadingProgress,true);assert.equal(reads[0].params.limit,1);assert.equal(reads[0].params.contentKind,undefined,'unsupported content filter is never sent to Core');}
 assert.deepEqual(f.read.filter(),{readingState:'all',sourceKind:'online',contentKind:'manga'});
 assert.equal(f.read.viewState.anchorKey,'');assert.equal(f.read.viewState.anchorOffset,0);assert.equal(f.read.viewState.anchorCaptured,false);assert.equal(queued,1);
 checks.push('actual Page source/content callback and anchor reset; declared content-filter capability '+(supported?'reaches canonical read':'rejects unsupported filtered dispatch while retaining independent summary')+'; readingState remains all');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'whole actual Core/Flow/Source gateways and SDK TS emitted owner/Host + actual Index; native layout/target separate'},null,2));

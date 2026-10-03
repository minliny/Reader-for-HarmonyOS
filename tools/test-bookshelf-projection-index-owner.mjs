import assert from 'node:assert/strict';
import {actualProjectionTypes,actualProjectionIndex,actualProjectionSdkFeedback} from './lib/bookshelf-projection-owner-probe.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
async function until(predicate){for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,1));}assert.fail('actual projection boundary did not settle');}
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
const book=(i,sourceId='local')=>({sourceId,bookId:String(i),title:'Book '+i,author:'Author',addedAt:1,sortIndex:i,sourceName:sourceId==='local'?'本地书籍':undefined});
const plain=rows=>({kind:rows.length?'populated':'empty',shelf:{books:rows,total:rows.length},continueReading:undefined});
function fixture({count=1,pages=false,source='local'}={}){
 let installed,gate,sourceGate,fail=0;
 const model={rows:Array.from({length:count},(_,i)=>book(i,source)),revision:'r1',sourceRows:[],change:false,pageFault:'',duplicateId:0,filterRows:undefined};
 const calls=[];
 const runtime={supportsCoreCapability:c=>pages&&['bookshelf.pageProjection.v1','bookshelf.anchorPage.v1'].includes(c),
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
 const f=fixture();f.fail(1);f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='current');assert.equal(f.calls.length,2);assert.equal(f.idx.shelfBooks[0].bookId,'0');
 assert.equal(f.idx.isBookshelfVisualAdmitted,true);assert.equal(f.idx.bookshelfLoadFailed,false);checks.push('actual CoreGateway/Flow/readOwner/Projection/Index first failure retries once');
}
{
 const f=fixture();f.fail(2);f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='failed');assert.equal(f.calls.length,2);
 const g=f.idx.bookshelfReadFacts.generation;f.idx.retryBookshelfRead(g);await until(()=>f.idx.bookshelfReadFacts?.fact==='current');assert.equal(f.calls.length,3);f.idx.retryBookshelfRead(g);await tick();assert.equal(f.calls.length,3);checks.push('actual first failure and exact read-only retry');
}
{
 const f=fixture();f.idx.applyBookshelfState(plain([book(99)]));const rows=f.idx.shelfBooks;f.fail(1);f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='refreshFailed');assert.equal(f.idx.shelfBooks,rows);assert.equal(f.idx.shelfBooks[0].bookId,'99');
 const value=f.idx.bookshelfReadFacts;f.model.rows=[];f.idx.retryBookshelfRead(value.generation);await until(()=>f.idx.bookshelfReadFacts?.fact==='partial');assert.equal(f.idx.shelfBooks,rows);assert.match(f.idx.bookshelfReadFacts.message,/读回为空/);checks.push('retained availability/refresh failure/empty read remains honest');
}
{
 const f=fixture({count:220,pages:true});f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='current');const header=f.idx.continueReading;
 for(let i=0;i<4;i++){f.idx.loadNextShelfPage();await until(()=>!f.owner.snapshot().pageLoading);}
 assert.equal(f.idx.shelfBooks.length,124);assert.ok(f.idx.shelfBooks.length<=144);assert.equal(f.idx.shelfWindowOffset,96);assert.equal(f.idx.shelfBooks[0].bookId,'96');assert.equal(f.idx.continueReading,header);
 f.idx.loadPreviousShelfPage();await until(()=>!f.owner.snapshot().pageLoading);assert.equal(f.idx.shelfWindowOffset,48);assert.equal(f.idx.shelfBooks[0].bookId,'48');
 const before=f.idx.shelfBooks;f.model.pageFault='duplicate';f.model.duplicateId=48;f.idx.loadNextShelfPage();await until(()=>!f.owner.snapshot().pageLoading);assert.equal(f.idx.shelfBooks,before);checks.push('actual pages max144/48-step/header/duplicate refusal');
}
{
 const f=fixture({count:120,pages:true});f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='current');
 const old=f.pause();f.idx.loadNextShelfPage();await until(()=>f.owner.snapshot().pageLoading);
 f.model.filterRows=filter=>filter==='reading'?[book(999)]:f.model.rows;
 f.idx.shelfReadingFilter='reading';f.idx.refreshBookshelf();await until(()=>f.idx.shelfBooks[0]?.bookId==='999');old.resolve();await tick();await tick();
 assert.deepEqual(f.idx.shelfBooks.map(b=>b.bookId),['999']);assert.equal(f.idx.shelfWindowOffset,0);assert.equal(f.owner.snapshot().pageLoading,false);checks.push('rapid filter rejects deferred previous-page ACK');
}
for(const retired of ['route','nav','runtime-unset','newRuntime','unmounted']){
 const f=fixture();f.idx.applyBookshelfState(plain([book(99)]));const wait=f.pause();f.idx.refreshBookshelf();await until(()=>f.calls.length===1);
 const snapshot=f.idx.bookshelfReadFacts;
 if(retired==='route')f.idx.route='settings';if(retired==='nav')f.idx.navigationGeneration++;if(retired==='runtime-unset')f.setOwner(undefined);if(retired==='newRuntime')f.setOwner({});if(retired==='unmounted')f.idx.shelfReceiptRetired=true;
 wait.resolve();await tick();await tick();assert.equal(f.idx.bookshelfReadFacts,snapshot);assert.equal(f.idx.shelfBooks[0].bookId,'99');assert.equal(f.calls.length,1);checks.push('exact '+retired+' rejects old read publication');
}
{
 const f=fixture({count:130,pages:true});f.idx.applyBookshelfState({kind:'populated',shelf:{books:[book(99)],total:130,projectionRevision:'r0',offset:96},continueReading:undefined});
 f.idx.bookshelfViewState.anchorKey=JSON.stringify(['local','99']);f.idx.bookshelfViewState.anchorOffset=17;
 f.idx.refreshBookshelf();await until(()=>f.idx.shelfBooks.some(b=>b.bookId==='99'));
 await until(()=>f.calls.some(c=>c.params.anchor));await tick();await tick();assert.equal(f.idx.shelfWindowOffset,96);assert.equal(f.idx.bookshelfViewState.anchorOffset,17);assert.deepEqual(f.calls.find(c=>c.params.anchor).params.anchor,{sourceId:'local',bookId:'99'});checks.push('Core exact anchor preserves UI scroll geometry');
}
{
 const f=fixture({source:'s'});f.model.rows[0]={...book(0,'s'),readProgress:3400,currentChapterIndex:4,readingPosition:{chapterIndex:4,chapterOffset:6,updatedAt:7},group:'group',kind:'novel'};
 f.model.sourceRows=[{sourceId:'s',name:'Actual source',enabled:true}];f.idx.refreshBookshelf();await until(()=>f.idx.shelfBooks[0]?.sourceName==='Actual source');
 assert.equal(f.idx.shelfBooks[0].readProgress,3400);assert.equal(f.idx.shelfBooks[0].readingPosition.chapterOffset,6);assert.equal(f.idx.shelfBooks[0].group,'group');
 f.model.sourceRows=[];f.model.rows[0].sourceName='书源名称暂不可用';f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='current');assert.equal(f.idx.shelfBooks[0].sourceName,'Actual source');
 f.model.rows[0].sourceName='书源已移除';f.idx.refreshBookshelf();await until(()=>f.idx.shelfBooks[0].sourceName==='书源已移除');assert.equal(f.idx.shelfBooks[0].sourceName,'书源已移除');checks.push('one source-name policy preserves exact progress/all metadata and confirmed deletion');
}
{
 const f=fixture({source:'s'}),sourceWait=f.pauseSources();f.model.sourceRows=[{sourceId:'s',name:'Old source',enabled:true}];
 f.idx.refreshBookshelf();await until(()=>f.calls.some(c=>c.method==='source.list'));
 f.idx.applyBookshelfState(plain([book(99,'other')]));sourceWait.resolve();await tick();await tick();assert.equal(f.idx.shelfBooks[0].bookId,'99');assert.notEqual(f.idx.shelfBooks[0].sourceName,'Old source');checks.push('late source-name hydration cannot decorate successor book');
}
{
 const f=fixture();f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='current');
 const next=actualProjectionIndex(f.runtime,f.types,{identity:99});assert.equal(next.owner,f.owner);assert.equal(next.idx.shelfBooks[0].bookId,'0');
 f.owner.detach(f.idx.bookshelfProjectionBinding.identity);next.idx.applyBookshelfState(plain([book(77)]));assert.equal(next.idx.shelfBooks[0].bookId,'77');assert.equal(f.idx.shelfBooks[0].bookId,'0');
 f.setOwner(undefined);assert.equal(next.idx.getBookshelfProjection(),undefined);checks.push('same Runtime reconstruction shares owner; old detach and retired lookup cannot replace successor');
}
{
 const f=fixture({count:110,pages:true});f.model.filterRows=filter=>filter==='reading'?[book(1)]:f.model.rows;f.idx.shelfReadingFilter='reading';f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='current');assert.equal(f.member.length,0,'filtered page is not full canonical membership');
 f.idx.refreshSearchShelfMembership();await until(()=>f.member.length===1);assert.equal(f.member[0].length,110);assert.ok(f.calls.filter(c=>c.params.membershipOnly).every(c=>c.params.readingState==='all'));checks.push('complete membership stays domain-owned across filtered view');
}

{
  const f=fixture();f.idx.applyBookshelfState(plain([book(99)]));f.fail(1);f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='refreshFailed');
  const bridge=actualProjectionSdkFeedback(f),rendered=bridge.project();assert.equal(rendered.shelf.params.books,f.idx.shelfBooks);
  assert.equal(rendered.shelf.params.viewState,f.idx.bookshelfViewState);assert.equal(rendered.shelf.params.continueReading,f.idx.continueReading);
  assert.ok(rendered.notice);assert.match(rendered.notice.view.message,/保留/);assert.ok(rendered.action);assert.equal(rendered.action.height,36);assert.equal(rendered.action.borderRadius,6);
  rendered.action.onClick();rendered.action.onClick();await until(()=>f.idx.bookshelfReadFacts?.fact==='current');assert.equal(f.calls.filter(c=>c.method==='bookshelf.list').length,2,'actual native SDK retry dispatches one read');
  const count=f.calls.length;rendered.action.onClick();await tick();assert.equal(f.calls.length,count,'old recovery actor does not replay');
  const old=rendered.shelf.params;f.idx.navigationGeneration++;f.idx.shelfReadingFilter='all';old.onFilterRequested('reading','online');old.onNextPageRequested();old.onPreviousPageRequested();
  for(const name of ['onRssRequested','onSettingsRequested','onDiscoverRequested','onVisibleBooksChanged','onBookSelected','onBookMultiSelectRequested','onBookInfoRequested','onBookGroupRequested','onBookRemoveRequested'])old[name](book(99));
  await tick();assert.equal(f.idx.shelfReadingFilter,'all');assert.equal(f.calls.length,count,'old physical page filter/paging intent cannot borrow fresh navigation');
  checks.push('actual Index→SDK Page payload/Shell/shared Notice/36px Action read-only recovery and old physical filter callbacks');
}
{
  const f=fixture(),apply=f.idx.applyBookshelfProjection.bind(f.idx);let fail=true;
  f.idx.applyBookshelfProjection=(snapshot,...args)=>{if(fail&&snapshot.facts?.fact==='current')throw Error('physical projection unavailable');return apply(snapshot,...args);};
  f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='partial');assert.equal(f.calls.length,1);assert.match(f.idx.bookshelfReadFacts.message,/读取已完成.*显示更新未完成/);assert.equal(f.idx.bookshelfLoadFailed,true);
  fail=false;f.idx.retryBookshelfRead(f.idx.bookshelfReadFacts.generation);await until(()=>f.idx.bookshelfReadFacts?.fact==='current');assert.equal(f.calls.length,2);assert.equal(f.idx.bookshelfLoadFailed,false);
  checks.push('Core successful read/presentation failure are separate and never trigger an automatic second IO');
}
{
  const f=fixture({count:110,pages:true});f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='current');
  const selected=await f.owner.selection(f.idx.bookshelfProjectionBinding);assert.equal(selected.length,110);
  assert.deepEqual(selected.map(b=>b.bookId),Array.from({length:110},(_,i)=>String(i)));
  assert.ok(f.calls.every(c=>['bookshelf.list','source.list'].includes(c.method)),'management selection is only a domain read');
  const wait=f.pause(),pending=f.owner.selection(f.idx.bookshelfProjectionBinding);await until(()=>f.calls.length>5);
  f.idx.navigationGeneration++;wait.resolve();assert.equal(await pending,undefined);
  checks.push('complete management selection uses the same actual owner/gateway and rejects old navigation without a write');
}
{
  const f=fixture();f.idx.beginStartupStage=()=>{throw Error('diagnostic begin unavailable');};f.idx.endStartupStage=()=>{throw Error('diagnostic end unavailable');};
  f.idx.refreshBookshelf();await until(()=>f.idx.bookshelfReadFacts?.fact==='current');await tick();assert.equal(f.calls.length,1);
  checks.push('diagnostic failures neither prevent Core read nor rewrite its successful publication');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'whole actual Core/Flow/Source gateways and SDK TS emitted owner/Host + actual Index; native layout/target separate'},null,2));

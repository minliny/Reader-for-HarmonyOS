import assert from 'node:assert/strict';
import { BookshelfReadOwner } from '../entry/src/main/ets/features/bookshelf/application/BookshelfReadOwner.ts';
import { actualProjectionTypes, actualProjectionIndex, actualProjectionSdkFeedback } from './lib/bookshelf-projection-owner-probe.mjs';
const defer=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{resolve,promise};};
const tick=()=>new Promise(done=>setImmediate(done));
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,1));}assert.fail('read did not settle');}
const book=id=>({sourceId:'local',bookId:id,title:id,author:'作者',addedAt:1,sortIndex:0});
const value=(books,total=books.length)=>({kind:total===0?'empty':'populated',shelf:{books,total},continueReading:undefined});
function fixture({initial,failures=0,pages=false}={}){
 const calls=[],applied=[],stages=[],projectionErrors=[];let installed,fail=failures,gate,books=initial?.shelf.books??[book('A')],malformed=false,filtered=false;
 const owner={supportsCoreCapability:cap=>pages&&cap==='bookshelf.pageProjection.v1',request:async(method,params,options)=>{
  assert.equal(method,'bookshelf.list');calls.push({method,params,options});const accepted=gate;gate=undefined;
  const shouldFail=fail>0;if(shouldFail)fail--;const rows=malformed?'invalid':structuredClone(books);
  if(accepted)await accepted.promise;if(shouldFail)throw Error('Core read unavailable');
  return{data:params.pageProjection?{books:rows,total:books.length,projectionRevision:'r',changed:false,
    unfilteredTotal:filtered?100:books.length,unfilteredOnlineTotal:0}: {books:rows,total:books.length}};
 }};
 installed=owner;
 const types=actualProjectionTypes(()=>installed), actual=actualProjectionIndex(owner,types,{initial});
 const index=actual.index,projection=actual.owner;
 actual.read.viewState.anchorKey='chosen';actual.read.viewState.anchorOffset=7;
 const retainedBooks=actual.read.snapshot.books;
 const accept=projection.accept.bind(projection);
 projection.accept=(state,...args)=>{applied.push(state);return accept(state,...args);};
 index.endStartupStage=(...args)=>stages.push(args);
 return{...actual,index,projection,retainedBooks,owner,calls,applied,stages,projectionErrors,setOwner:v=>{installed=v;},fail:n=>{fail=n;},malformed:v=>{malformed=v;},filtered:v=>{filtered=v;},books:v=>{books=v;},pause(){gate=defer();return gate;}};
}
function sdkFeedback(f){
 const rendered=actualProjectionSdkFeedback(f).project();
 const actors=owner=>[owner,...[...(owner.children?.values()??[])].flatMap(actors)];
 const owners=actors(rendered.shell),nodes=owners.flatMap(owner=>[...(owner.nodes?.values()??[])]);
 assert.ok(rendered.main&&rendered.scaffold&&typeof rendered.main.onHeaderHeightChange==='function','readback feedback executes the actual MainTabShell and ReaderPageScaffold');
 assert.ok(nodes.some(node=>node.type==='Stack'&&node.width==='100%'&&node.height==='100%'&&node.backgroundColor),'public frame keeps its opaque full viewport');
 return{...rendered,pageProps:rendered.shelf?.params};
}

{const f=fixture({failures:1});f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts.fact==='current');assert.equal(f.calls.length,2);assert.equal(f.read.failed,false);assert.equal(f.applied.length,1);assert.deepEqual(f.projectionErrors,[]);assert.equal(f.read.snapshot.visualAdmitted,true);assert.equal(f.read.snapshot.books[0].bookId,'A');}
{const f=fixture({failures:2});f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts.fact==='failed');assert.equal(f.calls.length,2);assert.equal(f.read.failed,true);
 f.read.retry(f.read.snapshot.facts.generation);await until(()=>f.read.snapshot.facts.fact==='current');assert.equal(f.calls.length,3);}
{const seed=value([book('retained')]),f=fixture({initial:seed,failures:1});f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts.fact==='refreshFailed');
 assert.equal(f.calls.length,1);assert.equal(f.read.snapshot.facts.value,seed);assert.equal(f.read.snapshot.books,f.retainedBooks);assert.equal(f.read.viewState.anchorKey,'chosen');
 const actual=sdkFeedback(f);assert.equal(actual.pageProps.books,f.retainedBooks);assert.equal(actual.pageProps.viewState,f.read.viewState);assert.equal(actual.notice,undefined);assert.equal(actual.action,undefined);assert.equal(actual.props.readRecovery.canRetry,true);assert.equal(actual.toasts.length,1);assert.match(actual.toasts[0],/保留/);
 actual.retry();actual.retry();await until(()=>f.read.snapshot.facts.fact==='current');assert.equal(f.calls.length,2);assert.equal(f.applied.length,1);assert.equal(sdkFeedback(f).notice,undefined);
 const before=f.calls.length;actual.retry();await tick();assert.equal(f.calls.length,before);}
for(const retirement of ['navigation','route','runtime-unset','runtime-replacement','generation','unmount'])for(const rejected of [false,true]){
 const seed=value([book('retained')]),f=fixture({initial:seed,failures:rejected?1:0});const gate=f.pause();f.index.refreshBookshelf();await until(()=>f.calls.length===1);
 const before=f.read.snapshot.facts;
 if(retirement==='navigation')f.advance();if(retirement==='route')f.show('settings');if(retirement==='runtime-unset')f.setOwner(undefined);
 if(retirement==='runtime-replacement')f.setOwner({});if(retirement==='generation')f.index.invalidateBookshelfProjection();if(retirement==='unmount')f.index.shelfReceiptRetired=true;
 gate.resolve();await tick();await tick();assert.equal(f.read.snapshot.facts,before);assert.equal(f.applied.length,0);assert.equal(f.read.snapshot.books,f.retainedBooks);assert.equal(f.calls.length,1);
}
{const f=fixture({failures:1});const gate=f.pause();f.index.refreshBookshelf();await until(()=>f.calls.length===1);f.setOwner(undefined);gate.resolve();await tick();await tick();assert.equal(f.calls.length,1,'first automatic retry may not acquire a replacement/absent Runtime');}
{const f=fixture({initial:value([book('retained')])});f.malformed(true);f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts.fact==='refreshFailed');assert.equal(f.read.snapshot.books[0].bookId,'retained');}
{const f=fixture({initial:value([book('retained')])});f.books([]);f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts.fact==='partial');assert.equal(f.read.snapshot.books[0].bookId,'retained');assert.match(sdkFeedback(f).toasts[0],/读回为空/);}
{const f=fixture({pages:true});f.index.refreshBookshelf();await until(()=>f.read.snapshot.facts.fact==='current');assert.equal(f.calls.length,1);assert.equal(f.calls[0].params.limit,48);assert.equal(typeof f.calls[0].options.shouldCancel,'function');assert.equal(f.calls[0].options.shouldCancel(),false);f.setOwner(undefined);assert.equal(f.calls[0].options.shouldCancel(),true);}
{const f=fixture({pages:true});f.books([]);f.filtered(true);f.domainRefresh({readingState:'reading',sourceKind:'all',contentKind:'all'});await until(()=>f.read.snapshot.facts.fact==='current');assert.equal(f.read.snapshot.facts.value.kind,'populated','valid zero filtered matches does not mean globally empty');assert.equal(f.calls.length,2);}
// Publication faults are distinct from IO faults: a good read has one IO,
// keeps its known facts, and never takes the blank automatic retry branch.
{let reads=0;const state=value([book('known')]),owner={};
 const result=await new BookshelfReadOwner(owner,async()=>{reads++;return state;})
  .read(1,()=>true,undefined,true,()=>{throw Error('ArkUI publication unavailable');});
 assert.equal(reads,1);assert.equal(result.facts.fact,'current');assert.equal(result.facts.value,state);assert.equal(result.presentationFailed,true);}
{const failures=[];let reads=0;const owner={};
 const result=await new BookshelfReadOwner(owner,async()=>{reads++;throw Error('private user path');},
  (error,attempt)=>{failures.push({attempt,message:error.message});throw Error('diagnostic unavailable');})
  .read(1,()=>true,undefined,true,()=>{});
 assert.equal(reads,2,'diagnostic exceptions do not change the retry count');
 assert.equal(result.facts.fact,'failed');
 assert.deepEqual(failures.map(item=>item.attempt),[1,2]);}
{const f=fixture(),apply=f.read.binding.emit;f.read.binding.emit=(snapshot,...args)=>{if(snapshot.facts?.fact==='current')throw Error('presentation unavailable');return apply(snapshot,...args);};f.index.refreshBookshelf();
 await until(()=>f.read.snapshot.facts.fact==='partial');await tick();assert.equal(f.calls.length,1);
 assert.equal(f.read.failed,true);assert.match(f.read.snapshot.facts.message,/读取已完成.*显示更新未完成/);
 f.read.binding.emit=apply;f.read.retry(f.read.snapshot.facts.generation);
 await until(()=>f.read.snapshot.facts.fact==='current');assert.equal(f.calls.length,2);assert.equal(f.read.failed,false);}
console.log('PASS actual CoreGateway -> FlowGateway -> existing BookshelfHost/read owner -> Index -> SDK Shell Toast/existing readonly retry delegate: blank retry, retained refresh, malformed/empty/filter, generation/nav/route/Runtime/close deferred success+failure, no writes, anchors retained');

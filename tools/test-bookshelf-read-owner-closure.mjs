import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { BookshelfReadOwner } from '../entry/src/main/ets/features/bookshelf/BookshelfReadOwner.ts';
import { bookshelfCatalogHost } from './lib/bookshelf-catalog-host-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { projectOperationFacts } from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import { readerRecoveryView } from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
const source=file=>readFileSync(new URL('../entry/src/main/ets/'+file,import.meta.url),'utf8');
const classOf=(file,name,deps)=>new Function(...Object.keys(deps),stripTypeScriptTypes(source(file)
 .replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,'')
 .replace(/private readonly filter: BookshelfFilter/g,'filter: BookshelfFilter')
 .replace(/private readonly background: boolean/g,'background: boolean')
 .replace('this.bookshelf = new ReaderCoreGateway(runtimeOwner);','this.filter = filter; this.background = background; this.bookshelf = new ReaderCoreGateway(runtimeOwner);'))+`;return ${name};`)(...Object.values(deps));
const ReaderCoreGateway=classOf('app/ReaderCoreGateway.ts','ReaderCoreGateway',{});
const Flow=classOf('features/bookshelf/BookshelfFlowGateway.ts','BookshelfFlowGateway',{ReaderCoreGateway,LocalBookImportGateway:class{}});
const defer=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{resolve,promise};};
const tick=()=>new Promise(done=>setImmediate(done));
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await tick();}assert.fail('read did not settle');}
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
 const authority={current:()=>{if(!installed)throw Error('Runtime unavailable');return installed;}};
 const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
  ['refreshBookshelf','retryBookshelfRead','shelfReadRecovery','emptyShelfRecovery','applyBookshelfState','copyShelfBookWithSourceName'],{ReaderRuntimeOwner:authority,readerRecoveryView,projectOperationFacts,LOCAL_SOURCE_ID:'local'});
 const index=Object.assign(new Index(),{mountedRuntimeOwner:owner,bookshelfHost:bookshelfCatalogHost(Flow,()=>installed),shelfReceiptRetired:false,
  route:'bookshelf',navigationGeneration:1,bookshelfLoadGeneration:0,isBookshelfVisualAdmitted:initial?.kind==='populated',isCoreShelfEmpty:initial?.kind==='empty',
  bookshelfReadValue:initial,shelfReadingFilter:'all',shelfSourceFilter:'all',
  shelfBooks:initial?.shelf.books??[],settingsSnapshot:{reduceMotion:false},shelfProjectionRevision:'',
  shelfMembershipGeneration:0,searchHost:{updateShelf(){}},sourceDisplayName:()=> '本地书籍',
  scheduleBookshelfBackgroundRefresh(){},preparePersistedShelfBooks(){},bookshelfViewState:{anchorKey:'chosen',anchorOffset:7},beginStartupStage:()=>1,endStartupStage:(...args)=>stages.push(args),
  });
 const actualApply=index.applyBookshelfState.bind(index);index.applyBookshelfState=(state,...args)=>{applied.push(state);try{return actualApply(state,...args);}catch(error){projectionErrors.push(error);throw error;}};
 return{index,owner,calls,applied,stages,projectionErrors,setOwner:v=>{installed=v;},fail:n=>{fail=n;},malformed:v=>{malformed=v;},filtered:v=>{filtered=v;},books:v=>{books=v;},pause(){gate=defer();return gate;}};
}
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
const sdkRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url),builders=require(sdkRoot+'/lib/component_map.js').CUSTOM_BUILDER_METHOD;
const shellSource=source('features/bookshelf/BookshelfShell.ets');
for(const match of shellSource.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g))builders.add(match[1]);builders.add('bookshelfContent');
require(sdkRoot+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('BookshelfShell',new Set(['content']));
function sdkFeedback(f){
 const sdk=boundedSurfaceSdk();sdk.childSources.BookshelfMoreMenu=source('features/bookshelf/BookshelfMoreMenu.ets');
 const parent=createReaderBuilderProbe(source('pages/Index.ets'),['bookshelfShellContent','bookshelfContent'],{BookshelfShell:Child,BookshelfPage:Child,BookshelfStatusContent:Child,BookshelfEmptyPage:Child},
  {childSources:{BookshelfShell:shellSource,BookshelfPage:source('features/bookshelf/BookshelfPage.ets'),BookshelfStatusContent:source('features/bookshelf/BookshelfStatusContent.ets'),BookshelfEmptyPage:source('features/bookshelf/BookshelfEmptyPage.ets')}}).owner;
 Object.assign(parent,f.index,{shelfRecovery:()=>({visible:false,canRetry:false,message:'',generation:0}),shelfReadRecovery:()=>f.index.shelfReadRecovery(),
  retryBookshelfRead:g=>f.index.retryBookshelfRead(g)});parent.bookshelfShellContent();const props=[...parent.children.values()][0].params;
 parent.bookshelfContent();const pageProps=[...parent.children.values()].find(child=>child.params.books)?.params;
 const shell=sdk.consumer(shellSource,['shellContent','content'],{BookshelfMoreMenu:Child,READER_FLOATING_TOP_BAR_HEIGHT:56});
 Object.assign(shell,props,{content(){},topBar(){},moreMenuVisible:false});shell.shellContent();
 const notice=sdk.walk(shell).find(owner=>owner instanceof sdk.deps.ReaderRecoveryNotice),action=sdk.nodes(shell).find(node=>node.height===36&&node.onClick);
 return{props,notice,action,pageProps};
}
{const f=fixture({failures:1});f.index.refreshBookshelf();await until(()=>f.index.bookshelfReadFacts.fact==='current');assert.equal(f.calls.length,2);assert.equal(f.index.bookshelfLoadFailed,false);assert.equal(f.applied.length,1);assert.deepEqual(f.projectionErrors,[]);assert.equal(f.index.isBookshelfVisualAdmitted,true);assert.equal(f.index.shelfBooks[0].bookId,'A');}
{const f=fixture({failures:2});f.index.refreshBookshelf();await until(()=>f.index.bookshelfReadFacts.fact==='failed');assert.equal(f.calls.length,2);assert.equal(f.index.bookshelfLoadFailed,true);
 f.index.retryBookshelfRead(f.index.bookshelfReadFacts.generation);await until(()=>f.index.bookshelfReadFacts.fact==='current');assert.equal(f.calls.length,3);}
{const seed=value([book('retained')]),f=fixture({initial:seed,failures:1});f.index.refreshBookshelf();await until(()=>f.index.bookshelfReadFacts.fact==='refreshFailed');
 assert.equal(f.calls.length,1);assert.equal(f.index.bookshelfReadFacts.value,seed);assert.equal(f.index.shelfBooks,seed.shelf.books);assert.equal(f.index.bookshelfViewState.anchorKey,'chosen');
 const actual=sdkFeedback(f);assert.equal(actual.pageProps.books,seed.shelf.books);assert.equal(actual.pageProps.viewState,f.index.bookshelfViewState);assert.ok(actual.notice);assert.equal(actual.notice.view.canRetry,true);assert.ok(actual.action);assert.match(actual.notice.view.message,/保留/);
 actual.action.onClick();actual.action.onClick();await until(()=>f.index.bookshelfReadFacts.fact==='current');assert.equal(f.calls.length,2);assert.equal(f.applied.length,1);assert.equal(sdkFeedback(f).notice,undefined);
 const before=f.calls.length;actual.action.onClick();await tick();assert.equal(f.calls.length,before);}
for(const retirement of ['navigation','route','runtime-unset','runtime-replacement','generation','unmount'])for(const rejected of [false,true]){
 const seed=value([book('retained')]),f=fixture({initial:seed,failures:rejected?1:0});const gate=f.pause();f.index.refreshBookshelf();await until(()=>f.calls.length===1);
 const before=f.index.bookshelfReadFacts;
 if(retirement==='navigation')f.index.navigationGeneration++;if(retirement==='route')f.index.route='settings';if(retirement==='runtime-unset')f.setOwner(undefined);
 if(retirement==='runtime-replacement')f.setOwner({});if(retirement==='generation')f.index.bookshelfLoadGeneration++;if(retirement==='unmount')f.index.shelfReceiptRetired=true;
 gate.resolve();await tick();await tick();assert.equal(f.index.bookshelfReadFacts,before);assert.equal(f.applied.length,0);assert.equal(f.index.shelfBooks,seed.shelf.books);assert.equal(f.calls.length,1);
}
{const f=fixture({failures:1});const gate=f.pause();f.index.refreshBookshelf();await until(()=>f.calls.length===1);f.setOwner(undefined);gate.resolve();await tick();await tick();assert.equal(f.calls.length,1,'first automatic retry may not acquire a replacement/absent Runtime');}
{const f=fixture({initial:value([book('retained')])});f.malformed(true);f.index.refreshBookshelf();await until(()=>f.index.bookshelfReadFacts.fact==='refreshFailed');assert.equal(f.index.shelfBooks[0].bookId,'retained');}
{const f=fixture({initial:value([book('retained')])});f.books([]);f.index.refreshBookshelf();await until(()=>f.index.bookshelfReadFacts.fact==='partial');assert.equal(f.index.shelfBooks[0].bookId,'retained');assert.match(sdkFeedback(f).notice.view.message,/读回为空/);}
{const f=fixture({pages:true});f.index.refreshBookshelf();await until(()=>f.index.bookshelfReadFacts.fact==='current');assert.equal(f.calls.length,1);assert.equal(f.calls[0].params.limit,48);assert.equal(typeof f.calls[0].options.shouldCancel,'function');assert.equal(f.calls[0].options.shouldCancel(),false);f.setOwner(undefined);assert.equal(f.calls[0].options.shouldCancel(),true);}
{const f=fixture({pages:true});f.books([]);f.filtered(true);f.index.shelfReadingFilter='reading';f.index.refreshBookshelf();await until(()=>f.index.bookshelfReadFacts.fact==='current');assert.equal(f.index.bookshelfReadFacts.value.kind,'populated','valid zero filtered matches does not mean globally empty');assert.equal(f.calls.length,2);}
// Publication faults are distinct from IO faults: a good read has one IO,
// keeps its known facts, and never takes the blank automatic retry branch.
{let reads=0;const state=value([book('known')]),owner={};
 const result=await new BookshelfReadOwner(owner,async()=>{reads++;return state;})
  .read(1,()=>true,undefined,true,()=>{throw Error('ArkUI publication unavailable');});
 assert.equal(reads,1);assert.equal(result.facts.fact,'current');assert.equal(result.facts.value,state);assert.equal(result.presentationFailed,true);}
{const f=fixture(),apply=f.index.applyBookshelfState;f.index.applyBookshelfState=()=>{throw Error('presentation unavailable');};f.index.refreshBookshelf();
 await until(()=>f.index.bookshelfReadFacts.fact==='partial');await tick();assert.equal(f.calls.length,1);
 assert.equal(f.index.bookshelfLoadFailed,true);assert.match(f.index.bookshelfReadFacts.message,/读取已完成.*显示更新未完成/);
 f.index.applyBookshelfState=apply;f.index.retryBookshelfRead(f.index.bookshelfReadFacts.generation);
 await until(()=>f.index.bookshelfReadFacts.fact==='current');assert.equal(f.calls.length,2);assert.equal(f.index.bookshelfLoadFailed,false);}
console.log('PASS actual CoreGateway -> FlowGateway -> existing BookshelfHost/read owner -> Index -> SDK Shell/Notice/physical readonly recovery: blank retry, retained refresh, malformed/empty/filter, generation/nav/route/Runtime/close deferred success+failure, no writes, anchors retained');

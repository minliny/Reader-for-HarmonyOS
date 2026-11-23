import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {bookshelfOperationClass} from './lib/bookshelf-operation-owner-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import * as geometry from '../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {pureModuleProbe} from './lib/ets-pure-module-probe.mjs';
import {selectedProductionMethods} from './lib/selected-production-methods.mjs';
import {ReaderNavigation} from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import {isReaderProductSurfaceEnabled} from '../entry/src/main/ets/app/ReaderProductScope.ts';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const load=bookshelfOperationClass;
const projectOperationFacts=load('app/ReaderOperationFacts.ts','projectOperationFacts'),readerRecoveryView=load('app/ReaderRecoveryProjection.ts','readerRecoveryView');
let currentOwner;const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
const helpers={...load('app/ErrorMessage.ts','{errorMessageOf}'),...load('platform/network/HttpTransportPolicy.ts','{httpUrlHostname,isPrivateNetworkTarget}'),...load('features/source/application/ReaderSourceCategory.ts','{classifyReaderSource,readerSourceCategoryIsText}')};
const SourceGateway=load('features/source/application/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner,isReaderCoreTransactionPendingError:()=>false,...helpers});
const DiscoverGateway=load('features/discover/application/DiscoverGateway.ts','DiscoverGateway',{ReaderRuntimeOwner});
const {DiscoverOrchestrator,EMPTY_DISCOVER_PRESENTATION}=load('features/discover/application/DiscoverOrchestrator.ets','{DiscoverOrchestrator,EMPTY_DISCOVER_PRESENTATION}',{DiscoverGateway,SourceGateway,ReaderRuntimeOwner,projectOperationFacts,hilog:{error(){}},...helpers});
const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot(),syntax=require(sdk+'/lib/validate_ui_syntax.js');
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
for(const [name,p] of [['DiscoverPage','features/discover/ui/DiscoverPage.ets'],['ReaderRecoveryNotice','ui/feedback/ReaderRecoveryNotice.ets'],['ReaderRecoveryAction','ui/feedback/ReaderRecoveryAction.ets']]){syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...source(p).matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>m[1])));}
const sceneSource=source('features/discover/presentation/DiscoverScenePresentation.ets');
const sceneClass=text=>pureModuleProbe(text,'DiscoverScenePresentation.ets',{Observed:value=>value,DiscoverOrchestrator,EMPTY_DISCOVER_PRESENTATION},['DiscoverScenePresentation']).DiscoverScenePresentation;
const Scene=sceneClass(sceneSource);
const RootIdentity=selectedProductionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),'Index',['discoverIdentity','openDiscover'],{isReaderProductSurfaceEnabled});
const clone=v=>structuredClone(v),tick=()=>new Promise(r=>setImmediate(r));
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
const ids=['https://a.test','https://b.test'];
const sourceRecord=id=>({sourceId:id,name:id,enabled:true,enabledExplore:true,baseUrl:id,bookSource:{bookSourceType:0,enabled:true,enabledExplore:true,exploreUrl:id+'/explore'}});
const row=(sourceId='https://a.test',bookId='same-id')=>({sourceId,bookId,title:bookId,author:'author',coverUrl:'',intro:''});
function rpc(){return{calls:[],fail:undefined,partial:undefined,empty:false,pause:undefined,supportsCoreCapability:()=>false,async request(method,p){this.calls.push([method,clone(p)]);if(this.pause?.method===method)await this.pause.promise;if(this.fail===method){this.fail=undefined;throw Error(method+' offline');}
 if(method==='source.list')return{data:{sources:ids.map(sourceRecord)}};
 if(method==='source.exploreKinds')return{data:{kinds:this.partial==='allKinds'?[{url:5}]:[{title:'heading',url:''},{title:'kind one',url:'one'},{title:'kind two',url:'two'},...(this.partial==='kinds'?[{url:5}]:[])]}};
 if(method==='source.explore'){if(this.empty)return{data:{books:[]}};const books=this.partial==='allBooks'?[{bookId:'invalid'}]:[row(p.sourceId,p.url+'-'+p.page),...(this.partial==='books'?[{sourceId:ids.find(x=>x!==p.sourceId),bookId:'foreign',title:'foreign'},null,row(p.sourceId,p.url+'-'+p.page)]:[])];return{data:{books}};}
 throw Error(method);},count(method){return this.calls.filter(c=>c[0]===method).length;}};}
// Isolated feature compatibility only: current/visibility is a finite scene
// port. The actual L0 Index admission is checked separately and stays closed.
let instanceIdentity=0;
function fixture(r=rpc(),SceneOwner=Scene){
 currentOwner=r;
 const navigation=new ReaderNavigation();navigation.show('discover');
 const controls={mounting:1,retired:false},instance={rssInstanceIdentity:++instanceIdentity};
 const scene=new SceneOwner(),owner=DiscoverOrchestrator.forRuntime(r);assert.ok(owner);
 const identity=()=>RootIdentity.prototype.discoverIdentity.call(instance,navigation.snapshot().generation,controls.mounting);
 const bind=()=>{const generation=navigation.snapshot().generation,mounting=controls.mounting;
  scene.open(r,identity(),()=>!controls.retired&&ReaderRuntimeOwner.isCurrent(r)&&navigation.snapshot().route==='discover'&&
   navigation.snapshot().generation===generation&&controls.mounting===mounting);
 };
 const settle=async()=>{await owner.operationTail;};
 const props=()=>{
  const {owner:surface}=createReaderBuilderProbe(source('features/discover/ui/DiscoverSurface.ets'),['build'],{DiscoverPage:Child});
  Object.assign(surface,{presentation:scene,identity:identity(),expandedLayout:false});surface.initialRender();
  assert.equal(surface.children.size,1,'one actual phone DiscoverPage from current Surface');
  return [...surface.children.values()][0].params;
 };
 const page=()=>{const runtime=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),page=runtime.consumer(source('features/discover/ui/DiscoverPage.ets'),['operationFeedback','recovery','resultList','paginationRow','pageAction'],{readerRecoveryView},props());Object.assign(page,props(),{appThemeScheme:'day'});if(page.presentation.books.length===0)page.resultList();else page.operationFeedback();return{view:page.recovery(),nodes:new Map(runtime.nodes(page).map((n,i)=>[i,n]))};};
 const retry=async p=>{const button=[...p.nodes.values()].find(n=>n.type==='Button'&&n.constraintSize?.minHeight===44&&n.onClick);assert.ok(button,'actual public read-only recovery action '+JSON.stringify([...p.nodes.values()].map(n=>({type:n.type,size:n.constraintSize,label:n.accessibilityText,text:n.text,click:!!n.onClick}))));button.onClick();button.onClick();await settle();};
 return{r,scene,navigation,controls,owner,identity,bind,settle,page,retry,props,
  open:async()=>{bind();await settle();},op:()=>scene.snapshot.operation,p:()=>scene.snapshot};
}
for(const method of ['source.list','source.exploreKinds','source.explore']){
 const f=fixture();f.r.fail=method;await f.open();assert.equal(f.op().fact,'failed');assert.equal(f.op().hasValue,false);assert.ok(f.page().view.canRetry);const before=f.r.count(method);await f.retry(f.page());assert.equal(f.op().fact,'current');assert.equal(f.r.count(method),before+1,'double click schedules one retry chain');assert.equal(f.p().books.length,1);
}
for(const action of ['refresh','source','kind','next','previous']){
 const f=fixture();await f.open();if(action==='previous'){f.owner.nextPage();await f.settle();}
 const old=clone(f.p());f.r.fail=action==='source'?'source.exploreKinds':'source.explore';
 if(action==='refresh')f.owner.refresh();if(action==='source')f.owner.cycleSource();if(action==='kind')f.owner.selectKind(1);if(action==='next')f.owner.nextPage();if(action==='previous')f.owner.previousPage();await f.settle();assert.equal(f.op().fact,'refreshFailed');assert.deepEqual(f.p().books,old.books);assert.equal(f.p().activeSourceIndex,old.activeSourceIndex);assert.equal(f.p().activeKindIndex,old.activeKindIndex);assert.equal(f.p().page,old.page);
 await f.retry(f.page());assert.equal(f.op().fact,'current');if(action==='source'){assert.equal(f.p().activeSourceIndex,1);assert.ok(f.p().books.every(b=>b.sourceId===ids[1]));}if(action==='kind')assert.equal(f.p().activeKindIndex,1);if(action==='next')assert.equal(f.p().page,2);if(action==='previous')assert.equal(f.p().page,1);
}
for(const partial of ['kinds','allKinds','books','allBooks']){const f=fixture();await f.open();const before=clone(f.p());f.r.partial=partial;f.owner.cycleSource();await f.settle();assert.equal(f.op().fact,'partial');assert.ok(f.op().canRetry);if(partial.startsWith('all'))assert.deepEqual(f.p().books,before.books,'all-invalid payload retains previous readable scope');else{assert.equal(f.p().activeSourceIndex,1);assert.ok(f.p().books.every(b=>b.sourceId===ids[1]));assert.equal(new Set(f.p().books.map(b=>b.bookId)).size,f.p().books.length);}
 f.r.partial=undefined;await f.retry(f.page());assert.equal(f.op().fact,'current');assert.equal(f.p().activeSourceIndex,1);}
{const f=fixture();await f.open();const before=clone(f.p().books);f.r.empty=true;f.owner.nextPage();await f.settle();assert.deepEqual(f.p().books,before);assert.equal(f.p().hasNext,false);assert.equal(f.p().page,1);assert.equal(f.op().fact,'current');}
{const f=fixture();await f.open();const d=defer();f.r.pause={method:'source.explore',...d};f.owner.refresh();await tick();const calls=f.r.count('source.explore');f.owner.refresh();f.owner.selectKind(1);f.owner.nextPage();await tick();assert.equal(f.r.count('source.explore'),calls,'one queued/active read owns intent admission');f.navigation.show('bookshelf');const before=clone(f.p());d.resolve();await f.settle();assert.deepEqual(f.p(),before,'route close rejects late complete projection');}
{const f=fixture();await f.open();f.r.fail='source.explore';f.owner.refresh();await f.settle();const old=f.page();f.owner.open();await f.settle();const calls=f.r.calls.length;await f.retry(old);assert.equal(f.r.calls.length,calls,'reopened source scope rejects old retry generation');}
{const f=fixture();await f.open();const d=defer();f.r.pause={method:'source.explore',...d};f.owner.refresh();await tick();const before=clone(f.p());currentOwner=rpc();d.resolve();await f.settle();assert.deepEqual(f.p(),before,'old runtime is retired even while same route is open');assert.equal(f.scene.operations(f.identity()),undefined,'old scene cannot borrow the successor Runtime');const newer=fixture(currentOwner);assert.notEqual(newer.owner,f.owner);}
{const f=fixture();f.r.fail='source.list';await f.open();const old=clone(f.op());f.owner.retryRead(old.generation+1);await f.settle();assert.equal(f.r.count('source.list'),1,'incorrect identity never issues a read');f.r.fail='source.list';await f.retry(f.page());assert.equal(f.op().fact,'failed');assert.ok(f.op().generation!==old.generation,'retry failure has new live identity');}
assert.match(source('features/discover/ui/DiscoverPage.ets'),/JSON\.stringify\(\[book\.sourceId, book\.bookId\]\)/,'view identity contains source + book');
assert.match(source('pages/Index.ets'),/isReaderProductSurfaceEnabled\('discover'\) && this\.route === 'discover'/,'hidden product gate remains');
assert.equal(isReaderProductSurfaceEnabled('discover'),false,'L0 keeps Discover closed');
{const gate=Object.assign(new RootIdentity(),{nextNavigationGeneration:()=>assert.fail('closed Discover cannot advance navigation'),
 navigateTo:()=>assert.fail('closed Discover cannot create a product route'),readingEntry:{endReading:()=>assert.fail('closed Discover cannot retire the current reader')}});
 gate.openDiscover();assert.equal('onSelectBook' in fixture().props(),false,'existing Discover surface has no invented book-selection callback');}


{const f=fixture();await f.open();const d=defer();f.r.pause={method:'source.explore',...d};f.owner.refresh();await tick();const before=clone(f.p());currentOwner=undefined;d.resolve();await f.settle();
 assert.deepEqual(f.p(),before,'Runtime absence rejects late read without failure projection');const calls=f.r.calls.length;f.owner.refresh();await f.settle();assert.equal(f.r.calls.length,calls);
 currentOwner=f.r;f.owner.open();await f.settle();assert.equal(f.op().fact,'current');}

// Additional same-Runtime/presentation tests retain every old IO matrix above.
function wholePage(f) {
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),metrics=metricsApi.createDefaultReaderWindowMetrics();
 metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
 const page=sdk.consumer(source('features/discover/ui/DiscoverPage.ets'),['presentation','expandedLayout',
  'onBack','onRssRequested','onSettingsRequested','onRetryRead','onRefresh','onCycleSource','onSelectKind','onPreviousPage','onNextPage',
  'operationFeedback','recovery','onPresentationChanged','readFeedbackIdentity','mounted','lastReadFeedback'],{readerRecoveryView},f.props());
 page.operationFeedback();return{sdk,page,actions:()=>sdk.nodes(page).filter(n=>n.type==='Button'&&n.constraintSize?.minHeight===44&&n.onClick)};
}
{
 const f=fixture();await f.open();f.r.fail='source.explore';f.owner.refresh();await f.settle();
 const original=f.owner,current=wholePage(f),oldAction=current.actions().at(-1);assert.ok(oldAction);
 const oldProps=f.props(),oldIdentity=f.identity(),retained=clone(f.p());
 // New scene attachment now owns an explicit open/read, rather than the old
 // Index getter's attach-only side effect. Preserve cached scope while it fails.
 f.r.fail='source.explore';const newer=fixture(f.r);await newer.open();assert.equal(newer.owner,original);
 assert.deepEqual(newer.p().books,retained.books);assert.deepEqual(newer.p().sources,retained.sources);
 assert.equal(newer.p().activeSourceIndex,retained.activeSourceIndex);assert.equal(newer.p().activeKindIndex,retained.activeKindIndex);
 assert.equal(newer.p().page,retained.page);assert.notEqual(newer.op().generation,retained.operation.generation);
 assert.equal(f.scene.operations(oldIdentity),undefined,'old mounted scene cannot operate successor attachment');
 f.bind();assert.equal(original.isPresentationCurrent(newer.identity()),true,'idempotent old open cannot steal successor attachment');
 assert.equal(original.isPresentationCurrent(oldIdentity),false);
 const before=f.r.calls.length;oldAction.onClick();oldProps.onRefresh();oldProps.onSelectKind(1);await f.settle();
 assert.equal(f.r.calls.length,before,'old ordinary/native callback cannot borrow the successor attach');
 f.scene.retire();const live=wholePage(newer);live.actions().at(-1).onClick();live.actions().at(-1).onClick();await newer.settle();
 assert.equal(newer.op().fact,'current');assert.deepEqual(f.r.calls.slice(before).map(([method])=>method),['source.exploreKinds','source.explore'],'matching old detach cannot clear successor; two taps retry the one current source-read chain');
}
{
 const f=fixture();await f.open();f.r.fail='source.explore';f.owner.refresh();await f.settle();
 const old=wholePage(f),oldProps=f.props();
 f.navigation.advance();f.r.fail='source.explore';f.bind();await f.settle();
 const before=f.r.calls.length;
 old.actions().at(-1).onClick();oldProps.onCycleSource();await f.settle();assert.equal(f.r.calls.length,before,'same route new navigation refuses old native and category callbacks');
 wholePage(f).actions().at(-1).onClick();await f.settle();assert.equal(f.op().fact,'current');assert.deepEqual(f.r.calls.slice(before).map(([method])=>method),['source.exploreKinds','source.explore'],'current navigation retries exactly one source-read chain');
}
{
 const f=fixture();await f.open();const before=clone(f.p()),oldLease=f.identity();
 assert.equal(f.owner.attachPresentation('wrong',()=>assert.fail('wrong observer'),()=>false),false);
 assert.equal(f.owner.attachPresentation('throw',()=>{},()=>{throw Error('retired predicate');}),false);
 f.owner.detachPresentation('wrong');f.owner.refresh();await f.settle();assert.equal(f.op().fact,'current');
 assert.equal(DiscoverOrchestrator.forRuntime(f.r),f.owner);currentOwner=rpc();const successor=fixture(currentOwner);await successor.open();
 assert.equal(DiscoverOrchestrator.forRuntime(f.r),undefined,'retired lookup cannot replace successor feature cache');
 assert.equal(DiscoverOrchestrator.forRuntime(successor.r),successor.owner);currentOwner=undefined;
 assert.equal(f.scene.operations(oldLease),undefined,'Runtime absence cannot lend an operations handle');currentOwner=f.r;
 assert.deepEqual(before.sources,f.p().sources);f.scene.retire();
}
{
 const mutation=sceneSource.replace('return this.identity === identity && host?.isPresentationCurrent(identity) === true ? host : undefined;', 'return host;');
 assert.notEqual(mutation,sceneSource);const UnsafeScene=sceneClass(mutation);
 const f=fixture(rpc(),UnsafeScene);await f.open();f.r.fail='source.explore';f.owner.refresh();await f.settle();
 const old=wholePage(f),oldProps=f.props();f.r.fail='source.explore';const fresh=fixture(f.r,UnsafeScene);await fresh.open();const before=f.r.calls.length;
 old.actions().at(-1).onClick();await fresh.settle();assert.equal(f.r.calls.length,before,'operation generation still fences stale physical retry');
 oldProps.onRefresh();await fresh.settle();assert.deepEqual(f.r.calls.slice(before).map(([method])=>method),['source.exploreKinds','source.explore'],'negative control: missing actual scene operations guard borrows successor source-read chain');
}
{
 const mutation=sceneSource.replace('if (!current() || identity === this.identity) return;', 'if (!current()) return;');
 assert.notEqual(mutation,sceneSource);const UnsafeScene=sceneClass(mutation);
 const old=fixture(rpc(),UnsafeScene);await old.open();const fresh=fixture(old.r,UnsafeScene);await fresh.open();
 assert.equal(old.owner.isPresentationCurrent(fresh.identity()),true);
 old.bind();await old.settle();
 assert.equal(old.owner.isPresentationCurrent(fresh.identity()),false,'unconditional-open negative control proves old alive scene steals successor');
 assert.equal(old.owner.isPresentationCurrent(old.identity()),true);
}
const Direct=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),['requestDirect'],{
 DEFAULT_CORE_REQUEST_TIMEOUT_MS:15000,coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined,hilog:{warn(){}}});
for(const method of ['source.list','source.exploreKinds','source.explore']) {
 const transport=rpc(),runtime=new Direct();let startupGate;
 Object.assign(runtime,{state:'ready',preparationIntentEpoch:0,readingEntryPreparations:()=>({beginRequest:()=>false,finishRequest(){}}),
  wakeReadingPreparations(){},supportsCoreCapability:()=>false,start:async()=>{if(startupGate)await startupGate.promise;},
  runtime:{request:(...args)=>transport.request(...args)}});
 runtime.request=runtime.requestDirect.bind(runtime);runtime.calls=transport.calls;runtime.count=transport.count.bind(transport);
 const f=fixture(runtime);await f.open();startupGate=defer();
 if(method==='source.list')f.owner.open();else if(method==='source.exploreKinds')f.owner.cycleSource();else f.owner.refresh();
 await tick();const before=transport.count(method);f.navigation.advance();
 startupGate.resolve();await f.settle();assert.equal(transport.count(method),before,'actual Gateway → Runtime.start last boundary refuses retired '+method);
 startupGate=undefined;f.bind();await f.settle();assert.equal(f.op().fact,'current');
}

console.log('Discover closed-scope compatibility: actual Gateway -> Orchestrator -> ScenePresentation -> Surface -> SDK read/recovery: PASS (sources/kinds/pages/scope retention/partial/empty/read-only/identity/reopen/close/late/owner/concurrency).');

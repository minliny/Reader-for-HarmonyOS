import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {bookshelfOperationClass} from './lib/bookshelf-operation-owner-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import * as geometry from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const load=bookshelfOperationClass;
const projectOperationFacts=load('app/ReaderOperationFacts.ts','projectOperationFacts'),readerRecoveryView=load('app/ReaderRecoveryProjection.ts','readerRecoveryView');
let currentOwner;const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
const helpers={...load('app/ErrorMessage.ts','{errorMessageOf}'),...load('app/HttpTransportPolicy.ts','{httpUrlHostname,isPrivateNetworkTarget}'),...load('features/source/ReaderSourceCategory.ts','{classifyReaderSource,readerSourceCategoryIsText}')};
const SourceGateway=load('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner,isReaderCoreTransactionPendingError:()=>false,...helpers});
const DiscoverGateway=load('features/discover/DiscoverGateway.ts','DiscoverGateway',{ReaderRuntimeOwner});
const {DiscoverOrchestrator,EMPTY_DISCOVER_PRESENTATION}=load('features/discover/DiscoverOrchestrator.ets','{DiscoverOrchestrator,EMPTY_DISCOVER_PRESENTATION}',{DiscoverGateway,SourceGateway,ReaderRuntimeOwner,projectOperationFacts,hilog:{error(){}},...helpers});
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader',syntax=require(sdk+'/lib/validate_ui_syntax.js');
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
for(const [name,p] of [['DiscoverPage','features/discover/DiscoverPage.ets'],['ReaderRecoveryNotice','features/common/ReaderRecoveryNotice.ets'],['ReaderRecoveryAction','features/common/ReaderRecoveryAction.ets']]){syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...source(p).matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>m[1])));}
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
let indexIdentity=0;
function fixture(r=rpc(),indexText=source('pages/Index.ets')){currentOwner=r;const {owner:index}=createReaderBuilderProbe(indexText,['isCurrentRuntime','isCurrentDiscoverPresentation','getDiscoverOrchestrator','discoverPageContent','discoverPageSurface'],{DiscoverPage:Child,DiscoverOrchestrator,ReaderRuntimeOwner,deviceInfo:{deviceType:'phone'}});Object.assign(index,{route:'discover',mountedRuntimeOwner:r,shelfReceiptRetired:false,navigationGeneration:1,detailShelfAdmissionMount:1,rssInstanceIdentity:++indexIdentity,discoverPresentation:clone(EMPTY_DISCOVER_PRESENTATION)});const owner=index.getDiscoverOrchestrator();
 const settle=async()=>{await owner.operationTail;};
 const props=()=>{index.discoverPageContent();return [...index.children.values()].at(-1).params;};
 const page=()=>{const page=createReaderBuilderProbe(source('features/discover/DiscoverPage.ets'),['operationFeedback','recovery'],{ReaderRecoveryNotice:Child,readerRecoveryView}).owner;Object.assign(page,props());page.operationFeedback();const notice=createReaderBuilderProbe(source('features/common/ReaderRecoveryNotice.ets'),['build'],{ReaderRecoveryAction:Child}).owner;Object.assign(notice,{actionLabel:'刷新列表'},[...page.children.values()].at(-1).params,{appThemeScheme:'day'});notice.initialRender();const child=[...notice.children.values()].at(-1);if(child){const action=createReaderBuilderProbe(source('features/common/ReaderRecoveryAction.ets'),['build']).owner;Object.assign(action,{actionEnabled:true},child.params,{appThemeScheme:'day'});action.initialRender();for(const [id,node]of action.nodes)notice.nodes.set(-id,node);}return notice;};
 const retry=async p=>{const button=[...p.nodes.values()].find(n=>n.type==='Text'&&n.height===36);assert.ok(button,'actual public read-only recovery action');button.onClick();button.onClick();await settle();};
 return{r,index,owner,settle,page,retry,props,open:async()=>{owner.open();await settle();},op:()=>index.discoverPresentation.operation,p:()=>index.discoverPresentation};}
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
{const f=fixture();await f.open();const d=defer();f.r.pause={method:'source.explore',...d};f.owner.refresh();await tick();const calls=f.r.count('source.explore');f.owner.refresh();f.owner.selectKind(1);f.owner.nextPage();await tick();assert.equal(f.r.count('source.explore'),calls,'one queued/active read owns intent admission');f.index.route='bookshelf';const before=clone(f.p());d.resolve();await f.settle();assert.deepEqual(f.p(),before,'route close rejects late complete projection');}
{const f=fixture();await f.open();f.r.fail='source.explore';f.owner.refresh();await f.settle();const old=f.page();f.owner.open();await f.settle();const calls=f.r.calls.length;await f.retry(old);assert.equal(f.r.calls.length,calls,'reopened source scope rejects old retry generation');}
{const f=fixture();await f.open();const d=defer();f.r.pause={method:'source.explore',...d};f.owner.refresh();await tick();const before=clone(f.p());currentOwner=rpc();d.resolve();await f.settle();assert.deepEqual(f.p(),before,'old runtime is retired even while same route is open');assert.throws(()=>f.index.getDiscoverOrchestrator(),/已退役/,'old Index cannot borrow the successor Runtime');const newer=fixture(currentOwner);assert.notEqual(newer.owner,f.owner);}
{const f=fixture();f.r.fail='source.list';await f.open();const old=clone(f.op());f.owner.retryRead(old.generation+1);await f.settle();assert.equal(f.r.count('source.list'),1,'incorrect identity never issues a read');f.r.fail='source.list';await f.retry(f.page());assert.equal(f.op().fact,'failed');assert.ok(f.op().generation!==old.generation,'retry failure has new live identity');}
assert.match(source('features/discover/DiscoverPage.ets'),/JSON\.stringify\(\[book\.sourceId, book\.bookId\]\)/,'view identity contains source + book');
assert.match(source('pages/Index.ets'),/isReaderProductSurfaceEnabled\('discover'\) && this\.route === 'discover'/,'hidden product gate remains');

{const f=fixture();await f.open();const d=defer();f.r.pause={method:'source.explore',...d};f.owner.refresh();await tick();const before=clone(f.p());currentOwner=undefined;d.resolve();await f.settle();
 assert.deepEqual(f.p(),before,'Runtime absence rejects late read without failure projection');const calls=f.r.calls.length;f.owner.refresh();await f.settle();assert.equal(f.r.calls.length,calls);
 currentOwner=f.r;f.owner.open();await f.settle();assert.equal(f.op().fact,'current');}

// Additional same-Runtime/presentation tests retain every old IO matrix above.
function wholePage(f) {
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),metrics=metricsApi.createDefaultReaderWindowMetrics();
 metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
 const page=sdk.consumer(source('features/discover/DiscoverPage.ets'),['presentation','isTablet',
  'onBack','onRssRequested','onSettingsRequested','onRetryRead','onRefresh','onCycleSource','onSelectKind','onPreviousPage','onNextPage',
  'operationFeedback','recovery'],{readerRecoveryView},f.props());
 page.operationFeedback();return{sdk,page,actions:()=>sdk.nodes(page).filter(n=>n.type==='Text'&&n.height===36&&n.onClick)};
}
{
 const f=fixture();await f.open();f.r.fail='source.explore';f.owner.refresh();await f.settle();
 const original=f.owner,current=wholePage(f),oldAction=current.actions().at(-1);assert.ok(oldAction);
 const oldProps=f.props(),oldIdentity=f.index.discoverPresentationIdentity,newer=fixture(f.r);assert.equal(newer.owner,original);
 assert.deepEqual(newer.p(),f.p(),'actual shared owner publishes the same source/kind/receipt after new Index construction');
 assert.equal(f.index.getDiscoverOrchestrator(), original, 'old still-mounted getter returns original shared owner without reattaching');
 assert.equal(original.isPresentationCurrent(newer.index.discoverPresentationIdentity), true, 'old alive getter cannot steal the successor attachment');
 assert.equal(original.isPresentationCurrent(oldIdentity), false);
 const before=f.r.calls.length;oldAction.onClick();oldProps.onRefresh();oldProps.onSelectKind(1);await f.settle();
 assert.equal(f.r.calls.length,before,'old ordinary/native callback cannot borrow the successor attach');
 f.owner.detachPresentation(oldIdentity);const live=wholePage(newer);live.actions().at(-1).onClick();live.actions().at(-1).onClick();await newer.settle();
 assert.equal(newer.op().fact,'current');assert.equal(f.r.calls.length,before+1,'matching old detach cannot clear successor; current physical retry performs one pure read');
}
{
 const f=fixture();await f.open();f.r.fail='source.explore';f.owner.refresh();await f.settle();
 const old=wholePage(f),oldProps=f.props(),before=f.r.calls.length;
 f.index.navigationGeneration++;f.index.getDiscoverOrchestrator();
 old.actions().at(-1).onClick();oldProps.onCycleSource();await f.settle();assert.equal(f.r.calls.length,before,'same route new navigation refuses old native and category callbacks');
 wholePage(f).actions().at(-1).onClick();await f.settle();assert.equal(f.op().fact,'current');assert.equal(f.r.calls.length,before+1);
}
{
 const f=fixture();await f.open();const before=clone(f.p()),oldLease=f.index.discoverPresentationIdentity;
 assert.equal(f.owner.attachPresentation('wrong',()=>assert.fail('wrong observer'),()=>false),false);
 assert.equal(f.owner.attachPresentation('throw',()=>{},()=>{throw Error('retired predicate');}),false);
 f.owner.detachPresentation('wrong');f.owner.refresh();await f.settle();assert.equal(f.op().fact,'current');
 assert.equal(DiscoverOrchestrator.forRuntime(f.r),f.owner);currentOwner=rpc();const successor=fixture(currentOwner);
 assert.equal(DiscoverOrchestrator.forRuntime(f.r),undefined,'retired lookup cannot replace successor feature cache');
 assert.equal(DiscoverOrchestrator.forRuntime(successor.r),successor.owner);currentOwner=undefined;
 assert.throws(()=>f.index.getDiscoverOrchestrator(),/已退役/);currentOwner=f.r;
 assert.deepEqual(before.sources,f.p().sources);f.owner.detachPresentation(oldLease);
}
{
 const original=source('pages/Index.ets'),begin=original.indexOf('  private isCurrentDiscoverPresentation('),end=original.indexOf('\n  private getDiscoverOrchestrator()',begin);
 assert.ok(begin>=0&&end>begin);
 const mutation=original.slice(0,begin)+'  private isCurrentDiscoverPresentation(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number, host: DiscoverOrchestrator | undefined): boolean { return true; }\n'+original.slice(end);
 const f=fixture(rpc(),mutation);await f.open();f.r.fail='source.explore';f.owner.refresh();await f.settle();
 const old=wholePage(f),fresh=fixture(f.r),before=f.r.calls.length;
 old.actions().at(-1).onClick();await fresh.settle();assert.equal(f.r.calls.length,before+1,'negative control proves actual Index guard prevents borrowing the successor owner');
}
{
 const original=source('pages/Index.ets');
 const mutation=original.replace('if (this.discoverOrchestrator !== host || this.discoverPresentationIdentity !== identity) {', 'if (true) {');
 assert.notEqual(mutation,original);
 const old=fixture(rpc(),mutation);await old.open();const fresh=fixture(old.r,mutation);
 assert.equal(old.owner.isPresentationCurrent(fresh.index.discoverPresentationIdentity),true);
 old.index.getDiscoverOrchestrator();
 assert.equal(old.owner.isPresentationCurrent(fresh.index.discoverPresentationIdentity),false,'unconditional-attach negative control proves old alive getter steals successor');
 assert.equal(old.owner.isPresentationCurrent(old.index.discoverPresentationIdentity),true);
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
 await tick();const before=transport.count(method);f.index.navigationGeneration++;f.index.getDiscoverOrchestrator();
 startupGate.resolve();await f.settle();assert.equal(transport.count(method),before,'actual Gateway → Runtime.start last boundary refuses retired '+method);
 startupGate=undefined;f.owner.open();await f.settle();assert.equal(f.op().fact,'current');
}

console.log('Discover actual Gateway -> owner -> Index -> SDK read/recovery: PASS (sources/kinds/pages/scope retention/partial/empty/read-only/identity/reopen/close/late/owner/concurrency).');

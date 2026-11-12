import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"removal-receipts": {"description": "single/batch/detail确认、UNKNOWN、清理失败及导航/Runtime迟到回执", "resources": ["isolated-new-core-db"]}, "removal-admission": {"description": "未派发、错误ACK、旧重试身份及退场读回只读保护", "resources": ["isolated-new-core-db"]}, "import-receipts": {"description": "导入确认读回失败、未知ACK、相同旧行与部分成功", "resources": ["isolated-new-core-db"]}, "import-openings": {"description": "选择器关闭重开、已接纳写互斥及迟到导入核对", "resources": ["isolated-new-core-db"]}, "runtime-retirement": {"description": "Runtime卸载时删除/批量/详情/导入及核对settlement", "resources": ["isolated-new-core-db"]}, "same-runtime-reconstruction": {"description": "同Runtime真实Host重建保留原picker/write且不重复派发", "resources": ["isolated-new-core-db"]}, "old-instance": {"description": "存活旧instance无权恢复/关闭successor，冷authority准入不借lease", "resources": ["isolated-new-core-db"]}, "mutex-reentry": {"description": "单/批量/import互斥，旧Runtime隔离，同步reentry/订阅异常不重写", "resources": ["isolated-new-core-db"]}, "restore-presentation": {"description": "还原序列化结果验证、ACK隔离及picker/importing回落", "resources": ["isolated-new-core-db"]}, "import-native-callbacks": {"description": "实际ImportScene参数和Native Button旧actor正例/单护栏变异负例", "resources": ["isolated-new-core-db"]}, "detail-native-membership": {"description": "实际详情Native Button确认/未知/取消保留正文滚动，旧导航单变异负例", "resources": ["isolated-new-core-db"]}};
const selected=new Set(selectContractCases(definitions));
import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import {removalFixture} from './lib/bookshelf-removal-durable-probe.mjs';
import {actualProjectionSdkFeedback} from './lib/bookshelf-projection-owner-probe.mjs';
import {currentMutationFixture,currentImportPayload,sdkActors,bindCurrentDetailJourney,bindCurrentRemovalDialog,bindCurrentSdkMutations,waitForMutationOwner as until} from './lib/bookshelf-mutation-current-owner-probe.mjs';
import {bookshelfOperationClass} from './lib/bookshelf-operation-owner-probe.mjs';
import {actualBookshelfHostField} from './lib/bookshelf-operation-owner-probe.mjs';
import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedMembers,boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {makeIndex} from './lib/reading-entry-sdk-consumer.mjs';
import {ProductionHost,setRuntime} from './lib/reading-entry-owner-probe.mjs';
import {createDefaultReaderWindowMetrics,readerInteractiveSafeTop} from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import {localImportResultLayout} from '../entry/src/main/ets/features/bookshelf/ui/LocalImportLayout.ts';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const load=(path,names,deps={})=>new Function(...Object.keys(deps),stripTypeScriptTypes(source(path).replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,'').replace(/private readonly filter: BookshelfFilter/g,'filter: BookshelfFilter').replace(/private readonly background: boolean/g,'background: boolean').replace('this.bookshelf = new ReaderCoreGateway(runtimeOwner);',path.endsWith('BookshelfFlowGateway.ts')?'this.filter = filter; this.background = background; this.bookshelf = new ReaderCoreGateway(runtimeOwner);':'this.bookshelf = new ReaderCoreGateway(runtimeOwner);'))+`;return ${names};`)(...Object.values(deps));
const localImportFailure=load('app/LocalImportFailure.ts','localImportFailure');
const importFeedbackTypes=bookshelfOperationClass('ui/feedback/ReaderTransientFeedback.ts','({ReaderTransientFeedback,READER_FEEDBACK_BRIEF_MS})',{AppStorage:{get:()=>undefined,setOrCreate(){}}});
let currentOwner, indexInstance = 0;
const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot(),syntax=require(sdk+'/lib/validate_ui_syntax.js');
for(const [name,path] of [['MainTabShell','features/shell/MainTabShell.ets'],['AppTopBar','ui/chrome/AppTopBar.ets'],['ReaderIconButton','ui/controls/ReaderIconButton.ets'],['BookshelfMoreActionSheet','features/bookshelf/ui/BookshelfMoreActionSheet.ets'],['BookshelfShell','features/bookshelf/ui/BookshelfShell.ets'],['LocalImportDialog','features/bookshelf/ui/LocalImportDialog.ets'],['ReaderRecoveryNotice','ui/feedback/ReaderRecoveryNotice.ets'],['ReaderRecoveryAction','ui/feedback/ReaderRecoveryAction.ets']]){syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...source(path).matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>m[1])));syntax.builderParamObjectCollection.set(name,new Set([...source(path).matchAll(/@BuilderParam\s+(\w+)/g)].map(m=>m[1])));}
syntax.builderParamObjectCollection.set('BookshelfShell',new Set(['content']));


// Compile only the invariant visual graph once. Every render still receives
// its own SDK actor/Props, while each fixture below keeps its independently
// bound production Host, AtomicFile and cold SQLite authority unchanged.
const scenePayloadFamilies=new Map(),renderActors=new WeakSet(),renderNodes=new WeakSet(),renderChildren=new WeakSet();
const durableRoots=new Set();
let shelfFactory,importComposition,importFooterFactory,importSelectionFactory,renderActorCount=0;
function recordFreshActor(actor){
 assert.equal(renderActors.has(actor),false);assert.equal(renderNodes.has(actor.nodes),false);assert.equal(renderChildren.has(actor.children),false);
 renderActors.add(actor);renderNodes.add(actor.nodes);renderChildren.add(actor.children);renderActorCount++;return actor;
}
function freshActor(factory,params={}){
 const actor=recordFreshActor(new factory.Component(undefined,params));
 assert.equal(actor.observers.length,0,'a fresh render does not inherit native observers or old physical callbacks');return actor;
}
function importRenderSdk(selection=false){
 importComposition??=boundedSurfaceSdk();
 const names=selection?['fileSelectionActions','canSelectFiles','canDismissSelection','selectFiles','pickerAdmissionRevision']:
  boundedMembers(source('features/bookshelf/ui/LocalImportDialog.ets'));
 let factory=selection?importSelectionFactory:importFooterFactory;
 if(factory===undefined){
  factory=createReaderBuilderProbe(source('features/bookshelf/ui/LocalImportDialog.ets'),names,{...importComposition.deps,...importFeedbackTypes,localImportResultLayout,readerInteractiveSafeTop,ReaderWindowCoordinator:{metrics:createDefaultReaderWindowMetrics}},importComposition.hooks);
  if(selection)importSelectionFactory=factory;else importFooterFactory=factory;
 }
 return{composition:importComposition,factory};
}

const clone=v=>structuredClone(v),tick=()=>new Promise(r=>setImmediate(r));
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
const book=id=>({sourceId:'local',bookId:id,title:id,author:'author',kind:'TXT',sortIndex:0,addedAt:1});
const selection=id=>({state:'ready',input:{bookId:id,fileName:id+'.txt',stagedPath:'/private/input/'+id}});
function rpc(){return{calls:[],rows:[book('a'),book('b')],readFail:0,writeFail:false,cleanupFail:false,malformedBatch:false,malformedAdd:false,admission:false,pause:undefined,pickerPause:undefined,selections:[selection('c')],supportsCoreCapability:()=>false,async selectLocalBookInputs(){this.pickerStarted=true;if(this.pickerPause)await this.pickerPause.promise;return clone(this.selections);},async discardLocalBookInput(){this.calls.push('discard');},async commitLocalBookInput(){this.calls.push('assets.commit');return{created:false};},async rollbackLocalBookAsset(){this.calls.push('assets.rollback');},async releaseLocalBookAsset(){this.calls.push('assets.release');if(this.cleanupFail)throw Error('retained file busy');},async enqueuePendingLocalImportFinalize(){this.calls.push('journal.queue');},async request(method,p){this.calls.push(method);if(this.pause?.method===method)await this.pause.promise;
 if(method==='bookshelf.list'){if(this.readFail){this.readFail--;throw Error('read unavailable');}return{data:{books:clone(this.rows),total:this.rows.length}};}
 if(method==='import.parse')return{data:{preview:{summary:{integrity:{schemaVersion:1,readability:'complete'}}}}};
 if(method==='import.persist')return{data:{rollbackToken:{kind:'localBook',token:{transactionId:'test'}},persisted:{kind:'localBook',data:{book:{bookId:'c',title:'c',author:'author',kind:'TXT'}}}}};
 if(method==='bookshelf.add'){if(!this.rows.some(b=>b.bookId===p.bookId))this.rows.push({...p,sortIndex:0,addedAt:2});if(this.writeFail)throw Error('lost add ACK');return{data:{sourceId:'local',bookId:this.malformedAdd?'unrelated':p.bookId,created:true,addedAt:2}};}
 if(method==='import.finalize')return{data:{}};
 if(method==='import.rollback'){this.calls.push('rollback!');return{data:{}};}
 throw Error(method);
 },count(m){return this.calls.filter(x=>x===m).length;}};}
async function fixture({runtime,stored='',reconstruct=false}={}) {
 const durable=runtime?.durable??await removalFixture();
 if(runtime===undefined){
  assert.equal(durableRoots.has(durable.root),false,'a fresh scenario retains its own cold SQLite/AtomicFile directory');
  durableRoots.add(durable.root);
 }else assert.equal(durable,runtime.durable,'same-Runtime reconstruction keeps only its original file authority');
 const operationTypes=durable;
 // Current/isCurrent are the actual production identity methods. Their sole
 // injected storage is shared across these real reconstructed Host instances.
 durable.Runtime.current=ReaderRuntimeOwner.current.bind(ReaderRuntimeOwner);
 durable.Runtime.isCurrent=ReaderRuntimeOwner.isCurrent.bind(ReaderRuntimeOwner);
 const r=runtime??durable.runtime;
 if(!runtime) {
  const nativeRequest=r.request.bind(r),capabilities=r.supportsCoreCapability;
  Object.assign(r,rpc());r.supportsCoreCapability=capabilities;r.durable=durable;
  const importPlatformRequest=r.request.bind(r);
  for(const id of ['a','b'])await durable.command('bookshelf.add',{sourceId:'local',bookId:id,title:id,author:'author'});
  r.rows=(await durable.command('bookshelf.list')).data.books;
  r.request=async(method,params={},options={})=>{
   if(method==='bookshelf.list') {
    r.calls.push(method);if(r.pause?.method===method){r.paused=true;await r.pause.promise;}
    if(r.readFail&&r.calls.some(call=>['bookshelf.remove','bookshelf.removeBatch','bookshelf.add'].includes(call))){r.readFail--;throw Error('read unavailable');}
    return durable.command(method,params);
   }
   // Import parser/file adapters stay the original explicitly controlled
   // platform boundary; its shelf mutation/readback now uses real SQLite.
   if(method==='bookshelf.add')await durable.command(method,params);
   if(!method.startsWith('bookshelf.management.mutation.'))return importPlatformRequest(method,params,options);
   const original=method.endsWith('.apply')?params.mutation.method:method;
   r.calls.push(original);
   if(r.pause?.method===original){durable.options.pauseMethod=original;durable.options.gate=r.pause;}
   if(r.admission&&method.endsWith('.apply'))throw new Error('unqualified transport failure is unknown');
   if(r.malformedBatch&&method.endsWith('.apply')){durable.options.transformMethod=original;durable.options.transform=value=>({...value,data:{...value.data,removedTargets:[{sourceId:'local',bookId:'unrelated'}]}});}
   const event=await nativeRequest(method,params,options);
   if(method.endsWith('.apply')) {
    r.rows=(await durable.command('bookshelf.list')).data.books;
    if(r.writeFail)throw Error('lost ACK after genuine SQLite commit');
   }
   return event;
  };
 }
 currentOwner=r;let serialized=stored;
 const current=currentMutationFixture(r,{...durable,ReaderRuntimeOwner},{stored,initial:{kind:r.rows.length?'populated':'empty',shelf:{books:clone(r.rows),total:r.rows.length}},identity:++indexInstance});
 const {index,mutations,read}=current;
 await until(()=>!current.operation().current().reconcileBusy);
 const reconciliationCalls=[],reconcile=mutations.reconcile.bind(mutations);
 mutations.reconcile=(...args)=>{const work=reconcile(...args);reconciliationCalls.push(work);return work;};
 const shelfSdk=actualProjectionSdkFeedback(current);
 const importProps=()=>{scenePayloadFamilies.set('BookshelfImportScene',true);const x=currentImportPayload(current);recordFreshActor(x.carrier);recordFreshActor(x.actor);return x.props;};
 const render=()=>{scenePayloadFamilies.set('BookshelfScene',true);const x=shelfSdk.project();shelfFactory=true;recordFreshActor(x.scene);recordFreshActor(x.shell);
  const notice=x.notice,props=x.shell,generation=mutations.snapshot.generation,navigation=index.navigationGeneration;
  if(props.recovery.visible)assert.ok(notice,'actual decorated Scene -> Shell -> pending overlay -> shared Notice mounted');
  else assert.equal(notice,undefined,'confirmed ordinary readback failure has no persistent Notice');
  return{view:notice?.view??props.recovery,pending:notice!==undefined,action:notice===undefined?undefined:sdkActors(notice).filter(a=>a.label==='核对操作结果').flatMap(a=>[...(a.nodes?.values()??[])]).find(n=>n.type==='Button'&&n.onClick),nodes:new Map(sdkActors(x.scene).flatMap(a=>[...(a.nodes?.values()??[])]).map((n,i)=>[i,n])),readOnly:()=>props.onReconcile(generation,navigation)};};
 const importRender=()=>{const props=importProps(),{composition,factory}=importRenderSdk(),p=freshActor(factory),feedback=[];
  const feedbackValues=new Map(),transient=bookshelfOperationClass('ui/feedback/ReaderTransientFeedback.ts','ReaderTransientFeedback',{AppStorage:{get:key=>feedbackValues.get(key),setOrCreate(key,value){feedbackValues.set(key,value);if(key==='readerTransientToast'&&value.visible)feedback.push(value.message);}}});
  Object.assign(p,props,{mounted:true,foreground:true,appThemeScheme:'day',transientFeedback:new transient(),panelFrame:()=>({left:20,right:20,width:350}),resultButtonWidth:()=>100,availableHeight:()=>400,getUIContext:()=>({})});
  p.initialRender();p.onRecoveryChanged();
  const notice=composition.walk(p).find(owner=>owner instanceof composition.deps.ReaderRecoveryNotice),generation=mutations.snapshot.generation;
  assert.ok(composition.walk(p).some(owner=>owner instanceof composition.deps.ReaderBoundedSurface&&owner.specId==='local-import-result-content'),'the result panel remains independent of whether its original operation needs a Notice');
  return{view:notice?.view??props.recovery,pending:notice!==undefined,feedback,action:notice===undefined?undefined:sdkActors(notice).filter(a=>a.label==='核对导入结果').flatMap(a=>[...(a.nodes?.values()??[])]).find(n=>n.type==='Button'&&n.onClick),nodes:new Map(composition.nodes(p).map((n,i)=>[i,n])),readOnly:()=>props.onReconcile(generation)};};
 const retry=async p=>{const action=p.pending?p.action:undefined;
  if(p.pending){assert.ok(action,'actual SDK pending read action uses the shared native Button');assert.equal(action.constraintSize?.minHeight,28,'the original pending Notice minimum-height guard survives the Native Button migration');}const start=reconciliationCalls.length;
  if(action){action.onClick();action.onClick();}else{p.readOnly();p.readOnly();}await Promise.all(reconciliationCalls.slice(start));
  assert.equal(current.operation().current().reconcileBusy,false,'the real owner releases readback admission after its actual task settles');};
 const remove=async(kind='single')=>{const owner=current.operation();
  if(kind==='batch'){index.libraryJourney.openBookshelfMultiSelect();await until(()=>mutations.selection.ready);mutations.requestSelectionRemoval(mutations.selection.identity,mutations.selection.books.map(b=>b.sourceId+'\0'+b.bookId));}
  else if(kind==='detail'){current.show('detail');index.readingEntry.book=clone(read.snapshot.books[0]);index.readingEntry.toc=[{index:324,title:'第325章',navigable:true}];index.readingEntry.inBookshelf=true;index.detailShelf.mount(r);index.detailMembershipOriginal={navigation:index.navigationGeneration,book:index.readingEntry.book,toc:index.readingEntry.toc};index.detailShelf.request(index.detailShelf.identity());}
  else mutations.requestSingleRemoval(read.snapshot.books[0]);
  index.bookRemovalConfirmation.confirm();
  await until(()=>!owner.current().busy&&!mutations.singleRemovalChecking&&!mutations.selectionVerifying);};
 return{r,index,current,mutations,read,remove,render,importRender,retry,import:async()=>{mutations.openImport();await current.selectImport();},receipt:()=>mutations.snapshot.receipt,presentation:()=>mutations.snapshot.importPresentation,serialized:current.serialized,owner:current.operation,importProps};}
if(selected.has('removal-receipts')){
for(const kind of ['single','batch','detail']){
 const command=kind==='batch'?'bookshelf.removeBatch':'bookshelf.remove';
 const leaveDetailForRecovery=(f,member)=>{if(kind==='detail'){assert.equal(f.index.route,'detail','membership result stays in the current detail');assert.equal(f.index.navigationGeneration,f.index.detailMembershipOriginal.navigation,'membership result retains admission generation');assert.equal(f.index.readingEntry.book,f.index.detailMembershipOriginal.book);assert.equal(f.index.readingEntry.toc,f.index.detailMembershipOriginal.toc);assert.equal(f.index.readingEntry.toc[0].index,324);assert.equal(f.index.readingEntry.inBookshelf,member);f.index.libraryJourney.returnFromDetail();}};
 {const f=await fixture();f.r.readFail=1;await f.remove(kind);assert.equal(f.receipt().receipt.fact,'confirmedRefreshFailed');leaveDetailForRecovery(f,false);assert.equal(f.index.route,'bookshelf');const notice=f.render();assert.equal(notice.view.visible,false,'confirmed readback failure is not an unresolved original operation');assert.equal(notice.pending,false);await f.retry(notice);assert.equal(f.r.count(command),1);assert.equal(f.receipt().receipt.fact,'confirmedCurrent');assert.equal(f.r.count('assets.release'),kind==='batch'?2:1,'read retry does not retry cleanup');}
 {const f=await fixture();f.r.writeFail=true;await f.remove(kind);assert.equal(f.receipt().receipt.confirmation,'unknown');assert.equal(f.r.count('assets.release'),0);assert.ok(f.receipt().value,'current available bookshelf retained');leaveDetailForRecovery(f,true);await f.retry(f.render());assert.equal(f.receipt().receipt.fact,'confirmedCurrent');assert.equal(f.r.count('assets.release'),0,'pure exact ACK query does not perform Host cleanup');assert.equal(f.mutations.hasUnknownWrite(),true,'qualified Core ACK still blocks later writes until original cleanup');assert.equal(f.r.count(command),1);f.mutations.requestSingleRemoval(book('b'));await tick();assert.equal(f.r.count(command),1,'unknown receipt cannot blindly reissue removal');}
 {const f=await fixture();f.r.cleanupFail=true;await f.remove(kind);assert.equal(f.receipt().receipt.fact,'confirmedCurrent');leaveDetailForRecovery(f,false);assert.match(f.render().view.message,/已移出书架.*清理未完成/);assert.equal(f.render().view.canRetry,true,'pure original ACK/list query remains available separately from explicit cleanup');assert.equal(f.mutations.canContinueRemoval(),true,'same original typed cleanup can be explicitly continued');assert.equal(f.r.count(command),1);}
 {const f=await fixture();const d=defer();f.r.pause={method:command,...d};const work=f.remove(kind);await until(()=>f.r.durable.writes().some(c=>c.dispatched));f.current.advance();f.current.show('search');d.resolve();await work;assert.equal(f.receipt().receipt.confirmation,'confirmed','owner keeps accepted durable truth after route close');assert.equal(f.mutations.snapshot.removalKey,'');}
 {const f=await fixture();const d=defer();f.r.pause={method:command,...d};const work=f.remove(kind);await until(()=>f.r.durable.writes().some(c=>c.dispatched));currentOwner=rpc();d.resolve();await work;assert.equal(f.receipt(),undefined,'old runtime cannot deliver into new owner');}
}

recordContractCasePass('removal-receipts');
}
if(selected.has('removal-admission')){
{const f=await fixture();f.r.admission=true;await f.remove();assert.equal(f.receipt().receipt.confirmation,'undispatched');assert.equal(f.r.count('assets.release'),0);assert.equal(f.r.durable.writes().length,0,'transport seam rejected before the actual Core dispatch method was entered');}
{const f=await fixture();f.r.malformedBatch=true;await f.remove('batch');assert.equal(f.receipt().receipt.confirmation,'unknown');assert.equal(f.r.count('assets.release'),0,'partial/mismatched ACK cannot authorize resource release');await f.retry(f.render());assert.equal(f.receipt().receipt.confirmation,'confirmed','exact historical Core ACK qualifies the original batch independently of current rows');assert.equal(f.r.count('assets.release'),0);assert.equal(f.r.count('bookshelf.removeBatch'),1);}
{const f=await fixture();f.r.readFail=1;await f.remove();const notice=f.render(),previous=f.mutations.snapshot.generation;await f.current.domainRefresh(f.read.filter());await f.remove();assert.notEqual(f.mutations.snapshot.generation,previous,'a genuinely new accepted operation owns the replacement retry generation');const count=f.r.calls.length;await f.retry(notice);assert.equal(f.r.calls.length,count,'captured old retry cannot cross operation identity');}
{const f=await fixture();f.r.readFail=1;await f.remove();const d=defer();f.r.pause={method:'bookshelf.list',...d};const pending=f.retry(f.render());await tick();f.current.show('search');f.current.advance();const before=clone(f.read.snapshot.books);d.resolve();await pending;assert.deepEqual(f.read.snapshot.books,before,'late read cannot replace a newer route projection');assert.equal(f.receipt().receipt.fact,'confirmedRefreshFailed','retired read keeps previous honest receipt');}

recordContractCasePass('removal-admission');
}
if(selected.has('import-receipts')){
{const f=await fixture();f.r.readFail=1;await f.import();
 assert.equal(f.receipt().receipt.fact,'confirmedRefreshFailed');assert.equal(f.presentation().state,'result');assert.equal(f.presentation().batch.imported,1);
 const shown=f.importRender();assert.equal(shown.pending,false,'confirmed import readback failure does not become a pending original');
 assert.ok(shown.feedback.some(message=>/已确认.*刷新失败/.test(message)),'the actual Props still deliver ordinary readback failure to short feedback');
 const d=defer(),reads=f.r.count('bookshelf.list');f.r.pause={method:'bookshelf.list',...d};
 let retrySettled=false;const pending=f.retry(f.importRender()).then(()=>{retrySettled=true;});
 await tick();
 assert.equal(f.r.paused,true,'the real retry reaches the controlled read boundary');
 assert.equal(f.r.count('bookshelf.list'),reads+1,'two SDK clicks dispatch exactly one read');
 assert.equal(f.owner().current().reconcileBusy,true,'readback remains busy until the original read completes');
 assert.equal(f.importRender().pending,false,'a confirmed result stays independent of readback and does not acquire a pending Notice');
 assert.equal(retrySettled,false,'waiting cannot manufacture an early successful settlement');
 d.resolve();await pending;
 assert.equal(f.r.count('import.persist'),1);assert.equal(f.r.count('bookshelf.add'),1);assert.equal(f.receipt().receipt.fact,'confirmedCurrent');
}
for(const variant of ['lost','malformed','identicalOldRow']){const f=await fixture();if(variant==='identicalOldRow'){f.r.rows.push(book('c'));await f.r.durable.command('bookshelf.add',{sourceId:'local',bookId:'c',title:'c',author:'author'});}f.r.writeFail=variant!=='malformed';f.r.malformedAdd=variant==='malformed';await f.import();assert.equal(f.receipt().receipt.fact,'pendingReconciliation');assert.equal(f.presentation().batch.items[0].failure.code,'recoveryPending');assert.ok(f.read.snapshot.books.some(b=>b.bookId==='c'),'readable shelf remains available separately from unconfirmed command');assert.equal(f.r.count('import.finalize'),0);assert.equal(f.r.count('import.rollback'),0);assert.equal(f.r.count('assets.rollback'),0);const shown=f.importRender();assert.equal(shown.pending,true,'unconfirmed import keeps its own top Notice alongside the result');assert.deepEqual(shown.feedback,[],'unknown must not masquerade as short completed/failure feedback');await f.retry(shown);assert.equal(f.r.count('bookshelf.add'),1);assert.equal(f.receipt().receipt.confirmation,'unknown');}
{const f=await fixture();f.r.selections.push({state:'failed',fileName:'bad.txt',failure:localImportFailure('read failed')});await f.import();assert.equal(f.presentation().batch.imported,1);assert.equal(f.presentation().batch.failed,1);assert.equal(f.receipt().receipt.confirmation,'confirmed');}

recordContractCasePass('import-receipts');
}
if(selected.has('import-openings')){
{const f=await fixture();const d=defer();f.r.pickerPause=d;f.mutations.openImport();const old=f.current.selectImport();await until(()=>f.r.pickerStarted);f.mutations.closeImport();f.mutations.openImport();d.resolve();await old;assert.equal(f.r.count('import.persist'),0);assert.equal(f.r.count('discard'),1);assert.equal(f.presentation().state,'fileSelection');}
{const f=await fixture();const d=defer();f.r.pause={method:'bookshelf.add',...d};f.mutations.openImport();const old=f.current.selectImport();await until(()=>f.r.calls.includes('bookshelf.add'));f.mutations.closeImport();f.mutations.openImport();const pendingProps=f.importProps();assert.equal(pendingProps.selectionEnabled,false);assert.match(pendingProps.selectionBlockedMessage,/仍在处理中/);await f.current.selectImport();assert.equal(f.r.count('bookshelf.add'),1);d.resolve();await old;assert.equal(f.importProps().selectionEnabled,true);assert.equal(f.receipt().receipt.confirmation,'confirmed','closed import owner retains ACK without reopening old result');assert.equal(f.presentation().state,'fileSelection');}
{const f=await fixture();f.r.readFail=1;await f.import();const d=defer();f.r.pause={method:'bookshelf.list',...d};const old=f.retry(f.importRender());await tick();f.mutations.closeImport();f.mutations.openImport();d.resolve();await old;assert.equal(f.receipt().receipt.fact,'confirmedRefreshFailed');assert.equal(f.presentation().state,'fileSelection');assert.equal(f.r.count('bookshelf.add'),1);}


recordContractCasePass('import-openings');
}
if(selected.has('runtime-retirement')){
for(const kind of ['single','batch','detail']){const f=await fixture(),command=kind==='batch'?'bookshelf.removeBatch':'bookshelf.remove',d=defer();f.r.pause={method:command,...d};const accepted=f.remove(kind);await until(()=>f.r.durable.writes().some(c=>c.dispatched));currentOwner=undefined;assert.throws(()=>ReaderRuntimeOwner.current(),/installed by EntryAbility/);d.resolve();await assert.doesNotReject(accepted);assert.equal(f.r.count(command),1);assert.equal(f.receipt(),undefined,'retired runtime cannot present accepted ACK');assert.equal(f.owner().current().removalKey,'');assert.equal(f.owner().current().batchRemovalBusy,false);assert.equal(f.mutations.hasUnknownWrite(),false);assert.equal(f.mutations.recovery().visible,false);}
{const f=await fixture();f.r.readFail=1;await f.remove();const d=defer();f.r.pause={method:'bookshelf.list',...d};const recovery=f.retry(f.render());await tick();currentOwner=undefined;d.resolve();await assert.doesNotReject(recovery);assert.equal(f.owner().current().reconcileBusy,false,'retired read settles its lock/finally');assert.equal(f.r.count('bookshelf.remove'),1);}
{const f=await fixture(),d=defer();f.r.pause={method:'bookshelf.add',...d};f.mutations.openImport();const accepted=f.current.selectImport();await until(()=>f.r.calls.includes('bookshelf.add'));currentOwner=undefined;d.resolve();await assert.doesNotReject(accepted);assert.equal(f.r.count('bookshelf.add'),1);assert.equal(f.receipt(),undefined);assert.equal(f.owner().current().busy,false,'accepted import settles after runtime teardown without false failure UI');}

// Domain truth survives a real new Host/Index with the same exact Runtime.
// The picker may reconstruct Index; a user close/reopen still revokes its ID.

recordContractCasePass('runtime-retirement');
}
if(selected.has('same-runtime-reconstruction')){
for(const stage of ['picker','mutation'])for(const closeReopen of [false,true]) {
 const old=await fixture(),gate=defer();if(stage==='picker')old.r.pickerPause=gate;else old.r.pause={method:'bookshelf.add',...gate};
 old.mutations.openImport();const accepted=old.current.selectImport();await until(()=>stage==='picker'?old.r.pickerStarted:old.r.calls.includes('bookshelf.add'));const sameOwner=old.owner();
 old.index.shelfReceiptRetired=true;old.mutations.detach();
 const fresh=await fixture({runtime:old.r,stored:old.serialized(),reconstruct:true});assert.equal(fresh.owner(),sameOwner,'actual new Host attaches same Runtime task/receipt owner');
 assert.equal(fresh.owner().current().busy,true);const count=old.r.count('bookshelf.add');await fresh.current.selectImport();assert.equal(old.r.count('bookshelf.add'),count,'reconstruction does not duplicate accepted write/picker');
 if(closeReopen){fresh.mutations.closeImport();fresh.mutations.openImport();}
 const oldShelf=clone(old.read.snapshot.books);gate.resolve();await accepted;await tick();
 assert.deepEqual(old.read.snapshot.books,oldShelf,'retired Index never installs new content');assert.equal(fresh.owner().current().busy,false);
 if(stage==='picker'&&closeReopen){assert.equal(old.r.count('import.persist'),0);assert.equal(old.r.count('discard'),1);}
 else {assert.equal(old.r.count('bookshelf.add'),1);assert.equal(fresh.receipt().receipt.confirmation,'confirmed');}
 assert.equal(fresh.presentation().state,closeReopen?'fileSelection':'result','only same live opening can show its batch');
 if(!closeReopen)assert.ok(fresh.read.snapshot.books.some(b=>b.bookId==='c'),'actual new Index subscriber consumes true batch and shelf projection');
}
// The old Index may still be alive when the replacement attaches. Its late
// restore, physical close and reopen cannot take the successor's exact lease.

recordContractCasePass('same-runtime-reconstruction');
}
if(selected.has('old-instance')){
for(const replaceAfterPicker of [false,true]) {
 const old=await fixture(),gate=defer();old.r.pickerPause=gate;
 old.mutations.openImport();const accepted=old.current.selectImport();await until(()=>old.r.pickerStarted);
 const fresh=await fixture({runtime:old.r,stored:old.serialized(),reconstruct:true});
 const identity=fresh.presentation(),opening=fresh.mutations.snapshot.importIdentity;
 old.mutations.restore();old.mutations.closeImport();old.mutations.openImport();
 assert.equal(fresh.presentation(),identity);assert.equal(fresh.mutations.snapshot.importIdentity,opening);
 assert.equal(old.mutations.isCurrentImport(opening,old.index.navigationGeneration,old.r),false,'still alive older Index is retired by exact presentation instance');
 if(replaceAfterPicker){fresh.mutations.closeImport();fresh.mutations.openImport();}
 gate.resolve();await accepted;
 assert.equal(old.r.count('import.persist'),replaceAfterPicker?0:1);
 assert.equal(old.r.count('discard'),replaceAfterPicker?1:0);
 assert.equal(fresh.presentation().state,replaceAfterPicker?'fileSelection':'result');
 assert.equal(old.mutations.snapshot.importPresentation.state,'pickerOpening','alive old subscriber never installs successor result');
}
{
 const old=await fixture(),gate=defer();old.r.pickerPause=gate;old.mutations.openImport();
 const accepted=old.current.selectImport();await until(()=>old.r.pickerStarted);
 old.index.shelfReceiptRetired=true;old.mutations.detach();
 old.mutations.restore();gate.resolve();await accepted;
 assert.equal(old.r.count('import.persist'),0);assert.equal(old.r.count('discard'),1,'retired presentation without replacement releases unused input');
}
// Cold authority admission has not accepted a native picker yet. A fresh
// Index can attach while it is pending, but cannot lend its lease to A's call.
{
 const old=await fixture(),gate=defer();old.r.durable.options.readGate=gate;
 old.mutations.openImport();const accepted=old.current.selectImport();
 await until(()=>old.r.durable.options.readEntered===true);
 old.index.shelfReceiptRetired=true;old.mutations.detach();
 const freshWork=fixture({runtime:old.r,stored:old.serialized(),reconstruct:true});
 await until(()=>old.owner().isImportPresentationInstance(indexInstance));
 gate.resolve();await accepted;const fresh=await freshWork;
 assert.equal(old.r.pickerStarted,undefined);assert.equal(old.r.count('import.persist'),0);
 assert.equal(old.r.durable.writes().length,0);assert.equal(fresh.presentation().state,'fileSelection');
 await fresh.current.selectImport();assert.equal(old.r.pickerStarted,true,'current replacement may start its own original intent');
 assert.equal(old.r.count('import.persist'),1);
}

recordContractCasePass('old-instance');
}
if(selected.has('mutex-reentry')){
for(const kind of ['single','batch']) {
 const x=await fixture(),gate=defer(),command=kind==='single'?'bookshelf.remove':'bookshelf.removeBatch';x.r.pause={method:command,...gate};
 const accepted=x.remove(kind);await until(()=>x.r.durable.writes().some(c=>c.dispatched));x.current.show('bookshelf');x.mutations.openImport();const calls=x.r.calls.length;
 x.mutations.requestSingleRemoval(x.read.snapshot.books[0]);await x.current.selectImport();assert.equal(x.r.calls.length,calls,'one Owner mutex covers removal/batch/import, including close/reopen');
 x.index.shelfReceiptRetired=true;x.mutations.detach();const next=await fixture({runtime:x.r,stored:x.serialized()});
 assert.equal(next.owner(),x.owner());assert.equal(next.owner().current().busy,true);gate.resolve();await accepted;
 assert.equal(next.receipt().receipt.confirmation,'confirmed');assert.equal(next.owner().current().busy,false);
}
{const x=await fixture(),gate=defer();x.r.pause={method:'bookshelf.remove',...gate};const accepted=x.remove();await until(()=>x.r.durable.writes().some(c=>c.dispatched));
 x.index.shelfReceiptRetired=true;x.mutations.detach();const fresh=await fixture();const before=clone(fresh.mutations.snapshot);
 gate.resolve();await accepted;assert.deepEqual(fresh.mutations.snapshot,before,'old accepted task does not publish into replacement Runtime lane');const current=fresh.owner();assert.notEqual(x.owner(),current);assert.equal(fresh.owner(),current,'late inspection of retired Host cannot replace current Runtime lane');}
{const x=await fixture();let reentered=0;x.owner().subscribe(snapshot=>{if(snapshot.busy&&reentered++===0)x.mutations.requestSingleRemoval(x.read.snapshot.books[0]);});await x.remove();assert.equal(x.r.count('bookshelf.remove'),1,'mutex precedes synchronous subscriber reentry');}
{const x=await fixture();x.owner().subscribe(()=>{throw Error('retired ArkUI publisher');});await x.remove();assert.equal(x.receipt().receipt.confirmation,'confirmed');assert.equal(x.r.count('bookshelf.remove'),1,'presentation/diagnostic exception never changes known ACK or replays write');}

recordContractCasePass('mutex-reentry');
}
if(selected.has('restore-presentation')){
for(const serialized of ['', 'invalid', '{}', JSON.stringify({state:'result',batch:{state:'completed',imported:2,failed:0,items:[{fileName:'a',state:'success'}]}})]){
 const x=await fixture({stored:serialized});assert.equal(x.presentation(),undefined);assert.equal(x.serialized(),'','invalid reconstructed result is atomically discarded by domain owner');
}
{const x=await fixture({stored:JSON.stringify({state:'result',batch:{state:'completed',imported:1,failed:0,items:[{fileName:'ack.txt',state:'success'}]}})});
 assert.equal(x.presentation().batch.imported,1);assert.equal(x.receipt(),undefined,'a restored UI result is not an ACK for a new mutation');assert.equal(x.r.count('bookshelf.add'),0);}
for(const state of ['pickerOpening','importing']){const x=await fixture({stored:JSON.stringify({state})});assert.equal(x.presentation().state,'fileSelection');assert.equal(x.owner().current().busy,false);assert.equal(x.receipt(),undefined);}

recordContractCasePass('restore-presentation');
}
if(selected.has('import-native-callbacks')){
{const x=await fixture();x.mutations.openImport();const props=x.importProps();
 const {composition,factory}=importRenderSdk(true),actor=freshActor(factory);
 Object.assign(actor,props,{appThemeScheme:'day',mounted:true,foreground:true});actor.fileSelectionActions();const oldButtons=composition.nodes(actor).filter(n=>n.onClick);
 assert.ok(oldButtons.length>=2,'actual SDK shared primary+cancel native inputs');x.mutations.closeImport();x.mutations.openImport();
 const id=x.mutations.snapshot.importIdentity,before=x.r.calls.length;for(const node of oldButtons)node.onClick();await tick();
 assert.equal(x.mutations.snapshot.importIdentity,id);assert.equal(x.presentation().state,'fileSelection');assert.equal(x.r.calls.length,before,'actual old leaf physical callbacks cannot choose or close successor opening');
 const freshProps=x.importProps(),fresh=freshActor(factory);
 Object.assign(fresh,freshProps,{appThemeScheme:'day',mounted:true,foreground:true});fresh.fileSelectionActions();const cancelActor=composition.walk(fresh).find(owner=>owner instanceof composition.deps.ReaderRecoveryAction&&owner.label==='取消');
 const cancel=[...cancelActor.nodes.values()].find(n=>n.type==='Button'&&n.constraintSize?.minHeight===44&&n.onClick);
 assert.ok(cancel);cancel.onClick();assert.equal(x.presentation(),undefined,'current shared native action can close live opening');
 x.mutations.openImport();const original=x.mutations.isCurrentImport;x.mutations.isCurrentImport=()=>true;const oldCancelActor=composition.walk(actor).find(owner=>owner instanceof composition.deps.ReaderRecoveryAction&&owner.label==='取消');[...oldCancelActor.nodes.values()].find(n=>n.onClick).onClick();assert.equal(x.presentation(),undefined,'negative control: removing captured opening guard allows old physical cancel to close successor');x.mutations.isCurrentImport=original;
}

recordContractCasePass('import-native-callbacks');
}
if(selected.has('detail-native-membership')){
for(const result of ['confirmed','unknown','cancelled','legacy-navigation-negative']) {
 const notices=[],f=await fixture(),input={runtime:f.r,host:{constructor:ProductionHost},lease:{notice:(...args)=>notices.push(args)}};setRuntime(f.r);
 const baseline=source('pages/Index.ets'),membership='setMembership: (membership: boolean): void => { this.readingEntry.inBookshelf = membership; },';
 assert.equal(baseline.split(membership).length-1,1,'exact current membership publication source');
 const broken=baseline.replace(membership,'setMembership: (membership: boolean): void => { this.readingEntry.inBookshelf = membership; this.libraryJourney.returnToBookshelf(); },');
 assert.notEqual(broken,baseline,'negative control changes one actual initializer callback');
 const x=makeIndex(input,{route:'detail',indexSource:result==='legacy-navigation-negative'?broken:baseline}),shown=clone(f.read.snapshot.books[0]);
 Object.assign(x.entry,{book:shown,toc:[{index:324,title:'第325章',navigable:true}],inBookshelf:true,verdict:'readable',loadingMessage:''});
 bindCurrentSdkMutations(x);x.idx.detailShelf.detach();x.idx.bookshelfHost=actualBookshelfHostField(x.idx,f.current.types.Host,{setOrCreate(){}});assert.equal(x.idx.bookshelfHost.operations(f.r),f.owner(),'detail and shelf bind the exact same finite durable operation owner');x.idx.detailShelf.mount(f.r);
 bindCurrentRemovalDialog(x.idx);bindCurrentDetailJourney(x);
 const leaf=x.render();
 // The CPU probe deliberately cannot model removal of an already-painted
 // native branch. Skip only the decorative loader teardown observer; retain
 // every real control/DTO/scroll observer and all operation admission checks.
 const replay=leaf.replayOnly.bind(leaf);let unmodelledLoaderTeardowns=0;
 leaf.replayOnly=ids=>replay([...ids].filter(id=>{
  if(!leaf.removing&&!leaf.cancellingAdd&&leaf.observers[id].toString().includes('if (this.removing || this.cancellingAdd)')){unmodelledLoaderTeardowns++;return false;}
  return true;
 }));
 const scroll=[...leaf.nodes.values()].find(node=>node.type==='Scroll');assert.ok(scroll);scroll.nativeOffset={x:0,y:590};
 const secondary=[...leaf.nodes.values()].find(node=>node.type==='Text'&&node.create==='移除书架'&&node.height===48);const secondaryAction=[...leaf.nodes.values()].find(node=>node.type==='Button'&&node.accessibilityText==='移除书架');assert.ok(secondary&&secondaryAction?.onClick);
 const nav=x.idx.navigationGeneration,book=x.entry.book,toc=x.entry.toc,copies=x.p.properties.copies.length,leafCount=leaf.observers.length;
 secondaryAction.onClick();secondaryAction.onClick();assert.equal(x.idx.bookRemovalConfirmation.isOpen(),true);assert.equal(x.idx.bookRemovalConfirmation.opening?.id,1,'two pending detail taps open one scoped confirmation');
 if(result==='cancelled'){x.idx.bookRemovalConfirmation.dismiss();assert.equal(x.idx.bookRemovalConfirmation.isOpen(),false);assert.equal(f.r.count('bookshelf.remove'),0);}
 else {
  const gate=defer();f.r.pause={method:'bookshelf.remove',...gate};if(result==='unknown')f.r.writeFail=true;
  x.idx.bookRemovalConfirmation.confirm();x.idx.bookRemovalConfirmation.confirm();await until(()=>f.r.durable.writes().some(call=>call.dispatched));x.p.properties.flush();
  assert.equal(secondary.create,'移除书架','busy keeps the existing action label and geometry');assert.ok([...leaf.nodes.values()].some(node=>node.type==='LoadingProgress'&&node.width===18),'busy paints the native indicator in the original action');assert.equal(secondaryAction.enabled,false);secondaryAction.onClick();
  assert.equal(f.r.count('bookshelf.remove'),1,'pending/repeated physical action keeps one genuine SQLite mutation');
  gate.resolve();await until(()=>!f.owner().current().busy);await tick();
  if(result==='legacy-navigation-negative'){
   assert.equal(x.idx.route,'bookshelf','negative reintroducing old actual detail handler exits and destroys its admission');
   assert.notEqual(x.idx.navigationGeneration,nav);assert.equal(x.idx.detailShelf.identity().includes(`:${nav}:`),false);
   // The deliberately navigated-away Scene has been removed by the real
   // journey. The CPU renderer cannot replay native branch destruction.
   console.log(JSON.stringify({kind:'detail-native-removal-variant',variant:result,status:'PASS'}));
   continue;
  }
  x.p.properties.flush();
  assert.equal(f.r.count('bookshelf.remove'),1);assert.equal(x.entry.inBookshelf,result!=='confirmed');
  if(result==='confirmed'){
   assert.equal(secondary.create,'已移除');assert.equal(secondaryAction.enabled,false);assert.match(leaf.shelfMessage,/本地书已移除.*重新导入/);
   const primary=[...leaf.nodes.values()].find(node=>node.type==='Text'&&node.create==='请重新导入');const primaryAction=[...leaf.nodes.values()].find(node=>node.type==='Button'&&node.accessibilityText==='请重新导入');assert.ok(primary&&primaryAction);assert.equal(primaryAction.enabled,false);
   const before=f.r.calls.length;primaryAction.onClick();secondaryAction.onClick();assert.equal(f.r.calls.length,before);assert.equal(x.idx.route,'detail');
  }
  if(result==='unknown'){assert.equal(leaf.shelfMessage,'','unknown is no longer embedded in the detail body');const pending=x.idx.detailShelf.removalRecovery();assert.equal(pending.visible,true,'the same detail keeps its original top-level pending projection');assert.match(pending.message,/待核对|未确认|原删除|等待核对/);}
 }
 assert.equal(x.idx.route,'detail');assert.equal(x.idx.navigationGeneration,nav);assert.equal(x.entry.book,book);assert.equal(x.entry.toc,toc);
 assert.equal(x.p.walk(x.scene).filter(child=>child instanceof x.leaf).length,1);assert.equal([...leaf.nodes.values()].find(node=>node.type==='Scroll'),scroll);
 assert.deepEqual(scroll.nativeOffset,{x:0,y:590});assert.ok(leaf.observers.length>=leafCount,'new message/busy branches do not retire the mounted detail actor');
 assert.ok(unmodelledLoaderTeardowns<=1,'only the single decorative loader removal is outside the CPU renderer model');
 assert.deepEqual(x.p.properties.copies.slice(copies).filter(sample=>sample.object&&['book','toc'].includes(sample.name)),[],
  'confirmed/unknown/cancelled remove must not reset actual detail body props');
 console.log(JSON.stringify({kind:'detail-native-removal-variant',variant:result,status:'PASS'}));
}

recordContractCasePass('detail-native-membership');
}
if(selected.size===Object.keys(definitions).length){
assert.equal(scenePayloadFamilies.size,2,'both exact current Index Scene payload families are retained');
assert.ok(shelfFactory&&importFooterFactory&&importSelectionFactory,'all shared Shell/result/selection visual families still execute');
assert.ok(renderActorCount>40,'all render invocations still receive their own independent SDK actors');
console.log(JSON.stringify({sdkRenderActors:renderActorCount,durableScenarioDirectories:durableRoots.size,scenePayloadFamilies:scenePayloadFamilies.size,sharedVisualFactories:3}));
console.log('Bookshelf/import actual gateway → finite Host owner → Index → SDK pending overlays/short feedback/actions: PASS (ACK/read/cleanup/unknown/admission/partial/only-read, close/reopen, same-Runtime Index reconstruction, retired Runtime inspection, concurrency/reentry, actual old physical callbacks and negative control; actual decorated detail add/remove membership retains body/scroll and scoped dialog across genuine SQLite confirmed/unknown/cancelled removal).');

}

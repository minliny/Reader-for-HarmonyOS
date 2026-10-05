import {removalFixture} from './lib/bookshelf-removal-durable-probe.mjs';
import {until} from './lib/bookshelf-management-durable-probe.mjs';
import {projectionIndexMethods} from './lib/bookshelf-projection-owner-probe.mjs';
import {actualBookshelfHostField} from './lib/bookshelf-operation-owner-probe.mjs';
import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedMembers,boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const load=(path,names,deps={})=>new Function(...Object.keys(deps),stripTypeScriptTypes(source(path).replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,'').replace(/private readonly filter: BookshelfFilter/g,'filter: BookshelfFilter').replace(/private readonly background: boolean/g,'background: boolean').replace('this.bookshelf = new ReaderCoreGateway(runtimeOwner);',path.endsWith('BookshelfFlowGateway.ts')?'this.filter = filter; this.background = background; this.bookshelf = new ReaderCoreGateway(runtimeOwner);':'this.bookshelf = new ReaderCoreGateway(runtimeOwner);'))+`;return ${names};`)(...Object.values(deps));
const facts=load('app/ReaderOperationFacts.ts','{projectOperationFacts,projectCommitReadback}');
const projectPersistedReceipt=load('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
const ReaderWriteEvidence=load('app/ReaderWriteEvidence.ts','ReaderWriteEvidence');
const readerRecoveryView=load('app/ReaderRecoveryProjection.ts','readerRecoveryView');
const errorMessageOf=load('app/ErrorMessage.ts','errorMessageOf');
const localImportFailure=load('app/LocalImportFailure.ts','localImportFailure');
let currentOwner, indexInstance = 0;
const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader',syntax=require(sdk+'/lib/validate_ui_syntax.js');
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
for(const [name,path] of [['MainTabShell','features/shell/MainTabShell.ets'],['AppTopBar','features/common/AppTopBar.ets'],['ReaderIconButton','features/common/ReaderIconButton.ets'],['BookshelfMoreMenu','features/bookshelf/BookshelfMoreMenu.ets'],['BookshelfShell','features/bookshelf/BookshelfShell.ets'],['LocalImportDialog','features/bookshelf/LocalImportDialog.ets'],['ReaderRecoveryNotice','features/common/ReaderRecoveryNotice.ets'],['ReaderRecoveryAction','features/common/ReaderRecoveryAction.ets']]){syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...source(path).matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>m[1])));syntax.builderParamObjectCollection.set(name,new Set([...source(path).matchAll(/@BuilderParam\s+(\w+)/g)].map(m=>m[1])));}
syntax.builderParamObjectCollection.set('BookshelfShell',new Set(['content']));
for(const n of ['bookshelfContent','topBar'])require(sdk+'/lib/component_map.js').CUSTOM_BUILDER_METHOD.add(n);
const indexNames=[...projectionIndexMethods,'beginImport','isCurrentImport','closeImportDialog','openImportDialog','canRemoveShelfBook','canRemoveDetailBook','removeShelfBook','removeShelfBooks','removeDetailBook','applyShelfBookRemoval','applyDetailBookRemoval','hasUnknownShelfWrite','shelfRecovery','shelfReadRecovery','emptyShelfRecovery','reconcileShelfWrite','continueShelfRemoval','canContinueShelfRemoval','registerTemporaryBackBridge','hasVisibleImportDialog','visibleImportDialogState','visibleImportBatch','currentImportPresentation','reconcileImportPresentation'];

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
    if(r.readFail){r.readFail--;throw Error('read unavailable');}
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
 const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),indexNames,
  {...durable,ReaderRuntimeOwner,readerRecoveryView,projectPersistedReceipt,LocalImportPresentation:durable.LocalImportPresentation,hilog:{error(){}},DOMAIN:0});

 const index=Object.assign(new Index(),{route:'bookshelf',settingsSnapshot:{reduceMotion:true},navigationGeneration:1,mountedRuntimeOwner:r,
 detailShelfAdmissionMount:1,rssInstanceIdentity:++indexInstance,bookshelfViewState:{anchorKey:'',anchorOffset:0},searchHost:{sources:()=>[],updateShelf(){}},sourceSources:[],sourceToolsSnapshot:{sources:[]},scheduleBookshelfBackgroundRefresh(){},preparePersistedShelfBooks(){},bookshelfLoadGeneration:0,shelfOperation:{...operationTypes.EMPTY_BOOKSHELF_OPERATION_SNAPSHOT},shelfReceiptRetired:false,
 storedImportPresentation:stored,shelfBooks:clone(r.rows),shelfProjectionRevision:'',isBookshelfVisualAdmitted:true,readingSessionActive:false,sourceSwitchVisible:false,pendingSourceSwitch:undefined,offlineMutationActiveKey:'',shelfReadingFilter:'all',shelfSourceFilter:'all',shelfContentFilter:'all',
 isSameDetailBook:b=>index.detailBook?.bookId===b.bookId,detailBookKey:b=>JSON.stringify([b.sourceId,b.bookId]),
 nextNavigationGeneration:()=>++index.navigationGeneration,
 returnFromDetail:()=>{index.nextNavigationGeneration();index.route='bookshelf';}});
 index.bookshelfHost=actualBookshelfHostField(index,operationTypes.Host,{setOrCreate:(_key,value)=>{serialized=value;index.storedImportPresentation=value;}});
 index.applyBookshelfState({kind:r.rows.length?'populated':'empty',shelf:{books:clone(r.rows),total:r.rows.length},continueReading:undefined});
 index.reconcileImportPresentation();
 await until(()=>!index.bookshelfHost.operations(r).current().reconcileBusy);
 const renderIndex=method=>{const p=createReaderBuilderProbe(source('pages/Index.ets'),[method,'localImportSurface'],{BookshelfShell:Child,LocalImportDialog:Child,ReaderRuntimeOwner},{allowEmptyBranchAdmission:true});Object.assign(p.owner,index,{isCurrentBookshelfPresentation:index.isCurrentBookshelfPresentation.bind(index),shelfRecovery:()=>index.shelfRecovery(),shelfReadRecovery:()=>index.shelfReadRecovery(),emptyShelfRecovery:()=>index.emptyShelfRecovery(),reconcileShelfWrite:g=>index.reconcileShelfWrite(g),registerTemporaryBackBridge:(...args)=>index.registerTemporaryBackBridge(...args),canContinueShelfRemoval:()=>index.canContinueShelfRemoval(),continueShelfRemoval:g=>index.continueShelfRemoval(g),isCurrentImport:(...args)=>index.isCurrentImport(...args),beginImport:()=>index.beginImport(),closeImportDialog:()=>index.closeImportDialog(),visibleImportDialogState:()=>index.visibleImportDialogState(),visibleImportBatch:()=>index.visibleImportBatch()});p.owner[method]();return [...p.owner.children.values()].at(-1).params;};
 const renderNotice=params=>{const p=createReaderBuilderProbe(source('features/common/ReaderRecoveryNotice.ets'),['build'],{ReaderRecoveryAction:Child}).owner;Object.assign(p,{actionLabel:'刷新列表'},params,{appThemeScheme:'day'});p.initialRender();const child=[...p.children.values()].at(-1);if(child){const action=createReaderBuilderProbe(source('features/common/ReaderRecoveryAction.ets'),['build']).owner;Object.assign(action,{actionEnabled:true},child.params,{appThemeScheme:'day'});action.initialRender();for(const [id,node] of action.nodes)p.nodes.set(-id,node);}return p;};
 const render=()=>{const props=renderIndex('bookshelfShellContent'),composition=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const p=composition.consumer(source('features/bookshelf/BookshelfShell.ets'),boundedMembers(source('features/bookshelf/BookshelfShell.ets')),
  {bookshelfTemporaryGeneration:0,registerReaderShelfFonts:()=>{}},props);
 p.aboutToAppear();p.recoveryNoticeContent(props.recovery,false);
 const notice=composition.walk(p).find(owner=>owner instanceof composition.deps.ReaderRecoveryNotice);
 assert.ok(notice,'actual decorated Shell -> shared Notice mounted');return{view:notice.view,nodes:new Map(composition.nodes(p).map((node,id)=>[id,node]))};};
 const importRender=()=>{const props=renderIndex('localImportContent'),composition=boundedSurfaceSdk(),p=composition.consumer(source('features/bookshelf/LocalImportDialog.ets'),['resultFooter','resultRecovery']);Object.assign(p,props,{appThemeScheme:'day',resultButtonWidth:()=>100,availableHeight:()=>400});p.resultFooter();const notice=composition.walk(p).find(owner=>owner instanceof composition.deps.ReaderRecoveryNotice);assert.ok(notice,'actual shared Footer -> RecoveryNotice child mounted');return{view:notice.view,nodes:new Map(composition.nodes(p).map((node,id)=>[id,node]))};};
 const retry=async p=>{const action=[...p.nodes.values()].find(n=>n.type==='Text'&&n.height===36);assert.ok(action,'actual SDK shared recovery action exists');action.onClick();action.onClick();await until(()=>!index.bookshelfHost.operations(r).current().reconcileBusy);};
 const remove=async(kind='single')=>{if(kind==='batch'){index.route='bookshelfMultiSelect';index.removeShelfBooks(clone(index.shelfBooks));}else if(kind==='detail'){index.route='detail';index.detailBook=clone(index.shelfBooks[0]);index.removeDetailBook(index.detailBook);}else index.removeShelfBook(index.shelfBooks[0]);await until(()=>!index.bookshelfHost.operations(r).current().busy);};
 return{r,index,remove,render,importRender,retry,import:async()=>{index.openImportDialog();await index.beginImport();},receipt:()=>index.shelfOperation.receipt,presentation:()=>index.currentImportPresentation(),serialized:()=>serialized,owner:()=>index.bookshelfHost.operations(r),renderIndex};}
for(const kind of ['single','batch','detail']){
 const command=kind==='batch'?'bookshelf.removeBatch':'bookshelf.remove';
 {const f=await fixture();f.r.readFail=1;await f.remove(kind);assert.equal(f.receipt().receipt.fact,'confirmedRefreshFailed');assert.equal(f.index.route,'bookshelf');const notice=f.render();assert.match(notice.view.message,/已确认.*刷新失败/);await f.retry(notice);assert.equal(f.r.count(command),1);assert.equal(f.receipt().receipt.fact,'confirmedCurrent');assert.equal(f.r.count('assets.release'),kind==='batch'?2:1,'read retry does not retry cleanup');}
 {const f=await fixture();f.r.writeFail=true;await f.remove(kind);assert.equal(f.receipt().receipt.confirmation,'unknown');assert.equal(f.r.count('assets.release'),0);assert.ok(f.receipt().value,'current available bookshelf retained');await f.retry(f.render());assert.equal(f.receipt().receipt.fact,'confirmedCurrent');assert.equal(f.r.count('assets.release'),0,'pure exact ACK query does not perform Host cleanup');assert.equal(f.index.hasUnknownShelfWrite(),true,'qualified Core ACK still blocks later writes until original cleanup');assert.equal(f.r.count(command),1);f.index.removeShelfBook(book('b'));await tick();assert.equal(f.r.count(command),1,'unknown receipt cannot blindly reissue removal');}
 {const f=await fixture();f.r.cleanupFail=true;await f.remove(kind);assert.equal(f.receipt().receipt.fact,'confirmedCurrent');assert.match(f.render().view.message,/已移出书架.*清理未完成/);assert.equal(f.render().view.canRetry,true,'pure original ACK/list query remains available separately from explicit cleanup');assert.equal(f.index.canContinueShelfRemoval(),true,'same original typed cleanup can be explicitly continued');assert.equal(f.r.count(command),1);}
 {const f=await fixture();const d=defer();f.r.pause={method:command,...d};const work=f.remove(kind);await until(()=>f.r.durable.writes().some(c=>c.dispatched));f.index.nextNavigationGeneration();f.index.route='search';d.resolve();await work;assert.equal(f.receipt().receipt.confirmation,'confirmed','owner keeps accepted durable truth after route close');assert.equal(f.index.shelfOperation.removalKey,'');}
 {const f=await fixture();const d=defer();f.r.pause={method:command,...d};const work=f.remove(kind);await until(()=>f.r.durable.writes().some(c=>c.dispatched));currentOwner=rpc();d.resolve();await work;assert.equal(f.receipt(),undefined,'old runtime cannot deliver into new owner');}
}
{const f=await fixture();f.r.admission=true;await f.remove();assert.equal(f.receipt().receipt.confirmation,'undispatched');assert.equal(f.r.count('assets.release'),0);assert.equal(f.r.durable.writes().length,0,'transport seam rejected before the actual Core dispatch method was entered');}
{const f=await fixture();f.r.malformedBatch=true;await f.remove('batch');assert.equal(f.receipt().receipt.confirmation,'unknown');assert.equal(f.r.count('assets.release'),0,'partial/mismatched ACK cannot authorize resource release');await f.retry(f.render());assert.equal(f.receipt().receipt.confirmation,'confirmed','exact historical Core ACK qualifies the original batch independently of current rows');assert.equal(f.r.count('assets.release'),0);assert.equal(f.r.count('bookshelf.removeBatch'),1);}
{const f=await fixture();f.r.readFail=1;await f.remove();const notice=f.render();await f.remove();const count=f.r.calls.length;await f.retry(notice);assert.equal(f.r.calls.length,count,'captured old retry cannot cross operation identity');}
{const f=await fixture();f.r.readFail=1;await f.remove();const d=defer();f.r.pause={method:'bookshelf.list',...d};const pending=f.retry(f.render());await tick();f.index.route='search';f.index.nextNavigationGeneration();const before=clone(f.index.shelfBooks);d.resolve();await pending;assert.deepEqual(f.index.shelfBooks,before,'late read cannot replace a newer route projection');assert.equal(f.receipt().receipt.fact,'confirmedRefreshFailed','retired read keeps previous honest receipt');}
{const f=await fixture();f.r.readFail=1;await f.import();assert.equal(f.receipt().receipt.fact,'confirmedRefreshFailed');assert.equal(f.presentation().state,'result');assert.equal(f.presentation().batch.imported,1);await f.retry(f.importRender());assert.equal(f.r.count('import.persist'),1);assert.equal(f.r.count('bookshelf.add'),1);assert.equal(f.receipt().receipt.fact,'confirmedCurrent');}
for(const variant of ['lost','malformed','identicalOldRow']){const f=await fixture();if(variant==='identicalOldRow'){f.r.rows.push(book('c'));await f.r.durable.command('bookshelf.add',{sourceId:'local',bookId:'c',title:'c',author:'author'});}f.r.writeFail=variant!=='malformed';f.r.malformedAdd=variant==='malformed';await f.import();assert.equal(f.receipt().receipt.fact,'pendingReconciliation');assert.equal(f.presentation().batch.items[0].failure.code,'recoveryPending');assert.ok(f.index.shelfBooks.some(b=>b.bookId==='c'),'readable shelf remains available separately from unconfirmed command');assert.equal(f.r.count('import.finalize'),0);assert.equal(f.r.count('import.rollback'),0);assert.equal(f.r.count('assets.rollback'),0);await f.retry(f.importRender());assert.equal(f.r.count('bookshelf.add'),1);assert.equal(f.receipt().receipt.confirmation,'unknown');}
{const f=await fixture();f.r.selections.push({state:'failed',fileName:'bad.txt',failure:localImportFailure('read failed')});await f.import();assert.equal(f.presentation().batch.imported,1);assert.equal(f.presentation().batch.failed,1);assert.equal(f.receipt().receipt.confirmation,'confirmed');}
{const f=await fixture();const d=defer();f.r.pickerPause=d;f.index.openImportDialog();const old=f.index.beginImport();await until(()=>f.r.pickerStarted);f.index.closeImportDialog();f.index.openImportDialog();d.resolve();await old;assert.equal(f.r.count('import.persist'),0);assert.equal(f.r.count('discard'),1);assert.equal(f.presentation().state,'fileSelection');}
{const f=await fixture();const d=defer();f.r.pause={method:'bookshelf.add',...d};f.index.openImportDialog();const old=f.index.beginImport();await until(()=>f.r.calls.includes('bookshelf.add'));f.index.closeImportDialog();f.index.openImportDialog();d.resolve();await old;assert.equal(f.receipt().receipt.confirmation,'confirmed','closed import owner retains ACK without reopening old result');assert.equal(f.presentation().state,'fileSelection');}
{const f=await fixture();f.r.readFail=1;await f.import();const d=defer();f.r.pause={method:'bookshelf.list',...d};const old=f.retry(f.importRender());await tick();f.index.closeImportDialog();f.index.openImportDialog();d.resolve();await old;assert.equal(f.receipt().receipt.fact,'confirmedRefreshFailed');assert.equal(f.presentation().state,'fileSelection');assert.equal(f.r.count('bookshelf.add'),1);}

for(const kind of ['single','batch','detail']){const f=await fixture(),command=kind==='batch'?'bookshelf.removeBatch':'bookshelf.remove',d=defer();f.r.pause={method:command,...d};const accepted=f.remove(kind);await until(()=>f.r.durable.writes().some(c=>c.dispatched));currentOwner=undefined;assert.throws(()=>ReaderRuntimeOwner.current(),/installed by EntryAbility/);d.resolve();await assert.doesNotReject(accepted);assert.equal(f.r.count(command),1);assert.equal(f.receipt(),undefined,'retired runtime cannot present accepted ACK');assert.equal(f.owner().current().removalKey,'');assert.equal(f.owner().current().batchRemovalBusy,false);assert.equal(f.index.hasUnknownShelfWrite(),false);assert.equal(f.index.shelfRecovery().visible,false);}
{const f=await fixture();f.r.readFail=1;await f.remove();const d=defer();f.r.pause={method:'bookshelf.list',...d};const recovery=f.retry(f.render());await tick();currentOwner=undefined;d.resolve();await assert.doesNotReject(recovery);assert.equal(f.owner().current().reconcileBusy,false,'retired read settles its lock/finally');assert.equal(f.r.count('bookshelf.remove'),1);}
{const f=await fixture(),d=defer();f.r.pause={method:'bookshelf.add',...d};f.index.openImportDialog();const accepted=f.index.beginImport();await until(()=>f.r.calls.includes('bookshelf.add'));currentOwner=undefined;d.resolve();await assert.doesNotReject(accepted);assert.equal(f.r.count('bookshelf.add'),1);assert.equal(f.receipt(),undefined);assert.equal(f.owner().current().busy,false,'accepted import settles after runtime teardown without false failure UI');}

// Domain truth survives a real new Host/Index with the same exact Runtime.
// The picker may reconstruct Index; a user close/reopen still revokes its ID.
for(const stage of ['picker','mutation'])for(const closeReopen of [false,true]) {
 const old=await fixture(),gate=defer();if(stage==='picker')old.r.pickerPause=gate;else old.r.pause={method:'bookshelf.add',...gate};
 old.index.openImportDialog();const accepted=old.index.beginImport();await until(()=>stage==='picker'?old.r.pickerStarted:old.r.calls.includes('bookshelf.add'));const sameOwner=old.owner();
 old.index.shelfReceiptRetired=true;old.index.bookshelfHost.detachOperationPresentation();
 const fresh=await fixture({runtime:old.r,stored:old.serialized(),reconstruct:true});assert.equal(fresh.owner(),sameOwner,'actual new Host attaches same Runtime task/receipt owner');
 assert.equal(fresh.owner().current().busy,true);const count=old.r.count('bookshelf.add');await fresh.index.beginImport();assert.equal(old.r.count('bookshelf.add'),count,'reconstruction does not duplicate accepted write/picker');
 if(closeReopen){fresh.index.closeImportDialog();fresh.index.openImportDialog();}
 const oldShelf=clone(old.index.shelfBooks);gate.resolve();await accepted;await tick();
 assert.deepEqual(old.index.shelfBooks,oldShelf,'retired Index never installs new content');assert.equal(fresh.owner().current().busy,false);
 if(stage==='picker'&&closeReopen){assert.equal(old.r.count('import.persist'),0);assert.equal(old.r.count('discard'),1);}
 else {assert.equal(old.r.count('bookshelf.add'),1);assert.equal(fresh.receipt().receipt.confirmation,'confirmed');}
 assert.equal(fresh.presentation().state,closeReopen?'fileSelection':'result','only same live opening can show its batch');
 if(!closeReopen)assert.ok(fresh.index.shelfBooks.some(b=>b.bookId==='c'),'actual new Index subscriber consumes true batch and shelf projection');
}
// The old Index may still be alive when the replacement attaches. Its late
// restore, physical close and reopen cannot take the successor's exact lease.
for(const replaceAfterPicker of [false,true]) {
 const old=await fixture(),gate=defer();old.r.pickerPause=gate;
 old.index.openImportDialog();const accepted=old.index.beginImport();await until(()=>old.r.pickerStarted);
 const fresh=await fixture({runtime:old.r,stored:old.serialized(),reconstruct:true});
 const identity=fresh.presentation(),opening=fresh.index.shelfOperation.importIdentity;
 old.index.reconcileImportPresentation();old.index.closeImportDialog();old.index.openImportDialog();
 assert.equal(fresh.presentation(),identity);assert.equal(fresh.index.shelfOperation.importIdentity,opening);
 assert.equal(old.index.isCurrentImport(opening,old.index.navigationGeneration,old.r),false,'still alive older Index is retired by exact presentation instance');
 if(replaceAfterPicker){fresh.index.closeImportDialog();fresh.index.openImportDialog();}
 gate.resolve();await accepted;
 assert.equal(old.r.count('import.persist'),replaceAfterPicker?0:1);
 assert.equal(old.r.count('discard'),replaceAfterPicker?1:0);
 assert.equal(fresh.presentation().state,replaceAfterPicker?'fileSelection':'result');
 assert.equal(old.index.currentImportPresentation().state,'pickerOpening','alive old subscriber never installs successor result');
}
{
 const old=await fixture(),gate=defer();old.r.pickerPause=gate;old.index.openImportDialog();
 const accepted=old.index.beginImport();await until(()=>old.r.pickerStarted);
 old.index.shelfReceiptRetired=true;old.index.bookshelfHost.detachOperationPresentation();
 old.index.reconcileImportPresentation();gate.resolve();await accepted;
 assert.equal(old.r.count('import.persist'),0);assert.equal(old.r.count('discard'),1,'retired presentation without replacement releases unused input');
}
// Cold authority admission has not accepted a native picker yet. A fresh
// Index can attach while it is pending, but cannot lend its lease to A's call.
{
 const old=await fixture(),gate=defer();old.r.durable.options.readGate=gate;
 old.index.openImportDialog();const accepted=old.index.beginImport();
 await until(()=>old.r.durable.options.readEntered===true);
 old.index.shelfReceiptRetired=true;old.index.bookshelfHost.detachOperationPresentation();
 const freshWork=fixture({runtime:old.r,stored:old.serialized(),reconstruct:true});
 await until(()=>old.owner().isImportPresentationInstance(indexInstance));
 gate.resolve();await accepted;const fresh=await freshWork;
 assert.equal(old.r.pickerStarted,undefined);assert.equal(old.r.count('import.persist'),0);
 assert.equal(old.r.durable.writes().length,0);assert.equal(fresh.presentation().state,'fileSelection');
 await fresh.index.beginImport();assert.equal(old.r.pickerStarted,true,'current replacement may start its own original intent');
 assert.equal(old.r.count('import.persist'),1);
}
for(const kind of ['single','batch']) {
 const x=await fixture(),gate=defer(),command=kind==='single'?'bookshelf.remove':'bookshelf.removeBatch';x.r.pause={method:command,...gate};
 const accepted=x.remove(kind);await until(()=>x.r.durable.writes().some(c=>c.dispatched));x.index.route='bookshelf';x.index.openImportDialog();const calls=x.r.calls.length;
 x.index.removeShelfBook(x.index.shelfBooks[0]);await x.index.beginImport();assert.equal(x.r.calls.length,calls,'one Owner mutex covers removal/batch/import, including close/reopen');
 x.index.shelfReceiptRetired=true;x.index.bookshelfHost.detachOperationPresentation();const next=await fixture({runtime:x.r,stored:x.serialized()});
 assert.equal(next.owner(),x.owner());assert.equal(next.owner().current().busy,true);gate.resolve();await accepted;
 assert.equal(next.receipt().receipt.confirmation,'confirmed');assert.equal(next.owner().current().busy,false);
}
{const x=await fixture(),gate=defer();x.r.pause={method:'bookshelf.remove',...gate};const accepted=x.remove();await until(()=>x.r.durable.writes().some(c=>c.dispatched));
 x.index.shelfReceiptRetired=true;x.index.bookshelfHost.detachOperationPresentation();const fresh=await fixture();const before=clone(fresh.index.shelfOperation);
 gate.resolve();await accepted;assert.deepEqual(fresh.index.shelfOperation,before,'old accepted task does not publish into replacement Runtime lane');const current=fresh.owner();assert.notEqual(x.owner(),current);assert.equal(fresh.owner(),current,'late inspection of retired Host cannot replace current Runtime lane');}
{const x=await fixture();let reentered=0;x.owner().subscribe(snapshot=>{if(snapshot.busy&&reentered++===0)x.index.removeShelfBook(x.index.shelfBooks[0]);});await x.remove();assert.equal(x.r.count('bookshelf.remove'),1,'mutex precedes synchronous subscriber reentry');}
{const x=await fixture();x.owner().subscribe(()=>{throw Error('retired ArkUI publisher');});await x.remove();assert.equal(x.receipt().receipt.confirmation,'confirmed');assert.equal(x.r.count('bookshelf.remove'),1,'presentation/diagnostic exception never changes known ACK or replays write');}
for(const serialized of ['', 'invalid', '{}', JSON.stringify({state:'result',batch:{state:'completed',imported:2,failed:0,items:[{fileName:'a',state:'success'}]}})]){
 const x=await fixture({stored:serialized});assert.equal(x.presentation(),undefined);assert.equal(x.serialized(),'','invalid reconstructed result is atomically discarded by domain owner');
}
{const x=await fixture({stored:JSON.stringify({state:'result',batch:{state:'completed',imported:1,failed:0,items:[{fileName:'ack.txt',state:'success'}]}})});
 assert.equal(x.presentation().batch.imported,1);assert.equal(x.receipt(),undefined,'a restored UI result is not an ACK for a new mutation');assert.equal(x.r.count('bookshelf.add'),0);}
for(const state of ['pickerOpening','importing']){const x=await fixture({stored:JSON.stringify({state})});assert.equal(x.presentation().state,'fileSelection');assert.equal(x.owner().current().busy,false);assert.equal(x.receipt(),undefined);}
{const x=await fixture();x.index.openImportDialog();const props=x.renderIndex('localImportContent');
 const composition=boundedSurfaceSdk(),actor=composition.consumer(source('features/bookshelf/LocalImportDialog.ets'),['fileSelectionActions']);
 Object.assign(actor,props,{appThemeScheme:'day'});actor.fileSelectionActions();const oldButtons=composition.nodes(actor).filter(n=>n.onClick);
 assert.ok(oldButtons.length>=2,'actual SDK shared primary+cancel native inputs');x.index.closeImportDialog();x.index.openImportDialog();
 const id=x.index.shelfOperation.importIdentity,before=x.r.calls.length;for(const node of oldButtons)node.onClick();await tick();
 assert.equal(x.index.shelfOperation.importIdentity,id);assert.equal(x.presentation().state,'fileSelection');assert.equal(x.r.calls.length,before,'actual old leaf physical callbacks cannot choose or close successor opening');
 const freshProps=x.renderIndex('localImportContent'),fresh=composition.consumer(source('features/bookshelf/LocalImportDialog.ets'),['fileSelectionActions']);
 Object.assign(fresh,freshProps,{appThemeScheme:'day'});fresh.fileSelectionActions();const cancel=composition.nodes(fresh).find(n=>n.type==='Row'&&n.height===44&&n.border&&n.onClick);
 assert.ok(cancel);cancel.onClick();assert.equal(x.presentation(),undefined,'current shared native action can close live opening');
 x.index.openImportDialog();const original=x.index.isCurrentImport;x.index.isCurrentImport=()=>true;oldButtons.find(n=>n.border).onClick();assert.equal(x.presentation(),undefined,'negative control: removing captured opening guard allows old physical cancel to close successor');x.index.isCurrentImport=original;
}
console.log('Bookshelf/import actual gateway → finite Host owner → Index → SDK notice/actions: PASS (ACK/read/cleanup/unknown/admission/partial/only-read, close/reopen, same-Runtime Index reconstruction, retired Runtime inspection, concurrency/reentry, actual old physical callbacks and negative control).');

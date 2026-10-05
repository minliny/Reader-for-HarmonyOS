import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {removalFixture} from './lib/bookshelf-removal-durable-probe.mjs';
import {read,deferred,until} from './lib/bookshelf-management-durable-probe.mjs';
import {actualBookshelfHostField} from './lib/bookshelf-operation-owner-probe.mjs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedMembers,boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {readerRecoveryView} from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
const require=createRequire(import.meta.url),sdkRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax=require(sdkRoot+'/lib/validate_ui_syntax.js');
syntax.componentCollection.customComponents.add('BookshelfShell');
syntax.propCollection.set('BookshelfShell',new Set([...read('features/bookshelf/BookshelfShell.ets').matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>m[1])));
syntax.builderParamObjectCollection.set('BookshelfShell',new Set(['content']));
require(sdkRoot+'/lib/component_map.js').CUSTOM_BUILDER_METHOD.add('bookshelfContent');
for(const [name,path] of [['MainTabShell','features/shell/MainTabShell.ets'],['AppTopBar','features/common/AppTopBar.ets'],['ReaderIconButton','features/common/ReaderIconButton.ets'],['BookshelfMoreMenu','features/bookshelf/BookshelfMoreMenu.ets']]) {
 const text=read(path);syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...text.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>m[1])));
 syntax.builderParamObjectCollection.set(name,new Set([...text.matchAll(/@BuilderParam\s+(\w+)/g)].map(m=>m[1])));
}
let cases=0;
const target=bookId=>({sourceId:'local',bookId});
async function seed(f){for(const bookId of ['a','b'])await f.command('bookshelf.add',{...target(bookId),title:bookId,author:'作者'});}
const methods=['shelfRecovery','hasUnknownShelfWrite','canContinueShelfRemoval','continueShelfRemoval','reconcileShelfWrite',
 'registerTemporaryBackBridge','emptyShelfRecovery','isCurrentBookshelfPresentation','hasVisibleImportDialog','shelfFilter','isCurrentRuntime'];
function makeIndex(f) {
 const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),methods,
   {...f,ReaderRuntimeOwner:f.Runtime,BookshelfHost:f.Host,readerRecoveryView});
 const index=new Index();let publications=0;
 Object.assign(index,{mountedRuntimeOwner:f.runtime,shelfOperationOwner:f.runtime,shelfReceiptRetired:false,route:'bookshelf',navigationGeneration:1,
  detailShelfAdmissionMount:1,settingsSnapshot:{reduceMotion:false},shelfProjectionRevision:'',shelfBooks:[],isBookshelfVisualAdmitted:true,shelfHasOnlineBooks:false,shelfReadingFilter:'all',shelfSourceFilter:'all',shelfContentFilter:'all',shelfOperation:{...f.EMPTY_BOOKSHELF_OPERATION_SNAPSHOT},
  invalidateBookshelfProjection:()=>publications++,applyBookshelfState:value=>{index.acceptedShelf=value;},shelfReadRecovery:()=>index.emptyShelfRecovery()});
 index.bookshelfHost=actualBookshelfHostField(index,f.Host,{setOrCreate(){}});const owner=index.bookshelfHost.operations(f.runtime);
 index.shelfOperation=owner.current();
 return{index,owner,publications:()=>publications};
}
class ShellChild{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
function render(f,index) {
 const parent=createReaderBuilderProbe(read('pages/Index.ets'),['bookshelfShellContent'],{BookshelfShell:ShellChild,ReaderRuntimeOwner:f.Runtime});
 const i=parent.owner;
 Object.assign(i,index);for(const name of [...methods,'shelfReadRecovery'])i[name]=index[name].bind(index);
 i.bookshelfShellContent();const params=[...i.children.values()].find(c=>c instanceof ShellChild).params;
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const shell=sdk.consumer(read('features/bookshelf/BookshelfShell.ets'),boundedMembers(read('features/bookshelf/BookshelfShell.ets')),
  {bookshelfTemporaryGeneration:0,registerReaderShelfFonts:()=>{},...metricsApi,ReaderWindowCoordinator:{metrics:metricsApi.createDefaultReaderWindowMetrics}},params);
 shell.aboutToAppear();shell.recoveryNoticeContent(shell.recovery,false);
 const nodes=()=>sdk.nodes(shell),action=label=>nodes().find(n=>n.type==='Text'&&n.create===label&&n.height===36);
 return{parent,params,sdk,shell,nodes,action};
}
async function unknown(before=true) {
 const f=await removalFixture();await seed(f);f.options[before?'beforeMethod':'afterMethod']='bookshelf.remove';await f.flow.remove('local','a');
 const cold=await removalFixture({root:f.root,uuid:f.uuid()}),view=makeIndex(cold);
 await view.owner.recoverRemoval({readingState:'all',sourceKind:'all'},()=>true);
 return{f:cold,...view,original:JSON.parse(cold.disk())};
}
{
 const f=await unknown(),p=render(f.f,f.index);
 assert.equal(f.index.shelfOperation.receipt.receipt.confirmation,'unknown');assert.equal(f.index.hasUnknownShelfWrite(),true);
 assert.ok(f.index.shelfOperation.receipt.value.shelf.books.some(b=>b.bookId==='a'),'unknown original delete does not suppress usable current book');
 assert.match(p.params.recovery.message,/原删除/);assert.equal(p.params.canContinueRemoval,true);
 const readAction=p.action('刷新列表'),continueAction=p.action('继续原删除操作');assert.ok(readAction);assert.ok(continueAction);
 readAction.onClick();await until(()=>!f.owner.current().reconcileBusy);assert.equal(f.f.writes().length,0);assert.equal(f.f.cleanup.length,0);
 const actor=p.sdk.walk(p.shell).find(c=>c instanceof p.sdk.deps.ReaderRecoveryAction&&c.label==='继续原删除操作');
 assert.ok(actor);continueAction.onClick();continueAction.onClick();await until(()=>!f.owner.current().busy);
 assert.equal(f.f.writes().length,1);assert.equal(f.f.writes()[0].params.operationId,f.original.operationId);assert.deepEqual(f.f.writes()[0].params.mutation,f.original.mutation);
 assert.deepEqual(f.f.cleanup,['a']);assert.equal(f.index.shelfOperation.receipt.receipt.confirmation,'confirmed');assert.equal(f.index.hasUnknownShelfWrite(),false);
 assert.equal(f.index.acceptedShelf.shelf.books.some(b=>b.bookId==='a'),false);assert.equal(f.f.disk(),'');cases++;
}
{
 const f=await unknown(false),p=render(f.f,f.index);assert.equal(f.index.shelfOperation.receipt.receipt.confirmation,'confirmed');
 assert.equal(f.index.hasUnknownShelfWrite(),true,'confirmed Core with retained cleanup still blocks unrelated mutation');
 assert.ok(p.action('完成原删除清理'));const writes=f.f.writes().length;p.action('刷新列表').onClick();await until(()=>!f.owner.current().reconcileBusy);
 assert.equal(f.f.cleanup.length,0);assert.equal(f.f.writes().length,writes);
 p.action('完成原删除清理').onClick();await until(()=>!f.owner.current().busy);assert.deepEqual(f.f.cleanup,['a']);assert.equal(f.f.writes().length,writes);cases++;
}
for(const retire of ['nav','mount','closed','runtime']) {
 const f=await unknown(),p=render(f.f,f.index),native=p.action('继续原删除操作').onClick;
 if(retire==='nav')f.index.navigationGeneration++;
 if(retire==='mount')f.index.detailShelfAdmissionMount++;
 if(retire==='closed')f.index.shelfReceiptRetired=true;
 if(retire==='runtime')f.f.retire();
 const reads=f.f.calls.length;native();await new Promise(r=>setTimeout(r,15));assert.equal(f.f.calls.length,reads);assert.equal(f.f.cleanup.length,0);assert.notEqual(f.f.disk(),'');cases++;
}
{
 const f=await unknown(),p=render(f.f,f.index),oldAction=p.action('继续原删除操作').onClick,
   actor=p.sdk.walk(p.shell).find(c=>c instanceof p.sdk.deps.ReaderRecoveryAction&&c.label==='继续原删除操作');
 oldAction();await until(()=>!f.owner.current().busy);assert.equal(f.f.writes().length,1);
 f.f.options.beforeMethod='bookshelf.remove';await f.owner.remove([target('b')],false,{readingState:'all',sourceKind:'all'},()=>true);
 await f.owner.reconcile(f.owner.current().generation,{readingState:'all',sourceKind:'all'},()=>true);
 const generation=f.owner.current().generation;assert.notEqual(generation,f.original.sequence);
 const count=f.f.writes().length;actor.updateStateVars({variant:'compact',label:'继续原删除操作',generation,actionEnabled:true});
 oldAction();await new Promise(r=>setTimeout(r,15));assert.equal(f.f.writes().length,count,'actual V1 retained Prop update cannot upgrade old physical A callback to B');
 const fresh=render(f.f,f.index);fresh.action('继续原删除操作').onClick();await until(()=>!f.owner.current().busy);
 assert.equal(f.f.writes().length,count+1);assert.equal(f.f.writes().at(-1).params.mutation.params.bookId,'b');cases++;
}
{
 const f=await unknown(),p=render(f.f,f.index),gate=deferred();f.f.options.pauseMethod='bookshelf.remove';f.f.options.gate=gate;
 p.action('继续原删除操作').onClick();await until(()=>f.f.writes().some(c=>c.dispatched));
 f.index.shelfReceiptRetired=true;f.index.bookshelfHost.detachOperationPresentation();const replacement=makeIndex(f.f);
 assert.equal(replacement.owner,f.owner,'same Runtime replacement uses accepted mutex and receipt owner');assert.equal(replacement.owner.current().busy,true);
 const reads=f.f.calls.length;await replacement.owner.recoverRemoval({readingState:'all',sourceKind:'all'},()=>true);assert.equal(f.f.calls.length,reads);
 gate.resolve();await until(()=>!replacement.owner.current().busy);assert.equal(replacement.index.shelfOperation.receipt.receipt.confirmation,'confirmed');
 assert.equal(f.f.writes().length,1,'reconstruction never dispatches a second delete');cases++;
}
{
 const f=await removalFixture();await seed(f);f.options.beforeMethod='book-group.create';await assert.rejects(f.gateway.createGroup('原分组',0));
 const cold=await removalFixture({root:f.root,uuid:f.uuid()}),v=makeIndex(cold);await v.owner.recoverRemoval({readingState:'all',sourceKind:'all'},()=>true);
 const p=render(cold,v.index);assert.equal(v.index.hasUnknownShelfWrite(),true);assert.equal(p.params.canContinueRemoval,false);assert.equal(p.params.recovery.canRetry,false);
 assert.match(p.params.recovery.message,/原分组/);assert.equal(p.action('继续原删除操作'),undefined);assert.equal(cold.writes().length,0);cases++;
}
// Real retained Shell receives a newer navigation Prop. Its old native actor
// keeps the immutable old navigation and cannot cross that presentation.
{
 const f=await unknown(),p=render(f.f,f.index),native=p.action('继续原删除操作').onClick;
 f.index.navigationGeneration++;
 p.shell.updateStateVars({...p.params,navigationGeneration:f.index.navigationGeneration});
 native();await new Promise(r=>setTimeout(r,15));assert.equal(f.f.writes().length,0);cases++;
}
// The cold original-intent read is before native picker admission. Closing A
// and opening B while that read is pending must not lend B's presentation to
// A's original import intent. The picker itself is the bounded native seam.
{
 const f=await removalFixture(),gate=deferred(),owner=new f.BookshelfOperationOwner(f.runtime);let picks=0;
 f.BookshelfFlowGateway.prototype.selectLocalBookInputs=async()=>{picks++;return[];};
 owner.openImport(()=>true);const original=owner.current().importIdentity;
 f.options.readGate=gate;const work=owner.importFiles({readingState:'all',sourceKind:'all'},()=>true);
 await until(()=>f.options.readEntered===true);owner.closeImport();owner.openImport(()=>true);
 const replacement=owner.current().importIdentity;assert.notEqual(replacement,original);gate.resolve();await work;
 assert.equal(picks,0,'A cold preflight cannot borrow reopened B picker admission');
 assert.equal(owner.current().importIdentity,replacement);assert.equal(owner.current().importPresentation.state,'fileSelection');
 await owner.importFiles({readingState:'all',sourceKind:'all'},()=>true);assert.equal(picks,1,'current B still admits its native picker');
 assert.equal(f.writes().length,0);cases++;
}
console.log(`PASS bookshelf deletion Index→actual decorated Shell/Notice/Action and cold import admission: ${cases} groups`);

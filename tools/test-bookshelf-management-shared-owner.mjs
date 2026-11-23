import { managementFixture } from './lib/bookshelf-management-durable-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {bookshelfDialogPresentationFixture as dialogFixture,indexSource,defer,bookshelfDialogSdk as sdk} from './lib/bookshelf-dialog-presentation-sdk.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {readerRecoveryView} from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
import * as facts from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {ReaderWriteEvidence} from '../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {ReaderNavigation} from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import {installedEtsCompiler} from './lib/ets-compiler-runtime.mjs';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const compile=(p,n,deps,text=source(p))=>new Function(...Object.keys(deps),stripTypeScriptTypes(text.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export \{[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''))+`;return ${n};`)(...Object.values(deps));
const projectPersistedReceipt=compile('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
const ReaderLibraryJourney=compile('app/composition/ReaderLibraryJourney.ts','ReaderLibraryJourney',{});
const managementPresentationSource=source('features/bookshelf/presentation/BookshelfManagementPresentation.ets');
const book=id=>({sourceId:'s',bookId:id,title:id,author:'author',addedAt:1,sortIndex:0,group:'old'});
const until=async(fn)=>{for(let i=0;i<200&&!fn();i++)await new Promise(r=>setTimeout(r,2));assert.ok(fn(),'actual async boundary reached');};
let cases=0;
const nativeAction=(owner,label)=>{const actor=sdk.walk(owner).findLast(c=>c.label===label);return actor&&sdk.nodes(actor).find(n=>n.onClick);};
async function fixture(text=indexSource,gatewayText=source('features/bookshelf/application/BookshelfManagementGateway.ts'),existing){
 const f=dialogFixture(text),r=f.r,actual=await managementFixture(existing,r,gatewayText),Runtime=actual.Runtime;
 if(!existing){for(const input of [book('a'),book('b')])await actual.command('bookshelf.add',{sourceId:input.sourceId,bookId:input.bookId,title:input.title,author:input.author});
 await actual.command('book-group.create',{groupName:'old',order:0,enableRefresh:true,show:true});
 for(const id of ['a','b'])await actual.command('bookshelf.group.assign',{sourceId:'s',bookId:id,group:'old'});}
 const sync=async()=>{const books=(await actual.command('bookshelf.list',{})).data.books;r.books=['a','b'].map(id=>books.find(b=>b.bookId===id));r.groups=(await actual.command('book-group.list',{})).data.groups;};await sync();
 const request=r.request.bind(r);Object.assign(r,{calls:actual.calls,lost:'',lostBefore:'',readFailure:'',wait:undefined,malformed:false});
 r.request=async(method,params={},options={})=>{
  const original=method==='bookshelf.management.mutation.apply'?params.mutation.method:method;
  if(r.wait?.method===original){actual.options[r.wait.stage==='before'?'beforeStart':'pauseMethod']=original;actual.options.gate=r.wait;r.wait=undefined;}
  if(r.lost===original){actual.options.afterMethod=original;r.lost='';}
  if(r.lostBefore===original){actual.options.beforeMethod=original;r.lostBefore='';}
  if(r.readFailure===method){actual.options.beforeMethod=method;r.readFailure='';}
  if(r.malformed&&method==='bookshelf.management.mutation.apply'){actual.options.transformMethod=original;actual.options.transform=receipt=>{const changed=structuredClone(receipt);changed.data.book.bookId='wrong';return changed;};}
  try{return await request(method,params,options);}finally{if(method==='bookshelf.management.mutation.apply')await sync();}
 };
 const {Host,Orchestrator}=actual;
 const attach=(presentation,current)=>new Host(snapshot=>presentation.accept(snapshot),current,()=>r);
 const attachGroup=({presentation,i})=>{const host=new Host(snapshot=>{presentation.snapshot=snapshot;},()=>i.route==='bookshelf',()=>r);presentation.host=host;return host;};
 const host=attachGroup(f);const owner=()=>host.managementOrchestrator;
 const notice=()=>nativeAction(f.group().dialog,'核对分组');
 return{...f,...actual,r,host,Host,Orchestrator,Runtime,attach,attachGroup,owner,notice,settle:async()=>{await owner()?.operationTail;await Promise.resolve();await Promise.resolve();},
  writes:()=>actual.writes().filter(c=>c.dispatched).map(c=>({method:c.params.mutation.method,params:c.params.mutation.params,cancel:c.options.shouldCancel})),
  retire:()=>{actual.retire();f.retire();}};
}
{
 const f=await fixture(),b=f.r.books[0];f.i.openShelfGroup(b);await f.settle();f.group().select.onClick();await f.settle();
 assert.equal(f.writes().length,1);assert.deepEqual(f.writes()[0].params,{sourceId:'s',bookId:'a',group:''});
 assert.equal(f.writes()[0].cancel,undefined,'accepted mutation has no UI cancellation');assert.equal(f.r.books[0].group??'','');
 assert.equal(f.presentation.book,undefined);assert.equal(f.refresh(),1);assert.equal(f.owner().currentSnapshot().receipt.receipt.fact,'confirmedCurrent');cases++;
}
for(const fail of['read','lost','lostBefore','malformed']){
 const f=await fixture(),b=f.r.books[0];f.i.openShelfGroup(b);await f.settle();
 if(fail==='read')f.r.readFailure='book-group.list';if(fail==='lost')f.r.lost='bookshelf.group.assign';if(fail==='lostBefore')f.r.lostBefore='bookshelf.group.assign';if(fail==='malformed')f.r.malformed=true;
 f.group().select.onClick();await f.settle();assert.equal(f.writes().length,1);
 if(fail==='read'){
  assert.equal(f.presentation.book,undefined,'confirmed assignment closes to prevent a duplicate save after readback failure');
  assert.equal(f.owner().currentSnapshot().receipt.receipt.confirmation,'confirmed');
  assert.equal(f.owner().currentSnapshot().receipt.receipt.fact,'confirmedRefreshFailed');
  assert.deepEqual(f.toasts,['分组已保存，列表刷新失败']);
  assert.equal(f.refresh(),1,'confirmed assignment dispatches the stable bookshelf read entry');
  assert.equal(f.notice(),undefined,'no pending notice is rendered for a known saved result');
  f.i.refreshBookshelf();assert.equal(f.writes().length,1,'stable refresh is read-only');cases++;continue;
 }
 assert.equal(f.raw(f.presentation.book),b);
 const receipt=f.presentation.snapshot.receipt;assert.equal(receipt.receipt.confirmation,fail==='read'?'confirmed':'unknown');
 const n=f.notice();assert.ok(n?.onClick,'actual shared Notice/Action native read-only recovery');n.onClick();n.onClick();await f.settle();
 assert.equal(f.writes().length,1,'double read recovery never repeats group write');
 assert.equal(f.presentation.snapshot.receipt.receipt.fact,fail==='lostBefore'?'pendingReconciliation':'confirmedCurrent');
 if(fail==='lostBefore'){f.group().select.onClick();await f.settle();assert.equal(f.writes().length,1,'unknown current entity cannot unlock write');}
 assert.equal(f.toasts.length,0,'no misleading write-failed toast after confirmed save');cases++;
}
for(const stage of['before','after']){
 const f=await fixture(),b=f.r.books[0],gate=defer();f.i.openShelfGroup(b);await f.settle();const old=f.group();f.r.wait={method:'bookshelf.group.assign',stage,...gate};
 old.select.onClick();await until(()=>stage==='before'?f.owner().writeReserved:f.writes().length===1);
 const oldOwner=f.owner(),oldTail=oldOwner.operationTail,oldGateway=oldOwner.gateway,oldSnapshot=structuredClone(f.raw(f.presentation.snapshot));
 const next=dialogFixture(indexSource,f.r),replacementBook=f.r.books[1];Object.assign(next.i,{mountedRuntimeOwner:f.r,rssInstanceIdentity:22});f.attachGroup(next);next.i.openShelfGroup(replacementBook);
 assert.equal(next.presentation.host.managementOrchestrator,oldOwner);assert.equal(oldOwner.gateway,oldGateway,'replacement adds a read behind the same original write authority');
 old.select.onClick();f.host.bindManagement(f.r,f.presentation.identity,()=>false);
 assert.equal(oldOwner.isPresentationCurrent(next.presentation.identity),true,'stale attach cannot steal successor');
 f.host.detachManagementPresentation();gate.resolve();await oldTail;await f.settle();
 assert.deepEqual(f.raw(f.presentation.snapshot),oldSnapshot);assert.equal(f.writes().length,stage==='before'?0:1);
 assert.equal(next.raw(next.presentation.book),replacementBook);assert.equal(next.refresh(),0);
 if(stage==='after')assert.equal(next.presentation.snapshot.receipt.receipt.confirmation,'confirmed','actual old ACK settles domain truth for same Runtime successor');
 cases++;
}
for(const command of['create','update','show','delete','assign']){
 const f=await fixture();let snap;const o=new f.Orchestrator(s=>snap=s,()=>true,f.r);o.open();await o.operationTail;
 if(command==='create'){o.updateGroupName('new');o.saveGroup();o.saveGroup();}
 if(command==='update'){o.selectGroup(1);o.updateGroupName('renamed');o.saveGroup();o.saveGroup();}
 if(command==='show'){o.toggleGroupShown(1);o.toggleGroupShown(1);}
 if(command==='delete'){o.deleteGroup(1);o.deleteGroup(1);}
 if(command==='assign'){o.selectBook('s','a');o.updateAssignmentGroup('new');o.assignSelectedBook();o.assignSelectedBook();}
 await o.operationTail;assert.equal(f.writes().length,1,`${command} original management actor has one reserved write`);assert.equal(snap.receipt.receipt.confirmation,'confirmed');
 const method=f.writes()[0].method;f.r.lost=method;
 if(command==='create'){o.updateGroupName('second');o.saveGroup();}if(command==='update'){o.selectGroup(1);o.updateGroupName('second');o.saveGroup();}if(command==='show'){o.toggleGroupShown(1);}if(command==='delete'){o.deleteGroup(1);}if(command==='assign'){o.assignSelectedBook();}
 await o.operationTail;assert.equal(snap.receipt.receipt.confirmation,'unknown');const count=f.writes().length;o.saveGroup();o.deleteGroup(9);o.assignSelectedBook();await o.operationTail;assert.equal(f.writes().length,count,'every management mutation shares unknown barrier before exact query');o.reconcile(snap.receipt.facts.generation);await o.operationTail;assert.equal(snap.receipt.receipt.confirmation,'confirmed','actual exact receipt clears unknown, rather than matching current list');assert.equal(f.writes().length,count,'qualified original query stays read-only');cases++;
}
{
 const f=await fixture(),b=f.r.books[0],gate=defer();f.i.openShelfGroup(b);await f.settle();f.r.wait={method:'bookshelf.group.assign',stage:'after',...gate};f.group().select.onClick();await until(()=>f.writes().length===1);
 const prior=structuredClone(f.raw(f.presentation.snapshot));f.retire();gate.resolve();await f.settle();assert.deepEqual(f.raw(f.presentation.snapshot),prior);assert.equal(f.owner().currentSnapshot().receipt.receipt.confirmation,'confirmed');cases++;
}
function managementScene(f){
 const pageSource=source('features/bookshelf/ui/BookshelfManagementPage.ets');
 const surfaceSource=source('features/bookshelf/ui/BookshelfManagementSurface.ets');
 const {require,root:loader}=installedEtsCompiler();
 require(loader+'/lib/validate_ui_syntax.js').observedClassCollection.add('BookshelfManagementPresentation');
 const Presentation=compile('features/bookshelf/presentation/BookshelfManagementPresentation.ets','BookshelfManagementPresentation',
  {EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT:f.EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT},managementPresentationSource.replace(/^@Observed\s*/gm,''));
 const presentation=sdk.properties.sdk.ObservedObject.createNew(new Presentation(),undefined);
 const navigation=new ReaderNavigation();
 const scope={owner:f.r,instance:Math.random(),mounting:1,retired:false,inputAllowed:true};
 const host=f.attach(presentation,()=>navigation.snapshot().route==='bookshelfManagement');
 const journey=new ReaderLibraryJourney(navigation,{
  scope:()=>scope,ownsRuntime:owner=>f.Runtime.isCurrent(owner),shelfHost:()=>host,management:()=>presentation,
  reading:()=>({endReading(){}}),advance:()=>navigation.advance().generation,publish() {},
 });
 // Entry identity, binding, reads and late-action admission are the actual
 // Journey/Presentation flow; only root lifecycle and navigation outlets stop here.
 journey.openBookshelfManagement();
 class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
 let back=0;
 const owner=host.managementOrchestrator;
 const actualPage=()=>{
  const surface=createReaderBuilderProbe(surfaceSource,boundedMembers(surfaceSource),
   {...sdk.deps,SynchedPropertyNesedObjectPU:sdk.properties.sdk.SynchedPropertyNestedObjectPU,BookshelfManagementPage:Child},
   {...sdk.hooks,initialParams:{presentation,onBack:()=>back++},childSources:{BookshelfManagementPage:pageSource}}).owner;
  surface.initialRender();const props=[...surface.children.values()].at(-1).params;
  const toasts=[],storage=new Map();
  const ReaderTransientFeedback=compile('ui/feedback/ReaderTransientFeedback.ts','ReaderTransientFeedback',{
   AppStorage:{get:key=>storage.get(key),setOrCreate(key,value){storage.set(key,value);if(key==='readerTransientToast'&&value.visible)toasts.push(value.message);}},
  });
  const page=sdk.consumer(pageSource,boundedMembers(pageSource),{EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT:f.EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT,
   ReaderTransientFeedback,readerRecoveryView,InputType:{Number:1}},props);
  page.getUIContext=()=>({});page.feedbackMounted=true;
  page.onSnapshotChanged();page.groupEditorCard();page.pendingOverlay();
  return{page,props,toasts,save:nativeAction(page,'创建')};
 };
 return{presentation,journey,owner,actualPage,back:()=>back,open:async()=>{await owner.operationTail;}};
}
{
 const f=await fixture(),x=managementScene(f);await x.open();const old=x.actualPage(),next=managementScene(f);
 assert.equal(x.owner,next.owner);const id=next.presentation.identity;
 assert.equal(x.presentation.host(x.presentation.identity),undefined,'alive old presentation cannot reattach');
 assert.equal(x.owner.isPresentationCurrent(id),true,'retained old host lookup does not steal the successor');
 old.props.onGroupNameChanged('old');old.save.onClick();old.props.onDeleteGroup(1);old.props.onAssignBook();old.props.onBack();await x.owner.operationTail;
 assert.equal(f.writes().length,0);assert.equal(x.back(),0);
 await next.open();const live=next.actualPage();live.props.onGroupNameChanged('native');live.save.onClick();live.save.onClick();await next.owner.operationTail;
 assert.equal(f.writes().length,1);assert.equal(f.r.groups.at(-1).groupName,'native');cases++;
}
{
 const f=await fixture(),x=managementScene(f);await x.open();const p=x.actualPage();p.props.onGroupNameChanged('truth');f.r.readFailure='book-group.list';p.save.onClick();await x.owner.operationTail;
 assert.equal(x.presentation.snapshot.receipt.receipt.fact,'confirmedRefreshFailed');
 const actual=x.actualPage();assert.equal(nativeAction(actual.page,'核对操作结果'),undefined,'known saved/read failure stays Toast');assert.match(actual.toasts[0],/保存|刷新/);
 actual.props.onReconcile(x.presentation.snapshot.receipt.facts.generation);await x.owner.operationTail;
 assert.equal(f.writes().length,1);assert.equal(x.presentation.snapshot.receipt.receipt.fact,'confirmedCurrent');cases++;
}
{
 const original=source('features/bookshelf/application/BookshelfManagementGateway.ts');
 const mutant=original.replace('ReaderRuntimeOwner.isCurrent(this.owner) && (admitted?.() ?? true)','true');assert.notEqual(mutant,original);
 const f=await fixture(indexSource,mutant),gate=defer();f.i.openShelfGroup(f.r.books[0]);await f.settle();f.r.wait={method:'bookshelf.group.assign',stage:'before',...gate};f.group().select.onClick();
 await until(()=>f.owner().writeReserved);f.i.closeShelfGroup();gate.resolve();await f.settle();
 assert.equal(f.writes().length,1,'removing actual last dispatch lease lets retired group mutate after startup gate');cases++;
}

{
 const f=await fixture(),b=f.r.books[0];f.i.openShelfGroup(b);await f.settle();f.r.lostBefore='bookshelf.group.assign';f.group().select.onClick();await f.settle();
 const original=JSON.parse(f.disk()),cold=await fixture(indexSource,source('features/bookshelf/application/BookshelfManagementGateway.ts'),{root:f.root,uuid:f.uuid()}),x=managementScene(cold);
 await x.open();assert.equal(x.presentation.snapshot.managementMutation.canContinueOriginal,true);
 const actual=x.actualPage(),old=nativeAction(actual.page,'继续原分组操作');
 assert.ok(old,'cold original intent is consumed by an actual SDK shared RecoveryAction');
 const query=nativeAction(actual.page,'核对操作结果');assert.ok(query);query.onClick();await x.owner.operationTail;
 assert.equal(cold.writes().length,0,'original native reconcile always remains query-only');
 actual.page.updateStateVars({...actual.props,snapshot:x.presentation.snapshot});actual.page.pendingOverlay();
 const current=nativeAction(actual.page,'继续原分组操作');assert.notEqual(current,old);
 old.onClick();await x.owner.operationTail;assert.equal(cold.writes().length,0,'retained old physical action cannot borrow new generation');
 current.onClick();current.onClick();await x.owner.operationTail;
 assert.equal(cold.writes().length,1);const write=cold.calls.find(c=>c.method==='bookshelf.management.mutation.apply'&&c.dispatched);
 assert.equal(write.params.operationId,original.operationId);assert.deepEqual(write.params.mutation,original.mutation);
 assert.equal(x.presentation.snapshot.receipt.receipt.confirmation,'confirmed');assert.equal(x.presentation.snapshot.mutationBlocked,false);cases++;
}
{
 const f=await fixture(),b=f.r.books[0];f.i.openShelfGroup(b);await f.settle();f.r.lostBefore='bookshelf.group.assign';f.group().select.onClick();await f.settle();
 const cold=await fixture(indexSource,source('features/bookshelf/application/BookshelfManagementGateway.ts'),{root:f.root,uuid:f.uuid()});
 cold.i.openShelfGroup(cold.r.books[1]);await cold.settle();const owner=cold.owner();
 assert.equal(sdk.walk(cold.group().dialog).filter(c=>c.label==='继续原分组操作').length,0,
  'a pending assignment of book A cannot present a write continuation as book B');
 cold.presentation.retire();cold.i.openShelfGroup(cold.r.books[0]);await cold.settle();
 assert.equal(cold.presentation.canContinue(cold.presentation.snapshot.receipt.facts.generation),true,'exact original book A remains eligible');
 assert.equal(cold.writes().length,0);cases++;
}
{
 const f=await fixture(),b=f.r.books[0];f.i.openShelfGroup(b);await f.settle();f.r.lostBefore='bookshelf.group.assign';f.group().select.onClick();await f.settle();
 const x=managementScene(f);await x.open();const old=x.actualPage();const oldNative=nativeAction(old.page,'继续原分组操作');assert.ok(oldNative);
 const replacement=managementScene(f);await replacement.open();oldNative.onClick();old.props.onContinueOriginal(x.presentation.snapshot.receipt.facts.generation);await x.owner.operationTail;
 assert.equal(f.writes().length,1,'only original failed admission was dispatched, no stale page continuation');
 const live=replacement.actualPage(),native=nativeAction(live.page,'继续原分组操作');assert.ok(native);native.onClick();await replacement.owner.operationTail;
 assert.equal(f.writes().length,2,'current replacement page explicitly continues original complete DTO');cases++;
}
{
 const f=await fixture(),x=managementScene(f);await x.open();f.options.loseFinishAt=2;const p=x.actualPage();p.props.onGroupNameChanged('终态');p.save.onClick();await x.owner.operationTail;
 assert.equal(x.presentation.snapshot.receipt.receipt.confirmation,'confirmed');assert.equal(x.presentation.snapshot.mutationBlocked,true);
 const recovery=x.actualPage();assert.match(recovery.page.recovery().message,/已确认.*记录清理尚未确认/);
 const native=nativeAction(recovery.page,'核对操作结果');assert.ok(native,'confirmed Core ACK with unsettled local cleanup still has pure recovery');
 native.onClick();await x.owner.operationTail;assert.equal(f.writes().length,1);assert.equal(x.presentation.snapshot.mutationBlocked,false);cases++;
}

console.log(`PASS ${cases} actual Bookshelf Host→shared Management Orchestrator→actual Gateway/Core decoding→Library Journey/Management Presentation/Surface→full SDK group Selector/Notice/Recovery: exact tuple/last dispatch/ACK/read failure/unknown/5-write mutex/current entity does not ACK/remount/late/Runtime.`);

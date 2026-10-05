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
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const compile=(p,n,deps,text=source(p))=>new Function(...Object.keys(deps),stripTypeScriptTypes(text.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export \{[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''))+`;return ${n};`)(...Object.values(deps));
const projectPersistedReceipt=compile('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
const book=id=>({sourceId:'s',bookId:id,title:id,author:'author',addedAt:1,sortIndex:0,group:'old'});
const until=async(fn)=>{for(let i=0;i<200&&!fn();i++)await new Promise(r=>setTimeout(r,2));assert.ok(fn(),'actual async boundary reached');};
let cases=0;
async function fixture(text=indexSource,gatewayText=source('features/bookshelf/BookshelfManagementGateway.ts'),existing){
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
 const attach=(index)=>{const host=new Host(snapshot=>{index.bookshelfManagementSnapshot=snapshot;},()=>index.route==='bookshelfManagement',()=>r);index.bookshelfHost=host;return host;};
 const host=attach(f.i);const owner=()=>host.managementOrchestrator;
 const notice=()=>sdk.nodes(f.i).findLast(n=>n.create==='核对分组'&&n.onClick);
 return{...f,...actual,r,host,Host,Orchestrator,Runtime,attach,owner,notice,settle:async()=>{await owner()?.operationTail;await Promise.resolve();await Promise.resolve();},
  writes:()=>actual.writes().filter(c=>c.dispatched).map(c=>({method:c.params.mutation.method,params:c.params.mutation.params,cancel:c.options.shouldCancel})),
  retire:()=>{actual.retire();f.retire();}};
}
{
 const f=await fixture(),b=f.r.books[0];f.i.openShelfGroup(b);await f.settle();f.group().select.onClick();await f.settle();
 assert.equal(f.writes().length,1);assert.deepEqual(f.writes()[0].params,{sourceId:'s',bookId:'a',group:''});
 assert.equal(f.writes()[0].cancel,undefined,'accepted mutation has no UI cancellation');assert.equal(f.r.books[0].group??'','');
 assert.equal(f.i.editingShelfGroupBook,undefined);assert.equal(f.refresh(),1);assert.equal(f.i.bookshelfManagementSnapshot.receipt.receipt.fact,'confirmedCurrent');cases++;
}
for(const fail of['read','lost','lostBefore','malformed']){
 const f=await fixture(),b=f.r.books[0];f.i.openShelfGroup(b);await f.settle();
 if(fail==='read')f.r.readFailure='book-group.list';if(fail==='lost')f.r.lost='bookshelf.group.assign';if(fail==='lostBefore')f.r.lostBefore='bookshelf.group.assign';if(fail==='malformed')f.r.malformed=true;
 f.group().select.onClick();await f.settle();assert.equal(f.writes().length,1);assert.equal(f.i.editingShelfGroupBook,b);
 const receipt=f.i.bookshelfManagementSnapshot.receipt;assert.equal(receipt.receipt.confirmation,fail==='read'?'confirmed':'unknown');
 f.i.shelfGroupContent();const n=f.notice();assert.ok(n?.onClick,'actual shared Notice/Action native read-only recovery');n.onClick();n.onClick();await f.settle();
 assert.equal(f.writes().length,1,'double read recovery never repeats group write');
 assert.equal(f.i.bookshelfManagementSnapshot.receipt.receipt.fact,fail==='lostBefore'?'pendingReconciliation':'confirmedCurrent');
 if(fail==='lostBefore'){f.group().select.onClick();await f.settle();assert.equal(f.writes().length,1,'unknown current entity cannot unlock write');}
 assert.equal(f.toasts.length,0,'no misleading write-failed toast after confirmed save');cases++;
}
for(const stage of['before','after']){
 const f=await fixture(),b=f.r.books[0],gate=defer();f.i.openShelfGroup(b);await f.settle();const old=f.group();f.r.wait={method:'bookshelf.group.assign',stage,...gate};
 old.select.onClick();await until(()=>stage==='before'?f.owner().writeReserved:f.writes().length===1);
 const oldOwner=f.owner(),oldTail=oldOwner.operationTail,oldGateway=oldOwner.gateway,oldSnapshot=structuredClone(f.i.bookshelfManagementSnapshot);
 const next=dialogFixture(indexSource,f.r),replacementBook=f.r.books[1];Object.assign(next.i,{mountedRuntimeOwner:f.r,rssInstanceIdentity:22});f.attach(next.i);next.i.openShelfGroup(replacementBook);
 assert.equal(next.i.bookshelfHost.managementOrchestrator,oldOwner);assert.equal(oldOwner.gateway,oldGateway,'replacement adds a read behind the same original write authority');
 old.select.onClick();f.host.bindManagement(f.r,f.i.bookshelfManagementPresentationIdentity,()=>false);
 assert.equal(oldOwner.isPresentationCurrent(next.i.bookshelfManagementPresentationIdentity),true,'stale attach cannot steal successor');
 f.host.detachManagementPresentation();gate.resolve();await oldTail;await f.settle();
 assert.deepEqual(f.i.bookshelfManagementSnapshot,oldSnapshot);assert.equal(f.writes().length,stage==='before'?0:1);
 assert.equal(next.i.editingShelfGroupBook,replacementBook);assert.equal(next.refresh(),0);
 if(stage==='after')assert.equal(next.i.bookshelfManagementSnapshot.receipt.receipt.confirmation,'confirmed','actual old ACK settles domain truth for same Runtime successor');
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
 const prior=structuredClone(f.i.bookshelfManagementSnapshot);f.retire();gate.resolve();await f.settle();assert.deepEqual(f.i.bookshelfManagementSnapshot,prior);assert.equal(f.owner().currentSnapshot().receipt.receipt.confirmation,'confirmed');cases++;
}
function managementIndex(f){
 const names=['bookshelfManagementContent','bookshelfManagementSurface','bookshelfManagementIdentity','bindBookshelfManagement','isCurrentBookshelfManagement','isCurrentRuntime'];
 const pageSource=source('features/bookshelf/BookshelfManagementPage.ets');
 class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
 const i=createReaderBuilderProbe(indexSource,names,{ReaderRuntimeOwner:f.Runtime,BookshelfManagementPage:Child},
  {childSources:{BookshelfManagementPage:pageSource,PageBackBar:source('features/common/PageBackBar.ets')}}).owner;
 Object.assign(i,{route:'bookshelfManagement',navigationGeneration:1,detailShelfAdmissionMount:1,mountedRuntimeOwner:f.r,shelfReceiptRetired:false,
  rssInstanceIdentity:Math.random(),bookshelfManagementPresentationIdentity:''});
 f.attach(i);i.bindBookshelfManagement();let back=0;i.returnToBookshelf=()=>back++;
 const owner=i.bookshelfHost.managementOrchestrator;
 const actualPage=()=>{
  i.bookshelfManagementContent();const props=[...i.children.values()].at(-1).params;
  const page=sdk.consumer(pageSource,boundedMembers(pageSource),{EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT:i.bookshelfManagementSnapshot,readerRecoveryView,InputType:{Number:1}},props);
  page.groupEditorCard();page.recoveryAction();
  return{page,props,save:sdk.nodes(page).find(n=>n.create==='创建'&&n.onClick)};
 };
 return{i,owner,actualPage,back:()=>back,open:async()=>{i.bookshelfHost.openManagement(i.bookshelfManagementPresentationIdentity);await owner.operationTail;}};
}
{
 const f=await fixture(),x=managementIndex(f);await x.open();const old=x.actualPage(),next=managementIndex(f);
 assert.equal(x.owner,next.owner);const id=next.i.bookshelfManagementPresentationIdentity;
 x.i.bindBookshelfManagement();assert.equal(x.owner.isPresentationCurrent(id),true,'alive old Index bind does not reattach');
 old.props.onGroupNameChanged('old');old.save.onClick();old.props.onDeleteGroup(1);old.props.onAssignBook();old.props.onBack();await x.owner.operationTail;
 assert.equal(f.writes().length,0);assert.equal(x.back(),0);
 await next.open();const live=next.actualPage();live.props.onGroupNameChanged('native');live.save.onClick();live.save.onClick();await next.owner.operationTail;
 assert.equal(f.writes().length,1);assert.equal(f.r.groups.at(-1).groupName,'native');cases++;
}
{
 const f=await fixture(),x=managementIndex(f);await x.open();const p=x.actualPage();p.props.onGroupNameChanged('truth');f.r.readFailure='book-group.list';p.save.onClick();await x.owner.operationTail;
 assert.equal(x.i.bookshelfManagementSnapshot.receipt.receipt.fact,'confirmedRefreshFailed');
 const actual=x.actualPage();const recovery=sdk.nodes(actual.page).find(n=>n.create==='刷新列表'&&n.onClick);assert.ok(recovery);recovery.onClick();await x.owner.operationTail;
 assert.equal(f.writes().length,1);assert.equal(x.i.bookshelfManagementSnapshot.receipt.receipt.fact,'confirmedCurrent');cases++;
}
{
 const original=source('features/bookshelf/BookshelfManagementGateway.ts');
 const mutant=original.replace('ReaderRuntimeOwner.isCurrent(this.owner) && (admitted?.() ?? true)','true');assert.notEqual(mutant,original);
 const f=await fixture(indexSource,mutant),gate=defer();f.i.openShelfGroup(f.r.books[0]);await f.settle();f.r.wait={method:'bookshelf.group.assign',stage:'before',...gate};f.group().select.onClick();
 await until(()=>f.owner().writeReserved);f.i.closeShelfGroup();gate.resolve();await f.settle();
 assert.equal(f.writes().length,1,'removing actual last dispatch lease lets retired group mutate after startup gate');cases++;
}

{
 const f=await fixture(),b=f.r.books[0];f.i.openShelfGroup(b);await f.settle();f.r.lostBefore='bookshelf.group.assign';f.group().select.onClick();await f.settle();
 const original=JSON.parse(f.disk()),cold=await fixture(indexSource,source('features/bookshelf/BookshelfManagementGateway.ts'),{root:f.root,uuid:f.uuid()}),x=managementIndex(cold);
 await x.open();assert.equal(x.i.bookshelfManagementSnapshot.managementMutation.canContinueOriginal,true);
 const actual=x.actualPage(),old=sdk.nodes(actual.page).findLast(n=>n.create==='继续原分组操作'&&n.onClick);
 assert.ok(old,'cold original intent is consumed by an actual SDK shared RecoveryAction');
 const query=sdk.nodes(actual.page).findLast(n=>n.create==='刷新列表'&&n.onClick);assert.ok(query);query.onClick();await x.owner.operationTail;
 assert.equal(cold.writes().length,0,'original native reconcile always remains query-only');
 actual.page.updateStateVars({...actual.props,snapshot:x.i.bookshelfManagementSnapshot});actual.page.recoveryAction();
 const current=sdk.nodes(actual.page).findLast(n=>n.create==='继续原分组操作'&&n.onClick);assert.notEqual(current,old);
 old.onClick();await x.owner.operationTail;assert.equal(cold.writes().length,0,'retained old physical action cannot borrow new generation');
 current.onClick();current.onClick();await x.owner.operationTail;
 assert.equal(cold.writes().length,1);const write=cold.calls.find(c=>c.method==='bookshelf.management.mutation.apply'&&c.dispatched);
 assert.equal(write.params.operationId,original.operationId);assert.deepEqual(write.params.mutation,original.mutation);
 assert.equal(x.i.bookshelfManagementSnapshot.receipt.receipt.confirmation,'confirmed');assert.equal(x.i.bookshelfManagementSnapshot.mutationBlocked,false);cases++;
}
{
 const f=await fixture(),b=f.r.books[0];f.i.openShelfGroup(b);await f.settle();f.r.lostBefore='bookshelf.group.assign';f.group().select.onClick();await f.settle();
 const cold=await fixture(indexSource,source('features/bookshelf/BookshelfManagementGateway.ts'),{root:f.root,uuid:f.uuid()});
 cold.i.openShelfGroup(cold.r.books[1]);await cold.settle();const owner=cold.owner();
 cold.i.shelfGroupContent();assert.equal(sdk.nodes(cold.i).filter(n=>n.create==='继续原分组操作'&&n.onClick).length,0,
  'a pending assignment of book A cannot present a write continuation as book B');
 assert.equal(cold.i.canContinueShelfGroup(cold.r.books[0],cold.i.bookshelfManagementSnapshot.receipt.facts.generation),true,'exact original book A remains eligible');
 assert.equal(cold.writes().length,0);cases++;
}
{
 const f=await fixture(),b=f.r.books[0];f.i.openShelfGroup(b);await f.settle();f.r.lostBefore='bookshelf.group.assign';f.group().select.onClick();await f.settle();
 const x=managementIndex(f);await x.open();const old=x.actualPage();const oldNative=sdk.nodes(old.page).findLast(n=>n.create==='继续原分组操作'&&n.onClick);assert.ok(oldNative);
 const replacement=managementIndex(f);await replacement.open();oldNative.onClick();old.props.onContinueOriginal(x.i.bookshelfManagementSnapshot.receipt.facts.generation);await x.owner.operationTail;
 assert.equal(f.writes().length,1,'only original failed admission was dispatched, no stale page continuation');
 const live=replacement.actualPage(),native=sdk.nodes(live.page).findLast(n=>n.create==='继续原分组操作'&&n.onClick);assert.ok(native);native.onClick();await replacement.owner.operationTail;
 assert.equal(f.writes().length,2,'current replacement page explicitly continues original complete DTO');cases++;
}
{
 const f=await fixture(),x=managementIndex(f);await x.open();f.options.loseFinishAt=2;const p=x.actualPage();p.props.onGroupNameChanged('终态');p.save.onClick();await x.owner.operationTail;
 assert.equal(x.i.bookshelfManagementSnapshot.receipt.receipt.confirmation,'confirmed');assert.equal(x.i.bookshelfManagementSnapshot.mutationBlocked,true);
 const recovery=x.actualPage();assert.match(recovery.page.recovery().message,/已确认.*记录清理尚未确认/);
 const native=sdk.nodes(recovery.page).findLast(n=>n.create==='刷新列表'&&n.onClick);assert.ok(native,'confirmed Core ACK with unsettled local cleanup still has pure recovery');
 native.onClick();await x.owner.operationTail;assert.equal(f.writes().length,1);assert.equal(x.i.bookshelfManagementSnapshot.mutationBlocked,false);cases++;
}

console.log(`PASS ${cases} actual Bookshelf Host→shared Management Orchestrator→actual Gateway/Core decoding→Index→full SDK group Selector/Notice/Recovery: exact tuple/last dispatch/ACK/read failure/unknown/5-write mutex/current entity does not ACK/remount/late/Runtime.`);

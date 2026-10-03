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
function fixture(text=indexSource,gatewayText=source('features/bookshelf/BookshelfManagementGateway.ts')){
 const f=dialogFixture(text),r=f.r;let installed=r;
 const Runtime=runtimeOwnerIdentityProbe(()=>installed);
 Object.assign(r,{calls:[],books:[book('a'),book('b')],groups:[{groupId:1,groupName:'old',order:0,enableRefresh:true,show:true}],lost:'',readFailure:'',wait:undefined,malformed:false,
 async request(method,params={},options={}){
  if(this.wait?.method===method&&this.wait.stage==='before')await this.wait.promise;
  if(options.canDispatch?.()===false)throw Error('last native admission rejected');options.onDispatch?.();
  this.calls.push({method,params:structuredClone(params),hasDispatch:!!options.onDispatch,cancel:options.shouldCancel});
  let data;
  if(method==='bookshelf.group.assign'){const actual=this.books.find(b=>b.sourceId===params.sourceId&&b.bookId===params.bookId);actual.group=params.group;data={book:this.malformed?{...actual,bookId:'wrong'}:{...actual}};}
  else if(method==='book-group.create'){const g={groupId:this.groups.length+1,groupName:params.groupName,order:params.order,enableRefresh:true,show:true};this.groups.push(g);data={group:g};}
  else if(method==='book-group.update'){const g=this.groups.find(g=>g.groupId===params.groupId);Object.assign(g,params);data={group:g};}
  else if(method==='book-group.delete'){this.groups=this.groups.filter(g=>g.groupId!==params.groupId);data={deleted:true,groupId:params.groupId};}
  else if(method==='book-group.list')data={groups:this.groups};
  else if(method==='read-record.list')data={records:[]};
  else if(method==='bookshelf.list')data={books:this.books,total:this.books.length};
  else throw Error(method);
  if(this.wait?.method===method&&this.wait.stage==='after')await this.wait.promise;
  if(this.lost===method){this.lost='';throw Error('lost ACK');}
  if(this.readFailure===method){this.readFailure='';throw Error('read unavailable');}
  return{data:structuredClone(data)};
 }});
 const ReaderCoreGateway=compile('app/ReaderCoreGateway.ts','ReaderCoreGateway',{ReaderRuntimeOwner:Runtime});
 const Gateway=compile('features/bookshelf/BookshelfManagementGateway.ts','BookshelfManagementGateway',{ReaderRuntimeOwner:Runtime,ReaderCoreGateway},gatewayText);
 const Orchestrator=compile('features/bookshelf/BookshelfManagementOrchestrator.ets','BookshelfManagementOrchestrator',{ReaderRuntimeOwner:Runtime,ReaderWriteEvidence,BookshelfManagementGateway:Gateway,...facts,projectPersistedReceipt,hilog:{error(){}}});
 const Host=compile('features/bookshelf/BookshelfHost.ets','BookshelfHost',{ReaderRuntimeOwner:Runtime,ReaderCoreGateway,BookshelfManagementOrchestrator:Orchestrator});
 const attach=(index)=>{const host=new Host(snapshot=>{index.bookshelfManagementSnapshot=snapshot;},()=>index.route==='bookshelfManagement',()=>r);index.bookshelfHost=host;return host;};
 const host=attach(f.i);const owner=()=>host.managementOrchestrator;
 const notice=()=>sdk.nodes(f.i).findLast(n=>n.create==='核对分组'&&n.onClick);
 return{...f,host,Host,Orchestrator,Runtime,attach,owner,notice,settle:async()=>{await owner()?.operationTail;await Promise.resolve();await Promise.resolve();},writes:()=>r.calls.filter(c=>c.hasDispatch),retire:()=>{installed=undefined;f.retire();}};
}
{
 const f=fixture(),b=f.r.books[0];f.i.openShelfGroup(b);f.group().select.onClick();await f.settle();
 assert.equal(f.writes().length,1);assert.deepEqual(f.writes()[0].params,{sourceId:'s',bookId:'a',group:''});
 assert.equal(f.writes()[0].cancel,undefined,'accepted mutation has no UI cancellation');assert.equal(f.r.books[0].group,'');
 assert.equal(f.i.editingShelfGroupBook,undefined);assert.equal(f.refresh(),1);assert.equal(f.i.bookshelfManagementSnapshot.receipt.receipt.fact,'confirmedCurrent');cases++;
}
for(const fail of['read','lost','malformed']){
 const f=fixture(),b=f.r.books[0];f.i.openShelfGroup(b);
 if(fail==='read')f.r.readFailure='book-group.list';if(fail==='lost')f.r.lost='bookshelf.group.assign';if(fail==='malformed')f.r.malformed=true;
 f.group().select.onClick();await f.settle();assert.equal(f.writes().length,1);assert.equal(f.i.editingShelfGroupBook,b);
 const receipt=f.i.bookshelfManagementSnapshot.receipt;assert.equal(receipt.receipt.confirmation,fail==='read'?'confirmed':'unknown');
 f.i.shelfGroupContent();const n=f.notice();assert.ok(n?.onClick,'actual shared Notice/Action native read-only recovery');n.onClick();n.onClick();await f.settle();
 assert.equal(f.writes().length,1,'double read recovery never repeats group write');
 assert.equal(f.i.bookshelfManagementSnapshot.receipt.receipt.fact,fail==='read'?'confirmedCurrent':'pendingReconciliation');
 if(fail!=='read'){f.group().select.onClick();await f.settle();assert.equal(f.writes().length,1,'unknown current entity cannot unlock write');}
 assert.equal(f.toasts.length,0,'no misleading write-failed toast after confirmed save');cases++;
}
for(const stage of['before','after']){
 const f=fixture(),b=f.r.books[0],gate=defer();f.i.openShelfGroup(b);const old=f.group();f.r.wait={method:'bookshelf.group.assign',stage,...gate};
 old.select.onClick();await until(()=>stage==='before'?f.owner().writeReserved:f.writes().length===1);
 const oldOwner=f.owner(),oldTail=oldOwner.operationTail,oldSnapshot=structuredClone(f.i.bookshelfManagementSnapshot);
 const next=dialogFixture(indexSource,f.r);Object.assign(next.i,{mountedRuntimeOwner:f.r,rssInstanceIdentity:22});f.attach(next.i);next.i.openShelfGroup(f.r.books[1]);
 assert.equal(next.i.bookshelfHost.managementOrchestrator,oldOwner);assert.equal(oldOwner.operationTail,oldTail);
 old.select.onClick();f.host.bindManagement(f.r,f.i.bookshelfManagementPresentationIdentity,()=>false);
 assert.equal(oldOwner.isPresentationCurrent(next.i.bookshelfManagementPresentationIdentity),true,'stale attach cannot steal successor');
 f.host.detachManagementPresentation();gate.resolve();await f.settle();
 assert.deepEqual(f.i.bookshelfManagementSnapshot,oldSnapshot);assert.equal(f.writes().length,stage==='before'?0:1);
 assert.equal(next.i.editingShelfGroupBook,f.r.books[1]);assert.equal(next.refresh(),0);
 if(stage==='after')assert.equal(next.i.bookshelfManagementSnapshot.receipt.receipt.confirmation,'confirmed','actual old ACK settles domain truth for same Runtime successor');
 cases++;
}
for(const command of['create','update','show','delete','assign']){
 const f=fixture();let snap;const o=new f.Orchestrator(s=>snap=s,()=>true,f.r);o.open();await o.operationTail;
 if(command==='create'){o.updateGroupName('new');o.saveGroup();o.saveGroup();}
 if(command==='update'){o.selectGroup(1);o.updateGroupName('renamed');o.saveGroup();o.saveGroup();}
 if(command==='show'){o.toggleGroupShown(1);o.toggleGroupShown(1);}
 if(command==='delete'){o.deleteGroup(1);o.deleteGroup(1);}
 if(command==='assign'){o.selectBook('s','a');o.updateAssignmentGroup('new');o.assignSelectedBook();o.assignSelectedBook();}
 await o.operationTail;assert.equal(f.writes().length,1,`${command} original management actor has one reserved write`);assert.equal(snap.receipt.receipt.confirmation,'confirmed');
 const method=f.writes()[0].method;f.r.lost=method;
 if(command==='create'){o.updateGroupName('second');o.saveGroup();}if(command==='update'){o.selectGroup(1);o.updateGroupName('second');o.saveGroup();}if(command==='show'){o.toggleGroupShown(1);}if(command==='delete'){o.deleteGroup(1);}if(command==='assign'){o.assignSelectedBook();}
 await o.operationTail;assert.equal(snap.receipt.receipt.confirmation,'unknown');const count=f.writes().length;o.reconcile(snap.receipt.facts.generation);await o.operationTail;
 o.saveGroup();o.deleteGroup(9);o.assignSelectedBook();await o.operationTail;assert.equal(f.writes().length,count,'every management mutation shares unknown barrier');cases++;
}
{
 const f=fixture(),b=f.r.books[0],gate=defer();f.i.openShelfGroup(b);f.r.wait={method:'bookshelf.group.assign',stage:'after',...gate};f.group().select.onClick();await until(()=>f.writes().length===1);
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
 const f=fixture(),x=managementIndex(f);await x.open();const old=x.actualPage(),next=managementIndex(f);
 assert.equal(x.owner,next.owner);const id=next.i.bookshelfManagementPresentationIdentity;
 x.i.bindBookshelfManagement();assert.equal(x.owner.isPresentationCurrent(id),true,'alive old Index bind does not reattach');
 old.props.onGroupNameChanged('old');old.save.onClick();old.props.onDeleteGroup(1);old.props.onAssignBook();old.props.onBack();await x.owner.operationTail;
 assert.equal(f.writes().length,0);assert.equal(x.back(),0);
 await next.open();const live=next.actualPage();live.props.onGroupNameChanged('native');live.save.onClick();live.save.onClick();await next.owner.operationTail;
 assert.equal(f.writes().length,1);assert.equal(f.r.groups.at(-1).groupName,'native');cases++;
}
{
 const f=fixture(),x=managementIndex(f);await x.open();const p=x.actualPage();p.props.onGroupNameChanged('truth');f.r.readFailure='book-group.list';p.save.onClick();await x.owner.operationTail;
 assert.equal(x.i.bookshelfManagementSnapshot.receipt.receipt.fact,'confirmedRefreshFailed');
 const actual=x.actualPage();const recovery=sdk.nodes(actual.page).find(n=>n.create==='刷新列表'&&n.onClick);assert.ok(recovery);recovery.onClick();await x.owner.operationTail;
 assert.equal(f.writes().length,1);assert.equal(x.i.bookshelfManagementSnapshot.receipt.receipt.fact,'confirmedCurrent');cases++;
}
{
 const original=source('features/bookshelf/BookshelfManagementGateway.ts');
 const mutant=original.replace('ReaderRuntimeOwner.isCurrent(this.owner) && (admitted?.() ?? true)','true');assert.notEqual(mutant,original);
 const f=fixture(indexSource,mutant),gate=defer();f.i.openShelfGroup(f.r.books[0]);f.r.wait={method:'bookshelf.group.assign',stage:'before',...gate};f.group().select.onClick();
 await until(()=>f.owner().writeReserved);f.i.closeShelfGroup();gate.resolve();await f.settle();
 assert.equal(f.writes().length,1,'removing actual last dispatch lease lets retired group mutate after startup gate');cases++;
}

console.log(`PASS ${cases} actual Bookshelf Host→shared Management Orchestrator→actual Gateway/Core decoding→Index→full SDK group Selector/Notice/Recovery: exact tuple/last dispatch/ACK/read failure/unknown/5-write mutex/current entity does not ACK/remount/late/Runtime.`);

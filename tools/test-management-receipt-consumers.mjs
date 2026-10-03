import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const ordinary=s=>stripTypeScriptTypes(s.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const load=(p,n,deps={})=>new Function(...Object.keys(deps),ordinary(source(p))+`;return ${n};`)(...Object.values(deps));
const facts=load('app/ReaderOperationFacts.ts','{projectOperationFacts,projectCommitReadback}');
const projectPersistedReceipt=load('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
const ReaderWriteEvidence=load('app/ReaderWriteEvidence.ts','ReaderWriteEvidence');
const readerRecoveryView=load('app/ReaderRecoveryProjection.ts','readerRecoveryView');
let currentOwner;const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
const RulesManagementGateway=load('features/settings/RulesManagementGateway.ts','RulesManagementGateway',{ReaderRuntimeOwner});
const unused=class{observeWrites(){}};
const Rules=load('features/settings/RulesManagementOrchestrator.ets','{RulesManagementOrchestrator,EMPTY_RULES_MANAGEMENT_SNAPSHOT}',{ReaderRuntimeOwner,ReaderWriteEvidence,RulesManagementGateway,SourceGateway:unused,RssGateway:unused,hilog:{error(){},warn(){}},projectPersistedReceipt,...facts});
const BookshelfManagementGateway=load('features/bookshelf/BookshelfManagementGateway.ts','BookshelfManagementGateway',{ReaderRuntimeOwner,ReaderCoreGateway:class{constructor(owner){this.owner=owner;}async loadBookshelf(){return this.owner.shelf;}}});
const Shelf=load('features/bookshelf/BookshelfManagementOrchestrator.ets','{BookshelfManagementOrchestrator,EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT}',{ReaderRuntimeOwner,ReaderWriteEvidence,BookshelfManagementGateway,hilog:{error(){},warn(){}},projectPersistedReceipt,...facts});
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax=require(sdk+'/lib/validate_ui_syntax.js');
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
for(const [name,path] of [['RulesManagementPage','features/settings/RulesManagementPage.ets'],['BookshelfManagementPage','features/bookshelf/BookshelfManagementPage.ets'],['ReaderRecoveryAction','features/common/ReaderRecoveryAction.ets']]){
 syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...source(path).matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
}
const clone=v=>v===undefined?undefined:structuredClone(v);
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
function rpc(){return{calls:[],failRead:'',failWrite:false,invalidRead:false,wait:undefined,shelf:{books:[]},async request(method,params){this.calls.push(method);if(this.wait&&this.wait.method===method)await this.wait.promise;
 if(method==='replace.validate')return{data:{valid:true}};
 if(method==='replace.persist'||method==='book-group.create'){if(this.failWrite){this.failWrite=false;throw Error('lost acknowledgement');}return{data:{group:{groupId:3,groupName:params.groupName,order:0,enableRefresh:true,show:true}}};}
 if(method===this.failRead){this.failRead='';throw Error('read unavailable');}
 if(method==='book-group.list')return{data:{groups:this.invalidRead?[{groupId:'wrong'}]:[]}};
 if(method==='read-record.list')return{data:{records:[]}};
 if(method==='rule-sub.list')return{data:{subs:[]}};
 if(['replace-rule.list','txt-toc-rule.list','dict-rule.list'].includes(method))return{data:{rules:this.invalidRead&&method==='replace-rule.list'?[{id:'wrong'}]:[]}};
 throw Error(method);
 },count(m){return this.calls.filter(x=>x===m).length;}};}
function fixture(kind){const runtime=rpc();currentOwner=runtime;let visible=true,snapshot;const isRules=kind==='rules';
 const cls=isRules?Rules.RulesManagementOrchestrator:Shelf.BookshelfManagementOrchestrator;
 const owner=new cls(v=>{snapshot=clone(v);},()=>visible,runtime);
 const host={reconcileManagement:g=>owner.reconcile(g),updateGroupName:v=>owner.updateGroupName(v),updateGroupOrder:v=>owner.updateGroupOrder(v),selectGroup(){},clearGroupEditor(){},saveGroup:()=>owner.saveGroup(),toggleGroupShown(){},deleteGroup(){},selectBook(){},updateAssignmentGroup(){},assignSelectedBook(){}};
 const method=isRules?'rulesManagementContent':'bookshelfManagementContent';
 const index=createReaderBuilderProbe(source('pages/Index.ets'),[method],{RulesManagementPage:Child,BookshelfManagementPage:Child}).owner;
 Object.assign(index,{getRulesManagementOrchestrator:()=>owner,bookshelfHost:host,openJsonImport(){},returnFromRulesManagement(){},returnToBookshelf(){}});
 function page(){Object.assign(index,{rulesManagementSnapshot:snapshot,bookshelfManagementSnapshot:snapshot});index[method]();const child=[...index.children.values()][0];const pagePath=isRules?'features/settings/RulesManagementPage.ets':'features/bookshelf/BookshelfManagementPage.ets';
  const page=createReaderBuilderProbe(source(pagePath),['recoveryAction','statusCard','recovery'],{ReaderRecoveryAction:Child,readerRecoveryView,EMPTY_RULES_MANAGEMENT_SNAPSHOT:Rules.EMPTY_RULES_MANAGEMENT_SNAPSHOT,EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT:Shelf.EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT}).owner;
  for(const name of ['bundleCard','replaceCard','txtTocCard','dictCard','subscriptionCard','statisticsCard','groupEditorCard','groupsCard','assignmentCard','recordsCard']) page[name]=()=>{};
  page.contentFrame=()=>({width:350,left:19,right:19});page.bottomContentInset=()=>12;
  Object.assign(page,child.params,{appThemeScheme:'day'});page.statusCard();page.recoveryAction();const recovery=[...page.children.values()].find(c=>c.params.generation!==undefined);
  return{page,recovery};
 }
 return{runtime,owner,page,setVisible:v=>{visible=v;},snapshot:()=>snapshot,write:()=>{if(isRules)owner.saveReplaceRule({name:'x',pattern:'x',replacement:'y',isEnabled:true,isRegex:false,order:0});else{owner.updateGroupName('new');owner.updateGroupOrder('0');owner.saveGroup();}},settle:()=>owner.operationTail};}
for(const kind of ['rules','shelf']){
 const command=kind==='rules'?'replace.persist':'book-group.create',read=kind==='rules'?'replace-rule.list':'book-group.list';
 {
  const f=fixture(kind);f.owner.open();await f.settle();f.runtime.failRead=read;f.write();await f.settle();
  assert.equal(f.snapshot().receipt.receipt.fact,'confirmedRefreshFailed');const p=f.page();assert.ok(p.recovery,'actual Index child props -> SDK page renders recovery');
  assert.match(p.page.recovery().message,/已确认.*刷新失败/);p.recovery.params.onReconcile(p.recovery.params.generation);p.recovery.params.onReconcile(p.recovery.params.generation);await f.settle();
  assert.equal(f.runtime.count(command),1);assert.equal(f.snapshot().receipt.receipt.fact,'confirmedCurrent');assert.equal(f.runtime.count(read),3,'double-click admits exactly one recovery read');
 }
 {
  const f=fixture(kind);f.owner.open();await f.settle();f.runtime.failWrite=true;f.write();await f.settle();assert.equal(f.snapshot().receipt.receipt.confirmation,'unknown');const p=f.page();p.recovery.params.onReconcile(p.recovery.params.generation);await f.settle();assert.equal(f.snapshot().receipt.receipt.fact,'pendingReconciliation');assert.equal(f.runtime.count(command),1);
 }
 {
  const f=fixture(kind);f.runtime.failRead=read;f.owner.open();await f.settle();const p=f.page();assert.ok(p.recovery);p.recovery.params.onReconcile(p.recovery.params.generation);await f.settle();assert.equal(f.snapshot().receipt,undefined,'read cannot fabricate write');
  f.runtime.invalidRead=true;f.owner.open();await f.settle();assert.notEqual(f.snapshot().readFacts.fact,'current','malformed payload cannot publish current');
 }
 {
  const f=fixture(kind);f.owner.open();await f.settle();const d=defer();f.runtime.wait={method:command,...d};f.write();await new Promise(r=>setImmediate(r));const before=clone(f.snapshot());f.setVisible(false);d.resolve();await f.settle();assert.deepEqual(f.snapshot(),before,'closed page ignores late ACK');const calls=f.runtime.calls.length;f.write();await f.settle();assert.equal(f.runtime.calls.length,calls,'closed page dispatches no write');
  f.setVisible(true);f.owner.open();await f.settle();
 }
 {
  const f=fixture(kind);f.owner.open();await f.settle();f.runtime.failRead=read;f.write();await f.settle();const old=f.page().recovery.params;f.owner.open();await f.settle();const n=f.runtime.calls.length;old.onReconcile(old.generation);await f.settle();assert.equal(f.runtime.calls.length,n,'re-entry invalidates captured recovery');currentOwner=rpc();f.write();await f.settle();assert.equal(f.runtime.calls.length,n,'retired owner dispatches no mutation');
 }
}

for(const kind of ['rules','shelf']){
 const f=fixture(kind);f.owner.open();await f.settle();const command=kind==='rules'?'replace.persist':'book-group.create';
 const d=defer();f.runtime.wait={method:command,...d};f.write();await new Promise(r=>setImmediate(r));const before=clone(f.snapshot());
 currentOwner=undefined;d.resolve();await f.settle();assert.deepEqual(f.snapshot(),before,'unavailable Runtime cannot turn late ACK into error publication');
 const count=f.runtime.calls.length;assert.doesNotThrow(()=>f.write());await f.settle();assert.equal(f.runtime.calls.length,count,'unavailable Runtime admits no new mutation');
 currentOwner=f.runtime;f.owner.open();await f.settle();assert.equal(f.snapshot().readFacts.fact,'current','independent read after install uses real Gateway');
}

console.log('Management actual Gateway -> Index -> SDK consumers: PASS (read/write/unknown/retry/close/reopen/late/owner/malformed).');

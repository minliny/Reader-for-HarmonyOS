import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const ordinary=s=>stripTypeScriptTypes(s.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const load=(p,n,deps={})=>new Function(...Object.keys(deps),ordinary(source(p))+`;return ${n};`)(...Object.values(deps));
const facts=load('app/ReaderOperationFacts.ts','{projectOperationFacts,projectCommitReadback}');
const projectPersistedReceipt=load('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts),ReaderWriteEvidence=load('app/ReaderWriteEvidence.ts','ReaderWriteEvidence'),readerRecoveryView=load('app/ReaderRecoveryProjection.ts','readerRecoveryView');
let currentOwner;const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
const helpers={...load('app/ErrorMessage.ts','{errorMessageOf}'),...load('app/HttpTransportPolicy.ts','{httpUrlHostname,isPrivateNetworkTarget}'),...load('features/source/ReaderSourceCategory.ts','{classifyReaderSource}')};
const SourceGateway=load('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner,isReaderCoreTransactionPendingError:()=>false,...helpers});
const {SourceToolsOrchestrator,EMPTY_SOURCE_TOOLS_SNAPSHOT}=load('features/source/SourceToolsOrchestrator.ets','{SourceToolsOrchestrator,EMPTY_SOURCE_TOOLS_SNAPSHOT}',{SourceGateway,ReaderRuntimeOwner,ReaderWriteEvidence,hilog:{error(){},warn(){},info(){}},projectPersistedReceipt,...facts});
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader',syntax=require(sdk+'/lib/validate_ui_syntax.js');
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
for(const [name,path] of [['SourceToolsPage','features/source/SourceToolsPage.ets'],['ReaderRecoveryAction','features/common/ReaderRecoveryAction.ets']]){syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...source(path).matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));}
const clone=v=>structuredClone(v),tick=()=>new Promise(r=>setImmediate(r));
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
const document=id=>JSON.stringify({bookSourceUrl:id,bookSourceName:id,bookSourceType:0,enabled:true});
function rpc(){return{calls:[],rows:['https://a.test','https://b.test'].map(id=>({sourceId:id,name:id,baseUrl:id,enabled:true,enabledExplore:false,bookSource:JSON.parse(document(id))})),readFail:0,writeFail:false,partial:false,pause:undefined,supportsCoreCapability:()=>false,async clearSourceCookieSession(){},
 async request(method,p){this.calls.push(method);if(this.pause?.method===method)await this.pause.promise;
 if(method==='source.list'){if(this.readFail){this.readFail--;throw Error('read unavailable');}return{data:{sources:clone(this.rows)}};}
 if(method==='source.export')return{data:{data:'['+document(p.sourceIds?.[0]??this.rows[0].sourceId)+']',count:1,format:'json'}};
 if(method==='source.update'){this.rows.find(r=>r.sourceId===p.sourceId).enabled=p.enabled;if(this.writeFail||this.partial&&p.sourceId==='https://b.test'){this.writeFail=false;throw Error('lost ACK');}return{data:{source:clone(this.rows.find(r=>r.sourceId===p.sourceId))}};}
 if(method==='source.delete'){const deleted=this.rows.filter(r=>p.sourceIds.includes(r.sourceId)).length;this.rows=this.rows.filter(r=>!p.sourceIds.includes(r.sourceId));if(this.writeFail){this.writeFail=false;throw Error('lost ACK');}return{data:{deleted}};}
 if(method==='source.import'){if(this.writeFail){this.writeFail=false;throw Error('lost ACK');}return{data:{imported:true,sourceId:p.sourceId,name:p.bookSource.bookSourceName}};}
 throw Error(method);
 },count(m){return this.calls.filter(x=>x===m).length;}};}
let instance=0;
function makeIndex(r){const index=createReaderBuilderProbe(source('pages/Index.ets'),['sourceToolsContent','sourceToolsSurface','getSourceToolsOrchestrator','isCurrentSourceToolsPresentation','isCurrentRuntime'],{SourceToolsPage:Child,SourceToolsOrchestrator,ReaderRuntimeOwner}).owner;Object.assign(index,{route:'sourceTools',navigationGeneration:1,detailShelfAdmissionMount:1,sourceToolsInstanceIdentity:++instance,mountedRuntimeOwner:r,shelfReceiptRetired:false,sourceToolsPresentationIdentity:'',sourceToolsSnapshot:clone(EMPTY_SOURCE_TOOLS_SNAPSHOT)});return index;}
function fixture(){const r=rpc();currentOwner=r;const index=makeIndex(r);const owner=index.getSourceToolsOrchestrator();
 const settle=async()=>{await owner.operationTail;};
 const refresh=()=>{index.sourceToolsContent();return [...index.children.values()].at(-1).params;};
 const page=()=>{const child=refresh();const page=createReaderBuilderProbe(source('features/source/SourceToolsPage.ets'),['statusCard','recovery','recoveryAction'],{readerRecoveryView,ReaderRecoveryAction:Child}).owner;Object.assign(page,child,{appThemeScheme:'day'});page.statusCard();page.recoveryAction();return page;};
 const retry=p=>{const c=[...p.children.values()][0];c.params.onReconcile(c.params.generation);};
 return{r,index,owner,settle,refresh,page,retry,open:async()=>{owner.open([]);await settle();},edit:async()=>{owner.openEditor('https://a.test');await settle();owner.updateEditorDraft(document('https://a.test'));},receipt:()=>index.sourceToolsSnapshot.receipt};}
for(const action of ['toggle','delete','editor']){
 const write=f=>action==='toggle'?f.owner.setSelectedEnabled(['https://a.test'],false):action==='delete'?f.owner.deleteSelected(['https://a.test']):f.owner.saveEditor();const command=action==='toggle'?'source.update':action==='delete'?'source.delete':'source.import';
 {
  const f=fixture();await f.open();if(action==='editor')await f.edit();f.r.readFail=1;write(f);await f.settle();assert.ok(f.receipt(),JSON.stringify({action,state:f.index.sourceToolsSnapshot,calls:f.r.calls}));assert.equal(f.receipt().receipt.fact,'confirmedRefreshFailed');const p=f.page();assert.ok([...p.children.values()].length);assert.match(p.recovery().message,/已确认.*刷新失败/);f.retry(p);f.retry(p);await f.settle();assert.equal(f.r.count(command),1);assert.equal(f.receipt().receipt.fact,'confirmedCurrent');
 }
 {
  const f=fixture();await f.open();if(action==='editor')await f.edit();f.r.writeFail=true;write(f);await f.settle();assert.equal(f.receipt().receipt.confirmation,'unknown');f.retry(f.page());await f.settle();assert.equal(f.receipt().receipt.fact,'pendingReconciliation');assert.equal(f.r.count(command),1);if(action==='editor'){assert.equal(f.index.sourceToolsSnapshot.editorSourceId,'https://a.test');write(f);await f.settle();assert.equal(f.r.count(command),1,'unknown editor cannot blindly repeat save');}
 }
 {
  const f=fixture();await f.open();if(action==='editor')await f.edit();const d=defer();f.r.pause={method:command,...d};write(f);await tick();const before=clone(f.index.sourceToolsSnapshot);f.index.route='source';d.resolve();await f.settle();assert.deepEqual(f.index.sourceToolsSnapshot,before,'close ignores late owner publication');currentOwner=rpc();f.index.mountedRuntimeOwner=currentOwner;f.index.navigationGeneration++;f.index.route='sourceTools';const newer=f.index.getSourceToolsOrchestrator();assert.notEqual(newer,f.owner);
 }
}
{
 const f=fixture();await f.open();f.r.partial=true;f.owner.setSelectedEnabled(['https://a.test','https://b.test'],false);await f.settle();assert.equal(f.receipt().receipt.confirmation,'unknown');assert.equal(f.index.sourceToolsSnapshot.confirmedParts,1);f.retry(f.page());await f.settle();assert.equal(f.r.count('source.update'),2,'partial write recovery reads only');assert.equal(f.receipt().receipt.fact,'pendingReconciliation');
}
{
 const f=fixture();f.r.readFail=1;await f.open();const p=f.page();f.retry(p);await f.settle();assert.equal(f.index.sourceToolsSnapshot.readFacts.fact,'current');assert.equal(f.receipt(),undefined);
 f.r.readFail=1;f.owner.deleteSelected(['https://a.test']);await f.settle();const stale=f.page();f.index.navigationGeneration++;f.index.getSourceToolsOrchestrator();f.owner.open([]);await f.settle();const count=f.r.calls.length;f.retry(stale);await f.settle();assert.equal(f.r.calls.length,count,'reopen invalidates recovery identity');
}

{const f=fixture();await f.open();const d=defer();f.r.pause={method:'source.update',...d};f.owner.setSelectedEnabled(['https://a.test'],false);await tick();
 const before=clone(f.index.sourceToolsSnapshot);currentOwner=undefined;d.resolve();await f.settle();assert.deepEqual(f.index.sourceToolsSnapshot,before,'teardown rejects late ACK/error emission');
 const count=f.r.calls.length;f.owner.setSelectedEnabled(['https://a.test'],true);await f.settle();assert.equal(f.r.calls.length,count);
 currentOwner=f.r;f.owner.open([]);await f.settle();assert.equal(f.index.sourceToolsSnapshot.readFacts.fact,'current');assert.equal(f.index.sourceToolsSnapshot.sources[0].enabled,false);}

// Real SDK batch controls use the finite unknown-write barrier with original
// action tuples; users retain read-only checking/export/recovery access.
{
 const f=fixture();await f.open();f.owner.selectAll();f.r.writeFail=true;f.owner.setSelectedEnabled(['https://a.test'],false);await f.settle();
 const p=createReaderBuilderProbe(source('features/source/SourceToolsPage.ets'),['batchCard','heading','actionButton','canWriteSources']).owner;
 Object.assign(p,f.refresh(),{appThemeScheme:'day'});p.batchCard();const count=f.r.calls.length;
 for(const label of ['启用','停用','删除']){const node=[...p.nodes.values()].find(n=>n.type==='Text'&&n.create===label);assert.ok(node,label);assert.equal(node.opacity,.62);node.onClick();}
 assert.equal(f.r.calls.length,count);assert.equal(f.owner.current().receipt.receipt.confirmation,'unknown');
}
// Actual same-Runtime remount keeps the accepted queue and receipt while
// an obsolete physical Page callback keeps its old presentation lease.
for(const result of ['confirmed','unknown']){
 const f=fixture();await f.open();f.owner.selectAll();const oldProps=f.refresh(),before=clone(f.index.sourceToolsSnapshot);
 const d=defer();f.r.pause={method:'source.update',...d};f.r.writeFail=result==='unknown';
 oldProps.onSetSelectedEnabled(['https://a.test'],false);await tick();
 f.index.route='source';const next=makeIndex(f.r),host=next.getSourceToolsOrchestrator();assert.equal(host,f.owner);
 host.open([]);assert.equal(next.sourceToolsSnapshot.busy,true);const count=f.r.calls.length;
 oldProps.onSelectAll();oldProps.onToggleSelection('https://b.test');oldProps.onSaveEditor();oldProps.onSetSelectedEnabled(['https://b.test'],true);
 assert.equal(f.r.calls.length,count);assert.equal(f.owner.pendingOperations,1);
 // Old disappearance must not detach the replacement physical view.
 host.detachPresentation(f.index.sourceToolsPresentationIdentity);d.resolve();await f.settle();
 assert.equal(next.sourceToolsSnapshot.receipt.receipt.confirmation,result);
 assert.equal(f.index.sourceToolsSnapshot.receipt,undefined,'late accepted truth belongs to owner/new subscriber, not old UI');
 assert.equal(f.r.count('source.update'),1);assert.equal(f.owner.pendingOperations,0);
 if(result==='unknown'){
  next.navigationGeneration++;next.getSourceToolsOrchestrator().open([]);assert.equal(next.sourceToolsSnapshot.receipt.receipt.confirmation,'unknown');
  host.setSelectedEnabled(['https://a.test'],true);host.deleteSelected(['https://b.test']);await f.settle();assert.equal(f.r.count('source.update'),1);assert.equal(f.r.count('source.delete'),0);
  host.reconcile(next.sourceToolsSnapshot.receipt.facts.generation);await f.settle();assert.equal(next.sourceToolsSnapshot.receipt.receipt.confirmation,'unknown');
 }
}
{
 const f=fixture();await f.open();const d=defer();f.r.pause={method:'source.update',...d};f.r.writeFail=true;f.owner.setSelectedEnabled(['https://a.test'],false);await tick();
 const replacement=rpc();currentOwner=replacement;const next=makeIndex(replacement),host=next.getSourceToolsOrchestrator();host.open([]);await host.operationTail;
 const before=clone(next.sourceToolsSnapshot);assert.equal(SourceToolsOrchestrator.forRuntime(f.r),undefined);
 assert.equal(SourceToolsOrchestrator.forRuntime(replacement),host,'retired lookup cannot evict the successor feature cache');
 d.resolve();await f.settle();assert.equal(f.owner.current().receipt.receipt.confirmation,'unknown');assert.deepEqual(next.sourceToolsSnapshot,before);
 assert.equal(replacement.count('source.update'),0);assert.equal(f.r.count('source.update'),1);
}
{
 const f=fixture();await f.open();const old=f.refresh();f.index.navigationGeneration++;f.index.getSourceToolsOrchestrator();
 const before=clone(f.owner.current()),count=f.r.calls.length;old.onToggleSelection('https://a.test');old.onOpenEditor('https://a.test');old.onExportAll();old.onBack();
 assert.deepEqual(f.owner.current(),before);assert.equal(f.r.calls.length,count);assert.equal(f.index.route,'sourceTools');
 currentOwner=undefined;assert.doesNotThrow(()=>{old.onSelectAll();old.onSaveEditor();old.onReconcile(1);});
}

// Admission belongs to the original queued physical intent, not whatever
// presentation later attaches to the same accepted-domain owner.
{
 const f=fixture();await f.open();const before=clone(f.owner.current()),d=defer();f.owner.operationTail=d.promise;
 f.owner.setSelectedEnabled(['https://a.test'],false);f.index.route='source';
 const next=makeIndex(f.r),owner=next.getSourceToolsOrchestrator();assert.equal(owner,f.owner);d.resolve();await f.settle();
 assert.equal(f.r.count('source.update'),0,'old queued write never reaches actual gateway');
 assert.equal(owner.pendingOperations,0);assert.equal(owner.current().receipt,before.receipt);
}
{
 const f=fixture();const d=defer();f.owner.operationTail=d.promise;f.owner.open([]);f.index.route='source';
 const next=makeIndex(f.r),owner=next.getSourceToolsOrchestrator();owner.open([]);d.resolve();await f.settle();
 assert.equal(f.r.count('source.list'),0);assert.equal(next.sourceToolsSnapshot.busy,false);
 assert.equal(next.sourceToolsSnapshot.readFacts.fact,'cancelled');assert.equal(next.sourceToolsSnapshot.readFacts.canRetry,true);
 owner.reconcile(next.sourceToolsSnapshot.readFacts.generation);await f.settle();assert.equal(f.r.count('source.list'),1);assert.equal(next.sourceToolsSnapshot.readFacts.fact,'current');
}

console.log('Source tools actual Gateway -> Index -> SDK consumer: PASS (CRUD/editor/partial/unknown/only-read retry/close/late/owner/reopen).');

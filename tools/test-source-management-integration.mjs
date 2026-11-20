import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'dto-contracts':'Retained group DTO validators reject mismatched identity, duplicate scope and incomplete import receipts; not mounted UI.',
 'tools-context':'Actual tools session retains selection/editor/check settings across return/export cancellation and retires only acknowledged selected items.',
 'tools-accepted-batch':'Actual accepted batch completes after presentation detachment and retains results on reentry; fake source-check RPC only.',
 'raw-source-projection':'Actual raw source definition read and current-version projection do not substitute local group export or stale check facts.',
 'startup-plan-forwarding':'Actual startup routes the exact observed Core migration plan after explicit identity gate-call ports; no plan on ordinary open; denied gate stops create. No Native/migration.',
};
const selected=selectContractCases(definitions);
if(!selected.length)process.exit(0);
const {bookshelfOperationClass:production}=await import('./lib/bookshelf-operation-owner-probe.mjs');
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const {projectOperationFacts,projectCommitReadback}=await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
const {ReaderWriteEvidence}=await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const source=id=>({sourceId:id,name:id,baseUrl:'https://'+id,enabled:true,enabledExplore:true,category:'novel'});

async function toolsCase(id){
const runtime = {}; let current = true; let failSecond = false; let exportCanceled = true;
const source = id => ({sourceId:id,name:id,baseUrl:'https://'+id,enabled:true,enabledExplore:true,category:'novel'});
const sources = [source('a'),source('b'),source('c')];
let releaseCheck; const checkedIds=[];
class Gateway {
  originalMutationSnapshot(){return undefined;}
  async recoverOriginalSource(){return undefined;}
  async loadSources(){return sources.slice();}
  async loadEditableSource(){return '{"draft":"initial"}';}
  async exportBookSources(ids){return {count:ids?.length??sources.length,data:'[]'};}
  observeWrites(evidence){this.evidence=evidence;}
  async updateSource(id){if(failSecond && id==='b')throw Error('rejected b');this.evidence?.dispatched();this.evidence?.confirmed();}
  async checkSource(id,current){checkedIds.push(id);if(id==='a')await new Promise(resolve=>releaseCheck=resolve);assert.equal(current(),true,'accepted check survives route detachment');return {sourceId:id,traceId:'check:'+id,available:true,levelsPassed:['L1'],durationMs:1,hostEvidenceCount:0,logs:[]};}
  handlesSourceCleanup(){return true;}
}
runtime.saveBookSourceJson=async()=>exportCanceled?undefined:'file.json';
const projectPersistedReceipt=production('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',{projectOperationFacts});
const Tools=production('features/source/SourceToolsOrchestrator.ets','SourceToolsOrchestrator',{
  ReaderRuntimeOwner:{current:()=>runtime,isCurrent:owner=>owner===runtime},SourceGateway:Gateway,
  projectOperationFacts,projectCommitReadback,projectPersistedReceipt,ReaderWriteEvidence,
  hilog:{error(){}},
});

if(id==='tools-context'){
let latest; const host=new Tools(snapshot=>latest=snapshot,()=>current,runtime);
host.open(sources);await host.operationTail;host.setSelection(['a','b']);
await host.openEditor('a');await host.operationTail;host.updateEditorDraft('{"draft":"keep"}');
host.updateCheckSelection('explore',5);host.updateDebugKey('kept key');
const before=host.current();current=false;current=true;host.open(sources);await host.operationTail;
assert.deepEqual(host.current().selectedSourceIds,['a','b']);assert.equal(host.current().editorText,before.editorText);
assert.equal(host.current().debugKey,'kept key');assert.equal(host.current().checkMode,'explore');
host.exportSelected(['a','b']);await host.operationTail;assert.deepEqual(host.current().selectedSourceIds,['a','b'],'cancelled export retains selection');
failSecond=true;host.setSelectedEnabled(['a','b'],false);await host.operationTail;
assert.deepEqual(host.current().selectedSourceIds,['b'],'only the exact acknowledged item retires; rejected/unrun stays selected');
current=false;host.retireConfirmedSelection(['b']);assert.deepEqual(host.current().selectedSourceIds,[],'group ACK can retire selection while tools view is detached');


}else if(id==='tools-accepted-batch'){
// A finite, accepted batch stays owned by its runtime session. Leaving the
// page does not strand an internally 'running' progress card with busy=false.
current=true;const batchHost=new Tools(()=>{},()=>current,runtime);batchHost.open(sources);await batchHost.operationTail;
batchHost.checkSelected(['a','b']);await new Promise(resolve=>setImmediate(resolve));current=false;releaseCheck();await batchHost.operationTail;
assert.deepEqual(checkedIds,['a','b']);assert.equal(batchHost.current().batchCheck.phase,'completed');assert.equal(batchHost.current().busy,false);
current=true;batchHost.open(sources);await batchHost.operationTail;assert.equal(batchHost.current().batchCheck.completed,2,'reentry keeps the accepted batch results');


}
}

for(const id of selected){
if(id==='dto-contracts'){
// Production DTO validators. Transport and native I/O are absent in this test.
const { decodeSourceGroupCatalog, qualifySourceGroupReceipt, qualifySourceGroupedImport } = production(
  'features/source/SourceGroupGateway.ts', '({decodeSourceGroupCatalog,qualifySourceGroupReceipt,qualifySourceGroupedImport})');
const catalog = {version:1,revision:7,groups:[{groupId:'g1',name:'常用'}],memberships:[{sourceId:'a',groupId:'',locallyAssigned:true}]};
assert.deepEqual(decodeSourceGroupCatalog(catalog),catalog);
for (const bad of [ {...catalog,revision:-1}, {...catalog,groups:catalog.groups.concat(catalog.groups)},
  {...catalog,memberships:[{sourceId:'a',groupId:'missing',locallyAssigned:true}]},
  {...catalog,memberships:catalog.memberships.concat(catalog.memberships)} ]) assert.throws(()=>decodeSourceGroupCatalog(bad));
const assign = {expectedRevision:7,action:'assign',sourceIds:['a','b'],targetGroupId:'g1'};
const ack = {version:1,revision:8,action:'assign',groupId:'g1',affectedSourceIds:['b','a']};
assert.deepEqual(qualifySourceGroupReceipt(assign,ack).affectedSourceIds,['b','a']);
for (const bad of [{...ack,affectedSourceIds:['a']},{...ack,affectedSourceIds:['a','a']},{...ack,groupId:'another'}, {...ack,revision:6}]) assert.throws(()=>qualifySourceGroupReceipt(assign,bad));
const params = {expectedRevision:7,strategy:'preserve',items:[{sourceId:'a',bookSource:{}},{sourceId:'b',bookSource:{}}]};
const imported = {version:1,revision:8,importedCount:1,failedCount:1,results:[
  {index:0,sourceId:'a',status:'imported',name:'A',groupId:'',locallyAssigned:true},
  {index:1,sourceId:'b',status:'failed',error:'invalid rules'}]};
assert.equal(qualifySourceGroupedImport(params,imported).results[0].groupId,'');
for(const bad of [{...imported,results:imported.results.slice(0,1)}, {...imported,importedCount:2},
  {...imported,results:[imported.results[0],{...imported.results[1],sourceId:'a'}]},
  {...imported,results:[{...imported.results[0],locallyAssigned:undefined},imported.results[1]]}]) assert.throws(()=>qualifySourceGroupedImport(params,bad));


}else if(id==='tools-context'||id==='tools-accepted-batch'){
 await toolsCase(id);
}else if(id==='raw-source-projection'){
const runtime={};
const rawSource={bookSourceName:'Novel',bookSourceUrl:'a',bookSourceGroup:'原始分类',ruleSearch:{bookList:'body'}};
const calls=[];runtime.request=async(method,params)=>{calls.push([method,params]);return {data:{sources:[{sourceId:'a',name:'Novel',baseUrl:'a',bookSource:rawSource}]}};};
const RawGateway=production('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner:{current:()=>runtime,isCurrent:r=>r===runtime}});
assert.deepEqual(JSON.parse(await new RawGateway(runtime).loadEditableSource('a')),rawSource);
assert.deepEqual(calls,[['source.list',{sourceId:'a'}]],'raw editor must not use the locally grouped export projection');
const SourceProjection=selectedProductionMethods(new URL('../entry/src/main/ets/features/source/SourceOrchestrator.ets',import.meta.url),'SourceOrchestrator',['presentSources','sourceCheckSignature']);
const projection=new SourceProjection();let displayed;
Object.assign(projection,{checkingSourceIds:new Map(),checkResults:new Map([['a',{sourceVersion:'old',checkState:'failed'}]]),session:1,isCurrentSession:()=>true,emit:value=>displayed=value});
projection.presentSources([{...source('a'),groupId:'g-stable',sourceVersion:'new',checkState:'passed',lastCheckSummary:'persisted result',checkReports:[]}]);
assert.equal(displayed[0].groupId,'g-stable');assert.equal(displayed[0].checkState,'passed','old-rule in-memory failure cannot override the current persisted report');
assert.equal(displayed[0].lastCheckSummary,'persisted result');

}else if(id==='startup-plan-forwarding'){
// Execute actual startup up to the fake create boundary. Identity methods
// below are explicit gates/ordering ports, not identity-validation evidence.
// The synthetic fixture plan is not a supported production schema claim.
let startup, capturedConfig, order = [];
const probe = {buildIdentity:{},observation:{requiresMigration:true,explicitMigration:{sourceSchemaVersion:44,targetSchemaVersion:48}}};
const Startup=selectedProductionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),'ReaderRuntimeOwner',['startRuntime'],{
 ReaderStartupTrace:{measure:(_label,action)=>action()},
 probeReaderCoreStorageAsync:async()=>{order.push('probe');return probe;},
 createReaderCoreRuntimeAsync:async(config,current)=>{assert.equal(current(),true);order.push('create');capturedConfig=config;throw Error('stop before native');},
});
Startup.isCurrent=value=>value===startup;
startup=new Startup();Object.assign(startup,{state:'starting',host:{needsLegacySnapshotMigration:async()=>false,getContext:()=>({filesDir:'/private/app'})},
 requireCoreBuildIdentity(){order.push('build-identity');},async requireStorageProbeIdentity(){order.push('storage-identity');}});
await assert.rejects(startup.startRuntime(),/stop before native/);
assert.deepEqual(capturedConfig,{dataDirectory:'/private/app/reader-core',storageMigration:probe.observation.explicitMigration});
assert.deepEqual(order,['probe','build-identity','storage-identity','create']);
assert.equal(capturedConfig.storageMigration,probe.observation.explicitMigration,'Host forwards the original Core-owned plan object');
probe.observation.requiresMigration=false;probe.observation.explicitMigration=null;startup.state='starting';order=[];
await assert.rejects(startup.startRuntime(),/stop before native/);
assert.deepEqual(capturedConfig,{dataDirectory:'/private/app/reader-core'},'ordinary open never adds an implicit migration');

// Refusing the storage identity gate must stop before create/config admission.
startup.state='starting';order=[];capturedConfig=undefined;
startup.requireStorageProbeIdentity=async()=>{order.push('storage-identity-denied');throw Error('fixture identity denied');};
await assert.rejects(startup.startRuntime(),/fixture identity denied/);
assert.deepEqual(order,['probe','build-identity','storage-identity-denied']);assert.equal(capturedConfig,undefined);

}
recordContractCasePass(id);
}

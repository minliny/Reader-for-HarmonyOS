import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const { resolveEtsLoaderRoot, virtualFilePath }=await import("./lib/tool-environment.mjs");
const {createRequire}=await import("node:module");
const {createReaderBuilderProbe}=await import("./lib/reader-control-builder-probe.mjs");
const {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync}=await import("node:fs");
const {tmpdir}=await import("node:os");
const {join}=await import("node:path");
const {syncIndexFixture: f,fullSyncIndexPage}=await import("./lib/sync-index-real-fixture.mjs");
const {createBackupJournalFixture}=await import('./fixtures/sync/backup-journal-fixture.mjs');const scope=createBackupJournalFixture();const {fixture,directory,operation,open,retry,tick}=scope;
async function unknown(){const x=fixture();await open(x);x.runtime.failBackupAdvance=true;x.owner.triggerBackup();await x.settle();return x;}
async function qualify(x){x.qualifyRemote();await retry(x);assert.equal(operation(x).uploadQualified,true);assert.equal(operation(x).completed,false);}
try {
if(id==='consent'){
{
  const x=await unknown();const generation=operation(x).projection.facts.generation;
  assert.equal(x.page().skipAction,undefined,'unknown upload offers no finish-cleanup action');x.owner.skipBackupRetention(generation);await x.settle();assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0);
  await qualify(x);const old=x.page().skipAction;assert.equal(old.accessibilityText,'保留备份，结束清理');
  assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0,'GET qualification alone never settles');
  x.removeRemote();old.onClick();await x.settle();assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0,'prior UI qualification cannot replace current exact proof');assert.equal(x.snapshot().facts.canMutate,false);
  x.qualifyRemote();const current=x.page().skipAction;current.onClick();current.onClick();await x.settle();
  assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1);assert.equal(operation(x).retentionSkipped,true);assert.equal(operation(x).completed,false);
  assert.equal(x.snapshot().facts.canMutate,true);assert.equal(x.page().skipAction,undefined);assert.match(x.snapshot().statusMessage,/清理.*结束/);assert.doesNotMatch(x.snapshot().statusMessage,/已取消|清理完成/);
  assert.deepEqual(x.requests.filter(r=>r.method!=='PUT').map(r=>r.method),['GET','GET','GET']);assert.equal(x.requests.filter(r=>r.method==='PUT').length,1,'only original publication PUT exists');
  const count=x.runtime.calls.length;old.onClick();await x.settle();assert.equal(x.runtime.calls.length,count,'retired physical generation never submits terminal command');
  const id=operation(x).operationId;const cold=fixture({cold:true});cold.settleCore('retentionSkipped',true,false);await open(cold);
  assert.equal(operation(cold).operationId,id);assert.equal(operation(cold).retentionSkipped,true);assert.equal(operation(cold).completed,false);assert.equal(cold.snapshot().facts.canMutate,true);assert.equal(cold.requests.length,0);
  cold.owner.saveConfig(f.config.url,f.config.user,'','',f.config.directory);await cold.settle();assert.equal(f.asset.calls.filter(v=>v==='add').length,1,'exact local terminal receipt admits a later config save');assert.equal(await cold.store.loadBackupJournal(),undefined);
 }
}
if(id==='lost-ack'){
{
  const x=await unknown();await qualify(x);x.loseSkipAck();x.page().skipAction.onClick();await x.settle();
  assert.equal(operation(x).retentionSkipped,false,'lost terminal ACK does not manufacture local settlement');assert.equal(x.snapshot().facts.canMutate,false);
  const requests=x.requests.length;await retry(x);assert.equal(operation(x).retentionSkipped,true);assert.equal(operation(x).completed,false);assert.equal(x.snapshot().facts.canMutate,true);
  assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1,'read-only exact terminal receipt settles lost ACK without replay');assert.equal(x.requests.length,requests);
 }
}
if(id==='route-retirement'){
{
  const x=await unknown();await qualify(x);const old=x.page().skipAction;
  x.close();const count=x.runtime.calls.length;old.onClick();await x.settle();assert.equal(x.runtime.calls.length,count);
  x.reopen();await x.settle();const before=x.runtime.calls.length;old.onClick();await x.settle();assert.equal(x.runtime.calls.length,before,'old route generation remains retired after reopen');
 }
}
if(id==='runtime-retirement'){
{
  const x=await unknown();await qualify(x);const gate=f.pause();x.pauseSkip(gate);x.page().skipAction.onClick();for(let n=0;x.runtime.count('sync.webdav.backup.retention.skip')===0&&n<2000;n++)await new Promise(setImmediate);assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1,'actual terminal dispatch before retirement');
  const before=x.emitted.length;f.setRuntimeOwner(undefined);gate.resolve();await x.settle();assert.equal(x.emitted.length,before,'late actual terminal ACK cannot publish into retired owner');
  f.setRuntimeOwner(x.runtime);x.reopen();await x.settle();await retry(x);assert.equal(operation(x).retentionSkipped,true);assert.equal(operation(x).completed,false);
 }
}
if(id==='origin'){
{
  const x=await unknown();await qualify(x);const old=x.page().skipAction;
  f.asset.record=new TextEncoder().encode(JSON.stringify({formatVersion:2,config:{...f.config,url:'https://other.test'}}));const count=x.requests.length;old.onClick();await x.settle();assert.equal(x.requests.length,count);assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0,'changed origin cannot end unresolved original publication');
 }
}
if(id==='page-consumer'){
{
  const x=await unknown();await qualify(x);let selected;
  const full=fullSyncIndexPage({snapshot:x.snapshot(),isTablet:false,onSkipBackupRetention:g=>{selected=g;x.owner.skipBackupRetention(g);}});
  const child=[...full.children.values()].find(c=>c.params?.label==='保留备份，结束清理');assert.ok(child,'complete decorated SDK Page consumes finite shared action');
  child.params.onReconcile(child.params.generation);await x.settle();assert.equal(selected,child.params.generation);assert.equal(operation(x).retentionSkipped,true);
 }
}
if(id==='retained-actor'){
{
  const x=await unknown();await qualify(x);
  const sdk=resolveEtsLoaderRoot();
  const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
  const text=f.source('features/common/ReaderRecoveryAction.ets'),tree=ts.createSourceFile(virtualFilePath('ReaderRecoveryAction.ets'),text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  const names=tree.statements.find(n=>n.members&&n.name?.text==='ReaderRecoveryAction').members.map(n=>n.name?.getText(tree)).filter(Boolean);
  const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');const actionSdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
  class ActualAction{
   constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});this.actor=actionSdk.consumer(text,names,{},params);this.actor.initialRender();}
   updateStateVars(params){Object.assign(this.params,params);this.actor.updateStateVars(params);this.actor.replay();}
  }
  const parent=fullSyncIndexPage({snapshot:x.snapshot(),isTablet:false,onSkipBackupRetention:g=>x.owner.skipBackupRetention(g)},{ReaderRecoveryAction:ActualAction},{allowEmptyBranchAdmission:true});
  const first=[...parent.children.values()].find(c=>c.params?.label==='保留备份，结束清理');const old=[...first.actor.nodes.values()].find(v=>v.type==='Stack'&&v.constraintSize?.minHeight===44&&v.onClick).onClick;const oldGeneration=first.actor.generation;
  // Retained V1 instance accepts actual Props only; ordinary callback is not
  // refreshed. Busy updates must still suppress its real native action.
  first.updateStateVars({...first.params,actionEnabled:false,onReconcile:()=>{throw Error('ordinary callback must not be rebound');}});old();await x.settle();assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0);
  first.updateStateVars({...first.params,actionEnabled:true});
  const observerCount=parent.observers.length;await retry(x);parent.updateStateVars({snapshot:x.snapshot()});parent.replay();
  assert.equal(parent.observers.length,observerCount+1,'only one new consent actor is admitted; Page/config/history actors remain retained');
  const actors=[...parent.children.values()].filter(c=>c.params?.label==='保留备份，结束清理');assert.equal(actors.length,2,'only exact receipt action is keyed, Page remains mounted');
  assert.equal(first.actor.generation,oldGeneration,'retired actor does not acquire successor generation through Prop refresh');
  old();await x.settle();assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0);
  const current=actors.at(-1);assert.notEqual(current.actor.generation,oldGeneration);
  [...current.actor.nodes.values()].find(v=>v.type==='Stack'&&v.constraintSize?.minHeight===44&&v.onClick).onClick();await x.settle();assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1);assert.equal(operation(x).retentionSkipped,true);
 }
}
}finally{scope.cleanup();}
}
const definitions={"consent": "consent; actual production methods with explicit controlled platform ports", "lost-ack": "lost-ack; actual production methods with explicit controlled platform ports", "route-retirement": "route-retirement; actual production methods with explicit controlled platform ports", "runtime-retirement": "runtime-retirement; actual production methods with explicit controlled platform ports", "origin": "origin; actual production methods with explicit controlled platform ports", "page-consumer": "page-consumer; actual production methods with explicit controlled platform ports", "retained-actor": "retained-actor; actual production methods with explicit controlled platform ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}

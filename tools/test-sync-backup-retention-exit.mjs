import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {syncIndexFixture as f,fullSyncIndexPage} from './lib/sync-index-real-fixture.mjs';
// Reuse actual file Preferences/journal/Gateway/owner/SDK fixture; typed Core
// injection remains a different tier from real Rust SQLite/hash tests.
const fixtureUrl=new URL('./test-sync-backup-durable-receipts.mjs',import.meta.url);
const prefix=readFileSync(fixtureUrl,'utf8').split('try {')[0].replace(/^import[^\n]+\n/gm,'');
const {fixture,directory,operation,open,retry}=new Function('assert','mkdtempSync','readFileSync','writeFileSync','existsSync','rmSync','tmpdir','join','f',prefix+';return {fixture,directory,operation,open,retry};')(assert,mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync,tmpdir,join,f);
async function unknown(){const x=fixture();await open(x);x.runtime.failBackupAdvance=true;x.owner.triggerBackup();await x.settle();return x;}
async function qualify(x){x.qualifyRemote();await retry(x);assert.equal(operation(x).uploadQualified,true);assert.equal(operation(x).completed,false);}
try {
 {
  const x=await unknown();const generation=operation(x).projection.facts.generation;
  assert.equal(x.page().skipAction,undefined,'unknown upload offers no finish-cleanup action');x.owner.skipBackupRetention(generation);await x.settle();assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0);
  await qualify(x);const old=x.page().skipAction;assert.equal(old.create,'保留备份，结束清理');
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
 {
  const x=await unknown();await qualify(x);x.loseSkipAck();x.page().skipAction.onClick();await x.settle();
  assert.equal(operation(x).retentionSkipped,false,'lost terminal ACK does not manufacture local settlement');assert.equal(x.snapshot().facts.canMutate,false);
  const requests=x.requests.length;await retry(x);assert.equal(operation(x).retentionSkipped,true);assert.equal(operation(x).completed,false);assert.equal(x.snapshot().facts.canMutate,true);
  assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1,'read-only exact terminal receipt settles lost ACK without replay');assert.equal(x.requests.length,requests);
 }
 {
  const x=await unknown();await qualify(x);const old=x.page().skipAction;
  x.close();const count=x.runtime.calls.length;old.onClick();await x.settle();assert.equal(x.runtime.calls.length,count);
  x.reopen();await x.settle();const before=x.runtime.calls.length;old.onClick();await x.settle();assert.equal(x.runtime.calls.length,before,'old route generation remains retired after reopen');
 }
 {
  const x=await unknown();await qualify(x);const gate=f.pause();x.pauseSkip(gate);x.page().skipAction.onClick();for(let n=0;x.runtime.count('sync.webdav.backup.retention.skip')===0&&n<2000;n++)await new Promise(r=>setTimeout(r,1));assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1,'actual terminal dispatch before retirement');
  const before=x.emitted.length;f.setRuntimeOwner(undefined);gate.resolve();await x.settle();assert.equal(x.emitted.length,before,'late actual terminal ACK cannot publish into retired owner');
  f.setRuntimeOwner(x.runtime);x.reopen();await x.settle();await retry(x);assert.equal(operation(x).retentionSkipped,true);assert.equal(operation(x).completed,false);
 }
 {
  const x=await unknown();await qualify(x);const old=x.page().skipAction;
  f.asset.record=new TextEncoder().encode(JSON.stringify({formatVersion:2,config:{...f.config,url:'https://other.test'}}));const count=x.requests.length;old.onClick();await x.settle();assert.equal(x.requests.length,count);assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0,'changed origin cannot end unresolved original publication');
 }
 {
  const x=await unknown();await qualify(x);let selected;
  const full=fullSyncIndexPage({snapshot:x.snapshot(),isTablet:false,onSkipBackupRetention:g=>{selected=g;x.owner.skipBackupRetention(g);}});
  const child=[...full.children.values()].find(c=>c.params?.label==='保留备份，结束清理');assert.ok(child,'complete decorated SDK Page consumes finite shared action');
  child.params.onReconcile(child.params.generation);await x.settle();assert.equal(selected,child.params.generation);assert.equal(operation(x).retentionSkipped,true);
 }
 {
  const x=await unknown();await qualify(x);
  const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
  const text=f.source('features/common/ReaderRecoveryAction.ets'),tree=ts.createSourceFile('/tmp/ReaderRecoveryAction.ets',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  const names=tree.statements.find(n=>n.members&&n.name?.text==='ReaderRecoveryAction').members.map(n=>n.name?.getText(tree)).filter(Boolean);
  class Property{constructor(value,owner,name){Object.assign(this,{value,owner,name});}get(){return this.value;}set(v){this.value=v;}reset(v){this.set(v);}purgeDependencyOnElmtId(){}aboutToBeDeleted(){}}
  class ActualAction{
   constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});this.actor=createReaderBuilderProbe(text,names,
    {...Object.fromEntries(['ObservedPropertySimplePU','ObservedPropertyObjectPU','SynchedPropertySimpleOneWayPU','SynchedPropertyObjectOneWayPU'].map(k=>[k,Property]))},{initialParams:params}).owner;this.actor.initialRender();}
   updateStateVars(params){Object.assign(this.params,params);this.actor.updateStateVars(params);this.actor.replay();}
  }
  const parent=fullSyncIndexPage({snapshot:x.snapshot(),isTablet:false,onSkipBackupRetention:g=>x.owner.skipBackupRetention(g)},{ReaderRecoveryAction:ActualAction},{allowEmptyBranchAdmission:true});
  const first=[...parent.children.values()].find(c=>c.params?.label==='保留备份，结束清理');const old=[...first.actor.nodes.values()].find(v=>v.height===36).onClick;const oldGeneration=first.actor.generation;
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
  [...current.actor.nodes.values()].find(v=>v.height===36).onClick();await x.settle();assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1);assert.equal(operation(x).retentionSkipped,true);
 }
 console.log('PASS actual Preferences→journal→Gateway→owner→SDK bounded retention exit: explicit consent after exact GET, unknown/404/origin/old generation/owner rejection, no PUT/DELETE replay, lost local ACK pure read, cold terminal rehydrate, skipped != completed, next config unlock. Paired Core SQLite/hash tests separate; Native/HAP/target OPEN.');
} finally {rmSync(directory,{recursive:true,force:true});}

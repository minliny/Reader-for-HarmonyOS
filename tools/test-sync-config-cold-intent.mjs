import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const { resolveEtsLoaderRoot, virtualFilePath }=await import("./lib/tool-environment.mjs");
const {readFileSync,existsSync}=await import("node:fs");
const {randomUUID}=await import("node:crypto");
const {configIntentFixture}=await import("./lib/sync-config-intent-fixture.mjs");
const {fullSyncIndexPage}=await import("./lib/sync-index-real-fixture.mjs");
const {createRequire}=await import("node:module");
const {createReaderBuilderProbe}=await import("./lib/reader-control-builder-probe.mjs");
const fixtures=[];
const fresh=previous=>{const f=configIntentFixture(previous);fixtures.push(f);return f;};
const open=async x=>{x.owner.open();await x.settle();};
const save=async (f,x,c=f.config)=>{x.owner.saveConfig(c.url,c.user,c.password,c.backupPassword,c.directory);await x.settle();};
const operation=x=>x.snapshot().facts.operation;
const adds=f=>f.asset.calls.filter(c=>c==='add').length;
const intentPath=f=>f.directory()+'/reader-webdav-config-intent-v1.json';
const headPath=f=>f.directory()+'/reader-webdav-config-head-v1.json';
const alias=id=>'reader.webdav.config-save.'+id;
const metadata=f=>{const raw=readFileSync(intentPath(f),'utf8');return raw===''?undefined:JSON.parse(raw);};
const continuation=async x=>{const a=x.page().continueAction;assert.ok(a,'actual SDK shared continuation action');a.onClick();a.onClick();await x.settle();};
const reconcile=async x=>{x.page().action.onClick();await x.settle();};
const atomicFault=(f,when,after=true)=>{
 const finish=f.fileIo.AtomicFile.prototype.finishWrite;let hit=false;
 f.fileIo.AtomicFile.prototype.finishWrite=function(){const raw=readFileSync(this.temp,'utf8');if(!hit&&when(this.path,raw)){hit=true;if(after)finish.call(this);throw Error('injected Atomic ACK loss');}finish.call(this);};
 return ()=>{f.fileIo.AtomicFile.prototype.finishWrite=finish;assert.ok(hit,'actual production Atomic boundary reached');};
};
let checks=0;

try {
if(id==='cold-original'){
{
  const f=fresh(),x=f.fixture();await open(x);f.asset.failAdd=true;await save(f,x);const original=operation(x);assert.equal(original.projection.receipt.confirmation,'unknown');
  assert.equal(metadata(f).operationId,original.operationId);assert.ok(f.asset.records.has(alias(original.operationId)));assert.equal(await x.store.hasSaveReceipt(original.operationId),false,'prepared immutable record is not current-head authority');
  const cold=fresh(f),y=cold.fixture({preserveAsset:true});await open(y);assert.equal(operation(y).operationId,original.operationId);assert.equal(y.snapshot().facts.canMutate,false);assert.equal(adds(cold),0);
  assert.equal(await new cold.Gateway(y.runtime,y.store).recoverInterruptedRestore(),false,'no restore journal leaves unrelated startup/appearance recovery available');
  const calls=cold.asset.calls.length;y.owner.saveConfig(cold.config.url,cold.config.user,'','',cold.config.directory);y.owner.triggerBackup();y.owner.restoreLatest();await y.settle();assert.equal(cold.asset.calls.length,calls);assert.equal(y.runtime.calls.length,0);
  await reconcile(y);assert.equal(operation(y).projection.receipt.confirmation,'unknown');assert.equal(adds(cold),0,'pure exact query does not re-submit Asset or head');
  await continuation(y);assert.equal(operation(y).projection.receipt.confirmation,'confirmed');assert.equal(operation(y).operationId,original.operationId);assert.equal(adds(cold),0);assert.equal(metadata(cold),undefined);assert.equal(y.snapshot().facts.canMutate,true);
  assert.doesNotMatch(JSON.stringify(y.snapshot()),/transient-secret|independent-secret|password/,'UI only contains non-secret finite intent metadata');checks++;
 }
}
if(id==='exact-input'){
{
  const f=fresh(),x=f.fixture();await open(x);const original={...f.config,password:'original-second-secret',backupPassword:'second-backup-secret'};
  f.asset.beforeAdd=()=>{throw Error('original dispatch reply lost before native effect');};await save(f,x,original);const id=operation(x).operationId;f.asset.beforeAdd=undefined;
  const cold=fresh(f),y=cold.fixture({preserveAsset:true});await open(y);assert.equal(operation(y).operationId,id);assert.equal(y.snapshot().configSavePayloadAvailable,false);assert.equal(adds(cold),0);
  await reconcile(y);assert.equal(operation(y).projection.receipt.confirmation,'unknown');assert.equal(metadata(cold).operationId,id);
  const g=operation(y).projection.facts.generation;y.owner.continueConfigSave(g,original.url,original.user,f.config.password,f.config.backupPassword,original.directory);await y.settle();assert.equal(adds(cold),0);assert.equal(metadata(cold).operationId,id,'wrong exact input keeps original intent');
  y.owner.continueConfigSave(operation(y).projection.facts.generation,original.url,original.user,original.password,original.backupPassword,original.directory);await y.settle();assert.equal(operation(y).operationId,id);assert.equal(operation(y).completed,true);assert.equal(adds(cold),1);
  assert.equal((await y.store.loadSerializedState()).config.password,original.password);assert.equal(metadata(cold),undefined);checks++;
 }
}
if(id==='prepared-atomic'){
for(const after of [false,true]) {
  const f=fresh(),x=f.fixture();await open(x);const restore=atomicFault(f,(path,raw)=>path===intentPath(f)&&raw.includes('prepared'),after);await save(f,x);restore();assert.equal(adds(f),0);
  const original=operation(x).operationId;assert.ok(original);assert.equal(operation(x).projection.receipt.confirmation,'unknown');assert.equal((await x.store.loadConfigIntent()).operationId,original,'warm unknown retained even absent durable preparation');
  if(after){const cold=fresh(f),y=cold.fixture({preserveAsset:true});await open(y);assert.equal(operation(y).operationId,original);assert.equal(y.snapshot().facts.canMutate,false);y.owner.continueConfigSave(operation(y).projection.facts.generation,f.config.url,f.config.user,f.config.password,f.config.backupPassword,f.config.directory);await y.settle();assert.equal(operation(y).operationId,original);assert.equal(operation(y).completed,true);}
  else {x.owner.continueConfigSave(operation(x).projection.facts.generation,f.config.url,f.config.user,f.config.password,f.config.backupPassword,f.config.directory);await x.settle();assert.equal(operation(x).completed,true);}
  checks++;
 }
}
if(id==='head-cleanup-atomic'){
for(const target of ['head','cleanup']) {
  const f=fresh(),x=f.fixture();await open(x);const restore=atomicFault(f,(path,raw)=>target==='head'?path===headPath(f):path===intentPath(f)&&raw==='');await save(f,x);restore();const id=operation(x).operationId;
  assert.equal(JSON.parse(readFileSync(headPath(f),'utf8')).operationId,id);assert.equal(adds(f),1);assert.equal(x.snapshot().facts.canMutate,false);
  const cold=fresh(f),y=cold.fixture({preserveAsset:true});await open(y);
  if(target==='head'){assert.equal(operation(y).completed,false);assert.equal(y.snapshot().facts.canMutate,false);await reconcile(y);}
  // cleanup Atomic publication actually completed before the synthetic ACK
  // loss; a cold process has no original intent and reads exact committed head.
  assert.equal(operation(y).operationId,id);assert.equal(operation(y).completed,true);assert.equal(metadata(cold),undefined);assert.equal(adds(cold),0);checks++;
 }
}
if(id==='same-file-queue'){
{
  const f=fresh(),x=f.fixture();await open(x);const gate=f.pause();f.asset.beforeAdd=()=>gate.promise;
  x.owner.saveConfig(f.config.url,f.config.user,'','',f.config.directory);await f.until(()=>adds(f)===1);const store=new f.Store();store.attachContext({filesDir:f.directory()});
  let readCompleted=false;const read=store.loadSerializedState().then(v=>{readCompleted=true;return v;});await new Promise(setImmediate);assert.equal(readCompleted,false,'same-file queue orders Stores');x.close();gate.resolve();await x.settle();await read;
  f.asset.beforeAdd=undefined;x.reopen();await x.settle();assert.equal(operation(x).projection.receipt.confirmation,'unknown');assert.equal(adds(f),1);await continuation(x);assert.equal(operation(x).completed,true);checks++;
 }
}
if(id==='context-retirement'){
{
  const f=fresh(),x=f.fixture();await open(x);const gate=f.pause();f.asset.beforeAdd=()=>gate.promise;x.owner.saveConfig(f.config.url,f.config.user,'','',f.config.directory);await f.until(()=>adds(f)===1);
  x.store.attachContext({filesDir:f.directory()+'/retired-other-dir'});gate.resolve();await x.settle();assert.equal(existsSync(headPath(f)),false);assert.ok(metadata(f));assert.equal(adds(f),1);checks++;
 }
}
if(id==='late-add'){
{
  const f=fresh(),x=f.fixture();await open(x);const originalAdd=f.asset.add;let late;
  f.asset.add=async function(attributes){late=attributes;this.calls.push('add');throw Error('native reply lost, actual add deferred');};await save(f,x);f.asset.add=originalAdd;const original=operation(x).operationId;
  const cold=fresh(f),y=cold.fixture({preserveAsset:true});await open(y);y.owner.continueConfigSave(operation(y).projection.facts.generation,f.config.url,f.config.user,f.config.password,f.config.backupPassword,f.config.directory);await y.settle();assert.equal(operation(y).operationId,original);assert.equal(operation(y).completed,true);
  const newer={...f.config,url:'https://newer.test',password:'new-secret',backupPassword:'new-backup-secret'};await save(cold,y,newer);const current=operation(y).operationId;assert.notEqual(current,original);
  await originalAdd.call(f.asset,late);assert.equal((await y.store.loadSerializedState()).saveOperationId,current);assert.equal((await y.store.loadSerializedState()).config.url,newer.url,'late original immutable record cannot change head');
  await assert.rejects(y.store.save(f.config,undefined,undefined,original),/historical record/,'pruned old UUID cannot become a new save');checks++;
 }
}
if(id==='late-remove'){
{
  const f=fresh(),x=f.fixture();await open(x);await save(f,x);const old=operation(x).operationId;
  const remove=f.asset.remove;let late;f.asset.remove=async function(query){const a=new TextDecoder().decode(query.get(1));if(a===alias(old)){late=query;this.calls.push('remove');throw Error('old remove reply lost before delayed effect');}return remove.call(this,query);};
  const next={...f.config,url:'https://second.test'};await save(f,x,next);const second=operation(x).operationId;assert.equal(x.snapshot().facts.canMutate,false);f.asset.remove=remove;
  const cold=fresh(f),y=cold.fixture({preserveAsset:true});await open(y);assert.equal(operation(y).operationId,second);assert.equal(y.snapshot().facts.canMutate,false);await reconcile(y);assert.equal(operation(y).completed,true);
  await save(cold,y,{...f.config,url:'https://third.test'});const third=operation(y).operationId;await remove.call(f.asset,late);assert.equal((await y.store.loadSerializedState()).saveOperationId,third);assert.ok(f.asset.records.has(alias(third)));checks++;
 }
}
if(id==='bad-payload'){
{
  const f=fresh(),x=f.fixture();await open(x);f.asset.beforeAdd=()=>{throw Error('unknown original');};await save(f,x);f.asset.beforeAdd=undefined;const id=operation(x).operationId;
  await assert.rejects(x.store.save(f.config,undefined,undefined,randomUUID()),/previous configuration intent/);assert.equal(metadata(f).operationId,id);
  const raw=JSON.parse(readFileSync(intentPath(f),'utf8'));raw.payloadHash='b'.repeat(64);const fs=await import('node:fs');fs.writeFileSync(intentPath(f),JSON.stringify(raw));
  const cold=fresh(f),y=cold.fixture({preserveAsset:true});await open(y);assert.equal(y.snapshot().facts.canMutate,false);assert.equal(operation(y).operationId,id);assert.equal(operation(y).projection.receipt.confirmation,'unknown');
  y.owner.continueConfigSave(operation(y).projection.facts.generation,f.config.url,f.config.user,f.config.password,f.config.backupPassword,f.config.directory);await y.settle();assert.equal(adds(cold),0);checks++;
 }
}
if(id==='corrupt-head'){
for(const corrupt of ['head','immutable']) {
  const f=fresh(),x=f.fixture();await open(x);await save(f,x);const id=operation(x).operationId;
  if(corrupt==='head'){const fs=await import('node:fs');fs.writeFileSync(headPath(f),JSON.stringify({version:1,operationId:id,payloadHash:'bad'}));}
  else {const bytes=f.asset.records.get(alias(id)),record=JSON.parse(new TextDecoder().decode(bytes));record.config.password='wrong-secret';f.asset.records.set(alias(id),new TextEncoder().encode(JSON.stringify(record)));}
  const cold=fresh(f),y=cold.fixture({preserveAsset:true});await open(y);assert.equal(y.snapshot().facts.read.fact,'failed');const calls=adds(cold);await save(cold,y);assert.equal(adds(cold),calls);assert.equal(y.runtime.calls.length,0);checks++;
 }
}
if(id==='retained-actor'){
{
  const f=fresh(),x=f.fixture();await open(x);f.asset.failAdd=true;await save(f,x);const calls=[];
  const sdk=resolveEtsLoaderRoot();
  const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
  const text=f.source('features/common/ReaderRecoveryAction.ets'),tree=ts.createSourceFile(virtualFilePath('ReaderRecoveryAction.ets'),text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  const names=tree.statements.find(n=>n.members&&n.name?.text==='ReaderRecoveryAction').members.map(n=>n.name?.getText(tree)).filter(Boolean);
  const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');const actionSdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
  class ActualAction{
   constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});this.actor=actionSdk.consumer(text,names,{},params);this.actor.initialRender();}
   updateStateVars(params){Object.assign(this.params,params);this.actor.updateStateVars(params);this.actor.replay();}
  }
  const page=fullSyncIndexPage({snapshot:x.snapshot(),isTablet:false,onContinueConfigSave:(...args)=>{calls.push(args);x.owner.continueConfigSave(...args);}}, {ReaderRecoveryAction:ActualAction},{allowEmptyBranchAdmission:true});
  const first=[...page.children.values()].find(c=>c.params?.label==='继续原操作');assert.ok(first);const physical=child=>[...child.actor.nodes.values()].find(v=>v.type==='Stack'&&v.constraintSize?.minHeight===44&&v.onClick).onClick;
  const oldClick=physical(first),oldGeneration=first.actor.generation,observers=page.observers.length;
  first.updateStateVars({...first.params,actionEnabled:false,onReconcile:()=>{throw Error('ordinary callback must not refresh');}});oldClick();await x.settle();assert.equal(calls.length,0,'actual busy Prop suppresses physical action');first.updateStateVars({...first.params,actionEnabled:true});await reconcile(x);assert.notEqual(operation(x).projection.facts.generation,oldGeneration);page.webdavUrl='https://draft-retained.test';page.webdavUrlEdited=true;
  page.updateStateVars({snapshot:x.snapshot()});page.replay();assert.equal(page.observers.length,observers+1,'only one keyed continuation actor enters, Page is retained');oldClick();await x.settle();assert.equal(metadata(f).operationId,operation(x).operationId);assert.equal(operation(x).completed,false,'stale physical original action rejects changed generation');
  const current=[...page.children.values()].filter(c=>c.params?.label==='继续原操作').find(c=>c.params.generation===operation(x).projection.facts.generation);assert.ok(current,'fresh keyed actor owns new generation');assert.equal(first.actor.generation,oldGeneration,'retained V1 old actor does not borrow successor generation');physical(current)();await x.settle();assert.equal(operation(x).completed,true);assert.equal(page.webdavUrl,'https://draft-retained.test');assert.equal(calls.length,2);assert.equal(calls[0][0],oldGeneration);checks++;
 }
}
}finally{for(const f of fixtures)f.cleanup();}
}
const definitions={"cold-original": "cold-original; actual production methods with explicit controlled platform ports", "exact-input": "exact-input; actual production methods with explicit controlled platform ports", "prepared-atomic": "prepared-atomic; actual production methods with explicit controlled platform ports", "head-cleanup-atomic": "head-cleanup-atomic; actual production methods with explicit controlled platform ports", "same-file-queue": "same-file-queue; actual production methods with explicit controlled platform ports", "context-retirement": "context-retirement; actual production methods with explicit controlled platform ports", "late-add": "late-add; actual production methods with explicit controlled platform ports", "late-remove": "late-remove; actual production methods with explicit controlled platform ports", "bad-payload": "bad-payload; actual production methods with explicit controlled platform ports", "corrupt-head": "corrupt-head; actual production methods with explicit controlled platform ports", "retained-actor": "retained-actor; actual production methods with explicit controlled platform ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}

import { randomUUID } from 'node:crypto';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const require=createRequire(import.meta.url);
const syntax=require((process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader')+'/lib/validate_ui_syntax.js');
const source = p => readFileSync(new URL(`../entry/src/main/ets/${p}`,import.meta.url),'utf8');
syntax.builderParamObjectCollection.set('ReaderCard',new Set([...source('features/common/ReaderCard.ets').matchAll(/@BuilderParam\s+(\w+):/g)].map(m=>m[1])));
const ordinary = text => stripTypeScriptTypes(text.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const execute = (p,n,deps={})=>new Function(...Object.keys(deps),ordinary(source(p))+`;return ${n};`)(...Object.values(deps));
const facts=execute('app/ReaderOperationFacts.ts','({projectOperationFacts,projectCommitReadback})');
const projectPersistedReceipt=execute('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
const readerRecoveryView=execute('app/ReaderRecoveryProjection.ts','readerRecoveryView');
const ReaderWriteEvidence=execute('app/ReaderWriteEvidence.ts','ReaderWriteEvidence');
const SyncWriteObservation=execute('features/sync/SyncOperationProjection.ts','SyncWriteObservation',{ReaderWriteEvidence});
const config={url:'https://example.test',user:'reader',password:'transient-secret',backupPassword:'independent-secret',directory:'/backup'};
const checksum='a'.repeat(64);
const clone=v=>v===undefined?undefined:structuredClone(v);
const pause=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
const util={generateRandomUUID:()=>randomUUID(),TextEncoder:globalThis.TextEncoder,TextDecoder:{create:()=>({decodeToString:b=>new TextDecoder('utf8',{fatal:true}).decode(b)})},Base64Helper:class {encodeToStringSync(v){return Buffer.from(v).toString('base64');}}};
const asset={Tag:{ALIAS:1,RETURN_TYPE:2,SECRET:3,ACCESSIBILITY:4,CONFLICT_RESOLUTION:5},ReturnType:{ALL:1},Accessibility:{DEVICE_POWERED_ON:1},ConflictResolution:{OVERWRITE:1},ErrorCode:{NOT_FOUND:100},record:undefined,calls:[],failAdd:false,failQuery:false,beforeAdd:undefined,
  async query(){this.calls.push('query');if(this.failQuery){this.failQuery=false;throw Error('read unavailable');}return this.record?[new Map([[3,this.record]])]:[];},
  async add(attributes){this.calls.push('add');if(this.beforeAdd)await this.beforeAdd();this.record=attributes.get(3);if(this.failAdd){this.failAdd=false;throw Error('lost Asset ACK');}},
  async remove(){this.calls.push('remove');this.record=undefined;},
};
let preferenceValues=new Map();
let nativePreferences={async get(key,fallback){return preferenceValues.has(key)?preferenceValues.get(key):fallback;},async has(key){return preferenceValues.has(key);},async put(key,value){preferenceValues.set(key,value);},async delete(key){preferenceValues.delete(key);},async flush(){}};
const Store=execute('features/sync/WebDavCredentialStore.ts','WebDavCredentialStore',{asset,util,preferences:{getPreferences:async()=>nativePreferences},errorMessageOf:()=> 'platform failure'});
let currentOwner,credentialStore,hostFailures=0,hostApplications=0,transport,prepareCalls=0;
const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
class Host {async capture(){return {version:1,bookshelfViewMode:'cover',themeSelection:{}};}encode(v){return v;}decode(v){return v;}async apply(){hostApplications++;if(hostFailures>0){hostFailures--;throw Error('Host write unavailable');}}}
const ReaderThemeHost={prepareUserChange:async()=>{prepareCalls++;},observedSystemScheme:()=> 'day'};
const Gateway=execute('features/sync/SyncGateway.ts','SyncGateway',{SyncWriteObservation,SyncHostConfigurationGateway:Host,ReaderRuntimeOwner,WebDavCredentialStore:{get instance(){return credentialStore;}},ReaderThemeHost,HttpExecuteHost:{instance:{execute:async request=>transport(request)}},util,url:{URL:{parseURL:v=>new URL(v)}},errorMessageOf:()=> 'platform failure',AppStorage:{setOrCreate(){}}});
const DEFAULT_SYNC_SNAPSHOT=execute('features/sync/SyncGateway.ts','DEFAULT_SYNC_SNAPSHOT',{SyncHostConfigurationGateway:Host,ReaderRuntimeOwner,WebDavCredentialStore:{get instance(){return credentialStore;}},ReaderThemeHost,HttpExecuteHost:{},util,url:{},errorMessageOf:()=> '',AppStorage:{}});
const Orchestrator=execute('features/sync/SyncOrchestrator.ets','SyncOrchestrator',{SyncGateway:Gateway,SyncWriteObservation,ReaderRuntimeOwner,projectPersistedReceipt,...facts});
function runtime(){return {
  calls:[],coreApplied:false,beforeApply:undefined,beforeResolve:undefined,failApplyAck:false,failBackupAdvance:false,failQuery:false,failCommit:0,
  async request(method,params){
    this.calls.push([method,clone(params)]);
    if(method==='sync.webdav.transaction.start'){
      if(params.operation==='connectionTest')return {data:{transactionId:'test',status:'completed',phase:'connectionCompleted'}};
      if(params.operation==='backup'){this.backupOperationId=params.operationId;return {data:{transactionId:params.operationId,status:'hostRequired',phase:'backupUpload',requests:[{method:'PUT',url:'https://example.test/backup/package'}]}};}
      return {data:{transactionId:'restore',status:'conflict',phase:'restoreConflict',conflict:{backupId:'candidate',remotePath:'/backup/package',localChecksum:'b'.repeat(64),remoteChecksum:checksum,localExportedAt:1,remoteExportedAt:2}}};
    }
    if(method==='sync.webdav.transaction.advance'){
      if(this.failBackupAdvance){this.failBackupAdvance=false;throw Error('lost backup completion');}
      return {data:{transactionId:this.backupOperationId,status:'completed',phase:'backupCompleted',contentBytes:100,remotePath:'/backup/package'}};
    }
    if(method==='sync.webdav.backup.receipt.query')return {data:{transactionId:params.transactionId,receiptState:'prepared',uploadQualified:false,retentionCompleted:false,durable:true,request:{method:'GET',url:'https://example.test/backup/package'}}};
    if(method==='sync.webdav.transaction.resolve'){
      if(this.beforeResolve)await this.beforeResolve();
      if(params.choice==='cancel')return {data:{transactionId:'restore',status:'completed',phase:'restoreCancelled'}};
      return {data:{transactionId:'restore',status:'applyRequired',phase:'restoreApply',storageApply:{manifest:{checksum},payload:'opaque-Core-owned'},hostConfig:{version:1,bookshelfViewMode:'list',themeSelection:{}}}};
    }
    if(method==='runtime.storage.apply'){
      if(this.beforeApply)await this.beforeApply();this.coreApplied=true;
      if(this.failApplyAck){this.failApplyAck=false;throw Error('lost apply ACK');}
      return {data:{manifest:{checksum}}};
    }
    if(method==='runtime.storage.flush')return {data:{stored:true}};
    if(method==='sync.webdav.transaction.commit'){
      if(params.queryOnly){if(this.failQuery){this.failQuery=false;throw Error('receipt unavailable');}return {data:{transactionId:'restore',status:'completed',phase:this.coreApplied?'restoreReceiptPresent':'restoreReceiptMissing',hostConfig:this.coreApplied?{version:1,bookshelfViewMode:'list',themeSelection:{}}:undefined}};}
      if(this.failCommit>0){this.failCommit--;throw Error('commit ACK lost');}
      return {data:{transactionId:'restore',status:'completed',phase:'restoreCompleted'}};
    }
    if(method==='sync.webdav.transaction.abort')return {data:{aborted:true}};
    throw Error(method);
  },count(m){return this.calls.filter(c=>c[0]===m).length;},
};}
function fixture({empty=false,preserveAsset=false}={}){
  if(!preserveAsset)asset.record=empty?undefined:new TextEncoder().encode(JSON.stringify({formatVersion:2,config}));asset.calls=[];asset.failAdd=false;asset.failQuery=false;asset.beforeAdd=undefined;
  hostApplications=0;hostFailures=0;prepareCalls=0;const runtimeOwner=runtime();currentOwner=runtimeOwner;
  preferenceValues=new Map();credentialStore=new Store();credentialStore.attachContext({});credentialStore.loadBookshelfViewMode=async()=> 'cover';let journal;
  credentialStore.loadRestoreJournal=async()=>journal;credentialStore.saveRestoreJournal=async v=>{journal=clone(v);};credentialStore.clearRestoreJournal=async()=>{journal=undefined;};
  let route=true,snapshot=clone(DEFAULT_SYNC_SNAPSHOT);const emitted=[];
  transport=async()=>({status:201,body:''});
  const owner=new Orchestrator(v=>{snapshot=clone(v);emitted.push(clone(v));},()=>snapshot,currentOwner,()=>route);
  const settle=async()=>{await owner.operationChain;};
  const noticeSource=source('features/common/ReaderRecoveryNotice.ets');const actionSource=source('features/common/ReaderRecoveryAction.ets');
  class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
  class Card extends Child { initialRender(){this.params.content?.();} }
  const page=()=>{
    const p=createReaderBuilderProbe(source('features/sync/SyncPage.ets'),['manualActionsSection','sectionHeadingMuted','restoreConflictCard','feedbackView','recoveryLabel','canMutate','manualActionButton'],{readerRecoveryView,ReaderRecoveryNotice:Child,ReaderCard:Card},{mountChildren:true,childSources:{ReaderCard:source('features/common/ReaderCard.ets')}});
    Object.assign(p.owner,{snapshot:clone(snapshot),contentFrame:()=>({width:390}),appThemeScheme:'day',onReconcile:g=>owner.reconcile(g),onTriggerBackup:()=>owner.triggerBackup(),onRestoreLatest:()=>owner.restoreLatest(),restoreConflictCard:()=>{}});
    p.owner.manualActionsSection();
    const child=[...p.owner.children.values()].find(c=>c.params.view);
    const n=createReaderBuilderProbe(noticeSource,['build'],{ReaderRecoveryAction:Child});Object.assign(n.owner,{...child.params,appThemeScheme:'day'});n.owner.initialRender();
    const retryChild=[...n.owner.children.values()][0];let action;
    if(retryChild){const a=createReaderBuilderProbe(actionSource,['build']);Object.assign(a.owner,{enabled:true,appThemeScheme:'day',...retryChild.params});a.owner.initialRender();action=[...a.owner.nodes.values()].find(v=>v.height===36);}
    return {page:p.owner,view:child.params.view,action,notice:n.owner};
  };
  return {owner,store:credentialStore,runtime:runtimeOwner,settle,page,snapshot:()=>snapshot,emitted,close:()=>{route=false;},reopen:()=>{route=true;owner.open();},journal:()=>journal};
}
async function open(f){f.owner.open();await f.settle();assert.equal(f.snapshot().facts.read.fact,'current');}
{
  const f=fixture();asset.failQuery=true;f.owner.open();await f.settle();assert.equal(f.snapshot().facts.read.fact,'failed');assert.equal(f.snapshot().facts.canMutate,false);
  const p=f.page();assert.equal(p.view.canRetry,true);p.action.onClick();p.action.onClick();await f.settle();assert.equal(asset.calls.filter(c=>c==='query').length,2);assert.equal(f.snapshot().facts.read.fact,'current');
}
{
  const f=fixture();await open(f);const original=clone(f.snapshot());asset.failQuery=true;f.owner.open();await f.settle();assert.equal(f.snapshot().facts.read.fact,'refreshFailed');assert.equal(f.snapshot().webdavUrl,original.webdavUrl);
  f.page().action.onClick();await f.settle();assert.equal(f.snapshot().facts.read.fact,'current');
}
{
  const f=fixture();await open(f);
  const realLoad=credentialStore.loadSerializedState.bind(credentialStore);let reads=0;credentialStore.loadSerializedState=async()=>{reads++;if(reads===1)throw Error('post-write read failed');return realLoad();};
  f.owner.saveConfig(config.url,config.user,'','',config.directory);await f.settle();assert.equal(asset.calls.filter(c=>c==='add').length,1);assert.equal(f.snapshot().facts.operation.projection.receipt.fact,'confirmedRefreshFailed');
  const p=f.page();assert.match(p.view.message,/已确认，刷新失败/);p.action.onClick();p.action.onClick();await f.settle();assert.equal(asset.calls.filter(c=>c==='add').length,1);assert.equal(f.snapshot().facts.operation.projection.receipt.fact,'confirmedCurrent');
  assert.doesNotMatch(JSON.stringify(f.snapshot()),/transient-secret|independent-secret/);
}
{
  const f=fixture();await open(f);asset.failAdd=true;f.owner.saveConfig(config.url,config.user,'','',config.directory);await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'unknown');
  f.page().action.onClick();await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.fact,'confirmedCurrent','exact atomic receipt confirms lost ACK without replay');assert.equal(asset.calls.filter(c=>c==='add').length,1);
  // A separate unresolved attempt must still block replacement and backup.
  asset.failAdd=true;asset.beforeAdd=()=>{asset.failQuery=true;};f.owner.saveConfig(config.url,config.user,'','',config.directory);await f.settle();asset.beforeAdd=undefined;f.owner.saveConfig(config.url,config.user,'','',config.directory);f.owner.triggerBackup();await f.settle();assert.equal(asset.calls.filter(c=>c==='add').length,2);assert.equal(f.runtime.count('sync.webdav.transaction.start'),0,'unknown cannot be overwritten by new intent');
}
{
  const f=fixture();await open(f);f.owner.saveConfig('http://invalid',config.user,'','',config.directory);await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'undispatched');assert.equal(asset.calls.filter(c=>c==='add').length,0);
}
{
  const f=fixture();await open(f);f.runtime.failBackupAdvance=true;f.owner.triggerBackup();await f.settle();const op=f.snapshot().facts.operation;assert.equal(op.projection.receipt.confirmation,'unknown');assert.equal(op.remoteConfirmedCount,1);assert.equal(f.snapshot().history.length,0);
  f.page().action.onClick();await f.settle();assert.equal(f.runtime.count('sync.webdav.transaction.start'),1);assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'unknown');
}
{
  const f=fixture();await open(f);f.owner.triggerBackup();f.owner.triggerBackup();await f.settle();assert.equal(f.runtime.count('sync.webdav.transaction.start'),1);assert.equal(f.snapshot().facts.operation.completed,true);assert.equal(f.snapshot().history.length,1);
}
{
  const f=fixture();await open(f);f.owner.restoreLatest();await f.settle();f.owner.resolveRestore(false);await f.settle();assert.equal(f.runtime.count('runtime.storage.apply'),0);assert.equal(f.snapshot().restoreConflict,undefined);assert.equal(f.snapshot().statusMessage,'已取消恢复');assert.equal(f.snapshot().facts.operation,undefined,'explicit cancellation never fabricates a committed write');
}
for(const fail of ['none','applyAck','commitAck','host']){
  const f=fixture();await open(f);f.owner.restoreLatest();await f.settle();assert.equal(f.snapshot().restoreConflict.transactionId,'restore');assert.equal(f.runtime.count('runtime.storage.apply'),0);
  if(fail==='applyAck')f.runtime.failApplyAck=true;if(fail==='commitAck')f.runtime.failCommit=1;if(fail==='host')hostFailures=1;
  f.owner.resolveRestore(true);await f.settle();assert.equal(f.runtime.count('runtime.storage.apply'),1);assert.equal(f.snapshot().facts.operation.projection.receipt.fact,'confirmedCurrent');assert.equal(f.snapshot().facts.operation.coreApplied,true);assert.equal(f.journal(),undefined);
}
{
  const f=fixture();await open(f);f.owner.restoreLatest();await f.settle();hostFailures=2;f.owner.resolveRestore(true);await f.settle();
  const op=f.snapshot().facts.operation;assert.equal(op.coreApplied,true);assert.equal(op.hostApplied,false);assert.equal(op.completed,false);assert.equal(op.projection.receipt.confirmation,'confirmed');assert.ok(f.journal());assert.match(f.page().view.message,/Core 配置已应用/);
  f.owner.triggerBackup();await f.settle();assert.equal(f.runtime.count('sync.webdav.transaction.start'),1);
  const p=f.page();assert.equal(p.action.create,'核对已有恢复');p.action.onClick();p.action.onClick();await f.settle();assert.equal(f.runtime.count('runtime.storage.apply'),1,'partial recovery never reapplies Core descriptor');assert.equal(f.snapshot().facts.operation.completed,true);assert.equal(f.journal(),undefined);
}
{
  const f=fixture();await open(f);f.owner.restoreLatest();await f.settle();f.runtime.failApplyAck=true;f.runtime.failQuery=true;f.owner.resolveRestore(true);await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'unknown');assert.ok(f.journal());
  f.page().action.onClick();await f.settle();assert.equal(f.runtime.count('runtime.storage.apply'),1);assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'confirmed');assert.equal(f.journal(),undefined);
}
{
  const f=fixture();await open(f);const p=pause();asset.beforeAdd=()=>p.promise;f.owner.saveConfig(config.url,config.user,'','',config.directory);await new Promise(r=>setImmediate(r));const before=f.emitted.length;f.close();p.resolve();await f.settle();assert.equal(f.emitted.length,before,'close discards late ACK publication');f.reopen();await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,'confirmed');
  const stale=f.snapshot().facts.operation.projection.facts.generation;f.owner.open();await f.settle();const queries=asset.calls.length;f.owner.reconcile(stale);await f.settle();assert.equal(asset.calls.length,queries,'stale recovery token rejected');
}
{
  const f=fixture();await open(f);const gate=pause();credentialStore.writeTail=gate.promise;f.owner.saveConfig(config.url,config.user,'','',config.directory);await new Promise(r=>setImmediate(r));f.close();gate.resolve();await f.settle();assert.equal(asset.calls.filter(c=>c==='add').length,0,'queued intent checks route after prepare/read');
}
{
  const f=fixture();await open(f);f.owner.restoreLatest();await f.settle();const p=pause();f.runtime.beforeApply=()=>p.promise;f.owner.resolveRestore(true);await new Promise(r=>setImmediate(r));const count=f.emitted.length;currentOwner=runtime();p.resolve();await f.settle();assert.equal(hostApplications,0,'retired runtime never applies Host configuration');assert.equal(f.emitted.length,count);assert.ok(f.journal(),'new startup can resolve already-applied Core receipt');f.owner.triggerBackup();await f.settle();assert.equal(f.runtime.count('sync.webdav.transaction.start'),1);
}
{
  const f=fixture();await open(f);f.owner.testConnection(config.url,config.user,'',config.directory);await f.settle();assert.equal(f.snapshot().facts.request.fact,'current');assert.equal(asset.calls.filter(c=>c==='add').length,0);assert.equal(f.snapshot().facts.operation,undefined,'read-only connection test does not fabricate write receipt');
}

// Transform the complete production page, including real decorated Props and
// @Watch. Shared child slots are registered from their actual declarations.
{
  const sdk=process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const ts=require(sdk+'/node_modules/typescript');const options=require(sdk+'/lib/ets_checker.js').compilerOptions;
  const text=source('features/sync/SyncPage.ets');const tree=ts.createSourceFile('/tmp/SyncPage.ets',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  const names=tree.statements.find(n=>n.members&&n.name?.text==='SyncPage').members.map(n=>n.name?.getText(tree)).filter(Boolean);
  class Property { constructor(value,owner,name){Object.assign(this,{value,owner,name});}get(){return this.value;}set(v){this.value=v;this.owner.watches?.get(this.name)?.call(this.owner,this.name);}reset(v){this.set(v);}purgeDependencyOnElmtId(){}aboutToBeDeleted(){} }
  class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
  class Card extends Child {initialRender(){this.params.content?.();}}
  const geometry=execute('features/common/SurfaceHorizontalGeometry.ts','({SurfaceWidthSpec,SurfaceHorizontalFrame,resolveHorizontalFrame})');
  syntax.builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));
  const full=createReaderBuilderProbe(text,names,{...geometry,DEFAULT_SYNC_SNAPSHOT,readerRecoveryView,ReaderCard:Card,PageBackBar:Child,ReaderRecoveryNotice:Child,
    ...Object.fromEntries(['ObservedPropertySimplePU','ObservedPropertyObjectPU','SynchedPropertySimpleOneWayPU','SynchedPropertyObjectOneWayPU'].map(k=>[k,Property])),
    registerReaderFonts(){},ReaderWindowCoordinator:{metrics:()=>({windowRect:{width:390}})},readerVisualSafeLeft:()=>0,readerVisualSafeRight:()=>0,readerFloatingBarBottomInset:()=>18,
    READER_FLOATING_TOP_BAR_HEIGHT:56,InputType:{Password:'Password'},TOK_CONTENT_MAX_W_TABLET:722,TOK_SCREEN_INSET:18,
  },{mountChildren:true,initialParams:{snapshot:{...clone(DEFAULT_SYNC_SNAPSHOT),webdavUrl:config.url,webdavUser:config.user,webdavPath:config.directory,facts:{read:facts.projectOperationFacts({phase:'succeeded',value:true}),busy:false,canMutate:true}},isTablet:false},
    childSources:{ReaderCard:source('features/common/ReaderCard.ets'),PageBackBar:source('features/common/PageBackBar.ets')}});
  full.owner.aboutToAppear();full.owner.initialRender();assert.equal(full.owner.webdavUrl,config.url);
  const inputs=[...full.owner.nodes.values()].filter(n=>n.create&&typeof n.create==='object'&&'placeholder' in n.create);assert.equal(inputs.length,5);assert.equal(inputs.filter(n=>n.enabled).length,5);assert.equal(inputs.filter(n=>n.type==='Password').length,2);
  full.owner.webdavUrlEdited=true;full.owner.webdavUrl='https://draft.test';full.owner.webdavPass='secret-draft';full.owner.backupPass='backup-draft';
  const operation={action:'saveConfig',writeGeneration:1,coreApplied:false,hostApplied:false,completed:true,remoteConfirmedCount:0,projection:projectPersistedReceipt({confirmation:'confirmed',readback:'failed',generation:900,canRetry:true})};
  full.owner.updateStateVars({snapshot:{...clone(full.owner.snapshot),webdavUrl:'https://new.test',facts:{...full.owner.snapshot.facts,operation,busy:false,canMutate:true}}});
  assert.equal(full.owner.webdavUrl,'https://draft.test','ACK/readback keeps edited non-secret draft');assert.equal(full.owner.webdavPass,'','actual @Watch clears acknowledged password draft');assert.equal(full.owner.backupPass,'');
  const recovery=[...full.owner.children.values()].find(c=>c.params.view);full.owner.replay();assert.equal(recovery.params.view.canRetry,true,'mounted shared child receives live snapshot receipt');
  full.owner.webdavPass='later-draft';full.owner.backupPass='later-backup';
  full.owner.updateStateVars({snapshot:{...clone(full.owner.snapshot),facts:{...full.owner.snapshot.facts,operation:{...operation,projection:projectPersistedReceipt({confirmation:'confirmed',readback:'succeeded',generation:901})}}}});
  assert.equal(full.owner.webdavPass,'later-draft','read-only recovery never re-clears a later secret draft');assert.equal(full.owner.backupPass,'later-backup');
}

for(const unknown of [false,true]){
 const f=fixture();await open(f);const p=pause();asset.beforeAdd=()=>p.promise;asset.failAdd=unknown;f.owner.saveConfig(config.url,config.user,'','',config.directory);await new Promise(r=>setImmediate(r));
 const count=f.emitted.length;currentOwner=undefined;p.resolve();await f.settle();assert.equal(f.emitted.length,count,'actual Asset ACK/lost ACK cannot publish after Runtime absence');
 const writes=asset.calls.filter(c=>c==='add').length;assert.doesNotThrow(()=>f.owner.saveConfig(config.url,config.user,'','',config.directory));await f.settle();assert.equal(asset.calls.filter(c=>c==='add').length,writes);
 currentOwner=f.runtime;f.owner.open();await f.settle();assert.equal(f.snapshot().facts.operation.projection.receipt.confirmation,unknown?'unknown':'confirmed','retained exact evidence never promotes lost ACK from matching read');
 assert.equal(asset.calls.filter(c=>c==='add').length,writes,'reopen independent read never repeats save');
}

console.log('PASS Sync actual AssetStore -> Gateway -> owner -> SDK shared recovery: read/save/unknown/backup/partial-restore/durable receipt/re-entry/generation/owner/queue/secret boundary.');

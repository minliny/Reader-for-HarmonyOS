// Pure scenario fixture: no test-source extraction and no assertions at import.
import { resolveEtsLoaderRoot, virtualFilePath } from '../../lib/tool-environment.mjs';
import {boundedSurfaceSdk} from '../../lib/bounded-surface-sdk-probe.mjs';
import {foundationControls} from '../../lib/reader-foundation-control-probe.mjs';
import { randomUUID } from 'node:crypto';
import { runtimeOwnerIdentityProbe } from '../../lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from '../../lib/reader-control-builder-probe.mjs';
import { createDefaultReaderWindowMetrics } from '../../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
export function createSyncOwnerFixture({sharedAsset}={}) {
const require=createRequire(import.meta.url);
// Thin Node adaptation of the actual platform AtomicFile API. Production
// snapshot/Store/owner methods remain unmodified and use real durable files.
const nativeFs=require('node:fs'), nativePath=require('node:path'), nativeOs=require('node:os');
const realConfigDirectories=[];let configDirectory;
const fileIo={OpenMode:{READ_WRITE:1,READ_ONLY:0},
 async readText(path){try{return await nativeFs.promises.readFile(path,'utf8');}catch(e){if(e.code==='ENOENT')throw {code:13900002};throw e;}},
 async open(path,mode){return nativeFs.promises.open(path,mode===1?'r+':'r');},
 async fsync(fd){await new Promise((resolve,reject)=>nativeFs.fsync(fd,e=>e?reject(e):resolve()));},
 async close(file){await file.close();},
 AtomicFile:class{constructor(path){this.path=path;this.temp=path+'.candidate';}startWrite(){return nativeFs.createWriteStream(this.temp);}finishWrite(){nativeFs.renameSync(this.temp,this.path);}failWrite(){try{nativeFs.unlinkSync(this.temp);}catch(e){if(e.code!=='ENOENT')throw e;}}},
};
const cryptoFramework={createMd(){const hash=require('node:crypto').createHash('sha256');return{async update({data}){hash.update(data);},async digest(){return {data:new Uint8Array(hash.digest())};}};}};

const syntax=require((resolveEtsLoaderRoot())+'/lib/validate_ui_syntax.js');
const source = p => readFileSync(new URL(`../../../entry/src/main/ets/${p}`,import.meta.url),'utf8');
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
const until=async predicate=>{for(let i=0;i<2000;i++){if(predicate())return;await new Promise(setImmediate);}throw Error('actual IO boundary did not arrive');};
const util={generateRandomUUID:()=>randomUUID(),TextEncoder:globalThis.TextEncoder,TextDecoder:{create:()=>({decodeToString:b=>new TextDecoder('utf8',{fatal:true}).decode(b)})},Base64Helper:class {encodeToStringSync(v){return Buffer.from(v).toString('base64');}}};
const asset=sharedAsset ?? {Tag:{ALIAS:1,RETURN_TYPE:2,SECRET:3,ACCESSIBILITY:4,CONFLICT_RESOLUTION:5},ReturnType:{ALL:1},Accessibility:{DEVICE_POWERED_ON:1},ConflictResolution:{OVERWRITE:0,THROW_ERROR:1},ErrorCode:{NOT_FOUND:100,DUPLICATED:101},record:undefined,records:new Map(),calls:[],failAdd:false,failQuery:false,beforeAdd:undefined,
 async query(query){this.calls.push('query');if(this.failQuery){this.failQuery=false;throw Error('read unavailable');}const alias=new TextDecoder().decode(query.get(1));const raw=alias==='reader.webdav.config.v2'?this.record:this.records.get(alias);return raw?[new Map([[1,query.get(1)],[3,raw]])]:[];},
 async add(attributes){this.calls.push('add');if(this.beforeAdd)await this.beforeAdd();const alias=new TextDecoder().decode(attributes.get(1));const existing=alias==='reader.webdav.config.v2'?this.record:this.records.get(alias);if(existing&&attributes.get(5)===1)throw {code:this.ErrorCode.DUPLICATED};if(alias==='reader.webdav.config.v2')this.record=attributes.get(3);else this.records.set(alias,attributes.get(3));if(this.failAdd){this.failAdd=false;throw Error('lost Asset ACK');}},
 async remove(query){this.calls.push('remove');const alias=new TextDecoder().decode(query.get(1));if(alias==='reader.webdav.config.v2')this.record=undefined;else this.records.delete(alias);},
};
let preferenceValues=new Map();
let nativePreferences={async get(key,fallback){return preferenceValues.has(key)?preferenceValues.get(key):fallback;},async has(key){return preferenceValues.has(key);},async put(key,value){preferenceValues.set(key,value);},async delete(key){preferenceValues.delete(key);},async flush(){}};
const replaceReaderAtomicSnapshot=execute('app/ReaderAtomicSnapshotFile.ts','replaceReaderAtomicSnapshot',{fileIo});
const Store=execute('features/sync/WebDavCredentialStore.ts','WebDavCredentialStore',{asset,util,fileIo,cryptoFramework,replaceReaderAtomicSnapshot,preferences:{getPreferences:async()=>nativePreferences},errorMessageOf:()=> 'platform failure'});
let currentOwner,credentialStore,hostFailures=0,hostApplications=0,transport,prepareCalls=0;
const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
class Host {async capture(){return {version:1,bookshelfViewMode:'cover',themeSelection:{}};}encode(v){return v;}decode(v){return v;}async apply(){hostApplications++;if(hostFailures>0){hostFailures--;throw Error('Host write unavailable');}}}
const ReaderThemeHost={prepareUserChange:async()=>{prepareCalls++;},observedSystemScheme:()=> 'day'};
const Gateway=execute('features/sync/SyncGateway.ts','SyncGateway',{SyncWriteObservation,SyncHostConfigurationGateway:Host,ReaderRuntimeOwner,WebDavCredentialStore:{get instance(){return credentialStore;}},ReaderThemeHost,HttpExecuteHost:{instance:{execute:async request=>transport(request)}},util,url:{URL:{parseURL:v=>new URL(v)}},errorMessageOf:()=> 'platform failure',AppStorage:{setOrCreate(){}}});
const DEFAULT_SYNC_SNAPSHOT=execute('features/sync/SyncGateway.ts','DEFAULT_SYNC_SNAPSHOT',{SyncHostConfigurationGateway:Host,ReaderRuntimeOwner,WebDavCredentialStore:{get instance(){return credentialStore;}},ReaderThemeHost,HttpExecuteHost:{},util,url:{},errorMessageOf:()=> '',AppStorage:{}});
const Orchestrator=execute('features/sync/SyncOrchestrator.ets','SyncOrchestrator',{SyncGateway:Gateway,DEFAULT_SYNC_SNAPSHOT,SyncWriteObservation,ReaderRuntimeOwner,projectPersistedReceipt,...facts});
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
function fixture({empty=false,preserveAsset=false,createOwner}={}){
  if(!preserveAsset){asset.record=empty?undefined:new TextEncoder().encode(JSON.stringify({formatVersion:2,config}));asset.records=new Map();configDirectory=nativeFs.mkdtempSync(nativePath.join(nativeOs.tmpdir(),'reader-sync-intent-'));realConfigDirectories.push(configDirectory);}asset.calls=[];asset.failAdd=false;asset.failQuery=false;asset.beforeAdd=undefined;
  hostApplications=0;hostFailures=0;prepareCalls=0;const runtimeOwner=runtime();currentOwner=runtimeOwner;
  preferenceValues=new Map();credentialStore=new Store();credentialStore.attachContext({filesDir:configDirectory});credentialStore.loadBookshelfViewMode=async()=> 'cover';let journal;
  credentialStore.loadRestoreJournal=async()=>journal;credentialStore.saveRestoreJournal=async v=>{journal=clone(v);};credentialStore.clearRestoreJournal=async()=>{journal=undefined;};
  let route=true,snapshot=clone(DEFAULT_SYNC_SNAPSHOT);const emitted=[];
  transport=async()=>({status:201,body:''});
  const owner=createOwner?createOwner():new Orchestrator(v=>{snapshot=clone(v);emitted.push(clone(v));},()=>snapshot,currentOwner,()=>route);
  const settle=async()=>{await owner.operationChain;};
  const noticeSource=source('features/common/ReaderRecoveryNotice.ets');const actionSource=source('features/common/ReaderRecoveryAction.ets');
  class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
  class Card extends Child { initialRender(){this.params.content?.();} }
  const page=()=>{
    const shared=foundationControls();
    const p=createReaderBuilderProbe(source('features/sync/SyncPage.ets'),['manualActionsSection','configSaveContinuationIdentities','canContinueConfigSave','configSaveGeneration','effectiveWebdavUrl','effectiveWebdavUser','effectiveWebdavPath','sectionHeadingMuted','restoreConflictCard','feedbackView','recoveryLabel','canSkipBackupRetention','backupGeneration','backupRetentionActionIdentities','canMutate','manualActionButton'],{...shared.dependencies,readerRecoveryView,ReaderRecoveryNotice:Child,ReaderRecoveryAction:Child,ReaderCard:Card},{...shared.hooks,mountChildren:true,childSources:{...shared.hooks.childSources,ReaderCard:source('features/common/ReaderCard.ets')}});
    Object.assign(p.owner,{snapshot:clone(snapshot),contentFrame:()=>({width:390}),appThemeScheme:'day',onReconcile:g=>owner.reconcile(g),onSkipBackupRetention:g=>owner.skipBackupRetention(g),onContinueConfigSave:(...args)=>owner.continueConfigSave(...args),onTriggerBackup:()=>owner.triggerBackup(),onRestoreLatest:()=>owner.restoreLatest(),restoreConflictCard:()=>{}});
    p.owner.manualActionsSection();
    const child=[...p.owner.children.values()].find(c=>c.params?.view);
    const messages=boundedSurfaceSdk();
    const n={owner:messages.consumer(noticeSource,undefined,{},child.params)};n.owner.initialRender();
    const retryActor=messages.walk(n.owner).find(actor=>actor instanceof messages.deps.ReaderRecoveryAction&&actor.label===(child.params.actionLabel??'刷新列表'));
    const native=actor=>actor&&messages.nodes(actor).find(node=>node.type==='Stack'&&node.onClick);
    const action=native(retryActor);
    const continuationChild=[...p.owner.children.values()].find(c=>c.params?.label==='继续原操作');let continueAction;
    if(continuationChild){const a=messages.consumer(actionSource,undefined,{},continuationChild.params);a.initialRender();continueAction=native(a);}
    const skipChild=[...p.owner.children.values()].find(c=>c.params?.label==='保留备份，结束清理');let skipAction;
    if(skipChild){const a=messages.consumer(actionSource,undefined,{},skipChild.params);a.initialRender();skipAction=native(a);}
    return {page:p.owner,view:child.params.view,action,skipAction,continueAction,notice:n.owner};
  };
  return {owner,store:credentialStore,runtime:runtimeOwner,settle,page,snapshot:()=>snapshot,emitted,close:()=>{route=false;},reopen:()=>{route=true;owner.open();},journal:()=>journal};
}
return {fixture,asset,config,ReaderRuntimeOwner,Store,Gateway,Orchestrator,DEFAULT_SYNC_SNAPSHOT,source,readerRecoveryView,pause,until,execute,SyncWriteObservation,ReaderWriteEvidence,util,fileIo,clone,runtime,projectPersistedReceipt,facts,
 setRuntimeOwner:owner=>{currentOwner=owner;},setTransport:value=>{transport=value;},setPreferences:store=>{nativePreferences=store;},setDirectory:value=>{configDirectory=value;},directory:()=>configDirectory,
 controls:{get hostFailures(){return hostFailures;},set hostFailures(v){hostFailures=v;},get hostApplications(){return hostApplications;},get prepareCalls(){return prepareCalls;}},
 cleanup:()=>{const removed=realConfigDirectories.splice(0);for(const path of removed)nativeFs.rmSync(path,{recursive:true,force:true});return {removed};}};
}

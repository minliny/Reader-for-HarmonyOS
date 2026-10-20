import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"identity-admission": {"description": "实际identity/recovery准入与startup发布barrier", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {

const {default: assert} = await import('node:assert/strict');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');
const Owner=selectedProductionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),'ReaderRuntimeOwner',['requireCoreBuildIdentity','requireSourceSwitchRecoveryCount','isLowerHex']);
const owner=new Owner(),good={schemaVersion:1,buildId:'a'.repeat(64),gitCommit:'b'.repeat(40),gitDirty:true,cargoLockSha256:'c'.repeat(64),protocolSha256:'d'.repeat(64),rustProfile:'debug'};
assert.deepEqual(owner.requireCoreBuildIdentity(good),good);
for(const value of [null,[],{}, {...good,schemaVersion:2},{...good,gitDirty:'true'},{...good,buildId:'A'.repeat(64)},{...good,protocolSha256:'x'},{...good,rustProfile:' '},{...good,gitCommit:'short'}]) assert.throws(()=>owner.requireCoreBuildIdentity(value));
assert.equal(owner.requireSourceSwitchRecoveryCount([]),0);
assert.equal(owner.requireSourceSwitchRecoveryCount([{transactionId:'txn',phase:'rolledBack',changed:false}]),1);
for(const value of [null,{},[null],[[]],[{transactionId:' ',phase:'rolledBack',changed:true}],[{transactionId:'txn',phase:'committed',changed:true}],[{transactionId:'txn',phase:'rolledBack',changed:'false'}]]) assert.throws(()=>owner.requireSourceSwitchRecoveryCount(value));

let activeRuntime;
const OwnerStartup=selectedProductionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),'ReaderRuntimeOwner',['startRuntime','requireCoreBuildIdentity','requireSourceSwitchRecoveryCount','isLowerHex'],{
 createReaderCoreRuntimeAsync:async()=>activeRuntime, ReaderStartupTrace:{measure:(_name,work)=>work(),current:()=>undefined},
 ReadingBodyImageHost:{instance:{setMangaMetadataInspector(){}}},MangaImageMetadataHost:{instance:{}},LOG_DOMAIN:0,
 hilog:{info(){},warn(){},error(){}},errorMessageOf:error=>String(error)});
for(const mode of ['good','bad-identity','bad-recovery','capability-failure','teardown']) {
 const requests=[];let closes=0,owner;
 activeRuntime={assetBridge:()=>({}),setCapabilityRouter(){},close(){closes++;},async request(method){requests.push(method);assert.equal(owner.runtime,undefined,'no startup prerequisite may observe a published runtime');
  if(mode==='capability-failure'&&method==='runtime.setHostCapabilities')throw Error('capabilities unavailable');
  if(method==='core.info'){if(mode==='teardown')owner.state='closing';return{data:{buildIdentity:mode==='bad-identity'?{}:good,capabilities:[]}};}
  return{data:{recovered:mode==='bad-recovery'?[{phase:'committed'}]:[]}};
 }};
 const storage={restoreLegacyProtection:async()=>{},maintainAutomaticStorage:async()=>{}};
 owner=Object.assign(new OwnerStartup(),{state:'starting',coreCapabilities:new Set(),host:{needsLegacySnapshotMigration:async()=>false,getContext:()=>({filesDir:'/fixture'}),setResponseAssetBridge(){},createCapabilityRouter:()=>({})},
 supportsCoreCapability:()=>false,getReadingRecordGateway:()=>({recover:async()=>{}}),recoverReadingProgressInBackground(){},getDownloadStorageGateway:()=>storage,getDownloadCoordinator:()=>({restore:async()=>{}}),scheduleImportFinalizeCleanup(){},installBundledBookSourceCollection:async()=>({collectionRecords:0,uniqueSourceIds:0,processed:0,installedOrUpgraded:0,failed:0,interrupted:false})});
 if(mode==='good'){await owner.startRuntime();assert.equal(owner.runtime,activeRuntime);assert.equal(owner.state,'ready');assert.deepEqual(requests,['runtime.setHostCapabilities','core.info','source.switch.recover']);}
 else{await assert.rejects(()=>owner.startRuntime());assert.equal(owner.runtime,undefined,'failed or retired startup never publishes');assert.equal(closes,1);assert.notEqual(owner.state,'ready');}
}

}

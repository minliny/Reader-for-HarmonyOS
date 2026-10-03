import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {runtimeOwnerIdentityProbe} from './reader-runtime-admission-probe.mjs';

// Reconstruct every actual production class for a cold test while retaining
// real on-disk metadata and the platform Asset adapter. No owner/IO algorithm
// is reimplemented. AtomicFile uses the original production thin helper.
export function configIntentFixture(previous) {
  const url=new URL('../test-sync-receipt-owner-closure.mjs',import.meta.url);
  let text=readFileSync(url,'utf8').split('\nasync function open(f)')[0]
    .replace(/^import[^\n]+\n/gm,'').replaceAll('import.meta.url',JSON.stringify(url.href))
    .replace('const asset={','const asset=sharedAsset ?? {');
  const f=new Function('readFileSync','createRequire','stripTypeScriptTypes','createReaderBuilderProbe','runtimeOwnerIdentityProbe','randomUUID','sharedAsset',text+`;return {
    fixture,asset,config,Store,Gateway,Orchestrator,SyncWriteObservation,ReaderWriteEvidence,DEFAULT_SYNC_SNAPSHOT,source,execute,readerRecoveryView,util,fileIo,pause,until,
    setRuntimeOwner:owner=>{currentOwner=owner;},setPreferences:store=>{nativePreferences=store;},
    setDirectory:path=>{configDirectory=path;},directory:()=>configDirectory,
    cleanup:()=>{for(const path of realConfigDirectories) nativeFs.rmSync(path,{recursive:true,force:true});}
  };`)(readFileSync,createRequire,stripTypeScriptTypes,createReaderBuilderProbe,runtimeOwnerIdentityProbe,randomUUID,previous?.asset);
  if(previous) f.setDirectory(previous.directory());
  return f;
}

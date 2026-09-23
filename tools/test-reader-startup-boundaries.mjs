import assert from 'node:assert/strict';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {ReaderStartupTrace} from '../entry/src/main/ets/app/ReaderStartupTrace.ts';
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(){
 const clock=[],events=[],native=deferred(),cleanup=deferred();let createError=false;
 let migrationStarted=false, migrationResult=Promise.resolve(false);
 const runtime={assetBridge:()=>({}),setCapabilityRouter(){},close(){events.push('native.close');},
  async request(method){events.push(method);return{data:{capabilities:[],buildIdentity:{},recovered:0}};}};
 const Owner=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),
 ['startRuntime','scheduleImportFinalizeCleanup'],{ReaderStartupTrace,LOG_DOMAIN:0,hilog:{info(){},error(){},warn(){}},errorMessageOf:e=>e.message,
  setTimeout:fn=>{clock.push(fn);return clock.length;},createReaderCoreRuntimeAsync:async(_config,current)=>{
   if(createError)throw Error('open failed');await native.promise;
   if(!current()){runtime.close();throw Error('startup cancelled');}return runtime;
  }});
 const owner=Object.assign(new Owner(),{state:'starting',coreCapabilities:new Set(),
  host:{getContext:()=>({filesDir:'/controlled'}),setResponseAssetBridge(){},createCapabilityRouter:()=>({}),
   needsLegacySnapshotMigration(){migrationStarted=true;return migrationResult;},
   async markLegacySnapshotMigrated(){events.push('migration-marker-write');}},
  requireCoreBuildIdentity:value=>value,requireSourceSwitchRecoveryCount:value=>value,
  async recoverPendingLocalImportFinalizes(){events.push('cleanup');await cleanup.promise;},
  async installBundledBookSourceCollection(){return{collectionRecords:0,uniqueSourceIds:0,processed:0,installedOrUpgraded:0,failed:0,interrupted:false};}});
 return{owner,runtime,native,cleanup,events,clock,fail(){createError=true;},
  migrationStarted:()=>migrationStarted, migration(value){migrationResult=value;}};
}
{
 const f=fixture();const start=f.owner.startRuntime();await tick();assert.deepEqual(f.events,[]);
 assert.equal(f.migrationStarted(),true,'read-only Host marker I/O overlaps outstanding native open');
 f.native.resolve();await start;assert.equal(f.owner.state,'ready');assert.equal(f.owner.runtime,f.runtime);
 assert.ok(!f.events.includes('cleanup'),'confirmed import cleanup cannot gate ready');
 f.clock.shift()();await tick();assert.equal(f.events.at(-1),'cleanup');
 let settled=false;f.owner.importFinalizeTask.then(()=>{settled=true;});await tick();assert.equal(settled,false);
 f.cleanup.resolve();await f.owner.importFinalizeTask;assert.equal(settled,true);
}
{
 const f=fixture();const start=f.owner.startRuntime();f.owner.state='closing';f.native.resolve();
 await assert.rejects(start,/cancelled/);assert.equal(f.owner.runtime,undefined);
 assert.deepEqual(f.events,['native.close']);assert.equal(f.clock.length,0);
}
{
 const f=fixture();f.fail();await assert.rejects(f.owner.startRuntime(),/open failed/);
 assert.equal(f.owner.state,'new','failed native open remains retryable');
}
{
 const f=fixture();f.native.resolve();await f.owner.startRuntime();f.owner.state='closing';
 f.clock.shift()();await f.owner.importFinalizeTask;assert.ok(!f.events.includes('cleanup'),'close preserves undispatched cleanup journal');
}
{
 const f=fixture(), migration=deferred();f.migration(migration.promise);f.native.resolve();
 const start=f.owner.startRuntime();await tick();
 assert.deepEqual(f.events,['runtime.setHostCapabilities','core.info']);
 assert.equal(f.owner.state,'starting','pending marker read never admits tentative state');
 migration.resolve(true);await start;
 assert.deepEqual(f.events.slice(0,5),['runtime.setHostCapabilities','core.info','runtime.storage.restore',
  'migration-marker-write','source.switch.recover']);
 assert.equal(f.owner.state,'ready');
}
{
 const f=fixture(), migration=deferred();f.migration(migration.promise);
 const start=f.owner.startRuntime();migration.reject(Error('marker unavailable'));await tick();
 assert.equal(f.owner.state,'starting');f.native.resolve();
 await assert.rejects(start,/marker unavailable/);
 assert.equal(f.owner.state,'new');assert.equal(f.owner.runtime,undefined);
 assert.equal(f.events.at(-1),'native.close');
 assert.ok(!f.events.includes('source.switch.recover'),'failed marker read cannot bypass restore decision');
}
console.log('startup boundaries: parallel Host marker/native open, restore barrier/order and marker failure cleanup; async admission, failed-open retry, close-before-ready release, post-ready cleanup and undispatched receipt preservation PASS');

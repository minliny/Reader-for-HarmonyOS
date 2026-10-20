import assert from 'node:assert/strict';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {ReaderStartupTrace} from '../entry/src/main/ets/app/ReaderStartupTrace.ts';
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(capabilities=[]){
 const clock=[],events=[],requests=[],native=deferred(),cleanup=deferred();let createError=false, opens=0;
 let migrationStarted=false, migrationResult=Promise.resolve(false), downloadMigration=Promise.resolve(), sourceTask=Promise.resolve();
 const background=[], recovery=[];
 let inspector, metadataCalls=0, cacheClosed=false;
 const runtime={assetBridge:()=>({}),setCapabilityRouter(){},close(){events.push('native.close');},
  async request(method,params){events.push(method);requests.push({method,params:structuredClone(params)});return{data:{capabilities,buildIdentity:{},recovered:0}};}};
 const Owner=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),
 ['start','startAfterPredecessor','requestDirect','startRuntime','scheduleImportFinalizeCleanup','supportsCoreCapability','close','closeDownloadsAndRuntime','detachMangaReadingProbe'], {ReadingBodyImageHost:{instance:{setMangaMetadataInspector:callback=>{inspector=callback;}}},
  MangaImageMetadataHost:{instance:{inspect:async(bytes,digest,request,current)=>{metadataCalls++;assert.equal(current(),true);await request({inputSha256:digest});return{status:'absent',orientation:null,sha256:digest,bytes:bytes.length};}}},ReaderStartupTrace,LOG_DOMAIN:0,hilog:{info(){},error(){},warn(){}},errorMessageOf:e=>e.message,
  DEFAULT_CORE_REQUEST_TIMEOUT_MS:30000,coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined,
  setTimeout:fn=>{clock.push(fn);return clock.length;},createReaderCoreRuntimeAsync:async(_config,current)=>{
   opens+=1;if(createError)throw Error('open failed');await native.promise;
   if(!current()){runtime.close();throw Error('startup cancelled');}return runtime;
  }});
 const owner=Object.assign(new Owner(),{state:'starting',coreCapabilities:new Set(),predecessorClose:Promise.resolve(),
  readingEntryPreparations:()=>({beginRequest:()=>false}),
  getReadingRecordGateway:()=>({recover:()=>{assert.equal(owner.state,'ready');recovery.push('duration');return new Promise(()=>{});}}),
  recoverReadingProgressInBackground:()=>{assert.equal(owner.state,'ready');recovery.push('progress');},
  preparationWakeTimer:-1,readingImageDiskCache:{close(){cacheClosed=true;}},async closeRuntime(){this.state='closed';},
  host:{getContext:()=>({filesDir:'/controlled'}),setResponseAssetBridge(){},createCapabilityRouter:()=>({}),
   needsLegacySnapshotMigration(){migrationStarted=true;return migrationResult;},
   async markLegacySnapshotMigrated(){events.push('migration-marker-write');}},
  requireCoreBuildIdentity:value=>value,requireSourceSwitchRecoveryCount:value=>value,
  async recoverPendingLocalImportFinalizes(){events.push('cleanup');await cleanup.promise;},
  getDownloadStorageGateway:()=>({restoreLegacyProtection:()=>{assert.equal(owner.state,'ready');background.push('download-migration');return downloadMigration;},
    maintainAutomaticStorage:async()=>{assert.equal(owner.state,'ready');background.push('storage-maintenance');}}),
  getDownloadCoordinator:()=>({restore:async()=>{background.push('download-restore');}}),
  async installBundledBookSourceCollection(){assert.equal(this.state,'ready');assert.equal(this.runtime,runtime);background.push('source-start');
    await sourceTask;return{collectionRecords:0,uniqueSourceIds:0,processed:0,installedOrUpgraded:0,failed:0,interrupted:false};}});
 return{owner,runtime,native,cleanup,events,requests,clock,background,recovery,
  downloadMigration:value=>{downloadMigration=value;},sourceTask:value=>{sourceTask=value;},fail(){createError=true;},recover(){createError=false;},opens:()=>opens,
  inspector:()=>inspector,metadataCalls:()=>metadataCalls,cacheClosed:()=>cacheClosed,
  migrationStarted:()=>migrationStarted, migration(value){migrationResult=value;}};
}
{
 const f=fixture();const start=f.owner.startRuntime();await tick();assert.deepEqual(f.events,[]);
 assert.equal(f.migrationStarted(),true,'read-only Host marker I/O overlaps outstanding native open');
 f.native.resolve();await start;assert.equal(f.owner.state,'ready');assert.equal(f.owner.runtime,f.runtime);
 assert.ok(!f.events.includes('cleanup'),'confirmed import cleanup cannot gate ready');
 assert.deepEqual(f.recovery,['duration','progress'],'post-ready record/progress recovery must never join the startup dependency chain');
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
for (const negotiated of [false,true]) {
 const f=fixture(negotiated?['host.http.timeout.v1']:[]);f.native.resolve();await f.owner.startRuntime();
 const manifests=f.requests.filter(request=>request.method==='runtime.setHostCapabilities');
 assert.equal(manifests.length,negotiated?2:1);
 assert.equal(Object.hasOwn(manifests[0].params,'extensions'),false,'initial legacy manifest stays strict');
 if(negotiated)assert.deepEqual(manifests[1].params.extensions,['http.execute.timeoutMs.v1']);
 assert.equal(f.owner.state,'ready');
}
console.log('startup boundaries: parallel Host marker/native open, restore barrier/order and marker failure cleanup; async admission, failed-open retry, close-before-ready release, post-ready cleanup and undispatched receipt preservation PASS');

{
 const f=fixture();f.owner.state='new';f.fail();
 const methods=['search.history.list','source.list','bookshelf.list'];
 const first=await Promise.allSettled(methods.map(method=>f.owner.requestDirect(method)));
 assert.ok(first.every(result=>result.status==='rejected'&&/open failed/.test(result.reason.message)));
 assert.equal(f.opens(),1,'concurrent search entry reads share one native startup');
 assert.equal(f.owner.startup,undefined);assert.equal(f.owner.state,'new');
 assert.equal(f.requests.length,0,'failed open never dispatches a command');
 f.recover();const next=methods.map(method=>f.owner.requestDirect(method));await tick();
 assert.equal(f.opens(),2);assert.equal(f.requests.length,0,'entry reads wait for native readiness');
 f.native.resolve();await Promise.all(next);
 assert.equal(f.owner.state,'ready');
 const recovery=f.events.indexOf('source.switch.recover');
 for(const method of methods) assert.ok(f.events.indexOf(method)>recovery,'entry must not bypass storage recovery');
 f.owner.state='closed';await assert.rejects(f.owner.requestDirect('search.history.list'),/teardown/);
 assert.equal(f.opens(),2,'closed owners cannot silently reopen');
}
console.log('search entry concurrent startup failure, shared retry, recovery barrier and closed-owner rejection PASS');

{
 const f=fixture();f.native.resolve();await f.owner.startRuntime();
 assert.equal(typeof f.inspector(),'function','startup installs metadata only after native runtime exists');
 const digest='a'.repeat(64);const proof=await f.inspector()(new Uint8Array([1,2,3]),digest,()=>true);
 assert.deepEqual(proof,{status:'absent',orientation:null,sha256:digest,bytes:3});
 assert.equal(f.metadataCalls(),1);assert.ok(f.events.includes('manga.resource.inspect'),'the installed callback uses the exact owned runtime');
 await f.owner.close();assert.equal(f.inspector(),undefined,'public close detaches metadata inspection before releasing owned resources');
 assert.equal(f.cacheClosed(),true);
}
console.log('PASS production metadata lifecycle: startup injects inspector, callback uses owned Core request, public close detaches and closes image cache');

{
 const f=fixture(), downloads=deferred(), sources=deferred();
 f.downloadMigration(downloads.promise);f.sourceTask(sources.promise);f.native.resolve();
 await f.owner.startRuntime();
 assert.equal(f.owner.state,'ready');assert.equal(f.owner.runtime,f.runtime);
 assert.deepEqual(f.background,['download-migration','source-start']);
 let sourceFinished=false;f.owner.sourceSupplyTask.then(()=>{sourceFinished=true;});await tick();
 assert.equal(sourceFinished,false,'the real pending source task does not hold startup readiness');
 await f.owner.requestDirect('source.list');assert.ok(f.events.includes('source.list'),'usable reader requests dispatch while both background jobs remain pending');
 sources.resolve();await f.owner.sourceSupplyTask;assert.equal(sourceFinished,true);
 downloads.resolve();await tick();assert.deepEqual(f.background.slice(-2),['download-restore','storage-maintenance']);
}
console.log('PASS actual post-ready source/download background tasks do not gate usable runtime or first-page reads');

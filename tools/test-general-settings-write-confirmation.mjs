import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
const require=createRequire(import.meta.url),ts=require((process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader')+'/node_modules/typescript');
const base=new URL('../entry/src/main/ets/',import.meta.url);
function compile(file,deps={}){const text=readFileSync(new URL(file,base),'utf8');const parsed=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);assert.deepEqual(parsed.parseDiagnostics,[]);const emitted=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});assert.deepEqual(emitted.diagnostics,[]);const module={exports:{}};new Function('require','module','exports',emitted.outputText)(id=>{if(!(id in deps))throw Error(`Missing ${file}: ${id}`);return deps[id];},module,module.exports);return module.exports;}
const defaults={autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:false,crashLog:true};
const choice={...defaults,reduceMotion:true};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
const tick=()=>new Promise(r=>setImmediate(r)),settle=async()=>{for(let i=0;i<12;i++)await tick();};
function fixture(){
 const cache=new Map(Object.entries(defaults)),disk=new Map(cache),events=[];let failure,putFailure,barrier=async()=>{},storeGate,readGate,flushGate;
 const store={async get(k,d){events.push(['get',k]);if(readGate){const g=readGate;readGate=undefined;await g.promise;}if(failure==='read'){failure=undefined;throw Error('read unavailable');}return cache.get(k)??d;},async put(k,v){events.push(['put',k,v]);if(putFailure===k){putFailure=undefined;throw Error('put ACK unavailable');}cache.set(k,v);},async flush(){events.push(['flush']);if(flushGate){const g=flushGate;flushGate=undefined;await g.promise;}if(failure==='before'){failure=undefined;throw Error('flush before durable');}disk.clear();for(const [k,v]of cache)disk.set(k,v);if(failure==='after'){failure=undefined;throw Error('durable flush ACK lost');}}};
 const context={label:'first'},runtime={getUIAbilityContext:()=>context};let active=runtime;
 const Runtime={ReaderRuntimeOwner:runtimeOwnerIdentityProbe(()=>active)},Write=compile('app/ReaderWriteEvidence.ts'),facts=compile('app/ReaderOperationFacts.ts'),receipt=compile('app/ReaderPersistedReceiptProjection.ts',{'./ReaderOperationFacts':facts});
 const gatewayModule=compile('features/settings/SettingsGateway.ts',{'@ohos.data.preferences':{default:{getPreferences:async()=>{if(storeGate){const g=storeGate;storeGate=undefined;await g.promise;}return store;}}},'../../app/ReaderThemeHost':{ReaderThemeHost:{prepareUserChange:()=>barrier()}}});
 const orchestratorModule=compile('features/settings/SettingsOrchestrator.ets',{'./SettingsGateway':gatewayModule,'@kit.PerformanceAnalysisKit':{hilog:{error(){}}},'../../app/ReaderRuntimeOwner':Runtime,'./LocalConfigurationReset':{LocalConfigurationReset:{request(){throw Error('reset uses its actual dedicated suite');}}},'../../app/ReaderWriteEvidence':Write,'../../app/ReaderOperationFacts':facts,'../../app/ReaderPersistedReceiptProjection':receipt});
 const hostModule=compile('features/settings/SettingsHost.ets',{'./SettingsOrchestrator':orchestratorModule,'../../app/ReaderRuntimeOwner':Runtime,'./SettingsCacheCleanupOwner':{SettingsCacheCleanupOwner:class{}}});
 const Gateway=gatewayModule.SettingsGateway,gateway=new Gateway(context);
 function host(){const ui={value:{...defaults},projection:{},mounted:true};const host=new hostModule.SettingsHost(s=>{ui.value={...s};},()=>ui.value,()=>ui.mounted,()=>active.getUIAbilityContext(),p=>{ui.projection=p;});return{host,ui};}
 return{cache,disk,events,gateway,Gateway,Write,runtime,host,fail:x=>{failure=x;},putFail:k=>{putFailure=k;},barrier:f=>{barrier=f;},hangStore:g=>{storeGate=g;},hangRead:g=>{readGate=g;},hangFlush:g=>{flushGate=g;},retire:()=>{active=undefined;},remount:()=>{active={getUIAbilityContext:()=>({label:'rebuilt'})};return new Gateway(active.getUIAbilityContext());},setActive:r=>{active=r;},current:()=>active};
}
let cases=0;
for(const failure of ['before','after','put']){
 const f=fixture(),events=[];f.gateway.subscribe(s=>events.push(s));await f.gateway.update(defaults);const puts=f.events.filter(e=>e[0]==='put').length;
 if(failure==='put')f.putFail('reduceMotion');else f.fail(failure);const evidence=new f.Write.ReaderWriteEvidence();await assert.rejects(f.gateway.update(choice,false,'reduceMotion',evidence));
 assert.equal(evidence.confirmation(),'unknown');assert.deepEqual(f.gateway.current(),choice);assert.deepEqual(f.gateway.writeFacts().saved,defaults);assert.equal(f.gateway.writeFacts().pendingReconciliation,true);
 assert.ok(f.events.filter(e=>e[0]==='put').slice(puts).every(e=>e[2]===choice[e[1]]),'no old compensation writes');assert.equal(events.length,1,'unconfirmed values do not qualify background subscription');
 const warm=f.remount();assert.deepEqual(await warm.load(),choice);assert.equal(warm.writeFacts().pendingReconciliation,true,'cached load cannot confirm old flush');
 await warm.retryAccepted();assert.equal(warm.writeFacts().pendingReconciliation,false);assert.deepEqual(Object.fromEntries(f.disk),choice);cases++;
}
{
 const f=fixture(),gate=deferred();await f.gateway.update(defaults);f.hangFlush(gate);const old=f.gateway.update(choice);await settle();const warm=f.remount();assert.deepEqual(await warm.load(),choice,'reentry need not await old unsettled flush');
 const second={...choice,crashLog:false},next=warm.update(second,false,'crashLog');await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,8,'different contexts share exact file lane');gate.resolve();await old;await next;assert.deepEqual(Object.fromEntries(f.disk),second);cases++;
}
{
 const f=fixture();await f.gateway.update(defaults);f.fail('after');await assert.rejects(f.gateway.update(choice));const gate=deferred();f.barrier(()=>{f.barrier(async()=>{});return gate.promise;});const old=f.gateway.retryAccepted(),rejected=assert.rejects(old,/SUPERSEDED/);await f.gateway.update({...choice,crashLog:false});gate.resolve();await rejected;assert.equal(f.events.filter(e=>e[0]==='flush').length,3,'stale retry cannot borrow new accepted tuple');cases++;
}
for(const boundary of ['barrier','lane','store','read']){
 const f=fixture(),gate=deferred();let prior;if(boundary==='lane'){await f.gateway.update(defaults);f.hangFlush(gate);prior=f.gateway.update(defaults);await settle();}else if(boundary==='barrier')f.barrier(()=>gate.promise);else if(boundary==='store')f.hangStore(gate);else f.hangRead(gate);
 const before=f.events.filter(e=>e[0]==='put').length,runtime=f.current(),write=f.gateway.update(choice,false,undefined,undefined,()=>f.current()===runtime),rejected=assert.rejects(write,/SUPERSEDED/);await settle();f.retire();gate.resolve();if(prior)await prior;await rejected;assert.equal(f.events.filter(e=>e[0]==='put').length,before,`${boundary}: last admission rejects retired owner`);cases++;
}
{
 const f=fixture();await f.gateway.update(defaults);f.Gateway.acceptedRevision=Number.MAX_SAFE_INTEGER;await assert.rejects(f.gateway.update(choice),/EXHAUSTED/);assert.equal(f.events.filter(e=>e[0]==='put').length,4);cases++;
}
for(const failure of ['before','after']){
 const f=fixture(),first=f.host();first.host.open();await settle();f.fail(failure);first.host.toggle('reduceMotion',true);await settle();assert.equal(first.ui.value.reduceMotion,true,'actual Host keeps accepted choice');assert.equal(first.ui.projection.receipt.receipt.confirmation,'unknown');assert.equal(first.ui.projection.canRetryAccepted,true);
 const puts=f.events.filter(e=>e[0]==='put').length;first.host.reconcile(first.ui.projection.receipt.facts.generation);await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,puts,'ordinary reconcile is pure read');assert.equal(first.ui.projection.receipt.receipt.confirmation,'unknown');
 const oldGeneration=first.ui.projection.receipt.facts.generation;first.ui.mounted=false;const rebuilt=f.host();rebuilt.host.open();await settle();assert.equal(rebuilt.ui.value.reduceMotion,true);assert.equal(rebuilt.ui.projection.receipt.receipt.confirmation,'unknown','new Host reconstructs file-owned unknown');
 first.host.retryAccepted(oldGeneration);await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,puts,'closed physical callback rejects retry');
 const generation=rebuilt.ui.projection.receipt.facts.generation;rebuilt.host.retryAccepted(generation);rebuilt.host.retryAccepted(generation);await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,puts+4,'double click only one finite full snapshot setter');assert.equal(rebuilt.ui.projection.receipt.receipt.confirmation,'confirmed');assert.equal(rebuilt.ui.projection.canRetryAccepted,false);cases++;
}
{
 const f=fixture(),first=f.host();first.host.open();await settle();const gate=deferred();f.hangFlush(gate);first.host.toggle('reduceMotion',true);await settle();first.ui.mounted=false;const rebuilt=f.host();rebuilt.host.open();await settle();assert.equal(rebuilt.ui.value.reduceMotion,true);assert.equal(rebuilt.ui.projection.canRetryAccepted,false);gate.resolve();await settle();rebuilt.host.open();await settle();assert.equal(rebuilt.ui.value.reduceMotion,true);assert.equal(rebuilt.ui.projection.receipt.receipt.confirmation,'confirmed');cases++;
}
console.log(`General settings actual Gateway/Host + SDK-source confirmation/admission matrix: PASS (${cases} cases).`);

import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runtimeOwnerIdentityProbe } from './reader-runtime-admission-probe.mjs';
const { ts } = installedEtsCompiler();
const base=new URL('../../entry/src/main/ets/',import.meta.url);
function compile(file,deps={}){const text=readFileSync(new URL(file,base),'utf8');const parsed=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);assert.deepEqual(parsed.parseDiagnostics,[]);const emitted=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});assert.deepEqual(emitted.diagnostics,[]);const module={exports:{}};new Function('require','module','exports',emitted.outputText)(id=>{if(!(id in deps))throw Error(`Missing ${file}: ${id}`);return deps[id];},module,module.exports);return module.exports;}
export const defaults={autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:false,crashLog:true,developerMode:false};
export const choice={...defaults,reduceMotion:true};
export const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
export const tick=()=>new Promise(r=>setImmediate(r)),settle=async()=>{for(let i=0;i<12;i++)await tick();};
export function fixture(){
 const cache=new Map(Object.entries(defaults)),disk=new Map(cache),events=[];let failure,putFailure,barrier=async()=>{},storeGate,readGate,flushGate;
 const store={async get(k,d){events.push(['get',k]);if(readGate){const g=readGate;readGate=undefined;await g.promise;}if(failure==='read'){failure=undefined;throw Error('read unavailable');}return cache.get(k)??d;},async put(k,v){events.push(['put',k,v]);if(putFailure===k){putFailure=undefined;throw Error('put ACK unavailable');}cache.set(k,v);},async flush(){events.push(['flush']);if(flushGate){const g=flushGate;flushGate=undefined;await g.promise;}if(failure==='before'){failure=undefined;throw Error('flush before durable');}disk.clear();for(const [k,v]of cache)disk.set(k,v);if(failure==='after'){failure=undefined;throw Error('durable flush ACK lost');}}};
 const context={label:'first'},runtime={getUIAbilityContext:()=>context};let active=runtime;
 const Runtime={ReaderRuntimeOwner:runtimeOwnerIdentityProbe(()=>active)},Write=compile('app/ReaderWriteEvidence.ts'),facts=compile('app/ReaderOperationFacts.ts'),receipt=compile('app/ReaderPersistedReceiptProjection.ts',{'./ReaderOperationFacts':facts});
 const gatewayDependencies={'@ohos.data.preferences':{default:{getPreferences:async()=>{if(storeGate){const g=storeGate;storeGate=undefined;await g.promise;}return store;}}},'../../app/ReaderThemeHost':{ReaderThemeHost:{prepareUserChange:()=>barrier()}}};
 const gatewayModule=compile('features/settings/SettingsGateway.ts',gatewayDependencies);
 const orchestratorModule=compile('features/settings/SettingsOrchestrator.ets',{'./SettingsGateway':gatewayModule,'@kit.PerformanceAnalysisKit':{hilog:{error(){}}},'../../app/ReaderRuntimeOwner':Runtime,'./LocalConfigurationReset':{LocalConfigurationReset:{request(){throw Error('reset uses its actual dedicated suite');}}},'../../app/ReaderWriteEvidence':Write,'../../app/ReaderOperationFacts':facts,'../../app/ReaderPersistedReceiptProjection':receipt});
 const hostModule=compile('features/settings/SettingsHost.ets',{'./SettingsOrchestrator':orchestratorModule,'../../app/ReaderRuntimeOwner':Runtime,'./SettingsCacheCleanupOwner':{SettingsCacheCleanupOwner:class{}}});
 const Gateway=gatewayModule.SettingsGateway,gateway=new Gateway(context);
 function host(){const ui={value:{...defaults},projection:{},mounted:true};const host=new hostModule.SettingsHost(s=>{ui.value={...s};},()=>ui.value,()=>ui.mounted,()=>active.getUIAbilityContext(),p=>{ui.projection=p;});return{host,ui};}
 return{Host:hostModule.SettingsHost,Runtime:Runtime.ReaderRuntimeOwner,cache,disk,events,gateway,Gateway,Write,runtime,host,fail:x=>{failure=x;},putFail:k=>{putFailure=k;},barrier:f=>{barrier=f;},hangStore:g=>{storeGate=g;},hangRead:g=>{readGate=g;},hangFlush:g=>{flushGate=g;},retire:()=>{active=undefined;},remount:()=>{active={getUIAbilityContext:()=>({label:'rebuilt'})};return new Gateway(active.getUIAbilityContext());},coldGateway:()=>{cache.clear();for(const[k,v]of disk)cache.set(k,v);const ColdGateway=compile('features/settings/SettingsGateway.ts',gatewayDependencies).SettingsGateway;return new ColdGateway({label:'cold-start'});},setActive:r=>{active=r;},current:()=>active};
}

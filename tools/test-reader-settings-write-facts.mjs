import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as state from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';

const require=createRequire(import.meta.url),ts=require((resolveEtsLoaderRoot())+'/node_modules/typescript');
const dir=new URL('../entry/src/main/ets/features/reading/',import.meta.url),source=readFileSync(new URL('ReaderSettingsGateway.ts',dir),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(done=>setImmediate(done));};
function fixture(text=source){
 const events=[],cache=new Map(),durable=new Map();let failure,putFailure=false,readGate,storeGate,flushGate,barrier=async()=>{};
 const runtime={getUIAbilityContext:()=>({})};let active=runtime;
 const store={async get(key,fallback){events.push(['get']);if(readGate){const g=readGate;readGate=undefined;await g.promise;}return cache.get(key)??fallback;},
  async put(key,value){events.push(['put',JSON.parse(value)]);if(putFailure){putFailure=false;throw Error('put before effect');}cache.set(key,value);},
  async flush(){events.push(['flush']);if(flushGate){const g=flushGate;flushGate=undefined;await g.promise;}
   if(failure==='before'){failure=undefined;throw Error('flush before durable');}
   for(const [k,v]of cache)durable.set(k,v);if(failure==='after'){failure=undefined;throw Error('durable flush lost ACK');}}};
 const body=text.replace(/^import[\s\S]*?;\n/gm,'');
 const tree=ts.createSourceFile('ReaderSettingsGateway.ts',body,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert.deepEqual(tree.parseDiagnostics,[]);const emitted=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
 assert.deepEqual(emitted.diagnostics,[]);const exports={};
 new Function('exports',...Object.keys(state),'ReaderRuntimeOwner','ReaderThemeHost','preferences',emitted.outputText)(exports,...Object.values(state),
  {isCurrent:owner=>owner===active,current:()=>active},{prepareUserChange:()=>barrier()},
  {getPreferences:async()=>{if(storeGate){const g=storeGate;storeGate=undefined;await g.promise;}return store;}});
 const Gateway=exports.ReaderSettingsGateway,owner=new Gateway(runtime);
 return{owner,Gateway,runtime,store,events,cache,durable,failFlush:when=>{failure=when;},failPut:()=>{putFailure=true;},
  hangRead:g=>{readGate=g;},hangStore:g=>{storeGate=g;},hangFlush:g=>{flushGate=g;},setBarrier:f=>{barrier=f;},
  remount(){active={...runtime};return new Gateway(active);},retire(){active=undefined;}};
}
const initial=state.createDefaultReaderSettingsSnapshot(),choice=state.setReaderSettingsToggle(initial,'alignPageBottom',true);
for(const failure of ['before','after','put']){
 const f=fixture();await f.owner.update(initial);const before=f.events.length;
 if(failure==='put')f.failPut();else f.failFlush(failure);await assert.rejects(f.owner.update(choice));
 assert.deepEqual(f.owner.current(),choice);assert.equal(f.owner.writeFacts().pendingReconciliation,true);
 assert.deepEqual(f.owner.writeFacts().saved,initial);assert.deepEqual(f.events.slice(before).filter(e=>e[0]==='put').map(e=>e[1]),[choice]);
 const warm=f.remount();assert.deepEqual(await warm.load(),choice);assert.equal(warm.writeFacts().pendingReconciliation,true);
 await warm.retryAccepted();assert.equal(warm.writeFacts().pendingReconciliation,false);assert.deepEqual(warm.writeFacts().saved,choice);
 assert.deepEqual(f.events.slice(before).filter(e=>e[0]==='put').map(e=>e[1]),[choice,choice]);
}
console.log('PASS actual ReaderSettings Gateway accepted/current vs flush-confirmed, no compensation and same-snapshot finite retry.');
{
 const f=fixture(),gate=deferred();await f.owner.update(initial);f.hangFlush(gate);const old=f.owner.update(choice);await settle();
 const warm=f.remount();assert.deepEqual(await warm.load(),choice,'warm owner reads current choice before old flush settles');
 const newer=state.setReaderSettingsToggle(choice,'longPressSelectText',false),next=warm.update(newer);await settle();
 assert.equal(f.events.filter(e=>e[0]==='put').length,2,'same file writer stays held across Runtime');
 gate.resolve();await old;await next;assert.deepEqual(warm.writeFacts().saved,newer);assert.deepEqual(warm.current(),newer);
}
{
 const f=fixture(),gate=deferred();await f.owner.update(initial);f.failFlush('after');await assert.rejects(f.owner.update(choice));
 f.setBarrier(()=>{f.setBarrier(async()=>{});return gate.promise;});const retry=f.owner.retryAccepted(),rejected=assert.rejects(retry,/SUPERSEDED/);
 const newer=state.setReaderSettingsToggle(choice,'longPressSelectText',false);await f.owner.update(newer);gate.resolve();await rejected;
 assert.deepEqual(f.owner.current(),newer);assert.equal(f.events.filter(e=>e[0]==='put').length,3,'old queued retry cannot write after newer choice');
}
for(const boundary of ['barrier','lane','store','read']){
 const f=fixture(),gate=deferred();let prior;
 if(boundary==='lane'){await f.owner.update(initial);f.hangFlush(gate);prior=f.owner.update(initial);await settle();}
 else if(boundary==='barrier')f.setBarrier(()=>gate.promise);
 else if(boundary==='store')f.hangStore(gate);
 else f.hangRead(gate);
 const before=f.events.filter(e=>e[0]==='put').length,write=f.owner.update(choice),rejected=assert.rejects(write,/SUPERSEDED/);
 await settle();f.remount();gate.resolve();if(prior)await prior;await rejected;
 assert.equal(f.events.filter(e=>e[0]==='put').length,before,`${boundary}: retired Runtime cannot reach first write`);
}
{
 const f=fixture();await f.owner.update(initial);f.Gateway.acceptedRevision=Number.MAX_SAFE_INTEGER;
 await assert.rejects(f.owner.update(choice),/EXHAUSTED/);assert.equal(f.events.filter(e=>e[0]==='put').length,1);
}
for(const failure of ['before','after']){
 const f=fixture(),legacy={...initial,version:3,hideStatusBar:true};delete legacy.extendIntoCutout;
 f.cache.set('snapshot',JSON.stringify(legacy));f.failFlush(failure);
 const loaded=await f.owner.loadAfterConfigurationRecovery(()=>true);assert.equal(loaded.version,5);assert.equal(loaded.extendIntoCutout,true);
 assert.equal(f.owner.writeFacts().pendingReconciliation,true,'migration unknown is an actual write fact');
 assert.equal(f.events.filter(e=>e[0]==='put').length,1);await f.owner.retryAccepted();assert.equal(f.owner.writeFacts().pendingReconciliation,false);
}
for(const text of ['', 'null','{broken']){
 const f=fixture();f.cache.set('snapshot',text);assert.deepEqual(await f.owner.load(),initial);assert.equal(f.events.some(e=>e[0]==='put'),false);
}

// Narrow manga choices have exactly the same accepted/ACK and finite-owner contract.
for (const failure of ['before', 'after', 'put']) {
 const f=fixture();await f.owner.update(initial);const before=f.events.length;
 if(failure==='put')f.failPut();else f.failFlush(failure);
 await assert.rejects(f.owner.updateMangaPreferences({mangaDirection:'horizontal',mangaFit:'contain'}));
 const accepted=f.owner.current();assert.equal(accepted.mangaDirection,'horizontal');assert.equal(accepted.mangaFit,'contain');
 assert.equal(f.owner.writeFacts().pendingReconciliation,true);assert.equal(f.owner.writeFacts().saved.mangaDirection,undefined);
 assert.equal(f.events.slice(before).filter(e=>e[0]==='put').length,1,'a failed manga flush never compensates the platform cache');
 const warm=f.remount();await warm.update({...initial,pageTransition:'cover'});
 assert.equal(warm.current().mangaDirection,'horizontal');assert.equal(warm.current().mangaFit,'contain');
 assert.equal(warm.writeFacts().pendingReconciliation,false);assert.equal(warm.writeFacts().saved.mangaFit,'contain');
}
{
 const f=fixture(),gate=deferred();await f.owner.update(initial);f.setBarrier(()=>gate.promise);
 const writing=f.owner.updateMangaPreferences({mangaFit:'width'}),rejected=assert.rejects(writing,/SUPERSEDED/);
 await settle();f.remount();gate.resolve();await rejected;
 assert.equal(f.events.filter(e=>e[0]==='put').length,1,'retired manga owner cannot dispatch its narrow patch');
}

function reader(f,file=new URL('LocalReadingExperience.ets',dir)){
 const events=[];
 const Reader=productionMotionMethods(file,['commitReaderSessionSettings','commitReaderWindowSettings','changeReaderPageTurnStyle',
  'captureReaderSettingsAdmission','notifyReaderSettingsSavePending','retryPendingReaderSettings','showReaderSettingsFailure',
  'loadReaderSettingsSnapshot','isSessionActive'],{...state,ReaderRuntimeOwner:{current:()=>f.runtime},hilog:{warn(){}}});
 const host=Object.assign(new Reader(),{sourceId:'source',bookId:'book',mounted:true,lifecycleToken:1,exitRequested:false,
  readerSettingsMutationGeneration:0,pageStyleChangeGeneration:0,readerSettingsSnapshot:initial,readerSettingsLoaded:false,
  pageTurnRenderRevision:0,bookTurnRuntimeFailed:true,continuousProgressRevision:0,phase:'ready',
  readerSettingsGateway:f.owner,configureReaderScreenAwakeLease:s=>events.push(['awake',s]),applyReaderSystemEventPolicy:s=>events.push(['system',s]),
  applyReaderWindowPolicy:async s=>events.push(['window',s]),applyInitialReaderWindowPolicy:()=>events.push(['initial-window']),
  controlsPresentedForWindow:()=>false,reflowAfterWindowGeometryChange:()=>events.push(['reflow']),
  invalidatePageTurnRuntime:()=>events.push(['invalidate']),hasCurrentMaterializedChapter:()=>true,
  rebuildContinuousFragments:()=>events.push(['continuous']),setContinuousInitialAnchor:()=>{},beginCanonicalModeMeasurement:()=>events.push(['paged']),
  schedulePageTurnPreparation:()=>events.push(['prepare']),errorMessage:e=>e.message,
  getUIContext:()=>({getPromptAction:()=>({showToast:spec=>events.push(['notice',spec.message])})})});
 return{host,events};
}
for(const kind of ['session','window','style','scroll']){
 const f=fixture();await f.owner.update(initial);f.failFlush('after');const ui=reader(f);
 const target=kind==='window'?state.setReaderSettingsToggle(initial,'extendIntoCutout',true):
  kind==='style'?state.setReaderPageTurnStyle(initial,'simulation'):kind==='scroll'?state.setReaderPageTurnStyle(initial,'scroll'):choice;
 if(kind==='session')ui.host.commitReaderSessionSettings(target);else if(kind==='window')ui.host.commitReaderWindowSettings(target);
 else ui.host.changeReaderPageTurnStyle(kind==='scroll'?'scroll':'simulation');
 await settle();assert.deepEqual(ui.host.readerSettingsSnapshot,target,`${kind}: missing Preferences ACK keeps current accepted settings`);
 assert.equal(f.owner.writeFacts().pendingReconciliation,true);assert.deepEqual(JSON.parse(f.durable.get('snapshot')),target);
 assert.equal(ui.host.readerSettingsRecovery.visible,true);assert.equal(ui.host.readerSettingsRecovery.canRetry,true);
 assert.match(ui.host.readerSettingsRecovery.message,/尚未确认/);
 assert.equal(ui.events.filter(e=>e[0]==='notice').length,0,'unconfirmed saving remains visible rather than depending on a transient toast');
 if(kind==='window')assert.equal(ui.events.filter(e=>e[0]==='window').length,1,'native success is not undone by unrelated Preferences ACK');
 if(kind==='scroll')assert.equal(ui.events.filter(e=>e[0]==='paged').length,0,'unknown flush cannot force a second navigation mode');
 if(kind==='style')assert.equal(ui.host.bookTurnRuntimeFailed,false,'accepted actual capability re-entry is retained');
}
{
 const f=fixture();await f.owner.update(initial);const ui=reader(f),target=state.setReaderSettingsToggle(initial,'extendIntoCutout',true);
 ui.host.applyReaderWindowPolicy=async snapshot=>{ui.events.push(['window',snapshot]);if(snapshot.extendIntoCutout)throw Error('native policy refused');};
 ui.host.commitReaderWindowSettings(target);await settle();assert.deepEqual(ui.host.readerSettingsSnapshot,initial);
 assert.equal(f.events.filter(e=>e[0]==='put').length,1,'actual window refusal precedes settings write');
 assert.match(ui.events.find(e=>e[0]==='notice')[1],/窗口设置未能应用/);
}
for(const change of ['lifecycle','book','generation']){
 const f=fixture(),gate=deferred();await f.owner.update(initial);f.hangRead(gate);const ui=reader(f);ui.host.commitReaderSessionSettings(choice);await settle();
 if(change==='lifecycle')ui.host.lifecycleToken++;else if(change==='book')ui.host.bookId='new';else ui.host.readerSettingsMutationGeneration++;
 gate.resolve();await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,1,`${change}: retired queued UI never dispatches`);
 assert.equal(ui.events.some(e=>e[0]==='notice'),false);
}
for(const prepared of [true,false]){
 const f=fixture();await f.owner.update(initial);f.failFlush('after');await assert.rejects(f.owner.update(choice));const ui=reader(f);
 if(prepared){ui.host.readerSettingsLoaded=true;ui.host.readerSettingsSnapshot=choice;}
 await ui.host.loadReaderSettingsSnapshot(1);await settle();assert.deepEqual(ui.host.readerSettingsSnapshot,choice);
 assert.equal(f.owner.writeFacts().pendingReconciliation,false,'both actual warm prepared and initial load schedule one finite retry');
 assert.equal(ui.host.readerSettingsRecovery.visible,false,'actual successful flush settles the persistent notice');
 assert.equal(f.events.filter(e=>e[0]==='put').length,3);
}
const scratch=mkdtempSync(join(tmpdir(),'reader-settings-write-facts-'));
try{
 const file=join(scratch,'LocalReadingExperience.ets'),lre=readFileSync(new URL('LocalReadingExperience.ets',dir),'utf8');
 const sessionStart=lre.indexOf('  private commitReaderSessionSettings('),sessionEnd=lre.indexOf('  private commitReaderWindowSettings(',sessionStart);
 const old=lre.slice(0,sessionStart)+lre.slice(sessionStart,sessionEnd).replace('this.notifyReaderSettingsSavePending(error, current));',
  '{ this.readerSettingsSnapshot = createDefaultReaderSettingsSnapshot(); this.notifyReaderSettingsSavePending(error, current); });')+lre.slice(sessionEnd);
 assert.notEqual(old,lre);writeFileSync(file,old);const f=fixture();await f.owner.update(initial);f.failFlush('after');const ui=reader(f,file);
 ui.host.commitReaderSessionSettings(choice);await settle();assert.deepEqual(ui.host.readerSettingsSnapshot,initial,
  'old actual LRE compensation is reproduced by the production negative control');
 const compensating=source.replace('await store.flush();','try { await store.flush(); } catch (error) { await store.put(READER_SETTINGS_SNAPSHOT_KEY, JSON.stringify(createDefaultReaderSettingsSnapshot())); throw error; }');
 assert.notEqual(compensating,source);const bad=fixture(compensating);await bad.owner.update(initial);bad.failFlush('after');await assert.rejects(bad.owner.update(choice));
 assert.deepEqual(JSON.parse(bad.cache.get('snapshot')),initial,'old actual Gateway compensation overwrites the current platform cache');
}finally{rmSync(scratch,{recursive:true,force:true});}
console.log('PASS full SDK Gateway + actual LRE session/window/style/navigation/load: lost ACK, finite migration/retry, cross-Runtime lane, stale owner/choice, actual native refusal, no unknown policy rollback and production negative controls. OS target proof remains separate.');

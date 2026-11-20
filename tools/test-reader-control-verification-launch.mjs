import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'admission':{description:'Pure exact debug cold-start and preserve-data maintenance admission',resources:[]},
 'diagnostic-composition':{description:'Actual cold diagnostic composition, strict flags, owner/recovery/lifecycle and warm maintenance fences; controlled ports only',resources:[]},
 'ability-consumer':{description:'Actual EntryAbility loadMainContent/Warm Want methods; no window or device',resources:[]},
 'registration':{description:'Required diagnostic pages registered uniquely; extra product pages permitted',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {default:assert}=await import('node:assert/strict');
const { readFile }=await import('node:fs/promises');
const {
  readerControlVerificationColdStartPage,
  readerRebuildableCacheClearEnabled,
}=await import('../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts');

if(selectedCase==='admission'){
const normal = 'pages/Index';
const diagnostic = 'pages/ReaderControlMotionVerification';
const rendererPilot = 'pages/ReaderRendererPilot';
const candidateValues = [undefined, null, false, 0, 1, '', 'true', 'TRUE', '1',
  diagnostic, rendererPilot, { readerControlMotionVerification: true }, { route: diagnostic },
  [true], new Boolean(true)];
for (const debug of [false, true]) {
  for (const mode of ['release', '', 'DEBUG', 'debug', 'debug ', 'preview', 'custom']) {
    for (const value of candidateValues) {
      const expected = debug === true && mode === 'debug' && value === true ? diagnostic : normal;
      assert.equal(readerControlVerificationColdStartPage(debug, mode, value, undefined), expected,
        'renderer pilot requires exact debug cold-start admission');
    }
  }
}
assert.equal(readerControlVerificationColdStartPage(true, 'debug', true, undefined), diagnostic);
assert.equal(readerControlVerificationColdStartPage(true, 'debug', undefined, true), rendererPilot);
assert.equal(readerControlVerificationColdStartPage(true, 'debug', true, true), normal,
  'conflicting diagnostic requests fall back to the normal reader');
assert.equal(readerRebuildableCacheClearEnabled(true, 'debug', true), true);
for (const value of [false, undefined, null, 'true', 1, { enabled: true }])
  assert.equal(readerRebuildableCacheClearEnabled(true, 'debug', value), false,
    'cache maintenance requires an exact debug boolean Want');
assert.equal(readerRebuildableCacheClearEnabled(false, 'debug', true), false);
assert.equal(readerRebuildableCacheClearEnabled(true, 'release', true), false);


return;
}
if(selectedCase==='diagnostic-composition'){
 const {productionEntryDiagnostics}=await import('./lib/reader-entry-diagnostics-probe.mjs');
 const events=[],io=[],logs=[];let capacityPort;
 class EventProbe { constructor(){events.push('event-created');}start(){events.push('event-start');}stop(reason){events.push('event-stop:'+reason);} }
 const Type=productionEntryDiagnostics({ReaderEventLoopProbe:EventProbe,
  ReaderMangaPlatformDiagnostic:{install(mode){if(mode!=='reading')return undefined;events.push('manga-created');return{stop(){events.push('manga-stop');}};}},
  ReaderCapacityProbe:{create(_debug,_mode,_flag,request,current){events.push('capacity-created');capacityPort={request,current};return{start(){events.push('capacity-start');},stop(){events.push('capacity-stop');}};}},
  probeReaderAtomicSnapshot:async(_debug,_mode,_flag,dir,current)=>{io.push(['atomic',dir,current()]);},
  probeReaderAssetInventory:async(_debug,_mode,_flag,current)=>{io.push(['assets',current()]);},
  hilog:{info:(...args)=>logs.push(args),error:(...args)=>logs.push(args)}});
 for(const debug of[false,true,1,'true'])for(const mode of['debug','release','DEBUG'])for(const value of[undefined,false,1,'true',{},[true]]){
  assert.equal(Type.forColdStart(debug,mode,{parameters:{readerEventLoopProbe:value,readerCapacityTrace:value,readerAtomicSnapshotProbe:value}},()=>0),undefined);
 }
 assert.deepEqual(events,[]);assert.deepEqual(io,[],'normal/wrong primitive admission creates no selected probe');
 assert.equal(Type.forColdStart(false,'debug',{parameters:{readerEventLoopProbe:true}},()=>0),undefined);
 for(const [debug,mode]of[[true,'release'],[true,'DEBUG'],[1,'debug'],['true','debug']])assert.equal(Type.forColdStart(debug,mode,{parameters:{readerEventLoopProbe:true,readerCapacityTrace:true,readerAtomicSnapshotProbe:true}},()=>0),undefined);
 const scope={readerMangaOfflineSourceId:'source',readerMangaOfflineBookId:'book'};
 const offline=Type.forColdStart(true,'debug',{parameters:{...scope,readerMangaOfflineProbe:true}},()=>0);
 assert.deepEqual(offline.offlineScope,{sourceId:'source',bookId:'book'});assert.equal(offline.readingScope,undefined);
 const conflict=Type.forColdStart(true,'debug',{parameters:{...scope,readerMangaOfflineProbe:true,readerMangaReadingProbe:true}},()=>0);
 assert.equal(conflict,undefined,'conflicting exact probes remain unarmed');
 const selection=Type.forColdStart(true,'debug',{parameters:{readerMangaReadingProbeSelectManga:true}},()=>0);
 assert.equal(selection.selectionMode,'reading');assert.equal(selection.offlineScope,undefined);assert.equal(selection.readingScope,undefined);
 selection.close();
 const route=Type.forColdStart(true,'debug',{parameters:{...scope,readerMangaOfflineProbe:true,readerControlMotionVerification:true}},()=>0);
 assert.equal(route.coldStartPage,'pages/ReaderControlMotionVerification');assert.equal(route.offlineScope,undefined);
 let ready,current=true,clears=0;const gate=new Promise(resolve=>{ready=resolve;});
 const owner={request:async(method,params,options)=>({data:{method,params,options}}),clearRebuildableCachesForVerification:async()=>{clears++;return{ordinaryBytes:0,derivedDisplayFiles:0,removedContentBytes:0,deletedBytes:0,deletedFiles:0};}};
 const composed=Type.forColdStart(true,'debug',{parameters:{readerEventLoopProbe:true,readerCapacityTrace:true,readerAtomicSnapshotProbe:true,readerAssetInventoryProbe:true}},()=>100);
 composed.bindOwner(owner,()=>current);composed.afterRecovery(gate,'/fixture-files',()=>current);
 assert.equal(capacityPort.current(),true);assert.deepEqual(io,[]);
 assert.deepEqual((await capacityPort.request('reader.fixture',{id:1},{token:'original'})),{method:'reader.fixture',params:{id:1},options:{token:'original'}});
 composed.start();composed.stop('background');current=false;assert.equal(capacityPort.current(),false);
 ready();await gate;await Promise.resolve();assert.deepEqual(io,[['atomic','/fixture-files',false],['assets',false]],'delayed probes receive the original owner admission, never a successor');
 assert.ok(events.includes('event-start')&&events.includes('capacity-start'));assert.ok(events.includes('event-stop:background')&&events.includes('capacity-stop'));
 composed.close();
 const originalWant={parameters:{readerEventLoopProbe:true,readerAtomicSnapshotProbe:false}};
 const frozenCold=Type.forColdStart(true,'debug',originalWant,()=>0),beforeIo=io.length;
 originalWant.parameters.readerAtomicSnapshotProbe=true;
 frozenCold.afterRecovery(Promise.resolve(),'/fixture-files',()=>true);
 await Promise.resolve();assert.equal(io.length,beforeIo,'later Want mutation cannot rearm a cold diagnostic');
 frozenCold.close();

 for(const [debug,mode,value]of[[false,'debug',true],[true,'release',true],[true,'debug','true']]){
  Type.scheduleCacheClear(debug,mode,{parameters:{readerClearRebuildableCache:value}},owner,Promise.resolve(),()=>true);
 }
 await Promise.resolve();assert.equal(clears,0);
 Type.scheduleCacheClear(true,'debug',{parameters:{readerClearRebuildableCache:true}},owner,Promise.resolve(),()=>false);
 await Promise.resolve();assert.equal(clears,0);
 Type.scheduleCacheClear(true,'debug',{parameters:{readerClearRebuildableCache:true}},owner,Promise.resolve(),()=>true);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(clears,1,'one explicit admitted warm maintenance request; no cold-route change');
 return;
}

const normal='pages/Index',diagnostic='pages/ReaderControlMotionVerification',rendererPilot='pages/ReaderRendererPilot';
if(selectedCase==='ability-consumer'){
 const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');const received=[];
 const Ability=selectedProductionMethods(new URL('../entry/src/main/ets/entryability/EntryAbility.ets',import.meta.url),'EntryAbility',
 ['loadMainContent','onNewWant'],{ReaderStartupTrace:{current:()=>undefined},ReaderSystemFileOpenHost:{receive:want=>received.push(want)},hilog:{error(){}},DOMAIN:0});
 for(const page of [normal,diagnostic,rendererPilot]){
  const ability=Object.assign(new Ability(),{coldStartPage:page,windowStageGeneration:1}),loads=[],done=[];
  ability.loadMainContent({loadContent:(name,callback)=>{loads.push(name);callback({code:0});}},code=>done.push(code));
  assert.deepEqual(loads,[page]);assert.deepEqual(done,[0]);assert.equal(ability.coldStartPage,page);
  const want={parameters:{readerControlMotionVerification:true,route:'pages/anything'}};ability.onNewWant(want,{});
  assert.equal(received.at(-1),want);assert.equal(ability.coldStartPage,page,'warm Want cannot replace admitted cold destination');assert.equal(loads.length,1);
 }
 const ability=Object.assign(new Ability(),{coldStartPage:'pages/__ReaderStartupMainLoadFailure',windowStageGeneration:1}),loads=[];
 ability.loadMainContent({loadContent:(name,callback)=>{loads.push(name);callback({code:1});}},()=>{});
 ability.loadMainContent({loadContent:(name,callback)=>{loads.push(name);callback({code:0});}},()=>{});
 assert.deepEqual(loads,['pages/__ReaderStartupMainLoadFailure',normal],'fault dispatch is consumed before platform response');
 let late;let completed=0;ability.loadMainContent({loadContent:(_name,callback)=>{late=callback;}},()=>completed++);ability.windowStageGeneration++;late({code:0});assert.equal(completed,0);
}else{
 const pages=JSON.parse(await readFile(new URL('../entry/src/main/resources/base/profile/main_pages.json',import.meta.url),'utf8'));
 assert.equal(new Set(pages.src).size,pages.src.length,'route IDs register uniquely');
 for(const page of [normal,diagnostic,rendererPilot,'pages/ReaderStartupRecovery'])assert.ok(pages.src.includes(page),page+' registered');
}

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}

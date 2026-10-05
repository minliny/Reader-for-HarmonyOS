import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readerControlVerificationColdStartPage, readerDisableOptionalEntryMemory,
  readerMangaOfflineProbeScope, readerMangaReadingProbeScope, readerMangaProbeSelectionMode } from '../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts';
import { ReaderStartupContentOwner } from '../entry/src/main/ets/app/ReaderStartupContentOwner.ts';
import { ReaderStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createMangaAtomicPayloadInstallerFixture } from './lib/manga-atomic-payload-probe.mjs';
const installMangaAtomicPayloadReader=createMangaAtomicPayloadInstallerFixture({});
const abilityFile=new URL('../entry/src/main/ets/entryability/EntryAbility.ets',import.meta.url),missing='pages/__ReaderStartupMainLoadFailure';
const index='pages/Index',recovery='pages/ReaderStartupRecovery';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const values=[undefined,null,false,0,1,'','true','TRUE','1',[true],{enabled:true},new Boolean(true),true];
for(const debug of [false,true,1,'true',new Boolean(true)])for(const mode of ['release','preview','','DEBUG','debug ','debug'])for(const value of values){
  const expected=debug===true&&mode==='debug'&&value===true?missing:index;
  assert.equal(readerControlVerificationColdStartPage(debug,mode,undefined,undefined,value),expected,'no truthy/coerced or release request enables the fault');
}
for(const motion of [undefined,false,true])for(const renderer of [undefined,false,true]){
  const expected=motion===true||renderer===true?index:missing;
  assert.equal(readerControlVerificationColdStartPage(true,'debug',motion,renderer,true),expected,'diagnostics conflict falls back to normal Index');
}
const pages=JSON.parse(readFileSync(new URL('../entry/src/main/resources/base/profile/main_pages.json',import.meta.url)));
assert.equal(pages.src.includes(missing),false);assert.equal(existsSync(new URL(`../entry/src/main/ets/${missing}.ets`,import.meta.url)),false,'fault destination must really be absent');

function fixture(debug=true,mode='debug',parameters={readerStartupMainLoadFailure:true}){
  const core=deferred(),theme=deferred(),bookMode=deferred(),fonts=deferred(),restore=deferred(),settings=deferred(),windowReady=deferred();
  const events=[],requests=[],wants=[],errors=[];
  const runtime={start:()=>{events.push('core');return core.promise;},release:async()=>{events.push('release');}};
  const Ability=productionMotionMethods(abilityFile,
    ['coldStartPage','windowStageGeneration','startupContent','runtimeOwner','themeReady','recoveryReady','bookshelfModeReady','shelfFontsReady','eventLoopProbe',
      'onCreate','onNewWant','onWindowStageCreate','onWindowStageDestroy','onDestroy','loadMainContent'],{
      DEBUG:debug,BUILD_MODE_NAME:mode,ReaderStartupTrace,ReaderStartupContentOwner,readerMotionNowMs:()=>performance.now(),
      readerControlVerificationColdStartPage,readerDisableOptionalEntryMemory,readerEventLoopProbeEnabled:()=>false,
      readerMangaOfflineProbeScope,readerMangaReadingProbeScope,readerMangaProbeSelectionMode,
      installMangaAtomicPayloadReader,ReaderMangaPlatformDiagnostic:{install:()=>undefined},
      ReaderRuntimeOwner:{install:()=>runtime},DOMAIN:0x5244,hilog:{error:(...args)=>errors.push(args),warn() {},info() {}},
      ConfigurationConstant:{ColorMode:{COLOR_MODE_DARK:1}},AppStorage:{setOrCreate() {}},
      WebDavCredentialStore:{instance:{attachContext() {},loadBookshelfViewMode:()=>bookMode.promise}},
      prepareReaderShelfFonts:()=>fonts.promise,
      ReaderThemeHost:{install:()=>theme.promise,setRecoveryBarrier() {},detach() {}},
      SyncGateway:class{async recoverInterruptedRestore(){events.push('restore');await restore.promise;return false;}},
      LocalConfigurationReset:{recover:async()=>{events.push('reset');}},
      ReaderSettingsGateway:class{async loadAfterConfigurationRecovery(current){assert.equal(current(),true);events.push('settings');await settings.promise;}},
      ReaderSystemFileOpenHost:{install() {},receive:want=>wants.push(want),detach() {}},
      ReaderWindowCoordinator:{install:()=>windowReady.promise,detach:()=>events.push('window-detached')},
    });
  const ability=Object.assign(new Ability(),{context:{config:{colorMode:0},terminateSelf:async()=>{}},prepareSelectedReadingFont:async()=>{events.push('selected-font');}});
  const stage={getMainWindowSync:()=>({}),loadContent:(page,callback)=>requests.push({page,callback})};
  ability.onCreate({parameters},{});ability.onWindowStageCreate(stage);
  const settle=async()=>{core.resolve();theme.resolve();bookMode.resolve(null);windowReady.resolve(true);await tick();restore.resolve();await tick();settings.resolve();fonts.resolve();await tick();};
  return{ability,stage,runtime,events,requests,wants,errors,core,theme,bookMode,fonts,restore,settings,windowReady,settle};
}
{
  const f=fixture();try{
    await tick();assert.deepEqual(f.requests,[],'fault cannot bypass original admission or fonts');
    f.core.resolve();f.theme.resolve();f.bookMode.resolve(null);f.windowReady.resolve(true);await tick();assert.deepEqual(f.requests,[]);
    f.restore.resolve();await tick();assert.ok(f.events.indexOf('reset')>f.events.indexOf('restore'));assert.ok(f.events.indexOf('settings')>f.events.indexOf('reset'));assert.deepEqual(f.requests,[]);
    f.settings.resolve();await tick();assert.deepEqual(f.requests,[],'existing shelf font barrier still withholds the faulty native dispatch');
    f.fonts.resolve();await tick();assert.deepEqual(f.requests.map(r=>r.page),[missing]);assert.equal(f.ability.coldStartPage,index,'probe is consumed before native return');
    const owner=f.ability.startupContent;assert.equal(owner.snapshot().phase,'loading');assert.equal(owner.snapshot().canRetry,false);
    const failed=f.requests[0];failed.callback({code:17,message:'controlled native boundary failure'});assert.deepEqual(f.requests.map(r=>r.page),[missing,recovery]);
    assert.equal(owner.snapshot().phase,'recovery-loading');assert.equal(owner.snapshot().reason,'main-load-failed');f.requests[1].callback({code:0});assert.equal(owner.snapshot().phase,'recovery');
    const recoveryCount=f.events.filter(e=>e==='restore').length;owner.retry();owner.retry();await tick();assert.deepEqual(f.requests.map(r=>r.page),[missing,recovery,index]);
    assert.equal(f.events.filter(e=>e==='restore').length,recoveryCount,'retry reobserves original barrier without replaying restore');
    failed.callback({code:0});assert.equal(owner.snapshot().phase,'loading','late first callback cannot make retry ready');
    f.requests[2].callback({code:0});assert.equal(owner.snapshot().phase,'ready');
    f.ability.onNewWant({parameters:{readerStartupMainLoadFailure:true}},{});assert.equal(f.requests.length,3,'hot Want cannot rearm/reload');
    assert.equal(f.wants.length,2);assert.equal(f.ability.coldStartPage,index);
  }finally{f.ability.onDestroy();}
}
for(const [debug,mode,params] of [[false,'debug',{readerStartupMainLoadFailure:true}],[true,'release',{readerStartupMainLoadFailure:true}],[true,'debug',{}],[true,'debug',{readerStartupMainLoadFailure:'true'}],[true,'debug',{readerStartupMainLoadFailure:true,readerOpenSourcePilot:true}]]){
  const f=fixture(debug,mode,params);try{await f.settle();assert.deepEqual(f.requests.map(r=>r.page),[index]);f.requests[0].callback({code:0});assert.equal(f.ability.startupContent.snapshot().phase,'ready');}finally{f.ability.onDestroy();}
}
{
  const f=fixture();try{
    f.ability.onWindowStageDestroy();await f.settle();assert.deepEqual(f.requests,[],'retired waiting stage cannot dispatch a probe');
    f.ability.onWindowStageCreate(f.stage);await tick();assert.deepEqual(f.requests.map(r=>r.page),[missing]);
    const old=f.ability.startupContent;f.requests[0].callback({code:17});const recoveryAck=f.requests[1].callback;
    f.ability.onWindowStageDestroy();recoveryAck({code:0});assert.equal(old.snapshot().phase,'retired');
    f.ability.onWindowStageCreate(f.stage);await tick();assert.equal(f.requests.at(-1).page,index,'recreated stage cannot rearm an already dispatched fault');
    f.requests[0].callback({code:0});assert.equal(f.ability.startupContent.snapshot().phase,'loading');
    f.requests.at(-1).callback({code:0});assert.equal(f.ability.startupContent.snapshot().phase,'ready');
  }finally{f.ability.onDestroy();}
}
{
  const f=fixture();try{
    f.stage.loadContent=(page,callback)=>{f.requests.push({page,callback});if(page===missing)throw Error('controlled native dispatch throw');};
    await f.settle();assert.deepEqual(f.requests.map(r=>r.page),[missing,recovery]);f.requests[1].callback({code:0});f.ability.startupContent.retry();await tick();assert.equal(f.requests.at(-1).page,index);f.requests.at(-1).callback({code:0});
  }finally{f.ability.onDestroy();}
}
// Remove only the real production consumption statement and run its actual
// method through the same recovery owner. This must make retry fault again.
const abilitySource=readFileSync(abilityFile,'utf8'),consumption="this.coldStartPage = 'pages/Index';";
assert.ok(abilitySource.includes(consumption));
const directory=mkdtempSync(join(tmpdir(),'reader-startup-fault-negative-')),file=join(directory,'EntryAbility.ets');let owner;
try{
  writeFileSync(file,abilitySource.replace(consumption,''));
  const Ability=productionMotionMethods(file,['loadMainContent'],{ReaderStartupTrace:{current:()=>undefined},DOMAIN:0,hilog:{error() {}}});
  const ability=Object.assign(new Ability(),{windowStageGeneration:0,coldStartPage:missing}),requests=[];
  const stage={loadContent:(page,callback)=>requests.push({page,callback})};
  owner=new ReaderStartupContentOwner(Promise.resolve(),{loadMain:done=>ability.loadMainContent(stage,done),loadRecovery:done=>stage.loadContent(recovery,error=>done(error.code)),ready() {},unavailable() {},exit:async()=>{}});
  owner.start();await tick();requests[0].callback({code:17});requests[1].callback({code:0});owner.retry();await tick();
  assert.deepEqual(requests.map(r=>r.page),[missing,recovery,missing],'removed one-shot consumption recreates the fault on retry');
}finally{owner?.close();rmSync(directory,{recursive:true,force:true});}
console.log('PASS startup main-load fault: strict debug cold launch, absent real dispatch destination once, actual Ability/StartupContentOwner admission+recovery+Index retry, default release, hot Want, destroyed/recreated stage and late callbacks; OS failure/render/target evidence remains OPEN');

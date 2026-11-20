import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';

const selected=selectContractCases({'fixture-isolation':'Two actual Coordinator fixtures own separate module/storage/window ports without changing global AppStorage.',configuration:'Actual Coordinator owns valid Configuration.fontSizeScale independently from Display density; lifecycle, dedup and late-window guards.', 'entry-consumer':'Actual Entry window install/configuration update forwarding and retired-stage/theme behavior.', 'native-context':'Actual loaded fixture record observes native following/max/fp-vp conversion with strict unavailable validity; public followSystem config has no max override.'});
if(selected.length){
const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const {createWindowCoordinatorFixture}=await import('./lib/reader-window-coordinator-fixture.mjs');
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const {defaultSourceManagementFilters}=await import('../entry/src/main/ets/features/source/SourceManagementPresentation.ts');
const base=new URL('../entry/src/main/ets/',import.meta.url);
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
async function configuration(){
 const f=await createWindowCoordinatorFixture();try{
  Object.assign(f.displayInfo,{densityPixels:3.5,scaledDensity:3.5});const w=f.windowPort();w.rect={left:0,top:0,width:1280,height:2832};w.avoidTop={left:0,top:0,width:1280,height:137};
  assert.equal(await f.C.install(w,{fontSizeScale:1.45}),true);await flush();
  assert.equal(f.C.metrics().systemFontScale,1.45);assert.equal(f.C.metrics().densityPixels,3.5);assert.equal(f.C.metrics().windowRect.width,1280/3.5);assert.equal(f.C.metrics().systemInsets.top,137/3.5,'font configuration never multiplies px/vp insets');
  const before=f.C.metrics().revision;f.C.refreshConfiguration({fontSizeScale:1.6},w);assert.equal(f.C.metrics().systemFontScale,1.6);assert.equal(f.C.metrics().revision,before+1);
  const revision=f.C.metrics().revision,writes=f.appWrites.filter(x=>x[0]==='readerWindowMetricsRevision').length;
  f.C.refreshConfiguration({fontSizeScale:1.6},w);for(const value of[0,-1,NaN,Infinity,'1.45'])f.C.refreshConfiguration({fontSizeScale:value},w);f.C.refreshConfiguration({},w);f.C.refreshConfiguration(undefined,w);
  assert.equal(f.C.metrics().systemFontScale,1.6);assert.equal(f.C.metrics().revision,revision);assert.equal(f.appWrites.filter(x=>x[0]==='readerWindowMetricsRevision').length,writes);
  Object.assign(f.displayInfo,{densityPixels:7,scaledDensity:7});const stale=f.windowPort();
  f.C.refreshConfiguration({fontSizeScale:3.2},stale);f.C.refreshConfiguration({fontSizeScale:3.2});assert.equal(f.C.metrics().revision,revision,'wrong/missing expected window rejects the entire update, including changed density');
  f.C.refreshConfiguration({fontSizeScale:3.2},w);assert.equal(f.C.metrics().systemFontScale,3.2,'Coordinator stores actual valid scale without the feature-control cap');assert.equal(f.C.metrics().densityPixels,7);assert.equal(f.C.metrics().windowRect.width,1280/7);assert.equal(f.C.metrics().systemInsets.top,137/7);
  Object.assign(f.displayInfo,{densityPixels:3.5,scaledDensity:3.5});const replacement=f.windowPort();await f.C.install(replacement);await flush();assert.equal(f.C.metrics().systemFontScale,1,'replacement clears prior configuration fact');
  f.C.refreshConfiguration({fontSizeScale:2.4},w);assert.equal(f.C.metrics().systemFontScale,1,'old installed window cannot update successor');
  f.displayInfo.scaledDensity=7;f.C.refreshConfiguration();assert.equal(f.C.metrics().systemFontScale,2,'display ratio remains fallback only when configuration fact missing');
  f.C.refreshConfiguration({fontSizeScale:1.45},replacement);f.C.refreshConfiguration();assert.equal(f.C.metrics().systemFontScale,1.45,'no-argument density refresh retains valid configuration fact');
  f.C.detach();f.displayInfo.scaledDensity=3.5;await f.C.install(f.windowPort());assert.equal(f.C.metrics().systemFontScale,1,'detach clears config ownership');
  let release;const slow=f.windowPort();slow.setWindowLayoutFullScreen=()=>new Promise(r=>{release=r;});const pending=f.C.install(slow,{fontSizeScale:1.45});f.C.refreshConfiguration({fontSizeScale:1.6},slow);release();assert.equal(await pending,true);assert.equal(f.C.metrics().systemFontScale,1.6,'an in-flight install must not replay its old initial configuration');
  let releaseOld;const old=f.windowPort();old.setWindowLayoutFullScreen=()=>new Promise(r=>{releaseOld=r;});const outdated=f.C.install(old,{fontSizeScale:1.45});const current=f.windowPort();await f.C.install(current,{fontSizeScale:3.2});releaseOld();assert.equal(await outdated,false);assert.equal(f.C.metrics().systemFontScale,3.2);assert.equal(old.events.size,0,'late install never binds old listeners');
 }finally{f.cleanup();}
}
async function entryConsumer(){
 const calls=[],themes=[];let closed=0;
 class Startup{constructor(admission,handlers){this.admission=admission;this.handlers=handlers;}start(){}close(){closed++;}}
 const Coordinator={install:(...args)=>{calls.push(['install',...args]);return Promise.resolve(true);},refreshConfiguration:(...args)=>calls.push(['configuration',...args]),detach:()=>calls.push(['detach'])};
 const Entry=selectedProductionMethods(new URL('entryability/EntryAbility.ets',base),'EntryAbility',['onWindowStageCreate','onConfigurationUpdate','onWindowStageDestroy'],{ReaderWindowCoordinator:Coordinator,ReaderStartupTrace:{current:()=>undefined,measure:(_name,action)=>action()},ReaderStartupContentOwner:Startup,DOMAIN:0x5244,hilog:{error(){},warn(){}},ConfigurationConstant:{ColorMode:{COLOR_MODE_DARK:1,COLOR_MODE_LIGHT:0}},ReaderThemeHost:{systemChanged:value=>{themes.push(value);return Promise.resolve();}}});
 const owner=Object.assign(new Entry(),{context:{config:{fontSizeScale:1.45},terminateSelf:async()=>{}},windowStageGeneration:0,recoveryReady:Promise.resolve(),shelfFontsReady:Promise.resolve()});const win={},stage={getMainWindowSync:()=>win,loadContent(){assert.fail('finite startup port must not mount App');}};
 owner.onWindowStageCreate(stage);await flush();assert.deepEqual(calls[0],['install',win,owner.context.config]);
 const update={fontSizeScale:1.6,colorMode:1};owner.onConfigurationUpdate(update);await flush();assert.deepEqual(calls.at(-1),['configuration',update,win]);assert.deepEqual(themes,['night']);
 owner.onWindowStageDestroy();const count=calls.length;owner.onConfigurationUpdate({fontSizeScale:2,colorMode:0});await flush();assert.equal(calls.length,count,'retired stage publishes no font update');assert.deepEqual(themes,['night','day'],'existing system-theme handling remains active');assert.equal(closed,1);
 owner.activeWindowStage={getMainWindowSync(){throw Error('retired native window');}};owner.onConfigurationUpdate({fontSizeScale:2,colorMode:1});await flush();assert.equal(calls.length,count);assert.deepEqual(themes,['night','day','night']);
}
async function fixtureIsolation(){
 const prior=globalThis.AppStorage,a=await createWindowCoordinatorFixture();let b;
 try{
  b=await createWindowCoordinatorFixture();assert.equal(globalThis.AppStorage,prior,'fixture creation must not replace the process storage port');
  const aw=a.windowPort(),bw=b.windowPort();await a.C.install(aw,{fontSizeScale:1.3});await flush();
  assert.ok(a.appWrites.length>0);assert.equal(b.appWrites.length,0,'first fixture cannot write successor fixture storage');
  const aWrites=a.appWrites.length;await b.C.install(bw,{fontSizeScale:1.6});await flush();assert.equal(a.appWrites.length,aWrites);
  const bWrites=b.appWrites.length;a.C.refreshConfiguration({fontSizeScale:2},aw);await flush();
  assert.equal(a.C.metrics().systemFontScale,2);assert.equal(b.C.metrics().systemFontScale,1.6);assert.equal(b.appWrites.length,bWrites,'configuration write remains with its original module/port');
 }finally{b?.cleanup();a.cleanup();assert.equal(globalThis.AppStorage,prior,'fixture cleanup leaves the original process port intact');}
}
function nativeContext(){
 const logs=[],snapshot={systemFontScale:1.45};const Fixture=selectedProductionMethods(new URL('pages/ReaderPageStructureVerification.ets',base),'ReaderPageStructureVerification',['record','observeVerify'],{ReaderWindowCoordinator:{metrics:()=>snapshot,refreshConfiguration(){assert.fail('observation cannot inject configuration');}},hilog:{info:(...args)=>logs.push(JSON.parse(args.at(-1)))}});
 function observe(overrides={},throws=false){const owner=Object.assign(new Fixture(),{scene:'default',filters:defaultSourceManagementFilters(),presentation:1,requestedWidth:366,actualWidth:365.714,actualHeight:809.143,intentCount:0,appContentTopInset:()=>39,getUIContext:()=>{if(throws)throw Error('unavailable native context');return {isFollowingSystemFontScale:()=>true,getMaxFontScale:()=>3.2,vp2px:()=>3.5,fp2px:()=>5.075,...overrides};}});owner.record('test-observation');return logs.at(-1);}
 let row=observe();assert.equal(row.nativeFontObservationStatus,'ready');assert.equal(row.nativeFontFollowing,true);assert.equal(row.nativeFontMaxScale,3.2);assert.equal(row.nativeFontScaleVp,1.45);assert.equal(snapshot.systemFontScale,1.45);
 row=observe({isFollowingSystemFontScale:()=>false,fp2px:()=>3.5});assert.equal(row.nativeFontObservationStatus,'ready');assert.equal(row.nativeFontFollowing,false,'observe false truthfully; do not manufacture followSystem');assert.equal(row.nativeFontScaleVp,1);
 const invalid=[{isFollowingSystemFontScale:()=>undefined},{getMaxFontScale:()=>0},{getMaxFontScale:()=>Infinity},{vp2px:()=>0},{vp2px:()=>NaN},{fp2px:()=>-1},{fp2px:()=>Infinity},{vp2px:()=>1e-300,fp2px:()=>1e300},{vp2px:()=>1e300,fp2px:()=>1e-300}];
 for(const sample of invalid){row=observe(sample);assert.equal(row.nativeFontObservationStatus,'unavailable');assert.equal(row.nativeFontScaleVp,undefined);assert.equal(row.nativeFontMaxScale,undefined);assert.equal(row.nativeFontFollowing,undefined);}
 assert.equal(observe({},true).nativeFontObservationStatus,'unavailable');assert.equal(snapshot.systemFontScale,1.45,'invalid native ports never overwrite Coordinator facts');
 const app=JSON.parse(readFileSync(new URL('../AppScope/app.json5',import.meta.url),'utf8')),profile=JSON.parse(readFileSync(new URL('../AppScope/resources/base/profile/configuration.json',import.meta.url),'utf8'));
 assert.equal(app.app.configuration,'$profile:configuration');assert.deepEqual(profile,{configuration:{fontSizeScale:'followSystem'}},'declare followSystem only; no fabricated max scale override');
}
for(const id of selected){await({configuration,'entry-consumer':entryConsumer,'native-context':nativeContext,'fixture-isolation':fixtureIsolation}[id]());recordContractCasePass(id);}

}

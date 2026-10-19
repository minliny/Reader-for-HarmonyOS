import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import * as state from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
import { resolveReaderReadingLayout, READER_PAGE_CHROME_TOP_ROW_PADDING_VP } from '../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';
import { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { measureReaderPageChromeText, readerPageChromeTopTextStyle } from './lib/reader-page-chrome-measurement-probe.mjs';
import { READER_PAGE_CHROME_BOOKMARK_SIZE } from '../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const settle = async () => { for (let i=0;i<10;i++) await new Promise(resolve => setImmediate(resolve)); };
const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const gatewaySource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderSettingsGateway.ts',import.meta.url),'utf8');
const ts=createRequire(import.meta.url)((resolveEtsLoaderRoot())+'/node_modules/typescript');
const gatewayBody=gatewaySource.replace(/^import[\s\S]*?;\n/gm,'');
const emitted=ts.transpileModule(gatewayBody,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.deepEqual(emitted.diagnostics,[],'whole actual ReaderSettings Gateway compiled with SDK TypeScript');
const facts = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,390,844),new ReaderRectVp(0,0,390,844),
  new ReaderInsetsVp(0,48),new ReaderInsetsVp(0,32),undefined,undefined,undefined,3,1,1,true,48);
const Owner = productionMotionMethods(file, ['commitReaderWindowSettings', 'readingLayout', 'windowMetricsLayoutKey',
  'bookmarkFeedbackTopBoundary',
  'reflowAfterWindowGeometryChange', 'onWindowMetricsRevisionChanged','captureReaderSettingsAdmission',
  'notifyReaderSettingsSavePending','retryPendingReaderSettings','retryReaderPreferenceNotice','isSessionActive'], {
  resolveReaderReadingLayout, READER_PAGE_CHROME_TOP_ROW_PADDING_VP, READER_PAGE_CHROME_BOOKMARK_SIZE,
  ReaderWindowCoordinator: { metrics: () => facts },
  measureReaderPageChromeText, readerPageChromeTopTextStyle,
});
async function fixture(extended=false, controls=false) {
  const policies=[], writes=[], measurements=[], failures=[], cache=new Map(),durable=new Map();
  const initial=state.setReaderSettingsToggle(state.createDefaultReaderSettingsSnapshot(),'extendIntoCutout',extended);
  assert.equal(initial.hideStatusBar,false,'cutout changes retain the current default-visible status preference');
  const runtime={getUIAbilityContext:()=>({})};let active=runtime,flushGate,readGate,flushFailure,windowGate,windowRefusal=false;
  const Runtime=runtimeOwnerIdentityProbe(()=>active);
  const store={async get(key,fallback){if(readGate){const g=readGate;readGate=undefined;await g.promise;}return cache.get(key)??fallback;},
    async put(key,value){writes.push(JSON.parse(value).extendIntoCutout);cache.set(key,value);},
    async flush(){if(flushGate){const g=flushGate;flushGate=undefined;await g.promise;}if(flushFailure==='before'){flushFailure=undefined;throw Error('flush before durable');}
      for(const[k,v]of cache)durable.set(k,v);if(flushFailure==='after'){flushFailure=undefined;throw Error('durable flush lost ACK');}}};
  const exports={};new Function('exports',...Object.keys(state),'ReaderRuntimeOwner','ReaderThemeHost','preferences',emitted.outputText)(exports,...Object.values(state),Runtime,
    {prepareUserChange:async()=>{}},{getPreferences:async()=>store});
  const gateway=new exports.ReaderSettingsGateway(runtime);await gateway.update(initial);writes.length=0;
  const owner=Object.assign(new Owner(), {
    mounted:true,exitRequested:false,lifecycleToken:1,sourceId:'local',bookId:'book',readerSettingsMutationGeneration:0,
    readerSettingsRecovery:{message:'',visible:false,canRetry:false,generation:0},
    readerSettingsSnapshot:initial,readerSettingsLoaded:true,
    bookTitle:'终宋',pageChromeClockText:'12:30',
    getUIContext:()=>({px2vp:n=>n/3,fp2px:n=>n*3,px2fp:n=>n/3,
      getHostContext:()=>({resourceManager:{getNumber:()=>48}}),
      getMeasureUtils:()=>({measureTextSize:options=>({width:options.textContent.length*24,height:60})})}),
    effectiveViewportWidth:()=>390,effectiveViewportHeight:()=>844,isTablet:false,
    visiblePage:{startScalar:173,endScalar:301},phase:'ready',measurementCompleting:false,
    controlsPresentedForWindow:()=>controls,isReaderIdentityCurrent:()=>Runtime.isCurrent(runtime),
    configureReaderScreenAwakeLease(){},applyReaderSystemEventPolicy(){},applyWindowChrome(){},
    applyReaderWindowPolicy:async snapshot=>{policies.push(snapshot.extendIntoCutout);if(windowGate){const g=windowGate;windowGate=undefined;await g.promise;}if(windowRefusal){windowRefusal=false;throw Error('native window policy refused');}},
    readerSettingsGateway:gateway,
    pageTurnInputPhase:()=> 'idle',invalidatePageTurnRuntime(){},paginationIndex:{invalidateBook(){}},resetPaginationDraft(){},
    hasCurrentMaterializedChapter:()=>true,
    beginMeasurement(){measurements.push({top:this.readingLayout().contentTop,anchor:this.visiblePage.startScalar});},
    showReaderSettingsFailure:(message,error)=>failures.push({message,error}),
  });
  owner.lastWindowMetricsLayoutKey=owner.windowMetricsLayoutKey();
  return {owner,gateway,policies,writes,measurements,failures,initial,cache,durable,
    change:()=>state.setReaderSettingsToggle(owner.readerSettingsSnapshot,'extendIntoCutout',!extended),
    holdFlush:()=>{flushGate=deferred();return flushGate;},holdRead:()=>{readGate=deferred();return readGate;},
    holdWindow:()=>{windowGate=deferred();return windowGate;},failFlush:when=>{flushFailure=when;},refuseWindow:()=>{windowRefusal=true;},
    unmount:()=>{owner.mounted=false;},retireRuntime:()=>{active=undefined;}};
}
for(const extended of [false,true])for(const controls of [false,true])for(const failure of ['before','after']){
  const f=await fixture(extended,controls),oldTop=f.owner.readingLayout().contentTop,target=f.change(),gate=f.holdFlush();f.failFlush(failure);
  f.owner.commitReaderWindowSettings(target);await settle();
  assert.deepEqual(f.writes,[!extended]);assert.equal(f.measurements.length,1);
  assert.equal(f.owner.readerSettingsRecovery.visible,false,
    'an ordinary in-flight save is silent before an uncertain result exists');
  assert.equal(f.owner.readerSettingsRecovery.canRetry,false,'no retry action is admitted before the original flush settles');
  assert.equal(f.measurements[0].top,oldTop,'cutout preference cannot create a second status-height information lane');assert.equal(f.measurements[0].anchor,173);
  gate.resolve();await settle();
  assert.deepEqual(f.owner.readerSettingsSnapshot,target,'native policy success is retained when Preferences confirmation is missing');
  assert.deepEqual(f.policies,[!extended]);assert.equal(f.measurements.length,1,'unknown durable result cannot reflow an old policy');
  assert.deepEqual(f.failures,[],'unknown persistence uses the retained settings notice, not the window-refusal Toast');
  assert.equal(f.owner.readerSettingsRecovery.visible,true);assert.equal(f.owner.readerSettingsRecovery.canRetry,true);
  assert.match(f.owner.readerSettingsRecovery.message,/保存尚未确认/);assert.equal(f.gateway.writeFacts().pendingReconciliation,true);
  assert.deepEqual(f.gateway.writeFacts().saved,f.initial);assert.equal(JSON.parse(f.cache.get('snapshot')).extendIntoCutout,!extended,'cached get alone cannot qualify durable save');
  assert.equal(JSON.parse(f.durable.get('snapshot')).extendIntoCutout,failure==='after'?!extended:extended);
  f.owner.onWindowMetricsRevisionChanged();assert.equal(f.measurements.length,1,'equal accepted geometry must not remeasure twice');
  const retryGeneration=f.owner.readerSettingsRecovery.generation;
  f.owner.retryReaderPreferenceNotice('settings',retryGeneration);
  f.owner.retryReaderPreferenceNotice('settings',retryGeneration);await settle();
  assert.deepEqual(f.writes,[!extended,!extended],'finite retry writes the same current snapshot, never previous compensation');
  assert.equal(f.gateway.writeFacts().pendingReconciliation,false);assert.deepEqual(f.gateway.writeFacts().saved,target);
  assert.equal(f.owner.readerSettingsRecovery.visible,false);assert.equal(f.owner.readerSettingsRecovery.canRetry,false,
    'the original confirmed write facts settle the persistent notice');
  f.owner.retryReaderPreferenceNotice('settings',retryGeneration);await settle();
  assert.deepEqual(f.writes,[!extended,!extended],'a retired retry callback cannot replay the confirmed write');
  assert.equal(f.measurements.length,1);assert.equal(f.owner.visiblePage.startScalar,173);
}
for(const extended of [false,true])for(const controls of [false,true]){
  const f=await fixture(extended,controls),oldTop=f.owner.readingLayout().contentTop,gate=f.holdWindow();
  f.owner.commitReaderWindowSettings(f.change());await settle();f.owner.onWindowMetricsRevisionChanged();
  assert.equal(f.measurements.length,1);assert.equal(f.measurements[0].top,oldTop);
  gate.reject(Error('native window policy refused after metric callback'));await settle();
  assert.deepEqual(f.owner.readerSettingsSnapshot,f.initial);assert.deepEqual(f.writes,[],'actual native refusal precedes the durable setter');
  assert.deepEqual(f.policies,[!extended,extended]);assert.deepEqual(f.measurements[1],{top:oldTop,anchor:173},'native failure reflows restored settings even with unchanged metrics');
  assert.equal(f.failures.length,1);assert.match(f.failures[0].message,/窗口设置未能应用/);assert.equal(f.gateway.writeFacts().pendingReconciliation,false);
  f.owner.onWindowMetricsRevisionChanged();assert.equal(f.measurements.length,2,'restored same geometry is not measured twice');
}
for(const extended of [false,true])for(const controls of [false,true]){
 const f=await fixture(extended,controls),oldTop=f.owner.readingLayout().contentTop;f.refuseWindow();f.owner.commitReaderWindowSettings(f.change());await settle();
 assert.deepEqual(f.owner.readerSettingsSnapshot,f.initial);assert.deepEqual(f.writes,[]);assert.deepEqual(f.measurements,[],'immediate native refusal has no admitted new geometry to invalidate');
 assert.equal(f.owner.readingLayout().contentTop,oldTop);assert.equal(f.owner.visiblePage.startScalar,173);
}
for(const stale of ['newer','unmounted','book','lifecycle','runtime']){
  const f=await fixture(),gate=f.holdRead();f.owner.commitReaderWindowSettings(f.change());await settle();
  if(stale==='newer')f.owner.commitReaderWindowSettings(f.initial);
  if(stale==='unmounted')f.unmount();if(stale==='book')f.owner.bookId='new';if(stale==='lifecycle')f.owner.lifecycleToken++;if(stale==='runtime')f.retireRuntime();
  await settle();const before=f.measurements.length;gate.resolve();await settle();
  assert.equal(f.measurements.length,before);assert.deepEqual(f.failures,[],'last-admission/old failures cannot restore another identity or lifecycle');
  assert.deepEqual(f.writes,stale==='newer'?[false]:[],'retired queued choice never reaches first Preferences put');
  assert.equal(f.owner.readerSettingsSnapshot.extendIntoCutout,stale!=='newer');
}
for(const stale of ['newer','unmounted']){
  const f=await fixture(),gate=f.holdFlush();f.failFlush('after');f.owner.commitReaderWindowSettings(f.change());await settle();
  if(stale==='newer')f.owner.commitReaderWindowSettings(f.initial);else f.unmount();
  await settle();const before=f.measurements.length;gate.resolve();await settle();
  assert.equal(f.measurements.length,before);assert.deepEqual(f.failures,[],'late accepted write failure stays silent after newer choice or unmount');
  assert.equal(f.owner.readerSettingsSnapshot.extendIntoCutout,stale==='unmounted');
  assert.deepEqual(f.writes,stale==='newer'?[true,false]:[true]);
}
console.log('PASS actual cutout settings/reflow + SDK whole Gateway: both cutout directions/control states, unchanged native geometry, native refusal rollback vs accepted/unknown preservation, same-snapshot retry, stable reading anchor, exact identity/lifecycle/runtime last admission and late writes.');

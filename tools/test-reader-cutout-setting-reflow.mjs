import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { resolveReaderReadingLayout } from '../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';
import { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { measureReaderPageChromeText, readerPageChromeTopTextStyle } from './lib/reader-page-chrome-measurement-probe.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const settle = async () => { for (let i=0;i<8;i++) await new Promise(resolve => setImmediate(resolve)); };
const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const facts = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,390,844),new ReaderRectVp(0,0,390,844),
  new ReaderInsetsVp(0,48),new ReaderInsetsVp(0,32),undefined,undefined,undefined,3,1,1,true,48);
const Owner = productionMotionMethods(file, ['commitReaderWindowSettings', 'readingLayout', 'windowMetricsLayoutKey',
  'reflowAfterWindowGeometryChange', 'onWindowMetricsRevisionChanged'], {
  resolveReaderReadingLayout, ReaderWindowCoordinator: { metrics: () => facts },
  measureReaderPageChromeText, readerPageChromeTopTextStyle,
});
function fixture(extended=false, controls=false) {
  const policies=[], writes=[], measurements=[], failures=[], pending=[];
  let active=true;
  const owner=Object.assign(new Owner(), {
    mounted:true,lifecycleToken:1,sourceId:'local',bookId:'book',readerSettingsMutationGeneration:0,
    readerSettingsSnapshot:{extendIntoCutout:extended},readerSettingsLoaded:true,
    bookTitle:'终宋',pageChromeClockText:'12:30',
    getUIContext:()=>({px2vp:n=>n/3,fp2px:n=>n*3,px2fp:n=>n/3,
      getHostContext:()=>({resourceManager:{getNumber:()=>48}}),
      getMeasureUtils:()=>({measureTextSize:options=>({width:options.textContent.length*24,height:60})})}),
    effectiveViewportWidth:()=>390,effectiveViewportHeight:()=>844,isTablet:false,
    visiblePage:{startScalar:173,endScalar:301},phase:'ready',measurementCompleting:false,
    controlsPresentedForWindow:()=>controls,isSessionActive:()=>active,
    configureReaderScreenAwakeLease(){},applyReaderSystemEventPolicy(){},applyWindowChrome(){},
    applyReaderWindowPolicy:async snapshot=>{policies.push(snapshot.extendIntoCutout);},
    readerSettingsGateway:{update:snapshot=>{writes.push(snapshot.extendIntoCutout); const gate=deferred();pending.push(gate);return gate.promise;}},
    pageTurnInputPhase:()=> 'idle',invalidatePageTurnRuntime(){},paginationIndex:{invalidateBook(){}},resetPaginationDraft(){},
    hasCurrentMaterializedChapter:()=>true,
    beginMeasurement(){measurements.push({top:this.readingLayout().contentTop,anchor:this.visiblePage.startScalar});},
    showReaderSettingsFailure:(message,error)=>failures.push({message,error}),
  });
  owner.lastWindowMetricsLayoutKey=owner.windowMetricsLayoutKey();
  return {owner,policies,writes,measurements,failures,pending,unmount:()=>{active=false;owner.mounted=false;}};
}
for(const extended of [false,true])for(const controls of [false,true]) {
  const f=fixture(extended,controls),oldTop=f.owner.readingLayout().contentTop;
  f.owner.commitReaderWindowSettings({extendIntoCutout:!extended});await settle();
  assert.deepEqual(f.writes,[!extended]);assert.equal(f.measurements.length,1);
  assert.notEqual(f.measurements[0].top,oldTop,'the cutout change reaches body measurement without a native resize event');
  assert.equal(f.measurements[0].anchor,173);
  f.pending[0].reject(Error('settings store unavailable'));await settle();
  assert.equal(f.owner.readerSettingsSnapshot.extendIntoCutout,extended);
  assert.deepEqual(f.policies,[!extended,extended]);
  assert.deepEqual(f.measurements[1],{top:oldTop,anchor:173},'save failure must reflow the restored setting even when native metrics do not change');
  assert.equal(f.failures.length,1);
  f.owner.onWindowMetricsRevisionChanged();assert.equal(f.measurements.length,2,'equal restored geometry must not remeasure twice');
}
for(const stale of ['newer','unmounted']) {
  const f=fixture();f.owner.commitReaderWindowSettings({extendIntoCutout:true});await settle();
  if(stale==='newer'){f.owner.commitReaderWindowSettings({extendIntoCutout:false});await settle();f.pending[1].resolve();await settle();}
  else f.unmount();
  const before=f.measurements.length;
  f.pending[0].reject(Error('old failed write'));await settle();
  assert.equal(f.measurements.length,before);assert.deepEqual(f.failures,[],'old failures cannot restore another settings generation');
  assert.equal(f.owner.readerSettingsSnapshot.extendIntoCutout,stale==='unmounted');
}
console.log('PASS actual cutout settings/reflow: control open/closed, both directions, unchanged native geometry, save rollback, stable reading anchor and stale lifecycle isolation');

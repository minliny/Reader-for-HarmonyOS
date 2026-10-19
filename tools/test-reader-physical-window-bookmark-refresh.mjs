import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "window-metric-fallback": {
    "description": "Actual Window API fallback and status measurement key isolation; platform APIs are controlled ports",
    "resources": []
  },
  "measured-safe-geometry": {
    "description": "Actual pure measured status/cutout geometry across scale; no physical pixels",
    "resources": []
  },
  "reading-budget-cache": {
    "description": "Actual LRE settings-sensitive status/bookmark reservation cache; fake measurements",
    "resources": []
  },
  "status-paper-sdk": {
    "description": "Actual SDK underlay visibility/metric payload for active/control/hide preference combinations",
    "resources": []
  },
  "bookmark-confirmed-owner": {
    "description": "Actual mutation admission/ACK failure and retained SDK filled marker; fake native callback",
    "resources": []
  },
  "force-refresh-menu": {
    "description": "Actual Host force refresh bypass and input ownership, SDK menu action admission",
    "resources": []
  },
  "durable-bookmark-ack": {
    "description": "Actual existing Core + bookmark-only Directory/Gateway ACK and failure readback; requires prebuilt attributable CLI, never builds",
    "resources": [
      
    ]
  },
  "window-listener-lifecycle": {
    "description": "Actual window/display register, dedup, rotation invalidation, detach and late callback; fake platform ports",
    "resources": []
  }
};

async function case_window_metric_fallback() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { actionMenuProbe } = await import('./lib/reader-action-menu-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { performance } = await import('node:perf_hooks');
const { setInterval : intervals, setTimeout : delay } = await import('node:timers/promises');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { measureReaderPageChromeText, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderRectVp:R,ReaderDisplayCornerVp:C,ReaderWindowMetricsSnapshot:M}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const readingGeometry=await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const {resolveReaderReadingLayout,resolveReaderControlLayout}=readingGeometry;
const {resolveReaderPageChromeLayout,ReaderPageChromeMeasurements,READER_PAGE_CHROME_BOOKMARK_SIZE}=await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
const file=n=>new URL('../entry/src/main/ets/'+n,import.meta.url);
const lre=file('features/reading/LocalReadingExperience.ets');
const panel=file('features/reading/ReaderControlPanel.ets');
const owner={};
const W=productionMotionMethods(file('app/ReaderWindowCoordinator.ts'),['statusBarRectVp','topAvoidRectVp','topCornersVp','rectVp'],
 {ReaderWindowCoordinator:owner,ReaderRectVp:R,ReaderDisplayCornerVp:C,window:{AvoidAreaType:{TYPE_SYSTEM:0,TYPE_CUTOUT:1}},display:{CornerType:{TOP_LEFT:0,TOP_RIGHT:1}}});
Object.setPrototypeOf(owner,W);
const visible={left:6,top:3,width:1170,height:144};
owner.mainWindow={getWindowAvoidArea:()=>({topRect:visible})};
assert.deepEqual(owner.statusBarRectVp(3),new R(2,1,390,48),'API21 uses public measured rectangle');
owner.mainWindow.getWindowAvoidAreaIgnoringVisibility=()=>{throw Error('801 unsupported');};
assert.deepEqual(owner.statusBarRectVp(3),new R(2,1,390,48),'API22 unavailable capability fallback');
owner.mainWindow.getWindowAvoidAreaIgnoringVisibility=()=>({topRect:{left:0,top:0,width:1170,height:150}});
assert.equal(owner.statusBarRectVp(3).height,50,'API22 measures hidden bar without toggling its visibility');
owner.mainWindow=undefined;assert.equal(owner.statusBarRectVp(3).height,0);
assert.deepEqual(owner.topCornersVp({},new R(),3),[new C(),new C()],'API23 absence does not throw');
assert.deepEqual(owner.topCornersVp({getRoundedCorner(){throw Error('801');}},new R(),3),[new C(),new C()]);
const corners=owner.topCornersVp({x:60,y:30,getRoundedCorner:()=>[
 {type:0,position:{x:150,y:150},radius:150},{type:1,position:{x:1020,y:150},radius:150}]},new R(20,10),3);
assert.deepEqual(corners,[new C(50,50,50),new C(340,50,50)]);
const measurement=new ReaderStatusBarMeasurement(),rect=new R(3,2,380,48);
assert.deepEqual(measurement.observeRect('p',false,rect,false),rect);
assert.deepEqual(measurement.observeRect('p',false,new R(),true),rect);
assert.equal(measurement.observeRect('other',false,new R(),true).height,0);
assert.equal(measurement.observeRect('l',true,new R(),true).height,0);
assert.deepEqual(measurement.observeRect('p',false,new R(),true),rect);
assert.equal(measurement.observeRect('p',false,new R(),false).height,0);

}

async function case_measured_safe_geometry() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { actionMenuProbe } = await import('./lib/reader-action-menu-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { performance } = await import('node:perf_hooks');
const { setInterval : intervals, setTimeout : delay } = await import('node:timers/promises');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { measureReaderPageChromeText, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderRectVp:R,ReaderDisplayCornerVp:C,ReaderWindowMetricsSnapshot:M}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const readingGeometry=await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const {resolveReaderReadingLayout,resolveReaderControlLayout}=readingGeometry;
const {resolveReaderPageChromeLayout,ReaderPageChromeMeasurements,READER_PAGE_CHROME_BOOKMARK_SIZE}=await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
const file=n=>new URL('../entry/src/main/ets/'+n,import.meta.url);
const lre=file('features/reading/LocalReadingExperience.ets');
const panel=file('features/reading/ReaderControlPanel.ets');
const owner={};
const W=productionMotionMethods(file('app/ReaderWindowCoordinator.ts'),['statusBarRectVp','topAvoidRectVp','topCornersVp','rectVp'],
 {ReaderWindowCoordinator:owner,ReaderRectVp:R,ReaderDisplayCornerVp:C,window:{AvoidAreaType:{TYPE_SYSTEM:0,TYPE_CUTOUT:1}},display:{CornerType:{TOP_LEFT:0,TOP_RIGHT:1}}});
Object.setPrototypeOf(owner,W);
const visible={left:6,top:3,width:1170,height:144};
owner.mainWindow={getWindowAvoidArea:()=>({topRect:visible})};
assert.deepEqual(owner.statusBarRectVp(3),new R(2,1,390,48),'API21 uses public measured rectangle');
owner.mainWindow.getWindowAvoidAreaIgnoringVisibility=()=>{throw Error('801 unsupported');};
assert.deepEqual(owner.statusBarRectVp(3),new R(2,1,390,48),'API22 unavailable capability fallback');
owner.mainWindow.getWindowAvoidAreaIgnoringVisibility=()=>({topRect:{left:0,top:0,width:1170,height:150}});
assert.equal(owner.statusBarRectVp(3).height,50,'API22 measures hidden bar without toggling its visibility');
owner.mainWindow=undefined;assert.equal(owner.statusBarRectVp(3).height,0);
assert.deepEqual(owner.topCornersVp({},new R(),3),[new C(),new C()],'API23 absence does not throw');
assert.deepEqual(owner.topCornersVp({getRoundedCorner(){throw Error('801');}},new R(),3),[new C(),new C()]);
const corners=owner.topCornersVp({x:60,y:30,getRoundedCorner:()=>[
 {type:0,position:{x:150,y:150},radius:150},{type:1,position:{x:1020,y:150},radius:150}]},new R(20,10),3);
assert.deepEqual(corners,[new C(50,50,50),new C(340,50,50)]);
const measurement=new ReaderStatusBarMeasurement(),rect=new R(3,2,380,48);
assert.deepEqual(measurement.observeRect('p',false,rect,false),rect);
assert.deepEqual(measurement.observeRect('p',false,new R(),true),rect);
assert.equal(measurement.observeRect('other',false,new R(),true).height,0);
assert.equal(measurement.observeRect('l',true,new R(),true).height,0);
assert.deepEqual(measurement.observeRect('p',false,new R(),true),rect);
assert.equal(measurement.observeRect('p',false,new R(),false).height,0);
let metrics=new M();Object.assign(metrics,{ready:true,windowRect:new R(0,0,390,844),statusBarRect:new R(0,0,390,48),
 statusBarHeight:48,statusBarCutoutRect:new R(154,0,82,32),topLeftCorner:corners[0],topRightCorner:corners[1]});
for(const extended of [false,true])for(const scale of [1,1.5]){
 const reading=resolveReaderReadingLayout(390,844,false,metrics,extended);
 const text=new ReaderPageChromeMeasurements(200,14.4*scale,36,14.4*scale);
 const chrome=resolveReaderPageChromeLayout(reading,text);
 const lineHeight=14.4*scale,available=Math.max(0,48-lineHeight);
 assert.equal((chrome.topStartY+chrome.topEndY)/2,reading.pageChromeVisualSafeTop+
  Math.min(available,available/2+lineHeight*0.2),'top labels follow the measured proportional optical track');
 assert.ok(chrome.topStartY+lineHeight<=48 && chrome.topEndY+lineHeight<=48,
  'the complete proportional line remains within the retained status region');
 assert.ok(chrome.topStartX>=24 && chrome.topStartX<100);
 assert.ok(chrome.topEndX+Math.min(36,chrome.topEndMaxWidth)<=366);
 if(extended){assert.ok(chrome.topStartX+chrome.topStartMaxWidth<154);assert.ok(chrome.topEndX>236);}
 const control=resolveReaderControlLayout(390,844,false,metrics);assert.ok(control.topBarTop>=48);
}

}

async function case_reading_budget_cache() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { actionMenuProbe } = await import('./lib/reader-action-menu-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { performance } = await import('node:perf_hooks');
const { setInterval : intervals, setTimeout : delay } = await import('node:timers/promises');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { measureReaderPageChromeText, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderRectVp:R,ReaderDisplayCornerVp:C,ReaderWindowMetricsSnapshot:M}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const readingGeometry=await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const {resolveReaderReadingLayout,resolveReaderControlLayout}=readingGeometry;
const {resolveReaderPageChromeLayout,ReaderPageChromeMeasurements,READER_PAGE_CHROME_BOOKMARK_SIZE}=await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
const file=n=>new URL('../entry/src/main/ets/'+n,import.meta.url);
const lre=file('features/reading/LocalReadingExperience.ets');
const panel=file('features/reading/ReaderControlPanel.ets');
const owner={};
const W=productionMotionMethods(file('app/ReaderWindowCoordinator.ts'),['statusBarRectVp','topAvoidRectVp','topCornersVp','rectVp'],
 {ReaderWindowCoordinator:owner,ReaderRectVp:R,ReaderDisplayCornerVp:C,window:{AvoidAreaType:{TYPE_SYSTEM:0,TYPE_CUTOUT:1}},display:{CornerType:{TOP_LEFT:0,TOP_RIGHT:1}}});
Object.setPrototypeOf(owner,W);
const visible={left:6,top:3,width:1170,height:144};
owner.mainWindow={getWindowAvoidArea:()=>({topRect:visible})};
assert.deepEqual(owner.statusBarRectVp(3),new R(2,1,390,48),'API21 uses public measured rectangle');
owner.mainWindow.getWindowAvoidAreaIgnoringVisibility=()=>{throw Error('801 unsupported');};
assert.deepEqual(owner.statusBarRectVp(3),new R(2,1,390,48),'API22 unavailable capability fallback');
owner.mainWindow.getWindowAvoidAreaIgnoringVisibility=()=>({topRect:{left:0,top:0,width:1170,height:150}});
assert.equal(owner.statusBarRectVp(3).height,50,'API22 measures hidden bar without toggling its visibility');
owner.mainWindow=undefined;assert.equal(owner.statusBarRectVp(3).height,0);
assert.deepEqual(owner.topCornersVp({},new R(),3),[new C(),new C()],'API23 absence does not throw');
assert.deepEqual(owner.topCornersVp({getRoundedCorner(){throw Error('801');}},new R(),3),[new C(),new C()]);
const corners=owner.topCornersVp({x:60,y:30,getRoundedCorner:()=>[
 {type:0,position:{x:150,y:150},radius:150},{type:1,position:{x:1020,y:150},radius:150}]},new R(20,10),3);
assert.deepEqual(corners,[new C(50,50,50),new C(340,50,50)]);
const measurement=new ReaderStatusBarMeasurement(),rect=new R(3,2,380,48);
assert.deepEqual(measurement.observeRect('p',false,rect,false),rect);
assert.deepEqual(measurement.observeRect('p',false,new R(),true),rect);
assert.equal(measurement.observeRect('other',false,new R(),true).height,0);
assert.equal(measurement.observeRect('l',true,new R(),true).height,0);
assert.deepEqual(measurement.observeRect('p',false,new R(),true),rect);
assert.equal(measurement.observeRect('p',false,new R(),false).height,0);
let metrics=new M();Object.assign(metrics,{ready:true,windowRect:new R(0,0,390,844),statusBarRect:new R(0,0,390,48),
 statusBarHeight:48,statusBarCutoutRect:new R(154,0,82,32),topLeftCorner:corners[0],topRightCorner:corners[1]});
for(const extended of [false,true])for(const scale of [1,1.5]){
 const reading=resolveReaderReadingLayout(390,844,false,metrics,extended);
 const text=new ReaderPageChromeMeasurements(200,14.4*scale,36,14.4*scale);
 const chrome=resolveReaderPageChromeLayout(reading,text);
 const lineHeight=14.4*scale,available=Math.max(0,48-lineHeight);
 assert.equal((chrome.topStartY+chrome.topEndY)/2,reading.pageChromeVisualSafeTop+
  Math.min(available,available/2+lineHeight*0.2),'top labels follow the measured proportional optical track');
 assert.ok(chrome.topStartY+lineHeight<=48 && chrome.topEndY+lineHeight<=48,
  'the complete proportional line remains within the retained status region');
 assert.ok(chrome.topStartX>=24 && chrome.topStartX<100);
 assert.ok(chrome.topEndX+Math.min(36,chrome.topEndMaxWidth)<=366);
 if(extended){assert.ok(chrome.topStartX+chrome.topStartMaxWidth<154);assert.ok(chrome.topEndX>236);}
 const control=resolveReaderControlLayout(390,844,false,metrics);assert.ok(control.topBarTop>=48);
}
const source=readFileSync(lre,'utf8');
// Exercise the production LRE budget, including its settings-sensitive cache.
// Only the platform text resource/measurement and Window metrics are ports.
const Geometry=productionMotionMethods(lre,['readingLayout','effectiveViewportWidth','effectiveViewportHeight','bookmarkFeedbackTopBoundary'],
 {...readingGeometry,measureReaderPageChromeText,readerPageChromeTopTextStyle,READER_PAGE_CHROME_BOOKMARK_SIZE,
 ReaderWindowCoordinator:{metrics:()=>metrics}});
const geometryContext={px2vp:v=>v/3,fp2px:v=>v*3,px2fp:v=>v/3,
 getHostContext:()=>({resourceManager:{getNumber:()=>48}}),
 getMeasureUtils:()=>({measureText:({textContent})=>textContent.length*21.6,
 measureTextSize:({textContent})=>({width:textContent.length*21.6,height:60})})};
function actualReadingGeometry(settings){return Object.assign(new Geometry(),{
 viewportWidth:390,viewportHeight:844,isTablet:false,bookTitle:'Book',pageChromeClockText:'12:30',
 readerSettingsSnapshot:{extendIntoCutout:false,navigationMode:'paged',...settings},getUIContext:()=>geometryContext});}
const geometryOwner=actualReadingGeometry({hideStatusBar:true});
const hiddenGeometry=geometryOwner.readingLayout();
assert.equal(hiddenGeometry.contentTop,resolveReaderReadingLayout(390,844,false,metrics,false).contentTop,
 'explicit immersion preserves the existing measured body budget');
geometryOwner.readerSettingsSnapshot={...geometryOwner.readerSettingsSnapshot,hideStatusBar:false};
const visibleGeometry=geometryOwner.readingLayout();
const bookmarkBoundary=Math.max(0,hiddenGeometry.pageChromeVisualSafeTop+hiddenGeometry.pageChromeTopRegionHeight,
 metrics.statusBarRect.top+metrics.statusBarRect.height,
 metrics.statusBarCutoutRect.top+metrics.statusBarCutoutRect.height);
assert.equal(visibleGeometry.contentTop,Math.max(hiddenGeometry.contentTop,bookmarkBoundary+READER_PAGE_CHROME_BOOKMARK_SIZE),
 'visible status reserves one complete 24vp bookmark below the actual status/cutout boundary');
assert.notEqual(visibleGeometry,hiddenGeometry,'status preference invalidates the production layout cache without a metric revision');
assert.equal(geometryOwner.readingLayout(),visibleGeometry,'unchanged visible geometry still reuses the cache');
assert.equal(actualReadingGeometry({}).readingLayout().contentTop,visibleGeometry.contentTop,
 'an unspecified legacy preference uses the default-visible bookmark budget');
geometryOwner.readerSettingsSnapshot={...geometryOwner.readerSettingsSnapshot,hideStatusBar:true};
assert.equal(geometryOwner.readingLayout().contentTop,hiddenGeometry.contentTop,
 'returning to explicit immersion restores the original body budget');
geometryOwner.readerSettingsSnapshot={...geometryOwner.readerSettingsSnapshot,hideStatusBar:false,navigationMode:'continuous'};
const continuousGeometry=geometryOwner.readingLayout();
assert.equal(continuousGeometry.contentTop,hiddenGeometry.contentTop,
 'normal continuous mode retains its original top budget without the paged bookmark reservation');
geometryOwner.readerSettingsSnapshot={...geometryOwner.readerSettingsSnapshot,navigationMode:'paged'};
const pagedGeometry=geometryOwner.readingLayout();
assert.notEqual(pagedGeometry,continuousGeometry,'navigation mode invalidates the production cache without a metric revision');
assert.equal(pagedGeometry.contentTop,visibleGeometry.contentTop,'returning to paged mode restores the complete bookmark reservation');

}

async function case_status_paper_sdk() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { actionMenuProbe } = await import('./lib/reader-action-menu-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { performance } = await import('node:perf_hooks');
const { setInterval : intervals, setTimeout : delay } = await import('node:timers/promises');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { measureReaderPageChromeText, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderRectVp:R,ReaderDisplayCornerVp:C,ReaderWindowMetricsSnapshot:M}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const readingGeometry=await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const {resolveReaderReadingLayout,resolveReaderControlLayout}=readingGeometry;
const {resolveReaderPageChromeLayout,ReaderPageChromeMeasurements,READER_PAGE_CHROME_BOOKMARK_SIZE}=await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
const file=n=>new URL('../entry/src/main/ets/'+n,import.meta.url);
const lre=file('features/reading/LocalReadingExperience.ets');
const panel=file('features/reading/ReaderControlPanel.ets');
const owner={};
const W=productionMotionMethods(file('app/ReaderWindowCoordinator.ts'),['statusBarRectVp','topAvoidRectVp','topCornersVp','rectVp'],
 {ReaderWindowCoordinator:owner,ReaderRectVp:R,ReaderDisplayCornerVp:C,window:{AvoidAreaType:{TYPE_SYSTEM:0,TYPE_CUTOUT:1}},display:{CornerType:{TOP_LEFT:0,TOP_RIGHT:1}}});
Object.setPrototypeOf(owner,W);
const visible={left:6,top:3,width:1170,height:144};
owner.mainWindow={getWindowAvoidArea:()=>({topRect:visible})};
assert.deepEqual(owner.statusBarRectVp(3),new R(2,1,390,48),'API21 uses public measured rectangle');
owner.mainWindow.getWindowAvoidAreaIgnoringVisibility=()=>{throw Error('801 unsupported');};
assert.deepEqual(owner.statusBarRectVp(3),new R(2,1,390,48),'API22 unavailable capability fallback');
owner.mainWindow.getWindowAvoidAreaIgnoringVisibility=()=>({topRect:{left:0,top:0,width:1170,height:150}});
assert.equal(owner.statusBarRectVp(3).height,50,'API22 measures hidden bar without toggling its visibility');
owner.mainWindow=undefined;assert.equal(owner.statusBarRectVp(3).height,0);
assert.deepEqual(owner.topCornersVp({},new R(),3),[new C(),new C()],'API23 absence does not throw');
assert.deepEqual(owner.topCornersVp({getRoundedCorner(){throw Error('801');}},new R(),3),[new C(),new C()]);
const corners=owner.topCornersVp({x:60,y:30,getRoundedCorner:()=>[
 {type:0,position:{x:150,y:150},radius:150},{type:1,position:{x:1020,y:150},radius:150}]},new R(20,10),3);
assert.deepEqual(corners,[new C(50,50,50),new C(340,50,50)]);
const measurement=new ReaderStatusBarMeasurement(),rect=new R(3,2,380,48);
assert.deepEqual(measurement.observeRect('p',false,rect,false),rect);
assert.deepEqual(measurement.observeRect('p',false,new R(),true),rect);
assert.equal(measurement.observeRect('other',false,new R(),true).height,0);
assert.equal(measurement.observeRect('l',true,new R(),true).height,0);
assert.deepEqual(measurement.observeRect('p',false,new R(),true),rect);
assert.equal(measurement.observeRect('p',false,new R(),false).height,0);
let metrics=new M();Object.assign(metrics,{ready:true,windowRect:new R(0,0,390,844),statusBarRect:new R(0,0,390,48),
 statusBarHeight:48,statusBarCutoutRect:new R(154,0,82,32),topLeftCorner:corners[0],topRightCorner:corners[1]});
for(const extended of [false,true])for(const scale of [1,1.5]){
 const reading=resolveReaderReadingLayout(390,844,false,metrics,extended);
 const text=new ReaderPageChromeMeasurements(200,14.4*scale,36,14.4*scale);
 const chrome=resolveReaderPageChromeLayout(reading,text);
 const lineHeight=14.4*scale,available=Math.max(0,48-lineHeight);
 assert.equal((chrome.topStartY+chrome.topEndY)/2,reading.pageChromeVisualSafeTop+
  Math.min(available,available/2+lineHeight*0.2),'top labels follow the measured proportional optical track');
 assert.ok(chrome.topStartY+lineHeight<=48 && chrome.topEndY+lineHeight<=48,
  'the complete proportional line remains within the retained status region');
 assert.ok(chrome.topStartX>=24 && chrome.topStartX<100);
 assert.ok(chrome.topEndX+Math.min(36,chrome.topEndMaxWidth)<=366);
 if(extended){assert.ok(chrome.topStartX+chrome.topStartMaxWidth<154);assert.ok(chrome.topEndX>236);}
 const control=resolveReaderControlLayout(390,844,false,metrics);assert.ok(control.topBarTop>=48);
}
const source=readFileSync(lre,'utf8');
// Exercise the production LRE budget, including its settings-sensitive cache.
// Only the platform text resource/measurement and Window metrics are ports.
const Geometry=productionMotionMethods(lre,['readingLayout','effectiveViewportWidth','effectiveViewportHeight','bookmarkFeedbackTopBoundary'],
 {...readingGeometry,measureReaderPageChromeText,readerPageChromeTopTextStyle,READER_PAGE_CHROME_BOOKMARK_SIZE,
 ReaderWindowCoordinator:{metrics:()=>metrics}});
const geometryContext={px2vp:v=>v/3,fp2px:v=>v*3,px2fp:v=>v/3,
 getHostContext:()=>({resourceManager:{getNumber:()=>48}}),
 getMeasureUtils:()=>({measureText:({textContent})=>textContent.length*21.6,
 measureTextSize:({textContent})=>({width:textContent.length*21.6,height:60})})};
function actualReadingGeometry(settings){return Object.assign(new Geometry(),{
 viewportWidth:390,viewportHeight:844,isTablet:false,bookTitle:'Book',pageChromeClockText:'12:30',
 readerSettingsSnapshot:{extendIntoCutout:false,navigationMode:'paged',...settings},getUIContext:()=>geometryContext});}
const geometryOwner=actualReadingGeometry({hideStatusBar:true});
const hiddenGeometry=geometryOwner.readingLayout();
assert.equal(hiddenGeometry.contentTop,resolveReaderReadingLayout(390,844,false,metrics,false).contentTop,
 'explicit immersion preserves the existing measured body budget');
geometryOwner.readerSettingsSnapshot={...geometryOwner.readerSettingsSnapshot,hideStatusBar:false};
const visibleGeometry=geometryOwner.readingLayout();
const bookmarkBoundary=Math.max(0,hiddenGeometry.pageChromeVisualSafeTop+hiddenGeometry.pageChromeTopRegionHeight,
 metrics.statusBarRect.top+metrics.statusBarRect.height,
 metrics.statusBarCutoutRect.top+metrics.statusBarCutoutRect.height);
assert.equal(visibleGeometry.contentTop,Math.max(hiddenGeometry.contentTop,bookmarkBoundary+READER_PAGE_CHROME_BOOKMARK_SIZE),
 'visible status reserves one complete 24vp bookmark below the actual status/cutout boundary');
assert.notEqual(visibleGeometry,hiddenGeometry,'status preference invalidates the production layout cache without a metric revision');
assert.equal(geometryOwner.readingLayout(),visibleGeometry,'unchanged visible geometry still reuses the cache');
assert.equal(actualReadingGeometry({}).readingLayout().contentTop,visibleGeometry.contentTop,
 'an unspecified legacy preference uses the default-visible bookmark budget');
geometryOwner.readerSettingsSnapshot={...geometryOwner.readerSettingsSnapshot,hideStatusBar:true};
assert.equal(geometryOwner.readingLayout().contentTop,hiddenGeometry.contentTop,
 'returning to explicit immersion restores the original body budget');
geometryOwner.readerSettingsSnapshot={...geometryOwner.readerSettingsSnapshot,hideStatusBar:false,navigationMode:'continuous'};
const continuousGeometry=geometryOwner.readingLayout();
assert.equal(continuousGeometry.contentTop,hiddenGeometry.contentTop,
 'normal continuous mode retains its original top budget without the paged bookmark reservation');
geometryOwner.readerSettingsSnapshot={...geometryOwner.readerSettingsSnapshot,navigationMode:'paged'};
const pagedGeometry=geometryOwner.readingLayout();
assert.notEqual(pagedGeometry,continuousGeometry,'navigation mode invalidates the production cache without a metric revision');
assert.equal(pagedGeometry.contentTop,visibleGeometry.contentTop,'returning to paged mode restores the complete bookmark reservation');
const require=createRequire(import.meta.url);
const syntax=require(((resolveEtsLoaderRoot()) + '/lib/validate_ui_syntax.js'));
const paperSource=readFileSync(file('features/reading/ReaderStatusBarPaper.ets'),'utf8');
syntax.componentCollection.customComponents.add('ReaderStatusBarPaper');
syntax.propCollection.set('ReaderStatusBarPaper',new Set([...paperSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
class PaperChild{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
// System status visibility is independent from cutout extension and active
// controls: the explicit hide preference only applies while controls are closed.
for(const hideStatusBar of [false,true])for(const extended of [false,true])
for(const controls of [false,true])for(const active of [false,true]){
 const visible=active&&(controls||!hideStatusBar);
 const label=JSON.stringify({hideStatusBar,extended,controls,active});
 const reading=actualReadingGeometry({extendIntoCutout:extended,hideStatusBar}).readingLayout();
 const {owner:b}=createReaderBuilderProbe(source,['readerStatusBarUnderlay','readerStatusBarMetrics'],{ReaderWindowCoordinator:{metrics:()=>metrics},
 readerAppearanceThemeStyle:()=>({paperStart:'#FFE8D8B9'}),ReaderStatusBarPaper:PaperChild});
 Object.assign(b,{windowChromeActive:active,readerSettingsSnapshot:{extendIntoCutout:extended,hideStatusBar},controlsPresentedForWindow:()=>controls,
 windowControlsPresented:controls,appearanceSnapshot:{activeTheme:'paper'},readingLayout:()=>reading});b.readerStatusBarUnderlay();
 const rows=[...b.nodes.values()].filter(n=>n.id==='reader-status-bar-underlay');assert.equal(rows.length,visible?1:0,label);
 assert.equal(b.children.size,visible?1:0,label);
 if(visible){const props=[...b.children.values()][0].params;
  assert.equal(props.theme,'paper');assert.equal(props.fallbackColor,'#FFE8D8B9');assert.equal(props.statusRect.height,48);
  assert.deepEqual(props.statusRect,metrics.statusBarRect,'paper must use the actual measured status rectangle');
  assert.equal(props.viewportWidth,390);assert.equal(props.viewportHeight,844);assert.equal(props.expanded,false);assert.equal(rows[0].zIndex,10);}
}

}

async function case_bookmark_confirmed_owner() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { actionMenuProbe } = await import('./lib/reader-action-menu-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { performance } = await import('node:perf_hooks');
const { setInterval : intervals, setTimeout : delay } = await import('node:timers/promises');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { measureReaderPageChromeText, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderRectVp:R,ReaderDisplayCornerVp:C,ReaderWindowMetricsSnapshot:M}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const readingGeometry=await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const {resolveReaderReadingLayout,resolveReaderControlLayout}=readingGeometry;
const {resolveReaderPageChromeLayout,ReaderPageChromeMeasurements,READER_PAGE_CHROME_BOOKMARK_SIZE}=await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
const file=n=>new URL('../entry/src/main/ets/'+n,import.meta.url);
const lre=file('features/reading/LocalReadingExperience.ets');
const panel=file('features/reading/ReaderControlPanel.ets');
const {readerAppearanceChromeTone}=await import('../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts');
const source=readFileSync(lre,'utf8');
const B=productionMotionMethods(lre,['bookmarkMatchesCurrentChapter','currentPageBookmarkStatus','toggleCurrentPageBookmark','pageBookmarkFeedbackAnchor','pageBookmarkFeedbackFilled','reconcilePageBookmarkFeedback','canStartReaderBookmarkGesture','bookmarkFeedbackOwnerKey'],{LOCAL_READING_SOURCE_ID:'local'});
let entries=[{index:0,title:'C',bookmarks:[]}],requests=[];
const b=Object.assign(new B(),{sourceId:'local',bookId:'b',mounted:true,visiblePage:{startScalar:10,endScalar:20},bookmarkPendingTarget:'',bookmarkMutationGeneration:0,
 bookmarkPreviewChanged:false,currentChapterIndex:()=>0,controlDirectoryEntries:()=>entries,currentPageBookmarkText:()=> 'original',onTogglePageBookmark:r=>requests.push(r),canTurnPage:()=>true,
 isReaderPageInteractionEnabled:()=>true,pageTurnTapOnlyInput:()=>false});
assert.equal(b.canStartReaderBookmarkGesture(),true);
assert.equal(b.pageBookmarkFeedbackFilled(),false);b.bookmarkPreviewChanged=true;assert.equal(b.pageBookmarkFeedbackFilled(),true);
b.toggleCurrentPageBookmark();b.bookmarkPreviewChanged=false;assert.equal(b.pageBookmarkFeedbackFilled(),true);assert.equal(b.canStartReaderBookmarkGesture(),false);
b.toggleCurrentPageBookmark();assert.equal(requests.length,1,'pending write cannot be repeated');
requests[0].onSettled(true);assert.equal(b.pageBookmarkFeedbackFilled(),true,'ACK before reactive projection keeps armed fill');
entries=[{index:0,title:'C',bookmarks:[{time:1,chapterOffset:10}]}];b.reconcilePageBookmarkFeedback();assert.equal(b.bookmarkPendingTarget,'');assert.equal(b.pageBookmarkFeedbackFilled(),true);
assert.equal(b.canStartReaderBookmarkGesture(),true);
b.bookmarkPreviewChanged=true;assert.equal(b.pageBookmarkFeedbackFilled(),false,'existing bookmark reverses to hollow');
b.toggleCurrentPageBookmark();b.bookmarkPreviewChanged=false;assert.equal(b.pageBookmarkFeedbackFilled(),false);
requests[1].onSettled(false);assert.equal(b.pageBookmarkFeedbackFilled(),true,'uncertain/failed deletion must not falsely remove confirmed marker');
b.toggleCurrentPageBookmark();entries=[{index:0,title:'C',bookmarks:[]}];b.reconcilePageBookmarkFeedback();assert.notEqual(b.bookmarkPendingTarget,'');
requests[2].onSettled(true);assert.equal(b.bookmarkPendingTarget,'');assert.equal(b.pageBookmarkFeedbackFilled(),false,'projection before ACK also converges');
b.toggleCurrentPageBookmark();b.bookId='other';requests[3].onSettled(true);assert.equal(b.pageBookmarkFeedbackFilled(),false,'old-book completion cannot fill another book');
entries=[{index:0,title:'C',bookmarks:undefined}];assert.equal(b.canStartReaderBookmarkGesture(),false);
let unavailable=[{index:0,title:'C',bookmarks:[]}],confirmedCallback;
const confirmed=Object.assign(new B(),{sourceId:'local',bookId:'confirmed',mounted:true,visiblePage:{startScalar:10,endScalar:20},bookmarkPendingTarget:'',bookmarkMutationGeneration:0,
 bookmarkPreviewChanged:false,currentChapterIndex:()=>0,controlDirectoryEntries:()=>unavailable,currentPageBookmarkText:()=> 'original',onTogglePageBookmark:r=>confirmedCallback=r.onSettled,canTurnPage:()=>true,
 isReaderPageInteractionEnabled:()=>true,pageTurnTapOnlyInput:()=>false});
confirmed.toggleCurrentPageBookmark();unavailable=[{index:0,title:'C',bookmarks:undefined}];confirmed.reconcilePageBookmarkFeedback();confirmedCallback(true);
assert.equal(confirmed.pageBookmarkFeedbackFilled(),true);assert.equal(confirmed.canStartReaderBookmarkGesture(),false,'confirmed write + failed projection retains marker but cannot repeat mutation');
const {owner:confirmedView}=createReaderBuilderProbe(source,['bookmarkCornerFeedback','pageBookmarkFeedbackFilled','pageBookmarkFeedbackMode','pageBookmarkFeedbackAnchor','bookmarkFeedbackOwnerKey'],{readerAppearanceChromeTone});
Object.assign(confirmedView,confirmed,{visibleReadingAppearance:()=>({activeTheme:'paper'}),controlVisible:()=>false,controlObscured:false,bookmarkPageOffsetY:0,readerAppScheme:'day',viewportWidth:390,
 bookmarkCornerLayout:()=>({topAccessoryX:341,topAccessoryY:12,topAccessoryWidth:24,topAccessoryHeight:24}),
 bookmarkFeedbackLabel:()=> 'bookmark',currentPageBookmarkStatus:()=> 'unknown',readingLayout:()=>({pageChromeVisualSafeTop:0,pageChromeTopRegionHeight:48})});
confirmedView.bookmarkFeedbackHintLabel=()=> '';
confirmedView.bookmarkCornerFeedback();const painted=[...confirmedView.nodes.values()].filter(n=>n.type==='Image');assert.equal(painted.length,1);assert.match(painted[0].create,/reader_page_bookmark_filled/);

}

async function case_force_refresh_menu() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { actionMenuProbe } = await import('./lib/reader-action-menu-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { performance } = await import('node:perf_hooks');
const { setInterval : intervals, setTimeout : delay } = await import('node:timers/promises');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { measureReaderPageChromeText, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderRectVp:R,ReaderDisplayCornerVp:C,ReaderWindowMetricsSnapshot:M}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const readingGeometry=await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const {resolveReaderReadingLayout,resolveReaderControlLayout}=readingGeometry;
const {resolveReaderPageChromeLayout,ReaderPageChromeMeasurements,READER_PAGE_CHROME_BOOKMARK_SIZE}=await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
const file=n=>new URL('../entry/src/main/ets/'+n,import.meta.url);
const lre=file('features/reading/LocalReadingExperience.ets');
const panel=file('features/reading/ReaderControlPanel.ets');
const Refresh=productionMotionMethods(lre,['canRefreshCurrentChapter','refreshCurrentChapter','loadSessionChapter']);
let calls=[];const old={content:'old'};
const refresh=Object.assign(new Refresh(),{isControlInputEnabled:()=>true,phase:'ready',visiblePage:{startScalar:71},chapter:{chapterIndex:3},
 pageTurnSettlementActive:false,pageTurnInputOwned:false,pauseAutoPage:r=>calls.push(r),selectChapterAnchor:(...a)=>calls.push(a),bookId:'b',
 chapterWindow:{get:()=>old},activeGateway:()=>({loadChapter:async(...a)=>{calls.push(a);return {content:'new'};}})});
refresh.refreshCurrentChapter();assert.deepEqual(calls[1],[3,71,false,true,undefined,-2,false,true]);
assert.equal(await refresh.loadSessionChapter(3,()=>true),old);assert.equal((await refresh.loadSessionChapter(3,()=>true,true)).content,'new');assert.equal(calls.at(-1)[3],true);
refresh.pageTurnInputOwned=true;const n=calls.length;refresh.refreshCurrentChapter();assert.equal(calls.length,n,'refresh does not compete with a held page gesture');
const More=productionMotionMethods(panel,['performMoreAction','readerMoreActionEnabled']);let actions=[];const more=Object.assign(new More(),{moreMenuVisible:true,inputEnabled:true,chapterRefreshEnabled:false,bookDownloadEnabled:true,controlObscured:false,
 dismissMoreMenu(){this.moreMenuVisible=false;actions.push('dismiss');},onOpenBookInfo:()=>actions.push('info'),onRefreshChapter:()=>actions.push('refresh')});
more.performMoreAction('refresh');assert.deepEqual(actions,[]);more.chapterRefreshEnabled=true;more.performMoreAction('refresh');more.performMoreAction('refresh');assert.deepEqual(actions,['dismiss','refresh']);
// Current SDK menu composition is indexed at H-action-sheet-content#current-sdk-actions.

}

async function case_durable_bookmark_ack() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { actionMenuProbe } = await import('./lib/reader-action-menu-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { performance } = await import('node:perf_hooks');
const { setInterval : intervals, setTimeout : delay } = await import('node:timers/promises');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { measureReaderPageChromeText, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderRectVp:R,ReaderDisplayCornerVp:C,ReaderWindowMetricsSnapshot:M}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const readingGeometry=await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const {resolveReaderReadingLayout,resolveReaderControlLayout}=readingGeometry;
const {resolveReaderPageChromeLayout,ReaderPageChromeMeasurements,READER_PAGE_CHROME_BOOKMARK_SIZE}=await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
const file=n=>new URL('../entry/src/main/ets/'+n,import.meta.url);
const lre=file('features/reading/LocalReadingExperience.ets');
const panel=file('features/reading/ReaderControlPanel.ets');
const {bookmarkFixture:durableFixture}=await import('./lib/reading-operation-durable-probe.mjs');
const {makeBookmarkIndex:actualDirectoryIndex}=await import('./lib/reading-directory-sdk-consumer.mjs');
// Cold Core query/create/confirm/settle/readback is actual external I/O, not a
// 400ms UI-performance contract. Keep the same real idle boundary and business
// assertions, with a bounded timer and diagnostic state on a genuine timeout.
async function bookmarkSettlement(f,outcome){
 const started=performance.now(),signal=AbortSignal.timeout(5000);
 try{
  for await(const tick of intervals(10,undefined,{signal})){
   if(!f.directory.busy()&&!f.offline.busy()){await delay(5);return;}
  }
 }catch(error){
  if(error.name!=='AbortError')throw error;
  assert.fail('actual bookmark settlement timeout '+JSON.stringify({outcome,elapsedMs:Math.round(performance.now()-started),
   directoryBusy:f.directory.busy(),offlineBusy:f.offline.busy(),lastMethod:f.calls.at(-1)?.method,
   requests:f.calls.map(c=>c.method).filter(Boolean)}));
 }
}
for(const outcome of ['success','write-failed','projection-failed']){
 const f=await durableFixture(true),x=actualDirectoryIndex(f),i=x.idx;let result,finished=0;
 i.detailToc=[{index:0,title:'C',bookmarks:[],downloadState:'completed'}];
 if(outcome==='write-failed')f.options.beforeMethod='bookmark.create';
 const native=f.runtime.request.bind(f.runtime);f.runtime.request=async(m,p,o)=>{if(outcome==='projection-failed'&&m==='bookmark.list')throw Error('projection');return native(m,p,o);};
 i.toggleReaderPageBookmark({chapterIndex:0,chapterOffset:10,chapterTitle:'C',bookText:'original',bookmarkTimes:[],onSettled:r=>{result=r;finished++;}});
 await bookmarkSettlement(f,outcome);assert.equal(result,outcome!=='write-failed','qualified original write survives subsequent projection failure');assert.equal(finished,1);
 assert.equal(f.writes().length,1);
 if(outcome==='projection-failed'){assert.equal(i.directoryOperation.projection.receipt.confirmation,'confirmed');assert.equal(i.directoryOperation.projection.receipt.readback,'failed');}
 if(outcome==='write-failed')assert.equal(i.directoryOperation.projection.receipt.confirmation,'unknown');
 if(outcome==='success')assert.equal(i.detailToc[0].bookmarks[0].chapterOffset,10,'same exact physical page anchor reached actual Core');
}
console.log('PASS PH59 actual Index/Directory/Gateway/Core write and projection acknowledgments: success and both failure boundaries');

}

async function case_window_listener_lifecycle() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { actionMenuProbe } = await import('./lib/reader-action-menu-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { performance } = await import('node:perf_hooks');
const { setInterval : intervals, setTimeout : delay } = await import('node:timers/promises');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { measureReaderPageChromeText, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderRectVp:R,ReaderDisplayCornerVp:C,ReaderWindowMetricsSnapshot:M}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const readingGeometry=await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const {resolveReaderReadingLayout,resolveReaderControlLayout}=readingGeometry;
const {resolveReaderPageChromeLayout,ReaderPageChromeMeasurements,READER_PAGE_CHROME_BOOKMARK_SIZE}=await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
const file=n=>new URL('../entry/src/main/ets/'+n,import.meta.url);
const lre=file('features/reading/LocalReadingExperience.ets');
const panel=file('features/reading/ReaderControlPanel.ets');
// Real listener registration + full metric refresh: move without resize,
// duplicate events, hidden 180-degree rotation, unregister, and old callback.
const {ReaderInsetsVp:I}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const events=new Map(),displayEvents=new Map(),published=[];
let displayInfo={id:1,rotation:0,densityPixels:3,scaledDensity:3};
let globalX=0,hidden=false;
const movingWindow={on:(name,fn)=>events.set(name,fn),off:(name,fn)=>{assert.equal(events.get(name),fn);events.delete(name);},
 getWindowProperties:()=>({windowRect:{left:0,top:0,width:1170,height:2532},globalDisplayRect:{left:globalX,top:0,width:1170,height:2532}}),
 getWindowAvoidArea:type=>({leftRect:{width:0},rightRect:{width:0},bottomRect:{height:0},
  topRect:{left:0,top:0,width:1170,height:type===0&&!hidden?144:0}})};
const moving={mainWindow:movingWindow,metricsSnapshot:new M(),statusBarMeasurement:new ReaderStatusBarMeasurement(),statusBarHiddenApplied:false,
 desiredWindowPolicyOwner:'reader',desiredReaderWindowPolicy:{hideStatusBar:false},brightnessWriter:{reset(){}},installEpoch:1,windowPolicyRevision:1};
const MC=productionMotionMethods(file('app/ReaderWindowCoordinator.ts'),['registerWindowListeners','refreshMetrics','statusBarRectVp','topAvoidRectVp','topCornersVp','rectVp','avoidInsetsVp','sameRectVp','sameCornerVp','sameInsetsVp','detach'],
 {ReaderWindowCoordinator:moving,ReaderRectVp:R,ReaderDisplayCornerVp:C,ReaderInsetsVp:I,ReaderWindowMetricsSnapshot:M,ReaderStatusBarMeasurement,
  window:{AvoidAreaType:{TYPE_SYSTEM:0,TYPE_CUTOUT:1,TYPE_SYSTEM_GESTURE:2,TYPE_NAVIGATION_INDICATOR:3,TYPE_KEYBOARD:4}},
  display:{getDefaultDisplaySync:()=>displayInfo,CornerType:{TOP_LEFT:0,TOP_RIGHT:1},on:(n,f)=>displayEvents.set(n,f),off:(n,f)=>{assert.equal(displayEvents.get(n),f);displayEvents.delete(n);}},
  AppStorage:{setOrCreate:(...args)=>published.push(args)}});
Object.setPrototypeOf(moving,MC);moving.registerWindowListeners(movingWindow);moving.refreshMetrics();assert.equal(moving.metricsSnapshot.statusBarHeight,48);
const moved=events.get('rectChangeInGlobalDisplay');globalX=90;moved({});assert.equal(moving.metricsSnapshot.globalRect.left,30);
const afterMove=published.length;events.get('windowRectChange')({});events.get('windowSizeChange')({});assert.equal(published.length,afterMove,'duplicate native geometry events do not re-render parents');
hidden=true;moving.statusBarHiddenApplied=true;moving.desiredReaderWindowPolicy.hideStatusBar=true;events.get('avoidAreaChange')({});assert.equal(moving.metricsSnapshot.statusBarHeight,48);
displayInfo={...displayInfo,rotation:2};displayEvents.get('change')(1);assert.equal(moving.metricsSnapshot.statusBarHeight,0,'API21 hidden 180 degree rotation cannot borrow old orientation region');
moving.detach();assert.equal(events.size,0);assert.equal(displayEvents.size,0);const afterDetach=published.length;moved({});assert.equal(published.length,afterDetach,'stale position listener cannot publish into a new Window');
console.log('PASS PH57 actual Window position/display listeners, equality dedup, rotation invalidation and resource release');

}

const implementations = {'window-metric-fallback':case_window_metric_fallback,'measured-safe-geometry':case_measured_safe_geometry,'reading-budget-cache':case_reading_budget_cache,'status-paper-sdk':case_status_paper_sdk,'bookmark-confirmed-owner':case_bookmark_confirmed_owner,'force-refresh-menu':case_force_refresh_menu,'durable-bookmark-ack':case_durable_bookmark_ack,'window-listener-lifecycle':case_window_listener_lifecycle};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}

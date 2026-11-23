import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pureModuleProbe } from '../../lib/ets-pure-module-probe.mjs';
import { selectedProductionMethods } from '../../lib/selected-production-methods.mjs';

const ets = new URL('../../../entry/src/main/ets/',import.meta.url);
const feedbackPath = new URL('ui/feedback/ReaderTransientFeedback.ts',ets);
const toastPath = new URL('ui/feedback/ReaderTransientToast.ets',ets);
const sourcePath = new URL('features/source/ui/SourceManagementPage.ets',ets);
const metricsPath = new URL('pages/ReaderSourceTextMetrics.ets',ets);
const verificationPath = new URL('app/diagnostics/ReaderUIVerificationProbe.ts',ets);
const overlayPath = new URL('app/composition/ReaderLayoutDebugOverlay.ets',ets);
const sourceOwner = {mounting:4,generation:12};

function fixture(scope) {
  const values = new Map([['readerAppForeground',true],['readerDeveloperMode',true],['readerWindowMetricsRevision',9]]);
  const AppStorage = {get:key=>values.get(key),setOrCreate:(key,value)=>values.set(key,value)};
  const events = [], frames = [], timers = new Map();
  let nextTimer = 0, characterCount = 0, clock = 1000, windowId = 71, ownerWindowId = 71;
  const pulseTimers = new Map();
  const {ReaderUIVerificationProbe} = pureModuleProbe(readFileSync(verificationPath,'utf8'),'ReaderUIVerificationProbe.ts',{
    AppStorage, systemDateTime:{TimeType:{ACTIVE:1},getUptime:()=>clock},
    setTimeout:(action,duration)=>{ const id = ++nextTimer; pulseTimers.set(id,{action,at:clock+duration}); return id; },
    clearTimeout:id=>pulseTimers.delete(id),
  },['ReaderUIVerificationProbe']);
  ReaderUIVerificationProbe.configure(true,scope);
  ReaderUIVerificationProbe.emit = (kind,_channel,payload) => events.push({kind,payload,clock});
  const ReaderWindowCoordinator = {
    diagnosticWindowId:()=>windowId,
    metrics:()=>({ready:true,revision:values.get('readerWindowMetricsRevision'),windowRect:{width:366,height:809}}),
  };
  const advancePulse = (to) => {
    for (const [id,pulse] of pulseTimers) {
      if (pulse.at > to) break;
      clock = pulse.at;
      pulseTimers.delete(id);
      pulse.action();
    }
    clock = to;
  };
  const debugOverlay = () => {
    const Overlay = selectedProductionMethods(overlayPath,'ReaderLayoutDebugOverlay',[
      'aboutToDisappear','onDeveloperModeChanged','reportWindowSample',
    ],{ReaderUIVerificationProbe,ReaderWindowCoordinator,hilog:{info() {}},
      setInterval:(_action,duration)=>{ assert.equal(duration,1000); return 1; },clearInterval() {}});
    return Object.assign(new Overlay(),{
      developerModeEnabled:true,appForeground:true,frameScanHandle:-1,frameBounds:[],opaqueHeaders:new Map(),
      frameScanIssue:'',frameScanIssueNode:'',frameScanIssueDepth:-1,
      getUIContext:()=>({getWindowId:()=>ownerWindowId,vp2px:()=>3.5,fp2px:()=>3.5,isFollowingSystemFontScale:()=>true,
        getMaxFontScale:()=>2}),
      scanFrameTree() {},
    });
  };
  const feedback = pureModuleProbe(readFileSync(feedbackPath,'utf8'),'ReaderTransientFeedback.ts',{AppStorage},[
    'ReaderTransientFeedback','readerTransientTextObserver','registerReaderTransientHost','unregisterReaderTransientHost',
    'retireReaderTransientToast','createReaderTransientToastState','READER_TRANSIENT_TOAST_STORAGE_KEY',
    'READER_TRANSIENT_HOST_STORAGE_KEY','READER_FEEDBACK_EXTENDED_MS',
  ]);
  class TextController {
    getLayoutManager() {
      return {getLineCount:()=>1,getLineMetrics:()=>({startIndex:0,endIndex:characterCount,left:0,topHeight:2,width:57,height:18,baseline:16}),
        getRectsForRange: range=>[{rect:{left:range.start > 0 ? 46 : 1,top:2,right:56,bottom:18}}]};
    }
  }
  const {ReaderSourceTextMetrics} = pureModuleProbe(readFileSync(metricsPath,'utf8'),'ReaderSourceTextMetrics.ets',{
    TextController,graphicsText:{RectWidthStyle:{TIGHT:1},RectHeightStyle:{TIGHT:2}},
  },['ReaderSourceTextMetrics']);
  class ReaderPostLayoutFrame { constructor(_context,read) { this.read = read; } }
  const context = {animateTo:(_params,apply)=>apply(),postFrameCallback:frame=>frames.push(frame)};
  const Toast = selectedProductionMethods(toastPath,'ReaderTransientToast',[
    'aboutToAppear','aboutToDisappear','syncToast','dismiss','clearDismissTimer','activeTextObserver',
    'toastVerificationId','toastMessageTextOptions','toastTextLayout',
  ],{
    ...feedback,AppStorage,ReaderPostLayoutFrame,readerReduceMotionFromStorage:()=>true,
    readerMotionAnimateParam:()=>({duration:0}),announceReaderTransientToast:()=>{},
    setTimeout:(action,duration)=>{ const id = ++nextTimer; timers.set(id,{action,duration}); return id; },
    clearTimeout:id=>timers.delete(id),
  });
  const toast = ()=>values.get(feedback.READER_TRANSIENT_TOAST_STORAGE_KEY) ?? feedback.createReaderTransientToastState();
  const host = priority=>{
    const actor = Object.assign(new Toast(),{priority,hostId:-1,activeHost:0,foreground:true,displayed:false,
      handledGeneration:-1,textLayoutGeneration:-1,dismissTimer:-1,toast:toast(),getUIContext:()=>context});
    actor.aboutToAppear();
    return actor;
  };
  const sync = actor=>{
    actor.activeHost = values.get(feedback.READER_TRANSIENT_HOST_STORAGE_KEY);
    actor.toast = toast();
    actor.syncToast();
  };
  const Source = selectedProductionMethods(sourcePath,'SourceManagementPage',[
    'feedbackIdentity','onMessageChanged','transientTextFact','transientTextObserver',
  ],{...feedback,ReaderSourceTextMetrics,sourceVerificationOpening:()=>sourceOwner,
    ReaderUIVerificationProbe,ReaderWindowCoordinator});
  const source = (scope,message)=>Object.assign(new Source(),{
    operation:scope === 'operation-status' ? {
      action:'import',readFacts:{fact:'current',generation:18},
      receipt:{facts:{generation:23},receipt:{confirmation:'confirmed',readback:'succeeded'}},
    } : {action:'load',readFacts:{fact:'refreshFailed',generation:21}},
    statusMessage:message,statusKind:scope === 'operation-status' ? 'success' : 'error',
    mounted:true,verificationTextMetrics:{},verificationOpening:'source-opening',
    transientFeedback:new feedback.ReaderTransientFeedback(),getUIContext:()=>context,
    scheduleSourceAnchorRestore:()=>{},observeVerificationProjection:()=>{},scheduleImportStatusReadyObservation:()=>{},
    managementOpeningIsCurrent:()=>true,verificationReadTextScope:()=>scope === 'retained-read-failed' ? scope : undefined,
    sourceListLoading:()=>false,hasPendingSourceRecovery:()=>false,hasEmptyListReadFailure:()=>false,
    verificationOperationTextFact() { return {scope:'operation-status',generation:this.operation.receipt?.facts.generation,statusRevision:32}; },
    verificationTextLayoutScope() { return {owner:sourceOwner,readGeneration:this.operation.readFacts.generation,filterRevision:5,
      textProjectionRevision:7,windowRevision:9,widthVp:366,heightVp:809,density:3.5,systemFontScale:1.3,fontScale:1.3}; },
  });
  const attach = actor=>{
    characterCount = actor.toast.message.length;
    const options = actor.toastMessageTextOptions();
    actor.toastTextLayout(actor.toast.generation)({}, {width:150,height:32});
    return options;
  };
  return {feedback,events,frames,timers,toast,host,sync,source,attach,pulseTimers,advancePulse,debugOverlay,values,
    changeWindow:()=>{ windowId += 1; },changeOverlayWindow:()=>{ ownerWindowId += 1; }};
}

test('Source transient glyphs bind the actual active import message and leave the normal dismissal time', ()=>{
  const {events,frames,timers,toast,host,sync,source,attach} = fixture();
  const root = host(0);
  const page = source('operation-status','书源导入完成：Core 已导入 1 个书源。');
  page.onMessageChanged();
  assert.equal(toast().message,page.statusMessage);
  sync(root);
  assert.deepEqual([...timers.values()].map(timer=>timer.duration),[2200]);
  assert.equal(root.toastVerificationId(false),'reader-transient-feedback-1');
  assert.equal(root.toastVerificationId(true),'reader-transient-feedback-text-1');
  assert.ok(attach(root)?.controller);
  attach(root);
  assert.equal(frames.length,1);
  frames.shift().read();
  const layout = events.find(event=>event.kind === 'source.transient-text-layout');
  assert.equal(layout.payload.scope,'operation-status');
  assert.deepEqual(layout.payload.owner,sourceOwner);
  assert.deepEqual([layout.payload.toastGeneration,layout.payload.hostId,layout.payload.durationMs],[1,root.hostId,2200]);
  assert.deepEqual([layout.payload.readGeneration,layout.payload.generation,layout.payload.statusRevision],[18,23,32]);
  assert.equal(layout.payload.labels[0].role,'operation/status');
  assert.equal(layout.payload.labels[0].utf16Length,page.statusMessage.length);
  assert.equal(layout.payload.labels[0].complete,true);
  assert(!JSON.stringify(events).includes(page.statusMessage));
  [...timers.values()][0].action();
  assert.equal(toast().visible,false);
  assert.equal(root.toastVerificationId(true),'');
  assert.equal(events.at(-1).payload.phase,'retired');
});

test('Source transient glyphs retire queued reads on changed owner facts and active host handoff', ()=>{
  const {feedback,events,frames,toast,host,sync,source,attach} = fixture();
  const root = host(0);
  const retained = source('retained-read-failed','书源列表读取失败：some private read detail');
  retained.onMessageChanged();
  sync(root);
  assert.ok(attach(root));
  retained.operation.readFacts.generation += 1;
  frames.shift().read();
  assert.equal(events.some(event=>event.kind === 'source.transient-text-layout'),false);
  frames.shift().read();
  assert.equal(events.some(event=>event.kind === 'source.transient-text-layout'),false);

  retained.statusMessage = '书源列表读取失败：another private read detail';
  retained.onMessageChanged();
  sync(root);
  assert.ok(attach(root));
  const generation = toast().generation;
  const cover = host(10);
  sync(cover);
  sync(root);
  assert.equal(feedback.readerTransientTextObserver(generation,root.hostId),undefined);
  frames.shift().read();
  assert.equal(events.some(event=>event.kind === 'source.transient-text-layout'),false);

  cover.aboutToDisappear();
  retained.statusMessage = '书源列表读取失败：current private read detail';
  retained.onMessageChanged();
  sync(root);
  assert.ok(attach(root));
  frames.shift().read();
  const [proof] = events.filter(event=>event.kind === 'source.transient-text-layout');
  assert.equal(proof.payload.scope,'retained-read-failed');
  assert.equal(proof.payload.readGeneration,22);
  assert.equal(proof.payload.labels[0].role,'read/retained-status');
  assert.equal(proof.payload.toastGeneration,toast().generation);
  assert(!JSON.stringify(events).includes('private read detail'));
  const newSource = new feedback.ReaderTransientFeedback();
  newSource.show(()=>({}),{message:'other notification'},()=>true);
  assert.equal(events.at(-1).payload.phase,'retired');
  assert.equal(root.toastVerificationId(true),'');
});

test('Source import toast requests bounded actual window reports only for its live center scope', () => {
  function open(scope) {
    const trace = fixture(scope);
    const overlay = trace.debugOverlay();
    overlay.onDeveloperModeChanged();
    const nativeToast = trace.host(0);
    const page = trace.source('operation-status','书源导入完成：Core 已导入 1 个书源。');
    page.onMessageChanged();
    trace.sync(nativeToast);
    assert.deepEqual([...trace.timers.values()].map(timer=>timer.duration),[2200]);
    assert.equal(trace.pulseTimers.size,0,'publication alone does not start a pulse');
    trace.attach(nativeToast);
    trace.frames.shift().read();
    return {trace,page,overlay,marks:()=>trace.events.filter(event=>event.kind === 'window-stable')};
  }

  const other = open('import-research-edge-v3');
  assert.equal(other.marks().length,0);
  assert.equal(other.trace.pulseTimers.size,0);

  const active = open('import-research-center-v3');
  assert.deepEqual(active.marks().map(mark=>mark.clock),[1000]);
  active.trace.advancePulse(3500);
  assert.deepEqual(active.marks().map(mark=>mark.clock),[1000,1250,1500,1750,2000,2250,2500,2750,3000]);
  for (const {payload} of active.marks()) {
    assert.equal(payload.windowId,'71');
    assert.equal(payload.report.metrics.revision,9);
    assert.equal(payload.report.vpPixels,3.5);
    assert.equal(payload.report.fpPixels,3.5);
    assert.equal(payload.publicFixtureScope,'import-research-center-v3');
  }
  assert.equal(active.trace.pulseTimers.size,0);
  assert.equal(active.trace.toast().visible,true,'pulse expiration never changes the product toast');

  for (const stop of [
    ({trace}) => [...trace.timers.values()][0].action(),
    ({trace}) => trace.values.set('readerAppForeground',false),
    ({trace}) => trace.values.set('readerDeveloperMode',false),
    ({trace}) => trace.values.set('readerWindowMetricsRevision',10),
    ({trace}) => trace.changeWindow(),
    ({trace}) => trace.changeOverlayWindow(),
    ({page}) => { page.operation.readFacts.generation += 1; },
    ({overlay}) => overlay.aboutToDisappear(),
  ]) {
    const current = open('import-research-center-v3');
    stop(current);
    current.trace.advancePulse(2000);
    assert.equal(current.marks().length,1,'retirement or invalid ownership ends the scoped pulse');
    assert.equal(current.trace.pulseTimers.size,0);
  }
});

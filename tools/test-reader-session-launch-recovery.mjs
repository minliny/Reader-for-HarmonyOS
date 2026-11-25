import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "recovery-handoff": {
    "description": "Actual frame and source-ready generation, clock during recovery and cancel handoff; fake runtime ports",
    "resources": []
  },
  "stale-launch-handoff": {
    "description": "Production frame, controller and stale Panel receipt converge to an input-owning terminal state",
    "resources": []
  },
  "more-menu": {
    "description": "Actual More menu refresh readiness and one-dispatch ownership",
    "resources": []
  },
  "source-builder-isolation": {
    "description": "Actual SDK source-only TTS and Auto builders cannot interact or measure",
    "resources": []
  },
  "playback-theme-icons": {
    "description": "Actual SDK playback icons follow theme and playback state",
    "resources": []
  },
  "tts-engine-roundtrip": {
    "description": "Switching back from a configured HTTP engine re-enables the system service and island transport",
    "resources": []
  }
};

async function case_recovery_handoff() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const sessionPolicy = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
const { default: assert } = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire} = await import('node:module');
const require=createRequire(import.meta.url);
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {ReaderControlMotionFrameCache, readerControlMotionBounds} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts');
const {readerControlMotionMs, READER_CONTROL_OPEN_MS} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionPolicy.ts');
const {READER_REDUCED_FADE_MS} = await import('../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts');
const {ReaderSessionMorphSourceMeasurement} = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionMorphState.ts');
const {buildReaderSessionLaunchGeometry,sampleReaderSessionLaunch} = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts');
const {readerControlPlaybackSourceKind} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
const {sampleReaderControlAutoPage} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
const {createReaderControlMorphScroll,readerControlMorphScrollTranslation} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMorphScroll.ts');
const file=name=>new URL(`../entry/src/main/ets/features/reading/ui/${name}`,import.meta.url);
const curves={flight:p=>p,expand:p=>p,easeIn:p=>p,easeOut:p=>p,easeInOut:p=>p};
const g=buildReaderSessionLaunchGeometry({source:new ReaderSessionMorphSourceMeasurement('quickTts','tts',30,510,286,190,1),targetLeft:260,targetTop:790,topBarExitDistance:90,dockExitDistance:330});
const P=productionMotionMethods(file('ReaderControlPanel.ets'),['frame','currentLayout','controlPanelHeight',
  'paintedPresentationReceipt','onLaunchSourceVisible','confirmLaunchSourceReady','launchSourceCurrent','onRuntimeEnabledChanged'], {readerControlMotionBounds});
for(const time of [0,100,160,190,220,379,380]){
 const sample=sampleReaderSessionLaunch(time,g,curves),events=[];
 const p=Object.assign(new P(),{launchSample:sample,launchOwnsControls:false,launchRecovering:true,launchGeneration:7,
 launchSourceKind:'quickTts',launchSourceVisibleGeneration:0,launchSourceReadyGeneration:0,launchMotionProgress:0,
 runtimeMounted:true,capturedLaunchGeneration:7,capturedLaunchSourceKind:'quickTts',minimumIdentity:'',
 layout:{fullPanelWidth:364,fullPanelHeight:736,dockBottomGap:20},isExpanded:()=>false,controlQuickHeight:()=>330,
 launchFrameCache:new ReaderControlMotionFrameCache(),onLaunchSourceReady:n=>events.push(n)});
 for(const v of [0,.25,.75,1]){
  p.visualVisibilityProgress=v;const f=p.frame();
  assert.equal(f.topBar.translateY,sample.topBarOffsetY*(1-v));
  assert.equal(f.dock.translateY,sample.dockOffsetY*(1-v));
  assert.equal(f.topBar.opacity,1);assert.equal(f.dock.opacity,1);
 }
 p.visualVisibilityProgress=.5;p.onLaunchSourceVisible('quickTts');assert.deepEqual(events,[]);
 p.visualVisibilityProgress=1;p.confirmLaunchSourceReady();p.confirmLaunchSourceReady();assert.deepEqual(events,[7]);
 p.launchGeneration=8;p.confirmLaunchSourceReady();assert.deepEqual(events,[7],'old source readiness cannot complete a new generation');
}
// Input ownership stays revoked during recovery, but its existing control
// clock must run; conflating those gates would deadlock the source handoff.
{
 const enabled=[],p=Object.assign(new P(),{inputEnabled:false,launchRecovering:true,controlObscured:false,
 runtime:{setEnabled:v=>{enabled.push(v);return {};}},acceptRuntime:()=>{},
 syncProgressInput:()=>{},placementPointers:new Set(),refreshDockPlacement:()=>{}});
 p.onRuntimeEnabledChanged();assert.equal(enabled.at(-1),true);
 p.controlObscured=true;p.onRuntimeEnabledChanged();assert.equal(enabled.at(-1),false);
 p.controlObscured=false;p.launchRecovering=false;p.onRuntimeEnabledChanged();assert.equal(enabled.at(-1),false);
}
{
 const H=productionMotionMethods(file('LocalReadingExperience.ets'),['cancelSessionLaunch','restoreSessionLaunchControl'],
   {...sessionPolicy,READER_CONTROL_OPEN_MS,readerControlMotionMs});
 const source=sessionPolicy.expandReaderControlSession(sessionPolicy.enterReaderControlModule(
   sessionPolicy.openReaderControlSession(sessionPolicy.createReaderControlSessionState(),0),'tts',0),0);
 const current={ownership:'stage',geometry:{type:'tts'}};
 const next={...current,ownership:'handoffPending',sample:sampleReaderSessionLaunch(190,g,curves)};
 const h=Object.assign(new H(),{sessionLaunch:current,sessionLaunchSourceControl:source,reduceMotion:false,
   sessionLaunchSourceLayoutKey:'layout',sessionLaunchLayoutKey:()=> 'layout',armSessionLaunchDeadline:()=>{},
   sessionLaunchController:{cancel:()=>next},applyWindowPolicyForChromeOwner:()=>{},
   capsuleVerification:{ownerState:()=>{},finish:()=>{}},sessionLaunchSpeechFacts:()=>undefined});
 h.cancelSessionLaunch('openControl');
 assert.equal(h.controlSession.transition.kind,'open');assert.equal(h.controlSession.transition.durationMs,220);
 assert.equal(sessionPolicy.readerControlContentLocation(h.controlSession).module,'tts');
 assert.equal(sessionPolicy.readerControlTargetLocation(h.controlSession).form,'full');
}
{
 const H = productionMotionMethods(file('LocalReadingExperience.ets'), ['fadeSessionLaunchExit'], {
   readerMotionReducedFadeParam: onFinish => ({duration:READER_REDUCED_FADE_MS,onFinish}),
 });
 let finish;
 const states = [];
 const launch = {generation:7,ownership:'exitPending',cancelReason:'openControl'};
 const h = Object.assign(new H(), {mounted:true,appForeground:true,exitRequested:false,reduceMotion:true,
   sessionLaunch:launch,sessionLaunchExitGeneration:0,readerWindowMetricsRevision:1,
   sessionLaunchStageOpacity:1,sessionLaunchFooterExiting:true,sessionLaunchFooterOffset:5,
   armSessionLaunchDeadline:()=>{},
   sessionLaunchController:{finishExit:g=>g === launch.generation,snapshot:()=>launch},
   finishSessionCapsuleMorph:value=>states.push(value),
   getUIContext:()=>({animateTo:({duration,onFinish},update)=>{
     assert.equal(duration,120);
     assert.equal(h.sessionLaunchFooterOffset,0,'footer is stationary during the reduced fade');
     update();finish=onFinish;
   }}),
 });
 h.fadeSessionLaunchExit(7);
 assert.equal(h.sessionLaunchStageOpacity,0);
 assert.deepEqual(states,[]);
 finish();
 assert.deepEqual(states,[launch]);
}

}

async function case_stale_launch_handoff() {
  const assert = (await import('node:assert/strict')).default;
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const session = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
  const { readerControlMotionMs, READER_CONTROL_OPEN_MS } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionPolicy.ts');
  const { ReaderSessionLaunchController } = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchController.ts');
  const { buildReaderSessionLaunchGeometry } = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts');
  const { ReaderSessionMorphSourceMeasurement } = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionMorphState.ts');
  const file = name => new URL(`../entry/src/main/ets/features/reading/ui/${name}`, import.meta.url);
  let clock = 0;
  class Frame { constructor(run) { this.run = run; } }
  let timerId = 0;
  const timers = new Map();
  const Host = productionMotionMethods(file('LocalReadingExperience.ets'), [
    'scheduleSessionLaunchFrame', 'cancelSessionLaunch', 'onSessionLaunchSourceReady',
    'commitSessionLaunchControlHidden', 'finishSessionCapsuleMorph', 'reconcileSessionLaunchLayout',
    'restoreSessionLaunchControl', 'finishSessionLaunchHandoff', 'sessionLaunchAllowsControlInput',
    'clearSessionLaunchDeadline', 'armSessionLaunchDeadline', 'fadeSessionLaunchExit', 'openReaderControl',
    'rememberStaticSessionCapsuleOrigin', 'hideControl', 'admitReaderViewportSize',
  ], { ...session, READER_CONTROL_OPEN_MS, readerControlMotionMs, ReaderUIFrameCallback: Frame,
    SESSION_LAUNCH_CALLBACK_GRACE_MS: 250,
    readerMotionNowMs: () => clock, cancelReaderRapidPageTurn: state => state, AppStorage: { setOrCreate() {} },
    setTimeout: (run, duration) => (timers.set(++timerId, { run, duration }), timerId),
    clearTimeout: timer => timers.delete(timer), motionAnimateParam: (_id, onFinish) => ({ duration: 200, onFinish }),
    ReaderWindowCoordinator: { metrics: () => ({}) }, readerControlKeyboardVisible: () => false });
  const Foreground = selectedProductionMethods(file('LocalReadingExperience.ets'), 'ReadingExperience',
    ['onAppForegroundChanged']);
  const Panel = productionMotionMethods(file('ReaderControlPanel.ets'), [
    'launchSourceCurrent', 'onLaunchSourceVisible', 'confirmLaunchSourceReady',
  ], { readerControlPlaybackProfileMatches: () => true, readerControlPlaybackSourceKindMatches: () => true });
  for (const [type, kind] of [['autoPage', 'quickAutoPage'], ['tts', 'quickTts']]) for (const mode of ['flight', 'reopen', 'waiting', 'watchdog', 'fade-watchdog', 'settled', 'settled-full', 'settled-book-changed', 'settled-business-ended', 'settled-background', 'settled-dismiss', 'settled-local-viewport']) {
    clock = 0;
    const frames = [];
    const linear = progress => progress;
    const controller = new ReaderSessionLaunchController({ flight: linear, expand: linear,
      easeIn: linear, easeOut: linear, easeInOut: linear });
    const geometry = buildReaderSessionLaunchGeometry({ source: new ReaderSessionMorphSourceMeasurement(kind, 'playback', 30, 510, 286, 190, 1),
      targetLeft: 260, targetTop: 790, topBarExitDistance: 90, dockExitDistance: 330 });
    const launch = controller.begin({ lifecycle: 1, bookIdentity: 'book', moduleVisit: 1, viewportRevision: 1,
      scrollRevision: 1, layoutRevision: 1, paletteRevision: 1, fontRevision: 1, sourceRevision: 1, sourceActorId: 'playback' },
      geometry, 0, false);
    const quick = session.enterReaderControlModule(session.openReaderControlSession(session.createReaderControlSessionState(), 0), type, 0);
    const source = mode === 'settled-full' ? session.expandReaderControlSession(quick, 0) : quick;
    const h = Object.assign(new Host(), { mounted: true, appForeground: true, exitRequested: false,
      controlSession: source, latestControlVisualSession: source, sessionLaunchSourceControl: source,
      sessionLaunch: launch, sessionLaunchController: controller, sessionLaunchSourceLayoutKey: 'metrics-1',
      sessionLaunchExitGeneration: 0, sessionLaunchDeadlineTimer: -1, pageTurnRenderRevision: 0, reduceMotion: false, liveLayout: 'metrics-1',
      viewportWidth: 390, viewportHeight: 844,
      sessionLaunchLayoutKey() { return this.viewportWidth === 390 ? this.liveLayout : 'new-local-layout'; },
      pageTurnInputPhase: () => 'idle', invalidatePageTurnRuntime() {}, hasMeasuredViewport: () => false,
      usesBookTurnSimulation: () => false, windowMetricsLayoutKey: () => 'size-reconciled',
      hasCurrentMaterializedChapter: () => false,
      getUIContext: () => ({ postFrameCallback: frame => frames.push(frame), animateTo: (_params, update) => update() }),
      capsuleVerification: { ownerState() {}, finish() {}, queuedFrameTime() {}, update() {}, discardHandoffFade() {}, beginHandoffFade: () => false },
      controlVerification: { observing: () => false, accept() {} }, applyWindowPolicyForChromeOwner() {},
      drainPageTurnPreparationQueue() {}, sessionLaunchSpeechFacts() {}, automaticReadingState: () => ({ status: 'running' }),
      lifecycleToken: 1, sourceId: 'src', bookId: 'book', controlOpenRevision: 1, retireReaderRecovery() {},
      isControlInputEnabled: () => true, isReaderPageInteractionEnabled: () => true, pageTurnOwnsReaderInput: () => false,
      invalidateControlBackdrop() {}, controlTiming: () => ({ showDurationMs: 220, dismissDurationMs: 0 }),
      loadContentMetricsIfNeeded: async () => {}, refreshReaderBrightness() {},
      liveSessionCapsuleSnapshot: () => mode === 'settled-business-ended' ? undefined : { type, sessionState: 'paused' },
      controlVisible() { return session.readerControlContentLocation(this.controlSession).level !== 'hidden'; },
      dismissControlTemporaryLayers() {}, onControlInputBoundaryChanged() {}, cancelSourceSwitchCompletion() {},
      onAppForegroundChanged: Foreground.prototype.onAppForegroundChanged,
      stopReaderTtsAudition() {}, finishBookmarkRollback() {}, bookmarkRollbackGeneration: 0,
      captureReadingRecordElapsed() {}, clearReadingRecordTimer() {}, flushReadingRecord: async () => {},
      pauseAutoPage() {}, admitRetainedReadingRecency() {},
    });
    const oldReceipt = { module: type, metricsRevision: 1 };
    const p = Object.assign(new Panel(), { runtimeMounted: true, launchSample: launch.sample, launchGeneration: launch.generation,
      launchRecovering: true, minimumIdentity: 'book', minimumMetricsRevision: 2, capturedLaunchGeneration: launch.generation,
      capturedLaunchSourceKind: kind, launchNaturalMinimum: oldReceipt, visualVisibilityProgress: 1,
      launchSourceMinimum: { generation: launch.generation, kind, requiresNaturalProfile: true, receipt: oldReceipt },
      onLaunchSourceReady: generation => h.onSessionLaunchSourceReady(generation),
    });
    if (mode === 'flight') {
      h.scheduleSessionLaunchFrame(launch.generation);
      clock = 110;
      h.liveLayout = 'metrics-2';
      frames.shift().run();
    } else {
      h.sessionLaunch = controller.advance(launch.generation, 380);
      h.commitSessionLaunchControlHidden();
      if (mode === 'reopen' || (mode.startsWith('settled') && mode !== 'settled-local-viewport')) h.liveLayout = 'metrics-2';
      if (mode === 'settled-background') {
        h.appForeground = false;
        h.onAppForegroundChanged();
        h.appForeground = true;
        h.onAppForegroundChanged();
      } else if (mode === 'settled-local-viewport') h.admitReaderViewportSize(406, 844, h.lifecycleToken);
      else if (mode.startsWith('settled')) h.reconcileSessionLaunchLayout();
      else h.cancelSessionLaunch('openControl');
      if (mode === 'waiting') {
        assert.equal(h.sessionLaunch.ownership, 'handoffPending');
        h.liveLayout = 'metrics-2';
        h.reconcileSessionLaunchLayout();
      }
      if (mode === 'watchdog') {
        assert.equal(h.sessionLaunchAllowsControlInput(), false);
        const timer = timers.get(h.sessionLaunchDeadlineTimer);
        assert.equal(timer.duration, 470);
        timer.run();
      }
      if (mode === 'fade-watchdog') {
        p.minimumMetricsRevision = 1;
        p.onLaunchSourceVisible(kind);
        assert.equal(h.sessionLaunch.ownership, 'exitPending');
        assert.equal(h.sessionLaunchAllowsControlInput(), true, 'a current source owns input before capsule fade ends');
        const timer = timers.get(h.sessionLaunchDeadlineTimer);
        assert.equal(timer.duration, 450);
        timer.run();
      }
    }
    if (mode !== 'fade-watchdog') {
      p.onLaunchSourceVisible(kind);
      assert.equal(p.launchSourceReadyGeneration, undefined, 'the old rectangle cannot acknowledge current window metrics');
    }
    assert.equal(h.sessionLaunch?.ownership, undefined, `${type}/${mode} must release the stage`);
    assert.equal(h.sessionLaunchAllowsControlInput(), true);
    assert.equal(timers.size, 0, 'retired launch timers are cleared');
    if (mode !== 'fade-watchdog' && !mode.startsWith('settled')) {
      assert.equal(session.readerControlContentLocation(h.controlSession).module, type);
      assert.equal(session.sampleReaderControlSession(h.controlSession).visibilityProgress, 1);
    }
    if (mode.startsWith('settled')) {
      assert.equal(session.readerControlContentLocation(h.controlSession).level, 'hidden');
      if (mode === 'settled-book-changed') h.bookId = 'next-book';
      h.openReaderControl();
      const target = session.readerControlTargetLocation(h.controlSession);
      if (mode === 'settled-book-changed' || mode === 'settled-business-ended') {
        assert.equal(target.level, 'home', 'another reader or ended playback never restores the old controls');
      } else {
        assert.equal(target.module, type, 'static capsule must still open its original playback module after geometry retirement');
        assert.equal(target.form, mode === 'settled-full' ? 'full' : 'quick');
      }
      assert.equal(h.staticSessionCapsuleOrigin, undefined, 'the panel owns the visit after reopening');
      if (mode === 'settled-dismiss') {
        h.hideControl('backdrop');
        assert.equal(session.readerControlContentLocation(h.controlSession).level, 'hidden');
        assert.equal(h.staticSessionCapsuleOrigin?.location.module, type, 'backdrop saves the live session module again');
        h.openReaderControl();
        assert.equal(session.readerControlTargetLocation(h.controlSession).module, type);
        assert.equal(h.controlSession.transition.durationMs, 220);
        h.controlSession = session.openReaderControlSession(session.createReaderControlSessionState(), 0);
        h.hideControl('backdrop');
        h.openReaderControl();
        assert.equal(session.readerControlTargetLocation(h.controlSession).level, 'home');
      }
    }
  }
}

async function case_more_menu() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const sessionPolicy = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
const { default: assert } = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire} = await import('node:module');
const require=createRequire(import.meta.url);
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {ReaderControlMotionFrameCache} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts');
const {ReaderSessionMorphSourceMeasurement} = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionMorphState.ts');
const {buildReaderSessionLaunchGeometry,sampleReaderSessionLaunch} = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts');
const {readerControlPlaybackSourceKind} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
const {sampleReaderControlAutoPage} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
const {createReaderControlMorphScroll,readerControlMorphScrollTranslation} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMorphScroll.ts');
const file=name=>new URL(`../entry/src/main/ets/features/reading/ui/${name}`,import.meta.url);
const curves={flight:p=>p,expand:p=>p,easeIn:p=>p,easeOut:p=>p,easeInOut:p=>p};
const P=productionMotionMethods(file('ReaderControlPanel.ets'),['setMoreMenuVisible','dismissMoreMenu',
 'performMoreAction','currentMoreMenuOwnerScope']);
for(const local of [true,false]){
 const actions=[],p=Object.assign(new P(),{inputEnabled:true,runtimeMounted:true,temporaryLayerKind:'',
 moreMenuVisible:false,moreMenuGeneration:0,frame:()=>({visibility:1}),
 chapterRefreshEnabled:false,isLocalBook:()=>local,onTemporaryLayerChange:v=>actions.push(['temporary',v]),
 onRefreshChapter:()=>actions.push('refresh'),onOpenBookInfo:()=>actions.push('info'),
 observeMoreMenuFrames(){},syncProgressInput(){},refreshDockPlacement(){}});
 p.setMoreMenuVisible(true);p.performMoreAction('refresh');assert.equal(p.moreMenuVisible,true);
 assert.ok(!actions.includes('refresh'),'unready chapter cannot refresh');
 p.chapterRefreshEnabled=true;p.performMoreAction('refresh');assert.equal(actions.at(-1),'refresh');assert.equal(p.moreMenuVisible,false);
 p.performMoreAction('refresh');assert.equal(actions.filter(a=>a==='refresh').length,1,'closed menu cannot dispatch twice');
 p.setMoreMenuVisible(true);p.performMoreAction('info');assert.equal(actions.at(-1),'info');
}

}

async function case_source_builder_isolation() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const sessionPolicy = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
const { default: assert } = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire} = await import('node:module');
const require=createRequire(import.meta.url);
const sdk=resolveEtsLoaderRoot();
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {ReaderControlMotionFrameCache} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts');
const {ReaderSessionMorphSourceMeasurement} = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionMorphState.ts');
const {buildReaderSessionLaunchGeometry,sampleReaderSessionLaunch} = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts');
const {readerControlPlaybackSourceKind} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
const {sampleReaderControlAutoPage} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
const {createReaderControlMorphScroll,readerControlMorphScrollTranslation} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMorphScroll.ts');
const file=name=>new URL(`../entry/src/main/ets/features/reading/ui/${name}`,import.meta.url);
const curves={flight:p=>p,expand:p=>p,easeIn:p=>p,easeOut:p=>p,easeInOut:p=>p};
// Pure-source Builders use the same visual section functions, omit the normal
// Scroll/modal host, and cannot dispatch measurement/business callbacks.
for(const [name,module] of [['ReaderControlTtsContent.ets','tts'],['ReaderControlAutoPageContent.ets','autoPage']]){
 const source=readFileSync(file(name),'utf8');
 for(const m of source.matchAll(/@Builder\s+private (\w+)\(/g)) require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(m[1]);
 for(const form of ['quick','full']){
  const members=module==='autoPage'?['launchSourceContent','sourceMinimumCurrent','quickHeader','headerMeta']:['launchSourceContent','sourceMinimumCurrent'];
  const {owner}=createReaderBuilderProbe(source,members,{readerControlMorphScrollTranslation});
  const sections=[];
  Object.assign(owner,{sourceOnly:form,sourceMinimum:undefined,sourceMinimumIdentity:'',sourceMinimumKey:'',
   sourceMinimumMetricsRevision:-1,availableWidth:286,availableHeight:190,appScheme:'day',status:'stopped',
   motionProgress:form==='quick'?0:1,p:()=>form==='quick'?0:1,scrollMotion:createReaderControlMorphScroll(),
   presentation:()=>({contentOpacity:1,contentBlur:0}),
   presentationPrepared:()=>({facts:{autoPage:{status:'已停止'}}}),
   frame:()=>({playback:{x:8,y:24,width:280,height:128},control:{width:280,height:100},
    content:{x:0,y:0,width:286,height:190},details:{x:5,y:100,width:270,height:70}}),
   playback:()=>sections.push('playback'),timer:()=>sections.push('timer'),speed:()=>sections.push('speed'),
   controlSection:()=>sections.push('playback'),timerSection:()=>sections.push('timer'),moduleHeader:()=>{},speedRow:()=>sections.push('speed'),followHighlightRow:()=>{}});
  if(module==='autoPage')owner.frame=()=>sampleReaderControlAutoPage(form==='quick'?0:1,form==='quick'?286:338);
  owner.launchSourceContent();
  assert.equal(sections.filter(x=>x==='playback').length,1);assert.equal(sections.includes('timer'),form==='quick');
  assert.ok([...owner.nodes.values()].every(n=>n.type!=='Scroll'));
  if(module==='autoPage')assert.equal([...owner.nodes.values()].filter(n=>n.type==='Text'&&n.create==='自动翻页').length,
   form==='quick'?1:0,'PH51 retained Quick source executes its real header Builder, Full source only contains playback');
  // The current receipt guard lowers to a logical If before the native paint container.
  const root=[...owner.nodes.values()].find(n=>n.type==='Stack');assert.ok(root,'source paint container exists');
  assert.equal(root.enabled,false);assert.equal(root.accessibilityLevel,'no-hide-descendants');
 }
 const C=productionMotionMethods(file(name),['onMotionChanged','measureActor','reportMorphActor','onFullDidScroll','onSourceDetachedChanged'],{readerControlPlaybackSourceKind});
 const c=Object.assign(new C(),{sourceOnly:'full',sourceDetached:false,p:()=>1,syncRunningPulse(){},scroller:{currentOffset:()=>{throw Error('source scroller invoked');}},
  syncMorphScroll:()=>{throw Error('source motion invoked');},onMorphActorMeasured:()=>{throw Error('source measured');}});
 c.onMotionChanged();c.measureActor(true,{});c.reportMorphActor();c.onFullDidScroll();c.onSourceDetachedChanged();
}

}

async function case_playback_theme_icons() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const sessionPolicy = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
const { default: assert } = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire} = await import('node:module');
const require=createRequire(import.meta.url);
const sdk=resolveEtsLoaderRoot();
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {ReaderControlMotionFrameCache} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts');
const {ReaderSessionMorphSourceMeasurement} = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionMorphState.ts');
const {buildReaderSessionLaunchGeometry,sampleReaderSessionLaunch} = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts');
const {readerControlPlaybackSourceKind} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
const {sampleReaderControlAutoPage} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
const {createReaderControlMorphScroll,readerControlMorphScrollTranslation} = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMorphScroll.ts');
const file=name=>new URL(`../entry/src/main/ets/features/reading/ui/${name}`,import.meta.url);
const curves={flight:p=>p,expand:p=>p,easeIn:p=>p,easeOut:p=>p,easeInOut:p=>p};
for(const [name,builder] of [['ReaderControlAutoPageContent.ets','runningButton'],['ReaderControlTtsContent.ets','roundControl']]){
 const source=readFileSync(file(name),'utf8');
 const {owner}=createReaderBuilderProbe(source,builder==='roundControl'?[builder,'transportPaint','transportGlyphSize']:[builder],{readerTtsPlayGradientStart:()=> '#123456',FlexAlign:{Center:'center'}});
 Object.assign(owner,{p:()=>0,sourceOnly:'none',appScheme:'day',status:'running',state:{status:'playing'},serviceBusy:false,
 frame:()=>({playIcon:{x:0,y:0,width:32,height:32},toggle:{x:0,y:0,width:80,height:50}}),
 transport:()=>({x:0,y:0,width:40,height:40}),transportResponse:()=>({x:0,y:0,width:44,height:44}),
 textMetric:(_name,fallback)=>fallback,
 sharedInput:()=>true,onlineServicePage:()=>false,
 isHttpEngineSelected:()=>false,isActivelySpeaking:()=>owner.status==='running',hasActiveQueue:()=>true,controlText:()=>''});
 if(builder==='roundControl')owner.roundControl('toggle');else owner.runningButton();
 for(const scheme of ['day','night'])for(const playing of [true,false]){
  owner.appScheme=scheme;owner.status=playing?'running':'paused';owner.replay();
  const icon=[...owner.nodes.values()].find(n=>n.type==='Image').create;
  assert.equal(icon,`app.media.${builder==='roundControl'?(playing?'reader_tts_make_pause':'reader_tts_make_play'):(playing?'reader_session_pause':'reader_auto_full_play')}${scheme==='night'?'_theme_night':''}`);
 }
}

}

async function case_tts_engine_roundtrip() {
  const { default: assert } = await import('node:assert/strict');
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const { readerTtsConfigChoices } = await import('../entry/src/main/ets/features/reading/presentation/ReaderTtsConfigOptions.ts');
  const path = new URL('../entry/src/main/ets/features/reading/ui/ReaderControlTtsContent.ets', import.meta.url);
  const Tts = productionMotionMethods(path, ['isHttpEngineSelected', 'onlineServicePage', 'onEngineChanged',
    'configurationChoices', 'fieldWidth'], { readerTtsConfigChoices });
  let serviceFacts;
  const owner = Object.assign(new Tts(), { engine: 'system', serviceTab: '',
    httpEngines: [{ id: 5, name: 'HTTP' }],
    voiceOptions: [{ language: 'zh-CN', person: 2, label: '系统音色' }],
    textMinimum: () => ({ sessionFieldWidth: 73 }),
    publishMinimumMeasurer() { serviceFacts = this.onlineServicePage(); } });
  assert.equal(owner.onlineServicePage(), false);
  owner.engine = 'http-tts:5';
  owner.onEngineChanged();
  assert.equal(serviceFacts, true);
  for (const field of ['voice', 'language']) {
    owner.configField = field;
    assert.deepEqual(owner.configurationChoices(), []);
  }
  owner.engine = 'system';
  owner.onEngineChanged();
  assert.equal(serviceFacts, false, 'system transport and choices must use the system service projection');
  owner.configField = 'voice';
  assert.equal(owner.configurationChoices()[0]?.id, 'voice:zh-CN:2');
  owner.configField = 'language';
  assert.equal(owner.configurationChoices()[0]?.id, 'zh-CN');
  assert.equal(owner.fieldWidth('session'), 73, 'the session field consumes the prepared width without live measurement');
}

const implementations = {'recovery-handoff':case_recovery_handoff,'stale-launch-handoff':case_stale_launch_handoff,'more-menu':case_more_menu,'source-builder-isolation':case_source_builder_isolation,'playback-theme-icons':case_playback_theme_icons,'tts-engine-roundtrip':case_tts_engine_roundtrip};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}

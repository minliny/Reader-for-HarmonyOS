import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'business-intent':{description:'Immediate launch, non-blocking AutoPage takeover, paused TTS resume and obsolete business admission',resources:[]},
 'visual-owner-seam':{description:'Actual Host synchronous first frame, 380ms settlement, and stale frame ownership',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const { localFilePath }=await import('./lib/tool-environment.mjs');
const {default:assert}=await import('node:assert/strict');
const autoPolicy=await import('../entry/src/main/ets/features/reading/ui/ReaderAutoPageState.ts');
const { ReaderAutoPageCoordinator }=await import('../entry/src/main/ets/features/reading/ui/ReaderAutoPageCoordinator.ts');
const { readerTtsSessionBlocksAutoPageStart }=await import('../entry/src/main/ets/features/reading/ui/ReaderSessionCapsuleModel.ts');
const { buildReaderSessionLaunchGeometry }=await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts');
const { ReaderSessionLaunchController }=await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchController.ts');
const { ReaderSessionMorphSourceMeasurement, readerSessionMorphSourceKindForPage }=await import('../entry/src/main/ets/features/reading/ui/ReaderSessionMorphState.ts');
const { ReaderPageChromeSnapshot }=await import('../entry/src/main/ets/features/reading/presentation/ReaderPageChromeModel.ts');
const { copyReaderControlSessionState, createReaderControlSessionState,
 readerControlContentLocation }=await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
const { ReaderPageChromeMeasurements }=await import('../entry/src/main/ets/features/reading/ui/ReaderPageChromeLayout.ts');
const { productionMotionMethods }=await import('./lib/reader-motion-method-probe.mjs');
const file=localFilePath(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets',import.meta.url));
if(selectedCase==='business-intent'){
const names=['toggleTts','stopTts','toggleAutoPage','startAutoPageSession','stopAutoPage','cancelPendingAutoPageStart',
  'cancelPendingTtsPlay','createTtsPlayIntent','isTtsPlayIntentCurrent','retirePendingPlaybackStarts',
  'captureControlPlaybackPresentation','isControlPlaybackPresentationCurrent','toggleSessionCapsule',
  'rememberStaticSessionCapsuleOrigin','hideControlForStaticSessionCapsule','onSessionLaunchTtsState'];
const Host=productionMotionMethods(file,names,{...autoPolicy,readerTtsSessionBlocksAutoPageStart,
  readerControlContentLocation:s=>s.location});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
async function drain(){for(let i=0;i<10;i++)await Promise.resolve();}
function owner(){
 const host=new Host(),availability=deferred(),calls=[];
 Object.assign(host,{mounted:true,appForeground:true,exitRequested:false,lifecycleToken:1,sourceId:'src',bookId:'book',
  chapterSelectionToken:1,phase:'ready',chapter:{content:'正文',chapterIndex:4},visiblePage:{startScalar:20},materializedContentVersion:'v1',
  ttsAvailabilityResolved:true,ttsPlayIntentGeneration:0,ttsState:{status:'idle',rate:1},ttsLanguage:'zh-CN',ttsPerson:0,
  ttsPauseOnInterruption:true,ttsAllowMixing:false,ttsFailurePolicy:'stop',autoPageState:autoPolicy.createReaderAutoPageState(8),
  controlOpenRevision:1,controlModuleVisitRevision:1,
  controlSession:{location:{level:'secondary',module:'tts',form:'quick'}},visible:true,sessionLaunch:undefined,
  isSessionActive(t){return this.mounted&&!this.exitRequested&&this.lifecycleToken===t;},
  controlVisible(){return this.visible;},controlShellExitArmed:()=>false,
  initializeTtsSession:()=>availability.promise,ttsChapterRef:c=>({sourceId:'src',bookId:'book',chapterIndex:c.chapterIndex}),
  ttsTimerDurationMs:()=>0,logTtsFailure:(s)=>calls.push(`error:${s}`),
  beginSessionCapsuleMorph(type){calls.push(`visual:${type}`);this.sessionLaunch={generation:1,geometry:{type},ownership:'stage',businessStatus:'preparing',desiredPlaying:true};return true;},
  cancelSessionLaunch(reason){calls.push(`cancel:${reason}`);this.sessionLaunch=undefined;},
  hideControl(_origin,type){calls.push('hide');if(type!==undefined)this.rememberStaticSessionCapsuleOrigin(type,this.controlSession);},
  sessionLaunchSpeechFacts:()=>undefined,
  armAutoPageTimer(resetDeadline){calls.push('autoTimer');this.autoPageCoordinator.armPageTimer(resetDeadline);},
  armAutoPageSessionTimer:()=>{},clearAutoPageTimer:()=>{},clearAutoPageSessionTimer:()=>{},resetAutoPageSessionDuration:()=>{},
  pauseAutoPage(reason){this.autoPageCoordinator.pause(reason);},
  pageTurnInputPhase:()=> 'idle',sessionCapsuleSnapshot:()=>undefined,
  readerInputIsCurrent:()=>true,
  transientFeedback:{show:(_context,options)=>calls.push(`feedback:${options.message}`)},
  getUIContext:()=>({getPromptAction:()=>({showToast:()=>{}})}),
  controlVerification:{observing:()=>false},capsuleVerification:{ttsTiming:()=>undefined,ownerState:()=>{}},
 });
 host.autoPageCoordinator = new ReaderAutoPageCoordinator({ now:()=>10000,
  schedule:(_callback, delay)=>{calls.push(`schedule:${delay}`);return 1;},cancel:()=>{},active:()=>host.mounted&&!host.exitRequested,ready:()=>true,
  canResumeTurn:()=>true,turn:()=>({kind:'started'}),changed:()=>{} });
 Object.defineProperty(host,'autoPageState',{get:()=>host.autoPageCoordinator.snapshot()});
 host.automaticReadingState = () => host.autoPageCoordinator.snapshot();
 host.automaticReadingConfiguration = () => host.autoPageCoordinator.configurationAt();
 host.sessionLaunchController={mayStartBusiness:()=>host.sessionLaunch?.desiredPlaying===true,
  acknowledgeBusiness:(_g,s)=>{host.sessionLaunch.businessStatus=s;},snapshot:()=>host.sessionLaunch,
  setDesiredPlaying:(_g,v)=>{host.sessionLaunch.desiredPlaying=v;}};
 host.ttsCoordinator={setDesiredPlaying:v=>calls.push(`desired:${v}`),
  start:async(_input,desired)=>{calls.push(`start:${desired}`);host.ttsState={status:'preparing',rate:1};},
  whenStarted:()=>Promise.resolve(true),
  pause:async()=>{calls.push('pause');host.ttsState.status='paused';},resume:async()=>{calls.push('resume');},
  stop:async()=>{calls.push('stop');host.ttsState.status='idle';}};
 return {host,calls,availability};
}
for(const availabilityDelay of [false,true]){
 const {host,calls,availability}=owner();host.ttsAvailabilityResolved=!availabilityDelay;
 host.toggleTts();assert.equal(calls[0],'visual:tts','launch occurs synchronously before service preparation');
 if(availabilityDelay){assert.equal(calls.some(c=>c.startsWith('start:')),false);host.ttsAvailabilityResolved=true;availability.resolve(true);}
 else assert.ok(calls.includes('start:true'),'admitted TTS dispatches before a visual frame or async ACK');
 await drain();assert.equal(calls.filter(c=>c.startsWith('visual:')).length,1);assert.equal(calls.filter(c=>c.startsWith('start:')).length,1);
 assert.equal(calls.includes('hide'),false,'business ACK cannot start an independent control hide clock');
}
{
 const {host,calls,availability}=owner();host.ttsState.status='unavailable';
 host.initializeTtsSession=(_token,retry)=>{calls.push(`retry:${retry}`);return availability.promise;};
 host.toggleTts();assert.deepEqual(calls.slice(0,2),['visual:tts','retry:true']);
 assert.equal(calls.some(c=>c.startsWith('start:')),false);
 host.ttsState.status='idle';availability.resolve(true);await drain();
 assert.equal(calls.filter(c=>c.startsWith('start:')).length,1,'failed background preflight can be retried only by explicit play');
}
{
 const {host,calls,availability}=owner();host.ttsAvailabilityResolved=false;host.toggleTts();
 host.toggleSessionCapsule();assert.equal(host.sessionLaunch.desiredPlaying,false);assert.equal(host.sessionLaunch.businessStatus,'preparing');
 host.ttsAvailabilityResolved=true;availability.resolve(true);await drain();
 assert.ok(calls.includes('start:false'),'pause during availability is carried into start, never overwritten');
}
{
 const {host,calls}=owner();host.controlSession.location.module='autoPage';
 host.toggleAutoPage();
 assert.equal(calls[0],'visual:autoPage');
 assert.ok(calls.includes('autoTimer'));
 assert.ok(calls.some(call=>call.startsWith('schedule:')),'admitted countdown is armed on the play call');
 assert.equal(host.autoPageState.status,'running');
}
for (const module of ['tts','autoPage']) {
 const {host,calls}=owner();host.controlSession.location.module=module;
 if(module==='tts'){
  host.ttsState.status='paused';
  host.toggleTts();
  assert.ok(calls.includes('resume'));
 }else{
  host.autoPageCoordinator.start();host.autoPageCoordinator.pause('manual');
  host.toggleAutoPage();
  assert.equal(host.autoPageState.status,'running');
 }
 assert.equal(calls[0],`visual:${module}`,'resume from the visible playback module starts its own capsule flight');
 assert.equal(calls.includes('hide'),false,'an admitted flight owns the control exit');
}
for (const result of ['confirmed', 'failure', 'reopened', 'unconfirmed']) {
 const {host,calls}=owner();
 host.ttsState.status='paused';
 host.beginSessionCapsuleMorph=()=>false;
 host.toggleTts();
 assert.ok(calls.includes('resume'));
 assert.equal(calls.includes('hide'),false,'resume dispatch alone does not hide the panel');
 if (result==='reopened') host.controlModuleVisitRevision++;
 const state={...host.ttsState,status:result==='failure'?'error':'playing',audioStarted:result!=='unconfirmed'};
 host.ttsState=state;
 host.onSessionLaunchTtsState(state);
 assert.equal(calls.includes('hide'),result==='confirmed','only a current confirmed native resume may hide the panel');
 assert.equal(host.staticSessionCapsuleOrigin?.location.module,result==='confirmed'?'tts':undefined);
}
for(const [module, expected] of [['autoPage',true],['tts',true],['tts',false]]){
 const {host,calls}=owner();host.controlSession.location.module=module;
 const started=deferred();
 host.beginSessionCapsuleMorph=()=>false;
 host.ttsCoordinator.whenStarted=()=>started.promise;
 if(module==='autoPage'){
  host.toggleAutoPage();assert.equal(host.autoPageState.status,'running');
 }else{
  host.toggleTts();assert.ok(calls.includes('start:true'));
  assert.equal(calls.includes('hide'),false,'failed source capture cannot hide controls during TTS preparation');
  host.ttsState.status=expected?'playing':'failed';
  started.resolve(expected);await drain();
 }
 assert.equal(calls.includes('hide'),expected,'successful fallback leaves the static capsule visible');
 assert.equal(host.staticSessionCapsuleOrigin?.location.module,expected?module:undefined);
}
{
 const {host,calls}=owner(),started=deferred();
 host.beginSessionCapsuleMorph=()=>false;
 host.ttsCoordinator.whenStarted=()=>started.promise;
 host.toggleTts();
 host.controlModuleVisitRevision++;
 host.ttsState.status='playing';
 started.resolve(true);await drain();
 assert.equal(calls.includes('hide'),false,'late audio ACK cannot dismiss the new control visit');
}
{
 const {host,calls}=owner(),pause=deferred();host.ttsState.status='playing';host.controlSession.location.module='autoPage';
 host.ttsCoordinator.pause=()=>{calls.push('pause');host.ttsState.status='paused';return pause.promise;};
 host.ttsCoordinator.resume=async()=>{assert.equal(host.autoPageState.status,'stopped');calls.push('resume');};
 host.toggleAutoPage();
 assert.deepEqual(calls.slice(0,3),['pause','visual:autoPage','autoTimer']);
 assert.equal(host.autoPageState.status,'running');assert.equal(host.autoPageCoordinator.pendingStart(),false);
 assert.equal(host.ttsState.status,'paused');assert.equal(calls.includes('stop'),false);
 host.toggleTts();
 assert.equal(host.autoPageState.status,'stopped');assert.equal(calls.filter(call=>call==='resume').length,1);
 pause.resolve();await drain();assert.equal(host.autoPageState.status,'stopped','late pause completion does not re-arm AutoPage');
}
{
 const {host,calls}=owner(),pause=deferred();host.ttsState.status='playing';host.controlSession.location.module='autoPage';
 host.ttsCoordinator.pause=()=>{host.ttsState.status='paused';return pause.promise;};
 host.toggleAutoPage();assert.equal(host.autoPageState.status,'running');
 pause.reject(Error('transport pause failed'));await drain();
 assert.equal(host.autoPageState.status,'paused');
 assert.equal(calls.filter(call=>call.startsWith('feedback:')).length,1);
 assert.equal(calls.includes('cancel:stopBarrierFailure'),false);
}
{
 const {host,calls}=owner();host.ttsState.status='playing';host.controlSession.location.module='autoPage';
 host.readerInputIsCurrent=()=>false;
 host.toggleAutoPage();assert.equal(host.autoPageState.status,'stopped');
 assert.ok(calls.every(call=>call!=='pause'&&call!=='visual:autoPage'&&call!=='autoTimer'));
}
for(const invalidate of [h=>h.stopTts(),h=>{h.mounted=false;},h=>{h.lifecycleToken++;},h=>{h.bookId='new';},h=>{h.chapterSelectionToken++;}]){
 const {host,calls,availability}=owner();host.ttsAvailabilityResolved=false;host.toggleTts();invalidate(host);
 host.ttsAvailabilityResolved=true;availability.resolve(true);await drain();assert.equal(calls.some(c=>c.startsWith('start:')),false);
}
{
 const {host,calls,availability}=owner();host.ttsAvailabilityResolved=false;host.toggleTts();
 host.controlSession.location.module='autoPage';host.sessionLaunch=undefined;host.toggleAutoPage();
 host.ttsAvailabilityResolved=true;availability.resolve(true);await drain();
 assert.equal(host.autoPageState.status,'running');assert.equal(calls.some(c=>c.startsWith('start:')),false);
}

}
if(selectedCase==='visual-owner-seam'){
// Drive the real Host and controller from one source clock.
let now=10000;const storage=new Map();const frames=[];
class Callback{constructor(callback){this.onFrame=callback;}}
const Visual=productionMotionMethods(file,['beginSessionCapsuleMorph','scheduleSessionLaunchFrame'],{
 readerSessionMorphSourceKindForPage,buildReaderSessionLaunchGeometry,ReaderPageChromeMeasurements,ReaderPageChromeSnapshot,
 copyReaderControlSessionState,readerControlContentLocation,readerSessionCapsuleMinimumWidth:type=>type==='tts'?94:96,
 readerMotionNowMs:()=>now,ReaderUIFrameCallback:Callback,resolveReaderPageChromeLayout:()=>({sessionX:250,sessionY:760}),
 AppStorage:{setOrCreate:(k,v)=>storage.set(k,v)},hilog:{warn:()=>{}},
});
const c=p=>p,controller=new ReaderSessionLaunchController({flight:c,expand:c,easeIn:c,easeOut:c,easeInOut:c});
const source=new ReaderSessionMorphSourceMeasurement('quickAutoPage','source',25,524,286,196,1);
const visual=Object.assign(new Visual(),{mounted:true,appForeground:true,exitRequested:false,controlObscured:false,
 lifecycleToken:1,sourceId:'src',bookId:'book',controlOpenRevision:1,controlModuleVisitRevision:1,readerWindowMetricsRevision:1,
 sharedAppearanceRevision:1,appearanceMutationGeneration:1,measurementEpoch:1,reduceMotion:false,
 sessionLaunchController:controller,sessionLaunchSourceContexts:new Map([['quickAutoPage','measured']]),
 sessionLaunchTopExit:73,sessionLaunchDockExit:349,sessionLaunchExitGeneration:0,pageTurnRenderRevision:0,
 controlVisible:()=>true,cancelControlNavigationIntent:()=>{},effectiveViewportWidth:()=>0,effectiveViewportHeight:()=>0,
 sessionCapsuleMetrics:()=>({width:96,paintHeight:24,targetHeight:44}),
 controlVerification:{observing:()=>false},capsuleVerification:{begin:()=>{},queuedFrameTime:()=>undefined,update:()=>{},ownerState:()=>{}},
 controlPage:()=> 'quickAutoPage',sessionMorphSourceMeasurement:()=>source,
 sessionLaunchMeasurementKey:()=> 'measured',sessionLaunchLayoutKey:()=> 'layout',readingLayout:()=>({}),
 currentChapterIndex:()=>4,visiblePage:{startScalar:20},pageChromeClockText:'10:00',
 readerSettingsSnapshot: { navigationMode: 'paged' },
 latestControlVisualSession:createReaderControlSessionState(),currentPageTurnRenderPage:()=>({chromeTopStartText:'book',chromeTopEndText:'10:00',chromeBottomStartText:'1%',chromeBottomEndText:'1/50'}),
 ttsState:{status:'idle'},autoPageState:autoPolicy.createReaderAutoPageState(8),
 automaticReadingState(){return this.autoPageState;},
 suspendAdjacentMeasurement:()=>{},drainPageTurnPreparationQueue:()=>{},bookTurnTextureCaptureGeneration:0,
 invalidateControlBackdrop:()=>{},windowCalls:0,hiddenCalls:0,
 applyWindowPolicyForChromeOwner(){this.windowCalls++;},commitSessionLaunchControlHidden(){this.hiddenCalls++;},
 getUIContext:()=>({postFrameCallback:f=>frames.push(f)}),cancelSessionLaunch:()=>{throw Error('unexpected invalidation');},
});
assert.equal(visual.beginSessionCapsuleMorph('autoPage'),true);assert.equal(visual.sessionLaunch.sample.timeMs,0);
assert.equal(visual.sessionLaunch.sample.sharpOpacity,1);assert.equal(visual.hiddenCalls,0);assert.equal(frames.length,1);
now=10160;frames.shift().onFrame(now*1e6);
assert.equal(visual.sessionLaunch.sample.timeMs,160);
assert.equal(visual.hiddenCalls,1,'Host consumes current control-hidden receipt');
assert.equal(frames.length,1);
now=10220;frames.shift().onFrame(now*1e6);
assert.equal(visual.sessionLaunch.sample.sourceNeeded,false);
assert.equal(frames.length,1);
now=10380;frames.shift().onFrame(now*1e6);
assert.equal(visual.sessionLaunch.sample.finished,true);assert.equal(visual.sessionLaunch.ownership,'stage');
assert.equal(frames.length,0);assert.equal(storage.get('readerSessionChromeOverlayActive'),true);
assert.equal(visual.pageTurnRenderRevision,1,'the stable stage does not hand the footer back to old page textures');
const Window = productionMotionMethods(file, ['controlsPresentedForWindow', 'applyWindowPolicyForChromeOwner'], {
 AppStorage:{setOrCreate:(key,value)=>storage.set(key,value)},readerControlHostVisible:()=>false,
});
const windowPolicy=[];
const windowOwner=Object.assign(new Window(),{mounted:true,windowChromeActive:true,appForeground:true,
 syncVolumeKeyPolicy(){},applyReaderWindowPolicy:async(_settings,show)=>{windowPolicy.push(show);},
 sessionLaunch:{ownership:'stage',sample:{controlsPresented:false,finished:false}}});
windowOwner.applyWindowPolicyForChromeOwner();
assert.equal(windowOwner.windowControlsPresented,false,'authored control paint leaves during flight');
windowOwner.sessionLaunch.sample.finished=true;
windowOwner.applyWindowPolicyForChromeOwner();
assert.deepEqual(windowPolicy,[true,false],'the native status-bar change is deferred beyond the measurable flight');
console.log('Reader playback Host intents: PASS (production methods; immediate visual, 380ms settlement and stable ownership)');

}

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}

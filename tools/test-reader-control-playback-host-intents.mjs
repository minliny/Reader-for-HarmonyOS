import assert from 'node:assert/strict';
import * as autoPolicy from '../entry/src/main/ets/features/reading/ReaderAutoPageState.ts';
import { readerTtsSessionBlocksAutoPageStart } from '../entry/src/main/ets/features/reading/ReaderSessionCapsuleModel.ts';
import { buildReaderSessionLaunchGeometry } from '../entry/src/main/ets/features/reading/ReaderSessionLaunchPresentation.ts';
import { ReaderSessionLaunchController } from '../entry/src/main/ets/features/reading/ReaderSessionLaunchController.ts';
import { ReaderSessionMorphSourceMeasurement, readerSessionMorphSourceKindForPage } from '../entry/src/main/ets/features/reading/ReaderSessionMorphState.ts';
import { ReaderPageChromeSnapshot } from '../entry/src/main/ets/features/reading/ReaderPageChromeModel.ts';
import { copyReaderControlSessionState, createReaderControlSessionState } from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import { ReaderPageChromeMeasurements } from '../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const file=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url).pathname;
const names=['toggleTts','stopTts','toggleAutoPage','startAutoPageSession','stopAutoPage','cancelPendingAutoPageStart',
  'nextAutoPageStartGeneration','cancelPendingTtsPlay','createTtsPlayIntent','isTtsPlayIntentCurrent',
  'captureControlPlaybackPresentation','isControlPlaybackPresentationCurrent','toggleSessionCapsule'];
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
  autoPageStartGeneration:0,autoPageStartPending:false,controlOpenRevision:1,controlModuleVisitRevision:1,
  controlSession:{location:{level:'secondary',module:'tts',form:'quick'}},visible:true,sessionLaunch:undefined,
  isSessionActive(t){return this.mounted&&!this.exitRequested&&this.lifecycleToken===t;},
  controlVisible(){return this.visible;},controlShellExitArmed:()=>false,
  initializeTtsSession:()=>availability.promise,ttsChapterRef:c=>({sourceId:'src',bookId:'book',chapterIndex:c.chapterIndex}),
  ttsTimerDurationMs:()=>0,logTtsFailure:(s)=>calls.push(`error:${s}`),
  beginSessionCapsuleMorph(type){calls.push(`visual:${type}`);this.sessionLaunch={generation:1,geometry:{type},ownership:'stage',businessStatus:'preparing',desiredPlaying:true};return true;},
  cancelSessionLaunch(reason){calls.push(`cancel:${reason}`);this.sessionLaunch=undefined;},
  hideControl:()=>calls.push('hide'),onSessionLaunchTtsState:()=>calls.push('ack'),
  armAutoPageTimer:()=>calls.push('autoTimer'),armAutoPageSessionTimer:()=>{},clearAutoPageTimer:()=>{},clearAutoPageSessionTimer:()=>{},resetAutoPageSessionDuration:()=>{},
  pauseAutoPage(reason){this.autoPageState=autoPolicy.pauseReaderAutoPage(this.autoPageState,reason);},
  pageTurnInputPhase:()=> 'idle',sessionCapsuleSnapshot:()=>undefined,
  getUIContext:()=>({getPromptAction:()=>({showToast:()=>{}})}),
 });
 host.sessionLaunchController={mayStartBusiness:()=>host.sessionLaunch?.desiredPlaying===true,
  acknowledgeBusiness:(_g,s)=>{host.sessionLaunch.businessStatus=s;},snapshot:()=>host.sessionLaunch,
  setDesiredPlaying:(_g,v)=>{host.sessionLaunch.desiredPlaying=v;}};
 host.ttsCoordinator={setDesiredPlaying:v=>calls.push(`desired:${v}`),
  start:async(_input,desired)=>{calls.push(`start:${desired}`);host.ttsState={status:'preparing',rate:1};},
  pause:async()=>{calls.push('pause');host.ttsState.status='paused';},resume:async()=>{calls.push('resume');},
  stop:async()=>{calls.push('stop');host.ttsState.status='idle';}};
 return {host,calls,availability};
}
for(const availabilityDelay of [false,true]){
 const {host,calls,availability}=owner();host.ttsAvailabilityResolved=!availabilityDelay;
 host.toggleTts();assert.equal(calls[0],'visual:tts','launch occurs synchronously before service preparation');
 if(availabilityDelay){assert.equal(calls.some(c=>c.startsWith('start:')),false);host.ttsAvailabilityResolved=true;availability.resolve(true);}
 await drain();assert.equal(calls.filter(c=>c.startsWith('visual:')).length,1);assert.equal(calls.filter(c=>c.startsWith('start:')).length,1);
 assert.equal(calls.includes('hide'),false,'business ACK cannot start an independent control hide clock');
}
{
 const {host,calls,availability}=owner();host.ttsAvailabilityResolved=false;host.toggleTts();
 host.toggleSessionCapsule();assert.equal(host.sessionLaunch.desiredPlaying,false);assert.equal(host.sessionLaunch.businessStatus,'preparing');
 host.ttsAvailabilityResolved=true;availability.resolve(true);await drain();
 assert.ok(calls.includes('start:false'),'pause during availability is carried into start, never overwritten');
}
{
 const {host,calls}=owner(),stop=deferred();host.ttsState.status='playing';host.controlSession.location.module='autoPage';
 host.ttsCoordinator.stop=()=>{calls.push('stop');return stop.promise;};host.toggleAutoPage();
 assert.deepEqual(calls.slice(0,2),['visual:autoPage','stop']);assert.equal(host.autoPageState.status,'stopped');
 host.toggleSessionCapsule();stop.resolve();await drain();assert.equal(host.autoPageState.status,'paused');
 assert.equal(calls.includes('autoTimer'),false,'preparing pause cannot arm the first automatic turn');
}
{
 const {host,calls}=owner(),stop=deferred();host.ttsState.status='playing';host.controlSession.location.module='autoPage';
 host.ttsCoordinator.stop=()=>stop.promise;host.toggleAutoPage();stop.reject(Error('transport stop failed'));await drain();
 assert.equal(host.autoPageState.status,'stopped');assert.equal(host.ttsState.status,'playing');assert.ok(calls.includes('cancel:stopBarrierFailure'));
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

// Run the actual Host visual methods with the real ownership controller. This
// verifies first-frame publication / 350ms close / 1750ms persistence (PH09).
let now=10000;const storage=new Map();const frames=[],holdTimers=[];
class Callback{constructor(callback){this.onFrame=callback;}}
const Visual=productionMotionMethods(file,['beginSessionCapsuleMorph','scheduleSessionLaunchFrame'],{
 readerSessionMorphSourceKindForPage,buildReaderSessionLaunchGeometry,ReaderPageChromeMeasurements,ReaderPageChromeSnapshot,
 copyReaderControlSessionState,readerSessionCapsuleMinimumWidth:type=>type==='tts'?94:96,
 readerMotionNowMs:()=>now,ReaderUIFrameCallback:Callback,resolveReaderPageChromeLayout:()=>({sessionX:250,sessionY:760}),
 AppStorage:{setOrCreate:(k,v)=>storage.set(k,v)},hilog:{warn:()=>{}},
 setTimeout:(fn,ms)=>{holdTimers.push({fn,ms});return holdTimers.length;},
});
const c=p=>p,controller=new ReaderSessionLaunchController({flight:c,expand:c,easeIn:c,easeOut:c,easeInOut:c});
const source=new ReaderSessionMorphSourceMeasurement('quickAutoPage','source',25,524,286,196,1);
const visual=Object.assign(new Visual(),{mounted:true,appForeground:true,exitRequested:false,controlObscured:false,
 lifecycleToken:1,sourceId:'src',bookId:'book',controlOpenRevision:1,controlModuleVisitRevision:1,readerWindowMetricsRevision:1,
 sharedAppearanceRevision:1,appearanceMutationGeneration:1,measurementEpoch:1,reduceMotion:false,
 sessionLaunchController:controller,sessionLaunchSourceContexts:new Map([['quickAutoPage','measured']]),
 sessionLaunchTopExit:73,sessionLaunchDockExit:349,sessionLaunchExitGeneration:0,pageTurnRenderRevision:0,sessionLaunchHoldTimer:-1,
 controlVisible:()=>true,controlPage:()=> 'quickAutoPage',sessionMorphSourceMeasurement:()=>source,
 sessionLaunchMeasurementKey:()=> 'measured',sessionLaunchLayoutKey:()=> 'layout',readingLayout:()=>({}),
 currentChapterIndex:()=>4,visiblePage:{startScalar:20},pageChromeClockText:'10:00',
 latestControlVisualSession:createReaderControlSessionState(),currentPageTurnRenderPage:()=>({chromeTopStartText:'book',chromeTopEndText:'10:00',chromeBottomStartText:'1%',chromeBottomEndText:'1/50'}),
 ttsState:{status:'idle'},autoPageState:autoPolicy.createReaderAutoPageState(8),
 invalidateControlBackdrop:()=>{},windowCalls:0,hiddenCalls:0,
 applyWindowPolicyForChromeOwner(){this.windowCalls++;},commitSessionLaunchControlHidden(){this.hiddenCalls++;},
 getUIContext:()=>({postFrameCallback:f=>frames.push(f)}),cancelSessionLaunch:()=>{throw Error('unexpected invalidation');},
});
assert.equal(visual.beginSessionCapsuleMorph('autoPage'),true);assert.equal(visual.sessionLaunch.sample.timeMs,0);
assert.equal(visual.sessionLaunch.sample.sharpOpacity,1);assert.equal(visual.hiddenCalls,0);assert.equal(frames.length,1);
for(const elapsed of [349,350,700,850,1150]){
 now=10000+elapsed;frames.shift().onFrame(now*1e6);
 assert.equal(visual.sessionLaunch.sample.timeMs,elapsed*2);
 assert.equal(visual.hiddenCalls,elapsed>=350?1:0);
}
assert.equal(frames.length,0);assert.equal(holdTimers.length,1);assert.equal(holdTimers[0].ms,600);
now=11750;holdTimers[0].fn();
assert.equal(visual.sessionLaunch.sample.finished,true);assert.equal(visual.sessionLaunch.ownership,'stage');
assert.equal(frames.length,0);assert.equal(storage.get('readerSessionChromeOverlayActive'),true);
assert.equal(visual.pageTurnRenderRevision,1,'the stable stage does not hand the footer back to old page textures');
console.log('Reader playback Host intents: PASS (production methods; immediate visual, delayed ACK, pause intent, barriers, 350/1750 ownership)');

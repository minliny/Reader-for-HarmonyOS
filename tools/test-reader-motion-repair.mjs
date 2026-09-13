import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as S from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import { ReaderControlRuntime } from '../entry/src/main/ets/features/reading/ReaderControlRuntime.ts';
import { ReversibleMotionTimeline, motionSegment } from '../entry/src/main/ets/features/common/MotionTimeline.ts';
import { MotionPointTrack } from '../entry/src/main/ets/features/common/MotionPointTrack.ts';

const feature = name => new URL(`../entry/src/main/ets/features/${name}`, import.meta.url);
const linear = p => p;
const curve = { interpolate: linear };
const config = { axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 },
  tapMaxDurationMs: 500, directionSlopVp: 8, settleDurationMs: 320, showDurationMs: 220,
  dismissDurationMs: 200, coordinatedMotion: true };
let now = 1000;
const home = S.openReaderControlSession(S.createReaderControlSessionState(), 0);
const quick = S.enterReaderControlModule(home, 'tts', 0);
const full = S.expandReaderControlSession(quick, 0);
for (const [command, duration] of [[S.openReaderControlSession(S.createReaderControlSessionState(), 420),220],
  [S.expandReaderControlSession(quick,1150),320], [S.collapseReaderControlSession(full,1150),260],
  [S.dismissReaderControlSession(full,360),200]]) {
  const runtime = new ReaderControlRuntime(config, () => now);
  runtime.start(command);
  now += 16;
  const first = runtime.frame(now, runtime.ticket(), linear);
  assert.equal(first.session.transition.elapsedMs, 16, 'first callback advances from command time');
  assert.equal(first.session.transition.durationMs, duration);
  const pose = S.sampleReaderControlSession(first.session);
  runtime.setEnabled(false); now += 10000; runtime.setEnabled(true); now += 16;
  const resumed = runtime.frame(now, runtime.ticket(), linear);
  assert.equal(resumed.session.transition.elapsedMs, 32, 'background duration excluded');
  assert.notDeepEqual(S.sampleReaderControlSession(resumed.session), pose);
  const ticket = runtime.ticket(); runtime.stop();
  assert.equal(runtime.frame(now + 16, ticket, linear), undefined);
}
let opening = S.openReaderControlSession(S.createReaderControlSessionState(),220);
opening = S.advanceReaderControlSession(opening,50,opening.epoch,linear);
const entered = S.enterReaderControlModule(opening,'appearance',0);
assert.deepEqual(S.sampleReaderControlSession(entered),S.sampleReaderControlSession(opening));
assert.equal(entered.transition.elapsedMs,50,'navigation retains opening clock');
assert.equal(S.readerControlContentLocation(entered).module,'appearance');

const Panel = productionMotionMethods(feature('reading/ReaderControlPanel.ets'),
  ['contentInputEnabled','acceptRuntime','rememberVisibleContentLocation','confirmLaunchSourceReady'], S);
const panel = Object.assign(new Panel(),{inputEnabled:true,controlObscured:false,visualSession:opening,
  runtimeMounted:true,lastVisibleContentLocation:{level:'home',module:'directory',directoryTab:'directory',form:'quick'},
  onVisualSessionChange(){},commitVisualSession(){},reportBackdropRegions(){},scheduleRuntimeFrame(){},
  dockRect:{x:0,y:0,width:0,height:0},backdropRegions:[],
  rootScreenX:0,rootScreenY:0,dockLeft:()=>0,dockTop:()=>0,
  frame:()=>({progress:0,content:{width:286,height:190},shell:{y:0,width:390,height:750},dock:{translateY:0}})});
const present=state=>panel.acceptRuntime({session:state,offsetY:0});
present(opening);
assert.equal(panel.contentInputEnabled(),true,'visible opening controls accept independent input');
present(S.expandReaderControlSession(quick,320));
assert.equal(panel.contentInputEnabled(),false,'moving full content remains gated');
present({...opening,heldPointerId:1});
assert.equal(panel.contentInputEnabled(),false,'handle-owned touch never activates content');
present(S.createReaderControlSessionState());
assert.equal(panel.contentInputEnabled(),false,'retained invisible content cannot receive touches');
const panelSource=readFileSync(feature('reading/ReaderControlPanel.ets'),'utf8');
for(const actor of ['navigation','brightness']) {
  assert.ok(panelSource.includes(`.enabled(this.contentInputEnabled() && this.frame().${actor}.opacity > 0)`),
    `${actor}: a faded container must disable its descendants; HitTestMode.None alone does not`);
}

let animations=[], frames=[];
const UI={animateTo:(p,change)=>{animations.push(p);change();},postFrameCallback:f=>frames.push(f.fn)};
const motionAnimateParam=(id,onFinish)=>({id,onFinish});
class Callback {constructor(fn){this.fn=fn;}}
const Select=productionMotionMethods(feature('common/ReaderSelectPanel.ets'),
  ['selectAndCollapse','collapsePanel','onClosingChanged','aboutToDisappear'],{motionAnimateParam,OPTION_H:36});
for(const reduced of [false,true]) {
  const events=[];
  const menu=Object.assign(new Select(),{mounted:true,generation:1,selectionId:'indent:1',closeInFlight:false,value:'无',options:['无','单字','双字'],
    reduceMotion:reduced,getUIContext:()=>UI,onCommit:(value,id)=>events.push(['commit',id,value]),
    onDismiss:id=>events.push(['dismiss',id])});
  menu.selectAndCollapse('双字'); menu.selectAndCollapse('单字');
  assert.deepEqual(events[0],['commit','indent:1','双字']);
  assert.equal(events.filter(e=>e[0]==='commit').length,1);
  if(!reduced){assert.equal(events.length,1);animations.at(-1).onFinish();}
  assert.deepEqual(events[1],['dismiss','indent:1']);
}
const events=[];
const menu=Object.assign(new Select(),{mounted:true,generation:1,selectionId:'old',closeInFlight:false,value:'value',options:['value'],
  reduceMotion:false,getUIContext:()=>UI,onCommit:()=>events.push('commit'),onDismiss:()=>events.push('dismiss')});
menu.selectAndCollapse('value'); const late=animations.at(-1).onFinish;
menu.aboutToDisappear(); late(); assert.deepEqual(events,['commit'],'late finish cannot operate after unmount');
const Appearance=productionMotionMethods(feature('reading/ReaderControlAppearanceContent.ets'),['commitSelect']);
const selected=[];
const appearance=Object.assign(new Appearance(),{selectIdentity:'language:2',openSelect:'language',fullInput:()=>true,
  selectOptions:()=>['原文','繁转简','简转繁'],applySelect:(...args)=>selected.push(args)});
appearance.commitSelect('双字','indent:1'); appearance.commitSelect('双字','language:2');
assert.equal(selected.length,0,'neither stale identity nor invalid value can change another setting');
appearance.commitSelect('繁转简','language:2'); assert.deepEqual(selected,[['language','繁转简']]);

const Host=productionMotionMethods(feature('reading/LocalReadingExperience.ets'),
 ['performContinuousPageTurn','onReaderBookmarkGestureReleased','finishBookmarkRollback'],
 {motionAnimateParam,completeReaderPageGestureSettlement:S=>({...S,phase:'idle',owner:'none'})});
for(const reduceMotion of [false,true]){
 const requests=[];
 const host=Object.assign(new Host(),{mounted:true,exitRequested:false,appForeground:true,phase:'ready',
  chapter:{chapterIndex:1},continuousFragments:[{}],continuousCommitInFlight:false,reduceMotion,
  controlVisible:()=>false,isContinuousScrollerAtStart:()=>false,isContinuousScrollerAtEnd:()=>false,
  continuousScroller:{scrollPage:p=>requests.push(p)},getUIContext:()=>UI,bookmarkRollbackGeneration:0,
  bookmarkPageOffsetY:30,bookmarkPreviewChanged:true,pageTurnGestureState:{owner:'bookmark',phase:'settling'},
  flushDeferredPageChromeState:()=>{},drainPageTurnPreparationQueue:()=>{}});
 assert.equal(host.performContinuousPageTurn('next').kind,'started');
 assert.equal(requests[0].animation,!reduceMotion);
 const count=animations.length;host.onReaderBookmarkGestureReleased(false);
 if(reduceMotion){assert.equal(animations.length,count);assert.equal(host.pageTurnGestureState.phase,'idle');}
 else {const finish=animations.at(-1).onFinish;host.bookmarkRollbackGeneration++;host.bookmarkPageOffsetY=45;
  finish();assert.equal(host.bookmarkPageOffsetY,45,'old rollback cannot clear new gesture');}
}

// Capsule C/D/E/F behavior is covered by test-reader-session-launch.mjs
// against the archived design, including callback invalidation and handoff.

const shelfFile=feature('bookshelf/BookshelfPage.ets');
const shelfNames=['setViewMode','onReduceMotionChanged','startViewSwitch','scheduleViewSwitchFrame',
 'sampleViewSwitch','resetViewSwitchMotion','setRestingProjectionOpacity','projectionListProgress'];
const Shelf=productionMotionMethods(shelfFile,shelfNames,{readerMotionNowMs:()=>now,ReversibleMotionTimeline,
 motionSegment,bookshelfViewCoverDelayMs:i=>(Math.min(1,Math.floor(i/3))*3+i%3)*30,BookshelfMotionFrameCallback:Callback});
const viewMotion={totalMs:1000,layoutCommitMs:150,outgoingDurationMs:120,headerIncomingStartMs:500,headerIncomingDurationMs:200,
 contentIncomingStartMs:600,contentIncomingDurationMs:220,morphCoverIncomingStartMs:150,morphCoverIncomingDurationMs:30,
 movingCoverFadeStartMs:690,movingCoverFadeDurationMs:30,coverMoveDurationMs:420,coverScaleDurationMs:250};
for(const at of [80,300,680,900]){
 frames=[];const shelf=Object.assign(new Shelf(),{viewMode:'cover',reduceMotion:false,viewSwitchRunning:false,viewSwitchToken:0,
  webDavCredentials:{saveBookshelfViewMode:async()=>{}},persistRequestedViewMode:async()=>true,viewModeRevision:0,confirmedViewMode:'cover',mounted:true,
  viewMotion,viewFadeCurve:curve,viewContentCurve:curve,viewMoveCurve:curve,viewScaleCurve:curve,getUIContext:()=>UI});
 shelf.setViewMode('list');now+=at;frames.shift()();
 const before=[shelf.projectionListProgress(1),shelf.viewSwitchGridContentOpacity,shelf.viewSwitchListContentOpacity,
  shelf.viewSwitchDestinationCoverOpacity,shelf.viewSwitchMorphCoverOpacity];
 shelf.setViewMode('cover');
 assert.deepEqual([shelf.projectionListProgress(1),shelf.viewSwitchGridContentOpacity,shelf.viewSwitchListContentOpacity,
  shelf.viewSwitchDestinationCoverOpacity,shelf.viewSwitchMorphCoverOpacity],before,'reverse command preserves all visible samples');
 now+=at;frames.shift()();assert.equal(shelf.viewSwitchRunning,false);assert.equal(shelf.viewMode,'cover');
 shelf.setViewMode('list');shelf.reduceMotion=true;shelf.onReduceMotionChanged();
 assert.equal(shelf.viewMode,'list');assert.equal(shelf.viewSwitchRunning,false);
 frames.shift()();assert.equal(frames.length,0,'old shelf callback revoked');
}
assert.doesNotMatch(readFileSync(shelfFile,'utf8'),/\.animation\(|\.keyframeAnimateTo\(/,'final shelf properties have no leftover implicit clock');
let point=new MotionPointTrack({x:0,y:0},{x:100,y:200},0,120);
const held=point.sample(60,linear);assert.deepEqual(held,{x:50,y:100});
point=new MotionPointTrack(held,{x:0,y:0},60,160);
assert.deepEqual(point.sample(60,linear),held);assert.deepEqual(point.sample(220,linear),{x:0,y:0});
console.log('PASS production motion repair: first-frame clock, opening navigation/input, menu ownership/exactly-once, reduced motion, capsule lifecycle/timeline, shelf reversal and font sampled retarget. Device pixels remain separate.');

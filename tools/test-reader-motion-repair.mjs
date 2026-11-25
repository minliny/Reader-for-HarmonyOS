import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "runtime-panel-clock": {
    "description": "Actual Runtime/Panel active time, resumed sample and input ownership; configured fake timing, no capsule claim",
    "resources": []
  },
  "select-appearance-owner": {
    "description": "Actual Select/Appearance callback ownership and exactly-once collapse/reduced motion",
    "resources": []
  },
  "continuous-bookmark-owner": {
    "description": "Actual LRE continuous/bookmark motion rollback and original owner fencing",
    "resources": []
  },
  "shelf-reversal-fixture": {
    "description": "Actual Shelf methods with explicitly synthetic timing tokens and curve/frame ports; reversal/retarget only",
    "resources": []
  }
};

async function case_runtime_panel_clock() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const S = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
const { ReaderControlRuntime } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlRuntime.ts');
const { ReversibleMotionTimeline, motionSegment } = await import('../entry/src/main/ets/ui/foundation/MotionTimeline.ts');
const { MotionPointTrack } = await import('../entry/src/main/ets/ui/foundation/MotionPointTrack.ts');
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
  const started=runtime.start(command);
  now += 16;
  const first = runtime.frame(now, runtime.ticket(), linear);
  assert.equal(first.session.transition.elapsedMs, 16, 'first callback advances from command time');
  assert.equal(first.session.transition.durationMs, started.session.transition.durationMs);
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

}

async function case_select_appearance_owner() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const feature = name => new URL(`../entry/src/main/ets/features/${name}`, import.meta.url);
const linear = p => p;
const curve = { interpolate: linear };
const config = { axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 },
  tapMaxDurationMs: 500, directionSlopVp: 8, settleDurationMs: 320, showDurationMs: 220,
  dismissDurationMs: 200, coordinatedMotion: true };
let now = 1000;
let animations=[], frames=[];
const UI={animateTo:(p,change)=>{animations.push(p);change();},postFrameCallback:f=>frames.push(f.fn)};
const motionAnimateParam=(id,onFinish)=>({id,onFinish});
class Callback {constructor(fn){this.fn=fn;}}
const Select=productionMotionMethods(feature('../ui/controls/ReaderSelectPanel.ets'),
  ['selectAndCollapse','collapsePanel','finishCollapse','onClosingChanged','aboutToDisappear'],{motionAnimateParam,OPTION_H:36});
const selectSource=readFileSync(feature('../ui/controls/ReaderSelectPanel.ets'),'utf8');
assert.ok(!/\bonSelect\s*:/.test(selectSource),'the unused legacy callback is no longer a public entry');
assert.ok(!/export interface SelectAnchor\b/.test(selectSource),'the unused host anchor type is not re-exported by the menu');
const missingEvents=[],missingAnimations=[];
const missing=Object.assign(new Select(),{mounted:true,generation:1,selectionId:'missing-commit',closeInFlight:false,
  value:'无',options:['无','单字'],reduceMotion:false,onCommit:undefined,onDismiss:()=>missingEvents.push('dismiss'),
  getUIContext:()=>({animateTo:(params,apply)=>{missingAnimations.push(params);apply();}})});
missing.selectAndCollapse('单字');
assert.equal(missing.closeInFlight,false,'missing explicit commit cannot report an accepted selection');
assert.deepEqual(missingEvents,[]);assert.deepEqual(missingAnimations,[],'missing commit cannot close as success');
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
const Appearance=productionMotionMethods(feature('reading/ui/ReaderControlAppearanceContent.ets'),['commitSelect','selectionActorIdentity']);
const selected=[];
const appearance=Object.assign(new Appearance(),{selectIdentity:'language:2',chineseConversionIdentity:'reader:motion',openSelect:'language',fullInput:()=>true,
  selectOptions:()=>['原文','繁转简','简转繁'],applySelect:(...args)=>selected.push(args)});
appearance.commitSelect('双字','indent:1'); appearance.commitSelect('双字','language:2');
assert.equal(selected.length,0,'neither stale identity nor invalid value can change another setting');
appearance.commitSelect('繁转简',appearance.selectionActorIdentity()); assert.deepEqual(selected,[['language','繁转简','reader:motion']]);

}

async function case_continuous_bookmark_owner() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const S = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
const { ReaderControlRuntime } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlRuntime.ts');
const { ReversibleMotionTimeline, motionSegment } = await import('../entry/src/main/ets/ui/foundation/MotionTimeline.ts');
const { MotionPointTrack } = await import('../entry/src/main/ets/ui/foundation/MotionPointTrack.ts');
const feature = name => new URL(`../entry/src/main/ets/features/${name}`, import.meta.url);
const linear = p => p;
const curve = { interpolate: linear };
const config = { axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 },
  tapMaxDurationMs: 500, directionSlopVp: 8, settleDurationMs: 320, showDurationMs: 220,
  dismissDurationMs: 200, coordinatedMotion: true };
let now = 1000;
const motionAnimateParam=(id,onFinish)=>({id,onFinish});
const animations=[];const UI={animateTo:(p,change)=>{animations.push(p);change();}};
const Host=productionMotionMethods(feature('reading/LocalReadingExperience.ets'),
 ['performContinuousPageTurn','onReaderBookmarkGestureReleased','finishBookmarkRollback','reconcilePageBookmarkFeedback'],
 {motionAnimateParam,completeReaderPageGestureSettlement:S=>({...S,phase:'idle',owner:'none'})});
for(const reduceMotion of [false,true]){
 const requests=[];
 const host=Object.assign(new Host(),{mounted:true,exitRequested:false,appForeground:true,phase:'ready',
  chapter:{chapterIndex:1},continuousFragments:[{}],continuousCommitInFlight:false,reduceMotion,
  controlVisible:()=>false,isContinuousScrollerAtStart:()=>false,isContinuousScrollerAtEnd:()=>false,
  continuousScroller:{scrollPage:p=>requests.push(p)},getUIContext:()=>UI,bookmarkRollbackGeneration:0,
  bookmarkPageOffsetY:30,bookmarkPreviewChanged:true,pageTurnGestureState:{owner:'bookmark',phase:'settling'},
  // This motion-only probe starts after the page/segment admission covered by
  // test-reader-bookmark-top-info; keep that admitted context explicit.
  bookmarkGestureAnchor:'reader:motion',bookmarkPendingTarget:'',
  isReaderBookmarkGestureCurrent:()=>true,bookmarkFeedbackOwnerKey:()=> 'reader:motion',
  bookmarkPreviewStatus:'empty',currentPageBookmarkStatus:()=> 'empty',
  flushDeferredPageChromeState:()=>{},drainPageTurnPreparationQueue:()=>{}});
 assert.equal(host.performContinuousPageTurn('next').kind,'started');
 assert.equal(requests[0].animation,!reduceMotion);
 const count=animations.length;host.onReaderBookmarkGestureReleased(false);
 if(reduceMotion){assert.equal(animations.length,count);assert.equal(host.pageTurnGestureState.phase,'idle');}
 else {const finish=animations.at(-1).onFinish;host.bookmarkRollbackGeneration++;host.bookmarkPageOffsetY=45;
  finish();assert.equal(host.bookmarkPageOffsetY,45,'old rollback cannot clear new gesture');}
}

}

async function case_shelf_reversal_fixture() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const S = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
const { ReaderControlRuntime } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlRuntime.ts');
const { ReversibleMotionTimeline, motionSegment } = await import('../entry/src/main/ets/ui/foundation/MotionTimeline.ts');
const { MotionPointTrack } = await import('../entry/src/main/ets/ui/foundation/MotionPointTrack.ts');
const feature = name => new URL(`../entry/src/main/ets/features/${name}`, import.meta.url);
const linear = p => p;
const curve = { interpolate: linear };
const config = { axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 },
  tapMaxDurationMs: 500, directionSlopVp: 8, settleDurationMs: 320, showDurationMs: 220,
  dismissDurationMs: 200, coordinatedMotion: true };
let now = 1000;
let animations=[], frames=[];
const UI={animateTo:(p,change)=>{animations.push(p);change();},postFrameCallback:f=>frames.push(f.fn)};
const motionAnimateParam=(id,onFinish)=>({id,onFinish});
class Callback {constructor(fn){this.fn=fn;}}
const shelfFile=feature('bookshelf/ui/BookshelfPage.ets');
const shelfNames=['setViewMode','onReduceMotionChanged','startViewSwitch','scheduleViewSwitchFrame',
 'sampleViewSwitch','resetViewSwitchMotion','setRestingProjectionOpacity','projectionListProgress','fadeViewSwitch'];
const { READER_SHELF_REFLOW_MS, READER_SHELF_STAGGER_MS, READER_SHELF_STAGGER_CAP_MS, READER_REDUCED_FADE_MS } =
 await import('../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts');
const { READER_BOOK_OPEN_MS, READER_BOOK_CLOSE_MS } = await import('../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts');
const { bookshelfMotionPaint } = await import('../entry/src/main/ets/features/bookshelf/presentation/BookshelfNavigationMotion.ts');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedMembers, boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const actorSource = readFileSync(feature('bookshelf/ui/BookshelfNavigationTransition.ets'), 'utf8');
const actorSdk = boundedSurfaceSdk();
const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const compiler = installedEtsCompiler();
compiler.require(compiler.root + '/lib/validate_ui_syntax.js').observedClassCollection.add('BookshelfNavigationPaint');
const shelfPaint = actorSdk.properties.sdk.ObservedObject.createNew({
  opening: { readerOpacity: 0, shelfOpacity: 1, shelfScale: 1, shelfBrightness: 1 },
}, undefined);
const layerName = 'BookshelfNavigationPaintSurface';
const layer = actorSdk.consumer(actorSource, boundedMembers(actorSource, layerName), {
  SynchedPropertyNesedObjectPU: actorSdk.properties.sdk.SynchedPropertyNestedObjectPU,
}, { paint: shelfPaint, content: () => {} }, layerName);
layer.initialRender();
const shelfStack = [...layer.nodes.values()].find(node => node.type === 'Stack');
assert.equal(shelfStack.opacity, 1);
shelfPaint.opening = { readerOpacity: .4, shelfOpacity: .7, shelfScale: .98, shelfBrightness: .8 };
actorSdk.properties.flush();
assert.equal(shelfStack.opacity, .7, 'the paint carrier updates the same shelf stack directly');
assert.deepEqual(shelfStack.scale, { x: .98, y: .98 });
assert.equal(shelfStack.brightness, .8);
assert.equal(actorSdk.properties.updates.length, 0, 'painting the shelf does not publish child props');
const actorName = 'BookshelfNavigationTransition';
const coverActor = createReaderBuilderProbe(actorSource, boundedMembers(actorSource, actorName), {
  ...actorSdk.deps, uiContext: UI, ReversibleMotionTimeline, motionSegment, readerMotionNowMs: () => now,
  bookshelfMotionPaint, READER_BOOK_OPEN_MS, READER_BOOK_CLOSE_MS, READER_REDUCED_FADE_MS,
  STANDARD: curve, FADE: curve, CLOSE_HANDOFF_FRACTION: .28,
  BookshelfNavigationFrameCallback: Callback,
}, { ...actorSdk.hooks, componentName: actorName }).owner;
const origin = {sourceId:'source',bookId:'book',coverUrl:'',title:'Book',rect:{x:10,y:20,width:80,height:120},radius:8};
const target = {x:0,y:0,width:390,height:844};
const receipts = [];
Object.assign(coverActor, {
  request: {id:1,direction:'open',origin,target},
  onOpeningPaint: (id, paint) => receipts.push(['paint', id, paint]),
  onCovered: id => receipts.push(['cover', id]),
  onFinished: id => receipts.push(['finished', id]),
});
coverActor.aboutToAppear();
assert.deepEqual(receipts, [], 'seeding the opening actor never writes the Index owner during render');
now += 280; frames.shift()();
assert.equal(coverActor.sampledPhase, 0, 'startup layout cannot consume any authored opening frames');
assert.deepEqual(receipts.map(([action, id]) => [action, id]), [['paint', 1]]);
now += 16; frames.shift()();
assert.equal(coverActor.sampledPhase, 16 / READER_BOOK_OPEN_MS);
assert.ok(receipts.at(-1)[2].readerOpacity > 0);
coverActor.reduceMotion = true; coverActor.onReduceMotionChanged();
assert.equal(receipts.length, 2, 'a reduced-motion Prop update also defers opening paint');
now += 200; frames.shift()(); frames.shift()();
assert.equal(receipts.at(-1)[0], 'paint', 'reduced motion also starts with the first actual frame');
now += READER_REDUCED_FADE_MS; frames.shift()();
assert.deepEqual(receipts.at(-1), ['finished', 1]);
coverActor.reduceMotion = false;
coverActor.request = {id:2,direction:'close',origin,target,awaitingTarget:true};
coverActor.onRequestChanged();
now += READER_BOOK_CLOSE_MS; frames.shift()();
assert.deepEqual(receipts.at(-1), ['finished', 1], 'first close frame also rebases');
now += READER_BOOK_CLOSE_MS; frames.shift()();
assert.deepEqual(receipts.at(-1), ['cover', 2]);
assert.ok(Math.abs(coverActor.sampledPhase - .72) < 1e-8);
coverActor.request = {...coverActor.request,awaitingTarget:false}; coverActor.onRequestChanged();
assert.deepEqual(receipts.at(-1), ['cover', 2], 'a same-request target Prop change cannot finish into Index synchronously');
now += 500; frames.shift()();
assert.deepEqual(receipts.at(-1), ['cover', 2], 'shelf target wait cannot consume the remaining close');
now += Math.ceil(READER_BOOK_CLOSE_MS * .72); frames.shift()();
assert.deepEqual(receipts.at(-1), ['finished', 2]);

coverActor.request = {id:3,direction:'open',origin,target};
coverActor.onRequestChanged();
frames.shift()();
now += 80; frames.shift()();
const precedingAngle = coverActor.coverAngle;
coverActor.request = {id:4,direction:'close',origin,target,awaitingTarget:true};
coverActor.onRequestChanged();
now += 220; frames.shift()(); frames.shift()();
assert.deepEqual(receipts.at(-1), ['cover', 4]);
assert.ok(Math.abs(coverActor.sampledPhase - .2) < 1e-8, 'reversal waits at its prior visible phase');
assert.ok(Math.abs(coverActor.coverAngle - precedingAngle) < 1e-8);
coverActor.request = {...coverActor.request,awaitingTarget:false}; coverActor.onRequestChanged();
now += 220; frames.shift()();
assert.equal(coverActor.curtainOpacity, 1);
now += 70; frames.shift()();
assert.deepEqual(receipts.at(-1), ['finished', 4]);
const Shelf=productionMotionMethods(shelfFile,shelfNames,{readerMotionNowMs:()=>now,ReversibleMotionTimeline,
 motionSegment,bookshelfViewCoverDelayMs:i=>Math.min(i*READER_SHELF_STAGGER_MS,READER_SHELF_STAGGER_CAP_MS),
 readerMotionReducedFadeParam:()=>({duration:READER_REDUCED_FADE_MS}),BookshelfMotionFrameCallback:Callback});
const viewMotion={totalMs:READER_SHELF_REFLOW_MS,layoutCommitMs:0,outgoingDurationMs:120,
 headerIncomingStartMs:0,headerIncomingDurationMs:120,contentIncomingStartMs:0,contentIncomingDurationMs:120,
 morphCoverIncomingStartMs:260,morphCoverIncomingDurationMs:60,movingCoverFadeStartMs:260,movingCoverFadeDurationMs:60,
 coverMoveDurationMs:200,coverScaleDurationMs:200,coverMoveCurve:curve,coverScaleCurve:curve,contentCurve:curve,coverFadeCurve:curve};
for(const at of [12,60,150,290]){
 frames=[];const shelf=Object.assign(new Shelf(),{viewMode:'cover',reduceMotion:false,viewSwitchRunning:false,viewSwitchToken:0,
  webDavCredentials:{saveBookshelfViewMode:async()=>{}},viewModeHost:{canSave:()=>true},persistRequestedViewMode:async()=>true,viewModeRevision:0,confirmedViewMode:'cover',mounted:true,
  feedbackEnabled:true,isCurrentShelfInput:()=>true,isShelfPresentationCurrent:()=>true,
  viewSwitchRanks:new Map([[1,1]]),captureViewSwitchRanks(){},settleFilterPanel(){},
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
 assert.equal(animations.at(-1).duration,READER_REDUCED_FADE_MS,'reduced reflow fades without keeping geometry frames alive');
 frames.shift()();assert.equal(frames.length,0,'old shelf callback revoked');
}

let point=new MotionPointTrack({x:0,y:0},{x:100,y:200},0,120);
const held=point.sample(60,linear);assert.deepEqual(held,{x:50,y:100});
point=new MotionPointTrack(held,{x:0,y:0},60,160);
assert.deepEqual(point.sample(60,linear),held);assert.deepEqual(point.sample(220,linear),{x:0,y:0});

}

const implementations = {'runtime-panel-clock':case_runtime_panel_clock,'select-appearance-owner':case_select_appearance_owner,'continuous-bookmark-owner':case_continuous_bookmark_owner,'shelf-reversal-fixture':case_shelf_reversal_fixture};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}

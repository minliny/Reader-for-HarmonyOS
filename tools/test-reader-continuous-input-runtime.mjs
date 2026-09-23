import assert from 'node:assert/strict';
import { observeReaderProgressOperation, reconcileReaderControlSelectionProgress } from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const InputClock = productionMotionMethods(new URL('ReaderPageInputClock.ts', reading), ['sample']);
class Clock extends InputClock { constructor() { super(); Object.assign(this, { initialized:false,lastNativeMs:-1,lastReceivedMs:0,timeMs:0,nativeOffsetMs:0,rebase:false,resetVelocity:false }); } }
let receivedMs = 1000;
const TouchType = { Down: 0, Move: 1, Up: 2, Cancel: 3 };
const Stage = productionMotionMethods(new URL('ReaderContinuousReadingStage.ets', reading),
  ['handleTouch', 'resetTouch', 'reportManualInteraction', 'reportVisibleRange', 'reportCurrentVisibleRange', 'handleStationaryTap', 'cancelInitialScrollForInput'],
  { TouchType, CONTINUOUS_TAP_SLOP: 12, ReaderPageInputClock: Clock, readerMotionNowMs: () => receivedMs, READER_PAGE_GESTURE_LONG_PRESS_MS: 500 });
let interaction = 0, boundary = 0, rectY = -20;
const reports = [];
const stage = Object.assign(new Stage(), {
  layout: { contentTop: 0 }, mounted: true, interactionEnabled: true, touchActive: false, touchPointerId: -1,
  initialScrollPending: false, visibleFragmentStart: 0, visibleFragmentEnd: 0,
  paragraphPositions: new Map(), appearance: {paragraphSpacing:0},
  fragmentsProvider: () => [{ startScalar: 0, endScalar: 100 }], hasTitleItem: () => false,
  listScroller: { getItemRect: () => ({ y: rectY, height: 200 }) },
  onVisibleRangeChanged: (...args) => reports.push(args),
  onPointerStart: () => true, onPointerEnd() {},
  onManualInteraction: () => interaction++, onBoundaryDrag: () => boundary++,
  isScrollerAtEnd: () => true, isScrollerAtStart: () => true,
});
const touch = (type, id, x, y) => ({ type, changedTouches: [{ id, x, y }], touches: [{ id, x, y }] });
stage.handleTouch(touch(TouchType.Down, 1, 100, 200));
stage.handleTouch(touch(TouchType.Down, 2, 300, 700));
stage.handleTouch(touch(TouchType.Move, 2, 100, 0));
stage.handleTouch(touch(TouchType.Up, 2, 100, 0));
assert.equal(stage.touchPointerId, 1, 'a second finger cannot replace or end the active pointer');
assert.equal(interaction, 0); assert.equal(boundary, 0);
stage.handleTouch(touch(TouchType.Up, 1, 100, 100));
assert.equal(boundary, 1); assert.equal(stage.touchActive, false);
stage.reportCurrentVisibleRange(); rectY = -120; stage.reportCurrentVisibleRange();
assert.deepEqual(reports, [[0, 0, .1], [0, 0, .6]], 'same-row scrolling refreshes the intra-fragment anchor');

class CoreReadingAnchor { constructor(chapterIndex, chapterOffset, chapterProgress) { Object.assign(this, { chapterIndex, chapterOffset, chapterProgress }); } }
const Owner = productionMotionMethods(new URL('LocalReadingExperience.ets', reading),
  ['commitContinuousProgress', 'drainContinuousProgress', 'persistContinuousProgress', 'reconcileContinuousUnknownProgress'],
  { CoreReadingAnchor, observeReaderProgressOperation, reconcileReaderControlSelectionProgress, hilog: { error() {} } });
let completeFirst;
const firstWrite = new Promise(resolve => { completeFirst = resolve; });
const writes = [];
const chapter = { chapterIndex: 2, chapterTitle: 'Chapter' };
const owner = Object.assign(new Owner(), {
  phase: 'ready', chapter, chapterLayoutMap: { scalarCount: () => 100 },
  chapterSelectionToken: 7, materializedChapterSelectionToken: 7,
  readerSettingsSnapshot: { navigationMode: 'continuous' }, continuousFragments: [{}],
  continuousVisibleScalar: 10, continuousProgressRevision: 1, sourceId: 's', bookId: 'b',
  continuousCommitPending: false, continuousCommitInFlight: false,
  isMountedToken: () => true, coreLayout: () => ({}), onAutoPagePageCommitted() {},
  admitCommittedProgress(value) { this.lastCommittedProgress = value; }, drainRapidPageTurn() {},
  activeGateway: () => ({ runProgressCommitSerial: fn => fn(),
    resolveAndUpdateProgress: async (_book, _title, anchor) => {
      writes.push(anchor.chapterOffset); if (writes.length === 1) await firstWrite;
      return { sourceId: 's', bookId: 'b', ...anchor };
    } }),
});
const inFlight = owner.commitContinuousProgress(1);
owner.continuousVisibleScalar = 65; owner.continuousProgressRevision++;
let exitDone = false;
const exitFlush = owner.commitContinuousProgress(1).then(() => { exitDone = true; });
await Promise.resolve(); assert.equal(exitDone, false, 'exit waits for an existing write and its newest trailing anchor');
completeFirst(); await Promise.all([inFlight, exitFlush]);
assert.deepEqual(writes, [10, 65]); assert.equal(owner.lastCommittedProgress.chapterOffset, 65);
assert.equal(owner.continuousCommitInFlight, false);
console.log('continuous production pointer, same-row anchor and trailing exit commit: PASS');
const ImageStage=productionMotionMethods(new URL('ReaderContinuousReadingStage.ets',reading),['onContentRevisionChanged','restoreImageAnchor','onContentScrolled'],{ContinuousLayoutFrame:class{constructor(action){this.action=action;}},ScrollState:{Idle:0,Scroll:1,Fling:2}});
for(const currentImage of [false,true]){
 const frames=[],deltas=[];let y=-50,height=100;
 const data=[{id:'above'},{id:'anchor'}];const imageStage=Object.assign(new ImageStage(),{layout:{contentTop:0},mounted:true,initialScrollPending:false,changedFragmentIndex:currentImage?1:0,visibleFragmentStart:1,imageAnchorGeneration:2,
 titleItemCount:0,continuousListItems:()=>data,fragmentsProvider:()=>data,fragmentDataSource:{getData:i=>data[i],extend:()=>false,update(){},replace(){}},hasTitleItem:()=>false,listScroller:{getItemRect:()=>({y,height}),scrollBy:(_x,d)=>{deltas.push(d);y-=d;}},reportCurrentVisibleRange(){},getUIContext:()=>({postFrameCallback:f=>frames.push(f)})});
 imageStage.onContentRevisionChanged();imageStage.onContentRevisionChanged();assert.equal(frames.length,1,'a batch retains one pre-layout semantic anchor');
 imageStage.onContentScrolled(20,1);y-=20;if(currentImage)height=200;else y+=100;
 frames[0].action();assert.deepEqual(deltas,[currentImage?50:100]);assert.equal(y,currentImage?-120:-70,'image correction preserves simultaneous manual displacement');
}
console.log('production batched image reflow preserves leading fragment fraction and concurrent scroll: PASS');

const StyleOwner=productionMotionMethods(new URL('LocalReadingExperience.ets',reading),['changeReaderPageTurnStyle']);
for(const invalidation of ['none','new-style','exit','failure']) {
 let release,reject;const pending=new Promise((resolve,fail)=>{release=resolve;reject=fail;});const applied=[],toasts=[];let sampled=0;
 const o=Object.assign(new StyleOwner(),{pageStyleChangeGeneration:0,lifecycleToken:1,readerSettingsSnapshot:{navigationMode:'continuous'},continuousAnchorSampler:()=>sampled++,commitContinuousProgress:()=>pending,isSessionActive:()=>invalidation!=='exit',getUIContext:()=>({getPromptAction:()=>({showToast:t=>toasts.push(t)})})});
 o.changeReaderPageTurnStyle=(style,saved)=>applied.push([style,saved]);
 StyleOwner.prototype.changeReaderPageTurnStyle.call(o,'slide');assert.equal(sampled,1);assert.equal(applied.length,0);
 if(invalidation==='new-style')o.pageStyleChangeGeneration++;
 if(invalidation==='failure')reject(Error('disk full'));else release();
 await new Promise(r=>setImmediate(r));
 assert.equal(applied.length,invalidation==='none'?1:0,'switch waits for saved latest anchor and matching mode/lifecycle');assert.equal(toasts.length,invalidation==='failure'?1:0);
}
const StopOwner=productionMotionMethods(new URL('LocalReadingExperience.ets',reading),['onContinuousScrollStopped']);
let finishStop;let consumed=0;const stop=Object.assign(new StopOwner(),{rapidPageTurnState:{inFlightDirection:'next'},lifecycleToken:1,chapterSelectionToken:2,pageTurnTransactionSerial:3,commitContinuousProgress:()=>new Promise(r=>finishStop=r),isMountedToken:()=>true,completeRapidPageTurnTransaction:()=>consumed++,drainRapidPageTurn(){}});
stop.onContinuousScrollStopped();stop.pageTurnTransactionSerial++;finishStop();await new Promise(r=>setImmediate(r));assert.equal(consumed,0,'late saved stop cannot consume a newer rapid transaction');
console.log('continuous mode change save/error/obsolete ownership and late stop receipt: PASS');

// Initial geometry/attach ordering and stale receipts are covered by the
// production-method suite test-reader-continuous-initial-offset.mjs. Keep
// this suite focused on real input and progress serialization.

const ProjectionOwner = productionMotionMethods(new URL('LocalReadingExperience.ets', reading),
  ['hasContinuousRenderContent']);
let revisionReads = 0;
const projection = Object.assign(new ProjectionOwner(), { continuousFragments: [] });
Object.defineProperty(projection, 'continuousRenderRevision', { get() { revisionReads++; return 1; } });
assert.equal(projection.hasContinuousRenderContent(), false);
assert.equal(revisionReads, 1, 'even the empty fallback subscribes to the only reactive projection version');
projection.continuousFragments = [{}];
assert.equal(projection.hasContinuousRenderContent(), true);
assert.equal(revisionReads, 2, 'the ready List and disabled paged overlay consume the new projection together');
console.log('production continuous cold-entry projection branch observes its reactive revision: PASS');

// The independent geometry oracle is a 4059px row with 400 scalar cells.
// Saving/reopening a stable physical viewport must not ratchet backwards.
const QuantizedOwner = productionMotionMethods(new URL('LocalReadingExperience.ets', reading),
  ['onContinuousVisibleRangeChanged', 'setContinuousInitialAnchor']);
const quantized = Object.assign(new QuantizedOwner(), {
  readerSettingsSnapshot: { navigationMode: 'continuous' },
  continuousFragments: [{ startScalar: 100, endScalar: 500 }],
  continuousProgressRevision: 0, chapterLayoutMap: { scalarCount: () => 1000 },
  resolveVisibleContinuousImages() {}, continuousFragmentIndexForScalar: () => 0,
});
for (const initialPixels of [308, 416, 1119, 1998, 3062]) {
  let pixels = initialPixels;
  let saved;
  for (let reopen = 0; reopen < 100; reopen++) {
    quantized.onContinuousVisibleRangeChanged(0, 0, pixels / 4059);
    if (saved !== undefined) assert.equal(quantized.continuousVisibleScalar, saved,
      'integer pixel layout must not move the canonical scalar on repeated reopen');
    saved = quantized.continuousVisibleScalar;
    quantized.setContinuousInitialAnchor(saved);
    pixels = Math.round(quantized.continuousInitialFragmentProgress * 4059);
    assert.ok(Math.abs(pixels - initialPixels) <= 4059 / 400 / 2 + .5,
      'nearest canonical anchor has at most half-cell plus half-pixel error');
  }
}
console.log('continuous scalar quantization: five positions, 100 repeat round trips each: PASS');

const MissingGeometryStage = productionMotionMethods(new URL('ReaderContinuousReadingStage.ets', reading),
  ['reportVisibleRange']);
for (const missing of ['zero', 'throw']) {
  const saved = [];
  const stage = Object.assign(new MissingGeometryStage(), {
    initialScrollPending: false, fragmentsProvider: () => [{}], hasTitleItem: () => false,
    listScroller: { getItemRect() { if (missing === 'throw') throw Error('row not ready'); return { y: 0, height: 0 }; } },
    onVisibleRangeChanged: (...args) => saved.push(args),
  });
  stage.reportVisibleRange(0, 0);
  assert.deepEqual(saved, [], 'unmeasured/recycled geometry cannot overwrite a real saved anchor with zero');
}
console.log('continuous restore suppresses premature stops and unknown-geometry progress writes: PASS');

const RestoreStage = productionMotionMethods(new URL('ReaderContinuousReadingStage.ets', reading),
 ['scheduleInitialScroll','tryApplyInitialScroll','confirmInitialScroll','initialListIndex','onListAttached','releaseInitialParagraph','onContentScrollStopped'],
 {ContinuousLayoutFrame:class{constructor(action){this.action=action;}},ScrollAlign:{START:0},LengthMetrics:{vp:value=>({value,unit:'vp'})},
 prepareReaderNativeParagraph:context=>({resource:{},owned:false,position:context.position})});
// Regression from VM: row top 207px is 45px above the 252px content edge,
// despite its positive List-relative y. Clamping -y/height loses that anchor.
for (const top of [252, 207, 1, -3242]) {
  let y = top / 3.5; const height = 4059 / 3.5;
  const frames = []; let savedProgress;
  const nativeOffset = (252 - top) / 3.5;
  const lineScalar = new Map([[252, 100], [207, 113], [1, 158], [-3242, 382]]).get(top);
  const fragment = { id: 'inset-native', text: '正文', startScalar: 100, endScalar: 500,
    isParagraphStart: true, nativeParagraph: { key: 'inset-owner' } };
  const position = { scalarForY: offset => {
    assert.ok(Math.abs(offset - nativeOffset) < 1e-10); return lineScalar;
  }, yForScalar: scalar => { assert.equal(scalar, lineScalar); return nativeOffset; } };
  const inset = Object.assign(new RestoreStage(), {
    mounted: true, listAttached: false, listMountIdentity:'', initialAnchorRevision:1,chapterIdentity:'c',geometryKey:'g',initialScrollGeneration: 0, initialFragmentIndex: 0,
    paragraphPositions: new Map([['inset-native', position]]), paragraphPositionOwners: new Map([['inset-native', 'inset-owner']]),
    appearance: {paragraphSpacing:0},
    layout: { contentTop: 72 }, fragmentsProvider: () => [fragment], hasTitleItem: () => false,
    getUIContext: () => ({position, postFrameCallback: f => frames.push(f) }),
    listScroller: { getItemRect: () => ({ y, height }),
      scrollToIndex(_index, _animated, _align, options) { y = 72 - options.extraOffset.value; },
      scrollBy() { assert.fail('initial native line restoration uses no relative correction'); } },
    reportCurrentVisibleRange() {}, onScrollStopped() {},
    initialScrollPending: false, onVisibleRangeChanged(_start, _end, progress) { savedProgress = progress; },
  });
  Stage.prototype.reportVisibleRange.call(inset, 0, 0);
  assert.equal(savedProgress, (lineScalar - 100) / 400, 'reported progress is native line scalar, not row-height fraction');
  inset.initialFragmentProgress = savedProgress;
  inset.scheduleInitialScroll(); inset.onListAttached(inset.listMountIdentity); while (frames.length) frames.shift().action();
  assert.ok(Math.abs(y * 3.5 - top) < 1e-8, 'positive/negative List y restores the same content-edge anchor');
}
console.log('continuous padded viewport: native line offsets at START, positive y and negative y round trips: PASS');

{
  const fragment={id:'native',startScalar:100,endScalar:300,nativeParagraph:{},isParagraphStart:true};
  const saved=[];
  const native=Object.assign(new Stage(),{layout:{contentTop:72},appearance:{paragraphSpacing:12},
    initialScrollPending:false,fragmentsProvider:()=>[fragment],hasTitleItem:()=>false,
    paragraphPositions:new Map([['native',{scalarForY:y=>{assert.equal(y,60);return 123;}}]]),
    listScroller:{getItemRect:()=>({y:12,height:1000})},onVisibleRangeChanged:(...args)=>saved.push(args)});
  native.reportVisibleRange(0,0);
  assert.deepEqual(saved,[[0,0,23/200]],'progress uses original line scalar, not 60/1000 pixel fraction');
  native.paragraphPositions.clear();native.reportVisibleRange(0,0);
  assert.equal(saved.length,1,'unmounted text geometry cannot replace the saved position');
}

const LeaseOwner = productionMotionMethods(new URL('LocalReadingExperience.ets', reading),
  ['acquirePagePointer', 'releasePagePointer', 'drainRapidPageTurn', 'performPageTurn'],
  { setTimeout: action => deferred.push(action) });
const LeaseStage = productionMotionMethods(new URL('ReaderContinuousReadingStage.ets', reading),
  ['handleTouch', 'resetTouch', 'onInteractionEnabledChanged', 'reportManualInteraction', 'cancelInitialScrollForInput'],
  { TouchType, CONTINUOUS_TAP_SLOP: 12, ReaderPageInputClock: Clock, readerMotionNowMs: () => receivedMs, READER_PAGE_GESTURE_LONG_PRESS_MS: 500 });
let deferred = [];
for (const ending of ['up', 'cancel', 'disabled', 'unmount']) {
  const events = []; deferred = [];
  const owner = Object.assign(new LeaseOwner(), { mounted: true, lifecycleToken: 1,
    activePagePointerId: -1, pagePointerEpoch: 0, isReaderPageInteractionEnabled: () => true,
    controlVisible: () => false, exitRequested: false, interactionBlocked: false, controlObscured: false,
    drainRapidPageTurn: () => events.push('rapid'), resumePendingAutoPageTurn: () => events.push('auto'),
    drainPageTurnPreparationQueue: () => events.push('prepare'),
  });
  const list = Object.assign(new LeaseStage(), { interactionEnabled: true, touchActive: false,
    touchPointerId: -1, onPointerStart: id => owner.acquirePagePointer(id),
    onPointerEnd: id => owner.releasePagePointer(id), onManualInteraction() {}, onBoundaryDrag() {},
    isScrollerAtStart: () => false, isScrollerAtEnd: () => false });
  list.handleTouch(touch(TouchType.Down, 8, 200, 200));
  assert.equal(owner.activePagePointerId, 8, 'native List DOWN registers the shared owner before any MOVE');
  for (const direction of ['next', 'previous']) {
    assert.equal(LeaseOwner.prototype.drainRapidPageTurn.call(owner).kind, 'busy');
    assert.equal(LeaseOwner.prototype.performPageTurn.call(owner, direction).kind, 'busy');
  }
  list.handleTouch(touch(TouchType.Down, 9, 220, 220));
  list.handleTouch(touch(TouchType.Up, 9, 220, 220));
  assert.equal(owner.activePagePointerId, 8, 'extra finger cannot release continuous ownership');
  if (ending === 'disabled') { list.interactionEnabled = false; list.onInteractionEnabledChanged(); }
  else if (ending === 'unmount') list.resetTouch();
  else list.handleTouch(touch(ending === 'up' ? TouchType.Up : TouchType.Cancel, 8, 200, 200));
  assert.equal(owner.activePagePointerId, -1);
  list.resetTouch(); assert.equal(deferred.length, 1, 'terminal cleanup releases exactly once');
  assert.deepEqual(events, [], 'older queued work cannot run inside UP/CANCEL');
  if (ending === 'up') {
    list.handleTouch(touch(TouchType.Down, 10, 200, 200));
    deferred.shift()(); assert.deepEqual(events, [], 'a newer native List DOWN wins an old release task');
    list.resetTouch();
  }
  deferred.shift()(); assert.deepEqual(events, ['rapid', 'auto', 'prepare']);
}
console.log('native List shared pointer ownership: quiet DOWN, extra finger, UP/CANCEL/disable/unmount, late drain: PASS');

const ImageRowKey=productionMotionMethods(new URL('ReaderContinuousReadingStage.ets',reading),['fragmentRenderKey']);
const rowOwner=Object.assign(new ImageRowKey(),{chapterIdentity:'chapter-1-v1'});
const textRow={id:'text-1',text:'body',imageHeight:0};
const pendingRow={id:'image-1',text:'',imageHeight:35};
const decodedRow={...pendingRow,fileUri:'file:///cache/validated-hash.png',imageHeight:201};
const cachedBranches=new Map();
const buildBranch=row=>{const key=rowOwner.fragmentRenderKey(row);if(!cachedBranches.has(key))cachedBranches.set(key,row.fileUri?'Image':row.text?'Text':'Blank');return cachedBranches.get(key);};
assert.equal(buildBranch(pendingRow),'Blank');assert.equal(buildBranch(decodedRow),'Image','same semantic image may not reuse its unloaded Blank branch');
assert.equal(rowOwner.fragmentRenderKey({...decodedRow}),rowOwner.fragmentRenderKey(decodedRow));
assert.equal(rowOwner.fragmentRenderKey({...textRow}),rowOwner.fragmentRenderKey(textRow),'unchanged text retains native row identity');
assert.notEqual(rowOwner.fragmentRenderKey({...decodedRow,fileUri:'file:///cache/new-hash.png'}),rowOwner.fragmentRenderKey(decodedRow));
console.log('production continuous image row identity: decoder admission replaces placeholder, unchanged siblings retained: PASS');

for (const nativeTime of [true, false]) {
  for (const duration of [100, 499, 500, 6000]) {
    let taps = 0, releases = 0;
    stage.layout.viewportWidth = 360; stage.onTurn = () => taps++;
    stage.onPointerEnd = () => releases++;
    receivedMs = 1000;
    const down = touch(TouchType.Down, 1, 340, 200); down.timestamp = nativeTime ? 1000000000 : NaN;
    stage.handleTouch(down); receivedMs += duration;
    const up = touch(TouchType.Up, 1, 340, 200); up.timestamp = nativeTime ? receivedMs * 1000000 : NaN;
    stage.handleTouch(up);
    stage.handleStationaryTap({ fingerList: [{ localX: 340 }] });
    stage.handleStationaryTap({ fingerList: [{ localX: 340 }] });
    assert.equal(taps, duration < 500 ? 1 : 0, 'short tap once; stationary long hold never synthesizes an extra turn');
    assert.equal(releases, 1, 'long-press suppression still releases the shared pointer');
  }
}
console.log('continuous short tap and stationary long UP share paged 500ms clock boundary: PASS');

const CanonicalModeOwner = productionMotionMethods(new URL('LocalReadingExperience.ets', reading),
  ['beginCanonicalModeMeasurement', 'continueCanonicalModeMeasurement']);
for (const known of ['manifest', 'prefix', 'partial-prefix', 'cold', 'foreign-prefix']) {
  const measurements = [];
  const prefix = { matches: () => known !== 'foreign-prefix', startsAtRequest: () => true,
    containsAnchor: () => known === 'prefix', pageStartScalars: () => [0, 161],
    pageIndexAtOrBefore: () => 1, nextRequestScalar: () => known === 'prefix' ? 384 : 161 };
  const o = Object.assign(new CanonicalModeOwner(), {
    lifecycleToken: 1, paragraphRanges: [{ startScalar: 0 }], paginationDraft: known.includes('prefix') ? prefix : undefined,
    currentPaginationKey: () => ({}), lastMeasurableScalar: () => 999,
    requireChapterLayoutMap: () => ({ scalarCount: () => 1000 }),
    paginationIndex: { findContainingPage: () => known === 'manifest' ? { startScalar: 161 } : undefined },
    beginMeasurement() { measurements.push(this.desiredChapterOffset); },
  });
  o.beginCanonicalModeMeasurement(189);
  assert.deepEqual(measurements, [known === 'manifest' || known.includes('prefix') && known !== 'foreign-prefix' ? 161 : 0]);
  if (known === 'manifest' || known === 'prefix') {
    assert.equal(o.canonicalModeAnchor, -1);
    assert.equal(o.continueCanonicalModeMeasurement({ startScalar: 161, endScalar: 384 }, 1), false);
  } else {
    assert.equal(o.canonicalModeAnchor, 189);
    if (known !== 'partial-prefix') {
      assert.equal(o.continueCanonicalModeMeasurement({ startScalar: 0, endScalar: 161 }, 1), true);
      assert.equal(measurements.at(-1), 161);
    }
    assert.equal(o.continueCanonicalModeMeasurement({ startScalar: 161, endScalar: 384 }, 1), false);
    assert.equal(o.canonicalModeAnchor, -1, 'only containing page can publish; no EOF scan required');
  }
}
console.log('continuous-to-paged anchor: warm/cold/partial/foreign layout, containing page only: PASS');

const { ReadingPaginationPrefix, ReadingPaginationIndex } = await import('../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts');
const gapKey = { sourceId: 'local', bookId: 'gap', chapterIndex: 0, contentVersion: '1', layoutSignature: 'exact-layout' };
const gapPrefix = new ReadingPaginationPrefix(gapKey, { requestScalar: 0, startScalar: 5, endScalarExclusive: 100 });
assert.equal(gapPrefix.admit({ requestScalar: 100, startScalar: 105, endScalarExclusive: 200 }), true);
const completeGap = new ReadingPaginationIndex();
completeGap.recordChapter({ key: gapKey, contentScalarLength: 300, pageStartScalars: [5, 105, 205] });
for (const target of [0, 3, 5, 99, 100, 102, 104, 105, 199]) {
  let requested = -1;
  const o = Object.assign(new CanonicalModeOwner(), {
    lifecycleToken: 1, paragraphRanges: [{ startScalar: 0 }], paginationDraft: gapPrefix,
    currentPaginationKey: () => gapKey, lastMeasurableScalar: () => 299,
    requireChapterLayoutMap: () => ({ scalarCount: () => 300 }),
    paginationIndex: new ReadingPaginationIndex(),
    beginMeasurement() { requested = this.desiredChapterOffset; },
  });
  o.beginCanonicalModeMeasurement(target);
  assert.equal(requested, completeGap.findContainingPage(gapKey, target).startScalar,
    'head-prefix whitespace and leading delimiters match complete canonical boundaries');
  assert.equal(o.canonicalModeAnchor, -1);
}
console.log('measured prefix whitespace gaps match complete canonical page identity: PASS');

const ProgrammaticScrollOwner = productionMotionMethods(new URL('LocalReadingExperience.ets', reading),
  ['performPageTurn', 'performContinuousPageTurn', 'onContinuousReachStart', 'onContinuousReachEnd', 'onContinuousManualInteraction']);
for (const direction of ['next', 'previous']) {
  let atEdge = false, scrolls = 0, chapters = 0;
  const o = Object.assign(new ProgrammaticScrollOwner(), {
    mounted: true, exitRequested: false, phase: 'ready', activePagePointerId: 9,
    readerSettingsSnapshot: { navigationMode: 'continuous' }, controlVisible: () => false,
    chapter: { chapterIndex: 3 }, continuousFragments: [{}], continuousCommitInFlight: false,
    continuousUserInteractionActive: true, continuousVisibleFragmentIndex: 0, continuousVisibleScalar: 100,
    isContinuousScrollerAtStart: () => direction === 'previous' && atEdge,
    isContinuousScrollerAtEnd: () => direction === 'next' && atEdge,
    adjacentChapterIndex: (_chapter, delta) => 3 + delta,
    openPageTurnChapter: () => { chapters++; return true; },
    turnToPreviousChapter: () => { chapters++; return true; }, onReaderManualInteraction() {},
    continuousScroller: { scrollPage() {
      scrolls++; atEdge = true;
      if (direction === 'next') o.onContinuousReachEnd(); else o.onContinuousReachStart();
    } },
  });
  assert.equal(o.performPageTurn(direction).kind, 'busy');
  assert.equal(scrolls, 0); assert.equal(o.continuousUserInteractionActive, true, 'held producer is not admitted');
  o.activePagePointerId = -1;
  assert.equal(o.performPageTurn(direction).kind, 'started');
  assert.equal(scrolls, 1); assert.equal(chapters, 0, 'queued one-viewport turn cannot become an extra manual chapter turn');
  assert.equal(o.continuousUserInteractionActive, false);
  assert.equal(o.performPageTurn(direction).kind, 'started');
  assert.equal(chapters, 1, 'a separate later turn at the edge can cross exactly one chapter');
  o.onContinuousManualInteraction();
  if (direction === 'next') o.onContinuousReachEnd(); else o.onContinuousReachStart();
  assert.equal(chapters, 2, 'a genuinely new manual scroll retains chapter-edge behavior');
}
console.log('native List queued programmatic scroll cannot inherit prior multi-finger manual chapter-edge ownership: PASS');

const Source=productionMotionMethods(new URL('ReaderContinuousReadingStage.ets',reading),
 ['totalCount','getData','registerDataChangeListener','unregisterDataChangeListener','replace','extend','update'],
 {DataOperationType:{ADD:'add'}});
{
 const source=Object.assign(new Source(),{items:[],listeners:[]}),events=[];
 source.registerDataChangeListener({onDataReloaded(){events.push('reload');},onDatasetChange(operations){events.push({operations,items:Array.from({length:source.totalCount()},(_,i)=>source.getData(i))});}});
 const body=[{id:'p40'},{id:'p80'}],title={id:'title'},prefix={id:'p0'},suffix={id:'p100'};
 source.replace(body);events.length=0;
 assert.equal(source.extend([title,prefix,...body,suffix]),true);
 assert.deepEqual(events.map(e=>e.operations),[[{type:'add',index:2,count:1}],[{type:'add',index:0,count:2}]]);
 assert.equal(events[0].items[0],body[0]);assert.equal(source.getData(2),body[0]);
 assert.equal(source.extend([title,prefix,{id:'p40'},body[1],suffix]),false,'a replacement cannot masquerade as a preserving insertion');
 assert.equal(source.getData(2),body[0]);
}
console.log('PASS native continuous insertion notifications preserve original rows and exact intermediate source state');

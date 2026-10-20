import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

async function runCase(selectedCase) {
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const { installReaderMeasurementOwner } = await import('./lib/reader-measurement-owner-fixture.mjs');
const { readFileSync, writeFileSync, mkdtempSync, rmSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { execFileSync } = await import('node:child_process');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { deriveReaderSessionCapsule } = await import('../entry/src/main/ets/features/reading/ReaderSessionCapsuleModel.ts');
const { buildReaderSessionLaunchGeometry, readerSessionLaunchDesign, sampleReaderSessionLaunch } = await import('../entry/src/main/ets/features/reading/ReaderSessionLaunchPresentation.ts');
const { ReaderSessionMorphSourceMeasurement } = await import('../entry/src/main/ets/features/reading/ReaderSessionMorphState.ts');
const pageGesture = await import('../entry/src/main/ets/features/reading/ReaderPageGestureState.ts');
const { ReaderPageInputClock } = await import('../entry/src/main/ets/features/reading/ReaderPageInputClock.ts');
const { completeReaderPageGestureSettlement } = await import('../entry/src/main/ets/features/reading/ReaderPageGestureState.ts');


let historyRoot;
try {
const require = createRequire(import.meta.url);
const sdk = (resolveEtsLoaderRoot());
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const historical = selectedCase === 'historical-projection';
const scope = historical ? 'visibility' : selectedCase;
const baseline = historical ? process.env.READER_CAPSULE_BASELINE : undefined;
const sourceOverride = historical ? process.env.READER_CAPSULE_SOURCE : undefined;
if (historical) assert.ok(baseline || sourceOverride, 'historical case requires an explicit diagnostic ref or source; never a release input');
let file = sourceOverride ?? new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
if (baseline && !sourceOverride) {
  historyRoot = mkdtempSync(join(tmpdir(), 'reader-ph109-'));
  file = join(historyRoot, 'LocalReadingExperience.ets');
  writeFileSync(file, execFileSync('git',
    ['show', `${baseline}:entry/src/main/ets/features/reading/LocalReadingExperience.ets`],
    { cwd: new URL('..', import.meta.url) }));
}
const source = readFileSync(file, 'utf8');
const tree = ts.createSourceFile(virtualFilePath('CapsuleSource.ets'), source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const component = tree.statements.find(node => node.members?.some(m => m.name?.getText(tree) === 'liveSessionCapsuleSnapshot'));
const member = name => component.members.find(node => node.name?.getText(tree) === name);
const observed = new Set(component.members.filter(node =>
  ts.getAllDecorators(node).some(d => /@(State|Prop|Link|StorageLink|StorageProp)\b/.test(d.getText(tree))))
  .map(node => node.name?.getText(tree)));
const projectionNames = ['shouldShowSessionCapsule', 'sessionCapsuleType', 'sessionCapsuleState',
  'sessionCapsuleCountdown', 'sessionCapsuleSnapshot', 'liveSessionCapsuleSnapshot', 'sessionLaunchBusinessStatus'];

// Isolate the exact production If subtree (not a rewritten condition). The SDK
// emits its real observer closures. The probe tests branch decisions/dependency
// reads; it makes no claim about native frame scheduling or compositor pixels.
let capsuleIf;
function visit(node) {
  if (ts.isIfStatement(node) && node.expression.getText(tree) ===
    'this.sessionLaunch === undefined && this.shouldShowSessionCapsule()') capsuleIf = node;
  ts.forEachChild(node, visit);
}
visit(member('build'));
assert.ok(capsuleIf);
const probeSource = `@Component struct CapsuleProbe {\n${projectionNames.map(n => member(n).getText(tree)).join('\n')}
  build() { ${capsuleIf.getText(tree)} }
}`;
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('ReaderSessionCapsule');
syntax.propCollection.set('ReaderSessionCapsule', new Set(['type', 'sessionState', 'countdown', 'interactionEnabled']));
class CapsuleChild {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}
class PreparedReaderPageTurn { constructor(...args) { this.args = args; } }
const Model = productionMotionMethods(file, [...projectionNames, 'beginMeasurement', 'completePreparedPageTurn',
  'pageChromeStateFrozen', 'flushDeferredPageChromeState', 'flushDeferredReadingImagePixels', 'pageTurnInputPhase',
  'onReaderPageGestureStateChanged', 'completeDirectPageTurnGesture'], {
  deriveReaderSessionCapsule, TextController: class {}, PreparedReaderPageTurn,
  readerPageTransitionUsesPreparedPages: () => false, completeReaderPageGestureSettlement,
});
const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); }
}
function fixture(type, status) {
  const chapter = { sourceId: 'local', bookId: 'capsule', content: 'body text', chapterIndex: 1, images: [] };
  const p = Object.assign(new Model(), {
    mounted: true, exitRequested: false, phase: 'ready', controlObscured: false, interactionBlocked: false,
    sessionLaunch: undefined, controlVisible: () => false, controlShellExitArmed: () => false,
    autoPageState: { status: type === 'autoPage' ? status : 'stopped', remainingSeconds: 8 },
    ttsState: { status: type === 'tts' ? status : 'idle' },
    visiblePage: { startScalar: 0 }, visibleFragments: [{ text: 'retained body' }],
    measurementBatch: [], measurementGeneration: 0, measurementEpoch: 0, readerSettingsSnapshot: { navigationMode: 'paged' },
    materializedChapterSelectionToken: 1, pageTurnGeneration: 1, lifecycleToken: 1,
    pageTurnGestureState: { phase: 'idle' }, pageTurnRenderRevision: 1, pageTurnFrozenRevision: -1,
    pageTurnSessionCapsuleFrozen: false, pageTurnSessionCapsuleSnapshot: undefined,
    isSessionActive: () => true, hasMeasuredViewport: () => true, isSelectionCurrent: () => true,
    measuringChapter: () => chapter, measuringRanges: () => [{ startScalar: 0, endScalar: 9 }],
    requireMeasurementLayoutMap: () => ({ scalarCount: () => 9, residentStart: () => 0, residentEnd: () => 9 }), lastMeasurableScalar: () => 8,
    measuringOffset: () => 0, setMeasuringOffset() {}, setMeasuringProgress() {}, setMeasuringRequestedAnchor() {},
    rangeIndexForOffset: () => 0, resetPendingPage() {}, prepareNextMeasurementBatch: () => true,
    armMeasurementDeadline() {}, ensureFirstPageReadyDeadline() {}, fail(error) { throw error; },
    isMeasurementCurrent: () => true, captureMeasurementChapterContext: () => ({ chapter }), measurementPaginationKey: () => ({}),
    geometryImageRequests: new Map(),
    finishAdjacentMeasurementContext() {}, releaseUnretainedReadingImages() {}, drainRapidPageTurn() {},
    resumePendingAutoPageTurn() {}, resumePagePreparationAfterTextureFrame() {},
    freezePageTurnProjection() {}, clearPageTurnProjection() {}, usesBookTurnSimulation: () => false,
    pageTurnOffsetX: 0, drainPageTurnPreparationQueue() {},
    admitPageChromeClock() {}, admitSessionCapsuleMeasurement() {},
  });
  p.automaticReadingState = () => p.autoPageState;
  return installReaderMeasurementOwner(p);
}
function nativeProjection(p) {
  const reads = new Map(), stack = [];
  const { owner } = createReaderBuilderProbe(probeSource, ['build', ...projectionNames], {
    deriveReaderSessionCapsule, ReaderSessionCapsule: CapsuleChild,
  }, {
    onObserverEnter: (_owner, id) => { stack.push(id); reads.set(id, new Set()); },
    onObserverExit: (_owner, id) => assert.equal(stack.pop(), id),
  });
  for (const key of Object.keys(p)) Object.defineProperty(owner, key, {
    configurable: true, get() {
      if (observed.has(key) && stack.length) reads.get(stack.at(-1)).add(key);
      return p[key];
    },
  });
  owner.sessionCapsuleLayout = () => ({ sessionX: 269, sessionY: 797 });
  const decisions = [];
  const update = owner.ifElseBranchUpdateFunction;
  owner.ifElseBranchUpdateFunction = function(id, generator) {
    decisions.push(id); return update.call(this, id, generator);
  };
  owner.initialRender();
  return { owner, reads, decisions };
}

if (scope === 'visibility' || scope === 'freeze') {
for (const [type, status] of [['tts', 'paused'], ['tts', 'interrupted'], ['autoPage', 'paused'], ['autoPage', 'running']]) {
  for (const gesture of [scope === 'freeze']) check(`${type}/${status}/${gesture ? 'gesture release' : 'tap or timer'}: retained page survives hidden measurement`, () => {
    const p = fixture(type, status), original = p.visiblePage;
    const ui = nativeProjection(p);
    if (gesture) {
      p.onReaderPageGestureStateChanged({ phase: 'tracking' });
      ui.owner.replay();
      p.onReaderPageGestureStateChanged({ phase: 'idle' });
      ui.owner.replay();
    }
    for (let turn = 0; turn < 5; turn++) {
      p.pageTurnPreparation = { generation: 1, direction: 'next', originChapterIndex: 1, originPageStartScalar: 0 };
      p.beginMeasurement(1);
      assert.equal(p.phase, 'measuring'); assert.equal(p.visiblePage, original);
      ui.owner.replay();
      assert.ok(ui.decisions.every(branch => branch === 0), 'production capsule If must never request the empty branch');
      p.completePreparedPageTurn({ startScalar: 9, fragments: [] }, p.measurementGeneration, 1, 1);
      assert.equal(p.phase, 'ready'); ui.owner.replay();
      assert.equal(ui.owner.children.size, 1, 'probe retains one child; branch decisions above establish no removal request');
    }
  });
}

}
if (scope === 'freeze') {
check('freeze release remains an observed dependency of the real capsule If', () => {
  const p = fixture('tts', 'paused');
  p.onReaderPageGestureStateChanged({ phase: 'tracking' });
  const ui = nativeProjection(p);
  const ifNode = [...ui.owner.nodes.values()].find(node => node.type === 'If');
  assert.ok(ui.reads.get(ifNode.id).has('pageTurnSessionCapsuleFrozen'),
    'frozen projection must subscribe to its release, even without a business-state update');
  p.ttsState = { status: 'stopped' };
  assert.equal(p.shouldShowSessionCapsule(), true, 'gesture holds the snapshot');
  p.onReaderPageGestureStateChanged({ phase: 'idle' });
  ui.owner.replay();
  assert.equal(ui.decisions.at(-1), 1, 'release admits the terminal business state');
});
check('a no-animation gesture rollback releases its held capsule snapshot', () => {
  const p = fixture('tts', 'paused');
  p.onReaderPageGestureStateChanged({ phase: 'tracking' });
  p.ttsState = { status: 'stopped' };
  p.onReaderPageGestureStateChanged({ phase: 'settling', settleTarget: 'rollback' });
  assert.equal(p.pageTurnGestureState.phase, 'idle');
  assert.equal(p.pageTurnSessionCapsuleFrozen, false, 'synchronous rollback must release without requiring a second idle event');
  assert.equal(p.shouldShowSessionCapsule(), false);
});
check('a direct gesture commit releases session state and countdown updates', () => {
  for (const type of ['tts', 'autoPage']) {
    const p = fixture(type, 'paused');
    p.onReaderPageGestureStateChanged({ phase: 'tracking' });
    p.onReaderPageGestureStateChanged({ phase: 'settling', settleTarget: 'commit' });
    if (type === 'tts') p.ttsState = { status: 'playing' };
    else p.autoPageState = { status: 'running', remainingSeconds: 3 };
    p.completeDirectPageTurnGesture();
    assert.equal(p.pageTurnGestureState.phase, 'idle');
    assert.equal(p.pageTurnSessionCapsuleFrozen, false);
    assert.equal(p.sessionCapsuleState(), 'playing');
    assert.equal(p.sessionCapsuleCountdown(), type === 'tts' ? 0 : 3);
  }
});

}
if (scope === 'visibility') {
check('chapter loading retains the capsule while the committed reading body remains visible', () => {
  for (const type of ['tts', 'autoPage']) {
    const p = fixture(type, 'paused'), ui = nativeProjection(p);
    p.phase = 'loading'; ui.owner.replay();
    assert.ok(ui.decisions.every(branch => branch === 0));
    p.visibleFragments = []; ui.owner.replay();
    assert.equal(ui.decisions.at(-1), 1, 'an empty retained page is insufficient');
  }
});

check('first load, real failure, controls, obstruction and exit still hide the capsule', () => {
  for (const [key, value] of [['mounted', false], ['exitRequested', true], ['controlObscured', true],
    ['interactionBlocked', true], ['phase', 'failed'], ['controlVisible', () => true]]) {
    const p = fixture('tts', 'paused'); p[key] = value;
    assert.equal(p.shouldShowSessionCapsule(), false, key);
  }
  for (const phase of ['loading', 'measuring']) {
    const p = fixture('tts', 'paused'); p.phase = phase; p.visiblePage = undefined; p.visibleFragments = [];
    assert.equal(p.shouldShowSessionCapsule(), false, `${phase} without committed body`);
  }
});
}
if (scope === 'pointer-routing') {
// The actual parent __Common__ and raw Row are siblings in LRE. A zIndex on
// the Stage inside Panel cannot repair a lower/equal parent. This controlled
// pointer seam verifies emitted attributes/callback dispatch, not native hit
// testing, compositor order, layout or device interaction acceptance.
check('SDK capsule parent ownership, real Stage click and Host dispatch', () => {
  const reading = name => readFileSync(new URL(`../entry/src/main/ets/features/reading/${name}.ets`, import.meta.url), 'utf8');
  const panelText = reading('ReaderControlPanel'), stageText = reading('ReaderSessionLaunchStage');
  const rawText = reading('ReaderPageInteractionLayer'), capsuleText = reading('ReaderSessionCapsule');
  let panelStatement, panelCall;
  function locate(node) {
    if (ts.isExpressionStatement(node) && node.getText(tree).startsWith('ReaderControlPanel({')) panelStatement = node;
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'ReaderControlPanel') panelCall = node;
    ts.forEachChild(node, locate);
  }
  locate(member('build'));
  assert.ok(panelStatement && panelCall);
  const text = panelStatement.getText(tree), argument = panelCall.arguments[0];
  const parentText = text.slice(0, argument.getStart(tree) - panelStatement.getStart(tree)) + '{}' +
    text.slice(argument.end - panelStatement.getStart(tree));
  assert.ok(panelStatement.getStart(tree) < source.indexOf('      ReaderPageInteractionLayer({'), 'production raw owner is the later sibling');
  const Parent = createReaderBuilderProbe(`@Component struct CapsuleParentProbe { build() { ${parentText} } }`, ['build'],
    { ReaderControlPanel: CapsuleChild }, { childSources: { ReaderControlPanel: panelText } }).Component;
  const Raw = createReaderBuilderProbe(rawText, ['build']).Component;
  const Stage = createReaderBuilderProbe(stageText, ['build', 'sourceSharpContent', 'sourceBlurContent', 'effectiveSurfaceColor', 'effectiveSurfaceBorderColor',
    'effectiveSourceSurfaceColor', 'effectiveSourceBorderColor', 'effectiveTextColor', 'effectivePrimaryColor', 'effectiveOnPrimaryColor'], {
    ReaderSessionCapsuleLeading: CapsuleChild, ReaderSessionCapsulePause: CapsuleChild,
    readerSessionCapsuleAccessibility: () => 'capsule',
  }, { childSources: { ReaderSessionCapsuleLeading: capsuleText, ReaderSessionCapsulePause: capsuleText } }).Component;
  const Static = createReaderBuilderProbe(capsuleText, ['build', 'finalWidth', 'effectiveSurfaceColor', 'effectiveSurfaceBorderColor',
    'effectiveTextColor', 'effectivePrimaryColor', 'effectiveOnPrimaryColor', 'numericLength'], {
    ReaderSessionCapsuleLeading: CapsuleChild, ReaderSessionCapsulePause: CapsuleChild,
    READER_SESSION_CAPSULE_HEIGHT: 24, readerSessionCapsuleMinimumWidth: type => type === 'tts' ? 94 : 96,
    readerSessionCapsuleAccessibility: () => 'capsule',
  }, { componentName: 'ReaderSessionCapsule', childSources: { ReaderSessionCapsuleLeading: capsuleText, ReaderSessionCapsulePause: capsuleText } }).Component;
  const TouchType = { Down: 'down', Move: 'move', Up: 'up', Cancel: 'cancel' };
  let pointerTime = 1000;
  const Pointer = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderPageInteractionLayer.ets', import.meta.url), [
    'handleTouch', 'startRawPointer', 'updateRawPointer', 'finishRawPointer', 'updateVelocity', 'eventTimeMs',
    'resetRawPointer', 'reportManualInteraction', 'isPageOwner', 'resolveDeferredSegment', 'cancelPan', 'handleRawTap', 'tapOnlyNow',
    'pointerForEvent', 'changedPointerForEvent', 'ownPointer', 'eventViewportWidth', 'eventViewportHeight',
    'pageViewportWidth', 'pageViewportHeight', 'pageLocalX', 'pageLocalY', 'systemOwnsPointer', 'finiteInset',
    'eventTargetPosition', 'freezePointerGeometry', 'pointerGeometryMatches', 'reportBookmarkUnavailable',
  ], { ...pageGesture, ReaderPageInputClock, TouchType, readerMotionNowMs: () => pointerTime });
  function rawPointer() {
    const turns = [], raw = Object.assign(new Pointer(), {
      gestureState: pageGesture.createReaderPageGestureState(), activePointerId: -1, inputClock: new ReaderPageInputClock(),
      interactionEnabled: true, tapOnly: false, allowTextSelection: false, viewportWidth: 390, viewportHeight: 800,
      pointerGeometryFrozen: false, manualInteractionReported: false, deferredSegmentReserved: false,
      systemGestureLeftInset: 0, systemGestureRightInset: 0, systemGestureBottomInset: 0,
      onPointerStart: () => true, onPointerEnd() {}, onGestureStateChange() {}, onManualInteraction() {},
      canStartTurn: () => true, canStartBookmark: () => false, onRegrab: () => undefined,
      onTurn: direction => turns.push(direction), onGestureDecision: decision => decision,
      onBookmarkStateChange() {}, onBookmarkRelease() {}, onBookmarkUnavailable() {}, onPreparationNeeded() {}, onOpenControl() {},
      armLongPressTimer() {}, clearLongPressTimer() {}, armPointerWatchdog() {}, clearPointerWatchdog() {},
    });
    return { raw, turns };
  }
  function touch(type, x = 300, y = 780) {
    return { type, timestamp: (pointerTime += 20) * 1e6, touches: [], changedTouches: [{ id: 7, x, y }],
      target: { area: { width: 390, height: 800, globalPosition: { x: 0, y: 0 } } }, stopped: false,
      stopPropagation() { this.stopped = true; }, preventDefault() {} };
  }
  // Fixed EventManager::DispatchTouchEventToTouchTestResult seam (upstream
  // event_manager.cpp:1538): recognizers receive independently; stopPropagation
  // cuts later ordinary onTouch delivery. This is not native hit testing or a
  // claim that Node executes ArkUI's click recognizer/compositor.
  function dispatch(actor, pointer, event, recognizeClick = false) {
    actor.onTouch?.(event);
    if (!event.stopped) pointer.raw.handleTouch(event);
    if (recognizeClick) actor.onClick();
  }
  function exclusiveTap(actor, label) {
    const pointer = rawPointer();
    dispatch(actor, pointer, touch(TouchType.Down));
    dispatch(actor, pointer, touch(TouchType.Up), true);
    assert.deepEqual(pointer.turns, [], `${label}: capsule click must not also turn the raw page`);
    assert.equal(pointer.raw.activePointerId, -1);
  }
  const Toggle = productionMotionMethods(file, ['toggleSessionCapsule', 'sessionLaunchBusinessStatus', 'pageTurnInputPhase',
    'toggleTts', 'toggleAutoPage']);
  const raw = new Raw(undefined, {}); let rawHits = 0;
  Object.assign(raw, { interactionEnabled: true, allowTextSelection: false, handleTouch: () => rawHits++ }); raw.initialRender();
  const rawActor = [...raw.nodes.values()].find(node => node.onTouch);
  assert.equal(rawActor.zIndex, 7); assert.equal(rawActor.width, '100%'); assert.equal(rawActor.height, '100%');
  assert.equal(rawActor.hitTestBehavior, 'HitTestMode.Block');
  const parent = new Parent(undefined, {});
  Object.assign(parent, { sessionLaunch: undefined, sourceSwitchPresentationVisible: false }); parent.initialRender();
  const parentActor = () => [...parent.nodes.values()].find(node => node.type === '__Common__');
  assert.equal(parentActor().zIndex, 7, 'ordinary controls keep their existing layer');
  const curves = { flight: p => p, expand: p => p, easeIn: p => p, easeOut: p => p, easeInOut: p => p };
  let combinations = 0;
  for (const kind of ['quickAutoPage', 'fullAutoPagePlayback', 'quickTts', 'fullTtsPlayback']) {
    const d = readerSessionLaunchDesign(kind), geometry = buildReaderSessionLaunchGeometry({
      source: new ReaderSessionMorphSourceMeasurement(kind, 'source', 50, 300, d.width, d.height, 1),
      targetLeft: 270, targetTop: 780, topBarExitDistance: 100, dockExitDistance: d.dockExitDistance });
    assert.ok(geometry);
    for (const time of [1500, 2300, 3500]) for (const status of ['playing', 'paused', 'preparing']) {
      const calls = [], launch = { geometry, generation: 1, ownership: 'stage', businessStatus: status,
        desiredPlaying: status !== 'paused', sample: sampleReaderSessionLaunch(time, geometry, curves) };
      const host = Object.assign(new Toggle(), { sessionLaunch: launch, pageTurnGestureState: { phase: 'idle' },
        ttsState: { status: geometry.type === 'tts' ? status : 'idle' }, ttsAvailabilityResolved: true,
        automaticReadingState: () => ({ status: geometry.type === 'autoPage' ? status === 'playing' ? 'running' : status : 'stopped' }),
        sessionLaunchController: { setDesiredPlaying(_generation, value) { launch.desiredPlaying = value; }, snapshot: () => launch },
        ttsCoordinator: { setDesiredPlaying: value => calls.push(['desired', value]),
          pause: async () => { calls.push(['tts.pause']); }, resume: async () => { calls.push(['tts.resume']); } },
        createTtsPlayIntent: () => ({}), isTtsPlayIntentCurrent: () => true, cancelPendingAutoPageStart() {},
        cancelPendingTtsPlay() {}, captureControlPlaybackPresentation() {}, stopAutoPage() {},
        pauseAutoPage: reason => calls.push(['auto.pause', reason]),
        autoPageCoordinator: { resume: () => calls.push(['auto.resume']) },
        hideControl() {}, armAutoPageTimer() {}, armAutoPageSessionTimer() {},
      });
      parent.sessionLaunch = launch; parent.replay();
      assert.ok(parentActor().zIndex > rawActor.zIndex, 'retained launch parent must outrank the later raw sibling');
      assert.equal(parentActor().hitTestBehavior, 'HitTestMode.Transparent', 'outside the capsule the parent permits page input');
      const stage = new Stage(undefined, {});
      Object.assign(stage, { sample: launch.sample, interactionEnabled: true, sessionState: status, desiredPlaying: launch.desiredPlaying,
        countdown: 8, surfaceColor: '', surfaceBorderColor: '', sourceSurfaceColor: '', sourceBorderColor: '',
        sourceSurfaceTopInset: 0, sourceHighlightColor: '#00000000', sourceGradientStart: '', sourceGradientEnd: '',
        sourceBorderWidth: 1, sourceShadowColor: '#00000000', sourceShadowRadius: 0, sourceShadowOffsetY: 0,
        textColor: '', primaryColor: '', onPrimaryColor: '', themeScheme: 'day', shadowColor: '#00000000',
        sourceClip: () => ({}), sourceSharpContent() {}, sourceBlurContent() {}, onToggle: () => host.toggleSessionCapsule() });
      stage.initialRender();
      const actor = [...stage.nodes.values()].find(node => node.onClick);
      assert.equal(actor.hitTestBehavior, 'HitTestMode.Block'); assert.equal(actor.responseRegion.height, launch.sample.proxyHeight + 20);
      assert.equal(actor.position.x, launch.sample.proxyLeft); assert.equal(actor.position.y, launch.sample.proxyTop);
      // One admitted pointer at this actual actor dispatches its actual click.
      exclusiveTap(actor, 'launch Stage');
      assert.equal(launch.desiredPlaying, status === 'paused', 'one actual click records the new desired state, including auto preparing');
      const transports = calls.filter(call => call[0] !== 'desired');
      assert.equal(transports.length, status === 'preparing' ? 0 : 1, 'one click dispatches exactly one pause/resume; preparing only records intent');
      if (status !== 'preparing') assert.equal(transports[0][0], `${geometry.type === 'tts' ? 'tts' : 'auto'}.${status === 'playing' ? 'pause' : 'resume'}`);
      assert.equal(calls.filter(call => call[0] === 'desired').length, geometry.type === 'tts' ? 1 : 0);
      const after = calls.length;
      for (const phase of ['dragging', 'settling']) {
        host.pageTurnGestureState = { phase }; stage.interactionEnabled = false; stage.replay();
        actor.onClick(); assert.equal(calls.length, after, 'disabled real click cannot bypass page ownership');
        host.toggleSessionCapsule(); assert.equal(calls.length, after, 'Host retains its independent phase guard');
      }
      host.pageTurnGestureState = { phase: 'idle' }; stage.interactionEnabled = true; stage.replay(); actor.onClick();
      if (status === 'preparing' && geometry.type === 'autoPage') {
        assert.equal(launch.desiredPlaying, true, 'idle restores the same preparing-intent callback without starting transport');
        assert.equal(calls.length, 0);
      } else assert.ok(calls.length > after, 'idle restores the same actor callback');
      rawActor.onTouch({}); assert.equal(rawHits, ++combinations, 'controlled outside-region dispatch reaches the unchanged page owner');
    }
  }
  // Both roots keep an admitted stream exclusive after leaving their bounds
  // or becoming disabled; CANCEL and UP must not leak to the page layer.
  for (const [label, Actor] of [['launch Stage', Stage], ['static capsule', Static]]) {
    const actorOwner = new Actor(undefined, {}), calls = [];
    const host = Object.assign(new Toggle(), { sessionLaunch: undefined, pageTurnGestureState: { phase: 'idle' },
      ttsState: { status: 'playing' }, ttsAvailabilityResolved: true, sessionCapsuleSnapshot: () => ({ type: 'tts' }),
      createTtsPlayIntent: () => ({}), isTtsPlayIntentCurrent: () => true, cancelPendingAutoPageStart() {},
      cancelPendingTtsPlay() {}, captureControlPlaybackPresentation() {},
      ttsCoordinator: { pause: async () => calls.push('pause') },
      automaticReadingState: () => ({ status: 'stopped' }) });
    const geometry = buildReaderSessionLaunchGeometry({ source: new ReaderSessionMorphSourceMeasurement('quickTts', 'source', 50, 300, 122, 54, 1),
      targetLeft: 270, targetTop: 760, topBarExitDistance: 100, dockExitDistance: 90 });
    Object.assign(actorOwner, { type: 'tts', sample: sampleReaderSessionLaunch(3500, geometry, curves),
      interactionEnabled: true, sessionState: 'playing', desiredPlaying: true, countdown: 8, capsuleWidth: 96,
      surfaceColor: '#ffffff', surfaceBorderColor: '#000000', sourceSurfaceColor: '#ffffff', sourceBorderColor: '#000000',
      textColor: '#000000', primaryColor: '#000000', onPrimaryColor: '#ffffff', themeScheme: 'day', shadowColor: '#00000000',
      sourceSurfaceTopInset: 0, sourceHighlightColor: '#00000000', sourceGradientStart: '', sourceGradientEnd: '',
      sourceBorderWidth: 1, sourceShadowColor: '#00000000', sourceShadowRadius: 0, sourceShadowOffsetY: 0,
      sourceClip: () => ({}), sourceSharpContent() {}, sourceBlurContent() {}, onMeasured() {}, onToggle: () => host.toggleSessionCapsule() });
    actorOwner.initialRender();
    const actor = [...actorOwner.nodes.values()].find(node => node.onClick);
    exclusiveTap(actor, label); assert.deepEqual(calls, ['pause'], `${label}: recognizer callback reaches real Host once`);
    for (const terminal of [TouchType.Up, TouchType.Cancel]) {
      const pointer = rawPointer();
      for (const [type, x, y] of [[TouchType.Down, 300, 780], [TouchType.Move, 30, 200], [terminal, 20, 180]]) {
        if (type !== TouchType.Down) { actorOwner.interactionEnabled = false; actorOwner.replay(); }
        const event = touch(type, x, y); dispatch(actor, pointer, event);
        assert.equal(event.stopped, true, `${label}: ${type} stays exclusive outside/disabled`);
      }
      actor.onClick(); assert.deepEqual(calls, ['pause'], `${label}: disabled click does not toggle`);
      assert.deepEqual(pointer.turns, []); assert.equal(pointer.raw.activePointerId, -1);
      actorOwner.interactionEnabled = true; actorOwner.replay();
    }
  }
  const outside = rawPointer();
  outside.raw.handleTouch(touch(TouchType.Down, 300, 300));
  outside.raw.handleTouch(touch(TouchType.Up, 300, 300));
  assert.deepEqual(outside.turns, ['next'], 'outside capsule production raw DOWN/UP still turns exactly once');
  parent.sessionLaunch = undefined; parent.replay(); assert.equal(parentActor().zIndex, 7);
  const staticUi = nativeProjection(fixture('tts', 'paused'));
  assert.ok([...staticUi.owner.nodes.values()].some(node => node.zIndex === 8), 'static capsule remains above the raw layer');
  console.log(`PASS capsule SDK parent/Stage: ${combinations} TTS/auto quick/full dot/settled/finished combinations; controlled callback/phase gates only, native hit testing OPEN`);
});

}
for (const result of checks) console.log(JSON.stringify(result));
assert.equal(checks.filter(r => r.status === 'FAIL').length, 0, 'PH109 production regression');

} finally { if (historyRoot) rmSync(historyRoot, { recursive: true, force: true }); }
}
for (const id of selectContractCases({
  'visibility': { description: 'Actual capsule projection through hidden measurement/loading, guards and retained page', resources: [] },
  'freeze': { description: 'Observed freeze release, direct/no-animation gesture commit and rollback', resources: [] },
  'pointer-routing': { description: 'SDK parent/Stage actors and raw pointer/Host callback exclusivity', resources: [] },
  'historical-projection': { description: 'Diagnostic-only explicit old ref/source projection; not release qualification', resources: [] },
})) { await runCase(id); recordContractCasePass(id); }

import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

for (const id of selectContractCases({
  'visual-owner-seam': {
    description: 'Actual Host launches from the same clock and settles the capsule at 380ms',
    resources: [],
  },
})) {
  await verifyPlaybackTakeoverVisualSeam();
  recordContractCasePass(id);
}

async function verifyPlaybackTakeoverVisualSeam() {
  const { default: assert } = await import('node:assert/strict');
  const autoPolicy = await import('../entry/src/main/ets/features/reading/ui/ReaderAutoPageState.ts');
  const { buildReaderSessionLaunchGeometry } = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts');
  const { ReaderSessionLaunchController } = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchController.ts');
  const { ReaderSessionMorphSourceMeasurement, readerSessionMorphSourceKindForPage } =
    await import('../entry/src/main/ets/features/reading/ui/ReaderSessionMorphState.ts');
  const { ReaderPageChromeSnapshot } = await import('../entry/src/main/ets/features/reading/presentation/ReaderPageChromeModel.ts');
  const { copyReaderControlSessionState, createReaderControlSessionState, readerControlContentLocation } =
    await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
  const { ReaderPageChromeMeasurements } = await import('../entry/src/main/ets/features/reading/ui/ReaderPageChromeLayout.ts');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const file = new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url);

  // Drive the real Host and controller from one source clock.
  let now = 10000;
  const storage = new Map();
  const frames = [];
  class Callback {
    constructor(callback) {
      this.onFrame = callback;
    }
  }
  const Visual = selectedProductionMethods(file, 'ReadingExperience', [
    'beginSessionCapsuleMorph', 'scheduleSessionLaunchFrame',
  ], {
    readerSessionMorphSourceKindForPage,
    buildReaderSessionLaunchGeometry,
    ReaderPageChromeMeasurements,
    ReaderPageChromeSnapshot,
    copyReaderControlSessionState,
    readerControlContentLocation,
    readerSessionCapsuleMinimumWidth: type => type === 'tts' ? 94 : 96,
    readerMotionNowMs: () => now,
    ReaderUIFrameCallback: Callback,
    resolveReaderPageChromeLayout: () => ({ sessionX: 250, sessionY: 760 }),
    AppStorage: { setOrCreate: (key, value) => storage.set(key, value) },
    hilog: { warn: () => {} },
  });
  const linear = progress => progress;
  const controller = new ReaderSessionLaunchController({
    flight: linear,
    expand: linear,
    easeIn: linear,
    easeOut: linear,
    easeInOut: linear,
  });
  const source = new ReaderSessionMorphSourceMeasurement('quickAutoPage', 'source', 25, 524, 286, 196, 1);
  const visual = Object.assign(new Visual(), {
    mounted: true,
    appForeground: true,
    exitRequested: false,
    controlObscured: false,
    lifecycleToken: 1,
    sourceId: 'src',
    bookId: 'book',
    controlOpenRevision: 1,
    controlModuleVisitRevision: 1,
    readerWindowMetricsRevision: 1,
    sharedAppearanceRevision: 1,
    appearanceMutationGeneration: 1,
    measurementEpoch: 1,
    reduceMotion: false,
    sessionLaunchController: controller,
    sessionLaunchSourceContexts: new Map([['quickAutoPage', 'measured']]),
    sessionLaunchTopExit: 73,
    sessionLaunchDockExit: 349,
    sessionLaunchExitGeneration: 0,
    pageTurnRenderRevision: 0,
    controlVisible: () => true,
    cancelControlNavigationIntent: () => {},
    effectiveViewportWidth: () => 0,
    effectiveViewportHeight: () => 0,
    sessionCapsuleMetrics: () => ({ width: 96, paintHeight: 24, targetHeight: 44 }),
    controlVerification: { observing: () => false },
    capsuleVerification: {
      begin: () => {},
      queuedFrameTime: () => undefined,
      update: () => {},
      ownerState: () => {},
    },
    controlPage: () => 'quickAutoPage',
    sessionMorphSourceMeasurement: () => source,
    sessionLaunchMeasurementKey: () => 'measured',
    sessionLaunchLayoutKey: () => 'layout',
    readingLayout: () => ({}),
    currentChapterIndex: () => 4,
    visiblePage: { startScalar: 20 },
    pageChromeClockText: '10:00',
    latestControlVisualSession: createReaderControlSessionState(),
    currentPageTurnRenderPage: () => ({
      chromeTopStartText: 'book',
      chromeTopEndText: '10:00',
      chromeBottomStartText: '1%',
      chromeBottomEndText: '1/50',
    }),
    ttsState: { status: 'idle' },
    autoPageState: autoPolicy.createReaderAutoPageState(8),
    automaticReadingState() {
      return this.autoPageState;
    },
    suspendAdjacentMeasurement: () => {},
    drainPageTurnPreparationQueue: () => {},
    bookTurnTextureCaptureGeneration: 0,
    invalidateControlBackdrop: () => {},
    windowCalls: 0,
    hiddenCalls: 0,
    applyWindowPolicyForChromeOwner() {
      this.windowCalls++;
    },
    commitSessionLaunchControlHidden() {
      this.hiddenCalls++;
    },
    getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
    cancelSessionLaunch: () => {
      throw Error('unexpected invalidation');
    },
  });

  assert.equal(visual.beginSessionCapsuleMorph('autoPage'), true);
  assert.equal(visual.sessionLaunch.sample.timeMs, 0);
  assert.equal(visual.sessionLaunch.sample.sharpOpacity, 1);
  assert.equal(visual.hiddenCalls, 0);
  assert.equal(frames.length, 1);

  now = 10160;
  frames.shift().onFrame(now * 1e6);
  assert.equal(visual.sessionLaunch.sample.timeMs, 160);
  assert.equal(visual.hiddenCalls, 1, 'Host consumes current control-hidden receipt');
  assert.equal(frames.length, 1);

  now = 10220;
  frames.shift().onFrame(now * 1e6);
  assert.equal(visual.sessionLaunch.sample.sourceNeeded, false);
  assert.equal(frames.length, 1);

  now = 10380;
  frames.shift().onFrame(now * 1e6);
  assert.equal(visual.sessionLaunch.sample.finished, true);
  assert.equal(visual.sessionLaunch.ownership, 'stage');
  assert.equal(frames.length, 0);
  assert.equal(storage.get('readerSessionChromeOverlayActive'), true);
  assert.equal(visual.pageTurnRenderRevision, 1, 'the stable stage does not hand the footer back to old page textures');
  console.log('Reader playback Host intents: PASS (production methods; immediate visual, 380ms settlement and stable ownership)');
}

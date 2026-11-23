import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { ReaderAutoPageCoordinator } from '../entry/src/main/ets/features/reading/ui/ReaderAutoPageCoordinator.ts';
import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/application/ReaderTtsSessionCoordinator.ts';
import { readerControlHostInputEnabled } from '../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts';
import { readerTtsSessionBlocksAutoPageStart } from '../entry/src/main/ets/features/reading/ui/ReaderSessionCapsuleModel.ts';
import { FakeGateway, FakeHost, chapter, canonicalRemoteContent } from './lib/reader-tts-fixtures.mjs';

const definitions = {
  'auto-start': { description: 'Actual LRE first AutoPage start across real successful TTS stop, input retirement and valid morph', resources: [] },
  'tts-start': { description: 'Actual LRE availability/document continuation and real TTS first dispatch, accepted ACK and desired-paused boundaries', resources: [] },
  'retirement': { description: 'Actual input/manual/content retirement distinguishes pending start from accepted playback and matching presentation', resources: [] },
};
const source = new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const drain = async () => { for (let index = 0; index < 100; index++) await Promise.resolve(); };
const members = ['toggleAutoPage', 'startAutoPageSession', 'cancelPendingAutoPageStart', 'stopAutoPage',
  'toggleTts', 'createTtsPlayIntent', 'isTtsPlayIntentCurrent', 'cancelPendingTtsPlay', 'retirePendingPlaybackStarts',
  'readerInputIsCurrent', 'isControlInputEnabled', 'isMountedToken', 'isSessionActive', 'isSelectionActive',
  'isSelectionCurrent', 'onControlInputBoundaryChanged', 'onAppForegroundChanged', 'onReaderManualInteraction',
  'pauseAutoPageForInteraction', 'pauseAutoPage', 'selectChapterAnchor'];

function fixture() {
  const gateway = new FakeGateway(), host = new FakeHost(), timers = new Map();
  const presentationEvents = [], errors = [];
  let sequence = 0, page;
  host.isBackgroundPlaybackActive = () => true;
  const Reader = selectedProductionMethods(source, 'ReadingExperience', members, {
    readerControlHostInputEnabled, readerTtsSessionBlocksAutoPageStart,
    ReaderRuntimeOwner: { current: () => ({ getTtsHost: () => host }) },
    hilog: { error() {}, warn() {} },
  });
  page = Object.assign(new Reader(), {
    mounted: true, lifecycleToken: 1, exitRequested: false, appForeground: true, windowChromeActive: true,
    windowChromeOverlayActive: false, interactionBlocked: false, controlObscured: false, liveInput: true,
    sourceId: chapter.sourceId, bookId: chapter.bookId, chapterSelectionToken: 1,
    isReaderIdentityCurrent: () => true, inputCurrent: () => page.liveInput,
    phase: 'ready', chapter: { ...chapter, content: canonicalRemoteContent }, visiblePage: { startScalar: 0 },
    materializedContentVersion: 'first-start-test', ttsPlayIntentGeneration: 0, ttsPlayStartPending: false,
    ttsAvailabilityResolved: true, ttsLanguage: 'zh-CN', ttsPerson: 0, ttsPauseOnInterruption: true,
    ttsAllowMixing: false, ttsBackgroundPlayback: false, ttsFailurePolicy: 'stop', ttsTimerDurationMs: () => undefined,
    ttsChapterRef: () => chapter, controlMinimumGeneration: 0, bookmarkRollbackGeneration: 0,
    entryCatalogSeekRevision: 0, controlOpenRevision: 1,
    captureControlPlaybackPresentation: () => ({ lifecycleToken: 1, sourceId: chapter.sourceId, bookId: chapter.bookId }),
    beginSessionCapsuleMorph(type) {
      // Finite presentation port: own control hiding leaves the real input predicate current.
      this.controlsHidden = true;
      this.sessionLaunch = { geometry: { type }, ownership: 'stage', businessStatus: 'preparing', desiredPlaying: true, generation: 1 };
    },
    cancelSessionLaunch(reason) {
      presentationEvents.push(reason);
      if (reason === 'leave') this.sessionLaunch = undefined;
    },
    finishSessionCapsuleMorph() { this.sessionLaunch = undefined; },
    sessionLaunchController: {
      mayStartBusiness: () => page.sessionLaunch?.desiredPlaying !== false,
      acknowledgeBusiness(_generation, status) { page.sessionLaunch.businessStatus = status; },
      snapshot: () => page.sessionLaunch,
    },
    applyWindowPolicyForChromeOwner() {}, cancelSourceSwitchCompletion() {}, cancelAutomaticPageStart() {},
    stopReaderTtsAudition() {}, finishBookmarkRollback() {}, captureReadingRecordElapsed() {},
    clearReadingRecordTimer() {}, flushReadingRecord: async () => {}, admitRetainedReadingRecency() {},
    beginReadingRecordClock() {}, scheduleControlMinimum() {}, retirePagePointer() {},
    invalidateControlBackdrop() {}, syncVolumeKeyPolicy() {}, retireReaderRecovery() {},
    hideControl() {}, logTtsFailure: (operation, error) => errors.push([operation, error]),
    onSessionLaunchTtsState: state => presentationEvents.push(['start-completed', state.status]),
    transientFeedback: { show() { assert.fail('normal successful stop must not publish a failure notice'); } },
  });
  const auto = new ReaderAutoPageCoordinator({ now: () => 10000, active: () => page.readerInputIsCurrent(),
    ready: () => page.phase === 'ready', canResumeTurn: () => true, turn: () => ({ kind: 'busy' }), changed() {},
    schedule(fn, ms) { const id = ++sequence; timers.set(id, { fn, ms }); return id; }, cancel: id => timers.delete(id) });
  const tts = new ReaderTtsSessionCoordinator(gateway, host, undefined, state => { page.ttsState = state; });
  Object.assign(page, { autoPageCoordinator: auto, ttsCoordinator: tts, ttsState: tts.getState(),
    automaticReadingState: () => auto.snapshot(), armAutoPageTimer: reset => auto.armPageTimer(reset),
    armAutoPageSessionTimer: reset => auto.armSessionTimer(reset) });
  return { page, gateway, host, auto, tts, timers, presentationEvents, errors,
    async close() { auto.dispose(); await tts.dispose(); assert.deepEqual(errors, []); } };
}

function retire(f, edge) {
  if (edge === 'background' || edge === 'background-return' || edge === 'accepted-background') {
    f.page.appForeground = false; f.page.onAppForegroundChanged();
    if (edge === 'background-return') { f.page.appForeground = true; f.page.onAppForegroundChanged(); }
  } else {
    if (edge === 'live-only') f.page.liveInput = false;
    if (edge === 'obscured') f.page.controlObscured = true;
    if (edge === 'window') f.page.windowChromeActive = false;
    if (edge === 'blocked') f.page.interactionBlocked = true;
    if (edge === 'overlay') f.page.windowChromeOverlayActive = true;
    if (edge !== 'live-only') f.page.onControlInputBoundaryChanged();
  }
}

async function autoStart() {
  for (const edge of ['normal', 'desired-paused', 'background', 'background-return', 'live-only', 'obscured', 'window', 'blocked', 'overlay']) {
    const f = fixture(), entered = deferred(), gate = deferred();
    const originalStop = f.gateway.stop.bind(f.gateway);
    try {
      await f.tts.start({ chapter, content: canonicalRemoteContent, contentVersion: 'original', scalarPosition: 0 });
      f.host.emit({ type: 'start', requestId: f.host.requests[0].requestId }); await f.tts.whenSettled();
      let first = true;
      f.gateway.stop = async (...args) => { if (first) { first = false; entered.resolve(); await gate.promise; } return originalStop(...args); };
      f.page.toggleAutoPage(); await entered.promise;
      assert.equal(f.auto.pendingStart(), true);
      if (edge === 'desired-paused') f.page.sessionLaunch.desiredPlaying = false;
      else if (edge !== 'normal') retire(f, edge);
      gate.resolve(); await f.tts.whenSettled(); await drain();
      assert.ok(f.gateway.calls.includes('stop'), 'original successful stop ACK still settles');
      assert.ok(f.host.calls.includes('deactivate'), 'original transport cleanup still settles');
      assert.equal(f.auto.pendingStart(), false, edge);
      if (edge === 'normal') {
        assert.equal(f.page.controlsHidden, true); assert.equal(f.auto.snapshot().status, 'running');
        assert.equal(f.timers.size, 2, 'both real automatic deadlines are armed');
      } else if (edge === 'desired-paused') {
        assert.equal(f.auto.snapshot().status, 'paused'); assert.equal(f.timers.size, 0);
      } else {
        assert.equal(f.auto.snapshot().status, 'stopped', edge + ': no phantom running session');
        assert.equal(f.timers.size, 0); assert.equal(f.page.sessionLaunch, undefined, 'retired first-start proxy released');
      }
    } finally { gate.resolve(); await f.close(); }
  }
}

async function ttsStart() {
  for (const stage of ['availability', 'document']) for (const edge of ['normal', 'desired-paused', 'background', 'background-return', 'live-only', 'obscured', 'window', 'blocked', 'overlay']) {
    const f = fixture(), entered = deferred(), gate = deferred();
    try {
      if (stage === 'availability') {
        f.page.ttsAvailabilityResolved = false;
        f.page.initializeTtsSession = async () => {
          entered.resolve(); await gate.promise;
          const available = await f.tts.probeAvailability();
          f.page.ttsAvailabilityResolved = true; return available;
        };
      } else {
        await f.tts.probeAvailability();
        f.page.chapter.documentRange = {};
        f.page.hydrateEntryWindow = async () => { entered.resolve(); await gate.promise; delete f.page.chapter.documentRange; };
      }
      f.page.toggleTts(); await entered.promise;
      assert.equal(f.host.requests.length, 0); assert.equal(f.page.ttsPlayStartPending, true);
      if (edge === 'desired-paused') f.page.sessionLaunch.desiredPlaying = false;
      else if (edge !== 'normal') retire(f, edge);
      gate.resolve(); await drain(); await f.tts.whenSettled(); await drain();
      assert.equal(f.page.ttsPlayStartPending, false, stage + '/' + edge);
      if (edge === 'normal') {
        assert.equal(f.page.controlsHidden, true); assert.equal(f.host.requests.length, 1, 'normal own morph starts real coordinator');
      } else if (edge === 'desired-paused') {
        assert.equal(f.host.requests.length, 0); assert.equal(f.tts.getState().status, 'paused');
      } else {
        assert.equal(f.host.requests.length, 0, stage + '/' + edge + ': no late first speech');
        assert.ok(!f.host.calls.some(call => call.startsWith('activate:')), 'no late first audio activation');
        assert.equal(f.page.sessionLaunch, undefined);
      }
    } finally { gate.resolve(); await f.close(); }
  }
  // Once start has been dispatched, background ownership remains the real coordinator's policy.
  const f = fixture(), entered = deferred(), gate = deferred(), getConfig = f.gateway.getConfig.bind(f.gateway);
  try {
    await f.tts.probeAvailability();
    f.page.ttsBackgroundPlayback = true;
    f.gateway.getConfig = async () => { entered.resolve(); await gate.promise; return getConfig(); };
    f.page.toggleTts(); await entered.promise;
    assert.equal(f.page.ttsPlayStartPending, false);
    const generation = f.page.ttsPlayIntentGeneration;
    retire(f, 'accepted-background');
    assert.equal(f.page.ttsPlayIntentGeneration, generation, 'accepted first-start ACK identity is preserved');
    gate.resolve(); await drain(); await f.tts.whenSettled(); await drain();
    assert.equal(f.host.requests.length, 1, 'intentional accepted background playback continues');
    assert.ok(f.presentationEvents.some(event => Array.isArray(event) && event[0] === 'start-completed'),
      'fulfilled start completion still reaches its original LRE intent; this alone is not a native onStart ACK');
    const request = f.host.requests[0];
    f.host.emit({ type: 'start', requestId: request.requestId }); await f.tts.whenSettled();
    assert.equal(f.tts.getState().status, 'playing');
    assert.equal(f.tts.getState().audioStarted, true, 'actual original-request Host start event is applied');
    assert.deepEqual(f.page.ttsState, f.tts.getState(), 'actual coordinator state publication reaches current LRE');
    assert.ok(f.gateway.calls.some(call => call.startsWith('callback:0:speaking:') && call.includes(request.requestId)),
      'the original request owns its Core speaking callback');
    assert.equal(f.host.requests[0], request); assert.equal(f.host.requests.length, 1, 'ACK never starts a second speech');
  } finally { gate.resolve(); await f.close(); }
}

async function retirement() {
  for (const kind of ['tts', 'autoPage']) for (const entry of ['input', 'manual', 'chapter']) {
    const f = fixture(), catalog = deferred();
    try {
      f.page.beginSessionCapsuleMorph(kind);
      if (kind === 'tts') { f.page.ttsPlayStartPending = true; }
      else f.auto.beginStart();
      if (entry === 'input') { f.page.liveInput = false; f.page.onControlInputBoundaryChanged(); }
      if (entry === 'manual') f.page.onReaderManualInteraction();
      if (entry === 'chapter') {
        Object.assign(f.page, { entryCatalogPending: true, isKnownControlChapter: () => false,
          controlVisible: () => false, controlShellExitArmed: () => false, hydrateEntryCatalog: () => catalog.promise });
        f.page.selectChapterAnchor(2, 0, true, true);
      }
      assert.equal(f.page.ttsPlayStartPending, false); assert.equal(f.auto.pendingStart(), false);
      assert.deepEqual(f.presentationEvents, ['leave'], 'only matching unstarted proxy retires without a handoff');
      assert.equal(f.host.requests.length, 0); assert.deepEqual(f.gateway.calls, []);
    } finally { catalog.resolve(); await drain(); await f.close(); }
  }
  const f = fixture();
  try {
    f.page.beginSessionCapsuleMorph('tts'); f.auto.beginStart();
    f.page.ttsPlayStartPending = false; const generation = f.page.ttsPlayIntentGeneration;
    f.page.liveInput = false; f.page.onControlInputBoundaryChanged();
    assert.equal(f.auto.pendingStart(), false);
    assert.equal(f.page.ttsPlayIntentGeneration, generation);
    assert.equal(f.page.sessionLaunch.geometry.type, 'tts', 'another pending kind cannot erase accepted TTS proxy');
    assert.deepEqual(f.presentationEvents, []);
  } finally { await f.close(); }
}

const cases = { 'auto-start': autoStart, 'tts-start': ttsStart, retirement };
for (const id of selectContractCases(definitions)) { await cases[id](); recordContractCasePass(id); }

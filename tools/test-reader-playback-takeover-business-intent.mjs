import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

for (const id of selectContractCases({
  'business-intent': {
    description: 'Immediate AutoPage countdown, nonblocking TTS pause and same-owner failure and resumption',
    resources: [],
  },
})) {
  await verifyPlaybackTakeoverBusinessIntent();
  recordContractCasePass(id);
}

async function verifyPlaybackTakeoverBusinessIntent() {
  const { default: assert } = await import('node:assert/strict');
  const autoPolicy = await import('../entry/src/main/ets/features/reading/ui/ReaderAutoPageState.ts');
  const { ReaderAutoPageCoordinator } = await import('../entry/src/main/ets/features/reading/ui/ReaderAutoPageCoordinator.ts');
  const { readerTtsSessionBlocksAutoPageStart } = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionCapsuleModel.ts');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const file = new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url);
  const names = [
    'toggleTts', 'stopTts', 'toggleAutoPage', 'startAutoPageSession', 'stopAutoPage', 'cancelPendingAutoPageStart',
    'cancelPendingTtsPlay', 'createTtsPlayIntent', 'isTtsPlayIntentCurrent', 'retirePendingPlaybackStarts',
    'captureControlPlaybackPresentation', 'isControlPlaybackPresentationCurrent', 'toggleSessionCapsule',
  ];
  const Host = selectedProductionMethods(file, 'ReadingExperience', names, {
    ...autoPolicy,
    readerTtsSessionBlocksAutoPageStart,
    readerControlContentLocation: session => session.location,
  });

  function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  }

  async function drain() {
    for (let turn = 0; turn < 10; turn++) {
      await Promise.resolve();
    }
  }

  function owner() {
    const host = new Host();
    const availability = deferred();
    const calls = [];
    Object.assign(host, {
      mounted: true,
      appForeground: true,
      exitRequested: false,
      lifecycleToken: 1,
      sourceId: 'src',
      bookId: 'book',
      chapterSelectionToken: 1,
      phase: 'ready',
      chapter: { content: '正文', chapterIndex: 4 },
      visiblePage: { startScalar: 20 },
      materializedContentVersion: 'v1',
      ttsAvailabilityResolved: true,
      ttsPlayIntentGeneration: 0,
      ttsState: { status: 'idle', rate: 1 },
      ttsLanguage: 'zh-CN',
      ttsPerson: 0,
      ttsPauseOnInterruption: true,
      ttsAllowMixing: false,
      ttsFailurePolicy: 'stop',
      autoPageState: autoPolicy.createReaderAutoPageState(8),
      controlOpenRevision: 1,
      controlModuleVisitRevision: 1,
      controlSession: { location: { level: 'secondary', module: 'tts', form: 'quick' } },
      visible: true,
      sessionLaunch: undefined,
      isSessionActive(token) {
        return this.mounted && !this.exitRequested && this.lifecycleToken === token;
      },
      controlVisible() {
        return this.visible;
      },
      controlShellExitArmed: () => false,
      initializeTtsSession: () => availability.promise,
      ttsChapterRef: chapter => ({ sourceId: 'src', bookId: 'book', chapterIndex: chapter.chapterIndex }),
      ttsTimerDurationMs: () => 0,
      logTtsFailure: operation => calls.push(`error:${operation}`),
      beginSessionCapsuleMorph(type) {
        calls.push(`visual:${type}`);
        this.sessionLaunch = {
          generation: 1,
          geometry: { type },
          ownership: 'stage',
          businessStatus: 'preparing',
          desiredPlaying: true,
        };
        return true;
      },
      cancelSessionLaunch(reason) {
        calls.push(`cancel:${reason}`);
        this.sessionLaunch = undefined;
      },
      hideControl: () => calls.push('hide'),
      onSessionLaunchTtsState: () => calls.push('ack'),
      armAutoPageTimer(resetDeadline) {
        calls.push('autoTimer');
        this.autoPageCoordinator.armPageTimer(resetDeadline);
      },
      armAutoPageSessionTimer: () => {},
      clearAutoPageTimer: () => {},
      clearAutoPageSessionTimer: () => {},
      resetAutoPageSessionDuration: () => {},
      pauseAutoPage(reason) {
        this.autoPageCoordinator.pause(reason);
      },
      pageTurnInputPhase: () => 'idle',
      sessionCapsuleSnapshot: () => undefined,
      readerInputIsCurrent: () => true,
      transientFeedback: { show: (_context, options) => calls.push(`feedback:${options.message}`) },
      getUIContext: () => ({ getPromptAction: () => ({ showToast: () => {} }) }),
      controlVerification: { observing: () => false },
      capsuleVerification: { ttsTiming: () => undefined, ownerState: () => {} },
    });
    host.autoPageCoordinator = new ReaderAutoPageCoordinator({
      now: () => 10000,
      schedule: (_callback, delay) => {
        calls.push(`schedule:${delay}`);
        return 1;
      },
      cancel: () => {},
      active: () => host.mounted && !host.exitRequested,
      ready: () => true,
      canResumeTurn: () => true,
      turn: () => ({ kind: 'started' }),
      changed: () => {},
    });
    Object.defineProperty(host, 'autoPageState', { get: () => host.autoPageCoordinator.snapshot() });
    host.automaticReadingState = () => host.autoPageCoordinator.snapshot();
    host.automaticReadingConfiguration = () => host.autoPageCoordinator.configurationAt();
    host.sessionLaunchController = {
      mayStartBusiness: () => host.sessionLaunch?.desiredPlaying === true,
      acknowledgeBusiness: (_generation, status) => {
        host.sessionLaunch.businessStatus = status;
      },
      snapshot: () => host.sessionLaunch,
      setDesiredPlaying: (_generation, desired) => {
        host.sessionLaunch.desiredPlaying = desired;
      },
    };
    host.ttsCoordinator = {
      setDesiredPlaying: desired => calls.push(`desired:${desired}`),
      start: async (_input, desired) => {
        calls.push(`start:${desired}`);
        host.ttsState = { status: 'preparing', rate: 1 };
      },
      pause: async () => {
        calls.push('pause');
        host.ttsState.status = 'paused';
      },
      resume: async () => {
        calls.push('resume');
      },
      stop: async () => {
        calls.push('stop');
        host.ttsState.status = 'idle';
      },
    };
    return { host, calls, availability };
  }

  for (const availabilityDelay of [false, true]) {
    const { host, calls, availability } = owner();
    host.ttsAvailabilityResolved = !availabilityDelay;
    host.toggleTts();
    assert.equal(calls[0], 'visual:tts', 'launch occurs synchronously before service preparation');
    if (availabilityDelay) {
      assert.equal(calls.some(c => c.startsWith('start:')), false);
      host.ttsAvailabilityResolved = true;
      availability.resolve(true);
    } else {
      assert.ok(calls.includes('start:true'), 'admitted TTS dispatches before a visual frame or async ACK');
    }
    await drain();
    assert.equal(calls.filter(c => c.startsWith('visual:')).length, 1);
    assert.equal(calls.filter(c => c.startsWith('start:')).length, 1);
    assert.equal(calls.includes('hide'), false, 'business ACK cannot start an independent control hide clock');
  }
  {
    const { host, calls, availability } = owner();
    host.ttsState.status = 'unavailable';
    host.initializeTtsSession = (_token, retry) => {
      calls.push(`retry:${retry}`);
      return availability.promise;
    };
    host.toggleTts();
    assert.deepEqual(calls.slice(0, 2), ['visual:tts', 'retry:true']);
    assert.equal(calls.some(c => c.startsWith('start:')), false);
    host.ttsState.status = 'idle';
    availability.resolve(true);
    await drain();
    assert.equal(calls.filter(c => c.startsWith('start:')).length, 1, 'failed background preflight can be retried only by explicit play');
  }
  {
    const { host, calls, availability } = owner();
    host.ttsAvailabilityResolved = false;
    host.toggleTts();
    host.toggleSessionCapsule();
    assert.equal(host.sessionLaunch.desiredPlaying, false);
    assert.equal(host.sessionLaunch.businessStatus, 'preparing');
    host.ttsAvailabilityResolved = true;
    availability.resolve(true);
    await drain();
    assert.ok(calls.includes('start:false'), 'pause during availability is carried into start, never overwritten');
  }
  {
    const { host, calls } = owner();
    host.controlSession.location.module = 'autoPage';
    host.toggleAutoPage();
    assert.equal(calls[0], 'visual:autoPage');
    assert.ok(calls.includes('autoTimer'));
    assert.ok(calls.some(call => call.startsWith('schedule:')), 'admitted countdown is armed on the play call');
    assert.equal(host.autoPageState.status, 'running');
  }
  {
    const { host, calls } = owner();
    const pause = deferred();
    host.ttsState.status = 'playing';
    host.controlSession.location.module = 'autoPage';
    host.ttsCoordinator.pause = () => {
      calls.push('pause');
      host.ttsState.status = 'paused';
      return pause.promise;
    };
    host.ttsCoordinator.resume = async () => {
      assert.equal(host.autoPageState.status, 'stopped');
      calls.push('resume');
    };
    host.toggleAutoPage();
    assert.deepEqual(calls.slice(0, 3), ['pause', 'visual:autoPage', 'autoTimer']);
    assert.equal(host.autoPageState.status, 'running');
    assert.equal(host.autoPageCoordinator.pendingStart(), false);
    assert.equal(host.ttsState.status, 'paused');
    assert.equal(calls.includes('stop'), false);
    host.toggleTts();
    assert.equal(host.autoPageState.status, 'stopped');
    assert.equal(calls.filter(call => call === 'resume').length, 1);
    pause.resolve();
    await drain();
    assert.equal(host.autoPageState.status, 'stopped', 'late pause completion does not re-arm AutoPage');
  }
  {
    const { host, calls } = owner();
    const pause = deferred();
    host.ttsState.status = 'playing';
    host.controlSession.location.module = 'autoPage';
    host.ttsCoordinator.pause = () => {
      host.ttsState.status = 'paused';
      return pause.promise;
    };
    host.toggleAutoPage();
    assert.equal(host.autoPageState.status, 'running');
    pause.reject(Error('transport pause failed'));
    await drain();
    assert.equal(host.autoPageState.status, 'paused');
    assert.equal(calls.filter(call => call.startsWith('feedback:')).length, 1);
    assert.equal(calls.includes('cancel:stopBarrierFailure'), false);
  }
  {
    const { host, calls } = owner();
    host.ttsState.status = 'playing';
    host.controlSession.location.module = 'autoPage';
    host.readerInputIsCurrent = () => false;
    host.toggleAutoPage();
    assert.equal(host.autoPageState.status, 'stopped');
    assert.ok(calls.every(call => call !== 'pause' && call !== 'visual:autoPage' && call !== 'autoTimer'));
  }
  const invalidatePendingStarts = [
    host => host.stopTts(),
    host => { host.mounted = false; },
    host => { host.lifecycleToken++; },
    host => { host.bookId = 'new'; },
    host => { host.chapterSelectionToken++; },
  ];
  for (const invalidate of invalidatePendingStarts) {
    const { host, calls, availability } = owner();
    host.ttsAvailabilityResolved = false;
    host.toggleTts();
    invalidate(host);
    host.ttsAvailabilityResolved = true;
    availability.resolve(true);
    await drain();
    assert.equal(calls.some(c => c.startsWith('start:')), false);
  }
  {
    const { host, calls, availability } = owner();
    host.ttsAvailabilityResolved = false;
    host.toggleTts();
    host.controlSession.location.module = 'autoPage';
    host.sessionLaunch = undefined;
    host.toggleAutoPage();
    host.ttsAvailabilityResolved = true;
    availability.resolve(true);
    await drain();
    assert.equal(host.autoPageState.status, 'running');
    assert.equal(calls.some(c => c.startsWith('start:')), false);
  }
}

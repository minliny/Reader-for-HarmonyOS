import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderTtsSessionCoordinator } from '../../../entry/src/main/ets/features/reading/application/ReaderTtsSessionCoordinator.ts';
import { FakeGateway, FakeHost, chapter, canonicalRemoteContent } from '../../lib/reader-tts-fixtures.mjs';
import { selectedProductionClasses, selectedProductionMethods } from '../../lib/selected-production-methods.mjs';

const readingUi = new URL('../../../entry/src/main/ets/features/reading/ui/', import.meta.url);

test('TTS capsule keeps playback acknowledgements across the visual endpoint without publishing duplicates', () => {
  const Stage = selectedProductionMethods(new URL('LocalReadingExperience.ets', readingUi), 'ReadingExperience',
    ['onSessionLaunchTtsState', 'sessionLaunchSpeechFacts']);
  const Controller = selectedProductionMethods(new URL('ReaderSessionLaunchController.ts', readingUi),
    'ReaderSessionLaunchController', ['current', 'isCurrent', 'snapshot', 'setDesiredPlaying', 'acknowledgeBusiness']);
  const { ReaderControlCapsuleVerification } = selectedProductionClasses(
    new URL('ReaderControlCapsuleVerification.ets', readingUi), ['ReaderControlCapsuleVerification'],
    { ReaderStartupTrace: { currentTts: () => undefined }, readerMotionNowMs: () => 0 });

  const effects = [];
  const verification = {
    observing: () => true,
    observationIdentity: () => 'reading-1',
    effect: (kind, phase, facts) => effects.push({ kind, phase, facts }),
  };
  const launch = {
    generation: 1,
    geometry: { type: 'tts', kind: 'fullTtsPlayback' },
    identity: { moduleVisit: 1, viewportRevision: 1 },
    sample: { timeMs: 506, controlsPresented: true, sourceNeeded: true },
    startTimeMs: 0,
    ownership: 'stage',
    businessStatus: 'preparing',
    desiredPlaying: true,
  };
  const controller = Object.assign(new Controller(), { current: launch });
  const capsuleVerification = new ReaderControlCapsuleVerification(verification);
  const transport = { engine: 'system', sessionGeneration: 1, audioSession: 'active' };
  const stage = Object.assign(new Stage(), {
    sessionLaunch: launch,
    sessionLaunchController: controller,
    capsuleVerification,
    controlVerification: verification,
    ttsCoordinator: { getTransportState: () => transport },
  });
  capsuleVerification.begin(launch, { level: 'secondary', module: 'tts', form: 'full' }, false);
  const playing = { status: 'playing', audioStarted: true, sessionGeneration: 1, sliceIndex: 0 };
  stage.onSessionLaunchTtsState(playing);

  const endpoint = {
    ...stage.sessionLaunch,
    sample: { timeMs: 3500, controlsPresented: false, sourceNeeded: false, finished: true },
  };
  controller.current = endpoint;
  stage.sessionLaunch = endpoint;
  capsuleVerification.ownerState('timeline-finished', endpoint);
  stage.onSessionLaunchTtsState({ ...playing, sliceIndex: 1 });
  stage.onSessionLaunchTtsState({ ...playing, sliceIndex: 2 });

  assert.equal(stage.sessionLaunch, endpoint, 'subsequent slice callbacks retain the rendered capsule snapshot');
  assert.deepEqual(effects.map(effect => effect.phase), ['admitted', 'business-ack', 'timeline-finished']);
  assert.deepEqual(effects[1].facts.tts, {
    engine: 'system', sessionGeneration: 1, status: 'playing', audioStarted: true,
    audioSession: 'active', pauseReason: undefined,
  });

  assert.equal(controller.setDesiredPlaying(launch.generation, false), true);
  stage.sessionLaunch = controller.snapshot();
  stage.onSessionLaunchTtsState(playing);
  assert.equal(effects.at(-1).phase, 'timeline-finished', 'late speech cannot acknowledge a newer pause intent');
  transport.audioSession = 'inactive';
  const paused = { ...playing, status: 'paused', pauseReason: 'user' };
  stage.onSessionLaunchTtsState(paused);
  stage.onSessionLaunchTtsState(paused);
  assert.deepEqual(effects.slice(3).map(effect => [effect.phase, effect.facts.status, effect.facts.tts.audioSession]),
    [['business-ack', 'paused', 'inactive']]);
});

test('TTS saved-voice preparation is silent and the first play probes the exact voice it will speak', async () => {
  const gateway = new FakeGateway();
  const host = new FakeHost();
  const states = [];
  const voices = [];
  host.probe = async (language, person) => {
    voices.push({ language, person });
    return { available: true };
  };
  const coordinator = new ReaderTtsSessionCoordinator(gateway, host, undefined, state => states.push(state));
  try {
    let current = true;
    coordinator.setVoiceForNextSpeech('en-US', 1, () => current);
    current = false;
    coordinator.setVoiceForNextSpeech('en-US', 2);
    await coordinator.whenSettled();
    assert.deepEqual(voices, [{ language: 'en-US', person: 2 }]);
    assert.deepEqual(host.calls, []);
    assert.deepEqual(states, []);
    assert.deepEqual(gateway.calls, []);

    await coordinator.start({ chapter, content: canonicalRemoteContent, contentVersion: 'first-play',
      scalarPosition: 0, language: 'en-US', person: 2 });
    assert.deepEqual(voices, [{ language: 'en-US', person: 2 }, { language: 'en-US', person: 2 }]);
    assert.deepEqual(host.requests.map(({ language, person }) => ({ language, person })),
      [{ language: 'en-US', person: 2 }]);
    assert.equal(states.length, 3, 'initial state, Core queue and utterance each publish once during preparation');
    assert.ok(states.every(state => state.status === 'preparing' && state.audioStarted === false));

    host.emit({ type: 'start', requestId: host.requests[0].requestId });
    await coordinator.whenSettled();
    assert.equal(states.at(-1).status, 'playing');
    assert.equal(states.at(-1).audioStarted, true);
  } finally {
    await coordinator.stop('user');
  }
});

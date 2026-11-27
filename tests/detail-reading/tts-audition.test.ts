import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readerTtsVoicePickerAuditionCurrent,
} from '../../entry/src/main/ets/features/reading/application/ReaderTtsConfigAdmission.ts';
import { ReaderTtsGateway } from '../../entry/src/main/ets/features/reading/application/ReaderTtsGateway.ts';
import {
  ReaderTtsSessionCoordinator, type ReaderTtsAuditionReceipt,
} from '../../entry/src/main/ets/features/reading/application/ReaderTtsSessionCoordinator.ts';
import type {
  ReaderTtsHost, ReaderTtsHostEvent, ReaderTtsHostProbe, ReaderTtsHostSpeakRequest,
} from '../../entry/src/main/ets/features/reading/application/ReaderTtsHostContract.ts';

test('voice picker admits its current editor during module reflow and rejects stale openings', () => {
  const current = { mounted: true, pickerIdentity: 'voice:2', callbackIdentity: 'voice:2',
    voicePicker: true, editorInputCurrent: true };
  assert.equal(readerTtsVoicePickerAuditionCurrent(current), true);
  assert.equal(readerTtsVoicePickerAuditionCurrent({ ...current, callbackIdentity: 'voice:1' }), false);
  assert.equal(readerTtsVoicePickerAuditionCurrent({ ...current, callbackIdentity: '', pickerIdentity: '' }), false);
  assert.equal(readerTtsVoicePickerAuditionCurrent({ ...current, mounted: false }), false);
  assert.equal(readerTtsVoicePickerAuditionCurrent({ ...current, voicePicker: false }), false);
  assert.equal(readerTtsVoicePickerAuditionCurrent({ ...current, editorInputCurrent: false }), false);
});

function fixture(probe: ReaderTtsHostProbe = { available: true }, observe?: (receipt: ReaderTtsAuditionReceipt) => void) {
  const observations: ReaderTtsAuditionReceipt[] = [];
  const calls: string[] = [];
  let dispatch: ((event: ReaderTtsHostEvent) => void) | undefined;
  let request: ReaderTtsHostSpeakRequest | undefined;
  const host: ReaderTtsHost = {
    setEventListener(listener) { dispatch = listener; },
    clearEventListener() { dispatch = undefined; },
    selectEngine: async (engine) => { calls.push(`select:${engine}`); return true; },
    isAvailable: async () => true,
    probe: async (language, person, exactVoice) => {
      calls.push(`probe:${language}:${person}:${exactVoice}`);
      return probe;
    },
    activateAudioSession: async (allowMixing) => { calls.push(`activate:${allowMixing}`); },
    deactivateAudioSession: async () => { calls.push('deactivate'); },
    speak: async (received) => { request = received; },
    stop: async () => { calls.push('stop'); },
    publishPlaybackState() {},
  };
  const gateway = new ReaderTtsGateway({ request: async () => { throw new Error('audition reached the book queue'); } });
  const coordinator = new ReaderTtsSessionCoordinator(gateway, host);
  return {
    calls, observations,
    begin: () => coordinator.auditionVoice({
      engine: 'system', language: 'zh-CN', person: 13,
      observe: (observation) => {
        observations.push(observation);
        observe?.(observation);
      },
    }),
    request: () => request,
    emit: (event: ReaderTtsHostEvent) => dispatch?.(event),
    stopAudition: () => coordinator.stopAudition(),
    dispose: () => coordinator.dispose(),
  };
}

test('audition records only matching native callbacks and completes on audio playback', async () => {
  const audition = fixture();
  try {
    const completed = audition.begin();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const request = audition.request();
    assert.ok(request);
    const requestId = request.requestId;
    assert.equal(request.exactVoice, true);
    assert.deepEqual(audition.calls, ['select:system', 'probe:zh-CN:13:true', 'activate:false']);
    audition.emit({ type: 'start', requestId: 'a previous preview' });
    assert.deepEqual(audition.observations, []);
    audition.emit({ type: 'start', requestId });
    audition.emit({ type: 'start', requestId });
    audition.emit({ type: 'complete', requestId, completion: 'synthesis' });
    assert.deepEqual(audition.observations.map((receipt) => receipt.state), ['started']);
    audition.emit({ type: 'complete', requestId, completion: 'audio' });
    await completed;
    assert.deepEqual(audition.observations.map((receipt) => receipt.state), ['started', 'completed']);
    assert.ok(audition.observations[0].operationId > 0);
    assert.equal(audition.observations[0].operationId, audition.observations[1].operationId);
    assert.deepEqual(audition.calls.slice(-3), ['stop', 'deactivate', 'select:undefined']);
  } finally {
    await audition.dispose();
  }
});

test('missing platform capability stays distinct from an ordinary voice probe failure', async () => {
  const unsupported = fixture({ available: false, reason: 'not supported', unavailableCode: 'system-capability-missing' });
  const failed = fixture({ available: false, reason: 'engine initialization failed' });
  try {
    await assert.rejects(unsupported.begin(), /not supported/);
    await assert.rejects(failed.begin(), /engine initialization failed/);
    assert.deepEqual(unsupported.observations.map(({ state, code }) => [state, code]),
      [['unavailable', 'system-capability-missing']]);
    assert.deepEqual(failed.observations.map(({ state, code }) => [state, code]), [['failed', 'voice-probe']]);
    assert.ok(unsupported.observations[0].operationId < failed.observations[0].operationId);
    assert.equal(unsupported.request(), undefined);
    assert.equal(failed.request(), undefined);
  } finally {
    await unsupported.dispose();
    await failed.dispose();
  }
});

test('native errors reject the audition and a cancelled audition ignores late completion', async () => {
  const audition = fixture();
  try {
    const failed = audition.begin();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const requestId = audition.request()!.requestId;
    audition.emit({ type: 'error', requestId, message: 'native failure' });
    await assert.rejects(failed, /native failure/);
    assert.deepEqual(audition.observations.map(({ state, code }) => [state, code]), [['failed', 'native-error']]);

    const cancelled = audition.begin();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const cancelledId = audition.request()!.requestId;
    await audition.stopAudition();
    audition.emit({ type: 'complete', requestId: cancelledId, completion: 'audio' });
    await cancelled;
    assert.deepEqual(audition.observations.map(({ state }) => state), ['failed']);
  } finally {
    await audition.dispose();
  }
});

test('diagnostic observer errors cannot change native audition callbacks or completion', async () => {
  const audition = fixture(undefined, () => { throw new Error('diagnostics failed'); });
  try {
    const completed = audition.begin();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const requestId = audition.request()!.requestId;
    assert.doesNotThrow(() => audition.emit({ type: 'start', requestId }));
    audition.emit({ type: 'complete', requestId, completion: 'audio' });
    await completed;
    assert.deepEqual(audition.observations.map(({ state }) => state), ['started', 'completed']);
  } finally {
    await audition.dispose();
  }
});

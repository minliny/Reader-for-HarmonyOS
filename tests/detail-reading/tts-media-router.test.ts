import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ReaderTtsHostEvent } from '../../entry/src/main/ets/features/reading/application/ReaderTtsHostContract.ts';
import {
  HarmonyTtsHostRouter,
  type ReaderTtsBackgroundSessionBridge,
  type ReaderTtsSystemHost,
} from '../../entry/src/main/ets/platform/tts/HarmonyTtsHostRouter.ts';

function speechTransport(): ReaderTtsSystemHost {
  return {
    setEventListener() {},
    clearEventListener() {},
    selectEngine: async () => true,
    probe: async () => ({ available: true }),
    isAvailable: async () => true,
    activateAudioSession: async () => {},
    deactivateAudioSession: async () => {},
    speak: async () => {},
    stop: async () => {},
    publishPlaybackState() {},
    listVoices: async () => [],
    close: async () => {},
  };
}

test('media background mode follows the acquired lease, revocation and preference changes', async () => {
  const modes: boolean[] = [];
  const events: ReaderTtsHostEvent[] = [];
  const admission = Promise.withResolvers<void>();
  let active = false;
  let foreground = true;
  let revoke: (() => void) | undefined;
  const release = async (): Promise<void> => { active = false; };
  const background: ReaderTtsBackgroundSessionBridge = {
    setRevocationListener(listener) { revoke = listener; },
    isActive: () => active,
    async activate() {
      await admission.promise;
      active = true;
      return true;
    },
    close: release,
    deactivate: release,
  };
  const router = new HarmonyTtsHostRouter(speechTransport(), speechTransport(), {
    setBackgroundPlaybackEnabled: (enabled) => { modes.push(enabled); },
    setEventListener() {},
    activate: async () => {},
    deactivate: async () => {},
    publish() {},
    close: async () => {},
  }, background, () => foreground);

  try {
    router.setEventListener((event) => { events.push(event); }, 'reader');
    await router.activateAudioSession(false);
    assert.equal(router.isBackgroundPlaybackActive(), false);
    assert.equal(modes.at(-1), false);
    const ready = router.waitForBackgroundPlaybackAdmission();
    admission.resolve();
    assert.equal(await ready, true);
    assert.equal(modes.at(-1), true);

    foreground = false;
    active = false;
    assert.ok(revoke);
    revoke();
    assert.equal(modes.at(-1), false);
    assert.deepEqual(events, [{ type: 'backgroundLeaseRevoked' }]);

    router.setBackgroundPlaybackEnabled(false);
    assert.equal(await router.waitForBackgroundPlaybackAdmission(), false);
    router.setBackgroundPlaybackEnabled(true);
    assert.equal(await router.waitForBackgroundPlaybackAdmission(), true);
    assert.equal(modes.at(-1), true);

    await router.deactivateAudioSession();
    assert.equal(modes.at(-1), false);
  } finally {
    admission.resolve();
    await router.close();
  }
});

test('releasing audio publishes stopped and awaits native media deactivation', async () => {
  const events: string[] = [];
  const removal = Promise.withResolvers<void>();
  const router = new HarmonyTtsHostRouter(speechTransport(), speechTransport(), {
    setEventListener() {},
    activate: async () => { events.push('activate'); },
    publish: (state) => { events.push(state); },
    async deactivate() {
      events.push('deactivate');
      await removal.promise;
    },
    close: async () => {},
  });

  try {
    await router.activateAudioSession(false);
    let released = false;
    const release = router.deactivateAudioSession().then(() => { released = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(events, ['activate', 'stopped', 'deactivate']);
    assert.equal(released, false);
    removal.resolve();
    await release;
    assert.equal(released, true);
    await router.activateAudioSession(false);
    assert.equal(events.at(-1), 'activate');
  } finally {
    removal.resolve();
    await router.close();
  }
});

test('an optional media deactivation failure does not fail the foreground speech release', async () => {
  let speechReleased = false;
  const foreground = speechTransport();
  foreground.deactivateAudioSession = async () => { speechReleased = true; };
  const router = new HarmonyTtsHostRouter(foreground, speechTransport(), {
    setEventListener() {},
    activate: async () => {},
    publish() {},
    deactivate: async () => { throw new Error('AVSession unavailable'); },
    close: async () => {},
  });

  try {
    await router.activateAudioSession(false);
    await router.deactivateAudioSession();
    assert.equal(speechReleased, true);
  } finally {
    await router.close();
  }
});

test('releasing a paused speech lease preserves native Play until terminal release', async () => {
  const media: string[] = [];
  const events: ReaderTtsHostEvent[] = [];
  let mediaCallback: ((event: ReaderTtsHostEvent) => void) | undefined;
  const router = new HarmonyTtsHostRouter(speechTransport(), speechTransport(), {
    setEventListener(listener) { mediaCallback = listener; },
    activate: async () => { media.push('activate'); },
    publish: (state) => { media.push(state); },
    deactivate: async () => { media.push('deactivate'); },
    close: async () => {},
  });

  try {
    router.setEventListener((event) => { events.push(event); }, 'reader');
    await router.activateAudioSession(false);
    router.publishPlaybackState('paused');
    await router.deactivateAudioSession('pause');
    mediaCallback?.({ type: 'mediaControl', action: 'play' });
    assert.deepEqual(media, ['activate', 'paused']);
    assert.deepEqual(events, [{ type: 'mediaControl', action: 'play' }]);

    await router.deactivateAudioSession();
    mediaCallback?.({ type: 'mediaControl', action: 'play' });
    assert.deepEqual(media, ['activate', 'paused', 'stopped', 'deactivate']);
    assert.equal(events.length, 1);
  } finally {
    await router.close();
  }
});

test('a missing native media acknowledgement does not block speech or admit callbacks for its successor', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const removal = Promise.withResolvers<void>();
  const nextActivation = Promise.withResolvers<void>();
  const events: ReaderTtsHostEvent[] = [];
  let mediaCallback: ((event: ReaderTtsHostEvent) => void) | undefined;
  let activationCount = 0;
  const router = new HarmonyTtsHostRouter(speechTransport(), speechTransport(), {
    setEventListener(listener) { mediaCallback = listener; },
    async activate() {
      if (++activationCount > 1) await nextActivation.promise;
    },
    publish() {},
    deactivate: () => removal.promise,
    close: async () => {},
  });

  try {
    router.setEventListener((event) => { events.push(event); }, 'reader');
    await router.activateAudioSession(false);
    let released = false;
    const release = router.deactivateAudioSession().then(() => { released = true; });
    t.mock.timers.tick(2000);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(released, true);
    await release;

    await router.activateAudioSession(false);
    mediaCallback?.({ type: 'mediaControl', action: 'play' });
    removal.resolve();
    assert.equal(events.length, 0);
    nextActivation.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    mediaCallback?.({ type: 'mediaControl', action: 'play' });
    assert.deepEqual(events, [{ type: 'mediaControl', action: 'play' }]);
  } finally {
    removal.resolve();
    nextActivation.resolve();
    await router.close();
  }
});

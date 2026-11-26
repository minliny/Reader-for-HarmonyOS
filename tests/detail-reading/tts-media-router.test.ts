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

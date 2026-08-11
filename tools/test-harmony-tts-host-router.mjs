import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { HarmonyTtsHostRouter } from '../entry/src/main/ets/app/HarmonyTtsHostRouter.ts';

class FakeHost {
  constructor(kind) { this.kind = kind; }
  calls = [];
  listener;
  setEventListener(listener) { this.listener = listener; }
  async selectEngine(engine) {
    this.calls.push(`select:${engine ?? 'system'}`);
    return this.kind === 'http' ? engine?.startsWith('http-tts:') === true : !engine?.startsWith('http-tts:');
  }
  async isAvailable() { this.calls.push('available'); return true; }
  async activateAudioSession(mix) { this.calls.push(`activate:${mix}`); }
  async deactivateAudioSession() { this.calls.push('deactivate'); }
  async speak(request) { this.calls.push(`speak:${request.requestId}`); }
  async stop() { this.calls.push('stop'); }
  publishPlaybackState(state) { this.calls.push(`publish:${state}`); }
  async close() { this.calls.push('close'); }
  emit(event) { this.listener?.(event); }
}

const system = new FakeHost('system');
const http = new FakeHost('http');
const media = {
  calls: [],
  listener: undefined,
  setEventListener(listener) { this.listener = listener; },
  async activate() { this.calls.push('activate'); },
  publish(state) { this.calls.push(`publish:${state}`); },
  async close() { this.calls.push('close'); },
  emit(action) { this.listener?.({ type: 'mediaControl', action }); },
};
const router = new HarmonyTtsHostRouter(system, http, media);
const events = [];
router.setEventListener(event => events.push(event));

assert.equal(await router.selectEngine('http-tts:42'), true);
await router.activateAudioSession(false);
await router.speak({ requestId: 'http-1', text: '第一句。', rate: 1, pitch: 1, language: 'zh-CN' });
system.emit({ type: 'start', requestId: 'stale-system' });
http.emit({ type: 'start', requestId: 'http-1' });
assert.deepEqual(events, [{ type: 'start', requestId: 'http-1' }]);
assert.ok(http.calls.includes('activate:false'));
assert.ok(http.calls.includes('speak:http-1'));
router.publishPlaybackState('playing');
assert.ok(media.calls.includes('publish:playing'));
media.emit('next');
assert.deepEqual(events.at(-1), { type: 'mediaControl', action: 'next' });

assert.equal(await router.selectEngine(undefined), true);
await router.speak({ requestId: 'system-1', text: '第二句。', rate: 1, pitch: 1, language: 'zh-CN' });
assert.ok(system.calls.includes('speak:system-1'));
await router.close();
assert.ok(system.calls.includes('close'));
assert.ok(http.calls.includes('close'));
assert.ok(media.calls.includes('close'));

const httpHostSource = await readFile(
  new URL('../entry/src/main/ets/app/HarmonyHttpTtsHost.ts', import.meta.url),
  'utf8',
);
assert.match(httpHostSource, /gateway\.buildRequest\(configId, request\.text\)/);
assert.match(httpHostSource, /expectDataType: http\.HttpDataType\.ARRAY_BUFFER/);
assert.match(httpHostSource, /HTTP_TTS_MAX_AUDIO_BYTES/);
assert.match(httpHostSource, /request\.destroy\(\)/);
assert.match(httpHostSource, /player\.dataSrc = this\.createDataSource\(bytes\)/);
assert.match(httpHostSource, /fileSize: bytes\.length/);
assert.match(httpHostSource, /target\.set\(bytes\.subarray\(start, start \+ count\), 0\)/);
assert.match(httpHostSource, /generation !== this\.speakGeneration/);
assert.doesNotMatch(httpHostSource, /createMediaSourceWithUrl/);
assert.match(httpHostSource, /await player\.prepare\(\)/);
assert.match(httpHostSource, /await player\.play\(\)/);
assert.match(httpHostSource, /type: 'complete', requestId, completion: 'audio'/);
assert.match(httpHostSource, /await player\.release\(\)/);

console.log('Harmony TTS Host router and HttpTTS transport contract: PASS');

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
const background = {
  calls: [],
  active: false,
  async activate() { this.calls.push('activate'); this.active = true; return true; },
  async deactivate() { this.calls.push('deactivate'); this.active = false; },
  isActive() { return this.active; },
  async close() { this.calls.push('close'); this.active = false; },
};
const router = new HarmonyTtsHostRouter(system, http, media, background);
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
assert.equal(router.isBackgroundPlaybackActive(), true);
assert.ok(background.calls.includes('activate'));
await router.deactivateAudioSession();
assert.equal(router.isBackgroundPlaybackActive(), false);
assert.ok(background.calls.includes('deactivate'));
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
assert.ok(background.calls.includes('close'));

const httpHostSource = await readFile(
  new URL('../entry/src/main/ets/app/HarmonyHttpTtsHost.ts', import.meta.url),
  'utf8',
);
assert.match(httpHostSource, /gateway\.buildRequest\(configId, request\.text\)/);
assert.match(httpHostSource, /expectDataType: http\.HttpDataType\.ARRAY_BUFFER/);
assert.match(httpHostSource, /HTTP_TTS_MAX_AUDIO_BYTES/);
assert.match(httpHostSource, /request\.destroy\(\)/);
assert.match(httpHostSource, /private activeRequest: http\.HttpRequest \| null = null/);
assert.match(httpHostSource, /private rejectActiveRequest:/);
assert.match(httpHostSource, /this\.cancelActiveRequest\('Reader HttpTTS audio request stopped'\)/);
assert.match(httpHostSource, /const response = await Promise\.race\(\[/);
assert.match(httpHostSource, /if \(this\.activeRequest === request\)/);
assert.match(httpHostSource, /player\.dataSrc = this\.createDataSource\(bytes\)/);
assert.match(httpHostSource, /fileSize: bytes\.length/);
assert.match(httpHostSource, /target\.set\(bytes\.subarray\(start, start \+ count\), 0\)/);
assert.match(httpHostSource, /generation !== this\.speakGeneration/);
assert.match(
  httpHostSource,
  /gateway\.buildRequest\(configId, request\.text\);\s+if \(this\.closed \|\| generation !== this\.speakGeneration\) return;/,
  'a stop during descriptor construction must not start a late audio request',
);
assert.doesNotMatch(httpHostSource, /createMediaSourceWithUrl/);
assert.match(httpHostSource, /await player\.prepare\(\)/);
assert.match(httpHostSource, /await player\.play\(\)/);
assert.match(httpHostSource, /type: 'complete', requestId, completion: 'audio'/);
assert.match(httpHostSource, /await player\.release\(\)/);

const backgroundSource = await readFile(
  new URL('../entry/src/main/ets/app/HarmonyTtsBackgroundSession.ts', import.meta.url),
  'utf8',
);
assert.match(backgroundSource, /backgroundTaskManager\.startBackgroundRunning\([\s\S]*?\['audioPlayback'\]/);
assert.match(backgroundSource, /backgroundTaskManager\.stopBackgroundRunning\(this\.context\)/);
assert.match(backgroundSource, /wantAgent\.OperationType\.START_ABILITY/);
assert.match(backgroundSource, /this\.context\.abilityInfo\.bundleName/);
assert.match(backgroundSource, /canIUse\('SystemCapability\.ResourceSchedule\.BackgroundTaskManager\.ContinuousTask'\)/);
assert.doesNotMatch(backgroundSource, /ReaderTtsSessionCoordinator|tts\.queue|ReaderCoreRuntime/,
  'the platform lease must not become another TTS state machine');

console.log('Harmony TTS Host router and HttpTTS transport contract: PASS');

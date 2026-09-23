import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { readFile } from 'node:fs/promises';

import { HarmonyTtsHostRouter } from '../entry/src/main/ets/app/HarmonyTtsHostRouter.ts';

class FakeHost {
  constructor(kind) { this.kind = kind; }
  calls = [];
  listener;
  listenerOwner;
  setEventListener(listener, owner) { this.listener = listener; this.listenerOwner = owner; }
  clearEventListener(owner) {
    if (this.listenerOwner !== owner) return;
    this.listener = undefined;
    this.listenerOwner = undefined;
  }
  async selectEngine(engine) {
    this.calls.push(`select:${engine ?? 'system'}`);
    return this.kind === 'http' ? engine?.startsWith('http-tts:') === true : !engine?.startsWith('http-tts:');
  }
  async probe() { this.calls.push('probe'); return { available: true }; }
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

const resilientSystem = new FakeHost('system');
const resilientHttp = new FakeHost('http');
const unavailableMedia = {
  setEventListener() {},
  async activate() { throw new Error('AVSession unavailable'); },
  publish() {},
  async close() {},
};
const deniedBackground = {
  async activate() { throw new Error('background lease denied'); },
  async deactivate() {},
  isActive() { return false; },
  async close() {},
};
const resilientRouter = new HarmonyTtsHostRouter(
  resilientSystem,
  resilientHttp,
  unavailableMedia,
  deniedBackground,
);
await resilientRouter.activateAudioSession(false);
await resilientRouter.speak({
  requestId: 'foreground-without-auxiliary-sessions',
  text: '辅助会话不可用时仍应朗读。',
  rate: 1,
  pitch: 1,
  language: 'zh-CN',
});
assert.ok(resilientSystem.calls.includes('activate:false'));
assert.ok(resilientSystem.calls.includes('speak:foreground-without-auxiliary-sessions'));
assert.equal((await resilientRouter.probe()).available, true,
  'router probe must delegate to the active transport');
await resilientRouter.close();

// Owner-scoped listener teardown: a torn-down page must not drop a newer
// page's listener on the shared router.
const sharedRouter = new HarmonyTtsHostRouter(new FakeHost('system'), new FakeHost('http'), {
  setEventListener() {},
  activate: async () => {},
  publish() {},
  close: async () => {},
});
const pageAEvents = [];
const pageBEvents = [];
sharedRouter.setEventListener(event => pageAEvents.push(event), 'coordinator-A');
sharedRouter.setEventListener(event => pageBEvents.push(event), 'coordinator-B');
sharedRouter.clearEventListener('coordinator-A');
sharedRouter.system.emit({ type: 'start', requestId: 'after-teardown' });
assert.equal(pageAEvents.length, 0, 'stale coordinator must not receive events after replacement');
assert.equal(pageBEvents.length, 1, 'clearing an old owner must keep the new owner listener');
sharedRouter.clearEventListener('coordinator-B');
sharedRouter.system.emit({ type: 'start', requestId: 'after-final-teardown' });
assert.equal(pageBEvents.length, 1, 'clearing the current owner must detach the listener');

const httpHostSource = await readFile(
  new URL('../entry/src/main/ets/app/HarmonyHttpTtsHost.ts', import.meta.url),
  'utf8',
);
assert.match(httpHostSource, /gateway\.buildRequest\(configId, request\.text, ratePercent\)/,
  'HttpTTS must forward the exact five-point speed percentage to Core');
assert.match(httpHostSource, /HTTP_TTS_MAX_AUDIO_BYTES/);
assert.match(httpHostSource, /HttpExecuteHost\.instance\.executeBytes\(/,
  'HttpTTS must reuse the hardened redirect/DNS transport');
assert.match(httpHostSource, /followRedirects: true/);
assert.match(httpHostSource, /maxRedirects: HTTP_TTS_MAX_REDIRECTS/);
assert.match(httpHostSource, /httpsOnly: true/,
  'HttpTTS must reject cleartext redirect downgrades');
assert.match(httpHostSource, /sameOriginRedirectsOnly: descriptor\.playback\?\.credentialRef !== undefined/,
  'all credential-bearing redirects, including custom headers, must remain on the same effective origin');
assert.match(httpHostSource, /admittedGeneration !== this\.networkGeneration/,
  'stop/close must cancel the shared transport through its ownership probe');
assert.doesNotMatch(httpHostSource, /Base64Helper|bodyBase64/);
assert.match(httpHostSource, /descriptor\.method/);
assert.match(httpHostSource, /descriptor\.body/);
assert.match(httpHostSource, /normalizeAudioBytes/);
assert.match(httpHostSource, /ReaderTtsCredentialStore\.instance\.read/);
assert.match(httpHostSource, /fetchAudio\(descriptor, configId\)/,
  'HttpTTS must bind credential resolution to the config selected for this request');
assert.match(httpHostSource, /isReaderTtsCredentialAliasForConfig\(playback\.credentialRef, configId\)/,
  'HttpTTS must reject credential aliases belonging to another config');
assert.match(httpHostSource, /read\(playback\.credentialRef, configId\)/,
  'credential store reads must carry the selected config id');
assert.match(httpHostSource, /requestUrl = this\.expandCredentialPlaceholder\(/,
  'URL credential placeholders must be resolved only in the Host');
assert.match(httpHostSource, /encodedSecret = encodeURIComponent\(secret\)/,
  'URL credential placeholders must be component-encoded before transport');
assert.match(httpHostSource, /expandCredentialPlaceholder\(/,
  'credential expansion must be bounded before allocating the final URL/header');
assert.match(httpHostSource, /hasUrlPlaceholder = descriptor\.url\.includes\('\{\{apiKey\}\}'\)/,
  'URL credential placeholders must satisfy the alias/header admission check');
assert.doesNotMatch(httpHostSource, /http\.createHttp\(\)|request\.request\(/,
  'HttpTTS must not keep a second unguarded HTTP implementation');
assert.match(httpHostSource, /this\.cancelActiveRequest\('Reader HttpTTS audio request stopped'\)/);
assert.match(httpHostSource, /player\.dataSrc = this\.createDataSource\(bytes\)/);
assert.match(httpHostSource, /fileSize: bytes\.length/);
assert.match(httpHostSource, /target\.set\(bytes\.subarray\(start, start \+ count\), 0\)/);
assert.match(httpHostSource, /generation !== this\.speakGeneration/);
assert.match(
  httpHostSource,
  /gateway\.buildRequest\(configId, request\.text, ratePercent\);\s+if \(this\.closed \|\| generation !== this\.speakGeneration\) return;/,
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

// Exercise the Host-only credential expansion without constructing platform
// audio objects. Private methods remain normal ArkTS methods after erasure;
// this probe supplies only their explicit credential-store dependencies.
const executableHost = httpHostSource
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace('export class HarmonyHttpTtsHost', 'class HarmonyHttpTtsHost');
const hostPrelude = `
const audio = {}; const media = {}; const hilog = {warn(){}, error(){}, info(){}};
const errorMessageOf = error => error instanceof Error ? error.message : String(error);
const ReaderHttpTtsGateway = class {};
const isReaderTtsCredentialAliasForConfig = (alias, id) => alias === 'reader.tts.' + id + '.fixture-token';
globalThis.auditCredentialFixture = 'a&b/c?d#e';
const ReaderTtsCredentialStore = {instance: {read: async () => globalThis.auditCredentialFixture}};
const HttpExecuteHost = {};
const isCrossOriginSensitiveHeader = () => false;
`;
const hostModule = await import(`data:text/javascript;base64,${Buffer.from(
  hostPrelude + stripTypeScriptTypes(executableHost) + '\nexport {HarmonyHttpTtsHost};',
).toString('base64')}`);
const hostProbe = Object.create(hostModule.HarmonyHttpTtsHost.prototype);
const resolved = await hostProbe.resolveRequest({
  url: 'https://tts.example.test/audio?token={{apiKey}}',
  headers: {},
  playback: {
    format: 'mp3', sampleFormat: 's16le', ratePercent: 100, rateApplied: true,
    credentialRef: 'reader.tts.42.fixture-token', credentialPrefix: '',
  },
}, 42);
assert.equal(resolved.url, 'https://tts.example.test/audio?token=a%26b%2Fc%3Fd%23e');
assert.deepEqual(resolved.headers, {});
// Header replacement must treat the secret literally; `$&` has special
// meaning to String.replace when a replacement string is passed directly.
globalThis.auditCredentialFixture = 'a$&b';
const headerResolved = await hostProbe.resolveRequest({
  url: 'https://tts.example.test/audio',
  headers: {'X-Token': 'pre-{{apiKey}}-post'},
  playback: {
    format: 'mp3', sampleFormat: 's16le', ratePercent: 100, rateApplied: true,
    credentialRef: 'reader.tts.42.fixture-token', credentialPrefix: '',
  },
}, 42);
assert.equal(headerResolved.headers['X-Token'], 'pre-a$&b-post');
const oversizedUrl = {
  url: `https://tts.example.test/audio?token=${'{{apiKey}}'.repeat(300)}`,
  headers: {},
  playback: {
    format: 'mp3', sampleFormat: 's16le', ratePercent: 100, rateApplied: true,
    credentialRef: 'reader.tts.42.fixture-token', credentialPrefix: '',
  },
};
globalThis.auditCredentialFixture = 's'.repeat(8192);
await assert.rejects(() => hostProbe.resolveRequest(oversizedUrl, 42), /request URL exceeds/);
const oversizedHeader = {
  url: 'https://tts.example.test/audio',
  headers: {'X-Key': '{{apiKey}}'.repeat(9)},
  playback: {
    format: 'mp3', sampleFormat: 's16le', ratePercent: 100, rateApplied: true,
    credentialRef: 'reader.tts.42.fixture-token', credentialPrefix: '',
  },
};
await assert.rejects(() => hostProbe.resolveRequest(oversizedHeader, 42), /credential header exceeds/);
console.log('Harmony HttpTTS credential URL encoding and expansion bounds: PASS');

console.log('Harmony TTS Host router and HttpTTS transport contract: PASS');

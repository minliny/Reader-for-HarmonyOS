import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ReaderStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';
import { HarmonyTtsHostRouter } from '../entry/src/main/ets/app/HarmonyTtsHostRouter.ts';
import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts';
import { chapter, canonicalRemoteContent, FakeGateway, FakeHost } from './lib/reader-tts-fixtures.mjs';

// Whole production platform adapter, with only unavailable Kit bindings supplied.
// Invoking this real SpeakListener is code proof, never a device onStart receipt.
const source = readFileSync(new URL('../entry/src/main/ets/app/HarmonySystemTtsHost.ts', import.meta.url), 'utf8');
const engines = [];
let createGate;
const makeEngine = () => {
  const engine = { calls: [], setListener(listener) { this.listener = listener; },
    speak(text, params) { this.calls.push(['speak', params.requestId]); },
    stop() { this.calls.push(['stop']); }, shutdown() { this.calls.push(['shutdown']); } };
  engines.push(engine); return engine;
};
const lease = { createOwner: () => 'system-test', async activate() {}, async deactivate() {} };
const manager = { on() {}, off() {} };
const SystemHost = new Function('harmonyTtsAudioSessionLease', 'textToSpeech', 'audio', 'hilog', 'errorMessageOf',
  stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '')).replace(/\bexport /g, '') +
  ';return HarmonySystemTtsHost;')(lease, { createEngine: async () => createGate ? await createGate : makeEngine() },
    { getAudioManager: () => ({ getSessionManager: () => manager }) }, { error() {} }, error => error.message);
let at = 100;
const rows = [];
ReaderStartupTrace.install(() => ++at, row => rows.push(row), true, true);
const media = { setEventListener() {}, async activate() {}, publish() {}, async close() {} };
let revoke;
const background = { setRevocationListener(listener) { revoke = listener; }, async activate() { return true; },
  async deactivate() {}, isActive() { return true; }, async close() {} };
const http = Object.assign(new FakeHost(), { async close() {} });
const system = new SystemHost();
const router = new HarmonyTtsHostRouter(system, http, media, background, () => false);
const coordinator = new ReaderTtsSessionCoordinator(new FakeGateway(), router);
await coordinator.start({ chapter, content: canonicalRemoteContent, contentVersion: 1, scalarPosition: 0 });
assert.equal(coordinator.getState().status, 'preparing');
assert.equal(rows.some(row => row.stage === 'tts.platform-start'), false,
  'accepted speak cannot manufacture platform start');
const requestId = coordinator.getState().requestId;
engines.at(-1).listener.onStart(requestId, {});
await coordinator.whenSettled();
assert.equal(coordinator.getState().status, 'playing');
const operationId = rows.find(row => row.stage === 'tts.intent').operationId;
assert.equal(rows.find(row => row.stage === 'tts.platform-start').operationId, operationId);
revoke();
await coordinator.whenSettled();
await coordinator.stop();
const starts = rows.filter(row => row.stage === 'tts.platform-start').length;
engines.at(-1).listener.onStart(requestId, {});
await coordinator.whenSettled();
assert.equal(rows.filter(row => row.stage === 'tts.platform-start').length, starts,
  'retired request/generation cannot create new start sample');
await coordinator.dispose();
await router.close();
for (const stage of ['tts.intent', 'tts.speak-dispatch', 'tts.platform-start', 'tts.background-revoke',
  'tts.stop-intent', 'tts.host-stop', 'tts.host-stop-ack', 'tts.audio-release', 'tts.listener-release',
  'tts.owner-release', 'tts.host-release']) {
  assert.ok(rows.some(row => row.stage === stage && row.operationId === operationId), stage);
}
assert.ok(rows.every(row => row.evidence === 'application-code' && row.uptimeMs > 0));
assert.ok(rows.every((row, i) => i === 0 || row.uptimeMs > rows[i - 1].uptimeMs));
assert.equal(JSON.stringify(rows).includes(canonicalRemoteContent), false);
for (const forbidden of ['text', 'requestId', 'bookId', 'chapterIndex', 'sourceId', 'url', 'credential']) {
  assert.ok(rows.every(row => !(forbidden in row)), forbidden);
}

// Execute original callbacks from an engine retired by a voice change.
const replaced = new SystemHost(), delivered = [];
replaced.setEventListener(event => delivered.push(event), 'owner');
const request = { requestId: 'original', text: 'private text', rate: 1, pitch: 1, language: 'zh-CN', person: 0 };
await replaced.speak(request);
const retiredEngine = engines.at(-1);
await replaced.speak({ ...request, requestId: 'replacement', language: 'en-US', person: 1 });
retiredEngine.listener.onStart('replacement', {});
assert.equal(delivered.length, 0, 'old engine rejected even with current request id');
engines.at(-1).listener.onStart('replacement', {});
assert.deepEqual(delivered, [{ type: 'start', requestId: 'replacement' }]);
await replaced.close();

// Stop during asynchronous engine initialization must prevent the later speak.
let releaseEngine;
createGate = new Promise(resolve => { releaseEngine = resolve; });
const pending = new SystemHost();
const speaking = pending.speak(request);
await pending.stop();
const delayedEngine = makeEngine(); releaseEngine(delayedEngine);
await assert.rejects(speaking, /engine initialization retired/);
assert.equal(delayedEngine.calls.some(call => call[0] === 'speak'), false);
await pending.close(); createGate = undefined;

// A predecessor creation can finish after stop and a successor's real engine.
// Execute both real ensureEngine admissions in the reversed completion order.
let releaseOldEngine;
createGate = new Promise(resolve => { releaseOldEngine = resolve; });
const overlapped = new SystemHost(), overlapEvents = [];
overlapped.setEventListener(event => overlapEvents.push(event), 'successor-owner');
const oldSpeaking = overlapped.speak({ ...request, requestId: 'old-owner' });
await overlapped.stop();
createGate = undefined;
await overlapped.speak({ ...request, requestId: 'new-owner' });
const successorEngine = engines.at(-1);
const lateEngine = makeEngine(); releaseOldEngine(lateEngine);
await assert.rejects(oldSpeaking, /engine initialization retired/);
assert.equal(lateEngine.calls.filter(call => call[0] === 'shutdown').length, 1);
assert.equal(overlapped.engine, successorEngine, 'late predecessor cannot overwrite successor engine');
successorEngine.listener.onStart('new-owner', {});
assert.deepEqual(overlapEvents, [{ type: 'start', requestId: 'new-owner' }]);
await overlapped.close();
assert.equal(successorEngine.calls.filter(call => call[0] === 'shutdown').length, 1,
  'close must release the surviving successor engine');

// A successor owner must not accept a predecessor's numerically identical session.
const shared = new FakeHost();
const first = new ReaderTtsSessionCoordinator(new FakeGateway(), shared);
await first.start({ chapter, content: canonicalRemoteContent, contentVersion: 2, scalarPosition: 0 });
const firstRequest = shared.requests.at(-1).requestId;
await first.dispose();
const second = new ReaderTtsSessionCoordinator(new FakeGateway(), shared);
await second.start({ chapter, content: canonicalRemoteContent, contentVersion: 2, scalarPosition: 0 });
assert.notEqual(shared.requests.at(-1).requestId, firstRequest);
shared.emit({ type: 'start', requestId: firstRequest });
await second.whenSettled();
assert.equal(second.getState().status, 'preparing');
shared.clearEventListener(first.ownerToken);
assert.equal(shared.listenerOwner, second.ownerToken);
await second.dispose();

// Original synchronous/async Host failures still fail; never create start.
const failingSystem = Object.assign(new FakeHost(), { async close() {}, async speak() { throw Error('private failure'); } });
const failingRouter = new HarmonyTtsHostRouter(failingSystem, http, media);
const failing = new ReaderTtsSessionCoordinator(new FakeGateway(), failingRouter);
await failing.start({ chapter, content: canonicalRemoteContent, contentVersion: 3, scalarPosition: 0 });
assert.equal(failing.getState().status, 'error');
const failureId = rows.filter(row => row.stage === 'tts.intent').at(-1).operationId;
assert.ok(rows.some(row => row.operationId === failureId && row.stage === 'tts.speak-failure'));
assert.equal(rows.some(row => row.operationId === failureId && row.stage === 'tts.platform-start'), false);
assert.equal(JSON.stringify(rows).includes('private failure'), false);
await failing.dispose(); await failingRouter.close();

const traceSource = readFileSync(new URL('../entry/src/main/ets/app/ReaderStartupTrace.ts', import.meta.url), 'utf8');
for (const enabled of [true, false]) {
  const { ReaderStartupTrace: Isolated } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(traceSource) + `\n// ${enabled}`).toString('base64')}`);
  let clock = 0, logs = 0;
  const trace = Isolated.install(() => { clock++; return 1; }, () => logs++, enabled, false);
  const before = clock;
  assert.equal(Isolated.currentTts(), undefined);
  assert.equal(trace.beginTtsOperation(), 0);
  trace.markTts('tts.intent', 1);
  assert.equal(clock, before); assert.equal(logs, 0);
  Isolated.install(() => assert.fail('warm clock'), () => assert.fail('warm log'), true, true);
  assert.equal(Isolated.currentTts(), undefined, 'warm caller cannot enable diagnostics');
}
const ability = readFileSync(new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url), 'utf8');
assert.match(ability, /DEBUG === true && BUILD_MODE_NAME === 'debug', want\.parameters\?\.readerTtsTrace === true/);
console.log('TTS trace PASS: real production adapter/callback seams, shared monotonic operation identity, stop/revoke/release, failure, old engine/owner/generation rejection, normal/release zero TTS sampling; DEVICE NOT RUN');

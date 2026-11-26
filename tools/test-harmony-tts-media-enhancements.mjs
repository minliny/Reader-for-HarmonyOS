import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import * as ratePolicy from '../entry/src/main/ets/features/reading/application/ReaderTtsState.ts';
import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/application/ReaderTtsSessionCoordinator.ts';
import { HarmonyTtsHostRouter } from '../entry/src/main/ets/platform/tts/HarmonyTtsHostRouter.ts';
import { chapter, canonicalRemoteContent, FakeGateway, FakeHost } from './lib/reader-tts-fixtures.mjs';

const source = readFileSync(new URL(
  '../entry/src/main/ets/platform/tts/HarmonyTtsMediaSession.ts', import.meta.url), 'utf8');
const playback = { PLAYBACK_STATE_PREPARE: 1, PLAYBACK_STATE_PLAY: 2, PLAYBACK_STATE_PAUSE: 3,
  PLAYBACK_STATE_COMPLETED: 4, PLAYBACK_STATE_ERROR: 5, PLAYBACK_STATE_STOP: 6 };
const background = { ENABLE_BACKGROUND_PLAY: 0, DISABLE_BACKGROUND_PLAY: 1 };
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };

function fixture(version, api26 = true) {
  const calls = [], accesses = [], listeners = new Map(), events = [], faults = {};
  const session = {
    async setAVMetadata() { calls.push(['metadata']); },
    async activate() { calls.push(['activate']); },
    async deactivate() { calls.push(['deactivate']); },
    async destroy() { calls.push(['destroy']); },
    on(name, listener) { calls.push(['on', name]); listeners.set(name, listener); },
    off(name) { calls.push(['off', name]); listeners.delete(name); },
    async setAVPlaybackState(state) { calls.push(['playback', state]); },
    get setBackgroundPlayMode() {
      accesses.push('setBackgroundPlayMode');
      assert.ok(version >= 60101, 'API 23 must not even reference API 24 properties');
      return async mode => {
        calls.push(['background', mode]);
        if (faults.background) throw Error('background API unavailable');
      };
    },
    get setSupportedPlaySpeeds() {
      accesses.push('setSupportedPlaySpeeds');
      assert.ok(version >= 260000 && api26, 'must not read API 26 property without admission');
      return async rates => {
        calls.push(['rates', rates]);
        await faults.speedAdmission;
        if (faults.speed) throw Error('speed API unavailable');
      };
    },
    get setMediaCenterControlType() {
      accesses.push('setMediaCenterControlType');
      assert.ok(version >= 260000 && api26, 'must not read API 26 property without admission');
      return async ids => { calls.push(['controls', ids]); };
    },
  };
  const avSession = { async createAVSession() {
    calls.push(['create']);
    return Object.defineProperties({}, Object.getOwnPropertyDescriptors(session));
  }, PlaybackState: playback,
    get BackgroundPlayMode() {
      accesses.push('BackgroundPlayMode');
      assert.ok(version >= 60101, 'API 23 must not read API 24 enum');
      return background;
    } };
  const deviceInfo = { distributionOSApiVersion: version,
    apiAvailable: target => {
      accesses.push('apiAvailable');
      assert.ok(version >= 260000, 'API 26 check is itself API 26');
      calls.push(['available', target]);
      return api26;
    } };
  const deps = { avSession, deviceInfo, hilog: { error() {} }, ...ratePolicy };
  const code = stripTypeScriptTypes(source.replace(/^import[^;]*;\s*/gm, '')).replace(/^export /gm, '');
  const Media = new Function(...Object.keys(deps), code + ';return HarmonyTtsMediaSession;')(...Object.values(deps));
  const owner = new Media({});
  owner.setEventListener(event => events.push(event));
  return { owner, calls, accesses, listeners, events, faults };
}

test('API 23 activates and publishes the original AVSession without touching enhanced APIs', async () => {
  const f = fixture(60100);
  f.owner.setBackgroundPlaybackEnabled(true);
  await f.owner.activate();
  f.owner.publish('playing', 1.35);
  await tick();
  assert.deepEqual(f.accesses, []);
  assert.deepEqual(f.calls.filter(call => ['background', 'available', 'rates', 'controls'].includes(call[0])), []);
  assert.deepEqual(f.calls.at(-1), ['playback', { state: 2 }]);
  await f.owner.close();
});

test('API 24 and API 26 with failed version admission advertise only truthful background mode', async () => {
  for (const version of [60101, 260000]) {
    const f = fixture(version, false);
    await f.owner.activate();
    f.owner.setBackgroundPlaybackEnabled(true);
    await tick();
    f.owner.setBackgroundPlaybackEnabled(false);
    await tick();
    assert.deepEqual(f.calls.filter(call => call[0] === 'background'), [['background', 1], ['background', 0], ['background', 1]]);
    assert.deepEqual(f.accesses.filter(entry => !['setBackgroundPlayMode', 'BackgroundPlayMode'].includes(entry)),
      version === 60101 ? [] : ['apiAvailable']);
    assert.deepEqual(f.calls.filter(call => ['available', 'rates', 'controls'].includes(call[0])),
      version === 60101 ? [] : [['available', '26.0.0']]);
    await f.owner.close();
  }
});

test('replacing an incomplete native session republishes the previously acknowledged background mode', async () => {
  const f = fixture(60101);
  f.owner.setBackgroundPlaybackEnabled(true);
  await f.owner.activate();
  const first = f.owner.session;
  // Model the defensive session replacement lane, where the platform handle
  // exists with an acknowledged mode but initialization no longer qualifies.
  f.owner.initialized = false;
  f.owner.publish('playing');
  await tick();
  assert.notEqual(f.owner.session, first);
  assert.deepEqual(f.calls.filter(([event]) => ['create', 'background', 'destroy'].includes(event)),
    [['create'], ['background', 0], ['destroy'], ['create'], ['background', 0]]);
  await f.owner.close();
});

test('API 26 publishes the actual rate steps, rejects invalid controls, and retires the precise speed callback', async () => {
  const f = fixture(260000);
  await f.owner.activate();
  const rates = f.calls.find(call => call[0] === 'rates')[1];
  assert.equal(rates.length, 31);
  assert.deepEqual(rates.slice(0, 4), [0.5, 0.55, 0.6, 0.65]);
  assert.deepEqual(rates.slice(-4), [1.85, 1.9, 1.95, 2]);
  assert.deepEqual(f.calls.find(call => call[0] === 'controls'), ['controls', ['playPrevious', 'playNext', 'setSpeed']]);
  const speed = f.listeners.get('setSpeed');
  for (const rejected of [NaN, Infinity, 0.45, 1.333, 2.05]) speed(rejected);
  speed(1.35);
  assert.deepEqual(f.events, [{ type: 'mediaRate', rate: 1.35 }]);
  f.owner.publish('playing', 1.35);
  await tick();
  assert.deepEqual(f.calls.at(-1), ['playback', { state: 2, speed: 1.35 }]);
  await f.owner.close();
  speed(1.5);
  assert.equal(f.events.length, 1);
  assert.equal(f.calls.filter(call => call[0] === 'off' && call[1] === 'setSpeed').length, 1);
});

test('Optional AVSession rejection preserves the base transport controls', async () => {
  const f = fixture(260000);
  f.faults.background = true;
  f.faults.speed = true;
  await f.owner.activate();
  f.listeners.get('pause')();
  assert.deepEqual(f.events, [{ type: 'mediaControl', action: 'pause' }]);
  assert.equal(f.listeners.has('setSpeed'), false);
  f.faults.background = false;
  f.owner.setBackgroundPlaybackEnabled(true);
  await tick();
  assert.deepEqual(f.calls.filter(call => call[0] === 'background'), [['background', 1], ['background', 0]]);
  await f.owner.close();
});

test('Retiring during API 26 initialization prevents late control registration', async () => {
  const f = fixture(260000);
  const admission = deferred();
  f.faults.speedAdmission = admission.promise;
  const started = f.owner.activate();
  await tick();
  assert.ok(f.calls.some(call => call[0] === 'rates'));
  const closed = f.owner.close();
  admission.resolve();
  await assert.rejects(started, /closed during initialization/);
  await closed;
  assert.equal(f.listeners.has('setSpeed'), false);
  assert.equal(f.calls.filter(call => call[0] === 'activate').length, 0);
  assert.equal(f.calls.filter(call => call[0] === 'destroy').length, 1);
});

test('Host router reports actual continuous playback admission, revocation, and preference changes', async () => {
  const modes = [];
  const pending = deferred();
  let revoked, foreground = true;
  const lease = { active: false,
    setRevocationListener(listener) { revoked = listener; },
    isActive() { return this.active; },
    async activate() { await pending.promise; this.active = true; return true; },
    async deactivate() { this.active = false; },
    async close() { this.active = false; } };
  const speech = new FakeHost(), http = new FakeHost();
  speech.close = http.close = async () => {};
  const router = new HarmonyTtsHostRouter(speech, http, {
    setBackgroundPlaybackEnabled(enabled) { modes.push(enabled); },
    setEventListener() {}, async activate() {}, publish() {}, async close() {},
  }, lease, () => foreground);
  const events = [];
  router.setEventListener(event => events.push(event), 'reader');
  await router.activateAudioSession(false);
  assert.equal(modes.includes(true), false, 'preference cannot imply an active lease');
  pending.resolve(); await tick();
  assert.equal(modes.at(-1), true);
  foreground = false; lease.active = false; revoked();
  assert.equal(modes.at(-1), false);
  assert.deepEqual(events, [{ type: 'backgroundLeaseRevoked' }]);
  router.setBackgroundPlaybackEnabled(false);
  router.setBackgroundPlaybackEnabled(true);
  await tick();
  assert.equal(modes.at(-1), true);
  await router.deactivateAudioSession();
  assert.equal(modes.at(-1), false);
  await router.close();
});

test('Native speed requests use the active reading owner and cannot modify an idle or retired coordinator', async () => {
  const gateway = new FakeGateway(), host = new FakeHost(), applied = [];
  const coordinator = new ReaderTtsSessionCoordinator(gateway, host, undefined, undefined, undefined, {
    onMediaRate: rate => { applied.push(rate); },
  });
  const event = { type: 'mediaRate', rate: 1.25 };
  host.emit(event);
  assert.deepEqual(applied, []);
  try {
    await coordinator.start({ chapter, content: canonicalRemoteContent, contentVersion: 3, scalarPosition: 0 });
    host.emit(event);
    assert.deepEqual(applied, [1.25]);
  } finally { await coordinator.dispose(); }
  host.emit(event);
  assert.deepEqual(applied, [1.25]);
});

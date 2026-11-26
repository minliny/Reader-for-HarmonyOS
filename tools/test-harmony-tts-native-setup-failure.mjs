import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'http-player': { description: 'HTTP TTS retries release of the exact AVPlayer after native listener setup fails.', resources: [] },
  'http-stale-player': { description: 'HTTP TTS retires late-created AVPlayer after stop and retries failed release before creating a successor.', resources: [] },
  'system-engine': { description: 'System TTS retires an engine when installing its listener fails and retries shutdown before creating another.', resources: [] },
  'media-session': { description: 'Optional media session preserves setup failure when rollback also fails and retries the retired session on the next activation.', resources: [] },
};

function host(name, ports) {
  const path = new URL(`../entry/src/main/ets/platform/tts/${name}.ts`, import.meta.url);
  const source = readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '');
  const dependencies = { hilog: { error() {} }, errorMessageOf: error => error.message,
    harmonyTtsAudioSessionLease: { createOwner: () => 'test-transport' }, ...ports };
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name};`)(...Object.values(dependencies));
}

const request = { requestId: 'utterance-1', text: '朗读测试。', rate: 1, pitch: 1, language: 'zh-CN', person: 0 };

async function httpFixture(createAVPlayer) {
  const Host = host('HarmonyHttpTtsHost', {
    media: { createAVPlayer }, audio: { StreamUsage: { STREAM_USAGE_AUDIOBOOK: 1 } },
    ReaderHttpTtsGateway: class {
      async buildRequest() { return { url: 'https://tts.example.invalid/audio', method: 'GET', headers: {} }; }
    },
    HttpExecuteHost: { instance: { async executeBytes() { return { status: 200, bytes: new Uint8Array([1, 2, 3]) }; } } },
  });
  const owner = new Host({});
  assert.equal(await owner.selectEngine('http-tts:42'), true);
  return owner;
}

const checks = {
  async 'http-player'() {
    const setup = new Error('native player listener unavailable');
    const calls = [];
    let creates = 0;
    let releases = 0;
    const owner = await httpFixture(async () => {
      calls.push(`create:${++creates}`);
      if (creates > 1) return { state: 'idle', on() {}, async prepare() {}, async play() { calls.push('play'); }, async release() {} };
      return {
        state: 'idle', on(name) { if (name === 'error') throw setup; },
        async release() { calls.push(`release:first:${++releases}`); if (releases === 1) throw new Error('release failed'); },
      };
    });
    await assert.rejects(owner.speak(request), error => error === setup);
    assert.deepEqual(calls, ['create:1', 'release:first:1']);
    await owner.speak({ ...request, requestId: 'utterance-2' });
    assert.deepEqual(calls, ['create:1', 'release:first:1', 'release:first:2', 'create:2', 'play']);
    await owner.stop();
  },

  async 'http-stale-player'() {
    const calls = [];
    let enterCreation;
    const entered = new Promise(resolve => { enterCreation = resolve; });
    let deliver;
    const latePlayer = new Promise(resolve => { deliver = resolve; });
    let releases = 0;
    let creates = 0;
    const owner = await httpFixture(async () => {
      calls.push(`create:${++creates}`);
      if (creates === 1) { enterCreation(); return latePlayer; }
      return { state: 'idle', on() {}, async prepare() {}, async play() { calls.push('play'); }, async release() {} };
    });
    const pending = owner.speak(request);
    await entered;
    await owner.stop();
    deliver({ async release() { calls.push(`release:stale:${++releases}`); if (releases === 1) throw new Error('release failed'); } });
    await pending;
    await owner.speak({ ...request, requestId: 'utterance-2' });
    assert.deepEqual(calls, ['create:1', 'release:stale:1', 'release:stale:2', 'create:2', 'play']);
    await owner.stop();
  },

  async 'system-engine'() {
    const setup = new Error('native engine listener unavailable');
    const calls = [];
    let creates = 0;
    let releases = 0;
    const Host = host('HarmonySystemTtsHost', { textToSpeech: { async createEngine() {
      calls.push(`create:${++creates}`);
      if (creates > 1) return { setListener() {}, speak() { calls.push('speak'); } };
      return { setListener() { throw setup; }, stop() {}, shutdown() {
        calls.push(`shutdown:first:${++releases}`);
        if (releases === 1) throw new Error('shutdown failed');
      } };
    } } });
    const owner = new Host();
    await assert.rejects(owner.speak(request), error => error === setup);
    assert.deepEqual(calls, ['create:1', 'shutdown:first:1']);
    await owner.speak({ ...request, requestId: 'utterance-2' });
    assert.deepEqual(calls, ['create:1', 'shutdown:first:1', 'shutdown:first:2', 'create:2', 'speak']);
  },

  async 'media-session'() {
    const setup = new Error('AVSession metadata unavailable');
    const calls = [];
    let creates = 0;
    let releases = 0;
    const Host = host('HarmonyTtsMediaSession', { deviceInfo: { distributionOSApiVersion: 60100 }, avSession: { async createAVSession() {
      calls.push(`create:${++creates}`);
      if (creates > 1) return { async setAVMetadata() {}, on() {}, async activate() { calls.push('activate'); } };
      return { async setAVMetadata() { throw setup; }, off() {}, async deactivate() {}, async destroy() {
        calls.push(`destroy:first:${++releases}`);
        if (releases === 1) throw new Error('destroy failed');
      } };
    } } });
    const owner = new Host({});
    await assert.rejects(owner.activate(), error => error === setup);
    assert.equal(owner.isActive(), false);
    await owner.activate();
    assert.equal(owner.isActive(), true);
    assert.deepEqual(calls, ['create:1', 'destroy:first:1', 'destroy:first:2', 'create:2', 'activate']);
  },
};

for (const id of selectContractCases(cases)) {
  await checks[id]();
  recordContractCasePass(id);
}

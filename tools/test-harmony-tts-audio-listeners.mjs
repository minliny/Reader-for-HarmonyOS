import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const base = new URL('../entry/src/main/ets/platform/tts/', import.meta.url);
const events = ['audioSessionDeactivated', 'audioSessionStateChanged', 'currentOutputDeviceChanged'];
const definitions = {
  'rollback': 'Both production TTS Hosts roll back only their successful native registrations and preserve the original failure',
  'retirement': 'Both production TTS Hosts detach every owned listener independently and retry only retired ownership',
};

function source(name) {
  return readFileSync(new URL(`${name}.ts`, base), 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '');
}

function fixture(hostName) {
  const registered = new Map(events.map(event => [event, new Set()]));
  const calls = [];
  const errors = { install: new Map(), remove: new Map() };
  const warnings = [];
  const manager = {
    on(event, callback) {
      calls.push(['on', event]);
      if (errors.install.has(event)) throw errors.install.get(event);
      assert.equal(registered.get(event).has(callback), false, 'native callbacks cannot be registered twice');
      registered.get(event).add(callback);
    },
    off(event, callback) {
      calls.push(['off', event]);
      if (errors.remove.has(event)) throw errors.remove.get(event);
      assert.ok(registered.get(event).delete(callback), 'off must retain the registered callback identity');
    },
  };
  const lease = { createOwner: () => 'fixture', async activate() {}, async deactivate() {} };
  const log = { warn(...args) { warnings.push(args); }, error(...args) { warnings.push(args); } };
  const Host = new Function('audio', 'hilog', 'errorMessageOf', 'harmonyTtsAudioSessionLease', 'ReaderHttpTtsGateway',
    stripTypeScriptTypes(`${source('HarmonyTtsAudioListenerRegistry')}\n${source(hostName)}`) + `\nreturn ${hostName};`)(
    { getAudioManager: () => ({ getSessionManager: () => manager }) }, log, error => error.message, lease, class {},
  );
  return { Host, calls, errors, warnings, registered, remaining: () => events.map(event => registered.get(event).size) };
}

async function rollback(hostName) {
  for (const event of events.slice(1)) {
    const f = fixture(hostName);
    const host = new f.Host({});
    const original = new Error(`fail on ${event}`);
    f.errors.install.set(event, original);
    await assert.rejects(host.activateAudioSession(false), error => error === original);
    assert.deepEqual(f.remaining(), [0, 0, 0], 'partial installation must roll back before returning');
    f.errors.install.clear();
    await host.activateAudioSession(false);
    await host.activateAudioSession(false);
    assert.deepEqual(f.remaining(), [1, 1, 1], 'normal repeated activation retains one registration of each event');
    await host.close();
    assert.deepEqual(f.remaining(), [0, 0, 0]);
  }

  const f = fixture(hostName);
  const host = new f.Host({});
  const original = new Error('partially installed');
  f.errors.install.set(events[1], original);
  f.errors.remove.set(events[0], new Error('rollback temporarily denied'));
  await assert.rejects(host.activateAudioSession(false), error => error === original);
  const received = [];
  host.setEventListener(event => received.push(event), 'fixture');
  for (const callback of f.registered.get(events[0])) callback({});
  assert.deepEqual(received, [], 'a failed registration transaction does not admit native events');
  assert.deepEqual(f.remaining(), [1, 0, 0]);
  f.errors.install.clear();
  f.errors.remove.clear();
  await host.activateAudioSession(false);
  assert.deepEqual(f.remaining(), [1, 1, 1]);
  await host.close();
}

async function retirement(hostName) {
  const f = fixture(hostName);
  const host = new f.Host({});
  const received = [];
  host.setEventListener(event => received.push(event), 'fixture');
  await host.activateAudioSession(false);
  const originalCallback = [...f.registered.get(events[0])][0];
  f.errors.remove.set(events[0], new Error('temporarily unavailable'));
  await host.close();
  assert.deepEqual(f.calls.filter(([action]) => action === 'off').map(([, event]) => event), events);
  assert.deepEqual(f.remaining(), [1, 0, 0]);
  assert.ok(f.warnings.some(row => row.some(value => String(value).includes(events[0]))));
  originalCallback({});
  assert.deepEqual(received, [], 'a retained native callback cannot publish after close');
  f.errors.remove.clear();

  const successor = new f.Host({});
  f.calls.length = 0;
  await successor.activateAudioSession(false);
  assert.deepEqual(f.calls, [['off', events[0]], ...events.map(event => ['on', event])]);
  assert.equal(f.registered.get(events[0]).has(originalCallback), false);
  assert.deepEqual(f.remaining(), [1, 1, 1]);
  await host.close();
  assert.deepEqual(f.remaining(), [1, 1, 1], 'a repeated retirement cannot remove successor callbacks');
  await successor.close();
  assert.deepEqual(f.remaining(), [0, 0, 0]);
}

const cases = { rollback, retirement };
for (const id of selectContractCases(definitions)) {
  for (const hostName of ['HarmonySystemTtsHost', 'HarmonyHttpTtsHost']) await cases[id](hostName);
  recordContractCasePass(id);
}

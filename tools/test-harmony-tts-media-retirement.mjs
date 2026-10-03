import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL('../entry/src/main/ets/app/HarmonyTtsMediaSession.ts', import.meta.url), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const calls = [], callbacks = new Map(); let failDestroy = false, failOn = false;
  const session = {
    on(name, callback) { calls.push(['on', name]); if (failOn) throw Error('observer denied'); callbacks.set(name, callback); },
    off(name) { calls.push(['off', name]); callbacks.delete(name); },
    async activate() { calls.push(['activate']); },
    async deactivate() { calls.push(['deactivate']); },
    async destroy() { calls.push(['destroy']); if (failDestroy) throw Error('destroy failed'); },
    async setAVPlaybackState(state) { calls.push(['publish', state.state]); },
  };
  const native = { async createAVSession() { calls.push(['create']); return session; }, PlaybackState: {
    PLAYBACK_STATE_PREPARE: 1, PLAYBACK_STATE_PLAY: 2, PLAYBACK_STATE_PAUSE: 3,
    PLAYBACK_STATE_COMPLETED: 4, PLAYBACK_STATE_ERROR: 5, PLAYBACK_STATE_STOP: 6,
  } };
  const Class = new Function('avSession', 'hilog', stripTypeScriptTypes(source.replace(/^import[^;]*;\s*/gm, ''))
    .replace(/^export /gm, '') + ';return HarmonyTtsMediaSession;')(native, { error() {} });
  return { Class, owner: new Class({}), native, session, calls, callbacks,
    set failDestroy(value) { failDestroy = value; }, set failOn(value) { failOn = value; } };
}
{
  const f = fixture(), wait = deferred(); f.native.createAVSession = () => { f.calls.push(['create']); return wait.promise; };
  const start = f.owner.activate(); await tick(); const close = f.owner.close();
  wait.resolve(f.session); await assert.rejects(start, /closed during initialization/); await close;
  assert.equal(f.calls.filter(c => c[0] === 'on' || c[0] === 'activate').length, 0);
  assert.equal(f.calls.filter(c => c[0] === 'destroy').length, 1);
  assert.equal(f.owner.isActive(), false);
}
{
  const f = fixture(), wait = deferred(); f.session.activate = () => { f.calls.push(['activate']); return wait.promise; };
  const events = []; f.owner.setEventListener(e => events.push(e)); const start = f.owner.activate(); await tick();
  const latePlay = f.callbacks.get('play'), close = f.owner.close(); latePlay(); await tick();
  assert.equal(f.calls.filter(c => c[0] === 'destroy').length, 0, 'close awaits the already-dispatched native activation');
  assert.deepEqual(events, []); wait.resolve(); await start; await close;
  assert.equal(f.owner.isActive(), false); assert.equal(f.calls.filter(c => c[0] === 'destroy').length, 1);
}
{
  const f = fixture(); f.owner.publish('playing'); const close = f.owner.close(); await close;
  assert.equal(f.calls.length, 0, 'publish retired before dispatch never acquires a native session');
  await assert.rejects(f.owner.activate(), /closed/);
}
{
  const f = fixture(); f.failOn = true; await assert.rejects(f.owner.activate(), /observer denied/);
  assert.equal(f.calls.filter(c => c[0] === 'destroy').length, 1); await f.owner.close();
  assert.equal(f.calls.filter(c => c[0] === 'destroy').length, 1, 'listener-init cleanup is not destroyed twice');
}
{
  const f = fixture(); await f.owner.activate(); f.failDestroy = true;
  await assert.rejects(f.owner.close(), /destroy failed/); const next = new f.Class({});
  await assert.rejects(next.activate(), /destroy failed/);
  assert.equal(f.calls.filter(c => c[0] === 'create').length, 1, 'unreleased old identity blocks a successor');
  f.failDestroy = false; f.native.createAVSession = async () => { f.calls.push(['create']); return { ...f.session }; }; await next.activate(); const destroyAt = f.calls.findLastIndex(c => c[0] === 'destroy');
  assert.ok(destroyAt < f.calls.findLastIndex(c => c[0] === 'create'), 'exact old destroy receipt precedes successor creation');
  const count = f.calls.filter(c => c[0] === 'destroy').length; await f.owner.close();
  assert.equal(f.calls.filter(c => c[0] === 'destroy').length, count); await next.close();
  assert.equal(f.calls.filter(c => c[0] === 'destroy').length, count + 1);
}
{
  const f = fixture(), wait = deferred(); let creates = 0;
  f.native.createAVSession = () => { creates++; return creates === 1 ? wait.promise : Promise.resolve({ ...f.session }); };
  const first = f.owner.activate(); await tick(); const retired = f.owner.close(); const next = new f.Class({});
  const second = next.activate(); await tick(); assert.equal(creates, 1, 'successor awaits retired in-flight creation');
  wait.resolve(f.session); await assert.rejects(first, /closed during initialization/); await retired; await second;
  assert.equal(creates, 2); await next.close();
}
console.log('PASS actual AVSession owner: deferred create/activate retirement, no late controls or publish admission, partial-init cleanup, exact failed-release retry and successor barrier');

import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import * as state from '../entry/src/main/ets/features/reading/ReaderTtsPreferencesState.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const dir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const lreFile = new URL('LocalReadingExperience.ets', dir);
const gatewaySource = readFileSync(new URL('ReaderTtsPreferencesGateway.ts', dir), 'utf8');
let barrier = async () => {}, createStore;
const Gateway = new Function(...Object.keys(state), 'ReaderThemeHost', 'ReaderRuntimeOwner', 'preferences',
  `${stripTypeScriptTypes(gatewaySource.slice(gatewaySource.indexOf('const READER_TTS_PREFERENCES_NAME'))).replace('export class ', 'class ')}; return ReaderTtsPreferencesGateway;`)
  (...Object.values(state), { prepareUserChange: () => barrier() }, { isCurrent: () => true }, { getPreferences: (...args) => createStore(...args) });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(done => setImmediate(done)); };
function gatewayFixture() {
  let raw = '', live = true;
  const events = [];
  const store = { async get() { events.push('get'); return raw; }, async put(_key, value) { events.push('put'); raw = value; },
    async flush() { events.push('flush'); } };
  createStore = async () => store; barrier = async () => {};
  const owner = new Gateway({ getUIAbilityContext: () => ({}) });
  return { owner, store, events, current: () => live, retire() { live = false; }, raw: () => raw };
}
// Execute the full unmodified gateway. Identity is checked after every actual
// suspension that can precede the first put, not only at the UI call boundary.
for (const boundary of ['restore', 'store', 'read', 'serialization']) {
  const f = gatewayFixture(), gate = deferred();
  let first;
  if (boundary === 'restore') barrier = () => gate.promise;
  if (boundary === 'store') createStore = () => gate.promise;
  if (boundary === 'read') f.store.get = () => gate.promise;
  if (boundary === 'serialization') {
    f.store.flush = () => gate.promise;
    first = f.owner.update(state.createDefaultReaderTtsPreferencesSnapshot()); await settle();
  }
  const update = f.owner.update({ ...state.createDefaultReaderTtsPreferencesSnapshot(), allowMixing: true }, false, f.current);
  const failure = assert.rejects(update, /TTS_PREFERENCE_OWNER_SUPERSEDED/);
  await settle(); const before = f.events.filter(x => x === 'put').length;
  f.retire(); gate.resolve(boundary === 'store' ? f.store : boundary === 'read' ? '' : undefined);
  await failure; await first;
  assert.equal(f.events.filter(x => x === 'put').length, before, `${boundary}: superseded request never writes`);
}
{
  const f = gatewayFixture(), gate = deferred();
  f.store.put = async () => { f.events.push('put'); await gate.promise; };
  const update = f.owner.update(state.createDefaultReaderTtsPreferencesSnapshot(), false, f.current);
  await settle(); assert.deepEqual(f.events, ['get','put']);
  f.retire(); gate.resolve(); await update;
  assert.deepEqual(f.events, ['get','put','flush'], 'retirement after actual dispatch cannot cancel durable completion');
}
{
  const f = gatewayFixture(); barrier = () => assert.fail('reset-owned skips the user-change barrier');
  await f.owner.update(state.createDefaultReaderTtsPreferencesSnapshot(), true);
  assert.deepEqual(f.events, ['get','put','flush'], 'existing two-argument reset behavior stays compatible');
}

const mutations = [
  ['changeTtsAllowMixing', [true], 'ttsAllowMixing', true, 'setAllowMixing'],
  ['changeTtsBackgroundPlayback', [false], 'ttsBackgroundPlayback', false],
  ['changeTtsKeepScreenOn', [true], 'ttsKeepScreenOn', true, 'window'],
  ['changeTtsFailurePolicy', ['skip'], 'ttsFailurePolicy', 'skip'],
  ['changeTtsFollowHighlight', [false], 'ttsFollowHighlight', false],
  ['changeTtsPauseOnInterruption', [false], 'ttsPauseOnInterruption', false],
  ['changeTtsVoice', ['en-US', 7], 'ttsLanguage', 'en-US', 'setVoice'],
];
function readerFixture(file = lreFile) {
  const events = [], writes = [], nativeGate = deferred(), writeGate = deferred();
  let pendingPreferences = false;
  const coordinator = { setAllowMixing: async value => { events.push(['mixing', value]); await nativeGate.promise; },
    setVoice: async (language, person) => { events.push(['voice', language, person]); await nativeGate.promise; },
    setFailurePolicy: value => events.push(['policy',value]), setPauseOnInterruption: value => events.push(['pause',value]) };
  const Reader = productionMotionMethods(file, ['nextTtsPreferenceMutationGeneration', 'captureTtsPreferenceAdmission',
    'ttsPreferencesSnapshot', 'copyTtsPreferencesSnapshot', 'persistTtsPreferencesSnapshot', 'persistTtsPreferences', 'notifyTtsPreferencePending',
    'isSessionActive', ...mutations.map(x => x[0])], {
    ReaderRuntimeOwner: { current: () => ({ getTtsHost: () => ({ setBackgroundPlaybackEnabled: value => events.push(['background', value]) }) }) },
  });
  const owner = Object.assign(new Reader(), {
    mounted: true, lifecycleToken: 1, sourceId: 'source', bookId: 'book', exitRequested: false,
    ttsPreferenceMutationGeneration: 0, ttsCoordinator: coordinator,
    ttsLanguage: 'zh-CN', ttsPerson: 0, ttsPauseOnInterruption: true, ttsAllowMixing: false,
    ttsFailurePolicy: 'stop', ttsFollowHighlight: true, ttsBackgroundPlayback: true, ttsKeepScreenOn: false,
    ttsVoiceOptions: [{ language: 'en-US', person: 7 }],
    ttsPreferencesRecovery: { message: '', visible: false, canRetry: false, generation: 0 },
    controlsPresentedForWindow: () => false,
    applyReaderWindowPolicy: async () => { events.push(['window']); await nativeGate.promise; },
    ttsPreferencesGateway: { writeFacts: () => ({ pendingReconciliation: pendingPreferences }),
      update(snapshot, resetOwned, admission) { pendingPreferences = true; writes.push({ snapshot, resetOwned, admission });
        return writeGate.promise.then(() => { pendingPreferences = false; }); } },
    logTtsFailure: (...args) => events.push(['error', ...args]),
  });
  return { owner, events, writes, nativeGate, writeGate, setPending: value => { pendingPreferences = value; } };
}
function retire(f, boundary) {
  if (boundary === 'lifecycle') { f.owner.mounted = false; f.owner.lifecycleToken++; f.owner.mounted = true; }
  if (boundary === 'book') f.owner.bookId = 'new-book';
  if (boundary === 'coordinator') f.owner.ttsCoordinator = { setFailurePolicy: () => assert.fail('old receipt cannot mutate new policy'),
    setPauseOnInterruption: () => assert.fail('old receipt cannot mutate new policy') };
  if (boundary === 'generation') f.owner.ttsPreferenceMutationGeneration++;
}
async function runReaderCases(file = lreFile) {
  for (const [method, args, field, value, native] of mutations) for (const boundary of ['lifecycle','book','coordinator','generation']) {
    const f = readerFixture(file);
    f.owner[method](...args); await settle();
    if (native) {
      retire(f, boundary); f.owner[field] = 'new-owner-value';
      f.nativeGate.resolve(); await settle();
      assert.equal(f.writes.length, 0, `${method}/${boundary}: late native admission cannot dispatch preferences`);
      assert.equal(f.owner[field], 'new-owner-value');
    } else {
      assert.equal(f.writes.length, 1);
      assert.equal(f.writes[0].admission(), true);
      retire(f, boundary); f.owner[field] = 'new-owner-value';
      assert.equal(f.writes[0].admission(), false, `${method}/${boundary}: queued gateway admission retires`);
      const before = f.events.length;
      f.writeGate.reject(Error('old failed write')); await settle();
      assert.equal(f.events.length, before, `${method}/${boundary}: no late rollback/policy/error for a new owner`);
      assert.equal(f.owner[field], 'new-owner-value');
    }
  }
  for (const [method, args, field, value, native] of mutations) {
    const f = readerFixture(file); f.owner[method](...args); f.nativeGate.resolve(); await settle();
    assert.equal(f.writes.length, 1, `${method}: active request reaches existing gateway`);
    assert.equal(f.writes[0].resetOwned, false); assert.equal(f.writes[0].admission(), true);
    assert.equal(f.owner[field], value); assert.equal(f.owner.ttsPreferencesRecovery.visible, false,'ordinary in-flight preference save stays quiet');
    assert.equal(f.owner.ttsPreferencesRecovery.canRetry, false, 'quiet in-flight save has no duplicate retry');
    f.writeGate.resolve(); await settle(); assert.equal(f.owner.ttsPreferencesRecovery.visible, false);
  }
  for (const [method,args,field,value] of mutations) for (const pending of [false,true]) {
    const f=readerFixture(file);f.owner[method](...args);f.nativeGate.resolve();await settle();
    assert.equal(f.writes.length,1);assert.equal(f.owner.ttsPreferencesRecovery.visible,false);
    f.setPending(pending);f.writeGate.reject(Error('current preference write failed'));await settle();
    assert.equal(f.owner.ttsPreferencesRecovery.visible,true);assert.equal(f.owner.ttsPreferencesRecovery.canRetry,true);
    assert.match(f.owner.ttsPreferencesRecovery.message,pending?/保存尚未确认/:/未能保存/);
    assert.equal(f.owner[field],value,'failed save retains the current accepted selection');
    assert.equal(f.writes.length,1,'feedback cannot replay a preference write');
  }
}
await runReaderCases();
const scratch = mkdtempSync(join(tmpdir(), 'reader-tts-admission-'));
try {
  const mutated = join(scratch, 'LocalReadingExperience.ets');
  const source = readFileSync(lreFile, 'utf8');
  const start = source.indexOf('  private captureTtsPreferenceAdmission('), end = source.indexOf('\n  private ttsPreferencesSnapshot(', start);
  writeFileSync(mutated, source.slice(0, start) + `  private captureTtsPreferenceAdmission(generation: number): () => boolean {
    return (): boolean => generation === this.ttsPreferenceMutationGeneration;
  }\n` + source.slice(end));
  await assert.rejects(runReaderCases(mutated), /late native admission cannot dispatch preferences/,
    'old generation-only implementation is a real production-method negative control');
} finally { rmSync(scratch, { recursive: true, force: true }); }
console.log('PASS actual TTS preference gateway and seven LRE mutations: restore/serial/store/read predispatch guard, dispatched durable completion, lifecycle/book/coordinator/operation admission, native late ACK and rollback isolation, generation-only negative control. Native preference durability receipt remains separate.');

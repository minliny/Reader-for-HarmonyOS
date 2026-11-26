import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { ReaderTtsPreferenceHost, type ReaderTtsPreferenceAdmission, type ReaderTtsPreferenceStore } from
  '../../entry/src/main/ets/features/reading/application/ReaderTtsPreferenceHost.ts';
import { createDefaultReaderTtsPreferencesSnapshot, type ReaderTtsPreferencesPatch,
  type ReaderTtsPreferencesSnapshot, type ReaderTtsVoiceOption } from
  '../../entry/src/main/ets/features/reading/application/ReaderTtsPreferencesState.ts';

const voices: ReaderTtsVoiceOption[] = [
  { language: 'en-US', person: 9, label: 'English' },
  { language: 'zh-CN', person: 2, label: 'Mandarin' },
];

function fixture() {
  const load = Promise.withResolvers<ReaderTtsPreferencesSnapshot>();
  const base = createDefaultReaderTtsPreferencesSnapshot();
  const state = { owner: 0, pending: false, voices: [] as ReaderTtsVoiceOption[] };
  const calls: string[] = [];
  const saves: Array<{ patch: ReaderTtsPreferencesPatch; check: () => boolean;
    result: ReturnType<typeof Promise.withResolvers<ReaderTtsPreferencesSnapshot>> }> = [];
  const admissions: ReaderTtsPreferenceAdmission[] = [];
  const notices: Array<{ message: string; retry: boolean; busy: boolean }> = [];
  const store: ReaderTtsPreferenceStore = {
    load: () => { calls.push('load'); return load.promise; },
    writeFacts: () => ({ acceptedRevision: state.pending ? 1 : 0, savedRevision: 0,
      pendingReconciliation: state.pending, accepted: base, saved: base }),
    patch: (patch, check) => {
      const result = Promise.withResolvers<ReaderTtsPreferencesSnapshot>();
      saves.push({ patch, check: check ?? (() => true), result });
      return result.promise;
    },
    retryAccepted: async check => {
      assert.equal(check?.(), true);
      calls.push('retry-flush');
      state.pending = false;
      return base;
    },
  };
  const host = new ReaderTtsPreferenceHost(store, {
    captureOwner: () => { const captured = state.owner; return () => captured === state.owner; },
    voices: () => state.voices,
    publishVoices: values => { calls.push('voices'); state.voices = values; },
    admit: value => { calls.push('admit'); admissions.push(value); },
    notice: (message, retry, busy = false) => { notices.push({ message, retry, busy }); },
    log: (stage, error) => { calls.push(`${stage}:${error.message}`); },
  });
  const loadMetadata = (config: Promise<void>, names: Promise<ReaderTtsVoiceOption[]>) => {
    const captured = state.owner;
    return host.refreshMetadata(() => captured === state.owner,
      () => { calls.push('metadata'); return config; },
      () => { calls.push('list'); return names; }, message => calls.push(message));
  };
  return { host, load, loadMetadata, base, state, calls, saves, notices, admissions };
}

test('system voices and accepted preferences remain independent from slower HTTP configuration metadata', async () => {
  const reader = fixture();
  const config = Promise.withResolvers<void>();
  const names = Promise.withResolvers<ReaderTtsVoiceOption[]>();
  const metadata = reader.loadMetadata(config.promise, names.promise);
  assert.deepEqual(reader.calls, ['metadata', 'load', 'list']);
  names.resolve(voices);
  await setImmediate();
  assert.deepEqual(reader.calls, ['metadata', 'load', 'list', 'voices']);
  reader.load.resolve(reader.base);
  await setImmediate();
  assert.deepEqual(reader.calls, ['metadata', 'load', 'list', 'voices', 'admit']);
  assert.equal(reader.admissions[0].language, 'zh-CN');
  assert.equal(reader.admissions[0].person, 2);
  assert.equal(reader.admissions[0].repairedVoice, true);
  config.resolve();
  await metadata;
});

test('prefs load while voice discovery is delayed, then use current overrides when the catalogue arrives', async () => {
  const reader = fixture();
  const names = Promise.withResolvers<ReaderTtsVoiceOption[]>();
  const metadata = reader.loadMetadata(Promise.resolve(), names.promise);
  reader.load.resolve(reader.base);
  await setImmediate();
  assert.equal(reader.admissions[0].person, 0);
  reader.host.accept({ keepScreenOn: true });
  names.resolve(voices);
  await metadata;
  assert.equal(reader.admissions[1].preferences.keepScreenOn, true);
  assert.equal(reader.admissions[1].person, 2);
  reader.saves[0].result.resolve(reader.base);
  await setImmediate();
});

test('only an accepted, still-current native voice changes the visible preference and persists it', async () => {
  const reader = fixture();
  reader.state.voices = voices;
  const first = Promise.withResolvers<boolean>();
  const second = Promise.withResolvers<boolean>();
  const selected: ReaderTtsVoiceOption[] = [];
  reader.host.changeVoice('zh-CN', 2, () => first.promise, voice => selected.push(voice));
  reader.host.changeVoice('en-US', 9, () => second.promise, voice => selected.push(voice));
  assert.equal(reader.host.voiceChangePending(), true);
  first.resolve(true);
  await setImmediate();
  assert.deepEqual(selected, []);
  assert.equal(reader.host.voiceChangePending(), true);
  second.resolve(true);
  await setImmediate();
  assert.deepEqual(selected, [voices[0]]);
  assert.equal(reader.host.voiceChangePending(), false);
  assert.deepEqual(reader.saves[0].patch.voice, { language: 'en-US', person: 9 });
  reader.saves[0].result.resolve(reader.base);
});

test('native mixing denial and a retired accept cannot dispatch preference writes', async () => {
  const reader = fixture();
  const changed: boolean[] = [];
  reader.host.changeMixing(true, async () => false, enabled => changed.push(enabled));
  await setImmediate();
  assert.equal(reader.host.mixingChangePending(), false);
  const pending = Promise.withResolvers<boolean>();
  reader.host.changeMixing(true, () => pending.promise, enabled => changed.push(enabled));
  assert.equal(reader.host.mixingChangePending(), true);
  reader.state.owner += 1;
  reader.host.retireChoiceObservations();
  pending.resolve(true);
  await setImmediate();
  assert.deepEqual(changed, []);
  assert.equal(reader.host.mixingChangePending(), false);
  assert.deepEqual(reader.saves, []);
});

test('a newer choice invalidates queued writes, and retries retain all accepted fields', async () => {
  const reader = fixture();
  reader.host.accept({ keepScreenOn: true });
  reader.host.accept({ backgroundPlayback: false });
  assert.equal(reader.saves[0].check(), false);
  assert.equal(reader.saves[1].check(), true);
  reader.host.retryPending();
  assert.equal(reader.saves.length, 2);
  reader.saves[0].result.reject(new Error('TTS_PREFERENCE_OWNER_SUPERSEDED'));
  reader.state.pending = true;
  reader.saves[1].result.reject(new Error('flush acknowledgement missing'));
  await setImmediate();
  assert.equal(reader.notices.length, 1);
  assert.equal(reader.notices[0].retry, true);
  reader.host.retryPending();
  assert.equal(reader.saves.length, 3);
  assert.equal(reader.saves[2].patch.keepScreenOn, true);
  assert.equal(reader.saves[2].patch.backgroundPlayback, false);
  reader.state.pending = false;
  reader.saves[2].result.resolve(reader.base);
  await setImmediate();
  assert.deepEqual(reader.notices.at(-1), { message: '', retry: false, busy: false });
});

test('an existing unknown gateway flush retries its accepted snapshot and honors owner retirement', async () => {
  const reader = fixture();
  const names = Promise.withResolvers<ReaderTtsVoiceOption[]>();
  const metadata = reader.loadMetadata(Promise.resolve(), names.promise);
  reader.state.pending = true;
  reader.host.retryPending();
  await setImmediate();
  assert.equal(reader.saves.length, 0);
  assert.ok(reader.calls.includes('retry-flush'));
  assert.equal(reader.notices[0].busy, true);
  reader.state.owner += 1;
  names.resolve(voices);
  reader.load.resolve(reader.base);
  await metadata;
  assert.deepEqual(reader.admissions, []);
  assert.deepEqual(reader.state.voices, []);
});

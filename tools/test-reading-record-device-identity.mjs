import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ReadingRecordIntent, ReadingRecordRecoveryError } from '../entry/src/main/ets/features/reading/application/ReaderReadingRecordState.ts';
import { recordContractCasePass, selectContractCases } from './lib/contract-case-selection.mjs';

const definitions = {
  'flush-qualification': { description: 'Reading record and progress cannot use a staged device identity until its exact durable flush is confirmed', resources: [] },
};
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/application/ReadingRecordGateway.ts', import.meta.url), 'utf8');
const compiled = stripTypeScriptTypes(source.replace(/^import[^\n]*\n/gm, '').replace('export class ', 'class '));

function fixture() {
  const memory = new Map();
  const disk = new Map();
  const state = { generated: 0, failPut: false, failFlush: false, writeIds: [] };
  const store = {
    async get(key, fallback) { return memory.get(key) ?? fallback; },
    async put(key, value) {
      assert.equal(key, 'device-id');
      state.writeIds.push(value);
      if (state.failPut) {
        state.failPut = false;
        throw new Error('device put rejected before side effect');
      }
      memory.set(key, value);
    },
    async flush() {
      if (state.failFlush) {
        state.failFlush = false;
        throw new Error('device flush acknowledgement lost');
      }
      disk.set('device-id', memory.get('device-id'));
    },
  };
  let runtime;
  const Gateway = new Function('readerHostPreferencesName', 'preferences', 'util', 'ReaderRuntimeOwner',
    'ReadingRecordIntent', 'ReadingRecordRecoveryError', compiled + '; return ReadingRecordGateway;')(
    (_files, name) => name, { getPreferences: async () => store },
    { generateRandomUUID: () => 'device-fixture-' + ++state.generated },
    { isCurrent: candidate => candidate === runtime }, ReadingRecordIntent, ReadingRecordRecoveryError);
  const mount = () => {
    runtime = { getUIAbilityContext: () => ({ filesDir: '/reading-record-fixture' }) };
    return new Gateway(runtime);
  };
  return { state, memory, disk, mount };
}

async function flushQualification() {
  for (const cut of ['failPut', 'failFlush']) {
    const f = fixture();
    const first = f.mount();
    f.state[cut] = true;
    await assert.rejects(first.currentDeviceId(), /device (put|flush)/);
    assert.equal(f.disk.size, 0, 'failed persistence has no durable receipt');
    const staged = f.state.writeIds[0];
    const successor = f.mount();
    assert.equal(await successor.currentDeviceId(), staged, 'the successor continues the originally generated identity');
    assert.equal(f.disk.get('device-id'), staged, 'a returned identity must actually be flushed');
    assert.equal(f.state.generated, 1);
    assert.equal(await successor.currentDeviceId(), staged);
    assert.equal(f.state.writeIds.length, 2, 'only the original pending write is retried');
  }
}

for (const id of selectContractCases(definitions)) {
  await flushQualification();
  recordContractCasePass(id);
}

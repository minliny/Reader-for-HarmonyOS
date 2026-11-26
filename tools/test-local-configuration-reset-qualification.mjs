import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReaderWriteEvidence } from '../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { recordContractCasePass, selectContractCases } from './lib/contract-case-selection.mjs';

const definitions = {
  'journal-qualification': { description: 'Reset must qualify its exact intent before applying settings, and recover a lost final clear acknowledgement', resources: [] },
};
const resetIntent = 'interface-and-reading-settings-v1';

function fixture() {
  const state = { cache: '', disk: '', effects: [], failure: undefined, recoveryFailure: undefined };
  const owner = { getUIAbilityContext: () => ({ filesDir: '/reset-fixture' }) };
  const cache = {
    async get() { return state.cache; },
    async put(_key, value) {
      if (state.recoveryFailure === 'put') throw new Error('compensation put failed');
      state.cache = value;
    },
    async delete() {
      if (state.recoveryFailure === 'delete') throw new Error('compensation delete failed');
      state.cache = '';
    },
    async flush() {
      if (state.failure === 'intent' && state.cache !== '' || state.failure === 'clear' && state.cache === '') {
        const failure = state.failure;
        state.failure = undefined;
        if (failure === 'clear') state.recoveryFailure = 'put';
        throw new Error(failure + ' flush failed');
      }
      state.disk = state.cache;
    },
  };
  const recordEffect = name => async () => {
    assert.equal(state.disk, resetIntent, name + ' must wait for durable reset intent');
    state.effects.push(name);
  };
  const defaults = () => ({});
  const { ts } = installedEtsCompiler();
  const source = readFileSync(new URL('../entry/src/main/ets/features/settings/application/LocalConfigurationReset.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  assert.deepEqual(compiled.diagnostics, []);
  function load() {
    const modules = {
      '../../../app/diagnostics/ReaderPublicFixtureScope': { readerHostPreferencesName: (_files, name) => name },
      '@ohos.data.preferences': { default: { getPreferences: async () => cache } },
      '../../../app/ReaderRuntimeOwner': { ReaderRuntimeOwner: { isCurrent: value => owner === value } },
      '../../../app/ReaderWriteEvidence': { ReaderWriteEvidence },
      '../../../app/ReaderThemeHost': { ReaderThemeHost: {
        prepareUserChange: async () => {}, resetAppearanceDefaults: recordEffect('appearance'),
      } },
      '../../../app/ReaderNavigationAppearancePreferences': { ReaderNavigationAppearancePreferences: { resetDefaults: recordEffect('navigation') } },
      '../../../app/ReaderControlPlacementPreferences': { ReaderControlPlacementPreferences: { resetDefaults: recordEffect('placement') } },
      '../../../app/ReaderSmartGesturePreferences': { ReaderSmartGesturePreferences: { resetDefaults: recordEffect('gestures') } },
      './SettingsGateway': { SettingsGateway: class { update = recordEffect('general'); }, createDefaultSettingsSnapshot: defaults },
      '../../reading/application/ReaderSettingsGateway': { ReaderSettingsGateway: class { update = recordEffect('reading'); } },
      '../../reading/application/ReaderSettingsState': { createDefaultReaderSettingsSnapshot: defaults },
      '../../reading/application/ReaderTtsPreferencesGateway': { ReaderTtsPreferencesGateway: class { update = recordEffect('tts'); } },
      '../../reading/application/ReaderTtsPreferencesState': { createDefaultReaderTtsPreferencesSnapshot: defaults },
      '../../bookshelf/application/BookshelfViewModeHost': { BookshelfViewModeHost: { instance: { resetDefaults: recordEffect('bookshelf') } } },
    };
    const module = { exports: {} };
    new Function('require', 'module', 'exports', 'AppStorage', compiled.outputText)(id => {
      assert.ok(Object.hasOwn(modules, id), 'explicit dependency ' + id);
      return modules[id];
    }, module, module.exports, { setOrCreate() {} });
    return module.exports.LocalConfigurationReset;
  }
  const Reset = load();
  return { state, request: () => Reset.request(owner), recover: () => Reset.recover(owner), evidence: () => Reset.writeEvidence(owner),
    coldRecover: () => { state.cache = state.disk; return load().recover(owner); } };
}

async function journalQualification() {
  const initial = fixture();
  initial.state.failure = 'intent';
  initial.state.recoveryFailure = 'delete';
  await assert.rejects(initial.request(), /intent flush failed/);
  assert.equal(initial.state.effects.length, 0);
  assert.equal(initial.state.disk, '');
  assert.equal(initial.evidence().confirmation(), 'unknown');
  initial.state.recoveryFailure = undefined;
  assert.equal(await initial.recover(), true, 'warm retry first qualifies the exact retained intent');
  assert.deepEqual(initial.state.effects, ['general', 'reading', 'tts', 'bookshelf', 'appearance', 'navigation', 'placement', 'gestures']);
  assert.equal(await initial.recover(), false);
  assert.equal(initial.evidence().confirmation(), 'confirmed');

  const terminal = fixture();
  terminal.state.failure = 'clear';
  await assert.rejects(terminal.request(), /clear flush failed/);
  assert.equal(terminal.state.disk, resetIntent);
  assert.equal(terminal.state.cache, '', 'simulated clear changed cache before flush failed');
  assert.equal(terminal.evidence().confirmation(), 'unknown');
  terminal.state.recoveryFailure = undefined;
  assert.equal(await terminal.recover(), true, 'warm missing cache cannot hide the prior durable intent');
  assert.equal(terminal.state.disk, '');
  assert.equal(await terminal.recover(), false);

  const cold = fixture();
  cold.state.failure = 'clear';
  await assert.rejects(cold.request(), /clear flush failed/);
  cold.state.recoveryFailure = undefined;
  assert.equal(await cold.coldRecover(), true, 'restart resumes the durable reset intent');
  assert.equal(cold.state.disk, '');
}

for (const id of selectContractCases(definitions)) {
  await journalQualification();
  recordContractCasePass(id);
}

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';

const source = path => new URL('../entry/src/main/ets/' + path, import.meta.url);
const read = path => readFileSync(source(path), 'utf8');
const adapterPath = 'platform/accessibility/ReaderSystemReduceMotion.ts';

function fixture({ systemEnabled = false, supported = true } = {}) {
  const published = new Map(), listeners = new Set(), subscriptions = [];
  const accessibility = {
    isAnimationReduceEnabledSync: () => systemEnabled,
    onAnimationReduceStateChange(callback) { listeners.add(callback); },
    offAnimationReduceStateChange(callback) {
      assert.equal(listeners.delete(callback), true, 'unregister the exact SDK listener');
    },
  };
  const platform = existsSync(source(adapterPath)) ? pureModuleProbe(read(adapterPath), adapterPath,
    { accessibility, canIUse: () => supported }, ['watchReaderSystemReduceMotion']) : {};
  const { SettingsPresentation } = pureModuleProbe(read('features/settings/presentation/SettingsPresentation.ets'),
    'SettingsPresentation.ets', {
      ...platform,
      Observed: value => value,
      READER_REDUCE_MOTION_STORAGE_KEY: 'readerReduceMotion',
      AppStorage: { setOrCreate: (key, value) => published.set(key, value) },
      effectiveReaderWideNavigationRail: value => value,
      createDefaultSettingsSnapshot: () => ({ reduceMotion: false }),
      SettingsHost: class {
        cacheCleanupSnapshot() {}
        detachPresentation() {}
      },
      SettingsGateway: class {
        subscribe(callback) {
          subscriptions.push(callback);
          return () => subscriptions.splice(subscriptions.indexOf(callback), 1);
        }
        load() { return Promise.resolve(); }
      },
    }, ['SettingsPresentation']);
  const presentation = new SettingsPresentation();
  presentation.mount({ getUIAbilityContext: () => ({}) }, () => {});
  return {
    published,
    listeners,
    presentation,
    changeSystem(value) { for (const listener of [...listeners]) listener(value); },
    changePreference(value) { for (const subscriber of [...subscriptions]) subscriber({ reduceMotion: value }); },
  };
}

const state = fixture({ systemEnabled: true });
assert.equal(state.published.get('readerReduceMotion'), true, 'initial system reduction applies before preferences load');
state.changePreference(false);
assert.equal(state.presentation.snapshot.reduceMotion, false, 'system setting does not become a persisted Reader choice');
assert.equal(state.published.get('readerReduceMotion'), true, 'restoring app defaults cannot cancel reduction required by the system');
state.changeSystem(false);
assert.equal(state.published.get('readerReduceMotion'), false);
state.changePreference(true);
state.changeSystem(true);
state.changeSystem(false);
assert.equal(state.published.get('readerReduceMotion'), true, 'a locally selected reduction remains active');
const oldListener = [...state.listeners][0];
state.presentation.dispose();
assert.equal(state.listeners.size, 0);
oldListener(false);
assert.equal(state.published.get('readerReduceMotion'), true, 'a late SDK callback cannot publish after retirement');

const fallback = fixture({ systemEnabled: true, supported: false });
assert.equal(fallback.listeners.size, 0, 'unsupported API must not register a native listener');
fallback.changePreference(true);
assert.equal(fallback.published.get('readerReduceMotion'), true);
fallback.presentation.dispose();

const index = read('pages/Index.ets');
assert.match(index, /@StorageLink\('readerReduceMotion'\) private appReduceMotion:/);
assert.doesNotMatch(index, /this\.settingsPresentation\.snapshot\??\.reduceMotion/);
console.log('PASS SDK-emitted settings owner uses system and app motion reduction, exact listener retirement, and unsupported-system fallback');

import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readerControlVerificationColdStartPage } from '../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts';

// Execute actual Ability methods against boundaries that reject every access
// to user storage. This is local lifecycle evidence, not an ArkUI/VM test.
const file = new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url);
const methods = ['onCreate', 'onNewWant', 'onWindowStageCreate', 'onConfigurationUpdate',
  'onForeground', 'onBackground', 'onMemoryLevel', 'onDestroy', 'loadMainContent'];
const forbidden = name => () => assert.fail(`demo accessed ${name}`);
const tick = () => new Promise(resolve => setImmediate(resolve));

for (const fontFailure of [false, true]) {
  const memory = new Map(), loaded = [], events = [];
  let resolveFonts, rejectFonts;
  const fonts = new Promise((resolve, reject) => { resolveFonts = resolve; rejectFonts = reject; });
  const trace = {mark() {}, begin() { return 0; }, end() {}, measure: (_name, task) => task()};
  const Ability = productionMotionMethods(file, methods, {
    DEBUG: true, BUILD_MODE_NAME: 'debug', DOMAIN: 0,
    readerControlVerificationColdStartPage, readerEventLoopProbeEnabled: () => false,
    ReaderStartupTrace: {install: () => trace, current: () => trace, measure: (_name, task) => task()},
    readerMotionNowMs: () => 0, prepareReaderShelfFonts: () => fonts,
    AppStorage: {setOrCreate: (key, value) => memory.set(key, value)},
    ReaderRuntimeOwner: {install: forbidden('Core startup')},
    WebDavCredentialStore: {get instance() { return assert.fail('demo attached settings storage'); }},
    ReaderThemeHost: {install: forbidden('theme store'), systemChanged: forbidden('theme preference'),
      detach: forbidden('production theme lifecycle')},
    ReaderSystemFileOpenHost: {install: forbidden('file-import setup'), receive: forbidden('file import'),
      detach: forbidden('production file-import lifecycle')},
    SyncGateway: class {constructor() { assert.fail('demo started sync recovery'); }},
    LocalConfigurationReset: {recover: forbidden('configuration recovery')},
    ReaderWindowCoordinator: {install: async () => true,
      refreshConfiguration: () => events.push('metrics'), reapplyChrome: () => events.push('chrome'),
      reapplyWindowPolicy: () => events.push('policy'), detach: () => events.push('detach')},
    hilog: {error: () => events.push('font-error')},
  });
  const ability = Object.assign(new Ability(), {context: {}, windowStageGeneration: 0,
    recoveryReady: Promise.resolve(), shelfFontsReady: Promise.resolve()});
  ability.onCreate({parameters: {readerSourceSwitchDemo: true}}, {});
  assert.equal(ability.coldStartPage, 'pages/SourceSwitchDemo');
  assert.equal(ability.runtimeOwner, undefined);
  assert.deepEqual([...memory], [['readerAppForeground', true], ['readerAppScheme', 'day']]);
  ability.onWindowStageCreate({getMainWindowSync: () => ({}), loadContent(page, callback) {
    loaded.push(page); callback({code: 0});
  }});
  await tick();
  assert.deepEqual(loaded, [], 'demo waits for its real bundled font preparation');
  if (fontFailure) rejectFonts(new Error('font unavailable'));
  else resolveFonts();
  await tick();
  assert.deepEqual(loaded, ['pages/SourceSwitchDemo'], 'font failure still admits the recoverable demo');
  assert.equal(events.includes('font-error'), fontFailure);
  ability.onNewWant({uri: 'file://must-not-import.epub', parameters: {readerSourceSwitchDemo: false}}, {});
  ability.onConfigurationUpdate({colorMode: 1});
  assert.equal(memory.get('readerAppScheme'), 'day');
  ability.onForeground();
  ability.onBackground();
  assert.equal(memory.get('readerAppForeground'), false);
  ability.onMemoryLevel(1);
  ability.onDestroy();
  assert.deepEqual(events.filter(event => event !== 'font-error'), ['metrics', 'chrome', 'policy', 'detach']);
}
console.log('source-switch demo entry: exact cold admission, isolated startup/warm Wants/theme/lifecycle, font-gated page load PASS');

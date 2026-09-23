import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';
import * as settings from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';

const base = new URL('../entry/src/main/ets/', import.meta.url);
const source = readFileSync(new URL('features/reading/ReaderSettingsGateway.ts', base), 'utf8');
const stores = new WeakMap();
let barrierCalls = 0;
const dependencies = { preferences: { getPreferences: async owner => stores.get(owner) },
  ReaderThemeHost: { prepareUserChange: async () => { barrierCalls++; } }, ...settings };
const Gateway = new Function(...Object.keys(dependencies),
  `${stripTypeScriptTypes(source.slice(source.indexOf('const READER_SETTINGS_PREFERENCES_NAME'))
    .replace('export class ', 'class '))}; return ReaderSettingsGateway;`)(...Object.values(dependencies));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
const defaults = settings.createDefaultReaderSettingsSnapshot();
const saved = { ...defaults, extendIntoCutout: false, pageTransition: 'none' };
function fixture(raw = JSON.stringify(saved)) {
  const owner = { getUIAbilityContext() { return this; }, start: async () => {} };
  const calls = [];
  const store = { get: async () => { calls.push('get'); return raw; },
    put: async (_key, value) => { calls.push('put'); raw = value; }, flush: async () => { calls.push('flush'); } };
  stores.set(owner, store);
  return { owner, store, calls, gateway: new Gateway(owner) };
}

// The startup admission and normal reads use the real gateway and same queue.
{
  const f = fixture(), before = barrierCalls;
  assert.equal(f.gateway.current(), undefined);
  await f.gateway.loadAfterConfigurationRecovery(() => true);
  assert.equal(barrierCalls, before, 'completed startup recovery must not recursively enter the user-change barrier');
  assert.deepEqual(new Gateway(f.owner).current(), saved);
  await f.gateway.load();
  assert.equal(barrierCalls, before + 1, 'ordinary callers still enter the recovery barrier');
  assert.deepEqual(f.calls, ['get'], 'the reader reuses the admitted settings');
}
{
  const f = fixture(), flush = deferred();
  await f.gateway.load();
  f.store.flush = () => flush.promise;
  const writing = f.gateway.update(defaults, true);
  await settle();
  let done = false;
  const loading = new Gateway(f.owner).loadAfterConfigurationRecovery(() => true).then(value => { done = true; return value; });
  await settle(); assert.equal(done, false, 'startup admission waits for the existing settings write queue');
  assert.deepEqual(f.gateway.current(), saved);
  flush.resolve(); await writing;
  assert.deepEqual(await loading, defaults, 'the post-recovery snapshot includes the confirmed reset');
}
{
  const f = fixture(), flush = deferred();
  await f.gateway.load(); f.store.flush = () => flush.promise;
  const failed = assert.rejects(f.gateway.update(defaults, true), /disk failure/);
  await settle();
  const loading = f.gateway.loadAfterConfigurationRecovery(() => true);
  flush.reject(Error('disk failure')); await failed;
  assert.deepEqual(await loading, saved, 'a failed recovery write does not publish unconfirmed settings');
}
for (const raw of ['', '{invalid']) {
  const f = fixture(raw);
  assert.deepEqual(await f.gateway.loadAfterConfigurationRecovery(() => true), defaults);
}
{
  const legacy = { ...saved, version: 4 }, f = fixture(JSON.stringify(legacy));
  f.store.flush = async () => { throw Error('migration flush failed'); };
  const loaded = await f.gateway.loadAfterConfigurationRecovery(() => true);
  assert.deepEqual(loaded, settings.normalizeReaderSettingsSnapshot(legacy));
  assert.ok(f.calls.includes('put'), 'existing migration semantics remain active');
}
{
  const f = fixture(); f.store.get = async () => { throw Error('read failed'); };
  await assert.rejects(f.gateway.loadAfterConfigurationRecovery(() => true), /read failed/);
  assert.equal(f.gateway.current(), undefined, 'I/O failure is never a ready default receipt');
}
{
  const f = fixture(), read = deferred(); let current = true;
  f.store.get = () => read.promise;
  const loading = f.gateway.loadAfterConfigurationRecovery(() => current);
  await settle(); current = false; read.resolve(JSON.stringify(saved));
  await assert.rejects(loading, /READER_SETTINGS_OWNER_CHANGED/);
  assert.equal(f.gateway.current(), undefined, 'late old-owner reads cannot publish even into the old cache');
  const successor = fixture(); assert.equal(successor.gateway.current(), undefined);
  assert.deepEqual(await successor.gateway.loadAfterConfigurationRecovery(() => true), saved);
}

// Execute actual Ability startup and window publication, with the real gateway.
// Only native platform work, configuration recovery I/O and font I/O are controlled.
const abilityFile = new URL('entryability/EntryAbility.ets', base);
for (const failRead of [false, true]) {
  const f = fixture(), recovery = deferred(), read = deferred(), font = deferred(), shelfFont = deferred();
  const trace = [], errors = [];
  f.store.get = () => { trace.push('settings-read'); return read.promise; };
  const Ability = productionMotionMethods(abilityFile, ['onCreate', 'onWindowStageCreate'], {
    ReaderStartupTrace, readerMotionNowMs: () => performance.now(),
    DEBUG: true, BUILD_MODE_NAME: 'debug', DOMAIN: 0x5244,
    readerControlVerificationColdStartPage: () => 'pages/Index', readerDisableOptionalEntryMemory: () => false,
    readerEventLoopProbeEnabled: () => false, ReaderRuntimeOwner: { install: () => f.owner },
    ReaderSystemFileOpenHost: { install() {}, receive() {} },
    AppStorage: { setOrCreate() {} }, WebDavCredentialStore: { instance: { attachContext() {}, loadBookshelfViewMode: async () => null } },
    prepareReaderShelfFonts: () => shelfFont.promise, ReaderSettingsGateway: Gateway,
    ReaderThemeHost: { install: async () => {}, setRecoveryBarrier() {} },
    ConfigurationConstant: { ColorMode: { COLOR_MODE_DARK: 1 } },
    SyncGateway: class { async recoverInterruptedRestore() { trace.push('recover'); await recovery.promise; } },
    LocalConfigurationReset: { recover: async () => { trace.push('reset-recovered'); } },
    ReaderWindowCoordinator: { install: async () => true }, hilog: { error: (...args) => errors.push(args) },
  });
  let mainLoads = 0;
  const ability = Object.assign(new Ability(), { context: { config: { colorMode: 0 } }, windowStageGeneration: 0,
    prepareSelectedReadingFont: async () => { trace.push('selected-font'); await font.promise; },
    loadMainContent() { mainLoads++; },
  });
  ability.onCreate({ parameters: {} }, {});
  ability.onWindowStageCreate({ getMainWindowSync: () => ({}) });
  await settle(); assert.equal(mainLoads, 0); assert.equal(trace.includes('settings-read'), false);
  recovery.resolve(); await settle();
  assert.ok(trace.indexOf('reset-recovered') < trace.indexOf('settings-read'));
  assert.ok(trace.includes('selected-font'), 'font preparation runs while the settings read is pending');
  assert.equal(mainLoads, 0); assert.equal(f.gateway.current(), undefined);
  assert.equal(mainLoads, 0, 'Index cannot race the outstanding settings read');
  if (failRead) read.reject(Error('startup settings read failed')); else read.resolve(JSON.stringify(saved));
  await ability.recoveryReady; await settle();
  assert.equal(mainLoads, 0, 'the bookshelf still waits for its own checked fonts');
  shelfFont.resolve(); await settle();
  assert.equal(mainLoads, 1, 'reader-only font receipt does not withhold the bookshelf');
  font.resolve(); await settle();
  if (failRead) { assert.equal(f.gateway.current(), undefined); assert.equal(errors.length, 1); }
  else { assert.deepEqual(f.gateway.current(), saved); assert.equal(errors.length, 0); }
}
const index = readFileSync(new URL('pages/Index.ets', base), 'utf8');
assert.doesNotMatch(index, /new ReaderSettingsGateway\(\)\.load\(/, 'Index no longer starts the first reading-settings receipt after becoming visible');
console.log('PASS startup reading settings: real queue, confirmed recovery snapshot, defaults/migration/failure, owner isolation, parallel font preparation and pre-Index admission.');

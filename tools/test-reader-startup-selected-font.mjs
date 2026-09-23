import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderAppearanceStore } from '../entry/src/main/ets/features/reading/ReaderAppearanceStore.ts';
import { createDefaultReaderAppearanceSnapshot, setReaderAppearanceFont, setReaderAppearanceCustomFont,
  ReaderCustomFontDescriptor } from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import { readerAppearanceSnapshotFontFamily } from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';

const path = new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url);
const descriptor = new ReaderCustomFontDescriptor('Custom', 'ReaderCustom_aaaaaaaaaaaaaaaa',
  '/files/reader-fonts/' + 'a'.repeat(64) + '.ttf', 'a'.repeat(64));
const custom = () => setReaderAppearanceCustomFont(createDefaultReaderAppearanceSnapshot(), descriptor);
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
async function fixture(snapshot, register = async () => true) {
  const calls = [], writes = [];
  const store = new ReaderAppearanceStore({load: async () => snapshot, save: async next => { writes.push(next); }});
  await store.load();
  const Ability = productionMotionMethods(path, ['prepareSelectedReadingFont', 'sameSelectedReadingFont'], {
    prepareReaderFontFamily: async family => { calls.push(family); },
    readerAppearanceSnapshotFontFamily, setReaderAppearanceFont,
    ReaderCustomFontHost: class { registerPersisted(_font, value) { return register(value); } },
  });
  const owner = {getAppearanceStore: () => store};
  const ability = Object.assign(new Ability(), {runtimeOwner: owner, context: {filesDir: '/files'}});
  return {ability, owner, store, calls, writes, run: reuse => ability.prepareSelectedReadingFont(owner, reuse)};
}

// Restore only the selected body face; do not enumerate the optional library.
{
  const f = await fixture(setReaderAppearanceFont(createDefaultReaderAppearanceSnapshot(), 'kai'));
  await f.run(); assert.deepEqual(f.calls, ['ReaderLXGWWenKaiGBLite']); assert.equal(f.writes.length, 0);
  await f.store.change(current => setReaderAppearanceFont(current, 'mono'));
  await f.run(); assert.equal(f.calls.at(-1), 'ReaderSarasaMonoSC', 'recovery may select a different face');
}
{
  const gate = deferred(); let called = false, completed = false;
  const f = await fixture(custom(), async value => { called = true; assert.deepEqual(value, descriptor); return gate.promise; });
  const operation = f.run().then(() => { completed = true; });
  await Promise.resolve(); assert.equal(called, true); assert.equal(completed, false);
  gate.resolve(true); await operation;
  assert.equal(f.store.current().font, 'custom'); assert.equal(f.writes.length, 0);
}
{
  const f = await fixture(custom(), async () => false);
  await f.run(); assert.equal(f.store.current().font, 'serif');
  assert.deepEqual(f.calls, [descriptor.familyName, 'ReaderNotoSerifSCRegular']);
  assert.equal(f.writes.length, 1); assert.deepEqual(f.store.current().customFont, descriptor, 'retain imported descriptor');
}
// A checked platform load rejection retains the existing error contract.
{
  const f = await fixture(custom(), async () => { throw Error('native font rejected'); });
  await assert.rejects(f.run(), /native font rejected/);
  assert.equal(f.store.current().font, 'custom'); assert.equal(f.writes.length, 0);
}
// Late failure cannot replace a newer choice, and preparation follows that choice.
{
  const gate = deferred(); const f = await fixture(custom(), async () => gate.promise);
  const operation = f.run(); await Promise.resolve();
  await f.store.change(current => setReaderAppearanceFont(current, 'mono'));
  gate.resolve(false); await operation;
  assert.equal(f.store.current().font, 'mono'); assert.equal(f.writes.length, 1);
  assert.deepEqual(f.calls, [descriptor.familyName, 'ReaderSarasaMonoSC']);
}
{
  const gate = deferred(); const f = await fixture(custom(), async () => gate.promise);
  const operation = f.run(); await Promise.resolve(); f.ability.runtimeOwner = undefined;
  gate.resolve(false); await operation;
  assert.equal(f.store.current().font, 'custom'); assert.equal(f.writes.length, 0);
}
// Final ordinary-startup admission reuses only an actual successful proof.
// The custom Host's file access occurs once; an actual recovery still rechecks.
{
  let registrations = 0;
  const f = await fixture(custom(), async () => { registrations++; return true; });
  await f.run(); await f.run(true);
  assert.equal(registrations, 1); assert.equal(f.calls.length, 1);
  await f.run(false);
  assert.equal(registrations, 2, 'a recovery path still checks its final face');
  const changed = new ReaderCustomFontDescriptor('New', 'ReaderCustom_bbbbbbbbbbbbbbbb',
    '/files/reader-fonts/' + 'b'.repeat(64) + '.ttf', 'b'.repeat(64));
  await f.store.change(current => setReaderAppearanceCustomFont(current, changed));
  await f.run(true);
  assert.equal(registrations, 3, 'the same custom font kind with a different descriptor cannot reuse');
  assert.equal(f.calls.at(-1), changed.familyName);
}
{
  let registrations = 0;
  const f = await fixture(custom(), async () => { if (++registrations === 1) throw Error('first read failed'); return true; });
  await assert.rejects(f.run(), /first read failed/);
  await f.run(true);
  assert.equal(registrations, 2, 'no recovery journal does not turn an initial failure into readiness');
  await f.run(true); assert.equal(registrations, 2);
}
{
  const f = await fixture(setReaderAppearanceFont(createDefaultReaderAppearanceSnapshot(), 'kai'));
  await f.run(); await f.run(true);
  assert.deepEqual(f.calls, ['ReaderLXGWWenKaiGBLite']);
  await f.store.change(current => setReaderAppearanceFont(current, 'mono'));
  await f.run(true);
  assert.equal(f.calls.at(-1), 'ReaderSarasaMonoSC', 'changed selection must prepare even without recovery');
}
{
  let registrations = 0;
  const f = await fixture(custom(), async () => { registrations++; return true; });
  await f.run();
  const successor = {getAppearanceStore: () => f.store};
  f.ability.runtimeOwner = successor;
  await f.ability.prepareSelectedReadingFont(successor, true);
  assert.equal(registrations, 2, 'a successor owner cannot reuse an old owner proof');
  f.ability.runtimeOwner = undefined;
  await f.ability.prepareSelectedReadingFont(successor, true);
  assert.equal(registrations, 2, 'released owner cannot dispatch font work');
}

// Exercise the actual onCreate wiring, not only the optional reuse parameter.
// Reader-only native registration starts after the recovery journals settle;
// its receipt no longer withholds the bookshelf's first frame.
for (const [syncRecovered, resetRecovered, scenario, expected] of [
  [false, false, 'unchanged', 1], [true, false, 'unchanged', 1],
  [false, true, 'unchanged', 1], [undefined, false, 'unchanged', 1],
  [false, false, 'failed-initial', 1], [false, false, 'changed-choice', 1],
  [false, false, 'released-owner', 0],
]) {
  const store = new ReaderAppearanceStore({load: async () => custom(), save: async () => {}});
  await store.load();
  const owner = {start: async () => {}, getAppearanceStore: () => store};
  let registrations = 0, settingsReads = 0, ability;
  const changed = new ReaderCustomFontDescriptor('New', 'ReaderCustom_bbbbbbbbbbbbbbbb',
    '/files/reader-fonts/' + 'b'.repeat(64) + '.ttf', 'b'.repeat(64));
  const Ability = productionMotionMethods(path, ['onCreate', 'prepareSelectedReadingFont', 'sameSelectedReadingFont'], {
    DEBUG: false, BUILD_MODE_NAME: 'release', DOMAIN: 0,
    ReaderStartupTrace: {install: () => ({mark() {}, measure: (_stage, task) => task()})}, readerMotionNowMs: () => 0,
    readerControlVerificationColdStartPage: () => 'pages/Index', readerDisableOptionalEntryMemory: () => false,
    readerEventLoopProbeEnabled: () => false, ReaderRuntimeOwner: {install: () => owner},
    ReaderSystemFileOpenHost: {install() {}, receive() {}}, AppStorage: {setOrCreate() {}},
    WebDavCredentialStore: {instance: {attachContext() {}, loadBookshelfViewMode: async () => 'cover'}},
    prepareReaderShelfFonts: async () => {}, prepareReaderFontFamily: async () => {},
    ReaderThemeHost: {install: async () => {}, setRecoveryBarrier() {}},
    ConfigurationConstant: {ColorMode: {COLOR_MODE_DARK: 1}},
    SyncGateway: class {async recoverInterruptedRestore() {
      if (scenario === 'changed-choice') await store.change(current => setReaderAppearanceCustomFont(current, changed));
      if (scenario === 'released-owner') ability.runtimeOwner = undefined;
      return syncRecovered;
    }},
    LocalConfigurationReset: {recover: async () => resetRecovered},
    ReaderSettingsGateway: class {async loadAfterConfigurationRecovery() { settingsReads++; }},
    readerAppearanceSnapshotFontFamily, setReaderAppearanceFont,
    ReaderCustomFontHost: class {async registerPersisted() {
      registrations++;
      if (scenario === 'failed-initial' && registrations === 1) throw Error('font read failed');
      return true;
    }}, hilog: {error() {}},
  });
  ability = Object.assign(new Ability(), {context: {filesDir: '/files', config: {colorMode: 0}}});
  ability.onCreate({parameters: {}}, {});
  await ability.recoveryReady;
  assert.equal(registrations, expected, `${syncRecovered}/${resetRecovered}/${scenario}`);
  assert.equal(settingsReads, scenario === 'released-owner' ? 0 : 1);
}
console.log('startup selected font: acknowledged identical owner/face reuse, failure retry, real-recovery recheck, selected-only preparation, custom receipt/fallback, native failure, stale choice and owner PASS');

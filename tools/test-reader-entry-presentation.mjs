import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as settings from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
import { copyReaderAppearanceSnapshot, createDefaultReaderAppearanceSnapshot } from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import { READER_THEME_DEFINITIONS } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const gatewayText = readFileSync(new URL('ReaderSettingsGateway.ts', reading), 'utf8');
const stores = new WeakMap();
let reads = 0;
const preferences = { getPreferences: async owner => stores.get(owner) };
const dependencies = { preferences, ReaderThemeHost: { prepareUserChange: async () => {} }, ...settings };
const Gateway = new Function(...Object.keys(dependencies),
  `${stripTypeScriptTypes(gatewayText.slice(gatewayText.indexOf('const READER_SETTINGS_PREFERENCES_NAME'))
    .replace('export class ', 'class '))}; return ReaderSettingsGateway;`)(...Object.values(dependencies));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
function runtime(snapshot) {
  const owner = { getUIAbilityContext() { return this; } };
  let raw = JSON.stringify(snapshot);
  const store = { get: async () => { reads++; return raw; }, put: async (_key, value) => { raw = value; }, flush: async () => {} };
  stores.set(owner, store);
  return { owner, store };
}
const saved = settings.setReaderSettingsToggle(settings.createDefaultReaderSettingsSnapshot(), 'extendIntoCutout', false);
const first = runtime(saved), gateway = new Gateway(first.owner);
assert.equal(gateway.current(), undefined, 'unknown settings are never presented as a restored snapshot');
await gateway.load();
const readerGateway = new Gateway(first.owner);
assert.equal(readerGateway.current().extendIntoCutout, false, 'shelf preparation supplies the initial reader setting synchronously');
const detached = readerGateway.current(); detached.extendIntoCutout = true;
assert.equal(readerGateway.current().extendIntoCutout, false, 'a consumer cannot mutate the shared snapshot');
const previousReads = reads;
await readerGateway.load();
assert.equal(reads, previousReads, 'opening another reader does not read the same preference again');
const other = runtime(settings.createDefaultReaderSettingsSnapshot());
assert.equal(new Gateway(other.owner).current(), undefined, 'runtime owners cannot inherit another application instance');

const write = deferred(); first.store.flush = () => write.promise;
const updated = settings.setReaderSettingsToggle(saved, 'extendIntoCutout', true);
const saving = gateway.update(updated);
await settle();
assert.equal(readerGateway.current().extendIntoCutout, false, 'pending persistence does not masquerade as confirmed settings');
let readCompleted = false;
const concurrentRead = readerGateway.load().then(value => { readCompleted = true; return value; });
await settle(); assert.equal(readCompleted, false);
write.resolve(); await saving;
assert.equal((await concurrentRead).extendIntoCutout, true);
first.store.flush = async () => { throw Error('disk failure'); };
await assert.rejects(gateway.update(saved), /disk failure/);
assert.equal(readerGateway.current().extendIntoCutout, true, 'failed writes retain the admitted setting');
first.store.flush = async () => {};
await gateway.update(saved, true);
assert.equal(readerGateway.current().extendIntoCutout, false, 'configuration reset updates the same snapshot');

const cold = runtime(saved), coldRead = deferred(), coldGateway = new Gateway(cold.owner);
let coldPuts = 0;
cold.store.get = () => coldRead.promise;
cold.store.put = async () => { coldPuts++; };
cold.store.flush = async () => { throw Error('pending flush failed'); };
const initialRead = coldGateway.load();
await settle();
const failedUpdate = new Gateway(cold.owner).update(updated);
await settle();
assert.equal(coldPuts, 0, 'the first read/migration and updates share one access queue');
coldRead.resolve(JSON.stringify(saved));
await initialRead;
await assert.rejects(failedUpdate, /pending flush failed/);
assert.equal(coldGateway.current().extendIntoCutout, false,
  'an overlapping failed put cannot become the permanently reused entry setting');

const file = new URL('LocalReadingExperience.ets', reading);
const coordinatorRequests = [];
const Owner = productionMotionMethods(file, ['restoreEntryPresentation', 'loadReaderSettingsSnapshot', 'applyInitialReaderWindowPolicy'], {
  ReaderWindowCoordinator: { requestReaderWindowPolicy: request => { coordinatorRequests.push(request); return Promise.resolve(); } },
});
for (const theme of READER_THEME_DEFINITIONS) {
  const appearance = createDefaultReaderAppearanceSnapshot(); appearance.activeTheme = theme.id;
  const owner = Object.assign(new Owner(), {
    appearanceSnapshot: createDefaultReaderAppearanceSnapshot(), readerSettingsLoaded: false,
    appearanceGateway: { current: () => copyReaderAppearanceSnapshot(appearance) }, readerSettingsGateway: readerGateway,
  });
  owner.restoreEntryPresentation();
  assert.equal(owner.appearanceSnapshot.activeTheme, theme.id, 'first build uses the restored theme even before async load');
  assert.equal(owner.readerSettingsSnapshot.extendIntoCutout, false);
  assert.equal(owner.readerSettingsLoaded, true);
}

for (const cached of [false, true]) for (const outcome of ['current-failure', 'new-choice', 'unmounted', 'success']) {
  const window = deferred(), applied = [], reflows = [];
  const owner = Object.assign(new Owner(), {
    readerSettingsLoaded: cached, readerSettingsMutationGeneration: 0, mounted: true,
    readerSettingsSnapshot: cached ? saved : settings.createDefaultReaderSettingsSnapshot(),
    readerSettingsGateway: { load: async () => { assert.equal(cached, false, 'restored settings need no repeat disk read'); return saved; } },
    isSessionActive() { return this.mounted; }, configureReaderScreenAwakeLease() {}, applyReaderSystemEventPolicy() {},
    applyReaderWindowPolicy: value => { applied.push(value); return applied.length === 1 ? window.promise : Promise.resolve(); },
    safeWindowSettingsFallback: value => ({ ...value, screenDirection: 'system' }),
    reflowAfterWindowGeometryChange: () => reflows.push(true),
  });
  await owner.loadReaderSettingsSnapshot(1);
  assert.equal(owner.readerSettingsLoaded, true, 'layout settings arrive without awaiting the native callback');
  assert.equal(owner.readerSettingsSnapshot, saved);
  if (outcome === 'new-choice') { owner.readerSettingsMutationGeneration++; owner.readerSettingsSnapshot = updated; }
  if (outcome === 'unmounted') owner.mounted = false;
  if (outcome === 'success') window.resolve(); else window.reject(Error('native window failed'));
  await settle();
  assert.equal(reflows.length, outcome === 'current-failure' ? 1 : 0);
  assert.equal(applied.length, outcome === 'current-failure' ? 2 : 1, 'only a current failure applies a compensating window policy');
  if (outcome === 'new-choice') assert.equal(owner.readerSettingsSnapshot, updated, 'late native failure cannot undo a newer choice');
}
const source = readFileSync(file, 'utf8');
const appearanceRestore = source.indexOf('this.restoreEntryPresentation();', source.indexOf('aboutToAppear(): void'));
assert.ok(appearanceRestore < source.indexOf('this.applyWindowChrome();', appearanceRestore),
  'restored paper must own the first system chrome request');
console.log('PASS entry presentation: all themes, shared confirmed settings, owner isolation, reset/failure, nonblocking window calls and stale callback guards.');

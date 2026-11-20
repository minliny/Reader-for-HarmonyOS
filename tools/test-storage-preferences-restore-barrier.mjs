// Selected storage-restore boundary only. No other test suite is imported.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import * as reading from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
import * as tts from '../entry/src/main/ets/features/reading/ReaderTtsPreferencesState.ts';
import * as appearance from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';

const cases = {
  'late-first-put': 'Reading, TTS, general and bookshelf setters reject their first put after sealing during an asynchronous read.',
  'drain-in-flight': 'The same four real preference owners retain their original write lane until the dispatched flush acknowledges.',
  'unknown-flush': 'A persisted write with missing flush ACK remains unconfirmed and refuses restore, including bookshelf local mode.',
  'appearance-seal': 'Appearance rejects new changes while draining accepted writes; a failed drain cannot invent confirmation.',
};
const selected = selectContractCases(cases);
if (selected.length === 0) process.exit(0);
const {installedEtsCompiler,emitSdkProbe}=await import('./lib/ets-compiler-runtime.mjs');
const {ts}=installedEtsCompiler();
const root = new URL('../entry/src/main/ets/', import.meta.url);
function production(path, dependencies = {}) {
  const source=readFileSync(new URL(path,root),'utf8');
  const body=source.replace(/^import[\s\S]*?;\n/gm,'');
  const output=emitSdkProbe(body,{fileName:path,parseSource:source,compilerOptions:{
    target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS,
  }});
  const exports={};
  new Function('exports',...Object.keys(dependencies),output)(exports,...Object.values(dependencies));
  return exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function remainsPending(promise, message) {
  let settled = false;
  promise.then(() => { settled = true; }, () => { settled = true; });
  await tick(); await tick();
  assert.equal(settled, false, message);
}
function fixture(kind) {
  const runtime = { getUIAbilityContext: () => ({}) };
  const ReaderRuntimeOwner = { isCurrent: owner => owner === runtime, current: () => runtime };
  const Theme = production('app/ReaderThemeHost.ts', { ReaderRuntimeOwner }).ReaderThemeHost;
  const events = [], cache = new Map(), durable = new Map();
  let readGate, flushGate, failFlush = false;
  const store = {
    async has(key) { return cache.has(key); },
    async get(key, fallback) {
      events.push(['get', key]);
      if (readGate) { const gate = readGate; readGate = undefined; gate.entered.resolve(); await gate.release.promise; }
      return cache.has(key) ? cache.get(key) : fallback;
    },
    async put(key, value) { events.push(['put', key]); cache.set(key, value); },
    async delete(key) { events.push(['delete', key]); cache.delete(key); },
    async flush() {
      events.push(['flush']);
      if (flushGate) { const gate = flushGate; flushGate = undefined; gate.entered.resolve(); await gate.release.promise; }
      for (const [key, value] of cache) durable.set(key, value);
      if (failFlush) throw new Error('durable write lost flush ACK');
    },
  };
  const preferences = { getPreferences: async () => store };
  let owner, initial, changed, update, drain, unconfirmed;
  if (kind === 'reading' || kind === 'tts') {
    const state = kind === 'reading' ? reading : tts;
    const name = kind === 'reading' ? 'ReaderSettingsGateway' : 'ReaderTtsPreferencesGateway';
    const Gateway = production(`features/reading/${name}.ts`, { ...state, ReaderRuntimeOwner, ReaderThemeHost: Theme, preferences })[name];
    owner = new Gateway(runtime);
    initial = kind === 'reading' ? reading.createDefaultReaderSettingsSnapshot() : tts.createDefaultReaderTtsPreferencesSnapshot();
    changed = kind === 'reading' ? reading.setReaderSettingsToggle(initial, 'alignPageBottom', true) : { ...initial, allowMixing: true };
    update = value => owner.update(value);
    drain = () => owner.awaitDurableWrites();
    unconfirmed = () => owner.writeFacts().pendingReconciliation;
  } else if (kind === 'general') {
    const module = production('features/settings/SettingsGateway.ts', { ReaderThemeHost: Theme, preferences });
    owner = new module.SettingsGateway({});
    initial = module.createDefaultSettingsSnapshot(); changed = { ...initial, reduceMotion: true };
    update = value => owner.update(value);
    drain = () => owner.awaitDurableWrites(() => true);
    unconfirmed = () => owner.writeFacts().pendingReconciliation;
  } else {
    cache.set('bookshelfViewMode', 'cover'); cache.set('bookshelfConfigVersion', 1);
    const Gateway = production('features/sync/WebDavCredentialStore.ts', { ReaderThemeHost: Theme, preferences }).WebDavCredentialStore;
    owner = new Gateway(); owner.attachContext({});
    initial = 'cover'; changed = 'list';
    update = value => owner.saveBookshelfViewMode(value);
    drain = () => owner.awaitDurableBookshelfWrites(() => true);
    unconfirmed = () => owner.bookshelfModeWriteUnconfirmed;
  }
  function gate(which) {
    const value = { entered: deferred(), release: deferred() };
    if (which === 'read') readGate = value; else flushGate = value;
    return value;
  }
  return { Theme, runtime, owner, initial, changed, update, drain, unconfirmed, events, durable, gate,
    failFlush: () => { failFlush = true; }, seal: () => Theme.sealForLibraryRestore(runtime) };
}

for (const id of selected) {
if (id !== 'appearance-seal') {
for (const kind of ['reading', 'tts', 'general', 'bookshelf']) {
  // The first platform read has begun after any user-change barrier. Sealing
  // must still reject first dispatch when that asynchronous read returns.
  if (id === 'late-first-put') {
    const f = fixture(kind), gate = f.gate('read');
    const write = f.update(f.changed), rejected = assert.rejects(write, /SEALED/);
    await gate.entered.promise;
    await f.seal(); gate.release.resolve(); await rejected;
    assert.equal(f.events.filter(event => event[0] === 'put').length, 0, `${kind}: sealed late read cannot put`);
  }
  // Once put dispatched, the original flush owns the file lane through its
  // actual ACK. Restoring over an unsettled setter would lose accepted facts.
  if (id === 'drain-in-flight') {
    const f = fixture(kind), gate = f.gate('flush');
    const write = f.update(f.changed);
    await gate.entered.promise; await f.seal();
    const draining = f.drain();
    await remainsPending(draining, `${kind}: restore must wait for dispatched flush`);
    gate.release.resolve(); await write; await draining;
    assert.equal(f.unconfirmed(), false, `${kind}: only actual flush ACK confirms`);
  }
  // Deliberately persist before losing ACK. Matching durable/cache bytes are
  // not confirmation, and a drain must fail rather than synthesize success.
  if (id === 'unknown-flush') {
    const f = fixture(kind); await f.update(f.initial); f.failFlush();
    await assert.rejects(f.update(f.changed), /lost flush ACK/);
    assert.equal(f.unconfirmed(), true, `${kind}: failed flush remains unresolved`);
    await f.seal(); await assert.rejects(f.drain(), /UNCONFIRMED/);
    assert.equal(f.unconfirmed(), true);
  }
}
} else {

// The actual AppearanceStore has a separate accepted-change/write queue. A
// seal may drain accepted writes, but must not admit a new semantic change.
const AppearanceStore = production('features/reading/ReaderAppearanceStore.ts', appearance).ReaderAppearanceStore;
{
  const initial = appearance.createDefaultReaderAppearanceSnapshot();
  const gate = deferred(), entered = deferred(), writes = [];
  const store = new AppearanceStore({ load: async () => initial,
    save: async value => { writes.push(value); entered.resolve(); await gate.promise; } });
  const commit = await store.change(value => appearance.setReaderAppearanceIndent(value, 'single'));
  await entered.promise;
  const sealed = store.sealForLibraryRestore();
  assert.equal(await store.change(value => appearance.setReaderAppearanceIndent(value, 'firstLine')), undefined);
  await remainsPending(sealed, 'appearance seal must drain its accepted write');
  gate.resolve(); await commit.saved; await sealed;
  assert.equal(writes.length, 1); assert.equal(store.current().indent, 'single');
  assert.equal(store.hasUnsavedChanges(), false);
}
{
  const store = new AppearanceStore({ load: async () => appearance.createDefaultReaderAppearanceSnapshot(),
    save: async () => { throw new Error('appearance flush ACK missing'); } });
  const commit = await store.change(value => appearance.setReaderAppearanceIndent(value, 'single'));
  await assert.rejects(commit.saved, /ACK missing/);
  await assert.rejects(store.sealForLibraryRestore(), /ACK missing/);
  assert.equal(store.hasUnsavedChanges(), true, 'failed sealed drain cannot confirm appearance');
  assert.equal(await store.change(value => appearance.setReaderAppearanceIndent(value, 'firstLine')), undefined);
}
}
recordContractCasePass(id);
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ReaderAppearanceStore } from '../entry/src/main/ets/features/reading/ReaderAppearanceStore.ts';
import * as state from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';

const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const read = name => readFileSync(new URL(name, reading), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const initial = state.createDefaultReaderAppearanceSnapshot();
function persistence(snapshot = initial) {
  return {
    snapshot: state.copyReaderAppearanceSnapshot(snapshot), loads: 0, writes: [], gate: undefined, failures: 0,
    async load() { this.loads++; return state.copyReaderAppearanceSnapshot(this.snapshot); },
    async save(next) {
      this.writes.push(state.copyReaderAppearanceSnapshot(next));
      if (this.gate) await this.gate.promise;
      if (this.failures > 0) { this.failures--; throw Error('controlled disk failure'); }
      this.snapshot = state.copyReaderAppearanceSnapshot(next);
    },
  };
}
const Gateway = new Function('ReaderCustomFontHost', stripTypeScriptTypes(
  read('ReaderAppearanceGateway.ts').replace(/^import[\s\S]*?;\n/gm, '')).replace('export class', 'class') +
  ';return ReaderAppearanceGateway;')(class {});
const ownerFor = store => ({ getAppearanceStore: () => store, getUIAbilityContext: () => ({}) });
const changeIndent = indent => current => state.setReaderAppearanceIndent(current, indent);

// Execute two actual gateway instances sharing one application owner. A new page
// must see accepted intent before the previous page's disk write completes.
{
  const disk = persistence(), store = new ReaderAppearanceStore(disk);
  disk.gate = deferred();
  const owner = ownerFor(store), first = new Gateway(owner), second = new Gateway(owner);
  const commit = await first.update(changeIndent('firstLine'));
  assert.equal((await second.load()).indent, 'firstLine');
  assert.equal(disk.snapshot.indent, 'none');
  disk.gate.resolve(); await commit.saved;
  assert.equal(disk.snapshot.indent, 'firstLine');
  assert.equal(disk.loads, 1);
}

// Changes arriving while the initial read is pending merge in request order.
{
  const disk = persistence(), gate = deferred();
  disk.load = async () => { disk.loads++; await gate.promise; return initial; };
  const store = new ReaderAppearanceStore(disk);
  const first = store.change(changeIndent('single'));
  const second = store.change(current => state.setReaderAppearanceTheme(current, 'green'));
  const third = store.change(changeIndent('firstLine'));
  gate.resolve();
  const commits = await Promise.all([first, second, third]);
  await Promise.all(commits.map(commit => commit.saved));
  assert.equal(disk.loads, 1);
  assert.equal(store.current().indent, 'firstLine');
  assert.equal(store.current().activeTheme, 'green');
  assert.deepEqual(disk.writes.map(value => value.indent), ['single', 'single', 'firstLine']);
  assert.deepEqual(disk.snapshot, store.current());
  const exposed = store.current(); exposed.indent = 'none'; exposed.fontOrder.reverse();
  assert.equal(store.current().indent, 'firstLine');
  assert.deepEqual(store.current().fontOrder, initial.fontOrder);
}

// Failed writes retain current display state, reject their own completion and
// allow both later changes and lifecycle retries to persist the latest state.
{
  const disk = persistence(), store = new ReaderAppearanceStore(disk);
  disk.failures = 1;
  const failed = await store.change(changeIndent('single'));
  await assert.rejects(failed.saved, /controlled disk failure/);
  assert.equal(store.current().indent, 'single');
  assert.equal(store.hasUnsavedChanges(), true);
  const latest = await store.change(changeIndent('firstLine')); await latest.saved;
  assert.equal(disk.snapshot.indent, 'firstLine');
  assert.equal(store.hasUnsavedChanges(), false);
  disk.failures = 1;
  const another = await store.change(changeIndent('none'));
  await assert.rejects(another.saved);
  await store.flush();
  assert.equal(disk.snapshot.indent, 'none');
  assert.equal(store.hasUnsavedChanges(), false);
}
// Backgrounding during the very first preferences read must wait for accepted
// user intent to be applied and saved, not observe revision zero and return.
{
  const disk = persistence(), gate = deferred();
  disk.load = async () => { await gate.promise; return initial; };
  const store = new ReaderAppearanceStore(disk);
  const changing = store.change(changeIndent('firstLine'));
  const flushing = store.flush();
  const reopening = store.load();
  gate.resolve();
  await flushing;
  assert.equal(disk.snapshot.indent, 'firstLine');
  assert.equal((await reopening).indent, 'firstLine');
  await (await changing).saved;
  // A rejected semantic change must not poison the next accepted one.
  await assert.rejects(store.change(() => { throw Error('bad change'); }));
  await (await store.change(changeIndent('single'))).saved;
  assert.equal(disk.snapshot.indent, 'single');
}
{
  const disk = persistence(), store = new ReaderAppearanceStore(disk);
  await store.flush(); assert.equal(disk.loads, 0);
  const gate = deferred(); disk.gate = gate;
  const first = await store.change(changeIndent('single'));
  const flushing = store.flush();
  const latest = await store.change(changeIndent('firstLine'));
  gate.resolve(); await Promise.all([first.saved, latest.saved, flushing]);
  assert.equal(disk.snapshot.indent, 'firstLine');
}
{
  const disk = persistence(), store = new ReaderAppearanceStore(disk);
  const load = disk.load.bind(disk); let fail = true;
  disk.load = async () => { if (fail) { fail = false; throw Error('read failed'); } return load(); };
  await assert.rejects(store.load(), /read failed/);
  assert.deepEqual(await store.load(), initial);
}

// Compile unchanged production page methods; only OS font registration and
// rendering are controlled. These checks catch the original stale recovery.
const source = read('LocalReadingExperience.ets');
function method(name) {
  const start = new RegExp(`  private (?:async )?${name}\\(`).exec(source);
  assert.ok(start, name);
  const end = source.indexOf('\n  private ', start.index + 1);
  return source.slice(start.index, end < 0 ? source.length : end).replace(/\n  \/\*\*[\s\S]*$/, '');
}
const methods = ['loadAppearanceSnapshot', 'sameAppearanceFont', 'commitAppearanceChange',
  'observeAppearanceSave', 'changeAppearanceIndent', 'stepAppearanceMetric', 'stepAppearanceSnapshotMetric',
  'roundAppearanceMetric', 'toggleAppearanceAlignment'];
const Page = new Function(...Object.keys(state), stripTypeScriptTypes(
  `${source.match(/^const READER_APPEARANCE_\w+_STEP = .*;$/gm).join('\n')}
  class Page { ${methods.map(method).join('\n')} }`) + ';return Page;')(...Object.values(state));
function page(store, registration = async () => true) {
  const value = new Page();
  Object.assign(value, {
    appearanceGateway: new Gateway(ownerFor(store)), appearanceSnapshot: initial,
    appearanceMutationGeneration: 0, lifecycleToken: 1, active: true, notices: [],
    isSessionActive(token) { return this.active && token === this.lifecycleToken; },
    getUIContext: () => ({ getFont: () => ({}) }),
    admitAppearanceSnapshot(snapshot) { this.appearanceSnapshot = snapshot; },
    showAppearanceFailure(message) { this.notices.push(message); },
  });
  value.appearanceGateway.registerCustomFont = registration;
  return value;
}
const custom = state.setReaderAppearanceCustomFont(initial, new state.ReaderCustomFontDescriptor(
  'Audit Font', 'ReaderCustom_aaaaaaaaaaaaaaaa', '/audit/font.ttf', 'a'.repeat(64)));
assert.equal(custom.font, 'custom');
{
  const disk = persistence(custom), store = new ReaderAppearanceStore(disk), gate = deferred();
  const old = page(store, () => gate.promise);
  const loading = old.loadAppearanceSnapshot(1); await tick();
  old.active = false;
  const fresh = page(store); fresh.changeAppearanceIndent('firstLine'); await tick();
  gate.resolve(false); await loading; await store.flush();
  assert.equal(disk.snapshot.indent, 'firstLine');
  assert.equal(disk.snapshot.font, 'custom');
  assert.deepEqual(disk.writes.map(value => value.indent), ['firstLine']);
  assert.equal(fresh.appearanceSnapshot.indent, 'firstLine');
}
{
  const disk = persistence(custom), store = new ReaderAppearanceStore(disk), gate = deferred();
  const current = page(store, () => gate.promise);
  const loading = current.loadAppearanceSnapshot(1); await tick();
  await store.change(changeIndent('firstLine'));
  gate.resolve(false); await loading; await store.flush();
  assert.equal(disk.snapshot.indent, 'firstLine');
  assert.equal(disk.snapshot.font, 'serif');
  assert.equal(current.appearanceSnapshot.indent, 'firstLine');
}
{
  const disk = persistence(custom), store = new ReaderAppearanceStore(disk), gate = deferred();
  const current = page(store, () => gate.promise);
  const loading = current.loadAppearanceSnapshot(1); await tick();
  await store.change(value => state.setReaderAppearanceFont(value, 'sans'));
  gate.resolve(false); await loading; await store.flush();
  assert.equal(disk.snapshot.font, 'sans');
  assert.equal(current.appearanceSnapshot.font, 'sans');
}
{
  const disk = persistence(), store = new ReaderAppearanceStore(disk), current = page(store);
  await current.loadAppearanceSnapshot(1);
  for (let index = 0; index < 3; index++) current.stepAppearanceMetric('fontSize', 1);
  current.changeAppearanceIndent('single'); current.changeAppearanceIndent('firstLine');
  current.toggleAppearanceAlignment('justify'); current.toggleAppearanceAlignment('justify');
  await tick(); await store.flush();
  assert.equal(disk.snapshot.fontSize, initial.fontSize + 6);
  assert.equal(disk.snapshot.indent, 'firstLine');
  assert.equal(disk.snapshot.alignment, 'justify');
  assert.deepEqual(current.appearanceSnapshot, disk.snapshot);
  disk.failures = 1; current.changeAppearanceIndent('none'); await tick();
  assert.equal(current.appearanceSnapshot.indent, 'none');
  assert.equal(current.notices.length, 1);
  await store.flush();
}

console.log('reader appearance shared store, page races and persistence recovery: PASS');

// Exercise the real Preferences adapter against legacy snapshots and corrupted
// persisted input. The storage name/key and v3 migration remain compatible.
{
  let raw = JSON.stringify({ ...initial, version: 2, indent: 'single' });
  const records = [], preferences = {
    async getPreferences(context, name) {
      assert.equal(context.id, 'test-context'); assert.equal(name, 'reader_appearance_v1');
      return {
        async get(key) { assert.equal(key, 'snapshot'); return raw; },
        async put(key, value) { assert.equal(key, 'snapshot'); raw = value; records.push('put'); },
        async flush() { records.push('flush'); },
      };
    },
  };
  const adapter = readFileSync(new URL('../../app/ReaderAppearancePreferences.ts', reading), 'utf8');
  const Preferences = new Function('preferences', ...Object.keys(state), stripTypeScriptTypes(
    adapter.replace(/^import[\s\S]*?;\n/gm, '')).replace('export class', 'class') +
    ';return ReaderAppearancePreferences;')(preferences, ...Object.values(state));
  const disk = new Preferences({ id: 'test-context' });
  assert.equal((await disk.load()).indent, 'single');
  assert.equal((await disk.load()).version, 3);
  raw = '{bad json'; assert.deepEqual(await disk.load(), initial);
  await disk.save(state.setReaderAppearanceIndent(initial, 'firstLine'));
  assert.deepEqual(records, ['put', 'flush']);
  assert.equal((await disk.load()).indent, 'firstLine');
}
console.log('appearance Preferences adapter migration and persistence compatibility: PASS');

// Actual application lifecycle methods must flush appearance even if Core
// flush fails, and an appearance failure must not strand runtime teardown.
{
  const source = readFileSync(new URL('../../app/ReaderRuntimeOwner.ts', reading), 'utf8');
  const flushStart = source.indexOf('  async flush(): Promise<void>');
  const flush = source.slice(flushStart, source.indexOf('\n  /**', flushStart));
  const closeStart = source.indexOf('  private async closeRuntime(): Promise<void>');
  const close = source.slice(closeStart, source.indexOf('\n  private async startRuntime', closeStart));
  let notices = 0, releases = 0;
  const Runtime = new Function('hilog', 'LOG_DOMAIN', 'errorMessageOf', 'ReadingBodyImageHost',
    stripTypeScriptTypes(`class ReaderRuntimeOwner { ${flush} ${close} }`) + ';return ReaderRuntimeOwner;')(
    { warn() { notices++; } }, 0, error => error.message,
    { instance: { releaseAllDisplayFiles() { releases++; } } });
  const events = [], runtime = new Runtime();
  let failCore = true, failAppearance = false;
  Object.assign(runtime, {
    state: 'ready', flushTail: Promise.resolve(), sourceSupplyTask: Promise.resolve(),
    runtime: {
      async request() { events.push('core'); if (failCore) throw Error('core flush failed'); },
      close() { events.push('closed'); },
    },
    appearanceStore: { async flush() { events.push('appearance'); if (failAppearance) throw Error('save failed'); } },
    ttsHost: { async close() { events.push('tts'); } },
  });
  await assert.rejects(runtime.flush(), /core flush failed/);
  assert.deepEqual(events, ['core', 'appearance']);
  failCore = false; await runtime.flush();
  assert.deepEqual(events.slice(-2), ['core', 'appearance']);
  failAppearance = true; runtime.state = 'closing'; await runtime.closeRuntime();
  assert.deepEqual(events.slice(-4), ['appearance', 'tts', 'core', 'closed']);
  assert.equal(runtime.state, 'closed'); assert.equal(releases, 1); assert.equal(notices, 1);
}
console.log('application appearance background flush and teardown isolation: PASS');

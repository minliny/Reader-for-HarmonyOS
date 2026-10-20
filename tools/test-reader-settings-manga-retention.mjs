import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as state from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';

// Same actual Preferences get/put/flush seam as test-reader-settings-write-facts.
// Each fixture emits the full production Gateway class, with independent static
// state for cold processes; cache reads never manufacture a durable flush ACK.
const require = createRequire(import.meta.url);
const ts = require((resolveEtsLoaderRoot()) + '/node_modules/typescript');
const gatewayUrl = new URL('../entry/src/main/ets/features/reading/ReaderSettingsGateway.ts', import.meta.url);
const source = readFileSync(gatewayUrl, 'utf8');
const mangaKeys = ['mangaDirection', 'mangaFit', 'mangaBackground', 'mangaPageNumbers'];
const defaults = state.createDefaultReaderSettingsSnapshot();
const original = { ...defaults, mangaDirection: 'horizontal', mangaFit: 'contain',
  mangaBackground: 'ink', mangaPageNumbers: false };
const values = value => Object.fromEntries(mangaKeys.map(key => [key, value[key]]));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(done => setImmediate(done)); };
const evidence = { legalTuples: 0, failureCuts: [], independentFieldDeletionNegatives: [] };

function fixture(text = source, initial = original, inheritedDurable, model = state) {
  const events = [], durable = inheritedDurable ?? new Map([['snapshot', JSON.stringify(initial)]]);
  const cache = new Map(durable);
  const cuts = [];
  const cut = phase => cuts.push({ phase, cache: JSON.parse(cache.get('snapshot') ?? 'null'),
    durable: JSON.parse(durable.get('snapshot') ?? 'null') });
  let failure, readGate, flushGate, barrier = async () => {};
  const runtime = { getUIAbilityContext: () => ({}) }; let active = runtime;
  const store = {
    async get(key, fallback) {
      events.push(['get']);
      if (readGate) { const gate = readGate; readGate = undefined; await gate.promise; }
      return cache.get(key) ?? fallback;
    },
    async put(key, value) {
      events.push(['put', JSON.parse(value)]);
      cut('beforePut');
      if (failure === 'put') { failure = undefined; cut('putRejectedBeforeEffect'); throw Error('put before effect'); }
      cache.set(key, value);
      cut('afterPut');
    },
    async flush() {
      events.push(['flush']);
      cut('beforeFlush');
      if (flushGate) { const gate = flushGate; flushGate = undefined; await gate.promise; }
      if (failure === 'before') { failure = undefined; cut('flushRejectedBeforeDurable'); throw Error('flush before durable'); }
      for (const [key, value] of cache) durable.set(key, value);
      cut('afterDurableFlush');
      if (failure === 'after') { failure = undefined; cut('durableFlushAckLost'); throw Error('durable flush lost ACK'); }
      cut('flushAck');
    },
  };
  const body = text.replace(/^import[\s\S]*?;\n/gm, '');
  const tree = ts.createSourceFile('ReaderSettingsGateway.ts', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(tree.parseDiagnostics, []);
  const emitted = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2021,
    module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
  assert.deepEqual(emitted.diagnostics, []);
  const exports = {};
  new Function('exports', ...Object.keys(model), 'ReaderRuntimeOwner', 'ReaderThemeHost', 'preferences', emitted.outputText)(
    exports, ...Object.values(model), { isCurrent: owner => owner === active, current: () => active },
    { prepareUserChange: () => barrier() }, { getPreferences: async () => store });
  const Gateway = exports.ReaderSettingsGateway;
  return { owner: new Gateway(runtime), Gateway, events, cuts, cache, durable,
    fail: value => { failure = value; }, hangRead: gate => { readGate = gate; },
    hangFlush: gate => { flushGate = gate; }, setBarrier: value => { barrier = value; },
    remount() { active = { ...runtime }; return new Gateway(active); }, retire() { active = undefined; } };
}

// This is deliberately first: the original production loses all four fields
// in the actual whole-snapshot put/flush, rather than only failing a shape test.
{
  const f = fixture();
  await f.owner.loadAfterConfigurationRecovery(() => true);
  assert.equal(f.events.some(event => event[0] === 'put'), false, 'same-v5 startup remains read-only');
  const textChoice = state.setReaderSettingsToggle(defaults, 'alignPageBottom', true);
  await f.owner.update(textChoice);
  assert.deepEqual(values(JSON.parse(f.durable.get('snapshot'))), values(original),
    'unrelated whole-snapshot flush must preserve existing R9 manga choices');
  assert.equal(JSON.parse(f.durable.get('snapshot')).alignPageBottom, true);
  assert.equal(f.events.filter(event => event[0] === 'put').length, 1);
}

let modelCases = 0;
for (const mangaDirection of ['vertical', 'horizontal']) for (const mangaFit of ['source', 'width', 'contain'])
for (const mangaBackground of ['paper', 'white', 'ink']) for (const mangaPageNumbers of [false, true]) {
  const snapshot = { ...defaults, mangaDirection, mangaFit, mangaBackground, mangaPageNumbers };
  for (const result of [state.normalizeReaderSettingsSnapshot(snapshot), state.copyReaderSettingsSnapshot(snapshot),
    state.setReaderSettingsToggle(snapshot, 'alignPageBottom', true), state.setReaderPageTurnStyle(snapshot, 'scroll'),
    state.setReaderScreenTimeout(snapshot, 'oneMinute')]) assert.deepEqual(values(result), values(snapshot));
  modelCases++;
}
evidence.legalTuples = modelCases;
for (const key of mangaKeys) assert.equal(Object.hasOwn(defaults, key), false, 'absent manga fields do not add defaults');
assert.deepEqual(state.normalizeReaderSettingsSnapshot({ ...defaults, mangaFit: 'invalid', mangaBackground: 'invalid',
  mangaPageNumbers: 1, arbitraryUnknown: 'do not preserve' }), defaults);
assert.equal(state.normalizeReaderSettingsSnapshot({ ...defaults, mangaDirection: 'invalid' }).mangaDirection, 'vertical',
  'reuse the R9 direction fallback without inventing a new normalization rule');
const legacy = state.normalizeReaderSettingsSnapshot({ ...original, version: 4 });
for (const key of mangaKeys) assert.equal(Object.hasOwn(legacy, key), false, 'only the existing v5 extension is retained');

for (const failure of ['put', 'before', 'after']) {
  const f = fixture(); await f.owner.load(); await f.owner.update(original);
  const requested = state.setReaderSettingsToggle(defaults, 'alignPageBottom', true);
  const cutStart = f.cuts.length;
  f.fail(failure); await assert.rejects(f.owner.update(requested));
  assert.deepEqual(values(f.owner.current()), values(original));
  assert.equal(f.owner.writeFacts().pendingReconciliation, true);
  assert.deepEqual(values(f.owner.writeFacts().saved), values(original));
  const coldBeforeRetry = fixture(source, undefined, f.durable);
  const coldBeforeRetryLoaded = await coldBeforeRetry.owner.loadAfterConfigurationRecovery(() => true);
  assert.deepEqual(values(coldBeforeRetryLoaded), values(original));
  assert.equal(coldBeforeRetryLoaded.alignPageBottom, failure === 'after',
    'cold read reflects actual durable snapshot; it is not a receipt for the old unknown attempt');
  assert.equal(coldBeforeRetry.events.some(event => event[0] === 'put'), false);
  const warm = f.remount();
  assert.deepEqual(values(await warm.load()), values(original));
  assert.equal(warm.writeFacts().pendingReconciliation, true, 'cache read does not confirm lost ACK');
  await warm.retryAccepted();
  assert.equal(warm.writeFacts().pendingReconciliation, false);
  assert.deepEqual(values(JSON.parse(f.durable.get('snapshot'))), values(original));
  assert.equal(JSON.parse(f.durable.get('snapshot')).alignPageBottom, true);
  assert.equal(f.events.filter(event => event[0] === 'put').length, 3, 'no compensating write');
  assert.deepEqual(f.events.filter(event => event[0] === 'put').slice(-2).map(event => event[1]),
    [warm.current(), warm.current()], 'retry retains the complete original accepted payload');
  const cold = fixture(source, undefined, f.durable);
  assert.deepEqual(values(await cold.owner.loadAfterConfigurationRecovery(() => true)), values(original));
  assert.equal(cold.events.some(event => event[0] === 'put'), false);
  evidence.failureCuts.push({ failure, coldBeforeRetryLoaded, cuts: f.cuts.slice(cutStart), finalWriteFacts: warm.writeFacts(),
    coldLoaded: await cold.owner.loadAfterConfigurationRecovery(() => true) });
}
{
  const f = fixture(); await f.owner.load(); f.fail('after');
  await assert.rejects(f.owner.update(state.setReaderSettingsToggle(defaults, 'alignPageBottom', true)));
  const cold = fixture(source, undefined, f.durable);
  const loaded = await cold.owner.load();
  assert.equal(loaded.alignPageBottom, true); assert.deepEqual(values(loaded), values(original));
  assert.equal(cold.events.some(event => event[0] === 'put'), false, 'cold load does not reapply the prior mutation');
}
{
  const f = fixture(source, defaults); await f.owner.load(); await f.owner.update(defaults);
  assert.deepEqual(JSON.parse(f.durable.get('snapshot')), defaults, 'no extension materialized for old default snapshots');
}
{
  const f = fixture(); await f.owner.load(); await f.owner.update(defaults, true);
  assert.deepEqual(JSON.parse(f.durable.get('snapshot')), defaults, 'explicit original reset still clears the extension');
}
{
  const f = fixture(), gate = deferred(); await f.owner.load(); f.hangRead(gate);
  const rejected = assert.rejects(f.owner.update(defaults), /SUPERSEDED/);
  await settle(); f.remount(); gate.resolve(); await rejected;
  assert.equal(f.events.some(event => event[0] === 'put'), false);
  assert.deepEqual(values(JSON.parse(f.durable.get('snapshot'))), values(original));
}
{
  const f = fixture(), gate = deferred(); await f.owner.load(); f.hangFlush(gate);
  const old = f.owner.update(state.setReaderSettingsToggle(defaults, 'alignPageBottom', true)); await settle();
  const successor = f.remount(), next = successor.update(state.setReaderSettingsToggle(defaults, 'longPressSelectText', false));
  await settle(); assert.equal(f.events.filter(event => event[0] === 'put').length, 1, 'accepted old write retains actual flush lane');
  gate.resolve(); await old; await next;
  assert.deepEqual(values(successor.current()), values(original));
  assert.deepEqual(values(JSON.parse(f.durable.get('snapshot'))), values(original));
}
{
  const f = fixture(), gate = deferred(); await f.owner.load(); f.fail('after');
  await assert.rejects(f.owner.update(state.setReaderSettingsToggle(defaults, 'alignPageBottom', true)));
  f.setBarrier(() => { f.setBarrier(async () => {}); return gate.promise; });
  const rejected = assert.rejects(f.owner.retryAccepted(), /SUPERSEDED/);
  await f.owner.update(state.setReaderSettingsToggle(defaults, 'longPressSelectText', false)); gate.resolve(); await rejected;
  assert.equal(f.events.filter(event => event[0] === 'put').length, 2, 'old retry cannot borrow newer accepted revision');
  assert.deepEqual(values(JSON.parse(f.durable.get('snapshot'))), values(original));
}
{
  const mutant = source.replace(/if \(!resetOwned\) \{\n([\s\S]*?)\n      \}/, 'if (!resetOwned) { /* removed extension preservation */ }');
  assert.notEqual(mutant, source, 'negative control removes only the production extension-preservation branch');
  const f = fixture(mutant); await f.owner.load(); await f.owner.update(defaults);
  assert.throws(() => assert.deepEqual(values(JSON.parse(f.durable.get('snapshot'))), values(original)),
    'real production branch removal reproduces four-field erasure');
}
{
  const modelSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderSettingsState.ts', import.meta.url), 'utf8');
  for (const key of mangaKeys) {
    const mutant = modelSource.split('\n').filter(line => !line.includes(`normalized.${key} =`)).join('\n');
    assert.notEqual(mutant, modelSource, `remove ${key} from the actual production normalizer`);
    const emitted = ts.transpileModule(mutant, { compilerOptions: { target: ts.ScriptTarget.ES2021,
      module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
    assert.deepEqual(emitted.diagnostics, []);
    const model = {}; new Function('exports', emitted.outputText)(model);
    const f = fixture(source, original, undefined, model); await f.owner.load(); await f.owner.update(defaults);
    const saved = JSON.parse(f.durable.get('snapshot'));
    assert.equal(Object.hasOwn(saved, key), false, `${key}: actual put/flush erasure reproduced`);
    assert.throws(() => assert.deepEqual(values(saved), values(original)), `${key}: preservation assertion detects independent deletion`);
    for (const sibling of mangaKeys.filter(other => other !== key)) assert.equal(saved[sibling], original[sibling]);
    evidence.independentFieldDeletionNegatives.push({ removedKey: key, actuallyFlushed: saved });
  }
}
if (process.env.READER_SETTINGS_RETENTION_EVIDENCE) writeFileSync(process.env.READER_SETTINGS_RETENTION_EVIDENCE,
  JSON.stringify(evidence, null, 2) + '\n');
console.log(`PASS actual ReaderSettings v5 manga retention: ${modelCases} legal tuples, normalize/copy/text changes, read-only startup, actual whole-snapshot flush, put/before/after-ACK failures, warm/cold retry, original reset/absence, Runtime retirement/shared lane/new revision and production branch-removal negative. OS Preferences persistence remains separate.`);

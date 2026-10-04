import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReaderStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';
import { ReaderCapacityProbe, readerCapacityProbeEnabled } from '../entry/src/main/ets/app/ReaderCapacityProbe.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

// Real production probe/trace methods. Only unavailable request/timer/platform
// boundaries are supplied. This source tier never claims SDK or device proof.
let at = 0, clockReads = 0, throwingCollector = false, queries = 0;
const rows = [], calls = [];
ReaderStartupTrace.install(() => { clockReads++; return at; }, row => {
  rows.push(row); if (throwingCollector) throw Error('private collector error');
}, true);
const raw = { retainedRequestCount: 1, queuedCommandCount: 0, queuedInputBytes: 0,
  inputReservedBytes: 37, resultReservedBytes: 65536, hostReservedBytes: 0,
  pendingDeliveryCount: 0, hostOperationCount: 0 };
const response = () => ({ capacity: { current: { ...raw, bookId: 'private' },
  peak: { ...raw, retainedRequestCount: 3, sourceId: 'private' } }, provider: 'private' });
const request = async (method, params, options) => {
  queries++; calls.push({ method, params, options }); return response();
};
let nextTimer = 0;
const timers = new Map();
const oldSet = globalThis.setTimeout, oldClear = globalThis.clearTimeout;
globalThis.setTimeout = (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, due: at + ms, ms }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
const tick = () => new Promise(resolve => setImmediate(resolve));
async function advance(ms) {
  at += ms;
  for (const [id, timer] of [...timers]) if (timer.due <= at) { timers.delete(id); timer.fn(); }
  await tick();
}
const make = (read = request, current = () => true) => ReaderCapacityProbe.create(true, 'debug', true, read, current);
try {
  for (const value of [undefined, false, 'true', 1, {}, new Boolean(true)]) {
    const before = [queries, clockReads, timers.size];
    assert.equal(readerCapacityProbeEnabled(true, 'debug', value), false);
    assert.equal(ReaderCapacityProbe.create(true, 'debug', value, request, () => true), undefined);
    assert.deepEqual([queries, clockReads, timers.size], before, 'opt-out allocates no status/clock/timer');
  }
  for (const [debug, mode] of [[false, 'debug'], [true, 'release'], [true, 'DEBUG']])
    assert.equal(ReaderCapacityProbe.create(debug, mode, true, request, () => true), undefined);

  const normal = make(); normal.start(); normal.start(); await tick();
  assert.equal(queries, 1); assert.equal(calls[0].method, 'runtime.status');
  assert.deepEqual(calls[0].params, { includeCapacity: true });
  assert.equal(calls[0].options.timeoutMs, 2000); assert.equal(calls[0].options.shouldCancel(), false);
  assert.equal(rows[0].stage, 'runtime.capacity'); assert.equal(rows[0].status, 'observed');
  assert.deepEqual(Object.keys(rows[0].capacity.current).sort(), Object.keys(raw).sort());
  assert.equal(JSON.stringify(rows).includes('private'), false);
  const lifecycle = productionMotionMethods(new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url),
    ['onWindowStageDestroy', 'onBackground', 'onDestroy'], {
      AppStorage: { setOrCreate() {} }, ReaderWindowCoordinator: { detach() {} },
      ReaderThemeHost: { detach() {} }, ReaderSystemFileOpenHost: { detach() {} }, hilog: { error() {} }, DOMAIN: 0,
    });
  for (const method of ['onWindowStageDestroy', 'onBackground', 'onDestroy']) {
    const probe = make();
    const ability = Object.assign(new lifecycle(), { capacityProbe: probe, windowStageGeneration: 0 });
    ability[method](); probe.start();
  }
  normal.stop(); assert.equal(calls[0].options.shouldCancel(), true); assert.equal(timers.size, 0);
  const count = queries; normal.start(); await advance(3000); assert.equal(queries, count);

  let resolveLate;
  const stopped = make(() => new Promise(resolve => { resolveLate = resolve; }));
  stopped.start(); const beforeStop = rows.length; stopped.stop();
  resolveLate(response()); await tick(); assert.equal(rows.length, beforeStop); assert.equal(timers.size, 0);

  let owner = true, resolveOwner;
  const retired = make(() => new Promise(resolve => { resolveOwner = resolve; }), () => owner);
  retired.start(); const beforeRetire = rows.length; owner = false;
  resolveOwner(response()); await tick(); assert.equal(rows.length, beforeRetire); assert.equal(timers.size, 0);

  for (const data of [{}, { capacity: { current: raw, peak: {} } },
    { capacity: { current: { ...raw, hostOperationCount: -1 }, peak: raw } }]) {
    const unsupported = make(async () => data); unsupported.start(); await tick();
    assert.equal(rows.at(-1).status, data.capacity === undefined ? 'unobserved.capacity' : 'malformed.capacity');
    assert.equal('capacity' in rows.at(-1), false, 'missing/malformed is not fabricated zero');
    assert.equal(timers.size, 0);
  }
  const failing = make(async () => { throw Error('provider secret'); }); failing.start(); await tick();
  assert.equal(rows.at(-1).status, 'failed.query'); assert.equal('capacity' in rows.at(-1), false);
  assert.equal(JSON.stringify(rows).includes('provider secret'), false); assert.equal(timers.size, 0);

  const beforeBound = queries, beforeRows = rows.length;
  const bounded = make(); bounded.start(); await tick();
  for (let i = 0; i < 12; i++) await advance(3000);
  assert.equal(queries - beforeBound, 10); assert.equal(rows.length - beforeRows, 10); assert.equal(timers.size, 0);

  let resolveExpired;
  const expired = make(() => new Promise(resolve => { resolveExpired = resolve; }));
  expired.start(); const beforeExpiry = rows.length;
  await advance(30000); resolveExpired(response()); await tick();
  assert.equal(rows.length, beforeExpiry); assert.equal(timers.size, 0);

  throwingCollector = true;
  const collector = make(); collector.start(); await tick(); await advance(3000);
  collector.stop(); throwingCollector = false; assert.equal(timers.size, 0);

  const ability = readFileSync(new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url), 'utf8');
  assert.match(ability, /DEBUG === true && BUILD_MODE_NAME === 'debug' && want\.parameters\?\.readerCapacityTrace === true/);
  assert.match(ability, /this\.capacityProbe\?\.start\(\)/);
  const warm = ability.slice(ability.indexOf('  onNewWant('), ability.indexOf('  private async prepareSelectedReadingFont'));
  assert.doesNotMatch(warm, /readerCapacityTrace|ReaderCapacityProbe|capacityProbe/);
} finally { globalThis.setTimeout = oldSet; globalThis.clearTimeout = oldClear; }
console.log('Capacity probe PASS: real production methods, exact opt-in/default zero queries, params, lifecycle/late owner, unknown not zero, 10/30s bounds, anonymous whitelist and collector isolation; TARGET NOT RUN');

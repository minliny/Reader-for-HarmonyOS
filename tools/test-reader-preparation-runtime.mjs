import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { httpResponseFailureSummary } from '../entry/src/main/ets/app/ErrorMessage.ts';
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function fixture() {
  const timers = [], calls = [], rounds = [];
  const Owner = productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url),
    ['noteReadingPreparationIntent', 'wakeReadingPreparations', 'requestDirect'], {
      setTimeout: callback => { timers.push(callback); return timers.length; }, LOG_DOMAIN: 0,
      DEFAULT_CORE_REQUEST_TIMEOUT_MS: 30000, httpResponseFailureSummary,
      hilog: { warn() {} },
    });
  const owner = Object.assign(new Owner(), { state: 'ready', preparationIntentEpoch: 0,
    preparationForeground: true, preparationCatalogAllowed: false, preparationWakeTimer: -1,
    supportsCoreCapability: () => true, preparationNetwork: { allowed: () => true },
    start: async () => {}, readingEntryPreparations: () => ({ beginRequest: () => false }),
    runtime: { async request(method, params) { calls.push({ method, params }); return { data: {} }; } },
    bookAcquisitions: () => ({ async resumeReadingPreparations(allowed, catalogAllowed) {
      rounds.push({ allowed: allowed(), catalogAllowed: catalogAllowed() });
    } }),
    request(method, params) { return this.requestDirect(method, params); },
  });
  return { owner, timers, calls, rounds };
}
{
  const f = fixture(); f.owner.noteReadingPreparationIntent('s', 'b');
  assert.equal(f.calls.length, 0, 'entry intent persistence must not run before the next UI task');
  f.timers.shift()(); await tick();
  assert.deepEqual(f.calls, [{ method: 'reading.preparation', params: { action: 'begin', sourceId: 's', bookId: 'b', reason: 'read' } }]);
  f.timers.shift()(); await tick(); assert.deepEqual(f.rounds, [{ allowed: true, catalogAllowed: false }]);
}
for (const method of ['cache.clear', 'bookshelf.remove', 'bookshelf.removeBatch', 'source.delete',
 'source.switch.begin', 'source.switch.commit', 'source.switch.abort', 'runtime.storage.apply', 'runtime.storage.restore']) {
  const f = fixture(); f.owner.noteReadingPreparationIntent('s', 'b');
  await f.owner.requestDirect(method, { sourceId: 's', bookId: 'b' });
  f.timers.shift()(); await tick();
  assert.equal(f.calls.filter(call => call.method === 'reading.preparation').length, 0,
    `a deferred read intent must not renew permission after ${method}`);
}
for (const state of ['closing', 'closed']) {
  const f = fixture(); f.owner.noteReadingPreparationIntent('s', 'b'); f.owner.state = state;
  f.timers.shift()(); await tick(); assert.equal(f.calls.length, 0);
}
for (const foreground of [false, true]) {
  const f = fixture(); f.owner.preparationForeground = foreground;
  f.owner.preparationNetwork.allowed = () => false;
  f.owner.wakeReadingPreparations(); if (f.timers.length) f.timers.shift()(); await tick();
  assert.equal(f.rounds.length, 0, 'unknown/metered network cannot dispatch automatic backfill');
}
console.log('Reading preparation runtime: deferred entry, clear/restore fences, foreground and network admission PASS');

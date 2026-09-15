import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const code = stripTypeScriptTypes(readFileSync(new URL('../entry/src/main/ets/app/ReaderEventLoopProbe.ts', import.meta.url), 'utf8'));
const { ReaderEventLoopProbe, readerEventLoopProbeEnabled } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
assert.equal(readerEventLoopProbeEnabled(true, 'debug', true), true);
for (const request of [undefined, false, 'true', 1, {}, new Boolean(true)]) {
  assert.equal(readerEventLoopProbeEnabled(true, 'debug', request), false);
}
assert.equal(readerEventLoopProbeEnabled(false, 'debug', true), false);
assert.equal(readerEventLoopProbeEnabled(true, 'release', true), false);

const oldSet = globalThis.setInterval;
const oldClear = globalThis.clearInterval;
let callback;
let allocations = 0;
let clears = 0;
globalThis.setInterval = (fn, ms) => {
  assert.equal(ms, 50);
  callback = fn;
  allocations++;
  return 73;
};
globalThis.clearInterval = (id) => { assert.equal(id, 73); clears++; };
try {
  let at = 0;
  const records = [];
  const probe = new ReaderEventLoopProbe(() => at, row => records.push(row));
  probe.start(); probe.start();
  assert.equal(allocations, 1);
  at = 50; callback();
  at = 1200; callback();
  assert.deepEqual(records[0], { elapsedMs: 1200, uptimeMs: 1200, samples: 2,
    maxDelayMs: 1100, delayedOver50Ms: 1, reason: 'window' });
  for (let i = 0; i < 20; i++) { at += 50; callback(); }
  assert.equal(records[1].maxDelayMs, 0);
  assert.equal(records[1].samples, 20);
  probe.stop('background');
  const stoppedCount = records.length;
  callback(); probe.stop('destroyed'); probe.start();
  assert.equal(records.length, stoppedCount);
  assert.equal(allocations, 1);
  assert.equal(clears, 1);

  const cancelledBeforeLoad = new ReaderEventLoopProbe(() => at, () => assert.fail('late load restarted probe'));
  cancelledBeforeLoad.stop('background'); cancelledBeforeLoad.start();
  assert.equal(allocations, 1);

  at = 10000;
  const bounded = [];
  const expiry = new ReaderEventLoopProbe(() => at, row => bounded.push(row));
  expiry.start();
  for (let i = 0; i < 4000; i++) { at += 50; callback(); }
  assert.equal(bounded.length, 120);
  assert.equal(bounded.at(-1).reason, 'duration-limit');
  assert.equal(bounded.at(-1).elapsedMs, 120000);
  assert.equal(clears, 2);
  assert.deepEqual(Object.keys(bounded[0]).sort(), ['delayedOver50Ms','elapsedMs','maxDelayMs','reason','samples','uptimeMs']);

  const invalid = [];
  const badClock = new ReaderEventLoopProbe(() => at, row => invalid.push(row));
  badClock.start(); at -= 1; callback();
  assert.equal(invalid[0].reason, 'clock-invalid');
  assert.equal(clears, 3);
  callback();
  assert.equal(invalid.length, 1);
} finally {
  globalThis.setInterval = oldSet;
  globalThis.clearInterval = oldClear;
}
console.log('Debug-only event-loop probe: strict opt-in, actual delayed ticks, independent windows, bounded lifetime, background/late-load ownership PASS; this is not FPS evidence.');

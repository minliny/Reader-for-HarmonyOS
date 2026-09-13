import assert from 'node:assert/strict';
import { ReaderBrightnessWriter } from '../entry/src/main/ets/app/ReaderBrightnessWriter.ts';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

// Production regression: a 24ms lookup under continuous 16ms MOVE must keep
// writing before UP, and the last held sample must reach the window unaided.
let actual = .5; const writes = []; const begin = performance.now();
const win = { getWindowProperties: () => ({ brightness: actual }),
  async setWindowBrightness(value) { actual = value; writes.push({ value, at: performance.now() - begin }); } };
const writer = new ReaderBrightnessWriter(async () => { await sleep(24); return win; });
const owner = writer.claim(); const pending = [];
for (let i = 0; i < 8; i++) { pending.push(writer.request(owner, .1 + i * .1)); await sleep(16); }
const stopped = performance.now() - begin;
await Promise.all(pending);
assert.ok(writes.some(w => w.at < stopped), 'continuous drag must not starve native writes');
assert.equal(actual, .1 + 7 * .1, 'last held MOVE is written without another event');
await writer.release(owner); assert.equal(actual, .5);

// One in-flight write and the newest pending target; automatic beats old manual.
const gate = deferred(); const issued = []; let concurrent = 0; let peak = 0;
const slowWin = { getWindowProperties: () => ({ brightness: .6 }), async setWindowBrightness(v) {
  concurrent++; peak = Math.max(peak, concurrent); issued.push(v);
  if (issued.length === 1) await gate.promise;
  concurrent--;
} };
const slow = new ReaderBrightnessWriter(async () => slowWin); const a = slow.claim();
const first = slow.request(a, .2); await sleep(0);
const discarded = slow.request(a, .4); const automatic = slow.request(a, -1);
gate.resolve(); await Promise.all([first, discarded, automatic]);
assert.deepEqual(issued, [.2, -1]); assert.equal(peak, 1);

// A's delayed release may not clobber B's policy on the same Window.
const block = deferred(); const values = []; let count = 0;
const shared = new ReaderBrightnessWriter(async () => ({ getWindowProperties: () => ({ brightness: .7 }),
  async setWindowBrightness(v) { values.push(v); if (++count === 1) await block.promise; } }));
const old = shared.claim(); const oldWrite = shared.request(old, .3); await sleep(0);
const restore = shared.release(old); const next = shared.claim(); const newWrite = shared.request(next, .8);
block.resolve(); await Promise.all([oldWrite, restore, newWrite]);
assert.deepEqual(values, [.3, .8]);
assert.equal((await shared.request(old, .1)).applied, false);

// Requests enqueued by a resolved request cannot fall through the drain/finally gap.
const tail = new ReaderBrightnessWriter(async () => win); const t = tail.claim();
await tail.request(t, .2).then(() => tail.request(t, .9)); assert.equal(actual, .9);

// Failed write does not poison later work; cancel drops only unsent work.
let fail = true;
const retry = new ReaderBrightnessWriter(async () => ({ getWindowProperties: () => ({ brightness: .5 }),
  async setWindowBrightness(v) { if (fail) { fail = false; throw new Error('native rejected'); } actual = v; } }));
const r = retry.claim(); await assert.rejects(retry.request(r, .2), /native rejected/);
await retry.request(r, .4); assert.equal(actual, .4);
const lookup = deferred(); const cancelled = new ReaderBrightnessWriter(() => lookup.promise);
const c = cancelled.claim(); const unsent = cancelled.request(c, .1); cancelled.cancelPending(c);
lookup.resolve(win); assert.equal((await unsent).applied, false);
console.log('Reader brightness production writer: PASS (held MOVE, coalescing, ownership, restore, failure, cancel, microtask tail)');

// Cancel must publish the dispatched value A after dropping unsent B. A failure
// settles to the last confirmed value; no independent lookup or rollback write.
for (const fails of [false, true]) {
  const native = deferred(); let physical = .55; let lookups = 0; const calls = [];
  const settling = new ReaderBrightnessWriter(async () => { lookups++; return {
    getWindowProperties: () => ({brightness:physical}),
    async setWindowBrightness(value) { calls.push(value); await native.promise;
      if (fails) throw Error('cancelled write rejected'); physical = value; }
  }; });
  const lease = settling.claim();
  const accepted = settling.request(lease, .25); void accepted.catch(() => {});
  await sleep(0); const dropped = settling.request(lease, .85);
  let observed = false;
  const cancellation = settling.cancelAndSettle(lease).then(value => { observed = true; return value; });
  await sleep(0); assert.equal(observed, false, 'cancel observes the already issued ACK');
  assert.equal((await dropped).applied, false);
  native.resolve(); await accepted.catch(() => {});
  const result = await cancellation; assert.equal(result.applied,true); assert.equal(result.value,fails ? .55 : .25);
  assert.deepEqual(calls,[.25]); assert.equal(lookups,1);
}
// A stale cancel observation must not claim a replacement window's ownership.
const cancelGate=deferred(); const isolated=new ReaderBrightnessWriter(async()=>({
  getWindowProperties:()=>({brightness:.4}), async setWindowBrightness(){await cancelGate.promise;}
}));
const cancelOwner=isolated.claim(); const inflight=isolated.request(cancelOwner,.6); await sleep(0);
const settled=isolated.cancelAndSettle(cancelOwner); isolated.reset(); cancelGate.resolve();
await inflight; assert.equal((await settled).applied,false);
console.log('PASS brightness Cancel settles in-flight success/failure, drops pending, and isolates Window owner');

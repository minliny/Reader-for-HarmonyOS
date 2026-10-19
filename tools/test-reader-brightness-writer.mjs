import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import assert from 'node:assert/strict';
import { ReaderBrightnessWriter } from '../entry/src/main/ets/app/ReaderBrightnessWriter.ts';

async function runCase() {
const deferred = () => { let resolve, reject; const promise = new Promise((r,j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };

// Hold each real Window lookup while more MOVE samples arrive, then release
// that lookup explicitly. The writer must not restart it for each new sample.
// This tests ordering and progress, without a host's 16/24ms scheduling jitter.
let actual = .5; const writes = [], lookups = []; let moving = true;
const win = { getWindowProperties: () => ({ brightness: actual }),
  async setWindowBrightness(value) { actual = value; writes.push({ value, moving }); } };
const writer = new ReaderBrightnessWriter(() => { const lookup = deferred(); lookups.push(lookup); return lookup.promise; });
const owner = writer.claim(); const pending = [];
for (let i = 0; i < 4; i++) pending.push(writer.request(owner, .1 + i * .1));
assert.equal(lookups.length, 1, 'new samples cannot replace the in-flight lookup');
lookups[0].resolve(win); await Promise.all(pending);
assert.deepEqual(writes.map(write => write.value), [.4]);
for (let i = 4; i < 8; i++) pending.push(writer.request(owner, .1 + i * .1));
await Promise.resolve();
assert.equal(lookups.length, 2, 'one new lookup serves the newest pending sample');
moving = false; lookups[1].resolve(win);
await Promise.all(pending);
assert.equal(writes[0].moving, true, 'native writes progress before the MOVE stream ends');
assert.equal(actual, .1 + 7 * .1, 'last held MOVE is written without another event');
const released = writer.release(owner); await Promise.resolve(); lookups[2].resolve(win);
await released; assert.equal(actual, .5);

// One in-flight write and the newest pending target; automatic beats old manual.
const gate = deferred(); const issued = []; let concurrent = 0; let peak = 0;
const slowWin = { getWindowProperties: () => ({ brightness: .6 }), async setWindowBrightness(v) {
  concurrent++; peak = Math.max(peak, concurrent); issued.push(v);
  if (issued.length === 1) await gate.promise;
  concurrent--;
} };
const slow = new ReaderBrightnessWriter(async () => slowWin); const a = slow.claim();
const first = slow.request(a, .2); await Promise.resolve();
const discarded = slow.request(a, .4); const automatic = slow.request(a, -1);
gate.resolve(); await Promise.all([first, discarded, automatic]);
assert.deepEqual(issued, [.2, -1]); assert.equal(peak, 1);

// A's delayed release may not clobber B's policy on the same Window.
const block = deferred(); const values = []; let count = 0;
const shared = new ReaderBrightnessWriter(async () => ({ getWindowProperties: () => ({ brightness: .7 }),
  async setWindowBrightness(v) { values.push(v); if (++count === 1) await block.promise; } }));
const old = shared.claim(); const oldWrite = shared.request(old, .3); await Promise.resolve();
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
  await Promise.resolve(); const dropped = settling.request(lease, .85);
  let observed = false;
  const cancellation = settling.cancelAndSettle(lease).then(value => { observed = true; return value; });
  await Promise.resolve(); assert.equal(observed, false, 'cancel observes the already issued ACK');
  assert.equal((await dropped).applied, false);
  native.resolve(); await accepted.catch(() => {});
  const result = await cancellation; assert.equal(result.applied,true); assert.equal(result.value,fails ? .55 : .25);
  assert.deepEqual(calls,[.25]); assert.equal(lookups,1);
}
// A stale cancel observation must not claim a replacement window's ownership.
const cancelGate=deferred(); const isolated=new ReaderBrightnessWriter(async()=>({
  getWindowProperties:()=>({brightness:.4}), async setWindowBrightness(){await cancelGate.promise;}
}));
const cancelOwner=isolated.claim(); const inflight=isolated.request(cancelOwner,.6); await Promise.resolve();
const settled=isolated.cancelAndSettle(cancelOwner); isolated.reset(); cancelGate.resolve();
await inflight; assert.equal((await settled).applied,false);
console.log('PASS brightness Cancel settles in-flight success/failure, drops pending, and isolates Window owner');

// Lookup failure belongs to its captured Window AND reader owner. A newer
// lease may already have pending input while the old lookup is settling.
for (const replaceWindow of [false, true]) {
  const oldLookup=deferred(); let lookups=0; const values=[];
  const currentWindow={getWindowProperties:()=>({brightness:.5}),async setWindowBrightness(value){values.push(value);}};
  const isolated=new ReaderBrightnessWriter(()=>++lookups===1?oldLookup.promise:Promise.resolve(currentWindow));
  const oldOwner=isolated.claim(); const oldRequest=isolated.request(oldOwner,.2);
  if(replaceWindow) isolated.reset();
  const newOwner=isolated.claim(); const newRequest=isolated.request(newOwner,.8);
  oldLookup.reject(Error('obsolete window lookup'));
  assert.equal((await oldRequest).applied,false);
  assert.equal((await newRequest).applied,true,'obsolete lookup failure cannot reject a new owner pending request');
  assert.deepEqual(values,[.8]); assert.equal(lookups,2);
}

// A current lookup failure rejects that owner's newest sample without
// poisoning later work or retrying a permanently failing lookup forever.
{
  const lookup=deferred(); let calls=0; const values=[];
  const healthy={getWindowProperties:()=>({brightness:.5}),async setWindowBrightness(value){values.push(value);}};
  const writer=new ReaderBrightnessWriter(()=>++calls===1?lookup.promise:Promise.resolve(healthy));
  const owner=writer.claim(); const replaced=writer.request(owner,.1);
  const newest=writer.request(owner,.3);
  const rejected=assert.rejects(newest,/current lookup failed/);
  lookup.reject(Error('current lookup failed')); await rejected;
  assert.equal((await replaced).applied,false);
  await writer.request(owner,.6); assert.deepEqual(values,[.6]);
}

// Native properties can synchronously throw after the Window was acquired.
// The dequeued request still settles, allowing a caller to await/retry it.
{
  let reads=0; const values=[];
  const writer=new ReaderBrightnessWriter(async()=>({
    getWindowProperties(){if(++reads===1)throw Error('window properties unavailable');return {brightness:.45};},
    async setWindowBrightness(value){values.push(value);},
  }));
  const owner=writer.claim();
  await assert.rejects(writer.request(owner,.25),/window properties unavailable/);
  assert.equal((await writer.request(owner,.75)).applied,true);
  await writer.release(owner);
  assert.deepEqual(values,[.75,.45],'failed property read neither writes nor consumes the valid restore baseline');
}
console.log('PASS brightness failure boundaries: stale Window/owner lookup, current rejection, synchronous properties failure and subsequent drain');

}
for (const id of selectContractCases({ 'writer-ordering': { description: 'Production brightness writer with explicitly released lookup/native acknowledgements', resources: [] } })) {
  await runCase();
  recordContractCasePass(id);
}

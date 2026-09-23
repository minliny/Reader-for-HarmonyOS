import assert from 'node:assert/strict';
import { ReadingSessionProgressOwner } from '../entry/src/main/ets/features/reading/ReadingSessionProgressOwner.ts';
import { ReaderCoreRequestError } from '../entry/vendor/core-harmony/sdk/reader_core.ts';
import { classifyRemoteReadingCommandFailure } from '../entry/src/main/ets/features/reading/RemoteReadingContract.ts';

const layout = { viewportWidth: 390, viewportHeight: 800, fontScale: 1 };
const anchor = offset => ({ chapterIndex: 1, chapterOffset: offset, chapterProgress: offset / 1000,
  bodyVersion: 'body', processingVersion: 'processing' });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
const casRejected = (code = 'INVALID_PARAMS', reason = 'READING_PROGRESS_CHANGED') => new ReaderCoreRequestError({
  protocolVersion: 1, requestId: 1, type: 'error',
  error: { code, message: 'reading progress changed since observation', retryable: false, details: { reason, recoverable: true } },
});
function fixture({ cas = true } = {}) {
  let revision = 1, valid = true;
  let position = { bookId: 'book', ...anchor(10), updatedAt: 1, locationRevision: 'same-anchor-format' };
  let serial = Promise.resolve();
  const writes = [], reads = [], gates = [], effects = [], late = [];
  const readGates = [], readEffects = [];
  const access = {
    read: async current => {
      reads.push(position.chapterOffset);
      const gate = readGates.shift(); if (gate) await gate.promise;
      if (!current()) throw Error('cancelled');
      if (readEffects.shift() === 'reject') throw Error('baseline read failure');
      return { kind: 'restored', progress: { ...position }, ...(cas ? { progressRevision: `op:${revision}` } : {}) };
    },
    write: async (title, target, _layout, current, expected) => {
      const call = { title, ...target, expected }; writes.push(call);
      const apply = () => {
        if (!current()) throw Error('cancelled');
        if (cas && expected !== `op:${revision}`) throw Error('READING_PROGRESS_CHANGED');
        position = { bookId: 'book', ...target, updatedAt: ++revision, locationRevision: 'same-anchor-format' };
        return { ...position };
      };
      const gate = gates.shift(); if (gate) await gate.promise;
      const effect = effects.shift();
      if (typeof effect === 'function') effect();
      if (effect === 'late') { late.push(apply); throw Error('unknown native result'); }
      if (effect === 'reject') throw Error('unknown before commit');
      const stored = apply();
      if (effect === 'lost') throw Error('receipt lost');
      return stored;
    },
  };
  const runtime = { supportsCoreCapability: capability => cas && capability === 'reading.progress.compareAndSet.v1',
    captureReadingContentValidity: () => () => valid };
  const owner = new ReadingSessionProgressOwner(runtime, 'source', 'book', operation => {
    const result = serial.catch(() => {}).then(operation); serial = result.catch(() => {}); return result;
  });
  return { owner, access, writes, reads, gates, effects, late, readGates, readEffects,
    persist: offset => owner.persistPresented('chapter', anchor(offset), layout, access),
    position: () => position, invalidate: () => { valid = false; },
    change: offset => { position = { ...position, ...anchor(offset), updatedAt: ++revision }; },
  };
}
const checks = [];
{
  const f = fixture(), gate = deferred(); f.gates.push(gate);
  const first = f.persist(20); await settle();
  const middle = f.persist(30); const superseded = assert.rejects(middle, /SUPERSEDED/);
  const last = f.persist(40);
  assert.equal(f.owner.pendingProgress().progress.chapterOffset, 40);
  assert.equal(f.writes.length, 1);
  gate.resolve(); await Promise.all([first, superseded, last]);
  assert.deepEqual(f.writes.map(write => write.chapterOffset), [20, 40]);
  assert.equal(f.position().chapterOffset, 40);
  assert.equal(f.owner.pendingProgress(), undefined);
  checks.push('one dispatched operation plus one coalesced latest tail');
}
{
  const f = fixture(), gate = deferred(); f.readGates.push(gate);
  const old = f.persist(20); const superseded = assert.rejects(old, /SUPERSEDED/); await settle();
  const latest = f.persist(40); gate.resolve(); await Promise.all([superseded, latest]);
  assert.deepEqual(f.writes.map(write => write.chapterOffset), [40]);
  checks.push('superseded prerequisite read never dispatches its stale write');
}
for (const effect of ['lost', 'late']) {
  const f = fixture(); f.effects.push(effect);
  await assert.rejects(f.persist(20));
  const newer = f.persist(40); assert.equal(f.owner.pendingProgress().progress.chapterOffset, 40);
  await newer;
  assert.deepEqual(f.writes.map(write => write.chapterOffset), effect === 'lost' ? [20, 40] : [20, 20, 40]);
  assert.equal(f.position().chapterOffset, 40);
  if (effect === 'late') assert.throws(() => f.late[0](), /READING_PROGRESS_CHANGED/);
  checks.push(`unknown predecessor reconciles before new tail; late original cannot overwrite/${effect}`);
}
{
  const f = fixture(), oldGate = deferred(), tailGate = deferred(); f.gates.push(oldGate, tailGate);
  const old = f.persist(20); await settle(); const latest = f.persist(40);
  oldGate.resolve(); await old; await settle();
  assert.equal(f.owner.pendingProgress().progress.chapterOffset, 40, 'old receipt does not retire new presentation');
  tailGate.resolve(); await latest;
  checks.push('late receipt cannot clear the newer displayed intent');
}
{
  const f = fixture(); f.effects.push('late'); await assert.rejects(f.persist(20)); f.change(80);
  await assert.rejects(f.persist(40), /RETRY_CONFLICT/);
  let transactionRan = false;
  await assert.rejects(f.owner.runSerial(async () => { transactionRan = true; }), /RETRY_CONFLICT/);
  assert.equal(transactionRan, false); assert.equal(f.position().chapterOffset, 80);
  assert.equal(f.owner.pendingProgress().progress.chapterOffset, 40);
  assert.equal(f.writes.length, 1);
  checks.push('conflicting unknown is retained and blocks both tail and transaction');
}
{
  const f = fixture({ cas: false }); f.effects.push('lost'); await assert.rejects(f.persist(20));
  await assert.rejects(f.persist(40), /CAS_REQUIRED/);
  let ran = false; await assert.rejects(f.owner.runSerial(async () => { ran = true; }), /CAS_REQUIRED/);
  assert.equal(ran, false); assert.equal(f.writes.length, 1);
  checks.push('legacy Core cannot infer mutation completion from matching anchor');
}
{
  const f = fixture(), gate = deferred(); f.gates.push(gate);
  const first = f.persist(20); await settle(); const tail = f.persist(40);
  let transactionRan = false;
  const boundary = f.owner.runSerial(async () => {
    transactionRan = true; assert.equal(f.position().chapterOffset, 40); f.change(60); f.owner.noteCommitted();
  });
  await assert.rejects(f.persist(80), /TRANSACTION_PENDING/);
  assert.equal(transactionRan, false);
  gate.resolve(); await Promise.all([first, tail, boundary]);
  assert.equal(f.position().chapterOffset, 60);
  await f.persist(80); assert.equal(f.position().chapterOffset, 80);
  checks.push('transaction freezes new ordinary admission, drains earlier tail and keeps serial ordering');
}
{
  const f = fixture(); f.readEffects.push('reject', 'reject');
  await assert.rejects(f.persist(20), /baseline read failure/);
  await assert.rejects(f.owner.awaitPersistence(), /baseline read failure/);
  assert.equal(f.writes.length, 0);
  assert.equal((await f.owner.awaitPersistence()).chapterOffset, 20);
  assert.equal(f.writes.length, 1);
  checks.push('undispatched read failure remains safely retryable without duplicate writes');
}
{
  const f = fixture(), gate = deferred(); f.gates.push(gate);
  const write = f.persist(20); const rejected = assert.rejects(write, /cancelled/); await settle();
  f.invalidate(); assert.equal(f.owner.pendingProgress(), undefined); gate.resolve(); await rejected;
  assert.equal(f.position().chapterOffset, 10);
  checks.push('content lifetime invalidation cancels the submitted adapter guard');
}
{
  const f = fixture(); f.access.read = async () => ({ kind: 'missing' });
  await assert.rejects(f.persist(20), /REVISION_MISSING/);
  assert.equal(f.writes.length, 0);
  checks.push('advertised CAS without no-row token fails closed before dispatch');
}
for (const [transport, wrap] of [
  ['local SDK', error => error],
  ['remote feature boundary', error => classifyRemoteReadingCommandFailure('reading.progress.update', error)],
]) {
  {
    const f = fixture(); f.effects.push(() => { f.change(80); throw wrap(casRejected()); });
    await assert.rejects(f.persist(20), /reading progress changed/);
    assert.equal(f.position().chapterOffset, 80);
    assert.equal(f.owner.pendingProgress().progress.chapterOffset, 20);
    assert.equal((await f.owner.awaitPersistence()).chapterOffset, 20);
    assert.deepEqual(f.writes.map(write => write.expected), ['op:1', 'op:2']);
    assert.equal(f.owner.pendingProgress(), undefined);
    checks.push(`explicit CAS no-write rejection permits explicit fresh-baseline retry/${transport}`);
  }
  {
    const f = fixture(), gate = deferred(); f.gates.push(gate);
    f.effects.push(() => { f.change(80); throw wrap(casRejected()); });
    const old = f.persist(20); const rejected = assert.rejects(old, /reading progress changed/);
    await settle(); const latest = f.persist(40); gate.resolve(); await Promise.all([rejected, latest]);
    assert.deepEqual(f.writes.map(write => [write.chapterOffset, write.expected]), [[20, 'op:1'], [40, 'op:2']]);
    assert.equal(f.position().chapterOffset, 40);
    checks.push(`explicit rejected write yields to newest tail without dispatching old target again/${transport}`);
  }
  {
    const f = fixture(); f.effects.push(() => { f.change(80); throw wrap(casRejected()); });
    await assert.rejects(f.persist(20), /reading progress changed/);
    let ran = false;
    await f.owner.runSerial(async () => {
      assert.equal(f.position().chapterOffset, 20); ran = true; f.change(60); f.owner.noteCommitted();
    });
    assert.equal(ran, true); assert.equal(f.position().chapterOffset, 60);
    assert.equal(f.owner.pendingProgress(), undefined);
    checks.push(`strong transaction recovers definite no-write rejection before crossing boundary/${transport}`);
  }
}
for (const [name, failure] of [
  ['message only', Error('READING_PROGRESS_CHANGED')],
  ['timeout with reason', casRejected('TIMEOUT')],
  ['other invalid params', casRejected('INVALID_PARAMS', 'POSITION_CONTEXT_STALE')],
  ['different remote command', classifyRemoteReadingCommandFailure('reading.progress.get', casRejected())],
]) {
  const f = fixture(); f.effects.push(() => { f.change(80); throw failure; });
  await assert.rejects(f.persist(20));
  await assert.rejects(f.owner.awaitPersistence(), /RETRY_CONFLICT/);
  assert.equal(f.writes.length, 1); assert.equal(f.position().chapterOffset, 80);
  assert.equal(f.owner.pendingProgress().progress.chapterOffset, 20);
  checks.push(`ambiguous or unrelated rejection remains unknown/${name}`);
}
{
  const f = fixture(); f.effects.push('late'); await assert.rejects(f.persist(20));
  const gate = deferred(); f.gates.push(gate);
  f.effects.push(() => { f.change(80); throw casRejected(); });
  const retry = f.owner.awaitPersistence(); const rejected = assert.rejects(retry, /reading progress changed/);
  await settle(); gate.resolve(); await rejected;
  await assert.rejects(f.persist(40), /RETRY_CONFLICT/);
  let ran = false; await assert.rejects(f.owner.runSerial(async () => { ran = true; }), /RETRY_CONFLICT/);
  assert.equal(ran, false); assert.equal(f.writes.length, 2); assert.equal(f.position().chapterOffset, 80);
  assert.throws(() => f.late[0](), /READING_PROGRESS_CHANGED/);
  assert.equal(f.owner.pendingProgress().progress.chapterOffset, 40);
  checks.push('definite rejection of retry never discards its earlier unknown request');
}
console.log(JSON.stringify({ status: 'PASS', checks, boundary: 'Production Owner and controlled Core CAS/serial adapters; no native/device acceptance.' }, null, 2));

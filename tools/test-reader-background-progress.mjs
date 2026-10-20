import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReadingProgressJournal } = await import('../entry/src/main/ets/features/reading/ReadingProgressJournal.ts');
const { ReadingSessionFlowGateway, recoverReadingProgress } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const layout = { viewportWidth: 390, viewportHeight: 800, fontScale: 1 };
const anchor = offset => ({ chapterIndex: 2, chapterOffset: offset, chapterProgress: offset / 100,
  bodyVersion: 'body', processingVersion: 'processing' });
const settle = async () => { for (let n = 0; n < 160; n++) await Promise.resolve(); };
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function fixture({ disk = { raw: '' }, progress = 10, revision = 1, sourceId = 'local', readFailures = 0, failWrites = false } = {}) {
  let durable = { sourceId, bookId: 'book', ...anchor(progress), updatedAt: revision, locationRevision: `r${revision}` };
  let valid = true, mounted = true;
  const calls = [], effects = [], writes = [], journalWrites = [];
  let reads = 0, attemptedWrites = 0;
  const journal = new ReadingProgressJournal({ async read() {
    if (reads++ < readFailures) throw Error('temporary journal read IO'); return disk.raw;
  }, async write(raw) { attemptedWrites++; if (failWrites) throw Error('disk unavailable'); disk.raw = raw; journalWrites.push(JSON.parse(raw)); } });
  const runtime = { getReadingProgressJournal: () => journal,
    getReadingRecordGateway: () => ({ async currentDeviceId() { return 'device'; } }),
    supportsCoreCapability: capability => ['reading.progress.compareAndSet.v1', 'reading.progress.sourceFinalizeReceipt.v1'].includes(capability),
    captureReadingContentValidity: () => () => valid,
    async request(method, params, options = {}) {
      calls.push({ method, params: structuredClone(params) });
      if (method === 'reading.progress.get') return { data: { found: true, progress: structuredClone(durable), progressRevision: `op:${revision}` } };
      assert.equal(method, 'reading.progress.update');
      assert.ok(journalWrites.some(record => record.records.some(value => value.active?.writeDispatched &&
        value.active.baseline?.progressRevision === params.expectedProgressRevision)), 'Atomic checkpoint acknowledges before dispatch');
      writes.push(structuredClone(params)); options.onDispatch?.();
      const effect = effects.shift(); if (effect?.promise) await effect.promise;
      if (params.expectedProgressRevision !== `op:${revision}`) throw Error('READING_PROGRESS_CHANGED');
      durable = { sourceId, bookId: 'book', chapterIndex: params.chapterIndex, chapterOffset: params.chapterOffset,
        chapterProgress: params.chapterProgress, bodyVersion: params.expectedBodyVersion, processingVersion: params.expectedProcessingVersion,
        deviceId: params.deviceId, updatedAt: ++revision, locationRevision: `r${revision}` };
      if (effect === 'lost') throw Error('ACK lost');
      return { data: { stored: true, ...durable, progressRevision: `op:${revision}`,
        ...(params.transactionId ? { transactionId: params.transactionId, sourceSwitchFinalized: true } : {}) } };
    } };
  const gateway = new ReadingSessionFlowGateway(sourceId, 'book', sourceId === 'local' ? { kind: 'local' } : { kind: 'remote' }, runtime);
  const cleanup = () => { valid = false; mounted = false; clearTimeout(gateway.progressOwner.backgroundTimer); };
  return { runtime, gateway, disk, journal, effects, writes, calls, journalWrites, cleanup,
    attemptedWrites: () => attemptedWrites,
    durable: () => durable, current: () => mounted, unmount: () => { mounted = false; },
    move(offset) { durable = { ...durable, ...anchor(offset), updatedAt: ++revision, locationRevision: `r${revision}` }; } };
}
const cases = [];
{
  const f = fixture(), gate = deferred(); f.effects.push(gate);
  const returned = f.gateway.handoffPresentedProgress('book', 'two', anchor(40), layout);
  assert.equal(returned, undefined, 'navigation never observes or waits for the Core promise');
  f.unmount(); await settle();
  assert.equal(f.writes.length, 1); assert.equal(f.durable().chapterOffset, 10);
  assert.equal(JSON.parse(f.disk.raw).records[0].active.anchor.chapterOffset, 40);
  gate.resolve(); await f.gateway.awaitPresentedProgressPersistence();
  assert.equal(f.durable().chapterOffset, 40, 'unmount cannot revoke accepted displayed progress');
  assert.deepEqual(JSON.parse(f.disk.raw).records, []); f.cleanup(); cases.push('immediate-exit/durable-handoff-no-UI-closure');
}
{
  const f = fixture(); f.effects.push('lost');
  await assert.rejects(f.gateway.persistPresentedProgress('book', 'two', anchor(40), layout, f.current), /ACK lost/);
  f.unmount(); f.gateway.handoffPendingProgress(); await settle();
  await f.gateway.awaitPresentedProgressPersistence();
  assert.equal(f.writes.length, 1, 'lost ACK resolves against the original CAS revision, without another write');
  assert.equal(f.durable().chapterOffset, 40); f.cleanup(); cases.push('unknown-ACK/reconcile-original-CAS-on-unmount');
}
{
  const disk = { raw: JSON.stringify({ version: 1, records: [{ sourceId: 'local', bookId: 'book', sequence: 7,
    active: { sequence: 7, title: 'two', anchor: anchor(40), layout, baseline: { kind: 'restored',
      progress: { bookId: 'book', ...anchor(10), updatedAt: 1 }, progressRevision: 'op:1' }, writeDispatched: true } }] }) };
  const f = fixture({ disk, progress: 40, revision: 2 });
  await recoverReadingProgress(f.runtime); await settle();
  await f.gateway.awaitPresentedProgressPersistence();
  assert.equal(f.writes.length, 0); assert.equal(f.durable().chapterOffset, 40);
  assert.deepEqual(JSON.parse(disk.raw).records, []); f.cleanup(); cases.push('cold-restart/confirm-stored-target-without-new-operation');
}
{
  const disk = { raw: JSON.stringify({ version: 1, records: [{ sourceId: 'local', bookId: 'book', sequence: 7,
    active: { sequence: 7, title: 'two', anchor: anchor(40), layout, baseline: { kind: 'restored',
      progress: { bookId: 'book', ...anchor(10), updatedAt: 1 }, progressRevision: 'op:1' }, writeDispatched: true } }] }) };
  const f = fixture({ disk, progress: 60, revision: 3 });
  await assert.rejects(f.gateway.awaitPresentedProgressPersistence(), /RETRY_CONFLICT/);
  assert.equal(f.writes.length, 0, 'a cold old tail must never borrow a later CAS revision');
  assert.equal(f.durable().chapterOffset, 60);
  await f.gateway.persistPresentedProgress('book', 'new visit', anchor(80), layout);
  assert.equal(f.writes.length, 1); assert.equal(f.durable().chapterOffset, 80);
  f.cleanup(); cases.push('cold-restart/foreign-progress-preserved-new-session-may-advance');
}
{
  const f = fixture(); const retained = { ...anchor(10), retainedProgressReceipt: { progressRevision: 'op:1', updatedAt: 1, locationRevision: 'r1' } };
  f.gateway.handoffPresentedProgress('book', 'retained', retained, layout); f.unmount(); await settle();
  await f.gateway.awaitPresentedProgressPersistence();
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].deviceId, 'device');
  assert.equal(f.durable().chapterOffset, 10); assert.equal(f.durable().updatedAt, 2);
  f.cleanup(); cases.push('same-page/recency-renews-in-runtime-not-component');
}
for (const tailBaseline of [undefined, 'op:1']) {
  const baseline = revision => ({ kind: 'restored', progress: { bookId: 'book', ...anchor(10), updatedAt: 1 }, progressRevision: revision });
  const disk = { raw: JSON.stringify({ version: 1, records: [{ sourceId: 'local', bookId: 'book', sequence: 8,
    active: { sequence: 7, title: 'unknown predecessor', anchor: anchor(40), layout, baseline: baseline('op:1'), writeDispatched: true },
    tail: { sequence: 8, title: 'latest displayed', anchor: anchor(80), layout,
      ...(tailBaseline ? { baseline: baseline(tailBaseline) } : {}), writeDispatched: false } }] }) };
  const f = fixture({ disk, progress: 40, revision: 2 });
  await f.gateway.awaitPresentedProgressPersistence();
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].expectedProgressRevision, 'op:2');
  assert.equal(f.durable().chapterOffset, 80);
  f.cleanup(); cases.push(`cold-coalesced-tail/only-owned-predecessor-advances-baseline/${tailBaseline ?? 'none'}`);
}
{
  const journal = new ReadingProgressJournal({ async read() { return '{invalid'; }, async write() { throw Error('must preserve corrupt evidence'); } });
  await assert.rejects(journal.all()); cases.push('corrupt-journal/preserved-no-replacement-write');
}
{
  const f = fixture({ readFailures: 1 });
  await assert.rejects(f.gateway.awaitPresentedProgressPersistence(), /temporary journal read IO/);
  f.gateway.handoffPresentedProgress('book', 'retry', anchor(40), layout);
  await settle(); await f.gateway.awaitPresentedProgressPersistence();
  assert.equal(f.writes.length, 1); assert.equal(f.durable().chapterOffset, 40);
  f.cleanup(); cases.push('temporary-journal-read-failure/recovery-promise-retries');
}
{
  const f = fixture({ failWrites: true });
  f.gateway.handoffPresentedProgress('book', 'disk failure', anchor(40), layout);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(f.attemptedWrites() <= 4, `failure uses bounded backoff, not a microtask spin: ${f.attemptedWrites()}`);
  assert.equal(f.writes.length, 0, 'Core cannot accept a target whose journal never acknowledged');
  assert.equal(f.gateway.pendingPresentedProgress().progress.chapterOffset, 40, 'warm target remains owned');
  f.cleanup(); cases.push('persistent-disk-failure/no-event-loop-spin-no-Core-dispatch');
}
{
  const disk = { raw: JSON.stringify({ version: 1, records: [{ sourceId: 'local', bookId: 'book', sequence: 7,
    tail: { sequence: 7, title: 'without a baseline', anchor: anchor(40), layout, writeDispatched: false } }] }) };
  const f = fixture({ disk });
  await assert.rejects(f.gateway.awaitPresentedProgressPersistence(), /RECOVERY_BASELINE_MISSING/);
  const record = JSON.parse(disk.raw).records[0];
  assert.equal(f.writes.length, 0); assert.equal((record.active ?? record.tail).anchor.chapterOffset, 40);
  assert.equal(f.gateway.pendingPresentedProgress(), undefined, 'an unproved cold target cannot hide authoritative Core progress');
  f.cleanup(); cases.push('cold-unsent-no-baseline/preserve-record-without-rebasing-or-deletion');
}
let activeRuntime;
const RuntimeFeedback = productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url),
  ['notifyBackgroundReadingProgressConfirmed'], { ReaderRuntimeOwner: { current: () => activeRuntime } });
for (const mode of ['delayed-ACK', 'lost-ACK', 'retired-runtime', 'foreground']) {
  const f = fixture(), changes = [], shelfReads = [];
  const coordinator = new BookAcquisitionCoordinator(async () => assert.fail('notifying the shelf cannot issue an extra mutation'));
  coordinator.subscribe(change => { changes.push(change); shelfReads.push(f.durable().chapterOffset); });
  const owner = Object.assign(new RuntimeFeedback(), { state: 'ready', bookCoordinator: coordinator });
  activeRuntime = owner;
  f.runtime.notifyBackgroundReadingProgressConfirmed = (sourceId, bookId) => owner.notifyBackgroundReadingProgressConfirmed(sourceId, bookId);
  if (mode === 'foreground') await f.gateway.persistPresentedProgress('book', 'ordinary page', anchor(40), layout);
  else if (mode === 'lost-ACK') {
    f.effects.push('lost');
    await assert.rejects(f.gateway.persistPresentedProgress('book', 'unknown', anchor(40), layout), /ACK lost/);
    f.unmount(); f.gateway.handoffPendingProgress(); await settle();
    await f.gateway.awaitPresentedProgressPersistence();
  } else {
    const gate = deferred(); f.effects.push(gate);
    f.gateway.handoffPresentedProgress('book', 'exit', anchor(40), layout); f.unmount(); await settle();
    assert.deepEqual(changes, []); assert.equal(f.durable().chapterOffset, 10, 'exit can precede the durable ACK');
    if (mode === 'retired-runtime') activeRuntime = undefined;
    gate.resolve(); await f.gateway.awaitPresentedProgressPersistence();
  }
  await new Promise(resolve => setTimeout(resolve, 25));
  if (mode === 'foreground' || mode === 'retired-runtime') assert.deepEqual(changes, [], 'ordinary pages and retired runtimes cannot cause background shelf refresh');
  else {
    assert.equal(changes.length, 1); assert.equal(changes[0].shelfChanged, true);
    assert.deepEqual(changes[0].identities, [{ sourceId: 'local', bookId: 'book' }]);
    assert.deepEqual(shelfReads, [40], 'the existing real Coordinator subscriber refreshes after the actual saved target');
  }
  coordinator.close(); f.cleanup(); cases.push(`background-ACK/real-runtime-coordinator-shelf-channel/${mode}`);
}
console.log(JSON.stringify({ passed: true, scenarios: cases.length, cases,
  boundary: 'Actual production progress owner/gateways/journal; controlled platform AtomicFile/Core IO. No device evidence.' }));

import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { ReadingEntryPreparation } = await import('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
const layout = { viewportWidth: 390, viewportHeight: 800, fontScale: 1 };
const anchor = offset => ({ chapterIndex: 2, chapterOffset: offset, chapterProgress: offset / 1000,
  bodyVersion: 'body', processingVersion: 'processing' });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function settle() { for (let n = 0; n < 30; n++) await Promise.resolve(); }
function fixture(sourceId = 'local') {
  let durable = { sourceId, bookId: 'book', ...anchor(10), updatedAt: 1, locationRevision: 'r1' };
  const calls = [], gates = [], effects = [], readGates = [], readEffects = [];
  let closed = false, revision = 1;
  const runtime = { supportsCoreCapability: capability => capability === 'reading.progress.compareAndSet.v1',
    request: async (method, params, options = {}) => {
    calls.push({ method, params, options });
    if (options.shouldCancel?.()) throw Error('cancelled');
    if (method === 'reading.progress.get') {
      const gate = readGates.shift(); if (gate) await gate.promise;
      if (readEffects.shift() === 'reject') throw Error('temporary baseline read failure');
      return { data: { found: true, progress: { ...durable }, progressRevision: `op:${revision}` } };
    }
    assert.equal(method, 'reading.progress.update');
    const fence = preparation.beginRequest(method, params);
    try {
      const gate = gates.shift(); if (gate) await gate.promise;
      if (options.shouldCancel?.()) throw Error('cancelled');
      const effect = effects.shift();
      if (effect === 'reject') throw Error('write rejected before storage');
      if (params.expectedProgressRevision !== undefined && params.expectedProgressRevision !== `op:${revision}`)
        throw Error('READING_PROGRESS_CHANGED');
      durable = { sourceId, bookId: 'book', chapterIndex: params.chapterIndex, chapterOffset: params.chapterOffset,
        chapterProgress: params.chapterProgress, bodyVersion: params.expectedBodyVersion, processingVersion: params.expectedProcessingVersion,
        updatedAt: ++revision, locationRevision: `r${revision}` };
      if (effect === 'lost') throw Error('receipt lost after storage');
      return { data: { stored: true, ...durable } };
    } finally { if (fence) preparation.finishRequest(method, params); }
  }, captureReadingContentValidity: (source, book) => {
    const valid = preparation.captureContentValidity(source, book); return () => !closed && valid();
  } };
  const preparation = new ReadingEntryPreparation(runtime);
  const source = sourceId === 'local' ? { kind: 'local' } : { kind: 'remote', session: {
    identity: { sourceId, bookId: 'book' }, entries: [], preparedChapter: { content: 'not retained by progress owner' } } };
  return { runtime, preparation, calls, gates, effects, readGates, readEffects,
    gateway: transaction => new ReadingSessionFlowGateway(sourceId, 'book', source, runtime, transaction),
    writes: () => calls.filter(call => call.method === 'reading.progress.update'),
    durable: () => durable, change: offset => { durable = { ...durable, ...anchor(offset), updatedAt: ++revision, locationRevision: `r${revision}` }; },
    close() { closed = true; preparation.close(); },
  };
}
const cases = [];
for (const sourceId of ['local', 'remote']) {
  const f = fixture(sourceId), gateway = f.gateway();
  const restored = await gateway.loadProgress('book');
  assert.equal(restored.kind, 'restored');
  assert.equal(restored.progressRevision, 'op:1', 'the shared gateway must retain the Core operation revision outside the progress DTO');
  assert.equal(restored.progress.locationRevision, 'r1', 'the location revision is a separate receipt');
  await gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout);
  assert.equal(f.writes()[0].params.expectedProgressRevision, 'op:1', 'CAS compares the operation revision, not the location revision');
  const stored = await gateway.loadProgress('book');
  assert.equal(stored.progressRevision, 'op:2');
  assert.equal(stored.progress.chapterOffset, 20);
  f.close(); cases.push(`durable-operation-revision-and-CAS/${sourceId}`);
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture(sourceId), gateway = f.gateway(); f.readEffects.push('reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout), /baseline read failure/);
  assert.equal(f.writes().length, 0, 'prerequisite failure is provably before write dispatch');
  const stored = await gateway.awaitPresentedProgressPersistence();
  assert.equal(stored.chapterOffset, 20); assert.equal(f.writes().length, 1);
  assert.equal(gateway.pendingPresentedProgress(), undefined);
  f.close(); cases.push(`prewrite-read-recovery/${sourceId}`);
}
{
  const f = fixture(), gateway = f.gateway(); f.readEffects.push('reject', 'reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout), /baseline read failure/);
  await assert.rejects(gateway.awaitPresentedProgressPersistence(), /baseline read failure/);
  assert.equal(f.writes().length, 0);
  assert.equal((await gateway.awaitPresentedProgressPersistence()).chapterOffset, 20);
  assert.equal(f.writes().length, 1); f.close(); cases.push('repeated-prewrite-read-failure-can-recover');
}
{
  const f = fixture(), gateway = f.gateway(); f.readEffects.push('reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'old', anchor(20), layout), /baseline read failure/);
  const gate = deferred(); f.readGates.push(gate);
  const boundary = gateway.awaitPresentedProgressPersistence(); await settle();
  const reopened = f.gateway();
  const newer = reopened.persistPresentedProgress('book', 'new displayed position', anchor(40), layout);
  gate.resolve(); await Promise.all([boundary, newer]);
  assert.deepEqual(f.writes().map(call => call.params.chapterOffset), [40], 'a superseded unsent save does not write its old anchor');
  assert.equal(f.durable().chapterOffset, 40); f.close(); cases.push('new-displayed-position-during-prewrite-recovery');
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture(sourceId), old = f.gateway(), gate = deferred(); f.gates.push(gate);
  const write = old.persistPresentedProgress('book', 'chapter', anchor(20), layout); await settle();
  assert.equal(f.writes().length, 1); assert.equal(f.writes()[0].options.shouldCancel(), false,
    'an ordinary progress mutation must not invalidate its own content lease');
  const reopened = f.gateway(), pending = await reopened.loadProgress('book');
  assert.equal(pending.presentationPending, true); assert.equal(pending.progress.chapterOffset, 20);
  assert.equal(pending.progress.locationRevision, undefined, 'in-process intent is never fabricated as a durable receipt');
  assert.equal(f.durable().chapterOffset, 10);
  let newerStarted = false;
  const later = reopened.runProgressCommitSerial(async () => {
    newerStarted = true; await reopened.resolveAndUpdateProgress('book', 'chapter', anchor(30), layout, () => true);
  });
  await settle(); assert.equal(newerStarted, false, 'new gateway shares the old in-flight write lane');
  gate.resolve(); await Promise.all([write, later]);
  assert.equal((await reopened.loadProgress('book')).progress.chapterOffset, 30);
  assert.equal(reopened.pendingPresentedProgress(), undefined); f.close(); cases.push(`rebuild/shared-lane/${sourceId}`);
}
for (const effect of ['lost', 'reject']) {
  const f = fixture(), gateway = f.gateway(); f.effects.push(effect);
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout));
  assert.equal(gateway.pendingPresentedProgress().progress.chapterOffset, 20);
  const receipt = await gateway.awaitPresentedProgressPersistence();
  assert.equal(receipt.chapterOffset, 20); assert.equal(f.writes().length, effect === 'lost' ? 1 : 2);
  assert.equal(f.calls.at(effect === 'lost' ? -1 : -2).method, 'reading.progress.get', 'always read Core before retry');
  assert.equal(gateway.pendingPresentedProgress(), undefined); f.close(); cases.push(`unknown-reconcile/${effect}`);
}
{
  const f = fixture(), gateway = f.gateway(); f.effects.push('reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout));
  f.change(40);
  await assert.rejects(gateway.awaitPresentedProgressPersistence(), /RETRY_CONFLICT/);
  assert.equal(f.writes().length, 1); assert.equal(f.durable().chapterOffset, 40); f.close(); cases.push('conflicting-core-never-overwritten');
}
{
  const f = fixture(), gateway = f.gateway(); f.effects.push('reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout));
  const gate = deferred(); f.readGates.push(gate);
  const boundary = gateway.awaitPresentedProgressPersistence();
  const rejected = assert.rejects(boundary, /RETRY_CONFLICT/); await settle();
  f.change(40); gate.resolve(); await rejected;
  assert.equal(f.writes().length, 1); assert.equal(f.durable().chapterOffset, 40);
  f.close(); cases.push('Core-position-changed-during-uncertain-write-recovery-read');
}
for (const mutation of ['replace-rule.update', 'replace.undo', 'runtime-close']) {
  const f = fixture(), gateway = f.gateway(), gate = deferred(); f.gates.push(gate);
  const writing = gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout); await settle();
  if (mutation === 'runtime-close') f.close(); else f.preparation.beginRequest(mutation, {});
  assert.equal(gateway.pendingPresentedProgress(), undefined);
  assert.equal(f.writes()[0].options.shouldCancel(), true); gate.resolve(); await assert.rejects(writing);
  assert.equal(f.durable().chapterOffset, 10); f.close(); cases.push(`invalidation/${mutation}`);
}
{
  const f = fixture('remote'), gateway = f.gateway(), gate = deferred(); f.gates.push(gate);
  const write = gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout); await settle();
  const transaction = f.gateway('tx');
  assert.equal(transaction.pendingPresentedProgress(), undefined);
  assert.equal((await transaction.loadProgress('book')).progress.chapterOffset, 10);
  assert.throws(() => transaction.persistPresentedProgress('book', 'chapter', anchor(20), layout), /TRANSACTION_PENDING/);
  gate.resolve(); await write; f.close(); cases.push('source-switch-cannot-use-ordinary-intent');
}
{
  const f = fixture(), gateway = f.gateway(), gate = deferred(); f.gates.push(gate);
  const writing = gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout); await settle();
  const reopened = f.gateway(), opened = [];
  const Owner = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
    ['loadInitialChapter'], { LOCAL_READING_SOURCE_ID: 'local' });
  const owner = Object.assign(new Owner(), { sourceId: 'local', bookId: 'book', chapterSelectionToken: 2,
    preparedReadingEntry: { isCurrent: () => true, toc: { entries: [{ index: 1 }, { index: 2 }] },
      progress: { kind: 'restored', progress: { ...anchor(10), chapterIndex: 1 } }, chapter: { chapterIndex: 1 } },
    isSelectionActive: () => true, activeGateway: () => reopened, sessionGateway: reopened,
    admitTocEntries(entries) { this.tocEntries = entries; }, onDirectoryProjectionChanged() {},
    readingTocEntries() { return this.tocEntries; }, chapterWindow: { configure() {} },
    normalizedRequestedChapter: () => undefined, requireKnownChapter: index => index,
    async openChapter(index) { opened.push({ index, progress: this.restoredProgress }); }, fail: error => { throw error; } });
  await owner.loadInitialChapter(1, Promise.resolve([]));
  assert.equal(opened[0].index, 2); assert.equal(opened[0].progress.progress.chapterOffset, 20);
  assert.equal(opened[0].progress.presentationPending, true);
  assert.equal(owner.preparedReadingEntry, undefined, 'old prepared body cannot bypass the newer displayed anchor');
  gate.resolve(); await writing; f.close(); cases.push('LRE-prepared-A-yields-to-shared-pending-B');
}
// Invoke the production LRE boundary with the real gateway's unknown-write
// recovery. This is the same helper called by normal exit and content mutation.
for (const failure of ['lost-receipt', 'prewrite-read']) {
  const f = fixture(), gateway = f.gateway();
  if (failure === 'lost-receipt') f.effects.push('lost'); else f.readEffects.push('reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout));
  const Owner = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
    ['awaitOrdinaryFirstPagePersistence', 'isOrdinaryFirstPagePresentationCurrent']);
  const owner = Object.assign(new Owner(), { lifecycleToken: 1, chapterSelectionToken: 2, visiblePageSelectionToken: 2,
    visiblePage: { startScalar: 20 }, chapter: { chapterIndex: 2 }, sessionGateway: gateway,
    isMountedToken: token => token === 1, isReaderIdentityCurrent: () => true,
    admitCommittedProgress(stored) { this.lastCommittedProgress = stored; } });
  await owner.awaitOrdinaryFirstPagePersistence();
  assert.equal(owner.lastCommittedProgress.chapterOffset, 20); assert.equal(f.writes().length, 1);
  f.close(); cases.push(`exit/content-boundary-admits-reconciled-receipt/${failure}`);
}
console.log(JSON.stringify({ passed: true, scenarios: cases.length, cases,
  boundary: 'Actual preparation fences, shared session owner, local/remote gateway commands, serial queue and LRE persistence boundary; controlled Core I/O, no device paint claim.' }));

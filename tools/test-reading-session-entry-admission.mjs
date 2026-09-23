import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const settle = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
const layout = { viewportWidth: 390, viewportHeight: 800, fontScale: 1 };
function fixture({ sourceId = 'remote', modern = true, transactionId, explicit = false,
  hasPreparedEntry = false, existingSession = false } = {}) {
  let alive = true, version = 0;
  const calls = [], gates = new Map();
  const session = { identity: { sourceId, bookId: 'book' }, entries: [], acquisitionMode: 'offline' };
  const data = { kind: 'ready', sourceId, bookId: 'book', chapterIndex: 2, chapterTitle: '章', content: '原文正文',
    blocks: [{ kind: 'text', startScalar: 0, endScalar: 4, text: '原文正文' }],
    positionScope: { sourceId, bookId: 'book', chapterIndex: 2, bodyVersion: 'body', processingVersion: 'processing' },
    progress: { sourceId, bookId: 'book', chapterIndex: 2, chapterOffset: 0, chapterProgress: 0,
      updatedAt: 1, bodyVersion: 'body', processingVersion: 'processing' }, baseUrl: 'https://example.test/2', contentRefreshRequired: false };
  let answer = data;
  const runtime = {
    supportsCoreCapability: capability => capability === 'reading.progress.compareAndSet.v1' || modern && capability === 'reading.entry.snapshot.v1',
    captureReadingContentValidity() { const at = version; return () => version === at; },
    async request(method, params, options = {}) {
      calls.push({ method, params });
      const gate = gates.get(method); if (gate) await gate.promise;
      if (options.shouldCancel?.()) throw Error('request cancelled');
      if (method === 'reading.entry.snapshot') return { data: structuredClone(answer) };
      if (method === 'source.switch.pending.list') return { data: { transactionId } };
      if (method === 'reading.progress.get') return { data: { found: false, progress: null, progressRevision: 'op:1' } };
      throw Error(`unexpected request ${method}`);
    },
    bookAcquisitions: () => ({ async acquireBookWithBackgroundRefresh() {
      calls.push({ method: 'acquireBookWithBackgroundRefresh' }); return { session };
    } }),
  };
  const intent = { sourceId, bookId: 'book', isCurrent: () => alive,
    hasPreparedEntry, remoteSession: existingSession ? session : undefined,
    remoteBookSeed: sourceId === 'local' ? undefined : { sourceId, bookId: 'book', detailUrl: '/book' },
    sourceSwitchTransactionId: explicit ? transactionId : undefined,
    onRemoteSessionReady(value) { assert.equal(value, session); },
    async resolveSourceSwitchTransactionId() {
      assert.notEqual(sourceId, 'local');
      return (await runtime.request('source.switch.pending.list', {})).data.transactionId;
    },
  };
  return { runtime, intent, calls, gates, session, data, methods: () => calls.map(c => c.method),
    missing(reason) { answer = { kind: 'missing', sourceId, bookId: 'book', reason }; },
    stop() { alive = false; }, invalidate() { version++; } };
}
const checks = [];
for (const sourceId of ['local', 'remote']) {
  const f = fixture({ sourceId }); const gateway = await ReadingSessionFlowGateway.open(f.intent, f.runtime);
  assert.deepEqual(f.methods(), []);
  const snapshot = await gateway.loadEntrySnapshot(undefined, f.intent.isCurrent);
  const chapter = await gateway.loadChapter('book', 2, f.intent.isCurrent);
  assert.equal(chapter, snapshot.chapter);
  assert.deepEqual(f.methods(), ['reading.entry.snapshot']);
  assert.equal(gateway.canPersistPresentedProgress(), true);
  assert.equal(gateway.remoteSession(), undefined);
  f.invalidate(); assert.equal(snapshot.isCurrent(), false, 'entry admission never drops the content validity proof');
  checks.push(`one cold snapshot supplies chapter and pending admission/${sourceId}`);
}
for (const reason of ['contentMissing', 'catalogMissing', 'leadingContentEmpty', 'sourceSwitchPending']) {
  const transactionId = reason === 'sourceSwitchPending' ? 'transaction' : undefined;
  const f = fixture({ transactionId }); f.missing(reason);
  const gateway = await ReadingSessionFlowGateway.open(f.intent, f.runtime);
  assert.equal(gateway.canPersistPresentedProgress(), false);
  assert.equal(await gateway.loadEntrySnapshot(undefined, f.intent.isCurrent), undefined);
  assert.deepEqual(f.methods(), ['reading.entry.snapshot', 'source.switch.pending.list']);
  assert.equal(gateway.hasPendingSourceSwitch(), transactionId !== undefined);
  await gateway.loadProgress('book', f.intent.isCurrent);
  await gateway.ensureRemoteSession(f.intent.isCurrent);
  assert.equal(f.methods().filter(m => m === 'source.switch.pending.list').length, 1);
  if (transactionId !== undefined) {
    assert.equal(gateway.canPersistPresentedProgress(), false);
    assert.throws(() => gateway.persistPresentedProgress('book', '章', { chapterIndex: 2, chapterOffset: 0, chapterProgress: 0 }, layout), /TRANSACTION_PENDING/);
    assert.equal(await gateway.loadEntrySnapshot(undefined, f.intent.isCurrent), undefined);
    assert.equal(f.methods().filter(m => m === 'reading.entry.snapshot').length, 1);
  }
  checks.push(`snapshot miss resolves transaction before fallback/${reason}`);
}
for (const modern of [true, false]) {
  const f = fixture({ sourceId: 'local', modern }); f.missing('contentMissing');
  const gateway = await ReadingSessionFlowGateway.open(f.intent, f.runtime);
  assert.equal(await gateway.loadEntrySnapshot(undefined, f.intent.isCurrent), undefined);
  await gateway.loadProgress('book', f.intent.isCurrent);
  assert.deepEqual(f.methods(), modern ? ['reading.entry.snapshot', 'reading.progress.get'] : ['reading.progress.get']);
  assert.equal(gateway.hasPendingSourceSwitch(), false);
  checks.push(`local missing entry never requests remote pending admission/modern=${modern}`);
}
{
  const f = fixture({ transactionId: 'transaction', explicit: true });
  const gateway = await ReadingSessionFlowGateway.open(f.intent, f.runtime);
  assert.equal(gateway.hasPendingSourceSwitch(), true);
  assert.equal(await gateway.loadEntrySnapshot(undefined, f.intent.isCurrent), undefined);
  assert.deepEqual(f.methods(), []);
  checks.push('explicit source switch retains its strong transaction path');
}
{
  const f = fixture({ modern: false, transactionId: 'transaction' });
  const gateway = await ReadingSessionFlowGateway.open(f.intent, f.runtime);
  assert.deepEqual(f.methods(), ['acquireBookWithBackgroundRefresh', 'source.switch.pending.list']);
  assert.equal(gateway.remoteSession(), f.session); assert.equal(gateway.hasPendingSourceSwitch(), true);
  checks.push('legacy Core keeps acquisition and pending preflight');
}
for (const existingSession of [false, true]) {
  for (const transactionId of [undefined, 'transaction']) {
    const f = fixture({ hasPreparedEntry: true, existingSession, transactionId }), gate = deferred();
    f.gates.set('source.switch.pending.list', gate);
    let opened = false;
    const task = ReadingSessionFlowGateway.open(f.intent, f.runtime).then(gateway => { opened = true; return gateway; });
    await settle();
    assert.equal(opened, false, 'prepared body must not bypass the existing pending preflight');
    assert.deepEqual(f.methods(), ['source.switch.pending.list']);
    gate.resolve(); const gateway = await task;
    assert.equal(gateway.hasPendingSourceSwitch(), transactionId !== undefined);
    assert.equal(gateway.canPersistPresentedProgress(), transactionId === undefined);
    assert.equal(gateway.remoteSession(), existingSession ? f.session : undefined);
    assert.deepEqual(f.methods(), ['source.switch.pending.list'], 'warm admission does not fetch another snapshot or session');
    checks.push(`prepared body preserves pending admission/session=${existingSession}/pending=${transactionId !== undefined}`);
  }
}
{
  const f = fixture({ hasPreparedEntry: true, existingSession: true }), gate = deferred();
  f.gates.set('source.switch.pending.list', gate);
  const task = ReadingSessionFlowGateway.open(f.intent, f.runtime);
  await settle(); f.stop(); gate.resolve();
  assert.equal(await task, undefined);
  assert.deepEqual(f.methods(), ['source.switch.pending.list']);
  checks.push('late warm pending response cannot open an obsolete selection');
}
for (const invalidation of ['selection', 'content']) {
  const f = fixture(), gate = deferred(); f.gates.set('reading.entry.snapshot', gate);
  const gateway = await ReadingSessionFlowGateway.open(f.intent, f.runtime);
  const task = gateway.loadEntrySnapshot(undefined, f.intent.isCurrent); const failed = assert.rejects(task, /cancelled/);
  if (invalidation === 'selection') f.stop(); else f.invalidate();
  gate.resolve(); await failed;
  assert.deepEqual(f.methods(), ['reading.entry.snapshot']);
  assert.equal(gateway.canPersistPresentedProgress(), false, 'a stale snapshot cannot grant ordinary admission');
  checks.push(`late snapshot never admits stale reader/${invalidation}`);
}
{
  const f = fixture({ transactionId: 'transaction' }), gate = deferred();
  f.missing('sourceSwitchPending'); f.gates.set('source.switch.pending.list', gate);
  const gateway = await ReadingSessionFlowGateway.open(f.intent, f.runtime);
  const task = gateway.loadEntrySnapshot(undefined, f.intent.isCurrent); const failed = assert.rejects(task, /cancelled/);
  await settle(); f.stop(); gate.resolve(); await failed;
  assert.equal(gateway.hasPendingSourceSwitch(), false);
  assert.equal(gateway.canPersistPresentedProgress(), false);
  checks.push('late pending receipt cannot install a transaction for an obsolete selection');
}
{
  const f = fixture(), gate = deferred(); f.gates.set('source.switch.pending.list', gate);
  const gateway = await ReadingSessionFlowGateway.open(f.intent, f.runtime);
  const progress = gateway.loadProgress('book', f.intent.isCurrent);
  const session = gateway.ensureRemoteSession(f.intent.isCurrent);
  await settle(); assert.deepEqual(f.methods(), ['source.switch.pending.list']);
  gate.resolve(); await Promise.all([progress, session]);
  assert.equal(f.methods().filter(m => m === 'source.switch.pending.list').length, 1);
  checks.push('direct fallback callers share one pending resolution');
}
{
  const f = fixture(); f.missing('contentMissing');
  const resolve = f.intent.resolveSourceSwitchTransactionId; let fail = true;
  f.intent.resolveSourceSwitchTransactionId = async () => { if (fail) throw Error('pending read unavailable'); return resolve(); };
  const gateway = await ReadingSessionFlowGateway.open(f.intent, f.runtime);
  await assert.rejects(gateway.loadEntrySnapshot(undefined, f.intent.isCurrent), /pending read unavailable/);
  assert.equal(gateway.canPersistPresentedProgress(), false);
  assert.throws(() => gateway.persistPresentedProgress('book', '章', { chapterIndex: 2, chapterOffset: 0, chapterProgress: 0 }, layout), /TRANSACTION_PENDING/);
  fail = false; await gateway.loadProgress('book', f.intent.isCurrent);
  assert.equal(gateway.canPersistPresentedProgress(), true);
  checks.push('failed pending admission remains closed and can be retried without losing the resolver');
}
console.log(JSON.stringify({ status: 'PASS', checks,
  boundary: 'Actual session gateway, entry decoding, body retention and progress eligibility; controlled Core responses, no device paint claim.' }, null, 2));

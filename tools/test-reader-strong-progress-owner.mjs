import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { reconcileReaderControlSelectionProgress } from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';

registerHooks({ resolve(s, c, next) { try { return next(s, c); } catch (e) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return next(`${s}.ts`, c); throw e;
} } });
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const start = source.indexOf('class CoreReadingAnchor implements');
const end = source.indexOf('\nclass ', start + 1);
const CoreReadingAnchor = new Function(stripTypeScriptTypes(source.slice(start, end)) + ';return CoreReadingAnchor;')();
const methods = ['persistMeasuredCanonicalProgress', 'persistPreparedPageTurn', 'reconcilePreparedPageTurn'];
const layout = { viewportWidth: 390, viewportHeight: 800, fontScale: 1 };
const anchor = offset => ({ chapterIndex: 2, chapterOffset: offset, chapterProgress: offset / 100,
  bodyVersion: 'body', processingVersion: 'processing' });
const deferred = () => { let resolve; return { promise: new Promise(r => { resolve = r; }), resolve: () => resolve() }; };
const settle = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
function fixture({ input = file, sourceId = 'local', cas = true, effect = 'ack' } = {}) {
  let revision = 1, retired = false, durable = { sourceId, bookId: 'book', ...anchor(10), updatedAt: 1, locationRevision: 'old' };
  const calls = [], late = [], readGates = [], writeGates = [];
  const apply = p => {
    if (p.expectedProgressRevision !== undefined && p.expectedProgressRevision !== `op:${revision}`) {
      const error = Error('READING_PROGRESS_CHANGED');
      error.event = { type: 'error', error: { code: 'INVALID_PARAMS', details: { reason: 'READING_PROGRESS_CHANGED' } } }; throw error;
    }
    durable = { sourceId, bookId: 'book', chapterIndex: p.chapterIndex, chapterOffset: p.chapterOffset,
      chapterProgress: p.chapterProgress, bodyVersion: p.expectedBodyVersion, processingVersion: p.expectedProcessingVersion,
      updatedAt: ++revision, locationRevision: `loc:${revision}` };
    return { data: { stored: true, ...durable } };
  };
  const runtime = { captureReadingContentValidity: () => () => true,
    supportsCoreCapability: name => cas && name === 'reading.progress.compareAndSet.v1',
    async request(method, p, options = {}) {
      calls.push({ method, p, options });
      if (options.shouldCancel?.()) throw Error('content retired');
      if (method === 'reading.progress.get') {
        const gate = readGates.shift(); if (gate) await gate.promise;
        return { data: { found: true, progress: { ...durable }, progressRevision: `op:${revision}` } };
      }
      assert.equal(method, 'reading.progress.update');
      const gate = writeGates.shift(); if (gate) await gate.promise;
      if (effect === 'late') { effect = 'ack'; late.push(() => apply(p)); throw Error('native ACK lost before physical settlement'); }
      const result = apply(p);
      if (effect === 'lost') { effect = 'ack'; throw Error('native ACK lost after physical settlement'); }
      return result;
    } };
  const gateway = new ReadingSessionFlowGateway(sourceId, 'book', { kind: sourceId === 'local' ? 'local' : 'remote' }, runtime);
  const Owner = productionMotionMethods(input, methods, { CoreReadingAnchor, reconcileReaderControlSelectionProgress,
    ReaderRuntimeOwner: { current: () => runtime }, hilog: { error() {} } });
  const prepared = { context: { chapter: { sourceId, bookId: 'book', chapterTitle: 'two', ...anchor(40) },
    layoutMap: { scalarCount: () => 100 } }, page: { startScalar: 40 } };
  const owner = Object.assign(new Owner(), { bookId: 'book', sourceId, lastCommittedProgress: { ...durable },
    activeGateway: () => gateway, coreLayout: () => layout, isPreparedPageTurnCommitCurrent: () => !retired,
    isMountedToken: () => !retired, errorMessage: e => e.message });
  return { owner, gateway, calls, prepared, readGates, writeGates, late,
    durable: () => ({ ...durable }), retire: () => { retired = true; },
    replace: (offset, bodyVersion = 'body', processingVersion = 'processing') => {
      durable = { ...durable, ...anchor(offset), bodyVersion, processingVersion, updatedAt: ++revision, locationRevision: `loc:${revision}` };
    }, writes: () => calls.filter(c => c.method === 'reading.progress.update') };
}
const cases = [];
for (const sourceId of ['local', 'remote']) for (const effect of ['ack', 'lost', 'late']) {
  const f = fixture({ sourceId, effect });
  assert.equal(await f.owner.persistPreparedPageTurn(f.prepared, 1, 7), true);
  assert.equal(f.owner.pageTurnStoredProgress.chapterOffset, 40);
  assert.equal(f.writes()[0].p.expectedProgressRevision, 'op:1', 'strong producer uses the actual shared owner/Core CAS');
  assert.equal(f.durable().chapterOffset, 40);
  if (effect === 'late') {
    // The retry uses the original CAS baseline; the first physical request
    // remains free to arrive, but cannot overwrite a later accepted position.
    await f.gateway.persistPresentedProgress('book', 'newer page', anchor(60), layout);
    assert.throws(f.late[0], /READING_PROGRESS_CHANGED/);
    assert.equal(f.durable().chapterOffset, 60);
  }
  cases.push(`prepared/shared-owner/${sourceId}/${effect}`);
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture({ sourceId }), gate = deferred(); f.writeGates.push(gate);
  const accepted = f.owner.persistPreparedPageTurn(f.prepared, 1, 7); await settle();
  assert.equal(f.writes().length, 1); f.retire(); gate.resolve();
  assert.equal(await accepted, undefined, 'retired UI does not publish its old page');
  assert.equal(f.durable().chapterOffset, 40, 'retirement does not cancel the accepted durable write');
  assert.equal(f.owner.pageTurnStoredProgress, undefined); cases.push(`prepared/retired-after-dispatch/${sourceId}`);
}
{
  const f = fixture(), gate = deferred(); f.readGates.push(gate);
  const pending = f.owner.persistPreparedPageTurn(f.prepared, 1, 7); await settle(); f.retire(); gate.resolve();
  await pending; assert.equal(f.writes().length, 0); cases.push('prepared/retired-before-dispatch');
}
for (const version of ['body', 'processing']) {
  const f = fixture(); f.replace(40, version === 'body' ? 'new-body' : 'body', version === 'processing' ? 'new-processing' : 'processing');
  assert.equal(await f.owner.reconcilePreparedPageTurn(f.prepared, 1, 7), undefined,
    'same chapter/scalar from different content is not a prepared page receipt');
  assert.equal(f.owner.pageTurnStoredProgress, undefined); cases.push(`prepared/read-version/${version}`);
}
{
  const f = fixture({ cas: false, effect: 'late' });
  assert.equal(await f.owner.persistPreparedPageTurn(f.prepared, 1, 7), undefined,
    'legacy origin snapshot cannot release an unknown native command');
  assert.equal(f.writes().length, 1); await assert.rejects(f.gateway.awaitPresentedProgressPersistence(), /CAS_REQUIRED/);
  assert.equal(f.writes().length, 1, 'legacy unknown is only blocked/read, never blindly rewritten'); cases.push('legacy/no-CAS-origin-does-not-unlock');
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture({ sourceId, effect: 'lost' });
  await assert.rejects(f.owner.persistMeasuredCanonicalProgress('book', 'control selection', anchor(40), layout, () => true), /ACK lost/);
  let read = false;
  await f.gateway.runProgressCommitSerial(async () => { read = true; });
  assert.equal(read, true); assert.equal(f.writes().length, 1, 'strong selection is recovered by the same owner before a new transaction boundary');
  assert.equal(f.gateway.pendingPresentedProgress(), undefined); cases.push(`selection/unknown-before-new-boundary/${sourceId}`);
}
// Mutate only the actual routing/helper and actual version gates to execute
// the original bad behavior; these are negative controls, not test replicas.
const scratch = mkdtempSync(join(tmpdir(), 'reader-strong-progress-'));
try {
  const old = source.replace('return gateway.persistPresentedProgress(bookId, title, anchor, layout, isAdmitted);',
    'return gateway.resolveAndUpdateProgress(bookId, title, anchor, layout, isAdmitted);');
  assert.notEqual(old, source); const oldFile = join(scratch, 'unowned.ets'); writeFileSync(oldFile, old);
  const f = fixture({ input: oldFile, effect: 'late' });
  assert.equal(await f.owner.persistPreparedPageTurn(f.prepared, 1, 7), false,
    'negative original routing incorrectly declares origin confirmed while the old write remains live');
  assert.equal(f.writes()[0].p.expectedProgressRevision, undefined);
  await f.gateway.persistPresentedProgress('book', 'newer page', anchor(60), layout); f.late[0]();
  assert.equal(f.durable().chapterOffset, 40, 'negative actual unowned route reproduces late old anchor overwriting the newer page');
  const stale = source.replace(' &&\n      stored.bodyVersion === prepared.context.chapter.bodyVersion &&\n      stored.processingVersion === prepared.context.chapter.processingVersion', '');
  assert.notEqual(stale, source); const staleFile = join(scratch, 'stale.ets'); writeFileSync(staleFile, stale);
  const v = fixture({ input: staleFile }); v.replace(40, 'foreign', 'foreign');
  assert.equal(await v.owner.reconcilePreparedPageTurn(v.prepared, 1, 7), true, 'negative old version gate falsely accepts the foreign body');
} finally { rmSync(scratch, { recursive: true, force: true }); }
console.log(JSON.stringify({ passed: true, scenarios: cases.length, cases,
  boundary: 'Actual SDK-emitted LRE methods + whole production session/shared owner/local and remote gateways; controlled Core IO. Source-switch canonical Core contract/Native and target evidence remain separate.' }));

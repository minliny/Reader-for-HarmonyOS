import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReadingEntryPreparation } = await import('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const seed = bookId => ({ sourceId: 'local', bookId });
const ready = params => ({ data: { ...params, kind: 'ready', reason: 'prepared', chapterIndex: 3 + params.neighborOffset } });

// A delayed whole-shelf query cannot hold the currently visible book's durable
// preparation. This must also work with optional retained RAM disabled.
{
  const calls = [], scanned = deferred(), scan = deferred();
  const seeds = Array.from({ length: 9 }, (_, i) => seed(String(i)));
  const runtime = { supportsCoreCapability: c => c === 'reading.entry.prepare.v1',
    bookAcquisitions: () => ({ request: async (method, params, options, priority) => {
      assert.equal(method, 'reading.entry.prepare'); assert.equal(priority, 'background');
      assert.equal(options.canDispatch(), true); assert.equal(options.shouldCancel(), false);
      calls.push({ ...params }); return ready(params);
    } }) };
  const prep = new ReadingEntryPreparation(runtime, false);
  const pass = prep.preparePersistedShelf('r1', async () => {
    assert.deepEqual(calls.map(p => `${p.bookId}:${p.neighborOffset}`), ['6:0', '3:0']);
    scanned.resolve(); await scan.promise; return seeds;
  }, () => true);
  prep.setVisibleBooks([seed('outdated')]);
  prep.setVisibleBooks([seed('6'), seed('6'), seed('3')]);
  await scanned.promise;
  assert.equal(calls.length, 2, 'only the current viewport is prepared before the full query returns');
  scan.resolve(); await pass;
  assert.equal(calls.length, 63, 'priority work is not repeated in the current-target sweep');
  assert.deepEqual(calls.slice(0, 9).map(p => p.bookId), ['6', '3', '0', '1', '2', '4', '5', '7', '8']);
  assert.ok(calls.slice(0, 9).every(p => p.neighborOffset === 0), 'all current targets precede neighbours');
  await prep.preparePersistedShelf('r1', async () => { throw Error('completed revision scanned again'); }, () => true);
  prep.close();
}

// A foreground pause during the visible pass prevents both a subsequent full
// scan and further requests; a later explicit admission remains retryable.
{
  const calls = []; let scans = 0, pause = true, prep;
  const runtime = { supportsCoreCapability: c => c === 'reading.entry.prepare.v1',
    bookAcquisitions: () => ({ request: async (_method, params) => {
      calls.push(params); if (pause) { pause = false; prep.setPaused(true); } return ready(params);
    } }) };
  prep = new ReadingEntryPreparation(runtime, false);
  prep.setVisibleBooks([seed('a')]);
  const load = async () => { scans++; return [seed('a')]; };
  await prep.preparePersistedShelf('r', load, () => true);
  assert.equal(scans, 0); assert.equal(calls.length, 1);
  prep.setPaused(false); await prep.preparePersistedShelf('r', load, () => true);
  assert.equal(scans, 1); assert.equal(calls.length, 8);
  prep.close();
}

// One visible failure cannot be declared complete or starve other books.
{
  const calls = []; let missing = true;
  const runtime = { supportsCoreCapability: c => c === 'reading.entry.prepare.v1',
    bookAcquisitions: () => ({ request: async (_method, params) => {
      calls.push(params);
      return missing && params.bookId === 'a' && params.neighborOffset === 0 ?
        { data: { ...params, kind: 'missing', reason: 'contentMissing', chapterIndex: 3 } } : ready(params);
    } }) };
  const prep = new ReadingEntryPreparation(runtime, false);
  prep.setVisibleBooks([seed('a')]);
  const load = async () => [seed('a'), seed('b')];
  await prep.preparePersistedShelf('r', load, () => true);
  assert.equal(calls.length, 14); assert.equal(calls.filter(p => p.bookId === 'b').length, 7);
  missing = false; await prep.preparePersistedShelf('r', load, () => true);
  assert.equal(calls.length, 15, 'missing priority target retries without redoing prepared books');
  prep.close();
}
// A viewport change after the first priority target must cancel the old sweep,
// including its in-flight identity query. The same shelf revision is retained.
{
  const calls = [], scanning = deferred(), held = deferred(); let scans = 0;
  const seeds = Array.from({ length: 15 }, (_, i) => seed(String(i)));
  const runtime = { supportsCoreCapability: c => c === 'reading.entry.prepare.v1',
    bookAcquisitions: () => ({ request: async (_method, params) => { calls.push({ ...params }); return ready(params); } }) };
  const prep = new ReadingEntryPreparation(runtime, false);
  prep.setVisibleBooks([seed('0')]);
  const first = prep.preparePersistedShelf('same', async current => {
    scans++; scanning.resolve(); await held.promise;
    assert.equal(current(), false, 'new viewport invalidates only the old background scan');
    return undefined;
  }, () => true);
  await scanning.promise;
  const content = prep.captureContentValidity('local', '0');
  prep.setVisibleBooks([seed('14')]);
  assert.equal(content(), true, 'viewport priority cannot revoke active content or position');
  const next = prep.preparePersistedShelf('same', async () => { scans++; return seeds; }, () => true);
  held.resolve(); await Promise.all([first, next]);
  assert.deepEqual(calls.slice(0, 2).map(p => [p.bookId, p.neighborOffset]), [['0', 0], ['14', 0]]);
  assert.equal(scans, 2); assert.equal(calls.length, 105, 'completed old viewport target is reused');
  prep.close();
}
// Viewport updates during the idle delay are adopted by the same pass. A
// missing body must not trigger an automatic second sweep of that request.
{
  const calls = []; let scans = 0;
  const runtime = { supportsCoreCapability: c => c === 'reading.entry.prepare.v1',
    bookAcquisitions: () => ({ request: async (_method, params) => {
      calls.push(params);
      return params.neighborOffset === 0 ?
        { data: { ...params, kind: 'missing', reason: 'contentMissing', chapterIndex: 3 } } : ready(params);
    } }) };
  const prep = new ReadingEntryPreparation(runtime, false);
  const load = async () => { scans++; return [seed('a')]; };
  const pass = prep.preparePersistedShelf('r', load, () => true);
  await Promise.resolve(); // drain owns the request; its idle delay is pending
  prep.setVisibleBooks([seed('a')]);
  await pass;
  assert.equal(scans, 1); assert.equal(calls.length, 7, 'idle viewport adoption cannot retry a missing body');
  await prep.preparePersistedShelf('r', load, () => true);
  assert.equal(scans, 1, 'a later admission reuses the unchanged membership set');
  assert.equal(calls.length, 8, 'only the missing current target is retried');
  prep.close();
}
console.log('PASS visible durable preparation before whole-shelf scan, RAM-disabled priority, mid-scan viewport change, no duplicates, cancellation and missing-body retry');

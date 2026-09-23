import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, n) { try { return n(s, c); } catch (e) { if (s.startsWith('.') && !s.endsWith('.ts')) return n(`${s}.ts`, c); throw e; } } });
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const { BookRequestScheduler } = await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(test) { for (let i = 0; i < 200; i++) { if (test()) return; await tick(); } assert.fail('preparation did not settle'); }
const book = (bookId = 'b', sourceId = 's') => ({ sourceId, bookId, title: '书', author: '作者' });
const seed = (id = 'b') => ({ ...book(id), detailUrl: id });
const body = '清晨的阳光照进房间，书中的故事从这里开始。'.repeat(12);
const coreError = message => Object.assign(Error(message), { name: 'ReaderCoreRequestError', event: { type: 'error', requestId: 1 } });
function storage() { return { intents: new Map(), rows: new Map(), shelf: new Map(), raw: new Set(), derived: new Set(), catalogs: new Set(), progress: new Map() }; }
function fixture({ store = storage(), emptyLeading = true } = {}) {
  const calls = [], gates = new Map(), failBodies = new Set(), blockedPreparation = new Map(), duplicateOf = new Map(), failures = new Map();
  const key = (id, index) => `${id}:${index}`;
  const runtime = new BookAcquisitionCoordinator(async (method, params, options) => {
    calls.push({ method, params, options });
    const id = params.bookId ?? params.book?.bookId ?? params.bookUrl;
    const gate = gates.get(`${method}:${params.action}:${id}`) ?? gates.get(`${method}:${id}`); if (gate) await gate.promise;
    if (options.shouldCancel?.()) throw Error('Reader-Core request cancelled by caller: 1');
    const failure = failures.get(`${method}:${id}`); if (failure) throw failure;
    if (params.preparationRevision !== undefined) {
      const intent = store.intents.get(id);
      if (!intent || intent.state !== 'active' || intent.revision !== params.preparationRevision) throw coreError('READING_PREPARATION_STALE');
    }
    if (method === 'reading.preparation') {
      let intent = store.intents.get(id);
      if (params.action === 'list') return { data: { intents: [...store.intents.values()].slice(params.offset, params.offset + params.limit).map(i => ({ ...i })) } };
      if (params.action === 'begin') {
        if (params.reason === 'add' && (store.shelf.has(id) || store.shelf.has(duplicateOf.get(id)))) throw coreError('BOOK_ALREADY_ON_SHELF');
        intent = { schemaVersion: 1, sourceId: params.sourceId, bookId: id, sourceVersion: 'v1', revision: (intent?.revision ?? 0) + 1,
          reason: params.reason, state: 'active', updatedAt: 1, pendingAdd: params.pendingAdd };
        store.intents.set(id, intent);
      } else if (['pause', 'resume', 'cancel', 'block'].includes(params.action)) {
        if (!intent || intent.revision !== params.revision) throw coreError('READING_PREPARATION_STALE');
        intent = { ...intent, revision: intent.revision + 1, state: ({ pause: 'paused', resume: 'active', cancel: 'cancelled', block: 'blocked' })[params.action], blockReason: params.blockReason,
          pendingAdd: params.action === 'cancel' ? undefined : intent.pendingAdd };
        store.intents.set(id, intent);
      }
      return { data: { intents: intent ? [{ ...intent }] : [] } };
    }
    if (method === 'source.list') return { data: { sources: [{ sourceId: 's', enabled: true, sourceVersion: 'v1' }] } };
    if (method === 'search-book.get') return { data: { book: store.rows.get(id) ?? null } };
    if (method === 'bookshelf.get') return { data: { book: store.shelf.get(id) ?? null } };
    if (method === 'cache.book.status') return { data: { sourceId: 's', bookId: id, tocAvailable: false, chapters: [] } };
    if (method === 'book.detail') {
      store.rows.set(id, { origin: 's', bookUrl: id, name: '书', author: '作者', variable: '{}', acquisition: { sourceVersion: 'v1', detailAt: Date.now() } });
      return { data: { sourceId: 's', book: { bookId: id, title: '书', author: '作者' }, sourceVersion: 'v1', tocUrl: `${id}/toc`, variables: {} } };
    }
    if (method === 'book.toc') {
      store.rows.get(id).acquisition.catalogAt = Date.now(); store.catalogs.add(id);
      return { data: { sourceId: 's', bookId: id, sourceVersion: 'v1', catalogAt: Date.now(), catalogVersion: 'catalog', contextVersion: 'context', catalogInstalled: true,
        continuationVariables: {}, toc: Array.from({ length: 10 }, (_, index) => ({ index, title: `章${index}`, url: `${id}/${index}`, variables: {} })) } };
    }
    if (method === 'chapter.content') {
      if (failBodies.has(id)) throw coreError('HTTP status 403');
      const content = emptyLeading && params.chapterIndex === 0 ? '' : body;
      if (content) store.raw.add(key(id, params.chapterIndex));
      return { data: { sourceId: 's', bookId: id, chapterTitle: `章${params.chapterIndex}`, via: 'rule', bodyVersion: 'body', processingVersion: 'processing', content } };
    }
    if (method === 'reading.entry.prepare') {
      const base = { sourceId: 's', bookId: id, neighborOffset: params.neighborOffset };
      if (!store.catalogs.has(id)) return { data: { ...base, chapterIndex: null, kind: 'missing', reason: 'catalogMissing' } };
      const index = (params.chapterIndex ?? store.progress.get(id)?.chapterIndex ?? store.intents.get(id)?.entryChapterIndex ?? 4) + params.neighborOffset;
      if (index < 0 || index >= 10) return { data: { ...base, chapterIndex: null, kind: 'missing', reason: 'neighborAbsent' } };
      if (blockedPreparation.has(id)) return { data: { ...base, chapterIndex: index, ...blockedPreparation.get(id) } };
      if (!store.raw.has(key(id, index))) return { data: { ...base, chapterIndex: index, kind: 'missing', reason: 'contentMissing' } };
      const reason = store.derived.has(key(id, index)) ? 'alreadyPrepared' : 'prepared';
      store.derived.add(key(id, index)); return { data: { ...base, chapterIndex: index, kind: 'ready', reason } };
    }
    if (method === 'cache.book.prefetch') {
      assert.ok(params.preparationRevision > 0);
      if (failBodies.has(id)) throw coreError('HTTP status 403');
      const [start, end] = params.chapterRange; assert.equal(end, start + 1);
      store.raw.add(key(id, start)); return { data: { sourceId: 's', bookId: id, chapterRange: params.chapterRange, prefetchedCount: 1 } };
    }
    if (method === 'bookshelf.add') {
      if (params.sourceId !== 'local') {
        assert.equal(params.requireReadable, true);
        const entry = [0, 1, 2].find(index => store.raw.has(key(id, index)) && store.derived.has(key(id, index)));
        if (entry === undefined) throw coreError('READING_PREPARATION_ADD_NOT_READY');
        const intent = store.intents.get(id); store.intents.set(id, { ...intent, revision: intent.revision + 1, reason: 'read', pendingAdd: undefined, entryChapterIndex: entry });
      }
      const created = !store.shelf.has(id); store.shelf.set(id, book(id, params.sourceId));
      return { data: { sourceId: params.sourceId, bookId: id, created, addedAt: 1 } };
    }
    if (method === 'search-book.put') { const row = store.rows.get(id); row.acquisition = { ...row.acquisition, ...params.acquisition }; return { data: { book: row } }; }
    if (['cache.clear', 'bookshelf.remove', 'bookshelf.removeBatch', 'source.update', 'replace-rule.update', 'source.switch.commit'].includes(method)) {
      if (method === 'cache.clear' && params.sourceId && params.bookId && !store.intents.has(params.bookId)) {
        store.intents.set(params.bookId, { schemaVersion: 1, sourceId: params.sourceId, bookId: params.bookId,
          sourceVersion: '', revision: 1, reason: 'suppressed', state: 'cancelled', updatedAt: 1 });
        return { data: {} };
      }
      for (const [bookId, intent] of store.intents) store.intents.set(bookId, { ...intent, state: 'cancelled', revision: intent.revision + 1 });
      return { data: {} };
    }
    throw Error(`unexpected request ${method}`);
  }, capability => ['reading.preparation.v1'].includes(capability));
  return { runtime, store, calls, gates, failBodies, blockedPreparation, duplicateOf, failures };
}
async function intent(f, id, state = 'active') {
  await f.runtime.request('reading.preparation', { action: 'begin', ...book(id), reason: 'read' });
  f.store.intents.get(id).state = state; f.store.shelf.set(id, book(id)); f.store.catalogs.add(id);
}

// The confirmed receipt follows the actual selected-source readable body and
// durable projection. No reader/progress command is permitted in admission.
{
  const f = fixture(), gate = deferred(); f.gates.set('chapter.content:b', gate);
  let settled = false; const adding = f.runtime.addReadableBook(book()).then(result => { settled = true; return result; });
  await until(() => f.calls.some(c => c.method === 'chapter.content'));
  assert.equal(settled, false); assert.equal(f.store.shelf.has('b'), false);
  assert.ok(f.store.intents.get('b').pendingAdd, 'pending intent is durable before body work');
  gate.resolve(); const receipt = await adding;
  assert.equal(receipt.data.created, true);
  assert.deepEqual(f.calls.filter(c => c.method === 'chapter.content').map(c => c.params.chapterIndex), [0, 1]);
  assert.equal(f.store.intents.get('b').entryChapterIndex, 1);
  assert.equal(f.store.intents.get('b').pendingAdd, undefined);
  assert.ok(f.calls.find(c => c.method === 'reading.entry.prepare' && c.params.chapterIndex === 1));
  for (const call of f.calls.filter(c => ['book.detail', 'book.toc', 'chapter.content'].includes(c.method))) assert.equal(call.params.preparationRevision, 1);
  assert.ok(!f.calls.some(c => c.params.forceRefresh === true || c.method.startsWith('reading.progress')));
  f.runtime.close();
}
{
  const f = fixture(), changes = []; f.runtime.subscribe(change => changes.push(change));
  await f.runtime.addReadableBook(book()); await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(changes.filter(change => change.shelfChanged === true).length, 1);
  assert.ok(changes.find(change => change.shelfChanged).identities.some(id => id.bookId === 'b'));
  changes.length = 0; await f.runtime.request('book.detail', { sourceId: 's', book: book('metadata') });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.ok(changes.length > 0); assert.ok(changes.every(change => change.shelfChanged !== true), 'shelf notification resets after delivery');
  f.runtime.close();
}
for (const target of ['existing', 'other-source-copy']) {
  const f = fixture(); await intent(f, 'existing'); f.store.progress.set('existing', { chapterIndex: 8, chapterOffset: 50 });
  f.duplicateOf.set('other-source-copy', 'existing');
  const original = { ...f.store.intents.get('existing') }, progress = { ...f.store.progress.get('existing') };
  await assert.rejects(f.runtime.addReadableBook(book(target)), /BOOK_ALREADY_ON_SHELF/);
  assert.equal(f.store.shelf.size, 1); assert.deepEqual(f.store.intents.get('existing'), original);
  assert.deepEqual(f.store.progress.get('existing'), progress); assert.equal(f.store.intents.has('other-source-copy'), false);
  assert.ok(!f.calls.some(c => c.params.action === 'block' || c.method === 'bookshelf.add'));
  f.runtime.close();
}
{
  const f = fixture();
  const selected = await f.runtime.acquireCandidateGroup([{ seed: seed(), catalogReady: false, failed: false }], { requireReadable: true });
  assert.equal(selected.session.preparedChapter.chapter.chapterIndex, 1);
  const count = f.calls.filter(c => c.method === 'chapter.content').length;
  await f.runtime.addReadableBook(book());
  assert.equal(f.calls.filter(c => c.method === 'chapter.content').length, count, 'add reuses validated search body'); f.runtime.close();
}
{
  const f = fixture(); f.failBodies.add('b');
  await assert.rejects(f.runtime.addReadableBook(book()), /403/);
  assert.equal(f.store.shelf.has('b'), false); assert.equal(f.store.intents.get('b').state, 'blocked');
  assert.ok(f.store.intents.get('b').pendingAdd); const count = f.calls.length;
  await f.runtime.resumeReadingPreparations(() => true);
  assert.equal(f.calls.length, count + 1, 'blocked add is not retried by idle sweep'); f.runtime.close();
}
// Process closure leaves the business intent intact; a new coordinator resumes
// it using Core's token, without any six-book queue or deadline.
{
  const f = fixture(), gate = deferred(); f.gates.set('book.detail:b', gate);
  const stopped = assert.rejects(f.runtime.addReadableBook(book()), /取消/);
  await until(() => f.calls.some(c => c.method === 'book.detail')); f.runtime.close(); gate.resolve(); await stopped;
  assert.equal(f.store.intents.get('b').state, 'active');
  const reopened = fixture({ store: f.store }); await reopened.runtime.resumeReadingPreparations(() => true);
  assert.equal(reopened.store.shelf.has('b'), true, JSON.stringify({intents:[...reopened.store.intents.values()],calls:reopened.calls.map(c=>({method:c.method,params:c.params}))})); assert.equal(reopened.store.intents.get('b').reason, 'read');
  assert.equal(reopened.store.progress.size, 0); reopened.runtime.close();
}
// More than six interrupted additions remain durable and all resume. A
// paused background admission cannot delay an explicitly requested add.
{
  const f = fixture();
  for (let i = 0; i < 12; i++) await f.runtime.request('reading.preparation', {
    action: 'begin', sourceId: 's', bookId: `new${i}`, reason: 'add', pendingAdd: book(`new${i}`) });
  await f.runtime.resumeReadingPreparations(() => false);
  const foreground = await f.runtime.addReadableBook(book('explicit'));
  assert.equal(foreground.data.created, true);
  await f.runtime.resumeReadingPreparations(() => true);
  assert.equal(f.store.shelf.size, 13);
  assert.ok([...f.store.intents.values()].every(i => i.reason === 'read' && i.pendingAdd === undefined)); f.runtime.close();
}
// Fairness: all fifty current bodies precede any adjacent chapter; already raw
// bodies use local preparation only and every captured original survives.
{
  const f = fixture(), before = new Map();
  for (let i = 0; i < 50; i++) {
    const id = `b${i}`; await intent(f, id); f.store.progress.set(id, { chapterIndex: 4, chapterOffset: 123 }); before.set(id, { ...f.store.progress.get(id) });
    if (i % 2 === 0) f.store.raw.add(`${id}:4`);
  }
  f.calls.length = 0; await f.runtime.resumeReadingPreparations(() => true);
  const prepares = f.calls.filter(c => c.method === 'reading.entry.prepare');
  const firstNeighbour = prepares.findIndex(c => c.params.neighborOffset !== 0);
  assert.equal(new Set(prepares.slice(0, firstNeighbour).map(c => c.params.bookId)).size, 50);
  const fetched = f.calls.filter(c => c.method === 'cache.book.prefetch');
  for (let i = 0; i < 50; i += 2) assert.ok(!fetched.some(c => c.params.bookId === `b${i}` && c.params.chapterRange[0] === 4));
  for (const call of fetched) assert.equal(call.params.preparationRevision, 1);
  assert.equal(f.store.derived.size, 350); assert.deepEqual(f.store.progress, before);
  assert.ok(!f.calls.some(c => ['book.detail', 'book.toc', 'cache.book.status', 'reading.progress.update'].includes(c.method)));
  f.runtime.close();
}
// Paused/cancelled/blocked and no-intent shelf data cannot authorize a fetch.
{
  const f = fixture(); for (const state of ['paused', 'cancelled', 'blocked', 'completed']) await intent(f, state, state);
  f.store.shelf.set('legacy', book('legacy')); f.calls.length = 0;
  await f.runtime.resumeReadingPreparations(() => true); assert.deepEqual(f.calls.map(c => c.method), ['reading.preparation']); f.runtime.close();
}
// Clearing a legacy book creates a Core tombstone despite no earlier intent.
// Mixed pages still prepare other books, and neither list nor cancel can
// interpret a tombstone (even a malformed active one) as network permission.
for (const tombstoneState of ['cancelled', 'active']) {
  const f = fixture(); f.store.shelf.set('legacy', book('legacy'));
  await f.runtime.request('cache.clear', { sourceId: 's', bookId: 'legacy' });
  const tombstone = f.store.intents.get('legacy');
  assert.equal(tombstone.reason, 'suppressed'); tombstone.state = tombstoneState;
  await intent(f, 'good'); f.calls.length = 0;
  await f.runtime.resumeReadingPreparations(() => true);
  assert.ok(f.store.raw.has('good:4'));
  assert.ok(!f.calls.some(c => c.params.bookId === 'legacy'));
  const before = { ...tombstone }; f.calls.length = 0;
  await f.runtime.cancelReadableBook('s', 'legacy');
  assert.deepEqual(f.store.intents.get('legacy'), before);
  assert.deepEqual(f.calls.map(c => [c.method, c.params.action]), [['reading.preparation', 'status']]);
  assert.equal(f.store.shelf.has('legacy'), true); f.runtime.close();
}
// One rejection does not starve any other current chapter or cause a busy retry.
{
  const f = fixture(); await intent(f, 'bad'); await intent(f, 'good'); f.failBodies.add('bad');
  await f.runtime.resumeReadingPreparations(() => true); assert.equal(f.store.intents.get('bad').state, 'blocked');
  assert.ok(f.store.raw.has('good:4')); const badCount = f.calls.filter(c => c.method === 'cache.book.prefetch' && c.params.bookId === 'bad').length;
  await f.runtime.resumeReadingPreparations(() => true);
  assert.equal(f.calls.filter(c => c.method === 'cache.book.prefetch' && c.params.bookId === 'bad').length, badCount); f.runtime.close();
}
for (const [kind, reason, blocked] of [['blocked', 'publicationCapacity', true], ['blocked', 'bodyResourceLimit', true],
  ['deferred', 'contentChanged', false], ['deferred', 'catalogChanged', false], ['deferred', 'sourceSwitchPending', false]]) {
  const f = fixture(); await intent(f, 'b'); f.blockedPreparation.set('b', { kind, reason });
  await f.runtime.resumeReadingPreparations(() => true); assert.equal(f.store.intents.get('b').state, blocked ? 'blocked' : 'active');
  assert.equal(f.calls.filter(c => c.method === 'reading.entry.prepare').length, 1); f.runtime.close();
}
// Metadata/body failures use the existing Core retryability decision. They
// end this pass without revoking permission, then an external event resumes.
for (const method of ['book.detail', 'book.toc', 'chapter.content']) {
  const f = fixture(); const transient = coreError('temporary upstream failure');
  transient.event.error = { code: 'HOST_ERROR', message: transient.message, retryable: true,
    details: { category: 'SOURCE_HTTP_FAILED', phase: 'response', httpStatus: 503 } };
  f.failures.set(`${method}:b`, transient);
  let raised;
  await assert.rejects(f.runtime.addReadableBook(book()), error => { raised = error; return /temporary/.test(error.message); });
  assert.equal(f.store.intents.get('b').state, 'active', `${method}: ${JSON.stringify(raised)}`);
  if (method !== 'chapter.content') {
    assert.equal(raised.previousCategory, 'CACHE_MISSING', 'historical cache diagnostics remain explicit');
    assert.equal(f.runtime.recentFailures().at(-1).previousCategory, 'CACHE_MISSING');
  }
  assert.equal(f.store.shelf.has('b'), false);
  assert.ok(!f.calls.some(c => c.params.action === 'block'));
  const attempts = f.calls.filter(c => c.method === method).length;
  await tick(); assert.equal(f.calls.filter(c => c.method === method).length, attempts, 'no automatic retry loop');
  f.failures.delete(`${method}:b`);
  await f.runtime.resumeReadingPreparations(() => true);
  assert.equal(f.store.shelf.has('b'), true); f.runtime.close();
}
for (const variant of ['core', 'sdkTimeout', 'networkEnvironment']) {
  const f = fixture(); await intent(f, 'b'); await intent(f, 'good');
  const failure = variant === 'sdkTimeout' ? Error('Reader-Core request timed out: 23') : coreError('temporary route failure');
  if (variant !== 'sdkTimeout') failure.event.error = { code: 'HOST_ERROR', retryable: true,
    details: { category: variant === 'networkEnvironment' ? 'NETWORK_ENVIRONMENT' : 'SOURCE_HTTP_FAILED' } };
  f.failures.set('cache.book.prefetch:b', failure);
  await f.runtime.resumeReadingPreparations(() => true);
  assert.equal(f.store.intents.get('b').state, 'active'); assert.ok(f.store.raw.has('good:4'));
  assert.equal(f.calls.filter(c => c.method === 'cache.book.prefetch' && c.params.bookId === 'b').length, 1);
  assert.ok(!f.calls.some(c => c.params.action === 'block'));
  f.failures.delete('cache.book.prefetch:b'); await f.runtime.resumeReadingPreparations(() => true);
  assert.ok(f.store.raw.has('b:4')); f.runtime.close();
}
// Core owns bounded chapter retries. If Core exhausts them and blocks the
// queue before returning a retryable error, Host must not reactivate it.
{
  const f = fixture(), gate = deferred(); await intent(f, 'b');
  const failure = coreError('attempts exhausted'); failure.event.error = { code: 'HOST_ERROR', retryable: true };
  f.failures.set('cache.book.prefetch:b', failure); f.gates.set('cache.book.prefetch:b', gate);
  const run = f.runtime.resumeReadingPreparations(() => true);
  await until(() => f.calls.some(c => c.method === 'cache.book.prefetch'));
  f.store.intents.set('b', { ...f.store.intents.get('b'), state: 'blocked', revision: 2 });
  gate.resolve(); await run;
  assert.equal(f.store.intents.get('b').state, 'blocked'); assert.equal(f.store.intents.get('b').revision, 2);
  const attempts = f.calls.filter(c => c.method === 'cache.book.prefetch').length;
  await f.runtime.resumeReadingPreparations(() => true);
  assert.equal(f.calls.filter(c => c.method === 'cache.book.prefetch').length, attempts); f.runtime.close();
}
// Read-mode catalog repair can be deferred until shelf foreground allows it.
{
  const f = fixture(); await intent(f, 'b'); f.store.catalogs.delete('b');
  await f.runtime.resumeReadingPreparations(() => true, () => false);
  assert.ok(!f.calls.some(c => c.method === 'book.detail')); assert.equal(f.store.intents.get('b').state, 'active');
  await f.runtime.resumeReadingPreparations(() => true, () => true);
  assert.ok(f.store.raw.has('b:4')); assert.equal(f.calls.filter(c => c.method === 'book.detail').length, 1); f.runtime.close();
}
// Visibility cancellation is reversible; no body is published or intent
// blocked, and the same revision can continue on the next foreground event.
{
  const f = fixture(), gate = deferred(); await intent(f, 'b'); f.gates.set('cache.book.prefetch:b', gate); let allowed = true;
  const run = f.runtime.resumeReadingPreparations(() => allowed);
  await until(() => f.calls.some(c => c.method === 'cache.book.prefetch')); allowed = false; gate.resolve(); await run;
  assert.equal(f.store.raw.size, 0); assert.equal(f.store.intents.get('b').state, 'active');
  f.gates.delete('cache.book.prefetch:b'); allowed = true; await f.runtime.resumeReadingPreparations(() => allowed);
  assert.ok(f.store.raw.has('b:4')); f.runtime.close();
}
// Core CAS protects late completion even when cancellation happens through a
// separate caller and the Host's visibility callback stays true.
{
  const f = fixture(), gate = deferred(); await intent(f, 'b'); f.gates.set('cache.book.prefetch:b', gate);
  const run = f.runtime.resumeReadingPreparations(() => true);
  await until(() => f.calls.some(c => c.method === 'cache.book.prefetch'));
  await f.runtime.request('reading.preparation', { action: 'cancel', sourceId: 's', bookId: 'b', revision: 1 });
  gate.resolve(); await run;
  assert.equal(f.store.raw.size, 0); assert.equal(f.store.intents.get('b').state, 'cancelled'); assert.equal(f.store.intents.get('b').revision, 2);
  f.runtime.close();
}
// A progress/foreground event admitted during an existing run coalesces into
// one later pass; it cannot silently lose the new current chapter request.
{
  const f = fixture(), gate = deferred(); await intent(f, 'b'); f.gates.set('cache.book.prefetch:b', gate);
  const first = f.runtime.resumeReadingPreparations(() => true);
  await until(() => f.calls.some(c => c.method === 'cache.book.prefetch'));
  f.store.progress.set('b', { chapterIndex: 9, chapterOffset: 10 });
  const next = f.runtime.resumeReadingPreparations(() => true); gate.resolve(); await Promise.all([first, next]);
  assert.ok(f.store.raw.has('b:9')); assert.equal(f.calls.filter(c => c.method === 'reading.preparation' && c.params.action === 'list').length, 2);
  f.runtime.close();
}
// Destructive mutations wait for the actual cancelled RPC terminal receipt,
// including foreground add acquisition. A logical cancellation race is not it.
for (const method of ['cache.clear', 'bookshelf.remove', 'bookshelf.removeBatch', 'source.update', 'replace-rule.update', 'source.switch.commit']) {
  const f = fixture(), gate = deferred(); f.gates.set('book.detail:b', gate);
  const adding = assert.rejects(f.runtime.addReadableBook(book()), /取消/);
  await until(() => f.calls.some(c => c.method === 'book.detail'));
  const mutation = f.runtime.request(method, { sourceId: 's', bookId: 'b', scope: 'book', targets: [book()] });
  await tick(); assert.equal(f.calls.filter(c => c.method === method).length, 0);
  assert.equal(f.calls.find(c => c.method === 'book.detail').options.shouldCancel(), true);
  gate.resolve(); await mutation; await adding;
  assert.equal(f.calls.filter(c => c.method === 'book.toc' || c.method === 'chapter.content' || c.method === 'bookshelf.add').length, 0); f.runtime.close();
}
{
  const f = fixture(), gate = deferred(); f.gates.set('book.detail:b', gate);
  const adding = f.runtime.addReadableBook(book()).catch(() => {}); await until(() => f.calls.some(c => c.method === 'book.detail'));
  const clearing = assert.rejects(f.runtime.request('cache.clear', { scope: 'book', sourceId: 's', bookId: 'b' }), /尚未确认终止/);
  gate.reject(Error('native cancel transport unavailable')); await clearing; await adding;
  assert.equal(f.calls.filter(c => c.method === 'cache.clear').length, 0); f.runtime.close();
}
// Keep the scheduler's existing terminal-proof and shared-consumer contracts.
{
  let current = true, dispatched = 0; const scheduler = new BookRequestScheduler(async () => { dispatched++; return { data: {} }; });
  const pending = scheduler.request('chapter.content', { sourceId: 's', bookId: 'b' }, { canContinue: () => current, canDispatch: () => false }, 'v1', 'background');
  current = false; const completion = scheduler.settleCancelledRequests([pending]); scheduler.visibilityChanged(); await completion; assert.equal(dispatched, 0); scheduler.close();
}
{
  let companion = true; const native = deferred(), scheduler = new BookRequestScheduler(() => native.promise);
  const pending = scheduler.request('chapter.content', { sourceId: 's', bookId: 'b' }, { canContinue: () => companion }, 'v1', 'background');
  const foreground = scheduler.request('chapter.content', { sourceId: 's', bookId: 'b' }, {}, 'v1', 'foreground');
  companion = false; await scheduler.settleCancelledRequests([pending]); native.resolve({ data: {} }); await foreground; scheduler.close();
}
console.log('PASS durable reading preparation: strict first-readable add, search-body reuse, restart resume, 50-book fairness/current±3, raw-only rebuild, pause/403/resource boundaries, unchanged progress and real RPC cleanup fence');

// Cancellation before the add's first microtask never publishes an intent.
{
  const f = fixture(); const adding = assert.rejects(f.runtime.addReadableBook(book()), /取消/);
  await f.runtime.cancelReadableBook('s', 'b'); await adding;
  assert.equal(f.store.intents.size, 0);
  assert.ok(!f.calls.some(c => c.params.action === 'begin' || c.method === 'book.detail')); f.runtime.close();
}
// A begin already dispatched must reach its terminal fact before cancellation
// is reported. It cannot create a late pendingAdd after a status miss.
{
  const f = fixture(), gate = deferred(); f.gates.set('reading.preparation:begin:b', gate);
  const adding = assert.rejects(f.runtime.addReadableBook(book()), /取消/);
  await until(() => f.calls.some(c => c.params.action === 'begin'));
  let cancelled = false; const cancelling = f.runtime.cancelReadableBook('s', 'b').then(() => { cancelled = true; });
  await tick(); assert.equal(cancelled, false); assert.ok(!f.calls.some(c => c.params.action === 'status'));
  gate.resolve(); await cancelling; await adding;
  assert.equal(f.store.intents.get('b').state, 'cancelled'); assert.equal(f.store.intents.get('b').pendingAdd, undefined);
  assert.ok(!f.calls.some(c => c.method === 'book.detail')); f.runtime.close();
}
// Cancellation returns while body HTTP is still held, does not affect another
// book, and an old finally cannot delete a newer attempt's process owner.
{
  const f = fixture(), oldBody = deferred(); f.gates.set('chapter.content:b', oldBody);
  let oldSettled = false;
  const oldAdd = assert.rejects(f.runtime.addReadableBook(book()), /取消|STALE/).then(() => { oldSettled = true; });
  await until(() => f.calls.some(c => c.method === 'chapter.content'));
  await f.runtime.cancelReadableBook('s', 'b'); assert.equal(oldSettled, false);
  assert.equal(f.store.intents.get('b').state, 'cancelled');
  const other = await f.runtime.addReadableBook(book('other')); assert.equal(other.data.created, true);
  const nextBody = deferred(); f.gates.set('chapter.content:b', nextBody);
  const nextAdd = f.runtime.addReadableBook(book());
  await until(() => f.calls.filter(c => c.method === 'chapter.content' && c.params.bookId === 'b').length === 2);
  const newOwner = f.runtime.addingBooks.get(JSON.stringify(['s', 'b']));
  oldBody.resolve(); await oldAdd;
  assert.equal(f.runtime.addingBooks.get(JSON.stringify(['s', 'b'])), newOwner);
  assert.equal(newOwner.active, true); nextBody.resolve(); await nextAdd;
  assert.equal(f.store.shelf.has('b'), true); assert.equal(f.store.shelf.has('other'), true); f.runtime.close();
}
// Resumed pending add has no foreground Promise owner; its in-process guard
// must still stop immediately and Core's cancelled token rejects late bytes.
{
  const f = fixture(), gate = deferred();
  await f.runtime.request('reading.preparation', { action: 'begin', sourceId: 's', bookId: 'b', reason: 'add', pendingAdd: book() });
  f.gates.set('book.detail:b', gate); const run = f.runtime.resumeReadingPreparations(() => true);
  await until(() => f.calls.some(c => c.method === 'book.detail'));
  await f.runtime.cancelReadableBook('s', 'b');
  assert.equal(f.calls.find(c => c.method === 'book.detail').options.shouldCancel(), true);
  gate.resolve(); await run; assert.equal(f.store.shelf.has('b'), false); assert.equal(f.store.intents.get('b').state, 'cancelled'); f.runtime.close();
}
// Strict add may win between the status read and cancel CAS. Its read intent
// and shelf/progress stay intact; cancellation only retires the old add intent.
{
  const f = fixture(), gate = deferred();
  await f.runtime.request('reading.preparation', { action: 'begin', sourceId: 's', bookId: 'b', reason: 'add', pendingAdd: book() });
  f.gates.set('reading.preparation:cancel:b', gate);
  const cancelling = f.runtime.cancelReadableBook('s', 'b');
  await until(() => f.calls.some(c => c.params.action === 'cancel'));
  f.store.shelf.set('b', book()); f.store.progress.set('b', { chapterIndex: 5, chapterOffset: 8 });
  f.store.intents.set('b', { ...f.store.intents.get('b'), revision: 2, reason: 'read', pendingAdd: undefined });
  gate.resolve(); await cancelling;
  assert.equal(f.store.intents.get('b').state, 'active'); assert.equal(f.store.intents.get('b').reason, 'read');
  assert.deepEqual(f.store.progress.get('b'), { chapterIndex: 5, chapterOffset: 8 }); assert.equal(f.store.shelf.size, 1);
  assert.equal(f.calls.filter(c => c.params.action === 'cancel').length, 1); f.runtime.close();
}
console.log('PASS cancel readable add: pre-dispatch/in-flight begin fences, prompt HTTP cancellation, per-book isolation, resumed task guard, newer attempt ownership and strict-add CAS race');

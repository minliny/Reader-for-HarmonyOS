import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReadingEntryPreparation } = await import('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function until(predicate) {
  for (let n = 0; n < 100; n += 1) { if (predicate()) return; await tick(); }
  assert.fail('preparation fixture did not settle');
}
const identity = (sourceId, bookId) => JSON.stringify([sourceId, bookId]);
const seed = (bookId, sourceId = 'local') => ({ sourceId, bookId, ...(sourceId === 'local' ? {} : {
  remoteBookSeed: { sourceId, bookId, detailUrl: bookId, title: '书籍', author: '作者' },
}) });
const chapterText = '清晨的阳光洒落在书房里，读者继续阅读这个故事，人物走过一条安静的街道。'.repeat(12);
const preparedResult = (params, kind = 'ready', reason = 'prepared') => ({ data: {
  sourceId: params.sourceId, bookId: params.bookId, kind, reason,
  chapterIndex: ['catalogMissing', 'neighborAbsent', 'sourceSwitchPending', 'catalogUnavailableOrOversize', 'catalogChanged', 'preparationInterrupted', 'localStyleChanged', 'catalogInvalid', 'catalogResourceLimit'].includes(reason) ?
    null : 3 + params.neighborOffset,
} });

function fixture() {
  const calls = [];
  const progress = new Map();
  const gates = new Map();
  const failures = new Set();
  const unavailable = new Set();
  const bodies = new Map();
  const tocs = new Map();
  let pending = [];
  let acquireHook = async () => {};
  const session = (remoteSeed) => ({ identity: { sourceId: remoteSeed.sourceId, bookId: remoteSeed.bookId },
    sourceVersion: 'source-v1', acquisitionMode: 'online', detailUrl: remoteSeed.detailUrl, tocUrl: '/toc',
    book: { title: remoteSeed.title, author: remoteSeed.author }, continuationVariables: [], hostRequirements: ['httpExecute'],
    catalogVersion: 'catalog-v1', contextVersion: 'context-v1',
    entries: [0, 1, 2].map(index => ({ index, title: `第 ${index} 章`, url: `/chapter/${index}`, variables: [] })),
  });
  const request = async (method, params = {}, options = {}, priority) => {
    const sourceId = params.sourceId ?? 'local';
    const key = identity(sourceId, params.bookId);
    calls.push({ method, params, options, priority });
    const gate = gates.get(`${method}:${key}`); if (gate) await gate.promise;
    if (options.shouldCancel?.()) throw new Error('cancelled');
    if (failures.has(key)) throw new Error('optional preparation failed');
    if (method === 'source.switch.pending.list') return { data: { pending } };
    if (method === 'local_book.toc') return { data: { sourceId, bookId: params.bookId,
      toc: tocs.get(key) ?? [0, 1, 2].map(index => ({ index, title: `第 ${index} 章`, url: `/chapter/${index}` })) } };
    if (method === 'reading.progress.get') return { data: { found: progress.has(key), progress: progress.get(key) ?? null } };
    if (method === 'local_book.chapter.content') return { data: { sourceId, bookId: params.bookId,
      chapterIndex: params.chapterIndex, chapterTitle: `第 ${params.chapterIndex} 章`, content: bodies.get(key) ?? chapterText } };
    if (method === 'cache.book.status') return { data: { sourceId, bookId: params.bookId,
      catalogVersion: 'catalog-v1', contextVersion: 'context-v1', chapters: [0, 1, 2].map(chapterIndex => ({
        chapterIndex, title: `第 ${chapterIndex} 章`, url: `/chapter/${chapterIndex}`,
        state: unavailable.has(key) ? 'missing' : 'cached', cachedBytes: unavailable.has(key) ? 0 : chapterText.length,
      })) } };
    if (method === 'chapter.content' && unavailable.has(key)) {
      assert.equal(params.chapterUrl, undefined, 'a vanished cache must have no network fallback URL');
      throw new Error('chapterResponse is required unless chapterRequest, chapterUrl, or jsRule is provided');
    }
    if (method === 'chapter.content') return { data: { sourceId, bookId: params.bookId,
      chapterTitle: `第 ${params.chapterIndex} 章`, content: bodies.get(key) ?? chapterText, via: 'cache',
      bodyVersion: 'body-v1', processingVersion: 'processing-v1' } };
    throw new Error(`unexpected command: ${method}`);
  };
  const coordinator = {
    request,
    async acquireBook(remoteSeed, options, priority) {
      calls.push({ method: 'acquireBook', params: remoteSeed, options, priority });
      await acquireHook(remoteSeed, options);
      return session(remoteSeed);
    },
  };
  const runtime = { request, bookAcquisitions: () => coordinator };
  const preparations = new ReadingEntryPreparation(runtime);
  const ready = async (sourceId, bookId) => {
    let snapshot;
    await until(() => { snapshot = preparations.take(sourceId, bookId); return snapshot !== undefined; });
    return snapshot;
  };
  const settled = () => until(() => !preparations.active);
  return { preparations, calls, progress, gates, failures, unavailable, bodies, tocs, runtime, ready, settled,
    setPending: value => { pending = value; }, setAcquireHook: value => { acquireHook = value; } };
}

// A read-only wrapper keeps capability/catalog proofs without exposing
// acquisition or mutation authority. No full-book cache status is needed.
{
  const f=fixture();
  f.runtime.supportsCoreCapability=name=>name==='chapter.content.cacheOnly.v1';
  f.runtime.bookAcquisitions().hasCurrentCatalogProjection=()=>true;
  f.preparations.setVisibleBooks([seed('/atomic','s1')]);
  const snapshot=await f.ready('s1','/atomic');
  assert.equal(snapshot.chapter.chapterIndex,0);
  assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,0);
  assert.equal(f.calls.find(c=>c.method==='chapter.content').params.cacheOnly,true);
  f.preparations.close();
}

// A never-read local book is prepared without any progress write. A miss is synchronous.
{
  const f = fixture();
  assert.equal(f.preparations.take('local', 'new'), undefined);
  f.preparations.setVisibleBooks([seed('new')]);
  const snapshot = await f.ready('local', 'new');
  assert.equal(snapshot.progress.kind, 'missing');
  assert.equal(snapshot.chapter.chapterIndex, 0);
  assert.equal(snapshot.chapter.content, chapterText);
  assert.equal(snapshot.toc.entries.length, 3);
  assert.equal(f.preparations.take('local', 'new'), undefined, 'take consumes the complete snapshot');
  assert.deepEqual(f.calls.map(call => call.method), ['local_book.toc', 'reading.progress.get', 'local_book.chapter.content']);
  f.preparations.setPaused(true);
  f.preparations.setVisibleBooks([]);
  assert.equal(snapshot.isCurrent(), true, 'route pause/window detachment cannot invalidate a consumed snapshot');
  f.preparations.close();
  assert.equal(snapshot.isCurrent(), false);
}

// Exact restored chapter/offset/version context survives background materialization.
{
  const f = fixture();
  f.progress.set(identity('s1', '/same'), { sourceId: 's1', bookId: '/same', chapterIndex: 2,
    chapterOffset: 143, chapterProgress: 0.7, updatedAt: 10, locationRevision: 'loc-v1',
    bodyVersion: 'body-v1', processingVersion: 'processing-v1' });
  f.preparations.setVisibleBooks([seed('/same', 's1'), seed('/same', 's2')]);
  const restored = await f.ready('s1', '/same');
  const unread = await f.ready('s2', '/same');
  assert.equal(restored.chapter.chapterIndex, 2);
  assert.equal(restored.progress.progress.chapterOffset, 143);
  assert.equal(unread.chapter.chapterIndex, 0, 'same bookId in another source has independent progress');
  assert.equal(restored.gateway.remoteSession().acquisitionMode, 'online', 'normal entry receives original admitted session');
  const body = f.calls.find(call => call.method === 'chapter.content' && call.params.sourceId === 's1');
  assert.equal(body.params.chapterUrl, undefined, 'background reads must not carry a network refill path');
  assert.deepEqual(body.params.positionContext, { bodyVersion: 'body-v1', processingVersion: 'processing-v1',
    anchors: [{ id: 'restored', offset: 143 }] });
  assert.ok(f.calls.every(call => call.priority === 'background'));
  assert.ok(!f.calls.some(call => call.method === 'reading.progress.update' || call.method === 'source.switch.recover'));
  f.preparations.close();
}

// Completed and already consumed snapshots are fenced at mutation start AND completion.
{
  const f = fixture();
  f.preparations.setVisibleBooks([seed('book')]);
  const before = await f.ready('local', 'book');
  assert.equal(f.preparations.beginRequest('reading.progress.update', {}), true);
  assert.equal(before.isCurrent(), false);
  f.preparations.setVisibleBooks([seed('book')]);
  const callsDuringMutation = f.calls.length;
  await tick();
  assert.equal(f.calls.length, callsDuringMutation, 'no stale reads start inside a mutation');
  f.progress.set(identity('local', 'book'), { sourceId: 'local', bookId: 'book', chapterIndex: 1,
    chapterOffset: 40, chapterProgress: 0.2, updatedAt: 15 });
  f.preparations.finishRequest('reading.progress.update', {});
  const after = await f.ready('local', 'book');
  assert.equal(after.chapter.chapterIndex, 1);
  assert.equal(after.progress.progress.chapterOffset, 40);
  for (const [method, params] of [ ['import.persist', {}], ['import.rollback', {}], ['bookshelf.removeBatch', {}],
    ['source.update', {}], ['source.switch.commit', {}], ['cache.clear', {}], ['chapter.content', { forceRefresh: true }],
    ['replace.persist', {}], ['reader.chinese-conversion.put', {}], ['dict-rule.put', {}], ['runtime.storage.restore', {}] ]) {
    assert.equal(f.preparations.beginRequest(method, params), true, method);
    f.preparations.finishRequest(method, params);
  }
  assert.equal(f.preparations.beginRequest('reading.progress.get'), false);
  assert.equal(f.preparations.beginRequest('source.switch.pending.list'), false);
  f.preparations.close();
}

// Window removal and foreground pause cancel in-flight reads without publishing stale results.
for (const change of ['window', 'pause', 'mutation']) {
  const f = fixture();
  const gate = deferred();
  f.gates.set(`local_book.chapter.content:${identity('local', 'old')}`, gate);
  f.preparations.setVisibleBooks([seed('old'), seed('next')]);
  await until(() => f.calls.some(call => call.method === 'local_book.chapter.content'));
  assert.equal(f.calls.filter(call => call.method === 'local_book.toc').length, 2, 'a slow book must leave a second preparation lane available');
  if (change === 'window') f.preparations.setVisibleBooks([seed('next')]);
  if (change === 'pause') f.preparations.setPaused(true);
  if (change === 'mutation') f.preparations.beginRequest('cache.clear');
  gate.resolve();
  await f.settled();
  assert.equal(f.preparations.take('local', 'old'), undefined);
  if (change === 'pause') {
    const count = f.calls.length;
    await tick(); assert.equal(f.calls.length, count, 'paused foreground leaves the next book idle');
    f.preparations.setVisibleBooks([seed('next')]);
    f.preparations.setPaused(false);
  }
  if (change === 'mutation') {
    f.preparations.setVisibleBooks([seed('next')]);
    f.preparations.finishRequest('cache.clear');
  }
  await f.ready('local', 'next');
  f.preparations.close();
}

// Own detail/catalog installation is admitted; later catalog changes invalidate taken and in-flight data.
{
  const f = fixture();
  f.setAcquireHook(async (remoteSeed, options) => {
    for (const method of ['book.detail', 'book.toc']) {
      assert.equal(f.preparations.beginRequest(method, remoteSeed), true);
      assert.equal(options.isCurrent(), true, 'own catalog mutation must not cancel acquisition');
      await tick();
      f.preparations.finishRequest(method, remoteSeed);
    }
  });
  f.preparations.setVisibleBooks([seed('catalog', 's1')]);
  const snapshot = await f.ready('s1', 'catalog');
  assert.equal(f.calls.filter(call => call.method === 'acquireBook').length, 1, 'self acquisition cannot loop');
  f.preparations.beginRequest('book.toc', { sourceId: 's1', bookId: 'catalog' });
  assert.equal(snapshot.isCurrent(), false);
  f.preparations.finishRequest('book.toc', { sourceId: 's1', bookId: 'catalog' });
  const gate = deferred();
  f.gates.set(`chapter.content:${identity('s1', 'inflight')}`, gate);
  f.preparations.setVisibleBooks([seed('inflight', 's1')]);
  await until(() => f.calls.some(call => call.method === 'chapter.content' && call.params.bookId === 'inflight'));
  f.preparations.beginRequest('book.toc', { sourceId: 's1', bookId: 'inflight' });
  f.preparations.finishRequest('book.toc', { sourceId: 's1', bookId: 'inflight' });
  f.gates.delete(`chapter.content:${identity('s1', 'inflight')}`);
  gate.resolve();
  const renewed = await f.ready('s1', 'inflight');
  assert.equal(renewed.isCurrent(), true);
  assert.equal(f.calls.filter(call => call.method === 'chapter.content' && call.params.bookId === 'inflight').length, 2,
    'a chapter acquired against an older catalog epoch must be discarded and reread');
  f.unavailable.add(identity('s1', 'own-catalog-missing-body'));
  f.preparations.setVisibleBooks([seed('own-catalog-missing-body', 's1')]);
  await f.settled();
  await tick();
  assert.equal(f.calls.filter(call => call.method === 'acquireBook' && call.params.bookId === 'own-catalog-missing-body').length, 1,
    'a cache miss after own catalog installation must remain a miss, without an automatic retry loop');
  f.preparations.close();
}

// Bounded visible window, failed work and remote cache misses leave the normal path available.
{
  const f = fixture();
  f.preparations.setVisibleBooks(Array.from({ length: 9 }, (_, n) => seed(`book-${n}`)));
  await until(() => !f.preparations.active && f.calls.filter(call => call.method === 'local_book.chapter.content').length === 6);
  assert.equal(f.preparations.take('local', 'book-6'), undefined);
  f.failures.add(identity('local', 'failed'));
  f.preparations.setVisibleBooks([seed('failed')]);
  await f.settled();
  assert.equal(f.preparations.take('local', 'failed'), undefined);
  f.failures.clear();
  const gateway = await ReadingSessionFlowGateway.open({ sourceId: 'local', bookId: 'failed', isCurrent: () => true,
    resolveSourceSwitchTransactionId: () => { assert.fail('local entry must not resolve a source switch'); },
    onRemoteSessionReady: () => {} }, f.runtime);
  assert.equal((await gateway.loadChapter('failed', 0)).content, chapterText, 'failed preparation never poisons normal entry');
  f.unavailable.add(identity('s1', 'uncached'));
  f.preparations.setVisibleBooks([seed('uncached', 's1')]);
  await f.settled();
  assert.equal(f.preparations.take('s1', 'uncached'), undefined);
  assert.ok(!f.calls.some(call => call.method === 'chapter.content' && call.params.bookId === 'uncached'),
    'speculation must not refill a missing remote body and migrate positions');
  f.preparations.close();
}

// Pending source-switch recovery belongs exclusively to normal entry.
{
  const f = fixture(); f.setPending([{ transactionId: 'pending' }]);
  f.preparations.setVisibleBooks([seed('switching', 's1')]);
  await f.settled();
  assert.equal(f.preparations.take('s1', 'switching'), undefined);
  assert.deepEqual(f.calls.map(call => call.method), ['source.switch.pending.list']);
  f.preparations.close();
}

// A body removed after cache.status is still a pure miss, never a network refill.
{
  const f = fixture(); const gate = deferred();
  f.gates.set(`chapter.content:${identity('s1', 'vanished')}`, gate);
  f.preparations.setVisibleBooks([seed('vanished', 's1')]);
  await until(() => f.calls.some(call => call.method === 'chapter.content'));
  f.unavailable.add(identity('s1', 'vanished'));
  gate.resolve();
  await f.settled();
  assert.equal(f.preparations.take('s1', 'vanished'), undefined);
  assert.equal(f.calls.filter(call => call.method === 'chapter.content').length, 1);
  assert.ok(!f.calls.some(call => call.method === 'reading.progress.update'));
  f.preparations.close();
}

// Public validity fences also protect display owners after the optional pool
// hands data off; viewport/pause changes never become content mutations.
{
  const f = fixture();
  const current = f.preparations.captureValidity('s1', 'same');
  const sibling = f.preparations.captureValidity('s1', 'other');
  const otherSource = f.preparations.captureValidity('s2', 'same');
  f.preparations.setPaused(true);
  f.preparations.setVisibleBooks([]);
  assert.equal(current(), true);
  const params = { sourceId: 's1', bookId: 'same' };
  f.preparations.beginRequest('reading.progress.update', params);
  const during = f.preparations.captureValidity('s1', 'same');
  assert.equal(current(), false);
  assert.equal(during(), false);
  assert.equal(sibling(), true);
  assert.equal(otherSource(), true);
  f.preparations.beginRequest('reading.progress.update', params);
  f.preparations.finishRequest('reading.progress.update', params);
  assert.equal(f.preparations.captureValidity('s1', 'same')(), false, 'overlapping writes keep the identity fenced');
  f.preparations.finishRequest('reading.progress.update', params);
  assert.equal(f.preparations.captureValidity('s1', 'same')(), true);
  assert.equal(current(), false, 'a completed write cannot resurrect an old display');
  assert.equal(during(), false, 'a fence captured inside an uncertain write is permanently inadmissible');
  assert.equal(sibling(), true);
  assert.equal(otherSource(), true);
  f.preparations.close();
  assert.equal(sibling(), false);
  assert.equal(otherSource(), false);
}

// RPC envelopes define book/source/global mutation scopes. Unknown/opaque
// impact remains conservative; exact scopes preserve unrelated identities.
for (const [method, params, affected] of [
  ['reading.progress.update', { sourceId: 's1', bookId: 'a' }, ['s1/a']],
  ['bookshelf.add', { sourceId: 's1', bookId: 'a' }, ['s1/a']],
  ['bookshelf.remove', { sourceId: 's1', bookId: 'a' }, ['s1/a']],
  ['bookshelf.removeBatch', { targets: [{ sourceId: 's1', bookId: 'a' }, { sourceId: 's1', bookId: 'a' }, { sourceId: 's2', bookId: 'a' }] }, ['s1/a', 's2/a']],
  ['book.detail', { sourceId: 's1', book: { bookId: 'a' }, bookUrl: 'different-detail-url' }, ['s1/a']],
  ['book.toc', { sourceId: 's1', bookId: 'a' }, ['s1/a']],
  ['source.update', { sourceId: 's1', enabled: false }, ['s1/a', 's1/b']],
  ['source.delete', { sourceIds: ['s1', 's1'] }, ['s1/a', 's1/b']],
  ['cache.clear', { scope: 'book', sourceId: 's1', bookId: 'a' }, ['s1/a']],
  ['chapter.content', { sourceId: 's1', bookId: 'a', forceRefresh: true }, ['s1/a']],
  ['source.switch.commit', { from: { sourceId: 's1', bookId: 'a' }, target: { sourceId: 's2', bookId: 'a' } }, ['s1/a', 's2/a']],
  ['source.switch.rollback', { transactionId: 'opaque' }, ['s1/a', 's1/b', 's2/a', 'local/a']],
  ['source.import', { sourceId: 's1', json: 'opaque imports may replace more than one identity' }, ['s1/a', 's1/b', 's2/a', 'local/a']],
  ['replace.persist', { operation: 'update', params: { id: 1, scopeContent: true } }, ['s1/a', 's1/b', 's2/a', 'local/a']],
  ['cache.clear', { scope: 'cache' }, ['s1/a', 's1/b', 's2/a', 'local/a']],
  ['runtime.storage.restore', {}, ['s1/a', 's1/b', 's2/a', 'local/a']],
  ['local_book.reimport', { bookId: 'a' }, ['local/a']],
]) {
  const f = fixture();
  const identities = [['s1', 'a'], ['s1', 'b'], ['s2', 'a'], ['local', 'a']];
  const fences = identities.map(([sourceId, bookId]) => f.preparations.captureValidity(sourceId, bookId));
  assert.equal(f.preparations.beginRequest(method, params), true, method);
  for (let i = 0; i < identities.length; i += 1) assert.equal(fences[i](), !affected.includes(identities[i].join('/')), `${method}: ${identities[i]}`);
  f.preparations.finishRequest(method, params);
  for (let i = 0; i < identities.length; i += 1) {
    assert.equal(fences[i](), !affected.includes(identities[i].join('/')), `${method}: old fence stays invalid`);
    assert.equal(f.preparations.captureValidity(...identities[i])(), true, `${method}: scope refcount balances`);
  }
  f.preparations.close();
}

// One book's mutation cancels its active RPC while another book is admitted.
{
  const f = fixture(), gate = deferred();
  f.gates.set(`local_book.chapter.content:${identity('local', 'a')}`, gate);
  f.preparations.setVisibleBooks([seed('a'), seed('b')]);
  await until(() => f.calls.some(call => call.method === 'local_book.chapter.content' && call.params.bookId === 'a'));
  const aRequest = f.calls.find(call => call.method === 'local_book.chapter.content' && call.params.bookId === 'a');
  const b = await f.ready('local', 'b');
  const params = { sourceId: 'local', bookId: 'a' };
  f.preparations.beginRequest('reading.progress.update', params);
  assert.equal(aRequest.options.shouldCancel(), true);
  assert.equal(b.isCurrent(), true);
  gate.resolve();
  await f.settled();
  assert.equal(f.preparations.take('local', 'a'), undefined);
  f.gates.delete(`local_book.chapter.content:${identity('local', 'a')}`);
  f.preparations.finishRequest('reading.progress.update', params);
  await f.ready('local', 'a');
  assert.equal(b.isCurrent(), true);
  f.preparations.close();
}

// A hung first book cannot starve the second lane, and a third cannot bypass
// the fixed concurrency ceiling while both real requests remain active.
{
  const f = fixture(), a = deferred(), b = deferred();
  f.gates.set(`local_book.chapter.content:${identity('local', 'a')}`, a);
  f.gates.set(`local_book.chapter.content:${identity('local', 'b')}`, b);
  f.preparations.setVisibleBooks([seed('a'), seed('b'), seed('c')]);
  await until(() => f.calls.filter(call => call.method === 'local_book.chapter.content').length === 2);
  assert.equal(f.preparations.active, 2);
  assert.equal(f.calls.some(call => call.params.bookId === 'c'), false);
  b.resolve();
  await f.ready('local', 'b');
  await f.ready('local', 'c');
  assert.equal(f.preparations.active, 1, 'the second lane makes progress without resolving the first');
  f.preparations.close();
  assert.equal(f.calls.find(call => call.params.bookId === 'a').options.shouldCancel(), true);
  a.resolve(); await f.settled();
}

// Limits apply to retained UTF-16 payloads, not only a count of six books.
// Oversized preparation remains an optional miss; foreground content is intact.
{
  const f = fixture();
  f.bodies.set(identity('local', 'big'), '长段正文'.repeat(150000));
  f.preparations.setVisibleBooks([seed('big')]);
  await f.settled();
  assert.equal(f.preparations.take('local', 'big'), undefined);
  assert.equal(f.preparations.retainedBytes(), 0);
  const count = f.calls.length; await tick(); assert.equal(f.calls.length, count, 'oversize is not an automatic retry loop');
  const gateway = await ReadingSessionFlowGateway.open({ sourceId: 'local', bookId: 'big', isCurrent: () => true,
    resolveSourceSwitchTransactionId: async () => undefined, onRemoteSessionReady() {} }, f.runtime);
  assert.equal((await gateway.loadChapter('big', 0)).content, f.bodies.get(identity('local', 'big')));
  f.preparations.close();
}
{
  const f = fixture();
  const seeds = Array.from({ length: 6 }, (_, i) => seed(`payload-${i}`));
  for (const entry of seeds) f.bodies.set(identity(entry.sourceId, entry.bookId), '正文内容'.repeat(112500));
  f.preparations.setVisibleBooks(seeds);
  await f.settled();
  assert.ok(f.preparations.retainedBytes() <= 4 * 1024 * 1024);
  assert.equal(f.preparations.visible.size, 6);
  assert.equal([...f.preparations.visible.values()].filter(entry => entry.snapshot).length, 4,
    'the 4 MiB aggregate budget refuses payloads even below each 1 MiB item budget');
  f.preparations.setVisibleBooks([]);
  assert.equal(f.preparations.retainedBytes(), 0);
  f.preparations.close();
}
{
  const f = fixture();
  f.tocs.set(identity('local', 'large-catalog'), [{ index: 0, title: '目录'.repeat(300000), url: '/0' }]);
  f.preparations.setVisibleBooks([seed('large-catalog')]);
  await f.settled();
  assert.equal(f.preparations.take('local', 'large-catalog'), undefined);
  assert.equal(f.calls.some(call => call.method === 'local_book.chapter.content'), false,
    'an already oversized catalog must not initiate another optional body read');
  f.preparations.close();
}

// Check the actual Core contract, not a parallel guessed spelling list. Reads
// and previews remain non-mutating; every rule write fences both owners.
const contract = readFileSync(new URL('../../Reader-Core-Native/crates/reader-contract/src/lib.rs', import.meta.url), 'utf8') +
  readFileSync(new URL('../../Reader-Core-Native/crates/reader-contract/src/reader_ui.rs', import.meta.url), 'utf8');
const ruleMutations = ['REPLACE_RULE_CREATE', 'REPLACE_RULE_UPDATE', 'REPLACE_RULE_DELETE',
  'REPLACE_PERSIST', 'REPLACE_UNDO', 'DICT_RULE_PUT', 'DICT_RULE_DELETE', 'RULE_BUNDLE_IMPORT'];
for (const name of ruleMutations) {
  const method = contract.match(new RegExp(`pub const ${name}: &str = "([^"]+)"`))?.[1];
  assert.ok(method, `actual Core command ${name}`);
  const f = fixture(), snapshot = f.preparations.captureValidity('local', 'a'),
    content = f.preparations.captureContentValidity('local', 'a');
  assert.equal(f.preparations.beginRequest(method, {}), true, method);
  assert.equal(snapshot(), false, method); assert.equal(content(), false, method);
  const during = f.preparations.captureContentValidity('local', 'a');
  f.preparations.finishRequest(method, {});
  assert.equal(during(), false, `${method}: a lease captured during a mutation never becomes valid`);
  assert.equal(f.preparations.captureContentValidity('local', 'a')(), true);
  f.preparations.close();
}
for (const method of ['replace-rule.list', 'replace.validate', 'replace.preview', 'dict-rule.list', 'dict-rule.query', 'rule-bundle.export']) {
  const f = fixture(), valid = f.preparations.captureContentValidity('local', 'a');
  assert.equal(f.preparations.beginRequest(method, {}), false, method); assert.equal(valid(), true); f.preparations.close();
}
{
  const f = fixture(), content = f.preparations.captureContentValidity('local', 'a'), snapshot = f.preparations.captureValidity('local', 'a');
  const own = { sourceId: 'local', bookId: 'a' };
  f.preparations.beginRequest('reading.progress.update', own);
  assert.equal(content(), true, 'ordinary progress owns a durable write but does not change body');
  assert.equal(snapshot(), false, 'saved position invalidates an old physical-page snapshot');
  f.preparations.finishRequest('reading.progress.update', own); assert.equal(content(), true);
  const other = { sourceId: 'remote', bookId: 'b', forceRefresh: true };
  f.preparations.beginRequest('chapter.content', other); f.preparations.finishRequest('chapter.content', other);
  assert.equal(content(), true, 'unrelated content does not kill a pending save');
  f.preparations.beginRequest('reading.progress.update', { ...own, sourceSwitchTransactionId: 'tx' });
  assert.equal(content(), false, 'transactional source finalization does change content ownership');
  f.preparations.close();
}

{
  const f = fixture();
  f.preparations.setVisibleBooks([seed('kept')]);
  const activePage = await f.ready('local', 'kept');
  const held = deferred();
  f.gates.set(`local_book.chapter.content:${identity('local','slow')}`, held);
  f.preparations.setVisibleBooks([seed('slow'),seed('ready')]);
  await until(() => f.calls.some(call => call.method === 'local_book.chapter.content' && call.params.bookId === 'slow'));
  f.preparations.releaseOptionalMemory();
  held.resolve(); await f.settled();
  assert.equal(f.preparations.take('local','slow'),undefined);
  assert.equal(f.preparations.take('local','ready'),undefined);
  assert.equal(activePage.isCurrent(),true,'memory pressure releases optional ownership, not an already displayed page');
  assert.equal(f.calls.some(call => call.method === 'reading.progress.update'),false,'memory release never changes durable data');
  f.preparations.setVisibleBooks([seed('ready')]);
  assert.ok(await f.ready('local','ready'),'normal optional preparation can resume on a later viewport event');
  f.preparations.close();
}
console.log('reading entry preparation: PASS (scoped fences, Core rule command matrix, independent validity, two lanes, cancellation, payload budgets, memory pressure and normal miss recovery)');

// Whole-shelf persistent preparation is metadata-only and independent of the hot-six window.
{
 const calls=[];const runtime={supportsCoreCapability:c=>c==='reading.entry.prepare.v1',
  bookAcquisitions:()=>({request:async(method,params,options,priority)=>{
   assert.equal(options.shouldCancel(),false);assert.equal(options.canDispatch(),true);
   calls.push({method,params,priority});return preparedResult(params);}})};
 const prep=new ReadingEntryPreparation(runtime);const seeds=Array.from({length:9},(_,i)=>seed(String(i)));
 const load=async()=>seeds;
 await prep.preparePersistedShelf('r1',load,()=>true);
 assert.equal(calls.length,63);assert.ok(calls.every(c=>c.method==='reading.entry.prepare'&&c.priority==='background'));
 assert.deepEqual(calls.slice(0,9).map(c=>c.params.bookId),seeds.map(s=>s.bookId));
 assert.ok(calls.slice(0,9).every(c=>c.params.neighborOffset===0));
 await prep.preparePersistedShelf('r1',load,()=>true);assert.equal(calls.length,63,'same completed revision has no repeated scan');
 const cancelled=prep.preparePersistedShelf('r2',load,()=>true);prep.setPaused(true);await cancelled;
 assert.equal(calls.length,63,'pause cancels idle work before any request');
 prep.setPaused(false);await prep.preparePersistedShelf('r2',load,()=>true);assert.equal(calls.length,126);
 prep.close();await prep.preparePersistedShelf('r3',load,()=>true);assert.equal(calls.length,126);
}
console.log('PASS persistent whole-shelf preparation: all identities, current targets first, metadata only, background priority, pause/resume and close');

// Resume and newer revision admissions must survive an old cancelled sweep.
{
 const calls=[];let release;let entered;
 const started=new Promise(resolve=>{entered=resolve;});
 const held=new Promise(resolve=>{release=resolve;});
 const runtime={supportsCoreCapability:()=>true,bookAcquisitions:()=>({request:async(_method,params,options)=>{
  calls.push(params.bookId);if(calls.length===1){entered();await held;}
  if(options.shouldCancel())throw new Error('cancelled-old-admission');
  return preparedResult(params);
 }})};
 const prep=new ReadingEntryPreparation(runtime);
 const old=prep.preparePersistedShelf('old',async()=>[seed('old')],()=>true).catch(e=>e.message);
 await started;prep.setPaused(true);prep.setPaused(false);
 const obsolete=prep.preparePersistedShelf('obsolete',async()=>[seed('obsolete')],()=>true).catch(e=>e.message);
 const latest=prep.preparePersistedShelf('latest',async()=>[seed('latest')],()=>true).catch(e=>e.message);
 release();await Promise.all([old,obsolete,latest]);
 assert.deepEqual(calls,['old',...Array(7).fill('latest')],'one bounded pending admission, newest revision drains after cancellation');
 await prep.preparePersistedShelf('latest',async()=>{throw Error('already completed');},()=>true);
 prep.close();
}
console.log('PASS persistent preparation rapid pause/resume and latest pending admission');
// A corrupt/unavailable book does not prevent other current targets or neighbours.
{
 const calls=[];let fail=true;
 const runtime={supportsCoreCapability:()=>true,bookAcquisitions:()=>({request:async(_m,p)=>{
  calls.push(p.bookId);if(fail&&p.bookId==='bad')throw Error('invalid-derived-book');
  return preparedResult(p);
 }})};
 const prep=new ReadingEntryPreparation(runtime);const load=async()=>[seed('bad'),seed('good')];
 await assert.rejects(prep.preparePersistedShelf('failure',load,()=>true),/invalid-derived-book/);
 assert.equal(calls.filter(x=>x==='good').length,7);
 fail=false;await prep.preparePersistedShelf('failure',load,()=>true);
 assert.equal(calls.filter(x=>x==='good').length,7,'retry does not redo another book');
 assert.equal(calls.filter(x=>x==='bad').length,14,'only the seven failed targets are retried');prep.close();
}
console.log('PASS persistent preparation isolates per-book failures and retains retryable revision');

// Successful RPCs may still leave documents unprepared. Each reason must keep
// the same revision retryable without blocking other books or fetching bodies.
for (const [kind, reason, offset] of [
  ['missing', 'catalogMissing', 0], ['missing', 'contentMissing', 0],
  ['missing', 'contentMissing', 1], ['deferred', 'sourceSwitchPending', 0],
  ['deferred', 'catalogUnavailableOrOversize', 0], ['deferred', 'bodyOversize', 0],
  ['deferred', 'publicationBudget', 0],
  ['deferred', 'catalogChanged', 0], ['deferred', 'preparationInterrupted', 0], ['deferred', 'localStyleChanged', 0],
  ['blocked', 'catalogInvalid', 0], ['blocked', 'catalogResourceLimit', 0],
  ['blocked', 'bodyResourceLimit', 0], ['blocked', 'publicationCapacity', 0],
]) {
  const calls = []; let unavailable = true;
  const runtime = { supportsCoreCapability: () => true, bookAcquisitions: () => ({
    request: async (method, params, options, priority) => {
      assert.equal(method, 'reading.entry.prepare'); assert.equal(priority, 'background');
      assert.equal(options.canDispatch(), true); calls.push({ ...params });
      return unavailable && params.bookId === 'waiting' && params.neighborOffset === offset ?
        preparedResult(params, kind, reason) : preparedResult(params, 'ready', 'alreadyPrepared');
    },
  }) };
  let loads = 0;
  const prep = new ReadingEntryPreparation(runtime), load = async () => {
    loads += 1; return [seed('waiting'), seed('available')];
  };
  await prep.preparePersistedShelf('same', load, () => true);
  assert.equal(calls.length, 14, `${reason}: one pass ends after seven requests per book`);
  assert.equal(calls.filter(p => p.bookId === 'available').length, 7, `${reason}: unrelated book is not starved`);
  await tick(); assert.equal(calls.length, 14, `${reason}: no automatic retry loop`);
  unavailable = false;
  await prep.preparePersistedShelf('same', load, () => true);
  assert.equal(calls.length, 15, `${reason}: next admission retries only the incomplete target`);
  await prep.preparePersistedShelf('same', load, () => true);
  assert.equal(calls.length, 15, `${reason}: ready revision is not repeated`);
  assert.equal(loads, 1, `${reason}: retry reuses the same shelf membership`);
  prep.close();
}
console.log('PASS persistent preparation outcomes: legacy and current retryable cases, isolated target retry, no self-retry');

// Only an absent neighbour is a satisfied no-work outcome. An existing current
// chapter is mandatory even in a one-chapter book.
{
  const calls = [], runtime = { supportsCoreCapability: () => true, bookAcquisitions: () => ({
    request: async (_method, p) => {
      calls.push(p);
      return p.neighborOffset === 0 ? preparedResult(p) : preparedResult(p, 'missing', 'neighborAbsent');
    },
  }) };
  const prep = new ReadingEntryPreparation(runtime), load = async () => [seed('one-chapter')];
  await prep.preparePersistedShelf('single', load, () => true);
  await prep.preparePersistedShelf('single', load, () => true);
  assert.equal(calls.length, 7, 'six absent neighbours do not cause redundant passes');
  prep.close();
}

// Corrupt/unrecognized responses cannot mark a revision complete, and remain
// isolated to the affected book just like transport failures.
for (const corrupt of [
  data => ({ ...data, kind: 'future-kind' }),
  data => ({ ...data, reason: 'future-reason' }),
  data => ({ ...data, sourceId: 'other' }),
  data => ({ ...data, chapterIndex: -1 }),
  data => ({ ...data, kind: 'missing', reason: 'neighborAbsent', chapterIndex: null }),
]) {
  const calls = []; let invalid = true;
  const runtime = { supportsCoreCapability: () => true, bookAcquisitions: () => ({ request: async (_method, p) => {
    calls.push(p); const result = preparedResult(p);
    return invalid && p.bookId === 'bad' && p.neighborOffset === 0 ? { data: corrupt(result.data) } : result;
  } }) };
  const prep = new ReadingEntryPreparation(runtime), load = async () => [seed('bad'), seed('good')];
  await assert.rejects(prep.preparePersistedShelf('corrupt', load, () => true), /READING_ENTRY_PREPARATION_/);
  assert.equal(calls.length, 14); assert.equal(calls.filter(p => p.bookId === 'good').length, 7);
  invalid = false; await prep.preparePersistedShelf('corrupt', load, () => true);
  assert.equal(calls.length, 15, 'malformed target retries without redoing another book'); prep.close();
}
console.log('PASS persistent result validation: missing neighbours finish; five malformed-result cases stay isolated and retryable');

// Durable target completion follows the exact source/book mutation scope.
// A progress save changes only that book's target; a source edit invalidates
// its books, while a global rule edit invalidates every saved projection.
{
  const calls = []; let loads = 0;
  const runtime = { supportsCoreCapability: () => true, bookAcquisitions: () => ({ request: async (_method, params) => {
    calls.push([params.sourceId, params.bookId, params.neighborOffset]);
    return preparedResult(params);
  } }) };
  const prep = new ReadingEntryPreparation(runtime);
  const books = [seed('a', 's1'), seed('b', 's1'), seed('c', 's2')];
  const load = async () => { loads += 1; return books; };
  await prep.preparePersistedShelf('stable', load, () => true);
  assert.equal(calls.length, 21); assert.equal(loads, 1);
  const content = prep.captureContentValidity('s1', 'a');
  assert.equal(prep.beginRequest('reading.progress.update', { sourceId: 's1', bookId: 'a' }), true);
  prep.finishRequest('reading.progress.update', { sourceId: 's1', bookId: 'a' });
  assert.equal(content(), true, 'ordinary progress does not revoke body validity');
  await prep.preparePersistedShelf('stable', load, () => true);
  assert.deepEqual(calls.slice(21).map(([, bookId]) => bookId), Array(7).fill('a'));
  assert.equal(loads, 1, 'progress does not reload unchanged shelf membership');
  prep.beginRequest('source.update', { sourceId: 's1' });
  prep.finishRequest('source.update', { sourceId: 's1' });
  await prep.preparePersistedShelf('stable', load, () => true);
  assert.equal(calls.length, 42);
  assert.equal(calls.slice(28).filter(([sourceId]) => sourceId === 's2').length, 0,
    'another source retains its prepared targets');
  assert.equal(loads, 2, 'a source mutation refreshes shelf membership');
  prep.beginRequest('replace-rule.update'); prep.finishRequest('replace-rule.update');
  await prep.preparePersistedShelf('stable', load, () => true);
  assert.equal(calls.length, 63, 'global rule change reprojections every book');
  assert.equal(loads, 3);
  await prep.preparePersistedShelf('new-revision', load, () => true);
  assert.equal(calls.length, 84, 'a new shelf revision cannot inherit old completion proofs');
  assert.equal(loads, 4);
  prep.close();
}
console.log('PASS persistent target reuse: progress book scope, source scope, global rule scope and revision reset');

// A late result may ignore cancellation. It still cannot complete the paused
// revision; resuming uses the existing later-admission path exactly once.
{
  const started = deferred(), held = deferred(), calls = [];
  const runtime = { supportsCoreCapability: () => true, bookAcquisitions: () => ({ request: async (_method, p) => {
    calls.push(p); if (calls.length === 1) { started.resolve(); await held.promise; }
    return preparedResult(p);
  } }) };
  const prep = new ReadingEntryPreparation(runtime), load = async () => [seed('paused')];
  const first = prep.preparePersistedShelf('pause', load, () => true);
  await started.promise; prep.setPaused(true); held.resolve(); await first;
  assert.equal(calls.length, 1, 'late ready result does not dispatch more work while paused');
  prep.setPaused(false); await prep.preparePersistedShelf('pause', load, () => true);
  assert.equal(calls.length, 8, 'one resumed admission performs the seven target requests');
  await prep.preparePersistedShelf('pause', load, () => true); assert.equal(calls.length, 8);
  prep.close();
}
console.log('PASS persistent late cancellation: one pending call, seven calls on explicit resume, then no duplicates');

// Modern visible entries use the same atomic offline read as foreground entry.
for (const sourceId of ['local', 's1']) {
  const calls = [];
  const runtime = { supportsCoreCapability: c => c === 'reading.entry.snapshot.v1',
    request: async () => { throw Error('must use background scheduler'); },
    bookAcquisitions: () => ({ request: async (method, params, options, priority) => {
      calls.push({method, priority});
      assert.equal(method, 'reading.entry.snapshot');
      assert.equal(options.shouldCancel(), false);
      return {data: {kind:'ready',sourceId,bookId:'narrow',chapterIndex:40,chapterTitle:'正文',
        content:'正文甲乙丙',blocks:[{kind:'text',startScalar:0,endScalar:5,text:'正文甲乙丙'}],
        positionScope:{sourceId,bookId:'narrow',chapterIndex:40,bodyVersion:'b',processingVersion:'p'},
        progress:null,baseUrl:'https://example.org/40',contentRefreshRequired:false,
        navigation:{revision:'r',chapterCount:10000,readableChapterCount:10000,
          current:{index:40,position:40,readablePosition:40,title:'正文',navigable:true},before:[],after:[]}}};
    }, acquireBook: () => {throw Error('must not acquire full session');} }) };
  const preparations = new ReadingEntryPreparation(runtime);
  preparations.setVisibleBooks([seed('narrow',sourceId)]);
  let snapshot;
  await until(() => {snapshot=preparations.take(sourceId,'narrow');return snapshot!==undefined;});
  assert.deepEqual(calls,[{method:'reading.entry.snapshot',priority:'background'}]);
  assert.equal(snapshot.catalogPending,true);
  assert.equal(snapshot.navigation.chapterCount,10000);
  assert.equal(snapshot.toc.entries.length,1);
  assert.equal(snapshot.gateway.runtimeOwner.allowSourceContentCorrection, false);
  await assert.rejects(snapshot.gateway.runtimeOwner.request('chapter.content', {
    sourceId, bookId: 'narrow', chapterIndex: 40, upgradeCachedContent: true,
  }), /READING_ENTRY_PREPARATION_CANCELLED/);
  assert.equal(calls.length, 1, 'background wrapper rejects a correction before dispatch');
  preparations.setPaused(true);
  assert.equal(snapshot.isCurrent(),true,'handoff pause does not invalidate retained body');
  preparations.beginRequest('reading.progress.update',{});
  assert.equal(snapshot.isCurrent(),false,'new progress invalidates retained resume');
  preparations.close();
}
console.log('PASS modern visible preparation: atomic body/progress/navigation only, background lane and handoff mutation fencing');

// The real shared gateway must neither repair nor retain known damaged text
// from the shelf's read-only background lane.
{
  const calls = [];
  const runtime = { supportsCoreCapability: c => c === 'reading.entry.snapshot.v1',
    request: async () => { throw Error('foreground lane forbidden'); },
    bookAcquisitions: () => ({ request: async (method, params, options, priority) => {
      calls.push(method); assert.equal(priority, 'background'); assert.equal(method, 'reading.entry.snapshot');
      return { data: { kind: 'ready', sourceId: 's1', bookId: 'damaged', chapterIndex: 40,
        chapterTitle: '正文', content: 'quot;正文', blocks: [{kind:'text',startScalar:0,endScalar:7,text:'quot;正文'}],
        positionScope: {sourceId:'s1',bookId:'damaged',chapterIndex:40,bodyVersion:'b',processingVersion:'p'},
        progress:null,baseUrl:'https://example.org/40',contentRefreshRequired:false,
        sourceCorrectionRequired:true,navigation:null } };
    } }) };
  const prep = new ReadingEntryPreparation(runtime);
  prep.setVisibleBooks([seed('damaged', 's1')]);
  await until(() => prep.active === 0);
  assert.deepEqual(calls, ['reading.entry.snapshot']);
  assert.equal(prep.take('s1', 'damaged'), undefined, 'damaged text cannot reach the retained first-page path');
  prep.close();
}

// Shelf preparation uses the production bounded gateway, including semantic
// paragraph qualification, absolute anchors and pause-independent handoff.
for (const [sourceId, bookKind, text, expected] of [
  ['local','TXT','tail\n目标😀段\n第二段\nhead','目标😀段\n第二段'],
  ['local','EPUB','tail\n\n目标\nBR\n\n第二段\n\nhead','目标\nBR\n\n第二段'],
  ['s1',undefined,'tail\n目标😀段\n第二段\nhead','目标😀段\n第二段'],
]) {
  const calls=[];
  const count=[...text].length;
  const runtime={supportsCoreCapability:c=>c.startsWith('reading.entry.snapshot.'),
    bookAcquisitions:()=>({request:async(method,params,options,priority)=>{
      calls.push(params);assert.equal(method,'reading.entry.snapshot');assert.equal(priority,'background');
      assert.equal(params.windowScalarLimit,8192);
      return {data:{kind:'ready',sourceId,bookId:'window',chapterIndex:4,chapterTitle:'正文',
        content:text,blocks:[{kind:'text',startScalar:40,endScalar:40+count,text}],
        documentWindow:{startScalar:40,endScalar:40+count,totalScalars:100,requestedScalar:47},
        positionScope:{sourceId,bookId:'window',chapterIndex:4,bodyVersion:'b',processingVersion:'p'},
        progress:null,baseUrl:'',contentRefreshRequired:false,navigation:null}};
    }}),request:async()=>{throw Error('foreground lane forbidden');}};
  const preparations=new ReadingEntryPreparation(runtime);
  preparations.setVisibleBooks([{...seed('window',sourceId),bookKind}]);
  let snapshot;
  await until(()=>{snapshot=preparations.take(sourceId,'window');return snapshot!==undefined;});
  assert.equal(calls.length,1);
  assert.equal(snapshot.chapter.content,expected);
  assert.equal(snapshot.requestedScalar,47);
  assert.equal(snapshot.chapter.documentRange.totalScalars,100);
  preparations.setPaused(true);
  assert.equal(snapshot.isCurrent(),true);
  preparations.close();
}
console.log('PASS bounded shelf preparation: TXT, EPUB explicit breaks, remote, absolute restore and handoff');

// Foreground chapter reads must wait for a content mutation to settle and
// reject a result captured before a cache or rule replacement. Ordinary
// progress saves do not change the body's epoch.
{
  const prep = new ReadingEntryPreparation({ request: async () => { throw Error('unexpected request'); } });
  const before = prep.captureContentValidity('s1', 'book');
  assert.equal(before(), true);
  const progress = { sourceId: 's1', bookId: 'book' };
  assert.equal(prep.beginRequest('reading.progress.update', progress), true);
  assert.equal(before(), true);
  prep.finishRequest('reading.progress.update', progress);
  assert.equal(before(), true);

  const mutation = { sourceId: 's1', bookId: 'book', forceRefresh: true };
  assert.equal(prep.beginRequest('chapter.content', mutation), true);
  assert.equal(before(), false);
  assert.equal(prep.captureContentValidity('s1', 'book')(), false);
  let idle = false;
  const waiting = prep.waitForContentIdle('s1', 'book').then(() => { idle = true; });
  await tick();
  assert.equal(idle, false);
  prep.finishRequest('chapter.content', mutation);
  await waiting;
  assert.equal(idle, true);
  assert.equal(before(), false);
  assert.equal(prep.captureContentValidity('s1', 'book')(), true);
  prep.close();
}
console.log('PASS content mutation epoch: stale chapter fenced, progress save retained, retry waits for idle');

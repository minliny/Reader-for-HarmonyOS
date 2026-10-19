/** Pure fake-Core fixture factory; no tests, tool discovery or work on import. */
export function addedBookPreparationCoreFixture({assert,BookAcquisitionCoordinator,BookRequestScheduler,deferred,tick}) {
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


return {book,seed,body,coreError,storage,fixture,intent};
}

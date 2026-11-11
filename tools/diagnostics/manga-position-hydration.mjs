// Manual L09 diagnostics. No default test, device, Core or database entry.
const cases = ['same-signature-recovery', 'outcome-and-selection', 'sdk-consumer'];
const args = process.argv.slice(2);
if (args.length === 0 || (args.length === 1 && args[0] === '--list')) {
  console.log(JSON.stringify({ status: 'NOT_RUN', cases }));
  process.exit(0);
}
if (args[0] !== '--case' || !cases.includes(args[1]) ||
  !((args.length === 2) || (args.length === 4 && args[2] === '--hydrator-source' && args[1] === cases[0]))) {
  console.error('Select one exact --case; optional --hydrator-source is only a recovery counterfactual input.');
  process.exit(2);
}
const { default: assert } = await import('node:assert/strict');
const { selectedProductionClasses, selectedProductionMethods } = await import('../lib/selected-production-methods.mjs');
const { readFileSync } = await import('node:fs');
const { createHash } = await import('node:crypto');
const { resolve } = await import('node:path');
const file = relative => new URL('../../entry/src/main/ets/' + relative, import.meta.url);
const paths = {
  manga: file('features/manga/presentation/MangaBookPresentation.ts'),
  hydrator: args.length === 4 ? resolve(args[3]) : file('features/manga/presentation/MangaPositionHydrator.ts'),
  shelf: file('features/bookshelf/presentation/ShelfBookPresentation.ts'),
  selection: file('features/bookshelf/ui/BookshelfMultiSelectPage.ets'),
};
const inputHashes = () => Object.fromEntries(Object.entries(paths).map(([name, path]) =>
  [name, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const tick = async () => { for (let index = 0; index < 24; index++) await Promise.resolve(); };
const book = (index = 0, sourceId = 'source') => ({ sourceId, bookId: `book-${index}`, contentKind: 'manga',
  title: `Book ${index}`, author: '', addedAt: 1, group: '', chapterCount: 2, readProgress: 10000 });
function entry(identity, { revision = 3, epoch = 1, noProgress = false, page = 1 } = {}) {
  const chapter = { sourceId: identity.sourceId, bookId: identity.bookId, chapterId: 'chapter-1' };
  const location = noProgress ? null : { kind: 'manga', chapter, manifestVersion: 'v1', pageId: `p${page}`,
    pageOrdinalFallback: page, x: 0, y: 0, progressRevision: revision };
  return { chapter: { chapterIndex: 1, chapterTitle: 'Chapter', totalPages: 6,
    manifest: { chapter, manifestVersion: 'v1', pages: [{ pageId: `p${page}`, ordinal: page }] } },
    progress: { token: { epoch, revision }, location }, targetOrdinal: page };
}
function fixture() {
  const { MangaBookPresentation: Manga } = selectedProductionClasses(paths.manga, ['MangaBookPresentation']);
  const control = { pending: [], calls: 0, writes: [], projects: 0 };
  class Gateway {
    entry(sourceId, bookId) { control.calls++; return new Promise((resolve, reject) =>
      control.pending.push({ sourceId, bookId, kind: 'entry', resolve, reject })); }
    progress(sourceId, bookId) { control.calls++; return new Promise((resolve, reject) =>
      control.pending.push({ sourceId, bookId, kind: 'progress', resolve, reject })); }
  }
  const { MangaPositionHydrator: Hydrator } = selectedProductionClasses(paths.hydrator, ['MangaPositionHydrator'], {
    MangaBookPresentation: Manga, MangaSessionGateway: Gateway,
    AppStorage: { setOrCreate: (_key, value) => control.writes.push(value) },
  });
  const { ShelfBookPresentation: Shelf } = selectedProductionClasses(paths.shelf, ['ShelfBookPresentation'], {
    MangaBookPresentation: Manga,
  });
  const scene = { owner: {}, mounting: 1, navigation: 1, route: 'bookshelf', shelfGeneration: 1,
    shelfBooks: [book()], covered: false };
  const hydrator = new Hydrator();
  return { Manga, Shelf, control, scene, hydrator,
    hydrate: (books = [book()]) => hydrator.hydrateVisible(books, () => scene, () => control.projects++),
  };
}
async function sameSignatureRecovery() {
  const f = fixture(), before = JSON.stringify(f.scene);
  f.hydrate(); assert.equal(f.control.pending.length, 1);
  f.control.pending.shift().reject(Error('controlled optional entry failure')); await tick();
  assert.equal(f.control.calls, 1, 'failure never starts an automatic retry');
  assert.equal(f.hydrator.workers, 0);
  f.hydrate(); assert.equal(JSON.stringify(f.scene), before, 'all scene identities stay unchanged');
  assert.equal(f.control.pending.length, 1, 'same signature next ordinary visible callback must retry an unconfirmed failed result');
  f.control.pending.shift().resolve(entry(book())); await tick();
  assert.equal(f.Manga.get('source', 'book-0').pageOrdinal, 1);
  f.hydrate(); assert.equal(f.control.pending.length, 0, 'confirmed result is deduplicated');
  f.hydrator.retire();
}
const selectionMethods = ['aboutToAppear', 'reconcileSelection', 'onMangaPresentationChanged', 'canRetainSelectedKey',
  'canRemoveSelection', 'removeVisibleSelection', 'toggleBook', 'toggleAll', 'allSelected',
  'selectionInputEnabled', 'hasBookKey', 'visibleBooks', 'bookKey'];
function selection(f) {
  const Selection = selectedProductionMethods(paths.selection, 'BookshelfMultiSelectPage', selectionMethods, {
    ShelfBookPresentation: f.Shelf, registerReaderFonts: () => {},
  });
  const removed = [];
  const owner = Object.assign(new Selection(), { books: [book(), book(1)], storedSelectedGroup: '',
    readingFilter: 'reading', sourceFilter: 'all', mangaRevision: f.Manga.revision,
    selectedKeys: [], mounted: true, busy: false, ready: true, isInputAllowed: () => true,
    initialSelectedKey: '', onGeometryInputsChanged() {}, getUIContext: () => ({ getFont: () => ({}) }),
    onRemoveSelected: keys => removed.push(keys),
  });
  return { owner, removed };
}
async function outcomeAndSelection() {
  let groups = 0;
  {
    const f = fixture(); f.Manga.useOwner(f.scene.owner);
    assert.equal(f.Manga.outcome('source', 'book-0'), 'unknown');
    assert.equal(f.Shelf.readingPosition(book()), '', 'unconfirmed position is not unread text');
    assert.equal(f.Shelf.visible([book()], '', 'all').length, 1);
    assert.equal(f.Shelf.visible([book()], '', 'unread').length, 0);
    assert.equal(f.Shelf.visible([book()], '', 'reading').length, 0);
    f.hydrate(); assert.equal(f.Manga.outcome('source', 'book-0'), 'loading');
    f.hydrate(); assert.equal(f.control.pending.length, 1, 'in-flight request stays deduplicated');
    f.control.pending.shift().reject(Error('entry unavailable')); await tick();
    assert.equal(f.Manga.outcome('source', 'book-0'), 'retryable-failure');
    assert.equal(f.control.pending.length, 0, 'entry exception does not silently become progress fallback');
    assert.equal(f.Shelf.visible([book()], '', 'unread').length, 0); f.hydrator.retire(); groups++;
  }
  {
    const f = fixture(); f.hydrate(); f.control.pending.shift().resolve(null); await tick();
    assert.equal(f.control.pending[0].kind, 'progress');
    f.control.pending.shift().reject(Error('progress unavailable')); await tick();
    assert.equal(f.Manga.outcome('source', 'book-0'), 'retryable-failure');
    const calls = f.control.calls; await tick(); assert.equal(f.control.calls, calls);
    f.hydrate(); f.control.pending.shift().resolve(null); await tick();
    f.control.pending.shift().resolve(entry(book()).progress); await tick();
    assert.equal(f.Manga.outcome('source', 'book-0'), 'confirmed-position'); f.hydrator.retire(); groups++;
  }
  {
    const f = fixture(); f.hydrate(); f.control.pending.shift().resolve(entry(book(), { noProgress: true })); await tick();
    assert.equal(f.Manga.outcome('source', 'book-0'), 'confirmed-none');
    assert.equal(f.Shelf.readingPosition(book()), '尚未阅读');
    assert.equal(f.Shelf.visible([book()], '', 'unread').length, 1);
    f.hydrate(); assert.equal(f.control.pending.length, 0, 'confirmed null is a completed outcome');
    assert.equal(f.Manga.admitEntry('source', 'book-0', entry(book(), { revision: 2 })), false);
    assert.equal(f.Manga.outcome('source', 'book-0'), 'confirmed-none', 'older token cannot resurrect null');
    f.Manga.useOwner({}); assert.equal(f.Manga.outcome('source', 'book-0'), 'unknown'); f.hydrator.retire(); groups++;
  }
  {
    const f = fixture(); f.hydrate(); const request = f.control.pending.shift();
    f.scene.covered = true; request.resolve(entry(book())); await tick();
    assert.equal(f.Manga.get('source', 'book-0'), undefined);
    f.hydrate(); assert.equal(f.control.pending.length, 0);
    f.scene.covered = false; f.hydrate(); assert.equal(f.control.pending.length, 1, 'same scene can recover after temporary cover');
    f.control.pending.shift().resolve(entry(book())); await tick(); f.hydrator.retire(); groups++;
  }
  for (const oldOutcome of ['resolve', 'reject']) {
    const f = fixture(); f.hydrate(); const old = f.control.pending.shift();
    f.scene.shelfGeneration++; f.hydrate(); const current = f.control.pending.shift();
    current.resolve(entry(book(), { revision: 5, page: 4 })); await tick();
    if (oldOutcome === 'resolve') old.resolve(entry(book(), { revision: 3, page: 1 }));
    else old.reject(Error('old read failed late'));
    await tick(); assert.equal(f.Manga.get('source', 'book-0').pageOrdinal, 4);
    const calls = f.control.calls; f.hydrate(); assert.equal(f.control.calls, calls, 'old completion cannot erase current confirmed dedupe');
    f.hydrator.retire(); groups++;
  }
  {
    const f = fixture(); f.hydrate(); f.control.pending.shift().resolve(entry(book())); await tick();
    const known = f.Manga.get('source', 'book-0'); f.scene.shelfGeneration++; f.hydrate();
    f.control.pending.shift().reject(Error('refresh failed')); await tick();
    assert.equal(f.Manga.get('source', 'book-0'), known, 'refresh failure keeps known position');
    assert.equal(f.Manga.outcome('source', 'book-0'), 'confirmed-position'); f.hydrator.retire(); groups++;
  }
  {
    const f = fixture(), books = Array.from({ length: 180 }, (_, index) => book(index));
    f.scene.shelfBooks = books; f.scene.continueReading = book(180); f.scene.detail = book(181);
    f.Manga.useOwner(f.scene.owner);
    for (const identity of [book(143), book(144), book(180), book(181)])
      f.Manga.admitEntry(identity.sourceId, identity.bookId, entry(identity));
    f.hydrate(books); assert.equal(f.control.pending.length, 2); assert.equal(f.hydrator.queue.length, 22);
    assert.equal(f.Manga.get('source', 'book-144'), undefined);
    for (const index of [143, 180, 181]) assert.ok(f.Manga.get('source', `book-${index}`));
    let safety = 0;
    while (f.control.pending.length && safety++ < 30) {
      const request = f.control.pending.shift(); request.resolve(entry(request)); await tick();
      assert.ok(f.hydrator.workers <= 2);
    }
    assert.equal(f.control.calls, 24); assert.equal(f.hydrator.workers, 0); f.hydrator.retire(); groups++;
  }
  {
    const f = fixture(), other = book(0, 'other-source'); f.scene.shelfBooks.push(other); f.hydrate([book(), other]);
    const first = f.control.pending.shift(), second = f.control.pending.shift();
    first.resolve(entry(first, { page: 1 })); second.resolve(entry(second, { page: 4 })); await tick();
    assert.equal(f.Manga.get('source', 'book-0').pageOrdinal, 1); assert.equal(f.Manga.get('other-source', 'book-0').pageOrdinal, 4);
    f.scene.shelfGeneration++; f.hydrate(); const pending = f.control.pending.shift(); f.hydrator.retire();
    pending.resolve(entry(pending, { page: 5 })); await tick(); assert.equal(f.Manga.get('source', 'book-0').pageOrdinal, 1);
    groups++;
  }
  {
    const f = fixture(); f.Manga.useOwner(f.scene.owner); const { owner: s, removed } = selection(f), key = s.bookKey(book());
    s.selectedKeys = [key]; s.reconcileSelection(); assert.deepEqual(s.selectedKeys, [key], 'unconfirmed selection identity survives a display read gap');
    assert.equal(s.canRemoveSelection(), false); s.removeVisibleSelection(); assert.equal(removed.length, 0);
    s.toggleBook(book()); assert.deepEqual(s.selectedKeys, [key], 'stale hidden click cannot toggle unknown entity');
    f.Manga.admitEntry('source', 'book-0', entry(book())); s.mangaRevision = f.Manga.revision; s.onMangaPresentationChanged();
    assert.deepEqual(s.selectedKeys, [key]); assert.equal(s.canRemoveSelection(), true);
    s.removeVisibleSelection(); assert.deepEqual(removed, [[key]]);
    f.Manga.useOwner({}); s.onMangaPresentationChanged(); assert.deepEqual(s.selectedKeys, [key]);
    assert.equal(s.canRemoveSelection(), false, 'owner reset never treats old position as current filter proof'); groups++;
  }
  {
    const f = fixture(); f.Manga.useOwner(f.scene.owner); const { owner: s } = selection(f), key = s.bookKey(book());
    s.selectedKeys = [key];
    f.Manga.admitEntry('source', 'book-0', entry(book(), { noProgress: true })); s.onMangaPresentationChanged();
    assert.deepEqual(s.selectedKeys, [], 'confirmed nonmatching state reconciles selection');
    s.readingFilter = 'unread'; s.onMangaPresentationChanged(); assert.equal(s.visibleBooks().length, 1);
    assert.deepEqual(s.selectedKeys, [], 'late facts cannot silently select a new entity'); groups++;
  }
  {
    const f = fixture(); f.Manga.useOwner(f.scene.owner); const { owner: s, removed } = selection(f);
    const unknown = s.bookKey(book()), known = s.bookKey(book(1)); s.selectedKeys = [unknown];
    f.Manga.admitEntry('source', 'book-1', entry(book(1))); s.toggleAll();
    assert.deepEqual(s.selectedKeys, [unknown, known], 'explicit all selects known rows and preserves pending previous identity');
    s.removeVisibleSelection(); assert.deepEqual(removed, [[known]], 'pending filtered identity never leaks to submitted keys');
    s.sourceFilter = 'local'; s.reconcileSelection(); assert.deepEqual(s.selectedKeys, []);
    s.sourceFilter = 'all'; s.selectedKeys = [known]; s.books = [book()]; s.reconcileSelection(); assert.deepEqual(s.selectedKeys, []);
    s.books = [book(1)]; s.selectedKeys = [known]; s.isInputAllowed = () => false; s.removeVisibleSelection();
    assert.equal(removed.length, 1, 'retired route rejects late submit'); s.toggleAll(); assert.deepEqual(s.selectedKeys, [known]); groups++;
  }
  {
    const f = fixture(), books = [book(), book(1)]; f.scene.shelfBooks = books; f.hydrate(books);
    const failed = f.control.pending.shift(), other = f.control.pending.shift();
    failed.reject(Error('one book failed')); await tick(); f.hydrate(books);
    assert.equal(f.control.pending.length, 1, 'same batch retries only its failed identity');
    const retry = f.control.pending.shift(); other.resolve(entry(other)); retry.resolve(entry(retry)); await tick();
    assert.equal(f.control.calls, 3); f.hydrate(books); assert.equal(f.control.calls, 3, 'partial batch completion stays deduplicated');
    f.hydrator.retire(); groups++;
  }
  {
    const f = fixture(); f.Manga.useOwner(f.scene.owner); const { owner: s } = selection(f);
    s.initialSelectedKey = s.bookKey(book()); s.aboutToAppear();
    assert.deepEqual(s.selectedKeys, [s.initialSelectedKey], 'actual appear retains the long-pressed unconfirmed book');
    assert.equal(s.canRetainSelectedKey(s.bookKey(book(0, 'other-source'))), false);
    s.readingFilter = 'all'; s.toggleAll(); assert.equal(s.selectedKeys.length, 2, 'all-books selection does not depend on optional progress receipt');
    assert.equal(s.canRemoveSelection(), true);
    const fresh = selection(f).owner; fresh.initialSelectedKey = fresh.bookKey(book(0, 'other-source')); fresh.aboutToAppear();
    assert.deepEqual(fresh.selectedKeys, [], 'actual appear rejects a different source with the same bookId'); groups++;
  }
  return { groups };
}
async function sdkConsumer() {
  const f = fixture(); f.Manga.useOwner(f.scene.owner);
  const { createReaderBuilderProbe } = await import('../lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('../lib/arkui-property-runtime-probe.mjs');
  const properties = createArkUIPropertyRuntimeProbe();
  const source = readFileSync(paths.selection, 'utf8');
  const names = ['mangaRevision', 'storedSelectedGroup', 'readingFilter', 'sourceFilter', 'books', 'initialSelectedKey',
    'busy', 'ready', 'isInputAllowed', 'onRemoveSelected', 'selectedKeys', 'mounted', ...selectionMethods];
  const { owner, output } = createReaderBuilderProbe(source, names, { ...properties.sdk, ShelfBookPresentation: f.Shelf }, properties.hooks);
  assert.ok(output.includes('readerMangaPresentationRevision'), 'actual SDK storage key retained');
  assert.equal(owner.watches.get('mangaRevision'), owner.onMangaPresentationChanged);
  owner.mounted = true; owner.books = [book()]; owner.readingFilter = 'reading'; owner.sourceFilter = 'all';
  owner.selectedKeys = [owner.bookKey(book())];
  assert.equal(owner.visibleBooks().length, 0); assert.equal(owner.canRemoveSelection(), false);
  f.Manga.admitEntry('source', 'book-0', entry(book())); owner.mangaRevision = f.Manga.revision;
  assert.equal(owner.visibleBooks().length, 1); assert.equal(owner.canRemoveSelection(), true);
  assert.equal(owner.selectedKeys.length, 1, 'native property watcher preserves explicitly selected matching identity');
  f.Manga.admitEntry('source', 'book-0', entry(book(), { revision: 4, noProgress: true })); owner.mangaRevision = f.Manga.revision;
  assert.equal(owner.selectedKeys.length, 0, 'actual SDK property delivery invokes the current filter reconcile');
  assert.equal(owner.canRemoveSelection(), false);
  owner.mounted = false; owner.selectedKeys = ['retired']; owner.mangaRevision++;
  assert.deepEqual([...owner.selectedKeys], ['retired'], 'late revision cannot reconcile a retired component');
  return { watcher: 'SDK_EMITTED_STORAGE_LINK', nativeRendering: 'NOT_RUN' };
}
const implementations = {
  'same-signature-recovery': sameSignatureRecovery,
  'outcome-and-selection': outcomeAndSelection,
  'sdk-consumer': sdkConsumer,
};
const result = await implementations[args[1]]();
console.log(JSON.stringify({ status: 'PASS', case: args[1], inputs: inputHashes(),
  ...result,
  boundary: 'Actual selected production methods/local SDK only; no Core IO, device, native rendering or durable progress writes' }));

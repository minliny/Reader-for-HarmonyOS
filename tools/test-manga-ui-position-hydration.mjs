import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  'position-projection': { description: 'Actual bounded MangaPositionHydrator, Entry/Exit owners, fake Gateway and stale identity fences; no Core IO', resources: [] },
  'metadata-concurrency': { description: 'Actual EntryActions→Entry→ReadingEntryHost cached metadata versus confirmed manga position and revocation; fake request boundary', resources: [] },
  'retained-detail-directory-sdk': { description: 'Actual current detail/catalog scenes retain SDK children and receive saved manga chapter/page facts; fake Gateway', resources: [] },
};

async function fixtureModule() {
  return import('./lib/manga-position-current-owner-probe.mjs');
}
const books = Array.from({ length: 180 }, (_, i) => ({ sourceId: 'source', bookId: `book-${i}`, contentKind: 'manga', title: `Book ${i}`, author: '', addedAt: 1 }));
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function entry(request, { revision = 3, pageOrdinal = 7, noProgress = false, epoch = 1 } = {}) {
  const chapterIdentity = { sourceId: request.sourceId, bookId: request.bookId, chapterId: 'chapter-4' };
  const location = noProgress ? null : { kind: 'manga', chapter: chapterIdentity, manifestVersion: 'm1', pageId: `page-${pageOrdinal}`, pageOrdinalFallback: pageOrdinal, x: 0, y: 0, progressRevision: revision };
  return { chapter: { chapterIndex: 4, chapterTitle: '来源原始卷名', totalPages: 24, manifest: { chapter: chapterIdentity, manifestVersion: 'm1', pages: [{ pageId: `page-${pageOrdinal}`, ordinal: pageOrdinal }] } }, progress: { token: { epoch, revision }, location }, targetOrdinal: pageOrdinal };
}
async function drain(f) {
  let safety = 0;
  while (f.control.pending.length && safety++ < 300) {
    const next = f.control.pending.shift();
    next.resolve(next.kind === 'entry' ? (next.entryNull ? null : entry(next)) : entry(next).progress);
    await tick();
  }
  assert.ok(safety < 300, 'bounded queue terminates');
}
function makeFixture(create, options) {
  const f = create(options);
  f.index.shelfRead.snapshot.books = books;
  return f;
}
function detail(f, book = books[0]) { f.show('detail'); f.entry.book = { ...book }; f.entry.contentKind = book.contentKind; }
function beginReader(f) { f.entry.beginReaderPresentation(); f.entry.startReading(f.control.runtime); f.show('reading'); }

async function casePositionProjection() {
  const { mangaPositionOwnerFixture: create } = await fixtureModule();
  const { MangaBookPresentation: Manga } = await import('../entry/src/main/ets/features/manga/presentation/MangaBookPresentation.ts');
  const fixture = options => makeFixture(create, options);
  {
    const f = fixture(); f.hydrate(books.slice(0, 30));
    assert.equal(f.control.pending.length, 2); assert.equal(f.hydrator.workers, 2); assert.equal(f.hydrator.queue.length, 22, 'latest visible batch retains at most 24 candidates');
    f.hydrate(books.slice(0, 30)); assert.equal(f.control.pending.length, 2, 'identical visible callback does not refetch');
    const old = f.control.pending.splice(0); f.hydrate(books.slice(30, 70));
    assert.equal(f.hydrator.workers, 2); assert.equal(f.control.pending.length, 0); assert.equal(f.hydrator.queue.length, 24);
    old.forEach(request => request.resolve(entry(request))); await tick();
    assert.equal(Manga.get('source', 'book-0'), undefined, 'canceled old entry cannot publish');
    assert.equal(f.control.pending.length, 2, 'old completion pumps latest queue without skipped identities');
    await drain(f); assert.equal(f.hydrator.workers, 0); assert.equal(f.hydrator.queue.length, 0); assert.equal(Manga.get('source', 'book-30').pageOrdinal, 7); f.close();
  }
  {
    const f = fixture(); f.hydrate([books[0]]); const old = f.control.pending.shift();
    beginReader(f); f.advance(); old.resolve(entry(old)); await tick();
    assert.equal(Manga.get('source', 'book-0'), undefined, 'reader navigation revokes old shelf projection'); assert.equal(f.hydrator.workers, 0); f.close();
  }
  {
    const f = fixture(); detail(f); f.hydrate([books[0]]); const old = f.control.pending.shift();
    f.entry.book = { ...books[0], sourceId: 'source-b' }; f.hydrate([f.entry.book]);
    old.resolve(entry(old)); await tick(); assert.equal(Manga.get('source', 'book-0'), undefined, 'equal bookId under another source rejects old detail');
    await drain(f); assert.equal(f.entry.book.mangaPosition.pageOrdinal, 7); f.close();
  }
  for (const bookInfo of [false, true]) {
    const f = fixture(); detail(f, { ...books[0], sourceName: '腾讯漫画', intro: '保留简介' }); f.hydrate([books[0]]);
    const first = f.control.pending.shift(), initial = entry(first, { pageOrdinal: 1 }); initial.chapter.chapterTitle = '01'; initial.chapter.totalPages = 36;
    first.resolve(initial); await tick(); const old = f.entry.book.mangaPosition;
    assert.equal(old.chapterTitle, '01'); assert.equal(old.totalPages, 36);
    beginReader(f); const next = entry(books[0], { revision: 4, pageOrdinal: 1 }); next.progress.location.chapter.chapterId = 'chapter-5';
    next.chapter.chapterIndex = 5; next.chapter.chapterTitle = '02'; next.chapter.totalPages = 24;
    Manga.admitEntry('source', 'book-0', next); const before = Manga.revision;
    assert.notEqual(Manga.get('source', 'book-0'), old);
    const identity = f.entry.readerPresentationIdentity();
    if (bookInfo) {
      f.exit.attach(() => {}, identity, () => true, f.entry.mangaChapterRequestGeneration);
      f.exit.requestBookInfo();
    }
    f.exit.accepted(identity);
    assert.equal(f.navigation.snapshot().route, 'detail'); assert.equal(f.entry.sessionActive, false);
    assert.equal(f.entry.book.mangaPosition.chapterTitle, '02', 'ordinary and book-info exits refresh retained detail immediately');
    assert.equal(f.entry.book.mangaPosition.pageOrdinal, 1); assert.equal(f.entry.book.mangaPosition.totalPages, 24);
    assert.equal(f.entry.book.sourceName, '腾讯漫画'); assert.equal(f.entry.book.intro, '保留简介');
    const pending = f.control.pending.shift(); pending.resolve(next); await tick();
    assert.equal(Manga.revision, before, 'same Core facts keep row revision stable'); assert.equal(f.entry.book.mangaPosition, Manga.get('source', 'book-0'));
    f.entry.book = { ...f.entry.book, mangaPosition: old }; f.index.shelfRead.snapshot.generation++; f.hydrate([books[0]]);
    f.entry.book = { ...f.entry.book, mangaPosition: old }; f.control.pending.shift().resolve(next); await tick();
    assert.equal(f.entry.book.mangaPosition.chapterTitle, '02', 'unchanged facts still refresh stale mounted snapshot');
    beginReader(f); f.entry.book = { ...books[1] }; const successor = f.entry.book;
    f.exit.accepted(identity); assert.equal(f.entry.book, successor); assert.equal(f.navigation.snapshot().route, 'reading', 'old accepted exit cannot navigate away a new book'); f.close();
  }
  {
    const f = fixture(); detail(f); f.hydrate([books[0]]); await drain(f); const before = Manga.revision, writes = f.control.writes.length;
    f.index.shelfRead.snapshot.generation++; f.hydrate([books[0]]); await drain(f);
    assert.equal(Manga.revision, before); assert.equal(f.control.writes.length, writes, 'unchanged facts do not invalidate rows');
    f.index.shelfRead.snapshot.generation++; f.hydrate([books[0]]); const cleared = f.control.pending.shift(); cleared.resolve(entry(cleared, { noProgress: true, revision: 4 })); await tick();
    assert.equal(Manga.get('source', 'book-0'), undefined); assert.equal(f.entry.book.mangaPosition, undefined, 'confirmed absence clears mounted detail');
    assert.equal(Manga.admitEntry('source', 'book-0', entry(cleared, { revision: 3 })), false, 'older valid wire facts cannot resurrect cleared location'); f.close();
  }
  {
    const f = fixture(); f.hydrate([books[0]]); const old = f.control.pending.shift(); f.setRuntime({}); f.hydrate([books[1]]);
    old.resolve(entry(old)); await tick(); assert.equal(Manga.get('source', 'book-0'), undefined, 'replacement Runtime rejects old display facts'); await drain(f);
    f.index.shelfRead.snapshot.books = [books[1]]; f.hydrate([books[1]]); assert.equal(Manga.get('source', 'book-30'), undefined); f.close();
  }
  for (const reason of ['filtered', 'paged']) {
    const f = fixture(); f.index.shelfRead.snapshot.books = [books[1]]; f.index.shelfRead.snapshot.continueReading = books[0];
    f.hydrate([books[0]]); const next = f.control.pending.shift(); next.resolve(entry(next, { pageOrdinal: 2 })); await tick(); const known = Manga.get('source', 'book-0');
    assert.equal(known.pageOrdinal, 2); f.hydrate([books[0]]); assert.equal(Manga.get('source', 'book-0'), known, `${reason}: global continue card outside shelf retains its confirmed facts`); assert.equal(f.control.pending.length, 0);
    f.hydrate([]); assert.equal(Manga.get('source', 'book-0'), known); assert.equal(f.control.pending.length, 0, 'retention adds no request candidate');
    f.index.shelfRead.snapshot.continueReading = undefined; f.hydrate([]); assert.equal(Manga.get('source', 'book-0'), undefined, 'removed off-shelf card is reclaimed'); f.close();
  }
  {
    const f = fixture(); f.index.shelfRead.snapshot.books = [books[1]]; f.index.shelfRead.snapshot.continueReading = books[0];
    f.hydrate([books[0]]); const next = f.control.pending.shift(); next.resolve(entry(next)); await tick();
    const other = { ...books[0], sourceId: 'other-source' }; Manga.admitEntry(other.sourceId, other.bookId, entry(other));
    f.index.shelfRead.snapshot.continueReading = other; f.hydrate([]); assert.equal(Manga.get('source', 'book-0'), undefined); assert.equal(Manga.get('other-source', 'book-0').pageOrdinal, 7);
    f.index.shelfRead.snapshot.continueReading = { ...other, contentKind: 'text' }; f.hydrate([]); assert.equal(Manga.get('other-source', 'book-0'), undefined, 'novel card cannot retain manga facts'); assert.equal(f.control.pending.length, 0); f.close();
  }
  {
    const f = fixture(); f.index.shelfRead.snapshot.books = [books[1]]; f.index.shelfRead.snapshot.continueReading = books[0]; f.hydrate([books[0]]);
    const first = f.control.pending.shift(); first.resolve(entry(first)); await tick(); assert.notEqual(Manga.get('source', 'book-0'), undefined);
    f.index.shelfRead.snapshot.generation++; f.hydrate([books[0]]); const old = f.control.pending.shift(); f.setRuntime({}); f.hydrate([]); old.resolve(entry(old)); await tick();
    assert.equal(Manga.get('source', 'book-0'), undefined, 'new Runtime cannot retain or revive old continue card'); assert.equal(f.hydrator.workers, 0); assert.equal(f.control.pending.length, 0); f.close();
  }
  {
    const f = fixture(); f.control.nullEntryBooks.add('book-0'); f.hydrate([books[0]]); f.control.pending.shift().resolve(null); await tick(); assert.equal(f.control.pending.length, 1, 'missing prepared entry falls back to progress read');
    const fallback = f.control.pending.shift(); f.index.sourceSwitchPresentation.visible = true; fallback.resolve(entry(fallback).progress); await tick();
    assert.equal(Manga.get('source', 'book-0'), undefined, 'covered source switch rejects pending fallback'); assert.equal(f.hydrator.workers, 0); f.close();
  }
  {
    const f = fixture(); f.index.sourceSwitchPresentation.visible = true; f.hydrate([books[0]]); assert.equal(f.control.pending.length, 0, 'source switch foreground prevents hydration'); f.close();
  }
}

async function caseMetadataConcurrency() {
  const { mangaPositionOwnerFixture: create } = await fixtureModule();
  const { MangaBookPresentation: Manga } = await import('../entry/src/main/ets/features/manga/presentation/MangaBookPresentation.ts');
  const metadataFixture = () => {
    let resolveMetadata, rejectMetadata;
    const runtime = { bookAcquisitions: () => ({ readingProjectionRevision: () => 7, setPreparationVisible() {} }),
      request: async (method, params, options) => {
        assert.equal(method, 'search-book.get'); assert.deepEqual(params, { origin: 'source', bookUrl: 'book-0' }); assert.equal(options.canDispatch(), true);
        return new Promise((resolve, reject) => { resolveMetadata = resolve; rejectMetadata = reject; });
      } };
    const f = makeFixture(create, { runtime }); detail(f, { ...books[0], sourceName: '腾讯漫画', intro: '保留简介' }); f.entry.inBookshelf = true;
    f.entry.session = { contentKind: 'manga', identity: { sourceId: 'source', bookId: 'book-0' }, book: { title: 'Book 0', author: '' },
      entries: [{ index: 4, title: '01', url: '/4', variables: [] }], continuationVariables: [], sourceVersion: 'v1', catalogVersion: 'c1', contextVersion: 'x1' };
    return { f, finish(error) {
      assert.equal(typeof resolveMetadata, 'function', 'actual Host dispatched cached metadata IO');
      if (error !== undefined) rejectMetadata(error);
      else resolveMetadata({ data: { book: { origin: 'source', bookUrl: 'book-0', name: '已更新标题', acquisition: { sourceVersion: 'v1', catalogVersion: 'c1', contextVersion: 'x1', schemaVersion: 2, verificationCurrent: true } } } });
    } };
  };
  for (const mode of ['cold', 'updated', 'cleared']) {
    const { f, finish } = metadataFixture(); Manga.useOwner(f.control.runtime);
    if (mode !== 'cold') Manga.admitEntry('source', 'book-0', entry(books[0], { revision: 3, pageOrdinal: 0 }));
    f.hydrate([books[0]]); const metadata = f.actions.refreshDetailAcquisition();
    const next = entry(books[0], { revision: 4, pageOrdinal: 1, noProgress: mode === 'cleared' }); next.chapter.chapterTitle = '02'; next.chapter.totalPages = 24; next.chapter.chapterIndex = 5;
    if (next.progress.location !== null) { next.progress.location.chapter.chapterId = 'chapter-5'; next.chapter.manifest.chapter.chapterId = 'chapter-5'; }
    f.control.pending.shift().resolve(next); await tick(); const confirmed = Manga.get('source', 'book-0');
    assert.equal(f.entry.book.mangaPosition, confirmed); if (mode === 'cleared') assert.equal(confirmed, undefined); else assert.equal(confirmed.pageOrdinal, 1);
    finish(); await metadata; assert.equal(f.entry.book.mangaPosition, confirmed, `${mode}: late metadata preserves current confirmed/cleared manga facts`);
    assert.equal(f.entry.book.title, '已更新标题'); assert.equal(f.entry.book.intro, '保留简介'); assert.equal(f.entry.currentHost(f.control.runtime).snapshot().book, f.entry.book);
    assert.equal(f.entry.session.book.title, '已更新标题'); assert.equal(f.entry.book.contentKind, 'manga'); f.close();
  }
  for (const revoke of ['source', 'route', 'navigation', 'reading', 'unset', 'replacement']) for (const outcome of ['resolved', 'rejected']) {
    const { f, finish } = metadataFixture(), metadata = f.actions.refreshDetailAcquisition();
    if (revoke === 'source') f.entry.book = { ...f.entry.book, sourceId: 'other-source' };
    else if (revoke === 'route') f.show('bookshelf'); else if (revoke === 'navigation') f.advance();
    else if (revoke === 'reading') f.entry.sessionActive = true; else f.setRuntime(revoke === 'unset' ? undefined : {});
    const retained = f.entry.book, session = f.entry.session, message = f.entry.loadingMessage, owner = f.entry.host;
    finish(outcome === 'rejected' ? Error('private metadata https://fixture.invalid/?token=PRIVATE_TEST_TOKEN Cookie=PRIVATE_TEST_COOKIE') : undefined); await metadata;
    assert.equal(f.entry.book, retained, `${revoke}/${outcome}: stale metadata cannot replace detail`); assert.equal(f.entry.session, session); assert.equal(f.entry.loadingMessage, message);
    assert.equal(owner.snapshot().backgroundError, undefined); assert.doesNotMatch(JSON.stringify({ book: f.entry.book, message: f.entry.loadingMessage }), /PRIVATE_TEST|fixture\.invalid|Cookie=/); assert.notEqual(f.entry.book.title, '已更新标题'); f.close();
  }
  {
    const { f, finish } = metadataFixture(); f.entry.book = { ...f.entry.book, contentKind: 'text', mangaPosition: undefined }; f.entry.session = { ...f.entry.session, contentKind: 'text' };
    const metadata = f.actions.refreshDetailAcquisition(); finish(); await metadata; assert.equal(f.entry.book.contentKind, 'text'); assert.equal(f.entry.book.mangaPosition, undefined, 'novel metadata cannot fabricate manga facts'); f.close();
  }
}

async function caseRetainedDetailDirectorySdk() {
  const { mangaPositionOwnerFixture: create, readerDirectoryActions } = await fixtureModule();
  const { MangaBookPresentation: Manga } = await import('../entry/src/main/ets/features/manga/presentation/MangaBookPresentation.ts');
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { localBookDetailSdk } = await import('./lib/local-book-detail-sdk-probe.mjs');
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { EMPTY_READING_DIRECTORY_RECOVERY } = await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const { root: sdk } = installedEtsCompiler(), syntax = createRequire(import.meta.url)(sdk + '/lib/validate_ui_syntax.js');
  const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
  for (const name of ['ReadingEntryPresentation', 'BookshelfDetailPresentation', 'BookshelfMutationPresentation']) syntax.observedClassCollection.add(name);
  const p = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  const f = makeFixture(create, { runtime: { supportsCoreCapability: () => false }, observe: value => p.properties.sdk.ObservedObject.createNew(value, undefined) });
  detail(f, { ...books[0], sourceName: '腾讯漫画' }); f.entry.toc = [{ index: 4, title: '01' }, { index: 5, title: '02' }];
  f.hydrate([books[0]]); const first = f.control.pending.shift(), initial = entry(first, { pageOrdinal: 1 }); initial.chapter.chapterTitle = '01'; initial.chapter.totalPages = 36; first.resolve(initial); await tick();
  class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
  p.hooks.childSources.LocalBookDetail = read('features/reading/ui/LocalBookDetail.ets');
  p.hooks.childSources.BookDirectoryPage = read('features/reading/ui/BookDirectoryPage.ets');
  p.hooks.childSources.ReaderFullDirectory = read('features/reading/ui/ReaderFullDirectory.ets');
  const destinationSource = read('features/reading/ui/ReaderDirectoryDestination.ets'); p.hooks.childSources.ReaderDirectoryDestination = destinationSource;
  const Destination = createReaderBuilderProbe(destinationSource, boundedMembers(destinationSource), { ...p.deps, EMPTY_READING_DIRECTORY_RECOVERY, BookDirectoryPage: Child, ReaderFullDirectory: Child }, p.hooks).Component;
  const detailScene = p.consumer(read('features/bookshelf/ui/BookshelfDetailScene.ets'), undefined, { LocalBookDetail: Child, remoteContentVerdictLabel: () => '', SynchedPropertyNesedObjectPU: p.properties.sdk.SynchedPropertyNestedObjectPU }, {
    entry: f.entry, detail: p.properties.sdk.ObservedObject.createNew({ sourceSwitchEnabled: () => false, admission: () => ({ adding: false, cancelling: false }), message: () => '' }, undefined),
    mutations: p.properties.sdk.ObservedObject.createNew({ snapshot: { removalKey: '' } }, undefined), identity: 'same-book', foreground: false, directoryRetained: true,
  });
  const directoryScene = p.consumer(read('features/reading/ui/DetailDirectoryScene.ets'), undefined, { EMPTY_READING_DIRECTORY_RECOVERY, ReaderDirectoryDestination: Destination, readerDirectoryActions, SynchedPropertyNesedObjectPU: p.properties.sdk.SynchedPropertyNestedObjectPU }, { reading: f.entry, interactive: true });
  detailScene.aboutToAppear(); detailScene.initialRender(); directoryScene.initialRender();
  const detailChild = [...detailScene.children.values()].find(child => child.params.book), destination = [...directoryScene.children.values()].find(child => child instanceof Destination);
  assert.ok(detailChild); assert.ok(destination); const catalog = [...destination.children.values()].find(child => child.params.entries); assert.ok(catalog);
  const { owner: facts } = localBookDetailSdk({}, { initialParams: detailChild.params }); Object.assign(facts, { book: detailChild.params.book, appThemeScheme: 'day' }); facts.readingFacts();
  const updated = entry(books[0], { revision: 4, pageOrdinal: 1 }); updated.progress.location.chapter.chapterId = 'chapter-5'; updated.chapter.chapterIndex = 5; updated.chapter.chapterTitle = '02'; updated.chapter.totalPages = 24;
  Manga.admitEntry('source', 'book-0', updated); beginReader(f); f.exit.accepted(f.entry.readerPresentationIdentity());
  p.properties.flush(); detailScene.replay(); directoryScene.replay(); destination.replay();
  assert.equal(detailScene.children.get(detailChild.id), detailChild, 'actual current detail scene retains the same native child'); assert.equal(destination.children.get(catalog.id), catalog, 'catalog facts update retained child');
  assert.equal(detailChild.params.book.mangaPosition.chapterTitle, '02'); assert.deepEqual(Array.from(detailChild.params.toc, row => [row.index, row.title]), Array.from(f.entry.toc, row => [row.index, row.title]), 'current scene forwards canonical TOC values through SDK Prop copy');
  assert.equal(catalog.params.currentChapterIndex, 5); assert.equal(catalog.params.currentPageOrdinal, 1); assert.equal(catalog.params.currentPageTotal, 24);
  facts.book = detailChild.params.book; facts.replay(); const rendered = [...facts.nodes.values()].filter(node => node.type === 'Text').map(node => node.create);
  assert.ok(rendered.includes('02')); assert.ok(rendered.includes('2 / 24 页'));
  const PreviewRow = productionMotionMethods(new URL('../entry/src/main/ets/features/manga/ui/MangaDirectoryEntryRow.ets', import.meta.url), ['liveEntry', 'current']);
  const mounted = Object.assign(new PreviewRow(), { row: { entries: detailChild.params.toc }, currentChapterIndex: detailChild.params.book.mangaPosition.chapterIndex });
  assert.equal(mounted.current({ index: 4 }), false); assert.equal(mounted.current({ index: 5 }), true);
  f.control.pending.shift().resolve(updated); await tick(); f.close();
}

const implementations = { 'position-projection': casePositionProjection, 'metadata-concurrency': caseMetadataConcurrency, 'retained-detail-directory-sdk': caseRetainedDetailDirectorySdk };
for (const id of selectContractCases(CONTRACT_CASES)) { await implementations[id](); recordContractCasePass(id); }

import { localBookDetailSdk, localBookDetailSource } from './lib/local-book-detail-sdk-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { ProductionHost, currentRuntime, setRuntime } from './lib/reading-entry-owner-probe.mjs';
import { actualReadingEntryPresentation } from './lib/reading-entry-presentation-probe.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context); throw error; }
} });
const base = new URL('../entry/src/main/ets/', import.meta.url);
const { BookAcquisitionCoordinator } = await import(new URL('features/reading/application/BookAcquisitionCoordinator.ts', base));
const { ReaderNavigation } = await import(new URL('app/navigation/ReaderNavigation.ts', base));
const { ReaderLibraryAcquisitionBinding } = await import(new URL('app/composition/ReaderLibraryAcquisitionBinding.ts', base));
const evidence = await import(new URL('features/reading/application/RemoteReadingEvidence.ts', base));
const runtimeAuthority = { isCurrent: owner => owner !== undefined && owner === currentRuntime };
const emptyAdmission = { adding: false, cancelling: false, generation: 0, message: '' };
const indexFile = process.env.READER_DETAIL_PROJECTION_SOURCE ?? fileURLToPath(new URL('pages/Index.ets', base));
const indexSource = readFileSync(indexFile, 'utf8');
const detailSceneSource = readFileSync(new URL('features/bookshelf/ui/BookshelfDetailScene.ets', base), 'utf8');
const Index = selectedProductionMethods(indexFile, 'Index', [
  'currentReadingRuntime', 'bindReadingEntryReader', 'readingEntryActionPorts',
  'readingEntryPorts', 'returnToReadingOrigin', 'isCurrentRuntime', 'publishNavigation',
  'navigateTo', 'bookshelfModalVisible',
], { ReaderRuntimeOwner: runtimeAuthority, LOCAL_SOURCE_ID: 'local' });
const ReadingActions = selectedProductionMethods(new URL('app/composition/ReaderReadingEntryActions.ets', base),
  'ReaderReadingEntryActions', ['refreshDetailAcquisition']);
const DetailShelf = selectedProductionMethods(new URL('features/bookshelf/presentation/BookshelfDetailPresentation.ets', base),
  'BookshelfDetailPresentation', ['readingMembership', 'admission', 'key'], { EMPTY_READABLE_ADMISSION: emptyAdmission });
const ReaderExit = selectedProductionMethods(new URL('app/composition/ReaderExitActions.ts', base),
  'ReaderExitActions', ['completeReturn', 'navigationSettled']);
const ReadingEntry = actualReadingEntryPresentation({ ReadingEntryHost: ProductionHost });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const until = async condition => { for (let i = 0; i < 100; i++) { if (condition()) return; await pause(); } assert.fail('did not settle'); };
const now = Date.now();
const session = { identity: { sourceId: 'source', bookId: 'book' }, sourceVersion: 'v1', acquisitionMode: 'online',
  detailUrl: '/book', tocUrl: '/toc', catalogAt: now, catalogVersion: 'catalog', contextVersion: 'context',
  continuationVariables: [], hostRequirements: ['httpExecute'], requiresContextRefresh: false,
  book: { title: '书', author: '作者' }, entries: [{ index: 0, title: '第一章', url: '/chapter', variables: [] }] };
const body = { sourceId: 'source', bookId: 'book', chapterIndex: 0, chapterUrl: '/chapter', chapterTitle: '第一章',
  content: '阳光照进房间，书中的故事从这里开始。'.repeat(20), images: [], contentVersion: 'host-body',
  bodyVersion: 'body', processingVersion: 'processing', extractionVia: 'rule' };

function fixture() {
  const calls = [], verdicts = [], failures = [];
  let projectionGate, bodyGate, catalogGate, projectionOverride, projectionFailureOnce=false;
  const source = { sourceId: 'source', name: '书源', enabled: true, sourceVersion: 'v1' };
  const catalog = { sourceId: 'source', bookId: 'book', sourceVersion: 'v1', catalogVersion: 'catalog',
    contextVersion: 'context', catalogAt: now, tocAvailable: true, continuationVariables: {},
    chapters: [{ chapterIndex: 0, title: '第一章', url: '/chapter', variables: {}, state: 'cached' }] };
  const facts = { schemaVersion: 2, sourceVersion: 'v1', catalogVersion: 'catalog', contextVersion: 'context',
    catalogAt: now, catalogCount: 1, readableAt: now, verificationCurrent: true, stale: false };
  const coordinator = new BookAcquisitionCoordinator(async (method, params) => {
    calls.push(method);
    if (method === 'bookshelf.get') {
      const saved = page.shelfRead.snapshot.books.find(book => book.sourceId === params.sourceId && book.bookId === params.bookId);
      return { data: { book: saved ? { ...saved, addedAt: 1, sortIndex: 0 } : null } };
    }
    if (method === 'bookmark.list') return { data: { bookmarks: [] } };
    if (method === 'reading.progress.get') return { data: { found: false } };
    if (method === 'source.list') return { data: { sources: [{ ...source }] } };
    if (method === 'cache.book.status') {
      const snapshot = structuredClone(catalog);
      if (catalogGate) { const gate = catalogGate; catalogGate = undefined; await gate.promise; }
      return { data: snapshot };
    }
    if (method === 'search-book.get') {
      const fail = projectionFailureOnce; projectionFailureOnce = false;
      const snapshot = projectionOverride === undefined ? { origin: 'source', bookUrl: 'book', name: '书', author: '作者', acquisition: { ...facts } } : structuredClone(projectionOverride);
      if (projectionGate) { const gate = projectionGate; projectionGate = undefined; await gate.promise; }
      if (fail) throw Error('old cache read failed');
      return { data: { book: snapshot } };
    }
    if (method === 'chapter.content') {
      if (bodyGate) await bodyGate.promise;
      return { data: { sourceId: 'source', bookId: 'book', chapterTitle: '第一章', via: 'rule',
        content: body.content, bodyVersion: 'body', processingVersion: 'processing' } };
    }
    if (method === 'search-book.put') { facts.verificationCurrent = true; return { data: {} }; }
    if (['cache.book.prefetch', 'replace-rule.put', 'source.update'].includes(method)) return { data: {} };
    throw Error(`unexpected ${method}`);
  });
  const owner = { bookAcquisitions: () => coordinator, readingEntryPreparations: () => ({ setPaused() {} }),
    request: (...args) => coordinator.request(...args) };
  setRuntime(owner);
  const entry = Object.assign(new ReadingEntry(), {
    book: { ...session.identity, sourceName: '书源', title: '书', author: '作者' },
    toc: session.entries,
    inBookshelf: false,
  });
  const page = Object.assign(new Index(), {
    mountedRuntimeOwner: owner, shelfReceiptRetired: false, detailShelfAdmissionMount: 1,
    libraryAcquisition: new ReaderLibraryAcquisitionBinding(),
    navigationOwner: new ReaderNavigation(), readingEntry: entry, sourceSwitchPresentation: { visible: false },
    shelfRead: { snapshot: { books: [] } },
    shelfMutations: { snapshot: { generation: 0, removalKey: '', busy: false } },
    detailShelf: Object.assign(new DetailShelf(), { admissions: [], scope: {
      book: () => entry.book, mutations: () => page.shelfMutations, inBookshelf: () => entry.inBookshelf,
    } }),
    shelfGroupPresentation: { identity: '' },
    bookRemovalConfirmation: { dismiss() {} }, jsonImportPresentation: { dismiss() {} },
    shelfMotion: {
      returnToOrigin() { page.readingExitActions.completeReturn(); },
      resumeReturn() {},
    },
    refreshBookshelf() {},
    showReadingFailure: (title, message) => failures.push({ title, message }),
    chooseCachedChapterRefresh() { assert.fail('stale readmission must not require confirmation'); },
    nextNavigationGeneration() {
      this.readingEntry.retire();
      this.publishNavigation(this.navigationOwner.advance());
      return this.navigationGeneration;
    },
  });
  page.readingEntryActions = Object.assign(new ReadingActions(), {
    navigation: page.navigationOwner, ports: page.readingEntryActionPorts(),
  });
  page.readingExitActions = Object.assign(new ReaderExit(), { navigation: page.navigationOwner, ports: {
    entry: () => entry,
    runtime: () => page.currentReadingRuntime(),
    advance: () => page.nextNavigationGeneration(),
    publish: snapshot => page.publishNavigation(snapshot),
    bindReader: () => page.bindReadingEntryReader(),
    refreshDetail: () => { void page.readingEntryActions.refreshDetailAcquisition(); },
    refreshShelf: () => page.refreshBookshelf(),
    resumeReturnMotion: id => page.shelfMotion.resumeReturn(id),
  } });
  let verdict = entry.verdict;
  Object.defineProperty(entry, 'verdict', { get: () => verdict, set(value) { verdict = value; verdicts.push(value); } });
  page.navigateTo('search');
  page.navigationOwner.returns.beginDetailEntry(undefined);
  page.navigateTo(page.navigationOwner.returns.completeDetailEntry('search', undefined, false));
  const mountAcquisition = runtime => page.libraryAcquisition.mount(runtime, {
    ownsRuntime: runtimeAuthority.isCurrent, detailBook: () => entry.book,
    refreshShelf() {}, refreshMembership() {},
    refreshDetail: () => { void page.readingEntryActions.refreshDetailAcquisition(); },
  });
  mountAcquisition(owner);
  const installSession = session => entry.installSession(page.mountedRuntimeOwner, session, () => page.bindReadingEntryReader());
  installSession(evidence.withPreparedRemoteChapter(session, body, coordinator.readingProjectionRevision()));
  verdicts.length = 0;
  return { page, entry, installSession, coordinator, facts, calls, verdicts, source, catalog, failures, owner,
    get projectionActive() { return entry.host?.projectionActive; },
    get projectionPending() { return entry.host?.projectionPending; },
    setOwner(value) {
      setRuntime(value);
      if (value?.bookAcquisitions) { page.mountedRuntimeOwner = value; mountAcquisition(value); }
    },
    dispose() { page.libraryAcquisition.dispose(); coordinator.close(); },
    overrideProjection(value) { projectionOverride = value; },
    failProjectionOnce() { projectionFailureOnce = true; },
    gateProjection() { projectionGate = deferred(); return projectionGate; },
    gateCatalog() { catalogGate = deferred(); return catalogGate; },
    gateBody() { bodyGate = deferred(); return bodyGate; } };
}

{
  const f = fixture();
  try {
    const prepared = f.entry.session.preparedChapter;
    for (const route of ['detail', 'reading']) {
      f.page.navigateTo(route);
      if (route === 'reading') f.entry.startReading(f.owner);
      else f.entry.endReading(f.owner);
      for (const identity of [{ sourceId: 'unrelated', bookId: 'other' }, session.identity]) {
        await f.coordinator.request('cache.book.prefetch', identity);
        await until(() => f.projectionActive === undefined);
        assert.equal(f.coordinator.readingProjectionRevision(), 0, 'ordinary prefetch does not replace existing body projections');
        assert.equal(f.page.route, route, 'ordinary prefetch leaves the current route mounted');
        assert.equal(f.entry.sessionActive, route === 'reading');
        assert.equal(f.entry.session.preparedChapter, prepared, 'ordinary prefetch retains the validated chapter handoff');
        assert.ok(evidence.preparedRemoteChapterMatches(prepared, f.entry.session, undefined,
          f.coordinator.readingProjectionRevision()));
      }
    }
    f.page.returnToReadingOrigin(); await until(() => f.projectionActive === undefined);
    assert.ok(f.verdicts.every(value => value === 'readable'), 'Core-confirmed return cannot flash verifying');
    assert.equal(f.entry.session.preparedChapter, prepared, 'unchanged materialized body remains reusable on return');
    assert.equal(f.entry.verdict, 'readable');
    assert.equal(f.calls.filter(method => method === 'chapter.content').length, 0);
    for (let i = 0; i < 3; i++) await f.page.readingEntryActions.refreshDetailAcquisition();
    assert.ok(f.verdicts.every(value => value === 'readable'));

    f.facts.verificationCurrent = false;
    await f.coordinator.request('replace-rule.put', { id: 'rule' });
    assert.equal(f.coordinator.readingProjectionRevision(), 2, 'real processing mutation still changes both request boundaries');
    const gate = f.gateBody();
    const recheck = f.page.readingEntryActions.refreshDetailAcquisition();
    await until(() => f.calls.includes('chapter.content'));
    assert.equal(f.entry.verdict, 'verifying', 'changed processing cannot keep old readability');
    const queued = [f.page.readingEntryActions.refreshDetailAcquisition(), f.page.readingEntryActions.refreshDetailAcquisition()];
    gate.resolve(); await recheck; await Promise.all(queued); await until(() => f.projectionActive === undefined);
    assert.equal(f.entry.verdict, 'readable');
    assert.equal(f.calls.filter(method => method === 'chapter.content').length, 1, 'duplicate metadata notifications share one body probe');
    assert.equal(f.entry.session.preparedChapter.projectionRevision, 2);
  } finally { f.dispose(); }
}

for (const inShelf of [false, true]) {
  const f = fixture();
  try {
    const shelf = { ...f.entry.book, currentChapterIndex: 0, currentChapterOffset: 17 };
    if (inShelf) f.page.shelfRead.snapshot.books = [shelf];
    const gate = f.gateProjection(); const pending = f.page.readingEntryActions.refreshDetailAcquisition();
    await until(() => f.calls.includes('search-book.get'));
    f.source.enabled = false;
    await f.coordinator.request('source.update', { sourceId: 'source' });
    f.facts.stale = true;
    const bodyGate = f.gateBody();
    gate.resolve(); await pending; // The domain owns readmission through the accepted body probe.
    await until(() => f.calls.includes('chapter.content'));
    assert.equal(f.entry.verdict, 'verifying', 'stale evidence launches cache-first admission automatically');
    assert.equal(f.entry.session.preparedChapter, undefined);
    assert.ok(f.calls.filter(method => method === 'search-book.get').length >= 2, 'mutation rejects and rereads the old snapshot');
    const generation = f.page.navigationGeneration;
    for (let i = 0; i < 3; i++) { await pause(); await f.page.readingEntryActions.refreshDetailAcquisition(); }
    assert.equal(f.page.navigationGeneration, generation, 'repeated stale notifications cannot restart an in-flight body admission');
    assert.equal(f.calls.filter(method => method === 'chapter.content').length, 1);
    bodyGate.resolve(); await until(() => f.entry.verdict === 'readable');
    assert.equal(f.entry.session.acquisitionMode, 'offline', 'disabled source retains downloaded bodies');
    assert.equal(f.page.navigationOwner.returns.snapshot().detailParent, 'search');
    assert.equal(f.entry.inBookshelf, inShelf, 'readmission preserves real shelf membership');
    if (inShelf) assert.equal(f.page.shelfRead.snapshot.books[0], shelf, 'shelf progress snapshot remains untouched');
    assert.deepEqual(f.failures, []);
    for (let i = 0; i < 3; i++) await f.page.readingEntryActions.refreshDetailAcquisition();
    assert.equal(f.page.navigationGeneration, generation, 'completed offline admission does not loop on stale catalog facts');
    assert.equal(f.calls.filter(method => method === 'chapter.content').length, 1);
  } finally { f.dispose(); }
}

{
  const f = fixture();
  try {
    f.source.enabled = false; f.catalog.tocAvailable = false; f.facts.stale = true;
    await f.coordinator.request('source.update', { sourceId: 'source' });
    await f.page.readingEntryActions.refreshDetailAcquisition();
    await until(() => f.entry.loadingMessage.length > 0 && !ProductionHost.forRuntime(f.page.mountedRuntimeOwner).snapshot().candidateAdmissionActive);
    assert.notEqual(f.entry.verdict, 'verifying', 'missing offline cache reaches the existing failure/retry state');
    assert.equal(f.page.route, 'detail'); assert.equal(f.page.navigationOwner.returns.snapshot().detailParent, 'search');
    const generation = f.page.navigationGeneration;
    for (let i = 0; i < 3; i++) await f.page.readingEntryActions.refreshDetailAcquisition();
    assert.equal(f.page.navigationGeneration, generation, 'terminal readmission failure is not retried by metadata notifications');
    assert.equal(f.failures.length, 0, 'failed preview stays readable without a modal');
  } finally { f.dispose(); }
}

for (const mismatch of [undefined, 'sourceVersion', 'catalogVersion', 'contextVersion']) {
  const f = fixture();
  try {
    f.facts.catalogVersion = 'catalog-new'; f.facts.contextVersion = 'context-new';
    Object.assign(f.catalog, { catalogVersion: 'catalog-new', contextVersion: 'context-new' });
    if (mismatch) f.catalog[mismatch] = `${f.catalog[mismatch]}-mismatch`;
    await f.coordinator.request('cache.book.prefetch', { sourceId: 'unrelated', bookId: 'other' });
    const oldBody = f.entry.session.preparedChapter;
    await f.page.readingEntryActions.refreshDetailAcquisition();
    if (mismatch) {
      assert.ok(f.verdicts.includes('verifying'), `mismatched ${mismatch} must revalidate the body`);
      assert.equal(f.calls.filter(method => method === 'chapter.content').length, 1);
    } else {
      assert.ok(f.verdicts.length > 0 && f.verdicts.every(value => value === 'readable'), 'exact new catalog evidence preserves the gate without flashing');
      assert.equal(f.calls.filter(method => method === 'chapter.content').length, 0);
      assert.equal(f.entry.session.preparedChapter, undefined, 'old body is not attached to the new catalog');
    }
    assert.notEqual(f.entry.session.preparedChapter, oldBody);
  } finally { f.dispose(); }
}

{
  const f = fixture();
  try {
    f.facts.catalogVersion = 'catalog-new'; f.facts.contextVersion = 'context-new';
    Object.assign(f.catalog, { catalogVersion: 'catalog-new', contextVersion: 'context-new' });
    const gate = f.gateCatalog(); const pending = f.page.readingEntryActions.refreshDetailAcquisition();
    await until(() => f.calls.includes('cache.book.status'));
    f.facts.verificationCurrent = false;
    await f.coordinator.request('replace-rule.put', { id: 'rule' });
    gate.resolve(); await pending; await until(() => f.projectionActive === undefined);
    assert.ok(f.calls.filter(method => method === 'search-book.get').length >= 2, 'catalog read racing a mutation rereads Core facts');
    assert.equal(f.calls.filter(method => method === 'chapter.content').length, 1, 'raced verification cannot retain the old gate');
  } finally { f.dispose(); }
}
console.log('PASS production ReadingEntryActions + Index lease + actual Coordinator/Gateway: stable return/new catalog, exact evidence negatives, source/processing races, delayed offline readmission. No device pixel claim.');

// Actual typed Core read -> production Index and detail scene -> SDK hero consumer.
class DetailChild { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
class CoverChild extends DetailChild {}
function detailSdk(f) {
  const properties = createArkUIPropertyRuntimeProbe();
  const parent = createReaderBuilderProbe(indexSource, [
    'detailScenePorts', 'detailContentIsForeground', 'isDetailDirectoryRoute',
    'isCurrentDetailPresentation', 'isCurrentRuntime',
  ], { ReaderRuntimeOwner: runtimeAuthority }).owner;
  Object.assign(parent, {
    readingEntry: f.entry, route: f.page.route, directoryReturnTarget: f.page.directoryReturnTarget,
    mountedRuntimeOwner: f.page.mountedRuntimeOwner,
    sourceSwitchPresentation: { visible: false }, mangaSourceSwitch: { selectionVisible: false },
    detailShelf: {
      identity: () => 'detail-book', sourceSwitchEnabled: () => true, mutationEnabled: () => false,
      admission: () => emptyAdmission, message: () => '', isCurrent: () => true,
    },
  });
  const scene = createReaderBuilderProbe(detailSceneSource, ['build', 'detailSurface'], {
    ...properties.sdk, LocalBookDetail: DetailChild, remoteContentVerdictLabel: () => '',
  }, { ...properties.hooks, childSources: { LocalBookDetail: localBookDetailSource } }).owner;
  Object.assign(scene, {
    entry: parent.readingEntry, detail: parent.detailShelf, mutations: { snapshot: { removalKey: '' } },
    identity: parent.detailShelf.identity(), foreground: parent.detailContentIsForeground(),
    directoryRetained: parent.isDetailDirectoryRoute(), mutationEnabled: parent.detailShelf.mutationEnabled(),
    ports: parent.detailScenePorts(),
  });
  scene.initialRender();
  const detail = [...scene.children.values()].find(child => child instanceof DetailChild);
  assert.ok(detail, 'production detail scene mounts a native child');
  const props = detail.params;
  const child = localBookDetailSdk({ NoCoverCover: CoverChild }, { initialParams: props }).owner;
  Object.assign(child, { appThemeScheme: 'day', contentWidth: () => 352 });
  child.hero();
  return { props, texts: [...child.nodes.values()].filter(node => node.type === 'Text').map(node => node.create) };
}
for (const invalid of [null, [], { origin: 'other', bookUrl: 'book' }, { origin: 'source', bookUrl: 'other' },
  { bookUrl: 'book' }, { origin: 'source', bookUrl: 'book', name: 3 },
  { origin: 'source', bookUrl: 'book', acquisition: [] },
  { origin: 'source', bookUrl: 'book', acquisition: { verificationCurrent: 'true' } },
  { origin: 'source', bookUrl: 'book', acquisition: { catalogAt: -1 } },
  { origin: 'source', bookUrl: 'book', acquisition: { schemaVersion: 2.5 } }]) {
  const f = fixture();
  try {
    const oldBook = f.entry.book, oldSession = f.entry.session;
    f.overrideProjection(invalid); await f.page.readingEntryActions.refreshDetailAcquisition();
    assert.equal(f.entry.book, oldBook, 'wrong/absent/malformed data cannot replace admitted detail');
    assert.equal(f.entry.session, oldSession); assert.equal(f.calls.filter(m => m === 'chapter.content').length, 0);
    assert.equal(detailSdk(f).props.book, oldBook, 'real SDK detail consumer retains the exact admitted book');
    assert.equal(f.projectionActive, undefined);
  } finally { f.dispose(); }
}
{
  const f = fixture(); try {
    f.overrideProjection({ origin: 'source', bookUrl: 'book', name: '新标题', author: '新作者', acquisition: { ...f.facts } });
    await f.page.readingEntryActions.refreshDetailAcquisition();
    const actual = detailSdk(f);
    assert.equal(actual.props.book.title, '新标题'); assert.ok(actual.texts.includes('新标题'));
    assert.ok(actual.texts.includes('新作者')); assert.equal(actual.props.readingEnabled, true);
  } finally { f.dispose(); }
}
for (const retire of ['runtime-unset', 'runtime-replacement', 'navigation', 'entity', 'session']) {
  const f = fixture(); try {
    const oldBook = f.entry.book, oldSession = f.entry.session;
    f.overrideProjection({ origin: 'source', bookUrl: 'book', name: '迟到标题', acquisition: { ...f.facts } });
    const gate = f.gateProjection(), pending = f.page.readingEntryActions.refreshDetailAcquisition();
    await until(() => f.calls.includes('search-book.get'));
    await f.page.readingEntryActions.refreshDetailAcquisition();
    assert.ok(f.projectionPending, 'capture an actual pending original lease before retirement');
    if (retire === 'runtime-unset') f.setOwner(undefined);
    if (retire === 'runtime-replacement') f.setOwner({});
    if (retire === 'navigation') f.page.publishNavigation(f.page.navigationOwner.advance());
    if (retire === 'entity') { f.entry.book = { ...oldBook, bookId: 'replacement' }; f.entry.session=undefined; f.page.bindReadingEntryReader(); }
    if (retire === 'session') { f.installSession(undefined); f.installSession(oldSession); }
    const expected = f.entry.book;
    gate.resolve(); await assert.doesNotReject(pending); await pause();
    assert.equal(f.entry.book, expected); assert.equal(f.entry.session, retire==='entity'?undefined:oldSession);
    assert.equal(ProductionHost.shared?.projectionActive, undefined);
    if (retire.startsWith('runtime')) assert.equal(f.calls.filter(m => m === 'search-book.get').length, 1, 'old owner cannot reacquire a new Runtime for a queued rerun');
  } finally { f.dispose(); }
}
console.log('PASS strict typed cache -> exact Runtime/navigation/session/entity Index -> actual SDK Detail/hero: legal metadata, malformed/partial/wrong identity retention, absent/replacement owner and late coalesced replies');

for (const failedOld of [false, true]) for (const replacement of ['navigation', 'runtime']) {
  const f = fixture(); try {
    if (failedOld) f.failProjectionOnce();
    const gate = f.gateProjection(), old = f.page.readingEntryActions.refreshDetailAcquisition();
    await until(() => f.calls.includes('search-book.get'));
    const oldHost=f.entry.host;
    if (replacement === 'runtime') f.setOwner({ ...f.owner });
    else {
      f.page.publishNavigation(f.page.navigationOwner.advance());
      f.entry.book = { ...f.entry.book, bookId: 'second', title: '第二本' };
      f.entry.session = { ...f.entry.session, identity: { sourceId: 'source', bookId: 'second' }, preparedChapter: undefined };
    }
    f.page.bindReadingEntryReader();
    f.overrideProjection({ origin: 'source', bookUrl: f.entry.book.bookId, name: '新意图标题', acquisition: { ...f.facts } });
    const secondGate=f.gateProjection();
    const newRead=f.page.readingEntryActions.refreshDetailAcquisition();
    if(replacement==='navigation') await newRead;
    const pending = f.projectionPending ?? f.projectionActive;
    assert.ok(pending, 'new call captures its own full lease while old IO remains active');
    if (replacement === 'runtime') { assert.notEqual(f.entry.host,oldHost); assert.equal(oldHost.owns(f.owner),true); }
    gate.resolve(); await old;
    await until(() => f.calls.filter(m => m === 'search-book.get').length === 2);
    assert.equal(f.projectionActive.lease, pending.lease);assert.equal(f.projectionActive.scopeId,pending.scopeId); assert.ok(f.projectionActive, 'old finally cannot clear the freshly started active lease');
    secondGate.resolve(); await newRead; await until(() => f.projectionActive === undefined);
    assert.equal(f.entry.book.title, '新意图标题'); assert.ok(detailSdk(f).texts.includes('新意图标题'));
    assert.equal(f.projectionPending, undefined); assert.equal(f.projectionActive, undefined);
  } finally { f.dispose(); }
}
for (const retiredPending of ['navigation', 'runtime-unset', 'entity']) {
  const f = fixture(); try {
    const gate = f.gateProjection(), old = f.page.readingEntryActions.refreshDetailAcquisition();
    await until(() => f.calls.includes('search-book.get'));
    f.page.publishNavigation(f.page.navigationOwner.advance()); f.page.bindReadingEntryReader();
    await f.page.readingEntryActions.refreshDetailAcquisition(); assert.ok(f.projectionPending);
    if (retiredPending === 'navigation') f.page.publishNavigation(f.page.navigationOwner.advance());
    if (retiredPending === 'runtime-unset') f.setOwner(undefined);
    if (retiredPending === 'entity') { f.entry.book = { ...f.entry.book, bookId: 'third' }; f.entry.session=undefined;f.page.bindReadingEntryReader(); }
    const expected = f.entry.book; gate.resolve(); await old; await pause();
    assert.equal(f.calls.filter(m => m === 'search-book.get').length, 1, 'already retired pending intent cannot drain');
    assert.equal(f.entry.book, expected); assert.equal(f.projectionActive, undefined);
  } finally { f.dispose(); }
}
console.log('PASS latest captured Detail intent: A to B, exact replacement Runtime, old success/failure, deferred drain, new lease busy ownership, retired pending intent rejection');

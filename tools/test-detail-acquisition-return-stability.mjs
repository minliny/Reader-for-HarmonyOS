import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context); throw error; }
} });
const base = new URL('../entry/src/main/ets/', import.meta.url);
const { BookAcquisitionCoordinator } = await import(new URL('app/BookAcquisitionCoordinator.ts', base));
const { RemoteReadingFlowGateway, RemoteChapterCacheRefreshError } = await import(new URL('features/reading/RemoteReadingFlowGateway.ts', base));
const evidence = await import(new URL('features/reading/RemoteReadingEvidence.ts', base));
const { captureRemotePositionContext } = await import(new URL('features/reading/RemoteReadingPositionMigration.ts', base));
const { RemoteReadingGatewayError, remoteReadingFailureRecord } = await import(new URL('features/reading/RemoteReadingContract.ts', base));
const { remoteReadingFailureKindOf, verdictForFailureKind } = await import(new URL('features/reading/RemoteContentAdmission.ts', base));
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
  let projectionGate, bodyGate, catalogGate;
  const source = { sourceId: 'source', name: '书源', enabled: true, sourceVersion: 'v1' };
  const catalog = { sourceId: 'source', bookId: 'book', sourceVersion: 'v1', catalogVersion: 'catalog',
    contextVersion: 'context', catalogAt: now, tocAvailable: true, continuationVariables: {},
    chapters: [{ chapterIndex: 0, title: '第一章', url: '/chapter', variables: {}, state: 'cached' }] };
  const facts = { schemaVersion: 2, sourceVersion: 'v1', catalogVersion: 'catalog', contextVersion: 'context',
    catalogAt: now, catalogCount: 1, readableAt: now, verificationCurrent: true, stale: false };
  const coordinator = new BookAcquisitionCoordinator(async (method, params) => {
    calls.push(method);
    if (method === 'source.list') return { data: { sources: [{ ...source }] } };
    if (method === 'cache.book.status') {
      const snapshot = structuredClone(catalog);
      if (catalogGate) { const gate = catalogGate; catalogGate = undefined; await gate.promise; }
      return { data: snapshot };
    }
    if (method === 'search-book.get') {
      const snapshot = { ...facts };
      if (projectionGate) { const gate = projectionGate; projectionGate = undefined; await gate.promise; }
      return { data: { book: { origin: 'source', bookUrl: 'book', name: '书', author: '作者', acquisition: snapshot } } };
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
  const owner = { bookAcquisitions: () => coordinator, request: (...args) => coordinator.request(...args) };
  const Index = productionMotionMethods(process.env.READER_DETAIL_PROJECTION_SOURCE ?? fileURLToPath(new URL('pages/Index.ets', base)),
    ['refreshDetailAcquisitionProjection', 'installRemoteReadingSession', 'returnToReadingOrigin', 'probeRemoteContentVerdict',
      'openRemoteBookDetail', 'readingDetailForRemoteSeed'], {
      ...evidence, ReaderRuntimeOwner: { current: () => owner }, LOCAL_SOURCE_ID: 'local',
      RemoteReadingFlowGateway, RemoteChapterCacheRefreshError, remoteReadingFailureKindOf, verdictForFailureKind,
      captureRemotePositionContext, RemoteReadingGatewayError, remoteReadingFailureRecord,
      ReadingOfflineGateway: class {}, ReaderCoreGateway: class { async loadShelfBook() { return undefined; } },
      RemoteDetailAdmission: class { constructor(session, backgroundRefresh) {
        Object.assign(this, { session, backgroundRefresh, refreshInBackground: backgroundRefresh !== undefined });
      } }, hilog: { info() {}, warn() {}, error() {} }, DOMAIN: 0,
    });
  const page = Object.assign(new Index(), { detailBook: { sourceId: 'source', sourceName: '书源', bookId: 'book', title: '书', author: '作者' },
    detailToc: session.entries, remoteSessionGeneration: 0, remoteContentProbeGeneration: 0,
    remoteReadabilityProjectionRevision: -1, navigationGeneration: 1, route: 'detail', readingOriginRoute: 'detail',
    readingSessionActive: false, sourceSwitchVisible: false, bookProjectionLoading: false, bookProjectionAgain: false,
    candidateAdmissionGeneration: -1, candidateAdmissionFailedGeneration: -1,
    shelfBooks: [], searchDetailCandidates: [], detailReturnRoute: 'search', remoteCatalogRefreshAt: new Map(),
    offlineMutationGeneration: 0, bookshelfRemovalActiveKey: '', directoryBookmarkMutationGeneration: 0,
    loadRemoteDirectoryProjection: async (_offline, _owner, session) => session.entries,
    showReadingFailure: (title, message) => failures.push({ title, message }),
    getUIContext() { assert.fail('stale readmission must not require confirmation'); },
    nextNavigationGeneration() { this.remoteContentProbeGeneration++; return ++this.navigationGeneration; },
  });
  let verdict = 'verifying';
  Object.defineProperty(page, 'remoteContentVerdict', { get: () => verdict, set(value) { verdict = value; verdicts.push(value); } });
  page.installRemoteReadingSession(evidence.withPreparedRemoteChapter(session, body, coordinator.readingProjectionRevision()));
  verdicts.length = 0;
  coordinator.subscribe(change => {
    if (change.reset || change.identities.some(id => id.sourceId === 'source' && id.bookId === 'book')) void page.refreshDetailAcquisitionProjection();
  });
  return { page, coordinator, facts, calls, verdicts, source, catalog, failures,
    gateProjection() { projectionGate = deferred(); return projectionGate; },
    gateCatalog() { catalogGate = deferred(); return catalogGate; },
    gateBody() { bodyGate = deferred(); return bodyGate; } };
}

{
  const f = fixture();
  try {
    const prepared = f.page.remoteReadingSession.preparedChapter;
    for (const route of ['detail', 'reading']) {
      f.page.route = route; f.page.readingSessionActive = route === 'reading';
      for (const identity of [{ sourceId: 'unrelated', bookId: 'other' }, session.identity]) {
        await f.coordinator.request('cache.book.prefetch', identity);
        await until(() => !f.page.bookProjectionLoading);
        assert.equal(f.coordinator.readingProjectionRevision(), 0, 'ordinary prefetch does not replace existing body projections');
        assert.equal(f.page.route, route, 'ordinary prefetch leaves the current route mounted');
        assert.equal(f.page.readingSessionActive, route === 'reading');
        assert.equal(f.page.remoteReadingSession.preparedChapter, prepared, 'ordinary prefetch retains the validated chapter handoff');
        assert.ok(evidence.preparedRemoteChapterMatches(prepared, f.page.remoteReadingSession, undefined,
          f.coordinator.readingProjectionRevision()));
      }
    }
    f.page.returnToReadingOrigin(); await until(() => !f.page.bookProjectionLoading);
    assert.ok(f.verdicts.every(value => value === 'readable'), 'Core-confirmed return cannot flash verifying');
    assert.equal(f.page.remoteReadingSession.preparedChapter, prepared, 'unchanged materialized body remains reusable on return');
    assert.equal(f.page.remoteContentVerdict, 'readable');
    assert.equal(f.calls.filter(method => method === 'chapter.content').length, 0);
    for (let i = 0; i < 3; i++) await f.page.refreshDetailAcquisitionProjection();
    assert.ok(f.verdicts.every(value => value === 'readable'));

    f.facts.verificationCurrent = false;
    await f.coordinator.request('replace-rule.put', { id: 'rule' });
    assert.equal(f.coordinator.readingProjectionRevision(), 2, 'real processing mutation still changes both request boundaries');
    const gate = f.gateBody();
    const recheck = f.page.refreshDetailAcquisitionProjection();
    await until(() => f.calls.includes('chapter.content'));
    assert.equal(f.page.remoteContentVerdict, 'verifying', 'changed processing cannot keep old readability');
    const queued = [f.page.refreshDetailAcquisitionProjection(), f.page.refreshDetailAcquisitionProjection()];
    gate.resolve(); await recheck; await Promise.all(queued); await until(() => !f.page.bookProjectionLoading);
    assert.equal(f.page.remoteContentVerdict, 'readable');
    assert.equal(f.calls.filter(method => method === 'chapter.content').length, 1, 'duplicate metadata notifications share one body probe');
    assert.equal(f.page.remoteReadingSession.preparedChapter.projectionRevision, 2);
  } finally { f.coordinator.close(); }
}

for (const inShelf of [false, true]) {
  const f = fixture();
  try {
    const shelf = { ...f.page.detailBook, currentChapterIndex: 0, currentChapterOffset: 17 };
    if (inShelf) f.page.shelfBooks = [shelf];
    const gate = f.gateProjection(); const pending = f.page.refreshDetailAcquisitionProjection();
    await until(() => f.calls.includes('search-book.get'));
    f.source.enabled = false;
    await f.coordinator.request('source.update', { sourceId: 'source' });
    f.facts.stale = true;
    const bodyGate = f.gateBody();
    gate.resolve(); await pending; await until(() => !f.page.bookProjectionLoading);
    await until(() => f.calls.includes('chapter.content'));
    assert.equal(f.page.remoteContentVerdict, 'verifying', 'stale evidence launches cache-first admission automatically');
    assert.equal(f.page.remoteReadingSession.preparedChapter, undefined);
    assert.ok(f.calls.filter(method => method === 'search-book.get').length >= 2, 'mutation rejects and rereads the old snapshot');
    const generation = f.page.navigationGeneration;
    for (let i = 0; i < 3; i++) { await pause(); await f.page.refreshDetailAcquisitionProjection(); }
    assert.equal(f.page.navigationGeneration, generation, 'repeated stale notifications cannot restart an in-flight body admission');
    assert.equal(f.calls.filter(method => method === 'chapter.content').length, 1);
    bodyGate.resolve(); await until(() => f.page.remoteContentVerdict === 'readable');
    assert.equal(f.page.remoteReadingSession.acquisitionMode, 'offline', 'disabled source retains downloaded bodies');
    assert.equal(f.page.detailReturnRoute, 'search');
    assert.equal(f.page.detailInBookshelf, inShelf, 'readmission preserves real shelf membership');
    if (inShelf) assert.equal(f.page.shelfBooks[0], shelf, 'shelf progress snapshot remains untouched');
    assert.deepEqual(f.failures, []);
    for (let i = 0; i < 3; i++) await f.page.refreshDetailAcquisitionProjection();
    assert.equal(f.page.navigationGeneration, generation, 'completed offline admission does not loop on stale catalog facts');
    assert.equal(f.calls.filter(method => method === 'chapter.content').length, 1);
  } finally { f.coordinator.close(); }
}

{
  const f = fixture();
  try {
    f.source.enabled = false; f.catalog.tocAvailable = false; f.facts.stale = true;
    await f.coordinator.request('source.update', { sourceId: 'source' });
    await f.page.refreshDetailAcquisitionProjection();
    await until(() => f.page.detailLoadingMessage.length > 0 && f.page.candidateAdmissionGeneration === -1);
    assert.notEqual(f.page.remoteContentVerdict, 'verifying', 'missing offline cache reaches the existing failure/retry state');
    assert.equal(f.page.route, 'detail'); assert.equal(f.page.detailReturnRoute, 'search');
    const generation = f.page.navigationGeneration;
    for (let i = 0; i < 3; i++) await f.page.refreshDetailAcquisitionProjection();
    assert.equal(f.page.navigationGeneration, generation, 'terminal readmission failure is not retried by metadata notifications');
    assert.equal(f.failures.length, 0, 'failed preview stays readable without a modal');
  } finally { f.coordinator.close(); }
}

for (const mismatch of [undefined, 'sourceVersion', 'catalogVersion', 'contextVersion']) {
  const f = fixture();
  try {
    f.facts.catalogVersion = 'catalog-new'; f.facts.contextVersion = 'context-new';
    Object.assign(f.catalog, { catalogVersion: 'catalog-new', contextVersion: 'context-new' });
    if (mismatch) f.catalog[mismatch] = `${f.catalog[mismatch]}-mismatch`;
    await f.coordinator.request('cache.book.prefetch', { sourceId: 'unrelated', bookId: 'other' });
    const oldBody = f.page.remoteReadingSession.preparedChapter;
    await f.page.refreshDetailAcquisitionProjection();
    if (mismatch) {
      assert.ok(f.verdicts.includes('verifying'), `mismatched ${mismatch} must revalidate the body`);
      assert.equal(f.calls.filter(method => method === 'chapter.content').length, 1);
    } else {
      assert.ok(f.verdicts.length > 0 && f.verdicts.every(value => value === 'readable'), 'exact new catalog evidence preserves the gate without flashing');
      assert.equal(f.calls.filter(method => method === 'chapter.content').length, 0);
      assert.equal(f.page.remoteReadingSession.preparedChapter, undefined, 'old body is not attached to the new catalog');
    }
    assert.notEqual(f.page.remoteReadingSession.preparedChapter, oldBody);
  } finally { f.coordinator.close(); }
}

{
  const f = fixture();
  try {
    f.facts.catalogVersion = 'catalog-new'; f.facts.contextVersion = 'context-new';
    Object.assign(f.catalog, { catalogVersion: 'catalog-new', contextVersion: 'context-new' });
    const gate = f.gateCatalog(); const pending = f.page.refreshDetailAcquisitionProjection();
    await until(() => f.calls.includes('cache.book.status'));
    f.facts.verificationCurrent = false;
    await f.coordinator.request('replace-rule.put', { id: 'rule' });
    gate.resolve(); await pending; await until(() => !f.page.bookProjectionLoading);
    assert.ok(f.calls.filter(method => method === 'search-book.get').length >= 2, 'catalog read racing a mutation rereads Core facts');
    assert.equal(f.calls.filter(method => method === 'chapter.content').length, 1, 'raced verification cannot retain the old gate');
  } finally { f.coordinator.close(); }
}
console.log('PASS production Index + actual Coordinator/Gateway: stable return/new catalog, exact evidence negatives, source/processing races, delayed offline readmission. No device pixel claim.');

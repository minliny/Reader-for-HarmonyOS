import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import {localBookDetailSdk} from './lib/local-book-detail-sdk-probe.mjs';
import { ProductionHost, setRuntime } from './lib/reading-entry-owner-probe.mjs';
import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context); throw error; }
} });
const base = new URL('../entry/src/main/ets/', import.meta.url);
const { BookAcquisitionProjectionGateway } = await import(new URL('app/BookAcquisitionProjectionGateway.ts', base));
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
  let projectionGate, bodyGate, catalogGate, projectionOverride, projectionFailureOnce=false;
  let installedOwner;
  const source = { sourceId: 'source', name: '书源', enabled: true, sourceVersion: 'v1' };
  const catalog = { sourceId: 'source', bookId: 'book', sourceVersion: 'v1', catalogVersion: 'catalog',
    contextVersion: 'context', catalogAt: now, tocAvailable: true, continuationVariables: {},
    chapters: [{ chapterIndex: 0, title: '第一章', url: '/chapter', variables: {}, state: 'cached' }] };
  const facts = { schemaVersion: 2, sourceVersion: 'v1', catalogVersion: 'catalog', contextVersion: 'context',
    catalogAt: now, catalogCount: 1, readableAt: now, verificationCurrent: true, stale: false };
  const coordinator = new BookAcquisitionCoordinator(async (method, params) => {
    calls.push(method);
    if (method === 'bookshelf.get') { const saved=page.shelfBooks.find(book => book.sourceId === params.sourceId && book.bookId === params.bookId); return { data: { book:saved?{...saved,addedAt:1,sortIndex:0}:null } }; }
    if (method === 'bookmark.list') return {data:{bookmarks:[]}};
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
  const owner = { bookAcquisitions: () => coordinator, request: (...args) => coordinator.request(...args) };
  installedOwner = owner; setRuntime(owner);
  const authority = { current: () => { if (installedOwner === undefined) throw Error('Runtime unavailable'); return installedOwner; } };
  const Index = productionMotionMethods(process.env.READER_DETAIL_PROJECTION_SOURCE ?? fileURLToPath(new URL('pages/Index.ets', base)),
    ['refreshDetailAcquisitionProjection', 'installRemoteReadingSession', 'returnToReadingOrigin', 'probeRemoteContentVerdict',
      'openRemoteBookDetail', 'readingDetailForRemoteSeed'], {
      ...evidence, BookAcquisitionProjectionGateway, ReaderRuntimeOwner: authority, ReadingEntryHost: ProductionHost, EMPTY_READABLE_ADMISSION:{adding:false,cancelling:false,generation:0}, LOCAL_SOURCE_ID: 'local',
      RemoteReadingFlowGateway, RemoteChapterCacheRefreshError, remoteReadingFailureKindOf, verdictForFailureKind,
      captureRemotePositionContext, RemoteReadingGatewayError, remoteReadingFailureRecord,
      hilog: { info() {}, warn() {}, error() {} }, DOMAIN: 0,
    });
  const page = Object.assign(new Index(), { mountedRuntimeOwner:owner,shelfReceiptRetired:false,detailShelfAdmissionMount:1,readingEntryScopeId:-1,detailReadableAdmission:()=>({adding:false,cancelling:false,generation:0}),detailBook: { sourceId: 'source', sourceName: '书源', bookId: 'book', title: '书', author: '作者' },
    detailToc: session.entries, remoteSessionGeneration: 0, remoteContentProbeGeneration: 0,
    remoteReadabilityProjectionRevision: -1, navigationGeneration: 1, route: 'detail', readingOriginRoute: 'detail',
    readingSessionActive: false, sourceSwitchVisible: false,
    shelfBooks: [], searchDetailCandidates: [], detailReturnRoute: 'search', remoteCatalogRefreshAt: new Map(),
    offlineMutationGeneration: 0, shelfOperation: {generation:0,removalKey:'',busy:false,batchRemovalBusy:false}, directoryBookmarkMutationGeneration: 0,
    bookshelfHost: { loadShelfBook: async () => undefined },
    showReadingFailure: (title, message) => failures.push({ title, message }),
    getUIContext() { assert.fail('stale readmission must not require confirmation'); },
    nextNavigationGeneration() { this.remoteContentProbeGeneration++; return ++this.navigationGeneration; },
  });
  // Compatibility observations read the actual domain's queue; no page producer is simulated.
  for (const [alias,key] of [['bookProjectionLoading','projectionActive'],['bookProjectionActive','projectionActive'],['bookProjectionPending','projectionPending']]) Object.defineProperty(page,alias,{get:()=>alias==='bookProjectionLoading'?page.readingEntryHost?.[key]!==undefined:page.readingEntryHost?.[key]});
  let verdict = 'verifying';
  Object.defineProperty(page, 'remoteContentVerdict', { get: () => verdict, set(value) { verdict = value; verdicts.push(value); } });
  page.installRemoteReadingSession(evidence.withPreparedRemoteChapter(session, body, coordinator.readingProjectionRevision()));
  verdicts.length = 0;
  coordinator.subscribe(change => {
    if (change.reset || change.identities.some(id => id.sourceId === 'source' && id.bookId === 'book')) void page.refreshDetailAcquisitionProjection();
  });
  return { page, coordinator, facts, calls, verdicts, source, catalog, failures, owner,
    setOwner(value) { installedOwner = value; setRuntime(value); if(value !== undefined && value.bookAcquisitions) page.mountedRuntimeOwner=value; },
    overrideProjection(value) { projectionOverride = value; },
    failProjectionOnce() { projectionFailureOnce = true; },
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
    gate.resolve(); await pending; // The domain owns readmission through the accepted body probe.
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
    await until(() => f.page.detailLoadingMessage.length > 0 && !ProductionHost.forRuntime(f.page.mountedRuntimeOwner).snapshot().candidateAdmissionActive);
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

// Actual typed Core read -> production Index -> SDK detail payload/hero consumer.
class DetailChild { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
class CoverChild extends DetailChild {}
const sdkRoot = resolveEtsLoaderRoot();
const sdkRequire = createRequire(import.meta.url), uiSyntax = sdkRequire(sdkRoot + '/lib/validate_ui_syntax.js');
for (const name of ['LocalBookDetail', 'NoCoverCover']) {
  uiSyntax.componentCollection.customComponents.add(name);
  if (name === 'LocalBookDetail') uiSyntax.propCollection.set(name, new Set([...readFileSync(new URL('features/bookshelf/LocalBookDetail.ets', base), 'utf8').matchAll(/@Prop\s+(\w+)\s*:/g)].map(match => match[1])));
}
sdkRequire(sdkRoot + '/lib/component_map.js').CUSTOM_BUILDER_METHOD.add('externalDirectory');
function detailSdk(f) {
  const read = file => readFileSync(new URL(file, base), 'utf8');
  const parent = createReaderBuilderProbe(read('pages/Index.ets'), ['detailContent','detailSurface','detailReadableAdmission','detailShelfMessage','detailBookKey','detailShelfAdmissionIdentity','isCurrentDetailShelfAdmission','isCurrentRuntime'], { EMPTY_READABLE_ADMISSION:{adding:false,cancelling:false,message:''},LocalBookDetail: DetailChild, LOCAL_SOURCE_ID: 'local' }).owner;
  Object.assign(parent, f.page, { shelfOperation: {generation:0,removalKey:'',busy:false,batchRemovalBusy:false}, readableAdmissions: [], detailShelfAdmissionMount:1,
    offlineMutationActiveKey: '',
    detailBookKey: b => JSON.stringify([b.sourceId, b.bookId]), hasUnknownShelfWrite: () => false,
    remoteContentVerdictLabel: () => '', remoteContentVerdict: f.page.remoteContentVerdict });
  parent.detailContent();
  const props = [...parent.children.values()][0].params;
  const child = localBookDetailSdk({ NoCoverCover: CoverChild }).owner;
  Object.assign(child, props, { appThemeScheme: 'day', contentWidth: () => 352 });
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
    const oldBook = f.page.detailBook, oldSession = f.page.remoteReadingSession;
    f.overrideProjection(invalid); await f.page.refreshDetailAcquisitionProjection();
    assert.equal(f.page.detailBook, oldBook, 'wrong/absent/malformed data cannot replace admitted detail');
    assert.equal(f.page.remoteReadingSession, oldSession); assert.equal(f.calls.filter(m => m === 'chapter.content').length, 0);
    assert.equal(detailSdk(f).props.book, oldBook, 'real SDK detail consumer retains the exact admitted book');
    assert.equal(f.page.bookProjectionLoading, false);
  } finally { f.coordinator.close(); }
}
{
  const f = fixture(); try {
    f.overrideProjection({ origin: 'source', bookUrl: 'book', name: '新标题', author: '新作者', acquisition: { ...f.facts } });
    await f.page.refreshDetailAcquisitionProjection();
    const actual = detailSdk(f);
    assert.equal(actual.props.book.title, '新标题'); assert.ok(actual.texts.includes('新标题'));
    assert.ok(actual.texts.includes('新作者')); assert.equal(actual.props.readingEnabled, true);
  } finally { f.coordinator.close(); }
}
for (const retire of ['runtime-unset', 'runtime-replacement', 'navigation', 'entity', 'session']) {
  const f = fixture(); try {
    const oldBook = f.page.detailBook, oldSession = f.page.remoteReadingSession;
    f.overrideProjection({ origin: 'source', bookUrl: 'book', name: '迟到标题', acquisition: { ...f.facts } });
    const gate = f.gateProjection(), pending = f.page.refreshDetailAcquisitionProjection();
    await until(() => f.calls.includes('search-book.get'));
    await f.page.refreshDetailAcquisitionProjection();
    assert.ok(f.page.bookProjectionPending, 'capture an actual pending original lease before retirement');
    if (retire === 'runtime-unset') f.setOwner(undefined);
    if (retire === 'runtime-replacement') f.setOwner({});
    if (retire === 'navigation') f.page.navigationGeneration++;
    if (retire === 'entity') { f.page.detailBook = { ...oldBook, bookId: 'replacement' }; f.page.remoteReadingSession=undefined; f.page.bindReadingEntryReader(); }
    if (retire === 'session') { f.page.installRemoteReadingSession(undefined); f.page.installRemoteReadingSession(oldSession); }
    const expected = f.page.detailBook;
    gate.resolve(); await assert.doesNotReject(pending); await pause();
    assert.equal(f.page.detailBook, expected); assert.equal(f.page.remoteReadingSession, retire==='entity'?undefined:oldSession);
    assert.equal(ProductionHost.shared?.projectionActive, undefined);
    if (retire.startsWith('runtime')) assert.equal(f.calls.filter(m => m === 'search-book.get').length, 1, 'old owner cannot reacquire a new Runtime for a queued rerun');
  } finally { f.coordinator.close(); }
}
console.log('PASS strict typed cache -> exact Runtime/navigation/session/entity Index -> actual SDK Detail/hero: legal metadata, malformed/partial/wrong identity retention, absent/replacement owner and late coalesced replies');

for (const failedOld of [false, true]) for (const replacement of ['navigation', 'runtime']) {
  const f = fixture(); try {
    if (failedOld) f.failProjectionOnce();
    const gate = f.gateProjection(), old = f.page.refreshDetailAcquisitionProjection();
    await until(() => f.calls.includes('search-book.get'));
    const oldHost=f.page.readingEntryHost;
    if (replacement === 'runtime') f.setOwner({ ...f.owner });
    else {
      f.page.navigationGeneration++;
      f.page.remoteSessionGeneration++;
      f.page.detailBook = { ...f.page.detailBook, bookId: 'second', title: '第二本' };
      f.page.remoteReadingSession = { ...f.page.remoteReadingSession, identity: { sourceId: 'source', bookId: 'second' }, preparedChapter: undefined };
    }
    f.page.bindReadingEntryReader();
    f.overrideProjection({ origin: 'source', bookUrl: f.page.detailBook.bookId, name: '新意图标题', acquisition: { ...f.facts } });
    const secondGate=f.gateProjection();
    const newRead=f.page.refreshDetailAcquisitionProjection();
    if(replacement==='navigation') await newRead;
    const pending = f.page.bookProjectionPending ?? f.page.bookProjectionActive;
    assert.ok(pending, 'new call captures its own full lease while old IO remains active');
    if (replacement === 'runtime') { assert.notEqual(f.page.readingEntryHost,oldHost); assert.equal(oldHost.owns(f.owner),true); }
    gate.resolve(); await old;
    await until(() => f.calls.filter(m => m === 'search-book.get').length === 2);
    assert.equal(f.page.bookProjectionActive.lease, pending.lease);assert.equal(f.page.bookProjectionActive.scopeId,pending.scopeId); assert.equal(f.page.bookProjectionLoading, true, 'old finally cannot clear the freshly started active lease');
    secondGate.resolve(); await newRead; await until(() => !f.page.bookProjectionLoading);
    assert.equal(f.page.detailBook.title, '新意图标题'); assert.ok(detailSdk(f).texts.includes('新意图标题'));
    assert.equal(f.page.bookProjectionPending, undefined); assert.equal(f.page.bookProjectionActive, undefined);
  } finally { f.coordinator.close(); }
}
for (const retiredPending of ['navigation', 'runtime-unset', 'entity']) {
  const f = fixture(); try {
    const gate = f.gateProjection(), old = f.page.refreshDetailAcquisitionProjection();
    await until(() => f.calls.includes('search-book.get'));
    f.page.navigationGeneration++; f.page.bindReadingEntryReader();
    await f.page.refreshDetailAcquisitionProjection(); assert.ok(f.page.bookProjectionPending);
    if (retiredPending === 'navigation') f.page.navigationGeneration++;
    if (retiredPending === 'runtime-unset') f.setOwner(undefined);
    if (retiredPending === 'entity') { f.page.detailBook = { ...f.page.detailBook, bookId: 'third' }; f.page.remoteReadingSession=undefined;f.page.bindReadingEntryReader(); }
    const expected = f.page.detailBook; gate.resolve(); await old; await pause();
    assert.equal(f.calls.filter(m => m === 'search-book.get').length, 1, 'already retired pending intent cannot drain');
    assert.equal(f.page.detailBook, expected); assert.equal(f.page.bookProjectionLoading, false);
  } finally { f.coordinator.close(); }
}
console.log('PASS latest captured Detail intent: A to B, exact replacement Runtime, old success/failure, deferred drain, new lease busy ownership, retired pending intent rejection');

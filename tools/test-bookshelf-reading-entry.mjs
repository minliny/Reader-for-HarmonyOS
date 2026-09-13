import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
function method(name) {
  const start = source.indexOf(`  private ${name}`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  private ', start + 1);
  return source.slice(start, end).replace(/\n  \/\*\*[\s\S]*$/, '');
}
const methods = [
  'openShelfBook(', 'openShelfBookInfo(', 'openLocalBookDetail(', 'openRemoteBookDetail(',
  'openReading(', 'presentPreparedReading(', 'returnToReadingOrigin(', 'onReaderExited(',
  'returnFromDetail(', 'requestReaderBookInfo(', 'returnToBookshelf(', 'nextNavigationGeneration(', 'isKnownDetailChapter(',
  'async probeRemoteContentVerdict(', 'remoteContentVerdictLabel(', 'onReadingFailure(',
  'retryCurrentReadingSource(', 'runReadingFailureActionAfterExit(', 'openDetailSourceSwitch(',
].map(method).join('\n');
const back = source.slice(source.indexOf('  onBackPress(): boolean {'), source.indexOf('\n  build() {'));
const harnessCode = stripTypeScriptTypes(`class Harness { ${methods}\n${back} }`);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = () => new Promise(resolve => setImmediate(resolve));

function create(remote = false) {
  const toc = deferred(), catalog = deferred(), body = deferred();
  const book = {
    sourceId: remote ? 'source' : 'local', bookId: 'book', title: 'Test book', author: 'Author',
    currentChapterIndex: 7, coverUrl: 'cover',
  };
  const entries = [...(remote ? [{ index: 5, title: '卷一', url: '' }] : []), { index: 7, title: 'Chapter seven', url: 'chapter-7' }];
  const session = { identity: book, book, entries, acquisitionMode: 'cache' };
  const probes = [];
  const Harness = new Function(
    'LOCAL_SOURCE_ID', 'ReaderRuntimeOwner', 'LocalReadingFlowGateway', 'RemoteReadingFlowGateway',
    'ReadingOfflineGateway', 'ReaderCoreGateway', 'SourceGateway', 'RemoteDetailAdmission',
    'hilog', 'DOMAIN', 'readerSourceCategoryIsText', 'readerSourceCategoryLabel',
    'remoteReadingFailureKindOf', 'verdictForFailureKind', 'isRemoteSourceFailureKind',
    'remoteSourceFailureSummary', 'RemoteReadingGatewayError', 'remoteReadingFailureRecord',
    `${harnessCode}; return Harness;`,
  )(
    'local', { current: () => ({ bookAcquisitions: () => ({ endSearch() {}, acquireBookWithBackgroundRefresh: () => catalog.promise.then(session => ({ session })), recentFailures: () => [] }) }) },
    class { loadToc() { return toc.promise; } loadDirectoryProjection() { return Promise.resolve(entries); } },
    class {
      openCachedCatalogSession() { return catalog.promise; }
      openSession() { return catalog.promise; }
      loadChapter(_session, index) { probes.push(index); return body.promise; }
    },
    class {}, class { loadShelfBook() { return Promise.resolve(book); } },
    class { loadSources() { return Promise.resolve([{ sourceId: 'source', category: 'novel' }]); } },
    class { constructor(value) { this.session = value; } },
    { info() {}, warn() {}, error() {} }, 0, () => true, () => '小说',
    error => error.kind ?? 'NETWORK_FAILED', () => 'networkFailed',
    kind => kind === 'NETWORK_FAILED', () => '网络请求失败', class extends Error {}, () => ({}),
  );
  const h = new Harness(), routes = [], alerts = [];
  let route = 'bookshelf';
  Object.defineProperty(h, 'route', { get: () => route, set: value => { routes.push(value); route = value; } });
  Object.assign(h, {
    readingOriginRoute: 'detail', shelfReadingPreparation: false, navigationGeneration: 0,
    readingSessionActive: false, detailReturnRoute: 'bookshelf', detailToc: [], shelfBooks: [book],
    remoteCatalogRefreshAt: new Map(), offlineMutationGeneration: 0, bookshelfRemovalActiveKey: '',
    bookshelfRemovalGeneration: 0, bookshelfLoadGeneration: 0,
    sourceSwitchVisible: false, remoteContentVerdict: 'readable',
    sourceDisplayName: () => 'Test source', readingDetailForShelf: value => ({ ...value }),
    readingDetailForRemoteSeed: value => ({ ...value }), hasDeclaredCoverUrl: () => true,
    loadRemoteDirectoryProjection: async () => entries,
    openSearchSessionCacheFirst: async () => ({ session: await catalog.promise }),
    refreshDetailAcquisitionProjection: async () => {},
    refreshBookshelf() {}, resetSearchDetailWarmups() {}, hasVisibleImportDialog: () => false,
    startSourceDiscovery() {}, showReadingFailure: (title, message) => alerts.push({ title, message }),
    getUIContext: () => ({ showAlertDialog: dialog => alerts.push(dialog) }),
  });
  return { h, book, session, toc, catalog, body, entries, probes, routes, alerts };
}

for (const remote of [false, true]) {
  const t = create(remote), { h } = t;
  h.openShelfBook(t.book);
  assert.equal(h.route, 'bookshelf');
  assert.equal(h.shelfReadingPreparation, true);
  assert.equal(h.readingSessionActive, false);
  if (remote) {
    t.catalog.resolve(t.session);
    await settle();
    assert.equal(h.readingSessionActive, false, 'catalog alone cannot reveal reading');
    assert.deepEqual(t.probes, [7], 'resume must probe the persisted chapter');
    t.body.resolve('body');
  } else {
    t.toc.resolve({ entries: t.entries });
  }
  await settle();
  assert.equal(h.readingSessionActive, true);
  assert.equal(h.route, 'bookshelf', 'first-page preparation retains the shelf');
  assert.equal(h.requestedChapterIndex, undefined, 'preserve the persisted offset');
  h.presentPreparedReading(7);
  assert.equal(h.route, 'reading');
  h.onReaderExited();
  assert.equal(h.route, 'bookshelf', 'reader back follows the shelf origin');
  assert.equal(h.readingSessionActive, false);
  assert.ok(!t.routes.includes('detail'), 'no transient detail route anywhere in the shelf journey');
}

for (const remote of [false, true]) {
  const t = create(remote);
  t.h.openShelfBookInfo(t.book);
  t.toc.resolve({ entries: t.entries });
  t.catalog.resolve(t.session);
  t.body.resolve('body');
  await settle();
  assert.equal(t.h.route, 'detail');
  assert.equal(t.h.readingSessionActive, false, 'long-press info must not automatically read');
  t.h.openReading(undefined);
  t.h.presentPreparedReading(7);
  t.h.onReaderExited();
  assert.equal(t.h.route, 'detail', 'explicit detail entry returns to detail');
}

{
  const t = create(true);
  t.h.route = 'search';
  t.h.openRemoteBookDetail(t.book, 'Test source');
  t.catalog.resolve(t.session); t.body.resolve('body');
  await settle();
  assert.equal(t.h.route, 'detail');
  assert.equal(t.h.detailReturnRoute, 'search');
  assert.equal(t.h.readingSessionActive, false, 'search result remains a preview even for a shelf book');
}

for (const remote of [false, true]) {
  const t = create(remote);
  t.h.openShelfBook(t.book);
  assert.equal(t.h.onBackPress(), true);
  t.toc.resolve({ entries: t.entries }); t.catalog.resolve(t.session); t.body.resolve('body');
  await settle();
  assert.equal(t.h.route, 'bookshelf');
  assert.equal(t.h.readingSessionActive, false, 'late admission cannot revive a cancelled entry');
  assert.equal(t.h.shelfReadingPreparation, false);
}

{
  const t = create();
  t.h.openShelfBook(t.book); t.toc.resolve({ entries: t.entries }); await settle();
  let exits = 0;
  t.h.readingExitRequest = () => { exits++; };
  assert.equal(t.h.onBackPress(), true);
  t.h.presentPreparedReading(7);
  assert.equal(t.h.route, 'bookshelf', 'a late first page must not override Back');
  assert.equal(exits, 1);
  t.h.onReaderExited();
  assert.equal(t.h.readingSessionActive, false);
}

{
  const t = create();
  t.h.openShelfBook(t.book);
  t.h.nextNavigationGeneration(); t.h.route = 'search';
  t.toc.resolve({ entries: t.entries }); await settle();
  assert.equal(t.h.route, 'search');
  assert.equal(t.h.readingSessionActive, false, 'navigation invalidates delayed entry');
}

for (const remote of [false, true]) {
  const t = create(remote);
  t.h.openShelfBook(t.book);
  if (remote) {
    t.catalog.resolve(t.session); await settle(); t.body.reject(new Error('offline'));
  } else {
    t.toc.resolve({ entries: [] });
  }
  await settle();
  assert.equal(t.h.route, 'bookshelf');
  assert.equal(t.h.shelfReadingPreparation, false, 'failed entry releases shelf actions');
  assert.equal(t.h.readingSessionActive, false);
  assert.equal(t.alerts.length, 1, 'failed entry must explain why it stayed on the shelf');
}

{
  const t = create(true), { h } = t;
  h.openShelfBook(t.book); t.catalog.resolve(t.session); t.body.resolve('body'); await settle();
  h.onReadingFailure('source', 'book', 'offline', 'NETWORK_FAILED');
  h.onReaderExited();
  assert.equal(h.route, 'bookshelf');
  t.alerts[0].primaryButton.action();
  assert.equal(h.readingSessionActive, true, 'retry still owns the admitted book after serialized exit');
  assert.equal(h.route, 'bookshelf');
  h.onReaderExited();
  t.alerts[0].secondaryButton.action();
  assert.equal(h.sourceSwitchVisible, true, 'explicit source choice can recover over the shelf');
  assert.equal(h.route, 'bookshelf');
  assert.ok(!t.routes.includes('detail'));
  h.sourceSwitchVisible = false;
  h.detailBook = { ...t.book, bookId: 'different' };
  t.alerts[0].primaryButton.action();
  assert.equal(h.readingSessionActive, false, 'old failure actions cannot read a different selection');
}

console.log('bookshelf reading entry: PASS (local/remote, info/search, back, cancellation, failure, retry/source switch)');

{
 const t=create(true),h=t.h;h.openShelfBook(t.book);t.catalog.resolve(t.session);t.body.resolve('body');await settle();
 const session=h.remoteReadingSession,toc=h.detailToc;let exits=0;h.readingExitRequest=()=>{exits++;};
 h.requestReaderBookInfo();assert.equal(exits,1);assert.equal(h.readingSessionActive,true,'information waits for normal serialized exit');
 h.onReaderExited();assert.equal(h.route,'detail');assert.equal(h.detailReturnRoute,'bookshelf');
 assert.equal(h.remoteReadingSession,session);assert.equal(h.detailToc,toc,'information reuses exact admitted directory');
}

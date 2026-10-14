import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ReadingEntryPreparation, compileHost } from './lib/reading-entry-owner-probe.mjs';
import { fixture as hostFixture, session as hostSession, book as hostBook } from './lib/reading-entry-index-fixture.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { MangaRetainedTileCache } from './lib/manga-retained-tile-cache-probe.mjs';
import { MangaBookPresentation } from '../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');

// Real SDK-emitted Surface methods, Controller/protection owner and the real
// content-mutation fence. Only Core/Host transport and native layout are seams.
const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
function load(name, dependencies = {}) {
  const source = read(name + '.ts').replace(/^import[\s\S]*?;\n/gm, '')
    .replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), stripTypeScriptTypes(source) + `\nreturn ${name};`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway'), MangaResourceGateway = load('MangaResourceGateway');
const MangaChapterPreparationCoordinator = load('MangaChapterPreparationCoordinator', { MangaSessionGateway, MangaResourceGateway });
const Controller = load('MangaSessionController', { MangaSessionGateway, MangaResourceGateway, MangaRetainedTileCache, MangaChapterPreparationCoordinator });
const surfaceSource = read('MangaReadingSurface.ets');
const oldSurfaceSource = surfaceSource.replace('this.acquirePreparedCatalog(prepared.chapter, current)', 'this.acquireCatalog(current)');
assert.notEqual(oldSurfaceSource, surfaceSource, 'negative control restores only the old automatic catalog write');
function surfaceSdk(source) {
  const properties = createArkUIPropertyRuntimeProbe();
  return createReaderBuilderProbe(source,
    ['remoteSession', 'open', 'acquirePreparedCatalog', 'acquireCatalog', 'effectiveFit', 'configureAdjacentChapter', 'adjacentChapter'],
    { ...properties.sdk, MangaSessionGateway, MangaBookPresentation, RemoteReadingFlowGateway, AppStorage: { setOrCreate() {} } }, properties.hooks).Component;
}
const Surface = surfaceSdk(surfaceSource), OldSurface = surfaceSdk(oldSurfaceSource);
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const pages = Array.from({ length: 36 }, (_, ordinal) => {
  const pageId = 'mp1:' + String(ordinal).padStart(64, '0'); return { ordinal, pageId, resourceRef: 'manga:' + pageId };
});
const full = { manifest: { chapter: { sourceId: 's', bookId: 'b', chapterId: '/c' }, sourceRuleVersion: 'r', manifestVersion: 'v', decodeRevision: 'identity-v1', pages },
  chapterIndex: 0, chapterTitle: '01', cached: true, resources: pages.map(page => ({ resourceRef: page.resourceRef, request: { url: 'https://image.test/' + page.ordinal } })) };
function window(start, limit) {
  const selected = pages.slice(start, start + limit);
  return { ...structuredClone(full), manifest: { ...structuredClone(full.manifest), pages: selected },
    resources: full.resources.filter(resource => selected.some(page => page.resourceRef === resource.resourceRef)), pageStart: start, totalPages: 36 };
}
const entry = { chapter: window(0, 3), targetOrdinal: 0, recoveryRequired: false, progress: { token: { epoch: 1, revision: 0 }, location: null } };
const catalog = { contentKind: 'manga', sourceVersion: 'r', catalogVersion: 'c1', contextVersion: 'x1', acquisitionMode: 'online',
  identity: { sourceId: 's', bookId: 'b' }, detailUrl: '/b', book: { title: 'Manga', author: 'Writer' },
  entries: [{ index: 0, title: '01', url: '/c', proofState: 'verified' }, { index: 1, title: '02', url: '/next', proofState: 'verified' }] };
function cachedStatus(scenario) {
  const status = { sourceId: 's', bookId: 'b', tocAvailable: scenario !== 'missing', sourceVersion: scenario === 'source-changed' ? 'new-r' : 'r',
    catalogVersion: 'c1', contextVersion: 'x1', continuationVariables: {}, chapters: catalog.entries.map(row => ({ chapterIndex: row.index,
      title: row.title, url: row.index === 0 && ['url-changed', 'catalog-mutation'].includes(scenario) ? '/changed' : row.url,
      variables: {}, navigable: true, proofState: scenario === 'unknown' ? 'legacyUnknown' : 'verified' })) };
  if (scenario.startsWith('missing-proof-')) delete status[scenario.slice('missing-proof-'.length)];
  return status;
}
const cases = ['ready', 'known-session', 'offline', 'unknown', 'missing', 'missing-proof-sourceVersion', 'missing-proof-catalogVersion', 'missing-proof-contextVersion', 'cancel', 'source-changed', 'url-changed', 'catalog-mutation', 'progress', 'legacy-write'];
for (const scenario of cases) {
  const preparation = new ReadingEntryPreparation({}, false), gate = deferred(), calls = [], publications = [], released = [];
  let imageId = 0;
  const runtime = { supportsCoreCapability: () => true, isMangaPreparationForeground: () => false,
    captureReadingContentValidity: (source, book) => preparation.captureContentValidity(source, book),
    async requestBook(method, params) { return this.request(method, params); },
    async request(method, params = {}) {
      calls.push(method);
      if (method === 'manga.entry.get') return { data: { entry: structuredClone(entry) } };
      if (method === 'manga.session.runtime') return { data: { runtimeEpoch: 42 } };
      if (method === 'manga.session.replace') return { data: { protected: params.chapters.length, runtimeEpoch: 42 } };
      if (method === 'manga.session.release') return { data: { released: true } };
      if (method === 'manga.pages.window') return { data: window(params.start, params.limit) };
      if (method === 'manga.cache.recordRead') return { data: { recorded: true } };
      if (method === 'cache.book.status') return { data: await gate.promise };
      assert.fail('unexpected Core command ' + method);
    },
    async loadReadingImage() { return { fileUri: 'file://cached-' + ++imageId, width: 600, height: 800, revision: 'pixels' }; },
    releaseReadingImage(uri) { released.push(uri); },
    bookAcquisitions: () => ({ async acquireBook() {
      calls.push('book.detail'); preparation.beginRequest('book.detail', { sourceId: 's', bookId: 'b' });
      try { await gate.promise; return catalog; }
      finally { preparation.finishRequest('book.detail', { sourceId: 's', bookId: 'b' }); }
    } }) };
  const controller = new Controller(runtime), C = scenario === 'legacy-write' ? OldSurface : Surface;
  const surface = new C(undefined, { remoteSession: scenario === 'known-session' ? catalog : undefined });
  const restores = [];
  Object.assign(surface, { mounted: true, controller, runtime, sourceId: 's', bookId: 'b', chapterIndex: 0, offline: scenario === 'offline',
    remoteBookSeed: { sourceId: 's', bookId: 'b', title: 'Manga', author: 'Writer', detailUrl: '/b', contentKind: 'manga' },
    fitPreference: 'width', horizontal: false, startAtChapterFirst: true, publish() {}, updateViewport() {}, restore: (...args) => restores.push(args),
    onRemoteSessionReady(session) { publications.push(session); surface.remoteSession = session; } });
  await surface.open(controller); await tick();
  assert.equal(surface.opened, true, scenario + ': cached first region does not await catalog/network');
  assert.equal(controller.totalPages, 36); assert.deepEqual(restores, [[0, 0, 0]]);
  const firstImage = controller.visiblePages().find(page => page.ordinal === 0)?.image?.fileUri;
  assert.ok(firstImage);
  if (scenario === 'legacy-write') {
    assert.equal(controller.sessionContentCurrent(), false); assert.equal(controller.tile(0, 0), undefined);
    await assert.rejects(controller.retry(0), /MANGA_SESSION_CONTENT_CHANGED/);
  } else {
    assert.equal(controller.sessionContentCurrent(), true); assert.ok(controller.tile(0, 0));
    assert.equal(calls.includes('book.detail'), false);
  }
  if (scenario === 'cancel') { surface.mounted = false; await controller.close(); }
  if (['source-changed', 'catalog-mutation', 'progress'].includes(scenario)) {
    const method = scenario === 'source-changed' ? 'source.update' : scenario === 'progress' ? 'reading.progress.update' : 'book.toc';
    const params = { sourceId: 's', bookId: 'b' };
    preparation.beginRequest(method, params); preparation.finishRequest(method, params);
  }
  gate.resolve(cachedStatus(scenario)); await tick(); await tick();
  if (['ready', 'offline', 'progress', 'known-session'].includes(scenario)) {
    assert.equal(publications.length, 1); assert.equal(surface.adjacentChapter(1)?.url, '/next');
    assert.equal(controller.sessionContentCurrent(), true); assert.ok(controller.tile(0, 0));
    if (scenario === 'offline') { assert.equal(publications[0].acquisitionMode, 'offline'); assert.equal(publications[0].requiresContextRefresh, true); assert.deepEqual(publications[0].hostRequirements, []); }
  } else if (scenario !== 'legacy-write') assert.equal(publications.length, 0, scenario + ': unproven/stale catalog cannot replace the prepared scope');
  if (['source-changed', 'catalog-mutation', 'legacy-write'].includes(scenario)) {
    assert.equal(controller.sessionContentCurrent(), false); assert.equal(controller.tile(0, 0), undefined);
    assert.equal(released.filter(uri => uri === firstImage).length, 1);
    await assert.rejects(controller.retry(0), /MANGA_SESSION_CONTENT_CHANGED/);
  }
  if (scenario !== 'legacy-write') assert.equal(calls.some(method => ['book.detail', 'book.toc', 'chapter.content'].includes(method)), false);
  await controller.close(); preparation.close();
}

const hostSource = read('../reading/ReadingEntryHost.ts');
const oldHostSource = hostSource.replace('this.refreshMangaDirectoryDisplay(refreshDirectoryDisplay, false)', 'this.refreshMangaDirectoryDisplay(refreshDirectoryDisplay)');
assert.notEqual(hostSource, oldHostSource);
for (const legacy of [false, true]) {
  const f = hostFixture(compileHost(legacy ? oldHostSource : hostSource)), retained = { ...hostSession(), contentKind: 'manga' };
  const contentCurrent = f.preparations.captureContentValidity('s1', 'book'); let network = 0;
  f.runtime.request = async method => {
    assert.equal(method, 'cache.book.status'); return { data: { sourceId: 's1', bookId: 'book', tocAvailable: true,
      sourceVersion: 'v1', catalogVersion: 'c1', contextVersion: 'x1', continuationVariables: {},
      chapters: retained.entries.map(row => ({ chapterIndex: row.index, title: row.title, url: row.url, variables: {}, proofState: 'legacyUnknown' })) } };
  };
  f.coordinator.acquireBook = async () => {
    network++; const params = { sourceId: 's1', bookId: 'book' }; f.preparations.beginRequest('book.toc', params);
    f.preparations.finishRequest('book.toc', params); return { ...retained, catalogVersion: 'c2', contextVersion: 'x2' };
  };
  f.host.bindReader({ ...hostBook(), contentKind: 'manga' }, retained, [], true, f.lease);
  assert.equal(f.host.readerSessionReady(retained), true); await tick(); await tick();
  assert.equal(network, legacy ? 1 : 0); assert.equal(contentCurrent(), !legacy);
  if (!legacy) {
    await f.host.refreshMangaDirectoryDisplay(true, false); assert.equal(network, 0, 'Quick reader refresh retains read-only permission');
    await f.host.refreshMangaDirectoryDisplay(true); assert.equal(network, 1, 'explicit detail repair still admits its existing network catalog path');
  }
  f.close();
}

// Execute the actual Index caller, rather than treating a source regex as an
// interaction proof. The reader Quick request carries no network permission.
const Index = productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), ['onRemoteSessionReady', 'loadDirectoryOperationProjections']);
const calls = [], host = { snapshot: () => ({ scopeId: 1 }), refreshMangaDirectoryDisplay: (...args) => { calls.push(args); } };
const index = Object.assign(new Index(), { readingSessionActive: true, detailBook: { sourceId: 's', bookId: 'b' }, readingEntryScopeId: 1,
  getReadingEntryHost: () => host, mountedRuntimeOwner: {}, remoteReadingSession: catalog, getReaderDirectoryHost: () => undefined, getReadingOfflineHost: () => undefined });
index.onRemoteSessionReady(catalog, true); assert.deepEqual(calls.pop(), [true, false]);
index.loadDirectoryOperationProjections(); assert.deepEqual(calls.pop(), [true, false]);
index.readingSessionActive = false; index.loadDirectoryOperationProjections(); assert.deepEqual(calls.pop(), [true, true]);
console.log('PASS actual SDK prepared Surface + Controller/protection + real content fence: 36-page/3-fact first frame, read-only ready/unknown/missing/cancel/source/catalog/progress/offline, old automatic-write negatives; actual Host and Index reader permissions preserve explicit detail repair. Native pixels remain separate.');

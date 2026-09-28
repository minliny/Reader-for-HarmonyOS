import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { sameRemoteSessionEvidence, canAppendRemoteReadingCatalog } = await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const file = path => new URL(`../entry/src/main/ets/${path}`, import.meta.url);
const Source = productionMotionMethods(file('features/source/SourceSwitchGateway.ts'), ['fetchTargetToc', 'assertNonBlankString']);
const baseline = process.argv.includes('--baseline');
const settle = async () => { for (let n = 0; n < 300; n++) await Promise.resolve(); };
const sourceId = 'new', bookId = 'https://new.invalid/book', sourceVersion = 'v8';

function fixture(size) {
  const calls = [];
  const entries = Array.from({ length: size }, (_, index) => ({ index, title: `第${index + 1}章`,
    url: `https://new.invalid/${index}`, variables: {} }));
  const coordinator = new BookAcquisitionCoordinator(async (method, params, options) => {
    if (options?.shouldCancel?.()) throw Error('cancelled');
    calls.push({ method, params });
    if (method === 'source.list') return { data: { sources: [{ sourceId, sourceVersion, enabled: true }] } };
    if (method === 'search-book.get') return { data: { book: null } };
    if (method === 'cache.book.status') return { data: { sourceId, bookId, tocAvailable: false } };
    if (method === 'book.detail') return { data: { sourceId, sourceVersion,
      book: { bookId, title: '终宋', author: '作者' }, tocUrl: 'https://new.invalid/toc', variables: {} } };
    if (method === 'book.toc') return { data: { sourceId, bookId, sourceVersion, catalogVersion: 'new',
      contextVersion: 'context', catalogAt: Date.now(), toc: entries } };
    throw Error(`unexpected ${method}`);
  });
  const runtime = { bookAcquisitions: () => coordinator, request: (...args) => coordinator.request(...args) };
  const Index = productionMotionMethods(file('pages/Index.ets'), ['performSourceSwitchSeam', 'onRemoteSessionReady',
    'isRemoteCatalogNearEnd', 'refreshRemoteCatalogNearEnd', 'applyReadingCommit', 'applyDirectoryChapter'], {
    RemoteReadingFlowGateway, ReaderRuntimeOwner: { current: () => runtime }, sameRemoteSessionEvidence,
    canAppendRemoteReadingCatalog, CATALOG_REFRESH_NEAR_END: 3, CATALOG_REFRESH_INTERVAL_MS: 600000,
    CATALOG_REFRESH_RETRY_INTERVAL_MS: 30000, DOMAIN: 0, hilog: { warn() {} },
  });
  const host = Object.assign(new Index(), {
    directoryCurrentChapterIndex: 988, directoryChapterTitle: '第982章 国号', navigationGeneration: 1,
    remoteSessionGeneration: 1, remoteCatalogRefreshAt: new Map(), remoteCatalogRefreshAttemptAt: new Map(),
    remoteCatalogRefreshInFlight: new Map(), directoryBookmarkMutationGeneration: 0, offlineMutationGeneration: 0,
    readingDetailForShelf: book => ({ ...book, sourceName: 'new' }),
    nextNavigationGeneration() { return ++this.navigationGeneration; },
    installRemoteReadingSession(session) {
      if (!sameRemoteSessionEvidence(this.remoteReadingSession, session)) this.remoteSessionGeneration++;
      this.remoteReadingSession = session;
    },
    isKnownDetailChapter(index) { return this.detailToc.some(entry => entry.index === index); },
    refreshBookshelf() {}, consumeSystemFileOpen() {}, async prefetchReadingWindow() {},
    reopenSwitchedBook() { assert.fail('the admitted target session must be reused'); },
  });
  return { coordinator, runtime, host, calls,
    source: Object.assign(new Source(), { runtimeOwner: runtime }),
    count: method => calls.filter(call => call.method === method).length };
}

const scenarios = [];
for (const size of [20, 990, 1370]) {
  const f = fixture(size);
  try {
    const toc = await f.source.fetchTargetToc(sourceId, bookId, () => true,
      { sourceId, bookUrl: bookId, bookName: '终宋', author: '作者', sourceVersion });
    assert.equal(f.count('book.toc'), 1);
    assert.equal(f.count('book.detail'), 1);
    f.host.performSourceSwitchSeam({ sourceId, bookId, title: '终宋', author: '作者' }, toc.readingSession, 17);
    await settle();
    const expected = baseline && size === 990 ? 2 : 1;
    assert.equal(f.count('book.toc'), expected,
      'an old source index near the new catalog end must not trigger another catalog request');
    assert.equal(f.count('book.detail'), expected);
    assert.equal(f.host.requestedChapterIndex, 17);
    assert.equal(f.host.directoryCurrentChapterIndex, -1);
    assert.equal(f.host.directoryChapterTitle, '');
    scenarios.push({ targetSize: size, oldDisplayedIndex: 988, matchedIndex: 17,
      detailCallsAfterSeam: f.count('book.detail'), tocCallsAfterSeam: f.count('book.toc') });
    if (baseline) continue;

    // The mounted reader receives the already admitted session. Opening its
    // gateway and catalog neither reacquires the book nor downloads a body.
    const gateway = await ReadingSessionFlowGateway.open({ sourceId, bookId,
      remoteSession: f.host.remoteReadingSession, sourceSwitchTransactionId: 'tx', isCurrent: () => true,
      onRemoteSessionReady: session => f.host.onRemoteSessionReady(session),
      resolveSourceSwitchTransactionId: async () => 'tx' }, f.runtime);
    const loaded = await gateway.loadToc(bookId, () => true);
    assert.equal(loaded.entries.length, size);
    assert.equal(f.count('book.toc'), 1);
    assert.equal(f.count('book.detail'), 1);
    assert.equal(f.count('chapter.content'), 0);

    // Late callbacks from another identity cannot install a session, update
    // the admitted directory or trigger catalog work for the new source.
    const admitted = f.host.remoteReadingSession, directory = f.host.detailToc;
    f.host.onRemoteSessionReady({ ...admitted, identity: { sourceId: 'old', bookId } });
    f.host.applyReadingCommit({ sourceId: 'old', bookId, chapterIndex: size - 1 });
    await settle();
    assert.equal(f.host.remoteReadingSession, admitted);
    assert.equal(f.host.detailToc, directory);
    assert.equal(f.count('book.toc'), 1);

    // Real target chapter/commit callbacks still trigger the existing refresh
    // policy near the end. A successful refresh must not recursively reload.
    f.host.applyDirectoryChapter(size - 1, `第${size}章`);
    f.host.applyReadingCommit({ sourceId, bookId, chapterIndex: size - 1 });
    f.host.applyReadingCommit({ sourceId, bookId, chapterIndex: size - 1 });
    await settle();
    assert.equal(f.count('book.toc'), 2);
    assert.equal(f.count('book.detail'), 2);
    assert.equal(f.host.directoryCurrentChapterIndex, size - 1);
    assert.equal(f.host.remoteCatalogRefreshInFlight.size, 0);
    f.host.onRemoteSessionReady(f.host.remoteReadingSession);
    f.host.applyReadingCommit({ sourceId, bookId, chapterIndex: size - 1 });
    await settle();
    assert.equal(f.count('book.toc'), 2, 'freshness and singleflight prevent a ready/refresh callback loop');
  } finally { f.coordinator.close(); }
}
console.log(JSON.stringify({ status: baseline ? 'BASELINE_REPRODUCED' : 'PASS', scenarios,
  boundary: 'Production source acquisition, coordinator, Index seam/commit/refresh and mounted session gateway; controlled Core I/O, no HTTP timing or device claim.' }));

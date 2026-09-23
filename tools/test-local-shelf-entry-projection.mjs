import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { LocalReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };

// Execute actual Index entry/publication methods and the actual local gateway.
// Only Core RPC replies and unrelated native UI boundaries are controlled.
function fixture() {
  const calls = [], failures = [], tocReads = [], statusReads = [];
  const book = { sourceId: 'local', bookId: 'local-book', title: '本地书', author: '作者' };
  const toc = [{ index: 0, title: '第一章', url: 'local://chapter/0' }];
  const owner = { bookAcquisitions: () => ({ setPreparationVisible() {} }), request: async (method, params, options) => {
    calls.push(method);
    if (method === 'local_book.toc') {
      const gate = deferred(); tocReads.push(gate); await gate.promise;
      return { data: { sourceId: 'local', bookId: params.bookId, toc } };
    }
    if (method === 'cache.book.status') {
      const gate = deferred(); statusReads.push(gate); await gate.promise;
      if (options?.shouldCancel?.()) throw Error('cancelled stale directory projection');
      return { data: { sourceId: 'local', bookId: params.bookId, chapters: [{ chapterIndex: 0, state: 'completed' }] } };
    }
    if (method === 'bookmark.list') return { data: { bookmarks: [] } };
    throw Error(`unexpected command ${method}`);
  } };
  const Index = productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), [
    'openLocalBookDetail', 'openReading', 'presentPreparedReading', 'nextNavigationGeneration',
    'isKnownDetailChapter', 'mergeDirectoryBookmarks', 'applyReaderDirectoryProjection',
  ], { LOCAL_SOURCE_ID: 'local', ReaderRuntimeOwner: { current: () => owner }, LocalReadingFlowGateway,
    DOMAIN: 0, hilog: { info() {}, error() {} } });
  const p = Object.assign(new Index(), {
    route: 'bookshelf', readingOriginRoute: 'bookshelf', navigationGeneration: 0,
    readingSessionActive: false, shelfReadingPreparation: false, detailToc: [],
    bookshelfRemovalActiveKey: '', directoryBookmarkMutationGeneration: 0, directoryBookmarkMutationActiveKey: '',
    installRemoteReadingSession(session) { this.remoteReadingSession = session; },
    readingDetailForShelf: selection => ({ ...selection }), hasDeclaredCoverUrl: () => true,
    showReadingFailure: (...args) => failures.push(args),
  });
  const openReading = p.openReading.bind(p);
  p.openReading = index => { calls.push('reader-mount-request'); openReading(index); };
  return { p, book, calls, failures, tocReads, statusReads };
}
async function admit(f) {
  f.p.openLocalBookDetail(f.book, true);
  assert.equal(f.p.readingSessionActive, true);
  assert.equal(f.p.route, 'reading');
  assert.deepEqual(f.calls, ['reader-mount-request'], 'PH116 entry does not wait for TOC/status/bookmark RPC');
}
{
  const f = fixture(); await admit(f);
  // The real reader's initial TOC callback publishes base rows, but optional
  // cache/bookmark work stays behind its durable first-page notification.
  f.p.applyReaderDirectoryProjection([{index:0,title:'第一章',navigable:true,downloadState:'unknown'}]);
  assert.deepEqual(f.calls, ['reader-mount-request']);
  f.p.presentPreparedReading(0); await settle();
  assert.equal(f.p.route, 'reading');
  assert.deepEqual(f.calls, ['reader-mount-request', 'cache.book.status', 'bookmark.list']);
  f.statusReads[0].resolve(); await settle();
  assert.equal(f.p.detailToc[0].downloadState, 'completed');
  f.p.presentPreparedReading(0); await settle();
  assert.equal(f.statusReads.length, 1, 'the first page consumes optional projection once');
  assert.deepEqual(f.failures, []);
}
{
  const f = fixture(); await admit(f);
  f.p.nextNavigationGeneration(); f.p.readingSessionActive = false; f.p.route = 'bookshelf';
  f.p.presentPreparedReading(0); await settle();
  assert.equal(f.p.route, 'bookshelf');
  assert.equal(f.statusReads.length, 0, 'cancelled reader cannot enqueue optional detail work');
}
{
  const f = fixture(); await admit(f);
  f.p.applyReaderDirectoryProjection([{index:0,title:'第一章',navigable:true,downloadState:'unknown'}]);
  f.p.presentPreparedReading(0); await settle();
  f.p.directoryBookmarkMutationGeneration++;
  f.p.detailToc[0].bookmarks = [{time:42,bookText:'最新书签'}];
  f.statusReads[0].resolve(); await settle();
  assert.equal(f.p.detailToc[0].downloadState, 'completed');
  assert.equal(f.p.detailToc[0].bookmarks[0].time, 42);
}
for (const cancel of [false, true]) {
  const f = fixture(); f.p.openLocalBookDetail(f.book, false);
  assert.equal(f.p.route, 'detail'); assert.equal(f.p.readingSessionActive, false);
  if (cancel) { f.p.nextNavigationGeneration(); f.p.route = 'search'; }
  f.tocReads[0].resolve(); await settle();
  if (cancel) {
    assert.deepEqual(f.calls, ['local_book.toc']); assert.equal(f.p.route, 'search');
  } else {
    assert.deepEqual(f.calls, ['local_book.toc', 'cache.book.status', 'bookmark.list']);
    f.statusReads[0].resolve(); await settle();
    assert.equal(f.p.detailToc[0].downloadState, 'completed');
  }
}
{
  const f = fixture(); f.p.openLocalBookDetail(f.book, false);
  f.tocReads[0].resolve(); await settle();
  f.p.openLocalBookDetail(f.book, true);
  f.statusReads[0].resolve(); await settle();
  assert.equal(f.p.route, 'reading'); assert.equal(f.p.detailToc.length, 0,
    'an old same-book detail projection cannot publish into a newly mounted reader');
}
{
  const f = fixture(); f.p.openLocalBookDetail(f.book, false);
  f.tocReads[0].resolve(); await settle();
  f.p.directoryBookmarkMutationGeneration++;
  f.p.detailToc = f.p.detailToc.map(entry => ({ ...entry, bookmarks: [{ time: 42, bookText: '新书签' }] }));
  f.statusReads[0].resolve(); await settle();
  assert.equal(f.p.detailToc[0].downloadState, 'completed');
  assert.equal(f.p.detailToc[0].bookmarks[0].time, 42, 'detail status cannot overwrite newer bookmark mutations');
}
console.log('PASS local direct entry before RPC; original detail projection, cancellation, same-book generation and bookmark mutation protection');
console.log('Evidence boundary: controlled Core replies and production methods; no native frame or device latency claim.');

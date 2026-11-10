import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import {ProductionHost,setRuntime} from './lib/reading-entry-owner-probe.mjs';
import { bookshelfOperationClass } from './lib/bookshelf-operation-owner-probe.mjs';
import { actualReadingEntryPresentation } from './lib/reading-entry-presentation-probe.mjs';
import { ReaderNavigation } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { ReaderEntryStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { LocalReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };

{
  const raw = { index: 1, title: '小节', url: 'local://chapter/1', level: 2 };
  const gateway = new LocalReadingFlowGateway({ request: async () => ({ data: {
    sourceId: 'local', bookId: 'epub', toc: [raw],
  } }) });
  const toc = await gateway.loadToc('epub');
  assert.equal(toc.entries[0].level, 2, 'Core EPUB depth reaches the reading directory');
  raw.level = 0;
  await assert.rejects(gateway.loadToc('epub'), /invalid navigation level/);
}

// Execute the actual entry action, presentation, navigation and local gateway owners.
// Only Core RPC replies and unrelated native UI boundaries are controlled.
function fixture() {
  const calls = [], failures = [], tocReads = [], statusReads = []; let bookmarks=[];
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
    if (method === 'bookmark.list') return { data: { bookmarks } };
    throw Error(`unexpected command ${method}`);
  } };
  setRuntime(owner);
  const EntryActions = bookshelfOperationClass('app/composition/ReaderReadingEntryActions.ets',
    'ReaderReadingEntryActions', { Observed: value => value });
  const entry = new (actualReadingEntryPresentation({ ReadingEntryHost: ProductionHost }))();
  const navigation = new ReaderNavigation();
  navigation.show('bookshelf');
  const runtime = () => owner;
  const source = { visible: false, failureMessage: '' };
  const entryPorts = capturedOwner => {
    const generation = navigation.snapshot().generation;
    return {
      current: () => capturedOwner === runtime() && generation === navigation.snapshot().generation,
      projectionVisible: () => navigation.snapshot().route === 'detail' && !entry.sessionActive && !source.visible,
      membership: () => ({ value: true, generation: 0, blocked: false }),
      cacheDecision: async () => false,
      notice: (...args) => failures.push(args),
      refreshShelf() {},
    };
  };
  const actions = new EntryActions(navigation, new ReaderEntryStartupTrace(() => {}), {
    runtime, mounting: () => 1, entry: () => entry,
    search: () => ({ host: { visibilityChanged() {} } }), sourceSwitch: () => source,
    shelfBooks: () => [book], removalPending: () => false, readerExitPending: () => false,
    advance: () => { entry.retire(); actions.retirePreparation(); return navigation.advance().generation; },
    show: route => navigation.show(route),
    bindReader: () => { calls.push('reader-mount-request'); entry.bindReader(owner, entryPorts(owner)); },
    restoreReaderReturn: () => false, entryPorts, sourceName: () => '本地书籍',
    failure: (...args) => failures.push(args), afterOpening: project => project(),
    postFrame: action => action(), refreshNearEnd() {},
  });
  return { entry, actions, navigation, owner, book, calls, failures, tocReads, statusReads,
    setBookmarks: rows => { bookmarks = rows.map(row => ({ bookName: book.title, bookAuthor: book.author,
      chapterIndex: 0, chapterName: '第一章', chapterPos: 0, content: '新书签', ...row })); } };

}
async function admit(f) {
  f.actions.openLocalDetail(f.book, true);
  assert.equal(f.entry.sessionActive, true);
  assert.equal(f.navigation.snapshot().route, 'reading');
  assert.deepEqual(f.calls, ['reader-mount-request'], 'PH116 entry does not wait for TOC/status/bookmark RPC');
}
{
  const f = fixture(); await admit(f);
  // The real reader's initial TOC callback publishes base rows, but optional
  // cache/bookmark work stays behind its durable first-page notification.
  f.entry.applyDirectoryProjection([{index:0,title:'第一章',navigable:true,downloadState:'unknown'}], f.owner);
  assert.deepEqual(f.calls, ['reader-mount-request']);
  f.actions.presentPreparedReading(0); await settle();
  assert.equal(f.navigation.snapshot().route, 'reading');
  assert.deepEqual(f.calls, ['reader-mount-request', 'cache.book.status'], 'optional cache metadata precedes the canonical shared bookmark projection');
  f.statusReads[0].resolve(); await settle();
  assert.equal(f.entry.toc[0].downloadState, 'completed');
  f.actions.presentPreparedReading(0); await settle();
  assert.equal(f.statusReads.length, 1, 'the first page consumes optional projection once');
  assert.deepEqual(f.failures, []);
}
{
  const f = fixture(); await admit(f);
  f.entry.retire(); f.actions.retirePreparation(); f.navigation.advance();
  f.entry.endReading(f.owner); f.navigation.show('bookshelf');
  f.actions.presentPreparedReading(0); await settle();
  assert.equal(f.navigation.snapshot().route, 'bookshelf');
  assert.equal(f.statusReads.length, 0, 'cancelled reader cannot enqueue optional detail work');
}
{
  const f = fixture(); await admit(f);
  f.entry.applyDirectoryProjection([{index:0,title:'第一章',navigable:true,downloadState:'unknown'}], f.owner);
  f.actions.presentPreparedReading(0); await settle();
  f.setBookmarks([{time:42,bookText:'新书签'}]);
  f.entry.toc[0].bookmarks = [{time:42,bookText:'最新书签'}];
  f.statusReads[0].resolve(); await settle();
  assert.equal(f.entry.toc[0].downloadState, 'completed');
  assert.equal(f.entry.toc[0].bookmarks[0].time, 42);
}
for (const cancel of [false, true]) {
  const f = fixture(); f.actions.openLocalDetail(f.book, false);
  assert.equal(f.navigation.snapshot().route, 'detail'); assert.equal(f.entry.sessionActive, false);
  if (cancel) { f.entry.retire(); f.actions.retirePreparation(); f.navigation.advance(); f.navigation.show('search'); }
  f.tocReads[0].resolve(); await settle();
  if (cancel) {
    assert.deepEqual(f.calls, ['local_book.toc']); assert.equal(f.navigation.snapshot().route, 'search');
  } else {
    assert.deepEqual(f.calls, ['local_book.toc', 'cache.book.status']);
    f.statusReads[0].resolve(); await settle();
    assert.equal(f.entry.toc[0].downloadState, 'completed');
  }
}
{
  const f = fixture(); f.actions.openLocalDetail(f.book, false);
  f.tocReads[0].resolve(); await settle();
  f.actions.openLocalDetail(f.book, true);
  f.statusReads[0].resolve(); await settle();
  assert.equal(f.navigation.snapshot().route, 'reading'); assert.equal(f.entry.toc.length, 0,
    'an old same-book detail projection cannot publish into a newly mounted reader');
}
{
  const f = fixture(); f.actions.openLocalDetail(f.book, false);
  f.tocReads[0].resolve(); await settle();
  f.setBookmarks([{time:42,bookText:'新书签'}]);
  f.entry.toc = f.entry.toc.map(entry => ({ ...entry, bookmarks: [{ time: 42, bookText: '新书签' }] }));
  f.statusReads[0].resolve(); await settle();
  assert.equal(f.entry.toc[0].downloadState, 'completed');
  assert.equal(f.entry.toc[0].bookmarks[0].time, 42, 'detail status cannot overwrite newer bookmark mutations');
}
console.log('PASS local direct entry before RPC; original detail projection, cancellation, same-book generation and bookmark mutation protection');
console.log('Evidence boundary: controlled Core replies and production methods; no native frame or device latency claim.');

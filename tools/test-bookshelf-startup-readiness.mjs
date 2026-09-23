import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const file = path => new URL(`../entry/src/main/ets/${path}`, import.meta.url);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };
const book = (id, chapter) => ({ sourceId: 's', bookId: String(id), title: String(id), author: '', currentChapterIndex: chapter,
  readingPosition: chapter === undefined ? undefined : { chapterIndex: chapter, chapterOffset: 0, updatedAt: 1 } });
const page = (books, total = books.length) => ({ books, total, unfilteredTotal: total, projectionRevision: 'same-read', changed: false });
const Flow = productionMotionMethods(file('features/bookshelf/BookshelfFlowGateway.ts'), ['load', 'loadPage', 'classify'], { BOOKSHELF_PAGE_SIZE: 48 });
function flow(filter = { readingState: 'all', sourceKind: 'all' }, supportsPages = true) {
  const first = deferred(), continued = deferred(), requests = [];
  let continueCalls = 0;
  const owner = Object.assign(new Flow(), { filter, bookshelf: {
    supportsShelfPages: () => supportsPages,
    loadBookshelf: params => { requests.push(params); return first.promise; },
    loadContinueReading: () => { continueCalls += 1; return continued.promise; },
  } });
  return { owner, first, continued, requests, continueCalls: () => continueCalls };
}

// A delayed or unavailable second query cannot hold an already authoritative
// unfiltered prefix; progress at chapter zero still counts as a real record.
{
  const f = flow(), recent = book(2, 0), older = book(3, 5);
  const firstPage = page([book(1), recent, older], 1000);
  let published;
  const load = f.owner.load().then(value => { published = value; });
  await settle(); assert.equal(published, undefined);
  f.first.resolve(firstPage); await load;
  assert.equal(published.shelf, firstPage);
  assert.equal(published.continueReading, recent, 'first progressed row in Core order owns the card');
  assert.equal(published.shelf.projectionRevision, 'same-read');
  assert.equal(f.continueCalls(), 0, 'card and rows publish together without a second Core request');
}
for (const books of [[], [book(1), book(2)]]) {
  const f = flow(); const load = f.owner.load(); f.first.resolve(page(books));
  const state = await load;
  assert.equal(state.continueReading, undefined);
  assert.equal(state.kind, books.length === 0 ? 'empty' : 'populated');
  assert.equal(f.continueCalls(), 0, 'complete no-progress shelf proves that no card exists');
}
for (const hasRealProgress of [false, true]) {
  const f = flow(); let published;
  const load = f.owner.load().then(value => { published = value; });
  const catalogOnly = { ...book(1, 0), readingPosition: undefined };
  const actual = hasRealProgress ? book(2, 7) : undefined;
  f.first.resolve(page(actual ? [catalogOnly, actual] : [catalogOnly])); await settle();
  assert.equal(published, undefined);
  assert.equal(f.continueCalls(), 1, 'catalog-only or malformed optional position cannot prove the first global progress record');
  f.continued.resolve(actual); await load; assert.equal(published.continueReading, actual);
}
{
  const f = flow(); let published;
  const load = f.owner.load().then(value => { published = value; });
  f.first.resolve(page([book(1)], 1000)); await settle();
  assert.equal(f.continueCalls(), 1); assert.equal(published, undefined);
  const global = book(999, 42); f.continued.resolve(global); await load;
  assert.equal(published.continueReading, global, 'truncated no-progress prefix retains the global card');
}
for (const filter of [{ readingState: 'unread', sourceKind: 'all' }, { readingState: 'all', sourceKind: 'local' }]) {
  const f = flow(filter); let published;
  const load = f.owner.load().then(value => { published = value; });
  assert.equal(f.continueCalls(), 1, 'filtered page keeps requests concurrent');
  f.first.resolve(page([book(1, 3)])); await settle(); assert.equal(published, undefined);
  const global = book(9, 100); f.continued.resolve(global); await load;
  assert.equal(published.continueReading, global, 'filtered progress is not a global summary');
}
{
  const f = flow({ readingState: 'all', sourceKind: 'online' });
  const load = f.owner.load(); const global = book(9, 2);
  f.continued.resolve(global); await settle(); f.first.resolve({ ...page([], 0), unfilteredTotal: 4 });
  const state = await load; assert.equal(state.kind, 'populated'); assert.equal(state.continueReading, global);
}
{
  const f = flow(), load = f.owner.load();
  f.first.resolve({ ...page([], 50), changed: true });
  await assert.rejects(load, /BOOKSHELF_PROJECTION_CHANGED/);
  assert.equal(f.continueCalls(), 0, 'changed first revision cannot publish or trigger a follow-up');
}
{
  const f = flow(), load = f.owner.load();
  f.first.resolve(page([book(1)], 50)); await settle(); f.continued.reject(Error('summary failed'));
  await assert.rejects(load, /summary failed/, 'unknown card failure retains the existing retry path');
}
{
  const f = flow(undefined, false), load = f.owner.load(), recent = book(1, 0);
  f.first.resolve(page([recent])); assert.equal((await load).continueReading, recent);
  assert.equal(f.continueCalls(), 0); assert.equal(f.requests[0].pageProjection, undefined, 'legacy Core contract stays unchanged');
}

const Store = productionMotionMethods(file('features/sync/WebDavCredentialStore.ts'), [
  'attachContext', 'currentBookshelfViewMode', 'loadBookshelfViewMode', 'saveBookshelfViewMode',
  'readOrMigrateViewMode', 'writeLocalViewMode', 'validateRestoreJournal',
], { LOCAL_VIEW_MODE_KEY: 'mode', LOCAL_MIGRATION_KEY: 'version', LOCAL_CONFIG_VERSION: 1, LOCAL_RESTORE_JOURNAL_KEY: 'journal' });
function storeFixture() {
  const values = new Map([['mode', 'list'], ['version', 1]]);
  let gets = 0, failRead = false, nextFlush;
  const backend = { has: async key => values.has(key), get: async (key, fallback) => {
    gets += 1; if (failRead) { failRead = false; throw Error('read failed'); }
    return values.has(key) ? values.get(key) : fallback;
  }, put: async (key, value) => values.set(key, value), delete: async key => values.delete(key),
  flush: async () => { if (nextFlush) { const flush = nextFlush; nextFlush = undefined; await flush.promise; } } };
  const store = Object.assign(new Store(), { localModeWriteTail: Promise.resolve(), contextGeneration: 0,
    pendingBookshelfModeWrites: 0, confirmedBookshelfMode: undefined, context: {},
    ensureLocalPreferences: async () => backend, load: async () => null });
  return { store, gets: () => gets, failRead: () => { failRead = true; }, gate: () => { nextFlush = deferred(); return nextFlush; } };
}
{
  const f = storeFixture(); assert.equal(f.store.currentBookshelfViewMode(), undefined);
  await f.store.loadBookshelfViewMode(); const gets = f.gets();
  assert.equal(f.store.currentBookshelfViewMode(), 'list'); assert.equal(f.gets(), gets, 'acknowledged mode is a synchronous snapshot');
  const gate = f.gate(), save = f.store.saveBookshelfViewMode('cover');
  assert.equal(f.store.currentBookshelfViewMode(), undefined, 'a queued write fences the snapshot before its first await');
  let remountMode; const remount = f.store.loadBookshelfViewMode().then(mode => { remountMode = mode; });
  await settle(); assert.equal(remountMode, undefined); gate.resolve(); await Promise.all([save, remount]);
  assert.equal(remountMode, 'cover'); assert.equal(f.store.currentBookshelfViewMode(), 'cover');
}
{
  const f = storeFixture(); await f.store.loadBookshelfViewMode();
  const gate = f.gate(), save = f.store.saveBookshelfViewMode('cover');
  await settle(); gate.reject(Error('flush failed')); await assert.rejects(save, /flush failed/);
  assert.equal(f.store.currentBookshelfViewMode(), undefined, 'failed persistence must be reread');
  assert.equal(await f.store.loadBookshelfViewMode(), 'list', 'retry reads rolled-back durable choice');
  f.failRead(); await assert.rejects(f.store.loadBookshelfViewMode(), /read failed/);
  assert.equal(f.store.currentBookshelfViewMode(), undefined);
  assert.equal(await f.store.loadBookshelfViewMode(), 'list', 'read failure remains retryable');
}
{
  const f = storeFixture(); await f.store.loadBookshelfViewMode();
  const gate = f.gate(), save = f.store.saveBookshelfViewMode('cover'); await settle();
  f.store.attachContext({}); gate.resolve(); await save;
  assert.equal(f.store.currentBookshelfViewMode(), undefined, 'old-context acknowledgement cannot populate a new-context snapshot');
  assert.equal(await f.store.loadBookshelfViewMode(), 'cover');
}
{
  const f = storeFixture(); await f.store.loadBookshelfViewMode();
  const gate = f.gate(), first = f.store.saveBookshelfViewMode('cover'), second = f.store.saveBookshelfViewMode('list');
  await settle(); assert.equal(f.store.currentBookshelfViewMode(), undefined); gate.resolve(); await Promise.all([first, second]);
  assert.equal(f.store.currentBookshelfViewMode(), 'list', 'serialized writes publish the last acknowledgement');
}

const Page = productionMotionMethods(file('features/bookshelf/BookshelfPage.ets'), ['aboutToAppear', 'loadViewMode', 'retryViewMode'], { registerReaderFonts() {} });
function pageFixture(confirmed, pending) {
  let reads = 0, builds = 0;
  const owner = Object.assign(new Page(), { mounted: false, viewModeRevision: 0, storedViewMode: 'cover', viewSwitchRunning: false,
    webDavCredentials: { currentBookshelfViewMode: () => confirmed, loadBookshelfViewMode: () => { reads += 1; return pending.promise; } },
    viewState: { filterExpanded: false }, getUIContext: () => ({ getFont() {} }),
    setRestingProjectionOpacity() {}, resetViewSwitchMotion() {}, rebuildShelfProjection() { builds += 1; },
  });
  return { owner, reads: () => reads, builds: () => builds };
}
{
  const f = pageFixture('list', deferred()); f.owner.aboutToAppear();
  assert.equal(f.reads(), 0); assert.equal(f.builds(), 1); assert.equal(f.owner.viewMode, 'list');
  assert.equal(f.owner.storedViewMode, 'list', 'durable snapshot replaces a stale optimistic AppStorage value');
}
{
  const pending = deferred(), f = pageFixture(undefined, pending); f.owner.aboutToAppear();
  assert.equal(f.reads(), 1); pending.resolve('cover'); await settle();
  assert.equal(f.builds(), 1, 'fallback read confirming the same mode does not rebuild identical rows');
}
{
  const pending = deferred(), f = pageFixture(undefined, pending); f.owner.aboutToAppear();
  pending.reject(Error('read')); await settle(); assert.equal(f.owner.viewModeReadFailed, true);
  f.owner.webDavCredentials.loadBookshelfViewMode = async () => 'list'; f.owner.retryViewMode(); await settle();
  assert.equal(f.owner.viewMode, 'list'); assert.equal(f.builds(), 2, 'successful retry applies a genuinely changed projection');
}
{
  const pending = deferred(), f = pageFixture(undefined, pending); f.owner.aboutToAppear();
  f.owner.mounted = false; f.owner.viewModeRevision += 1; pending.resolve('list'); await settle();
  assert.equal(f.owner.viewMode, 'cover'); assert.equal(f.builds(), 1, 'detached page rejects a late read');
}
console.log('PASS bookshelf startup readiness: authoritative first-page card, global filtered/truncated fallback, delayed/failing reads, acknowledged mode reuse, write/restore context fencing and no duplicate projection');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { loadReaderControlBookmarkProjection, mergeReaderControlBookmarkProjection }
  from '../entry/src/main/ets/features/reading/ReaderControlBookmarkLoad.ts';
import * as sessionPolicy from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';

const indexSource = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
const methods = indexSource.slice(indexSource.indexOf('  private deleteDirectoryBookmarks('),
  indexSource.indexOf('  private async loadRemoteDirectoryProjection('));
let activeGateway;
const IndexProbe = new Function('mergeReaderControlBookmarkProjection', 'loadReaderControlBookmarkProjection',
  'LocalReadingFlowGateway', 'ReaderRuntimeOwner', 'LOCAL_SOURCE_ID', 'hilog', 'DOMAIN',
  `${stripTypeScriptTypes(`class IndexProbe { ${methods} }`)}; return IndexProbe;`)(
  mergeReaderControlBookmarkProjection, loadReaderControlBookmarkProjection,
  function Gateway() { return activeGateway; }, { current() {} }, 'local', { error() {} }, 0);
const book = { sourceId: 'remote-A', bookId: 'book-A', title: 'Book A', author: 'Author A' };
const row = (bookmarks = [], title = 'Chapter A', downloadState = 'completed') =>
  ({ index: 0, title, downloadState, bookmarks });
const mark = time => ({ time, chapterIndex: 0, chapterOffset: 12, chapterTitle: 'Chapter A', content: 'saved' });
function makeOwner() {
  const owner = new IndexProbe();
  Object.assign(owner, { detailBook: book, detailToc: [row()], readingSessionActive: true,
    navigationGeneration: 7, directoryBookmarkMutationGeneration: 0,
    directoryBookmarkMutationActiveKey: '', directoryBookmarkProjectionFailureMessage: '',
    directoryBookmarkProjectionFailureKey: '', directoryBookmarkProjectionFailureGeneration: -1 });
  return owner;
}
function admission(owner) {
  const generation = owner.beginDirectoryBookmarkMutation(book);
  const key = owner.directoryBookmarkMutationKey(book);
  return { generation, key, guard: () => owner.isDirectoryBookmarkMutationCurrent(generation, key) &&
    owner.detailBook === book && owner.navigationGeneration === 7 };
}
const request = { chapterIndex: 0, chapterOffset: 12, chapterTitle: 'Chapter A', bookmarkTimes: [] };
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => {
  resolve = yes; reject = no; }); return { promise, resolve, reject }; };

for (const mode of ['chapter', 'position', 'delete']) {
  const owner = makeOwner();
  let canonical = mode === 'delete' ? [mark(1)] : [];
  if (mode === 'delete') owner.detailToc = [row(canonical)];
  let writes = 0;
  let reads = 0;
  activeGateway = {
    async createChapterStartBookmark() { writes++; canonical = [mark(2)]; },
    async createPositionBookmark() { writes++; canonical = [mark(2)]; },
    async deleteBookmark() { writes++; canonical = []; return true; },
    async loadBookmarkProjection() { reads++; throw new Error('read failed after committed write'); },
  };
  const ticket = admission(owner);
  const method = mode === 'chapter' ? 'performDirectoryChapterStartBookmarkCreation' :
    mode === 'position' ? 'performReaderPageBookmarkCreation' : 'performDirectoryBookmarkDeletion';
  await owner[method](activeGateway, book, mode === 'delete' ? [1] : request,
    ticket.guard, ticket.generation, ticket.key);
  assert.equal(writes, 1);
  assert.equal(reads, 1);
  assert.equal(owner.detailToc[0].bookmarks, undefined,
    `${mode}: committed mutation plus failed reload must invalidate stale bookmark facts`);
  assert.equal(owner.detailToc[0].title, 'Chapter A');
  assert.equal(owner.detailToc[0].downloadState, 'completed');
  assert.match(owner.controlBookmarkProjectionMessage(), /已更新.*重新载入/);
  assert.equal(owner.directoryBookmarkMutationActiveKey, '', 'failure releases only its mutation lock');
  assert.equal(owner.beginDirectoryBookmarkMutation(book), -1, 'unknown outcome cannot be blindly written again');
  activeGateway.loadBookmarkProjection = async () => { reads++; return [row(canonical)]; };
  await owner.loadControlBookmarks(book.sourceId, book.bookId, () => true);
  assert.equal(writes, 1, 'retry only lists canonical bookmarks; it never replays mutation');
  assert.equal(reads, 2);
  assert.deepEqual(owner.detailToc[0].bookmarks, canonical, 'confirmed empty is allowed after a fresh read');
  assert.equal(owner.controlBookmarkProjectionMessage(), '');
  assert.ok(owner.beginDirectoryBookmarkMutation(book) > ticket.generation, 'confirmed read restores CRUD admission');
}

// A transport error can occur after Core applied the write; no rollback or false "not saved" claim.
{
  const owner = makeOwner(); let canonical = []; let writes = 0;
  activeGateway = { async createPositionBookmark() { writes++; canonical = [mark(4)]; throw Error('lost reply'); },
    async loadBookmarkProjection() { return [row(canonical)]; } };
  const ticket = admission(owner);
  await owner.performReaderPageBookmarkCreation(activeGateway, book, request,
    ticket.guard, ticket.generation, ticket.key);
  assert.match(owner.controlBookmarkProjectionMessage(), /结果未确认.*不要重复/);
  assert.equal(owner.detailToc[0].bookmarks, undefined);
  await owner.loadControlBookmarks(book.sourceId, book.bookId, () => true);
  assert.equal(writes, 1); assert.equal(owner.detailToc[0].bookmarks[0].time, 4);
}
// Multiple deletes are not one atomic write. Preserve confirmed progress, verify the uncertain remainder.
{
  const owner = makeOwner(); let canonical = [mark(1), mark(2)]; let calls = 0;
  owner.detailToc = [row(canonical)];
  activeGateway = { async deleteBookmark(time) { calls++;
    if (calls === 2) throw Error('second reply unknown');
    canonical = canonical.filter(entry => entry.time !== time); return true; },
  async loadBookmarkProjection() { return [row(canonical)]; } };
  const ticket = admission(owner);
  await owner.performDirectoryBookmarkDeletion(activeGateway, book, [1, 2],
    ticket.guard, ticket.generation, ticket.key);
  assert.match(owner.controlBookmarkProjectionMessage(), /部分.*已更新.*不要重复/);
  await owner.loadControlBookmarks(book.sourceId, book.bookId, () => true);
  assert.equal(calls, 2); assert.deepEqual(owner.detailToc[0].bookmarks.map(entry => entry.time), [2]);
}
// Late failure cannot mutate another book or clear a newer transaction owner.
{
  const owner = makeOwner(); const pending = deferred();
  const ticket = admission(owner);
  const run = owner.performReaderPageBookmarkCreation({ createPositionBookmark: () => pending.promise },
    book, request, ticket.guard, ticket.generation, ticket.key);
  owner.detailBook = { ...book, bookId: 'book-B' }; owner.detailToc = [row([mark(9)])];
  owner.directoryBookmarkMutationGeneration++; owner.directoryBookmarkMutationActiveKey = 'new-owner';
  pending.reject(Error('late failure')); await run;
  assert.equal(owner.directoryBookmarkMutationActiveKey, 'new-owner');
  assert.equal(owner.directoryBookmarkProjectionFailureMessage, '');
  assert.equal(owner.detailToc[0].bookmarks[0].time, 9);
}
// A download/title projection changes while the committed mutation is being re-read.
{
  const owner = makeOwner(); const pending = deferred(); const ticket = admission(owner);
  activeGateway = { async createPositionBookmark() {}, loadBookmarkProjection: () => pending.promise };
  const run = owner.performReaderPageBookmarkCreation(activeGateway, book, request,
    ticket.guard, ticket.generation, ticket.key);
  await Promise.resolve(); owner.detailToc = [row([], 'Latest title', 'queued')];
  pending.resolve([row([mark(6)])]); await run;
  assert.equal(owner.detailToc[0].title, 'Latest title');
  assert.equal(owner.detailToc[0].downloadState, 'queued');
  assert.equal(owner.detailToc[0].bookmarks[0].time, 6);
}
// Execute real Host watchers/loading, including either ArkUI prop delivery order.
const hostSource = readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url), 'utf8');
const hostMethods = hostSource.slice(hostSource.indexOf('  private loadControlBookmarks('),
  hostSource.indexOf('  private async loadAppearanceSnapshot('));
const HostProbe = new Function('readerControlContentLocation', 'hilog',
  `${stripTypeScriptTypes(`class HostProbe { ${hostMethods} }`)}; return HostProbe;`)(
  sessionPolicy.readerControlContentLocation, { warn() {} });
const flush = () => new Promise(resolve => setImmediate(resolve));
for (const messageFirst of [false, true]) {
  const owner = new HostProbe();
  owner.reconcilePageBookmarkFeedback = () => {}; let reads = 0; const notices = [];
  Object.assign(owner, { mounted: true, exitRequested: false, lifecycleToken: 1,
    sourceId: book.sourceId, bookId: book.bookId, controlOpenRevision: 1,
    controlSession: sessionPolicy.enterReaderControlModule(sessionPolicy.openReaderControlSession(
      sessionPolicy.createReaderControlSessionState(), 0), 'directory', 0),
    controlVisible: () => true, isSessionActive: token => token === 1,
    controlBookmarkLoadGeneration: 0, controlBookmarkLoadPending: false, controlBookmarkLoadFailed: false,
    appForeground: true, windowChromeActive: true, controlBookmarkFailureNoticeKey: '',
    getUIContext: () => ({ getPromptAction: () => ({ showToast: notice => notices.push(notice.message) }) }),
    directoryEntries: [row()], bookmarkLoadMessage: '', errorMessage: error => error.message,
    onLoadControlBookmarks: async () => { reads++; throw Error('list failed'); } });
  const deliverMessage = () => { owner.bookmarkLoadMessage = '书签已更新，但列表载入失败，请重新载入核对';
    if (owner.onControlBookmarkFailureChanged) owner.onControlBookmarkFailureChanged(); };
  const deliverRows = () => { owner.directoryEntries = [row(undefined)];
    // row() defaults to [], so explicitly model unknown canonical projection.
    owner.directoryEntries[0].bookmarks = undefined;
    owner.onControlDirectoryDataChanged(); };
  if (messageFirst) { deliverMessage(); deliverRows(); } else { deliverRows(); deliverMessage(); }
  await flush();
  assert.equal(owner.controlBookmarkLoadFailed, true);
  assert.equal(reads, 0, 'mutation failure cannot silently auto-loop, irrespective of prop order');
  assert.equal(owner.controlBookmarkLoadPending, false);
  assert.equal(notices.length, 1, 'mutation failure produces one nonblocking notice even outside bookmark tab');
  assert.match(notices[0], /已更新.*目录.*书签.*重新载入/);
  owner.onControlBookmarkFailureChanged(); owner.onControlDirectoryDataChanged();
  assert.equal(notices.length, 1, 'the same failure/watch or motion-related data delivery never repeats its toast');
  owner.loadControlBookmarks(); await flush();
  assert.equal(reads, 1, 'explicit retry invokes only the canonical list callback');
  assert.equal(owner.controlBookmarkLoadFailed, true);
  owner.directoryEntries = [row([])]; owner.onControlDirectoryDataChanged();
  assert.equal(owner.controlBookmarkLoadFailed, true, 'old confirmed rows cannot erase explicit mutation uncertainty');
  owner.onLoadControlBookmarks = async () => { reads++; owner.directoryEntries = [row([mark(8)])];
    owner.onControlDirectoryDataChanged(); owner.bookmarkLoadMessage = '';
    owner.onControlBookmarkFailureChanged(); };
  owner.loadControlBookmarks(); await flush();
  assert.equal(reads, 2); assert.equal(owner.controlBookmarkLoadFailed, false);
  assert.equal(owner.controlBookmarkLoadPending, false);
  owner.bookmarkLoadMessage = '书签操作结果未确认，请重新载入核对，不要重复操作';
  owner.onControlBookmarkFailureChanged();
  assert.equal(notices.length, 2); assert.match(notices[1], /结果未确认.*不要重复/);
  for (const invalidation of ['mounted', 'appForeground', 'windowChromeActive', 'exitRequested']) {
    owner.bookmarkLoadMessage = `${invalidation}: 旧上下文失败`;
    owner[invalidation] = invalidation === 'exitRequested';
    owner.onControlBookmarkFailureChanged();
    assert.equal(notices.length, 2, 'inactive/exited owner cannot produce a new notice');
    owner[invalidation] = invalidation !== 'exitRequested';
  }
  owner.getUIContext = () => { throw Error('detached context'); };
  owner.bookmarkLoadMessage = '新的已更新但待核实状态';
  assert.doesNotThrow(() => owner.onControlBookmarkFailureChanged(), 'native toast exceptions remain contained');
  assert.equal(owner.controlBookmarkLoadFailed, true, 'toast availability cannot erase actionable error state');
}
console.log('Bookmark mutation recovery: actual Index CRUD/reload and Host error/retry functions PASS; not native acceptance');

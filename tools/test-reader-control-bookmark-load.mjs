import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as sessionPolicy from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';

const readingRoot = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const hostSource = readFileSync(new URL('LocalReadingExperience.ets', readingRoot), 'utf8');
const prepare = hostSource.slice(hostSource.indexOf('  private prepareControlPage('),
  hostSource.indexOf('  private async loadAppearanceSnapshot('));
assert.match(prepare, /page === 'moduleDirectory'[\s\S]*loadControlBookmarks\(\)/,
  'opening the in-reader directory must request its bookmark projection');

const { loadReaderControlBookmarkProjection, mergeReaderControlBookmarkProjection } =
  await import('../entry/src/main/ets/features/reading/ReaderControlBookmarkLoad.ts');
const row = (index, bookmarks, downloadState = 'unknown', title = `Chapter ${index}`) =>
  ({ index, title, level: index + 1, downloadState, bookmarks });
const bookmark = (time) => ({ time, chapterIndex: 1, chapterOffset: 12,
  chapterTitle: 'Chapter 1', content: `saved ${time}` });
const confirmed = [row(0, []), row(1, [bookmark(10)])];
const unknown = [row(0, undefined), row(1, undefined)];
assert.deepEqual(mergeReaderControlBookmarkProjection(unknown, confirmed), confirmed);
assert.deepEqual(mergeReaderControlBookmarkProjection(unknown, [row(0, []), row(1, [])]),
  [row(0, []), row(1, [])], 'confirmed empty is not unknown');
assert.throws(() => mergeReaderControlBookmarkProjection(unknown, unknown), /incomplete/);
assert.deepEqual(mergeReaderControlBookmarkProjection(unknown, [row(0, [])]),
  [row(0, []), row(1, undefined)], 'uncovered new chapters remain unknown, not manufactured empty');
assert.throws(() => mergeReaderControlBookmarkProjection(unknown, [row(0, []), row(0, [])]), /duplicate/);
const latest = [row(0, undefined, 'completed', 'Converted title'), row(1, [], 'queued')];
const merged = mergeReaderControlBookmarkProjection(latest, confirmed);
assert.equal(merged[0].downloadState, 'completed');
assert.equal(merged[1].downloadState, 'queued');
assert.equal(merged[0].title, 'Converted title');
assert.equal(merged[1].level, 2, 'bookmark refresh preserves the current EPUB directory hierarchy');
assert.equal(merged[1].bookmarks[0].time, 10);
assert.equal(latest[0].bookmarks, undefined, 'no in-place mutation');

const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let current = unknown;
let sessionCurrent = true;
let sessionRevision = 1;
let mutationRevision = 0;
let activeMutation = false;
let writes = 0;
let reads = 0;
const attempt = (pending) => {
  const revision = mutationRevision;
  const openRevision = sessionRevision;
  return loadReaderControlBookmarkProjection({
    isCurrent: () => sessionCurrent && openRevision === sessionRevision &&
      revision === mutationRevision && !activeMutation,
    currentEntries: () => current,
    read: async () => { reads++; return pending.promise; },
    commit: entries => { writes++; current = entries; },
  });
};
let pending = deferred();
let run = attempt(pending);
current = latest;
pending.resolve(confirmed);
await run;
assert.equal(current[0].downloadState, 'completed', 'download completing during read is retained');
assert.equal(current[0].title, 'Converted title');
assert.equal(writes, 1);

for (const invalidate of [
  () => { sessionCurrent = false; },
  () => { sessionRevision += 2; }, // A -> B -> A: identity text alone is insufficient.
  () => { mutationRevision++; current = [row(0, []), row(1, [bookmark(20)])]; },
  () => { activeMutation = true; },
]) {
  sessionCurrent = true; activeMutation = false;
  pending = deferred(); run = attempt(pending);
  invalidate();
  pending.resolve(confirmed);
  await assert.rejects(run, /superseded/);
  assert.equal(writes, 1, 'old session/book or CRUD-crossed read cannot commit');
}
sessionCurrent = true; activeMutation = true;
const beforeRead = reads;
await assert.rejects(attempt(deferred()), /superseded/);
assert.equal(reads, beforeRead, 'active mutation cannot admit an old read');
activeMutation = false;
pending = deferred(); run = attempt(pending);
pending.reject(new Error('Core bookmark read timed out'));
await assert.rejects(run, /timed out/);
assert.equal(writes, 1, 'failure does not manufacture empty bookmarks');
pending = deferred(); run = attempt(pending);
pending.resolve(confirmed);
await run;
assert.equal(writes, 2, 'a failed request does not lock out explicit retry');
pending = deferred(); run = attempt(pending);
current = [row(0, []), row(1, []), row(2, undefined)];
pending.resolve(confirmed);
await assert.rejects(run, /incomplete/);
assert.equal(writes, 2, 'catalog growth cannot admit an incomplete read as ready');

// Execute the actual ordinary Host methods, with only platform/business callbacks mocked.
const hostMethods = hostSource.slice(hostSource.indexOf('  private loadControlBookmarks('),
  hostSource.indexOf('  private async loadAppearanceSnapshot('));
const HostProbe = new Function('readerControlContentLocation', 'hilog',
  `${stripTypeScriptTypes(`class HostProbe { ${hostMethods} }`)}\nreturn HostProbe;`)(
  sessionPolicy.readerControlContentLocation, { warn() {} });
const owner = new HostProbe();
  owner.reconcilePageBookmarkFeedback = () => {};
const quick = sessionPolicy.enterReaderControlModule(sessionPolicy.openReaderControlSession(
  sessionPolicy.createReaderControlSessionState(), 0), 'directory', 0);
const requests = [];
Object.assign(owner, { mounted: true, exitRequested: false, controlSession: quick,
  lifecycleToken: 4, sourceId: 'source-A', bookId: 'book-A', controlOpenRevision: 1,
  controlBookmarkLoadGeneration: 0, controlBookmarkLoadFailed: false, controlBookmarkLoadPending: false,
  bookmarkLoadMessage: '',
  directoryEntries: unknown, controlVisible: () => true,
  isSessionActive: token => token === owner.lifecycleToken && owner.mounted,
  errorMessage: error => error.message,
  onLoadControlBookmarks: (sourceId, bookId, guard) => {
    const pending = deferred(); requests.push({ ...pending, sourceId, bookId, guard }); return pending.promise;
  },
});
const flush = () => new Promise(resolve => setImmediate(resolve));
owner.loadControlBookmarks();
await flush();
assert.equal(owner.controlBookmarkLoadPending, true);
requests[0].reject(new Error('bookmark.list unavailable'));
await flush();
assert.equal(owner.controlBookmarkLoadFailed, true);
assert.equal(owner.controlBookmarkLoadPending, false);
owner.onControlDirectoryDataChanged();
await flush();
assert.equal(requests.length, 1, 'a failed unknown projection does not auto-loop');
owner.loadControlBookmarks();
await flush();
assert.equal(owner.controlBookmarkLoadFailed, false);
assert.equal(requests.length, 2, 'explicit retry starts a new real callback');
owner.controlOpenRevision++;
owner.loadControlBookmarks();
await flush();
assert.equal(requests[1].guard(), false);
requests[1].reject(new Error('old request'));
await flush();
assert.equal(owner.controlBookmarkLoadFailed, false, 'old request cannot put the reopened session in error');
assert.equal(owner.controlBookmarkLoadPending, true, 'old finally cannot clear new pending state');
requests[2].resolve();
await flush();
assert.equal(owner.controlBookmarkLoadPending, false);
owner.onLoadControlBookmarks = () => { throw new Error('synchronous callback failure'); };
owner.loadControlBookmarks();
await flush();
assert.equal(owner.controlBookmarkLoadFailed, true, 'sync callback failure is caught, not an unhandled crash');
owner.directoryEntries = confirmed;
owner.onControlDirectoryDataChanged();
assert.equal(owner.controlBookmarkLoadFailed, false, 'a confirmed concurrent CRUD projection supplies ready facts');

// Opposite ordering: CRUD confirmation arrives before the superseded read rejects.
for (const admitted of [confirmed, [row(0, []), row(1, [])]]) {
  owner.directoryEntries = unknown;
  const late = deferred();
  owner.onLoadControlBookmarks = () => late.promise;
  owner.loadControlBookmarks();
  await flush();
  owner.directoryEntries = admitted;
  owner.onControlDirectoryDataChanged();
  assert.equal(owner.controlBookmarkLoadFailed, false);
  late.reject(new Error('old read superseded by confirmed CRUD'));
  await flush();
  assert.equal(owner.controlBookmarkLoadFailed, false,
    'a late read failure cannot replace confirmed CRUD facts with an error screen');
  assert.equal(owner.controlBookmarkLoadPending, false);
  assert.strictEqual(owner.directoryEntries, admitted, 'Host never rewrites canonical bookmark facts');
}
owner.directoryEntries = unknown;
const partial = deferred();
owner.onLoadControlBookmarks = () => partial.promise;
owner.loadControlBookmarks();
await flush();
owner.directoryEntries = [row(0, []), row(1, undefined)];
owner.onControlDirectoryDataChanged();
partial.reject(new Error('projection remains incomplete'));
await flush();
assert.equal(owner.controlBookmarkLoadFailed, true,
  'one remaining unknown chapter still requires an actionable error/retry state');
assert.equal(owner.controlBookmarkLoadPending, false);

// Structural wiring only, separate from the actual production-function cases above.
const panel = readFileSync(new URL('ReaderControlPanel.ets', readingRoot), 'utf8');
assert.match(panel, /bookmarkLoadFailed: this\.bookmarkLoadFailed/);
assert.match(panel, /onRetryBookmarkLoad:.*this\.onRetryBookmarkLoad\(\)/);
assert.match(hostSource, /bookmarkLoadFailed: this\.controlBookmarkLoadFailed/);
assert.match(hostSource, /onRetryBookmarkLoad:.*this\.loadControlBookmarks\(\)/);
const index = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
const loader = index.slice(index.indexOf('  private loadControlBookmarks('),
  index.indexOf('  private reloadDirectoryBookmarkProjection('));
assert.match(loader, /directoryBookmarkMutationGeneration/);
assert.match(loader, /directoryBookmarkMutationActiveKey/);
assert.match(loader, /navigationGeneration/);
assert.match(loader, /loadReaderControlBookmarkProjection/);
assert.doesNotMatch(loader, /this\.route\s*=/);
const downloads = index.slice(index.indexOf('  private downloadDirectoryChapter('),
  index.indexOf('  private requestClearDirectoryBookOffline('));
assert.doesNotMatch(downloads, /loadBookmarkProjection/,
  'download completion must not own a second stale bookmark read');
assert.match(downloads, /mergeDirectoryBookmarks\(entries, this\.detailToc\)/);
const crud = index.slice(index.indexOf('  private async performDirectoryChapterStartBookmarkCreation('),
  index.indexOf('  private loadControlBookmarks('));
assert.equal((crud.match(/mergeReaderControlBookmarkProjection\(this\.detailToc, entries\)/g) ?? []).length, 3,
  'all three CRUD refresh paths preserve latest downloads and titles');
const refresh = hostSource.slice(hostSource.indexOf('  private onControlDirectoryDataChanged('),
  hostSource.indexOf('  private async loadAppearanceSnapshot('));
assert.match(refresh, /!this\.controlBookmarkLoadPending && !this\.controlBookmarkLoadFailed/);
assert.match(hostSource, /generation === this\.controlBookmarkLoadGeneration[\s\S]*openRevision === this\.controlOpenRevision/);
console.log('Reader control bookmarks: production merge/async ownership/failure retry PASS; wiring assertions are not native acceptance');

// A post-refresh bookmark reload must not replace independent TOC admission.
// In particular, Core volume headings remain non-navigable after the merge.
{
 const toc=[{index:0,title:'第一卷',navigable:false,downloadState:'unknown',bookmarks:[]},
  {index:1,title:'第一章',navigable:true,downloadState:'completed',bookmarks:[]}];
 const original=structuredClone(toc);
 const projection=[{index:0,title:'stale title',navigable:true,downloadState:'missing',bookmarks:[]},
  {index:1,title:'stale chapter',navigable:false,downloadState:'unknown',bookmarks:[bookmark(99)]}];
 let admitted;
 await loadReaderControlBookmarkProjection({isCurrent:()=>true,currentEntries:()=>toc,read:async()=>projection,commit:rows=>admitted=rows});
 assert.equal(admitted[0].navigable,false,'bookmark reload cannot turn a volume heading into a readable chapter');
 assert.equal(admitted[1].navigable,true,'bookmark projection cannot override current chapter admission');
 assert.equal(admitted[1].downloadState,'completed');assert.equal(admitted[1].title,'第一章');
 assert.equal(admitted[1].bookmarks[0].time,99);assert.deepEqual(toc,original);
}
console.log('PASS real post-refresh bookmark load/merge preserves volume heading and chapter navigability, current title/download facts and original TOC');

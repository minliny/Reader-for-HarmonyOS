import { MangaBookPresentation } from '../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { mangaDirectoryPresentation, mangaDirectoryVisibleEntries, mangaDirectoryIsGroup } from '../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts';
import { projectReaderDirectoryEntries } from '../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts';
import { snapshotReaderDirectoryData, sameReaderDirectoryData } from '../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts';

const base = new URL('../entry/src/main/ets/', import.meta.url);
const entries = [
  { index: 7, title: '外卷', level: 1, navigable: false, downloadState: 'unknown' },
  { index: 17, title: '内卷', level: 2, navigable: false, downloadState: 'unknown' },
  { index: 23, title: '内卷的话', level: 3, navigable: true, downloadState: 'unknown' },
  { index: 29, title: '卷外的话', level: 1, navigable: true, downloadState: 'unknown' },
  { index: 41, title: '禁用卷字', level: 1, navigable: false, downloadState: 'unknown' },
  { index: 53, title: '另一话', level: 1, navigable: true, downloadState: 'unknown' },
];
const model = mangaDirectoryPresentation(entries);
assert.deepEqual(model.get(23).ancestorGroupIndexes, [7, 17]);
assert.deepEqual(model.get(29).ancestorGroupIndexes, []);
assert.equal(model.get(41).group, false);
assert.deepEqual(mangaDirectoryVisibleEntries(entries, model, [7]).map(row => row.index), [7, 29, 41, 53]);
assert.deepEqual(mangaDirectoryVisibleEntries(entries, model, [17]).map(row => row.index), [7, 17, 29, 41, 53]);

const Detail = productionMotionMethods(new URL('features/bookshelf/LocalBookDetail.ets', base),
  ['visibleToc', 'chapterIsGroup', 'chapterIndent', 'onBookChanged', 'onTocChanged'], {
    mangaDirectoryPresentation, mangaDirectoryVisibleEntries, mangaDirectoryIsGroup, CHAPTER_PREVIEW_LIMIT: 20,
  });
const detail = Object.assign(new Detail(), { toc: entries, book: { sourceId: 's', bookId: 'b', contentKind: 'manga' },
  collapsedGroups: [7, 17], collapseIdentity: 's\0b' });
assert.deepEqual(detail.visibleToc().map(row => row.index), [7, 29, 41, 53]);
detail.collapsedGroups = [17];
assert.deepEqual(detail.visibleToc().map(row => row.index), [7, 17, 29, 41, 53]);
assert.equal(detail.chapterIsGroup(entries[4]), false, 'disabled row does not fold later independent chapters');
assert.equal(detail.chapterIndent(entries[3]), 10, 'a root target is not indented under a prior volume');
detail.book = { ...detail.book, bookId: 'other' }; detail.onBookChanged();
assert.deepEqual(detail.collapsedGroups, [], 'equal indexes in another book do not inherit old folds');
detail.collapsedGroups = [7]; detail.toc = entries.map(row => row.index === 7 ? { ...row, title: '新外卷' } : row);
detail.onTocChanged(); assert.deepEqual(detail.collapsedGroups, [], 'renamed/reused group facts discard detail collapse');

const timers = [], scrolls = [];
const Page = productionMotionMethods(new URL('features/bookshelf/BookDirectoryPage.ets', base),
  ['identity', 'admitEntries', 'mangaGroupFor', 'mangaIsGroup', 'mangaVisibleEntries', 'locateCurrent', 'selectMangaEntry', 'rowIsCurrent'], {
    mangaDirectoryPresentation, mangaDirectoryVisibleEntries, snapshotReaderDirectoryData, sameReaderDirectoryData,
    projectReaderDirectoryEntries, ScrollAlign: { CENTER: 'center' }, setTimeout: fn => timers.push(fn),
  });
const page = Object.assign(new Page(), { sourceId: 's', bookId: 'b', mounted: true, entries,
  admittedIdentity: '', admittedEntries: [], projectedEntries: [], mangaCollapsedGroups: [],
  searchQuery: '', searchDraft: '', ascending: true, currentChapterIndex: 23, listReady: true,
  navigationActive: false, locateCurrentRevision: 0, scrollGeneration: 0,
  listScroller: { scrollToIndex: (...args) => scrolls.push(args) }, scheduleTopScroll() {},
  publishProjection(rows) { this.projectedEntries = rows; }, selected: [], onSelectChapter(index) { this.selected.push(index); } });
page.admitEntries(false);
page.selectMangaEntry(entries[1], page.identity()); page.selectMangaEntry(entries[0], page.identity());
assert.deepEqual(page.mangaVisibleEntries().map(row => row.index), [7, 29, 41, 53]);
assert.equal(page.mangaGroupFor(entries[3]), undefined);
page.selectMangaEntry(entries[4], page.identity());
assert.deepEqual(page.mangaCollapsedGroups, [17, 7], 'a disabled root cannot manufacture a fold');
page.locateCurrent(); timers.splice(0).forEach(fn => fn());
assert.deepEqual(page.mangaCollapsedGroups, [], 'locate unfolds every exact ancestor');
assert.deepEqual(scrolls.at(-1), [2, false, 'center']);
page.mangaCollapsedGroups = [7]; page.searchQuery = '内卷的话';
page.projectedEntries = projectReaderDirectoryEntries(page.admittedEntries, page.searchQuery, false);
assert.deepEqual(page.mangaVisibleEntries().map(row => row.index), [23], 'search retains the hidden exact target');
page.selectMangaEntry(page.projectedEntries[0], page.identity()); assert.deepEqual(page.selected, [23]);
page.entries = entries.map(row => row.index === 7 ? { ...row, title: '另一卷' } : row); page.admitEntries(false);
assert.deepEqual(page.mangaCollapsedGroups, [], 'changed group facts discard the previous collapse');

// Execute both production Index admissions while the optional download/marker
// projection fails; hierarchy must already be present in the first publication.
const session = { contentKind: 'manga', sourceVersion: 'v1', identity: { sourceId: 's', bookId: 'b' },
  book: { title: '漫画', author: '作者' }, entries: entries.map(row => ({ ...row, url: row.navigable ? `/${row.index}` : '' })) };
const diagnostics = [];
const runtime = { bookAcquisitions: () => ({ setPreparationVisible() {}, readingProjectionRevision: () => 1, recentFailures: () => [] }) };
const Index = productionMotionMethods(new URL('pages/Index.ets', base),
  ['openRemoteBookDetail', 'refreshCachedSearchDetailInBackground'], {
    MangaBookPresentation, ReaderRuntimeOwner: { current: () => runtime },
    RemoteReadingFlowGateway: class {}, ReadingOfflineGateway: class {}, ReaderCoreGateway: class { async loadShelfBook() { return undefined; } },
    RemoteDetailAdmission: class { constructor(session) { this.session = session; this.refreshInBackground = false; } },
    preparedRemoteChapterMatches: () => true, sameRemoteSessionEvidence: (a, b) => a === b,
    RemoteChapterCacheRefreshError: class extends Error {}, RemoteReadingGatewayError: class extends Error {},
    remoteReadingFailureKindOf: () => 'RENDER_FAILED', verdictForFailureKind: () => 'failed',
    hilog: { info() {}, warn(...args) { diagnostics.push(args); }, error(...args) { diagnostics.push(args); } }, DOMAIN: 0,
  });
const index = Object.assign(new Index(), { route: 'bookshelf', navigationGeneration: 0,
  shelfBooks: [], searchDetailCandidates: [], remoteCatalogRefreshAt: new Map(), offlineMutationGeneration: 0,
  remoteSessionGeneration: 0, directoryBookmarkMutationGeneration: 0, directoryBookmarkMutationActiveKey: '',
  bookshelfRemovalActiveKey: '', remoteContentVerdict: 'readable',
  nextNavigationGeneration() { return ++this.navigationGeneration; },
  installRemoteReadingSession(value) { this.remoteReadingSession = value; this.remoteSessionGeneration++; },
  readingDetailForRemoteSeed: (seed, sourceName) => ({ ...seed, sourceName }), hydrateMangaPositions() {},
  probeRemoteContentVerdict: async () => 23,
  loadRemoteDirectoryProjection: async () => { throw new Error('optional projection unavailable'); },
});
index.openRemoteBookDetail({ sourceId: 's', bookId: 'b', title: '漫画', author: '作者', contentKind: 'manga' },
  '书源', { sourceId: 's', bookId: 'b', contentKind: 'manga' }, false, [], [], undefined, session);
for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
assert.deepEqual(index.detailToc.map(row => row.level), entries.map(row => row.level), JSON.stringify({ diagnostics, message: index.detailLoadingMessage }));
index.route = 'detail'; index.readingSessionActive = false; index.detailInBookshelf = false;
const refreshed = { ...session, sourceVersion: 'v2' };
index.refreshCachedSearchDetailInBackground({ sourceId: 's', bookId: 'b' }, '书源', session,
  index.navigationGeneration, Promise.resolve(refreshed));
for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
assert.deepEqual(index.detailToc.map(row => row.level), entries.map(row => row.level));
assert.equal(index.remoteReadingSession, refreshed);
console.log('PASS production three-directory hierarchy: nested folds, out-of-volume roots, locate/search, disabled facts and both Index publications before optional projection');

const Copies = productionMotionMethods(new URL('pages/Index.ets', base),
  ['loadRemoteDirectoryProjection', 'mergeDirectoryBookmarks', 'updateDirectoryChapterDownloadState', 'applyReaderDirectoryProjection'], {
    LocalReadingFlowGateway: class { async loadBookmarkProjection(_title, _author, rows) { return rows; } },
    LOCAL_SOURCE_ID: 'local', hilog: { error() {} }, DOMAIN: 0,
  });
const copies = Object.assign(new Copies(), { readingSessionActive: true, detailBook: { sourceId: 's', bookId: 'b' },
  detailToc: structuredClone(entries) });
const projected = await copies.loadRemoteDirectoryProjection({ loadProjection: async () => { throw Error('offline state unavailable'); } }, {}, session, () => true);
assert.deepEqual(projected.map(row => row.level), entries.map(row => row.level));
const merged = copies.mergeDirectoryBookmarks(projected, [{ ...entries[2], bookmarks: [{ time: 7 }] }]);
assert.deepEqual(merged.map(row => row.level), entries.map(row => row.level));
assert.deepEqual(merged[2].bookmarks, [{ time: 7 }]);
copies.detailToc = merged; copies.updateDirectoryChapterDownloadState(23, 'paused');
assert.equal(copies.detailToc[2].level, 3); assert.equal(copies.detailToc[2].downloadState, 'paused');
copies.applyReaderDirectoryProjection(entries.map(row => ({ ...row, title: `${row.title}新` })));
assert.deepEqual(copies.detailToc.map(row => row.level), entries.map(row => row.level));
assert.equal(copies.detailToc[2].downloadState, 'paused');
console.log('PASS actual Index directory failure fallback, bookmark merge, download-state mutation and reader title projection retain the exact hierarchy and sparse identities');

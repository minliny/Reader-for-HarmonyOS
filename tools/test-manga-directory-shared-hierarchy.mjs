import * as directoryState from '../entry/src/main/ets/features/manga/MangaDirectoryState.ts';
import { mangaDirectoryDisplay } from '../entry/src/main/ets/features/manga/MangaDirectoryDisplay.ts';
import { MangaBookPresentation } from '../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { compileHost, setRuntime } from './lib/reading-entry-owner-probe.mjs';
import { mangaDirectoryPresentation, mangaDirectoryVisibleEntries, mangaDirectoryIsGroup } from '../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts';
import { projectReaderDirectoryEntries } from '../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts';
import { snapshotReaderDirectoryData, sameReaderDirectoryData } from '../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts';
import { mangaDirectoryEntryRows, mangaDirectoryNearbyEntries } from '../entry/src/main/ets/features/manga/MangaDirectoryLayout.ts';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryScale, mangaDirectoryHeaderHeight, mangaDirectoryContentTop } from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
import * as geometry from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metrics from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const windowPorts = { ...geometry, ...metrics, visual, mangaDirectoryScale, mangaDirectoryHeaderHeight, mangaDirectoryContentTop,
  ReaderWindowCoordinator: { metrics: () => ({ ...metrics.createDefaultReaderWindowMetrics(),
    windowRect: { x: 0, y: 0, width: 400, height: 852 }, systemFontScale: 1 }) } };

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
  ['visibleToc', 'chapterIsGroup', 'chapterIndent', 'onBookChanged', 'measureIntro', 'onTocChanged', 'prepareMangaPreview',
    'contentFrame', 'safeLeft', 'safeRight'], {
    ...windowPorts, ...directoryState, mangaDirectoryDisplay,
    mangaDirectoryPresentation, mangaDirectoryVisibleEntries, mangaDirectoryIsGroup, mangaDirectoryEntryRows,
    mangaDirectoryNearbyEntries, CHAPTER_PREVIEW_LIMIT: 8, TEXT_CHAPTER_PREVIEW_LIMIT: 20,
  });
const detail = Object.assign(new Detail(), { toc: entries, book: { sourceId: 's', bookId: 'b', contentKind: 'manga' },
  collapsedGroups: [7, 17], collapseIdentity: 's\0b', mangaPresentation: new Map(), mangaPreviewRows: [], liveWidth: () => 400 });
detail.prepareMangaPreview();
assert.deepEqual(detail.visibleToc().map(row => row.index), [23, 29, 53], 'detail preview contains actual nearby targets, with explicit context carried separately');
assert.equal(detail.mangaPresentation.get(23).contextTitle, '外卷 / 内卷');
detail.collapsedGroups = [17];
assert.deepEqual(detail.visibleToc().map(row => row.index), [23, 29, 53], 'a full-directory folding preference cannot hide the detail preview target');
assert.equal(detail.chapterIsGroup(entries[4]), false, 'disabled row does not fold later independent chapters');
assert.equal(detail.chapterIndent(entries[3]), 10, 'a root target is not indented under a prior volume');
detail.book = { ...detail.book, bookId: 'other' }; detail.onBookChanged();
assert.deepEqual(detail.collapsedGroups, [], 'equal indexes in another book do not inherit old folds');
detail.collapsedGroups = [7]; detail.toc = entries.map(row => row.index === 7 ? { ...row, title: '新外卷' } : row);
detail.onTocChanged(); assert.deepEqual(detail.collapsedGroups, [], 'renamed/reused group facts discard detail collapse');

const timers = [], scrolls = [];
const Page = productionMotionMethods(new URL('features/bookshelf/BookDirectoryPage.ets', base),
  ['identity', 'admitEntries', 'mangaIsGroup', 'mangaVisibleEntries', 'locateCurrent', 'selectMangaEntry', 'rowIsCurrent',
    'toggleMangaBranch', 'prepareMangaLayout', 'publishProjection', 'onListUserScroll', 'mangaEntryIsDisplayed',
    'contentFrame', 'mangaNarrow', 'mangaFontScale', 'scrollMangaCurrent', 'mangaContentTopInset', 'mangaVisibleTopInset', 'topInset'], {
    ...windowPorts, ...directoryState, mangaDirectoryDisplay,
    mangaDirectoryPresentation, mangaDirectoryVisibleEntries, snapshotReaderDirectoryData, sameReaderDirectoryData,
    mangaDirectoryEntryRows, projectReaderDirectoryEntries, ScrollAlign: { START: 'start' }, LengthMetrics: { vp: value => ({ value }) }, setTimeout: fn => timers.push(fn),
  });
const page = Object.assign(new Page(), { sourceId: 's', bookId: 'b', contentKind: 'manga', mounted: true, entries,
  admittedIdentity: '', admittedEntries: [], projectedEntries: [], mangaCollapsedGroups: [],
  searchQuery: '', searchDraft: '', ascending: true, currentChapterIndex: 23, listReady: true,
  navigationActive: false, locateCurrentRevision: 0, scrollGeneration: 0, viewportWidth: 400, mangaLayoutRows: [], mangaToolsHeight: 175,
  listScroller: { scrollToIndex: (...args) => scrolls.push(args) }, scheduleTopScroll() {},
  selected: [], onSelectChapter(index) { this.selected.push(index); } });
page.admitEntries(false);
assert.deepEqual(page.mangaLayoutRows.flatMap(row => row.entries.map(entry => entry.index)), entries.map(entry => entry.index),
  'the explicitly admitted manga fixture initializes layout with every original canonical entry');
page.toggleMangaBranch(page.projectedEntries.find(row => row.index === entries[1].index), page.identity()); page.toggleMangaBranch(entries[0], page.identity());
assert.deepEqual(page.mangaVisibleEntries().map(row => row.index), [7, 29, 41, 53]);
assert.equal(page.mangaPresentation.get(entries[3].index).parentTitle, undefined);
page.selectMangaEntry(entries[4], page.identity());
assert.deepEqual(page.mangaCollapsedGroups, [17, 7], 'a disabled root cannot manufacture a fold');
page.locateCurrent(); timers.splice(0).forEach(fn => fn());
assert.deepEqual(page.mangaCollapsedGroups, [], 'locate unfolds every exact ancestor');
assert.deepEqual(scrolls.at(-1), [2, false, 'start', { extraOffset: { value: 183 } }]);
page.mangaCollapsedGroups = [7]; page.searchQuery = '内卷的话';
page.publishProjection(projectReaderDirectoryEntries(page.admittedEntries, page.searchQuery, false));
assert.deepEqual(page.mangaVisibleEntries().map(row => row.index), [23], 'search retains the hidden exact target');
page.selectMangaEntry(page.projectedEntries[0], page.identity()); assert.deepEqual(page.selected, [23]);
page.entries = entries.map(row => row.index === 7 ? { ...row, title: '另一卷' } : row); page.admitEntries(false);
assert.deepEqual(page.mangaCollapsedGroups, [], 'changed group facts discard the previous collapse');

// Execute the actual ReadingEntryHost acquisition/background-refresh owner
// and the unchanged Index publication seam. Optional offline projection fails
// after both first catalog publications, never before hierarchy is installed.
const session = { contentKind: 'manga', sourceVersion: 'v1', identity: { sourceId: 's', bookId: 'b' },
  book: { title: '漫画', author: '作者' }, entries: entries.map(row => ({ ...row, url: row.navigable ? `/${row.index}` : '' })) };
const diagnostics = [], publications = [], imageAdmissions = [];
let releaseRefresh, optionalProjectionFails = true;
const refresh = new Promise(resolve => { releaseRefresh = resolve; });
const runtime = {
  closed: false,
  bookAcquisitions: () => ({ setPreparationVisible() {}, readingProjectionRevision: () => 1,
    acquireBookWithBackgroundRefresh: async () => ({ session, backgroundRefresh: refresh }) }),
  async request(method, params) {
    assert.equal(method, 'bookmark.list', 'hierarchy projection uses the actual read-only bookmark gateway');
    assert.equal(params.bookName, '漫画'); assert.equal(params.bookAuthor, '作者');
    return { data: { bookmarks: [{ bookName: '漫画', bookAuthor: '作者', time: 7,
      chapterIndex: 23, chapterPos: 0, chapterName: '内卷的话', content: '', bookText: '' }] } };
  },
};
setRuntime(runtime);
class OfflineProjection {
  async loadDirectoryProjection(value) {
    if (optionalProjectionFails) throw new Error('optional projection unavailable');
    return value.entries.map(row => ({ index: row.index, title: row.title, level: row.level,
      navigable: row.navigable, downloadState: row.index === 23 ? 'paused' : 'unknown' }));
  }
}
const Host = compileHost(undefined, {
  ReadingOfflineGateway: OfflineProjection,
  ReadingPrefetchHost: { forRuntime: () => ({ noteCatalogRefresh() {} }) },
  ReaderCoreGateway: class { async loadShelfBook() { return undefined; } },
  MangaAdmissionGateway: class { async verify(value, current) {
    assert.ok(current()); imageAdmissions.push(value);
  } },
});
const host = new Host(runtime);
const Index = productionMotionMethods(new URL('pages/Index.ets', base),
  ['applyReadingEntrySnapshot', 'applyReaderDirectoryProjection', 'applyOwnedDirectoryEntries'], { LOCAL_SOURCE_ID: 'local' });
const index = Object.assign(new Index(), { readingSessionActive: false, detailToc: [],
  getReadingEntryHost: () => host });
const lease = {
  isCurrent: () => true, projectionAllowed: () => true,
  currentDirectory: () => index.detailToc, offlineGeneration: () => 0,
  membership: () => ({ generation: 0, blocked: false, value: false }),
  changed(snapshot) {
    publications.push(snapshot);
    index.applyReadingEntrySnapshot(snapshot);
  },
  cacheDecision: async () => false, notice() {}, refreshShelf() {},
  diagnostic: (stage, message) => diagnostics.push({stage, message}),
};
await host.openRemote({ seed: { sourceId: 's', bookId: 'b', title: '漫画', author: '作者', contentKind: 'manga' },
  sourceName: '书源', validatedSession: session }, lease);
for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
const first = publications.find(row => row.session === session && row.toc.length > 0);
assert.ok(first, JSON.stringify({diagnostics, message: index.detailLoadingMessage}));
assert.deepEqual(first.toc.map(row => row.level), entries.map(row => row.level));
assert.deepEqual(index.detailToc.map(row => row.level), entries.map(row => row.level));
assert.ok(diagnostics.some(row => row.stage === 'directory-download' && /optional projection unavailable/.test(row.message)),
  'optional projection failure is recorded while the catalog stays usable');
const refreshed = { ...session, sourceVersion: 'v2' };
releaseRefresh(refreshed);
for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
const second = publications.find(row => row.session === refreshed && row.toc.length > 0);
assert.ok(second, 'actual Owner background refresh reaches actual Index publication');
assert.deepEqual(second.toc.map(row => row.level), entries.map(row => row.level));
assert.equal(index.remoteReadingSession, refreshed);
assert.deepEqual(imageAdmissions, [session, refreshed], 'both manga catalogs use their image admission rather than novel chapter loading');
assert.deepEqual(index.detailToc.map(row => row.level), entries.map(row => row.level));
assert.equal(index.detailToc[2].bookmarks[0].time, 7,
  'actual shared bookmark projection survives optional offline failure');
console.log('PASS actual ReadingEntryHost→Index publications: initial/background manga hierarchy precedes optional projection, first-image admission and exact bookmark read');

// The optional offline projection may later recover. Execute the production
// Owner merger and Directory owner, then the actual Index owned-entry and
// reader-title publication methods with sparse chapter identities.
optionalProjectionFails = false;
await host.projectDirectory(host.snapshot().scopeId);
assert.deepEqual(index.detailToc.map(row => row.level), entries.map(row => row.level));
assert.deepEqual(index.detailToc.map(row => row.index), entries.map(row => row.index));
assert.equal(index.detailToc[2].bookmarks[0].time, 7);
assert.equal(index.detailToc[2].downloadState, 'paused');
index.applyOwnedDirectoryEntries(index.detailToc.map(row => ({...row})));
assert.deepEqual(host.snapshot().toc.map(row => row.level), entries.map(row => row.level));
index.readingSessionActive = true;
index.applyReaderDirectoryProjection(entries.map(row => ({ ...row, title: `${row.title}新` })));
assert.deepEqual(index.detailToc.map(row => row.level), entries.map(row => row.level));
assert.equal(index.detailToc[2].downloadState, 'paused');
assert.equal(index.detailToc[2].bookmarks[0].time, 7);
assert.equal(host.snapshot().toc[2].title, '内卷的话新');
console.log('PASS actual Owner offline recovery and Index owned-entry/reader-title publication retain chapter/volume hierarchy, sparse identities, canonical download state and bookmarks');

import * as directoryState from '../entry/src/main/ets/features/manga/ui/MangaDirectoryState.ts';
import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { compileHost, setRuntime } from './lib/reading-entry-owner-probe.mjs';
import { actualReadingEntryPresentation } from './lib/reading-entry-presentation-probe.mjs';
import { mangaDirectoryPresentation, mangaDirectoryVisibleEntries } from '../entry/src/main/ets/features/manga/presentation/MangaDirectoryPresentation.ts';
import { detailChapterPreview } from '../entry/src/main/ets/features/reading/presentation/DetailChapterPreview.ts';
import { projectReaderDirectoryEntries } from '../entry/src/main/ets/features/reading/presentation/ReaderDirectoryProjection.ts';
import { snapshotReaderDirectoryData, sameReaderDirectoryData } from '../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts';
import { mangaDirectoryEntryRows } from '../entry/src/main/ets/features/manga/ui/MangaDirectoryLayout.ts';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryScale, mangaDirectoryFullFlowFooter } from '../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts';
import * as geometry from '../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts';
import * as metrics from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

const windowMetrics = { ...metrics.createDefaultReaderWindowMetrics(),
  windowRect: { x: 0, y: 0, width: 400, height: 852 }, systemFontScale: 1 };
const windowPorts = { ...geometry, ...metrics, visual, mangaDirectoryScale, mangaDirectoryFullFlowFooter,
  readerWindowMetrics: () => windowMetrics };

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

const Detail = productionMotionMethods(new URL('features/reading/ui/LocalBookDetail.ets', base),
  ['refreshChapterPreview', 'onTocChanged', 'canActOnChapterPreview', 'clearDetailPress'], { detailChapterPreview });
const detail = Object.assign(new Detail(), {
  toc: [...entries, { index: 71, title: '未确认的章节' }],
  book: { sourceId: 's', bookId: 'b', contentKind: 'manga' },
  currentChapterIndex: 23, detailPressedAction: '',
  acceptsDetailInput: () => true, readingActionAvailable: () => true,
});
detail.refreshChapterPreview();
const detailPreviewTargets = () => detail.previewChapters.map(entry => entry.index);
assert.deepEqual(detailPreviewTargets(), [23, 29, 53], 'detail preview requires an exact readable chapter');
assert.equal(model.get(23).contextTitle, '外卷 / 内卷', 'the canonical hierarchy retains context separately from preview selection');

const frames = [], scrolls = [];
class PostLayoutFrame {
  constructor(_context, deliver) { this.deliver = deliver; }
}
const Page = productionMotionMethods(new URL('features/reading/ui/BookDirectoryPage.ets', base),
  ['identity', 'admitEntries', 'applySearch', 'directoryInputIsCurrent', 'mangaVisibleEntries', 'locateCurrent', 'selectMangaEntry', 'rowIsCurrent',
    'toggleMangaBranch', 'prepareMangaLayout', 'publishProjection', 'onListUserScroll', 'mangaEntryIsDisplayed',
    'contentFrame', 'mangaNarrow', 'mangaFontScale', 'flushPendingScroll', 'mangaFlowFooter',
    'mangaBottomInset', 'mangaFooterHeight', 'mangaCurrentPosition', 'topInset'], {
    ...windowPorts, ...directoryState,
    mangaDirectoryPresentation, mangaDirectoryVisibleEntries, snapshotReaderDirectoryData, sameReaderDirectoryData,
    mangaDirectoryEntryRows, projectReaderDirectoryEntries, ScrollAlign: { START: 'start', CENTER: 'center' },
    ReaderPostLayoutFrame: PostLayoutFrame,
  });
const uiContext = { postFrameCallback: frame => frames.push(frame) };
const page = Object.assign(new Page(), { sourceId: 's', bookId: 'b', contentKind: 'manga', mounted: true, entries,
  admittedIdentity: '', admittedEntries: [], projectedEntries: [], mangaCollapsedGroups: [],
  searchQuery: '', searchDraft: '', ascending: true, currentChapterIndex: 23, listReady: true,
  navigationActive: false, locateCurrentRevision: 0, scrollGeneration: 0, viewportWidth: 400, mangaLayoutRows: [],
  interactive: true, selectionBusy: false, readerWindowMetricsRevision: 0, mangaFooterMeasured: 60,
  isOpeningCurrent: () => true, getUIContext: () => uiContext,
  listScroller: { scrollToIndex: (...args) => scrolls.push(args) }, scheduleTopScroll() {}, invalidateFrame() {},
  selected: [], onSelectChapter(index) { this.selected.push(index); } });
page.admitEntries(false);
assert.deepEqual(page.mangaLayoutRows.flatMap(row => row.entries.map(entry => entry.index)), entries.map(entry => entry.index),
  'the explicitly admitted manga fixture initializes layout with every original canonical entry');
page.toggleMangaBranch(page.projectedEntries.find(row => row.index === entries[1].index), page.identity()); page.toggleMangaBranch(entries[0], page.identity());
assert.deepEqual(page.mangaVisibleEntries().map(row => row.index), [7, 29, 41, 53]);
assert.equal(page.mangaPresentation.get(entries[3].index).parentTitle, undefined);
assert.deepEqual(detailPreviewTargets(), [23, 29, 53], 'directory folds do not hide the detail preview target');
page.selectMangaEntry(entries[4], page.identity());
assert.deepEqual(page.mangaCollapsedGroups, [17, 7], 'a disabled root cannot manufacture a fold');
assert.deepEqual(page.selected, [], 'a disabled root cannot navigate');
page.locateCurrent();
assert.deepEqual(scrolls, [], 'locate waits for the current projection to lay out');
frames.splice(0).forEach(frame => frame.deliver());
assert.deepEqual(page.mangaCollapsedGroups, [], 'locate unfolds every exact ancestor');
assert.deepEqual(scrolls.at(-1), [2, false, 'center']);
page.mangaCollapsedGroups = [7];
page.applySearch('内卷的话');
assert.deepEqual(page.mangaVisibleEntries().map(row => row.index), [23], 'search retains the hidden exact target');
assert.equal(page.projectedEntries[0].contextTitle, '外卷 / 内卷', 'search retains the full context of the revealed chapter');
page.selectMangaEntry(page.projectedEntries[0], page.identity()); assert.deepEqual(page.selected, [23]);
page.entries = entries.map(row => row.index === 7 ? { ...row, title: '另一卷' } : row); page.admitEntries(false);
assert.deepEqual(page.mangaCollapsedGroups, [], 'changed group facts discard the previous collapse');
page.mangaCollapsedGroups = [7];
page.bookId = 'other';
page.admitEntries(true);
assert.deepEqual(page.mangaCollapsedGroups, [], 'equal indexes in another book do not inherit old folds');
const oldPreview = detail.previewChapters[0];
detail.toc = entries.map(row => row.index === oldPreview.index ? { ...row, title: '新章节' } : row);
detail.onTocChanged();
assert.equal(detail.canActOnChapterPreview(oldPreview), false, 'a changed chapter retires its previous detail action');

// Execute the actual ReadingEntryHost acquisition/background-refresh owner
// and the current presentation lease. Optional offline projection fails
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
  // This hierarchy fixture has no persisted bookmark mutation to recover.
  BookmarkOperationIntentStore: class { async pending() { return undefined; } },
  ReadingPrefetchHost: { forRuntime: () => ({ noteCatalogRefresh() {} }) },
  ReaderCoreGateway: class { async loadShelfBook() { return undefined; } },
  MangaAdmissionGateway: class { async verify(value, current) {
    assert.ok(current()); imageAdmissions.push(value);
  } },
});
const host = new Host(runtime);
const Presentation = actualReadingEntryPresentation({
  ReadingEntryHost: { forRuntime: owner => { assert.equal(owner, runtime); return host; } },
  hilog: { warn(_domain, _tag, _format, stage, message) { diagnostics.push({ stage, message }); } },
});
const reading = new Presentation();
const publish = reading.publish.bind(reading);
reading.publish = snapshot => { publications.push(snapshot); publish(snapshot); };
const ports = {
  current: () => true, projectionVisible: () => true,
  membership: () => ({ generation: 0, blocked: false, value: false }),
  cacheDecision: async () => false, notice() {}, refreshShelf() {},
};
assert.equal(reading.enterRemoteDetail(runtime, {
  seed: { sourceId: 's', bookId: 'b', title: '漫画', author: '作者', contentKind: 'manga' },
  sourceName: '书源', validatedSession: session,
}, projectKind => {
  projectKind();
  return { shelfBooks: [], sourceSwitchPending: false, candidates: [], ports };
}, assert.fail), true);
for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
const first = publications.find(row => row.session === session && row.toc.length > 0);
assert.ok(first, JSON.stringify({diagnostics, message: reading.loadingMessage}));
assert.deepEqual(first.toc.map(row => row.level), entries.map(row => row.level));
assert.deepEqual(reading.toc.map(row => row.level), entries.map(row => row.level));
assert.ok(diagnostics.some(row => row.stage === 'directory-download' && /optional projection unavailable/.test(row.message)),
  'optional projection failure is recorded while the catalog stays usable');
const refreshed = { ...session, sourceVersion: 'v2' };
releaseRefresh(refreshed);
for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
const second = publications.find(row => row.session === refreshed && row.toc.length > 0);
assert.ok(second, 'actual Host background refresh reaches the current presentation');
assert.deepEqual(second.toc.map(row => row.level), entries.map(row => row.level));
assert.equal(reading.session, refreshed);
assert.deepEqual(imageAdmissions, [session, refreshed], 'both manga catalogs use their image admission rather than novel chapter loading');
assert.deepEqual(reading.toc.map(row => row.level), entries.map(row => row.level));
assert.equal(reading.toc[2].bookmarks[0].time, 7,
  'actual shared bookmark projection survives optional offline failure');
console.log('PASS actual Host and presentation publications: initial/background manga hierarchy precedes optional projection, first-image admission and exact bookmark read');

// The optional offline projection may later recover. Execute the production
// Host merger and Directory owner, then the actual owned-entry and
// reader-title publication methods with sparse chapter identities.
optionalProjectionFails = false;
await host.projectDirectory(host.snapshot().scopeId);
assert.deepEqual(reading.toc.map(row => row.level), entries.map(row => row.level));
assert.deepEqual(reading.toc.map(row => row.index), entries.map(row => row.index));
assert.equal(reading.toc[2].bookmarks[0].time, 7);
assert.equal(reading.toc[2].downloadState, 'paused');
reading.replaceOwnedDirectoryEntries(reading.toc.map(row => ({...row})), () => host);
assert.deepEqual(host.snapshot().toc.map(row => row.level), entries.map(row => row.level));
reading.applyDirectoryProjection(entries.map(row => ({ ...row, title: `${row.title}新` })), runtime);
assert.deepEqual(reading.toc.map(row => row.level), entries.map(row => row.level));
assert.equal(reading.toc[2].downloadState, 'paused');
assert.equal(reading.toc[2].bookmarks[0].time, 7);
assert.equal(host.snapshot().toc[2].title, '内卷的话新');
console.log('PASS actual Host offline recovery and presentation owned-entry/reader-title publication retain chapter/volume hierarchy, sparse identities, canonical download state and bookmarks');

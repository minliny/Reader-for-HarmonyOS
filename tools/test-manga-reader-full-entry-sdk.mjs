import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const sources = {
  shell: read('features/shell/ReaderShell.ets'),
  full: read('features/reading/ReaderFullDirectory.ets'),
  page: read('features/bookshelf/BookDirectoryPage.ets'),
  experience: read('features/reading/LocalReadingExperience.ets'),
  index: read('pages/Index.ets'),
};
// Match the SDK frontend's actual Builder-name prepass. Only the directory
// branch runs: retained reader paint/source switch are explicit unrelated ports.
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const componentMap = require(`${sdk}/lib/component_map.js`);
for (const name of ['mangaSurface', 'sourceSwitchOverlayContent', 'overlayStatusBarUnderlay']) {
  assert.ok(new RegExp(`@Builder\\s+private ${name}\\(`).test(sources.shell), 'only real declared Builders enter the prepass');
  componentMap.CUSTOM_BUILDER_METHOD.add(name);
}
class PortChild {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}
const enumPort = new Proxy({}, { get: (_target, key) => String(key) });
const recovery = { bookmarks: { visible: false }, offline: { visible: false } };
function checkEntry(kind, candidate = sources.shell) {
  const calls = [];
  const entries = Array.from({ length: 681 }, (_, index) => ({ index: index * 2 + 1, title: String(index + 1), navigable: true }));
  const { owner } = createReaderBuilderProbe(candidate, ['build'], {
    ReaderFullDirectory: PortChild, BookDirectoryPage: PortChild, ReadingExperience: PortChild,
    SafeAreaType: enumPort, SafeAreaEdge: enumPort, LayoutSafeAreaType: enumPort, LayoutSafeAreaEdge: enumPort,
  }, { childSources: { ReaderFullDirectory: sources.full, BookDirectoryPage: sources.page, ReadingExperience: sources.experience } });
  Object.assign(owner, { contentKind: kind, route: 'directory', sourceSwitchVisible: false, visible: true,
    sourceId: 'source', bookId: 'book', bookKind: 'cbz', bookTitle: '作品', tocEntries: entries,
    directoryCurrentChapterIndex: 691, directoryCurrentPageOrdinal: 4, directoryCurrentPageTotal: 24,
    directoryRecovery: recovery, mangaDownloadEnabled: true,
    chapterStartBookmarkCreationEnabled: true,
    mangaSurface() {}, overlayStatusBarUnderlay() {}, readingIdentityKey: () => 'reader',
    onSelectChapter: index => calls.push(['chapter', index]),
    onSelectNavigationTarget: (...args) => calls.push(['target', ...args]),
    onCloseDirectory: () => calls.push(['back']),
    onLoadMangaDownloadActions: index => Promise.resolve([{ id: 'retain', index }]),
    onMangaDownloadAction: (action, index) => calls.push(['download', action, index]),
    onReconcileBookmarks: (...args) => calls.push(['bookmarks', ...args]),
    onContinueBookmarks: (...args) => calls.push(['continue-bookmarks', ...args]),
    onReconcileOffline: (...args) => calls.push(['offline', ...args]),
    onContinueOffline: (...args) => calls.push(['continue-offline', ...args]),
  });
  owner.initialRender();
  const children = [...owner.children.values()].filter(value => value.params.entries === entries);
  assert.equal(children.length, 1, 'only one Full directory consumer is mounted');
  const page = children[0].params;
  if (kind === 'manga') {
    assert.equal(page.contentKind, 'manga', 'actual manga route mounts the existing BookDirectoryPage');
    assert.equal(page.sourceId, 'source'); assert.equal(page.bookId, 'book');
    assert.equal(page.bookKind, 'cbz'); assert.equal(page.bookTitle, '作品');
    assert.equal(page.currentChapterIndex, 691); assert.equal(page.currentPageOrdinal, 4); assert.equal(page.currentPageTotal, 24);
    assert.equal(page.mangaDownloadEnabled, true); assert.equal(page.directoryRecovery, recovery);
    assert.equal(page.chapterStartBookmarkCreationEnabled, false);
    page.onSelectNavigationTarget(691, 5, { sourceId: 'source' }, { proof: true });
    assert.deepEqual(calls.at(-1), ['target', 691, 5, { sourceId: 'source' }, { proof: true }]);
    page.onSelectChapter(691); assert.deepEqual(calls.at(-1), ['chapter', 691]);
    page.onDownloadAction('retain', 691); assert.deepEqual(calls.at(-1), ['download', 'retain', 691]);
    page.onReconcileOffline(2, 'identity'); assert.deepEqual(calls.at(-1), ['offline', 2, 'identity']);
    page.onContinueBookmarks(3, 'identity'); assert.deepEqual(calls.at(-1), ['continue-bookmarks', 3, 'identity']);
    page.onBack(); assert.deepEqual(calls.at(-1), ['back']);
  } else {
    assert.equal(page.contentKind, undefined, 'novels retain ReaderFullDirectory and its original header/bookmarks');
    assert.equal(page.currentChapterIndex, 691); assert.equal(page.currentPageOrdinal, undefined);
    assert.equal(page.chapterStartBookmarkCreationEnabled, true);
  }
  return page;
}
for (const kind of ['manga', 'text']) checkEntry(kind);
for (const [name, before, after] of [
  ['manga wrongly uses novel Full', "if (this.contentKind === 'manga') {\n          BookDirectoryPage", "if (false) {\n          BookDirectoryPage"],
  ['lost canonical proof', 'this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof),', 'this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope),'],
  ['invented page ordinal', 'currentPageOrdinal: this.directoryCurrentPageOrdinal,', 'currentPageOrdinal: 0,'],
]) {
  assert.ok(sources.shell.includes(before), `${name} target exists`);
  assert.throws(() => checkEntry('manga', sources.shell.replace(before, after)), undefined, name);
}

// Execute actual Index opening/refresh members. The snapshot port stands for
// already Core-confirmed MangaBookPresentation facts; this probe does no DB I/O.
const indexPath = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
let snapshot;
const Index = productionMotionMethods(indexPath, ['openReaderControlDirectory', 'refreshDetailMangaPosition'],
  { MangaBookPresentation: { get: (sourceId, bookId) => {
    assert.equal(sourceId, 'source'); assert.equal(bookId, 'book'); return snapshot;
  } } });
snapshot = { chapterIndex: 691, chapterTitle: '346', pageOrdinal: 4, totalPages: 24 };
const old = { sourceId: 'source', bookId: 'book', contentKind: 'manga', mangaPosition: { chapterIndex: 1, pageOrdinal: 2 } };
const index = Object.assign(new Index(), { readingSessionActive: true, readingContentKind: 'manga',
  detailBook: old, detailToc: [{ index: 691 }], directoryCurrentChapterIndex: 691, route: 'reading', directoryPresentationGeneration: 1,
  loadDirectoryOperationProjections() {} });
index.openReaderControlDirectory();
assert.equal(index.detailBook.mangaPosition, snapshot, 'opening snapshots the confirmed current position before route publication');
assert.equal(index.route, 'directory'); assert.equal(index.directoryReturnTarget, 'readerControl');
function indexPageParams(candidate = sources.index) {
  const expressions = Object.fromEntries(['directoryCurrentPageOrdinal', 'directoryCurrentPageTotal'].map(name => {
    const expression = candidate.match(new RegExp(`${name}: ([\\s\\S]*?),\\n`))?.[1];
    assert.ok(expression, 'execute the exact production Index property expression');
    return [name, new Function(`return (${expression});`).call(index)];
  }));
  return expressions;
}
assert.deepEqual(indexPageParams(), { directoryCurrentPageOrdinal: 4, directoryCurrentPageTotal: 24 });
snapshot = { chapterIndex: 1, pageOrdinal: 9, totalPages: 30 }; index.route = 'reading'; index.openReaderControlDirectory();
assert.deepEqual(indexPageParams(), { directoryCurrentPageOrdinal: -1, directoryCurrentPageTotal: -1 },
  'another chapter cannot contribute its confirmed page position to the current chapter');
const unguarded = sources.index.replace('this.detailBook.mangaPosition?.chapterIndex === this.directoryCurrentChapterIndex ?', 'true ?');
assert.notEqual(unguarded, sources.index);
assert.throws(() => assert.deepEqual(indexPageParams(unguarded), { directoryCurrentPageOrdinal: -1, directoryCurrentPageTotal: -1 }),
  undefined, 'same-chapter snapshot fence negative control rejects a wrong-chapter page');
snapshot = undefined; index.route = 'reading'; index.openReaderControlDirectory();
assert.equal(index.detailBook.mangaPosition, undefined, 'unknown location cannot retain old page facts');
assert.deepEqual(indexPageParams(), { directoryCurrentPageOrdinal: -1, directoryCurrentPageTotal: -1 });
assert.match(sources.index, /directoryCurrentPageOrdinal: this\.detailBook\.mangaPosition\?\.chapterIndex === this\.directoryCurrentChapterIndex \?/);
assert.match(sources.index, /directoryCurrentPageTotal: this\.detailBook\.mangaPosition\?\.chapterIndex === this\.directoryCurrentChapterIndex \?/);
console.log('PASS actual SDK ReaderShell manga BookDirectoryPage/novel Full entry, complete681 catalog, current/unknown/wrong-chapter snapshot and exact Index page expressions, canonical proof/download/recovery/back and 4 missing-wire negatives; native pixels remain pending');

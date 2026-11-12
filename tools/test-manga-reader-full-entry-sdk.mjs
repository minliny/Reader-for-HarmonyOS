import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { boundedMembers, boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';

const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const sources = {
  shell: read('features/reading/ui/ReaderShell.ets'),
  destination: read('features/reading/ui/ReaderDirectoryDestination.ets'),
  full: read('features/reading/ui/ReaderFullDirectory.ets'),
  page: read('features/reading/ui/BookDirectoryPage.ets'),
  experience: read('features/reading/ui/LocalReadingExperience.ets'),
  index: read('pages/Index.ets'),
};
// Match the SDK frontend's actual Builder-name prepass. Only the directory
// branch runs: retained reader paint/source switch are explicit unrelated ports.
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const componentMap = require(`${sdk}/lib/component_map.js`);
for (const name of ['mangaSurface', 'sourceSwitchOverlayContent', 'overlayStatusBarUnderlay']) {
  assert.ok(new RegExp(`@Builder\\s+private ${name}\\(`).test(sources.shell), 'only real declared Builders enter the prepass');
  componentMap.CUSTOM_BUILDER_METHOD.add(name);
}
class PortChild {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}
class MangaCatalogPort extends PortChild {}
class TextCatalogPort extends PortChild {}
const recovery = { bookmarks: { visible: false }, offline: { visible: false } };
function checkEntry(kind, candidate = sources.shell, destinationSource = sources.destination) {
  const calls = [];
  let openingCurrent = true;
  const entries = Array.from({ length: 681 }, (_, index) => ({ index: index * 2 + 1, title: String(index + 1), navigable: true }));
  const sdk = boundedSurfaceSdk();
  const { Component: ReaderDirectoryDestination } = createReaderBuilderProbe(destinationSource, boundedMembers(destinationSource), {
    ...sdk.deps, EMPTY_READING_DIRECTORY_RECOVERY: recovery, ReaderFullDirectory: TextCatalogPort, BookDirectoryPage: MangaCatalogPort,
  }, { ...sdk.hooks, childSources: { ...sdk.hooks.childSources, ReaderFullDirectory: sources.full, BookDirectoryPage: sources.page } });
  const { owner } = createReaderBuilderProbe(candidate, ['readingOverlay'], { ReaderDirectoryDestination },
    { childSources: { ReaderDirectoryDestination: destinationSource } });
  Object.assign(owner, { contentKind: kind, route: 'directory', sourceSwitchVisible: false, visible: true,
    sourceId: 'source', bookId: 'book', bookKind: kind === 'manga' ? 'cbz' : 'txt', bookTitle: '作品', tocEntries: entries,
    directoryCurrentChapterIndex: 691, directoryCurrentPageOrdinal: 4, directoryCurrentPageTotal: 24,
    directoryRecovery: recovery, mangaDownloadEnabled: true, directoryOpening: 1,
    isDirectoryOpeningCurrent: () => openingCurrent,
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
  owner.readingOverlay();
  const destination = [...owner.children.values()].find(child => child instanceof ReaderDirectoryDestination);
  assert.ok(destination, 'the retained reader mounts the shared directory destination');
  destination.aboutToAppear();
  destination.initialRender();
  const children = [...destination.children.values()].filter(value => value.params.entries === entries);
  assert.equal(children.length, 1, 'only one Full directory consumer is mounted');
  const page = children[0].params;
  if (kind === 'manga') {
    assert.ok(children[0] instanceof MangaCatalogPort, 'actual manga route mounts BookDirectoryPage');
    assert.equal(page.sourceId, 'source'); assert.equal(page.bookId, 'book');
    assert.equal(page.bookTitle, '作品');
    assert.equal(page.currentChapterIndex, 691); assert.equal(page.currentPageOrdinal, 4); assert.equal(page.currentPageTotal, 24);
    assert.equal(page.mangaDownloadEnabled, true); assert.equal(page.directoryRecovery, recovery);
    assert.equal(page.onCreateChapterStartBookmark, undefined);
    page.onSelectNavigationTarget(691, 5, { sourceId: 'source' }, { proof: true });
    assert.deepEqual(calls.at(-1), ['target', 691, 5, { sourceId: 'source' }, { proof: true }]);
    page.onSelectChapter(691); assert.deepEqual(calls.at(-1), ['chapter', 691]);
    page.onDownloadAction('retain', 691); assert.deepEqual(calls.at(-1), ['download', 'retain', 691]);
    page.onReconcileOffline(2, 'identity'); assert.deepEqual(calls.at(-1), ['offline', 2, 'identity']);
    page.onContinueBookmarks(3, 'identity'); assert.deepEqual(calls.at(-1), ['continue-bookmarks', 3, 'identity']);
    page.onBack(); assert.deepEqual(calls.at(-1), ['back']);
    const prior = calls.length;
    openingCurrent = false;
    page.onSelectChapter(691);
    page.onDownloadAction('retain', 691);
    page.onBack();
    assert.equal(calls.length, prior, 'retired directory opening cannot dispatch old native callbacks');
    openingCurrent = true;
    destination.opening = 2;
    page.onSelectChapter(691);
    assert.equal(calls.length, prior, 'a successor opening rejects callbacks captured by the previous one');
  } else {
    assert.ok(children[0] instanceof TextCatalogPort, 'novels retain ReaderFullDirectory and its original header/bookmarks');
    assert.equal(page.bookKind, 'txt');
    assert.equal(page.catalogContext, 'reader', 'retained reader keeps the reader catalog context');
    assert.equal(page.currentChapterIndex, 691); assert.equal(page.currentPageOrdinal, undefined);
    assert.equal(page.chapterStartBookmarkCreationEnabled, true);
  }
  return page;
}
for (const kind of ['manga', 'text']) checkEntry(kind);
for (const [name, file, before, after] of [
  ['manga wrongly uses novel Full', 'destination', "if (this.contentKind === 'manga')", 'if (false)'],
  ['lost canonical proof', 'destination', 'this.onSelectNavigationTarget(chapterIndex, offset, scope, proof);',
    'this.onSelectNavigationTarget(chapterIndex, offset, scope);'],
  ['invented page ordinal', 'shell', 'currentPageOrdinal: this.directoryCurrentPageOrdinal,', 'currentPageOrdinal: 0,'],
]) {
  assert.ok(sources[file].includes(before), name + ' target exists');
  const candidate = sources[file].replace(before, after);
  assert.throws(() => checkEntry('manga', file === 'shell' ? candidate : sources.shell,
    file === 'destination' ? candidate : sources.destination), undefined, name);
}

// Execute actual Index opening/refresh members. The snapshot port stands for
// already Core-confirmed MangaBookPresentation facts; this probe does no DB I/O.
const indexPath = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
let snapshot;
const Index = productionMotionMethods(indexPath, ['openReaderControlDirectory', 'openDirectory', 'publishNavigation', 'navigateTo'],
  { MangaBookPresentation: { get: (sourceId, bookId) => {
    assert.equal(sourceId, 'source'); assert.equal(bookId, 'book'); return snapshot;
  } } });
snapshot = { chapterIndex: 691, chapterTitle: '346', pageOrdinal: 4, totalPages: 24 };
const old = { sourceId: 'source', bookId: 'book', contentKind: 'manga', mangaPosition: { chapterIndex: 1, pageOrdinal: 2 } };
const index = Object.assign(new Index(), { loadDirectoryOperationProjections() {} });
Object.assign(index.readingEntry, { sessionActive: true, contentKind: 'manga', book: old,
  toc: [{ index: 691 }], directoryCurrentChapterIndex: 691, directoryPresentationGeneration: 1 });
index.navigateTo('reading');
index.openReaderControlDirectory();
assert.equal(index.readingEntry.book.mangaPosition, snapshot, 'opening snapshots the confirmed current position before route publication');
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
snapshot = { chapterIndex: 1, pageOrdinal: 9, totalPages: 30 }; index.navigateTo('reading'); index.openReaderControlDirectory();
assert.deepEqual(indexPageParams(), { directoryCurrentPageOrdinal: -1, directoryCurrentPageTotal: -1 },
  'another chapter cannot contribute its confirmed page position to the current chapter');
const unguarded = sources.index.replace(
  'this.readingEntry.book.mangaPosition?.chapterIndex === this.readingEntry.directoryCurrentChapterIndex ?', 'true ?');
assert.notEqual(unguarded, sources.index);
assert.throws(() => assert.deepEqual(indexPageParams(unguarded), { directoryCurrentPageOrdinal: -1, directoryCurrentPageTotal: -1 }),
  undefined, 'same-chapter snapshot fence negative control rejects a wrong-chapter page');
snapshot = undefined; index.navigateTo('reading'); index.openReaderControlDirectory();
assert.equal(index.readingEntry.book.mangaPosition, undefined, 'unknown location cannot retain old page facts');
assert.deepEqual(indexPageParams(), { directoryCurrentPageOrdinal: -1, directoryCurrentPageTotal: -1 });
assert.match(sources.index, /directoryCurrentPageOrdinal: this\.readingEntry\.book\.mangaPosition\?\.chapterIndex === this\.readingEntry\.directoryCurrentChapterIndex \?/);
assert.match(sources.index, /directoryCurrentPageTotal: this\.readingEntry\.book\.mangaPosition\?\.chapterIndex === this\.readingEntry\.directoryCurrentChapterIndex \?/);
console.log('PASS actual SDK ReaderShell manga BookDirectoryPage/novel Full entry, complete681 catalog, current/unknown/wrong-chapter snapshot and exact Index page expressions, canonical proof/download/recovery/back and 4 missing-wire negatives; native pixels remain pending');

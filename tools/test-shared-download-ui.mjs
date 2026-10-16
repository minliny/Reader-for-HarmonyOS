import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });
const projection = await import('../entry/src/main/ets/features/downloads/SharedDownloadProjection.ts');
const { SharedDownloadGateway } = await import('../entry/src/main/ets/features/downloads/SharedDownloadGateway.ts');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const visual = await import('../entry/src/main/ets/features/common/SharedDownloadVisualSpec.ts');
const { DOWNLOAD_VISUAL, downloadVisualColor } = visual;
const { createDownloadBookView, projectDownloadBookAvailability, filterDownloadBooks, describeDownloadReadingTarget } = projection;
const shelf = (sourceId, bookId, kind = 'text') => ({ sourceId, bookId, contentKind: kind,
  title: bookId, author: '作者', sourceName: '书源', addedAt: 1 });
const row = (index, state = 'missing', bytes = 0, extra = {}) => ({ chapterIndex: index,
  title: `第${index + 1}章`, url: `chapter:${index}`, navigable: true, state, cachedBytes: bytes, ...extra });
const status = (book, chapters, tocAvailable = true) => ({ sourceId: book.sourceId, bookId: book.bookId, tocAvailable, chapters });
const novel = shelf('s1', 'same');
const calls = [], requestParams = [];
const runtime = {
  request: async (method, params) => { calls.push(method); requestParams.push({ method, params });
    return { data: status(novel, [row(0, 'cached', 12), row(1)]) }; },
};
const view = await new SharedDownloadGateway(runtime).load(novel, () => true);
assert.equal(view.downloadedChapters, 1);
assert.equal(view.state, 'downloaded', 'partial book availability is separate from 100% progress');
assert.equal(view.progressPercent, 50);
assert.deepEqual(calls, ['cache.book.status'], 'text listing must not acquire content or enter a reader');
assert.deepEqual(requestParams, [{ method: 'cache.book.status', params: {
  sourceId: novel.sourceId, bookId: novel.bookId, includeGlobalStats: false, includeChapterStates: true,
} }], 'the existing Core CacheBookStatusParams contract receives its exact camelCase selector and scan flags');
assert.deepEqual(novel, shelf('s1', 'same'), 'projection cannot mutate shelf metadata');
const unavailable = await new SharedDownloadGateway({ request: async () => { throw Error('network'); } }).load(novel, () => true);
assert.equal(unavailable.stateLabel, '');
assert.equal(unavailable.projectionStatus, 'unavailable', 'a failed read is not a download failure');
const unknown = await new SharedDownloadGateway({ request: async () => ({ data: status(novel, [], false) }) }).load(novel, () => true);
assert.equal(unknown.state, undefined);
assert.equal(unknown.progressPercent, undefined);
const zeroBody = await new SharedDownloadGateway({ request: async () => ({ data: status(novel, [row(0, 'cached', 0)]) }) }).load(novel, () => true);
assert.equal(zeroBody.downloadedChapters, 0, 'metadata alone cannot prove a saved body');
const other = { ...createDownloadBookView(shelf('s2', 'same', 'manga')), recentRead: 2 };
const filters = { query: '', type: 'all', state: 'all', sourceId: 'all', sort: 'recent', direction: 'desc' };
assert.equal(filterDownloadBooks([view, other, unknown], filters).length, 3, 'all shelf rows survive absent downloads/metadata');
assert.equal(filterDownloadBooks([view, other], { ...filters, sourceId: 's1' }).length, 1);
assert.equal(filterDownloadBooks([view, other], { ...filters, type: 'manga' })[0].sourceId, 's2');
assert.equal(filterDownloadBooks([{ ...view, recentRead: 1 }, other], filters)[0].sourceId, 's2');
assert.equal(filterDownloadBooks([{ ...view, recentRead: 1 }, other], { ...filters, direction: 'asc' })[0].sourceId, 's1');
const target = describeDownloadReadingTarget(view, view.chapters[0]);
assert.equal(target.wired, true);
assert.equal(target.chapterIndex, 0);
assert.equal(target.chapterId, 'chapter:0');
assert.match(target.description, /小说正文阅读页/);
assert.equal(describeDownloadReadingTarget(view, { ...view.chapters[0], sourceId: 's2' }).route, 'unavailable');
assert.equal(describeDownloadReadingTarget(view, { ...view.chapters[0], chapterId: 'other' }).route, 'unavailable');

// Storage statistics remain an independent, read-only projection. Text-body
// bytes and unknown global classifications must never become cleanup facts.
const { formatDownloadStorageBytes, canCleanDownloadStorage } = projection;
const storageMiB = 1024 * 1024, storageGiB = storageMiB * 1024;
for (const invalid of [undefined, NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])
  assert.equal(formatDownloadStorageBytes(invalid), '', 'unproven byte values leave an empty storage slot');
assert.match(formatDownloadStorageBytes(0), /^0\s*MB$/, 'a known zero remains distinct from unknown');
for (const [bytes, unit] of [[1, 'B'], [1024, 'KB'], [storageMiB, 'MB'], [storageGiB, 'GB']])
  assert.match(formatDownloadStorageBytes(bytes), new RegExp(`^1(?:\\.0)?\\s*${unit}$`));
const storageFixture = { totalBytes: 3 * storageGiB, retainedBytes: storageGiB,
  automaticBytes: 2 * storageGiB, cleanableBytes: 512 * storageMiB, availableBytes: 8 * storageGiB };
assert.equal(canCleanDownloadStorage(storageFixture), true);
for (const summary of [{}, { automaticBytes: storageGiB }, { cleanableBytes: storageMiB },
  { automaticBytes: storageGiB, cleanableBytes: 0 },
  { automaticBytes: storageMiB, cleanableBytes: storageGiB },
  ...[NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1].flatMap(value => [
    { automaticBytes: value, cleanableBytes: 1 }, { automaticBytes: storageGiB, cleanableBytes: value }])])
  assert.equal(canCleanDownloadStorage(summary), false, 'cleanup needs positive proven candidates within automatic storage');
assert.equal(canCleanDownloadStorage({ ...storageFixture, cleanableBytes: storageFixture.automaticBytes }), true,
  'the inclusive candidate bound accepts an explicitly proven complete automatic set');

// Exercise the existing MangaSessionGateway decoder and exact Host completion
// port, not a replacement implementation of image decoding or disk ownership.
const comic = shelf('comic-source', 'same', 'manga');
const pageId = 'mp1:' + 'a'.repeat(64);
const entry = { chapter: { chapterIndex: 1, totalPages: 1, pageStart: 0, cached: true, resources: [],
  manifest: { chapter: { sourceId: comic.sourceId, bookId: comic.bookId, chapterId: 'chapter:1' },
    manifestVersion: 'v1', sourceRuleVersion: 'r1', decodeRevision: 'identity-v1',
    pages: [{ pageId, ordinal: 0, resourceRef: `manga:${pageId}` }] } },
  targetOrdinal: 0, recoveryRequired: false, progress: { token: { epoch: 1, revision: 0 }, location: null } };
const comicCalls = [], comicParams = [], proofs = [];
const cachedEntry = (index) => ({ ...entry, chapter: { ...entry.chapter, chapterIndex: index,
  manifest: { ...entry.chapter.manifest, chapter: { ...entry.chapter.manifest.chapter,
    chapterId: `chapter:${index}` } } } });
const comicRuntime = {
  supportsCoreCapability: capability => capability === 'manga.entry.v1',
  request: async (method, params) => {
    comicCalls.push(method);
    comicParams.push({ method, params });
    if (method === 'manga.entry.get') return { data: { entry: cachedEntry(params.chapterIndex) } };
    return { data: status(comic,
      [row(0, 'missing', 0, { title: '第一卷', navigable: false, level: 1 }),
        row(1, 'completed', 10, { mangaManifestVersion: 'v1' }),
        row(2, 'cached', 10, { mangaManifestVersion: 'v1' }),
        row(3, 'cached', 10, { mangaManifestVersion: 'v1' })]) };
  },
  isOfflineImageChapterComplete: async identity => {
    proofs.push(identity);
    return identity.chapterIndex !== 3;
  },
};
const mangaView = await new SharedDownloadGateway(comicRuntime).load(comic, () => true);
assert.equal(mangaView.totalChapters, 3, 'a volume heading is not a chapter/download');
assert.equal(mangaView.downloadedChapters, 2, 'Host manifest and file proof supplies completed and cached manga chapter state');
assert.equal(mangaView.bytes, undefined, 'text JSON size is not manga image disk usage');
assert.equal(projection.downloadChapterDetailLabel('manga', mangaView.chapters[1]), '1 / 1 页 · 已下载');
assert.equal(mangaView.chapters[2].localComplete, true, 'a cached Core row with a manifest is verified by Host');
assert.equal(mangaView.chapters[3].localComplete, false, 'a cached row with a missing image receipt remains repairable');
assert.equal(mangaView.chapters[3].stateLabel, '待修复');
assert.deepEqual(comicCalls, ['cache.book.status', 'manga.entry.get', 'manga.entry.get', 'manga.entry.get'], 'manga list verifies completed and cached rows');
assert.deepEqual(comicParams, [
  { method: 'cache.book.status', params: { sourceId: comic.sourceId, bookId: comic.bookId,
    includeGlobalStats: false, includeChapterStates: true } },
  { method: 'manga.entry.get', params: { sourceId: comic.sourceId, bookId: comic.bookId, chapterIndex: 1 } },
  { method: 'manga.entry.get', params: { sourceId: comic.sourceId, bookId: comic.bookId, chapterIndex: 2 } },
  { method: 'manga.entry.get', params: { sourceId: comic.sourceId, bookId: comic.bookId, chapterIndex: 3 } },
]);
assert.deepEqual(proofs, [1, 2, 3].map(chapterIndex => ({ sourceId: comic.sourceId, bookId: comic.bookId, chapterIndex,
  chapterId: `chapter:${chapterIndex}`, contentVersion: 'v1', mangaDecodeRevision: 'identity-v1' })));
assert.equal(mangaView.chapters[1].mangaTotalPages, 1);
assert.equal(mangaView.chapters[1].mangaSavedPages, 1);
assert.equal(projection.downloadChapterDetailLabel('manga', mangaView.chapters[1]), '1 / 1 页 · 已下载');
assert.match(describeDownloadReadingTarget(mangaView, mangaView.chapters[1]).description, /漫画图片阅读页/);

// Host integrity checks are batched: Core queue completion is only a
// candidate, while a missing page file downgrades that chapter to repairable
// state. Four concurrent entry/file proofs bound startup work for long books.
{
  const batchBook = shelf('comic-source', 'batch', 'manga');
  const batchRows = Array.from({ length: 9 }, (_, index) => row(index, 'completed', 0, {
    url: `chapter:${index}`, mangaManifestVersion: 'v1',
  }));
  let activeProofs = 0, maxProofs = 0;
  const batchCalls = [];
  const batchRuntime = {
    supportsCoreCapability: capability => capability === 'manga.entry.v1',
    request: async (method, params) => {
      batchCalls.push(method);
      if (method === 'cache.book.status') return { data: status(batchBook, batchRows) };
      activeProofs += 1; maxProofs = Math.max(maxProofs, activeProofs);
      await new Promise(resolve => setTimeout(resolve, 2));
      activeProofs -= 1;
      const index = params.chapterIndex;
      const batchEntry = {
        ...entry,
        chapter: {
          ...entry.chapter,
          chapterIndex: index,
          manifest: {
            ...entry.chapter.manifest,
            chapter: { ...entry.chapter.manifest.chapter, sourceId: batchBook.sourceId, bookId: batchBook.bookId,
              chapterId: `chapter:${index}` },
          },
        },
      };
      return { data: { entry: batchEntry } };
    },
    isOfflineImageChapterComplete: async identity => identity.chapterIndex !== 3,
  };
  const batchView = await new SharedDownloadGateway(batchRuntime).load(batchBook, () => true);
  assert.equal(maxProofs, 4, 'manga Host proofs use bounded batches');
  assert.equal(batchView.downloadedChapters, 8, 'Core completed row with a missing Host file is incomplete');
  assert.equal(batchView.chapters[3].localComplete, false);
  assert.match(batchView.chapters[3].stateLabel, /未下载|待修复/);
  assert.equal(batchCalls.filter(method => method === 'manga.entry.get').length, 9);
}
let active = true, finish;
const pending = new SharedDownloadGateway({ request: () => new Promise(resolve => { finish = resolve; }) }).load(novel, () => active);
active = false; finish({ data: status(novel, [row(0)]) });
await assert.rejects(pending, /失效/, 'late status cannot publish after presentation retirement');

// Run the actual SDK-emitted page callbacks. Native paint is a separate gate.
const source = readFileSync('entry/src/main/ets/features/downloads/SharedDownloadPage.ets', 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(sdk + '/node_modules/typescript');
const pageTree = ts.createSourceFile('SharedDownloadPage.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS);
const pageMembers = pageTree.statements.find(node => node.name?.getText(pageTree) === 'SharedDownloadPage').members;
const helpers = pageMembers.filter(member => ts.isMethodDeclaration(member) && member.name.getText(pageTree) !== 'build' &&
  !ts.getAllDecorators(member).some(decorator => decorator.expression.getText(pageTree) === 'Builder'))
  .map(member => member.name.getText(pageTree));
const names = [...new Set(['sortBars', ...helpers])];
const events = [], saved = [];
const { owner } = createReaderBuilderProbe(source, names, { ...projection, ...visual });
const chapter = mangaView.chapters[1];
const mixed = projectDownloadBookAvailability(mangaView, [
  { ...chapter, localComplete: false, queueState: 'inProgress' },
  { ...chapter, key: 'other', index: 2, localComplete: false, queueState: 'failed' },
], 2);
Object.assign(owner, { books: [view, mixed], detailKey: '', actionBookKeys: [mixed.key], actionChapterIndices: [],
  sheet: 'book-actions', confirmation: '', managing: false, mounted: true,
  mountedIdentity: 'download-business-test', presentationIdentity: 'download-business-test', presentationGeneration: 0,
  listScroller: { currentOffset: () => ({ yOffset: 87 }) }, listOffset: 0,
  onIntent: value => events.push(value), onReadTarget: value => events.push(value),
  onViewStateChanged: value => saved.push(value), query: 'same', bookType: 'all', stateFilter: 'all',
  sourceFilter: 'all', sortField: 'recent', sortDirection: 'desc' });
assert.equal(mixed.stateLabel, '下载失败');
assert.equal(owner.bookIsRunning(mixed), true, 'pause decision must use queue facts, not label text');
owner.sendAction('cancel');
assert.equal(events[0].scope, 'books');
assert.equal(events[0].books[0].chapterIndices, undefined);
owner.actionChapterIndices = [1]; owner.sendAction('deleteLocal');
assert.equal(events[1].scope, 'chapters');
assert.deepEqual(events[1].books[0].chapterIndices, [1]);
assert.equal(mangaView.downloadedChapters, 2, 'presentation intent cannot fake deletion success');
owner.showReadTarget(mangaView, chapter);
assert.equal(events[2].wired, true);
assert.equal(owner.readingBookTitle, mangaView.title);
assert.equal(owner.readingChapterTitle, chapter.title);
assert.equal(events[2].chapterId, chapter.chapterId, 'identity stays in the real reading target, not implementation copy');
assert.equal(owner.consumeBack(), true); // Close target sheet.
assert.equal(owner.consumeBack(), false);
assert.equal(saved.at(-1).listScroll, 87, 'save latest offset before the root retires identity');

// Exercise the production cleanup button and confirmation callbacks. There
// is deliberately no RPC/filesystem port or invented successful publication.
const storageMetrics = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const cleanupProbe = createReaderBuilderProbe(source, [...new Set([
  'clearStorageButton', 'confirmationOverlay', 'confirmationContent', 'confirmationBody', 'confirmationButton', ...helpers])], {
  ...projection, ...visual, ...storageMetrics, ButtonType: { Normal: 'normal' },
  ReaderWindowCoordinator: { metrics: () => ({ ...storageMetrics.createDefaultReaderWindowMetrics(),
    windowRect: { left: 0, top: 0, width: 366, height: 809 }, systemFontScale: 1 }), requestAppChrome() {} },
});
function storageOwner(summary = { ...storageFixture }) {
  const intents = [];
  const result = new cleanupProbe.Component(undefined, {});
  Object.assign(result, { books: [view, mixed], storageSummary: summary, appThemeScheme: 'day',
    sheet: 'settings', confirmation: '', mounted: true, mountedIdentity: 'storage-test', presentationIdentity: 'storage-test',
    presentationGeneration: 0, fontPreparationGeneration: 0, overlayChromeRequestGeneration: 0, overlayChromeClaimed: false,
    actionBookKeys: [], actionChapterIndices: [], cacheLimitMb: 2048, cleanupAfterDays: 7,
    pageHeight: 800, dialogActionsMeasuredHeight: 44, detailKey: '', listOffset: 0,
    query: '', bookType: 'all', stateFilter: 'all', sourceFilter: 'all', sortField: 'recent', sortDirection: 'desc',
    listScroller: { currentOffset: () => ({ yOffset: 0 }) }, onTemporaryBackBridge() {}, onViewStateChanged() {},
    onIntent: value => intents.push(value) });
  result.clearStorageButton();
  return { result, intents, button: [...result.nodes.values()].find(node => node.type === 'Button') };
}
const cleanup = storageOwner(), cleanupDataBefore = structuredClone(cleanup.result.storageSummary);
assert.equal(cleanup.button.backgroundColor, 'Color.Transparent');
assert.equal(cleanup.button.accessibilityText, '清理自动保存 · 512 MB');
assert.equal(cleanup.button.width, 'LayoutPolicy.matchParent');
assert.equal(cleanup.button.height, 'LayoutPolicy.matchParent');
cleanup.button.onClick();
assert.equal(cleanup.result.confirmation, 'cleanup', 'the cleanup button only opens confirmation');
assert.equal(cleanup.result.sheet, 'settings', 'cancel can return to the same approved storage sheet');
assert.deepEqual(cleanup.intents, []);
cleanup.result.confirmationOverlay();
const cleanupDialogButtons = [...cleanup.result.nodes.values()].filter(node => node.type === 'Button').slice(-2);
assert.equal(cleanupDialogButtons.length, 2);
cleanupDialogButtons[0].onClick();
assert.equal(cleanup.result.confirmation, ''); assert.equal(cleanup.result.sheet, 'settings');
assert.deepEqual(cleanup.intents, [], 'cancel cannot request a mutation');
cleanup.button.onClick(); cleanupDialogButtons[1].onClick();
assert.equal(cleanup.intents.length, 1);
assert.equal(cleanup.intents[0].action, 'cleanup'); assert.equal(cleanup.intents[0].scope, 'storage');
assert.deepEqual(cleanup.intents[0].books, []);
assert.equal(cleanup.intents[0].cacheLimitMb, 2048); assert.equal(cleanup.intents[0].cleanupAfterDays, 7);
assert.deepEqual(cleanup.result.storageSummary, cleanupDataBefore, 'an unwired intent cannot claim bytes were deleted');
assert.deepEqual(cleanup.result.books, [view, mixed], 'cleanup presentation cannot mutate shelf/download projection');
for (const summary of [{}, { automaticBytes: storageGiB, cleanableBytes: 0 },
  { automaticBytes: storageMiB, cleanableBytes: storageGiB }]) {
  const blocked = storageOwner(summary); assert.equal(blocked.button.enabled, false);
  blocked.button.onClick(); assert.equal(blocked.result.confirmation, '');
  blocked.result.confirmation = 'cleanup'; blocked.result.confirmStorageCleanup();
  assert.deepEqual(blocked.intents, [], 'unknown/zero/invalid candidates cannot dispatch even through a stale callback');
}
const refreshedCleanup = storageOwner(); refreshedCleanup.button.onClick(); refreshedCleanup.result.confirmationOverlay();
const refreshedConfirm = [...refreshedCleanup.result.nodes.values()].filter(node => node.type === 'Button').at(-1).onClick;
refreshedCleanup.result.storageSummary = { ...storageFixture, cleanableBytes: 0 }; refreshedConfirm();
assert.deepEqual(refreshedCleanup.intents, [], 'confirmation rechecks the latest executable candidates');
const retiredCleanup = storageOwner(); retiredCleanup.button.onClick(); retiredCleanup.result.confirmationOverlay();
const retiredConfirm = [...retiredCleanup.result.nodes.values()].filter(node => node.type === 'Button').at(-1).onClick;
retiredCleanup.result.aboutToDisappear(); retiredCleanup.button.onClick(); retiredConfirm();
assert.deepEqual(retiredCleanup.intents, [], 'retired cleanup actors cannot operate another presentation');
retiredCleanup.result.mounted = true; retiredCleanup.result.confirmation = 'cleanup'; retiredConfirm();
assert.deepEqual(retiredCleanup.intents, [], 'a same-identity remount cannot reactivate the previous dialog callback');

// New business controls carry their own retained Day/Night proof. The
// historical theme gate keeps all its original foreground sites unchanged.
const colorMethods = [...new Set(['typeTab', 'statusButton', 'menuAction', 'actionButton', 'choiceRow', ...helpers])];
const colorProbe = createReaderBuilderProbe(source, colorMethods, {
  ButtonType: { Normal: 'normal' }, TextAlign: { Start: 'start', Center: 'center' },
  DOWNLOAD_VISUAL, downloadVisualColor, ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) },
});
const controls = colorProbe.owner;
Object.assign(controls, { appThemeScheme: 'day', bookType: 'manga', selectedBookKeys: [], managing: false });
controls.typeTab('manga', '漫画');
controls.statusButton(() => mixed);
controls.menuAction(() => '删除本地内容', true, () => true, () => {});
controls.actionButton(() => '主操作', true, () => true, () => {});
controls.actionButton(() => '次操作', false, () => true, () => {});
controls.choiceRow('筛选内容', () => true, () => {});
for (const scheme of ['day', 'night', 'day']) {
  controls.appThemeScheme = scheme; controls.replay();
  const actual = [...controls.nodes.values()];
  const primary = downloadVisualColor('green', scheme);
  assert.equal(controls.tabInk('manga'), primary);
  assert.equal(controls.actionInk(false), downloadVisualColor('ink', scheme));
  assert.equal(controls.statusInk(mixed), downloadVisualColor('danger', scheme));
  assert.ok(actual.some(node => node.fontColor === primary), 'real native callback applies selected/secondary emphasis');
  assert.ok(actual.some(node => node.fontColor === downloadVisualColor('greenInk', scheme)), 'solid action keeps demo on-primary foreground');
  assert.ok(actual.some(node => node.fontColor === downloadVisualColor('danger', scheme)), 'failure/delete callbacks retain demo danger foreground');
  assert.equal(controls.statusIcon({ ...mixed, stateLabel: '下载中' }),
    `app.media.download_visual_pause${scheme === 'night' ? '_theme_night' : ''}`, 'pause uses the demo Lucide asset and a fixed theme variant');
}

// Host probes isolate only existing bookshelf/runtime ports, retaining the
// unchanged production Host body and its generation/single-flight logic.
const hostSource = readFileSync('entry/src/main/ets/features/downloads/SharedDownloadHost.ts', 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '');
const hostBody = ts.transpileModule(hostSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
let loads = 0, resolveProbe, hold = false;
class ShelfPort { async loadAll() { return { books: [novel, comic] }; } }
class StatusPort { async load(book) { loads++; if (hold) await new Promise(resolve => { resolveProbe = resolve; }); return { ...book, projectionStatus: 'ready' }; } }
const exports = {};
new Function('exports', 'BookshelfFlowGateway', 'SharedDownloadGateway', 'createDownloadBookView', hostBody)(exports, ShelfPort, StatusPort, createDownloadBookView);
const publications = [], host = new exports.SharedDownloadHost({}, snapshot => publications.push(snapshot));
await host.reload(() => true);
assert.equal(publications.at(-1).books.length, 2);
hold = true; const before = loads;
const refreshA = host.refreshBook(publications.at(-1).books[0], () => true);
const refreshB = host.refreshBook(publications.at(-1).books[0], () => true);
assert.equal(loads - before, 1, 'same-book refreshes share one real read');
const published = publications.length; host.retire(); resolveProbe(); await Promise.all([refreshA, refreshB]);
assert.equal(publications.length, published, 'retired Host cannot overwrite the next presentation');

// A download status clock is independent from readingProjectionRevision. A
// second page mount reuses unchanged rows, while a background prefetch event
// invalidates only the affected book and is coalesced into one 100ms patch.
let indexedLoads = 0;
const downloadListeners = new Set();
const revisionOwner = {
  readingRevision: 0, downloadRevisions: new Map(),
  bookAcquisitions() { return {
    readingProjectionRevision: () => revisionOwner.readingRevision,
    downloadStatusRevision: (sourceId, bookId) => revisionOwner.downloadRevisions.get(JSON.stringify([sourceId, bookId])) ?? 0,
    subscribeDownloadStatus: listener => { downloadListeners.add(listener); return () => downloadListeners.delete(listener); },
  }; },
};
class IndexedStatusPort {
  constructor() {}
  async load(book) { indexedLoads++; return { ...book, projectionStatus: 'ready', chapters: [], totalChapters: 1,
    downloadedChapters: indexedLoads > 1 && book.sourceId === 's1' ? 1 : 0, state: indexedLoads > 1 && book.sourceId === 's1' ? 'downloaded' : 'none', stateLabel: '', progressPercent: 0 }; }
}
const indexedExports = {};
new Function('exports', 'BookshelfFlowGateway', 'SharedDownloadGateway', 'createDownloadBookView', hostBody)(indexedExports, ShelfPort, IndexedStatusPort, createDownloadBookView);
const firstMount = new indexedExports.SharedDownloadHost(revisionOwner, () => {});
await firstMount.reload(() => true);
const firstLoadCount = indexedLoads;
firstMount.retire();
const secondMount = new indexedExports.SharedDownloadHost(revisionOwner, () => {});
await secondMount.reload(() => true);
assert.equal(indexedLoads, firstLoadCount, 'same download revision reuses the cross-page status index');
secondMount.retire();
const progressSnapshots = [];
const progressHost = new indexedExports.SharedDownloadHost(revisionOwner, snapshot => progressSnapshots.push(snapshot));
await progressHost.reload(() => true);
const novelKey = JSON.stringify(['s1', 'same']);
const comicKey = JSON.stringify(['comic-source', 'same']);
const unchangedBeforeProgress = progressSnapshots.at(-1).books.find(book => book.key === comicKey);
const beforeProgress = indexedLoads;
revisionOwner.downloadRevisions.set(novelKey, 1);
downloadListeners.forEach(listener => listener({ reset: false, identities: [novel, novel] }));
await new Promise(resolve => setTimeout(resolve, 140));
assert.equal(indexedLoads - beforeProgress, 1, 'duplicate background notifications refresh one changed book');
assert.equal(progressSnapshots.at(-1).books.find(book => book.key === novelKey).downloadedChapters, 1,
  'background completion publishes the refreshed chapter summary');
assert.equal(progressSnapshots.at(-1).books.find(book => book.key === comicKey), unchangedBeforeProgress,
  'unchanged row remains the same object');
progressHost.retire();
console.log('PASS shared-download: real cache/body/manifest projection, unknown/partial status, filters/direction, exact wired reading targets, scoped intents, latest scroll, single-flight and stale publication');

// Read the committed device-sized policy, including a non-preset and fractional
// MiB value; opening the settings sheet must not select a fabricated preset.
owner.storagePolicy = { capacityBytes: 777 * storageMiB + 123, expiryDays: 19 };
owner.sheet = ''; owner.storagePolicyDraftChanged = false; owner.syncStoragePolicy();
assert.equal(owner.cacheLimitMb * storageMiB, owner.storagePolicy.capacityBytes);
assert.equal(owner.limitChoices()[owner.limitIndex()] * storageMiB, owner.storagePolicy.capacityBytes);
assert.equal(owner.dayChoices()[owner.daysIndex()], 19);
owner.sheet = 'settings'; owner.storagePolicyDraftChanged = true;
owner.cacheLimitMb = 1024; owner.cleanupAfterDays = 3; owner.syncStoragePolicy();
assert.equal(owner.cacheLimitMb, 1024); assert.equal(owner.cleanupAfterDays, 3, 'background policy read cannot overwrite an open dirty draft');
owner.storagePolicyDraftChanged = false; owner.syncStoragePolicy();
assert.equal(owner.cacheLimitMb * storageMiB, owner.storagePolicy.capacityBytes);
console.log('PASS actual download policy selector preserves measured non-preset bytes and a dirty settings draft');

// Accepted Runtime intent progress also batches only changed books. A second
// job in the snapshot is not a reason to re-query the entire shelf.
{
  let intentLoads = 0, subscriber;
  const jobs = [novel, comic].map(book => ({ key: JSON.stringify([book.sourceId, book.bookId]),
    sourceId: book.sourceId, bookId: book.bookId, book, revision: 1, status: 'paused', updatedAt: 1,
    requestedIndexes: [], pausedIndexes: [], retainedIndexes: [], preservedRetentions: [], chapters: [] }));
  const coordinator = { restore: async () => {}, books: () => [novel, comic], jobs: () => jobs,
    job: (sourceId, bookId) => jobs.find(job => job.sourceId === sourceId && job.bookId === bookId),
    projectionRevision: (sourceId, bookId) => String(jobs.find(job => job.sourceId === sourceId && job.bookId === bookId)?.revision),
    subscribe(fn) { subscriber = fn; fn({ books: [novel, comic], jobs }); return () => { subscriber = undefined; }; },
  };
  class IntentStatusPort { async load(book) { intentLoads++; return { ...book,
    projectionStatus: 'ready', chapters: [], totalChapters: 1, downloadedChapters: 0, progressPercent: 0 }; } }
  const intentExports = {};
  new Function('exports', 'BookshelfFlowGateway', 'SharedDownloadGateway', 'createDownloadBookView', hostBody)(
    intentExports, ShelfPort, IntentStatusPort, createDownloadBookView);
  const snapshots = [], intentHost = new intentExports.SharedDownloadHost({ getDownloadCoordinator: () => coordinator },
    snapshot => snapshots.push(snapshot));
  await intentHost.reload(() => true);
  const beforeIntentLoads = intentLoads, unchanged = snapshots.at(-1).books.find(book => book.key === comicKey);
  jobs[0] = { ...jobs[0], revision: 2, updatedAt: 2 };
  subscriber({ books: [novel, comic], jobs }); subscriber({ books: [novel, comic], jobs });
  await new Promise(resolve => setTimeout(resolve, 140));
  assert.equal(intentLoads - beforeIntentLoads, 1);
  assert.equal(snapshots.at(-1).books.find(book => book.key === comicKey), unchanged);
  intentHost.retire(); assert.equal(subscriber, undefined, 'retiring a page releases its observer, not the Runtime accepted job');
}
console.log('PASS accepted download intent bursts refresh one changed book and retain unrelated row objects');

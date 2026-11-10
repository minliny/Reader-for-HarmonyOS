import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"text-projection": {"description": "实际Gateway exact text cache selector/部分未知/正文bytes与过滤/读目标/失效", "resources": []}, "storage-admission": {"description": "实际storage bytes格式与已证cleanable<=automatic准入", "resources": []}, "manga-projection": {"description": "实际Manga entry解码与Host image证明/元数据不可冒充diskbytes", "resources": []}, "manga-proof-batch": {"description": "实际Gateway9章图片证明并发预算与缺页降级，受控microtask", "resources": []}, "page-actions": {"description": "实际SDK书/章节意图范围、精确reading target与最新Scroll保存", "resources": []}, "storage-policy": {"description": "实际SDK non-preset/fractional容量策略与dirty draft保护", "resources": []}, "storage-actions": {"description": "实际SDK清理确认/取消/最新证明/retired generation且不伪造删除", "resources": []}, "live-theme": {"description": "实际SDK业务控件语义色/当前资源scheme更新", "resources": []}, "host-single-flight": {"description": "完整实际Host同书single-flight与retired拒绝", "resources": []}, "host-index": {"description": "完整实际Host下载revision索引跨页面复用与重复burst单书刷新", "resources": []}, "host-intents": {"description": "实际Host Runtime任务变更刷新、注销observer及批量确认/未决/跳过回执", "resources": []}};
definitions['sheet-choice'] = { description: '实际下载选项单一点击、稳定 identity、过期面板回调拒绝', resources: [] };
definitions['overlay-lifecycle'] = { description: '下载面板退场连续返回、嵌套确认焦点和同页陈旧确认', resources: [] };
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });
const projection = await import('../entry/src/main/ets/features/downloads/presentation/SharedDownloadProjection.ts');
const { SharedDownloadGateway } = await import('../entry/src/main/ets/features/downloads/application/SharedDownloadGateway.ts');

const visual = await import('../entry/src/main/ets/features/downloads/ui/SharedDownloadVisualSpec.ts');
const { consumeReaderControlKeyboardBack } = await import('../entry/src/main/ets/ui/foundation/ReaderKeyboardBack.ts');
const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const backDependencies = { consumeReaderControlKeyboardBack, ReaderWindowCoordinator: { metrics: createDefaultReaderWindowMetrics } };
const { DOWNLOAD_VISUAL, downloadVisualColor } = visual;
const { createDownloadBookView, projectDownloadBookAvailability, filterDownloadBooks, describeDownloadReadingTarget } = projection;
const shelf = (sourceId, bookId, kind = 'text') => ({ sourceId, bookId, contentKind: kind,
  title: bookId, author: '作者', sourceName: '书源', addedAt: 1 });
const row = (index, state = 'missing', bytes = 0, extra = {}) => ({ chapterIndex: index,
  title: `第${index + 1}章`, url: `chapter:${index}`, navigable: true, state, cachedBytes: bytes, ...extra });
const status = (book, chapters, tocAvailable = true) => ({ sourceId: book.sourceId, bookId: book.bookId, tocAvailable, chapters });
const novel = shelf('s1', 'same');
const comic = shelf('comic-source', 'same', 'manga');
const pageId = 'mp1:' + 'a'.repeat(64);
const entry = { chapter: { chapterIndex: 1, totalPages: 1, pageStart: 0, cached: true, resources: [],
  manifest: { chapter: { sourceId: comic.sourceId, bookId: comic.bookId, chapterId: 'chapter:1' },
    manifestVersion: 'v1', sourceRuleVersion: 'r1', decodeRevision: 'identity-v1',
    pages: [{ pageId, ordinal: 0, resourceRef: `manga:${pageId}` }] } },
  targetOrdinal: 0, recoveryRequired: false, progress: { token: { epoch: 1, revision: 0 }, location: null } };
const storageMiB=1024*1024,storageGiB=storageMiB*1024;const storageFixture={totalBytes:3*storageGiB,retainedBytes:storageGiB,automaticBytes:2*storageGiB,cleanableBytes:512*storageMiB,availableBytes:8*storageGiB};

if(selectedCase==='text-projection'){
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

let active = true, finish;
const pending = new SharedDownloadGateway({ request: () => new Promise(resolve => { finish = resolve; }) }).load(novel, () => active);
active = false; finish({ data: status(novel, [row(0)]) });
await assert.rejects(pending, /失效/, 'late status cannot publish after presentation retirement');

}
if(selectedCase==='storage-admission'){
const { formatDownloadStorageBytes, canCleanDownloadStorage } = projection;
for (const invalid of [undefined, NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])
  assert.equal(formatDownloadStorageBytes(invalid), '', 'unproven byte values leave an empty storage slot');
assert.match(formatDownloadStorageBytes(0), /^0\s*MB$/, 'a known zero remains distinct from unknown');
for (const [bytes, unit] of [[1, 'B'], [1024, 'KB'], [storageMiB, 'MB'], [storageGiB, 'GB']])
  assert.match(formatDownloadStorageBytes(bytes), new RegExp(`^1(?:\\.0)?\\s*${unit}$`));
assert.equal(canCleanDownloadStorage(storageFixture), true);
for (const summary of [{}, { automaticBytes: storageGiB }, { cleanableBytes: storageMiB },
  { automaticBytes: storageGiB, cleanableBytes: 0 },
  { automaticBytes: storageMiB, cleanableBytes: storageGiB },
  ...[NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1].flatMap(value => [
    { automaticBytes: value, cleanableBytes: 1 }, { automaticBytes: storageGiB, cleanableBytes: value }])])
  assert.equal(canCleanDownloadStorage(summary), false, 'cleanup needs positive proven candidates within automatic storage');
assert.equal(canCleanDownloadStorage({ ...storageFixture, cleanableBytes: storageFixture.automaticBytes }), true,
  'the inclusive candidate bound accepts an explicitly proven complete automatic set');

}
if(selectedCase==='manga-projection'){
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

}
if(selectedCase==='manga-proof-batch'){
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
      await new Promise(resolve=>queueMicrotask(resolve));
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
}
if(['page-actions','storage-policy','storage-actions','live-theme','sheet-choice','overlay-lifecycle'].includes(selectedCase)){
// Run the actual SDK-emitted page callbacks. Native paint is a separate gate.
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const fixtureChapter=(book,index,complete)=>({key:JSON.stringify([book.sourceId,book.bookId,index]),sourceId:book.sourceId,bookId:book.bookId,index,title:`第${index+1}章`,chapterId:`chapter:${index}`,navigable:true,localComplete:complete,stateLabel:complete?'已下载':'未下载',queueState:'missing'});
const view=projectDownloadBookAvailability(createDownloadBookView(novel),[fixtureChapter(novel,0,true),fixtureChapter(novel,1,false)],2,12);
const mangaView=projectDownloadBookAvailability(createDownloadBookView(comic),[fixtureChapter(comic,0,false),fixtureChapter(comic,1,true),fixtureChapter(comic,2,true)],3);
const source = readFileSync('entry/src/main/ets/features/downloads/ui/SharedDownloadPage.ets', 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(sdk + '/node_modules/typescript');
const pageTree = ts.createSourceFile('SharedDownloadPage.ets', source, ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
const pageMembers = pageTree.statements.find(node => node.name?.getText(pageTree) === 'SharedDownloadPage').members;
const helpers = pageMembers.filter(member => ts.isMethodDeclaration(member) && member.name.getText(pageTree) !== 'build' &&
  !ts.getAllDecorators(member).some(decorator => decorator.expression.getText(pageTree) === 'Builder'))
  .map(member => member.name.getText(pageTree));
const names = [...new Set(['sortBars', ...helpers])];
const chapter = mangaView.chapters[1];
const mixed = projectDownloadBookAvailability(mangaView, [
  { ...chapter, localComplete: false, queueState: 'inProgress' },
  { ...chapter, key: 'other', index: 2, localComplete: false, queueState: 'failed' },
], 2);

const events=[],saved=[];
if(selectedCase==='page-actions'||selectedCase==='storage-policy'){
const { owner } = createReaderBuilderProbe(source, names, { ...projection, ...visual, ...backDependencies });
Object.assign(owner, { books: [view, mixed], detailKey: '', actionBookKeys: [mixed.key], actionChapters: [],
  selectedChapters: new Map(), sheet: 'book-actions', confirmation: '', managing: false, mounted: true,
  appForeground: true, covered: false,
  mountedIdentity: 'download-business-test', presentationIdentity: 'download-business-test', presentationGeneration: 0,
  listScroller: { currentOffset: () => ({ yOffset: 87 }) }, listOffset: 0,
  onIntent: value => events.push(value), onReadTarget: (value, current) => {
    assert.equal(current(), true);
    events.push(value);
  },
  onViewStateChanged: value => saved.push(value), query: 'same', bookType: 'all', stateFilter: 'all',
  sourceFilter: 'all', sortField: 'recent', sortDirection: 'desc' });
if(selectedCase==='page-actions'){
assert.equal(mixed.stateLabel, '下载失败');
assert.equal(owner.bookIsRunning(mixed), true, 'pause decision must use queue facts, not label text');
owner.sendAction('cancel');
assert.equal(events[0].scope, 'books');
assert.equal(events[0].books[0].chapterIndices, undefined);
owner.books = [view, mangaView];
owner.actionChapters = [owner.chapterProof(chapter)]; owner.sendAction('deleteLocal');
assert.equal(events[1].scope, 'chapters');
assert.deepEqual(events[1].books[0].chapterIndices, [1]);
assert.equal(mangaView.downloadedChapters, 2, 'presentation intent cannot fake deletion success');
owner.appForeground = true;
owner.readingHandoffRevision = 0;
owner.detailKey = mangaView.key;
owner.showReadTarget(mangaView, chapter);
assert.equal(events[2].wired, true);
assert.equal(events[2].bookId, mangaView.bookId);
assert.equal(events[2].chapterTitle, chapter.title);
assert.equal(events[2].chapterId, chapter.chapterId, 'identity stays in the real reading target, not implementation copy');
owner.detailKey = '';
assert.equal(owner.consumeBack(), false);
assert.equal(saved.at(-1).listScroll, 87, 'save latest offset before the root retires identity');

}
// Read the committed device-sized policy, including a non-preset and fractional
// MiB value; opening the settings sheet must not select a fabricated preset.
owner.storagePolicy = { capacityBytes: 777 * storageMiB + 123, expiryDays: 19 };
assert.equal(owner.limitChoices()[owner.limitIndex()] * storageMiB, owner.storagePolicy.capacityBytes);
assert.equal(owner.dayChoices()[owner.daysIndex()], 19);
owner.sheet = 'settings'; owner.sheetOpeningGeneration = 3;
owner.changeStoragePolicy(3,'expiry','3 天');
assert.deepEqual(events.at(-1),{action:'configureStorage',scope:'storage',books:[],cleanupAfterDays:3});
assert.equal(owner.sheet,'settings','immediate save keeps the storage sheet open');
assert.equal(owner.dayChoices()[owner.daysIndex()],19,'the original projected policy stays visible until readback');
const before=events.length;
owner.storagePolicyBusy=true;
owner.changeStoragePolicy(3,'expiry','14 天');
owner.storagePolicyBusy=false;
owner.changeStoragePolicy(2,'expiry','14 天');
assert.equal(events.length,before,'a pending write or retired sheet cannot dispatch another selection');
owner.storagePolicy={capacityBytes:1024*storageMiB+1,expiryDays:3};
assert.equal(new Set(owner.limitLabels()).size,owner.limitLabels().length,'a fractional current value does not alias a preset');
assert.equal(owner.limitChoices()[owner.limitIndex()]*storageMiB,owner.storagePolicy.capacityBytes);


}
if(selectedCase==='storage-actions'){
// Exercise the production cleanup button and confirmation callbacks. There
// is deliberately no RPC/filesystem port or invented successful publication.
const storageMetrics = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const surfaceGeometry = await import('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const storageProperties = createArkUIPropertyRuntimeProbe();
class DialogFrame {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, id }); params.body(); }
}
const cleanupProbe = createReaderBuilderProbe(source, [...new Set([
  'clearStorageButton', 'confirmationOverlay', 'confirmationSurfaceBody', 'confirmationContent', 'confirmationBody',
  'confirmationButton', 'confirmation', 'confirmationGeneration', 'previousConfirmation', 'storageCleanupBusy',
  'transientFeedback', ...helpers])], {
  ...storageProperties.sdk, ...projection, ...visual, ...storageMetrics, ...surfaceGeometry,
  ButtonType: { Normal: 'normal' }, ReaderDialogSurface: DialogFrame,
  ReaderWindowCoordinator: { metrics: () => ({ ...storageMetrics.createDefaultReaderWindowMetrics(),
    windowRect: { left: 0, top: 0, width: 366, height: 809 }, systemFontScale: 1 }), requestAppChrome() {} },
}, { ...storageProperties.hooks, childSources: {
  ReaderDialogSurface: readFileSync('entry/src/main/ets/ui/surfaces/ReaderDialogSurface.ets', 'utf8'),
} });
function storageOwner(summary = { ...storageFixture }) {
  const intents = [];
  const result = new cleanupProbe.Component(undefined, {});
  result.syncOverlayChrome = () => {};
  Object.assign(result, { books: [view, mixed], storageSummary: summary, appThemeScheme: 'day',
    sheet: 'settings', confirmation: '', mounted: true, appForeground: true, covered: false,
    mountedIdentity: 'storage-test', presentationIdentity: 'storage-test',
    presentationGeneration: 0, fontPreparationGeneration: 0, overlayChromeRequestGeneration: 0, overlayChromeClaimed: false,
    actionBookKeys: [], actionChapters: [], selectedChapters: new Map(),
    pageHeight: 800, dialogActionsMeasuredHeight: 44, detailKey: '', listOffset: 0,
    query: '', bookType: 'all', stateFilter: 'all', sourceFilter: 'all', sortField: 'recent', sortDirection: 'desc',
    listScroller: { currentOffset: () => ({ yOffset: 0 }) }, onTemporaryBackBridge() {}, onViewStateChanged() {},
    onIntent: value => intents.push(value) });
  result.clearStorageButton();
  return { result, intents, button: [...result.nodes.values()].find(node => node.type === 'Button') };
}
const cleanup = storageOwner(), cleanupDataBefore = structuredClone(cleanup.result.storageSummary);

assert.equal(cleanup.button.accessibilityText, '清理自动保存 · 512 MB');


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
assert.deepEqual(cleanup.intents, [], 'the closed confirmation cannot accept a different opening');
cleanup.result.confirmationOverlay();
[...cleanup.result.nodes.values()].filter(node => node.type === 'Button').at(-1).onClick();
assert.equal(cleanup.intents.length, 1);
assert.equal(cleanup.intents[0].action, 'cleanup'); assert.equal(cleanup.intents[0].scope, 'storage');
assert.deepEqual(cleanup.intents[0].books, []);
assert.equal(cleanup.intents[0].cacheLimitMb, undefined); assert.equal(cleanup.intents[0].cleanupAfterDays, undefined);
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
const busyCleanup = storageOwner(); busyCleanup.button.onClick(); busyCleanup.result.confirmationOverlay();
const busyConfirm = [...busyCleanup.result.nodes.values()].filter(node => node.type === 'Button').at(-1);
busyCleanup.result.storageCleanupBusy = true; storageProperties.flush();
assert.equal(busyCleanup.button.enabled, false);
assert.equal(busyCleanup.button.accessibilityText, '正在清理自动保存…');
assert.equal(busyConfirm.enabled, false); busyConfirm.onClick();
assert.deepEqual(busyCleanup.intents, [], 'an open confirmation cannot duplicate a pending Runtime cleanup');
const retiredCleanup = storageOwner(); retiredCleanup.button.onClick(); retiredCleanup.result.confirmationOverlay();
const retiredConfirm = [...retiredCleanup.result.nodes.values()].filter(node => node.type === 'Button').at(-1).onClick;
retiredCleanup.result.aboutToDisappear(); retiredCleanup.button.onClick(); retiredConfirm();
assert.deepEqual(retiredCleanup.intents, [], 'retired cleanup actors cannot operate another presentation');
retiredCleanup.result.mounted = true; retiredCleanup.result.confirmation = 'cleanup'; retiredConfirm();
assert.deepEqual(retiredCleanup.intents, [], 'a same-identity remount cannot reactivate the previous dialog callback');

}
if(selectedCase==='sheet-choice'){
const { choiceRowProbe } = await import('./lib/reader-choice-row-probe.mjs');
const sharedChoice = choiceRowProbe();
const { owner } = createReaderBuilderProbe(source, ['choiceRow', 'presentationIsCurrent', 'uiInputIsCurrent', 'sheetOpeningIsCurrent'], {
  ...sharedChoice.properties.sdk, ...sharedChoice.dependencies,
}, { ...sharedChoice.properties.hooks, ...sharedChoice.hooks });
Object.assign(owner, { appThemeScheme: 'day', mounted: true, appForeground: true, covered: false, presentationGeneration: 1,
  presentationIdentity: 'downloads', mountedIdentity: 'downloads', sheet: 'sort', confirmation: '', sheetOpeningGeneration: 2 });
let choices = 0;
owner.choiceRow('sort-option', '筛选内容', () => true, () => choices++);
const indicator = sharedChoice.nodes(owner).find(node => node.type === 'Radio');
const choice = sharedChoice.nodes(owner).find(node => node.accessibilityRole === 'AccessibilityRoleType.RADIO');
assert.ok(indicator && choice);
assert.equal(indicator.onChange, undefined);
assert.equal(indicator.focusable, false);
assert.equal(indicator.hitTestBehavior, 'HitTestMode.None');
assert.equal(choice.accessibilitySelected, true);
choice.onClick(); assert.equal(choices, 1);
owner.sheet = 'range'; choice.onClick(); assert.equal(choices, 1);
owner.sheet = 'sort'; owner.sheetOpeningGeneration++; choice.onClick(); assert.equal(choices, 1);
}
if(selectedCase==='overlay-lifecycle'){
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const properties = createArkUIPropertyRuntimeProbe();
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const bounded = boundedSurfaceSdk({ properties });
const metricsApi = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const frames = [], timers = [], focus = [], intents = [];
class IdleFrame {
  constructor(action) { this.action = action; }
  onIdle() { this.action(); }
}
const { owner } = createReaderBuilderProbe(source, [...new Set([...helpers, 'sheet', 'confirmation', 'reduceMotion',
  'sheetExitPending', 'sheetOpeningGeneration', 'confirmationGeneration', 'previousConfirmation', 'sheetTriggerKey', 'focusGeneration', 'managementGeneration',
  'sheetWasVisible', 'sheetMaskReady', 'pageContent', 'pageOverlays',
  'confirmationContent', 'confirmationButton', 'confirmationBody', 'sheetOverlay', 'operationsSurface',
  ...pageMembers.filter(member => ['sheetActorGeneration', 'sheetActorAttachment', 'sheetActorOwner', 'sheetActors', 'sheetSurface'].includes(member.name?.getText(pageTree))).map(member => member.name.getText(pageTree))])], {
  ...bounded.deps, ...properties.sdk, ...metricsApi, ...projection, ...visual, ...backDependencies, SharedDownloadIdleFrame: IdleFrame,
  ButtonType: { Normal: 'normal' }, HitTestMode: { None: 'none', Default: 'default' },
  motionAnimateParam: () => ({ duration: 15 }), setTimeout: action => { timers.push(action); },
  readerSurfaceElevation: () => ({}),
  TransitionEffect: { IDENTITY: { kind: 'identity' }, OPACITY: { animation: params => ({ kind: 'opacity', params }) },
    move: edge => ({ animation: params => ({ kind: 'move', edge, params }) }),
    asymmetric: (enter, exit) => ({ enter, exit }) }, TransitionEdge: { BOTTOM: 'bottom' },
}, bounded.hooks);
Object.assign(owner, {
  mounted: true, appForeground: true, covered: false,
  presentationIdentity: 'route-downloads', mountedIdentity: 'route-downloads', presentationGeneration: 1,
  books: [mixed], storageSummary: storageFixture, batchRecovery: { visible: false }, appThemeScheme: 'day', detailKey: mixed.key, managing: true,
  fontsReady: true, listScroller: {}, chapterScroller: {}, actionBookKeys: [mixed.key], actionChapters: [], selectedChapters: new Map(),
  chapterScrollRestorePending: false, onViewStateChanged() {}, onIntent: intent => intents.push(intent),
  getUIContext: () => ({ postFrameCallback: frame => frames.push(frame),
    getFocusController: () => ({ requestFocus: key => focus.push(key) }) }),
  syncOverlayChrome() {}, pageBody() {}, restoreListOffset() {},
  sheetContent() {}, sheetChromeOverflow: () => false, sheetMaxHeight: () => 300, sheetScrimColor: () => '#00000040',
  operationsHeader() {}, operationsBody() {}, operationsSurfaceWidth: () => 390, operationsBottomInset: () => 0,
});
const idle = () => { while (frames.length > 0) frames.shift().onIdle(); };
const focusName = name => 'reader-download:' + name;
const mountActors = render => {
 const before = owner.observers.length;
 render();
 const actors = [...owner.nodes.values()].filter(node => node.id >= before && node.transition !== undefined);
 for (const actor of actors) actor.onAppear?.();
 return { scrim: actors.find(actor => actor.type === 'Rect'), panel: actors.find(actor => actor.type === 'Column') };
};
const mountSheet = () => {
 const actors = mountActors(() => owner.pageOverlays());
 assert.ok(actors.scrim && actors.panel, 'actual SDK emits both scrim and panel actors');
 return actors;
};
const finish = (actor, transitionIn = false) => {
 assert.ok(Array.isArray(actor.transition) && typeof actor.transition[1] === 'function', 'actual production actor supplies its Native finish callback');
 actor.transition[1](transitionIn);
};
owner.openSheet('settings', 'storage'); idle();
const mountedActors = mountSheet();
assert.equal(focus.at(-1), focusName('sheet'));
owner.pageContent();
const background = [...owner.nodes.values()].find(node => node.type === 'Stack' && node.enabled === false);
assert.equal(background.accessibilityLevel, 'no-hide-descendants');
assert.equal(background.hitTestBehavior, 'none');
owner.openStorageCleanup(); idle();
assert.equal(focus.at(-1), focusName('confirm-cancel'));
owner.confirmationContent(true);
const old = [...owner.nodes.values()].find(node => node.idValue === focusName('confirm') || node.id === focusName('confirm'));
const buttons = () => [...owner.nodes.values()].filter(node => node.type === 'Button' && typeof node.onClick === 'function');
const oldConfirm = old?.onClick ?? buttons().at(-1).onClick;
assert.equal(owner.consumeBack(), true);
assert.equal(owner.sheet, 'settings');
idle(); assert.equal(focus.at(-1), focusName('storage-clean'));
owner.openStorageCleanup();
owner.confirmationContent(true);
oldConfirm(); assert.equal(owner.confirmation, 'cleanup'); assert.deepEqual(intents, []);
assert.equal(owner.consumeBack(), true);
const closing = owner.sheetActorAttachment;
assert.equal(owner.consumeBack(), true);
assert.equal(owner.sheetExitPending, true);
assert.equal(timers.length, 0, 'a mounted panel is never certified closed by an elapsed-time fallback');
const beforeCarrier = owner.observers.length; owner.pageOverlays();
const closingCarrier = [...owner.nodes.values()].filter(node => node.id >= beforeCarrier);
assert.ok(closingCarrier.some(node => node.type === 'Stack'), 'the actual SDK keeps an empty carrier while old Native actors exit');
assert.equal(closingCarrier.some(node => node.transition !== undefined), false, 'closing does not re-mount a replacement scrim or panel');
assert.equal(owner.consumeBack(), true);
assert.equal(owner.managing, true);
assert.equal(owner.detailKey, mixed.key);
owner.onSheetExitFinished(closing - 2, owner.presentationGeneration); assert.equal(owner.sheetExitPending, true);
const beforeScrimExitFocus = focus.length;
finish(mountedActors.scrim); idle();
assert.equal(owner.sheetExitPending, true, 'scrim completion alone cannot release an actually mounted panel');
assert.equal(owner.consumeBack(), true); assert.equal(owner.managing, true); assert.equal(owner.detailKey, mixed.key);
assert.equal(focus.length, beforeScrimExitFocus, 'incomplete panel exit cannot restore background focus');
finish(mountedActors.panel, true); assert.equal(owner.sheetExitPending, true, 'entry completion is not an exit receipt');
finish(mountedActors.panel); idle();
assert.equal(owner.sheetExitPending, false);
assert.equal(focus.at(-1), focusName('storage'));
const completedFocus = focus.length; finish(mountedActors.scrim); finish(mountedActors.panel); idle();
assert.equal(focus.length, completedFocus, 'duplicate Native exit receipts restore focus only once');
assert.equal(owner.consumeBack(), true); assert.equal(owner.managing, false);
assert.equal(owner.consumeBack(), true); assert.equal(owner.detailKey, '');
assert.equal(owner.consumeBack(), false);
owner.openSheet('book-actions', 'book-menu:' + mixed.key);
const oldOpening = owner.sheetOpeningGeneration;
owner.reduceMotion = true; assert.equal(owner.consumeBack(), true);
owner.openSheet('book-actions', 'book-menu:' + mixed.key);
owner.performOperationsAction('cancel', owner.presentationGeneration, oldOpening);
assert.equal(owner.sheet, 'book-actions');
assert.equal(owner.confirmation, '');
assert.deepEqual(intents, []);
assert.equal(owner.consumeBack(), true); idle();

owner.detailKey = mixed.key;
const originalChapter = mixed.chapters[0];
const originalMenu = owner.chapterMenuFocusKey(originalChapter);
assert.equal(originalMenu, 'chapter-menu:' + JSON.stringify([originalChapter.key, originalChapter.chapterId]));
owner.openSheet('chapter-actions', originalMenu); idle();
assert.equal(owner.consumeBack(), true); idle();
assert.equal(focus.at(-1), focusName(originalMenu), 'closing restores the exact chapter menu');

owner.openSheet('chapter-actions', originalMenu); idle();
const replacementChapter = { ...originalChapter, chapterId: 'replacement-chapter-url' };
owner.books = [{ ...mixed, chapters: [replacementChapter, ...mixed.chapters.slice(1)] }];
assert.notEqual(owner.chapterMenuFocusKey(replacementChapter), originalMenu, 'a reused chapter index gets a distinct focus ID');
const beforeReplacementClose = focus.length;
assert.equal(owner.consumeBack(), true); idle();
assert.deepEqual(focus.slice(beforeReplacementClose), [focusName('manage')], 'an obsolete chapter menu skips both chapter nodes and falls back in the current scene');
// A close before either Native actor appeared has no transition to wait for.
owner.reduceMotion = false;
owner.openSheet('sort', 'sort');
assert.deepEqual(owner.sheetActors, []);
assert.equal(owner.consumeBack(), true); idle();
assert.equal(owner.sheetExitPending, false); assert.equal(timers.length, 0);

// Operations and ordinary surfaces carry different immutable actor IDs, even
// when the same opening changes from book actions to its range surface.
owner.openSheet('book-actions', 'book-menu:' + mixed.key);
const operations = mountSheet();
assert.equal(owner.sheetActors.length, 2, 'operations registers its actual scrim and panel');
owner.sheet = 'range';
const replacementSurface = mountActors(() => owner.sheetSurface(owner.sheetOpeningGeneration, owner.sheetActorAttachment, owner.presentationGeneration));
assert.ok(replacementSurface.panel);
assert.equal(owner.sheetActors.length, 3, 'the replacement panel cannot borrow the outgoing operations actor');
finish(operations.panel); operations.panel.onAppear();
assert.equal(owner.sheetActors.length, 2, 'late appearance from an obsolete variant cannot register a new actor');
assert.equal(owner.consumeBack(), true);
finish(operations.scrim); finish(operations.panel); idle();
assert.equal(owner.sheetExitPending, true, 'an old operations receipt cannot stand in for the new ordinary surface');
finish(replacementSurface.panel, true); assert.equal(owner.sheetExitPending, true);
finish(replacementSurface.panel); idle(); assert.equal(owner.sheetExitPending, false);

// Reduced-motion closure retires a real opening immediately. Its remaining
// physical callbacks must not release a later operations opening.
owner.openSheet('sort', 'sort'); const oldActors = mountSheet();
const oldAttachment = owner.sheetActorAttachment;
owner.reduceMotion = true; assert.equal(owner.consumeBack(), true); idle();
assert.equal(owner.sheetExitPending, false);
owner.reduceMotion = false; owner.openSheet('book-actions', 'book-menu:' + mixed.key);
const nextActors = mountSheet(); assert.notEqual(owner.sheetActorAttachment, oldAttachment);
assert.equal(owner.consumeBack(), true);
finish(oldActors.scrim); finish(oldActors.panel); idle(); assert.equal(owner.sheetExitPending, true);
finish(nextActors.panel, true); assert.equal(owner.sheetExitPending, true);
finish(nextActors.panel); assert.equal(owner.sheetExitPending, true, 'operations completion still waits for its actual scrim');
finish(nextActors.scrim); idle(); assert.equal(owner.sheetExitPending, false);

// Changing motion policy during an actual exit is the explicit immediate
// path, while an ordinary mounted exit has no timeout/disappearance shortcut.
owner.openSheet('sort', 'sort'); const motionActors = mountSheet();
assert.equal(owner.consumeBack(), true); assert.equal(owner.sheetExitPending, true);
assert.ok([motionActors.scrim, motionActors.panel].every(actor => actor.onDisappear === undefined));
owner.reduceMotion = true; idle(); assert.equal(owner.sheetExitPending, false);

// Retiring a physical owner invalidates all its callbacks before a successor
// presentation on the same receiver can acquire new Native actor tickets.
owner.reduceMotion = false; owner.openSheet('sort', 'sort'); const retiredActors = mountSheet();
assert.equal(owner.consumeBack(), true); assert.equal(owner.sheetExitPending, true);
owner.presentationIdentity = 'replacement-downloads'; owner.onPresentationIdentityChanged();
owner.mountedIdentity = 'replacement-downloads';
owner.openSheet('sort', 'sort'); const successorActors = mountSheet();
assert.equal(owner.consumeBack(), true);
const beforeRetiredCallbacks = focus.length;
finish(retiredActors.scrim); finish(retiredActors.panel); idle();
assert.equal(owner.sheetExitPending, true); assert.equal(focus.length, beforeRetiredCallbacks);
finish(successorActors.scrim); assert.equal(owner.sheetExitPending, true);
finish(successorActors.panel); idle(); assert.equal(owner.sheetExitPending, false);
assert.equal(timers.length, 0); assert.deepEqual(intents, [], 'presentation completion never submits or cancels a download operation');

}
if(selectedCase==='live-theme'){
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { choiceRowProbe } = await import('./lib/reader-choice-row-probe.mjs');
const colorProbe = boundedSurfaceSdk();
const sharedChoice = choiceRowProbe(undefined, undefined, colorProbe.properties);
Object.assign(colorProbe.deps, sharedChoice.dependencies);
Object.assign(colorProbe.hooks.childSources, sharedChoice.hooks.childSources);
const colorMethods = [...new Set(['typeTab', 'statusButton', 'operationsSheet', 'actionButton', 'choiceRow', ...helpers])];
const controls = colorProbe.consumer(source, colorMethods, {
  ButtonType: { Normal: 'normal' }, TextAlign: { Start: 'start', Center: 'center' },
  HitTestMode: { None: 'none' }, AccessibilityRoleType: { RADIO: 'radio' },
  readerActionIcon: id => id,
  DOWNLOAD_VISUAL, downloadVisualColor, ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) },
});
Object.assign(controls, { appThemeScheme: 'day', bookType: 'manga', selectedBookKeys: [], selectedChapters: new Map(), managing: false,
  mounted: true, appForeground: true, covered: false, presentationGeneration: 0,
  presentationIdentity: 'download-theme-test', mountedIdentity: 'download-theme-test',
  sheet: 'book-actions', confirmation: '', sheetOpeningGeneration: 1,
  books: [mixed], actionBookKeys: [mixed.key], actionChapters: [] });
controls.typeTab('manga', '漫画');
controls.statusButton(() => mixed);
controls.operationsSheet(controls.presentationGeneration, controls.sheetOpeningGeneration);
controls.actionButton(() => '主操作', true, () => true, () => {});
controls.actionButton(() => '次操作', false, () => true, () => {});
controls.choiceRow('sort-option', '筛选内容', () => true, () => {});
for (const scheme of ['day', 'night', 'day']) {
  controls.appThemeScheme = scheme; controls.replay(); colorProbe.properties.flush();
  const actual = colorProbe.nodes(controls);
  const primary = downloadVisualColor('green', scheme);
  assert.equal(controls.tabInk('manga'), primary);
  assert.equal(controls.actionInk(false), downloadVisualColor('ink', scheme));
  assert.equal(controls.statusInk(mixed), downloadVisualColor('danger', scheme));
  assert.ok(actual.some(node => node.fontColor === primary), 'real native callback applies selected/secondary emphasis');
  assert.ok(actual.some(node => node.fontColor === downloadVisualColor('greenInk', scheme)), 'solid action keeps demo on-primary foreground');
  assert.ok(actual.some(node => node.create === '重试' && node.fontColor === downloadVisualColor('danger', scheme)), 'failure retains demo danger foreground');
  const danger = colorProbe.deps.resolveActionSheetSpec('grouped').dangerRole;
  assert.ok(actual.some(node => node.create === '删除本地内容' && node.fontColor === colorProbe.deps.readerAppColor(danger, scheme)),
    'shared sheet renders the destructive row with the live theme');
  assert.ok(actual.some(node => node.type === 'Radio' && node.radioStyle.checkedBackgroundColor === primary), 'native choice indicates the live theme');
  assert.equal(controls.statusIcon({ ...mixed, stateLabel: '下载中' }),
    `app.media.download_visual_pause${scheme === 'night' ? '_theme_night' : ''}`, 'pause uses the demo Lucide asset and a fixed theme variant');
}


}
}
if(selectedCase.startsWith('host-')){
const {createRequire}=await import('node:module');const req=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot(),ts=req(sdk+'/node_modules/typescript');
// Host probes isolate only existing bookshelf/runtime ports, retaining the
// unchanged production Host body and its generation/single-flight logic.
const hostSource = readFileSync('entry/src/main/ets/features/downloads/application/SharedDownloadHost.ts', 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '');
const hostBody = ts.transpileModule(hostSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
const novelKey=JSON.stringify(['s1','same']),comicKey=JSON.stringify(['comic-source','same']);
let loads = 0, resolveProbe, hold = false;
class ShelfPort { async loadAll() { return { books: [novel, comic] }; } }
class StatusPort { async load(book) { loads++; if (hold) await new Promise(resolve => { resolveProbe = resolve; }); return { ...book, projectionStatus: 'ready' }; } }
const clock={next:0,tasks:new Map(),set(fn){const id=++this.next;this.tasks.set(id,fn);return id;},clear(id){this.tasks.delete(id);},async flush(){const tasks=[...this.tasks.values()];this.tasks.clear();for(const fn of tasks)fn();for(let i=0;i<40;i++)await Promise.resolve();}};
class CoreReadPort{async loadShelfBook(){throw Error('unused read port');}}
const exports = {};
new Function('exports','BookshelfFlowGateway','SharedDownloadGateway','createDownloadBookView','ReaderCoreGateway','projectDownloadBookAvailability','setTimeout','clearTimeout',hostBody)(exports,ShelfPort,StatusPort,createDownloadBookView,CoreReadPort,projectDownloadBookAvailability,fn=>clock.set(fn),id=>clock.clear(id));
if(selectedCase==='host-single-flight'){
const publications = [], host = new exports.SharedDownloadHost({}, snapshot => publications.push(snapshot));
await host.reload(() => true);
assert.equal(publications.at(-1).books.length, 2);
hold = true; const before = loads;
const refreshA = host.refreshBook(publications.at(-1).books[0], () => true);
const refreshB = host.refreshBook(publications.at(-1).books[0], () => true);
assert.equal(loads - before, 1, 'same-book refreshes share one real read');
const published = publications.length; host.retire(); resolveProbe(); await Promise.all([refreshA, refreshB]);
assert.equal(publications.length, published, 'retired Host cannot overwrite the next presentation');


}
// A download status clock is independent from readingProjectionRevision. A
// second page mount reuses unchanged rows, while a background prefetch event
// invalidates only the affected book and is coalesced into one 100ms patch.
if(selectedCase==='host-index'){
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
new Function('exports','BookshelfFlowGateway','SharedDownloadGateway','createDownloadBookView','ReaderCoreGateway','projectDownloadBookAvailability','setTimeout','clearTimeout',hostBody)(indexedExports,ShelfPort,IndexedStatusPort,createDownloadBookView,CoreReadPort,projectDownloadBookAvailability,fn=>clock.set(fn),id=>clock.clear(id));
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

const unchangedBeforeProgress = progressSnapshots.at(-1).books.find(book => book.key === comicKey);
const beforeProgress = indexedLoads;
revisionOwner.downloadRevisions.set(novelKey, 1);
downloadListeners.forEach(listener => listener({ reset: false, identities: [novel, novel] }));
await clock.flush();
assert.equal(indexedLoads - beforeProgress, 1, 'duplicate background notifications refresh one changed book');
assert.equal(progressSnapshots.at(-1).books.find(book => book.key === novelKey).downloadedChapters, 1,
  'background completion publishes the refreshed chapter summary');
assert.equal(progressSnapshots.at(-1).books.find(book => book.key === comicKey), unchangedBeforeProgress,
  'unchanged row remains the same object');
progressHost.retire();



}

if(selectedCase==='host-intents'){
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
  new Function('exports','BookshelfFlowGateway','SharedDownloadGateway','createDownloadBookView','ReaderCoreGateway','projectDownloadBookAvailability','setTimeout','clearTimeout',hostBody)(
    intentExports,ShelfPort,IntentStatusPort,createDownloadBookView,CoreReadPort,projectDownloadBookAvailability,fn=>clock.set(fn),id=>clock.clear(id));
  const snapshots = [], intentHost = new intentExports.SharedDownloadHost({ getDownloadCoordinator: () => coordinator },
    snapshot => snapshots.push(snapshot));
  await intentHost.reload(() => true);
  const beforeIntentLoads = intentLoads, unchanged = snapshots.at(-1).books.find(book => book.key === comicKey);
  jobs[0] = { ...jobs[0], revision: 2, updatedAt: 2 };
  subscriber({ books: [novel, comic], jobs }); subscriber({ books: [novel, comic], jobs });
  await clock.flush();
  assert.equal(intentLoads - beforeIntentLoads, 1);
  assert.equal(snapshots.at(-1).books.find(book => book.key === comicKey), unchanged);
  intentHost.retire(); assert.equal(subscriber, undefined, 'retiring a page releases its observer, not the Runtime accepted job');
}
{
  const { bookshelfOperationClass } = await import('./lib/bookshelf-operation-owner-probe.mjs');
  const { errorMessageOf } = await import('../entry/src/main/ets/app/ErrorMessage.ts');
  const RefreshError = bookshelfOperationClass('features/downloads/application/SharedDownloadCoordinator.ts', 'SharedDownloadProjectionRefreshError');
  const { Host, withoutDownloadStorageSummary } = bookshelfOperationClass('features/downloads/application/SharedDownloadHost.ts',
    '({Host: SharedDownloadHost, withoutDownloadStorageSummary})',
    { SharedDownloadGateway: StatusPort, ReaderCoreGateway: CoreReadPort, SharedDownloadProjectionRefreshError: RefreshError });
  let storageReloads = 0, storageRechecks = 0;
  class StorageHost extends Host {
    resume(snapshot) { this.snapshot = snapshot; this.publish(snapshot); }
    async reload(current) { if (current()) storageReloads++; }
    async refreshStorageSummary(current) { if (current()) storageRechecks++; }
  }
  const Presentation = bookshelfOperationClass('features/downloads/presentation/SharedDownloadPresentation.ets', 'SharedDownloadPresentation',
    { Observed: value => value, SharedDownloadHost: StorageHost, withoutDownloadStorageSummary, ...projection, errorMessageOf,
      hilog: { warn() {} } });
  const extra = shelf('source-three', 'third');
  const bookRows = [novel, comic, extra].map(book => ({ ...createDownloadBookView(book), projectionStatus: 'ready',
    chapters: [{ index: 0, chapterId: 'current', navigable: true }] }));
  async function submit(action, { rows = bookRows, books = bookRows, stop, scope = 'books' } = {}) {
    let current = true, reads = 0;
    const calls = [], feedback = [], snapshot = { books: rows, loading: false, error: '', storageSummary: {} };
    const runtime = { getDownloadCoordinator: () => ({ async operate(operation, target) {
      calls.push([operation, target.book.sourceId]);
      if (stop === 'unknown' && calls.length === 2) throw Error('lost acknowledgement');
      if (stop === 'readback') throw new RefreshError('pause', Error('read failed'));
      if (stop === 'retired') current = false;
      return operation === 'download' ? { accepted: true } : undefined;
    } }) };
    const host = new Host(runtime, () => {});
    host.snapshot = snapshot;
    host.reload = async () => { reads++; };
    const presentation = Object.assign(new Presentation(), {
      opening: { owner: runtime, identity: 'download-batch', isRouteCurrent: () => current }, host, snapshot,
    });
    await presentation.applyIntent('download-batch', { action, scope, books }, message => feedback.push(message));
    return { calls, feedback, get reads() { return reads; }, presentation };
  }
  const unavailable = await submit('download', { rows: [bookRows[0], { ...bookRows[1], projectionStatus: 'unavailable' }, bookRows[2]] });
  assert.deepEqual(unavailable.calls, [['download', 's1'], ['download', 'source-three']]);
  assert.match(unavailable.feedback[0], /已确认 2 本.*目标不可用 1 本/);
  assert.equal(unavailable.reads, 1);
  const missing = await submit('deleteLocal', { rows: bookRows.slice(0, 2) });
  assert.deepEqual(missing.calls, [], 'a book missing before admission cannot shrink the original intent');
  assert.match(missing.feedback[0], /目标不可用 1 本.*2 本未处理/);
  const unknown = await submit('cancel', { stop: 'unknown' });
  assert.deepEqual(unknown.calls, [['cancel', 's1'], ['cancel', 'comic-source']]);
  assert.deepEqual(unknown.feedback, []);
  const pending = unknown.presentation.batchRecovery;
  assert.match(pending.message, /已确认 1 本.*1 本结果未确认.*1 本未处理/);
  assert.equal(unknown.reads, 1, 'accepted prefix is read back without replaying mutations');
  await unknown.presentation.applyIntent('download-batch', { action: 'cancel', scope: 'books', books: [bookRows[1]] }, assert.fail);
  unknown.presentation.refreshBatchRecovery('download-batch', pending.generation);
  assert.equal(unknown.reads, 2);
  assert.equal(unknown.presentation.batchRecovery, pending, 'a list read cannot settle the original result');
  assert.equal(unknown.calls.length, 2, 'an overlapping cancel cannot dispatch twice');
  const readback = await submit('pause', { stop: 'readback' });
  assert.deepEqual(readback.calls, [['pause', 's1']]);
  assert.match(readback.feedback[0], /已确认 1 本.*2 本未处理.*已保存的状态未能读回/);
  const oldChapter = { ...bookRows[0], chapterIndices: [0], expectedChapters: [{ chapterIndex: 0, chapterId: 'replaced' }] };
  const scoped = await submit('deleteLocal', { books: [oldChapter], scope: 'chapters' });
  assert.deepEqual(scoped.calls, []);
  assert.match(scoped.feedback[0], /目录已变化，章节操作未执行/);
  const retired = await submit('download', { stop: 'retired' });
  assert.deepEqual(retired.calls, [['download', 's1']]);
  assert.deepEqual(retired.feedback, []);
  assert.equal(retired.reads, 0);
  const single = await submit('pause', { books: [bookRows[0]] });
  assert.deepEqual(single.feedback, ['下载已暂停']);

  let completeCleanup, cleanupCalls = 0;
  const cleanupOwner = { clearDownloadRebuildableCache() {
    cleanupCalls++;
    return new Promise(resolve => { completeCleanup = resolve; });
  } };
  const cleanupIntent = { action: 'cleanup', scope: 'storage', books: [] };
  const page = new Presentation(), messages = [];
  const retainedSnapshot = { books: bookRows, loading: false, error: '', storageSummary: storageFixture };
  Object.assign(page, { retainedOwner: cleanupOwner, retainedSnapshot });
  page.open(cleanupOwner, 'before-cleanup', () => true, { kind: 'resume' }, undefined, value => messages.push(value));
  const work = page.applyIntent('before-cleanup', cleanupIntent, value => messages.push(value));
  const captured = page.captureReturn(cleanupOwner);
  page.retire(); page.restoreReturn(cleanupOwner, captured);
  page.open(cleanupOwner, 'while-cleaning', () => true, { kind: 'resume' }, undefined, value => messages.push(value));
  assert.equal(page.storageCleanupBusy, true);
  await page.applyIntent('while-cleaning', cleanupIntent, value => messages.push(value));
  assert.equal(cleanupCalls, 1);
  completeCleanup({ removedContentBytes: 1, deletedBytes: 0, deletedFiles: 0 }); await work;
  assert.equal(page.storageCleanupBusy, false);
  assert.deepEqual(page.snapshot.storageSummary, {}, 'old storage estimate is retired before the next read');
  assert.equal(storageReloads, 1, 'only the current same-runtime Host is refreshed');
  assert.deepEqual(messages, [], 'the retired opening cannot deliver its completion toast');
  await page.applyIntent('while-cleaning', cleanupIntent, value => messages.push(value));
  assert.equal(cleanupCalls, 1, 'a stale UI intent cannot act on the invalidated estimate');
  page.retire(); page.restoreReturn(cleanupOwner, captured);
  page.open(cleanupOwner, 'after-cleanup', () => true, { kind: 'resume' }, undefined, value => messages.push(value));
  assert.deepEqual(page.snapshot.storageSummary, {}, 'reader return cannot restore the pre-cleanup estimate');
  assert.equal(storageRechecks, 1, 'retained return starts a read-only refresh of missing storage facts');
}
}
}

}

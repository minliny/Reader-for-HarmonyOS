import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { projectReaderDirectoryEntries } from '../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts';
import { snapshotReaderDirectoryData, sameReaderDirectoryData } from '../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts';
import { SurfaceWidthSpec, resolveHorizontalFrame } from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight, readerInteractiveSafeBottom } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const path = fileURLToPath(new URL('../entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets', import.meta.url));
const source = readFileSync(path, 'utf8');
const pending = [];
const programmaticScrolls = [];
const completedScrolls = [];
const Edge = { Top: 'top', Bottom: 'bottom' };
let metrics = { windowRect: { width: 390 }, systemInsets: { left: 0, right: 0, top: 48, bottom: 34 },
  cutoutInsets: {}, gestureInsets: {}, navigationInsets: {}, keyboardInsets: {} };
const deps = { projectReaderDirectoryEntries, snapshotReaderDirectoryData, sameReaderDirectoryData,
  SurfaceWidthSpec, resolveHorizontalFrame, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  readerInteractiveSafeBottom, ReaderWindowCoordinator: { metrics: () => metrics },
  TOK_CONTENT_MAX_W_TABLET: 720, registerReaderFonts() {}, Edge,
  ReaderRuntimeOwner: { current: () => ({ supportsCoreCapability: () => false }) },
  readerDirectoryScopeKey: (_source, book) => book,
  readerDirectorySignalScrollIntent: bookId => programmaticScrolls.push(bookId),
  readerDirectorySignalScrollCommand: bookId => completedScrolls.push(bookId),
  setTimeout: action => { pending.push(action); } };
const methods = ['aboutToAppear', 'aboutToDisappear', 'identity', 'rowIsCurrent', 'onIdentityChanged',
  'supportsDirectoryRules', 'onRulesKindChanged',
  'onEntriesChanged', 'admitEntries', 'applySearch', 'toggleSort', 'scheduleTopScroll', 'scrollToEdge',
  'emptyMessage', 'contentFrame', 'bottomInset', 'publishProjection', 'onListFirstLayout', 'onListUserScroll', 'flushPendingScroll'];
const Page = productionMotionMethods(path, methods, deps);
const entries = Array.from({ length: 3000 }, (_, i) => ({ index: i * 2 + 1, title: `Chapter ${i + 1}`,
  navigable: i !== 2, downloadState: 'missing', bookmarks: [] }));
function fixture() {
  const edges = [], selected = [], downloaded = [], deleted = [], created = [];
  const page = Object.assign(new Page(), { sourceId: 'source-a', bookId: 'book', bookKind: '', entries,
    catalogMessage: '', searchDraft: '', searchQuery: '', ascending: true, projectedEntries: [],
    admittedEntries: [], admittedIdentity: '', mounted: false, projectionGeneration: 0,
    scrollGeneration: 0, listReady: false, pendingScrollEdge: undefined, viewportWidth: 390, readerWindowMetricsRevision: 1, appThemeScheme: 'day',
    listScroller: { scrollEdge: edge => edges.push(edge) }, getUIContext: () => ({ getFont() {} }),
    onSelectChapter: index => selected.push(index), onDownloadChapter: index => downloaded.push(index),
    onDeleteBookmarks: times => deleted.push(times), onCreateChapterStartBookmark: request => created.push(request),
    onBack() {}, chapterStartBookmarkCreationEnabled: true });
  return { page, edges, selected, downloaded, deleted, created };
}
function flush() { while (pending.length) pending.shift()(); }
{
  const { page, edges } = fixture(); page.aboutToAppear(); flush(); page.onListFirstLayout(page.identity());
  assert.equal(page.projectedEntries.length, 3000, 'complete catalog is not the 20-row detail preview');
  assert.equal(page.projectedEntries[2].navigable, false);
  page.searchDraft = ' chapter 30 '; page.applySearch(); flush();
  assert.equal(page.projectedEntries[0].index, 59, 'filter keeps original Core index, not result ordinal');
  const ascending = page.projectedEntries.map(entry => entry.index);
  page.toggleSort(); flush(); assert.deepEqual(page.projectedEntries.map(entry => entry.index), ascending.toReversed());
  page.scrollToEdge(Edge.Bottom); assert.equal(edges.at(-1), Edge.Bottom);
  page.searchDraft = 'not present'; page.applySearch(); assert.equal(page.emptyMessage(), '没有匹配的章节');
  page.searchDraft = ''; page.applySearch(); assert.equal(page.projectedEntries.length, 3000);
  assert.equal(page.entries, entries); assert.equal(entries[0].index, 1, 'sort does not mutate host catalog');
  page.aboutToDisappear(); const count = edges.length; flush(); assert.equal(edges.length, count, 'late scroll is cancelled on exit');
}
{
  const { page } = fixture(); page.aboutToAppear(); flush(); page.onListFirstLayout(page.identity());
  const old = page.projectedEntries[0]; assert.equal(page.rowIsCurrent(old, 'source-a\u0000book'), true);
  page.sourceId = 'source-b'; page.onIdentityChanged(); assert.equal(page.rowIsCurrent(old, 'source-a\u0000book'), false);
  page.entries = [{ index: 1, title: 'Other source', navigable: true, downloadState: 'missing', bookmarks: [] }];
  page.onEntriesChanged(); flush();
  assert.equal(page.searchQuery, ''); assert.equal(page.ascending, true);
  assert.equal(page.rowIsCurrent(old, 'source-a\u0000book'), false, 'old source row cannot target equal chapter index in the new source');
  assert.equal(page.rowIsCurrent(page.projectedEntries[0], 'source-b\u0000book'), true);
  page.entries[0].navigable = false;
  assert.equal(page.rowIsCurrent(page.projectedEntries[0], 'source-b\u0000book'), false, 'in-place host changes block stale actions before projection flush');
  page.onEntriesChanged(); page.aboutToDisappear(); flush();
  assert.equal(page.mounted, false);
}
{
  const { page } = fixture(); page.entries = []; page.catalogMessage = '目录读取失败，请返回详情重试';
  page.aboutToAppear(); assert.equal(page.emptyMessage(), page.catalogMessage);
  page.catalogMessage = ''; assert.equal(page.emptyMessage(), '暂无章节信息');
  assert.equal(page.contentFrame().width, 350); assert.equal(page.contentFrame().left, 20); assert.equal(page.bottomInset(), 34);
  page.viewportWidth = 1000; assert.equal(page.contentFrame().width, 720); assert.equal(page.contentFrame().left, 140);
  page.viewportWidth = 500; metrics = { ...metrics, cutoutInsets: { left: 50 }, gestureInsets: { right: 32 } };
  const frame = page.contentFrame(); assert.equal(frame.left, 50); assert.equal(frame.right, 32); assert.equal(frame.width, 418);
  assert.doesNotMatch(source, /expandSafeArea|readerVisualSafeTop|readerContentSafeTop/, 'Index owns the only top safe inset');
}

{
  const { page, edges } = fixture(); page.aboutToAppear(); flush();
  assert.deepEqual(edges, [], 'timer does not prove the native List is bound');
  page.onListFirstLayout(page.identity()); assert.deepEqual(edges, [Edge.Top]);
  page.searchDraft = 'no match'; page.applySearch(); flush();
  page.searchDraft = ''; page.applySearch(); flush();
  assert.equal(edges.length, 2, 'empty-to-populated keeps the native List ready without another first layout');
  page.searchDraft = 'no match'; page.applySearch();
  page.searchDraft = ''; page.applySearch(); flush();
  assert.equal(edges.length, 3, 'coalesced empty-to-populated changes still settle the latest scroll intent');
  page.toggleSort(); page.onListUserScroll(); flush(); assert.equal(edges.length, 3, 'user scroll cancels pending sort positioning');
  page.aboutToDisappear();
}
{
  const { page } = fixture();
  page.sourceId = 'local';
  page.aboutToAppear(); flush();
  page.searchDraft = 'group only'; page.applySearch();
  page.toggleSort();
  assert.equal(page.navigationInteracted, false,
    'search and sort before initial Core tree answer keep the current generation eligible for tree adoption');
  page.onListUserScroll();
  assert.equal(page.navigationInteracted, true, 'real user scrolling still prevents a late tree insertion');
  const completedBeforeDeferred = completedScrolls.length;
  page.scrollToEdge(Edge.Top);
  assert.equal(programmaticScrolls.at(-1), 'book', 'detail toolbar Top fences an in-flight tree view');
  assert.equal(completedScrolls.length, completedBeforeDeferred, 'a deferred edge command cannot claim that scrolling already ran');
  page.navigationActive = true;
  page.onListFirstLayout(page.identity());
  assert.equal(completedScrolls.at(-1), 'book', 'detail toolbar completes after the actual edge command');
  page.aboutToDisappear();
}

// Exercise the SDK-emitted Builder callbacks, not an independently rewritten UI.
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
for (const [name, props] of Object.entries({ ReaderDirectoryRules: ['bookId'], PageBackBar: [], ReaderDirectoryToolbar: ['text', 'placeholder', 'ascending', 'showChapterTools'],
  ReaderDirectoryList: ['entries', 'rowHeight', 'listPaddingX', 'listPaddingY', 'edgeEffectMode'],
  ReaderDirectoryNavigationSurface: ['sourceId', 'bookId', 'query', 'ascending', 'currentChapterIndex', 'openRevision',
    'interacted', 'rowHeight', 'listPaddingX', 'listPaddingY', 'edgeEffectMode', 'scroller'],
  ReaderDirectoryChapterRow: ['entry', 'rowHeight', 'currentChapterIndex', 'chapterDownloadEnabled', 'chapterStartBookmarkCreationEnabled'] })) {
  syntax.componentCollection.customComponents.add(name); syntax.propCollection.set(name, new Set(props));
}
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
{
  const result = fixture(); result.page.aboutToAppear(); flush(); result.page.onListFirstLayout(result.page.identity());
  const { owner, output } = createReaderBuilderProbe(source, ['build', 'flatList', 'chapterRow'], {
    ...deps, ReaderDirectoryRules: Child, PageBackBar: Child, ReaderDirectoryToolbar: Child, ReaderDirectoryList: Child,
    ReaderDirectoryNavigationSurface: Child, ReaderDirectoryChapterRow: Child });
  Object.assign(owner, result.page);
  for (const name of methods) owner[name] = Page.prototype[name].bind(owner);
  owner.initialRender();
  const children = [...owner.children.values()];
  const bar = children.find(child => child.params.title === '目录'); assert.ok(bar);
  const toolbar = children.find(child => child.params.showChapterTools); assert.ok(toolbar);
  const tree = children.find(child => child.params.chapterEntries);
  assert.equal(tree.params.sourceId, result.page.sourceId);
  assert.equal(tree.params.chapterDownloadEnabled, true, 'remote tree retains the existing single chapter download action');
  const previousDownload = owner.onDownloadChapter;
  let treeDownload;
  owner.onDownloadChapter = index => { treeDownload = index; };
  tree.params.onDownloadChapter(7);
  assert.equal(treeDownload, 7, 'detail tree callback preserves the canonical chapter index');
  owner.onDownloadChapter = previousDownload;
  tree.params.fallbackBuilder();
  const list = [...owner.children.values()].find(child => child.params.entries); assert.equal(list.params.entries.length, 3000);
  assert.equal(list.params.rowHeight, 40); assert.equal(list.params.listPaddingX, 10);
  const item = structuredClone(owner.projectedEntries[0]); list.params.rowBuilder({ item, index: 0 });
  const row = [...owner.children.values()].find(child => child.params.entry === item); assert.ok(row);
  assert.equal(row.params.currentChapterIndex, undefined, 'standalone catalog never marks a current reading chapter');
  row.params.onSelectChapter(1); row.params.onDownloadChapter(1); row.params.onDeleteBookmarks([10]);
  row.params.onCreateChapterStartBookmark({ chapterIndex: 1, chapterTitle: item.title });
  assert.deepEqual(result.selected, [1]); assert.deepEqual(result.downloaded, [1]); assert.deepEqual(result.deleted, [[10]]); assert.equal(result.created.length, 1);
  const nativeList = list;
  toolbar.params.onTextChange('no match'); toolbar.params.onSearch();
  owner.replayOnly([list.id]); assert.equal(list.params.entries.length, 0);
  toolbar.params.onTextChange(''); toolbar.params.onSearch();
  owner.replayOnly([list.id]); assert.equal(owner.children.get(list.id), nativeList); assert.equal(list.params.entries.length, 3000);
  toolbar.params.onTextChange('no match'); toolbar.params.onSearch();
  toolbar.params.onTextChange(''); toolbar.params.onSearch();
  owner.replayOnly([list.id]); assert.equal(owner.children.get(list.id), nativeList, 'coalesced empty/full projection retains List native identity');
  toolbar.params.onTextChange('Chapter 3000'); toolbar.params.onSearch(); assert.equal(owner.projectedEntries[0].index, 5999);
  row.params.onSelectChapter(1); assert.deepEqual(result.selected, [1], 'filtered-out row callback is no longer admitted');
  toolbar.params.onTextChange(''); toolbar.params.onSearch(); row.params.onSelectChapter(1);
  assert.deepEqual(result.selected, [1, 1], 'a retained cloned row works again after clearing the filter');
  owner.sourceId = 'source-b'; owner.onIdentityChanged(); flush();
  row.params.onSelectChapter(1); assert.deepEqual(result.selected, [1, 1], 'retained old book closure cannot target equal index/content in another source');
  tree.params.onDownloadChapter(7);
  assert.deepEqual(result.downloaded, [1], 'retained old directory callback cannot download the same index in another source');
  toolbar.params.onToggleSort(); assert.equal(owner.ascending, false);
  owner.onListFirstLayout(owner.identity()); toolbar.params.onTop(); toolbar.params.onBottom(); assert.equal(result.edges.at(-1), Edge.Bottom);
  owner.aboutToDisappear(); toolbar.params.onTop(); row.params.onDownloadChapter(1);
  assert.deepEqual(result.downloaded, [1]);
  assert.doesNotMatch(output, /ReaderFullDirectory|FullDirectoryPanel|ReaderShell|ReadingExperience/);
  assert.doesNotMatch(source, /Text\('(?:书签|当前章节|收起)'\)/);
}
console.log('PH119 standalone BookDirectoryPage actual methods and SDK Builder: PASS');

// Render the actual page branch with persisted Core format metadata. Filename
// and title are deliberately misleading: they are not format evidence.
for (const [sourceId, bookKind, capability, expected] of [
  ['local', 'EPUB', true, false], ['local', 'MOBI', true, false], ['local', 'KF8', true, false],
  ['local', 'AZW3', true, false], ['local', 'PDF', true, false], ['local', '', true, false],
  ['local', 'novel.txt', true, false], ['remote', 'TXT', true, false], ['local', 'TXT', false, false],
  ['local', 'TXT', true, true], ['local', 'txt', true, true], ['local', 'local', true, true],
]) {
  const result = fixture();
  Object.assign(result.page, { sourceId, bookKind, bookId: 'misleading.txt', rulesExpanded: true, rulesRevision: 0 });
  result.page.aboutToAppear(); flush();
  const { owner } = createReaderBuilderProbe(source, ['build', 'flatList', 'chapterRow'], {
    ...deps, ReaderRuntimeOwner: { current: () => ({ supportsCoreCapability: () => capability }) },
    ReaderDirectoryRules: Child, PageBackBar: Child, ReaderDirectoryToolbar: Child, ReaderDirectoryList: Child,
    ReaderDirectoryNavigationSurface: Child, ReaderDirectoryChapterRow: Child });
  Object.assign(owner, result.page);
  for (const name of methods) owner[name] = Page.prototype[name].bind(owner);
  owner.initialRender();
  assert.equal([...owner.nodes.values()].some(node => node.createWithLabel === '收起层级规则'), expected,
    `directory rule control eligibility: ${sourceId}/${bookKind}/${capability}`);
  assert.equal([...owner.children.values()].some(child => typeof child.params.onApplied === 'function'), expected,
    'unsupported metadata must not mount a rules editor or issue its initial request');
}

{
  const { page } = fixture(); Object.assign(page, { sourceId: 'local', bookKind: 'TXT', rulesExpanded: true, rulesRevision: 3 });
  page.aboutToAppear(); flush();
  assert.equal(page.supportsDirectoryRules(), true);
  page.bookId = 'another-txt'; page.onIdentityChanged();
  assert.equal(page.rulesExpanded, false, 'switching TXT identities closes the previous book editor immediately');
  assert.equal(page.rulesRevision, 0, 'the new book does not inherit an applied-rule revision');
  page.rulesExpanded = true; page.bookKind = 'EPUB'; page.onRulesKindChanged();
  assert.equal(page.rulesExpanded, false); assert.equal(page.supportsDirectoryRules(), false);
  page.bookKind = 'local'; page.onRulesKindChanged();
  assert.equal(page.rulesExpanded, false, 'returning to a TXT format cannot reopen an old draft');
  assert.equal(page.supportsDirectoryRules(), true);
  page.rulesExpanded = true; page.sourceId = 'remote'; page.onIdentityChanged();
  assert.equal(page.rulesExpanded, false); assert.equal(page.supportsDirectoryRules(), false);
  page.aboutToDisappear(); flush();
}
console.log('PASS actual directory rules entry: Core TXT metadata, parent updates and identity/format revocation');

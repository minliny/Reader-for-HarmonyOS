import { mangaGridProbeDependencies, mangaGridBuilderMembers } from './lib/manga-directory-grid-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import * as fonts from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import * as layout from '../entry/src/main/ets/features/manga/MangaDirectoryLayout.ts';
import { readerDirectoryScopeKey } from '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';

const path = new URL('../entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets', import.meta.url);
const source = readFileSync(path, 'utf8');
class LRUCache {
  constructor(limit) { this.limit = limit; this.data = new Map(); }
  get(key) { const value = this.data.get(key); if (value !== undefined) { this.data.delete(key); this.data.set(key, value); } return value; }
  put(key, value) { this.data.delete(key); this.data.set(key, value); while (this.data.size > this.limit) this.data.delete(this.data.keys().next().value); }
  keys() { return [...this.data.keys()]; }
}
const header = source.slice(0, source.indexOf('/** Virtual, Core-paged'))
  .replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, '');
const production = new Function('util', 'readerDirectoryScopeKey', ...Object.keys(layout),
  `${stripTypeScriptTypes(header)}; return { ReaderDirectoryNavigationDataSource, directoryPages, cacheReaderDirectoryNavigationPage };`)
  ({ LRUCache }, readerDirectoryScopeKey, ...Object.values(layout));
const node = (index, title = String(index), extra = {}) => ({ nodeId: `n${index}`, title, kind: 'target', depth: 2,
  chapterIndex: 5000 + index, chapterOffsetScalar: 0, parentId: 'volume', parentTitle: '第一卷', hasChildren: false, expanded: false, ...extra });
const nodes = Array.from({ length: 600 }, (_, index) => node(index));
nodes[250] = node(250, '21上'); nodes[251] = node(251, '21中'); nodes[252] = node(252, '21下');
nodes[253] = node(253, '22上'); nodes[254] = node(254, '22下');
nodes[249] = node(249, '前一卷', { kind: 'group', chapterIndex: undefined, hasChildren: true });
const requests = [], changes = [];
const data = new production.ReaderDirectoryNavigationDataSource(offset => requests.push(offset));
data.registerDataChangeListener({ onDataReloaded: () => changes.push('reload'), onDataChanged: index => changes.push(index) });
const view = { status: 'ready', identity: { sourceId: 'manga', bookId: 'book' }, viewId: 'v1', navigationRevision: 'r1',
  visibleTotal: nodes.length, currentVisibleIndex: 252, nodes: nodes.slice(0, 256) };
data.replace(view);
assert.deepEqual(requests, [], 'Quick publishes the full count without fetching far pages');
assert.equal(data.totalCount(), 600, 'compact Quick exposes the same Core visible total as Full');
for (const index of [0, 250, 251, 252]) {
  const item = data.getData(index);
  assert.equal(item.index, index);
  assert.equal(item.node.chapterIndex, 5000 + index, 'canonical chapter identity never becomes a Grid ordinal');
  assert.equal(data.displayIndex(index), index);
}
assert.equal(data.getData(249).node.kind, 'group', 'Core group retains its authoritative visible slot');
assert.equal(data.getData(256).node, undefined); assert.equal(data.getData(599).node, undefined);
assert.deepEqual(requests, [256, 512], 'only explicitly requested visible slots load their bounded pages');
data.admit(256, { viewId: 'v1', visibleTotal: 600, nodes: nodes.slice(256, 512) });
data.admit(512, { viewId: 'v1', visibleTotal: 600, nodes: nodes.slice(512) });
assert.equal(data.totalCount(), 600); assert.equal(data.getData(599).node.chapterIndex, 5599);
assert.equal(data.displayIndex(20), 20, 'far browsing remains available inside Quick');
assert.equal(data.displayIndex(-1), undefined); assert.equal(data.displayIndex(600), undefined);
data.replace({ ...view, viewId: 'search', visibleTotal: 2, currentVisibleIndex: 1,
  nodes: [node(253, '22上'), node(254, '22下')] });
assert.equal(data.totalCount(), 2, 'search uses the complete Core search projection');
assert.equal(data.getData(1).node.chapterIndex, 5254);
data.admit(0, { viewId: 'v1', visibleTotal: 600, nodes: [node(0, 'stale')] });
assert.equal(data.getData(0).node.title, '22上', 'late pages cannot replace a different immutable view');
{
  const nested = new production.ReaderDirectoryNavigationDataSource(() => assert.fail('loaded hierarchy cannot fetch ancestors'));
  const catalog = [node(0, '第一卷', { kind: 'group', depth: 1, parentId: undefined, chapterIndex: undefined }),
    node(1, '同名子组', { kind: 'group', depth: 2, parentId: 'n0', chapterIndex: undefined }),
    node(2, '01', { depth: 3, parentId: 'n1', parentTitle: '同名子组' }),
    node(3, '第二卷', { kind: 'group', depth: 1, parentId: undefined, chapterIndex: undefined }),
    node(4, '同名子组', { kind: 'group', depth: 2, parentId: 'n3', chapterIndex: undefined }),
    node(5, '01', { depth: 3, parentId: 'n4', parentTitle: '同名子组' }),
    node(6, '02', { depth: 3, parentId: 'uncaptured', parentTitle: '未捕获父组' })];
  nested.replace({ ...view, viewId: 'nested', visibleTotal: catalog.length, currentVisibleIndex: 2, nodes: catalog });
  assert.equal(nested.totalCount(), catalog.length);
  assert.equal(nested.getData(2).node.parentId, 'n1'); assert.equal(nested.getData(5).node.parentId, 'n4');
  assert.ok(Array.from({ length: nested.totalCount() }, (_, index) => nested.getData(index)).every(item =>
    item.index === nested.displayIndex(item.index) && item.node !== undefined), 'all nested slots remain actual Core nodes, never synthetic contexts');
}

const compact = [node(0, '01'), node(1, '02'), node(2, '3上'), node(3, '3下'),
  node(4, '可读整卷', { hasChildren: true }), node(5, '不可读', { kind: 'disabled', chapterIndex: undefined }),
  node(6, '命名章节'), node(7, '下一分组', { kind: 'group', chapterIndex: undefined, hasChildren: true })];
const gridData = new production.ReaderDirectoryNavigationDataSource(() => assert.fail('loaded Grid must not fetch a catalog'));
const gridView = { ...view, viewId: 'grid', visibleTotal: compact.length, currentVisibleIndex: 1, nodes: compact };
gridData.replace(gridView);
const names = [...mangaGridBuilderMembers, 'build', 'row', 'mangaRow', 'mangaNumberCell', 'mangaGridLayoutOptions', 'mangaGridNarrow',
  'mangaCellPlacement', 'mangaCellOrdinal', 'mangaCellWidth', 'mangaCellTop', 'mangaCellBottom',
  'selectMangaRow', 'toggleMangaRow', 'mangaColor', 'displayLevel', 'mangaGroupNode', 'mangaGroupSpacing',
  'mangaRowIndex', 'mangaRowPaddingLeft', 'isCurrentMangaNode', 'isCurrentNode', 'rowKey',
  'captureViewportAnchor', 'positionInitialCurrent', 'positionRowHeight', 'planPosition'];
names.push('mangaCatalogNarrow', 'canDownloadTarget', 'downloadTarget', 'mangaViewportWidth', 'mangaInitialViewportWidth');
const sdkGrid = [];
const Grid = new Proxy({ name: 'Grid' }, { get(target, key) {
  if (key === 'name') return target.name;
  return (...args) => { if (key === 'create') sdkGrid.push({ args }); else if (key !== 'pop') sdkGrid.at(-1)[key] = args[0]; };
} });
const LazyForEach = new Proxy({}, { get: () => () => {} });
function probe(scheme = 'day', quick = false, width = 390, fontScale = 1, candidate = source, captureNative = false) {
  const actions = [], scrolls = [], anchors = [];
  const properties = createArkUIPropertyRuntimeProbe();
  const result = createReaderBuilderProbe(candidate, names, { ...mangaGridProbeDependencies, ...properties.sdk,
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: fontScale }) }, ...fonts, ...layout, ...(captureNative ? {} : { Grid }), LazyForEach,
    ScrollAlign: { START: 'start', CENTER: 'center' }, LengthMetrics: { vp: value => ({ value }) },
    readerDirectoryScopeKey, readerDirectoryViewportAnchor: () => undefined,
    readerDirectorySaveViewportAnchor: anchor => anchors.push(anchor) }, properties.hooks);
  Object.assign(result.owner, { dataSource: gridData, view: gridView, mangaDisplay: true, mangaQuickDisplay: quick,
    mangaSearchActive: false, mangaCatalogDisplay: false, mangaCatalogNarrow: undefined, mangaPresentationRevision: 0,
    windowMetricsRevision: 0, mangaViewportWidth: width, mangaInitialViewportWidth: 0, mangaGridSpans: new Map(), mangaScheme: scheme, appThemeScheme: 'day',
    currentChapterIndex: 5001, rowHeight: 40, mangaRowMinHeight: 58, interactionEnabled: true,
    listPaddingX: 10, listPaddingRight: -1, listPaddingY: 5, listPaddingTop: -1, listPaddingBottom: -1,
    contentStartInset: 0, contentEndInset: 0, mangaVisibleTopInset: 0,
    edgeEffectMode: 'none', chapterByIndex: new Map(), chapterDownloadEnabled: false,
    bookId: 'book', sourceId: 'manga', onFirstLayout() {}, onScrollSettled() {}, onUserScrollIntent() {}, onScrollOffset() {},
    onToggleNode: value => actions.push(['fold', value.nodeId]), captureViewportAnchor() {},
    toggleNode: value => actions.push(['fold', value.nodeId]), selectTarget: value => actions.push(['read', value.chapterIndex]),
    scroller: { scrollToIndex: (...args) => scrolls.push(args), getItemRect: () => ({ y: -22, height: 44 }) } });
  return { ...result, actions, scrolls, anchors };
}
{
  const enlarged = [node(0, '123456'), node(1, '123457'), node(2, '123458')];
  const localView = { ...gridView, viewId: 'enlarged', visibleTotal: enlarged.length, nodes: enlarged };
  const local = new production.ReaderDirectoryNavigationDataSource(() => assert.fail('responsive layout must use loaded Core nodes'));
  local.replace(localView);
  const { owner } = probe('day', false, 390, 2);
  const offsets = [];
  Object.assign(owner, { dataSource: local, view: localView, onScrollOffset: value => offsets.push(value),
    scroller: { currentOffset: () => ({ xOffset: 0, yOffset: 137 }) } });
  const spans = owner.mangaGridLayoutOptions();
  assert.deepEqual(spans.onGetIrregularSizeByIndex(0), [1, 6], 'large text reduces the finite numeric run to two columns');
  owner.mangaNumberCell(local.getData(0));
  const rendered = [...owner.nodes.values()];
  assert.equal(rendered.find(item => item.type === 'Stack').height, 66);
  const title = rendered.find(item => item.type === 'Text');
  assert.deepEqual([title.fontSize, title.lineHeight, title.maxFontScale, title.halfLeading], [13, 22, 2, true]);
  assert.equal(title.textOverflow, undefined);
  assert.ok(rendered.some(item => item.type === 'Row' && item.border?.width.top === 1),
    'numeric-first tree border stays before the margin and scrolls with its first cells');
  owner.initialRender();
  sdkGrid.at(-1).onScroll(9, 'scrolling');
  assert.deepEqual(offsets, [142], 'toolbar receives actual Scroller yOffset instead of event delta or synthetic Core ranks');
  owner.scroller.currentOffset = () => ({ xOffset: 0, yOffset: -17 });
  sdkGrid.at(-1).onScroll(-3, 'scrolling');
  assert.deepEqual(offsets, [142, -12], 'native bounce keeps its actual negative offset');
}
function checkEmpty(candidate = source) {
  for (const scheme of ['day', 'night']) for (const scale of [1, 3.2]) {
    const { owner } = probe(scheme, false, 320, scale, candidate), clears = [];
    const emptyView = { ...gridView, viewId: 'empty-search', visibleTotal: 0, nodes: [] };
    const data = new production.ReaderDirectoryNavigationDataSource(() => assert.fail('empty display never requests a Core item'));
    data.replace(emptyView);
    Object.assign(owner, { dataSource: data, view: emptyView, mangaSearchActive: true,
      listPaddingTop: 144, contentStartInset: 29, onClearSearch: () => clears.push('clear') });
    const options = owner.mangaGridLayoutOptions();
    assert.deepEqual(options.onGetIrregularSizeByIndex(0), [1, 12]);
    owner.initialRender();
    const viewport = sdkGrid.at(-1);
    assert.equal(viewport.padding.top, 0, 'empty content retains the original full-height Grid viewport');
    assert.equal(viewport.contentStartOffset, 173, 'empty content shares toolbar clearance in actual scroll content');
    assert.equal(viewport.scrollBar, 'BarState.Auto'); assert.equal(viewport.scrollBarWidth, 4);
    assert.equal(viewport.scrollBarColor, '#47000000'); assert.equal(viewport.args[0], owner.scroller);
    const slot = [...owner.nodes.values()].find(native => native.type === 'GridItem');
    assert.ok(slot, 'empty state is a real scroll-content GridItem, never a fixed Stack overlay');
    if (typeof slot.create[0] === 'function') slot.create[0](slot.id, true);
    const rendered = [...owner.nodes.values()];
    const message = rendered.find(native => native.type === 'Text' && native.create === '没有匹配的章节');
    assert.ok(message); assert.deepEqual([message.fontSize, message.lineHeight, message.maxFontScale], [12, 18, scale]);
    const clear = rendered.find(native => native.type === 'Text' && native.create === '清除搜索');
    clear.onClick(); assert.deepEqual(clears, ['clear']);
    owner.interactionEnabled = false; clear.onClick(); assert.equal(clears.length, 1);
    assert.equal(data.totalCount(), 0, 'presentation empty slot never changes canonical Core ranks');
  }
}
checkEmpty();
const omittedEmptySlot = source.replace('if (this.view.visibleTotal === 0) {', 'if (false) {');
assert.notEqual(omittedEmptySlot, source);
assert.throws(() => checkEmpty(omittedEmptySlot), /real scroll-content GridItem/);
const omittedEmptyClear = source.replace('this.onClearSearch();', '');
assert.notEqual(omittedEmptyClear, source);
assert.throws(() => checkEmpty(omittedEmptyClear), assert.AssertionError);
function checkDownloadBudget(candidate = source) {
  const numeric = [node(0, '21'), node(1, '22'), node(2, '23')];
  const ready = { ...gridView, viewId: 'download-budget', visibleTotal: 3, nodes: numeric };
  const data = new production.ReaderDirectoryNavigationDataSource(() => assert.fail('download layout uses resident targets'));
  data.replace(ready);
  const { owner } = probe('day', false, 300, 3.2, candidate);
  Object.assign(owner, { dataSource: data, view: ready, chapterDownloadEnabled: true,
    chapterByIndex: new Map(numeric.map(native => [native.chapterIndex, { index: native.chapterIndex, title: native.title, navigable: true, downloadState: 'completed' }])) });
  const item = data.getData(0), placement = owner.mangaCellPlacement(item);
  assert.equal(placement.columns, 2, 'download accessory reserves its own 24vp before responsive column admission');
  const cellWidth = owner.mangaCellWidth(item);
  const textBudget = 2 * 13 * .7 * 3.2;
  assert.ok(cellWidth - 24 - 12 >= textBudget, 'download sibling cannot consume the distinguishing numeric title lane');
  owner.mangaNumberCell(item);
  assert.ok([...owner.nodes.values()].some(native => native.type === 'Stack' && native.width === 24));
}
checkDownloadBudget();
function checkInitialWidth(candidate = source) {
  for (const width of [320, 390, 800]) {
    const contentWidth = Math.min(540, width - 40), inset = (width - contentWidth) / 2;
    const numeric = [node(0, '21'), node(1, '22'), node(2, '23')];
    const ready = { ...gridView, viewId: `initial-width-${width}`, visibleTotal: 3, nodes: numeric };
    const data = new production.ReaderDirectoryNavigationDataSource(() => assert.fail('first layout only consumes resident Core rows'));
    data.replace(ready);
    const { owner } = probe('day', false, 0, 3.2, candidate);
    Object.assign(owner, { view: ready, dataSource: data,
      listPaddingX: inset, listPaddingRight: inset, chapterDownloadEnabled: true });
    owner.updateStateVars({ mangaInitialViewportWidth: width });
    assert.equal(owner.mangaContentWidth(), contentWidth, 'before first area the shared Grid uses its actual known parent width');
    assert.equal(owner.mangaGridNarrow(), width <= 340);
    assert.ok(owner.mangaCellWidth(data.getData(0)) >= 2 * 13 * .7 * 3.2 + 12 + 24,
      'the initial numeric actor never starts as an arbitrary one-vp cell');
    owner.initialRender(); owner.layoutReady = true;
    sdkGrid.at(-1).onAreaChange({}, {width: width - 23, height: 400});
    assert.equal(owner.mangaContentWidth(), contentWidth - 23, 'measured native width replaces the initial parent budget');
  }
}
checkInitialWidth();
const omittedInitialWidth = source.replaceAll('this.mangaViewportWidth : this.mangaInitialViewportWidth', 'this.mangaViewportWidth : 0');
assert.notEqual(omittedInitialWidth, source);
assert.throws(() => checkInitialWidth(omittedInitialWidth), /actual known parent width/);
const omittedDownloadBudget = source.replaceAll('this.chapterDownloadEnabled ? MANGA_DIRECTORY_VISUAL.downloadGridWidth : 0', '0');
assert.notEqual(omittedDownloadBudget, source);
assert.throws(() => checkDownloadBudget(omittedDownloadBudget), /reserves its own 24vp/);
function checkCurrentWeight(candidate = source) {
  const { owner } = probe('day', false, 390, 1, candidate);
  owner.mangaNumberCell(gridData.getData(1));
  const title = [...owner.nodes.values()].find(native => native.type === 'Text' && native.create === '02');
  assert.deepEqual(title.fontWeight, [550, {enableVariableFontWeight: true}], 'current native number explicitly declares the demo 550 role');
}
checkCurrentWeight();
const wrongCurrentWeight = source.replaceAll('MANGA_DIRECTORY_VISUAL.currentFontWeight', 'MANGA_DIRECTORY_VISUAL.bodyFontWeight');
assert.notEqual(wrongCurrentWeight, source);
assert.throws(() => checkCurrentWeight(wrongCurrentWeight), /explicitly declares the demo 550/);
{
  const verifySeam = (seamNodes, expectedColumns, expectedOrdinal, label) => {
    const requests = [], localView = { ...gridView, viewId: label, visibleTotal: seamNodes.length,
      nodes: seamNodes.slice(0, 256) };
    const local = new production.ReaderDirectoryNavigationDataSource(offset => requests.push(offset));
    local.replace(localView);
    local.admit(256, { viewId: label, visibleTotal: seamNodes.length, nodes: seamNodes.slice(256) });
    const { owner, actions } = probe();
    Object.assign(owner, { dataSource: local, view: localView });
    const options = owner.mangaGridLayoutOptions(), item = local.getData(256);
    assert.equal(owner.mangaCellPlacement(item).columns, expectedColumns);
    assert.equal(owner.mangaCellOrdinal(item), expectedOrdinal, label);
    assert.deepEqual(options.onGetIrregularSizeByIndex(256), [1, 12 / expectedColumns]);
    owner.mangaNumberCell(item);
    [...owner.nodes.values()].find(native => native.type === 'Stack' && native.onClick && native.accessibilityText).onClick();
    assert.deepEqual(actions, [['read', 5256]], 'boundary layout preserves the real sparse chapter target');
    assert.deepEqual(requests, [], 'joining resident pages cannot fetch another catalog segment');
    return owner;
  };
  const continuous = Array.from({ length: 400 }, (_, at) => node(at));
  continuous[0] = node(0, '卷', { kind: 'group', chapterIndex: undefined, hasChildren: true });
  verifySeam(continuous, 4, 3, 'same-parent numeric row continues across 255/256');
  const separated = continuous.map((item, at) => at < 256 ? item : { ...item, parentId: 'next-volume' });
  const nextParent = verifySeam(separated, 4, 0, 'a new authoritative parent starts its own row');
  assert.equal(nextParent.mangaCellTop(nextParent.dataSource.getData(256)), 12);
  const parts = continuous.map(item => ({ ...item }));
  parts[253] = node(253, '分卷说明');
  for (let at = 254; at < parts.length; at += 1) parts[at] = node(at,
    `${42 + Math.floor((at - 254) / 3)}${['上', '中', '下'][(at - 254) % 3]}`);
  verifySeam(parts, 3, 2, 'resident 上中下 stays one triplet across 255/256');
}
for (const scheme of ['day', 'night']) {
  const { owner, actions } = probe(scheme);
  const options = owner.mangaGridLayoutOptions();
  assert.deepEqual(options.regularSize, [1, 1]);
  assert.deepEqual(compact.map((_, index) => options.onGetIrregularSizeByIndex(index)),
    [[1, 3], [1, 9], [1, 3], [1, 9], [1, 12], [1, 12], [1, 12], [1, 12]],
    'the final compact cell consumes remaining lanes; mixed runs and all row kinds start a fresh full row');
  owner.mangaNumberCell(gridData.getData(1));
  const rendered = [...owner.nodes.values()];
  const cell = rendered.find(item => item.type === 'Stack');
  assert.equal(cell.height, 44, 'no second current-reading line is reserved');
  assert.equal(cell.borderRadius, 8);
  assert.equal(cell.backgroundColor, scheme === 'night' ? '#303C2D' : '#E8EDE2');
  assert.equal(rendered.find(item => item.type === 'Text' && item.create === '02').fontFamily, fonts.READER_FONT_NOTO_SANS_SC_UI_550);
  assert.deepEqual(rendered.find(item => item.type === 'Text' && item.create === '02').fontWeight, [550, { enableVariableFontWeight: true }]);
  const current = rendered.find(item => item.type === 'Image');
  assert.equal(current.width, 10); assert.equal(current.height, 10);
  assert.deepEqual(current.margin, { top: 5, right: 5 });
  assert.ok(!rendered.some(item => item.type === 'Text' && item.create === '正在读'));
  const selection = rendered.find(item => item.type === 'Stack' && item.onClick && item.accessibilityText);
  selection.onClick(); assert.deepEqual(actions, [['read', 5001]]);
  owner.interactionEnabled = false; selection.onClick(); assert.equal(actions.length, 1, 'closed motion rejects retained cell clicks');
}
{
  const { owner, actions } = probe();
  const requests = [], downloads = [];
  Object.assign(owner, { mounted: true, generation: 7, chapterDownloadEnabled: true, chapterDownloadActionsEnabled: true,
    chapterByIndex: new Map([[5001, { index: 5001, title: '02', navigable: true, downloadState: 'completed' }]]),
    gateway: { async resolveTarget(book, view, id, guard) { requests.push([book, view, id, guard()]); return { chapterIndex: 5001 }; } },
    onDownloadChapter: index => downloads.push(index), onInvalidated: () => assert.fail('current download proof must remain valid') });
  owner.mangaNumberCell(gridData.getData(1));
  const rendered = [...owner.nodes.values()];
  const download = rendered.find(item => item.type === 'Stack' && item.width === 24 && item.accessibilityText);
  assert.equal(download.enabled, true);
  const shield = rendered.find(item => item.type === 'Stack' && item.width === 24 && !item.accessibilityText && item.onClick);
  assert.ok(shield, 'download keeps a native inert shield if its enabled inner actor exits touch testing');
  assert.equal(shield.focusable, false); shield.onClick();
  assert.deepEqual(actions, [], 'the inert shield cannot read the chapter');
  assert.ok(rendered.some(item => item.type === 'Image' && item.create === 'app.media.reader_directory_marker_check'));
  download.onClick(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(requests, [['book', 'grid', 'n1', true]]);
  assert.deepEqual(downloads, [5001]);
  assert.deepEqual(actions, [], 'the download sibling never opens its chapter');
  owner.interactionEnabled = false; download.onClick(); await Promise.resolve();
  assert.equal(downloads.length, 1, 'the download proof path also rejects a closing directory');
}
{
  const { owner, actions } = probe();
  owner.mangaRow(gridData.getData(4));
  const rendered = [...owner.nodes.values()];
  const title = rendered.find(item => item.layoutWeight === 1 && item.onClick);
  const fold = rendered.find(item => item.type === 'Stack' && item.accessibilityText?.includes('子目录'));
  assert.ok(fold, 'a readable parent has its own fold action');
  assert.equal(fold.width, 32); assert.equal(fold.height, 32);
  assert.deepEqual(fold.margin, { left: 8, right: 8 });
  assert.ok(rendered.some(item => item.type === 'Image' && item.width === 13), 'the chapter chevron remains separate from its fold action');
  title.onClick(); fold.onClick();
  assert.deepEqual(actions, [['read', 5004], ['fold', 'n4']], 'reading the parent and folding it remain independent');
  assert.equal(title.type, 'Row', 'named parent owns its complete padded chapter actor');
  assert.ok(owner.attributeCalls.some(call => call.id === title.id && call.property === 'attributeModifier'),
    'press feedback and chapter callback belong to the same actual native named row');
}
{
  const hidden = new production.ReaderDirectoryNavigationDataSource(() => assert.fail('the finite hidden-actor fixture is already loaded'));
  const catalog = Array.from({ length: 40 }, (_, index) => node(index));
  const hiddenView = { ...view, viewId: 'hidden', visibleTotal: 40, currentVisibleIndex: 20, nodes: catalog };
  hidden.replace(hiddenView);
  const { owner, actions } = probe();
  Object.assign(owner, { dataSource: hidden, view: hiddenView, chapterDownloadEnabled: true, chapterDownloadActionsEnabled: true,
    chapterByIndex: new Map([[5000, { index: 5000, title: '0', navigable: true, downloadState: 'completed' }]]) });
  owner.mangaNumberCell(hidden.getData(0));
  const retained = [...owner.nodes.values()].find(item => item.type === 'Stack' && item.onClick && item.accessibilityText);
  owner.mangaQuickDisplay = true;
  retained.onClick();
  assert.deepEqual(actions, [['read', 5000]], 'switching to Quick keeps far canonical targets available');
  assert.equal(owner.canDownloadTarget(catalog[0]), true, 'Quick keeps exact-index download authority for a far admitted target');
  let complete, guard;
  const resolved = [], selection = createReaderBuilderProbe(source, ['selectTarget'], {}).owner;
  Object.assign(selection, { dataSource: hidden, view: hiddenView, mounted: true, generation: 1, selectionGeneration: 0,
    bookId: 'book', interactionEnabled: true, mangaQuickDisplay: false, mangaSearchActive: false,
    gateway: { resolveTarget(_book, _view, _node, current) { guard = current; return new Promise(done => { complete = done; }); } },
    onSelectTarget: (...args) => resolved.push(args), onInvalidated: () => assert.fail('hidden selection is rejected quietly') });
  selection.selectTarget(catalog[0]);
  selection.mangaQuickDisplay = true;
  assert.equal(guard(), true, 'Quick mode alone cannot revoke a current canonical target');
  const removedView = { ...hiddenView, viewId: 'hidden-removed', visibleTotal: 39, nodes: catalog.slice(1) };
  hidden.replace(removedView); selection.view = removedView; owner.view = removedView;
  retained.onClick(); assert.equal(actions.length, 1, 'an actual removed Core target loses its retained actor authority');
  assert.equal(owner.canDownloadTarget(catalog[0]), false);
  assert.equal(guard(), false, 'a pending proof rechecks the immutable Core view after target removal');
  complete({ chapterIndex: 5000, chapterOffsetScalar: 0 }); await Promise.resolve();
  assert.deepEqual(resolved, []);
}
{
  const { owner } = probe('day', false, 320);
  const options = owner.mangaGridLayoutOptions();
  assert.deepEqual([options.onGetIrregularSizeByIndex(0), options.onGetIrregularSizeByIndex(2)], [[1, 4], [1, 6]],
    'a narrow directory uses numeric three columns and paired-part two columns');
  owner.initialRender();
  const native = sdkGrid.at(-1);
  assert.equal(native.columnsTemplate.split(' ').length, 12);
  assert.equal(native.cachedCount, 4);
  assert.equal(native.enableScrollInteraction, true);
  assert.deepEqual(native.padding, { left: 10, right: 10, top: 0, bottom: 0 });
  owner.contentStartInset = 97; owner.contentEndInset = 61; owner.replay();
  assert.deepEqual(sdkGrid.at(-1).padding, { left: 10, right: 10, top: 0, bottom: 0 });
  assert.equal(sdkGrid.at(-1).contentStartOffset, 102);
  assert.equal(sdkGrid.at(-1).contentEndOffset, 66, 'chrome clearance belongs to official scroll content offsets');
  owner.mangaCatalogDisplay = true; owner.replay();
  assert.equal(sdkGrid.at(-1).contentEndOffset, 79, 'catalog retains18 plus the footer content inset');
}
{
  const { owner, scrolls } = probe('day', true);
  assert.equal(gridData.totalCount(), compact.length);
  assert.equal(gridData.getData(0).node.nodeId, 'n0');
  assert.deepEqual(owner.mangaGridLayoutOptions().onGetIrregularSizeByIndex(0), [1, 3]);
  owner.initialPositionPending = true;
  owner.positionPlan = { viewId: 'grid', index: 1, rowFraction: 0.5, align: 'start' };
  owner.positionInitialCurrent();
  assert.equal(scrolls[0][0], gridData.displayIndex(1));
  assert.equal(scrolls[0][3].extraOffset.value, 27, 'Quick restore uses the real cell height with the canonical anchor rank');
  owner.firstVisibleIndex = 1;
  const capture = createReaderBuilderProbe(source, ['captureViewportAnchor'], {
    readerDirectoryScopeKey, readerDirectorySaveViewportAnchor: anchor => scrolls.push(anchor) }).owner;
  Object.assign(capture, owner, { captureViewportAnchor: undefined });
  capture.captureViewportAnchor = Object.getPrototypeOf(capture).captureViewportAnchor;
  capture.captureViewportAnchor();
  assert.equal(scrolls.at(-1).visibleIndex, 1);
  assert.equal(scrolls.at(-1).nodeId, 'n1', 'Quick saves a Core node anchor, never its physical Grid ordinal');
  assert.equal(gridData.displayIndex(scrolls.at(-1).visibleIndex), 1, 'the same anchor restores in the full directory');
}
assert.ok(production.directoryPages.keys().length <= 12, 'the production process cache remains bounded');
{
  const timers = [], requests = [], notifications = [], scrolls = [], saved = [];
  let owner;
  const far = new production.ReaderDirectoryNavigationDataSource(offset => owner.loadPage(offset));
  const farView = { ...view, viewId: 'far', visibleTotal: 1000000, currentVisibleIndex: 6000,
    nodes: [], preparedPages: [{ offset: 5888, page: { viewId: 'far', visibleTotal: 1000000,
      nodes: Array.from({ length: 256 }, (_, at) => node(5888 + at)) } }] };
  far.replace(farView);
  far.registerDataChangeListener({ onDataReloaded() {}, onDataChanged: index => notifications.push(index) });
  owner = createReaderBuilderProbe(source, ['loadPage', 'admitMangaPages', 'settleMangaScroll', 'captureViewportAnchor',
    'schedulePosition', 'positionInitialCurrent', 'positionRowHeight', 'planPosition', 'mangaContentStartOffset'], {
      ...layout, setTimeout: action => timers.push(action), readerDirectoryScopeKey,
      cacheReaderDirectoryNavigationPage: production.cacheReaderDirectoryNavigationPage,
      readerDirectoryViewportAnchor: () => saved.at(-1), readerDirectorySaveViewportAnchor: anchor => saved.push(anchor),
      ScrollAlign: { START: 'start', CENTER: 'center' }, LengthMetrics: { vp: value => ({ value }) },
    }).owner;
  Object.assign(owner, { dataSource: far, view: farView, sourceId: 'manga', bookId: 'book',
    mounted: true, generation: 11, interactionEnabled: true, mangaDisplay: true, mangaQuickDisplay: false,
    mangaSearchActive: false, mangaDragging: false, initialPositionPending: true, mangaPresentationRevision: 0, pendingPages: [],
    firstVisibleIndex: 6000, mangaRowMinHeight: 58, rowHeight: 40,
    mangaVisibleTopInset: 0, contentStartInset: 0, listPaddingTop: 0, listPaddingY: 0,
    scroller: { getItemRect(index) { return { y: -11, height: far.loadedNode(index) === undefined ? 58 : 44 }; },
      scrollToIndex: (...args) => scrolls.push(args) }, onScrollSettled() {},
    gateway: { async page(book, id, offset, guard) { requests.push([book, id, offset, guard()]);
      return { viewId: 'far', visibleTotal: 1000000, nodes: Array.from({ length: 256 }, (_, at) => node(offset + at)) }; } },
    onInvalidated: () => assert.fail('finite current page must not invalidate the view') });
  owner.positionInitialCurrent();
  assert.equal(scrolls[0][0], 6000, 'a far current target enters by Core rank using only its prepared page');
  owner.firstVisibleIndex = 7000; owner.mangaDragging = true; owner.initialPositionPending = false;
  assert.equal(far.getData(7000).node, undefined);
  timers.shift()(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(requests, [['book', 'far', 6912, true]]);
  assert.equal(owner.pendingPages[0].page.nodes.length, 0, 'motion pending data owns only a header; nodes remain in the process LRU');
  assert.equal(far.loadedNode(7000), undefined, 'pre-cached nodes are not announced as materialized targets before admission');
  assert.deepEqual(notifications, [], 'dragging never republishes placeholder geometry');
  owner.settleMangaScroll();
  assert.equal(far.loadedNode(7000).chapterIndex, 12000);
  assert.ok(notifications.includes(7000), 'deferred cached page must notify the placeholder-to-target change');
  assert.equal(owner.positionPlan.rowFraction, 0, 'the old placeholder58/12-lane geometry contributes no pixel fraction');
  assert.deepEqual(saved, [], 'stop cannot snapshot a just-replaced native placeholder before the scheduled restore');
  while (timers.length > 0) timers.shift()();
  assert.equal(scrolls.at(-1)[0], 7000);
  assert.equal(scrolls.at(-1)[3].extraOffset.value, 0);
  // An already announced target rect remains a legitimate fractional anchor.
  owner.firstVisibleIndex = 7000; owner.initialPositionPending = false;
  owner.admitMangaPages([{ offset: 7168, page: { viewId: 'far', visibleTotal: 1000000,
    nodes: Array.from({ length: 256 }, (_, at) => node(7168 + at)) } }]);
  assert.equal(owner.positionPlan.rowFraction, 0.25);
  while (timers.length > 0) timers.shift()();
  assert.equal(scrolls.at(-1)[0], 7000); assert.equal(scrolls.at(-1)[3].extraOffset.value, 11);
  for (let index = 0; index < 13; index += 1) production.directoryPages.put(`other-view:${index}`, [node(index)]);
  owner.initialPositionPending = false; owner.firstVisibleIndex = 7000; owner.mangaDragging = true;
  const changedBeforeEviction = notifications.length;
  assert.equal(far.getData(7000).node, undefined, 'another directory may evict an announced page from the shared LRU');
  timers.shift()(); await Promise.resolve(); await Promise.resolve();
  assert.equal(far.loadedNode(7000), undefined, 'an evicted offset cannot keep a stale announced-page flag after a deferred refill');
  owner.settleMangaScroll();
  assert.ok(notifications.slice(changedBeforeEviction).includes(7000), 'an evicted placeholder also receives its target publication notification');
  assert.equal(owner.positionPlan.rowFraction, 0, 'refilled placeholders cannot reuse a stale fractional rect');
  while (timers.length > 0) timers.shift()();
  assert.ok(requests.length === 2 && production.directoryPages.keys().length <= 12, 'far/drag navigation never enumerates the million-node view');
}
console.log('PASS actual manga Core-paged Grid SDK spans, 44vp cells/day/night/current marker/download proof, parent target/fold separation, narrow columns, complete bounded Core-paged Quick/real hierarchy/mapping/parts/search/full and canonical viewport anchors; native pixels and motion remain unverified');

// Equal LazyForEach keys retain the first itemGenerator argument. Exercise the
// actual SDK observers and V1 property dependency delivery instead of invoking
// a fresh row Builder after each publication. Native layout remains separate.
function retainedMangaPaint(candidate = source, numeric = false) {
  const initialNode = node(17, numeric ? '02' : '旧章节', { parentTitle: '旧卷', depth: 1 });
  const initialView = { ...view, viewId: `retained-${numeric}-initial`, visibleTotal: 1,
    currentVisibleIndex: 0, nodes: [initialNode] };
  const retainedData = new production.ReaderDirectoryNavigationDataSource(() => assert.fail('retained paint fixture is completely resident'));
  retainedData.replace(initialView);
  const captured = retainedData.getData(0);
  const properties = createArkUIPropertyRuntimeProbe();
  const extra = ['view', 'onViewChanged', 'chapterEntries', 'onChapterEntriesChanged', 'chapterByIndex',
    'chapterSource', 'chapterSignatures', 'mangaPresentationRevision', 'currentChapterIndex', 'mangaGridSpans'];
  const result = createReaderBuilderProbe(candidate, [...new Set([...names, ...extra])],
    { ...mangaGridProbeDependencies, ...fonts, ...properties.sdk }, properties.hooks);
  const owner = result.owner, reads = [], downloads = [];
  Object.assign(owner, { mounted: false, dataSource: retainedData, view: initialView, mangaDisplay: true,
    mangaQuickDisplay: false, mangaSearchActive: true, mangaCatalogDisplay: false, mangaCatalogNarrow: undefined,
    mangaPresentationRevision: 0, windowMetricsRevision: 0, mangaViewportWidth: 390,
    mangaInitialViewportWidth: 0, mangaScheme: 'day', appThemeScheme: 'day', currentChapterIndex: 5017,
    interactionEnabled: true, chapterDownloadEnabled: true, chapterDownloadActionsEnabled: false,
    listPaddingX: 0, listPaddingRight: 0, rowHeight: 44, mangaRowMinHeight: 58,
    bookId: 'book', sourceId: 'manga', generation: 1, selectionGeneration: 0,
    captureViewportAnchor() {}, planPosition: () => undefined, schedulePosition() {},
    selectTarget: native => reads.push(native), downloadTarget: native => downloads.push(native) });
  owner.chapterEntries = [{ index: 5017, title: initialNode.title, navigable: true, downloadState: 'missing' }];
  if (numeric) owner.mangaNumberCell(captured); else owner.mangaRow(captured);
  owner.mounted = true;
  const oldKey = owner.rowKey(captured), observerCount = owner.observers.length;
  const painted = [...owner.nodes.values()].find(native => native.visibility === 'Visibility.Visible');
  const title = [...owner.nodes.values()].find(native => native.type === 'Text' && native.create === initialNode.title);
  const marker = [...owner.nodes.values()].find(native => native.type === 'Image' && native.create === 'app.media.reader_directory_marker_download');
  const download = [...owner.nodes.values()].find(native => native.type === 'Stack' && native.accessibilityText?.includes('下载') && native.onClick);
  const read = [...owner.nodes.values()].find(native => native.onClick && native.accessibilityText?.includes(initialNode.title) && !native.accessibilityText?.includes('下载'));
  assert.ok(title && marker && download && read, 'the initial retained actors are the actual SDK-generated title/download/chapter');
  const nextNode = { ...initialNode, title: numeric ? '03' : '新章节', parentTitle: '新卷', depth: 3 };
  owner.view = { ...view, viewId: `retained-${numeric}-next`, visibleTotal: 1, currentVisibleIndex: 0, nodes: [nextNode] };
  properties.flush();
  assert.equal(owner.rowKey(retainedData.getData(0)), oldKey, 'title and parent metadata do not remount the LazyForEach row');
  assert.equal(owner.observers.length, observerCount, 'the same retained native actors receive current facts');
  assert.equal(title.create, nextNode.title, 'retained title reads the current canonical node');
  if (!numeric) assert.ok([...owner.nodes.values()].some(native => native.type === 'Text' && native.create === '新卷'),
    'retained search context reads the current parent title');
  owner.mangaSearchActive = false; owner.mangaPresentationRevision += 1; properties.flush();
  assert.equal(owner.mangaRowPaddingLeft(captured), 26, 'same-kind depth changes use the current node facts');
  if (!numeric) assert.equal(read.padding.left, 26, 'the retained named actor receives the current depth geometry');
  assert.ok(read.accessibilityText.includes(nextNode.title), 'retained accessibility reads current title');
  read.onClick(); download.onClick();
  assert.equal(reads.at(-1).title, nextNode.title, 'the retained chapter actor passes the current canonical node');
  assert.equal(downloads.at(-1).title, nextNode.title, 'the retained download actor passes the current canonical node');
  owner.chapterEntries = [{ index: 5017, title: nextNode.title, navigable: true, downloadState: 'completed' }];
  properties.flush();
  assert.equal(marker.create, 'app.media.reader_directory_marker_check', 'the chapter Watch publishes a real retained download repaint');
  assert.equal(download.enabled, false, 'completed download authority is withdrawn from the existing actor');
  owner.currentChapterIndex = -1; properties.flush();
  assert.equal(title.fontFamily, fonts.READER_FONT_NOTO_SANS_SC_UI_REGULAR, 'current styling remains reactive on the retained title');
  assert.ok(!read.accessibilityText.includes('正在读'), 'retained accessibility follows the latest current chapter');
  owner.chapterEntries = [{ index: 5017, title: nextNode.title, navigable: false, downloadState: 'completed' }];
  properties.flush();
  assert.equal(owner.canDownloadTarget(nextNode), false, 'a non-navigable current chapter cannot retain download authority');
  const count = reads.length;
  owner.downloadTarget = Object.getPrototypeOf(owner).downloadTarget.bind(owner);
  owner.gateway = { resolveTarget() { assert.fail('a withdrawn node cannot request download proof'); } };
  owner.view = { ...view, viewId: `retained-${numeric}-removed`, visibleTotal: 0, nodes: [] };
  properties.flush();
  assert.equal(painted.visibility, 'Visibility.Hidden', 'withdrawn cached actors cannot paint old admitted facts');
  read.onClick(); download.onClick();
  assert.equal(reads.length, count, 'a retained removed actor cannot select its old target');
  assert.equal(owner.canDownloadTarget(nextNode), false, 'a removed node cannot retain download authority');
}
retainedMangaPaint(source); retainedMangaPaint(source, true);
const capturedTitle = source.replace('return mangaDirectoryDisplay(this.mangaDisplayNode(node)).title;', 'return node.title;');
assert.notEqual(capturedTitle, source);
assert.throws(() => retainedMangaPaint(capturedTitle), /retained title reads the current canonical node/,
  'the original item.node.title capture is rejected by actual retained SDK observers');
const quietDownload = source.replace('if (this.mangaDisplay && changed.size > 0) this.mangaPresentationRevision += 1;',
  'if (this.mangaDisplay && changed.size > 0) {}');
assert.notEqual(quietDownload, source);
assert.throws(() => retainedMangaPaint(quietDownload), /retained download repaint/,
  'data notifications with equal keys cannot replace an observable download publication');
console.log('PASS retained equal-key SDK observers: named/numeric title, parent, current, accessibility, canonical clicks and download authority; captured-title/unpublished-download negative controls');
const capturedDepth = source.replace('this.displayLevel(this.mangaPaintNode(item.node))', 'this.displayLevel(item.node)');
assert.notEqual(capturedDepth, source);
assert.throws(() => retainedMangaPaint(capturedDepth), /same-kind depth changes/,
  'a current title cannot hide retained stale geometry');
const ghostPaint = source.replaceAll('this.mangaRowAdmitted(item) ? Visibility.Visible : Visibility.Hidden', 'Visibility.Visible');
assert.notEqual(ghostPaint, source);
assert.throws(() => retainedMangaPaint(ghostPaint), /withdrawn cached actors cannot paint/,
  'keeping a removed same-key actor visible is rejected without inventing a new Core target');
{
  const oldGroup = node(61, '旧卷组', { kind: 'group', depth: 1, chapterIndex: undefined,
    hasChildren: true, expanded: true, readableDescendantCount: 2 });
  const first = { ...view, viewId: 'retained-group-old', visibleTotal: 1, nodes: [oldGroup] };
  const groupData = new production.ReaderDirectoryNavigationDataSource(() => assert.fail('group is resident'));
  groupData.replace(first); const captured = groupData.getData(0), properties = createArkUIPropertyRuntimeProbe();
  const result = createReaderBuilderProbe(source, [...new Set([...names, 'view', 'onViewChanged', 'mangaPresentationRevision'])],
    { ...mangaGridProbeDependencies, ...fonts, ...properties.sdk }, properties.hooks);
  const owner = result.owner, toggles = [];
  Object.assign(owner, { mounted: false, dataSource: groupData, view: first, mangaDisplay: true,
    mangaQuickDisplay: false, mangaSearchActive: false, mangaPresentationRevision: 0,
    mangaCatalogDisplay: false, mangaCatalogNarrow: undefined, mangaScheme: 'day', appThemeScheme: 'day',
    mangaViewportWidth: 390, mangaInitialViewportWidth: 0, windowMetricsRevision: 0,
    interactionEnabled: true, currentChapterIndex: -1, chapterDownloadEnabled: false,
    listPaddingX: 0, listPaddingRight: 0, rowHeight: 44, mangaRowMinHeight: 58,
    generation: 1, selectionGeneration: 0, captureViewportAnchor() {}, planPosition: () => undefined,
    schedulePosition() {}, toggleNode: native => toggles.push(native) });
  owner.mangaRow(captured); owner.mounted = true;
  const key = owner.rowKey(captured), count = owner.observers.length;
  const fold = [...owner.nodes.values()].find(native => native.type === 'Image' && native.onClick);
  const title = [...owner.nodes.values()].find(native => native.type === 'Text' && native.create === '旧卷组');
  const metadata = [...owner.nodes.values()].find(native => native.type === 'Text' && native.create === '2 个可读条目');
  const next = { ...oldGroup, title: '新卷组', depth: 3, expanded: false, readableDescendantCount: 9 };
  owner.view = { ...view, viewId: 'retained-group-new', visibleTotal: 1, nodes: [next] }; properties.flush();
  assert.equal(owner.rowKey(groupData.getData(0)), key, 'group folding retains its actual rotating Image actor');
  assert.equal(owner.observers.length, count, 'group metadata refresh does not remount native actors');
  assert.equal(title.create, '新卷组'); assert.equal(metadata.create, '9 个可读条目');
  assert.equal(fold.rotate.angle, -90); assert.ok(fold.accessibilityText.includes('新卷组'));
  fold.onClick(); assert.equal(toggles.at(-1).title, '新卷组', 'retained fold resolves the current canonical group');
  owner.view = { ...view, viewId: 'retained-group-removed', visibleTotal: 0, nodes: [] }; properties.flush();
  const before = toggles.length; fold.onClick();
  assert.equal(toggles.length, before, 'withdrawn group cannot fold an old captured node');
  assert.equal([...owner.nodes.values()].find(native => native.type === 'Row' && native.onClick).visibility,
    'Visibility.Hidden', 'withdrawn group paint is not presented as current facts');
}
console.log('PASS same-kind depth and removed-node paint negative controls; retained group title/count/fold actor and absent-group action fence');


function checkScrollGeometry(candidate = source) {
  const { owner, scrolls } = probe('night', false, 320, 3.2, candidate, true), published = [];
  Object.assign(owner, { listPaddingTop: 612.6, listPaddingBottom: 58, mangaVisibleTopInset: 159.6,
    onScrollOffset: offset => published.push(offset) });
  let raw = -612.6;
  owner.scroller.currentOffset = () => ({ yOffset: raw, xOffset: 0 });
  owner.initialRender();
  const grid = [...owner.nodes.values()].find(item => item.type === 'Grid');
  assert.ok(grid); assert.equal(grid.create[0], owner.scroller, 'actual Grid owns the unchanged caller Scroller');
  assert.deepEqual(grid.padding, { left: 10, right: 10, top: 0, bottom: 0 }, 'content clearances cannot shrink the actual Grid viewport');
  assert.equal(grid.contentStartOffset, 612.6); assert.equal(grid.contentEndOffset, 58);
  grid.onScroll(0, 'scrolling'); raw = -622.6; grid.onScroll(-10, 'scrolling'); raw = -509.1; grid.onScroll(103.5, 'scrolling');
  assert.deepEqual(published, [0, -10, 103.5], 'official negative start origin normalizes to zero, preserves bounce and actual displacement');
  owner.positionPlan = { viewId: gridView.viewId, index: 1, rowFraction: 0, align: 'start', currentInset: 12, smooth: true };
  owner.initialPositionPending = true; owner.positionInitialCurrent();
  assert.equal(scrolls.at(-1)[0], 1); assert.equal(scrolls.at(-1)[2], 'start');
  assert.ok(Math.abs(scrolls.at(-1)[3].extraOffset.value - 441) < 1e-9,
    'START subtracts the fixed header bottom and requested12 from the official content start offset');
  owner.positionPlan = { viewId: gridView.viewId, index: 1, rowFraction: .5, align: 'start' };
  owner.initialPositionPending = true; owner.positionInitialCurrent();
  assert.equal(scrolls.at(-1)[3].extraOffset.value, 634.6, 'saved native anchor retains its absolute row fraction against the content offset');
  const nativeScroller = grid.create[0];
  owner.listPaddingTop = 724; owner.listPaddingBottom = 70; owner.replayOnly([grid.id]);
  assert.equal(owner.nodes.get(grid.id), grid); assert.equal(grid.create[0], nativeScroller);
  assert.equal(grid.contentStartOffset, 724); assert.equal(grid.contentEndOffset, 70);
  assert.deepEqual(grid.padding, { left: 10, right: 10, top: 0, bottom: 0 });
  const calls = owner.attributeCalls.filter(call => call.id === grid.id);
  assert.equal(calls.filter(call => call.property === 'contentStartOffset').length, 2);
  assert.equal(calls.filter(call => call.property === 'contentEndOffset').length, 2);
}
checkScrollGeometry();
for (const [label, candidate] of [
  ['viewport padding', source.replace('top: 0, bottom: 0 })\n        .contentStartOffset', 'top: this.mangaContentStartOffset(), bottom: this.mangaContentEndOffset() })\n        .contentStartOffset')],
  ['raw negative origin', source.replace('offset + this.mangaContentStartOffset()', 'offset')],
  ['lost fixed header', source.replace('startOffset - visibleTop - plan.currentInset', 'startOffset - plan.currentInset')],
  ['anchor without content origin', source.replace('startOffset + plan.rowFraction', 'plan.rowFraction')],
]) {
  assert.notEqual(candidate, source, label);
  assert.throws(() => checkScrollGeometry(candidate), assert.AssertionError, `reject ${label}`);
}
console.log('PASS official Grid content offsets, zero/signed scroll origin, header-aware START/current/anchor, retained actual Grid/Scroller, four source-negative controls; physical engine layout remains pending');


function checkParentWidthClass(candidate = source) {
  const { owner } = probe('day', true, 329.7, 1, candidate);
  const ready = { ...gridView, viewId: 'parent-width-class', nodes: compact };
  const data = new production.ReaderDirectoryNavigationDataSource(() => assert.fail('width-class probe must not fetch outside its resident page'));
  data.replace(ready);
  Object.assign(owner, { dataSource: data, view: ready, listPaddingX: 0, listPaddingRight: 0 });
  assert.equal(owner.mangaCatalogNarrow, undefined, 'unspecified consumer receives the real optional Prop default');
  assert.equal(owner.mangaGridNarrow(), true, 'generic unspecified Grid retains its measured-width fallback');
  owner.updateStateVars({ mangaCatalogNarrow: false });
  assert.equal(owner.mangaGridNarrow(), false, 'explicit parent wide class cannot be replaced by329.7vp body width');
  assert.equal(owner.mangaCellPlacement(data.getData(0)).columns, 4, '365.7vp phone parent admits the same demo four numeric columns');
  owner.updateStateVars({ mangaCatalogNarrow: true });
  assert.equal(owner.mangaGridNarrow(), true); assert.equal(owner.mangaCellPlacement(data.getData(0)).columns, 3,
    'the same retained native owner honors the changed320vp parent class');
  owner.updateStateVars({ mangaCatalogNarrow: false }); owner.mangaViewportWidth = 72;
  assert.equal(owner.mangaCellPlacement(data.getData(0)).columns, 1, 'real available content still limits columns even with explicit wide class');
  owner.updateStateVars({ mangaCatalogNarrow: undefined }); owner.mangaViewportWidth = 390;
  assert.equal(owner.mangaGridNarrow(), false, 'unspecified wide native width preserves the generic fallback');
}
checkParentWidthClass();
const lostExplicitFalse = source.replace('this.mangaCatalogNarrow !== undefined ? this.mangaCatalogNarrow : width > 0 && width <= MANGA_DIRECTORY_VISUAL.narrowWidth',
  'this.mangaCatalogNarrow || width > 0 && width <= MANGA_DIRECTORY_VISUAL.narrowWidth');
assert.notEqual(lostExplicitFalse, source);
assert.throws(() => checkParentWidthClass(lostExplicitFalse), assert.AssertionError, 'reject the original false-overridden-by-body class bug');
console.log('PASS actual SDK optional parent width class false/true/undefined and real-content column budget; original OR negative rejected');

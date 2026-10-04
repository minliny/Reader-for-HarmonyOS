import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderDirectoryNavigationGateway, decodeReaderDirectoryOpen, decodeReaderDirectoryPage,
  readerDirectoryScopeKey } from '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';
import { readerDirectoryViewportAnchor } from '../entry/src/main/ets/features/reading/ReaderDirectoryViewport.ts';

import { readerDirectoryAccessibilityText } from '../entry/src/main/ets/features/reading/ReaderDirectoryHierarchy.ts';

const listPath = new URL('../entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets', import.meta.url);
const listSource = readFileSync(listPath, 'utf8');
const fallbackSource = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingDirectoryFallback.ets', import.meta.url), 'utf8');
const identity = { sourceId: 'manga', bookId: 'book', catalogRevision: 'c1', structureRevision: 's1' };
const wireGroup = { nodeId: 'g', title: '确定卷组', kind: 'group', depth: 0,
  hasChildren: true, expanded: true, readableDescendantCount: 318 };
const wireChild = { nodeId: 'leaf', parentId: 'g', parentTitle: '确定卷组', title: '03', kind: 'target', depth: 1,
  chapterIndex: 79, hasChildren: false, expanded: false };
const wire = { ...identity, status: 'ready', viewId: 'v1', navigationRevision: 's1', visibleTotal: 319,
  currentVisibleIndex: 9, nodes: [wireGroup, wireChild], nextOffset: 2 };
const requests = [];
const gateway = new ReaderDirectoryNavigationGateway({ supportsCoreCapability: () => true,
  request: async (method, params) => {
    requests.push([method, params]);
    return { data: method.endsWith('open.v2') ? params.query === '03' ?
      { ...wire, viewId: 'search-03', visibleTotal: 1, currentVisibleIndex: 0, nodes: [wireChild], nextOffset: undefined } : wire : { ...identity, viewId: 'v1', visibleTotal: 319,
      nodes: [wireChild], nextOffset: params.offset + 1 } };
  } });
const view = await gateway.open({ ...identity });
assert.deepEqual(view.nodes.map(node => node.depth), [1, 2], 'real v2 gateway normalizes wire depth exactly once');
assert.equal(view.nodes[0].readableDescendantCount, 318);
assert.equal(view.nodes[1].parentTitle, '确定卷组');
const page = await gateway.page('book', 'v1', 256);
assert.equal(page.nodes[0].parentTitle, '确定卷组', 'bounded page preserves Core parent context');
assert.equal(page.nodes[0].depth, 2);
assert.equal(requests.at(-1)[1].limit, 256);
const searchView = await gateway.open({ ...identity, query: '03', chapterIndex: 79 });
assert.equal(requests.at(-1)[1].query, '03', 'the real v2 gateway forwards the production search projection');
assert.deepEqual(searchView.nodes.map(node => [node.nodeId, node.depth, node.chapterIndex, node.parentTitle]),
  [['leaf', 2, 79, '确定卷组']], 'search preserves authoritative depth, parent and canonical target identity');
assert.equal(decodeReaderDirectoryOpen({ ...wire, nodes: [{ ...wireGroup, readableDescendantCount: null }], nextOffset: 1 }).nodes[0].readableDescendantCount, undefined);
assert.equal(decodeReaderDirectoryOpen({ ...wire, nodes: [{ ...wireChild, parentTitle: null }], nextOffset: 1 }).nodes[0].parentTitle, undefined);
assert.throws(() => decodeReaderDirectoryOpen({ ...wire, nodes: [{ ...wireGroup, readableDescendantCount: -1 }], nextOffset: 1 }), /readable descendants/);
assert.throws(() => decodeReaderDirectoryOpen({ ...wire, nodes: [{ ...wireChild, readableDescendantCount: 1 }], nextOffset: 1 }), /require a group/);
assert.throws(() => decodeReaderDirectoryPage({ viewId: 'v1', visibleTotal: 319,
  nodes: [{ ...wireChild, parentTitle: ' ' }] }, 'v1', 256), /parent title/);

const rowNames = ['mangaRow', 'mangaColor', 'displayLevel', 'mangaGroupNode', 'mangaGroupSpacing', 'mangaRowIndex', 'mangaRowPaddingLeft', 'isCurrentMangaNode'];
function rowProbe(source, node, { scheme = 'day', current = false, search = false, index = 0, height = 58, catalog = false, narrow = false } = {}) {
  const { owner } = createReaderBuilderProbe(source, rowNames, fontFamilies);
  Object.assign(owner, { view, mangaDisplay: true, mangaScheme: scheme, appThemeScheme: 'day', mangaSearchActive: search,
    mangaRowMinHeight: height, mangaCatalogDisplay: catalog, mangaCatalogNarrow: narrow, currentChapterIndex: current ? node.chapterIndex : -1, interactionEnabled: true, mangaPresentationRevision: 0,
    dataSource: { loadedItemById: () => ({ node, index }), currentView: () => view },
    onSelectTarget() {}, toggleNode() {}, selectTarget() {} });
  owner.mangaRow({ node, index, key: node.nodeId });
  const nodes = [...owner.nodes.values()];
  return { owner, nodes, row: nodes.find(item => item.type === 'Row'),
    title: nodes.find(item => item.type === 'Text' && item.create === node.title) };
}
function checkOrdinary(source) {
  for (const scheme of ['day', 'night']) {
    const { nodes, row, title } = rowProbe(source, view.nodes[1], { scheme, search: true });
    assert.equal(row.padding.left, 10, 'demo search projects a flat row even when Core retains authoritative child depth');
    assert.equal(rowProbe(source, view.nodes[1], { scheme }).row.padding.left, 26, 'one normalization gives the exact child inset outside search');
    assert.equal(row.create.space, 12);
    assert.equal(title.fontFamily, fontFamilies.READER_FONT_NOTO_SANS_SC_UI_REGULAR);
    assert.equal(title.fontWeight, 400, 'static regular face uses normal native styling without a VF switch');
    assert.equal(title.lineHeight, 22);
    const parent = nodes.find(item => item.type === 'Text' && item.create === '确定卷组');
    assert.equal(parent.fontSize, 10); assert.equal(parent.lineHeight, 16);
    assert.equal(parent.fontFamily, fontFamilies.READER_FONT_NOTO_SANS_SC_UI_REGULAR);
    const arrow = nodes.find(item => item.type === 'Image');
    assert.ok(arrow, 'actual SVG owns its viewBox instead of a tiny unscaled Path');
    assert.equal(arrow.create, `app.media.manga_sheet_chevron_right${scheme === 'night' ? '_theme_night' : ''}`);
    assert.deepEqual([arrow.width, arrow.height], [13, 13]);
    assert.ok(!nodes.some(item => item.type === 'Path'));
  }
}
checkOrdinary(listSource);
{
  const result = rowProbe(listSource, searchView.nodes[0], { search: true });
  result.row.onClick();
  assert.equal(result.row.padding.left, 10, 'a real gateway search target uses the flat demo inset');
  assert.equal(result.row.border.width.top, 1, 'the first search result carries the content-owned top boundary');
  assert.ok(result.nodes.some(node => node.type === 'Text' && node.create === '确定卷组'));
}
function checkGroupMotion(source) {
  const previousContext = globalThis.Context;
  const { owner, nodes } = rowProbe(source, view.nodes[0]);
  const arrow = nodes.find(item => item.type === 'Image');
  assert.deepEqual(arrow.animation, { duration: 180, curve: 'ease' }, 'demo group rotation keeps its 180ms ease animation');
  const calls = owner.attributeCalls.filter(call => call.id === arrow.id && call.property === 'contextAnimation');
  assert.deepEqual(calls.map(call => call.args[0]), [{ duration: 180, curve: 'ease' }, null],
    'actual SDK animation start/reset surrounds the native arrow attributes');
  assert.equal(globalThis.Context, previousContext, 'probe restores the caller Context after every observer');
}
checkGroupMotion(listSource);
const instantGroup = listSource.replace(".animation({ duration: 180, curve: 'ease' });", ';');
assert.notEqual(instantGroup, listSource);
assert.throws(() => checkGroupMotion(instantGroup), /demo group rotation/);
async function checkRetainedGroup(source) {
  const properties = createArkUIPropertyRuntimeProbe();
  const timers = [];
  // Platform-cache I/O boundary only: the production window, admission,
  // lookup and native property/observer code execute without rewriting them.
  const cache = new Map();
  const pageWindowCode = stripTypeScriptTypes(source.slice(source.indexOf('function directoryPagePrefix('),
    source.indexOf('interface ReaderDirectoryNavigationItem')).replace('export function ', 'function '));
  const { ReaderDirectoryPageWindow, cacheReaderDirectoryNavigationPage } = new Function('directoryPages', 'readerDirectoryScopeKey',
    `${pageWindowCode}; return { ReaderDirectoryPageWindow, cacheReaderDirectoryNavigationPage };`)(
      { get: key => cache.get(key), put: (key, value) => cache.set(key, value), keys: () => [...cache.keys()] }, readerDirectoryScopeKey);
  const DataSource = productionMotionMethods(listPath,
    ['loadedNode', 'loadedItemById', 'getData', 'totalCount', 'currentView', 'replace', 'admit'],
    { DIRECTORY_PAGE_SIZE: 256, setTimeout: action => timers.push(action) });
  const data = Object.assign(new DataSource(), { view: undefined, pages: new ReaderDirectoryPageWindow(),
    pending: new Set(), listeners: [], load() {} });
  const initial = { ...view, viewId: 'retained-expanded', visibleTotal: 300, nodes: [],
    preparedPages: [{ offset: 256, page: { viewId: 'retained-expanded', visibleTotal: 300, nodes: [{ ...view.nodes[0] }] } }] };
  const hooks = { ...properties.hooks, initialParams: { view: initial } };
  const { owner } = createReaderBuilderProbe(source,
    [...rowNames, 'rowKey', 'view', 'mangaPresentationRevision', 'onViewChanged', 'loadPage'],
    { ...properties.sdk, ...fontFamilies, setTimeout: action => timers.push(action), cacheReaderDirectoryNavigationPage }, hooks);
  const clicks = [];
  Object.assign(owner, { mangaDisplay: true, mangaScheme: 'day', appThemeScheme: 'day', mangaSearchActive: false,
    currentChapterIndex: -1, interactionEnabled: true, mounted: true, generation: 0, selectionGeneration: 0,
    pendingPages: [], bookId: 'book', dataSource: data, captureViewportAnchor() {}, planPosition: () => undefined,
    schedulePosition() {}, toggleNode: node => clicks.push(node), selectTarget() {} });
  data.replace(owner.view);
  const captured = Object.freeze(data.getData(256));
  const key = owner.rowKey(captured);
  owner.mangaRow(captured);
  const records = [...owner.nodes.values()];
  const arrow = records.find(node => node.type === 'Image');
  const title = records.find(node => node.type === 'Text' && node.create === view.nodes[0].title);
  const counter = records.find(node => node.type === 'Text' && node.create === '318 个可读条目');
  const row = records.find(node => node.type === 'Row');
  const actorCount = owner.observers.length;
  assert.equal(arrow.rotate.angle, 0);
  row.onClick(); assert.equal(clicks.at(-1).expanded, true);
  function publish(nextView) {
    owner.updateStateVars({ view: nextView });
    const next = data.loadedItemById('g');
    assert.equal(owner.rowKey(next), key, 'manga group disclosure retains its LazyForEach key');
    properties.flush();
    assert.equal(owner.observers.length, actorCount, 'same mounted group keeps its native actors');
    assert.equal([...owner.nodes.values()].find(node => node.type === 'Image'), arrow, 'rotation updates the same Image');
  }
  publish({ ...view, viewId: 'retained-folded', visibleTotal: 1,
    nodes: [{ ...view.nodes[0], expanded: false, title: '更新后的真实组名', readableDescendantCount: 319 }] });
  assert.equal(arrow.rotate.angle, -90, 'retained SDK Image rotates 0 to -90');
  assert.equal(title.create, '更新后的真实组名'); assert.equal(counter.create, '319 个可读条目');
  assert.equal(row.border.width.top, 1, 'the real rank-zero row carries its scrolling top boundary');
  assert.equal(row.margin.top, 0, 'group spacing reads its new authoritative rank instead of the captured 256');
  row.onClick(); assert.equal(clicks.at(-1).expanded, false, 'second click toggles the live folded node');
  publish({ ...view, viewId: 'retained-unfolded', visibleTotal: 2,
    nodes: [{ ...view.nodes[1] }, { ...view.nodes[0], expanded: true, title: '再次展开后的组名', readableDescendantCount: 320 }] });
  assert.equal(arrow.rotate.angle, 0, 'retained SDK Image rotates -90 back to 0');
  assert.equal(title.create, '再次展开后的组名'); assert.equal(counter.create, '320 个可读条目');
  assert.equal(row.margin.top, 12); assert.equal(row.border.width.top, 0, 'a retained group at rank one never leaves a fixed first-row line');
  row.onClick(); assert.equal(clicks.at(-1).expanded, true);
  const updated = { ...data.loadedItemById('g').node, title: '同视图分页新组名', readableDescendantCount: 321 };
  owner.gateway = { page: async () => ({ viewId: owner.view.viewId, visibleTotal: 2, nodes: [{ ...view.nodes[1] }, updated] }) };
  owner.loadPage(0);
  while (timers.length) timers.shift()();
  await Promise.resolve(); await Promise.resolve();
  properties.flush();
  assert.equal(title.create, updated.title, 'same-view page admission refreshes the retained group title');
  assert.equal(counter.create, '321 个可读条目', 'same-view page admission replaces the bounded cached data');
  assert.equal(owner.observers.length, actorCount);
  row.onClick(); assert.equal(clicks.at(-1).readableDescendantCount, 321);
  const rotations = owner.attributeCalls.filter(call => call.id === arrow.id && call.property === 'rotate').map(call => call.args[0].angle);
  assert.ok(rotations.includes(-90) && rotations.at(-1) === 0);
  const starts = owner.attributeCalls.filter(call => call.id === arrow.id && call.property === 'contextAnimation' && call.args[0] !== null);
  assert.ok(starts.length >= 3 && starts.every(call => call.args[0].duration === 180 && call.args[0].curve === 'ease'),
    'the actual SDK brackets each same-actor rotation update in the demo animation request');
  owner.updateStateVars({ view: { ...view, identity: { ...identity, sourceId: 'different-source' },
    viewId: 'no-current-group', visibleTotal: 1, nodes: [{ ...view.nodes[1] }] } });
  properties.flush();
  const before = clicks.length; row.onClick(); assert.equal(clicks.length, before, 'no current loaded group rejects a retained old click');
  assert.equal(captured.node.expanded, true, 'all transitions exercised an immutable original Builder argument');
}
await checkRetainedGroup(listSource);
const recreatedGroup = listSource.replace(/    if \(this\.mangaDisplay && item\.node\?\.kind === 'group'\)\n      return `reader-navigation:\$\{JSON\.stringify\(\[item\.key, 'manga-group'\]\)\}`;\n/, '');
assert.notEqual(recreatedGroup, listSource);
await assert.rejects(() => checkRetainedGroup(recreatedGroup), /retains its LazyForEach key/);
const capturedGroup = listSource.replaceAll('this.mangaGroupNode(item.node)', 'item.node');
assert.notEqual(capturedGroup, listSource);
await assert.rejects(() => checkRetainedGroup(capturedGroup), /rotates 0 to -90/);
function checkScrollableBoundary(source) {
  const lazy = new Proxy({}, { get: () => () => {} });
  const { owner } = createReaderBuilderProbe(source, ['row', ...rowNames, 'build'], { ...fontFamilies, LazyForEach: lazy });
  Object.assign(owner, { mangaDisplay: true, mangaScheme: 'day', dataSource: {}, listPaddingX: 0,
    listPaddingRight: -1, listPaddingTop: -1, listPaddingBottom: -1, listPaddingY: 0, interactionEnabled: true });
  owner.initialRender();
  assert.equal([...owner.nodes.values()].find(node => node.type === 'List').border, undefined,
    'directory boundary is not attached to the fixed native List viewport');
  for (const height of [58, 50]) {
    const first = rowProbe(source, view.nodes[1], { index: 0, height });
    const later = rowProbe(source, view.nodes[1], { index: 256, height });
    assert.equal(first.row.constraintSize.minHeight, height, 'phone/wide manga row min-height follows its dedicated visual prop');
    assert.equal(first.row.border.width.top, 1); assert.equal(later.row.border.width.top, 0,
      'a virtual page never gains a fake first-row boundary');
  }
}
checkScrollableBoundary(listSource);
function checkCatalogVariants(source) {
  for (const narrow of [false, true]) {
    const current = rowProbe(source, view.nodes[1], { catalog: true, narrow, current: true });
    assert.equal(current.row.constraintSize.minHeight, 48, 'persistent catalog uses its own compact row');
    assert.deepEqual(current.row.padding, { left: narrow ? 20 : 28, right: narrow ? 10 : 15, top: 11, bottom: 11 });
    assert.equal(current.row.border.width.top, 0, 'catalog header owns its divider; catalog tree has no extra top line');
    assert.equal(current.title.fontSize, narrow ? 11 : 12); assert.equal(current.title.lineHeight, 20);
    assert.equal(current.title.fontFamily, fontFamilies.READER_FONT_NOTO_SANS_SC_UI_550);
    assert.equal(current.row.create.space, narrow ? 5 : 12);
    const state = current.nodes.find(node => node.type === 'Text' && node.create === '正在读');
    assert.equal(state.fontSize, narrow ? 8 : 9); assert.equal(state.lineHeight, 17);
    const root = rowProbe(source, { ...view.nodes[1], depth: 1 }, { catalog: true, narrow });
    assert.equal(root.row.padding.left, narrow ? 12 : 15);
    const group = rowProbe(source, view.nodes[0], { catalog: true, narrow });
    assert.equal(group.row.constraintSize.minHeight, 44);
    assert.deepEqual(group.row.padding, { left: 15, right: 15, top: 10, bottom: 10 });
    assert.equal(group.row.border.width.top, 0); assert.equal(group.title.fontSize, 13); assert.equal(group.title.lineHeight, 21);
    const span = group.nodes.find(node => node.type === 'Flex');
    assert.equal(span.create.direction, narrow ? 'FlexDirection.Column' : 'FlexDirection.Row');
    assert.equal(span.create.alignItems, narrow ? 'ItemAlign.Start' : 'ItemAlign.Baseline');
    const counter = group.nodes.find(node => node.type === 'Text' && node.create === '318 个可读条目');
    assert.deepEqual(counter.margin, { left: narrow ? 0 : 9, top: narrow ? 1 : 0 });
  }
  const lazy = new Proxy({}, { get: () => () => {} });
  const properties = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(source,
    ['mangaCatalogDisplay', 'mangaCatalogNarrow', 'row', ...rowNames, 'build'],
    { ...properties.sdk, ...fontFamilies, LazyForEach: lazy }, properties.hooks);
  Object.assign(owner, { mangaDisplay: true, mangaCatalogDisplay: false, mangaCatalogNarrow: false,
    mangaScheme: 'day', dataSource: {}, listPaddingX: 0, listPaddingRight: -1, listPaddingTop: -1,
    listPaddingBottom: -1, listPaddingY: 0, interactionEnabled: true });
  owner.contentStartInset = 0; owner.contentEndInset = 0;
  owner.initialRender();
  const list = [...owner.nodes.values()].find(node => node.type === 'List');
  assert.equal(list.contentEndOffset, 14);
  owner.updateStateVars({ mangaCatalogDisplay: true }); properties.flush();
  assert.equal(list.contentEndOffset, 18, 'retained native List updates catalog bottom clearance without padding its viewport');
  owner.updateStateVars({ mangaCatalogDisplay: false }); properties.flush();
  assert.equal(list.contentEndOffset, 14);
}
checkCatalogVariants(listSource);
const phoneCatalog = listSource.replace('this.mangaCatalogDisplay ? 48 : this.mangaRowMinHeight })', 'this.mangaRowMinHeight })');
assert.notEqual(phoneCatalog, listSource);
assert.throws(() => checkCatalogVariants(phoneCatalog), /own compact row/);
const noNarrowCatalog = listSource.replaceAll('this.mangaCatalogNarrow', 'false');
assert.notEqual(noNarrowCatalog, listSource);
assert.throws(() => checkCatalogVariants(noNarrowCatalog), /deep-equal/);
const fixedTop = listSource.replace("    .width('100%').height('100%')\n    .padding", "    .width('100%').height('100%')\n    .border({ width: { top: 1 } })\n    .padding");
assert.notEqual(fixedTop, listSource);
assert.throws(() => checkScrollableBoundary(fixedTop), /fixed native List viewport/);
const fixedPhoneHeight = listSource.replace("this.mangaCatalogDisplay ? 48 : this.mangaRowMinHeight })", "this.mangaCatalogDisplay ? 48 : 58 })");
assert.notEqual(fixedPhoneHeight, listSource);
assert.throws(() => checkScrollableBoundary(fixedPhoneHeight), /dedicated visual prop/);
for (const scheme of ['day', 'night']) {
  const { nodes, row, title } = rowProbe(listSource, view.nodes[0], { scheme, index: 40 });
  assert.equal(title.fontFamily, fontFamilies.READER_FONT_NOTO_SANS_SC_UI_600); assert.equal(title.fontWeight, 600);
  assert.equal(title.lineHeight, 21); assert.equal(row.create.space, 14);
  assert.equal(row.constraintSize.minHeight, 48); assert.equal(row.margin.top, 12);
  assert.equal(row.border.width.bottom, 0);
  const counter = nodes.find(item => item.type === 'Text' && item.create === '318 个可读条目');
  assert.equal(counter.fontSize, 10); assert.equal(counter.lineHeight, 16); assert.equal(counter.margin.left, 9);
  assert.equal(nodes.find(item => item.type === 'Flex').create.alignItems, 'ItemAlign.Baseline');
  const arrow = nodes.find(item => item.type === 'Image');
  assert.equal(arrow.create, `app.media.manga_sheet_chevron_down${scheme === 'night' ? '_theme_night' : ''}`);
  assert.deepEqual([arrow.width, arrow.height], [16, 16]); assert.equal(arrow.rotate.angle, 0);
  assert.deepEqual(arrow.animation, { duration: 180, curve: 'ease' });
  const folded = rowProbe(listSource, { ...view.nodes[0], expanded: false }, { scheme });
  assert.equal(folded.nodes.find(item => item.type === 'Image').rotate.angle, -90);
  assert.equal(rowProbe(listSource, view.nodes[0], { search: true, index: 40 }).row.margin.top, 0);
  const ordinary = rowProbe(listSource, view.nodes[1], { scheme });
  assert.ok(!ordinary.nodes.some(item => item.type === 'Text' && item.create === '确定卷组'), 'normal rows do not add search-only context');
  const current = rowProbe(listSource, view.nodes[1], { scheme, current: true });
  assert.equal(current.title.fontFamily, fontFamilies.READER_FONT_NOTO_SANS_SC_UI_550); assert.equal(current.title.fontWeight, 400);
  assert.ok(current.nodes.some(item => item.type === 'Text' && item.create === '正在读'));
  assert.ok(!current.nodes.some(item => item.type === 'Image'));
  ordinary.owner.currentChapterIndex = wireChild.chapterIndex;
  ordinary.owner.replay();
  assert.equal(ordinary.title.fontFamily, fontFamilies.READER_FONT_NOTO_SANS_SC_UI_550, 'mounted native title observer switches to the exact fixed 550 face');
  ordinary.owner.currentChapterIndex = -1; ordinary.owner.replay();
  assert.equal(ordinary.title.fontFamily, fontFamilies.READER_FONT_NOTO_SANS_SC_UI_REGULAR, 'same mounted title switches back to fixed 400');
}
// Old declared-dimension tests admitted these regressions. The same actual
// gateway -> SDK native-node assertions reject each old implementation below.
const variableFamily = listSource.replaceAll('TYPE_MANGA_DIRECTORY_TITLE.fontFamily', 'READER_FONT_NOTO_SANS_SC');
assert.notEqual(variableFamily, listSource);
assert.throws(() => checkOrdinary(variableFamily), /ReaderNotoSansSC/);
const indentedSearch = listSource.replace('if (this.mangaSearchActive) return 10;', '');
assert.notEqual(indentedSearch, listSource);
assert.throws(() => checkOrdinary(indentedSearch), /flat row/);
const doubleDepth = listSource.replace('return this.mangaDisplay ? Math.max(1, node.depth) :',
  'return this.mangaDisplay ? node.depth + 1 :');
assert.notEqual(doubleDepth, listSource);
assert.throws(() => checkOrdinary(doubleDepth), /exact child inset/);
const branch = listSource.indexOf("else if (item.node.kind === 'target')");
const arrowStart = listSource.indexOf('Image(', branch);
const arrowEnd = listSource.indexOf('.width(13).height(13);', arrowStart) + '.width(13).height(13);'.length;
assert.ok(branch > 0 && arrowStart > branch && arrowEnd > arrowStart);
const tinyPath = `${listSource.slice(0, arrowStart)}Path().commands('M4 3 L8 6.5 L4 10').width(13).height(13);${listSource.slice(arrowEnd)}`;
assert.throws(() => checkOrdinary(tinyPath), /actual SVG owns its viewBox/);

const scrollNames = ['planPosition', 'positionInitialCurrent', 'positionRowHeight', 'mangaGroupNode', 'mangaGroupSpacing', 'mangaRowIndex', 'mangaRowPaddingLeft'];
function scrollProbe(source, { manga = true, locate = false, anchor, measuredHeight = 83 } = {}) {
  const calls = [];
  const { owner } = createReaderBuilderProbe(source, scrollNames, { readerDirectoryScopeKey,
    readerDirectoryViewportAnchor: () => anchor, ScrollAlign: { START: 'ScrollAlign.START', CENTER: 'ScrollAlign.CENTER' }, LengthMetrics: { vp: value => ({ value }) } });
  Object.assign(owner, { view: { ...view, currentDisplayInset: locate ? 12 : 50,
    currentDisplaySmooth: locate, locateCurrent: locate }, mangaDisplay: manga, mangaSearchActive: false,
    sourceId: 'manga', bookId: 'book', rowHeight: 40, initialPositionPending: true,
    dataSource: { loadedNode: () => view.nodes[0] },
    scroller: { getItemRect: () => ({ height: measuredHeight }), scrollToIndex: (...args) => calls.push(args) } });
  owner.positionInitialCurrent();
  return { owner, calls };
}
function checkOpening(source) {
  assert.deepEqual(scrollProbe(source).calls, [[9, false, 'ScrollAlign.START', { extraOffset: { value: -50 } }]]);
  assert.deepEqual(scrollProbe(source, { locate: true }).calls, [[9, true, 'ScrollAlign.START', { extraOffset: { value: -12 } }]]);
  assert.deepEqual(scrollProbe(source, { manga: false }).calls, [[9, false, 'ScrollAlign.CENTER']]);
  const anchor = { navigationRevision: 's1', viewId: 'v1', visibleIndex: 40, rowFraction: .5 };
  assert.deepEqual(scrollProbe(source, { anchor }).calls, [[40, false, 'ScrollAlign.START', { extraOffset: { value: 41.5 } }]],
    'user anchor restores against the actual natural row height, including group spacing');
}
checkOpening(listSource);
const oldCenter = listSource.replaceAll('align: this.mangaDisplay ? ScrollAlign.START : ScrollAlign.CENTER', 'align: ScrollAlign.CENTER');
assert.notEqual(oldCenter, listSource);
assert.throws(() => checkOpening(oldCenter), /deep-equal/);

const fallbackNames = ['preparePresentation', 'rowPresentation', 'groupSpacing', 'groupExpanded', 'rowFontFamily', 'row', 'mangaColor'];
function fallbackProbe(entries, entry, search = false) {
  const { owner } = createReaderBuilderProbe(fallbackSource, fallbackNames, { ...fontFamilies, readerDirectoryAccessibilityText });
  Object.assign(owner, { admittedEntries: entries, projectedEntries: entries, presentation: new Map(), collapsedGroups: [], query: search ? '话' : '',
    currentChapterIndex: -1, mangaScheme: 'day', rowHeight: 58, selectEntry() {} });
  owner.preparePresentation(); owner.row(entry, 'identity');
  return { owner, nodes: [...owner.nodes.values()] };
}
const canonical = [
  { index: 7, title: '组甲', level: 1, navigable: false },
  { index: 11, title: '第1话', level: 2, navigable: true },
  { index: 17, title: '第2话', level: 2, navigable: true },
  { index: 29, title: '组乙', level: 1, navigable: false },
  { index: 41, title: '第3话', level: 2, navigable: true },
];
{
  const { nodes } = fallbackProbe(canonical, canonical[3]);
  const row = nodes.find(item => item.type === 'Row');
  assert.equal(row.margin.top, 12); assert.equal(row.constraintSize.minHeight, 48); assert.equal(row.border.width.bottom, 0);
  assert.ok(nodes.some(item => item.type === 'Text' && item.create === '1 个可读条目'));
  const { nodes: search } = fallbackProbe(canonical, canonical[1], true);
  assert.ok(search.some(item => item.type === 'Text' && item.create === '组甲'), 'flat query retains parent from complete canonical explicit depth');
  const missingDepth = canonical.map(entry => ({ ...entry, level: undefined }));
  assert.ok(!fallbackProbe(missingDepth, missingDepth[0]).nodes.some(item => item.type === 'Text' && String(item.create).includes('个可读条目')));
  const unknownTarget = canonical.map(entry => ({ ...entry, navigable: entry.index === 11 ? undefined : entry.navigable }));
  assert.ok(!fallbackProbe(unknownTarget, unknownTarget[0]).nodes.some(item => item.type === 'Text' && String(item.create).includes('个可读条目')),
    'unknown target admission never produces a false precise count');
  const disabled = { index: 99, title: '有卷字但没有整卷事实', level: 1, navigable: false };
  const ordinary = fallbackProbe([disabled], disabled).nodes;
  const rowDisabled = ordinary.find(item => item.type === 'Row');
  assert.equal(rowDisabled.constraintSize.minHeight, 58); assert.equal(rowDisabled.border.width.bottom, 1);
  assert.equal(rowDisabled.backgroundColor, 'Color.Transparent');
  const title = ordinary.find(item => item.type === 'Text');
  assert.equal(title.fontWeight, 400); assert.equal(title.fontColor, '#756F69');
  assert.ok(!ordinary.some(item => item.create === '整卷可读'), 'a volume word does not create a semantic fact');
}
function checkFallbackCountRefresh(source) {
  const properties = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(source, [...fallbackNames, 'presentation'],
    { ...properties.sdk, ...fontFamilies, readerDirectoryAccessibilityText }, properties.hooks);
  Object.assign(owner, { admittedEntries: canonical, projectedEntries: [canonical[0]], collapsedGroups: [], query: '组甲',
    currentChapterIndex: -1, mangaScheme: 'day', rowHeight: 58, selectEntry() {} });
  owner.preparePresentation(); owner.row(canonical[0], 'identity');
  const count = [...owner.nodes.values()].find(item => item.type === 'Text' && item.create === '2 个可读条目');
  assert.ok(count);
  const actorCount = owner.observers.length;
  owner.admittedEntries = [canonical[0], canonical[1], canonical[2],
    { index: 23, title: '第新增话', level: 2, navigable: true }, canonical[3], canonical[4]];
  // The visible group row is identical; only its complete-catalog count changed.
  owner.preparePresentation(); properties.flush();
  assert.equal(count.create, '3 个可读条目', 'observed presentation refreshes an unchanged filtered group row');
  assert.equal(owner.observers.length, actorCount, 'count update does not remount the native group actors');
}
checkFallbackCountRefresh(fallbackSource);
const plainCount = fallbackSource.replace('@State private presentation:', 'private presentation:');
assert.notEqual(plainCount, fallbackSource);
assert.throws(() => checkFallbackCountRefresh(plainCount), /observed presentation refreshes/);

async function checkPageRejection(source, closed = false) {
  const invalidations = [], failures = [], unhandled = [];
  const { owner } = createReaderBuilderProbe(source, ['loadPage'], {
    setTimeout: action => action(), cacheReaderDirectoryNavigationPage: (_view, _offset, page) => page });
  Object.assign(owner, { mounted: true, generation: 1, bookId: 'book', interactionEnabled: !closed,
    view: { viewId: 'v1' }, pendingPages: [],
    gateway: { page: async () => { throw new Error('explicit page failure'); } },
    dataSource: { failed: offset => failures.push(offset) }, onInvalidated: () => invalidations.push('invalidated') });
  const capture = error => unhandled.push(error);
  process.on('unhandledRejection', capture);
  try { owner.loadPage(256); await new Promise(done => setImmediate(done)); }
  finally { process.removeListener('unhandledRejection', capture); }
  assert.deepEqual(unhandled, [], 'page rejection handler cannot reference selection-only variables');
  assert.deepEqual(failures, [256]);
  assert.equal(invalidations.length, closed ? 0 : 1);
}
await checkPageRejection(listSource);
await checkPageRejection(listSource, true);
const brokenPage = listSource.replace('this.dataSource.failed(offset);',
  'this.dataSource.failed(offset); if (selection === this.selectionGeneration) this.onInvalidated();');
assert.notEqual(brokenPage, listSource);
await assert.rejects(() => checkPageRejection(brokenPage), /selection-only variables/);

async function checkClosing(source, close = true) {
  let resolve, currentGuard;
  const actions = [], invalidations = [];
  const { owner } = createReaderBuilderProbe(source, ['selectTarget', 'onInteractionChanged'], { setTimeout: action => action() });
  Object.assign(owner, { mounted: true, generation: 3, selectionGeneration: 0, bookId: 'book', interactionEnabled: true,
    view: { viewId: 'v1' }, captureViewportAnchor() {}, pendingPages: [],
    gateway: { resolveTarget(_book, _view, _node, guard) { currentGuard = guard; return new Promise(done => { resolve = done; }); } },
    onSelectTarget: (...args) => actions.push(args), onInvalidated: () => invalidations.push('invalidated') });
  owner.selectTarget({ ...view.nodes[1] });
  assert.ok(currentGuard());
  if (close) { owner.interactionEnabled = false; owner.onInteractionChanged(); assert.equal(currentGuard(), false, 'closing cancels a pending target proof'); }
  resolve({ chapterIndex: 79, chapterOffsetScalar: 0 }); await Promise.resolve(); await Promise.resolve();
  assert.equal(actions.length, close ? 0 : 1, 'a late result cannot navigate after closing');
  assert.deepEqual(invalidations, []);
}
await checkClosing(listSource);
await checkClosing(listSource, false);
const unfencedClose = listSource.replaceAll('this.selectionGeneration += 1;', '')
  .replaceAll('this.interactionEnabled !== false && ', '').replaceAll('this.interactionEnabled === false || ', '');
assert.notEqual(unfencedClose, listSource);
await assert.rejects(() => checkClosing(unfencedClose), /closing cancels/);
console.log('PASS manga directory actual gateway -> SDK parity: fixed 400/550/600 families without VF dependence, Radix SVG, one depth normalization, full-tree metadata, group spacing, flat search, phone58/wide50/catalog48+narrow, content-owned first-rank boundary, 50/12 positioning and preserved native anchors; same native group Image receives 0/-90/0 with live title/count/second click and same-view page admission; fifteen old-implementation negative controls rejected. SDK animation requests verified, compositor frames require VM evidence');

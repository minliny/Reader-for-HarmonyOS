import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"search": {"description": "Search实际List/Scroll内部clearance与stats测量delta", "resources": []}, "source": {"description": "Source List与fixed footer边界/empty slots", "resources": []}, "multi-select": {"description": "多选实际remove footer测量delta保native List", "resources": []}, "directory": {"description": "目录实际header回执传tree/fallback", "resources": []}, "native-insets": {"description": "实际List/Grid单次inset发布/retained Surface传递", "resources": []}, "manga-catalog": {"description": "漫画实际toolbar→tree/flat→native inset闭包", "resources": []}, "search-anchor": {"description": "实际搜索saved anchor/signed offset/native top恢复", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const { readerInteractiveSafeBottom, readerInteractiveSafeTop } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const { readerFloatingBarBottomInset } = await import('./lib/reader-floating-bar-metrics-probe.mjs');
const { mangaGridProbeDependencies, mangaGridBuilderMembers, emptyMangaGridState } = await import('./lib/manga-directory-grid-probe.mjs');
const fonts = await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');


const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const sources = Object.fromEntries(Object.entries({
  search: 'features/search/ui/SearchPage.ets', source: 'features/source/ui/SourceManagementPage.ets',
  multi: 'features/bookshelf/ui/BookshelfMultiSelectPage.ets', directory: 'features/reading/ui/BookDirectoryPage.ets',
  flat: 'features/reading/ui/ReaderDirectoryList.ets', surface: 'features/reading/ui/ReaderDirectoryNavigationSurface.ets',
  tree: 'features/reading/ui/ReaderDirectoryNavigationList.ets',
}).map(([key, path]) => [key, read(path)]));
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const builders = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
for (const source of Object.values(sources)) {
  for (const match of source.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g)) builders.add(match[1]);
}
class Child {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}
for (const [name, props] of Object.entries({
  SearchSpinner: ['active', 'runKey', 'reduceMotion', 'diameter'], SearchResultCard: ['group', 'isTablet', 'cardWidth'],
  ReaderSelectPanel: ['value', 'options', 'variant', 'controlWidth', 'reduceMotion', 'closing', 'selectionId', 'x', 'y'],
  PageBackBar: ['title', 'floating', 'centered'], ReaderDirectoryRules: ['bookId'],
  ReaderDirectoryToolbar: ['text', 'placeholder', 'ascending', 'showChapterTools'],
  ReaderSearchField: ['variant', 'mode', 'text', 'placeholder', 'accessibilityLabel', 'clearable'],
  ReaderDirectoryList: ['entries', 'rowHeight', 'naturalRowHeight', 'listPaddingX', 'listPaddingRight',
    'listPaddingY', 'listPaddingTop', 'listPaddingBottom', 'contentStartInset', 'contentEndInset'],
  ReaderDirectoryNavigationSurface: ['sourceId', 'bookId', 'query', 'ascending', 'currentChapterIndex', 'openRevision',
    'interacted', 'rowHeight', 'mangaDisplay', 'listPaddingX', 'listPaddingRight', 'listPaddingY',
    'listPaddingTop', 'listPaddingBottom', 'contentStartInset', 'contentEndInset'],
  ReaderDirectoryNavigationList: ['view', 'sourceId', 'bookId', 'rowHeight', 'listPaddingX', 'listPaddingY',
    'mangaDisplay', 'mangaCatalogDisplay', 'listPaddingRight', 'listPaddingTop', 'listPaddingBottom',
    'contentStartInset', 'contentEndInset', 'interactionEnabled'],
})) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set(props));
}
for (const [name, slots] of [['PageBackBar', ['trailing']], ['ReaderDirectoryList', ['rowBuilder', 'emptyBuilder']],
  ['ReaderDirectoryNavigationSurface', ['fallbackBuilder']]]) {
  syntax.builderParamObjectCollection.set(name, new Set(slots));
}
const tokens = Object.fromEntries([...read('ui/foundation/ReaderTokens.ets')
  .matchAll(/export const (TOK_\w+)(?:\s*:\s*\w+)?\s*=\s*([\d.]+);/g)].map(m => [m[1], Number(m[2])]));
let metrics = {
  revision: 1, systemFontScale: 1, windowRect: { width: 390, height: 844 },
  systemInsets: { left: 0, right: 0, bottom: 34 }, cutoutInsets: {}, gestureInsets: {}, navigationInsets: {},
};
const lazy = { create(_id, _owner, data, generator) {
  for (let index = 0; index < data.totalCount(); index++) generator(data.getData(index));
}, pop() {} };
const deps = {
  readerRecoveryView,
  ...mangaGridProbeDependencies, ...fonts, ReaderSearchField: Child,
  ...tokens, LazyForEach: lazy, ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
  Repeat: function Repeat(items) { return {
    each(generator) { this.generator = generator; return this; }, key() { return this; }, virtualScroll() { return this; },
    render() { items.forEach((item, index) => this.generator({ item, index })); },
  }; },
  ReaderWindowCoordinator: { metrics: () => metrics }, readerFloatingBarBottomInset,
  readerInteractiveSafeBottom, readerInteractiveSafeTop,
  SearchSpinner: Child, SearchResultCard: Child, PageBackBar: Child, ReaderDirectoryRules: Child,
  ReaderSelectPanel: Child,
  ReaderDirectoryToolbar: Child, ReaderDirectoryList: Child, ReaderDirectoryNavigationSurface: Child,
  ReaderDirectoryNavigationList: Child, ReaderRuntimeOwner: { current: () => ({ supportsCoreCapability: () => false }) },
  ListItemAlign: { Center: 'center' }, GRID_ROW_GAP: 12, GRID_COLUMN_GAP: 30,
};
const properties = createArkUIPropertyRuntimeProbe();
Object.assign(deps, properties.sdk);
const footerSource = read('features/manga/ui/MangaDirectoryCurrentFooter.ets');
const popupSource = read('features/manga/ui/ReaderMangaDownloadPopup.ets');
deps.MangaDirectoryCurrentFooter = createReaderBuilderProbe(footerSource, boundedMembers(footerSource), deps, properties.hooks).Component;
deps.ReaderMangaDownloadPopup = Child;
const hooks = { ...properties.hooks, childSources: { MangaDirectoryCurrentFooter: footerSource,
  ReaderMangaDownloadPopup: popupSource }, mountChildren: true };
const nodes = owner => [...owner.nodes.values()];
const allNodes = owner => [...(owner.nodes?.values() ?? []), ...[...(owner.children?.values() ?? [])].flatMap(allNodes)];
function fixture(key, names, values = {}) {
  const selected = key === 'search' ? [...names, 'operation', 'retryOperation', 'filteredEmptyMessage', 'searchHeader', 'resultStats', 'searchActivity'] : key === 'source' ? [...names, 'recovery'] : names;
  const { owner } = createReaderBuilderProbe(sources[key], selected, deps, hooks);
  for (const match of sources[key].matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g)) {
    if (typeof owner[match[1]] !== 'function') owner[match[1]] = () => {};
  }
  Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, selectedGroupName:'全部', selectedContentType:'全部类型',
    contentFrame: () => ({ left: 42, right: 18, width: 330 }), numericAreaLength: value => Number(value),
    ...(key === 'source' ? { operation: { action: 'load', sourceId: '' } } : {}), ...values });
  return owner;
}
function fullList(owner) {
  const list = nodes(owner).find(node => node.type === 'List');
  assert.ok(list, 'the actual SDK Builder emits a native List');
  assert.equal(list.height, '100%');
  assert.equal(list.layoutWeight, undefined, 'a floating bar cannot consume the List height budget');
  assert.equal(list.padding?.top ?? 0, 0, 'top clearance belongs to scroll content rather than viewport padding');
  assert.equal(list.padding?.bottom ?? 0, 0, 'bottom clearance belongs to scroll content rather than viewport padding');
  return list;
}

if(selectedCase==='search') {
for (const isTablet of [false, true]) {
  const owner = fixture('search', ['build', 'stateContent', 'resultsContent', 'searchHeaderHeight', 'searchBottomInset'], {
    presentation: { kind: 'results', searching: false, failedSourceCount: 0 }, isTablet, resultStatsHeight: 28.5,
    visibleGroups: [], groupNames: () => ['在线'], resultDataSource: { totalCount: () => 0 },
    resultScroller: {}, isSweeping: () => false,
  });
  owner.initialRender();
  const list = fullList(owner);
  // Results with an available source group render both the source and
  // content-type filter rows; keep the list/statistics offsets below the
  // complete two-row header so the overlap regression stays covered.
  const initialStart = list.contentStartOffset;
  assert.ok(initialStart > owner.resultStatsHeight);
  assert.equal(list.contentEndOffset, metrics.systemInsets.bottom);
  const header = allNodes(owner).find(n => n.type === 'Column' && n.zIndex === 10 && n.onAreaChange);
  assert.ok(header, 'compound search/filter/statistics mount the actual common fixed-header host');
  assert.equal(header.hitTestBehavior, 'HitTestMode.Transparent');
  assert.match(header.backgroundColor, /^#FF/, 'the entire compound header masks scrolling rows');
  const stats = nodes(owner).find(n => n.type === 'Flex' && n.onAreaChange);
  assert.ok(stats, 'wrapping statistics remain in the actual compound header content');
  assert.equal(stats.create.wrap, 'FlexWrap.Wrap', 'large-font statistics reflow inside the same public header');
  assert.equal(stats.position, undefined, 'statistics flow with filters inside the shared measured header');
  assert.equal(stats.zIndex, undefined, 'statistics do not create a private overlay layer');
  stats.onAreaChange({}, { height: 52 });
  owner.replayOnly([list.id]);
  assert.equal(list.contentStartOffset-initialStart, 52-28.5, 'only measured statistics delta changes the retained List clearance');
  stats.onAreaChange({}, { height: NaN });
  assert.equal(owner.resultStatsHeight, 52);
}
for (const kind of ['initial', 'sourceRequired', 'sourceLoadError', 'empty', 'error']) {
  metrics = { ...metrics, systemInsets: { bottom: 76 } };
  const owner = fixture('search', ['build', 'stateContent', 'initialContent', 'emptyContent', 'errorContent',
    'searchHeaderHeight', 'searchBottomInset', 'sourceRequiredReason'], {
    presentation: { kind, keyword: '书', history: [], historyStatus: 'ready', searchedSourceCount: 2 },
    isTablet: false, groupNames: () => [], isSweeping: () => false, partialSearchFailure: () => '',
    searchFailureTitle: () => '搜索失败', searchFailureMessage: () => '', isStoppedEmpty: () => false,
  });
  owner.initialRender();
  const scroll = nodes(owner).find(n => n.type === 'Scroll');
  assert.ok(scroll, `${kind} remains scrollable in a short window`);
  assert.equal(scroll.height, '100%');
  assert.equal(scroll.padding?.top ?? 0, 0, 'the Scroll viewport extends underneath the header');
  assert.ok(nodes(owner).some(n => n.type === 'Column' && n.padding?.bottom === 76),
    `${kind} puts system bottom clearance in its scrolling child`);
}
metrics = { ...metrics, systemInsets: { bottom: 34 } };
}

if(selectedCase==='source') for (const sourceCount of [0, 2]) {
  const items = Array.from({ length: sourceCount }, (_, i) => ({ sourceId: `source-${i}` }));
  const owner = fixture('source', ['build', 'sourceList', 'bottomActionBar', 'actionBottomInset'], {
    sources: items, statusKind: 'idle', groupOpen: false,
    sourceDataSource: { totalCount: () => items.length, getData: i => items[i] }, sourceRenderKey: source => source.sourceId,
  });
  owner.initialRender();
  const list = fullList(owner);
  assert.ok(list.contentStartOffset > 0);
  const footer = nodes(owner).find(n => n.type === 'Column' && typeof n.height==='number' && n.height===list.contentEndOffset);
  const footerLayer = allNodes(owner).find(n => n.type === 'Stack' && n.zIndex === 20);
  assert.ok(footer && footerLayer, 'source actions use the shared frame bottom layer');
  assert.equal(footerLayer.create.alignContent, 'Alignment.Bottom');
  assert.deepEqual(footer.padding, { left: 42, right: 18 }, 'footer keeps asymmetric safe edges aligned with the List');
  assert.equal(footer.hitTestBehavior, 'HitTestMode.Transparent');
  assert.equal(nodes(owner).filter(n => n.type === 'ListItem').length, sourceCount === 0 ? 2 : sourceCount + 1,
    'empty help or populated rows follow the scrolling filter header');
  for (const item of nodes(owner).filter(n => n.type === 'ListItem')) {
    const realize = Array.isArray(item.create) ? item.create[0] : item.create;
    if (typeof realize === 'function') realize(item.id, true);
  }
  assert.equal(allNodes(owner).some(n => n.type === 'Text' && n.create === '暂无书源'), sourceCount === 0,
    JSON.stringify(nodes(owner).filter(n => n.type === 'Text').map(n => ({ id: n.id, create: n.create }))));
}

if(selectedCase==='multi-select') {
const pageGeometry = await import('../entry/src/main/ets/ui/layout/ReaderPageGeometry.ts');
const scrollGeometry = await import('../entry/src/main/ets/ui/layout/ReaderScrollLayout.ts');
const { readerFrameStyle } = await import('../entry/src/main/ets/ui/layout/ReaderFrameStyle.ts');
const { ReaderMeasurementStore } = await import('../entry/src/main/ets/ui/layout/ReaderMeasurements.ts');
Object.assign(deps, pageGeometry, scrollGeometry, { readerFrameStyle, ReaderMeasurementStore, ButtonType: { Normal: 'ButtonType.Normal' } });
let cancels = 0, selects = 0;
const multi = fixture('multi', ['build', 'selectionTopBar', 'selectionAction', 'removeBar', 'removeBarClearance', 'bottomInset',
  'geometry', 'measurementKey', 'measurementRevision', 'measurements', 'viewportWidth', 'viewportHeight', 'mounted',
  'frameStyle', 'onGeometryInputsChanged', 'recordMeasurement', 'refreshGeometry', 'scrollLayout', 'liveWidth'], {
  mounted: true, selectedKeys: [], busy: false, ready: true, bookRows: () => [],
  onCancel: () => cancels++, toggleAll: () => selects++,
  allSelected: () => false, bookKey: () => '', isListMode: () => false,
  __Repeat() { return { each() { return this; }, key() { return this; }, virtualScroll() { return this; }, render() {} }; },
});
multi.onGeometryInputsChanged();
multi.initialRender();
const multiList = fullList(multi);
assert.ok(multiList.contentStartOffset > 0);
const removeHost = allNodes(multi).find(n => n.type === 'Column' && n.onAreaChange && n.padding?.left === 0 && n.padding?.right === 0);
assert.ok(removeHost);
assert.equal(removeHost.height, undefined, 'the footer can grow naturally with scaled or wrapped labels');
assert.equal(allNodes(multi).find(n => n.type === 'Stack' && n.zIndex === 20).hitTestBehavior, 'HitTestMode.Transparent');
const footerKey = multi.measurementKey;
removeHost.onAreaChange({}, { height: 116 });
multi.replayOnly([multiList.id]);
const firstMeasuredEnd=multiList.contentEndOffset;
removeHost.onAreaChange({}, {height:173}); multi.replayOnly([multiList.id]);
assert.equal(multiList.contentEndOffset-firstMeasuredEnd, 173-116, 'measured footer delta updates retained clearance without shrinking List');
assert.equal(multiList.contentEndOffset, multi.geometry.content.endInset);
const scaffold = nodes(multi).find(n => n.onAreaChange);
assert.ok(scaffold, 'the root scaffold publishes its actual viewport');
scaffold.onAreaChange({}, { width: 760, height: 390 });
const newLayout = multi.geometry;
assert.deepEqual([multi.viewportWidth, multi.viewportHeight], [760, 390]);
assert.ok(Number.isFinite(newLayout.revision));
multi.recordMeasurement('selection:footer', 200, footerKey);
assert.equal(multi.geometry.revision, newLayout.revision, 'a retired footer receipt cannot change the new layout');
const cancel = nodes(multi).find(n => n.type === 'Button' && n.accessibilityText === '取消');
const select = nodes(multi).find(n => n.type === 'Button' && n.accessibilityText === '全选');
assert.deepEqual([cancel.height, select.height], [44,44]);
cancel.onClick(); select.onClick();
multi.busy = true;
cancel.onClick(); select.onClick();
multi.busy = false;
multi.mounted = false;
cancel.onClick(); select.onClick();
assert.deepEqual([cancels, selects], [1,1], 'native button callbacks still check the current owner and busy state');
}

if(selectedCase==='directory') {
  registerHooks({resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier+'.ts', context);
      throw error;
    }
  }});
  const [pageGeometry, frame, measurements, widthClass, metricsApi, positioning, snapshots, projection, recovery] =
    await Promise.all([
      import('../entry/src/main/ets/ui/layout/ReaderPageGeometry.ts'),
      import('../entry/src/main/ets/ui/layout/ReaderFrameStyle.ts'),
      import('../entry/src/main/ets/ui/layout/ReaderMeasurements.ts'),
      import('../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts'),
      import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts'),
      import('../entry/src/main/ets/features/reading/ui/ReaderControlListPositioning.ts'),
      import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts'),
      import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryProjection.ts'),
      import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts'),
    ]);
  const panelSource = read('features/reading/ui/FullDirectoryPanel.ets');
  const fullSource = read('features/reading/ui/ReaderFullDirectory.ets');
  const directoryDeps = {
    ...deps, ...pageGeometry, ...frame, ...measurements, ...widthClass, ...metricsApi, ...positioning, ...snapshots, ...projection,
    ...recovery, registerReaderFonts() {}, fullDirectoryBackGeneration: 0,
    BOOKMARK_ROW_HEIGHT: Number(read('features/reading/ui/ReaderBookmarkRow.ets').match(/BOOKMARK_ROW_HEIGHT = (\d+)/)[1]),
    ReaderRuntimeOwner: { current: () => ({ supportsCoreCapability: () => false }) },
    ReaderDirectoryRecoverySurface: Child, ReaderDirectoryChapterRow: Child,
  };
  const directoryHooks = { ...hooks, lifecycleChildren: true, childSources: {
    ...hooks.childSources, FullDirectoryPanel: panelSource, ReaderDirectoryList: sources.flat,
    ReaderDirectoryNavigationSurface: sources.surface,
    ReaderDirectoryRecoverySurface: read('features/reading/ui/ReaderDirectoryRecoverySurface.ets'),
    ReaderDirectoryToolbar: read('features/reading/ui/ReaderDirectoryToolbar.ets'),
    ReaderDirectoryChapterRow: read('features/reading/ui/ReaderDirectoryChapterRow.ets'),
    ReaderDirectoryRules: read('features/reading/ui/ReaderDirectoryRules.ets'),
  } };
  const Panel = createReaderBuilderProbe(panelSource, boundedMembers(panelSource), directoryDeps, directoryHooks).Component;
  const { owner: directory } = createReaderBuilderProbe(fullSource, boundedMembers(fullSource), {
    ...directoryDeps, FullDirectoryPanel: Panel,
  }, { ...directoryHooks, initialParams: {
    sourceId: 'source', bookId: 'book', bookTitle: '目录', catalogContext: 'detail', reduceMotion: true,
    entries: [{ index: 7, title: '原始章节', navigable: true }], bookmarkIdentity: { sourceId: 'source', bookId: 'book' },
  } });
  directory.aboutToAppear();
  directory.initialRender();
  const viewport = nodes(directory).find(node => node.onAreaChange);
  assert.ok(viewport, 'actual directory wrapper measures its available viewport');
  viewport.onAreaChange({}, { width: '365vp', height: '650vp' });
  properties.flush();
  const walk = owner => [owner, ...[...owner.children.values()].filter(child => child.nodes).flatMap(walk)];
  const panel = walk(directory).find(child => child instanceof Panel);
  assert.ok(panel && panel.allowUnanchoredBrowse);
  assert.ok([...panel.children.values()].some(child => child.params.showChapterTools),
    'search and sort share the bounded panel with its lists');
  const tree = [...panel.children.values()].find(child => child.params.chapterEntries);
  assert.ok(tree, 'actual panel exposes the canonical tree boundary');
  tree.params.fallbackBuilder();
  const flat = [...panel.children.values()].find(child => child.params.entries);
  assert.ok(flat, 'the same panel exposes its retained flat fallback');
  const scroller = tree.params.scroller, treeEntries = tree.params.chapterEntries, flatEntries = flat.params.entries;
  assert.equal(flat.params.scroller, scroller);
  assert.deepEqual(flatEntries.map(entry => entry.index), [7]);
  for (const child of [tree, flat]) {
    assert.equal(child.params.scrollLayout?.startInset ?? 0, 0, 'external header clearance is applied at the panel boundary');
    assert.equal(child.params.scrollLayout?.endInset ?? 0, 0, 'external safe bottom is already reserved by the panel host');
  }
  assert.equal(flat.params.listPaddingY, tree.params.listPaddingY);
  const header = walk(directory).find(actor => actor.style !== undefined && typeof actor.onHeightChange === 'function');
  assert.ok(header, 'one actual shared HeaderHost publishes measured title height');
  const headerArea = nodes(header).find(node => node.onAreaChange);
  assert.ok(headerArea);
  const body = nodes(directory).find(node => node.type === 'Stack' && node.position?.y === directory.panelTop() &&
    node.height === panel.panelHeightOverride);
  assert.ok(body, 'a positioned and bounded panel owns both list branches below the header');
  headerArea.onAreaChange({}, { height: '72vp' }); properties.flush();
  const measuredTop = body.position.y, measuredHeight = panel.panelHeightOverride;
  headerArea.onAreaChange({}, { height: 105 }); properties.flush();
  assert.equal(body.position.y - measuredTop, 33);
  assert.equal(measuredHeight - panel.panelHeightOverride, 33, 'measured title delta shrinks the same panel viewport exactly once');
  assert.equal(body.position.y + panel.panelHeightOverride, 650 - 34, 'the same measured host reserves the safe bottom');
  assert.equal(walk(directory).find(child => child instanceof Panel), panel);
  assert.equal(panel.children.get(tree.id), tree);
  assert.equal(panel.children.get(flat.id), flat);
  assert.equal(tree.params.chapterEntries, treeEntries);
  assert.equal(flat.params.entries, flatEntries);
  assert.equal(flat.params.scroller, scroller);
  headerArea.onAreaChange({}, { height: 0 }); properties.flush();
  assert.equal(body.position.y, measuredTop + 33, 'transient zero layout cannot erase admitted title clearance');
  panel.aboutToDisappear();
  directory.aboutToDisappear();
}

function nativeDirectoryFixture(key, values = {}) {
  const empty = emptyMangaGridState();
  const owner = fixture(key, key === 'flat' ? ['build', 'rowBuilder', 'emptyBuilder', 'emptyContent', 'probeGeometry'] :
    ['build', ...mangaGridBuilderMembers, 'mangaColor'], {
    ...empty, mangaPresentationRevision: 0, entries: [], dataSource: { ...empty.dataSource, totalCount: () => 0 }, rowHeight: 40, itemSizes: {},
    contentStartInset: values.mangaDisplay ? 0 : 273, contentEndInset: values.mangaDisplay ? 0 : 39, listPaddingX: 10, listPaddingRight: -1,
    listPaddingY: 0, listPaddingTop: -1, listPaddingBottom: -1,
    naturalRowHeight: false, mangaDisplay: false, mangaCatalogDisplay: false,
    interactionEnabled: true, mangaScheme: '', ...values,
  });
  owner.initialRender();
  const list = key === 'tree' && values.mangaDisplay ? nodes(owner).find(node => node.type === 'Grid') : fullList(owner);
  assert.ok(list); assert.equal(list.height, '100%');
  return { owner, list };
}
function assertSingleOffsetPublication(owner, list, after = 0) {
  const calls = owner.attributeCalls.slice(after).filter(call => call.id === list.id);
  for (const property of ['contentStartOffset', 'contentEndOffset']) {
    assert.equal(calls.filter(call => call.property === property).length, 1,
      `${property} publishes once per native List update without a later reset`);
  }
}
if(selectedCase==='native-insets') {
for (const key of ['flat', 'tree']) {
  const { owner, list } = nativeDirectoryFixture(key);
  assert.equal(list.contentStartOffset, 273);
  assert.equal(list.contentEndOffset, 39);
  assertSingleOffsetPublication(owner, list);
  const before = owner.attributeCalls.length;
  owner.contentStartInset = 114; owner.contentEndInset = 51;
  owner.replayOnly([list.id]);
  assert.equal(fullList(owner).id, list.id, 'text inset changes retain the original native List');
  assert.equal(list.contentStartOffset, 114);
  assert.equal(list.contentEndOffset, 51);
  assertSingleOffsetPublication(owner, list, before);
}
for (const explicitPadding of [false, true]) {
  const { owner, list } = nativeDirectoryFixture('flat', {
    naturalRowHeight: true, listPaddingY: 8,
    listPaddingTop: explicitPadding ? 248 : -1, listPaddingBottom: explicitPadding ? 106 : -1,
  });
  assert.equal(list.childrenMainSize, undefined, 'natural manga rows do not adopt fixed virtual text extents');
  assert.equal(list.contentStartOffset, explicitPadding ? 248 : 8);
  assert.equal(list.contentEndOffset, explicitPadding ? 106 : 8);
  assertSingleOffsetPublication(owner, list);
  const before = owner.attributeCalls.length;
  owner.listPaddingTop = 280; owner.listPaddingBottom = 120;
  owner.replayOnly([list.id]);
  assert.equal(fullList(owner).id, list.id, 'manga padding changes retain the original native List');
  assert.equal(list.contentStartOffset, 280);
  assert.equal(list.contentEndOffset, 120);
  assertSingleOffsetPublication(owner, list, before);
}

}

// The complete manga catalog owns both its overlay geometry and the payload
// sent to the paged tree and its flat fallback. Exercise that producer before
// mounting each actual native List, so a missing footer gap cannot be hidden by
// a manually chosen child inset.
if(selectedCase==='manga-catalog') for (const [safeTop, safeBottom] of [[0, 0], [48, 34], [10, 80]]) {
  metrics = { ...metrics, systemInsets: { left: 0, right: 0, top: safeTop, bottom: safeBottom } };
  const entries = [{ index: 7, title: '第七话', navigable: true }];
  let rawMangaOffset = 0;
  const nativeMangaScroller = { currentOffset: () => ({ xOffset: 0, yOffset: rawMangaOffset }) };
  const catalog = fixture('directory', ['build', 'mangaPage', 'mangaToolbar', 'mangaFlatList', 'mangaEmptyState', 'mangaDownloadMenuButton',
    'mangaCurrentFooter', 'mangaFlowFooter', 'mangaVisibleTopInset', 'mangaNarrow', 'mangaContentTopInset', 'mangaFontScale', 'mangaToolHeight', 'mangaFooterHeight', 'mangaBottomInset', 'mangaFooterBottomOffset', 'mangaBottomClearance', 'mangaListBottomClearance', 'mangaSortIcon', 'headerFrame', 'onMangaScrollOffset', 'directoryListIsCurrent', 'identity', 'topInset', 'bottomInset'], {
    contentKind: 'manga', sourceId: 'source', bookId: 'book', admittedIdentity: 'source\u0000book',
    mounted: true, navigationActive: false,
    admittedEntries: entries, projectedEntries: entries, rulesRevision: 0, currentChapterIndex: 7,
    locateCurrentRevision: 0, navigationInteracted: false, mangaDownloadEnabled: false,
    bookTitle: '漫画', searchDraft: '', searchQuery: '', ascending: true,
    mangaToolsHeight: 175, mangaViewportHeight: 844, viewportWidth: 390, mangaFontsReady: true,
    mangaScrollOffset: 0, mangaFooterMeasured: 0, listScroller: nativeMangaScroller,
    mangaLayoutEntries: () => entries, mangaSummaryLabel: () => '1 个可读条目', mangaCurrentTitle: () => '第七话', mangaCurrentPosition: () => '1 / 20',
  });
  catalog.initialRender();
  const treeChild = [...catalog.children.values()].find(child => child.params.chapterEntries);
  assert.ok(treeChild, 'manga dispatch publishes the tree catalog');
  treeChild.params.fallbackBuilder();
  const flatChild = [...catalog.children.values()].find(child => child.params?.entries);
  assert.ok(flatChild, 'the actual manga fallback publishes its natural-row List');
  const toolbar = nodes(catalog).find(node => node.type === 'Column' && node.position && typeof node.onAreaChange === 'function');
  const footer = allNodes(catalog).find(node => node.type === 'Column' && typeof node.padding?.bottom==='number' && node.padding.bottom>=safeBottom);
  const frame = [...catalog.children.values()].find(child => child.params?.variant === 'mangaDirectory');
  const actualFooter = [...catalog.children.values()].find(child => child.nodes && child.availableWidth === 330);
  assert.ok(actualFooter, 'the real shared footer supplies the full catalog clearance contract');
  assert.ok(nodes(actualFooter).some(node=>node.accessibilityText==='当前阅读位置')); 
  assert.ok(toolbar); assert.ok(footer);
  assert.ok(toolbar.position.y>=safeTop && footer.padding.bottom>=safeBottom);
  assert.equal(footer.clip, true);
  const toolbarEnd = toolbar.position.y + catalog.mangaToolsHeight;
  assert.ok(frame.params.contentEndInset>=catalog.mangaFooterHeight()+footer.padding.bottom,'clipped viewport clears actual fixed dock');
  for (const [key, child] of [['tree', treeChild], ['flat', flatChild]]) {
    assert.equal(child.params.listPaddingTop, toolbarEnd, `${key} first row clears the measured floating tools`);
    assert.ok(child.params.listPaddingBottom < frame.params.contentEndInset,`${key} tail does not reserve the entire dock twice`);
    const { owner, list } = nativeDirectoryFixture(key, child.params);
    if (key === 'tree') {
      assert.equal(list.padding.top, 0);
      assert.equal(list.contentStartOffset, child.params.listPaddingTop);
      assert.equal(list.padding.bottom, 0);
      assert.equal(list.contentEndOffset, child.params.listPaddingBottom,
        'full catalog consumes exactly the parent footer clearance; the14vp scroll tail belongs only to quick display');
      const calls = owner.attributeCalls.filter(call => call.id === list.id);
      assert.equal(calls.filter(call => call.property === 'padding').length, 1, 'Grid publishes its supported padding once');
      assert.equal(calls.filter(call => ['contentStartOffset', 'contentEndOffset'].includes(call.property)).length, 2);
    } else {
      assert.equal(list.contentStartOffset, child.params.listPaddingTop);
      assert.equal(list.contentEndOffset, child.params.listPaddingBottom);
      assertSingleOffsetPublication(owner, list);
      assert.equal(list.create.scroller, nativeMangaScroller, 'actual native fallback List uses the unchanged BookPage Scroller');
      for (const displacement of [0, -7, 93]) {
        rawMangaOffset = -list.contentStartOffset + displacement;
        list.onDidScroll(999, 'ScrollState.Scroll');
        assert.equal(catalog.mangaScrollOffset, displacement, 'actual List did-scroll reads Scroller raw origin and reaches BookPage normalized chrome');
      }
    }
  }
  toolbar.onAreaChange({}, { height: 209 });
  catalog.replayOnly([treeChild.id, flatChild.id]);
  assert.equal(treeChild.params.listPaddingTop-toolbarEnd,209-175);
  assert.equal(flatChild.params.listPaddingTop,treeChild.params.listPaddingTop,'both retained owners receive wrapped toolbar delta');
}
if(selectedCase==='native-insets') {
metrics = { ...metrics, systemInsets: { left: 0, right: 0, bottom: 34 } };
const surface = fixture('surface', ['build', 'fallbackBuilder'], { view: { visibleTotal: 1 }, contentStartInset: 273, contentEndInset: 39 });
surface.initialRender();
const nativeTree = [...surface.children.values()][0];
assert.equal(nativeTree.params.contentStartInset, 273);
assert.equal(nativeTree.params.contentEndInset, 39);
surface.contentStartInset = 114;
surface.replayOnly([nativeTree.id]);
assert.equal(nativeTree.params.contentStartInset, 114, 'retained navigation Surface passes inset updates through to its native List');

}
if(selectedCase==='search-anchor') {
// A previously saved positive first-row y is valid after adding internal
// header clearance. The actual restore method must not force that row to y=0.
const frames = [], moves = [];
const Restore = selectedProductionMethods(new URL('features/search/ui/SearchPage.ets', root), 'SearchPage',
  ['scheduleScrollRestore', 'searchHeaderHeight', 'searchFontScale', 'searchFilterHeight', 'searchFilterLabelWidth', 'searchBarHeight', 'selectGroup'], {
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) },
    SearchLayoutFrame: class { constructor(action) { this.action = action; } }, ScrollAlign: { START: 0 }, Edge: { Top: 'top' },
  });
const restoring = Object.assign(new Restore(), { pageMounted: true, listMounted: true, restoreCancelled: false,
  restoreScheduled: false, restoreEpoch: 0, pageEpoch: 1, listEpoch: 1,
  viewState: { revision: 1, pageRevision: 1, anchorNeighbors: [], resolveKey: key => key },
  restoreKey: 'book', restoreItemY: 122, visibleGroups: [{ book: {} }], resultGroupKey: () => 'book',
  presentation: { kind: 'results' }, isTablet: false, groupNames: () => ['在线'], resultStatsHeight: 28.5,
  getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }), saveScrollAnchor() {}, refreshVisibleResults() {},
  resultScroller: { scrollToIndex: index => moves.push(['index', index]),
    getItemRect: () => ({ y: 122, height: 150 }), scrollBy: (_x, y) => moves.push(['by', y]),
    scrollTo: offset => moves.push(['offset', offset.yOffset]), scrollEdge: edge => moves.push(['edge', edge]) },
});
restoring.scheduleScrollRestore();
frames.shift().action(); frames.shift().action();
assert.deepEqual(moves, [['index', 0], ['by', 0]], 'initial row restores below the floating header rather than underneath it');
moves.length = 0;
restoring.selectGroup('在线');
assert.deepEqual(moves, [['edge', 'top']], 'category reset keeps contentStartOffset by using the native top edge');
assert.equal(restoring.restoreKey, '');
assert.equal(restoring.viewState.anchorKey, '');
for (const offset of [0, -30, -122, 137]) {
  moves.length = 0;
  restoring.restoreOffset = offset;
  restoring.scheduleScrollRestore();
  frames.shift().action();
  assert.deepEqual(moves, offset !== 0 ? [['offset', offset]] : [['edge', 'top']],
    'fresh/default zero retains native top clearance, while saved negative and positive offsets restore unchanged');
}
}
console.log('selected floating content case PASS: '+selectedCase);

}

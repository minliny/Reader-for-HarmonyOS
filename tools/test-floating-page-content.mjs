import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"search": {"description": "Search实际List/Scroll内部clearance与stats测量delta", "resources": []}, "source": {"description": "Source List与fixed footer边界/empty slots", "resources": []}, "multi-select": {"description": "多选实际remove footer测量delta保native List", "resources": []}, "directory": {"description": "目录实际header回执传tree/fallback", "resources": []}, "native-insets": {"description": "实际List/Grid单次inset发布/retained Surface传递", "resources": []}, "manga-catalog": {"description": "漫画实际toolbar→tree/flat→native inset闭包", "resources": []}, "search-anchor": {"description": "实际搜索saved anchor/signed offset/native top恢复", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const sourceCategory = await import('../entry/src/main/ets/features/source/ReaderSourceCategory.ts');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const { readerInteractiveSafeBottom, readerInteractiveSafeTop } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { readerFloatingBarBottomInset } = await import('./lib/reader-floating-bar-metrics-probe.mjs');
const { mangaGridProbeDependencies, mangaGridBuilderMembers, emptyMangaGridState } = await import('./lib/manga-directory-grid-probe.mjs');
const fonts = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { labeledIconControls } = await import('./lib/reader-labeled-icon-action-probe.mjs');
const { inlineSelectSdk } = await import('./lib/reader-inline-select-sdk-probe.mjs');
const { ReaderMeasurementStore } = await import('../entry/src/main/ets/features/common/ReaderMeasurements.ts');
const surfaceGeometry = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const widthClass = await import('../entry/src/main/ets/features/common/ReaderWidthClass.ts');
const searchResultGeometry = await import('../entry/src/main/ets/features/search/SearchResultGeometry.ts');


const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const scrollModule = pureModuleProbe(read('features/common/ReaderScrollLayout.ts'), 'ReaderScrollLayout.ts', {},
  ['ReaderScrollLayout', 'readerScrollLayout', 'readerScrollStartOffset', 'readerScrollEndOffset']);
const geometryModule = pureModuleProbe(read('features/common/ReaderPageGeometry.ts'), 'ReaderPageGeometry.ts', {
  readerPresentedHeaderBottom: (top, height) => top + height,
  readerVisualSafeLeft: () => 0, readerVisualSafeRight: () => 0, ...surfaceGeometry, ...widthClass,
}, ['ReaderPageGeometry', 'ReaderPageGeometryInput', 'resolveReaderPageGeometry']);
const resolverModule = pureModuleProbe(read('features/common/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {},
  ['readerReadableFontScale']);
const sourceLayoutModule = pureModuleProbe(read('features/source/SourceManagementLayout.ts'), 'SourceManagementLayout.ts',
  { readerReadableFontScale: resolverModule.readerReadableFontScale }, ['resolveSourceManagementLayout']);
const labeledFoundation = labeledIconControls();
const sources = Object.fromEntries(Object.entries({
  search: 'features/search/SearchPage.ets', source: 'features/source/SourceManagementPage.ets',
  multi: 'features/bookshelf/BookshelfMultiSelectPage.ets', directory: 'features/bookshelf/BookDirectoryPage.ets',
  flat: 'features/reading/ReaderDirectoryList.ets', surface: 'features/reading/ReaderDirectoryNavigationSurface.ets',
  tree: 'features/reading/ReaderDirectoryNavigationList.ets',
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
    'listPaddingY', 'listPaddingTop', 'listPaddingBottom', 'scrollLayout', 'contentStartInset', 'contentEndInset'],
  ReaderDirectoryNavigationSurface: ['sourceId', 'bookId', 'query', 'ascending', 'currentChapterIndex', 'openRevision',
    'interacted', 'rowHeight', 'mangaDisplay', 'listPaddingX', 'listPaddingRight', 'listPaddingY',
    'listPaddingTop', 'listPaddingBottom', 'scrollLayout', 'contentStartInset', 'contentEndInset'],
  ReaderDirectoryNavigationList: ['view', 'sourceId', 'bookId', 'rowHeight', 'listPaddingX', 'listPaddingY',
    'mangaDisplay', 'mangaCatalogDisplay', 'listPaddingRight', 'listPaddingTop', 'listPaddingBottom',
    'scrollLayout', 'contentStartInset', 'contentEndInset', 'interactionEnabled'],
  ReaderToggle: ['value', 'specId', 'inputIdentity', 'accessibilityLabel', 'actionEnabled', 'isBusy', 'onToggle'],
})) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set(props));
}
for (const [name, slots] of [['PageBackBar', ['trailing']], ['ReaderDirectoryList', ['rowBuilder', 'emptyBuilder']],
  ['ReaderDirectoryNavigationSurface', ['fallbackBuilder']]]) {
  syntax.builderParamObjectCollection.set(name, new Set(slots));
}
const tokens = Object.fromEntries([...read('features/common/ReaderTokens.ets')
  .matchAll(/export const (TOK_\w+)(?:\s*:\s*\w+)?\s*=\s*([\d.]+);/g)].map(m => [m[1], Number(m[2])]));
let metrics = {
  systemFontScale: 1, windowRect: { width: 390, height: 844 },
  systemInsets: { left: 0, right: 0, bottom: 34 }, cutoutInsets: {}, gestureInsets: {}, navigationInsets: {},
};
const lazy = { create(_id, _owner, data, generator) {
  for (let index = 0; index < data.totalCount(); index++) generator(data.getData(index));
}, pop() {} };
const deps = {
  readerRecoveryView,
  ...labeledFoundation.dependencies,
  ...sourceCategory,...scrollModule,...geometryModule,...sourceLayoutModule,...surfaceGeometry,...searchResultGeometry,
  ReaderMeasurementStore,
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
  ReaderToggle: Child,
  ReaderDirectoryToolbar: Child, ReaderDirectoryList: Child, ReaderDirectoryNavigationSurface: Child,
  ReaderDirectoryNavigationList: Child, ReaderRuntimeOwner: { current: () => ({ supportsCoreCapability: () => false }) },
  ListItemAlign: { Center: 'center' }, GRID_ROW_GAP: 12, GRID_COLUMN_GAP: 30,
  ScrollDirection: { Horizontal: 'ScrollDirection.Horizontal' },
};
const properties = createArkUIPropertyRuntimeProbe();
Object.assign(deps, properties.sdk);
const selectUiContext = {
  getFont: () => ({}),
  px2vp: value => value / 3,
  vp2px: value => value * 3,
  animateTo: (_config, action) => action?.(),
  getFocusController: () => ({ clearFocus() {} }),
  getMeasureUtils: () => ({
    measureText: ({ textContent }) => ({ width: String(textContent ?? '').length * 14 }),
    measureTextSize: () => ({ width: 0, height: 42 }),
  }),
};
const selectSdk = inlineSelectSdk({ properties, uiContext: selectUiContext,
  dependencies: { ReaderWindowCoordinator: deps.ReaderWindowCoordinator } });
Object.assign(deps, selectSdk.dependencies);
const footerSource = read('features/manga/MangaDirectoryCurrentFooter.ets');
const popupSource = read('features/common/ReaderMangaDownloadPopup.ets');
deps.MangaDirectoryCurrentFooter = createReaderBuilderProbe(footerSource, boundedMembers(footerSource), deps, properties.hooks).Component;
deps.ReaderMangaDownloadPopup = Child;
const hooks = { ...properties.hooks, childSources: { ...labeledFoundation.hooks.childSources,
  MangaDirectoryCurrentFooter: footerSource,
  ReaderMangaDownloadPopup: popupSource }, mountChildren: true };
const nodes = owner => [...owner.nodes.values()];
const allNodes = owner => [...(owner.nodes?.values() ?? []), ...[...(owner.children?.values() ?? [])].flatMap(allNodes)];
const componentIds = require(`${sdk}/lib/component_map.js`).ID_ATTRS;
function isolateComponentIds(build) {
  const saved = new Map(componentIds);
  componentIds.clear();
  try { return build(); }
  finally {
    componentIds.clear();
    for (const [id, location] of saved) componentIds.set(id, location);
  }
}
function fixture(key, names, values = {}) {
  const selected = key === 'search' ? [...names, 'externalHeaderHeight', 'operation', 'retryOperation', 'filteredEmptyMessage'] :
    key === 'source' ? [...names, 'recovery'] :
      key === 'directory' ? [...names, 'standardContent', 'standardHeader', 'standardToolbar'] : names;
  const { owner } = isolateComponentIds(() => createReaderBuilderProbe(sources[key], selected, deps, hooks));
  for (const match of sources[key].matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g)) {
    if (typeof owner[match[1]] !== 'function') owner[match[1]] = () => {};
  }
  Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, selectedGroupName:'全部', selectedContentType:'全部类型',
    contentFrame: () => ({ left: 42, right: 18, width: 330 }), numericAreaLength: value => Number(value),
    measurements:new ReaderMeasurementStore(),standardMeasurements:new ReaderMeasurementStore(),
    directoryRecovery:{presentationId:'',bookmarks:{message:'',visible:false,canRetry:false,generation:0},
      offline:{message:'',visible:false,canRetry:false,generation:0},canContinueBookmarks:false,
      canContinueOffline:false,offlineBlocked:false},
    standardHeaderSpec:{barHeight:58,toolbarHeight:50,dividerHeight:0.5,contentGap:5,initialHeight(){return 108.5;}},
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
const owner = fixture('search', ['build', 'stateContent', 'resultsContent', 'mainSearchNotices',
  'searchBottomInset', 'searchContentStartInset', 'searchContentEndInset', 'pageGeometry', 'scrollLayout'], {
  presentation: { kind: 'results', searching: false, failedSourceCount: 0, keyword: '书', results: [],
    totalSourceCount: 2, completedSourceCount: 2, searchedSourceCount: 2 },
  externalHeaderHeight: 60, isTablet: false,
  visibleGroups: [], groupNames: () => ['在线'], resultDataSource: { totalCount: () => 0 },
  resultScroller: {}, isSweeping: () => false,
});
owner.readerWindowMetricsRevision = 1;
owner.initialRender();
const list = fullList(owner);
assert.equal(list.contentStartOffset, 60, 'the externally measured search header is the retained List start offset');
assert.equal(list.contentStartOffset, owner.searchContentStartInset());
assert.equal(list.contentEndOffset, owner.searchBottomInset(),
  'the floating host bottom inset is the only retained List tail clearance');
assert.equal(list.contentEndOffset, owner.searchContentEndInset());
const notices = nodes(owner).find(node => node.type === 'ListItem' && node.id === 'search-main-notices');
assert.ok(notices, 'summary/progress/statistics remain permanent List index zero rather than a private fixed header');
assert.equal(allNodes(owner).some(node => node.type === 'Column' && node.zIndex === 10 && node.onAreaChange), false,
  'the search page does not re-create the removed compound fixed-header host');
const before = list.contentStartOffset;
owner.externalHeaderHeight = 92;
owner.externalHeaderChanged();
properties.flush();
assert.equal(list.contentStartOffset - before, 32, 'the external header measurement changes retained scroll clearance');
}

if(selectedCase==='source') for (const sourceCount of [0, 2]) {
  const items = Array.from({ length: sourceCount }, (_, i) => ({ sourceId: `source-${i}`,
    name: `书源 ${i + 1}`, baseUrl: `https://source-${i}.example.com`, group: '默认',
    category: 'novel', enabled: true, checkState: 'unchecked', checkMessage: '', bookSourceType: 0 }));
  const owner = fixture('source', ['build', 'sourceList', 'bottomActionBar', 'actionBottomInset'], {
    sources: items, projectedSources: items, statusKind: 'idle', groupOpen: false,
    statusActionLabel: '', statusActionGeneration: 0, onStatusAction: () => {},
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
const multi = fixture('multi', ['build', 'selectionTopBar', 'removeBar', 'removeBarClearance', 'bottomInset'], {
  selectedKeys: [], busy: false, ready: true, removeBarHeight: 0, bookRows: () => [],
  allSelected: () => false, bookKey: () => '', isListMode: () => false,
  __Repeat() { return { each() { return this; }, key() { return this; }, virtualScroll() { return this; }, render() {} }; },
});
multi.initialRender();
const multiList = fullList(multi);
assert.ok(multiList.contentStartOffset > 0);
const footerLayer = allNodes(multi).find(n => n.type === 'Stack' && n.zIndex === 20);
const remove = allNodes(multi).find(n => n.type === 'Column' &&
  (n.borderRadius?.topLeft === 24 || n.borderRadius?.topLeft?.value === 24));
const removeHost = allNodes(multi).find(n => n.type === 'Column' && typeof n.onAreaChange === 'function' &&
  n.padding !== undefined && n !== multiList);
assert.ok(footerLayer, 'the public page frame owns the bottom overlay layer');
assert.ok(remove, 'the actual remove bar is mounted: ' + JSON.stringify(allNodes(multi)
  .filter(n => n.type === 'Column' && n.borderRadius).map(n => ({ id: n.id, padding: n.padding,
    borderRadius: n.borderRadius, height: n.height }))));
assert.ok(removeHost, 'the public footer measurement host is mounted: ' + JSON.stringify(allNodes(multi)
  .filter(n => n.type === 'Column' && typeof n.onAreaChange === 'function').map(n => ({ id: n.id, padding: n.padding }))));
assert.equal(remove.height, undefined, 'the footer can grow naturally with scaled or wrapped labels');
assert.equal(footerLayer.hitTestBehavior, 'HitTestMode.Transparent');
const initialClearance = multi.removeBarClearance();
const initialEnd = multiList.contentEndOffset;
removeHost.onAreaChange({}, { height: 116 });
multi.replayOnly([multiList.id]);
const firstMeasuredEnd=multiList.contentEndOffset;
assert.equal(firstMeasuredEnd-initialEnd, 116-initialClearance);
removeHost.onAreaChange({}, {height:173}); multi.replayOnly([multiList.id]);
assert.equal(multiList.contentEndOffset-firstMeasuredEnd, 173-116, 'measured footer delta updates retained clearance without shrinking List');
}

if(selectedCase==='directory') {
const directory = fixture('directory', ['build', 'standardPage', 'flatList', 'standardMeasurementRevision'], {
  sourceId: 'source', bookId: 'book', admittedIdentity: 'source\u0000book', rulesRevision: 0,
  readerWindowMetricsRevision: 1,
  supportsDirectoryRules: () => false, projectedEntries: [{ index: 7 }], admittedEntries: [{ index: 7 }],
  bottomInset: () => 34, searchDraft: '', searchQuery: '', ascending: true, navigationActive: false,
});
directory.initialRender();
const actorsOf = owner => [owner, ...[...(owner.children?.values() ?? [])].flatMap(actorsOf)];
const frame = actorsOf(directory).find(actor => actor.geometry && actor.frameStyle);
assert.ok(frame, 'BookDirectoryPage mounts the public ReaderPageScaffold: ' + JSON.stringify(actorsOf(directory)
  .map(actor => ({ constructor: actor.constructor?.name, params: Object.keys(actor.params ?? {}),
    geometry: actor.geometry !== undefined, frameStyle: actor.frameStyle !== undefined }))));
const headerHost = actorsOf(frame).find(actor => actor.style && typeof actor.onHeightChange === 'function');
const headerMask = headerHost && nodes(headerHost).find(node => node.type === 'Column' && node.onAreaChange);
assert.ok(headerMask, 'the public header host owns the actual measured mask');
const tree = [...directory.children.values()].find(child => child.params?.chapterEntries);
assert.ok(tree);
const initialTop=tree.params.scrollLayout.startInset, initialEnd=tree.params.scrollLayout.endInset;
assert.ok(initialTop>0 && initialEnd>=34);
tree.params.fallbackBuilder();
let flat = [...directory.children.values()].find(child => child.params?.entries);
assert.ok(flat);
assert.equal(flat.params.scrollLayout.startInset, initialTop);
assert.equal(flat.params.scrollLayout.endInset, initialEnd);
const tools = nodes(directory).find(n => n.type === 'Column' && n.margin?.left === 42 && n.margin?.right === 18);
assert.ok(tools, 'toolbar remains a real bounded business slot inside the common header');
assert.equal(tools.position, undefined, 'toolbar flows after the title under the one shared header mask');
assert.equal(tools.hitTestBehavior, 'HitTestMode.Transparent');
headerMask.onAreaChange({}, { height: '268vp' });
properties.flush();
frame.content();
properties.flush();
assert.equal(tree.params.scrollLayout.startInset-initialTop, 268-108.5,
  'the public header receipt reaches the retained tree through the shared geometry: ' + JSON.stringify({
    revision: directory.standardMeasurementRevision,
    stored: directory.standardMeasurements.read('bookDirectory:header', -1),
    geometry: directory.standardGeometry().content.startInset,
    observedKeys: Object.getOwnPropertyNames(directory).filter(key => key.includes('standardMeasurement')),
    dependencyReads: properties.reads.filter(read => read.name === 'standardMeasurementRevision')
      .map(read => ({ id: read.id, owner: read.owner?.constructor?.name })).slice(-8),
    sameTree: directory.children.get(tree.id) === tree,
    currentTreeStart: directory.children.get(tree.id)?.params?.scrollLayout?.startInset,
    treeUpdates: properties.updates.filter(update => update.child === tree).slice(-3)
      .map(update => update.params?.scrollLayout?.startInset),
  }));
// The real Surface re-executes this Builder slot after its scrollLayout Prop
// changes; the direct directory fixture keeps that child as a bounded actor.
tree.params.fallbackBuilder();
properties.flush();
flat = [...directory.children.values()].find(child => child.params?.entries);
assert.equal(flat.params.scrollLayout.startInset,tree.params.scrollLayout.startInset);
const measuredTop=tree.params.scrollLayout.startInset;
headerMask.onAreaChange({}, {height:321});
properties.flush();
frame.content();
properties.flush();
assert.equal(tree.params.scrollLayout.startInset-measuredTop,321-268);
tree.params.fallbackBuilder();
properties.flush();
flat = [...directory.children.values()].find(child => child.params?.entries);
assert.equal(flat.params.scrollLayout.startInset,tree.params.scrollLayout.startInset,
  'both retained directory owners receive the same measured header delta');
headerMask.onAreaChange({}, { height: 0 });
properties.flush();
frame.content();
properties.flush();
assert.equal(tree.params.scrollLayout.startInset, measuredTop + 53,
  'a transient zero header receipt cannot erase positive measured clearance');
}

function nativeDirectoryFixture(key, values = {}) {
  const empty = emptyMangaGridState();
  const scrollLayout = values.scrollLayout ?? new scrollModule.ReaderScrollLayout(
    values.contentStartInset ?? (values.mangaDisplay ? 0 : 273),
    values.contentEndInset ?? (values.mangaDisplay ? 0 : 39), 'contentOffset');
  const owner = fixture(key, key === 'flat' ? ['build', 'rowBuilder', 'emptyBuilder', 'emptyContent', 'probeGeometry', 'scrollLayout'] :
    ['build', ...mangaGridBuilderMembers, 'mangaColor', 'scrollLayout'], {
    ...empty, mangaPresentationRevision: 0, entries: [], dataSource: { ...empty.dataSource, totalCount: () => 0 }, rowHeight: 40, itemSizes: {},
    scrollLayout, listPaddingX: 10, listPaddingRight: -1,
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
  owner.scrollLayout = new scrollModule.ReaderScrollLayout(114, 51, 'contentOffset');
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
    'mangaCurrentFooter', 'mangaFlowFooter', 'mangaVisibleTopInset', 'mangaNarrow', 'mangaContentTopInset', 'mangaFontScale', 'mangaToolHeight', 'mangaFooterHeight', 'mangaBottomInset', 'mangaFooterBottomOffset', 'mangaBottomClearance', 'mangaListBottomClearance', 'mangaSortIcon', 'headerFrame', 'onMangaScrollOffset', 'topInset', 'bottomInset'], {
    contentKind: 'manga', sourceId: 'source', bookId: 'book', admittedIdentity: 'source\u0000book',
    admittedEntries: entries, projectedEntries: entries, rulesRevision: 0, currentChapterIndex: 7,
    locateCurrentRevision: 0, navigationInteracted: false, mangaDownloadEnabled: false,
    bookTitle: '漫画', searchDraft: '', searchQuery: '', ascending: true,
    mangaToolsHeight: 175, mangaViewportHeight: 844, viewportWidth: 390, mangaFontsReady: true,
    mangaScrollOffset: 0, mangaFooterMeasured: 0, listScroller: nativeMangaScroller,
    mangaLayoutEntries: () => entries, mangaSummaryLabel: () => '1 个可读条目', mangaCurrentTitle: () => '第七话', mangaCurrentPosition: () => '1 / 20',
  });
  catalog.initialRender();
  const treeChild = [...catalog.children.values()].find(child => child.params?.chapterEntries);
  assert.ok(treeChild, 'manga dispatch publishes the tree catalog');
  treeChild.params.fallbackBuilder();
  const flatChild = [...catalog.children.values()].find(child => child.params?.entries);
  assert.ok(flatChild, 'the actual manga fallback publishes its natural-row List');
  const toolbar = nodes(catalog).find(node => node.type === 'Column' && node.position && typeof node.onAreaChange === 'function');
  const catalogActors = [catalog, ...[...(catalog.children?.values() ?? [])].flatMap(function collect(actor) {
    return [actor, ...[...(actor.children?.values() ?? [])].flatMap(collect)];
  })];
  const frame = catalogActors.find(actor => actor.geometry && actor.frameStyle);
  const actualFooter = [...catalog.children.values()].find(child => child instanceof deps.MangaDirectoryCurrentFooter);
  assert.ok(actualFooter, 'the real shared footer supplies the full catalog clearance contract');
  assert.ok(nodes(actualFooter).some(node=>node.accessibilityText==='当前阅读位置')); 
  assert.ok(toolbar); assert.ok(frame, 'manga page public frame: ' + JSON.stringify(catalogActors
    .map(actor => ({ constructor: actor.constructor?.name, params: Object.keys(actor.params ?? {}),
      geometry: actor.geometry !== undefined, frameStyle: actor.frameStyle !== undefined }))));
  assert.ok(toolbar.position.y>=safeTop && frame.geometry.footer.bottom>=safeBottom);
  assert.equal(frame.geometry.footer.surface, 'transparent');
  const footerLayer = nodes(frame).find(node => node.type === 'Stack' && node.zIndex === 20);
  const nativeViewport = nodes(frame).find(node => node.type === 'Stack' && node.zIndex === 0 &&
    node.height === '100%' && node.create?.alignContent === 'Alignment.TopStart');
  assert.ok(footerLayer && nativeViewport);
  assert.equal(footerLayer.hitTestBehavior, 'HitTestMode.Transparent');
  assert.equal(nativeViewport.height, '100%');
  assert.equal(nativeViewport.clip, false, 'the floating dock does not shorten or clip the catalog viewport');
  const toolbarEnd = toolbar.position.y + catalog.mangaToolsHeight;
  assert.ok(treeChild.params.scrollLayout.endInset >= 0);
  for (const [key, child] of [['tree', treeChild], ['flat', flatChild]]) {
    assert.equal(child.params.listPaddingTop, toolbarEnd, `${key} first row clears the measured floating tools`);
    const { owner, list } = nativeDirectoryFixture(key, child.params);
    if (key === 'tree') {
      assert.equal(list.padding.top, 0);
      assert.equal(list.contentStartOffset, child.params.scrollLayout.startInset + child.params.listPaddingTop);
      assert.equal(list.padding.bottom, 0);
      assert.equal(list.contentEndOffset, child.params.scrollLayout.endInset + child.params.listPaddingBottom);
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
const surface = fixture('surface', ['build', 'fallbackBuilder', 'scrollLayout'], { view: { visibleTotal: 1 },
  scrollLayout: new scrollModule.ReaderScrollLayout(273, 39, 'contentOffset') });
surface.initialRender();
const nativeTree = [...surface.children.values()][0];
assert.equal(nativeTree.params.scrollLayout.startInset, 273);
assert.equal(nativeTree.params.scrollLayout.endInset, 39);
const updatedSurface = fixture('surface', ['build', 'fallbackBuilder', 'scrollLayout'], {
  view: { visibleTotal: 1 }, scrollLayout: new scrollModule.ReaderScrollLayout(114, 51, 'contentOffset') });
updatedSurface.initialRender();
const updatedTree = [...updatedSurface.children.values()][0];
assert.equal(updatedTree.params.scrollLayout.startInset, 114, 'navigation Surface passes the current layout through to its native List');

}
if(selectedCase==='search-anchor') {
const frames = [], moves = [];
const Restore = selectedProductionMethods(new URL('features/search/SearchPage.ets', root), 'SearchPage',
  ['scheduleScrollRestore', 'restoreMeasuredAnchor', 'selectGroup', 'resetFilteredResults'], {
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) },
    SearchLayoutFrame: class { constructor(action) { this.action = action; } }, ScrollAlign: { START: 0 }, Edge: { Top: 'top' },
  });
const restoring = Object.assign(new Restore(), { pageMounted: true, listMounted: true, restoreCancelled: false,
  restoreScheduled: false, restoreEpoch: 0, pageEpoch: 1, listEpoch: 1,
  viewState: { revision: 1, pageRevision: 1, anchorNeighbors: [], resolveKey: key => key },
  restoreKey: 'book', restoreItemY: 122, visibleGroups: [{ book: {} }], resultGroupKey: () => 'book',
  presentation: { kind: 'results' }, isTablet: false, groupNames: () => ['在线'],
  getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
  ownsList: () => true, ownsPageQuery: () => true, searchContentStartInset: () => 40,
  resultNativeIndex: index => index + 1, saveScrollAnchor() {}, refreshVisibleResults() {},
  resultScroller: { scrollToIndex: index => moves.push(['index', index]),
    currentOffset: () => ({ yOffset: 0 }), getItemRect: () => ({ y: 122, height: 150 }),
    scrollBy: (_x, y) => moves.push(['by', y]),
    scrollTo: offset => moves.push(['offset', offset.yOffset]), scrollEdge: edge => moves.push(['edge', edge]) },
});
restoring.scheduleScrollRestore();
frames.shift().action();
assert.deepEqual(moves, [['by', 82]], 'a realized saved row restores to its saved y instead of being forced to native zero');
moves.length = 0;
restoring.visibleGroups = [];
restoring.viewState.selectOrigin = () => {};
restoring.selectGroup('在线');
frames.shift().action();
assert.deepEqual(moves, [['edge', 'top'], ['index', 0]],
  'category reset starts at permanent List index zero so the measured external header cannot hide the first result');
assert.equal(restoring.restoreKey, '');
assert.equal(restoring.viewState.anchorKey, '');
restoring.viewState.anchorAtStart = false;
restoring.restoreKey = '';
restoring.visibleGroups = [];
for (const offset of [0, -30, -122, 137]) {
  moves.length = 0;
  restoring.restoreOffset = offset;
  restoring.scheduleScrollRestore();
  frames.shift().action();
  assert.deepEqual(moves, offset !== 0 ? [['offset', offset]] : [],
    'signed saved offsets restore unchanged while default zero stays at the native list origin');
}
}
console.log('selected floating content case PASS: '+selectedCase);

}

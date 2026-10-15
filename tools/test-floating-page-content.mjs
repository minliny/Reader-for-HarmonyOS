import { readerRecoveryView } from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readerInteractiveSafeBottom, readerInteractiveSafeTop } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { readerFloatingBarBottomInset } from './lib/reader-floating-bar-metrics-probe.mjs';
import { mangaGridProbeDependencies, mangaGridBuilderMembers, emptyMangaGridState } from './lib/manga-directory-grid-probe.mjs';
import * as fonts from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';

const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const sources = Object.fromEntries(Object.entries({
  search: 'features/search/SearchPage.ets', source: 'features/source/SourceManagementPage.ets',
  multi: 'features/bookshelf/BookshelfMultiSelectPage.ets', directory: 'features/bookshelf/BookDirectoryPage.ets',
  flat: 'features/reading/ReaderDirectoryList.ets', surface: 'features/reading/ReaderDirectoryNavigationSurface.ets',
  tree: 'features/reading/ReaderDirectoryNavigationList.ets',
}).map(([key, path]) => [key, read(path)]));
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
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
const footerSource = read('features/manga/MangaDirectoryCurrentFooter.ets');
const popupSource = read('features/common/ReaderMangaDownloadPopup.ets');
deps.MangaDirectoryCurrentFooter = createReaderBuilderProbe(footerSource, boundedMembers(footerSource), deps, properties.hooks).Component;
deps.ReaderMangaDownloadPopup = Child;
const hooks = { ...properties.hooks, childSources: { MangaDirectoryCurrentFooter: footerSource,
  ReaderMangaDownloadPopup: popupSource }, mountChildren: true };
const nodes = owner => [...owner.nodes.values()];
const allNodes = owner => [...(owner.nodes?.values() ?? []), ...[...(owner.children?.values() ?? [])].flatMap(allNodes)];
function fixture(key, names, values = {}) {
  const selected = key === 'search' ? [...names, 'operation', 'retryOperation', 'filteredEmptyMessage', 'searchHeader', 'resultStats', 'searchActivity'] : key === 'source' ? [...names, 'recovery'] : key === 'directory' ? [...names, 'standardContent', 'standardHeader', 'standardToolbar'] : names;
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
  const headerHeight = (isTablet ? 56 : 52) + 2 * 41.5;
  assert.equal(list.contentStartOffset, headerHeight + 28.5);
  assert.equal(list.contentEndOffset, 34);
  const header = allNodes(owner).find(n => n.type === 'Column' && n.zIndex === 10 && n.onAreaChange);
  assert.ok(header, 'compound search/filter/statistics mount the actual common fixed-header host');
  assert.equal(header.hitTestBehavior, 'HitTestMode.Transparent');
  assert.match(header.backgroundColor, /^#FF/, 'the entire compound header masks scrolling rows');
  const stats = nodes(owner).find(n => n.type === 'Row' && n.onAreaChange);
  assert.ok(stats, 'statistics remain in the actual compound header content');
  assert.equal(stats.position, undefined, 'statistics flow with filters inside the shared measured header');
  assert.equal(stats.zIndex, undefined, 'statistics do not create a private overlay layer');
  stats.onAreaChange({}, { height: 52 });
  owner.replayOnly([list.id]);
  assert.equal(list.contentStartOffset, headerHeight + 52, 'measured multiline statistics update the retained List clearance');
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

for (const sourceCount of [0, 2]) {
  const items = Array.from({ length: sourceCount }, (_, i) => ({ sourceId: `source-${i}` }));
  const owner = fixture('source', ['build', 'sourceList', 'bottomActionBar', 'actionBottomInset'], {
    sources: items, statusKind: 'idle', groupOpen: false,
    sourceDataSource: { totalCount: () => items.length, getData: i => items[i] }, sourceRenderKey: source => source.sourceId,
  });
  owner.initialRender();
  const list = fullList(owner);
  assert.equal(list.contentStartOffset, 58);
  assert.equal(list.contentEndOffset, 44 + tokens.TOK_SPACE_SM + 34);
  const footer = nodes(owner).find(n => n.type === 'Column' && n.height === 44 + tokens.TOK_SPACE_SM + 34);
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
  assert.equal(nodes(owner).some(n => n.type === 'Text' && n.create === '暂无书源'), sourceCount === 0,
    JSON.stringify(nodes(owner).filter(n => n.type === 'Text').map(n => ({ id: n.id, create: n.create }))));
}

const multi = fixture('multi', ['build', 'selectionTopBar', 'removeBar', 'removeBarClearance', 'bottomInset'], {
  selectedKeys: [], busy: false, ready: true, removeBarHeight: 0, bookRows: () => [],
  allSelected: () => false, bookKey: () => '', isListMode: () => false,
  __Repeat() { return { each() { return this; }, key() { return this; }, virtualScroll() { return this; }, render() {} }; },
});
multi.initialRender();
const multiList = fullList(multi);
assert.equal(multiList.contentStartOffset, 70);
assert.equal(multiList.contentEndOffset, 12 + 22 + 6 + 13.31 + 34 + 20);
const remove = nodes(multi).find(n => n.borderRadius?.topLeft === 24);
const removeHost = allNodes(multi).find(n => n.type === 'Column' && n.onAreaChange && n.padding?.left === 0 && n.padding?.right === 0);
assert.ok(removeHost);
assert.equal(removeHost.height, undefined, 'the footer can grow naturally with scaled or wrapped labels');
assert.equal(allNodes(multi).find(n => n.type === 'Stack' && n.zIndex === 20).hitTestBehavior, 'HitTestMode.Transparent');
remove.onAreaChange({}, { height: 116 });
multi.replayOnly([multiList.id]);
assert.equal(multiList.contentEndOffset, 136, 'measured footer height updates clearance without shrinking the List');

const directory = fixture('directory', ['build', 'standardPage', 'flatList'], {
  sourceId: 'local', bookId: 'book', admittedIdentity: 'local\u0000book', rulesRevision: 0, toolsHeight: 51,
  directoryRecovery: { offlineBlocked: false },
  supportsDirectoryRules: () => false, projectedEntries: [{ index: 7 }], admittedEntries: [{ index: 7 }],
  bottomInset: () => 34, searchDraft: '', searchQuery: '', ascending: true, navigationActive: false,
});
directory.initialRender();
let tree = [...directory.children.values()].find(child => child.params.chapterEntries);
assert.ok(tree);
assert.equal(tree.params.contentStartInset, 114);
assert.equal(tree.params.contentEndInset, 39);
tree.params.fallbackBuilder();
const flat = [...directory.children.values()].find(child => child.params.entries);
assert.equal(flat.params.contentStartInset, 114);
assert.equal(flat.params.contentEndInset, 39);
const tools = nodes(directory).find(n => n.type === 'Column' && n.margin?.left === 42 && n.margin?.right === 18);
assert.ok(tools, 'toolbar remains a real bounded business slot inside the common header');
assert.equal(tools.position, undefined, 'toolbar flows after the title under the one shared header mask');
assert.equal(tools.hitTestBehavior, 'HitTestMode.Transparent');
const directoryHeader = allNodes(directory).find(n => n.type === 'Column' && n.zIndex === 10 && n.onAreaChange);
assert.ok(directoryHeader);
assert.match(directoryHeader.backgroundColor, /^#FF/, 'title and expanded tools share one opaque header mask');
directoryHeader.onAreaChange({}, { height: '268vp' });
directory.replayOnly([tree.id, flat.id]);
assert.equal(tree.params.contentStartInset, 273);
assert.equal(flat.params.contentStartInset, 273, 'expanded title/tools measurement updates both retained tree and fallback Lists');
directoryHeader.onAreaChange({}, { height: 0 });
assert.equal(directory.standardHeaderHeight, 268, 'transient zero layout cannot erase the measured whole-header clearance');

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

// The complete manga catalog owns both its overlay geometry and the payload
// sent to the paged tree and its flat fallback. Exercise that producer before
// mounting each actual native List, so a missing footer gap cannot be hidden by
// a manually chosen child inset.
for (const [safeTop, safeBottom] of [[0, 0], [48, 34], [10, 80]]) {
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
  const treeChild = [...catalog.children.values()].find(child => child.params.chapterEntries);
  assert.ok(treeChild, 'manga dispatch publishes the tree catalog');
  treeChild.params.fallbackBuilder();
  const flatChild = [...catalog.children.values()].find(child => child.params?.entries);
  assert.ok(flatChild, 'the actual manga fallback publishes its natural-row List');
  const toolbar = nodes(catalog).find(node => node.type === 'Column' && node.position?.y === safeTop + 80 && typeof node.onAreaChange === 'function');
  const footer = allNodes(catalog).find(node => node.type === 'Column' && node.padding?.bottom === safeBottom + 8);
  const frame = [...catalog.children.values()].find(child => child.params?.variant === 'mangaDirectory');
  const actualFooter = [...catalog.children.values()].find(child => child.nodes && child.availableWidth === 330);
  assert.ok(actualFooter, 'the real shared footer supplies the full catalog clearance contract');
  assert.equal(nodes(actualFooter).find(node => node.accessibilityText === '当前阅读位置').constraintSize.minHeight, 48);
  assert.ok(toolbar); assert.ok(footer);
  assert.equal(toolbar.position.y, safeTop + 80);
  assert.equal(footer.padding.bottom, safeBottom + 8);
  assert.equal(footer.clip, true);
  const toolbarEnd = toolbar.position.y + catalog.mangaToolsHeight;
  const footerClearance = catalog.mangaFooterHeight() + footer.padding.bottom + 8;
  assert.equal(frame.params.contentEndInset, footerClearance, 'the common clipped viewport owns the complete fixed-dock clearance');
  for (const [key, child] of [['tree', treeChild], ['flat', flatChild]]) {
    assert.equal(child.params.listPaddingTop, safeTop + 255);
    assert.equal(child.params.listPaddingTop, toolbarEnd, `${key} first row clears the measured floating tools`);
    assert.equal(child.params.listPaddingBottom, 18, `${key} tail cannot reserve the dock a second time`);
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
  assert.equal(treeChild.params.listPaddingTop, safeTop + 289);
  assert.equal(flatChild.params.listPaddingTop, safeTop + 289, 'both native owners receive a wrapped title/font-size clearance update');
}
metrics = { ...metrics, systemInsets: { left: 0, right: 0, bottom: 34 } };
const surface = fixture('surface', ['build', 'fallbackBuilder'], { view: { visibleTotal: 1 }, contentStartInset: 273, contentEndInset: 39 });
surface.initialRender();
const nativeTree = [...surface.children.values()][0];
assert.equal(nativeTree.params.contentStartInset, 273);
assert.equal(nativeTree.params.contentEndInset, 39);
surface.contentStartInset = 114;
surface.replayOnly([nativeTree.id]);
assert.equal(nativeTree.params.contentStartInset, 114, 'retained navigation Surface passes inset updates through to its native List');

// A previously saved positive first-row y is valid after adding internal
// header clearance. The actual restore method must not force that row to y=0.
const frames = [], moves = [];
const Restore = productionMotionMethods(new URL('features/search/SearchPage.ets', root),
  ['scheduleScrollRestore', 'searchHeaderHeight', 'selectGroup'], {
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
console.log('Floating pages: actual SDK Builders, full List/Scroll viewports, internal clearances, dynamic overlays, safe bottom and search anchor/top-edge restoration PASS');

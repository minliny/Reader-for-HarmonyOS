import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { mangaGridBuilderMembers, mangaRowBuilderMembers, mangaGridProbeDependencies, emptyMangaGridState } from './lib/manga-directory-grid-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { localBookDetailSdk } from './lib/local-book-detail-sdk-probe.mjs';
import { openReaderDirectoryNavigation, readerDirectoryScopeKey,
  readerDirectoryToggleCollapsed, readerDirectoryCollapsedIds } from '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';
import { readerDirectorySaveViewportAnchor, readerDirectoryViewportAnchor } from '../entry/src/main/ets/features/reading/ReaderDirectoryViewport.ts';
const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const scope = readerDirectoryScopeKey('source', 'comic');
readerDirectoryToggleCollapsed(scope, 'r1', 'current-volume');
readerDirectoryToggleCollapsed(scope, 'r1', 'unrelated-volume');
readerDirectorySaveViewportAnchor({ bookId: scope, navigationRevision: 'r1', viewId: 'old', nodeId: 'old-target', visibleIndex: 90, rowFraction: 0.5 });
readerDirectorySaveViewportAnchor({ bookId: 'other-book', navigationRevision: 'r1', viewId: 'other', nodeId: 'other-target', visibleIndex: 8, rowFraction: 0.2 });
const requests = [];
const ready = { status: 'ready', viewId: 'view', navigationRevision: 'r1', visibleTotal: 1, nodes: [] };
const result = await openReaderDirectoryNavigation({ open: async query => {
  requests.push(query);
  return query.collapsedNodeIds.includes('current-volume') ? { ...ready, currentAncestorNodeId: 'current-volume' } :
    { ...ready, currentVisibleIndex: 0 };
} }, { sourceId: 'source', bookId: 'comic', chapterIndex: 4, anchorNodeId: 'old-target', locateCurrent: true }, () => true);
assert.equal(result.locateCurrent, true);
assert.equal(result.currentVisibleIndex, 0);
assert.equal(requests.length, 2, 'only the actual collapsed ancestry needs another Core query');
assert.equal(requests[0].anchorNodeId, undefined, 'locate cannot restore the old browse anchor');
assert.deepEqual(readerDirectoryCollapsedIds(scope), ['unrelated-volume']);
assert.equal(readerDirectoryViewportAnchor(scope), undefined);
assert.equal(readerDirectoryViewportAnchor('other-book').nodeId, 'other-target', 'other book state is preserved');
const listPath = file('features/reading/ReaderDirectoryNavigationList.ets');
const listSource = readFileSync(listPath, 'utf8');
assert.match(listSource, /Grid\(this\.scroller, this\.mangaGridLayoutOptions\(\)\)/,
  'the actual Core-paged manga route uses the supported SDK Grid constructor');
assert.match(listSource, /return Math\.max\(0, this\.contentStartInset\) \+ Math\.max\(0, this\.listPaddingTop/,
  'Grid content start includes the full-page header and tools clearance');
assert.match(listSource, /\.contentStartOffset\(this\.mangaContentStartOffset\(\)\)/, 'the real Grid consumes the official inherited content-start API');
assert.match(listSource, /return Math\.max\(0, this\.contentEndInset\) \+ \(this\.mangaCatalogDisplay \? 18/,
  'Grid content end combines the footer clearance with catalog or demo internal spacing');
assert.match(listSource, /\.contentEndOffset\(this\.mangaContentEndOffset\(\)\)/, 'the real Grid consumes the official inherited content-end API');
const methods = productionMotionMethods(listPath, ['isCurrentNode','isCurrentMangaNode'], {});
for (const scheme of ['day', 'night'])
for (const kind of ['group', 'target', 'disabled'])
for (const current of [false, true])
for (const mangaRowMinHeight of [58, 50]) {
  const { owner } = createReaderBuilderProbe(listSource, mangaRowBuilderMembers, { ...mangaGridProbeDependencies, ...fontFamilies });
  const node = { nodeId: 'row', title: '标题含卷也不足以证明整卷内容', kind, depth: kind === 'group' ? 1 : 2,
    expanded: false, hasChildren: kind === 'group', chapterIndex: kind === 'target' ? 4 : undefined };
  Object.assign(owner, { ...emptyMangaGridState(), mangaDisplay: true, mangaScheme: scheme, appThemeScheme: 'day', interactionEnabled: true,
    mangaRowMinHeight, currentChapterIndex: current ? 4 : -1, view: { identity: {}, currentVisibleIndex: 0 }, mangaPresentationRevision: 0, dataSource: { loadedNode: () => node, loadedItemById: () => ({node,index:0}), currentView: () => owner.view } });
  owner.isCurrentNode = methods.prototype.isCurrentNode.bind(owner);
  owner.isCurrentMangaNode = methods.prototype.isCurrentMangaNode.bind(owner);
  const clicks = [];
  owner.toggleNode = value => clicks.push(['fold', value.nodeId]);
  owner.selectTarget = value => { if (value.kind === 'target') clicks.push(['read', value.chapterIndex]); };
  owner.mangaRow({ node, index: 0 });
  const row = [...owner.nodes.values()].find(value => value.type === 'Row');
  assert.equal(row.constraintSize.minHeight, kind === 'group' ? 48 : 58);
  assert.equal(row.padding.left, kind === 'group' ? 12 : 26, 'gateway-normalized v2 child depth retains manga indentation');
  assert.equal(row.border.width.top, 1, 'only the real first row carries the scrollable directory top line');
  assert.equal(row.border.width.bottom, kind === 'group' ? 0 : 1);
  assert.equal(row.create.space, kind === 'group' ? 14 : 12);
  assert.equal(row.border.color.bottom, scheme === 'night' ? '#3B4036' : '#E7E0D5');
  assert.equal(row.borderRadius, undefined, 'directory rows keep a continuous flat edge');
  const titles = [...owner.nodes.values()].filter(value => value.type === 'Text');
  const selected = kind === 'target' && current;
  const accent = scheme === 'night' ? '#B9CEB1' : '#425D45';
  assert.equal(titles[0].fontSize, 13); assert.equal(titles[0].lineHeight, kind === 'group' ? 21 : 22);
  assert.deepEqual(titles[0].fontWeight, kind === 'group' ? 600 : [selected ? 550 : 400, {enableVariableFontWeight: true}]);
  assert.equal(titles[0].fontFamily, kind === 'group' ? fontFamilies.READER_FONT_NOTO_SANS_SC_UI_600 : selected ? fontFamilies.READER_FONT_NOTO_SANS_SC_UI_550 : fontFamilies.READER_FONT_NOTO_SANS_SC_UI_REGULAR);
  assert.equal(titles[0].fontColor, selected ? accent : (scheme === 'night' ? '#EAE7DE' : '#1F1B17'));
  assert.equal(row.opacity, kind === 'disabled' ? .36 : 1, 'disabled leaf dims its whole actor exactly once');
  assert.equal(row.backgroundColor, selected ? (scheme === 'night' ? '#303C2D' : '#E8EDE2') :
    kind === 'group' ? (scheme === 'night' ? '#30342D' : '#F0ECE3') : 'Color.Transparent');
  assert.equal(titles[0].maxLines, undefined, 'long manga title can naturally increase the row height');
  assert.equal(titles.some(value => value.create === '正在读'), selected, 'only the current readable target claims reading');
  assert.equal(titles.some(value => value.create === '整卷可读'), false, 'a volume title is not a format fact');
  assert.equal([...owner.nodes.values()].some(value => value.type === 'Image'), kind === 'group' || kind === 'target' && !current,
    'ordinary readable rows and groups have a chevron; current and disabled rows do not');
  assert.equal(typeof row.onClick, 'function', 'whole named row owns the real chapter/group callback');
  assert.ok(!titles.some(title => title.onClick), 'inner text does not duplicate its outer gesture actor');
  const selection = [...owner.nodes.values()].find(value => value.layoutWeight === 1 && typeof value.onClick === 'function');
  assert.equal(selection, row, 'selection belongs to the same whole row that paints and receives press feedback');
  selection.onClick();
  assert.deepEqual(clicks, kind === 'group' ? [['fold', 'row']] : kind === 'target' ? [['read', 4]] : []);
}
{
  const { owner } = createReaderBuilderProbe(listSource, mangaRowBuilderMembers, { ...mangaGridProbeDependencies, ...fontFamilies });
  const node = { nodeId: 'legacy', title: '旧版子条目', kind: 'target', depth: 2, chapterIndex: 9 };
  Object.assign(owner, { mangaScheme: 'day', appThemeScheme: 'day', interactionEnabled: true, currentChapterIndex: -1, mangaRowMinHeight: 58, mangaPresentationRevision: 0, view: {},
    dataSource: { loadedItemById: () => ({ node, index: 0 }), currentView: () => owner.view } });
  owner.isCurrentMangaNode = methods.prototype.isCurrentMangaNode.bind(owner);
  owner.mangaRow({ node, index: 0 });
  assert.equal([...owner.nodes.values()].find(value => value.type === 'Row').padding.left, 26,
    'legacy one-based child depth has the same indentation as v2');
}
console.log('PASS actual manga directory SDK Builder and Core locate: group/target/disabled, independent folds, current target and natural height');
const lazyBoundary = new Proxy({}, { get: () => () => {} });
for (const mangaDisplay of [false, true]) {
  const { owner } = createReaderBuilderProbe(listSource,
    ['build', 'row', 'mangaRow', 'selectMangaRow', 'mangaColor', 'displayLevel', 'mangaGroupNode', 'mangaGroupSpacing', 'mangaRowIndex', 'mangaRowPaddingLeft', 'isCurrentMangaNode', 'isCurrentNode', 'rowKey', ...mangaGridBuilderMembers], { ...fontFamilies, ...mangaGridProbeDependencies, LazyForEach: lazyBoundary });
  Object.assign(owner, { ...emptyMangaGridState(), mangaDisplay, mangaScheme: 'night', appThemeScheme: 'day', listPaddingX: 0,
    listPaddingRight: -1, listPaddingTop: -1, listPaddingBottom: -1, listPaddingY: 0, interactionEnabled: true });
  owner.contentStartInset = 37; owner.contentEndInset = 53;
  owner.initialRender();
  const list = [...owner.nodes.values()].find(node => node.type === (mangaDisplay ? 'Grid' : 'List'));
  assert.equal(list.border, undefined, 'the native viewport has no fixed manga top line');
  if (mangaDisplay) {
    assert.equal(list.padding.top, 0); assert.equal(list.padding.bottom, 0, 'manga scroll chrome cannot subtract from the native viewport');
    assert.equal(list.contentStartOffset, 37); assert.equal(list.contentEndOffset, 53, 'full route does not inherit quick-only14vp clearance');
    assert.equal(list.cachedCount, 4);
  } else {
    assert.equal(list.contentStartOffset, 37); assert.equal(list.contentEndOffset, 53);
    assert.equal(list.padding.bottom, 0);
  }
}
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('ReaderDirectoryNavigationList');
syntax.propCollection.set('ReaderDirectoryNavigationList', new Set([...listSource.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(match => match[1])));
const navigationSource = readFileSync(file('features/reading/ReaderDirectoryNavigationSurface.ets'), 'utf8');
for (const mangaDisplay of [false, true])
for (const [mangaCatalogDisplay, mangaCatalogNarrow] of [[false, false], [true, false], [true, true]]) {
  const properties = createArkUIPropertyRuntimeProbe();
  const dependencies = {...fontFamilies, ...mangaGridProbeDependencies, ...properties.sdk,
    LazyForEach: new Proxy({}, {get: () => () => {}})};
  const actual = createReaderBuilderProbe(listSource, ['build', 'row', 'rowKey', ...mangaRowBuilderMembers], dependencies, properties.hooks).Component;
  // Only the empty Core data-source I/O is replaced. Every native Grid/List,
  // empty slot, text and clear callback is emitted by the real child Builder.
  class DirectoryChild extends actual {
    constructor(parent, params, storage, id) {
      super(parent, params, storage, id);
      Object.assign(this, emptyMangaGridState(), params, {params, appThemeScheme: 'day', mangaPresentationRevision: 0,
        dataSource: {...emptyMangaGridState().dataSource, totalCount: () => 0, currentView: () => params.view},
        mangaSearchActive: params.mangaDisplay && parent.query.trim().length > 0});
    }
  }
  const { owner } = createReaderBuilderProbe(navigationSource, ['fallbackBuilder', 'build'],
    {...dependencies, ReaderDirectoryNavigationList: DirectoryChild}, {...properties.hooks, mountChildren: true,
      childSources: {ReaderDirectoryNavigationList: listSource}});
  let clears = 0;
  Object.assign(owner, { mangaDisplay, mangaFontsReady: true, mangaScheme: 'night', appThemeScheme: 'day', query: mangaCatalogDisplay ? '' : '没有此章节',
    mangaRowMinHeight: 50, mangaCatalogDisplay, mangaCatalogNarrow, interactionEnabled: true, listPaddingTop: 145, contentStartInset: 37,
    view: {viewId: 'empty-metadata', visibleTotal: 0}, onClearSearch: () => clears++ });
  owner.initialRender();
  const child = [...owner.children.values()].find(child => child.nodes);
  assert.equal(child.params.mangaRowMinHeight, 50, 'actual native child retains the parent props');
  assert.equal(child.params.mangaCatalogDisplay, mangaCatalogDisplay); assert.equal(child.params.mangaCatalogNarrow, mangaCatalogNarrow);
  const stack = [...owner.nodes.values()].find(node => node.type === 'Stack');
  assert.equal(stack.create.alignContent, mangaDisplay ? 'Alignment.TopStart' : 'Alignment.Center');
  if (!mangaDisplay) {
    assert.ok([...owner.nodes.values()].some(node => node.create === '没有匹配的目录项'));
    assert.ok(![...child.nodes.values()].some(node => node.create === '清除搜索'), 'novel keeps its passive empty state');
    continue;
  }
  assert.ok(![...owner.nodes.values()].some(node => node.type === 'Text'), 'manga empty UI is never a fixed parent overlay');
  const slot = [...child.nodes.values()].find(node => node.type === 'GridItem'); assert.ok(slot);
  if (typeof slot.create[0] === 'function') slot.create[0](slot.id, true);
  const nodes = [...child.nodes.values()], grid = nodes.find(node => node.type === 'Grid');
  assert.equal(grid.padding.top, 0);
  assert.equal(grid.contentStartOffset, 182, 'real child empty content clears the toolbar through the original Grid content offset');
  assert.deepEqual(grid.create[1].onGetIrregularSizeByIndex(0), [1, 12], 'empty slot consumes the full native lane without a Core target');
  const message = nodes.find(node => node.create === (mangaCatalogDisplay ? '暂无章节信息' : '没有匹配的章节'));
  assert.ok(message); assert.deepEqual([message.fontSize, message.lineHeight], [12, 18]);
  const clear = nodes.find(node => node.create === '清除搜索'); assert.equal(clear !== undefined, !mangaCatalogDisplay);
  if (clear) {
    assert.equal(clear.fontColor, '#B9CEB1'); assert.equal(clear.constraintSize.minHeight, 36); clear.onClick(); assert.equal(clears, 1);
    const empty = nodes.find(node => node.type === 'Column');
    assert.equal(empty.create.space, 8); assert.equal(empty.constraintSize.minHeight, 164);
    assert.equal(empty.border.width.top, 1); assert.equal(empty.border.color, '#3B4036');
    assert.deepEqual(empty.padding, {left: 12, right: 12, top: 36, bottom: 36});
  }
}

const metrics = {windowRect: {width: 390, height: 844}, systemFontScale: 1,
  systemInsets: {left: 0, right: 0, top: 48, bottom: 34}, cutoutInsets: {}, gestureInsets: {}, navigationInsets: {}};
const sdkDetail = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}});
const detail = sdkDetail.owner;
Object.assign(detail, { viewportWidth: 390, readerWindowMetricsRevision: 1, appThemeScheme: 'day', sourceSwitchEnabled: true,
  book: {sourceId: 'source', bookId: 'book', contentKind: 'manga', title: '真实字段长标题', author: '作者', sourceName: '来源', intro: '简介',
    mangaPosition: {chapterIndex: 4, pageOrdinal: 7, totalPages: 24}},
  toc: [{index: 3, title: '卷组', navigable: false}, {index: 4, title: '可读目标', navigable: true}],
  introExpanded: false, introMeasured: true, introOverflow: false, collapsedGroups: [], shelfMessage: '', removing: false, inBookshelf: true,
  removalEnabled: true, adding: false, cancellingAdd: false, onBack() {}, onContinue() {}, onRemove() {}});
// Native MeasureUtils full/folded equality for this short synopsis is covered in test-book-detail-intro-measurement-sdk; this SDK branch consumes its admitted receipt.
// The real deferred font admission is covered separately; this case examines
// the SDK branch after its checked receipt, with no production glyph bypass.
detail.mangaFontsReady = true; detail.prepareMangaPreview(); detail.initialRender();
const bar = [...detail.children.values()].find(value => value instanceof sdkDetail.Header);
assert.equal(bar.centered, true); assert.equal(bar.floating, true); assert.equal(bar.variant, 'mangaDirectory');
const nodes = [...detail.nodes.values()];
const cover = nodes.find(value => value.type === 'Stack' && value.width === 84 && value.height === 122);
assert.ok(cover); assert.equal(cover.borderRadius, 8); assert.equal(cover.clip, true);
const scroll = nodes.find(value => value.type === 'Scroll');
assert.equal(scroll.width, '100%'); assert.equal(scroll.height, '100%', 'floating bars never subtract the native scroll viewport');
const title = nodes.find(value => value.type === 'Text' && value.create === detail.book.title && value.fontSize === 24);
assert.equal(title.maxLines, 2); assert.equal(title.lineHeight, 34);
const intro = nodes.find(value => value.type === 'Text' && value.create === '简介' && value.lineHeight === 24);
assert.equal(intro.maxLines, 3);
const dock = nodes.find(value => value.type === 'Stack' && value.constraintSize?.minHeight === 68);
assert.equal(dock.width, 330); assert.equal(dock.height, undefined); assert.equal(dock.borderRadius, 24);
console.log('PASS actual detail SDK Builder: full scroll viewport, shared84×122 manga cover, actual centered header, two-line title, folded intro and naturally growing dock');

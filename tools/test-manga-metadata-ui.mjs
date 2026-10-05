import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
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
assert.match(listSource, /top: this\.mangaDisplay \? 0 : this\.listPaddingTop >= 0 \? this\.listPaddingTop : this\.listPaddingY/,
  'manga navigation rows keep List viewport height and move top clearance to content offset');
assert.match(listSource, /bottom: this\.mangaDisplay \? 0 : this\.listPaddingBottom >= 0 \? this\.listPaddingBottom : this\.listPaddingY/,
  'manga navigation rows keep List viewport height and move bottom clearance to content offset');
assert.match(listSource, /\.contentStartOffset\(this\.mangaDisplay \? \(this\.listPaddingTop >= 0 \? this\.listPaddingTop : this\.listPaddingY\) : 0\)/,
  'manga tree top inset is a native content offset');
assert.match(listSource, /\.contentEndOffset\(this\.mangaDisplay \? this\.mangaCatalogDisplay \? 18 :\s*\(this\.listPaddingBottom >= 0 \? this\.listPaddingBottom : this\.listPaddingY\) \+ 14 : 0\)/,
  'manga tree bottom inset includes the demo internal 14vp through a native content offset');
const methods = productionMotionMethods(listPath, ['isCurrentNode','isCurrentMangaNode'], {});
for (const scheme of ['day', 'night'])
for (const kind of ['group', 'target', 'disabled'])
for (const current of [false, true])
for (const mangaRowMinHeight of [58, 50]) {
  const { owner } = createReaderBuilderProbe(listSource, ['mangaRow', 'mangaColor', 'displayLevel', 'mangaGroupNode', 'mangaGroupSpacing', 'mangaRowIndex', 'mangaRowPaddingLeft'], fontFamilies);
  const node = { nodeId: 'row', title: '标题含卷也不足以证明整卷内容', kind, depth: kind === 'group' ? 1 : 2,
    expanded: false, hasChildren: kind === 'group', chapterIndex: kind === 'target' ? 4 : undefined };
  Object.assign(owner, { mangaDisplay: true, mangaScheme: scheme, appThemeScheme: 'day', interactionEnabled: true,
    mangaRowMinHeight, currentChapterIndex: current ? 4 : -1, view: { identity: {}, currentVisibleIndex: 0 }, mangaPresentationRevision: 0, dataSource: { loadedNode: () => node, loadedItemById: () => ({node,index:0}), currentView: () => owner.view } });
  owner.isCurrentNode = methods.prototype.isCurrentNode.bind(owner);
  owner.isCurrentMangaNode = methods.prototype.isCurrentMangaNode.bind(owner);
  const clicks = [];
  owner.toggleNode = value => clicks.push(['fold', value.nodeId]);
  owner.selectTarget = value => { if (value.kind === 'target') clicks.push(['read', value.chapterIndex]); };
  owner.mangaRow({ node, index: 0 });
  const row = [...owner.nodes.values()].find(value => value.type === 'Row');
  assert.equal(row.constraintSize.minHeight, kind === 'group' ? 48 : mangaRowMinHeight);
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
  assert.equal(titles[0].fontWeight, kind === 'group' ? 600 : 400);
  assert.equal(titles[0].fontFamily, kind === 'group' ? fontFamilies.READER_FONT_NOTO_SANS_SC_UI_600 : selected ? fontFamilies.READER_FONT_NOTO_SANS_SC_UI_550 : fontFamilies.READER_FONT_NOTO_SANS_SC_UI_REGULAR);
  assert.equal(titles[0].fontColor, selected ? accent : kind === 'disabled' ?
    (scheme === 'night' ? '#ABA99F' : '#756F69') : (scheme === 'night' ? '#EAE7DE' : '#1F1B17'));
  assert.equal(row.backgroundColor, selected ? (scheme === 'night' ? '#303C2D' : '#E8EDE2') :
    kind === 'group' ? (scheme === 'night' ? '#30342D' : '#F0ECE3') : 'Color.Transparent');
  assert.equal(titles[0].maxLines, undefined, 'long manga title can naturally increase the row height');
  assert.equal(titles.some(value => value.create === '正在读'), selected, 'only the current readable target claims reading');
  assert.equal(titles.some(value => value.create === '整卷可读'), false, 'a volume title is not a format fact');
  assert.equal([...owner.nodes.values()].some(value => value.type === 'Image'), kind === 'group' || kind === 'target' && !current,
    'ordinary readable rows and groups have a chevron; current and disabled rows do not');
  row.onClick();
  assert.deepEqual(clicks, kind === 'group' ? [['fold', 'row']] : kind === 'target' ? [['read', 4]] : []);
}
{
  const { owner } = createReaderBuilderProbe(listSource, ['mangaRow', 'mangaColor', 'displayLevel', 'mangaGroupNode', 'mangaGroupSpacing', 'mangaRowIndex', 'mangaRowPaddingLeft'], fontFamilies);
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
    ['build', 'row', 'mangaRow', 'mangaColor', 'displayLevel', 'mangaGroupNode', 'mangaGroupSpacing', 'mangaRowIndex', 'mangaRowPaddingLeft', 'isCurrentMangaNode', 'isCurrentNode'], { ...fontFamilies, LazyForEach: lazyBoundary });
  Object.assign(owner, { mangaDisplay, mangaScheme: 'night', appThemeScheme: 'day', dataSource: {}, listPaddingX: 0,
    listPaddingRight: -1, listPaddingTop: -1, listPaddingBottom: -1, listPaddingY: 0, interactionEnabled: true });
  owner.initialRender();
  const list = [...owner.nodes.values()].find(node => node.type === 'List');
  assert.equal(list.border, undefined, 'the native List viewport has no fixed manga top line');
  assert.equal(list.contentEndOffset, mangaDisplay ? 14 : 0,
    'only manga list content gets internal spacing without consuming native viewport padding');
  assert.equal(list.padding.bottom, 0);
}
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('ReaderDirectoryNavigationList');
syntax.propCollection.set('ReaderDirectoryNavigationList', new Set([...listSource.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(match => match[1])));
class DirectoryChild { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const navigationSource = readFileSync(file('features/reading/ReaderDirectoryNavigationSurface.ets'), 'utf8');
for (const mangaDisplay of [false, true])
for (const [mangaCatalogDisplay, mangaCatalogNarrow] of [[false, false], [true, false], [true, true]]) {
  const { owner } = createReaderBuilderProbe(navigationSource, ['fallbackBuilder', 'build'], { ...fontFamilies, ReaderDirectoryNavigationList: DirectoryChild });
  let clears = 0;
  Object.assign(owner, { mangaDisplay, mangaFontsReady: true, mangaScheme: 'night', appThemeScheme: 'day', query: mangaCatalogDisplay ? '' : '没有此章节',
    mangaRowMinHeight: 50, mangaCatalogDisplay, mangaCatalogNarrow,
    view: { visibleTotal: 0 }, onClearSearch: () => clears++ });
  owner.initialRender();
  const nodes = [...owner.nodes.values()];
  assert.equal([...owner.children.values()][0].params.mangaRowMinHeight, 50, 'the manga-specific row height is forwarded through the actual SDK child props');
  assert.equal([...owner.children.values()][0].params.mangaCatalogDisplay, mangaCatalogDisplay);
  assert.equal([...owner.children.values()][0].params.mangaCatalogNarrow, mangaCatalogNarrow);
  assert.ok(nodes.some(node => node.type === 'Text' && node.create === (mangaDisplay ? mangaCatalogDisplay ? '暂无章节信息' : '没有匹配的章节' : '没有匹配的目录项')));
  const stack = nodes.find(node => node.type === 'Stack');
  assert.equal(stack.create.alignContent, mangaDisplay ? 'Alignment.TopStart' : 'Alignment.Center');
  const clear = nodes.find(node => node.type === 'Text' && node.create === '清除搜索');
  assert.equal(clear !== undefined, mangaDisplay && !mangaCatalogDisplay, 'novel and persistent catalog preserve passive empty state');
  if (clear !== undefined) {
    assert.equal(clear.fontColor, '#B9CEB1'); assert.equal(clear.height, 36); clear.onClick(); assert.equal(clears, 1);
    const empty = nodes.find(node => node.type === 'Column');
    assert.equal(empty.create.space, 8); assert.equal(empty.constraintSize.minHeight, 164);
    assert.equal(empty.border.width.top, 1); assert.equal(empty.border.color.top, '#3B4036',
      'the empty directory retains its content boundary without placing a line on List viewport');
    assert.deepEqual(empty.padding, { left: 12, right: 12, top: 36, bottom: 36 });
    assert.equal(nodes.find(node => node.type === 'Text' && node.create === '没有匹配的章节').fontSize, 12);
  }
  if (mangaDisplay && mangaCatalogDisplay) assert.equal(nodes.find(node => node.type === 'Column').border.width.top, 0);
}
for (const [name, props] of Object.entries({ PageBackBar: ['title','floating','centered'], NoCoverCover: ['coverWidth','coverHeight'] })) {
  syntax.componentCollection.customComponents.add(name); syntax.propCollection.set(name, new Set(props));
}
const { SurfaceWidthSpec, resolveHorizontalFrame } = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const { readerVisualSafeLeft, readerVisualSafeRight, readerInteractiveSafeTop, readerInteractiveSafeBottom } =
  await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { MangaBookPresentation } = await import('../entry/src/main/ets/features/manga/MangaBookPresentation.ts');
const metrics = { windowRect: { width: 390 }, systemInsets: { left: 0, right: 0, top: 48, bottom: 34 },
  cutoutInsets: {}, gestureInsets: {}, navigationInsets: {} };
const detailFile = file('features/bookshelf/LocalBookDetail.ets');
const detailSource = readFileSync(detailFile, 'utf8');
const detailMethods = ['contentFrame','dockFrame','liveWidth','safeLeft','safeRight','topInset','bottomInset',
  'displayIntro','chapterEmptyMessage','isCurrentChapter','chapterIndent','visibleToc','readingActionLabel','shelfActionLabel','hasCover'];
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const detailDeps = { SurfaceWidthSpec, resolveHorizontalFrame, readerVisualSafeLeft, readerVisualSafeRight,
  readerInteractiveSafeTop, readerInteractiveSafeBottom, MangaBookPresentation,
  ReaderWindowCoordinator: { metrics: () => metrics }, bookAuthorLabel: value => value, bookIntroText: value => value ?? '',
  PageBackBar: Child, NoCoverCover: Child, CHAPTER_PREVIEW_LIMIT: 20 };
const DetailMethods = productionMotionMethods(detailFile, detailMethods, detailDeps);
const { owner: detail } = createReaderBuilderProbe(detailSource, ['build','hero','metadataTag','readingFacts','summary','catalog','chapterRow','actionArea'], detailDeps);
Object.assign(detail, { viewportWidth: 390, readerWindowMetricsRevision: 1, appThemeScheme: 'day', sourceSwitchEnabled: true,
  book: { sourceId: 'source', bookId: 'book', contentKind: 'manga', title: '真实字段长标题', author: '作者', sourceName: '来源', intro: '简介',
    mangaPosition: { chapterIndex: 4, pageOrdinal: 7, totalPages: 24 } },
  toc: [{ index: 3, title: '卷组', navigable: false }, { index: 4, title: '可读目标', navigable: true }],
  introExpanded: false, collapsedGroups: [], shelfMessage: '', removing: false, inBookshelf: true,
  removalEnabled: true, adding: false, cancellingAdd: false, onBack() {}, onContinue() {}, onRemove() {} });
for (const name of detailMethods) detail[name] = DetailMethods.prototype[name].bind(detail);
detail.initialRender();
const bar = [...detail.children.values()].find(value => value.params.title === '书籍详情');
assert.equal(bar.params.centered, true); assert.equal(bar.params.floating, true);
const cover = [...detail.children.values()].find(value => value.params.coverWidth);
assert.equal(cover.params.coverWidth, 104); assert.equal(cover.params.coverHeight, 150);
const scroll = [...detail.nodes.values()].find(value => value.type === 'Scroll');
assert.equal(scroll.width, '100%'); assert.equal(scroll.height, '100%', 'floating bars never subtract the native scroll viewport');
const title = [...detail.nodes.values()].find(value => value.type === 'Text' && value.create === detail.book.title);
assert.equal(title.maxLines, 2); assert.equal(title.fontSize, 24);
const intro = [...detail.nodes.values()].find(value => value.type === 'Text' && value.create === '简介' && value.lineHeight === 24);
assert.equal(intro.maxLines, 3);
const dock = [...detail.nodes.values()].find(value => (value.type === 'Stack' || value.type === 'Row') && value.height === 68);
assert.equal(dock.width, 330); assert.equal(dock.borderRadius, 24);
console.log('PASS actual detail SDK Builder: full scroll viewport, 104×150 manga cover, centered floating header, two-line title, folded intro and floating dock');

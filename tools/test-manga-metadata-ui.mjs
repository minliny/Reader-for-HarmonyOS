import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
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
assert.match(listSource, /\.contentEndOffset\(this\.mangaDisplay \? \(this\.listPaddingBottom >= 0 \? this\.listPaddingBottom : this\.listPaddingY\) : 0\)/,
  'manga tree bottom inset is a native content offset');
const methods = productionMotionMethods(listPath, ['isCurrentNode','isCurrentMangaNode'], {});
for (const kind of ['group', 'target', 'disabled']) {
  const { owner } = createReaderBuilderProbe(listSource, ['mangaRow'], {});
  const node = { nodeId: 'row', title: '标题含卷也不足以证明整卷内容', kind, depth: 1, expanded: false, hasChildren: kind === 'group', chapterIndex: kind === 'target' ? 4 : undefined };
  Object.assign(owner, { mangaDisplay: true, mangaScheme: 'night', appThemeScheme: 'day', interactionEnabled: true, currentChapterIndex: 4,
    view: { currentVisibleIndex: 0 }, dataSource: { loadedNode: () => node } });
  owner.isCurrentNode = methods.prototype.isCurrentNode.bind(owner);
  owner.isCurrentMangaNode = methods.prototype.isCurrentMangaNode.bind(owner);
  const clicks = [];
  owner.toggleNode = value => clicks.push(['fold', value.nodeId]);
  owner.selectTarget = value => { if (value.kind === 'target') clicks.push(['read', value.chapterIndex]); };
  owner.mangaRow({ node, index: 0 });
  const row = [...owner.nodes.values()].find(value => value.type === 'Row');
  assert.equal(row.constraintSize.minHeight, kind === 'group' ? 44 : 58);
  const titles = [...owner.nodes.values()].filter(value => value.type === 'Text');
  assert.equal(titles[0].maxLines, undefined, 'long manga title can naturally increase the row height');
  assert.equal(titles.some(value => value.create === '正在读'), kind === 'target', 'only the current readable target claims reading');
  assert.equal(titles.some(value => value.create === '整卷可读'), false, 'a volume title is not a format fact');
  row.onClick();
  assert.deepEqual(clicks, kind === 'group' ? [['fold', 'row']] : kind === 'target' ? [['read', 4]] : []);
}
console.log('PASS actual manga directory SDK Builder and Core locate: group/target/disabled, independent folds, current target and natural height');
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
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
assert.equal(cover.params.coverWidth, 84); assert.equal(cover.params.coverHeight, 122);
const scroll = [...detail.nodes.values()].find(value => value.type === 'Scroll');
assert.equal(scroll.width, '100%'); assert.equal(scroll.height, '100%', 'floating bars never subtract the native scroll viewport');
const title = [...detail.nodes.values()].find(value => value.type === 'Text' && value.create === detail.book.title);
assert.equal(title.maxLines, 2); assert.equal(title.fontSize, 24);
const intro = [...detail.nodes.values()].find(value => value.type === 'Text' && value.create === '简介' && value.lineHeight === 24);
assert.equal(intro.maxLines, 3);
const dock = [...detail.nodes.values()].find(value => value.type === 'Row' && value.height === 68);
assert.equal(dock.width, 330); assert.equal(dock.borderRadius, 24);
console.log('PASS actual detail SDK Builder: full scroll viewport, 84×122 cover, centered floating header, two-line title, folded intro and floating dock');

import assert from 'node:assert/strict';
import {localBookDetailSdk, localBookDetailSource} from './lib/local-book-detail-sdk-probe.mjs';
import {MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryColor, mangaDirectoryContentTop} from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
import {ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
let metrics;
const {Component, Header} = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}});
const scaffold = owner => {
  const frame = [...owner.children.values()].find(child => child.params?.variant ===
    (owner.book.contentKind === 'manga' ? 'mangaDetail' : 'detail'));
  assert.ok(frame?.nodes, 'detail mounts the actual SDK public page scaffold');
  return frame;
};
const fixedHeaderFrame = owner => {
  const frame = [...scaffold(owner).nodes.values()].find(node => node.type === 'Column' && node.zIndex === 10);
  assert.ok(frame, 'header geometry belongs to the actual shared header slot');
  return frame;
};
// Execute the actual approved detail/header SDK actors. These are emitted
// attributes and owner callbacks, not a simulation of native layout/pixels.
for (const viewport of [320, 390, 800]) for (const count of [0, 1, 3, 20])
  for (const safeBottom of [0, 24, 48]) for (const safeTop of [0, 32]) {
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, viewport, 900), undefined,
    new ReaderInsetsVp(0, safeTop, 0, safeBottom));
  const owner = new Component(undefined, {}); const calls = [];
  Object.assign(owner, {appThemeScheme: 'day', readerWindowMetricsRevision: 1, viewportWidth: 0,
    book: {sourceId: 'local', bookId: 'layout', title: 'Book', author: 'Author', contentKind: 'text'},
    toc: Array.from({length: count}, (_, index) => ({index, title: `第${index + 1}章`})),
    shelfMessage: '加入书架失败，请重试', inBookshelf: true, removalEnabled: true,
    removing: false, adding: false, cancellingAdd: false, readingEnabled: true,
    admissionIdentity: 'original-detail', loadingMessage: '', readingBlockedReason: '',
    collapsedGroups: [], introExpanded: false, onContinue: () => calls.push('continue'),
    onRemove: identity => calls.push(['remove', identity]), onBack: () => calls.push('back')});
  owner.initialRender();
  const nodes = [...owner.nodes.values()], frameNodes = [...scaffold(owner).nodes.values()];
  const root = frameNodes.find(node => node.type === 'Stack');
  assert.equal(root.type, 'Stack'); assert.equal(root.create.alignContent, 'Alignment.Top');
  assert.equal(root.height, '100%'); assert.equal(root.width, '100%');
  const scroll = nodes.find(n => n.type === 'Scroll');
  assert.equal(scroll.scrollBar, 'BarState.Off', 'novel scroll presentation is unchanged');
  assert.equal(scroll.height, '100%'); assert.equal(scroll.width, '100%');
  assert.equal(scroll.layoutWeight, undefined); assert.equal(scroll.padding, undefined,
    'safe offsets and dock clearance do not shrink the full-viewport scroll actor');
  const contentWidth = Math.min(720, viewport - 40), contentEdge = (viewport - contentWidth) / 2;
  const content = nodes.find(n => n.type === 'Column' && n.width === contentWidth && n.padding?.top === safeTop + 76);
  assert.ok(content); assert.deepEqual(content.margin, {left: contentEdge, right: contentEdge});
  assert.deepEqual(content.padding, {top: safeTop + 76, bottom: safeBottom + 104});
  assert.equal(nodes.filter(n => n.type === 'Row' && n.constraintSize?.minHeight === 58).length, count,
    'the bounded preview shares the page scroll and retains every current chapter row');
  assert.equal(nodes.filter(n => n.type === 'Scroll').length, 1, 'no nested directory preview scroll');
  const footer = frameNodes.find(n => n.type === 'Stack' && n.create.alignContent === 'Alignment.Bottom');
  assert.deepEqual([footer.width, footer.height], ['100%', '100%']);
  assert.equal(footer.hitTestBehavior, 'HitTestMode.Transparent');
  assert.equal(footer.padding, undefined); assert.equal(footer.align, undefined,
    'the full-viewport footer owner places the centered dock without moving the page scroll');
  const dock = nodes.find(n => n.type === 'Stack' && n.height === 68);
  assert.equal(dock.create.alignContent, 'Alignment.Center');
  assert.equal(dock.width, Math.min(680, viewport - 60)); assert.equal(dock.padding, 9);
  const footerFrame = frameNodes.find(n => n.type === 'Column' && n.margin?.bottom === safeBottom + 12);
  assert.ok(footerFrame, 'the public footer slot owns the unchanged dock bottom offset');
  assert.deepEqual(footerFrame.margin, {bottom: safeBottom + 12});
  assert.equal(content.padding.bottom - (dock.height + footerFrame.margin.bottom), 24,
    'last content clears the actual dock and its live bottom margin with 24vp spare');
  const actions = nodes.find(n => n.type === 'Row' && n.height === 48);
  assert.equal(actions.width, '100%'); assert.equal(actions.create.space, 12);
  const buttons = nodes.filter(n => n.type === 'Text' && n.height === 48);
  assert.equal(buttons.length, 2); assert.equal(buttons[0].layoutWeight, 1);
  assert.equal(buttons[1].width, 94); assert.ok(dock.width - 18 - 12 - 94 > 0,
    'the primary action retains positive available width on the narrow viewport');
  assert.deepEqual(buttons.map(n => n.borderRadius), [16, 16]);
  buttons[0].onClick(); buttons[1].onClick();
  assert.deepEqual(calls, ['continue', ['remove', 'original-detail']]);
  const error = nodes.find(n => n.type === 'Text' && n.create === owner.shelfMessage);
  assert.ok(error.id > content.id && error.id < dock.id,
    'shelf error remains in scroll content before the floating overlay');
  const header = [...owner.children.values()].find(c => c instanceof Header);
  assert.ok(header.id > scroll.id && header.id < dock.id);
  assert.ok(fixedHeaderFrame(owner).zIndex < footer.zIndex,
    'public header/footer slots preserve the original overlay stacking order');
  assert.equal(header.floating, true); assert.equal(header.centered, true);
  const headerRow = [...header.nodes.values()].find(n => n.type === 'Row' && n.height === 52);
  assert.ok(headerRow); assert.equal(headerRow.hitTestBehavior, 'HitTestMode.Transparent');
  const headerOwner = fixedHeaderFrame(owner);
  assert.deepEqual(headerOwner.padding, {left: 16, right: 16});
  assert.deepEqual(headerOwner.margin, {top: safeTop + 8});
  assert.equal(content.padding.top - (headerOwner.margin.top + headerRow.height), 16,
    'first content clears the actual floating header without shrinking the viewport');
  const back = [...header.nodes.values()].find(n => n.type === 'Stack' && n.width === 44 && n.onClick);
  assert.ok(back); back.onClick(); assert.equal(calls.at(-1), 'back');
  for (const scheme of ['night', 'day']) {owner.appThemeScheme = scheme; owner.replay();}
}
{
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 390, 900));
  const toc = [{index: 5, title: '第一卷', level: 1, navigable: false},
    {index: 17, title: '12', level: 2, navigable: true},
    {index: 63, title: '13（上）', level: 2, navigable: true},
    {index: 67, title: '13（下）', level: 2, navigable: true}];
  const selected = [];
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}});
  Object.assign(sdk.owner, {viewportWidth: 390, appThemeScheme: 'day',
    book: {sourceId: 's', bookId: 'm', title: '漫画', author: '作者', contentKind: 'manga',
      mangaPosition: {chapterIndex: 67, chapterTitle: '13（下）', pageOrdinal: 2, totalPages: 8}},
    toc, onSelectChapter: index => selected.push(index)});
  sdk.owner.onBookChanged(); sdk.owner.mangaFontsReady = true; sdk.owner.initialRender();
  const child = [...sdk.owner.children.values()].find(value => value.row?.entries.some(entry => entry.index === 67));
  assert.ok(child?.nodes, 'general detail SDK composition mounts the actual shared manga child');
  const childNodes = [...child.nodes.values()];
  assert.ok(childNodes.some(node => node.type === 'Image' && node.width === 10 && node.height === 10),
    'the shared child emits its real compact current marker');
  const current = childNodes.find(node => node.onClick && node.accessibilityText?.includes('正在读'));
  assert.ok(current); current.onClick(); assert.deepEqual(selected, [67], 'actual shared child preserves canonical chapter identity');
  sdk.owner.toc = toc.map(entry => entry.index === 67 ? {...entry, title: '更新后的条目'} : entry);
  current.onClick(); assert.deepEqual(selected, [67], 'old actual child callbacks cannot target changed current catalog facts');
}
const mangaBook = {sourceId: 's', bookId: 'm', title: '漫画预览标题', author: '真实作者', sourceName: '实际来源',
  contentKind: 'manga', intro: '真实简介', mangaPosition: {chapterIndex: 17, chapterTitle: '当前章节', pageOrdinal: 2, totalPages: 8}};
function admitDetail(owner, extra = {}) {
  Object.assign(owner, {book: {...mangaBook}, toc: [{index: 17, title: '当前章节', navigable: true}],
    viewportWidth: metrics.windowRect.width, readerWindowMetricsRevision: 1, appThemeScheme: 'day',
    removing: false, removalEnabled: true, readingEnabled: true, inBookshelf: true, admissionIdentity: 's\0m',
    shelfMessage: '', onContinue() {}, onRemove() {}, onOpenDirectory() {}, onSwitchSource() {}, onBack() {}, ...extra});
  owner.onBookChanged();
}
function checkHeaderFrame(candidate = localBookDetailSource) {
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}}, {source: candidate});
  const cases = [
    {width: 320, left: 0, right: 0, expected: [16, 16, 288]},
    {width: 390, left: 0, right: 0, expected: [16, 16, 358]},
    {width: 800, left: 0, right: 0, expected: [126, 126, 548]},
    {width: 390, left: 44, right: 12, expected: [40, 16, 334]},
    {width: 390, left: 12, right: 44, expected: [16, 40, 334]},
  ];
  for (const {width, left, right, expected} of cases) for (const contentKind of ['manga', 'text']) {
    metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 900), undefined,
      new ReaderInsetsVp(left, 32, right, 24));
    const owner = new sdk.Component(undefined, {}), backCalls = [];
    admitDetail(owner, {book: {...mangaBook, contentKind}, onBack: () => backCalls.push('back')});
    owner.mangaFontsReady = true; owner.initialRender();
    const wrapper = fixedHeaderFrame(owner);
    const header = [...owner.children.values()].find(child => child instanceof sdk.Header);
    assert.ok(header?.nodes, 'the frame is bound to the actual shared Header child');
    if (contentKind === 'manga') {
      const frame = owner.headerFrame();
      assert.deepEqual([frame.left, frame.right, frame.width], expected,
        'manga detail uses the same content-frame expansion and 548vp demo cap');
      assert.deepEqual(wrapper.padding, {left: expected[0], right: expected[1]});
      assert.deepEqual(wrapper.margin, {top: 40});
      assert.equal(width - wrapper.padding.left - wrapper.padding.right, expected[2],
        'the actual wrapper paints the generated header width');
      const bar = [...header.nodes.values()].find(node => node.type === 'Row');
      assert.equal(bar.width, '100%'); assert.deepEqual(bar.padding, {left: 3, right: 3});
      assert.equal(bar.border.width, 1);
      assert.ok(wrapper.padding.left + bar.padding.left + bar.border.width >= left);
      assert.ok(wrapper.padding.right + bar.padding.right + bar.border.width >= right,
        'asymmetric safe edges remain outside the actual header action insets');
    } else {
      assert.equal(header.variant, 'standard');
      assert.deepEqual(wrapper.padding, {left: 16 + left, right: 16 + right},
        'novel detail preserves its original independent header geometry');
      assert.deepEqual(wrapper.margin, {top: 40}, 'novel header retains the original safe-top offset');
    }
    const back = [...header.nodes.values()].find(node => typeof node.onClick === 'function');
    back.onClick(); assert.deepEqual(backCalls, ['back']);
  }
}
checkHeaderFrame();
const uncappedHeader = localBookDetailSource
  .replace("this.book.contentKind === 'manga' ? this.headerFrame().left : 16 + this.safeLeft()", '16 + this.safeLeft()')
  .replace("this.book.contentKind === 'manga' ? this.headerFrame().right : 16 + this.safeRight()", '16 + this.safeRight()');
assert.notEqual(uncappedHeader, localBookDetailSource);
assert.throws(() => checkHeaderFrame(uncappedHeader), /deep-equal/, 'the old uncapped manga wrapper is rejected');
const transposedHeader = localBookDetailSource.replace(
  'Math.max(0, frame.right - expansion), frame.width + expansion * 2',
  'frame.width + expansion * 2, Math.max(0, frame.right - expansion)');
assert.notEqual(transposedHeader, localBookDetailSource);
assert.throws(() => checkHeaderFrame(transposedHeader), /548vp demo cap/, 'misordered frame coordinates are rejected');
const leakedNovelHeader = localBookDetailSource.replace('this.headerFrame().left : 16 + this.safeLeft()', 'this.headerFrame().left : this.headerFrame().left');
assert.notEqual(leakedNovelHeader, localBookDetailSource);
assert.throws(() => checkHeaderFrame(leakedNovelHeader), /original independent header geometry/, 'manga cap cannot replace novel geometry');
function checkRetainedPreview(candidate = localBookDetailSource) {
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 390, 900));
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}}, {source: candidate});
  const owner = sdk.owner, selections = [], refreshedSelections = [];
  const initial = Object.freeze({index: 17, title: '旧命名章节', level: 1, navigable: true, downloadState: 'unknown'});
  admitDetail(owner, {toc: [initial], onSelectChapter: index => selections.push(index)});
  owner.mangaFontsReady = true; owner.initialRender();
  const child = [...owner.children.values()].find(value => value.row?.entries.some(entry => entry.index === 17));
  assert.ok(child?.nodes, 'the retained preview mounts the actual shared row');
  const childrenCount = owner.children.size, scroll = [...owner.nodes.values()].find(node => node.type === 'Scroll');
  const title = [...child.nodes.values()].find(node => node.type === 'Text' && node.create === initial.title);
  const action = [...child.nodes.values()].find(node => node.onClick && node.accessibilityText?.includes(initial.title));
  assert.ok(title && action); action.onClick(); assert.deepEqual(selections, [17]);
  const next = Object.freeze({index: 17, title: '新命名章节', level: 2, navigable: undefined, downloadState: 'queued'});
  owner.onSelectChapter = index => refreshedSelections.push(index);
  owner.updateStateVars({book: owner.book, toc: [next], removing: false}); sdk.properties.flush();
  assert.equal(owner.mangaPreviewRows[0].entries[0].title, next.title);
  assert.deepEqual({...child.row.entries[0]}, next,
    'the same-key actual child receives the fresh canonical row and metadata');
  assert.equal(owner.children.get(child.id), child); assert.equal(owner.children.size, childrenCount,
    'same-key row refresh preserves child identity rather than remounting');
  assert.equal([...owner.nodes.values()].find(node => node.type === 'Scroll'), scroll);
  assert.equal(title.create, next.title, 'the retained native Text consumes the new row title');
  assert.ok(action.accessibilityText.includes('状态待确认'));
  action.onClick(); assert.deepEqual(selections, [17]);
  assert.deepEqual(refreshedSelections, [17], 'the retained click resolves current facts, current callback and canonical target');
  const numeric = Object.freeze({index: 17, title: '03', level: 2, navigable: true, downloadState: 'completed'});
  owner.updateStateVars({book: owner.book, toc: [numeric], removing: false}); sdk.properties.flush();
  assert.equal(child.row.kind, 'numeric', 'same child receives the new generated layout kind');
  assert.deepEqual({...child.row.entries[0]}, numeric); assert.equal(child.row.labels[0].kind, 'numeric');
  assert.equal(child.row.labels[0].numberText, '03');
  assert.equal(owner.children.get(child.id), child); assert.equal(owner.children.size, childrenCount);
  action.onClick(); assert.deepEqual(refreshedSelections, [17, 17]);
  assert.equal(initial.title, '旧命名章节', 'the original captured Builder argument remains immutable');
  owner.updateStateVars({book: owner.book, toc: owner.toc, removing: true}); sdk.properties.flush();
  action.onClick(); assert.deepEqual(refreshedSelections, [17, 17], 'live mutation state shields the retained row action');
  owner.updateStateVars({book: owner.book, removing: false, toc: []}); sdk.properties.flush();
  assert.deepEqual(owner.liveMangaPreviewRow({kind: 'row', columns: 1, startIndex: 0, entries: [initial], labels: []}).entries, [],
    'a removed row resolves to empty current facts instead of the original row');
  action.onClick(); assert.deepEqual(refreshedSelections, [17, 17], 'removed current facts reject retained old clicks');
  // The installed SDK's property classes and actual parent/child Builders run;
  // the probe does not simulate compositor removal or row/grid branch layout.
}
checkRetainedPreview();
const capturedPreview = localBookDetailSource.replace('row: this.liveMangaPreviewRow(row),', 'row: row,');
assert.notEqual(capturedPreview, localBookDetailSource);
assert.throws(() => checkRetainedPreview(capturedPreview), /fresh canonical row and metadata/,
  'initial ForEach row capture cannot supply a retained child');
const remountedPreview = localBookDetailSource.replace(
  'row.entries.map((entry: LocalReadingTocEntry): number => entry.index)]));',
  'row.entries.map((entry: LocalReadingTocEntry): string => entry.title)]));');
assert.notEqual(remountedPreview, localBookDetailSource);
assert.throws(() => checkRetainedPreview(remountedPreview), /preserves child identity/,
  'title changes cannot replace the canonical row key and remount the child');
const capturedPreviewCallback = localBookDetailSource.replace(
  'this.selectMangaPreviewEntry(entry),', 'this.selectMangaPreviewEntry(row.entries[0]),');
assert.notEqual(capturedPreviewCallback, localBookDetailSource);
assert.throws(() => checkRetainedPreview(capturedPreviewCallback), /current callback and canonical target/,
  'retained selection must consume the child current entry instead of its original ForEach row');
function checkMangaGeometry(candidate = localBookDetailSource) {
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}}, {source: candidate});
  for (const width of [320, 390, 800]) for (const scale of [1, 2, 3.2]) for (const scheme of ['day', 'night']) {
    metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 900)); metrics.systemFontScale = scale;
    const owner = new sdk.Component(undefined, {}), actions = [];
    admitDetail(owner, {appThemeScheme: scheme, sourceSwitchEnabled: true,
      book: {...mangaBook, coverUrl: 'https://example.invalid/cover.png', lastChapter: '最新事实'},
      onSwitchSource: () => actions.push('switch'), onOpenDirectory: () => actions.push('directory')});
    // This geometry probe starts after an independently checked font receipt.
    // The deferred first-paint admission is tested below, not bypassed in app code.
    owner.mangaFontsReady = true; owner.initialRender();
    const nodes = [...owner.nodes.values()];
    const hero = nodes.find(node => node.type === 'Row' && node.create.space === 18 && node.padding?.top === 2);
    assert.ok(hero); assert.equal(hero.alignItems, 'VerticalAlign.Center');
    const cover = nodes.find(node => node.type === 'Image' && node.create === 'https://example.invalid/cover.png');
    assert.deepEqual([cover.width, cover.height, cover.borderRadius], [84, 122, 8]);
    const title = nodes.find(node => node.type === 'Text' && node.create === mangaBook.title);
    assert.deepEqual([title.fontSize, title.lineHeight, title.fontWeight, title.maxLines], [24, 34, 700, 2]);
    assert.equal(title.maxFontScale, scale); assert.equal(title.halfLeading, true);
    const author = nodes.find(node => node.type === 'Text' && node.create === mangaBook.author);
    assert.deepEqual([author.fontSize, author.lineHeight, author.maxLines], [13, 20, undefined]);
    assert.equal(author.fontColor, mangaDirectoryColor('muted', scheme));
    const tag = nodes.find(node => node.type === 'Text' && node.create === '漫画');
    assert.deepEqual([tag.width, tag.height], [Math.max(30, 18 * scale + 12), Math.max(16, 14 * scale + 2)]);
    const position = nodes.find(node => node.type === 'Column' && node.padding?.top === 13);
    assert.deepEqual(position.padding, {left: 14, right: 14, top: 13, bottom: 13});
    assert.equal(position.create.space, 5); assert.equal(position.borderRadius, 12); assert.equal(position.border, undefined);
    assert.deepEqual(position.margin, {top: 24}); assert.equal(position.backgroundColor, mangaDirectoryColor('soft', scheme));
    const chapter = nodes.find(node => node.type === 'Text' && node.create === '当前章节' && node.fontSize === 12);
    assert.equal(chapter.lineHeight, 19, 'fp setter stays unscaled; native font scale is applied once');
    assert.equal(chapter.fontWeight, 500);
    const page = nodes.find(node => node.type === 'Text' && node.create === '3 / 8 页');
    assert.deepEqual([page.fontSize, page.lineHeight, page.fontFeature], [11, 19, "'tnum' 1"]);
    const content = nodes.find(node => node.type === 'Column' && node.padding?.top === mangaDirectoryContentTop(scale));
    assert.equal(nodes.find(node => node.type === 'Scroll').scrollBar, 'BarState.Auto');
    assert.equal(nodes.find(node => node.type === 'Scroll').scrollBarWidth, 4);
    assert.equal(nodes.find(node => node.type === 'Scroll').scrollBarColor, '#47000000');
    const count = nodes.find(node => node.type === 'Text' && node.create === owner.mangaSummaryLabel() && node.fontSize === 11 && node.lineHeight === 17);
    assert.ok(count, 'catalog count retains the independent 11/17 block below its heading');
    assert.equal(content.width, Math.min(540, width - 40)); assert.equal(content.create.space, 0);
    const header = [...owner.children.values()].find(child => child instanceof sdk.Header);
    assert.equal(header.variant, 'mangaDirectory');
    assert.equal(header.backIcon, `app.media.manga_directory_back${scheme === 'night' ? '_theme_night' : ''}`);
    const heading = nodes.find(node => node.type === 'Text' && node.create === '章节目录');
    assert.deepEqual([heading.fontSize, heading.lineHeight, heading.fontWeight], [17, 25, [650, {enableVariableFontWeight: true}]]);
    assert.ok(nodes.some(node => node.create === '最新：最新事实'), 'business latest facts survive the visual conversion');
    nodes.find(node => node.create === '换源').onClick();
    nodes.find(node => node.type === 'Row' && node.onClick && node.constraintSize?.minHeight === 36 && node.flexShrink === 0).onClick();
    assert.deepEqual(actions, ['switch', 'directory']);
    const dock = nodes.find(node => node.type === 'Stack' && node.constraintSize?.minHeight === 68);
    assert.equal(dock.height, undefined, 'large-font actions can grow instead of clipping inside a fixed dock');
    dock.onAreaChange({}, {height: 180});
    assert.equal(owner.mangaContentBottomInset(), 223, 'real measured dock height reserves the matching scroll clearance');
    const primary = nodes.find(node => node.create === '继续阅读');
    assert.deepEqual([primary.height, primary.constraintSize.minHeight, primary.fontSize, primary.lineHeight], [undefined, 48, 14, 21]);
    assert.equal(primary.maxFontScale, scale);
  }
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 390, 900)); metrics.systemFontScale = 3.2;
  const art = new sdk.Component(undefined, {}); admitDetail(art); art.mangaFontsReady = true; art.initialRender();
  const artNodes = [...art.nodes.values()], printed = artNodes.find(node => node.create === mangaBook.title && node.fontSize === 19);
  assert.deepEqual([printed.lineHeight, printed.minFontScale, printed.maxFontScale], [27, 1, 1], 'cover lettering stays printed art while the UI title scales');
}
checkMangaGeometry();
{
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 320, 900)); metrics.systemFontScale = 3.2;
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}});
  const actor = new sdk.Component(undefined, {});
  admitDetail(actor, {book: {...mangaBook, mangaPosition: {...mangaBook.mangaPosition, totalPages: 999999999999999}}});
  actor.mangaFontsReady = true; actor.initialRender();
  const rendered = [...actor.nodes.values()];
  const chapter = rendered.find(node => node.type === 'Text' && node.create === '当前章节' && node.fontSize === 12);
  const page = rendered.find(node => node.type === 'Text' && node.create === '3 / 999999999999999 页');
  assert.equal(chapter.width, '100%', 'stacked chapter retains the full available title lane');
  assert.equal(chapter.layoutWeight, 0); assert.equal(page.width, '100%');
  assert.equal(page.maxLines, undefined, 'long position counts wrap naturally rather than stealing the title lane');
  assert.equal(page.textAlign, 'TextAlign.Start');
}
const oldCover = localBookDetailSource.replaceAll('visual.heroWidth', '104');
assert.notEqual(oldCover, localBookDetailSource); assert.throws(() => checkMangaGeometry(oldCover), /deep-equal/);
const doubledFp = localBookDetailSource.replace('.lineHeight(visual.positionLineHeight)', '.lineHeight(visual.positionLineHeight * this.mangaFontScale())');
assert.notEqual(doubledFp, localBookDetailSource); assert.throws(() => checkMangaGeometry(doubledFp), /fp setter stays unscaled/);

const deferred = () => {let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};};
const nextFrame = () => new Promise(done => setImmediate(done));
async function checkFontAdmission(candidate = localBookDetailSource, scenario = 'identity') {
  const receipts = [], requests = [];
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics},
    prepareReaderFontFamily: async family => requests.push(family),
    prepareMangaSheetFonts: () => {const receipt = deferred(); receipts.push(receipt); return receipt.promise;}}, {source: candidate});
  const owner = sdk.owner; admitDetail(owner); owner.aboutToAppear(); await nextFrame();
  assert.equal(receipts.length, 1); assert.equal(owner.mangaFontsReady, false);
  owner.initialRender(); assert.equal([...owner.children.values()].some(child => child instanceof sdk.Header), false,
    'first manga header and glyphs wait for checked font receipts');
  if (scenario === 'identity') {
    owner.book = {...mangaBook, bookId: 'next'}; owner.onBookChanged(); await nextFrame();
    assert.equal(receipts.length, 2); receipts[0].resolve(true); await nextFrame();
    assert.equal(owner.mangaFontsReady, false, 'late prior-book font callback cannot admit the replacement detail');
    receipts[1].resolve(true); await nextFrame(); sdk.properties.flush();
    assert.equal(owner.mangaFontsReady, true);
    // The shared CPU probe deliberately does not simulate removal of the
    // loading Column branch. Lower the real admitted branch in a fresh actor;
    // native branch scheduling and first pixels remain a renderer gate.
    const admitted = new sdk.Component(undefined, {}); admitDetail(admitted, {book: owner.book});
    admitted.mangaFontsReady = owner.mangaFontsReady; admitted.initialRender();
    assert.ok([...admitted.children.values()].some(child => child instanceof sdk.Header));
  } else if (scenario === 'unmount') {
    owner.aboutToDisappear(); receipts[0].resolve(true); await nextFrame();
    assert.equal(owner.mangaFontsReady, false, 'late font receipt cannot paint a retired detail');
  } else {
    receipts[0].reject(new Error('checked font failure')); await nextFrame(); sdk.properties.flush();
    assert.equal(owner.mangaFontsFailed, true); assert.equal(owner.mangaFontsReady, false);
    owner.prepareMangaDetailFonts(); await nextFrame(); receipts[1].resolve(true); await nextFrame();
    assert.equal(owner.mangaFontsReady, true); assert.equal(owner.mangaFontsFailed, false);
  }
  assert.ok(requests.every(family => family === 'ReaderNotoSerifSCBold'));
}
await checkFontAdmission(); await checkFontAdmission(localBookDetailSource, 'unmount'); await checkFontAdmission(localBookDetailSource, 'retry');
const unfencedFonts = localBookDetailSource.replaceAll('!this.mounted || generation !== this.mangaFontGeneration || identity !== this.mangaFontIdentity || ', '');
assert.notEqual(unfencedFonts, localBookDetailSource);
await assert.rejects(() => checkFontAdmission(unfencedFonts), /late prior-book font callback/);
const earlyGlyphs = localBookDetailSource.replace("this.book.contentKind !== 'manga' || this.mangaFontsReady", 'true');
assert.notEqual(earlyGlyphs, localBookDetailSource);
await assert.rejects(() => checkFontAdmission(earlyGlyphs), /first manga header and glyphs/);
console.log('PASS actual SDK detail/header: novels retain original geometry; manga header548 cap/asymmetric safe edges, cover84x122, title24/34, fixed printed art, position12/19/500, section17/25/650,320/390/800vp ×font1/2/3.2×day/night, natural dock and measured clearance; same-key row/title/metadata/kind/current-click updates retain child and Scroll, checked fonts fence identity/unmount/failure/retry. Negative uncapped/transposed/novel-leak/captured-row/remount/old-cover/double-fp/early/late controls rejected; native branch layout/pixels remain unverified');

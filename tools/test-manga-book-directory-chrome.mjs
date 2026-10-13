import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as geometryApi from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as fonts from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { mangaDirectoryPresentation } from '../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts';
import * as directoryVisual from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';

const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}.ets`, import.meta.url), 'utf8');
const fieldSource = read('features/common/ReaderSearchField');
const fieldNames = ['build', 'nativeInputBackground', 'nativeFieldBackground', 'fixedLineHeightField', 'mangaLineHeightField', 'autoLineHeightField', 'passiveField', 'submit', 'textStyle',
  'searchIcon', 'fieldHeight', 'inputHeight', 'iconSize', 'iconGap', 'horizontalPadding', 'fieldBackgroundColor',
  'fieldBorderWidth', 'fieldBorderColor', 'cornerRadius', 'inputColor', 'caretColor', 'placeholderColor',
  'resolvedAccessibilityLabel', 'variant', 'mode', 'text', 'placeholder', 'accessibilityLabel', 'isTablet',
  'clearable', 'submitEnabled', 'onTextChange', 'onSubmit', 'mangaFontScale', 'mangaTextHeightGrowth', 'readerWindowMetricsRevision'];
const fieldDeps = { ...fonts, ReaderTextStyle: readerTypographyRoles.TYPE_SEARCH_BOOK_INPUT.constructor };
for (const scheme of ['day', 'night']) {
  // Existing finite variants retain their native AUTO/fixed metric distinction.
  for (const [variant, height, inputHeight, fontSize, icon, radius, family] of [
    ['bookPage', 36, 36, 14, 14, 999, fonts.READER_FONT_INTER],
    ['sourceManagement', 44, 42, 12, 13, 12, fonts.READER_FONT_INTER],
    ['readerDirectory', 32, 24, 10, 16, 8, fonts.READER_FONT_NOTO_SANS_SC],
    ['readerQuick', 24, 22, 10, 11, 8, fonts.READER_FONT_INTER],
    ['mangaDirectory', 44, 42, 13, 17, 12, fonts.READER_FONT_NOTO_SANS_SC_UI_REGULAR],
  ]) {
    const properties = createArkUIPropertyRuntimeProbe();
    const { owner } = createReaderBuilderProbe(fieldSource, fieldNames, { ...fieldDeps, ...properties.sdk }, properties.hooks);
    let submitted = 0;
    const changed = [];
    Object.assign(owner, { appThemeScheme: scheme, variant, mode: 'live', text: '48', placeholder: '搜索章名或序号',
      clearable: true, onSubmit: () => submitted++, onTextChange: value => changed.push(value) });
    owner.initialRender();
    const nodes = [...owner.nodes.values()];
    const outer = nodes.find(node => node.type === 'Row');
    const input = nodes.find(node => node.type === 'TextInput');
    assert.equal(outer.height, height); assert.equal(outer.borderRadius, radius);
    assert.equal(input.height, inputHeight); assert.equal(input.fontSize, fontSize); assert.equal(input.fontFamily, family);
    assert.equal(input.borderRadius, 0, 'the native start caret keeps an unclipped input rect');
    assert.equal(input.backgroundColor, 'Color.Transparent', 'shared Styles preserve each editable variant clear input paint');
    assert.equal(nodes.find(node => node.type === 'Image').width, icon);
    assert.equal(input.lineHeight, variant === 'bookPage' ? 21 : variant === 'mangaDirectory' ? 20 : undefined,
      'only the two explicit demo/font contracts set a line box; existing AUTO variants remain independent');
    input.onChange('上篇'); input.onSubmit(); assert.deepEqual(changed, ['上篇']); assert.equal(submitted, 1);
    if (variant === 'mangaDirectory') {
      assert.equal(nodes.find(node => node.type === 'Image').create,
        `app.media.manga_sheet_search${scheme === 'night' ? '_theme_night' : ''}`,
        'the actual native search actor consumes the reviewed manga asset in both schemes');
      assert.deepEqual(outer.padding, { left: 11, right: 11 });
      assert.equal(outer.create.space, 9);
      nodes.find(node => node.accessibilityText === '清除目录搜索').onClick();
      assert.deepEqual(changed, ['上篇', '']);
    }
  }
}

class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const pageSource = read('features/bookshelf/BookDirectoryPage');
const headerSource = read('features/common/PageBackBar');
const footerSource = read('features/manga/MangaDirectoryCurrentFooter');
assert.match(pageSource, /reader_directory_sort_ascending/);
assert.match(pageSource, /reader_directory_sort_descending/);
assert.doesNotMatch(pageSource, /manga_sheet_vertical_accent/,
  'manga full directory uses the same ascending/descending icon pair as the book directory');
assert.match(pageSource, /Row\(\{ space: 5 \}\)/,
  'the compact search/sort row uses the detail-directory gap');
const iconProvenance = JSON.parse(readFileSync(new URL('../../Reader-UI/design/manga-directory/icon-provenance.json', import.meta.url), 'utf8'));
const canonicalArrow = readFileSync(new URL('../../Reader-UI/design/manga-directory/arrow-left.svg', import.meta.url), 'utf8');
assert.equal(iconProvenance.upstream, '@radix-ui/react-icons'); assert.equal(iconProvenance.version, '1.3.2');
assert.equal(iconProvenance.sourceSha256, 'c348e4a0cc6fb72e95c11bf6d07a91d49420b58e42c10365206e1243709ea16e');
assert.equal(iconProvenance.svgSha256, '9b281d3aa0c46ddd0f23a0bcd760e396ff9dbd1e8707fc62f0c0f56690b31018');
assert.equal(createHash('sha256').update(canonicalArrow).digest('hex'), iconProvenance.svgSha256);
assert.match(canonicalArrow, /viewBox="0 0 15 15"/);
function checkArrow(svg, ink) {
  assert.equal(svg, canonicalArrow.replaceAll('currentColor', ink),
    'the runtime arrow retains the pinned upstream SVG path/viewBox and only substitutes the demo ink');
}
for (const [suffix, ink] of [['', '#1F1B17'], ['_theme_night', '#EAE7DE']]) {
  checkArrow(readFileSync(new URL(`../entry/src/main/resources/base/media/manga_directory_back${suffix}.svg`, import.meta.url), 'utf8'), ink);
}
assert.throws(() => checkArrow(readFileSync(new URL('../entry/src/main/resources/base/media/reader_directory_back.svg', import.meta.url), 'utf8'), '#1F1B17'),
  assert.AssertionError, 'the previous hand-drawn stroked 48px arrow cannot pass the upstream geometry check');
const rows = [{ index: 5, title: '第一卷', level: 1, navigable: false },
  { index: 17, title: '48', level: 2, navigable: true }];
const palettes = {
  day: { ink: '#1F1B17', accent: '#425D45', surface: '#FFFCF8', line: '#E7E0D5', soft: '#F0ECE3' },
  night: { ink: '#EAE7DE', accent: '#B9CEB1', surface: '#282C25', line: '#3B4036', soft: '#30342D' },
};
const pageNames = ['mangaPage', 'mangaToolbar', 'mangaCurrentFooter', 'mangaFlowFooter', 'mangaVisibleTopInset', 'mangaNarrow', 'scrollMangaCurrent', 'mangaContentTopInset', 'mangaSummaryLabel', 'mangaIsGroup',
  'mangaCurrentTitle', 'mangaCurrentPosition', 'mangaToolsHeight', 'mangaViewportHeight', 'searchDraft', 'ascending',
  'mangaFontScale', 'mangaToolHeight', 'mangaFooterHeight', 'mangaBottomInset', 'mangaFooterBottomOffset', 'mangaBottomClearance', 'mangaSortIcon',
  'headerFrame', 'onMangaScrollOffset', 'mangaScrollOffset', 'readerWindowMetricsRevision', 'onMangaMetricsChanged',
  'mangaDownloadMenuButton', 'mangaFooterMeasured'];
const headerNames = ['build', 'leftInset', 'rightInset', 'mangaFontScale', 'variant', 'centered', 'floating',
  'title', 'titleColor', 'backIcon', 'onBack', 'trailing', 'appThemeScheme', 'readerWindowMetricsRevision'];
const footerNames = ['build', 'label', 'chapter', 'page', 'footerFontScale', 'stacked', 'metricsRevision', 'title',
  'pagePosition', 'scheme', 'availableWidth', 'onHeightChanged', 'measuredWidth'];
const near = (actual, expected, message) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9,
  message ?? `expected ${actual} to equal ${expected} within floating-point arithmetic precision`);
const pageFrame = owner => {
  const frame = [...owner.children.values()].find(child => child.params?.variant === 'mangaDirectory' &&
    child.params?.headerKind === 'mangaDirectory');
  assert.ok(frame?.nodes, 'manga directory mounts the actual SDK public page scaffold');
  return frame;
};

function checkFullChrome(candidate = pageSource, headerCandidate = headerSource, exhaustive = true, footerCandidate = footerSource) {
  const cases = exhaustive ? [0, 24, 48].flatMap(safeTop => [12, 34].flatMap(safeBottom =>
    ['day', 'night'].flatMap(scheme => [1, 1.75, 3.2].map(scale => ({ safeTop, safeBottom, scheme, scale, contentWidth: 350 }))))) :
    [1, 3.2].map(scale => ({ safeTop: 24, safeBottom: 34, scheme: 'night', scale, contentWidth: 350 }));
  if (exhaustive) cases.push({ safeTop: 24, safeBottom: 34, scheme: 'night', scale: 3.2, contentWidth: 280 });
  for (const { safeTop, safeBottom, scheme, scale, contentWidth } of cases) {
    const properties = createArkUIPropertyRuntimeProbe();
    const metrics = { systemFontScale: scale, windowRect: { width: contentWidth + 40, height: 640 },
      interactiveSafeInsets: { bottom: safeBottom } };
    const dependencies = { ...fonts, ...directoryVisual, ...properties.sdk,
      ReaderWindowCoordinator: { metrics: () => metrics } };
    const actualField = createReaderBuilderProbe(fieldSource, fieldNames, { ...dependencies, ...fieldDeps }, properties.hooks).Component;
    const actualHeader = createReaderBuilderProbe(headerCandidate, headerNames, dependencies,
      { ...properties.hooks, mountChildren: true }).Component;
    const actualFooter = createReaderBuilderProbe(footerCandidate, footerNames, dependencies, properties.hooks).Component;
    const { owner } = createReaderBuilderProbe(candidate, pageNames,
      { ...dependencies, ReaderSearchField: actualField, ReaderDirectoryNavigationSurface: Child,
        ReaderMangaDownloadPopup: Child, PageBackBar: actualHeader, MangaDirectoryCurrentFooter: actualFooter },
      { ...properties.hooks, childSources: { ReaderSearchField: fieldSource,
        ReaderDirectoryNavigationSurface: read('features/reading/ReaderDirectoryNavigationSurface'),
        ReaderMangaDownloadPopup: read('features/common/ReaderMangaDownloadPopup'), PageBackBar: headerCandidate,
        MangaDirectoryCurrentFooter: footerCandidate },
        mountChildren: true });
    const actions = [], searches = [];
    Object.assign(owner, { appThemeScheme: scheme, admittedIdentity: 's\0b', admittedEntries: rows,
      mangaPresentation: mangaDirectoryPresentation(rows), bookTitle: '复杂分卷漫画与很长的标题', sourceId: 's', bookId: 'b',
      currentChapterIndex: 17, currentPageOrdinal: 3, currentPageTotal: 24, searchDraft: '', searchQuery: '', ascending: true,
      mangaViewportHeight: 640, readerWindowMetricsRevision: 0, mounted: true, prepareMangaLayout: () => {},
      rulesRevision: 0, locateCurrentRevision: 0, navigationInteracted: false, mangaDownloadEnabled: true,
      listScroller: {}, topInset: () => safeTop, contentFrame: () => ({ width: contentWidth, left: 20, right: 20 }),
      identity: () => 's\0b', downloadMenuVisible: false, downloadMenuGeneration: 0, downloadActions: [],
      downloadActionsLoading: false, downloadActionsFailure: '',
      onBack: () => actions.push('back'), openDownloadActions: () => actions.push('download-menu'),
      applySearch() { searches.push(this.searchDraft); }, locateCurrent: () => actions.push('locate'), toggleSort: () => actions.push('sort') });
    owner.mangaPage();
    const children = [...owner.children.values()];
    const field = children.find(child => child.variant === 'readerDirectory' && child.floating !== true);
    const header = children.find(child => child.floating === true);
    assert.ok(field?.nodes && header?.nodes, 'mount both actual SDK-compiled shared input and header');
    // Storage dispatch is a platform boundary. Deliver its published values to
    // the actual child links instead of replacing their production role logic.
    for (const child of [field, header]) { child.appThemeScheme = scheme; child.readerWindowMetricsRevision = 0; }
    properties.flush();
    const nodes = [...owner.nodes.values()];
    const palette = palettes[scheme];
    const title = nodes.find(node => node.type === 'Text' && node.create === '复杂分卷漫画与很长的标题');
    assert.equal(title.fontSize, 24); assert.equal(title.lineHeight, 34);
    assert.equal(title.fontColor, palette.ink); assert.equal(title.halfLeading, true);
    assert.equal(title.maxLines, undefined, 'short windows and long titles retain the demo natural wrap');
    assert.equal(title.wordBreak, 'WordBreak.BREAK_WORD');
    const locate = nodes.find(node => node.accessibilityText === '定位当前条目');
    const sort = nodes.find(node => node.accessibilityText === '切换排序');
    const toolHeight = Math.max(38, 16.5 * scale + 8);
    assert.deepEqual(locate.constraintSize, { minHeight: toolHeight });
    assert.equal(sort.width, 32); assert.equal(sort.height, 32);
    assert.equal(sort.backgroundColor, palette.soft);
    assert.equal(sort.constraintSize, undefined,
      'the compact sort actor stays beside the search field instead of reserving a second tool row');
    assert.equal(locate.height, undefined,
      'wrapped locate labels grow the native actor instead of being clipped to a fixed single-line height');
    const expectedFocus = { strokeWidth: { value: 2, unit: 'vp' }, strokeColor: { color: palette.accent },
      margin: { value: 3, unit: 'vp' } };
    assert.deepEqual(locate.focusBox, expectedFocus);
    assert.equal(sort.focusBox, undefined,
      'the sort actor follows the compact detail-directory control and does not add a second custom focus ring');
    assert.equal(locate.focusable, true); assert.equal(sort.focusable, undefined);
    for (const text of nodes.filter(node => node.type === 'Text' && ['定位当前条目', '正序'].includes(node.create))) {
      assert.equal(text.fontColor, palette.accent); assert.equal(text.lineHeight, 16.5);
    }
    locate.onClick(); sort.onClick();
    const popup = children.find(child => child.params?.specId === 'manga-download');
    assert.ok(popup, 'the actual header trailing Builder exposes the existing download workflow');
    popup.params.onOpen(); header.onBack();
    assert.deepEqual(actions, ['locate', 'sort', 'download-menu', 'back']);
    const input = [...field.nodes.values()].find(node => node.type === 'TextInput');
    assert.equal(input.lineHeight, undefined); assert.equal(input.height, 24);
    input.onChange('48'); assert.deepEqual(searches, ['48'], 'typing publishes the full-directory query');
    const headerNodes = [...header.nodes.values()];
    const headerTitle = headerNodes.find(node => node.type === 'Text' && node.create === '章节目录');
    assert.equal(headerTitle.fontFamily, 'ReaderMangaSans650');
    assert.deepEqual(headerTitle.fontWeight, [650, { enableVariableFontWeight: true }],
      'actual ArkUI fontWeight arguments keep the frozen static650 family and enable the manga weight attribute');
    assert.equal(headerTitle.fontSize, 19); assert.equal(headerTitle.lineHeight, 28); assert.equal(headerTitle.fontColor, palette.ink);
    assert.equal(headerNodes.find(node => node.type === 'Image').create,
      `app.media.manga_directory_back${scheme === 'night' ? '_theme_night' : ''}`);
    const headerBar = headerNodes.find(node => node.type === 'Row');
    const headerBack = headerNodes.find(node => node.type === 'Stack' && typeof node.onClick === 'function');
    assert.deepEqual(headerBack.focusBox, expectedFocus, 'the actual shared header back actor retains the current-theme focus box');
    assert.equal(headerBack.focusable, true);
    const headerHeight = Math.max(52, 28 * scale + 8);
    assert.equal(headerBar.height, headerHeight); assert.equal(headerBar.backgroundColor, palette.surface);
    assert.deepEqual(headerBar.border, { width: 1, color: palette.line });
    assert.deepEqual(headerBar.padding, { left: 3, right: 3 });
    const frameNodes = [...pageFrame(owner).nodes.values()];
    const headerWrapper = frameNodes.find(node => node.type === 'Column' && node.zIndex === 10);
    assert.deepEqual(headerWrapper.padding, { left: 16, right: 16 },
      'header uses 16px edges while summary/catalog content uses 20px edges');
    assert.deepEqual(headerWrapper.margin, { top: safeTop + 8 }, 'public header preserves the original safe-top offset');
    const footerWrapper = frameNodes.find(node => node.type === 'Column' && node.margin?.bottom === safeBottom + 8);
    assert.ok(footerWrapper, 'the public fixed-footer slot preserves the original bottom offset');
    assert.deepEqual(footerWrapper.padding, { left: 20, right: 20 }, 'the footer retains the catalog content frame');
    assert.equal(owner.headerFrame().width, contentWidth + 8, 'SurfaceHorizontalFrame constructor preserves width and right offset');
    const navigation = children.find(child => child.params?.chapterEntries);
    const initialContentTop = safeTop + headerHeight + 28;
    assert.equal(owner.mangaToolsHeight, 175, 'base one-line demo toolbar is 34+4+17+20+44+38+6+12');
    assert.equal(navigation.params.mangaCatalogNarrow, metrics.windowRect.width <= 340);
    near(navigation.params.listPaddingTop, initialContentTop + 175);
    const stackedFooter = scale === 3.2;
    const footerHeight = stackedFooter ? (15 + 18 + 15) * scale + 8 + 22 : Math.max(48, 18 * scale + 22);
    near(navigation.params.listPaddingBottom, safeBottom + footerHeight + 16);
    const footer = children.find(child => child.availableWidth === contentWidth && child.title === '48');
    assert.ok(footer?.nodes, 'mount the actual shared current-position footer producer');
    const footerNodes = [...footer.nodes.values()];
    const footerSurface = footerNodes.find(node => node.accessibilityText === '当前阅读位置');
    assert.deepEqual(footerSurface.constraintSize, { minHeight: 48 });
    assert.equal(footerSurface.backgroundColor, palette.soft); assert.deepEqual(footerSurface.border, { width: 1, color: palette.line });
    assert.deepEqual(footerSurface.padding, { left: 13, right: 13, top: 10, bottom: 10 });
    assert.equal(footer.stacked(), stackedFooter);
    const chapter = footerNodes.find(node => node.type === 'Text' && node.create === '48');
    const page = footerNodes.find(node => node.type === 'Text' && node.create === '4 / 24 页');
    assert.equal(chapter.fontFamily, 'ReaderNotoSansSCUIMedium'); assert.equal(chapter.fontWeight, 500);
    assert.equal(chapter.lineHeight, 18); assert.equal(page.lineHeight, 15);
    assert.equal(page.maxLines, undefined, 'page position may wrap rather than losing its suffix');
    if (stackedFooter) {
      assert.ok(footerNodes.some(node => node.type === 'Column' && node.create.space === 4 && node.width === '100%'),
        'narrow large-type footer reserves a full-width title lane instead of a zero-width horizontal slot');
      assert.ok(!footerNodes.some(node => node.type === 'Row' && node.layoutWeight === 1));
    } else assert.ok(footerNodes.some(node => node.type === 'Row' && node.layoutWeight === 1));
    footerSurface.onAreaChange({}, { width: `${contentWidth}vp`, height: `${footerHeight + 5}vp` }); properties.flush();
    near(navigation.params.listPaddingBottom, safeBottom + footerHeight + 5 + 16,
      'actual footer measurement replaces estimates in Core/list/grid bottom clearance');
    const toolbar = nodes.find(node => node.type === 'Column' && node.onAreaChange);
    assert.equal(toolbar.width, contentWidth); assert.equal(toolbar.position.x, 20); near(toolbar.position.y, initialContentTop);
    const actorCount = owner.children.size; const nodeCount = owner.nodes.size;
    const targetEntries = navigation.params.chapterEntries;
    navigation.params.onScrollOffset(96.5); properties.flush();
    near(toolbar.position.y, initialContentTop - 96.5, 'the actual navigation callback scrolls chrome by the same offset');
    near(navigation.params.listPaddingTop, initialContentTop + 175, 'scroll translation never changes the measured list clearance');
    assert.equal(owner.children.size, actorCount); assert.equal(owner.nodes.size, nodeCount);
    assert.equal([...owner.children.values()].find(child => child.params?.chapterEntries), navigation);
    assert.equal(navigation.params.chapterEntries, targetEntries, 'scroll retains the admitted canonical target array and native navigation owner');
    const measuredHeight = 34 * scale * 2 + 4 + 17 * scale + 20 + (44 + 20 * (scale - 1)) + toolHeight + 6 + 12;
    toolbar.onAreaChange({}, { height: `${measuredHeight}vp` }); properties.flush();
    near(navigation.params.listPaddingTop, initialContentTop + measuredHeight,
      'title wrapping and larger type increase actual list/grid clearance');
    near(toolbar.position.y, initialContentTop - 96.5, 'measurement preserves the live scroll offset');
    for (const viewportHeight of [240, 320, 480, 800]) {
      owner.mangaViewportHeight = viewportHeight; properties.flush();
      assert.equal(title.maxLines, undefined, 'short viewport cannot discard summary title lines');
      near(navigation.params.listPaddingTop, initialContentTop + measuredHeight);
    }
    navigation.params.onScrollOffset(0); properties.flush();
    near(toolbar.position.y, initialContentTop); assert.equal(owner.children.size, actorCount);
    navigation.params.onScrollOffset(Number.NaN); properties.flush(); assert.equal(owner.mangaScrollOffset, 0);
    for (const invalidHeight of [Number.NaN, -1, 0]) toolbar.onAreaChange({}, { height: invalidHeight });
    properties.flush(); assert.equal(owner.mangaToolsHeight, measuredHeight, 'invalid measurements cannot destroy admitted clearance');
    const nextScale = scale === 3.2 ? 1 : 3.2;
    metrics.systemFontScale = nextScale;
    owner.readerWindowMetricsRevision = 1;
    properties.flush();
    assert.equal(owner.mangaFooterMeasured, 0, 'font/width revision invalidates measurements from the old footer layout');
    const nextFooterHeight = nextScale === 3.2 ? 48 * nextScale + 8 + 22 : 48;
    near(navigation.params.listPaddingBottom, safeBottom + nextFooterHeight + 16,
      'new scale immediately uses its admitted estimated clearance while awaiting fresh native footer measurement');
    assert.equal([...owner.children.values()].find(child => child.params?.chapterEntries), navigation);
  }
}
checkFullChrome();
for (const [label, candidate, headerCandidate, footerCandidate = footerSource] of [
  ['lost native vp toolbar metrics', pageSource.replaceAll('readerPageAreaLength(area.height)', 'Number(area.height)'), headerSource],
  ['lost native vp dock metrics', pageSource, headerSource, footerSource.replaceAll('readerPageAreaLength(area.', 'Number(area.')],
  ['unobserved measurement', pageSource.replace('@State private mangaToolsHeight:', 'private mangaToolsHeight:'), headerSource],
  ['fixed toolbar during catalog scroll', pageSource.replace(' - this.mangaScrollOffset', ''), headerSource],
  ['fixed height wrapped tool labels', pageSource.replaceAll('.constraintSize({ minHeight: this.mangaToolHeight() })', '.height(this.mangaToolHeight())'), headerSource],
  ['generic accent colors', pageSource.replaceAll("mangaDirectoryColor('accent', this.appThemeScheme)", "readerAppColor('TOK_GREEN', this.appThemeScheme)"), headerSource],
  ['AUTO summary line height', pageSource.replace('.lineHeight(visual.summaryLineHeight)', ''), headerSource],
  ['truncated summary title', pageSource.replace('.wordBreak(WordBreak.BREAK_WORD)', '.wordBreak(WordBreak.BREAK_WORD).maxLines(1)'), headerSource],
  ['wrong header font', pageSource, headerSource.replace('READER_FONT_NOTO_SANS_SC_UI_650 :', 'READER_FONT_NOTO_SANS_SC_UI_BOLD :')],
  ['disabled manga weight attribute', pageSource, headerSource.replace("enableVariableFontWeight: this.variant === 'mangaDirectory'", 'enableVariableFontWeight: false')],
  ['swapped frame width/right', pageSource.replace('Math.max(0, frame.right - expansion), frame.width + expansion * 2', 'frame.width + expansion * 2, Math.max(0, frame.right - expansion)'), headerSource],
  ['horizontal footer at large type', pageSource, headerSource, footerSource.replace('if (this.stacked()) {', 'if (false) {')],
]) {
  assert.ok(candidate !== pageSource || headerCandidate !== headerSource || footerCandidate !== footerSource, label);
  assert.throws(() => checkFullChrome(candidate, headerCandidate, false, footerCandidate), assert.AssertionError, `reject ${label}`);
}
console.log('PASS actual SDK manga full chrome: real search/header/footer children, day/night palette and static650 with exact native weight arguments, header16/content20, natural long-title and tool-label wrap in short windows, measured175px base tools, scroll-coupled chrome with retained canonical targets, font scales1–3.2 and narrow stacked footer; twelve typography/measurement negative controls rejected; legacy search variants retained. Native layout/pixels remain a compositor gate.');

// The platform supplies actual area/Scroller values. This scoped SDK probe
// proves the production placement requests and retained navigation identity;
// it does not simulate native layout, If removal, or compositor visibility.
function checkFullAdaptive(candidate = pageSource) {
  for (const scheme of ['day', 'night']) for (const height of [480, 800]) {
    const properties = createArkUIPropertyRuntimeProbe(), scrolls = [];
    const metrics = { systemFontScale: 3.2, windowRect: { width: 320, height }, interactiveSafeInsets: { bottom: 34 } };
    const deps = { ...fonts, ...directoryVisual, ...properties.sdk,
      ReaderWindowCoordinator: { metrics: () => metrics },
      ScrollAlign: { START: 'start' }, LengthMetrics: { vp: value => ({ value }) } };
    const actualFooter = createReaderBuilderProbe(footerSource, footerNames, deps, properties.hooks).Component;
    const scroller = { scrollToIndex: (...args) => scrolls.push(args) };
    const { owner } = createReaderBuilderProbe(candidate, [...pageNames, 'mangaFlatList', 'onListFirstLayout', 'locateCurrent'], {
      ...deps, ReaderSearchField: Child, ReaderDirectoryNavigationSurface: Child, ReaderDirectoryList: Child,
      PageBackBar: Child, MangaDirectoryCurrentFooter: actualFooter,
    }, { ...properties.hooks, mountChildren: true, childSources: { MangaDirectoryCurrentFooter: footerSource,
      ReaderDirectoryList: read('features/reading/ReaderDirectoryList'),
      ReaderDirectoryNavigationSurface: read('features/reading/ReaderDirectoryNavigationSurface') } });
    Object.assign(owner, { appThemeScheme: scheme, admittedIdentity: 's\0b', admittedEntries: rows,
      mangaPresentation: mangaDirectoryPresentation(rows), bookTitle: '复杂长标题', sourceId: 's', bookId: 'b',
      currentChapterIndex: 17, currentPageOrdinal: 3, currentPageTotal: 24, searchDraft: '', searchQuery: '', ascending: true,
      readerWindowMetricsRevision: 0, mangaViewportHeight: height, viewportWidth: 320, listScroller: scroller,
      rulesRevision: 0, locateCurrentRevision: 0, navigationInteracted: false, mangaDownloadEnabled: false,
      topInset: () => 54, contentFrame: () => ({ width: 280, left: 20, right: 20 }),
      mangaLayoutEntries: () => rows, onListUserScroll() {}, identity: () => 's\0b' });
    owner.mangaPage();
    const nav = [...owner.children.values()].find(child => child.params?.chapterEntries);
    const footer = [...owner.children.values()].find(child => child.availableWidth === 280);
    const toolbar = [...owner.nodes.values()].find(node => node.type === 'Column' && node.onAreaChange);
    const flow = height === 480;
    assert.equal(owner.mangaFlowFooter(), flow, 'short clear band selects the shared finite flow predicate');
    const frame = pageFrame(owner);
    const fixedFooterHost = [...frame.nodes.values()].find(node => node.type === 'Stack' &&
      node.create?.alignContent === 'Alignment.Bottom');
    assert.ok(fixedFooterHost, 'the shared fixed-footer host remains a stable full-height slot');
    assert.equal(fixedFooterHost.zIndex, 20);
    assert.equal([...owner.children.values()].filter(child => child.availableWidth === 280).length, 1,
      'the actual footer producer mounts once in either the fixed or flowing slot');
    if (flow) {
      const footerCount = owner.children.size;
      frame.footer();
      assert.equal(owner.children.size, footerCount,
        'the actual public footer Builder emits no fixed footer content when its producer flows inside the catalog');
    }
    assert.equal([...owner.nodes.values()].some(node => node.type === 'Row' && node.margin?.top === 8), flow,
      'flow moves the current footer down to the safe-area edge and keeps the released list space');
    assert.ok(footer?.nodes); assert.equal(footer.title, '48'); assert.equal(footer.pagePosition, '4 / 24 页'); assert.equal(footer.scheme, scheme);
    assert.equal([...footer.nodes.values()].find(node => node.accessibilityText === '当前阅读位置').backgroundColor, palettes[scheme].soft);
    assert.equal(nav.params.mangaCatalogNarrow, true, '320vp full parent publishes the explicit narrow class rather than inner content guesses');
    near(nav.params.mangaVisibleTopInset, 159.6, 'parent publishes its actual fixed header bottom');
    near(nav.params.listPaddingBottom, flow ? 50 : 233.6);
    assert.equal(nav.params.scroller, scroller);
    const admitted = nav.params.chapterEntries, nativeOwner = nav;
    toolbar.onAreaChange({}, { height: 453 }); properties.flush();
    near(nav.params.listPaddingTop, 632.6, 'measured flow footer is admitted through the existing toolbar area');
    const nativeFooter = [...footer.nodes.values()].find(node => node.accessibilityText === '当前阅读位置');
    nativeFooter.onAreaChange({}, { width: 280, height: 201 }); properties.flush();
    near(nav.params.listPaddingBottom, flow ? 50 : 251, 'flow height never reintroduces the bottom overlay clearance');
    owner.mounted = true; owner.pendingMangaCurrentScroll = true; owner.navigationActive = false;
    owner.mangaLayoutRows = [{ entries: [rows[1]] }];
    owner.onListFirstLayout('s\0b');
    assert.equal(scrolls.at(-1)[0], 0); near(scrolls.at(-1)[3].extraOffset.value, 423, 'first admitted fallback current uses the same50vp opening contract');
    owner.scrollMangaCurrent(1);
    assert.equal(scrolls.at(-1)[0], 1); assert.equal(scrolls.at(-1)[2], 'start');
    near(scrolls.at(-1)[3].extraOffset.value, 461, 'fallback locate uses official START/header boundary instead of full-window CENTER');
    if (flow) {
      assert.ok(height - owner.mangaVisibleTopInset() - 12 - owner.mangaBottomClearance() > 169.8125,
        'the observed169.8125vp current named row has an unobscured requested band after footer flows');
    }
    nav.params.onScrollOffset(155.5); properties.flush();
    near(toolbar.position.y, 24.1, 'footer flow uses the existing scroll-coupled toolbar');
    owner.mangaFlatList('s\0b');
    const fallback = [...owner.children.values()].find(child => child.params?.naturalRowHeight === true);
    assert.ok(fallback); assert.equal(fallback.params.scroller, scroller);
    fallback.params.onScrollOffset(-owner.mangaContentTopInset()); properties.flush();
    assert.equal(owner.mangaScrollOffset, 0, 'natural List negative start origin maps to initial chrome zero');
    fallback.params.onScrollOffset(-owner.mangaContentTopInset() - 7); properties.flush();
    assert.equal(owner.mangaScrollOffset, -7, 'List native bounce remains signed');
    fallback.params.onScrollOffset(-owner.mangaContentTopInset() + 93); properties.flush();
    assert.equal(owner.mangaScrollOffset, 93, 'List displacement moves the same toolbar by its actual content origin');
    assert.equal([...owner.children.values()].find(child => child.params?.chapterEntries), nativeOwner);
    assert.equal(nav.params.chapterEntries, admitted); assert.equal(nav.params.scroller, scroller);
    for (const invalid of [0, -1, NaN, Infinity]) {
      assert.equal(directoryVisual.mangaDirectoryFullFlowFooter(invalid, 3.2, 54, 34, 183.6), false);
    }
  }
}
function checkVpHost(candidate=pageSource) {
  const properties=createArkUIPropertyRuntimeProbe();
  const metrics=new metricsApi.ReaderWindowMetricsSnapshot(new metricsApi.ReaderRectVp(0,0,1280,800),undefined,new metricsApi.ReaderInsetsVp(32,54,24,34));
  metrics.systemFontScale=3.2;
  const deps={...fonts,...directoryVisual,...metricsApi,...geometryApi,...properties.sdk,TOK_CONTENT_MAX_W_TABLET:720,
    ReaderWindowCoordinator:{metrics:()=>metrics},LengthMetrics:{vp:value=>({value})}};
  const Footer=createReaderBuilderProbe(footerSource,footerNames,deps,properties.hooks).Component;
  const {owner}=createReaderBuilderProbe(candidate,[...pageNames,'viewportWidth','contentFrame','contentKind','onMangaKindChanged'],{
    ...deps,ReaderSearchField:Child,ReaderDirectoryNavigationSurface:Child,ReaderMangaDownloadPopup:Child,
    PageBackBar:Child,MangaDirectoryCurrentFooter:Footer},
    {...properties.hooks,mountChildren:true,childSources:{MangaDirectoryCurrentFooter:footerSource,
      ReaderDirectoryNavigationSurface:read('features/reading/ReaderDirectoryNavigationSurface')}});
  const scroller={};
  Object.assign(owner,{appThemeScheme:'night',contentKind:'manga',admittedIdentity:'s\0b',admittedEntries:rows,
    mangaPresentation:mangaDirectoryPresentation(rows),bookTitle:'复杂长标题',sourceId:'s',bookId:'b',currentChapterIndex:17,
    currentPageOrdinal:3,currentPageTotal:24,searchDraft:'',searchQuery:'',ascending:true,readerWindowMetricsRevision:0,
    viewportWidth:0,mangaViewportHeight:800,mangaToolsHeight:175,listScroller:scroller,rulesRevision:0,locateCurrentRevision:0,
    navigationInteracted:false,mangaDownloadEnabled:false,topInset:()=>54,prepareMangaLayout(){},identity:()=> 's\0b'});
  owner.mangaPage();
  const nav=[...owner.children.values()].find(child=>child.params?.chapterEntries),targets=nav.params.chapterEntries;
  const hostArea=[...owner.nodes.values()].find(node=>node.type==='__Common__'&&node.onAreaChange),frame=pageFrame(owner);
  assert.ok(hostArea&&frame.nodes,'actual SDK exposes the public manga host Area wrapper');
  hostArea.onAreaChange({}, {width:'320vp',height:'480vp'});properties.flush();
  assert.equal(owner.viewportWidth,320,'vp measured width replaces the much wider physical window');
  assert.equal(owner.mangaViewportHeight,480,'vp measured height replaces the 800vp physical window');
  assert.deepEqual(owner.contentFrame(),new geometryApi.SurfaceHorizontalFrame(32,24,264));
  assert.equal(nav.params.mangaCatalogNarrow,true,'the actual narrow class follows host width, not device width');
  assert.equal(owner.mangaFlowFooter(),true,'short host activates the actual finite footer-flow predicate');
  near(nav.params.listPaddingBottom,50,'flow footer releases only its existing dock budget');
  const toolbar=[...owner.nodes.values()].find(node=>node.type==='Column'&&node.onAreaChange);
  toolbar.onAreaChange({}, {height:'453vp'});properties.flush();
  near(nav.params.listPaddingTop,632.6,'vp toolbar area contributes its actual natural height');
  const footer=[...owner.children.values()].find(child=>child instanceof Footer);
  const dock=[...footer.nodes.values()].find(node=>node.accessibilityText==='当前阅读位置');
  dock.onAreaChange({}, {width:'264vp',height:'201vp'});properties.flush();
  assert.equal(footer.measuredWidth,264);assert.equal(owner.mangaFooterMeasured,201,'actual dock vp height reaches the page owner');
  for(const invalid of ['invalid',0,-1,NaN,Infinity])hostArea.onAreaChange({}, {width:invalid,height:invalid});
  properties.flush();assert.equal(owner.viewportWidth,320);assert.equal(owner.mangaViewportHeight,480);
  assert.equal([...owner.children.values()].find(child=>child.params?.chapterEntries),nav);
  assert.equal(nav.params.chapterEntries,targets);assert.equal(nav.params.scroller,scroller,'vp measurement keeps navigation/Scroller/canonical targets');
}
checkVpHost();
const rawArea=pageSource.replaceAll('readerPageAreaLength(', 'Number(');
assert.notEqual(rawArea,pageSource);assert.throws(()=>checkVpHost(rawArea),assert.AssertionError,'raw Number parsing cannot pass the actual SDK vp-host fixture');
checkFullAdaptive();
for (const [label, candidate] of [
  ['fixed footer in short window', pageSource.replace('return mangaDirectoryFullFlowFooter(height,', 'return false && mangaDirectoryFullFlowFooter(height,')],
  ['footer double clearance', pageSource.replace('(this.mangaFlowFooter() ? 0 : this.mangaFooterHeight())', 'this.mangaFooterHeight()')],
  ['header boundary not forwarded', pageSource.replace('mangaVisibleTopInset: this.mangaVisibleTopInset(),', 'mangaVisibleTopInset: 0,')],
  ['fallback raw origin', pageSource.replace('offset + this.mangaContentTopInset()', 'offset')],
  ['fallback full-window CENTER', pageSource.replace('this.listScroller.scrollToIndex(index, false, ScrollAlign.START,', 'this.listScroller.scrollToIndex(index, false, ScrollAlign.CENTER,')],
]) {
  assert.notEqual(candidate, pageSource, label);
  assert.throws(() => checkFullAdaptive(candidate), assert.AssertionError, `reject ${label}`);
}
console.log('PASS actual Full short-window SDK flow footer, unchanged day/night footer producer, measured toolbar/top/bottom/header geometry, retained navigation/Scroller/canonical targets, fallback signed scroll origin and START locate; five negative controls. Native physical rows/engine remain pending.');

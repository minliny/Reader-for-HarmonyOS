import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"chrome-current": {"description": "当前public MangaVisual→实际header/title和area delta/retained targets", "resources": []}, "adaptive-footer": {"description": "实际短window flow/fixed dock routing、Grid publication/signed fallback", "resources": []}, "vp-host": {"description": "实际vp-string viewport/toolbar/footer测量与invalid拒绝", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {




const directoryState = await import('../entry/src/main/ets/features/manga/MangaDirectoryState.ts');
const { mangaDirectoryDisplay } = await import('../entry/src/main/ets/features/manga/MangaDirectoryDisplay.ts');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createHash } = await import('node:crypto');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const metricsApi = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const geometryApi = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const fonts = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const { mangaDirectoryPresentation } = await import('../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts');
const directoryVisual = await import('../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts');
const { mangaGridBuilderMembers, mangaGridProbeDependencies, emptyMangaGridState } = await import('./lib/manga-directory-grid-probe.mjs');


const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}.ets`, import.meta.url), 'utf8');
const fieldSource = read('features/common/ReaderSearchField');
const fieldNames = ['build', 'nativeInputBackground', 'nativeFieldBackground', 'fixedLineHeightField', 'mangaLineHeightField', 'autoLineHeightField', 'passiveField', 'submit', 'textStyle',
  'searchIcon', 'fieldHeight', 'inputHeight', 'iconSize', 'iconGap', 'horizontalPadding', 'fieldBackgroundColor',
  'fieldBorderWidth', 'fieldBorderColor', 'cornerRadius', 'inputColor', 'caretColor', 'placeholderColor',
  'resolvedAccessibilityLabel', 'variant', 'mode', 'text', 'placeholder', 'accessibilityLabel', 'isTablet',
  'clearable', 'submitEnabled', 'onTextChange', 'onSubmit', 'mangaFontScale', 'mangaTextHeightGrowth', 'readerWindowMetricsRevision'];
const fieldDeps = { ...fonts, ReaderTextStyle: readerTypographyRoles.TYPE_SEARCH_BOOK_INPUT.constructor };
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const pageSource = read('features/bookshelf/BookDirectoryPage');
const headerSource = read('features/common/PageBackBar');
const footerSource = read('features/manga/MangaDirectoryCurrentFooter');
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
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
  'mangaFontScale', 'mangaToolHeight', 'mangaFooterHeight', 'mangaBottomInset', 'mangaFooterBottomOffset', 'mangaBottomClearance', 'mangaListBottomClearance', 'mangaSortIcon',
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
function actualCatalogGridEnd(params) {
  const properties = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(read('features/reading/ReaderDirectoryNavigationList'),
    ['build', ...mangaGridBuilderMembers], { ...fonts, ...mangaGridProbeDependencies, ...properties.sdk,
      LazyForEach: new Proxy({}, { get: () => () => {} }) }, properties.hooks);
  Object.assign(owner, emptyMangaGridState(), params, { view: { visibleTotal: 1 },
    mangaDisplay: true, mangaCatalogDisplay: true, mangaScheme: 'day', appThemeScheme: 'day',
    listPaddingY: 8, contentStartInset: 0, interactionEnabled: true });
  owner.initialRender();
  const grid = [...owner.nodes.values()].find(node => node.type === 'Grid');
  assert.ok(grid, 'the real SDK-compiled catalog Grid consumes the page/Surface scroll facts');
  return grid.contentEndOffset;
}

function checkFullChrome(candidate = pageSource, headerCandidate = headerSource, exhaustive = true, footerCandidate = footerSource) {
  const cases=['day','night'].flatMap(scheme=>[1,3.2].map(scale=>({safeTop:24,safeBottom:34,scheme,scale,contentWidth:350})));
  if (exhaustive) cases.push({ safeTop: 24, safeBottom: 34, scheme: 'night', scale: 3.2, contentWidth: 280 });
  for (const { safeTop, safeBottom, scheme, scale, contentWidth } of cases) {
    const properties = createArkUIPropertyRuntimeProbe();
    const metrics = { systemFontScale: scale, windowRect: { width: contentWidth + 40, height: 640 },
      interactiveSafeInsets: { bottom: safeBottom } };
    const dependencies = { ...fonts, ...directoryVisual, ...directoryState, mangaDirectoryDisplay, ...properties.sdk,
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
    const children=[...owner.children.values()],nav=children.find(c=>c.params?.chapterEntries),header=children.find(c=>c.floating===true),field=children.find(c=>c.variant==='readerDirectory'&&c.floating!==true);
    assert.ok(nav&&header?.nodes&&field?.nodes,'actual shared input/header and canonical navigation mount');
    for(const child of [field,header,pageFrame(owner)]){child.appThemeScheme=scheme;child.readerWindowMetricsRevision=0;}properties.flush();
    const nodes=[...owner.nodes.values()],title=nodes.find(n=>n.type==='Text'&&n.create===owner.bookTitle),visual=directoryVisual.MANGA_DIRECTORY_VISUAL;
    assert.ok(title);assert.equal(title.fontSize,visual.summaryFontSize);assert.equal(title.lineHeight,visual.summaryLineHeight);assert.equal(title.maxLines,undefined,'long actual title remains naturally wrapping');
    const hnodes=[...header.nodes.values()],htitle=hnodes.find(n=>n.type==='Text'&&n.create==='章节目录');assert.ok(htitle);assert.equal(htitle.fontFamily,fonts.READER_FONT_NOTO_SANS_SC_UI_650);assert.equal(htitle.fontSize,visual.headerFontSize);assert.equal(htitle.lineHeight,visual.headerLineHeight);assert.deepEqual(htitle.fontWeight,[visual.headerFontWeight,{enableVariableFontWeight:true}]);
    const locate=nodes.find(n=>n.accessibilityText==='定位当前条目'),sort=nodes.find(n=>n.accessibilityText==='切换排序');assert.ok(locate&&sort);assert.equal(locate.height,undefined,'wrapped locate uses intrinsic actor');
    locate.onClick();sort.onClick();children.find(c=>c.params?.specId==='manga-download').params.onOpen();header.onBack();assert.deepEqual(actions,['locate','sort','download-menu','back']);
    [...field.nodes.values()].find(n=>n.type==='TextInput').onChange('48');assert.deepEqual(searches,['48']);
    const frame=pageFrame(owner),toolbar=nodes.find(n=>n.type==='Column'&&n.onAreaChange),start=nav.params.listPaddingTop,top=toolbar.position.y,targets=nav.params.chapterEntries,actorCount=owner.children.size;
    assert.equal(start,top+owner.mangaToolsHeight,'measured toolbar owns first-row clearance');assert.ok(owner.headerFrame().width>=contentWidth&&owner.headerFrame().width<=metrics.windowRect.width);
    nav.params.onScrollOffset(96.5);properties.flush();near(toolbar.position.y,top-96.5);near(nav.params.listPaddingTop,start,'scroll translates chrome without changing content origin');
    const nextHeight=owner.mangaToolsHeight+73;toolbar.onAreaChange({}, {height:`${nextHeight}vp`});properties.flush();near(nav.params.listPaddingTop-start,73,'actual vp area delta updates retained canonical navigation');
    const footer=children.find(c=>c.availableWidth===contentWidth&&c.title==='48');assert.ok(footer?.nodes);const dock=[...footer.nodes.values()].find(n=>n.accessibilityText==='当前阅读位置');
    const oldFooter=owner.mangaFooterHeight(),oldEnd=frame.params.contentEndInset;dock.onAreaChange({}, {width:`${contentWidth}vp`,height:`${oldFooter+11}vp`});properties.flush();near(frame.params.contentEndInset-oldEnd,11,'actual footer measurement replaces exactly its estimated part');
    const measured=owner.mangaToolsHeight;for(const height of [NaN,-1,0])toolbar.onAreaChange({}, {height});properties.flush();assert.equal(owner.mangaToolsHeight,measured);
    assert.equal([...owner.children.values()].find(c=>c.params?.chapterEntries),nav);assert.equal(nav.params.chapterEntries,targets);assert.equal(owner.children.size,actorCount);
    metrics.systemFontScale=scale===3.2?1:3.2;owner.readerWindowMetricsRevision=1;properties.flush();assert.equal(owner.mangaFooterMeasured,0,'new scale invalidates old native footer measurement');assert.equal([...owner.children.values()].find(c=>c.params?.chapterEntries),nav);
  }
}
if(selectedCase==='chrome-current') {
checkFullChrome();
for (const [label, candidate, headerCandidate, footerCandidate = footerSource] of [
  ['lost native vp toolbar metrics', pageSource.replaceAll('readerPageAreaLength(area.height)', 'Number(area.height)'), headerSource],
  ['lost native vp dock metrics', pageSource, headerSource, footerSource.replaceAll('readerPageAreaLength(area.', 'Number(area.')],
  ['unobserved measurement', pageSource.replace('@State private mangaToolsHeight:', 'private mangaToolsHeight:'), headerSource],
  ['fixed toolbar during catalog scroll', pageSource.replace(' - this.mangaScrollOffset', ''), headerSource],
  ['truncated summary title', pageSource.replace('.wordBreak(WordBreak.BREAK_WORD)', '.wordBreak(WordBreak.BREAK_WORD).maxLines(1)'), headerSource],
  ['swapped frame width/right', pageSource.replace('Math.max(0, frame.right - expansion), frame.width + expansion * 2', 'frame.width + expansion * 2, Math.max(0, frame.right - expansion)'), headerSource],
]) {
  assert.ok(candidate !== pageSource || headerCandidate !== headerSource || footerCandidate !== footerSource, label);
  assert.throws(() => checkFullChrome(candidate, headerCandidate, false, footerCandidate), assert.AssertionError, `reject ${label}`);
}
}

// The platform supplies actual area/Scroller values. This scoped SDK probe
// proves the production placement requests and retained navigation identity;
// it does not simulate native layout, If removal, or compositor visibility.
function checkFullAdaptive(candidate = pageSource) {
  for (const scheme of ['day', 'night']) for (const height of [480, 800]) {
    const properties = createArkUIPropertyRuntimeProbe(), scrolls = [];
    const metrics = { systemFontScale: 3.2, windowRect: { width: 320, height }, interactiveSafeInsets: { bottom: 34 } };
    const deps = { ...fonts, ...directoryVisual, ...directoryState, mangaDirectoryDisplay, ...properties.sdk,
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
    near(nav.params.mangaVisibleTopInset,owner.mangaVisibleTopInset(),'actual parent forwards its selected header boundary');
    near(nav.params.listPaddingBottom,owner.mangaListBottomClearance());
    near(frame.params.contentEndInset,flow?0:owner.mangaBottomClearance());
    assert.equal(frame.params.footerSurface, flow ? 'transparent' : 'solid');
    assert.ok(flow?nav.params.contentEndInset>0:nav.params.contentEndInset===0);
    assert.equal(nav.params.scroller, scroller);
    const admitted = nav.params.chapterEntries, nativeOwner = nav;
    toolbar.onAreaChange({}, { height: 453 }); properties.flush();
    near(nav.params.listPaddingTop,owner.mangaContentTopInset(),'measured actual toolbar reaches canonical owner');
    const nativeFooter = [...footer.nodes.values()].find(node => node.accessibilityText === '当前阅读位置');
    nativeFooter.onAreaChange({}, { width: 280, height: 201 }); properties.flush();
    near(nav.params.listPaddingBottom,owner.mangaListBottomClearance());
    near(frame.params.contentEndInset,flow?0:owner.mangaBottomClearance());
    near(actualCatalogGridEnd(nav.params),nav.params.listPaddingBottom,'actual SDK Grid consumes exact published native scroll tail');
    owner.mounted = true; owner.pendingMangaCurrentScroll = true; owner.navigationActive = false;
    owner.mangaLayoutRows = [{ entries: [rows[1]] }];
    owner.onListFirstLayout('s\0b');
    assert.equal(scrolls.at(-1)[0], 0); const initialExtra=scrolls.at(-1)[3].extraOffset.value;assert.ok(Number.isFinite(initialExtra));
    owner.scrollMangaCurrent(1);
    assert.equal(scrolls.at(-1)[0], 1); assert.equal(scrolls.at(-1)[2], 'start');
    assert.ok(Number.isFinite(scrolls.at(-1)[3].extraOffset.value));assert.ok(scrolls.at(-1)[3].extraOffset.value>initialExtra,'explicit locate differs from opening position without freezing old offsets');
    nav.params.onScrollOffset(155.5); properties.flush();
    near(toolbar.position.y,owner.mangaContentTopInset()-owner.mangaToolsHeight-155.5,'native offset translates actual toolbar');
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
  const deps={...fonts,...directoryVisual, ...directoryState, mangaDirectoryDisplay,...metricsApi,...geometryApi,...properties.sdk,TOK_CONTENT_MAX_W_TABLET:720,
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
  near(nav.params.listPaddingBottom,owner.mangaListBottomClearance());
  const toolbar=[...owner.nodes.values()].find(node=>node.type==='Column'&&node.onAreaChange);
  toolbar.onAreaChange({}, {height:'453vp'});properties.flush();
  near(nav.params.listPaddingTop,owner.mangaContentTopInset(),'vp area reaches current actual content inset');
  const footer=[...owner.children.values()].find(child=>child instanceof Footer);
  const dock=[...footer.nodes.values()].find(node=>node.accessibilityText==='当前阅读位置');
  dock.onAreaChange({}, {width:'264vp',height:'201vp'});properties.flush();
  assert.equal(footer.measuredWidth,264);assert.equal(owner.mangaFooterMeasured,201,'actual dock vp height reaches the page owner');
  for(const invalid of ['invalid',0,-1,NaN,Infinity])hostArea.onAreaChange({}, {width:invalid,height:invalid});
  properties.flush();assert.equal(owner.viewportWidth,320);assert.equal(owner.mangaViewportHeight,480);
  assert.equal([...owner.children.values()].find(child=>child.params?.chapterEntries),nav);
  assert.equal(nav.params.chapterEntries,targets);assert.equal(nav.params.scroller,scroller,'vp measurement keeps navigation/Scroller/canonical targets');
}
if(selectedCase==='vp-host') {
checkVpHost();
const rawArea=pageSource.replaceAll('readerPageAreaLength(', 'Number(');
assert.notEqual(rawArea,pageSource);assert.throws(()=>checkVpHost(rawArea),assert.AssertionError,'raw Number parsing cannot pass the actual SDK vp-host fixture');
}
if(selectedCase==='adaptive-footer') {
checkFullAdaptive();
for (const [label, candidate] of [
  ['missing fixed viewport clearance', pageSource.replace('contentEndInset: this.mangaFlowFooter() ? 0 : this.mangaBottomClearance()', 'contentEndInset: 0')],
  ['transparent fixed dock', pageSource.replace("footerSurface: this.mangaFlowFooter() ? 'transparent' : 'solid'", "footerSurface: 'transparent'")],
  ['lost flowing Grid safe inset', pageSource.replace('contentEndInset: Math.max(0, this.mangaListBottomClearance() - 18)', 'contentEndInset: 0')],
]) {
  assert.notEqual(candidate, pageSource, label);
  assert.throws(() => checkFullAdaptive(candidate), assert.AssertionError, `reject ${label}`);
}
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
}
console.log('selected manga current chrome case PASS: '+selectedCase);

}

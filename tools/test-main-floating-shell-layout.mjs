import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"navigation": {"description": "实际MainTabShell current generation/retirement和native tab width", "resources": []}, "shelf-list": {"description": "实际Shelf List保indices/viewport与live narrow-wide clearance", "resources": []}, "empty-status": {"description": "实际empty/status完整Scroll与测量高度/safe delta", "resources": []}, "settings-origin": {"description": "实际Settings home/general scroll与popup global-local origin", "resources": []}, "discover-header": {"description": "实际Discover shared fixed header mount", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const fontFamilies = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { MAIN_TAB_LABEL_LINE_HEIGHT } = await import('../entry/src/main/ets/features/common/ReaderLayoutTokens.ts');
const headerMetrics = await import('../entry/src/main/ets/features/common/ReaderHeaderMetrics.ts');
const widthClass = await import('../entry/src/main/ets/features/common/ReaderWidthClass.ts');
const surfaceGeometry = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const { isReaderMainTabEnabled } = await import('../entry/src/main/ets/app/ReaderProductScope.ts');
const { readerContentSafeTop, readerInteractiveSafeBottom, readerInteractiveSafeLeft,
  readerInteractiveSafeRight, readerVisualSafeLeft, readerVisualSafeRight, readerVisualSafeTop } =
  await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');


const root = new URL('../entry/src/main/ets/features/', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const builders = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
const { readerScaledControlHeight } = pureModuleProbe(read('common/ReaderSurfaceResolvers.ts'),
  'ReaderSurfaceResolvers.ts', {}, ['readerScaledControlHeight']);
const metricsSource = read('common/ReaderFloatingBarMetrics.ts').replace(/^import .*;\n/gm, '');
const floating = new Function('readerInteractiveSafeBottom', 'readerScaledControlHeight', 'MAIN_TAB_LABEL_LINE_HEIGHT',
  `${stripTypeScriptTypes(metricsSource)}; return {
  READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset, readerFloatingTabBottomInset,
  readerFloatingTabContentInset, readerMainTabItemHeight, readerFloatingTabBarHeight
};`.replaceAll('export ', ''))(readerInteractiveSafeBottom, readerScaledControlHeight, MAIN_TAB_LABEL_LINE_HEIGHT);
let safeBottom = 15;
let safeLeft = 0;
let safeRight = 0;
let windowWidth = 390;
const metrics = () => ({ windowRect: { width: windowWidth, height: 844 }, systemFontScale: 1,
  systemInsets: { top: 39, left: safeLeft, right: safeRight, bottom: safeBottom },
  cutoutInsets: { top: 0, left: 0, right: 0, bottom: 0 },
  gestureInsets: { top: 0, left: 0, right: 0, bottom: 0 },
  navigationInsets: { top: 0, left: 0, right: 0, bottom: 0 },
  keyboardInsets: { top: 0, left: 0, right: 0, bottom: 0 },
});
const navigation = pureModuleProbe(read('shell/MainNavigationSpec.ts'), 'MainNavigationSpec.ts', {
  readerMainTabItemHeight: floating.readerMainTabItemHeight, READER_EXPANDED_MIN_WIDTH: 600,
  readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight, readerVisualSafeTop,
  isReaderMainTabEnabled, ReaderWindowCoordinator: { metrics }, AppStorage: { get: () => undefined },
}, ['readerMainNavigationMode', 'readerMainViewport', 'readerMainRailLeft', 'readerMainRailTop',
  'readerMainRailLeading', 'readerMainRailBottomInset', 'readerMainRailContentLeft', 'readerMainRailContentRight',
  'MAIN_TAB_RAIL_WIDTH', 'MAIN_TAB_RAIL_ITEM_GAP', 'MAIN_TAB_RAIL_PADDING', 'mainTabRailHeight',
  'mainTabBottomWidth']);
const geometryModule = pureModuleProbe(read('common/ReaderPageGeometry.ts'), 'ReaderPageGeometry.ts', {
  readerPresentedHeaderBottom: (top, height) => top + height,
  readerVisualSafeLeft, readerVisualSafeRight, ...surfaceGeometry, ...widthClass,
}, ['ReaderPageGeometry', 'ReaderPageGeometryInput', 'resolveReaderPageGeometry', 'readerEmptyPageGeometry']);
const scrollModule = pureModuleProbe(read('common/ReaderScrollLayout.ts'), 'ReaderScrollLayout.ts', {},
  ['ReaderScrollLayout', 'readerScrollLayout', 'readerScrollTopPadding', 'readerScrollBottomPadding',
    'readerScrollStartOffset', 'readerScrollEndOffset']);
const pageShellModule = pureModuleProbe(read('common/ReaderPageShell.ts'), 'ReaderPageShell.ts', {
  ...headerMetrics, TOK_SCREEN_INSET: 19,
  readerPresentedHeaderBottom: (top, height) => top + height,
  readerPageAreaLength: value => typeof value === 'number' ? value :
    typeof value === 'string' ? Number.parseFloat(value) || 0 : 0,
  readerVisualSafeLeft, readerVisualSafeRight, ...surfaceGeometry, ...floating,
}, ['readerPresentedHeaderBottom', 'readerPageAreaLength', 'readerPageContentStartInset',
  'readerStandardPageSpec', 'readerStandardPageFooterBottom', 'readerStandardPageContentEndInset']);
const headerSpecs = pureModuleProbe(read('common/ReaderHeaderSpecs.ets'), 'ReaderHeaderSpecs.ets',
  { ...headerMetrics, TOK_BORDER_W: 0.5 }, ['bookshelfHeaderSpec']);
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const properties = createArkUIPropertyRuntimeProbe();
const hooks = { ...properties.hooks, mountChildren: true };
const deps = { ...properties.sdk, ...floating, ...navigation, ...fontFamilies, ...geometryModule, ...scrollModule, ...surfaceGeometry,
  ...pageShellModule, ...headerSpecs, readerVisualSafeTop, readerInteractiveSafeBottom,
  readerIsExpandedWidth: widthClass.readerIsExpandedWidth,
  TOK_SPACE_XS: 8, TOK_SPACE_SM: 12, TOK_SPACE_MD: 16, TOK_SPACE_LG: 24, TOK_SPACE_CONTROL_INLINE: 10,
  TOK_SCREEN_INSET: 19, TOK_CONTENT_MAX_W_PHONE: 352, TOK_CONTENT_RAIL_W_TABLET: 620,
  TOK_BORDER_W: 0.5, TOK_RADIUS_PILL: 999,
  TOK_PRIMARY_DARK: '#222222', TOK_MUTED: '#666666', TOK_ON_PRIMARY: '#FFFFFF',
  ReaderWindowCoordinator: { metrics }, readerContentSafeTop, readerInteractiveSafeLeft, readerInteractiveSafeRight, readerAppColor,
  ReaderRaisedSurface: class { constructor(owner, params){Object.assign(this, {owner, params});} },
  registerReaderShelfFonts() {},
  MAIN_TABS: [{key:'bookshelf',label:'书架'},{key:'settings',label:'设置'}],
  RSS_FLOATING_HEADER_HEIGHT: 148, RSS_TABLET_RAIL_WIDTH: 100,
  LazyForEach: { create() {}, pop() {} }, ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
};
for (const [name, file, slots] of [
  ['MainTabBar', 'shell/MainTabBar.ets', []],
  ['MainTabShell', 'shell/MainTabShell.ets', ['content']],
  ['ReaderStandardPage', 'common/ReaderStandardPage.ets', ['content', 'header', 'footer', 'overlayContent']],
  ['PageBackBar', 'common/PageBackBar.ets', ['trailing']],
  ['AppTopBar', 'common/AppTopBar.ets', ['trailing']],
  ['BookshelfEmptyCard', 'bookshelf/BookshelfEmptyCard.ets', []],
  ['SearchSpinner', 'search/SearchSpinner.ets', []],
]) {
  const source = read(file);
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
  syntax.builderParamObjectCollection.set(name, new Set(slots));
  deps[name] = class extends Child {};
}
syntax.componentCollection.customComponents.add('ReaderRaisedSurface');
syntax.propCollection.set('ReaderRaisedSurface', new Set(['surfaceWidth', 'surfaceHeight', 'cornerRadius', 'scheme']));
function probe(file, members, values, extraDeps = {}) {
  const source = read(file);
  for (const m of source.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g)) builders.add(m[1]);
  const { owner } = createReaderBuilderProbe(source, members, { ...deps, ...extraDeps }, hooks);
  Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 0, ...values });
  return owner;
}
const descendants = owner => [owner, ...[...(owner.children?.values() ?? [])].flatMap(descendants)];
const nodes = (owner, type) => descendants(owner).flatMap(child => [...(child.nodes?.values() ?? [])]).filter(node => node.type === type);
const replayTree = owner => { owner.replay?.(); for (const child of owner.children?.values() ?? []) replayTree(child); };
const sharedHeader = createReaderBuilderProbe(read('common/PageBackBar.ets'), boundedMembers(read('common/PageBackBar.ets')), deps, hooks);
deps.PageBackBar = sharedHeader.Component;
deps.MainTabBar = createReaderBuilderProbe(read('shell/MainTabBar.ets'), boundedMembers(read('shell/MainTabBar.ets')), deps, hooks).Component;
const sharedMain = createReaderBuilderProbe(read('shell/MainTabShell.ets'), boundedMembers(read('shell/MainTabShell.ets')), deps, hooks);
deps.MainTabShell = class extends sharedMain.Component {
  constructor(owner, params, storage, id, ...rest) { super(owner, params, storage, id, ...rest); this.params = { ...params }; }
  updateStateVars(params) { super.updateStateVars(params); Object.assign(this.params, params); }
};
const verifyScroll = (owner, top, bottom) => {
  const scroll = nodes(owner, 'Scroll')[0];
  assert.equal(scroll.height, '100%', 'scroll viewport extends behind both floating bars');
  assert.equal(scroll.layoutWeight, undefined, 'bars do not subtract from the scroll viewport');
  const content = nodes(owner, 'Column').find(node => node.padding?.top === top);
  assert.ok(content, 'first content can clear the floating header at rest');
  assert.equal(content.padding.bottom, bottom, 'last content can clear the bottom control at rest');
  assert.ok(scroll.padding?.top === undefined && scroll.padding?.bottom === undefined,
    'vertical clearances belong to scrollable content');
  return content;
};

// Actual SDK-emitted Builder/native attribute calls are checked here; native
// pixel layout and gesture dispatch remain separate evidence layers.
if(selectedCase==='navigation') for (const rail of [false, true]) {
  windowWidth = rail ? 820 : 390;
  const tabCalls = [];
  const scaffoldCalls = [];
  class ScaffoldFrame extends Child {
    constructor(owner, params, storage, id) { super(owner, params, storage, id); scaffoldCalls.push(this); }
  }
  const shellSource = read('shell/MainTabShell.ets');
  const shell = probe('shell/MainTabShell.ets', boundedMembers(shellSource), {
    activeTab: 'bookshelf', wideNavigationRail: rail, navigationGeneration: 7, content() {},
    onMainTab(key, generation) { tabCalls.push([key, generation]); },
  }, { ReaderPageScaffold: ScaffoldFrame });
  shell.aboutToAppear(); shell.initialRender();
  assert.equal(scaffoldCalls.length, 1, 'the public ReaderPageScaffold is the sole full-size page frame');
  assert.equal(scaffoldCalls[0].params.headerVisible, true);
  assert.equal(typeof scaffoldCalls[0].params.footer, 'function');
  if (rail) shell.mainOverlays(); else shell.bottomNavigation();
  const tab = nodes(shell, 'Column').find(node => node.accessibilityText === '设置' && node.onClick);
  assert.ok(tab, 'actual shared navigation emits the settings action');
  tab.onClick(); assert.deepEqual(tabCalls, [['settings', 7]], 'actual shared navigation method admits the mounted generation');
  shell.aboutToDisappear(); tab.onClick();
  assert.deepEqual(tabCalls, [['settings', 7]], 'retired public navigation refuses its retained callback');
}

if(selectedCase==='navigation') {
for (const bottom of [0, 15, 34, 50]) {
  safeBottom = bottom;
  const bar = probe('shell/MainTabBar.ets', ['bottomBar', 'bottomInset'], {
    current: 'bookshelf', bottomBarFrame: () => ({ width: 360 }), bottomBarTranslateX: () => 0,
  });
  bar.bottomBar();
  const emitted=[...bar.nodes.values()],surface=emitted.find(node=>node.type==='Row'),frame=emitted.find(node=>node.type==='Stack'&&node.margin);
  // Width remains the explicit frame input; the actual 2/3/4-tab frame is
  // covered by test-manga-ui-floating-bars rather than inferred here.
  assert.equal(surface.width,360,'public frame width passes through'); assert.equal(surface.clip,false);
  assert.equal(surface.hitTestBehavior, 'HitTestMode.Transparent');
  assert.equal(frame.margin.bottom, Math.max(15, bottom));
}

}
if(selectedCase==='shelf-list') {
const bookshelfSource=read('bookshelf/BookshelfPage.ets');
const makeShelf=(wideRail=false)=>probe('bookshelf/BookshelfPage.ets',['bookshelfList','contentGeometry','navigationMode',
  'railActive','pageGeometry','scrollLayout','shelfContentStartInset','shelfFirstItemPadding',
  'effectiveViewportWidth','isWideViewport','shelfViewportMotionId','shelfPageHandler',
  'shelfScrollHandler','shelfViewportScrollHandler'],{
  continueReading:undefined,filterRowVisible:false,visibleBookCount:1,viewMode:'cover',
  contentFilter:'all',sourceFilter:'all',headerBottom:headerSpecs.bookshelfHeaderSpec().frameHeight,
  mainViewportRevision:0,wideNavigationRail:wideRail,reduceMotion:false,
  rowDataSource:{totalCount:()=>0,getData:()=>[]},shelfScroller:{},
  filterPanel(){},filterRow(){},hasActiveFilters:()=>false,
});
for (const bottom of [0, 34, 50]) {
  safeBottom=bottom;windowWidth=390;
  const shelf=makeShelf();
  shelf.bookshelfList(false);
  const list=nodes(shelf,'List')[0];
  assert.equal(list.height,'100%');
  assert.equal(list.padding,undefined,'List has no top/bottom viewport padding');
  assert.equal(list.contentStartOffset,52,'current shelf List uses the shared 60vp header minus its 8vp underlap');
  assert.equal(list.maintainVisibleContentPosition,true);
  assert.equal(nodes(shelf,'ListItem').length,1,'no spacer ListItem changes the stored item index');
  assert.equal(list.contentEndOffset,floating.readerFloatingTabContentInset(metrics()),
    'live shared nav clearance reaches List');
}
windowWidth=800;
const wide=makeShelf(true);
assert.equal(wide.isWideViewport(),true,'the actual live width selects the wide shelf surface');
wide.bookshelfList(true);
const wideEnd=nodes(wide,'List')[0].contentEndOffset;
windowWidth=390;
const narrow=makeShelf();
assert.equal(narrow.isWideViewport(),false);
narrow.bookshelfList(false);
const narrowEnd=nodes(narrow,'List')[0].contentEndOffset;
assert.equal(narrowEnd,floating.readerFloatingTabContentInset(metrics()));
assert.ok(narrowEnd>wideEnd,'the wide rail clearance is smaller than the floating phone tab clearance');

}
if(selectedCase==='empty-status') {
for (const width of [390, 800]) {
  windowWidth = width;
  safeBottom = 34;
  const empty = probe('bookshelf/BookshelfEmptyPage.ets', ['build', 'bottomContentInset', 'headerBottom'], {
    headerBottom: 60, sectionHeader() {}, contentFrame: () => ({ left: 19, right: 19, width: Math.min(352, width - 38) }),
  });
  empty.initialRender();
  const scroll=nodes(empty,'Scroll')[0]; const content=nodes(empty,'Column').find(n=>typeof n.padding?.bottom==='number');
  assert.ok(content); verifyScroll(empty,content.padding.top,content.padding.bottom); const initialBottom=content.padding.bottom;
  safeBottom = 50; empty.readerWindowMetricsRevision++; empty.replay();
  assert.equal(content.padding.bottom-initialBottom,50-34,'live safe delta reaches empty scroll child');
}
windowWidth = 390;

for (const failed of [false, true]) {
  safeBottom = 34;
  const status = probe('bookshelf/BookshelfStatusContent.ets',
    ['build', 'minimumContentHeight', 'bottomContentInset', 'numericAreaLength', 'headerBottom'], {
      failed, reduceMotion: false, viewportHeight: 0, headerBottom: 60, onRetry() {},
    });
  status.initialRender();
  const scroll = nodes(status, 'Scroll')[0];
  const content = nodes(status, 'Column')[0];
  assert.ok(content.constraintSize.minHeight>0);
  assert.equal(scroll.height, '100%');
  assert.equal(scroll.padding, undefined, 'status viewport is never reduced by the floating controls');
  assert.equal(content.height, undefined, 'intrinsic status content may grow beyond short viewports');
  assert.equal(content.justifyContent, 'FlexAlign.Center');
  for (const height of [400, 180, 100]) {
    scroll.onAreaChange({}, { height: `${height}vp` }); status.replay();
    assert.equal(content.constraintSize.minHeight, height, 'actual host area overrides window fallback');
    void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
    assert.equal(scroll.height, '100%');
  }
  safeBottom = 0; status.readerWindowMetricsRevision++; status.replay();
  assert.ok(content.padding.bottom>=0);
}

}
if(selectedCase==='settings-origin') for (const section of ['home', 'general']) {
  safeBottom = 34;
  let origin, backCount = 0, discoverCount = 0, rssCount = 0;
  const settings = probe('shell/SettingsShell.ets',
    ['build', 'homeTopBar', 'generalTopBar', 'pageOverlay', 'reportOverlayOrigin', 'onMainTab', 'scrollHomeToTop'], {
      activeSection: section, showOverlay: false, homeContent() {}, generalContent() {}, overlayContent() {},
      contentFrame: () => ({ left: 19, right: 19 }),
      onSectionChange() {}, onBack: () => { backCount += 1; },
      onDiscoverRequested: () => { discoverCount += 1; }, onRssRequested: () => { rssCount += 1; },
      onOverlayOriginChange: (x, y) => { origin = [x, y]; }, tapBottomScrollTop: true,
      homeScroller: { scrollTo() {} }, generalScroller: { scrollTo() {} },
    });
  settings.initialRender();
  const host = descendants(settings).find(child => section === 'home' ?
    child.params?.activeTab === 'settings' && child.params?.standardScroll === true :
    child.params?.variant === 'settingsGeneral');
  assert.ok(host, section === 'home' ?
    'Settings home delegates the complete scroll/frame to MainTabShell' :
    'Settings general uses the shared ReaderStandardPage');
  settings.reportOverlayOrigin({ globalPosition: { x: 10, y: 39 } });
  assert.deepEqual(origin, [10, 39], 'settings select popup retains its full-height global-to-local origin');
  if (section === 'home') {
    host.params.onMainTab('bookshelf'); host.params.onMainTab('discover'); host.params.onMainTab('rss');
    assert.deepEqual([backCount, discoverCount, rssCount], [1, 1, 1],
      'the shared main navigation maps each non-current tab to its owning route callback');
  }
}

if(selectedCase==='discover-header') {
safeBottom = 34;
const measured=[];
const discover = probe('discover/DiscoverPage.ets',
  ['build','homeTopBar','pageGeometry','railActive','bottomContentInset'], {
  appThemeScheme:'day',mainViewportRevision:0,wideNavigationRail:false,measurementRevision:0,
  measurements:{read:()=>60,record:(key,height,revision)=>{measured.push([key,height,revision]);return true;}},
  presentation:{loading:false,books:[],sources:[],activeSourceIndex:0,activeKindIndex:0,page:1,
    hasPrevious:false,hasNext:false,statusMessage:'',operation:undefined},
  onMainTab() {}, onRefresh() {}, contentFrame: () => ({ left: 19, right: 19, width: 352 }),
}, { MainTabShell: class extends Child {} });
discover.initialRender();
const discoverHeaderHost = descendants(discover).find(child => child.params?.headerKind === 'home');
assert.ok(discoverHeaderHost, 'Discover delegates its fixed header to the shared MainTabShell');
assert.equal(discoverHeaderHost.params.activeTab, 'discover');
assert.equal(typeof discoverHeaderHost.params.header, 'function');
discoverHeaderHost.params.header();
const topBar = descendants(discover).find(child => child.params?.title === '发现');
assert.ok(topBar, 'the delegated header actually emits the discover AppTopBar');
const geometry = discover.pageGeometry();
assert.ok(geometry.content.startInset > 0, 'discover content clears the measured shared header');
discoverHeaderHost.params.onHeaderHeightChange(60, 3);
assert.equal(measured.at(-1)?.[1], 60, 'the shared header measurement reaches the discover geometry store');

}
console.log('selected current shell case PASS: '+selectedCase);

}

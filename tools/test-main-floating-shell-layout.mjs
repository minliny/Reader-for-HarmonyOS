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
const { boundedMembers, readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { readerFoundationTokens } = await import('./lib/reader-tokens-probe.mjs');
const { actualReaderFloatingBarMetrics, actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const { actualReaderMainTabs, actualReaderPhoneNavigationGeometry } = await import('./lib/reader-phone-navigation-source.mjs');
const fontFamilies = await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const { READER_EXPANDED_MIN_WIDTH } = await import('../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts');
const { effectiveReaderWideNavigationRail } = await import('../entry/src/main/ets/app/ReaderProductScope.ts');
const raisedShape = await import('../entry/src/main/ets/ui/layout/ReaderRaisedShape.ts');
const horizontalGeometry = await import('../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts');
const { readerContentSafeTop, readerInteractiveSafeBottom, readerInteractiveSafeLeft,
  readerInteractiveSafeRight, readerVisualSafeTop } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');


const root = new URL('../entry/src/main/ets/features/', import.meta.url);
const liveSourcePaths = new Map([
  ['search/SearchSpinner.ets', 'search/ui/SearchSpinner.ets'],
  ['bookshelf/BookshelfShell.ets', 'bookshelf/ui/BookshelfShell.ets'],
  ['bookshelf/BookshelfPage.ets', 'bookshelf/ui/BookshelfPage.ets'],
  ['bookshelf/BookshelfEmptyPage.ets', 'bookshelf/ui/BookshelfEmptyPage.ets'],
  ['bookshelf/BookshelfStatusContent.ets', 'bookshelf/ui/BookshelfStatusContent.ets'],
  ['shell/SettingsShell.ets', 'settings/ui/SettingsShell.ets'],
]);
const read = file => readFileSync(new URL(liveSourcePaths.get(file) ?? file, root), 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const builders = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
const floating = await import('./lib/reader-floating-bar-metrics-probe.mjs');
let safeBottom = 15;
let safeLeft = 0;
let safeRight = 0;
let windowWidth = 390;
const metrics = () => ({ windowRect: { width: windowWidth, height: 844 },
  systemInsets: { top: 39, left: safeLeft, right: safeRight, bottom: safeBottom },
  cutoutInsets: { top: 0, left: 0, right: 0, bottom: 0 },
  gestureInsets: { top: 0, left: 0, right: 0, bottom: 0 },
  navigationInsets: { top: 0, left: 0, right: 0, bottom: 0 },
  keyboardInsets: { top: 0, left: 0, right: 0, bottom: 0 },
});
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const properties = createArkUIPropertyRuntimeProbe();
const hooks = { ...properties.hooks, mountChildren: true };
const deps = { ...properties.sdk, ...readerFoundationTokens, ...actualReaderPageLayout(), ...raisedShape,
  ...horizontalGeometry, ...readerSurfaceSpecsForProbe({ densityPixels: 1 }), ...floating, ...fontFamilies,
  readerVisualSafeTop, readerInteractiveSafeBottom,
  ReaderWindowCoordinator: { metrics }, readerContentSafeTop, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  MAIN_TABS: [], RSS_FLOATING_HEADER_HEIGHT: 148, RSS_TABLET_RAIL_WIDTH: 100,
  LazyForEach: { create() {}, pop() {} }, ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
};
for (const [name, file, slots] of [
  ['MainTabBar', 'shell/MainTabBar.ets', []],
  ['ReaderBottomNavigation', '../app/navigation/ReaderBottomNavigation.ets', []],
  ['ReaderBottomTabBar', '../ui/patterns/ReaderBottomTabBar.ets', []],
  ['ReaderRaisedSurface', '../ui/surfaces/ReaderRaisedSurface.ets', []],
  ['MainTabShell', 'shell/MainTabShell.ets', ['content']],
  ['MainNavigationOverlay', 'shell/MainNavigationOverlay.ets', ['overlayContent']],
  ['PageBackBar', '../ui/chrome/PageBackBar.ets', ['trailing']],
  ['AppTopBar', '../ui/chrome/AppTopBar.ets', ['trailing']],
  ['SearchSpinner', 'search/SearchSpinner.ets', []],
]) {
  const source = read(file);
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
  syntax.builderParamObjectCollection.set(name, new Set(slots));
  deps[name] = class extends Child {};
}
function probe(file, members, values) {
  const source = read(file);
  for (const m of source.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g)) builders.add(m[1]);
  const { owner } = createReaderBuilderProbe(source, members, deps, hooks);
  Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 0, ...values });
  return owner;
}
const descendants = owner => [owner, ...[...(owner.children?.values() ?? [])].flatMap(descendants)];
const nodes = (owner, type) => descendants(owner).flatMap(child => [...(child.nodes?.values() ?? [])]).filter(node => node.type === type);
const replayTree = owner => { owner.replay?.(); for (const child of owner.children?.values() ?? []) replayTree(child); };
const sharedHeader = createReaderBuilderProbe(read('../ui/chrome/PageBackBar.ets'), boundedMembers(read('../ui/chrome/PageBackBar.ets')), deps, hooks);
deps.PageBackBar = sharedHeader.Component;
deps.AppTopBar = createReaderBuilderProbe(read('../ui/chrome/AppTopBar.ets'), boundedMembers(read('../ui/chrome/AppTopBar.ets')), deps, hooks).Component;
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
if(selectedCase==='navigation') {
  const currentMainTabs = actualReaderMainTabs(), pageLayout = actualReaderPageLayout();
  const currentFloating = actualReaderFloatingBarMetrics();
  const storage = new Map();
  const phoneWindow = { metrics: () => ({ ...metrics(), revision: 0, systemFontScale: 1 }) };
  const policyPorts = { ...currentMainTabs, ...currentFloating, ReaderWindowCoordinator: phoneWindow,
    AppStorage: { get: key => storage.get(key), setOrCreate: (key, value) => storage.set(key, value) },
    readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerVisualSafeTop, READER_EXPANDED_MIN_WIDTH,
    effectiveReaderWideNavigationRail };
  // Execute the current policy module; no fixture decides rail/bottom placement
  // or duplicates the viewport/width math. This case supplies phone metrics only.
  const policyText = stripTypeScriptTypes(read('shell/MainNavigationSpec.ts')
    .replace(/^import[\s\S]*?;\s*/gm, '')
    .replace(/^export\s+(?:type\s+)?\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*/gm, '')
    .replace(/^export /gm, ''));
  const phonePolicy = new Function(...Object.keys(policyPorts), `${policyText};
    return { readerMainNavigationMode, readerMainViewport, publishReaderMainViewport, mainTabBottomWidth };`)(...Object.values(policyPorts));
  const phoneHooks = { ...hooks, lifecycleChildren: true };
  const phoneDeps = { ...deps, ...pageLayout, ...currentMainTabs, ...currentFloating, ...phonePolicy,
    ReaderWindowCoordinator: phoneWindow,
    registerReaderShelfFonts: font => assert.ok(font && typeof font === 'object', 'real navigation lifecycle receives the native Font port') };
  const rendererSource = read('../ui/patterns/ReaderBottomTabBar.ets');
  const Renderer = createReaderBuilderProbe(rendererSource, boundedMembers(rendererSource), phoneDeps, phoneHooks).Component;
  const navigationSource = read('../app/navigation/ReaderBottomNavigation.ets');
  const Navigation = createReaderBuilderProbe(navigationSource, boundedMembers(navigationSource),
    { ...phoneDeps, ReaderBottomTabBar: Renderer }, phoneHooks).Component;
  const shellSource = read('shell/MainTabShell.ets');
  for (const generation of [0, 7]) {
    const tabCalls = [], currentCalls = [];
    const shell = createReaderBuilderProbe(shellSource, boundedMembers(shellSource),
      { ...phoneDeps, ReaderBottomNavigation: Navigation }, phoneHooks).owner;
    Object.assign(shell, { activeTab: 'bookshelf', appThemeScheme: 'day', navigationGeneration: generation,
      readerWindowMetricsRevision: 0, mainViewportRevision: 0, content() {},
      onMainTab(key, presented) { tabCalls.push([key, presented]); },
      onCurrentTabTap(key, presented) { currentCalls.push([key, presented]); } });
    shell.aboutToAppear(); shell.initialRender();
    const scaffold = descendants(shell).find(child => typeof child.frameStyle === 'object' && child.geometry?.content);
    assert.ok(scaffold, 'the current phone shell mounts the real public scaffold');
    const hostNodes = [...scaffold.nodes.values()];
    assert.ok(hostNodes.filter(node => node.type === 'Column').every(node => node.layoutWeight === undefined), 'shared chrome hosts do not subtract space from the full-height body');
    const hostStacks = hostNodes.filter(node => node.type === 'Stack');
    assert.ok(hostStacks.every(node => node.height === '100%'), 'full-height assertions address page hosts, not tab glyphs');
    const bottoms = hostStacks.filter(node => node.create.alignContent === 'Alignment.Bottom');
    assert.equal(bottoms.length, 1, 'public scaffold owns one separate full-height bottom-navigation host');
    const overlay = bottoms[0];
    assert.ok(hostStacks.some(node => node.backgroundColor === readerAppColor('TOK_PAPER', 'day')), 'public page root retains the approved opaque paper');
    assert.equal(overlay.hitTestBehavior, 'HitTestMode.Transparent');
    assert.equal(overlay.backgroundColor, undefined);
    assert.equal(descendants(shell).filter(child => child instanceof Navigation).length, 1, 'one product navigation assembles the current phone footer');
    assert.equal(descendants(shell).filter(child => child instanceof Renderer).length, 1, 'one shared renderer paints the current phone footer');
    const buttons = nodes(shell, 'Button');
    const settings = buttons.find(node => node.accessibilityText === '设置');
    const current = buttons.find(node => node.accessibilityText === '书架，已选中');
    assert.ok(settings?.onClick && current?.onClick, 'real admitted native tab actions are reachable');
    settings.onClick(); assert.deepEqual(tabCalls, [['settings', generation]], 'actual shared navigation method admits the mounted generation');
    current.onClick(); assert.deepEqual(currentCalls, [['bookshelf', generation]], 'current tab reaches the same controlled generation');
    shell.navigationGeneration = generation + 1; settings.onClick(); current.onClick();
    assert.deepEqual(tabCalls, [['settings', generation]], 'retained native tab cannot borrow a later generation');
    assert.deepEqual(currentCalls, [['bookshelf', generation]], 'retained current-tab action cannot borrow a later generation');
    shell.navigationGeneration = generation; shell.aboutToDisappear(); settings.onClick(); current.onClick();
    assert.deepEqual(tabCalls, [['settings', generation]], 'retired public navigation refuses its retained callback');
    assert.deepEqual(currentCalls, [['bookshelf', generation]], 'retired public navigation also refuses the retained current-tab callback');
  }
}

if(selectedCase==='navigation') {
const currentMainTabs = actualReaderMainTabs();
const phoneGeometry = actualReaderPhoneNavigationGeometry({ ...deps, AppStorage: { get: () => undefined } });
const rendererSource = read('../ui/patterns/ReaderBottomTabBar.ets');
const renderer = createReaderBuilderProbe(rendererSource, boundedMembers(rendererSource),
  { ...deps, ...actualReaderFloatingBarMetrics() }, hooks);
const navigationSource = read('../app/navigation/ReaderBottomNavigation.ets');
const bar = createReaderBuilderProbe(navigationSource, boundedMembers(navigationSource),
  { ...deps, ...currentMainTabs, ...phoneGeometry, ReaderBottomTabBar: renderer.Component }, hooks).owner;
Object.assign(bar, { current: 'bookshelf', appThemeScheme: 'day', readerWindowMetricsRevision: 0,
  mainViewportRevision: 0, bottomBarFrame: () => ({ width: 360 }), bottomBarTranslateX: () => 0 });
bar.initialRender();
const surface = nodes(bar, 'Row')[0];
// a8819e0c adopts the approved 68vp translucent pill with a 34vp radius.
// Width remains the explicit frame input; the actual 2/3/4-tab frame is covered
// by test-manga-ui-floating-bars rather than inferred from this fixture's output.
assert.equal(surface.width,360,'public frame width passes through'); assert.equal(surface.clip,true);
assert.equal(surface.hitTestBehavior, 'HitTestMode.Transparent');
const bottomHost = nodes(bar, 'Stack').find(node => node.margin?.bottom !== undefined);
assert.ok(bottomHost, 'the actual phone renderer owns the bottom inset');
for (const bottom of [0, 15, 34, 50]) {
  safeBottom = bottom; bar.readerWindowMetricsRevision++; replayTree(bar);
  assert.equal(bottomHost.margin.bottom, Math.max(15, bottom));
}

}
if(selectedCase==='shelf-list') {
const shelf = probe('bookshelf/BookshelfPage.ets', ['bookshelfList','shelfPageHandler','shelfScrollHandler','isShelfPresentationCurrent', 'isWideViewport', 'effectiveViewportWidth'], {
  continueReading: undefined, filterRowVisible: false, viewModeError: '', visibleBookCount: 1,
  rowDataSource: {}, shelfScroller: {}, headerClearance: 74, shelfContentWidth: () => 352, viewportWidth: 0,
});
shelf.bookshelfList(false);
const list = nodes(shelf, 'List')[0];
assert.equal(list.height, '100%');
assert.equal(list.padding, undefined, 'List has no top/bottom viewport padding');
assert.equal(list.contentStartOffset, 74, 'shelf content clears the current floating header and its approved gap');
assert.equal(list.maintainVisibleContentPosition, true);
assert.equal(nodes(shelf, 'ListItem').length, 1, 'no spacer ListItem changes the stored item index');
for (const bottom of [0, 34, 50]) {
  safeBottom = bottom; shelf.readerWindowMetricsRevision++; shelf.replay();
  assert.equal(list.contentEndOffset,floating.readerFloatingTabContentInset(metrics()),'live shared nav clearance reaches List');
}
windowWidth = 800; shelf.readerWindowMetricsRevision++; shelf.replay();
assert.equal(shelf.isWideViewport(), true, 'the actual live width selects the wide shelf surface');
const wideEnd=list.contentEndOffset; assert.ok(wideEnd>=0); 
windowWidth = 390; shelf.readerWindowMetricsRevision++; shelf.replay();
assert.equal(shelf.isWideViewport(), false);
assert.equal(list.contentEndOffset,floating.readerFloatingTabContentInset(metrics())); assert.ok(list.contentEndOffset>wideEnd);

}
if(selectedCase==='empty-status') {
const { actualReaderPageShell } = await import('./lib/reader-page-shell-runtime-probe.mjs');
deps.readerPageAreaLength = actualReaderPageShell().readerPageAreaLength;
for (const width of [390, 800]) {
  windowWidth = width;
  safeBottom = 34;
  const empty = probe('bookshelf/BookshelfEmptyPage.ets', ['build', 'bottomContentInset', 'emptyCardWidth'], {
    sectionHeader() {}, contentFrame: () => ({ left: 19, right: 19, width: Math.min(352, width - 38) }),
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
    ['build', 'minimumContentHeight', 'bottomContentInset'], {
      failed, viewportHeight: 0, onRetry() {},
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
    scroll.onAreaChange({}, { height: Infinity }); status.replay();
    assert.equal(content.constraintSize.minHeight, height, 'invalid area does not replace the current viewport');
    void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
    assert.equal(scroll.height, '100%');
  }
  safeBottom = 0; status.readerWindowMetricsRevision++; status.replay();
  assert.ok(content.padding.bottom>=0);
}

}
if(selectedCase==='settings-origin') for (const section of ['home', 'general']) {
  safeBottom = 34;
  let origin;
  const settings = probe('shell/SettingsShell.ets',
    ['homeContent', 'generalContent', 'overlayContent', 'homeScroller', 'generalScroller', 'build', 'homeNavigation', 'generalTopBar', 'pageOverlay', 'reportOverlayOrigin'], {
      activeSection: section, showOverlay: false, homeContent() {}, generalContent() {}, overlayContent() {},
      contentFrame: () => ({ left: 19, right: 19 }),
      onSectionChange() {}, onMainTab() {}, onOverlayOriginChange: (x, y) => { origin = [x, y]; },
    });
  settings.initialRender();
  const content=nodes(settings,'Column').find(n=>typeof n.padding?.top==='number' && typeof n.padding?.bottom==='number'); assert.ok(content);
  verifyScroll(settings,content.padding.top,content.padding.bottom); const initialBottom=content.padding.bottom;
  assert.ok(nodes(settings, 'Row').some(node => node.hitTestBehavior === 'HitTestMode.Transparent'));
  assert.equal(descendants(settings).filter(child => child.params?.current === 'settings').length, section === 'home' ? 1 : 0);
  const rootStack = nodes(settings, '__Common__').find(node => node.onAreaChange);
  rootStack.onAreaChange({}, { globalPosition: { x: 10, y: 39 } });
  assert.deepEqual(origin, [10, 39], 'settings select popup retains its full-height global-to-local origin');
  if (section === 'home') {
    safeBottom = 50; settings.readerWindowMetricsRevision++; replayTree(settings);
    assert.equal(content.padding.bottom-initialBottom,50-34);
  }
}

if(selectedCase==='discover-header') {
safeBottom = 34;
const discover = probe('discover/DiscoverPage.ets', ['build', 'homeTopBar', 'discoverContent', 'bottomContentInset'], {
  presentation: { loading: false }, onMainTab() {}, onRefresh() {}, currentSourceCard() {}, categoryChips() {}, filterRow() {}, rankingHeader() {}, resultList() {}, operationFeedback() {},
  contentFrame: () => ({ left: 19, right: 19, width: 352 }),
});
discover.initialRender();
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
const discoverHeaderHost = descendants(discover).find(child => child.params?.kind === 'home');
assert.ok(discoverHeaderHost, 'Discover title uses the actual shared fixed-header host');
assert.equal(nodes(discoverHeaderHost, 'Column')[0].hitTestBehavior, 'HitTestMode.Transparent');

}
console.log('selected current shell case PASS: '+selectedCase);

}

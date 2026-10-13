import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { readerContentSafeTop, readerInteractiveSafeBottom, readerInteractiveSafeLeft,
  readerInteractiveSafeRight, readerVisualSafeTop } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const root = new URL('../entry/src/main/ets/features/', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const builders = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
const metricsSource = read('common/ReaderFloatingBarMetrics.ts').replace(/^import .*;\n/gm, '');
const floating = new Function('readerInteractiveSafeBottom', `${stripTypeScriptTypes(metricsSource)}; return {
  READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset, readerFloatingTabBottomInset, readerFloatingTabContentInset
};`.replaceAll('export ', ''))(readerInteractiveSafeBottom);
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
const deps = { ...properties.sdk, ...floating, ...fontFamilies, readerVisualSafeTop, readerInteractiveSafeBottom, TOK_SPACE_XS: 8, TOK_SPACE_SM: 12, TOK_SPACE_MD: 16, TOK_SPACE_LG: 24,
  BOOKSHELF_WIDE_BREAKPOINT: Number(read('bookshelf/BookshelfShell.ets').match(/export const BOOKSHELF_WIDE_BREAKPOINT = (\d+);/)[1]),
  ReaderWindowCoordinator: { metrics }, readerContentSafeTop, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  MAIN_TABS: [], RSS_FLOATING_HEADER_HEIGHT: 148, RSS_TABLET_RAIL_WIDTH: 100,
  LazyForEach: { create() {}, pop() {} }, ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
};
for (const [name, file, slots] of [
  ['MainTabBar', 'shell/MainTabBar.ets', []],
  ['MainTabShell', 'shell/MainTabShell.ets', ['content']],
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
const sharedHeader = createReaderBuilderProbe(read('common/PageBackBar.ets'), boundedMembers(read('common/PageBackBar.ets')), deps, hooks);
deps.PageBackBar = sharedHeader.Component;
deps.AppTopBar = createReaderBuilderProbe(read('common/AppTopBar.ets'), boundedMembers(read('common/AppTopBar.ets')), deps, hooks).Component;
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
for (const bottomNav of [false, true]) {
  const shell = probe('shell/MainTabShell.ets', ['content', 'header', 'overlay', 'emptySlot', 'headerKind', 'headerTop', 'headerInsetLeft', 'headerInsetRight', 'bottomNavigation', 'mainOverlays', 'build'], {
    activeTab: 'bookshelf', showTabletRail: false, showBottomNav: bottomNav, content() {}, onMainTab() {},
  });
  shell.initialRender();
  assert.ok(nodes(shell, 'Column').every(node => node.layoutWeight === undefined), 'shared chrome hosts do not subtract space from the full-height body');
  assert.ok(nodes(shell, 'Stack').every(node => node.height === '100%'));
  if (bottomNav) {
    const bottoms = nodes(shell, 'Stack').filter(node => node.create.alignContent === 'Alignment.Bottom');
    assert.equal(bottoms.length, 1, 'public scaffold owns one separate full-height bottom-navigation host');
    const overlay = bottoms[0];
    assert.ok(nodes(shell, 'Stack').some(node => node.backgroundColor === readerAppColor('TOK_PAPER', 'day')), 'public page root retains the approved opaque paper');
    assert.equal(overlay.hitTestBehavior, 'HitTestMode.Transparent');
    assert.equal(overlay.backgroundColor, undefined);
  }
}

const bar = probe('shell/MainTabBar.ets', ['bottomBar', 'bottomInset'], {
  current: 'bookshelf', bottomBarFrame: () => ({ width: 360 }), bottomBarTranslateX: () => 0,
});
bar.bottomBar();
const surface = nodes(bar, 'Row')[0];
// a8819e0c adopts the approved 68vp translucent pill with a 34vp radius.
// Width remains the explicit frame input; the actual 2/3/4-tab frame is covered
// by test-manga-ui-floating-bars rather than inferred from this fixture's output.
assert.deepEqual([surface.width, surface.height, surface.borderRadius, surface.clip], [360, 68, 34, true]);
assert.equal(surface.hitTestBehavior, 'HitTestMode.Transparent');
for (const bottom of [0, 15, 34, 50]) {
  safeBottom = bottom; bar.readerWindowMetricsRevision++; bar.replay();
  assert.equal(surface.margin.bottom, Math.max(15, bottom));
}

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
  assert.equal(list.contentEndOffset, 68 + Math.max(15, bottom) + 16);
}
windowWidth = 800; shelf.readerWindowMetricsRevision++; shelf.replay();
assert.equal(shelf.isWideViewport(), true, 'the actual live width selects the wide shelf surface');
assert.equal(list.contentEndOffset, 24, 'wide shelf retains its content gap without reserving the phone tab overlay');
windowWidth = 390; shelf.readerWindowMetricsRevision++; shelf.replay();
assert.equal(shelf.isWideViewport(), false);
assert.equal(list.contentEndOffset, 134, 'returning to phone width restores the live safe-bottom tab clearance');

for (const width of [390, 800]) {
  windowWidth = width;
  safeBottom = 34;
  const empty = probe('bookshelf/BookshelfEmptyPage.ets', ['build', 'bottomContentInset'], {
    sectionHeader() {}, contentFrame: () => ({ left: 19, right: 19, width: Math.min(352, width - 38) }),
  });
  empty.initialRender();
  const content = verifyScroll(empty, 66, 118);
  safeBottom = 50; empty.readerWindowMetricsRevision++; empty.replay();
  assert.equal(content.padding.bottom, 134, 'empty tablet fallback keeps the bottom tab clearance');
}
windowWidth = 390;

for (const failed of [false, true]) {
  safeBottom = 34;
  const status = probe('bookshelf/BookshelfStatusContent.ets',
    ['build', 'minimumContentHeight', 'bottomContentInset', 'numericAreaLength'], {
      failed, reduceMotion: false, viewportHeight: 0, onRetry() {},
    });
  status.initialRender();
  const scroll = nodes(status, 'Scroll')[0];
  const content = nodes(status, 'Column')[0];
  assert.equal(content.constraintSize.minHeight, 805, 'initial status uses the current app-safe window height');
  assert.equal(scroll.height, '100%');
  assert.equal(scroll.padding, undefined, 'status viewport is never reduced by the floating controls');
  assert.equal(content.height, undefined, 'intrinsic status content may grow beyond short viewports');
  assert.equal(content.justifyContent, 'FlexAlign.Center');
  for (const height of [400, 180, 100]) {
    scroll.onAreaChange({}, { height: `${height}vp` }); status.replay();
    assert.equal(content.constraintSize.minHeight, height, 'actual host area overrides window fallback');
    assert.deepEqual(content.padding, { top: 58, bottom: 118 });
    assert.equal(scroll.height, '100%');
  }
  safeBottom = 0; status.readerWindowMetricsRevision++; status.replay();
  assert.equal(content.padding.bottom, 99, 'both loading and error clear the phone fallback navigation');
}

for (const section of ['home', 'general']) {
  safeBottom = 34;
  let origin;
  const settings = probe('shell/SettingsShell.ets',
    ['homeContent', 'generalContent', 'overlayContent', 'homeScroller', 'generalScroller', 'build', 'homeNavigation', 'generalTopBar', 'pageOverlay', 'reportOverlayOrigin'], {
      activeSection: section, showOverlay: false, homeContent() {}, generalContent() {}, overlayContent() {},
      contentFrame: () => ({ left: 19, right: 19 }),
      onSectionChange() {}, onMainTab() {}, onOverlayOriginChange: (x, y) => { origin = [x, y]; },
    });
  settings.initialRender();
  const content = verifyScroll(settings, 66, section === 'home' ? 118 : 34);
  assert.ok(nodes(settings, 'Row').some(node => node.height === 58 && node.hitTestBehavior === 'HitTestMode.Transparent'));
  assert.equal(descendants(settings).filter(child => child.params?.current === 'settings').length, section === 'home' ? 1 : 0);
  const rootStack = nodes(settings, '__Common__').find(node => node.onAreaChange);
  rootStack.onAreaChange({}, { globalPosition: { x: 10, y: 39 } });
  assert.deepEqual(origin, [10, 39], 'settings select popup retains its full-height global-to-local origin');
  if (section === 'home') {
    safeBottom = 50; settings.readerWindowMetricsRevision++; replayTree(settings);
    assert.equal(content.padding.bottom, 134);
  }
}

safeBottom = 34;
const discover = probe('discover/DiscoverPage.ets', ['build', 'homeTopBar', 'discoverContent', 'bottomContentInset'], {
  presentation: { loading: false }, onMainTab() {}, onRefresh() {}, currentSourceCard() {}, categoryChips() {}, filterRow() {}, rankingHeader() {}, resultList() {}, operationFeedback() {},
  contentFrame: () => ({ left: 19, right: 19, width: 352 }),
});
discover.initialRender();
verifyScroll(discover, 66, 118);
const discoverHeaderHost = descendants(discover).find(child => child.params?.kind === 'home');
assert.ok(discoverHeaderHost, 'Discover title uses the actual shared fixed-header host');
assert.equal(nodes(discoverHeaderHost, 'Column')[0].hitTestBehavior, 'HitTestMode.Transparent');

for (const wide of [false, true]) for (const kind of ['feed', 'refreshing', 'emptyUnread', 'fatalError']) {
  safeBottom = 34;
  const rss = probe('rss/RssPage.ets', ['build', 'rssContent', 'rssHeader', 'feedScroll', 'emptyUnreadScroll', 'errorContent', 'bottomContentInset', 'numericAreaLength'], {
    presentation: { kind, subscriptions: [], recentUnread: [], failedSources: [] }, isWideViewport: () => wide,
    topBar() {}, searchBar() {}, statusTabs() {}, subscriptionSection() {}, recentUnreadSection() {},
    refreshingRow() {}, emptyUnreadSection() {}, stateCard() {}, readFeedback() {}, onMainTab() {},
    contentFrame: () => ({ left: 19, right: 19, width: 352 }),
  });
  rss.initialRender();
  const shell = [...rss.children.values()][0];
  assert.equal(shell.params.showBottomNav, !wide);
  assert.equal(shell.params.showTabletRail, wide);
  verifyScroll(rss, 156, wide ? 34 : 118);
  const rssHeaderHost = descendants(rss).find(child => child.params?.kind === 'rss');
  assert.ok(rssHeaderHost, 'all RSS states mount the real shared fixed-header owner');
  assert.equal(nodes(rssHeaderHost, 'Column')[0].hitTestBehavior, 'HitTestMode.Transparent');
  assert.ok(nodes(rss, 'Column').some(node => node.height === 148), 'original compound RSS header geometry remains unchanged');
}

const rssHeader = probe('rss/RssPage.ets', ['topBar', 'headerLeftInset', 'headerRightInset'], {
  refreshPill() {}, managePill() {},
});
rssHeader.topBar();
const headerTitle = nodes(rssHeader, 'Text').find(node => node.create === 'RSS');
const headerRow = nodes(rssHeader, 'Row').find(node => node.height === 58);
for (const [left, right] of [[0, 0], [38, 0], [0, 70], [48, 66]]) {
  safeLeft = left; safeRight = right; rssHeader.readerWindowMetricsRevision++; rssHeader.replay();
  assert.equal(headerTitle.margin.left, Math.max(20, left));
  assert.equal(headerRow.padding.right, Math.max(20, right), 'private RSS header clears asymmetric live safe edges');
  assert.equal(headerRow.height, 58);
}

console.log('PASS floating main shells: full-height scroll/List viewports, content clearances, transparent bar wrappers, safe-bottom updates, stable shelf indices, Settings origin, all RSS states.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerContentSafeTop, readerInteractiveSafeBottom, readerInteractiveSafeLeft,
  readerInteractiveSafeRight } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

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
const metrics = () => ({ windowRect: { width: 390, height: 844 },
  systemInsets: { top: 39, left: safeLeft, right: safeRight, bottom: safeBottom },
  cutoutInsets: { top: 0, left: 0, right: 0, bottom: 0 },
  gestureInsets: { top: 0, left: 0, right: 0, bottom: 0 },
  navigationInsets: { top: 0, left: 0, right: 0, bottom: 0 },
  keyboardInsets: { top: 0, left: 0, right: 0, bottom: 0 },
});
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const deps = { ...floating, TOK_SPACE_XS: 8, TOK_SPACE_SM: 12, TOK_SPACE_MD: 16, TOK_SPACE_LG: 24,
  ReaderWindowCoordinator: { metrics }, readerContentSafeTop, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  MAIN_TABS: [], RSS_FLOATING_HEADER_HEIGHT: 148, RSS_TABLET_RAIL_WIDTH: 100,
  LazyForEach: { create() {}, pop() {} }, ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
};
for (const [name, file, slots] of [
  ['MainTabBar', 'shell/MainTabBar.ets', []],
  ['MainTabShell', 'shell/MainTabShell.ets', ['content']],
  ['PageBackBar', 'common/PageBackBar.ets', ['trailing']],
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
  const { owner } = createReaderBuilderProbe(source, members, deps);
  Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 0, ...values });
  return owner;
}
const nodes = (owner, type) => [...owner.nodes.values()].filter(node => node.type === type);
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
  const shell = probe('shell/MainTabShell.ets', ['content', 'build'], {
    activeTab: 'bookshelf', showTabletRail: false, showBottomNav: bottomNav, content() {}, onMainTab() {},
  });
  shell.initialRender();
  assert.equal(nodes(shell, 'Column').length, 0, 'phone shell no longer has a normal-flow navigation row');
  assert.ok(nodes(shell, 'Stack').every(node => node.height === '100%'));
  if (bottomNav) {
    const overlay = nodes(shell, 'Stack').find(node => node.create.alignContent === 'Alignment.Bottom');
    assert.equal(overlay.hitTestBehavior, 'HitTestMode.Transparent');
    assert.equal(overlay.backgroundColor, undefined);
  }
}

const bar = probe('shell/MainTabBar.ets', ['bottomBar', 'bottomInset'], {
  current: 'bookshelf', bottomBarFrame: () => ({ width: 360 }), bottomBarTranslateX: () => 0,
});
bar.bottomBar();
const surface = nodes(bar, 'Row')[0];
assert.deepEqual([surface.width, surface.height, surface.borderRadius, surface.clip], [360, 68, 24, true]);
assert.equal(surface.hitTestBehavior, 'HitTestMode.Transparent');
for (const bottom of [0, 15, 34, 50]) {
  safeBottom = bottom; bar.readerWindowMetricsRevision++; bar.replay();
  assert.equal(surface.margin.bottom, Math.max(15, bottom));
}

const shelf = probe('bookshelf/BookshelfPage.ets', ['bookshelfList','shelfPageHandler','shelfScrollHandler','isShelfPresentationCurrent', 'shelfBottomContentInset'], {
  continueReading: undefined, filterRowVisible: false, viewModeError: '', visibleBookCount: 1,
  rowDataSource: {}, shelfScroller: {}, shelfContentWidth: () => 352,
});
shelf.bookshelfList(false);
const list = nodes(shelf, 'List')[0];
assert.equal(list.height, '100%');
assert.equal(list.padding, undefined, 'List has no top/bottom viewport padding');
assert.equal(list.contentStartOffset, 66);
assert.equal(list.maintainVisibleContentPosition, true);
assert.equal(nodes(shelf, 'ListItem').length, 1, 'no spacer ListItem changes the stored item index');
for (const bottom of [0, 34, 50]) {
  safeBottom = bottom; shelf.readerWindowMetricsRevision++; shelf.replay();
  assert.equal(list.contentEndOffset, 68 + Math.max(15, bottom) + 16);
}
assert.equal(shelf.shelfBottomContentInset(true), 50, 'tablet side rail clears the system bottom without reserving phone navigation');

for (const width of [390, 800]) {
  safeBottom = 34;
  const empty = probe('bookshelf/BookshelfEmptyPage.ets', ['build', 'bottomContentInset'], {
    sectionHeader() {}, contentFrame: () => ({ left: 19, right: 19, width: Math.min(352, width - 38) }),
  });
  empty.initialRender();
  const content = verifyScroll(empty, 66, 118);
  safeBottom = 50; empty.readerWindowMetricsRevision++; empty.replay();
  assert.equal(content.padding.bottom, 134, 'empty tablet fallback keeps the bottom tab clearance');
}

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
    ['homeContent', 'generalContent', 'overlayContent', 'build', 'homeBottomContentInset', 'generalBottomContentInset'], {
      activeSection: section, showOverlay: false, homeContent() {}, generalContent() {}, overlayContent() {},
      homeTopBar() {}, contentFrame: () => ({ left: 19, right: 19 }),
      onSectionChange() {}, onMainTab() {}, onOverlayOriginChange: (x, y) => { origin = [x, y]; },
    });
  settings.initialRender();
  const content = verifyScroll(settings, 66, section === 'home' ? 118 : 34);
  assert.ok(nodes(settings, 'Row').some(node => node.height === 58 && node.hitTestBehavior === 'HitTestMode.Transparent'));
  assert.equal([...settings.children.values()].filter(child => child.params.current === 'settings').length, section === 'home' ? 1 : 0);
  const rootStack = nodes(settings, 'Stack').find(node => node.onAreaChange);
  rootStack.onAreaChange({}, { globalPosition: { x: 10, y: 39 } });
  assert.deepEqual(origin, [10, 39], 'settings select popup retains its full-height global-to-local origin');
  if (section === 'home') {
    safeBottom = 50; settings.readerWindowMetricsRevision++; settings.replay();
    assert.equal(content.padding.bottom, 134);
  }
}

safeBottom = 34;
const discover = probe('discover/DiscoverPage.ets', ['discoverTabContent', 'discoverContent', 'bottomContentInset'], {
  homeTopBar() {}, currentSourceCard() {}, categoryChips() {}, filterRow() {}, rankingHeader() {}, resultList() {}, operationFeedback() {},
  contentFrame: () => ({ left: 19, right: 19, width: 352 }),
});
discover.discoverTabContent();
verifyScroll(discover, 66, 118);
assert.ok(nodes(discover, 'Row').some(node => node.height === 58 && node.hitTestBehavior === 'HitTestMode.Transparent'));

for (const wide of [false, true]) for (const kind of ['feed', 'refreshing', 'emptyUnread', 'fatalError']) {
  safeBottom = 34;
  const rss = probe('rss/RssPage.ets', ['build', 'feedScroll', 'emptyUnreadScroll', 'errorContent', 'bottomContentInset'], {
    presentation: { kind, subscriptions: [], recentUnread: [], failedSources: [] }, isWideViewport: () => wide,
    topBar() {}, searchBar() {}, statusTabs() {}, subscriptionSection() {}, recentUnreadSection() {},
    refreshingRow() {}, emptyUnreadSection() {}, stateCard() {}, readFeedback() {}, onMainTab() {},
    contentFrame: () => ({ left: 19, right: 19, width: 352 }),
  });
  rss.initialRender();
  const shell = [...rss.children.values()][0];
  assert.equal(shell.params.showBottomNav, !wide);
  assert.equal(shell.params.showTabletRail, wide);
  shell.params.content();
  verifyScroll(rss, 156, wide ? 34 : 118);
  assert.ok(nodes(rss, 'Column').some(node => node.height === 148 && node.hitTestBehavior === 'HitTestMode.Transparent'));
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

import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"index": {"description": "Index实际readiness/header与notice测量delta/当前业务Props", "resources": []}, "shell": {"description": "实际More global-local anchor/guarded callback/native area", "resources": []}, "status": {"description": "实际status retry与native loading", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {admitBookshelfSdkCarrier} = await import('./lib/bookshelf-projection-owner-probe.mjs');
const {default: assert} = await import('node:assert/strict');
const { existsSync, readFileSync } = await import('node:fs');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { resolve } = await import('node:path');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { iconButtonControls } = await import('./lib/reader-icon-button-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const fontFamilies = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const { isReaderMainTabEnabled } = await import('../entry/src/main/ets/app/ReaderProductScope.ts');
const geometryApi = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const { readerFloatingTabBottomInset, readerMainTabItemHeight } = await import('./lib/reader-floating-bar-metrics-probe.mjs');
const metricsApi = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');


const root = resolve(import.meta.dirname, '..');
const read = file => readFileSync(resolve(root, 'entry/src/main/ets', file), 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const builders = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const dependencies = {};
function register(name, source = '', slot) {
  // This public frame is compiled and mounted by the actual common probe.
  // Index imports must not replace it with an unrelated business port.
  if (name === 'ReaderPageScaffold') return;
  syntax.componentCollection.customComponents.add(name);
  const propertyNames = [...source.matchAll(/^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:private\s+|protected\s+|public\s+)?(\w+)\s*:/gm)]
    .map(match => match[1]);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop\s+(?:@Watch\([^)]*\)\s+)?(\w+)\s*:/g)].map(m => m[1])));
  syntax.propertyCollection.set(name, new Set(propertyNames));
  syntax.regularCollection.set(name, new Set([...source.matchAll(/^\s*(?:private\s+|protected\s+|public\s+)?(\w+)\s*:/gm)]
    .map(match => match[1])));
  if (slot) syntax.builderParamObjectCollection.set(name, new Set([slot]));
  dependencies[name] = class extends Child {};
}
const index = read('pages/Index.ets');
for (const match of index.matchAll(/from ['"]([^'"]+)['"]/g)) {
  const path = resolve(root, 'entry/src/main/ets/pages', match[1]) + '.ets';
  if (!existsSync(path)) continue;
  const text = readFileSync(path, 'utf8');
  for (const struct of text.matchAll(/(?:export\s+)?struct\s+(\w+)/g)) register(struct[1], text);
}
for (const m of index.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g)) builders.add(m[1]);
for (const [name, file, slot] of [
  ['BookshelfShell', 'features/bookshelf/BookshelfShell.ets', 'content'],
  ['MainTabShell', 'features/shell/MainTabShell.ets', 'content'],
  ['MainTabBar', 'features/shell/MainTabBar.ets'],
  ['AppTopBar', 'features/common/AppTopBar.ets', 'trailing'],
  ['ReaderIconButton', 'features/common/ReaderIconButton.ets'],
  ['ReaderRecoveryNotice', 'features/common/ReaderRecoveryNotice.ets'],
  ['BookshelfMoreMenu', 'features/bookshelf/BookshelfMoreMenu.ets'],
  ['BookshelfMoreActionSheet', 'features/bookshelf/BookshelfMoreActionSheet.ets'],
  ['ReaderPageState', 'features/common/ReaderPageState.ets'],
  ['ReaderRaisedSurface', 'features/common/ReaderRaisedSurface.ets'],
  ['SearchSpinner', 'features/search/SearchSpinner.ets'],
]) register(name, existsSync(resolve(root, 'entry/src/main/ets', file)) ? read(file) : '', slot);
const enumValues = name => new Proxy({}, { get: (_, key) => `${name}.${String(key)}` });
const results = [];
function check(name, action) {
  const family=name.startsWith('Index')?'index':name.startsWith('status ')?'status':'shell';
  if(selectedCase!==family)return;
  try { action(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, message: error.message }); }
}
function indexFixture(state, source = 'online') {
  const names = ['build', 'mangaOwnsWindowEdges', 'detailPendingNoticeVisible', 'indexRecoveryNotice'];
  if (index.includes('private bookshelfContent(')) names.push('bookshelfContent');
  if (index.includes('private bookshelfShellContent(')) names.push('bookshelfShellContent');
  const { owner } = createReaderBuilderProbe(index, names, {
    ...dependencies, SafeAreaType: enumValues('SafeAreaType'), SafeAreaEdge: enumValues('SafeAreaEdge'),
    LayoutSafeAreaType: enumValues('LayoutSafeAreaType'), LayoutSafeAreaEdge: enumValues('LayoutSafeAreaEdge'),
  });
  Object.assign(owner, { route: 'bookshelf', isBookshelfVisualAdmitted: state === 'populated',
    isCoreShelfEmpty: state === 'empty', bookshelfLoadFailed: state === 'failure',
    shelfHeaderHeight: 60, appThemeScheme: 'day', settingsSnapshot: { reduceMotion: false }, shelfProjectionRevision: '',
    shelfBooks: [{ sourceId: source }], readingSessionActive: false, readerOwnsWindowEdges: () => false,
    shelfRecovery: () => ({message:'',visible:false,canRetry:false,generation:0}),
    shelfReadRecovery: () => ({message:'',visible:false,canRetry:false,generation:0}),
    appContentTopInset: () => 39, hasVisibleImportDialog: () => false });
  admitBookshelfSdkCarrier(owner);
  owner.calls = [];
  for (const method of ['openImportDialog','openSearch','openBookshelfSettings','openBookshelfMultiSelect',
    'startManualBookshelfUpdate','openDiscover','openRss','openSettings','refreshBookshelf']) {
    owner[method] = () => owner.calls.push(method);
  }
  owner.initialRender();
  return owner;
}
for (const state of ['loading', 'empty', 'populated', 'failure']) {
  check(`Index ${state} keeps one shared bookshelf shell`, () => {
    const owner = indexFixture(state);
    const shells = [...owner.children.values()].filter(child => child instanceof dependencies.BookshelfShell);
    assert.equal(shells.length, 1, 'every real Index bookshelf state must retain the same shell');
  });
}
const childOf = (owner, name) => [...owner.children.values()].filter(child => child instanceof dependencies[name]);
const actors = owner => [owner, ...[...(owner.children?.values() ?? [])].flatMap(actors)];
const nodesOf = (owner, type) => actors(owner).flatMap(actor => [...(actor.nodes?.values() ?? [])]).filter(node => node.type === type);
for (const state of ['loading', 'empty', 'populated', 'failure']) {
  check(`Index ${state} real slot admits only its Core readiness content and live actions`, () => {
    const owner = indexFixture(state);
    const shell = childOf(owner, 'BookshelfShell')[0];
    shell.params.content();
    const expected = state === 'populated' ? 'BookshelfPage' : state === 'empty' ? 'BookshelfEmptyPage' : 'BookshelfStatusContent';
    const currentBody = () => {
      const matches = childOf(owner, expected);
      assert.equal(matches.length, 1);
      return matches[0];
    };
    const body = currentBody();
    assert.equal(shell.params.populated, state === 'populated');
    assert.equal(shell.params.canCheckUpdates, state === 'populated');
    if (state === 'populated') {
      assert.equal(body.params.headerBottom, 60, 'the content slot receives the current route header bottom');
      owner.shelfHeaderHeight = 92; owner.replayOnly([shell.id]);
      assert.equal(shell.params.headerBottom, 92,
        'the current Index header measurement reaches the retained shell');
      assert.equal(currentBody(), body, 'header measurement keeps the existing shelf actor');
      shell.params.onNoticeHeightChange(76);
      assert.equal(owner.shelfPendingNoticeHeight,76,'actual Shell callback delivers the measured card height into Index');
      shell.params.onNoticeHeightChange(103);
      assert.equal(owner.shelfPendingNoticeHeight,103,'the measured notice height updates the retained avoidance input');
      shell.params.onNoticeHeightChange(0);
      assert.equal(owner.shelfPendingNoticeHeight,0,'hidden notice releases avoidance through the same actual callback');
      assert.equal(currentBody(),body,'notice measurement does not replace the shelf actor');
    }
    if (state === 'failure' || state === 'loading') {
      assert.equal(body.params.failed, state === 'failure');
      body.params.onRetry(); assert.deepEqual(owner.calls, ['refreshBookshelf']); owner.calls = [];
    }
    if (state === 'empty') {
      body.params.onSearchRequested(); body.params.onImportRequested();
      assert.deepEqual(owner.calls, ['openSearch', 'openImportDialog']); owner.calls = [];
    }
    for (const action of ['onImportRequested', 'onBookshelfSettingsRequested', 'onBatchManageRequested', 'onCheckUpdatesRequested']) shell.params[action]();
    for (const key of ['discover', 'rss', 'settings', 'bookshelf']) shell.params.onMainTab(key);
    assert.deepEqual(owner.calls, ['openImportDialog', 'openBookshelfSettings', 'openBookshelfMultiSelect',
      'startManualBookshelfUpdate', 'openDiscover', 'openRss', 'openSettings']);
  });
}
check('Index state changes update the retained shell child props, including server-filtered update availability', () => {
  const owner = indexFixture('loading');
  const shell = childOf(owner, 'BookshelfShell')[0];
  for (const state of ['empty','populated','failure','loading','populated']) {
    Object.assign(owner, { isBookshelfVisualAdmitted: state === 'populated', isCoreShelfEmpty: state === 'empty',
      bookshelfLoadFailed: state === 'failure', bookshelfUpdateDone: 3, bookshelfUpdateTotal: 7,
      settingsSnapshot: { reduceMotion: true } });
    owner.replayOnly([shell.id]);
    assert.equal(childOf(owner, 'BookshelfShell')[0], shell, 'native child identity survives readiness changes');
    assert.equal(shell.params.populated, state === 'populated');
    assert.equal(shell.params.canCheckUpdates, state === 'populated');
    assert.deepEqual([shell.params.updateProgressDone, shell.params.updateProgressTotal, shell.params.reduceMotion], [3, 7, true]);
  }
  owner.shelfBooks = [{ sourceId: 'local' }]; owner.replayOnly([shell.id]); assert.equal(shell.params.canCheckUpdates, false);
  owner.shelfProjectionRevision = 'core-filtered'; owner.shelfHasOnlineBooks = true;
  owner.replayOnly([shell.id]); assert.equal(shell.params.canCheckUpdates, true, 'hidden online books retain check-update eligibility');
  owner.shelfHasOnlineBooks = false; owner.replayOnly([shell.id]); assert.equal(shell.params.canCheckUpdates, false);
});
const shellSource = read('features/bookshelf/BookshelfShell.ets');
const actualIcons = iconButtonControls();
dependencies.ReaderIconButton = actualIcons.icon.Component;
const actualHeaderSource = read('features/common/AppTopBar.ets');
const actualHeader = createReaderBuilderProbe(actualHeaderSource, boundedMembers(actualHeaderSource), {
  ...actualIcons.dependencies, ...readerFoundationTokens, ...readerTypographyRoles, ...fontFamilies, ...metricsApi,
  ReaderWindowCoordinator: { metrics: metricsApi.createDefaultReaderWindowMetrics },
}, actualIcons.hooks);
dependencies.AppTopBar = actualHeader.Component;
const actualMainSource = read('features/shell/MainTabShell.ets');
syntax.builderParamObjectCollection.set('MainTabShell', new Set(['content', 'header', 'overlayContent']));
let shellWidth = 365;
const shellMetrics = () => new metricsApi.ReaderWindowMetricsSnapshot(new metricsApi.ReaderRectVp(0,0,shellWidth,844));
const navigationSpecSource = read('features/shell/MainNavigationSpec.ts');
const actualNavigation = pureModuleProbe(navigationSpecSource, 'MainNavigationSpec.ts', {
  readerMainTabItemHeight, READER_EXPANDED_MIN_WIDTH: 600,
  readerInteractiveSafeBottom: metricsApi.readerInteractiveSafeBottom,
  readerInteractiveSafeLeft: metricsApi.readerInteractiveSafeLeft,
  readerInteractiveSafeRight: metricsApi.readerInteractiveSafeRight,
  readerVisualSafeTop: metricsApi.readerVisualSafeTop,
  isReaderMainTabEnabled, ReaderWindowCoordinator: { metrics: shellMetrics },
  AppStorage: { get: () => undefined },
}, ['readerMainNavigationMode', 'readerMainViewport', 'readerMainRailLeft', 'readerMainRailTop',
  'readerMainRailLeading', 'readerMainRailBottomInset', 'readerMainRailContentLeft', 'readerMainRailContentRight',
  'mainTabBottomWidth', 'mainTabRailHeight']);
const mainBarSource = read('features/shell/MainTabBar.ets');
const tabConfiguration = navigationSpecSource.match(/const ALL_MAIN_TABS:[\s\S]*?;\s*export const MAIN_TABS:[\s\S]*?;/)[0];
const MAIN_TABS = new Function('isReaderMainTabEnabled', stripTypeScriptTypes(tabConfiguration).replace(/\bexport /g, '') + '; return MAIN_TABS;')(isReaderMainTabEnabled);
dependencies.MainTabBar = createReaderBuilderProbe(mainBarSource, boundedMembers(mainBarSource), {
  ...dependencies, ...actualIcons.dependencies, ...readerFoundationTokens, ...readerTypographyRoles, ...fontFamilies,
  ...metricsApi, ...geometryApi, ...actualNavigation, MAIN_TABS, readerFloatingTabBottomInset, readerMainTabItemHeight,
  registerReaderShelfFonts() {},
  ReaderWindowCoordinator: { metrics: shellMetrics },
}, actualIcons.hooks).Component;
const actualMain = createReaderBuilderProbe(actualMainSource, boundedMembers(actualMainSource), {
    ...dependencies, ...actualIcons.dependencies, ...metricsApi, ...actualNavigation,
    ReaderWindowCoordinator: { metrics: shellMetrics },
}, { ...actualIcons.hooks, childSources: { ...actualIcons.hooks.childSources, AppTopBar: actualHeaderSource } });
dependencies.MainTabShell = class extends actualMain.Component {
  constructor(owner, params, storage, id, ...rest) { super(owner, params, storage, id, ...rest); this.params = { ...params }; }
  updateStateVars(params) { super.updateStateVars(params); Object.assign(this.params, params); }
};
const iconHit = actor => actualIcons.nodes(actor).find(node => node.type === 'Stack' && node.onClick);
function shellFixture({ populated = false, width = 365, menu = false } = {}) {
  shellWidth = width;
  const { owner } = createReaderBuilderProbe(shellSource, ['onNoticeHeightChange','noticeHeight','lastReadFeedback','onReadRecoveryChanged','onRecoveryChanged','content','mounted','temporaryBackIdentity','temporaryBackGeneration','navigationGeneration','onNavigationGenerationChanged','registerTemporaryBackGeneration','moreSelectionId','moreSheetCurrentId','moreSheetNavigation','moreSheetAppearedId','moreSheetChromeId','onTemporaryBackBridge','aboutToAppear','aboutToDisappear','consumeTemporaryBack','dismissMoreMenu','moreOpenAction','moreIntentAction','build','shellOverlay','recoveryNoticeContent','requestMainTab','requestCheckUpdates','numericAreaLength','moreSheetContent','moreSheetOptions','finishMoreSheet'], {
    ...dependencies, ...actualIcons.dependencies, ...metricsApi, bookshelfTemporaryGeneration:0,registerReaderShelfFonts(){}, READER_FLOATING_TOP_BAR_HEIGHT: 58,
    ReaderWindowCoordinator: { metrics: () => new metricsApi.ReaderWindowMetricsSnapshot(new metricsApi.ReaderRectVp(0,0,width,844)) },
  }, { ...actualIcons.hooks, childSources: { ...actualIcons.hooks.childSources, AppTopBar: actualHeaderSource } });
  let contentCalls = 0; const noticeHeights=[];
  Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 0, populated, viewportWidth: 0,
    recovery: {message:'',visible:false,canRetry:false,generation:0}, onNoticeHeightChange:height=>noticeHeights.push(height),
    moreMenuVisible: false, moreAnchorRight: 0, moreAnchorBottom: 0, overlayOriginX: 0, overlayOriginY: 0,
    canCheckUpdates: populated, updateRunning: false, backgroundUpdateRunning: false, updateProgressDone: 0, updateProgressTotal: 0,
    reduceMotion: false, onHeaderHeightChange: height => owner.reportedHeaderHeight = height, content: () => { contentCalls++; }, calls: [] });
  for (const action of ['onSearchRequested','onImportRequested','onBatchManageRequested','onBookshelfSettingsRequested','onCheckUpdatesRequested','onMainTab']) {
    owner[action] = (key) => owner.calls.push(key ? `${action}:${key}` : action);
  }
  owner.aboutToAppear();
  if(menu)owner.moreOpenAction(owner.temporaryBackIdentity)();
  owner.initialRender();
  const nav = childOf(owner, 'MainTabShell')[0]; nav.aboutToAppear();
  assert.equal(contentCalls, 1);
  return { owner, nav, noticeHeights };
}
check('one shell keeps content/nav actors through day-night and populated changes', () => {
  const { owner, nav, noticeHeights } = shellFixture();
  assert.equal(noticeHeights.at(-1),0,'actual recovery Watch/appear clears the unshown notice via its initialized callback');
  const before = [...owner.children.values()];
  for (const scheme of ['night','day','night']) {
    owner.appThemeScheme = scheme;
    owner.populated = !owner.populated; owner.replay(); actualIcons.properties.flush();
    assert.deepEqual([...owner.children.values()], before);
    assert.equal(childOf(owner, 'MainTabShell')[0], nav);
  }
  const navActor = actors(nav).find(actor => actor instanceof dependencies.MainTabBar);
  const settingsTab = nodesOf(navActor, 'Column').find(node => node.accessibilityText === '设置' && node.onClick);
  assert.ok(settingsTab, 'actual shared navigation native button is mounted'); settingsTab.onClick();
  assert.deepEqual(owner.calls, ['onMainTab:settings']);
  assert.ok(nodesOf(owner, 'Stack').some(node => node.height === '100%' && node.width === '100%'), 'content retains its full viewport under the floating header');
  assert.ok(nodesOf(nav, 'Stack').some(node => node.zIndex === 20), 'the actual shared scaffold owns the navigation overlay layer');
});
check('shell navigation keeps phone fallback and existing populated tablet rail threshold', () => {
  const { nav } = shellFixture();
  for (const width of [365, 599, 600, 800]) {
    shellWidth = width;
    nav.mainViewportRevision = 0;
    nav.wideNavigationRail = false;
    assert.equal(nav.navigationMode(), 'bottom', 'the shipping fallback stays bottom navigation');
    nav.wideNavigationRail = true;
    assert.equal(nav.navigationMode(), width < 600 ? 'bottom' : 'rail',
      'opt-in wide navigation keeps the shared expanded-width threshold');
  }
  const navActor = actors(nav).find(actor => actor instanceof dependencies.MainTabBar);
  assert.ok(navActor, 'the initial shipping fallback mounts the actual shared bottom bar');
});
check('More retains a live sheet identity and guarded callbacks', () => {
  const { owner } = shellFixture({populated:true,menu:true});
  assert.equal(owner.moreMenuVisible, true);
  owner.moreSheetContent();
  const more = childOf(owner, 'BookshelfMoreActionSheet').at(-1);
  assert.ok(more, 'the current bounded More sheet content is mounted by its production Builder');
  assert.equal(more.params.presentationId, owner.moreSelectionId);
  assert.equal(more.params.canCheckUpdates, true);
  more.params.onCheckUpdates();
  assert.deepEqual(owner.calls, ['onCheckUpdatesRequested']);
  assert.equal(owner.moreMenuVisible, false);
  owner.finishMoreSheet(owner.moreSheetCurrentId);
  owner.moreOpenAction(owner.temporaryBackIdentity)(); owner.moreSheetContent();
  const current = childOf(owner, 'BookshelfMoreActionSheet').at(-1);
  more.params.onBatchManage();
  assert.equal(owner.calls.length, 1, 'a retired sheet callback cannot borrow the new presentation');
  for (const [action,callback] of [['onBatchManage','onBatchManageRequested'],['onLocalImport','onImportRequested'],
    ['onBookshelfSettings','onBookshelfSettingsRequested']]) {
    owner.moreOpenAction(owner.temporaryBackIdentity)(); owner.moreSheetContent();
    childOf(owner,'BookshelfMoreActionSheet').at(-1).params[action]();
    assert.equal(owner.moreMenuVisible,false); assert.equal(owner.calls.at(-1),callback);
    owner.finishMoreSheet(owner.moreSheetCurrentId);
  }
  owner.moreOpenAction(owner.temporaryBackIdentity)(); owner.moreSheetContent();
  childOf(owner,'BookshelfMoreActionSheet').at(-1).params.onDismiss(); assert.equal(owner.moreMenuVisible,false);
});
for (const failed of [false,true]) check(`status ${failed ? 'failure' : 'loading'} current shared page state preserves retry/loading`, () => {
  const { owner } = createReaderBuilderProbe(read('features/bookshelf/BookshelfStatusContent.ets'), ['build'], {
    ...dependencies, READER_FLOATING_TOP_BAR_HEIGHT: 58,
  });
  let retries = 0; Object.assign(owner, { failed, reduceMotion:false, appThemeScheme:'day', onRetry:()=>retries++,
    title: '书架加载失败', message: '无法读取书架内容，请重试。', canRetry: true,
    minimumContentHeight: () => 400, bottomContentInset: () => 99 });
  owner.initialRender();
  const state = childOf(owner, 'ReaderPageState')[0];
  const stateProps = { ...state.params, ...(state.paramsGenerator_?.() ?? {}) };
  assert.ok(state, 'status content delegates to the current shared page-state owner');
  assert.equal(stateProps.loading, !failed);
  if (failed) {
    assert.deepEqual([stateProps.title, stateProps.message, stateProps.actionLabel],
      ['书架加载失败', '无法读取书架内容，请重试。', '重试']);
    stateProps.onAction(); assert.equal(retries, 1);
  } else {
    assert.equal(stateProps.title, '正在加载书架…');
    assert.equal(stateProps.actionLabel, '');
  }
  assert.equal(childOf(owner,'SearchSpinner').length,0,'the current status slot does not restore the retired private spinner');
});
check('opaque Index Scaffold registration reproduces the missing shared content slot', () => {
  const broken = createReaderBuilderProbe(actualMainSource, boundedMembers(actualMainSource), {
    ...dependencies, ...actualIcons.dependencies, ...metricsApi,
    ReaderWindowCoordinator: { metrics: shellMetrics },
    ReaderPageScaffold: class extends Child {},
  }, { ...actualIcons.hooks, childSources: { ...actualIcons.hooks.childSources, AppTopBar: actualHeaderSource } });
  let contentCalls = 0;
  broken.owner.content = () => { contentCalls++; };
  broken.owner.initialRender();
  assert.throws(() => assert.equal(contentCalls, 1),
    error => error.code === 'ERR_ASSERTION' && error.actual === 0 && error.expected === 1,
    'restoring the old opaque import must fail the unchanged shared-content admission');
});
// This executes SDK-emitted observers, not Harmony native layout/removal or dependency scheduling.
// Each readiness slot is checked independently; persistence is asserted on the actual parent child-update path.
assert.ok(results.length,'selected family executes at least one actual SDK case');
for (const row of results) console.log(`${row.passed ? 'PASS' : 'FAIL'} ${row.name}${row.message ? ': ' + row.message.split('\n')[0] : ''}`);
assert.equal(results.filter(row => !row.passed).length, 0, `${results.length} shared bookshelf shell checks`);

}

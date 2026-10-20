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
const { readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const fontFamilies = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const { isReaderMainTabEnabled } = await import('../entry/src/main/ets/app/ReaderProductScope.ts');
const geometryApi = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const { readerFloatingTabBottomInset } = await import('./lib/reader-floating-bar-metrics-probe.mjs');
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
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop\s+(?:@Watch\([^)]*\)\s+)?(\w+)\s*:/g)].map(m => m[1])));
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
  const names = ['build', 'mangaOwnsWindowEdges', 'detailPendingNoticeVisible'];
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
    const body = childOf(owner, expected);
    assert.equal(body.length, 1);
    assert.equal(shell.params.populated, state === 'populated');
    assert.equal(shell.params.canCheckUpdates, state === 'populated');
    if (state === 'populated') {
      const initialClearance=body[0].params.headerClearance;
      shell.params.onHeaderHeightChange(92); owner.replayOnly([body[0].id]);
      assert.equal(body[0].params.headerClearance-initialClearance,92-60,'actual Index callback forwards only the measured header delta');
      assert.equal(childOf(owner, expected)[0], body[0], 'header measurement keeps the existing shelf actor');
      shell.params.onNoticeHeightChange(76); owner.replayOnly([body[0].id]);
      assert.equal(owner.shelfPendingNoticeHeight,76,'actual Shell callback delivers the measured card height into Index');
      const firstNoticeInset=body[0].params.noticeTopInset;
      shell.params.onNoticeHeightChange(103);owner.replayOnly([body[0].id]);
      assert.equal(body[0].params.noticeTopInset-firstNoticeInset,103-76,'actual notice height delta reaches retained avoidance');
      shell.params.onNoticeHeightChange(0); owner.replayOnly([body[0].id]);
      assert.equal(body[0].params.noticeTopInset,0,'hidden notice releases avoidance through the same actual callback');
      assert.equal(childOf(owner,expected)[0],body[0],'notice measurement does not replace the shelf actor');
    }
    if (state === 'failure' || state === 'loading') {
      assert.equal(body[0].params.failed, state === 'failure');
      body[0].params.onRetry(); assert.deepEqual(owner.calls, ['refreshBookshelf']); owner.calls = [];
    }
    for (const action of ['onSearchRequested', 'onImportRequested', 'onBookshelfSettingsRequested', 'onBatchManageRequested', 'onCheckUpdatesRequested']) shell.params[action]();
    for (const key of ['discover', 'rss', 'settings', 'bookshelf']) shell.params.onMainTab(key);
    assert.deepEqual(owner.calls, ['openSearch', 'openImportDialog', 'openBookshelfSettings', 'openBookshelfMultiSelect',
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
const mainBarSource = read('features/shell/MainTabBar.ets');
const tabConfiguration = mainBarSource.match(/const ALL_MAIN_TABS:[\s\S]*?;\s*export const MAIN_TABS:[\s\S]*?;/)[0];
const MAIN_TABS = new Function('isReaderMainTabEnabled', stripTypeScriptTypes(tabConfiguration).replace(/\bexport /g, '') + '; return MAIN_TABS;')(isReaderMainTabEnabled);
dependencies.MainTabBar = createReaderBuilderProbe(mainBarSource, boundedMembers(mainBarSource), {
  ...actualIcons.dependencies, ...readerFoundationTokens, ...readerTypographyRoles, ...fontFamilies,
  ...metricsApi, ...geometryApi, MAIN_TABS, readerFloatingTabBottomInset, registerReaderShelfFonts() {},
  ReaderWindowCoordinator: { metrics: shellMetrics },
}, actualIcons.hooks).Component;
const actualMain = createReaderBuilderProbe(actualMainSource, boundedMembers(actualMainSource), {
  ...dependencies, ...actualIcons.dependencies, ...metricsApi, ReaderWindowCoordinator: { metrics: shellMetrics },
}, { ...actualIcons.hooks, childSources: { ...actualIcons.hooks.childSources, AppTopBar: actualHeaderSource } });
dependencies.MainTabShell = class extends actualMain.Component {
  constructor(owner, params, storage, id, ...rest) { super(owner, params, storage, id, ...rest); this.params = { ...params }; }
  updateStateVars(params) { super.updateStateVars(params); Object.assign(this.params, params); }
};
const iconHit = actor => actualIcons.nodes(actor).find(node => node.type === 'Stack' && node.onClick);
function shellFixture({ populated = false, width = 365, menu = false } = {}) {
  shellWidth = width;
  const { owner } = createReaderBuilderProbe(shellSource, ['onNoticeHeightChange','noticeHeight','lastReadFeedback','onReadRecoveryChanged','onRecoveryChanged','content','mounted','temporaryBackIdentity','temporaryBackGeneration','navigationGeneration','onNavigationGenerationChanged','registerTemporaryBackGeneration','moreSelectionId','onTemporaryBackBridge','aboutToAppear','aboutToDisappear','consumeTemporaryBack','dismissMoreMenu','moreOpenAction','moreIntentAction','build','shellHeader','shellOverlay','onHeaderHeightChange','headerHeight','recoveryNoticeContent','topBar','requestMainTab','requestCheckUpdates','showBottomNav','numericAreaLength'], {
    ...dependencies, ...actualIcons.dependencies, ...metricsApi, bookshelfTemporaryGeneration:0,registerReaderShelfFonts(){}, BOOKSHELF_WIDE_BREAKPOINT: 600, READER_FLOATING_TOP_BAR_HEIGHT: 58,
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
  const header = childOf(owner, 'AppTopBar')[0];
  assert.equal(contentCalls, 1); assert.equal(header.title, '书架'); assert.equal(header.divider, false);
  assert.deepEqual([header.floating, header.centered, header.showLeadingSearch], [true, true, true]);
  return { owner, nav, header, noticeHeights };
}
check('one shell keeps title/actions/nav actors through day-night and populated changes', () => {
  const { owner, nav, header, noticeHeights } = shellFixture();
  assert.equal(noticeHeights.at(-1),0,'actual recovery Watch/appear clears the unshown notice via its initialized callback');
  const buttons = childOf(owner, 'ReaderIconButton');
  assert.equal(buttons.length, 1, 'More is the shared icon actor; Search is the actual AppTopBar leading native Stack');
  const before = [...owner.children.values()];
  for (const scheme of ['night','day','night']) {
    // StorageLink delivery is a platform seam in this SDK carrier. Deliver
    // the same global scheme to the retained Header and Shell owners.
    owner.appThemeScheme = scheme; header.appThemeScheme = scheme;
    owner.populated = !owner.populated; owner.replay(); header.replay(); actualIcons.properties.flush();
    assert.deepEqual([...owner.children.values()], before);
    assert.equal(childOf(owner, 'AppTopBar')[0], header); assert.equal(childOf(owner, 'MainTabShell')[0], nav);
    assert.equal(buttons[0].icon, `app.media.rc_dots${scheme === 'night' ? '_theme_night' : ''}`);
    assert.equal(nodesOf(header, 'Image').find(node => String(node.create).includes('bookshelf_search')).create,
      `app.media.bookshelf_search${scheme === 'night' ? '_theme_night' : ''}`);
  }
  const search = nodesOf(header, 'Stack').find(node => node.width === 44 && node.height === 44 && node.onClick);
  assert.ok(search, 'Search dispatch belongs to the actual floating Header');
  search.onClick(); assert.deepEqual(owner.calls, ['onSearchRequested']);
  assert.equal(owner.moreMenuVisible, false); iconHit(buttons[0]).onClick(); assert.equal(owner.moreMenuVisible, true);
  const navActor = actors(nav).find(actor => actor instanceof dependencies.MainTabBar);
  const settingsTab = nodesOf(navActor, 'Column').find(node => node.accessibilityText === '设置' && node.onClick);
  assert.ok(settingsTab, 'actual shared navigation native button is mounted'); settingsTab.onClick();
  assert.deepEqual(owner.calls, ['onSearchRequested','onMainTab:settings']);
  assert.ok(nodesOf(owner, 'Stack').some(node => node.height === '100%' && node.width === '100%'), 'content retains its full viewport under the floating header');
  assert.ok(nodesOf(owner, 'Column').some(node => node.zIndex === 10 && node.margin?.top === 8 && node.hitTestBehavior === 'HitTestMode.Transparent'),
    'the public header host retains the 8vp top gap and transparent empty area');
  assert.ok(nodesOf(header, 'Row').some(node => node.height === 52), 'the approved 52vp floating capsule plus 8vp gap retains the 60vp header geometry');
  const measuredHeader = actors(nav).find(actor => typeof actor.onHeightChange === 'function');
  assert.ok(measuredHeader, 'actual public fixed header actor owns the measurement');
  measuredHeader.onHeightChange(52); assert.equal(owner.reportedHeaderHeight, 60, 'public shell adds the top gap once');
});
check('shell navigation keeps phone fallback and existing populated tablet rail threshold', () => {
  for (const populated of [false, true]) for (const width of [365,599,600,800]) {
    const { nav } = shellFixture({populated,width});
    assert.equal(nav.params.showBottomNav, !populated || width < 600);
  }
  const { owner, nav } = shellFixture({populated:true});
  [...owner.nodes.values()].find(node => node.type === '__Common__' && node.onAreaChange).onAreaChange({}, { width: '800vp', globalPosition: { x: 0, y: 39 } });
  owner.replay(); assert.equal(nav.params.showBottomNav, false);
  owner.populated = false; owner.replay(); assert.equal(nav.params.showBottomNav, true);
});
check('More retains measured global-to-local anchor, live progress and guarded callbacks', () => {
  const { owner } = shellFixture({populated:true,menu:true});
  const more = childOf(owner, 'BookshelfMoreMenu')[0];
  const area = [...owner.nodes.values()].find(node => node.type === '__Common__' && node.onAreaChange);
  area.onAreaChange({}, {width:365,globalPosition:{x:10,y:39}});
  const moreActor = childOf(owner, 'ReaderIconButton').find(child => child.accessibilityLabel === '更多');
  assert.ok(moreActor, 'actual shared More child owns the accessible name');
  assert.equal(iconHit(moreActor).accessibilityText, '更多', 'name belongs to the actual native button Stack');
  // SDK emits __Common__ immediately before its custom child. Match the
  // measurement wrapper to this exact More actor, not to a duplicated name.
  const target = nodesOf(owner, '__Common__').find(node =>
    typeof node.onAreaChange === 'function' && owner.children.get(node.id + 1) === moreActor);
  assert.ok(target, 'actual SDK custom-child wrapper retains the original area callback');
  assert.equal(target.accessibilityText, undefined, 'measurement does not duplicate the shared button name');
  const header = childOf(owner, 'AppTopBar')[0];
  assert.notEqual(owner.children.get(target.id + 1), header, 'More measurement cannot bind the Search Header owner');
  assert.ok(nodesOf(header, 'Stack').some(node => node.width === 44 && node.onClick), 'Search remains a separate native header action');
  assert.match(owner.observers[target.id + 1].toString(), /new ReaderIconButton\(/, 'wrapper/child adjacency is the actual SDK emission');
  target.onAreaChange({}, {width:44,height:44,globalPosition:{x:311,y:47}});
  assert.deepEqual([owner.moreAnchorRight, owner.moreAnchorBottom], [355,91], 'numeric More anchor retains its original geometry');
  area.onAreaChange({}, {width:'365vp',globalPosition:{x:'10vp',y:'39vp'}});
  target.onAreaChange({}, {width:'44vp',height:'44vp',globalPosition:{x:'311vp',y:'47vp'}});
  assert.deepEqual([owner.viewportWidth, owner.overlayOriginX, owner.overlayOriginY, owner.moreAnchorRight, owner.moreAnchorBottom],
    [365,10,39,355,91], 'actual SDK More and overlay area callbacks preserve vp dimensions and coordinates');
  owner.updateRunning = true; owner.updateProgressDone = 4; owner.updateProgressTotal = 9; owner.reduceMotion = true;
  owner.replay();
  assert.deepEqual([more.params.anchorRight,more.params.anchorBottom], [345,52]);
  assert.deepEqual([more.params.updateRunning,more.params.updateProgressDone,more.params.updateProgressTotal,more.params.reduceMotion], [true,4,9,true]);
  more.params.onCheckUpdates(); assert.equal(owner.calls.length,0);
  owner.updateRunning = false; owner.backgroundUpdateRunning = true; more.params.onCheckUpdates(); assert.equal(owner.calls.length,0);
  owner.backgroundUpdateRunning = false; more.params.onCheckUpdates(); assert.deepEqual(owner.calls,['onCheckUpdatesRequested']);
  assert.equal(owner.moreMenuVisible,false);
  owner.canCheckUpdates = false; more.params.onCheckUpdates(); assert.equal(owner.calls.length,1);
  for (const [action,callback] of [['onBatchManage','onBatchManageRequested'],['onLocalImport','onImportRequested'],['onBookshelfSettings','onBookshelfSettingsRequested']]) {
    owner.moreOpenAction(owner.temporaryBackIdentity)(); owner.shellOverlay();
    childOf(owner,'BookshelfMoreMenu').at(-1).params[action](); assert.equal(owner.moreMenuVisible,false); assert.equal(owner.calls.at(-1),callback);
  }
  owner.moreOpenAction(owner.temporaryBackIdentity)(); owner.shellOverlay();
  childOf(owner,'BookshelfMoreMenu').at(-1).params.onDismiss(); assert.equal(owner.moreMenuVisible,false);
});
for (const failed of [false,true]) check(`status ${failed ? 'failure' : 'loading'} actual content preserves retry/spinner and live theme`, () => {
  const { owner } = createReaderBuilderProbe(read('features/bookshelf/BookshelfStatusContent.ets'), ['build'], {
    ...dependencies, READER_FLOATING_TOP_BAR_HEIGHT: 58,
  });
  let retries = 0; Object.assign(owner, { failed, reduceMotion:false, appThemeScheme:'day', onRetry:()=>retries++,
    minimumContentHeight: () => 400, bottomContentInset: () => 99 });
  owner.initialRender();
  if (failed) {
    assert.deepEqual(nodesOf(owner,'Text').map(node=>node.create), ['书架加载失败','无法读取书架内容，请重试。','重试']);
    const retry = nodesOf(owner,'Stack').find(node=>node.constraintSize?.minHeight===44 && node.onClick);
    assert.ok(retry, 'actual shared soft action owns the native hit'); retry.onClick(); assert.equal(retries,1);
  } else {
    assert.deepEqual(nodesOf(owner,'Text').map(node=>node.create), ['正在加载书架…']);
    const spinner=nodesOf(owner,'LoadingProgress')[0]; assert.deepEqual([spinner.width,spinner.height],[32,32]);
    assert.equal(childOf(owner,'SearchSpinner').length,0,'loading now uses the platform loader');
  }
  const before = nodesOf(owner,'Text').map(node=>node.fontColor);
  for (const actor of actors(owner)) actor.appThemeScheme='night';
  for (const actor of actors(owner)) actor.replay?.();
  assert.ok(nodesOf(owner,'Text').some((node,i)=>node.fontColor!==before[i]), 'mounted content recolors with theme');
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

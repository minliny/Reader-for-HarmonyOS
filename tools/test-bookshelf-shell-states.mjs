import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"index": {"description": "Index实际readiness/header与notice测量delta/当前业务Props", "resources": []}, "shell": {"description": "实际书架更多原生面板与有效回调", "resources": []}, "status": {"description": "实际status retry与native loading", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {admitBookshelfSdkCarrier,mountBookshelfSceneProbe} = await import('./lib/bookshelf-projection-owner-probe.mjs');
const {default: assert} = await import('node:assert/strict');
const { existsSync, readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { resolve } = await import('node:path');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { iconButtonControls } = await import('./lib/reader-icon-button-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const metricsApi = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const { isReaderProductSurfaceEnabled } = await import('../entry/src/main/ets/app/ReaderProductScope.ts');


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
  ['BookshelfShell', 'features/bookshelf/ui/BookshelfShell.ets', 'content'],
  ['MainTabShell', 'features/shell/MainTabShell.ets', 'content'],
  ['MainTabBar', 'features/shell/MainTabBar.ets'],
  ['AppTopBar', 'ui/chrome/AppTopBar.ets', 'trailing'],
  ['ReaderIconButton', 'ui/controls/ReaderIconButton.ets'],
  ['ReaderRecoveryNotice', 'ui/feedback/ReaderRecoveryNotice.ets'],
  ['BookshelfMoreActionSheet', 'features/bookshelf/ui/BookshelfMoreActionSheet.ets'],
  ['ReaderLibrarySearchSurface', 'features/search/ui/ReaderLibrarySearchSurface.ets', 'results'],
  ['SearchSpinner', 'features/search/ui/SearchSpinner.ets'],
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
  const names = ['arkWebCapturesInput', 'indexContent', 'pageSurfaces', 'mangaOwnsWindowEdges', 'bookshelfScenePorts', 'librarySearchSurface'];
  const { owner } = createReaderBuilderProbe(index, names, {
    ...dependencies, isReaderProductSurfaceEnabled, SafeAreaType: enumValues('SafeAreaType'), SafeAreaEdge: enumValues('SafeAreaEdge'),
    LayoutSafeAreaType: enumValues('LayoutSafeAreaType'), LayoutSafeAreaEdge: enumValues('LayoutSafeAreaEdge'),
  });
  admitBookshelfSdkCarrier(owner);
  owner.calls = [];
  Object.assign(owner.shelfRead.snapshot, { visualAdmitted: state === 'populated',
    coreEmpty: state === 'empty', books: [{ sourceId: source }] });
  owner.shelfRead.failed = state === 'failure';
  owner.shelfRead.refresh = () => owner.calls.push('refreshBookshelf');
  Object.assign(owner, {
    appThemeScheme: 'day', settingsPresentation: { snapshot: { reduceMotion: false } },
    shelfMotion: { retainsOpeningBackground: () => false }, shelfCatalog: { snapshot: {},
      manual: () => owner.calls.push('startManualBookshelfUpdate') },
    sourceSwitchPresentation: { visible: false }, mangaSourceSwitch: { selectionVisible: false },
    jsonImportPresentation: {}, rssJourney: { openRss: () => owner.calls.push('openRss') },
    readerOwnsWindowEdges: () => false, appContentTopInset: () => 39, messageSafeTop: () => 39,
    expandedLayout: () => false, librarySearchResults() {},
  });
  Object.assign(owner.shelfMutations, {
    recovery: () => ({ message: '', visible: false, canRetry: false, generation: 0 }),
    canContinueRemoval: () => false, openImport: () => owner.calls.push('openImport'),
  });
  owner.libraryJourney.openSearch = () => owner.calls.push('openSearch');
  owner.libraryJourney.openBookshelfMultiSelect = () => owner.calls.push('openBookshelfMultiSelect');
  owner.settingsNavigation = {
    openBookshelfSettings: () => owner.calls.push('openBookshelfSettings'),
    openSettings: () => owner.calls.push('openSettings'),
  };
  owner.downloadNavigation = { open: () => owner.calls.push('openDownloads') };
  owner.openDiscover = () => owner.calls.push('openDiscover');
  owner.indexContent();
  const scene = [...owner.children.values()].find(child => child instanceof dependencies.BookshelfScene);
  assert.ok(scene, 'Index mounts one real feature scene for the shelf');
  owner.shelfScene = mountBookshelfSceneProbe(scene.params, dependencies);
  return owner;
}
for (const state of ['loading', 'empty', 'populated', 'failure']) {
  check(`Index ${state} keeps one shared bookshelf shell`, () => {
    const owner = indexFixture(state);
    const shells = [...owner.shelfScene.children.values()].filter(child => child instanceof dependencies.BookshelfShell);
    assert.equal(shells.length, 1, 'every real Index bookshelf state must retain the same shell');
  });
}
const childOf = (owner, name) => [...owner.children.values(), ...(owner.shelfScene?.children.values() ?? [])]
  .filter(child => child instanceof dependencies[name]);
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
      const header=childOf(owner,'ReaderLibrarySearchSurface')[0].params;
      const initialBottom=body[0].params.headerBottom;
      header.onHeaderBottom(initialBottom+32,header.identity,0,header.navigationGeneration,header.mounting);
      owner.shelfScene.replayOnly([body[0].id]);
      assert.equal(body[0].params.headerBottom-initialBottom,32,'actual Library header callback forwards the measured delta');
      assert.equal(childOf(owner, expected)[0], body[0], 'header measurement keeps the existing shelf actor');
      shell.params.onNoticeHeightChange(76, shell.params.navigationGeneration); owner.shelfScene.replayOnly([body[0].id]);
      assert.equal(owner.shelfRead.noticeHeight,76,'actual Shell callback delivers the measured height to shelf presentation');
      const firstNoticeInset=body[0].params.noticeTopInset;
      shell.params.onNoticeHeightChange(103, shell.params.navigationGeneration);owner.shelfScene.replayOnly([body[0].id]);
      assert.equal(body[0].params.noticeTopInset-firstNoticeInset,103-76,'actual notice height delta reaches retained avoidance');
      shell.params.onNoticeHeightChange(0, shell.params.navigationGeneration); owner.shelfScene.replayOnly([body[0].id]);
      assert.equal(body[0].params.noticeTopInset,0,'hidden notice releases avoidance through the same actual callback');
      assert.equal(childOf(owner,expected)[0],body[0],'notice measurement does not replace the shelf actor');
    }
    if (state === 'failure' || state === 'loading') {
      assert.equal(body[0].params.failed, state === 'failure');
      body[0].params.onRetry(); assert.deepEqual(owner.calls, ['refreshBookshelf']); owner.calls = [];
    }
    const header=childOf(owner,'ReaderLibrarySearchSurface')[0].params;
    header.onOpen(header.identity,header.navigationGeneration,header.mounting);
    for (const action of ['onImportRequested', 'onBookshelfSettingsRequested', 'onBatchManageRequested', 'onCheckUpdatesRequested'])
      shell.params[action](shell.params.navigationGeneration);
    for (const key of ['discover', 'rss', 'settings', 'bookshelf']) shell.params.onMainTab(key,shell.params.navigationGeneration);
    assert.deepEqual(owner.calls, ['openSearch', 'openImport', 'openBookshelfSettings', 'openBookshelfMultiSelect',
      'startManualBookshelfUpdate', 'openDiscover', 'openRss', 'openSettings']);
  });
}
check('Index state changes update the retained shell child props, including server-filtered update availability', () => {
  const owner = indexFixture('loading');
  const shell = childOf(owner, 'BookshelfShell')[0];
  for (const state of ['empty','populated','failure','loading','populated']) {
    Object.assign(owner.shelfRead.snapshot, { visualAdmitted: state === 'populated', coreEmpty: state === 'empty' });
    owner.shelfRead.failed = state === 'failure';
    Object.assign(owner.shelfCatalog.snapshot, { done: 3, total: 7 });
    owner.settingsPresentation.snapshot.reduceMotion = true;
    const scene = childOf(owner, 'BookshelfScene')[0];
    owner.replayOnly([scene.id]);
    owner.shelfScene.reduceMotion = scene.params.reduceMotion;
    owner.shelfScene.replayOnly([shell.id]);
    assert.equal(childOf(owner, 'BookshelfShell')[0], shell, 'native child identity survives readiness changes');
    assert.equal(shell.params.populated, state === 'populated');
    assert.equal(shell.params.canCheckUpdates, state === 'populated');
    assert.deepEqual([shell.params.updateProgressDone, shell.params.updateProgressTotal, shell.params.reduceMotion], [3, 7, true]);
  }
  owner.shelfRead.snapshot.books = [{ sourceId: 'local' }]; owner.shelfScene.replayOnly([shell.id]); assert.equal(shell.params.canCheckUpdates, false);
  owner.shelfRead.snapshot.revision = 'core-filtered'; owner.shelfRead.snapshot.hasOnlineBooks = true;
  owner.shelfScene.replayOnly([shell.id]); assert.equal(shell.params.canCheckUpdates, true, 'hidden online books retain check-update eligibility');
  owner.shelfRead.snapshot.hasOnlineBooks = false; owner.shelfScene.replayOnly([shell.id]); assert.equal(shell.params.canCheckUpdates, false);
});
const actualMainSource = read('features/shell/MainTabShell.ets');
const actualHeaderSource = read('ui/chrome/AppTopBar.ets');
const actualIcons = iconButtonControls();
const shellMetrics = () => new metricsApi.ReaderWindowMetricsSnapshot(new metricsApi.ReaderRectVp(0, 0, 365, 844));
const {createTemporaryBackLeafFixtures} = await import('./lib/temporary-back-leaf-fixture.mjs');
const nativeShelf = selectedCase === 'shell' ? (await createTemporaryBackLeafFixtures()).shelfFixture : undefined;

check('one bookshelf shell retains its navigation/content carrier and current More through theme/readiness changes', () => {
  const f = nativeShelf();
  const navigation = [...f.o.children.values()].find(actor => actor instanceof f.p.deps.MainTabShell);
  const sheet = f.sheet().sheet;
  for (const scheme of ['night', 'day', 'night']) {
    f.o.appThemeScheme = scheme;
    f.o.populated = !f.o.populated;
    assert.equal(f.sheet().sheet, sheet);
    assert.ok([...f.o.children.values()].includes(navigation));
  }
  const settings = [];
  f.o.onMainTab = (key, generation) => settings.push([key, generation]);
  navigation.params.onMainTab('settings', f.o.navigationGeneration);
  assert.deepEqual(settings, [['settings', f.o.navigationGeneration]]);
});
check('More consumes native close and dispatches current batch, import, update and settings actions', () => {
  for (const [label, intent] of [['批量管理', 'batch'], ['本地导入', 'import'], ['检查更新', 'update'], ['下载管理', 'downloads'], ['书架设置', 'settings']]) {
    const f = nativeShelf(), {options, row} = f.sheet();
    const action = row(label).onClick;
    action(); action();
    assert.equal(f.o.moreMenuVisible, false);
    assert.deepEqual(f.calls, intent === 'import' ? [] : [intent]);
    assert.equal(f.events.at(-1).handler(), true, 'dismissal still owns Back before native disappearance');
    options.onDisappear(); options.onDisappear();
    assert.deepEqual(f.calls, [intent]);
    assert.equal(f.events.at(-1).handler(), false);
  }
});
// The retired shell header and measured popover coordinates had no live
// consumers. Search/More input is now the Library surface's own route actor.
for (const failed of [false,true]) check(`status ${failed ? 'failure' : 'loading'} actual content preserves retry/spinner and live theme`, () => {
  const { owner } = createReaderBuilderProbe(read('features/bookshelf/ui/BookshelfStatusContent.ets'), ['build'], {
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
    readerMainViewport: () => ({ width: 365, height: 844 }),
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

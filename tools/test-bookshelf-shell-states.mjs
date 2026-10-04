import {admitBookshelfSdkCarrier} from './lib/bookshelf-projection-owner-probe.mjs';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';

const root = resolve(import.meta.dirname, '..');
const read = file => readFileSync(resolve(root, 'entry/src/main/ets', file), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const builders = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const dependencies = {};
function register(name, source = '', slot) {
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
  ['AppTopBar', 'features/common/AppTopBar.ets', 'trailing'],
  ['ReaderIconButton', 'features/common/ReaderIconButton.ets'],
  ['ReaderRecoveryNotice', 'features/common/ReaderRecoveryNotice.ets'],
  ['BookshelfMoreMenu', 'features/bookshelf/BookshelfMoreMenu.ets'],
  ['SearchSpinner', 'features/search/SearchSpinner.ets'],
]) register(name, existsSync(resolve(root, 'entry/src/main/ets', file)) ? read(file) : '', slot);
const enumValues = name => new Proxy({}, { get: (_, key) => `${name}.${String(key)}` });
const results = [];
function check(name, action) {
  try { action(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, message: error.message }); }
}
function indexFixture(state, source = 'online', definition = index) {
  const names = ['build', 'readerOwnsWindowEdges', 'mangaOwnsWindowEdges'];
  if (index.includes('private bookshelfContent(')) names.push('bookshelfContent');
  if (index.includes('private bookshelfShellContent(')) names.push('bookshelfShellContent');
  const { owner } = createReaderBuilderProbe(definition, names, {
    ...dependencies, SafeAreaType: enumValues('SafeAreaType'), SafeAreaEdge: enumValues('SafeAreaEdge'),
  });
  Object.assign(owner, { route: 'bookshelf', isBookshelfVisualAdmitted: state === 'populated',
    isCoreShelfEmpty: state === 'empty', bookshelfLoadFailed: state === 'failure',
    appThemeScheme: 'day', settingsSnapshot: { reduceMotion: false }, shelfProjectionRevision: '',
    shelfBooks: [{ sourceId: source }], readingSessionActive: false, readingContentKind: 'novel',
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
// Replay only the real outer Stack observer. The mounted bookshelf actors
// remain the original branch; this checks the root's actual safe-area request,
// not a synthetic ReaderShell branch or native layout.
function assertIndexWindowEdges(owner) {
  const root = owner.nodes.get(0);
  assert.equal(root.type, 'Stack');
  const app = { pad:39, expands:[['SafeAreaType.SYSTEM'],['SafeAreaEdge.BOTTOM']], ignores:[[],[]] };
  const novel = { pad:0, expands:[['SafeAreaType.SYSTEM'],['SafeAreaEdge.TOP','SafeAreaEdge.BOTTOM']], ignores:[[],[]] };
  const manga = { pad:0, expands:[['SafeAreaType.SYSTEM','SafeAreaType.CUTOUT'],
    ['SafeAreaEdge.TOP','SafeAreaEdge.BOTTOM','SafeAreaEdge.START','SafeAreaEdge.END']],
    ignores:[['LayoutSafeAreaType.SYSTEM'],['LayoutSafeAreaEdge.ALL']] };
  for (const [route, active, kind, target, expected, mangaOwns] of [
    ['bookshelf',false,'novel','',app,false],
    ['reading',true,'novel','',novel,false],
    ['reading',true,'manga','',manga,true],
    ['directory',true,'manga','readerControl',manga,true],
    ['reading',false,'manga','',app,false],
    ['bookshelf',true,'manga','',app,false],
  ]) {
    Object.assign(owner,{route,readingSessionActive:active,readingContentKind:kind,directoryReturnTarget:target});
    owner.replayOnly([root.id]);
    assert.equal(owner.mangaOwnsWindowEdges(),mangaOwns, `${route}/${kind}/${active}: production manga predicate`);
    assert.deepEqual(root.padding,{top:expected.pad});
    assert.deepEqual(root.expandSafeArea,expected.expands);
    assert.deepEqual(root.ignoreLayoutSafeArea,expected.ignores);
  }
}
check('Index real root safe-area observer preserves app/novel edges and manga-only full-window ownership', () => {
  assertIndexWindowEdges(indexFixture('loading'));
  const oldKind = "this.readingContentKind === 'manga' && this.readerOwnsWindowEdges()";
  assert.equal(index.split(oldKind).length,2,'one actual production manga-edge predicate');
  assert.throws(() => assertIndexWindowEdges(indexFixture('loading','online',
    index.replace(oldKind,"this.readingContentKind === 'novel' && this.readerOwnsWindowEdges()"))),
    /production manga predicate/, 'real source wrong-kind mutation cannot satisfy the root boundary');
});
const childOf = (owner, name) => [...owner.children.values()].filter(child => child instanceof dependencies[name]);
const nodesOf = (owner, type) => [...owner.nodes.values()].filter(node => node.type === type);
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
const iconHit = actor => actualIcons.nodes(actor).find(node => node.type === 'Stack' && node.onClick);
function shellFixture({ populated = false, width = 365, menu = false } = {}) {
  const { owner } = createReaderBuilderProbe(shellSource, ['content','mounted','temporaryBackIdentity','temporaryBackGeneration','navigationGeneration','onNavigationGenerationChanged','registerTemporaryBackGeneration','moreSelectionId','onTemporaryBackBridge','aboutToAppear','aboutToDisappear','consumeTemporaryBack','dismissMoreMenu','moreOpenAction','moreIntentAction','build','shellContent','recoveryNoticeContent','topBar','requestCheckUpdates','showBottomNav','numericAreaLength'], {
    ...dependencies, ...actualIcons.dependencies, bookshelfTemporaryGeneration:0,registerReaderShelfFonts(){}, BOOKSHELF_WIDE_BREAKPOINT: 600, READER_FLOATING_TOP_BAR_HEIGHT: 58,
    ReaderWindowCoordinator: { metrics: () => ({ windowRect: { width } }) },
  }, actualIcons.hooks);
  let contentCalls = 0;
  Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 0, populated, viewportWidth: 0,
    recovery: {message:'',visible:false,canRetry:false,generation:0},
    moreMenuVisible: false, moreAnchorRight: 0, moreAnchorBottom: 0, overlayOriginX: 0, overlayOriginY: 0,
    canCheckUpdates: populated, updateRunning: false, backgroundUpdateRunning: false, updateProgressDone: 0, updateProgressTotal: 0,
    reduceMotion: false, content: () => { contentCalls++; }, calls: [] });
  for (const action of ['onSearchRequested','onImportRequested','onBatchManageRequested','onBookshelfSettingsRequested','onCheckUpdatesRequested','onMainTab']) {
    owner[action] = (key) => owner.calls.push(key ? `${action}:${key}` : action);
  }
  owner.aboutToAppear();
  if(menu)owner.moreOpenAction(owner.temporaryBackIdentity)();
  owner.initialRender();
  const nav = childOf(owner, 'MainTabShell')[0]; nav.params.content();
  const header = childOf(owner, 'AppTopBar')[0]; header.params.trailing();
  assert.equal(contentCalls, 1); assert.equal(header.params.title, '书架'); assert.equal(header.params.divider ?? false, false);
  return { owner, nav, header };
}
check('one shell keeps title/actions/nav actors through day-night and populated changes', () => {
  const { owner, nav, header } = shellFixture();
  const buttons = childOf(owner, 'ReaderIconButton');
  assert.equal(buttons.length, 2);
  const before = [...owner.children.values()];
  for (const scheme of ['night','day','night']) {
    owner.appThemeScheme = scheme; owner.populated = !owner.populated; owner.replay(); actualIcons.properties.flush();
    assert.deepEqual([...owner.children.values()], before);
    assert.equal(childOf(owner, 'AppTopBar')[0], header); assert.equal(childOf(owner, 'MainTabShell')[0], nav);
    assert.deepEqual(buttons.map(button => button.icon), ['search','more'].map(asset => `app.media.bookshelf_${asset}${scheme === 'night' ? '_theme_night' : ''}`));
  }
  iconHit(buttons[0]).onClick(); assert.deepEqual(owner.calls, ['onSearchRequested']);
  assert.equal(owner.moreMenuVisible, false); iconHit(buttons[1]).onClick(); assert.equal(owner.moreMenuVisible, true);
  nav.params.onMainTab('settings'); assert.deepEqual(owner.calls, ['onSearchRequested','onMainTab:settings']);
  assert.ok(nodesOf(owner, 'Stack').some(node => node.height === '100%' && node.width === '100%'), 'content retains its full viewport under the floating header');
  assert.ok(nodesOf(owner, 'Row').some(node => node.height === 58 && node.hitTestBehavior === 'HitTestMode.Transparent'),
    'the floating header does not turn its empty area into a scroll shield');
});
check('shell navigation keeps phone fallback and existing populated tablet rail threshold', () => {
  for (const populated of [false, true]) for (const width of [365,599,600,800]) {
    const { nav } = shellFixture({populated,width});
    assert.equal(nav.params.showBottomNav, !populated || width < 600);
  }
  const { owner, nav } = shellFixture({populated:true});
  nodesOf(owner, 'Stack').find(node => node.onAreaChange).onAreaChange({}, { width: '800vp', globalPosition: { x: 0, y: 39 } });
  owner.replay(); assert.equal(nav.params.showBottomNav, false);
  owner.populated = false; owner.replay(); assert.equal(nav.params.showBottomNav, true);
});
check('More retains measured global-to-local anchor, live progress and guarded callbacks', () => {
  const { owner } = shellFixture({populated:true,menu:true});
  const more = childOf(owner, 'BookshelfMoreMenu')[0];
  const area = nodesOf(owner, 'Stack').find(node => node.onAreaChange);
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
  assert.notEqual(owner.children.get(target.id + 1), childOf(owner, 'ReaderIconButton').find(child => child.accessibilityLabel === '搜索'), 'More measurement cannot bind the Search actor');
  assert.match(owner.observers[target.id + 1].toString(), /new ReaderIconButton\(/, 'wrapper/child adjacency is the actual SDK emission');
  target.onAreaChange({}, {width:44,height:44,globalPosition:{x:311,y:47}});
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
    owner.moreOpenAction(owner.temporaryBackIdentity)(); owner.shellContent();
    childOf(owner,'BookshelfMoreMenu').at(-1).params[action](); assert.equal(owner.moreMenuVisible,false); assert.equal(owner.calls.at(-1),callback);
  }
  owner.moreOpenAction(owner.temporaryBackIdentity)(); owner.shellContent();
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
    nodesOf(owner,'Text').find(node=>node.create==='重试').onClick(); assert.equal(retries,1);
  } else {
    assert.deepEqual(nodesOf(owner,'Text').map(node=>node.create), ['正在加载书架…']);
    const spinner=childOf(owner,'SearchSpinner')[0]; assert.equal(spinner.params.active,true);
    owner.reduceMotion=true; owner.replay(); assert.equal(spinner.params.reduceMotion,true);
  }
  const before = nodesOf(owner,'Text').map(node=>node.fontColor);
  owner.appThemeScheme='night'; owner.replay();
  assert.ok(nodesOf(owner,'Text').some((node,i)=>node.fontColor!==before[i]), 'mounted content recolors with theme');
});
// This executes SDK-emitted observers, not Harmony native layout/removal or dependency scheduling.
// Each readiness slot is checked independently; persistence is asserted on the actual parent child-update path.
for (const row of results) console.log(`${row.passed ? 'PASS' : 'FAIL'} ${row.name}${row.message ? ': ' + row.message.split('\n')[0] : ''}`);
assert.equal(results.filter(row => !row.passed).length, 0, `${results.length} shared bookshelf shell checks`);

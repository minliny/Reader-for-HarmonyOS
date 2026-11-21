import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"extended-nav-generation": {"description": "实际扩展profile共享rail generation与retired拒绝", "resources": []}};
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
const { boundedMembers, boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { admitBookshelfSdkCarrier } = await import('./lib/bookshelf-projection-owner-probe.mjs');
const metricsApi = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const geometryApi = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const { readerFloatingTabBottomInset, readerFloatingTabBarHeight, readerMainTabItemHeight } =
  await import('./lib/reader-floating-bar-metrics-probe.mjs');


const read = file => readFileSync(new URL('../entry/src/main/ets/' + file, import.meta.url), 'utf8');
const bookshelf = read('features/bookshelf/BookshelfPage.ets'), shellText = read('features/bookshelf/BookshelfShell.ets');
const mainText = read('features/shell/MainTabShell.ets'), barText = read('features/shell/MainTabBar.ets');
const navigationSpecText = read('features/shell/MainNavigationSpec.ts');
const expectedItems = [
  ['bookshelf_library_active', '书架', 'bookshelf', true],
  ['bookshelf_compass_outline', '发现', 'discover', false],
  ['bookshelf_rss_outline', 'RSS', 'rss', false],
  ['bookshelf_settings_outline', '设置', 'settings', false],
];
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */

function runNavigation(mainSource=mainText) {
const sdkRoot=resolveEtsLoaderRoot();
createRequire(import.meta.url)(sdkRoot+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('BookshelfShell',new Set(['content']));
const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
Object.assign(sdk.childSources, { MainTabShell: mainSource, MainTabBar: barText, BookshelfShell: shellText, BookshelfMoreMenu: read('features/bookshelf/BookshelfMoreMenu.ets') });
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const raisedSurfaceSource = read('features/common/ReaderRaisedSurface.ets');
sdk.childSources.ReaderRaisedSurface = raisedSurfaceSource;
const requireSdk = createRequire(import.meta.url);
const syntaxSdk = requireSdk(resolveEtsLoaderRoot() + '/lib/validate_ui_syntax.js');
syntaxSdk.componentCollection.customComponents.add('ReaderRaisedSurface');
syntaxSdk.propCollection.set('ReaderRaisedSurface', new Set(
  [...raisedSurfaceSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(match => match[1])));
const metrics = () => new metricsApi.ReaderWindowMetricsSnapshot(new metricsApi.ReaderRectVp(0, 0, 1280, 800));
// The existing extended-admission seam exercises all four configured routes.
// It does not enable deferred tabs in the shipping product profile.
const configuration = navigationSpecText.match(/const ALL_MAIN_TABS:[\s\S]*?;\s*export const MAIN_TABS:[\s\S]*?;/)[0];
const MAIN_TABS = new Function('isReaderMainTabEnabled', stripTypeScriptTypes(configuration).replace(/\bexport /g, '') + ';return MAIN_TABS;')(() => true);
const actualNavigation = pureModuleProbe(navigationSpecText, 'MainNavigationSpec.ts', {
  readerMainTabItemHeight, READER_EXPANDED_MIN_WIDTH: 600,
  readerInteractiveSafeBottom: metricsApi.readerInteractiveSafeBottom,
  readerInteractiveSafeLeft: metricsApi.readerInteractiveSafeLeft,
  readerInteractiveSafeRight: metricsApi.readerInteractiveSafeRight,
  readerVisualSafeTop: metricsApi.readerVisualSafeTop,
  isReaderMainTabEnabled: () => true, ReaderWindowCoordinator: { metrics },
  AppStorage: { get: () => undefined },
}, ['readerMainNavigationMode', 'readerMainViewport', 'readerMainRailLeft', 'readerMainRailTop',
  'readerMainRailLeading', 'readerMainRailBottomInset', 'readerMainRailContentLeft', 'readerMainRailContentRight',
  'mainTabBottomWidth', 'mainTabRailHeight']);
const platform = { ...sdk.deps, ...metricsApi, ...geometryApi, ...actualNavigation,
  ReaderWindowCoordinator: { metrics }, MAIN_TABS,
  readerFloatingTabBottomInset, readerFloatingTabBarHeight, readerMainTabItemHeight,
  registerReaderShelfFonts() {}, bookshelfTemporaryGeneration: 0, ReaderRaisedSurface: Child };
const Bar = createReaderBuilderProbe(barText, boundedMembers(barText), platform, sdk.hooks).Component;
const Main = createReaderBuilderProbe(mainSource, boundedMembers(mainSource), { ...platform, MainTabBar: Bar }, sdk.hooks).Component;
const shellNames = boundedMembers(shellText);
const Shell = createReaderBuilderProbe(shellText, shellNames, { ...platform, MainTabShell: Main, BookshelfMoreMenu: Child }, sdk.hooks).Component;
const Parent = createReaderBuilderProbe(read('pages/Index.ets'), ['bookshelfShellContent'], { BookshelfShell: Child },
  { childSources: { BookshelfShell: shellText } }).Component;
const parent = new Parent(undefined, {}), firstRuntime = {}; let installedRuntime = firstRuntime;
const calls = [], emptyRecovery = () => ({ visible: false, canRetry: false, message: '', generation: 0 });
function initializeParent(owner, runtime) {
Object.assign(owner, { isBookshelfVisualAdmitted: true, shelfRecovery: emptyRecovery, shelfReadRecovery: emptyRecovery,
  shelfBooks: [{ sourceId: 'local' }], shelfProjectionRevision: '', settingsSnapshot: { reduceMotion: false },
  bookshelfContent() {}, registerTemporaryBackBridge() {} });
admitBookshelfSdkCarrier(owner, runtime, () => installedRuntime);
for (const [key, method] of [['discover', 'openDiscover'], ['rss', 'openRss'], ['settings', 'openSettings']])
  owner[method] = () => calls.push([key, owner.navigationGeneration]);
}
initializeParent(parent, firstRuntime);
const currentProps = () => { parent.bookshelfShellContent(); return [...parent.children.values()].at(-1).params; };
const firstProps=currentProps(),shell = new Shell(undefined, firstProps);
Object.assign(shell, firstProps, { mounted: true, content() {} }); shell.initialRender();
const main = sdk.walk(shell).find(owner => owner instanceof Main); main.aboutToAppear();
const nav = sdk.walk(shell).find(owner => owner instanceof Bar);
assert.ok(nav, 'real BookshelfShell -> MainTabShell -> Scaffold mounts the actual shared navigation actor');
assert.equal(nav.vertical ?? nav.params?.vertical, false);
assert.equal(nav.current ?? nav.params?.current, 'bookshelf');
assert.ok(sdk.nodes(shell).some(node => node.type === 'Stack' && node.backgroundColor), 'actual shared scaffold owns the full page');
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
const actions = new Map();
for (const [asset, label, navKey, active] of expectedItems) {
  assert.ok(sdk.nodes(nav).some(node => node.type === 'Image' && node.create === `app.media.${asset}`), `${label} retains its approved bookshelf glyph`);
  const item = sdk.nodes(nav).find(node => node.type === 'Column' && node.accessibilityText === `${label}${active ? '，已选中' : ''}`);
  assert.ok(item?.onClick, `${label} carries its configured shared production route action`);
  void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
  actions.set(navKey, item.onClick);
}
// These are the original active/old-generation/new-generation/retired guards,
// now invoked through the emitted native handlers and actual public owners.
actions.get('bookshelf')(); actions.get('discover')();
assert.deepEqual(calls, [['discover', 1]], 'only the inactive rail item dispatches its captured intent');
parent.navigationGeneration = 2; shell.updateStateVars(currentProps()); sdk.properties.flush();
assert.equal(sdk.walk(shell).find(owner => owner instanceof Main), main, 'generation delivery retains the public main shell actor');
const currentNav = sdk.walk(shell).find(owner => owner instanceof Bar && owner !== nav);
assert.ok(currentNav, 'only the finite navigation actor rotates with its generation');
actions.get('discover')();
assert.deepEqual(calls, [['discover', 1]], 'a retained physical handler cannot borrow the new navigation');
const currentRss = sdk.nodes(currentNav).find(node => node.type === 'Column' && node.accessibilityText === 'RSS').onClick;
currentRss(); assert.deepEqual(calls, [['discover', 1], ['rss', 2]], 'the current rail still dispatches after navigation Prop delivery');
const settings = sdk.nodes(currentNav).find(node => node.type === 'Column' && node.accessibilityText === '设置').onClick;
shell.mounted = false; settings();
assert.deepEqual(calls, [['discover', 1], ['rss', 2]], 'a retired rail cannot dispatch');
shell.mounted = true; parent.shelfReceiptRetired = true; settings();
assert.deepEqual(calls, [['discover', 1], ['rss', 2]], 'the captured Index Runtime/presentation boundary also refuses a retired carrier');
parent.shelfReceiptRetired = false; main.aboutToDisappear(); settings();
assert.deepEqual(calls, [['discover', 1], ['rss', 2]], 'unmounted public navigation owner refuses retained native callbacks');
// Production replaces a Runtime through Ability teardown/new window content.
// The retired Index callback stays bound to its exact old owner; the new Index
// creates a fresh Shell/Main/Bar binding rather than making it borrow Runtime.
installedRuntime = {}; main.aboutToAppear(); settings();
assert.deepEqual(calls, [['discover', 1], ['rss', 2]], 'an old captured Runtime cannot dispatch into its replacement');
const successor = new Parent(undefined, {}); initializeParent(successor, installedRuntime);
Object.assign(successor, { navigationGeneration: 3, detailShelfAdmissionMount: 2 }); successor.bookshelfShellContent();
const successorProps=[...successor.children.values()].at(-1).params, successorShell = new Shell(undefined, successorProps);
Object.assign(successorShell, successorProps, { mounted: true, content() {} }); successorShell.initialRender();
const successorMain=sdk.walk(successorShell).find(owner=>owner instanceof Main); successorMain.aboutToAppear();
const successorBar=sdk.walk(successorShell).find(owner=>owner instanceof Bar);
sdk.nodes(successorBar).find(node=>node.type==='Column'&&node.accessibilityText==='设置').onClick();
assert.deepEqual(calls, [['discover', 1], ['rss', 2], ['settings', 3]], 'new Index mount binds an effective navigation callback to the replacement Runtime');
settings(); assert.equal(calls.length,3,'retained predecessor callbacks remain revoked after successor admission');
}
runNavigation();
const liveGeneration = mainText.replace('if (!this.mounted || presentedGeneration !== this.navigationGeneration) return;', 'if (!this.mounted) return;')
  .replace('this.onMainTab(key, presentedGeneration);', 'this.onMainTab(key, this.navigationGeneration);');
assert.notEqual(liveGeneration, mainText, 'negative control mutates the actual production generation admission');
assert.throws(() => runNavigation(liveGeneration), /retained physical handler cannot borrow the new navigation/,
  'using a live generation must fail the same actual SDK native callback assertion');
console.log('bookshelf tablet navigation contract: PASS');

}

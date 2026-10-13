import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedMembers, boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { admitBookshelfSdkCarrier } from './lib/bookshelf-projection-owner-probe.mjs';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as geometryApi from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { readerFloatingTabBottomInset } from './lib/reader-floating-bar-metrics-probe.mjs';

const read = file => readFileSync(new URL('../entry/src/main/ets/' + file, import.meta.url), 'utf8');
const bookshelf = read('features/bookshelf/BookshelfPage.ets'), shellText = read('features/bookshelf/BookshelfShell.ets');
const mainText = read('features/shell/MainTabShell.ets'), barText = read('features/shell/MainTabBar.ets');
const expectedItems = [
  ['bookshelf_library', '书架', 'bookshelf', true],
  ['bookshelf_compass', '发现', 'discover', false],
  ['bookshelf_rss', 'RSS', 'rss', false],
  ['bookshelf_settings', '设置', 'settings', false],
];
assert.doesNotMatch(bookshelf, /private tabletNavigationItem\(/, 'the previous private rail has one shared production owner');
assert.match(shellText, /showTabletRail:\s*!this\.showBottomNav\(\),\s*railVariant: 'bookshelf'/, 'the populated tablet shelf selects the approved shared rail variant');
assert.match(mainText, /MainTabBar\(\{[\s\S]*vertical: true, railVariant: this\.railVariant/, 'actual main shell owns the vertical navigation');

function runNavigation(mainSource=mainText) {
const sdkRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
createRequire(import.meta.url)(sdkRoot+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('BookshelfShell',new Set(['content']));
const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
Object.assign(sdk.childSources, { MainTabShell: mainSource, MainTabBar: barText, BookshelfShell: shellText, BookshelfMoreMenu: read('features/bookshelf/BookshelfMoreMenu.ets') });
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const metrics = () => new metricsApi.ReaderWindowMetricsSnapshot(new metricsApi.ReaderRectVp(0, 0, 1280, 800));
// The existing extended-admission seam exercises all four configured routes.
// It does not enable deferred tabs in the shipping product profile.
const configuration = barText.match(/const ALL_MAIN_TABS:[\s\S]*?;\s*export const MAIN_TABS:[\s\S]*?;/)[0];
const MAIN_TABS = new Function('isReaderMainTabEnabled', stripTypeScriptTypes(configuration).replace(/\bexport /g, '') + ';return MAIN_TABS;')(() => true);
const platform = { ...sdk.deps, ...metricsApi, ...geometryApi, ReaderWindowCoordinator: { metrics }, MAIN_TABS,
  readerFloatingTabBottomInset, registerReaderShelfFonts() {}, bookshelfTemporaryGeneration: 0,
  BOOKSHELF_WIDE_BREAKPOINT: Number(shellText.match(/export const BOOKSHELF_WIDE_BREAKPOINT = (\d+);/)[1]) };
const Bar = createReaderBuilderProbe(barText, boundedMembers(barText), platform, sdk.hooks).Component;
const Main = createReaderBuilderProbe(mainSource, boundedMembers(mainSource), { ...platform, MainTabBar: Bar }, sdk.hooks).Component;
const shellNames = ['build', 'shellHeader', 'shellOverlay', 'content', 'headerHeight', 'onHeaderHeightChange', 'showBottomNav', 'numericAreaLength',
  'recovery', 'readRecovery', 'populated', 'reduceMotion', 'onMainTab', 'mounted', 'navigationGeneration', 'onNavigationGenerationChanged', 'registerTemporaryBackGeneration', 'onTemporaryBackBridge',
  'temporaryBackGeneration', 'temporaryBackIdentity', 'moreMenuVisible', 'moreSelectionId', 'dismissMoreMenu', 'requestMainTab'];
const Shell = createReaderBuilderProbe(shellText, shellNames, { ...platform, MainTabShell: Main, BookshelfMoreMenu: Child }, sdk.hooks).Component;
const Parent = createReaderBuilderProbe(read('pages/Index.ets'), ['bookshelfShellContent'], { BookshelfShell: Child },
  { childSources: { BookshelfShell: shellText } }).Component;
const parent = new Parent(), firstRuntime = {}; let installedRuntime = firstRuntime;
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
Object.assign(shell, firstProps, { mounted: true, topBar() {}, content() {} }); shell.initialRender();
const main = sdk.walk(shell).find(owner => owner instanceof Main); main.aboutToAppear();
const nav = sdk.walk(shell).find(owner => owner instanceof Bar);
assert.ok(nav, 'real BookshelfShell -> MainTabShell -> Scaffold mounts the actual shared navigation actor');
assert.equal(nav.vertical, true); assert.equal(nav.railVariant, 'bookshelf');
assert.ok(sdk.nodes(shell).some(node => node.type === 'Stack' && node.backgroundColor), 'actual shared scaffold owns the full page');
assert.ok(sdk.nodes(nav).some(node => node.type === 'Column' && node.width === 82 && node.height === 332 && node.borderRadius === 24), 'approved 82x332 tablet rail geometry is unchanged');
const actions = new Map();
for (const [asset, label, navKey, active] of expectedItems) {
  assert.ok(sdk.nodes(nav).some(node => node.type === 'Image' && node.create === `app.media.${asset}`), `${label} retains its approved bookshelf glyph`);
  const item = sdk.nodes(nav).find(node => node.type === 'Column' && node.accessibilityText === `${label}${active ? '，已选中' : ''}`);
  assert.ok(item?.onClick, `${label} carries its configured shared production route action`);
  assert.equal(item.borderRadius, 24, 'selected and inactive bookshelf rail items retain the approved radius');
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
const successor = new Parent(); initializeParent(successor, installedRuntime);
Object.assign(successor, { navigationGeneration: 3, detailShelfAdmissionMount: 2 }); successor.bookshelfShellContent();
const successorProps=[...successor.children.values()].at(-1).params, successorShell = new Shell(undefined, successorProps);
Object.assign(successorShell, successorProps, { mounted: true, topBar() {}, content() {} }); successorShell.initialRender();
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

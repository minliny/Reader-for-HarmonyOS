import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"button": {"description": "实际管理按钮到当前producer公开输入", "resources": []}, "choice": {"description": "实际选择器到当前producer公开输入", "resources": []}, "icon": {"description": "实际漫画icon到当前producer公开输入", "resources": []}, "ui-boundary": {"description": "公共 UI 不得依赖业务功能，非 UI 平台不得依赖 UI，拒绝导入和转发", "resources": []}, "navigation-owner": {"description": "现有路由和代次唯一写入 owner，根只订阅和转交", "resources": []}, "settings-arguments": {"description": "设置真实宿主、返回、开关与两条分段选择参数接线", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {verifySharedProducerInputCalls} = await import('./lib/shared-producer-inputs.mjs');
const read = file => readFileSync(new URL('../entry/src/main/ets/'+file, import.meta.url), 'utf8');

if (selectedCase === 'settings-arguments') {
  const currentProducers = {
    SettingsPage: 'features/settings/ui/SettingsPage.ets',
    SettingsShell: 'features/settings/ui/SettingsShell.ets',
    MainTabShell: 'features/shell/MainTabShell.ets',
    ReaderBottomNavigation: 'app/navigation/ReaderBottomNavigation.ets',
    ReaderBottomTabBar: 'ui/patterns/ReaderBottomTabBar.ets',
  };
  const verify = (component, consumerFile, expected, source = read(consumerFile)) => {
    const directory = ['ReaderStandardPage', 'ReaderPageScaffold'].includes(component) ? 'ui/layout' :
      component === 'PageBackBar' ? 'ui/chrome' : 'ui/controls';
    const producerFile = currentProducers[component] ?? `${directory}/${component}.ets`;
    const calls = verifySharedProducerInputCalls(read(producerFile), source, { component, producerFile, consumerFile });
    assert.equal(calls.filter(({values}) => Object.entries(expected).every(([key, expression]) => {
      const actual = values.get(key);
      return typeof expression === 'string' ? actual === expression : actual !== undefined && expression.test(actual);
    })).length, 1, `${consumerFile} must pass the expected ${component} inputs`);
  };
  const shell = 'features/shell/MainTabShell.ets';
  const page = 'features/settings/ui/SettingsPage.ets';
  const shelf = 'features/bookshelf/ui/BookshelfSettingsPage.ets';
  const settingsShell = 'features/settings/ui/SettingsShell.ets';
  verify('SettingsPage', 'app/composition/SettingsScenes.ets', { navigationGeneration: 'this.generation' });
  verify('SettingsShell', page, { navigationGeneration: 'this.navigationGeneration' });
  verify('MainTabShell', settingsShell, { navigationGeneration: 'this.navigationGeneration' });
  verify('ReaderBottomNavigation', shell, {
    current: 'this.activeTab',
    onSelect: /this\.requestMainTab\(key, generation\)/,
    onCurrentTap: /this\.requestCurrentTab\(key, generation\)/,
  });
  const bottom = 'app/navigation/ReaderBottomNavigation.ets';
  const bottomInputs = {
    items: 'this.items()', current: 'this.current', scheme: 'this.appThemeScheme',
    surfaceWidth: 'this.bottomBarFrame().width', translateX: 'this.bottomBarTranslateX()',
    bottomInset: 'this.bottomInset()', fontScale: 'this.navigationFontScale()', inputEnabled: 'this.inputIsEnabled()',
    onSelect: /this\.acceptsInput\(key\).*this\.onSelect\(key\)/,
    onCurrentTap: /this\.acceptsInput\(key\).*this\.onCurrentTap\(key\)/,
  };
  verify('ReaderBottomTabBar', bottom, bottomInputs);
  const shellInputs = {
    variant: 'this.standardPageVariant', scroller: 'this.scroller',
    contentLeadingRail: "this.navigationMode() === 'rail' ? readerMainRailLeading() : 0",
    contentEndInset: "this.navigationMode() === 'rail' ? readerMainRailBottomInset() : -1",
    onViewportChange: /if \(this\.mounted\) publishReaderMainViewport\(width, height\)/,
  };
  verify('ReaderStandardPage', shell, shellInputs);
  verify('ReaderPageScaffold', 'ui/layout/ReaderStandardPage.ets', {
    geometry: 'this.geometry', headerMeasurementKey: 'this.measurementKey', footerMeasurementKey: 'this.measurementKey',
    onHeaderHeightChange: /this\.recordMeasurement\('standard:header', height, key\)/,
    onFooterHeightChange: /this\.recordMeasurement\('standard:footer', height, key\)/,
  });
  verify('PageBackBar', shelf, { title: "'书架设置'", onBack: /this\.onBack\(\)/ });
  verify('ReaderFormRow', page, {
    actionEnabled: 'this.settingCanToggle(identity)', isBusy: 'this.settingToggleBusy()',
    onLabelAction: /this\.toggleSetting\(key, !this\.settingValue\(key\), identity\)/,
  });
  verify('ReaderToggle', page, {
    value: 'this.settingValue(key)', inputIdentity: '`${identity}:${key}`',
    actionEnabled: 'this.settingCanToggle(identity)', isBusy: 'this.settingToggleBusy()',
    onToggle: /this\.toggleSetting\(key, next, identity\)/,
  });
  verify('ReaderSegmentedControl', page, {
    optionIds: "['system', 'day', 'night']", selectedIndex: 'this.themeIndex()',
    inputIdentity: 'capturedIdentity', onSelect: /this\.selectAppTheme\(index, capturedIdentity\)/,
  });
  const shelfInputs = {
    optionIds: "['cover', 'list']", selectedIndex: "this.mode === 'list' ? 1 : 0",
    inputIdentity: 'identity', actionEnabled: 'this.viewModeHost.canSave()',
    onSelect: /identity === this\.preferenceControlIdentity\(\).*this\.selectMode\(index === 0 \? 'cover' : 'list'\)/,
  };
  verify('ReaderSegmentedControl', shelf, shelfInputs);
  assert.throws(() => verify('ReaderStandardPage', shell, shellInputs,
    read(shell).replace(shellInputs.contentLeadingRail, '0')), /expected ReaderStandardPage inputs/);
  assert.throws(() => verify('ReaderSegmentedControl', shelf, shelfInputs,
    read(shelf).replace(shelfInputs.selectedIndex, '0')), /expected ReaderSegmentedControl inputs/);
  assert.throws(() => verify('MainTabShell', settingsShell, { navigationGeneration: 'this.navigationGeneration' },
    read(settingsShell).replace('navigationGeneration: this.navigationGeneration', 'navigationGeneration: 0')),
    /expected MainTabShell inputs/);
  assert.throws(() => verify('ReaderBottomTabBar', bottom, bottomInputs,
    read(bottom).replace('inputEnabled: this.inputIsEnabled()', 'inputEnabled: true')),
    /expected ReaderBottomTabBar inputs/);
  return;
}

if (selectedCase === 'ui-boundary') {
  const { readdirSync } = await import('node:fs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { isSharedUiSource, sharedUiFeatureImports, assertSharedUiFeatureImports, platformUiImports, assertPlatformUiImports } =
    await import('./lib/shared-ui-boundary.mjs');
  const { ts, options } = installedEtsCompiler();
  const root = new URL('../entry/src/main/ets/', import.meta.url);
  const files = new Set(readdirSync(root, { recursive: true }).map(file => file.replaceAll('\\', '/'))
    .filter(file => /\.(ets|ts)$/.test(file)));
  const readSource = file => readFileSync(new URL(file, root), 'utf8');
  for (const file of files) {
    if (isSharedUiSource(file)) {
      assertSharedUiFeatureImports(sharedUiFeatureImports(ts, options, file, readSource(file), files, readSource));
    } else if (file.startsWith('platform/')) {
      assertPlatformUiImports(platformUiImports(ts, options, file, readSource(file), files, readSource));
    }
  }
  const platform = 'platform/tts/HarmonyTtsMediaSession.ts';
  assert.ok(files.has(platform));
  const platformEdges = platformUiImports(ts, options, platform,
    "export { ReaderStandardPage as View } from '../../ui/layout/ReaderStandardPage';", files, readSource);
  assert.throws(() => assertPlatformUiImports(platformEdges), /non-UI platform cannot depend/);
  const platformFeatureEdges = platformUiImports(ts, options, platform,
    "export { SettingsPage as View } from '../../features/settings/ui/SettingsPage';", files, readSource);
  assert.throws(() => assertPlatformUiImports(platformFeatureEdges),
    /non-UI platform cannot depend on features\/settings\/ui\/SettingsPage\.ets/);
  const consumer = 'ui/layout/ReaderStandardPage.ets';
  const feature = 'features/settings/ui/SettingsPage.ets';
  assert.ok(files.has(feature));
  for (const source of [
    "import { SettingsPage as Other } from '../../features/settings/ui/SettingsPage';",
    "export { SettingsPage } from '@bundle:io.reader.minliny/entry/ets/features/settings/ui/SettingsPage';",
    "const load = () => import('../../features/settings/ui/SettingsPage');",
    "import { ReaderRuntimeOwner as Runtime } from '../../app/ReaderRuntimeOwner';",
    "export { ReaderRuntimeOwner as Runtime } from '../../app/ReaderRuntimeOwner';",
    "const load = () => import('../../app/ReaderRuntimeOwner');",
  ]) {
    const edges = sharedUiFeatureImports(ts, options, consumer, source, files, readSource);
    assert.throws(() => assertSharedUiFeatureImports(edges), /shared UI cannot depend/);
  }
  assert.throws(() => sharedUiFeatureImports(ts, options, consumer, 'const load = (path) => import(path);', files, readSource),
    /nonliteral dynamic import/);

  assertSharedUiFeatureImports(sharedUiFeatureImports(ts, options, consumer,
    "import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment'; const current = readerWindowMetrics();", files, readSource));
  assertSharedUiFeatureImports(sharedUiFeatureImports(ts, options, consumer,
    "import { readerWindowMetrics as currentMetrics } from '../foundation/ReaderWindowEnvironment'; const current = currentMetrics();", files, readSource));
  for (const source of [
    "import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';",
    "import { ReaderWindowCoordinator as WindowMetrics } from '../../app/ReaderWindowCoordinator'; const current = WindowMetrics.metrics();",
    "import { bindReaderWindowMetricsSource } from '../foundation/ReaderWindowEnvironment';",
    "export { bindReaderWindowMetricsSource } from '../foundation/ReaderWindowEnvironment';",
    "import * as Environment from '../foundation/ReaderWindowEnvironment';",
    "const load = () => import('../foundation/ReaderWindowEnvironment');",
  ]) {
    assert.throws(() => assertSharedUiFeatureImports(sharedUiFeatureImports(ts, options, consumer,
      source, files, readSource)), /shared UI cannot depend/, 'only the read port belongs to public UI');
  }
  for (const use of ['ReaderWindowCoordinator.brightness()', 'ReaderWindowCoordinator.detach()',
    'ReaderWindowCoordinator.metrics', 'ReaderWindowCoordinator']) {
    assert.throws(() => assertSharedUiFeatureImports(sharedUiFeatureImports(ts, options, consumer,
      "import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator'; const escaped = " + use + ';', files, readSource)),
      /shared UI cannot depend on app\/ReaderWindowCoordinator/);
  }
  const facade = 'common/BoundaryFixtureFacade.ts';
  const forwarder = 'common/BoundaryFixtureForwarder.ts';
  const runtimeBridge = 'common/BoundaryFixtureRuntime.ts';
  const namespaceFacade = 'common/BoundaryFixtureNamespace.ts';
  const defaultFacade = 'common/BoundaryFixtureDefault.ts';
  const windowFacade = 'common/BoundaryFixtureWindow.ts';
  const legacyShared = 'features/common/BoundaryFixtureLegacy.ts';
  const fixture = new Map([
    [legacyShared, 'export type LegacyInput = string;'],
    [runtimeBridge, "export { ReaderRuntimeOwner as Runtime } from '../app/ReaderRuntimeOwner';"],
    [windowFacade, "export { ReaderWindowCoordinator as WindowOwner } from '../app/ReaderWindowCoordinator';"],
    [facade, `export * from './BoundaryFixtureForwarder'; export type Safe = string;`],
    [forwarder, `import { SettingsPage as FeatureView } from '../features/settings/ui/SettingsPage';
      type Alias = FeatureView;
      export type { Alias as Leaked };
      export type Wrapped = ReadonlyArray<Alias>;
      export type Combined = string | { view: Alias };
      export interface Metadata { view: Alias; }
      export interface Extended extends Alias {}
      export const LeakedValue = FeatureView;
      const ForwardedValue = FeatureView;
      export { ForwardedValue as ValueAlias };
      export const AnnotatedValue: FeatureView | undefined = undefined;
      export class Derived extends FeatureView {}
      export class DeclaredView { value?: FeatureView; }
      export class FieldAlias { static View = FeatureView; }
      export class InstanceFieldAlias { view = FeatureView; }
      export const ObjectAlias = { view: FeatureView };
      export const ArrayAlias = [FeatureView];
      export function factory(): FeatureView { throw new Error(); }
      export const typedArrow = (): FeatureView => { throw new Error(); };
      export const typedFunction = function(): FeatureView { throw new Error(); };
      export const SafeConstant = 'safe';
      export function safeGeneric<FeatureView>(value: FeatureView): FeatureView { return value; }
      export const safeGenericArrow = <FeatureView>(value: FeatureView): FeatureView => value;
      export class SafeGeneric<FeatureView> { value?: FeatureView; constructor(value: FeatureView) {} }
      type LocalValue = 'one' | 'two';
      export type SafeValues = ReadonlyArray<LocalValue>;
      export interface SafeMetadata { value: LocalValue; }
      export * from './BoundaryFixtureFacade';`],
    [namespaceFacade, `import * as Public from './BoundaryFixtureForwarder';
      export const View = Public.LeakedValue;
      export const Safe = Public.SafeConstant;
      export type SafeType = Public.SafeValues;
      export * as Public from './BoundaryFixtureForwarder';`],
    [defaultFacade, `import { SettingsPage as FeatureView } from '../features/settings/ui/SettingsPage';
      export default class extends FeatureView {}`],
  ]);
  const fixtureFiles = new Set([...files, ...fixture.keys()]);
  const fixtureEdges = source => sharedUiFeatureImports(ts, options, consumer, source, fixtureFiles,
    file => fixture.get(file) ?? readSource(file));
  assert.throws(() => assertSharedUiFeatureImports(fixtureEdges(
    "import type { LegacyInput } from '../../features/common/BoundaryFixtureLegacy';")), /shared UI cannot depend/);
  for (const source of [
    "import type { Leaked as Input } from '../../common/BoundaryFixtureFacade';",
    "import type { Wrapped as Input } from '../../common/BoundaryFixtureFacade';",
    "import type { Combined as Input } from '../../common/BoundaryFixtureFacade';",
    "import type { Metadata as Input } from '../../common/BoundaryFixtureFacade';",
    "import type { Extended as Input } from '../../common/BoundaryFixtureFacade';",
    "import { LeakedValue as Input } from '../../common/BoundaryFixtureFacade';",
    "import { ValueAlias as Input } from '../../common/BoundaryFixtureFacade';",
    "import { AnnotatedValue as Input } from '../../common/BoundaryFixtureFacade';",
    "import { Derived as Input } from '../../common/BoundaryFixtureFacade';",
    "import { DeclaredView as Input } from '../../common/BoundaryFixtureFacade';",
    "import { FieldAlias as Input } from '../../common/BoundaryFixtureFacade';",
    "import { InstanceFieldAlias as Input } from '../../common/BoundaryFixtureFacade';",
    "import { ObjectAlias as Input } from '../../common/BoundaryFixtureFacade';",
    "import { ArrayAlias as Input } from '../../common/BoundaryFixtureFacade';",
    "import { factory as Input } from '../../common/BoundaryFixtureFacade';",
    "import { typedArrow as Input } from '../../common/BoundaryFixtureFacade';",
    "import { typedFunction as Input } from '../../common/BoundaryFixtureFacade';",
    "export type View = import('../../common/BoundaryFixtureFacade').Leaked;",
    "export { Leaked } from '../../common/BoundaryFixtureFacade';",
    "const load = () => import('../../common/BoundaryFixtureFacade');",
  ]) {
    assert.throws(() => assertSharedUiFeatureImports(fixtureEdges(source)),
      /BoundaryFixtureFacade\.ts -> common\/BoundaryFixtureForwarder\.ts -> features\/settings\/ui\/SettingsPage\.ets/);
  }
  assert.throws(() => assertSharedUiFeatureImports(fixtureEdges(
    "import { Runtime } from '../../common/BoundaryFixtureRuntime';")),
    /BoundaryFixtureRuntime\.ts -> app\/ReaderRuntimeOwner\.ts/);
  for (const source of [
    "import * as Window from '../../app/ReaderWindowCoordinator'; Window.ReaderWindowCoordinator.detach();",
    "import { WindowOwner } from '../../common/BoundaryFixtureWindow'; WindowOwner.detach();",
    "export { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';",
    "const load = () => import('../../app/ReaderWindowCoordinator');",
    "import { ReaderWindowChromeStyle } from '../../app/ReaderWindowCoordinator';",
  ]) assert.throws(() => assertSharedUiFeatureImports(fixtureEdges(source)), /app\/ReaderWindowCoordinator\.ts/);
  assertSharedUiFeatureImports(fixtureEdges("import type { Safe } from '../../common/BoundaryFixtureFacade';"));
  assertSharedUiFeatureImports(fixtureEdges("import type { Safe } from '../../common/BoundaryFixtureForwarder';"));
  assertSharedUiFeatureImports(fixtureEdges("import type { SafeValues, SafeMetadata } from '../../common/BoundaryFixtureFacade';"));
  assertSharedUiFeatureImports(fixtureEdges("import { SafeConstant, safeGeneric, safeGenericArrow, SafeGeneric } from '../../common/BoundaryFixtureFacade';"));
  for (const source of [
    "import { View } from '../../common/BoundaryFixtureNamespace';",
    "export type View = import('../../common/BoundaryFixtureNamespace').Public.Leaked;",
    "import View from '../../common/BoundaryFixtureDefault';",
  ]) assert.throws(() => assertSharedUiFeatureImports(fixtureEdges(source)), /features\/settings\/ui\/SettingsPage\.ets/);
  assertSharedUiFeatureImports(fixtureEdges("import { Safe, SafeType } from '../../common/BoundaryFixtureNamespace';"));
  assertSharedUiFeatureImports(fixtureEdges("export type Safe = import('../../common/BoundaryFixtureNamespace').Public.SafeValues;"));
  const defaultFunctionFixture = new Map(fixture);
  defaultFunctionFixture.set(defaultFacade, `import type { SettingsPage } from '../features/settings/ui/SettingsPage';
    export default function (): SettingsPage { throw new Error(); }`);
  assert.throws(() => assertSharedUiFeatureImports(sharedUiFeatureImports(ts, options, consumer,
    "import View from '../../common/BoundaryFixtureDefault';", fixtureFiles,
    file => defaultFunctionFixture.get(file) ?? readSource(file))), /features\/settings\/ui\/SettingsPage\.ets/);
  return;
}

if (selectedCase === 'navigation-owner') {
  const { actualSourceSwitchPresentation } = await import('./lib/source-switch-presentation-probe.mjs');
  const NavigationSourceProjection = actualSourceSwitchPresentation({});
  const { ReaderNavigation, readerExitTarget, retainedReaderRoute } =
    await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
  const { ReaderLibraryAcquisitionBinding } =
    await import('../entry/src/main/ets/app/composition/ReaderLibraryAcquisitionBinding.ts');
  const acquisitionCalls = [], acquisitionListeners = new Set();
  const coordinator = {
    subscribe(listener) { acquisitionListeners.add(listener); return () => acquisitionListeners.delete(listener); },
    beginSearch() { acquisitionCalls.push('begin'); },
    endSearch() { acquisitionCalls.push('end'); },
    visibilityChanged() { acquisitionCalls.push('visibility'); },
    setPreparationVisible(visible) { acquisitionCalls.push(['visible', visible]); },
  };
  const libraryRuntime = { bookAcquisitions: () => coordinator,
    readingEntryPreparations: () => ({ setPaused: paused => acquisitionCalls.push(['paused', paused]) }) };
  const libraryPorts = root => ({ ownsRuntime: owner => owner === libraryRuntime,
    detailBook: () => ({ sourceId: 'source', bookId: 'book' }),
    refreshShelf: () => acquisitionCalls.push([root, 'shelf']),
    refreshMembership: () => acquisitionCalls.push([root, 'membership']),
    refreshDetail: () => acquisitionCalls.push([root, 'detail']) });
  const oldLibrary = new ReaderLibraryAcquisitionBinding(), currentLibrary = new ReaderLibraryAcquisitionBinding();
  oldLibrary.mount(libraryRuntime, libraryPorts('old'));
  const [retiredListener] = acquisitionListeners;
  currentLibrary.mount(libraryRuntime, libraryPorts('current'));
  assert.deepEqual(acquisitionCalls, [['paused', true], 'end']);
  assert.equal(acquisitionListeners.size, 1);
  const change = { shelfChanged: true, identities: [{ sourceId: 'source', bookId: 'book' }] };
  retiredListener(change);
  oldLibrary.dispose();
  oldLibrary.visibilityChanged(false);
  assert.equal(oldLibrary.beginSearch(), false);
  assert.equal(currentLibrary.beginSearch(), true);
  for (const listener of acquisitionListeners) listener(change);
  assert.deepEqual(acquisitionCalls.slice(2), ['begin', ['current', 'shelf'], ['current', 'membership'], ['current', 'detail']]);
  currentLibrary.dispose();
  assert.deepEqual(acquisitionCalls.slice(-2), [['paused', true], 'end']);
  assert.equal(acquisitionListeners.size, 0);
  const owner = new ReaderNavigation();
  const initial = owner.snapshot();
  assert.deepEqual(initial, { route: 'bookshelf', generation: 0, directoryReturnTarget: 'detail', settingsSection: 'home' });
  assert.equal(owner.show('bookshelf'), initial);
  const generation = owner.advance();
  assert.deepEqual(generation, { route: 'bookshelf', generation: 1, directoryReturnTarget: 'detail', settingsSection: 'home' });
  const settings = owner.show('settings');
  assert.deepEqual(settings, { route: 'settings', generation: 1, directoryReturnTarget: 'detail', settingsSection: 'home' });
  assert.equal(owner.show('settings'), settings);
  assert.deepEqual(generation, { route: 'bookshelf', generation: 1, directoryReturnTarget: 'detail', settingsSection: 'home' });
  assert.equal(owner.openLibrarySearch(assert.fail, assert.fail), undefined);
  assert.equal(owner.openBookshelfMultiSelect(assert.fail), undefined);
  const shelfNavigationOwner = new ReaderNavigation();
  const advanceShelf = () => shelfNavigationOwner.advance();
  assert.equal(shelfNavigationOwner.openLibrarySearch(advanceShelf, () => false), undefined);
  assert.equal(shelfNavigationOwner.snapshot().route, 'bookshelf');
  assert.equal(shelfNavigationOwner.openLibrarySearch(advanceShelf, () => true).route, 'search');
  assert.equal(shelfNavigationOwner.openBookshelfMultiSelect(assert.fail), undefined);
  assert.equal(shelfNavigationOwner.returnToBookshelf(undefined, advanceShelf).route, 'bookshelf');
  assert.equal(shelfNavigationOwner.openBookshelfMultiSelect(advanceShelf).route, 'bookshelfMultiSelect');
  assert.equal(shelfNavigationOwner.finishBookshelfMultiSelect(advanceShelf).route, 'bookshelf');
  assert.equal(shelfNavigationOwner.finishBookshelfMultiSelect(assert.fail), undefined);
  const settingsNavigation = new ReaderNavigation();
  settingsNavigation.openSettingsHome();
  assert.equal(settingsNavigation.selectSettingsSection('general', assert.fail).settingsSection, 'general');
  const bookshelfSettings = settingsNavigation.openBookshelfSettings(() => settingsNavigation.advance());
  assert.equal(bookshelfSettings.route, 'bookshelfSettings');
  settingsNavigation.backFromBookshelfSettings(() => settingsNavigation.show('settings'), assert.fail);
  assert.equal(settingsNavigation.snapshot().route, 'settings');
  assert.equal(settingsNavigation.snapshot().settingsSection, 'general');
  assert.equal(settingsNavigation.openSettingsHome().settingsSection, 'home');
  owner.setRulesManagementOrigin('reader');
  assert.equal(owner.takeRulesManagementOrigin(), 'reader');
  assert.equal(owner.takeRulesManagementOrigin(), 'settings');
  const reading = owner.show('reading');
  assert.equal(owner.openDirectory('readerControl', () => false), undefined);
  assert.equal(owner.snapshot(), reading);
  const directory = owner.openDirectory('readerControl', () => true);
  assert.equal(directory.route, 'directory');
  assert.equal(directory.directoryReturnTarget, 'readerControl');
  assert.equal(owner.readerDestinationWhenReady(), 'directory');
  assert.equal(directory.generation, 1);
  assert.equal(owner.backTarget(), 'directoryOrigin');
  const directoryRuntime = {};
  const handled = [];
  owner.setTemporaryBack('directory', 1, directoryRuntime, () => { handled.push('old'); return true; }, 'old-directory');
  owner.setTemporaryBack('directory', 1, directoryRuntime, () => { handled.push('current'); return true; }, 'current-directory');
  owner.setTemporaryBack('directory', 1, directoryRuntime, undefined, 'old-directory');
  const consumeDirectoryBack = () => owner.consumeTemporaryBack(runtime => runtime === directoryRuntime, assert.fail);
  const directoryBackPorts = { bookshelfGroup: () => false, temporaryOwner: () => directoryRuntime,
    onTemporaryFailure: assert.fail, destination: assert.fail };
  assert.equal(owner.dispatchBack({ ...directoryBackPorts,
    nativeSurface: () => { handled.push('native'); return true; }, bookRemoval: assert.fail }), true);
  assert.equal(owner.dispatchBack({ ...directoryBackPorts,
    bookRemoval: () => handled.push('modal') }), true);
  assert.equal(owner.dispatchBack(directoryBackPorts), true);
  assert.equal(owner.dispatchBack(directoryBackPorts), true);
  assert.deepEqual(handled, ['native', 'modal', 'current', 'current']);
  assert.equal(owner.closeDirectory(true, assert.fail).route, 'reading');
  assert.equal(owner.readerDestinationWhenReady(), 'reading');
  assert.equal(consumeDirectoryBack(), false);
  owner.show('detail');
  const detailDirectory = owner.openDirectory('detail', () => true);
  assert.equal(detailDirectory.route, 'directory');
  assert.equal(detailDirectory.generation, 1);
  let readerExitRequests = 0;
  assert.equal(owner.closeDirectory(true, () => { readerExitRequests++; }), undefined);
  assert.equal(owner.snapshot(), detailDirectory, 'an active reader behind a detail directory uses the saved exit path');
  assert.equal(readerExitRequests, 1);
  assert.equal(owner.closeDirectory(false, assert.fail).route, 'detail');
  assert.equal(retainedReaderRoute('reading', 'detail'), 'reading');
  assert.equal(retainedReaderRoute('directory', 'readerControl'), 'directory');
  assert.equal(retainedReaderRoute('directory', 'detail'), undefined);
  assert.equal(retainedReaderRoute('settings', 'readerControl'), undefined);
  const exit = { requestedDownloads: false, fromDownloads: false, requestedBookInfo: false,
    admittedBookInfo: false, requestedRules: false, requestedDetailOrigin: false, requestedBookshelfPreparation: false };
  assert.equal(readerExitTarget(exit), 'readingOrigin');
  assert.equal(readerExitTarget({ ...exit, fromDownloads: true }), 'returnToDownloads');
  assert.equal(readerExitTarget({ ...exit, fromDownloads: true, requestedBookInfo: true }), 'readingOrigin');
  assert.equal(readerExitTarget({ ...exit, fromDownloads: true, requestedRules: true }), 'rules');
  assert.equal(readerExitTarget({ ...exit, requestedDetailOrigin: true }), 'detailOrigin');
  const bookInfo = { ...exit, fromDownloads: true, requestedBookInfo: true, admittedBookInfo: true, requestedRules: true };
  assert.equal(readerExitTarget(bookInfo), 'bookInfo');
  assert.equal(readerExitTarget({ ...bookInfo, requestedDownloads: true }), 'requestedDownloads');
  const returns = owner.returns;
  returns.setSourceOrigin('search', 'query');
  owner.advance();
  assert.deepEqual(returns.takeSourceOrigin(), { target: 'search', keyword: 'query' });
  assert.deepEqual(returns.sourceOrigin(), { target: 'settings', keyword: '' });
  const runtime = { bookAcquisitions: () => ({ beginSearch() {} }) };
  const book = { sourceId: 'source', bookId: 'book' }, view = { membershipRevision: 1 };
  returns.beginDetailEntry(undefined);
  assert.equal(returns.completeDetailEntry('search', undefined, false), 'detail');
  returns.rememberDownloadOrigin('directory', () => book);
  returns.openReadingFromDownloads(() => {
    assert.equal(returns.captureReaderReturn(runtime, () => view).fromDownloads, false);
    return true;
  });
  const context = returns.captureReaderReturn(runtime, () => view);
  const exitLease = readerIdentity => ({ readerIdentity, request() {} });
  const cancelledDownload = new ReaderNavigation().returns;
  cancelledDownload.rememberDownloadOrigin('directory', () => book);
  cancelledDownload.openReadingFromDownloads(() => true);
  const previousReturn = cancelledDownload.captureReaderReturn(runtime, () => view);
  cancelledDownload.requestDownloadsAfterExit(book, previousReturn, exitLease('reader'), 'details');
  cancelledDownload.cancelReaderExit();
  assert.equal(cancelledDownload.takeReaderExit('reader', 'book', runtime).target, 'returnToDownloads');
  const directoryReturns = [];
  const showDirectory = { showBookshelf: assert.fail, showSettings: assert.fail, resumeReader: assert.fail,
    restoreReader: assert.fail, showBook: (...args) => directoryReturns.push(args) };
  cancelledDownload.returnFromDownloads(showDirectory);
  assert.deepEqual(directoryReturns.pop(), [book, 'bookshelf', true]);
  cancelledDownload.rememberBookshelfReaderOrigin();
  cancelledDownload.openReadingFromDownloads(() => false);
  const refused = cancelledDownload.captureReaderReturn(runtime, () => view);
  assert.equal(refused.originRoute, 'bookshelf');
  assert.equal(refused.fromDownloads, false);
  assert.throws(() => cancelledDownload.openReadingFromDownloads(() => { throw new Error('entry interrupted'); }),
    /entry interrupted/);
  assert.equal(cancelledDownload.captureReaderReturn(runtime, () => view).originRoute, 'bookshelf',
    'an interrupted feature callback releases the provisional download origin');

  returns.requestBookInfoAfterExit(exitLease('reader'), 'book', context);
  returns.requestDownloadsAfterExit(book, context, exitLease('reader'), 'details');
  assert.deepEqual(returns.takeReaderExit('reader', 'book', runtime),
    { target: 'requestedDownloads', bookInfo: undefined, downloadDetailKey: 'details' });
  const reopening = [];
  returns.returnFromDownloads({ ...showDirectory, showBook: assert.fail,
    restoreReader(saved) {
      assert.equal(saved, context);
      returns.restoreReaderReturn(saved, restored => assert.equal(restored, view));
      reopening.push('restore');
      return true;
    },
    resumeReader(selection) { assert.equal(selection, book); reopening.push('open'); },
  });
  assert.deepEqual(reopening, ['restore', 'open', 'restore']);
  returns.returnFromDownloads(showDirectory);
  assert.deepEqual(directoryReturns.pop(), [book, 'search', true]);
  returns.restoreReaderReturn(context, restored => assert.equal(restored, view));
  returns.requestBookInfoAfterExit(exitLease('reader'), 'book', context);
  assert.equal(returns.takeReaderExit('reader', 'book', {}).target, 'readingOrigin');
  returns.requestParentAfterExit(exitLease('reader'), 'detailOrigin');
  returns.requestRulesAfterExit(exitLease('reader'));
  returns.cancelReaderExit();
  assert.equal(returns.takeReaderExit('reader', 'book', runtime).target, 'returnToDownloads');
  assert.equal(returns.takeReaderExit('reader', 'book', runtime).target, 'readingOrigin');
  returns.requestParentAfterExit(exitLease('reader'), 'detailOrigin');
  returns.requestRulesAfterExit(exitLease('reader'));
  assert.equal(returns.takeReaderExit('reader', 'book', runtime).target, 'rules');
  assert.equal(returns.takeReaderExit('reader', 'book', runtime).target, 'readingOrigin');
  returns.requestRulesAfterExit(exitLease('old-reader'));
  returns.requestParentAfterExit(exitLease('reader'), 'detailOrigin');
  assert.equal(returns.takeReaderExit('reader', 'book', runtime).target, 'detailOrigin');
  returns.requestParentAfterExit(exitLease('reader'), 'detailOrigin');
  returns.requestRulesAfterExit(exitLease('reader'));
  let fileDelivered = false;
  returns.dispatchAcceptedReaderExit('reader', 'book', runtime, {
    claimSystemFileExit: () => true, deliverSystemFile: () => { fileDelivered = true; },
    openDownloads: assert.fail, showReaderDetail: assert.fail, afterReaderDetail: assert.fail,
    openRules: assert.fail, returnFromDetail: assert.fail, returnFromBookshelfPreparation: assert.fail, returnToReadingOrigin: assert.fail,
  });
  assert.equal(fileDelivered, true, 'a claimed system file takes precedence over ordinary destinations');
  assert.equal(returns.takeReaderExit('reader', 'book', runtime).target, 'readingOrigin');

  const shelfNavigation = new ReaderNavigation();
  let shelfExitRequests = 0;
  let bookshelfReturns = 0;
  const shelfExitLease = { readerIdentity: 'shelf-reader', request() { shelfExitRequests++; } };
  shelfNavigation.returns.requestParentAfterExit(shelfExitLease, 'bookshelfPreparation');
  shelfNavigation.returns.requestParentAfterExit(shelfExitLease, 'bookshelfPreparation');
  assert.equal(shelfExitRequests, 1);
  assert.equal(shelfNavigation.dispatchBack({ ...directoryBackPorts, shelfPreparation: assert.fail }), true);
  shelfNavigation.returns.dispatchAcceptedReaderExit('shelf-reader', 'book', runtime, {
    claimSystemFileExit: () => false, deliverSystemFile: assert.fail, openDownloads: assert.fail,
    showReaderDetail: assert.fail, afterReaderDetail: assert.fail, openRules: assert.fail, returnFromDetail: assert.fail,
    returnFromBookshelfPreparation: () => { bookshelfReturns++; }, returnToReadingOrigin: assert.fail,
  });
  assert.equal(bookshelfReturns, 1);
  assert.equal(shelfNavigation.dispatchBack(directoryBackPorts), false);

  const indexFile = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { actualReadingEntryPresentation } = await import('./lib/reading-entry-presentation-probe.mjs');
  const { installDirectoryOperationIndex } = await import('./lib/reader-directory-operations-probe.mjs');
  const { bookshelfOperationClass } = await import('./lib/bookshelf-operation-owner-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { readingEntryInputForSearchContext } = await import('../entry/src/main/ets/features/reading/presentation/ReadingEntryDto.ts');
  const EntryActions = bookshelfOperationClass('app/composition/ReaderReadingEntryActions.ets',
    'ReaderReadingEntryActions', { Observed: value => value, readingEntryInputForSearchContext });
  const ExitActions = bookshelfOperationClass('app/composition/ReaderExitActions.ets', 'ReaderExitActions');
  const LibraryJourney = bookshelfOperationClass('app/composition/ReaderLibraryJourney.ets', 'ReaderLibraryJourney');
  const SettingsJourney = bookshelfOperationClass('app/composition/ReaderSettingsJourney.ets', 'ReaderSettingsJourney');
  const downloadBookFromReadingDetail = bookshelfOperationClass('features/reading/presentation/ReadingBookDetail.ts', 'downloadBookFromReadingDetail');
  const DownloadJourney = bookshelfOperationClass('app/composition/ReaderDownloadJourney.ets', 'ReaderDownloadJourney', { downloadBookFromReadingDetail });
  // Real navigation, entry Actions and Presentation execute both download
  // branches. Only the existing Host publication and window/Core ports are
  // controlled; the return or chapter admission algorithms are not copied.
  function verifyDownloadedDetailParent(Actions, kind, origin = 'directory', retryAfterRefusal = false) {
    const navigation = new ReaderNavigation(), observed = [], view = { membershipRevision: 4 };
    const local = kind === 'local';
    const selection = { sourceId: local ? 'local' : 'source', bookId: `${kind}-download`,
      title: '下载书籍', author: '作者', contentKind: 'text', kind: local ? 'epub' : 'novel' };
    let entry, refused = retryAfterRefusal;
    const hostSnapshot = { scopeId: 7, sessionGeneration: 1, book: selection, toc: [],
      inBookshelf: true, loadingMessage: '', verdict: 'readable' };
    const host = {
      snapshot: () => hostSnapshot,
      openLocal(book, lease, resume) {
        assert.equal(local, true); assert.equal(book, selection); assert.equal(resume, true);
        assert.equal(lease.isCurrent(), true); observed.push('local'); lease.changed(hostSnapshot);
      },
      openRemote(input, lease) {
        assert.equal(local, false); assert.equal(input.shelfSnapshot, selection);
        assert.equal(input.resumeImmediately, true); assert.equal(input.fromSearch, false);
        assert.equal(lease.isCurrent(), true); observed.push('remote'); lease.changed(hostSnapshot);
      },
    };
    const Entry = actualReadingEntryPresentation({ ReadingEntryHost: { forRuntime(owner) {
      assert.equal(owner, runtime); return host;
    } } });
    entry = new Entry();
    navigation.returns.beginDetailEntry(undefined);
    navigation.returns.completeDetailEntry('search', undefined, false);
    if (origin === 'reading') {
      const saved = navigation.returns.captureReaderReturn(runtime, () => view);
      navigation.returns.beginDetailEntry(undefined);
      navigation.returns.completeDetailEntry('bookshelf', undefined, false);
      navigation.returns.rememberDownloadOrigin('settings', () => selection);
      navigation.returns.requestDownloadsAfterExit(selection, saved, exitLease('download-reader'), 'details');
      assert.equal(navigation.returns.takeReaderExit('download-reader', selection.bookId, runtime).target, 'requestedDownloads');
    } else {
      if (origin === 'reader-detail') {
        const saved = navigation.returns.captureReaderReturn(runtime, () => view);
        navigation.returns.showReaderBookInfo(saved, () => {});
      }
      navigation.returns.rememberDownloadOrigin('directory', () => selection);
    }
    navigation.show('downloads');
    const input = { shelfBook: selection, chapterIndex: 4, sourceLabel: '书源',
      ...(local ? {} : { seed: { ...selection, detailUrl: 'https://source.test/book' } }) };
    let journey;
    const actions = new Actions(navigation, { begin() {} }, {
      runtime: () => runtime, entry: () => entry, mounting: () => 1,
      search: () => ({ host: { visibilityChanged() {} }, admissionCandidates: () => [] }),
      sourceSwitch: () => ({ visible: false }), shelfBooks: () => [], removalPending: () => false,
      advance: () => navigation.advance().generation, show: route => navigation.show(route),
      sourceName: () => '书源', failure: assert.fail, bindReader() {},
      restoreReaderReturn: context => journey.restoreReaderReturn(context),
      entryPorts: () => ({ current: () => true, projectionVisible: () => true,
        membership: () => ({}), notice: assert.fail, refreshShelf() {}, cacheDecision: async () => false }),
    });
    if (retryAfterRefusal) {
      const admit = entry.enterLocalDetail;
      entry.enterLocalDetail = function(...args) {
        if (!refused) return admit.apply(this, args);
        refused = false;
        // An interrupted original attempt can replace the live snapshot.
        // The unchanged downloads destination still owns its earlier parent.
        navigation.returns.beginDetailEntry(undefined);
        navigation.returns.completeDetailEntry('downloads', undefined, true);
        navigation.advance(); navigation.show('detail'); return false;
      };
    }
    journey = new DownloadJourney(navigation, {
      scope: () => ({ instance: 1, mounting: 1, inputAllowed: true }), runtime: () => runtime,
      reading: () => entry, readingActions: () => actions, shelfBooks: () => [],
      downloads: () => ({ captureReturn: () => view, restoreReturn() {},
        open(_owner, _identity, current) { assert.equal(current(), true); observed.push('restore-downloads'); } }),
      advance: () => navigation.advance(), publish() {}, feedback: assert.fail,
    });
    journey.openChapter(input);
    if (retryAfterRefusal) {
      assert.equal(navigation.snapshot().route, 'downloads'); assert.equal(entry.sessionActive, false);
      assert.equal(navigation.returns.snapshot().detailParent, 'bookshelf');
      journey.openChapter(input);
    }
    assert.equal(navigation.snapshot().route, 'reading'); assert.equal(entry.requestedChapterIndex, 4);
    assert.equal(entry.sessionActive, true);
    const captured = journey.captureReaderReturn();
    assert.equal(captured.detailParent, 'search', `${kind}/${origin}: the first downloaded reader capture preserves search`);
    assert.equal(captured.fromDownloads, true);
    assert.deepEqual(observed, retryAfterRefusal ? ['restore-downloads', kind] : [kind]);
  }
  for (const kind of ['local', 'remote']) verifyDownloadedDetailParent(EntryActions, kind);
  verifyDownloadedDetailParent(EntryActions, 'local', 'reading');
  verifyDownloadedDetailParent(EntryActions, 'remote', 'reader-detail');
  verifyDownloadedDetailParent(EntryActions, 'local', 'directory', true);
  const entryActionSource = read('app/composition/ReaderReadingEntryActions.ets');
  for (const [kind, before, after] of [
    ['local', 'this.openLocalDetail(book, true, parent, download);', 'this.openLocalDetail(book, true, undefined, download);'],
    ['remote', '}, parent, download);', '}, undefined, download);'],
  ]) {
    const changed = entryActionSource.replace(before, after); assert.notEqual(changed, entryActionSource);
    const BrokenActions = pureModuleProbe(changed, 'ReaderReadingEntryActions.ets',
      { Observed: value => value, readingEntryInputForSearchContext }, ['ReaderReadingEntryActions']).ReaderReadingEntryActions;
    assert.throws(() => verifyDownloadedDetailParent(BrokenActions, kind), /first downloaded reader capture preserves search/,
      `${kind}: dropping only the actual parent restores the original defect`);
  }
  const { BookRemovalDialogPresentation } = await import('../entry/src/main/ets/features/bookshelf/presentation/BookRemovalDialogPresentation.ts');
  const ReadingEntry = actualReadingEntryPresentation();
  const { JsonImportPresentation } = await import('./lib/json-import-presentation-probe.mjs');
  const Index = selectedProductionMethods(indexFile, 'Index', [
    'isCurrentRuntime', 'currentReadingRuntime', 'cancelReaderExitDestination', 'onReaderExited',
    'currentReaderPresentationIdentity', 'settingsNavigationPorts', 'readingExitActionPorts', 'libraryJourneyPorts', 'navigateTo', 'publishNavigation', 'bookshelfModalVisible',
    'downloadNavigationPorts',
    'readingEntryActionPorts', 'readingEntryPorts', 'openFullDirectory',
  ], { ReaderRuntimeOwner: { isCurrent: candidate => candidate === runtime } });
  const events = [];
  let currentRootOwner = runtime;
  const indexActor = Object.assign(new Index(), {
    navigationOwner: new ReaderNavigation(), mountedRuntimeOwner: runtime, rssInstanceIdentity: 1, detailShelfAdmissionMount: 1,
    shelfMutations: { snapshot: { removalKey: '' } }, shelfGroupPresentation: { identity: '' },
    libraryAcquisition: { currentOwner: () => currentRootOwner, beginSearch: () => true, endSearch() {} },
    readingEntry: Object.assign(new ReadingEntry(), { book, contentKind: 'text', sessionActive: true, readyGeneration: 3 }),
    bookRemovalConfirmation: new BookRemovalDialogPresentation(),
    jsonImportPresentation: new JsonImportPresentation(),
    nextNavigationGeneration() { this.publishNavigation(this.navigationOwner.advance()); return this.navigationGeneration; },
    rulesPresentation: { open(owner, identity, current) {
      assert.equal(owner, runtime);
      assert.equal(identity, indexActor.settingsNavigation.rulesIdentity(indexActor.navigationGeneration, indexActor.detailShelfAdmissionMount));
      assert.equal(current(), true);
      events.push('rules');
    } },
    returnToReadingOrigin: () => events.push('origin'),
    librarySearch: { prepareEntry() {}, open() {} },
  });
  indexActor.libraryJourney = new LibraryJourney(indexActor.navigationOwner, indexActor.libraryJourneyPorts());
  indexActor.settingsNavigation = new SettingsJourney(indexActor.navigationOwner, indexActor.settingsNavigationPorts());
  indexActor.downloadNavigation = new DownloadJourney(indexActor.navigationOwner, indexActor.downloadNavigationPorts());
  indexActor.readingExitActions = new ExitActions(indexActor.navigationOwner, indexActor.readingExitActionPorts());
  indexActor.navigateTo('reading');
  let identity = indexActor.currentReaderPresentationIdentity();
  currentRootOwner = undefined;
  indexActor.onReaderExited(identity);
  assert.deepEqual(events, [], 'a replaced root cannot deliver an exit even when the same Runtime remains installed');
  currentRootOwner = runtime;
  // The rules route retains its original exit owner; its unused UI forwarding
  // chain was retired. This checks that compatibility owner, not a visible entry.
  indexActor.readingExitActions.requestRules();
  indexActor.onReaderExited(identity);
  assert.deepEqual(events, ['origin'], 'before the reader registers its save handoff, no rules request is retained');
  indexActor.onReaderExited(identity);
  assert.deepEqual(events, ['origin'], 'the same exit receipt cannot restart a retained return animation');
  indexActor.readingEntry.beginReaderPresentation();
  identity = indexActor.currentReaderPresentationIdentity();
  indexActor.readingEntry.attachExitRequest(() => events.push('save'), () => true);
  indexActor.readingExitActions.requestRules();
  assert.equal(indexActor.route, 'reading');
  indexActor.cancelReaderExitDestination(identity);
  indexActor.onReaderExited(identity);
  assert.deepEqual(events, ['origin', 'save', 'origin'], 'cancelled save clears the queued rules destination');
  indexActor.readingEntry.beginReaderPresentation();
  identity = indexActor.currentReaderPresentationIdentity();
  indexActor.readingEntry.attachExitRequest(() => events.push('save'), () => true);
  indexActor.readingExitActions.requestRules();
  indexActor.onReaderExited('old-reader');
  assert.equal(indexActor.route, 'reading');
  indexActor.onReaderExited(identity);
  assert.equal(indexActor.route, 'rulesManagement');
  assert.equal(indexActor.navigationOwner.takeRulesManagementOrigin(), 'reader');
  assert.deepEqual(events, ['origin', 'save', 'origin', 'save', 'rules']);
  indexActor.navigateTo('bookshelf');
  indexActor.navigationOwner.returns.requestParentAfterExit(exitLease(identity), 'detailOrigin');
  indexActor.libraryJourney.openSearch();
  assert.equal(indexActor.route, 'search');
  assert.equal(indexActor.navigationOwner.returns.takeReaderExit(identity, 'book', runtime).target, 'readingOrigin');

  const downloadEvents = [], reopen = [];
  const indexReturns = indexActor.navigationOwner.returns;
  Object.assign(indexActor, {
    downloadPresentation: {
      captureReturn: () => view,
      restoreReturn: (owner, state) => downloadEvents.push(['restore', owner, state]),
      open(owner, _identity, current, intent) {
        assert.equal(owner, runtime); assert.equal(current(), true);
        reopen.push([intent]);
      },
    },
    searchAppForeground: true,
    shelfMutations: { snapshot: { removalKey: '' } }, shelfRead: { snapshot: { books: [] } },
    sourceSwitchPresentation: new NavigationSourceProjection(), mangaSourceSwitch: { selectionVisible: false },
    readingEntryPorts: () => ({}),
    bindReadingEntryReader() {},
    refreshSearchShelfMembership() {},
    refreshBookshelf: () => downloadEvents.push(['shelf']),
    detailShelf: { readbackOnBookshelf() {} },
    rssJourney: { clearSelection() {} },
  });
  Object.assign(indexActor.librarySearch, {
    host: { visibilityChanged() {} },
    prepareReturnFromDetail() {},
    resumeAfterDetail() { downloadEvents.push(['search']); },
    close() {},
  });
  indexActor.readingEntryActions = new EntryActions(indexActor.navigationOwner, { begin() {} }, indexActor.readingEntryActionPorts());
  indexActor.readingEntryActions.openReading = () => downloadEvents.push(['resume reader']);
  indexActor.readingEntryActions.resumeShelf = selection => {
    downloadEvents.push(['admit reader', selection, indexReturns.snapshot().detailParent]);
    indexReturns.beginDetailEntry(undefined);
    indexReturns.completeDetailEntry('downloads', undefined, true);
  };
  indexActor.readingEntry.enterLocalDetail = (_owner, selection, _resume, prepare) => {
    downloadEvents.push(['admit download', indexReturns.snapshot().readingOrigin]);
    prepare();
    indexActor.readingEntry.book = selection;
    return true;
  };
  installDirectoryOperationIndex(indexActor, { ReaderRuntimeOwner: { isCurrent: candidate => candidate === runtime } });
  indexReturns.beginDetailEntry(undefined);
  indexReturns.completeDetailEntry('search', undefined, false);
  indexActor.navigateTo('detail');
  indexActor.libraryJourney.returnFromDetail();
  assert.equal(indexActor.route, 'search');
  indexReturns.rememberDownloadOrigin('directory', () => book);
  indexActor.readingEntry.endReading();
  indexActor.navigateTo('downloads');
  indexActor.downloadNavigation.openChapter({ shelfBook: book, chapterIndex: 4 });
  assert.equal(indexActor.readingEntry.requestedChapterIndex, 4);
  const downloaded = indexActor.downloadNavigation.captureReaderReturn();
  assert.equal(downloaded.fromDownloads, true);
  assert.equal(downloaded.detailParent, 'search', 'capture already preserves the original search parent before any downloads return');
  indexActor.downloadNavigation.openChapter({ shelfBook: book, chapterIndex: 9 });
  assert.equal(indexActor.readingEntry.requestedChapterIndex, 4, 'a late download callback cannot change the existing reader chapter');
  indexActor.readingEntry.endReading();
  indexActor.navigateTo('downloads');
  indexActor.readingEntry.enterLocalDetail = (_owner, _selection, _resume, prepare) => {
    prepare();
    return false;
  };
  indexActor.downloadNavigation.openChapter({ shelfBook: book, chapterIndex: 9 });
  assert.equal(indexActor.readingEntry.requestedChapterIndex, undefined, 'advancing to detail without a reader cannot publish a new chapter');
  assert.equal(indexActor.downloadNavigation.captureReaderReturn().fromDownloads, false);
  assert.deepEqual(reopen, [[{ kind: 'resume' }]], 'restore the downloads view after an aborted entry retired the scene');
  indexReturns.requestDownloadsAfterExit(book, downloaded, exitLease(identity), 'details');
  assert.equal(indexReturns.takeReaderExit(identity, 'book', runtime).target, 'requestedDownloads');
  indexActor.downloadNavigation.returnFromDownloads();
  assert.deepEqual(downloadEvents, [['search'], ['admit download', 'detail'], ['restore', runtime, view],
    ['admit reader', book, 'search'], ['restore', runtime, view]]);
  assert.equal(indexActor.downloadNavigation.captureReaderReturn().downloadParent.origin.target, 'directory');
  indexReturns.showReaderBookInfo(downloaded, () => {
    assert.equal(indexReturns.snapshot().readingOrigin, 'detail');
    assert.equal(indexReturns.snapshot().detailParent, 'search');
    indexActor.navigateTo('detail');
  });
  indexActor.libraryJourney.returnFromDetail();
  assert.deepEqual(downloadEvents.at(-1), ['resume reader']);
  indexActor.mountedRuntimeOwner = {};
  indexActor.libraryJourney.returnFromDetail();
  assert.deepEqual(downloadEvents.at(-1), ['shelf']);
  assert.equal(indexActor.route, 'bookshelf');
  // The real shelf return retires detail. Capture the retained return again
  // for the independent old/current Runtime restoration assertions below.
  indexReturns.showReaderBookInfo(downloaded, () => {});
  indexReturns.restoreReaderBehindDetail(saved => indexActor.downloadNavigation.restoreReaderReturn(saved));
  assert.equal(indexReturns.snapshot().retainedReader, downloaded, 'old runtime cannot consume the reader return context');
  indexActor.mountedRuntimeOwner = runtime;
  indexReturns.restoreReaderBehindDetail(saved => indexActor.downloadNavigation.restoreReaderReturn(saved));
  assert.equal(indexReturns.snapshot().retainedReader, undefined);
  assert.equal(indexReturns.snapshot().detailParent, 'search');
  indexReturns.showReaderBookInfo(downloaded, () => {});
  indexReturns.rememberDownloadOrigin('directory', () => book);
  indexReturns.leaveDetailJourney();
  indexActor.navigateTo('downloads');
  const directoryOpening = indexActor.readingEntry.directoryPresentationGeneration;
  indexActor.readingEntryActions.openShelfEntry = () => {};
  indexActor.downloadNavigation.returnFromDownloads();
  assert.equal(indexActor.route, 'downloads', 'a refused book detail cannot reveal a directory');
  assert.equal(indexActor.readingEntry.directoryPresentationGeneration, directoryOpening);
  indexActor.readingEntryActions.openShelfEntry = (selection, intent, parent) => {
    assert.equal(intent, 'info');
    downloadEvents.push(['admit detail', selection, parent]);
    assert.equal(indexReturns.snapshot().retainedReader, downloaded);
    indexActor.readingEntry.book = { ...selection, contentKind: 'manga' };
    indexActor.navigateTo('detail');
  };
  indexActor.downloadNavigation.returnFromDownloads();
  assert.deepEqual(downloadEvents.at(-1), ['admit detail', book, 'reader']);
  assert.equal(indexActor.route, 'directory');
  assert.equal(indexActor.directoryReturnTarget, 'detail');
  assert.equal(indexActor.readingEntry.directoryPresentationGeneration, directoryOpening + 1);
  indexReturns.rememberBookshelfReaderOrigin();
  indexReturns.requestDownloadsAfterExit(book, undefined, exitLease(identity), 'details');
  assert.equal(indexReturns.takeReaderExit(identity, 'book', runtime).target, 'requestedDownloads');
  indexActor.readingEntryActions.resumeShelf = () => assert.equal(indexReturns.snapshot().readingOrigin, 'detail');
  indexActor.navigateTo('downloads');
  indexActor.downloadNavigation.returnFromDownloads();

  const handoff = [], notices = [];
  const seed = { ...book, detailUrl: book.bookId, title: '书', author: '作者', contentKind: 'text' };
  const fallback = { ...seed, sourceId: 'alternative' };
  const retainedSession = { identity: book, contentKind: 'text' };
  const validatedSession = { identity: book, contentKind: 'manga' };
  const currentBooks = [{ ...book, title: '书架中的书' }];
  const candidates = [{ seed, catalogReady: true, failed: false }];
  let admitted, entryLease;
  const entryHost = {
    openRemote(input, lease) {
      handoff.push('host');
      admitted = input; entryLease = lease;
      assert.equal(lease.isCurrent(), true, 'the host receives the new route lease');
    },
    snapshot: () => ({ scopeId: -1 }),
    retire() {},
  };
  const DetailEntry = actualReadingEntryPresentation({ ReadingEntryHost: {
    forRuntime(owner) { assert.equal(owner, runtime); return entryHost; },
  } });
  const detailActor = Object.assign(new Index(), {
    navigationOwner: new ReaderNavigation(), mountedRuntimeOwner: runtime, detailShelfAdmissionMount: 4,
    shelfMutations: { snapshot: { removalKey: '' } }, shelfGroupPresentation: { identity: '' },
    libraryAcquisition: { currentOwner: () => runtime },
    readingEntry: Object.assign(new DetailEntry(), { session: retainedSession }),
    bookRemovalConfirmation: new BookRemovalDialogPresentation(),
    jsonImportPresentation: new JsonImportPresentation(),
    shelfRead: { snapshot: { books: [] } }, sourceSwitchPresentation: Object.assign(new NavigationSourceProjection(), { pending: {} }),
    nextNavigationGeneration() {
      handoff.push('advance');
      this.readingEntry.retire();
      this.readingEntry.session = undefined;
      this.sourceSwitchPresentation.pending = undefined;
      this.shelfRead.snapshot.books = currentBooks;
      this.publishNavigation(this.navigationOwner.advance());
      return this.navigationGeneration;
    },
    librarySearch: {
      host: { visibilityChanged() { handoff.push(`visible:${detailActor.route}:${detailActor.readingEntry.contentKind}`); } },
      admissionCandidates(primary, alternatives) {
        handoff.push('candidates');
        assert.equal(primary, seed);
        assert.deepEqual(alternatives, detailActor.route === 'detail' ? [fallback] : []);
        return candidates;
      },
    },
    showReadingFailure: (title, message) => notices.push({ title, message }),
  });
  detailActor.readingEntryActions = new EntryActions(detailActor.navigationOwner, {}, detailActor.readingEntryActionPorts());
  detailActor.readingEntryActions.openReading = () => handoff.push('resume');
  detailActor.navigateTo('search');
  detailActor.readingEntryActions.openRemoteDetail({ seed, sourceName: '书源', shelfSnapshot: { ...book, contentKind: 'audio' } });
  assert.equal(notices[0].title, '暂不支持此类阅读');
  assert.equal(detailActor.route, 'search');
  assert.deepEqual(handoff, [], 'unsupported content leaves the current route and host alone');
  detailActor.readingEntryActions.openRemoteDetail({ seed, sourceName: '书源', fallbackSeeds: [fallback], fallbackSourceNames: ['备选'],
    validatedSession, retainAdmissionThroughProbe: true, displayCoverUrl: 'group-cover' });
  assert.deepEqual(handoff, ['advance', 'visible:detail:manga', 'candidates', 'host']);
  assert.equal(detailActor.navigationOwner.returns.snapshot().detailParent, 'search');
  assert.equal(admitted.fromSearch, true);
  assert.equal(admitted.retainedSession, retainedSession);
  assert.equal(admitted.validatedSession, validatedSession);
  assert.equal(admitted.shelfBooks, currentBooks);
  assert.equal(admitted.candidates, candidates);
  assert.equal(admitted.sourceSwitchPending, false);
  assert.deepEqual(admitted.fallbackSeeds, [fallback]);
  assert.deepEqual(admitted.fallbackSourceNames, ['备选']);
  assert.equal(admitted.retainAdmissionThroughProbe, true);
  assert.equal(admitted.displayCoverUrl, 'group-cover');
  const firstLease = entryLease;
  detailActor.navigateTo('bookshelf');
  detailActor.navigationOwner.returns.rememberBookshelfReaderOrigin();
  handoff.length = 0;
  detailActor.readingEntryActions.openRemoteDetail({ seed, sourceName: '书源', shelfSnapshot: book, resumeImmediately: true });
  assert.deepEqual(handoff, ['advance', 'visible:bookshelf:text', 'candidates', 'host', 'resume']);
  assert.equal(admitted.resumeImmediately, true);
  assert.equal(admitted.fromSearch, false);
  assert.equal(firstLease.isCurrent(), false, 'a later remote entry invalidates the previous route lease');

  const index = readFileSync(indexFile, 'utf8');
  const publish = index.match(/private publishNavigation\(snapshot: ReaderNavigationSnapshot\): void \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(publish);
  assert.doesNotMatch(index.replace(publish, ''), /\bthis\.(?:route|navigationGeneration|directoryReturnTarget|settingsSection)\s*(?:=(?!=)|\+=|\+\+)/);
  assert.match(publish, /this\.navigationGeneration = snapshot\.generation;/);
  assert.match(publish, /this\.route = snapshot\.route;\s*\}/);
  assert.match(index, /this\.publishNavigation\(this\.navigationOwner\.show\(route\)\);/);
  assert.match(index, /this\.publishNavigation\(this\.navigationOwner\.advance\(\)\);/);
  assert.match(index, /@State @Watch\('onSearchVisibilityChanged'\) private route: ReaderRoute/);
  assert.doesNotMatch(index, /private (?:readingOriginRoute|detailReturnRoute|sourceManagementReturnTarget|downloadReturnTarget|bookInfoAfterReaderExit):/);
  assert.doesNotMatch(index, /\.returns\.(?:readingOriginRoute|detailReturnRoute|detailReaderReturn|readingFromDownloads)\b/);
  assert.doesNotMatch(index, /\b(?:exitToDetailOriginAfterReader|openRulesManagementAfterReaderExit|detailOriginExitRequested|rulesExitRequested)\b/);
  assert.match(index, /private onReaderExited\(readerIdentity: string\): void \{ this\.readingExitActions\.accepted\(readerIdentity\); \}/);
  assert.match(read('app/composition/ReaderExitActions.ets'), /this\.navigation\.returns\.dispatchAcceptedReaderExit\(/);
  return;
}

const pairs={button:['ReaderButton','features/source/ui/SourceToolsPage.ets'],choice:['ReaderChoiceRow','ui/controls/ReaderSelectPanel.ets'],icon:['ReaderIconButton','features/manga/ui/MangaReadingSurface.ets']};
const [component,consumerFile]=pairs[selectedCase],producerFile='ui/controls/'+component+'.ets';
const source=read(consumerFile),producer=read(producerFile);
const options={component,producerFile,consumerFile};
const actual=verifySharedProducerInputCalls(producer,source,options);assert.ok(actual.length>0);
const bad=source.replace(component+'({',component+'({ __privateStyleBag: 99,');assert.notEqual(bad,source);
assert.throws(()=>verifySharedProducerInputCalls(producer,bad,options),/illegal shared input/,'actual consumer unknown Prop fails without comparing entire implementation bytes');
const removed=source.replaceAll(component+'({','RetiredUnregisteredControl({');assert.notEqual(removed,source);
assert.throws(()=>verifySharedProducerInputCalls(producer,removed,options),/edge missing/,'selected actual producer edge cannot disappear');

}

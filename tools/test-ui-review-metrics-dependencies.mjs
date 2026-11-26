import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'rss-header-width': 'Actual retained RSS PageBackBar parameter observer updates measured width for metrics and UI configuration delivery; original42 metrics cases are separate.',
  'retained-native-consumers': 'Exact installed-SDK native observer closures consume current metrics on the same retained node. Includes removed-dependency controls for the R19 family.',
  'search-sheet-metrics': 'Retained Search sheet width and shared frame shadow follow live window metrics.',
});
if (selected.length === 0) process.exit(0);

const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { readerFoundationTokens } = await import('./lib/reader-tokens-probe.mjs');
const headerMetrics = await import('../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const metricsPolicy = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const surfaceGeometry = await import('../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts');
const selectGeometry = await import('../entry/src/main/ets/ui/foundation/ReaderSelectGeometry.ts');
const novel = await import('../entry/src/main/ets/features/source/ui/SourceSwitchNovelPresentation.ts');
const { SOURCE_SWITCH_VISUAL } = await import('../entry/src/main/ets/features/source/ui/SourceSwitchVisual.ts');
const { SEARCH_RESULT_GEOMETRY } = await import('../entry/src/main/ets/features/search/ui/SearchResultGeometry.ts');
const importLayout = await import('../entry/src/main/ets/features/bookshelf/ui/LocalImportLayout.ts');
const chromeGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderPageChromeLayout.ts');
const controlMotion = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts');
const { ReaderControlGeometry } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts');
const readingGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts');
const directoryVisual = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');

const { root: sdkRoot, ts, options } = installedEtsCompiler();
const require = createRequire(import.meta.url);
const syntax = require(`${sdkRoot}/lib/validate_ui_syntax.js`);
const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const surfaceResolvers = pureModuleProbe(read('ui/foundation/ReaderSurfaceResolvers.ts'),
  'ReaderSurfaceResolvers.ts', metricsPolicy, ['readerReadableFontScale', 'readerScaledControlHeight', 'readerSurfaceMaxHeight']);
const compact = value => value.replace(/\s/g, '');
const snapshot = value => value === undefined ? undefined :
  typeof value === 'function' ? '[callback]' : JSON.parse(JSON.stringify(value));

function sourceTree(source) {
  const tree = ts.createSourceFile('MetricsConsumer.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  return tree;
}

// Select the original Builder containing the affected expression. The full
// unchanged Builder enters SDK lowering. Its exact native observer is then
// executed in isolation, with native calls recorded at their actual call time.
// Parent assembly/child rendering are covered by the separate source audit.
function nativeWitness(spec, source, metrics) {
  const tree = sourceTree(source);
  const sourceMarker = spec.marker.replace(/^(Button|Row|Scroll|Column|Text|Stack|ListItem|__Common__)\./, '.');
  const components = tree.statements.filter(node => node.members && node.name);
  const component = components.find(node => node.members.some(member =>
    member.body && compact(member.getText(tree)).includes(compact(sourceMarker))));
  assert.ok(component, spec.path + ' actual component');
  const builders = component.members.filter(member => member.body &&
    (spec.builder ? member.name?.getText(tree) === spec.builder :
      member.name?.getText(tree) === 'build' || ts.getAllDecorators(member).some(d => d.getText(tree) === '@Builder')) &&
    compact(member.getText(tree)).includes(compact(sourceMarker)));
  assert.equal(builders.length, 1, spec.path + ' exact Builder locator');
  const properties = createArkUIPropertyRuntimeProbe();
  const specs = readerSurfaceSpecsForProbe(metrics);
  const enums = Object.fromEntries(['Color', 'Alignment', 'FlexAlign', 'HorizontalAlign', 'HitTestMode',
    'BarState', 'VerticalAlign', 'TextAlign', 'SheetSize', 'SheetType', 'DismissReason', 'AccessibilityRoleType', 'ButtonType', 'LayoutPolicy']
    .map(name => [name, new Proxy({}, { get: (_target, key) => `${name}.${String(key)}` })]));
  const headerSpecs = pureModuleProbe(read('ui/foundation/ReaderHeaderSpecs.ets'), 'ReaderHeaderSpecs.ets',
    { ...readerFoundationTokens, ...headerMetrics }, ['bookshelfHeaderSpec']);
  const dependencies = { ...properties.sdk, ...headerSpecs, ...readerFoundationTokens, ...metricsPolicy, ...surfaceGeometry, ...surfaceResolvers,
    ...selectGeometry, ...novel, ...importLayout, ...readingGeometry, ...controlMotion, ...chromeGeometry, ReaderControlGeometry, ...readerTypographyRoles, ...specs, ...enums,
    ReaderWindowCoordinator: { metrics: () => structuredClone(metrics) }, readerWindowMetrics: () => structuredClone(metrics),
    PathShape: class { commands(path) { return { path }; } },
    readerPageChromeTopTextStyle: () => readerTypographyRoles.TYPE_READER_IMMERSIVE_TIME,
    measureReaderPageChromeText: () => { throw new Error('this retained geometry scene has no visible status text lane'); },
    visual: directoryVisual.MANGA_DIRECTORY_VISUAL, SOURCE_SWITCH_VISUAL, SEARCH_RESULT_GEOMETRY,
    TRIGGER_H: 44, APPEARANCE_HIT_OUTSET: 6,
    readerAppColor: role => role,
    readerMotionAnimateParam: () => ({}), readerMotionReducedFadeParam: () => ({}),
    TransitionEffect: { OPACITY: { animation: () => ({}) } },
    uiContext: { px2vp: value => value / metrics.densityPixels, vp2px: value => value * metrics.densityPixels,
      getMeasureUtils: () => ({
        measureTextSize: () => ({ width: 60 * metrics.systemFontScale * metrics.densityPixels,
          height: 20 * metrics.systemFontScale * metrics.densityPixels }),
        measureText: () => 60 * metrics.systemFontScale * metrics.densityPixels,
      }) },
  };
  if (spec.methods.includes('sessionCapsuleMetrics')) {
    const textMeasurement = pureModuleProbe(read('features/reading/ui/ReaderControlTextMeasurement.ets'),
      'ReaderControlTextMeasurement.ets', { WordBreak: { BREAK_WORD: 'WordBreak.BREAK_WORD' } }, ['measureReaderControlText']);
    const capsule = read('features/reading/ui/ReaderSessionCapsule.ets');
    Object.assign(dependencies, pureModuleProbe(capsule.slice(0, capsule.indexOf('export class ReaderSessionCapsuleFrame')),
      'ReaderSessionCapsuleMeasurement.ets', { ...readerTypographyRoles, ...textMeasurement,
        READER_SESSION_CAPSULE_MIN_TARGET_HEIGHT: chromeGeometry.READER_SESSION_CAPSULE_MIN_TARGET_HEIGHT }, ['measureReaderSessionCapsule']));
  }
  if (spec.path.endsWith('ReaderSelect.ets')) {
    Object.assign(dependencies, pureModuleProbe(source.slice(0, source.indexOf('@Component')),
      'ReaderSelectConstants.ets', readerFoundationTokens, ['TRIGGER_H', 'APPEARANCE_TRIGGER_H',
        'APPEARANCE_VALUE_VERTICAL_SPACE', 'APPEARANCE_HIT_OUTSET', 'CHEVRON_GAP', 'CHEVRON_W', 'CHEVRON_H', 'SELECT_PAD']));
  }
  class ChildPort {
    constructor(parent, params, _storage, id) { Object.assign(this, { parent, params, id, lastDelivery: snapshot(params), updated: 0 }); }
    updateStateVars(params) { this.params = params; this.updated = (this.updated ?? 0) + 1; this.lastDelivery = snapshot(params); }
  }
  // Actual import definitions register the SDK child Prop schema. The child
  // endpoint records payloads only, with no initialRender/lifecycle methods.
  const childSources = {};
  const selectedText = builders[0].getText(tree);
  for (const declaration of tree.statements.filter(ts.isImportDeclaration)) {
    const imports = declaration.importClause?.namedBindings;
    if (!imports || !ts.isNamedImports(imports)) continue;
    for (const binding of imports.elements) {
      const name = binding.name.text;
      if (!new RegExp(`\\b${name}\\s*\\(`).test(selectedText)) continue;
      const url = new URL(declaration.moduleSpecifier.text + '.ets', new URL(spec.path, root));
      if (!existsSync(url)) continue;
      const definition = readFileSync(url, 'utf8');
      const childTree = sourceTree(definition);
      if (!childTree.statements.some(node => node.members && node.name?.text === name &&
        node.members.some(member => member.name?.getText(childTree) === 'build'))) continue;
      childSources[name] = definition;
      const childDeclaration = childTree.statements.find(node => node.members && node.name?.text === name);
      const slots = childDeclaration.members.filter(member => ts.getAllDecorators(member).some(d =>
        d.getText(childTree) === '@BuilderParam')).map(member => member.name.getText(childTree));
      if (slots.length) syntax.builderParamObjectCollection.set(name, new Set(slots));
      dependencies[name] = ChildPort;
    }
  }
  for (const local of components.filter(node => node !== component && node.members.some(member => member.name?.getText(tree) === 'build'))) {
    const name = local.name.getText(tree);
    if (new RegExp(`\\b${name}\\s*\\(`).test(selectedText)) {
      childSources[name] = source; dependencies[name] = ChildPort;
    }
  }
  let active;
  const deliveries = [];
  const hooks = { ...properties.hooks, childSources, mountChildren: false, lifecycleChildren: false, componentName: component.name.getText(tree),
    onObserverEnter(owner, id) { active = { owner, id }; deliveries.push(id); properties.hooks.onObserverEnter(owner, id); },
    onObserverExit() { properties.hooks.onObserverExit(); active = undefined; } };
  const names = [...new Set([builders[0].name.getText(tree), ...spec.methods, ...(spec.actualStorage ? [spec.revision] : []),
    ...(spec.path.endsWith('ReaderLibrarySearchSurface.ets') && builders[0].name.getText(tree) === 'build' ? ['results', 'emptySlot'] : [])])];
  const { owner, output } = createReaderBuilderProbe(source, names, dependencies, hooks);
  Object.assign(owner, spec.params ?? {});
  const revision = spec.actualStorage ? owner[`__${spec.revision}`] :
    new properties.sdk.ObservedPropertySimplePU(0, owner, spec.revision);
  assert.ok(revision, 'actual SDK local revision property');
  if (!spec.actualStorage) Object.defineProperty(owner, spec.revision, { get: () => revision.get(), set: value => revision.set(value) });
  spec.initialize?.(owner, metrics);
  const emitted = ts.createSourceFile('MetricsConsumer.ts', output, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const callbacks = [];
  const resolveCallback = call => {
    const argument = call.arguments[0];
    if (!ts.isIdentifier(argument)) return argument;
    for (let ancestor = call.parent; ancestor; ancestor = ancestor.parent) {
      if (!ts.isBlock(ancestor)) continue;
      const matches = ancestor.statements.filter(ts.isVariableStatement)
        .flatMap(statement => [...statement.declarationList.declarations])
        .filter(declaration => declaration.name.getText(emitted) === argument.text);
      if (matches.length === 1) return matches[0].initializer;
    }
    return argument;
  };
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(emitted).endsWith('.observeComponentCreation2')) {
      const callback = resolveCallback(node);
      if (compact(callback.getText(emitted)).includes(compact(spec.marker)) &&
        (!spec.observerName || callback.getText(emitted).includes(spec.observerName))) callbacks.push(callback);
    }
    ts.forEachChild(node, visit);
  };
  visit(emitted);
  const exactCallbacks = callbacks.filter(node => !callbacks.some(other => other !== node &&
    other.pos > node.pos && other.end < node.end));
  assert.equal(exactCallbacks.length, 1, spec.path + ' exact SDK observer locator');
  const native = name => new Proxy({}, { get: (_target, property) => (...args) => {
    if (property === 'canRetake') return false;
    if (property === 'pop') return;
    assert.ok(active, 'native attribute only during actual SDK observer');
    const record = active.owner.nodes.get(active.id);
    record.type = name;
    record[property] = snapshot(args.length === 1 ? args[0] : args);
    record.calls = (record.calls ?? 0) + 1;
  } });
  const children = Object.fromEntries(['ReaderJourneyRecoveryNotices', 'ReaderPageInteractionLayer',
    'ReaderMangaDownloadPopup', 'ReaderControlDirectoryContent'].map(name => [name, ChildPort]));
  const nativeDependencies = { ...dependencies, ...children, ...(spec.lexical ?? {}),
    PathShape: class { commands(path) { return { path }; } },
    readerPageChromeTopTextStyle: () => readerTypographyRoles.TYPE_READER_IMMERSIVE_TIME,
    measureReaderPageChromeText: () => { throw new Error('this retained geometry scene has no visible status text lane'); },
    deepRenderFunction() { throw new Error('child rendering is outside this finite observer witness'); },
    ...Object.fromEntries(['Column', 'Row', 'Stack', 'Scroll', 'Text', 'Button', 'ListItem', '__Common__'].map(name => [name, native(name)])),
    ViewPU: { create(child) { child.parent.children.set(child.id, child); } },
  };
  const callback = ts.transpileModule(`const callback = ${exactCallbacks[0].getText(emitted)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2021 }, reportDiagnostics: true,
  });
  assert.deepEqual(callback.diagnostics, []);
  const action = new Function(...Object.keys(nativeDependencies), callback.outputText + '\nreturn callback;')
    .call(owner, ...Object.values(nativeDependencies));
  owner.observeComponentCreation2(action, { name: spec.native ?? 'Column' });
  assert.equal(owner.observers.length, 1, 'only the exact SDK observer is mounted');
  const nativeRecord = owner.nodes.get(0);
  return { owner, properties, revision, nativeRecord, deliveries,
    callbackSha256: createHash('sha256').update(exactCallbacks[0].getText(emitted)).digest('hex'), value: () => spec.value(owner, nativeRecord),
    publish() { revision.set(revision.getUnmonitored() + 1); properties.flush(); } };
}

const consumers = [
  { path: 'ui/controls/ReaderSelect.ets', builder: 'phoneTrigger', marker: 'Button.height(this.triggerHeight())',
    methods: ['triggerHeight', 'measuredValueHeight', 'isSettingsVariant', 'triggerEnabled'],
    revision: 'readerWindowMetricsRevision', params: { variant: 'settingsPhone', value: '正文', mounted: true,
      actionEnabled: true, focusId: '', isOpen: false }, native: 'Button', change: m => { m.systemFontScale = 2; },
    value: (_owner, n) => [n.height, n.responseRegion] },
  { path: 'ui/controls/ReaderSearchField.ets', builder: 'passiveField', marker: 'Row.height(this.fieldHeight())',
    methods: ['fieldHeight', 'cornerRadius', 'directoryFontScale', 'nativeFieldBackground'], revision: 'readerWindowMetricsRevision',
    params: { variant: 'rssPassive', iconGap: () => 8, horizontalPadding: () => 16,
      fieldWidthVp: 300, fieldBackgroundColor: () => '#ffffff', fieldBorderWidth: () => 1,
      fieldBorderColor: () => '#dddddd', resolvedAccessibilityLabel: () => 'RSS搜索' }, native: 'Row', change: m => { m.systemFontScale = 2; },
    value: (_owner, n) => [n.height, n.borderRadius] },
  { path: 'features/bookshelf/ui/BookshelfShell.ets', marker: 'this.moreSheetOptions()',
    methods: ['moreSheetWidth', 'moreSheetOptions', 'moreSheetSpec'], revision: 'readerWindowMetricsRevision',
    params: { appThemeScheme: 'day', moreSheetCurrentId: 'current', moreMenuVisible: true, moreSheetContent() {} }, native: 'Stack',
    change: m => { m.windowRect.width = 320; }, value: (_owner, n) => n.bindSheet[2].width },
  { path: 'features/bookshelf/ui/BookshelfMultiSelectPage.ets', marker: 'bottom: this.bottomInset()',
    methods: ['bottomInset'], revision: 'readerWindowMetricsRevision', params: { appThemeScheme: 'day' },
    change: m => { m.navigationInsets.bottom = 36; }, value: (_owner, n) => n.padding.bottom },
  { path: 'features/bookshelf/ui/LocalImportDialog.ets', marker: 'Scroll.height(this.selectionPanelHeight())',
    methods: ['selectionPanelHeight', 'availableHeight'], revision: 'readerWindowMetricsRevision',
    params: { viewportHeight: 852 }, native: 'Scroll', change: m => { m.systemFontScale = 2; },
    value: (_owner, n) => n.height },
  { path: 'ui/surfaces/ReaderBottomSheet.ets', builder: 'frame', marker: '.shadow(this.frameShadow())',
    methods: ['spec', 'frameMaxHeight', 'safeBottom', 'safeCenterOffset', 'frameShadow', 'content', 'emptyContent'], revision: 'metricsRevision',
    params: { scheme: 'day', specId: 'search-result-filter', surfaceWidth: 350, reduceMotion: true, content() {} },
    native: 'Column', change: m => { m.densityPixels = 2; }, value: (_owner, n) => n.shadow },
  { path: 'features/search/ui/SearchPage.ets', builder: 'resultSheets',
    marker: "surfaceWidth: this.resultSheetWidth('search-result-filter')", observerName: 'ReaderBottomSheet',
    methods: ['resultSheetWidth'], revision: 'readerWindowMetricsRevision',
    lexical: { identity: 'filter' },
    params: { appThemeScheme: 'day', filtersExpanded: true, openPanelAction() {},
      dismissPanelAction() {}, closePanelAction() {}, filterSheetContent() {} },
    change: m => { m.windowRect.width = 320; }, value: owner => owner.children.get(0).lastDelivery.surfaceWidth,
    expected: () => 320 },
  { path: 'features/search/ui/ReaderLibrarySearchSurface.ets', marker: 'this.headerStackShadow()',
    methods: ['headerStackShadow'], revision: 'metricsRevision',
    params: { scheme: 'day', headerVeil: () => false, historyProgress: () => 1 }, native: 'Stack',
    change: m => { m.densityPixels = 2; }, value: (_owner, n) => n.shadow },
  { path: 'features/source/ui/SourceSwitchWindow.ets', builder: 'novelHeading', marker: 'Row.height(this.headingHeight())',
    methods: ['novelFontScale', 'headingHeight'], revision: 'readerWindowMetricsRevision', native: 'Row',
    change: m => { m.systemFontScale = 2; }, value: (_owner, n) => n.height },
  { path: 'pages/ReaderStartupRecovery.ets', marker: 'minHeight: this.availableHeight()',
    methods: ['availableHeight'], revision: 'windowMetricsRevision', change: m => { m.windowRect.height = 620; },
    value: (_owner, n) => n.constraintSize.minHeight },
  { path: 'pages/Index.ets', marker: 'topInset: this.messageSafeTop()', methods: ['messageSafeTop'],
    revision: 'readerWindowMetricsRevision', params: { readerOwnsWindowEdges: () => true,
      bookshelfContentAcceptsInput: () => true, journeyRecoveryInputAllowed: () => true,
      canPresentMangaRecovery: () => false, sourceSwitchPresentation: {}, },
    lexical: { readerLegacySnapshotRecoveryView: () => ({}) },
    change: m => { m.systemInsets.top = 48; }, value: owner => owner.children.get(0).lastDelivery.topInset },
  { path: 'app/composition/ReaderLayoutDebugOverlay.ets', marker: 'y: this.contentTop()',
    methods: ['statusTop', 'statusHeight', 'contentTop'], revision: 'metricsRevision', native: 'Row',
    change: m => { m.statusBarHeight = 48; }, value: (_owner, n) => n.position.y },
  { path: 'pages/ReaderDirectoryStructureFixture.ets', builder: 'controlContent', marker: 'y: this.controlTop()',
    methods: ['controlLayout', 'controlFrame', 'controlHeight', 'controlLeft', 'controlTop'],
    revision: 'windowMetricsRevision', params: { actualWidth: 393, actualHeight: 852, controlExpanded: true,
      requestedControlHeight: () => 0 }, native: '__Common__',
    change: m => { m.systemInsets.right = 55; }, value: (_owner, n) => [n.width, n.height, n.position] },
  { path: 'pages/ReaderPageStructureVerification.ets', marker: 'this.systemFontScale()',
    methods: ['systemFontScale'], revision: 'windowMetricsRevision', native: 'Text',
    params: { requestedWidth: 393, actualWidth: 393, actualHeight: 852 },
    change: m => { m.systemFontScale = 2; }, value: (_owner, n) => n.create },
  { path: 'features/reading/ui/LocalReadingExperience.ets', marker: 'systemGestureLeftInset: this.readerSystemGestureLeftInset()',
    methods: ['readerSystemGestureLeftInset', 'readerSystemGestureRightInset', 'readerSystemGestureBottomInset', 'finiteWindowInset'],
    revision: 'readerWindowMetricsRevision', params: { phase: 'ready', sourceSwitchFailureMessage: '',
      readerSettingsSnapshot: { navigationMode: 'paged' }, isReaderPageInteractionEnabled: () => true,
      pageTurnTapOnlyInput: () => false, readerTextSelectionEnabled: () => false },
    change: m => { m.gestureInsets.left = 22; m.gestureInsets.right = 23; m.gestureInsets.bottom = 35; },
    value: owner => { const p = owner.children.get(0).lastDelivery; return [p.systemGestureLeftInset, p.systemGestureRightInset, p.systemGestureBottomInset]; } },
  { path: 'features/reading/ui/BookDirectoryPage.ets', marker: 'availableWidth: this.contentFrame().width',
    methods: ['contentFrame'], revision: 'readerWindowMetricsRevision', lexical: { identity: 'directory' },
    params: { viewportWidth: 260, temporaryBackIdentity: 'current', directoryInputIsCurrent: () => true }, change: m => { m.gestureInsets.left = 55; },
    value: owner => owner.children.get(0).lastDelivery.availableWidth },
];


// Independent native elements in the same file retain separate observer ids.
// Exercise every material group instead of inferring sibling updates.
const selectBase = consumers[0];
for (const variant of ['default', 'sourceGroup', 'settingsTablet']) {
  consumers.push({ ...selectBase, params: { ...selectBase.params, variant, options: ['正文', '其他'] } });
}
const libraryPath = 'features/search/ui/ReaderLibrarySearchSurface.ets';
const libraryParams = { mode: 'results', surfaceWindowY: 0, headerBottom: 96,
  model: { sourceRecoveryVisible: false }, resultsProgress: () => 1, inputInteractive: () => true,
  expandedLayout: false, spec: { outerInset: () => 12 } };
consumers.push(
  { path: 'features/bookshelf/ui/LocalImportDialog.ets', builder: 'resultBody',
    marker: 'Scroll.height(Math.max(0, this.resultPanelHeight() - this.measuredFooterHeight))',
    methods: ['resultPanelHeight', 'resultLayout', 'availableHeight'], revision: 'readerWindowMetricsRevision',
    params: { viewportHeight: 852, measuredHeaderHeight: 400, measuredSummaryHeight: 400,
      measuredFooterHeight: 44, measuredItemsHeight: 600 }, native: 'Scroll',
    change: m => { m.navigationInsets.bottom = 80; }, value: (_owner, n) => n.height,
    expected: m => 852 - 80 - 40 - 44 },
  { path: libraryPath, marker: 'Column.height(this.surfaceHeight())', methods: ['surfaceHeight'],
    revision: 'metricsRevision', params: libraryParams, change: m => { m.windowRect.height = 620; },
    value: (_owner, n) => n.height, expected: m => m.windowRect.height },
  { path: libraryPath, marker: 'Stack.clipShape(this.resultClip())',
    methods: ['surfaceHeight', 'contentHeight', 'resultClip'], revision: 'metricsRevision', params: libraryParams,
    native: 'Stack', change: m => { m.windowRect.height = 620; m.windowRect.width = 320; },
    value: (_owner, n) => [n.height, n.clipShape.path],
    expected: m => [m.windowRect.height, `M0 96 H${m.windowRect.width} V${m.windowRect.height} H0 Z`] },
  { path: libraryPath, marker: 'left: this.horizontalInset(true)', methods: ['horizontalInset'],
    revision: 'metricsRevision', params: libraryParams, change: m => { m.gestureInsets.left = 55; },
    value: (_owner, n) => n.padding, expected: () => ({ left: 55, right: 12 }) },
);
for (const [builder, marker, methods, value, expected] of [
  ['candidateList', 'ListItem.height(this.rowHeight())', ['rowHeight'], (_owner, n) => n.height, m => novel.sourceSwitchNovelRowHeight(m.systemFontScale)],
  ['candidateList', 'ListItem.height(this.headingHeight())', ['headingHeight'], (_owner, n) => n.height, m => novel.sourceSwitchNovelHeadingHeight(m.systemFontScale)],
  ['candidateList', 'ListItem.height(this.columnsHeight())', ['columnsHeight'], (_owner, n) => n.height, m => novel.sourceSwitchNovelColumnHeight(m.systemFontScale, false)],
  ['candidateList', 'ListItem.height(this.footerHeight())', ['footerHeight'], (_owner, n) => n.height, m => novel.sourceSwitchNovelFooterHeight(m.systemFontScale, false)],
  ['novelColumns', 'Row.height(this.columnsHeight())', ['columnsHeight'], (_owner, n) => n.height, m => novel.sourceSwitchNovelColumnHeight(m.systemFontScale, false)],
  ['novelFooter', 'Text.height(this.footerHeight())', ['footerHeight'], (_owner, n) => n.height, m => novel.sourceSwitchNovelFooterHeight(m.systemFontScale, false)],
]) {
  consumers.push({ path: 'features/source/ui/SourceSwitchWindow.ets', builder, marker,
    methods: ['novelFontScale', ...methods], revision: 'readerWindowMetricsRevision',
    params: { compactWindow: () => false, appThemeScheme: 'day' },
    change: m => { m.systemFontScale = 2; }, value, expected });
}


for (const [variant, builder, native] of [
  ['default', 'defaultTrigger', 'Row'], ['sourceGroup', 'sourceGroupTrigger', 'Stack'],
  ['settingsPhone', 'settingsPhoneTrigger', 'Row'], ['settingsTablet', 'settingsTrigger', 'Row'],
]) {
  consumers.push({ ...selectBase, builder, marker: `${native}.height(this.triggerHeight())`,
    params: { ...selectBase.params, variant }, value: (_owner, n) => n.height,
    expected: m => Math.max(44, 20 * m.systemFontScale + (variant === 'default' ? 16 : variant === 'sourceGroup' ? 20 : 18)) });
}

const layoutProjection = layout => [layout.pageChromeVisualSafeLeft, layout.pageChromeVisualSafeRight,
  layout.pageChromeInteractiveSafeRight, layout.pageChromeInteractiveSafeBottom];
const readingParams = { mounted: true, controlMinimumGeneration: 0, readerWindowMetricsRevision: 0,
  pageTurnInputRevision: 7, pageTurnReadinessRevision: 3, pageTurnRenderRevision: 1,
  readerSettingsSnapshot: { navigationMode: 'paged', extendIntoCutout: false, hideStatusBar: false },
  effectiveViewportWidth: () => 393, effectiveViewportHeight: () => 852,
  sessionCapsuleMetrics: () => ({ targetHeight: 44 }), bookTitle: '', pageChromeClockText: '',
  visibleReadingAppearance: () => ({}), autoPageHighlightStart: () => 0, autoPageHighlightEnd: () => 0,
  sourceSwitchContinuousRangeObserver: () => () => {}, isReaderPageInteractionEnabled: () => true,
  readerTextSelectionEnabled: () => false, pageTurnInputPhase: () => 'idle',
  scheduleControlMinimum() {}, applyWindowChrome() {},
  invalidatePageTurnRuntime() { throw new Error('same body layout must preserve the original page transaction'); },
  rollbackPageTurnForDeferredMutation() { this.rollbackRequests = (this.rollbackRequests ?? 0) + 1; },
};
const readingMethods = ['readingLayout', 'windowMetricsLayoutKey', 'onWindowMetricsRevisionChanged',
  'reflowAfterWindowGeometryChange'];
const retainedLayout = {
  path: 'features/reading/ui/LocalReadingExperience.ets', builder: 'build',
  marker: 'layout: this.readingLayout()', observerName: 'ReaderContinuousReadingStage',
  methods: readingMethods, revision: 'readerWindowMetricsRevision', actualStorage: true,
  params: { ...readingParams, readerSettingsSnapshot: { ...readingParams.readerSettingsSnapshot, navigationMode: 'continuous' },
    hasContinuousRenderContent: () => true }, initialMetrics: m => { m.systemInsets.right = 24; },
  initialize(owner) { owner.lastWindowMetricsLayoutKey = owner.windowMetricsLayoutKey(); },
  change: m => { m.systemInsets.right = 0; m.systemInsets.left = 24; },
  value: owner => layoutProjection(owner.children.get(0).lastDelivery.layout),
  expected: m => layoutProjection(readingGeometry.resolveReaderReadingLayout(393, 852, false, m)),
};
const gestureConsumer = consumers.find(spec => spec.path.endsWith('LocalReadingExperience.ets'));
Object.assign(gestureConsumer, { actualStorage: true, methods: [...gestureConsumer.methods, ...readingMethods],
  params: { ...gestureConsumer.params, ...readingParams },
  initialize(owner) { owner.lastWindowMetricsLayoutKey = owner.windowMetricsLayoutKey(); },
  change: m => { m.gestureInsets.left = 20; m.gestureInsets.right = 21; },
});
const pagedLayout = { ...retainedLayout, observerName: 'ReaderPageTurnStage',
  params: { ...readingParams, usesBookTurnSimulation: () => false, effectivePageTurnStyle: () => 'slide',
    pageTurnStageViewportWidth: () => 393, pageBookmarkFeedbackMode: () => 'none', pageBookmarkFeedbackOpacity: () => 0 } };
consumers.push(retainedLayout, pagedLayout);
for (const frozen of ['pageTurnFrozenLayout', 'pageTurnSettlementLayout']) {
  consumers.push({ ...pagedLayout, allowCaptured: true,
    params: { ...pagedLayout.params, pageTurnInputPhase: () => 'dragging' },
    initialize(owner) {
      const captured = owner.readingLayout();
      owner.lastWindowMetricsLayoutKey = owner.windowMetricsLayoutKey();
      owner[frozen] = captured;
      owner.pageTurnFrozenRevision = owner.pageTurnRenderRevision;
      owner.expectedCaptured = layoutProjection(captured);
    },
    expected: (_metrics, _spec, owner) => owner.expectedCaptured,
  });
}


const debugBase = consumers.find(spec => spec.path.endsWith('ReaderLayoutDebugOverlay.ets'));
consumers.push(
  { ...debugBase, marker: 'y: this.statusTop() }', change: m => { m.statusBarRect.top = 12; },
    expected: () => 12 },
  { ...debugBase, marker: 'y: this.statusTop() + this.statusHeight()', change: m => { m.statusBarHeight = 48; },
    expected: () => 48 },
);
const controlBase = consumers.find(spec => spec.path.endsWith('ReaderDirectoryStructureFixture.ets'));
consumers.push({ ...controlBase, marker: 'availableWidth: this.controlFrame().content.width',
  params: { ...controlBase.params, openingIdentity: () => 'same', identity: () => ({ sourceId: 'source', bookId: 'book' }),
    memoryRecovery: () => ({}), entries: [], currentChapterIndex: 0, controlTab: 'directory' },
  lexical: { presentation: 1 }, value: owner => {
    const p = owner.children.get(0).lastDelivery; return [p.availableWidth, p.availableHeight];
  }, expected: m => expectedByPath['pages/ReaderDirectoryStructureFixture.ets'](m).slice(0, 2) });
const capsuleParams = { ...readingParams, sessionCapsuleMetrics: undefined,
  activeSessionCapsuleWidth: () => 96, activeSessionCapsuleHeight: () => 44 };
delete capsuleParams.sessionCapsuleMetrics;
consumers.push({ ...retainedLayout, actualStorage: false, marker: 'y: this.sessionCapsuleLayout().sessionY',
  observerName: undefined, methods: ['readingLayout', 'sessionCapsuleLayout', 'sessionCapsuleMetrics'],
  params: capsuleParams, initialize: undefined, initialMetrics: m => { m.systemInsets.right = 80; },
  change: m => { m.systemInsets.right = 0; m.systemInsets.left = 42; },
  value: (_owner, n) => n.position,
  expected: m => {
    const layout = readingGeometry.resolveReaderReadingLayout(393, 852, false, m);
    const result = chromeGeometry.resolveReaderPageChromeLayout(layout,
      new chromeGeometry.ReaderPageChromeMeasurements(0, 0, 0, 0, 0, 0, 0, 0, true, 96, 44));
    return { x: result.sessionX, y: result.sessionY };
  },
});
consumers.push({ ...retainedLayout, actualStorage: false, observerName: 'ReaderSessionCapsule',
  marker: 'measurementIdentity: this.sessionCapsuleMeasurementIdentity(this.sessionCapsuleType())',
  methods: ['readingLayout', 'sessionCapsuleMeasurementIdentity', 'sessionLaunchLayoutKey'],
  initialize: undefined, params: { ...readingParams, sessionCapsuleType: () => 'autoPage',
    sessionCapsuleState: () => 'running', sessionCapsuleCountdown: () => 8,
    automaticReadingState: () => ({ generation: 1 }), ttsState: { sessionGeneration: 1 },
    lifecycleToken: 1, sourceId: 'local', bookId: 'book', viewportWidth: 393, viewportHeight: 852,
    paginationLayoutSignature: () => 'same', readerAppScheme: 'day', appearanceSnapshot: { activeTheme: 'day' },
    appearanceMutationGeneration: 0 },
  value: owner => { const p = owner.children.get(0).lastDelivery; return [p.fontScale, p.measurementIdentity]; },
  expected: m => [1, JSON.stringify(['autoPage', 1, `1|local|book|393|852|same|day|day|${m.revision}`, 0])],
});

const expectedByPath = {
  'ui/controls/ReaderSelect.ets': (m, spec) => {
    const variant = spec.params.variant;
    const height = Math.max(44, 20 * m.systemFontScale + (variant === 'default' ? 16 : variant === 'sourceGroup' ? 20 : 18));
    return [height, { x: 0, y: 0, width: '100%', height }];
  },
  'ui/controls/ReaderSearchField.ets': m => {
    const type = readerTypographyRoles.TYPE_SEARCH_RSS_HINT;
    const height = surfaceResolvers.readerScaledControlHeight(44, type.lineHeightFp ?? type.fontSizeFp * 1.5, m.systemFontScale);
    return [height, Math.min(300, height) / 2];
  },
  'features/bookshelf/ui/BookshelfShell.ets': m => Math.min(390, m.windowRect.width),
  'features/bookshelf/ui/BookshelfMultiSelectPage.ets': m => Math.max(12, metricsPolicy.readerInteractiveSafeBottom(m)),
  'features/bookshelf/ui/LocalImportDialog.ets': m => Math.min(852 - 40, 399.75 * m.systemFontScale),
  'ui/surfaces/ReaderBottomSheet.ets': m => readerSurfaceSpecsForProbe(m).readerSurfaceElevation('sheet', 'day'),
  [libraryPath]: m => readerSurfaceSpecsForProbe(m).readerSurfaceElevation('popover', 'day'),
  'features/source/ui/SourceSwitchWindow.ets': m => novel.sourceSwitchNovelHeadingHeight(m.systemFontScale),
  'pages/ReaderStartupRecovery.ets': m => m.windowRect.height - m.systemInsets.top - m.systemInsets.bottom,
  'pages/Index.ets': m => metricsPolicy.readerContentSafeTop(m),
  'app/composition/ReaderLayoutDebugOverlay.ets': m => Math.max(m.systemInsets.top,
    m.statusBarRect.top + Math.max(m.statusBarRect.height, m.statusBarHeight) + 8),
  'pages/ReaderDirectoryStructureFixture.ets': m => {
    const layout = readingGeometry.resolveReaderControlLayout(393, 852, false, m);
    const fullHeight = Math.min(layout.fullPanelHeight, 736);
    const frame = controlMotion.sampleReaderControlMotionComposition({ visibilityProgress: 1, expansionProgress: 1 },
      controlMotion.readerControlMotionBounds(layout.fullPanelWidth, fullHeight, layout.dockBottomGap,
        Math.min(fullHeight, new ReaderControlGeometry(false).sheetH), layout.contentBudget));
    return [frame.content.width, frame.content.height, { x: 393 - layout.fullPanelRightGap - layout.fullPanelWidth + frame.content.x,
      y: layout.viewportHeight - layout.dockBottomGap - frame.shell.height + frame.content.y - frame.shell.y }];
  },
  'pages/ReaderPageStructureVerification.ets': m => `外层请求 393vp；上次实测 393×852vp；系统字号 ${m.systemFontScale}`,
  'features/reading/ui/LocalReadingExperience.ets': m => [Math.max(16, m.gestureInsets.left, m.navigationInsets.left),
    Math.max(16, m.gestureInsets.right, m.navigationInsets.right), Math.max(24, m.gestureInsets.bottom, m.navigationInsets.bottom)],
  'features/reading/ui/BookDirectoryPage.ets': m => surfaceGeometry.resolveHorizontalFrame(260,
    metricsPolicy.readerInteractiveSafeLeft(m), metricsPolicy.readerInteractiveSafeRight(m),
    new surfaceGeometry.SurfaceWidthSpec(directoryVisual.MANGA_DIRECTORY_VISUAL.contentWidthMax, 18, 18, 'center')).width,
};

function assertFinite(value) {
  assert.notEqual(value, undefined, 'target native projection is defined');
  assert.notEqual(value, null, 'target native projection contains valid finite values before JSON conversion');
  if (typeof value === 'number') assert.ok(Number.isFinite(value), 'native projection contains finite numbers');
  if (value !== null && typeof value === 'object') for (const child of Object.values(value)) assertFinite(child);
}


const rssHeaderConsumers = ['readerWindowMetricsRevision', 'uiConfigurationRevision'].map(revision => ({
  path: 'features/rss/ui/RssSubscriptionManagementPage.ets', builder: 'backBar',
  marker: 'trailingWidthVp: this.addActionWidth()', methods: ['addActionWidth'], revision,
  params: { readerWindowMetricsRevision: 0, uiConfigurationRevision: 0, appThemeScheme: 'day' },
  change: metrics => { metrics.systemFontScale = 2; },
  value: owner => owner.children.get(0).lastDelivery.trailingWidthVp,
  expected: () => 153,
}));

async function run(spec, source) {
  const metrics = metricsPolicy.createDefaultReaderWindowMetrics();
  Object.assign(metrics, { ready: true, densityPixels: 1, systemFontScale: 1, revision: 1 });
  metrics.windowRect.width = 393; metrics.windowRect.height = 852;
  spec.initialMetrics?.(metrics);
  const witness = nativeWitness(spec, source, metrics);
  assertFinite(witness.value());
  const before = snapshot(witness.value());
  const child = witness.owner.children.get(0);
  const expected = spec.expected ?? expectedByPath[spec.path];
  assert.ok(expected, 'explicit independent expected projection');
  const calls = witness.nativeRecord.calls ?? 0;
  spec.change(metrics); metrics.revision += 1;
  witness.publish();
  assert.equal(witness.deliveries.length, 2, spec.path + ' same observer receives metric-only publication');
  if (!spec.allowCaptured) assert.notDeepEqual(snapshot(witness.value()), before, 'current native projection changes with the requested geometry');
  assertFinite(witness.value());
  const expectedValue = expected(metrics, spec, witness.owner);
  assertFinite(expectedValue);
  assert.deepEqual(snapshot(witness.value()), snapshot(expectedValue), 'native projection follows current plain-metrics policy');
  assert.deepEqual(witness.deliveries, [0, 0], 'only the retained dirty observer was delivered');
  if (spec.actualStorage) {
    assert.equal(witness.owner.pageTurnInputRevision, 7);
    assert.equal(witness.owner.pageTurnReadinessRevision, 3);
    assert.equal(witness.owner.pageTurnRenderRevision, 1);
    if (spec.allowCaptured) assert.equal(witness.owner.rollbackRequests, 1);
    else assert.equal(witness.owner.windowMetricsLayoutKey(), witness.owner.lastWindowMetricsLayoutKey, 'actual Watch follows unchanged body key');
  }
  if (child) {
    assert.equal(witness.owner.children.get(0), child, 'same child endpoint retained');
    assert.equal(child.updated, 1, 'actual child update payload delivered once');
  }
  if (witness.owner.children.size === 0) assert.ok(witness.nativeRecord.calls > calls, 'native attributes were called again');
  assert.equal(witness.owner.observers.length, 1, 'same native observer retained');
  assert.equal(witness.owner.nodes.get(0), witness.nativeRecord, 'same native record retained');
  return { path: spec.path, marker: spec.marker, callbackSha256: witness.callbackSha256, before, after: snapshot(witness.value()) };
}

for (const id of selected) {
  const results = [], failures = [];
  const currentConsumers = id === 'rss-header-width' ? rssHeaderConsumers : id === 'search-sheet-metrics' ?
    consumers.filter(spec => ['ui/surfaces/ReaderBottomSheet.ets', 'features/search/ui/SearchPage.ets'].includes(spec.path)) :
    consumers;
  for (const spec of currentConsumers) {
    const source = read(spec.path);
    try {
    results.push(await run(spec, source));
    // Read the actual methods without the newly introduced local revision.
    // No expected-value function/provider reads the observed property.
    let negative = source.replaceAll(`    this.${spec.revision};\n`, '');
    if (spec.path.endsWith('ReaderSearchField.ets')) {
      negative = negative.replace('this.directoryFontScale());', 'readerReadableFontScale(readerWindowMetrics().systemFontScale));');
    }
    assert.notEqual(negative, source, spec.path + ' dependency negative differs');
    await assert.rejects(() => run(spec, negative), /same observer receives metric-only publication/);
    } catch (error) { failures.push(new Error(spec.path + ': ' + error.message, { cause: error })); }
  }
  if (failures.length) throw new AggregateError(failures, 'Current scoped observer checks failed');
  console.log(JSON.stringify({ case: id, owningFiles: new Set(currentConsumers.map(spec => spec.path)).size, nativeObserverScenarios: currentConsumers.length, results,
    boundary: 'Unchanged installed-SDK native observer closures, original production getters and SDK value dependency classes. Only dirty-id delivery. Native attributes are snapshotted finite calls. Parent assembly, child rendering, platform measurement and layout require separate evidence.' }));
  recordContractCasePass(id);
}

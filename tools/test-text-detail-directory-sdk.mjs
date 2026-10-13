import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import * as positioning from '../entry/src/main/ets/features/reading/ReaderControlListPositioning.ts';
import * as bookmarkProjection from '../entry/src/main/ets/features/reading/ReaderBookmarkProjection.ts';
import * as snapshots from '../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts';
import * as hierarchy from '../entry/src/main/ets/features/reading/ReaderDirectoryHierarchy.ts';
import * as markers from '../entry/src/main/ets/features/reading/ReaderDirectoryMarkerState.ts';
import * as viewport from '../entry/src/main/ets/features/reading/ReaderDirectoryViewport.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { projectReaderDirectoryEntries } from '../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts';
import { sampleReaderControlBookmark } from '../entry/src/main/ets/features/reading/ReaderControlBookmarkGeometry.ts';
import { readerDirectoryScopeKey } from '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context); throw error; }
} });
const recovery = await import('../entry/src/main/ets/features/reading/ReadingDirectoryRecovery.ts');
const { readerWidthClass } = await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const read = file => readFileSync(new URL('../entry/src/main/ets/' + file, import.meta.url), 'utf8');
const indexSource = read('pages/Index.ets'), fullSource = read('features/reading/ReaderFullDirectory.ets');
const panelSource = read('features/reading/FullDirectoryPanel.ets'), listSource = read('features/reading/ReaderDirectoryList.ets');
const surfaceSource = read('features/reading/ReaderDirectoryNavigationSurface.ets');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(sdk + '/node_modules/typescript'), options = require(sdk + '/lib/ets_checker.js').compilerOptions;
const syntax = require(sdk + '/lib/validate_ui_syntax.js');
const listTree = ts.createSourceFile('ReaderDirectoryList.ets', listSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const dataSource = listTree.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'DirectoryListDataSource');
const DirectoryListDataSource = new Function('sameReaderDirectoryData', 'snapshotReaderDirectoryData',
  ts.transpileModule(dataSource.getText(listTree), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText + ';return DirectoryListDataSource;')(
  snapshots.sameReaderDirectoryData, snapshots.snapshotReaderDirectoryData);
const entries = Array.from({ length: 40 }, (_, ordinal) => ({ index: 17 + ordinal * 9, title: 'Chapter ' + (ordinal + 1), navigable: true }));
const allOwners = owner => [owner, ...[...(owner.children?.values() ?? [])].filter(child => child.nodes).flatMap(allOwners)];
const nodes = owner => allOwners(owner).flatMap(child => [...child.nodes.values()]);

function fixture({ index = indexSource, full = fullSource, panel = panelSource, context = 'detail', current = -1, embedded = false, width = 390, scheme = 'day', safeTop = 0 } = {}) {
  const properties = createArkUIPropertyRuntimeProbe(), timers = [], scrolls = [], effects = [];
  const metrics = metricsApi.createDefaultReaderWindowMetrics();
  metrics.windowRect.width = width; metrics.windowRect.height = 1000; metrics.systemInsets.bottom = 24; metrics.systemInsets.top = safeTop;
  class NativeScroller {
    currentOffset() { return { xOffset: 0, yOffset: 0 }; }
    scrollTo(request) { scrolls.push(request); }
    scrollEdge(edge) { scrolls.push({ edge }); }
  }
  class Port { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
  const dependencies = { ...properties.sdk, ...positioning, ...bookmarkProjection, ...snapshots, ...hierarchy, ...markers, ...viewport, ...metricsApi, ...recovery,
    projectReaderDirectoryEntries, sampleReaderControlBookmark, DirectoryListDataSource,
    BOOKMARK_ROW_HEIGHT: Number(read('features/reading/ReaderBookmarkRow.ets').match(/export const BOOKMARK_ROW_HEIGHT = (\d+)/)[1]),
    ChildrenMainSize: class { constructor(height) { this.childDefaultSize = height; } },
    Scroller: NativeScroller, ReaderWindowCoordinator: { metrics: () => metrics }, registerReaderFonts() {},
    setTimeout(action) { const timer = { action, cancelled: false }; timers.push(timer); return timer; }, clearTimeout(timer) { if (timer) timer.cancelled = true; },
    LazyForEach: { create() {}, pop() {} }, ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
    motionAnimateParam: (_name, onFinish) => ({ duration: 0, onFinish }),
    uiContext: { getFont: () => ({}), animateTo(options, action) { action(); options.onFinish?.(); } },
    Curve: { Linear: 'Curve.Linear' }, Edge: { Top: 'Edge.Top' }, ScrollSource: { DRAG: 'drag' },
    ReaderSearchField: Port, ReaderBookmarkList: Port, ReaderBookmarkEmptyState: Port, ReaderBookmarkLoadingState: Port, ReaderBookmarkErrorState: Port, ReaderDirectoryNavigationList: Port,
    ReaderDirectoryRecoverySurface: Port, ReaderRuntimeOwner: { current: () => ({ supportsCoreCapability: () => false }) },
    readerDirectoryScopeKey, readerWidthClass, deviceInfo: { deviceType: 'phone' }, ReadingExperience: Port, ReaderStatusBarPaper: Port,
  };
  const hooks = { ...properties.hooks, mountChildren: true, lifecycleChildren: true, childSources: {
    ReaderFullDirectory: full, FullDirectoryPanel: panel, ReaderDirectoryList: listSource, ReaderDirectoryNavigationSurface: surfaceSource,
    BookDirectoryPage: read('features/bookshelf/BookDirectoryPage.ets'),
    LocalBookDetail: read('features/bookshelf/LocalBookDetail.ets'), BookshelfMultiSelectPage: read('features/bookshelf/BookshelfMultiSelectPage.ets'),
    ReadingExperience: read('features/reading/LocalReadingExperience.ets'), ReaderStatusBarPaper: read('features/reading/ReaderStatusBarPaper.ets'),
    ReaderShell: read('features/shell/ReaderShell.ets'), ReaderLayoutDebugOverlay: read('features/common/ReaderLayoutDebugOverlay.ets'), ArkWebExecutionHost: read('app/ArkWebExecutionHost.ets'),
  } };
  for (const name of ['ReaderSearchField', 'ReaderBookmarkList', 'ReaderBookmarkEmptyState', 'ReaderBookmarkLoadingState', 'ReaderBookmarkErrorState', 'ReaderDirectoryNavigationList', 'ReaderDirectoryRecoverySurface'])
    hooks.childSources[name] = read(`features/${name === 'ReaderSearchField' ? 'common' : 'reading'}/${name}.ets`);
  for (const [name, source] of Object.entries(hooks.childSources)) {
    syntax.componentCollection.customComponents.add(name);
    syntax.builderParamObjectCollection.set(name, new Set([...source.matchAll(/@BuilderParam\s+(\w+)/g)].map(match => match[1])));
  }
  const List = createReaderBuilderProbe(listSource, boundedMembers(listSource), dependencies, hooks).Component;
  // Execute the actual no-tree fallback Builder. Core navigation acquisition
  // and virtual row scheduling retain their independent existing SDK gates.
  const Surface = createReaderBuilderProbe(surfaceSource, ['build', 'fallbackBuilder', 'view'], dependencies, hooks).Component;
  const Panel = createReaderBuilderProbe(panel, boundedMembers(panel), { ...dependencies, ReaderDirectoryList: List, ReaderDirectoryNavigationSurface: Surface }, hooks).Component;
  const Full = createReaderBuilderProbe(full, boundedMembers(full), { ...dependencies, FullDirectoryPanel: Panel }, hooks).Component;
  const shellSource = hooks.childSources.ReaderShell;
  const shellTree = ts.createSourceFile('ReaderShell.ets', shellSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const shellDeclaration = shellTree.statements.find(node => ts.isStructDeclaration(node) && node.name.text === 'ReaderShell');
  const shellFacts = shellDeclaration.members.filter(ts.isPropertyDeclaration).filter(member => member.name.getText(shellTree) !== 'mangaSettingsGateway').map(member => member.name.getText(shellTree));
  const Shell = createReaderBuilderProbe(shellSource, [...shellFacts, 'build', 'readingContent', 'readingOverlay', 'readingIdentityKey', 'overlayStatusBarUnderlay', 'chromeMetrics'],
    { ...dependencies, ReaderFullDirectory: Full, BookDirectoryPage: Port }, hooks).Component;
  const owner = createReaderBuilderProbe(index, ['readerWindowMetricsRevision', 'build', 'detailContent', 'detailSurface', 'externalDirectory', 'detailBookKey', 'isCurrentRuntime', 'hasUnknownShelfWrite', 'detailReadableAdmission',
      'detailShelfMessage', 'detailShelfAdmissionIdentity', 'isCurrentDetailShelfAdmission', 'isCurrentDetailPresentation', 'directoryRecovery', 'directoryOperationPresentationId', 'directoryOperationBindingId',
      'readerOwnsWindowEdges', 'mangaOwnsWindowEdges', 'appContentTopInset', 'currentSourceSwitchTransactionId', 'controlBookmarkProjectionMessage', 'canCancelMangaSourcePreparation'], {
      ...dependencies, ReaderFullDirectory: Full, BookDirectoryPage: Port, LocalBookDetail: Port, BookshelfMultiSelectPage: Port, ReaderShell: Shell, ReaderLayoutDebugOverlay: Port, ArkWebExecutionHost: Port,
      LOCAL_SOURCE_ID: 'local', EMPTY_READABLE_ADMISSION: { adding: false, cancelling: false, message: '' }, isReaderProductSurfaceEnabled: () => true,
    }, hooks).owner;
    Object.assign(owner, { detailBook: { sourceId: 'local', bookId: 'catalog-book', contentKind: 'text', title: 'Novel', author: 'Author' }, detailToc: entries,
      directoryCurrentChapterIndex: current, directoryChapterTitle: '', directoryPresentationGeneration: 4, navigationGeneration: 2,
      settingsSnapshot: { reduceMotion: true }, offlineMutationActiveKey: '', appThemeScheme: scheme, route: 'directory', directoryReturnTarget: context === 'detail' ? 'detail' : 'readerControl', readingSessionActive: context === 'reader',
      readingContentKind: 'text', sourceSwitchState: { kind: 'idle' }, sourceSwitchVisible: false, directoryOpenedFromControl: true,
      readableAdmissions: [], detailShelfAdmissionMount: 1, shelfOperation: { removalKey: '', busy: false, batchRemovalBusy: false },
      remoteContentVerdict: 'readable', remoteContentVerdictLabel: () => '', readerWindowMetricsRevision: 0,
      detailBookmarkIdentity: () => ({ sourceId: 'local', bookId: 'catalog-book' }),
      onDirectoryChapterSelected: chapter => effects.push(['chapter', chapter]), closeDirectory: () => effects.push(['close']),
    });
    owner.initialRender();
  const fullOwner = allOwners(owner).find(actor => actor instanceof Full), panelOwner = allOwners(owner).find(actor => actor instanceof Panel);
  assert.ok(fullOwner && panelOwner, 'actual selected Index/Full branch mounts the real Panel');
  if (embedded) { panelOwner.embeddedInControl = true; panelOwner.beginListPositioning('directory'); properties.flush(); }
  const listOwner = allOwners(panelOwner).find(actor => actor instanceof List);
  const nativeList = nodes(listOwner).find(node => node.type === 'List');
  assert.ok(nativeList, 'actual Panel flat fallback mounts the actual native List');
  const ancestor = [...panelOwner.nodes.values()].find(node => node.type === 'Stack' && typeof node.enabled === 'boolean' && node.clip === true);
  assert.ok(ancestor, 'actual native List ancestor carries the positioning input fence');
  const scaffold = allOwners(fullOwner).find(actor => actor.variant === 'directory' || actor.variant === 'readerDirectory');
  const header = allOwners(scaffold).find(actor => actor.kind === 'floating' && actor.surface !== undefined);
  const frame = [...scaffold.nodes.values()].find(node => node.type === 'Stack' && node.padding);
  assert.ok(scaffold && header && frame, 'real common frame and header actors belong to this catalog branch');
  function drain() { for (let count = 0; timers.length; count++) { assert.ok(count < 200, 'actual timers settle'); const timer = timers.shift(); if (!timer.cancelled) timer.action(); properties.flush(); } }
  return { owner, full: fullOwner, panel: panelOwner, listOwner, nativeList, ancestor, scaffold, header, frame, properties, metrics, scrolls, effects, timers, drain };
}

function checkUnknown(options = {}) {
  const f = fixture(options); f.drain();
  assert.equal(f.full.catalogContext, 'detail', 'the actual text detail branch carries its standalone context');
  assert.equal(f.panel.allowUnanchoredBrowse, true, 'context passes through the actual Full Builder');
  assert.equal(f.panel.currentChapterIndex, -1, 'unknown progress stays unknown');
  assert.equal(f.panel.listPositioning.currentChapterOrdinal, -1, 'no chapter-one ordinal is fabricated');
  assert.equal(f.panel.awaitingReadingAnchor, false);
  assert.equal(f.ancestor.enabled, true, 'standalone unknown-anchor native ancestor must permit list gestures');
  assert.equal(f.ancestor.hitTestBehavior, 'HitTestMode.Default');
  assert.equal(f.ancestor.accessibilityLevel, 'auto');
  assert.equal(f.nativeList.create.scroller, f.panel.listScroller);
  assert.equal(f.frame.clip, true); assert.equal(f.frame.hitTestBehavior, 'HitTestMode.Default');
  const fullAncestors = [...f.full.nodes.values()].filter(node => node.type === 'Stack' &&
    (node.create?.alignContent === 'Alignment.BottomStart' || node.width === '100%' && node.height === '100%'));
  assert.equal(fullAncestors.length, 2, 'actual Full body and Panel viewport are the two native ancestors');
  for (const actor of fullAncestors) {
    assert.notEqual(actor.enabled, false); assert.notEqual(actor.hitTestBehavior, 'HitTestMode.None');
  }
  f.nativeList.onWillStartDragging(); f.properties.flush(); f.drain();
  assert.equal(f.panel.navigationInteracted, true, 'actual native drag reaches the existing intent owner');
  assert.equal(f.panel.currentChapterIndex, -1);
  assert.deepEqual(f.scrolls, [], 'catalog browse does not invent a positioning command');
  assert.deepEqual(f.effects, [], 'catalog browse does not choose a chapter or write progress');
  return f;
}
for (const width of [320, 390, 800]) for (const scheme of ['day', 'night']) checkUnknown({ width, scheme });
// Read the real Index canvas and the real Full title/card from each actual route.
// The detail app canvas consumes the status band once; retained reading owns it
// inside Full and inherits no parent offset.
for (const width of [320, 390, 800]) for (const context of ['detail', 'reader']) {
  const f = fixture({ width, context, safeTop: 39 }); f.drain();
  const root = [...f.owner.nodes.values()].find(node => node.type === 'Stack' && node.padding?.top !== undefined);
  const card = nodes(f.full).find(node => node.type === 'Row' && node.height === 54 && node.borderRadius);
  const cardHost = nodes(f.full).find(node => node.type === 'Row' && node.height === 54 && node.margin?.top !== undefined);
  assert.ok(root && card && cardHost, 'actual Index root and Full card paint in the selected route');
  const parentTop = context === 'detail' ? 39 : 0, localTop = context === 'detail' ? 18 : 39;
  assert.equal(root.padding.top, parentTop); assert.equal(cardHost.margin.top, localTop);
  assert.equal(f.full.topBarTop(), localTop); assert.equal(root.padding.top + cardHost.margin.top, parentTop + localTop, 'status safe-top is consumed exactly once');
  assert.equal(f.full.fullPanelTop(), localTop + 54 + 16);
  assert.equal(f.full.catalogContext, context);
  assert.equal(f.panel.allowUnanchoredBrowse, context === 'detail');
}

for (const options of [{ context: 'reader' }, { context: 'detail', embedded: true }]) {
  const f = fixture(options); f.drain();
  assert.equal(f.panel.awaitingReadingAnchor, true, 'reader/embedded unknown anchor retains its admission wait');
  assert.equal(f.ancestor.enabled, false); assert.equal(f.ancestor.hitTestBehavior, 'HitTestMode.None');
  assert.equal(f.panel.currentChapterIndex, -1); assert.deepEqual(f.scrolls, []);
}
for (const context of ['detail', 'reader']) {
  const f = fixture({ context, current: entries[17].index });
  assert.equal(f.ancestor.enabled, false, 'known anchor waits for native layout');
  f.nativeList.onAreaChange({}, { width: 338, height: 320 }); f.drain();
  const expected = positioning.readerControlCenteredListOffset(positioning.readerControlUniformListViewport({ rowCount: entries.length, rowIndex: 17,
    rowHeight: f.panel.listRowHeight('directory'), rowSpacing: 0, paddingTop: 5, paddingBottom: 5, viewportHeight: 320 }));
  assert.equal(f.scrolls.length, 1); assert.equal(f.scrolls[0].yOffset, expected, 'known sparse canonical ID retains its original centered ordinal');
  assert.equal(f.panel.listPositioning.status, 'positioned'); assert.equal(f.ancestor.enabled, true);
  const native = f.nativeList, panel = f.panel, list = f.listOwner;
  f.nativeList.onAreaChange({}, { width: 338, height: 320 }); f.drain();
  assert.equal(f.scrolls.length, 1, 'a known opening positions only once');
  assert.equal(f.panel, panel); assert.equal(f.listOwner, list); assert.equal(nodes(list).find(node => node.type === 'List'), native);
  assert.deepEqual(f.effects, []);
}
for (const retire of [f => f.panel.onListUserScroll(), f => f.panel.aboutToDisappear()]) {
  const f = fixture({ current: entries[17].index }); f.nativeList.onAreaChange({}, { width: 338, height: 320 }); retire(f); f.drain();
  assert.deepEqual(f.scrolls, [], 'queued positioning cannot override user intent or a retired Panel');
}
for (const [name, options] of [
  ['wrong Index context', { index: indexSource.replace("catalogContext: 'detail'", "catalogContext: 'reader'") }],
  ['missing Full standalone admission', { full: fullSource.replace("allowUnanchoredBrowse: this.catalogContext === 'detail'", 'allowUnanchoredBrowse: false') }],
  ['old permanently disabled ancestor', { panel: panelSource.replace('this.initialListPositionReady = browseWithoutAnchor;', 'this.initialListPositionReady = false;') }],
]) {
  assert.notEqual(options.index ?? options.full ?? options.panel, options.index ? indexSource : options.full ? fullSource : panelSource);
  assert.throws(() => checkUnknown(options), undefined, name);
}
const embeddedLeak = panelSource.replace('this.allowUnanchoredBrowse && !this.embeddedInControl;', 'this.allowUnanchoredBrowse;');
assert.notEqual(embeddedLeak, panelSource);
const leak = fixture({ panel: embeddedLeak, embedded: true }); leak.drain();
assert.equal(leak.ancestor.enabled, true, 'negative control reproduces unsafe embedded admission');

// Deliver actual retained HeaderHost native events and real Prop updates.
// The ordinary onHeightChange callback stays stable; only the Area handler
// freezes the rendered measurement key. No native layout engine is modeled.
for (const context of ['detail', 'reader']) {
  const f = fixture({ context, safeTop: 39 }); f.drain();
  const actor = [...f.header.nodes.values()].find(node => node.onAreaChange), oldArea = actor.onAreaChange, stableCallback = f.header.onHeightChange;
  const topBar = nodes(f.full).find(node => node.type === 'Row' && node.height === 54 && node.borderRadius);
  assert.ok(topBar, 'original 54vp opaque card is the shared header content');
  assert.equal(f.full.fullPanelTop(), f.full.topBarTop() + 54 + 16, 'unmeasured catalog retains its original top/card/list gap');
  const initialHeight = f.full.topBarTop() + 54;
  actor.onAreaChange({}, { height: initialHeight }); f.properties.flush();
  assert.equal(f.full.fullPanelTop(), initialHeight + 16);
  actor.onAreaChange({}, { height: initialHeight }); f.properties.flush();
  assert.equal(f.full.fullPanelTop(), initialHeight + 16, 'replayed total header height does not accumulate top padding');
  f.metrics.systemInsets.top = 48; f.owner.readerWindowMetricsRevision++; f.full.readerWindowMetricsRevision++; f.properties.flush();
  const indexCanvas = [...f.owner.nodes.values()].find(node => node.type === 'Stack' && node.padding?.top !== undefined);
  assert.equal(indexCanvas.padding.top, context === 'detail' ? 48 : 0, 'actual retained Index native canvas reacts without duplicating the Full inset');
  assert.equal(f.header.onHeightChange, stableCallback, 'regular callback member is retained across the actual Prop update');
  if (context === 'reader') {
    oldArea({}, { height: 999 }); f.properties.flush();
    assert.notEqual(f.full.catalogHeaderHeight, 999, 'old physical Area cannot borrow the new safe-top key');
    assert.equal(f.full.fullPanelTop(), f.full.topBarTop() + 70, 'changed safe-top uses the original fallback until current measurement');
    assert.notEqual(actor.onAreaChange, oldArea, 'actual retained native observer freezes the new measurement key');
  } else {
    assert.equal(f.full.topBarTop(), 18, 'detail parent owns its safe-top; the local card gap stays18');
    assert.equal(f.full.fullPanelTop(), initialHeight + 16, 'parent safe-top changes do not add a second local inset');
  }
  actor.onAreaChange({}, { height: '120vp' }); f.properties.flush();
  assert.equal(f.full.catalogHeaderTop, f.full.topBarTop()); assert.equal(f.full.fullPanelTop(), 136);
  assert.equal(allOwners(f.full).find(owner => owner === f.panel), f.panel);
  assert.equal(nodes(f.listOwner).find(node => node.type === 'List'), f.nativeList);
  assert.equal(allOwners(f.full).find(owner => owner === f.header), f.header);
  assert.equal(nodes(f.full).find(node => node === topBar), topBar);
  assert.deepEqual(f.scrolls, []); assert.deepEqual(f.effects, []);
  assert.deepEqual(f.frame.expandSafeArea, [[], []]); assert.deepEqual(f.frame.ignoreLayoutSafeArea, [[], []]);
  f.scaffold.readingUnderlayColor = '#FF314159'; f.properties.flush();
  assert.equal(f.frame.backgroundColor, context === 'reader' ? '#FF314159' : readerAppColor('app.window.background', 'day'), 'catalog context retains its original window paper owner');
}
console.log('PASS actual text detail Index→Full→Scaffold/Header→Panel→native List: standalone unknown browse, embedded/reader wait, sparse known positioning/retirement, retained actors, safe-top physical Area key fencing, paper context and four admission controls. Native gestures/layout/pixels and device acceptance remain separate.');

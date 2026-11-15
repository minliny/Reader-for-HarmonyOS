import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { selectedProductionMethods, selectedProductionValues } from './lib/selected-production-methods.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { boundedMembers, boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { actualModeHost } from './lib/bookshelf-view-mode-probe.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { ReaderAppearanceStore } from '../entry/src/main/ets/features/reading/application/ReaderAppearanceStore.ts';
import { createDefaultReaderAppearanceSnapshot, changeAppearanceThemeSelection } from '../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts';
import { retainedReaderRoute } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { readerControlHostInputEnabled } from '../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts';
import { createDefaultReaderSettingsSnapshot, setReaderSettingsToggle, isReaderSettingsToggleAvailable,
  setReaderPageTurnStyle, readerPageTransitionUsesPreparedPages } from '../entry/src/main/ets/features/reading/application/ReaderSettingsState.ts';
import * as gesture from '../entry/src/main/ets/features/reading/ui/ReaderPageGestureState.ts';
import * as rapid from '../entry/src/main/ets/features/reading/ui/ReaderRapidPageTurnState.ts';
import { ReaderPageInputClock } from '../entry/src/main/ets/features/reading/ui/ReaderPageInputClock.ts';
import { sameReaderDirectoryData } from '../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts';
import { readerDirectoryBookmarkMarkerState } from '../entry/src/main/ets/features/reading/presentation/ReaderDirectoryMarkerState.ts';
import { readerDirectoryAccessibilityText, readerDirectoryIndentVp } from '../entry/src/main/ets/features/reading/ui/ReaderDirectoryHierarchy.ts';
import { sampleReaderControlBookmark } from '../entry/src/main/ets/features/reading/ui/ReaderControlBookmarkGeometry.ts';

const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const cases = selectContractCases({
  'shelf-filter-admission': 'Actual retained header/chip/clear/collapse callbacks reject retired input and navigation.',
  'mode-async-admission': 'Both actual mode consumers recheck admission after prepare/load and retain dispatched ACKs.',
  'theme-async-admission': 'Actual Settings theme callback rechecks its captured input after barrier/load and preserves an accepted save.',
  'reader-live-input': 'Actual Root/Scene/Shell/reader/Panel and raw callbacks consume live input before delayed Props.',
  'directory-flat-input': 'Actual flat chapter and bookmark callbacks reject retired input, content and canonical row data.',
});
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function componentCallback(path, component, property, owner, bindings) {
  const { ts, options } = installedEtsCompiler();
  const source = read(path);
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const expressions = [];
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === component) {
      const value = node.arguments[0].properties.find(item => item.name?.getText(tree) === property);
      if (value) expressions.push(value.initializer.getText(tree));
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(expressions.length, 1);
  return new Function(...Object.keys(bindings),
    stripTypeScriptTypes(`const action = ${expressions[0]};`) + '\nreturn action;')
    .call(owner, ...Object.values(bindings));
}

function shelfFilters() {
  const path = 'features/bookshelf/ui/BookshelfPage.ets';
  const methods = ['setFilterExpanded', 'settleFilterPanel', 'selectFilter', 'clearFilters', 'isShelfPresentationCurrent'];
  const Page = selectedProductionMethods(new URL(path, root), 'BookshelfPage', methods);
  let allowed = false;
  const page = Object.assign(new Page(), { mounted: true, navigationGeneration: 7, feedbackEnabled: false,
    isCurrentShelfInput: navigation => allowed && navigation === page.navigationGeneration,
    filterRowVisible: false, viewState: { filterExpanded: false }, reduceMotion: true,
    filterMotionGeneration: 0, filterNaturalHeight: 80, contentFilter: 'all', sourceFilter: 'all', queueShelfProjection() {} });
  const callback = componentCallback(path, 'BookshelfSectionHeader', 'onFilter', page, { navigation: 7 });
  const icons = iconButtonControls();
  const headerFile = new URL('features/bookshelf/ui/BookshelfSectionHeader.ets', root);
  const headerSource = readFileSync(headerFile, 'utf8');
  const header = icons.consumer(headerSource, boundedMembers(headerSource), {
    ...selectedProductionValues(headerFile, ['SHELF_SECTION_ACTION_SIZE']), readerScaledControlHeight: () => 44,
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) },
    TYPE_APP_SECTION_LABEL: { fontSizeFp: 16, lineHeightFp: 24 }, TOK_SPACE_XS: 8, readerAppColor: () => '#000000',
  });
  Object.assign(header, { contentWidth: 280, onCover() {}, onList() {}, onFilter: callback });
  header.initialRender();
  const filter = icons.nodes(header).find(node => node.type === 'Button' && node.accessibilityText === '展开筛选');
  filter.onClick();
  assert.equal(page.filterRowVisible, false);
  allowed = true; page.feedbackEnabled = true;
  filter.onClick();
  assert.equal(page.viewState.filterExpanded, true);
  page.navigationGeneration = 8;
  filter.onClick();
  assert.equal(page.viewState.filterExpanded, true, 'old navigation header cannot alter its successor');

  const controls = foundationControls();
  const chips = createReaderBuilderProbe(read(path), ['filterRow', 'filterChip', 'isFilterSelected', 'hasActiveFilters', ...methods],
    controls.dependencies, controls.hooks).owner;
  let projections = 0;
  Object.assign(chips, { appThemeScheme: 'day', mounted: true, navigationGeneration: 8, feedbackEnabled: true,
    isCurrentShelfInput: navigation => allowed && navigation === chips.navigationGeneration,
    contentFilter: 'all', sourceFilter: 'all', filterRowVisible: true, reduceMotion: true,
    viewState: { filterExpanded: true }, filterNaturalHeight: 80, filterMotionGeneration: 0,
    queueShelfProjection: () => projections++ });
  chips.filterRow(8);
  const button = label => controls.nodes(chips).find(node => node.type === 'Button' && node.accessibilityText === label);
  const manga = button('内容类型：漫画');
  manga.onClick(); controls.properties.flush(); chips.replay(); controls.properties.flush();
  assert.equal(chips.contentFilter, 'manga');
  allowed = false;
  button('清除内容类型和来源筛选').onClick();
  button('收起筛选').onClick();
  assert.equal(chips.contentFilter, 'manga', 'retired clear callback preserves current filters');
  assert.equal(chips.viewState.filterExpanded, true, 'retired collapse callback preserves route state');
  allowed = true; chips.navigationGeneration = 9;
  button('内容类型：小说').onClick();
  button('清除内容类型和来源筛选').onClick();
  assert.equal(chips.contentFilter, 'manga');
  assert.equal(projections, 1, 'retired callbacks issue no successor projection');
  chips.clearFilters(9);
  assert.equal(chips.contentFilter, 'all');
  assert.equal(projections, 2);
  return { admittedProjections: projections, retiredHeaderAndFilterCallbacksRejected: true };
}

async function modeAdmission() {
  const results = [];
  for (const settings of [false, true]) {
    for (const phase of ['prepare', 'load', 'navigation', 'dispatched']) {
      let allowed = true;
      let canonical = 'cover';
      let writes = 0;
      const entered = deferred(), release = deferred();
      const host = actualModeHost({
        currentBookshelfViewMode: () => canonical,
        loadBookshelfViewMode: async () => {
          if (phase === 'load') { entered.resolve(); await release.promise; }
          return canonical;
        },
        saveBookshelfViewMode: async mode => {
          writes += 1;
          if (phase === 'dispatched') { entered.resolve(); await release.promise; }
          canonical = mode;
        },
      }, async () => {
        if (phase === 'prepare' || phase === 'navigation') { entered.resolve(); await release.promise; }
      });
      const path = settings ? 'features/bookshelf/ui/BookshelfSettingsPage.ets' : 'features/bookshelf/ui/BookshelfPage.ets';
      const names = settings ? ['selectMode', 'persistRequestedMode', 'userInputIsCurrent', 'preferenceControlIdentity'] :
        ['setViewMode', 'persistRequestedViewMode', 'isShelfPresentationCurrent'];
      const Page = selectedProductionMethods(new URL(path, root), settings ? 'BookshelfSettingsPage' : 'BookshelfPage', names);
      const page = Object.assign(new Page(), { mounted: true, revision: 0, viewModeRevision: 0,
        navigationGeneration: 7, presentationRevision: 1, mode: 'cover', viewMode: 'cover', storedViewMode: 'cover',
        confirmed: 'cover', confirmedViewMode: 'cover', reduceMotion: true, feedbackEnabled: true,
        isInputAllowed: () => allowed, isCurrentShelfInput: navigation => allowed && navigation === page.navigationGeneration,
        viewModeHost: host, applyModeSnapshot() {}, applyViewModeSnapshot() {}, modeFeedback() {},
        resetViewSwitchMotion() {}, setRestingProjectionOpacity() {} });
      page[settings ? 'selectMode' : 'setViewMode']('list');
      await entered.promise;
      if (phase === 'navigation') page.navigationGeneration += 1;
      else allowed = false;
      const work = host.pendingWrite;
      release.resolve();
      await work;
      await Promise.resolve();
      const accepted = phase === 'dispatched';
      assert.equal(writes, accepted ? 1 : 0, 'only an already-dispatched mode request writes');
      assert.equal(canonical, accepted ? 'list' : 'cover');
      if (accepted) assert.equal(host.current().receipt.receipt.confirmation, 'confirmed', 'actual ACK survives input retirement');
      else if (phase !== 'navigation') assert.equal(settings ? page.mode : page.viewMode, 'cover', 'undispatched optimistic mode returns to confirmed state');
      results.push({ settings, phase, writes });
    }
  }
  return { scenarios: results.length, admittedDispatches: results.filter(item => item.writes).length };
}

async function themeAdmission() {
  const path = 'app/composition/SettingsScenes.ets';
  for (const phase of ['foreground', 'section', 'identity', 'load', 'dispatched']) {
    const Theme = selectedProductionMethods(new URL('app/ReaderThemeHost.ts', root), 'ReaderThemeHost',
      ['selectApp', 'prepareUserChange'], { changeAppearanceThemeSelection });
    let allowed = true, identity = 'opening-7';
    const entered = deferred(), release = deferred(), writes = [];
    const store = new ReaderAppearanceStore({
      load: async () => {
        if (phase === 'load') { entered.resolve(); await release.promise; }
        return createDefaultReaderAppearanceSnapshot();
      },
      save: async snapshot => {
        writes.push(snapshot.appThemeMode);
        if (phase === 'dispatched') { entered.resolve(); await release.promise; }
      },
    });
    if (phase !== 'load') await store.load();
    Object.assign(Theme, { generation: 1, systemScheme: 'day', store,
      recoveryBarrier: async () => {
        if (!['load', 'dispatched'].includes(phase)) { entered.resolve(); await release.promise; }
      } });
    const Scene = selectedProductionMethods(new URL(path, root), 'SettingsScenes', ['inputIsCurrent']);
    const scene = Object.assign(new Scene(), { route: 'settings', section: 'general', isInputAllowed: () => allowed,
      presentation: { isCurrent: value => value === identity } });
    const select = componentCallback(path, 'SettingsPage', 'onSelectAppTheme', scene,
      { identity: 'opening-7', ReaderThemeHost: Theme });
    const work = select('night').then(() => true, error => {
      assert.equal(error.message, 'THEME_OWNER_CHANGED');
      return false;
    });
    await entered.promise;
    if (phase === 'section') scene.section = 'home';
    else if (phase === 'identity') identity = 'opening-8';
    else allowed = false;
    release.resolve();
    const accepted = await work;
    assert.equal(accepted, phase === 'dispatched');
    assert.deepEqual(writes, accepted ? ['night'] : [], 'retired theme choice cannot create its first write');
    assert.equal(store.current().appThemeMode, accepted ? 'night' : 'system');
  }
  return { scenarios: 5, acceptedSaveRetained: true };
}

function readerRootInput(owner) {
  const Entry = selectedProductionMethods(new URL('features/reading/presentation/ReadingEntryPresentation.ets', root),
    'ReadingEntryPresentation', ['readerPresentationIdentity']);
  const reading = Object.assign(new Entry(), { sessionActive: true, book: { sourceId: 'source', bookId: 'book' }, readyGeneration: 7 });
  const Root = selectedProductionMethods(new URL('pages/Index.ets', root), 'Index',
    ['retainedReaderPorts', 'readerContentInputCurrent', 'currentReadingRuntime', 'currentReaderPresentationIdentity'], { retainedReaderRoute });
  const runtime = {};
  const host = Object.assign(new Root(), { readingEntry: reading, route: 'reading', directoryReturnTarget: 'readerControl',
    searchAppForeground: true, arkWebCapturesInput: false, shelfReceiptRetired: false, mountedRuntimeOwner: runtime,
    libraryAcquisition: { currentOwner: () => runtime }, shelfMotion: { pendingExitId: -1 },
    sourceSwitchPresentation: { isSurfacePresented: () => host.switchPresented === true },
    mangaSourceSwitch: { selectionVisible: false }, directoryJourney: { operations: {} },
    directoryNavigationPorts: () => ({}), sourceSwitchActions: {} });
  const scene = { ports: host.retainedReaderPorts() };
  const inputCurrent = componentCallback('app/composition/RetainedReaderScene.ets', 'ReaderShell', 'inputCurrent', scene, {});
  const Shell = selectedProductionMethods(new URL('features/reading/ui/ReaderShell.ets', root), 'ReaderShell',
    ['readingContentIsForeground', 'readingIdentityKey']);
  const shell = Object.assign(new Shell(), { sourceId: 'source', bookId: 'book', readingReadyGeneration: 7,
    inputAllowed: true, visible: true, route: 'reading', sourceSwitchPresented: false, sourceSwitchCovered: false, inputCurrent });
  const identity = reading.readerPresentationIdentity();
  owner.inputCurrent = componentCallback('features/reading/ui/ReaderShell.ets', 'ReadingExperience', 'inputCurrent', shell, { _identity: identity });
  return { host, reading, shell, identity };
}

async function readerLiveInput() {
  const lrePath = 'features/reading/ui/LocalReadingExperience.ets';
  const Owner = selectedProductionMethods(new URL(lrePath, root), 'ReadingExperience',
    ['readerInputIsCurrent', 'isControlInputEnabled', 'changeReaderSetting', 'commitReaderSessionSettings',
      'captureReaderSettingsAdmission', 'persistReaderSettingsSnapshot'], { readerControlHostInputEnabled, setReaderSettingsToggle });
  const Panel = selectedProductionMethods(new URL('features/reading/ui/ReaderControlPanel.ets', root), 'ReaderControlPanel',
    ['contentInputEnabled', 'secondaryModuleInputEnabled', 'controlActionInputEnabled']);
  class Child { constructor(owner, params) { Object.assign(this, { owner, params }); } }
  const boundaries = ['current', 'foreground', 'arkweb', 'opening', 'exit', 'source', 'manga', 'route', 'identity', 'runtime', 'retired'];
  for (const boundary of boundaries) {
    const writes = [];
    const owner = Object.assign(new Owner(), { mounted: true, exitRequested: false, appForeground: true,
      windowChromeActive: true, interactionBlocked: false, controlObscured: false, sourceId: 'source', bookId: 'book',
      lifecycleToken: 1, readerSettingsMutationGeneration: 0, pageTurnRenderRevision: 0,
      readerSettingsSnapshot: createDefaultReaderSettingsSnapshot(), isReaderIdentityCurrent: () => true,
      isSessionActive: token => token === 1 && owner.mounted && !owner.exitRequested,
      configureReaderScreenAwakeLease() {}, applyReaderSystemEventPolicy() {}, settleReaderPreferenceNotice() {},
      notifyReaderSettingsSavePending() {}, readerSettingsGateway: { update: async (snapshot, _recovery, current) => {
        if (current()) writes.push(snapshot.longPressSelectText);
      } } });
    const { host, reading } = readerRootInput(owner);
    const panel = Object.assign(new Panel(), { runtimeMounted: true, moreMenuVisible: false,
      contentLocation: () => ({ level: 'secondary', module: 'settings' }), inputEnabled: owner.isControlInputEnabled(),
      inputCurrent: componentCallback(lrePath, 'ReaderControlPanel', 'inputCurrent', owner, {}),
      controlObscured: false, preparedMinimumRequired: true, currentMinimumIdentity: () => 'minimum',
      committedMinimumIdentity: () => 'minimum', minimumInputReady: () => true, minimumPresentationAvailable: () => true,
      hasCurrentTemporaryInput: () => false, visualVisibilityProgress: 1, visualTransitionKind: '', visualHeldPointerId: -1 });
    const builder = createReaderBuilderProbe(read('features/reading/ui/ReaderControlPanel.ets'), ['settingsModuleContent'],
      { ReaderControlSettingsContent: Child }, { childSources: { ReaderControlSettingsContent: read('features/reading/ui/ReaderControlSettingsContent.ets') } }).owner;
    Object.assign(builder, { currentMinimumIdentity: () => 'minimum', currentMinimumKey: () => 'minimum-key',
      preparedMinimum: () => ({ ownerCurrent: () => true }), preparedMinimumRequired: true,
      contentEndpointHeight: () => 800, contentMotionProgress: 1, contentMotionWidth: 390, contentMotionHeight: 600,
      secondaryModuleInputEnabled: module => panel.secondaryModuleInputEnabled(module), settingsSnapshot: owner.readerSettingsSnapshot,
      appearanceSnapshot: { alignment: 'start' },
      onSettingsToggleChange: componentCallback(lrePath, 'ReaderControlPanel', 'onSettingsToggleChange', owner, {}) });
    builder.settingsModuleContent();
    const params = [...builder.children.values()][0].params;
    const settingsSource = read('features/reading/ui/ReaderControlSettingsContent.ets');
    const style = { fontFamily: 'sans', fontWeight: 400, fontSizeFp: 14, lineHeightFp: 20 };
    const settings = createReaderBuilderProbe(settingsSource,
      ['toggleRow', 'handleToggle', 'toggleValue', 'toggleAccessibilityText', 'currentInputEnabled'],
      { ReaderControlSwitchTrack: Child, isReaderSettingsToggleAvailable,
        TYPE_READER_SETTINGS_RETAINED_TOGGLE_ROW_LABEL: style, readerAppColor: () => '#000000' },
      { childSources: { ReaderControlSwitchTrack: read('features/reading/ui/ReaderControlSwitchTrack.ets') } }).owner;
    Object.assign(settings, params, { geometry: () => ({ toggleLabelHeight: 20 }),
      child: () => ({ width: 390, height: 44, x: 0, y: 0, opacity: 1 }), p: () => 1,
      presentationPrepared: () => params.preparedMinimum });
    settings.toggleRow('长按选择文本', 'longPressSelectText', 2);
    const callback = [...settings.nodes.values()].find(node => node.type === 'Button').onClick;
    if (boundary === 'foreground') { host.searchAppForeground = false; owner.appForeground = false; }
    if (boundary === 'arkweb') host.arkWebCapturesInput = true;
    if (boundary === 'opening') host.shelfMotion.request = { direction: 'open' };
    if (boundary === 'exit') host.shelfMotion.pendingExitId = 1;
    if (boundary === 'source') host.switchPresented = true;
    if (boundary === 'manga') host.mangaSourceSwitch.selectionVisible = true;
    if (boundary === 'route') host.route = 'settings';
    if (boundary === 'identity') reading.readyGeneration += 1;
    if (boundary === 'runtime') host.mountedRuntimeOwner = {};
    if (boundary === 'retired') host.shelfReceiptRetired = true;
    assert.equal(panel.inputEnabled, true, 'the published Panel boolean deliberately remains stale');
    assert.equal(panel.controlActionInputEnabled(), boundary === 'current');
    callback();
    await Promise.resolve();
    assert.equal(writes.length, boundary === 'current' ? 1 : 0, `${boundary} first settings dispatch`);
  }

  let clock = 1000;
  const timers = [];
  const setTimer = (action, delay) => { timers.push({ action, delay }); return timers.length; };
  const RawOwner = selectedProductionMethods(new URL(lrePath, root), 'ReadingExperience',
    ['readerInputIsCurrent', 'isReaderPageInteractionEnabled', 'isControlInputEnabled', 'acquirePagePointer', 'releasePagePointer',
      'requestPageTurn', 'drainRapidPageTurn', 'performPageTurn', 'turnNextPage', 'canTurnPage', 'onAppForegroundChanged',
      'onControlInputBoundaryChanged', 'invalidateControlBackdrop', 'retirePagePointer', 'pageTurnInputPhase',
      'rollbackPageTurnForDeferredMutation'],
    { ...rapid, ...gesture, readerControlHostInputEnabled, readerPageTransitionUsesPreparedPages,
      createReaderControlBackdropTouchState: () => ({ phase: 'idle' }), setTimeout: setTimer, clearTimeout() {}, hilog: { error() {} } });
  const TouchType = { Down: 'down', Move: 'move', Up: 'up', Cancel: 'cancel' };
  const touch = type => ({ type, timestamp: (clock += 20) * 1e6,
    target: { area: { width: 390, height: 800, globalPosition: { x: 0, y: 0 } } },
    changedTouches: [{ id: 7, x: 300, y: 300 }], touches: [], stopPropagation() {}, preventDefault() {} });
  for (const boundary of ['current', 'foreground-before-prop', 'foreground-after-prop', 'foreground-return-before-prop', 'root-cover']) {
    const measurements = [];
    const owner = Object.assign(new RawOwner(), { mounted: true, exitRequested: false, appForeground: true,
      windowChromeActive: true, interactionBlocked: false, controlObscured: false, isReaderIdentityCurrent: () => true,
      readerWindowPolicyPending: false, phase: 'ready', measurementCompleting: false, pageTurnPreparation: undefined,
      pageTurnSettlingPrepared: undefined, pageTurnSettlementActive: false, commitInFlight: false,
      visiblePage: { startScalar: 0, endScalar: 100 }, chapter: { content: 'body', chapterIndex: 0 },
      visiblePageSelectionToken: 1, materializedChapterSelectionToken: 1, chapterSelectionToken: 1,
      activePagePointerId: -1, pagePointerEpoch: 0, lifecycleToken: 1, pageTurnInputRevision: 0, pageTurnTransactionSerial: 0,
      rapidPageTurnState: rapid.createReaderRapidPageTurnState(), pageTurnPreparationQueue: [], pendingPointerSegmentReserved: false,
      progressProducers: { continuousInFlight: false }, readerSettingsSnapshot: setReaderPageTurnStyle(createDefaultReaderSettingsSnapshot(), 'none'),
      pageTurnGestureState: gesture.createReaderPageGestureState(), physicalPagination: { draft: undefined }, controlVisible: () => false,
      knownPageTurnBoundary: () => undefined, preparedPageTurn: () => undefined,
      usesBookTurnSimulation: () => false, usesNoAnimationPageTurnRuntime: () => true,
      requireChapterLayoutMap: () => ({}), lastVisibleScalar: () => 500,
      measureCommittedPageAt: offset => measurements.push(offset), beginPageTurnPerf() {}, finishPageTurnPerf() {}, completeDirectPageTurnGesture() {},
      applyWindowPolicyForChromeOwner() {}, cancelSourceSwitchCompletion() {}, scheduleControlMinimum() {}, syncVolumeKeyPolicy() {},
      controlMinimumGeneration: 0, controlInputRevision: 0, stopReaderTtsAudition() {}, finishSessionCapsuleMorph() {},
      finishBookmarkRollback() {}, bookmarkRollbackGeneration: 0, captureReadingRecordElapsed() {}, clearReadingRecordTimer() {},
      flushReadingRecord: async () => {}, pauseAutoPage() {},
      onReaderPageGestureStateChanged: state => { owner.pageTurnGestureState = state; } });
    const { host } = readerRootInput(owner);
    const properties = createArkUIPropertyRuntimeProbe();
    const rawSource = read('features/reading/ui/ReaderPageInteractionLayer.ets');
    const raw = createReaderBuilderProbe(rawSource, boundedMembers(rawSource), { ...properties.sdk, ...gesture,
      ReaderPageInputClock, TouchType, readerMotionNowMs: () => clock, READER_PAGE_TAP_MAX_DURATION_MS: 500,
      READER_PAGE_POINTER_STALL_TIMEOUT_MS: 15000, setTimeout: setTimer, clearTimeout() {} }, properties.hooks).owner;
    Object.assign(raw, { interactionEnabled: owner.isReaderPageInteractionEnabled(), inputRevision: owner.pageTurnInputRevision,
      inputCurrent: componentCallback(lrePath, 'ReaderPageInteractionLayer', 'inputCurrent', owner, {}),
      onInputLost: componentCallback(lrePath, 'ReaderPageInteractionLayer', 'onInputLost', owner, {}),
      tapOnly: false, viewportWidth: 390, viewportHeight: 800, systemGestureLeftInset: 0,
      systemGestureRightInset: 0, systemGestureBottomInset: 0, allowTextSelection: false,
      onPointerStart: id => owner.acquirePagePointer(id), onPointerEnd: id => owner.releasePagePointer(id),
      onTurn: direction => owner.requestPageTurn(direction), onGestureStateChange: state => { owner.pageTurnGestureState = state; },
      onManualInteraction() {}, canStartTurn: () => owner.canTurnPage(), armLongPressTimer() {}, clearLongPressTimer() {},
      armPointerWatchdog() {}, clearPointerWatchdog() {} });
    raw.initialRender();
    const callback = [...raw.nodes.values()].find(node => node.type === 'Row').onTouch;
    callback(touch(TouchType.Down));
    if (boundary.startsWith('foreground')) {
      host.searchAppForeground = false; owner.appForeground = false; owner.onAppForegroundChanged();
      assert.ok(owner.pageTurnInputRevision > 0);
      assert.equal(owner.activePagePointerId, -1);
    }
    if (boundary === 'foreground-after-prop') {
      raw.updateStateVars({ interactionEnabled: false, inputRevision: owner.pageTurnInputRevision }); properties.flush();
    }
    if (boundary === 'foreground-return-before-prop') { host.searchAppForeground = true; owner.appForeground = true; }
    if (boundary === 'root-cover') host.arkWebCapturesInput = true;
    callback(touch(TouchType.Up));
    assert.deepEqual(measurements, boundary === 'current' ? [100] : [], `${boundary} raw first measurement`);
    if (boundary === 'foreground-return-before-prop') {
      raw.updateStateVars({ interactionEnabled: true, inputRevision: owner.pageTurnInputRevision }); properties.flush();
      callback(touch(TouchType.Down)); callback(touch(TouchType.Up));
      assert.deepEqual(measurements, [100], 'new current pointer works after the current revision arrives');
    }
  }
  const retained = Object.assign(new RawOwner(), { activePagePointerId: 7, pendingPointerSegmentReserved: true,
    pageTurnInputRevision: 4, pagePointerEpoch: 8, pageTurnSettlementActive: true,
    pageTurnSettlingPrepared: { receipt: 'accepted' }, pageTurnGestureState: { phase: 'settling' },
    pageTurnCommitStarted: true, rollbackPageTurnForDeferredMutation: () => assert.fail('accepted settlement must remain owned') });
  const receipt = retained.pageTurnSettlingPrepared;
  retained.retirePagePointer();
  assert.equal(retained.activePagePointerId, -1);
  assert.equal(retained.pageTurnInputRevision, 5);
  assert.equal(retained.pageTurnSettlingPrepared, receipt);
  assert.equal(retained.pageTurnSettlementActive, true);
  assert.equal(retained.pageTurnCommitStarted, true);
  return { rootSettingsBoundaries: boundaries.length, rawBoundaries: 5, acceptedSettlementRetained: true };
}

function directoryFlatInput() {
  const ui = name => read(`features/reading/ui/${name}.ets`);
  class Child { constructor(owner, params) { Object.assign(this, { owner, params }); } }
  const methods = ['chapterRow', 'flatChapterIsCurrent', 'flatBookmarkIsCurrent', 'bookmarkWriteEnabled',
    'currentContent', 'currentInputEnabled', 'flatList'];
  let chapterScenarios = 0;
  for (const bookmarked of [true, false]) {
    const events = [];
    const entry = { index: 7, title: '第八章', navigable: true, downloadState: 'missing',
      bookmarks: bookmarked ? [{ time: 1700000000000, chapterIndex: 7, chapterOffset: 0, chapterTitle: '第八章', content: '摘录' }] : [] };
    const content = createReaderBuilderProbe(ui('ReaderControlDirectoryContent'), methods,
      { ReaderDirectoryChapterRow: Child, ReaderBookmarkRow: Child, sameReaderDirectoryData },
      { childSources: { ReaderDirectoryChapterRow: ui('ReaderDirectoryChapterRow'), ReaderBookmarkRow: ui('ReaderBookmarkRow') } }).owner;
    Object.assign(content, { mounted: true, tab: 'directory', navigationActive: false, layoutPresentation: 1,
      interactionEnabled: true, inputCurrent: () => content.interactionEnabled, preparedMinimumRequired: true,
      presentationPrepared: () => ({ ownerCurrent: () => true }), entries: [entry], bookmarkRecovery: { bookmarkWriteEnabled: true },
      rowHeight: () => 44, currentChapterIndex: 0, chapterDownloadEnabled: true, chapterStartBookmarkCreationEnabled: true,
      onSelectChapter: index => events.push(['select', index]), onDownloadChapter: index => events.push(['download', index]),
      onDeleteBookmarks: times => events.push(['delete', times]), onCreateChapterStartBookmark: request => events.push(['create', request]) });
    content.chapterRow(entry, 1);
    const params = [...content.children.values()][0].params;
    const sdk = boundedSurfaceSdk();
    const row = sdk.consumer(ui('ReaderDirectoryChapterRow'), undefined,
      { readerDirectoryBookmarkMarkerState, readerDirectoryAccessibilityText, readerDirectoryIndentVp });
    Object.assign(row, params, { appThemeScheme: 'day' }); row.initialRender();
    const click = label => sdk.nodes(row).find(node => node.accessibilityText === label).onClick;
    const select = sdk.nodes(row).find(node => node.type === 'Row' && typeof node.onClick === 'function').onClick;
    const marker = click(bookmarked ? '删除本章已有书签' : '添加本章章首书签');
    const download = click('下载章节');
    const invoke = () => { select(); marker(); download(); };
    invoke(); assert.equal(events.length, 3);
    for (const boundary of ['input', 'presentation', 'tab', 'canonical', 'mount']) {
      Object.assign(content, { mounted: true, interactionEnabled: true, layoutPresentation: 1, tab: 'directory', entries: [entry] });
      if (boundary === 'input') content.interactionEnabled = false;
      if (boundary === 'presentation') content.layoutPresentation = 2;
      if (boundary === 'tab') content.tab = 'bookmarks';
      if (boundary === 'canonical') content.entries = [{ ...entry, title: '新版目录事实' }];
      if (boundary === 'mount') content.mounted = false;
      invoke(); assert.equal(events.length, 3, `${boundary} old chapter callbacks reject`);
      chapterScenarios += 1;
    }
  }
  const bookmark = { bookmarkId: 'bookmark-one', identityStatus: 'confirmed', chapterIndex: 7, chapterOffset: 3,
    chapterTitle: '第八章', excerpt: '当前书签内容', positionLabel: '10%', timeLabel: '今天' };
  const rows = [{ key: 'bookmark:bookmark-one', chapter: undefined, bookmark }];
  const content = createReaderBuilderProbe(ui('ReaderControlDirectoryContent'), methods,
    { ReaderDirectoryChapterRow: Child, ReaderBookmarkRow: Child, sameReaderDirectoryData,
      LazyForEach: { create(_id, _owner, data, item) { for (let index = 0; index < data.totalCount(); index++) item(data.getData(index), index); }, pop() {} } },
    { childSources: { ReaderDirectoryChapterRow: ui('ReaderDirectoryChapterRow'), ReaderBookmarkRow: ui('ReaderBookmarkRow') } }).owner;
  let selected = 0;
  Object.assign(content, { mounted: true, interactionEnabled: true, layoutPresentation: 1, tab: 'bookmarks', shortContent: false,
    preparedMinimumRequired: false, inputCurrent: () => content.interactionEnabled, headerCount: () => 0,
    displaySnapshot: () => ({ rows }), rowHeight: () => 80, rowPadding: () => 10, rowWidth: () => 286,
    bookmarkNaturalSize: () => undefined, progress: 1,
    dataSource: { totalCount: () => rows.length, getData: index => rows[index], registerDataChangeListener() {}, unregisterDataChangeListener() {} },
    onSelectBookmark: () => selected++ });
  content.flatList(1);
  const params = [...content.children.values()].find(child => child.params.row?.bookmarkId === bookmark.bookmarkId).params;
  const sdk = boundedSurfaceSdk();
  const row = sdk.consumer(ui('ReaderBookmarkRow'), boundedMembers(ui('ReaderBookmarkRow')), { sampleReaderControlBookmark });
  Object.assign(row, params); row.initialRender();
  const callback = sdk.nodes(row).find(node => typeof node.onClick === 'function').onClick;
  callback(); assert.equal(selected, 1);
  content.interactionEnabled = false; callback(); assert.equal(selected, 1);
  content.interactionEnabled = true; content.layoutPresentation = 2; callback(); assert.equal(selected, 1);
  content.layoutPresentation = 1; rows[0] = { ...rows[0], bookmark: { ...bookmark, chapterOffset: 8 } };
  callback(); assert.equal(selected, 1);
  return { chapterRetirementScenarios: chapterScenarios, bookmarkRetirementScenarios: 3 };
}

for (const id of cases) {
  const result = await ({ 'shelf-filter-admission': shelfFilters, 'mode-async-admission': modeAdmission,
    'theme-async-admission': themeAdmission, 'reader-live-input': readerLiveInput, 'directory-flat-input': directoryFlatInput }[id])();
  console.log(JSON.stringify({ case: id, result,
    scope: 'Actual production callback/method/Host/Store contracts with explicit finite persistence and native SDK ports. No device action.' }));
  recordContractCasePass(id);
}

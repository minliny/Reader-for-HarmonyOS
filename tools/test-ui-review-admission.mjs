import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectedProductionMethods, selectedProductionValues, selectedProductionClasses, selectedProductionComponentCallback } from './lib/selected-production-methods.mjs';
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
  'reader-grab-live-admission': 'Both actual grab touch callbacks reject a new unavailable DOWN, recover on the same actor and finish an accepted pointer while unavailable.',
  'manga-live-input': 'Actual Root/Shell/Manga settings Button and gesture/boundary first admission.',
  'continuous-live-input': 'Actual continuous Stage retires old parent revisions before native scrollPage.',
  'semantic-directory-input': 'Actual semantic marker checks original Content/Surface/List input and canonical chapter.',
  'search-live-input': 'Actual search history native Button and Host queue consume current visibility before first write.',
  'directory-flat-input': 'Actual flat chapter and bookmark callbacks reject retired input, content and canonical row data.',
});
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function componentCallback(path, component, property, owner, bindings) {
  return selectedProductionComponentCallback(new URL(path, root), component, property, owner, bindings);
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
    ['readingContentIsForeground', 'readingIdentityKey', 'mangaIdentityKey', 'isMangaSurfaceCurrent', 'acceptsMangaInput']);
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
  const methods = ['chapterRow', 'flatChapterIsCurrent', 'chapterIsCurrent', 'directoryInputCurrent', 'flatBookmarkIsCurrent', 'bookmarkWriteEnabled',
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

async function mangaLiveInput() {
  const path = 'features/manga/ui/MangaReadingSurface.ets';
  const source = read(path);
  const writes = [], brightness = [], pendingSave = deferred();
  const sdk = boundedSurfaceSdk();
  const methods = ['settingsPanel', 'sheetChoice', 'sectionTitle', 'preferencePanelInputCurrent', 'panelInputCurrent',
    'readerPanelForeground', 'setBackground', 'setPageNumbers', 'setBrightness', 'displayedBrightnessPercent',
    'phonePanelBackgroundEnabled', 'viewportGestureCurrent', 'onViewportTouch', 'onPanelForegroundChanged',
    'boundaryEnabled', 'onBoundaryPull', 'onBoundaryActivity', 'turnBoundaryChapter'];
  const owner = sdk.consumer(source, methods, { readerBrightnessWindowValue: value => value / 100,
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }), brightness: () => ({ request: async (_owner, value) => brightness.push(value) }) } });
  Object.assign(owner, { mounted: true, exiting: false, appForeground: true, windowChromeActive: true,
    windowChromeOverlayActive: false, interactionBlocked: false, isReaderIdentityCurrent: () => true,
    actionPanelPresentationGeneration: 1, panel: 'settings', panelPhase: 'open', panelFocusGeneration: 0,
    pageTurnInputRevision: 0, viewportInputRevision: -1, boundaryInputRevision: -1, panelGeneration: 1,
    brightnessOwner: 1, brightnessGeneration: 0, brightnessPercent: 78, backgroundPreference: 'paper', showPageNumbers: true,
    choiceIcon: kind => kind, isSheetChoiceSelected: () => false, mutedColor: () => '#333333',
    inkColor: () => '#111111', accentColor: () => '#008800', greenColor: () => '#008800', softSurfaceColor: () => '#ffffff', lineColor: () => '#cccccc',
    settingsGateway: { updateMangaPreferences: value => { writes.push(value); return pendingSave.promise; } },
    cancelPanelOpening() {}, widePanel: () => true, opened: true, horizontal: false, zoom: 1,
    recovering: false, chapterEnd: false, restoringAnchor: false, loginRequiredForControls: false,
    error: '', boundaryBusy: false, rollbackPainting: false, presentationGeneration: 0, layoutGeneration: 0,
    flushViewportObservation() {}, confirmedPosition: { anchor: {} }, reduceMotion: true });
  const { host, reading, shell } = readerRootInput(owner);
  shell.contentKind = 'manga'; shell.mangaChapterRequestGeneration = 11;
  owner.inputCurrent = componentCallback('features/reading/ui/ReaderShell.ets', 'MangaReadingSurface', 'inputCurrent', shell,
    { _identity: shell.mangaIdentityKey() });
  owner.settingsPanel(1);
  const nodes = sdk.nodes(owner);
  const ink = nodes.find(node => node.type === 'Button' && node.accessibilityText.startsWith('深墨'));
  const numbers = nodes.find(node => node.type === 'Button' && node.accessibilityText.startsWith('常驻页码'));
  const slider = nodes.find(node => node.type === 'Slider');
  ink.onClick(); assert.deepEqual(writes, [{ mangaBackground: 'ink' }]);
  for (const boundary of ['foreground', 'arkweb', 'source', 'manga', 'identity', 'runtime', 'retired', 'manga-opening']) {
    host.searchAppForeground = true; host.arkWebCapturesInput = false; host.switchPresented = false;
    host.mangaSourceSwitch.selectionVisible = false; host.shelfReceiptRetired = false;
    const runtime = host.mountedRuntimeOwner; reading.readyGeneration = 7; shell.mangaChapterRequestGeneration = 11;
    if (boundary === 'foreground') host.searchAppForeground = false;
    if (boundary === 'arkweb') host.arkWebCapturesInput = true;
    if (boundary === 'source') host.switchPresented = true;
    if (boundary === 'manga') host.mangaSourceSwitch.selectionVisible = true;
    if (boundary === 'identity') reading.readyGeneration = 8;
    if (boundary === 'runtime') host.mountedRuntimeOwner = {};
    if (boundary === 'retired') host.shelfReceiptRetired = true;
    if (boundary === 'manga-opening') shell.mangaChapterRequestGeneration = 12;
    ink.onClick(); numbers.onClick(); slider.onChange(90);
    assert.equal(writes.length, 1, `${boundary} first preference admission`);
    assert.equal(brightness.length, 0, `${boundary} first brightness admission`);
    owner.panel = ''; owner.panelPhase = 'closed';
    assert.equal(owner.boundaryEnabled(), false);
    assert.equal(await owner.turnBoundaryChapter(1), '');
    owner.panel = 'settings'; owner.panelPhase = 'open';
    host.mountedRuntimeOwner = runtime;
  }
  host.shelfReceiptRetired = false; shell.mangaChapterRequestGeneration = 11; reading.readyGeneration = 7;
  owner.onViewportTouch(); assert.equal(owner.viewportGestureCurrent(), true);
  owner.appForeground = false; owner.onPanelForegroundChanged(); owner.appForeground = true;
  assert.equal(owner.viewportGestureCurrent(), false, 'old gesture stays retired after foreground return');
  owner.onViewportTouch(); assert.equal(owner.viewportGestureCurrent(), true);
  owner.panel = ''; owner.panelPhase = 'closed'; owner.boundaryDragging = false;
  owner.onBoundaryActivity(true); assert.equal(owner.boundaryInputRevision, owner.pageTurnInputRevision);
  owner.appForeground = false; owner.onPanelForegroundChanged(); owner.appForeground = true;
  assert.equal(await owner.turnBoundaryChapter(1), '', 'old boundary pull cannot first enter a chapter transfer');
  pendingSave.resolve(); await Promise.resolve();
  assert.equal(writes.length, 1, 'accepted save keeps its original gateway receipt');
  return { liveBoundaries: 8, retiredGestureRejected: true, acceptedSaveRetained: true };
}

function continuousLiveInput() {
  const path = 'features/reading/ui/LocalReadingExperience.ets';
  const Owner = selectedProductionMethods(new URL(path, root), 'ReadingExperience',
    ['readerInputIsCurrent', 'isReaderPageInteractionEnabled', 'requestPageTurn', 'drainRapidPageTurn',
      'performPageTurn', 'performContinuousPageTurn', 'acquirePagePointer', 'releasePagePointer', 'retirePagePointer', 'pageTurnInputPhase'],
    { ...rapid, readerControlHostInputEnabled, readerPageTransitionUsesPreparedPages, setTimeout: () => 1 });
  const TouchType = { Down: 0, Up: 1, Move: 2, Cancel: 3 };
  let clock = 1000;
  const Stage = selectedProductionMethods(new URL('features/reading/ui/ReaderContinuousReadingStage.ets', root), 'ReaderContinuousReadingStage',
    ['handleTouch', 'handleStationaryTap', 'resetTouch', 'acceptCurrentInput', 'onInputRevisionChanged', 'onInteractionEnabledChanged', 'reportManualInteraction'],
    { TouchType, ReaderPageInputClock, readerMotionNowMs: () => clock, CONTINUOUS_TAP_SLOP: 12, READER_PAGE_GESTURE_LONG_PRESS_MS: 500 });
  for (const boundary of ['current', 'foreground', 'foreground-return', 'root-cover']) {
    const scrolls = [];
    const owner = Object.assign(new Owner(), { mounted: true, exitRequested: false, appForeground: true,
      windowChromeActive: true, interactionBlocked: false, controlObscured: false, isReaderIdentityCurrent: () => true,
      controlVisible: () => false, pageTurnInputRevision: 0, activePagePointerId: -1, pagePointerEpoch: 0, lifecycleToken: 1,
      pendingPointerSegmentReserved: false, pageTurnPreparationQueue: [], pageTurnGestureState: { phase: 'idle' }, pageTurnTransactionSerial: 0,
      pageTurnSettlementActive: false, commitInFlight: false, phase: 'ready', chapter: { chapterIndex: 0 },
      readerSettingsSnapshot: { navigationMode: 'continuous' }, rapidPageTurnState: rapid.createReaderRapidPageTurnState(),
      progressProducers: { continuousInFlight: false }, continuousFragments: [{}], canTurnPage: () => true,
      isContinuousScrollerAtStart: () => false, isContinuousScrollerAtEnd: () => false,
      continuousScroller: { scrollPage: params => scrolls.push(params) }, continuousProgrammaticScrollIntent() {} });
    const { host } = readerRootInput(owner);
    const stage = Object.assign(new Stage(), { interactionEnabled: true, inputRevision: 0, touchActive: false,
      touchPointerId: -1, completedStationaryTouch: false, layout: { viewportWidth: 390 },
      inputCurrent: componentCallback(path, 'ReaderContinuousReadingStage', 'inputCurrent', owner, {}),
      onInputLost: componentCallback(path, 'ReaderContinuousReadingStage', 'onInputLost', owner, {}),
      onPointerStart: id => owner.acquirePagePointer(id), onPointerEnd: id => owner.releasePagePointer(id),
      onTurn: direction => owner.requestPageTurn(direction), onOpenControl() {}, onManualInteraction() {}, cancelInitialScrollForInput() {},
      onBoundaryDrag: () => assert.fail('stationary tap has no boundary drag'), isScrollerAtEnd: () => false, isScrollerAtStart: () => false });
    const touch = type => ({ type, timestamp: (clock += 20) * 1e6,
      changedTouches: [{ id: 7, x: 300, y: 200 }], touches: [{ id: 7, x: 300, y: 200 }] });
    stage.handleTouch(touch(TouchType.Down));
    if (boundary.startsWith('foreground')) {
      owner.appForeground = false; host.searchAppForeground = false; owner.retirePagePointer();
      assert.equal(owner.pageTurnInputRevision, 1);
      if (boundary === 'foreground-return') { owner.appForeground = true; host.searchAppForeground = true; }
    }
    if (boundary === 'root-cover') host.arkWebCapturesInput = true;
    stage.handleTouch(touch(TouchType.Up));
    stage.handleStationaryTap({ fingerList: [{ localX: 300 }] });
    assert.equal(scrolls.length, boundary === 'current' ? 1 : 0, boundary);
    if (boundary === 'foreground-return') {
      stage.inputRevision = owner.pageTurnInputRevision; stage.onInputRevisionChanged();
      stage.handleTouch(touch(TouchType.Down)); stage.handleTouch(touch(TouchType.Up));
      stage.handleStationaryTap({ fingerList: [{ localX: 300 }] });
      assert.equal(scrolls.length, 1, 'fresh current revision permits a fresh pointer');
      owner.activePagePointerId = 7; stage.touchPointerId = 7;
      stage.onInputRevisionChanged(); assert.equal(owner.activePagePointerId, 7, 'old child cannot release a newer same-id parent pointer');
    }
  }
  return { boundaries: 4, currentNativeScroll: 1, oldPointerNativeScroll: 0, freshPointerNativeScroll: 1 };
}

function semanticDirectoryInput() {
  const contentPath = 'features/reading/ui/ReaderControlDirectoryContent.ets';
  const Content = selectedProductionMethods(new URL(contentPath, root), 'ReaderControlDirectoryContent',
    ['currentContent', 'currentInputEnabled', 'directoryInputCurrent', 'chapterIsCurrent', 'bookmarkWriteEnabled'], { sameReaderDirectoryData });
  const chapter = { index: 7, title: '第八章', navigable: true, downloadState: 'missing',
    bookmarks: [{ time: 123, chapterIndex: 7, chapterOffset: 0, chapterTitle: '第八章', content: '当前摘录' }] };
  const calls = [];
  const content = Object.assign(new Content(), { mounted: true, layoutPresentation: 1, interactionEnabled: true,
    preparedMinimumRequired: false, inputCurrent: () => true, tab: 'directory', entries: [chapter], bookmarkRecovery: { bookmarkWriteEnabled: true },
    onDeleteBookmarks: times => calls.push(times) });
  const inputCurrent = componentCallback(contentPath, 'ReaderDirectoryNavigationSurface', 'inputCurrent', content, { presentation: 1 });
  const chapterInputCurrent = componentCallback(contentPath, 'ReaderDirectoryNavigationSurface', 'chapterInputCurrent', content, { presentation: 1 });
  const onDeleteBookmarks = componentCallback(contentPath, 'ReaderDirectoryNavigationSurface', 'onDeleteBookmarks', content, { presentation: 1 });
  const Surface = selectedProductionMethods(new URL('features/reading/ui/ReaderDirectoryNavigationSurface.ets', root),
    'ReaderDirectoryNavigationSurface', ['directoryInputCurrent', 'currentInputOwnerKey']);
  const surface = Object.assign(new Surface(), { mounted: true, interactionEnabled: true, awaitingRulesRefresh: false,
    sourceId: 'source', bookId: 'book', openRevision: 'opening', bookmarkActionsEnabled: true, inputCurrent, chapterInputCurrent, onDeleteBookmarks });
  surface.inputOwnerKey = surface.currentInputOwnerKey();
  const listInput = componentCallback('features/reading/ui/ReaderDirectoryNavigationSurface.ets', 'ReaderDirectoryNavigationList', 'inputCurrent', surface, {});
  const listDelete = componentCallback('features/reading/ui/ReaderDirectoryNavigationSurface.ets', 'ReaderDirectoryNavigationList', 'onDeleteBookmarks', surface, {});
  const controls = foundationControls();
  const row = createReaderBuilderProbe(read('features/reading/ui/ReaderDirectoryNavigationList.ets'),
    ['row', 'currentPaintNode', 'displayLevel', 'textRowAccessibility', 'marker', 'bookmarkActionEnabled', 'directoryInputCurrent'],
    { ...controls.dependencies, readerDirectoryBookmarkMarkerState }, controls.hooks).owner;
  const node = { nodeId: 'chapter:7', chapterIndex: 7, title: chapter.title, kind: 'target', depth: 0, hasChildren: false };
  Object.assign(row, { mounted: true, interactionEnabled: true, inputCurrent: listInput, chapterInputCurrent,
    bookmarkActionsEnabled: true, chapterStartBookmarkCreationEnabled: true, chapterDownloadEnabled: false,
    onDeleteBookmarks: listDelete, rowHeight: 44, rowPresentationRevision: 0, appThemeScheme: 'day', view: { viewId: 'view' },
    dataSource: { currentView: () => row.view, loadedItemById: () => ({ node, index: 7 }) },
    chapterByIndex: new Map([[7, chapter]]), isCurrentNode: () => false });
  row.row({ node, index: 7 });
  const marker = controls.nodes(row).find(item => item.type === 'Button' && item.accessibilityText === '删除本章已有书签');
  marker.onClick(); assert.deepEqual(calls, [[123]]);
  for (const boundary of ['input', 'presentation', 'content-mount', 'surface-mount', 'list-mount', 'canonical']) {
    Object.assign(content, { interactionEnabled: true, layoutPresentation: 1, mounted: true, entries: [chapter] });
    surface.mounted = true; row.mounted = true;
    if (boundary === 'input') content.interactionEnabled = false;
    if (boundary === 'presentation') content.layoutPresentation = 2;
    if (boundary === 'content-mount') content.mounted = false;
    if (boundary === 'surface-mount') surface.mounted = false;
    if (boundary === 'list-mount') row.mounted = false;
    if (boundary === 'canonical') content.entries = [{ ...chapter, bookmarks: [] }];
    marker.onClick(); assert.equal(calls.length, 1, boundary);
  }
  return { actualNativeMarkerWrites: 1, retiredAndCanonicalBoundaries: 6 };
}

async function searchLiveInput() {
  const { ReaderLibrarySearchModel } = selectedProductionClasses(new URL('features/search/presentation/ReaderLibrarySearchModel.ets', root), ['ReaderLibrarySearchModel']);
  const Page = selectedProductionMethods(new URL('features/search/ui/SearchPage.ets', root), 'SearchPage',
    ['bindSurface', 'ownsSurface', 'surfaceInputCurrent', 'ownsPageQuery', 'pageInputCurrent', 'acceptsFilter', 'acceptsTaskStatus'], { nextSearchSurfaceOwner: 0 });
  const Surface = selectedProductionMethods(new URL('features/search/ui/ReaderLibrarySearchSurface.ets', root), 'ReaderLibrarySearchSurface',
    ['clearHistoryAction', 'historyInteractive', 'inputInteractive']);
  const Results = selectedProductionMethods(new URL('features/search/ui/LibrarySearchResults.ets', root), 'LibrarySearchResults', ['inputCurrent']);
  const Host = selectedProductionMethods(new URL('features/search/application/SearchHost.ets', root), 'SearchHost', ['clearHistory']);
  const Orchestrator = selectedProductionMethods(new URL('features/search/application/SearchOrchestrator.ets', root), 'SearchOrchestrator',
    ['clearHistory', 'loadEntryHistory', 'enqueueHistoryWrite', 'isCurrentSession'], { hilog: { error() {} }, DOMAIN: 0 });
  const result = [];
  for (const boundary of ['current', 'foreground', 'arkweb', 'retired', 'accepted']) {
    const state = { visible: true, current: true, writes: 0 };
    const save = deferred();
    const orchestrator = Object.assign(new Orchestrator(), { sessionOpen: true, session: 1, historyRevision: 0,
      historyClearing: false, historyStatus: 'ready', entryHistory: ['query'], presentEntryHistory() {},
      gateway: { clearHistory: async () => { state.writes++; await save.promise; }, loadHistory: async () => ({ keywords: [] }) } });
    const host = Object.assign(new Host(), { getOrchestrator: () => orchestrator });
    const results = Object.assign(new Results(), { isCurrent: () => state.current, isVisible: () => state.visible, presentation: { host } });
    const model = new ReaderLibrarySearchModel();
    const page = Object.assign(new Page(), { pageMounted: true, pageEpoch: 1, queryAtMount: 1,
      viewState: { pageRevision: 1, revision: 1 }, isPresentationCurrent: results.isCurrent,
      isPresentationVisible: results.isVisible, surfaceModel: model, publishSurface() {}, filtersExpanded: true, taskStatusExpanded: true,
      filterPresentationIdentity: () => 'filter', taskStatusIdentity: () => 'task',
      onClearHistory: componentCallback('features/search/ui/LibrarySearchResults.ets', 'SearchPage', 'onClearHistory', results, {}) });
    page.bindSurface();
    const surface = Object.assign(new Surface(), { mounted: true, mode: 'input', model,
      surfaceProgress: () => 1, historyProgress: () => 1, resultsProgress: () => 1 });
    const controls = foundationControls();
    const panel = createReaderBuilderProbe(read('features/search/ui/ReaderSearchHistoryPanel.ets'), ['build', 'actionsEnabled'],
      controls.dependencies, controls.hooks).owner;
    Object.assign(panel, { appThemeScheme: 'day', status: 'ready', history: ['query'], geometry: { headingVisible: true, headingHeight: 44 },
      projectedRows: () => [], onClear: surface.clearHistoryAction(model.currentOwner()) });
    panel.initialRender();
    const clear = controls.nodes(panel).find(node => node.type === 'Button' && node.accessibilityText === '清空搜索历史');
    if (boundary === 'foreground' || boundary === 'arkweb') state.visible = false;
    if (boundary === 'retired') state.current = false;
    clear.onClick();
    for (let tick = 0; tick < 4; tick++) await Promise.resolve();
    assert.equal(state.writes, ['current', 'accepted'].includes(boundary) ? 1 : 0, boundary);
    if (boundary === 'accepted') { state.visible = false; state.current = false; }
    if (!state.visible || !state.current) {
      assert.equal(page.acceptsFilter('filter'), false); assert.equal(page.acceptsTaskStatus('task'), false);
    }
    save.resolve();
    for (let tick = 0; tick < 12; tick++) await Promise.resolve();
    assert.equal(orchestrator.historyClearing, false, 'accepted history queue reaches its original terminal receipt');
    result.push({ boundary, writes: state.writes });
  }
  return { samples: result, acceptedHistoryReceiptRetained: true };
}

async function readerGrabLiveAdmission() {
  const resolution = registerHooks({ resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !specifier.endsWith('.ts'))
        return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  } });
  try {
const { ReaderControlRuntime } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlRuntime.ts');
const session = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
const { ReaderPageInputClock } = await import('../entry/src/main/ets/features/reading/ui/ReaderPageInputClock.ts');
const { readerControlHostInputEnabled } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts');
const { admitReaderControlVisualSnapshot } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlVisualHostPort.ts');

const root = new URL('../entry/src/main/ets/', import.meta.url);
const file = path => new URL(path, root);
const panelFile = file('features/reading/ui/ReaderControlPanel.ets');
const localFile = file('features/reading/ui/LocalReadingExperience.ets');
const shellFile = file('features/reading/ui/ReaderShell.ets');
const Index = selectedProductionMethods(file('pages/Index.ets'), 'Index', ['readerContentInputCurrent'], {
  retainedReaderRoute: route => route,
});
const Shell = selectedProductionMethods(shellFile, 'ReaderShell', ['readingContentIsForeground', 'readingIdentityKey']);
const Local = selectedProductionMethods(localFile, 'ReadingExperience', [
  'readerInputIsCurrent', 'isControlInputEnabled', 'onControlInputActivity',
  'cancelControlNavigationIntent', 'invalidateControlBackdrop',
], { readerControlHostInputEnabled, createReaderControlBackdropTouchState: () => ({ pointerId: -1 }) });
const touchTypes = { Down: 0, Move: 1, Up: 2, Cancel: 3 };
const dependencies = { DEBUG: false, TouchType: touchTypes, ReaderPageInputClock,
  readerMotionNowMs: () => 1000, ...session };
const names = ['headerGrabCap', 'controlTouchHandler', 'handleControlTouch', 'acceptRuntime', 'commitVisualSession',
  'currentMinimumIdentity', 'committedMinimumIdentity', 'minimumPresentationAvailable', 'minimumInputReady'];

function sample(lost, consumer, ending) {
  const identity = JSON.stringify(['local', 'existing-book', 1]);
  const index = Object.assign(new Index(), {
    currentReadingRuntime: () => ({}), readingEntry: { sessionActive: true },
    currentReaderPresentationIdentity: () => identity, route: 'reading', directoryReturnTarget: 'reading',
    searchAppForeground: true, arkWebCapturesInput: false, shelfMotion: { pendingExitId: -1, request: undefined },
    sourceSwitchPresentation: { isSurfacePresented: () => false }, mangaSourceSwitch: { selectionVisible: false },
  });
  const scene = { ports: { inputCurrent: value => index.readerContentInputCurrent(value) } };
  const shell = Object.assign(new Shell(), {
    inputCurrent: selectedProductionComponentCallback(file('app/composition/RetainedReaderScene.ets'), 'ReaderShell', 'inputCurrent', scene),
    sourceId: 'local', bookId: 'existing-book', readingReadyGeneration: 1,
    inputAllowed: true, visible: true, route: 'reading', sourceSwitchPresented: false, sourceSwitchCovered: false,
  });
  const local = Object.assign(new Local(), {
    mounted: true, exitRequested: false, appForeground: true, windowChromeActive: true,
    interactionBlocked: false, controlObscured: false, isReaderIdentityCurrent: () => true,
    inputCurrent: selectedProductionComponentCallback(shellFile, 'ReadingExperience', 'inputCurrent', shell, { _identity: identity }),
    controlNavigationIntent: { generation: 7, page: 'moduleDirectory' }, controlNavigationGeneration: 7,
    controlMinimumGeneration: 4, controlInputRevision: 2, activeControlNavigationIntent() { return this.controlNavigationIntent; },
    controlsPresentedForWindow: () => true, admitSessionControlClosing() {}, applyWindowPolicyForChromeOwner() {},
  });
  const actualSource = readFileSync(panelFile, 'utf8');
  const anchor = actualSource.indexOf(".id('reader-control-motion-grabber')");
  const nativeStart = actualSource.lastIndexOf('        Stack({ alignContent: Alignment.TopStart }) {', anchor);
  const touchEnd = actualSource.indexOf('.onTouch(this.controlTouchHandler());', anchor) + '.onTouch(this.controlTouchHandler());'.length;
  assert.ok(nativeStart > 0 && touchEnd > anchor);
  const nativeSubtree = actualSource.slice(nativeStart, touchEnd);
  // Preserve the exact central Stack and fluent attributes in a bounded SDK
  // builder. The outer dock's geometry, AX builder and frame scheduler are ports.
  const close = actualSource.lastIndexOf('\n}');
  const probeSource = actualSource.slice(0, close) + '\n  @Builder private selectedCentralGrabber() {\n' + nativeSubtree + '\n  }\n' + actualSource.slice(close);
  const panel = createReaderBuilderProbe(probeSource, [...names, 'selectedCentralGrabber'], dependencies).owner;
  const config = { axis: { fullGrabberScreenY: 100, quickGrabberScreenY: 500, hiddenGrabberScreenY: 850 },
    tapMaxDurationMs: 500, directionSlopVp: 8, settleDurationMs: 0, coordinatedMotion: false };
  const runtime = new ReaderControlRuntime(config);
  const opened = session.openReaderControlSession(session.createReaderControlSessionState(), 0);
  runtime.start(opened);
  const geometry = { x: 0, y: 0, width: 300, height: 44 };
  const receipt = { identity: 'original-minimum', ownerKey: 'original-owner', environmentKey: 'original-environment',
    key: 'original-key', layout: { minimumKey: 'original-key', contentBudget: { quickContentHeightVp: 190 } },
    profile: { identity: 'original-minimum', module: 'home' } };
  const publications = [];
  const visual = selectedProductionComponentCallback(localFile, 'ReaderControlPanel', 'onVisualSessionChange', local,
    { admitReaderControlVisualSnapshot });
  Object.assign(panel, {
    runtime, runtimeMounted: true, runtimeLifecycle: 1, minimumOwnerKey: 'original-owner',
    inputEnabled: true, controlObscured: false, temporaryLayerActive: false,
    inputCurrent: selectedProductionComponentCallback(localFile, 'ReaderControlPanel', 'inputCurrent', local),
    sessionLaunch: undefined, preparedMinimumRequired: true, presentationReceipt: receipt,
    minimumCommittedIdentity: 'original-minimum', minimumEnvironmentKey: 'original-environment',
    minimumReceiptCurrent: () => true, contentMotionProgress: 0, currentMoreMenuOwnerScope: () => 'same-opening',
    headerGrabCapFrame: () => geometry, headerGrabResponseRegions: () => [geometry],
    onInputActivity: selectedProductionComponentCallback(localFile, 'ReaderControlPanel', 'onInputActivity', local),
    controlSession: session.copyReaderControlSessionState(opened),
    visualSession: session.copyReaderControlSessionState(opened), moreMenuVisible: false,
    rememberVisibleContentLocation() {}, syncProgressInput() {}, frame: () => ({ progress: 0, visibility: 1, grabber: { width: 24, height: 4, x: 150, y: 500, opacity: 1 },
      content: { width: 286, height: 190 }, shell: geometry, dock: { translateY: 0 } }),
    onSessionRequest() {}, onDismiss() {}, accessibleControlActions() {}, appScheme: 'day',
    currentLayout: () => ({ fullPanelWidth: 300 }), contentLocation: () => ({ level: 'home', form: 'quick' }),
    dockRect: {}, rootScreenX: 0, rootScreenY: 0, dockLeft: () => 0, dockTop: () => 0,
    reportBackdropRegions() {}, confirmLaunchSourceReady() {}, scheduleRuntimeFrame() {},
    onVisualSessionChange: state => { publications.push({ heldPointerId: state.heldPointerId, epoch: state.epoch }); visual(state); },
  });
  if (consumer === 'central') panel.selectedCentralGrabber(); else panel.headerGrabCap();
  const cap = [...panel.nodes.values()].find(node => typeof node.onTouch === 'function');
  assert.ok(cap, 'actual SDK header cap has the production onTouch');
  if (lost) index.searchAppForeground = false;
  const before = { originalLiveCurrent: panel.inputCurrent(), cachedInputEnabled: panel.inputEnabled,
    geometryReady: panel.minimumInputReady(), heldPointerId: runtime.owner(), navigationPresent: !!local.controlNavigationIntent };
  const event = { type: touchTypes.Down, timestamp: 1000000000,
    changedTouches: [{ id: 5, windowY: 500 }], touches: [{ id: 5, windowY: 500 }], stopPropagation() {} };
  const originalIntent = local.controlNavigationIntent, originalClock = panel.inputClock;
  cap.onTouch(event);
  const after = { heldPointerId: runtime.owner(), navigationPresent: !!local.controlNavigationIntent,
    navigationGeneration: local.controlNavigationGeneration, inputRevision: local.controlInputRevision,
    publishedHeldPointerId: local.latestControlVisualSession?.heldPointerId, publications: publications.slice() };
  if (lost) {
    assert.equal(runtime.owner(), -1);
    assert.equal(local.controlNavigationIntent, originalIntent);
    assert.equal(local.controlNavigationGeneration, 7);
    assert.equal(local.controlMinimumGeneration, 4);
    assert.equal(local.controlInputRevision, 2);
    assert.equal(panel.inputClock, originalClock);
    assert.equal(publications.length, 0);
    index.searchAppForeground = true;
    cap.onTouch(event);
  }
  assert.equal(runtime.owner(), 5, 'a fresh allowed DOWN owns its original pointer');
  assert.equal(local.controlNavigationIntent, undefined);
  assert.equal(local.controlNavigationGeneration, 8);
  index.searchAppForeground = false;
  cap.onTouch({ ...event, type: touchTypes.Move, timestamp: event.timestamp + 20000000,
    changedTouches: [{ id: 5, windowY: 505 }], touches: [{ id: 5, windowY: 505 }] });
  assert.equal(runtime.owner(), 5, 'accepted MOVE remains owned despite later live loss');
  cap.onTouch({ ...event, type: ending === 'cancel' ? touchTypes.Cancel : touchTypes.Up,
    timestamp: event.timestamp + 30000000,
    changedTouches: [{ id: 5, windowY: 505 }], touches: [{ id: 5, windowY: 505 }] });
  assert.equal(runtime.owner(), -1, 'accepted UP/CANCEL releases its pointer');
  assert.equal(local.latestControlVisualSession.heldPointerId, -1);
  index.searchAppForeground = true;
  return { lost, consumer, ending, before, after, finalHeldPointerId: runtime.owner(),
    finalInputCurrent: panel.inputCurrent(), finalNavigationGeneration: local.controlNavigationGeneration };

}

const samples = [];
for (const consumer of ['header', 'central']) for (const lost of [false, true]) for (const ending of ['up', 'cancel'])
  samples.push(sample(lost, consumer, ending));
return { samples, boundary: 'Exact native SDK cap/central Stack subtree and current Root-to-Panel callbacks with actual Runtime/reducers. Finite geometry, AX/frame scheduler and session-request sinks. No device action.' };
  } finally { resolution.deregister(); }
}

for (const id of cases) {
  const result = await ({ 'reader-grab-live-admission': readerGrabLiveAdmission, 'shelf-filter-admission': shelfFilters, 'mode-async-admission': modeAdmission,
    'theme-async-admission': themeAdmission, 'reader-live-input': readerLiveInput, 'directory-flat-input': directoryFlatInput, 'manga-live-input': mangaLiveInput,
    'continuous-live-input': continuousLiveInput, 'semantic-directory-input': semanticDirectoryInput, 'search-live-input': searchLiveInput }[id])();
  console.log(JSON.stringify({ case: id, result,
    scope: 'Actual production callback/method/Host/Store contracts with explicit finite persistence and native SDK ports. No device action.' }));
  recordContractCasePass(id);
}

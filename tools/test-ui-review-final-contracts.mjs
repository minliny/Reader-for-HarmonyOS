import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { selectedProductionMethods, selectedProductionComponentCallback } from './lib/selected-production-methods.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { readerControlHostInputEnabled } from '../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts';
import { retainedReaderRoute } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { ReaderStartupContentOwner } from '../entry/src/main/ets/app/ReaderStartupContentOwner.ts';
import { switchControls } from './lib/reader-switch-control-probe.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = selectContractCases({
  'failure-first-input': 'Actual text/cache/manga failure native callbacks reject a new retry after live Root input loss, recover on the same owner and retain accepted business retries.',
  'startup-font-admission': 'Exact Ability checked-font promise and actual startup owner preserve rejection before/during stage creation and admit a successful checked load.',
  'settings-foreground-recovery': 'Actual Settings switch, theme and cache controls recover their retained action bindings after a background receipt and still reject live input loss before local delivery.',
  'multi-select-foreground-recovery': 'Actual multi-select header/footer and row accessibility recover after the original selection owner publishes readiness in background.',
  'slider-terminals': 'Actual automatic-page and manga Sliders commit once for complete SDK click/drag sequences, preserve Moving preview and reject retired input.',
});
const root = new URL('../entry/src/main/ets/', import.meta.url);
const file = path => new URL(path, root);
const read = path => readFileSync(file(path), 'utf8');
const localPath = 'features/reading/ui/LocalReadingExperience.ets';
const mangaPath = 'features/manga/ui/MangaReadingSurface.ets';
const abilityPath = 'entryability/EntryAbility.ets';
const settle = async () => {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
};

function rootInput() {
  const Root = selectedProductionMethods(file('pages/Index.ets'), 'Index', ['readerContentInputCurrent'], { retainedReaderRoute });
  const Entry = selectedProductionMethods(file('features/reading/presentation/ReadingEntryPresentation.ets'),
    'ReadingEntryPresentation', ['readerPresentationIdentity']);
  const reading = Object.assign(new Entry(), { sessionActive: true, book: { sourceId: 'local', bookId: 'book' }, readyGeneration: 1 });
  const index = Object.assign(new Root(), {
    currentReadingRuntime: () => ({}), readingEntry: reading,
    currentReaderPresentationIdentity: () => reading.readerPresentationIdentity(),
    route: 'reading', directoryReturnTarget: 'readerControl', searchAppForeground: true, arkWebCapturesInput: false,
    sourceSwitchPresentation: { isSurfacePresented: () => false },
    mangaSourceSwitch: { selectionVisible: false },
  });
  const Shell = selectedProductionMethods(file('features/reading/ui/ReaderShell.ets'), 'ReaderShell',
    ['readingContentIsForeground', 'readingIdentityKey', 'mangaIdentityKey', 'isMangaSurfaceCurrent', 'acceptsMangaInput']);
  const scene = { ports: { inputCurrent: identity => index.readerContentInputCurrent(identity) } };
  const shell = Object.assign(new Shell(), {
    sourceId: 'local', bookId: 'book', readingReadyGeneration: 1, mangaChapterRequestGeneration: 0,
    contentKind: 'text', inputAllowed: true, visible: true, route: 'reading',
    sourceSwitchPresented: false, sourceSwitchCovered: false,
    inputCurrent: selectedProductionComponentCallback(file('app/composition/RetainedReaderScene.ets'), 'ReaderShell', 'inputCurrent', scene),
  });
  const inputFor = kind => {
    shell.contentKind = kind;
    const component = kind === 'text' ? 'ReadingExperience' : 'MangaReadingSurface';
    const identity = kind === 'text' ? shell.readingIdentityKey() : shell.mangaIdentityKey();
    return selectedProductionComponentCallback(file('features/reading/ui/ReaderShell.ets'), component, 'inputCurrent', shell, { _identity: identity });
  };
  return { index, inputFor };
}

async function failureFirstInput(localSource = read(localPath), mangaSource = read(mangaPath)) {
  const Local = selectedProductionMethods(file(localPath), 'ReadingExperience',
    ['readerInputIsCurrent', 'retryReading', 'reconcileReaderRecovery'], { readerControlSelectionOwnsReading: () => false, readerControlHostInputEnabled });
  const Manga = selectedProductionMethods(file(mangaPath), 'MangaReadingSurface', ['readerPanelForeground', 'retryOpen']);
  const samples = [];
  for (const kind of ['text', 'cache', 'manga']) {
    for (const loss of ['foreground', 'covered']) {
      const wiring = rootInput();
      let loads = 0;
      let resetCalls = 0;
      let recoveryClears = 0;
      const reader = Object.assign(kind === 'manga' ? new Manga() : new Local(), {
        mounted: true, exitRequested: false, exiting: false, appForeground: true, windowChromeActive: true,
        windowChromeOverlayActive: false, interactionBlocked: false, controlObscured: false,
        isReaderIdentityCurrent: () => true, inputCurrent: wiring.inputFor(kind === 'manga' ? 'manga' : 'text'),
        phase: 'failed', lifecycleToken: 1, chapterSelectionToken: 3, failureCode: 'failure',
        resetForChapterSelection: () => { resetCalls += 1; },
        armFirstPageReadyDeadline() {}, loadInitialReading: async () => { loads += 1; },
        readerRecoveryView: { visible: true, canRetry: true, generation: 7 }, readerRecoveryIdentity: 'current',
        readerRecoveryOwnerKey: () => 'current', showReaderRecovery: () => { recoveryClears += 1; },
        readerRecoveryAction: () => { loads += 1; },
        controller: { close: () => { resetCalls += 1; } }, opened: false, offline: false, openingRetry: false,
        open: async () => { loads += 1; },
      });
      const sdk = boundedSurfaceSdk();
      const ui = kind === 'manga'
        ? sdk.consumer(mangaSource, ['chapterLoadState'])
        : sdk.consumer(localSource, ['readingFailureActions'], { LOCAL_READING_SOURCE_ID: 'local' });
      Object.assign(ui, {
        sourceId: 'local', sourceSwitchFailureMessage: '',
        readerRecoveryView: { visible: kind === 'cache', canRetry: true, generation: 7 }, readerRecoveryActionLabel: '刷新本章',
        readerInputIsCurrent: () => reader.readerInputIsCurrent(), retryReading: () => reader.retryReading(),
        reconcileReaderRecovery: generation => reader.reconcileReaderRecovery(generation), openReaderControl() {},
        error: 'chapter failed', openingRetry: false, offline: false, openFailureStage: 'chapter', controller: reader.controller,
        inkColor: () => '#000000', mutedColor: () => '#666666', displayError: value => value,
        interactiveInsets: () => ({}), readerPanelForeground: () => reader.readerPanelForeground(),
        retryOpen: () => reader.retryOpen(), openSourceSwitch() {},
      });
      if (kind === 'manga') ui.chapterLoadState();
      else ui.readingFailureActions();
      const action = sdk.nodes(ui).find(node => node.type === 'Button' && node.accessibilityText === (kind === 'cache' ? '刷新本章' : '重试'));
      assert.ok(action && typeof action.onClick === 'function', 'actual failure native action');
      if (loss === 'foreground') wiring.index.searchAppForeground = false;
      else wiring.index.arkWebCapturesInput = true;
      action.onClick();
      await settle();
      assert.equal(loads, 0, `${kind}/${loss} cannot first retry after live loss`);
      assert.equal(resetCalls, 0);
      assert.equal(recoveryClears, 0);
      assert.equal(reader.chapterSelectionToken, 3);
      wiring.index.searchAppForeground = true;
      wiring.index.arkWebCapturesInput = false;
      action.onClick();
      await settle();
      assert.equal(loads, 1, `${kind}/${loss} same owner recovers`);
      if (kind === 'text') {
        wiring.index.searchAppForeground = false;
        reader.retryReading();
        assert.equal(loads, 2, 'accepted business retry keeps its original entry while background');
      }
      samples.push({ kind, loss });
    }
  }
  return { samples, actualNativeActions: 6, acceptedBusinessRetryRetained: true };
}

async function startupFontAdmission(source = read(abilityPath)) {
  const { ts } = installedEtsCompiler();
  const start = source.indexOf('    this.shelfFontsReady = trace.measure');
  const end = source.indexOf('    // Selection diagnostics', start);
  assert.ok(start > 0 && end > start);
  const preparation = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2021 }, reportDiagnostics: true,
  });
  assert.deepEqual(preparation.diagnostics, []);
  const trace = { current: () => undefined, measure: (_name, action) => action() };
  const Ability = selectedProductionMethods(file(abilityPath), 'EntryAbility', ['onWindowStageCreate', 'loadMainContent'], {
    ReaderStartupTrace: trace, ReaderStartupContentOwner,
    ReaderWindowCoordinator: { install: async () => true }, DOMAIN: 0, hilog: { error() {}, warn() {} },
  });
  const samples = [];
  for (const timing of ['rejected-before-stage', 'rejected-during-stage', 'checked-success']) {
    let acceptFonts;
    let rejectFonts;
    let logged = 0;
    const fonts = new Promise((resolve, reject) => { acceptFonts = resolve; rejectFonts = reject; });
    const requests = [];
    const ability = Object.assign(new Ability(), {
      context: { config: {}, terminateSelf: async () => {} }, recoveryReady: Promise.resolve(),
      windowStageGeneration: 0, coldStartPage: 'pages/Index',
    });
    new Function('trace', 'prepareReaderShelfFonts', 'hilog', 'DOMAIN', preparation.outputText)
      .call(ability, trace, () => fonts, { error: () => { logged += 1; } }, 0);
    if (timing === 'rejected-before-stage') {
      rejectFonts(new Error('checked face failed'));
      await settle();
    }
    const stage = {
      getMainWindowSync: () => ({}),
      loadContent: (page, done) => { requests.push(page); done({ code: 0 }); },
    };
    ability.onWindowStageCreate(stage);
    if (timing === 'checked-success') acceptFonts();
    if (timing === 'rejected-during-stage') rejectFonts(new Error('checked face failed'));
    await settle();
    try {
      assert.deepEqual(requests, [timing === 'checked-success' ? 'pages/Index' : 'pages/ReaderStartupRecovery'],
        `${timing} uses the checked-font admission result`);
      assert.equal(logged, timing === 'checked-success' ? 0 : 1);
      assert.equal(ability.startupContent.snapshot().phase, timing === 'checked-success' ? 'ready' : 'recovery');
      samples.push(timing);
    } finally {
      ability.startupContent.close();
    }
  }
  return { samples };
}

async function settingsForegroundRecovery(source = read('features/settings/ui/SettingsPage.ets'), kinds = ['toggle', 'theme', 'cache']) {
  const samples = [];
  for (const kind of kinds) {
    const controls = switchControls();
    const runtime = {};
    const calls = [];
    const root = {
      searchAppForeground: true, arkWebCapturesInput: false, mountedRuntimeOwner: runtime,
      isCurrentRoute: (generation, route) => generation === 1 && route === 'settings',
      isCurrentRuntime: owner => owner === runtime,
    };
    const Scenes = selectedProductionMethods(file('app/composition/SettingsScenes.ets'), 'SettingsScenes', ['inputIsCurrent']);
    const scene = Object.assign(new Scenes(), {
      route: 'settings', section: 'general',
      presentation: {
        isCurrent: identity => identity === 'settings-A',
        toggle: (identity, key, value) => calls.push(['toggle', identity, key, value]),
        clearCache: async identity => { calls.push(['cache', identity]); },
      },
      isInputAllowed: selectedProductionComponentCallback(file('pages/Index.ets'), 'SettingsScenes', 'isInputAllowed', root,
        { generation: 1, route: 'settings', owner: runtime }),
    });
    const defaults = { autoCheckUpdate: true, tapBottomScrollTop: true, reduceMotion: false,
      crashLog: true, developerMode: false, wideNavigationRail: false };
    const members = ['appForeground', 'appThemeScheme', 'appThemeMode', 'appThemeControlGeneration',
      'snapshot', 'operation', 'cacheCleanup', 'temporaryBackIdentity', 'onSnapshotChanged', 'syncSnapshotValues',
      'autoCheckUpdateValue', 'tapBottomScrollTopValue', 'reduceMotionValue', 'crashLogValue',
      'developerModeValue', 'wideNavigationRailValue', 'settingsInputIsCurrent', 'settingsNavigationCurrent',
      'generalConfirmationCurrent', 'settingToggleBusy', 'settingCanToggle', 'switchRow', 'settingValue', 'toggleSetting',
      'appThemeControl', 'appThemeControlIdentity', 'appThemeControlIsCurrent', 'themeIndex', 'selectAppTheme',
      'cacheActionRow', 'cacheActionLabel', 'canClearTextCache', 'hasPendingCleanup', 'requestClearTextCache', 'clearTextCache'];
    const page = controls.consumer(source, members, {
      ReaderRuntimeOwner: { isCurrent: owner => owner === runtime },
      createDefaultSettingsSnapshot: () => ({ ...defaults }), SEG_OPTIONS: ['跟随', '浅色', '深色'],
    });
    // Toast projection is an independent finite port. Original snapshot value
    // synchronization and the selected native property bindings execute here.
    page.watches.set('operation', () => {});
    page.watches.set('cacheCleanup', () => {});
    const binding = property => selectedProductionComponentCallback(file('app/composition/SettingsScenes.ets'),
      'SettingsPage', property, scene, { identity: 'settings-A' });
    Object.assign(page, {
      mounted: true, themeOwner: runtime, activeSection: 'general', resetInFlight: false, developerPageId: '',
      temporaryBackIdentity: 'settings-A', appForeground: true, appThemeScheme: 'day', appThemeMode: 'system',
      operation: { action: 'load' }, snapshot: defaults, cacheCleanup: undefined,
      isOpeningCurrent: binding('isOpeningCurrent'), isInputAllowed: binding('isInputAllowed'),
      onToggle: binding('onToggle'), onClearCache: binding('onClearCache'),
      onSelectAppTheme: selectedProductionComponentCallback(file('app/composition/SettingsScenes.ets'),
        'SettingsPage', 'onSelectAppTheme', scene, { identity: 'settings-A', ReaderThemeHost: {
          selectApp: async (mode, current) => { if (current()) calls.push(['theme', mode]); },
        } }),
      nativeAlertOwner: { present: (_show, _spec, options, current) => {
        if (current()) options.secondaryButton.action();
      } },
      getUIContext: () => ({ showAlertDialog() {} }),
    });
    page.syncSnapshotValues();
    if (kind === 'toggle') page.switchRow('减少动态效果', () => ({ id: 1 }), 'reduceMotion');
    if (kind === 'theme') page.appThemeControl();
    if (kind === 'cache') page.cacheActionRow();
    const componentType = kind === 'toggle' ? controls.dependencies.ReaderToggle
      : kind === 'theme' ? controls.dependencies.ReaderSegmentedControl : controls.dependencies.ReaderFormRow;
    const actor = [...page.children.values()].find(child => child instanceof componentType);
    assert.ok(actor, `${kind} mounts the actual shared control`);
    root.searchAppForeground = false;
    page.appForeground = false;
    if (kind === 'toggle') page.snapshot = { ...defaults, reduceMotion: true };
    if (kind === 'theme') page.appThemeMode = 'night';
    if (kind === 'cache') page.cacheCleanup = {
      busy: false, confirmation: 'confirmed', canContinueOriginal: false,
      operation: { generation: 1, canRetry: false, value: { scope: 'text', removedContentBytes: 0, deletedFiles: 0 } },
    };
    controls.properties.flush();
    assert.equal(actor.actionEnabled, false, `${kind} background receipt disables the retained action`);
    const native = kind === 'toggle' ? controls.nodes(actor).findLast(node => node.type === 'Toggle' && node.onChange)
      : kind === 'cache' ? controls.nodes(actor).find(node => node.type === 'Button' && node.onClick)
      : controls.capsules(actor)[0];
    assert.ok(native, `${kind} retains an actual native declaration or official V2 event port`);
    root.searchAppForeground = true;
    page.appForeground = true;
    controls.properties.flush();
    assert.equal(actor.actionEnabled, true, `${kind} foreground delivery restores the retained action`);
    if (kind !== 'theme') assert.equal(native.enabled, true, `${kind} final native enabled restores`);
    assert.equal([...page.children.values()].find(child => child instanceof componentType), actor);
    const restoredNative = kind === 'toggle' ? controls.nodes(actor).findLast(node => node.type === 'Toggle' && node.onChange)
      : kind === 'cache' ? controls.nodes(actor).find(node => node.type === 'Button' && node.onClick)
      : controls.capsules(actor)[0];
    assert.equal(restoredNative, native, `${kind} foreground recovery retains its original native actor`);
    const click = kind === 'toggle' ? () => controls.nodes(actor).findLast(node => node.type === 'Toggle' && node.onChange).onChange(false)
      : kind === 'cache' ? native.onClick : controls.choices(actor)[0].onClick;
    root.searchAppForeground = false;
    click();
    controls.properties.flush();
    await settle();
    assert.equal(calls.length, 0, `${kind} live Root loss rejects before local foreground delivery`);
    root.searchAppForeground = true;
    click();
    await settle();
    assert.equal(calls.length, 1, `${kind} same actor dispatches after current foreground restoration`);
    page.mounted = false;
    click();
    await settle();
    assert.equal(calls.length, 1, `${kind} retired page cannot dispatch`);
    samples.push({ kind, sameActor: true, restoredActionEnabled: true, liveBeforeLocalRejected: true });
  }
  return { samples, boundary: 'Actual SDK V1 property runtime and official V2 parameter/event port, finite platform write endpoints.' };
}

async function multiSelectForegroundRecovery(source = read('features/bookshelf/ui/BookshelfMultiSelectPage.ets')) {
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { ShelfBookPresentation } = await import('../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts');
  const action = pureModuleProbe(read('ui/controls/ReaderActionAccessibility.ets'), 'ReaderActionAccessibility.ets',
    { AccessibilityRoleType: { BUTTON: 'button' } }, ['ReaderActionAccessibility', 'READER_ACTION_MIN_TARGET']);
  const Mutation = selectedProductionMethods(file('features/bookshelf/presentation/BookshelfMutationPresentation.ets'),
    'BookshelfMutationPresentation', ['openSelection', 'selectionBookKey']);
  const samples = [];
  for (const inline of [true, false]) {
    const book = { sourceId: 'local', bookId: 'selected', title: '原选中书籍', contentKind: 'text' };
    const runtime = {};
    const root = { searchAppForeground: true, arkWebCapturesInput: false, route: 'bookshelfMultiSelect' };
    let resolveSelection;
    const pending = new Promise(resolve => { resolveSelection = resolve; });
    const mutation = Object.assign(new Mutation(), { selectionIdentity: 0, scope: {
      owner: () => runtime, generation: () => 1, mounting: () => 1, retired: () => false,
      route: () => root.route, isCurrentOwner: owner => owner === runtime, readSelection: () => pending,
    } });
    mutation.openSelection(book, [book]);
    root.shelfMutations = mutation;
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
    const page = sdk.consumer(source, ['appForeground', 'appReduceMotion', 'appThemeScheme', 'books', 'ready', 'busy',
      'selectedKeys', 'selectionTopBar', 'selectionHeading', 'selectionAction', 'removeBar', 'selectionInputEnabled',
      'selectionRowAction', 'currentBook', 'toggleAll', 'allSelected', 'canRemoveSelection', 'removeVisibleSelection',
      'reconcileSelection', 'hasBookKey', 'bookKey', 'isSelected', 'visibleBooks'], {
      ...action, ShelfBookPresentation, APP_HEADER_BAR_HEIGHT: 52,
    });
    const calls = [];
    Object.assign(page, { mounted: true, appForeground: true, ready: false, busy: false, books: [book],
      selectedKeys: [mutation.selection.initialKey], storedSelectedGroup: '', readingFilter: 'all', sourceFilter: 'all',
      mangaRevision: 0, appThemeScheme: 'day', selectionHeaderInline: () => inline,
      bottomInset: () => 0, onCancel: () => calls.push(['cancel']), onRemoveSelected: keys => calls.push(['remove', keys]),
      isInputAllowed: selectedProductionComponentCallback(file('pages/Index.ets'), 'BookshelfMultiSelectPage',
        'isInputAllowed', root, { identity: mutation.selection.identity }),
    });
    page.selectionTopBar();
    root.searchAppForeground = false;
    page.appForeground = false;
    resolveSelection({ books: [book] });
    await settle();
    assert.equal(mutation.selection.ready, true, 'original owner accepts its background read receipt');
    page.updateStateVars({ ready: mutation.selection.ready, books: mutation.selection.books });
    sdk.properties.flush();
    // The SDK adapter does not model removal of the spinner subtree. Mount
    // the ready footer declaration after its original background receipt.
    page.removeBar();
    const buttons = sdk.nodes(page).filter(node => node.type === 'Button' && node.onClick);
    assert.equal(buttons.length, 3);
    assert.ok(buttons.every(button => button.enabled === false));
    const rowAttributes = () => {
      const values = {};
      const native = new Proxy({}, { get: (_target, key) => value => { values[key] = value; return native; } });
      page.selectionRowAction(book).applyNormalAttribute(native);
      return values;
    };
    assert.equal(rowAttributes().enabled, false);
    root.searchAppForeground = true;
    page.appForeground = true;
    sdk.properties.flush();
    assert.ok(buttons.every(button => button.enabled === true), 'same multi-select native actions recover on foreground');
    assert.equal(rowAttributes().enabled, true); assert.equal(rowAttributes().focusable, true);
    assert.ok(buttons.every(button => sdk.nodes(page).includes(button)));
    const cancel = buttons.find(button => button.accessibilityText === '取消');
    const remove = buttons.find(button => button.accessibilityText === '移除书架');
    const all = buttons.find(button => button !== cancel && button !== remove);
    root.searchAppForeground = false;
    cancel.onClick(); remove.onClick(); all.onClick();
    assert.deepEqual(calls, []); assert.deepEqual([...page.selectedKeys], [mutation.selection.initialKey]);
    root.searchAppForeground = true;
    remove.onClick();
    assert.deepEqual(calls, [['remove', [mutation.selection.initialKey]]]);
    all.onClick(); assert.deepEqual([...page.selectedKeys], []);
    all.onClick(); assert.deepEqual([...page.selectedKeys], [mutation.selection.initialKey]);
    cancel.onClick(); assert.equal(calls.at(-1)[0], 'cancel');
    page.mounted = false;
    const accepted = calls.length;
    cancel.onClick(); remove.onClick(); all.onClick();
    assert.equal(calls.length, accepted);
    samples.push({ inline, sameNativeActions: 3, acceptedBackgroundReady: true, restoredRowAttributes: true });
  }
  return { samples, boundary: 'Actual SDK buttons and production row modifier attributes, original selection read owner and Root input callback. Removal/navigation endpoints and geometry are finite.' };
}

async function sliderTerminals(autoSource = read('features/reading/ui/ReaderControlAutoPageContent.ets'), mangaSource = read(mangaPath)) {
  const geometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
  const actors = await import('../entry/src/main/ets/features/reading/ui/ReaderControlActorGeometry.ts');
  const policy = await import('../entry/src/main/ets/features/reading/ui/ReaderAutoPageFullState.ts');
  const { ReaderAutoPageCoordinator } = await import('../entry/src/main/ets/features/reading/ui/ReaderAutoPageCoordinator.ts');
  const speedOwner = selectedProductionMethods(file(localPath), 'ReadingExperience', ['setAutoPageSpeed']);
  const coordinator = new ReaderAutoPageCoordinator({ now: () => 0, schedule: () => 1, cancel() {},
    active: () => true, ready: () => true, canResumeTurn: () => true, turn: () => ({ kind: 'started' }), changed() {} });
  const reading = Object.assign(new speedOwner(), { autoPageCoordinator: coordinator, mounted: true, appForeground: true });
  const speedCommits = [];
  const sdk = boundedSurfaceSdk();
  const methods = ['p', 'frame', 'effectiveSpeedSeconds', 'speedRow', 'speedControlsWidth', 'speedControlsHeight',
    'speedControlsX', 'speedControlsY', 'speedSliderWidth', 'speedSliderX', 'speedMinusX', 'speedMaxLabelX',
    'speedPlusX', 'speedLabelY', 'speedActor', 'speedActorId', 'speedStepButton', 'changeSpeedStep', 'textMetric', 'changeSpeedSlider', 'commitSpeedSeconds',
    'clearPendingSpeed', 'onSpeedSecondsChanged']
    .filter(name => autoSource.includes(`private ${name}(`));
  const auto = sdk.consumer(autoSource, [...methods, 'speedSeconds', 'speedPreviewSeconds', 'pendingSpeedSeconds', 'speedChangeGeneration', 'observedSpeedSeconds'], { ...geometry, ...actors, ...policy });
  let input = true;
  Object.assign(auto, { motionProgress: 1, availableWidth: 338, speedSeconds: 8, speedPreviewSeconds: -1,
    minimumProfile: () => undefined, preparedMinimumRequired: false, minimumKey: '',
    appScheme: 'day', sourceOnly: 'none', sharedInput: () => input, fullInput: () => input,
    presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), sharedScrollTranslation: () => 0,
    sharedClip: () => ({}), onSpeedChange: value => {
      speedCommits.push(value);
      reading.setAutoPageSpeed(value);
      auto.updateStateVars({ speedSeconds: coordinator.snapshot().speedSeconds });
    } });
  auto.speedRow();
  const speed = sdk.nodes(auto).find(node => node.type === 'Slider');
  // A complete tap delivers Click and End. The accepted speed must only be submitted once.
  speed.onChange(8, 'SliderChangeMode.Begin');
  speed.onChange(13, 'SliderChangeMode.Click');
  sdk.properties.flush();
  assert.equal(auto.effectiveSpeedSeconds(), 13);
  assert.equal(speed.create.value, 13, 'native Slider displays the current click preview');
  speed.onChange(13, 'SliderChangeMode.End');
  sdk.properties.flush();
  assert.equal(coordinator.snapshot().speedSeconds, 13, 'complete click commits original coordinator speed');
  assert.deepEqual(speedCommits, [13], 'automatic-page complete click submits once');
  assert.equal(auto.speedPreviewSeconds, -1);
  assert.equal(speed.create.value, 13, 'native Slider consumes the accepted speed Prop after preview clears');
  speed.onChange(13, 'SliderChangeMode.Begin');
  speed.onChange(15, 'SliderChangeMode.Moving'); sdk.properties.flush();
  assert.deepEqual(speedCommits, [13], 'drag preview keeps business speed');
  speed.onChange(15, 'SliderChangeMode.End'); sdk.properties.flush(); assert.equal(coordinator.snapshot().speedSeconds, 15);
  assert.deepEqual(speedCommits, [13, 15]);
  assert.equal(speed.create.value, 15);
  input = false;
  for (const mode of ['Begin', 'Click', 'End']) speed.onChange(17, `SliderChangeMode.${mode}`);
  assert.deepEqual(speedCommits, [13, 15]);

  const seeks = [], restored = [];
  const manga = sdk.consumer(mangaSource, ['bottomControls', 'seekPage', 'readerPanelForeground', 'presentedPage', 'changePageSlider',
    'pageSliderGeneration', 'pageSliderPreview', 'pageSliderCommitted'], {
    ReaderPanelFrame: class { applyNormalAttribute() {} },
  });
  Object.assign(manga, { mounted: true, exiting: false, appForeground: true, windowChromeActive: true,
    windowChromeOverlayActive: false, interactionBlocked: false, isReaderIdentityCurrent: () => true,
    inputCurrent: () => true, opened: true, horizontal: false, horizontalPageCount: 5, panel: '', controlsVisible: true,
    presentationGeneration: 0, pageTurnInputRevision: 1, layoutGeneration: 1,
    controller: { chapter: {}, totalPages: 5, setVisible: async ordinal => { seeks.push(ordinal); } },
    data: { projection: { index: ordinal => ordinal } }, saveVisible: async () => {}, notifyPublishedRows() {},
    restore: (...args) => restored.push(args), pageOrdinal: () => 0, viewportWidth: 366, backgroundPreference: 'paper',
    mutedColor: () => '#666666', greenColor: () => '#008800', lineColor: () => '#eeeeee',
    controlFontScale: () => 1, dockPageRowHeight: () => 63, dockActionHeight: () => 58,
    interactiveInsets: () => ({ left: 0, right: 0 }), chromeScheme: () => 'day', footerAction() {},
  });
  manga.bottomControls();
  const page = sdk.nodes(manga).find(node => node.type === 'Slider');
  page.onChange(1, 'SliderChangeMode.Begin');
  page.onChange(3, 'SliderChangeMode.Click'); await settle();
  assert.deepEqual(seeks, [2], 'manga click reaches the current seek controller');
  page.onChange(3, 'SliderChangeMode.End'); await settle();
  assert.deepEqual(seeks, [2], 'manga complete click reaches original seek controller once');
  assert.deepEqual(restored, [[2, 0, 0]]);
  page.onChange(3, 'SliderChangeMode.Begin');
  page.onChange(4, 'SliderChangeMode.Moving'); await settle(); assert.deepEqual(seeks, [2]);
  page.onChange(4, 'SliderChangeMode.End'); await settle(); assert.deepEqual(seeks, [2, 3]);
  manga.appForeground = false;
  for (const mode of ['Begin', 'Click', 'End']) page.onChange(5, `SliderChangeMode.${mode}`);
  await settle();
  assert.deepEqual(seeks, [2, 3], 'original manga current-input seek fence remains active');
  coordinator.dispose();
  return { nativeSliders: 2, completeClickAndDragCommitOnce: true, movingDoesNotCommit: true,
    boundary: 'Actual SDK onChange callbacks with explicit complete SDK-documented event sequences, real AutoPage coordinator and manga seek receiver. Event injection is finite and does not establish native event delivery.' };
}

for (const id of cases) {
  let result;
  if (id === 'failure-first-input') {
    const local = read(localPath);
    const manga = read(mangaPath);
    result = await failureFirstInput(local, manga);
    const oldLocal = local.replaceAll('if (this.readerInputIsCurrent()) this.reconcileReaderRecovery(generation);', 'this.reconcileReaderRecovery(generation);')
      .replaceAll('if (this.readerInputIsCurrent()) this.retryReading();', 'this.retryReading();');
    const oldManga = manga.replace('if (this.readerPanelForeground()) void this.retryOpen();', 'void this.retryOpen();');
    await assert.rejects(() => failureFirstInput(oldLocal, manga), /cannot first retry after live loss/);
    await assert.rejects(() => failureFirstInput(local, oldManga), /cannot first retry after live loss/);
  } else if (id === 'startup-font-admission') {
    const source = read(abilityPath);
    result = await startupFontAdmission(source);
    const old = source.replace("this.shelfFontsReady = trace.measure('startup.shelf-fonts', (): Promise<void> => prepareReaderShelfFonts());\n    void this.shelfFontsReady.catch",
      "this.shelfFontsReady = trace.measure('startup.shelf-fonts', (): Promise<void> => prepareReaderShelfFonts()).catch");
    assert.notEqual(old, source);
    await assert.rejects(() => startupFontAdmission(old), /uses the checked-font admission result/);
  } else if (id === 'settings-foreground-recovery') {
    const source = read('features/settings/ui/SettingsPage.ets');
    result = await settingsForegroundRecovery(source);
    const old = source.replace('return this.appForeground && this.mounted && identity === this.temporaryBackIdentity',
      'return this.mounted && identity === this.temporaryBackIdentity');
    assert.notEqual(old, source);
    for (const kind of ['toggle', 'theme', 'cache']) {
      await assert.rejects(() => settingsForegroundRecovery(old, [kind]), /foreground delivery restores the retained action/);
    }
  } else if (id === 'multi-select-foreground-recovery') {
    const source = read('features/bookshelf/ui/BookshelfMultiSelectPage.ets');
    result = await multiSelectForegroundRecovery(source);
    const old = source.replace('return this.appForeground && this.mounted && this.ready', 'return this.mounted && this.ready');
    assert.notEqual(old, source);
    await assert.rejects(() => multiSelectForegroundRecovery(old), /same multi-select native actions recover on foreground/);
  } else {
    const auto = read('features/reading/ui/ReaderControlAutoPageContent.ets'), manga = read(mangaPath);
    result = await sliderTerminals(auto, manga);
    const extraAuto = auto.replace('if (mode === SliderChangeMode.End || mode === SliderChangeMode.Click)',
      'if (mode === SliderChangeMode.End || mode === SliderChangeMode.Click || mode === SliderChangeMode.Moving)');
    const extraManga = manga.replace('if (mode === SliderChangeMode.End && this.pageSliderCommitted === ordinal) return;', '');
    assert.notEqual(extraAuto, auto); assert.notEqual(extraManga, manga);
    await assert.rejects(() => sliderTerminals(extraAuto, manga));
    await assert.rejects(() => sliderTerminals(auto, extraManga), /manga complete click reaches original seek controller once/);
  }
  console.log(JSON.stringify({ case: id, result, oldBehaviorRejected: true,
    boundary: 'Current production methods and actual SDK native action callbacks. Acquisition, native layout and platform IO are finite ports. No device action.' }));
  recordContractCasePass(id);
}

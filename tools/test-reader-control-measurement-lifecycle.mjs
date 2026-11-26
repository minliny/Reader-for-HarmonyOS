import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';

const definitions = Object.fromEntries([
  ['module-first-frame-atomic', 'Actual Host candidate queue and SDK Panel mount cannot expose a new module without its paired prepared profile.'],
  ['same-geometry-retained-input', 'Changed requests retain committed geometry/key/profile and current input when all geometry outputs are equal.'],
  ['geometry-change-atomic', 'A changed profile is admitted with the exact same selected layout/key/location tuple.'],
  ['request-race-owner', 'Old frame, facts request, book, opening and module-visit callbacks cannot commit or resurrect an old owner.'],
  ['environment-vs-admission', 'Actual environment and owner checks remain independent of pending request generation and target44 quality.'],
  ['search-native-editor-scope', 'Actual first-frame editor scope is synchronous and does not grant ordinary controls a geometry bypass.'],
  ['captured-interaction', 'Equal geometry keeps the existing key; genuine geometry retains existing module cancel/rebase callbacks.'],
  ['profile-preflight-no-side-effect', 'Actual parent preflight consumes pure facts before child mount, and explicit imports resolve.'],
  ['measurement-failure-budget', 'Missing or mismatched prepared profile and failed candidates preserve prior presentation without admitting a new module.'],
  ['playback-source-reuse', 'Committed playback data remains paired to its geometry across equal requests, with exact receipt checks.'],
  ['fixed-island-playback-scroll', 'Actual playback measurement follows the fixed-island Scroll offset after the native area callback.'],
  ['fixed-island-font-reorder', 'Actual font drag retains equal slots across rows and submits the resulting order to the Host.'],
  ['home-single-owner', 'Actual SDK Home Scroll actor survives both sides of the content-height threshold.'],
].map(([id, description]) => [id, { description, resources: [] }]));
const selected = selectContractCases(definitions);

if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
        return next(specifier + '.ts', context);
      throw error;
    }
  } });
  const geometry = await import('../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts');
  const { readerControlStructureKey } = await import('../entry/src/main/ets/ui/layout/ReaderKeyboardGeometry.ts');
  const receipt = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMinimumReceipt.ts');
  const session = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
  const hostSession = await import('../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts');
  const settings = await import('../entry/src/main/ets/features/reading/application/ReaderSettingsState.ts');
  const window = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const motion = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts');
  const presentation = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionPresentation.ts');
  const ui = name => new URL('../entry/src/main/ets/features/reading/ui/' + name, import.meta.url);
  const source = name => readFileSync(ui(name), 'utf8');
  const { ts, options } = installedEtsCompiler();
  const pureFunction = (file, name, dependencies = {}) => {
    const text = source(file), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const declaration = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(declaration, 'actual pure function ' + file + '/' + name);
    return pureModuleProbe(declaration.getText(tree), file, dependencies, [name])[name];
  };
  const profileGeometryKey = pureFunction('ReaderControlMinimumMeasurement.ets', 'readerControlMeasuredProfileGeometryKey');
  const moduleProfileMatches = pureFunction('ReaderControlMinimumMeasurement.ets', 'readerControlModuleProfileMatches');
  const moduleFactsMatch = pureFunction('ReaderControlMinimumMeasurement.ets', 'readerControlModuleFactsMatch');
  const factsGeometryKey = pureFunction('ReaderControlMinimumMeasurement.ets', 'readerControlModuleFactsGeometryKey');
  const factsDisplayEqual = pureFunction('ReaderControlMinimumMeasurement.ets', 'readerControlModuleFactsDisplayEqual',
    { readerControlModuleFactsGeometryKey: factsGeometryKey });
  const playbackMatches = pureFunction('ReaderControlPlaybackProfile.ets', 'readerControlPlaybackProfileMatches');
  const fixtureFacts = (module, version = 0) => {
    if (module === 'home') return { module, home: { chapterTitle: 'Chapter ' + version, totalChapters: 10 + version } };
    if (module === 'search') {
      const state = { kind: version ? 'empty' : 'idle', keyword: 'query-' + version };
      return { module, search: { query: '', title: '', snippet: '', message: '', hasResults: false,
        resultsMode: false, loading: false, loadMoreLabel: '', loadMoreMessage: '', readViewState: () => state } };
    }
    if (module === 'directory') {
      const snapshot = { rows: [], loading: false, catalogState: 'ready', currentTitle: '', currentPosition: '', targetRow: -1 };
      return { module, directory: { readViewSnapshot: () => snapshot, hasRows: false, loading: false, currentTitle: '', currentPosition: '' } };
    }
    if (module === 'appearance') {
      const snapshot = { fontOrder: ['system', 'serif'] }, order = snapshot.fontOrder;
      return { module, appearance: { readViewSnapshot: () => snapshot, readViewFontOrder: () => order, fonts: [] } };
    }
    if (module === 'tts') {
      const state = { status: 'idle', totalSlices: 0, rate: 1 + version / 10 };
      return { module, tts: { readViewState: () => state, error: '', seek: false } };
    }
    if (module === 'replace') {
      const state = { rules: [] }; return { module, replace: { readViewState: () => state, ruleCount: 0 } };
    }
    if (module === 'settings') return { module, settings: { groupLabels: ['', '', ''], optionLabels: [[], [], []], toggleLabels: [] } };
    return { module, autoPage: { status: 'stopped', timerSummary: '15:00' } };
  };
  const hostMethods = ['controlMinimumIdentity', 'controlMinimumOwnerKey', 'controlMinimumEnvironmentKey',
    'controlMinimumCommittedIdentity', 'activeControlNavigationIntent', 'controlMinimumRequestLocation',
    'requestControlSession', 'cancelControlNavigationIntent', 'onControlInputActivity',
    'controlLayoutGeometryKey', 'currentControlStructureKey', 'controlMinimumCurrent', 'bindControlMinimum', 'controlMinimumReceiptCurrent',
    'scheduleControlMinimum', 'admitControlMinimum', 'adoptControlDisplayFacts', 'acceptControlPlaybackProfile',
    'onControlTemporaryLayerChanged'];
  let metrics = window.createDefaultReaderWindowMetrics();
  const Host = selectedProductionMethods(ui('LocalReadingExperience.ets'), 'ReadingExperience', hostMethods,
    { ...geometry, ...receipt, ...session, ...hostSession, readerControlStructureKey, ReaderWindowCoordinator: { metrics: () => metrics },
      readerControlMeasuredProfileGeometryKey: profileGeometryKey, readerControlModuleProfileMatches: moduleProfileMatches,
      readerControlModuleFactsDisplayEqual: factsDisplayEqual, readerControlModuleFactsMatch: moduleFactsMatch,
      readerControlPlaybackProfileMatches: playbackMatches,
      ReaderUIFrameCallback: class { constructor(onFrame) { this.onFrame = onFrame; } } });
  const makeHost = () => {
    metrics = { ...window.createDefaultReaderWindowMetrics(), revision: 1,
      windowRect: { left: 0, top: 0, width: 390, height: 844 } };
    const owner = new Host(), frames = [], profiles = new Map(), facts = new Map(); let measurements = 0;
    Object.assign(owner, { sourceId: 'source', bookId: 'book', lifecycleToken: 1, mounted: true,
      appForeground: true, windowChromeActive: true, windowChromeOverlayActive: false,
      interactionBlocked: false, controlObscured: false, controlOpenRevision: 1, expandedLayout: false,
      controlModuleVisitRevision: 1, controlMinimumRevision: 0, controlMinimumGeneration: 0,
      controlNavigationGeneration: 0, observedControlModule: 'settings',
      controlMinimumReady: false, controlMinimumCandidates: [], controlTemporaryLayer: false,
      controlTemporaryLayerPresented: false,
      controlSession: { ...session.createReaderControlSessionState(),
        location: { level: 'secondary', module: 'settings', directoryTab: 'directory', form: 'quick' } },
      effectiveViewportWidth: () => 390, effectiveViewportHeight: () => 844,
      isSessionActive: token => owner.mounted && token === owner.lifecycleToken,
      pageTurnInputPhase: () => 'idle', invalidateControlBackdrop() {},
      prepareControlPage() {}, controlPage: () => 'home', controlVerification: { accept() {} },
      getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
    });
    owner.latestControlVisualSession = session.copyReaderControlSessionState(owner.controlSession);
    const bind = (variant = 0, mutation, displayVersion = 0) => {
      const identity = owner.controlMinimumIdentity();
      const location = owner.controlMinimumRequestLocation();
      const module = location.level === 'secondary' ? location.module : 'home';
      const factKey = module + ':' + displayVersion;
      if (!facts.has(factKey)) facts.set(factKey, fixtureFacts(module, displayVersion));
      owner.bindControlMinimum(identity, (widths, key) => {
        measurements++;
        const home = { chapterTitleHeight: 34, chapterRowHeight: 54, progressHeight: 50, percentWidth: 27,
          countWidth: 40, actionLabelHeight: 13, actionHeight: 68, minimumHeight: 190, minWidth: 100, fits: true };
        const data = module === 'home' ? undefined : { module, [module]: {
          minimum: { module },
          quick: { optionHeights: [24 + variant], width: widths.quickContentWidthVp },
          full: { optionHeights: [27 + variant], width: widths.fullContentWidthVp } } };
        const profile = { module, identity, metricsRevision: metrics.revision, widths,
          moduleData: data, moduleFacts: facts.get(factKey), quick: home, full: home, topBarVisible: true, navigationLabelHeight: 13.889,
          navigationHeight: 80, titleHeight: 20, collapseLabelHeight: 14, collapseWidth: 44, headerHeight: 30,
          headerPaint: { bodyTop: 57, height: 30 },
          playbackData: module === 'tts' ? { tts: data.tts } : module === 'autoPage' ? { autoPage: data.autoPage } : undefined };
        profiles.set(key, profile);
        const minimum = { module, quick: { heightVp: 190, minWidthVp: 100, fits: true },
          full: { heightVp: 190, minWidthVp: 100, fits: true } };
        const chrome = { topBarVisible: true, topBarHeightVp: 54, quickReserveVp: 140, fullReserveVp: 70,
          navigationHeightVp: 80, headerHeightVp: 30, brightnessAutoHeightVp: 28, brightnessAutoWidthVp: 28 };
        const candidate = { key, widths, minimum, chrome,
          sharedShell: { minimum: { ...minimum, module: 'home' }, chrome } };
        return mutation ? mutation(candidate, profile) : candidate;
      }, key => profiles.get(key), facts.get(factKey), JSON.stringify([identity, owner.controlMinimumEnvironmentKey(), module, variant]));
    };
    const flush = () => { let count = 0; while (frames.length) { assert.ok(++count < 20); frames.shift().onFrame(0); } };
    return { owner, frames, profiles, bind, flush, measurements: () => measurements };
  };

  const panelOrdinary = ['paintedPresentationReceipt', 'minimumPresentationAvailable', 'minimumInputReady', 'currentLayout',
    'currentMinimumKey', 'currentMinimumIdentity', 'committedMinimumIdentity', 'preparedMinimum', 'contentInputEnabled',
    'currentTemporaryInputScope', 'hasCurrentTemporaryInput', 'secondaryModuleInputEnabled',
    'moduleEditorInputEnabled', 'moduleTemporaryLayerHandler', 'navigationInputEnabled', 'controlActionInputEnabled',
    'controlCallbackGuard', 'currentMoreMenuOwnerScope'];
  const Panel = selectedProductionMethods(ui('ReaderControlPanel.ets'), 'ReaderControlPanel', panelOrdinary, { DEBUG: false });
  const makePanel = host => {
    const panel = new Panel();
    Object.assign(panel, { preparedMinimumRequired: true, runtimeMounted: true, moreMenuVisible: false,
      minimumIdentity: host.controlMinimumIdentity(), minimumOwnerKey: host.controlMinimumOwnerKey(),
      minimumCommittedIdentity: host.controlMinimumCommittedIdentity(),
      minimumEnvironmentKey: host.controlMinimumEnvironmentKey(), presentationReceipt: host.controlPresentationReceipt,
      contentMotionProgress: 0, inputEnabled: true, controlObscured: false, visualVisibilityProgress: 1,
      visualTransitionKind: '', visualHeldPointerId: -1, temporaryLayerActive: false,
      temporaryInputActive: false, temporaryInputScope: '', sourceId: host.sourceId,
      bookmarkIdentity: { bookId: host.bookId, libraryBookId: 'library' }, controlOpenRevision: host.controlOpenRevision,
      sourceBookId: host.bookId, runtimeLifecycle: 1,
      contentLocation: () => panel.presentationReceipt?.location ?? host.controlSession.location,
      minimumReceiptCurrent: key => host.controlMinimumReceiptCurrent(key),
      frame: () => ({ navigation: { opacity: 1, height: 80 } }),
      onTemporaryLayerChange: active => host.onControlTemporaryLayerChanged(active),
    });
    return panel;
  };

  for (const id of selected) {
    if (id === 'same-geometry-retained-input' || id === 'geometry-change-atomic' || id === 'captured-interaction') {
      const h = makeHost(); h.bind(); h.flush();
      const first = h.owner.controlPresentationReceipt;
      assert.ok(first);
      const panel = makePanel(h.owner);
      assert.equal(panel.minimumInputReady(), true);
      h.bind();
      assert.equal(h.owner.controlMinimumReceiptCurrent(first.key), true, 'pending new provider cannot retire accepted geometry');
      assert.equal(panel.secondaryModuleInputEnabled('settings'), true);
      h.flush();
      assert.equal(h.owner.controlPresentationReceipt, first, 'equal profiles preserve the actual receipt object');
      assert.equal(h.owner.controlPresentationReceipt.profile, first.profile);
      if (id !== 'same-geometry-retained-input') {
        h.bind(6); h.flush(); const next = h.owner.controlPresentationReceipt;
        assert.notEqual(next.key, first.key); assert.notEqual(next.profile, first.profile);
        assert.equal(next.prepared.key, next.key); assert.equal(next.layout.minimumKey, next.key);
        assert.equal(next.profile.moduleData.settings.quick.optionHeights[0], 30);
        assert.equal(next.identity, h.owner.controlMinimumIdentity());
        if (id === 'captured-interaction') {
          assert.notEqual(next.key, first.key, 'genuine changes retain the existing rebase/cancel signal');
          const properties = createArkUIPropertyRuntimeProbe();
          const probe = createReaderBuilderProbe(source('ReaderControlAppearanceContent.ets'),
            ['preparedMinimum', 'minimumKey', 'adoptedPrepared', 'adoptedPreparedKey', 'presentationPrepared', 'preparedProfile', 'onPreparedMinimumChanged',
              'onMinimumKeyChanged', 'cancelFontDrag', 'settleFontDrag'],
            { ...properties.sdk, readerControlModuleProfileMatches: moduleProfileMatches,
              readerControlModuleFactsMatch: moduleFactsMatch, readerMotionNowMs: () => 1 }, properties.hooks);
          const appearance = probe.owner; let orderWrites = 0;
          Object.assign(appearance, { preparedMinimumRequired: true, minimumIdentity: 'appearance',
            draggedFontId: '', fontPointerId: -1, fontTracks: new Map(), fontMotionGeneration: 1,
            openSelect: '', selectClosing: false, fontIds: () => ['system', 'serif'],
            onFontReorderActivityChange() {}, onFontOrderChange: () => orderWrites++, restoreMinimumScroll() {},
            snapshot: { fontOrder: ['system', 'serif'] } });
          appearance.minimumKey = 'appearance|1';
          appearance.preparedMinimum = { identity: 'appearance', key: 'appearance|1',
            facts: fixtureFacts('appearance'),
            moduleData: { module: 'appearance', appearance: { quickFontCellHeight: 27 } } };
          appearance.draggedFontId = 'system'; appearance.fontPointerId = 12;
          appearance.previewFontOrder = ['serif', 'system'];
          appearance.preparedMinimum = properties.deepCopy(appearance.preparedMinimum);
          assert.equal(appearance.fontPointerId, 12, 'actual SDK same-key prepared Prop reset cannot retire a live drag');
          assert.deepEqual(appearance.previewFontOrder, ['serif', 'system']);
          appearance.minimumKey = 'appearance|2';
          appearance.preparedMinimum = { identity: 'appearance', key: 'appearance|2',
            facts: fixtureFacts('appearance'),
            moduleData: { module: 'appearance', appearance: { quickFontCellHeight: 37 } } };
          assert.equal(appearance.fontPointerId, -1, 'genuine new key retains existing capture cancellation');
          assert.deepEqual(appearance.snapshot.fontOrder, ['system', 'serif'], 'business font order remains unchanged');
          appearance.settleFontDrag(true); assert.equal(orderWrites, 0, 'late End after cancellation does not write the draft');
        }
      }
      const oldGuard = h.owner.controlMinimumReceiptCurrent;
      h.owner.controlMinimumReceiptCurrent = key => key.startsWith(`${h.owner.controlMinimumIdentity()}|${h.owner.controlMinimumGeneration}|`);
      assert.equal(h.owner.controlMinimumReceiptCurrent(first.key), false, 'former current-generation gate is a negative control');
      h.owner.controlMinimumReceiptCurrent = oldGuard;
      if (id === 'geometry-change-atomic') {
        const display = makeHost(); display.owner.controlSession.location.module = 'search'; display.bind(); display.flush();
        const old = display.owner.controlPresentationReceipt;
        const properties = createArkUIPropertyRuntimeProbe();
        const probe = createReaderBuilderProbe(source('ReaderControlSearchContent.ets'),
          ['state', 'minimumIdentity', 'minimumKey', 'preparedMinimum', 'adoptedPrepared', 'adoptedPreparedKey',
            'presentationPrepared', 'preparedProfile', 'currentMinimumProfile', 'displayState', 'displayedFacts',
            'onPreparedMinimumChanged', 'currentInputEnabled'],
          { ...properties.sdk, readerControlModuleProfileMatches: moduleProfileMatches,
            readerControlModuleFactsMatch: moduleFactsMatch }, properties.hooks);
        const search = probe.owner;
        Object.assign(search, { preparedMinimumRequired: true, minimumIdentity: old.identity,
          resultDataSource: { publish: () => 'unchanged' },
          onResultDataChanged() {}, onResultLayoutChanged() {}, publishMinimumMeasurer() {} });
        search.minimumKey = old.key; search.state = old.facts.search.readViewState(); search.preparedMinimum = old.prepared;
        const oldProfile = search.currentMinimumProfile();
        const nextRaw = { kind: 'error', message: '新的失败说明必须与其换行预算一起出现' };
        search.state = nextRaw;
        assert.equal(search.displayState().kind, 'idle', 'actual raw State Watch cannot expose new text before its presentation receipt');
        assert.equal(search.currentMinimumProfile(), oldProfile);
        display.bind(6, (candidate, profile) => {
          profile.moduleFacts.search.readViewState = () => nextRaw;
          return candidate;
        }, 1);
        assert.equal(display.owner.controlPresentationReceipt, old);
        display.flush(); const changed = display.owner.controlPresentationReceipt;
        search.minimumKey = changed.key;
        assert.equal(search.displayState().kind, 'idle', 'SDK key-first delivery retains the old complete view/profile pair');
        assert.equal(search.currentMinimumProfile(), oldProfile);
        search.preparedMinimum = changed.prepared;
        assert.equal(search.displayState().message, nextRaw.message);
        assert.equal(search.currentMinimumProfile().quick.optionHeights[0], 30);
        const beforeMeasure = display.measurements();
        display.bind(6, undefined, 2);
        assert.equal(display.frames.length, 1, 'view-only facts wait for the existing safe Host frame');
        assert.equal(display.owner.controlPresentationReceipt, changed);
        display.flush(); const viewOnly = display.owner.controlPresentationReceipt;
        assert.equal(display.measurements(), beforeMeasure, 'view-only facts perform zero additional candidate/font measurements');
        assert.equal(viewOnly.key, changed.key); assert.equal(viewOnly.profile, changed.profile);
        assert.notEqual(viewOnly.facts.search.readViewState(), changed.facts.search.readViewState());
        search.preparedMinimum = viewOnly.prepared;
        assert.equal(search.currentMinimumProfile().quick.optionHeights[0], 30);
        assert.equal(search.displayState().keyword, 'query-2');
        const adoptedProfile = search.currentMinimumProfile(), adoptedView = search.displayState();
        search.minimumIdentity = 'successor';
        assert.equal(search.currentMinimumProfile(), adoptedProfile, 'identity-first SDK delivery retains the complete adopted paint pair');
        assert.equal(search.displayState(), adoptedView);
        search.minimumKey = 'successor|1';
        Object.assign(search, { interactionEnabled: true, inputCurrent: () => false });
        assert.equal(search.currentInputEnabled(), false, 'retained old paint does not grant successor business authority');
        assert.equal(search.currentMinimumProfile(), adoptedProfile);
        search.preparedMinimum = { identity: 'successor', key: 'successor|1',
          moduleData: changed.prepared.moduleData, facts: fixtureFacts('search', 3) };
        assert.equal(search.displayState().keyword, 'query-3');
      }
    }
    if (id === 'request-race-owner') {
      const h = makeHost(); h.bind(); const oldFrame = h.frames.shift();
      h.bind(2); oldFrame.onFrame(0); assert.equal(h.owner.controlPresentationReceipt, undefined);
      h.flush(); const accepted = h.owner.controlPresentationReceipt;
      for (const mutate of [() => { h.owner.bookId = 'other'; }, () => { h.owner.controlOpenRevision++; },
        () => { h.owner.controlModuleVisitRevision++; }, () => { h.owner.lifecycleToken++; }]) {
        h.bind(); const stale = h.frames.shift(); mutate(); stale.onFrame(0);
        assert.equal(h.owner.controlPresentationReceipt, accepted, 'old delayed result cannot overwrite the committed tuple');
        assert.equal(h.owner.controlMinimumReceiptCurrent(accepted.key), false);
      }
      h.owner.controlSession.location.module = 'tts'; h.owner.controlModuleVisitRevision++; h.bind();
      const retired = h.frames.shift(); h.owner.controlSession.location.module = 'settings'; h.owner.controlModuleVisitRevision++;
      retired.onFrame(0); assert.equal(h.owner.controlPresentationReceipt, accepted);
      const navigation = makeHost(); navigation.bind(); navigation.flush();
      const origin = navigation.owner.controlPresentationReceipt;
      const target = module => { const next = session.copyReaderControlSessionState(navigation.owner.controlSession);
        next.location.module = module; return next; };
      navigation.owner.requestControlSession(target('tts')); navigation.bind();
      const obsolete = navigation.frames.shift();
      navigation.owner.requestControlSession(target('appearance')); navigation.bind();
      obsolete.onFrame(0); assert.equal(navigation.owner.controlPresentationReceipt, origin);
      navigation.flush(); assert.equal(navigation.owner.controlSession.location.module, 'appearance');
      const afterNavigation = navigation.owner.controlPresentationReceipt;
      navigation.owner.requestControlSession(target('search')); navigation.bind();
      assert.equal(navigation.owner.cancelControlNavigationIntent(), true, 'existing Back cancellation retires the intent');
      navigation.flush(); assert.equal(navigation.owner.controlPresentationReceipt, afterNavigation);
      navigation.owner.requestControlSession(target('search')); navigation.bind();
      navigation.owner.onControlInputActivity(); navigation.flush();
      assert.equal(navigation.owner.controlPresentationReceipt, afterNavigation, 'old-page business activity supersedes pending navigation');
      const guard = makePanel(navigation.owner);
      assert.equal(guard.controlActionInputEnabled(), true);
      navigation.owner.bookId = 'next-book'; guard.minimumOwnerKey = navigation.owner.controlMinimumOwnerKey();
      assert.equal(guard.controlActionInputEnabled(), false, 'shared header actions cannot borrow a different book owner during receipt delivery');
      const callbacks = makeHost(); callbacks.owner.controlSession.location.module = 'appearance'; callbacks.bind(); callbacks.flush();
      const callbackPanel = makePanel(callbacks.owner);
      const appearanceGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceGeometry.ts');
      let themeWrites = 0;
      const appearanceButton = () => {
        const probe = createReaderBuilderProbe(source('ReaderControlAppearanceContent.ets'),
          ['themeSwatch', 'sharedInput', 'currentInputEnabled', 'presentationPrepared'],
          { ...appearanceGeometry, readerControlModuleProfileMatches: moduleProfileMatches, readerControlModuleFactsMatch: moduleFactsMatch });
        const actor = probe.owner;
        Object.assign(actor, { preparedMinimumRequired: true, preparedMinimum: callbackPanel.preparedMinimum(),
          minimumIdentity: callbackPanel.currentMinimumIdentity(), minimumKey: callbackPanel.currentMinimumKey(),
          motionProgress: 0, interactionEnabled: true, inputCurrent: () => callbackPanel.secondaryModuleInputEnabled('appearance'),
          frame: () => ({ themeSwatches: [{ width: 62.5, height: 24 }], themeShells: [{ width: 64, height: 72.5 }] }),
          displaySnapshot: () => ({ activeTheme: 'day' }), themeColor: () => '#fff', actorPosition: () => ({ x: 0, y: 0 }),
          sharedClip: () => ({}), fullInput: () => false, minimumProfile: () => undefined, themeLabel: () => '日间',
          presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), onThemeChange: () => themeWrites++ });
        actor.themeSwatch('day', 0);
        return { actor, button: [...actor.nodes.values()].find(node => node.type === 'Button') };
      };
      const retiredAppearance = appearanceButton(); retiredAppearance.button.onClick(); assert.equal(themeWrites, 1);
      const navigate = module => {
        const next = session.copyReaderControlSessionState(callbacks.owner.controlSession); next.location.module = module;
        callbacks.owner.requestControlSession(next); callbacks.bind(); callbacks.flush();
        callbackPanel.presentationReceipt = callbacks.owner.controlPresentationReceipt;
        callbackPanel.minimumCommittedIdentity = callbacks.owner.controlMinimumCommittedIdentity();
      };
      navigate('settings'); navigate('appearance');
      retiredAppearance.button.onClick(); assert.equal(themeWrites, 1, 'A to B to A cannot resurrect a retired actual Appearance native callback');
      appearanceButton().button.onClick(); assert.equal(themeWrites, 2, 'the new actual instance retains current owner input');

      const retained = makeHost(); retained.owner.controlSession.location.module = 'directory'; retained.bind(); retained.flush();
      const retainedPanel = makePanel(retained.owner), properties = createArkUIPropertyRuntimeProbe(); let rebases = 0;
      const directory = createReaderBuilderProbe(source('ReaderControlDirectoryContent.ets'),
        ['minimumKey', 'minimumIdentity', 'preparedMinimum', 'adoptedPrepared', 'adoptedPreparedKey', 'onPreparedMinimumChanged',
          'presentationPrepared', 'preparedProfile', 'displayedFacts', 'displaySnapshot', 'currentInputEnabled'],
        { ...properties.sdk, readerControlModuleProfileMatches: moduleProfileMatches, readerControlModuleFactsMatch: moduleFactsMatch }, properties.hooks).owner;
      Object.assign(directory, { preparedMinimumRequired: true, interactionEnabled: true, dataSource: { replace() {} },
        inputCurrent: () => retainedPanel.secondaryModuleInputEnabled('directory'), onProgressChanged: () => rebases++ });
      const deliver = () => {
        directory.minimumIdentity = retainedPanel.currentMinimumIdentity(); directory.minimumKey = retainedPanel.currentMinimumKey();
        directory.preparedMinimum = retainedPanel.preparedMinimum();
      };
      deliver(); assert.equal(directory.currentInputEnabled(), true); const chapterGuard = directory.preparedMinimum.ownerCurrent;
      const bookmarks = session.copyReaderControlSessionState(retained.owner.controlSession); bookmarks.location.directoryTab = 'bookmarks';
      retained.owner.requestControlSession(bookmarks); retained.bind(); retained.flush();
      retainedPanel.presentationReceipt = retained.owner.controlPresentationReceipt;
      retainedPanel.minimumCommittedIdentity = retained.owner.controlMinimumCommittedIdentity();
      assert.equal(chapterGuard(), false);
      deliver(); assert.equal(directory.currentInputEnabled(), true, 'retained Directory receives a new owner guard through the existing prepared Prop');
      const beforeRuntime = directory.preparedMinimum, beforeRebases = rebases;
      retainedPanel.runtimeLifecycle++;
      directory.preparedMinimum = retainedPanel.preparedMinimum();
      assert.equal(beforeRuntime.ownerCurrent(), false); assert.equal(directory.currentInputEnabled(), true);
      assert.equal(rebases, beforeRebases, 'same-key guard refresh adopts before the rebase early-return');
      retained.owner.controlOpenRevision++; retainedPanel.minimumOwnerKey = retained.owner.controlMinimumOwnerKey();
      assert.equal(directory.currentInputEnabled(), false, 'old opening guard cannot qualify a new opening');
      const settling = makeHost(); settling.bind(); settling.flush();
      const originState = session.copyReaderControlSessionState(settling.owner.controlSession);
      const toTts = session.copyReaderControlSessionState(originState); toTts.location.module = 'tts';
      settling.owner.requestControlSession(toTts); settling.bind();
      settling.owner.controlSession = session.expandReaderControlSession(settling.owner.controlSession, 0);
      settling.owner.latestControlVisualSession = session.copyReaderControlSessionState(settling.owner.controlSession);
      assert.equal(session.readerControlSessionStateEquals(originState, settling.owner.controlSession), false,
        'the old entire-session comparison would retire a legitimate same-owner form settle');
      assert.ok(settling.owner.activeControlNavigationIntent()); settling.flush();
      assert.equal(settling.owner.controlSession.location.module, 'tts');
      assert.equal(session.sampleReaderControlSession(settling.owner.controlSession).expansionProgress, 0,
        'ordinary navigation keeps its actual zero-time Quick target policy');
      const dismissing = makeHost(); dismissing.bind(); dismissing.flush(); const beforeDismiss = dismissing.owner.controlPresentationReceipt;
      const afterDismiss = session.copyReaderControlSessionState(dismissing.owner.controlSession); afterDismiss.location.module = 'tts';
      dismissing.owner.requestControlSession(afterDismiss); dismissing.bind();
      dismissing.owner.controlSession = session.dismissReaderControlSession(dismissing.owner.controlSession, 320);
      assert.equal(dismissing.owner.activeControlNavigationIntent(), undefined); dismissing.flush();
      assert.equal(dismissing.owner.controlPresentationReceipt, beforeDismiss, 'real dismiss remains a retiring owner boundary');
      const morphing = makeHost(); morphing.bind(); morphing.flush();
      const targetFull = session.expandReaderControlSession(session.enterReaderControlModule(morphing.owner.controlSession, 'tts', 0), 320);
      morphing.owner.requestControlSession(targetFull); morphing.bind();
      morphing.owner.controlSession = session.expandReaderControlSession(morphing.owner.controlSession, 320);
      morphing.owner.latestControlVisualSession = session.advanceReaderControlSession(morphing.owner.controlSession, 208, morphing.owner.controlSession.epoch);
      const advanced = session.sampleReaderControlSession(morphing.owner.latestControlVisualSession);
      assert.ok(advanced.expansionProgress > 0 && advanced.expansionProgress < 1);
      morphing.flush();
      assert.equal(morphing.owner.controlSession.transition.from.expansionProgress, advanced.expansionProgress,
        'pending real morph rebases from the latest legal Runtime sample');
      assert.equal(morphing.owner.controlSession.transition.durationMs, 320);
      assert.notEqual(morphing.owner.controlSession.transition.from.expansionProgress, targetFull.transition.from.expansionProgress,
        'the stale requested session is an explicit backward-jump negative');
      const opening = makeHost(); opening.bind(); opening.flush();
      opening.owner.controlSession = session.enterReaderControlModule(session.openReaderControlSession(session.createReaderControlSessionState(), 320), 'settings', 0);
      opening.owner.latestControlVisualSession = session.advanceReaderControlSession(opening.owner.controlSession, 64, opening.owner.controlSession.epoch);
      const openTarget = hostSession.setReaderControlHostPage(opening.owner.latestControlVisualSession, 'moduleTts',
        { showDurationMs: 320, dismissDurationMs: 320, morphDurationMs: 320, navigateDurationMs: 0 });
      assert.equal(openTarget.transition.kind, 'open'); assert.equal(openTarget.transition.durationMs, 320);
      opening.owner.requestControlSession(openTarget);
      assert.equal(opening.owner.activeControlNavigationIntent().durationMs, 0, 'inherited open duration is not a navigation duration');
      opening.bind(); opening.owner.latestControlVisualSession = session.advanceReaderControlSession(opening.owner.controlSession, 128, opening.owner.controlSession.epoch);
      const currentOpening = opening.owner.latestControlVisualSession;
      opening.flush();
      assert.equal(opening.owner.controlSession.transition.kind, 'open');
      assert.equal(opening.owner.controlSession.transition.elapsedMs, currentOpening.transition.elapsedMs);
      assert.equal(opening.owner.controlSession.transition.durationMs, currentOpening.transition.durationMs);
      assert.equal(session.sampleReaderControlSession(opening.owner.controlSession).visibilityProgress,
        session.sampleReaderControlSession(currentOpening).visibilityProgress, 'zero-time navigation continues the original opening clock without jumping visibility');
    }
    if (id === 'environment-vs-admission') {
      const h = makeHost(); h.bind(); h.flush(); const first = h.owner.controlPresentationReceipt;
      const panel = makePanel(h.owner);
      h.owner.interactionBlocked = true;
      assert.equal(h.owner.controlMinimumCurrent(h.owner.controlMinimumIdentity()), false);
      assert.equal(h.owner.controlMinimumReceiptCurrent(first.key), true, 'business blocking does not destroy geometry');
      panel.inputEnabled = false; assert.equal(panel.secondaryModuleInputEnabled('settings'), false);
      h.owner.interactionBlocked = false; panel.inputEnabled = true;
      metrics = { ...metrics, revision: 2 }; assert.equal(h.owner.controlMinimumReceiptCurrent(first.key), true);
      metrics = { ...metrics, systemFontScale: 2, revision: 3 };
      assert.equal(h.owner.controlMinimumReceiptCurrent(first.key), false);
      panel.minimumEnvironmentKey = h.owner.controlMinimumEnvironmentKey();
      assert.equal(panel.minimumInputReady(), false);
      const retained = panel.preparedMinimum();
      assert.equal(retained.moduleData, first.prepared.moduleData, 'pending resize retains the complete profile');
      assert.equal(panel.preparedMinimum(), retained, 'identical tuple/scope reuses the actual prepared wrapper');
      metrics = { ...metrics, systemFontScale: 1, revision: 4 };
      panel.minimumEnvironmentKey = h.owner.controlMinimumEnvironmentKey();
      first.layout.contentBudget.quickContentHeightVp = 17;
      assert.equal(panel.minimumInputReady(), true, 'positive constrained viewport does not impose a page-wide44 rule');
      first.layout.contentBudget.quickContentHeightVp = 0; assert.equal(panel.minimumInputReady(), false);
    }
    if (id === 'measurement-failure-budget') {
      const h = makeHost(); h.bind(); h.flush(); const first = h.owner.controlPresentationReceipt;
      h.bind(2, (candidate, profile) => { profile.moduleData = { module: 'tts', tts: {} }; return candidate; }); h.flush();
      assert.equal(h.owner.controlPresentationReceipt, first);
      h.bind(3, candidate => ({ ...candidate, key: 'wrong-key' })); h.flush();
      assert.equal(h.owner.controlPresentationReceipt, first);
      const target = session.copyReaderControlSessionState(h.owner.controlSession); target.location.module = 'search';
      h.owner.requestControlSession(target);
      h.bind(4, (candidate, profile) => {
        profile.moduleFacts = { module: 'search', search: { resultsMode: false, loading: false } };
        return candidate;
      }); h.flush();
      assert.equal(h.owner.controlPresentationReceipt, first, 'a formal new page without its immutable display reader cannot be admitted');
      assert.equal(h.owner.controlSession.location.module, 'settings');
      h.owner.cancelControlNavigationIntent();
      h.owner.controlSession.location.module = 'tts'; h.owner.controlModuleVisitRevision++;
      h.owner.bindControlMinimum(h.owner.controlMinimumIdentity(), () => undefined, () => undefined); h.flush();
      assert.equal(h.owner.controlPresentationReceipt, first);
      const panel = makePanel(h.owner); assert.equal(panel.secondaryModuleInputEnabled('settings'), false);
      assert.equal(panel.navigationInputEnabled(), true, 'valid shared shell remains a superseding navigation owner');
    }
    if (id === 'search-native-editor-scope') {
      const h = makeHost(); h.owner.controlSession.location.module = 'search'; h.bind(); h.flush();
      const panel = makePanel(h.owner), report = panel.moduleTemporaryLayerHandler('search');
      const Search = selectedProductionMethods(ui('ReaderControlSearchContent.ets'), 'ReaderControlSearchContent',
        ['currentInputEnabled', 'currentEditorInputEnabled', 'onQueryEditingChanged', 'onInputChanged',
          'dismissTemporaryLayer', 'stopQueryEditing', 'presentationPrepared'],
        { DEBUG: false, readerControlModuleFactsMatch: moduleFactsMatch, readerControlModuleProfileMatches: moduleProfileMatches });
      const search = new Search(); let stopped = 0;
      Object.assign(search, { queryInputMounted: true, queryEditing: false, interactionEnabled: true,
        preparedMinimumRequired: true, preparedMinimum: panel.preparedMinimum(),
        minimumIdentity: h.owner.controlPresentationReceipt.identity, minimumKey: h.owner.controlPresentationReceipt.key,
        inputCurrent: () => panel.secondaryModuleInputEnabled('search'), editorInputCurrent: () => panel.moduleEditorInputEnabled('search'),
        onTemporaryLayerChange: report, inputController: { stopEditing: () => stopped++ }, onResultLayoutChanged() {} });
      search.onQueryEditingChanged(true); assert.equal(h.owner.controlTemporaryLayerPresented, false);
      assert.equal(panel.hasCurrentTemporaryInput(), true, 'accepted editor receives scope synchronously before projection');
      for (const character of ['晋', '江', '文', '学']) {
        search.query = (search.query ?? '') + character; h.bind();
        search.onInputChanged(); assert.equal(stopped, 0, 'pending same-geometry character retains actual editing');
        h.flush(); assert.equal(search.queryEditing, true);
      }
      metrics = { ...metrics, systemFontScale: 1.6, revision: 2 };
      panel.minimumEnvironmentKey = h.owner.controlMinimumEnvironmentKey();
      assert.equal(panel.moduleEditorInputEnabled('search'), true);
      assert.equal(panel.secondaryModuleInputEnabled('search'), false, 'submit/back do not borrow native editor qualification');
      search.interactionEnabled = false; search.onInputChanged();
      assert.equal(stopped, 0, 'accepted editor remains through an actual pending environment reflow');
      h.owner.controlModuleVisitRevision++; panel.minimumIdentity = h.owner.controlMinimumIdentity();
      panel.minimumCommittedIdentity = h.owner.controlMinimumCommittedIdentity();
      report(false); assert.equal(panel.temporaryInputActive, true, 'retired callback cannot release a successor scope');
      assert.equal(panel.moduleEditorInputEnabled('search'), false, 'different current semantic owner invalidates the accepted editor');
      search.onInputChanged(); assert.equal(stopped, 1); assert.equal(search.queryEditing, false);
    }
    if (id === 'playback-source-reuse') {
      for (const module of ['tts', 'autoPage']) {
        const h = makeHost(); h.owner.controlSession.location.module = module;
        let accepted;
        Object.defineProperty(h.owner, 'controlPresentationReceipt', {
          get() { return accepted; },
          set(value) {
            assert.equal(h.owner.controlMinimumReady, true, 'receipt observers see the ready owner');
            assert.equal(h.owner.controlMinimumCandidateBook, h.owner.bookId);
            accepted = value;
          },
        });
        h.bind(); h.flush();
        const first = h.owner.controlPresentationReceipt;
        h.owner.controlLayout = () => h.owner.controlPresentationReceipt.layout;
        assert.equal(first.profile.playbackData[module], first.profile.moduleData[module]);
        h.bind(); h.flush(); assert.equal(h.owner.controlPresentationReceipt, first);
        const publisherMethods = [...panelOrdinary, 'minimumModule', 'selectedMinimumProfile', 'publishSelectedPlaybackProfile'];
        const PlaybackPanel = selectedProductionMethods(ui('ReaderControlPanel.ets'), 'ReaderControlPanel', publisherMethods,
          { DEBUG: false, readerControlMotionBounds: motion.readerControlMotionBounds,
            readerControlPlaybackProfileMatches: playbackMatches });
        const panel = Object.assign(new PlaybackPanel(), makePanel(h.owner), { minimumReady: true,
          minimumMetricsRevision: metrics.revision, minimumRequestLocation: h.owner.controlMinimumRequestLocation(),
          fixedIsland: true, controlPanelHeight: () => geometry.readerControlIslandHeight(first.layout.fullPanelHeight),
          controlQuickHeight: () => geometry.readerControlIslandHeight(first.layout.fullPanelHeight),
          contentEndpointHeight: () => 180,
          onPlaybackProfileSelected: value => h.owner.acceptControlPlaybackProfile(value) });
        panel.publishSelectedPlaybackProfile(); const source = h.owner.controlPlaybackProfile;
        assert.ok(source, `fixed-island ${module} publishes the selected natural profile`);
        assert.equal(source.identity, first.identity);
        assert.equal(source.data[module + 'Facts'], first.facts[module]);
        const layoutWithoutQuickHeight = { ...first.layout, quickPanelHeight: undefined };
        const fallback = { ...source, layout: layoutWithoutQuickHeight, bounds: { ...source.bounds,
          quickHeight: Math.min(330, source.bounds.fullHeight) } };
        h.owner.controlLayout = () => layoutWithoutQuickHeight;
        h.owner.acceptControlPlaybackProfile(fallback);
        assert.equal(h.owner.controlPlaybackProfile, fallback, 'the default quick bound is accepted without an explicit height');
        for (const invalidHeight of [NaN, -1, fallback.bounds.fullHeight + 1]) {
          const invalid = { ...fallback, bounds: { ...fallback.bounds, quickHeight: invalidHeight } };
          assert.equal(playbackMatches(invalid, module, first.identity, first.key, metrics.revision), false);
        }
        h.owner.controlLayout = () => h.owner.controlPresentationReceipt.layout;
        h.owner.acceptControlPlaybackProfile(source);
        if (module === 'tts') {
          h.bind(0, undefined, 1); h.flush();
          panel.presentationReceipt = h.owner.controlPresentationReceipt;
          panel.publishSelectedPlaybackProfile();
          assert.equal(h.owner.controlPlaybackProfile.key, source.key);
          assert.equal(h.owner.controlPlaybackProfile.data.tts, source.data.tts);
          assert.notEqual(h.owner.controlPlaybackProfile.data.ttsFacts.readViewState(), source.data.ttsFacts.readViewState(),
            'new launches receive latest same-geometry display facts while the earlier launch receipt remains frozen');
        }
        const next = session.copyReaderControlSessionState(h.owner.controlSession); next.location.module = 'search';
        h.owner.requestControlSession(next);
        panel.minimumIdentity = h.owner.controlMinimumIdentity();
        panel.minimumRequestLocation = h.owner.controlMinimumRequestLocation();
        panel.publishSelectedPlaybackProfile();
        assert.equal(h.owner.controlPlaybackProfile.identity, first.identity, 'pending requested module cannot replace the committed playback source owner');
        assert.ok(playbackMatches(h.owner.controlPlaybackProfile, module, h.owner.controlMinimumCommittedIdentity(), first.key, metrics.revision));
        h.bind(); h.flush(); h.owner.controlPlaybackProfile = undefined;
        h.owner.acceptControlPlaybackProfile(source);
        assert.equal(h.owner.controlPlaybackProfile, undefined, 'old playback source callback retires after semantic commit');
        h.owner.bookId = 'successor'; assert.equal(h.owner.controlMinimumReceiptCurrent(first.key), false);
      }
      const h = makeHost(); h.owner.controlSession.location.module = 'tts'; h.bind(); h.flush();
      const properties = createArkUIPropertyRuntimeProbe();
      class TtsParams {
        constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
        updateStateVars(params) { Object.assign(this.params, params); }
      }
      const names = ['presentationReceipt', 'lastVisibleContentLocation', 'contentMotionProgress', 'currentLayout',
        'paintedPresentationReceipt',
        'currentMinimumKey', 'currentMinimumIdentity', 'committedMinimumIdentity', 'minimumPresentationAvailable', 'preparedMinimum',
        'controlCallbackGuard', 'currentMoreMenuOwnerScope', 'contentLocation', 'rememberVisibleContentLocation',
        'onPresentationReceiptChanged', 'ttsModuleContent'];
      const panel = createReaderBuilderProbe(source('ReaderControlPanel.ets'), names,
        { ...properties.sdk, ...session, ReaderControlTtsContent: TtsParams },
        { ...properties.hooks, childSources: { ReaderControlTtsContent: source('ReaderControlTtsContent.ets') } }).owner;
      Object.assign(panel, { preparedMinimumRequired: true, minimumOwnerKey: h.owner.controlMinimumOwnerKey(),
        minimumCommittedIdentity: h.owner.controlMinimumCommittedIdentity(), minimumEnvironmentKey: h.owner.controlMinimumEnvironmentKey(),
        onLayoutChanged() {}, publishSelectedPlaybackProfile() {}, secondaryModuleInputEnabled: () => true,
        moduleTemporaryLayerHandler: () => () => {}, contentEndpointHeight: full => full ? 666 : 190,
        contentEditingHeight: () => 666,
        frame: () => ({ visibility: 1 }), isExpanded: () => false,
        runtimeLifecycle: 1, sourceId: 'source', sourceBookId: 'book', controlOpenRevision: 1 });
      panel.presentationReceipt = h.owner.controlPresentationReceipt;
      const fullState = session.copyReaderControlSessionState(h.owner.controlSession); fullState.location.form = 'full';
      panel.contentMotionProgress = session.sampleReaderControlSession(fullState).expansionProgress;
      assert.equal(panel.contentMotionProgress, 1);
      panel.rememberVisibleContentLocation(fullState);
      panel.ttsModuleContent();
      const child = [...panel.children.values()][0]; assert.equal(child.params.form, 'full');
      h.owner.controlSession = fullState; h.bind(0, undefined, 1); h.flush();
      assert.equal(h.owner.controlPresentationReceipt.location.form, 'quick', 'historical prepared form demonstrates the metadata hazard');
      panel.presentationReceipt = h.owner.controlPresentationReceipt; properties.flush(); panel.replay();
      assert.equal(panel.contentLocation().form, 'full'); assert.equal(child.params.form, 'full');
      metrics = { ...metrics, systemFontScale: 1.6, revision: metrics.revision + 1 }; h.bind(6); h.flush();
      panel.minimumEnvironmentKey = h.owner.controlMinimumEnvironmentKey();
      panel.presentationReceipt = { ...h.owner.controlPresentationReceipt,
        location: { ...h.owner.controlPresentationReceipt.location, form: 'quick' } };
      properties.flush(); panel.replay();
      assert.equal(panel.contentMotionProgress, 1); assert.equal(panel.contentLocation().form, 'full');
      assert.equal(child.params.form, 'full', 'resize profile receipt cannot replace the current Runtime Full source choice');
    }
    if (id === 'fixed-island-playback-scroll') {
      const playback = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
      for (const [name, kind] of [['ReaderControlAutoPageContent', 'quickAutoPage'], ['ReaderControlTtsContent', 'quickTts']]) {
        const admission = kind === 'quickTts' ? ['actorMeasurementScope', 'measuredActorCurrent'] :
          ['morphMeasurementScope', 'naturalMorphMeasurementCurrent'];
        const Actor = selectedProductionMethods(ui(name + '.ets'), name, ['measureActor', 'reportMorphActor', ...admission], playback);
        let offset = 23;
        let frameOffset = 0;
        let progress = 0.4;
        const reports = [];
        const actor = Object.assign(new Actor(), { form: 'quick', fixedIsland: true, sourceOnly: 'none',
          minimumIdentity: 'active', readerWindowMetricsRevision: metrics.revision,
          scroller: { currentOffset: () => ({ yOffset: offset }) },
          p: () => progress, availableWidth: 310.4, availableHeight: 180, fullViewportHeight: 480,
          islandPlaybackHeight: () => 84, selectedMinimum: () => ({}), minimumProfile: () => ({}),
          frame: () => ({ content: { x: frameOffset, y: frameOffset }, playback: { x: 0, y: frameOffset },
            control: { x: 0, y: frameOffset } }),
          onMorphActorMeasured: (...rect) => reports.push(rect) });
        actor.measureActor(false, { globalPosition: { x: 54, y: 580 }, width: 310, height: 84 });
        frameOffset = 12; // New timer/rate facts move only the legacy morph frame.
        progress = 0;
        offset = 71;
        actor.reportMorphActor();
        assert.deepEqual(reports, [[kind, 54, 580, 310, 84], [kind, 54, 532, 310, 84]]);
        actor.availableWidth += 1;
        actor.reportMorphActor();
        assert.equal(reports.length, 2, 'an actual card resize still needs a fresh measurement');
        actor.availableWidth -= 1;
        actor.minimumIdentity = 'reopened';
        actor.reportMorphActor();
        assert.equal(reports.length, 2, 'a new opening requires its own measured source');
        actor.measureActor(false, { globalPosition: { x: 54, y: 555 }, width: 310, height: 84 });
        assert.deepEqual(reports.at(-1), [kind, 54, 555, 310, 84]);
        actor.sourceDetached = true;
        actor.reportMorphActor();
        assert.equal(reports.length, 3, 'detached content releases the measurement owner');
        // The ordinary morph still needs a fresh area at the matching pose.
        actor.fixedIsland = false;
        actor.sourceDetached = false;
        actor.frame = () => ({ content: { x: frameOffset, y: frameOffset },
          playback: { x: 0, y: frameOffset, width: 240, height: 88 },
          control: { x: 0, y: frameOffset, width: 240, height: 88 } });
        for (const full of [false, true]) {
          actor.form = full ? 'full' : 'quick';
          progress = full ? 1 : 0;
          const area = { globalPosition: { x: 54, y: 540 }, width: full ? 240 : actor.availableWidth,
            height: full ? 88 : actor.availableHeight };
          actor.measureActor(full, area);
          const expected = playback.readerControlPlaybackSourceKind(kind === 'quickTts' ? 'tts' : 'autoPage', actor.form);
          assert.deepEqual(reports.at(-1), [expected, 54, 540, area.width, area.height]);
          const current = reports.length;
          frameOffset += 3;
          actor.reportMorphActor(); assert.equal(reports.length, current);
          progress = 0.5;
          actor.measureActor(full, area); assert.equal(reports.length, current);
        }
      }
    }
    if (id === 'fixed-island-font-reorder') {
      const appearance = await import('../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts');
      const grid = await import('../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceGeometry.ts');
      const touch = { Down: 'down', Move: 'move', Up: 'up', Cancel: 'cancel' };
      let scrollTick;
      let scrollOffset = 0;
      const Actor = selectedProductionMethods(ui('ReaderControlAppearanceContent.ets'), 'ReaderControlAppearanceContent',
        ['islandFontGrid', 'islandFontGridHeight', 'islandFontDropIndex', 'fontInput', 'fontTouch',
          'fontCellPosition', 'fontSlotPosition', 'captureFontPositions', 'beginFontDrag', 'updateFontDrag', 'settleFontDrag',
          'cancelFontDrag', 'observeFontOrderPresentation', 'syncIslandFontDrag', 'islandFontAutoScrollDelta',
          'updateIslandFontAutoScroll', 'stopIslandFontAutoScroll'],
        { ...appearance, ...grid, TOK_BORDER_W: 1, TouchType: touch, readerMotionNowMs: () => 0,
          setInterval(callback, delay) { assert.equal(delay, 16); scrollTick = callback; return 1; },
          clearInterval(id) { assert.equal(id, 1); scrollTick = undefined; },
          motionSpecGet: () => ({ durationMs: 120 }) });
      const snapshot = appearance.createDefaultReaderAppearanceSnapshot(), order = snapshot.fontOrder;
      const committed = [], activity = [];
      const actor = new Actor();
      Object.assign(actor, { fixedIsland: true, availableWidth: 338, motionProgress: 0, importLayout: 'ordered-slot-approved',
        islandScrollTop: 360, islandScrollHeight: 110, islandFontScrollTimer: -1,
        islandScroller: { currentOffset: () => ({ yOffset: scrollOffset }), isAtEnd: () => false,
          scrollBy(_x, y) { scrollOffset += y; actor.syncIslandFontDrag(); } },
        fullInput: () => true, currentInputEnabled: () => true, displaySnapshot: () => snapshot, frame: () => ({}),
        fontIds: () => actor.draggedFontId ? actor.previewFontOrder : order, previewFontOrder: [],
        fontTracks: new Map(), fontVerification: { finish() {} }, fontPointerId: -1, draggedFontId: '',
        retireFontOrderPresentation() {}, animateFontPositions() {},
        onFontReorderActivityChange: active => activity.push(active), onFontOrderChange: value => {
          committed.push(value);
          return { displayed: new Promise(() => {}), current: () => false, retire() {} };
        } });
      const gridMetrics = actor.islandFontGrid();
      assert.equal(gridMetrics.columns, 4);
      assert.equal(gridMetrics.cellWidth, 77);
      assert.equal(actor.islandFontGridHeight(), 140);
      const font = order[0], target = actor.fontSlotPosition(order[order.length - 1], {}, order);
      assert.deepEqual(target, { x: 0, y: 96 }, 'one cell occupies the normal column on the partial row');
      const event = (type, x, y) => {
        const point = { id: 1, windowX: x, windowY: y };
        return { type, changedTouches: [point], touches: [point], stopPropagation() {} };
      };
      actor.fontTouch(font, event(touch.Down, 80, 400));
      actor.beginFontDrag(font);
      assert.deepEqual(activity, [true]);
      assert.equal(scrollTick, undefined, 'the centered pointer does not move the viewport');
      actor.fontTouch(font, event(touch.Move, 80 + target.x, 466));
      assert.notEqual(actor.previewFontOrder.at(-1), font);
      for (let frame = 0; frame < 5; frame += 1) scrollTick();
      assert.ok(scrollOffset > 0, 'a held pointer at the lower edge scrolls without another move event');
      assert.equal(actor.previewFontOrder.at(-1), font);
      actor.fontTouch(font, event(touch.Up, 80 + target.x, 466));
      assert.equal(scrollTick, undefined, 'release cancels edge scrolling');
      assert.deepEqual(activity, [true, false]);
      assert.deepEqual(committed, [appearance.moveReaderAppearanceFontSlot(order, 0, order.length - 1)]);
    }
    if (id === 'profile-preflight-no-side-effect') {
      const file = ui('ReaderControlPanel.ets'), text = source('ReaderControlPanel.ets');
      const tree = ts.createSourceFile(String(file), text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
      assert.deepEqual(tree.parseDiagnostics, []);
      const owner = tree.statements.find(node => node.name?.text === 'ReaderControlPanel');
      const method = owner.members.find(node => node.name?.getText(tree) === 'defaultMinimumFacts');
      assert.ok(method);
      const calls = [];
      const collect = node => { if (ts.isCallExpression(node)) calls.push(node.expression.getText(tree)); ts.forEachChild(node, collect); };
      collect(method);
      for (const name of ['Directory', 'Search', 'Settings', 'Appearance', 'Tts', 'AutoPage', 'Replace'])
        assert.ok(calls.includes(`readerControl${name}MinimumFacts`), 'all formal module facts use their actual shared builder');
      assert.equal(calls.some(name => /(?:load|initialize|attach|focus|play|write|save)/i.test(name)), false, 'preflight has no business lifecycle call');
      for (const declaration of tree.statements.filter(ts.isImportDeclaration)) {
        const specifier = declaration.moduleSpecifier.text;
        if (!specifier.startsWith('.') || !/Minimum|HeaderGeometry|DirectoryModel/.test(specifier)) continue;
        const target = new URL(specifier + (specifier.endsWith('Geometry') || specifier.endsWith('Model') ? '.ts' : '.ets'), file);
        const targetText = readFileSync(target, 'utf8');
        for (const binding of declaration.importClause?.namedBindings?.elements ?? [])
          assert.match(targetText, new RegExp('export (?:type |interface |class |function |const )' + (binding.propertyName?.text ?? binding.name.text) + '\\b'), 'actual production import resolves without a probe namespace');
      }
      const h = makeHost(); h.owner.controlSession.location.module = 'search'; h.bind();
      const originalMeasure = h.owner.controlMinimumProvider, originalReader = h.owner.controlMinimumProfileReader;
      const Publisher = selectedProductionMethods(ui('ReaderControlPanel.ets'), 'ReaderControlPanel', ['publishMinimumMeasurer'],
        { readerControlModuleFactsGeometryKey: factsGeometryKey, readerControlModuleFactsDisplayEqual: factsDisplayEqual });
      const publisher = new Publisher();
      const rows = Array.from({ length: 20000 }, (_, index) => ({ index }));
      Object.defineProperty(rows, 'toJSON', { value() { throw new Error('full display rows must not be serialized'); } });
      const initialView = { kind: 'results', results: rows };
      let facts = { module: 'search', search: { query: '', title: 'First', snippet: 'Snippet', message: '',
        hasResults: true, resultsMode: true, loading: false, loadMoreLabel: '', loadMoreMessage: '',
        readViewState: () => initialView } };
      Object.assign(publisher, { runtimeMounted: true, minimumFontsReady: true, preparedMinimumRequired: true,
        minimumIdentity: h.owner.controlMinimumIdentity(), minimumEnvironmentKey: h.owner.controlMinimumEnvironmentKey(),
        chapterTitle: 'Chapter', totalChapters: 20, minimumModule: () => 'search', defaultMinimumFacts: () => facts,
        minimumProfileReader: originalReader,
        measureControlMinimum(_module, widths, key, _delegate, _reader, nextFacts) {
          const candidate = originalMeasure(widths, key); originalReader(key).moduleFacts = nextFacts; return candidate;
        }, onMinimumMeasurerReady: (...args) => h.owner.bindControlMinimum(...args) });
      publisher.publishMinimumMeasurer(); h.flush();
      const count = h.measurements(), receipt = h.owner.controlPresentationReceipt;
      const copied = createArkUIPropertyRuntimeProbe().deepCopy(receipt.prepared);
      assert.equal(copied.facts.search.readViewState, receipt.prepared.facts.search.readViewState);
      assert.equal(copied.facts.search.readViewState(), initialView, 'actual SDK Prop copying preserves the original immutable view through the captured reader');
      publisher.publishMinimumMeasurer(); assert.equal(h.frames.length, 0, 'unchanged display facts publish zero new frames');
      const nextView = { kind: 'results', results: rows, revision: 2 };
      facts = { ...facts, search: { ...facts.search, readViewState: () => nextView } };
      publisher.publishMinimumMeasurer(); assert.equal(h.frames.length, 1);
      assert.equal(h.owner.controlPresentationReceipt, receipt, 'readonly metadata is not committed in the Prop Watch');
      h.flush(); assert.equal(h.measurements(), count, 'view-only immutable facts require zero candidate/font measurements');
      assert.equal(h.owner.controlPresentationReceipt.key, receipt.key);
      assert.equal(h.owner.controlPresentationReceipt.facts.search.readViewState().revision, 2);
      assert.throws(() => JSON.stringify({ ...facts.search, viewState: facts.search.readViewState() }), /must not be serialized/,
        'former embedded full-view JSON is the explicit negative');
    }
    if (id === 'module-first-frame-atomic' || id === 'home-single-owner') {
      if (id === 'module-first-frame-atomic') {
        const h = makeHost(); h.owner.controlSession.location.module = 'search'; h.bind(); h.flush();
        const first = h.owner.controlPresentationReceipt, panel = makePanel(h.owner);
        const search = createReaderBuilderProbe(source('ReaderControlSearchContent.ets'),
          ['searchAction', 'canSearch', 'submit', 'currentInputEnabled', 'presentationPrepared'],
          { readerControlModuleFactsMatch: moduleFactsMatch, readerControlModuleProfileMatches: moduleProfileMatches }).owner;
        let dispatched = 0;
        Object.assign(search, { appThemeScheme: 'day', queryInputMounted: true, interactionEnabled: true,
          preparedMinimumRequired: true, preparedMinimum: panel.preparedMinimum(), minimumIdentity: first.identity, minimumKey: first.key,
          query: '晋江', state: { kind: 'idle' }, inputCurrent: () => panel.secondaryModuleInputEnabled('search'),
          frame: () => ({ action: { x: 0, y: 0, width: 32, height: 32 } }),
          presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), onSearch: () => dispatched++ });
        search.searchAction();
        const native = type => [...search.nodes.values()].find(node => node.type === type);
        const button = native('Button'), image = native('Image');
        assert.equal(button.enabled, true); assert.equal(image.opacity, 1);
        const next = session.copyReaderControlSessionState(h.owner.controlSession); next.location.module = 'tts';
        h.owner.requestControlSession(next);
        panel.minimumIdentity = h.owner.controlMinimumIdentity();
        assert.equal(h.owner.controlSession.location.module, 'search', 'intent does not change the committed semantic page');
        h.bind(); search.replay();
        assert.equal(native('Button'), button); assert.equal(button.enabled, true);
        assert.equal(image.opacity, 1, 'old real Search glyph does not dim in the pending frame');
        button.onClick(); assert.equal(dispatched, 1, 'still-current old page retains genuine business input');
        panel.minimumCommittedIdentity = h.owner.controlMinimumIdentity(); search.replay();
        assert.equal(image.opacity, .4, 'the earlier semantic-first strategy is a visible failing negative');
        panel.minimumCommittedIdentity = h.owner.controlMinimumCommittedIdentity(); search.replay();
        h.flush();
        assert.equal(h.owner.controlSession.location.module, 'tts');
        assert.notEqual(h.owner.controlPresentationReceipt.key, first.key);
        panel.minimumCommittedIdentity = h.owner.controlMinimumCommittedIdentity();
        panel.presentationReceipt = h.owner.controlPresentationReceipt;
        button.onClick(); assert.equal(dispatched, 1, 'old captured Search callback retires after the actual atomic commit');
        assert.match(source('LocalReadingExperience.ets'), /navigateDurationMs:\s*0/);
        for (const p of [0, 1]) assert.equal(presentation.sampleReaderControlMotionPresentation(p).contentOpacity, 1,
          'ordinary module navigation retains its Quick/Full endpoint and does not add a fade to hide a second layout');
      }
      const properties = createArkUIPropertyRuntimeProbe(), mounts = [];
      const childFiles = { directory: 'ReaderControlDirectoryContent.ets', appearance: 'ReaderControlAppearanceContent.ets',
        settings: 'ReaderControlSettingsContent.ets', search: 'ReaderControlSearchContent.ets', tts: 'ReaderControlTtsContent.ets',
        autoPage: 'ReaderControlAutoPageContent.ets', replace: 'ReaderControlReplaceContent.ets' };
      const dependencies = { ...properties.sdk, ...settings, readerControlExtentFits: geometry.readerControlExtentFits }, childSources = {};
      for (const [module, file] of Object.entries(childFiles)) {
        const name = file.replace('.ets', ''), Selected = selectedProductionMethods(ui(file), name, ['preparedProfile', 'presentationPrepared'],
          { readerControlModuleProfileMatches: moduleProfileMatches, readerControlModuleFactsMatch: moduleFactsMatch });
        childSources[name] = source(file);
        dependencies[name] = class {
          constructor(owner, params, _storage, identity) { Object.assign(this, { owner, params, id: identity, nodes: new Map() }); }
          updateStateVars(next) { Object.assign(this.params, next); }
          initialRender() {
            this.params.presentationPrepared = Selected.prototype.presentationPrepared;
            const value = Selected.prototype.preparedProfile.call(this.params);
            assert.ok(value, 'first actual Panel SDK child construction receives paired profile for ' + module);
            mounts.push({ module, params: this.params, value });
          }
        };
      }
      const names = ['controlContent', 'appearanceContent', 'searchModuleContent', 'settingsModuleContent',
        'ttsModuleContent', 'autoPageModuleContent', 'replaceModuleContent', 'appearanceModuleContent',
        'currentLayout', 'currentMinimumKey', 'currentMinimumIdentity', 'committedMinimumIdentity', 'preparedMinimum', 'minimumPresentationAvailable',
        'presentationReceipt', 'lastVisibleContentLocation', 'contentLocation', 'onPresentationReceiptChanged',
        'controlCallbackGuard', 'currentMoreMenuOwnerScope'];
      let homePanel, contentHeight = 190;
      for (const module of id === 'home-single-owner' ? ['home'] : Object.keys(childFiles)) {
        const h = makeHost();
        const probe = createReaderBuilderProbe(source('ReaderControlPanel.ets'), names, dependencies,
          { ...properties.hooks, childSources, mountChildren: true, allowEmptyBranchAdmission: true });
        const panel = probe.owner;
        Object.assign(panel, { preparedMinimumRequired: true, minimumOwnerKey: h.owner.controlMinimumOwnerKey(),
          minimumEnvironmentKey: h.owner.controlMinimumEnvironmentKey(), onLayoutChanged() {},
          frame: () => ({ content: { width: 300, height: contentHeight } }), homeContentMinimumHeight: () => 190,
          homeContent() {}, contentEndpointHeight: full => full ? 666 : 190,
          contentMotionWidth: 300, contentMotionHeight: 190, contentMotionProgress: 0,
          secondaryModuleInputEnabled: () => true, contentInputEnabled: () => true, isExpanded: () => false,
          listSessionKey: () => 'visit', moduleTemporaryLayerHandler: () => () => {},
          canStepChapter: () => true, settingsSnapshot: settings.createDefaultReaderSettingsSnapshot(), appearanceSnapshot: { alignment: 'justify' },
        });
        panel.controlContent(); assert.equal(panel.children.size, 0, 'no first-fallback module mounts without complete receipt');
        h.owner.controlSession.location = { level: module === 'home' ? 'home' : 'secondary', module,
          directoryTab: 'directory', form: 'quick' };
        h.owner.controlModuleVisitRevision++;
        panel.minimumIdentity = h.owner.controlMinimumIdentity();
        panel.minimumCommittedIdentity = h.owner.controlMinimumCommittedIdentity();
        h.bind(); const before = mounts.length;
        properties.flush(); assert.equal(mounts.length, before, 'pending request never paints the unprepared target module');
        h.flush(); assert.ok(h.owner.controlPresentationReceipt);
        panel.presentationReceipt = h.owner.controlPresentationReceipt;
        properties.flush();
        if (module === 'home') homePanel = panel;
        if (process.env.READER_LIFECYCLE_DIAGNOSTIC === '1') console.log(JSON.stringify({ kind: 'lifecycle-mount-diagnostic',
          module, available: panel.minimumPresentationAvailable(), location: panel.lastVisibleContentLocation,
          identity: panel.minimumIdentity, receiptIdentity: panel.presentationReceipt?.identity,
          observers: panel.observers.length, mounts: mounts.length }));
      }
      if (id === 'module-first-frame-atomic') {
        assert.deepEqual([...new Set(mounts.map(value => value.module))], Object.keys(childFiles));
        for (const value of mounts) assert.equal(value.params.preparedMinimum.key, value.params.minimumKey);
      } else {
        const panel = homePanel;
        const scroll = [...panel.nodes.values()].find(node => node.type === 'Scroll');
        assert.ok(scroll); contentHeight = 50; panel.replay();
        assert.equal([...panel.nodes.values()].find(node => node.type === 'Scroll'), scroll);
        contentHeight = 250; panel.replay();
        assert.equal([...panel.nodes.values()].find(node => node.type === 'Scroll'), scroll);
      }
    }
    recordContractCasePass(id);
  }
  console.log(JSON.stringify({ kind: 'reader-control-measurement-lifecycle-scope', selected: selected.length,
    sdkPanelMount: selected.some(id => id === 'module-first-frame-atomic' || id === 'home-single-owner') ? 'SELECTED' : 'NOT_RUN',
    boundary: 'Actual unchanged Host/Panel methods, actual SDK Panel argument lowering and actual child profile getters. Candidate measurements and child widget paints are finite ports. Native solver, keyboard, rasterization and device timing remain NOT_RUN.' }));
}

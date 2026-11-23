import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';

const definitions = {
  'committed-entry-load': {
    description: 'Actual SDK Host entry, asynchronous minimum commit and Replace loader ownership, cancellation and reopening.',
    resources: [],
  },
};
const selected = selectContractCases(definitions);
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
        return next(specifier + '.ts', context);
      throw error;
    }
  } });
  const ui = name => new URL('../entry/src/main/ets/features/reading/ui/' + name, import.meta.url);
  const source = readFileSync(ui('LocalReadingExperience.ets'), 'utf8');
  const session = await import(ui('ReaderControlSessionState.ts'));
  const hostSession = await import(ui('ReaderControlHostSession.ts'));
  const geometry = await import(ui('ReaderLayoutGeometry.ts'));
  const receiptPolicy = await import(ui('ReaderControlMinimumReceipt.ts'));
  const window = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const timing = await import('../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts');
  const motionPolicy = await import(ui('ReaderControlMotionPolicy.ts'));
  const replaceState = await import('../entry/src/main/ets/features/reading/presentation/ReaderControlReplaceState.ts');
  const { ts, options } = installedEtsCompiler();
  const minimumSource = readFileSync(ui('ReaderControlMinimumMeasurement.ets'), 'utf8');
  const minimumTree = ts.createSourceFile('ReaderControlMinimumMeasurement.ets', minimumSource,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const productionFunction = (name, dependencies = {}) => {
    const declaration = minimumTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(declaration, 'actual minimum policy ' + name);
    return pureModuleProbe(declaration.getText(minimumTree), 'ReaderControlMinimumMeasurement.ets', dependencies, [name])[name];
  };
  const factsGeometryKey = productionFunction('readerControlModuleFactsGeometryKey');
  const factsDisplayEqual = productionFunction('readerControlModuleFactsDisplayEqual', {
    readerControlModuleFactsGeometryKey: factsGeometryKey,
  });
  const methods = [
    'controlSession', 'controlReplaceState', 'controlNavigationIntent', 'controlMinimumReady',
    'replacePanelGeneration', 'controlReplacePreparedIdentity',
    'openQuickReplace', 'requestControlReplacePage', 'openReplaceRecovery', 'prepareControlReplacePage',
    'setControlPage', 'requestControlSession', 'cancelControlNavigationIntent', 'onControlInputActivity',
    'requestExit',
    'controlMinimumIdentity', 'controlMinimumCommittedIdentity', 'activeControlNavigationIntent',
    'controlMinimumRequestLocation', 'controlMinimumOwnerKey', 'controlMinimumEnvironmentKey',
    'controlMinimumCurrent', 'bindControlMinimum', 'scheduleControlMinimum', 'admitControlMinimum',
    'adoptControlDisplayFacts', 'controlLayoutGeometryKey', 'prepareControlPage',
    'onControlSessionChanged', 'admitSessionControlClosing', 'controlPage', 'controlVisible', 'controlTiming',
    'openReaderControl', 'hideControl', 'controlReplaceCurrent', 'readerReplaceRuntimeCurrent',
    'reloadControlReplace', 'projectReaderReplaceWriteFacts',
  ];
  const makeHost = (mutate = text => text) => {
    const properties = createArkUIPropertyRuntimeProbe();
    const metrics = { ...window.createDefaultReaderWindowMetrics(), revision: 1,
      windowRect: { left: 0, top: 0, width: 390, height: 844 } };
    const runtime = {};
    const frames = [];
    const reads = [];
    const profileMap = new Map();
    let viewportWidth = 390;
    const dependencies = {
      ...properties.sdk, ...session, ...hostSession, ...geometry, ...receiptPolicy,
      ...timing, ...motionPolicy, ...replaceState,
      ReaderRuntimeOwner: { current: () => runtime },
      ReaderWindowCoordinator: { metrics: () => metrics },
      ReaderUIFrameCallback: class { constructor(onFrame) { this.onFrame = onFrame; } },
      readerControlModuleFactsGeometryKey: factsGeometryKey,
      readerControlModuleFactsDisplayEqual: factsDisplayEqual,
      readerControlModuleFactsMatch: productionFunction('readerControlModuleFactsMatch'),
      readerControlModuleProfileMatches: productionFunction('readerControlModuleProfileMatches'),
      readerControlMeasuredProfileGeometryKey: productionFunction('readerControlMeasuredProfileGeometryKey'),
      readerControlKeyboardVisible: () => false,
      hideReaderControlKeyboard: () => { throw Error('no keyboard in this exact case'); },
      cancelReaderRapidPageTurn: state => state,
    };
    const probe = createReaderBuilderProbe(mutate(source), methods, dependencies, properties.hooks);
    const owner = probe.owner;
    let readResult = [];
    const mutationFact = { busy: false, blocked: false, confirmation: 'confirmed', canRetryOriginal: false };
    Object.assign(owner, {
      sourceId: 'source', bookId: 'book', bookTitle: 'Book', lifecycleToken: 1, mounted: true,
      exitRequested: false, appForeground: true, windowChromeActive: true, windowChromeOverlayActive: false,
      interactionBlocked: false, controlObscured: false, controlOpenRevision: 1, expandedLayout: false,
      controlModuleVisitRevision: 1, controlMinimumRevision: 0, controlMinimumGeneration: 0,
      controlNavigationGeneration: 0, observedControlModule: 'home', observedControlPage: 'home',
      observedControlCloseRevision: 0, reduceMotion: false, controlMinimumCandidates: [],
      controlMinimumCommittedFactsKey: '', controlMinimumProviderFactsKey: '',
      replaceRuntime: runtime, rulesMutationOwner: { snapshot: () => mutationFact },
      replaceRecovery: { message: '', visible: false, canRetry: false, generation: 1 },
      replaceRecoveryOperationId: undefined, quickSearchPublication: { retirePresentation: () => false, cancel() {} },
      quickSearchRevision: 0, sessionControlClosing: false, rapidPageTurnState: {},
      effectiveViewportWidth: () => viewportWidth, effectiveViewportHeight: () => 844,
      isSessionActive: token => owner.mounted && !owner.exitRequested && token === owner.lifecycleToken,
      isControlInputEnabled: () => owner.mounted && !owner.exitRequested,
      isReaderPageInteractionEnabled: () => true, pageTurnOwnsReaderInput: () => false,
      pageTurnInputPhase: () => 'idle',
      invalidateControlBackdrop() {}, applyWindowPolicyForChromeOwner() {},
      suspendAdjacentMeasurement() {}, dismissControlTemporaryLayers() {}, drainPageTurnPreparationQueue() {},
      retireReaderRecovery() {}, loadContentMetricsIfNeeded: async () => {}, refreshReaderBrightness() {},
      readerRecoveryRequestCurrent: () => false,
      initializeTtsSession: async () => {}, loadChineseConversionMode: async () => {}, loadReaderSettingsSnapshot: async () => {},
      publishQuickSearchState() {}, errorMessage: error => error.message,
      getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
      replaceGateway: {
        recoverMutation: async current => { assert.equal(current(), true); },
        loadRules: async current => {
          assert.equal(current(), true);
          reads.push({ identity: owner.controlMinimumCommittedIdentity(), receiptIdentity: owner.controlPresentationReceipt?.identity,
            ready: owner.controlMinimumReady, page: owner.controlPage() });
          return await readResult;
        },
      },
    });
    const home = session.createReaderControlSessionState();
    home.location = { level: 'home', module: 'directory', directoryTab: 'directory', form: 'quick' };
    owner.controlSession = home;
    owner.latestControlVisualSession = session.copyReaderControlSessionState(home);
    const bind = () => {
      const identity = owner.controlMinimumIdentity();
      const location = owner.controlMinimumRequestLocation();
      const module = location.level === 'secondary' ? location.module : 'home';
      const facts = module === 'home' ? { module, home: { chapterTitle: '', totalChapters: 1 } } :
        module === 'replace' ? { module, replace: { readViewState: () => owner.controlReplaceState, ruleCount: 0 } } :
          { module, tts: { readViewState: () => ({ status: 'idle' }), error: '', seek: false } };
      owner.bindControlMinimum(identity, (widths, key) => {
        const minimum = { module, quick: { heightVp: 190, minWidthVp: 100, fits: true },
          full: { heightVp: 190, minWidthVp: 100, fits: true } };
        const chrome = { topBarVisible: true, topBarHeightVp: 54, quickReserveVp: 140, fullReserveVp: 70,
          navigationHeightVp: 80, headerHeightVp: 30, brightnessAutoHeightVp: 28, brightnessAutoWidthVp: 28 };
        const profile = { identity, module, widths, moduleFacts: facts,
          moduleData: module === 'home' ? undefined : { module, [module]: { quick: { height: 190 }, full: { height: 190 } } },
          quick: { minimumHeight: 190 }, full: { minimumHeight: 190 } };
        profileMap.set(key, profile);
        return { key, widths, minimum, chrome, sharedShell: { minimum: { ...minimum, module: 'home' }, chrome } };
      }, key => profileMap.get(key), facts, module);
    };
    const flush = () => {
      let count = 0;
      while (frames.length) { assert.ok(++count < 20); frames.shift().onFrame(0); }
      properties.flush();
    };
    const settleReads = async () => { for (let turn = 0; turn < 6; turn++) await Promise.resolve(); };
    return { owner, reads, frames, bind, flush, settleReads, mutationFact, metrics,
      viewportWidth: value => { viewportWidth = value; metrics.windowRect.width = value; },
      readResult: value => { readResult = value; }, properties };
  };
  const prepareHome = host => { host.bind(); host.flush(); assert.ok(host.owner.controlPresentationReceipt); };
  const commitReplace = host => { host.bind(); host.flush(); };
  const verifyCurrent = async (mutate = text => text) => {
    const host = makeHost(mutate);
    prepareHome(host);
    host.owner.openQuickReplace();
    await host.settleReads();
    assert.equal(host.reads.length, 0, 'request has not committed Replace');
    assert.equal(host.owner.controlPage(), 'home');
    assert.equal(host.owner.activeControlNavigationIntent().target.module, 'replace');
    commitReplace(host);
    await host.settleReads();
    assert.equal(host.reads.length, 1, 'successful complete commit starts one canonical read');
    assert.equal(host.reads[0].identity, host.reads[0].receiptIdentity);
    assert.equal(host.reads[0].ready, true);
    assert.equal(host.owner.controlReplaceState.status, 'ready');
    host.owner.prepareControlPage('quickReplace');
    host.owner.prepareControlPage('quickReplace');
    await host.settleReads();
    assert.equal(host.reads.length, 1, 'repeated preparation of the same opening is idempotent');
    return host;
  };
  for (const id of selected) {
    const host = await verifyCurrent();
    const committedIdentity = host.owner.controlMinimumCommittedIdentity();
    host.bind(); host.flush(); await host.settleReads();
    assert.equal(host.reads.length, 1, 'metadata-only re-admission does not restart the opening');
    host.metrics.systemFontScale = 2;
    host.bind(); host.flush(); await host.settleReads();
    assert.equal(host.reads.length, 1, 'font-scale geometry re-admission does not restart the opening');
    host.viewportWidth(320);
    host.bind(); host.flush(); await host.settleReads();
    assert.equal(host.reads.length, 1, 'width geometry re-admission does not restart the opening');
    assert.equal(host.owner.controlMinimumCommittedIdentity(), committedIdentity);
    for (const cancel of [
      item => item.owner.requestExit(),
      item => item.owner.onControlInputActivity(),
      item => item.owner.setControlPage('moduleTts'),
      item => { item.owner.bookId = 'successor-book'; },
      item => { item.owner.mounted = false; item.owner.lifecycleToken++; },
    ]) {
      const pending = makeHost(); prepareHome(pending);
      pending.owner.openQuickReplace(); pending.bind();
      cancel(pending); pending.flush(); await pending.settleReads();
      assert.equal(pending.reads.length, 0, 'retired intent cannot start a read');
    }
    // An already-started old response cannot admit rules into a successor opening.
    let resolveOld;
    const delayed = makeHost(); prepareHome(delayed);
    delayed.readResult(new Promise(resolve => { resolveOld = resolve; }));
    delayed.owner.openQuickReplace(); commitReplace(delayed); await delayed.settleReads();
    assert.equal(delayed.reads.length, 1);
    delayed.owner.bookId = 'successor-book';
    resolveOld([{ id: 99, name: 'old response' }]); await delayed.settleReads();
    assert.equal(delayed.owner.controlReplaceState.rules.length, 0);
    // Same entity close/reopen changes the existing opening/generation owner.
    host.owner.hideControl();
    host.owner.controlSession = session.advanceReaderControlSession(host.owner.controlSession, 10000,
      host.owner.controlSession.epoch);
    assert.equal(host.owner.controlVisible(), false);
    host.owner.openReaderControl();
    host.owner.openQuickReplace(); commitReplace(host); await host.settleReads();
    assert.equal(host.reads.length, 2, 'same book reopening starts a fresh read once');
    // Recovery enters from a genuinely hidden session at p0, without faking visibility.
    const recovery = makeHost();
    recovery.owner.controlSession = session.createReaderControlSessionState();
    recovery.owner.latestControlVisualSession = session.copyReaderControlSessionState(recovery.owner.controlSession);
    recovery.owner.replaceRecovery = { visible: true, generation: 5 };
    recovery.owner.openReplaceRecovery(5);
    assert.equal(session.sampleReaderControlSession(recovery.owner.controlSession).visibilityProgress, 0);
    await recovery.settleReads();
    assert.equal(recovery.reads.length, 0, 'p0 without complete profile cannot dispatch read');
    commitReplace(recovery); await recovery.settleReads();
    assert.equal(recovery.reads.length, 1);
    // Same-module recovery is a separate explicit entrance, not a repeated frame.
    recovery.owner.replaceRecovery = { visible: true, generation: 6 };
    recovery.owner.openReplaceRecovery(6);
    await recovery.settleReads();
    assert.equal(recovery.reads.length, 1, 'new opening waits for its own prepared receipt');
    commitReplace(recovery); await recovery.settleReads();
    assert.equal(recovery.reads.length, 2);
    const other = makeHost(); prepareHome(other);
    other.owner.setControlPage('moduleTts'); other.bind(); other.flush();
    other.owner.replaceRecovery = { visible: true, generation: 4 };
    other.owner.openReplaceRecovery(4); await other.settleReads();
    assert.equal(other.reads.length, 0);
    commitReplace(other); await other.settleReads();
    assert.equal(other.reads.length, 1, 'recovery can navigate from another committed module');
    const busy = makeHost(); prepareHome(busy);
    busy.owner.controlReplaceState = replaceState.createReaderControlReplaceState('source:book:1');
    busy.owner.controlReplaceState.mutationPending = true;
    busy.owner.openQuickReplace(); commitReplace(busy); await busy.settleReads();
    assert.equal(busy.reads.length, 0, 'original dispatched mutation remains single-flight');
    assert.equal(busy.owner.controlReplacePreparedIdentity, '', 'busy entry does not consume startup admission');
    busy.owner.controlReplaceState.mutationPending = false;
    busy.bind(); busy.flush(); await busy.settleReads();
    assert.equal(busy.reads.length, 1, 'actual same-geometry metadata admission resumes the deferred opening');
    busy.bind(); busy.flush(); await busy.settleReads();
    assert.equal(busy.reads.length, 1, 'later metadata frames retain the claimed opening');
    const imported = makeHost(); prepareHome(imported);
    imported.owner.controlReplaceState = replaceState.createReaderControlReplaceState('source:book:1');
    imported.owner.controlReplaceState.mutationPending = true;
    imported.owner.openQuickReplace(); commitReplace(imported); await imported.settleReads();
    imported.owner.controlReplaceState.mutationPending = false;
    await imported.owner.reloadControlReplace();
    imported.bind(); imported.flush(); await imported.settleReads();
    assert.equal(imported.reads.length, 1, 'existing canonical completion reload claims the pending opening before metadata');
    const oldImmediate = text => text.replace('this.setControlPage(\'quickReplace\');',
      "this.setControlPage('quickReplace'); void this.reloadControlReplace().catch((_error: Error): void => {});")
      .replace("} else if (page === 'quickReplace') {\n      this.prepareControlReplacePage();", "} else if (page === 'quickReplace') {")
      .replace("else if (this.controlPage() === 'quickReplace') this.prepareControlReplacePage();", '');
    await assert.rejects(() => verifyCurrent(oldImmediate), /successful complete commit/);
    await assert.rejects(() => verifyCurrent(text => text.replace(
      'if (preparedIdentity === this.controlReplacePreparedIdentity) return;', '')), /idempotent/);
    await assert.rejects(async () => {
      const unprepared = makeHost(text => text.replace(
        "if (!this.controlMinimumReady || this.controlPage() !== 'quickReplace'",
        "if (this.controlPage() !== 'quickReplace'"));
      unprepared.owner.controlSession = session.createReaderControlSessionState();
      unprepared.owner.latestControlVisualSession = session.copyReaderControlSessionState(unprepared.owner.controlSession);
      unprepared.owner.replaceRecovery = { visible: true, generation: 5 };
      unprepared.owner.openReplaceRecovery(5);
      await unprepared.settleReads();
      assert.equal(unprepared.reads.length, 0, 'unprepared hidden opening must wait for its complete commit');
    }, /unprepared hidden opening/);
    console.log(JSON.stringify({ kind: id, status: 'PASS', currentCommitReads: 1,
      retiredIntentCases: 5, sameEntityReopen: true, hiddenP0Recovery: true,
      sameModuleRecovery: true, otherModuleRecovery: true, busySingleFlight: true,
      busyReleaseActualReadmission: true, metadataFontWidthDeduplicated: true,
      existingCanonicalReloadDeduplicated: true,
      oldResponseRejected: true, immediateDedupAndUnpreparedNegatives: 3,
      boundary: 'Actual installed SDK State/Watch and current Host methods; finite profile and gateway I/O seams. Native and persistence NOT_RUN.' }));
    recordContractCasePass(id);
  }
}

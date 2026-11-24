import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'loading-motion': { description: 'Actual shared loading/busy SDK nodes follow accepted app motion/foreground facts and keep their current content/action state.', resources: [] },
  'source-tools-state-admission': { description: 'Actual SourceTools SDK status, batch texts and retry actions follow the current receipt, read generation and opening.', resources: [] },
  'transient-announcement': { description: 'Actual feedback registry, Toast lifecycle and platform adapter announce once for the active foreground generation and preserve state after platform rejection.', resources: [] },
  'removal-resize': { description: 'Actual removal-message SDK observer recomputes Scroll capacity after a height-only metrics publication without a Text Area event.', resources: [] },
  'group-native-fixture': { description: 'Actual DEBUG group fixture methods use memory-only receipts and guarded actions, retaining generation and retired-host fences.', resources: [] },
  'geometry-native-fixture': { description: 'Actual DEBUG geometry fixture keeps confirmation in the existing presentation lane, memory-only actions, checked admission and retired cleanup.', resources: [] },
};

for (const id of selectContractCases(cases)) {
  if (id === 'loading-motion') await loadingMotion();
  else if (id === 'source-tools-state-admission') await sourceToolsStateAdmission();
  else if (id === 'transient-announcement') await transientAnnouncement();
  else if (id === 'removal-resize') await removalResize();
  else if (id === 'group-native-fixture') await groupNativeFixture();
  else await geometryNativeFixture();
  recordContractCasePass(id);
}

async function loadingMotion() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync, readdirSync } = await import('node:fs');
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const compiler = installedEtsCompiler();
  const { ts } = compiler;
  const root = new URL('../entry/src/main/ets/', import.meta.url);
  const inventory = [];
  for (const relative of readdirSync(root, { recursive: true }).filter(name => name.endsWith('.ets'))) {
    const source = readFileSync(new URL(relative, root), 'utf8');
    if (!source.includes('LoadingProgress(')) continue;
    const tree = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, compiler.options);
    assert.deepEqual(tree.parseDiagnostics, []);
    const visit = node => {
      if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) &&
        ts.isIdentifier(node.expression) && node.expression.text === 'LoadingProgress') {
        let chain = node;
        const modifiers = [];
        while (ts.isPropertyAccessExpression(chain.parent) && chain.parent.expression === chain &&
          ts.isCallExpression(chain.parent.parent) && chain.parent.parent.expression === chain.parent) {
          chain = chain.parent.parent;
          modifiers.push(chain);
        }
        const active = modifiers.find(call => call.expression.name.text === 'enableLoading');
        assert.ok(active && active.arguments.length === 1, `${relative} declares native loading activity`);
        const expression = active.arguments[0].getText(tree);
        assert.match(expression, /reduceMotion|appReduceMotion|shouldAnimate/);
        assert.match(expression, /foreground|Foreground|active|readerPanelForeground|shouldAnimate/);
        inventory.push({ file: relative, line: tree.getLineAndCharacterOfPosition(node.getStart()).line + 1, expression });
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  assert.ok(inventory.length > 0);
  for (const variant of ['default', 'readingBookmark', 'inline']) {
    const sdk = boundedSurfaceSdk();
    const owner = new sdk.deps.ReaderPageState(undefined, {
      variant, loading: true, loadingActive: true, message: '正在读取书源', padded: false,
    });
    owner.initialRender();
    const spinner = () => sdk.nodes(owner).filter(node => node.type === 'LoadingProgress');
    assert.equal(spinner().length, 1);
    assert.equal(spinner()[0].enableLoading, true);
    const nativeId = spinner()[0].id;
    owner.appReduceMotion = true;
    sdk.properties.flush();
    assert.equal(spinner()[0].enableLoading, false, `${variant} follows accepted reduceMotion`);
    owner.appReduceMotion = false;
    owner.appForeground = false;
    sdk.properties.flush();
    assert.equal(spinner()[0].enableLoading, false, `${variant} stops in background`);
    owner.appForeground = true;
    sdk.properties.flush();
    assert.equal(spinner()[0].enableLoading, true);
    assert.equal(spinner()[0].id, nativeId, 'fact updates retain the current native spinner');
    assert.ok(sdk.nodes(owner).some(node => node.type === 'Text' && node.create === '正在读取书源'));
    owner.loadingActive = false;
    sdk.properties.flush();
    assert.equal(spinner()[0].enableLoading, false, 'the caller keeps its own activity fence');
  }
  const sdk = boundedSurfaceSdk();
  let retried = 0;
  const failed = new sdk.deps.ReaderPageState(undefined, {
    variant: 'inline', loading: false, message: '读取失败', actionLabel: '重试',
    actionGeneration: 4, onAction: generation => { assert.equal(generation, 4); retried++; },
  });
  failed.initialRender();
  const retry = sdk.walk(failed).find(child => child instanceof sdk.deps.ReaderRecoveryAction);
  assert.ok(retry, 'a non-loading inline request retains the ordinary shared action surface');
  sdk.nodes(retry).find(node => node.type === 'Button').onClick();
  assert.equal(retried, 1);
  let actions = 0;
  const action = new sdk.deps.ReaderRecoveryAction(undefined, {
    label: '核对', generation: 7, isBusy: true, onReconcile: () => actions++,
  });
  action.initialRender();
  const busySpinner = () => sdk.nodes(action).find(node => node.type === 'LoadingProgress');
  const busyLabel = () => sdk.nodes(action).find(node => node.type === 'Text' && node.create === '核对');
  assert.equal(busySpinner().enableLoading, true);
  assert.equal(busyLabel().opacity, 0);
  action.appReduceMotion = true;
  sdk.properties.flush();
  assert.equal(busySpinner().enableLoading, false);
  assert.equal(busyLabel().opacity, 1, 'a hidden native animation retains the disabled action label');
  action.appReduceMotion = false;
  action.appForeground = false;
  sdk.properties.flush();
  assert.equal(busySpinner().enableLoading, false);
  assert.equal(busyLabel().opacity, 1);
  const button = sdk.nodes(action).find(node => node.type === 'Button');
  assert.equal(button.enabled, false);
  button.onClick();
  assert.equal(actions, 0, 'stopping animation preserves busy action admission');

  const source = readFileSync(new URL('features/source/ui/SourceToolsPage.ets', root), 'utf8');
  for (const retained of [false, true]) {
    const runtime = boundedSurfaceSdk();
    const snapshot = { sources: retained ? [{ sourceId: 'memory-source' }] : [], busy: true,
      statusMessage: '正在读取书源', batchCheck: { phase: 'idle' } };
    const owner = runtime.consumer(source, ['appThemeScheme', 'reduceMotion', 'snapshot', 'statusCard', 'hasPendingRecovery',
      'hasDedicatedReadFailure', 'retryEmptyReadAction'],
      { EMPTY_SOURCE_TOOLS_SNAPSHOT: snapshot }, { snapshot, reduceMotion: false });
    owner.statusCard();
    const state = runtime.walk(owner).find(child => child instanceof runtime.deps.ReaderPageState);
    assert.ok(state, 'the actual tools producer uses the shared page state');
    assert.equal(state.variant, retained ? 'inline' : 'default');
    assert.equal(state.loading, true);
    const spinner = () => runtime.nodes(state).find(node => node.type === 'LoadingProgress');
    assert.equal(spinner().enableLoading, true);
    owner.reduceMotion = true;
    runtime.properties.flush();
    assert.equal(spinner().enableLoading, false, 'current parent preference updates the retained actual child');
    if (retained) {
      const row = runtime.nodes(state).find(node => node.type === 'Row');
      assert.deepEqual(row.create, { space: 10 });
      assert.equal(spinner().width, 32);
      assert.equal(spinner().height, 32);
      const text = runtime.nodes(state).find(node => node.type === 'Text');
      assert.equal(text.layoutWeight, 1);
      assert.equal(text.create, snapshot.statusMessage);
    }
  }
  console.log(JSON.stringify({ nativeLoadingInventory: inventory,
    scope: 'All native constructor gates inspected through actual ETS AST. Shared native properties and current SourceTools producer updates executed with installed SDK. Native timing, pixels and other full page assembly are separate.' }));
}

async function sourceToolsStateAdmission() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const facts = await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
  const { projectOperationFacts } = facts;
  const { compile } = await import('./lib/rules-mutation-durable-probe.mjs');
  const projectPersistedReceipt = compile('app/ReaderPersistedReceiptProjection.ts', 'projectPersistedReceipt', facts, true);
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
  const source = readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceToolsPage.ets', import.meta.url), 'utf8');
  const available = boundedMembers(source);
  const empty = { sources: [], busy: false, batchCheck: { phase: 'idle' },
    readFacts: projectOperationFacts({ phase: 'succeeded', value: [], generation: 5 }) };
  const failed = generation => ({ ...empty,
    readFacts: projectOperationFacts({ phase: 'failed', canRetry: true, generation }) });
  const attempts = [];
  const makeStatus = snapshot => {
    const sdk = boundedSurfaceSdk();
    const requested = ['appThemeScheme', 'reduceMotion', 'appForeground', 'mounted', 'temporaryBackIdentity',
      'isOpeningCurrent', 'isInputAllowed', 'snapshot', 'onReconcile', 'statusCard', 'toolsOpeningIsCurrent',
      'toolsInputIsCurrent', 'hasPendingRecovery', 'hasDedicatedReadFailure', 'showsInlineRecovery',
      'retryEmptyReadAction', 'recovery'];
    const owner = sdk.consumer(source, requested.filter(name => available.includes(name)), {
      EMPTY_SOURCE_TOOLS_SNAPSHOT: empty, AppStorage: { get: () => true }, readerRecoveryView,
    }, { snapshot, onReconcile: generation => attempts.push(generation) });
    // The focused status sub-tree does not mount the catalog projection watched by the full page.
    owner.syncListDataSources = () => {};
    owner.showTransientFeedback = () => {};
    owner.mounted = true;
    owner.temporaryBackIdentity = 'tools:1';
    owner.statusCard();
    const state = sdk.walk(owner).find(child => child instanceof sdk.deps.ReaderPageState);
    const retry = sdk.nodes(owner).find(node => node.type === 'Button' && node.onClick)?.onClick;
    return { owner, state, retry };
  };

  const unknown = makeStatus({ ...empty, receipt: projectPersistedReceipt({
    confirmation: 'unknown', readback: 'failed', canRetry: true, generation: 6 }) });
  const stale = makeStatus(failed(7));
  assert.ok(stale.retry, 'failed empty read has an actual native retry');
  stale.owner.snapshot = failed(8);
  stale.retry();
  const current = makeStatus(failed(8));
  assert.ok(current.retry, 'current failure has an actual native retry');
  current.retry();
  const retired = makeStatus(failed(9));
  retired.owner.temporaryBackIdentity = 'tools:2';
  retired.retry();
  const succeeded = makeStatus(empty);

  const batchText = phase => {
    const controls = foundationControls();
    const sdk = boundedSurfaceSdk({ properties: controls.properties });
    const snapshot = { ...empty, batchCheck: { phase, total: 1, completed: 0,
      currentSourceName: '', passed: 0, failed: 0, errors: 0, results: [] } };
    const owner = createReaderBuilderProbe(source, ['snapshot', 'appThemeScheme', 'batchCheckCard',
      'batchCheckPercent', 'batchCheckPhaseLabel', 'batchCounter'], {
        ...sdk.deps, ...controls.dependencies, EMPTY_SOURCE_TOOLS_SNAPSHOT: empty,
      }, { ...sdk.hooks, childSources: { ...sdk.childSources, ...controls.hooks.childSources },
        initialParams: { snapshot } }).owner;
    owner.batchCheckCard();
    return sdk.nodes(owner).filter(node => node.type === 'Text').map(node => node.create);
  };
  const waiting = '每个书源完成后，结果会立即出现在这里。';
  const running = batchText('running');
  const stopped = batchText('stopped');
  const observation = {
    unknownReadTitle: unknown.state?.title ?? null,
    currentReadTitle: current.state.title,
    currentActionGeneration: current.state.actionGeneration,
    confirmedEmpty: succeeded.state.title,
    attempts,
    readFailureDuplicatesInline: current.owner.showsInlineRecovery?.() ?? current.owner.recovery().canRetry,
    runningHint: running.includes(waiting),
    stoppedHint: stopped.includes(waiting),
    stoppedState: stopped.includes('已停止'),
  };
  console.log(JSON.stringify(observation));
  assert.deepEqual(observation, {
    unknownReadTitle: null, currentReadTitle: '书源读取失败', currentActionGeneration: 8,
    confirmedEmpty: '暂无书源', attempts: [8], readFailureDuplicatesInline: false,
    runningHint: true, stoppedHint: false, stoppedState: true,
  });
}

async function geometryNativeFixture() {
  const { default: assert } = await import('node:assert/strict');
  const { BookRemovalDialogPresentation } = await import('../entry/src/main/ets/features/bookshelf/presentation/BookRemovalDialogPresentation.ts');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const file = new URL('../entry/src/main/ets/pages/ReaderFrameworkGeometryStructureFixture.ets', import.meta.url);
  for (const [debug, mode, fontsReady, allowed] of [[true, 'debug', true, true], [false, 'debug', true, false],
    [true, 'release', true, false], [true, 'debug', false, false]]) {
    const metrics = { windowRect: { width: 366, height: 800 }, keyboardInsets: { bottom: 0 }, systemFontScale: 1 };
    const bridges = [], messages = [], events = [];
    let hides = 0;
    const Fixture = selectedProductionMethods(file, 'ReaderFrameworkGeometryStructureFixture',
      ['aboutToAppear', 'aboutToDisappear', 'current', 'back', 'metricsChanged', 'record', 'openRemoval'], {
        DEBUG: debug, BUILD_MODE_NAME: mode, readerWindowMetrics: () => metrics,
        inputMethod: { getController: () => ({ hideTextInput: () => { hides++; return Promise.resolve(); } }) },
        hilog: { info(_domain, _tag, _format, payload) { events.push(JSON.parse(payload)); } },
      });
    const removal = new BookRemovalDialogPresentation();
    removal.attach(message => { messages.push(message); return { open() {}, close: () => true }; });
    const page = Object.assign(new Fixture(), { fontsReady, removal, confirmations: 0,
      onTemporaryBackBridge: handler => bridges.push(handler) });
    page.aboutToAppear(); page.openRemoval();
    assert.equal(removal.isOpen(), allowed); assert.equal(messages.length, allowed ? 1 : 0);
    assert.equal(typeof bridges[0] === 'function', allowed);
    if (allowed) {
      assert(messages[0].endsWith('移除说明末尾。'));
      removal.confirm(); assert.equal(page.confirmations, 1); assert.equal(events.at(-1).kind, 'memory-confirm');
      page.openRemoval(); assert.equal(page.back(), true); assert.equal(removal.isOpen(), false);
      metrics.keyboardInsets.bottom = 200; assert.equal(page.back(), true); assert.equal(hides, 1);
      metrics.keyboardInsets.bottom = 0; assert.equal(page.back(), false);
      page.openRemoval();
    }
    page.aboutToDisappear(); removal.confirm(); page.openRemoval();
    assert.equal(removal.isOpen(), false); assert.equal(page.confirmations, allowed ? 1 : 0);
  }
}

async function groupNativeFixture() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { selectedProductionClasses, selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const app = new URL('../entry/src/main/ets/app/', import.meta.url);
  const facts = pureModuleProbe(readFileSync(new URL('ReaderOperationFacts.ts', app), 'utf8'), 'ReaderOperationFacts.ts', {},
    ['projectOperationFacts', 'projectCommitReadback']);
  const receipts = pureModuleProbe(readFileSync(new URL('ReaderPersistedReceiptProjection.ts', app), 'utf8'),
    'ReaderPersistedReceiptProjection.ts', facts, ['projectPersistedReceipt']);
  const recovery = pureModuleProbe(readFileSync(new URL('ReaderRecoveryProjection.ts', app), 'utf8'),
    'ReaderRecoveryProjection.ts', {}, ['readerRecoveryView']);
  const empty = { data: { groups: [], books: [], records: [], totalReadTime: 0, latestReadAt: 0 }, busy: false };
  const base = selectedProductionClasses(new URL('../entry/src/main/ets/features/bookshelf/presentation/BookshelfGroupPresentation.ets', import.meta.url),
    ['BookshelfGroupPresentation'], { ...recovery, EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT: empty,
      BookshelfHost: class { constructor() { throw Error('fixture cannot attach business Host'); } } });
  const file = new URL('../entry/src/main/ets/pages/ReaderGroupRecoveryStructureFixture.ets', import.meta.url);
  const source = readFileSync(file, 'utf8');
  const { ReaderGroupFixturePresentation: Presentation } = pureModuleProbe(source.slice(0, source.indexOf('@Component')),
    'ReaderGroupFixturePresentation.ets', { ...facts, ...receipts, ...base, Observed: value => value }, ['ReaderGroupFixturePresentation']);
  const actions = [], presentation = new Presentation();
  let current = true;
  presentation.fixtureCurrent = () => current;
  presentation.onFixtureAction = kind => actions.push(kind);
  presentation.prepare('first', 1);
  assert.equal(presentation.book.sourceId, 'fixture-group.example.invalid');
  assert.equal(presentation.recovery(1).visible, true);
  assert(presentation.recovery(1).message.endsWith('分组长文案末尾。'));
  assert.equal(presentation.recovery(0).visible, false);
  assert.equal(presentation.canContinue(1), true);
  presentation.reconcile('stale', 1); presentation.reconcile('first', 0);
  presentation.snapshot.busy = true; presentation.reconcile('first', 1); presentation.dismiss('first');
  assert.deepEqual(actions, []);
  presentation.snapshot.busy = false;
  presentation.reconcile('first', 1); presentation.reconcile('first', 1, true);
  assert.deepEqual(actions, ['reconcile', 'continue']);
  const focus = presentation.captureFocusReturn('first');
  presentation.dismiss('first'); assert.equal(focus.isCurrent(), true);
  presentation.prepare('second', 2); presentation.dismiss('second'); assert.equal(focus.isCurrent(), false);
  current = false; presentation.prepare('retired', 3); presentation.reconcile('second', 2);
  assert.equal(presentation.identity, ''); assert.equal(focus.isCurrent(), false);
  for (const [debug, mode, fontsReady, allowed] of [[true, 'debug', true, true], [false, 'debug', true, false],
    [true, 'release', true, false], [true, 'debug', false, false]]) {
    const Fixture = selectedProductionMethods(file, 'ReaderGroupRecoveryStructureFixture',
      ['aboutToAppear', 'aboutToDisappear', 'current', 'openSample', 'back', 'record'], {
        DEBUG: debug, BUILD_MODE_NAME: mode, hilog: { info() {} },
      });
    const bridges = [], page = Object.assign(new Fixture(), { fontsReady, presentation: new Presentation(), opening: 0,
      actionCount: 0, hostHeight: 180, actualHeight: 180, actualWidth: 320, bridgeIdentity: 'group-recovery-fixture',
      onTemporaryBackBridge: handler => bridges.push(handler) });
    page.aboutToAppear(); page.openSample(); assert.equal(page.presentation.book !== undefined, allowed);
    assert.equal(typeof bridges[0] === 'function', allowed);
    page.aboutToDisappear(); page.openSample(); assert.equal(page.presentation.book, undefined);
  }
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const compiler = installedEtsCompiler();
  const ids = compiler.require(compiler.root + '/lib/component_map.js').ID_ATTRS;
  const sdk = boundedSurfaceSdk();
  const componentSource = source.slice(source.indexOf('@Component'));
  const dialogSource = readFileSync(new URL('../entry/src/main/ets/features/bookshelf/ui/BookshelfGroupDialog.ets', import.meta.url), 'utf8');
  class DialogChild {
    constructor(owner, params, _storage, id) { this.owner = owner; this.params = params; this.id = id; }
    updateStateVars(params) { Object.assign(this.params, params); }
  }
  const controlLayout = sourceText => {
    const saved = new Map(ids); ids.clear();
    try {
      const { owner } = createReaderBuilderProbe(sourceText, boundedMembers(sourceText), {
        ...sdk.deps, DEBUG: true, BUILD_MODE_NAME: 'debug', ReaderGroupFixturePresentation: Presentation,
        BookshelfGroupDialog: DialogChild, FlexWrap: { Wrap: 'FlexWrap.Wrap' }, FlexAlign: { Center: 'FlexAlign.Center' },
        LengthMetrics: { vp: value => ({ value, unit: 'vp' }) }, hilog: { info() {} },
      }, { ...sdk.hooks, childSources: { ...sdk.childSources, BookshelfGroupDialog: dialogSource } });
      owner.fontsReady = true; owner.aboutToAppear(); owner.initialRender();
      return [...owner.nodes.values()];
    } finally {
      ids.clear(); for (const [key, value] of saved) ids.set(key, value);
    }
  };
  const assertWrapping = sourceText => {
    const lane = controlLayout(sourceText).find(node => node.type === 'Flex');
    assert.ok(lane, 'diagnostic controls retain a wrapping native layout');
    assert.equal(lane.create.wrap, 'FlexWrap.Wrap'); assert.equal(lane.width, '100%');
    assert.equal(lane.height, undefined, 'font growth can add a control line before the measured group host');
  };
  assertWrapping(componentSource);
  const priorRow = componentSource.replace(/Flex\(\{ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Center,\s*space: \{ main: LengthMetrics.vp\(8\), cross: LengthMetrics.vp\(8\) \} \}\)/,
    'Row({ space: 8 })');
  assert.notEqual(priorRow, componentSource);
  assert.throws(() => assertWrapping(priorRow), /wrapping native layout/);
}

async function transientAnnouncement() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const base = new URL('../entry/src/main/ets/ui/feedback/', import.meta.url);
  const state = new Map(), events = [], warnings = [], timers = new Map();
  let nextTimer = 0, reject = false;
  const AppStorage = { get: key => state.get(key), setOrCreate: (key, value) => state.set(key, value) };
  state.set('readerAppForeground', true);
  const feedback = pureModuleProbe(readFileSync(new URL('ReaderTransientFeedback.ts', base), 'utf8'), 'ReaderTransientFeedback.ts',
    { AppStorage }, ['ReaderTransientFeedback', 'createReaderTransientToastState', 'registerReaderTransientHost', 'unregisterReaderTransientHost',
      'claimReaderTransientAnnouncement', 'retireReaderTransientToast', 'READER_TRANSIENT_TOAST_STORAGE_KEY', 'READER_TRANSIENT_HOST_STORAGE_KEY']);
  const adapter = pureModuleProbe(readFileSync(new URL('ReaderTransientAnnouncement.ets', base), 'utf8'), 'ReaderTransientAnnouncement.ets',
    { ...feedback, accessibility: { sendAccessibilityEvent(event) { events.push(event); return reject ? Promise.reject(Error('platform rejected')) : Promise.resolve(); } },
      hilog: { warn: (...args) => warnings.push(args) } }, ['announceReaderTransientToast']);
  const motion = [];
  const context = { getHostContext: () => ({ applicationInfo: { name: 'io.reader.minliny' } }),
    animateTo: (params, action) => { motion.push([params.duration, root.toastOffsetY]); action(); },
    getFocusController: () => { throw Error('announcement must preserve focus'); } };
  const Host = selectedProductionMethods(new URL('ReaderTransientToast.ets', base), 'ReaderTransientToast',
    ['aboutToAppear', 'aboutToDisappear', 'toastChanged', 'foregroundChanged', 'syncToast', 'dismiss', 'clearDismissTimer'],
    { ...feedback, ...adapter, AppStorage, readerReduceMotionFromStorage: () => true, readerMotionAnimateParam: () => ({ duration: 220 }),
      readerMotionReducedFadeParam: () => ({ duration: 120 }),
      setTimeout: action => { const id = ++nextTimer; timers.set(id, action); return id; }, clearTimeout: id => timers.delete(id) });
  const host = priority => Object.assign(new Host(), { priority, hostId: -1, activeHost: 0, foreground: true, displayed: false,
    handledGeneration: -1, dismissTimer: -1, getUIContext: () => context, toast: feedback.createReaderTransientToastState() });
  const synchronize = actor => {
    actor.toast = state.get(feedback.READER_TRANSIENT_TOAST_STORAGE_KEY) ?? feedback.createReaderTransientToastState();
    actor.activeHost = state.get(feedback.READER_TRANSIENT_HOST_STORAGE_KEY) ?? 0;
    actor.syncToast();
  };
  let generation = 0;
  const publish = (message = '已保存', title = '') => {
    const value = { ...feedback.createReaderTransientToastState(), visible: true, generation: ++generation, message, title, duration: 2000 };
    state.set(feedback.READER_TRANSIENT_TOAST_STORAGE_KEY, value); return value;
  };
  const root = host(0); root.aboutToAppear();
  publish('已保存', '分组'); synchronize(root); synchronize(root);
  assert.deepEqual(motion,[ [120, 0] ],'reduced entry uses the shared fade and starts without displacement');
  assert.equal(events.length, 1); assert.equal(events[0].textAnnouncedForAccessibility, '分组。已保存');
  assert.equal(events[0].type, 'announceForAccessibilityNotInterrupt'); assert.equal(events[0].triggerAction, 'common');
  assert.equal(events[0].bundleName, 'io.reader.minliny');
  const oldTimer = [...timers.values()][0];
  publish('当前新反馈'); synchronize(root); oldTimer();
  assert.equal(events.length, 2); assert.equal(root.displayed, true);
  assert.equal(state.get(feedback.READER_TRANSIENT_TOAST_STORAGE_KEY).visible, true, 'old timeout cannot hide its replacement');
  const cover = host(10); cover.aboutToAppear(); synchronize(root); synchronize(cover);
  assert.equal(events.length, 2, 'host handoff retires the prior visible fact without repeating it');
  publish('弹层结果'); synchronize(root); assert.equal(events.length, 2, 'inactive root cannot announce');
  synchronize(cover); assert.equal(events.length, 3);
  assert.equal(feedback.claimReaderTransientAnnouncement(root.hostId, generation), undefined);
  assert.equal(feedback.claimReaderTransientAnnouncement(cover.hostId, generation), undefined, 'same generation is globally claimed once');
  publish('   '); synchronize(cover); assert.equal(events.length, 3, 'empty message has no event');
  state.set('readerAppForeground', false); cover.foreground = false;
  publish('后台结果'); synchronize(cover); assert.equal(events.length, 3, 'background host cannot announce');
  state.set('readerAppForeground', true); cover.foreground = true;
  reject = true; const failed = publish('平台拒绝场景'); synchronize(cover); const newer = publish('后继消息');
  await Promise.resolve(); await Promise.resolve();
  assert.equal(warnings.length, 1); assert.equal(state.get(feedback.READER_TRANSIENT_TOAST_STORAGE_KEY), newer,
    'late platform rejection cannot modify the current feedback');
  reject = false; synchronize(cover); assert.equal(events.length, 5);
  assert.equal(feedback.claimReaderTransientAnnouncement(cover.hostId, failed.generation), undefined);
  cover.aboutToDisappear(); synchronize(cover); assert.equal(events.length, 5, 'retired host cannot announce');
  publish('根宿主新结果'); synchronize(root); assert.equal(events.length, 6);
  root.foreground = false; state.set('readerAppForeground', false); root.foregroundChanged();
  assert.equal(root.displayed, false); assert.equal(timers.size, 0);
  root.aboutToDisappear();
}

async function removalResize() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const safe = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const metrics = safe.createDefaultReaderWindowMetrics(); metrics.windowRect.height = 600; metrics.systemFontScale = 1;
  const properties = createArkUIPropertyRuntimeProbe(), enums = name => new Proxy({}, { get: (_, key) => `${name}.${String(key)}` });
  const source = readFileSync(new URL('../entry/src/main/ets/features/bookshelf/ui/BookRemovalDialog.ets', import.meta.url), 'utf8');
  const owner = createReaderBuilderProbe(source, ['messageBody', 'messageMaxHeight', 'measuredMessageHeight', 'metricsRevision'], {
    ...properties.sdk, MESSAGE_BODY: readerTypographyRoles.MESSAGE_BODY, ReaderWindowCoordinator: { metrics: () => metrics },
    readerAppColor: () => '#111', Alignment: enums('Alignment'), BarState: enums('BarState'),
  }, properties.hooks).owner;
  Object.assign(owner, { message: '长书名与移除说明'.repeat(100), measuredMessageHeight: 1000, metricsRevision: 1 });
  owner.messageBody();
  const scroll = () => [...owner.nodes.values()].find(node => node.type === 'Scroll');
  assert.equal(scroll().height, 400);
  metrics.windowRect.height = 320; owner.metricsRevision += 1; properties.flush();
  assert.equal(scroll().height, 120, 'height-only publication updates the real Scroll without Text Area');
  metrics.windowRect.height = 700; owner.metricsRevision += 1; properties.flush();
  assert.equal(scroll().height, 500, 'restored window capacity reaches the same message document');
}

import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'transient-announcement': { description: 'Actual feedback registry, Toast lifecycle and platform adapter announce once for the active foreground generation and preserve state after platform rejection.', resources: [] },
  'removal-resize': { description: 'Actual removal-message SDK observer recomputes Scroll capacity after a height-only metrics publication without a Text Area event.', resources: [] },
  'group-native-fixture': { description: 'Actual DEBUG group fixture methods use memory-only receipts and guarded actions, retaining generation and retired-host fences.', resources: [] },
};

for (const id of selectContractCases(cases)) {
  if (id === 'transient-announcement') await transientAnnouncement();
  else if (id === 'removal-resize') await removalResize();
  else await groupNativeFixture();
  recordContractCasePass(id);
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
  const context = { getHostContext: () => ({ applicationInfo: { name: 'io.reader.minliny' } }),
    animateTo: (_params, action) => action(), getFocusController: () => { throw Error('announcement must preserve focus'); } };
  const Host = selectedProductionMethods(new URL('ReaderTransientToast.ets', base), 'ReaderTransientToast',
    ['aboutToAppear', 'aboutToDisappear', 'toastChanged', 'foregroundChanged', 'syncToast', 'dismiss', 'clearDismissTimer'],
    { ...feedback, ...adapter, AppStorage, readerReduceMotionFromStorage: () => true, readerMotionAnimateParam: () => ({ duration: 0 }),
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

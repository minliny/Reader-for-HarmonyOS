import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'reading-more-retry': 'Actual LRE change and Store failure expose existing More recovery, retain the SDK Notice/action through retry busy, then clear on original ACK.',
  'settings-theme-feedback': 'Actual Settings scene/theme selection separates precommit ordinary feedback from accepted-save recovery and exposes the bounded recovery retry.',
  'retired-ui-input': 'Captured recovery actions cannot first write after foreground, opening, owner or mount retirement; accepted writes remain original Store facts.',
  'latest-choice-ack': 'A newer ordinary choice supersedes displayed recovery identity; an older retry ACK cannot clear its fact, and old displayed actions cannot retry it.',
});

if (selected.length > 0) {
  const storeTypes = await import('../entry/src/main/ets/features/reading/application/ReaderAppearanceStore.ts');
  const appearance = await import('../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts');
  const selection = await import('../entry/src/main/ets/app/ReaderThemeSelection.ts');
  const registry = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const { readerControlHostInputEnabled } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts');
  const { runtimeOwnerIdentityProbe } = await import('./lib/reader-runtime-admission-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { selectedProductionComponentCallback } = await import('./lib/selected-production-methods.mjs');
  const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
  const boundary = 'Actual Store/State/Gateway/ThemeHost and selected production LRE/Settings/scene methods; installed SDK-lowered Builder/property/Notice/Action actors. Persistence ACKs, runtime instance, mounted/foreground/root eligibility, geometry and segmented input delivery are finite ports. SDK keyed removal is not simulated: completion asserts original facts and actual visibility producers. No native event delivery, Preferences filesystem durability, rendered pixels or native acceptance claim.';
  const hidden = () => ({ visible: false, message: '', canRetry: false, generation: 0 });
  const log = { warn() {}, error() {} };
  function actualClass(path, name, dependencies) {
    const source = read(path).replace(/^import[\s\S]*?;\n/gm, '');
    return new Function(...Object.keys(dependencies),
      stripTypeScriptTypes(source).replace(/^export /gm, '') + `;return ${name};`)(...Object.values(dependencies));
  }
  function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
  async function until(predicate, label) {
    for (let turn = 0; turn < 150; turn++) { if (predicate()) return; await Promise.resolve(); }
    assert.fail(label);
  }
  async function turns() { for (let turn = 0; turn < 30; turn++) await Promise.resolve(); }
  class CapturedSlot {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
    updateStateVars(params) { Object.assign(this.params, params); }
  }
  async function fixture() {
    const writes = [], storage = new Map();
    const store = new storeTypes.ReaderAppearanceStore({
      load: async () => appearance.createDefaultReaderAppearanceSnapshot(),
      save(snapshot) { const ack = deferred(); writes.push({ snapshot: appearance.copyReaderAppearanceSnapshot(snapshot), ack }); return ack.promise; },
    });
    const runtime = { closed: false, getAppearanceStore: () => store, getUIAbilityContext: () => ({}), waitForPredecessorClose: async () => {} };
    let currentRuntime = runtime;
    const Runtime = runtimeOwnerIdentityProbe(() => currentRuntime);
    const Host = actualClass('app/ReaderThemeHost.ts', 'ReaderThemeHost', {
      ...appearance, ...selection, ...registry, ...storeTypes, ReaderRuntimeOwner: Runtime,
      AppStorage: { setOrCreate: (key, value) => storage.set(key, value) },
      ReaderWindowChromeStyle: class {}, ReaderWindowCoordinator: { updateAppChromeStyle() {} },
    });
    const Gateway = actualClass('features/reading/application/ReaderAppearanceGateway.ts', 'ReaderAppearanceGateway', {
      ...appearance, ...storeTypes, ReaderRuntimeOwner: Runtime, ReaderThemeHost: Host,
      ReaderCustomFontHost: class {}, hilog: log,
    });
    await Host.install(runtime, 'day');
    const gateway = new Gateway(runtime);
    return { store, writes, storage, runtime, Runtime, Host, gateway,
      replaceOwner() { currentRuntime = { closed: false }; }, restoreOwner() { currentRuntime = runtime; } };
  }
  function flush(ui) { ui.sdk.properties.flush(); }
  function currentNotice(ui) {
    flush(ui);
    const generation = ui.owner.appearanceSaveRecovery.generation;
    const notice = ui.sdk.walk(ui.owner).findLast(child => child instanceof ui.sdk.deps.ReaderRecoveryNotice &&
      child.tag === '外观设置' && child.view.generation === generation && child.view.visible);
    assert.ok(notice, 'actual production projection mounts the current shared appearance Notice');
    return notice;
  }
  function retryButton(ui, notice = currentNotice(ui)) {
    const action = ui.sdk.walk(notice).findLast(child => child instanceof ui.sdk.deps.ReaderRecoveryAction && child.label === '重试保存');
    assert.ok(action, 'actual shared RecoveryAction exists');
    const button = ui.sdk.nodes(action).findLast(node => node.type === 'Button');
    assert.ok(button?.onClick, 'actual SDK-emitted native action callback exists');
    return button;
  }
  async function nextWrite(f, index) { await until(() => f.writes.length > index, `missing original write ${index + 1}`); return f.writes[index]; }
  async function rejectWrite(f, index) {
    const write = await nextWrite(f, index);
    write.ack.reject(new Error('finite original persistence ACK rejection'));
    await until(() => f.store.saveState().unconfirmed && !f.store.saveState().saving, 'original Store did not publish failed-save facts');
  }

  function reading(f) {
    const sdk = boundedSurfaceSdk();
    const source = read('features/reading/ui/LocalReadingExperience.ets');
    const names = ['appearanceSaveRecovery', 'appearanceSaveRecoveryBusy', 'appearanceSaveRevision',
      'appearanceSaveRecoveryIdentity', 'appearanceSaveUnsubscribe', 'readerRecoveryRequested', 'readerRecoveryRequestIdentity',
      'bindAppearanceSaveRecovery', 'refreshAppearanceSaveRecovery', 'updateAppearanceSaveRecovery', 'retryAppearanceSaveRecovery',
      'hasReaderRecoveryContent', 'readerOfflineRecoveryVisible', 'readerOfflinePending', 'readerBookmarkPending',
      'hasReaderPendingGroup', 'openReaderRecovery', 'readerRecoveryRequestCurrent', 'retireReaderRecovery',
      'readerRecoveryOverlayId', 'readerRecoveryInputCurrent', 'readerRecoveryContent', 'readerRecoveryItems',
      'isControlInputEnabled', 'readerInputIsCurrent', 'isMountedToken', 'isSessionActive',
      'commitAppearanceChange', 'observeAppearanceSave', 'showAppearanceFailure'];
    const owner = sdk.consumer(source, names, { ReaderRuntimeOwner: f.Runtime, ReaderThemeHost: f.Host,
      ReaderAppearanceCommit: storeTypes.ReaderAppearanceCommit, readerControlHostInputEnabled,
      prepareReaderFontFamily: async () => {}, readerAppearanceSnapshotFontFamily: () => 'finite-font-ready', hilog: log });
    let control = true, rootCurrent = true;
    const feedback = [];
    Object.assign(owner, { mounted: true, exitRequested: false, lifecycleToken: 7, sourceId: 'source', bookId: 'book',
      chapterSelectionToken: 3, replaceRuntime: f.runtime, appearanceGateway: f.gateway, appearanceMutationGeneration: 0,
      appForeground: true, windowChromeActive: true, interactionBlocked: false, controlObscured: false,
      inputCurrent: () => rootCurrent && f.Runtime.isCurrent(f.runtime), isReaderIdentityCurrent: () => rootCurrent,
      controlVisible: () => control, controlMotionVisible: () => false, hideControl: () => { control = false; },
      sourceSwitchPresentationVisible: false, viewportWidth: 360,
      readerRecoveryView: hidden(), readerSettingsRecovery: hidden(), ttsPreferencesRecovery: hidden(),
      ttsConfigurationRecovery: hidden(), replaceRecovery: hidden(),
      bookmarkRecovery: { bookmarks: hidden(), offline: hidden() }, readerPreferenceModule: () => '',
      controlLayout: () => ({ topBarWidth: 320 }), readerRecoveryViewportHeight: () => 240, readerRecoveryTop: () => 10,
      sameAppearanceFont: () => true, admitAppearanceSnapshot(snapshot) { this.acceptedAppearance = snapshot; },
      errorMessage: error => error.message, getUIContext: () => ({}),
      transientFeedback: { show: (_context, options, current) => { if (current()) feedback.push(options.message); } },
    });
    owner.bindAppearanceSaveRecovery(owner.lifecycleToken);
    const panel = createReaderBuilderProbe(read('features/reading/ui/ReaderControlPanel.ets'),
      ['setMoreMenuVisible', 'currentMoreMenuOwnerScope', 'dismissMoreMenu', 'performMoreAction', 'readerMoreActionEnabled', 'readerMoreActions'],
      { ReaderMenuActionView: sdk.deps.ReaderMenuActionView }).owner;
    Object.assign(panel, { runtimeMounted: true, inputEnabled: true, controlObscured: false, temporaryLayerActive: false,
      frame: () => ({ visibility: 1 }), sourceId: 'source', sourceBookId: 'book', controlOpenRevision: 1, runtimeLifecycle: 7,
      moreMenuVisible: false, moreMenuGeneration: 0, syncProgressInput() {}, onTemporaryLayerChange() {},
      onOpenRecovery: selectedProductionComponentCallback(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url),
        'ReaderControlPanel', 'onOpenRecovery', owner) });
    function openMore() {
      control = true;
      panel.recoveryAvailable = owner.hasReaderRecoveryContent();
      panel.recoveryIdentity = owner.readerRecoveryOverlayId();
      panel.setMoreMenuVisible(true);
      assert.ok(panel.readerMoreActions().some(action => action.id === 'recovery' && action.label === '待处理事项' && action.enabled));
      panel.performMoreAction('recovery', panel.moreMenuGeneration);
      assert.equal(owner.readerRecoveryInputCurrent(), true, 'actual existing More action opens the requested original recovery');
    }
    return { owner, sdk, feedback, panel, openMore, root(value) { rootCurrent = value; },
      change(fontSize) { owner.commitAppearanceChange(current => ({ ...current, fontSize })); },
      mountNotice() { owner.readerRecoveryContent(); return currentNotice(this); } };
  }

  function settings(f) {
    const sdk = boundedSurfaceSdk();
    const source = read('features/settings/ui/SettingsPage.ets');
    Object.assign(sdk.hooks.childSources, { SettingsShell: read('features/settings/ui/SettingsShell.ets'),
      ReaderSegmentedControl: read('ui/controls/ReaderSegmentedControl.ets'),
      ReaderMessagePreviewPage: read('features/settings/ui/ReaderMessagePreviewPage.ets') });
    const names = ['appearanceSaveRecovery', 'appearanceSaveRecoveryBusy', 'appearanceSaveRevision', 'appearanceSaveRecoveryIdentity',
      'appearanceSaveUnsubscribe', 'temporaryBackIdentity', 'appThemeControlGeneration', 'resetInFlight', 'openSelect',
      'aboutToAppear', 'aboutToDisappear', 'updateAppearanceSaveRecovery', 'onAppearanceSaveHostChanged', 'retryAppearanceSave',
      'hasPendingAppearanceSave', 'pendingFeedbackVisible', 'pendingFeedback', 'pendingFeedbackItems', 'capturedPendingAction',
      'settingsInputIsCurrent', 'settingsNavigationCurrent', 'appThemeControl', 'appThemeControlIdentity', 'appThemeControlIsCurrent',
      'selectAppTheme', 'themeIndex', 'pageSurface', 'aboutPageCurrent', 'developerPageCurrent', 'messagePreviewCurrent', 'retireSelection'];
    const owner = sdk.consumer(source, names, { ReaderRuntimeOwner: f.Runtime,
      ReaderAppearanceSaveUnconfirmedError: storeTypes.ReaderAppearanceSaveUnconfirmedError,
      registerReaderFonts() {}, settingsSelectionGeneration: 0, SEG_OPTIONS: ['跟随', '浅色', '深色'],
      SettingsShell: CapturedSlot, ReaderSegmentedControl: CapturedSlot,
      ReaderMessagePreviewPage: CapturedSlot }, {}, 'SettingsPage');
    const feedback = [];
    let opening = true;
    Object.assign(owner, { activeSection: 'general', navigationGeneration: 1, appForeground: true,
      developerPageId: '', aboutPageId: '', messagePreviewId: '', appThemeScheme: 'day',
      getUIContext: () => ({ getFont: () => ({}) }), syncSnapshotValues() {},
      operationFeedbackIdentity: () => '', cacheFeedbackIdentity: () => '', onTemporaryBackBridge() {},
      retireDeveloperPages() {}, nativeAlertOwner: { retire() {} },
      hasPendingSettings: () => false, hasPendingCleanup: () => false,
      transientFeedback: { show: (_context, options, current) => { if (current()) feedback.push(options.message); }, reset() {} },
    });
    const scene = createReaderBuilderProbe(read('app/composition/SettingsScenes.ets'), ['settings', 'inputIsCurrent'],
      { SettingsPage: CapturedSlot, ReaderThemeHost: f.Host }, { childSources: { SettingsPage: source } }).owner;
    Object.assign(scene, { route: 'settings', section: 'general', generation: 1,
      presentation: { snapshot: {}, operation: {}, isCurrent: () => opening },
      isInputAllowed: () => owner.appForeground && owner.mounted && f.Runtime.isCurrent(f.runtime) });
    scene.settings('scene-opening');
    const binding = [...scene.children.values()].find(child => child instanceof CapturedSlot).params;
    Object.assign(owner, { isOpeningCurrent: binding.isOpeningCurrent, isInputAllowed: binding.isInputAllowed,
      onSelectAppTheme: binding.onSelectAppTheme });
    owner.aboutToAppear();
    function control() {
      owner.appThemeMode = f.storage.get('readerAppThemeMode');
      owner.appThemeControl();
      return [...owner.children.values()].filter(child => child instanceof CapturedSlot && child.params.specId === 'app-theme-segment').at(-1).params;
    }
    function overlay() {
      owner.pageSurface(); flush({ owner, sdk });
      const shell = [...owner.children.values()].find(child => child instanceof CapturedSlot && 'boundedOverlayVisible' in child.params);
      assert.ok(shell, 'actual Settings page passes the bounded overlay slot to its shell');
      return shell;
    }
    return { owner, sdk, feedback, control, overlay, opening(value) { opening = value; },
      mountNotice() { const shell = overlay(); assert.equal(shell.params.boundedOverlayVisible, true); shell.params.boundedOverlayContent(); return currentNotice(this); } };
  }

  async function readingMoreRetry() {
    const f = await fixture(), ui = reading(f);
    ui.change(22); await rejectWrite(f, 0); await turns();
    assert.equal(ui.owner.appearanceSaveRecovery.visible, true);
    assert.equal(ui.owner.readerRecoveryInputCurrent(), false, 'failed Store fact does not automatically cover the reading body');
    assert.deepEqual(ui.feedback, [], 'accepted-save rejection is not ordinary failure Toast');
    ui.openMore();
    const notice = ui.mountNotice(), button = retryButton(ui, notice), generation = notice.view.generation;
    button.onClick(); await nextWrite(f, 1); flush(ui);
    assert.equal(currentNotice(ui), notice, 'same revision retains its real Notice actor during retry');
    assert.equal(notice.view.generation, generation);
    assert.equal(notice.busy, true); assert.equal(retryButton(ui, notice).enabled, false);
    button.onClick(); await turns(); assert.equal(f.writes.length, 2, 'retained busy action cannot dispatch twice');
    f.writes[1].ack.resolve(); await until(() => !ui.owner.appearanceSaveRecovery.visible, 'LRE did not clear on original latest ACK');
    assert.equal(ui.owner.hasReaderRecoveryContent(), false); assert.equal(ui.owner.readerRecoveryInputCurrent(), false);
    button.onClick(); await turns(); assert.equal(f.writes.length, 2);
    assert.equal(f.store.current().fontSize, 22); f.Host.detach();
  }
  async function settingsThemeFeedback() {
    const f = await fixture(), ui = settings(f);
    f.Host.setRecoveryBarrier(async () => { throw new Error('finite precommit restore barrier refusal'); });
    ui.control().onSelect(2); await until(() => ui.feedback.length === 1, 'precommit ordinary feedback missing');
    assert.equal(ui.feedback[0], '主题暂时无法修改，请重试'); assert.equal(f.writes.length, 0);
    assert.equal(ui.owner.hasPendingAppearanceSave(), false);
    f.Host.setRecoveryBarrier(async () => {});
    ui.control().onSelect(2); await rejectWrite(f, 0); await turns();
    assert.equal(f.store.current().appThemeMode, 'night');
    assert.equal(ui.control().selectedIndex, 2, 'accepted theme remains the actual Settings control projection');
    assert.equal(ui.feedback.length, 1, 'postcommit failure adds no Toast');
    const notice = ui.mountNotice(), button = retryButton(ui, notice);
    button.onClick(); await nextWrite(f, 1); flush(ui);
    assert.equal(currentNotice(ui), notice); assert.equal(notice.busy, true);
    assert.equal(retryButton(ui, notice).enabled, false);
    f.writes[1].ack.resolve(); await until(() => !ui.owner.hasPendingAppearanceSave(), 'Settings recovery did not clear');
    assert.equal(ui.owner.pendingFeedbackVisible(), false, 'actual boundedOverlayVisible producer clears on the ACK');
    assert.equal(ui.feedback.length, 1); f.Host.detach();
  }
  async function retiredUiInput() {
    for (const kind of ['reading', 'settings']) {
      for (const loss of ['foreground', 'opening', 'owner', 'unmount', kind === 'reading' ? 'chapter' : 'section']) {
        const f = await fixture(), ui = kind === 'reading' ? reading(f) : settings(f);
        if (kind === 'reading') ui.change(22); else ui.control().onSelect(2);
        await rejectWrite(f, 0); await turns();
        if (kind === 'reading') ui.openMore();
        const button = retryButton(ui, ui.mountNotice());
        assert.equal(f.store.saveState().canRetry, true, 'the original Store remains retryable before host retirement');
        if (loss === 'foreground') ui.owner.appForeground = false;
        if (loss === 'opening') { if (kind === 'reading') ui.root(false); else ui.opening(false); }
        if (loss === 'owner') f.replaceOwner();
        if (loss === 'unmount') { if (kind === 'settings') ui.owner.aboutToDisappear(); else ui.owner.mounted = false; }
        if (loss === 'chapter') ui.owner.chapterSelectionToken += 1;
        if (loss === 'section') ui.owner.activeSection = 'home';
        button.onClick(); await turns();
        assert.equal(f.writes.length, 1, `${kind}/${loss}: old displayed callback cannot first enqueue retry`);
        assert.equal(f.store.saveState().unconfirmed, true, 'view retirement cannot cancel or confirm original write facts');
        f.Host.detach();
      }
    }
  }
  async function latestChoiceAck() {
    const f = await fixture(), reader = reading(f), page = settings(f);
    reader.change(22); await rejectWrite(f, 0); await turns(); reader.openMore();
    const readerOld = retryButton(reader, reader.mountNotice()), pageOld = retryButton(page, page.mountNotice());
    readerOld.onClick(); await nextWrite(f, 1);
    page.control().onSelect(2); await until(() => f.store.current().appThemeMode === 'night', 'new ordinary Settings choice not accepted');
    assert.equal(f.writes.length, 2, 'new original write waits for old retry ACK');
    const latestRevision = f.store.currentRevision();
    f.writes[1].ack.resolve(); const latestWrite = await nextWrite(f, 2);
    assert.equal(latestWrite.snapshot.appThemeMode, 'night'); assert.equal(latestWrite.snapshot.fontSize, 22);
    assert.equal(reader.owner.appearanceSaveRecovery.visible, true, 'old ACK cannot clear current LRE recovery');
    assert.equal(page.owner.appearanceSaveRecovery.visible, true, 'old ACK cannot clear current Settings recovery');
    assert.equal(reader.owner.appearanceSaveRevision, latestRevision); assert.equal(page.owner.appearanceSaveRevision, latestRevision);
    latestWrite.ack.reject(new Error('finite newer original save rejection'));
    await until(() => f.store.saveState().canRetry, 'new original failure did not retire prior busy'); await turns();
    readerOld.onClick(); pageOld.onClick(); await turns();
    assert.equal(f.writes.length, 3, 'old displayed identities cannot retry the now-retryable newer revision');
    const fresh = retryButton(page, page.mountNotice()); fresh.onClick(); await nextWrite(f, 3);
    assert.deepEqual(f.writes[3].snapshot, f.store.current(), 'fresh UI action retries latest complete original snapshot');
    f.writes[3].ack.resolve(); await until(() => !reader.owner.appearanceSaveRecovery.visible && !page.owner.appearanceSaveRecovery.visible,
      'latest ACK did not clear both consumers of the same Store fact');
    assert.equal(f.writes.length, 4); assert.deepEqual(reader.feedback, []); assert.deepEqual(page.feedback, []); f.Host.detach();
  }
  const cases = { 'reading-more-retry': readingMoreRetry, 'settings-theme-feedback': settingsThemeFeedback,
    'retired-ui-input': retiredUiInput, 'latest-choice-ack': latestChoiceAck };
  for (const id of selected) { await cases[id](); console.log(JSON.stringify({ case: id, boundary })); recordContractCasePass(id); }
}

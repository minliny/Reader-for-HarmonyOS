import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'settings-frame': { description: 'Actual SettingsPage to both shells to StandardPage retains a live bounded recovery frame and ordinary page geometry.', resources: [] },
  'settings-compatibility': { description: 'SettingsShell legacy overlay API forwards nonzero inset values for Home and General while retaining its visibility guard.', resources: [] },
  'settings-actions': { description: 'The original settings and cleanup recovery callbacks retain current identities and immediately yield to active selection or retirement.', resources: [] },
  'preview-layers': { description: 'Runtime message preview notices use the bounded slot, while popup scenes preserve sample content and scroll and modal geometry stays locally live.', resources: [] },
});

if (selected.length > 0) {
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context); throw error; }
  } });
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
  const { projectPersistedReceipt } = await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
  const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
  const safe = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
  const paths = {
    page: 'features/settings/ui/SettingsPage.ets', shell: 'features/settings/ui/SettingsShell.ets',
    main: 'features/shell/MainTabShell.ets', preview: 'features/settings/ui/ReaderMessagePreviewPage.ets',
  };
  const sources = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, read(path)]));
  const syntax = createRequire(import.meta.url)(resolveEtsLoaderRoot() + '/lib/validate_ui_syntax.js');
  const { ts, options } = installedEtsCompiler();
  const gateway = read('features/settings/application/SettingsGateway.ts');
  const { createDefaultSettingsSnapshot } = pureModuleProbe(gateway, 'SettingsGateway.ts', {}, ['createDefaultSettingsSnapshot']);
  const { emptyReaderAppBuildInfo } = pureModuleProbe(read('platform/bundle/ReaderAppBuildInfo.ts'), 'ReaderAppBuildInfo.ts', {}, ['emptyReaderAppBuildInfo']);
  const receipt = generation => projectPersistedReceipt({ confirmation: 'unknown', readback: 'failed', generation, canRetry: true });
  class FeedbackPort { reset() {} show() { return true; } }
  class AlertPort { retire() {} }
  class ChromePort {
    constructor(owner, params, _storage, id) { Object.assign(this, params, { owner, params, id }); }
    updateStateVars(params) { Object.assign(this, params); Object.assign(this.params, params); }
    initialRender() {}
  }

  function registerShape(name, source) {
    const tree = ts.createSourceFile(name + '.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, []);
    const declaration = tree.statements.find(node => node.members && node.name?.getText(tree) === name);
    const properties = declaration.members.filter(ts.isPropertyDeclaration);
    const decorated = tag => new Set(properties.filter(member => ts.getAllDecorators(member).some(decorator =>
      (ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression).getText(tree) === tag))
      .map(member => member.name.getText(tree)));
    syntax.componentCollection.customComponents.add(name);
    syntax.propCollection.set(name, decorated('Prop'));
    syntax.builderParamObjectCollection.set(name, decorated('BuilderParam'));
  }

  function environment(mainSource = sources.main) {
    const metrics = safe.createDefaultReaderWindowMetrics();
    Object.assign(metrics.windowRect, { width: 366, height: 844 });
    metrics.systemInsets.top = 24; metrics.navigationInsets.bottom = 24;
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true, windowMetrics: () => metrics });
    const runtime = {};
    const timers = [];
    const deps = { ...actualReaderPageLayout(), ...safe, readerRecoveryView, createDefaultSettingsSnapshot,
      emptyReaderAppBuildInfo, ReaderTransientFeedback: FeedbackPort, ReaderNativeAlertOwner: AlertPort,
      ReaderRuntimeOwner: { current: () => runtime, isCurrent: token => token === runtime },
      ReaderWindowCoordinator: { metrics: () => metrics }, readerWindowMetrics: () => metrics,
      readerMainNavigationMode: () => 'bottom', readerMainRailLeading: () => 119,
      readerMainRailBottomInset: () => 24, publishReaderMainViewport() {}, registerReaderFonts() {},
      Edge: { Top: 'Edge.Top' },
      setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {} };
    for (const [name, path] of [['AppTopBar', 'ui/chrome/AppTopBar.ets'], ['PageBackBar', 'ui/chrome/PageBackBar.ets'],
      ['MainNavigationRail', 'features/shell/MainNavigationRail.ets'],
      ['ReaderBottomNavigation', 'app/navigation/ReaderBottomNavigation.ets'],
      ['ReaderFormRow', 'ui/controls/ReaderFormRow.ets'],
      ['ReaderToggle', 'ui/controls/ReaderToggle.ets'],
      ['ReaderSegmentedControl', 'ui/controls/ReaderSegmentedControl.ets'],
      ['ReaderMessagePreviewPage', paths.preview],
      ['SettingsSelectOverlay', 'features/settings/ui/SettingsSelectOverlay.ets']]) {
      const source = read(path); registerShape(name, source); sdk.hooks.childSources[name] = source; sdk.deps[name] = ChromePort;
    }
    const register = (name, source) => {
      registerShape(name, source); sdk.hooks.childSources[name] = source;
      sdk.deps[name] = createReaderBuilderProbe(source, boundedMembers(source), { ...sdk.deps, ...deps }, sdk.hooks).Component;
    };
    register('MainNavigationOverlay', read('features/shell/MainNavigationOverlay.ets'));
    register('MainTabShell', mainSource);
    sdk.deps.MainTabShell.prototype.bottomNavigation = function () {};
    register('SettingsShell', sources.shell);
    return { sdk, deps, metrics, runtime, timers };
  }

  const pageMethods = ['build', 'pageSurface', 'aboutPage', 'developerPage', 'settingsInputIsCurrent', 'settingsNavigationCurrent',
    'aboutPageCurrent', 'developerPageCurrent', 'messagePreviewCurrent', 'pendingFeedbackVisible', 'pendingFeedback',
    'pendingFeedbackItems', 'hasPendingSettings', 'hasPendingCleanup', 'recovery', 'recoveryActionIdentities', 'recoveryIdentityFor', 'capturedPendingAction',
    'recoveryActionKind', 'recoveryActionGeneration', 'recoveryActionCurrent', 'dispatchRecoveryAction', 'buildOverlay',
    'currentValue', 'selectOptions', 'setSelectValue', 'ownsSelection', 'commitSelection', 'dismissSelection', 'retireSelection',
    'selectionId', 'selectionField', 'languageValue', 'startupValue', 'animationValue', 'anchorRight', 'anchorBottom',
    'activeSection', 'operation', 'cacheCleanup', 'openSelect', 'aboutPageId', 'developerPageId', 'messagePreviewId',
    'temporaryBackIdentity', 'resetInFlight', 'originX', 'originY'];

  function settings(route = 'home', cleanup = false, mainSource = sources.main) {
    const env = environment(mainSource), { sdk, deps, runtime } = env;
    const props = { activeSection: route === 'general' || route === 'developer' ? 'general' : 'home', expandedLayout: false,
      operation: cleanup ? { action: 'load' } : { action: 'save', receipt: receipt(17), canRetryAccepted: true },
      cacheCleanup: cleanup ? { confirmation: 'unknown', canContinueOriginal: true, busy: false,
        operation: { generation: 23, canRetry: true, message: 'fixture pending cleanup' } } : undefined };
    const page = sdk.consumer(sources.page, pageMethods, deps, props);
    const calls = [];
    Object.assign(page, props, { mounted: true, themeOwner: runtime, temporaryBackIdentity: 'settings-current',
      aboutPageId: route === 'about' ? 'about-current' : '', developerPageId: route === 'developer' ? 'developer-current' : '',
      messagePreviewId: '', openSelect: '', resetInFlight: false, isOpeningCurrent: () => true,
      isInputAllowed: () => true, buildHome() {}, buildGeneral() {}, aboutPageHeader() {}, aboutPageContent() {},
      developerPageHeader() {}, developerPageContent() {}, onOperationChanged() {}, onCacheCleanupChanged() {},
      onReconcile: generation => calls.push(['settings-read', generation]),
      onRetryAccepted: generation => calls.push(['settings-continue', generation]),
      onReconcileCache: generation => calls.push(['cache-read', generation]),
      onContinueCache: generation => calls.push(['cache-continue', generation]) });
    page.initialRender(); sdk.properties.flush();
    const standard = sdk.walk(page).find(child => typeof child.recordMeasurement === 'function');
    assert.ok(standard, `${route} mounts actual StandardPage through its real shell chain`);
    return { ...env, page, owner: standard, calls };
  }

  function resize(model, width, height, header, footer) {
    const callback = [...model.owner.nodes.values()].find(node => node.onAreaChange)?.onAreaChange;
    assert.equal(typeof callback, 'function'); callback({}, { width, height });
    model.owner.recordMeasurement('standard:header', header, model.owner.measurementKey);
    model.owner.recordMeasurement('standard:footer', footer, model.owner.measurementKey);
    model.sdk.properties.flush();
  }
  const carrier = model => [...model.owner.nodes.values()].find(node => node.type === 'Scroll' && node.onTouch);

  function compatibilityForwarding() {
    for (const activeSection of ['home', 'general']) {
      const env = environment(), values = [];
      const shell = env.sdk.consumer(sources.shell, boundedMembers(sources.shell), env.deps, {
        activeSection, showOverlay: true, homeContent() {}, generalContent() {},
        overlayContent: top => values.push(top),
      });
      shell.initialRender(); env.sdk.properties.flush(); values.length = 0;
      const producer = activeSection === 'home' ? env.sdk.walk(shell).find(child => child.standardScroll === true) :
        env.sdk.walk(shell).find(child => typeof child.recordMeasurement === 'function');
      assert.ok(producer);
      const slot = activeSection === 'home' ? producer.scrollOverlayContent : producer.overlayContent;
      assert.equal(typeof slot, 'function'); slot(73); slot(131);
      assert.deepEqual(values, [73, 131], `${activeSection} retains the caller's nonzero inset values`);
      shell.showOverlay = false; slot(89);
      assert.deepEqual(values, [73, 131], `${activeSection} preserves the original visibility guard`);
    }
    const zeroForwarding = sources.shell.replace('this.overlayContent(contentStartInset);', 'this.overlayContent(0);');
    assert.notEqual(zeroForwarding, sources.shell);
    const env = environment(), values = [];
    const shell = env.sdk.consumer(zeroForwarding, ['pageOverlay', 'showOverlay'], env.deps, { showOverlay: true });
    shell.overlayContent = top => values.push(top); shell.pageOverlay(73);
    assert.deepEqual(values, [0], 'the former silent zero forwarding is observable');
  }

  const previewMethods = ['build', 'content', 'previewOverlay', 'noticePreview', 'noticeView', 'modalTop', 'admitted', 'owns',
    'noticeActive', 'pageActive', 'dialogActive', 'taskActive', 'select', 'begin', 'clearPreview', 'end', 'handleBack',
    'reconcileNotice', 'scene', 'generation', 'hostHeight', 'hostY', 'readerWindowMetricsRevision', 'previewEnabled', 'foreground'];
  function preview(code = sources.preview) {
    const env = environment(), calls = [];
    const page = env.sdk.consumer(code, previewMethods, env.deps, { previewEnabled: true });
    Object.assign(page, { mounted: true, previewEnabled: true, foreground: true, hostHeight: 844, hostY: 0,
      timer: -1, feedback: new FeedbackPort(), sampleSections() { calls.push('samples'); },
      header() {}, pagePreview() { calls.push('page-state'); }, dialogPreview() {}, taskPreview() {},
      scroller: { scrollEdge: () => calls.push('scroll') } });
    return { ...env, page, calls };
  }

  for (const id of selected) {
    let samples = 0;
    if (id === 'settings-frame' || id === 'settings-compatibility') compatibilityForwarding();
    if (id === 'settings-compatibility') samples = 2;
    if (id === 'settings-frame') {
      for (const route of ['home', 'general', 'about', 'developer']) {
        const model = settings(route);
        assert.equal(carrier(model), undefined, 'cold viewport has no zero-height input carrier');
        let original;
        for (const [width, height, header, footer] of [[366, 844, 58, 62], [320, 320, 116, 100], [760, 568, 174, 150]]) {
          resize(model, width, height, header, footer);
          const actual = carrier(model), geometry = model.owner.geometry;
          assert.ok(actual, route); original ??= actual; assert.equal(actual, original);
          assert.equal(actual.width, geometry.content.frame.width);
          assert.deepEqual(actual.margin, { left: geometry.content.frame.left, right: geometry.content.frame.right,
            top: geometry.content.startInset });
          assert.ok(actual.margin.top + actual.constraintSize.maxHeight <= geometry.footer.top);
          samples++;
        }
        const before = JSON.stringify(model.owner.geometry), key = model.owner.measurementKey;
        // Deliver actual parent/shell Prop updates. Native branch removal stays
        // outside this finite property scheduler and is not claimed here.
        model.page.openSelect = 'language'; model.sdk.properties.flush(owner => owner !== model.owner);
        assert.equal(model.owner.boundedOverlayVisible, false, 'active selector retires passive recovery');
        assert.equal(JSON.stringify(model.owner.geometry), before); assert.equal(model.owner.measurementKey, key);
        assert.equal(model.page.pendingFeedbackVisible(), false);
        model.page.openSelect = '';
        assert.equal(model.page.pendingFeedbackVisible(), true, 'closing selection restores the original owner eligibility');
      }
      const missingBridge = sources.main.replace('boundedOverlayVisible: this.boundedOverlayVisible,', 'boundedOverlayVisible: false,');
      assert.notEqual(missingBridge, sources.main);
      const oldHome = settings('home', false, missingBridge); resize(oldHome, 366, 844, 58, 62);
      assert.equal(carrier(oldHome), undefined, 'an omitted MainTab relay loses the actual home recovery');
    }
    if (id === 'settings-actions') {
      for (const cleanup of [false, true]) {
        const model = settings('general', cleanup); resize(model, 366, 844, 58, 0);
        const notice = model.sdk.walk(model.page).find(child => child.actionLabel === '核对'); assert.ok(notice);
        const reconcile = notice.onReconcile, continuation = notice.onSecondaryAction;
        reconcile(); continuation(); assert.equal(model.calls.length, 2);
        assert.deepEqual(model.calls, cleanup ? [['cache-read', 23], ['cache-continue', 23]] :
          [['settings-read', 17], ['settings-continue', 17]]);
        for (const [field, value] of [['openSelect', 'language'], ['resetInFlight', true], ['mounted', false]]) {
          const before = model.page[field]; model.page[field] = value; reconcile(); continuation();
          assert.equal(model.calls.length, 2, `${field} rejects queued recovery before native repaint`); model.page[field] = before;
        }
        model.page.isOpeningCurrent = () => false; reconcile(); continuation(); assert.equal(model.calls.length, 2);
        model.page.isOpeningCurrent = () => true; model.page.temporaryBackIdentity = 'successor';
        reconcile(); continuation(); assert.equal(model.calls.length, 2, 'old immutable tuple cannot borrow successor opening');
        samples++;
      }
    }
    if (id === 'preview-layers') {
      for (const scene of ['none', 'toast', 'notice', 'notice-long', 'dialog-normal', 'task-running']) {
        const model = preview(); model.page.scene = scene; model.page.content();
        assert.deepEqual(model.calls, ['samples'], `${scene} keeps original sample content`);
        assert.equal(model.sdk.walk(model.page).filter(child => child.label === '结束当前预览').length, 0);
        if (scene !== 'none' && scene !== 'toast') model.page.select(scene);
        assert.equal(model.calls.includes('scroll'), false, 'popup opening leaves underlying scroll position');
        samples++;
      }
      const state = preview(); state.page.select('page-failure'); assert.ok(state.calls.includes('scroll'));
      const oldScroll = sources.preview.replace('if (this.pageActive()) this.scroller.scrollEdge(Edge.Top);', 'this.scroller.scrollEdge(Edge.Top);');
      assert.notEqual(oldScroll, sources.preview); const old = preview(oldScroll); old.page.select('dialog-normal');
      assert.ok(old.calls.includes('scroll'), 'the old popup side effect is observable');
      const modal = preview(); modal.page.scene = 'dialog-normal'; modal.page.initialRender(); modal.sdk.properties.flush();
      const column = [...modal.page.nodes.values()].find(node => node.type === 'Column' && node.height === '100%');
      assert.ok(column); assert.equal(column.hitTestBehavior, 'HitTestMode.Default');
      const modalArea = [...modal.page.nodes.values()].find(node => node.onAreaChange)?.onAreaChange;
      assert.equal(typeof modalArea, 'function', 'actual preview build area callback owns modal bounds');
      for (const [safeTop, hostY, height] of [[24, 0, 844], [58, 10, 320], [80, 0, 40]]) {
        modal.metrics.systemInsets.top = safeTop;
        modalArea({}, { height, globalPosition: { y: hostY } }); modal.page.readerWindowMetricsRevision++;
        modal.sdk.properties.flush(); assert.equal(column.padding.top, Math.min(height, Math.max(0, safeTop - hostY)));
      }
      const notice = preview(); notice.page.select('notice-long'); notice.page.initialRender(); notice.sdk.properties.flush();
      const standard = notice.sdk.walk(notice.page).find(child => typeof child.recordMeasurement === 'function');
      assert.ok(standard); assert.equal(standard.boundedOverlayVisible, true);
      const noticeModel = { ...notice, owner: standard };
      assert.equal(carrier(noticeModel), undefined, 'preview cold viewport has no premature hit carrier');
      let noticeCarrier;
      for (const [width, height, header, footer] of [[366, 844, 58, 0], [320, 320, 116, 40]]) {
        resize(noticeModel, width, height, header, footer);
        const actual = carrier(noticeModel), geometry = standard.geometry;
        assert.ok(actual); noticeCarrier ??= actual; assert.equal(actual, noticeCarrier);
        assert.equal(actual.margin.top, geometry.content.startInset);
        assert.equal(actual.width, geometry.content.frame.width);
        assert.ok(actual.margin.top + actual.constraintSize.maxHeight <= geometry.footer.top);
      }
      samples++;
    }
    console.log(JSON.stringify({ kind: 'settings-overlay-assembly', case: id, samples,
      boundary: 'Actual SDK property/Builder and complete current shell/StandardPage geometry chain. Header/nav/business bodies and preview timers are explicit finite ports. Native layout, modal focus, physical touch and pixels are not executed.' }));
    recordContractCasePass(id);
  }
}

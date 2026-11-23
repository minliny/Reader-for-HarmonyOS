import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'standard-overlay-frame': { description: 'Actual StandardPage overlay receives current measured geometry and preserves legacy callbacks without feeding overlay facts into page layout.', resources: [] },
  'rss-recovery-slots': { description: 'Actual retained RSS entry/feed recovery uses the overlay slot while ordinary read feedback remains in content.', resources: [] },
  'sync-recovery-slot': { description: 'Actual retained Sync recovery has an independent bounded slot and retires stale, busy or conflicting action callbacks.', resources: [] },
  'legacy-overlay-slots': { description: 'Actual tools, bookshelf management and bookshelf settings callers migrate their scalar-positioned recovery to the live StandardPage bounded slot.', resources: [] },
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
  const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
  const syntax = createRequire(import.meta.url)(resolveEtsLoaderRoot() + '/lib/validate_ui_syntax.js');
  const { projectOperationFacts } = await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
  const { projectPersistedReceipt } = await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
  const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
  const { rssOriginalMatchesScope } = await import('../entry/src/main/ets/features/rss/application/RssMutationRecoveryContract.ts');
  const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
  const standardSource = read('ui/layout/ReaderStandardPage.ets');
  const metrics = createDefaultReaderWindowMetrics();
  Object.assign(metrics.windowRect, { width: 366, height: 844 });
  Object.assign(metrics.systemInsets, { top: 24, bottom: 0 });
  metrics.navigationInsets.bottom = 24;
  const dependencies = { ...actualReaderPageLayout(), projectOperationFacts, readerRecoveryView, rssOriginalMatchesScope,
    readerWindowMetrics: () => metrics, ReaderWindowCoordinator: { metrics: () => metrics }, registerReaderFonts() {} };
  const initialRead = projectOperationFacts({ phase: 'succeeded', value: [] });
  const operation = generation => ({ projection: projectPersistedReceipt({ confirmation: 'unknown', readback: 'failed', generation, canRetry: true }) });
  const ownNotice = (owner, sdk) => sdk.walk(owner).find(child => (child.view ?? child.params?.view)?.message !== undefined &&
    (child.actionLabel ?? child.params?.actionLabel) === '重新读取');

  function standard(code = standardSource, visible = true) {
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
    const owner = sdk.consumer(code, undefined, dependencies, { boundedOverlayVisible: visible });
    owner.aboutToAppear(); owner.initialRender(); sdk.properties.flush();
    const scaffold = [...owner.children.values()].find(child => child.geometry);
    assert.ok(scaffold);
    return { sdk, owner, scaffold };
  }
  function resize(model, width, height) {
    const callback = [...model.owner.nodes.values()].find(node => node.onAreaChange)?.onAreaChange;
    assert.equal(typeof callback, 'function', 'actual mounted StandardPage native area callback');
    callback({}, { width, height }); model.sdk.properties.flush();
  }
  function overlayScroll(model) {
    return [...model.owner.nodes.values()].find(node => node.type === 'Scroll' && node.onTouch);
  }
  function pageModel(text, methods, props, extra = {}) {
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
    sdk.hooks.childSources.PageBackBar = read('ui/chrome/PageBackBar.ets');
    assert.match(sdk.hooks.childSources.PageBackBar, /@BuilderParam trailing\?: \(\) => void/);
    syntax.builderParamObjectCollection.set('PageBackBar', new Set(['trailing']));
    sdk.deps.PageBackBar = class {
      constructor(_owner, params) { this.params = params; }
      updateStateVars(params) { this.params = params; }
      initialRender() {}
    }; // The independently measured native header is a finite chrome port.
    for (const name of ['ReaderToggle', 'ReaderSegmentedControl', 'ReaderFormRow']) {
      sdk.hooks.childSources[name] = read('ui/controls/' + name + '.ets');
      sdk.deps[name] = sdk.deps.PageBackBar; // Unexecuted ordinary form-control port.
    }
    assert.match(sdk.hooks.childSources.ReaderFormRow, /@BuilderParam content: \(\) => void/);
    syntax.builderParamObjectCollection.set('ReaderFormRow', new Set(['content']));
    const childSource = read('features/rss/ui/RssOriginalRecoverySurface.ets');
    sdk.hooks.childSources.RssOriginalRecoverySurface = childSource;
    sdk.deps.RssOriginalRecoverySurface = createReaderBuilderProbe(childSource, boundedMembers(childSource),
      { ...sdk.deps, rssOriginalMatchesScope }, sdk.hooks).Component;
    const owner = sdk.consumer(text, methods, { ...dependencies, ...extra }, props);
    Object.assign(owner, { backBar() {}, bottomActions() {}, pageHeader() {},
      pageContent() { this.operationFeedback?.(); }, entryList() { this.operationFeedback?.(); },
      syncSnapshotInputs() {}, onSnapshotChanged() {}, onOperationChanged() {} });
    for (const [name, value] of Object.entries(props)) {
      if (Object.getOwnPropertyDescriptor(Object.getPrototypeOf(owner), name)?.get === undefined) owner[name] = value;
    }
    owner.initialRender(); sdk.properties.flush();
    const standard = [...owner.children.values()].find(child => child.geometry);
    assert.ok(standard, 'the actual page build uses StandardPage');
    return { sdk, page: owner, owner: standard };
  }

  for (const id of selected) {
    if (id === 'standard-overlay-frame') {
      const model = standard();
      assert.equal(overlayScroll(model), undefined, 'no hit carrier precedes the first real viewport');
      const scroller = model.owner.scroller;
      const initialKey = model.owner.measurementKey;
      let sameActor;
      for (const [width, height, header, footer] of [[366, 844, 58, 62], [320, 320, 116, 100], [366, 568, 174, 150]]) {
        resize(model, width, height);
        model.owner.recordMeasurement('standard:header', header, model.owner.measurementKey);
        model.owner.recordMeasurement('standard:footer', footer, model.owner.measurementKey);
        model.sdk.properties.flush();
        const carrier = overlayScroll(model), geometry = model.owner.geometry;
        assert.ok(carrier);
        sameActor ??= carrier;
        assert.equal(carrier, sameActor, 'header/footer/viewport updates retain the same native overlay actor');
        assert.deepEqual(carrier.margin, { left: geometry.content.frame.left, right: geometry.content.frame.right,
          top: geometry.content.startInset });
        assert.equal(carrier.width, geometry.content.frame.width);
        const available = carrier.constraintSize.maxHeight;
        assert.ok(available >= 0 && carrier.margin.top + available <= geometry.footer.top);
        assert.ok(carrier.margin.top + available <= height - Math.max(geometry.content.endInset, geometry.content.nativeEndInset));
        assert.equal(model.owner.scroller, scroller);
        const before = JSON.stringify(geometry), key = model.owner.measurementKey;
        model.owner.boundedOverlayVisible = false;
        assert.equal(JSON.stringify(model.owner.geometry), before);
        assert.equal(model.owner.measurementKey, key, 'overlay projection does not feed the measurement generation');
        model.owner.boundedOverlayVisible = true;
      }
      assert.ok(model.owner.measurementKey > initialKey);
      const hidden = standard(standardSource, false);
      resize(hidden, 320, 568);
      assert.equal(overlayScroll(hidden), undefined, 'an absent pending operation leaves no overlay hit carrier');
      const legacy = [];
      const oldConsumer = standard(standardSource, false);
      oldConsumer.owner.overlayContent = top => legacy.push(top);
      oldConsumer.scaffold.overlayContent();
      assert.equal(legacy.at(-1), oldConsumer.owner.geometry.content.startInset, 'the original single-argument slot remains callable');
      const unsafe = standardSource.replace('Math.min(contentBottom, geometry.footer.top)', 'this.viewportHeight');
      assert.notEqual(unsafe, standardSource);
      const unsafeModel = standard(unsafe);
      resize(unsafeModel, 320, 320);
      unsafeModel.owner.recordMeasurement('standard:footer', 150, unsafeModel.owner.measurementKey);
      unsafeModel.sdk.properties.flush();
      const unsafeCarrier = overlayScroll(unsafeModel);
      assert.ok(unsafeCarrier.margin.top + unsafeCarrier.constraintSize.maxHeight > unsafeModel.owner.geometry.footer.top,
        'the full-viewport mutation violates the real measured footer');
    }
    if (id === 'rss-recovery-slots') {
      for (const name of ['RssEntryDetailPage', 'RssSourceFeedPage']) {
        const text = read('features/rss/ui/' + name + '.ets');
        const methods = ['build', 'operationFeedback', 'hasPendingRecovery', 'pendingRecovery', 'feedbackView',
          'retryFeedback', 'operation', 'readFacts', 'original', 'presentationIdentity'];
        if (name === 'RssEntryDetailPage') methods.push('item');
        const calls = [];
        const props = { item: { subscriptionId: 's', guid: 'a' }, operation: operation(17), readFacts: initialRead,
          onReconcile: value => calls.push(value.projection.facts.generation) };
        const model = pageModel(text, methods, props);
        assert.equal(overlayScroll(model), undefined, 'unready viewport owns no recovery hit carrier');
        assert.equal(model.sdk.nodes(model.page).some(node => node.type === 'Text'), false,
          'unknown recovery cannot enter ordinary content before an overlay exists');
        resize(model, 320, 568);
        const scroll = overlayScroll(model);
        assert.ok(scroll);
        assert.equal(scroll.width, model.owner.geometry.content.frame.width);
        assert.deepEqual(scroll.margin, { left: model.owner.geometry.content.frame.left,
          right: model.owner.geometry.content.frame.right, top: model.owner.geometry.content.startInset });
        let stopped = false; scroll.onTouch({ stopPropagation() { stopped = true; } }); assert.equal(stopped, true);
        const notice = ownNotice(model.page, model.sdk);
        assert.ok(notice);
        const action = notice.onReconcile ?? notice.params.onReconcile;
        action(17); assert.deepEqual(calls, [17]);
        model.page.operation = operation(18);
        action(17); assert.deepEqual(calls, [17], 'old receipt generation cannot reconcile its successor');
        const empty = pageModel(text, methods, { ...props, operation: undefined });
        resize(empty, 320, 568);
        assert.equal(overlayScroll(empty), undefined, 'a completed/absent receipt leaves no overlay');
        const known = pageModel(text, methods, { ...props, operation: undefined,
          readFacts: projectOperationFacts({ phase: 'failed', error: 'read failed', generation: 24, canRetry: true }) });
        assert.ok(known.sdk.nodes(known.page).some(node => node.type === 'Text'), 'ordinary read failure remains a PageState in content');
        resize(known, 320, 568);
        assert.equal(overlayScroll(known), undefined);
      }
    }
    if (id === 'sync-recovery-slot') {
      const gateway = read('features/sync/application/SyncGateway.ts');
      const defaults = gateway.slice(gateway.indexOf('const DEFAULT_WEBDAV_DIRECTORY'), gateway.indexOf('/**\n * Foreground'));
      const { DEFAULT_SYNC_SNAPSHOT } = pureModuleProbe(defaults, 'SyncDefaults.ts', {}, ['DEFAULT_SYNC_SNAPSHOT']);
      const text = read('features/sync/ui/SyncPage.ets');
      const methods = ['build', 'snapshot', 'pendingRecovery', 'originalRecovery', 'hasOriginalRecovery', 'recoveryIdentity', 'recoveryCurrent',
        'feedbackView', 'recoveryLabel', 'canContinueConfigSave', 'configSaveContinuationIdentities', 'configSaveGeneration',
        'canSkipBackupRetention', 'backupRetentionActionIdentities', 'backupGeneration'];
      const calls = [];
      const snapshot = { ...DEFAULT_SYNC_SNAPSHOT, canContinueConfigSave: true, configSaveIntent: { operationId: 'save-17' },
        facts: { read: initialRead, busy: false, canMutate: false,
          operation: { action: 'saveConfig', operationId: 'save-17', completed: false, canContinueOriginal: true, projection: operation(17).projection } } };
      const model = pageModel(text, methods, { snapshot }, { DEFAULT_SYNC_SNAPSHOT });
      const { page: owner, sdk } = model;
      Object.assign(owner, { snapshot, effectiveWebdavUrl: () => 'https://fixture.invalid', effectiveWebdavUser: () => 'user',
        effectiveWebdavPath: () => '/fixture', onReconcile: generation => calls.push(['reconcile', generation]),
        onContinueConfigSave: generation => calls.push(['continue', generation]),
        onSkipBackupRetention: generation => calls.push(['skip', generation]) });
      resize(model, 320, 568);
      const scroll = overlayScroll(model); assert.ok(scroll);
      assert.ok(scroll.constraintSize.maxHeight > 0);
      const action = sdk.walk(owner).find(child => child.label === '继续原操作');
      assert.ok(action, 'the exact original configuration continuation remains available');
      const invoke = action.onReconcile ?? action.params.onReconcile;
      invoke(17); assert.deepEqual(calls, [['continue', 17]]);
      for (const update of [ { ...snapshot, facts: { ...snapshot.facts, busy: true } },
        { ...snapshot, restoreConflict: { transactionId: 'conflict' } },
        { ...snapshot, facts: { ...snapshot.facts, operation: { ...snapshot.facts.operation, canContinueOriginal: false } } },
        { ...snapshot, facts: { ...snapshot.facts, operation: { ...snapshot.facts.operation, operationId: 'save-18' } } } ]) {
        owner.snapshot = update; invoke(17); assert.equal(calls.length, 1, 'retired, busy and foreground-conflict callbacks cannot dispatch');
      }
      for (const [height, snap] of [[0, snapshot], [568, { ...snapshot, restoreConflict: { transactionId: 'conflict' } }],
        [568, DEFAULT_SYNC_SNAPSHOT]]) {
        const next = pageModel(text, methods, { snapshot: snap }, { DEFAULT_SYNC_SNAPSHOT });
        if (height > 0) resize(next, 320, height);
        assert.equal(overlayScroll(next), undefined);
      }
    }
    if (id === 'legacy-overlay-slots') {
      const toolsModule = read('features/source/application/SourceToolsOrchestrator.ets');
      const { EMPTY_SOURCE_TOOLS_SNAPSHOT } = pureModuleProbe(toolsModule.slice(0, toolsModule.indexOf('export class SourceToolsOrchestrator')),
        'SourceToolsDefaults.ets', {}, ['EMPTY_SOURCE_TOOLS_SNAPSHOT']);
      const shelfModule = read('features/bookshelf/application/BookshelfManagementOrchestrator.ets');
      const { EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT } = pureModuleProbe(shelfModule.slice(0, shelfModule.indexOf('export class BookshelfManagementOrchestrator')),
        'BookshelfManagementDefaults.ets', {}, ['EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT']);
      const receipt = operation(17).projection;
      const fixtures = [
        { path: 'features/source/ui/SourceToolsPage.ets', methods: ['snapshot', 'pendingRecovery', 'recoveryAction', 'recovery', 'overlayWidth'],
          props: { snapshot: { ...EMPTY_SOURCE_TOOLS_SNAPSHOT, receipt } }, extra: { EMPTY_SOURCE_TOOLS_SNAPSHOT },
          label: '核对' },
        { path: 'features/bookshelf/ui/BookshelfManagementPage.ets', methods: ['snapshot', 'pendingRecovery', 'originalPending', 'recovery'],
          props: { snapshot: { ...EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT, receipt } }, extra: { EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT },
          label: '核对操作结果' },
        { path: 'features/bookshelf/ui/BookshelfSettingsPage.ets', methods: ['operation', 'pendingRecovery', 'settingsPending', 'modePending',
            'settingsRecovery', 'viewModeSnapshot', 'viewModeRecovery', 'settingsRecoveryIdentity', 'settingsRecoveryCurrent',
            'retrySettingsRecovery', 'retrySettingsAccepted', 'userInputIsCurrent', 'presentationRevision', 'navigationGeneration', 'mounted'],
          props: { operation: { action: 'save', receipt }, navigationGeneration: 7, mounted: true }, extra: {}, label: '核对设置' },
      ];
      for (const fixture of fixtures) {
        const text = read(fixture.path), calls = [];
        const model = pageModel(text, ['build', ...fixture.methods],
          { ...fixture.props, onReconcile: generation => calls.push(generation) }, fixture.extra);
        assert.equal(overlayScroll(model), undefined);
        resize(model, 320, 568);
        const carrier = overlayScroll(model);
        assert.ok(carrier, fixture.path);
        const notice = model.sdk.walk(model.page).find(child => child.actionLabel === fixture.label);
        assert.ok(notice);
        const action = notice.onReconcile ?? notice.params.onReconcile;
        action(17); assert.deepEqual(calls, [17], fixture.path + ' preserves its original reconcile endpoint');
        model.owner.recordMeasurement('standard:header', 116, model.owner.measurementKey);
        model.owner.recordMeasurement('standard:footer', 100, model.owner.measurementKey);
        model.sdk.properties.flush();
        assert.equal(overlayScroll(model), carrier);
        assert.equal(carrier.margin.top, model.owner.geometry.content.startInset,
          fixture.path + ' follows measured header growth on its same overlay actor');
        assert.ok(carrier.margin.top + carrier.constraintSize.maxHeight <= model.owner.geometry.footer.top);
      }
    }
    console.log('PASS retained-overlay-pages ' + id + ' with actual SDK and production geometry. Native scheduling, removal, physical hit testing and pixels are not executed.');
    recordContractCasePass(id);
  }
}

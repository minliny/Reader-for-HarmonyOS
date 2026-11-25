import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'filter-projection': 'Actual page methods: trim, checking membership, clear four filters and filtered enabled statistics; no transport.',
  'list-state': 'SDK-lowered sourceList and real PageState: filtered/empty/error/loading/recovery priority and native end-offset forwarding.',
  'login-status': 'SDK-lowered login/status carriers with actual ReaderButton admission and badge label; no native focus or pixels.',
  'login-session': 'Actual SourceHost/Orchestrator/Gateway: explicit completion plus L1–L2 verifies, clearing and disabling revoke, authentication denial expires, and retired sessions never project.',
  'action-admission': 'Actual SDK write-toggle admission and independent diagnostic admission: blocked/unknown permitted; checking/stale presentation/removed entity/unmounted denied. No native or full source-version result proof.',
  'shared-page-shell': 'Five source routes share the standard floating back bar and safe-frame owner.',
  'pane-dialog-geometry': 'Source dialog resolved card width and fixed cancel / flexible apply in an embedded pane.',
  'footer-geometry': 'Actual page geometry plus actual shared resolver: measured footer determines scroll tail; measured keys remain distinct.',
});
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  const file = new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets', import.meta.url);
  const text = readFileSync(file, 'utf8');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { readerScrollLayout, readerScrollStartOffset, readerScrollEndOffset } = await import('../entry/src/main/ets/ui/layout/ReaderScrollLayout.ts');
  const base = id => ({ sourceId: id, name: id, baseUrl: `https://${id}.test`, enabled: true, category: 'novel', checkState: 'unchecked' });
  const { sourceManagementFilterKey } = await import('../entry/src/main/ets/features/source/presentation/SourceManagementScrollState.ts');
  const v9 = await import('../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts');
  const methods = names => selectedProductionMethods(file, 'SourceManagementPage', names, { sourceManagementFilterKey, ...v9 });

  async function projection() {
    const Page = methods(['normalizedSourceGroup', 'groupOptions', 'filterProjection', 'rebuildSourceProjection',
      'clearFilters', 'managementInputIsCurrent', 'managementOpeningIsCurrent', 'currentFilterKey']);
    const page = new Page();
    let replaced;
    Object.assign(page, { mounted: true, appForeground: true, inputEnabled: true, groupOpen: false,
      isOpeningCurrent: () => true, catalogGroupNames: [],
      sources: [{ ...base('a'), group: ' 玄幻 ' },
        { ...base('b'), group: '玄幻', enabled: false, checkState: 'checking' },
        { ...base('c'), group: '' }, { ...base('d'), category: 'music', group: '玄幻' }],
      lastProjectionFilterKey: '', scheduleSourceAnchorRestore(){}, cancelScrollRestore(){}, observeVerificationProjection(){},
      searchQuery: '', statusValue: '全部', categoryValue: 'all', groupValue: '玄幻',
      sourceDataSource: { replace: value => { replaced = value; } },
      onRetryLoad() { assert.fail('local filters must not dispatch reads'); } });
    assert.deepEqual(page.groupOptions(), ['全部分组', '未分组', '玄幻']);
    page.rebuildSourceProjection();
    assert.deepEqual(replaced.map(source => source.sourceId), ['a', 'b']);
    assert.deepEqual(page.statusCounts, { all:2, enabled:1, disabled:1, abnormal:0 });
    page.statusValue = '已停用'; page.rebuildSourceProjection();
    assert.deepEqual(replaced.map(source => source.sourceId), ['b']);
    assert.deepEqual(page.statusCounts, { all:2, enabled:1, disabled:1, abnormal:0 });
    page.searchQuery = 'no-match'; page.rebuildSourceProjection();
    assert.deepEqual(page.statusCounts, { all:0, enabled:0, disabled:0, abnormal:0 });
    page.categoryValue = 'comic'; page.groupValue = 'missing'; page.clearFilters();
    assert.deepEqual([page.searchQuery, page.statusValue, page.categoryValue, page.groupValue], ['', '全部', 'all', '全部分组']);
    assert.deepEqual(replaced.map(source => source.sourceId), ['a','b','c']);
    page.sources = []; assert.deepEqual(page.groupOptions(), ['全部分组','未分组']);
  }

  async function listState() {
    const sdk = boundedSurfaceSdk();
    function render({ sources = [base('a')], statusKind = 'idle', operation = {} } = {}) {
      let clears = 0;
      const page = sdk.consumer(text, ['sourceList', 'hasPendingSourceRecovery', 'sourceListLoading',
        'sourceAnchorReadPending', 'hasFilteredEmpty', 'hasEmptyListReadFailure', 'hasEmptyImportReadbackFailure',
        'readPageStateTitle', 'readPageStateMessage', 'retryEmptyListAction', 'retryRetainedListAction'],
      { readerScrollStartOffset, readerScrollEndOffset,
        ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} } });
      Object.assign(page, { sources, hasReadableSources: sources.some(v9.sourceV9Supports),
        projectedSources: [], projectedSourceCount: 0, statusKind, statusMessage: '', operation,
        editingScroll: { id: 'source-list-state-test' },
        sourceDataSource: { totalCount: () => 0 }, sourceRow() {}, verificationLoadingObserver() {}, readPageStateTextOptions() {}, searchField() {}, statusAction() {}, filterArea() {}, categoryFilter() {},
        contentFrame: () => ({ left: 19, right: 19, width: 328 }), scrollLayout: () => ({ startInset: 58, endInset: 91, mode: 'contentOffset' }),
        recovery: () => ({ canRetry: false }), clearFilters: () => { clears++; } });
      page.sourceList();
      // ArkUI owns ListItem realization. Invoke the exact SDK-emitted deep
      // render closures at this finite native seam; do not rewrite Builders.
      for (const node of [...page.nodes.values()]) {
        if (node.type === 'ListItem' && typeof node.create?.[0] === 'function') node.create[0]();
      }
      return { page, nodes: sdk.nodes(page), children: sdk.walk(page), clears: () => clears };
    }
    const filtered = render();
    assert.ok(filtered.nodes.some(n => n.type === 'Text' && n.create === '没有匹配的书源'));
    const state = filtered.children.find(c => c instanceof sdk.deps.ReaderPageState);
    assert.ok(state); state.onAction(); assert.equal(filtered.clears(), 1, 'real PageState forwards reset to the page');
    const list = filtered.nodes.find(n => n.type === 'List');
    assert.equal(list.contentStartOffset, 58); assert.equal(list.contentEndOffset, 91);
    for (const input of [{ statusKind: 'loading' }, { operation: { original: { blocked: true } } }, { operation: { receipt: { receipt: { confirmation: 'unknown' }, facts: { fact: 'pendingReconciliation' } } } }]) {
      const result = render(input);
      assert.ok(!result.nodes.some(n => n.type === 'Text' && n.create === '没有匹配的书源'), 'loading/recovery retain priority over filteredEmpty');
    }
    for (const [input, title] of [[{ sources: [] }, '暂无书源'], [{ sources: [], statusKind: 'loading' }, '正在读取书源'], [{ sources: [], operation: { readFacts: { fact: 'failed' } } }, '书源读取失败']]) {
      const result = render(input);
      assert.ok(result.nodes.some(n => n.type === 'Text' && n.create === title));
      assert.ok(!result.nodes.some(n => n.type === 'Text' && n.create === '没有匹配的书源'));
    }
    const readFailed = render({ statusKind: 'error', operation: { readFacts: { fact: 'failed', generation: 4 } } });
    assert.ok(readFailed.nodes.some(n => n.type === 'Text' && n.create === '没有匹配的书源'), 'accepted old sources still have a valid filtered-empty projection');
    assert.ok(!readFailed.nodes.some(n => n.type === 'Text' && n.create === '书源读取失败'), 'readback failure must not replace available old content with full-page error');
    const { projectOperationFacts } = await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
    const { projectPersistedReceipt } = await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
    const { sourceManagementRecoveryProbe, sourceRecoveryNativeAction } =
      await import('./lib/source-management-recovery-probe.mjs');
    const read = (phase, generation, value, canRetry = phase === 'failed') => ({
      action: 'load', sourceId: '', readFacts: projectOperationFacts({ phase, generation, value, canRetry }),
    });
    const attempts = [];
    const mount = (operation, props = {}) => sourceManagementRecoveryProbe(text, {
      sources: [], operation, onReconcile: expected => attempts.push(expected),
      onRetryLoad: () => attempts.push('legacy-read'), ...props,
    });
    const pageState = ({ owner, sdk }) => sdk.walk(owner).find(child => child instanceof sdk.deps.ReaderPageState);
    const unknownWrite = {
      ...read('succeeded', 5, []), receipt: projectPersistedReceipt({
        confirmation: 'unknown', readback: 'failed', canRetry: true, generation: 6,
      }),
    };
    const unknown = mount(unknownWrite, { statusActionLabel: '检查状态', statusActionGeneration: 10 });
    const retainedUnknown = mount(unknownWrite, { sources: [base('old')], statusKind: 'loading' });
    const reload = mount(read('loading', 7, []));
    const refreshFailed = mount(read('failed', 8, []));
    const stale = mount(read('failed', 9));
    const staleRetry = sourceRecoveryNativeAction(stale, '重试').onClick;
    stale.owner.operation = read('failed', 10);
    staleRetry();
    const retired = mount(read('failed', 11));
    retired.owner.temporaryBackIdentity = 'source-management-successor';
    sourceRecoveryNativeAction(retired, '重试').onClick();
    const replacedByReceipt = mount(read('failed', 12));
    replacedByReceipt.owner.operation = unknownWrite;
    sourceRecoveryNativeAction(replacedByReceipt, '重试').onClick();
    const current = mount(read('failed', 13));
    sourceRecoveryNativeAction(current, '重试').onClick();
    const legacy = mount(read('failed', 14, undefined, false));
    sourceRecoveryNativeAction(legacy, '重试').onClick();
    const retained = mount(read('failed', 16, [base('old')]), { sources: [base('old')] });
    const retainedRetry = sourceRecoveryNativeAction(retained, '刷新列表').onClick;
    retainedRetry();
    retained.owner.operation = { ...unknownWrite, readFacts: retained.owner.operation.readFacts };
    retainedRetry();
    const statusCalls = [];
    const status = mount(read('succeeded', 17, []), { statusActionLabel: '查看结果', statusActionGeneration: 18,
      onStatusAction: expected => statusCalls.push(expected) });
    const statusAction = sourceRecoveryNativeAction(status, '查看结果').onClick;
    statusAction();
    status.owner.operation = unknownWrite;
    statusAction();
    const observation = {
      unknownPageState: pageState(unknown)?.title ?? null,
      unknownAction: unknown.sdk.walk(unknown.owner).some(actor => actor.label === '检查状态'),
      unknownRecoveryGeneration: sourceRecoveryNativeAction(unknown, '核对').actor.generation,
      retainedUnknownLoading: pageState(retainedUnknown)?.loading ?? false,
      reload: pageState(reload)?.title,
      refreshFailed: pageState(refreshFailed)?.title,
      refreshGeneration: pageState(refreshFailed)?.actionGeneration,
      currentGeneration: pageState(current)?.actionGeneration,
      confirmedEmpty: pageState(mount(read('succeeded', 15, [])))?.title,
      attempts,
      statusCalls,
    };
    console.log(JSON.stringify(observation));
    assert.deepEqual(observation, {
      unknownPageState: null, unknownAction: false, unknownRecoveryGeneration: 6,
      retainedUnknownLoading: false, reload: '正在读取书源', refreshFailed: '书源读取失败',
      refreshGeneration: 8, currentGeneration: 13, confirmedEmpty: '暂无书源',
      attempts: [13, 'legacy-read', 16], statusCalls: [18],
    });
    const { READER_FEEDBACK_EXTENDED_MS } = await import('../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts');
    const Feedback = selectedProductionMethods(file, 'SourceManagementPage', ['onMessageChanged', 'feedbackIdentity',
      'sourceListLoading', 'sourceAnchorReadPending', 'hasPendingSourceRecovery', 'hasEmptyListReadFailure'], { READER_FEEDBACK_EXTENDED_MS });
    const feedback = new Feedback(), messages = [];
    Object.assign(feedback, { mounted: true, sources: [base('a')], projectedSources: [], statusKind: 'error', statusMessage: '刷新失败，保留旧书源',
      operation: { readFacts: { fact: 'failed', generation: 4 } }, lastFeedbackIdentity: '', lastToastMessage: '',
      scheduleSourceAnchorRestore(){}, observeVerificationProjection(){}, scheduleImportStatusReadyObservation(){},
      recovery: () => ({ visible: false, message: '' }), getUIContext: () => ({}),
      transientFeedback: { show(_context, notice, current) { assert.equal(current(), true); messages.push(notice.message); } } });
    feedback.onMessageChanged(); feedback.onMessageChanged();
    assert.deepEqual(messages, ['刷新失败，保留旧书源'], 'available old content failure is one transient fact, independently of the local filtered-empty projection');
    feedback.sources = [];
    feedback.operation = read('failed', 19, []);
    feedback.statusMessage = '刷新失败，保留上次读取结果';
    feedback.onMessageChanged();
    assert.deepEqual(messages, ['刷新失败，保留旧书源'], 'a failed retained empty list has one dedicated failure surface');
  }

  async function actionAdmission() {
    const { toggleSource, switchSpecs } = await import('./lib/reader-switch-control-probe.mjs');
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
    const switchControls = () => {
      const properties=createArkUIPropertyRuntimeProbe();
      const dependencies={...properties.sdk,...switchSpecs(),readerAppColor,...v9,DEBUG:false,hilog:{info(){}}};
      const hooks={...properties.hooks,childSources:{ReaderToggle:toggleSource},mountChildren:true,lifecycleChildren:true};
      const toggle=createReaderBuilderProbe(toggleSource,boundedMembers(toggleSource),dependencies,hooks);
      dependencies.ReaderToggle=toggle.Component;
      const nodes=owner=>[...owner.nodes.values(),...[...owner.children.values()].filter(child=>child.nodes).flatMap(nodes)];
      return {toggle,nodes,consumer(source,members,extra={},params={}){
        return createReaderBuilderProbe(source,members,{...dependencies,...extra},{...hooks,initialParams:params}).owner;
      }};
    };
    for (const [operation, expected] of [
      [{ action: 'load', sourceId: '' }, 1],
      [{ action: 'toggle', sourceId: 'a', original: { busy: true, blocked: false } }, 0],
      [{ action: 'toggle', sourceId: 'a', original: { busy: false, blocked: true } }, 0],
      [{ action: 'toggle', sourceId: 'a', receipt: { receipt: { confirmation: 'unknown' }, facts: { fact: 'pendingReconciliation' } } }, 0],
      [{ action: 'toggle', sourceId: 'a', receipt: { receipt: { confirmation: 'confirmed' }, facts: { fact: 'refreshing' } } }, 0],
    ]) {
      const controls = switchControls(), calls = [];
      const page = controls.consumer(text, ['operation', 'projectedSources', 'sourceSwitch', 'sourceSwitchValue', 'sourceSwitchName', 'sourceToggleBusy', 'sourceActionEnabled','managementBackIsCurrent','managementOpeningIsCurrent'], {}, { operation });
      Object.assign(page, { mounted: true, appForeground:true, inputEnabled:true, temporaryBackIdentity: 'action-admission', onToggleSource: (_id, next) => calls.push(next) });
      page.sourceSwitch(false, next => page.onToggleSource('a', next), 'a');
      const actor = [...page.children.values()].find(c => c instanceof controls.toggle.Component);
      assert.ok(actor); const change = controls.nodes(actor).find(n => n.type==='Toggle' && n.onChange)?.onChange; assert.ok(change);
      change(true);
      if (expected === 0) change(true);
      assert.equal(calls.length, expected, 'actual shared toggle refuses busy/blocked/unknown/refreshing callbacks');
    }
    const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
    const controls = foundationControls();
    const { sourceV9ChromeControls } = await import('./lib/source-v9-chrome-sdk-probe.mjs');
    const chrome = sourceV9ChromeControls({ ...controls.dependencies, ...v9, readerAppColor },
      controls.hooks, ['SourceV9DetectButton']);
    const detectMembers = ['detectButton','sourceBadgeLabel','offlineDetectBadgeId',
      'verificationRowTextId','sourceDetectEnabled','sourceActionLabel','sourceRowCommand','sourceRowIsCurrent',
      'sourceRenderKey','managementBackIsCurrent','managementOpeningIsCurrent'];
    const renderDetect = (source, operation) => {
      let calls = 0;
      const page = createReaderBuilderProbe(text, detectMembers, chrome.dependencies, chrome.hooks).owner;
      Object.assign(page,{mounted:true,appForeground:true,inputEnabled:true,temporaryBackIdentity:'detect-admission',
        sources:[source],projectedSources:[source],appThemeScheme:'day',operation,onDetectSource:()=>calls++});
      page.detectButton(source);
      const button = controls.nodes(page).find(node => node.type === 'Button' && node.onClick);
      assert.ok(button);
      return {page,button,calls:()=>calls};
    };
    for (const [checkState, blocked, unknown, expected] of [['unchecked', false, false, 1], ['checking', false, false, 0],
      ['unchecked', true, false, 1], ['unchecked', false, true, 1], ['unchecked', true, true, 1]]) {
      const {button,calls} = renderDetect({...base('a'),checkState},
        {original:{blocked},receipt:{receipt:{confirmation:unknown?'unknown':'confirmed'}}});
      button.onClick();
      assert.equal(button.enabled,checkState !== 'checking');
      assert.equal(calls(),expected,'the native v9 diagnostic stays independent of an unknown source write');
    }
    for (const retire of ['checking','removed','unmounted','presentation']) {
      const {page,button,calls} = renderDetect(base('a'),{});
      if (retire === 'checking') page.sources = [{...base('a'),checkState:'checking'}];
      if (retire === 'removed') page.sources = [];
      if (retire === 'unmounted') page.mounted = false;
      if (retire === 'presentation') page.temporaryBackIdentity = 'detect-successor';
      button.onClick();
      assert.equal(calls(),0,`retired v9 detection refuses ${retire}`);
    }
  }

  async function loginStatus() {
    const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
    const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
    const controls = foundationControls();
    const rowMethods = ['loginButton','loginInk','loginSurface','verificationRowActionsCurrent','sourceActionEnabled','sourceActionLabel',
      'sourceRowCommand','sourceRowIsCurrent','sourceRenderKey','managementBackIsCurrent','managementOpeningIsCurrent'];
    for (const [checkState, blocked, unknown, expected] of [
      ['unchecked',false,false,1],['checking',false,false,0],['unchecked',true,false,0],['unchecked',false,true,0],
    ]) {
      let calls = 0;
      const page = createReaderBuilderProbe(text, rowMethods, { ...controls.dependencies, ...v9, readerAppColor,
        readerActionIcon: (kind, scheme) => `icon:${kind}:${scheme}`, $r: value => value }, controls.hooks).owner;
      const source = {...base('a'),loginUrl:'https://a.test/login',checkState};
      Object.assign(page,{mounted:true,appForeground:true,inputEnabled:true,temporaryBackIdentity:'login-sdk',
        sources:[source],projectedSources:[source],appThemeScheme:'day',
        operation:{original:{blocked},receipt:{receipt:{confirmation:unknown?'unknown':'confirmed'}}},onLoginSource:()=>calls++});
      page.loginButton(source);
      const button = [...page.nodes.values()].find(node=>node.type === 'Button' && node.onClick);
      assert.ok(button);
      assert.equal(button.enabled,expected === 1);
      assert.match(button.accessibilityText,/登录，状态未知/);
      button.onClick();
      assert.equal(calls,expected);
    }
    for (const scheme of ['day', 'night']) for (const [loginState, ink, surface, icon, accessibilityText] of [
      ['verified', 'app.status.good', 'app.status.goodSoft', `icon:check:${scheme}`, '登录，已验证'],
      ['expired', 'app.sourceUi.danger', 'app.sourceUi.dangerSurface', `icon:close:${scheme}`, '登录，验证失效'],
      ['unknown', 'app.sourceUi.muted', 'app.sourceUi.field', 'app.media.source_v9_question', '登录，状态未知'],
    ]) {
      const page = createReaderBuilderProbe(text, rowMethods, { ...controls.dependencies, ...v9, readerAppColor,
        readerActionIcon: (kind, theme) => `icon:${kind}:${theme}`, $r: value => value }, controls.hooks).owner;
      const source = { ...base('a'), loginState, loginUrl: 'https://a.test/login' };
      Object.assign(page, { mounted: true, appForeground: true, inputEnabled: true, temporaryBackIdentity: 'login-sdk',
        sources: [source], projectedSources: [source], appThemeScheme: scheme, operation: {} });
      page.loginButton(source);
      const nodes = [...page.nodes.values()];
      const button = nodes.find(node => node.type === 'Button' && node.onClick);
      const ring = nodes.find(node => node.type === 'Stack' && node.width === 13);
      const glyph = nodes.find(node => node.type === 'Image');
      assert.deepEqual([button.width, button.height, button.responseRegion.height], [58, 26, 44]);
      assert.equal(button.backgroundColor, readerAppColor(surface, scheme));
      assert.equal(ring.border.color, readerAppColor(ink, scheme));
      assert.equal(glyph.fillColor, readerAppColor(ink, scheme));
      assert.equal(glyph.create, icon);
      assert.ok(button.accessibilityText.includes(accessibilityText));
    }
    const Status = methods(['sourceBadgeLabel']);
    const status = new Status();
    assert.equal(status.sourceBadgeLabel({...base('a'),checkState:'checking'}),'检测中');
    assert.equal(status.sourceBadgeLabel({...base('a'),checkState:'failed'}),'尚无有效检测报告');
    const report = status => [{stale:false,report:{steps:[{level:'L2',status,executed:true}]}}];
    assert.equal(status.sourceBadgeLabel({...base('a'),checkReports:report('pass')}),'检测通过');
    assert.equal(status.sourceBadgeLabel({...base('a'),checkReports:report('fail')}),'检测失败');
  }

  async function loginSession() {
    const { actualSourceManagementTypes } = await import('./lib/source-management-owner-probe.mjs');
    const { runtimeOwnerIdentityProbe } = await import('./lib/reader-runtime-admission-probe.mjs');
    let installed;
    const Runtime = runtimeOwnerIdentityProbe(() => installed);
    const { SourceHost } = actualSourceManagementTypes({ ReaderRuntimeOwner: Runtime, hilog: { info() {}, warn() {}, error() {} } });
    const tick = () => new Promise(resolve => setImmediate(resolve));
    const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
    const ruleDigest = 'b'.repeat(64);
    const traceId = 'login-check';
    const report = (denied, timeoutMs = 180000) => ({ version: 2, mode: 'search', traceId, ruleDigest,
      inputDigest: 'a'.repeat(64), executionOptions: { timeoutMs }, executionOptionsDigest: 'c'.repeat(64),
      steps: ['L1', 'L2', 'L3', 'L4', 'L5'].map((level, index) => ({
        level, requested: index < 2, executed: index < 2, durationMs: 0,
        status: index >= 2 ? 'not_requested' : index === 1 && denied ? 'fail' : 'pass',
        ...(index === 1 && denied ? { reason: 'network' } : {}),
      })) });
    const row = id => ({ ...base(id), loginUrl: `https://${id}.test/login`, enabledExplore: false, sourceVersion: ruleDigest,
      bookSource: { bookSourceType: 0, loginUrl: `https://${id}.test/login` } });
    function runtime(gate, completion) {
      const denied = completion === 'current-denied';
      const olderReport = report(true);
      olderReport.traceId = 'older-login-check';
      olderReport.steps[1].reason = '登录失效';
      return { rows: [row('a')], calls: [], logins: [], cookiesCleared: [], gate,
        reports: completion === 'current-clear' ?
          [{ report: olderReport, stale: false, checkedAtMs: 1 }] : [],
        supportsCoreCapability: capability => ['source.check.mode.v1', 'source.check.report.v2',
          'source.check.report.clear.v1'].includes(capability),
        takeSourceHttpDiagnostics: requestId => denied ? [{ sourceId: 'a', requestId, traceId,
          stage: 'L2', method: 'GET', url: 'https://a.test/search', statusCode: 401, durationMs: 1, timestampMs: 1 }] : [],
        async openSourceLogin(...args) { this.logins.push(args); await this.gate.promise; },
        async clearSourceCookieSession(id) { this.cookiesCleared.push(id); },
        async request(method, params, options = {}) {
          assert.notEqual(options.canDispatch?.(), false); assert.notEqual(options.canContinue?.(), false);
          this.calls.push({ method, params: structuredClone(params) });
          options.onDispatch?.();
          if (method === 'source.list') return { data: { sources: structuredClone(this.rows.map(source => ({
            ...source, checkReports: params.includeCheckReports ? this.reports : undefined,
          }))) } };
          if (method === 'source.check.report.clear') {
            this.beforeReportClear?.();
            const clearedCount = this.reports.length;
            this.reports = [];
            return { data: { sourceIds: params.sourceIds, clearedCount } };
          }
          if (method === 'source.update') {
            this.rows = this.rows.map(source => source.sourceId === params.sourceId ? { ...source, enabled: params.enabled } : source);
            return { data: { source: { enabled: params.enabled } } };
          }
          if (method === 'source.check.run') {
            const currentReport = report(denied, params.timeoutMs);
            this.reports = [{ report: currentReport, stale: false, checkedAtMs: Date.now() }];
            return { requestId: 71, data: { traceId, results: [{
              sourceId: params.sourceIds[0], available: !denied, levelsPassed: denied ? ['L1'] : ['L1', 'L2'], durationMs: 1,
              ...(denied ? { failureReason: 'L2: network' } : {}), report: currentReport,
              debugLogs: [{ state: 1, msg: 'fixture check completed', timestampMs: 1 }],
            }] } };
          }
          assert.fail(`Unexpected runtime I/O ${method}`);
        },
      };
    }
    function presentation(runtime, identity) {
      let current = true;
      const values = [], statuses = [], projections = [];
      const host = new SourceHost(value => values.push(structuredClone(value)),
        (kind, message) => statuses.push({ kind, message }), value => projections.push(structuredClone(value)));
      assert.equal(host.bindPresentation(runtime, identity, () => current), true);
      const acceptedOwner=host.orchestrator;
      return { host, identity, values, statuses, projections,
        retire() { current = false; host.detachPresentation(identity); },
        async settle() { await tick(); await acceptedOwner.operationChain; await tick(); },
        async open() { host.open(identity); await this.settle(); },
      };
    }
    for (const completion of ['current-resolve', 'current-denied', 'current-clear', 'single-disable',
      'batch-disable', 'ordinary-check', 'old-resolve', 'old-reject']) {
      const gate = deferred(), owner = runtime(gate, completion); installed = owner;
      const a = presentation(owner, `A:${completion}`); await a.open();
      if (completion === 'ordinary-check') {
        a.host.checkSource('a', a.identity);
        await a.settle();
        assert.equal(a.values.at(-1)[0].checkState, 'passed');
        assert.equal(a.values.at(-1)[0].loginState, 'unknown');
        assert.equal(owner.logins.length, 0);
        continue;
      }
      assert.equal(a.values.at(-1)[0].loginState, completion === 'current-clear' ? 'expired' : 'unknown');
      a.host.loginSource('a','https://a.test/login',a.identity);a.host.loginSource('a','https://a.test/login',a.identity);
      for (let i = 0; i < 100 && owner.logins.length === 0; i++) await tick();
      assert.equal(owner.logins.length,1);assert.deepEqual(owner.logins[0].slice(0,3),['a','https://a.test/login','a'],'one login captures the original source identity and intent');assert.equal(owner.logins[0][3](),true,'native login receives the current task identity guard');
      if (!completion.startsWith('old-')) {
        gate.resolve(); await a.settle();
        assert.equal(owner.calls.filter(call => call.method === 'source.check.run').length, 1);
        const params = owner.calls.find(call => call.method === 'source.check.run').params;
        assert.deepEqual([params.sourceIds, params.mode, params.levels], [['a'], 'search', ['L1', 'L2']]);
        const value = a.values.at(-1).find(value => value.sourceId === 'a');
        const denied = completion === 'current-denied';
        assert.equal(value.checkState, denied ? 'failed' : 'passed');
        assert.equal(value.checkReports[0].report.traceId, traceId);
        assert.equal(value.loginState, denied ? 'expired' : 'verified');
        owner.beforeReportClear = () => {
          const projected = a.values.at(-1).find(source => source.sourceId === 'a');
          assert.equal(projected.loginState, 'unknown', 'clear publishes the reset before Core report cleanup');
          assert.deepEqual(projected.checkReports, []);
        };
        if (completion === 'current-clear') {
          owner.gate = deferred();
          a.host.loginSource('a', 'https://a.test/login', a.identity);
          for (let i = 0; i < 100 && owner.logins.length < 2; i++) await tick();
          assert.equal(await owner.logins[1][4](), true, 'current clear validates Core report deletion');
          owner.gate.reject(Object.assign(new Error('cancelled'), { code: 'CANCELLED' }));
          await a.settle();
          assert.equal(owner.calls.filter(call => call.method === 'source.check.run').length, 1, 'clear followed by cancel makes no new check');
        } else if (completion === 'single-disable' || completion === 'batch-disable') {
          if (completion === 'single-disable') a.host.toggleSource('a', false, a.identity);
          else a.host.toggleSources(['a'], false, a.identity);
          await a.settle();
          assert.deepEqual(owner.cookiesCleared, ['a']);
          assert.equal(a.values.at(-1)[0].enabled, false);
          a.host.toggleSource('a', true, a.identity);
          await a.settle();
          assert.equal(a.values.at(-1)[0].enabled, true);
        }
        if (['current-clear', 'single-disable', 'batch-disable'].includes(completion)) {
          assert.equal(owner.reports.length, 0);
          assert.equal(a.values.at(-1)[0].loginState, 'unknown');
          assert.deepEqual(a.values.at(-1)[0].checkReports, []);
          assert.equal(owner.calls.filter(call => call.method === 'source.check.report.clear').length, 1);
        }
      } else {
        a.retire(); owner.rows = [row('b')];
        const b = presentation(owner, `B:${completion}`);
        const before = structuredClone({ values: b.values, statuses: b.statuses, projections: b.projections });
        if (completion === 'old-reject') gate.reject(new Error('old platform login cancelled'));
        else gate.resolve();
        await b.settle();
        assert.equal(owner.calls.filter(call => call.method === 'source.check.run').length, 0, 'retired login result cannot dispatch a source check');
        assert.deepEqual({ values: b.values, statuses: b.statuses, projections: b.projections }, before, 'old completion/cancellation cannot publish into the successor presentation');
        await b.open();
        assert.deepEqual(b.values.at(-1).map(value => value.sourceId), ['b'], 'the successor performs its own current read');
        assert.ok(!b.values.at(-1).some(value => value.checkState === 'passed' || value.checkMessage === '登录 / 验证已取消'));
      }
    }
  }

  async function sharedPageShell() {
    const sourceUi = path => readFileSync(new URL('../entry/src/main/ets/features/source/ui/' + path, import.meta.url), 'utf8');
    const groups = sourceUi('SourceV9GroupsPage.ets');
    const transfer = sourceUi('SourceV9TransferPage.ets');
    const bar = /PageBackBar\(\{\s*floating: true, centered: true, elevation: 'floating'/g;
    for (const [source, count] of [[text, 2], [groups, 1], [transfer, 2]]) {
      assert.match(source, /ReaderPageScaffold\(\{/);
      assert.match(source, /applyReaderStandardFloatingHeader\(input\)/);
      assert.equal([...source.matchAll(bar)].length, count);
      assert.doesNotMatch(source, /SourceV9FlatHeader|Button\(['"]←/);
    }
    assert.match(text, /showBack: !this\.embeddedWide/);
    assert.match(text, /leadingActionLabel: '取消'/);
    assert.match(groups, /detailGroupId === undefined \? '分组管理' :/);
    assert.match(transfer, /title: '书源订阅'/);
    assert.match(transfer, /title: '导入书源'/);
    assert.match(transfer, /input\.footerBottom = readerFloatingBarBottomInset\(metrics, TRANSFER_BODY_TAIL\)/);

    const { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp } =
      await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
    const { actualSourceManagementGeometry } = await import('./lib/source-management-owner-probe.mjs');
    const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 1100, 800));
    metrics.systemInsets = new ReaderInsetsVp(24, 36, 12, 24);
    const geometry = actualSourceManagementGeometry(metrics);
    const transferFile = new URL('../entry/src/main/ets/features/source/ui/SourceV9TransferPage.ets', import.meta.url);
    const Transfer = selectedProductionMethods(transferFile, 'SourceV9TransferPage', ['refreshLayout'], {
      ...geometry, readerWindowMetrics: () => metrics, TRANSFER_MAX_WIDTH: 640, TRANSFER_BODY_TAIL: 12,
      TRANSFER_FOOTER_TOP: 8,
    });
    for (const pane of ['import', 'subscriptions']) {
      const owner = new Transfer();
      Object.assign(owner, { mounted: true, embeddedWide: true, paneX: 320, paneWidth: 420, paneHeight: 800,
        headerHeight: 52, footerHeight: 50, pane, footerButtonHeight: () => 44 });
      owner.refreshLayout();
      assert.equal(owner.geometry.content.frame.left, 19, 'pane is already clear of the window left inset');
      assert.ok(owner.geometry.content.startInset >= owner.headerHeight);
      assert.ok(owner.geometry.content.endInset >= geometry.readerFloatingBarBottomInset(metrics, 12) +
        (pane === 'import' ? 52 : 0));
    }
  }

  async function paneDialogGeometry() {
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } =
      await import('../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts');
    const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
    const { resolveDialogSpec } = readerSurfaceSpecsForProbe();
    const dialogFile = new URL('../entry/src/main/ets/ui/surfaces/ReaderDialogSurface.ets', import.meta.url);
    const Surface = selectedProductionMethods(dialogFile, 'ReaderDialogSurface',
      ['spec', 'resolvedFrame', 'frameWidth', 'fixedActionWidth'], {
        resolveDialogSpec, SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame,
        readerWindowMetrics: () => ({ windowRect: { width: 1100 } }),
        readerInteractiveSafeLeft: () => 22, readerInteractiveSafeRight: () => 12,
      });
    const dialog = new Surface();
    Object.assign(dialog, { specId: 'source-v9-check', readerWindowMetricsRevision: 0, leadingActionWidthVp: 80,
      actions: [{ id: 'cancel' }, { id: 'apply' }] });
    for (const paneWidth of [220, 320, 420, 600]) {
      dialog.containerWidthVp = paneWidth;
      assert.equal(dialog.frameWidth(), Math.min(460, paneWidth - 28));
      assert.equal(dialog.fixedActionWidth('cancel'), Math.min(80, dialog.frameWidth() / 3));
      assert.equal(dialog.fixedActionWidth('apply'), undefined);
    }
    dialog.containerWidthVp = 0;
    assert.equal(dialog.frameWidth(), 460);
    for (const [scheme, primary, pass, card] of [
      ['day', '#FF1F3D31', '#247551', '#FFFBF8F2'],
      ['night', '#FF7BB094', '#3FA374', '#FF1F2320'],
    ]) {
      assert.equal(readerAppColor(dialog.spec().actionPrimarySurfaceRole, scheme), primary);
      assert.equal(v9.sourceV9ReportFill('content', scheme), pass);
      assert.equal(readerAppColor(dialog.spec().backgroundRole, scheme), card);
    }
  }

  async function footerGeometry() {
    const {actualSourceManagementGeometry}=await import('./lib/source-management-owner-probe.mjs');
    const context={...actualSourceManagementGeometry(),...v9};
    const Page=selectedProductionMethods(file,'SourceManagementPage',['refreshGeometry','scrollLayout'],context);
    const page=new Page(),reads=[];
    Object.assign(page,{mounted:true,viewportWidth:366,viewportHeight:844,measurementKey:17,footerMeasurementKey:17,measurementRevision:7,
      footerFallbackHeight:()=>48,observeVerificationGeometry(){},measurements:{readForGeneration(key,generation){reads.push([key,generation]);return key==='source:header'?61:93;}}});
    page.refreshGeometry();
    assert.equal(page.geometry.footer.height,93);assert.equal(page.geometry.content.endInset,93);
    assert.equal(readerScrollEndOffset(page.scrollLayout()),93);
    assert.deepEqual(new Set(reads.map(([key])=>key)),new Set(['source:header','source:footer']));
    assert.ok(reads.every(([,generation])=>generation===17),'head and footer read only this layout generation');
    assert.ok(page.geometry.revision>=7,'current measurement revision reaches the unique resolver');
  }

  const cases = { 'filter-projection': projection, 'list-state': listState, 'login-status': loginStatus, 'login-session': loginSession, 'action-admission': actionAdmission, 'shared-page-shell': sharedPageShell, 'pane-dialog-geometry': paneDialogGeometry, 'footer-geometry': footerGeometry };
  for (const id of selected) { await cases[id](); recordContractCasePass(id); }
}

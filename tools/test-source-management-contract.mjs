import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'filter-projection': 'Actual page methods: trim, checking membership, clear four filters and filtered enabled statistics; no transport.',
  'list-state': 'SDK-lowered sourceList and real PageState: filtered/empty/error/loading/recovery priority and native end-offset forwarding.',
  'login-status': 'SDK-lowered login/status carriers with actual ReaderButton admission and badge label; no native focus or pixels.',
  'login-session': 'Actual SourceHost/Orchestrator/Gateway: current login checks once; old-session resolve/reject cannot check or project into a successor presentation.',
  'action-admission': 'Actual SDK write-toggle admission and independent diagnostic admission: blocked/unknown permitted; checking/stale presentation/removed entity/unmounted denied. No native or full source-version result proof.',
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
  const methods = names => selectedProductionMethods(file, 'SourceManagementPage', names, { sourceManagementFilterKey });

  async function projection() {
    const Page = methods(['normalizedSourceGroup', 'groupOptions', 'filteredSources', 'matchesStatus', 'rebuildSourceProjection', 'clearFilters', 'filteredEnabledCount', 'statsText', 'currentFilterKey']);
    const page = new Page();
    let replaced;
    Object.assign(page, { sources: [{ ...base('a'), group: ' 玄幻 ' }, { ...base('b'), group: '玄幻', enabled: false, checkState: 'checking' }, { ...base('c'), group: '', checkState: 'passed' }],
      lastProjectionFilterKey:'', scheduleSourceAnchorRestore(){}, searchQuery: '', statusValue: '全部', categoryValue: 'all', groupValue: '玄幻',
      sourceDataSource: { replace: value => { replaced = value; } }, onRetryLoad() { assert.fail('local filters must not dispatch reads'); } });
    assert.deepEqual(page.groupOptions(), ['全部分组', '玄幻']);
    page.rebuildSourceProjection();
    assert.deepEqual(replaced.map(s => s.sourceId), ['a', 'b'], 'option trim and comparison share the actual normalizer');
    assert.match(page.statsText(), /显示 2\/3 个书源 · 1 个启用/);
    page.statusValue = '未检测'; page.groupValue = '全部分组'; page.rebuildSourceProjection();
    assert.deepEqual(replaced.map(s => s.sourceId), ['a', 'b'], 'checking stays in the not-yet-complete filter');
    page.searchQuery = 'no-match'; page.rebuildSourceProjection();
    assert.match(page.statsText(), /显示 0\/3 个书源 · 0 个启用/);
    page.categoryValue = 'comic'; page.groupValue = 'missing'; page.clearFilters();
    assert.deepEqual([page.searchQuery, page.statusValue, page.categoryValue, page.groupValue], ['', '全部', 'all', '全部分组']);
    assert.equal(replaced.length, 3); assert.match(page.statsText(), /3 个书源 · 2 个启用/);
    page.sources = []; assert.deepEqual(page.groupOptions(), ['全部分组'], 'no hidden catalog prop remains');
  }

  async function listState() {
    const sdk = boundedSurfaceSdk();
    function render({ sources = [base('a')], statusKind = 'idle', operation = {} } = {}) {
      let clears = 0;
      const page = sdk.consumer(text, ['sourceList'], { readerScrollStartOffset, readerScrollEndOffset,
        ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} } });
      Object.assign(page, { sources, projectedSources: [], statusKind, statusMessage: '', operation,
        sourceDataSource: { totalCount: () => 0 }, sourceRow() {}, searchField() {}, statsRow() {}, statusAction() {}, filterArea() {}, categoryFilter() {},
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
    for (const input of [{ statusKind: 'loading' }, { operation: { original: { blocked: true } } }, { operation: { receipt: { receipt: { confirmation: 'unknown' } } } }]) {
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
    const { READER_FEEDBACK_EXTENDED_MS } = await import('../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts');
    const Feedback = selectedProductionMethods(file, 'SourceManagementPage', ['onMessageChanged', 'feedbackIdentity'], { READER_FEEDBACK_EXTENDED_MS });
    const feedback = new Feedback(), messages = [];
    Object.assign(feedback, { mounted: true, sources: [base('a')], projectedSources: [], statusKind: 'error', statusMessage: '刷新失败，保留旧书源',
      operation: { readFacts: { fact: 'failed', generation: 4 } }, lastFeedbackIdentity: '', lastToastMessage: '',
      scheduleSourceAnchorRestore(){}, recovery: () => ({ visible: false, message: '' }), getUIContext: () => ({}),
      transientFeedback: { show(_context, notice, current) { assert.equal(current(), true); messages.push(notice.message); } } });
    feedback.onMessageChanged(); feedback.onMessageChanged();
    assert.deepEqual(messages, ['刷新失败，保留旧书源'], 'available old content failure is one transient fact, independently of the local filtered-empty projection');
  }

  async function actionAdmission() {
    const { toggleSource, switchSpecs } = await import('./lib/reader-switch-control-probe.mjs');
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
    const switchControls = () => {
      const properties=createArkUIPropertyRuntimeProbe();
      const dependencies={...properties.sdk,...switchSpecs(),readerAppColor,DEBUG:false,hilog:{info(){}}};
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
      Object.assign(page, { mounted: true, appForeground:true, temporaryBackIdentity: 'action-admission', onToggleSource: (_id, next) => calls.push(next) });
      page.sourceSwitch(false, next => page.onToggleSource('a', next), 'a');
      const actor = [...page.children.values()].find(c => c instanceof controls.toggle.Component);
      assert.ok(actor); const change = controls.nodes(actor).find(n => n.type==='Toggle' && n.onChange)?.onChange; assert.ok(change);
      change(true);
      if (expected === 0) change(true);
      assert.equal(calls.length, expected, 'actual shared toggle refuses busy/blocked/unknown/refreshing callbacks');
    }
    const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
    for (const [checkState, blocked, unknown, expected] of [['unchecked', false, false, 1], ['checking', false, false, 0], ['unchecked', true, false, 1], ['unchecked', false, true, 1], ['unchecked', true, true, 1]]) {
      const controls = foundationControls(), page = createReaderBuilderProbe(text, ['detectButton','sourceDetectEnabled','sourceActionLabel','sourceRowCommand','sourceRowIsCurrent','sourceRenderKey','managementBackIsCurrent','managementOpeningIsCurrent'], controls.dependencies, controls.hooks).owner;
      let calls = 0;
      Object.assign(page, { mounted: true, appForeground:true, temporaryBackIdentity: 'detect-admission', sources: [{...base('a'),checkState}], appThemeScheme: 'day', operation: { original: { blocked }, receipt: { receipt: { confirmation: unknown ? 'unknown' : 'confirmed' } } }, onDetectSource: () => calls++ });
      page.projectedSources=page.sources.slice();
      page.detectButton({ ...base('a'), checkState });
      const actor = [...page.children.values()].find(c => c instanceof controls.button.Component);
      assert.ok(actor); assert.equal(actor.isBusy, checkState === 'checking');
      const click = controls.nodes(actor).find(n => n.onClick)?.onClick; assert.ok(click); click();
      if (checkState === 'checking') click();
      assert.equal(actor.actionEnabled, checkState !== 'checking');
      assert.equal(calls, expected, 'diagnostic admission intentionally ignores pending source-write blocked/unknown');
    }
    for (const retire of ['checking', 'removed', 'unmounted', 'presentation']) {
      const controls = foundationControls(), page = createReaderBuilderProbe(text, ['detectButton','sourceDetectEnabled','sourceActionLabel','sourceRowCommand','sourceRowIsCurrent','sourceRenderKey','managementBackIsCurrent','managementOpeningIsCurrent'], controls.dependencies, controls.hooks).owner;
      let calls = 0;
      Object.assign(page, { mounted: true, appForeground:true, temporaryBackIdentity: 'detect-old', sources: [base('a')], appThemeScheme: 'day', onDetectSource: () => calls++ });
      page.projectedSources=page.sources.slice();
      page.detectButton(base('a'));
      const actor = [...page.children.values()].find(c => c instanceof controls.button.Component);
      const click = controls.nodes(actor).find(n => n.onClick)?.onClick; assert.ok(click);
      if (retire === 'checking') page.sources = [{...base('a'),checkState:'checking'}];
      if (retire === 'removed') page.sources = [];
      if (retire === 'unmounted') page.mounted = false;
      if (retire === 'presentation') page.temporaryBackIdentity = 'detect-successor';
      click();
      assert.equal(calls, 0, `captured diagnostic callback refuses ${retire} even before a button rerender`);
    }
  }

  async function loginStatus() {
    const sdk = boundedSurfaceSdk();
    const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
    const controls = foundationControls();
    const BadgeSource = readFileSync(new URL('../entry/src/main/ets/ui/controls/StatusBadge.ets', import.meta.url), 'utf8');
    const Badge = createReaderBuilderProbe(BadgeSource, boundedMembers(BadgeSource), {...sdk.deps,uiContext:{vp2px:value=>value},LineJoinStyle:{Round:'LineJoinStyle.Round'}}, sdk.hooks).Component;
    const deps = { ...sdk.deps, ...controls.dependencies, StatusBadge: Badge };
    const hooks = { ...sdk.hooks, ...controls.hooks, childSources: { ...sdk.hooks.childSources, ...controls.hooks.childSources, StatusBadge: BadgeSource } };
    const rowMethods=['sourceRowCommand','sourceRowIsCurrent','sourceRenderKey','managementBackIsCurrent','managementOpeningIsCurrent'];
    for (const [checkState, blocked, unknown, expected] of [['unchecked', false, false, 1], ['checking', false, false, 0], ['unchecked', true, false, 0], ['unchecked', false, true, 0]]) {
      let calls = 0;
      const page = createReaderBuilderProbe(text, ['loginButton', 'sourceActionEnabled', 'sourceActionLabel',...rowMethods], deps, hooks).owner;
      const source={...base('a'),loginUrl:'https://a.test/login',checkState};
      Object.assign(page, { mounted:true, appForeground:true, temporaryBackIdentity:'login-sdk',sources:[source],projectedSources:[source],appThemeScheme:'day',
        operation:{original:{blocked},receipt:{receipt:{confirmation:unknown?'unknown':'confirmed'}}},onLoginSource:()=>calls++ });
      page.loginButton(source);
      const button = [...page.children.values()].find(c => c instanceof controls.button.Component);
      assert.ok(button); assert.equal(button.isBusy, checkState === 'checking');
      const click = controls.nodes(button).find(n => n.onClick)?.onClick; assert.ok(click); click();
      assert.equal(calls, expected, 'actual native ReaderButton commit obeys forwarded admission');
    }
    const Status = methods(['sourceBadgeLabel','sourceBadgeStatus']); const status = new Status();
    for (const [checkState, expected] of [['checking','检查中'],['passed','检查通过'],['failed','检查失败'],['unchecked','未检查']]) {
      const source={...base('a'),checkState};
      assert.equal(status.sourceBadgeLabel(source),expected);
      const page=createReaderBuilderProbe(text,['statusBadge','sourceBadgeLabel','sourceBadgeStatus'],deps,hooks).owner;
      page.statusBadge(source);
      const badge=[...page.children.values()].find(child=>child instanceof Badge);
      assert.ok(badge);assert.equal(badge.label,expected);
      const names=[...badge.nodes.values()].map(node=>node.accessibilityText).filter(Boolean);
      assert.ok(names.includes(expected),'actual semantic badge exposes the state label');
    }
  }

  async function loginSession() {
    const { actualSourceManagementTypes } = await import('./lib/source-management-owner-probe.mjs');
    const { runtimeOwnerIdentityProbe } = await import('./lib/reader-runtime-admission-probe.mjs');
    let installed;
    const Runtime = runtimeOwnerIdentityProbe(() => installed);
    const { SourceHost } = actualSourceManagementTypes({ ReaderRuntimeOwner: Runtime, hilog: { info() {}, warn() {}, error() {} } });
    const tick = () => new Promise(resolve => setImmediate(resolve));
    const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
    const row = id => ({ ...base(id), loginUrl: `https://${id}.test/login`, enabledExplore: false,
      bookSource: { bookSourceType: 0, loginUrl: `https://${id}.test/login` } });
    function runtime(gate) {
      return { rows: [row('a')], calls: [], logins: [],
        supportsCoreCapability: capability => capability === 'source.check.mode.v1', takeSourceHttpDiagnostics: () => [],
        async openSourceLogin(...args) { this.logins.push(args); await gate.promise; },
        async request(method, params, options = {}) {
          assert.notEqual(options.canDispatch?.(), false); assert.notEqual(options.canContinue?.(), false);
          this.calls.push({ method, params: structuredClone(params) });
          if (method === 'source.list') return { data: { sources: structuredClone(this.rows) } };
          if (method === 'source.check.run') return { requestId: 71, data: { traceId: 'login-check', results: [{
            sourceId: params.sourceIds[0], available: true, levelsPassed: ['L1', 'L2'], durationMs: 1,
            debugLogs: [{ state: 1, msg: 'fixture check completed', timestampMs: 1 }],
          }] } };
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
    for (const completion of ['current-resolve', 'old-resolve', 'old-reject']) {
      const gate = deferred(), owner = runtime(gate); installed = owner;
      const a = presentation(owner, `A:${completion}`); await a.open();
      a.host.loginSource('a','https://a.test/login',a.identity);a.host.loginSource('a','https://a.test/login',a.identity);
      for (let i = 0; i < 100 && owner.logins.length === 0; i++) await tick();
      assert.equal(owner.logins.length,1);assert.deepEqual(owner.logins[0].slice(0,3),['a','https://a.test/login','a'],'one login captures the original source identity and intent');assert.equal(owner.logins[0][3](),true,'native login receives the current task identity guard');
      if (completion === 'current-resolve') {
        gate.resolve(); await a.settle();
        assert.equal(owner.calls.filter(call => call.method === 'source.check.run').length, 1);
        assert.deepEqual(owner.calls.find(call => call.method === 'source.check.run').params.sourceIds, ['a']);
        assert.equal(a.values.at(-1).find(value => value.sourceId === 'a').checkState, 'passed', 'real gateway validation and owner projection complete for the current session');
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

  async function footerGeometry() {
    const {actualSourceManagementGeometry}=await import('./lib/source-management-owner-probe.mjs');
    const context=actualSourceManagementGeometry();
    const Page=selectedProductionMethods(file,'SourceManagementPage',['refreshGeometry','scrollLayout'],context);
    const page=new Page(),reads=[];
    Object.assign(page,{mounted:true,viewportWidth:366,viewportHeight:844,measurementKey:17,measurementRevision:7,
      footerFallbackHeight:()=>48,measurements:{readForGeneration(key,generation){reads.push([key,generation]);return key==='source:header'?61:93;}}});
    page.refreshGeometry();
    assert.equal(page.geometry.footer.height,93);assert.equal(page.geometry.content.endInset,93);
    assert.equal(readerScrollEndOffset(page.scrollLayout()),93);
    assert.deepEqual(new Set(reads.map(([key])=>key)),new Set(['source:header','source:footer']));
    assert.ok(reads.every(([,generation])=>generation===17),'head and footer read only this layout generation');
    assert.ok(page.geometry.revision>=7,'current measurement revision reaches the unique resolver');
  }

  const cases = { 'filter-projection': projection, 'list-state': listState, 'login-status': loginStatus, 'login-session': loginSession, 'action-admission': actionAdmission, 'footer-geometry': footerGeometry };
  for (const id of selected) { await cases[id](); recordContractCasePass(id); }
}

import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  specs: { description: '实际字体和按钮规格、生产modifier最小高度增长与禁用响应', resources: [] },
  'filter-font-budget': { description: '320/366四字号的搜索/保留书源筛选/分组目标真实SDK父布局、无封顶文字、换行与footer原生测量回执预算；非字形/设备验收', resources: [] },
  chrome: { description: '实际sheet helper的窄屏/安全区/主题/外框角色', resources: [] },
  controls: { description: '实际SDK共享trigger/group/footer布局与回调准入', resources: [] },
  'host-wiring': { description: '七宿主实际options/宽度方法统一外框，More/Book关闭独立于业务分发', resources: [] },
  'source-menu-row': { description: '仅保留组件独立测试，当前书源页已撤接线；真实SDK整行菜单与退出后动作准入', resources: [] },
  'source-panel': { description: '仅保留组件独立测试，当前书源页已撤接线；draft/关闭/重置/应用及footer/row', resources: [] },
  'search-draft': { description: '实际搜索草稿状态机、opening/step拒旧、分组有效性与唯一apply', resources: [] },
  'filter-focus-lifetime': { description: '真实生产帧与native onAppear焦点准入，SDK150001/2/3安全失败及未知异常暴露', resources: [] },
  'filter-sheet-exit': { description: '真实SDK保留退出中slots，native closed一次且销毁后拒绝读取Prop', resources: [] },
  'group-row-layout': { description: '真实SDK文字独占intrinsic测量，原生绘制marker按实际bounds且不参与命中', resources: [] },
};
const selected=selectContractCases(definitions);
if(selected.length){
  const {registerHooks}=await import('node:module'),{existsSync}=await import('node:fs'),{fileURLToPath}=await import('node:url');
  const productionRoot=new URL('../entry/src/main/ets/',import.meta.url).href;
  const resolver=registerHooks({resolve(specifier,context,next){if(context.parentURL?.startsWith(productionRoot)&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier)){
    const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(fileURLToPath(url)))return next(url.href,context);
  }return next(specifier,context);}});
  try {
for (const id of selected) {
  // Each selected case mounts an independent SDK compilation unit. The SDK
  // keeps literal component IDs in a process-wide map, including locations in
  // the finite virtual file. Different selected member sets move those lines;
  // retaining a previous case's entries falsely reports a duplicate in the
  // next one. Scope that compilation registry at the case boundary only. The
  // unmodified SDK diagnostics still reject duplicate IDs within each case.
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { root: sdk, require } = installedEtsCompiler();
  const ids = require(sdk + '/lib/component_map.js').ID_ATTRS;
  const savedIds = new Map(ids);
  ids.clear();
  try { await runSelectedCase(id); }
  finally {
    ids.clear();
    for (const [key, value] of savedIds) ids.set(key, value);
  }
  recordContractCasePass(id);
}

  }finally{resolver.deregister();}
}

async function runSelectedCase(id) {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
  const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
  const {createEtsBuilderProbe,builderComponentMembers}=await import('./lib/ets-builder-probe.mjs');
  const {readerTypographyRoles:actualTypography}=await import('./lib/reader-typography-probe.mjs');
  const {searchFilterSdkDeclarations}=await import('./lib/search-sheet-sdk-probe.mjs');
  const {ts,options}=installedEtsCompiler();
  function parse(source,name='FilterBoundary.ets'){const tree=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[]);return tree;}
  const visit=(node,predicate)=>{const values=[];function walk(n){if(predicate(n))values.push(n);ts.forEachChild(n,walk);}walk(node);return values;};
  function filterBuilder(source,names,dependencies={},hooks={}){return createEtsBuilderProbe(source,names,{...actualTypography,...dependencies},hooks);}
  const common = name => new URL(`../entry/src/main/ets/features/common/${name}.ets`, import.meta.url);
  const read = name => readFileSync(common(name), 'utf8');
  async function markerRuntime(source) {
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const roles = JSON.parse(readFileSync(new URL('../../Reader-UI/theme/registry.json', import.meta.url), 'utf8')).appRoles;
    const colors = new Map(['day', 'night'].map(scheme => {
      const value = roles.TOK_GREEN[scheme];
      return [readerAppColor('TOK_GREEN', scheme), { alpha: Math.round(value.a * 255), red: value.r, green: value.g, blue: value.b }];
    }));
    const calls = [];
    class Brush { setColor(value) { this.color = value; } setAntiAlias(value) { this.antiAlias = value; } }
    class RoundRect { constructor(rect, radiusX, radiusY) { Object.assign(this, { rect, radiusX, radiusY }); } }
    const tree=parse(source),classes=tree.statements.filter(ts.isClassDeclaration);
    const actual=pureModuleProbe(classes.map(node=>node.getText(tree)).join('\n'),'ReaderFilterSelectionMarker.ets',{
      DrawModifier: class {}, ColorMetrics: { resourceColor: value => colors.get(value) }, drawing: { Brush, RoundRect }, readerAppColor,
    }, ['ReaderFilterSelectionMarker']);
    const canvas = { attachBrush: brush => calls.push(['brush', brush]), drawRoundRect: rect => calls.push(['roundRect', rect]),
      detachBrush: () => calls.push(['detach']) };
    return { ...actual, calls, canvas, colors };
  }

  if (id === 'specs') {
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { foundationSpecs, foundationModifiers, foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
    const type = readerTypographyRoles.TYPE_FILTER_ACTION;
    assert.deepEqual([type.fontFamily, type.fontWeight, type.fontSizeFp, type.lineHeightFp],
      ['ReaderNotoSansSCUIMedium', 500, 14, 21]);
    const specs = foundationSpecs();
    const spec = specs.resolveReaderButtonSpec('filter-action');
    assert.deepEqual([spec.height, spec.radius, spec.maxLines, spec.centerText, spec.responseHeight, spec.responseOffset],
      [42, 8, 1, true, 44, -1]);
    assert.deepEqual([spec.primarySurface, spec.primaryBorder, spec.primaryText,
      spec.secondarySurface, spec.secondaryBorder, spec.secondaryText, spec.disabledOpacity],
    ['TOK_PRIMARY_DARK', 'TOK_PRIMARY_DARK', 'TOK_ON_PRIMARY', 'TOK_SURFACE_PANEL_SOFT', 'TOK_BORDER', 'TOK_PRIMARY_TEXT', .62]);
    const { ReaderButtonFrameModifier } = foundationModifiers(specs);
    for (const scale of [1, 1.3, 1.6, 2]) {
      const calls = {};
      const native = new Proxy({}, { get: (_target, key) => (...args) => { calls[key] = args.length === 1 ? args[0] : args; return native; } });
      new ReaderButtonFrameModifier('filter-action', true, false, 'equal', 'night', false, 0, scale).applyNormalAttribute(native);
      assert.deepEqual(calls.constraintSize, { minHeight: Math.ceil(42 + 21 * (scale - 1)) });
      assert.equal(calls.height, undefined, 'filter action authors a minimum rather than fixed height');
      assert.equal(calls.opacity, .62);
      assert.equal(calls.responseRegion.height, Math.ceil(44 + 21 * (scale - 1)));
      assert.equal(calls.backgroundColor, readerAppColor('TOK_PRIMARY_DARK', 'night'));
    }
    const option = specs.resolveReaderButtonSpec('source-filter-option');
    assert.equal(option.maxFontScale, undefined, 'shared option has no private system-font ceiling');
    for (const scale of [1, 1.3, 1.6, 2]) {
      const controls = foundationControls({ windowMetrics: () => ({ systemFontScale: scale }) });
      for (const label of ['全部', '很长的书源分组名称允许原生换行而不缩小文字']) {
        const choice = new controls.button.Component(undefined, { specId: 'source-filter-option', label, layout: 'full' });
        choice.aboutToAppear(); choice.initialRender();
        const choiceLabel = controls.nodes(choice).find(node => node.type === 'Text' && node.create === label);
        assert.equal(choiceLabel.maxFontScale, scale, 'actual shared option propagates each current system font scale');
        assert.equal(choiceLabel.fontSize, option.text.fontSizeFp, 'growth preserves the declared font role');
        assert.deepEqual(choiceLabel.constraintSize, { minHeight: Math.ceil(option.height + option.text.lineHeightFp * (scale - 1)) });
        assert.equal(choiceLabel.height, undefined, 'growing option authors a minimum, never a fixed text height');
        assert.equal(choiceLabel.maxLines, undefined, 'long option remains available to native multiline layout');
      }
    }
    const liveMetrics = { systemFontScale: 1 };
    const liveControls = foundationControls({ windowMetrics: () => liveMetrics });
    const retainedChoice = new liveControls.button.Component(undefined,
      { specId: 'source-filter-option', label: '保留同一筛选选项', layout: 'full' });
    retainedChoice.aboutToAppear(); retainedChoice.initialRender();
    const initialLabel = liveControls.nodes(retainedChoice).find(node => node.type === 'Text');
    const initialNodeCount = retainedChoice.nodes.size;
    assert.equal(initialLabel.maxFontScale, 1);
    liveMetrics.systemFontScale = 2;
    retainedChoice.readerWindowMetricsRevision += 1;
    liveControls.flush(retainedChoice);
    const updatedLabel = liveControls.nodes(retainedChoice).find(node => node.type === 'Text');
    assert.equal(updatedLabel, initialLabel, 'window revision updates the existing SDK text carrier');
    assert.equal(retainedChoice.nodes.size, initialNodeCount, 'live scale growth does not remount the option');
    assert.equal(updatedLabel.maxFontScale, 2);
    assert.deepEqual(updatedLabel.constraintSize, { minHeight: 65 });


  }

  if (id === 'filter-font-budget') {
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const geometry = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
    const model = await import('../entry/src/main/ets/features/source/SourceManagementPresentation.ts');
    const searchGroups = await import('../entry/src/main/ets/features/search/SearchSourceGroups.ts');
    const { ReaderMeasurementStore } = await import('../entry/src/main/ets/features/common/ReaderMeasurements.ts');
    const sizing = pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts', import.meta.url), 'utf8'),
      'ReaderSurfaceResolvers.ts', {}, ['readerReadableFontScale', 'readerScaledControlHeight']);
    const { readerSheetBodyBudget } = pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSurfaceBudgets.ts', import.meta.url), 'utf8'),
      'ReaderSurfaceBudgets.ts', {}, ['readerSheetBodyBudget']);
    const surface = readerSurfaceSpecsForProbe();
    const { readerSheetWidth } = pureModuleProbe(read('ReaderSheetChrome'), 'ReaderSheetChrome.ets',
      { ...geometry, ...surface, readerAppColor }, ['readerSheetWidth']);
    const panelSource = readFileSync(new URL('./fixtures/source-workflow/ReaderSourceFilterPanel.ets', import.meta.url), 'utf8');
    const groupSource = readFileSync(new URL('./fixtures/source-workflow/SourceGroupManagementPage.ets', import.meta.url), 'utf8');
    const searchSource = readFileSync(new URL('../entry/src/main/ets/features/search/ReaderSearchFilterPanel.ets', import.meta.url), 'utf8');
    const footerSource = read('ReaderFilterControls');
    const scales = [1, 1.3, 1.6, 2], records = [];
    for (const width of [320, 366]) for (const scale of scales) {
      const metrics = { systemFontScale: scale, windowRect: { width, height: 844 } };
      const safe = { top: 24, bottom: 20 };
      const controls = foundationControls({ windowMetrics: () => metrics });
      const deps = { ...controls.dependencies, ...readerTypographyRoles, ...surface, ...sizing, ...model, ...searchGroups, ReaderMeasurementStore,
        ReaderWindowCoordinator: { metrics: () => metrics }, readerSheetWidth, readerSheetBodyBudget, readerAppColor,
        readerVisualSafeLeft: () => 0, readerVisualSafeRight: () => 0, readerVisualSafeTop: () => safe.top,
        readerInteractiveSafeBottom: () => safe.bottom, readerVisualSafeBottom: () => safe.bottom, readerPageAreaLength: Number };
      const footer = filterBuilder(footerSource, builderComponentMembers(footerSource, 'ReaderFilterFooter'), deps,
        { ...controls.hooks, componentName: 'ReaderFilterFooter' });
      const hooks = { ...controls.hooks, childSources: { ...controls.hooks.childSources, ReaderFilterFooter: footerSource } };
      deps.ReaderFilterFooter = footer.Component;
      const panel = filterBuilder(panelSource,
        ['status', 'kind', 'statusChoices', 'typeChoices', 'otherCount', 'sheetWidth', 'sheetInnerWidth', 'readableFontScale',
          'statusColumns', 'statusChoiceWidth', 'typeChoiceWidth', 'footerFallback', 'bodyLimit', 'footerContents'], deps, hooks).owner;
      Object.assign(panel, { scheme: 'day', metricsRevision: 0, headerHeight: 0, footerHeight: 0, identity: 'source-font-budget',
        mounted: true, expanded: true, draft: model.defaultSourceManagementView(),
        sources: Array.from({ length: 3 }, (_, index) => ({ sourceId: String(index), category: 'music' })),
        accepts: identity => identity === 'source-font-budget', valid: () => true, count: () => 3,
        change() { assert.fail('render-only font budget never dispatches a business mutation'); } });
      panel.statusChoices(panel.identity); panel.typeChoices(panel.identity); panel.footerContents(panel.identity);
      const statusColumns = panel.statusColumns();
      assert.equal(statusColumns, scale === 1 || (scale === 1.3 && width === 366) ? 4 : 2,
        `retained Source status columns ${width}/${scale}`);
      const sourceButtons = [...panel.children.values()].filter(child => child instanceof controls.button.Component);
      assert.equal(sourceButtons.length, 8, 'actual status four + type three + other full-width choices remain mounted');
      const frameMinimum = Math.ceil(44 + 21 * (scale - 1));
      function assertGrowingOption(actor, label) {
        const text = controls.nodes(actor).find(node => node.type === 'Text' && node.create === label);
        assert.ok(text, label); assert.equal(text.maxFontScale, scale);
        assert.equal(text.height, undefined); assert.equal(text.maxLines, undefined);
        assert.deepEqual(text.constraintSize, { minHeight: frameMinimum });
        assert.equal(text.fontSize, readerTypographyRoles.TYPE_SOURCE_FILTER_OPTION.fontSizeFp);
      }
      for (const actor of sourceButtons) assertGrowingOption(actor, actor.label);
      const sourceColumns = [...panel.nodes.values()].filter(node => node.type === 'Column');
      for (const expected of [panel.statusChoiceWidth(), panel.typeChoiceWidth(), panel.sheetInnerWidth()]) {
        assert.ok(sourceColumns.some(node => node.width === expected && node.height === undefined),
          `actual Source two/four-column, three-column and full-width wrappers have no fixed height ${expected}`);
      }
      assert.ok(statusColumns * panel.statusChoiceWidth() + 8 * (statusColumns - 1) <= panel.sheetInnerWidth());
      assert.ok(3 * panel.typeChoiceWidth() + 16 <= panel.sheetInnerWidth());
      const sourceFooter = [...panel.children.values()].find(child => child instanceof footer.Component);
      assert.ok(sourceFooter); assert.equal(sourceFooter.hint, '将显示 3 个书源');
      const actionMinimum = Math.ceil(42 + 21 * (scale - 1));
      const hintBudget = readerTypographyRoles.TYPE_FORM_HINT.fontSizeFp * 1.5 * scale * 2;
      assert.ok(panel.footerFallback() >= 13 + 8 + hintBudget + actionMinimum,
        'Source fallback includes actual growing action, two-line hint allowance, top padding/border and gap');
      for (const actor of [...sourceFooter.children.values()].filter(child => child instanceof controls.button.Component)) {
        const text = controls.nodes(actor).find(node => node.type === 'Text' && node.create === actor.label);
        assert.deepEqual(text.constraintSize, { minHeight: actionMinimum });
        assert.equal(text.height, undefined); assert.equal(text.maxFontScale, scale);
      }
      const initialBody = panel.bodyLimit(); panel.footerHeight = 240;
      assert.ok(panel.bodyLimit() < initialBody, 'retained Source consumes actual measured footer instead of its fallback');
      const group = filterBuilder(groupSource, ['targetRow'], deps, hooks).owner;
      const longName = '这是一个保留完整字符且允许原生换行的很长书源目标分组名称';
      Object.assign(group, { scheme: 'day', writable: () => true,
        send() { assert.fail('font budget render cannot issue a target intent'); } });
      group.targetRow({ id: 'long', name: longName, count: 12345, selected: true });
      const target = [...group.children.values()].find(child => child instanceof controls.button.Component);
      assert.ok(target); assert.equal(target.layout, 'full'); assert.equal(target.actionEnabled, true);
      assertGrowingOption(target, `${longName} · 12345 个`);
      const targetText = controls.nodes(target).find(node => node.type === 'Text' && node.create === target.label);
      assert.equal(targetText.width, '100%', 'actual GroupManagement target is a full-width intrinsic-height option');
      // Notice/search child rendering is an explicit port here: this case
      // tests their actual parent measurement hosts, not those child pixels.
      class RenderedPart {
        constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
      }
      const searchDeps = { ...deps, ReaderPageState: RenderedPart, ReaderSearchField: RenderedPart, ReaderFilterGroupRow: RenderedPart };
      const searchHooks = { ...hooks, allowEmptyBranchAdmission: true, childSources: { ...hooks.childSources,
        ReaderPageState: read('ReaderPageState'), ReaderSearchField: read('ReaderSearchField'), ReaderFilterGroupRow: footerSource } };
      const searchNames = ['measurementRevision', 'measurements', 'appearedIdentity', 'choiceRows', 'groupValue',
        'sectionLabel', 'filterFooter', 'draftActive', 'draftSourceGroupLabel', 'accepts', 'acceptsAction',
        'systemFontScale', 'filterFontScale', 'sheetSpec', 'sheetWidth', 'headerHeight', 'filterActionHeight',
        'footerFallback', 'groupSheetHeight', 'groupListHeight', 'bodyHeightLimit', 'layoutSignature',
        'measurementGeneration', 'measuredHeight', 'partMeasurement', 'retainedMeasurementKeys', 'retainsActionIdentity', 'retainsPresentation', 'measurePart', 'headerMeasurement', 'metricsChanged',
        'groupsContent', 'matchingGroups'];
      let search = filterBuilder(searchSource, searchNames, searchDeps, searchHooks).owner;
      const selection = { kind: 'group', groupId: 'long-group', name: longName };
      const searchState = { scheme: 'day', metricsRevision: 0, mounted: true, expanded: true,
        presentationIdentity: 'search-font-budget', actionIdentity: 'search-font-budget:filter', step: 'filter',
        draftPresentationIdentity: 'search-font-budget', draftGroup: '在线', draftType: '漫画', draftValid: true,
        draftSourceGroup: selection, appliedSourceGroup: selection, appliedSourceGroupLabel: longName,
        sourceGroupOptions: [new searchGroups.SearchSourceGroupOption(selection, 12345)], hasGroupCatalog: true, groupLoadState: 'ready',
        draftGroupQuery: '',
        selectDraftType() { assert.fail('render-only font budget cannot select a search type'); },
        selectDraftGroup() { assert.fail('render-only font budget cannot select a search group'); } };
      Object.assign(search, searchState);
      search.choiceRows(true, search.actionIdentity); search.choiceRows(false, search.actionIdentity);
      search.groupValue(search.actionIdentity); search.filterFooter(search.actionIdentity);
      const searchOptions = [...search.children.values()].filter(child => child instanceof controls.button.Component);
      assert.equal(searchOptions.length, 6, 'actual SearchPanel type/source each retain three options');
      for (const actor of searchOptions) { assert.equal(actor.layout, 'equal'); assertGrowingOption(actor, actor.label); }
      const searchRows = [...search.nodes.values()].filter(node => node.type === 'Row' && node.create?.space === 8);
      assert.equal(searchRows.length, 2);
      assert.ok(searchRows.every(node => node.width === '100%' && node.height === undefined),
        'actual Search three-column parents grow from their children, with no fixed row height');
      const longGroup = [...search.nodes.values()].find(node => node.type === 'Text' && node.create === search.draftSourceGroupLabel());
      assert.ok(longGroup); assert.equal(longGroup.maxFontScale, scale); assert.equal(longGroup.height, undefined);
      const searchFooter = [...search.children.values()].find(child => child instanceof footer.Component);
      assert.ok(searchFooter); assert.equal(searchFooter.hint, '');
      assert.equal(search.filterActionHeight(), actionMinimum);
      assert.equal(search.footerFallback(), 13 + actionMinimum, 'Search valid fallback uses actual filter action growth');
      assert.ok(search.bodyHeightLimit() > 0);

      // An optional multiline hint has no invented height. Only a current
      // native area receipt can admit its body budget; no text-width simulator.
      const validOwner = search;
      const validFooterReceipt = [...validOwner.nodes.values()].filter(node => typeof node.onAreaChange === 'function').at(-1).onAreaChange;
      const validFooterKey = validOwner.layoutSignature('footer');
      search.draftValid = false;
      assert.equal(search.footerFallback(), -1); assert.equal(search.bodyHeightLimit(), 0);
      const revisionBeforeHint = validOwner.measurementRevision;
      validFooterReceipt({}, { height: 240 });
      assert.notEqual(validOwner.layoutSignature('footer'), validFooterKey);
      assert.equal(validOwner.measurementRevision, revisionBeforeHint, 'old no-hint callback rejects the current hinted layout key');
      // The finite recorder cannot remove a filled native If branch. Mount
      // each hint branch independently, while testing rejection at its real
      // original owner. This proves keys/receipts, not native reconciliation.
      const footerOnlyNames = searchNames.filter(name => !['choiceRows', 'groupValue', 'groupsContent'].includes(name));
      search = filterBuilder(searchSource, footerOnlyNames, searchDeps, searchHooks).owner;
      Object.assign(search, searchState, { draftValid: false });
      search.filterFooter(search.actionIdentity);
      const footerActors = () => [...search.children.values()].filter(child => child instanceof footer.Component);
      const areaNodes = () => [...search.nodes.values()].filter(node => typeof node.onAreaChange === 'function');
      assert.ok(footerActors().at(-1).hint.length > 0, 'actual hinted SDK footer is mounted independently');
      const waitingFooter = areaNodes().at(-1).onAreaChange;
      const beforeInvalid = search.measurementRevision;
      for (const height of [0, -1, NaN, Infinity, 'not-a-length']) waitingFooter({}, { height });
      assert.equal(search.measurementRevision, beforeInvalid); assert.equal(search.bodyHeightLimit(), 0);
      waitingFooter({}, { height: 240 });
      assert.equal(search.measuredHeight('footer'), 240); assert.ok(search.bodyHeightLimit() > 0);
      const sameShape = search.layoutSignature('footer'); search.metricsRevision += 1; search.metricsChanged();
      assert.equal(search.layoutSignature('footer'), sameShape);
      assert.equal(search.measuredHeight('footer'), 240,
        'a metrics notification without a real layout change retains native receipts; no new area event is required');
      let currentFooterReceipt = waitingFooter;
      // Each changed key gets an independent SDK Builder snapshot. The finite
      // recorder retains old observers and cannot reconcile their filled If
      // removal; never replay that retired tree to simulate native behavior.
      for (const [kind, change] of [
        ['width', () => { metrics.windowRect.width = width + 24; }],
        ['fontScale', () => { metrics.systemFontScale = scale + .25; }],
      ]) {
        const previous = currentFooterReceipt;
        const previousHeader = search.headerMeasurement(search.presentationIdentity);
        previousHeader({}, { height: 90 });
        const previousActor = footerActors().at(-1);
        const previousKey = search.layoutSignature('footer');
        const revision = search.measurementRevision;
        change();
        assert.notEqual(search.layoutSignature('footer'), previousKey);
        assert.equal(search.measuredHeight('footer'), 0, `${kind} invalidates the old footer layout key`);
        assert.equal(search.measuredHeight('header'), 0, `${kind} invalidates the old header layout key`);
        previousHeader({}, { height: 333 });
        previous({}, { height: 333 });
        assert.equal(search.measurementRevision, revision, `${kind} rejects old native geometry callbacks`);
        search.filterFooter(search.actionIdentity);
        assert.notEqual(footerActors().at(-1), previousActor, `${kind} independent SDK snapshot mounts the current keyed footer`);
        assert.ok([...search.keys.values()].some(keys => keys instanceof Set && keys.has(search.layoutSignature('footer'))),
          'actual SDK ForEach consumes the changed footer key');
        currentFooterReceipt = areaNodes().at(-1).onAreaChange;
        assert.notEqual(currentFooterReceipt, previous);
        currentFooterReceipt({}, { height: 240 });
        assert.equal(search.measuredHeight('footer'), 240);
        assert.ok(search.measurementRevision > revision, 'same native height on the new SDK host releases the waiting budget');
      }
      search.headerMeasurement(search.presentationIdentity)({}, { height: 90 });
      const hintedKey = search.layoutSignature('footer');
      const hintedRevision = search.measurementRevision;
      search.draftValid = true;
      assert.notEqual(search.layoutSignature('footer'), hintedKey);
      assert.equal(search.measuredHeight('footer'), 0);
      assert.equal(search.measuredHeight('header'), 90, 'footer-only content leaves the measured header valid');
      currentFooterReceipt({}, { height: 240 });
      assert.equal(search.measurementRevision, hintedRevision, 'old hinted callback rejects removal of the hint');
      search = filterBuilder(searchSource, footerOnlyNames, searchDeps, searchHooks).owner;
      Object.assign(search, searchState, { draftValid: true });
      search.filterFooter(search.actionIdentity);
      assert.equal(footerActors().at(-1).hint, '');
      assert.ok([...search.keys.values()].some(keys => keys instanceof Set && keys.has(search.layoutSignature('footer'))),
        'actual SDK ForEach consumes the no-hint layout key');
      areaNodes().at(-1).onAreaChange({}, { height: 240 });
      assert.equal(search.measuredHeight('footer'), 240, 'the independently mounted current hint branch accepts its native receipt');
      metrics.windowRect.width = width; metrics.systemFontScale = scale;
      search.step = 'groups';
      assert.equal(search.footerFallback(), 0, 'groups step has no filtering footer');
      // This recording seam does not model native If removal. Use a separate
      // current groups actor for its actual keyed notice host; retained step
      // identities/removal have their own existing consumer cases.
      search = filterBuilder(searchSource,
        searchNames.filter(name => !['choiceRows', 'groupValue', 'filterFooter'].includes(name)), searchDeps, searchHooks).owner;
      Object.assign(search, searchState, { step: 'groups', groupLoadState: 'error', sourceGroupOptions: [] });
      assert.equal(search.groupListHeight(), 0, 'unmeasured error notice cannot borrow an invented single-line height');
      const beforeNoticeNodes = new Set(areaNodes());
      search.groupsContent(search.actionIdentity);
      const noticeActors = () => [...search.children.values()].filter(child => child instanceof RenderedPart &&
        child.params.message === '分组更新失败，保留上次列表。');
      assert.equal(noticeActors().length, 1, 'actual groups Builder supplies its keyed notice child');
      const freshAreas = areaNodes().filter(node => !beforeNoticeNodes.has(node));
      let noticeReceipt;
      for (const node of freshAreas) {
        const before = search.measuredHeight('notice');
        node.onAreaChange({}, { height: 90 });
        if (before === 0 && search.measuredHeight('notice') === 90) noticeReceipt = node.onAreaChange;
      }
      assert.ok(noticeReceipt, 'a real SDK-emitted area callback owns the notice measurement');
      assert.ok(search.groupListHeight() > 0, 'a current native notice area resumes the groups body budget');
      const noticeKey = search.layoutSignature('notice');
      metrics.windowRect.height += 30; safe.top += 5; safe.bottom += 7;
      search.draftValid = !search.draftValid; search.hasGroupCatalog = false;
      assert.equal(search.layoutSignature('notice'), noticeKey, 'unrelated viewport, footer and catalog flags preserve the same notice shape');
      assert.equal(search.measuredHeight('notice'), 90, 'no extra native event is required for unrelated changes');
      search.hasGroupCatalog = true;
      const previousNoticeActor = noticeActors().at(-1);
      const beforeNoticeRekey = new Set(areaNodes());
      const beforeNoticeRevision = search.measurementRevision;
      metrics.windowRect.width = width + 16;
      assert.equal(search.measuredHeight('notice'), 0);
      noticeReceipt({}, { height: 90 });
      assert.equal(search.measurementRevision, beforeNoticeRevision, 'old notice callback rejects a changed text width');
      search.groupsContent(search.actionIdentity);
      assert.notEqual(noticeActors().at(-1), previousNoticeActor, 'current-width SDK snapshot includes a new keyed notice child');
      assert.ok([...search.keys.values()].some(keys => keys instanceof Set && keys.has(search.layoutSignature('notice'))),
        'actual SDK ForEach consumes the changed notice key');
      const rekeyedNoticeAreas = areaNodes().filter(node => !beforeNoticeRekey.has(node));
      let currentNoticeReceipt;
      for (const node of rekeyedNoticeAreas) {
        const before = search.measuredHeight('notice');
        node.onAreaChange({}, { height: 90 });
        if (before === 0 && search.measuredHeight('notice') === 90) currentNoticeReceipt = node.onAreaChange;
      }
      assert.ok(currentNoticeReceipt, 'independent current snapshot emits the notice area receiver');
      assert.notEqual(currentNoticeReceipt, noticeReceipt);
      assert.equal(search.measuredHeight('notice'), 90, 'same native height from a new notice host releases the body');
      assert.ok(search.groupListHeight() > 0);
      metrics.windowRect.width = width; metrics.windowRect.height = 844; metrics.systemFontScale = scale;
      safe.top = 24; safe.bottom = 20;
      records.push({ width, scale, sourceStatusColumns: statusColumns, sourceTypeColumns: 3, groupTarget: 'full-width',
        searchColumns: 3, optionMinimum: frameMinimum, footerFallback: panel.footerFallback(), searchValidFooter: 13 + actionMinimum });
    }
    console.log(JSON.stringify({ contract: 'filter font budget SDK parents', records,
      boundary: 'Independent current SDK Builder snapshots, actual ForEach keys and emitted Area callbacks; old-owner key rejection and same-height receipt recovery. Native ForEach/If reconciliation/removal, text wrapping/glyphs, system scaling and device acceptance remain separate.' }));
  }

  if (id === 'chrome') {
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const geometry = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
    const specs = readerSurfaceSpecsForProbe({ densityPixels: 2 });
    const helper = pureModuleProbe(read('ReaderSheetChrome'), 'ReaderSheetChrome.ets',
      { ...geometry, ...specs, readerAppColor }, ['readerSheetWidth', 'readerSheetChrome']);
    for (const specId of ['bookshelf-book-action', 'search-result-filter', 'search-task-status', 'source-management-filter', 'source-management-more']) {
      assert.equal(helper.readerSheetWidth(specId, 1000, 0, 0), 390);
      assert.equal(helper.readerSheetWidth(specId, 366, 7, 11), 348);
      assert.equal(helper.readerSheetWidth(specId, 20, 15, 15), 0);
      for (const scheme of ['day', 'night']) {
        const chrome = helper.readerSheetChrome(specId, scheme, 348);
        assert.deepEqual(chrome, { width: 348, backgroundColor: readerAppColor('app.bookshelf.sheetSurface', scheme),
          radius: { topLeft: 22, topRight: 22, bottomLeft: 0, bottomRight: 0 },
          maskColor: readerAppColor('TOK_SS_DRAWER_SCRIM', scheme), shadow: specs.readerSurfaceElevation('sheet', scheme),
          borderWidth: { top: 1 }, borderColor: readerAppColor('app.border.modalHighlight', scheme) });
      }
    }
    const tree=parse(read('ReaderSheetChrome'),'ReaderSheetChrome.ets');
    assert.ok(!tree.statements.filter(ts.isImportDeclaration).some(node=>/(?:^|\/)(?:search|source|bookshelf)\//.test(node.moduleSpecifier.text)),'chrome has no business page import');
  }

  if (id === 'controls') {
    const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { productionReaderPressFeedback } = await import('./lib/reader-press-feedback-probe.mjs');
    const source = read('ReaderFilterControls');
    const marker = await markerRuntime(source);
    function mount(name, params) {
      const foundation = foundationControls();
      const probe = filterBuilder(source, builderComponentMembers(source, name),
        { ...foundation.dependencies, ...readerTypographyRoles, readerAppColor, ReaderPressFeedback: productionReaderPressFeedback(), ...marker },
        { ...foundation.hooks, componentName: name, initialParams: params });
      probe.owner.getUIContext = () => ({ vp2px: value => value });
      probe.owner.aboutToAppear?.(); probe.owner.initialRender();
      return { owner: probe.owner, nodes: () => foundation.nodes(probe.owner), flush: () => foundation.flush(probe.owner) };
    }
    for (const scheme of ['day', 'night']) {
      for (const count of [0, 1, 3]) {
        let actions = 0;
        const p = mount('ReaderFilterTrigger', { scheme, count, expanded: true,
          actionAccessibilityLabel: '当前筛选条件', onAction: () => actions++ });
        const nodes = p.nodes(), trigger = nodes.find(n => n.type === 'Stack');
        assert.equal(trigger.width, 44); assert.equal(trigger.height, 44);
        assert.equal(trigger.accessibilityText, '当前筛选条件'); assert.equal(trigger.focusable, true);
        const image = nodes.find(n => n.type === 'Image'); assert.equal(image.width, 20); assert.equal(image.height, 20);
        const badge = nodes.find(n => n.type === 'Text');
        if (count === 0) assert.equal(badge, undefined);
        else {
          assert.equal(badge.create, String(count)); assert.deepEqual(badge.constraintSize, { minWidth: 16, minHeight: 16 });
          assert.deepEqual(badge.position, { top: 2, right: 2 }); assert.equal(badge.maxFontScale, 1.3);
          assert.equal(badge.backgroundColor, readerAppColor('TOK_GREEN', scheme));
          assert.equal(badge.fontColor, readerAppColor('TOK_ON_PRIMARY', scheme));
        }
        trigger.onClick(); assert.equal(actions, 1); p.owner.aboutToDisappear(); trigger.onClick(); assert.equal(actions, 1);
      }
      let selections = 0;
      const row = mount('ReaderFilterGroupRow', { scheme, label: '常用书源', count: 12, selected: true, onAction: () => selections++ });
      const outer = row.nodes().find(n => n.type === 'Stack');
      assert.deepEqual(outer.constraintSize, { minHeight: 60 }); assert.equal(outer.accessibilitySelected, true);
      assert.equal(outer.backgroundColor, readerAppColor('TOK_PRIMARY_SOFT', scheme));
      assert.ok(row.nodes().some(n => n.padding?.left === 14 && n.padding?.right === 14 && n.padding?.top === 11 && n.padding?.bottom === 11));
      assert.ok(outer.drawModifier instanceof marker.ReaderFilterSelectionMarker);
      assert.equal(row.nodes().some(n => n.width === 3 || n.height === 'calc(100% - 28vp)'), false,
        'selection decoration no longer contributes a percentage-height child');
      assert.ok(row.nodes().some(n => n.type === 'Text' && n.create === '匹配 12 个书源'));
      outer.onClick(); assert.equal(selections, 1);
      row.owner.updateStateVars({ scheme, label: '常用书源', count: 12, selected: false, actionEnabled: false }); row.flush();
      outer.onClick(); assert.equal(selections, 1, 'disabled retained group callback does not fire');
      assert.equal(outer.accessibilitySelected, false);
      row.owner.updateStateVars({ scheme, label: '常用书源', count: 12, selected: false, actionEnabled: true }); row.flush();
      row.owner.aboutToDisappear(); outer.onClick(); assert.equal(selections, 1, 'retired group callback does not fire');
      let resets = 0, applies = 0;
      const footer = mount('ReaderFilterFooter', { scheme, hint: '将显示 12 个书源', resetEnabled: false, applyEnabled: true,
        onReset: () => resets++, onApply: () => applies++ });
      const shell = footer.nodes().find(n => n.type === 'Column');
      assert.deepEqual(shell.padding, { left: 12, right: 12, top: 12, bottom: 0 });
      assert.deepEqual(shell.border, { width: { top: 1 }, color: readerAppColor('TOK_ROW_DIVIDER', scheme) });
      const reset = footer.nodes().find(n => n.type === 'Text' && n.create === '重置');
      const apply = footer.nodes().find(n => n.type === 'Text' && n.create === '应用筛选');
      reset.onClick(); apply.onClick(); assert.equal(resets, 0); assert.equal(applies, 1);
      assert.deepEqual(apply.constraintSize, { minHeight: 42 });
      footer.owner.updateStateVars({ scheme, hint: '原书源分组已删除，请重新选择或重置。', hintTone: 'danger', resetEnabled: true, applyEnabled: false }); footer.flush();
      reset.onClick(); apply.onClick(); assert.equal(resets, 1); assert.equal(applies, 1);
      assert.ok(footer.nodes().some(n => n.type === 'Text' && n.fontColor === readerAppColor('TOK_MESSAGE_DANGER', scheme)));
      footer.owner.updateStateVars({ scheme, hint: '', resetEnabled: true, applyEnabled: true }); footer.flush();
      footer.owner.aboutToDisappear(); reset.onClick(); apply.onClick();
      assert.equal(resets, 1); assert.equal(applies, 1, 'retired footer callbacks do not fire');
    }
  }

  if (id === 'group-row-layout') {
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const { productionReaderPressFeedback } = await import('./lib/reader-press-feedback-probe.mjs');
    const source = read('ReaderFilterControls'), marker = await markerRuntime(source);
    const equivalent=await markerRuntime('// @Component is comment text, not a declaration boundary\n'+source);
    assert.equal(equivalent.ReaderFilterSelectionMarker.toString(),marker.ReaderFilterSelectionMarker.toString(),'comment placement preserves actual emitted marker class');
    await assert.rejects(()=>markerRuntime(source+'\nfunction malformed('),/parse|deep-equal|Expected values/,'complete malformed source is rejected before class execution');
    for (const scheme of ['day', 'night']) for (const [density, height, expected] of [
      [1, 60, { left: 0, top: 14, right: 3, bottom: 46 }],
      [2, 101, { left: 0, top: 28, right: 6, bottom: 174 }],
      [3, 126, { left: 0, top: 42, right: 9, bottom: 336 }],
    ]) {
      const properties = createArkUIPropertyRuntimeProbe(); let selected = 0;
      const params = { scheme, label: '常用书源与较长分组名称', count: 989, selected: true, actionEnabled: true };
      const probe = filterBuilder(source, builderComponentMembers(source, 'ReaderFilterGroupRow'), {
        ...properties.sdk, ...marker, readerAppColor, ReaderPressFeedback: productionReaderPressFeedback(),
      }, { ...properties.hooks, componentName: 'ReaderFilterGroupRow', initialParams: params });
      const owner = probe.owner;
      owner.getUIContext = () => ({ vp2px: value => value * density });
      owner.onAction = () => selected++; owner.aboutToAppear(); owner.initialRender();
      const nodes = [...owner.nodes.values()], root = nodes.find(node => node.type === 'Stack');
      assert.deepEqual(nodes.map(node => node.type), ['Stack', 'Column', 'Text', 'Text'],
        'only intrinsic text content participates in the actual SDK-emitted normal-flow row');
      assert.deepEqual(root.constraintSize, { minHeight: 60 });
      assert.deepEqual(nodes.find(node => node.type === 'Column').padding, { top: 11, bottom: 11, left: 14, right: 14 });
      assert.ok(nodes.every(node => node.height === undefined && node.position === undefined && node.onAreaChange === undefined),
        'row has no percentage height, positioned measuring child or measurement feedback');
      assert.equal(nodes.filter(node => node.onClick).length, 1, 'decoration creates no hit-test actor over the row');
      assert.ok(root.drawModifier instanceof marker.ReaderFilterSelectionMarker);
      marker.calls.length = 0;
      const context = { size: { width: 326, height }, sizeInPixel: { width: 326 * density, height: height * density }, canvas: marker.canvas };
      root.drawModifier.drawFront(context);
      assert.deepEqual(marker.calls.map(call => call[0]), ['brush', 'roundRect', 'detach']);
      assert.deepEqual(marker.calls[0][1].color, marker.colors.get(readerAppColor('TOK_GREEN', scheme)));
      assert.equal(marker.calls[0][1].antiAlias, true);
      assert.deepEqual(marker.calls[1][1].rect, expected, 'paint uses resolved draw bounds and native vp-to-px conversion');
      assert.equal(marker.calls[1][1].radiusX, 3 * density); assert.equal(marker.calls[1][1].radiusY, 3 * density);
      root.onClick(); assert.equal(selected, 1);
      owner.updateStateVars({ ...params, selected: false }); properties.flush(); marker.calls.length = 0;
      root.drawModifier.drawFront(context); assert.deepEqual(marker.calls, [], 'unselected rows have no marker paint');
      root.onClick(); assert.equal(selected, 2, 'selection decoration never blocks the original row tap');
      owner.updateStateVars({ ...params, actionEnabled: false }); properties.flush(); root.onClick(); assert.equal(selected, 2);
      owner.updateStateVars(params); properties.flush(); owner.aboutToDisappear(); root.onClick(); assert.equal(selected, 2);
      marker.calls.length = 0;
      new marker.ReaderFilterSelectionMarker(true, scheme, density).drawFront({ ...context,
        size: { width: 326, height: 20 }, sizeInPixel: { width: 326 * density, height: 20 * density } });
      assert.deepEqual(marker.calls, [], 'insufficient native height never produces an inverted rectangle');

    }
  }

  if (id === 'host-wiring') {
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const geometry = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
    const surface = readerSurfaceSpecsForProbe();
    const helper = pureModuleProbe(read('ReaderSheetChrome'), 'ReaderSheetChrome.ets',
      { ...geometry, ...surface, readerAppColor }, ['readerSheetWidth', 'readerSheetChrome']);
    const hosts = [
      ['bookshelf/BookshelfShell', 'BookshelfShell', 'moreSheetOptions', 'moreSheetWidth', 'bookshelf-book-action'],
      ['bookshelf/BookshelfPage', 'BookshelfPage', 'bookActionSheetOptions', 'bookActionWidth', 'bookshelf-book-action'],
      ['search/ReaderSearchFilterPanel', 'ReaderSearchFilterPanel', 'sheetOptions', 'sheetWidth', 'search-result-filter'],
      ['search/ReaderSearchTaskPanel', 'ReaderSearchTaskPanel', 'sheetOptions', 'sheetWidth', 'search-task-status'],
      ['./fixtures/source-workflow/ReaderSourceFilterPanel.ets', 'ReaderSourceFilterPanel', 'sheetOptions', 'sheetWidth', 'source-management-filter'],
      ['source/SourceManagementMoreMenu', 'SourceManagementMoreMenu', 'options', 'sheetWidth', 'source-management-more'],
      ['./fixtures/source-workflow/SourceImportPage.ets', 'SourceImportPage', 'targetOptions', undefined, 'source-management-filter'],
    ];
    const chromeKeys = ['width', 'backgroundColor', 'radius', 'maskColor', 'shadow', 'borderWidth', 'borderColor'];
    for (const [path, name, optionsMethod, widthMethod, expectedSpec] of hosts) {
      for (const scheme of ['day', 'night']) {
        const widthCalls = [], chromeCalls = [];
        const metrics = { windowRect: { width: 366, height: 844 }, systemFontScale: 1 };
        // Distinct values detect a host retaining any inline field, even when
        // the ordinary production role happens to have the same current value.
        const sentinel = { width: 317, backgroundColor: 'helper-paper', radius: { topLeft: 19, topRight: 18, bottomLeft: 2, bottomRight: 3 },
          maskColor: 'helper-mask', shadow: { radius: 17, color: 'helper-shadow', offsetX: 2, offsetY: 3 },
          borderWidth: { top: 7 }, borderColor: 'helper-edge' };
        const Host = selectedProductionMethods(new URL(path.startsWith('./') ? path : `../entry/src/main/ets/features/${path}.ets`, import.meta.url), name,
          [optionsMethod, ...(widthMethod ? [widthMethod] : [])], {
            readerSheetWidth: (...args) => { widthCalls.push(args); return helper.readerSheetWidth(...args); },
            readerSheetChrome: (...args) => { chromeCalls.push(args); return sentinel; },
            ReaderWindowCoordinator: { metrics: () => metrics }, readerVisualSafeLeft: () => 7, readerVisualSafeRight: () => 11,
            SheetSize: { FIT_CONTENT: 'fit' }, SheetType: { BOTTOM: 'bottom' },
          });
        const owner = Object.assign(new Host(), { scheme, appThemeScheme: scheme, metricsRevision: 0,
          effectiveViewportWidth: () => 310, step: 'filter' });
        const options = owner[optionsMethod]('opening', undefined);
        assert.deepEqual(widthCalls, [[expectedSpec, name === 'BookshelfPage' ? 310 : 366, 7, 11]], path + ' uses its specified viewport');
        assert.deepEqual(chromeCalls, [[expectedSpec, scheme, name === 'BookshelfPage' ? 292 : 348]], path + ' forwards current safe width and scheme');
        assert.deepEqual(Object.fromEntries(chromeKeys.map(key => [key, options[key]])), sentinel,
          path + ' consumes every exterior field from one helper result');
        assert.equal(options.dragBar, false); assert.equal(options.showClose, false); assert.equal(options.preferType, 'bottom');
      }
    }
    for (const name of ['BookshelfMoreActionSheet', 'BookshelfBookActionSheet']) {
      const Sheet = selectedProductionMethods(new URL(`../entry/src/main/ets/features/bookshelf/${name}.ets`, import.meta.url), name,
        ['dismissAction', 'aboutToAppear', 'aboutToDisappear']);
      let dismissals = 0, business = 0;
      const owner = Object.assign(new Sheet(), { presentationId: 'one', isCurrent: identity => identity === 'one',
        onDismiss: () => dismissals++, onMultiSelect: () => business++, onBatchManage: () => business++,
        onBookInfo: () => business++, onRemoveFromBookshelf: () => business++ });
      owner.aboutToAppear(); const close = owner.dismissAction('one');
      close(); assert.equal(dismissals, 1); assert.equal(business, 0);
      owner.presentationId = 'two'; close(); assert.equal(dismissals, 1, 'old presentation close is rejected');
      owner.presentationId = 'one'; owner.aboutToDisappear(); close(); assert.equal(dismissals, 1, 'unmounted close is rejected');
      assert.equal(business, 0, 'close never dispatches a menu action');
    }
    const importSource = readFileSync(new URL('./fixtures/source-workflow/SourceImportPage.ets', import.meta.url), 'utf8');
    const tree=parse(importSource,'SourceImportPage.ets');
    assert.equal(visit(tree,node=>ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&['requestOverlayChrome','requestAppChrome','claimChrome','releaseChrome'].includes(node.expression.name.text)).length,0,'import target adds no chrome lifetime call owner');
  }

  if (id === 'source-menu-row') {
    const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const { productionReaderPressFeedback } = await import('./lib/reader-press-feedback-probe.mjs');
    const source = readFileSync(new URL('../entry/src/main/ets/features/source/SourceManagementMoreMenu.ets', import.meta.url), 'utf8');
    const controls = foundationControls();
    const methods = ['heading', 'item', 'content', 'accepts', 'admitted', 'run', 'close', 'finish', 'releaseChrome'];
    function menu(sourceCount) {
      const probe = filterBuilder(source, methods, { ...controls.dependencies, ...readerTypographyRoles,readerAppColor,
        ...readerSurfaceSpecsForProbe(), ReaderPressFeedback: productionReaderPressFeedback(),
        ReaderWindowCoordinator: { requestAppChrome() {} } }, controls.hooks);
      const calls = [];
      Object.assign(probe.owner, { mounted: true, expanded: true, identity: 'menu-1', chromeIdentity: '', pendingAction: '',
        mode: 'sources', scheme: 'day', sourceCount, groupCount: 2, scopeSummary: '全部书源', retainingContext: false, busy: false,
        onTools: () => calls.push('tools'), onGroups: () => calls.push('groups'), onImport: () => calls.push('import'), onExportAll: () => calls.push('export') });
      probe.owner.content('menu-1');
      return { owner: probe.owner, calls, nodes: controls.nodes(probe.owner) };
    }
    for (const count of [0, 3]) {
      const { owner, calls, nodes } = menu(count);
      const rows = nodes.filter(node => node.type === 'Stack' && typeof node.onClick === 'function');
      assert.equal(rows.length, 4, 'actual sources content contains four whole-row native actions');
      const labels = ['批量管理与书源工具', '管理分组', '新增书源', '导出全部书源'];
      const texts = nodes.filter(node => node.type === 'Text');
      for (const label of labels) {
        const text = texts.find(node => node.create === label); assert.ok(text);
        assert.deepEqual([text.fontSize, text.lineHeight, text.fontWeight, text.maxLines], [14, 21, 500, 1]);
        const row = rows.find(node => node.accessibilityText.startsWith(label + '，')); assert.ok(row);
        assert.equal(row.width, '100%'); assert.deepEqual(row.constraintSize, { minHeight: 60 });
        assert.equal(row.accessibilityGroup, true); assert.equal(row.accessibilityRole, 'AccessibilityRoleType.BUTTON');
        assert.ok(row.accessibilityText.length > label.length + 1, 'detail is included in whole-row a11y');
      }
      const details = texts.filter(node => !labels.includes(node.create) && !['管理入口', '全库数据'].includes(node.create));
      assert.equal(details.length, 4);
      for (const text of details) assert.deepEqual([text.fontSize, text.lineHeight, text.fontWeight, text.maxLines], [12, 19.2, 400, 2]);
      for (const label of ['管理入口', '全库数据']) {
        const text = texts.find(node => node.create === label);
        assert.deepEqual([text.fontSize, text.lineHeight, text.fontWeight], [13, 19.5, 400]);
        assert.deepEqual(text.padding, { left: 14, right: 14 });
      }
      assert.equal(nodes.filter(node => node.type === 'Column' && node.create?.space === 2).length, 4);
      assert.ok(nodes.some(node => node.type === 'Column' && node.create?.space === 8), 'content uses the actual 8vp gap');
      assert.equal(nodes.filter(node => node.type === 'Column' && node.padding?.top === 9 && node.padding?.bottom === 9 && node.padding?.left === 14 && node.padding?.right === 14).length, 4);
      const exportRow = rows.find(node => node.accessibilityText.startsWith('导出全部书源，'));
      assert.equal(exportRow.opacity, count ? 1 : .48); assert.equal(exportRow.enabled, count > 0); assert.equal(exportRow.focusable, count > 0);
      if (!count) {
        assert.match(exportRow.accessibilityText, /不可用/); exportRow.onClick();
        assert.equal(owner.pendingAction, ''); assert.equal(owner.expanded, true); assert.deepEqual(calls, []);
      } else {
        exportRow.onClick(); assert.equal(owner.pendingAction, 'export'); assert.equal(owner.expanded, false);
        assert.deepEqual(calls, [], 'actual run defers business until native exit');
        owner.finish('menu-1'); assert.deepEqual(calls, ['export']); owner.finish('menu-1'); assert.deepEqual(calls, ['export']);
      }
      owner.identity = 'menu-2'; owner.expanded = true;
      rows[0].onClick(); assert.equal(owner.pendingAction, '', 'old physical row rejects replacement opening');
      owner.mounted = false; rows[1].onClick(); assert.equal(owner.pendingAction, '', 'retired row rejects physical click');
    }
    for (const [label, action] of [['批量管理与书源工具', 'tools'], ['管理分组', 'groups'], ['新增书源', 'import'], ['导出全部书源', 'export']]) {
      const { owner, calls, nodes } = menu(3);
      nodes.find(node => node.type === 'Stack' && node.accessibilityText?.startsWith(label + '，')).onClick();
      assert.equal(owner.pendingAction, action); assert.deepEqual(calls, []);
      owner.finish('menu-1'); assert.deepEqual(calls, [action]);
    }
  }

  if (id === 'source-panel') {
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { readerReadableFontScale } = pureModuleProbe(readFileSync(new URL(
      '../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts', import.meta.url), 'utf8'),
    'ReaderSurfaceResolvers.ts', {}, ['readerReadableFontScale']);
    const model = await import('../entry/src/main/ets/features/source/SourceManagementPresentation.ts');
    const file = new URL('./fixtures/source-workflow/ReaderSourceFilterPanel.ets', import.meta.url);
    const source = readFileSync(file, 'utf8'), shared = read('ReaderFilterControls');
    const metrics = { systemFontScale: 1, windowRect: { width: 366, height: 844 } };
    const surface = readerSurfaceSpecsForProbe();
    let hideKeyboard = async () => {};
    const { readerSheetBodyBudget } = pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSurfaceBudgets.ts', import.meta.url), 'utf8'),
      'ReaderSurfaceBudgets.ts', {}, ['readerSheetBodyBudget']);
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
    const dependencies = { ...model, ...surface, ...readerTypographyRoles, ...readerFoundationTokens, readerSheetBodyBudget, readerReadableFontScale, readerAppColor, sourceFilterGeneration: 0,
      ReaderWindowCoordinator: { metrics: () => metrics },
      inputMethod: { getController: () => ({ hideTextInput: () => hideKeyboard() }) },
      readerVisualSafeTop: () => 24, readerInteractiveSafeBottom: () => 20, readerPageAreaLength: Number };
    const names = ['accepts', 'open', 'close', 'change', 'effectiveDraft', 'count', 'valid', 'groups', 'groupCount', 'otherCount',
      'apply', 'sheetInnerWidth', 'readableFontScale', 'statusColumns', 'statusChoiceWidth', 'typeChoiceWidth', 'footerFallback', 'bodyLimit'];
    const Panel = selectedProductionMethods(file, 'ReaderSourceFilterPanel', names, dependencies);
    const commits = [];
    function fixture(lockedGroupId) {
      return Object.assign(new Panel(), { mounted: true, expanded: false, metricsRevision: 0, identity: '', scheme: 'day', lockedGroupId,
        catalog: { version: 1, revision: 3, groups: [{ groupId: 'g', name: '常用' }, { groupId: 'h', name: '漫画' }], memberships: [] },
        sources: [{ sourceId: 'a', name: 'Alpha', baseUrl: 'https://a', category: 'novel', enabled: true, groupId: 'g' },
          { sourceId: 'b', name: 'Beta', baseUrl: 'https://b', category: 'comic', enabled: false, groupId: 'h' }],
        view: { query: '', status: 'enabled', kind: 'novel', groupId: 'g' }, sheetWidth: () => 366,
        getUIContext: () => ({ getFocusController: () => ({ clearFocus() {} }) }),
        onApply: value => commits.push(value) });
    }
    const panel = fixture(); panel.open(); const firstIdentity = panel.identity;
    assert.notEqual(panel.draft, panel.view); assert.equal(panel.count(), 1);
    panel.change(firstIdentity, { status: 'all', kind: 'all', groupId: '*' });
    assert.deepEqual(panel.view, { query: '', status: 'enabled', kind: 'novel', groupId: 'g' }, 'draft changes never mutate applied view');
    assert.equal(panel.count(), 2); assert.equal(commits.length, 0);
    panel.close(firstIdentity); panel.open();
    assert.deepEqual(panel.draft, panel.view, 'reopen discards unapplied edits');
    assert.notEqual(panel.identity, firstIdentity); panel.change(firstIdentity, { status: 'failed' });
    assert.equal(panel.draft.status, 'enabled', 'old opening cannot edit the new draft');
    metrics.systemFontScale = 1; assert.equal(panel.statusColumns(), 4);
    assert.equal(panel.statusChoiceWidth(), (326 - 8 * 3) / 4); assert.equal(panel.typeChoiceWidth(), (326 - 8 * 2) / 3);
    metrics.systemFontScale = 1.3; assert.equal(panel.statusColumns(), 4, '326 inner width admits four at 1.3');
    metrics.systemFontScale = 1.4; assert.equal(panel.statusColumns(), 2, '326 inner width requires two at 1.4');
    metrics.systemFontScale = 1.6; assert.equal(panel.statusColumns(), 2); assert.equal(panel.statusChoiceWidth(), (326 - 8) / 2);
    metrics.systemFontScale = 1;
    panel.headerHeight = 90; panel.footerHeight = 300;
    const spec = surface.resolveSheetSpec('source-management-filter');
    assert.equal(panel.bodyLimit(), 844 - 24 - 20 - 90 - spec.titleBottom - spec.contentBottom - 300, 'measured footer remains inside body budget');
    panel.footerHeight = 0;
    assert.equal(panel.bodyLimit(), Math.min(844 * .64, 844 - 24 - 20 - 90 - spec.titleBottom - spec.contentBottom - 96));
    panel.sheetWidth = () => 348;
    assert.equal(panel.sheetInnerWidth(), 308);
    metrics.systemFontScale = 1.3; assert.equal(panel.statusColumns(), 2, 'production 308 inner width changes at 1.3');
    metrics.windowRect.height = 600;
    for (const [scale, fallback] of [[1, 96], [1.6, 129]]) {
      metrics.systemFontScale = scale;
      assert.equal(panel.footerFallback(), fallback);
      assert.equal(panel.bodyLimit(), Math.min(600 * .64, 600 - 24 - 20 - 90 - spec.titleBottom - spec.contentBottom - fallback));
    }
    metrics.windowRect.height = 844; metrics.systemFontScale = 1;

    class FooterPort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
    class GroupPort extends FooterPort {}
    function renderSlots(state) {
      const probe = filterBuilder(source, ['footerContents', 'group'],
        { ...dependencies, ReaderFilterFooter: FooterPort, ReaderFilterGroupRow: GroupPort },
        { childSources: { ReaderFilterFooter: shared, ReaderFilterGroupRow: shared } });
      const owner = Object.assign(probe.owner, state);
      for (const name of names) owner[name] = Panel.prototype[name];
      owner.footerContents(owner.identity);
      owner.group({ groupId: 'g', name: '常用' }, owner.identity);
      return { owner, footer: [...owner.children.values()].find(child => child instanceof FooterPort && !(child instanceof GroupPort)),
        group: [...owner.children.values()].find(child => child instanceof GroupPort) };
    }
    const slots = renderSlots(panel);
    assert.equal(slots.footer.params.hint, '将显示 1 个书源'); assert.equal(slots.footer.params.applyEnabled, true);
    assert.equal(slots.footer.params.resetEnabled, true); assert.equal(slots.group.params.label, '常用');
    assert.equal(slots.group.params.selected, true); assert.equal(slots.group.params.count, 1);
    slots.footer.params.onReset(); assert.equal(model.sourceManagementFilterCount(slots.owner.draft), 0); assert.equal(commits.length, 0);
    slots.owner.identity = 'new-opening'; slots.owner.draft = { ...slots.owner.draft, status: 'failed' };
    slots.footer.params.onReset();
    assert.equal(slots.owner.draft.status, 'failed', 'stale footer reset cannot change a newer draft');
    assert.equal(commits.length, 0, 'reset never applies filters');
    const locked = fixture('g'); locked.open(); locked.change(locked.identity, { groupId: 'h' });
    assert.equal(locked.effectiveDraft().groupId, 'g', 'locked group cannot be widened by draft');
    const lockedSlots = renderSlots(locked); lockedSlots.footer.params.onReset();
    assert.equal(lockedSlots.owner.draft.groupId, 'g'); assert.equal(model.sourceManagementFilterCount(lockedSlots.owner.draft, 'g'), 0);
    const missing = fixture(); missing.open(); missing.catalog.groups = [];
    const invalidSlots = renderSlots(missing);
    assert.equal(invalidSlots.footer.params.hint, '原分组已删除，请重新选择可用分组。');
    assert.equal(invalidSlots.footer.params.hintTone, 'danger'); assert.equal(invalidSlots.footer.params.applyEnabled, false);
    await missing.apply(missing.identity); assert.equal(commits.length, 0);
    const lockedMissing = fixture('g'); lockedMissing.open(); lockedMissing.catalog.groups = [];
    assert.equal(renderSlots(lockedMissing).footer.params.hint, '当前分组已删除，请关闭并返回分组列表。');
    const valid = fixture(); valid.open(); const validId = valid.identity;
    await valid.apply(validId); await valid.apply(validId);
    assert.equal(commits.length, 1); assert.equal(valid.expanded, false, 'one valid apply closes its opening');
    let release;
    hideKeyboard = () => new Promise(resolve => { release = resolve; });
    const raced = fixture(); raced.open(); const pending = raced.apply(raced.identity);
    raced.catalog.groups = []; release(); await pending;
    assert.equal(commits.length, 1, 'catalog invalidation while hiding keyboard rejects commit');
    const retired = fixture(); retired.open(); const pendingRetired = retired.apply(retired.identity);
    retired.expanded = false; release(); await pendingRetired;
    assert.equal(commits.length, 1, 'closing while hiding keyboard rejects commit');
    const triggerSource=read('ReaderFilterControls');
    class TriggerPort {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
    const appliedView={query:'',status:'enabled',kind:'novel',groupId:'g'};
    function badgeCount(view,draft,definition=source){
      const badge=filterBuilder(definition,['build','triggerLabel'],{...dependencies,ReaderFilterTrigger:TriggerPort},{childSources:{ReaderFilterTrigger:triggerSource}}).owner;
      Object.assign(badge,fixture(),{view,draft,sheetOptions:()=>({}),sheetContent(){}});badge.initialRender();
      const trigger=[...badge.children.values()].find(child=>child instanceof TriggerPort);assert.ok(trigger);return trigger.params.count;
    }
    const clearView={...appliedView,status:'all',kind:'all',groupId:'*'};
    assert.equal(badgeCount(appliedView,clearView),3,'badge reads applied status/kind/group rather than current all-conditions draft');
    assert.equal(badgeCount(clearView,appliedView),0,'independent current SDK snapshot reads applied clear view');
    const tree=parse(source,'ReaderSourceFilterPanel.ets');
    const counts=visit(tree,node=>ts.isPropertyAssignment(node)&&node.name?.getText(tree)==='count'&&ts.isCallExpression(node.initializer));
    const badgeCounts=counts.filter(node=>ts.isIdentifier(node.initializer.expression)&&node.initializer.expression.text==='sourceManagementFilterCount');assert.equal(badgeCounts.length,1);
    const viewArg=badgeCounts[0].initializer.arguments[0],draftBadge=source.slice(0,viewArg.getStart(tree))+'this.draft'+source.slice(viewArg.end);
    assert.notEqual(badgeCount(appliedView,clearView,draftBadge),3,'draft-owned badge mutant loses the applied-only fact');
    assert.ok(visit(tree,node=>ts.isStringLiteral(node)&&node.text==='调整后点击下方应用，关闭则保留原条件。').length>0,'retained draft instruction remains present');
    assert.equal(visit(tree,node=>ts.isPropertyAssignment(node)&&node.name?.getText(tree)==='specId'&&ts.isStringLiteral(node.initializer)&&node.initializer.text==='source-compact').length,0);
    for(const native of visit(tree,node=>ts.isEtsComponentExpression(node)&&ts.isIdentifier(node.expression)&&['Column','Row'].includes(node.expression.text))){
      for(const field of native.arguments[0]?.properties??[]){
        if(ts.isPropertyAssignment(field)&&field.name?.getText(tree)==='space'&&ts.isNumericLiteral(field.initializer))
          assert.ok(![6,7].includes(Number(field.initializer.text)),'retained Source panel avoids obsolete compact spacing');
      }
    }

  }

  if (id === 'search-draft') {
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const groups = await import('../entry/src/main/ets/features/search/SearchSourceGroups.ts');
    const { ReaderMeasurementStore } = await import('../entry/src/main/ets/features/common/ReaderMeasurements.ts');
    const file = new URL('../entry/src/main/ets/features/search/ReaderSearchFilterPanel.ets', import.meta.url);
    const source = readFileSync(file, 'utf8');
    // Execute the production frame subclass with only its native base adapted.
    const frame=searchFilterSdkDeclarations(source);
    const names = ['appliedCount', 'draftActive', 'accepts', 'acceptsAction', 'acceptsDraftAction', 'retainsPresentation', 'beginDraft', 'presentationChanged',
      'validateDraft', 'selectDraftGroup', 'selectDraftType', 'selectDraftSourceGroup', 'clearDraftSourceGroup', 'updateDraftGroupQuery',
      'matchingGroups', 'draftSourceGroupLabel', 'resetDraft', 'applyDraft', 'manageSources', 'dismissDraft', 'stepChanged', 'sheetOptions'];
    const Panel = selectedProductionMethods(file, 'ReaderSearchFilterPanel', names, {
      ...groups, ...frame, readerSheetChrome: () => ({}),
      SheetSize: { FIT_CONTENT: 'fit' }, SheetType: { BOTTOM: 'bottom' }, DismissReason: { PRESS_BACK: 'back' },
    });
    const novel = { kind: 'group', groupId: 'novel', name: '小说书源' };
    const comic = { kind: 'group', groupId: 'comic', name: '漫画书源' };
    const option = selection => new groups.SearchSourceGroupOption(selection, 12);
    function fixture() {
      const frames = [], events = [], focuses = [];
      const panel = Object.assign(new Panel(), {
        measurements: new ReaderMeasurementStore(), measurementRevision: 0,
        mounted: true, expanded: true, presentationIdentity: 'opening:1', actionIdentity: 'opening:1:filter:1', step: 'filter',
        draftPresentationIdentity: '', closedPresentationIdentity: '', applyingDraft: false, appearedIdentity: '', scheme: 'day',
        appliedGroup: '在线', appliedType: '小说', appliedSourceGroup: novel, appliedSourceGroupLabel: '小说书源',
        appliedSourceGroupValid: true, initialGroupQuery: '初始', sourceGroupOptions: [option(groups.ALL_SEARCH_SOURCE_GROUP), option(novel), option(comic)],
        groupLoadState: 'ready', hasGroupCatalog: true, draftSourceGroup: groups.ALL_SEARCH_SOURCE_GROUP,
        getUIContext: () => ({ postFrameCallback: callback => frames.push(callback), getFocusController: () => ({ requestFocus: id => focuses.push(id) }) }),
        sheetWidth: () => 366, groupSheetHeight: () => 600, releaseSheetChrome: identity => events.push(['release', identity]),
        onApply: (...args) => events.push(['apply', ...args]), onGroupQuery: (...args) => events.push(['query', ...args]),
        onManageSources: identity => events.push(['manage', identity]),
        onStep: (step, identity) => {
          events.push(['step', step, identity]); panel.step = step; panel.actionIdentity = `${panel.presentationIdentity}:${step}:${events.length}`;
        },
        onDismiss: identity => { events.push(['dismiss', identity]); panel.expanded = false; panel.presentationChanged(); },
      });
      return { panel, frames, events, focuses, flush() { for (const callback of frames.splice(0)) callback.onFrame(0); } };
    }
    const p = fixture(); p.panel.presentationChanged(); p.flush();
    assert.deepEqual([p.panel.draftGroup, p.panel.draftType, p.panel.draftSourceGroup, p.panel.draftGroupQuery],
      ['在线', '小说', novel, '初始']);
    const firstAction = p.panel.actionIdentity;
    p.panel.selectDraftType('漫画', firstAction); p.panel.selectDraftGroup('全部', firstAction);
    assert.equal(p.panel.appliedCount(), 3, 'badge remains the applied count while draft changes');
    assert.deepEqual([p.panel.appliedGroup, p.panel.appliedType, p.panel.appliedSourceGroup], ['在线', '小说', novel]);
    assert.deepEqual(p.events, [], 'draft selection publishes no parent filter update');
    p.panel.dismissDraft(p.panel.presentationIdentity); assert.equal(p.panel.expanded, false);
    p.panel.expanded = true; p.panel.presentationIdentity = 'opening:2'; p.panel.actionIdentity = 'opening:2:filter:1';
    p.panel.presentationChanged(); p.flush();
    assert.deepEqual([p.panel.draftGroup, p.panel.draftType, p.panel.draftSourceGroup], ['在线', '小说', novel], 'close/reopen discards prior draft');
    p.panel.selectDraftType('漫画', firstAction); assert.equal(p.panel.draftType, '小说', 'old opening action cannot edit new draft');
    const current = p.panel.actionIdentity;
    p.panel.step = 'groups'; p.panel.actionIdentity = 'opening:2:groups:1';
    p.panel.selectDraftType('漫画', current); p.panel.resetDraft(current); p.panel.applyDraft(current);
    assert.equal(p.panel.draftType, '小说', 'old filter step callbacks cannot act in groups');
    const groupAction = p.panel.actionIdentity;
    p.panel.updateDraftGroupQuery('漫画', groupAction); assert.deepEqual(p.panel.matchingGroups().map(x => x.key), ['group:comic']);
    p.panel.validateDraft(); assert.equal(p.panel.draftValid, true, 'query filtering does not hide validity in the full option catalog');
    p.panel.selectDraftSourceGroup(option(comic), groupAction);
    assert.equal(p.panel.draftSourceGroup.groupId, 'comic'); assert.equal(p.panel.step, 'filter');
    assert.equal(p.events.filter(event => event[0] === 'apply').length, 0, 'group selection only changes draft and step');
    assert.equal(p.panel.appliedSourceGroup.groupId, 'novel');
    p.panel.selectDraftSourceGroup(option(novel), groupAction); assert.equal(p.panel.draftSourceGroup.groupId, 'comic', 'old group row cannot overwrite returned filter step');
    const filterAction = p.panel.actionIdentity;
    p.panel.selectDraftGroup('本地', filterAction);
    assert.equal(groups.searchSourceGroupKey(p.panel.draftSourceGroup), 'all'); assert.equal(p.panel.draftValid, true);
    assert.equal(p.panel.draftSourceGroupLabel(), '本地不适用');
    p.panel.resetDraft(filterAction);
    assert.deepEqual([p.panel.draftGroup, p.panel.draftType, groups.searchSourceGroupKey(p.panel.draftSourceGroup)], ['全部', '全部类型', 'all']);
    assert.equal(p.panel.draftActive(), false); assert.equal(p.events.filter(event => event[0] === 'apply').length, 0);
    const recordApply = p.panel.onApply;
    p.panel.onApply = (...args) => { recordApply(...args); p.panel.expanded = false; p.panel.presentationChanged(); };
    p.panel.selectDraftType('漫画', filterAction); p.panel.applyDraft(filterAction); p.panel.applyDraft(filterAction);
    assert.equal(p.events.filter(event => event[0] === 'apply').length, 1, 'accepted parent closes the opening so an old click cannot submit again');
    assert.deepEqual(p.events.find(event => event[0] === 'apply').slice(1), ['全部', '漫画', groups.ALL_SEARCH_SOURCE_GROUP, filterAction]);

    // The parent may have fresher catalog facts than this child. A void
    // callback that leaves the sheet open is not evidence of acceptance.
    const rejected = fixture(); rejected.panel.beginDraft(rejected.panel.presentationIdentity);
    let rejectedAttempts = 0, acceptedAttempts = 0;
    rejected.panel.onApply = (_category, _type, selection) => {
      if (selection.kind === 'group' && selection.groupId === 'novel') { rejectedAttempts++; return; }
      acceptedAttempts++; rejected.panel.expanded = false; rejected.panel.presentationChanged();
    };
    const retryAction = rejected.panel.actionIdentity;
    rejected.panel.applyDraft(retryAction);
    assert.equal(rejectedAttempts, 1); assert.equal(rejected.panel.expanded, true); assert.equal(rejected.panel.applyingDraft, false);
    rejected.panel.resetDraft(retryAction); assert.equal(rejected.panel.draftActive(), false, 'parent rejection does not lock reset');
    rejected.panel.selectDraftGroup('在线', retryAction); rejected.panel.selectDraftType('漫画', retryAction);
    assert.deepEqual([rejected.panel.draftGroup, rejected.panel.draftType], ['在线', '漫画'], 'parent rejection does not lock choices');
    rejected.panel.step = 'groups'; rejected.panel.actionIdentity = 'opening:1:groups:retry';
    rejected.panel.selectDraftSourceGroup(option(novel), rejected.panel.actionIdentity);
    assert.equal(rejected.panel.draftSourceGroup.groupId, 'novel', 'parent rejection does not lock source-group selection');
    rejected.panel.clearDraftSourceGroup(rejected.panel.actionIdentity);
    assert.equal(groups.searchSourceGroupKey(rejected.panel.draftSourceGroup), 'all', 'parent rejection does not lock clearing the group');
    rejected.panel.applyDraft(rejected.panel.actionIdentity); rejected.panel.applyDraft(rejected.panel.actionIdentity);
    assert.equal(acceptedAttempts, 1); assert.equal(rejectedAttempts, 1); assert.equal(rejected.panel.expanded, false, 'corrected draft can be retried and accepted');

    const reentrant = fixture(); reentrant.panel.beginDraft(reentrant.panel.presentationIdentity);
    let nestedCalls = 0;
    reentrant.panel.onApply = () => { nestedCalls++; reentrant.panel.applyDraft(reentrant.panel.actionIdentity); };
    reentrant.panel.applyDraft(reentrant.panel.actionIdentity);
    assert.equal(nestedCalls, 1, 'synchronous callback reentry cannot submit recursively');
    assert.equal(reentrant.panel.applyingDraft, false, 'synchronous guard releases after callback returns');
    reentrant.panel.applyDraft(reentrant.panel.actionIdentity); assert.equal(nestedCalls, 2, 'a parent rejection permits a later user retry');

    const management = fixture(); management.panel.beginDraft(management.panel.presentationIdentity);
    management.panel.step = 'groups'; management.panel.actionIdentity = 'opening:1:groups:manage';
    const manageIdentity = management.panel.actionIdentity; let managementRequests = 0;
    management.panel.onManageSources = () => managementRequests++;
    management.panel.manageSources(manageIdentity);
    assert.equal(managementRequests, 1); assert.equal(management.panel.draftPresentationIdentity, management.panel.presentationIdentity,
      'rejected management navigation retains the live draft identity');
    management.panel.updateDraftGroupQuery('漫画', manageIdentity); assert.equal(management.panel.draftGroupQuery, '漫画');
    management.panel.selectDraftSourceGroup(option(comic), manageIdentity);
    assert.equal(management.panel.draftSourceGroup.groupId, 'comic', 'rejected management navigation leaves group selection usable');
    management.panel.resetDraft(management.panel.actionIdentity); assert.equal(management.panel.draftActive(), false);
    management.panel.step = 'groups'; management.panel.actionIdentity = 'opening:1:groups:manage:retry';
    const retryManageIdentity = management.panel.actionIdentity;
    management.panel.manageSources(retryManageIdentity); assert.equal(managementRequests, 2, 'management request can be retried after rejection');
    management.panel.onManageSources = () => { managementRequests++; management.panel.expanded = false; management.panel.presentationChanged(); };
    management.panel.manageSources(retryManageIdentity); management.panel.manageSources(retryManageIdentity);
    assert.equal(managementRequests, 3, 'successful parent navigation closes the opening and rejects the old management callback');
    assert.equal(management.panel.draftPresentationIdentity, '');
    assert.equal(management.events.filter(event => event[0] === 'apply').length, 0, 'management navigation never applies the draft');

    const validity = fixture(); validity.panel.beginDraft(validity.panel.presentationIdentity);
    validity.panel.hasGroupCatalog = false; validity.panel.validateDraft(); assert.equal(validity.panel.draftValid, true, 'known applied valid group survives catalog absence');
    validity.panel.draftSourceGroup = comic; validity.panel.validateDraft(); assert.equal(validity.panel.draftValid, false, 'new uncatalogued group cannot be applied');
    validity.panel.applyDraft(validity.panel.actionIdentity); assert.deepEqual(validity.events, []);
    validity.panel.draftSourceGroup = novel; validity.panel.appliedSourceGroupValid = false; validity.panel.validateDraft(); assert.equal(validity.panel.draftValid, false);
    validity.panel.hasGroupCatalog = true; validity.panel.sourceGroupOptions = [option(comic)]; validity.panel.validateDraft();
    assert.equal(validity.panel.draftValid, false, 'deleted applied group stays invalid against current catalog');
    validity.panel.clearDraftSourceGroup(validity.panel.actionIdentity); assert.equal(validity.panel.draftValid, true);
    assert.equal(groups.searchSourceGroupKey(validity.panel.draftSourceGroup), 'all'); assert.deepEqual(validity.events, []);

    const back = fixture(); back.panel.beginDraft(back.panel.presentationIdentity);
    back.panel.selectDraftType('漫画', back.panel.actionIdentity); let nativeDismissals = 0;
    const options = back.panel.sheetOptions(back.panel.presentationIdentity);
    options.onWillDismiss({ reason: 'drag', dismiss: () => nativeDismissals++ });
    assert.equal(nativeDismissals, 0, 'entry-time non-user dismissal remains guarded');
    options.onWillDismiss({ reason: 'back', dismiss: () => nativeDismissals++ });
    assert.equal(nativeDismissals, 1); assert.equal(back.panel.expanded, false);
    assert.equal(back.events.filter(event => event[0] === 'apply').length, 0, 'back dismisses without committing');
    back.panel.expanded = true; back.panel.presentationIdentity = 'opening:after-back'; back.panel.actionIdentity = 'opening:after-back:filter';
    back.panel.beginDraft(back.panel.presentationIdentity); assert.equal(back.panel.draftType, '小说');
    options.onWillDismiss({ reason: 'back', dismiss: () => nativeDismissals++ }); assert.equal(nativeDismissals, 1, 'old native dismissal cannot close new opening');

    const queued = fixture(); queued.panel.presentationChanged();
    queued.panel.presentationIdentity = 'opening:queued'; queued.panel.actionIdentity = 'opening:queued:filter'; queued.panel.appliedType = '漫画';
    queued.panel.presentationChanged(); queued.flush();
    assert.equal(queued.panel.draftPresentationIdentity, 'opening:queued'); assert.equal(queued.panel.draftType, '漫画', 'queued initializers only admit the current opening');
    queued.panel.step = 'groups'; queued.panel.actionIdentity = 'opening:queued:groups'; queued.panel.stepChanged();
    queued.panel.step = 'filter'; queued.panel.actionIdentity = 'opening:queued:filter:next'; queued.flush();
    assert.deepEqual(queued.focuses, [], 'old step focus frame is rejected');
    queued.panel.sheetOptions(queued.panel.presentationIdentity).onAppear(); queued.flush();
    assert.deepEqual(queued.focuses, ['reader-search-source-group-trigger'], 'native appearance enables current-step focus restoration');
    queued.panel.mounted = false; queued.panel.selectDraftType('小说', queued.panel.actionIdentity);
    queued.panel.applyDraft(queued.panel.actionIdentity); assert.equal(queued.panel.draftType, '漫画');
    assert.equal(queued.events.filter(event => event[0] === 'apply').length, 0, 'retired panel cannot submit');
  }

  if (id === 'filter-focus-lifetime') {
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const file = new URL('../entry/src/main/ets/features/search/ReaderSearchFilterPanel.ets', import.meta.url);
    const source = readFileSync(file, 'utf8');
    const frame=searchFilterSdkDeclarations(source);
    // Exact production Watch handler, native callback and frame class. Only
    // the native focus controller and post-frame scheduling are I/O ports.
    const Panel = selectedProductionMethods(file, 'ReaderSearchFilterPanel',
      ['accepts', 'acceptsAction', 'stepChanged', 'sheetOptions'], {
        ...frame, readerSheetChrome: () => ({}), SheetSize: { FIT_CONTENT: 'fit' },
        SheetType: { BOTTOM: 'bottom' }, DismissReason: { PRESS_BACK: 'back' },
      });
    function fixture() {
      const frames = [], requests = [], effects = [];
      const panel = new Panel();
      let failure, controllerFailure;
      Object.assign(panel, { mounted: true, expanded: true, presentationIdentity: 'focus:1', actionIdentity: 'focus:1:groups',
        step: 'groups', draftGroup: '在线', appearedIdentity: '', scheme: 'day',
        sheetWidth: () => 366, groupSheetHeight: () => 600,
        getUIContext: () => ({ postFrameCallback: callback => frames.push(callback), getFocusController() {
          if (controllerFailure) throw controllerFailure;
          return { requestFocus(target) { requests.push(target); if (failure) throw failure; } };
        } }),
        onApply: () => effects.push('apply'), onManageSources: () => effects.push('navigate'),
        onDismiss: () => effects.push('dismiss'), onClosed: () => effects.push('closed'),
      });
      const native = panel.sheetOptions(panel.presentationIdentity);
      return { panel, native, frames, requests, effects,
        fail(error) { failure = error; }, failController(error) { controllerFailure = error; },
        flush() { for (const callback of frames.splice(0)) callback.onFrame(0); } };
    }
    const unmounted = fixture(); unmounted.panel.mounted = false; unmounted.panel.stepChanged();
    assert.equal(unmounted.frames.length, 0, 'unmounted Watch handler cannot enqueue focus work');
    const closed = fixture(); closed.panel.expanded = false; closed.panel.stepChanged();
    assert.equal(closed.frames.length, 0, 'closed Watch handler cannot enqueue focus work');

    const appeared = fixture(); appeared.panel.stepChanged(); assert.equal(appeared.frames.length, 1); appeared.flush();
    assert.deepEqual(appeared.requests, [], 'logical opening alone does not prove a native focus target exists');
    appeared.native.onAppear(); assert.equal(appeared.frames.length, 1, 'actual native onAppear reschedules the dropped early focus request');
    appeared.flush(); assert.deepEqual(appeared.requests, ['reader-search-source-group-back']);
    assert.deepEqual(appeared.effects, [], 'focus restoration does not apply filters or navigate');
    const filter = fixture(); filter.panel.step = 'filter'; filter.panel.actionIdentity = 'focus:1:filter';
    filter.native.onAppear(); filter.flush(); assert.deepEqual(filter.requests, ['reader-search-source-group-trigger']);

    for (const stale of ['opening', 'action', 'step', 'unmount', 'closing']) {
      const p = fixture(); p.native.onAppear(); assert.equal(p.frames.length, 1);
      if (stale === 'opening') { p.panel.presentationIdentity = 'focus:2'; p.panel.actionIdentity = 'focus:2:groups'; }
      if (stale === 'action') p.panel.actionIdentity = 'focus:1:groups:new';
      if (stale === 'step') p.panel.step = 'filter';
      if (stale === 'unmount') p.panel.mounted = false;
      if (stale === 'closing') p.panel.expanded = false;
      p.flush(); assert.deepEqual(p.requests, [], stale + ' retires the queued native focus request');
      assert.deepEqual(p.effects, []);
    }
    const retiredAppearance = fixture(); retiredAppearance.panel.presentationIdentity = 'focus:new';
    retiredAppearance.native.onAppear(); assert.equal(retiredAppearance.frames.length, 0, 'old native appearance cannot schedule into a new opening');
    const local = fixture(); local.panel.step = 'filter'; local.panel.actionIdentity = 'focus:1:filter'; local.panel.draftGroup = '本地';
    local.native.onAppear(); local.flush(); assert.deepEqual(local.requests, [], 'local origin disables the group trigger and must not focus it');

    for (const code of [150001, 150002, 150003, '150001', '150002', '150003']) {
      const p = fixture(); const failure = Object.assign(new Error('native focus target missing, invisible or disabled'), { code });
      p.fail(failure); p.native.onAppear();
      assert.doesNotThrow(() => p.flush(), 'documented focus error ' + typeof code + ':' + code + ' cannot escape the real production frame');
      assert.deepEqual(p.requests, ['reader-search-source-group-back'], 'the throwing native boundary must actually be reached');
      assert.deepEqual(p.effects, [], 'optional focus failure cannot apply, dismiss or navigate');
    }
    const controller = fixture(); controller.failController(Object.assign(new Error('native focus controller unavailable'), { code: 150001 }));
    controller.native.onAppear(); assert.doesNotThrow(() => controller.flush(), 'the entire optional focus acquisition call is protected');
    assert.deepEqual(controller.effects, []);
    for (const code of [999999, '999999']) {
      const unknown = fixture(); const unknownError = Object.assign(new Error('unrelated platform error'), { code });
      unknown.fail(unknownError); unknown.native.onAppear();
      assert.throws(() => unknown.flush(), error => error === unknownError,
        'unknown ' + typeof code + ' failures stay visible instead of being silently swallowed');
      assert.deepEqual(unknown.effects, []);
    }
  }

  if (id === 'filter-sheet-exit') {
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const groups = await import('../entry/src/main/ets/features/search/SearchSourceGroups.ts');
    const { ReaderMeasurementStore } = await import('../entry/src/main/ets/features/common/ReaderMeasurements.ts');
    const { foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
    const sizing = pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts', import.meta.url), 'utf8'),
      'ReaderSurfaceResolvers.ts', {}, ['readerScaledControlHeight']);
    const geometry = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
    const source = readFileSync(new URL('../entry/src/main/ets/features/search/ReaderSearchFilterPanel.ets', import.meta.url), 'utf8');
    const shared = read('ReaderFilterControls');
    const childSources = { ReaderFilterTrigger: shared, ReaderFilterFooter: shared, ReaderFilterGroupRow: shared,
      ...Object.fromEntries(['ReaderButton', 'ReaderIconButton', 'ReaderSearchField', 'ReaderPageState', 'ReaderBoundedSurface', 'ReaderBoundedSurfaceHeader']
        .map(name => [name, read(name)])) };
    const focus=searchFilterSdkDeclarations(source);
    const propNames = ['expanded', 'presentationIdentity', 'actionIdentity', 'step', 'appliedGroup', 'appliedType',
      'appliedSourceGroup', 'appliedSourceGroupLabel', 'appliedSourceGroupValid', 'initialGroupQuery', 'sourceGroupOptions', 'groupLoadState', 'hasGroupCatalog'];
    function fixture() {
      const properties = createArkUIPropertyRuntimeProbe(), events = [];
      const metrics = { systemFontScale: 1, densityPixels: 1, windowRect: { width: 366, height: 844 } };
      const surface = readerSurfaceSpecsForProbe(metrics);
      const chrome = pureModuleProbe(read('ReaderSheetChrome'), 'ReaderSheetChrome.ets',
        { ...geometry, ...surface, readerAppColor }, ['readerSheetWidth', 'readerSheetChrome']);
      class Port { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
      class ChromeStyle { constructor(...args) { this.args = args; } }
      const Divider = new Proxy({}, { get: (_target, name) => name === 'name' ? 'Divider' : () => name === 'canRetake' ? false : undefined });
      const params = { expanded: true, presentationIdentity: 'exit:1', actionIdentity: 'exit:1:filter', step: 'filter',
        appliedGroup: '全部', appliedType: '全部类型', appliedSourceGroup: groups.ALL_SEARCH_SOURCE_GROUP,
        appliedSourceGroupLabel: '全部分组', appliedSourceGroupValid: true, initialGroupQuery: '',
        sourceGroupOptions: [new groups.SearchSourceGroupOption(groups.ALL_SEARCH_SOURCE_GROUP, 12)], groupLoadState: 'ready', hasGroupCatalog: true };
      const probe = filterBuilder(source, builderComponentMembers(source), {
        ...properties.sdk, ...surface, ...chrome, ...focus, ...groups, ...foundationSpecs(), ...sizing, ReaderMeasurementStore, Divider,readerAppColor,
        ...Object.fromEntries(Object.keys(childSources).map(name => [name, Port])),
        ReaderWindowChromeStyle: ChromeStyle, SheetSize: { FIT_CONTENT: 'fit' }, SheetType: { BOTTOM: 'bottom' }, DismissReason: { PRESS_BACK: 'back' },
        readerVisualSafeLeft: () => 0, readerVisualSafeRight: () => 0, readerVisualSafeTop: () => 24, readerVisualSafeBottom: () => 20,
        readerScrimmedOpaqueColor: (paper, mask) => `${paper}+${mask}`, readerPageAreaLength: Number,
        ReaderWindowCoordinator: { metrics: () => metrics, requestOverlayChrome: () => events.push(['overlay']), requestAppChrome: () => events.push(['app']) },
      }, { ...properties.hooks, childSources, initialParams: params });
      const panel = probe.owner;
      const panelParams = overrides => ({ ...Object.fromEntries(propNames.map(name => [name, panel[name]])), ...overrides });
      panel.getUIContext = () => ({ postFrameCallback: frame => frame.onFrame(0), getFocusController: () => ({ requestFocus() {}, clearFocus() {} }) });
      panel.onApply = (...args) => events.push(['apply', ...args]);
      panel.onDismiss = identity => { events.push(['dismiss', identity]); panel.updateStateVars(panelParams({ expanded: false })); };
      panel.onClosed = identity => events.push(['closed', identity]);
      panel.aboutToAppear(); panel.initialRender();
      const binding = [...panel.nodes.values()].find(node => node.bindSheet).bindSheet;
      const native = binding[2]; native.onWillAppear(); native.onAppear(); binding[1].builder();
      const content = [...panel.children.values()].find(child => child.params.specId === 'search-result-filter');
      assert.ok(content, 'actual Panel creates the registered native content slots');
      const children = () => [...panel.children.values()];
      const slotCounts = () => ({ header: children().filter(child => child.params.title === '筛选搜索结果').length,
        options: children().filter(child => child.params.specId === 'source-filter-option').length,
        footer: children().filter(child => typeof child.params.onReset === 'function' && typeof child.params.onApply === 'function').length });
      const renderSlots = () => { content.params.header(); content.params.body(); content.params.actions(); };
      return { panel, native, content, events, panelParams, properties, children, slotCounts, renderSlots, output: probe.output };
    }
    const retained = fixture(); retained.renderSlots();
    const originalChoice = retained.children().find(child => child.params.specId === 'source-filter-option' && child.params.label === '小说');
    const originalFooter = retained.children().find(child => child.params.onReset && child.params.onApply);
    retained.panel.updateStateVars(retained.panelParams({ expanded: false })); retained.properties.flush();
    const before = retained.slotCounts(); retained.renderSlots(); const after = retained.slotCounts();
    assert.ok(after.header > before.header && after.options > before.options && after.footer > before.footer,
      'actual SDK slot closures still render all sheet content after parent closes and before native disappearance');
    originalChoice.params.onAction(); originalFooter.params.onApply();
    assert.equal(retained.events.filter(event => event[0] === 'apply').length, 0, 'retained exit content cannot dispatch business actions');
    retained.native.onDisappear(); retained.native.onDisappear();
    assert.deepEqual(retained.events.filter(event => event[0] === 'closed'), [['closed', 'exit:1']], 'native closed fact is delivered once per opening');
    const finished = retained.slotCounts(); retained.renderSlots(); assert.deepEqual(retained.slotCounts(), finished, 'finished opening no longer supplies content');
    retained.panel.updateStateVars(retained.panelParams({ expanded: true, presentationIdentity: 'exit:2', actionIdentity: 'exit:2:filter' })); retained.properties.flush();
    const eventsBeforeOld = retained.events.length;
    retained.native.onDisappear(); retained.renderSlots();
    assert.equal(retained.events.length, eventsBeforeOld, 'old native disappearance cannot release chrome or notify a new opening');
    assert.deepEqual(retained.slotCounts(), finished, 'old slot callbacks cannot render into the new opening');

    // Observable disposal boundary: poison real Prop accessors on the actual
    // SDK-emitted Panel, rather than relying on an empty destructor fixture.
    function poisonProps(panel) {
      const reads = [];
      for (const name of propNames) Object.defineProperty(panel, name, { configurable: true,
        get() { reads.push(name); throw new Error(`disposed Prop read: ${name}`); },
        set() { throw new Error(`disposed Prop write: ${name}`); } });
      return reads;
    }
    const destroyed = fixture(); destroyed.panel.aboutToDisappear(); const retiredReads = poisonProps(destroyed.panel);
    assert.throws(() => destroyed.panel.presentationIdentity, /disposed Prop read/); retiredReads.length = 0;
    assert.doesNotThrow(() => destroyed.native.onDisappear(), 'mounted=false rejects native disappearance before touching disposed Props');
    assert.deepEqual(retiredReads, []); assert.equal(destroyed.events.filter(event => event[0] === 'closed').length, 0);

    const reentrant = fixture(); let closedReads, closedCount = 0;
    reentrant.panel.onClosed = identity => {
      closedCount++; assert.equal(identity, 'exit:1');
      assert.equal(reentrant.panel.closedPresentationIdentity, identity);
      assert.equal(reentrant.panel.appearedIdentity, ''); assert.equal(reentrant.panel.draftPresentationIdentity, '');
      assert.equal(reentrant.panel.chromeIdentity, '', 'chrome and local identities are cleaned before parent navigation');
      reentrant.panel.aboutToDisappear(); closedReads = poisonProps(reentrant.panel);
    };
    assert.doesNotThrow(() => reentrant.native.onDisappear(), 'onClosed may synchronously destroy the Panel without a post-callback Prop access');
    assert.equal(closedCount, 1); assert.deepEqual(closedReads, []);
    assert.doesNotThrow(() => reentrant.native.onDisappear()); assert.equal(closedCount, 1); assert.deepEqual(closedReads, []);

    const dismissed = fixture(); let dismissReads, dismissedClosed = 0;
    dismissed.panel.onDismiss = () => { dismissed.panel.aboutToDisappear(); dismissReads = poisonProps(dismissed.panel); };
    dismissed.panel.onClosed = () => dismissedClosed++;
    assert.doesNotThrow(() => dismissed.native.onDisappear(), 'a synchronous parent teardown during onDismiss prevents any further Prop reads or closed notification');
    assert.deepEqual(dismissReads, []); assert.equal(dismissedClosed, 0);
  }
}

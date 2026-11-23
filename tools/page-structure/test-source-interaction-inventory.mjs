import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from '../lib/contract-case-selection.mjs';
import { installedEtsCompiler } from '../lib/ets-compiler-runtime.mjs';
import { virtualFilePath } from '../lib/tool-environment.mjs';
import { safePath } from './lib.mjs';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const common = name => {
  const group = name === 'PageBackBar' ? 'chrome' :
    ['ReaderRecoveryAction','ReaderRecoveryNotice','ReaderPageState'].includes(name) ? 'feedback' : 'controls';
  return `entry/src/main/ets/ui/${group}/${name}.ets`;
};
const pagePath = 'entry/src/main/ets/features/source/ui/SourceManagementPage.ets';
const inventoryPath = 'tools/page-structure/source-interaction-inventory.json';
const inventory = JSON.parse(read(inventoryPath));
const records = [];
const definitions = {
  inventory: { description: 'Reachable source-page interactive bindings and shared drawing owners; excludes retained unmounted builders and non-action rows', resources: [] },
  'sdk-targets': { description: 'Actual SDK leaf target carriers at 320/366 × 1/1.3/1.6/2; no native hit/text/focus acceptance', resources: [] },
  'recovery-targets': { description: 'Actual shared recovery/page-state targets, width reservation, captured generation and busy admission; no native wrapping/paint', resources: [] },
};
const outputArgs = process.argv.slice(2).filter(arg => arg.startsWith('--evidence-path='));
if (outputArgs.length > 1) throw Error('Only one explicit evidence path is allowed');
const evidencePath = outputArgs[0]?.slice('--evidence-path='.length);
if (evidencePath && !evidencePath.startsWith('.reader-artifacts/')) throw Error('Evidence must be written to an explicit repository artifact path');
const selected = selectContractCases(definitions, { argv: process.argv.slice(2).filter(arg => !arg.startsWith('--evidence-path=')) });
const { ts, options } = installedEtsCompiler();
const parsed = new Map();
function component(path, name) {
  const key = `${path}:${name ?? ''}`;
  if (!parsed.has(key)) {
    const source = read(path), tree = ts.createSourceFile(virtualFilePath(path.split('/').at(-1)), source,
      ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.equal(tree.parseDiagnostics.length, 0, path);
    const structs = tree.statements.filter(n => n.members && n.name && n.members.some(m => m.name?.getText(tree) === 'build'));
    const node = name ? structs.find(n => n.name.getText(tree) === name) : structs.find(n => n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) ?? structs[0];
    assert.ok(node, path);
    parsed.set(key, { tree, node, members: new Map(node.members.filter(m => m.name).map(m => [m.name.getText(tree), m])) });
  }
  return parsed.get(key);
}
function member(path, symbol) {
  const parsed = component(path);
  const value = parsed.members.get(symbol); assert.ok(value, `${path}#${symbol}`); return { ...parsed, value };
}
function exposureSet(path) {
  const { tree, members } = component(path), seen = new Set(), exposures = [];
  function visitBuilder(name) {
    if (seen.has(name)) return; seen.add(name);
    const m = members.get(name); assert.ok(m, `reachable ${name}`);
    function visit(n) {
      if ((ts.isCallExpression(n) || ts.isEtsComponentExpression?.(n)) && n.expression) {
        const expression = n.expression.getText(tree);
        if (expression.startsWith('this.')) {
          const candidate = members.get(expression.slice(5));
          if (candidate && ts.getAllDecorators(candidate).some(d => d.getText(tree) === '@Builder')) visitBuilder(expression.slice(5));
        }
        if (['PageBackBar', 'ReaderIconButton', 'ReaderSearchField', 'ReaderRecoveryNotice', 'ReaderRecoveryAction',
          'ReaderButton', 'ReaderSelect', 'ReaderSelectPanel', 'ReaderPageState', 'ReaderToggle', 'ReaderLabeledIconAction'].includes(expression)) {
          exposures.push(`${name}:${expression}`);
        }
        if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'onClick') exposures.push(`${name}:native:onClick`);
      }
      ts.forEachChild(n, visit);
    }
    visit(m);
  }
  visitBuilder('build');
  return { seen, exposures };
}

if (selected.includes('inventory')) {
  assert.equal(inventory.targets.length, new Set(inventory.targets.map(t => t.id)).size);
  const { seen, exposures } = exposureSet(pagePath);
  assert.equal(seen.has('statusBanner'), false, 'retained statusBanner is not a current mounted target');
  const registered = new Set();
  const controlRegistry = JSON.parse(read('tools/contracts/control-registry.json'));
  const knownControls = new Set(controlRegistry.controls.map(c => c.controlId));
  const registeredPage = JSON.parse(read('tools/page-structure/register.json')).pages.find(p => p.pageId === inventory.pageId);
  const pageRefs = new Set(Object.values(registeredPage.layers).flatMap(layer => layer.facts?.controlRefs ?? []));
  for (const target of inventory.targets) {
    assert.ok(seen.has(target.pageBinding.symbol), `${target.id} is reachable from actual build`);
    member(target.pageBinding.path, target.pageBinding.symbol);
    member(target.drawHost.path, target.drawHost.symbol);
    if (target.panelBinding) member(target.panelBinding.path, target.panelBinding.symbol);
    assert.equal(target.nativeEvidence, 'OPEN');
    assert.ok(knownControls.has(target.controlRef), `${target.id}: controlRef resolves to current control registry`);
    assert.ok(pageRefs.has(target.controlRef), `${target.id}: current page layers bind controlRef`);
    registered.add(`${target.pageBinding.symbol}:${target.pageBinding.component}`);
  }
  assert.deepEqual(new Set(exposures), registered, 'all reachable page interactive component/native-click sites must be registered');
  assert.equal(exposures.filter(x => x === 'sourceList:ReaderPageState').length, 2,
    'read failure and filter-empty page-state are separate reachable branches');
  const { readerSourceCategoryLabel } = await import('../../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts');
  for (const target of inventory.targets.filter(t => t.category))
    assert.equal(target.label, target.category === 'all' ? '全部类型' : readerSourceCategoryLabel(target.category));
  const registeredCategories = inventory.targets.filter(t => t.category).map(t => t.category);
  const { tree: pageTree, value: categoryBuilder } = member(pagePath, 'categoryFilter');
  const actualCategories = [];
  function categoryArguments(n) {
    if (ts.isArrayLiteralExpression(n) && n.elements.every(ts.isStringLiteral)) actualCategories.push(...n.elements.map(v => v.text));
    ts.forEachChild(n, categoryArguments);
  }
  categoryArguments(categoryBuilder);
  assert.deepEqual(registeredCategories, actualCategories, 'each actual category option is registered, including long visible labels');
  assert.equal(inventory.pageE2, 'FAIL'); assert.equal(inventory.pageE3, 'FAIL');
  console.log(JSON.stringify({ targetTemplates: inventory.targets.length, uniqueExposureSites: registered.size,
    gestures: inventory.gestures.length, excluded: inventory.excluded.map(x => x.id), boundary: inventory.scope }));
  recordContractCasePass('inventory');
}

if (selected.includes('sdk-targets')) {
  const { ReaderWindowMetricsSnapshot, ReaderRectVp, readerInteractiveSafeLeft, readerInteractiveSafeRight,
    readerInteractiveSafeTop, readerInteractiveSafeBottom } = await import('../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const searchGeometry = await import('../../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts');
  const { selectedProductionMethods, selectedProductionValues } = await import('../lib/selected-production-methods.mjs');
  const { readerSelectMenuWidth, readerSelectAvailableWidth } = await import('../../entry/src/main/ets/ui/foundation/ReaderSelectGeometry.ts');
  const { foundationControls, readerFoundationTokens } = await import('../lib/reader-foundation-control-probe.mjs');
  const { labeledIconControls } = await import('../lib/reader-labeled-icon-action-probe.mjs');
  const { iconButtonControls } = await import('../lib/reader-icon-button-probe.mjs');
  const { toggleSource, switchSpecs } = await import('../lib/reader-switch-control-probe.mjs');
  const { choiceRowProbe } = await import('../lib/reader-choice-row-probe.mjs');
  const { createReaderBuilderProbe } = await import('../lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('../lib/arkui-property-runtime-probe.mjs');
  const { boundedSurfaceSdk, boundedMembers, readerSurfaceSpecsForProbe } = await import('../lib/bounded-surface-sdk-probe.mjs');
  const { pureModuleProbe } = await import('../lib/ets-pure-module-probe.mjs');
  const { readerTypographyRoles } = await import('../lib/reader-typography-probe.mjs');
  const { readerAppColor } = await import('../../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const { productionMangaDirectoryPressFeedback } = await import('../lib/manga-directory-press-feedback-probe.mjs');
  const { productionReaderPressFeedback } = await import('../lib/reader-press-feedback-probe.mjs');
  const { readerControlNativeTree } = await import('../fixtures/reader-control-native-tree.mjs');
  const raisedShape=pureModuleProbe(read('entry/src/main/ets/ui/layout/ReaderRaisedShape.ts'),'ReaderRaisedShape.ts',{},['ReaderRaisedShape','resolveReaderRaisedShape']);
  const sizing = pureModuleProbe(read('entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {}, ['readerScaledBarHeight','readerScaledControlHeight','readerReadableFontScale']);
  const accessibility = pureModuleProbe(read(common('ReaderActionAccessibility')), 'ReaderActionAccessibility.ets',
    { AccessibilityRoleType: { BUTTON: 'BUTTON' } }, ['ReaderActionAccessibility', 'readerActionTouchRegion']);
  const shellTree=ts.createSourceFile('ReaderPageShell.ts',read('entry/src/main/ets/ui/layout/ReaderPageShell.ts'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,options);
  const areaFunction=shellTree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='readerPageAreaLength');assert.ok(areaFunction);
  const areaHelpers=pureModuleProbe(areaFunction.getText(shellTree),'ReaderPageShell.ts',{},['readerPageAreaLength']);
  const directoryMembers=[...component(common('ReaderSearchField')).members.keys()].filter(name=>name.startsWith('directory')||name.startsWith('onDirectory')||name==='queueDirectoryFocus');
  const searchInputTarget = pureModuleProbe(read(common('ReaderSearchField')).split('@Component')[0], 'ReaderSearchField.ets',
    { ...accessibility, FrameCallback: class {} }, ['ReaderSearchInputTarget','ReaderSearchFocusFrame']);
  const hit = (nodes, label) => { const n = nodes.find(n => typeof n.onClick === 'function'); assert.ok(n, label); return n; };
  const record = (group, width, scale, node, extra = {}) => records.push({ group, width, fontScaleContext: scale,
    fontEvidence: ['status-chip', 'category-chip', 'row-login', 'row-detect', 'footer-manage', 'footer-add', 'header-back'].includes(group)
      ? 'explicit-window-scale-property' : 'ambient-or-fixed-carrier-not-font-layout-proof',
    visual: { width: node.width ?? null, height: node.height ?? null, minimum: node.constraintSize ?? null },
    response: node.responseRegion ?? null, nativeResult: 'NOT_RUN', ...extra });
  for (const width of [320, 366]) for (const scale of [1, 1.3, 1.6, 2]) {
    const metrics = { systemFontScale: scale, windowRect: { width, height: 844 }, systemInsets: { left: 0, right: 0 } };
    const sourceConstants = selectedProductionValues(new URL(pagePath, root), ['GROUP_ICON_WIDTH','GROUP_LABEL_GAP','GROUP_TRIGGER_GAP']);
    const SourceWidths = selectedProductionMethods(new URL(pagePath, root), 'SourceManagementPage', ['filterControlWidth', 'groupSelectWidth', 'groupLabelWidth'], {...readerTypographyRoles,...sourceConstants});
    const sourceWidths = Object.assign(new SourceWidths(), { expandedLayout: false, contentFrame: () => ({ width: width - 38 }), fontScale: () => scale,
      getUIContext: () => ({ px2vp: value => value, getMeasureUtils: () => ({ measureText: () => readerTypographyRoles.TYPE_FORM_LABEL_ACTION.fontSizeFp * 2 * scale }) }) });
    const panelConstants = selectedProductionValues(new URL(common('ReaderSelectPanel'), root), ['SELECT_PAD','CHEVRON_GAP','CHEVRON_W','SELECT_CHROME'], readerFoundationTokens);
    const PanelWidth = selectedProductionMethods(new URL(common('ReaderSelectPanel'), root), 'ReaderSelectPanel', ['resolvedWidth','resolvedChrome'], {
      ...readerFoundationTokens,...panelConstants,readerSelectMenuWidth,readerSelectAvailableWidth,readerWindowMetrics:()=>metrics,ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeLeft:()=>0,readerInteractiveSafeRight:()=>0 });
    const panelWidth = Object.assign(new PanelWidth(), { variant:'sourceGroup',controlWidth:sourceWidths.groupSelectWidth(),readerWindowMetricsRevision:1,menuKind:'standard',
      getUIContext:()=>({getMeasureUtils:()=>({measureText:()=>0}),px2vp:x=>x}),renderedValue:()=>'',renderedOptions:()=>[],measureTextStyle:()=>({fontSizeFp:13}) }).resolvedWidth();
    assert.ok(sourceWidths.groupSelectWidth()>=44 && panelWidth>=44,'actual Source trigger and zero-measure Panel minima pay percentage width');
    const controls = foundationControls({ windowMetrics: () => metrics });
    const optionTargets = inventory.targets.filter(t => ['status-chip', 'category-chip'].includes(t.sdkGroup));
    for (const [group, specId, label, layout, targetId, enabled = true] of [
      ...optionTargets.map(t => [t.sdkGroup, t.category ? 'source-management-category' :
        ['未检测', '自定义'].includes(t.label) ? 'source-management-status-wide' : 'source-management-status-compact', t.label, 'intrinsic', t.id, t.id !== 'status-custom']),
      ['row-login', 'source-management-login', '登录', 'intrinsic'],
      ['row-detect', 'source-management-detect', '检测', 'intrinsic'],
      ['footer-manage', 'source-management-manage', '批量管理', 'full'],
    ]) {
      let actions = 0;
      const actor = new controls.button.Component(undefined, { specId, label, layout, availableWidth: width - 38,
        scheme: 'day', actionEnabled: enabled, onAction: () => actions++ });
      actor.aboutToAppear(); actor.initialRender(); const frame = hit(controls.nodes(actor), group);
      assert.ok(Math.max(frame.height ?? 0, frame.constraintSize?.minHeight ?? 0) >= 44); frame.onClick(); assert.equal(actions, enabled ? 1 : 0);
      actor.actionEnabled = false; frame.onClick(); assert.equal(actions, enabled ? 1 : 0, 'existing callback obeys disabled state');
      record(group, width, scale, frame, { ...(targetId ? { targetId } : {}), label });
    }
    const labeled = labeledIconControls({ foundation: controls });
    const add = new labeled.component(undefined, { specId: 'source-management-add', label: '新增书源', icon: 'source_add', scheme: 'day' });
    add.aboutToAppear(); add.initialRender(); const addFrame = hit(labeled.nodes(add), 'footer-add');
    assert.ok(addFrame.height >= 44); record('footer-add', width, scale, addFrame);

    // The finite legacy icon resolver strips imports but not unrelated
    // re-exports. Exclude only AST ExportDeclarations in this local adapter;
    // the actual icon constants/resolver and shipping component stay intact.
    let iconSpecs = read(common('ReaderControlSpecs'));
    const iconTree = ts.createSourceFile(virtualFilePath('ReaderControlSpecs.ets'), iconSpecs, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const iconResolver = iconTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'resolveReaderIconButtonSpec');
    assert.ok(iconResolver);
    iconSpecs = iconSpecs.slice(0, iconResolver.end);
    for (const node of iconTree.statements.filter(ts.isExportDeclaration).reverse())
      if (node.end <= iconResolver.end) iconSpecs = iconSpecs.slice(0, node.getStart(iconTree)) + iconSpecs.slice(node.end);
    const icons = iconButtonControls({ specSource: iconSpecs }); let opens = 0;
    const tools = new icons.icon.Component(undefined, { specId: 'toolbar-compact', icon: 'tools', accessibilityLabel: '书源工具', onTap: () => opens++ });
    tools.aboutToAppear(); tools.initialRender(); const toolsFrame = hit(icons.nodes(tools), 'header-tools');
    assert.deepEqual(toolsFrame.responseRegion, { x: 0, y: 0, width: 44, height: 44 });
    toolsFrame.onClick(); tools.aboutToDisappear(); toolsFrame.onClick(); assert.equal(opens, 1);
    record('header-tools', width, scale, toolsFrame);

    const toggleProps = createArkUIPropertyRuntimeProbe();
    const toggleDependencies = {...toggleProps.sdk,...switchSpecs(),readerAppColor};
    const toggleProbe = createReaderBuilderProbe(toggleSource,boundedMembers(toggleSource),toggleDependencies,toggleProps.hooks);
    let toggled=0;
    const toggle = new toggleProbe.Component(undefined,{specId:'standard-toggle',inputIdentity:'source:1',
      accessibilityLabel:'启用书源',onToggle:()=>toggled++});
    toggle.aboutToAppear();toggle.initialRender();
    const toggleFrame=[...toggle.nodes.values()].find(node=>node.type==='Toggle'&&node.onChange);
    assert.ok(toggleFrame);assert.equal(toggleFrame.width,44);assert.equal(toggleFrame.responseRegion.height,44);
    const toggleParent=[...toggle.nodes.values()].find(node=>node.type==='Stack');
    assert.equal(toggleParent.width,44);assert.equal(toggleParent.height,44,'actual switch lane pays its response');
    toggleFrame.onChange(true);toggle.isBusy=true;toggleFrame.onChange(true);assert.equal(toggled,1);
    record('row-toggle',width,scale,toggleFrame,{parentCarrier:{width:44,height:44}});

    const properties = createArkUIPropertyRuntimeProbe();
    const search = createReaderBuilderProbe(read(common('ReaderSearchField')), boundedMembers(read(common('ReaderSearchField'))),
      { ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles, ...accessibility, ...searchInputTarget, ...sizing,...areaHelpers, ...searchGeometry,
        readerWindowMetrics:()=>metrics, ReaderWindowCoordinator:{metrics:()=>metrics},readerAppColor,TextInputController:class{} }, properties.hooks).owner;
    const edits = []; let submits = 0;
    Object.assign(search, { variant: 'sourceManagement', mode: 'live', text: '书源', mounted: true, submitEnabled: true,
      readerWindowMetricsRevision: 1,
      placeholder: '搜索书源名称或域名', accessibilityLabel: '搜索书源名称或域名', appThemeScheme: 'day',
      onTextChange: v => edits.push(v), onSubmit: () => submits++ });
    search.autoLineHeightField();
    const input = [...search.nodes.values()].find(n => n.type === 'TextInput');
    const sourceStyle = readerTypographyRoles.TYPE_SEARCH_SOURCE_INPUT;
    const queryFieldHeight = sizing.readerScaledControlHeight(44, sourceStyle.lineHeightFp ?? sourceStyle.fontSizeFp * 1.5, scale);
    assert.equal(input.height, queryFieldHeight - 2);
    assert.deepEqual(input.responseRegion, accessibility.readerActionTouchRegion('100%', input.height));
    assert.equal(input.maxFontScale, scale, 'source query follows the actual current window font scale');
    input.onChange('new'); input.onSubmit(); assert.deepEqual(edits, ['new']); assert.equal(submits, 1);
    search.mounted = false; input.onChange('old'); input.onSubmit(); assert.deepEqual(edits, ['new']); assert.equal(submits, 1);
    record('query-input', width, scale, input, { boundary: 'growing field pays both border edges; actual input response reserves at least44; native parent clipping/focus not proved' });
    search.variant = 'readerDirectory'; search.autoLineHeightField();
    const otherInput = [...search.nodes.values()].filter(n => n.type === 'TextInput').at(-1);
    const directoryHeight=sizing.readerScaledControlHeight(32,24,scale);
    assert.equal(otherInput.height,directoryHeight,'directory input retains the actual compact typography recipe');
    assert.deepEqual(otherInput.responseRegion,{x:0,y:(directoryHeight-Math.max(44,directoryHeight))/2,width:'100%',height:Math.max(44,directoryHeight)},'directory owns a centered response inside its paid carrier');
    assert.equal(otherInput.maxFontScale,scale);
    const outsideCalls=[];
    new searchInputTarget.ReaderSearchInputTarget('rssPassive',44).applyNormalAttribute(new Proxy({},{get:(_target,key)=>(...args)=>outsideCalls.push([key,...args])}));
    assert.deepEqual(outsideCalls,[],'unselected RSS variant still does not acquire Source/directory response or font setters');

    const headerSdk = boundedSurfaceSdk(); let backs = 0;
    const header = headerSdk.consumer(read(common('PageBackBar')), boundedMembers(read(common('PageBackBar'))),
      { ...readerTypographyRoles,...readerFoundationTokens,...sizing,...raisedShape,...readerSurfaceSpecsForProbe(),
        APP_HEADER_BAR_HEIGHT:58,APP_FLOATING_HEADER_BAR_HEIGHT:52,
        readerWindowMetrics:()=>metrics,ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeLeft:()=>0,readerInteractiveSafeRight:()=>0,
        MangaDirectoryPressFeedback:productionMangaDirectoryPressFeedback() });
    Object.assign(header, { title: '书源管理', appThemeScheme: 'day', variant: 'standard', floating: false, centered: false,
      titleColor: '', surface: 'solid', elevation: 'fixed', material: 'solid', onBack: () => backs++ });
    header.panel(); const backFrame = hit(headerSdk.nodes(header), 'header-back');
    assert.equal(backFrame.width, 44); assert.equal(backFrame.height, 44); backFrame.onClick(); assert.equal(backs, 1);
    record('header-back', width, scale, backFrame);

    const directProps=createArkUIPropertyRuntimeProbe(),directTree=readerControlNativeTree(['Row','Stack','Button'],{crossComponent:true});
    class SearchPort {constructor(owner,params,storage,id){Object.assign(this,params,{owner,id});}}
    const directHooks={...directProps.hooks,...directTree.hooks,mountChildren:true,lifecycleChildren:true};
    const iconForPage=createReaderBuilderProbe(read(common('ReaderIconButton')),boundedMembers(read(common('ReaderIconButton'))),
      {...icons.dependencies,...directProps.sdk,...directTree.dependencies},directHooks).Component;
    const direct=createReaderBuilderProbe(read(pagePath),['searchField','importAction','importFocusId','sourceSearchInputIdentity','toolsFocusId'],
      {...directProps.sdk,...directTree.dependencies,...readerFoundationTokens,readerAppColor,ReaderIconButton:iconForPage,ReaderSearchField:SearchPort},
      {...directHooks,childSources:{ReaderIconButton:read(common('ReaderIconButton')),ReaderSearchField:read(common('ReaderSearchField'))}}).owner;
    let imports=0;
    Object.assign(direct,{mounted:true,temporaryBackIdentity:'source-current',searchInputRevision:0,appThemeScheme:'day',searchQuery:'',
      contentFrame:()=>({width:width-38}),layoutBudget:()=>({filterHeight:queryFieldHeight}),onAddSource:()=>imports++});
    direct.searchField();
    const directNodes=icons.nodes(direct),importFrame=hit(directNodes,'search-import');
    assert.equal(directTree.remaining(),0,'actual searchField/child create-pop are balanced');
    const importCarrier=directNodes.find(node=>node.nativeKey===importFrame.parentId);
    const searchRow=directNodes.find(node=>node.nativeKey===importCarrier?.parentId);
    assert.ok(importCarrier&&searchRow);assert.equal(importCarrier.type,'Stack');assert.equal(importCarrier.width,44);assert.equal(importCarrier.height,44);
    assert.equal(importCarrier.onClick,undefined,'non-interactive carrier creates no duplicate action');
    assert.equal(searchRow.type,'Row');assert.equal(searchRow.width,width-38);assert.ok(searchRow.height>=44);
    assert.equal(importFrame.width,40);assert.equal(importFrame.height,40);
    const importOffset={x:(importCarrier.width-importFrame.width)/2,y:(importCarrier.height-importFrame.height)/2};
    assert.deepEqual(importFrame.responseRegion,{x:-2,y:-2,width:44,height:44});importFrame.onClick();assert.equal(imports,1);
    const importResponse={x:importOffset.x+importFrame.responseRegion.x,y:importOffset.y+importFrame.responseRegion.y,
      width:importFrame.responseRegion.width,height:importFrame.responseRegion.height};
    assert.deepEqual(importResponse,{x:0,y:0,width:44,height:44});
    const searchFieldRow=[...search.nodes.values()].find(node=>node.type==='Row'&&node.width==='100%');
    const searchIcon=[...search.nodes.values()].find(node=>node.type==='Image');
    assert.equal(input.layoutWeight,1);assert.equal(searchFieldRow.width,'100%');
    const queryWidthMinimum=searchRow.width-importCarrier.width-searchRow.create.space-
      (searchFieldRow.padding.left+searchFieldRow.padding.right)-searchIcon.width-searchFieldRow.create.space-2*searchFieldRow.border.width;
    assert.ok(queryWidthMinimum>=44,'actual Row allocation pays query percentage response');
    Object.assign(records.find(r=>r.group==='query-input'&&r.width===width&&r.fontScaleContext===scale),
      {parentWidthMinimum:queryWidthMinimum,parentBasis:'actual Source search Row remainder minus field padding/icon/gap/border'});
    record('search-import',width,scale,importFrame,{parentCarrier:{width:44,height:44},paintOffset:importOffset,responseInCarrier:importResponse});

    const choice = choiceRowProbe();
    for (const specId of ['source-group-selected', 'source-group-option']) {
      const option = new choice.Component(undefined, { specId, label: '全部分组', wrapLabel: true,
        selected: specId.endsWith('selected'), scheme: 'day', actionEnabled: true, availableWidth: width - 76 });
      option.initialRender(); const optionFrame = hit(choice.nodes(option), specId);
      assert.ok(optionFrame.constraintSize.minHeight>=44); assert.equal(optionFrame.width,'100%');
      record('group-option', width, scale, optionFrame, { specId, parentWidthMinimum:panelWidth-2*readerFoundationTokens.TOK_BORDER_W, parentOuterWidthMinimum:panelWidth, parentBorderWidth:readerFoundationTokens.TOK_BORDER_W, parentBasis:'actual sourceGroup Panel outer resolvedWidth minus two actual border edges; Scroll and innerColumn100% content width, zero text measurement lower bound only', boundary: 'natural flow row; actual wrapped height must come from native Area' });
    }

    const selectProps = createArkUIPropertyRuntimeProbe();
    const select = createReaderBuilderProbe(read(common('ReaderSelect')), ['phoneTrigger','trigger','sourceGroupTrigger','triggerEnabled','triggerHeight','measuredValueHeight','dropdownAnimation'],
      { ...selectProps.sdk, ...readerFoundationTokens, ...readerTypographyRoles, ...accessibility, readerAppColor,
        ...selectedProductionValues(new URL(common('ReaderSelect'), root), ['TRIGGER_H']),
        readerMotionAnimateParam: () => ({ duration: 0 }) }, selectProps.hooks).owner;
    Object.assign(select, { value:'全部分组',variant:'sourceGroup',isOpen:false,reduceMotion:true,appThemeScheme:'day',mounted:true,actionEnabled:true,focusId:'source-group',options:['全部分组','A'],
      resolvedWidth: () => sourceWidths.groupSelectWidth(),
      getUIContext: () => ({ px2vp: v => v, getMeasureUtils: () => ({ measureTextSize: () => ({ height: Number.NaN }) }) }) });
    select.phoneTrigger(); const trigger = hit([...select.nodes.values()], 'group-trigger');
    assert.equal(trigger.height, 44); assert.equal(trigger.responseRegion.height, 44);
    record('group-trigger', width, scale, trigger, { parentWidthMinimum:sourceWidths.groupSelectWidth(), parentBasis:'actual Source groupSelectWidth/filterControlWidth compact allocation', boundary: 'native measure port returns NaN to exercise existing 15vp fallback/minimum; no font measurement claim' });

    const overlayProps = createArkUIPropertyRuntimeProbe(); class PanelPort { constructor(owner, params, storage, id) { Object.assign(this, params, { owner, id }); } }
    const overlayMetrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 844));
    const overlay = createReaderBuilderProbe(read(pagePath), ['groupOverlay','groupCloseAction','ownsGroupSelection','managementOpeningIsCurrent','requestGroupClose','cancelGroupFocus','groupPanelLayoutAction','groupPanelFocusPrefix',
      'overlayLeft','overlayRight','overlayTop','overlayBottom'],
      { ...overlayProps.sdk, ReaderSelectPanel: PanelPort, ReaderWindowCoordinator: { metrics: () => overlayMetrics },
        readerInteractiveSafeLeft, readerInteractiveSafeRight, readerInteractiveSafeTop, readerInteractiveSafeBottom },
      { ...overlayProps.hooks, childSources: { ReaderSelectPanel: read(common('ReaderSelectPanel')) } }).owner;
    Object.assign(overlay, { mounted: true, groupOpen: true, groupClosing: false, groupSelectionId: 'opening:1',
      groupValue: '全部分组', groupOptions: () => ['全部分组', '分组A'], groupSelectWidth: () => width - 110,
      viewportWidth: width, viewportHeight: 844, originX: 0, originY: 0 });
    overlay.groupOverlay(); const dismiss = hit([...overlay.nodes.values()], 'outside-dismiss');
    assert.equal(dismiss.width, '100%'); assert.equal(dismiss.height, '100%');
    overlay.groupSelectionId = 'opening:2'; dismiss.onClick(); assert.equal(overlay.groupClosing, false);
    overlay.groupSelectionId = 'opening:1'; dismiss.onClick(); assert.equal(overlay.groupClosing, true);
    record('outside-dismiss', width, scale, dismiss, { boundary: 'viewport region; actual z-order/native outside hit remains OPEN' });
  }
  console.log(JSON.stringify({ sdkContexts: 8, sdkSamples: records.length, coveredGroups: [...new Set(records.map(r => r.group))],
    boundary: 'Actual SDK properties/callbacks; not native hit, system scale, glyphs, keyboard, wrapping or overlay z-order.' }));
  recordContractCasePass('sdk-targets');
}

if (selected.includes('recovery-targets')) {
  const { boundedSurfaceSdk } = await import('../lib/bounded-surface-sdk-probe.mjs');
  let samples = 0;
  for (const width of [320, 366]) for (const scale of [1, 1.3, 1.6, 2]) {
    const sdk = boundedSurfaceSdk(); let reconciles = 0, continues = 0;
    const notice = sdk.consumer(read(common('ReaderRecoveryNotice')));
    Object.assign(notice, { view: { message: '原操作仍待核对', visible: true, canRetry: true, generation: 7 },
      tag: '待处理', actionLabel: '核对', secondaryActionLabel: '继续', clipped: true, expanded: false,
      onReconcile: g => { assert.equal(g, 7); reconciles++; }, onSecondaryAction: g => { assert.equal(g, 7); continues++; } });
    assert.equal(notice.actionsHeight, 44, 'unmeasured recovery lane reserves actual minimum height');
    notice.aboutToAppear();
    notice.initialRender();
    const actions = sdk.walk(notice).filter(a => a instanceof sdk.deps.ReaderRecoveryAction);
    assert.equal(actions.length, 3);
    for (const action of actions) {
      const hit = [...action.nodes.values()].find(n => n.onClick);
      assert.deepEqual(hit.constraintSize, { minHeight: 44, minWidth: 44, maxWidth: '100%' });
      assert.equal(hit.responseRegion, undefined, 'real layout lane grows; no overlapping external response region');
      records.push({ group: 'recovery-notice', widthContext: width, fontScaleContext: scale,
        fontEvidence: 'ambient-font-not-injected; context-tag-only', label: action.label,
        visual: { width: null, height: null, minimum: hit.constraintSize }, response: null, nativeResult: 'NOT_RUN' });
      hit.onClick(); samples++;
    }
    assert.equal(reconciles, 1); assert.equal(continues, 1); assert.equal(notice.expanded, true);
    const expandAction = actions.find(a => a.label === '展开');
    const staleExpand = [...expandAction.nodes.values()].find(n => n.onClick).onClick;
    assert.equal(expandAction.generation, 7, 'expansion carries the current notice generation, never default zero');
    notice.view = { ...notice.view, generation: 8 };
    const successorExpanded = notice.expanded;
    staleExpand(); assert.equal(notice.expanded, successorExpanded, 'old generation7 expand cannot toggle successor notice8');
    // Current8 uses the same shipping Action and original notice callback;
    // this independently mounted leaf is a current physical callback, without
    // pretending the test runtime implements native removal/reconciliation.
    const currentExpand = sdk.consumer(read(common('ReaderRecoveryAction')));
    Object.assign(currentExpand, { variant: 'notice', label: '展开', generation: 8,
      onReconcile: expandAction.onReconcile }); currentExpand.initialRender();
    const currentExpandClick = sdk.nodes(currentExpand).find(n => n.onClick).onClick;
    currentExpandClick(); assert.equal(notice.expanded, !successorExpanded, 'current generation8 controls its own notice');
    if (notice.expanded) currentExpandClick();
    assert.equal(notice.expanded, false, 'current generation8 can collapse its own notice');
    notice.view = { ...notice.view, visible: false };
    currentExpandClick(); assert.equal(notice.expanded, false, 'invisible notice rejects retained expand/collapse action');
    notice.view = { ...notice.view, visible: true };
    notice.clipped = false;
    currentExpandClick(); assert.equal(notice.expanded, false, 'no-longer-clipped notice rejects a retired expand target');
    notice.clipped = true;
    notice.view = { ...notice.view, visible: true, generation: 7 };
    const first = actions[0], oldClick = [...first.nodes.values()].find(n => n.onClick).onClick;
    first.generation = 8; oldClick(); assert.equal(reconciles, 1, 'old physical action cannot borrow a new generation');
    first.generation = 7; first.isBusy = true; oldClick(); assert.equal(reconciles, 1, 'busy action rejects old physical callback');
    const measured = [];
    notice.getUIContext = () => ({ px2vp: v => v, getMeasureUtils: () => ({
      measureText: o => { measured.push(o); return o.textContent === '\u00a0' ? 4 : o.textContent.length === 2 ? 8 : 100; },
      measureTextSize: o => ({ width: 100, height: o.maxLines === 3 ? 22 : 44 }),
    }) });
    notice.measureFlow(width - 62);
    assert.equal(notice.actionsWidth, 132, 'three short actions each reserve true 44vp minimum, rather than label width plus chrome');
    assert.ok(measured.some(o => o.textContent === '展开'));
    const flex = sdk.nodes(notice).find(n => n.type === 'Flex');
    assert.ok(flex.create.wrap, 'parent retains native wrapping rather than overlapping external targets');
    const area = { height: 88 };
    flex.onAreaChange({}, area); assert.equal(notice.actionsHeight, 88, 'actual wrapped Area replaces initial height');
    notice.actionLabel = '很长的核对原操作按钮'; notice.secondaryActionLabel = '';
    notice.measureFlow(90); assert.equal(notice.actionsWidth, 90, 'width remains bounded to actual available lane');
    for (const variant of ['compact', 'rssManagement', 'notice', 'text']) {
      const action = sdk.consumer(read(common('ReaderRecoveryAction')));
      Object.assign(action, { variant, label: '好' }); action.initialRender();
      const hit = sdk.nodes(action).find(n => n.onClick);
      assert.ok(hit.constraintSize.minWidth >= 44 && hit.constraintSize.minHeight >= 44,
        `${variant}: even a one-character action reserves a real minimum lane`);
    }
    for (const [label, group] of [['刷新列表', 'recovery-compact'], ['重试', 'page-state'], ['清除筛选', 'page-state']]) {
      const state = group === 'page-state' ? sdk.consumer(read(common('ReaderPageState'))) : sdk.consumer(read(common('ReaderRecoveryAction')));
      Object.assign(state, group === 'page-state' ? { title: '没有匹配的书源', message: '', actionLabel: label } : { label });
      state.initialRender(); const hit = sdk.nodes(state).find(n => n.onClick);
      assert.ok(hit.constraintSize.minWidth >= 44 && hit.constraintSize.minHeight >= 44);
      records.push({ group, widthContext: width, fontScaleContext: scale, fontEvidence: 'ambient-font-not-injected; context-tag-only',
        label, visual: { width: null, height: null, minimum: hit.constraintSize }, response: null, nativeResult: 'NOT_RUN' });
      samples++;
    }
    for (const state of [
      { label: 'none', actionLabel: '', secondaryActionLabel: '', canRetry: false, busy: false, clipped: false, count: 0 },
      { label: 'busy-only', actionLabel: '核对', secondaryActionLabel: '', canRetry: false, busy: true, clipped: false, count: 1 },
      { label: 'secondary-only', actionLabel: '', secondaryActionLabel: '继续', canRetry: false, busy: false, clipped: false, count: 1 },
    ]) {
      const branchSdk = boundedSurfaceSdk(); let calls = 0;
      const branch = branchSdk.consumer(read(common('ReaderRecoveryNotice')));
      Object.assign(branch, { view: { message: '原操作', visible: true, canRetry: state.canRetry, generation: 9 },
        actionLabel: state.actionLabel, secondaryActionLabel: state.secondaryActionLabel,
        busy: state.busy, clipped: state.clipped, onReconcile: () => calls++, onSecondaryAction: () => calls++ });
      branch.aboutToAppear();
      branch.initialRender();
      const branchActions = branchSdk.walk(branch).filter(a => a instanceof branchSdk.deps.ReaderRecoveryAction);
      assert.equal(branchActions.length, state.count, state.label);
      for (const action of branchActions) {
        const hit = [...action.nodes.values()].find(n => n.onClick);
        assert.ok(hit.constraintSize.minWidth >= 44 && hit.constraintSize.minHeight >= 44);
        hit.onClick();
      }
      assert.equal(calls, state.label === 'secondary-only' ? 1 : 0, 'busy-only cannot redispatch; secondary retains independent callback');
      if (state.label === 'busy-only') assert.ok(branchSdk.nodes(branch).some(n => n.type === 'LoadingProgress' && n.width === 18 && n.height === 18));
      assert.equal(branchActions.some(a => a.label === '展开'), false, 'unclipped branch has no expansion target');
      if (state.label === 'none') {
        const measuredFlex = branchSdk.nodes(branch).find(n => n.type === 'Flex');
        measuredFlex.onAreaChange({}, { height: 0 }); assert.equal(branch.actionsHeight, 0, 'empty action lane accepts native zero Area');
      }
    }
  }
  console.log(JSON.stringify({ recoverySamples: samples, contextLoops: 8,
    fontEvidence: 'No font-scale injection into ambient-fp Recovery actors; repeated contexts prove invariant min44 properties only, not four-font native layouts.',
    boundary: 'Native measure port is finite test data for reservation arithmetic; actual native wrapping, paint and pointer dispatch remain OPEN.' }));
  recordContractCasePass('recovery-targets');
}

if (selected.length) {
  const inputPaths = [
    inventoryPath, pagePath, ...new Set(inventory.targets.map(target => target.drawHost.path)),
    'entry/src/main/ets/app/BookRequestScheduler.ts',
    'entry/src/main/ets/app/ErrorMessage.ts',
    'entry/src/main/ets/app/LogPrivacy.ts',
    'entry/src/main/ets/app/ReaderOperationFacts.ts',
    'entry/src/main/ets/app/ReaderRecoveryProjection.ts',
    'entry/src/main/ets/app/ReaderStartupTrace.ts',
    'entry/src/main/ets/app/ReaderWriteEvidence.ts',
    'entry/src/main/ets/app/composition/JsonImportPresentation.ets',
    'entry/src/main/ets/app/composition/ReaderSourceSwitchActions.ets',
    'entry/src/main/ets/app/library/BookAcquisitionPresentation.ts',
    'entry/src/main/ets/app/library/BookAuthorMetadata.ts',
    'entry/src/main/ets/app/library/BookSearchTiming.ts',
    'entry/src/main/ets/app/navigation/ReaderNavigation.ts',
    'entry/src/main/ets/features/bookshelf/application/BookshelfReadOwner.ts',
    'entry/src/main/ets/features/bookshelf/application/BookshelfReadableAdmissionOwner.ts',
    'entry/src/main/ets/features/bookshelf/application/BookshelfSourceNameProjection.ts',
    'entry/src/main/ets/features/bookshelf/presentation/BookRemovalDialogPresentation.ts',
    'entry/src/main/ets/features/downloads/ui/DownloadTypography.ets',
    'entry/src/main/ets/features/downloads/ui/SharedDownloadVisualSpec.ts',
    'entry/src/main/ets/features/manga/presentation/MangaBookPresentation.ts',
    'entry/src/main/ets/features/manga/presentation/MangaDirectoryPresentation.ts',
    'entry/src/main/ets/features/manga/ui/MangaDirectoryDisplay.ts',
    'entry/src/main/ets/features/manga/ui/MangaDirectoryEntryRow.ets',
    'entry/src/main/ets/features/manga/ui/MangaDirectoryLayout.ts',
    'entry/src/main/ets/features/manga/ui/MangaDirectoryState.ts',
    'entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts',
    'entry/src/main/ets/features/reading/application/ReaderDirectoryBackfill.ts',
    'entry/src/main/ets/features/reading/application/ReaderDirectoryDisplayMetadata.ts',
    'entry/src/main/ets/features/reading/application/ReaderDirectoryNavigation.ts',
    'entry/src/main/ets/features/reading/application/ReadingOfflineContract.ts',
    'entry/src/main/ets/features/reading/presentation/ReaderBookmarkAnchorRequest.ts',
    'entry/src/main/ets/features/reading/presentation/ReaderDirectoryOperations.ts',
    'entry/src/main/ets/features/reading/presentation/ReadingBookDetail.ts',
    'entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts',
    'entry/src/main/ets/features/reading/presentation/ReadingEntryDto.ts',
    'entry/src/main/ets/features/reading/presentation/ReadingEntryPresentation.ets',
    'entry/src/main/ets/features/reading/presentation/ReadingFailurePresentation.ts',
    'entry/src/main/ets/features/reading/presentation/ReadingOfflineFailurePresentation.ts',
    'entry/src/main/ets/features/reading/ui/ReaderControlSwitchTrack.ets',
    'entry/src/main/ets/features/source/application/ReaderSourceCategory.ts',
    'entry/src/main/ets/features/source/application/SourceSwitchGateway.ts',
    'entry/src/main/ets/features/source/presentation/SourceSwitchPresentation.ets',
    'entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts',
    'entry/src/main/ets/features/source/ui/SourceManagementPage.ets',
    'entry/src/main/ets/ui/chrome/PageBackBar.ets',
    'entry/src/main/ets/ui/controls/ReaderActionAccessibility.ets',
    'entry/src/main/ets/ui/controls/ReaderButton.ets',
    'entry/src/main/ets/ui/controls/ReaderChoiceRow.ets',
    'entry/src/main/ets/ui/controls/ReaderControlSpecs.ets',
    'entry/src/main/ets/ui/controls/ReaderFormField.ets',
    'entry/src/main/ets/ui/controls/ReaderFormRow.ets',
    'entry/src/main/ets/ui/controls/ReaderIconButton.ets',
    'entry/src/main/ets/ui/controls/ReaderLabeledIconAction.ets',
    'entry/src/main/ets/ui/controls/ReaderLabeledIconActionSpecs.ets',
    'entry/src/main/ets/ui/controls/ReaderSearchField.ets',
    'entry/src/main/ets/ui/controls/ReaderSectionHeading.ets',
    'entry/src/main/ets/ui/controls/ReaderSegmentedControl.ets',
    'entry/src/main/ets/ui/controls/ReaderSelect.ets',
    'entry/src/main/ets/ui/controls/ReaderSelectPanel.ets',
    'entry/src/main/ets/ui/controls/ReaderToggle.ets',
    'entry/src/main/ets/ui/feedback/ReaderPageState.ets',
    'entry/src/main/ets/ui/feedback/ReaderRecoveryAction.ets',
    'entry/src/main/ets/ui/feedback/ReaderRecoveryNotice.ets',
    'entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts',
    'entry/src/main/ets/ui/foundation/MangaDirectoryPressFeedback.ets',
    'entry/src/main/ets/ui/foundation/ReaderDirectoryChromeVisual.ts',
    'entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts',
    'entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts',
    'entry/src/main/ets/ui/foundation/ReaderLayoutTokens.ts',
    'entry/src/main/ets/ui/foundation/ReaderMessageStyle.ets',
    'entry/src/main/ets/ui/foundation/ReaderPressFeedback.ets',
    'entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts',
    'entry/src/main/ets/ui/foundation/ReaderSelectGeometry.ts',
    'entry/src/main/ets/ui/foundation/ReaderSourceChromeVisual.ts',
    'entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts',
    'entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts',
    'entry/src/main/ets/ui/foundation/ReaderTokens.ets',
    'entry/src/main/ets/ui/foundation/ReaderTypography.ets',
    'entry/src/main/ets/ui/foundation/ReaderWindowEnvironment.ts',
    'entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts',
    'entry/src/main/ets/ui/layout/ReaderFloatingBarMetrics.ts',
    'entry/src/main/ets/ui/layout/ReaderPageNativeAttributes.ets',
    'entry/src/main/ets/ui/layout/ReaderPageShell.ts',
    'entry/src/main/ets/ui/layout/ReaderRaisedShape.ts',
    'entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts',
    'entry/src/main/ets/ui/surfaces/ReaderActionMenuSurface.ets',
    'entry/src/main/ets/ui/surfaces/ReaderBoundedSurface.ets',
    'entry/src/main/ets/ui/surfaces/ReaderBoundedSurfaceActions.ets',
    'entry/src/main/ets/ui/surfaces/ReaderBoundedSurfaceHeader.ets',
    'entry/src/main/ets/ui/surfaces/ReaderCard.ets',
    'entry/src/main/ets/ui/surfaces/ReaderCardSpecs.ets',
    'entry/src/main/ets/ui/surfaces/ReaderPanelFrame.ets',
    'entry/src/main/ets/ui/surfaces/ReaderSurfaceSpecs.ets',
    'entry/vendor/core-harmony/sdk/reader_core.ts',
    'scripts/lib/development-environment.mjs',
    'scripts/lib/harmony-toolchain.mjs',
    'tools/fixtures/reader-control-native-tree.mjs',
    'tools/lib/arkui-property-runtime-probe.mjs',
    'tools/lib/bookshelf-operation-owner-probe.mjs',
    'tools/lib/bounded-surface-sdk-probe.mjs',
    'tools/lib/contract-case-selection.mjs',
    'tools/lib/ets-compiler-runtime.mjs',
    'tools/lib/ets-pure-module-probe.mjs',
    'tools/lib/execution-input-trace.mjs',
    'tools/lib/json-import-presentation-probe.mjs',
    'tools/lib/manga-directory-entry-row-probe.mjs',
    'tools/lib/manga-directory-press-feedback-probe.mjs',
    'tools/lib/reader-choice-row-probe.mjs',
    'tools/lib/reader-control-builder-probe.mjs',
    'tools/lib/reader-directory-operations-probe.mjs',
    'tools/lib/reader-foundation-control-probe.mjs',
    'tools/lib/reader-icon-button-probe.mjs',
    'tools/lib/reader-labeled-icon-action-probe.mjs',
    'tools/lib/reader-page-builder-slots.mjs',
    'tools/lib/reader-page-shell-runtime-probe.mjs',
    'tools/lib/reader-press-feedback-probe.mjs',
    'tools/lib/reader-switch-control-probe.mjs',
    'tools/lib/reader-tokens-probe.mjs',
    'tools/lib/reader-typography-probe.mjs',
    'tools/lib/reader-window-environment-probe.mjs',
    'tools/lib/reading-entry-presentation-probe.mjs',
    'tools/lib/selected-production-methods.mjs',
    'tools/lib/source-switch-presentation-probe.mjs',
    'tools/lib/tool-environment.mjs',
    'tools/page-structure/lib.mjs',
    'tools/page-structure/source-interaction-inventory.json',
    'tools/page-structure/test-source-interaction-inventory.mjs',
  ];
  const report = { schemaVersion: '1.0', pageId: inventory.pageId, command: { entry: 'tools/page-structure/test-source-interaction-inventory.mjs', cases: selected },
    inputs: [...new Set(inputPaths)].map(path => ({ path, sha256: createHash('sha256').update(read(path)).digest('hex') })),
    templateIds: inventory.targets.map(t => t.id), targetTemplates: inventory.targets.length, records,
    results: { inventory: selected.includes('inventory') ? 'PASS' : 'NOT_RUN', sdkProperties: records.length ? 'PASS' : 'NOT_RUN', nativeHit: 'NOT_RUN', nativeFont: 'NOT_RUN', pageE2: 'FAIL', pageE3: 'FAIL' },
    boundary: 'Leaf carrier/property and caller-binding coverage. Conditional states are templates, not full-page native renders or all consumer route acceptance.' };
  if (evidencePath) writeFileSync(safePath(evidencePath), JSON.stringify(report, null, 2) + '\n');
}

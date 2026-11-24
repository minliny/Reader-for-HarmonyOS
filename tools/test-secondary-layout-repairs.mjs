import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe, productionReaderMotionSdk } from './lib/reader-control-builder-probe.mjs';
import { compileTailConsumer } from './lib/foundation-tail-consumer-probe.mjs';
import { productionMangaDirectoryPressFeedback } from './lib/manga-directory-press-feedback-probe.mjs';
import { downloadChapterDetailLabel } from '../entry/src/main/ets/features/downloads/presentation/SharedDownloadProjection.ts';
import { resolveReaderRaisedShape } from '../entry/src/main/ets/ui/layout/ReaderRaisedShape.ts';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { actualReaderPageLayout } from './lib/reader-page-shell-runtime-probe.mjs';
import { boundedMembers, boundedSurfaceSdk, readerSurfaceSpecsForProbe } from './lib/bounded-surface-sdk-probe.mjs';
import { foundationControls, foundationSpecs, withReaderSectionHeading, readerFoundationTokens, surfaceFontResolvers } from './lib/reader-foundation-control-probe.mjs';
import { labeledIconControls } from './lib/reader-labeled-icon-action-probe.mjs';
import { switchSpecs, toggleSource } from './lib/reader-switch-control-probe.mjs';
import { inlineSelectSdk } from './lib/reader-inline-select-sdk-probe.mjs';
import { readerEditingSdk } from './lib/reader-editing-sdk-probe.mjs';
import { productionReaderPressFeedback } from './lib/reader-press-feedback-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionMethods, selectedProductionValues } from './lib/selected-production-methods.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import * as safe from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { SOURCE_GROUP_SELECT_RADIUS } from '../entry/src/main/ets/ui/foundation/ReaderSelectGeometry.ts';
import { consumeReaderControlKeyboardBack } from '../entry/src/main/ets/ui/foundation/ReaderKeyboardBack.ts';
import { actualSourceManagementGeometry } from './lib/source-management-owner-probe.mjs';
import { SOURCE_CHROME_VISUAL as visual } from '../entry/src/main/ets/ui/foundation/ReaderSourceChromeVisual.ts';
import * as headers from '../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
import { DOWNLOAD_VISUAL, downloadVisualColor, sharedDownloadContentInsets } from '../entry/src/main/ets/features/downloads/ui/SharedDownloadVisualSpec.ts';

const selected = selectContractCases({
  'download-accessibility': 'Actual SDK book/chapter selection names and states, chapter action role, and retired-generation callback rejection.',
  'select-host': 'Actual sourceGroup panel SDK viewport and anchor inside short/IME/zero host, old330 rejected.',
  'actions-tools-rules': 'Actual Tools/Rules/equal consumers SDK parent carriers and bundled FreeType CJK text at320/366 x1/1.45/2.',
  'recovery-overlays': 'Actual notice/action SDK bounded expanded document, zero budget and generation retirement, overlay caller bounds.',
  'arkweb-host': 'Actual serialized Web host SDK current toolbar and safe viewport, target sizing and keyboard Back.',
  'download-controls': 'Actual Download query/retry Native44 and all six InlineSelect sites at1/1.45/2. No Web or Pilot case nesting.',
  'renderer-pilot': 'Actual diagnostic menu Native targets and bounded Scroll at180/60/0, retained specialized return actions and weighted Web remainder.',
  'download-chapter-width': 'Actual Download chapter List row title/tag/trail budget at320/366 safe0/40each scale1/2/3 with current scope and old23vp failure.',
  'retained-and-settings': 'Actual retained Discover/RSS/Sync consumers and bounded Settings phone/tablet menus. Product gate frozen.',
  'title-scale': 'Actual standard and action-sheet titles at2.5 with platformmax3 and current linebox parent.',
  'page-back-bar-title-wrap': 'Actual PageBackBar fixed heading wraps at original font with a naturally growing Row. Floating standard heading stays single-line. Old truncation fails.',
  'select-reduce-motion': 'Nine real InlineSelect callers and both directory/source-tool propagation chains preserve true/false preferences and popup lifecycle.',
  'bookshelf-group-recovery-capacity': 'Actual group build/surface/recovery pays current safe host capacity, including expanded long text, zero, busy and retired actions.',
});
const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = rel => readFileSync(new URL(rel, root), 'utf8');
const enums = name => new Proxy({}, { get: (_t, key) => `${name}.${String(key)}` });
const nativeEnums = Object.fromEntries(['Alignment', 'VerticalAlign', 'HorizontalAlign', 'FlexDirection', 'FlexWrap', 'FlexAlign', 'ItemAlign', 'TextAlign', 'TextOverflow', 'ScrollDirection', 'HitTestMode', 'BarState', 'WordBreak', 'ButtonType', 'ImageFit', 'FontWeight', 'AccessibilityRoleType'].map(name => [name, enums(name)]));
const { readerReadableFontScale, readerScaledControlHeight } = surfaceFontResolvers();
const results = [];
const glyphCache = new Map();
const glyphFonts = new Map();
function glyph(text, size, weight = 400) {
  const key = JSON.stringify([text, size, weight]);
  if (!glyphCache.has(key)) {
    const font = new URL(`../entry/src/main/resources/rawfile/NotoSansSC-UI${weight >= 600 ? 'Bold' : 'Regular'}.otf`, import.meta.url);
    glyphFonts.set(font.pathname, createHash('sha256').update(readFileSync(font)).digest('hex'));
    const value = JSON.parse(execFileSync('python3', ['-c', `from PIL import ImageFont\nimport sys,json\nf=ImageFont.truetype(sys.argv[1],round(float(sys.argv[3])*100))\nb=f.getbbox(sys.argv[2]);a,d=f.getmetrics()\nprint(json.dumps({'width':f.getlength(sys.argv[2])/100,'inkHeight':(b[3]-b[1])/100,'fontHeight':(a+d)/100}))`, font.pathname, text, String(size)], { encoding: 'utf8' }));
    glyphCache.set(key, value);
  }
  return glyphCache.get(key);
}
function metrics(width = 320, height = 360, scale = 2) {
  const value = new safe.ReaderWindowMetricsSnapshot(new safe.ReaderRectVp(0, 0, width, height));
  value.systemFontScale = scale; value.ready = true;
  value.systemInsets = new safe.ReaderInsetsVp(0, 24, 0, 16);
  return value;
}
function uiContext() {
  return { getFont: () => ({}), px2vp: x => x, getMaxFontScale: () => 3, animateTo(_p, action) { action(); },
    getMeasureUtils: () => ({ measureText: input => glyph(input.textContent, Number.parseFloat(input.fontSize), Number(input.fontWeight)).width,
      measureTextSize: input => ({ width: 280, height: input.maxLines === 3 ? 132 : 2200 }) }) };
}
function context(value) {
  const foundation = withReaderSectionHeading(foundationControls({ windowMetrics: () => value }));
  const labeled = labeledIconControls({ foundation });
  const toggleDeps = { ...foundation.dependencies, ...switchSpecs(), ...nativeEnums, readerAppColor, ReaderPressFeedback: productionReaderPressFeedback() };
  const toggleHooks = { ...foundation.hooks, childSources: { ...foundation.hooks.childSources, ReaderToggle: toggleSource } };
  const toggles = { dependencies: { ReaderToggle: createReaderBuilderProbe(toggleSource, boundedMembers(toggleSource), toggleDeps, toggleHooks).Component }, hooks: toggleHooks };
  const messages = boundedSurfaceSdk({ properties: foundation.properties, windowMetrics: () => value, allowEmptyBranchAdmission: true });
  const deps = { ...messages.deps, ...labeled.dependencies, ...toggles.dependencies, ...readerTypographyRoles, ...readerFoundationTokens,
    ...nativeEnums, ...safe, SOURCE_GROUP_SELECT_RADIUS, readerAppColor, readerReadableFontScale, readerScaledControlHeight,
    ReaderWindowCoordinator: { metrics: () => value }, readerWindowMetrics: () => value,
    readerPageAreaLength: x => Number.parseFloat(x), uiContext: uiContext(), LengthMetrics: { vp: x => x },
    LazyForEach: { create() {}, pop() {} }, registerReaderFonts() {} };
  const hooks = { ...foundation.hooks, childSources: { ...messages.childSources, ...labeled.hooks.childSources, ...toggles.hooks.childSources }, allowEmptyBranchAdmission: true };
  function actor(rel, names, fields = {}, definition = read(rel)) {
    const owner = createReaderBuilderProbe(definition, names, deps, hooks).owner;
    Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, mounted: true, ...fields });
    return owner;
  }
  return { foundation, deps, hooks, actor, nodes: owner => foundation.nodes(owner) };
}
function assertOuterAllocation(nodes, labels) {
  const wrappers = nodes.filter(n => n.type === '__Common__' && n.layoutWeight === 1);
  assert.ok(wrappers.length >= labels.length, 'Row siblings pay each Common allocation');
  for (const label of labels) {
    const button = nodes.find(n => n.type === 'Button' && n.accessibilityText === label);
    assert.ok(button, `actual Native Button for ${label}`);
    assert.equal(button.width, '100%', 'native leaf fills its Common allocation');
  }
}
function assertNaturalButton(node) {
  assert.equal(node.height, undefined, 'wrapped action uses native natural height');
  assert.ok(node.constraintSize.minHeight >= 44, 'Native Button pays44vp minimum');
}
function selectHost() {
  const value = metrics();
  const inline = inlineSelectSdk({ uiContext: uiContext(), dependencies: { readerWindowMetrics: () => value } });
  const Panel = inline.dependencies.ReaderSelectPanel;
  for (const height of [360, 180, 46, 0]) {
    const panel = new Panel(undefined, { variant: 'sourceGroup', value: '全部分组', options: Array.from({ length: 8 }, (_, i) => `长分组 ${i}`),
      x: 180, y: 250, hostTopVp: 0, hostBottomVp: height, reduceMotion: true, selectionId: `host:${height}` });
    panel.aboutToAppear(); panel.initialRender();
    const frame = inline.nodes(panel).find(n => n.type === 'Column' && n.position !== undefined);
    inline.nodes(panel).find(node => node.type === 'Column' && node.onAppear).onAppear(); inline.properties.flush();
    const scroll = inline.nodes(panel).find(n => n.type === 'Scroll');
    assert.ok(scroll, 'actual options have one Scroll');
    assert.ok(frame.position.y >= 0 && frame.position.y + frame.height <= height, 'panel y and viewport share the same actual host budget');
    if (height >= 46) assert.ok(frame.height - 2 >= 44, 'one actual44vp choice lane remains after both borders');
    if (height === 0) assert.equal(frame.height, 0, 'zero host never restores the330vp default');
    results.push({ case: 'select-host', height, y: frame.position.y, panelHeight: frame.height });
  }
  const parent = createReaderBuilderProbe(read('features/source/ui/SourceManagementPage.ets'), ['groupOverlay', 'groupOverlayTop',
    'recordGroupTrigger', 'numericAreaLength', 'visibleGroupOptions', 'groupSearchQuery', 'overlayTop', 'overlayBottom', 'overlayLeft', 'overlayRight'],
    { ...inline.dependencies, ...safe, ReaderWindowCoordinator: { metrics: () => value } }, inline.hooks).owner;
  Object.assign(parent, { mounted: true, groupOpen: true, groupValue: '全部分组', groupSelectionId: 'source:1',
    originX: 0, originY: 0, viewportWidth: 320, viewportHeight: 180, reduceMotion: true, groupClosing: false,
    groupOptions: () => Array.from({ length: 8 }, (_, index) => `组${index}`),
    groupCloseAction: () => () => {}, groupPanelFocusPrefix: () => '', groupPanelLayoutAction: () => () => {}, groupSearchField() {} });
  parent.recordGroupTrigger({ width: 100, height: 44, globalPosition: { x: 180, y: 90 } });
  parent.groupOverlay();
  const mounted = inline.walk(parent).find(actor => actor instanceof Panel);
  assert.ok(mounted);
  assert.equal(mounted.hostBottomVp, 180);
  assert.equal(mounted.hostTopVp, 90, 'Source caller reserves only the space below the measured anchor');
  assert.equal(mounted.controlWidth, 100);
  assert.equal(mounted.menuHeaderHeight, 44);
  function heightReceipts(Component) {
    value.systemFontScale = 1; value.windowRect.width = 320;
    const panel = new Component(undefined, { variant: 'sourceGroup', value: '全部分组', options: ['全部分组', '甲组', '乙组'],
      hostBottomVp: 360, reduceMotion: true, selectionId: 'heights:1' });
    panel.aboutToAppear(); panel.initialRender();
    const rows = inline.walk(panel).filter(actor => actor instanceof inline.dependencies.ReaderChoiceRow);
    const oldAreas = rows.map(row => inline.nodes(row).find(n => n.type === 'Button' && typeof n.onAreaChange === 'function').onAreaChange);
    // One cold native area per option. A sibling's result must not retire the others.
    oldAreas.forEach((deliver, index) => deliver({}, { height: 50 + index }));
    assert.equal(panel.optionHeights.size, 3, 'same valid frame accepts every option measurement');
    value.systemFontScale = 2; value.windowRect.width = 180;
    panel.readerWindowMetricsRevision += 1; panel.onGeometryChanged();
    assert.equal(panel.optionHeights.size, 0, 'new font and actual menu width invalidate old row cache');
    rows.forEach((row, index) => {
      row.onHeightChange = panel.optionHeightHandler(row.label, row.selected);
      row.replay();
      inline.nodes(row).find(n => n.type === 'Button' && typeof n.onAreaChange === 'function').onAreaChange({}, { height: 80 + index });
    });
    assert.equal(panel.optionHeights.size, 3, 'current font/width frame accepts every sibling once');
    oldAreas.forEach(deliver => deliver({}, { height: 999 }));
    assert.ok([...panel.optionHeights.values()].every(height => height >= 80 && height <= 82), 'old font and width native receipts cannot overwrite current heights');
    // Height-only changes retain the existing row shape budget.
    value.windowRect.height = 180; panel.readerWindowMetricsRevision += 1; panel.onGeometryChanged();
    assert.equal(panel.optionHeights.size, 3, 'unrelated vertical host changes preserve same-shape measurements');
  }
  heightReceipts(Panel);
  const rel = 'ui/controls/ReaderSelectPanel.ets', source = read(rel);
  const unguardedHeights = source.replace('generation === this.generation && identity === this.optionMeasurementIdentity()', 'generation === this.generation');
  const values = selectedProductionValues(new URL(rel, root), ['OPTION_H', 'SELECT_PAD', 'CHEVRON_GAP', 'CHEVRON_W', 'CHEVRON_H', 'SELECT_CHROME'], readerFoundationTokens);
  const UnsafePanel = createReaderBuilderProbe(unguardedHeights, boundedMembers(unguardedHeights), { ...inline.dependencies, ...values }, inline.hooks).Component;
  assert.throws(() => heightReceipts(UnsafePanel), /old font and width native receipts/, 'old generation-only height callback corrupts the current option cache');
  const old = source.replace('this.panelY()', 'this.y');
  const c = context(value), owner = c.actor(rel, ['build', 'panelBody', 'panelHeight', 'panelX', 'resolvedWidth', 'panelBackgroundColor', 'panelBorderColor'], {
    variant: 'sourceGroup', x: 20, y: 250, expandedHeight: 180, appThemeScheme: 'day', optionContent() {}, wrapsOptions: () => false,
    resolvedWidth: () => 180, panelX: () => 20, panelBackgroundColor: () => '', panelBorderColor: () => '' }, old);
  owner.initialRender();
  const before = c.nodes(owner).find(n => n.position);
  assert.throws(() => assert.ok(before.position.y + before.height <= 180), /AssertionError/, 'old source y overflows short host');
}
function actionsToolsRules() {
  for (const width of [320, 366]) for (const scale of [1, 1.45, 2]) {
    const value = metrics(width, 844, scale), c = context(value);
    const geometry = actualSourceManagementGeometry(value);
    const Standard = selectedProductionMethods(new URL('ui/layout/ReaderStandardPage.ets', root), 'ReaderStandardPage', ['refreshGeometry'], { ...geometry, readerWindowMetrics: () => value });
    const standard = Object.assign(new Standard(), { variant: 'tools', viewportWidth: width, viewportHeight: 844, geometryRevision: 0,
      measurementKey: 0, contentLeadingRail: 0, contentEndInset: -1, headerHeight: () => 58, footerHeight: () => 0 });
    standard.refreshGeometry();
    const card = new c.deps.ReaderCard(undefined, { specId: 'editor-section', content() {} }); card.initialRender();
    const cardFrame = c.nodes(card).find(n => n.type === 'Column');
    const cardWidth = standard.geometry.content.frame.width - 2 * (cardFrame.padding + cardFrame.border.width);
    const snapshot = { busy: false, sources: [{}], selectedSourceIds: ['a'], selectedSourceCount: 1, sourceListRevision: 1, selectionRevision: 1,
      editorSourceId: 'a', editorRevision: 1, batchCheck: { phase: 'idle', passed: 12345, failed: 12345, errors: 12345, total: 99999, completed: 34567, currentSourceName: '', results: [] } };
    const page = c.actor('features/source/ui/SourceToolsPage.ets', ['batchCard', 'batchButton', 'batchButtonLabel', 'batchButtonEnabled', 'batchButtonAction',
      'actionMinimumWidth', 'toolsFontScale', 'batchSelectionAction', 'batchCounter'], {
      snapshot, canWriteSources: () => true, toolsInputIsCurrent: () => true, batchControlsRenderKey: () => 'current', temporaryBackIdentity: 't' });
    page.batchCard();
    const nodes = c.nodes(page), labels = ['全选', '清空', '导出所选', '检测所选', '启用', '停用', '删除'];
    assertOuterAllocation(nodes, labels);
    const lanes = nodes.filter(n => n.type === 'Flex');
    assert.equal(lanes.length, 2); assert.ok(lanes.every(n => n.create.wrap === 'FlexWrap.Wrap'), 'actual batch lanes wrap at measured native minima');
    for (const label of labels) {
      const target = nodes.find(n => n.type === 'Button' && n.accessibilityText === label); assertNaturalButton(target);
      const naturalWidth = page.actionMinimumWidth(label), text = glyph(label, 12 * scale, 700);
      assert.ok(naturalWidth >= text.width + 20, 'actual bundled CJK width plus Button padding belongs to the Flex minimum');
      assert.ok(target.padding.top + target.padding.bottom >= 24);
      assert.ok(target.constraintSize.minHeight >= 44);
    }
    const requiredWidth = labels.slice(3).reduce((sum, label) => sum + page.actionMinimumWidth(label), 0) + 3 * 8;
    if (scale === 2) assert.ok(requiredWidth > cardWidth, 'four forced-inline old siblings cannot fit the actual Card');
    const cardMethods = ['batchCheckCard', 'batchCounter', 'batchCheckPercent', 'batchCheckPhaseLabel',
      'exportCard', 'fullWidthActionButton', 'editorCard', 'editorButton', 'editorButtonLabel', 'editorButtonEnabled',
      'actionMinimumWidth', 'toolsFontScale'];
    // Real production phase/readback predicates remain finite input seams here.
    c.deps.sourceEditorReadbackPending = () => false;
    const actualCards = createReaderBuilderProbe(read('features/source/ui/SourceToolsPage.ets'), cardMethods,
      { ...c.deps, sourceEditorReadbackPending: () => false }, c.hooks).owner;
    Object.assign(actualCards, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, mounted: true,
      snapshot: { ...snapshot, editorText: '{}' }, editorInputRevision: 0, canWriteSources: () => true,
      editorDraftIsEditable: () => true, editorDraftChange: () => () => {}, editorAction: () => () => {}, toolsInputIsCurrent: () => true });
    actualCards.batchCheckCard(); actualCards.exportCard(); actualCards.editorCard(1);
    const upperNodes = c.nodes(actualCards);
    for (const label of ['取消', '校验并保存', '导出全部书源']) assertNaturalButton(upperNodes.find(n => n.type === 'Button' && n.accessibilityText === label));
    for (const counter of upperNodes.filter(n => n.type === 'Text' && /^(所选项通过|所选项未通过|检测错误|剩余)/.test(n.create))) {
      assert.equal(counter.height, undefined); assert.equal(counter.width, undefined);
      assert.equal(counter.constraintSize.minHeight, undefined); assert.equal(counter.constraintSize.maxWidth, '100%');
      const measured = glyph(counter.create, counter.fontSize * scale, counter.fontWeight);
      const lines = Math.ceil(measured.width / (cardWidth - 16));
      assert.ok(measured.fontHeight <= counter.fontSize * 1.5 * scale, 'actual font box fits the native AUTO line box');
      if (scale === 2) assert.ok(lines * counter.fontSize * 1.5 * scale + counter.padding.top + counter.padding.bottom > 32, 'old fixed32 cannot contain the current counter line boxes');
    }
    const inline = inlineSelectSdk({ properties: c.foundation.properties, uiContext: uiContext(), dependencies: { readerWindowMetrics: () => value } });
    const debug = createReaderBuilderProbe(read('features/source/ui/SourceToolsPage.ets'), ['debugCard'],
      { ...c.deps, ...inline.dependencies }, { ...c.hooks, childSources: { ...c.hooks.childSources, ...inline.hooks.childSources } }).owner;
    Object.assign(debug, { appThemeScheme: 'day', snapshot: { ...snapshot, checkMode: 'search', checkDepth: 2, debugSourceId: '', debugKey: '', debugLogs: [] },
      debugInputRevision: 0, debugOptionsCurrent: () => true, debugKeyChange: () => () => {} });
    debug.debugCard();
    assert.ok(c.nodes(debug).some(n => n.type === 'TextInput' && n.height >= 44), 'actual debugCard native input owns44vp in its natural Card');
    const rules = c.actor('features/settings/ui/RulesManagementPage.ets', ['actionButton', 'actionAllowed', 'booleanField', 'entityRow', 'subscriptionRow', 'smallButton'], {
      snapshot: { busy: false }, replaceId: -1, txtId: -1, dictName: '', subId: -1,
      editSubscription() {}, subscriptionTypeLabel: () => '书源', draftIsCurrent: () => true, currentSubscription: () => undefined });
    rules.actionButton('替换规则', true, () => {}, false, true);
    rules.booleanField('自动更新标记', () => true, () => {}, 'geometry-draft');
    rules.entityRow(() => '很长的规则名称用于窄屏与大字体', () => 'https://example.org/very-long-subscription/url', () => {}, () => {});
    rules.subscriptionRow({ name: '很长的规则订阅名称', type: 0, url: 'https://example.org/rules/all', id: 1 });
    const ruleNodes = c.nodes(rules);
    for (const target of ruleNodes.filter(n => n.type === 'Button' && typeof n.onClick === 'function')) assertNaturalButton(target);
    assert.ok(ruleNodes.filter(n => n.type === 'Column' && [56, 60].includes(n.constraintSize?.minHeight)).every(n => n.height === undefined));
    assert.ok(ruleNodes.some(n => n.type === 'Row' && n.constraintSize?.minHeight === 44), 'boolean parent contains the native44 toggle');
    assert.ok(ruleNodes.filter(n => n.type === 'Flex').every(n => n.create.wrap === 'FlexWrap.Wrap'));
    results.push({ case: 'actions-tools-rules', width, scale, cardWidth, fourActionsNaturalWidth: requiredWidth, glyph: glyph('停止检测', 12 * scale, 700) });
  }
  const c = context(metrics()), rel = 'features/source/ui/SourceToolsPage.ets', source = read(rel);
  const old = source.replace(".layoutWeight(action === 'reconcile' ? undefined : 1)", '');
  assert.notEqual(old, source, 'controlled regression removes only the actual editor action outer allocation');
  const actor = c.actor(rel, ['editorButton', 'editorButtonLabel', 'actionMinimumWidth', 'toolsFontScale'],
    { editorButtonEnabled: () => true, editorAction: () => () => {} }, old); actor.editorButton(1, 'save');
  assert.throws(() => assertOuterAllocation(c.nodes(actor), ['校验并保存']), /Row siblings/, 'old inner-only equal allocation rejected');
  const specSource = read('ui/controls/ReaderControlSpecs.ets');
  const oldSpec = specSource.replace('SOURCE_TOOLS_ACTION.height = undefined;', 'SOURCE_TOOLS_ACTION.height = 44;');
  assert.notEqual(oldSpec, specSource);
  const oldControls = foundationControls({ specs: foundationSpecs(readerTypographyRoles, oldSpec), windowMetrics: () => metrics(320, 360, 2) });
  const oldButton = new oldControls.dependencies.ReaderButton(undefined, { specId: 'source-tools-action', label: '停止检测', layout: 'full' });
  oldButton.initialRender();
  const oldNative = oldControls.nodes(oldButton).find(n => n.type === 'Button');
  const oldShare = (256 - 3 * 8) / 4;
  const oldLines = Math.ceil(glyph('停止检测', 24, 700).width / oldShare);
  assert.throws(() => assert.ok(oldNative.height >= oldLines * 36), /AssertionError/, 'actual old fixed62 carrier fails the measured two-line glyph budget');
  const oldRulesSpec = specSource.replace('RULES_COMPACT.height = undefined; RULES_COMPACT.minHeight = 44; RULES_COMPACT.minWidth = 44;',
    'RULES_COMPACT.height = 30; RULES_COMPACT.minHeight = undefined; RULES_COMPACT.minWidth = undefined;');
  const oldRulesControls = foundationControls({ specs: foundationSpecs(readerTypographyRoles, oldRulesSpec), windowMetrics: () => metrics(320, 360, 1) });
  const oldRulesButton = new oldRulesControls.dependencies.ReaderButton(undefined, { specId: 'rules-compact', label: '删除' }); oldRulesButton.initialRender();
  assert.throws(() => assert.ok(oldRulesControls.nodes(oldRulesButton).find(n => n.type === 'Button').height >= 44), /AssertionError/, 'old30vp native Rules target rejected');
  const rulesSource = read('features/settings/ui/RulesManagementPage.ets');
  const fixedRules = rulesSource.replace('.constraintSize({ minHeight: 56 })', '.height(56)');
  const fixedRow = c.actor('features/settings/ui/RulesManagementPage.ets', ['entityRow', 'smallButton', 'actionAllowed'], { snapshot: { busy: false } }, fixedRules);
  fixedRow.entityRow(() => '长规则标题', () => 'https://example.test/long', () => {}, () => {});
  assert.throws(() => assert.ok(c.nodes(fixedRow).some(n => n.type === 'Column' && n.constraintSize?.minHeight === 56 && n.height === undefined)), /AssertionError/, 'oldfixed56 row rejected');
  // Direct equal callers exercise the same two actual carriers in retained pages.
  for (const [rel, method, args, fields, labels] of [
    ['features/sync/ui/SyncPage.ets', 'configActions', [], { canMutate: () => true }, ['测试网络连通性', '保存配置']],
    ['features/sync/ui/SyncPage.ets', 'manualActionButton', ['立即备份', true, () => {}], { canMutate: () => true }, ['立即备份']],
    ['features/rss/ui/RssSubscriptionManagementPage.ets', 'sourceDocumentAction', ['导入 RSS 源', () => {}], {}, ['导入 RSS 源']],
    ['features/rss/ui/RssEntryDetailPage.ets', 'bottomActions', [], { contentFrame: () => ({ width: 282, left: 19, right: 19 }), hasOriginalLink: () => true }, ['返回列表', '打开原文']],
  ]) {
    const owner = c.actor(rel, [method], fields); if (method === 'bottomActions') c.deps.RSS_DETAIL_ACTION_AREA_HEIGHT = 62;
    // Constants are resolved from the actual current module, not a replacement geometry.
    const actual = method === 'bottomActions' ? createReaderBuilderProbe(read(rel), [method], { ...c.deps, ...selectedProductionValues(new URL(rel, root), ['RSS_DETAIL_ACTION_AREA_HEIGHT']) }, c.hooks).owner : owner;
    Object.assign(actual, { appThemeScheme: 'day', ...fields }); actual[method](...args); assertOuterAllocation(c.nodes(actual), labels);
  }
}
function recoveryOverlays() {
  const value = metrics(), sdk = boundedSurfaceSdk({ windowMetrics: () => value, allowEmptyBranchAdmission: true });
  const source = read('ui/feedback/ReaderRecoveryNotice.ets');
  const notice = sdk.consumer(source, boundedMembers(source), { ...nativeEnums, uiContext: uiContext() });
  Object.assign(notice, { appThemeScheme: 'day', maxHeightVp: 200, layoutWidthVp: 344, view: { visible: true, message: '原操作仍待核对。'.repeat(1000), canRetry: true, generation: 7 },
    actionLabel: '核对', secondaryActionLabel: '继续', busy: false, secondaryBusy: false, tag: '待处理', expanded: true, clipped: true,
    actionsWidth: 280, actionsHeight: 44, titleLineHeight: 44, reservedSpace: '', onReconcile() {}, onSecondaryAction() {} });
  notice.aboutToAppear(); notice.expanded = true; notice.initialRender();
  const nodes = sdk.nodes(notice), scroll = nodes.find(n => n.type === 'Scroll');
  assert.ok(scroll); assert.equal(scroll.constraintSize.maxHeight, 200);
  assert.ok(nodes.some(n => n.type === 'Text' && n.maxLines === 10000), 'full message remains inside the Scroll');
  for (const action of ['核对', '继续', '收起']) assert.ok(nodes.some(n => n.type === 'Button' && n.accessibilityText === action), `complete ${action} action lives in bounded document`);
  const oldTextArea = nodes.find(n => n.type === 'Text' && n.maxLines === 10000).onAreaChange;
  const oldActionsArea = nodes.find(n => n.type === 'Flex' && typeof n.onAreaChange === 'function').onAreaChange;
  const collapse = nodes.find(n => n.type === 'Button' && n.accessibilityText === '收起').onClick;
  notice.maxHeightVp = 0; notice.replay(); sdk.properties.flush();
  assert.ok(sdk.nodes(notice).some(n => n.type === 'Scroll' && n.constraintSize?.maxHeight === 0), 'zero remains bounded');
  notice.view = { ...notice.view, generation: 8 }; notice.remeasure(); assert.equal(notice.expanded, false);
  collapse(); assert.equal(notice.expanded, false, 'old generation cannot expand or collapse current operation');
  notice.layoutWidthVp = 204;
  notice.flowAreaHandler()({}, { width: 180 });
  notice.actionsAreaHandler()({}, { height: 88 });
  oldTextArea({}, { width: 320 }); oldActionsArea({}, { height: 44 });
  assert.equal(notice.measuredWidth, 180, 'old gen7 native text area cannot overwrite gen8 current width');
  assert.equal(notice.actionsHeight, 88, 'old gen7 action area cannot overwrite gen8 current height');
  const oldLayoutText = notice.flowAreaHandler(), oldLayoutActions = notice.actionsAreaHandler();
  notice.layoutWidthVp = 264;
  notice.flowAreaHandler()({}, { width: 240 }); notice.actionsAreaHandler()({}, { height: 96 });
  oldLayoutText({}, { width: 180 }); oldLayoutActions({}, { height: 88 });
  assert.equal(notice.measuredWidth, 240); assert.equal(notice.actionsHeight, 96, 'same-generation old layout is also retired');
  const oldMetricsArea = notice.flowAreaHandler(); notice.readerWindowMetricsRevision += 1;
  oldMetricsArea({}, { width: 100 }); assert.equal(notice.measuredWidth, 240, 'old metrics area is retired');
  notice.aboutToDisappear(); notice.flowAreaHandler()({}, { width: 100 }); assert.equal(notice.measuredWidth, 240, 'retired mount cannot accept area');
  const unguarded = source.replace('.onAreaChange(this.flowAreaHandler())', '.onAreaChange((_old: Area, next: Area): void => this.measureFlow(Number(next.width)))')
    .replace('.onAreaChange(this.actionsAreaHandler())', '.onAreaChange((_old: Area, next: Area): void => { this.actionsHeight = Number(next.height); })');
  const unsafe = sdk.consumer(unguarded, boundedMembers(unguarded), { ...nativeEnums, uiContext: uiContext() });
  Object.assign(unsafe, { appThemeScheme: 'day', maxHeightVp: 200, layoutWidthVp: 344, view: { visible: true, message: '原操作', canRetry: true, generation: 7 },
    actionLabel: '核对', secondaryActionLabel: '继续', busy: false, secondaryBusy: false, tag: '待处理', expanded: true, clipped: true,
    actionsWidth: 280, actionsHeight: 44, titleLineHeight: 44, reservedSpace: '' });
  unsafe.aboutToAppear(); unsafe.expanded = true; unsafe.initialRender();
  const unsafeText = sdk.nodes(unsafe).find(n => n.type === 'Text' && n.maxLines === 10000).onAreaChange;
  const unsafeActions = sdk.nodes(unsafe).find(n => n.type === 'Flex' && typeof n.onAreaChange === 'function').onAreaChange;
  unsafe.view = { ...unsafe.view, generation: 8 }; unsafe.measuredWidth = 180; unsafe.actionsHeight = 88;
  unsafeText({}, { width: 320 }); unsafeActions({}, { height: 44 });
  assert.throws(() => assert.equal(unsafe.measuredWidth, 180), /AssertionError/, 'actual old inline Text callback corrupts current width');
  assert.throws(() => assert.equal(unsafe.actionsHeight, 88), /AssertionError/, 'actual old inline actions callback corrupts current height');

  function coldMeasurements(definition, order) {
    const cold = sdk.consumer(definition, boundedMembers(definition), { ...nativeEnums, uiContext: uiContext() });
    Object.assign(cold, { appThemeScheme: 'day', maxHeightVp: 200, layoutWidthVp: -1, readerWindowMetricsRevision: 1,
      view: { visible: true, message: '待核对'.repeat(100), canRetry: true, generation: 9 }, actionLabel: '核对原操作', secondaryActionLabel: '继续原操作',
      busy: false, secondaryBusy: false, tag: '待处理', expanded: false, clipped: false, actionsWidth: 0, actionsHeight: 44, titleLineHeight: 22, reservedSpace: '' });
    cold.aboutToAppear(); cold.initialRender();
    const initial = sdk.nodes(cold), textArea = initial.find(n => n.type === 'Text' && n.maxLines === 3).onAreaChange;
    const actionArea = initial.find(n => n.type === 'Flex' && typeof n.onAreaChange === 'function').onAreaChange;
    for (const part of order) {
      if (part === 'text') textArea({}, { width: 320 }); else actionArea({}, { height: 88 });
    }
    assert.equal(cold.measuredWidth, 320, 'cold valid text area is accepted exactly once');
    assert.equal(cold.actionsHeight, 88, 'cold valid actions area is accepted exactly once');
  }
  coldMeasurements(source, ['text', 'actions']); coldMeasurements(source, ['actions', 'text']);
  const selfInvalidating = source.replace('this.maxHeightVp, this.layoutWidthVp, this.readerWindowMetricsRevision]',
    'this.maxHeightVp, this.layoutWidthVp, this.readerWindowMetricsRevision, this.measuredWidth, this.actionsHeight]');
  assert.notEqual(selfInvalidating, source);
  assert.throws(() => coldMeasurements(selfInvalidating, ['text', 'actions']), /cold valid actions area/, 'result-keyed Text first loses valid same-frame Actions');
  assert.throws(() => coldMeasurements(selfInvalidating, ['actions', 'text']), /cold valid text area/, 'result-keyed Actions first loses valid same-frame Text');
  const old = source.replace('if (this.maxHeightVp >= 0)', 'if (false)');
  // A separate original build verifies the prior unbounded branch directly.
  const negative = sdk.consumer(old, boundedMembers(old), nativeEnums);
  Object.assign(negative, { appThemeScheme: 'day', view: { visible: true, message: '旧未决消息', generation: 1, canRetry: false }, maxHeightVp: 100, clipped: false, expanded: true, actionsWidth: 0, actionsHeight: 44, titleLineHeight: 22, reservedSpace: '', tag: '待处理', actionLabel: '', secondaryActionLabel: '' });
  negative.initialRender(); assert.throws(() => assert.ok(sdk.nodes(negative).some(n => n.type === 'Scroll')), /AssertionError/);
  const c = context(value);
  const boundCases = [
    ['app/composition/ReaderJourneyRecoveryNotices.ets', 'availableHeight', { hostHeight: 180, hostY: 0, topInset: 70 }, []],
  ];
  for (const [rel, method, fields, args] of boundCases) {
    const owner = c.actor(rel, [method], fields); assert.ok(owner[method](...args) <= 110);
  }
  for (const [rel, builder] of [['features/source/ui/SourceToolsPage.ets', 'pendingRecovery'],
    ['features/settings/ui/SettingsPage.ets', 'pendingFeedback']]) {
    const source = read(rel), { ts, options } = installedEtsCompiler();
    const tree = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, []);
    const component = tree.statements.find(node => ts.isStructDeclaration(node));
    const content = component.members.find(member => member.name?.getText(tree) === builder);
    assert.equal(content.parameters.length, 0, `${rel} supplies no page-local scalar geometry`);
    const slots = [];
    const visit = node => {
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'boundedOverlayContent') slots.push(node.initializer);
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.ok(slots.length > 0, `${rel} uses the live StandardPage bounded host`);
    for (const slot of slots) {
      assert.equal(slot.parameters.length, 0);
      assert.match(slot.body.getText(tree), new RegExp(`this\\.${builder}\\(\\)`));
    }
  }
  const standard = standardRecoveryDocument(c, { width: 320, height: 180, header: 70, content() {} });
  const frame = c.nodes(standard).find(node => node.type === 'Scroll');
  assert.ok(frame && frame.constraintSize.maxHeight > 0 && frame.constraintSize.maxHeight <= 110);
  assert.equal(frame.margin.top, standard.geometry.content.startInset);
  assert.equal(frame.width, standard.geometry.content.frame.width);
  assert.ok(frame.margin.top + frame.constraintSize.maxHeight <= standard.geometry.footer.top);
  for (const rel of ['features/source/ui/SourceManagementPage.ets', 'features/source/ui/SourceSwitchWindow.ets', 'features/downloads/ui/SharedDownloadPage.ets']) assert.match(read(rel), /maxHeightVp:/, `${rel} explicitly supplies its actual host remainder`);
  results.push({ case: 'recovery-overlays', fullMessageActions: 3, zeroBudget: 'bounded', staleGeneration: 'rejected', oldGenerationArea: 'rejected', sameGenerationOldLayoutArea: 'rejected', oldMetricsArea: 'rejected', retiredMountArea: 'rejected', oldInlineAreaMutation: 'reproduced-and-rejected', coldTextThenActions: 'PASS-one-delivery-each', coldActionsThenText: 'PASS-one-delivery-each', resultKeyedMutation: 'rejected-both-orders' });
}
function arkwebHost() {
  for (const scale of [1, 1.45, 2]) {
    const value = metrics(320, 360, scale), c = context(value), calls = [], current = { id: 1, controller: {} };
    const executor = { isSurfaceCurrent: surface => surface === current, cancelInteractive: surface => calls.push(['cancel', surface.id]), finishInteractive: surface => calls.push(['finish', surface.id]) };
    const source = read('ui/platform/ArkWebExecutionHost.ets');
    const members = ['build', 'surfacesForRender', 'safeLeft', 'safeTop', 'safeWidth', 'safeHeight', 'toolbarHeight', 'toolbarAreaHandler', 'fontScale', 'consumeBack'];
    const owner = createReaderBuilderProbe(source, members, { ...c.deps, ArkWebExecutor: { instance: executor }, ReaderActionAccessibility: class { applyNormalAttribute() {} },
      consumeReaderControlKeyboardBack, inputMethod: { getController: () => ({ hideTextInput: () => { calls.push(['keyboard']); return Promise.resolve(); } }) }, hilog: { warn() {} } }, c.hooks).owner;
    Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, mounted: true, currentSurface: current, interactiveBackSurface: current,
      surfaceId: 1, interactive: true, title: '书源网页登录', currentUrl: 'https://example.test/login', hostWidth: 320, hostHeight: 360, hostX: 0, hostY: 0,
      measuredToolbarHeight: 0 });
    owner.initialRender(); const nodes = c.nodes(owner), web = nodes.find(n => n.type === 'Web'), toolbar = nodes.find(n => n.type === 'Scroll');
    assert.equal(web.position.y, toolbar.position.y + toolbar.height, 'Web starts below the actual toolbar viewport');
    assert.ok(web.position.y + web.height <= 344 && web.position.y >= 24); assert.ok(web.width <= 320);
    const actions = nodes.filter(n => n.type === 'Button'); assert.equal(actions.length, 2);
    assert.ok(actions.every(n => n.constraintSize.minWidth >= 44 && n.constraintSize.minHeight >= 44));
    assert.equal(owner.consumeBack(), true); assert.deepEqual(calls.at(-1), ['cancel', 1]);
    value.keyboardInsets = new safe.ReaderInsetsVp(0, 0, 0, 180);
    assert.equal(owner.consumeBack(), true); assert.deepEqual(calls.at(-1), ['keyboard'], 'IME dismissal precedes cancellation');
    const background = createReaderBuilderProbe(source, members, { ...c.deps, ArkWebExecutor: { instance: executor } }, c.hooks).owner;
    Object.assign(background, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, currentSurface: current, surfaceId: 1, interactive: false });
    background.initialRender();
    const hidden = c.nodes(background).find(n => n.type === 'Web'); assert.equal(hidden.width, '100%'); assert.equal(hidden.height, '100%'); assert.equal(hidden.focusable, false);
    assert.ok(c.nodes(background).some(n => n.type === 'Stack' && n.width === 1 && n.height === 1), 'background Web keeps1px execution host');
    if (scale === 1) {
      const coveredSource = source.replace('y: this.interactive ? this.safeTop() + this.toolbarHeight() : 0', 'y: 0');
      assert.notEqual(coveredSource, source);
      const covered = createReaderBuilderProbe(coveredSource, members, { ...c.deps, ArkWebExecutor: { instance: executor }, ReaderActionAccessibility: class { applyNormalAttribute() {} } }, c.hooks).owner;
      Object.assign(covered, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, mounted: true, currentSurface: current, surfaceId: 1,
        interactive: true, title: '旧宿主', currentUrl: 'https://example.test/login', hostWidth: 320, hostHeight: 360, hostX: 0, hostY: 0, measuredToolbarHeight: 0 });
      covered.initialRender(); const before = c.nodes(covered);
      assert.throws(() => assert.equal(before.find(n => n.type === 'Web').position.y,
        before.find(n => n.type === 'Scroll').position.y + before.find(n => n.type === 'Scroll').height), /AssertionError/, 'actual old full-Web-under-overlay top0 is rejected');
    }
    results.push({ case: 'arkweb-host', scale, toolbarHeight: toolbar.height, webY: web.position.y, webHeight: web.height });
  }
}
function retainedAndSettings() {
  const { ts, options, root: sdkRoot } = installedEtsCompiler();
  const alignmentStatements = (source, file) => {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const statements = [];
    const visit = node => {
      if (ts.isEtsComponentExpression(node) && ['Flex', 'Column'].includes(node.expression.getText(tree))) {
        const component = node.expression.getText(tree);
        const fields = component === 'Flex' ? (node.arguments[0]?.properties ?? [])
          .filter(property => ['alignItems', 'justifyContent'].includes(property.name?.getText(tree))).map(property => property.getText(tree)) : [];
        let cursor = node;
        const modifiers = [];
        while (ts.isPropertyAccessExpression(cursor.parent) && cursor.parent.expression === cursor &&
          ts.isCallExpression(cursor.parent.parent) && cursor.parent.parent.expression === cursor.parent) {
          const call = cursor.parent.parent;
          if (['alignItems', 'justifyContent'].includes(cursor.parent.name.text))
            modifiers.push(`.${cursor.parent.name.text}(${call.arguments.map(argument => argument.getText(tree)).join(', ')})`);
          cursor = call;
        }
        if (component === 'Flex' || modifiers.length)
          statements.push((component === 'Flex' ? `Flex({ ${fields.join(', ')} })` : 'column') + modifiers.join('') + ';');
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    return statements;
  };
  const alignmentDiagnostics = (source, file) => {
    const virtual = '/ReaderRetainedAlignmentSdkCheck.ts';
    const text = 'declare const column: ColumnAttribute;\n' + alignmentStatements(source, file).join('\n');
    const checkOptions = { noEmit: true, skipLibCheck: true, types: [], target: ts.ScriptTarget.ES2022 };
    const host = ts.createCompilerHost(checkOptions), getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (name, ...args) => name === virtual ? ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true) : getSourceFile(name, ...args);
    const declarations = ['common', 'enums', 'flex', 'column'].map(name => `${sdkRoot}/declarations/${name}.d.ts`);
    return ts.getPreEmitDiagnostics(ts.createProgram([virtual, ...declarations], checkOptions, host))
      .filter(value => value.file?.fileName === virtual).map(value => ({ code: value.code, message: ts.flattenDiagnosticMessageText(value.messageText, '\n') }));
  };
  const rssSource = read('features/rss/ui/RssPage.ets'), syncSource = read('features/sync/ui/SyncPage.ets');
  const managementSource = read('features/rss/ui/RssSubscriptionManagementPage.ets');
  for (const [file, source] of [['RssPage.ets', rssSource], ['SyncPage.ets', syncSource], ['RssSubscriptionManagementPage.ets', managementSource]])
    assert.deepEqual(alignmentDiagnostics(source, file), [], `${file} actual Flex/Column alignments type-check against installed SDK declarations`);
  const oldRssInner = rssSource.replace('.margin({ left: this.headerLeftInset() });\n    }', '.margin({ left: this.headerLeftInset() }).alignItems(VerticalAlign.Center);\n    }');
  const oldRssJustify = rssSource.replace('.constraintSize({ minHeight: 58 })', '.constraintSize({ minHeight: 58 }).justifyContent(FlexAlign.SpaceBetween)');
  const oldRssAlign = rssSource.replace('.constraintSize({ minHeight: 58 })', '.constraintSize({ minHeight: 58 }).alignItems(VerticalAlign.Center)');
  const oldSyncFlex = syncSource.replace(".width('100%');\n\n        Row() {", ".width('100%').alignItems(VerticalAlign.Center);\n\n        Row() {");
  for (const [file, source, attribute] of [['RssPage.ets', oldRssInner, 'alignItems'], ['RssPage.ets', oldRssJustify, 'justifyContent'],
    ['RssPage.ets', oldRssAlign, 'alignItems'], ['SyncPage.ets', oldSyncFlex, 'alignItems']]) {
    assert.notEqual(source, file === 'RssPage.ets' ? rssSource : syncSource);
    const errors = alignmentDiagnostics(source, file);
    assert.equal(errors.length, 1, `${file} former chained Flex.${attribute} reaches the SDK semantic checker independently`);
    assert.ok(errors[0].code === 2339 && errors[0].message.includes(`Property '${attribute}' does not exist on type 'FlexAttribute'`));
  }
  const wrongFlexEnum = rssSource.replaceAll('alignItems: ItemAlign.Center', 'alignItems: VerticalAlign.Center');
  const flexEnumErrors = alignmentDiagnostics(wrongFlexEnum, 'RssPage.ets');
  assert.equal(flexEnumErrors.length, 3);
  assert.ok(flexEnumErrors.every(error => error.code === 2322 && /VerticalAlign.*ItemAlign/.test(error.message)), 'Flex constructor rejects the former Row enum');
  const oldColumn = managementSource.replace('.constraintSize({ minHeight: 44 })\n    .alignItems(HorizontalAlign.Center)', '.constraintSize({ minHeight: 44 })\n    .alignItems(VerticalAlign.Center)');
  assert.notEqual(oldColumn, managementSource);
  const columnErrors = alignmentDiagnostics(oldColumn, 'RssSubscriptionManagementPage.ets');
  assert.equal(columnErrors.length, 1);
  assert.ok(columnErrors[0].code === 2345 && /VerticalAlign.*HorizontalAlign/.test(columnErrors[0].message), 'Column rejects the former Row enum');
  for (const width of [320, 366]) for (const scale of [1, 1.45, 2]) {
    const value = metrics(width, 360, scale), c = context(value);
    const rel = 'features/settings/ui/SettingsSelectOverlay.ets';
    const inline = inlineSelectSdk({ properties: c.foundation.properties, uiContext: uiContext(), dependencies: { readerWindowMetrics: () => value } });
    const source = read(rel), names = ['build', 'phoneSheet', 'phoneOption', 'tabletPanel', 'tabletOption', 'tabletSpec', 'fontScale', 'safeLeft', 'safeTop', 'safeWidth', 'safeHeight', 'tabletWidth', 'tabletTop', 'title', 'isSelected', 'ownsOpening', 'choose', 'dismiss'];
    for (const expandedLayout of [false, true]) {
      const owner = createReaderBuilderProbe(source, names, { ...c.deps, ...inline.dependencies, ...readerSurfaceSpecsForProbe(value), ...selectedProductionValues(new URL(rel, root), ['PHONE_HORIZONTAL_INSET', 'PHONE_BOTTOM_INSET', 'PHONE_OPTION_HEIGHT', 'PHONE_CANCEL_GAP', 'PHONE_RADIUS']) }, { ...c.hooks, childSources: { ...c.hooks.childSources, ...inline.hooks.childSources } }).owner;
      Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, mounted: true, expandedLayout, selectionId: 'menu:1', field: 'language', value: '简体中文',
        options: ['简体中文', '繁體中文', '日本語', 'English', '跟随系统语言设置'], anchorRight: width - 1, anchorBottom: 350,
        hostWidth: width, hostHeight: 360, hostX: 0, hostY: 0, closed: false, onSelect() {}, onDismiss() {} });
      owner.initialRender(); const nodes = c.nodes(owner), scroll = nodes.find(n => n.type === 'Scroll'); assert.ok(scroll);
      assert.ok(scroll.constraintSize.maxHeight <= 320);
      if (expandedLayout) { assert.ok(scroll.position.x + scroll.width <= width); assert.ok(scroll.position.y + scroll.constraintSize.maxHeight <= 344); }
      else assert.ok(nodes.some(n => n.type === 'Stack' && n.height === 320), 'phone menu viewport pays top/bottom system insets');
    }
    // Retained text-bearing row builders use real SDK lowering and native minima.
    for (const [page, method, args, fields, expected] of [
      ['features/discover/ui/DiscoverPage.ets', 'filterRow', [], { currentFilterText: () => '很长的分类筛选' }, 34],
      ['features/sync/ui/SyncPage.ets', 'sectionHeadingDark', ['当前 WebDAV 设置'], {}, 16],
      ['features/sync/ui/SyncPage.ets', 'historyRow', [{ destination: '远端 WebDAV 备份', timestamp: '2026-11-13 20:00:00', ok: true, size: 2048 }], { contentFrame: () => ({ width: width - 38 }) }, 85],
      ['features/rss/ui/RssEntryDetailPage.ets', 'sourceCard', [], { subscription: { title: '很长的订阅源标题', enabled: true }, sourceSubtitle: () => '完整订阅信息', itemMeta: () => '完整条目信息', item: { title: '长文章名称' } }, 58],
    ]) {
      const owner = c.actor(page, [method], fields); owner[method](...args);
      assert.ok(c.nodes(owner).some(n => n.constraintSize?.minHeight === expected), `${page}.${method} natural parent`);
      if (method === 'historyRow') {
        const flex = c.nodes(owner).find(node => node.type === 'Flex');
        assert.equal(flex.create.alignItems, 'ItemAlign.Center');
        assert.equal(flex.alignItems, undefined, 'Sync alignment belongs to FlexOptions');
      }
    }
    const searchRel = 'ui/controls/ReaderSearchField.ets', searchSource = read(searchRel);
    const searchMembers = ['appThemeScheme', 'readerWindowMetricsRevision', 'variant', 'mode', 'placeholder', 'accessibilityLabel', 'build', 'passiveField', 'fieldHeight', 'iconGap', 'searchIcon', 'iconSize', 'horizontalPadding',
      'fieldBackgroundColor', 'fieldBorderWidth', 'fieldBorderColor', 'cornerRadius', 'resolvedAccessibilityLabel', 'nativeFieldBackground'];
    const Search = createReaderBuilderProbe(searchSource, searchMembers, c.deps, c.hooks).Component;
    const rootRel = 'features/rss/ui/RssPage.ets', rootSource = read(rootRel);
    const rssHooks = { ...c.hooks, childSources: { ...c.hooks.childSources, ReaderSearchField: searchSource } };
    const rss = createReaderBuilderProbe(rootSource, ['rssHeader', 'topBar', 'refreshPill', 'managePill', 'searchBar', 'statusTabs', 'statusTab'],
      { ...c.deps, ReaderSearchField: Search,
        ...selectedProductionValues(new URL(rootRel, root), ['RSS_FLOATING_HEADER_HEIGHT'], { ...readerFoundationTokens, readerPageContentStartInset: actualSourceManagementGeometry(value).readerPageContentStartInset }) }, rssHooks).owner;
    Object.assign(rss, { appThemeScheme: 'day', measuredHeaderHeight: 0, activeMode: 'sources', isRailActive: () => false,
      contentFrame: () => ({ width: width - 40, left: 20, right: 20 }), headerLeftInset: () => 20, headerRightInset: () => 20,
      isWideViewport: () => false, refreshStatusText: () => '正在刷新很长的订阅源标题', refreshMarqueeWidth: () => width - 240,
      numericAreaLength: value => Number.parseFloat(value) });
    rss.rssHeader(); const rssNodes = c.nodes(rss);
    assert.ok(rssNodes.some(n => n.type === 'Flex' && n.create.wrap === 'FlexWrap.Wrap'), 'root toolbar can wrap title and growing current controls');
    const rssFlexes = rssNodes.filter(node => node.type === 'Flex');
    assert.equal(rssFlexes.length, 2);
    assert.ok(rssFlexes.every(node => node.create.alignItems === 'ItemAlign.Center' && node.alignItems === undefined && node.justifyContent === undefined), 'both RSS Flex constructors preserve centered cross-axis alignment');
    assert.equal(rssFlexes[0].create.justifyContent, 'FlexAlign.SpaceBetween', 'outer RSS Flex preserves separated title and actions');
    assert.ok(rssNodes.some(n => n.type === 'Scroll' && n.scrollable === 'ScrollDirection.Horizontal'), 'RSS tabs have one actual horizontal viewport');
    const searchFrame = rssNodes.find(n => n.type === 'Row' && typeof n.accessibilityText === 'string' && n.accessibilityText.includes('搜索订阅源'));
    assert.ok(searchFrame.height >= readerScaledControlHeight(44, readerTypographyRoles.TYPE_SEARCH_RSS_HINT.lineHeightFp ?? readerTypographyRoles.TYPE_SEARCH_RSS_HINT.fontSizeFp * 1.5, scale));
    const headerNode = rssNodes.find(n => n.type === 'Column' && typeof n.onAreaChange === 'function');
    headerNode.onAreaChange({}, { height: 240 }); assert.equal(rss.measuredHeaderHeight, 240, 'same header reports its actual growing inset');
    const editor = c.actor('features/rss/ui/RssSubscriptionEditorPage.ets', ['pageContent', 'editorField', 'sectionTitle', 'saveAction'], {
      snapshot: { mode: 'create', title: '很长的来源标题', feedUrl: 'https://example.test/feed', statusMessage: '', enabled: true,
        enabledCookieJar: true, canSave: true, busy: false, sourceGroup: '', customOrder: '', updateIntervalMinutes: '', header: '' },
      presentationIdentity: 'editor:1', operationRecovery() {} });
    editor.pageContent();
    assert.equal(c.nodes(editor).filter(n => n.type === 'Row' && n.constraintSize?.minHeight === 60 && n.height === undefined).length, 2,
      'both actual toggle/description rows pay natural height');
    const management = c.actor('features/rss/ui/RssSubscriptionManagementPage.ets', ['actionBar', 'actionTarget'], {});
    management.actionBar('rss:1');
    const managementNodes = c.nodes(management);
    assert.equal(managementNodes.find(node => node.type === 'Column' && node.constraintSize?.minHeight === 44).alignItems, 'HorizontalAlign.Center');
    const managementActions = managementNodes.filter(n => n.type === 'Row' && typeof n.onClick === 'function');
    assert.equal(managementActions.length, 4);
    assert.ok(managementActions.every(n => n.width === '100%' && n.height === undefined && n.constraintSize.minHeight >= 44),
      'all four actual actions have whole readable native lanes');
    const discovery = c.actor('features/discover/ui/DiscoverPage.ets', ['categoryChips', 'resultRow'], {
      kindTitles: () => ['很长的发现分类', '另一分类'], presentation: { activeKindIndex: 0 } });
    discovery.categoryChips(); discovery.resultRow({ name: '窄屏大字体书名', author: '很长的作者名称', intro: '完整简介支持自然两行', coverUrl: '' });
    assert.ok(c.nodes(discovery).some(n => n.type === 'Row' && n.constraintSize?.minHeight === 98 && n.height === undefined), 'actual result row pays its current text stack');
    const button = new c.deps.ReaderButton(undefined, { specId: 'discover-category', label: '长分类标题' }); button.initialRender();
    assertNaturalButton(c.nodes(button).find(n => n.type === 'Button'));
    results.push({ case: 'retained-and-settings', width, scale, phoneTablet: 'bounded' });
  }
  for (const rel of ['features/rss/ui/RssPage.ets', 'features/rss/ui/RssEntryDetailPage.ets', 'features/rss/ui/RssSourceFeedPage.ets',
    'features/rss/ui/RssSubscriptionEditorPage.ets', 'features/rss/ui/RssSubscriptionManagementPage.ets', 'features/discover/ui/DiscoverPage.ets',
    'features/sync/ui/SyncPage.ets', 'features/settings/ui/SettingsPage.ets', 'app/composition/ReaderJourneyRecoveryNotices.ets']) {
    const tree = ts.createSourceFile(rel, read(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.equal(tree.parseDiagnostics.length, 0, `${rel} complete production source parses`);
  }
  const longResult = read('features/discover/ui/DiscoverPage.ets');
  const fixed = longResult.replace('.constraintSize({ minHeight: 98 })', '.height(98)');
  const negative = context(metrics()).actor('features/discover/ui/DiscoverPage.ets', ['resultRow'], {}, fixed);
  negative.resultRow({ name: '旧固定行', author: '作者', intro: '很长的两行内容', coverUrl: '' });
  assert.throws(() => assert.ok([...negative.nodes.values()].some(n => n.constraintSize?.minHeight === 98)), /AssertionError/, 'oldfixed98 result parent rejected');
  const menuSource = read('features/settings/ui/SettingsSelectOverlay.ets');
  for (const method of ['phoneSheet', 'tabletPanel']) {
    const oldMenu = menuSource.replace(/Scroll\(\) \{/g, 'Column() {');
    const c = context(metrics()), methods = method === 'tabletPanel' ? ['tabletPanel', 'tabletSpec', 'safeLeft', 'safeTop', 'safeWidth', 'safeHeight', 'tabletWidth', 'tabletTop', 'fontScale'] : ['build'];
    const actual = c.actor('features/settings/ui/SettingsSelectOverlay.ets', methods, {
      expandedLayout: true, selectionId: 'menu:old', hostWidth: 320, hostHeight: 180, hostX: 0, hostY: 0, options: ['a', 'b', 'c', 'd', 'e'],
      anchorRight: 319, anchorBottom: 170, tabletOption() {}, tabletPanel() {}, dismiss() {},
    }, oldMenu);
    if (method === 'tabletPanel') {
      delete actual.tabletPanel; actual.tabletPanel();
      assert.throws(() => assert.ok(c.nodes(actual).some(n => n.type === 'Scroll')), /AssertionError/, 'old tablet document cannot scroll lower options');
    }
  }
  const gate = read('app/ReaderProductScope.ts'); assert.match(gate, /'l0'/); assert.ok(!/CURRENT_READER_PRODUCT_PROFILE[^\n]*extended/.test(gate));
}
function titleScale() {
  const value = metrics(366, 844, 2.5), c = context(value), page = 'ui/chrome/PageBackBar.ets';
  const fields = { variant: 'standard', floating: false, title: '二级页面标题', titleColor: '',
    centered: false, backFocusId: '', raised: () => false, veil: () => false, framed: () => false, leftInset: () => 20, rightInset: () => 20,
    verticalInset: () => 0, backIconResource: () => ({}), panelRadius: () => 0, panelAreaChangeHandler: () => () => {},
    trailing: () => {}, trailingWidthVp: 94 };
  const bindings = { ...c.deps, ...headers, TYPE_PAGE_TITLE: readerTypographyRoles.TYPE_PAGE_TITLE, ...pureModuleProbe(read('ui/foundation/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', safe, ['readerScaledBarHeight']),
    MangaDirectoryPressFeedback: class { applyNormalAttribute() {} }, readerSurfaceElevation: () => ({}) };
  const actual = createReaderBuilderProbe(read(page), ['panel', 'fontScale', 'barHeight', 'trailing'], bindings, c.hooks).owner; Object.assign(actual, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, ...fields }); actual.panel();
  const nodes = c.nodes(actual), title = nodes.find(n => n.type === 'Text' && n.create === '二级页面标题');
  assert.ok(nodes.some(n => n.type === 'Stack' && n.width === 94 && n.height === undefined && n.constraintSize?.minHeight === 44), 'RSS caller can pay its explicit native trailing slot');
  assert.equal(title.maxFontScale, 2.5); assert.ok(nodes.find(n => n.type === 'Row').constraintSize.minHeight >= title.lineHeight * 2.5);
  const sdk = boundedSurfaceSdk({ windowMetrics: () => value, allowEmptyBranchAdmission: true });
  const header = sdk.consumer(read('ui/surfaces/ReaderBoundedSurfaceHeader.ets'), boundedMembers(read('ui/surfaces/ReaderBoundedSurfaceHeader.ets')), nativeEnums);
  Object.assign(header, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, specId: 'reader-action-sheet', title: '操作面板', surfaceWidth: 320, placement: 'bottom', scheme: 'day', leading() {}, accessory() {} });
  header.initialRender(); const titleNode = sdk.nodes(header).find(n => n.type === 'Text' && n.create === '操作面板'); assert.equal(titleNode.maxFontScale, 2.5);
  assert.equal(readerSurfaceSpecsForProbe(value).resolveDrawerSpec('reader-action-sheet').titleMaxFontScale, 2.5);
  const fixed2 = read(page).replace(".maxFontScale(this.variant === 'mangaDirectory' ? Math.max(1, this.mangaFontScale()) : Math.max(1, this.fontScale()))", '.maxFontScale(2)');
  assert.notEqual(fixed2, read(page));
  const old = createReaderBuilderProbe(fixed2, ['panel', 'fontScale', 'barHeight', 'trailing'], bindings, c.hooks).owner;
  Object.assign(old, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, ...fields }); old.panel();
  assert.throws(() => assert.equal(c.nodes(old).find(n => n.type === 'Text' && n.create === fields.title).maxFontScale, 2.5), /AssertionError/, 'actual historical fixed2 title cap rejected');
  results.push({ case: 'title-scale', scale: 2.5, platformMax: 3, toolbarMinHeight: nodes.find(n => n.type === 'Row').constraintSize.minHeight });
}
// Successor coverage for the independent constructor/handler inventory.
function selectTextContext(value) {
  return { ...uiContext(), getMeasureUtils: () => ({
    measureText: input => glyph(input.textContent || '字', Number.parseFloat(input.fontSize) * value.systemFontScale, Number(input.fontWeight)).width,
    measureTextSize: input => {
      const size = Number.parseFloat(input.fontSize) * value.systemFontScale;
      const measured = glyph(input.textContent || '字', size, Number(input.fontWeight));
      return { width: measured.width, height: Math.max(measured.fontHeight, (Number.parseFloat(input.lineHeight) || Number.parseFloat(input.fontSize) * 1.5) * value.systemFontScale) };
    },
  }) };
}
function supplementalSelectTargets() {
  const value = metrics(366, 844, 1);
  const inline = inlineSelectSdk({ uiContext: selectTextContext(value), dependencies: { readerWindowMetrics: () => value } });
  const rel = 'features/source/ui/SourceManagementPage.ets', source = read(rel);
  function sourcePanel(width, definition = source) {
    const parent = createReaderBuilderProbe(definition, ['groupOverlay', 'groupOverlayTop', 'recordGroupTrigger', 'numericAreaLength',
      'visibleGroupOptions', 'groupSearchQuery', 'overlayTop', 'overlayBottom', 'overlayLeft', 'overlayRight'],
      { ...inline.dependencies, ...safe, ReaderWindowCoordinator: { metrics: () => value } }, inline.hooks).owner;
    Object.assign(parent, { mounted: true, groupOpen: true, groupValue: '全部分组', groupSelectionId: `embedded:${width}`,
      originX: 23, originY: 24, viewportWidth: width, viewportHeight: 360,
      reduceMotion: true, groupClosing: false, groupOptions: () => ['全部分组', '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未'],
      groupCloseAction: () => () => {}, groupPanelFocusPrefix: () => '', groupPanelLayoutAction: () => () => {}, groupSearchField() {} });
    parent.recordGroupTrigger({ width: 160, height: 44, globalPosition: { x: 123, y: 200 } });
    parent.groupOverlay();
    const panel = inline.walk(parent).find(actor => actor instanceof inline.dependencies.ReaderSelectPanel);
    const frame = inline.nodes(panel).find(node => node.type === 'Column' && node.position !== undefined);
    inline.nodes(panel).find(node => node.type === 'Column' && node.onAppear).onAppear(); inline.properties.flush();
    assert.equal(panel.x, 100, 'normal Source caller converts the global anchor once');
    return { panel, frame };
  }
  for (const width of [320, 180, 0]) {
    const { panel, frame } = sourcePanel(width);
    assert.ok(frame.position.x >= 0 && frame.position.x + frame.width <= width, 'actual embedded host contains the complete menu width');
    if (width === 0) assert.equal(frame.width, 0, 'explicit zero width stays zero');
    if (width === 320) {
      const oldReceipt = panel.optionHeightHandler(panel.value, true);
      oldReceipt(56); assert.equal(panel.optionHeights.size, 1);
      panel.hostRightVp = 180; panel.onGeometryChanged();
      assert.equal(panel.optionHeights.size, 0, 'host width alone invalidates the option shape cache');
      panel.optionHeightHandler(panel.value, true)(88); oldReceipt(999);
      assert.deepEqual([...panel.optionHeights.values()], [88], 'old host receipt cannot replace a current row height');
    }
  }
  const oldCaller = source.replace('hostLeftVp: this.overlayLeft(), hostRightVp: this.overlayRight(),', '')
    .replace('controlWidth: this.groupClosingAnchor?.width ?? this.groupTriggerWidth,', 'controlWidth: 0,');
  assert.notEqual(oldCaller, source);
  const old = sourcePanel(320, oldCaller).frame;
  assert.throws(() => assert.ok(old.position.x + old.width <= 320), /AssertionError/, 'actual prior Source caller reproduces the30vp overflow');
  for (const scale of [1, 1.45, 2]) {
    value.systemFontScale = scale;
    for (const variant of ['default', 'settingsPhone', 'settingsTablet']) {
      const owner = new inline.dependencies.ReaderSelect(undefined, { variant, value: '开', options: ['开', '关'] });
      owner.aboutToAppear(); owner.initialRender();
      const action = inline.nodes(owner).find(node => typeof node.onClick === 'function');
      assert.ok(action.height >= 44, `${variant} actual action pays44 at${scale}`);
    }
    const host = new inline.dependencies.ReaderInlineSelect(undefined, { value: '开', options: ['开', '关'], reduceMotion: true, onSelect() {} });
    host.aboutToAppear(); host.initialRender();
    const frame = [...host.nodes.values()].find(node => node.type === 'Stack');
    assert.equal(frame.height, undefined, 'InlineSelect natural carrier follows its current Select height');
    assert.equal(frame.constraintSize.minHeight, 44);
    inline.choose(host, '关'); assert.equal(host.open, false, 'actual native popup choice closes the current opening');
  }
  const triggerSource = read('ui/controls/ReaderSelect.ets');
  const oldTrigger = triggerSource.replace('const TRIGGER_H = 44;', 'const TRIGGER_H = 36;').replace('if (this.isSettingsVariant()) return Math.max(44,', 'if (this.isSettingsVariant()) return Math.max(34,');
  value.systemFontScale = 1;
  const oldSelect = createReaderBuilderProbe(oldTrigger, boundedMembers(oldTrigger), { ...inline.dependencies,
    ...selectedProductionValues(new URL('ui/controls/ReaderSelect.ets', root), ['SELECT_PAD', 'CHEVRON_GAP', 'CHEVRON_W', 'CHEVRON_H', 'SELECT_CHROME'], inline.dependencies), TRIGGER_H: 36 }, inline.hooks).Component;
  for (const variant of ['default', 'settingsPhone', 'settingsTablet']) {
    const owner = new oldSelect(undefined, { variant, value: '开', options: ['开', '关'] }); owner.aboutToAppear(); owner.initialRender();
    assert.throws(() => assert.ok(inline.nodes(owner).find(node => typeof node.onClick === 'function').height >= 44), /AssertionError/, `prior${variant} trigger rejected`);
  }
  results.push({ case: 'select-host', supplemental: 'embedded horizontal bounds, zero width, host cache retirement and actual default/settings/Inline popup44' });
}
function supplementalInputTargets() {
  const source = read('ui/controls/ReaderControlSpecs.ets');
  const prior = source.replace('text: TYPE_SOURCE_TOOLS_ACTION, height: 44, minWidth: 44,', 'text: TYPE_SOURCE_TOOLS_ACTION, height: 42, minWidth: undefined,');
  const currentSpecs = foundationSpecs(readerTypographyRoles, source), oldSpecs = foundationSpecs(readerTypographyRoles, prior);
  const ids = [...source.match(/export type ReaderButtonSpecId = ([^;]+);/)[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  for (const id of ids.filter(id => id !== 'source-action')) assert.deepEqual(currentSpecs.resolveReaderButtonSpec(id), oldSpecs.resolveReaderButtonSpec(id), `default safety change preserves named${id} recipe`);
  for (const scale of [1, 1.45, 2]) {
    const c = context(metrics(320, 360, scale));
    const defaultButton = new c.deps.ReaderButton(undefined, { label: '好' }); defaultButton.initialRender();
    const button = c.nodes(defaultButton).find(node => node.type === 'Button');
    assert.ok(button.height >= 44 && button.constraintSize.minWidth >= 44, 'public default Native Button owns44x44 minimum');
    const rules = c.actor('features/settings/ui/RulesManagementPage.ets', ['replaceCard', 'txtTocCard', 'dictCard', 'subscriptionCard', 'input', 'draftKey', 'draftIsCurrent'], {
      snapshot: { replaceRules: [], txtTocRules: [], dictRules: [], subscriptions: [] }, replaceId: -1, txtId: -1, subId: -1,
      heading() {}, booleanField() {}, actionButton() {}, subscriptionTypeButton() {}, draftOpening: 1, replaceDraftRevision: 0, txtDraftRevision: 0, dictDraftRevision: 0, subscriptionDraftRevision: 0, replaceName: '', replacePattern: '', replaceValue: '', replaceOrder: '',
      txtName: '', txtRule: '', txtExample: '', txtOrder: '', dictName: '', dictUrl: '', dictShow: '', dictOrder: '', subName: '', subUrl: '', subOrder: '' });
    for (const method of ['replaceCard', 'txtTocCard', 'dictCard', 'subscriptionCard']) rules[method]();
    const fields = c.nodes(rules).filter(node => node.type === 'TextInput');
    assert.equal(fields.length, 15, 'all four normal rule forms mount their15 actual Native fields');
    assert.ok(fields.every(node => node.height >= 44));
  }
  const oldInputs = source.replace(/(text: TYPE_SOURCE_TOOLS_BODY, height:) 44/, '$1 40')
    .replace(/(text: TYPE_RULES_MANAGEMENT_INPUT, height:) 44/, '$1 40').replace(/(text: TYPE_SYNC_INPUT, height:) 44/, '$1 36');
  const old = foundationControls({ specs: foundationSpecs(readerTypographyRoles, oldInputs) });
  for (const specId of ['source-debug', 'rules-input', 'sync-credential']) {
    const field = new old.dependencies.ReaderFormField(undefined, { specId, text: '样本' }); field.initialRender();
    assert.throws(() => assert.ok(old.nodes(field).find(node => node.type === 'TextInput').height >= 44), /AssertionError/, `old${specId} Native input rejected`);
  }
  const oldDefault = foundationControls({ specs: oldSpecs });
  const button = new oldDefault.dependencies.ReaderButton(undefined, { label: '好' }); button.initialRender();
  assert.throws(() => assert.ok(oldDefault.nodes(button).find(node => node.type === 'Button').height >= 44), /AssertionError/, 'old public default42 rejected');
  results.push({ case: 'actions-tools-rules', supplemental: '15 rule fields, default44 and unchanged named recipes, old three field recipes rejected' });
}
function standardRecoveryDocument(c, { width, height, header, content }, definition = read('ui/layout/ReaderStandardPage.ets')) {
  const members = ['geometry', 'viewportWidth', 'viewportHeight', 'boundedOverlayVisible', 'boundedOverlayContent',
    'overlayContent', 'emptySlot', 'emptyOverlaySlot', 'pageOverlay', 'overlayAvailableHeight', 'refreshGeometry'];
  const owner = createReaderBuilderProbe(definition, members, { ...c.deps, ...actualReaderPageLayout() }, c.hooks).owner;
  Object.assign(owner, { appThemeScheme: 'day', viewportWidth: width, viewportHeight: height, variant: 'settingsGeneral',
    geometryRevision: 0, contentLeadingRail: 0, contentEndInset: -1, headerHeight: () => header, footerHeight: () => 0,
    boundedOverlayVisible: true, boundedOverlayContent: content, overlayContent() {} });
  owner.refreshGeometry(); owner.pageOverlay(); c.foundation.properties.flush();
  return owner;
}
function supplementalPreviewDocument() {
  const value = metrics(366, 360, 2), c = context(value), rel = 'features/settings/ui/ReaderMessagePreviewPage.ets', source = read(rel);
  const methods = ['noticePreview', 'noticeActive', 'noticeView', 'owns', 'admitted', 'end', 'clearPreview', 'handleBack'];
  const fields = { scene: 'notice-long', generation: 7, previewEnabled: true, foreground: true,
    timer: -1, feedback: { reset() {} }, reconcileNotice() {} };
  const owner = c.actor(rel, methods, fields);
  const standard = standardRecoveryDocument(c, { width: 320, height: 180, header: 70,
    content: (...args) => { assert.deepEqual(args, [], 'bounded content is delivered without an inset scalar'); owner.noticePreview(); } });
  const scroll = c.nodes(standard).find(node => node.type === 'Scroll'), geometry = standard.geometry;
  assert.ok(scroll && scroll.constraintSize.maxHeight > 0 && scroll.constraintSize.maxHeight <= 110);
  assert.equal(scroll.margin.top, geometry.content.startInset);
  assert.equal(scroll.width, geometry.content.frame.width);
  assert.equal(scroll.margin.left, geometry.content.frame.left);
  assert.ok(scroll.margin.top + scroll.constraintSize.maxHeight <= geometry.footer.top);
  const notice = [...owner.children.values()].find(child => child instanceof c.deps.ReaderRecoveryNotice);
  assert.ok(notice); assert.equal(notice.maxHeightVp, -1, 'one StandardPage document owns Scroll around Notice and end action');
  assert.equal(notice.layoutWidthVp, -1, 'business content leaves width allocation to its live bounded host');
  notice.measuredGeneration = 7; notice.expanded = true; notice.clipped = true; notice.replay(); c.foundation.properties.flush();
  const nodes = [...c.nodes(standard), ...c.nodes(owner)];
  assert.equal(nodes.filter(node => node.type === 'Scroll').length, 1, 'expanded Preview notice does not create nested Scroll');
  assert.ok(nodes.some(node => node.type === 'Text' && node.maxLines === 10000));
  const end = nodes.find(node => node.type === 'Button' && node.accessibilityText === '结束提醒预览');
  assertNaturalButton(end); assert.equal(end.width, '100%');
  owner.generation = 8; owner.scene = 'notice-busy'; end.onClick(); assert.equal(owner.scene, 'notice-busy', 'old preview end callback cannot end current generation');
  assert.equal(owner.handleBack(), true); assert.equal(owner.scene, 'none', 'current Back still retires the local preview');
  const standardSource = read('ui/layout/ReaderStandardPage.ets');
  const unbounded = standardSource.replace('Scroll() { Column({ space: 8 })', 'Column() { Column({ space: 8 })');
  assert.notEqual(unbounded, standardSource);
  const old = standardRecoveryDocument(c, { width: 320, height: 180, header: 70, content() {} }, unbounded);
  assert.throws(() => assert.ok(c.nodes(old).some(node => node.type === 'Scroll')), /AssertionError/, 'old actual document lacks its host overflow Scroll');
  const large = context(metrics(320, 360, 3));
  const sample = large.actor(rel, ['sampleButton'], { admitted: () => true });
  sample.sampleButton('长文本消息预览', () => {});
  const sampleButton = large.nodes(sample).find(node => node.type === 'Button'); assertNaturalButton(sampleButton);
  const sampleText = large.nodes(sample).find(node => node.type === 'Text' && node.create === '长文本消息预览');
  assert.ok(glyph(sampleText.create, sampleText.fontSize * 3, sampleText.fontWeight).width > 240, 'actual3x long sample needs its natural multi-line height');
  results.push({ case: 'recovery-overlays', supplemental: 'normal MessagePreview notice uses actual StandardPage geometry, one Scroll, no-argument callback and generation Back' });
}

function pageBackBarTitleWrap() {
  const rel = 'ui/chrome/PageBackBar.ets', source = read(rel);
  const value = metrics(320, 770, 2), c = context(value);
  const deps = { ...c.deps, ...headers, ...readerSurfaceSpecsForProbe(value),
    ...pureModuleProbe(read('ui/foundation/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', safe, ['readerScaledBarHeight']),
    MangaDirectoryPressFeedback: productionMangaDirectoryPressFeedback(), resolveReaderRaisedShape };
  function expect(candidate, floating) {
    const { owner } = createReaderBuilderProbe(candidate, boundedMembers(candidate), deps, c.hooks);
    Object.assign(owner, { appThemeScheme: 'day', title: '书源管理', variant: 'standard', floating,
      readerWindowMetricsRevision: 1, trailing: () => {} });
    owner.initialRender();
    const nodes = c.nodes(owner);
    const text = nodes.find(node => node.type === 'Text' && node.create === '书源管理');
    const row = nodes.find(node => node.type === 'Row');
    assert.ok(text && row);
    assert.equal(text.maxLines, floating ? 1 : 2, 'header title follows fixed or floating layout policy');
    assert.equal(text.textOverflow.overflow, nativeEnums.TextOverflow.Ellipsis);
    assert.equal(text.fontSize, floating ? 16 : readerTypographyRoles.TYPE_PAGE_TITLE.fontSizeFp);
    assert.equal(text.maxFontScale, 2);
    assert.equal(text.layoutWeight, 1);
    assert.equal(row.height, undefined, 'row height follows native single or multiline text');
    assert.ok(row.constraintSize.minHeight > 0);
  }
  expect(source, false);
  expect(source, true);
  const before = source.replace('.maxLines(this.multilineTitle() ? 2 : 1)', '.maxLines(1)');
  assert.notEqual(before, source);
  assert.throws(() => expect(before, false), /header title follows fixed or floating layout policy/);
  results.push({ case: 'page-back-bar-title-wrap', fixedHeaderGrowth: true, floatingSingleLine: true });
}

function supplementalRetainedTargets() {
  for (const scale of [1, 1.45, 2]) {
    const value = metrics(320, 360, scale), c = context(value);
    const rel = 'ui/chrome/PageBackBar.ets', source = read(rel);
    const bindings = { ...c.deps, ...headers, ...readerSurfaceSpecsForProbe(value),
      ...pureModuleProbe(read('ui/foundation/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', safe, ['readerScaledBarHeight']),
      MangaDirectoryPressFeedback: productionMangaDirectoryPressFeedback(), resolveReaderRaisedShape };
    const { ts, options, require, root: sdkRoot } = installedEtsCompiler();
    const tree = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const declaration = tree.statements.find(node => node.name?.text === 'PageBackBar');
    const builderParams = declaration.members.filter(member => member.name && ts.getAllDecorators(member)
      .some(decorator => decorator.getText(tree) === '@BuilderParam')).map(member => member.name.getText(tree));
    require(`${sdkRoot}/lib/validate_ui_syntax.js`).builderParamObjectCollection.set('PageBackBar', new Set(builderParams));
    const Back = createReaderBuilderProbe(source, boundedMembers(source), bindings, c.hooks).Component;
    const hooks = { ...c.hooks, childSources: { ...c.hooks.childSources, PageBackBar: source } };
    const rss = createReaderBuilderProbe(read('features/rss/ui/RssEntryDetailPage.ets'), ['backBar', 'favoriteAction'], { ...bindings, PageBackBar: Back }, hooks).owner;
    Object.assign(rss, { appThemeScheme: 'day', favoriteState: 'available', canRequestFavorite: () => true, hasOriginalLink: () => true, onBack() {}, onFavoriteRequested() {}, onOpenOriginal() {} });
    rss.backBar(); const nodes = c.nodes(rss);
    const actions = nodes.filter(node => node.type === 'Stack' && typeof node.onClick === 'function');
    assert.equal(actions.length, 2); assert.ok(actions.every(node => node.width === 44 && node.constraintSize.minHeight >= 44));
    assert.ok(nodes.some(node => node.type === 'Row' && node.width === 94), 'actual RSS trailing Row pays two44 targets and6gap');
    assert.ok(nodes.some(node => node.type === 'Stack' && node.width === 94), 'actual PageBackBar owns the paid94 trailing slot');
    const sync = c.actor('features/sync/ui/SyncPage.ets', ['webdavSection', 'webdavInputRow', 'emptyState'], {
      contentFrame: () => ({ width: 282 }), canEdit: () => true, canMutate: () => true, sectionHeadingDark() {}, configActions() {},
      effectiveWebdavUrl: () => '', effectiveWebdavUser: () => '', effectiveWebdavPath: () => '', webdavPass: '', backupPass: '' });
    sync.webdavSection(); sync.emptyState();
    assert.equal(c.nodes(sync).filter(node => node.type === 'TextInput').length, 5);
    assert.ok(c.nodes(sync).filter(node => node.type === 'TextInput').every(node => node.height >= 44));
    const backup = c.nodes(sync).find(node => node.type === 'Button' && node.accessibilityText === '立即备份'); assertNaturalButton(backup);
    const discover = c.actor('features/discover/ui/DiscoverPage.ets', ['paginationRow', 'pageAction'], { presentation: { page: 1, hasPrevious: true, hasNext: true, loading: false } });
    discover.paginationRow(); const pageButtons = c.nodes(discover).filter(node => node.type === 'Button');
    assert.equal(pageButtons.length, 2); pageButtons.forEach(assertNaturalButton);
    const inline = inlineSelectSdk({ properties: c.foundation.properties, uiContext: selectTextContext(value), dependencies: { readerWindowMetrics: () => value } });
    const settingsRel = 'features/settings/ui/SettingsPage.ets';
    for (const expandedLayout of [false, true]) {
      const settings = createReaderBuilderProbe(read(settingsRel), ['selectRow', 'labelColumn', 'iconBox'], { ...c.deps, ...inline.dependencies,
        ...selectedProductionValues(new URL(settingsRel, root), ['SELECT_ROW_H', 'SELECT_TRIGGER_H', 'SELECT_TRIGGER_OFFSET']) }, { ...hooks, childSources: { ...hooks.childSources, ...inline.hooks.childSources } }).owner;
      Object.assign(settings, { appThemeScheme: 'day', expandedLayout, reduceMotionValue: true, openSelect: '', selectAnchors: {}, currentValue: () => '简体中文', toggleSelection() {} });
      settings.selectRow('界面语言', () => ({}), 'language', ['简体中文', 'English']);
      const parent = c.nodes(settings).find(node => node.type === 'Row' && node.constraintSize?.minHeight === 58);
      assert.ok(parent && parent.height === undefined, 'normal retained Settings row grows with the actual trigger');
      const action = c.nodes(settings).find(node => typeof node.onClick === 'function'); assert.ok(action.height >= 44);
    }
  }
  const current = read('ui/controls/ReaderControlSpecs.ets');
  const oldSpecs = current.replace('DISCOVER_PAGE.minHeight = 44; DISCOVER_PAGE.minWidth = 44;', '').replace('SYNC_EMPTY_BACKUP.minHeight = 44; SYNC_EMPTY_BACKUP.minWidth = 44;', '');
  const old = foundationControls({ specs: foundationSpecs(readerTypographyRoles, oldSpecs) });
  for (const specId of ['discover-page', 'sync-empty-backup']) {
    const button = new old.dependencies.ReaderButton(undefined, { specId, label: '好' }); button.initialRender();
    assert.throws(() => assertNaturalButton(old.nodes(button).find(node => node.type === 'Button')), /AssertionError|TypeError/, `old${specId} missing Native44 rejected`);
  }
  results.push({ case: 'retained-and-settings', supplemental: 'RSS actual94 trailing/two44, Sync five44 fields+empty action, Discover pagination44, normal Settings Select parent' });
}
function supplementalDownloadControls() {
  for (const scale of [1, 1.45, 2]) {
    const value = metrics(320, 180, scale), c = context(value), rel = 'features/downloads/ui/SharedDownloadPage.ets';
    const inline = inlineSelectSdk({ properties: c.foundation.properties, uiContext: selectTextContext(value), dependencies: { readerWindowMetrics: () => value } });
    const owner = createReaderBuilderProbe(read(rel), ['searchField', 'notice', 'textControlHeight', 'fontScale', 'currentMetrics', 'primaryInk', 'chapterToolbar', 'filterSheet', 'settingsSheet', 'rangeSheet', 'selectClosedWidth', 'storageSelectWidth'],
      { ...c.deps, ...inline.dependencies, DOWNLOAD_VISUAL, downloadVisualColor, EnterKeyType: enums('EnterKeyType') }, { ...c.hooks, childSources: { ...c.hooks.childSources, ...inline.hooks.childSources } }).owner;
    let retries = 0;
    Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, query: '样本', managing: true, fontsFailed: true,
      visualIcon: () => ({}), changeSearchInput() {}, clearSearchInput() {}, uiInputIsCurrent: () => true, prepareFonts: () => retries++,
      stateFilter: 'all', stateChoices: () => [{ id: 'all', label: '全部状态' }], sourceFilter: 'all', sourceFilterLabel: () => '全部书源',
      filterSourceOptions: [{ id: 'all', label: '全部书源' }], storageSummaryContent() {}, storagePolicy: {}, storagePolicyBusy: false,
      limitLabels: () => ['1 GB'], limitIndex: () => 0, dayLabels: () => ['30 天'], daysIndex: () => 0,
      contentLeftInset: () => 19, contentRightInset: () => 19, actionBookKeys: ['a', 'b'], rangeBookKey: 'a', rangeChoice: 'all',
      availableRangeBooks: () => [{ id: 'a', label: '样本书' }, { id: 'b', label: '另一书' }], choiceRow() {} });
    owner.searchField('current'); owner.notice(() => '字体加载失败', true, 7);
    const input = c.nodes(owner).find(node => node.type === 'TextInput'); assert.ok(input.height >= 44);
    const searchParent = c.nodes(owner).find(node => node.type === 'Row' && node.constraintSize?.minHeight === DOWNLOAD_VISUAL.searchHeight + 2 * DOWNLOAD_VISUAL.borderWidth);
    assert.ok(searchParent, 'actual query parent pays44 Native plus both borders');
    const retry = c.nodes(owner).find(node => node.type === 'Button' && node.constraintSize?.minWidth === 44);
    assert.ok(retry.constraintSize.minHeight >= 44); retry.onClick(); assert.equal(retries, 1, 'current font retry still routes normally');
    owner.chapterToolbar(() => ({ key: 'a' }), 7); owner.filterSheet(1); owner.settingsSheet(1); owner.rangeSheet(1);
    const selects = inline.walk(owner).filter(child => child instanceof inline.dependencies.ReaderInlineSelect);
    assert.equal(selects.length, 6, 'all six real Download InlineSelect sites mount natural paid carriers');
    assert.ok(selects.every(child => [...child.nodes.values()].find(node => node.type === 'Stack').constraintSize.minHeight >= 44));
  }
  const value = metrics(320, 180, 1), c = context(value);
  const downloadSource = read('features/downloads/ui/SharedDownloadPage.ets');
  const old = downloadSource.replace('.height(this.textControlHeight(DOWNLOAD_VISUAL.touchTarget,', '.height(this.textControlHeight(DOWNLOAD_VISUAL.searchHeight - DOWNLOAD_VISUAL.borderWidth * 2,')
    .replace('minWidth: DOWNLOAD_VISUAL.touchTarget, minHeight: DOWNLOAD_VISUAL.touchTarget', 'minHeight: DOWNLOAD_VISUAL.textActionHeight');
  const prior = createReaderBuilderProbe(old, ['searchField', 'notice', 'textControlHeight', 'fontScale', 'currentMetrics', 'primaryInk'], { ...c.deps, DOWNLOAD_VISUAL, downloadVisualColor, EnterKeyType: enums('EnterKeyType') }, c.hooks).owner;
  Object.assign(prior, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, query: '', visualIcon: () => ({}), changeSearchInput() {} });
  value.systemFontScale = 1; prior.searchField('old'); prior.notice(() => '失败', true, 7);
  assert.throws(() => assert.ok(c.nodes(prior).find(node => node.type === 'TextInput').height >= 44), /AssertionError/, 'old query Native42 rejected');
  assert.throws(() => assert.ok(c.nodes(prior).find(node => node.type === 'Button').constraintSize.minHeight >= 44), /AssertionError/, 'old retry34 rejected');
  results.push({ case: 'download-controls', supplemental: 'query/retry44, original scope, all six actual Inline sites' });
}
async function selectReduceMotion() {
  const { READER_MANGA_DOWNLOAD_POPUP } = await import('../entry/src/main/ets/features/manga/ui/ReaderMangaDownloadPopupSpec.ts');
  for (const reduceMotion of [false, true]) {
    const value = metrics(320, 360, 1), c = context(value), animations = [], frames = [];
    const native = { ...uiContext(), animateTo(params, action) { animations.push(params); action(); }, postFrameCallback: frame => frames.push(frame) };
    const inline = inlineSelectSdk({ properties: c.foundation.properties, uiContext: native, dependencies: { readerWindowMetrics: () => value } });
    const hooks = { ...c.hooks, childSources: { ...c.hooks.childSources, ...inline.hooks.childSources } };
    const recovery = pureModuleProbe(read('features/reading/presentation/ReadingDirectoryRecovery.ts'), 'ReadingDirectoryRecovery.ts', {}, ['EMPTY_READING_DIRECTORY_RECOVERY']);
    const dependencies = { ...c.deps, ...inline.dependencies, ...recovery, ...readerEditingSdk(),
      uiContext: native, Scroller: class {}, DOWNLOAD_VISUAL, downloadVisualColor };
    const mount = (rel, members, fields) => {
      const actor = createReaderBuilderProbe(read(rel), members, dependencies, hooks).owner;
      Object.assign(actor, { appThemeScheme: 'day', reduceMotion, ...fields }); return actor;
    };
    const download = mount('features/downloads/ui/SharedDownloadPage.ets', ['chapterToolbar', 'filterSheet', 'settingsSheet', 'rangeSheet', 'selectClosedWidth', 'storageSelectWidth', 'currentMetrics', 'fontScale'], {
      visualIcon: () => ({}), managing: true, stateFilter: 'all', stateChoices: () => [{ id: 'all', label: '全部状态' }], sourceFilter: 'all',
      sourceFilterLabel: () => '全部书源', filterSourceOptions: [{ id: 'all', label: '全部书源' }],
      storageSummaryContent() {}, storagePolicy: {}, storagePolicyBusy: false, limitLabels: () => ['1 GB'], limitIndex: () => 0,
      dayLabels: () => ['30 天'], daysIndex: () => 0, contentLeftInset: () => 19, contentRightInset: () => 19,
      actionBookKeys: ['a', 'b'], rangeBookKey: 'a', rangeChoice: 'all', availableRangeBooks: () => [{ id: 'a', label: '样本书' }, { id: 'b', label: '另一书' }], choiceRow() {} });
    download.chapterToolbar(() => ({ key: 'a' }), 1); download.filterSheet(1); download.settingsSheet(1); download.rangeSheet(1);
    const tools = mount('features/source/ui/SourceToolsPage.ets', ['debugCard'], { snapshot: { busy: false, checkMode: 'search', checkDepth: 2,
      debugSourceId: '', debugKey: '', debugLogs: [] }, debugInputRevision: 0, debugKeyChange: () => () => {}, debugOptionsCurrent: () => true });
    tools.debugCard();
    const rules = mount('features/reading/ui/ReaderDirectoryRules.ets',
      ['build', 'editingHost', 'editingScroll', 'editingScroller', 'currentRule'], { scheme: 'day', focusTargetId: '', interactionEnabled: true,
      actorIdentity: () => 'rules:1', rules: [{ id: 1, pattern: '.*', level: '0', boundary: 'title' }], availableWidthVp: 280, availableHeightVp: 180,
      canEdit: () => true, previewReady: false, recoveryView: () => ({ visible: false }), loaded: true, busy: false,
      recoveryIdentity: () => 'rules:1', preview: [], message: '', operation: { generation: 1 } });
    rules.initialRender();
    const selects = [download, tools, rules].flatMap(owner => inline.walk(owner).filter(child => child instanceof inline.dependencies.ReaderInlineSelect));
    assert.equal(selects.length, 9, 'normal download/tools/rules builders mount all nine constructor sites');
    for (const select of selects) {
      assert.equal(select.reduceMotion, reduceMotion);
      // Replace the business sink after asserting the actual caller's binding.
      const commits = []; select.onSelect = (...args) => commits.push(args);
      const trigger = inline.walk(select).find(child => child instanceof inline.dependencies.ReaderSelect);
      inline.nodes(trigger).find(node => typeof node.onClick === 'function').onClick();
      c.foundation.properties.flush(); select.menu(select.selectionId); c.foundation.properties.flush();
      const nativePopup = () => [...select.nodes.values()].find(node => node.bindPopup !== undefined).bindPopup[1];
      const originalPopupOptions = nativePopup();
      assert.deepEqual(originalPopupOptions.transition, reduceMotion ? { kind: 'identity', animation: { duration: 0 } } : undefined,
        'actual native popup consumes the current reduce-motion preference');
      const panel = inline.walk(select).find(child => child instanceof inline.dependencies.ReaderSelectPanel && child.selectionId === select.selectionId);
      assert.equal(panel.reduceMotion, reduceMotion);
      const before = animations.length; panel.expandPanel();
      if (reduceMotion) assert.equal(animations.length, before, 'reduced-motion popup opens immediately');
      else assert.ok(animations.at(-1).duration > 0, 'ordinary preference retains the current animation recipe');
      select.reduceMotion = true; c.foundation.properties.flush();
      assert.equal(panel.reduceMotion, true, 'open popup receives a live preference update');
      assert.deepEqual(nativePopup().transition, { kind: 'identity', animation: { duration: 0 } },
        'live preference also updates the native popup options');
      const oldIdentity = panel.selectionId;
      panel.onCommit(panel.options[0], oldIdentity); assert.equal(commits.length, 1);
      select.toggle(); panel.onCommit(panel.options[0], oldIdentity);
      originalPopupOptions.onStateChange({ isVisible: false });
      assert.equal(select.open, true, 'late native dismissal cannot close the successor popup');
      assert.equal(commits.length, 1, 'an old popup cannot commit into the new opening');
      select.aboutToDisappear(); select.commit(panel.options[0], select.selectionId);
      assert.equal(commits.length, 1, 'unmounted select cannot commit');
    }
    // Each intermediate constructor is executed by the normal SDK Builder.
    class ChildPort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } updateStateVars(params) { Object.assign(this.params, params); } }
    function propagated(rel, member, child, fields, args = []) {
      const childRel = child === 'SourceToolsPage' ? 'features/source/ui/SourceToolsPage.ets' :
        child === 'ReaderMangaDownloadPopup' ? 'features/manga/ui/ReaderMangaDownloadPopup.ets' : `features/reading/ui/${child}.ets`;
      const ports = { ...dependencies, [child]: ChildPort };
      const childSources = { ...hooks.childSources, [child]: read(childRel) };
      if (rel === 'app/composition/ReaderSourceSwitchSurfaces.ets') {
        ports.SourceSwitchPanel = ChildPort;
        childSources.SourceSwitchPanel = read('features/source/ui/SourceSwitchPanel.ets');
      }
      const members = member === 'mangaDownloadMenuButton' ? [member, 'directoryInputIsCurrent'] : [member];
      const owner = createReaderBuilderProbe(read(rel), members, ports, { ...hooks, childSources }).owner;
      Object.assign(owner, { reduceMotion, ...fields });
      if (member === 'build') owner.initialRender(); else owner[member](...args);
      const params = [...owner.children.values()].find(actor => actor instanceof ChildPort)?.params;
      assert.ok(params, `${rel} normally assembles ${child}`);
      assert.equal(params.reduceMotion, reduceMotion, `${rel} forwards the global preference`);
      return params;
    }
    propagated('features/source/ui/SourceJourneySurface.ets', 'toolsPage', 'SourceToolsPage', { view: { tools: {} } });
    propagated('pages/Index.ets', 'externalDirectory', 'DetailDirectoryScene', {
      readingEntry: { book: { contentKind: 'text' } }, directoryJourney: { operations: {} }, directoryNavigationPorts: () => ({}),
      settingsPresentation: { snapshot: { reduceMotion } }, isDirectoryOpeningCurrent: () => true });
    propagated('features/reading/ui/DetailDirectoryScene.ets', 'build', 'ReaderDirectoryDestination', { reading: { book: { contentKind: 'text' }, toc: [], bookmarkIdentity: () => '' }, directoryActions: {}, navigation: {} });
    propagated('features/reading/ui/ReaderShell.ets', 'readingOverlay', 'ReaderDirectoryDestination', { route: 'directory', contentKind: 'text', overlayStatusBarUnderlay() {} });
    propagated('features/reading/ui/ReaderDirectoryDestination.ets', 'catalog', 'ReaderFullDirectory', { contentKind: 'text', bookmarkSelection: () => () => {} }, [1]);
    propagated('features/reading/ui/ReaderFullDirectory.ets', 'directoryRulesForm', 'ReaderDirectoryRules', { panelWidth: () => 280, panelViewportHeight: () => 180, directoryRulesFocusId: () => 'rules-focus' }, ['rules:1', 'book']);
    propagated('features/reading/ui/ReaderDirectoryDestination.ets', 'catalog', 'BookDirectoryPage', { contentKind: 'manga' }, [1]);
    propagated('features/reading/ui/BookDirectoryPage.ets', 'mangaDownloadMenuButton', 'ReaderMangaDownloadPopup', {
      mangaDownloadEnabled: true, mounted: true, interactive: true, admittedIdentity: 'manga:1',
      identity: () => 'manga:1', isOpeningCurrent: () => true, contentFrame: () => ({ width: 280 }) });
    propagated('app/composition/ReaderSourceSwitchSurfaces.ets', 'build', 'BookDirectoryPage', {
      manga: { selectionVisible: true, selection: { target: { identity: { sourceId: 'source', bookId: 'book' }, book: { title: '目标漫画' } }, entries: [] },
        directorySelectionBusy: () => false, directoryOpening: () => () => true, directorySelection: () => () => {},
        directoryTemporaryBack: () => () => {}, directoryBack: () => () => {} } });
    Object.assign(c.deps, { READER_MANGA_DOWNLOAD_POPUP,
      Placement: { BottomLeft: 'Placement.BottomLeft' },
      TransitionEffect: { IDENTITY: { animation: params => ({ kind: 'identity', animation: params }) } } });
    const closed = [];
    const manga = c.actor('features/manga/ui/ReaderMangaDownloadPopup.ets', ['build', 'popupOptions', 'spec'], {
      specId: 'manga-download', visible: true, generation: 7, focusId: 'manga-popup', reduceMotion,
      onOpen() {}, onClosed: generation => closed.push(generation) });
    manga.initialRender();
    const mangaOptions = () => [...manga.nodes.values()].find(node => node.bindPopup !== undefined).bindPopup[1];
    assert.deepEqual(mangaOptions().transition, reduceMotion ? { kind: 'identity', animation: { duration: 0 } } : undefined);
    manga.reduceMotion = true; manga.replay();
    assert.deepEqual(mangaOptions().transition, { kind: 'identity', animation: { duration: 0 } });
    mangaOptions().onStateChange({ isVisible: false }); assert.deepEqual(closed, [7]);
    results.push({ case: 'select-reduce-motion', reduceMotion, constructors: selects.length, propagationLinks: 9,
      nativePopupOwners: ['inline-select', 'manga-download'] });
  }
}

function bookshelfGroupRecoveryCapacity() {
  const { readerMotionReducedFadeParam } = productionReaderMotionSdk();
  const compiler = installedEtsCompiler();
  compiler.require(compiler.root + '/lib/validate_ui_syntax.js')
    .observedClassCollection.add('BookshelfGroupPresentation');
  const { readerKeyboardHostBottom } = pureModuleProbe(read('ui/layout/ReaderKeyboardGeometry.ts'),
    'ReaderKeyboardGeometry.ts', safe, ['readerKeyboardHostBottom']);
  for (const scale of [1, 1.3, 1.6, 2]) for (const height of [360, 180, 0]) {
    const value = metrics(320, height, scale), c = context(value), calls = [];
    const rel = 'features/bookshelf/ui/BookshelfGroupDialog.ets';
    const dialogSource = read('ui/surfaces/ReaderDialogSurface.ets');
    const horizontal = pureModuleProbe(read('ui/layout/SurfaceHorizontalGeometry.ts'), 'SurfaceHorizontalGeometry.ts', {},
      ['SurfaceHorizontalFrame', 'SurfaceWidthSpec', 'resolveHorizontalFrame']);
    Object.assign(c.deps, horizontal, readerSurfaceSpecsForProbe(value), {
      readerKeyboardHostBottom,
      SynchedPropertyNesedObjectPU: c.foundation.properties.sdk.SynchedPropertyNestedObjectPU,
    });
    c.deps.TransitionEffect = { IDENTITY: {}, OPACITY: { animation: params => params } };
    c.deps.readerMotionReducedFadeParam = readerMotionReducedFadeParam;
    c.hooks.childSources.ReaderDialogSurface = dialogSource;
    c.deps.ReaderDialogSurface = createReaderBuilderProbe(dialogSource, boundedMembers(dialogSource), c.deps, c.hooks).Component;
    const groupSource = read(rel);
    const presentation = c.foundation.properties.sdk.ObservedObject.createNew({
      book: {}, identity: 'group:1', snapshot: { busy: false, receipt: { facts: { generation: 7 } } },
      recovery: generation => ({ visible: true, message: '分组操作仍待核对。'.repeat(1000), generation, canRetry: true }),
      canContinue: () => true, reconcile: (...args) => calls.push(args),
    }, undefined);
    const { owner } = createReaderBuilderProbe(groupSource, boundedMembers(groupSource).filter(name => name !== 'selector'),
      c.deps, { ...c.hooks, initialParams: { presentation } });
    Object.assign(owner, { foreground: true, appReduceMotion: true,
      metricsRevision: 1, viewportHeight: height, originY: 0, recoveryTop: 70,
      selector() {}, restoreFocusAction: () => () => {}, requestFocusAfterFrame() {},
    });
    owner.initialRender(); c.foundation.properties.flush();
    const notice = [...owner.children.values()].find(child => child instanceof c.deps.ReaderRecoveryNotice);
    assert.ok(notice, 'normal group build/surface/recovery mounts the shared Notice');
    const expected = Math.max(0, height - 16 - 82 - 12);
    assert.equal(notice.maxHeightVp, expected);
    notice.measuredGeneration = 7; notice.expanded = true; notice.clipped = true; notice.replay(); c.foundation.properties.flush();
    const nodes = c.nodes(notice), scroll = nodes.find(node => node.type === 'Scroll');
    assert.equal(scroll.constraintSize.maxHeight, expected);
    assert.equal(nodes.filter(node => node.type === 'Scroll').length, 1, 'the shared Notice owns the single scrollable document');
    assert.ok(nodes.some(node => node.type === 'Text' && node.maxLines === 10000));
    const primary = nodes.find(node => node.type === 'Button' && node.accessibilityText === '核对分组');
    const secondary = nodes.find(node => node.type === 'Button' && node.accessibilityText === '继续原分组操作');
    assert.ok(primary && secondary); primary.onClick(); secondary.onClick();
    assert.deepEqual(calls, [['group:1', 7], ['group:1', 7, true]]);
    notice.busy = true; c.foundation.properties.flush(); primary.onClick(); secondary.onClick();
    assert.equal(calls.length, 2, 'busy blocks both original-operation actions');
    owner.presentation.identity = 'group:2'; notice.onReconcile(7); notice.onSecondaryAction(7);
    assert.equal(calls.length, 2, 'old identity cannot dispatch against a reopened group');
    value.windowRect.height = 500; owner.viewportHeight = 500; owner.metricsRevision += 1; c.foundation.properties.flush();
    assert.equal(owner.recoveryAvailableHeight(), 390, 'height-only resize recomputes the current safe remainder');
    results.push({ case: 'bookshelf-group-recovery-capacity', height, scale, maxHeight: expected });
  }
}

function supplementalRendererPilot() {
  const value = metrics(320, 180, 2), c = context(value), rel = 'pages/ReaderRendererPilot.ets', source = read(rel);
  // Inactive specialized descendants need their actual ETS schemas for SDK lowering.
  // These actors are not instantiated by the default diagnostic-menu case.
  const pilotHooks = { ...c.hooks, childSources: { ...c.hooks.childSources,
    ReaderMangaPlatformDiagnostic: read('pages/ReaderMangaPlatformDiagnostic.ets'),
    ReaderTextNodeDiagnostic: read('pages/ReaderTextNodeDiagnostic.ets'),
    ReaderParagraphDiagnostic: read('pages/ReaderParagraphDiagnostic.ets'),
    ArkWebExecutionHost: read('ui/platform/ArkWebExecutionHost.ets') } };
  function pilot(definition, mode = 'default', height = 180) {
    const owner = compileTailConsumer(definition, ['build', 'diagnosticMenu', 'menuHeight'], { ...c.deps, DEBUG: true, BUILD_MODE_NAME: 'debug', $rawfile: name => ({ rawfile: name }) }, pilotHooks).owner;
    Object.assign(owner, { readerWindowMetricsRevision: 1, hostHeight: height, result: '诊断状态'.repeat(30), mangaMode: mode === 'manga', textNodeMode: mode === 'text', paragraphMode: mode === 'paragraph', resourceMode: false, resourceBusy: false, controller: {} });
    owner.initialRender(); return owner;
  }
  for (const height of [180, 60, 0]) {
    const owner = pilot(source, 'default', height), nodes = c.nodes(owner), scroll = nodes.find(node => node.type === 'Scroll');
    assert.equal(scroll.constraintSize.maxHeight, height / 2); assert.equal(nodes.filter(node => node.type === 'Button').length, 6);
    assert.ok(nodes.filter(node => node.type === 'Button').every(node => node.constraintSize.minWidth >= 44 && node.constraintSize.minHeight >= 44));
    assert.ok(nodes.some(node => node.type === 'Web' && node.layoutWeight === 1), 'diagnostic Web receives the paid remaining viewport');
    assert.ok(6 * 44 > scroll.constraintSize.maxHeight, 'short-host document requires the actual Scroll owner');
  }
  for (const mode of ['mangaMode', 'textNodeMode', 'paragraphMode', 'resourceMode']) {
    const owner = compileTailConsumer(source, ['diagnosticMenu', 'menuHeight'], { ...c.deps, DEBUG: true, BUILD_MODE_NAME: 'debug' }, c.hooks).owner;
    Object.assign(owner, { result: '诊断状态', hostHeight: 60, mangaMode: false, textNodeMode: false, paragraphMode: false, resourceMode: false,
      resourceBusy: false, resourceDiagnostic: { dispose() {} }, [mode]: true });
    owner.diagnosticMenu(); const actions = c.nodes(owner).filter(node => node.type === 'Button');
    assert.equal(actions.length, mode === 'resourceMode' ? 4 : 2, 'current specialized mode keeps return/status and every local menu action');
    const back = actions.at(-1); back.onClick(); assert.equal(owner[mode], false, 'current specialized return remains reachable through the menu document');
  }
  const before = source.replace('Scroll() { this.diagnosticMenu(); }', 'Column() { this.diagnosticMenu(); }');
  assert.notEqual(before, source);
  assert.throws(() => assert.ok(c.nodes(pilot(before)).some(node => node.type === 'Scroll')), /AssertionError/, 'old diagnostic menu without Scroll rejected');
  results.push({ case: 'renderer-pilot', supplemental: 'six normal Native menu actions and specialized return actions in actual bounded Scroll, weighted Web remainder' });
}
function downloadAccessibility() {
  const value = metrics(366, 600, 1), c = context(value), calls = [];
  const rel = 'features/downloads/ui/SharedDownloadPage.ets';
  const chapter = { key: 'c1', chapterId: 'c1', index: 1, title: '第一章', stateLabel: '已下载', localComplete: true, queueState: 'complete', navigable: true };
  const book = { key: 'b1', title: '测试书籍', author: '作者', stateLabel: '', contentKind: 'novel', chapters: [chapter] };
  const deps = { ...c.deps, DOWNLOAD_VISUAL, downloadVisualColor, sharedDownloadContentInsets, downloadChapterDetailLabel };
  const coverSource = read('features/downloads/ui/SharedDownloadBookCover.ets');
  const placeholderSource = read('ui/patterns/NoCoverCover.ets');
  deps.NoCoverCover = createReaderBuilderProbe(placeholderSource,
    ['appThemeScheme', 'coverWidth', 'coverHeight', 'glyph', 'kindLabel', 'build', 'x', 'y', 'scaleCoverUnit'], deps, c.hooks).Component;
  deps.SharedDownloadBookCover = createReaderBuilderProbe(coverSource,
    ['bookKey', 'coverUrl', 'presentationGeneration', 'coverWidth', 'coverHeight', 'bookTitle', 'kindLabel',
      'imageFailed', 'requestGeneration', 'mounted',
      'build', 'requestIdentity', 'rejectImage', 'resetImage'], deps,
    { ...c.hooks, childSources: { ...c.hooks.childSources, NoCoverCover: placeholderSource } }).Component;
  const methods = ['bookRow', 'chapterRow', 'eventBook', 'eventChapter', 'chapterButtonLabel', 'chapterIsRunning',
    'chapterRowWrap', 'chapterTextAvailableWidth', 'currentMetrics', 'pageViewportWidth', 'contentLeftInset', 'contentRightInset'];
  function render(managing, method) {
    const owner = createReaderBuilderProbe(read(rel), methods, deps,
      { ...c.hooks, childSources: { ...c.hooks.childSources, SharedDownloadBookCover: coverSource } }).owner;
    Object.assign(owner, { appThemeScheme: 'day', managing, selectedBookKeys: ['b1'], detailKey: 'b1', presentationGeneration: 7,
      pageWidth: 366, readerWindowMetricsRevision: 1,
      bookHeight: () => 160, authorSource: () => '作者，书源', downloadCount: () => '1章',
      fontScale: () => 1, unit: () => '章', chapterMenuFocusKey: () => 'menu:c1',
      bookProgressSpacer: () => 0, focusKey: text => text, visualIcon: () => ({}),
      currentChapterForBook: () => undefined, chapterTextMinimum: () => 120,
      chapterReadingFocusKey: () => 'chapter:c1', chapterSelected: () => true,
      primaryInk: () => '#111111', uiInputIsCurrent(generation) { return generation === this.presentationGeneration; },
      modalBlocking: () => false, findCurrentBook: () => book,
      toggleBook: (...args) => calls.push(['book', ...args]), toggleChapter: (...args) => calls.push(['chapter', ...args]),
      showReadTarget: (...args) => calls.push(['read', ...args]), statusButton() {}, moreButton() {},
      recordBookHeight() {}, recordBookContentHeight() {}, openBook() {} });
    if (method === 'bookRow') owner.bookRow(() => book, false, 7);
    else owner.chapterRow(() => book, () => chapter, 7);
    return { owner, nodes: c.nodes(owner) };
  }
  for (const method of ['bookRow', 'chapterRow']) {
    const { owner, nodes } = render(true, method);
    const box = nodes.find(node => node.type === 'Checkbox');
    assert.ok(box); assert.equal(box.select, true, 'native selection state remains present');
    assert.equal(box.accessibilityText, method === 'bookRow' ? '选择书籍：测试书籍，作者，书源' : '选择章节：第一章，测试书籍');
    const before = calls.length; box.onChange(false); assert.equal(calls.length, before + 1);
    assert.equal(calls.at(-1)[0], method === 'bookRow' ? 'book' : 'chapter');
    owner.presentationGeneration += 1; box.onChange(true); assert.equal(calls.length, before + 1, 'retired carrier cannot change selection');
    if (method === 'chapterRow') assert.equal(nodes.find(node => node.type === 'Text' && node.create === chapter.title).accessibilityLevel, 'no');
  }
  const { nodes } = render(false, 'chapterRow');
  const title = nodes.find(node => node.type === 'Text' && node.create === chapter.title);
  assert.equal(title.accessibilityRole, 'AccessibilityRoleType.BUTTON');
  assert.equal(title.accessibilityText, '打开章节：第一章，测试书籍');
  assert.equal(title.accessibilityLevel, 'yes');
  const before = calls.length; title.onClick(); assert.equal(calls.length, before + 1);
  assert.equal(calls.at(-1)[0], 'read');
  results.push({ kind: 'download-accessibility', selectedCarriers: 2, chapterAction: true, retiredCallbacksRejected: true });
}

function supplementalChapterWidths() {
  const rel = 'features/downloads/ui/SharedDownloadPage.ets', source = read(rel);
  for (const width of [320, 366]) for (const safeInset of [0, 40]) for (const scale of [1, 2, 3]) for (const managing of [false, true]) {
    const value = metrics(width, 360, scale); value.systemInsets.left = safeInset; value.systemInsets.right = safeInset;
    const c = context(value), calls = [];
    const methods = ['chapterRow', 'chapterRowWrap', 'chapterTextAvailableWidth', 'chapterTextMinimum', 'moreButton',
      'chapterButtonLabel', 'chapterIsRunning', 'fontScale', 'currentMetrics', 'pageViewportWidth',
      'contentLeftInset', 'contentRightInset', 'eventBook', 'eventChapter'];
    const deps = { ...c.deps, DOWNLOAD_VISUAL, downloadVisualColor, sharedDownloadContentInsets, downloadChapterDetailLabel };
    const chapter = { key: 'c1', chapterId: 'c1', index: 1, title: '当前章节标题', stateLabel: '已下载', localComplete: true, queueState: 'complete', navigable: true };
    const book = { key: 'b1', contentKind: 'novel', chapters: [chapter] };
    const fields = { appThemeScheme: 'day', readerWindowMetricsRevision: 1, managing, pageWidth: 0, detailKey: 'b1', presentationGeneration: 7,
      currentChapterForBook: () => chapter, focusKey: text => text, chapterReadingFocusKey: () => 'chapter:c1', primaryInk: () => '#111111',
      visualIcon: () => ({}), chapterMenuFocusKey: () => 'menu:c1', chapterSelected: () => false, toggleChapter() {},
      uiInputIsCurrent(generation) { return generation === this.presentationGeneration; }, modalBlocking: () => false, findCurrentBook: () => book,
      showReadTarget: (...args) => calls.push(args), chapterProof: current => current, openSheet() {} };
    const owner = createReaderBuilderProbe(source, methods, deps, c.hooks).owner; Object.assign(owner, fields);
    owner.chapterRow(() => book, () => chapter, 7);
    const nodes = c.nodes(owner), title = nodes.find(node => node.type === 'Text' && node.create === chapter.title);
    const tag = nodes.find(node => node.type === 'Text' && node.create === '当前阅读');
    const outer = nodes.find(node => node.type === 'Flex' && node.padding?.left === DOWNLOAD_VISUAL.chapterPaddingX);
    assert.ok(outer && outer.height === undefined);
    assert.ok(nodes.filter(node => node.type === 'Flex' && node !== outer).every(node => node.create.wrap === 'FlexWrap.Wrap'));
    const innerWidth = width - owner.contentLeftInset() - owner.contentRightInset() - outer.padding.left - outer.padding.right;
    assert.ok(title.constraintSize.minWidth >= 44 && title.constraintSize.minHeight >= 44 && title.constraintSize.minWidth <= innerWidth);
    assert.equal(title.constraintSize.minWidth, owner.chapterTextMinimum());
    const info = nodes.find(node => node.type === 'Column' && node.flexBasis === owner.chapterTextMinimum());
    assert.ok(info && info.constraintSize.minWidth === title.constraintSize.minWidth, 'title and its physical info carrier pay the same actual minimum');
    const action = nodes.find(node => node.type === 'Button' && node.constraintSize?.minWidth === 44);
    const label = nodes.find(node => node.type === 'Text' && node.create === '阅读');
    const more = nodes.find(node => node.type === 'Button' && node.width === 44 && node.height === 44);
    const actionWidth = managing ? 0 :
      Math.max(action.constraintSize.minWidth, Math.ceil(glyph(label.create, label.fontSize * scale, label.fontWeight).width) +
        action.padding.left + action.padding.right);
    const tailWidth = managing ? 0 : actionWidth + DOWNLOAD_VISUAL.chapterTailGap + more.width;
    const sideLane = managing ? DOWNLOAD_VISUAL.touchTarget : tailWidth;
    const keepsSideLaneInline = innerWidth >= sideLane + DOWNLOAD_VISUAL.chapterGap + 120 * scale;
    assert.equal(outer.create.wrap, keepsSideLaneInline ? 'FlexWrap.NoWrap' : 'FlexWrap.Wrap',
      'the checkbox or both browse actions stay beside chapter copy when their minimum widths fit');
    assert.equal(info.flexShrink, managing || keepsSideLaneInline ? 1 : 0,
      'chapter copy can shrink only down to its admitted inline width');
    if (!managing) {
      const tail = nodes.find(node => node.type === 'Row' && node !== outer && node.flexShrink === 0);
      assert.ok(tail, 'the paired chapter actions do not surrender their width to the title');
    }
    if (width === 366 && safeInset === 0 && scale === 1) {
      const prior = source.replace('wrap: this.chapterRowWrap()', 'wrap: FlexWrap.Wrap');
      assert.notEqual(prior, source);
      const old = createReaderBuilderProbe(prior, methods, deps, c.hooks).owner;
      Object.assign(old, fields);
      old.chapterRow(() => book, () => chapter, 7);
      const oldOuter = c.nodes(old).find(node => node.type === 'Flex' && node.padding?.left === DOWNLOAD_VISUAL.chapterPaddingX);
      assert.equal(oldOuter.create.wrap, 'FlexWrap.Wrap', 'the unchecked row can wrap even with enough width for its side lane');
    }
    const tagWidth = glyph(tag.create, tag.fontSize * scale, tag.fontWeight).width + tag.padding.left + tag.padding.right;
    if (!managing) {
      if (safeInset === 40 && scale >= 2) {
        assert.ok(info.flexBasis + tailWidth + DOWNLOAD_VISUAL.chapterGap > innerWidth, 'actual minima force the trailing actions onto another natural row');
        assert.ok(title.constraintSize.minWidth + tagWidth + DOWNLOAD_VISUAL.statusGap > info.flexBasis, 'current reading tag cannot steal the minimum title lane');
      }
      action.onClick(); assert.equal(calls.length, 1);
      owner.presentationGeneration += 1; action.onClick(); assert.equal(calls.length, 1, 'existing action callback still rejects retired presentation generation');
      if (width === 320 && safeInset === 40 && scale === 2) {
        const prior = source.replace(/Flex\(\{ wrap: this.chapterRowWrap\(\), alignItems: ItemAlign.Start,\s*space: \{ main: LengthMetrics.vp\(DOWNLOAD_VISUAL.chapterGap\), cross: LengthMetrics.vp\(DOWNLOAD_VISUAL.chapterGap\) \} \}\)/, 'Row({ space: DOWNLOAD_VISUAL.chapterGap })')
          .replace(/Flex\(\{ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,\s*space: \{ main: LengthMetrics.vp\(DOWNLOAD_VISUAL.statusGap\), cross: LengthMetrics.vp\(DOWNLOAD_VISUAL.statusGap\) \} \}\)/, 'Row({ space: DOWNLOAD_VISUAL.statusGap })')
          .replace('.flexGrow(1).flexShrink(0).flexBasis(this.chapterTextMinimum())', '.layoutWeight(1)')
          .replace("minWidth: this.chapterTextMinimum(), maxWidth: '100%', minHeight: DOWNLOAD_VISUAL.touchTarget", 'minHeight: DOWNLOAD_VISUAL.touchTarget')
          .replace(/}\.flexGrow\(1\)\.flexShrink\([^\n]*?\)\.flexBasis\(this\.chapterTextMinimum\(\)\)\s*\.constraintSize\(\{ minWidth: this.chapterTextMinimum\(\) \}\)\.alignItems/, '}.layoutWeight(1).alignItems');
        assert.notEqual(prior, source);
        const old = createReaderBuilderProbe(prior, methods, deps, c.hooks).owner; Object.assign(old, fields); old.chapterRow(() => book, () => chapter, 7);
        const oldOuter = c.nodes(old).find(node => node.type === 'Row' && node.padding?.left === DOWNLOAD_VISUAL.chapterPaddingX);
        assert.ok(oldOuter);
        const oldTitleWidth = innerWidth - DOWNLOAD_VISUAL.chapterGap - tailWidth - DOWNLOAD_VISUAL.statusGap - tagWidth;
        assert.equal(oldTitleWidth, 23);
        assert.throws(() => assert.ok(oldTitleWidth >= 44), /AssertionError/, 'actual prior fixed Row23vp title budget is rejected');
      }
    }
    results.push({ case: 'download-chapter-width', chapter: { width, safeInset, scale, managing, innerWidth, titleMinimum: title.constraintSize.minWidth, tagWidth, sideLane, keepsSideLaneInline } });
  }
}
const runners = { 'select-host': selectHost, 'actions-tools-rules': actionsToolsRules, 'recovery-overlays': recoveryOverlays,
  'select-reduce-motion': selectReduceMotion, 'bookshelf-group-recovery-capacity': bookshelfGroupRecoveryCapacity,
  'arkweb-host': arkwebHost, 'retained-and-settings': retainedAndSettings, 'title-scale': titleScale,
  'page-back-bar-title-wrap': pageBackBarTitleWrap,
  'download-controls': supplementalDownloadControls, 'renderer-pilot': supplementalRendererPilot, 'download-chapter-width': supplementalChapterWidths,
  'download-accessibility': downloadAccessibility };
const supplemental = { 'select-host': supplementalSelectTargets, 'actions-tools-rules': supplementalInputTargets,
  'recovery-overlays': supplementalPreviewDocument, 'retained-and-settings': supplementalRetainedTargets };
for (const id of selected) { await runners[id](); await supplemental[id]?.(); recordContractCasePass(id); }
const inputs = [...new Set(['ui/controls/ReaderButton.ets', 'ui/controls/ReaderControlSpecs.ets', 'ui/controls/ReaderSelectPanel.ets',
  'ui/feedback/ReaderRecoveryNotice.ets', 'ui/platform/ArkWebExecutionHost.ets', 'ui/chrome/PageBackBar.ets', 'ui/surfaces/ReaderBoundedSurfaceHeader.ets',
  'features/source/ui/SourceToolsPage.ets', 'features/settings/ui/RulesManagementPage.ets', 'features/settings/ui/SettingsSelectOverlay.ets'])]
  .map(path => ({ path: `entry/src/main/ets/${path}`, sha256: createHash('sha256').update(read(path)).digest('hex') }));
const report = { command: { entry: 'tools/test-secondary-layout-repairs.mjs', cases: selected },
  selectedProductionInputs: inputs, selectedProductionInputsArePartial: true,
  completeInputManifest: process.env.READER_LAYOUT_TRACE_OUTPUT ?? 'NOT_RECORDED',
  inputBinding: 'Companion execution-input manifest captures all actual local fs/load reads, SDK files and exit stability. Explicit font hashes cover Python FreeType child reads.',
  glyphFonts: [...glyphFonts].map(([path, sha256]) => ({ path, sha256 })),
  glyphRuntime: glyphCache.size > 0 ? JSON.parse(execFileSync('python3', ['-c', "import sys,json,PIL; from PIL import features; print(json.dumps({'python':sys.version,'pillow':PIL.__version__,'freetype':features.version('freetype2'),'raqm':features.version('raqm')}))"], { encoding: 'utf8' })) : undefined,
  results, glyphMeasurements: glyphCache.size,
  boundary: 'Actual installed ETS-emitted carriers/observers and bundled-font FreeType measurements. Native layout, pixel/IME/pointer, screen-reader and user acceptance NOT_RUN.' };
if (selected.length) writeFileSync(new URL('../.reader-artifacts/framework-confluence-20261112/code-side-audit/repair-secondary-post-' + selected.join('+') + '.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ command: report.command, result: 'PASS', samples: results.length, glyphMeasurements: glyphCache.size, completeInputManifest: report.completeInputManifest }));

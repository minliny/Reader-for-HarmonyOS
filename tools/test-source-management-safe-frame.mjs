import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'safe-frame': 'Actual SourceManagementPage safe geometry, source row, 40vp query with expanded hit targets, and responsive footer at 320/366, safe edges 0/40, scales 1/1.3/1.6/2/3.2. Includes busy states, long metadata, and old forced-inline/hard-min/clear-overflow negatives. Code-side dimensions and callback admission only.',
});
if (selected.length === 0) process.exit(0);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(fileURLToPath(url))) return next(url.href, context);
  }
  return next(specifier, context);
} });
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { sourceV9ChromeControls } = await import('./lib/source-v9-chrome-sdk-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { foundationControls, readerFoundationTokens, foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
const { switchSpecs } = await import('./lib/reader-switch-control-probe.mjs');
const { labeledIconControls, labeledIconSpecs } = await import('./lib/reader-labeled-icon-action-probe.mjs');
const { iconButtonControls } = await import('./lib/reader-icon-button-probe.mjs');
const searchGeometry = await import('../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts');
const { APP_FLOATING_HEADER_BAR_HEIGHT } = await import('../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts');
const { sourceV9DisplayUrl, sourceV9ReportFill, sourceV9ReportTone } = await import('../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { actualSourceManagementGeometry } = await import('./lib/source-management-owner-probe.mjs');
const { resolveSourceManagementLayout, SOURCE_ROW_ACTION_GAP, SOURCE_ROW_ICON_WIDTH } = await import('../entry/src/main/ets/features/source/presentation/SourceManagementLayout.ts');
const { readerReadableFontScale, readerScaledControlHeight } = await import('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts');
const { readerSourceCategoryLabel } = await import('../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const { createDefaultReaderWindowMetrics, ReaderInsetsVp, ReaderRectVp } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const base = new URL('../entry/src/main/ets/', import.meta.url);
const pageFile = new URL('features/source/ui/SourceManagementPage.ets', base);
const read = path => readFileSync(new URL(path, base), 'utf8');
const pageSource = readFileSync(pageFile, 'utf8');
const searchSource = read('ui/controls/ReaderSearchField.ets');
const toggleSource = read('ui/controls/ReaderToggle.ets');
const layoutSource = read('features/source/presentation/SourceManagementLayout.ts');
const specs = foundationSpecs();
const { readerActionTouchRegion } = pureModuleProbe(read('ui/controls/ReaderActionAccessibility.ets'),
  'ReaderActionAccessibility.ets', {}, ['readerActionTouchRegion']);
const samples = [];
const widths = [320, 366], fontScales = [1, 1.3, 1.6, 2, 3.2], safeEdges = [0, 40];

function geometryOwner(metrics, resolver = resolveSourceManagementLayout) {
  const geometry = actualSourceManagementGeometry(metrics);
  const Page = selectedProductionMethods(pageFile, 'SourceManagementPage',
    ['fontScale', 'layoutBudget', 'footerControlHeight', 'footerFallbackHeight', 'footerContentWidth', 'footerStacked', 'footerManageWidth', 'footerActionHeight', 'refreshGeometry', 'contentFrame'],
    { ...geometry, ...readerTypographyRoles, ...readerFoundationTokens, ...specs, ...labeledIconSpecs(),
      readerReadableFontScale, readerScaledControlHeight, APP_FLOATING_HEADER_BAR_HEIGHT, resolveSourceManagementLayout: resolver });
  const page = Object.assign(new Page(), { readerWindowMetricsRevision: 1,
    viewportWidth: metrics.windowRect.width, viewportHeight: metrics.windowRect.height, measurementRevision: 0,
    measurementKey: 1, measurements: new geometry.ReaderMeasurementStore(), actionBottomInset: () => 16,
    observeVerificationGeometry() {} });
  page.refreshGeometry();
  return page;
}

function controls(metrics, fieldSource = searchSource) {
  const foundation = foundationControls({ windowMetrics: () => metrics });
  const labeled = labeledIconControls({ foundation });
  const icon = iconButtonControls({ properties: foundation.properties });
  const dependencies = { ...labeled.dependencies, ...switchSpecs(), ...icon.dependencies,
    ...readerTypographyRoles, ...readerFoundationTokens, ...searchGeometry, readerScaledControlHeight, readerReadableFontScale,
    READER_FONT_NOTO_SANS_SC_UI_MEDIUM, SOURCE_ROW_ACTION_GAP, SOURCE_ROW_ICON_WIDTH, sourceV9DisplayUrl, sourceV9ReportFill, sourceV9ReportTone, readerAppColor, readerSourceCategoryLabel,
    readerWindowMetrics: () => metrics,
    uiContext: { getFont: () => ({}), vp2px: value => value } };
  const toggle = createReaderBuilderProbe(toggleSource, boundedMembers(toggleSource), dependencies, foundation.hooks);
  const modifiers = pureModuleProbe(fieldSource.slice(0, fieldSource.indexOf('@Component')),
    'ReaderSearchInputTarget.ets', { FrameCallback: class {}, readerActionTouchRegion }, ['ReaderSearchInputTarget']);
  const searchMembers = ['appThemeScheme', 'readerWindowMetricsRevision', 'variant', 'sourceV9Chrome', 'mode', 'text', 'placeholder',
    'accessibilityLabel', 'submitEnabled', 'onTextChange', 'onSubmit', 'mounted', 'build', 'isBookField',
    'autoLineHeightField', 'nativeInputBackground', 'nativeFieldBackground', 'fieldHeight', 'inputHeight', 'directoryFontScale',
    'iconGap', 'searchIcon', 'iconSize', 'horizontalPadding', 'fieldBackgroundColor', 'fieldBorderWidth', 'fieldBorderColor',
    'cornerRadius', 'inputColor', 'caretColor', 'placeholderColor', 'resolvedAccessibilityLabel', 'textStyle',
    'changeText', 'submit', 'autoClearButtonVisible', 'directoryFontScale', 'editingNativeId', 'directoryFocusId',
    'editingFocusId', 'clearButton', 'resolvedClearAccessibilityLabel', 'clearAccessibilityLabel'];
  const field = createReaderBuilderProbe(fieldSource, searchMembers, { ...dependencies, ...modifiers }, foundation.hooks);
  Object.assign(dependencies, { ReaderToggle: toggle.Component, ReaderIconButton: icon.icon.Component,
    ReaderSearchField: field.Component });
  const hooks = { ...labeled.hooks, childSources: { ...labeled.hooks.childSources,
    ReaderToggle: toggleSource, ...icon.hooks.childSources, ReaderSearchField: fieldSource } };
  const chrome = sourceV9ChromeControls(dependencies, hooks);
  return { foundation, nodes: owner => foundation.nodes(owner),
    consumer(source, names) { return createReaderBuilderProbe(source, names, chrome.dependencies, chrome.hooks).owner; } };
}

const rowMembers = ['sourceRow', 'sourceRowContent', 'isFirstSource', 'isLastSource', 'sourceLeading', 'sourceInfo', 'sourceDomain',
  'sourceActions', 'detectButton', 'loginInk', 'loginSurface', 'loginButton', 'sourceSwitch', 'sourceSwitchValue',
  'sourceSwitchName', 'currentSourceRow', 'currentSourceInfo',
  'sourceRenderKey', 'sourceRowKey', 'firstSourceId', 'lastSourceId', 'projectedSources', 'sources', 'verificationRowTextId', 'verificationRowId'];
function mountRow(c, page, book, source = pageSource) {
  const owner = c.consumer(source, rowMembers);
  Object.assign(owner, { appThemeScheme: 'day', contentFrame: page.contentFrame.bind(page), fontScale: page.fontScale.bind(page),
    layoutBudget: page.layoutBudget.bind(page), temporaryBackIdentity: 'source-opening', verificationOpening: '',
    projectedSources: [book], firstSourceId: book.sourceId, lastSourceId: book.sourceId,
    cancelToolsReturnFocus() {}, sourceRowCommand: () => () => {}, sourceRowToggle: () => () => {},
    sourceDetectEnabled: () => book.checkState !== 'checking', sourceActionEnabled: () => true,
    sourceToggleBusy: () => false, sourceActionLabel: (_source, action) => action,
    scheduleImportStatusReadyObservation() {}, offlineDetectBadgeId: () => '', verificationRowActionsCurrent: () => false, sourceBadgeLabel: () => '检测通过' });
  owner.updateStateVars({ sources: [book] });
  owner.sourceRow(book);
  return owner;
}

function assertRow(c, owner, page, book) {
  const budget = page.layoutBudget(book), nodes = c.nodes(owner);
  const row = nodes.find(node => node.type === 'Column' && node.constraintSize?.minHeight === budget.rowMinHeight);
  assert.ok(row && row.height === undefined, 'source row grows from its native children');
  const physicalWidth = row.width - row.padding * 2 - row.border.width.left - row.border.width.right;
  const info = nodes.find(node => node.type === 'Column' && node.accessibilityText?.includes(book.baseUrl));
  assert.ok(budget.textAvailableWidth >= 0 && info.constraintSize.minWidth >= 0 &&
    info.constraintSize.minWidth <= budget.textAvailableWidth && budget.textAvailableWidth <= physicalWidth,
    'text minimum must fit the physical safe host');
  const actions = nodes.find(node => node.type === 'Row' && node.constraintSize?.minHeight === budget.actionsHeight);
  assert.ok(actions?.width <= physicalWidth, 'trailing carrier is physically bounded');
  const detects = nodes.filter(node => node.type === 'Button' && node.width === 28 && node.height === 28);
  const logins = nodes.filter(node => node.type === 'Button' && node.width === 58 && node.height === 26);
  assert.equal(detects.length, 1);
  assert.equal(logins.length, book.loginUrl ? 1 : 0);
  const buttons = [...logins, ...detects];
  const busy = book.checkState === 'checking';
  for (const button of buttons) assert.equal(button.enabled, !busy);
  const actualText = nodes.filter(node => node.type === 'Text').map(node => node.create);
  assert.equal(actualText.includes('登录'), !!book.loginUrl);
  assert.equal(nodes.filter(node => node.type === 'LoadingProgress' && node.width === 15).length, busy ? 1 : 0);
  assert.equal(nodes.filter(node => node.type === 'Image' && node.create === 'app.media.source_v9_wave').length, busy ? 0 : 1);
  const toggle = nodes.find(node => node.type === 'Toggle');
  assert.ok(toggle);
  const actualWidths = [...buttons.map(button => button.width), toggle.width];
  const actualHeights = [...buttons.map(button => button.height), toggle.responseRegion.height];
  const actionWidth = actualWidths.reduce((total, width) => total + width, 0) + actions.create.space * (actualWidths.length - 1);
  const actionHeight = Math.max(...actualHeights);
  assert.equal(actionWidth, actions.width, 'budget includes every native action and inter-control gap');
  assert.equal(actionHeight, budget.actionsHeight);
  assert.equal(budget.actionRowCount, 1);
  const title = nodes.find(node => node.type === 'Text' && node.create === book.name);
  const metadata = nodes.find(node => node.type === 'Text' && node.create === sourceV9DisplayUrl(book.baseUrl));
  assert.equal(title.maxLines, 1); assert.equal(metadata.maxLines, 1);
  assert.ok(!actualText.includes(book.checkMessage) && !actualText.includes(book.baseUrl.replace('https://', '')),
    'visual rows retain the host and omit the historical report summary and URL path');
  const stamp = nodes.find(node => node.type === 'Stack' && node.width === SOURCE_ROW_ICON_WIDTH);
  assert.equal(stamp.height, 34);
  const gap = readerFoundationTokens.TOK_SPACE_XS;
  const infoRequiredHeight = (title.lineHeight + metadata.lineHeight) * page.fontScale() + 3;
  const bodyHeight = budget.rowForm === 'stacked-leading' ? stamp.height + gap + infoRequiredHeight : Math.max(stamp.height, infoRequiredHeight);
  const requiredHeight = budget.rowForm === 'inline' ? Math.max(bodyHeight, actionHeight) : bodyHeight + gap + actionHeight;
  assert.ok(budget.rowMinHeight >= requiredHeight + row.padding * 2 + row.border.width.top + row.border.width.bottom,
    'row minimum pays the title and domain lineboxes, actual action lane, card padding and borders');
  if (budget.rowForm === 'inline') {
    assert.ok(stamp.width + 2 * gap + info.constraintSize.minWidth + actionWidth <= physicalWidth, 'inline row width fits the actual host');
    assert.ok(info.constraintSize.minWidth >= 96 * page.fontScale(), 'inline text has the preferred reading width');
  }
  return { budget, physicalWidth, actionWidths: actualWidths, actionHeights: actualHeights, requiredHeight };
}

function mountQuery(c, page) {
  const owner = c.consumer(pageSource, ['searchField', 'sourceSearchInputIdentity', 'applySourceSearchInput']);
  Object.assign(owner, { appThemeScheme: 'day', contentFrame: page.contentFrame.bind(page), layoutBudget: page.layoutBudget.bind(page),
    temporaryBackIdentity: 'source-opening', searchQuery: '初始查询', searchInputRevision: 0, appForeground: true, mounted: true, groupOpen: false,
    managementOpeningIsCurrent: () => true, managementInputIsCurrent: () => true,
    cancelToolsReturnFocus() {}, rebuildSourceProjection() {}, groupFilter() {} });
  owner.searchField();
  const field = [...owner.children.values()].flatMap(child => [...(child.children?.values() ?? [])]).find(child => child.variant === 'sourceManagement') ??
    [...owner.children.values()].find(child => child.variant === 'sourceManagement');
  assert.ok(field, 'actual parent mounts the sourceManagement field');
  field.mounted = true;
  return { owner, field };
}

function assertQuery(c, query, page) {
  const nodes = c.nodes(query.owner), input = nodes.find(node => node.type === 'TextInput');
  const borderRow = nodes.find(node => node.type === 'Row' && node.border && node.height === query.field.fieldHeight());
  assert.ok(input && borderRow);
  assert.equal(borderRow.borderRadius, 10, 'v9 query frame has its rectangular rounding');
  assert.equal(borderRow.height, 40);
  assert.equal(borderRow.border.width, 1);
  assert.equal(input.height, borderRow.height - borderRow.border.width * 2, 'native input uses the paid inner height');
  const lineHeight = readerTypographyRoles.TYPE_SEARCH_SOURCE_INPUT.lineHeightFp;
  assert.equal(input.maxFontScale, Math.min(page.fontScale(), input.height / lineHeight), 'fixed query bounds the scaled text line');
  assert.equal(page.layoutBudget().filterHeight, borderRow.height, 'ordinary filter parent pays the exact field height');
  assert.equal(input.responseRegion.height, Math.max(44, input.height));
  assert.equal(input.responseRegion.y, Math.min(0, (input.height - 44) / 2));
  const clear = nodes.filter(node => node.type === 'Button' && node.accessibilityText === '清空书源搜索');
  assert.equal(clear.length, 1, 'a nonempty query has one clear action');
  assert.equal(clear[0].height, borderRow.height, 'clear paint stays within the query frame');
  assert.deepEqual([clear[0].responseRegion.y, clear[0].responseRegion.width, clear[0].responseRegion.height], [-2, 44, 44]);
  input.onChange('保留查询'); assert.equal(query.owner.searchQuery, '保留查询');
  query.owner.temporaryBackIdentity = 'new-opening';
  input.onChange('旧查询'); assert.equal(query.owner.searchQuery, '保留查询', 'old input owner is rejected');
  return { outerHeight: borderRow.height, inputHeight: input.height, parentHeight: page.layoutBudget().filterHeight, inputScale: input.maxFontScale };
}

function assertFooter(c, page) {
  const owner = c.consumer(pageSource, ['bottomActionBar', 'importFocusId', 'sourceAddIcon']);
  Object.assign(owner, { appThemeScheme: 'day', contentFrame: page.contentFrame.bind(page), layoutBudget: page.layoutBudget.bind(page),
    footerStacked: page.footerStacked.bind(page), footerManageWidth: page.footerManageWidth.bind(page),
    footerControlHeight: page.footerControlHeight.bind(page), temporaryBackIdentity: 'footer-opening', mounted: true,
    toolsFocusId: () => 'source-footer-tools', onToolsEntryFocused() {}, onToolsEntryLayout() {},
    onAddSource() {}, actionBottomInset: () => 16 });
  owner.bottomActionBar();
  const nodes = c.nodes(owner), footer = nodes.find(node => node.type === 'Flex' && node.margin);
  const buttons = nodes.filter(node => node.type === 'Button' && ['批量管理', '导入书源'].includes(node.accessibilityText));
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every(button => button.width === '100%'), 'both actual native footer actions fill their paid outer allocation');
  const wrappers = [...owner.nodes.values()].filter(node => node.type === '__Common__');
  assert.equal(wrappers.length, 2);
  assert.ok(wrappers.every(wrapper => wrapper.height === page.footerControlHeight()));
  const stacked = page.footerStacked();
  const [manageWrapper, addWrapper] = wrappers;
  if (stacked) assert.ok(wrappers.every(wrapper => wrapper.width === '100%'));
  else { assert.ok(manageWrapper.width >= 112); assert.equal(addWrapper.layoutWeight, 1); }
  const add = buttons.find(button => button.accessibilityText === '导入书源');
  assert.equal(add.layoutWeight, undefined, 'fillWidth NativeButton leaves vertical allocation with the parent');
  assert.equal(footer.create.direction, stacked ? 'FlexDirection.Column' : 'FlexDirection.Row');
  const requirements = buttons.map(button => {
    const text = nodes.find(node => node.type === 'Text' && node.create === button.accessibilityText);
    const paidWidth = stacked ? footer.width : button === add ? footer.width - manageWrapper.width - footer.create.space.main.value : manageWrapper.width;
    const textWidth = Math.ceil(text.fontSize * text.maxFontScale) * text.create.length;
    const extraWidth = button === add ? nodes.find(node => node.type === 'Image').width +
      nodes.find(node => node.type === 'Row' && node.create?.space !== undefined).create.space : 0;
    assert.ok(textWidth + extraWidth <= paidWidth, 'footer must pay the actual scaled CJK label, icon and gap');
    return { label: text.create, textWidth, extraWidth, paidWidth };
  });
  const manage = buttons.find(button => button.accessibilityText === '批量管理');
  assert.equal(manage.borderRadius, 999);
  const heights = buttons.map(button => button.height ?? button.constraintSize.minHeight);
  assert.deepEqual(heights, [page.footerControlHeight(), page.footerControlHeight()]);
  const requiredHeight = stacked ? heights[0] + heights[1] + footer.create.space.main.value : Math.max(...heights);
  assert.ok(footer.constraintSize.minHeight >= requiredHeight, 'footer minimum pays all current native actions');
  const expectedFooterHeight = page.footerActionHeight();
  const contentFrame = page.contentFrame;
  page.contentFrame = () => assert.fail('footer fallback must resolve the safe width before page geometry exists');
  assert.equal(page.footerFallbackHeight(), expectedFooterHeight + readerFoundationTokens.TOK_SPACE_SM + 16);
  page.contentFrame = contentFrame;
  return { stacked, requirements, requiredHeight, footerHeight: footer.constraintSize.minHeight };
}

{
  const metrics = createDefaultReaderWindowMetrics();
  metrics.windowRect = new ReaderRectVp(0, 0, 366, 844);
  const page = geometryOwner(metrics), c = controls(metrics);
  const source = { sourceId: 'retained-source', sourceVersion: 'version-A', name: 'Original source',
    category: 'novel', baseUrl: 'https://retained-source.test', enabled: true, checkState: 'passed' };
  const owner = mountRow(c, page, source);
  const toggles = () => [...owner.children.values()].filter(child => child.inputIdentity === 'source-opening:retained-source');
  assert.equal(toggles().length, 1);
  const toggle = toggles()[0];
  owner.updateStateVars({ sources: [{ ...source, sourceVersion: 'version-B', name: 'Updated source', enabled: false }] });
  c.foundation.properties.flush();
  assert.deepEqual(toggles(), [toggle], 'full source row slots retain the actual ReaderToggle child through a version update');
  assert.equal(toggle.value, false);
  assert.ok(c.nodes(owner).some(node => node.type === 'Text' && node.create === 'Updated source'), 'current information slot uses the accepted DTO');
}

for (const width of widths) for (const safe of safeEdges) for (const scale of fontScales) {
  const metrics = createDefaultReaderWindowMetrics();
  metrics.windowRect = new ReaderRectVp(0, 0, width, 640);
  metrics.systemInsets = new ReaderInsetsVp(safe, 24, safe, 16);
  metrics.systemFontScale = scale;
  const page = geometryOwner(metrics), frame = page.contentFrame();
  assert.equal(frame.width, width - 2 * Math.max(19, safe), 'actual normal page safe geometry');
  const c = controls(metrics);
  const query = assertQuery(c, mountQuery(c, page), page);
  const footer = assertFooter(c, page);
  for (const login of [false, true]) for (const busy of [false, true]) {
    const book = { sourceId: 'safe-source', name: '很长的书源名称与额外元信息始终保留', category: 'novel',
      baseUrl: 'https://very-long-source.example.test/path/to/source-with-long-metadata',
      checkMessage: '检测信息很长但保持当前业务回执与来源身份', checkState: busy ? 'checking' : 'passed', enabled: true,
      loginUrl: login ? 'https://source.example.test/login' : undefined };
    const result = assertRow(c, mountRow(c, page, book), page, book);
    samples.push({ width, safeLeft: safe, safeRight: safe, scale, login, busy, frame, ...result, query, footer });
  }
  if (width === 320 && safe === 40 && scale === 3.2) {
    const inlineFooterPage = Object.create(page);
    inlineFooterPage.footerStacked = () => false;
    assert.throws(() => assertFooter(c, inlineFooterPage), /footer must pay/, 'old forced equal footer slots must fail actual scaled labels');
    const book = { sourceId: 'negative', name: 'long', category: 'novel', baseUrl: 'https://negative.test', loginUrl: 'login', checkMessage: 'summary', checkState: 'passed', enabled: true };
    const inlineSource = layoutSource.replace(/const rowForm = inlineTextWidth[\s\S]+?\n  const textAvailableWidth/, "const rowForm = 'inline';\n  const textAvailableWidth");
    assert.notEqual(inlineSource, layoutSource);
    const forced = pureModuleProbe(inlineSource, 'ForcedInline.ts', { readerReadableFontScale }, ['resolveSourceManagementLayout']).resolveSourceManagementLayout;
    const inlinePage = geometryOwner(metrics, forced);
    assert.throws(() => assertRow(c, mountRow(c, inlinePage, book), inlinePage, book), /text minimum|actual host|physically bounded|preferred reading width/, 'forced inline must fail at the actual safe host');
    const hardMin = pageSource.replace('minWidth: this.layoutBudget(source).textMinWidth', 'minWidth: 120 * this.fontScale()');
    assert.notEqual(hardMin, pageSource);
    assert.throws(() => assertRow(c, mountRow(c, page, book, hardMin), page, book), /text minimum/, 'old hard text minimum must fail');
    const protrudingClear = searchSource.replace('.height(this.sourceV9Chrome ? 40 : SEARCH_CONTROL_MIN_TARGET)', '.height(SEARCH_CONTROL_MIN_TARGET)');
    assert.notEqual(protrudingClear, searchSource);
    const oldControls = controls(metrics, protrudingClear);
    assert.throws(() => assertQuery(oldControls, mountQuery(oldControls, page), page), /clear paint stays within/,
      'the previous 44vp visual control must fail in the 40vp query frame');
  }
}
// Keep the same lowered row and toggle while a neighbor disappears or returns.
{
  const metrics = createDefaultReaderWindowMetrics();
  metrics.windowRect = new ReaderRectVp(0, 0, 366, 800);
  const page = geometryOwner(metrics), c = controls(metrics);
  const book = { sourceId: 'middle', name: '保留行', baseUrl: 'https://middle.test', category: 'novel', enabled: true };
  const row = mountRow(c, page, book);
  const rowId = [...row.nodes].find(([, node]) => node.type === 'Column' && node.clip === true)[0];
  const toggle = c.nodes(row).find(node => node.type === 'Toggle');
  const corners = () => row.nodes.get(rowId).borderRadius;
  const border = () => row.nodes.get(rowId).border.width.bottom;
  assert.equal(row.sourceRowKey(book), book.sourceId);
  assert.equal(border(), 1);
  row.firstSourceId = 'other';
  row.lastSourceId = 'more';
  row.replayOnly([rowId]);
  assert.deepEqual(corners(), { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 });
  assert.equal(border(), 0);
  row.firstSourceId = book.sourceId;
  row.replayOnly([rowId]);
  assert.deepEqual(corners(), { topLeft: 14, topRight: 14, bottomLeft: 0, bottomRight: 0 });
  row.lastSourceId = book.sourceId;
  row.replayOnly([rowId]);
  assert.deepEqual(corners(), { topLeft: 14, topRight: 14, bottomLeft: 14, bottomRight: 14 });
  assert.equal(border(), 1);
  assert.strictEqual(c.nodes(row).find(node => node.type === 'Toggle'), toggle);
}
const report = { status: 'PASS', case: 'safe-frame', sourceRows: samples.length, geometrySamples: widths.length * safeEdges.length * fontScales.length, querySamples: 20, footerSamples: 20,
  widths, safeEdges, fontScales, negativeControls: ['forced-inline', 'hard-text-minimum', 'protruding-clear', 'forced-equal-footer'],
  boundary: 'Actual SDK emitted native properties and current production geometry arithmetic, query owner admission. Native layout solver, IME scheduling, pixels and device interaction are outside this code-side result.', samples };
console.log(JSON.stringify({ case: report.case, status: report.status, sourceRows: report.sourceRows, geometrySamples: report.geometrySamples, negativeControls: report.negativeControls, boundary: report.boundary }));
recordContractCasePass('safe-frame');

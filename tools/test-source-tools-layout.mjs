import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { selectedProductionMethods, selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { foundationControls, withReaderSectionHeading, readerFoundationTokens, surfaceFontResolvers } from './lib/reader-foundation-control-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { actualSourceManagementGeometry } from './lib/source-management-owner-probe.mjs';
import { ReaderWindowMetricsSnapshot, ReaderRectVp } from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { resolveSourceToolsRowLayout } from '../entry/src/main/ets/features/source/presentation/SourceToolsLayout.ts';

const { readerReadableFontScale, readerScaledControlHeight } = surfaceFontResolvers();
const outputArg = process.argv.slice(2).find(arg => arg.startsWith('--evidence-path='));
const outputPath = outputArg?.slice('--evidence-path='.length);
if (outputPath !== undefined) assert.ok(outputPath.startsWith('.reader-artifacts/') && !outputPath.includes('..'));
const selected = selectContractCases({
  'parent-budget': 'Actual SourceTools List/Card/row and three NativeButton parents at 320/366 × 1/1.3/1.6/2 with/without summary. Reject old58 row and forced-inline regressions. SDK dimensions only.',
}, { argv: process.argv.slice(2).filter(arg => !arg.startsWith('--evidence-path=')) });
const root = new URL('../entry/src/main/ets/', import.meta.url);
const pageSource = readFileSync(new URL('features/source/ui/SourceToolsPage.ets', root), 'utf8');
const { SourceToolListRow } = selectedProductionClasses(new URL('features/source/ui/SourceToolsPage.ets', root), ['SourceToolListRow']);
const members = ['sourceCard', 'sourceRow', 'sourceRowInfo', 'sourceRowButtons', 'sourceRowButton',
  'sourceRowKey', 'currentSourceForRow', 'currentSourceToolRow', 'sourceRowButtonLabel', 'sourceRowButtonEnabled', 'currentSourceRowAction',
  'sourceRowLayout', 'sourceListHeight', 'toolsFontScale', 'recordSourceListWidth', 'sourceRowAction'];
const samples = [];

function context(width, fontScale) {
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 844));
  metrics.systemFontScale = fontScale;
  const geometry = actualSourceManagementGeometry(metrics);
  const StandardPage = selectedProductionMethods(new URL('ui/layout/ReaderStandardPage.ets', root),
    'ReaderStandardPage', ['refreshGeometry'], { ...geometry, readerWindowMetrics: () => metrics });
  const standard = Object.assign(new StandardPage(), { variant: 'tools', viewportWidth: width, viewportHeight: 844,
    geometryRevision: 0, measurementKey: 0, contentLeadingRail: 0, contentEndInset: -1,
    headerHeight: () => 58, footerHeight: () => 0 });
  standard.refreshGeometry();
  const controls = withReaderSectionHeading(foundationControls({ windowMetrics: () => metrics }));
  const card = new controls.dependencies.ReaderCard(undefined, { specId: 'bordered-list-section', content() {} });
  card.initialRender();
  const frame = controls.nodes(card).find(node => node.type === 'Column');
  assert.equal(frame.width, '100%');
  const listWidth = standard.geometry.content.frame.width - 2 * (frame.padding + frame.border.width);
  const base = { sourceId: 'https://tools-a.test', name: '测试书源', baseUrl: 'https://tools-a.test', enabled: true };
  const rows = [false, true].map(summary => ({ source: { ...base, sourceId: base.sourceId + summary,
    ...(summary ? { lastCheckSummary: '检测完成' } : {}) }, sourceListRevision: 1, selected: false, actionsEnabled: true }));
  function make(definition = pageSource) {
    const deps = { ...controls.dependencies, SourceToolListRow, ...readerTypographyRoles, readerAppColor, readerReadableFontScale,
      readerScaledControlHeight, resolveSourceToolsRowLayout, ReaderWindowCoordinator: { metrics: () => metrics },
      readerPageAreaLength: geometry.readerPageAreaLength,
      LengthMetrics: { vp: value => value }, FlexDirection: { Row: 'row', Column: 'column' }, FlexWrap: { Wrap: 'wrap' },
      HorizontalAlign: { Start: 'start' }, TextOverflow: { Ellipsis: 'ellipsis' }, BarState: { Off: 'off' },
      LazyForEach: { create(_id, _owner, data, generate) {
        for (let index = 0; index < data.totalCount(); index++) generate(data.getData(index));
      }, pop() {} } };
    const owner = createReaderBuilderProbe(definition, members, deps, controls.hooks).owner;
    Object.assign(owner, { appThemeScheme: 'day', mounted: true, temporaryBackIdentity: 'tools-current',
      readerWindowMetricsRevision: 1, sourceListWidth: listWidth,
      sourceDataSource: { totalCount: () => rows.length, getData: index => rows[index] },
      snapshot: { sources: rows.map(row => row.source), sourceListRevision: 1, selectedSourceIds: [], busy: false },
      canWriteSources: () => true, toolsInputIsCurrent: () => true });
    return owner;
  }
  return { controls, listWidth, cardFrame: frame, rows, make };
}

function checkRow(fixture, row, definition) {
  const owner = fixture.make(definition);
  const layout = owner.sourceRowLayout(row.source);
  owner.sourceRow(row);
  const ownNodes = [...owner.nodes.values()];
  const outer = ownNodes.find(node => node.type === 'Flex' && node.padding !== undefined);
  const actions = ownNodes.find(node => node.type === 'Flex' && node.flexShrink === 0);
  const info = ownNodes.find(node => node.type === 'Column' && node.constraintSize?.minWidth !== undefined);
  assert.equal(outer.width, '100%');
  assert.equal(outer.height, undefined, 'row grows from its declared minimum and native text');
  assert.equal(outer.constraintSize.minHeight, layout.rowMinHeight);
  assert.equal(outer.padding, readerFoundationTokens.TOK_SPACE_XS);
  assert.equal(outer.create.direction, layout.inline ? 'row' : 'column');
  assert.equal(outer.create.space.main, readerFoundationTokens.TOK_SPACE_XS);
  assert.equal(actions.create.wrap, 'wrap');
  assert.equal(actions.create.space.main, readerFoundationTokens.TOK_SPACE_XS);
  assert.equal(actions.create.space.cross, readerFoundationTokens.TOK_SPACE_XS);
  assert.equal(actions.width, layout.actionsWidth);
  assert.equal(actions.constraintSize.minHeight, layout.actionsMinHeight);
  assert.equal(info.width, layout.inline ? undefined : '100%');
  if (layout.inline) assert.equal(info.constraintSize.minWidth, layout.textMinWidth);
  const native = fixture.controls.nodes(owner).filter(node => node.type === 'Button' && typeof node.onClick === 'function');
  assert.equal(native.length, 3, 'exactly one native action per selection/edit/debug');
  const width = native[0].width, height = native[0].height;
  for (const target of native) {
    assert.equal(target.width, width); assert.equal(target.height, height);
    assert.ok(target.width >= 44 && target.height >= 44);
  }
  const gap = actions.create.space.main;
  const actualColumns = Math.min(3, Math.floor((actions.width + gap) / (width + gap)));
  assert.equal(actualColumns, layout.actionColumns);
  const actualRows = Math.ceil(3 / actualColumns);
  const requiredActionsHeight = actualRows * height + (actualRows - 1) * actions.create.space.cross;
  assert.equal(actions.constraintSize.minHeight, requiredActionsHeight);
  assert.ok(actualColumns * width + (actualColumns - 1) * gap <= actions.width);
  assert.ok(actions.width <= layout.availableWidth);
  const textNodes = ownNodes.filter(node => node.type === 'Text');
  const fontScale = textNodes[0].maxFontScale;
  const requiredInfoHeight = textNodes.reduce((sum, node) => sum + node.lineHeight * fontScale, 0) + (textNodes.length - 1) * 3;
  const bodyHeight = layout.inline ? Math.max(requiredInfoHeight, requiredActionsHeight) : requiredInfoHeight + gap + requiredActionsHeight;
  const requiredRowHeight = bodyHeight + 2 * outer.padding + outer.border.width.bottom;
  assert.ok(outer.constraintSize.minHeight >= requiredRowHeight, 'row pays text/action line boxes, padding and bottom border');
  return { layout, width, height, requiredRowHeight };
}

for (const id of selected) {
  for (const width of [320, 366]) for (const fontScale of [1, 1.3, 1.6, 2]) {
    const f = context(width, fontScale);
    const rowResults = f.rows.map(row => checkRow(f, row));
    const cardOwner = f.make(); cardOwner.sourceCard();
    const list = [...cardOwner.nodes.values()].find(node => node.type === 'List');
    const total = rowResults.reduce((sum, result) => sum + result.layout.rowMinHeight, 0);
    assert.equal(list.height, Math.min(420, Math.max(58, total)));
    list.onAreaChange({}, { width: `${f.listWidth}vp` });
    assert.equal(cardOwner.sourceListWidth, f.listWidth);
    cardOwner.mounted = false; list.onAreaChange({}, { width: 999 });
    assert.equal(cardOwner.sourceListWidth, f.listWidth, 'retired measurement cannot rewrite a newer context');
    for (let index = 0; index < rowResults.length; index++) samples.push({ width, fontScale, summary: index === 1,
      listWidth: f.listWidth, cardPadding: f.cardFrame.padding, cardBorder: f.cardFrame.border.width,
      actionWidth: rowResults[index].width, actionHeight: rowResults[index].height, ...rowResults[index].layout });
  }
  const f = context(320, 2), expected = checkRow(f, f.rows[1]);
  assert.ok(expected.height > 58, 'the real 2× native child rejects the historical fixed58 row');
  assert.ok(expected.width * 3 + 2 * readerFoundationTokens.TOK_SPACE_XS > expected.layout.availableWidth,
    'the real 2× native children reject the historical three-action inline parent');
  const oldHeight = pageSource.replace('.constraintSize({ minHeight: this.sourceRowLayout(this.currentSourceForRow(row)).rowMinHeight })', '.height(58)');
  assert.notEqual(oldHeight, pageSource);
  const old = f.make(oldHeight); old.sourceRow(f.rows[1]);
  const oldOuter = [...old.nodes.values()].find(node => node.type === 'Flex' && node.padding !== undefined);
  assert.throws(() => assert.ok(oldOuter.height >= expected.requiredRowHeight), /AssertionError/);
  const forcedInline = pageSource.replace('this.sourceRowLayout(this.currentSourceForRow(row)).inline ? FlexDirection.Row : FlexDirection.Column', 'FlexDirection.Row');
  assert.notEqual(forcedInline, pageSource);
  assert.throws(() => checkRow(f, f.rows[1], forcedInline), /AssertionError/, 'old inline arrangement cannot pay current native actions');
  const result = { samples, rows: samples.length, contexts: 8, oldFixed58Rejected: true,
    oldThreeActionsInlineRejected: true, boundary: 'Actual SDK Card/List/Flex/NativeButton dimensions and declared Text line boxes. Native glyph, wrap and pointer validation remain separate.' };
  if (outputPath !== undefined) {
    const paths = ['entry/src/main/ets/features/source/ui/SourceToolsPage.ets', 'entry/src/main/ets/features/source/presentation/SourceToolsLayout.ts',
      'entry/src/main/ets/ui/controls/ReaderButton.ets', 'entry/src/main/ets/ui/controls/ReaderControlSpecs.ets',
      'entry/src/main/ets/ui/surfaces/ReaderCard.ets', 'entry/src/main/ets/ui/surfaces/ReaderCardSpecs.ets',
      'entry/src/main/ets/ui/layout/ReaderStandardPage.ets', 'entry/src/main/ets/ui/layout/ReaderPageGeometry.ts',
      'entry/src/main/ets/ui/layout/ReaderPageShell.ts', 'entry/src/main/ets/ui/layout/ReaderFloatingBarMetrics.ts',
      'entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts', 'entry/src/main/ets/ui/foundation/ReaderWidthClass.ts',
      'entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts', 'entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts',
      'entry/src/main/ets/ui/foundation/ReaderTypography.ets', 'entry/src/main/ets/ui/foundation/ReaderTokens.ets',
      'tools/test-source-tools-layout.mjs', 'tools/lib/source-management-owner-probe.mjs', 'tools/lib/reader-page-shell-runtime-probe.mjs',
      'tools/lib/reader-foundation-control-probe.mjs', 'tools/lib/reader-control-builder-probe.mjs',
      'tools/lib/selected-production-methods.mjs', 'tools/lib/arkui-property-runtime-probe.mjs',
      'tools/lib/reader-typography-probe.mjs', 'tools/lib/reader-tokens-probe.mjs',
      'tools/lib/ets-pure-module-probe.mjs', 'tools/lib/bookshelf-operation-owner-probe.mjs',
      'tools/lib/reader-press-feedback-probe.mjs', 'tools/lib/reader-window-environment-probe.mjs',
      'tools/lib/contract-case-selection.mjs', 'tools/lib/ets-compiler-runtime.mjs', 'tools/lib/tool-environment.mjs',
      'entry/src/main/ets/ui/foundation/ReaderLayoutTokens.ts', 'entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts',
      'entry/src/main/ets/ui/foundation/ReaderHeaderSpecs.ets', 'entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts',
      'entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts', 'entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts',
      'entry/src/main/ets/ui/foundation/ReaderWindowEnvironment.ts', 'entry/src/main/ets/ui/foundation/ReaderPressFeedback.ets',
      'entry/src/main/ets/ui/controls/ReaderSectionHeading.ets',
      'entry/src/main/ets/ui/layout/ReaderMeasurements.ts', 'entry/src/main/ets/ui/layout/ReaderScrollLayout.ts',
      'entry/src/main/ets/ui/layout/ReaderFrameStyle.ts', 'entry/src/main/ets/ui/layout/ReaderPageNativeAttributes.ets'];
    const inputs = paths.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex') }));
    writeFileSync(new URL('../' + outputPath, import.meta.url), JSON.stringify({ command: { entry: 'tools/test-source-tools-layout.mjs', cases: ['parent-budget'] },
      inputs, result: 'PASS', ...result }, null, 2) + '\n');
  }
  console.log(JSON.stringify(result));
  recordContractCasePass(id);
}

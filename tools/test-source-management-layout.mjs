import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const outputArgs = process.argv.slice(2).filter(arg => arg.startsWith('--evidence-path='));
if (outputArgs.length > 1) throw Error('Only one explicit evidence path is allowed');
const evidencePath = outputArgs[0]?.slice('--evidence-path='.length);
const evidenceFile = evidencePath === undefined ? new URL('page-structure/source-layout-evidence.json', import.meta.url) : new URL('../' + evidencePath, import.meta.url);
if (evidencePath !== undefined && (!evidencePath.startsWith('.reader-artifacts/') ||
  !fileURLToPath(evidenceFile).startsWith(fileURLToPath(new URL('../.reader-artifacts/', import.meta.url)))))
  throw Error('Evidence must be written to an explicit repository artifact path');
const selected = selectContractCases({ matrix: 'Actual source layout methods, SDK controls and parent builders at 320/366 × 1/1.3/1.6/2; no native glyph, pointer dispatch or business I/O.' }, { argv: process.argv.slice(2).filter(arg => arg !== '--write-evidence' && !arg.startsWith('--evidence-path=')) });
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  const { runSourceLayoutControlProbe } = await import('./lib/source-layout-control-probe.mjs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { foundationSpecs, readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
  const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
  const { labeledIconControls } = await import('./lib/reader-labeled-icon-action-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { readerReadableFontScale, readerScaledControlHeight } = await import('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts');
  const { resolveSourceManagementLayout } = await import('../entry/src/main/ets/features/source/presentation/SourceManagementLayout.ts');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const { readerSourceCategoryLabel } = await import('../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts');
  const file = new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets', import.meta.url);
  const source = readFileSync(file, 'utf8'), widths = [320, 366], fontScales = [1, 1.3, 1.6, 2];
  let scale = 1;
  const deps = { ...readerTypographyRoles, ...readerFoundationTokens, ...foundationSpecs(),
    readerReadableFontScale, readerScaledControlHeight, resolveSourceManagementLayout,
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: scale }) } };
  const Page = selectedProductionMethods(file, 'SourceManagementPage', ['fontScale', 'layoutBudget', 'footerControlHeight', 'footerFallbackHeight'], deps);
  const targets = [], budgets = [], samples = [];
  for (const width of widths) for (scale of fontScales) {
    const contentWidth = width - 38;
    const controls = runSourceLayoutControlProbe(contentWidth, scale);
    for (const name of ['detect', 'login', 'statusCompact', 'statusWide']) {
      const target = controls.targets[name];
      assert.ok(target.width >= 44 && target.height >= 44, `${name} minimum touch box`);
      assert.equal(target.maxFontScale, scale, `${name} does not cap system font growth`);
    }
    assert.equal(controls.unchanged.compact.width, null, 'unselected source-compact keeps intrinsic width');
    assert.equal(controls.unchanged.rssFeed.maxFontScale, null, 'unselected RSS gets no source font policy');
    const page = new Page();
    Object.assign(page, { readerWindowMetricsRevision: 1, contentFrame: () => ({ width: contentWidth }), actionBottomInset: () => 16 });
    for (const login of [false, true]) for (const summary of [false, true]) {
      const book = { name: '示例书源 A', category: 'novel', baseUrl: 'https://a.example.test',
        loginUrl: login ? 'https://a.example.test/login' : undefined, checkState: 'passed', checkMessage: summary ? '检测通过' : undefined };
      const budget = page.layoutBudget(book);
      assert.ok(budget.textAvailableWidth >= budget.textMinWidth, 'declared minimum text column survives each arrangement');
      assert.ok(budget.trailingWidth <= contentWidth - 8, 'all actions fit on their row without shrinking touch targets');
      if (budget.rowForm === 'stacked-actions') assert.ok(budget.rowMinHeight >= 40 + controls.targets.detect.height + 24,
        'stacked first row must reserve the actual 40vp icon as well as the action row and 24vp padding/gap');
      assert.ok(budget.footerHeight >= controls.targets.manage.height && budget.footerHeight >= controls.targets.add.height);
      assert.ok(budget.filterHeight >= controls.targets.statusWide.height && budget.filterHeight >= controls.targets.category.height);
      const sdk = boundedSurfaceSdk();
      const actor = sdk.consumer(source, ['sourceRow', 'sourceLeading', 'sourceInfo', 'sourceActions', 'statusFilter', 'categoryFilter', 'bottomActionBar'], {
        ...readerFoundationTokens, ...readerTypographyRoles, readerAppColor, readerSourceCategoryLabel,
        Alignment: { Center: 'center' }, VerticalAlign: { Center: 'center' }, HorizontalAlign: { Start: 'start' },
        TextOverflow: { Ellipsis: 'ellipsis' }, ScrollDirection: { Horizontal: 'horizontal' }, HitTestMode: { Transparent: 'transparent' },
      });
      let actionCount = 0;
      Object.assign(actor, { appThemeScheme: 'day', contentFrame: page.contentFrame, fontScale: () => scale,
        layoutBudget: page.layoutBudget.bind(page), detectButton: () => actionCount++, loginButton: () => actionCount++,
        sourceRowToggle:()=>()=>{}, statusBadge() {}, statusBadgeBackground: () => '', statusBadgeDot: () => '', statusBadgeLabel: () => '', sourceSwitch: () => actionCount++ });
      actor.sourceRow(book);
      assert.equal(actionCount, login ? 3 : 2, 'each actual branch preserves exactly one copy of every action');
      const row = sdk.nodes(actor).find(n => n.type === 'Column' && n.constraintSize?.minHeight === budget.rowMinHeight);
      assert.ok(row); assert.equal(row.height, undefined, 'row can grow from real text measurement');
      const title = sdk.nodes(actor).find(n => n.type === 'Text' && n.create === book.name);
      assert.equal(title.maxFontScale, scale);
      samples.push({ width, scale, login, summary, budget });
    }
    // The fallback may not ask for contentFrame: pageGeometry itself owns it.
    const before = page.contentFrame; page.contentFrame = () => assert.fail('footer fallback must not recurse into pageGeometry');
    assert.equal(page.footerFallbackHeight(), page.footerControlHeight() + readerFoundationTokens.TOK_SPACE_SM + 16);
    page.contentFrame = before;
    const budget = page.layoutBudget({ loginUrl: 'login', checkMessage: '检测通过', checkState: 'passed' });
    const shared = labeledIconControls({ foundation: foundationControls({ windowMetrics: () => ({ systemFontScale: scale }) }) });
    const parent = createReaderBuilderProbe(source, ['statusFilter', 'chip', 'categoryFilter', 'bottomActionBar'], {
      ...shared.dependencies, readerSourceCategoryLabel, ScrollDirection: { Horizontal: 'horizontal' }, HitTestMode: { Transparent: 'transparent' },
    }, shared.hooks).owner;
    Object.assign(parent, { appThemeScheme: 'day', contentFrame: page.contentFrame, filterControlWidth: () => contentWidth,
      layoutBudget: page.layoutBudget.bind(page), statusValue: '全部', categoryValue: 'all', actionBottomInset: () => 16,
      rebuildSourceProjection() {}, onOpenTools() {}, onAddSource() {}, toolsFocusId:()=>'',importFocusId:()=>'' });
    parent.statusFilter(); parent.categoryFilter(); parent.bottomActionBar();
    const parentNodes = shared.nodes(parent), scrolls = parentNodes.filter(n => n.type === 'Scroll');
    assert.equal(scrolls.length, 2);
    assert.ok(scrolls.every(n => n.height === budget.filterHeight && n.scrollable === 'horizontal'), 'both real filter viewports grow with their child controls');
    assert.ok(parentNodes.some(n => n.type === 'Row' && n.width === contentWidth && n.constraintSize?.minHeight === budget.footerHeight), 'actual footer parent uses the control growth budget');
    for (const name of ['manage', 'add']) assert.equal(controls.targets[name].layoutWeight, 1, 'both actual footer children share the measured parent equally');
    for (const [name, controlRef] of [['detect', 'source-detect'], ['login', 'source-login'], ['statusWide', 'source-filter-chip'], ['manage', 'footer-batch'], ['add', 'footer-add']]) {
      const t = controls.targets[name];
      targets.push({ controlRef, width, fontScale: scale, visual: { width: t.width ?? (contentWidth - readerFoundationTokens.TOK_SPACE_CONTROL_INLINE) / 2, height: t.height }, response: null });
    }
    const rowWidth = budget.rowForm === 'inline' ? 36 + 16 + budget.textMinWidth + budget.trailingWidth + 8 :
      Math.max(budget.trailingWidth, budget.textMinWidth + (budget.rowForm === 'stacked-actions' ? 44 : 0)) + 8;
    for (const [region, availableWidth, requiredWidth, availableHeight, requiredHeight, rowForm] of [
      ['row', contentWidth, rowWidth, budget.rowMinHeight, budget.rowMinHeight, budget.rowForm === 'inline' ? 'single-line' : 'stacked'],
      ['chip', budget.statusContentWidth, 3 * controls.targets.statusCompact.width + 2 * controls.targets.statusWide.width + 32, budget.filterHeight, controls.targets.statusWide.height, 'single-line'],
      ['footer', contentWidth, contentWidth, budget.footerHeight, Math.max(controls.targets.manage.height, controls.targets.add.height), 'single-line'],
    ]) {
      assert.ok(requiredWidth <= availableWidth && requiredHeight <= availableHeight,
        `${region} ${width}/${scale}: ${requiredWidth}×${requiredHeight} exceeds ${availableWidth}×${availableHeight}`);
      budgets.push({ region, width, fontScale: scale, availableWidth, requiredWidth, availableHeight, requiredHeight, rowForm, measurementKind: 'sdk' });
    }
  }
  const paths = ['entry/src/main/ets/features/source/ui/SourceManagementPage.ets', 'entry/src/main/ets/features/source/presentation/SourceManagementLayout.ts',
    'entry/src/main/ets/ui/controls/ReaderButton.ets', 'entry/src/main/ets/ui/controls/ReaderControlSpecs.ets',
    'entry/src/main/ets/ui/controls/ReaderLabeledIconAction.ets', 'entry/src/main/ets/ui/controls/ReaderLabeledIconActionSpecs.ets',
    'entry/src/main/ets/ui/foundation/ReaderTypography.ets', 'entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts',
    'tools/test-source-management-layout.mjs', 'tools/lib/source-layout-control-probe.mjs', 'tools/lib/reader-labeled-icon-action-probe.mjs',
    'tools/lib/reader-foundation-control-probe.mjs', 'tools/lib/reader-control-builder-probe.mjs', 'tools/lib/bounded-surface-sdk-probe.mjs',
    'tools/lib/selected-production-methods.mjs', 'tools/lib/reader-typography-probe.mjs', 'tools/lib/ets-pure-module-probe.mjs'];
  const report = { schemaVersion: '1.0', pageId: 'source-management', command: { entry: 'tools/test-source-management-layout.mjs', cases: ['matrix'] },
    inputs: paths.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex') })),
    widths, fontScales, results: { E2: 'PASS', E3: 'NOT_RUN' }, targets, budgets };
  if (process.argv.includes('--write-evidence')) writeFileSync(evidenceFile, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ matrix: samples.length, targets: targets.length, budgets: budgets.length, forms: [...new Set(samples.map(s => s.budget.rowForm))], boundary: 'SDK properties and layout inequalities; native text/system scale/pointer dispatch are not proved.' }));
  recordContractCasePass('matrix');
}

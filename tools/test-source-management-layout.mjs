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
  const { labeledIconControls, labeledIconSpecs } = await import('./lib/reader-labeled-icon-action-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { readerReadableFontScale, readerScaledControlHeight } = await import('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts');
  const { resolveSourceManagementLayout } = await import('../entry/src/main/ets/features/source/presentation/SourceManagementLayout.ts');
  const { ReaderPageGeometryInput, resolveReaderPageGeometry } = await import('../entry/src/main/ets/ui/layout/ReaderPageGeometry.ts');
  const { readerStandardPageSpec } = await import('../entry/src/main/ets/ui/layout/ReaderPageShell.ts');
  const { ReaderWindowMetricsSnapshot, ReaderRectVp } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const { readerSourceCategoryLabel } = await import('../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts');
  const file = new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets', import.meta.url);
  const source = readFileSync(file, 'utf8'), widths = [320, 366], fontScales = [1, 1.3, 1.6, 2];
  let scale = 1;
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 320, 844));
  const deps = { ...readerTypographyRoles, ...readerFoundationTokens, ...foundationSpecs(),
    readerReadableFontScale, readerScaledControlHeight, resolveSourceManagementLayout,
    ReaderPageGeometryInput, resolveReaderPageGeometry, readerStandardPageSpec,
    ...labeledIconSpecs(),
    ReaderWindowCoordinator: { metrics: () => metrics } };
  const Page = selectedProductionMethods(file, 'SourceManagementPage', ['fontScale', 'layoutBudget', 'footerControlHeight', 'footerFallbackHeight',
    'footerContentWidth', 'footerStacked', 'footerActionHeight'], deps);
  const targets = [], budgets = [], samples = [];
  function assertFooterWrapper(nodes) {
    const wrappers = nodes.filter(node => node.type === '__Common__' && typeof node.onAreaChange === 'function');
    assert.equal(wrappers.length, 1, 'actual footer has one measured custom-component wrapper');
    assert.equal(wrappers[0].layoutWeight, 1, 'the native Row sibling __Common__ must own its equal allocation');
    const buttons = nodes.filter(node => node.type === 'Button' && node.accessibilityText === '批量管理');
    assert.equal(buttons.length, 1, 'actual footer has one batch NativeButton');
    assert.equal(buttons[0].width, '100%', 'the inner native Button must fill its allocated __Common__');
    const add = nodes.find(node => node.type === 'Button' && node.accessibilityText === '新增书源');
    assert.ok(add); assert.equal(add.width, '100%', 'the add Native carrier fills its own allocated wrapper');
    assert.equal(add.layoutWeight, undefined, 'the add Native carrier must not borrow a second inner equal allocation');
    assert.equal(nodes.filter(node => node.type === '__Common__' && node.layoutWeight === 1).length, 2,
      'both external wrappers own their equal footer allocation');
  }
  for (const width of widths) for (scale of fontScales) {
    metrics.windowRect.width = width; metrics.systemFontScale = scale;
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
    Object.assign(page, { readerWindowMetricsRevision: 1, viewportWidth: width, viewportHeight: 844,
      contentFrame: () => ({ width: contentWidth }), actionBottomInset: () => 16 });
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
      const actor = sdk.consumer(source, ['sourceRow', 'currentSourceRow', 'currentSourceInfo', 'sourceRenderKey', 'projectedSources', 'sourceLeading', 'sourceInfo', 'sourceActions', 'statusFilter', 'categoryFilter', 'bottomActionBar'], {
        ...readerFoundationTokens, ...readerTypographyRoles, readerAppColor, readerSourceCategoryLabel,
        Alignment: { Center: 'center' }, VerticalAlign: { Center: 'center' }, HorizontalAlign: { Start: 'start' },
        TextOverflow: { Ellipsis: 'ellipsis' }, ScrollDirection: { Horizontal: 'horizontal' }, HitTestMode: { Transparent: 'transparent' },
      });
      let actionCount = 0;
      Object.assign(actor, { appThemeScheme: 'day', contentFrame: page.contentFrame, fontScale: () => scale,
        footerStacked: page.footerStacked.bind(page),
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
      footerStacked: page.footerStacked.bind(page),
      layoutBudget: page.layoutBudget.bind(page), statusValue: '全部', categoryValue: 'all', actionBottomInset: () => 16,
      rebuildSourceProjection() {}, onOpenTools() {}, onAddSource() {}, toolsFocusId:()=>'',importFocusId:()=>'' });
    parent.statusFilter(); parent.categoryFilter(); parent.bottomActionBar();
    const parentNodes = shared.nodes(parent);
    assertFooterWrapper(parentNodes);
    const scrolls = parentNodes.filter(n => n.type === 'Scroll');
    assert.equal(scrolls.length, 2);
    assert.ok(scrolls.every(n => n.height === budget.filterHeight && n.scrollable === 'horizontal'), 'both real filter viewports grow with their child controls');
    assert.ok(parentNodes.some(n => n.type === 'Flex' && n.width === contentWidth && n.constraintSize?.minHeight === budget.footerHeight), 'actual footer parent uses the control growth budget');
    assert.equal(controls.targets.manage.width, '100%', 'actual full modifier fills the paid batch slot');
    assert.equal(controls.targets.add.width, '100%', 'add Native carrier fills the actual outer allocation');
    assert.equal(controls.targets.add.layoutWeight, null, 'outer allocation is paid once');
    if (width === 320 && scale === 1) {
      const before = source.replace("        .layoutWeight(this.footerStacked() ? 0 : 1)\n        .onAreaChange((_old: Area, area: Area): void => this.onToolsEntryLayout(identity, 'footer', area));",
        "        .onAreaChange((_old: Area, area: Area): void => this.onToolsEntryLayout(identity, 'footer', area));");
      assert.notEqual(before, source, 'controlled regression removes only the external footer allocation');
      const old = createReaderBuilderProbe(before, ['bottomActionBar'], shared.dependencies, shared.hooks).owner;
      Object.assign(old, { appThemeScheme: 'day', contentFrame: page.contentFrame, layoutBudget: page.layoutBudget.bind(page),
        footerStacked: page.footerStacked.bind(page),
        actionBottomInset: () => 16, toolsFocusId: () => '', importFocusId: () => '' });
      old.bottomActionBar();
      assert.throws(() => assertFooterWrapper(shared.nodes(old)), /native Row sibling/,
        'native-wrapped footer must reject a missing outer allocation even when the inner leaf fills');
      const innerIntrinsic = source.replace("specId: 'source-management-manage', label: '批量管理', layout: 'full'",
        "specId: 'source-management-manage', label: '批量管理', layout: 'equal'");
      assert.notEqual(innerIntrinsic, source, 'controlled regression restores only the old inner equal mode');
      const intrinsic = createReaderBuilderProbe(innerIntrinsic, ['bottomActionBar'], shared.dependencies, shared.hooks).owner;
      Object.assign(intrinsic, { appThemeScheme: 'day', contentFrame: page.contentFrame, layoutBudget: page.layoutBudget.bind(page),
        footerStacked: page.footerStacked.bind(page),
        actionBottomInset: () => 16, toolsFocusId: () => '', importFocusId: () => '' });
      intrinsic.bottomActionBar();
      assert.throws(() => assertFooterWrapper(shared.nodes(intrinsic)), /inner native Button must fill/,
        'equal parent slots cannot hide an intrinsic inner native Button');
    }
    for (const [name, controlRef] of [['detect', 'source-detect'], ['login', 'source-login'], ['statusWide', 'source-filter-chip'], ['manage', 'footer-batch'], ['add', 'footer-add']]) {
      const t = controls.targets[name];
      const targetWidth = typeof t.width === 'number' ? t.width : (contentWidth - readerFoundationTokens.TOK_SPACE_CONTROL_INLINE) / 2;
      targets.push({ controlRef, width, fontScale: scale, visual: { width: targetWidth, height: t.height }, response: null });
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
  const paths = [
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
    'entry/src/main/ets/features/source/presentation/SourceManagementLayout.ts',
    'entry/src/main/ets/features/source/presentation/SourceSwitchPresentation.ets',
    'entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts',
    'entry/src/main/ets/features/source/ui/SourceManagementPage.ets',
    'entry/src/main/ets/ui/controls/ReaderActionAccessibility.ets',
    'entry/src/main/ets/ui/controls/ReaderButton.ets',
    'entry/src/main/ets/ui/controls/ReaderControlSpecs.ets',
    'entry/src/main/ets/ui/controls/ReaderFormField.ets',
    'entry/src/main/ets/ui/controls/ReaderFormRow.ets',
    'entry/src/main/ets/ui/controls/ReaderIconButton.ets',
    'entry/src/main/ets/ui/controls/ReaderLabeledIconAction.ets',
    'entry/src/main/ets/ui/controls/ReaderLabeledIconActionSpecs.ets',
    'entry/src/main/ets/ui/controls/ReaderSectionHeading.ets',
    'entry/src/main/ets/ui/controls/ReaderSegmentedControl.ets',
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
    'entry/src/main/ets/ui/foundation/ReaderSourceChromeVisual.ts',
    'entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts',
    'entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts',
    'entry/src/main/ets/ui/foundation/ReaderTokens.ets',
    'entry/src/main/ets/ui/foundation/ReaderTypography.ets',
    'entry/src/main/ets/ui/foundation/ReaderWidthClass.ts',
    'entry/src/main/ets/ui/foundation/ReaderWindowEnvironment.ts',
    'entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts',
    'entry/src/main/ets/ui/layout/ReaderFloatingBarMetrics.ts',
    'entry/src/main/ets/ui/layout/ReaderPageGeometry.ts',
    'entry/src/main/ets/ui/layout/ReaderPageNativeAttributes.ets',
    'entry/src/main/ets/ui/layout/ReaderPageShell.ts',
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
    'tools/lib/source-layout-control-probe.mjs',
    'tools/lib/source-switch-presentation-probe.mjs',
    'tools/lib/tool-environment.mjs',
    'tools/test-source-management-layout.mjs',
  ];
  const report = { schemaVersion: '1.0', pageId: 'source-management', command: { entry: 'tools/test-source-management-layout.mjs', cases: ['matrix'] },
    inputs: paths.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex') })),
    widths, fontScales, results: { E2: 'PASS', E3: 'NOT_RUN' }, targets, budgets };
  if (process.argv.includes('--write-evidence')) writeFileSync(evidenceFile, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ matrix: samples.length, targets: targets.length, budgets: budgets.length, forms: [...new Set(samples.map(s => s.budget.rowForm))], boundary: 'SDK properties and layout inequalities; native text/system scale/pointer dispatch are not proved.' }));
  recordContractCasePass('matrix');
}

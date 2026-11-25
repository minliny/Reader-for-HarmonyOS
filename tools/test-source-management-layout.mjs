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
const selected = selectContractCases({ matrix: 'Actual v9 source list rows, filters and docks in phone and wide settings panes at 1/1.3/1.6/2; no native glyph, pointer dispatch or business I/O.' }, { argv: process.argv.slice(2).filter(arg => arg !== '--write-evidence' && !arg.startsWith('--evidence-path=')) });
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { foundationControls, foundationSpecs, readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
  const { labeledIconControls, labeledIconSpecs } = await import('./lib/reader-labeled-icon-action-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { sourceV9ChromeControls } = await import('./lib/source-v9-chrome-sdk-probe.mjs');
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { switchSpecs, toggleSource } = await import('./lib/reader-switch-control-probe.mjs');
  const { sourceV9DisplayUrl, sourceV9ReportFill, sourceV9ReportTone } = await import('../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts');
  const { readerReadableFontScale, readerScaledControlHeight } = await import('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts');
  const { resolveSourceManagementLayout, SOURCE_ROW_ICON_WIDTH, SOURCE_STATUS_CHIP_GAP } =
    await import('../entry/src/main/ets/features/source/presentation/SourceManagementLayout.ts');
  const { ReaderPageGeometryInput, resolveReaderPageGeometry } = await import('../entry/src/main/ets/ui/layout/ReaderPageGeometry.ts');
  const { readerStandardPageSpec } = await import('../entry/src/main/ets/ui/layout/ReaderPageShell.ts');
  const { ReaderWindowMetricsSnapshot, ReaderRectVp } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const { readerSourceCategoryLabel } = await import('../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts');
  const file = new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets', import.meta.url);
  const source = readFileSync(file, 'utf8');
  const shapes = [{ width: 320 }, { width: 366 }, { width: 460, originX: 240 }, { width: 700, originX: 256 }];
  const widths = shapes.map(shape => shape.width), fontScales = [1, 1.3, 1.6, 2];
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 320, 844));
  const deps = { ...readerTypographyRoles, ...readerFoundationTokens, ...foundationSpecs(),
    readerReadableFontScale, readerScaledControlHeight, resolveSourceManagementLayout,
    ReaderPageGeometryInput, resolveReaderPageGeometry, readerStandardPageSpec,
    ...labeledIconSpecs(), ReaderWindowCoordinator: { metrics: () => metrics } };
  const Page = selectedProductionMethods(file, 'SourceManagementPage', ['fontScale', 'layoutBudget', 'footerControlHeight', 'footerFallbackHeight',
    'footerContentWidth', 'footerStacked', 'footerManageWidth', 'footerActionHeight'], deps);
  const rowMembers = ['sourceRow', 'sourceRowContent', 'isFirstSource', 'isLastSource', 'currentSourceRow', 'currentSourceInfo',
    'sourceRenderKey', 'projectedSources', 'sourceLeading', 'sourceInfo', 'sourceDomain', 'sourceActions',
    'detectButton', 'loginInk', 'loginSurface', 'loginButton', 'sourceSwitch',
    'sourceBadgeLabel', 'sourceActionLabel', 'verificationRowId', 'verificationRowTextId'];
  const filterMembers = ['statusFilter', 'chip', 'statusCount', 'categoryFilter'];
  const footerMembers = ['bottomActionBar', 'batchAction', 'batchActionInk', 'sourceAddIcon'];
  const targets = [], budgets = [], samples = [];
  for (const { width, originX } of shapes) for (const scale of fontScales) {
    metrics.windowRect.width = width + (originX ?? 0);
    metrics.systemFontScale = scale;
    const page = new Page();
    Object.assign(page, { readerWindowMetricsRevision: 1, viewportWidth: width, viewportHeight: 844,
      originX, embeddedWide: originX !== undefined, actionBottomInset: () => 16 });
    const contentWidth = page.footerContentWidth();
    page.contentFrame = () => ({ width: contentWidth });
    const controls = foundationControls({ windowMetrics: () => metrics });
    const shared = labeledIconControls({ foundation: controls });
    const childHooks = { ...shared.hooks, childSources: { ...shared.hooks.childSources, ReaderToggle: toggleSource } };
    const toggleDeps = { ...controls.dependencies, ...switchSpecs(), readerAppColor };
    const { Component: ReaderToggle } = createReaderBuilderProbe(toggleSource, boundedMembers(toggleSource), toggleDeps, childHooks);
    const chrome = sourceV9ChromeControls({ ...shared.dependencies, ...readerFoundationTokens, ReaderToggle,
      readerAppColor, readerSourceCategoryLabel, sourceV9DisplayUrl, sourceV9ReportFill, sourceV9ReportTone,
      SOURCE_ROW_ICON_WIDTH, SOURCE_STATUS_CHIP_GAP, readerLayoutCarrierResponseRegion: () => ({}) }, childHooks);
    const { Component: Probe } = createReaderBuilderProbe(source, [...rowMembers, ...filterMembers, ...footerMembers],
      chrome.dependencies, chrome.hooks);
    function actor(book) {
      const rendered = new Probe(undefined, {});
      Object.assign(rendered, { appThemeScheme: 'day', verificationOpening: '', contentFrame: page.contentFrame,
        fontScale: page.fontScale.bind(page), footerStacked: page.footerStacked.bind(page),
        layoutBudget: page.layoutBudget.bind(page), footerManageWidth: page.footerManageWidth.bind(page),
        footerActionHeight: page.footerActionHeight.bind(page), footerControlHeight: page.footerControlHeight.bind(page),
        batchMode: page.batchMode, batchSourceIds: page.batchMode ? [book.sourceId] : [], temporaryBackIdentity: 'test-source',
        projectedSources: [book],
        sourceDetectEnabled: () => true, sourceActionEnabled: () => true, sourceToggleBusy: () => false,
        sourceSwitchValue: (_sourceId, value) => value, sourceSwitchName: (_sourceId, name) => name,
        sourceRowCommand: () => () => {}, offlineDetectBadgeId: () => '', verificationRowActionsCurrent: () => false,
        statusCounts: { all: 8, enabled: 4, disabled: 4, abnormal: 2 }, statusValue: '全部', categoryValue: 'all',
        filterTextLayoutOptions: () => undefined, hasReadableSources: true, actionBottomInset: () => 16,
        toolsFocusId: () => '', importFocusId: () => '' });
      return rendered;
    }
    const recordTarget = (controlRef, visualWidth, visualHeight, region) => {
      const response = region === undefined ? null : { width: region.width, height: region.height };
      targets.push({ controlRef, width, fontScale: scale, visual: { width: visualWidth, height: visualHeight }, response });
    };
    const recordBudget = (region, availableWidth, requiredWidth, availableHeight, requiredHeight, rowForm, record = true) => {
      assert.ok(requiredWidth <= availableWidth && requiredHeight <= availableHeight,
        `${region} ${width}/${scale}: ${requiredWidth}×${requiredHeight} exceeds ${availableWidth}×${availableHeight}`);
      if (record) budgets.push({ region, width, fontScale: scale, availableWidth, requiredWidth, availableHeight,
        requiredHeight, rowForm, measurementKind: 'sdk' });
    };
    const base = { sourceId: 'fixture-source-a', enabled: true, name: '示例书源 A', category: 'novel',
      baseUrl: 'https://a.example.test/private', checkState: 'failed', checkMessage: '检测失败原因' };
    for (const batchMode of [false, true]) for (const login of [false, true]) {
      page.batchMode = batchMode;
      const book = { ...base, loginUrl: login ? 'https://a.example.test/login' : undefined };
      const budget = page.layoutBudget(book);
      const rendered = actor(book);
      rendered.sourceRow(book);
      const nodes = shared.nodes(rendered);
      const row = nodes.find(node => node.type === 'Column' && node.constraintSize?.minHeight === budget.rowMinHeight);
      assert.ok(row); assert.equal(row.width, contentWidth); assert.equal(row.height, undefined, 'row can grow from real text measurement');
      const paddedRow = batchMode ? nodes.find(node => node.type === 'Button' && node.accessibilityText === book.name) : row;
      assert.equal(paddedRow.padding, 10);
      assert.equal(row.backgroundColor, readerAppColor('TOK_CARD_BG', 'day'));
      assert.deepEqual(row.borderRadius, { topLeft: 14, topRight: 14, bottomLeft: 14, bottomRight: 14 });
      const leading = nodes.find(node => node.type === 'Stack' && node.width === 34 && node.height === 34);
      assert.ok(leading, 'the SDK stamp/selection carrier pays the fixed 34vp lane');
      const title = nodes.find(node => node.type === 'Text' && node.create === book.name);
      const domain = nodes.find(node => node.type === 'Text' && node.create === 'https://a.example.test');
      for (const line of [title, domain]) {
        assert.equal(line.maxFontScale, scale); assert.equal(line.maxLines, 1);
      }
      assert.ok(!nodes.some(node => node.type === 'Text' && node.create === book.checkMessage));
      const detections = nodes.filter(node => node.type === 'Button' && node.width === 28 && node.height === 28);
      const logins = nodes.filter(node => node.type === 'Button' && node.width === 58 && node.height === 26);
      const switches = nodes.filter(node => node.type === 'Toggle' && node.width === 44 && node.height === 26);
      const actionWidths = [...logins, ...detections, ...switches].map(node => node.width);
      const roundCheck = nodes.find(node => node.type === 'Stack' && node.width === 20 && node.height === 20);
      assert.equal(Boolean(roundCheck), batchMode);
      if (roundCheck) assert.equal(roundCheck.backgroundColor, readerAppColor('app.sourceUi.primary', 'day'));
      assert.equal(detections.length, batchMode ? 0 : 1);
      assert.equal(logins.length, batchMode || !login ? 0 : 1);
      assert.equal(switches.length, batchMode ? 0 : 1);
      if (!batchMode) {
        const actionsLane = nodes.find(node => node.type === 'Row' && node.width === budget.trailingWidth);
        assert.equal(actionsLane.constraintSize.minHeight, 44);
        assert.equal(actionsLane.width, actionWidths.reduce((sum, size) => sum + size, 0) +
          (actionWidths.length - 1) * actionsLane.create.space, 'unbroken v9 action widths and measured Row gaps are budgeted once');
        assert.equal(budget.actionRowCount, 1);
        const detectRegion = detections[0].responseRegion;
        assert.deepEqual(detectRegion, { x: -6, y: -8, width: 40, height: 44 },
          'the v9 Detect response region has the exact bounded envelope');
        assert.ok(detectRegion.x >= -actionsLane.create.space &&
          detectRegion.x + detectRegion.width <= detections[0].width + actionsLane.create.space,
        'expanded Detect hit area stays out of the adjacent controls');
        if (login) {
          assert.deepEqual(logins[0].responseRegion, { x: 0, y: -9, width: 58, height: 44 });
          const loginMark = nodes.find(node => node.type === 'Stack' && node.width === 13 && node.height === 13);
          assert.equal(loginMark.border.width, 1);
          assert.ok(nodes.some(node => node.type === 'Image' && node.width === 9 && node.height === 9));
        }
      } else {
        assert.equal(budget.trailingWidth, Math.ceil(35 * scale));
        assert.deepEqual([budget.actionsHeight, budget.actionRowCount], [34, 1]);
        assert.ok(nodes.some(node => node.type === 'Text' && node.create === '已启用' && node.maxLines === 1));
      }
      const gap = readerFoundationTokens.TOK_SPACE_XS;
      const rowWidth = budget.rowForm === 'inline' ? leading.width + gap + budget.textMinWidth + gap +
        budget.trailingWidth : Math.max(budget.trailingWidth, leading.width,
        budget.textMinWidth + (budget.rowForm === 'stacked-actions' ? leading.width + gap : 0));
      const infoHeight = (title.lineHeight + domain.lineHeight) * scale + 3;
      const contentHeight = budget.rowForm === 'stacked-leading' ? leading.height + gap + infoHeight :
        Math.max(leading.height, infoHeight);
      const rowHeight = budget.rowForm === 'inline' ? Math.max(contentHeight, budget.actionsHeight) :
        contentHeight + gap + budget.actionsHeight;
      recordBudget('row', contentWidth, rowWidth + paddedRow.padding * 2 + 2, budget.rowMinHeight,
        rowHeight + paddedRow.padding * 2 + 2,
        budget.rowForm === 'inline' ? 'single-line' : 'stacked', !batchMode && login);
      if (!batchMode && login) {
        for (const [ref, button] of [['source-detect', detections[0]], ['source-login', logins[0]]]) {
          recordTarget(ref, button.width, button.height, button.responseRegion);
        }
      }
      samples.push({ width, scale, batchMode, login, budget });
    }
    const batch = actor(base);
    batch.bottomActionBar();
    const batchNodes = shared.nodes(batch);
    const dock = batchNodes.find(node => node.type === 'Row' && node.width === contentWidth);
    assert.equal(dock.height, page.footerActionHeight());
    const dockActions = batchNodes.filter(node => node.type === 'Button');
    assert.deepEqual(dockActions.map(node => node.accessibilityText), ['启用', '停用', '移至分组', '检测', '删除']);
    assert.ok(dockActions.every(node => node.layoutWeight === 1 && node.height === '100%'));
    assert.equal(batchNodes.filter(node => node.type === 'Image' && node.width === 16 && node.height === 16).length, 5);
    page.batchMode = false;
    const before = page.contentFrame;
    page.contentFrame = () => assert.fail('footer fallback must not recurse into pageGeometry');
    const stacked = page.footerStacked();
    const height = page.footerControlHeight() * (stacked ? 2 : 1) +
      (stacked ? readerFoundationTokens.TOK_SPACE_CONTROL_INLINE : 0);
    assert.equal(page.footerFallbackHeight(), height + readerFoundationTokens.TOK_SPACE_SM + 16);
    page.contentFrame = before;
    const parent = actor(base);
    parent.statusFilter(); parent.categoryFilter(); parent.bottomActionBar();
    const parentNodes = shared.nodes(parent);
    const status = parentNodes.find(node => node.id === 'reader-source-status-filter');
    const category = parentNodes.find(node => node.id === 'reader-source-category-filter');
    const statusButtons = parentNodes.filter(node => /^reader-source-status-/.test(node.id ?? '') && node.type === 'Button');
    const categoryButtons = parentNodes.filter(node => /^source-category-/.test(node.id ?? '') && node.type === 'Button');
    assert.equal(status.width, contentWidth); assert.equal(category.width, contentWidth);
    assert.equal(status.create.space, SOURCE_STATUS_CHIP_GAP);
    assert.equal(statusButtons.length, 4); assert.ok(statusButtons.every(node => node.layoutWeight === 1));
    assert.equal(statusButtons.find(node => node.id === 'reader-source-status-all').backgroundColor,
      readerAppColor('app.sourceUi.primary', 'day'));
    assert.notEqual(readerAppColor('app.sourceUi.primary', 'day'), sourceV9ReportFill('content', 'day'));
    assert.ok(statusButtons.filter(node => node.id !== 'reader-source-status-all')
      .every(node => node.backgroundColor === readerAppColor('TOK_CARD_BG', 'day')));
    assert.equal(parentNodes.find(node => node.type === 'Text' && node.create === '全部 8').fontColor,
      readerAppColor('app.sourceUi.onPrimary', 'day'));
    assert.equal(categoryButtons.length, 3); assert.ok(categoryButtons.every(node => node.layoutWeight === 1));
    const statusHeight = statusButtons[0].height;
    assert.ok(statusButtons.every(node => node.height === statusHeight));
    assert.equal(statusHeight, category.height);
    const chipWidth = (status.width - SOURCE_STATUS_CHIP_GAP * 3) / 4;
    recordTarget('source-filter-chip', chipWidth, statusHeight);
    recordBudget('chip', status.width, chipWidth * 4 + SOURCE_STATUS_CHIP_GAP * 3, statusHeight, statusHeight, 'single-line');
    const footer = parentNodes.find(node => node.type === 'Flex' && node.width === contentWidth);
    const parentSlots = parentNodes.filter(node => node.type === '__Common__');
    const manageSlot = parentSlots.find(node => typeof node.onAreaChange === 'function');
    const addSlot = parentSlots.find(node => node !== manageSlot);
    assert.ok(footer && manageSlot && addSlot, 'SDK Flex owns two custom-button wrappers');
    assert.equal(manageSlot.height, page.footerControlHeight());
    assert.equal(addSlot.height, manageSlot.height, 'both ordinary dock slots have the same authored height');
    if (stacked) {
      assert.equal(manageSlot.width, '100%'); assert.equal(addSlot.width, '100%');
    } else {
      assert.ok(manageSlot.width >= 112); assert.equal(addSlot.layoutWeight, 1, 'the import wrapper fills the remaining lane');
      if (scale === 1) assert.equal(manageSlot.width, 112);
    }
    for (const [label, ref, targetWidth] of [
      ['批量管理', 'footer-batch', stacked ? contentWidth : manageSlot.width],
      ['导入书源', 'footer-add', stacked ? contentWidth : contentWidth - manageSlot.width - readerFoundationTokens.TOK_SPACE_CONTROL_INLINE],
    ]) {
      const button = parentNodes.find(node => node.type === 'Button' && node.accessibilityText === label);
      assert.ok(button, `actual NativeButton for ${label}`);
      assert.equal(button.width, '100%', 'the native control fills its assigned wrapper');
      assert.equal(button.layoutWeight, undefined, 'only the outer wrapper distributes free space');
      assert.ok(targetWidth > 0);
      recordTarget(ref, targetWidth, page.footerControlHeight());
    }
    assert.equal(footer.constraintSize.minHeight, Math.max(48, height));
    recordBudget('footer', contentWidth, contentWidth, footer.constraintSize.minHeight, height, stacked ? 'stacked' : 'single-line');
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
    'entry/src/main/ets/features/source/presentation/SourceManagementV9.ts',
    'entry/src/main/ets/features/source/presentation/SourceSwitchPresentation.ets',
    'entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts',
    'entry/src/main/ets/features/source/ui/SourceManagementPage.ets',
    'entry/src/main/ets/features/source/ui/SourceV9Chrome.ets',
    'entry/src/main/ets/platform/network/HttpTransportPolicy.ts',
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
    'tools/lib/source-switch-presentation-probe.mjs',
    'tools/lib/source-v9-chrome-sdk-probe.mjs',
    'tools/lib/tool-environment.mjs',
    'tools/test-source-management-layout.mjs',
  ];
  const authoredTargetMinimum = targets.every(target => {
    const region = target.response ?? target.visual;
    return region.width >= 44 && region.height >= 44;
  });
  const report = { schemaVersion: '1.0', pageId: 'source-management', command: { entry: 'tools/test-source-management-layout.mjs', cases: ['matrix'] },
    inputs: paths.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex') })),
    widths, fontScales, results: { E2: authoredTargetMinimum ? 'PASS' : 'FAIL', E3: 'NOT_RUN' }, targets, budgets };
  if (process.argv.includes('--write-evidence')) writeFileSync(evidenceFile, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ matrix: samples.length, targets: targets.length, budgets: budgets.length,
    forms: [...new Set(samples.map(s => s.budget.rowForm))], authoredTargetMinimum,
    boundary: 'SDK properties and layout inequalities; native text/system scale/pointer dispatch are not proved.' }));
  recordContractCasePass('matrix');
}

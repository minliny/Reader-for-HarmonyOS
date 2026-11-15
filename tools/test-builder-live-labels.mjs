import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const args = process.argv.slice(2);
const output = args.find(arg => arg.startsWith('--evidence-path='))?.slice('--evidence-path='.length);
if (output) assert.ok(output.startsWith('.reader-artifacts/') && !output.includes('..'));
const selected = selectContractCases({
  'shelf-selection': 'Actual inline and stacked multi-select headers update visible and native accessible select-all labels, current selection and disabled admission.',
  'tools-counts': 'Actual SourceTools diagnostics card updates four counters and theme colors on its retained native Text nodes.',
  'reader-theme-icons': 'Actual Manga back and Replace toolbar Builders deliver live theme resources to retained native/shared image actors.',
  'rss-theme-icons': 'Actual RSS entry/feed/management action bars and empty-state card update their retained image resources with app theme.',
  'group-editor-labels': 'Actual retained group editor heading and save label consume the current selected group and draft.',
  'import-summary': 'Actual import result header consumes changing accepted and recovery-pending batch facts.',
  'search-source-reason': 'Actual Search source-required state updates title/action and dispatch after source availability changes.',
  'group-row-values': 'Actual retained group row and assignment picker consume current same-ID group facts and names.',
  'shelf-metadata': 'Actual shelf-list and text/manga detail metadata tags consume current book Props.',
  'manga-dock-icons': 'Actual manga dock delivers current theme resources to its three retained footer images.',
  'replace-recovery-label': 'Actual same-operation replacement recovery action updates its retained caption and keeps operation identity.',
  'sync-summary-values': 'Actual retained Sync summary rows consume current loaded configuration facts.',
}, { argv: args.filter(arg => !arg.startsWith('--evidence-path=')) });

if (selected.length) {
  const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
  const { iconButtonControls } = await import('./lib/reader-icon-button-probe.mjs');
  const { labeledIconControls } = await import('./lib/reader-labeled-icon-action-probe.mjs');
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { localBookDetailSdk } = await import('./lib/local-book-detail-sdk-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { sourceSwitchTriggerFocusId } = await import('../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts');
  const { ShelfBookPresentation } = await import('../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { ts, options } = installedEtsCompiler();
  const { sampleReaderControlReplace } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlReplaceGeometry.ts');
  const targetConstants = selectedProductionValues(new URL('../entry/src/main/ets/ui/controls/ReaderActionAccessibility.ets', import.meta.url), ['READER_ACTION_MIN_TARGET']);
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const root = new URL('../', import.meta.url);
  const sourceOverrides = new Map();
  const read = path => sourceOverrides.get(path) ?? readFileSync(new URL(path, root), 'utf8');
  const shelfPath = 'entry/src/main/ets/features/bookshelf/ui/BookshelfMultiSelectPage.ets';
  const toolsPath = 'entry/src/main/ets/features/source/ui/SourceToolsPage.ets';
  const mangaPath = 'entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets';
  const replacePath = 'entry/src/main/ets/features/reading/ui/ReaderControlReplaceContent.ets';
  const groupPath = 'entry/src/main/ets/features/bookshelf/ui/BookshelfManagementPage.ets';
  const importPath = 'entry/src/main/ets/features/bookshelf/ui/LocalImportDialog.ets';
  const searchPath = 'entry/src/main/ets/features/search/ui/SearchPage.ets';
  const detailPath = 'entry/src/main/ets/features/reading/ui/LocalBookDetail.ets';
  const listPath = 'entry/src/main/ets/features/bookshelf/ui/ShelfBookListDetails.ets';
  const syncPath = 'entry/src/main/ets/features/sync/ui/SyncPage.ets';
  const rssPath = name => `entry/src/main/ets/features/rss/ui/${name}.ets`;
  const results = {};

  function selectionScenario(source = read(shelfPath)) {
    for (const inline of [true, false]) {
      const controls = foundationControls();
      const methods = ['selectedKeys', 'busy', 'ready', 'selectionTopBar', 'selectionHeading', 'selectionAction',
        'toggleAll', 'allSelected', 'selectionInputEnabled', 'hasBookKey', 'bookKey'];
      const owner = createReaderBuilderProbe(source, methods, { ...controls.dependencies, ...targetConstants }, controls.hooks).owner;
      const books = [{ sourceId: 'local', bookId: 'a' }, { sourceId: 'local', bookId: 'b' }];
      Object.assign(owner, { mounted: true, visibleBooks: () => books,
        canRetainSelectedKey: () => false, selectionHeaderInline: () => inline, onCancel() {} });
      owner.selectionTopBar();
      const button = controls.nodes(owner).find(node => node.type === 'Button' && node.accessibilityText === '全选');
      assert.ok(button);
      const initialButtons = controls.nodes(owner).filter(node => node.type === 'Button');
      button.onClick(); controls.properties.flush();
      assert.deepEqual([...owner.selectedKeys], ['local\u0000a', 'local\u0000b']);
      assert.equal(button.accessibilityText, '取消全选', 'retained selection native name reflects the accepted all-selected state');
      assert.ok(controls.nodes(owner).some(node => node.type === 'Text' && node.create === '取消全选'));
      button.onClick(); controls.properties.flush();
      assert.deepEqual([...owner.selectedKeys], []);
      assert.equal(button.accessibilityText, '全选');
      owner.updateStateVars({ busy: true, ready: true }); controls.properties.flush();
      assert.equal(button.enabled, false); button.onClick(); assert.deepEqual([...owner.selectedKeys], []);
      assert.deepEqual(controls.nodes(owner).filter(node => node.type === 'Button'), initialButtons);
    }
    return { layouts: 2, acceptedSelectionChanges: 4, nativeNames: true };
  }

  function countsScenario(source = read(toolsPath)) {
    const controls = foundationControls();
    const snapshot = { batchCheck: { phase: 'running', total: 12, completed: 0, passed: 0, failed: 0, errors: 0,
      currentSourceName: '', currentIndex: 0, results: [] } };
    const owner = createReaderBuilderProbe(source, ['snapshot', 'appThemeScheme', 'batchCheckCard', 'batchCounter',
      'batchCheckPercent', 'batchCheckPhaseLabel'], { ...controls.dependencies, EMPTY_SOURCE_TOOLS_SNAPSHOT: snapshot }, controls.hooks).owner;
    owner.syncListDataSources = () => {}; owner.showTransientFeedback = () => {};
    owner.snapshot = snapshot; owner.batchCheckCard();
    const counters = controls.nodes(owner).filter(node => node.type === 'Text' &&
      /^(所选项通过|所选项未通过|检测错误|剩余) /.test(node.create));
    assert.equal(counters.length, 4);
    owner.updateStateVars({ snapshot: { batchCheck: { ...snapshot.batchCheck, completed: 8, passed: 4, failed: 3, errors: 1 } } });
    controls.properties.flush();
    assert.deepEqual(counters.map(node => node.create), ['所选项通过 4', '所选项未通过 3', '检测错误 1', '剩余 4'],
      'retained diagnostics counters consume the current batch progress');
    owner.appThemeScheme = 'night'; controls.properties.flush();
    const roles = ['TOK_PRIMARY_DARK', 'app.status.checkError', 'app.status.checkWarning', 'TOK_MUTED'];
    assert.deepEqual(counters.map(node => node.fontColor), roles.map(role => readerAppColor(role, 'night')),
      'retained counter text consumes current theme colors');
    return { counters: 4, currentProgress: true, currentTheme: true };
  }

  function themeScenario(mangaSource = read(mangaPath), replaceSource = read(replacePath)) {
    const icons = iconButtonControls();
    const manga = icons.consumer(mangaSource, ['backgroundPreference', 'mangaTopBarBack', 'iconAction']);
    manga.onWindowChromeChanged = () => {};
    manga.handleBack = async () => {};
    manga.mangaTopBarBack();
    const child = icons.walk(manga).find(actor => actor instanceof icons.icon.Component);
    assert.ok(child);
    manga.backgroundPreference = 'ink'; icons.properties.flush();
    assert.match(String(child.icon), /book_detail_back_theme_night/, 'retained manga icon consumes the current reading background');
    assert.match(String(icons.nodes(child).find(node => node.type === 'Image').create), /book_detail_back_theme_night/);
    const controls = foundationControls();
    const replace = createReaderBuilderProbe(replaceSource, ['appThemeScheme', 'ruleToolbar', 'toolbarButton',
      'toolbarButtonWidth', 'toolbarButtonX', 'ruleRow', 'ruleIcon'], controls.dependencies, controls.hooks).owner;
    Object.assign(replace, { state: { sessionKey: 'current-book' }, layer: '', frame: () => sampleReaderControlReplace(1, 320, 600),
      presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), fullInput: () => true, readyInput: () => true,
      openEditor() {}, openImport() {}, perform() {}, onExport() {}, askDelete() {},
      scopeSummary: () => '正文', rowClip: () => undefined, quickInput: () => false });
    replace.ruleToolbar();
    const images = controls.nodes(replace).filter(node => node.type === 'Image');
    assert.equal(images.length, 3);
    replace.ruleRow(() => ({ id: 7, name: '当前规则', isEnabled: true, pattern: '原文', replacement: '替换' }), () => 0);
    const rowImages = controls.nodes(replace).filter(node => node.type === 'Image').slice(3);
    assert.equal(rowImages.length, 2);
    replace.appThemeScheme = 'night'; controls.properties.flush();
    assert.ok(images.every(node => String(node.create).includes('_theme_night')),
      'retained replacement toolbar icons consume the current app theme');
    assert.ok(rowImages.every(node => String(node.create).includes('_theme_night')),
      'retained replacement row icons consume the current app theme');
    return { mangaSharedIcon: 1, replacementToolbarImages: 3, replacementRowImages: 2, sameActors: true };
  }

  function rssThemeScenario() {
    const definitions = [
      ['RssEntryDetailPage', 'entryActions', 1],
      ['RssSourceFeedPage', 'sourceActions', 2],
      ['RssSubscriptionManagementPage', 'actionBar', 4],
    ];
    for (const [name, method, count] of definitions) {
      const controls = labeledIconControls();
      const owner = createReaderBuilderProbe(read(rssPath(name)), ['appThemeScheme', method, 'actionTarget'],
        controls.dependencies, controls.hooks).owner;
      Object.assign(owner, { onSourceSettings() {}, onRefresh() {}, onEditSource() {}, onViewArticles() {},
        onDelete() {}, canRefresh: () => true });
      if (name === 'RssSubscriptionManagementPage') owner[method](() => 'subscription-current');
      else owner[method]('subscription-current');
      const images = controls.nodes(owner).filter(node => node.type === 'Image');
      assert.equal(images.length, count);
      owner.appThemeScheme = 'night'; controls.properties.flush();
      const themed = name === 'RssSubscriptionManagementPage' ? images.slice(0, 3) : images;
      assert.ok(themed.every(node => String(node.create).includes('_theme_night')),
        `${name} retained action images consume current theme`);
    }
    const controls = foundationControls();
    const owner = createReaderBuilderProbe(read(rssPath('RssPage')), ['appThemeScheme', 'emptyUnreadSection', 'stateCard', 'stateButtons'],
      controls.dependencies, controls.hooks).owner;
    Object.assign(owner, { recentUnreadHeader() {}, contentFrame: () => ({ width: 320 }), onModeRequested() {}, onManage() {} });
    owner.emptyUnreadSection();
    const image = controls.nodes(owner).find(node => node.type === 'Image');
    owner.appThemeScheme = 'night'; controls.properties.flush();
    assert.match(String(image.create), /rss_empty_theme_night/, 'RSS retained empty-state icon consumes current theme');
    return { actionImages: 7, themeSpecificActionImages: 6, emptyStateImage: 1 };
  }

  function groupEditorScenario() {
    const controls = foundationControls();
    const initial = { selectedGroupId: 0, groupNameDraft: '', groupOrderDraft: '0', busy: false };
    const owner = createReaderBuilderProbe(read(groupPath), ['snapshot', 'groupEditorCard', 'heading', 'actionButton'],
      { ...controls.dependencies, EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT: initial }, controls.hooks).owner;
    owner.onGroupNameChanged = () => {};
    owner.onGroupOrderChanged = () => {};
    owner.onSaveGroup = () => {};
    owner.onClearGroupEditor = () => {};
    owner.groupEditorCard();
    owner.updateStateVars({ snapshot: { ...initial, selectedGroupId: 7, groupNameDraft: '当前分组' } });
    controls.properties.flush();
    assert.ok(controls.nodes(owner).some(node => node.type === 'Text' && node.create === '编辑分组'),
      'retained group heading consumes current selection');
    assert.ok(controls.nodes(owner).some(node => node.type === 'Button' && node.accessibilityText === '保存'),
      'retained group save label consumes current selection');
    assert.ok(controls.nodes(owner).some(node => node.type === 'TextInput' && node.create.text === '当前分组'));
    return { currentHeading: true, currentSaveLabel: true, currentDraft: true };
  }

  function importSummaryScenario() {
    const controls = foundationControls();
    const owner = createReaderBuilderProbe(read(importPath), ['batch', 'resultHeader', 'importHeader',
      'summaryTitle', 'resultItems', 'allSucceeded'], controls.dependencies, controls.hooks).owner;
    // Batch animation and native measurement are separate owners. The exact
    // summary methods and header observers consume the actual current Prop.
    owner.onPresentationChanged = () => {};
    owner.updateStateVars({ batch: { imported: 0, items: [{ fileName: 'a.txt', state: 'failed' }] } });
    owner.resultHeader();
    const title = controls.nodes(owner).find(node => node.type === 'Text' && node.create === '导入未完成');
    assert.ok(title);
    owner.updateStateVars({ batch: { imported: 1, items: [{ fileName: 'a.txt', state: 'success' }] } });
    controls.properties.flush();
    assert.equal(title.create, '导入完成', 'retained import result heading consumes the current batch');
    owner.updateStateVars({ batch: { imported: 1, items: [{ fileName: 'a.txt', state: 'success' },
      { fileName: 'b.txt', state: 'failed', failure: { code: 'recoveryPending' } }] } });
    controls.properties.flush(); assert.equal(title.create, '部分结果待确认');
    return { acceptedBatchUpdates: 2, retainedTitle: true };
  }

  function searchReasonScenario() {
    const controls = foundationControls();
    const feedback = boundedSurfaceSdk({ properties: controls.properties });
    const hooks = { ...controls.hooks, ...feedback.hooks,
      childSources: { ...controls.hooks.childSources, ...feedback.childSources } };
    const owner = createReaderBuilderProbe(read(searchPath), ['presentation', 'stateContent', 'sourceRequiredContent',
      'sourceRequiredReason', 'sourceRecoveryActions', 'primaryPill', 'secondaryPill'],
      { ...controls.dependencies, ...feedback.deps }, hooks).owner;
    const calls = [];
    Object.assign(owner, { hasSearchSession: () => false, searchResultWidth: () => 320, searchContentStartInset: () => 0,
      ownsPageQuery: () => true, sourceRecoveryVisible: () => true, searchStateIllustration() {},
      onManageSources: () => calls.push('manage'), onBack: () => calls.push('back') });
    owner.presentation = { kind: 'sourceRequired', reason: 'noSources' };
    owner.stateContent();
    owner.presentation = { kind: 'sourceRequired', reason: 'allDisabled' };
    controls.properties.flush();
    const nodes = feedback.nodes(owner);
    assert.ok(nodes.some(node => node.type === 'Text' && node.create === '没有可搜索书籍的书源'),
      'current source-required reason reaches the retained state title');
    const action = nodes.findLast(node => node.type === 'Button' && node.accessibilityText === '管理书源');
    assert.ok(action, 'current source-required action name'); action.onClick(); assert.deepEqual(calls, ['manage']);
    return { reasonChange: true, currentAction: true };
  }

  function groupRowsScenario(source = read(groupPath)) {
    const controls = foundationControls();
    const group = { groupId: 7, groupName: '旧组', show: true, order: 0 };
    const initial = { selectedGroupId: 0, assignmentGroupDraft: '', busy: false, data: { groups: [group], books: [] } };
    const owner = createReaderBuilderProbe(source, ['snapshot', 'groupRow', 'smallAction', 'assignmentCard', 'heading',
      ...(source.includes('private currentGroup(') ? ['currentGroup'] : [])], { ...controls.dependencies, ScrollDirection: { Horizontal: 'ScrollDirection.Horizontal' }, Repeat: () => ({ each() { return this; }, key() { return this; }, virtualScroll() { return this; }, render() {} }), EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT: initial }, controls.hooks).owner;
    const calls = [];
    Object.assign(owner, { onSelectGroup() {}, onToggleGroupShown() {}, onDeleteGroup() {}, onAssignBook() {},
      onAssignmentGroupChanged: value => calls.push(value), managementTextRowHeight: () => 60, isSelectedBook: () => false });
    assert.equal(initial.data.books.length, 0, 'unrelated Repeat book list is empty in this group-only fixture');
    owner.actionButton = () => {};
    owner.groupRow(group); owner.assignmentCard();
    owner.updateStateVars({ snapshot: { ...initial, data: { groups: [{ ...group, groupName: '当前组', show: false }], books: [] } } });
    controls.properties.flush();
    assert.ok(controls.nodes(owner).some(node => node.type === 'Text' && node.create === '当前组'), 'retained group row reads current same-ID name');
    assert.ok(controls.nodes(owner).some(node => node.type === 'Button' && node.accessibilityText === '显示'), 'current shown-state action');
    const picker = controls.nodes(owner).findLast(node => node.type === 'Button' && node.accessibilityText === '当前组');
    assert.ok(picker, 'retained group assignment picker reads current name'); picker.onClick();
    assert.deepEqual(calls, ['当前组']);
    return { sameIdName: true, shownAction: true, currentAssignmentName: true };
  }

  function metadataScenario() {
    const controls = foundationControls();
    const path = 'entry/src/main/ets/features/bookshelf/ui/ShelfBookListDetails.ets';
    const fragment = read(path).replace('  build() {', '  build() { Column() {} }\n  @Builder\n  details() {');
    const book = { sourceId: 'local', bookId: 'a', contentKind: 'text', title: '书名', author: '作者', readProgress: 0 };
    const owner = createReaderBuilderProbe(fragment, ['book', 'details', 'metadataTag', 'positionLabel'],
      { ...controls.dependencies, ShelfBookPresentation }, controls.hooks).owner;
    Object.assign(owner, { mangaRevision: 0, textFrame: { width: 300, height: 134, titleGroupHeight: 28,
      readingGroupHeight: 20, metadataColumns: 2, metadataWidth: 90, metadataHeight: 20, tagHeight: 18, scale: 1 } });
    owner.book = book; owner.details();
    owner.updateStateVars({ book: { ...book, contentKind: 'audio', sourceId: 'remote' } }); controls.properties.flush();
    const labels = controls.nodes(owner).filter(node => node.type === 'Text').map(node => node.create);
    assert.ok(labels.includes('有声') && labels.includes('在线'), 'retained shelf metadata consumes current book facts');
    const { ReaderNativeSlotMeasurement } = pureModuleProbe(read('entry/src/main/ets/ui/layout/ReaderNativeSlotMeasurement.ets'),
      'ReaderNativeSlotMeasurement.ets', { FrameCallback: class {}, readerMeasureSurfaceRect() { throw Error('metadata fixture never measures native slots'); } }, ['ReaderNativeSlotMeasurement']);
    for (const kind of ['text', 'manga']) {
      const actual = localBookDetailSdk({ ReaderNativeSlotMeasurement, sourceSwitchTriggerFocusId }, { source: read(detailPath) });
      const detail = actual.owner;
      detail.book = { ...book, contentKind: kind, coverUrl: 'https://example.test/cover', sourceName: '本地' };
      detail.hasCover = () => true;
      detail.displayCoverUrl = () => 'https://example.test/cover';
      detail.mangaFontScale = () => 1;
      detail.mangaSummaryLabel = () => '两章';
      detail.onBookChanged = () => {};
      detail[kind === 'text' ? 'standardHero' : 'mangaHero']();
      detail.updateStateVars({ book: { ...detail.book, sourceId: 'remote', contentKind: kind === 'text' ? 'audio' : 'manga' } });
      actual.properties.flush();
      const text = [...detail.nodes.values()].filter(node => node.type === 'Text').map(node => node.create);
      assert.ok(text.includes('在线'), `retained ${kind} detail origin consumes current Prop`);
      if (kind === 'text') assert.ok(text.includes('有声'));
    }
    return { shelfTags: 2, textDetailTags: 2, mangaDetailOrigin: 1 };
  }

  function dockScenario() {
    const controls = foundationControls();
    const owner = createReaderBuilderProbe(read(mangaPath), ['backgroundPreference', 'bottomControls', 'footerAction'],
      controls.dependencies, controls.hooks).owner;
    Object.assign(owner, { opened: true, horizontalPageCount: 10, viewportWidth: 320,
      pageOrdinal: () => 2, mutedColor: () => '#888888', greenColor: () => '#008800', inkColor: () => '#222222',
      lineColor: () => '#dddddd', chromeScheme: () => owner.backgroundPreference === 'ink' ? 'night' : 'day',
      controlFontScale: () => 1, dockPageRowHeight: () => 63, dockActionHeight: () => 58,
      interactiveInsets: () => ({ left: 0, right: 0 }), readerPanelForeground: () => true,
      panelTriggerFocusId: panel => panel, stepPage() {}, seekPage() {}, openPanel() {} });
    owner.bottomControls();
    const images = controls.nodes(owner).filter(node => node.type === 'Image');
    assert.equal(images.length, 3);
    owner.backgroundPreference = 'ink'; controls.properties.flush();
    assert.ok(images.every(node => String(node.create).includes('_theme_night')), 'retained manga dock icons consume current background');
    return { retainedDockImages: 3 };
  }

  function recoveryLabelScenario() {
    const controls = foundationControls();
    const state = { sessionKey: 'book-current', writeOperationId: 'operation-current', recoveryLabel: '核对规则操作', mutationPending: false };
    const owner = createReaderBuilderProbe(read(replacePath), ['state', 'originalRecoveryAction', 'textAction'],
      { ...controls.dependencies, createReaderControlReplaceState: () => state }, controls.hooks).owner;
    const calls = [];
    Object.assign(owner, { onMinimumContentChanged() {}, lastSessionKey: state.sessionKey, sourceScrollResetPending: false,
      fullInput: () => true, quickInput: () => false, localPending: false, frame: () => ({ actionHeight: 44 }),
      reload: operation => calls.push(operation) });
    owner.originalRecoveryAction();
    const title = controls.nodes(owner).find(node => node.type === 'Text' && node.create === '核对规则操作');
    owner.updateStateVars({ state: { ...state, recoveryLabel: '读取已确认规则' } }); controls.properties.flush();
    assert.equal(title.create, '读取已确认规则', 'retained same-operation recovery caption consumes current receipt');
    controls.nodes(owner).find(node => node.type === 'Button' && node.onClick).onClick();
    assert.deepEqual(calls, ['operation-current']);
    return { currentCaption: true, originalOperationRetained: true };
  }

  function syncSummaryScenario() {
    const controls = foundationControls();
    const state = { saveLocation: 'WebDAV', backupFrequency: '手动' };
    const owner = createReaderBuilderProbe(read('entry/src/main/ets/features/sync/ui/SyncPage.ets'),
      ['snapshot', 'autoBackupSection', 'gatedRow', 'sectionHeadingMuted'],
      { ...controls.dependencies, DEFAULT_SYNC_SNAPSHOT: state }, controls.hooks).owner;
    Object.assign(owner, { onSnapshotChanged() {}, syncSnapshotInputs() {}, contentFrame: () => ({ width: 320 }), scopeRow() {} });
    owner.autoBackupSection();
    owner.updateStateVars({ snapshot: { saveLocation: '当前位置', backupFrequency: '当前频率' } }); controls.properties.flush();
    const text = controls.nodes(owner).filter(node => node.type === 'Text').map(node => node.create);
    assert.ok(text.includes('当前位置') && text.includes('当前频率'), 'retained Sync summary values consume current config');
    return { currentSummaryRows: 2 };
  }

  // Restore the historical primitive parameter at its actual declaration,
  // parent calls and child reads. The normal entry must then fail a current
  // property/behavior assertion, after successful SDK parsing and mounting.
  function captureParameter(source, method, parameter) {
    const tree = ts.createSourceFile('CurrentBuilder.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, []);
    const methods = tree.statements.flatMap(node => [...(node.members ?? [])])
      .filter(node => node.name?.getText(tree) === method);
    assert.equal(methods.length, 1);
    const member = methods[0], index = member.parameters.findIndex(node => node.name.getText(tree) === parameter);
    assert.ok(index >= 0);
    const declaration = member.parameters[index];
    assert.ok(ts.isFunctionTypeNode(declaration.type));
    const edits = [{ start: declaration.type.getStart(tree), end: declaration.type.end, text: declaration.type.type.getText(tree) }];
    const reads = node => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === parameter) {
        assert.equal(node.arguments.length, 0);
        edits.push({ start: node.getStart(tree), end: node.end, text: parameter });
      }
      ts.forEachChild(node, reads);
    };
    reads(member.body);
    const calls = node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.kind === ts.SyntaxKind.ThisKeyword && node.expression.name.text === method) {
        const argument = node.arguments[index];
        assert.ok(ts.isArrowFunction(argument) && !ts.isBlock(argument.body));
        edits.push({ start: argument.getStart(tree), end: argument.end, text: argument.body.getText(tree) });
      }
      ts.forEachChild(node, calls);
    };
    calls(tree);
    assert.ok(edits.length >= 3);
    for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
    return source;
  }

  const negativeCases = {
    'shelf-selection': [[shelfPath, source => captureParameter(source, 'selectionAction', 'label'), selectionScenario, /retained selection native name/]],
    'tools-counts': [[toolsPath, source => captureParameter(source, 'batchCounter', 'label'), countsScenario, /retained diagnostics counters/]],
    'reader-theme-icons': [
      [mangaPath, source => captureParameter(source, 'iconAction', 'icon'), themeScenario, /retained manga icon/],
      [replacePath, source => captureParameter(source, 'toolbarButton', 'icon'), themeScenario, /retained replacement toolbar icons/],
      [replacePath, source => captureParameter(source, 'ruleIcon', 'icon'), themeScenario, /retained replacement row icons/],
    ],
    'rss-theme-icons': [
      ...['RssEntryDetailPage', 'RssSourceFeedPage', 'RssSubscriptionManagementPage'].map(name =>
        [rssPath(name), source => captureParameter(source, 'actionTarget', 'icon'), rssThemeScenario, new RegExp(name + ' retained action images')]),
      [rssPath('RssPage'), source => captureParameter(source, 'stateCard', 'icon'), rssThemeScenario, /RSS retained empty-state icon/],
    ],
    'group-editor-labels': [[groupPath, source => captureParameter(source, 'heading', 'label'), groupEditorScenario, /retained group heading/]],
    'import-summary': [[importPath, source => captureParameter(source, 'importHeader', 'title'), importSummaryScenario, /retained import result heading/]],
    'search-source-reason': [[searchPath, source => source
      .replace('this.sourceRequiredContent();', 'this.sourceRequiredContent(this.sourceRequiredReason());')
      .replace("private sourceRequiredContent() {\n    ForEach([this.sourceRequiredReason()], (reason: string): void => {", 'private sourceRequiredContent(reason: string) {')
      .replace('    }, (reason: string): string => reason);', ''), searchReasonScenario, /current source-required reason/]],
    'group-row-values': [[groupPath, source => source.replaceAll('this.currentGroup(group)', 'group'), groupRowsScenario, /retained group row/]],
    'shelf-metadata': [
      [listPath, source => captureParameter(source, 'metadataTag', 'label'), metadataScenario, /retained shelf metadata/],
      [detailPath, source => captureParameter(source, 'metadataTag', 'label'), metadataScenario, /retained text detail origin/],
      [detailPath, source => captureParameter(source, 'mangaMetadataTag', 'label'), metadataScenario, /retained manga detail origin/],
    ],
    'manga-dock-icons': [[mangaPath, source => captureParameter(source, 'footerAction', 'icon'), dockScenario, /retained manga dock icons/]],
    'replace-recovery-label': [[replacePath, source => captureParameter(source, 'textAction', 'label'), recoveryLabelScenario, /retained same-operation recovery caption/]],
    'sync-summary-values': [[syncPath, source => captureParameter(source, 'gatedRow', 'value'), syncSummaryScenario, /retained Sync summary values/]],
  };

  function rejectOldCapture(id) {
    for (const [path, mutate, scenario, expected] of negativeCases[id]) {
      const original = read(path), mutant = mutate(original);
      assert.notEqual(mutant, original);
      sourceOverrides.set(path, mutant);
      try { assert.throws(() => scenario(), expected, id + ' historical capture is behaviorally rejected'); }
      finally { sourceOverrides.delete(path); }
    }
    results[id].negativeControlsRejected = negativeCases[id].length;
  }

  if (selected.includes('shelf-selection')) {
    results['shelf-selection'] = selectionScenario();
    rejectOldCapture('shelf-selection');
    recordContractCasePass('shelf-selection');
  }
  if (selected.includes('tools-counts')) {
    results['tools-counts'] = countsScenario();
    rejectOldCapture('tools-counts');
    recordContractCasePass('tools-counts');
  }
  if (selected.includes('reader-theme-icons')) {
    results['reader-theme-icons'] = themeScenario();
    rejectOldCapture('reader-theme-icons');
    recordContractCasePass('reader-theme-icons');
  }
  for (const [id, scenario] of [['rss-theme-icons', rssThemeScenario], ['group-editor-labels', groupEditorScenario],
    ['import-summary', importSummaryScenario], ['search-source-reason', searchReasonScenario],
    ['group-row-values', groupRowsScenario], ['shelf-metadata', metadataScenario], ['manga-dock-icons', dockScenario],
    ['replace-recovery-label', recoveryLabelScenario], ['sync-summary-values', syncSummaryScenario]]) {
    if (!selected.includes(id)) continue;
    results[id] = scenario(); rejectOldCapture(id); recordContractCasePass(id);
  }
  const paths = [shelfPath, toolsPath, mangaPath, replacePath, groupPath, importPath, searchPath,
    ...['RssPage', 'RssEntryDetailPage', 'RssSourceFeedPage', 'RssSubscriptionManagementPage'].map(rssPath),
    'entry/src/main/ets/features/bookshelf/ui/ShelfBookListDetails.ets', 'entry/src/main/ets/features/reading/ui/LocalBookDetail.ets',
    'entry/src/main/ets/features/sync/ui/SyncPage.ets',
    'tools/test-builder-live-labels.mjs'];
  const report = { status: 'PASS', cases: selected, results,
    inputs: paths.map(path => ({ path, sha256: createHash('sha256').update(read(path)).digest('hex') })),
    boundary: 'Actual production parent/child Builders and installed SDK partial updates. Finite geometry/font/book/readiness ports. Native glyph/focus/theme pixels remain separate.' };
  if (output) writeFileSync(new URL(output, root), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}

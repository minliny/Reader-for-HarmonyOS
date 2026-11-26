import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'clear-results-input': 'The shared editor clears the original draft, retires results, and refocuses the same input only while its owner lives.',
  'native-targets': { description: 'Current bookPanel/bar/history native44 targets, paid Common/lane/heading/projection and SearchPage query/header ownership. Old36/32/30 recipes rejected.', resources: [] },
  'measured-shadow': {
    description: 'Actual SDK header owns one rounded Native material/shadow and measured fractional-density radius; stale or missing bindings and a second phone painter are rejected',
    resources: [],
  },
  'common-hit-test': {
    description: 'The actual SDK enabled Common host stays Transparent in shelf/search and disabled routes, so a full-window search actor does not block lower content; missing modifier is rejected',
    resources: [],
  },
  'retained-inputs': {
    description: 'Actual SDK child-update closures refresh persistent search identities while retained callbacks reject stale runtime, host and event identities',
    resources: [],
  },
});

for (const id of selected) {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { stripTypeScriptTypes } = await import('node:module');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { virtualFilePath } = await import('./lib/tool-environment.mjs');
  const { ts, options, require, root } = installedEtsCompiler();
  const compiler = require(`${root}/lib/process_component_class.js`);
  const utils = require(`${root}/lib/utils.js`);
  const main = require(`${root}/main.js`);
  const syntax = require(`${root}/lib/validate_ui_syntax.js`);
  const ui = require(`${root}/lib/process_ui_syntax.js`);
  const componentMap = require(`${root}/lib/component_map.js`);
  const parse = source => ts.createSourceFile(virtualFilePath('SearchSurfaceBindingProbe.ets'), source,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  if (id === 'clear-results-input') {
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const base = new URL('../entry/src/main/ets/', import.meta.url);
    const file = relative => new URL(relative, base);
    const frames = [], receipts = [];
    const modelFile = file('features/search/presentation/ReaderLibrarySearchModel.ets');
    const { ReaderLibrarySearchModel } = pureModuleProbe(readFileSync(modelFile,'utf8'),
      'ReaderLibrarySearchModel.ets', { Observed: type => type }, ['ReaderLibrarySearchModel']);
    const model = new ReaderLibrarySearchModel();
    model.claim(4); model.activate(4);
    model.onText = text => receipts.push(['draft',text]);
    const Presentation = selectedProductionMethods(file('features/search/presentation/LibrarySearchPresentation.ets'),
      'LibrarySearchPresentation', ['edit']);
    const presentation = Object.assign(new Presentation(), { mode:'results',
      host:{ stop:()=>receipts.push(['stop']), refreshHistory:()=>receipts.push(['history']) } });
    const Surface = selectedProductionMethods(file('features/search/ui/ReaderLibrarySearchSurface.ets'),
      'ReaderLibrarySearchSurface', ['acceptsField','clearAction','textAction']);
    const surface = Object.assign(new Surface(), { model, mounted:true, identity:1, navigationGeneration:2, mounting:3,
      fieldIdentity:()=> 'one-editor', onInputRequested:(identity,generation,mounting)=>{
        assert.deepEqual([identity,generation,mounting],[1,2,3]);
        presentation.edit();
      } });
    Object.defineProperty(surface,'mode',{get:()=>presentation.mode});
    const Field = selectedProductionMethods(file('ui/controls/ReaderSearchField.ets'), 'ReaderSearchField',
      ['clearBookInput','changeText','focusBookInput'],
      { ReaderSearchFocusFrame: class { constructor(action) { this.action = action; } } });
    const field = Object.assign(new Field(), { mounted:true, focusGeneration:1, mode:'submit',
      isBookField:()=>true, bookEditorObservationCurrent:()=>true, observedBookLength:4,
      editingCurrent:()=>surface.acceptsField(4,'one-editor') && !model.panelOwnsInput,
      onTextChange:surface.textAction(4,'one-editor'), onBookClear:surface.clearAction(4,'one-editor'),
      observeBookEditor:(event,facts)=>receipts.push([event,facts.beforeLength]),
      revealBookInputCaret() {}, getUIContext:()=>({postFrameCallback:frame=>frames.push(frame),
        getFocusController:()=>({requestFocus:target=>receipts.push(['focus',target])})}) });
    field.clearBookInput();
    assert.equal(presentation.mode,'input','result clear returns to input before a focus callback');
    frames.shift().action();
    assert.deepEqual(receipts,[['clear',4],['draft',''],['stop'],['history'],['focus','reader-book-search-input']]);
    model.panelOwnsInput = true;
    field.clearBookInput();
    assert.equal(receipts.length,5,'an overlay prevents retained clear from acting');
    model.panelOwnsInput = false;
    field.clearBookInput();
    model.release(4);
    frames.shift().action();
    assert.deepEqual(receipts.slice(5),[['clear',0],['draft','']],'input clear keeps history and stale focus is retired');
  } else if (id === 'native-targets') {
    const { writeFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const { execFileSync } = await import('node:child_process');
    const { foundationControls, foundationSpecs, readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
    const { tailControls, compileTailConsumer } = await import('./lib/foundation-tail-consumer-probe.mjs');
    const { boundedMembers, readerSurfaceSpecsForProbe, boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { actualSourceManagementGeometry } = await import('./lib/source-management-owner-probe.mjs');
    const geometry = await import('../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts');
    const safe = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
    const { consumeReaderControlKeyboardBack } = await import('../entry/src/main/ets/ui/foundation/ReaderKeyboardBack.ts');
    const base = new URL('../entry/src/main/ets/', import.meta.url);
    const read = relative => readFileSync(new URL(relative, base), 'utf8');
    const surfaceSource = read('features/search/ui/ReaderLibrarySearchSurface.ets');
    const fieldSource = read('ui/controls/ReaderSearchField.ets');
    const historySource = read('features/search/ui/ReaderSearchHistoryPanel.ets');
    const historyGeometrySource = read('features/search/ui/SearchHistoryGeometry.ts');
    const searchSource = read('features/search/ui/SearchPage.ets');
    const modelSource = read('features/search/presentation/ReaderLibrarySearchModel.ets');
    const modelTypes = pureModuleProbe(modelSource, 'ReaderLibrarySearchModel.ets', { Observed: type => type }, ['ReaderLibrarySearchModel', 'READER_LIBRARY_SEARCH_BACK_FOCUS_ID']);
    const { ReaderLibraryJourney } = pureModuleProbe(read('app/composition/ReaderLibraryJourney.ets'), 'ReaderLibraryJourney.ets', {}, ['ReaderLibraryJourney']);
    const historyTypes = pureModuleProbe(historyGeometrySource, 'SearchHistoryGeometry.ts', geometry,
      ['SearchHistoryGeometry', 'SearchHistoryPanelLayout', 'SearchHistoryViewport', 'projectSearchHistoryRows', 'projectSearchHistoryPanel']);
    const { SearchPublication } = await import('../entry/src/main/ets/features/search/presentation/SearchPublication.ts');
    const headerTypes = pureModuleProbe(read('ui/foundation/ReaderHeaderSpecs.ets'), 'ReaderHeaderSpecs.ets', {
      ...readerFoundationTokens, ...(await import('../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts')) }, ['searchHeaderSpec', 'bookshelfHeaderSpec']);
    const fieldFocus = pureModuleProbe(fieldSource.slice(0, fieldSource.indexOf('@Component')), 'ReaderSearchFocusFrame.ets', { FrameCallback: class {} }, ['ReaderSearchFocusFrame']);
    const fonts = ['Regular', 'Bold'].map(weight => {
      const path = new URL(`../entry/src/main/resources/rawfile/NotoSansSC-UI${weight}.otf`, import.meta.url);
      return { path: path.pathname, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') };
    });
    const widths = new Map();
    function measure(text, size, weight) {
      const key = JSON.stringify([text, size, weight]);
      if (!widths.has(key)) widths.set(key, Number(execFileSync('python3', ['-c', 'from PIL import ImageFont\nimport sys\nf=ImageFont.truetype(sys.argv[1],round(float(sys.argv[3])*100))\nprint(f.getlength(sys.argv[2])/100)', fonts[Number(weight) >= 600 ? 1 : 0].path, text, String(size)], { encoding: 'utf8' })));
      return widths.get(key);
    }
    const cases = [];
    for (const width of [320, 366]) for (const scale of [1, 1.45, 2, 3]) for (const safeInset of [0, 40]) {
      const metrics = new safe.ReaderWindowMetricsSnapshot(new safe.ReaderRectVp(0, 0, width, 360));
      metrics.ready = true; metrics.systemFontScale = scale; metrics.systemInsets = new safe.ReaderInsetsVp(safeInset, 24, safeInset, 16);
      const foundation = foundationControls({ windowMetrics: () => metrics });
      const controls = tailControls({ foundation });
      const surfaces = boundedSurfaceSdk({ properties: foundation.properties, windowMetrics: () => metrics, allowEmptyBranchAdmission: true });
      const nativeCalls = [], frames = [];
      const uiContext = { getFont: () => ({}), px2vp: value => value,
        postFrameCallback: callback => frames.push(callback), getFocusController: () => ({ requestFocus: name => nativeCalls.push(['focus', name]), clearFocus: () => nativeCalls.push(['clearFocus']) }),
        getMeasureUtils: () => ({ measureText: options => measure(options.textContent, Number.parseFloat(options.fontSize) * scale, options.fontWeight) }) };
      const shared = { ...surfaces.deps, ...controls.dependencies, ...geometry, ...historyTypes, ...headerTypes, ...modelTypes,
        ...safe, ...readerSurfaceSpecsForProbe(metrics), ...fieldFocus, ...actualSourceManagementGeometry(metrics),
        ReaderWindowCoordinator: { metrics: () => metrics }, readerWindowMetrics: () => metrics, uiContext,
        readerPaperActionIcon: () => 'history-trash',
        globalThis: Object.assign(Object.create(globalThis), surfaces.deps.globalThis) };
      Object.assign(shared, pureModuleProbe(historySource.slice(0, historySource.indexOf('@Component')),
        'SearchHistoryMeasurements.ets', shared, ['SearchHistoryMeasurements']));
      const History = compileTailConsumer(historySource, boundedMembers(historySource), shared, controls.hooks).Component;
      const SearchField = compileTailConsumer(fieldSource, boundedMembers(fieldSource), shared, controls.hooks).Component;
      const hooks = { ...controls.hooks, childSources: { ...surfaces.childSources, ...controls.hooks.childSources, ReaderSearchField: fieldSource, ReaderSearchHistoryPanel: historySource } };
      const model = new modelTypes.ReaderLibrarySearchModel();
      const searches = [], changes = [];
      const page = compileTailConsumer(searchSource, ['bindSurface', 'publishSurface', 'ownsPageQuery', 'ownsSurface', 'surfaceInputCurrent', 'pageInputCurrent', 'searchPanelOwnsInput', 'hasSearchSession', 'isSweeping', 'hasActiveSearchRequest', 'operation', 'canSubmit', 'submitSearch',
        'pageGeometry', 'resolvedHeaderHeight', 'searchBottomInset', 'searchControlHeight', 'searchFontScale', 'externalHeaderChanged', 'acceptSearchHeaderHeight', 'searchHeaderMeasurementKey', 'ownsList'], { ...shared, nextSearchSurfaceOwner: 0 }, hooks).owner;
      Object.assign(page, { pageMounted: true, isPresentationCurrent: () => true, isPresentationVisible: () => true, pageEpoch: 1, queryAtMount: 1,
        publication: new SearchPublication(), publicationRevision: 0,
        viewState: { pageRevision: 1, revision: 1, keywordDraft: '书' }, surfaceModel: model, surfaceOwner: 0, keyword: '书',
        presentation: { kind: 'initial', history: ['书', '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未'], historyStatus: undefined },
        nativePanel: undefined, filtersExpanded: false, taskStatusExpanded: false,
        filterSheetIdentity: '', taskSheetIdentity: '', focusInputOnAppear: false,
        spinnerRunKey: 0, searchProgressText: () => '', cancelSearchFocusRestore() {}, onSearch: keyword => searches.push(keyword),
        onClearHistory: () => changes.push('clear-history'), onRetryHistory() {}, readerWindowMetricsRevision: 1, expandedLayout: false, measurementRevision: 1,
        measurements: new shared.ReaderMeasurementStore(), externalHeaderHeight: 0, headerAnchorPending: false, listMounted: false });
      page.bindSurface();
      const names = ['header', 'bar', 'controlHeight', 'searchActionVisualHeight', 'fontScale', 'barHeight', 'actionWidth', 'searchLaneLeft', 'searchLaneWidth', 'fieldWidth', 'laneTop', 'stackedSearch', 'searchLaneHeight', 'cardContentWidth', 'horizontalInset',
        'fieldIdentity', 'presentedSearch', 'surfaceValue', 'actionInteractive', 'inputInteractive', 'headerActionGlyph', 'headerActionFrame', 'headerActionTop', 'moreInteractive', 'leadingAction', 'moreAction', 'textAction',
        'submitAction', 'focusAction', 'searchAction', 'clearAction', 'acceptsField', 'historyInteractive', 'historyAction', 'clearHistoryAction', 'retryHistoryAction', 'historyGeometry', 'historyFeedbackKey',
        'historyViewportHeight', 'historyLimit', 'historyBarBottom', 'historyLayout', 'historyPanel', 'toggleHistoryAction', 'resolvedHistoryViewport', 'surfaceHeight', 'availableBottom', 'historyDividerColor', 'consumeInputBack',
        'captureHeader', 'metricsChanged', 'retargetHistoryViewport'];
      const surface = compileTailConsumer(surfaceSource, names, { ...shared, ReaderSearchField: SearchField, ReaderSearchHistoryPanel: History,
        READER_FONT_NOTO_SANS_SC_UI_BOLD: 'ReaderNotoSansSCUIBold', consumeReaderControlKeyboardBack,
        inputMethod: { getController: () => ({ hideTextInput: () => { nativeCalls.push(['hideIme']); return Promise.resolve(); } }) }, hilog: { warn() {} } }, hooks).owner;
      const surfaceFields = { mounted: true, scheme: 'day', metricsRevision: 1, spec: headerTypes.searchHeaderSpec(), mode: 'input', transitionKind: 'none',
        model, identity: 7, navigationGeneration: 9, mounting: 11, searchMounted: true, expandedLayout: false, moreIdentity: 'shelf', surfaceWindowY: 0,
        surfaceProgress: () => 1, historyProgress: () => 1, resultsProgress: () => 1, titleOpacity: () => 0, blend: (a, b, progress) => a + (b - a) * progress,
        headerVeil: () => false, panelBorderColor: () => '#000000', headerMaterialRadius: () => 18, headerSurfaceAreaChange: () => () => {},
        historyFeedbackAction: () => () => {}, measuredHistoryFeedbackKey: '', measuredHistoryFeedback: 0,
        historyExpanded: false, historyResizeOpacity: 1, historyResizeRevision: 0, historyResizeHoldingCoverage: false,
        historyMeasurements: new shared.SearchHistoryMeasurements(),
        headerStackShadow: () => shared.readerSurfaceElevation('raised', 'day'),
        displayedHistoryLimit: 0, continueCardRect: undefined, onOpen() {}, onBack() {}, onMore() {}, measurementKey: 1, headerBottom: 0,
        reduceMotion: true, historyLimitTrack: { set() {} }, historyTrack: { set() {} }, publishContinueCardCoverage() {}, schedule() {} };
      Object.assign(surface, surfaceFields);
      const runtime = {}, host = {}, scope = { owner: runtime, mounting: 11, inputAllowed: true, retired: false };
      const headerPresentation = { identity: 7, host, mode: 'input', headerBottom: 0 };
      const journey = new ReaderLibraryJourney({ snapshot: () => ({ route: 'search', generation: 9 }) }, {
        scope: () => scope, ownsRuntime: candidate => candidate === runtime, acquisition: () => ({ currentOwner: () => runtime }),
        search: () => headerPresentation, read: () => ({ headerBottom: 0 }),
      });
      const headerActions = journey.headerActions(runtime, host), acceptedHeaderBottoms = [];
      surface.onHeaderBottom = (bottom, identity, key, generation, mounting) => {
        headerActions.onHeaderBottom(bottom, identity, key, generation, mounting);
        page.externalHeaderHeight = headerPresentation.headerBottom;
        page.externalHeaderChanged(); acceptedHeaderBottoms.push(page.externalHeaderHeight);
      };
      surface.historyHeight = surface.resolvedHistoryViewport().height;
      surface.displayedHistoryViewport = surface.historyHeight;
      surface.header();
      const nodes = controls.nodes(surface), input = nodes.find(node => node.type === 'TextInput');
      const clear = nodes.find(node => node.type === 'Button' && node.accessibilityText === '清空搜索内容');
      const submit = nodes.find(node => node.type === 'Button' && node.accessibilityText === '搜索');
      assert.ok(input.height >= 44 && clear.responseRegion.width >= 44 && clear.responseRegion.height >= 44 &&
        submit.height >= 44 && submit.width >= 44);
      assert.equal(input.height, surface.controlHeight());
      assert.ok(nodes.some(node => node.type === '__Common__' && node.width === surface.fieldWidth() && node.height === input.height), 'normal bar Common pays the actual bookPanel height');
      assert.ok(nodes.some(node => node.type === 'Flex' && node.width === surface.searchLaneWidth() && node.height === surface.searchLaneHeight()), 'normal clipped lane uses the shared height');
      assert.ok(surface.fieldWidth() - 18 - clear.width >= 44, '320/366 at1..3x retains44vp input beside the separate44clear');
      assert.ok(surface.laneTop() >= 0 && surface.laneTop() + input.height <= surface.barHeight());
      surface.captureHeader(surface.barHeight() + 2 * surface.spec.borderWidth + surface.historyViewportHeight(), surface.measurementKey);
      assert.equal(page.measurements.readForGeneration('search:header', page.searchHeaderMeasurementKey(), -1), page.externalHeaderHeight);
      assert.equal(page.pageGeometry().header.height, page.externalHeaderHeight, 'SearchPage content geometry consumes current external header receipt');
      input.onChange('当前查询'); input.onSubmit('EnterKeyType.Search'); submit.onClick();
      assert.equal(page.keyword, '当前查询'); assert.deepEqual(searches, ['当前查询', '当前查询']);
      const oldSubmit = submit.onClick; model.claim(999); model.activate(999); oldSubmit(); assert.equal(searches.length, 2, 'retired normal bar callback cannot submit a new model owner');
      model.claim(page.surfaceOwner); model.activate(page.surfaceOwner);
      clear.onClick(); assert.equal(page.keyword, '', 'actual Native clear reaches the same current SearchPage query owner');
      assert.ok(frames.length > 0, 'clear retains native input focus scheduling');
      const history = [...surface.children.values()].find(child => child instanceof History);
      assert.ok(history); const historyNodes = controls.nodes(history), geometryValue = history.layout.geometry;
      if (geometryValue.headingVisible) {
        const clearHistory = historyNodes.find(node => node.type === 'Button' && node.accessibilityText === '清空搜索历史');
        assert.ok(clearHistory.height >= 44 && clearHistory.constraintSize.minWidth >= 44);
        assert.ok(historyNodes.some(node => node.type === 'Row' && node.height === clearHistory.height));
        if (history.layout.toggleInHeading) {
          const toggle = historyNodes.find(node => node.type === 'Button' && node.accessibilityText === '展开搜索历史');
          assert.equal(toggle.height, clearHistory.height, 'compact heading reserves one full action row');
        } else {
          const heading = historyNodes.find(node => node.type === 'Text' && node.create === '最近搜索');
          assert.ok(clearHistory.height >= heading.lineHeight * scale, 'heading parent pays current natural line box');
        }
        clearHistory.onClick(); assert.deepEqual(changes, ['clear-history']);
      }
      const rows = history.layout.rows;
      assert.ok(rows.every(row => row.width <= geometryValue.contentWidth));
      assert.ok(rows.flatMap(row => row.chips).every(chip => chip.width >= 44));
      const keyword = historyNodes.find(node => node.type === 'Button' && node.accessibilityText === '搜索书');
      if (rows.some(row => row.chips.some(chip => chip.keyword === '书'))) {
        assert.ok(geometryValue.recordsVisible);
        assert.ok(keyword && keyword.constraintSize.minWidth >= 44 && keyword.height === geometryValue.buttonHeight && keyword.width === '100%');
        assert.ok(historyNodes.some(node => node.type === '__Common__' && node.width ===
          surface.historyMeasurements.measureControlWidth(uiContext, surface.metricsRevision, '书') &&
          node.height === geometryValue.buttonHeight), 'single CJK chip parent participates in paid44 width packing');
      }
      for (const viewport of [0, 40, 100, 180]) {
        const bounded = new historyTypes.SearchHistoryGeometry(width - 32, viewport, scale, false);
        const projected = historyTypes.projectSearchHistoryRows(['书', '甲', '乙'], bounded, () => 1);
        assert.ok(projected.length <= bounded.rows && projected.flatMap(row => row.chips).every(chip => chip.width >= 44));
        assert.ok(!bounded.recordsVisible || projected.length * bounded.buttonHeight + Math.max(0, projected.length - 1) * bounded.gap <= bounded.bodyHeight);
      }
      const narrow = new historyTypes.SearchHistoryGeometry(60, 250, scale, false);
      assert.equal(narrow.recordsVisible, false, 'sub44 content never admits an overflowing native44 chip');
      const filterSource = read('features/search/ui/ReaderSearchFilterPanel.ets');
      const filter = compileTailConsumer(filterSource, ['sheetHeader', 'resetAction', 'active', 'accepts', 'headerMeasurement', 'bodyHeightLimit', 'systemFontScale'], shared, hooks).owner;
      Object.assign(filter, { mounted: true, scheme: 'day', expanded: true, presentationIdentity: 'filter:1', selectedGroup: '在线', selectedType: '全部类型',
        metricsRevision: 1, measuredHeaderHeight: 0, sheetSpec: () => shared.resolveSheetSpec('search-result-filter'), onReset() {}, onDismiss() {} });
      filter.sheetHeader('filter:1');
      const reset = controls.nodes(filter).find(node => node.type === 'Button' && node.accessibilityText === '重置');
      assert.ok(reset.constraintSize.minWidth >= 44 && reset.constraintSize.minHeight >= 44);
      assert.ok(controls.nodes(filter).some(node => node.type === 'Row' && node.height === undefined && node.constraintSize?.minHeight === 44), 'actual filter title/action row is natural above44');
      const sheet = shared.resolveSheetSpec('search-result-filter');
      const rowHeight = Math.max(sheet.titleHeight, sheet.titleLineHeight * scale, reset.constraintSize.minHeight);
      assert.ok(filter.bodyHeightLimit() <= metrics.windowRect.height - safe.readerVisualSafeTop(metrics) - safe.readerVisualSafeBottom(metrics) -
        sheet.handleTop - sheet.handleHeight - sheet.handleBottom - rowHeight - sheet.titleBottom - sheet.contentBottom,
        'cold filter body budget pays the actual title and reset target before a native area receipt');
      const taskSource = read('features/search/ui/ReaderSearchTaskPanel.ets');
      const task = compileTailConsumer(taskSource, ['sheetHeader', 'sheetBody', 'details', 'message', 'messageText', 'retryAction', 'accepts', 'bodyLimit', 'fontScale', 'measureHeader'],
        { ...shared, READER_ACTION_MIN_TARGET: 44 }, hooks).owner;
      Object.assign(task, { mounted: true, scheme: 'day', expanded: true, presentationIdentity: 'task:1', retryIdentity: 'retry:1', metricsRevision: 1,
        measuredHeaderHeight: 0, canRetry: true, partialText: '部分未完成'.repeat(100), failed: 3, failedText: '失败详情', skipped: 1, skippedText: '跳过详情', searching: false,
        progressText: '仍在读取', onRetry() {}, onDismiss() {} });
      task.sheetHeader('task:1'); task.sheetBody('task:1');
      const retry = controls.nodes(task).find(node => node.type === 'Button' && node.accessibilityText === '重试未完成的书源');
      assert.ok(retry.constraintSize.minWidth >= 44 && retry.constraintSize.minHeight >= 44);
      assert.ok(controls.nodes(task).some(node => node.type === 'Scroll' && node.constraintSize?.maxHeight === task.bodyLimit()), 'cold task details and grown Native retry share a bounded body document');
      if (width === 320 && scale === 2 && safeInset === 40) {
        assert.equal(surface.stackedSearch(), true, 'the actual two-axis deficit selects the existing lane wrap');
        const oldSource = surfaceSource.replace('return this.searchLaneWidth() - this.actionWidth() - 5 < SEARCH_CONTROL_MIN_TARGET * 2 + 18;', 'return false;');
        assert.notEqual(oldSource, surfaceSource);
        const old = compileTailConsumer(oldSource, names, { ...shared, ReaderSearchField: SearchField, ReaderSearchHistoryPanel: History,
          READER_FONT_NOTO_SANS_SC_UI_BOLD: 'ReaderNotoSansSCUIBold' }, hooks).owner;
        Object.assign(old, surfaceFields); model.keyword = '书'; old.bar();
        const oldCommon = controls.nodes(old).find(node => node.type === '__Common__' && node.width === old.fieldWidth());
        assert.ok(oldCommon);
        assert.throws(() => assert.ok(oldCommon.width - 18 - geometry.SEARCH_CONTROL_CLEAR_SLOT >= 44),
          /AssertionError/, 'old forced-inline bar cannot fit the editor and clear slot');
      }
      metrics.keyboardInsets = new safe.ReaderInsetsVp(0, 0, 0, 180);
      assert.equal(surface.consumeInputBack(), true); assert.ok(nativeCalls.some(call => call[0] === 'hideIme'));
      assert.equal(searches.length, 2, 'IME Back does not dispatch a search');
      if (width === 320 && scale === 1 && safeInset === 40) {
        input.onChange('保留草稿');
        const field = [...surface.children.values()].find(child => child instanceof SearchField);
        const physicalInput = input, oldKey = surface.measurementKey, oldHeight = surface.headerBottom;
        metrics.systemFontScale = 2; metrics.keyboardInsets = new safe.ReaderInsetsVp();
        surface.metricsRevision += 1; page.readerWindowMetricsRevision += 1;
        field.readerWindowMetricsRevision += 1; history.metricsRevision += 1;
        surface.metricsChanged();
        assert.equal(surface.measurementKey, oldKey + 1, 'real metricsChanged advances the header receipt epoch');
        surface.replay(); foundation.properties.flush();
        const currentField = [...surface.children.values()].find(child => child instanceof SearchField);
        const currentInput = controls.nodes(currentField).find(node => node.type === 'TextInput');
        assert.equal(currentField, field); assert.equal(currentInput, physicalInput, 'inline-to-wrap preserves the same physical Native input observer');
        assert.equal(page.keyword, '保留草稿'); assert.equal(page.viewState.keywordDraft, '保留草稿');
        assert.equal(surface.stackedSearch(), true);
        const currentNodes = controls.nodes(surface), clip = currentNodes.find(node => node.type === 'Stack' && node.width === surface.searchLaneWidth() && node.clip === true);
        assert.ok(currentNodes.some(node => node.type === 'Flex' && node.width === surface.searchLaneWidth() && node.height === surface.searchLaneHeight()));
        assert.equal(clip.height, surface.searchLaneHeight(), 'current two-row clip pays both complete44+ targets');
        assert.equal(surface.barHeight(), surface.searchLaneHeight() + surface.spec.barHeightExtra);
        const accepted = acceptedHeaderBottoms.length;
        surface.captureHeader(10, oldKey); assert.equal(acceptedHeaderBottoms.length, accepted, 'old inline header receipt cannot enter the wrapped owner');
        assert.equal(surface.headerBottom, oldHeight);
        surface.captureHeader(surface.barHeight() + 2 * surface.spec.borderWidth + surface.historyViewportHeight(), surface.measurementKey);
        assert.equal(acceptedHeaderBottoms.length, accepted + 1);
        assert.equal(page.externalHeaderHeight, surface.headerBottom);
        assert.equal(page.measurements.readForGeneration('search:header', page.searchHeaderMeasurementKey(), -1), surface.headerBottom,
          'current receipt crosses the actual Journey callback then current SearchPage watcher');
        physicalInput.onSubmit('EnterKeyType.Search'); assert.equal(searches.at(-1), '保留草稿', 'retained IME submit still enters the original current query owner');
        metrics.systemFontScale = 1; surface.metricsRevision += 1; field.readerWindowMetricsRevision += 1; history.metricsRevision += 1;
        surface.metricsChanged(); surface.replay(); foundation.properties.flush();
        assert.equal(surface.stackedSearch(), false); assert.equal([...surface.children.values()].find(child => child instanceof SearchField), field);
        assert.equal(controls.nodes(field).find(node => node.type === 'TextInput'), physicalInput, 'wrap-to-inline also retains the physical actor');
      }
      cases.push({ width, scale, safeInset, stacked: surface.stackedSearch(), fieldWidth: surface.fieldWidth(), nativeInputHeight: input.height, clearWidth: clear.width, actionHeight: submit.height, barHeight: surface.barHeight(),
        historyButtonHeight: geometryValue.buttonHeight, historyHeadingHeight: geometryValue.headingHeight, admittedRows: rows.length });
    }
    // Prior finite recipes and the actual old packed Common reproduce all three omissions.
    const currentSpecsSource = read('ui/controls/ReaderControlSpecs.ets');
    const oldGeometry = pureModuleProbe(read('ui/foundation/ReaderSearchControlGeometry.ts').replace('SEARCH_CONTROL_MIN_TARGET = 44', 'SEARCH_CONTROL_MIN_TARGET = 36'), 'PriorSearchControlGeometry.ts', {}, ['readerSearchControlHeight']);
    const narrowClearRegion = fieldSource.replace('y: 0, width: SEARCH_CONTROL_MIN_TARGET, height: SEARCH_CONTROL_MIN_TARGET',
      'y: 0, width: 32, height: SEARCH_CONTROL_MIN_TARGET');
    assert.notEqual(narrowClearRegion, fieldSource);
    const oldField = compileTailConsumer(narrowClearRegion, boundedMembers(fieldSource), {
      ...tailControls().dependencies, ...oldGeometry, ...fieldFocus, SEARCH_CONTROL_MIN_TARGET: 36, readerWindowMetrics: () => ({ systemFontScale: 1 }) }, tailControls().hooks).owner;
    Object.assign(oldField, { variant: 'bookPanel', mode: 'submit', text: '书', placeholder: '搜索', clearable: true, onTextChange() {}, onSubmit() {}, appThemeScheme: 'day' }); oldField.initialRender();
    assert.throws(() => assert.ok([...oldField.nodes.values()].find(node => node.type === 'TextInput').height >= 44), /AssertionError/, 'old actual bookPanel Native36 rejected');
    assert.throws(() => assert.ok([...oldField.nodes.values()].find(node => node.type === 'Button').responseRegion.width >= 44),
      /AssertionError/, 'old actual bookPanel clear32 hit region rejected');
    const oldHistorySource = historySource.replace('Math.max(spec.minWidth ?? 0,\n      Math.ceil(measured) + spec.horizontalPadding * 2 + (spec.hasBorder ? TOK_BORDER_W * 2 : 0))', 'Math.ceil(measured) + spec.horizontalPadding * 2 + (spec.hasBorder ? TOK_BORDER_W * 2 : 0)');
    assert.notEqual(oldHistorySource, historySource);
    const one = { systemFontScale: 1 }, controls = tailControls({ foundation: foundationControls({ windowMetrics: () => one }) });
    const oldHistory = pureModuleProbe(oldHistorySource.slice(0, oldHistorySource.indexOf('@Component')),
      'PriorSearchHistoryMeasurements.ets', { ...controls.dependencies, ReaderWindowCoordinator: { metrics: () => one } },
      ['SearchHistoryMeasurements']);
    const measureContext = { px2vp: value => value, getMeasureUtils: () => ({ measureText: () => 12 }) };
    assert.throws(() => assert.ok(new oldHistory.SearchHistoryMeasurements().measureControlWidth(measureContext, 1, '书') >= 44),
      /AssertionError/, 'old measured30 width cannot silently leave Native44 debt');
    const oldHeading = pureModuleProbe(historyGeometrySource.replace('Math.max(SEARCH_CONTROL_MIN_TARGET, Math.ceil(34 + 18 * (scale - 1)))',
      'Math.ceil(34 + 18 * (scale - 1))'), 'PriorSearchHistoryGeometry.ts', geometry, ['SearchHistoryGeometry']);
    assert.throws(() => assert.ok(new oldHeading.SearchHistoryGeometry(320, 250, 1, false).headingHeight >= 44), /AssertionError/, 'old heading32 parent rejected');
    const oldControls = foundationControls({ specs: { ...foundationSpecs(readerTypographyRoles, currentSpecsSource), ...oldGeometry } });
    const oldAction = new oldControls.dependencies.ReaderButton(undefined, { specId: 'search-field-wide', label: '搜索' }); oldAction.initialRender();
    assert.throws(() => assert.ok(oldControls.nodes(oldAction).find(node => node.type === 'Button').height >= 44), /AssertionError/, 'old shared action36 rejected');
    const oldRetrySpecs = foundationSpecs(readerTypographyRoles, currentSpecsSource.replace('SEARCH_RETRY_PROGRESS.minWidth = 44; SEARCH_RETRY_PROGRESS.minHeight = 44;', ''));
    const oldRetryControls = foundationControls({ specs: oldRetrySpecs });
    const oldRetry = new oldRetryControls.dependencies.ReaderButton(undefined, { specId: 'search-retry-progress', label: '重置' }); oldRetry.initialRender();
    assert.throws(() => assert.ok(oldRetryControls.nodes(oldRetry).find(node => node.type === 'Button').constraintSize?.minHeight >= 44), /AssertionError/, 'old bare reset/retry Native has no44 target');
    writeFileSync(new URL('../.reader-artifacts/framework-confluence-20261112/code-side-audit/repair-secondary-post-library-native-targets.json', import.meta.url), JSON.stringify({
      result: 'PASS', command: { entry: 'tools/test-library-search-surface-binding.mjs', cases: ['native-targets'] }, cases, fonts, glyphMeasurements: widths.size,
      glyphRuntime: JSON.parse(execFileSync('python3', ['-c', "import sys,json,PIL;from PIL import features;print(json.dumps({'python':sys.version,'pillow':PIL.__version__,'freetype':features.version('freetype2'),'raqm':features.version('raqm')}))"], { encoding: 'utf8' })),
      completeInputManifest: process.env.READER_LAYOUT_TRACE_OUTPUT ?? 'NOT_RECORDED', boundary: 'Actual current SDK Native builders, actual model/query dispatch and bounded projection with bundled-font FreeType. No platform layout/IME/pointer/device or HAP.',
    }, null, 2) + '\n');
    recordContractCasePass(id);
    continue;
  }
  if (id === 'measured-shadow') {
    const surfaceTree = parse(readFileSync(new URL('../entry/src/main/ets/features/search/ui/ReaderLibrarySearchSurface.ets', import.meta.url), 'utf8'));
    const surface = surfaceTree.statements.find(node => node.name?.text === 'ReaderLibrarySearchSurface');
    const method = name => surface.members.find(node => node.name?.getText(surfaceTree) === name).getText(surfaceTree);
    const header = method('header');
    const { resolveReaderRaisedShape } = await import('../entry/src/main/ets/ui/layout/ReaderRaisedShape.ts');
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    assert.equal(surfaceTree.getFullText().includes("from '../../../ui/surfaces/ReaderRaisedSurface'"), false,
      'the real search header does not import a second phone painter');
    const historyTree = parse(readFileSync(new URL('../entry/src/main/ets/features/search/ui/ReaderSearchHistoryPanel.ets', import.meta.url), 'utf8'));
    const history = historyTree.statements.find(node => node.name?.text === 'ReaderSearchHistoryPanel');
    const historyFields = history.members.filter(ts.isPropertyDeclaration);
    syntax.componentCollection.customComponents.add('ReaderSearchHistoryPanel');
    syntax.propertyCollection.set('ReaderSearchHistoryPanel', new Set(historyFields.map(node => node.name.getText(historyTree))));
    syntax.propCollection.set('ReaderSearchHistoryPanel', new Set(historyFields.filter(node => ts.getAllDecorators(node).some(tag =>
      tag.expression.getText(historyTree) === 'Prop')).map(node => node.name.getText(historyTree))));
    syntax.regularCollection.set('ReaderSearchHistoryPanel', new Set(historyFields.filter(node => ts.getAllDecorators(node).length === 0)
      .map(node => node.name.getText(historyTree))));
    componentMap.CUSTOM_BUILDER_METHOD.add('header');
    componentMap.CUSTOM_BUILDER_METHOD.add('historyPanel');
    componentMap.CUSTOM_BUILDER_METHOD.add('bar');
    main.partialUpdateConfig.partialUpdateMode = true;
    const areaTree = parse(readFileSync(new URL('../entry/src/main/ets/ui/layout/ReaderPageShell.ts', import.meta.url), 'utf8'));
    const areaNode = areaTree.statements.find(node => node.name?.text === 'readerPageAreaLength');
    const areaLength = new Function(`${stripTypeScriptTypes(areaNode.getText(areaTree).replace(/^export\s+/, ''))}; return readerPageAreaLength;`)();
    function compileHeader(builder) {
      const fixture = parse(`@Component struct MeasuredHeaderProbe {
        ${builder}
        ${method('headerSurfaceAreaChange')}
        ${method('headerSurfaceGeometryKey')}
        ${method('headerSurfaceCollapsed')}
        ${method('hasHeaderSurfaceMeasurement')}
        ${method('headerRaisedShapeIdentity')}
        ${method('currentHeaderRaisedShape')}
        ${method('headerMaterialRadius')}
        ${method('headerStackShadow')}
        ${method('headerShadowStrength')}
        ${method('blend')}
        ${method('aboutToAppear')}
        ${method('aboutToDisappear')}
        @Builder private bar() {}
        @Builder private historyPanel() {}
        build() { Stack() { this.header(); } }
      }`);
      utils.storedFileInfo.setCurrentArkTsFile();
      ui.transformLog.sourceFile = fixture;
      const diagnostics = [];
      let emittedNode;
      const transformed = ts.transform(fixture, [context => file => {
        ui.contextGlobal = context;
        emittedNode = compiler.processComponentClass(file.statements[0], context, diagnostics, false);
        return file;
      }]);
      transformed.dispose();
      assert.deepEqual(diagnostics, [], 'measured production header lowers with the actual SDK');
      const emitted = ts.createPrinter().printNode(ts.EmitHint.Unspecified, emittedNode, fixture);
      const panels = [];
      class ProbeView {
        constructor() { this.observers = []; this.children = new Map(); }
        finalizeConstruction() {}
        observeComponentCreation2(callback) {
          const element = this.observers.length + 1;
          this.observers.push([element, callback]); callback(element, true);
        }
        ifElseBranchUpdateFunction(_branch, callback) { callback(); }
        updateStateVarsOfChildByElmtId(element, params) { Object.assign(this.children.get(element).params, params); }
        static create() {}
      }
      const attributes = extra => new Proxy(extra, { get(target, property) { return target[property] ?? (() => {}); } });
      const Stack = attributes({ create() { panels.push({}); },
        onAreaChange(callback) { panels.at(-1).onAreaChange = callback; },
        borderRadius(value) { panels.at(-1).borderRadius=value; }, clip(value) { panels.at(-1).clip=value; },
        shadow(value) { panels.at(-1).shadow=value; } });
      const clips = [];
      const Column = attributes({ clip(value) { clips.push(value); } });
      const empty = attributes({});
      const metrics = { windowRect: { width: 1280 / 3.5 }, densityPixels: 3.5 };
      const elevation=readerSurfaceSpecsForProbe(metrics).readerSurfaceElevation;
      const Owner = new Function('ViewPU', 'Stack', 'Column', 'If', '__Common__',
        'Alignment', 'HitTestMode', 'Color', 'readerSurfaceElevation', 'readerHeaderVeilMaterial',
        'readerHeaderVeilBorder', 'readerAppColor', 'readerPageAreaLength', 'ReaderWindowCoordinator', 'resolveReaderRaisedShape',
        `${stripTypeScriptTypes(emitted)}; return MeasuredHeaderProbe;`)(ProbeView, Stack, Column, empty, empty,
        { TopStart: 0 }, { Default: 0 }, { Transparent: 0 }, elevation, () => ({}), () => '', () => '', areaLength,
        { metrics: () => metrics }, resolveReaderRaisedShape);
      return { Owner, panels, clips, metrics, elevation };
    }
    function checkMeasured(builder) {
      const { Owner, panels, clips, metrics, elevation } = compileHeader(builder);
      const owner = Object.assign(new Owner(undefined, {}), {
        mounted: false, measurementKey: 8, raisedAppearanceEpoch:0, identity:1, navigationGeneration:2, mounting:3,
        mode: 'idle', animateOnAppear: false, searchMounted: false, headerRaisedShape:undefined,
        model:{bindInputBack:()=>()=>{},bindInputFocusReady:()=>()=>{}},
        transitionKind: 'none', toResults: 0,
        scheme: 'night', spec: { panelRadius: 18, borderWidth: 1 },
        headerVeil: () => true, historyFraction: 0, historyProgress() { return this.historyFraction; },
        historyViewportHeight: () => 100, horizontalInset: () => 16,
        cardContentWidth: () => 1168 / 3.5 - 2, barHeight: () => 52,
        retargetHistoryViewport() {}, historyLimitTrack: { set() {} }, historyLimit: () => 1, snapToMode() {},
      });
      const render = () => {
        panels.length = 0; clips.length = 0; owner.observers.length = 0; owner.children.clear(); owner.header();
        const material=panels.find(panel=>panel.onAreaChange);
        return { material, measure: material?.onAreaChange, children:[...owner.children.values()] };
      };
      owner.aboutToAppear();
      assert.equal(owner.headerRaisedShape,undefined,'mount clears prior measured geometry');
      const first = render();
      assert.equal(typeof first.measure, 'function', 'painted panel must expose its measurement callback');
      assert.equal(first.children.length,0,'header material does not mount an independent phone shadow painter');
      first.measure({}, { width: 1168 / 3.5, height: 188 / 3.5 });
      const measured = render();
      assert.deepEqual([owner.headerRaisedShape.width,owner.headerRaisedShape.height], [1168 / 3.5,188 / 3.5],
        'accepted shape uses the actual fractional-density Native border box');
      assert.notEqual(owner.headerRaisedShape.height,owner.barHeight()+2*owner.spec.borderWidth,'snapped Native border is not guessed from logical border widths');
      assert.equal(measured.material.borderRadius,owner.headerRaisedShape.radius,'Native material uses the measured effective radius');
      assert.equal(measured.material.clip,false,'Native material leaves its shadow outside the content clip');
      assert.ok(clips.includes(true),'header content owns its rounded clip');
      assert.deepEqual(measured.material.shadow,elevation('raised','night'),'Native material owns the shared raised elevation');
      assert.equal(measured.material.shadow.fill,false,'Native shadow does not fill the material interior');
      owner.searchMounted=true;owner.historyFraction=.5;
      const expandedMeasure=owner.headerSurfaceAreaChange();expandedMeasure({}, {width:1168/3.5,height:300});
      assert.equal(owner.headerRaisedShape.height,188/3.5,'expanded history cannot overwrite the accepted collapsed box');
      assert.equal(owner.hasHeaderSurfaceMeasurement(),false,'expanded history cannot claim a collapsed measurement');
      owner.historyFraction=.005;assert.equal(owner.hasHeaderSurfaceMeasurement(),false,'partial history is not strictly collapsed');
      owner.historyFraction=0;assert.equal(owner.hasHeaderSurfaceMeasurement(),true,'strict collapse retains its confirmed box');
      expandedMeasure({}, {width:1168/3.5,height:300});assert.equal(owner.headerRaisedShape.height,188/3.5,'queued expanded sample stays rejected after collapse');
      owner.searchMounted=false;metrics.windowRect.width=390;
      assert.equal(render().material.borderRadius,owner.headerRaisedShape.radius,'same-box input changes retain adopted geometry until a new Native sample');
      measured.measure({}, {width:358,height:20});assert.equal(owner.headerRaisedShape.width,1168/3.5,'old width callback cannot replace adopted geometry');
      render().measure({}, {width:358,height:20});
      assert.deepEqual([owner.headerRaisedShape.width,owner.headerRaisedShape.height],[358,20],'fresh available-width measurement replaces both axes');
      assert.equal(render().material.borderRadius,10,'measured short border-box clamps the actual Native radius');
      owner.barHeight=()=>70;const retained=owner.headerRaisedShape;
      const beforeDensity=render().measure;metrics.densityPixels=2;
      beforeDensity({}, {width:358,height:72});assert.equal(owner.headerRaisedShape,retained,'old density sample cannot overwrite current adopted box');
      render().measure({}, {width:'358vp',height:'71vp'});
      assert.deepEqual([owner.headerRaisedShape.width,owner.headerRaisedShape.height],[358,71],'current numeric/vp sample updates both axes');
      const oldKeyMeasure=render().measure;owner.measurementKey++;oldKeyMeasure({}, {width:300,height:10});
      assert.equal(owner.headerRaisedShape.height,71,'old layout callback is rejected');
      const current=render();current.measure({}, {width:NaN,height:71});assert.equal(owner.headerRaisedShape,undefined,'invalid current geometry clears the accepted shape');
      current.measure({}, {width:358,height:71});const last=owner.headerRaisedShape;owner.aboutToDisappear();
      current.measure({}, {width:20,height:20});assert.equal(owner.headerRaisedShape,last,'unmounted callback cannot mutate geometry');
    }
    checkMeasured(header);
    for(const[name,before,after,expected]of [
      ['missing measurement','.onAreaChange(this.headerSurfaceAreaChange())','',/painted panel must expose/],
      ['unclamped radius','.borderRadius(this.headerMaterialRadius())','.borderRadius(this.spec.panelRadius)',/short border-box clamps/],
      ['disabled clip','.borderRadius(Math.max(0, this.headerMaterialRadius() - this.spec.borderWidth)).clip(true)',
        '.borderRadius(Math.max(0, this.headerMaterialRadius() - this.spec.borderWidth)).clip(false)',/owns its rounded clip/],
      ['detached Native shadow','.shadow(this.headerStackShadow())','',/owns the shared raised elevation/],
    ]){
      assert.equal(header.split(before).length-1,1,`${name}: exact negative injection`);
      assert.throws(()=>checkMeasured(header.replace(before,after)),expected,`${name} is rejected`);
    }
    const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { readerFoundationTokens } = await import('./lib/reader-tokens-probe.mjs');
    const { APP_FLOATING_HEADER_BAR_HEIGHT, APP_FLOATING_HEADER_TOP_GAP } = await import('../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts');
    const headerSpecSource = readFileSync(new URL('../entry/src/main/ets/ui/foundation/ReaderHeaderSpecs.ets', import.meta.url), 'utf8');
    const { bookshelfHeaderSpec } = pureModuleProbe(headerSpecSource, 'ReaderHeaderSpecs.ets', {
      TOK_BORDER_W: readerFoundationTokens.TOK_BORDER_W, APP_FLOATING_HEADER_BAR_HEIGHT, APP_FLOATING_HEADER_TOP_GAP,
    }, ['bookshelfHeaderSpec']);
    const searchModelSource = readFileSync(new URL('../entry/src/main/ets/features/search/presentation/ReaderLibrarySearchModel.ets', import.meta.url), 'utf8');
    const { READER_LIBRARY_SEARCH_BACK_FOCUS_ID } = pureModuleProbe(searchModelSource, 'ReaderLibrarySearchModel.ets',
      { Observed: value => value }, ['READER_LIBRARY_SEARCH_BACK_FOCUS_ID']);
    const searchField = readFileSync(new URL('../entry/src/main/ets/ui/controls/ReaderSearchField.ets', import.meta.url), 'utf8');
    class SearchField {}
    const bar = createReaderBuilderProbe(surfaceTree.getFullText(), ['bar', 'headerActionGlyph', 'headerActionFrame',
      'headerActionTop', 'moreInteractive', 'leadingAction', 'moreAction', 'presentedSearch', 'blend'],
      { bookshelfHeaderSpec, READER_LIBRARY_SEARCH_BACK_FOCUS_ID,
        ReaderSearchField: SearchField, READER_FONT_NOTO_SANS_SC_UI_BOLD: 'ReaderNotoSansSCUIBold' },
      { childSources: { ReaderSearchField: searchField } }).owner;
    const actions = [];
    Object.assign(bar, { mounted: true, mode: 'idle', transitionKind: 'none', scheme: 'day', identity: 7, navigationGeneration: 9, mounting: 11,
      searchMounted: false, model: {panelOwnsInput: false},
      moreIdentity: 'shelf', cardContentWidth: () => 280, barHeight: () => 52, titleOpacity: () => 1,
      surfaceValue() { return this.mode === 'idle' ? 0 : .5; },
      onOpen: (...args) => actions.push(['open', ...args]), onBack: (...args) => actions.push(['back', ...args]),
      onMore: (...args) => actions.push(['more', ...args]) });
    bar.bar();
    const physical = [...bar.nodes.values()];
    const more = physical.find(node => node.accessibilityText === '更多');
    const leading = physical.find(node => node.accessibilityText === '搜索书籍');
    const observerKey = actor => {
      const entries = [...bar.nodes].filter(([, node]) => node === actor);
      assert.equal(entries.length, 1, 'each actual native actor has one physical observer key');
      return entries[0][0];
    };
    const moreElement = observerKey(more);
    const leadingElement = observerKey(leading);
    assert.deepEqual([more.id, leading.id], ['shelf', 'reader-bookshelf-search-entry'],
      'Native focus IDs stay separate from physical observer identity');
    assert.deepEqual([more.type, leading.type], ['Button', 'Button']);
    for (const actor of [more, leading]) {
      assert.deepEqual(actor.createWithChild, {type:'ButtonType.Normal', stateEffect:false},
        'the retained header actor is an explicit Normal Native Button');
      assert.equal(actor.focusable, undefined, 'Native Button keeps its platform focus default without an application override');
      assert.equal(actor.enabled, true, 'admitted header action keeps native enabled semantics');
    }
    assert.deepEqual([more.accessibilityRole, leading.accessibilityRole], Array(2).fill('AccessibilityRoleType.BUTTON'));
    assert.deepEqual([more.width, more.height, more.borderRadius, more.position, more.focusable, more.hitTestBehavior],
      [44, 44, 14, { x: 231, y: 4 }, undefined, 'HitTestMode.Default']);
    assert.deepEqual([leading.width, leading.height, leading.borderRadius, leading.position, leading.focusable],
      [44, 44, 14, { x: 4, y: 4 }, undefined]);
    const icons = physical.filter(node => node.type === 'Image');
    const iconElements = icons.map(observerKey);
    assert.deepEqual(icons.map(node => [node.create, node.width, node.height]),
      [['app.media.rc_dots', 22, 22], ['app.media.bookshelf_search', 22, 22]]);
    more.onClick(); leading.onClick();
    bar.mode = 'input'; bar.scheme = 'night'; bar.identity = 8;
    bar.replayOnly([moreElement, leadingElement, ...iconElements]);
    assert.equal(bar.nodes.get(moreElement), more, 'the original More actor stays mounted through the transition');
    assert.deepEqual(iconElements.map(element => bar.nodes.get(element)), icons,
      'the same physical icon actors receive the retained native attribute updates');
    assert.equal(more.id, 'shelf', 'More keeps the actual production Native focus ID');
    assert.equal(bar.nodes.get(leadingElement), leading, 'Search becomes Back on the same native actor');
    assert.equal(leading.id, READER_LIBRARY_SEARCH_BACK_FOCUS_ID);
    assert.deepEqual([more.enabled, more.focusable, more.hitTestBehavior, more.opacity, more.accessibilityLevel],
      [false, undefined, 'HitTestMode.None', .5, 'no-hide-descendants']);
    assert.deepEqual([leading.accessibilityText, leading.enabled, leading.focusable, icons[1].create],
      ['返回', true, undefined, 'app.media.book_detail_back_theme_night']);
    leading.onClick();
    bar.transitionKind = 'back'; leading.onClick();
    bar.transitionKind = 'none'; bar.model.panelOwnsInput = true;
    bar.replayOnly([leadingElement]);
    assert.deepEqual([leading.enabled, leading.focusable, leading.accessibilityLevel], [false, undefined, 'no-hide-descendants']);
    leading.onClick();
    assert.deepEqual(actions, [['more', 7, 9, 11, 'shelf'], ['open', 7, 9, 11], ['back', 8, 9, 11]]);
    recordContractCasePass(id);
    continue;
  }
  const source = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
  const tree = parse(source);
  const index = tree.statements.find(node => node.name?.text === 'Index');
  const { createLibraryShelfChromeProbe } = await import('./lib/bookshelf-projection-owner-probe.mjs');
  const { bookshelfOperationClass } = await import('./lib/bookshelf-operation-owner-probe.mjs');
  const LibraryJourney = bookshelfOperationClass('app/composition/ReaderLibraryJourney.ets', 'ReaderLibraryJourney');
  const ReaderNavigation = bookshelfOperationClass('app/navigation/ReaderNavigation.ts', 'ReaderNavigation');
  const names = ['librarySearchSurface', 'libraryJourneyPorts', 'bookshelfContentAcceptsInput', 'bookshelfModalVisible'];
  const methods = names.map(name => index.members.find(node => node.name?.getText(tree) === name).getText(tree)).join('\n');
  const childTree = parse(readFileSync(new URL('../entry/src/main/ets/features/search/ui/ReaderLibrarySearchSurface.ets', import.meta.url), 'utf8'));
  const child = childTree.statements.find(node => node.name?.text === 'ReaderLibrarySearchSurface');
  const fields = child.members.filter(ts.isPropertyDeclaration);
  const childName = child.name.text;
  syntax.componentCollection.customComponents.add(childName);
  syntax.propertyCollection.set(childName, new Set(fields.map(node => node.name.getText(childTree))));
  syntax.regularCollection.set(childName, new Set(fields.filter(node => ts.getAllDecorators(node).length === 0)
    .map(node => node.name.getText(childTree))));
  for (const [decorator, collection] of [['BuilderParam', syntax.builderParamObjectCollection],
    ['Prop', syntax.propCollection], ['ObjectLink', syntax.objectLinkCollection]]) {
    collection.set(childName, new Set(fields.filter(node => ts.getAllDecorators(node).some(tag =>
      tag.expression.getText(childTree) === decorator)).map(node => node.name.getText(childTree))));
  }
  componentMap.CUSTOM_BUILDER_METHOD.add('librarySearchSurface');
  componentMap.CUSTOM_BUILDER_METHOD.add('librarySearchResults');
  main.partialUpdateConfig.partialUpdateMode = true;

  class View {
    constructor() { this.observers = []; this.children = new Map(); }
    finalizeConstruction() {}
    observeComponentCreation2(callback) {
      const element = this.observers.length + 1;
      this.observers.push([element, callback]); callback(element, true);
    }
    updateStateVarsOfChildByElmtId(element, params) { Object.assign(this.children.get(element).params, params); }
    replay() { for (const [element, callback] of [...this.observers]) callback(element, false); }
    static create() {}
  }
  class Surface {
    constructor(parent, params, storage, element) { this.params = params; parent.children.set(element, this); }
  }
  function compile(body) {
    const fixture = parse(`@Component struct SearchSurfaceBindingProbe { ${body}\nbuild() { Column() {} } }`);
    utils.storedFileInfo.setCurrentArkTsFile();
    ui.transformLog.sourceFile = fixture;
    const diagnostics = [];
    let emittedNode;
    const transformed = ts.transform(fixture, [context => file => {
      ui.contextGlobal = context;
      emittedNode = compiler.processComponentClass(file.statements[0], context, diagnostics, false);
      return file;
    }]);
    transformed.dispose();
    assert.deepEqual(diagnostics, [], 'actual persistent surface Builder lowers without diagnostics');
    const emitted = ts.createPrinter().printNode(ts.EmitHint.Unspecified, emittedNode, fixture);
    const commonCalls = [];
    const Owner = new Function('ViewPU', 'ReaderLibrarySearchSurface', '__Common__', 'HitTestMode',
      `${stripTypeScriptTypes(emitted)}; return SearchSurfaceBindingProbe;`)(View, Surface,
      { create() { commonCalls.push({}); }, enabled(value) { commonCalls.at(-1).enabled=value; },
        hitTestBehavior(value) { commonCalls.at(-1).hitTestBehavior=value; }, accessibilityLevel() {}, pop() {} },
      { Transparent: 'HitTestMode.Transparent', None: 'HitTestMode.None' });
    Owner.commonCalls = commonCalls;
    return Owner;
  }
  function fixture(Owner, oldParameters = false) {
    const runtime = {}, librarySearch = createLibraryShelfChromeProbe(), host = librarySearch.host;
    const more = [];
    librarySearch.identity = 5;
    librarySearch.bindShelfMore('more-a', 8, 4, () => more.push('more-a'));
    const owner = Object.assign(new Owner(undefined, {}), {
      navigationOwner: new ReaderNavigation(), route: 'bookshelf', mountedRuntimeOwner: runtime, rssInstanceIdentity: 1,
      navigationGeneration: 8, detailShelfAdmissionMount: 4, librarySearch,
      searchAppForeground: true, arkWebCapturesInput: false, readingEntry: { sessionActive: false },
      readingEntryActions: { shelfPreparing: false },
      sourceSwitchPresentation: { isSurfacePresented: () => false }, mangaSourceSwitch: { selectionVisible: false },
      shelfMutations: { snapshot: {} }, shelfGroupPresentation: { identity: '' },
      shelfReceiptRetired: false, settingsPresentation: { snapshot: { reduceMotion: false } },
      shelfRead: { snapshot: { visualAdmitted: true } },
      isCurrentRuntime: candidate => candidate === runtime, expandedLayout: () => false,
      backCount: 0, onBackPress() { this.backCount++; }, librarySearchResults() {},
    });
    owner.libraryAcquisition = { currentOwner: () => owner.mountedRuntimeOwner };
    owner.libraryJourney = new LibraryJourney(owner.navigationOwner, owner.libraryJourneyPorts());
    move(owner, 'bookshelf', 8, 4);
    if (oldParameters) owner.librarySearchSurface(8, runtime, 4, host, 5, 'more-a');
    else owner.librarySearchSurface(runtime, host);
    const child = [...owner.children.values()][0];
    return { owner, child, runtime, host, more };
  }
  function move(owner, route, generation = owner.navigationGeneration, mounting = owner.detailShelfAdmissionMount) {
    while (owner.navigationOwner.snapshot().generation < generation) owner.navigationOwner.advance();
    const snapshot = owner.navigationOwner.show(route);
    Object.assign(owner, { route: snapshot.route, navigationGeneration: snapshot.generation, detailShelfAdmissionMount: mounting });
  }
  if (id === 'common-hit-test') {
    function checkCommon(Owner) {
      const value = fixture(Owner);
      assert.equal(Owner.commonCalls.at(-1).enabled, true);
      for (const route of ['bookshelf','search','settings']) {
        move(value.owner, route); value.owner.replay();
        assert.equal(Owner.commonCalls.at(-1).enabled, route==='bookshelf'||route==='search');
        assert.equal(Owner.commonCalls.at(-1).hitTestBehavior, route === 'settings' ? 'HitTestMode.None' : 'HitTestMode.Transparent',
          'the generated Common host must stay transparent when active and ignore input when inactive');
      }
      assert.equal(value.owner.children.size, 1, 'route updates retain the same search actor');
    }
    checkCommon(compile(methods));
    const withoutHitTest=methods.replace(/^\s*\.hitTestBehavior\([^\n]+\)/m, '');
    assert.notEqual(withoutHitTest,methods,'negative control removes only the explicit Common hit-test policy');
    assert.throws(()=>checkCommon(compile(withoutHitTest)),/generated Common host/,
      'the installed regression has an implicit Default Common host and is rejected');
    recordContractCasePass(id);
    continue;
  }
  const live = fixture(compile(methods));
  const callbacks = live.child.params;
  callbacks.onMore(5, 8, 4, 'more-a');
  assert.deepEqual(live.more, ['more-a']);
  live.owner.shelfMutations.snapshot.importPresentation = {};
  callbacks.onMore(5, 8, 4, 'more-a');
  assert.deepEqual(live.more, ['more-a'], 'a foreground import rejects the retained shelf trigger');
  live.owner.shelfMutations.snapshot.importPresentation = undefined;
  move(live.owner, 'search', 9, 5);
  Object.assign(live.owner.librarySearch, { identity: 6, mode: 'input' });
  live.owner.librarySearch.bindShelfMore('more-b', 9, 5, () => live.more.push('more-b'));
  live.owner.replay();
  assert.deepEqual([callbacks.identity, callbacks.navigationGeneration, callbacks.mounting, callbacks.moreIdentity],
    [6, 9, 5, 'more-b'], 'one mounted child receives the current primitive identities');
  callbacks.onBack(5, 8, 4);
  assert.equal(live.owner.backCount, 0, 'old presented event cannot act');
  callbacks.onBack(6, 9, 5);
  assert.equal(live.owner.backCount, 1, 'retained callback accepts current event with original runtime/host');
  callbacks.onHistoryCoverageChanged(true, 6, 9, 5);
  assert.equal(live.owner.librarySearch.continueCardSuppressed(9, 5), true);
  assert.equal(live.owner.librarySearch.continueCardSuppressed(10, 5), false);
  assert.equal(live.owner.librarySearch.continueCardSuppressed(9, 6), false);
  live.owner.librarySearch.identity = 7;
  callbacks.onHistoryCoverageChanged(true, 6, 9, 5);
  assert.equal(live.owner.librarySearch.continueCardSuppressed(9, 5), false, 'old search coverage cannot survive a new identity');
  callbacks.onHistoryCoverageChanged(true, 7, 9, 5);
  assert.equal(live.owner.librarySearch.continueCardSuppressed(9, 5), true, 'current coverage can be admitted on the retained actor');
  live.owner.librarySearch.identity = 6;
  live.owner.mountedRuntimeOwner = {};
  callbacks.onBack(6, 9, 5);
  assert.equal(live.owner.backCount, 1, 'old callback cannot switch to a replacement runtime');
  live.owner.mountedRuntimeOwner = live.runtime;
  live.owner.librarySearch.host = {};
  callbacks.onBack(6, 9, 5);
  assert.equal(live.owner.backCount, 1, 'old callback cannot switch to a replacement search host');

  const previous = methods
    .replace('librarySearchSurface(owner: ReaderRuntimeOwner | undefined, host: SearchHost,',
      'librarySearchSurface(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number, host: SearchHost, identity: number, moreIdentity: string,')
    .replace('identity: this.librarySearch.identity,', 'identity,')
    .replace('navigationGeneration: this.navigationGeneration, mounting: this.detailShelfAdmissionMount,',
      'navigationGeneration: generation, mounting,')
    .replace('moreIdentity: this.librarySearch.shelfMoreIdentity(this.navigationGeneration, this.detailShelfAdmissionMount),', 'moreIdentity,');
  assert.notEqual(previous, methods, 'negative control reinstates the old captured parameters');
  const old = fixture(compile(previous), true);
  move(old.owner, 'bookshelf', 9, 5);
  old.owner.librarySearch.bindShelfMore('more-b', 9, 5, () => old.more.push('more-b'));
  old.owner.librarySearch.identity = 6;
  old.owner.replay();
  assert.deepEqual([old.child.params.identity, old.child.params.navigationGeneration,
    old.child.params.mounting, old.child.params.moreIdentity], [5, 8, 4, 'more-a'],
    'actual old SDK update closure reproduces frozen identities');
  recordContractCasePass(id);
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'short-grid-prefix': {
    description: 'Actual short manga semantic Grid consumes the current native prefix, maps native/Core indices and spans independently, and bounds current-row positioning by its actual viewport.',
    resources: [],
  },
  'short-fallback-insets': {
    description: 'Actual SDK short manga fallback materializes scrollable insets, preserves chapter target indices and signed chrome offsets, and separates summary drag from toolbar actions.',
    resources: [],
  },
  'busy-catalog': {
    description: 'Actual pending manga selection reaches SDK target catalog row eligibility, coalesces repeated selection and preserves current Back cancellation. Finite pending progress RPC, no commit or network.',
    resources: [],
  },
});

for (const id of selected) {
  if (id === 'short-grid-prefix') {
    await shortGridPrefix();
    recordContractCasePass(id);
    continue;
  }
  if (id === 'short-fallback-insets') {
    await shortFallbackInsets();
    recordContractCasePass(id);
    continue;
  }
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
        return next(specifier + '.ts', context);
      throw error;
    }
  } });
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { MangaSourceSwitchGateway, MangaSwitchChapterSelectionRequired } = await import('../entry/src/main/ets/features/manga/application/MangaSourceSwitchGateway.ts');
  const { ReaderDirectoryDataPublication } = await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts');
  const { readerEditingSdk } = await import('./lib/reader-editing-sdk-probe.mjs');
  const { ReaderEditingScrollBinding } = readerEditingSdk();
  const { MANGA_DIRECTORY_VISUAL } = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');
  const read = file => readFileSync(new URL('../entry/src/main/ets/' + file, import.meta.url), 'utf8');
  const surfacesSource = read('app/composition/ReaderSourceSwitchSurfaces.ets');
  const pageSource = read('features/reading/ui/BookDirectoryPage.ets');
  const navigationSource = read('features/reading/ui/ReaderDirectoryNavigationSurface.ets');
  const rowSource = read('features/manga/ui/MangaDirectoryEntryRow.ets');
  const syntax = createRequire(import.meta.url)(installedEtsCompiler().root + '/lib/validate_ui_syntax.js');
  for (const name of ['MangaSourceSwitchPresentation', 'ReadingEntryPresentation', 'SourceSwitchPresentation'])
    syntax.observedClassCollection.add(name);
  const { MangaSourceSwitchPresentation } = selectedProductionClasses(
    new URL('../entry/src/main/ets/features/manga/presentation/MangaSourceSwitchPresentation.ets', import.meta.url),
    ['MangaSourceSwitchPresentation'], { MangaSourceSwitchGateway, MangaSwitchChapterSelectionRequired });

  class Captured {
    constructor(owner, params, _storage, elementId) { Object.assign(this, { owner, params, id: elementId }); }
    updateStateVars(params) { Object.assign(this.params, params); }
  }
  function fixture(surfaceSource) {
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
    const observe = value => sdk.properties.sdk.ObservedObject.createNew(value, undefined);
    let resolveProgress;
    const progress = new Promise(resolve => { resolveProgress = resolve; });
    const requests = [];
    const runtime = { request(method, params) {
      assert.equal(method, 'reading.progress.get');
      requests.push({ method, params });
      return progress;
    } };
    const original = { sourceId: 'original', bookId: 'book', title: '原漫画' };
    const source = observe({ visible: true, state: { kind: 'candidates', candidates: [] } });
    const manga = observe(new MangaSourceSwitchPresentation({
      scene: () => ({ book: original, owner: runtime }), source: () => source,
    }));
    const target = { contentKind: 'manga', identity: { sourceId: 'target', bookId: 'candidate' },
      book: { title: '目标漫画' }, entries: [{ index: 0, title: '目标章节', url: '/chapter', navigable: true }] };
    const candidate = { sourceId: 'target', bookUrl: 'candidate' };
    const selection = new MangaSwitchChapterSelectionRequired('original', 'book', target,
      { epoch: 1, revision: 1 }, '旧章节', 'missing');
    manga.presentMangaSourceSwitchSelection(original, candidate, selection, () => true, () => {});
    const hooks = { ...sdk.hooks, initialParams: { manga, source, reading: observe({ book: original }) },
      childSources: { BookDirectoryPage: pageSource, SourceSwitchPanel: read('features/source/ui/SourceSwitchPanel.ets') } };
    const surfaces = createReaderBuilderProbe(surfaceSource, ['build', 'manga', 'reading', 'source', 'interactive', 'reduceMotion'], {
      ...sdk.deps, SynchedPropertyNesedObjectPU: sdk.properties.sdk.SynchedPropertyNestedObjectPU,
      BookDirectoryPage: Captured, SourceSwitchPanel: Captured,
    }, hooks).owner;
    Object.assign(surfaces, { interactive: true });
    surfaces.initialRender();
    return { sdk, manga, source, original, requests, surfaces, resolveProgress,
      child: () => [...surfaces.children.values()].find(child => child instanceof Captured) };
  }

  const current = fixture(surfacesSource);
  const child = current.child();
  assert.equal(child.params.currentChapterIndex, -1);
  assert.equal(child.params.currentPageOrdinal, -1);
  assert.equal(child.params.currentPageTotal, -1);
  assert.equal(child.params.mangaDownloadEnabled, undefined);
  assert.equal(child.params.selectionBusy ?? false, false);
  const pending = current.manga.selectMangaSourceSwitchChapter(0);
  assert.equal(current.requests.length, 1);
  current.sdk.properties.flush();
  assert.equal(current.child(), child, 'busy keeps the current target page actor');
  assert.equal(child.params.selectionBusy, true, 'current pending selection must reach the target catalog');
  child.params.onSelectChapter(0);
  child.params.onSelectNavigationTarget(0, 0);
  assert.equal(current.requests.length, 1, 'actual busy owner coalesces both target callbacks');

  const pageSdk = boundedSurfaceSdk();
  const page = createReaderBuilderProbe(pageSource,
    ['mangaContent', 'mangaFlatRow', 'mangaHeader', 'directoryInputIsCurrent', 'identity',
      'sourceId', 'bookId', 'interactive', 'selectionBusy', 'isOpeningCurrent'], {
      ...pageSdk.deps, visual: MANGA_DIRECTORY_VISUAL, EdgeEffect: { Spring: 'spring' },
      ReaderDirectoryNavigationSurface: Captured, MangaDirectoryEntryRow: Captured, PageBackBar: Captured,
    }, { ...pageSdk.hooks, initialParams: child.params,
      childSources: { ReaderDirectoryNavigationSurface: navigationSource, MangaDirectoryEntryRow: rowSource,
        PageBackBar: read('ui/chrome/PageBackBar.ets') } }).owner;
  const forwarded = [];
  Object.assign(page, { mounted: true, admittedIdentity: page.identity(), admittedEntries: child.params.entries, viewportWidth: 366,
    geometry: { content: { frame: { left: 0, right: 0, width: 366 } } },
    directoryPublication: new ReaderDirectoryDataPublication(),
    editingScroll: new ReaderEditingScrollBinding(),
    mangaVisibleTopInset: () => 0, mangaNarrow: () => false, directoryScrollLayout: () => ({}),
    mangaToolbar() {}, mangaFlowFooter: () => false, mangaHeaderTrailingSlot() {}, consumeTemporaryBack: () => false,
    mangaLayoutRow: entry => ({ kind: 'row', columns: 1, entries: [entry], labels: [] }),
    mangaEntryIsDisplayed: () => true, rowIsCurrent: () => true,
    onSelectNavigationTarget: () => forwarded.push('semantic'), selectMangaEntry: () => forwarded.push('flat'),
    onBack: child.params.onBack,
  });
  page.mangaContent();
  const navigation = [...page.children.values()].find(actor => actor.params.directoryPublication === page.directoryPublication);
  assert.ok(navigation, 'actual target catalog receives the current directory publication');
  assert.deepEqual(navigation.params.directoryPublication.entriesAt(navigation.params.directoryEntriesRevision)
    .map(({ index, title }) => [index, title]), [[0, '目标章节']]);
  assert.equal(navigation.params.interactionEnabled, false, 'semantic catalog native eligibility follows pending owner');
  const entry = { index: 0, title: '目标章节', navigable: true, downloadState: 'unknown' };
  page.mangaFlatRow(entry, page.identity());
  const flat = [...page.children.values()].find(actor => actor.params.row !== undefined);
  assert.equal(flat.params.interactionEnabled, false, 'flat catalog native eligibility follows pending owner');
  page.navigationActive = true;
  navigation.params.onSelectTarget(0, 0);
  page.navigationActive = false;
  flat.params.onSelectEntry(entry);
  assert.deepEqual(forwarded, [], 'retained semantic and flat callbacks reject current busy');
  page.updateStateVars({ ...child.params, selectionBusy: false });
  pageSdk.properties.flush();
  assert.equal(navigation.params.interactionEnabled, true);
  assert.equal(flat.params.interactionEnabled, true);
  page.navigationActive = true;
  navigation.params.onSelectTarget(0, 0);
  page.navigationActive = false;
  flat.params.onSelectEntry(entry);
  assert.deepEqual(forwarded, ['semantic', 'flat']);
  page.updateStateVars({ ...child.params, selectionBusy: true });
  pageSdk.properties.flush();
  assert.equal(navigation.params.interactionEnabled, false);
  assert.equal(flat.params.interactionEnabled, false);
  page.mangaHeader();
  const header = [...page.children.values()].find(actor => actor.params.title === '章节目录');
  header.params.onBack();
  assert.equal(current.manga.selectionVisible, false, 'Back remains available before commit starts');
  assert.equal(current.source.state.kind, 'candidates');
  assert.equal(current.source.state.candidates.length, 1);
  assert.equal(current.requests.length, 1);
  current.resolveProgress({ data: {} });
  await pending;
  assert.equal(current.manga.selectionBusy, false);
  assert.equal(current.original.sourceId, 'original');
  assert.equal(current.original.bookId, 'book');
  const legacySource = surfacesSource.replace('selectionBusy: this.manga.directorySelectionBusy(this.manga.selection),', '');
  assert.notEqual(legacySource, surfacesSource);
  const legacy = fixture(legacySource);
  const legacyPending = legacy.manga.selectMangaSourceSwitchChapter(0);
  legacy.sdk.properties.flush();
  assert.throws(() => assert.equal(legacy.child().params.selectionBusy, true), assert.AssertionError,
    'the historical missing busy projection fails independently of callback coalescing');
  legacy.child().params.onBack();
  legacy.resolveProgress({ data: {} });
  await legacyPending;
  console.log('PASS exact source-switch SDK target inputs, pending native eligibility and actual owner coalescing/Back. Native dispatch, imagery and commit remain separate.');
  recordContractCasePass(id);
}

async function shortFallbackInsets() {
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
  const snapshot = await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts');
  const scrollLayout = await import('../entry/src/main/ets/ui/layout/ReaderScrollLayout.ts');
  const fonts = await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
  const { MANGA_DIRECTORY_VISUAL: visual } = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');
  const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
  const pageSource = read('features/reading/ui/BookDirectoryPage.ets');
  const listSource = read('features/reading/ui/ReaderDirectoryList.ets');
  const { DirectoryListDataSource } = selectedProductionClasses(
    new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryList.ets', import.meta.url),
    ['DirectoryListDataSource'], snapshot);
  class Captured {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
    updateStateVars(params) { this.params = params; }
  }
  function check(candidate = pageSource, listCandidate = listSource) {
    for (const flowing of [true, false]) {
      const sdk = boundedSurfaceSdk();
      const start = flowing ? 360 : 280, end = 18, moves = [], offsets = [];
      const page = createReaderBuilderProbe(candidate,
        ['mangaContent', 'mangaFlatList', 'mangaFlatPrefix', 'mangaToolbar', 'scrollMangaCurrent', 'mangaHeightHandler'], {
          ...sdk.deps, ...fonts, visual, ReaderDirectoryList: Captured,
          ReaderDirectoryToolbar: Captured, MangaDirectoryCurrentFooter: Captured, ReaderDirectoryNavigationSurface: Captured,
          ScrollAlign: { START: 'start' }, LengthMetrics: { vp: value => value },
        }, { ...sdk.hooks, childSources: {
          ReaderDirectoryList: listCandidate, ReaderDirectoryToolbar: read('features/reading/ui/ReaderDirectoryToolbar.ets'),
          MangaDirectoryCurrentFooter: read('features/manga/ui/MangaDirectoryCurrentFooter.ets'),
          ReaderDirectoryNavigationSurface: read('features/reading/ui/ReaderDirectoryNavigationSurface.ets'),
        } }).owner;
      Object.assign(page, {
        geometry: { content: { frame: { left: 18, right: 18, width: 330 }, startInset: start, endInset: end } },
        listScroller: { scrollToIndex: (...args) => moves.push(args) },
        mangaFlowFooter: () => flowing, mangaContentTopInset: () => start, mangaVisibleTopInset: () => 80,
        mangaLayoutEntries: () => [], directoryListIsCurrent: () => true, mangaScrollOffset: 0,
        onMangaScrollOffset: value => offsets.push(value), appThemeScheme: 'day', bookTitle: '长标题',
        mangaToolsHeight: 250, toolsMeasurement: { id: 'toolbar', mount() {}, unmount() {} },
        flowToolsMeasurement: { id: 'flow-toolbar', mount() {}, unmount() {} },
        admittedIdentity: 'current', admittedEntries: [], interactive: true, viewportWidth: 366, navigationActive: false,
        mangaNarrow: () => true, directoryScrollLayout: () => new scrollLayout.ReaderScrollLayout(start, end, 'contentOffset'),
        mangaFontScale: () => 1, mangaSummaryLabel: () => '60 个条目', searchDraft: '', ascending: true,
        mangaFooterBottomOffset: () => 8, mangaCurrentFooter() {},
      });
      page.mangaContent();
      page.mangaFlatList('current');
      const child = [...page.children.values()].find(value => value.params?.naturalRowHeight === true);
      assert.equal(child.params.materializedInsets, flowing, 'short viewport uses actual scroll content');
      const list = createReaderBuilderProbe(listCandidate, boundedMembers(listCandidate), {
        ...sdk.deps, ...scrollLayout, DirectoryListDataSource,
        ChildrenMainSize: class { constructor(size) { this.childDefaultSize = size; } },
        ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
      }, { ...sdk.hooks, initialParams: child.params }).owner;
      list.initialRender();
      const viewport = [...list.nodes.values()].find(node => node.type === 'List');
      assert.equal(viewport.contentStartOffset, flowing ? 0 : start);
      assert.equal(viewport.contentEndOffset, flowing ? 0 : end);
      const spacers = [...list.nodes.values()].filter(node => node.type === 'ListItem' && typeof node.height === 'number');
      assert.deepEqual(spacers.map(node => node.height), flowing ? [start, end] : []);
      if (flowing) {
        spacers[0].create[0](spacers[0].id, true);
        const inline = [...page.nodes.values()].find(node => node.id === 'flow-toolbar');
        assert.ok(inline, 'actual native prefix callback mounts the original toolbar in scroll content');
        assert.equal(inline.position, undefined);
        assert.equal(inline.hitTestBehavior, 'HitTestMode.Default');
        assert.ok([...page.nodes.values()].some(node => node.type === 'Blank' && node.height === start - 250));
      }
      child.params.onScrollOffset(flowing ? 0 : -start);
      child.params.onScrollOffset(flowing ? 93 : -start + 93);
      child.params.onScrollOffset(flowing ? -7 : -start - 7);
      assert.deepEqual(offsets, [0, 93, -7], 'native content origin preserves signed displacement');
      page.scrollMangaCurrent(4, 12);
      assert.deepEqual(moves, [[flowing ? 5 : 4, false, 'start', { extraOffset: (flowing ? 0 : start) - 92 }]],
        'canonical chapter index and painted header clearance reach the current native List');
      const overlay = [...page.nodes.values()].find(node => node.id === 'toolbar');
      if (flowing) assert.equal(overlay, undefined, 'short flat prefix has one actual toolbar producer');
      else assert.equal(overlay.hitTestBehavior, 'HitTestMode.Transparent');
      const toolbar = [...page.nodes.values()].find(node => node.type === '__Common__' &&
        node.hitTestBehavior === 'HitTestMode.BLOCK_HIERARCHY');
      assert.equal(toolbar !== undefined, !flowing,
        'overlay actions stop lower siblings, inline actions keep their native List ancestor');
    }
  }
  check();
  for (const [label, page, list] of [
    ['native short offsets', pageSource.replace('materializedInsets: this.mangaFlowFooter(),', ''), listSource],
    ['chapter prefix index', pageSource.replace('index + (flowing ? 1 : 0)', 'index'), listSource],
    ['short content origin', pageSource.replace('offset + (this.mangaFlowFooter() ? 0 : this.mangaContentTopInset())', 'offset + this.mangaContentTopInset()'), listSource],
    ['summary hit boundary', pageSource.replace('inline ? HitTestMode.Default : HitTestMode.Transparent', 'HitTestMode.Default'), listSource],
    ['toolbar action boundary', pageSource.replace('inline ? HitTestMode.Default : HitTestMode.BLOCK_HIERARCHY', 'HitTestMode.Default'), listSource],
    ['duplicate overlay', pageSource.replace('if (!this.mangaFlowFooter()) { this.mangaToolbar(identity); }', 'this.mangaToolbar(identity);'), listSource],
    ['missing inline producer', pageSource, listSource.replace('ListItem() { this.prefixBuilder(); }.width', 'ListItem() {}.width')],
    ['missing scroll spacers', pageSource, listSource.replaceAll('if (this.materializedInsets) {', 'if (false) {')],
  ]) {
    assert.ok(page !== pageSource || list !== listSource, label);
    assert.throws(() => check(page, list), assert.AssertionError, label);
  }
  console.log('PASS actual short/full SDK List content, canonical index, signed offsets and one inline/overlay toolbar producer with eight rejected regressions.');
}

async function shortGridPrefix() {
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { ReaderScrollLayout } = await import('../entry/src/main/ets/ui/layout/ReaderScrollLayout.ts');
  const { MANGA_DIRECTORY_VISUAL: visual } = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');
  const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
  const pageSource = read('features/reading/ui/BookDirectoryPage.ets');
  const listSource = read('features/reading/ui/ReaderDirectoryNavigationList.ets');
  const surfaceSource = read('features/reading/ui/ReaderDirectoryNavigationSurface.ets');
  class Captured {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
    updateStateVars(params) { this.params = params; }
  }
  for (const flowing of [true, false]) {
    const sdk = boundedSurfaceSdk(), overlays = [], prefixes = [];
    const page = createReaderBuilderProbe(pageSource, ['mangaContent'], {
      ...sdk.deps, visual, ReaderDirectoryNavigationSurface: Captured,
    }, { ...sdk.hooks, childSources: { ReaderDirectoryNavigationSurface: surfaceSource } }).owner;
    Object.assign(page, { admittedIdentity: 'current', admittedEntries: [], viewportWidth: 366,
      geometry: { content: { frame: { left: 18, right: 18, width: 330 }, startInset: 360 } },
      mangaFlowFooter: () => flowing, navigationActive: true, interactive: true,
      mangaVisibleTopInset: () => 98, mangaNarrow: () => true, directoryScrollLayout: () => new ReaderScrollLayout(360, 18, 'contentOffset'),
      mangaToolbar: () => overlays.push('overlay'),
      treeToolsMeasurement: { id: 'semantic-tools' }, treeFooterMeasurement: { id: 'semantic-footer' },
      mangaFlatPrefix: (identity, tools, footer) => prefixes.push({ identity, tools, footer }),
    });
    page.mangaContent();
    const navigation = [...page.children.values()].find(child => child instanceof Captured);
    assert.equal(navigation.params.headerCount, flowing ? 1 : 0, 'current short semantic Grid receives the native prefix contract');
    assert.equal(navigation.params.prefixHeight, flowing ? 360 : 0);
    assert.equal(navigation.params.prefixIdentity, 'current');
    assert.equal(overlays.length, flowing ? 0 : 1);
    navigation.params.prefixBuilder();
    assert.deepEqual(prefixes, [{ identity: 'current', tools: page.treeToolsMeasurement, footer: page.treeFooterMeasurement }],
      'semantic and fallback native producers have independent measurement owners');
  }
  let anchor;
  const Policy = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryNavigationList.ets', import.meta.url),
    'ReaderDirectoryNavigationList', ['nativeHeaderCount', 'nativeDisplayIndex', 'dataIndex', 'mangaGridLayoutOptions',
      'publishMangaScrollOffset', 'positionInitialCurrent', 'planPosition'], {
      ScrollAlign: { START: 'start', CENTER: 'center' }, LengthMetrics: { vp: value => value },
      readerDirectoryScopeKey: (source, book) => source + ':' + book, readerDirectoryViewportAnchor: () => anchor,
    });
  const view = { viewId: 'view', visibleTotal: 3, navigationRevision: 'revision' }, moves = [], offsets = [];
  const policy = Object.assign(new Policy(), {
    mangaDisplay: true, headerCount: 1, mangaQuickDisplay: false, mangaSearchActive: false,
    view, sourceId: 'source', bookId: 'book', mangaViewportHeight: 168, mangaVisibleTopInset: 98,
    mangaGridSpans: new Map([[0, 12], [1, 6], [2, 6]]), prepareMangaGridProjection() {},
    dataSource: { currentView: () => view, displayIndex: index => index, coreIndex: index => index },
    scroller: { currentOffset: () => ({ yOffset: 93 }), scrollToIndex: (...args) => moves.push(args) },
    mangaContentStartOffset: () => 360, mangaContentEndOffset: () => 18, positionRowHeight: () => 58,
    onScrollOffset: offset => offsets.push(offset),
  });
  assert.equal(policy.nativeHeaderCount(), 1);
  assert.equal(policy.nativeDisplayIndex(0), 1);
  assert.equal(policy.nativeDisplayIndex(2), 3);
  assert.equal(policy.nativeDisplayIndex(3), undefined);
  assert.equal(policy.dataIndex(0), -1);
  assert.equal(policy.dataIndex(2), 1);
  assert.equal(policy.dataIndex(4), -1);
  const options = policy.mangaGridLayoutOptions();
  assert.deepEqual(options.irregularIndexes, [0, 1, 2, 3, 4]);
  assert.deepEqual([0, 1, 2, 3, 4].map(index => options.onGetIrregularSizeByIndex(index)),
    [[1, 12], [1, 12], [1, 6], [1, 6], [1, 12]]);
  assert.equal(policy.planPosition(), undefined, 'opening without current or anchor preserves the visible prefix');
  view.visibleTotal = 0; policy.mangaGridSpans = new Map([[0, 12]]);
  assert.deepEqual(policy.mangaGridLayoutOptions().irregularIndexes, [0, 1, 2], 'empty body retains independent prefix and tail');
  view.visibleTotal = 3; policy.mangaGridSpans = new Map([[0, 12], [1, 6], [2, 6]]);
  view.currentVisibleIndex = 1;
  policy.initialPositionPending = true;
  policy.positionInitialCurrent();
  assert.deepEqual(moves.pop(), [2, false, 'start', { extraOffset: -110 }], 'current row fits the actual remaining 70vp');
  delete view.currentVisibleIndex;
  anchor = { navigationRevision: 'revision', viewId: 'view', visibleIndex: 0, rowFraction: .25 };
  assert.equal(policy.planPosition().index, 0, 'Core rank zero remains an actual anchor');
  policy.publishMangaScrollOffset(); assert.equal(offsets.pop(), 93);
  policy.headerCount = 0;
  policy.publishMangaScrollOffset(); assert.equal(offsets.pop(), 453, 'full Grid retains its signed native content origin');
  anchor = undefined;
  assert.equal(policy.planPosition().index, 0);

  const nativeIndexPolicy = Object.assign(new Policy(), policy, { headerCount: 1 });
  function checkGrid(candidate = listSource) {
    const sdk = boundedSurfaceSdk(), prefixCalls = [], firstLayouts = [];
    const grid = createReaderBuilderProbe(candidate, ['build', 'prefixBuilder', 'emptyBuilder', 'emptyPrefix'], { ...sdk.deps,
      LazyForEach: new Proxy({}, { get: () => () => {} }),
      ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
    }, sdk.hooks).owner;
    Object.assign(grid, { mangaDisplay: true, view: { ...view }, scroller: {}, dataSource: { coreIndex: index => index },
      nativeHeaderCount: () => 1, mangaGridLayoutOptions: () => options, prefixHeight: 360,
      prefixBuilder: () => prefixCalls.push('current'), mangaContentStartOffset: () => 360,
      mangaContentEndOffset: () => 18, listPaddingX: 18, listPaddingRight: 18,
      mangaColor: () => '#000000', interactionEnabled: true, initialPositionPending: true, mangaViewportWidth: 330,
      dataIndex: index => nativeIndexPolicy.dataIndex(index),
      onFirstLayout: () => firstLayouts.push(grid.mangaViewportHeight),
      positionInitialCurrent() {},
    });
    grid.initialRender();
    const viewport = [...grid.nodes.values()].find(node => node.type === 'Grid');
    assert.equal(viewport.contentStartOffset, 0); assert.equal(viewport.contentEndOffset, 0);
    const spacers = [...grid.nodes.values()].filter(node => node.type === 'GridItem');
    assert.deepEqual(spacers.map(node => node.height), [360, 18]);
    spacers[0].create[0](spacers[0].id, true); assert.deepEqual(prefixCalls, ['current']);
    viewport.onScrollIndex(0, 1); assert.equal(grid.firstVisibleIndex, -1);
    viewport.onScrollIndex(2, 3); assert.equal(grid.firstVisibleIndex, 1);
    viewport.onAreaChange({}, { width: 330, height: 168 }); assert.deepEqual(firstLayouts, [168]);
  }
  checkGrid();
  for (const [label, candidate] of [
    ['lost native prefix', listSource.replaceAll('if (this.nativeHeaderCount() === 1) {', 'if (false) {')],
    ['oversized native offset', listSource.replace('.contentStartOffset(this.nativeHeaderCount() === 1 ? 0 : this.mangaContentStartOffset())', '.contentStartOffset(this.mangaContentStartOffset())')],
    ['prefix saved as Core rank', listSource.replace('this.firstVisibleIndex = this.dataIndex(start);', 'this.firstVisibleIndex = this.dataSource.coreIndex(start);')],
    ['missing actual height', listSource.replace('this.mangaViewportHeight = height;', 'void height;')],
  ]) {
    assert.notEqual(candidate, listSource, label);
    assert.throws(() => checkGrid(candidate), assert.AssertionError, label);
  }
  const Surface = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryNavigationSurface.ets', import.meta.url),
    'ReaderDirectoryNavigationSurface', ['hasPrefix']);
  assert.equal(Surface.prototype.hasPrefix.call({ mangaDisplay: true, headerCount: 1 }), false,
    'manga loading keeps its existing page-state owner while the ready Grid owns its native prefix');
  console.log('PASS exact SDK manga semantic prefix, native/Core ranks and spans, initial/current placement and actual Grid render/event inputs. No Core paging or native pixels simulated.');
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
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
    mangaVisibleTopInset: () => 0, mangaNarrow: () => false, directoryScrollLayout: () => ({}),
    mangaToolbar() {}, mangaFlowFooter: () => false, mangaHeaderTrailingSlot() {}, consumeTemporaryBack: () => false,
    mangaLayoutRow: entry => ({ kind: 'row', columns: 1, entries: [entry], labels: [] }),
    mangaEntryIsDisplayed: () => true, rowIsCurrent: () => true,
    onSelectNavigationTarget: () => forwarded.push('semantic'), selectMangaEntry: () => forwarded.push('flat'),
    onBack: child.params.onBack,
  });
  page.mangaContent();
  const navigation = [...page.children.values()].find(actor => actor.params.chapterEntries !== undefined);
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
    ['duplicate overlay', pageSource.replace('if (!this.mangaFlowFooter() || this.navigationActive) { this.mangaToolbar(identity); }', 'this.mangaToolbar(identity);'), listSource],
    ['missing inline producer', pageSource, listSource.replace('ListItem() { this.prefixBuilder(); }.width', 'ListItem() {}.width')],
    ['missing scroll spacers', pageSource, listSource.replaceAll('if (this.materializedInsets) {', 'if (false) {')],
  ]) {
    assert.ok(page !== pageSource || list !== listSource, label);
    assert.throws(() => check(page, list), assert.AssertionError, label);
  }
  console.log('PASS actual short/full SDK List content, canonical index, signed offsets and one inline/overlay toolbar producer with eight rejected regressions.');
}

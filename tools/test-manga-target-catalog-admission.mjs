import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'busy-catalog': {
    description: 'Actual pending manga selection reaches SDK target catalog row eligibility, coalesces repeated selection and preserves current Back cancellation. Finite pending progress RPC, no commit or network.',
    resources: [],
  },
});

for (const id of selected) {
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
    mangaToolbar() {}, mangaHeaderTrailingSlot() {}, consumeTemporaryBack: () => false,
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

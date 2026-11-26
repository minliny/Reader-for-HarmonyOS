import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as windowFacts from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import * as horizontalFrame from '../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe, productionReaderMotionSdk } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { selectedProductionValues } from './lib/selected-production-methods.mjs';
import { productionReaderPressFeedback } from './lib/reader-press-feedback-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { actualReaderPostLayoutFrame, drainReaderPostLayoutFallbacks } from './lib/reader-post-layout-frame-probe.mjs';
import { foundationControls, foundationSpecs, surfaceFontResolvers } from './lib/reader-foundation-control-probe.mjs';
import { inlineSelectSdk } from './lib/reader-inline-select-sdk-probe.mjs';
import { labeledIconControls, labeledIconSpecs } from './lib/reader-labeled-icon-action-probe.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { readerSurfaceSpecsForProbe, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerMessageStyles } from './lib/reader-typography-probe.mjs';
import { localBookDetailSdk } from './lib/local-book-detail-sdk-probe.mjs';
import { actualReadingEntryPresentation } from './lib/reading-entry-presentation-probe.mjs';
import { actualReaderDirectoryJourney } from './lib/reader-directory-operations-probe.mjs';
import { ReaderNavigation } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { currentLibraryShelfChrome } from './lib/bookshelf-current-projection-probe.mjs';
import { ProductionHost, compileHost, BookAcquisitionCoordinator, ReaderCoreGateway } from './lib/reading-entry-owner-probe.mjs';
import { readingEntryActionFixture } from './lib/reading-entry-action-fixture.mjs';
import { remoteReadingEntryKind } from '../entry/src/main/ets/features/reading/presentation/ReadingBookDetail.ts';
import { readingEntryInputForShelfSnapshot, readingEntrySeedForContentKind } from '../entry/src/main/ets/features/reading/presentation/ReadingEntryDto.ts';
import { sourceSwitchTriggerFocusId } from '../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { readerSourceCategoryLabel } from '../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts';
const read = file => readFileSync(new URL('../entry/src/main/ets/' + file, import.meta.url), 'utf8');
const definitions = {
  'detail-scroll-origin': 'Actual detailContent/Scroll SDK attributes keep short and long same-book documents at the declared top inset across media and legacy type facts.',
  'document-scroll-origin': 'Actual shelf clip and diagnostic document Scroll SDK attributes declare a top origin independently of viewport/content height.',
  'prepared-media-qualification': 'Actual coordinator cache and in-flight joins qualify current media, preserve existing consumers and never retain an explicit media-mismatched result for the next retry.',
  'detail-kind-confirmation': 'Actual current source registry gives the initial media hint while cold detail failure/retry publishes its confirmed session type through the shipping Entry/Host chain.',
  'detail-type-state': 'Unknown remote type renders the existing page-state host with current retry, keeps Back available and excludes a misleading hero/footer; local/text/manga/audio are distinguished.',
  'library-watch-parent-delivery': 'Library search PropWatch fences input before its 120ms paint-only fade; settled navigation and coverage notify the current parent after render.',
  'detail-entry-dto-geometry': 'Actual search matched-shelf selection and shelf info entry project canonical kind/cover facts through the shipping Host mapper before comparing their real detail geometry.',
  'detail-directory-action': 'Actual text/manga detail directory actors enter the detail-directory journey without dispatching reading; a late prepared-page delivery is rejected after the detail session has ended.',
  'bookshelf-action-lanes': 'The shelf section keeps two nonoverlapping 44vp hit lanes around one centered sliding or reduced-motion selection pill.',
  'labeled-action-paint': 'Finite labeled actions retain their authored compact paint heights and distinct glyphs with an independent44vp native carrier and natural text growth.',
  'select-watch-parent-delivery': 'A closing/reduce-motion PropWatch fences input immediately, fades only the shared select paint for 120ms and rejects dismissal from a retired identity.',
  'directory-watch-parent-delivery': 'Directory focus revocation fences the native input immediately and delivers the parent callback on the next frame only while its current identity still owns it.',
  'dialog-action-budget': 'Real bundled font advances at actual dialog safe widths expose wrapping and natural native action growth beyond the old single-line cap.',
  'menu-divider-current': 'Stable-key menu actors recompute their divider from current action order after an appended action.',
  'main-rail-current': 'Actual stable-key rail actors update selected appearance and current/inactive event routing with the current tab.',
  'no-cover-graphic': 'Shelf and detail cover labels follow the current media facts, and the cover graphic keeps its cover-relative typography.',
  'compact-source-paint': 'Source category/detect/login preserve their distinct compact paint heights, centered labels and a paid native44 carrier at four font scales.',
  'tablet-select-admission': 'The actual Settings tablet select uses the common native trigger and live mounted/disabled qualification.',
  'dialog-current-actions': 'Actual SDK stable-key dialog actors read current action facts after same-id replacement and reject disabled/removed actions.',
  'detail-hero-source': 'Actual detail hero avoids per-column vertical compensation and keeps source paint independent of the native target.',
};
const nodes = owner => [...owner.nodes.values()];
for (const id of selectContractCases(definitions)) {
  if (id === 'detail-scroll-origin') {
    const records = [];
    for (const kind of ['text', 'manga', 'legacy-local', 'unknown-remote']) {
      for (const length of ['short', 'long']) {
        for (const scale of [1, 2]) {
          const metrics = windowFacts.createDefaultReaderWindowMetrics();
          metrics.windowRect.width = 366; metrics.windowRect.height = 844; metrics.systemFontScale = scale;
          const owner = localBookDetailSdk({ sourceSwitchTriggerFocusId, ReaderWindowCoordinator: { metrics: () => metrics } }).owner;
          const contentKind = kind === 'text' || kind === 'manga' ? kind : undefined;
          const sourceId = kind === 'legacy-local' ? 'local' : 'remote';
          Object.assign(owner, { book: { sourceId, bookId: 'same-book', title: '同一本书', author: '同一作者', sourceName: '同一来源',
            contentKind, intro: length === 'short' ? '' : '这是同一本书的完整简介。'.repeat(80), coverUrl: 'cover' },
            viewportWidth: 366, viewportHeight: 844, measurementKey: 1, readerWindowMetricsRevision: 1,
            toc: Array.from({ length: length === 'short' ? 1 : 24 }, (_, index) => ({ index, title: `第${index + 1}章`, bookmarks: [] })),
            mangaFontsReady: true, introExpanded: length === 'long', introMeasured: true,
            admissionIdentity: 'same-opening', appThemeScheme: 'day', inBookshelf: true });
          owner.refreshGeometry();
          if (kind === 'manga') owner.refreshChapterPreview();
          owner.detailContent();
          const scrolls = nodes(owner).filter(node => node.type === 'Scroll');
          if (kind === 'unknown-remote') {
            assert.equal(scrolls.length, 0, 'unconfirmed remote type retains its existing preparation state');
          } else {
            assert.equal(scrolls.length, 1);
            assert.equal(scrolls[0].align, 'Alignment.Top', `${kind}/${length}/${scale} document uses its declared top origin`);
            assert.equal(scrolls[0].height, '100%');
            assert.equal(scrolls[0].create, owner.detailScroller, 'both book kinds use the same live header scroll source');
            const column = nodes(owner).find(node => node.type === 'Column' && node.padding?.top === owner.geometry.content.startInset &&
              node.padding?.bottom === owner.geometry.content.endInset);
            assert.ok(column, 'the actual detail column retains the resolved header and footer clearance');
            assert.equal(column.height, undefined, 'the document keeps its natural short/long height');
            assert.equal(owner.geometry.content.startInset, owner.geometry.header.clearance);
          }
          records.push({ kind, length, scale, scrolls: scrolls.length });
        }
      }
    }
    console.log(JSON.stringify({ kind: 'detail-scroll-sdk-origin', cases: records.length, records,
      nativeLayout: false, nativeEvidence: 'Existing 2cd tree plus official alignment algorithm are recorded separately.' }));
  }
  if (id === 'document-scroll-origin') {
    const shelfSource = read('features/bookshelf/ui/BookshelfPage.ets');
    const shelf = createReaderBuilderProbe(shelfSource, ['filterPanel', 'filterRow', 'filterChip', 'isFilterSelected', 'hasActiveFilters'],
      { ScrollDirection: { Vertical: 'ScrollDirection.Vertical' } }).owner;
    Object.assign(shelf, { filterPanelHeight: 180, filterContentOpacity: 1, filterRowVisible: true,
      appThemeScheme: 'day', contentFilter: 'all', sourceFilter: 'all' });
    shelf.filterPanel(7);
    const clip = nodes(shelf).find(node => node.type === 'Scroll');
    assert.equal(clip.align, 'Alignment.Top');
    assert.equal(clip.height, 180); assert.equal(clip.enableScrollInteraction, false);
    assert.equal(typeof nodes(shelf).find(node => node.type === 'Column' && node.onAreaChange)?.onAreaChange, 'function');
    const paragraph = createReaderBuilderProbe(read('pages/ReaderParagraphDiagnostic.ets'), ['build']).owner;
    Object.assign(paragraph, { fontReady: false, status: '等待字体' }); paragraph.initialRender();
    assert.equal(nodes(paragraph).find(node => node.type === 'Scroll').align, 'Alignment.Top');
    const { SOURCE_TOOLS_FIXTURE_SCENARIOS } = selectedProductionValues(
      new URL('../entry/src/main/ets/pages/ReaderSourceToolsStructureFixture.ets', import.meta.url), ['SOURCE_TOOLS_FIXTURE_SCENARIOS']);
    const { DOWNLOAD_FIXTURE_SCENARIOS } = selectedProductionValues(
      new URL('../entry/src/main/ets/pages/ReaderDownloadStructureFixture.ets', import.meta.url), ['DOWNLOAD_FIXTURE_SCENARIOS']);
    const menu = createReaderBuilderProbe(read('pages/ReaderPageStructureVerification.ets'), ['fontAttempt', 'menu', 'fontPreparationState'],
      { SOURCE_TOOLS_FIXTURE_SCENARIOS, DOWNLOAD_FIXTURE_SCENARIOS, readerWindowMetrics: windowFacts.createDefaultReaderWindowMetrics }).owner;
    Object.assign(menu, { presentation: 1, requestedWidth: 366, actualWidth: 366, actualHeight: 844, fontState: 'loading',
      menuBottomInset: () => 24 }); menu.menu();
    assert.equal(nodes(menu).find(node => node.type === 'Scroll').align, 'Alignment.Top');
    console.log('PASS SDK top origins for one dynamic shelf clip and two separately classified diagnostic documents');
  }
  if (id === 'prepared-media-qualification') {
    const create = async () => {
      const coordinator = new BookAcquisitionCoordinator(async () => ({ data: { sources: [{ sourceId: 'remote', enabled: true,
        sourceVersion: 'v1', bookSource: { bookSourceType: 0 } }] } }));
      await coordinator.request('source.list', {}); return coordinator;
    };
    const seed = { sourceId: 'remote', bookId: 'book', title: '书', author: '作者' };
    const session = contentKind => ({ identity: { sourceId: 'remote', bookId: 'book' }, sourceVersion: 'v1', contentKind,
      book: { title: '书', author: '作者' }, entries: [], catalogVersion: 'catalog', contextVersion: 'context' });
    const coordinator = await create(); let opens = 0;
    coordinator.openBook = async input => { opens++; return session(input.contentKind); };
    await coordinator.acquireBook({ ...seed, contentKind: 'manga' });
    const text = await coordinator.acquireBook({ ...seed, contentKind: 'text' });
    assert.equal(text.contentKind, 'text'); assert.equal(opens, 2, 'wrong-media prepared result is evicted before reuse');
    await coordinator.acquireBook({ ...seed, contentKind: 'text' }); assert.equal(opens, 2, 'matching-media prepared result is still reused');
    assert.equal(coordinator.hasCurrentCatalogProjection(text), true);
    assert.equal(coordinator.hasCurrentCatalogProjection({ ...text, contentKind: 'manga' }), false, 'projection evidence cannot borrow identical entry refs across media');
    coordinator.close();
    const concurrent = await create(), pending = [];
    concurrent.openBook = input => new Promise(resolve => pending.push({ kind: input.contentKind, resolve }));
    const manga = concurrent.acquireBook({ ...seed, contentKind: 'manga' });
    const novel = concurrent.acquireBook({ ...seed, contentKind: 'text' });
    assert.equal(pending.length, 1);
    pending[0].resolve(session('manga')); assert.equal((await manga).contentKind, 'manga');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(pending.length, 2, 'different-media join retries after the existing owner completes');
    pending[1].resolve(session('text')); assert.equal((await novel).contentKind, 'text'); concurrent.close();
    const rejected = await create();
    rejected.openBook = async () => session('manga');
    await assert.rejects(rejected.acquireBook({ ...seed, contentKind: 'text' }), /类型与当前请求不一致/);
    rejected.openBook = async () => session('text');
    assert.equal((await rejected.acquireBook({ ...seed, contentKind: 'text' })).contentKind, 'text', 'retry does not hit the rejected wrong-media result');
    rejected.close();
  }
  if (id === 'detail-kind-confirmation') {
    const Host = compileHost(undefined, { ReaderDirectoryHost: { forRuntime: () => undefined },
      ReadingOfflineGateway: class { async loadDirectoryProjection() { return []; } } });
    for (const warm of [false, true]) for (const canonicalType of ['text', 'manga', 'audio']) for (const intent of ['info', 'resume']) {
      const coordinator = new BookAcquisitionCoordinator(async method => {
        assert.equal(method, 'source.list');
        return { data: { sources: [{ sourceId: 'remote', enabled: true, sourceVersion: 'v1', bookSource: { bookSourceType: 2 } }] } };
      });
      if (warm) await coordinator.request('source.list', {});
      assert.equal(coordinator.presentationContentKind({ sourceId: 'remote', bookId: 'book' }), warm ? 'manga' : undefined);
      assert.equal(coordinator.presentationContentKind({ sourceId: 'remote', bookId: 'book', contentKind: 'text' }), 'text', 'canonical declared type wins');
      const pending = [], reads = [], failures = [];
      coordinator.acquireBookWithBackgroundRefresh = seed => new Promise((resolve, reject) => pending.push({ seed, resolve, reject }));
      const runtime = { bookAcquisitions: () => coordinator, supportsCoreCapability: () => false, noteReadingPreparationIntent() {},
        request: (method, params) => { assert.equal(method, 'bookshelf.get'); assert.equal(params.bookId, 'book');
          return new Promise((resolve, reject) => reads.push({ resolve, reject })); } };
      const saved = { sourceId: 'remote', bookId: 'book', title: '书籍', author: '作者', kind: 'EPUB', coverUrl: 'https://example/cover.jpg', addedAt: 1, sortIndex: 0 };
      const fixture = readingEntryActionFixture({ runtime, Host, route: 'bookshelf', shelfBooks: [saved], failure: (...values) => failures.push(values) });
      let inputAllowed = true;
      fixture.actions.ports.detailReadAllowed = () => inputAllowed;
      fixture.actions.openShelfEntry(saved, intent);
      assert.equal(fixture.navigation.snapshot().route, 'bookshelf', 'legacy input waits for the exact canonical fact before info/resume dispatch');
      assert.equal(pending.length, 0); assert.equal(reads.length, 1);
      if (warm && canonicalType === 'text' && intent === 'info') {
        inputAllowed = false; reads[0].resolve({ data: { book: { ...saved, contentKind: canonicalType } } });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(fixture.navigation.snapshot().route, 'bookshelf'); assert.equal(pending.length, 0);
        inputAllowed = true; fixture.actions.openShelfEntry(saved, intent);
      }
      reads.at(-1).resolve({ data: { book: { ...saved, contentKind: canonicalType } } });
      await new Promise(resolve => setImmediate(resolve));
      if (canonicalType === 'audio') {
        assert.equal(fixture.navigation.snapshot().route, 'bookshelf'); assert.equal(failures.length, 1); assert.equal(pending.length, 0);
      } else {
        assert.equal(fixture.entry.book.contentKind, canonicalType, 'durable admission wins over an edited comic source');
        assert.equal(fixture.entry.book.kind, 'EPUB');
        assert.equal(fixture.navigation.snapshot().route, intent === 'resume' ? 'reading' : 'detail');
        assert.equal(fixture.entry.sessionActive, intent === 'resume');
        if (intent === 'info') {
          assert.equal(pending.length, 1); assert.equal(pending[0].seed.contentKind, canonicalType);
          if (warm && canonicalType === 'text') {
            pending[0].resolve({ session: { identity: { sourceId: 'remote', bookId: 'book' }, detailUrl: 'book', sourceVersion: 'v1',
              contentKind: 'manga', book: { title: '书籍', author: '作者', kind: 'EPUB' }, entries: [] } });
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(fixture.entry.book.contentKind, 'text', 'a mismatched prepared session cannot overwrite durable media');
            assert.equal(fixture.entry.session, undefined); assert.equal(fixture.entry.catalogBusy, false);
            assert.match(fixture.entry.loadingMessage, /类型与书架记录不一致/);
            fixture.entry.retryDirectoryCatalog(runtime);
          }
          const accepted = pending.at(-1);
          accepted.resolve({ session: { identity: { sourceId: 'remote', bookId: 'book' }, detailUrl: 'book', sourceVersion: 'v1',
            contentKind: canonicalType, book: { title: '书籍', author: '作者', kind: 'EPUB' }, entries: [] } });
          await new Promise(resolve => setImmediate(resolve));
          assert.equal(fixture.entry.book.contentKind, canonicalType); assert.equal(fixture.entry.catalogBusy, false);
        }
      }
      if (warm && canonicalType === 'text' && intent === 'info') {
        const acquired = pending.length;
        fixture.actions.openRemoteDetail({ seed: saved, shelfSnapshot: saved, sourceName: '书源' });
        const oldRead = reads.at(-1); fixture.retire();
        oldRead.resolve({ data: { book: { ...saved, contentKind: 'manga' } } });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(pending.length, acquired, 'retired exact read cannot dispatch a successor acquisition');
      }
      fixture.retire(); coordinator.close();
    }
    const pending = [], reads = [];
    const coordinator = new BookAcquisitionCoordinator(async () => ({ data: { sources: [] } }));
    coordinator.acquireBookWithBackgroundRefresh = seed => new Promise(resolve => pending.push({ seed, resolve }));
    const runtime = { bookAcquisitions: () => coordinator, supportsCoreCapability: () => false,
      request: () => new Promise((resolve, reject) => reads.push({ resolve, reject })) };
    const saved = { sourceId: 'remote', bookId: 'book', title: '旧书', author: '作者', kind: 'image', addedAt: 1, sortIndex: 0 };
    const fixture = readingEntryActionFixture({ runtime, Host, route: 'detail', shelfBooks: [saved] });
    fixture.entry.enterRemoteDetail(runtime, { seed: saved, shelfSnapshot: saved, sourceName: '书源' }, project => {
      project(); return { shelfBooks: [saved], ports: fixture.entryPorts(runtime) };
    }, () => assert.fail('unexpected admission notice'));
    assert.equal(fixture.entry.book.contentKind, undefined); assert.equal(fixture.entry.catalogBusy, true);
    reads[0].reject(new Error('目录暂时不可用')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.entry.book.contentKind, undefined); assert.equal(fixture.entry.catalogBusy, false); assert.equal(pending.length, 0);
    fixture.entry.retryDirectoryCatalog(runtime); assert.equal(reads.length, 2);
    reads[1].resolve({ data: { book: { ...saved, contentKind: 'manga' } } }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.entry.book.contentKind, 'manga'); assert.equal(pending.length, 1);
    pending[0].resolve({ session: { identity: { sourceId: 'remote', bookId: 'book' }, detailUrl: 'book', sourceVersion: 'v1',
      contentKind: 'manga', book: { title: '旧书', author: '作者', kind: 'image' }, entries: [] } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.entry.book.contentKind, 'manga'); assert.equal(fixture.entry.catalogBusy, false);
    fixture.retire(); coordinator.close();
    const exact = [], admitted = [];
    const searchCoordinator = new BookAcquisitionCoordinator(async () => ({ data: { sources: [] } }));
    searchCoordinator.acquireBookWithBackgroundRefresh = seed => new Promise(resolve => admitted.push({ seed, resolve }));
    const searchRuntime = { bookAcquisitions: () => searchCoordinator, supportsCoreCapability: () => false,
      request: method => { assert.equal(method, 'bookshelf.get'); return new Promise(resolve => exact.push(resolve)); } };
    const searchFixture = readingEntryActionFixture({ runtime: searchRuntime, Host, route: 'search' });
    searchFixture.actions.openRemoteDetail({ seed: { ...saved, contentKind: 'manga' }, sourceName: '书源' });
    assert.equal(exact.length, 1); assert.equal(admitted.length, 0);
    exact[0]({ data: { book: { ...saved, contentKind: 'text' } } }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(exact.length, 1, 'filtered membership fallback reuses its single exact read');
    assert.equal(admitted[0].seed.contentKind, 'text', 'canonical membership reprojects seed before acquisition');
    assert.equal(searchFixture.entry.book.contentKind, 'text');
    admitted[0].resolve({ session: { identity: { sourceId: 'remote', bookId: 'book' }, detailUrl: 'book', sourceVersion: 'v1',
      contentKind: 'text', book: { title: '旧书', author: '作者', kind: 'image' }, entries: [] } });
    await new Promise(resolve => setImmediate(resolve)); searchFixture.retire(); searchCoordinator.close();
    const known = { ...saved, contentKind: 'manga' };
    const validated = { identity: { sourceId: 'remote', bookId: 'book' }, contentKind: 'text',
      book: { title: '旧书', author: '作者' }, entries: [], catalogVersion: 'catalog', contextVersion: 'context' };
    const fastCoordinator = new BookAcquisitionCoordinator(async () => assert.fail('unexpected fast-path IO'));
    fastCoordinator.hasCurrentCatalogProjection = () => true;
    const fastRuntime = { bookAcquisitions: () => fastCoordinator, noteReadingPreparationIntent() {} };
    const fast = readingEntryActionFixture({ runtime: fastRuntime, Host, route: 'detail', shelfBooks: [known] });
    fast.entry.session = validated;
    fast.entry.enterRemoteDetail(fastRuntime, { seed: known, shelfSnapshot: known, sourceName: '书源', validatedSession: validated,
      resumeImmediately: true }, project => { project(); return { shelfBooks: [known], ports: fast.entryPorts(fastRuntime) }; }, () => {});
    assert.equal(fast.entry.book.contentKind, 'manga'); assert.equal(fast.entry.session, undefined,
      'retained and validated text sessions cannot enter the canonical manga fast path');
    fast.retire(); fastCoordinator.close();
  }
  if (id === 'detail-type-state') {
    for (const [sourceId, contentKind, expected] of [['remote', undefined, false], ['local', undefined, true], ['remote', 'text', true], ['remote', 'manga', true], ['remote', 'audio', false]]) {
      const sdk = localBookDetailSdk({ sourceSwitchTriggerFocusId });
      const owner = sdk.owner; let current = true, retries = 0;
      Object.assign(owner, { book: { sourceId, bookId: 'book', title: '书', author: '作者', contentKind, coverUrl: 'https://example/cover.jpg' },
        catalogBusy: true, loadingMessage: '', directoryFocusContext: 'detail', isDetailActionCurrent: () => current,
        onRetryCatalog: () => retries++ });
      owner.mounted = true;
      assert.equal(owner.detailKindConfirmed(), expected);
      if (!expected) {
        owner.detailContent();
        assert.equal(nodes(owner).some(node => node.type === 'Image' || node.type === 'Button'), false, 'unconfirmed type has no misleading hero');
        owner.detailFooter();
        assert.equal(nodes(owner).some(node => node.type === 'Image' || node.type === 'Button'), false, 'unconfirmed type has no footer actions');
        const state = [...owner.children.values()].find(child => typeof child.title === 'string' && typeof child.loading === 'boolean');
        assert.ok(state); assert.equal(state.loading, contentKind !== 'audio');
        owner.catalogBusy = false; owner.loadingMessage = '目录暂时不可用'; owner.kindPreparationContent();
        const failed = [...owner.children.values()].filter(child => typeof child.title === 'string' && typeof child.loading === 'boolean').at(-1);
        assert.equal(failed.loading, false); assert.equal(failed.message, '目录暂时不可用');
        assert.equal(failed.actionLabel, contentKind === 'audio' ? '' : '重试');
        failed.onAction(); assert.equal(retries, contentKind === 'audio' ? 0 : 1);
        current = false; failed.onAction(); assert.equal(retries, contentKind === 'audio' ? 0 : 1);
      }
    }
  }
  if (id === 'library-watch-parent-delivery') {
    const source = read('features/search/ui/ReaderLibrarySearchSurface.ets');
    const locals = pureModuleProbe(source.slice(0, source.indexOf('@Component')), 'LibrarySearchFrames.ets',
      { FrameCallback: class {} }, ['LibrarySearchFrame', 'LibrarySearchFocusFrame']);
    const headerMetrics = await import('../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts');
    const headers = pureModuleProbe(read('ui/foundation/ReaderHeaderSpecs.ets'), 'ReaderHeaderSpecs.ets',
      { ...headerMetrics, ...inlineSelectSdk({ uiContext: {} }).dependencies }, ['searchHeaderSpec', 'bookshelfHeaderSpec']);
    const frames = [], calls = [], animations = [];
    let renderingParent = false, owner;
    const uiContext = {
      postFrameCallback: frame => frames.push(frame),
      getFocusController: () => ({ clearFocus() {} }),
      animateTo(params, paint) {
        const before = [owner.displayedSurfaceProgress, owner.reducedSearchOpacity];
        paint();
        animations.push({ params, before, after: [owner.displayedSurfaceProgress, owner.reducedSearchOpacity] });
      },
    };
    const properties = createArkUIPropertyRuntimeProbe();
    const members = ['mode', 'reduceMotion', 'identity', 'navigationGeneration', 'mounting', 'currentMode', 'mounted', 'generation',
      'activeIdentity', 'activeNavigation', 'activeMounting', 'fromSurface', 'fromHistory', 'fromResults', 'fromScrim',
      'toSurface', 'toHistory', 'toResults', 'toScrim', 'measurementKey', 'automaticInputFocusAllowed', 'fieldFocused',
      'transitionKind', 'transitionDurationMs', 'transitionStartedMs', 'elapsed', 'searchMounted', 'historyHeight',
      'displayedHistoryViewport', 'displayedHistoryLimit', 'displayedSurfaceProgress', 'reducedTransition', 'reducedSearchOpacity',
      'lastCardSuppressed', 'lastCardCoverageScope',
      'openSpec', 'submitSpec', 'backSpec', 'applyTargets', 'transitionFor', 'durationFor', 'modeChanged',
      'retargetHistoryViewport', 'publishContinueCardCoverage', 'completeTransition', 'beginReducedTransition'];
    owner = createReaderBuilderProbe(source, members, { ...properties.sdk, ...locals, ...headers, uiContext,
      ...productionReaderMotionSdk(), ReaderPostLayoutFrame: actualReaderPostLayoutFrame(), readerMotionNowMs: () => 0 }, properties.hooks).owner;
    Object.assign(owner, { mounted: false, mode: 'input', currentMode: 'input', reduceMotion: true, identity: 1, navigationGeneration: 2, mounting: 3,
      activeIdentity: 1, activeNavigation: 2, activeMounting: 3, searchMounted: true,
      resolvedHistoryViewport: () => ({ height: 80, suppressContinueCard: true }), historyLimit: () => 100,
      model: {},
      scheduleInputFocus: () => {}, observeEntryHistory: () => {},
      displayedSurfaceProgress: 1, sampleSurfaceProgress() { return this.fromSurface; },
      historyProgress: () => 1, resultsProgress: () => 0, scrimProgress: () => 1,
      onHistoryCoverageChanged: (...values) => { assert.equal(renderingParent, false); calls.push(['coverage', ...values]); },
      onSettled: (...values) => { assert.equal(renderingParent, false); calls.push(['settled', ...values]); } });
    owner.mounted = true;
    const props = ['mode', 'reduceMotion', 'identity', 'navigationGeneration', 'mounting'];
    const deliver = patch => owner.updateStateVars({ ...Object.fromEntries(props.map(name => [name, owner[name]])), ...patch });
    assert.deepEqual(['open', 'submit', 'back', 'edit'].map(kind => owner.durationFor(kind)), [260, 240, 200, 200]);
    const frame = () => {
      for (const callback of frames.splice(0)) { callback.onFrame(16); callback.onIdle(0); }
      drainReaderPostLayoutFallbacks(frames);
    };
    renderingParent = true; deliver({ mode: 'idle' }); renderingParent = false;
    assert.equal(owner.searchMounted, true, 'existing visual actors survive through fade-out');
    assert.deepEqual(calls, []);
    frame();
    assert.equal(animations[0].params.duration, 120);
    assert.deepEqual(animations[0].before, [1, 1]);
    assert.deepEqual(animations[0].after, [1, 0]);
    assert.deepEqual(calls, []);
    animations[0].params.onFinish();
    assert.equal(owner.searchMounted, false);
    assert.deepEqual(calls, [['settled', 'idle', 1, 2, 3]]);
    renderingParent = true; deliver({ mode: 'input' }); renderingParent = false;
    assert.equal(calls.length, 1);
    frame();
    assert.equal(animations[1].params.duration, 120);
    assert.deepEqual(animations[1].before, [1, 0]);
    assert.deepEqual(animations[1].after, [1, 1]);
    assert.ok(calls.some(values => values[0] === 'coverage' && values[1] === true));
    const count = calls.length;
    renderingParent = true; deliver({ mode: 'idle' }); renderingParent = false;
    owner.mounted = false; owner.generation++;
    animations[1].params.onFinish();
    frame();
    assert.equal(calls.length, count, 'retired search cannot navigate or update its successor coverage');
  }
  if (id === 'detail-entry-dto-geometry') {
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { ts, options } = installedEtsCompiler();
    const parse = (path, kind) => ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, kind, options);
    for (const path of ['app/composition/ReaderReadingEntryActions.ets', 'features/reading/presentation/ReadingEntryPresentation.ets']) {
      const tree = parse(path, ts.ScriptKind.ETS), spreads = [];
      assert.deepEqual(tree.parseDiagnostics, []);
      const visit = node => { if (ts.isSpreadAssignment(node)) spreads.push(node.getText(tree)); ts.forEachChild(node, visit); };
      visit(tree);
      assert.deepEqual(spreads, [], path + ' obeys the ArkTS ETS object-spread restriction');
    }
    const authorIdentity = Object.freeze({ schemaVersion: 1, sourceVersion: 'source-v1', field: 'author', raw: '作者', label: '作者', rule: 'author-rule' });
    const completeSeed = Object.freeze({ sourceId: 'source', bookId: 'book', detailUrl: '/book', title: '书籍', author: '作者',
      contentKind: 'manga', sourceVersion: 'source-v1', authorIdentity, coverUrl: 'https://example/cover.jpg', intro: '简介',
      kind: 'image', lastChapter: '最新章节', searchVariables: Object.freeze([{ name: 'book', value: 'value' }]) });
    const oldShelf = Object.freeze({ sourceId: 'source', bookId: 'book', title: '书籍', author: '作者', addedAt: 1, sortIndex: 0 });
    const session = Object.freeze({ identity: { sourceId: 'source', bookId: 'book' }, contentKind: 'manga', acquisitionMode: 'online',
      detailUrl: '/book', tocUrl: '/toc', book: { title: '书籍', author: '作者' }, continuationVariables: [], entries: [], hostRequirements: [] });
    const completeInput = Object.freeze({ seed: completeSeed, sourceName: '原书源名', displayCoverUrl: 'https://example/display.jpg',
      shelfSnapshot: oldShelf, shelfBooks: Object.freeze([oldShelf]), fromSearch: false, sourceSwitchPending: true,
      resumeImmediately: false, fallbackSeeds: Object.freeze([completeSeed]), fallbackSourceNames: Object.freeze(['备用书源']),
      candidates: Object.freeze([{ seed: completeSeed, catalogReady: true, failed: false }]),
      validatedSession: session, retainedSession: session, retainAdmissionThroughProbe: true });
    const inputTree = parse('features/reading/application/ReadingEntryHost.ts', ts.ScriptKind.TS);
    const inputFields = inputTree.statements.find(node => node.name?.text === 'RemoteReadingEntryInput').members.map(member => member.name.getText(inputTree));
    const seedTree = parse('features/reading/application/RemoteReadingFlowGateway.ts', ts.ScriptKind.TS);
    const seedFields = seedTree.statements.find(node => node.name?.text === 'RemoteReadingBookSeed').type.members.map(member => member.name.getText(seedTree));
    assert.deepEqual(Object.keys(completeInput).sort(), inputFields.sort(), 'the fixture covers every supported input field');
    assert.deepEqual(Object.keys(completeSeed).sort(), seedFields.sort(), 'the fixture covers every supported seed field');
    const canonical = Object.freeze({ ...oldShelf, contentKind: 'text', kind: 'TXT' });
    const projectedInput = readingEntryInputForShelfSnapshot(completeInput, canonical);
    assert.notEqual(projectedInput, completeInput); assert.notEqual(projectedInput.seed, completeSeed);
    assert.equal(projectedInput.shelfSnapshot, canonical);
    for (const key of inputFields.filter(key => key !== 'seed' && key !== 'shelfSnapshot')) assert.equal(projectedInput[key], completeInput[key]);
    assert.equal(projectedInput.seed.kind, 'TXT'); assert.equal(projectedInput.seed.contentKind, 'text');
    for (const key of seedFields.filter(key => key !== 'kind' && key !== 'contentKind')) assert.equal(projectedInput.seed[key], completeSeed[key]);
    const typedSeed = readingEntrySeedForContentKind(completeSeed, 'text');
    for (const key of seedFields.filter(key => key !== 'contentKind')) assert.equal(typedSeed[key], completeSeed[key]);
    assert.equal(typedSeed.contentKind, 'text');
    const sparseInput = { seed: completeSeed, sourceName: '旧输入' };
    const sparseProjection = readingEntryInputForShelfSnapshot(sparseInput, oldShelf);
    assert.deepEqual(Object.keys(sparseProjection).sort(), ['seed', 'shelfSnapshot', 'sourceName']);
    assert.equal(sparseProjection.seed.kind, completeSeed.kind); assert.equal(sparseProjection.seed.contentKind, undefined);
    assert.equal(readingEntrySeedForContentKind(completeSeed, undefined).contentKind, undefined);
    const Entry = actualReadingEntryPresentation();
    for (const contentKind of [undefined, 'text', 'manga']) for (const canonicalType of contentKind === undefined ? ['text', 'manga'] : [contentKind]) for (const category of ['novel', 'comic'])
      for (const warm of [false, true]) for (const preferred of [undefined, 'https://search.example/merged.jpg']) {
      const saved = { sourceId: 'remote', bookId: 'canonical', title: '已入架书籍', author: '作者', kind: 'epub', contentKind,
        sourceName: '保存书源', coverUrl: 'https://canonical.example/cover.jpg', intro: '保存简介', lastChapter: '保存章节', addedAt: 1, sortIndex: 0 };
      const searchBook = { ...saved, category,
        coverUrl: 'https://candidate.example/cover.jpg', variables: [] };
      const confirmed = contentKind === undefined ? { ...saved, contentKind: canonicalType } : saved;
      const library = currentLibraryShelfChrome(); library.mode = 'results';
      let searchInput, shelfInput;
      library.selectResult(searchBook, [searchBook], [saved], { remote: value => { searchInput = value; return true; },
        beginShelfRead: () => () => true, loadShelfBook: async (sourceId, bookId) => {
          assert.equal(contentKind, undefined); assert.deepEqual([sourceId, bookId], [saved.sourceId, saved.bookId]); return confirmed;
        }, local: () => assert.fail('remote selection'), sourceName: () => '保存书源', failure: () => assert.fail('unexpected mismatch') }, preferred);
      if (contentKind === undefined) await new Promise(resolve => setImmediate(resolve));
      const entry = new Entry();
      entry.openShelfEntry({}, saved, 'info', { sourceName: () => '保存书源', remote: value => { shelfInput = value; }, local: () => assert.fail('remote shelf') });
      assert.ok(searchInput && shelfInput); assert.equal(searchInput.shelfSnapshot, confirmed); assert.equal(shelfInput.shelfSnapshot, saved);
      assert.equal(searchInput.seed.coverUrl, saved.coverUrl, 'exact durable identity stays canonical even when media category differs or is missing');
      assert.equal(searchInput.seed.kind, shelfInput.seed.kind, 'canonical format kind survives both entry DTOs');
      const coordinator = new BookAcquisitionCoordinator(async () => ({ data: { sources: [{ sourceId: 'remote', enabled: true,
        sourceVersion: 'v1', bookSource: { bookSourceType: category === 'comic' ? 2 : 0 } }] } }));
      if (warm) await coordinator.request('source.list', {});
      const project = async input => {
        const shelf = input.shelfSnapshot.contentKind === undefined ? await new ReaderCoreGateway({
          request: async method => { assert.equal(method, 'bookshelf.get'); return { data: { book: { ...saved, contentKind: canonicalType } } }; },
        }).loadShelfBook(saved.sourceId, saved.bookId) : input.shelfSnapshot;
        const declared = { ...input.seed, kind: shelf.kind ?? input.seed.kind,
          contentKind: remoteReadingEntryKind(input.seed, shelf, input.validatedSession) };
        const seed = { ...declared, contentKind: coordinator.presentationContentKind(declared) };
        const detail = ProductionHost.prototype.detail.call({}, seed, input.sourceName);
        return ProductionHost.prototype.displayDetail.call({}, detail, false, input.displayCoverUrl);
      };
      const projected = [await project(searchInput), await project(shelfInput)];
      assert.equal(projected[0].contentKind, canonicalType); assert.equal(projected[1].contentKind, canonicalType);
      assert.equal(projected[0].displayCoverUrl, preferred ?? searchInput.seed.coverUrl);
      const geometry = projected.map(book => {
        const owner = localBookDetailSdk({ sourceSwitchTriggerFocusId }).owner;
        Object.assign(owner, { book, viewportWidth: 366, viewportHeight: 844, measurementKey: 1, readerWindowMetricsRevision: 1 });
        owner.refreshGeometry(); owner.hero();
        const cover = nodes(owner).find(node => node.type === 'Image' && node.create === owner.displayCoverUrl());
        if (book.contentKind === undefined) {
          assert.equal(owner.detailKindConfirmed(), false); assert.equal(cover, undefined, 'cold unknown type never paints a text hero');
          return { typeConfirmed: false };
        }
        assert.ok(cover, 'projected production cover enters the actual selected hero');
        return { typeConfirmed: true, start: owner.geometry.content.startInset, coverWidth: cover.width, coverHeight: cover.height,
          textPadding: nodes(owner).find(node => node.type === 'Column' && node.layoutWeight === 1)?.padding };
      });
      if (geometry.every(frame => frame.typeConfirmed)) assert.deepEqual(geometry[0], geometry[1], 'confirmed origin DTOs select matching geometry');
      library.dispose(); coordinator.close();
    }
    for (const savedType of [undefined, 'text', 'manga', 'audio']) for (const category of ['novel', 'comic']) {
      const saved = { sourceId: 'canonical', bookId: 'stored', title: '活着', author: '余华', contentKind: savedType, addedAt: 1, sortIndex: 0 };
      const candidate = { sourceId: 'candidate', bookId: 'searched', title: saved.title, author: saved.author, category, variables: [] };
      const library = currentLibraryShelfChrome(); library.mode = 'results'; let input;
      library.selectResult(candidate, [candidate], [saved], { remote: value => { input = value; return true; },
        beginShelfRead: () => () => true, loadShelfBook: async (sourceId, bookId) => {
          assert.equal(category, 'novel'); assert.equal(savedType, undefined);
          assert.deepEqual([sourceId, bookId], [saved.sourceId, saved.bookId]); return { ...saved, contentKind: 'text' };
        },
        sourceName: () => '书源', failure: () => assert.fail('unexpected ambiguity') });
      if (savedType === undefined) await new Promise(resolve => setImmediate(resolve));
      assert.equal(input.seed.sourceId, (savedType ?? 'text') === (category === 'comic' ? 'manga' : 'text') ? 'canonical' : 'candidate',
        'cross-source work matching uses the confirmed shelf type, including a confirmed legacy text row');
      library.dispose();
    }
  }
  if (id === 'detail-directory-action') {
    const Entry = actualReadingEntryPresentation();
    const Journey = actualReaderDirectoryJourney();
    for (const contentKind of ['text', 'manga']) for (const sourceId of ['local', 'remote']) for (const origin of ['search', 'bookshelf']) {
      const entry = new Entry();
      entry.book = { sourceId, bookId: 'book', contentKind, title: '书名', author: '作者', sourceName: '来源' };
      const navigation = new ReaderNavigation(); navigation.show(origin); navigation.show('detail');
      let reads = 0;
      const journey = new Journey(navigation, { entry: () => entry, removalPending: () => false,
        scope: () => ({ mount: 1, retired: false, foreground: true, covered: false }), ownsRuntime: () => false,
        runtime: () => undefined, shelfBooks: () => [], publish: () => {}, advance: () => {},
        openReading: () => reads++, bindReader: () => reads++, requestExit: () => {}, showDownloads: () => {},
        afterReaderExitInDetail: () => {}, confirmOfflineClear: () => {}, feedback: () => {}, bookmarkFeedback: () => {} });
      const sdk = localBookDetailSdk({ sourceSwitchTriggerFocusId });
      const owner = sdk.owner;
      Object.assign(owner, { book: entry.book, toc: [], removing: false, appThemeScheme: 'day', readerWindowMetricsRevision: 1,
        onOpenDirectory: () => journey.open('detail'), onContinue: () => reads++, onSelectChapter: () => reads++ });
      if (contentKind === 'manga') owner.mangaCatalogHeading(); else owner.standardCatalogHeading();
      const walk = actor => [actor, ...[...actor.children.values()].flatMap(walk)];
      const actor = contentKind === 'manga' ? owner : walk(owner).find(child => child.specId === 'detail-directory');
      const hit = nodes(actor).find(node => node.type === 'Button' && typeof node.onClick === 'function');
      assert.ok(hit, 'actual complete-directory native actor'); hit.onClick();
      assert.equal(navigation.snapshot().route, 'directory');
      assert.equal(navigation.snapshot().directoryReturnTarget, 'detail');
      assert.equal(reads, 0);
      entry.presentPreparedPage(0, false, () => { reads++; navigation.show('reading'); return {}; });
      assert.equal(reads, 0, 'retired detail session rejects a late reader-ready notification');
      assert.equal(navigation.snapshot().route, 'directory');
    }
  }
  if (id === 'bookshelf-action-lanes') {
    const shared = iconButtonControls();
    const section = read('features/bookshelf/ui/BookshelfSectionHeader.ets');
    const geometry = pureModuleProbe(section.slice(0, section.indexOf('@Component')), 'BookshelfSectionHeaderGeometry.ets', {},
      ['SHELF_SECTION_ACTION_SIZE', 'SHELF_SECTION_TRACK_HEIGHT', 'SHELF_SECTION_TRACK_INSET',
        'SHELF_SECTION_PILL_HEIGHT', 'SHELF_SECTION_PILL_WIDTH']);
    for (const scale of [1, 1.3, 1.6, 2]) {
      const animations = [], frames = [];
      const owner = shared.consumer(section, boundedMembers(section), { ...readerTypographyRoles, ...surfaceFontResolvers(),
        ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: scale }) }, readerAppColor, TOK_SPACE_XS: 8,
        ...geometry, ...productionReaderMotionSdk(), ReaderPostLayoutFrame: actualReaderPostLayoutFrame() });
      owner.getUIContext = () => ({ animateTo: (options, transition) => { animations.push(options); transition(); },
        postFrameCallback: frame => frames.push(frame) });
      Object.assign(owner, { contentWidth: 320, windowRevision: 1, appThemeScheme: 'day' });
      owner.aboutToAppear(); owner.initialRender();
      const parent = nodes(owner).find(node => node.type === 'Row' && node.constraintSize !== undefined);
      assert.ok(parent.constraintSize.minHeight >= 44, 'the section parent reserves the expanded response height');
      const actors = [...owner.children.values()]; assert.equal(actors.length, 3);
      const segments = actors.filter(actor => actor.specId === 'shelf-view-segment');
      const filter = actors.find(actor => actor.specId === 'shelf-section');
      assert.equal(segments.length, 2);
      assert.ok(filter);
      for (const actor of actors) {
        assert.equal(shared.nodes(actor).find(node => node.type === 'Image').width, 15);
        const button = shared.nodes(actor).find(node => node.type === 'Button');
        assert.equal(button.width, 44);
        assert.equal(button.height, 44);
      }
      assert.ok(nodes(owner).some(node => node.type === 'Stack' && node.width === 88));
      const pill = () => nodes(owner).find(node => node.type === 'Row' && node.width === 38);
      assert.equal(pill().height, 28);
      assert.equal(pill().borderRadius, 14);
      assert.equal(pill().translate.x, 0);
      assert.ok(nodes(owner).some(node => node.type === 'Stack' && node.padding?.left === 3 && node.padding?.right === 3));
      shared.update(owner, { viewMode: 'list' }); owner.replay();
      assert.equal(pill().translate.x, 44, 'the same painted pill moves to the center of the next target');
      assert.equal(animations.at(-1).duration, productionReaderMotionSdk().motionAnimateParam('app.navigation.pill').duration);
      owner.__reduceMotion.reset(true);
      shared.update(owner, { viewMode: 'cover' }); owner.replay();
      assert.equal(pill().opacity, 0);
      const frame = frames.shift();
      frame.onFrame(0);
      frame.onIdle(0);
      owner.replay();
      assert.equal(pill().translate.x, 0);
      assert.equal(pill().opacity, 1);
      assert.equal(animations.at(-1).duration, 120);
      const hasFilterDot = () => nodes(owner).some(node => node.type === 'Row' && node.width === 6 &&
        node.opacity === 1 && node.backgroundColor === readerAppColor('TOK_PRIMARY_DARK', 'day'));
      assert.equal(hasFilterDot(), false);
      owner.hasActiveFilters = true; owner.replay();
      assert.equal(hasFilterDot(), true, 'collapsed active filter uses an independent pine dot');
      owner.filterExpanded = true; owner.replay();
      assert.equal(hasFilterDot(), false, 'expanded filter paints its button state without a second indicator');
      owner.actionsEnabled = false; owner.replay();
      assert.equal(parent.constraintSize.minHeight, Math.ceil(38 + readerTypographyRoles.TYPE_APP_SECTION_LABEL.lineHeightFp * (scale - 1)),
        'empty shelf keeps its authored heading height while omitting unavailable actions');
    }
    const source = read('features/bookshelf/ui/BookshelfGroupSelector.ets');
    const accessibility = pureModuleProbe(read('ui/controls/ReaderActionAccessibility.ets'), 'ReaderActionAccessibility.ets',
      { AccessibilityRoleType: { BUTTON: 'AccessibilityRoleType.BUTTON' } }, ['ReaderActionAccessibility']);
    const properties = createArkUIPropertyRuntimeProbe();
    const ReaderPressFeedback = productionReaderPressFeedback({ ColorMetrics: {
      resourceColor: color => ({ blendColor: () => ({ color: 'pressed-group-chip' }) }),
    } });
    const owner = createReaderBuilderProbe(source, boundedMembers(source), { ...properties.sdk, ...readerTypographyRoles, readerAppColor,
      ReaderPressFeedback, ...accessibility }, properties.hooks).owner;
    Object.assign(owner, { selectedGroup: '收藏分组', groups: [{ groupId: 2, groupName: '收藏分组' }],
      busy: false, appThemeScheme: 'day' }); owner.initialRender();
    const button = nodes(owner).find(node => node.type === 'Button' && node.accessibilityText === '默认分组');
    const paint = nodes(owner).find(node => node.type === 'Text' && node.create === '默认');
    assert.ok(button.constraintSize.minHeight >= 44 && button.constraintSize.minWidth >= 44);
    assert.equal(button.backgroundColor, 'Color.Transparent');
    assert.equal(paint.borderRadius, (readerTypographyRoles.TYPE_APP_FILTER_OPTION.lineHeightFp + 10) / 2);
    assert.deepEqual(paint.padding, { left: 12, right: 12, top: 5, bottom: 5 });
    assert.equal(paint.fontColor, readerAppColor('TOK_INK', 'day'));
    const modifier = owner.attributeCalls.find(call => call.id === button.id && call.property === 'attributeModifier').args[0];
    const pressed = {};
    const pressPort = new Proxy({}, { get: (_object, key) => value => { pressed[key] = value; return pressPort; } });
    modifier.applyPressedAttribute(pressPort);
    assert.equal(pressed.backgroundColor, 'pressed-group-chip');
    assert.equal(pressed.borderRadius, 999);
    const choices = [];
    owner.onSelect = group => choices.push(group);
    const clear = nodes(owner).find(node => node.type === 'Button' && node.accessibilityText === '清除分组');
    const named = nodes(owner).find(node => node.type === 'Button' && node.accessibilityText === '收藏分组');
    assert.ok(clear.enabled && named.enabled);
    named.onClick(); clear.onClick(); button.onClick();
    owner.busy = true; button.onClick(); clear.onClick();
    assert.deepEqual(choices, ['收藏分组', '', '']);
  }
  if (id === 'labeled-action-paint') {
    const specs = labeledIconSpecs();
    const roles = ['rss-feed', 'rss-entry', 'rss-management', 'rss-manage', 'rss-source-operations', 'rss-view-all', 'source-management-add', 'discover-apply', 'detail-directory'];
    for (const scale of [1, 1.3, 1.6, 2]) for (const specId of roles) {
      const foundation = foundationControls({ windowMetrics: () => ({ systemFontScale: scale }) });
      const sdk = labeledIconControls({ specs, foundation });
      const owner = new sdk.component(undefined, { specId, label: '操作', icon: 'icon', scheme: 'day', readerWindowMetricsRevision: 1 });
      owner.aboutToAppear(); owner.initialRender();
      const spec = specs.resolveReaderLabeledIconActionSpec(specId);
      const native = nodes(owner).find(node => node.type === 'Button') ?? nodes(owner).find(node => node.type === 'Row');
      assert.ok((native.constraintSize?.minHeight ?? native.height) >= 44, specId + ' native carrier pays44');
      const paint = nodes(owner).find(node => node.type === 'Row');
      const paintMinimum = specId === 'source-management-add' ? Math.ceil((spec.rowHeight ?? 44) + (spec.text.lineHeightFp ?? 20) * (scale - 1)) : spec.rowHeight ?? 44;
      assert.equal(paint.constraintSize?.minHeight ?? paint.height, paintMinimum, specId + ' retains its own paint role');
      assert.equal(paint.height === undefined || !spec.naturalHeight, true, specId + ' natural paint grows with native text');
      const glyph = nodes(owner).find(node => node.type === 'Image');
      assert.equal(glyph.width, spec.iconSize); assert.equal(glyph.height, spec.iconSize);
      assert.equal(glyph.width, spec.text.fontSizeFp >= 13 ? 16 : 14);
      const label = nodes(owner).find(node => node.type === 'Text');
      assert.equal(label.halfLeading, true);
      assert.equal(label.lineHeight, spec.text.lineHeightFp ?? Math.round(spec.text.fontSizeFp * 1.5));
      assert.ok(!paint.padding?.top && !paint.padding?.bottom, 'authored horizontal padding does not add a second44vp surface');
    }
  }
  if (id === 'select-watch-parent-delivery') {
    const frames = [], animations = [];
    let owner;
    const uiContext = { getFont: () => ({}), postFrameCallback: frame => frames.push(frame), animateTo(params, action) {
        const before = owner.expandedHeight;
        action();
        animations.push({ params, before, after: owner.expandedHeight });
      },
      getMeasureUtils: () => ({ measureText: () => 36, measureTextSize: () => ({ width: 36, height: 18 }) }), px2vp: n => n };
    const metrics = windowFacts.createDefaultReaderWindowMetrics(); metrics.windowRect.width = 366;
    const sdk = inlineSelectSdk({ uiContext, dependencies: { readerWindowMetrics: () => metrics } });
    owner = new sdk.dependencies.ReaderSelectPanel(undefined, { selectionId: 'one', reduceMotion: true, value: '自动', options: ['自动', '手动'] });
    const propNames = [...read('ui/controls/ReaderSelectPanel.ets').matchAll(/^\s*@Prop[^\n]*?\s(\w+):/gm)].map(match => match[1]);
    const deliver = patch => owner.updateStateVars({ ...Object.fromEntries(propNames.map(name => [name, owner[name]])), ...patch });
    let renderingParent = false;
    const dismissed = [];
    owner.onDismiss = identity => { assert.equal(renderingParent, false, 'child does not synchronously mutate its rendering parent'); dismissed.push(identity); };
    owner.aboutToAppear();
    renderingParent = true;
    deliver({ closing: true });
    assert.equal(owner.closeInFlight, true, 'watch closes input synchronously');
    assert.deepEqual(dismissed, []);
    renderingParent = false;
    const finishFade = () => {
      const fade = animations.filter(animation => animation.params.onFinish !== undefined).at(-1);
      assert.equal(fade.params.duration, 120);
      assert.equal(fade.before, fade.after, 'reduced dismissal does not animate panel geometry');
      assert.equal(owner.panelOpacity, 0);
      fade.params.onFinish();
    };
    finishFade();
    frames.splice(0).forEach(frame => frame.onFrame());
    assert.deepEqual(dismissed, ['one']);
    deliver({ selectionId: 'two', closing: false });
    renderingParent = true;
    deliver({ closing: true });
    renderingParent = false;
    const retiredFade = animations.filter(animation => animation.params.onFinish !== undefined).at(-1);
    deliver({ selectionId: 'three', closing: false });
    retiredFade.params.onFinish();
    frames.splice(0).forEach(frame => frame.onFrame());
    assert.deepEqual(dismissed, ['one'], 'a later presentation invalidates the queued close completion');
    deliver({ reduceMotion: false });
    owner.closeInFlight = true; owner.closeFinish = () => owner.onDismiss(owner.selectionId);
    renderingParent = true; deliver({ reduceMotion: true }); renderingParent = false;
    assert.deepEqual(dismissed, ['one']);
    finishFade();
    frames.splice(0).forEach(frame => frame.onFrame());
    assert.deepEqual(dismissed, ['one', 'three']);
  }
  if (id === 'directory-watch-parent-delivery') {
    const source = read('ui/controls/ReaderSearchField.ets');
    const frameSource = source.slice(source.indexOf('class ReaderSearchFocusFrame'), source.indexOf('@Component'));
    const frameClass = pureModuleProbe(frameSource, 'ReaderSearchFocusFrame.ets', { FrameCallback: class {} }, ['ReaderSearchFocusFrame']);
    const frames = [], calls = [];
    let renderingParent = false;
    const properties = createArkUIPropertyRuntimeProbe();
    const members = ['directoryFocusId', 'directoryFocusAllowed', 'directoryFocusRevision', 'directoryFocusCurrent', 'directoryFocusTicket',
      'directoryFocusScheduledRevision', 'directoryKeyboardRestorePendingRevision', 'directoryKeyboardRestorePendingTicket', 'directoryLayoutId',
      'directoryNativeFocused', 'directoryInputLoaded', 'directoryFocusAppliedRevision', 'onDirectoryFocusChanged', 'mounted', 'variant', 'mode',
      'onDirectoryFocusRequest', 'queueDirectoryFocus', 'directoryFocusEnabled'];
    const owner = createReaderBuilderProbe(source, members, { ...properties.sdk, ...frameClass,
      uiContext: { postFrameCallback: frame => frames.push(frame) } }, properties.hooks).owner;
    Object.assign(owner, { mounted: true, variant: 'readerDirectory', mode: 'live', directoryFocusId: 'one', directoryLayoutId: 'one',
      directoryInputLoaded: true, directoryNativeFocused: true, directoryFocusAllowed: true, directoryFocusRevision: 0,
      onDirectoryFocusChanged: (identity, focused) => { assert.equal(renderingParent, false); calls.push([identity, focused]); } });
    const focusProps = ['directoryFocusId', 'directoryFocusAllowed', 'directoryFocusRevision', 'variant', 'mode'];
    const deliver = patch => owner.updateStateVars({ ...Object.fromEntries(focusProps.map(name => [name, owner[name]])), ...patch });
    renderingParent = true; deliver({ directoryFocusAllowed: false }); renderingParent = false;
    assert.equal(owner.directoryNativeFocused, false); assert.equal(owner.directoryFocusEnabled('one'), false);
    assert.deepEqual(calls, []);
    const current = frames.splice(0); current.forEach(frame => frame.onFrame()); assert.deepEqual(calls, [['one', false]]);
    current.forEach(frame => frame.onIdle()); assert.deepEqual(calls, [['one', false]], 'optional idle delivery adds no duplicate parent callback');
    owner.directoryNativeFocused = true;
    renderingParent = true; deliver({ directoryFocusRevision: 1 }); renderingParent = false;
    deliver({ directoryFocusId: 'two' });
    frames.splice(0).forEach(frame => frame.onFrame());
    assert.deepEqual(calls, [['one', false]], 'an old layout identity cannot notify its successor');
  }
  if (id === 'dialog-action-budget') {
    const source = read('ui/surfaces/ReaderDialogSurface.ets');
    const { DialogActionView } = pureModuleProbe(source.slice(0, source.indexOf('@Component')), 'DialogActionView.ets', {}, ['DialogActionView']);
    const font = new URL('../entry/src/main/resources/rawfile/NotoSansSC-UIMedium.otf', import.meta.url).pathname;
    let wrapped = 0;
    for (const width of [320, 366]) for (const safe of [0, 40]) for (const scale of [1, 1.3, 1.6, 2])
      for (const [specId, labels] of [['json-import', ['从在线链接导入']], ['book-removal', ['取消预览', '确认示例']]]) {
      const metrics = windowFacts.createDefaultReaderWindowMetrics();
      metrics.windowRect.width = width; metrics.windowRect.height = 844; metrics.systemFontScale = scale;
      metrics.systemInsets.left = safe; metrics.systemInsets.right = safe;
      const properties = createArkUIPropertyRuntimeProbe();
      const owner = createReaderBuilderProbe(source, ['actions', 'actionsRow', 'actionCell', 'action', 'actionHeight', 'fontScale', 'spec',
        'actionLabelColor', 'actionModifier', 'actionSurfaceRole', 'actionTouchRegion', 'frameWidth', 'framePadding', 'resolvedFrame', 'readerWindowMetricsRevision'],
        { DialogActionView, ...properties.sdk, ...readerTypographyRoles, ...readerMessageStyles, ...surfaceFontResolvers(),
          ...horizontalFrame, ...windowFacts, ...readerSurfaceSpecsForProbe(), readerAppColor, readerWindowMetrics: () => metrics }, properties.hooks).owner;
      Object.assign(owner, { specId, appThemeScheme: 'day', readerWindowMetricsRevision: 1,
        actions: labels.map((label, index) => new DialogActionView(String(index), label)), onAction: () => {} });
      owner.actionsRow();
      const button = nodes(owner).find(node => node.type === 'Button');
      const lane = (owner.frameWidth() - owner.spec().padding * 2 - (labels.length - 1) * 10) / labels.length;
      const textWidth = Math.max(...labels.map(label => Number(execFileSync('python3', ['-c', 'from PIL import ImageFont\nimport sys\nf=ImageFont.truetype(sys.argv[1],round(float(sys.argv[2])*100))\nprint(f.getlength(sys.argv[3])/100)',
        font, String(readerMessageStyles.MESSAGE_ACTION.fontSizeFp * scale), label], { encoding: 'utf8', timeout: 10000 }))));
      const lines = Math.ceil(textWidth / lane);
      const labelHeight = lines * readerMessageStyles.MESSAGE_ACTION.lineHeightFp * scale;
      const oldHeight = owner.actionHeight();
      assert.equal(button.height, undefined, 'dialog action keeps a natural multi-line height');
      assert.ok(button.constraintSize.minHeight >= 44);
      assert.equal(button.responseRegion.height, '100%', 'the whole grown native carrier remains actionable');
      if (labelHeight > oldHeight) wrapped++;
      assert.ok(Math.max(button.constraintSize.minHeight, labelHeight + button.padding.top + button.padding.bottom) >= labelHeight);
    }
    assert.ok(wrapped > 0, 'current two-column preview actions wrap beyond the old fixed single-line height');
  }
  if (id === 'menu-divider-current') {
    const source = read('ui/surfaces/ReaderActionMenuSurface.ets');
    const { ReaderMenuActionView } = pureModuleProbe(source.slice(0, source.indexOf('@Component')), 'ReaderMenuActionView.ets', {}, ['ReaderMenuActionView']);
    const properties = createArkUIPropertyRuntimeProbe();
    const available = boundedMembers(source);
    const members = ['actions', 'menuActions', 'actionRow', 'action', 'spec', 'fontScale', 'effectiveScheme', 'menuActionHeight', 'dividerWidth', 'hasFollowingAction', 'nativeId', 'actionIdPrefix', 'commitAction', 'mounted'].filter(name => available.includes(name));
    const requests = [];
    const ReaderPressFeedback = productionReaderPressFeedback({ ColorMetrics: {
      resourceColor: color => { requests.push(color); return { blendColor: () => ({ color: 'pressed-ink' }) }; },
    } });
    const owner = createReaderBuilderProbe(source, members,
      { ReaderMenuActionView, ReaderPressFeedback, ...properties.sdk, ...readerSurfaceSpecsForProbe(), ...surfaceFontResolvers(), readerAppColor, readerWindowMetrics: () => ({ systemFontScale: 1 }) },
      { ...properties.hooks, allowEmptyBranchAdmission: true }).owner;
    Object.assign(owner, { specId: 'reader-more-menu', scheme: 'day', appThemeScheme: 'day', availableWidth: 240, viewportHeight: 300, nativeId: 'menu', mounted: true,
      actions: [new ReaderMenuActionView('one', '第一个动作')] });
    owner.menuActions();
    const target = nodes(owner).find(node => node.id === 'menu-item-one');
    const fired = [];
    owner.onAction = action => fired.push(action);
    target.onClick(); assert.deepEqual(fired, ['one']);
    const currentModifier = () => owner.attributeCalls.filter(call => call.property === 'attributeModifier' &&
      call.id === [...owner.nodes].find(([, node]) => node === target)[0]).at(-1).args[0];
    const paint = {};
    const port = new Proxy({}, { get: (_object, key) => value => { paint[key] = value; return port; } });
    currentModifier().applyPressedAttribute(port);
    assert.equal(paint.backgroundColor, 'pressed-ink');
    assert.deepEqual(requests, [readerAppColor('app.interaction.press', 'day'), 'Color.Transparent']);
    owner.actions = [new ReaderMenuActionView('one', '第一个动作'), new ReaderMenuActionView('two', '第二个动作')]; owner.replay();
    assert.equal(nodes(owner).filter(node => node.type === 'Row' && node.position !== undefined).length, 1,
      'a retained former last action acquires its current divider');
    owner.actions = [new ReaderMenuActionView('one', '第一个动作', false), new ReaderMenuActionView('two', '第二个动作')];
    owner.replay(); target.onClick();
    assert.deepEqual(fired, ['one']);
    currentModifier().applyPressedAttribute(port);
    assert.equal(paint.backgroundColor, 'Color.Transparent');
    assert.equal(requests.length, 2, 'disabled menu actions skip neutral ink composition');
  }
  if (id === 'main-rail-current') {
    const product = pureModuleProbe(read('app/ReaderProductScope.ts'), 'ReaderProductScope.ts', {}, ['isReaderMainTabEnabled']);
    const tabs = pureModuleProbe(read('app/navigation/ReaderMainTabs.ts'), 'ReaderMainTabs.ts', product, ['MAIN_TABS', 'readerMainTabIconResource']);
    const labelHeight = selectedProductionValues(new URL('../entry/src/main/ets/ui/foundation/ReaderLayoutTokens.ts', import.meta.url), ['MAIN_TAB_LABEL_LINE_HEIGHT']);
    const floating = pureModuleProbe(read('ui/layout/ReaderFloatingBarMetrics.ts'), 'ReaderFloatingBarMetrics.ts',
      { ...surfaceFontResolvers(), ...labelHeight }, ['readerMainTabItemHeight']);
    const specSource = read('features/shell/MainNavigationSpec.ts').replace(/^export(?: type)? \{[^}]*\}[^;]*;\n/gm, '');
    const spec = pureModuleProbe(specSource, 'MainNavigationSpec.ts', { ...tabs, ...floating },
      ['MAIN_TAB_RAIL_ITEM_GAP', 'MAIN_TAB_RAIL_PADDING', 'MAIN_TAB_RAIL_WIDTH', 'mainTabRailHeight']);
    function Raised(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
    const properties = createArkUIPropertyRuntimeProbe();
    const source = read('features/shell/MainTabBar.ets');
    const owner = createReaderBuilderProbe(source, ['current', 'verticalRail', 'tabItem', 'tabIcon', 'navigationFontScale'],
      { ...properties.sdk, ...tabs, ...floating, ...spec, ...readerTypographyRoles, readerAppColor, ReaderRaisedSurface: Raised,
        ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) } },
      { ...properties.hooks, childSources: { ReaderRaisedSurface: read('ui/surfaces/ReaderRaisedSurface.ets') } }).owner;
    const calls = [];
    Object.assign(owner, { current: 'bookshelf', appThemeScheme: 'day', railSurfaceWidth: 82, railSurfaceHeight: 138, readerWindowMetricsRevision: 1,
      onSelect: key => calls.push(['select', key]), onCurrentTap: key => calls.push(['current', key]) });
    owner.verticalRail();
    const actors = nodes(owner).filter(node => node.accessibilityRole === 'AccessibilityRoleType.BUTTON');
    assert.equal(actors.length, tabs.MAIN_TABS.length);
    const ids = [...owner.nodes.keys()];
    owner.current = 'settings'; owner.replay();
    assert.deepEqual([...owner.nodes.keys()], ids);
    assert.deepEqual(actors.map(node => node.accessibilitySelected), tabs.MAIN_TABS.map(tab => tab.key === 'settings'));
    actors.find(node => node.accessibilityText.startsWith('书架')).onClick();
    actors.find(node => node.accessibilityText.startsWith('设置')).onClick();
    assert.deepEqual(calls, [['select', 'bookshelf'], ['current', 'settings']]);
    assert.ok(nodes(owner).filter(node => node.type === 'Image').every(node => node.width === 24 && node.height === 24));
  }
  if (id === 'no-cover-graphic') {
    const { ShelfBookPresentation } = await import('../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts');
    const source = read('ui/patterns/NoCoverCover.ets');
    const detailProperties = createArkUIPropertyRuntimeProbe();
    const coverComponent = createReaderBuilderProbe(source, ['coverWidth', 'coverHeight', 'appThemeScheme', 'kindLabel', 'glyph',
      'build', 'x', 'y', 'scaleCoverUnit', 'isComic', 'titleUnits'], { ...detailProperties.sdk, readerAppColor }, detailProperties.hooks).Component;
    const detailSdk = localBookDetailSdk({ NoCoverCover: coverComponent }, {}, detailProperties);
    assert.equal(ShelfBookPresentation.contentLabel(undefined), '');
    const textNodes = owner => nodes(owner).filter(node => node.type === 'Text').map(node => node.create);
    for (const [sourceId, contentKind, label] of [['source', 'manga', '漫画'], ['source', 'text', '小说'],
      ['source', 'audio', '有声'], ['source', undefined, ''], ['local', undefined, '小说']]) {
      assert.equal(ShelfBookPresentation.contentLabel({ sourceId, contentKind }), label);
      const book = { title: '归途', sourceId, bookId: 'same-book', contentKind };
      const detail = new detailSdk.Component(undefined, { book });
      detail.detailCover(86, 118);
      detail.bookTags();
      const graphic = [...detail.children.values()].find(child => child instanceof coverComponent);
      assert.ok(graphic, 'the detail mounts its fallback cover');
      const origin = sourceId === 'local' ? '本地藏书' : '在线';
      assert.deepEqual(textNodes(graphic), label === '' ? [book.title] : [book.title, label], `detail cover for ${sourceId}/${contentKind}`);
      assert.deepEqual(textNodes(detail), label === '' ? [origin] : [label, origin], `detail tags for ${sourceId}/${contentKind}`);
      if (contentKind === 'text') {
        detail.updateStateVars({ book: { ...book, sourceId: 'local', contentKind: 'audio' } });
        detailProperties.flush();
        assert.deepEqual(textNodes(graphic), [book.title, '有声']);
        assert.deepEqual(textNodes(detail), ['有声', '本地藏书']);
      }
    }
    const longTitle = '海边旧书店的漫长假期'.repeat(4);
    for (const [width, height] of [[48, 80], [60, 160], [84, 122], [90, 124], [128, 168]]) {
      const unit = Math.min(width / 90, height / 124);
      for (const scheme of ['day', 'night']) {
        for (const [kindLabel, comic] of [['小说', false], ['漫画', true], ['', false]]) {
          const owner = createReaderBuilderProbe(source, ['build', 'x', 'y', 'scaleCoverUnit', 'isComic', 'titleUnits'], { readerAppColor }).owner;
          Object.assign(owner, { coverWidth: width, coverHeight: height, appThemeScheme: scheme, glyph: longTitle, kindLabel });
          owner.initialRender();
          const emitted = nodes(owner);
          const frame = emitted.find(node => node.width === width && node.height === height);
          assert.equal(frame.backgroundColor, readerAppColor('TOK_PAPER', scheme));
          assert.equal(frame.hitTestBehavior, 'HitTestMode.None');
          assert.equal(frame.accessibilityLevel, 'no-hide-descendants');
          const texts = emitted.filter(node => node.type === 'Text');
          assert.ok(texts.every(node => !String(node.create).includes('封面')), 'no "no cover" notice is painted');
          const title = texts.find(node => node.create === longTitle);
          assert.equal(title.maxLines, 5);
          assert.equal(title.wordBreak, 'WordBreak.BREAK_ALL');
          assert.deepEqual(title.textOverflow, { overflow: 'TextOverflow.Ellipsis' });
          assert.equal(title.fontSize, `${8.5 * unit}vp`);
          assert.equal(title.fontFamily, comic ? readerTypographyRoles.TYPE_SHELF_COVER_PLACEHOLDER.fontFamily :
            readerTypographyRoles.TYPE_READER_CHAPTER_TITLE.fontFamily, 'novel serif title, comic bold sans title');
          const titleBox = emitted.find(node => node.type === 'Stack' && node.width === 70 * width / 90);
          const cjkPerLine = Math.floor(titleBox.width / Number.parseFloat(title.fontSize));
          const lines = Math.ceil(Array.from(longTitle).length / cjkPerLine);
          assert.ok(lines <= title.maxLines && lines * Number.parseFloat(title.lineHeight) <= titleBox.height,
            'the forty-character CJK title fits both the line limit and the available height');
          const rows = emitted.filter(node => node.type === 'Row');
          const band = rows.some(node => node.backgroundColor === readerAppColor('app.status.warningSoft', scheme));
          assert.equal(band, comic, 'only comics carry the tinted panel band');
          const spine = rows.some(node => node.height === height && node.width === 8 * width / 90);
          assert.equal(spine, !comic, 'only novels carry the paper spine');
          const label = texts.find(node => node.create === kindLabel);
          if (kindLabel.length === 0) assert.equal(texts.length, 1, 'no kind label without a kind');
          else assert.equal(label.maxLines, 1);
        }
      }
    }
    const owner = createReaderBuilderProbe(source, ['build', 'x', 'y', 'scaleCoverUnit', 'isComic', 'titleUnits'], { readerAppColor }).owner;
    for (const [glyph, size] of [['短书', 15], ['八个字的书名吧', 13], ['十四个字以内的书名还算比较长', 11.5]]) {
      Object.assign(owner, { coverWidth: 90, coverHeight: 124, glyph, kindLabel: '小说' });
      assert.equal(owner.titleUnits(), size);
    }
    const discover = read('features/discover/ui/DiscoverPage.ets');
    const book = { sourceId: 'source', bookId: 'book', category: 'novel', name: longTitle, author: '', intro: '', coverUrl: '  ' };
    const cover = class { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } };
    const properties = createArkUIPropertyRuntimeProbe();
    const { owner: page } = createReaderBuilderProbe(discover,
      ['resultRow', 'currentBook', 'coverUrl', 'coverErrorHandler', 'failedCoverGeneration', 'failedCoverUrls'],
      { ...properties.sdk, readerSourceCategoryLabel, NoCoverCover: cover },
      { ...properties.hooks, childSources: { NoCoverCover: source } });
    Object.assign(page, { mounted: true, presentation: { books: [book], operation: { generation: 1 } } });
    page.resultRow(book);
    assert.deepEqual([...page.children.values()][0].params,
      { coverWidth: 52, coverHeight: 74, glyph: longTitle, kindLabel: '小说' });
    book.coverUrl = 'https://example.test/cover.png';
    page.resultRow(book);
    const failed = nodes(page).find(node => node.type === 'Image').onError;
    // Capture the branch selected by the SDK update. The host probe cannot
    // unmount one non-empty native branch and mount another.
    const updates = [];
    page.ifElseBranchUpdateFunction = branch => updates.push(branch);
    failed();
    properties.flush();
    assert.ok(updates.includes(1), 'the original image row reacts to the first failure and selects its fallback branch');
    assert.equal(page.coverUrl(book), '');
    page.presentation.operation.generation++;
    failed();
    assert.equal(page.coverUrl(book), book.coverUrl, 'a retired image failure must not suppress a fresh cover');
  }
  if (id === 'compact-source-paint') {
    for (const fontScale of [1, 1.3, 1.6, 2]) for (const [specId, paintHeight, label] of [
      ['source-management-category', 32, '小说'], ['source-management-detect', 28, '检测'], ['source-management-login', 28, '登录'],
    ]) {
      const controls = foundationControls({ windowMetrics: () => ({ systemFontScale: fontScale }) });
      const spec = foundationSpecs().resolveReaderButtonSpec(specId);
      const owner = controls.button.owner;
      Object.assign(owner, { specId, label, scheme: 'day', primary: false, layout: 'intrinsic', actionEnabled: true, isBusy: false,
        availableWidth: 320, selectionSemantic: specId === 'source-management-category', focusId: '', actionAccessibilityLabel: label,
        onFocused: () => {}, onAction: () => {}, readerWindowMetricsRevision: 1 });
      owner.aboutToAppear(); owner.initialRender();
      const button = nodes(owner).find(node => node.type === 'Button');
      const text = nodes(owner).find(node => node.type === 'Text' && node.create === label);
      assert.equal(button.backgroundColor, 'Color.Transparent');
      if (specId === 'source-management-detect') {
        const row = nodes(owner).find(node => node.type === 'Row' && node.alignItems === 'VerticalAlign.Center');
        assert.equal(row.translate, undefined, 'detect label keeps its native vertical center');
        assert.equal(text.halfLeading, true);
        assert.equal(text.lineHeight, 17);
        assert.ok(button.width >= 44 && button.height >= 44);
        continue;
      }
      assert.equal(button.constraintSize.minWidth, 44); assert.equal(button.constraintSize.minHeight, 44);
      assert.equal(text.height, Math.ceil(paintHeight + (spec.text.lineHeightFp ?? spec.text.fontSizeFp * 1.5) * (fontScale - 1)));
      assert.equal(text.textAlign, 'TextAlign.Center');
      assert.equal(spec.text.fontSizeFp, text.fontSize, 'font role stays unchanged');
      assert.ok(text.height >= (spec.text.lineHeightFp ?? spec.text.fontSizeFp * 1.5) * fontScale, 'paint pays the enlarged text line');
      if (spec.fixedWidth) assert.equal(text.width, spec.fixedWidth * fontScale);
      assert.equal(text.accessibilityLevel, 'no');
    }
  }
  if (id === 'tablet-select-admission') {
    const uiContext = { getFont: () => ({}), px2vp: n => n, getMeasureUtils: () => ({ measureText: () => 36, measureTextSize: () => ({ width: 36, height: 18 }) }) };
    const sdk = inlineSelectSdk({ uiContext, dependencies: { readerWindowMetrics: () => ({ windowRect: { width: 366 }, systemFontScale: 1 }) } });
    const owner = new sdk.dependencies.ReaderSelect(undefined, {});
    let toggles = 0;
    Object.assign(owner, { value: '自动', options: ['自动', '手动'], variant: 'settingsTablet', controlWidth: 100, maxTriggerWidthVp: -1,
      readerWindowMetricsRevision: 1, appThemeScheme: 'day', actionEnabled: true, isOpen: false, focusId: 'tablet-select', onToggle: () => toggles++ });
    owner.aboutToAppear(); owner.initialRender();
    const button = nodes(owner).find(node => node.type === 'Button');
    assert.ok(button, 'tablet shares the native trigger carrier');
    assert.ok(button.height >= 44); assert.equal(button.id, 'tablet-select');
    button.onClick(); assert.equal(toggles, 1);
    owner.actionEnabled = false; button.onClick(); assert.equal(toggles, 1, 'retained tablet callback reads current eligibility');
    owner.actionEnabled = true; owner.aboutToDisappear(); button.onClick(); assert.equal(toggles, 1, 'retired tablet callback is inert');
  }
  if (id === 'dialog-current-actions') {
    const source = read('ui/surfaces/ReaderDialogSurface.ets');
    const { DialogActionView } = pureModuleProbe(source.slice(0, source.indexOf('@Component')), 'DialogActionView.ets', {}, ['DialogActionView']);
    const properties = createArkUIPropertyRuntimeProbe();
    const available = boundedMembers(source);
    const members = ['actions', 'actionsRow', 'actionCell', 'action', 'actionHeight', 'fontScale', 'spec',
      'actionLabelColor', 'actionModifier', 'actionSurfaceRole', 'actionTouchRegion', 'mounted', 'aboutToAppear', 'aboutToDisappear'].filter(name => available.includes(name));
    const owner = createReaderBuilderProbe(source, members,
      { DialogActionView, ...properties.sdk, ...readerTypographyRoles, ...readerMessageStyles, ...surfaceFontResolvers(), ...readerSurfaceSpecsForProbe(), readerAppColor,
        readerWindowMetrics: () => ({ systemFontScale: 1 }) }, properties.hooks).owner;
    const calls = [];
    Object.assign(owner, { specId: 'book-removal', appThemeScheme: 'day', readerWindowMetricsRevision: 1,
      actions: [new DialogActionView('apply', '原动作', 'primary', true)], onAction: value => calls.push(value) });
    owner.aboutToAppear?.(); owner.actionsRow();
    const button = nodes(owner).find(node => node.type === 'Button');
    button.onClick(); assert.deepEqual(calls, ['apply']);
    const ids = [...owner.nodes.keys()];
    owner.actions = [new DialogActionView('apply', '等待', 'primary', false)]; owner.replay();
    assert.deepEqual([...owner.nodes.keys()], ids, 'same-id action retains its native actor');
    assert.equal(button.enabled, false, 'same-id replacement refreshes the physical enabled property');
    assert.equal(nodes(owner).find(node => node.type === 'Text').create, '等待');
    button.onClick(); assert.deepEqual(calls, ['apply'], 'retained callback cannot use the immutable old action');
    owner.actions = []; button.onClick(); assert.deepEqual(calls, ['apply'], 'removed current action cannot dispatch');
  }
  if (id === 'detail-hero-source') {
    const sourceName = '长书源Source'.repeat(14);
    const owner = localBookDetailSdk({ sourceSwitchTriggerFocusId, WordBreak: { BREAK_ALL: 'break-all' } }).owner;
    Object.assign(owner, { book: { sourceId: 'remote', bookId: 'book', contentKind: 'text', title: '书名', author: '作者', sourceName, lastChapter: '' },
      hasCover: () => true, displayCoverUrl: () => 'cover', headerSpec: { contentGap: 16, contentUnderlap: 8 }, appThemeScheme: 'day',
      sourceSwitchEnabled: true, READER_ACTION_MIN_TARGET: 44, onSwitchSource: () => {} });
    owner.standardHero(); owner.readingFacts();
    const titleColumn = nodes(owner).find(node => node.type === 'Column' && node.layoutWeight === 1);
    assert.equal(titleColumn.padding, undefined, 'hero title and cover share the same parent start');
    const sourceLabel = nodes(owner).find(node => node.type === 'Text' && node.create === `当前来源：${sourceName}`);
    assert.ok(sourceLabel, 'the complete source label reaches the native Text');
    assert.equal(sourceLabel.maxLines, undefined, 'novel detail displays the complete source name');
    assert.equal(sourceLabel.wordBreak, 'break-all', 'unbroken source names wrap in the available column');
    const sourcePaint = nodes(owner).find(node => node.type === 'Text' && node.create === '换源');
    assert.equal(sourcePaint.constraintSize?.minHeight, undefined, '44vp target does not become the filled source paint');
    assert.deepEqual(sourcePaint.padding, { left: 12, right: 12, top: 5, bottom: 5 });
    assert.equal(sourcePaint.fontSize, 12); assert.equal(sourcePaint.lineHeight, 18);
    const sourceButton = nodes(owner).find(node => node.type === 'Button');
    assert.equal(sourceButton.constraintSize.minWidth, 44); assert.equal(sourceButton.constraintSize.minHeight, 44);
    assert.equal(sourceButton.flexShrink, 0, 'wrapping does not shrink the adjacent switch action');
    for (const top of [0, 24]) {
      const metrics = windowFacts.createDefaultReaderWindowMetrics();
      metrics.windowRect.width = 366; metrics.windowRect.height = 844; metrics.systemInsets.top = top;
      const geometryOwner = localBookDetailSdk({ sourceSwitchTriggerFocusId, ReaderWindowCoordinator: { metrics: () => metrics } }).owner;
      Object.assign(geometryOwner, { book: { sourceId: 'remote', bookId: 'book', contentKind: 'text' },
        viewportWidth: 366, viewportHeight: 844, measurementKey: 1, readerWindowMetricsRevision: 1 });
      geometryOwner.refreshGeometry();
      assert.equal(geometryOwner.geometry.content.startInset, geometryOwner.geometry.header.clearance,
        'the initial hero starts after the complete header clearance at either safe-top');
      assert.equal(geometryOwner.geometry.content.startInset - geometryOwner.geometry.header.bottom, 16);
    }
  }
  recordContractCasePass(id);
}

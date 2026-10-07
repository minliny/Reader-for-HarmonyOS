import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { mangaRowBuilderMembers, mangaGridProbeDependencies } from './lib/manga-directory-grid-probe.mjs';
import { productionMangaDirectoryNavigationDataSource, mangaDirectoryNavigationListSource as listSource } from './lib/manga-directory-navigation-data-source-probe.mjs';
import * as fonts from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { ReaderDirectoryTrace } from '../entry/src/main/ets/features/reading/ReaderDirectoryTrace.ts';
import { openReaderDirectoryNavigation, readerDirectoryScopeKey, readerDirectoryToggleCollapsed, readerDirectoryCollapsedIds } from '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';
import { readerDirectorySaveViewportAnchor, readerDirectoryViewportAnchor } from '../entry/src/main/ets/features/reading/ReaderDirectoryViewport.ts';
const surfaceSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets', import.meta.url), 'utf8');
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const node = index => ({ nodeId: `chapter-${index}`, title: String(index).padStart(4, '0'), kind: 'target', depth: 2,
  chapterIndex: 10000 + index * 3, chapterOffsetScalar: 0, parentId: 'volume', parentTitle: '第一卷', hasChildren: false, expanded: false });
const catalog = Array.from({ length: 9000 }, (_, index) => node(index));
catalog[0] = { ...node(0), nodeId: 'volume', title: '第一卷', kind: 'group', depth: 1, chapterIndex: undefined, parentId: undefined, parentTitle: undefined, hasChildren: true, expanded: true, readableDescendantCount: 8999 };

function listFixture(data, view, quick, source = listSource) {
  const native = [], scrolls = [], anchors = [], properties = createArkUIPropertyRuntimeProbe();
  const Grid = new Proxy({}, { get: (_target, key) => (...args) => { if (key === 'create') native.push({ args }); else if (key !== 'pop') native.at(-1)[key] = args[0]; } });
  const { owner } = createReaderBuilderProbe(source, [...mangaRowBuilderMembers, 'mangaPresentationRevision', 'build', 'row', 'rowKey', 'planPosition', 'positionInitialCurrent', 'positionRowHeight', 'captureViewportAnchor'], {
    ...mangaGridProbeDependencies, ...fonts, ...properties.sdk, Grid, LazyForEach: new Proxy({}, { get: () => () => {} }),
    readerDirectoryScopeKey, readerDirectoryViewportAnchor, readerDirectorySaveViewportAnchor: anchor => anchors.push(anchor),
    ScrollAlign: { START: 'start', CENTER: 'center' }, LengthMetrics: { vp: value => ({ value }) },
  }, properties.hooks);
  Object.assign(owner, { view, dataSource: data, mangaDisplay: true, mangaQuickDisplay: quick, mangaSearchActive: false,
    mangaCatalogDisplay: false, mangaCatalogNarrow: false, mangaPresentationRevision: 0, mangaGridSpans: new Map(),
    windowMetricsRevision: 0, mangaViewportWidth: 393, mangaInitialViewportWidth: 393, listPaddingX: 0, listPaddingRight: 0,
    mangaVisibleTopInset: 0, listPaddingY: 0, listPaddingTop: -1, listPaddingBottom: -1, contentStartInset: 0, contentEndInset: 0,
    currentChapterIndex: view.currentVisibleIndex === 0 ? -1 : catalog[view.currentVisibleIndex].chapterIndex,
    chapterByIndex: new Map(), chapterDownloadEnabled: false, chapterDownloadActionsEnabled: false,
    mangaScheme: 'day', appThemeScheme: 'day', interactionEnabled: true, edgeEffectMode: 'none',
    sourceId: view.identity.sourceId, bookId: view.identity.bookId, initialPositionPending: true,
    onFirstLayout() {}, onScrollSettled() {}, onUserScrollIntent() {}, onScrollOffset() {},
    scroller: { scrollToIndex: (...args) => scrolls.push(args), getItemRect: () => ({ y: -11, height: 44 }) } });
  return { owner, properties, native, scrolls, anchors };
}

let matrixRun = 0;
async function openingMatrix(candidate = surfaceSource, listCandidate = listSource) {
  const run = ++matrixRun;
  for (const current of [1, 4096, 8999]) {
    const production = productionMangaDirectoryNavigationDataSource(listCandidate), requests = [], pageRequests = [];
    const identity = { sourceId: `quick-complete-${run}-${current}`, bookId: 'book' }, scope = readerDirectoryScopeKey(identity.sourceId, identity.bookId);
    const ready = { status: 'ready', identity, viewId: `quick-${current}`, navigationRevision: 'revision', visibleTotal: catalog.length,
      currentVisibleIndex: current, nodes: catalog.slice(0, 256) };
    // The Core boundary returns controlled, explicit ready/search projections.
    const searchProjection = { ...ready, viewId: `search-${current}`, visibleTotal: 1, currentVisibleIndex: 0, nodes: [catalog[8999]] };
    const gateway = { open: async query => { requests.push(query); return query.query?.length > 0 ?
        { ...searchProjection, nodes: [catalog[8999]] } : { ...ready, nodes: catalog.slice(0, 256) }; },
      page: async (_book, viewId, offset, guard) => { assert.equal(guard(), true); pageRequests.push(offset);
        return { viewId, visibleTotal: catalog.length, nodes: catalog.slice(offset, offset + 256) }; } };
    await openReaderDirectoryNavigation(gateway, { ...identity, limit: 256 }, () => true);
    readerDirectoryToggleCollapsed(scope, 'revision', 'volume');
    const anchor = { bookId: scope, navigationRevision: 'revision', viewId: 'full-old', nodeId: 'chapter-20', visibleIndex: 20, rowFraction: .25 };
    readerDirectorySaveViewportAnchor(anchor);
    const properties = createArkUIPropertyRuntimeProbe();
    const { owner: surface } = createReaderBuilderProbe(candidate,
      ['openTree', 'prepareVisiblePages', 'prepareMangaFonts', 'mangaFontsReady', 'mangaFontGeneration', 'mangaFontTask'], {
        ...properties.sdk, openReaderDirectoryNavigation, readerDirectoryScopeKey, readerDirectoryViewportAnchor,
        prepareMangaSheetFonts: async () => true, ReaderDirectoryTrace,
        cacheReaderDirectoryNavigationPage: production.cacheReaderDirectoryNavigationPage,
      }, properties.hooks);
    Object.assign(surface, { mounted: true, generation: 0, gateway, ...identity, mangaDisplay: true, mangaQuickDisplay: true,
      query: '', ascending: true, currentChapterIndex: catalog[current].chapterIndex, interactionEnabled: true,
      settledFlat: false, interacted: false, locateCurrentPending: false, mangaCurrentOpenInset: 50, onTreeStateChange() {} });
    surface.openTree(true); await tick();
    assert.ok(surface.view, 'Quick actual SDK opening publishes a ready bounded view');
    assert.equal(requests.at(-1).locateCurrent, true, 'Quick initial position ignores Full browsing anchor');
    assert.deepEqual(requests.at(-1).collapsedNodeIds, [], 'Quick opens the complete expanded view');
    assert.equal(requests.at(-1).limit, 256, 'Quick retains the bounded Core page contract');
    assert.deepEqual(readerDirectoryCollapsedIds(scope), ['volume'], 'Quick leaves Full persistent fold state intact');
    assert.deepEqual(readerDirectoryViewportAnchor(scope), anchor, 'Quick opening leaves Full stored anchor intact');
    assert.ok(pageRequests.length <= 3, 'first paint prepares at most the bounded target neighborhood');
    assert.ok(pageRequests.every(offset => offset > 0 && offset % 256 === 0));
    const loads = [], data = new production.ReaderDirectoryNavigationDataSource(offset => loads.push(offset));
    data.replace(surface.view);
    const quick = listFixture(data, surface.view, true, listCandidate), full = listFixture(data, surface.view, false, listCandidate);
    assert.equal(data.totalCount(), 9000, 'Quick exposes the full Core count at first/middle/end');
    const item = { node: data.loadedNode(current), index: current, key: catalog[current].nodeId };
    assert.ok(item.node, 'the target page is admitted before initial position');
    assert.deepEqual(quick.owner.mangaCellPlacement(item), full.owner.mangaCellPlacement(item), 'Quick and Full use the same resident run layout');
    quick.owner.initialRender(); quick.owner.positionInitialCurrent();
    assert.deepEqual(quick.scrolls, [[current, false, 'start', { extraOffset: { value: -50 } }]], 'Quick initial scroll uses canonical Core rank and compact opening inset');
    const native = quick.native.at(-1); assert.equal(native.args[0], quick.owner.scroller);
    native.onScrollIndex(current, current + 3); assert.equal(quick.owner.firstVisibleIndex, current, 'the real native Grid callback publishes its canonical viewport rank');
    const far = current < 4500 ? 8999 : 1;
    const farItem = data.getData(far); assert.equal(farItem.index, far, 'far Quick browsing preserves canonical Core rank'); assert.equal(data.displayIndex(far), far, 'far Quick browsing never remaps to a nearby ordinal');
    if (farItem.node === undefined) assert.deepEqual(loads, [Math.floor(far / 256) * 256], 'far browsing requests just its own page');
    // Actual Core search response has its own immutable ranks, then clear restores all.
    surface.query = 'last-target'; surface.openTree(false, 'query'); await tick();
    assert.equal(requests.at(-1).query, 'last-target'); assert.deepEqual(requests.at(-1).collapsedNodeIds, ['volume'], 'search keeps the documented Full fold policy');
    data.replace(surface.view); quick.owner.view = surface.view; quick.owner.mangaSearchActive = true;
    assert.equal(data.totalCount(), 1); assert.equal(data.getData(0).node.chapterIndex, catalog[8999].chapterIndex);
    surface.query = ''; surface.openTree(false, 'query-clear'); await tick();
    assert.deepEqual(requests.at(-1).collapsedNodeIds, [], 'actual SDK query-clear reopening returns to the complete Quick view');
    assert.deepEqual(readerDirectoryCollapsedIds(scope), ['volume']);
    data.replace(surface.view); quick.owner.view = surface.view; quick.owner.mangaSearchActive = false;
    assert.equal(data.totalCount(), 9000); assert.equal(data.displayIndex(8999), 8999, 'clearing Quick search restores full canonical browsing');
    const context = listFixture(data, surface.view, true, listCandidate); context.owner.mangaQuickContextRow(data.getData(0));
    const label = [...context.owner.nodes.values()].find(node => node.type === 'Text');
    assert.equal(label.create, '第一卷'); assert.deepEqual([label.fontSize, label.lineHeight], [10, 16]);
    assert.deepEqual(label.padding, { left: 10, right: 10, top: 11, bottom: 7 });
    assert.equal(label.border.width.bottom, 1);
    assert.equal(label.onClick, undefined, 'Quick group context has no chapter or fold action');
    for (let offset = 256; offset < 4096; offset += 256) data.admit(offset, { viewId: surface.view.viewId, visibleTotal: 9000, nodes: catalog.slice(offset, offset + 256) });
    assert.ok(production.directoryPages.keys().length <= 12, 'Quick/Full/prepared/search pages share the original twelve-page LRU');
    assert.ok(data.loadedPages().length <= 12);
  }
}
function retainedContext(candidate = listSource) {
  const production = productionMangaDirectoryNavigationDataSource(candidate);
  const nodes = [{ ...catalog[0], title: '旧卷' }, { ...node(1), kind: 'group', nodeId: 'subgroup', title: '旧组', hasChildren: true, chapterIndex: undefined }];
  const view = { status: 'ready', identity: { sourceId: 'retained-context', bookId: 'book' }, viewId: 'same-view', navigationRevision: 'revision', visibleTotal: 2, currentVisibleIndex: 1, nodes };
  const data = new production.ReaderDirectoryNavigationDataSource(() => assert.fail('context cannot fetch new ancestry')); data.replace(view);
  const built = listFixture(data, view, true, candidate); built.owner.mangaQuickContextRow(data.getData(1));
  const label = [...built.owner.nodes.values()].find(node => node.type === 'Text'); assert.equal(label.create, '旧卷 / 旧组');
  const actors = [...built.owner.observers];
  data.admit(0, { viewId: view.viewId, visibleTotal: 2, nodes: [{ ...nodes[0], title: '新卷' }, { ...nodes[1], title: '新组' }] });
  built.owner.mangaPresentationRevision += 1; built.properties.flush();
  assert.equal(label.create, '新卷 / 新组', 'retained Quick context observes current group and ancestor facts');
  assert.equal(label.accessibilityText, '新卷 / 新组'); assert.equal(label.onClick, undefined);
  assert.deepEqual(built.owner.observers, actors, 'context revision preserves the actual native Text actor');
}
retainedContext();
const capturedContext = listSource.replace('return context ? `${context} / ${this.mangaTitle(node)}` : this.mangaTitle(node);',
  'return context ? `${context} / ${item.node.title}` : item.node.title;');
assert.notEqual(capturedContext, listSource); assert.throws(() => retainedContext(capturedContext), /observes current group and ancestor facts/);
await openingMatrix();
for (const [name, surface, list, reason] of [
  ['nearby-count regression', surfaceSource, listSource.replace('totalCount(): number { return this.view?.visibleTotal ?? 0; }', 'totalCount(): number { return Math.min(12, this.view?.visibleTotal ?? 0); }'), /full Core count|far Quick browsing/],
  ['lost complete-view override', surfaceSource.replace("query.trim().length === 0 ? [] : undefined", "query.trim().length === 0 ? undefined : undefined"), listSource, /complete expanded view/],
  ['lost opening current', surfaceSource.replace('explicitLocateCurrent || first &&', 'explicitLocateCurrent || false &&'), listSource, /initial position ignores Full/],
  ['remapped Core ranks', surfaceSource, listSource.replace('coreIndex(displayIndex: number): number { return displayIndex; }', 'coreIndex(displayIndex: number): number { return displayIndex % 12; }'), /canonical viewport rank|far Quick browsing/],
]) {
  assert.ok(surface !== surfaceSource || list !== listSource, name);
  await assert.rejects(() => openingMatrix(surface, list), reason, name);
}
console.log('PASS actual SDK Quick complete9000 first/middle/end/current, identical resident Full layout, bounded256 paging/twelve-page cache, immutable search/clear ranks, read-only10/16 context, isolated Full folds/anchor, five negative controls and retained context observer; native pixels remain separate');

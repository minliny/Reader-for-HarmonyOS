import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"selective-locate": {"description": "真实locate只展开当前祖先/保其他书anchor", "resources": []}, "empty-surface": {"description": "实际Surface→GridItem空态/clear callback/原viewport", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const fontFamilies = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const { mangaGridBuilderMembers, mangaRowBuilderMembers, mangaGridProbeDependencies, emptyMangaGridState } = await import('./lib/manga-directory-grid-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { localBookDetailSdk } = await import('./lib/local-book-detail-sdk-probe.mjs');
const { openReaderDirectoryNavigation, readerDirectoryScopeKey,
  readerDirectoryToggleCollapsed, readerDirectoryCollapsedIds } = await import('../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts');
const { readerDirectorySaveViewportAnchor, readerDirectoryViewportAnchor } = await import('../entry/src/main/ets/features/reading/ReaderDirectoryViewport.ts');

const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const listPath = file('features/reading/ReaderDirectoryNavigationList.ets');
const listSource = readFileSync(listPath, 'utf8');





if(selectedCase==='selective-locate') {
const scope = readerDirectoryScopeKey('source', 'comic');
readerDirectoryToggleCollapsed(scope, 'r1', 'current-volume');
readerDirectoryToggleCollapsed(scope, 'r1', 'unrelated-volume');
readerDirectorySaveViewportAnchor({ bookId: scope, navigationRevision: 'r1', viewId: 'old', nodeId: 'old-target', visibleIndex: 90, rowFraction: 0.5 });
readerDirectorySaveViewportAnchor({ bookId: 'other-book', navigationRevision: 'r1', viewId: 'other', nodeId: 'other-target', visibleIndex: 8, rowFraction: 0.2 });
const requests = [];
const ready = { status: 'ready', viewId: 'view', navigationRevision: 'r1', visibleTotal: 1, nodes: [] };
const result = await openReaderDirectoryNavigation({ open: async query => {
  requests.push(query);
  return query.collapsedNodeIds.includes('current-volume') ? { ...ready, currentAncestorNodeId: 'current-volume' } :
    { ...ready, currentVisibleIndex: 0 };
} }, { sourceId: 'source', bookId: 'comic', chapterIndex: 4, anchorNodeId: 'old-target', locateCurrent: true }, () => true);
assert.equal(result.locateCurrent, true);
assert.equal(result.currentVisibleIndex, 0);
assert.equal(requests.length, 2, 'only the actual collapsed ancestry needs another Core query');
assert.equal(requests[0].anchorNodeId, undefined, 'locate cannot restore the old browse anchor');
assert.deepEqual(readerDirectoryCollapsedIds(scope), ['unrelated-volume']);
assert.equal(readerDirectoryViewportAnchor(scope), undefined);
assert.equal(readerDirectoryViewportAnchor('other-book').nodeId, 'other-target', 'other book state is preserved');

}
if(selectedCase==='empty-surface') {
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('ReaderDirectoryNavigationList');
syntax.propCollection.set('ReaderDirectoryNavigationList', new Set([...listSource.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(match => match[1])));
const navigationSource = readFileSync(file('features/reading/ReaderDirectoryNavigationSurface.ets'), 'utf8');
for (const mangaDisplay of [false, true])
for (const [mangaCatalogDisplay, mangaCatalogNarrow] of [[false, false], [true, false], [true, true]]) {
  const properties = createArkUIPropertyRuntimeProbe();
  const dependencies = {...fontFamilies, ...mangaGridProbeDependencies, ...properties.sdk,
    LazyForEach: new Proxy({}, {get: () => () => {}})};
  const actual = createReaderBuilderProbe(listSource, ['build', 'row', 'rowKey', ...mangaRowBuilderMembers], dependencies, properties.hooks).Component;
  // Only the empty Core data-source I/O is replaced. Every native Grid/List,
  // empty slot, text and clear callback is emitted by the real child Builder.
  class DirectoryChild extends actual {
    constructor(parent, params, storage, id) {
      super(parent, params, storage, id);
      Object.assign(this, emptyMangaGridState(), params, {params, appThemeScheme: 'day', mangaPresentationRevision: 0,
        dataSource: {...emptyMangaGridState().dataSource, totalCount: () => 0, currentView: () => params.view},
        mangaSearchActive: params.mangaDisplay && parent.query.trim().length > 0});
    }
  }
  const { owner } = createReaderBuilderProbe(navigationSource, ['fallbackBuilder', 'build'],
    {...dependencies, ReaderDirectoryNavigationList: DirectoryChild}, {...properties.hooks, mountChildren: true,
      childSources: {ReaderDirectoryNavigationList: listSource}});
  let clears = 0;
  Object.assign(owner, { mangaDisplay, mangaFontsReady: true, mangaScheme: 'night', appThemeScheme: 'day', query: mangaCatalogDisplay ? '' : '没有此章节',
    mangaRowMinHeight: 50, mangaCatalogDisplay, mangaCatalogNarrow, interactionEnabled: true, listPaddingTop: 145, contentStartInset: 37,
    view: {viewId: 'empty-metadata', visibleTotal: 0}, onClearSearch: () => clears++ });
  owner.initialRender();
  const child = [...owner.children.values()].find(child => child.nodes);
  assert.equal(child.params.mangaRowMinHeight, 50, 'actual native child retains the parent props');
  assert.equal(child.params.mangaCatalogDisplay, mangaCatalogDisplay); assert.equal(child.params.mangaCatalogNarrow, mangaCatalogNarrow);
  const surfaceNodes = [...owner.nodes.values()];
  const root = surfaceNodes.find(node => node.type === 'Column');
  assert.ok(root, 'directory surface retains a full-height recovery/status host');
  assert.deepEqual([root.width, root.height], ['100%', '100%']);
  const stacks = surfaceNodes.filter(node => node.type === 'Stack');
  assert.equal(stacks.length, 2, 'one remaining-height viewport wraps the actual list/empty-content alignment container');
  const viewport = stacks[0];
  assert.equal(viewport.width, '100%');
  assert.equal(viewport.layoutWeight, 1, 'loading/error header leaves all remaining height to the directory viewport');
  assert.equal(viewport.height, undefined, 'viewport weight must not compete with a fixed full-height allocation');
  // Bind the assertion to the actual SDK child observer, rather than whichever
  // Stack happened to be emitted first after a surface wrapper was introduced.
  const content = stacks.filter(node => node.id < child.id).at(-1);
  assert.equal(content, stacks[1], 'the native directory child belongs to the inner content container');
  assert.ok(viewport.id < content.id && content.id < child.id);
  assert.deepEqual([content.width, content.height], ['100%', '100%']);
  assert.equal(content.create.alignContent, mangaDisplay ? 'Alignment.TopStart' : 'Alignment.Center');
  if (!mangaDisplay) {
    assert.ok([...owner.nodes.values()].some(node => node.create === '没有匹配的目录项'));
    assert.ok(![...child.nodes.values()].some(node => node.create === '清除搜索'), 'novel keeps its passive empty state');
    continue;
  }
  assert.ok(![...owner.nodes.values()].some(node => node.type === 'Text'), 'manga empty UI is never a fixed parent overlay');
  const slot = [...child.nodes.values()].find(node => node.type === 'GridItem'); assert.ok(slot);
  if (typeof slot.create[0] === 'function') slot.create[0](slot.id, true);
  const nodes = [...child.nodes.values()], grid = nodes.find(node => node.type === 'Grid');
  assert.equal(grid.padding.top, 0);
  assert.equal(grid.contentStartOffset, 182, 'real child empty content clears the toolbar through the original Grid content offset');
  assert.deepEqual(grid.create[1].onGetIrregularSizeByIndex(0), [1, 12], 'empty slot consumes the full native lane without a Core target');
  const message = nodes.find(node => node.create === (mangaCatalogDisplay ? '暂无章节信息' : '没有匹配的章节'));
  assert.ok(message); 
  const clear = nodes.find(node => node.create === '清除搜索'); assert.equal(clear !== undefined, !mangaCatalogDisplay);
  if (clear) {
    assert.equal(clear.fontColor, '#B9CEB1');  clear.onClick(); assert.equal(clears, 1);
    const empty = nodes.find(node => node.type === 'Column');
    
    assert.equal(empty.border.width.top, 1); assert.equal(empty.border.color, '#3B4036');

  }
}


}

}

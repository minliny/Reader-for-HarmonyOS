import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readerDirectoryBookmarkMarkerState } from '../entry/src/main/ets/features/reading/ReaderDirectoryMarkerState.ts';

const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const detailPath = fileURLToPath(new URL('../entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets', import.meta.url));
const controlPath = fileURLToPath(new URL('ReaderControlDirectoryContent.ets', reading));
const fullPath = fileURLToPath(new URL('FullDirectoryPanel.ets', reading));
const listPath = fileURLToPath(new URL('ReaderDirectoryNavigationList.ets', reading));
const surfacePath = fileURLToPath(new URL('ReaderDirectoryNavigationSurface.ets', reading));
const listSource = readFileSync(listPath, 'utf8');
const surfaceSource = readFileSync(surfacePath, 'utf8');
assert.match(listSource, /`reader-navigation:\$\{item\.key\}`/, 'tree rows use stable node ids');
assert.match(listSource, /this\.gateway\.resolveTarget\(bookId, viewId, node\.nodeId/, 'tap revalidates live Core target');
assert.match(listSource, /this\.scroller\.scrollToIndex\(plan\.index, false, ScrollAlign\.CENTER\)/,
  'tree centers by Core supplied current visible rank when no viewport anchor exists');
assert.match(surfaceSource, /this\.scheduleQueryOpen\(\)/,
  'rapid search changes are coalesced before Core opens a view');
const controlSource = readFileSync(controlPath, 'utf8');
const fullSource = readFileSync(fullPath, 'utf8');
assert.match(controlSource,
  /else if \(this\.snapshot\.rows\.length === 0 && !this\.navigationActive &&\s*!\(this\.tab === 'directory' && this\.bookmarkIdentity\?\.sourceId === 'local'\)\)/,
  'local group-only search mounts the Core tree even when flat chapter matches are empty');
assert.match(controlSource,
  /fallbackBuilder: \(\): void => \{\s*if \(this\.snapshot\.rows\.length === 0\) \{\s*Text\('没有匹配的章节'\)[\s\S]*?\} else \{\s*this\.flatList\(\)/,
  'missing navigation still shows the original empty state while tree request is pending');
assert.match(controlSource, /if \(!this\.mounted \|\| this\.navigationActive\) return;[\s\S]*?const ticket = this\.placement\.ticket\(\)/,
  'control flat positioning is disabled when Core tree rank owns the list');
const QuickActions = productionMotionMethods(controlPath,
  ['cancelPendingPlacement', 'userScroll', 'search', 'sort', 'deferCatalogAction', 'scrollCatalogEdge'], {
    Edge: { Top: 'top', Bottom: 'bottom' },
  });
{
  const scrolled = [], refreshed = [];
  const quick = Object.assign(new QuickActions(), { tab: 'directory', catalogComplete: true,
    draft: 'group only', query: '', ascending: true, navigationInteracted: false,
    leadingRow: 4, leadingKey: 'row-4',
    placement: { userScroll: () => scrolled.push('placement') },
    scroller: { scrollEdge: edge => scrolled.push(edge) },
    refreshData: () => refreshed.push('refresh') });
  quick.search(); quick.sort();
  assert.equal(quick.navigationInteracted, false,
    'Quick search and sort do not falsely mark a real scroll before first tree answer');
  assert.deepEqual([quick.query, quick.ascending, refreshed.length], ['group only', false, 2]);
  assert.equal(quick.leadingRow, undefined, 'explicit data change still cancels old flat positioning');
  quick.userScroll();
  assert.equal(quick.navigationInteracted, true, 'real drag still prevents a late tree insertion');
  quick.navigationInteracted = false;
  quick.scrollCatalogEdge(true);
  assert.equal(quick.navigationInteracted, true, 'explicit top or bottom navigation is also scroll intent');
  assert.equal(scrolled.at(-1), 'bottom');
}
assert.match(fullSource, /if \(!this\.positioningMounted \|\| this\.navigationActive \|\| this\.listPositioning\.status !== 'pending'\) return/,
  'full directory flat positioning cannot scroll the tree to a chapter ordinal');

const Detail = productionMotionMethods(detailPath, ['flushPendingScroll'], {});
{
  const edges = [];
  const page = Object.assign(new Detail(), { mounted: true, listReady: true, navigationActive: true,
    projectedEntries: [], pendingScrollEdge: 'bottom', listScroller: { scrollEdge: edge => edges.push(edge) } });
  page.flushPendingScroll();
  assert.deepEqual(edges, ['bottom'], 'tree-only group search still allows bottom navigation');
}

const List = productionMotionMethods(listPath, ['marker', 'selectTarget', 'planPosition', 'positionInitialCurrent'], {
  readerDirectoryBookmarkMarkerState, ScrollAlign: { START: 'start', CENTER: 'center' },
  readerDirectoryViewportAnchor: () => undefined, LengthMetrics: { vp: value => ({ value }) },
});
{
  const actions = [];
  const list = Object.assign(new List(), {
    chapterStartBookmarkCreationEnabled: true,
    onDeleteBookmarks: times => actions.push(['delete', times]),
    onCreateChapterStartBookmark: request => actions.push(['create', request.chapterIndex]),
  });
  list.marker({ index: 4, title: 'Chapter', bookmarks: [{ time: 123, chapterIndex: 4, chapterOffset: 0,
    chapterTitle: 'Chapter', content: '' }] });
  list.marker({ index: 5, title: 'Next', bookmarks: [] });
  assert.deepEqual(actions, [['delete', [123]], ['create', 5]], 'target rows preserve canonical chapter bookmark actions');
}

const PagedList = productionMotionMethods(listPath, ['loadPage', 'onInteractionChanged'], {
  setTimeout: action => action(), readerDirectoryViewportAnchor: () => undefined,
});
{
  const admitted = [];
  const list = Object.assign(new PagedList(), { mounted: true, generation: 2, bookId: 'book',
    view: { viewId: 'view' }, interactionEnabled: false, pendingPages: [],
    gateway: { page: async () => ({ viewId: 'view', visibleTotal: 10000, nodes: [] }) },
    dataSource: { admit: (offset, page) => admitted.push([offset, page.viewId]), failed() {} },
    onInvalidated: () => assert.fail('valid page cannot invalidate view') });
  list.loadPage(256); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(admitted, [], 'page notifications do not rebuild List during a Quick/Full morph');
  list.interactionEnabled = true; list.onInteractionChanged();
  assert.deepEqual(admitted, [[256, 'view']]);
}
{
  let complete;
  const selections = [], invalidations = [], scrolls = [];
  const list = Object.assign(new List(), {
    mounted: true, generation: 1, selectionGeneration: 0, bookId: 'book',
    view: { viewId: 'view', currentVisibleIndex: 6010 }, initialPositionPending: true,
    scroller: { scrollToIndex: (...args) => scrolls.push(args) },
    gateway: { resolveTarget: (_bookId, _viewId, _nodeId, _guard) => new Promise(resolve => { complete = resolve; }) },
    onSelectTarget: (index, scalar, positionScope) => selections.push([index, scalar, positionScope]),
    onInvalidated: () => invalidations.push('stale'),
  });
  list.positionInitialCurrent();
  assert.deepEqual(scrolls, [[6010, false, 'center']], '10k-node view centers without Host traversal');
  list.selectTarget({ nodeId: 'linked', kind: 'target', chapterIndex: 4, chapterOffsetScalar: 9 });
  assert.deepEqual(selections, [], 'rendered scalar never jumps before Core revalidation');
  const scope = { sourceId: 'local', bookId: 'book', chapterIndex: 4,
    bodyVersion: 'body', processingVersion: 'processing' };
  complete({ chapterIndex: 4, chapterOffsetScalar: 9, positionScope: scope }); await Promise.resolve();
  assert.deepEqual(selections, [[4, 9, scope]], 'Core scope must reach the reading callback');
  assert.deepEqual(invalidations, []);
}
{
  const invalidations = [];
  const list = Object.assign(new List(), {
    mounted: true, generation: 1, selectionGeneration: 0, bookId: 'book', view: { viewId: 'stale' },
    gateway: { resolveTarget: () => Promise.reject(new Error('directory view is stale')) },
    onSelectTarget: () => assert.fail('stale target must not jump'),
    onInvalidated: () => invalidations.push('stale'),
  });
  list.selectTarget({ nodeId: 'old', kind: 'target', chapterIndex: 5 });
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(invalidations, ['stale']);
}

const pending = [], timers = new Map();
let timerId = 0;
const Surface = productionMotionMethods(surfacePath,
  ['openTree', 'onViewInputsChanged', 'onInteractionChanged', 'scheduleQueryOpen', 'cancelQueryTimer'], {
  openReaderDirectoryNavigation: (_gateway, query) => new Promise(resolve => pending.push({ query, resolve })),
  readerDirectoryNoteMissingNavigation: () => {},
  readerDirectoryViewportAnchor: () => undefined,
  ReaderRuntimeOwner: { current: () => ({}) },
  setTimeout: (action, delay) => { assert.equal(delay, 150); const id = ++timerId; timers.set(id, action); return id; },
  clearTimeout: id => { timers.delete(id); },
});
{
  const states = [];
  const surface = Object.assign(new Surface(), { mounted: true, gateway: {}, bookId: 'book', query: 'old',
    ascending: true, currentChapterIndex: 3, generation: 0, settledFlat: false, interacted: false,
    interactionEnabled: true, queryTimer: -1, lastQuery: 'old', lastAscending: true, lastChapterIndex: 3,
    view: undefined, onTreeStateChange: active => states.push(active) });
  surface.openTree(true);
  surface.query = 'n'; surface.onViewInputsChanged();
  surface.query = 'ne'; surface.onViewInputsChanged();
  surface.query = 'new'; surface.onViewInputsChanged();
  assert.equal(pending.length, 1, 'three rapid edits do not issue three expensive Core opens');
  assert.equal(timers.size, 1, 'only the newest debounce remains');
  pending[0].resolve({ viewId: 'old', navigationRevision: 'r', visibleTotal: 1, nodes: [] });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(surface.view, undefined, 'late old-query view is discarded');
  const latest = [...timers.values()][0]; timers.clear(); latest();
  assert.equal(pending.length, 2);
  assert.equal(pending[1].query.query, 'new');
  pending[1].resolve({ viewId: 'new', navigationRevision: 'r', visibleTotal: 1, nodes: [] });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(surface.view.viewId, 'new');
  assert.deepEqual(states, [true]);
  surface.query = 'newer'; surface.onViewInputsChanged();
  surface.ascending = false; surface.onViewInputsChanged();
  assert.equal(timers.size, 0, 'sort cancels query debounce and opens immediately');
  assert.equal(pending.length, 3);
  assert.deepEqual([pending[2].query.query, pending[2].query.descending], ['newer', true]);
}
{
  const start = pending.length;
  const surface = Object.assign(new Surface(), { mounted: true, gateway: {}, bookId: 'motion-book', query: '',
    ascending: true, currentChapterIndex: 0, generation: 0, settledFlat: false, interacted: false,
    interactionEnabled: true, queryTimer: -1, openingGeneration: -1, pendingRefresh: false,
    view: undefined, onTreeStateChange: () => {} });
  surface.openTree(true);
  surface.interactionEnabled = false; surface.onInteractionChanged();
  pending[start].resolve({ viewId: 'during-motion', navigationRevision: 'r', visibleTotal: 1, nodes: [] });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(surface.view, undefined, 'motion cancels a pending first tree publication');
  surface.interactionEnabled = true; surface.onInteractionChanged();
  assert.equal(pending.length, start + 2, 'motion endpoint retries the superseded first open');
}
console.log('PH42 tree bookmark, target validation, rank position and debounced query fencing: PASS');

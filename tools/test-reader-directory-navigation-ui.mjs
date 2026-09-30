import { ReaderDirectoryTrace } from '../entry/src/main/ets/features/reading/ReaderDirectoryTrace.ts';
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
assert.match(listSource, /\(item: ReaderDirectoryNavigationItem\): string => this\.rowKey\(item\)/, 'LazyForEach uses the production row identity function');
assert.match(listSource, /this\.gateway\.resolveTarget\(bookId, viewId, node\.nodeId/, 'tap revalidates live Core target');
assert.match(listSource, /this\.scroller\.scrollToIndex\(plan\.index, false, ScrollAlign\.CENTER\)/,
  'tree centers by Core supplied current visible rank when no viewport anchor exists');
assert.match(surfaceSource, /this\.scheduleQueryOpen\(\)/,
  'rapid search changes are coalesced before Core opens a view');
const controlSource = readFileSync(controlPath, 'utf8');
const fullSource = readFileSync(fullPath, 'utf8');
assert.match(controlSource,
  /else if \(this\.snapshot\.rows\.length === 0 && !this\.navigationActive &&\s*!\(this\.tab === 'directory' && this\.bookmarkIdentity !== undefined\)\)/,
  'local group-only search mounts the Core tree even when flat chapter matches are empty');
assert.match(controlSource,
  /fallbackBuilder: \(\): void => \{\s*if \(this\.snapshot\.rows\.length === 0\) \{\s*Text\('没有匹配的章节'\)[\s\S]*?\} else \{\s*this\.flatList\(\)/,
  'missing navigation still shows the original empty state while tree request is pending');
assert.match(controlSource, /if \(!this\.mounted \|\| this\.navigationActive\) return;[\s\S]*?const ticket = this\.placement\.ticket\(\)/,
  'control flat positioning is disabled when Core tree rank owns the list');
const QuickActions = productionMotionMethods(controlPath,
  ['cancelPendingPlacement', 'userScroll', 'search', 'sort', 'deferCatalogAction', 'scrollCatalogEdge'], {
    Edge: { Top: 'top', Bottom: 'bottom' },
    ReaderDirectoryTrace, readerDirectoryScopeKey: (_source, book) => book,
  readerDirectorySignalScrollIntent: bookId => scrolledBooks.push(bookId),
    readerDirectorySignalScrollCommand: bookId => completedScrollBooks.push(bookId),
  });
const scrolledBooks = [];
const completedScrollBooks = [];
{
  const scrolled = [], refreshed = [];
  const quick = Object.assign(new QuickActions(), { tab: 'directory', catalogComplete: true,
    draft: 'group only', query: '', ascending: true, navigationInteracted: false,
    bookmarkIdentity: { sourceId: 'local', bookId: 'book' },
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
  assert.deepEqual(scrolledBooks, ['book'], 'toolbar scroll fences any pending tree view before Scroller moves');
  assert.deepEqual(completedScrollBooks, ['book'], 'toolbar announces a completed edge command even if no native stop fires');
  assert.equal(scrolled.at(-1), 'bottom');
}
assert.match(fullSource, /if \(!this\.positioningMounted \|\| this\.navigationActive \|\| this\.listPositioning\.status !== 'pending'\) return/,
  'full directory flat positioning cannot scroll the tree to a chapter ordinal');
const fullScrollEvents = [];
const FullControls = productionMotionMethods(fullPath, ['handleControl'], {
  Edge: { Top: 'top', Bottom: 'bottom' },
  ReaderDirectoryTrace, readerDirectoryScopeKey: (_source, book) => book,
  readerDirectorySignalScrollIntent: bookId => fullScrollEvents.push(['intent', bookId]),
  readerDirectorySignalScrollCommand: bookId => fullScrollEvents.push(['complete', bookId]),
});
{
  const panel = Object.assign(new FullControls(), {
    activeTab: 'directory', bookmarkIdentity: { sourceId: 'local', bookId: 'full-book' },
    cancelProjectionTopScroll: () => fullScrollEvents.push(['cancel']),
    listScroller: { scrollEdge: edge => fullScrollEvents.push(['edge', edge]) },
  });
  panel.handleControl('top'); panel.handleControl('bottom');
  assert.deepEqual(fullScrollEvents, [
    ['intent', 'full-book'], ['cancel'], ['edge', 'top'], ['complete', 'full-book'],
    ['intent', 'full-book'], ['cancel'], ['edge', 'bottom'], ['complete', 'full-book'],
  ], 'Full toolbar fences pending view before both explicit edge scrolls');
}

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
  ReaderDirectoryTrace, readerDirectoryScopeKey: (sourceId, bookId) => `${sourceId ?? 'local'}:${bookId}`,
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
  cacheReaderDirectoryNavigationPage: (_view, _offset, page) => page,
  setTimeout: action => action(), ReaderDirectoryTrace, readerDirectoryScopeKey: (sourceId, bookId) => `${sourceId ?? 'local'}:${bookId}`, readerDirectoryViewportAnchor: () => undefined,
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
let visibleAnchorNodeId;
const Surface = productionMotionMethods(surfacePath,
  ['openTree', 'onViewInputsChanged', 'onInteractionChanged', 'scheduleQueryOpen', 'cancelQueryTimer',
    'onTreeUserScrollIntent', 'onProgrammaticScrollIntent', 'onTreeScrollSettled', 'prepareVisiblePages'], {
  cacheReaderDirectoryNavigationPage: (_view, _offset, page) => page,
  openReaderDirectoryNavigation: (_gateway, query) => new Promise(resolve => pending.push({ query, resolve })),
  readerDirectoryNoteMissingNavigation: () => {},
  ReaderDirectoryTrace, readerDirectoryScopeKey: (sourceId, bookId) => `${sourceId ?? 'local'}:${bookId}`,
  readerDirectoryViewportAnchor: () => visibleAnchorNodeId === undefined ? undefined :
    { nodeId: visibleAnchorNodeId, navigationRevision: 'r', viewId: 'old-visible', visibleIndex: 6000 },
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
  pending[1].resolve({ viewId: 'new', navigationRevision: 'r', visibleTotal: 0, nodes: [] });
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
{
  const start = pending.length, states = [];
  const surface = Object.assign(new Surface(), { mounted: true, gateway: {}, bookId: 'mounted-during-motion', query: '',
    ascending: true, currentChapterIndex: 0, generation: 0, settledFlat: false, interacted: false,
    interactionEnabled: false, queryTimer: -1, openingGeneration: -1, pendingRefresh: false,
    view: undefined, onTreeStateChange: active => states.push(active) });
  surface.openTree(true);
  assert.equal(pending.length, start, 'mounting during Quick/Full motion must defer the expensive Core view open');
  assert.equal(surface.pendingRefresh, true, 'initial motion still owns a pending directory admission');
  assert.equal(surface.settledFlat, false, 'motion is not a permanent flat-directory decision');
  surface.interactionEnabled = true; surface.onInteractionChanged();
  assert.equal(pending.length, start + 1, 'motion endpoint performs the deferred initial admission exactly once');
  pending[start].resolve({ viewId: 'after-initial-motion', navigationRevision: 'r', visibleTotal: 1,
    nodes: [{ nodeId: 'only-chapter', chapterIndex: 0, kind: 'target', hasChildren: false }] });
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  assert.equal(surface.view.viewId, 'after-initial-motion', 'the real tree replaces the ready flat fallback after motion');
  assert.deepEqual(states, [true]);
}
{
  const start = pending.length;
  const surface = Object.assign(new Surface(), { mounted: true, gateway: {}, bookId: 'motion-response-race', query: '',
    ascending: true, currentChapterIndex: 0, generation: 0, settledFlat: false, interacted: false,
    interactionEnabled: true, queryTimer: -1, openingGeneration: -1, pendingRefresh: false,
    view: undefined, onTreeStateChange() {} });
  surface.openTree(true);
  // A prop can already carry the new value when the old async callback runs,
  // before its Watch callback has cancelled the in-flight generation.
  surface.interactionEnabled = false;
  pending[start].resolve({ viewId: 'response-at-motion-start', navigationRevision: 'r', visibleTotal: 1,
    nodes: [{ nodeId: 'only-chapter', chapterIndex: 0, kind: 'target', hasChildren: false }] });
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  assert.equal(surface.view, undefined);
  assert.equal(surface.settledFlat, false, 'a response arriving during motion cannot permanently discard the real tree');
  assert.equal(surface.pendingRefresh, true);
  surface.interactionEnabled = true; surface.onInteractionChanged();
  assert.equal(pending.length, start + 2, 'response blocked by motion is retried at its endpoint');
}
{
  const start = pending.length;
  let finishPage;
  const surface = Object.assign(new Surface(), { mounted: true,
    gateway: { page: (_book, viewId, _offset) => new Promise(resolve => { finishPage = resolve; }) },
    bookId: 'motion-page-race', query: '', ascending: true, currentChapterIndex: 0,
    generation: 0, settledFlat: false, interacted: false, interactionEnabled: true,
    queryTimer: -1, openingGeneration: -1, pendingRefresh: false, view: undefined, onTreeStateChange() {} });
  surface.openTree(true);
  pending[start].resolve({ viewId: 'pages-at-motion-start', navigationRevision: 'r', visibleTotal: 512,
    nodes: Array.from({ length: 256 }, (_, index) => ({ nodeId: `first-${index}` })) });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(typeof finishPage, 'function');
  surface.interactionEnabled = false;
  finishPage({ viewId: 'pages-at-motion-start', visibleTotal: 512,
    nodes: Array.from({ length: 256 }, (_, index) => ({ nodeId: `second-${index}` })) });
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  assert.equal(surface.view, undefined);
  assert.equal(surface.settledFlat, false, 'motion during page preparation cannot permanently discard the real tree');
  assert.equal(surface.pendingRefresh, true);
  surface.interactionEnabled = true; surface.onInteractionChanged();
  assert.equal(pending.length, start + 2);
}
{
  const start = pending.length;
  const surface = Object.assign(new Surface(), { mounted: true, gateway: {}, bookId: 'user-positioned-flat', query: '',
    ascending: true, currentChapterIndex: 0, generation: 0, settledFlat: false, interacted: true,
    interactionEnabled: true, queryTimer: -1, openingGeneration: -1, pendingRefresh: false,
    view: undefined, onTreeStateChange: () => assert.fail('user-positioned flat rows cannot be replaced') });
  surface.openTree(true);
  pending[start].resolve({ viewId: 'late-first-tree', navigationRevision: 'r', visibleTotal: 1,
    nodes: [{ nodeId: 'only-chapter', chapterIndex: 0, kind: 'target', hasChildren: false }] });
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  assert.equal(surface.view, undefined);
  assert.equal(surface.settledFlat, true, 'real user interaction keeps the existing flat viewport authoritative');
}
{
  const start = pending.length;
  visibleAnchorNodeId = 'before-drag';
  const surface = Object.assign(new Surface(), { mounted: true, gateway: {}, bookId: 'drag-book', query: 'group',
    ascending: true, currentChapterIndex: 0, generation: 0, settledFlat: false, interacted: false,
    interactionEnabled: true, queryTimer: -1, openingGeneration: -1, pendingRefresh: false,
    view: { viewId: 'old-visible' }, onTreeStateChange: () => {}, onUserScrollIntent: () => {} });
  surface.openTree(false);
  assert.equal(pending[start].query.anchorNodeId, 'before-drag');
  surface.onTreeUserScrollIntent();
  visibleAnchorNodeId = 'after-drag';
  pending[start].resolve({ viewId: 'stale-rank', navigationRevision: 'r', visibleTotal: 20, nodes: [] });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(surface.view.viewId, 'old-visible', 'drag rejects a view ranked against the old viewport');
  surface.onTreeScrollSettled();
  assert.equal(pending[start + 1].query.anchorNodeId, 'after-drag',
    'scroll stop opens one view against the newly visible node');
  visibleAnchorNodeId = undefined;
}
{
  const start = pending.length;
  visibleAnchorNodeId = 'before-top';
  const surface = Object.assign(new Surface(), { mounted: true, gateway: {}, bookId: 'top-book', query: '',
    ascending: true, currentChapterIndex: 0, generation: 0, settledFlat: false,
    interactionEnabled: true, queryTimer: -1, openingGeneration: -1, pendingRefresh: false,
    view: { viewId: 'old-visible' }, onTreeStateChange: () => {} });
  surface.openTree(false);
  surface.onProgrammaticScrollIntent();
  visibleAnchorNodeId = 'after-top';
  pending[start].resolve({ viewId: 'stale-top-rank', navigationRevision: 'r', visibleTotal: 20, nodes: [] });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(surface.view.viewId, 'old-visible', 'toolbar Top cannot publish a pre-scroll tree rank');
  surface.onTreeScrollSettled();
  assert.equal(pending[start + 1].query.anchorNodeId, 'after-top');
  visibleAnchorNodeId = undefined;
}
{
  const start = pending.length;
  visibleAnchorNodeId = 'same-visible-node';
  const pageCalls = [], states = [];
  const old = { viewId: 'old-visible', navigationRevision: 'r', visibleTotal: 10001, nodes: [] };
  const surface = Object.assign(new Surface(), { mounted: true, bookId: 'deep-book', query: '',
    ascending: true, currentChapterIndex: 0, generation: 0, settledFlat: false,
    interactionEnabled: true, queryTimer: -1, openingGeneration: -1, pendingRefresh: false,
    view: old, gateway: { page: (_bookId, viewId, offset) => new Promise(resolve =>
      pageCalls.push({ viewId, offset, resolve })) }, onTreeStateChange: active => states.push(active),
    onUserScrollIntent: () => {} });
  surface.openTree(false);
  pending[start].resolve({ viewId: 'deep-new', navigationRevision: 'r', visibleTotal: 10001,
    anchorVisibleIndex: 5000,
    nodes: Array.from({ length: 256 }, (_, index) => ({ nodeId: `first-${index}` })) });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(surface.view, old, '10k-node view remains unchanged during target-window prefetch');
  assert.deepEqual(pageCalls.map(call => call.offset).sort((a, b) => a - b),
    [4608, 4864, 5120, 5632, 5888, 6144],
    'new anchor and old physical viewport each prefetch their cross-page visible windows');
  for (const call of pageCalls.slice(0, -1)) call.resolve({ viewId: call.viewId, visibleTotal: 10001,
    nodes: Array.from({ length: 256 }, (_, index) => ({ nodeId: `${call.offset}-${index}` })) });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(surface.view, old, 'partial page admission cannot flash a loading placeholder');
  const last = pageCalls.at(-1);
  last.resolve({ viewId: last.viewId, visibleTotal: 10001,
    nodes: Array.from({ length: 256 }, (_, index) => ({ nodeId: `${last.offset}-${index}` })) });
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  assert.equal(surface.view.viewId, 'deep-new', 'new view is published once all pages are ready');
  assert.equal(surface.view.preparedPages.length, 6);
  assert.deepEqual(states, [true]);

  const readyAfterGood = surface.view;
  const failedStart = pending.length, firstPageCall = pageCalls.length;
  surface.openTree(false);
  pending[failedStart].resolve({ viewId: 'bad-page-view', navigationRevision: 'r', visibleTotal: 10001,
    anchorVisibleIndex: 5000, nodes: Array.from({ length: 256 }, (_, index) => ({ nodeId: `bad-${index}` })) });
  await Promise.resolve(); await Promise.resolve();
  const failedPages = pageCalls.slice(firstPageCall);
  assert.equal(failedPages.length, 3);
  for (const [index, call] of failedPages.entries()) call.resolve({ viewId: call.viewId,
    visibleTotal: index === 0 ? 10000 : 10001,
    nodes: Array.from({ length: 256 }, (_, nodeIndex) => ({ nodeId: `bad-${call.offset}-${nodeIndex}` })) });
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  assert.equal(surface.view, readyAfterGood, 'mismatched page revision/total cannot partially replace the old view');

  const cancelledStart = pending.length, firstCancelledPage = pageCalls.length;
  surface.openTree(false);
  pending[cancelledStart].resolve({ viewId: 'cancelled-view', navigationRevision: 'r', visibleTotal: 10001,
    anchorVisibleIndex: 5000, nodes: Array.from({ length: 256 }, (_, index) => ({ nodeId: `cancel-${index}` })) });
  await Promise.resolve(); await Promise.resolve();
  const cancelledPages = pageCalls.slice(firstCancelledPage);
  assert.equal(cancelledPages.length, 3);
  surface.onTreeUserScrollIntent();
  for (const call of cancelledPages) call.resolve({ viewId: call.viewId, visibleTotal: 10001,
    nodes: Array.from({ length: 256 }, (_, index) => ({ nodeId: `cancel-${call.offset}-${index}` })) });
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  assert.equal(surface.view, readyAfterGood, 'user drag during prefetch keeps the current visible view');
  assert.deepEqual(states, [true]);
  visibleAnchorNodeId = undefined;
}
console.log('PH42 tree bookmark, target validation, rank position and debounced query fencing: PASS');

// Model LazyForEach's retained key -> Builder closure using the actual SDK
// transformed row. A stable node-only key reproduces the stale arrow; changing
// the expand presentation identity replaces only the affected mounted row.
{
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const Keys = productionMotionMethods(listPath, ['rowKey']);
  const keys = new Keys();
  let mounted = new Map();
  const toggles = [];
  const baseGroup = { nodeId: 'group', kind: 'group', title: '卷一', depth: 1,
    hasChildren: true, expanded: true };
  const unrelated = { nodeId: 'other', kind: 'target', title: '序言', depth: 1,
    chapterIndex: 0, hasChildren: false, expanded: false };
  function publish(nodes, viewId) {
    const next = new Map();
    for (const [index, node] of nodes.entries()) {
      const item = { key: node.nodeId, node, index };
      const key = keys.rowKey(item);
      let row = mounted.get(key);
      if (row === undefined) {
        row = createReaderBuilderProbe(listSource, ['row', 'displayLevel']).owner;
        Object.assign(row, { rowHeight:40, appThemeScheme:'day', view:{viewId},
          chapterByIndex:new Map(), isCurrentNode:()=>false,
          toggleNode: value=>toggles.push(value), selectTarget() {} });
        row.row(item);
      }
      next.set(key,row);
    }
    mounted=next;
    return [...next.values()];
  }
  function state(row) {
    const text=[...row.nodes.values()].filter(record=>record.type==='Text');
    return { arrow:text.find(record=>record.create==='⌄'||record.create==='›'),
      title:text.find(record=>record.create==='卷一') };
  }
  const expanded=publish([baseGroup,unrelated],'view-expanded');
  assert.equal(state(expanded[0]).arrow.create,'⌄');
  assert.match(state(expanded[0]).title.accessibilityText,/已展开/);
  const folded=publish([{...baseGroup,expanded:false},unrelated],'view-folded');
  assert.notEqual(folded[0],expanded[0], 'changed disclosure replaces its stale Builder capture');
  assert.equal(folded[1],expanded[1], 'unrelated row survives a new viewId unchanged');
  assert.equal(state(folded[0]).arrow.create,'›');
  assert.match(state(folded[0]).arrow.accessibilityText,/展开卷一子目录/);
  assert.match(state(folded[0]).title.accessibilityText,/已折叠/);
  state(folded[0]).arrow.onClick();
  assert.equal(toggles.at(-1).expanded,false, 'new arrow captures the current row; toggle business remains unchanged');
  const unfolded=publish([baseGroup,unrelated],'view-unfolded');
  assert.equal(state(unfolded[0]).arrow.create,'⌄');
  assert.match(state(unfolded[0]).title.accessibilityText,/已展开/);
  assert.equal(unfolded[1],expanded[1]);
  const moved=publish([unrelated,baseGroup],'view-rank-moved');
  assert.equal(moved[0],unfolded[1]);
  assert.equal(moved[1],unfolded[0], 'rank changes do not recreate an unchanged row');
  assert.equal(baseGroup.nodeId,'group', 'Core and viewport node identity is untouched');
}
console.log('PASS directory disclosure actual SDK Builder: fold/unfold arrow, accessibility and callback capture refresh only the changed row');

// Execute SDK-generated State dependencies and the real listBody child update.
// The old plain query is a negative control: snapshot refresh cannot substitute
// for the child observer's missing dependency on the submitted search value.
{
  const { createRequire } = await import('node:module');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const require = createRequire(import.meta.url);
  const sdkRoot = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const syntax = require(`${sdkRoot}/lib/validate_ui_syntax.js`);
  syntax.componentCollection.customComponents.add('ReaderDirectoryNavigationSurface');
  for (const name of ['ReaderBookmarkErrorState','ReaderBookmarkLoadingState','ReaderBookmarkEmptyState']) syntax.componentCollection.customComponents.add(name);
  require(`${sdkRoot}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add('flatList');
  syntax.propCollection.set('ReaderDirectoryNavigationSurface', new Set(
    [...surfaceSource.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(match=>match[1])));
  function queryPublication(source, reactive) {
    const runtime = createArkUIPropertyRuntimeProbe();
    class Surface {
      constructor(owner, params, _storage, id) {Object.assign(this,{owner,params,id});}
      updateStateVars(params) {Object.assign(this.params,params);}
    }
    const {owner} = createReaderBuilderProbe(source,['query','draft','ascending','listBody','search'],
      {...runtime.sdk,ReaderDirectoryNavigationSurface:Surface,Edge:{Top:'top'}},runtime.hooks);
    let refreshes=0;
    Object.assign(owner,{tab:'directory',bookmarkLoadFailed:false,snapshot:{loading:false,rows:[{}]},
      navigationActive:true,bookmarkIdentity:{sourceId:'local',bookId:'fixture'},
      rowHeight:()=>40,rowPadding:()=>10,sessionKey:'same-session',
      deferCatalogAction:()=>false,cancelPendingPlacement(){},
      refreshData(){refreshes++;},scroller:{scrollEdge(){}},
    });
    owner.listBody();
    const child=[...owner.children.values()][0];assert.ok(child);
    assert.equal(child.params.query,'');
    for(const query of ['精确','没有匹配','']) {
      owner.draft=` ${query} `; runtime.flush();
      const updatesBefore=runtime.updates.length;
      owner.search(); runtime.flush();
      assert.equal(child.params.query,reactive?query:'',
        'search alone must deliver submitted query without a sort, view replacement or manual observer replay');
      if(reactive) assert.ok(runtime.updates.length>updatesBefore,'query State invalidates the mounted tree observer');
      else assert.equal(runtime.updates.length,updatesBefore,'plain query reproduces the missing update');
      assert.equal(owner.ascending,true,'no sort action rescues the query');
      assert.equal([...owner.children.values()][0],child,'mounted surface identity stays stable');
    }
    assert.equal(refreshes,3,'existing flat projection refresh remains unchanged');
  }
  queryPublication(controlSource.replace('@State private query:','private query:'),false);
  queryPublication(controlSource,true);
}
console.log('PASS directory search actual SDK State dispatch: submit/miss/clear update mounted tree parameters without sorting; plain-query negative control reproduces stale child');

// Exercise the actual SDK build branch for a ready zero-result tree. Keep the
// list mounted so its existing layout and viewport lifecycle is unchanged.
{
  const { createRequire } = await import('node:module');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const require = createRequire(import.meta.url);
  const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
  syntax.componentCollection.customComponents.add('ReaderDirectoryNavigationList');
  class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
  for (const total of [0, 1]) {
    const { owner } = createReaderBuilderProbe(surfaceSource, ['fallbackBuilder', 'build'], { ReaderDirectoryNavigationList: Child });
    Object.assign(owner, { appThemeScheme: 'day', view: { visibleTotal: total }, sourceId: 'local', bookId: 'fixture',
      fallbackBuilder: () => assert.fail('a ready tree must not call the flat fallback') });
    owner.initialRender();
    assert.equal([...owner.children.values()].filter(child => child instanceof Child).length, 1,
      'empty result retains list lifecycle');
    const messages = [...owner.nodes.values()].filter(node => node.type === 'Text' && node.create === '没有匹配的目录项');
    assert.equal(messages.length, total === 0 ? 1 : 0, 'ready empty navigation shows an explicit empty result');
  }
}
console.log('PASS actual SDK directory empty-result presentation without replacing list lifecycle');

// Rejections after disposal are cancellation evidence, not live query failures.
{
  const traces = [];
  let rejectOpen;
  class Trace { constructor() {} step(stage, status) { traces.push([stage, status]); } }
  const Probe = productionMotionMethods(surfacePath, ['openTree'], {
    ReaderDirectoryTrace: Trace,
    readerDirectoryScopeKey: () => 'fixture', readerDirectoryViewportAnchor: () => undefined,
    openReaderDirectoryNavigation: () => new Promise((_resolve, reject) => { rejectOpen = reject; }),
  });
  for (const current of [false, true]) {
    traces.length = 0;
    const owner = Object.assign(new Probe(), { mounted: true, gateway: {}, bookId: 'fixture', generation: 0,
      query: '', currentChapterIndex: 0, interactionEnabled: true, onTreeStateChange() {} });
    owner.openTree(true);
    if (!current) { owner.mounted = false; owner.generation += 1; }
    rejectOpen(new Error('cancelled-or-failed'));
    for (let tick = 0; tick < 5; tick++) await Promise.resolve();
    assert.deepEqual(traces, [['response', current ? 'failed' : 'cancelled']]);
    assert.equal(owner.settledFlat === true, current, 'only current first-open failure settles the flat fallback');
  }
}
console.log('PASS directory diagnostics separate disposed query cancellation from active failure');

// Tree presentation preserves the ordinary chapter download affordance and
// revalidates the canonical target before dispatch. Group rows never acquire a
// chapter identity or download authority from their displayed rank.
{
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const Download = productionMotionMethods(listPath, ['canDownloadTarget', 'downloadTarget', 'onChapterEntriesChanged']);
  const target = { nodeId: 'target', kind: 'target', title: 'Chapter', depth: 1,
    chapterIndex: 7, hasChildren: false, expanded: false };
  const markerStart = listSource.indexOf("        if (item.node.kind === 'target' && item.node.chapterIndex !== undefined && this.chapterDownloadEnabled");
  const markerEnd = listSource.indexOf("        if (item.node.kind === 'target'", markerStart + 1);
  assert.ok(markerStart > 0 && markerEnd > markerStart);
  const baseline = listSource.slice(0, markerStart) + listSource.slice(markerEnd);
  function render(source, node, state, enabled, scheme = 'day', navigable = true) {
    const calls = [];
    const owner = createReaderBuilderProbe(source, ['row', 'displayLevel']).owner;
    Object.assign(owner, { appThemeScheme: scheme, view: {viewId:'view'}, rowHeight:40,
      interactionEnabled: true, chapterDownloadEnabled: enabled, chapterByIndex: new Map([[7,
        {index:7,title:'Chapter',downloadState:state,navigable}]]), isCurrentNode:()=>false,
      toggleNode(){},selectTarget(){},downloadTarget:node=>calls.push(node.nodeId),
      canDownloadTarget:Download.prototype.canDownloadTarget.bind(owner) });
    owner.row({key:node.nodeId,node,index:41});
    const button = [...owner.nodes.values()].find(node=>node.accessibilityText === '下载章节' || node.accessibilityText === '已下载');
    return {owner, button, calls};
  }
  assert.equal(render(baseline,target,'missing',true).button,undefined,
    'removing the download block reproduces the former Builder missing target download affordance');
  for (const scheme of ['day','night']) for (const state of ['missing','cached','failed','cancelled','queued','inProgress','completed','unknown']) {
    const {owner,button,calls}=render(listSource,target,state,true,scheme);
    if (state==='unknown') {assert.equal(button,undefined);continue;}
    assert.ok(button,`target ${state} retains a download status marker`);
    assert.equal(button.enabled,['missing','cached','failed','cancelled'].includes(state));
    const image=[...owner.nodes.values()].find(node=>node.type==='Image');
    assert.equal(image.create,`app.media.reader_directory_marker_${state==='completed'?'check':'download'}${scheme==='night'?'_theme_night':''}`);
    button.onClick();assert.deepEqual(calls,['target'],'row forwards the node identity, never visible ordinal 41');
  }
  for (const kind of ['group','disabled'])
    assert.equal(render(listSource,{...target,kind,chapterIndex:undefined},'missing',true).button,undefined);
  assert.equal(render(listSource,target,'missing',false).button,undefined);
  assert.equal(render(listSource,target,'missing',true,'day',false).button,undefined);
  const requests=[],downloads=[],invalidations=[];
  const owner=Object.assign(new Download(),{mounted:true,generation:1,view:{viewId:'view'},bookId:'book',sourceId:'source',
    interactionEnabled:true,chapterDownloadEnabled:true,chapterByIndex:new Map([[7,{index:7,downloadState:'missing',navigable:true}]]),
    gateway:{resolveTarget:(...args)=>new Promise((resolve,reject)=>requests.push({args,resolve,reject}))},
    onDownloadChapter:index=>downloads.push(index),onInvalidated:()=>invalidations.push(true)});
  owner.downloadTarget({...target,kind:'group',chapterIndex:undefined});
  owner.downloadTarget({...target,kind:'disabled',chapterIndex:undefined});
  assert.equal(requests.length,0,'group/disabled never request a target or queue a body');
  owner.downloadTarget(target);assert.equal(downloads.length,0,'rendered chapter identity cannot bypass Core proof');
  assert.deepEqual(requests[0].args.slice(0,3),['book','view','target']);
  requests[0].resolve({chapterIndex:7});await Promise.resolve();assert.deepEqual(downloads,[7]);
  owner.downloadTarget(target);owner.sourceId='other-source';
  requests[1].resolve({chapterIndex:7});await Promise.resolve();assert.deepEqual(downloads,[7],'late other-source result never downloads');
  owner.sourceId='source';owner.downloadTarget(target);
  requests[2].resolve({chapterIndex:8});await Promise.resolve();assert.deepEqual(downloads,[7],'canonical chapter mismatch never dispatches');
  owner.downloadTarget(target);owner.chapterByIndex.get(7).downloadState='queued';
  requests[3].resolve({chapterIndex:7});await Promise.resolve();assert.deepEqual(downloads,[7],'already queued chapter is not requested twice');
  owner.chapterByIndex.get(7).downloadState='missing';owner.downloadTarget(target);
  requests[4].reject(new Error('directory proof stale'));await Promise.resolve();await Promise.resolve();
  assert.deepEqual(invalidations,[true]);assert.deepEqual(downloads,[7]);
  owner.chapterSignatures=new Map();owner.chapterEntries=[{index:7,title:'Chapter',downloadState:'missing',navigable:true}];
  const changes=[];owner.dataSource={changedChapters:ids=>changes.push([...ids])};owner.onChapterEntriesChanged();
  owner.chapterEntries=[{...owner.chapterEntries[0],downloadState:'completed'}];owner.onChapterEntriesChanged();
  assert.deepEqual(changes,[[7],[7]],'offline state changes refresh the retained canonical row');
}
console.log('PASS tree download actual SDK Builder and Core target fencing: day/night states, group exclusion, queued/stale/source guards and download-state refresh');

{
  const { createRequire } = await import('node:module');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const require=createRequire(import.meta.url);
  const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
  syntax.componentCollection.customComponents.add('ReaderDirectoryNavigationSurface');
  syntax.componentCollection.customComponents.add('ReaderDirectoryNavigationList');
  class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
  const calls=[];
  const shared={chapterDownloadEnabled:true,onDownloadChapter:index=>calls.push(index),
    bookmarkIdentity:{sourceId:'remote',bookId:'book'},currentChapterIndex:7,chapterStartBookmarkCreationEnabled:false};
  const quick=createReaderBuilderProbe(controlSource,['listBody'],{ReaderDirectoryNavigationSurface:Child}).owner;
  Object.assign(quick,shared,{tab:'directory',snapshot:{loading:false,rows:[{}]},navigationActive:true,rowHeight:()=>40,rowPadding:()=>10});
  quick.listBody();const quickTree=[...quick.children.values()][0];
  assert.equal(quickTree.params.chapterDownloadEnabled,true);quickTree.params.onDownloadChapter(7);
  require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add('flatChapterList');
  const full=createReaderBuilderProbe(fullSource,['chapterList'],{ReaderDirectoryNavigationSurface:Child}).owner;
  Object.assign(full,shared,{projectedEntries:[{}],admittedEntries:[{}],initialListPositionReady:true,
    directoryListRowHeight:()=>40,directoryListPaddingX:()=>10,directoryListWidth:()=>300,directoryListViewportHeight:()=>300,chapterListHeight:()=>300});
  full.chapterList();const fullTree=[...full.children.values()][0];
  assert.equal(fullTree.params.chapterDownloadEnabled,true);fullTree.params.onDownloadChapter(8);
  const surface=createReaderBuilderProbe(surfaceSource,['build','fallbackBuilder'],{ReaderDirectoryNavigationList:Child}).owner;
  Object.assign(surface,shared,{view:{visibleTotal:1},sourceId:'remote',bookId:'book'});
  surface.initialRender();const list=[...surface.children.values()][0];
  assert.equal(list.params.chapterDownloadEnabled,true);list.params.onDownloadChapter(9);
  assert.deepEqual(calls,[7,8,9],'Quick, Full and Surface preserve the existing owner callback');
}
console.log('PASS actual SDK Quick/Full/Surface download prop and callback propagation');

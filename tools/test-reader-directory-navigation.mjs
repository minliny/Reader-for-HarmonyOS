import assert from 'node:assert/strict';
import {
  ReaderDirectoryNavigationGateway, decodeReaderDirectoryOpen, decodeReaderDirectoryPage,
  decodeReaderDirectoryTarget,
  readerDirectoryAdmitRevision, readerDirectoryCollapsedIds, readerDirectoryToggleCollapsed,
  readerDirectoryClearSessionState, openReaderDirectoryNavigation,
  backfillRetainedReaderDirectoryNavigation, readerDirectoryNoteMissingNavigation,
  readerDirectoryObserveMissingNavigation, readerDirectoryTakeMissingNavigation,
} from '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';

const group = { nodeId: 'g:1', depth: 1, title: '上卷', kind: 'group', hasChildren: true, expanded: true };
const linked = { nodeId: 't:1', parentId: 'g:1', depth: 2, title: '卷首', kind: 'target',
  chapterIndex: 3, chapterOffsetScalar: 7, hasChildren: true, expanded: true };
const scope = { sourceId: 'local', bookId: 'book', chapterIndex: 3,
  bodyVersion: 'body-v1', processingVersion: 'processing-v1' };
const open = { status: 'ready', viewId: 'view-a', navigationRevision: 'nav-a', visibleTotal: 10001,
  currentVisibleIndex: 6000, anchorVisibleIndex: 4500, nodes: [group, linked], nextOffset: 2 };
assert.equal(decodeReaderDirectoryOpen(open).status, 'ready');
assert.equal(decodeReaderDirectoryOpen(open).anchorVisibleIndex, 4500);
assert.equal(decodeReaderDirectoryOpen({ ...open, currentVisibleIndex: null,
  currentAncestorNodeId: null, anchorVisibleIndex: null, nextOffset: null,
  nodes: [{ ...group, parentId: null, chapterIndex: null, chapterOffsetScalar: null }] }).status, 'ready',
  'Core serializes absent Option fields as null in the view envelope');
assert.throws(() => decodeReaderDirectoryOpen({ ...open, anchorVisibleIndex: 10001 }), /anchor row exceeds/);
assert.deepEqual(decodeReaderDirectoryPage({ viewId: 'view-a', visibleTotal: 10001,
  nodes: [linked], nextOffset: 257 }, 'view-a', 256).nodes[0], linked);
assert.throws(() => decodeReaderDirectoryOpen({ ...open, nodes: [group, { ...group }] }), /duplicate/);
assert.throws(() => decodeReaderDirectoryOpen({ ...open, nodes: [{ ...group, chapterIndex: 1 }] }), /target/);
assert.throws(() => decodeReaderDirectoryOpen({ ...open, nodes: [{ ...linked, chapterIndex: undefined }] }), /target/);
assert.throws(() => decodeReaderDirectoryPage({ viewId: 'stale', visibleTotal: 10001, nodes: [] }, 'view-a', 0), /changed/);
assert.throws(() => decodeReaderDirectoryPage({ viewId: 'view-a', visibleTotal: 10001,
  nodes: [linked], nextOffset: 256 }, 'view-a', 256), /next offset/);
assert.equal(decodeReaderDirectoryOpen({ status: 'unavailable', reason: 'not indexed' }).status, 'unavailable');
assert.deepEqual(decodeReaderDirectoryTarget({ chapterIndex: 3, chapterOffsetScalar: 7, positionScope: scope }, 'book'),
  { chapterIndex: 3, chapterOffsetScalar: 7, positionScope: scope });
assert.throws(() => decodeReaderDirectoryTarget({ chapterIndex: 3, chapterOffsetScalar: 7 }, 'book'), /scope/);
assert.throws(() => decodeReaderDirectoryTarget({ chapterIndex: 3, chapterOffsetScalar: 7,
  positionScope: { ...scope, bookId: 'other' } }, 'book'), /scope/);
assert.throws(() => decodeReaderDirectoryTarget({ chapterIndex: 3, chapterOffsetScalar: -1,
  positionScope: scope }, 'book'), /scalar/);

readerDirectoryClearSessionState();
readerDirectoryAdmitRevision('book', 'nav-a');
assert.deepEqual(readerDirectoryToggleCollapsed('book', 'nav-a', 'g:1'), ['g:1']);
assert.deepEqual(readerDirectoryCollapsedIds('book'), ['g:1']);
assert.deepEqual(readerDirectoryToggleCollapsed('book', 'nav-a', 'g:1'), [],
  'two rapid taps on a stale rendered row restore the expanded state');
assert.deepEqual(readerDirectoryToggleCollapsed('book', 'nav-a', 'g:1'), ['g:1']);
assert.equal(readerDirectoryAdmitRevision('book', 'nav-b'), false);
assert.deepEqual(readerDirectoryCollapsedIds('book'), [], 'new navigation cannot inherit stale node ids');

const calls = [];
const runtime = {
  request: async (method, params, options) => {
    calls.push({ method, params, options });
    if (method === 'reading.directory.view.open.v1') return { data: open };
    if (method === 'reading.directory.view.page.v1') return { data: {
      viewId: params.viewId, visibleTotal: 10001, nodes: [linked], nextOffset: params.offset + 1 } };
    if (method === 'reading.directory.view.target.resolve.v1') return { data: {
      chapterIndex: 3, chapterOffsetScalar: 7, positionScope: scope } };
    if (method === 'local_book.navigation.backfill.v1') return { data: { status: 'ready', navigationRevision: 'nav-a' } };
    throw new Error('unexpected command');
  },
  retainedLocalBookSourcePath: async (bookId, isCurrent) => isCurrent() ? `/retained/${bookId}.source` : undefined,
};
const gateway = new ReaderDirectoryNavigationGateway(runtime);
const admitted = await openReaderDirectoryNavigation(gateway, { bookId: 'book', chapterIndex: 3,
  chapterOffsetScalar: 7, anchorNodeId: 'visible-node', limit: 256 }, () => true);
assert.equal(admitted?.currentVisibleIndex, 6000, 'Core supplies current visible rank without Host scanning 10k nodes');
assert.equal(admitted?.anchorVisibleIndex, 4500, 'Core supplies saved viewport node rank');
assert.equal(calls.filter(call => call.method === 'reading.directory.view.open.v1').length, 2,
  'changed revision is reopened without old collapse ids');
assert.deepEqual(calls.at(-1).params.collapsedNodeIds, []);
assert.equal(calls.at(-1).params.anchorNodeId, 'visible-node');
const page = await gateway.page('book', 'view-a', 256, () => true);
assert.equal(page.nodes.length, 1);
assert.equal(calls.at(-1).params.limit, 256, 'page requests stay bounded');
assert.deepEqual(await gateway.resolveTarget('book', 'view-a', 't:1', () => true),
  { chapterIndex: 3, chapterOffsetScalar: 7, positionScope: scope });
assert.equal(calls.at(-1).params.nodeId, 't:1');
assert.equal(await backfillRetainedReaderDirectoryNavigation(runtime, 'book', () => true), 'ready');
assert.equal(calls.at(-1).params.filePath, '/retained/book.source');
assert.equal(await backfillRetainedReaderDirectoryNavigation(runtime, 'book', () => false), 'unavailable');
assert.equal(calls.filter(call => call.method === 'local_book.navigation.backfill.v1').length, 1,
  'cancelled book never starts a repair');
let unavailableReason = '';
assert.equal(await openReaderDirectoryNavigation(new ReaderDirectoryNavigationGateway({
  request: async () => ({ data: { status: 'unavailable', reason: 'navigationIndexUnavailable' } }),
}), { bookId: 'book' }, () => true, reason => { unavailableReason = reason; }), undefined);
assert.equal(unavailableReason, 'navigationIndexUnavailable',
  'index failure stays distinct from missing old-book navigation and must not trigger backfill');
const missing = [];
readerDirectoryNoteMissingNavigation('old-epub', 'navigationIndexUnavailable');
const dispose = readerDirectoryObserveMissingNavigation('old-epub', () => missing.push('missing'));
assert.deepEqual(missing, [], 'index unavailability must not schedule archive reparsing');
readerDirectoryNoteMissingNavigation('old-epub', 'navigationMissingOrStale');
assert.deepEqual(missing, ['missing']);
assert.equal(readerDirectoryTakeMissingNavigation('old-epub'), true);
assert.equal(readerDirectoryTakeMissingNavigation('old-epub'), false);
dispose();
readerDirectoryNoteMissingNavigation('early-miss', 'navigationMissingOrStale');
const disposeEarly = readerDirectoryObserveMissingNavigation('early-miss', () => missing.push('early'));
assert.deepEqual(missing, ['missing', 'early'], 'detail miss survives until readable session observer attaches');
assert.equal(readerDirectoryTakeMissingNavigation('early-miss'), true);
disposeEarly();
console.log('PH42 directory navigation protocol, revision fencing and retained-source backfill: PASS');

import assert from 'node:assert/strict';
import {
  ReaderDirectoryNavigationGateway, readerDirectoryScopeKey, decodeReaderDirectoryOpen, decodeReaderDirectoryPage,
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
readerDirectoryAdmitRevision(readerDirectoryScopeKey('local', 'book'), 'nav-old');
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

// v2 identity and target proofs must survive every asynchronous boundary.
const identityV2 = { sourceId: 'source:a', bookId: 'book', catalogRevision: 'cat-v2', structureRevision: 'nav-v2' };
const readyV2 = { ...open, ...identityV2, navigationRevision: 'nav-v2', viewId: 'v2-view' };
let v2Reply = readyV2;
const v2Calls = [];
const v2Gateway = new ReaderDirectoryNavigationGateway({
  supportsCoreCapability: capability => capability === 'reading.directory.view.v2',
  request: async (method, params) => { v2Calls.push({method, params}); return {data: v2Reply}; },
});
assert.equal((await v2Gateway.open({ sourceId: 'source:a', bookId: 'book' })).identity.sourceId, 'source:a');
assert.equal(v2Calls.at(-1).method, 'reading.directory.view.open.v2');
v2Reply = { ...readyV2, sourceId: 'source:b' };
await assert.rejects(() => v2Gateway.open({sourceId:'source:a', bookId:'book'}), /identity changed/);
v2Reply = { ...identityV2, viewId:'v2-view', visibleTotal:10001, nodes:[linked], nextOffset:257 };
await v2Gateway.page('book','v2-view',256);
assert.equal(v2Calls.at(-1).params.catalogRevision, 'cat-v2');
const proofV2 = { ...identityV2, nodeId:'t:1', chapterIndex:3, url:'https://book/chapter' };
v2Reply = { ...identityV2, viewId:'v2-view', kind:'chapterStart', chapterIndex:3, directoryTargetProof:proofV2 };
const startV2 = await v2Gateway.resolveTarget('book','v2-view','t:1');
assert.equal(startV2.positionScope, undefined, 'uncached online chapter start does not invent body proof');
assert.deepEqual(startV2.directoryTargetProof, proofV2);
v2Reply = { ...v2Reply, directoryTargetProof:{...proofV2, chapterIndex:4} };
await assert.rejects(() => v2Gateway.resolveTarget('book','v2-view','t:1'), /proof chapter changed/);
v2Reply = { ...v2Reply, directoryTargetProof:proofV2 };
v2Reply = { ...v2Reply, kind:'exact', chapterOffsetScalar:0, positionScope:{...scope, sourceId:'source:a'} };
assert.equal((await v2Gateway.resolveTarget('book','v2-view','t:1')).positionScope.bodyVersion, 'body-v1',
  'exact zero retains body and processing proofs');
v2Reply = { ...v2Reply, structureRevision:'stale' };
await assert.rejects(() => v2Gateway.resolveTarget('book','v2-view','t:1'), /identity changed/);
assert.deepEqual(await new ReaderDirectoryNavigationGateway(runtime).open({sourceId:'online',bookId:'book'}),
 {status:'unavailable',reason:'unsupported'}, 'old Core online books stay flat without a v1 local call');
console.log('reader directory v2 scope and target contracts passed');
const { appendReadingSelectionContext, captureRemotePositionContext, decodeRemotePositionMigration } =
  await import('../entry/src/main/ets/features/reading/RemoteReadingPositionMigration.ts');
const selection = captureRemotePositionContext({ anchors: [], directoryTargetProof: proofV2 });
const selectionParams = {};
appendReadingSelectionContext(selectionParams, selection);
assert.equal(selectionParams.positionContext, undefined, 'chapterStart does not fabricate a body-position context');
assert.deepEqual(selectionParams.directoryTargetProof, proofV2);
proofV2.nodeId = 'mutated-after-capture';
assert.equal(selectionParams.directoryTargetProof.nodeId, 't:1', 'deferred selection owns an immutable proof snapshot');
assert.doesNotThrow(() => decodeRemotePositionMigration(undefined, 'source:a', 'book', 'new-body', 'new-processing', selection));
const exactParams = {};
appendReadingSelectionContext(exactParams, { bodyVersion:'body-v1', processingVersion:'processing-v1',
  anchors:[{id:'requested',offset:0}], directoryTargetProof:selection.directoryTargetProof });
assert.equal(exactParams.positionContext.anchors[0].offset, 0);
assert.equal(exactParams.directoryTargetProof.nodeId, 't:1');
console.log('directory selection uses independent immutable authority through deferred context');
const txtCalls = [];
assert.equal(await backfillRetainedReaderDirectoryNavigation({
  supportsCoreCapability: () => true,
  retainedLocalBookSourcePath: () => assert.fail('TXT uses stored TOC and bodies, never reparses archive'),
  request: async (method, params) => { txtCalls.push({method, params}); return {data:{status:'ready'}}; },
}, 'local:txt-sha', () => true, 'txt'), 'ready');
assert.deepEqual(txtCalls, [{method:'reading.directory.rules.prepare.v2', params:{sourceId:'local',bookId:'local:txt-sha'}}]);
const scopedA = readerDirectoryScopeKey('source:a', 'same:book');
const scopedB = readerDirectoryScopeKey('source', 'a:same:book');
assert.notEqual(scopedA, scopedB, 'scope encoding cannot alias colon-delimited source/book pairs');
readerDirectoryToggleCollapsed(scopedA, 'r', 'group');
assert.deepEqual(readerDirectoryCollapsedIds(scopedB), [], 'another source never inherits folded node IDs');
for (let index=0;index<9;index++) readerDirectoryAdmitRevision(readerDirectoryScopeKey('s', `book:${index}`),'r');
assert.deepEqual(readerDirectoryCollapsedIds(scopedA), [], 'fold history is bounded to eight scoped books');
const { readerDirectorySaveViewportAnchor, readerDirectoryViewportAnchor } = await import('../entry/src/main/ets/features/reading/ReaderDirectoryViewport.ts');
readerDirectoryClearSessionState();
readerDirectoryToggleCollapsed('fold-owner','r','group');
for(let i=0;i<8;i++) readerDirectorySaveViewportAnchor({bookId:`viewport-${i}`,navigationRevision:'r',viewId:'v',nodeId:'n',visibleIndex:0,rowFraction:0});
assert.deepEqual(readerDirectoryCollapsedIds('fold-owner'),[], 'folds and viewport jointly retain at most eight scoped books');
readerDirectoryAdmitRevision('viewport-7','new-r');
readerDirectoryAdmitRevision('viewport-7','changed-r');
assert.equal(readerDirectoryViewportAnchor('viewport-7'),undefined,'structure replacement also retires a stale viewport node');

for (const format of ['local', ' LOCAL ', ' TxT ']) {
  const requests = [];
  let current = true;
  const txtRuntime = {
    supportsCoreCapability: capability => capability === 'reading.directory.view.v2',
    retainedLocalBookSourcePath: async () => { throw new Error('TXT must not read retained archive'); },
    request: async (method, params, options) => { requests.push({method,params,options}); return {data:{status:'ready'}}; },
  };
  assert.equal(await backfillRetainedReaderDirectoryNavigation(txtRuntime,'production-txt',()=>current,format),'ready');
  assert.equal(requests[0].method,'reading.directory.rules.prepare.v2');
  assert.deepEqual(requests[0].params,{sourceId:'local',bookId:'production-txt'});
  current=false;
  assert.equal(requests[0].options.shouldCancel(),true);
  assert.equal(await backfillRetainedReaderDirectoryNavigation(txtRuntime,'production-txt',()=>current,format),'unavailable');
  assert.equal(requests.length,1,'stale ownership does not dispatch');
  current=true;
  txtRuntime.request=async()=>{current=false;return {data:{status:'ready'}};};
  assert.equal(await backfillRetainedReaderDirectoryNavigation(txtRuntime,'production-txt',()=>current,format),'unavailable',
    'late prepare success cannot escape its owner');
  current=true;
  txtRuntime.supportsCoreCapability=()=>false;
  assert.equal(await backfillRetainedReaderDirectoryNavigation(txtRuntime,'production-txt',()=>current,format),'unavailable');
}
for (const format of ['EPUB',' mobi ',' AZW3 ', 'kf8']) {
  const methods=[];
  assert.equal(await backfillRetainedReaderDirectoryNavigation({
    retainedLocalBookSourcePath:async()=>'/retained/self-authored-book',
    request:async method=>{methods.push(method);return {data:{status:'ready',navigationRevision:'revision'}};},
  },'archive',()=>true,format),'ready');
  assert.deepEqual(methods,['local_book.navigation.backfill.v1'],'archive formats never route to TXT rules');
}
console.log('PASS local/TXT alias dispatch and cancellation preserve TXT body/rules path; EPUB/MOBI-family retain archive path');

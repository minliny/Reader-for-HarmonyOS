import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const selected = selectContractCases({
  bookmarks: { description: 'Actual atomic bookmark recovery attempts keep action ownership, reject early retries and publish current unknown/confirmed feedback through the existing Journey', resources: [] },
  offline: { description: 'Actual cache-clear recovery attempts keep query/continue ownership and publish a single current result without repeating platform cleanup', resources: [] },
});
for (const id of selected) {
  const { fixture, cleanupDurableFixtures, until, deferred, session: baseSession } = await import('./lib/reading-operation-durable-probe.mjs');
  const { actualReaderDirectoryJourney } = await import('./lib/reader-directory-operations-probe.mjs');
  const { actualReadingEntryPresentation } = await import('./lib/reading-entry-presentation-probe.mjs');
  const remote = { ...baseSession, contentKind: 'text' };
  const book = id === 'bookmarks' ? { sourceId: 'local', bookId: 'book', title: 'Book', author: 'Author' } :
    { ...remote.identity, title: 'Book', author: 'Author' };
  const rpc = finiteTransport(id);
  const f = await fixture(true, undefined, { domain: id === 'bookmarks' ? 'bookmark' : 'directory', transport: rpc.command });
  try {
    const Entry = actualReadingEntryPresentation(), entry = new Entry();
    Object.assign(entry, { book, sessionActive: id === 'bookmarks', sessionGeneration: 1,
      session: id === 'offline' ? remote : undefined, toc: [{ index: 0, title: 'Chapter', downloadState: 'cached', bookmarks: [] }] });
    const scope = { owner: f.runtime, mount: 1, retired: false, foreground: true, covered: false };
    const route = { route: id === 'bookmarks' ? 'reading' : 'directory', generation: 1 }, feedback = [], diagnostics = [];
    const Journey = actualReaderDirectoryJourney({ ReaderDirectoryHost: f.Directory, ReadingOfflineHost: f.Offline, ...f.types });
    const journey = new Journey({ snapshot: () => route }, { scope: () => scope,
      ownsRuntime: owner => f.Runtime.isCurrent(owner), runtime: () => undefined, entry: () => entry, shelfBooks: () => [],
      feedback: message => feedback.push(message), diagnostic: (...args) => diagnostics.push(args) });
    const ops = journey.operations, owner = id === 'bookmarks' ? f.directory : f.offline;
    const operation = () => id === 'bookmarks' ? entry.directoryOperation : entry.offlineOperation;
    const binding = () => id === 'bookmarks' ? ops.bookmarkBinding(f.runtime, book) : ops.offlineBinding(f.runtime, remote);
    const dto = () => ops.recovery(entry.directoryOperation, entry.offlineOperation);
    const call = continuing => id === 'bookmarks' ? ops.reconcileBookmarks(operation().generation, dto().presentationId, continuing) :
      ops.reconcileOffline(operation().generation, dto().presentationId, continuing);
    const mutate = () => id === 'bookmarks' ? ops.togglePageBookmark({ chapterIndex: 0, chapterOffset: 0, chapterTitle: 'Chapter', bookmarkTimes: [], bookText: 'saved' }) :
      owner.clearBook(binding());
    if (id === 'bookmarks') await owner.load(binding());
    f.options.beforeMethod = id === 'bookmarks' ? 'bookmark.create' : 'cache.clear';
    await mutate(); await until(() => !owner.busy() && owner.snapshot() !== undefined);
    assert.equal(operation().projection.receipt.confirmation, 'unknown', JSON.stringify({operation:operation(),calls:f.calls.map(c=>({method:c.method,params:c.params})),diagnostics}));
    const original = JSON.parse(f.disk(id === 'bookmarks' ? 'bookmark' : 'cache'));
    const queryMethod = id === 'bookmarks' ? 'bookmark.operation.query' : 'cache.clear.operation.query';
    const mutationsBefore = f.writes().length;
    feedback.length = 0;
    const firstGate = deferred(); f.options.pauseMethod = queryMethod; f.options.pauseAfterDispatch = true; f.options.gate = firstGate;
    call(false);
    await until(() => f.calls.some(c => c.method === queryMethod && c.params.operationId === original.params.operationId));
    assert.equal(operation().recoveryAction, 'reconcile', 'the accepted original owner publishes its actual query action');
    assert.notEqual(operation(), owner.snapshot(), 'the Journey publishes a fresh top-level operation projection');
    const generation = operation().generation, identity = dto().presentationId;
    assert.equal(await owner.reconcile(generation, binding()), false, 'an already active action is explicitly unadmitted');
    assert.equal(await owner.continueOriginal(generation, binding()), false, 'a retained continuation cannot replace an active query');
    const beforeRejected = feedback.length;
    if (id === 'bookmarks') ops.reconcileBookmarks(generation + 100, identity, false);
    else ops.reconcileOffline(generation + 100, identity, false);
    await Promise.resolve(); assert.equal(feedback.length, beforeRejected, 'rejected old generation emits no completed-action feedback');
    firstGate.resolve();
    await until(() => feedback.length === 1 && operation().recoveryAction === undefined);
    assert.match(feedback[0], /仍未确认/); assert.match(feedback[0], /继续原操作/);
    assert.equal(operation().projection.receipt.confirmation, 'unknown', 'a returned query is never a write ACK');
    assert.equal(f.writes().length, mutationsBefore); assert.deepEqual(JSON.parse(f.disk(id === 'bookmarks' ? 'bookmark' : 'cache')), original);
    assert.equal(operation().canContinueOriginal, true);
    const retiredGate = deferred(); f.options.pauseMethod = queryMethod; f.options.pauseAfterDispatch = true; f.options.gate = retiredGate;
    call(false); await until(() => owner.busy());
    scope.retired = true; retiredGate.resolve();
    await until(() => !owner.busy() && owner.snapshot().recoveryAction === undefined);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(feedback.length, 1, 'an accepted attempt cannot publish feedback after its captured scene retires');
    assert.deepEqual(JSON.parse(f.disk(id === 'bookmarks' ? 'bookmark' : 'cache')), original);
    scope.retired = false;
    rpc.controls.blockQueries = true;
    call(false);
    await until(() => feedback.length === 2 && operation().recoveryAction === undefined);
    assert.equal(operation().projection.receipt.confirmation, 'unknown');
    assert.equal(operation().canContinueOriginal, false, 'a blocked exact query never exposes continuation');
    assert.match(feedback[1], /继续操作不可用/);
    assert.equal(await owner.continueOriginal(generation, binding()), false);
    assert.deepEqual(JSON.parse(f.disk(id === 'bookmarks' ? 'bookmark' : 'cache')), original);
    rpc.controls.blockQueries = false;
    call(false);
    await until(() => feedback.length === 3 && operation().recoveryAction === undefined);
    assert.equal(operation().canContinueOriginal, true);
    const continuationGate = deferred(); f.options.pauseMethod = queryMethod; f.options.pauseAfterDispatch = true; f.options.gate = continuationGate;
    call(true);
    assert.equal(operation().recoveryAction, 'continue', 'the actual continuation owns its spinner role before any asynchronous query');
    await until(() => owner.busy());
    assert.equal(await owner.continueOriginal(generation, binding()), false);
    continuationGate.resolve();
    await until(() => feedback.length === 4 && operation().recoveryAction === undefined);
    assert.match(feedback[3], id === 'bookmarks' ? /已核实/ : /已确认，缓存整理尚未完成/);
    assert.equal(operation().projection.receipt.confirmation, 'confirmed');
    if (id === 'offline') assert.equal(f.calls.filter(call => call.platform).length, 0, 'Core receipt recovery never invents successful platform cleanup');
    assert.equal(f.writes().length, mutationsBefore + 1, 'only explicit continuation dispatches the frozen original once');
    const sent = rpc.mutations.at(-1);
    assert.deepEqual(sent.params, original.params, 'continuation retains the complete original operation ID, sequence and payload');
    assert.equal(f.disk(id === 'bookmarks' ? 'bookmark' : 'cache'), '', 'only the qualified receipt settles the actual private atomic intent');
    assert.equal(operation().generation, generation, 'recovery keeps the original operation generation');
    const beforeNoRetry = feedback.length;
    if (id === 'bookmarks') {
      call(false); await Promise.resolve(); await Promise.resolve();
      assert.equal(feedback.length, beforeNoRetry, 'confirmed nonretryable early return cannot claim another completed check');
    }
    // Exercise the two real guards directly without manufacturing another write.
    assert.equal(await owner.reconcile(generation + 1, binding()), false);
    scope.retired = true;
    assert.equal(await owner.continueOriginal(generation, binding()), false);
    assert.equal(feedback.length, beforeNoRetry);
    console.log(JSON.stringify({ kind: 'recovery-owner-attempts', domain: id, actualAtomicIO: true,
      finiteRpc: true, CoreCLI: false, native: false, feedback, originalGeneration: generation }));
  } finally { await cleanupDurableFixtures(); }
  recordContractCasePass(id);
}

function finiteTransport(domain) {
  let head = null, receipt = null, frozenParams, bookmarks = [], cleared = false;
  const mutations = [], controls = { blockQueries: false };
  const query = domain === 'bookmarks' ? 'bookmark.operation.query' : 'cache.clear.operation.query';
  const settle = domain === 'bookmarks' ? 'bookmark.operation.settle' : 'cache.clear.operation.settle';
  return { mutations, controls, async command(method, params) {
    if (method === 'bookmark.list') return { data: { bookmarks } };
    if (method === 'cache.book.status') return { data: { ...params,
      chapters: [{ chapterIndex: 0, title: 'Chapter', state: cleared ? 'missing' : 'cached', cachedBytes: cleared ? 0 : 10 }] } };
    if (method === query) {
      if (controls.blockQueries && params.operationId !== undefined) throw new Error('controlled exact ledger query unavailable');
      if (params.operationId !== undefined && receipt !== null) {
        assert.equal(params.operationId, head.operationId);
        assert.deepEqual(params.expected, domain === 'bookmarks' ? { action: 'create', params: frozenParams } : frozenParams);
      }
      return { data: { head, receipt: params.operationId === undefined ? null : receipt } };
    }
    if (method === settle) { assert.deepEqual(params, head); receipt = { ...receipt, phase: 'settled' }; return { data: { binding: head, phase: 'settled' } }; }
    assert.equal(method, domain === 'bookmarks' ? 'bookmark.create' : 'cache.clear');
    frozenParams = structuredClone(params); mutations.push({ method, params: frozenParams });
    head = { operationId: params.operationId, sequence: params.sequence,
      payloadFingerprint: createHash('sha256').update(JSON.stringify(params)).digest('hex') };
    let result;
    if (domain === 'bookmarks') {
      const bookmark = { bookName: params.bookName, bookAuthor: params.bookAuthor, chapterIndex: params.chapterIndex,
        chapterPos: params.chapterPos, chapterName: params.chapterName, bookText: params.bookText, content: params.bookText, time: 1 };
      bookmarks.push(bookmark); result = { bookmark };
    } else { cleared = true; result = { scope: 'book', cacheEntriesRemoved: 1, chapterEntriesRemoved: 1, queueEntriesRemoved: 0, removedContentBytes: 10 }; }
    receipt = domain === 'bookmarks' ? { binding: head, phase: 'committed', outcome: { action: 'create', result } } :
      { binding: head, phase: 'committed', result };
    return { data: result };
  } };
}

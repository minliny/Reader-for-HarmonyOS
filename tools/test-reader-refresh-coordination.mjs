import { ProductionHost, setRuntime } from './lib/reading-entry-owner-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, n) { try { return n(s, c); } catch (e) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return n(`${s}.ts`, c); throw e;
} } });
const { currentCachedChapterFeedbackOwners } = await import('./lib/reader-download-feedback-current-owner-probe.mjs');
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/features/reading/application/BookAcquisitionCoordinator.ts');
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/application/ReadingSessionFlowGateway.ts');
const { RemoteChapterCacheRefreshError } = await import('../entry/src/main/ets/features/reading/application/RemoteReadingFlowGateway.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const session = { identity: { sourceId: 's', bookId: 'b' }, sourceVersion: 'v1', acquisitionMode: 'online',
  detailUrl: '/b', tocUrl: '/toc', book: { title: '书', author: '作者' }, continuationVariables: [], hostRequirements: [],
  entries: [{ index: 0, title: '第一章', url: '/0', variables: [] }] };
const response = { data: { ...session.identity, chapterTitle: '第一章', via: 'rule',
  content: '春天的早晨阳光照进窗台，故事中的人们走向城外。'.repeat(30),
  bodyVersion: 'new', processingVersion: 'new-p' } };

// Actual session gateway, actual serialized remote lane. The RPC represents
// a Core write already dispatched before the refresh tap; only its completion
// may allow Core to capture the old progress/history snapshot for replacement.
{
  const calls = [], oldWrite = deferred(), refreshed = deferred();
  const gateway = new ReadingSessionFlowGateway('s', 'b', { kind: 'remote', session }, {
    request: async (method, params) => {
      calls.push([method, params]); await refreshed.promise; return response;
    },
  });
  const write = gateway.runProgressCommitSerial(async () => { calls.push(['old-write']); await oldWrite.promise; calls.push(['old-ack']); });
  await tick();
  const refresh = gateway.loadChapter('b', 0, () => true, true);
  await tick();
  assert.deepEqual(calls.map(c => c[0]), ['old-write'], 'refresh must not capture a progress snapshot while its predecessor is unsettled');
  const later = gateway.runProgressCommitSerial(async () => { calls.push(['later-write']); });
  oldWrite.resolve(); await write; await tick();
  assert.deepEqual(calls.map(c => c[0]), ['old-write', 'old-ack', 'chapter.content']);
  refreshed.resolve(); const chapter = await refresh; await later;
  assert.equal(chapter.bodyVersion, 'new');
  assert.equal(calls.at(-1)[0], 'later-write', 'refresh publication stays in the same lane through HTTP completion');
  assert.equal(calls.find(c => c[0] === 'chapter.content')[1].forceRefresh, true);
}

// A confirmed cache-refresh prompt must survive its OWN Coordinator revision
// increments. Run real Index and gateways against the actual Coordinator,
// whose cancellation callback is observed at dispatch and after the response.
for (const mode of ['success', 'decline', 'leave', 'rules-changed']) {
  let current = true; const calls = [], gate = deferred();
  const coordinator = new BookAcquisitionCoordinator(async (method, params, options) => {
    calls.push(method);
    if (options?.shouldCancel?.()) throw Error('cancelled at dispatch');
    if (method === 'source.list') return { data: { sources: [{ sourceId: 's', name: '书源', enabled: true, sourceVersion: 'v1' }] } };
    if (method === 'replace-rule.put') return { data: {} };
    assert.equal(method, 'chapter.content');
    await gate.promise;
    if (options?.shouldCancel?.()) throw Error('cancelled at completion');
    return response;
  });
  const owner = { request: (...args) => coordinator.request(...args), bookAcquisitions: () => coordinator };
  setRuntime(owner);
  const host = ProductionHost.forRuntime(owner);
  const failures = [], feedback = [], notices = [];
  const { entry, receiver } = currentCachedChapterFeedbackOwners(owner, host, { get live() { return current; } }, feedback, notices);
  Object.assign(entry, { book: { ...session.identity, ...session.book, sourceName: '书源' }, session,
    toc: session.entries, verdict: 'readable' });
  receiver.getUIContext = () => ({ showAlertDialog() { assert.fail('cache verification is nonmodal'); } });
  entry.bindReader(owner, { current: () => current, projectionVisible: () => true,
    membership: () => ({ generation: 0, blocked: false, value: false }), refreshShelf() {},
    notice: (...args) => failures.push(args), cacheDecision: receiver.chooseCachedChapterRefresh });
  const cacheError = new RemoteChapterCacheRefreshError(session, 0, undefined, false);
  const probe = await host.recoverCachedChapter(entry.scopeId, cacheError, () => current);
  assert.equal(probe, undefined); assert.equal(calls.length, 0, 'a background probe never refreshes content');
  assert.equal(entry.recoveryNotice.visible, true);
  assert.equal(notices.length, 1);
  if (mode === 'decline') { coordinator.close(); continue; }
  let result;
  const recover = host.recoverCachedChapter.bind(host);
  host.recoverCachedChapter = (...args) => { result = recover(...args); return result; };
  entry.retryRecoveryNotice(entry.recoveryNotice.generation);
  assert.ok(result, 'only the real inline action starts the accepted refresh');
  await tick();
  assert.equal(calls.filter(method => method === 'chapter.content').length, 1);
  if (mode === 'leave') current = false;
  if (mode === 'rules-changed') await coordinator.request('replace-rule.put', {});
  gate.resolve();
  const selected = await result;
  if (mode === 'success') {
    assert.equal(selected, 0, 'an explicitly accepted refresh cannot cancel itself');
    assert.equal(entry.verdict, 'readable');
    assert.equal(entry.session.preparedChapter.projectionRevision, coordinator.readingProjectionRevision());
    assert.equal(failures.length, 0);
    assert.equal(feedback.length, 0);
  } else {
    assert.equal(selected, undefined, mode);
    assert.equal(entry.session.preparedChapter, undefined, `${mode}: no stale prepared body may be installed`);
  }
  coordinator.close();
}
console.log('PH94/95 actual refresh lane, prompt/Coordinator revisions, decline/navigation and concurrent rule invalidation PASS');

// Unmodified wire exported by Core 5c79799d5's real Pending/HTTP/SQLite test,
// not a hand-written approximation of the response DTO. This checks the
// platform gateway's decoding and subsequent versioned progress write.
const wire = JSON.parse(readFileSync(new URL('./fixtures/remote-refresh-core-wire.json', import.meta.url), 'utf8'));
for (const row of wire.cases) {
  const calls = [];
  const gateway = new ReadingSessionFlowGateway('s', 'b', { kind: 'remote', session }, {
    request: async (method, params) => { calls.push({ method, params });
      if (method === 'chapter.content') return { data: row.chapterContent };
      assert.equal(method, 'reading.progress.update');
      return { data: row.progressUpdated };
    },
  });
  const receipt = row.chapterContent.positionMigration;
  const context = { bodyVersion: receipt.previousBodyVersion, processingVersion: receipt.previousProcessingVersion,
    anchors: receipt.anchors.map(a => ({ id: a.id, offset: a.previousOffset })) };
  const chapter = await gateway.loadChapter('b', 0, () => true, true, context);
  assert.equal(chapter.content, row.chapterContent.content);
  assert.equal(chapter.positionMigration.status, receipt.status);
  const params = row.progressUpdateParams;
  const result = await gateway.resolveAndUpdateProgress('b', chapter.chapterTitle,
    { chapterIndex: params.chapterIndex, chapterOffset: params.chapterOffset, chapterProgress: params.chapterProgress,
      bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion }, params.layout, () => true);
  assert.equal(result.bodyVersion, chapter.bodyVersion);
  assert.equal(result.chapterOffset, params.chapterOffset);
  assert.equal(calls[1].params.expectedBodyVersion, params.expectedBodyVersion);
  assert.equal(calls[1].params.expectedProcessingVersion, params.expectedProcessingVersion);
}
assert.equal(wire.cases.length, 4);
console.log('PH95 real Core wire -> production Host decode -> scoped progress publication: changed/unchanged body with/without saved progress PASS');

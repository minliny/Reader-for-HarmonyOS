import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); } catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; } } });
const { MangaSourceSwitchGateway } = await import('../entry/src/main/ets/features/manga/MangaSourceSwitchGateway.ts');
const { ReaderWriteEvidence } = await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const { BookRequestNotDispatchedError } = await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const chapter = { sourceId: 'target', bookId: 'book', chapterId: '/target-chapter' };
const pageId = `mp1:${'a'.repeat(64)}`;
const proposal = { fromSourceId: 'old', fromBookId: 'old-book', expectedFrom: { epoch: 2, revision: 6 },
  expectedTarget: { epoch: 3, revision: 4 }, targetPageOrdinal: 0, mapping: 'approximate', chapterTitle: 'Chapter',
  firstImage: { chapter, chapterIndex: 7, manifestVersion: 'manifest', sourceRuleVersion: 'rules', decodeRevision: 'identity-v1',
    pageId, resourceRef: `manga:${pageId}`, imageRevision: 'pixels', width: 600, height: 800 } };
const receipt = () => ({ data: { mapping: 'approximate', progress: { token: { epoch: 3, revision: 5 }, location: {
  kind: 'manga', chapter: { ...chapter }, manifestVersion: 'manifest', pageId, pageOrdinalFallback: 0, x: 0, y: 0, progressRevision: 5,
} } } });
function fixture() {
  const startup = deferred(), native = deferred(), sent = deferred(), calls = [];
  const Owner = productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url), ['requestDirect'], {
    LOG_DOMAIN: 0, DEFAULT_CORE_REQUEST_TIMEOUT_MS: 30000,
    coreAdmissionFailureSummary: () => undefined, httpResponseFailureSummary: () => undefined, hilog: { warn() {} },
  });
  const owner = Object.assign(new Owner(), { state: 'starting', preparationIntentEpoch: 0,
    readingEntryPreparations: () => ({ beginRequest: () => false, finishRequest() {} }),
    start: async () => { await startup.promise; },
    runtime: { request(method, params, options) { calls.push({ method, params, options }); sent.resolve(); return native.promise; } },
  });
  const runtime = { request: (method, params, options) => owner.requestDirect(method, params, options) };
  let current = true;
  return { gateway: new MangaSourceSwitchGateway(runtime), evidence: new ReaderWriteEvidence(), owner, calls, native, sent,
    current: () => current, retire: () => { current = false; }, ready: () => { owner.state = 'ready'; startup.resolve(); } };
}
{
  const f = fixture(); const pending = f.gateway.commit(proposal, true, f.current, f.evidence);
  assert.equal(f.evidence.confirmation(), 'undispatched'); f.ready(); await f.sent.promise;
  assert.equal(f.evidence.dispatchedCount, 1); assert.equal(f.evidence.confirmedCount, 0);
  assert.equal(f.calls[0].method, 'manga.sourceSwitch.commit'); assert.equal(f.calls[0].options.shouldCancel, undefined);
  f.retire(); f.native.resolve(receipt()); const progress = await pending;
  assert.equal(progress.location.pageId, pageId); assert.equal(f.evidence.confirmation(), 'confirmed', 'retiring UI cannot discard an exact accepted durable ACK');
}
{
  const f = fixture(); const pending = f.gateway.commit(proposal, true, f.current, f.evidence);
  const rejected = assert.rejects(pending, error => error instanceof BookRequestNotDispatchedError);
  f.retire(); f.ready(); await rejected; assert.equal(f.calls.length, 0); assert.equal(f.evidence.confirmation(), 'undispatched');
}
{
  const f = fixture(); const pending = f.gateway.commit(proposal, true, f.current, f.evidence);
  const rejected = assert.rejects(pending, /lost ACK/); f.ready(); await f.sent.promise; f.native.reject(Error('lost ACK'));
  await rejected; assert.equal(f.evidence.confirmation(), 'unknown'); assert.equal(f.evidence.confirmedCount, 0);
}
const mutations = [
  r => { r.data.mapping = 'exact'; }, r => { r.data.progress.token.epoch = 4; },
  r => { r.data.progress.token.revision = 6; }, r => { r.data.progress.location.progressRevision = 4; },
  r => { r.data.progress.location.kind = 'text'; }, r => { r.data.progress.location.chapter.sourceId = 'other'; },
  r => { r.data.progress.location.chapter.chapterId = '/other'; }, r => { r.data.progress.location.manifestVersion = 'other'; },
  r => { r.data.progress.location.pageOrdinalFallback = 1; }, r => { r.data.progress.location.pageId = `mp1:${'b'.repeat(64)}`; },
  r => { r.data.progress.location.x = .5; }, r => { r.data.progress.location.y = .5; },
  r => { r.data.progress.location = null; }, r => { delete r.data.progress.token; },
];
for (const mutate of mutations) {
  const f = fixture(), response = receipt(); mutate(response);
  const pending = f.gateway.commit(proposal, true, f.current, f.evidence);
  const rejected = assert.rejects(pending, /MANGA_SWITCH_RECEIPT_INVALID/); f.ready(); await f.sent.promise; f.native.resolve(response);
  await rejected; assert.equal(f.evidence.dispatchedCount, 1); assert.equal(f.evidence.confirmedCount, 0); assert.equal(f.evidence.confirmation(), 'unknown');
}
for (const consent of [false, true]) {
  const f = fixture(); if (consent) f.retire();
  await assert.rejects(f.gateway.commit(proposal, consent, f.current, f.evidence), /CONFIRMATION_REQUIRED/);
  assert.equal(f.calls.length, 0); assert.equal(f.evidence.confirmation(), 'undispatched');
}
console.log('PASS actual manga gateway → Runtime direct dispatch: startup retirement never sends; one dispatch marker; exact late durable ACK confirmed; lost/14 malformed ACKs stay unknown; mapping/identity/manifest/page/coordinates/target CAS and consent fences. Native transport controlled; no target or storage claim.');

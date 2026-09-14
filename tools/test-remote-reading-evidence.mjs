import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context); throw error; }
} });
const { sameRemoteSessionEvidence, preparedRemoteChapterMatches, withPreparedRemoteChapter } =
  await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
let revision = 0; let load = async (session, index) => chapter(session, index);
const owner = { bookAcquisitions: () => ({ readingProjectionRevision: () => revision,
  acquireBook: async () => selectedSession }) };
let selectedSession;
class Gateway { async loadChapter(session, index, current) { return load(session, index, current); } }
const Index = productionMotionMethods(fileURLToPath(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url)),
  ['installRemoteReadingSession', 'probeRemoteContentVerdict', 'refreshCachedSearchDetailInBackground', 'switchPreviewSource',
    'nextNavigationGeneration'], {
    sameRemoteSessionEvidence, preparedRemoteChapterMatches, withPreparedRemoteChapter,
    ReaderRuntimeOwner: { current: () => owner }, RemoteReadingFlowGateway: Gateway, ReadingOfflineGateway: class {},
    remoteReadingFailureKindOf: error => error.kind ?? 'SOURCE_HTTP_FAILED', verdictForFailureKind: () => 'networkFailed',
    errorMessageOf: error => error.message, DOMAIN: 0, hilog: { warn() {} },
  });
function session(version = 'A') {
  return { identity: { sourceId: 'source', bookId: 'book' }, sourceVersion: 'rule-v1', acquisitionMode: 'online',
    detailUrl: '/book', tocUrl: '/toc', catalogAt: 100, catalogVersion: `catalog-${version}`, contextVersion: `context-${version}`,
    continuationVariables: [{ name: 'token', value: version }], hostRequirements: ['httpExecute'], requiresContextRefresh: false,
    book: { title: '书', author: '作者' }, entries: [0, 1].map(index => ({ index, title: `章${index}`, url: `/${version}/${index}`, variables: [] })) };
}
function chapter(current, index) {
  return { sourceId: current.identity.sourceId, bookId: current.identity.bookId, chapterIndex: index,
    chapterUrl: current.entries[index].url, chapterTitle: current.entries[index].title,
    content: '清晨的阳光照进房间，故事从这里开始。'.repeat(20), images: [], contentVersion: `host-${index}`,
    bodyVersion: `body-${index}`, processingVersion: `processing-${index}`, extractionVia: 'rule' };
}
function page(current = session()) {
  return Object.assign(new Index(), { remoteReadingSession: current, remoteContentVerdict: 'verifying',
    remoteSessionGeneration: 0, remoteContentProbeGeneration: 0, navigationGeneration: 7, route: 'detail',
    readingSessionActive: false, bookshelfRemovalActiveKey: '', detailInBookshelf: false,
    loadRemoteDirectoryProjection: async (_a, _b, value) => value.entries });
}

for (const oldFailure of [false, true]) {
  const a = session('A'), b = session('B'); const p = page(a); const gate = deferred();
  const old = p.probeRemoteContentVerdict({ loadChapter: () => gate.promise }, a, () => true);
  p.installRemoteReadingSession(b);
  const newResult = await p.probeRemoteContentVerdict(new Gateway(), b, () => true);
  assert.equal(newResult, 0); assert.equal(p.remoteContentVerdict, 'readable');
  if (oldFailure) gate.reject(Error('old failed')); else gate.resolve(chapter(a, 0));
  await old;
  assert.equal(p.remoteContentVerdict, 'readable');
  assert.equal(p.remoteReadingSession.preparedChapter.chapter.chapterUrl, '/B/0');
}

{
  const a = session(); const p = page(a); const gate = deferred();
  const old = p.probeRemoteContentVerdict({ loadChapter: () => gate.promise }, a, () => true);
  const later = await p.probeRemoteContentVerdict(new Gateway(), a, () => true, 1);
  gate.reject(Error('older same-session failure')); await old;
  assert.equal(later, 1); assert.equal(p.remoteContentVerdict, 'readable');
  assert.equal(p.remoteReadingSession.preparedChapter.chapter.chapterIndex, 1);
}

{
  const a = session(); const p = page(a); let calls = 0;
  const gateway = { loadChapter: async (value, index) => { calls++; return chapter(value, index); } };
  await p.probeRemoteContentVerdict(gateway, a, () => true, 1);
  const proof = p.remoteReadingSession.preparedChapter;
  p.installRemoteReadingSession({ ...a, book: { ...a.book, title: '补全标题', intro: '简介' } });
  assert.equal(p.remoteReadingSession.preparedChapter, proof);
  assert.equal(p.remoteReadingSession.requiresContextRefresh, false);
  assert.equal(await p.probeRemoteContentVerdict(gateway, p.remoteReadingSession, () => true), 1);
  assert.equal(calls, 1, 'metadata does not discard or revalidate the actual passed chapter');
  await p.probeRemoteContentVerdict(gateway, p.remoteReadingSession, () => true, 0);
  assert.equal(calls, 2, 'an explicitly different chapter still requires its own body');
  revision++;
  await p.probeRemoteContentVerdict(gateway, p.remoteReadingSession, () => true, 0);
  assert.equal(calls, 3, 'processing changes invalidate the in-memory handoff');
}

{
  const a = session('A'), b = session('B'), c = session('C'); const p = page(a); const refresh = deferred();
  p.refreshCachedSearchDetailInBackground({}, '书源', a, 7, refresh.promise);
  p.installRemoteReadingSession(c); refresh.resolve(b); await settle();
  assert.equal(p.remoteReadingSession.catalogVersion, c.catalogVersion, 'an old refresh cannot overwrite a newer installed catalog');
}

{
  const a = session('A'), b = session('B'); const p = page(a); const body = deferred(), projection = deferred();
  load = async () => body.promise;
  p.loadRemoteDirectoryProjection = () => projection.promise;
  p.refreshCachedSearchDetailInBackground({}, '书源', a, 7, Promise.resolve(b)); await settle();
  assert.equal(p.remoteReadingSession.catalogVersion, b.catalogVersion);
  const c = session('C'); p.installRemoteReadingSession(c); p.detailToc = c.entries;
  body.resolve(chapter(b, 0)); projection.resolve(b.entries); await settle();
  assert.equal(p.remoteContentVerdict, 'verifying');
  assert.equal(p.detailToc, c.entries, 'late directory projection has the same session guard as the verdict');
  load = async (value, index) => chapter(value, index);
}

{
  selectedSession = session('switch'); const p = page(); const calls = [];
  p.detailReturnRoute = 'search';
  load = async (value, index) => { calls.push(index); if (index === 0) throw { kind: 'SOURCE_CONTENT_EMPTY', message: 'empty' }; return chapter(value, index); };
  let opened;
  p.openRemoteBookDetail = (...args) => { opened = args; };
  await p.switchPreviewSource({ sourceId: 'source', bookUrl: 'book', bookName: '书', author: '作者' }, () => true);
  assert.deepEqual(calls, [0, 1]); assert.equal(opened[6], 'search');
  const transferred = opened[7];
  assert.equal(transferred.preparedChapter.chapter.chapterIndex, 1);
  const detail = page(transferred);
  assert.equal(await detail.probeRemoteContentVerdict(new Gateway(), transferred, () => true), 1);
  assert.deepEqual(calls, [0, 1], 'source picker to detail hands over the successful body without another probe');
  load = async (value, index) => chapter(value, index);
}

{
  const a = session(); const prepared = withPreparedRemoteChapter(a, chapter(a, 1), revision);
  let reads = 0;
  const coordinator = { readingProjectionRevision: () => revision, currentSourceVersion: async () => 'rule-v1',
    beginAttempt: () => 1, reportVerdict: async () => {} };
  const runtime = { bookAcquisitions: () => coordinator, request: async (method, params) => {
    assert.equal(method, 'chapter.content'); reads++;
    return { data: { sourceId: 'source', bookId: 'book', chapterTitle: '章', via: 'rule', content: chapter(a, params.chapterIndex).content,
      bodyVersion: 'body', processingVersion: 'processing' } };
  } };
  const gateway = new ReadingSessionFlowGateway('source', 'book', { kind: 'remote', session: prepared }, runtime);
  assert.equal(await gateway.loadChapter('book', 1, () => true), prepared.preparedChapter.chapter);
  assert.equal(reads, 0, 'reader receives the actual materialized chapter');
  await gateway.loadChapter('book', 0, () => true); assert.equal(reads, 1);
  const changed = new ReadingSessionFlowGateway('source', 'book', { kind: 'remote', session: prepared }, runtime);
  revision++;
  await changed.loadChapter('book', 1, () => true); assert.equal(reads, 2);
  const forced = new ReadingSessionFlowGateway('source', 'book', { kind: 'remote', session: prepared }, runtime);
  await forced.loadChapter('book', 1, () => true, true); assert.equal(reads, 3);
}
console.log('R1/R9 actual session ownership, stale verdict/directory rejection and validated chapter handoff: PASS');

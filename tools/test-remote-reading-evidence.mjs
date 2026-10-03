import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import {compileHost,setRuntime} from './lib/reading-entry-owner-probe.mjs';
import {fixture as switchFixture,session as switchSession,settle as settleSwitch} from './lib/source-switch-owner-probe.mjs';
import {makeIndex as makeSwitchIndex} from './lib/source-switch-sdk-consumer.mjs';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context); throw error; }
} });
const { sameRemoteSessionEvidence, preparedRemoteChapterMatches, preparedRemoteChapterPositionMatches, withPreparedRemoteChapter, copyRemoteReadingSession } =
  await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const { captureRemotePositionContext } = await import('../entry/src/main/ets/features/reading/RemoteReadingPositionMigration.ts');
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
let revision = 0; let load = async (session, index) => chapter(session, index);
const owner = { bookAcquisitions: () => ({ readingProjectionRevision: () => revision,
  acquireBook: async () => selectedSession,setPreparationVisible(){} }) };
owner.request=async method=>{if(method==='bookmark.list')return{data:{bookmarks:[]}};throw Error('unexpected evidence IO '+method);};
let selectedSession;
class Gateway { async loadChapter(session, index, current) { return load(session, index, current); } }
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
  setRuntime(owner);let p;
  const emptyAdmission={generation:0,adding:false,cancelling:false,confirmation:'none'};
  const Entry=compileHost(undefined,{ReaderRuntimeOwner:{current:()=>owner,isCurrent:r=>r===owner},
    RemoteReadingFlowGateway:class {async loadChapter(...args){return (owner.bodyLoader??load)(...args);}},
    ReadingOfflineGateway:class {async loadDirectoryProjection(value){return p.loadRemoteDirectoryProjection({},owner,value);}}});
const Index = productionMotionMethods(fileURLToPath(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url)),
  ['installRemoteReadingSession','probeRemoteContentVerdict','bindReadingEntryReader','nextNavigationGeneration'], {
    sameRemoteSessionEvidence, preparedRemoteChapterMatches, preparedRemoteChapterPositionMatches, captureRemotePositionContext, withPreparedRemoteChapter, copyRemoteReadingSession,
    ReaderRuntimeOwner: { current: () => owner },ReadingEntryHost:Entry,EMPTY_READABLE_ADMISSION:emptyAdmission,LOCAL_SOURCE_ID:'local', RemoteReadingFlowGateway: Gateway, ReadingOfflineGateway: class {},
    remoteReadingFailureKindOf: error => error.kind ?? 'SOURCE_HTTP_FAILED', verdictForFailureKind: () => 'networkFailed',
    errorMessageOf: error => error.message, DOMAIN: 0, hilog: { warn() {} },
  });
  p=Object.assign(new Index(), { remoteReadingSession: current, remoteContentVerdict: 'verifying',
    mountedRuntimeOwner:owner,detailShelfAdmissionMount:1,shelfReceiptRetired:false,
    detailBook:{sourceId:'source',bookId:'book',title:'书',author:'作者'},detailToc:current.entries,
    detailReadableAdmission:()=>emptyAdmission,
    remoteSessionGeneration: 0, remoteContentProbeGeneration: 0, navigationGeneration: 7, route: 'detail',
    readingSessionActive: false, shelfOperation: {generation:0,removalKey:'',busy:false,batchRemovalBusy:false}, detailInBookshelf: false,
    loadRemoteDirectoryProjection: async (_a, _b, value) => value.entries });
  p.bindReadingEntryReader();
  // Only the original controlled Gateway IO seam changes; the owner algorithm
  // and its current scope/session/generation guards execute unchanged.
  p.probeRemoteContentVerdict=(gateway,...args)=>{owner.bodyLoader=gateway.loadChapter.bind(gateway);return Index.prototype.probeRemoteContentVerdict.call(p,gateway,...args);};
  p.refreshCachedSearchDetailInBackground=(seed,name,cached,_navigation,refresh)=>{
    owner.bodyLoader=load;return p.readingEntryHost.refreshInBackground(seed,name,cached,p.readingEntryScopeId,p.readingEntryHost.lease,refresh);
  };
  return p;
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
  const f=switchFixture({shared:true,open:false,preview:true}),x=makeSwitchIndex(f);
  x.index.detailReturnRoute='search';x.index.openDetailSourceSwitch();await settleSwitch();
  const before=f.calls.filter(c=>c[0]==='chapter.content').length;
  x.mount();const row=x.rows().find(r=>r.sourceId==='new');assert.ok(row);row.onSelect();await settleSwitch();await settle();
  const opened=x.index.effects.find(e=>typeof e==='object'&&e.validated);assert.ok(opened);
  assert.equal(f.calls.filter(c=>c[0]==='chapter.content').length,before,'source selection transfers its catalog without a preliminary body probe');
  assert.equal(opened.resume,true);assert.equal(opened.parent,'search');
  assert.equal(opened.validated,switchSession,'original acquired full catalog/context is retained exactly');
  assert.equal(opened.validated.preparedChapter,undefined);
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

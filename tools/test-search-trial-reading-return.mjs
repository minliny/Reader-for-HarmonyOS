import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const { searchCandidateRank } = await import('../entry/src/main/ets/features/search/SearchCandidatePolicy.ts');
const readingEvidence=await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const {captureRemotePositionContext}=await import('../entry/src/main/ets/features/reading/RemoteReadingPositionMigration.ts');
const {RemoteChapterCacheRefreshError}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
import { SearchViewState } from '../entry/src/main/ets/features/search/SearchViewState.ts';

// The acquisition boundary and Core persistence are fakes. Execute the actual
// Index methods through the project's SDK parser, including both acquisition
// phases and the preview-switch dispatch. Candidate selection/body admission
// itself is covered with the real coordinator in test-search-candidate-acquisition.
const source = process.env.READER_TRIAL_RETURN_INDEX_SOURCE ??
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const methods = ['installRemoteReadingSession',
  'onSearchResultSelected', 'searchAcquisitionCandidate', 'remoteSeedForSearchBook', 'openRemoteBookDetail',
  'openShelfBook', 'openShelfBookInfo', 'openDetailSourceSwitch', 'onPickSource', 'switchPreviewSource',
  'openReading', 'presentPreparedReading', 'onReaderExited', 'returnToReadingOrigin',
  'returnFromDetail', 'returnToSearch', 'returnToBookshelf', 'nextNavigationGeneration',
  'isSourceSwitchActive', 'isKnownDetailChapter', 'probeRemoteContentVerdict',
  'remoteContentVerdictLabel',
];

function fixture({ firstFails = false, origin = 'search' } = {}) {
  const calls = [], notices = [], rows = new Map(), gates = new Map();
  const makeBook = (sourceId, bookId) => ({ sourceId, bookId, detailUrl: bookId,
    title: '鸣龙', author: '关关公子', sourceName: `${sourceId} 名称`, variables: [] });
  const first = makeBook('first-source', 'first-book');
  const second = makeBook('second-source', 'second-book');
  const third = makeBook('third-source', 'third-book');
  const key = book => `${book.sourceId}\0${book.bookId}`;
  const sessions = new Map([first, second, third].map(book => [key(book), {
    identity: { sourceId: book.sourceId, bookId: book.bookId }, book,
    entries: [{ index: 0, title: '第一章', url: `${book.bookId}/chapter-1` }], acquisitionMode: 'cache',
  }]));
  const acquire = async (seed, kind) => {
    calls.push(`${kind}:${seed.sourceId}`);
    const gate = gates.get(seed.sourceId);
    if (gate !== undefined) await gate.promise;
    if (firstFails && seed.sourceId === first.sourceId) throw new Error('book.toc returned no readable chapters');
    return sessions.get(key(seed));
  };
  const loadChapter = async session => {
    calls.push(`chapter.probe:${session.identity.sourceId}`);
    return {sourceId:session.identity.sourceId,bookId:session.identity.bookId,chapterIndex:0,
      chapterUrl:session.entries[0].url,contentVersion:'body',content:'正文',images:[]};
  };
  const owner = { bookAcquisitions: () => ({
    readingProjectionRevision:()=>0, acquireBook: seed => acquire(seed, 'switch.acquire'),
    acquireBookWithBackgroundRefresh: async seed => ({ session: await acquire(seed, 'detail.acquire') }),
    acquireCandidateGroup: async (candidates,options) => {
      assert.equal(candidates.length,1,'this navigation fixture selects one new-book candidate');
      assert.equal(options.requireReadable,true,'new-book trial waits for readable body admission');
      const session=await acquire(candidates[0].seed,'detail.acquire');
      if(!options.isCurrent())throw Error('cancelled acquisition');
      options.onCatalog(session);
      return {session:readingEvidence.withPreparedRemoteChapter(session,await loadChapter(session),0)};
    },
    setPreparationVisible() {}, recentFailures: () => [], endSearch: () => calls.push('search.end'),
  }) };
  const Index = productionMotionMethods(source, methods, {
    ...readingEvidence,captureRemotePositionContext,RemoteChapterCacheRefreshError, searchCandidateRank, LOCAL_SOURCE_ID: 'local', ReaderRuntimeOwner: { current: () => owner },
    RemoteReadingFlowGateway: class {
      async loadProgress() { return {kind:'missing'}; }
      async loadChapter(session) { return loadChapter(session); }
    },
    ReadingOfflineGateway: class {},
    ReaderCoreGateway: class {
      async loadShelfBook(sourceId, bookId) { calls.push('shelf.read'); return rows.get(`${sourceId}\0${bookId}`); }
      async upsertBook() { calls.push('UNEXPECTED.shelf.write'); throw new Error('preview cannot add a book'); }
    },
    RemoteDetailAdmission: class { constructor(session) { this.session = session; } },
    RemoteReadingGatewayError: class extends Error {},
    remoteReadingFailureRecord: error => ({ message: error.message }),
    remoteReadingFailureKindOf: () => 'SOURCE_PARSE_FAILED', verdictForFailureKind: () => 'parseFailed',
    sourceSwitchCandidateKey: (sourceId, bookId) => `${sourceId}\0${bookId}`,
    errorMessageOf: error => error.message, DOMAIN: 0,
    hilog: { info() {}, warn() {}, error() {} },
  });
  const h = new Index();
  const view = new SearchViewState();
  Object.assign(view, { keywordDraft: '鸣龙', category: '小说', anchorKey: '鸣龙\0关关公子',
    anchorIndex: 4, anchorOffset: 29, anchorItemY: 83 });
  view.rank('other'); view.rank('鸣龙\0关关公子');
  const presentation = { kind: 'results', keyword: '鸣龙', results: [first, second, third], searching: false };
  const orchestrator = { resume: () => calls.push('search.resume'), close: () => calls.push('search.close'),
    open: () => calls.push('UNEXPECTED.search.open'), search: () => calls.push('UNEXPECTED.search.search') };
  Object.assign(h, {
    remoteSessionGeneration:0,remoteContentProbeGeneration:0,route: origin, readingOriginRoute: 'detail', detailReturnRoute: 'bookshelf',
    readingSessionActive: false, navigationGeneration: 0, shelfReadingPreparation: false,
    detailToc: [], detailInBookshelf: false, shelfBooks: [], searchDetailCandidates: [], remoteCatalogRefreshAt: new Map(),
    bookshelfRemovalActiveKey: '', offlineMutationGeneration: 0,
    sourceSwitchVisible: false, sourceSwitchState: { kind: 'discovering' },
    searchViewState: view, searchPresentation: presentation, searchOrchestrator: orchestrator,
    getSearchOrchestrator: () => orchestrator,
    readingDetailForRemoteSeed: (seed, sourceName) => ({ ...seed, sourceName }),
    sourceDisplayName: (sourceId, name) => name ?? sourceId,
    loadRemoteDirectoryProjection: async (_offline, _owner, session) => session.entries,
    refreshDetailAcquisitionProjection: async () => { calls.push('detail.project'); },
    refreshBookshelf: () => calls.push('shelf.project'),
    showReadingFailure: (title, message) => notices.push({ title, message }),
    getSourceSwitchGateway: () => ({ commitSwitch: async () => { calls.push('UNEXPECTED.switch.commit'); } }),
    startSourceDiscovery: () => { h.sourceSwitchState = { kind: 'candidates', candidates: [] }; },
  });
  const candidate = book => ({ sourceId: book.sourceId, bookUrl: book.bookId, bookName: book.title,
    author: book.author, sourceName: book.sourceName });
  return { h, calls, notices, first, second, third, candidate, view, presentation, rows, sessions, gates };
}

const outcomes = [];
async function check(name, test) {
  try { await test(); outcomes.push({ name, status: 'PASS' }); }
  catch (error) { outcomes.push({ name, status: 'FAIL', error: error.message }); }
}
function noUnexpectedWrites(t) {
  assert.deepEqual(t.calls.filter(value => value.startsWith('UNEXPECTED.')), [],
    'preview/navigation must not mutate the shelf, commit a source switch, or restart search');
}
function assertSearchRetained(t) {
  assert.equal(t.h.route, 'search');
  assert.equal(t.h.searchViewState, t.view); assert.equal(t.h.searchPresentation, t.presentation);
  assert.deepEqual([t.view.keywordDraft, t.view.category, t.view.anchorKey, t.view.anchorIndex,
    t.view.anchorOffset, t.view.anchorItemY, [...t.view.order]],
  ['鸣龙', '小说', '鸣龙\0关关公子', 4, 29, 83, [['other', 0], ['鸣龙\0关关公子', 1]]]);
  assert.equal(t.calls.filter(value => value === 'search.resume').length, 1);
  assert.equal(t.calls.includes('search.close'), false); noUnexpectedWrites(t);
}
async function readAndReturn(t) {
  const detail = t.h.detailBook, toc = t.h.detailToc, session = t.h.remoteReadingSession;
  t.h.openReading(undefined); assert.equal(t.h.route, 'detail');
  assert.equal(t.h.readingSessionActive, true);
  t.h.presentPreparedReading(0); assert.equal(t.h.route, 'reading');
  t.h.onReaderExited(); assert.equal(t.h.route, 'detail');
  assert.equal(t.h.detailBook, detail); assert.equal(t.h.detailToc, toc); assert.equal(t.h.remoteReadingSession, session);
  assert.equal(t.h.detailInBookshelf, false, 'reading without explicit add remains a preview');
  t.h.returnFromDetail(); assertSearchRetained(t);
}

await check('first source parses: search -> preview -> reading -> detail -> exact search state', async () => {
  const t = fixture(); t.h.onSearchResultSelected(t.first); await settle(); await readAndReturn(t);
});
await check('failed first source -> replacement source -> trial -> detail -> original search', async () => {
  const t = fixture({ firstFails: true }); t.h.onSearchResultSelected(t.first); await settle();
  assert.equal(t.h.detailReturnRoute, 'search'); assert.equal(t.notices[0].title, '详情加载失败');
  assert.equal(t.h.detailToc.length, 0); assert.equal(t.h.detailInBookshelf, false);
  t.h.openDetailSourceSwitch(); t.h.onPickSource(t.candidate(t.second)); await settle();
  assert.equal(t.h.detailBook.sourceId, t.second.sourceId); assert.equal(t.h.sourceSwitchVisible, false);
  await readAndReturn(t);
});
await check('repeated preview replacements keep the original search parent', async () => {
  const t = fixture(); t.h.onSearchResultSelected(t.first); await settle();
  for (const book of [t.second, t.third]) {
    t.h.openDetailSourceSwitch(); t.h.onPickSource(t.candidate(book)); await settle();
  }
  await readAndReturn(t);
});
await check('late failed first admission cannot replace a new preview or its return target', async () => {
  const t = fixture({ firstFails: true }), old = deferred(); t.gates.set(t.first.sourceId, old);
  t.h.onSearchResultSelected(t.first);
  t.h.openDetailSourceSwitch(); t.h.onPickSource(t.candidate(t.second)); await settle();
  old.resolve(); await settle();
  assert.equal(t.notices.length, 0); assert.equal(t.h.detailBook.sourceId, t.second.sourceId);
  await readAndReturn(t);
});
await check('leaving preview during replacement rejects late success without changing the new route', async () => {
  const t = fixture(), late = deferred(); t.h.onSearchResultSelected(t.first); await settle();
  t.gates.set(t.second.sourceId, late);
  t.h.openDetailSourceSwitch(); t.h.onPickSource(t.candidate(t.second));
  t.h.returnFromDetail(); assertSearchRetained(t);
  late.resolve(); await settle();
  assert.equal(t.h.route, 'search'); assert.equal(t.h.detailBook, undefined); noUnexpectedWrites(t);
});
await check('late replacement failure cannot reopen an old detail or replace a newer search', async () => {
  const t = fixture(), late = deferred(); t.h.onSearchResultSelected(t.first); await settle();
  t.gates.set(t.second.sourceId, late);
  t.h.openDetailSourceSwitch(); t.h.onPickSource(t.candidate(t.second));
  t.h.returnFromDetail(); assertSearchRetained(t);
  late.reject(new Error('late target TOC failure')); await settle();
  assert.equal(t.h.route, 'search'); assert.equal(t.h.detailBook, undefined);
  assert.notEqual(t.h.sourceSwitchState.kind, 'failure'); noUnexpectedWrites(t);
});
await check('a failed replacement preserves the current detail and the search parent', async () => {
  const t = fixture(), failed = deferred(); t.h.onSearchResultSelected(t.first); await settle();
  const originalBook = t.h.detailBook, originalSession = t.h.remoteReadingSession;
  t.gates.set(t.second.sourceId, failed);
  t.h.openDetailSourceSwitch(); t.h.onPickSource(t.candidate(t.second));
  failed.reject(new Error('target TOC failure')); await settle();
  assert.equal(t.h.sourceSwitchState.kind, 'failure'); assert.equal(t.h.detailReturnRoute, 'search');
  assert.equal(t.h.detailBook, originalBook); assert.equal(t.h.remoteReadingSession, originalSession);
  noUnexpectedWrites(t);
});
for (const info of [false, true]) {
  await check(`shelf ${info ? 'explicit info' : 'direct resume'} retains its own return semantics`, async () => {
    const t = fixture({ origin: 'bookshelf' }); t.h.shelfBooks = [t.first];
    t.rows.set(`${t.first.sourceId}\0${t.first.bookId}`, t.first);
    if (info) t.h.openShelfBookInfo(t.first); else t.h.openShelfBook(t.first);
    await settle();
    if (info) { assert.equal(t.h.route, 'detail'); t.h.openReading(undefined); }
    t.h.presentPreparedReading(0); assert.equal(t.h.route, 'reading'); t.h.onReaderExited();
    assert.equal(t.h.route, info ? 'detail' : 'bookshelf');
    if (info) { t.h.returnFromDetail(); assert.equal(t.h.route, 'bookshelf'); }
    noUnexpectedWrites(t);
  });
}

console.log(JSON.stringify({ source: String(source), evidenceLayer: 'production methods parsed by Harmony SDK; no device or Core I/O', outcomes }, null, 2));
assert.equal(outcomes.filter(outcome => outcome.status === 'FAIL').length, 0, 'trial-reading return flow regressions');

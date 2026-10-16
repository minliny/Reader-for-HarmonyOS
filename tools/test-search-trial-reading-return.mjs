import {actualBookshelfOperationTypes,actualBookshelfHostField} from './lib/bookshelf-operation-owner-probe.mjs';
import {actualSourceManagementTypes,actualSourceManagementHostField} from './lib/source-management-owner-probe.mjs';
import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import {compileHost,setRuntime} from './lib/reading-entry-owner-probe.mjs';
import {fixture as sourceFixture,setCurrentRuntime,gatewayExports} from './lib/source-switch-owner-probe.mjs';
import {sourceSwitchMethods} from './lib/source-switch-sdk-consumer.mjs';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const {resolveBookshelfBook}=await import('../entry/src/main/ets/features/bookshelf/BookshelfBookIdentity.ts');
const { searchCandidateRank } = await import('../entry/src/main/ets/features/search/SearchCandidatePolicy.ts');
const readingEvidence=await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const {captureRemotePositionContext}=await import('../entry/src/main/ets/features/reading/RemoteReadingPositionMigration.ts');
const {RemoteChapterCacheRefreshError}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
import { SearchViewState } from '../entry/src/main/ets/features/search/SearchViewState.ts';
import { readBookAuthorIdentity } from '../entry/src/main/ets/features/common/BookAuthorMetadata.ts';

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
const methods = ['searchJourneyActive', 'syncSearchDetailCandidates', 'knownSearchSourceCandidates', 'installRemoteReadingSession',
  'onSearchResultSelected', 'searchAcquisitionCandidate', 'remoteSeedForSearchBook', 'openRemoteBookDetail',
  'openShelfBook', 'openShelfBookInfo', 'openDetailSourceSwitch', 'onPickSource',
  'openReading', 'presentPreparedReading', 'onReaderExited', 'currentReaderPresentationIdentity', 'isCurrentRuntime', 'returnToReadingOrigin',
  'returnFromDetail', 'returnToSearch', 'returnToBookshelf', 'nextNavigationGeneration',
  'isKnownDetailChapter', 'probeRemoteContentVerdict',
  'remoteContentVerdictLabel','openSourceSwitch',
];

function fixture({ firstFails = false, origin = 'search' } = {}) {
  const calls = [], notices = [], rows = new Map(), gates = new Map(), admittedCatalogs = new Map();
  const makeBook = (sourceId, bookId) => ({ sourceId, bookId, detailUrl: bookId,
    title: '鸣龙', author: '关关公子', sourceName: `${sourceId} 名称`, sourceRuleVersion: 'v1', variables: [] });
  const first = makeBook('first-source', 'first-book');
  const second = makeBook('second-source', 'second-book');
  const third = makeBook('third-source', 'third-book');
  const key = book => `${book.sourceId}\0${book.bookId}`;
  const sessions = new Map([first, second, third].map(book => [key(book), {
    identity: { sourceId: book.sourceId, bookId: book.bookId }, book,
    sourceVersion: 'v1', catalogVersion: 'toc-v1', contextVersion: 'context-v1',
    entries: [{ index: 0, title: '第一章', url: `${book.bookId}/chapter-1` }], acquisitionMode: 'cache',
  }]));
  const acquire = async (seed, kind) => {
    calls.push(`${kind}:${seed.sourceId}`);
    const gate = gates.get(seed.sourceId);
    if (gate !== undefined) await gate.promise;
    if (firstFails && seed.sourceId === first.sourceId) throw new Error('book.toc returned no readable chapters');
    const session = sessions.get(key(seed));
    admittedCatalogs.set(key(seed), session);
    return session;
  };
  const loadChapter = async session => {
    calls.push(`chapter.probe:${session.identity.sourceId}`);
    return {sourceId:session.identity.sourceId,bookId:session.identity.bookId,chapterIndex:0,
      chapterUrl:session.entries[0].url,contentVersion:'body',content:'正文',images:[]};
  };
  const owner = { noteReadingPreparationIntent() {}, bookAcquisitions: () => ({
    hasCurrentCatalogProjection: session => {
      const admitted = admittedCatalogs.get(key(session.identity));
      return admitted !== undefined && admitted.entries === session.entries &&
        admitted.sourceVersion === session.sourceVersion && admitted.catalogVersion === session.catalogVersion &&
        admitted.contextVersion === session.contextVersion;
    },
    readingProjectionRevision:()=>0,sourceRegistryRevision:()=>1,subscribe:()=>()=>{}, acquireBook: seed => acquire(seed, 'switch.acquire'),
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
  owner.getUIAbilityContext=()=>({filesDir:'/private-files'});
  owner.request=async(method,p)=>{
    if(method==='bookmark.list')return{data:{bookmarks:[]}};
    if(method==='source.list')return{data:{sources:[first,second,third].map(b=>({sourceId:b.sourceId,name:b.sourceName,enabled:true,sourceVersion:'v1'}))}};
    if(method==='search-book.related')return{data:{books:[first,second,third].map(b=>({origin:b.sourceId,bookUrl:b.bookId,name:b.title,author:b.author,time:1,relationKey:'same-book',relationRevision:'r1',sourceVersion:'v1',acquisition:{sourceVersion:'v1',contentKind:'text'}})),snapshotRevision:'s1',complete:true,
      sourceVersions:[first,second,third].map(b=>({sourceId:b.sourceId,sourceVersion:'v1',enabled:true}))}};
    if(method==='book.search') {
      assert.equal(p.page,1);
      return{data:{sourceId:p.sourceId,sourceVersion:'v1',contentKind:'text',books:[]}};
    }
    if(method==='source.switch.pending.list')return{data:{pending:[]}};
    if(method==='bookshelf.get')return{data:{book:rows.get(p.sourceId+'\0'+p.bookId)??null}};
    calls.push('UNEXPECTED.native.'+method);throw Error('unexpected trial native IO '+method);
  };
  const Source=sourceFixture({shared:true,open:false,preview:true}).Constructor;setCurrentRuntime(owner);setRuntime(owner);
  const authority={current:()=>owner,isCurrent:r=>r===owner};
  const Remote=class {async loadProgress(){return{kind:'missing'};}async loadChapter(session){return loadChapter(session);}};
  const Core=class {async loadShelfBook(sourceId,bookId){calls.push('shelf.read');return rows.get(sourceId+'\0'+bookId);}async upsertBook(){calls.push('UNEXPECTED.shelf.write');throw Error('preview cannot add a book');}};
  const Entry=compileHost(undefined,{ReaderRuntimeOwner:authority,RemoteReadingFlowGateway:Remote,ReaderCoreGateway:Core,
    ReadingOfflineGateway:class {async loadDirectoryProjection(session){return session.entries;}}});
  const emptyAdmission={generation:0,adding:false,cancelling:false,confirmation:'none'};
  const Index = productionMotionMethods(source, [...new Set([...methods,...sourceSwitchMethods])], { resolveBookshelfBook, readBookAuthorIdentity,
    ...readingEvidence,...gatewayExports,SourceSwitchHost:Source,ReadingEntryHost:Entry,EMPTY_READABLE_ADMISSION:emptyAdmission,captureRemotePositionContext,RemoteChapterCacheRefreshError, searchCandidateRank, LOCAL_SOURCE_ID: 'local', ReaderRuntimeOwner: { current: () => owner },
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
    sourceSwitchCandidateKey:gatewayExports.sourceSwitchCandidateKey,
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
    mountedRuntimeOwner: owner, shelfReceiptRetired: false,detailShelfAdmissionMount:1,detailReadableAdmission:()=>emptyAdmission,pendingShelfReadbackKey:'',
    currentSourceSwitchTransactionId:()=>undefined, readingDetailForShelf:book=>({...book}),
    remoteSessionGeneration:0,remoteContentProbeGeneration:0,route: origin, readingOriginRoute: 'detail', detailReturnRoute: 'bookshelf',
    readingSessionActive: false, navigationGeneration: 0, shelfReadingPreparation: false,
    searchHost:{publication:{shelfAt:()=>[]},searchedSourceIds:()=>[],resume:()=>calls.push('search.resume'),close:()=>calls.push('search.close'),visibilityChanged:()=>calls.push('search.visibility')},searchPublicationRevision:0, detailToc: [], detailInBookshelf: false, shelfBooks: [], searchDetailCandidates: [], remoteCatalogRefreshAt: new Map(),
    shelfOperation: {generation:0,removalKey:'',busy:false,batchRemovalBusy:false}, offlineMutationGeneration: 0,
    searchAppForeground: true, sourceSwitchVisible: false, sourceSwitchState: { kind: 'discovering' },sourceSwitchScopeId:0,readingEntryScopeId:-1,
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
  const shelfTypes=actualBookshelfOperationTypes({ReaderRuntimeOwner:authority});
  h.bookshelfHost=actualBookshelfHostField(h,shelfTypes.Host,{setOrCreate(){}});
  const sourceTypes=actualSourceManagementTypes({ReaderRuntimeOwner:authority});
  h.sourcePresentationIdentity='';
  h.sourceHost=actualSourceManagementHostField(h,sourceTypes.SourceHost);
  const candidate = book => ({ sourceId: book.sourceId, bookUrl: book.bookId, bookName: book.title,
    author: book.author, sourceName: book.sourceName });
  return { h, calls, notices, first, second, third, candidate, view, presentation, rows, sessions, gates };
}

async function pick(t,book){
  if(t.h.readingSessionActive)t.h.openSourceSwitch();else t.h.openDetailSourceSwitch();
  await settle();
  assert.equal(t.h.sourceSwitchState.kind,'candidates');
  const displayed=t.h.sourceSwitchState.candidates.find(c=>c.sourceId===book.sourceId&&c.bookUrl===book.bookId);
  assert.ok(displayed,JSON.stringify(t.h.sourceSwitchState)+' selection uses the candidate and version published by the actual owner');
  const acquisition=`switch.acquire:${book.sourceId}`;
  const before=t.calls.filter(value=>value===acquisition).length;
  t.h.onPickSource(displayed,t.h.sourceSwitchScopeId);
  await settle();
  assert.equal(t.calls.filter(value=>value===acquisition).length,before+1,
    'late acquisition fixtures leave only after the actual owner has qualified and dispatched acquisition');
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
function readableAcquisition(sourceRuleVersion) {
  const now = Date.now();
  return { schemaVersion: 2, sourceVersion: sourceRuleVersion, stale: false,
    verificationCurrent: true, catalogCount: 1, catalogAt: now, readableAt: now };
}
async function readAndReturn(t) {
  const detail = t.h.detailBook, toc = t.h.detailToc, session = t.h.remoteReadingSession;
  if (!t.h.readingSessionActive) t.h.openReading(undefined); assert.equal(t.h.route, 'reading');
  assert.equal(t.h.readingSessionActive, true);
  t.h.presentPreparedReading(0); assert.equal(t.h.route, 'reading');
  t.h.onReaderExited(JSON.stringify([t.h.detailBook?.sourceId,t.h.detailBook?.bookId,t.h.readingReadyGeneration])); assert.equal(t.h.route, 'detail');
  assert.equal(t.h.detailBook, detail); assert.equal(t.h.detailToc, toc); assert.equal(t.h.remoteReadingSession, session);
  assert.equal(t.h.detailInBookshelf, false, 'reading without explicit add remains a preview');
  t.h.returnFromDetail(); assertSearchRetained(t);
}

await check('search journey keeps late candidates in detail and reading without restarting the session', async () => {
  const t = fixture();
  t.h.onSearchResultSelected(t.first); await settle();
  assert.equal(t.h.route, 'detail');
  assert.equal(t.h.detailReturnRoute, 'search');
  assert.equal(t.calls.filter(value => value === 'search.visibility').length, 1,
    'committing the detail route wakes the still-running search query');
  const detailBook = t.h.detailBook;
  const detailSession = t.h.remoteReadingSession;
  const detailToc = t.h.detailToc;
  const updatedFirst = { ...t.first, acquisition: readableAcquisition(t.first.sourceRuleVersion) };
  const lateSecond = { ...t.second, acquisition: readableAcquisition(t.second.sourceRuleVersion) };
  t.h.syncSearchDetailCandidates({ kind: 'results', keyword: '鸣龙', results: [updatedFirst, lateSecond], searching: true });
  assert.deepEqual(t.h.searchDetailCandidates.map(book => `${book.sourceId}:${book.bookId}`),
    ['first-source:first-book', 'second-source:second-book']);
  assert.equal(t.h.detailBook, detailBook, 'late SearchBook replacement does not replace the admitted detail');
  assert.equal(t.h.remoteReadingSession, detailSession, 'late SearchBook replacement does not replace the detail session');
  assert.equal(t.h.detailToc, detailToc, 'late SearchBook replacement does not rebuild the detail catalog');
  let known = t.h.knownSearchSourceCandidates({ sourceId: t.first.sourceId, bookId: t.first.bookId });
  assert.deepEqual(known.map(candidate => `${candidate.sourceId}:${candidate.bookUrl}`),
    ['first-source:first-book', 'second-source:second-book']);
  assert.equal(known[0].acquisitionState, 'readable');

  t.h.openReading(undefined); t.h.presentPreparedReading(0); await settle();
  assert.equal(t.h.route, 'reading');
  assert.equal(t.h.readingSessionActive, true);
  const readerBook = t.h.detailBook;
  const readerSession = t.h.remoteReadingSession;
  const readerToc = t.h.detailToc;
  const callsBeforeLateReaderPublication = [...t.calls];
  const lateThird = { ...t.third, acquisition: readableAcquisition(t.third.sourceRuleVersion) };
  t.h.syncSearchDetailCandidates({ kind: 'results', keyword: '鸣龙', results: [updatedFirst, lateSecond, lateThird], searching: true });
  await settle();
  assert.equal(t.h.route, 'reading');
  assert.equal(t.h.readingSessionActive, true);
  assert.equal(t.h.detailBook, readerBook, 'late results do not replace the active reader book');
  assert.equal(t.h.remoteReadingSession, readerSession, 'late results do not replace the active reader session');
  assert.equal(t.h.detailToc, readerToc, 'late results do not reset the active reader catalog/progress anchor');
  assert.deepEqual(t.calls, callsBeforeLateReaderPublication,
    'late result publication is a cache/projection merge, without a second search or body acquisition');
  known = t.h.knownSearchSourceCandidates({ sourceId: t.first.sourceId, bookId: t.first.bookId });
  assert.deepEqual(known.map(candidate => `${candidate.sourceId}:${candidate.bookUrl}`),
    ['first-source:first-book', 'second-source:second-book', 'third-source:third-book']);
  assert.equal(known[2].acquisitionState, 'readable');
  noUnexpectedWrites(t);
});

await check('search journey route guard remains active through detail, reader and directory only', async () => {
  const t = fixture();
  t.h.detailReturnRoute = 'search';
  for (const route of ['detail', 'reading', 'directory']) {
    t.h.route = route; t.h.searchAppForeground = true;
    assert.equal(t.h.searchJourneyActive(), true, `${route} continues the originating search journey`);
  }
  t.h.route = 'bookshelf'; assert.equal(t.h.searchJourneyActive(), false);
  t.h.route = 'reading'; t.h.searchAppForeground = false; assert.equal(t.h.searchJourneyActive(), false);
});

await check('first source-switch opening reuses only version-bound ordinary search timings', async () => {
  const t = fixture();
  t.h.detailReturnRoute = 'search';
  const measuredAt = Date.now();
  const timed = book => ({ ...book, acquisition: { schemaVersion: 2, sourceVersion: 'v1',
    searchTiming: { kind: 'search', sourceVersion: 'v1', durationMs: 427, measuredAt } } });
  t.h.searchDetailCandidates = [timed(t.first), { ...timed(t.second), sourceRuleVersion: 'v2' },
    { ...timed(t.third), acquisition: { sourceVersion: 'v1', searchTiming: {
      kind: 'search', sourceVersion: 'v1', durationMs: -1, measuredAt } } }];
  const known = t.h.knownSearchSourceCandidates({ sourceId: t.first.sourceId, bookId: t.first.bookId });
  assert.deepEqual([known[0].latencyMs, known[0].latencyKind, known[0].latencyMeasuredAt], [427, 'search', measuredAt]);
  assert.equal(known[1].latencyMs, undefined, 'changed rules do not borrow timings from an old source version');
  assert.equal(known[2].latencyMs, undefined, 'invalid persisted durations are not shown');
});

await check('first source parses: search -> preview -> reading -> detail -> exact search state', async () => {
  const t = fixture(); t.h.onSearchResultSelected(t.first); await settle(); await readAndReturn(t);
});
await check('failed first source -> replacement source -> trial -> detail -> original search', async () => {
  const t = fixture({ firstFails: true }); t.h.onSearchResultSelected(t.first); await settle();
  assert.equal(t.h.detailReturnRoute, 'search'); assert.match(t.h.detailLoadingMessage, /no readable chapters/); assert.deepEqual(t.notices, []);
  assert.equal(t.h.detailToc.length, 0); assert.equal(t.h.detailInBookshelf, false);
  await pick(t,t.second); await settle();
  assert.equal(t.h.detailBook.sourceId, t.second.sourceId); assert.equal(t.h.sourceSwitchVisible, false);
  await readAndReturn(t);
});
await check('repeated preview replacements keep the original search parent', async () => {
  const t = fixture(); t.h.onSearchResultSelected(t.first); await settle();
  for (const book of [t.second, t.third]) {
    await pick(t,book); await settle();
  }
  await readAndReturn(t);
});
await check('late failed first admission cannot replace a new preview or its return target', async () => {
  const t = fixture({ firstFails: true }), old = deferred(); t.gates.set(t.first.sourceId, old);
  t.h.onSearchResultSelected(t.first);
  await pick(t,t.second); await settle();
  old.resolve(); await settle();
  assert.equal(t.notices.length, 0); assert.equal(t.h.detailBook.sourceId, t.second.sourceId);
  await readAndReturn(t);
});
await check('leaving preview during replacement rejects late success without changing the new route', async () => {
  const t = fixture(), late = deferred(); t.h.onSearchResultSelected(t.first); await settle();
  t.gates.set(t.second.sourceId, late);
  await pick(t,t.second);
  t.h.returnFromDetail(); assertSearchRetained(t);
  late.resolve(); await settle();
  assert.equal(t.h.route, 'search'); assert.equal(t.h.detailBook, undefined); noUnexpectedWrites(t);
});
await check('late replacement failure cannot reopen an old detail or replace a newer search', async () => {
  const t = fixture(), late = deferred(); t.h.onSearchResultSelected(t.first); await settle();
  t.gates.set(t.second.sourceId, late);
  await pick(t,t.second);
  t.h.returnFromDetail(); assertSearchRetained(t);
  late.reject(new Error('late target TOC failure')); await settle();
  assert.equal(t.h.route, 'search'); assert.equal(t.h.detailBook, undefined);
  assert.notEqual(t.h.sourceSwitchState.kind, 'failure'); noUnexpectedWrites(t);
});
await check('a failed replacement keeps the original identity and search parent in the reader', async () => {
  const t = fixture(), failed = deferred(); t.h.onSearchResultSelected(t.first); await settle();
  const originalBook = t.h.detailBook, originalSession = t.h.remoteReadingSession;
  t.gates.set(t.second.sourceId, failed);
  await pick(t,t.second);
  const diagnostic = new Error('target TOC failure');
  failed.reject(diagnostic); await settle();
  assert.equal(t.h.route, 'reading'); assert.equal(t.h.sourceSwitchFailureMessage, '换源暂时未完成，请重试或选择其他书源。'); assert.equal(t.h.detailReturnRoute, 'search');
  assert.equal(t.h.sourceSwitchHost.lastFailure, diagnostic, 'the actual owner retains the original internal diagnostic');
  assert.doesNotMatch(JSON.stringify(t.h.sourceSwitchHost.current()), /target TOC failure/,
    'the public snapshot must not expose the internal acquisition error');
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
    t.h.presentPreparedReading(0); assert.equal(t.h.route, 'reading'); t.h.onReaderExited(JSON.stringify([t.h.detailBook?.sourceId,t.h.detailBook?.bookId,t.h.readingReadyGeneration]));
    assert.equal(t.h.route, info ? 'detail' : 'bookshelf');
    if (info) { t.h.returnFromDetail(); assert.equal(t.h.route, 'bookshelf'); }
    noUnexpectedWrites(t);
  });
}

console.log(JSON.stringify({ source: String(source), evidenceLayer: 'production methods parsed by Harmony SDK; no device or Core I/O', outcomes }, null, 2));
assert.equal(outcomes.filter(outcome => outcome.status === 'FAIL').length, 0, 'trial-reading return flow regressions');

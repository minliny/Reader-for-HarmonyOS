import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"late-candidates": {"description": "晚到搜索候选只合并缓存且不重置detail/reader", "resources": []}, "route-guard": {"description": "实际Index route/前台/search parent接纳边界", "resources": []}, "timing-version": {"description": "实际known candidate时延只复用当前sourceVersion/非负duration", "resources": []}, "preview-return": {"description": "首源preview→reader→detail→原search对象/anchor", "resources": []}, "failed-replacement": {"description": "首源失败后实际换源owner接纳替代且回原search", "resources": []}, "repeat-replacement": {"description": "多次替代不改变原search parent", "resources": []}, "late-admission": {"description": "迟到首源失败不能替换新preview", "resources": []}, "late-success": {"description": "离开preview拒绝迟到换源成功", "resources": []}, "late-failure": {"description": "离开preview拒绝迟到换源失败", "resources": []}, "reader-rollback": {"description": "reader换源失败保留原身份/诊断私有", "resources": []}, "shelf-resume": {"description": "书架直接续读返回书架，不产生预览写入", "resources": []}, "shelf-info": {"description": "书架显式详情→阅读→详情→书架", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {default: assert} = await import('node:assert/strict');
const { searchReadingJourneyFixture } = await import('./lib/search-reading-journey-owner-probe.mjs');
const {compileHost,setRuntime} = await import('./lib/reading-entry-owner-probe.mjs');
const {fixture: sourceFixture,setCurrentRuntime} = await import('./lib/source-switch-owner-probe.mjs');
const { registerHooks } = await import('node:module');

registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const readingEvidence=await import('../entry/src/main/ets/features/reading/application/RemoteReadingEvidence.ts');

// The acquisition boundary and Core persistence are fakes. Execute the actual
// Current owners through the project's SDK parser, including both acquisition
// phases and the preview-switch dispatch. Candidate selection/body admission
// itself is covered with the real coordinator in test-search-candidate-acquisition.
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};


function fixture({ firstFails = false, origin = 'search', loadLocal } = {}) {
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
  const current=searchReadingJourneyFixture({runtime:owner,ReadingHost:Entry,SourceHost:Source,route:origin,
    loadLocal,sourceName:(id,name)=>name??id,onEvent:value=>calls.push(value),failure:(title,message)=>notices.push({title,message})});
  const view=current.library.host.viewState;
  Object.assign(view, { keywordDraft: '鸣龙', category: '小说', anchorKey: '鸣龙\0关关公子',
    anchorIndex: 4, anchorOffset: 29, anchorItemY: 83 });
  view.rank('other'); view.rank('鸣龙\0关关公子');
  const presentation = { kind: 'results', keyword: '鸣龙', results: [first, second, third], searching: false };
  current.publish(presentation);
  const candidate = book => ({ sourceId: book.sourceId, bookUrl: book.bookId, bookName: book.title,
    author: book.author, sourceName: book.sourceName });
  return { ...current, calls, notices, first, second, third, candidate, view, presentation, rows, sessions, gates };
}

async function pick(t,book){
  if(t.entry.sessionActive)t.switchJourney.openReader();else t.switchJourney.openDetail();
  await settle();
  assert.equal(t.source.state.kind,'candidates');
  const displayed=t.source.state.candidates.find(c=>c.sourceId===book.sourceId&&c.bookUrl===book.bookId);
  assert.ok(displayed,JSON.stringify(t.source.state)+' selection uses the candidate and version published by the actual owner');
  const acquisition=`switch.acquire:${book.sourceId}`;
  const before=t.calls.filter(value=>value===acquisition).length;
  t.source.pickText(displayed,t.source.scopeId);
  await settle();
  assert.equal(t.calls.filter(value=>value===acquisition).length,before+1,
    'late acquisition fixtures leave only after the actual owner has qualified and dispatched acquisition');
}
const caseNames={"late-candidates": "search journey keeps late candidates in detail and reading without restarting the session", "route-guard": "search journey route guard remains active through detail, reader and directory only", "timing-version": "first source-switch opening reuses only version-bound ordinary search timings", "preview-return": "first source parses: search -> preview -> reading -> detail -> exact search state", "failed-replacement": "failed first source -> replacement source -> trial -> detail -> original search", "repeat-replacement": "repeated preview replacements keep the original search parent", "late-admission": "late failed first admission cannot replace a new preview or its return target", "late-success": "leaving preview during replacement rejects late success without changing the new route", "late-failure": "late replacement failure cannot reopen an old detail or replace a newer search", "reader-rollback": "a failed replacement keeps the original identity and search parent in the reader", "shelf-resume": "shelf direct resume retains its own return semantics", "shelf-info": "shelf explicit info retains its own return semantics"};
async function check(name, test) {
  if(name!==caseNames[selectedCase])return;await test();
}
function noUnexpectedWrites(t) {
  assert.deepEqual(t.calls.filter(value => value.startsWith('UNEXPECTED.')), [],
    'preview/navigation must not mutate the shelf, commit a source switch, or restart search');
}
function assertSearchRetained(t) {
  assert.equal(t.navigation.snapshot().route, 'search');
  assert.equal(t.library.host.viewState, t.view); assert.equal(t.library.host.presentation(), t.presentation);
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
  const detail = t.entry.book, toc = t.entry.toc, session = t.entry.session;
  if (!t.entry.sessionActive) t.actions.openReading(undefined); assert.equal(t.navigation.snapshot().route, 'reading');
  assert.equal(t.entry.sessionActive, true);
  t.actions.presentPreparedReading(0); assert.equal(t.navigation.snapshot().route, 'reading');
  t.exit.accepted(JSON.stringify([t.entry.book?.sourceId,t.entry.book?.bookId,t.entry.readyGeneration])); assert.equal(t.navigation.snapshot().route, 'detail');
  assert.equal(t.entry.book, detail); assert.equal(t.entry.toc, toc); assert.equal(t.entry.session, session);
  assert.equal(t.entry.inBookshelf, false, 'reading without explicit add remains a preview');
  t.journey.returnFromDetail(); assertSearchRetained(t);
}

await check('search journey keeps late candidates in detail and reading without restarting the session', async () => {
  const t = fixture();
  t.journey.selectResult(t.first, []); await settle();
  assert.equal(t.navigation.snapshot().route, 'detail');
  assert.equal(t.navigation.returns.snapshot().detailParent, 'search');
  assert.equal(t.calls.filter(value => value === 'search.visibility').length, 1,
    'committing the detail route wakes the still-running search query');
  const detailBook = t.entry.book;
  const detailSession = t.entry.session;
  const detailToc = t.entry.toc;
  const updatedFirst = { ...t.first, acquisition: readableAcquisition(t.first.sourceRuleVersion) };
  const lateSecond = { ...t.second, acquisition: readableAcquisition(t.second.sourceRuleVersion) };
  t.publish({ kind: 'results', keyword: '鸣龙', results: [updatedFirst, lateSecond], searching: true });
  assert.deepEqual(t.library.candidates().map(book => `${book.sourceId}:${book.bookId}`),
    ['first-source:first-book', 'second-source:second-book']);
  assert.equal(t.entry.book, detailBook, 'late SearchBook replacement does not replace the admitted detail');
  assert.equal(t.entry.session, detailSession, 'late SearchBook replacement does not replace the detail session');
  assert.equal(t.entry.toc, detailToc, 'late SearchBook replacement does not rebuild the detail catalog');
  let known = t.knownCandidates();
  assert.deepEqual(known.map(candidate => `${candidate.sourceId}:${candidate.bookUrl}`),
    ['first-source:first-book', 'second-source:second-book']);
  assert.equal(known[0].acquisitionState, 'readable');

  t.actions.openReading(undefined); t.actions.presentPreparedReading(0); await settle();
  assert.equal(t.navigation.snapshot().route, 'reading');
  assert.equal(t.entry.sessionActive, true);
  const readerBook = t.entry.book;
  const readerSession = t.entry.session;
  const readerToc = t.entry.toc;
  const callsBeforeLateReaderPublication = [...t.calls];
  const lateThird = { ...t.third, acquisition: readableAcquisition(t.third.sourceRuleVersion) };
  t.publish({ kind: 'results', keyword: '鸣龙', results: [updatedFirst, lateSecond, lateThird], searching: true });
  await settle();
  assert.equal(t.navigation.snapshot().route, 'reading');
  assert.equal(t.entry.sessionActive, true);
  assert.equal(t.entry.book, readerBook, 'late results do not replace the active reader book');
  assert.equal(t.entry.session, readerSession, 'late results do not replace the active reader session');
  assert.equal(t.entry.toc, readerToc, 'late results do not reset the active reader catalog/progress anchor');
  assert.deepEqual(t.calls, callsBeforeLateReaderPublication,
    'late result publication is a cache/projection merge, without a second search or body acquisition');
  known = t.knownCandidates();
  assert.deepEqual(known.map(candidate => `${candidate.sourceId}:${candidate.bookUrl}`),
    ['first-source:first-book', 'second-source:second-book', 'third-source:third-book']);
  assert.equal(known[2].acquisitionState, 'readable');
  noUnexpectedWrites(t);
});

await check('search journey route guard remains active through detail, reader and directory only', async () => {
  const t=fixture();
  t.navigation.returns.completeDetailEntry('search','search',false);
  for (const route of ['detail', 'reading', 'directory']) {
    t.navigation.show(route);t.controls.foreground=true;
    assert.equal(t.library.isDetailJourneyCurrent(),true,`${route} retains the originating search context`);
    assert.equal(t.library.host.isSearchVisible(),true,`${route} permits foreground Host work`);
  }
  t.navigation.show('bookshelf');
  assert.equal(t.library.isDetailJourneyCurrent(),false);assert.equal(t.library.host.isSearchVisible(),false);
  t.navigation.show('reading');t.controls.foreground=false;
  assert.equal(t.library.host.isSearchVisible(),false,'background Host work is suppressed');
  assert.equal(t.library.isDetailJourneyCurrent(),true,'retained background context is distinct from input/work eligibility');
  const before=t.navigation.snapshot(),calls=[...t.calls],book=t.entry.book;
  t.journey.selectResult(t.first,[]);
  assert.equal(t.navigation.snapshot(),before);assert.equal(t.entry.book,book);assert.deepEqual(t.calls,calls,
    'actual current Index scope blocks background result selection without dispatch or navigation');
  t.controls.foreground=true;t.controls.arkWebCapturesInput=true;t.journey.selectResult(t.first,[]);
  assert.equal(t.navigation.snapshot(),before);assert.deepEqual(t.calls,calls,'captured system input blocks result selection');
  t.close();
  const late=deferred(),local=fixture({loadLocal:()=>late.promise});
  const selected={...local.first,sourceId:'local',bookId:'local-book'};
  local.journey.selectResult(selected,[]);local.controls.foreground=false;
  const pending=local.navigation.snapshot();late.resolve({...selected,sourceName:'本地书籍'});await settle();
  assert.equal(local.navigation.snapshot(),pending);assert.equal(local.navigation.snapshot().route,'search');
  assert.equal(local.entry.book,undefined,'late local read cannot open while backgrounded');
  noUnexpectedWrites(local);local.close();
});

await check('first source-switch opening reuses only version-bound ordinary search timings', async () => {
  const t=fixture();
  const measuredAt = Date.now();
  const timed = book => ({ ...book, acquisition: { schemaVersion: 2, sourceVersion: 'v1',
    searchTiming: { kind: 'search', sourceVersion: 'v1', durationMs: 427, measuredAt } } });
  const books=[timed(t.first),{...timed(t.second),sourceRuleVersion:'v2'},
    {...timed(t.third),acquisition:{sourceVersion:'v1',searchTiming:{kind:'search',sourceVersion:'v1',durationMs:-1,measuredAt}}}];
  t.journey.selectResult(books[0],books.slice(1));await settle();
  const known=t.knownCandidates();
  assert.deepEqual([known[0].latencyMs, known[0].latencyKind, known[0].latencyMeasuredAt], [427, 'search', measuredAt]);
  assert.equal(known[1].latencyMs, undefined, 'changed rules do not borrow timings from an old source version');
  assert.equal(known[2].latencyMs, undefined, 'invalid persisted durations are not shown');
  t.close();
});

await check('first source parses: search -> preview -> reading -> detail -> exact search state', async () => {
  const t = fixture(); t.journey.selectResult(t.first, []); await settle(); await readAndReturn(t);
});
await check('failed first source -> replacement source -> trial -> detail -> original search', async () => {
  const t = fixture({ firstFails: true }); t.journey.selectResult(t.first, []); await settle();
  assert.equal(t.navigation.returns.snapshot().detailParent, 'search'); assert.match(t.entry.loadingMessage, /no readable chapters/); assert.deepEqual(t.notices, []);
  assert.equal(t.entry.toc.length, 0); assert.equal(t.entry.inBookshelf, false);
  await pick(t,t.second); await settle();
  assert.equal(t.entry.book.sourceId, t.second.sourceId); assert.equal(t.source.visible, false);
  await readAndReturn(t);
});
await check('repeated preview replacements keep the original search parent', async () => {
  const t = fixture(); t.journey.selectResult(t.first, []); await settle();
  for (const book of [t.second, t.third]) {
    await pick(t,book); await settle();
  }
  await readAndReturn(t);
});
await check('late failed first admission cannot replace a new preview or its return target', async () => {
  const t = fixture({ firstFails: true }), old = deferred(); t.gates.set(t.first.sourceId, old);
  t.journey.selectResult(t.first, []);
  await pick(t,t.second); await settle();
  old.resolve(); await settle();
  assert.equal(t.notices.length, 0); assert.equal(t.entry.book.sourceId, t.second.sourceId);
  await readAndReturn(t);
});
await check('leaving preview during replacement rejects late success without changing the new route', async () => {
  const t = fixture(), late = deferred(); t.journey.selectResult(t.first, []); await settle();
  t.gates.set(t.second.sourceId, late);
  await pick(t,t.second);
  t.journey.returnFromDetail(); assertSearchRetained(t);
  late.resolve(); await settle();
  assert.equal(t.navigation.snapshot().route, 'search'); assert.equal(t.entry.book, undefined); noUnexpectedWrites(t);
});
await check('late replacement failure cannot reopen an old detail or replace a newer search', async () => {
  const t = fixture(), late = deferred(); t.journey.selectResult(t.first, []); await settle();
  t.gates.set(t.second.sourceId, late);
  await pick(t,t.second);
  t.journey.returnFromDetail(); assertSearchRetained(t);
  late.reject(new Error('late target TOC failure')); await settle();
  assert.equal(t.navigation.snapshot().route, 'search'); assert.equal(t.entry.book, undefined);
  assert.notEqual(t.source.state.kind, 'failure'); noUnexpectedWrites(t);
});
await check('a failed replacement keeps the original identity and search parent in the reader', async () => {
  const t = fixture(), failed = deferred(); t.journey.selectResult(t.first, []); await settle();
  const originalBook = t.entry.book, originalSession = t.entry.session;
  t.gates.set(t.second.sourceId, failed);
  await pick(t,t.second);
  const diagnostic = new Error('target TOC failure');
  failed.reject(diagnostic); await settle();
  assert.equal(t.navigation.snapshot().route, 'reading'); assert.equal(t.source.failureMessage, '换源暂时未完成，请重试或选择其他书源。'); assert.equal(t.navigation.returns.snapshot().detailParent, 'search');
  assert.equal(t.source.host().lastFailure, diagnostic, 'the actual owner retains the original internal diagnostic');
  assert.doesNotMatch(JSON.stringify(t.source.host().current()), /target TOC failure/,
    'the public snapshot must not expose the internal acquisition error');
  assert.equal(t.entry.book, originalBook); assert.equal(t.entry.session, originalSession);
  noUnexpectedWrites(t);
});
for (const info of [false, true]) {
  await check(`shelf ${info ? 'explicit info' : 'direct resume'} retains its own return semantics`, async () => {
    const t = fixture({ origin: 'bookshelf' }); t.controls.shelfBooks = [t.first];
    t.rows.set(`${t.first.sourceId}\0${t.first.bookId}`, t.first);
    if (info) t.actions.openShelfEntry(t.first,'info'); else t.actions.resumeShelf(t.first);
    await settle();
    if (info) { assert.equal(t.navigation.snapshot().route, 'detail'); t.actions.openReading(undefined); }
    t.actions.presentPreparedReading(0); assert.equal(t.navigation.snapshot().route, 'reading'); t.exit.accepted(JSON.stringify([t.entry.book?.sourceId,t.entry.book?.bookId,t.entry.readyGeneration]));
    assert.equal(t.navigation.snapshot().route, info ? 'detail' : 'bookshelf');
    if (info) { t.journey.returnFromDetail(); assert.equal(t.navigation.snapshot().route, 'bookshelf'); }
    noUnexpectedWrites(t);
  });
}


}

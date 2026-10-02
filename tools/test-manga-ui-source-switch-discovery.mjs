import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const authorMetadataModule = readFileSync(resolve(repo, 'entry/src/main/ets/features/common/BookAuthorMetadata.ts'), 'utf8');
const factModule = stripTypeScriptTypes(readFileSync(resolve(repo, 'entry/src/main/ets/features/common/BookAcquisitionPresentation.ts'), 'utf8'));
const { acquisitionCandidateRank } = await import(`data:text/javascript;base64,${Buffer.from(factModule).toString('base64')}`);
const searchCandidateRank = (book, now) => acquisitionCandidateRank(book.acquisition, book.sourceRuleVersion, now);
const gateway = readFileSync(
  resolve(repo, 'entry/src/main/ets/features/source/SourceSwitchGateway.ts'),
  'utf8',
);

const fetchStart = gateway.indexOf('async fetchTargetToc(');
const fetchEnd = gateway.indexOf('async commitSwitch(', fetchStart);
assert.ok(fetchStart >= 0 && fetchEnd > fetchStart, 'fetchTargetToc method must remain present');
const fetchTargetToc = gateway.slice(fetchStart, fetchEnd);

const detailRequest = fetchTargetToc.indexOf("'book.detail'");
const tocRequest = fetchTargetToc.indexOf("'book.toc'");
assert.ok(detailRequest >= 0, 'fetchTargetToc must resolve book.detail');
assert.ok(tocRequest > detailRequest, 'book.detail must complete before book.toc');
assert.match(fetchTargetToc, /book:\s*\{\s*bookId\s*\}/);
assert.match(fetchTargetToc, /bookUrl:\s*bookId/);
assert.match(fetchTargetToc, /detailSourceId !== sourceId \|\| detailBookId !== bookId/);
assert.match(fetchTargetToc, /requireString\(detail\.data, 'tocUrl', 'book\.detail'\)/);
assert.match(fetchTargetToc, /rawVariables === undefined \|\| rawVariables === null/,
  'book.detail variables are optional per the Core contract; missing/null must not fail-closed');
assert.match(fetchTargetToc, /requireStringMap\(rawVariables, 'variables', 'book\.detail'\)/);
assert.match(fetchTargetToc, /\{\s*sourceId,\s*bookId,\s*tocUrl,\s*variables\s*\}/);
assert.doesNotMatch(fetchTargetToc, /'book\.toc',\s*\{\s*sourceId,\s*bookId\s*\}/);

assert.match(gateway, /private requireStringMap\([\s\S]*typeof variableValue !== 'string'/);
assert.match(gateway, /candidate\.trim\(\)\.length === 0/);
assert.match(gateway, /'change\.bookSource',[\s\S]*sourceIds:\s*\[candidateSourceId\]/);
assert.match(gateway, /SOURCE_SWITCH_DISCOVERY_CONCURRENCY\s*=\s*8/);
assert.match(gateway, /runBookSourceWorkers\(sources, SOURCE_SWITCH_DISCOVERY_CONCURRENCY/);
assert.match(gateway, /sourceSwitchCandidateKey\(candidate\.sourceId, candidate\.bookUrl\)/);
assert.match(gateway, /deduplicateSourceSwitchCandidates\(candidates\)/);
assert.match(gateway, /requireString\(result\.data, 'transactionId', 'source\.switch\.commit'\)/);
assert.match(gateway, /result\.data\['phase'\] !== 'pending'/);
assert.match(gateway, /'source\.switch\.pending\.list'/);
assert.match(gateway, /const pending: PendingSourceSwitch\[\]/);
assert.match(gateway, /pending\.push\(\{/);
assert.match(gateway, /const matchedChapter = this\.decodeMatchedChapter\(result\.data\['matchedChapter'\]\)/);
assert.doesNotMatch(gateway, /rollbackToken|SourceSwitchRollbackToken/,
  'the Core-owned compensation journal must never cross into Harmony');

// The helper module is inlined because data-URL loads cannot resolve
// relative specifiers like '../../app/ErrorMessage'.
const errorMessageModule = stripTypeScriptTypes(
  readFileSync(resolve(repo, 'entry/src/main/ets/app/ErrorMessage.ts'), 'utf8'),
).replace('export function errorMessageOf', 'function errorMessageOf');
const sourceCategoryModule = stripTypeScriptTypes(
  readFileSync(resolve(repo, 'entry/src/main/ets/features/source/ReaderSourceCategory.ts'), 'utf8'),
).replace(/^export /gm, '');

const executable = stripTypeScriptTypes(
  (authorMetadataModule + '\n' + gateway
    .replace(/^import \{ runBookSourceWorkers \} from .*;$/m, () =>
      readFileSync(resolve(repo, 'entry/src/main/ets/app/BookRequestScheduler.ts'), 'utf8'))
    .replace(/^import \{[^}]+\} from ['"]\.\.\/common\/BookAcquisitionPresentation['"];$/m,
      () => factModule.replace(/^export /gm, ''))
    .replace(/^import \{ CachedBookIdentityResolver \} from .*;$/m, () =>
      readFileSync(resolve(repo, 'entry/src/main/ets/features/common/CachedBookIdentity.ts'), 'utf8').replace(/^import type .*;$/m, ''))
    .replace(/^import \{ errorMessageOf, isDomainResolutionFailure, isNetworkEnvironmentFailure \} from ['"][^'"]*ErrorMessage(\.ts)?['"];$/m,
      () => errorMessageModule)
    .replace(/^import type \{ JsonObject, RequestOptions \} from ['"]@reader\/core-harmony['"];$/m, '')
    .replace(/^import \{ ReaderRuntimeOwner \} from ['"]\.\.\/\.\.\/app\/ReaderRuntimeOwner['"];$/m, '')
    .replace(/^import type \{ ShelfBook \} from ['"]\.\.\/\.\.\/app\/ReaderCoreGateway['"];$/m, '')
    .replace(/^import \{\n(?:  [^\n]+\n)+\} from ['"]\.\/ReaderSourceCategory['"];$/m,
      () => sourceCategoryModule)).replace(/^import \{[^\n]+\} from ['"][^'"]*BookAuthorMetadata(?:\.ts)?['"];?\n/gm, ''),
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`;
const { SourceSwitchGateway, sourceSwitchCandidateKey, buildSourceSwitchCommitParams } = await import(moduleUrl);
const sdkSource = stripTypeScriptTypes(readFileSync(resolve(repo, 'entry/vendor/core-harmony/sdk/reader_core.ts'), 'utf8'));
const { ReaderCoreRequestError } = await import(`data:text/javascript;base64,${Buffer.from(sdkSource).toString('base64')}`);
function networkFailure(phase, envelope) {
  const details = { category:'NETWORK_ENVIRONMENT', phase, hostErrorCode:'NETWORK_ERROR' };
  // Native failHostRequest supplies CoreError without HostErrorDiagnostics.
  // Core host_error_with_identity promotes category and nests the rest in cause.
  return new ReaderCoreRequestError({ protocolVersion:1, type:'error', requestId:2,
    error:{code:'INTERNAL', message:phase==='dns'
      ?'当前网络无法解析书源域名，请检查代理或网络连接后重试':'代理路由失败', retryable:true,
      details:envelope==='native-cause'
        ?{category:'NETWORK_ENVIRONMENT',cause:details,host:{operationId:1,requestId:2,capability:'http.execute'}}
        :{category:'NETWORK_ENVIRONMENT',host:{diagnostics:{details}}}} });
}
function relatedData(books, extra = {}) {
 return { books: books.map(book => ({...book, relationKey: 'relation', relationRevision: '1'})),
  sourceVersions: [...new Set(books.map(book => book.origin))].map(sourceId => ({sourceId, sourceVersion: 'v1', enabled: true})),
  snapshotRevision: 'snapshot', complete: true, ...extra };
}
function progressiveDeferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function untilProgress(predicate) {
  for (let turn = 0; turn < 100 && !predicate(); turn++) await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(predicate(), 'expected progressive publication before the unresolved source completes');
}
const progressiveQuery = { sourceId: 'original', bookId: '/origin', bookName: 'Current Book', author: 'Writer',
  currentChapterIndex: 0, currentChapterTitle: '' };

// Real per-source worker completions drive the production projection. Delayed
// requests prove first paint, reordering, and acquisition updates do not await
// the full batch; all timing values come from the request boundary clock.
{
  const originalNow = Date.now;
  let now = 10000;
  Date.now = () => now;
  const rows = [], publications = [], started = [], listeners = new Set();
  const gates = new Map(['a', 'b', 'c'].map(id => [id, progressiveDeferred()]));
  const sourceIds = ['original', 'a', 'b', 'c', 'legacy'];
  let finished = false;
  const runtime = {
    bookAcquisitions: () => ({ sourceRegistryRevision: () => 1,
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } }),
    async request(method, params) {
      if (method === 'source.list') return { data: { sources: sourceIds.map(sourceId =>
        ({ sourceId, name: sourceId, enabled: true, sourceVersion: 'v1' })) } };
      if (method === 'search-book.related') return { data: relatedData(structuredClone(rows)) };
      assert.equal(method, 'change.bookSource');
      const id = params.sourceIds[0]; started.push(id); now += 100;
      await gates.get(id).promise;
      rows.push({ origin: id, bookUrl: '/book', name: 'Current Book', author: 'Writer', time: now,
        acquisition: { sourceVersion: 'v1' } });
      return { data: { candidates: [{ sourceId: id, bookUrl: '/book', bookName: 'Current Book', author: 'Writer' }] } };
    },
  };
  const gateway = new SourceSwitchGateway(runtime);
  try {
    const run = gateway.refreshCandidates(progressiveQuery, () => true, ['original', 'legacy'],
      candidates => publications.push(structuredClone(candidates))).then(result => { finished = true; return result; });
    await untilProgress(() => started.length === 3);
    assert.deepEqual(publications[0], [], 'initial 0 means an active discovery, not a fabricated failure');
    now = 10400; gates.get('a').resolve();
    await untilProgress(() => publications.some(items => items.length === 1));
    assert.equal(finished, false);
    assert.equal(publications.at(-1)[0].latencyMs, 400);
    assert.equal(publications.at(-1)[0].latencyKind, 'search');
    assert.equal(publications.at(-1)[0].acquisitionState, 'discovered', 'search success is not readable content');
    now = 10500; gates.get('c').resolve();
    await untilProgress(() => publications.some(items => items.length === 2));
    assert.deepEqual(publications.at(-1).map(item => item.sourceId), ['c', 'a']);
    assert.deepEqual(publications.at(-1).map(item => item.latencyMs), [300, 400]);
    assert.equal(finished, false, 'a faster late source moves above an earlier result while b is still pending');
    rows.push({ origin: 'legacy', bookUrl: '/old', name: 'Current Book', author: 'Writer', time: now, respondTime: 0 });
    rows.find(row => row.origin === 'a').latestChapterTitle = 'New chapter';
    for (const listener of listeners) listener({ reset: false, identities: [{ sourceId: 'a', bookId: '/book' }] });
    await untilProgress(() => publications.at(-1)?.some(item => item.latestChapterTitle === 'New chapter'));
    assert.deepEqual(publications.at(-1).map(item => item.sourceId), ['c', 'a', 'legacy']);
    assert.equal(publications.at(-1)[2].latencyMs, undefined, 'unknown duration never sorts as zero');
    now = 10800; gates.get('b').resolve();
    const result = await run;
    assert.deepEqual(result.candidates.map(item => item.sourceId), ['c', 'a', 'b', 'legacy']);
    assert.equal(new Set(result.candidates.map(item => sourceSwitchCandidateKey(item.sourceId, item.bookUrl))).size, 4);
    assert.equal(listeners.size, 0, 'the temporary sweep subscriber is released on completion');
    const before = publications.length;
    for (const listener of listeners) listener({ reset: true, identities: [] });
    await Promise.resolve(); assert.equal(publications.length, before);
    const cached = await gateway.loadCachedCandidates(progressiveQuery);
    assert.deepEqual(cached.map(item => item.latencyMs), [300, 400, 700, undefined],
      'a later cache/acquisition projection preserves the same-round timing samples');
    const equal = gateway.sortCandidates([
      { sourceId: 'b', bookUrl: '/2', sourceOrder: 1, latencyKind: 'search', latencyMs: 20 },
      { sourceId: 'a', bookUrl: '/1', sourceOrder: 0, latencyKind: 'search', latencyMs: 20 },
      { sourceId: 'invalid', bookUrl: '/x', sourceOrder: -1, latencyKind: 'search', latencyMs: NaN },
    ]);
    assert.deepEqual(equal.map(item => item.sourceId), ['a', 'b', 'invalid'], 'latency ties retain deterministic source order');
  } finally { Date.now = originalNow; }
}

// A captured older cache read and a later live seed may overlap. Serialize the
// projection and retain Core-confirmed missing live rows until persistence,
// without guessing same-book identity or replacing a newer visible snapshot.
{
  const rows = [], publications = [], listeners = new Set();
  const a = progressiveDeferred(), b = progressiveDeferred(), cacheRead = progressiveDeferred();
  let relatedReads = 0, started = 0, captured = false, bReturned = false;
  const gateway = new SourceSwitchGateway({
    bookAcquisitions: () => ({ sourceRegistryRevision: () => 1,
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } }),
    async request(method, params) {
      if (method === 'source.list') return { data: { sources: ['original', 'a', 'b'].map(sourceId =>
        ({ sourceId, enabled: true, sourceVersion: 'v1' })) } };
      if (method === 'search-book.related') {
        const data = relatedData(structuredClone(rows));
        if (++relatedReads === 2) { captured = true; await cacheRead.promise; }
        return { data };
      }
      if (method === 'search-book.batch.get') {
        assert.deepEqual(params.identities, [{ sourceId: 'b', bookId: '/book' }]);
        return { data: { complete: true, books: [], missing: params.identities } };
      }
      assert.equal(method, 'change.bookSource'); started++;
      const id = params.sourceIds[0]; await (id === 'a' ? a.promise : b.promise);
      if (id === 'a') rows.push({ origin: id, bookUrl: '/book', name: 'Current Book', author: 'Writer', time: Date.now() });
      else bReturned = true;
      const candidate = { sourceId: id, bookUrl: '/book', bookName: 'Current Book', author: 'Writer' };
      return { data: { candidates: [candidate, candidate] } };
    },
  });
  const run = gateway.refreshCandidates(progressiveQuery, () => true, ['original'],
    candidates => publications.push(structuredClone(candidates)));
  await untilProgress(() => started === 2);
  a.resolve(); await untilProgress(() => captured);
  b.resolve(); await untilProgress(() => bReturned);
  for (const listener of listeners) listener({ reset: true, identities: [] });
  cacheRead.resolve();
  const result = await run;
  assert.deepEqual(result.candidates.map(item => item.sourceId).sort(), ['a', 'b']);
  assert.equal(result.candidates.length, 2, 'duplicate live rows keep one stable composite identity');
  const bVisible = publications.findIndex(items => items.some(item => item.sourceId === 'b'));
  assert.ok(bVisible >= 0);
  assert.ok(publications.slice(bVisible).every(items => items.some(item => item.sourceId === 'b')),
    'queued older/acquisition reads cannot swallow the already admitted unpersisted candidate');
}

// Even without a caller guard, a newer sweep owns its samples. An older source
// reply must not overwrite timing, publish, or turn cancellation into failure.
{
  const originalNow = Date.now;
  let now = 20000, requests = 0;
  Date.now = () => now;
  const gates = [progressiveDeferred(), progressiveDeferred()], oldPublications = [], newPublications = [];
  const rows = [{ origin: 's', bookUrl: '/book', name: 'Current Book', author: 'Writer', time: now }];
  const runtime = { async request(method) {
    if (method === 'source.list') return { data: { sources: [{ sourceId: 's', enabled: true }] } };
    if (method === 'search-book.related') return { data: relatedData(rows) };
    assert.equal(method, 'change.bookSource'); const index = requests++;
    await gates[index].promise;
    return { data: { candidates: [{ sourceId: 's', bookUrl: '/book', bookName: 'Current Book' }] } };
  } };
  const gateway = new SourceSwitchGateway(runtime);
  try {
    const oldRun = gateway.refreshCandidates(progressiveQuery, undefined, [], rows => oldPublications.push(rows));
    await untilProgress(() => requests === 1);
    now = 20200;
    const newRun = gateway.refreshCandidates(progressiveQuery, undefined, [], rows => newPublications.push(rows));
    await untilProgress(() => requests === 2);
    now = 20250; gates[1].resolve();
    assert.equal((await newRun).candidates[0].latencyMs, 50);
    const oldCount = oldPublications.length;
    now = 20900; gates[0].resolve();
    assert.deepEqual(await oldRun, { kind: 'noSources' });
    assert.equal(oldPublications.length, oldCount);
    assert.equal((await gateway.loadCachedCandidates(progressiveQuery))[0].latencyMs, 50);
    assert.equal(newPublications.at(-1)[0].latencyKind, 'search');
  } finally { Date.now = originalNow; }
}
{
  let active = true, started = false;
  const gate = progressiveDeferred(), publications = [];
  const gateway = new SourceSwitchGateway({ async request(method) {
    if (method === 'source.list') return { data: { sources: [{ sourceId: 's', enabled: true }] } };
    if (method === 'search-book.related') return { data: relatedData([]) };
    started = true; await gate.promise;
    throw new Error('cancelled transport');
  } });
  const run = gateway.refreshCandidates(progressiveQuery, () => active, [], rows => publications.push(rows));
  await untilProgress(() => started); active = false; gate.resolve();
  assert.deepEqual(await run, { kind: 'noSources' });
  assert.deepEqual(publications, [[]], 'cancellation emits neither an empty completion nor a false source failure');
}
console.log('PASS progressive source discovery: early rows, live acquisition projection, measured search ordering, stable ties, legacy exclusion and generation-safe cancellation');

// The reused primitives must preserve manga/text admission despite same-name relations.
{
 const sources = ['comic-a','comic-b','novel','audio'].map((sourceId,index)=>({sourceId,name:sourceId,enabled:true,sourceVersion:'v1',bookSource:{bookSourceType:index<2?2:index===2?0:1}}));
 const rows = sources.map(({sourceId})=>({origin:sourceId,bookUrl:'/same-name',name:'Book',author:'Writer',time:Date.now(),respondTime:1}));
 const searched=[];
 const owner={async request(method,params){
  if(method==='source.list')return {data:{sources}};
  if(method==='search-book.related')return {data:relatedData(rows)};
  assert.equal(method,'change.bookSource');const id=params.sourceIds[0];searched.push(id);
  return {data:{candidates:[{sourceId:id,bookUrl:'/same-name',bookName:'Book',author:'Writer'},{sourceId:'spoof',bookUrl:'/spoof',bookName:'Book'}]}};
 }};
 const gateway=new SourceSwitchGateway(owner);
 const query={contentKind:'manga',sourceId:'comic-a',bookId:'/same-name',bookName:'Book',author:'Writer',currentChapterIndex:0,currentChapterTitle:''};
 assert.deepEqual((await gateway.loadCachedCandidates(query)).map(row=>row.sourceId),['comic-a','comic-b']);
 const manga=await gateway.discoverCandidates('comic-a','/same-name','Book',()=>true,[],'manga');
 assert.deepEqual(searched,['comic-a','comic-b']);assert.equal(manga.candidates.length,2);
 assert.ok(manga.candidates.every(row=>row.category==='comic'&&row.latencyKind==='search'));
 searched.length=0;await gateway.discoverCandidates('novel','/same-name','Book',()=>true,[],'text');
 assert.deepEqual(searched,['novel']);
 searched.length=0;const result=await gateway.refreshCandidates(query,()=>true,[],()=>{});
 assert.deepEqual(searched,['comic-a','comic-b']);assert.ok(result.candidates.every(row=>row.category==='comic'));
 const next=gateway.withoutSearchTiming(result.candidates);
 assert.ok(next.every(row=>row.latencyMs===undefined&&row.latencyKind===undefined));assert.deepEqual(next.map(row=>row.bookUrl),result.candidates.map(row=>row.bookUrl));
 await assert.rejects(gateway.refreshCandidates({...query,currentChapterIndex:-1}),/non-negative/);
}
console.log('PASS manga/text discovery and same-type cached relation filtering; spoofed source rejection; remeasure keeps identities');

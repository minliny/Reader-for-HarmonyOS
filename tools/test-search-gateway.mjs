import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const { readFileSync }=await import('node:fs');
const { stripTypeScriptTypes }=await import('node:module');
const { dirname, resolve }=await import('node:path');
const { fileURLToPath }=await import('node:url');
const { readBookSearchTiming }=await import('../entry/src/main/ets/features/common/BookSearchTiming.ts');

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gatewayPath = resolve(
  repo,
  'entry/src/main/ets/features/search/SearchGateway.ts',
);
const gatewaySource = readFileSync(gatewayPath, 'utf8');
const authorMetadataModule = readFileSync(resolve(repo, 'entry/src/main/ets/features/common/BookAuthorMetadata.ts'), 'utf8');
const identityModule = readFileSync(resolve(repo, 'entry/src/main/ets/features/common/CachedBookIdentity.ts'), 'utf8').replace(/^import type .*;$/m, '');
const sourceCategoryModule = stripTypeScriptTypes(
  readFileSync(resolve(repo, 'entry/src/main/ets/features/source/ReaderSourceCategory.ts'), 'utf8'),
).replace(/^export /gm, '');
const timingModule = stripTypeScriptTypes(readFileSync(resolve(repo,
  'entry/src/main/ets/features/common/BookSearchTiming.ts'), 'utf8')).replace(/^export /gm, '');

// The helper module is inlined because data-URL loads cannot resolve
// relative specifiers like '../../app/ErrorMessage'.
const errorMessageModule = stripTypeScriptTypes(
  readFileSync(resolve(repo, 'entry/src/main/ets/app/ErrorMessage.ts'), 'utf8'),
).replace('export function errorMessageOf', 'function errorMessageOf');

// ReaderRuntimeOwner imports Harmony-only modules. Strip that single runtime
// import so this contract test can exercise the real decoder and gateway with
// an injected owner without replacing application code.
const nodeSource = stripTypeScriptTypes(
  (authorMetadataModule + '\n' + gatewaySource
    .replace(/^import \{ readBookSearchTiming \} from .*;$/m, () => timingModule)
    .replace(/^import \{ SearchBookProjection, type SearchBookPatch \} from .*;$/m, () =>
      readFileSync(resolve(repo, 'entry/src/main/ets/features/search/SearchBookProjection.ts'), 'utf8'))
    .replace(/^import \{\n(?:  [^\n]+\n)+\} from ['"]\.\.\/source\/ReaderSourceCategory['"];$/m,
      () => sourceCategoryModule)
    .replace(/^import \{[^\n]*errorMessageOf[^\n]*\} from ['"][^'"]*ErrorMessage(\.ts)?['"];$/m,
      () => errorMessageModule)
    .replace(
      /^import \{ ReaderRuntimeOwner \} from ['"]\.\.\/\.\.\/app\/ReaderRuntimeOwner['"];$/m,
      '',
    )).replace(/^import \{[^\n]+\} from ['"][^'"]*BookAuthorMetadata(?:\.ts)?['"];?\n/gm, ''),
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(nodeSource).toString('base64')}`;
const { SearchGateway, searchSourceHealthState } = await import(moduleUrl);

const source = {
  sourceId: 'source-a',
  name: '甲书源',
  enabled: true,
  category: 'novel',
};

function gatewayReturning(book) {
  return new SearchGateway({
    request: async (command) => {
      assert.equal(command, 'book.search');
      return {
        data: {
          sourceId: source.sourceId,
          books: [book],
        },
      };
    },
  });
}

const validOutcome={
  ok: true,
  results: [{
    sourceId: 'source-a',
    sourceName: '甲书源',
    bookSourceUrl: 'source-a',
    bookId: '/detail/book-42?from=search',
    detailUrl: '/detail/book-42?from=search',
    searchRequestId: 'sweep-1',
    sourceRuleVersion: '',
    category: 'novel',
    groupKey: '远程书籍\u0000作者',
    title: '远程书籍',
    author: '作者',
    coverUrl: 'https://example.test/cover.jpg',
    intro: '简介',
    kind: '玄幻',
    latestChapterTitle: '第十章',
    variables: [
      { name: 'page', value: '2' },
      { name: 'token', value: 'search-token' },
    ],
  }],
};
const keyOf = b => `${b.sourceId ?? b.origin}\u0000${b.bookId ?? b.bookUrl}`;
const identityOf = b => ({sourceId:b.sourceId??b.origin,bookId:b.bookId??b.bookUrl});
function fixture(count=1) {
  const sources=['a','b'].map(sourceId=>({sourceId,name:sourceId,enabled:true,sourceVersion:`v-${sourceId}`,category:'novel'}));
  const books=Array.from({length:count},(_,i)=>({...validOutcome.results[0],sourceId:'a',sourceName:'a',bookSourceUrl:'a',
    sourceRuleVersion:'v-a',bookId:`/${i}`,detailUrl:`/${i}`,title:`书${i}`,author:'作者',groupKey:`card${i}`,admittedOrder:i}));
  const rows=new Map(books.map(b=>[keyOf(b),{origin:b.sourceId,bookUrl:b.bookId,name:b.title,author:b.author,
    relationKey:`relation${b.bookId}`,relationRevision:'1',acquisition:{sourceVersion:'v-a',detailAt:1}}]));
  const calls=[];let revision=1, handler;
  const owner={bookAcquisitions:()=>({sourceRegistryRevision:()=>revision}),request:async(method,params)=>{
    calls.push({method,params});
    if (method==='source.list')return {data:{sources}};
    if(handler){const result=await handler(method,params);if(result)return result;}
    assert.equal(method,'search-book.batch.get','projection must not read global/origin cache or dispatch HTTP');
    assert.ok(params.identities.length<=128);
    return {data:{books:params.identities.map(i=>structuredClone(rows.get(keyOf(i)))).filter(Boolean),
      missing:params.identities.filter(i=>!rows.has(keyOf(i))),sourceVersions:sources,
      snapshotRevision:'snapshot',complete:true}};
  }};
  return {sources,books,rows,calls,owner,gateway:new SearchGateway(owner),setHandler:h=>handler=h,bump:()=>revision++};
}
function apply(index,patch){for(const key of patch.removedKeys)index.delete(key);for(const book of patch.upserted)index.set(keyOf(book),book);}

try{
if(id==='remote-timeout'){
{
  let timeout;
  const outcome = await new SearchGateway({ request: async (_command, _params, options) => {
    timeout = options?.timeoutMs;
    return { data: { sourceId: source.sourceId, books: [{ bookId: '/bounded', title: '限时', author: '' }] } };
  } }).searchBySource(source, '限时');
  assert.equal(outcome.ok, true);
  assert.equal(timeout, 15000, 'live source search uses a bounded request timeout');
}
}
if(id==='local-timeout'){
{
  let localTimeout = 'unset';
  const gateway = new SearchGateway({ request: async (command, _params, options) => {
    assert.equal(command, 'bookshelf.list');
    localTimeout = options?.timeoutMs;
    return { data: { books: [], total: 0 } };
  } });
  await gateway.searchLocalBooks('本地', 'local-timeout-check');
  assert.equal(localTimeout, undefined, 'local bookshelf pagination keeps its existing timeout contract');
}
}
if(id==='decode'){
const validOutcome = await gatewayReturning({
  sourceId: 'untrusted-inner-source',
  bookId: '/detail/book-42?from=search',
  title: '远程书籍',
  author: '作者',
  coverUrl: 'https://example.test/cover.jpg',
  intro: '简介',
  kind: '玄幻',
  lastChapter: '第十章',
  variables: {
    token: 'search-token',
    page: '2',
  },
}).searchBySource(source, '关键字', undefined, 'sweep-1');

assert.deepEqual(validOutcome, {
  ok: true,
  results: [{
    sourceId: 'source-a',
    sourceName: '甲书源',
    bookSourceUrl: 'source-a',
    bookId: '/detail/book-42?from=search',
    detailUrl: '/detail/book-42?from=search',
    searchRequestId: 'sweep-1',
    sourceRuleVersion: '',
    category: 'novel',
    groupKey: '远程书籍\u0000作者',
    title: '远程书籍',
    author: '作者',
    coverUrl: 'https://example.test/cover.jpg',
    intro: '简介',
    kind: '玄幻',
    latestChapterTitle: '第十章',
    variables: [
      { name: 'page', value: '2' },
      { name: 'token', value: 'search-token' },
    ],
  }],
});
assert.equal(validOutcome.results[0].detailUrl, validOutcome.results[0].bookId,
  'detailUrl must be the exact validated bookId, not a derived URL');

const mixedRows = await new SearchGateway({ request: async () => ({ data: {
  sourceId: source.sourceId, books: [
    { bookId: '/good', title: '鸣龙', author: '关关公子' },
    { bookId: '/bad', title: '' },
    { bookId: '/bad-vars', title: '另一书', variables: { token: 42 } },
    { bookId: '/good2', title: '正常书籍' },
  ],
} }) }).searchBySource(source, '鸣龙');
assert.equal(mixedRows.ok, true);
assert.deepEqual(mixedRows.results.map(book => book.bookId), ['/good', '/good2']);
assert.equal(mixedRows.discardedCount, 2);
assert.equal(mixedRows.discardedReasons.length, 2);

}
if(id==='envelope'){
for (const data of [
  ...['manga', 'audio', null, 2].map(contentKind => ({
    sourceId: source.sourceId, contentKind, books: [{ bookId: '/good', title: 'Book' }],
  })),
  { sourceId: 'wrong', books: [{ bookId: '/good', title: '鸣龙' }] },
  { sourceId: source.sourceId, sourceVersion: 'wrong', books: [{ bookId: '/good', title: '鸣龙' }] },
  { sourceId: source.sourceId, sourceVersion: 42, books: [{ bookId: '/good', title: '鸣龙' }] },
  { sourceId: source.sourceId, books: {} },
]) {
  const outcome = await new SearchGateway({ request: async () => ({ data }) }).searchBySource({ ...source, sourceVersion: 'v1' }, '鸣龙');
  assert.equal(outcome.ok, false, 'envelope identity/version failure rejects all rows');
}
}
if(id==='variables'){
for (const invalidVariables of [
  null,
  [],
  'not-an-object',
  { token: 42 },
  { token: true },
]) {
  const outcome = await gatewayReturning({
    bookId: '/invalid/book',
    title: '非法变量',
    variables: invalidVariables,
  }).searchBySource(source, '关键字');
  assert.equal(outcome.ok, false, 'invalid variables must fail the source result');
  assert.match(outcome.error, /variables/);
}
}
if(id==='legacy'){
const legacyOutcome = await gatewayReturning({
  bookId: '/legacy/gateway-book',
  title: '旧网关响应',
}).searchBySource(source, '关键字', undefined, 'sweep-2');
assert.deepEqual(legacyOutcome, {
  ok: true,
  results: [{
    sourceId: 'source-a',
    sourceName: '甲书源',
    bookSourceUrl: 'source-a',
    bookId: '/legacy/gateway-book',
    detailUrl: '/legacy/gateway-book',
    searchRequestId: 'sweep-2',
    sourceRuleVersion: '',
    category: 'novel',
    groupKey: '旧网关响应\u0000',
    title: '旧网关响应',
    author: '',
    variables: [],
  }],
});


}
if(id==='base-url'){
const baseUrlSource = { sourceId: 'source-b', name: '乙书源', enabled: true, category: 'novel', baseUrl: 'https://b.example.test' };
const baseUrlOutcome = await new SearchGateway({
  request: async (command, params) => {
    assert.equal(command, 'book.search');
    return { data: { sourceId: params.sourceId, books: [{ bookId: '/b/book', title: '书' }] } };
  },
}).searchBySource(baseUrlSource, '关键字', undefined, 'sweep-3');
assert.equal(baseUrlOutcome.results[0].bookSourceUrl, 'https://b.example.test',
  'bookSourceUrl carries the source.list baseUrl identity');


}
if(id==='category'){
let mixedCategoryRequestCount = 0;
const mixedCategoryGateway = new SearchGateway({
  request: async () => {
    mixedCategoryRequestCount += 1;
    throw new Error('非小说书源不应进入 Core 搜索');
  },
});
for (const category of ['music', 'download', 'external', 'other']) {
  const outcome = await mixedCategoryGateway.searchBySource({
    sourceId: `source-${category}`,
    name: `source-${category}`,
    enabled: true,
    category,
  }, '关键字');
  assert.equal(outcome.ok, false);
  assert.match(outcome.error, /not supported by the novel reader/);
}
assert.equal(mixedCategoryRequestCount, 0,
  '音乐、下载和外部媒体源不得进入阅读搜索链路');


}
if(id==='source-version'){
let sourceListUrl = 'https://rule-one.example.test';
let sourceVersion = 'core-rule-hash-one';
const versionGateway = new SearchGateway({
  request: async (command, params) => {
    if (command === 'source.list') {
      return { data: { sources: [
        { sourceId: 'source-b', name: '乙书源', enabled: true, category: 'novel', baseUrl: sourceListUrl, sourceVersion },
      ] } };
    }
    assert.equal(command, 'book.search');
    return { data: { sourceId: params.sourceId, books: [{ bookId: '/v/book', title: '书' }] } };
  },
});
const listOne = await versionGateway.loadSources();
assert.deepEqual(listOne.map((s) => s.baseUrl), ['https://rule-one.example.test'],
  'source.list decodes the optional baseUrl field');
const versionOne = (await versionGateway.searchBySource(listOne[0], '关键字')).results[0].sourceRuleVersion;
const versionAgain = (await versionGateway.searchBySource(listOne[0], '关键字')).results[0].sourceRuleVersion;
assert.equal(versionOne, 'core-rule-hash-one');
assert.equal(versionAgain, 'core-rule-hash-one', 'Core rule version remains stable');
sourceVersion = 'core-rule-hash-two'; // Rules changed while baseUrl stayed the same.
const listTwo = await versionGateway.loadSources();
const versionTwo = (await versionGateway.searchBySource(listTwo[0], '关键字')).results[0].sourceRuleVersion;
assert.equal(versionTwo, 'core-rule-hash-two', 'an unchanged baseUrl cannot hide changed rules');


}
if(id==='request-identity'){
const gateway=new SearchGateway({request:async()=>({data:{sourceId:source.sourceId,books:[{bookId:'/a',title:'甲'},{bookId:'/b',title:'乙'}]}})});const first=await gateway.searchBySource(source,'a'),second=await gateway.searchBySource(source,'b');assert.ok(first.ok&&second.ok);const id=first.results[0].searchRequestId;assert.ok(typeof id==='string'&&id.trim());assert.ok(first.results.every(b=>b.searchRequestId===id));assert.notEqual(second.results[0].searchRequestId,id);assert.equal(first.results[0].sourceRuleVersion,'');
}
if(id==='registry-generation'){
{
  const defer = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
  let revision = 1, calls = [];
  const gateway = new SearchGateway({bookAcquisitions:()=>({sourceRegistryRevision:()=>revision}),request:method=>{
    assert.equal(method,'source.list');const pending=defer();calls.push(pending);return pending.promise;
  }});
  const first=gateway.loadSources(), submit=gateway.loadSources();assert.equal(calls.length,1);
  calls[0].resolve({data:{sources:[source]}});
  assert.equal(await first,await submit,'one immutable projection is shared');
  assert.equal((await gateway.loadSources())[0].sourceId,source.sourceId);assert.equal(calls.length,1);
  revision++;
  const old=gateway.loadSources();const oldRejected=assert.rejects(old,/source registry changed/);
  revision++;
  const fresh=gateway.loadSources();assert.equal(calls.length,3);
  calls[1].resolve({data:{sources:[{...source,name:'stale'}]}});await oldRejected;
  const joinFresh=gateway.loadSources();assert.equal(calls.length,3,'old completion cannot clear a newer in-flight load');
  calls[2].resolve({data:{sources:[{...source,name:'fresh'}]}});
  assert.equal((await fresh)[0].name,'fresh');assert.equal(await fresh,await joinFresh);
  revision++;
  const failed=gateway.loadSources(), joinedFailure=gateway.loadSources();
  const failures=Promise.all([assert.rejects(failed,/fixture offline/),assert.rejects(joinedFailure,/fixture offline/)]);
  calls[3].reject(Error('fixture offline'));await failures;
  const retried=gateway.loadSources();assert.equal(calls.length,5,'failure clears only its own pending promise');
  calls[4].resolve({data:{sources:[source]}});await retried;
}
}
if(id==='source-health'){
{
  let listParams;
  const version = 'rule-v1';
  const report = (status, checkedAtMs = Date.now()) => ({ checkedAtMs, stale: false, report: {
    mode: 'search', ruleDigest: version, steps: [
      { level: 'L1', requested: true, status }, { level: 'L2', requested: true, status },
    ],
  } });
  const owner = {
    supportsCoreCapability: (capability) => capability === 'source.check.report.v2',
    request: async (method, params) => {
      assert.equal(method, 'source.list'); listParams = params;
      return { data: { sources: [
        { ...source, sourceVersion: version, checkReports: [report('fail')] },
        { ...source, sourceId: 'stale', sourceVersion: version, checkReports: [report('fail', Date.now() - 3 * 24 * 60 * 60 * 1000)] },
        { ...source, sourceId: 'unknown', sourceVersion: version, checkReports: [{ ...report('blocked'), stale: true }] },
        { ...source, sourceId: 'never', sourceVersion: version },
      ] } };
    },
  };
  const loaded = await new SearchGateway(owner).loadSources();
  assert.equal(listParams.includeCheckReports, true);
  assert.equal(listParams.checkReportVersion, 2);
  assert.equal(loaded[0].health.state, 'failed');
  assert.equal(searchSourceHealthState(loaded[0]), 'failed');
  assert.equal(searchSourceHealthState(loaded[1]), 'stale');
  assert.equal(searchSourceHealthState(loaded[2]), 'stale');
  assert.equal(loaded[3].health, undefined, 'missing report remains unknown and dispatchable');
}
}
if(id==='timing'){
{
  const originalNow = Date.now;
  let now = 10000;
  Date.now = () => now;
  try {
    const f = fixture();
    const row = f.rows.get('a\u0000/0');
    row.acquisition = { schemaVersion: 2, sourceVersion: 'v-a', detailAt: 8000, catalogAt: 8000,
      catalogCount: 3, checkedAt: 8000, readableAt: 8000, stage: 'readable', verificationCurrent: true };
    let releaseWrite;
    const writeGate = new Promise(resolve => { releaseWrite = resolve; });
    const originalRequest = f.owner.request;
    let timingPatch;
    f.owner.request = async (method, params, options) => {
      if (method === 'book.search') {
        now += 5000;
        options.onDispatch();
        now += 237;
        return { data: { sourceId: 'a', sourceVersion: 'v-a', books: [
          { bookId: '/0', title: '书0', author: '作者', acquisition: structuredClone(row.acquisition) },
        ] } };
      }
      if (method === 'search-book.put') {
        timingPatch = params;
        await writeGate;
        row.acquisition = { ...row.acquisition, searchTiming: params.acquisition.searchTiming };
        return { data: { book: row } };
      }
      return originalRequest(method, params, options);
    };
    const outcome = await f.gateway.searchBySource(f.sources[0], '书0', () => true, 'timed-search');
    assert.equal(outcome.ok, true, 'live results resolve while the timing store write is still blocked');
    const sample = { latencyMs: 237, latencyKind: 'search', latencyMeasuredAt: 15237 };
    assert.deepEqual(readBookSearchTiming(outcome.results[0].acquisition, 'v-a'), sample,
      'only the dispatched acquisition duration is reused by first drawer open');
    assert.equal(outcome.results[0].acquisition.stage, 'readable', 'timing enrichment keeps an existing stronger stage');
    assert.equal(outcome.results[0].acquisition.checkedAt, 8000, 'search timing cannot advance readability freshness');
    assert.deepEqual(timingPatch, { origin: 'a', bookUrl: '/0', acquisition: { schemaVersion: 2,
      sourceVersion: 'v-a', stage: 'search', checkedAt: 15237,
      searchTiming: { kind: 'search', sourceVersion: 'v-a', durationMs: 237, measuredAt: 15237 } } });
    const beforeStored = await f.gateway.refreshBooks(outcome.results);
    assert.deepEqual(readBookSearchTiming(beforeStored[0].acquisition, 'v-a'), sample,
      'an early metadata projection cannot erase the live sample while its write is pending');
    assert.equal(beforeStored[0].acquisition.catalogCount, 3);
    releaseWrite();
    await f.gateway.searchTimingPersistence;
    const reopened = await new SearchGateway(f.owner).refreshBooks(outcome.results.map(book => ({ ...book, acquisition: undefined })));
    assert.deepEqual(readBookSearchTiming(reopened[0].acquisition, 'v-a'), sample,
      'a fresh gateway recovers the stored fixture sample without another book.search');
    assert.equal(reopened[0].acquisition.readableAt, 8000);
    f.sources[0].sourceVersion = 'v-a-new';
    row.acquisition.sourceVersion = 'v-a-new';
    f.bump();
    const updated = await f.gateway.refreshBooks(outcome.results.map(book => ({ ...book, sourceRuleVersion: 'v-a-new' })));
    assert.equal(readBookSearchTiming(updated[0].acquisition, 'v-a-new'), undefined,
      'a sample of the previous source rule is not reused after the registry changes');
  } finally { Date.now = originalNow; }
}
}
if(id==='timing-negative'){
{
  const timedSource = { ...source, sourceVersion: 'v1' };
  for (const mode of ['not-dispatched', 'missing-version', 'cancelled', 'write-failed']) {
    let current = true, writes = 0;
    const gateway = new SearchGateway({ request: async (method, _params, options) => {
      if (method === 'search-book.put') { writes++; throw new Error('read-only timing store'); }
      assert.equal(method, 'book.search');
      if (mode !== 'not-dispatched') options.onDispatch();
      if (mode === 'cancelled') current = false;
      return { data: { sourceId: source.sourceId,
        ...(mode === 'missing-version' ? {} : { sourceVersion: 'v1' }),
        books: [{ bookId: '/timed', title: '计时书' }] } };
    } });
    const outcome = await gateway.searchBySource(mode === 'missing-version' ? source : timedSource,
      '计时书', () => current);
    await gateway.searchTimingPersistence;
    assert.equal(outcome.ok, mode !== 'cancelled');
    if (outcome.ok) assert.equal(readBookSearchTiming(outcome.results[0].acquisition, 'v1') !== undefined,
      mode === 'write-failed', 'only a current dispatched request with a source-version proof creates timing');
    assert.equal(writes, mode === 'write-failed' ? 1 : 0, 'no timing write for a cancelled or unmeasured request');
  }
}
}
if(id==='timing-write-budget'){
{
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let active = 0, maximum = 0, writes = 0;
  const gateway = new SearchGateway({ request: async (method, params, options) => {
    if (method === 'book.search') {
      options.onDispatch();
      return { data: { sourceId: params.sourceId, sourceVersion: 'v1', books: Array.from({ length: 9 },
        (_, i) => ({ bookId: `/${i}`, title: '计时书' })) } };
    }
    assert.equal(method, 'search-book.put');
    writes++; active++; maximum = Math.max(maximum, active);
    await gate;
    active--;
    return { data: {} };
  } });
  const outcomes = await Promise.all(['a', 'b'].map(sourceId => gateway.searchBySource(
    { ...source, sourceId, sourceVersion: 'v1' }, '计时书')));
  assert.ok(outcomes.every(outcome => outcome.ok), 'two live sources publish before their durable enrichments finish');
  assert.equal(active, 4, 'one gateway bounds background timing writes across every source');
  release();
  await gateway.searchTimingPersistence;
  assert.equal(writes, 18); assert.equal(maximum, 4);
}
}
if(id==='delta-scope'){
for(const unrelated of [0,9000]) {
  const f=fixture(1000);const index=new Map(f.books.map(b=>[keyOf(b),b]));
  for(let i=0;i<unrelated;i++)f.rows.set(`unrelated${i}`,{origin:'a',bookUrl:`/unrelated${i}`,name:'历史书',author:'别的作者'});
  let patch=await f.gateway.refreshBookDelta(index,{reset:true,identities:[]});apply(index,patch);
  assert.equal(patch.retryIdentities.length,0);assert.equal(index.size,1000);
  assert.equal(f.calls.filter(c=>c.method==='search-book.batch.get').length,8);
  f.calls.length=0;
  f.rows.get('a\u0000/500').intro='更新简介';
  const before=new Map(index);let projected=0;
  const original=f.gateway.bookProjection.project.bind(f.gateway.bookProjection);
  f.gateway.bookProjection.project=(...args)=>{projected++;return original(...args);};
  patch=await f.gateway.refreshBookDelta(index,{reset:false,identities:[{sourceId:'a',bookId:'/500'}]});apply(index,patch);
  assert.equal(patch.upserted.length,1);assert.equal(projected,1);assert.equal(patch.captured.size,1);
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].params.identities.length,1);
  assert.equal(index.get('a\u0000/501'),before.get('a\u0000/501'));
  console.log(`R5/R6 query=1000 unrelated=${unrelated}: metadata RPC=1 returned=1 projected=1 captured=1 PASS`);
}
}
if(id==='partition'){
{
  const f=fixture(2);const b={...f.books[0],sourceId:'b',sourceName:'b',sourceRuleVersion:'v-b',bookSourceUrl:'b',bookId:'/b',detailUrl:'/b',groupKey:'b',admittedOrder:2};
  const index=new Map([...f.books,b].map(b=>[keyOf(b),b]));
  f.rows.set(keyOf(b),{origin:'b',bookUrl:'/b',name:'乙书',author:'作者',relationKey:'b',relationRevision:'1',acquisition:{sourceVersion:'v-b'}});
  apply(index,await f.gateway.refreshBookDelta(index,{reset:true,identities:[]}));
  f.setHandler((method,p)=>p.identities?.[0].sourceId==='a'?{data:{books:[],missing:[],sourceVersions:f.sources,complete:true,snapshotRevision:'s'}}:undefined);
  f.rows.get(keyOf(b)).intro='健康源更新';
  const old=index.get('a\u0000/0');const patch=await f.gateway.refreshBookDelta(index,{reset:false,identities:[identityOf(old),identityOf(b)]});apply(index,patch);
  assert.equal(index.get(keyOf(old)),old);assert.equal(index.get(keyOf(b)).intro,'健康源更新');assert.equal(patch.retryIdentities.length,1);
  f.setHandler(undefined);f.rows.delete(keyOf(old));
  const deletion=await f.gateway.refreshBookDelta(index,{reset:false,identities:[identityOf(old)]});apply(index,deletion);
  assert.ok(!index.has(keyOf(old)),'only explicit missing removes admitted fact');
  f.sources[1].enabled=false;f.bump();apply(index,await f.gateway.refreshBookDelta(index,{reset:true,identities:[]}));
  assert.ok(!index.has(keyOf(b)),'disabled source cannot revive from old query');
}
}
if(id==='relation-admission'){
{
  const f=fixture();let index=new Map(f.books.map(b=>[keyOf(b),b]));apply(index,await f.gateway.refreshBookDelta(index,{reset:true,identities:[]}));
  f.rows.set('b\u0000/new',{origin:'b',bookUrl:'/new',name:'书0',author:'作者',relationKey:'relation/0',relationRevision:'1',
    acquisition:{sourceVersion:'v-b'},variable:'{"token":"typed"}'});
  f.rows.set('b\u0000/unrelated',{origin:'b',bookUrl:'/unrelated',name:'书0',author:'另一作者',relationKey:'other',relationRevision:'1',acquisition:{sourceVersion:'v-b'}});
  const patch=await f.gateway.refreshBookDelta(index,{reset:false,identities:[{sourceId:'b',bookId:'/new'},{sourceId:'b',bookId:'/unrelated'}]});apply(index,patch);
  assert.equal(index.size,2);assert.equal(index.get('b\u0000/new').groupKey,'card0');assert.deepEqual(index.get('b\u0000/new').variables,[{name:'token',value:'typed'}]);
}
}
if(id==='merge-split'){
{
  const f=fixture(2);const index=new Map(f.books.map(b=>[keyOf(b),b]));apply(index,await f.gateway.refreshBookDelta(index,{reset:true,identities:[]}));
  for(const row of f.rows.values()){row.relationKey='merged';row.relationRevision='2';}
  f.setHandler((method,p)=>method==='search-book.related'?{data:{books:[...f.rows.values()].filter(r=>r.relationKey===f.rows.get(keyOf(p.identity)).relationKey),
    sourceVersions:f.sources,complete:true,snapshotRevision:'merge'}}:undefined);
  let patch=await f.gateway.refreshBookDelta(index,{reset:false,identities:[{sourceId:'a',bookId:'/1'}]});apply(index,patch);
  assert.equal(index.get('a\u0000/0').groupKey,'card0');assert.equal(index.get('a\u0000/1').groupKey,'card0');
  f.rows.get('a\u0000/0').relationKey='split0';f.rows.get('a\u0000/1').relationKey='split1';
  for(const row of f.rows.values())row.relationRevision='3';
  patch=await f.gateway.refreshBookDelta(index,{reset:false,identities:[{sourceId:'a',bookId:'/0'}]});apply(index,patch);
  assert.equal(index.get('a\u0000/0').groupKey,'card0');assert.notEqual(index.get('a\u0000/1').groupKey,'card0');
}
}
if(id==='incomplete-relation'){
{
  const f=fixture(2);const index=new Map(f.books.map(b=>[keyOf(b),b]));apply(index,await f.gateway.refreshBookDelta(index,{reset:true,identities:[]}));
  f.rows.get('a\u0000/0').relationKey='changed';f.rows.get('a\u0000/0').relationRevision='2';f.rows.get('a\u0000/0').intro='safe metadata';
  f.setHandler((method,p)=>method==='search-book.related'?{data:{books:[f.rows.get('a\u0000/0')],sourceVersions:f.sources,
    complete:false,nextCursor:'stuck',snapshotRevision:p.cursor?'stale':'initial'}}:undefined);
  const patch=await f.gateway.refreshBookDelta(index,{reset:false,identities:[{sourceId:'a',bookId:'/0'}]});apply(index,patch);
  assert.equal(index.get('a\u0000/0').groupKey,'card0');assert.equal(index.get('a\u0000/0').intro,'safe metadata');assert.equal(patch.retryIdentities.length,1);
}
}
if(id==='queued-query'){
{
  let release;const gate=new Promise(r=>release=r);let requests=0;
  const gateway=new SearchGateway({request:async()=>{requests++;await gate;return {data:{sources:[]}};}});
  const pending=gateway.refreshBooks([validOutcome.results[0]]);gateway.resetBookProjection();release();
  await assert.rejects(pending,/superseded/);assert.equal(requests,1);
}
}
if(id==='batch-atomic'){
{
  const f=fixture(130);const index=new Map(f.books.map(b=>[keyOf(b),b]));apply(index,await f.gateway.refreshBookDelta(index,{reset:true,identities:[]}));
  const old=index.get('a\u0000/0');f.rows.get('a\u0000/0').intro='uncommitted head';
  f.setHandler((_method,p)=>p.identities?.[0].bookId==='/128'?{data:{books:[],missing:[],sourceVersions:f.sources,snapshotRevision:'snapshot',complete:true}}:undefined);
  const patch=await f.gateway.refreshBookDelta(index,{reset:true,identities:[]});apply(index,patch);
  assert.equal(index.get('a\u0000/0'),old);assert.equal(patch.upserted.length,0);assert.equal(patch.retryIdentities.length,130);
}
}
if(id==='relation-pages'){
{
  const f=fixture();const index=new Map(f.books.map(b=>[keyOf(b),b]));apply(index,await f.gateway.refreshBookDelta(index,{reset:true,identities:[]}));
  const row=f.rows.get('a\u0000/0');row.relationRevision='2';
  for(let i=0;i<130;i++)f.rows.set(`b\u0000/r${i}`,{...row,origin:'b',bookUrl:`/r${i}`,acquisition:{sourceVersion:'v-b'},variable:'{"token":"literal\\\\n"}'});
  let pages=0;
  f.setHandler((method,p)=>{if(method!=='search-book.related')return;pages++;
    const all=[...f.rows.values()];const start=p.cursor?128:0;
    return {data:{books:all.slice(start,start+128),sourceVersions:f.sources,complete:start+128>=all.length,
      nextCursor:start+128<all.length?'page2':undefined,snapshotRevision:'same'}};});
  apply(index,await f.gateway.refreshBookDelta(index,{reset:false,identities:[{sourceId:'a',bookId:'/0'}]}));
  assert.equal(pages,2);assert.equal(index.size,131);assert.ok([...index.values()].every(b=>b.groupKey==='card0'));
  assert.equal(index.get('b\u0000/r129').variables[0].value,'literal\\n');
}
}
if(id==='http-diagnostic'){
for(const platformCode of [2300023,2300060,undefined]) {
 const cause={category:'SOURCE_HTTP_FAILED',phase:'transport',stage:'request.dispatch',transient:false,requestId:771,elapsedMs:125,
  ...(platformCode===undefined?{}:{platformCode}),url:'PRIVATE_URL',message:'PRIVATE_BODY'};
 const error=Object.assign(new Error('Internal error'),{event:{requestId:771,error:{code:'INTERNAL',message:'Internal error',retryable:false,
  details:{category:'SOURCE_HTTP_FAILED',cause,host:{operationId:77,requestId:771,capability:'http.execute'}}}}});
 const outcome=await new SearchGateway({request:async()=>{throw error}}).searchBySource(source,'鸣龙');
 assert.equal(outcome.ok,false);assert.equal(outcome.error,'Internal error','diagnostics do not change visible copy');
 assert.deepEqual(outcome.diagnostic,{category:'SOURCE_HTTP_FAILED',phase:'transport',stage:'request.dispatch',requestId:771,operationId:77,
  ...(platformCode===undefined?{}:{platformCode}),elapsedMs:125,transient:false});
 assert.ok(!JSON.stringify(outcome.diagnostic).includes('PRIVATE_'));
 error.event.error.details.category='SOURCE_RULE_FAILED';
 const independent=await new SearchGateway({request:async()=>{throw error}}).searchBySource(source,'鸣龙');
 assert.equal(independent.diagnostic,undefined,'later rule failures cannot inherit a prior nested HTTP cause');
}
}
if(id==='media'){
for (const kind of ['manga','text','audio',null,undefined]) {
 const comic={...source,category:'comic'};
 const gateway=new SearchGateway({request:async()=>({data:{sourceId:source.sourceId,contentKind:kind,
 books:[{bookId:'comic',title:'同名作品',author:'同作者',variables:{}}]}})});
 const outcome=await gateway.searchBySource(comic,'同名作品');
 assert.equal(outcome.ok,kind==='manga');
 if(outcome.ok){assert.equal(outcome.results[0].category,'comic');assert.equal(outcome.results[0].groupKey,JSON.stringify(['manga','同名作品\u0000同作者']));}
}
}
}finally{}
}
const definitions={"remote-timeout": "remote-timeout actual scoped owner/gateway/storage path; controlled Core/OS ports", "local-timeout": "local-timeout actual scoped owner/gateway/storage path; controlled Core/OS ports", "decode": "decode actual scoped owner/gateway/storage path; controlled Core/OS ports", "envelope": "envelope actual scoped owner/gateway/storage path; controlled Core/OS ports", "variables": "variables actual scoped owner/gateway/storage path; controlled Core/OS ports", "legacy": "legacy actual scoped owner/gateway/storage path; controlled Core/OS ports", "base-url": "base-url actual scoped owner/gateway/storage path; controlled Core/OS ports", "category": "category actual scoped owner/gateway/storage path; controlled Core/OS ports", "source-version": "source-version actual scoped owner/gateway/storage path; controlled Core/OS ports", "request-identity": "request-identity actual scoped owner/gateway/storage path; controlled Core/OS ports", "registry-generation": "registry-generation actual scoped owner/gateway/storage path; controlled Core/OS ports", "source-health": "source-health actual scoped owner/gateway/storage path; controlled Core/OS ports", "timing": "timing actual scoped owner/gateway/storage path; controlled Core/OS ports", "timing-negative": "timing-negative actual scoped owner/gateway/storage path; controlled Core/OS ports", "timing-write-budget": "timing-write-budget actual scoped owner/gateway/storage path; controlled Core/OS ports", "delta-scope": "delta-scope actual scoped owner/gateway/storage path; controlled Core/OS ports", "partition": "partition actual scoped owner/gateway/storage path; controlled Core/OS ports", "relation-admission": "relation-admission actual scoped owner/gateway/storage path; controlled Core/OS ports", "merge-split": "merge-split actual scoped owner/gateway/storage path; controlled Core/OS ports", "incomplete-relation": "incomplete-relation actual scoped owner/gateway/storage path; controlled Core/OS ports", "queued-query": "queued-query actual scoped owner/gateway/storage path; controlled Core/OS ports", "batch-atomic": "batch-atomic actual scoped owner/gateway/storage path; controlled Core/OS ports", "relation-pages": "relation-pages actual scoped owner/gateway/storage path; controlled Core/OS ports", "http-diagnostic": "http-diagnostic actual scoped owner/gateway/storage path; controlled Core/OS ports", "media": "media actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}

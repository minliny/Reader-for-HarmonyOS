import { fixture as sourceOwnerFixture, setCurrentRuntime } from './lib/source-switch-owner-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siblingCore = resolve(repo, '../Reader-Core-Native');
const core = process.env.READER_SOURCE_SWITCH_CORE_ROOT ?? (existsSync(resolve(siblingCore, 'bindings/harmony/sdk/reader_core.ts'))
  ? siblingCore : resolve(repo, '../../Reader-Core-Native'));
const coreSdkUrl = pathToFileURL(resolve(core, 'bindings/harmony/sdk/reader_core.ts')).href;
const { ReaderCoreRequestError } = await import(coreSdkUrl);
const authorMetadataModule = readFileSync(resolve(repo, 'entry/src/main/ets/features/common/BookAuthorMetadata.ts'), 'utf8');
const searchTimingModule = readFileSync(resolve(repo, 'entry/src/main/ets/features/common/BookSearchTiming.ts'), 'utf8');
const sharedSearchDecoderModule = readFileSync(resolve(repo, 'entry/src/main/ets/features/search/SearchGateway.ts'), 'utf8')
  .replace(/^import[\s\S]*?;\n/gm, '');
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
assert.match(gateway, /'book\.search',[\s\S]*sourceId:\s*source\.sourceId, keyword, page:\s*1/);
assert.doesNotMatch(gateway, /'change\.bookSource'/,
  'one-source discovery must receive real search failures rather than a soft-skipped Core batch');
assert.match(gateway, /decodeBookSearchResult\(raw, searchSource/,
  'source switching consumes the existing live search decoder');
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
const providerFamilyModule = stripTypeScriptTypes(
  readFileSync(resolve(repo, 'entry/src/main/ets/features/source/SourceSwitchProviderFamily.ts'), 'utf8'),
).replace(/^export /gm, '');

const executable = stripTypeScriptTypes(
  (authorMetadataModule + '\n' + searchTimingModule + '\n' + sharedSearchDecoderModule + '\n' + gateway
    .replace(/^import \{ runBookSourceWorkers \} from .*;$/m, () =>
      readFileSync(resolve(repo, 'entry/src/main/ets/app/BookRequestScheduler.ts'), 'utf8'))
    .replace(/^import \{[^}]+\} from ['"]\.\.\/common\/BookAcquisitionPresentation['"];$/m,
      () => factModule.replace(/^export /gm, ''))
    .replace(/^import \{ CachedBookIdentityResolver \} from .*;$/m, () =>
      readFileSync(resolve(repo, 'entry/src/main/ets/features/common/CachedBookIdentity.ts'), 'utf8').replace(/^import type .*;$/m, ''))
    .replace(/^import \{ errorMessageOf, isDomainResolutionFailure, isNetworkEnvironmentFailure \} from ['"][^'"]*ErrorMessage(\.ts)?['"];$/m,
      () => errorMessageModule)
    .replace(/^import type \{ JsonObject, RequestOptions \} from ['"]@reader\/core-harmony['"];$/m, '')
    .replace(/^import \{ isReaderCoreTransactionPendingError \} from ['"]@reader\/core-harmony['"];$/m,
      `import { isReaderCoreTransactionPendingError } from '${coreSdkUrl}';`)
    .replace(/^import \{ ReaderRuntimeOwner \} from ['"]\.\.\/\.\.\/app\/ReaderRuntimeOwner['"];$/m, '')
    .replace(/^import type \{ ShelfBook \} from ['"]\.\.\/\.\.\/app\/ReaderCoreGateway['"];$/m, '')
    .replace(/^import \{\n(?:  [^\n]+\n)+\} from ['"]\.\/ReaderSourceCategory['"];$/m,
      () => sourceCategoryModule)
    .replace(/^import \{[^\n]+\} from ['"]\.\/SourceSwitchProviderFamily['"];$/m,
      () => providerFamilyModule))
    .replace(/^import \{[^\n]+\} from ['"][^'"]*BookAuthorMetadata(?:\.ts)?['"];?\n/gm, '')
    .replace(/^import \{[^\n]+\} from ['"][^'"]*BookSearchTiming(?:\.ts)?['"];?\n/gm, '')
    .replace(/^import \{[^\n]+\} from ['"]\.\.\/search\/SearchGateway['"];?\n/gm, ''),
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`;
const { SourceSwitchGateway, sourceSwitchCandidateKey, buildSourceSwitchCommitParams, readBookSearchTiming } = await import(moduleUrl);
const providerFamilyUrl = `data:text/javascript;base64,${Buffer.from(`${providerFamilyModule}\nexport { sourceSwitchProviderFamilyKey };`).toString('base64')}`;
const { sourceSwitchProviderFamilyKey } = await import(providerFamilyUrl);
const transactionId = 'ss-core-owned-transaction';

function searchResult(sourceId, books) {
  return { data: { sourceId, books } };
}

assert.notEqual(
  sourceSwitchCandidateKey('a', 'bc'),
  sourceSwitchCandidateKey('ab', 'c'),
  'composite identity must not collapse ambiguous sourceId/bookUrl concatenations',
);
assert.equal(sourceSwitchProviderFamilyKey('七猫小说（优++）', 'https://api-bc.wtzw.com'), 'qimao',
  'qimao rules share a diagnostic family without changing their identities');
assert.notEqual(
  sourceSwitchProviderFamilyKey('Provider A', 'https://shared.example.test'),
  sourceSwitchProviderFamilyKey('Provider B', 'https://shared.example.test'),
  'shared hosts must not manufacture one provider family for unrelated source rules',
);

let activeDiscoveries = 0;
let maxActiveDiscoveries = 0;
const discoveryCalls = [];
const discoveryRuntime = {
  async request(method, params) {
    if (method === 'source.list') {
      assert.equal(params.enabledOnly, true);
      return { data: {
        sources: [
          ...Array.from({ length: 10 }, (_, index) => ({
            sourceId: `candidate-${index}`,
            enabled: true,
          })),
          { sourceId: 'disabled-source', enabled: false },
        ],
      } };
    }
    if (method === 'book.search') {
      assert.equal(params.keyword, 'Current Book');
      assert.equal(params.page, 1);
      assert.equal(params.sourceIds, undefined,
        'each Core search owns one source timeout/error boundary');
      const candidateSourceId = params.sourceId;
      discoveryCalls.push(candidateSourceId);
      activeDiscoveries += 1;
      maxActiveDiscoveries = Math.max(maxActiveDiscoveries, activeDiscoveries);
      const index = Number(candidateSourceId.split('-')[1]);
      try {
        await new Promise((resolve) => setTimeout(resolve, (10 - index) * 2));
        if (candidateSourceId === 'candidate-3') {
          throw new Error('one source timed out');
        }
        return searchResult(candidateSourceId, [{ bookId: `/book/${index}`, title: 'Current Book' }]);
      } finally {
        activeDiscoveries -= 1;
      }
    }
    throw new Error(`unexpected discovery method: ${method}`);
  },
};
const discoveryGateway = new SourceSwitchGateway(discoveryRuntime);
const discovered = await discoveryGateway.discoverCandidates(
  'current-source', 'current-book', 'Current Book', () => true,
);
assert.equal(discovered.kind, 'sources');
assert.equal(discoveryCalls.length, 10);
assert.equal(maxActiveDiscoveries, 8,
  'discovery must be bounded and concurrent instead of one 30s serial batch');
assert.deepEqual(
  discovered.candidates.map((candidate) => candidate.sourceId),
  ['candidate-0', 'candidate-1', 'candidate-2', 'candidate-4', 'candidate-5',
    'candidate-6', 'candidate-7', 'candidate-8', 'candidate-9'],
  'one failed source is skipped and registry order remains stable',
);

// A slow first source cannot hold the ninth source behind an eight-source batch.
{
  let releaseSlow;
  const slow = new Promise(resolve => { releaseSlow = resolve; });
  const started = [];
  const gateway = new SourceSwitchGateway({ request: async (method, params) => {
    if (method === 'source.list') return { data: { sources: Array.from({ length: 12 }, (_, i) =>
      ({ sourceId: `s${i}`, name: `s${i}`, enabled: true })) } };
    const id = params.sourceId; started.push(id);
    if (id === 's0') await slow;
    return searchResult(id, [{ bookId: '/book', title: '鸣龙' }]);
  } });
  const run = gateway.discoverCandidates('original', '/book', '鸣龙');
  for (let i = 0; i < 100 && !started.includes('s11'); i++) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(started.includes('s11'), true, 'fast lanes continue before s0 completes');
  releaseSlow();
  const result = await run;
  assert.deepEqual(result.candidates.map(item => item.sourceId), Array.from({ length: 12 }, (_, i) => `s${i}`));
}
for (const envelope of ['host-diagnostics', 'native-cause']) {
  const requests = [];
  const details = { category: 'NETWORK_ENVIRONMENT', phase: 'route' };
  const environment = new ReaderCoreRequestError({ protocolVersion: 1, type: 'error', requestId: 2,
    error: { code: 'INTERNAL', message: '代理路由失败', retryable: true,
      details: envelope === 'native-cause'
        ? { category: 'NETWORK_ENVIRONMENT', cause: details,
          host: { operationId: 1, requestId: 2, capability: 'http.execute' } }
        : { host: { diagnostics: { details } } } } });
  const gateway = new SourceSwitchGateway({ request: async (method, params) => {
    if (method === 'source.list') return { data: { sources: Array.from({ length: 20 }, (_, i) =>
      ({ sourceId: `proxy${i}`, name: `proxy${i}`, enabled: true })) } };
    requests.push(params.sourceId); throw environment;
  } });
  await assert.rejects(gateway.discoverCandidates('original', '/book', '鸣龙'), error => error === environment);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requests.length, 8, 'environment error propagates and stops dispatch beyond active lanes');
}

// A per-domain DNS rejection is not evidence that every enabled source or the
// device network is unavailable. Exercise the real batch and worker cursor.
for (const envelope of ['host-diagnostics', 'native-cause'])
for (const scenario of ['one-dns', 'all-dns', 'dns-and-empty', 'late-dns']) {
  const requests=[];
  const details={category:'NETWORK_ENVIRONMENT',phase:'dns'};
  const dns=new ReaderCoreRequestError({protocolVersion:1,type:'error',requestId:2,
    error:{code:'INTERNAL',message:'当前网络无法解析书源域名，请检查代理或网络连接后重试',retryable:true,
      details:envelope==='native-cause'
        ? {category:'NETWORK_ENVIRONMENT',cause:details,host:{operationId:1,requestId:2,capability:'http.execute'}}
        : {category:'NETWORK_ENVIRONMENT',host:{diagnostics:{details}}}}});
  const gateway=new SourceSwitchGateway({async request(method,params){
    if(method==='source.list') return {data:{sources:Array.from({length:12},(_,i)=>({sourceId:`dns-${i}`,enabled:true}))}};
    assert.match(params.sourceId,/^dns-\d+$/);assert.equal(params.keyword,'终宋');
    const id=params.sourceId;requests.push(id);
    const fail=scenario==='all-dns'||id===(scenario==='late-dns'?'dns-10':'dns-0');
    if(fail)throw dns;
    return searchResult(id, scenario==='dns-and-empty'?[]:[{bookId:'/book',title:'终宋'}]);
  }});
  if(scenario==='all-dns'||scenario==='dns-and-empty'){
    await assert.rejects(gateway.discoverCandidates('unresolvable-old-source','/old','终宋'),error=>{
      assert.notEqual(error,dns,'aggregate describes this candidate batch, not a single domain as the whole network');
      assert.match(error.message,/本次换源搜索/);assert.match(error.message,/域名解析失败/);return true;
    });
  }else{
    const result=await gateway.discoverCandidates('unresolvable-old-source','/old','终宋');
    assert.equal(result.kind,'sources');assert.equal(result.candidates.length,11);
    assert.ok(result.candidates.some(item=>item.sourceId==='dns-11'),'DNS cannot stop undispatched candidates');
  }
  assert.equal(requests.length,12,'each enabled candidate is tried once, without automatic retries');
}

// A rejected/invalid search is distinct from an admitted empty response. The
// old change.bookSource command hid these errors before the Host could inspect
// them; exercise the same production worker/decoder against book.search DTOs.
for (const envelope of ['direct', 'native-cause', 'host-diagnostics'])
for (const scenario of ['all-http', 'all-rule-failed', 'successful-empty', 'mixed', 'failure-and-empty']) {
  const methods = [], writes = [], published = [];
  const labels = scenario === 'all-http' ? ['http', 'http'] : scenario === 'all-rule-failed' ? ['parse', 'parse'] :
    scenario === 'successful-empty' ? ['empty', 'empty'] : scenario === 'mixed' ? ['http', 'parse', 'empty', 'healthy'] : ['http', 'empty'];
  const query = { sourceId: 'original', bookId: '/book', bookName: '大明望族', author: '府天',
    currentChapterIndex: 325, currentChapterTitle: '第三百二十六章' };
  const owner = { async request(method, params) {
    methods.push(method);
    if (method === 'source.list') return { data: { sources: labels.map((label, index) =>
      ({ sourceId: `${label}-${index}`, name: label, enabled: true, sourceVersion: 'v1' })) } };
    if (method === 'search-book.put') { writes.push(params); return { data: {} }; }
    assert.equal(method, 'book.search'); assert.equal(params.page, 1); assert.equal(params.keyword, query.bookName);
    const label = params.sourceId.split('-')[0];
    if (label === 'http' || label === 'parse') {
      const safe = label === 'http' ? { category: 'SOURCE_HTTP_FAILED', httpStatus: 403 } : { category: 'SOURCE_RULE_FAILED' };
      const details = envelope === 'native-cause' ? { category: safe.category, cause: safe } :
        envelope === 'host-diagnostics' ? { category: safe.category, host: { diagnostics: { details: safe } } } : safe;
      throw new ReaderCoreRequestError({ protocolVersion: 1, type: 'error', requestId: 2,
        error: { code: 'INTERNAL', message: 'private response/URL/cookie must never appear', retryable: false, details } });
    }
    return { data: { sourceId: params.sourceId, sourceVersion: 'v1', contentKind: 'text', books: label === 'healthy' ? [
      { bookId: '/good', title: '大明望族', author: '作者：府天', variables: { token: 'exact continuation' } },
      { bookId: '/other-book', title: '跳出轮回', author: '府天' },
      { bookId: '/other-author', title: '大明望族', author: '另一位作者' },
    ] : [] } };
  } };
  const gw = new SourceSwitchGateway(owner);
  const run = gw.discoverCandidates(query.sourceId, query.bookId, query.bookName, () => true, [], 'text',
    async rows => { published.push(rows); }, query);
  if (scenario === 'all-http' || scenario === 'all-rule-failed' || scenario === 'failure-and-empty') {
    await assert.rejects(run, error => {
      assert.match(error.message, /书源请求或规则执行失败/); assert.match(error.message, /请重试/);
      if (scenario !== 'all-rule-failed') assert.match(error.message, /HTTP 403/);
      assert.doesNotMatch(error.message, /private|response\/URL|cookie/); return true;
    });
  } else {
    const outcome = await run;
    assert.equal(outcome.kind, 'sources');
    assert.equal(outcome.candidates.length, scenario === 'mixed' ? 1 : 0);
    if (scenario === 'mixed') {
      assert.equal(outcome.candidates[0].bookUrl, '/good');
      assert.deepEqual(outcome.candidates[0].searchVariables, [{ name: 'token', value: 'exact continuation' }]);
      assert.equal(outcome.candidates[0].sourceVersion, 'v1');
      assert.equal(outcome.candidates[0].latencyKind, 'search');
      assert.equal(writes.length, 1, 'only the same-book result receives a durable search timing');
      assert.ok(published.some(rows => rows.some(row => row.bookUrl === '/good')),
        'bad sources cannot erase or delay a completed healthy source');
    }
  }
  assert.equal(methods.filter(method => method === 'book.search').length, labels.length);
  assert.equal(methods.includes('change.bookSource'), false);
}
for (const invalid of ['source', 'version', 'media', 'malformed-books']) {
  const owner = { request: async (method) => {
    if (method === 'source.list') return { data: { sources: [{ sourceId: 's', name: 'S', enabled: true, sourceVersion: 'v1' }] } };
    return { data: { sourceId: invalid === 'source' ? 'another' : 's', sourceVersion: invalid === 'version' ? 'v2' : 'v1',
      contentKind: invalid === 'media' ? 'manga' : 'text', books: invalid === 'malformed-books' ? [{ bookId: '', title: '大明望族' }] : [] } };
  } };
  await assert.rejects(new SourceSwitchGateway(owner).discoverCandidates('original', '/book', '大明望族'), /规则执行失败/);
}
for (const late of ['success', 'failure']) {
  let current = true, release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const dispatch = new Promise(resolve => { started = resolve; });
  const published = [], requests = [];
  const owner = { request: async (method, params, options) => {
    requests.push(method);
    if (method === 'source.list') return { data: { sources: [{ sourceId: 's', name: 'S', enabled: true, sourceVersion: 'v1' }] } };
    assert.equal(method, 'book.search'); started(); await gate;
    assert.equal(options.shouldCancel(), true);
    if (late === 'failure') throw Error('late private failure');
    return searchResult(params.sourceId, [{ bookId: '/book', title: '大明望族', author: '府天' }]);
  } };
  const run = new SourceSwitchGateway(owner).discoverCandidates('original', '/book', '大明望族', () => current, [], 'text',
    async rows => { published.push(rows); });
  await dispatch; current = false; release();
  assert.deepEqual(await run, { kind: 'noSources' });
  assert.deepEqual(published, []); assert.equal(requests.includes('search-book.put'), false);
}
console.log('SourceSwitch real book.search HTTP/rule failures, empty/mixed results, shared decoding and late cancellation PASS');

// A cached/known click cannot select a disabled, reclassified or replaced rule.
// Target eligibility uses the same registry read as author qualification.
for (const media of ['text', 'manga']) {
  for (const scenario of ['current', 'stale', 'disabled', 'removed', 'category', 'media', 'invalid-version', 'blank-version']) {
    const category = media === 'manga' ? 'comic' : 'novel';
    const query = { contentKind: media, sourceId: 'old', bookId: '/old', bookName: 'Current Book', author: 'Writer',
      currentChapterIndex: 325, currentChapterTitle: '' };
    const candidate = { sourceId: 'target', sourceVersion: 'v1', category, bookUrl: '/target',
      bookName: query.bookName, author: query.author };
    const target = { sourceId: 'target', name: 'Target', enabled: scenario !== 'disabled',
      sourceVersion: scenario === 'stale' ? 'v2' : scenario === 'invalid-version' ? 42 : scenario === 'blank-version' ? '' : 'v1',
      bookSource: { bookSourceType: media === 'manga' ? 2 : 0 } };
    if (scenario === 'category') candidate.category = 'other';
    if (scenario === 'media') target.bookSource.bookSourceType = media === 'manga' ? 0 : 2;
    const methods = [];
    const owner = { bookAcquisitions: () => ({ sourceRegistryRevision: () => 1 }), request: async method => {
      methods.push(method); assert.equal(method, 'source.list', 'no acquisition or writes during target qualification');
      return { data: { sources: [{ sourceId: 'old', name: 'Old', enabled: true, sourceVersion: 'v1',
        bookSource: { bookSourceType: media === 'manga' ? 2 : 0 } }, ...(scenario === 'removed' ? [] : [target])] } };
    } };
    const gw = new SourceSwitchGateway(owner);
    if (scenario === 'current') assert.equal(await gw.resolveProbeQueryIdentity(query, () => true, candidate), query);
    else await assert.rejects(gw.resolveProbeQueryIdentity(query, () => true, candidate), /候选书源已变更或不可用/);
    assert.deepEqual(methods, ['source.list'], 'target eligibility must not add a per-click source RPC');
  }
}
console.log('SourceSwitch current target version/category/media qualification PASS');

// Restore an author decoration only from the exact current Core row and
// source version. A missing reading session cannot erase this evidence, and
// historical aliases can never authorize a different author or work.
{
  const query = { sourceId: 's', bookId: '/book', bookName: '大明望族', author: '@府天',
    currentChapterIndex: 325, currentChapterTitle: '' };
  const proof = { schemaVersion: 1, sourceVersion: 'v1', field: 'detail', raw: '@府天', label: '府天',
    rule: 'author-nickname-at-v1' };
  const original = JSON.stringify(query);
  const valid = { origin: 's', bookUrl: '/book', name: '大明望族', author: '@府天',
    acquisition: { sourceVersion: 'v1', authorIdentity: proof } };
  for (const scenario of ['valid', 'missing', 'stale', 'wrong-source', 'wrong-url', 'wrong-title', 'raw-mismatch', 'invalid-proof']) {
    let row = structuredClone(valid);
    if (scenario === 'missing') row = null;
    if (scenario === 'stale') { row.acquisition.sourceVersion = 'v0'; row.acquisition.authorIdentity.sourceVersion = 'v0'; }
    if (scenario === 'wrong-source') row.origin = 'another';
    if (scenario === 'wrong-url') row.bookUrl = '/another';
    if (scenario === 'wrong-title') row.name = '跳出轮回';
    if (scenario === 'raw-mismatch') row.author = '@雁九';
    if (scenario === 'invalid-proof') row.acquisition.authorIdentity.raw = '@另一位作者';
    const methods = [];
    const owner = { bookAcquisitions: () => ({ sourceRegistryRevision: () => 1 }), request: async (method, params) => {
      methods.push(method);
      if (method === 'source.list') return { data: { sources: [{ sourceId: 's', name: '小说源', enabled: true, sourceVersion: 'v1' }] } };
      assert.equal(method, 'search-book.get'); assert.deepEqual(params, { origin: 's', bookUrl: '/book' });
      return { data: { book: row } };
    } };
    const gw = new SourceSwitchGateway(owner);
    const result = await gw.resolveProbeQueryIdentity(query, () => true);
    assert.equal(JSON.stringify(query), original, 'recovery must not mutate or strip the original metadata');
    assert.deepEqual(methods, ['source.list', 'search-book.get']);
    if (scenario === 'valid') {
      assert.deepEqual(result, { ...query, authorIdentity: proof, sourceVersion: 'v1' });
      assert.equal(gw.admitsCandidate({ bookName: '大明望族', author: '府天' }, result), true);
      assert.equal(gw.admitsCandidate({ bookName: '跳出轮回', author: '府天' }, result), false);
      assert.equal(gw.admitsCandidate({ bookName: '大明望族', author: '雁九' }, result), false);
    } else assert.equal(result, query, `${scenario} cannot manufacture a proof`);
  }
  for (const scenario of ['plain', 'already-proven', 'disabled', 'removed', 'non-reading', 'book-review']) {
    const currentQuery = scenario === 'plain' || scenario === 'non-reading' ? { ...query, author: '府天' } :
      scenario === 'book-review' ? { ...query, author: '@雁九' } :
      scenario === 'already-proven' ? { ...query, authorIdentity: proof, sourceVersion: 'v1' } : query;
    const methods = [];
    const owner = { bookAcquisitions: () => ({ sourceRegistryRevision: () => 1 }), request: async (method) => {
      methods.push(method); assert.equal(method, 'source.list');
      return { data: { sources: scenario === 'removed' ? [] : [{ sourceId: 's', name: scenario === 'book-review' ? '爱推书君（优）' : '小说源', enabled: scenario !== 'disabled',
        sourceVersion: 'v1', bookSource: { bookSourceType: scenario === 'non-reading' ? 4 : 0 } }] } };
    } };
    const gw = new SourceSwitchGateway(owner);
    if (scenario === 'non-reading' || scenario === 'book-review') await assert.rejects(gw.resolveProbeQueryIdentity(currentQuery), /当前书源提供书评或其他非阅读内容/);
    else assert.equal(await gw.resolveProbeQueryIdentity(currentQuery), currentQuery);
    assert.deepEqual(methods, ['source.list'], 'registry is checked without an unnecessary exact book read');
    if (scenario === 'non-reading' || scenario === 'book-review') {
      await assert.rejects(gw.resolveProbeQueryIdentity(currentQuery), /返回搜索选择小说正文书源/);
      assert.equal(methods.length, 1, 'classification reuses the current source revision snapshot');
    }
  }
  for (const scenario of ['old-proof-missing', 'old-proof-restored', 'old-proof-wrong-author', 'old-proof-wrong-title', 'removed-proof', 'disabled-proof']) {
    const oldProof = { ...proof, sourceVersion: 'old' };
    const currentQuery = { ...query, authorIdentity: oldProof, sourceVersion: 'old' };
    const currentProof = { ...proof, sourceVersion: 'new' };
    let row = { ...valid, acquisition: { sourceVersion: 'new', authorIdentity: currentProof } };
    if (scenario === 'old-proof-missing') row = null;
    if (scenario === 'old-proof-wrong-author') row = { ...row, author: '@雁九', acquisition: { sourceVersion: 'new',
      authorIdentity: { ...currentProof, raw: '@雁九', label: '雁九' } } };
    if (scenario === 'old-proof-wrong-title') row.name = '跳出轮回';
    const methods = [];
    const owner = { bookAcquisitions: () => ({ sourceRegistryRevision: () => 1 }), request: async method => {
      methods.push(method);
      if (method === 'source.list') return { data: { sources: scenario === 'removed-proof' ? [] : [{ sourceId: 's',
        name: '小说源', enabled: scenario !== 'disabled-proof', sourceVersion: 'new' }] } };
      assert.equal(method, 'search-book.get'); return { data: { book: row } };
    } };
    const gw = new SourceSwitchGateway(owner);
    const result = await gw.resolveProbeQueryIdentity(currentQuery);
    const sourceMissing = scenario === 'removed-proof' || scenario === 'disabled-proof';
    if (scenario === 'old-proof-restored') {
      assert.deepEqual(result.authorIdentity, currentProof); assert.equal(result.sourceVersion, 'new');
      assert.equal(gw.admitsCandidate({ bookName: '大明望族', author: '府天' }, result), true);
    } else {
      assert.equal(result.authorIdentity, undefined, 'a caller hash cannot self-certify a stale or missing source');
      assert.equal(result.sourceVersion, sourceMissing ? undefined : 'new');
      assert.equal(result.author, '@府天');
      assert.equal(gw.admitsCandidate({ bookName: '大明望族', author: '府天' }, result), false,
        'an expired proof cannot keep author conversion authorized');
    }
    assert.deepEqual(methods, sourceMissing ? ['source.list'] : ['source.list', 'search-book.get']);
    assert.equal(currentQuery.authorIdentity, oldProof, 'caller facts remain immutable');
  }
  for (const phase of ['registry', 'book'])
  for (const late of ['success', 'failure']) {
    let current = true, release, started;
    const gate = new Promise(resolve => { release = resolve; });
    const dispatch = new Promise(resolve => { started = resolve; });
    const owner = { bookAcquisitions: () => ({ sourceRegistryRevision: () => 1 }), request: async (method) => {
      if ((phase === 'registry' && method === 'source.list') || (phase === 'book' && method === 'search-book.get')) {
        started(); await gate;
        if (late === 'failure') throw Error('retired identity read failed');
      }
      return method === 'source.list' ? { data: { sources: [{ sourceId: 's', name: '小说源', enabled: true, sourceVersion: 'v1' }] } } :
        { data: { book: valid } };
    } };
    const run = new SourceSwitchGateway(owner).resolveProbeQueryIdentity(query, () => current);
    await dispatch; current = false; release(); assert.equal(await run, query);
  }
  for (const phase of ['registry', 'book']) {
    let revision = 1;
    const owner = { bookAcquisitions: () => ({ sourceRegistryRevision: () => revision }), request: async (method) => {
      if ((phase === 'registry' && method === 'source.list') || (phase === 'book' && method === 'search-book.get')) revision++;
      return method === 'source.list' ? { data: { sources: [{ sourceId: 's', name: '小说源', enabled: true, sourceVersion: 'v1' }] } } :
        { data: { book: valid } };
    } };
    await assert.rejects(new SourceSwitchGateway(owner).resolveProbeQueryIdentity(query), /书源配置已变更/);
  }
  const failure = Error('exact cache read unavailable');
  const owner = { request: async method => {
    if (method === 'source.list') return { data: { sources: [{ sourceId: 's', name: '小说源', enabled: true, sourceVersion: 'v1' }] } };
    throw failure;
  } };
  await assert.rejects(new SourceSwitchGateway(owner).resolveProbeQueryIdentity(query), error => error === failure);
}
console.log('SourceSwitch exact author proof restoration, registry eligibility, missing/stale/identity rejection and cancellation fences PASS');

const identityRuntime = {
  async request(method, params) {
    if (method === 'source.list') {
      return { data: { sources: [
        { sourceId: 'current-source', enabled: true },
        { sourceId: 'other-source', enabled: true },
      ] } };
    }
    if (method === 'book.search') {
      if (params.sourceId === 'current-source') {
        return searchResult(params.sourceId, [
          { bookId: 'current-book', title: 'Current Book' },
          { bookId: 'current-book', title: 'Current Book' },
          { bookId: 'alternate-book', title: 'Current Book' },
        ]);
      }
      return searchResult(params.sourceId, [
        { bookId: 'other-book', title: 'Current Book' },
        { bookId: 'other-book', title: 'Current Book' },
      ]);
    }
    throw new Error(`unexpected identity method: ${method}`);
  },
};
const identityGateway = new SourceSwitchGateway(identityRuntime);
const identityDiscovery = await identityGateway.discoverCandidates(
  'current-source', 'current-book', 'Current Book', () => true,
);
assert.equal(identityDiscovery.kind, 'sources');
assert.deepEqual(
  identityDiscovery.candidates.map((candidate) =>
    sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl)),
  [
    sourceSwitchCandidateKey('current-source', 'current-book'),
    sourceSwitchCandidateKey('current-source', 'alternate-book'),
    sourceSwitchCandidateKey('other-source', 'other-book'),
  ],
  'only exact (sourceId, bookUrl) duplicates are removed and first-seen order is retained',
);
assert.deepEqual(
  identityDiscovery.candidates.map((candidate) => candidate.isCurrent),
  [true, false, false],
  'current status must use exact composite identity so same-source alternate URLs stay selectable',
);

// Core supplies one indexed relation, not an unfiltered historical library.
function relatedData(books, extra = {}) {
  return { books: books.map(book => ({...book, relationKey: 'relation', relationRevision: '1'})),
    sourceVersions: [...new Set(books.map(book => book.origin))].map(sourceId => ({sourceId, sourceVersion: 'v1', enabled: true})),
    snapshotRevision: 'snapshot', complete: true, ...extra };
}

const cacheCalls = [];
const cachedAt = Date.now();
const cacheRuntime = {
  async request(method, params) {
    cacheCalls.push([method, params]);
    if (method === 'source.list') {
      return { data: { sources: [
        { sourceId: 'cache-source', name: '缓存书源', enabled: true },
        { sourceId: 'disabled-source', name: '停用书源', enabled: false },
      ] } };
    }
    if (method === 'search-book.related') {
      return { data: relatedData([
        {
          bookUrl: 'current-book', origin: 'cache-source', originName: '缓存书源',
          name: 'Current Book', author: 'Writer', time: cachedAt, originOrder: 2,
          latestChapterTitle: 'Chapter 20', chapterWordCountText: '[5] Chapter 5\n字数：1234',
          chapterWordCount: 1234, respondTime: 88,
        },
        {
          bookUrl: 'expired-book', origin: 'cache-source', originName: '缓存书源',
          name: 'Current Book', author: 'Writer', time: cachedAt - 25 * 60 * 60 * 1000,
          chapterWordCount: -1, respondTime: -1,
        },
        {
          bookUrl: 'disabled-book', origin: 'disabled-source', originName: '停用书源',
          name: 'Current Book', author: 'Writer', time: cachedAt,
          chapterWordCount: -1, respondTime: -1,
        },
        {
          bookUrl: 'same-name-other-author', origin: 'cache-source', originName: '缓存书源',
          name: 'Current Book', author: 'Other Person', time: cachedAt,
          chapterWordCount: 456, respondTime: 77,
        },
        { bookUrl: 'other-book', origin: 'cache-source', name: 'Other Book', time: cachedAt },
      ].filter(book => book.origin === 'cache-source' && book.name === 'Current Book' && book.author === 'Writer')) };
    }
    if (method === 'search-book.delete') {
      assert.equal(params.bookUrl, 'expired-book');
      return { data: { bookUrl: params.bookUrl, deleted: true } };
    }
    throw new Error(`cache-first path unexpectedly called ${method}`);
  },
};
const cacheGateway = new SourceSwitchGateway(cacheRuntime);
const cachedCandidates = await cacheGateway.loadCachedCandidates({
  sourceId: 'cache-source',
  bookId: 'current-book',
  bookName: 'Current Book',
  author: 'Writer',
  currentChapterIndex: 4,
  currentChapterTitle: 'Chapter 5',
});
assert.equal(cachedCandidates.length, 2);
assert.equal(cachedCandidates[1].acquisitionState, 'stale');
assert.equal(cacheCalls.some(([method]) => method === 'search-book.delete'), false, 'expired candidates retain their last successful information');
assert.equal(cachedCandidates[0].sourceName, '缓存书源');
assert.equal(cachedCandidates[0].latencyMs, undefined, 'legacy body respondTime is not current source-search latency');
assert.equal(cachedCandidates[0].latencyKind, undefined);
assert.equal(cachedCandidates[0].currentChapterIndex, 4);
assert.equal(cachedCandidates[0].currentChapterTitle, 'Chapter 5');
assert.equal(cachedCandidates[0].isCurrent, true);
assert.equal(cacheCalls.some(([method]) => method === 'book.search'), false,
  'a valid local projection must not start source HTTP discovery');

// Only the version-bound Core acquisition fact restores search timing after a
// pane remount; legacy respondTime remains intentionally ignored.
{
  const timingRuntime = { request: async (method) => {
    if (method === 'source.list') return { data: { sources: [{ sourceId: 'timed', name: 'Timed',
      enabled: true, sourceVersion: 'v1' }] } };
    return { data: relatedData([{ origin: 'timed', bookUrl: '/book', name: 'Current Book', author: 'Writer',
      time: cachedAt, acquisition: { sourceVersion: 'v1', searchTiming: {
        kind: 'search', sourceVersion: 'v1', durationMs: 321, measuredAt: cachedAt,
      } }, respondTime: 9999 }]) };
  } };
  const timed = await new SourceSwitchGateway(timingRuntime).loadCachedCandidates({ sourceId: 'timed', bookId: '/book',
    bookName: 'Current Book', author: 'Writer', currentChapterIndex: 0, currentChapterTitle: '' });
  assert.equal(timed[0].latencyMs, 321);
  assert.equal(timed[0].latencyKind, 'search');
  assert.equal(timed[0].latencyMeasuredAt, cachedAt);
}

// The indexed relation is only a scoped read: historical alias bridges may
// have been polluted by a source resolving another book at the same URL.
{
  const calls = [];
  const rows = [{origin:'cache-source',bookUrl:'current-book',name:'Current Book',author:'Writer',time:cachedAt},
    {origin:'cache-source',bookUrl:'normalized',name:' current   BOOK ',author:'作者：Writer',time:cachedAt},
    {origin:'cache-source',bookUrl:'renamed',name:'Old 15',author:'Writer',time:cachedAt,
      acquisition:{sourceVersion:'v1',aliases:[{name:'Current Book',author:'Writer'}]}}];
  const gateway = new SourceSwitchGateway({request:async(method,params)=> {
    calls.push({method,params});
    if(method==='source.list') return {data:{sources:[{sourceId:'cache-source',name:'缓存',enabled:true}]}};
    assert.equal(method,'search-book.related');
    assert.deepEqual(params.identity,{sourceId:'cache-source',bookId:'current-book'});
    assert.equal(params.name,'Current Book'); assert.equal(params.author,'Writer'); assert.equal(params.limit,128);
    return {data:relatedData(rows)};
  }});
  const result = await gateway.loadCachedCandidates({sourceId:'cache-source',bookId:'current-book',bookName:'Current Book',
    author:'Writer',currentChapterIndex:0,currentChapterTitle:'One'});
  assert.deepEqual(result.map(row=>row.bookUrl).sort(),['current-book','normalized'],
    'current title/author normalization is sufficient; historical alias JSON cannot authorize an unrelated title');
  assert.deepEqual(calls.map(call=>call.method),['source.list','search-book.related']);
}

const refreshRows = [{ bookUrl: 'old-book', origin: 'old-source', name: 'Current Book', author: 'Writer', time: cachedAt }];
const refreshCalls = [];
let preparation;
const refreshRuntime = {
  bookAcquisitions: () => ({ sourceRegistryRevision: () => 1, prepare: (seeds, refresh) => { preparation = { seeds, refresh }; } }),
  async request(method, params) {
    refreshCalls.push(method);
    if (method === 'search-book.related') return { data: relatedData(refreshRows) };
    if (method === 'source.list') return { data: { sources: [
      { sourceId: 'fresh-source', name: '新书源', enabled: true },
      { sourceId: 'old-source', name: '已有书源', enabled: true },
    ] } };
    if (method === 'book.search') {
      if (params.sourceId === 'old-source') throw new Error('old source currently offline');
      // Core book.search publishes candidates before returning discovery.
      refreshRows.push({ bookUrl: 'fresh-book', origin: 'fresh-source', name: 'Current Book', author: 'Writer', time: cachedAt });
      return searchResult(params.sourceId, [{ bookId: 'fresh-book', title: 'Current Book', author: 'Writer' }]);
    }
    throw new Error(`refresh must not delete successes or block on probing: ${method}`);
  },
};
const refreshed = await new SourceSwitchGateway(refreshRuntime).refreshCandidates({
  sourceId: 'old-source', bookId: 'old-book', bookName: 'Current Book', author: 'Writer',
  currentChapterIndex: 0, currentChapterTitle: '', // directory failure must not block browsing
});
assert.equal(refreshed.kind, 'sources');
assert.equal(refreshed.candidates.length, 2, 'partial refresh failure retains the old source');
assert.equal(preparation, undefined, 'discovery must not enqueue unbounded catalog/body acquisition');
assert.equal(refreshCalls.some(method => ['search-book.delete', 'book.detail', 'book.toc', 'chapter.content'].includes(method)), false,
  'explicit discovery returns candidates; catalog preparation belongs to the visible viewport');

// Exercise the real Host → Gateway refresh path with independently completing
// sources. The list contains successful same-book results, never dispatch or
// failure placeholders; a previous successful search remains usable even if
// its new search attempt fails.
{
  const f = sourceOwnerFixture({ open: false });
  const requests = [];
  const rows = [{ ...rawSourceRow('new', 'target'), latestChapterTitle: 'Chapter 20' }];
  let releaseFast, releaseSlow;
  const fast = new Promise(resolve => { releaseFast = resolve; });
  const slow = new Promise(resolve => { releaseSlow = resolve; });
  const original = f.runtime.request.bind(f.runtime);
  f.runtime.request = async (method, params, options) => {
    requests.push({ method, params });
    if (method === 'source.list') return { data: { sources:
      ['old', 'new', 'fast', 'slow', 'empty', 'broken'].map(sourceId =>
        ({ sourceId, name: sourceId, enabled: true, sourceVersion: 'v1' })) } };
    if (method === 'search-book.related') return { data: relatedData(rows) };
    if (method === 'search-book.batch.get') {
      const books = [];
      const missing = [];
      for (const identity of params.identities) {
        const row = rows.find(item => item.origin === identity.sourceId && item.bookUrl === identity.bookId);
        if (row === undefined) missing.push(identity);
        else books.push({ ...row, relationKey: 'relation', relationRevision: '1' });
      }
      return { data: { complete: true, books, missing } };
    }
    if (method === 'book.search') {
      const sourceId = params.sourceId;
      if (sourceId === 'new' || sourceId === 'broken') throw Error('source search failed');
      if (sourceId === 'old' || sourceId === 'empty') return searchResult(sourceId, []);
      await (sourceId === 'fast' ? fast : slow);
      const row = rawSourceRow(sourceId, `${sourceId}-book`);
      rows.push(row);
      return searchResult(sourceId, [{ bookId: row.bookUrl, title: row.name, author: row.author }]);
    }
    return original(method, params, options);
  };
  const waitUntil = async predicate => {
    for (let turn = 0; turn < 100 && !predicate(); turn++) await new Promise(setImmediate);
    assert.equal(predicate(), true, 'the actual refresh must publish the expected state');
  };
  assert.equal(f.host.open(f.context, f.lease), true);
  await waitUntil(() => f.host.current().state.kind === 'candidates' &&
    f.host.current().state.refreshing === false);
  assert.deepEqual(f.host.current().state.candidates.map(row => row.sourceId), ['new']);
  assert.equal(f.host.current().state.candidates[0].latencyMs, undefined,
    'a cached successful result does not need a new search timing to enter the list');
  const refreshStart = requests.length;
  f.host.refresh(f.host.current().scopeId);
  await waitUntil(() => requests.filter(row => row.method === 'book.search').length === 6);
  assert.equal(f.host.current().state.refreshing, true);
  assert.deepEqual(f.host.current().state.candidates.map(row => row.sourceId), ['new'],
    'pending, empty and failed searches do not create rows');
  releaseFast();
  await waitUntil(() => f.host.current().state.candidates?.some(row => row.sourceId === 'fast'));
  assert.equal(f.host.current().state.refreshing, true,
    'the first success appears while an independent source search is still running');
  assert.deepEqual(new Set(f.host.current().state.candidates.map(row => row.sourceId)), new Set(['new', 'fast']));
  releaseSlow();
  // refreshCandidates coalesces source completions on a 100ms debounce;
  // allow that timer and the final relation verification to settle.
  await new Promise(resolve => setTimeout(resolve, 150));
  await waitUntil(() => f.host.current().state.kind === 'candidates' &&
    f.host.current().state.refreshing === false);
  assert.deepEqual(new Set(f.host.current().state.candidates.map(row => row.sourceId)), new Set(['new', 'fast', 'slow']));
  assert.equal(f.host.current().state.candidates.some(row => ['old', 'empty', 'broken'].includes(row.sourceId)), false,
    'finished searches without a successful same-book result remain absent');
  assert.equal(requests.some(row => ['book.detail', 'book.toc', 'chapter.content', 'search-book.delete'].includes(row.method)), false,
    'browsing progressive search results does not pre-acquire content or delete prior successes');
  assert.equal(requests.filter(row => row.method === 'book.search').length, 6,
    'one explicit refresh dispatches each enabled source once');
  const refreshMethods = requests.slice(refreshStart).map(row => row.method);
  assert.equal(refreshMethods.filter(method => method === 'search-book.related').length, 2,
    'refresh performs one initial and one final complete relation verification');
  assert.equal(refreshMethods.filter(method => method === 'search-book.batch.get').length, 1,
    'source completions share one debounced batch identity projection');
  f.host.retire();

  function rawSourceRow(sourceId, bookUrl) {
    return { origin: sourceId, bookUrl, name: 'Book', author: 'Writer', time: Date.now(),
      relationKey: 'same-book', relationRevision: '1', sourceVersion: 'v1' };
  }
}
console.log('PASS: successful results appear progressively; failed/empty searches stay absent and cached successes remain');

const runtime = {
  async request(method, params) {
    if (method === 'source.switch.commit') {
      return { data: {
        book: {
          sourceId: 'new', bookId: 'new-book', title: 'Book', author: 'Author', addedAt: 1,
        },
        matchedChapter: {
          chapterId: '/chapter/4', chapterTitle: 'Chapter 4', chapterUrl: '/chapter/4', order: 4,
        },
        transactionId,
        phase: 'pending',
      } };
    }
    if (method === 'source.switch.rollback') {
      assert.strictEqual(params.transactionId, transactionId,
        'rollback must echo only the opaque Core transaction id');
      return { data: {
        transactionId,
        phase: 'rolledBack',
        changed: true,
        restoredBook: {
          sourceId: 'old', bookId: 'old-book', title: 'Book', author: 'Author', addedAt: 1,
        },
      } };
    }
    if (method === 'source.switch.pending.list') {
      return { data: { pending: [{
        transactionId,
        phase: 'pending',
        from: { sourceId: 'old', bookId: 'old-book' },
        target: { sourceId: 'new', bookId: 'new-book' },
      }] } };
    }
    throw new Error(`unexpected method: ${method}`);
  },
};
const liveGateway = new SourceSwitchGateway(runtime);
const committed = await liveGateway.commitSwitch({
  from: { sourceId: 'old', bookId: 'old-book' },
  target: { sourceId: 'new', bookId: 'new-book', title: 'Book' },
  newToc: [{ chapterId: '/chapter/4', chapterTitle: 'Chapter 4', chapterUrl: '/chapter/4', order: 4 }],
  currentChapterTitle: 'Chapter 4',
  currentChapterIndex: 4,
  updatedAt: 1,
});
assert.equal(committed.status, 'success');
assert.strictEqual(committed.transactionId, transactionId);
assert.equal(committed.matchedChapter.order, 4);
// A processing-context failure may preserve only the verified durable chapter
// index. Forward the absent title honestly; do not invent a chapter or offset.
{
  const received=[];
  const coarseGateway=new SourceSwitchGateway({request:async(method,params)=>{
    received.push({method,params});return runtime.request(method,params);
  }});
  const params={from:{sourceId:'old',bookId:'old-book'},target:{sourceId:'new',bookId:'new-book',title:'Book'},
    newToc:[{chapterId:'/chapter/4',chapterTitle:'Chapter 4',chapterUrl:'/chapter/4',order:4}],
    currentChapterTitle:'',currentChapterIndex:4,updatedAt:1};
  await coarseGateway.commitSwitch(params);
  assert.equal(received.length,1);assert.equal(received[0].params.currentChapterTitle,'');
  assert.equal(received[0].params.currentChapterIndex,4);
  assert.equal('chapterOffset' in received[0].params,false);
  await assert.rejects(coarseGateway.commitSwitch({...params,currentChapterTitle:undefined}),/must be a string/);
  await assert.rejects(coarseGateway.commitSwitch({...params,currentChapterIndex:-1}),/non-negative/);
  assert.equal(received.length,1,'invalid anchors cannot reach the transaction');
}
const rolledBack = await liveGateway.rollbackSwitch(committed.transactionId);
assert.equal(rolledBack.changed, true);
assert.equal(rolledBack.restoredBook.sourceId, 'old');
const pending = await liveGateway.listPendingSwitches();
assert.deepEqual(pending.map((entry) => [entry.transactionId, entry.fromBookId, entry.targetBookId]), [
  [transactionId, 'old-book', 'new-book'],
]);

console.log('source-switch gateway contract: PASS');

// PH70: entry reuses exact candidates already emitted by Search even if the
// durable projection has not arrived; no second source sweep is permitted.
{
  const calls=[];let revision=1;
  const records=new Map();
  const owner={bookAcquisitions:()=>({sourceRegistryRevision:()=>revision}),request:async(method,params)=>{
    calls.push({method,params});
    if(method==='source.list')return {data:{sources:[{sourceId:'a',name:'A',enabled:true,sourceVersion:'v1'},{sourceId:'b',name:'B',enabled:revision===1,sourceVersion:'v1'}]}};
    if(method==='search-book.related')return {data:relatedData([...records.values()].filter(book=>book.origin!=='b'||revision===1))};
    if(method==='search-book.batch.get')return {data:{books:[],missing:params.identities,complete:true}};
    throw Error(`cached switch entry must not perform ${method}`);
  }};
  const gateway=new SourceSwitchGateway(owner);
  const query={sourceId:'a',bookId:'/book',bookName:'鸣龙',author:'关关公子',currentChapterIndex:0,currentChapterTitle:''};
  const known=['a','b'].map(sourceId=>({sourceId,sourceVersion:'v1',bookUrl:'/book',bookName:'鸣龙',author:'关关公子',category:'novel',acquisitionState:'discovered',searchVariables:[{name:'token',value:'carry'}]}));
  const first=await gateway.loadCachedCandidates(query,()=>true,known);
  assert.deepEqual(first.map(c=>c.sourceId),['a','b']);assert.equal(first[1].searchVariables[0].value,'carry');
  const row={origin:'b',bookUrl:'/book',name:'鸣龙',author:'关关公子',variable:'{}',time:Date.now(),acquisition:{sourceVersion:'v1',catalogCount:1,catalogAt:Date.now()}};
  records.set('b',row);calls.length=0;
  const next=await gateway.loadCachedCandidates(query,()=>true,known,{reset:false,identities:[{sourceId:'b',bookId:'/book'},{sourceId:'b',bookId:'/book'}]});
  assert.deepEqual(calls.map(c=>c.method),['search-book.related','search-book.batch.get'],'dirty relation reads only its indexed scope without full DB/source scan');
  assert.equal(next.find(c=>c.sourceId==='b').acquisitionState,'catalogReady');
  revision++;calls.length=0;
  const replaced=await gateway.loadCachedCandidates(query,()=>true,known,{reset:true,identities:[]});
  assert.deepEqual(replaced.map(c=>c.sourceId),['a'],'disabled source cannot be revived by a known row');
  assert.deepEqual(calls.map(c=>c.method),['source.list','search-book.related','search-book.batch.get']);
}
// Missing-candidate discovery excludes sources already dispatched by this
// exact search session; an explicit refresh (no exclusions) checks all again.
{
  const searched=[];const owner={request:async(method,params)=>{
    if(method==='source.list')return{data:{sources:['a','b','c'].map(sourceId=>({sourceId,name:sourceId,enabled:true}))}};
    assert.equal(method,'book.search');searched.push(params.sourceId);return searchResult(params.sourceId,[]);
  }};const gateway=new SourceSwitchGateway(owner);
  await gateway.discoverCandidates('a','/book','鸣龙',()=>true,['a','b']);assert.deepEqual(searched,['c']);
  searched.length=0;await gateway.discoverCandidates('a','/book','鸣龙',()=>true);assert.deepEqual(searched,['a','b','c']);
}
console.log('PH70 known candidate first paint, delta projection, registry deletion and missing-only discovery PASS');
{
  let release;const sourceGate=new Promise(r=>release=r);const calls=[];let listener;
  const owner={bookAcquisitions:()=>({sourceRegistryRevision:()=>1,subscribe:fn=>{listener=fn;return()=>{}}}),request:async(method,params)=>{
    calls.push(method);
    if(method==='source.list'){await sourceGate;return{data:{sources:['a','b'].map(sourceId=>({sourceId,name:sourceId,enabled:true,sourceVersion:'v1'}))}}}
    if(method==='search-book.related')return{data:relatedData([])};
    if(method==='search-book.batch.get')return{data:{books:[],missing:params.identities,complete:true}};
    throw Error(`entry must not re-search known candidates: ${method}`);
  }};
  const gateway=new SourceSwitchGateway(owner);
  const query={sourceId:'a',bookId:'/book',bookName:'鸣龙',author:'关关公子',currentChapterIndex:0,currentChapterTitle:''};
  const Index=productionMotionMethods(resolve(repo,'entry/src/main/ets/pages/Index.ets'), ['knownSearchSourceCandidates'], {searchCandidateRank,readBookSearchTiming});
  const page=Object.assign(new Index(),{detailReturnRoute:'search',sourceSwitchState:{kind:'discovering'},
    searchDetailCandidates:['a'].map(sourceId=>({sourceId,sourceName:sourceId,sourceRuleVersion:'v1',
      bookId:'/book',title:'鸣龙',author:'关关公子',variables:[],category:'novel'}))});
  const f=sourceOwnerFixture({open:false});owner.getUIAbilityContext=f.runtime.getUIAbilityContext;setCurrentRuntime(owner);
  const host=new f.Constructor(owner);host.open({query,inBookshelf:false,toc:[],knownCandidates:page.knownSearchSourceCandidates(query),readKnownCandidates:()=>page.knownSearchSourceCandidates(query),searchedSourceIds:[]},
    {isCurrent:()=>true,changed:snapshot=>{page.sourceSwitchState=snapshot.state;},effect(){}});
  // Intent authority admission happens first; known rows still paint before registry/cache RPC completes.
  for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));
  assert.equal(page.sourceSwitchState.kind,'candidates');assert.equal(page.sourceSwitchState.candidates.length,1,
    'known Search group paints before registry/cache I/O completes after intent authority admission');
  page.searchDetailCandidates.push({sourceId:'b',sourceName:'b',sourceRuleVersion:'v1',bookId:'/book',title:'鸣龙',author:'关关公子',variables:[],category:'novel'});
  listener({reset:false,identities:[{sourceId:'b',bookId:'/book'}]});
  assert.deepEqual(calls,['source.list'],'late candidate waits behind initial cache I/O');
  release();for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));
  assert.equal(page.sourceSwitchState.candidates.length,2);
  assert.deepEqual(calls.slice(0,3),['source.list','search-book.related','search-book.batch.get']);
  assert.ok(calls.includes('book.search') || calls.includes('search-book.related'),
    'the seeded candidates continue through the real incremental refresh path');
}
console.log('PH70 actual Index candidate projection → feature owner entry paints known candidates before cache RPC PASS');

// PH70 retry ownership: a failed consumed batch remains pending until a later
// real event; it must be unioned with that event rather than silently lost.
for (const reset of [false, true]) {
  let listener; let fail = false;
  const calls = [];
  const rows = new Map(['a', 'b'].map(sourceId => [sourceId, { origin: sourceId,
    bookUrl: '/book', name: '鸣龙', author: '关关公子', time: Date.now(),
    acquisition: { sourceVersion: 'v1', catalogCount: 1, catalogAt: Date.now() } }]));
  const owner = { bookAcquisitions: () => ({ sourceRegistryRevision: () => 1,
    subscribe: fn => { listener = fn; return () => {}; } }), request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'source.list') return { data: { sources: ['a', 'b'].map(sourceId =>
      ({ sourceId, name: sourceId, enabled: true, sourceVersion: 'v1' })) } };
    if (fail && method === 'search-book.related') {
      fail = false; throw Error('one transient projection failure');
    }
    if (method === 'search-book.related') return { data: relatedData([...rows.values()]) };
    if (method === 'search-book.get') return { data: { book: rows.get(params.origin) } };
    throw Error(`unexpected source discovery request: ${method}`);
  } };
  const gateway = new SourceSwitchGateway(owner);
  const query = { sourceId: 'a', bookId: '/book', bookName: '鸣龙', author: '关关公子',
    currentChapterIndex: 0, currentChapterTitle: '' };
  const page={sourceSwitchState:{kind:'discovering'}};
  const f=sourceOwnerFixture({open:false});owner.getUIAbilityContext=f.runtime.getUIAbilityContext;setCurrentRuntime(owner);
  const host=new f.Constructor(owner);
  host.open({query,inBookshelf:false,toc:[],knownCandidates:[],searchedSourceIds:[]},
    {isCurrent:()=>true,changed:snapshot=>{page.sourceSwitchState=snapshot.state;},effect(){}});
  const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r)); };
  await settle(); calls.length = 0;
  fail = true;
  listener({ reset, identities: [{ sourceId: 'a', bookId: '/book' }] }); await settle();
  const failedCalls = calls.length;
  await settle();
  assert.equal(calls.length, failedCalls, 'failure alone must not create an automatic retry loop');
  calls.length = 0;
  listener({ reset: false, identities: [{ sourceId: 'b', bookId: '/book' }] }); await settle();
  assert.ok(calls.filter(c => c.method === 'search-book.related').length <= 1,
    'a later event performs at most one complete affected relation retry, without an all-library scan');
  assert.equal(calls.filter(c => c.method === 'source.list').length, 0,
    'a later event never reloads the source registry');
  assert.equal(page.sourceSwitchState.kind, 'candidates');
  assert.equal(page.sourceSwitchState.candidates.length, 2);
}
console.log('PH70 actual SourceSwitchHost/Gateway retain failed delta/reset without automatic retry loops PASS');

// Retiring a sweep must release debounce waiters and subscriptions even when
// the Core RPC ignores shouldCancel and never returns until explicitly drained.
for (const phase of ['debounce', 'in-flight']) {
  let current = true, listener, released = 0, batchStarted, drainBatch;
  const started = new Promise(resolve => { batchStarted = resolve; });
  const batch = new Promise(resolve => { drainBatch = resolve; });
  const progress = [];
  const candidate = { sourceId: 'a', bookUrl: '/book', bookName: '鸣龙', author: '关关公子',
    category: 'novel', sourceVersion: 'v1' };
  const owner = {
    bookAcquisitions: () => ({ sourceRegistryRevision: () => 1,
      subscribe: fn => { listener = fn; return () => { released++; }; } }),
    request: async (method, params) => {
      if (method === 'source.list') return { data: { sources: [
        { sourceId: 'a', name: 'A', enabled: true, sourceVersion: 'v1' },
      ] } };
      assert.equal(method, 'search-book.batch.get');
      batchStarted();
      await batch; // Deliberately ignore shouldCancel to test waiter release.
      return { data: { books: [], missing: params.identities, complete: true } };
    },
  };
  const gateway = new SourceSwitchGateway(owner);
  gateway.loadCachedCandidates = async () => [];
  gateway.discoverCandidates = async (_source, _book, _keyword, _current, _excluded, _kind, completed) => {
    await completed([candidate]);
    return { kind: 'sources', candidates: [candidate] };
  };
  const run = gateway.refreshCandidates({ sourceId: 'a', bookId: '/book', bookName: '鸣龙', author: '关关公子',
    currentChapterIndex: 0, currentChapterTitle: '' }, () => current, [], rows => progress.push(rows));
  for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve));
  listener({ reset: false, identities: [{ sourceId: 'a', bookId: '/book' }] });
  if (phase === 'in-flight') await started;
  const published = progress.length;
  current = false;
  let timeout;
  const outcome = await Promise.race([run, new Promise((_, reject) => {
    timeout = setTimeout(() => reject(Error(`cancelled ${phase} flush did not settle`)), 500);
  })]).finally(() => clearTimeout(timeout));
  assert.equal(outcome.kind, 'noSources');
  assert.equal(released, 1, `${phase} cancellation releases its acquisition subscription`);
  listener({ reset: true, identities: [] });
  drainBatch();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(progress.length, published, 'retired subscriptions and late RPCs cannot publish');
}
console.log('SourceSwitch debounce/in-flight cancellation settles waiters and releases subscriptions PASS');

// Manga relations use the dedicated Core candidate projection so a durable
// current book cannot be mistaken for an alternate source.
{
  let relationParams;
  const owner = { request: async (method, params) => {
    if (method === 'source.list') return { data: { sources: [
      { sourceId: 'comic', name: '漫画源', enabled: true, sourceVersion: 'v1', bookSource: { bookSourceType: 2 } },
    ] } };
    relationParams = params;
    return { data: relatedData([{ origin: 'comic', bookUrl: '/book', name: '漫画', author: '作者',
      acquisition: { sourceVersion: 'v1', catalogCount: 1, catalogAt: Date.now() } }]) };
  } };
  const result = await new SourceSwitchGateway(owner).loadCachedCandidates({ contentKind: 'manga',
    sourceId: 'comic', bookId: '/book', bookName: '漫画', author: '作者', currentChapterIndex: 0, currentChapterTitle: '' });
  assert.equal(result.length, 1);
  assert.equal(relationParams.mode, 'mangaCandidates');
}
console.log('SourceSwitch manga candidate relation mode PASS');

// Complete relation pages own membership; late/truncated/mixed snapshots never publish.
{
  const query={sourceId:'a',bookId:'one',bookName:'鸣龙',author:'关关公子',currentChapterIndex:0,currentChapterTitle:''};
  const a={origin:'a',bookUrl:'one',name:'鸣龙',author:'关关公子',time:Date.now(),variable:'{"token":" opaque & = ","page":"2"}',
    acquisition:{schemaVersion:2,sourceVersion:'v1',catalogCount:1,catalogAt:Date.now(),readableAt:Date.now(),verificationCurrent:true,readableChapterUrl:'/2'}};
  const b={...a,origin:'b',bookUrl:'two'};
  let mode='normal',attempts=0;
  const owner={request:async(method,params)=>{
    if(method==='source.list')return{data:{sources:['a','b'].map(sourceId=>({sourceId,name:sourceId,enabled:true,sourceVersion:'v1'}))}};
    assert.equal(method,'search-book.related');
    if(!params.cursor) {
      attempts++;
      if(mode==='gone')return{data:relatedData([a])};
      return{data:relatedData([a],{complete:false,nextCursor:'p2'})};
    }
    if(mode==='retry'&&attempts===1)throw Object.assign(Error('stale'),{details:{reason:'CURSOR_STALE'}});
    if(mode==='loop')return{data:relatedData([b],{complete:false,nextCursor:'p2'})};
    if(mode==='bad')return{data:relatedData([b],{snapshotRevision:'newer'})};
    if(mode==='version')return{data:relatedData([b],{sourceVersions:[{sourceId:'b',enabled:true,sourceVersion:'v2'}]})};
    return{data:relatedData([b])};
  }};
  const gateway=new SourceSwitchGateway(owner);
  const first=await gateway.loadCachedCandidates(query);
  assert.deepEqual(first.map(c=>c.sourceId),['a','b']);
  assert.equal(first[0].acquisitionState,'readable');assert.equal(first[0].searchVariables[0].value,' opaque & = ');
  for(const failure of ['loop','bad','version']){mode=failure;await assert.rejects(gateway.loadCachedCandidates(query));}
  mode='retry';attempts=0;assert.equal((await gateway.loadCachedCandidates(query)).length,2);assert.equal(attempts,2);
  mode='gone';assert.equal((await gateway.loadCachedCandidates(query)).length,1);
  // A formerly persisted identity cannot be resurrected by an old Search seed after deletion.
  const original=owner.request;
  owner.request=async(method,params)=>method==='search-book.batch.get'?{data:{complete:true,books:[],missing:params.identities}}:original(method,params);
  assert.equal((await gateway.loadCachedCandidates(query,undefined,first)).length,1);
}
console.log('R5 SourceSwitch relation pagination, stale retry, continuation, scoped verdict and deletion preservation PASS');

// PH116: source selection hands the acquired target context to the reader and
// commits resolved metadata, never an old search alias or a different URL.
{
  const calls = [];
  const session = { acquisitionMode: 'online', identity: { sourceId: 'target', bookId: '/book' },
    sourceVersion: 'rule-v2', catalogAt: 42, catalogVersion: 'catalog-v2', contextVersion: 'context-v2',
    detailUrl: '/book', tocUrl: '/catalog', hostRequirements: ['httpExecute'],
    book: { title: '详情规范书名', author: '详情作者', coverUrl: '/new-cover', intro: '详情简介', kind: '历史', lastChapter: '第二十章' },
    continuationVariables: [{ name: 'token', value: 'exact & token' }],
    entries: [{ index: 0, title: '第一章', url: '/chapter', variables: [{ name: 'page', value: '1' }] }] };
  const owner = { request: async (method, params) => {
    calls.push(method); assert.equal(method, 'search-book.get');
    assert.deepEqual(params, { origin: 'target', bookUrl: '/book' });
    return { data: { book: { name: '持久化详情名', author: '持久化作者' } } };
  }, bookAcquisitions: () => ({ acquireBook: async (seed, options) => {
    calls.push('acquireBook'); assert.equal(seed.title, '持久化详情名'); assert.equal(options.isCurrent(), true);
    return session;
  } }) };
  const toc = await new SourceSwitchGateway(owner).fetchTargetToc('target', '/book', () => true);
  assert.equal(toc.readingSession, session, 'preserve the exact catalog proof and continuation for the existing reader');
  assert.deepEqual(calls, ['search-book.get', 'acquireBook'], 'source switch must not refetch the already acquired session');
  assert.deepEqual(toc.variables, { token: 'exact & token' });
  assert.deepEqual(toc.entries[0].variables, { page: '1' });
  const candidate = { sourceId: 'target', bookUrl: '/book', bookName: '搜索旧别名', author: '旧作者', coverUrl: '/old-cover' };
  const params = buildSourceSwitchCommitParams({ sourceId: 'original', bookId: '/old' }, candidate, toc, '第一章', 0, 42);
  assert.deepEqual(params.target, { sourceId: 'target', bookId: '/book', title: '详情规范书名', author: '详情作者',
    coverUrl: '/new-cover', intro: '详情简介', kind: '历史', lastChapter: '第二十章' });
  assert.deepEqual(params.newToc, [{ chapterId: '/chapter', chapterTitle: '第一章', chapterUrl: '/chapter', order: 0 }]);
  for (const wrong of [{ ...candidate, sourceId: 'other' }, { ...candidate, bookUrl: '/other' }]) {
    assert.throws(() => buildSourceSwitchCommitParams({ sourceId: 'original', bookId: '/old' }, wrong, toc, '第一章', 0, 42), /identities/);
  }
  session.identity = { sourceId: 'wrong', bookId: '/book' };
  await assert.rejects(new SourceSwitchGateway(owner).fetchTargetToc('target', '/book', () => true), /mismatched reading session/);
}
{
  const calls = [];
  const owner = { request: async (method, params) => {
    calls.push(method);
    if (method === 'book.detail') return { data: { sourceId: 'target', sourceVersion: 'rule-v2', tocUrl: '/toc',
      variables: { token: 'detail token' }, book: { bookId: '/book', title: '详情书名', author: '作者' } } };
    assert.equal(method, 'book.toc'); assert.deepEqual(params.variables, { token: 'detail token' });
    return { data: { sourceId: 'target', bookId: '/book', sourceVersion: 'rule-v2', catalogAt: 43,
      catalogVersion: 'catalog-proof', contextVersion: 'context-proof',
      toc: [{ index: 0, title: '第一章', url: '/chapter', variables: { chapterToken: 'chapter token' } }] } };
  } };
  const toc = await new SourceSwitchGateway(owner).fetchTargetToc('target', '/book');
  assert.deepEqual(calls, ['book.detail', 'book.toc']);
  assert.equal(toc.readingSession.catalogVersion, 'catalog-proof');
  assert.equal(toc.readingSession.contextVersion, 'context-proof');
  assert.equal(toc.readingSession.book.title, '详情书名');
  assert.deepEqual(toc.readingSession.continuationVariables, [{ name: 'token', value: 'detail token' }]);
  assert.deepEqual(toc.readingSession.entries[0].variables, [{ name: 'chapterToken', value: 'chapter token' }]);
}
console.log('PH116 source switch preserves target session and canonical metadata PASS');

{
  const candidate={sourceId:'live-source',bookUrl:'/not-yet-persisted',bookName:'终宋',author:'怪诞的表哥',
    sourceVersion:'rule-v1',searchVariables:[{name:'token',value:'live-token'}],category:'novel'};
  const session={identity:{sourceId:candidate.sourceId,bookId:candidate.bookUrl},
    book:{title:candidate.bookName,author:candidate.author},tocUrl:'/toc',continuationVariables:[],
    entries:[{index:0,title:'第一章',url:'/chapter',variables:[]}]};
  let acquisitions=0;
  const owner={request(){assert.fail('live candidate must not require a durable search row before acquisition');},
    bookAcquisitions:()=>({async acquireBook(seed){acquisitions++;
      assert.deepEqual(seed.searchVariables,candidate.searchVariables);assert.equal(seed.sourceVersion,'rule-v1');
      return session;}})};
  const gateway=new SourceSwitchGateway(owner);
  const toc=await gateway.fetchTargetToc(candidate.sourceId,candidate.bookUrl,()=>true,candidate);
  assert.equal(toc.readingSession,session);assert.equal(acquisitions,1);
  await assert.rejects(gateway.fetchTargetToc('other',candidate.bookUrl,()=>true,candidate),/candidate identity/);
  await assert.rejects(gateway.fetchTargetToc(candidate.sourceId,candidate.bookUrl,()=>false,candidate),/aborted/);
  assert.equal(acquisitions,1,'mismatch/cancel cannot submit work');
}
console.log('PASS: unpersisted selected source preserves exact version/variables through shared acquisition');

{
  const Candidate = productionMotionMethods(resolve(repo, 'entry/src/main/ets/features/source/CandidateRow.ets'),
    ['selectCandidate'], {});
  for (const offline of [false, true]) for (const timeout of [false, true]) for (const isCurrent of [false, true]) {
    let selected = 0;
    const row = Object.assign(new Candidate(), { offline, timeout, isCurrent, onSelect: () => selected++ });
    row.selectCandidate();
    assert.equal(selected, isCurrent ? 0 : 1, 'historical availability feedback must not lock source selection');
  }
}
console.log('PH116 every non-current source row permits a new attempt PASS');

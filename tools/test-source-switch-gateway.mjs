import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { searchCandidateRank } from '../entry/src/main/ets/features/search/SearchCandidatePolicy.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
assert.match(gateway, /await Promise\.all\(pending\)/);
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
  gateway
    .replace(/^import \{ CachedBookIdentityResolver \} from .*;$/m, () =>
      readFileSync(resolve(repo, 'entry/src/main/ets/features/common/CachedBookIdentity.ts'), 'utf8').replace(/^import type .*;$/m, ''))
    .replace(/^import \{ errorMessageOf \} from ['"][^'"]*ErrorMessage(\.ts)?['"];$/m,
      () => errorMessageModule)
    .replace(/^import type \{ JsonObject, RequestOptions \} from ['"]@reader\/core-harmony['"];$/m, '')
    .replace(/^import \{ ReaderRuntimeOwner \} from ['"]\.\.\/\.\.\/app\/ReaderRuntimeOwner['"];$/m, '')
    .replace(/^import type \{ ShelfBook \} from ['"]\.\.\/\.\.\/app\/ReaderCoreGateway['"];$/m, '')
    .replace(/^import \{\n(?:  [^\n]+\n)+\} from ['"]\.\/ReaderSourceCategory['"];$/m,
      () => sourceCategoryModule),
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`;
const { SourceSwitchGateway, sourceSwitchCandidateKey } = await import(moduleUrl);
const transactionId = 'ss-core-owned-transaction';

assert.notEqual(
  sourceSwitchCandidateKey('a', 'bc'),
  sourceSwitchCandidateKey('ab', 'c'),
  'composite identity must not collapse ambiguous sourceId/bookUrl concatenations',
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
    if (method === 'change.bookSource') {
      assert.equal(params.sourceId, 'current-source');
      assert.equal(params.bookId, 'current-book');
      assert.equal(params.keyword, 'Current Book');
      assert.equal(params.sourceIds.length, 1,
        'each Core request must own exactly one source timeout/error boundary');
      const candidateSourceId = params.sourceIds[0];
      discoveryCalls.push(candidateSourceId);
      activeDiscoveries += 1;
      maxActiveDiscoveries = Math.max(maxActiveDiscoveries, activeDiscoveries);
      const index = Number(candidateSourceId.split('-')[1]);
      try {
        await new Promise((resolve) => setTimeout(resolve, (10 - index) * 2));
        if (candidateSourceId === 'candidate-3') {
          throw new Error('one source timed out');
        }
        return { data: { candidates: [{
          sourceId: candidateSourceId,
          bookUrl: `/book/${index}`,
          bookName: 'Current Book',
        }] } };
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

const identityRuntime = {
  async request(method, params) {
    if (method === 'source.list') {
      return { data: { sources: [
        { sourceId: 'current-source', enabled: true },
        { sourceId: 'other-source', enabled: true },
      ] } };
    }
    if (method === 'change.bookSource') {
      if (params.sourceIds[0] === 'current-source') {
        return { data: { candidates: [
          { sourceId: 'current-source', bookUrl: 'current-book', bookName: 'Current Book' },
          { sourceId: 'current-source', bookUrl: 'current-book', bookName: 'Duplicate' },
          { sourceId: 'current-source', bookUrl: 'alternate-book', bookName: 'Alternate Book' },
        ] } };
      }
      return { data: { candidates: [
        { sourceId: 'other-source', bookUrl: 'other-book', bookName: 'Other Book' },
        { sourceId: 'other-source', bookUrl: 'other-book', bookName: 'Duplicate Other' },
      ] } };
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
    if (method === 'search-book.list') {
      return { data: { books: [
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
      ] } };
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
assert.equal(cachedCandidates[0].latencyMs, 88);
assert.equal(cachedCandidates[0].currentChapterIndex, 4);
assert.equal(cachedCandidates[0].currentChapterTitle, 'Chapter 5');
assert.equal(cachedCandidates[0].isCurrent, true);
assert.equal(cacheCalls.some(([method]) => method === 'change.bookSource'), false,
  'a valid local projection must not start source HTTP discovery');

// Historical aliases must not multiply normalization across every cached row.
{
  const aliases = Array.from({ length: 16 }, (_, i) => ({ name: `Old ${i}`, author: 'Writer' }));
  const rows = [{ origin: 'cache-source', bookUrl: 'current-book', name: 'Current Book',
    author: 'Writer', time: cachedAt, acquisition: { aliases } },
  ...Array.from({ length: 1000 }, (_, i) => ({ origin: 'cache-source', bookUrl: `other-${i}`,
    name: `Unrelated ${i}`, author: 'Writer', time: cachedAt,
    acquisition: { aliases: Array.from({ length: 16 }, (_, j) => ({ name: `Other ${j}`, author: 'Writer' })) } })),
  { origin: 'cache-source', bookUrl: 'renamed', name: 'Old 15', author: 'Writer', time: cachedAt },
  { origin: 'cache-source', bookUrl: 'wrong-author', name: 'Old 15', author: 'Other', time: cachedAt }];
  const gateway = new SourceSwitchGateway({ request: async method => ({ data: method === 'source.list' ?
    { sources: [{ sourceId: 'cache-source', name: '缓存', enabled: true }] } : { books: rows } }) });
  let ticks = 0, normalizations = 0;
  const timer = setInterval(() => { ticks += 1; }, 0);
  const normalize = String.prototype.toLocaleLowerCase;
  String.prototype.toLocaleLowerCase = function (...args) { normalizations += 1; return normalize.apply(this, args); };
  try {
    const result = await gateway.loadCachedCandidates({ sourceId: 'cache-source', bookId: 'current-book',
      bookName: 'Current Book', author: 'Writer', currentChapterIndex: 0, currentChapterTitle: 'One' });
    assert.deepEqual(result.map(row => row.bookUrl), ['current-book', 'renamed']);
    assert.ok(ticks > 0, 'large cache scan must allow the event loop to run');
    assert.ok(normalizations < 1100, `normalization must be bounded by distinct text, got ${normalizations}`);
  } finally {
    clearInterval(timer);
    String.prototype.toLocaleLowerCase = normalize;
  }
}

const refreshRows = [{ bookUrl: 'old-book', origin: 'old-source', name: 'Current Book', author: 'Writer', time: cachedAt }];
const refreshCalls = [];
let preparation;
const refreshRuntime = {
  bookAcquisitions: () => ({ sourceRegistryRevision: () => 1, prepare: (seeds, refresh) => { preparation = { seeds, refresh }; } }),
  async request(method, params) {
    refreshCalls.push(method);
    if (method === 'search-book.list') return { data: { books: refreshRows } };
    if (method === 'source.list') return { data: { sources: [
      { sourceId: 'fresh-source', name: '新书源', enabled: true },
      { sourceId: 'old-source', name: '已有书源', enabled: true },
    ] } };
    if (method === 'change.bookSource') {
      if (params.sourceIds[0] === 'old-source') throw new Error('old source currently offline');
      // Core book.search publishes candidates before returning discovery.
      refreshRows.push({ bookUrl: 'fresh-book', origin: 'fresh-source', name: 'Current Book', author: 'Writer', time: cachedAt });
      return { data: { candidates: [{ sourceId: 'fresh-source', bookUrl: 'fresh-book', bookName: 'Current Book', author: 'Writer' }] } };
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
    if(method==='search-book.list')return {data:{books:[...records.values()]}};
    if(method==='search-book.get')return {data:{book:records.get(params.origin)??null}};
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
  assert.deepEqual(calls.map(c=>c.method),['search-book.get'],'duplicate dirty identities read once without full DB/source scan');
  assert.equal(next.find(c=>c.sourceId==='b').acquisitionState,'catalogReady');
  revision++;calls.length=0;
  const replaced=await gateway.loadCachedCandidates(query,()=>true,known,{reset:true,identities:[]});
  assert.deepEqual(replaced.map(c=>c.sourceId),['a'],'disabled source cannot be revived by a known row');
  assert.deepEqual(calls.map(c=>c.method),['source.list','search-book.list']);
}
// Missing-candidate discovery excludes sources already dispatched by this
// exact search session; an explicit refresh (no exclusions) checks all again.
{
  const searched=[];const owner={request:async(method,params)=>{
    if(method==='source.list')return{data:{sources:['a','b','c'].map(sourceId=>({sourceId,name:sourceId,enabled:true}))}};
    assert.equal(method,'change.bookSource');searched.push(params.sourceIds[0]);return{data:{candidates:[]}};
  }};const gateway=new SourceSwitchGateway(owner);
  await gateway.discoverCandidates('a','/book','鸣龙',()=>true,['a','b']);assert.deepEqual(searched,['c']);
  searched.length=0;await gateway.discoverCandidates('a','/book','鸣龙',()=>true);assert.deepEqual(searched,['a','b','c']);
}
console.log('PH70 known candidate first paint, delta projection, registry deletion and missing-only discovery PASS');
{
  let release;const sourceGate=new Promise(r=>release=r);const calls=[];let listener;
  const owner={bookAcquisitions:()=>({sourceRegistryRevision:()=>1,subscribe:fn=>{listener=fn;return()=>{}}}),request:async(method)=>{
    calls.push(method);
    if(method==='source.list'){await sourceGate;return{data:{sources:['a','b'].map(sourceId=>({sourceId,name:sourceId,enabled:true,sourceVersion:'v1'}))}}}
    if(method==='search-book.list')return{data:{books:[]}};
    throw Error(`entry must not re-search known candidates: ${method}`);
  }};
  const gateway=new SourceSwitchGateway(owner);
  const query={sourceId:'a',bookId:'/book',bookName:'鸣龙',author:'关关公子',currentChapterIndex:0,currentChapterTitle:''};
  const Index=productionMotionMethods(resolve(repo,'entry/src/main/ets/pages/Index.ets'),
    ['startSourceDiscovery','knownSearchSourceCandidates','isSourceSwitchActive'],{
      ReaderRuntimeOwner:{current:()=>owner},searchCandidateRank,sourceSwitchCandidateKey,
      errorMessageOf:error=>error.message,DOMAIN:0,hilog:{warn(){}}
    });
  const page=Object.assign(new Index(),{detailBook:{sourceId:'a',bookId:'/book'},detailReturnRoute:'search',
    navigationGeneration:1,sourceSwitchVisible:true,sourceSwitchState:{kind:'discovering'},
    searchDetailCandidates:['a','b'].map(sourceId=>({sourceId,sourceName:sourceId,sourceRuleVersion:'v1',
      bookId:'/book',title:'鸣龙',author:'关关公子',variables:[],category:'novel'})),
    sourceSwitchProbeQuery:()=>query,getSourceSwitchGateway:()=>gateway});
  page.startSourceDiscovery(1);
  assert.equal(page.sourceSwitchState.kind,'candidates');assert.equal(page.sourceSwitchState.candidates.length,2,
    'known Search group paints synchronously before registry/cache I/O completes');
  listener({reset:false,identities:[]});assert.deepEqual(calls,['source.list'],'empty event does no work');
  release();for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));
  assert.equal(page.sourceSwitchState.candidates.length,2);assert.deepEqual(calls,['source.list','search-book.list']);
}
console.log('PH70 real Index source-switch entry paints known candidates before cache RPC PASS');

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
    if (fail && method === (reset ? 'search-book.list' : 'search-book.get')) {
      fail = false; throw Error('one transient projection failure');
    }
    if (method === 'search-book.list') return { data: { books: [...rows.values()] } };
    if (method === 'search-book.get') return { data: { book: rows.get(params.origin) } };
    throw Error(`unexpected source discovery request: ${method}`);
  } };
  const gateway = new SourceSwitchGateway(owner);
  const query = { sourceId: 'a', bookId: '/book', bookName: '鸣龙', author: '关关公子',
    currentChapterIndex: 0, currentChapterTitle: '' };
  const Index = productionMotionMethods(resolve(repo, 'entry/src/main/ets/pages/Index.ets'),
    ['startSourceDiscovery', 'knownSearchSourceCandidates', 'isSourceSwitchActive'], {
      ReaderRuntimeOwner: { current: () => owner }, searchCandidateRank, sourceSwitchCandidateKey,
      errorMessageOf: error => error.message, DOMAIN: 0, hilog: { warn() {} },
    });
  const page = Object.assign(new Index(), { detailBook: { sourceId: 'a', bookId: '/book' },
    detailReturnRoute: 'search', navigationGeneration: 1, sourceSwitchVisible: true,
    sourceSwitchState: { kind: 'discovering' }, searchDetailCandidates: [],
    sourceSwitchProbeQuery: () => query, getSourceSwitchGateway: () => gateway });
  const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r)); };
  page.startSourceDiscovery(1); await settle(); calls.length = 0;
  fail = true;
  listener({ reset, identities: [{ sourceId: 'a', bookId: '/book' }] }); await settle();
  const failedCalls = calls.length;
  await settle();
  assert.equal(calls.length, failedCalls, 'failure alone must not create an automatic retry loop');
  calls.length = 0;
  listener({ reset: false, identities: [{ sourceId: 'b', bookId: '/book' }] }); await settle();
  if (reset) assert.equal(calls.filter(c => c.method === 'search-book.list').length, 1,
    'failed reset must survive and force the subsequent event to rebuild its snapshot');
  else assert.deepEqual(calls.filter(c => c.method === 'search-book.get').map(c => c.params.origin).sort(), ['a', 'b'],
    'failed A plus a later B event must re-read both actual identities');
  assert.equal(page.sourceSwitchState.kind, 'candidates');
  assert.equal(page.sourceSwitchState.candidates.length, 2);
}
console.log('PH70 actual Index/Gateway retain failed delta/reset without automatic retry loops PASS');

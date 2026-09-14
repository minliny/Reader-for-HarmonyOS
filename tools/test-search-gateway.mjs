import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gatewayPath = resolve(
  repo,
  'entry/src/main/ets/features/search/SearchGateway.ts',
);
const gatewaySource = readFileSync(gatewayPath, 'utf8');
const identityModule = readFileSync(resolve(repo, 'entry/src/main/ets/features/common/CachedBookIdentity.ts'), 'utf8').replace(/^import type .*;$/m, '');
const sourceCategoryModule = stripTypeScriptTypes(
  readFileSync(resolve(repo, 'entry/src/main/ets/features/source/ReaderSourceCategory.ts'), 'utf8'),
).replace(/^export /gm, '');

// The helper module is inlined because data-URL loads cannot resolve
// relative specifiers like '../../app/ErrorMessage'.
const errorMessageModule = stripTypeScriptTypes(
  readFileSync(resolve(repo, 'entry/src/main/ets/app/ErrorMessage.ts'), 'utf8'),
).replace('export function errorMessageOf', 'function errorMessageOf');

// ReaderRuntimeOwner imports Harmony-only modules. Strip that single runtime
// import so this contract test can exercise the real decoder and gateway with
// an injected owner without replacing application code.
const nodeSource = stripTypeScriptTypes(
  gatewaySource
    .replace(/^import \{ CachedBookIdentityResolver \} from .*;$/m, () => identityModule)
    .replace(/^import \{\n(?:  [^\n]+\n)+\} from ['"]\.\.\/source\/ReaderSourceCategory['"];$/m,
      () => sourceCategoryModule)
    .replace(/^import \{ errorMessageOf \} from ['"][^'"]*ErrorMessage(\.ts)?['"];$/m,
      () => errorMessageModule)
    .replace(
      /^import \{ ReaderRuntimeOwner \} from ['"]\.\.\/\.\.\/app\/ReaderRuntimeOwner['"];$/m,
      '',
    ),
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(nodeSource).toString('base64')}`;
const { SearchGateway } = await import(moduleUrl);

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

// Identity: a source.list baseUrl becomes the immutable bookSourceUrl.
const baseUrlSource = { sourceId: 'source-b', name: '乙书源', enabled: true, category: 'novel', baseUrl: 'https://b.example.test' };
const baseUrlOutcome = await new SearchGateway({
  request: async (command, params) => {
    assert.equal(command, 'book.search');
    return { data: { sourceId: params.sourceId, books: [{ bookId: '/b/book', title: '书' }] } };
  },
}).searchBySource(baseUrlSource, '关键字', undefined, 'sweep-3');
assert.equal(baseUrlOutcome.results[0].bookSourceUrl, 'https://b.example.test',
  'bookSourceUrl carries the source.list baseUrl identity');

let mixedCategoryRequestCount = 0;
const mixedCategoryGateway = new SearchGateway({
  request: async () => {
    mixedCategoryRequestCount += 1;
    throw new Error('非小说书源不应进入 Core 搜索');
  },
});
for (const category of ['music', 'comic', 'download', 'external', 'other']) {
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
  '音乐、漫画、下载和外部媒体源不得进入小说搜索链路');

// Identity: the rule version comes from Core and changes when rules change,
// including when the same sourceId retains its baseUrl.
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

// Identity: without an explicit sweep id the gateway generates a stable one
// shared by every result of the same call.
const generated = await gatewayReturning({ bookId: '/g/book', title: '书' }).searchBySource(source, '关键字');
assert.match(generated.results[0].searchRequestId, /^search-[0-9a-z]+-\d+-\d+$/,
  'the generated searchRequestId has the gateway format');
assert.equal(generated.results[0].sourceRuleVersion, '',
  'legacy unversioned sources are never assigned a fabricated rule version');

// Canonical detail aliases join all related source candidates to this query.
// Same title under another author and unrelated/disabled sources stay out.
{
  const seed = { sourceId: 'a', sourceName: '甲', bookSourceUrl: 'a', bookId: '/same', detailUrl: '/same',
    title: '旧书名', author: '作者', groupKey: '旧书名\u0000作者', searchRequestId: 'retained-query',
    sourceRuleVersion: 'v-a', category: 'novel', variables: [] };
  const facts = { schemaVersion: 1, sourceVersion: 'v-a', catalogAt: 100, catalogCount: 7,
    aliases: [{ name: '旧书名', author: '作者' }, { name: '新书名', author: '作者' }] };
  const rows = [
    { origin: 'a', bookUrl: '/same', name: '新书名', author: '作者', acquisition: facts },
    { origin: 'b', bookUrl: '/same', name: '新书名', author: '作者', variable: '{"token":"retained"}',
      acquisition: { schemaVersion: 1, sourceVersion: 'v-b', chapterUrl: '/chapter-1', readableAt: 101 } },
    { origin: 'c', bookUrl: '/other-author', name: '新书名', author: '另一作者' },
    { origin: 'c', bookUrl: '/unrelated', name: '别的书', author: '作者' },
    { origin: 'disabled', bookUrl: '/same', name: '旧书名', author: '作者' },
  ];
  let network = 0;
  const shared = new SearchGateway({ request: async method => {
    if (method === 'source.list') return { data: { sources: ['a', 'b', 'c', 'disabled'].map(sourceId =>
      ({ sourceId, name: sourceId, enabled: sourceId !== 'disabled', category: 'novel', sourceVersion: `v-${sourceId}` })) } };
    if (method === 'search-book.list') return { data: { books: rows } };
    network += 1; throw new Error(`projection issued ${method}`);
  } });
  const projected = await shared.refreshBooks([seed]);
  assert.deepEqual(projected.map(book => [book.sourceId, book.bookId]), [['a', '/same'], ['b', '/same']]);
  assert.equal(projected[0].title, '新书名');
  assert.equal(projected[0].acquisition.catalogCount, 7);
  assert.equal(projected[1].acquisition.chapterUrl, '/chapter-1');
  assert.deepEqual(projected[1].variables, [{ name: 'token', value: 'retained' }]);
  assert.ok(projected.every(book => book.groupKey === seed.groupKey && book.searchRequestId === seed.searchRequestId));
  assert.equal(network, 0, 'cross-page projection reads durable facts without another search');
}

console.log('search gateway remote-result and canonical synchronization: PASS');

// Broad searches carry many source variants for the same title. Refreshing
// those facts must let timers/input run, reuse normalization, and retain all rows.
{
  const books = Array.from({ length: 2048 }, (_, index) => ({
    sourceId: 'a', sourceName: '甲', bookSourceUrl: 'a', bookId: `/book-${index}`,
    detailUrl: `/book-${index}`, title: `同书 ${index % 128}`, author: '作者',
    sourceRuleVersion: 'v-a', searchRequestId: 'large-query', category: 'novel', variables: [],
  }));
  const rows = books.map(book => ({ origin: 'a', bookUrl: book.bookId, name: book.title,
    author: book.author, acquisition: { sourceVersion: 'v-a', catalogCount: 8 } }));
  const gateway = new SearchGateway({ request: async method => ({ data: method === 'source.list' ?
    { sources: [{ sourceId: 'a', name: '甲', enabled: true, sourceVersion: 'v-a' }] } : { books: rows } }) });
  let ticks = 0, normalizations = 0;
  const timer = setInterval(() => { ticks += 1; }, 0);
  const normalize = String.prototype.toLocaleLowerCase;
  String.prototype.toLocaleLowerCase = function (...args) { normalizations += 1; return normalize.apply(this, args); };
  try {
    const refreshed = await gateway.refreshBooks(books);
    assert.deepEqual(refreshed.map(book => book.bookId), books.map(book => book.bookId));
    assert.ok(refreshed.every(book => book.acquisition.catalogCount === 8));
    assert.ok(ticks > 0, 'large projection must yield to the event loop before completion');
    assert.ok(normalizations <= 256, 'shared titles/authors must not be normalized repeatedly across rows');
    normalizations = 0;
    await gateway.refreshBooks(refreshed);
    assert.equal(normalizations, 0, 'repeated metadata refresh reuses bounded alias cache');
  } finally {
    clearInterval(timer);
    String.prototype.toLocaleLowerCase = normalize;
  }
}
console.log('search gateway broad projection responsiveness: PASS');

{
  let visible = true;
  let captured;
  const guarded = new SearchGateway({ request: async (_method, params, options) => {
    captured = options;
    return { data: { sourceId: params.sourceId, books: [] } };
  } });
  await guarded.searchBySource(source, '保留查询', () => true, 'retained-query', () => visible);
  assert.equal(captured.canDispatch(), true);
  visible = false;
  assert.equal(captured.canDispatch(), false, 'route visibility reaches the global queue');
  assert.equal(captured.shouldCancel(), false, 'hiding never invalidates the retained query');
}

// PH65: cache projections reuse the source registry, but an identity mutation invalidates it.
{
  let revision = 0, sourceLoads = 0, enabled = true;
  const owner = { bookAcquisitions: () => ({ sourceRegistryRevision: () => revision }),
    request: async method => {
      if (method === 'source.list') { sourceLoads++; return { data: { sources: [{ ...source, enabled }] } }; }
      if (method === 'search-book.list') return { data: { books: [] } };
      throw Error(method);
    } };
  const gateway = new SearchGateway(owner);
  const seed = validOutcome.results[0];
  await gateway.loadSources();
  await gateway.refreshBooks([seed]);
  await gateway.refreshBooks([seed]);
  assert.equal(sourceLoads, 1, 'cache projection cannot repeatedly parse the whole source registry');
  enabled = false; revision++;
  assert.deepEqual(await gateway.refreshBooks([seed]), [], 'disabled source is not revived from registry cache');
  assert.equal(sourceLoads, 2);
}
console.log('PH65 source registry reuse and mutation invalidation PASS');

// PH65: decoding a large source response yields rendering turns and rejects a superseded sweep.
{
  let turns = 0;
  const timer = setInterval(() => { turns++; }, 0);
  const gateway = new SearchGateway({ request: async () => ({ data: { sourceId: source.sourceId,
    books: Array.from({ length: 1024 }, (_, i) => ({ bookId: `/large/${i}`, title: `书${i}`, author: '作者' })) } }) });
  try {
    const outcome = await gateway.searchBySource(source, '书', () => true, 'large');
    assert.equal(outcome.ok, true); assert.equal(outcome.results.length, 1024);
    assert.ok(turns >= 16, 'a broad source response must not monopolize one JS turn');
    let current = true; setTimeout(() => { current = false; }, 0);
    const stale = await gateway.searchBySource(source, '书', () => current, 'cancelled');
    assert.equal(stale.ok, false, 'cancelled decoding does not release a partial stale source result');
  } finally { clearInterval(timer); }
}
{
  let revision = 0, release;
  const cache = new Promise(resolve => { release = resolve; });
  const gateway = new SearchGateway({ bookAcquisitions: () => ({ sourceRegistryRevision: () => revision }), request: async method => {
    if (method === 'source.list') return { data: { sources: [source] } };
    await cache; return { data: { books: [] } };
  } });
  await gateway.loadSources();
  const projecting = gateway.refreshBooks([validOutcome.results[0]]);
  revision++; release();
  await assert.rejects(projecting, /source registry changed/, 'old projection cannot re-admit a deleted or replaced source');
}
console.log('PH65 yielding decode, superseded sweep and late source projection invalidation PASS');

// PH65: unchanged canonical reads retain both payload and array identity for UI projection caches.
{
  const gateway = new SearchGateway({ request: async method => method === 'source.list'
    ? { data: { sources: [source] } } : { data: { books: [] } } });
  const books = [validOutcome.results[0]];
  assert.equal(await gateway.refreshBooks(books), books, 'no new cache facts means no new UI payload');
}
console.log('PH65 no-op canonical refresh retains projection identity PASS');

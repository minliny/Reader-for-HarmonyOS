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
    sourceRuleVersion: 1,
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
    sourceRuleVersion: 1,
    title: '旧网关响应',
    author: '',
    variables: [],
  }],
});

// Identity: a source.list baseUrl becomes the immutable bookSourceUrl.
const baseUrlSource = { sourceId: 'source-b', name: '乙书源', enabled: true, baseUrl: 'https://b.example.test' };
const baseUrlOutcome = await new SearchGateway({
  request: async (command, params) => {
    assert.equal(command, 'book.search');
    return { data: { sourceId: params.sourceId, books: [{ bookId: '/b/book', title: '书' }] } };
  },
}).searchBySource(baseUrlSource, '关键字', undefined, 'sweep-3');
assert.equal(baseUrlOutcome.results[0].bookSourceUrl, 'https://b.example.test',
  'bookSourceUrl carries the source.list baseUrl identity');

// Identity: the rule version is stable while the baseUrl is unchanged and
// bumps when the same sourceId reports a different baseUrl.
let sourceListUrl = 'https://rule-one.example.test';
const versionGateway = new SearchGateway({
  request: async (command, params) => {
    if (command === 'source.list') {
      return { data: { sources: [
        { sourceId: 'source-b', name: '乙书源', enabled: true, baseUrl: sourceListUrl },
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
assert.equal(versionOne, 1);
assert.equal(versionAgain, 1, 'the rule version is stable for an unchanged baseUrl');
sourceListUrl = 'https://rule-two.example.test';
const listTwo = await versionGateway.loadSources();
const versionTwo = (await versionGateway.searchBySource(listTwo[0], '关键字')).results[0].sourceRuleVersion;
assert.equal(versionTwo, 2, 'a changed baseUrl bumps the rule version');

// Identity: without an explicit sweep id the gateway generates a stable one
// shared by every result of the same call.
const generated = await gatewayReturning({ bookId: '/g/book', title: '书' }).searchBySource(source, '关键字');
assert.match(generated.results[0].searchRequestId, /^search-[0-9a-z]+-\d+-\d+$/,
  'the generated searchRequestId has the gateway format');
assert.equal(generated.results[0].sourceRuleVersion, 1,
  'a fresh source starts at rule version 1');

console.log('search gateway remote-result contract: PASS');

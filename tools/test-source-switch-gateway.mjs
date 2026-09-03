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

const executable = stripTypeScriptTypes(
  gateway
    .replace(/^import type \{ JsonObject, RequestOptions \} from ['"]@reader\/core-harmony['"];$/m, '')
    .replace(/^import \{ ReaderRuntimeOwner \} from ['"]\.\.\/\.\.\/app\/ReaderRuntimeOwner['"];$/m, '')
    .replace(/^import type \{ ShelfBook \} from ['"]\.\.\/\.\.\/app\/ReaderCoreGateway['"];$/m, ''),
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
assert.equal(cachedCandidates.length, 1);
assert.equal(cachedCandidates[0].sourceName, '缓存书源');
assert.equal(cachedCandidates[0].latencyMs, 88);
assert.equal(cachedCandidates[0].currentChapterIndex, 4);
assert.equal(cachedCandidates[0].currentChapterTitle, 'Chapter 5');
assert.equal(cachedCandidates[0].isCurrent, true);
assert.equal(cacheCalls.some(([method]) => method === 'change.bookSource'), false,
  'a valid local projection must not start source HTTP discovery');

let persistedProbe;
const refreshRuntime = {
  async request(method, params) {
    if (method === 'search-book.list') {
      return { data: { books: [
        {
          bookUrl: 'old-book', origin: 'old-source', name: 'Current Book', author: 'Writer',
          time: cachedAt,
        },
        {
          bookUrl: 'same-name-other-author', origin: 'other-author-source', name: 'Current Book',
          author: 'Other Person', time: cachedAt,
        },
      ] } };
    }
    if (method === 'search-book.delete') {
      assert.equal(params.bookUrl, 'old-book');
      return { data: { bookUrl: params.bookUrl, deleted: true } };
    }
    if (method === 'source.list') {
      return { data: { sources: [{ sourceId: 'fresh-source', name: '新书源', enabled: true }] } };
    }
    if (method === 'change.bookSource') {
      return { data: { candidates: [{
        sourceId: 'fresh-source', bookUrl: 'fresh-book', bookName: 'Current Book', author: 'Writer',
      }] } };
    }
    if (method === 'book.detail') {
      return { data: {
        sourceId: 'fresh-source',
        book: {
          bookId: 'fresh-book', title: 'Current Book', author: 'Writer',
          coverUrl: 'https://img.test/current.jpg', lastChapter: 'Chapter 9',
        },
        tocUrl: '/fresh/toc',
        variables: { token: 'detail-token' },
      } };
    }
    if (method === 'book.toc') {
      assert.deepEqual(params.variables, { token: 'detail-token' });
      return { data: {
        sourceId: 'fresh-source', bookId: 'fresh-book',
        toc: [
          { index: 0, title: 'Chapter 1', url: '/fresh/1' },
          { index: 1, title: 'Chapter 2', url: '/fresh/2', variables: { chapter: 'two' } },
        ],
      } };
    }
    if (method === 'chapter.content') {
      assert.equal(params.chapterIndex, 1);
      assert.equal(params.chapterTitle, 'Chapter 2');
      assert.deepEqual(params.variables, { token: 'detail-token', chapter: 'two' });
      return { data: {
        sourceId: 'fresh-source', bookId: 'fresh-book', chapterTitle: 'Chapter 2',
        content: '123456789', via: 'rule',
      } };
    }
    if (method === 'search-book.put') {
      persistedProbe = params;
      return { data: { book: params } };
    }
    throw new Error(`unexpected refresh method: ${method}`);
  },
};
const refreshGateway = new SourceSwitchGateway(refreshRuntime);
const refreshed = await refreshGateway.refreshCandidates({
  sourceId: 'old-source',
  bookId: 'old-book',
  bookName: 'Current Book',
  author: 'Writer',
  currentChapterIndex: 1,
  currentChapterTitle: 'Chapter 2',
});
assert.equal(refreshed.kind, 'sources');
assert.equal(refreshed.candidates.length, 1);
assert.equal(refreshed.candidates[0].sourceName, '新书源');
assert.equal(refreshed.candidates[0].currentChapterTitle, 'Chapter 2');
assert.equal(refreshed.candidates[0].chapterWordCount, 9);
assert.equal(persistedProbe.origin, 'fresh-source');
assert.equal(persistedProbe.originName, '新书源');
assert.equal(persistedProbe.latestChapterTitle, 'Chapter 9');
assert.equal(persistedProbe.chapterWordCount, 9);
assert.match(persistedProbe.chapterWordCountText, /^\[2] Chapter 2\n字数：9$/);
assert.ok(persistedProbe.respondTime >= 0);

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

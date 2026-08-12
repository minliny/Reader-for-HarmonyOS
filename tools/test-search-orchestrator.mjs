import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const orchestratorPath = resolve(
  repo,
  'entry/src/main/ets/features/search/SearchOrchestrator.ets',
);
const source = readFileSync(orchestratorPath, 'utf8');

assert.match(source, /const SEARCH_SOURCE_CONCURRENCY = 8;/);
assert.match(source, /await Promise\.all\(pending\)/);
assert.match(source, /private scopeSourceId: SearchScope = undefined;/);
assert.match(source, /changeScope\(sourceId: SearchScope\): void/);
assert.doesNotMatch(source, /normalize.*(?:title|author)|group.*sourceIds|SearchResultGroup/i,
  'search must not invent a title/author equivalence identity in Harmony');

const executable = stripTypeScriptTypes(
  source
    .replace(/import \{[\s\S]*?\} from ['"]\.\/SearchGateway['"];\n/, '')
    .replace(/import type \{[\s\S]*?\} from ['"]\.\/SearchPage['"];\n/, '')
    .replace(/^import \{ ReaderRuntimeOwner \} from ['"]\.\.\/\.\.\/app\/ReaderRuntimeOwner['"];$/m, '')
    .replace(/^import \{ hilog \} from ['"]@kit\.PerformanceAnalysisKit['"];$/m, '')
    .replace(
      /constructor\(([\s\S]*?)owner: ReaderRuntimeOwner = ReaderRuntimeOwner\.current\(\),\n  \)/,
      'constructor($1owner,\n  )',
    ),
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(
  `const hilog = { error() {}, warn() {} };
class SearchGateway {
  constructor(owner) { this.owner = owner; }
  async loadSources() {
    const result = await this.owner.request('source.list', {});
    return result.data.sources;
  }
  async loadHistory() {
    const result = await this.owner.request('search.history.list', {});
    return result.data;
  }
  async addHistory(keyword) {
    await this.owner.request('search.history.add', { keyword });
  }
  async clearHistory() {
    await this.owner.request('search.history.clear', {});
  }
  async searchBySource(source, keyword, isCurrent) {
    if (!isCurrent()) return { ok: false, error: 'cancelled' };
    try {
      const result = await this.owner.request('book.search', { sourceId: source.sourceId, keyword });
      return {
        ok: true,
        results: result.data.books.map((entry) => ({
          sourceId: source.sourceId,
          sourceName: source.name,
          bookId: entry.bookId,
          detailUrl: entry.bookId,
          title: entry.title,
          author: entry.author ?? '',
          variables: [],
        })),
      };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }
}
` + executable,
).toString('base64')}`;
const { SearchOrchestrator } = await import(moduleUrl);

function deferred() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function book(sourceId, suffix = sourceId) {
  return {
    sourceId,
    sourceName: `Source ${sourceId}`,
    bookId: `/book/${suffix}`,
    detailUrl: `/book/${suffix}`,
    title: `Book ${suffix}`,
    author: 'Author',
    variables: [],
  };
}

function makeHarness(outcomeForSource, sourceCount = 10, extraSources = []) {
  const presentations = [];
  const emittedSources = [];
  const calls = [];
  let active = true;
  let inFlight = 0;
  let maxInFlight = 0;
  const sources = [
    ...Array.from({ length: sourceCount }, (_, index) => ({
      sourceId: `source-${index}`,
      name: `Source ${index}`,
      enabled: true,
    })),
    ...extraSources,
  ];
  const owner = {
    async request(method, params) {
      if (method === 'source.list') {
        return { data: { sources } };
      }
      if (method === 'search.history.list') {
        return { data: { keywords: [], count: 0 } };
      }
      if (method === 'search.history.add') {
        return { data: {} };
      }
      if (method === 'search.history.clear') {
        return { data: {} };
      }
      if (method === 'book.search') {
        calls.push(params.sourceId);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
          return await outcomeForSource(params.sourceId, params.keyword);
        } finally {
          inFlight -= 1;
        }
      }
      throw new Error(`unexpected method ${method}`);
    },
  };
  const orchestrator = new SearchOrchestrator(
    (presentation) => presentations.push(presentation),
    (loaded) => emittedSources.push(loaded),
    () => active,
    owner,
  );
  return {
    orchestrator,
    presentations,
    emittedSources,
    calls,
    maxInFlight: () => maxInFlight,
    deactivate: () => { active = false; },
  };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

{
  const harness = makeHarness(async (sourceId) => {
    const index = Number(sourceId.split('-')[1]);
    await new Promise((resolve) => setTimeout(resolve, (10 - index) * 2));
    if (sourceId === 'source-3') {
      throw new Error('one source timed out');
    }
    return { data: { sourceId, books: sourceId === 'source-8' ? [{
      bookId: '/book/eight', title: 'Result', author: 'Author',
    }] : [] } };
  });
  harness.orchestrator.open();
  harness.orchestrator.search('query');
  await settle();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const final = harness.presentations.at(-1);
  assert.equal(final.kind, 'results', 'one failed source must not erase a real result');
  assert.deepEqual(final.results.map((result) => result.sourceId), ['source-8']);
  assert.equal(harness.maxInFlight(), 8, 'all-source search must cap concurrency at eight');
  assert.deepEqual(harness.calls, Array.from({ length: 10 }, (_, index) => `source-${index}`),
    'bounded batches must launch and collect in source registry order');
}

{
  const harness = makeHarness(async (sourceId) => ({ data: { sourceId, books: [] } }), 1, [
    { sourceId: 'disabled', name: 'Disabled', enabled: false },
    { sourceId: 'blank-name', name: '   ', enabled: true },
  ]);
  harness.orchestrator.open();
  harness.orchestrator.search('query');
  await settle();
  assert.deepEqual(harness.emittedSources.at(-1).map((source) => source.sourceId), ['source-0'],
    'disabled or blank-name sources must not be projected as clickable chips');
  assert.deepEqual(harness.calls, ['source-0'],
    'disabled or blank-name sources must not participate in all-source search');
}

{
  const harness = makeHarness(async (sourceId) => {
    if (sourceId === 'source-0') {
      throw new Error('failed');
    }
    return { data: { sourceId, books: [] } };
  }, 2);
  harness.orchestrator.open();
  harness.orchestrator.search('query');
  await settle();
  assert.equal(harness.presentations.at(-1).kind, 'error',
    'zero results plus any failed selected source must remain whole-search error');
}

{
  const harness = makeHarness(async () => {
    throw new Error('every selected source failed');
  }, 3);
  harness.orchestrator.open();
  harness.orchestrator.search('query');
  await settle();
  assert.equal(harness.presentations.at(-1).kind, 'error',
    'all selected sources failing must resolve to whole-search error');
  assert.deepEqual(harness.calls, ['source-0', 'source-1', 'source-2']);
}

{
  const harness = makeHarness(async (sourceId) => ({ data: { sourceId, books: [] } }), 2);
  harness.orchestrator.open();
  harness.orchestrator.search('query');
  await settle();
  assert.equal(harness.presentations.at(-1).kind, 'empty',
    'zero results is empty only when every selected source succeeded');
}

{
  const harness = makeHarness(async (sourceId) => ({ data: { sourceId, books: [{
    bookId: `/book/${sourceId}`, title: sourceId,
  }] } }), 3);
  harness.orchestrator.open();
  harness.orchestrator.search('query');
  await settle();
  harness.orchestrator.changeScope('source-1');
  await settle();
  assert.deepEqual(harness.calls.slice(-1), ['source-1'],
    'scope change must re-run the current keyword against only the selected source');
  assert.equal(harness.presentations.at(-1).scopeSourceId, 'source-1');
}

{
  const harness = makeHarness(async (sourceId) => ({ data: { sourceId, books: [] } }), 2);
  harness.orchestrator.open();
  await settle();
  harness.orchestrator.changeScope('source-1');
  assert.equal(harness.presentations.at(-1).scopeSourceId, 'source-1');
  harness.orchestrator.changeScope(undefined);
  assert.equal(harness.presentations.at(-1).scopeSourceId, undefined,
    'returning to all before a keyword exists must clear the stale concrete scope projection');
  assert.deepEqual(harness.calls, [], 'an initial-state scope change must not fabricate a search');
}

{
  const first = deferred();
  const harness = makeHarness(async (sourceId, keyword) => {
    if (keyword === 'old') {
      return await first.promise;
    }
    return { data: { sourceId, books: [{ bookId: '/book/new', title: 'New' }] } };
  }, 1);
  harness.orchestrator.open();
  harness.orchestrator.search('old');
  await settle();
  harness.orchestrator.search('new');
  await settle();
  assert.equal(harness.presentations.at(-1).keyword, 'new');
  first.resolve({ data: { sourceId: 'source-0', books: [{ bookId: '/book/old', title: 'Old' }] } });
  await settle();
  assert.equal(harness.presentations.at(-1).keyword, 'new',
    'a late superseded request must not overwrite the newer search');
}

console.log('search orchestrator scope and batch contract: PASS');

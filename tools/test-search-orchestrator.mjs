import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(repo, rel), 'utf8');

// SearchOrchestrator imports SearchGateway by value and ReaderRuntimeOwner /
// hilog from Harmony-only modules. Strip the runtime imports, concatenate the
// two sources into one module, and stub hilog globally so the real orchestrator
// (including its bounded-concurrency loop) runs on plain Node.
const gatewaySource = read('entry/src/main/ets/features/search/SearchGateway.ts')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '');
const orchestratorSource = read('entry/src/main/ets/features/search/SearchOrchestrator.ets')
  .replace(/^import \{[\s\S]*?from '\.\/SearchGateway';\n/m, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '')
  .replace(/^import \{ hilog \} from ['"]@kit\.PerformanceAnalysisKit['"];\n/m, '');
const combined = stripTypeScriptTypes(`${gatewaySource}\n${orchestratorSource}`);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(combined).toString('base64')}`;

globalThis.hilog = {
  warn() {}, error() {}, info() {}, debug() {}, fatal() {},
};

const { SearchOrchestrator } = await import(moduleUrl);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeSources(count) {
  const sources = [];
  for (let i = 0; i < count; i += 1) {
    sources.push({ sourceId: `source-${i}`, name: `源${i}`, enabled: true });
  }
  return sources;
}

/**
 * A controllable Core stub. `resultsFor(sourceId, keyword)` yields the raw
 * `book.search` envelope books; `failFor(sourceId)` throws to simulate a source
 * failure. Tracks peak concurrent `book.search` in-flight requests so the test
 * can assert the orchestrator's bound.
 */
function fakeOwner({ sources, resultsFor, failFor, delayForSource }) {
  const state = { inFlight: 0, maxInFlight: 0, calls: [] };
  return {
    state,
    request: async (command, params, options) => {
      if (command === 'source.list') {
        return { data: { sources } };
      }
      if (command === 'search.history.list') {
        return { data: { keywords: [], count: 0 } };
      }
      if (command === 'search.history.add') {
        return { data: {} };
      }
      if (command !== 'book.search') {
        throw new Error(`unexpected command ${command}`);
      }
      const sourceId = params.sourceId;
      const keyword = params.keyword;
      state.calls.push({ sourceId, keyword });
      state.inFlight += 1;
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      const cancelled = () =>
        Boolean(options && typeof options.shouldCancel === 'function' && options.shouldCancel());
      try {
        await sleep(delayForSource(sourceId, keyword));
        if (cancelled()) {
          throw new Error('cancelled');
        }
        if (failFor !== undefined && failFor(sourceId)) {
          throw new Error(`boom:${sourceId}`);
        }
        return { data: { sourceId, books: resultsFor(sourceId, keyword) } };
      } finally {
        state.inFlight -= 1;
      }
    },
  };
}

function capture() {
  const presentations = [];
  return {
    presentations,
    orchestrator: (owner, isCurrent = () => true) =>
      new SearchOrchestrator(
        (presentation) => presentations.push(presentation),
        () => {},
        isCurrent,
        owner,
      ),
  };
}

async function settle(state, expectedCalls) {
  for (let i = 0; i < 300; i += 1) {
    if (state.calls.length >= expectedCalls && state.inFlight === 0) {
      return;
    }
    await sleep(10);
  }
  throw new Error(`timed out waiting for search to settle (calls=${state.calls.length})`);
}

async function waitUntil(state, predicate) {
  for (let i = 0; i < 200; i += 1) {
    if (predicate()) {
      return;
    }
    await sleep(10);
  }
  throw new Error('timed out waiting for condition');
}

const last = (presentations) => presentations[presentations.length - 1];

// 1. Bounded concurrency, stable source order, first-occurrence dedup.
{
  const sources = makeSources(8);
  const owner = fakeOwner({
    sources,
    delayForSource: () => 20,
    resultsFor: (sourceId) => {
      const index = Number(sourceId.slice('source-'.length));
      if (index === 0) return [
        { bookId: '/dup', title: '重复', author: 'A', variables: {} },
        { bookId: '/dup', title: '重复', author: 'A', variables: {} },
      ];
      if (index === 1) return [{ bookId: '/cross', title: '跨源', author: 'B', variables: {} }];
      if (index === 3) return [{ bookId: '/cross', title: '跨源', author: 'B', variables: {} }];
      return [{ bookId: `/book-${index}`, title: `书${index}`, author: 'C', variables: {} }];
    },
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('关键字');
  await settle(owner.state, 8);

  assert.ok(owner.state.maxInFlight <= 4, `max in-flight ${owner.state.maxInFlight} must not exceed 4`);
  assert.ok(owner.state.maxInFlight >= 2, `max in-flight ${owner.state.maxInFlight} shows no concurrency`);

  const present = last(presentations);
  assert.equal(present.kind, 'results', 'all sources succeeded with results');
  assert.equal(owner.state.calls.length, 8, 'every enabled source was searched');
  const ids = present.results.map((r) => `${r.sourceId}:${r.bookId}`);
  assert.deepEqual(ids, [
    'source-0:/dup',
    'source-1:/cross',
    'source-2:/book-2',
    'source-3:/cross',
    'source-4:/book-4',
    'source-5:/book-5',
    'source-6:/book-6',
    'source-7:/book-7',
  ], 'first-occurrence dedup with stable source registration order');
  assert.equal(
    present.results.filter((r) => r.bookId === '/dup').length, 1,
    'same sourceId + bookId deduped to first occurrence');
  assert.equal(
    present.results.filter((r) => r.bookId === '/cross').length, 2,
    'same bookId under different sourceIds is not merged');
}

// 2. Any single source failure keeps the whole-search error surface.
{
  const sources = makeSources(4);
  const owner = fakeOwner({
    sources,
    delayForSource: () => 15,
    failFor: (sourceId) => sourceId === 'source-2',
    resultsFor: (sourceId) => [{ bookId: `/b-${sourceId}`, title: '书', author: '', variables: {} }],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('关键字');
  await settle(owner.state, 4);

  const present = last(presentations);
  assert.equal(present.kind, 'error', 'one failing source yields whole-search error');
  assert.ok(
    presentations.every((p) => p.kind !== 'results'),
    'no partial results are ever presented when a source fails');
}

// 3. All sources empty yields the empty surface.
{
  const owner = fakeOwner({
    sources: makeSources(3),
    delayForSource: () => 10,
    resultsFor: () => [],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('无结果');
  await settle(owner.state, 3);

  assert.equal(last(presentations).kind, 'empty', 'all-success-with-no-results is empty');
}

// 4. A newer search supersedes an older one; late results never overwrite.
{
  const owner = fakeOwner({
    sources: makeSources(4),
    delayForSource: (_sourceId, keyword) => (keyword === '旧' ? 60 : 10),
    resultsFor: (sourceId, keyword) => [{ bookId: `/b-${keyword}-${sourceId}`, title: keyword, author: '', variables: {} }],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('旧');
  // Wait until the older search's requests are genuinely in flight (slow
  // source) before issuing the newer search, so late older results have a real
  // chance to arrive after the newer search has settled.
  await waitUntil(owner.state, () =>
    owner.state.calls.some((c) => c.keyword === '旧') && owner.state.inFlight > 0);
  search.search('新');
  await settle(owner.state, 8);

  const present = last(presentations);
  assert.equal(present.kind, 'results', 'newer search settles to results');
  assert.ok(
    present.results.every((r) => r.bookId.startsWith('/b-新-')),
    `late older results must not overwrite: ${JSON.stringify(present.results.map((r) => r.bookId))}`);
}

console.log('search orchestrator bounded concurrency: PASS');

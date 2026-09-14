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
// (including its bounded-concurrency loop) runs on plain Node. The error
// message helper is inlined once because data-URL loads cannot resolve
// relative specifiers like '../../app/ErrorMessage'.
const errorMessageModule = stripTypeScriptTypes(read('entry/src/main/ets/app/ErrorMessage.ts'))
  .replace('export function errorMessageOf', 'function errorMessageOf');
const errorMessageImport =
  /^import \{ errorMessageOf \} from ['"][^'"]*ErrorMessage(\.ts)?['"];\n/m;
const sourceCategoryModule = stripTypeScriptTypes(
  read('entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
).replace(/^export /gm, '');
const sourceCategoryImport =
  /^import \{\n(?:  [^\n]+\n)+\} from ['"][^'"]*ReaderSourceCategory['"];\n/m;
const sourceCategorySingleImport =
  /^import \{ readerSourceCategoryIsText \} from ['"][^'"]*ReaderSourceCategory['"];\n/m;
const gatewaySource = read('entry/src/main/ets/features/search/SearchGateway.ts')
  .replace(/^import \{ CachedBookIdentityResolver \} from .*;$/m, () =>
    read('entry/src/main/ets/features/common/CachedBookIdentity.ts').replace(/^import type .*;$/m, ''))
  .replace(errorMessageImport, '')
  .replace(sourceCategoryImport, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '');
const orchestratorSource = read('entry/src/main/ets/features/search/SearchOrchestrator.ets')
  .replace(/^import \{[\s\S]*?from '\.\/SearchGateway';\n/m, '')
  .replace(errorMessageImport, '')
  .replace(sourceCategorySingleImport, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '')
  .replace(/^import \{ hilog \} from ['"]@kit\.PerformanceAnalysisKit['"];\n/m, '');
const combined = stripTypeScriptTypes(
  `${sourceCategoryModule}\n${errorMessageModule}\n${gatewaySource}\n${orchestratorSource}`,
);
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
function fakeOwner({ sources, resultsFor, failFor, delayForSource = () => 0 }) {
  const state = { inFlight: 0, maxInFlight: 0, calls: [], historyWrites: 0, sourceLoads: 0, failList: false, localBooks: [] };
  return {
    state,
    request: async (command, params, options) => {
      if (command === 'bookshelf.list') return { data: { books: state.localBooks, total: state.localBooks.length } };
      if (command === 'source.list') {
        state.sourceLoads += 1;
        if (state.failList) {
          throw new Error('source list unavailable');
        }
        return { data: { sources } };
      }
      if (command === 'search.history.list') {
        return { data: { keywords: [], count: 0 } };
      }
      if (command === 'search.history.add') {
        state.historyWrites += 1;
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
  const sourcesSnapshots = [];
  return {
    presentations,
    sourcesSnapshots,
    orchestrator: (owner, isCurrent = () => true) =>
      new SearchOrchestrator(
        (presentation) => presentations.push(presentation),
        (sources) => sourcesSnapshots.push(sources),
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
  assert.equal(present.searching, false, 'final results close the streaming in-progress slot');
  assert.equal(present.totalSourceCount, 8);
  assert.equal(present.completedSourceCount, 8);
  assert.equal(present.failedSourceCount, 0, 'a fully healthy sweep reports zero failed sources');
  assert.ok(present.results.every((r) => r.searchRequestId === present.results[0].searchRequestId),
    'every result of one sweep carries the same searchRequestId');
  assert.match(present.results[0].searchRequestId, /^search-/,
    'the sweep id comes from the gateway format');
  assert.ok(present.results.every((r) => typeof r.sourceRuleVersion === 'string'),
    'every result carries its per-source rule version');
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

// 2. One broken source is isolated; healthy sources still finish and display.
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
  assert.equal(present.kind, 'results', 'one failing source must not hide healthy-source results');
  assert.equal(present.searching, false);
  assert.equal(present.completedSourceCount, 4, 'failures count as completed sources');
  assert.equal(present.failedSourceCount, 1, 'the isolated failure is reported to the surface');
  assert.equal(owner.state.calls.length, 4, 'a broken source must not cancel later sources');
  assert.deepEqual(
    present.results.map((result) => result.sourceId),
    ['source-0', 'source-1', 'source-3'],
    'only the failed source is absent and healthy-source order stays stable');
}

// 3. Only an all-source failure yields the whole-search error surface.
{
  const sources = makeSources(4);
  const owner = fakeOwner({
    sources,
    delayForSource: () => 10,
    failFor: () => true,
    resultsFor: () => [],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('关键字');
  await settle(owner.state, 4);

  assert.equal(last(presentations).kind, 'error', 'all failing sources yield whole-search error');
  assert.equal(last(presentations).searchedSourceCount, 4, 'error carries the attempted source count');
  assert.equal(last(presentations).failedSourceCount, 4, 'error carries every failed source count');
  assert.equal(owner.state.calls.length, 4, 'every enabled source is attempted before the error surface');
  assert.ok(
    !presentations.some((p) => p.kind === 'results'),
    'a sweep with zero successful sources never shows partial results');
}

// 4. All sources empty yields the empty surface.
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
  assert.equal(last(presentations).searchedSourceCount, 3, 'empty carries the attempted source count');
  assert.ok(
    !presentations.some((p) => p.kind === 'results'),
    'a zero-result sweep keeps the loading surface until the sweep completes');
}

// 5. A newer search supersedes an older one; late results never overwrite.
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
  assert.ok(present.results.every((r) => r.searchRequestId === present.results[0].searchRequestId),
    'the settled list only carries one sweep id: late old-sweep results are rejected');
}

// Local import search remains usable without online sources and when source.list fails.
for (const failList of [false, true]) {
  const owner = fakeOwner({ sources: [], resultsFor: () => [] });
  owner.state.failList = failList;
  owner.state.localBooks = [
    { sourceId: 'local', bookId: 'import-one', title: '关键字', author: '作者' },
    { sourceId: 'remote', bookId: 'remote-shelf', title: '关键字', author: '作者' },
  ];
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open(); search.search('关键字');
  await waitUntil(owner.state, () => last(presentations).kind === 'results');
  assert.deepEqual(last(presentations).results.map(book => book.bookId), ['import-one']);
  assert.equal(last(presentations).sourceListFailed, failList);
  assert.equal(owner.state.calls.length, 0);
}
{
  const owner = fakeOwner({ sources: makeSources(2).map(source => ({...source, enabled:false})), resultsFor: () => [] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner); search.open(); search.search('missing');
  await waitUntil(owner.state, () => last(presentations).kind === 'empty');
  assert.equal(owner.state.calls.length, 0);
}
{
  const owner = fakeOwner({ sources: makeSources(2), resultsFor: () => [] });
  owner.state.failList = true;
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner); search.open(); search.search('missing');
  await waitUntil(owner.state, () => last(presentations).kind === 'error');
  owner.state.failList = false; search.retry();
  await waitUntil(owner.state, () => last(presentations).kind === 'empty');
}

// 9. refreshSources preserves a non-config presentation (empty) but refreshes
// the source chips projection.
{
  const sources = makeSources(3);
  const owner = fakeOwner({ sources, delayForSource: () => 5, resultsFor: () => [] });
  const { orchestrator, presentations, sourcesSnapshots } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('无结果');
  await settle(owner.state, 3);
  assert.equal(last(presentations).kind, 'empty');

  sources.push({ sourceId: 'source-3', name: '源3', enabled: true });
  search.refreshSources();
  await waitUntil(owner.state, () =>
    sourcesSnapshots.length > 0 && sourcesSnapshots[sourcesSnapshots.length - 1].length === 4);

  assert.equal(last(presentations).kind, 'empty', 'refreshSources keeps the current surface');
  assert.equal(sourcesSnapshots[sourcesSnapshots.length - 1].length, 4, 'chips projection refreshed');
}

// 10. refreshSources resolves a resolved configuration gap: allDisabled list
// that becomes usable re-enters the Initial surface via the normal entry reset.
{
  const sources = makeSources(2).map((source) => ({ ...source, enabled: false }));
  const owner = fakeOwner({ sources, resultsFor: () => [] });
  const { orchestrator, presentations, sourcesSnapshots } = capture();
  const search = orchestrator(owner);
  search.open();
  await sleep(10);
  assert.equal(last(presentations).kind, 'initial');

  sources.length = 0;
  sources.push(...makeSources(2));
  search.refreshSources();
  await waitUntil(owner.state, () => last(presentations).kind === 'initial');

  assert.equal(last(presentations).kind, 'initial', 'usable list after allDisabled re-enters Initial');
  assert.equal(sourcesSnapshots[sourcesSnapshots.length - 1].length, 2, 'refreshed sources are projected');
}

// 11. Streaming results: the first successful source publishes partial
// results immediately (searching=true) while slower sources are still
// running; the sweep settles to searching=false with all counters.
{
  const sources = makeSources(2);
  const owner = fakeOwner({
    sources,
    delayForSource: (sourceId) => (sourceId === 'source-0' ? 10 : 200),
    resultsFor: (sourceId) => [{ bookId: `/b-${sourceId}`, title: '书', author: 'A', variables: {} }],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('关键字');
  await waitUntil(owner.state, () => presentations.some((p) => p.kind === 'results'));

  const partial = presentations.find((p) => p.kind === 'results');
  assert.equal(partial.searching, true, 'the first landing publishes a streaming snapshot');
  assert.equal(partial.totalSourceCount, 2, 'streaming snapshot carries the sweep total');
  assert.equal(partial.completedSourceCount, 1, 'only the landed source is completed so far');
  assert.deepEqual(partial.results.map((r) => r.bookId), ['/b-source-0'],
    'partial results already carry the first source books');
  assert.equal(last(presentations).kind, 'results', 'no empty/error clobbers a running sweep');

  await settle(owner.state, 2);
  const final = last(presentations);
  assert.equal(final.kind, 'results');
  assert.equal(final.searching, false, 'the sweep settles to a closed streaming slot');
  assert.equal(final.completedSourceCount, 2);
  assert.equal(final.results.length, 2, 'late books join the final list');
}

// 12. A failed source never publishes partial results on its own: the
// loading surface holds until the first book lands, and its completion is
// still reflected in the streaming counters.
{
  const sources = makeSources(2);
  const owner = fakeOwner({
    sources,
    delayForSource: (sourceId) => (sourceId === 'source-0' ? 10 : 200),
    failFor: (sourceId) => sourceId === 'source-0',
    resultsFor: (sourceId) => [{ bookId: `/b-${sourceId}`, title: '书', author: 'A', variables: {} }],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('关键字');
  await waitUntil(owner.state, () => owner.state.calls.length === 2 && owner.state.inFlight === 1);
  await sleep(40);
  assert.ok(
    !presentations.some((p) => p.kind === 'results'),
    'a lone failed source keeps the loading surface (no slot without a first book)');

  await settle(owner.state, 2);
  const emits = presentations.filter((p) => p.kind === 'results');
  assert.ok(emits.length >= 1, 'the healthy source still streams its results');
  assert.equal(emits[0].searching, true);
  assert.equal(emits[0].completedSourceCount, 2, 'the failure counts as completed');
  assert.equal(emits[0].failedSourceCount, 1, 'the streamed snapshot carries the failure count');
  assert.deepEqual(emits[0].results.map((r) => r.bookId), ['/b-source-1'],
    'only the healthy source contributes books');
  assert.equal(last(presentations).searching, false, 'the sweep settles to closed');
}

// 13. Leaving mid-sweep retains completed work. Restoring the route wakes the
// same query without repeating source requests or publishing another loading state.
{
  const sources = makeSources(2);
  const owner = fakeOwner({
    sources,
    delayForSource: (sourceId) => (sourceId === 'source-0' ? 10 : 60),
    resultsFor: (sourceId) => [{ bookId: `/b-${sourceId}`, title: '书', author: 'A', variables: {} }],
  });
  let routeIsSearch = true;
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner, () => routeIsSearch);
  search.open();
  search.search('关键字');
  await waitUntil(owner.state, () => presentations.some((p) => p.kind === 'results'));

  routeIsSearch = false; // leave during the sweep
  search.visibilityChanged();
  await sleep(120);
  const callsBeforeResume = owner.state.calls.length;
  const presentationsBeforeResume = presentations.length;
  routeIsSearch = true;
  search.resume();

  await settle(owner.state, 2);
  assert.equal(owner.state.calls.length, callsBeforeResume, 'completed sources are not requested again');
  assert.equal(presentations.slice(presentationsBeforeResume).some((p) => p.kind === 'loading'), false,
    'route restoration preserves the existing query');
  const final = last(presentations);
  assert.equal(final.kind, 'results');
  assert.equal(final.searching, false, 'the retained sweep settles to a closed slot');
  assert.equal(final.completedSourceCount, 2);
}

// 14. A sweep that is still alive when the route returns keeps its course:
// resume must not restart it, and it settles on its own.
{
  const sources = makeSources(2);
  const owner = fakeOwner({
    sources,
    delayForSource: (sourceId) => (sourceId === 'source-0' ? 10 : 150),
    resultsFor: (sourceId) => [{ bookId: `/b-${sourceId}`, title: '书', author: 'A', variables: {} }],
  });
  let routeIsSearch = true;
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner, () => routeIsSearch);
  search.open();
  search.search('关键字');
  await waitUntil(owner.state, () => presentations.some((p) => p.kind === 'results'));

  routeIsSearch = false;
  await sleep(10);
  routeIsSearch = true;
  const presentationsBeforeResume = presentations.length;
  search.resume();
  assert.equal(presentations.length, presentationsBeforeResume,
    'a live sweep is not restarted by the restore');

  await settle(owner.state, 2);
  const final = last(presentations);
  assert.equal(final.kind, 'results');
  assert.equal(final.searching, false, 'the surviving sweep settles alone');
  assert.equal(owner.state.calls.length, 2, 'no source request is re-issued');
}

// 15. A settled (searching:false) surface never re-sweeps on restore.
{
  const owner = fakeOwner({
    sources: makeSources(2),
    delayForSource: () => 10,
    resultsFor: () => [],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('无结果');
  await settle(owner.state, 2);
  assert.equal(last(presentations).kind, 'empty');

  const presentationsBefore = presentations.length;
  const callsBefore = owner.state.calls.length;
  search.resume();
  assert.equal(presentations.length, presentationsBefore, 'a settled surface never re-sweeps');
  assert.equal(owner.state.calls.length, callsBefore, 'a settled surface issues no requests');
}

// 16. ACQ-02: stop() during a live loading sweep settles to a stopped empty
// surface, and the superseded sweep issues no further source requests.
{
  const sources = makeSources(6);
  const owner = fakeOwner({
    sources,
    delayForSource: () => 80,
    resultsFor: () => [],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('关键字');
  await waitUntil(owner.state, () => owner.state.calls.length >= 4 && owner.state.inFlight > 0);
  search.stop();

  const stopped = last(presentations);
  assert.equal(stopped.kind, 'empty', 'a stop before any results lands settles to empty');
  assert.equal(stopped.stopped, true, 'the stopped empty verdict is marked as user-stopped');
  assert.equal(stopped.searchedSourceCount, 0, 'no source had returned when the sweep stopped');

  const callsAtStop = owner.state.calls.length;
  const presentationsAtStop = presentations.length;
  await sleep(200); // let every in-flight request unwind
  assert.equal(owner.state.calls.length, callsAtStop,
    'a stopped sweep must not issue further source requests');
  assert.equal(last(presentations), stopped,
    'the unwinding sweep must not publish anything after the stop');
  assert.equal(presentations.length, presentationsAtStop);

  // retry re-enters as a fresh full sweep and settles normally.
  search.retry();
  await settle(owner.state, callsAtStop + 6);
  assert.equal(last(presentations).kind, 'empty');
  assert.equal(last(presentations).stopped, undefined, 'a fresh retry is not marked stopped');
}

// 17. ACQ-02: stop() during a streaming results sweep keeps the partial
// results, closes the in-progress slot, and stops issuing requests.
{
  const sources = makeSources(4);
  const owner = fakeOwner({
    sources,
    delayForSource: (sourceId) => (sourceId === 'source-0' ? 10 : 120),
    resultsFor: (sourceId) => [{ bookId: `/b-${sourceId}`, title: '书', author: 'A', variables: {} }],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('关键字');
  await waitUntil(owner.state, () =>
    presentations.some((p) => p.kind === 'results' && p.searching === true));
  search.stop();

  const stopped = last(presentations);
  assert.equal(stopped.kind, 'results', 'a stop with partial results stays on results');
  assert.equal(stopped.searching, false, 'the stop closes the streaming in-progress slot');
  assert.equal(stopped.stopped, true, 'the partial results are marked as user-stopped');
  assert.deepEqual(stopped.results.map((r) => r.bookId), ['/b-source-0'],
    'the partial results stay on the surface');

  const callsAtStop = owner.state.calls.length;
  await sleep(200);
  assert.equal(owner.state.calls.length, callsAtStop,
    'a stopped sweep must not issue further source requests');
  assert.equal(last(presentations), stopped,
    'the unwinding sweep must not publish anything after the stop');

  // A stopped (searching:false) surface never re-sweeps on route restore.
  const presentationsBefore = presentations.length;
  search.resume();
  assert.equal(presentations.length, presentationsBefore,
    'a user-stopped sweep is not resurrected by resume');
}

// 18. ACQ-02: an explicit scope restricts the sweep to the selected subset.
{
  const sources = makeSources(4);
  const owner = fakeOwner({
    sources,
    delayForSource: () => 10,
    resultsFor: (sourceId) => [{ bookId: `/b-${sourceId}`, title: '书', author: 'A', variables: {} }],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('关键字', ['source-1', 'source-2']);
  await settle(owner.state, 2);

  const present = last(presentations);
  assert.equal(present.kind, 'results');
  assert.equal(present.totalSourceCount, 2, 'the sweep total is the scoped subset size');
  assert.equal(present.completedSourceCount, 2);
  assert.equal(owner.state.calls.length, 2, 'only the scoped sources are requested');
  assert.deepEqual(
    owner.state.calls.map((c) => c.sourceId).sort(), ['source-1', 'source-2']);
  assert.deepEqual(
    present.results.map((r) => r.bookId).sort(), ['/b-source-1', '/b-source-2']);
}

// 19. ACQ-02: a scope that excludes every usable source is an honest empty
// verdict with zero attempted sources, not a sourceRequired configuration gap.
{
  const sources = makeSources(2);
  const owner = fakeOwner({ sources, resultsFor: () => [] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('关键字', ['stale-scope']);
  await waitUntil(owner.state, () => last(presentations).kind === 'empty');

  const present = last(presentations);
  assert.equal(present.kind, 'empty', 'an exhausted scope reads as empty, not missing-source');
  assert.equal(present.searchedSourceCount, 0, 'nothing was searched for an exhausted scope');
  assert.equal(owner.state.calls.length, 0, 'no book.search fires for an exhausted scope');
}

// 20. ACQ-02: stop() on a settled surface is a no-op.
{
  const owner = fakeOwner({
    sources: makeSources(2),
    delayForSource: () => 10,
    resultsFor: () => [],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('无结果');
  await settle(owner.state, 2);
  assert.equal(last(presentations).kind, 'empty');

  const presentationsBefore = presentations.length;
  search.stop();
  assert.equal(presentations.length, presentationsBefore,
    'stopping a settled sweep publishes nothing');
}

// 21. ACQ-02: retry() after a scoped search re-runs the same scope subset.
{
  const sources = makeSources(3);
  const owner = fakeOwner({
    sources,
    delayForSource: () => 10,
    resultsFor: () => [],
  });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  search.search('关键字', ['source-1']);
  await settle(owner.state, 1);
  assert.equal(last(presentations).kind, 'empty');

  search.retry();
  await settle(owner.state, 2);
  assert.equal(owner.state.calls.length, 2, 'the retry re-runs exactly one scoped source');
  assert.ok(owner.state.calls.every((c) => c.sourceId === 'source-1'),
    'the retry keeps the retained scope instead of widening to all sources');
}

// 22. P2-9 log hygiene: hilog never carries raw keywords or source URLs —
// source identities reduce to the host, Core error URLs reduce to [host:…],
// and stop-log keywords are truncated.
{
  const logged = [];
  const originalHilog = globalThis.hilog;
  const keyword = '一个特别特别特别长的搜索关键词';
  globalThis.hilog = {
    ...originalHilog,
    warn: (...args) => logged.push({ level: 'warn', args }),
    info: (...args) => logged.push({ level: 'info', args }),
    error: originalHilog.error,
    debug: originalHilog.debug,
    fatal: originalHilog.fatal,
  };
  try {
    const sources = [{
      sourceId: 'https://secret-source.example/search.php',
      name: '保密源',
      enabled: true,
    }];
    // (a) A failing source: sourceId is a URL and the Core error embeds it.
    const failingOwner = fakeOwner({
      sources,
      delayForSource: () => 5,
      resultsFor: () => [],
      failFor: () => true,
    });
    const captureA = capture();
    const failingSearch = captureA.orchestrator(failingOwner);
    failingSearch.open();
    failingSearch.search(keyword);
    await settle(failingOwner.state, 1);

    // (b) A user stop while the sweep is loading logs the keyword truncated.
    const stoppedOwner = fakeOwner({
      sources,
      delayForSource: () => 5,
      resultsFor: () => [],
    });
    const captureB = capture();
    const stoppedSearch = captureB.orchestrator(stoppedOwner);
    stoppedSearch.open();
    stoppedSearch.search(keyword);
    stoppedSearch.stop();
    await settle(stoppedOwner.state, 0);
  } finally {
    globalThis.hilog = originalHilog;
  }

  const sourceFailure = logged.find((entry) =>
    entry.args.some((arg) => typeof arg === 'string' && arg.includes('Search source')));
  assert.ok(sourceFailure, 'a failing source must still be logged');
  assert.ok(sourceFailure.args.some((arg) => arg === 'secret-source.example'),
    'the source identity in hilog must be the host only');
  assert.ok(sourceFailure.args.some((arg) =>
    typeof arg === 'string' && arg.includes('boom:[host:secret-source.example]')),
    'Core error text must carry the host instead of the raw source URL');
  const stopEntry = logged.find((entry) =>
    entry.args.some((arg) => typeof arg === 'string' && arg.includes('stopped by user')));
  assert.ok(stopEntry, 'a user stop must still be logged');
  const loggedKeyword = stopEntry.args.find((arg) => typeof arg === 'string' && arg.includes('…'));
  assert.ok(loggedKeyword && loggedKeyword !== keyword && !loggedKeyword.includes('关键词'),
    'the stop-log keyword must be truncated, never raw');
  assert.ok(!logged.some((entry) => entry.args.some((arg) =>
    typeof arg === 'string' && arg.includes('secret-source.example/search'))),
    'no raw source URL may reach hilog');
}

// Local and online results belong to the same request, including a shared title.
{
  const owner = fakeOwner({sources: makeSources(1), delayForSource:()=>30,
    resultsFor:()=>[{bookId:'/remote',title:'同名',author:'作者'}]});
  owner.state.localBooks=[{sourceId:'local',bookId:'local-one',title:'同名',author:'作者'}];
  const {orchestrator,presentations}=capture();const search=orchestrator(owner);
  search.open();search.search('同名');
  await waitUntil(owner.state,()=>last(presentations).kind==='results' && last(presentations).searching===false);
  const result=last(presentations).results;
  assert.deepEqual(result.map(book=>book.sourceId),['local','source-0']);
  assert.equal(new Set(result.map(book=>book.searchRequestId)).size,1);
  assert.ok(presentations.some(p=>p.kind==='results' && p.searching && p.results[0]?.sourceId==='local'));
}

// Foreground policy: admitted requests finish while hidden; the remaining
// cursor pauses, then resumes once without recording history or starting over.
{
  let visible = true;
  const owner = fakeOwner({ sources: makeSources(9), delayForSource: () => 60,
    resultsFor: (sourceId) => [{ bookId: `/book-${sourceId}`, title: sourceId, author: '作者' }] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner, () => visible);
  search.open(); search.search('原查询');
  await waitUntil(owner.state, () => owner.state.calls.length === 4);
  visible = false; search.visibilityChanged();
  const sourceLoads = owner.state.sourceLoads;
  await settle(owner.state, 4); await sleep(25);
  assert.equal(owner.state.calls.length, 4, 'hidden search must leave five sources queued');
  const hidden = last(presentations);
  assert.equal(hidden.kind, 'results');
  assert.equal(hidden.completedSourceCount, 4, 'admitted sources publish while hidden');
  assert.equal(hidden.searching, true, 'paused sweep remains resumable');
  const queryId = hidden.results[0].searchRequestId;
  visible = true; search.resume(); search.resume();
  await settle(owner.state, 9); await sleep(25);
  assert.equal(owner.state.calls.length, 9);
  assert.equal(new Set(owner.state.calls.map(call => call.sourceId)).size, 9);
  assert.equal(owner.state.historyWrites, 1);
  assert.equal(owner.state.sourceLoads, sourceLoads, 'return does not restart source loading');
  assert.equal(last(presentations).completedSourceCount, 9);
  assert.equal(last(presentations).searching, false);
  assert.ok(last(presentations).results.every(book => book.searchRequestId === queryId));
  search.close();
}

// Hiding before any result does not strand Loading. Closing or stopping while
// paused releases the workers, and a later foreground event cannot revive them.
for (const action of ['resume', 'close', 'stop']) {
  let visible = false;
  const owner = fakeOwner({ sources: makeSources(6), delayForSource: () => 5,
    resultsFor: sourceId => [{ bookId: `/book-${sourceId}`, title: sourceId }] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner, () => visible);
  search.open(); search.search('隐藏前尚无结果');
  await sleep(30);
  assert.equal(owner.state.calls.length, 0);
  assert.equal(last(presentations).kind, 'loading');
  if (action !== 'resume') search[action]();
  visible = true; search.resume(); search.visibilityChanged();
  if (action === 'resume') {
    await settle(owner.state, 6);
    assert.equal(owner.state.calls.length, 6);
    assert.equal(last(presentations).searching, false);
  } else {
    await sleep(40);
    assert.equal(owner.state.calls.length, 0, `${action} must release without dispatch`);
  }
  search.close();
}

// A canonical notification can overlap an older snapshot read. The final
// update is replayed after that read, even if no source search remains active.
{
  const owner = fakeOwner({ sources: [{ ...makeSources(1)[0], sourceVersion: 'v1' }],
    resultsFor: () => [{ bookId: '/book', title: '搜索书名', author: '作者' }] });
  const originalRequest = owner.request;
  let notify = () => {};
  let release;
  const firstRead = new Promise(resolve => { release = resolve; });
  let readCount = 0;
  let title = '早先详情';
  owner.bookAcquisitions = () => ({ subscribe: listener => { notify = listener; return () => { notify = () => {}; }; } });
  owner.request = async (method, ...args) => {
    if (method !== 'search-book.list') return originalRequest(method, ...args);
    readCount += 1;
    const snapshot = title;
    if (readCount === 1) await firstRead;
    return { data: { books: [{ origin: 'source-0', bookUrl: '/book', name: snapshot, author: '作者',
      acquisition: { schemaVersion: 1, sourceVersion: 'v1', detailAt: readCount } }] } };
  };
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open(); search.search('搜索书名');
  await waitUntil(owner.state, () => readCount === 1);
  title = '最后到达的详情'; notify(); notify(); release();
  await waitUntil(owner.state, () => last(presentations).kind === 'results' &&
    last(presentations).results[0]?.title === title);
  assert.ok(readCount >= 2, 'overlapping notification triggers a final canonical read');
  assert.equal(owner.state.calls.length, 1, 'metadata changes never launch another search');
  assert.equal(last(presentations).searching, false);
  assert.equal(last(presentations).results[0].groupKey, '搜索书名\u0000作者');
  search.close();
}

// PH25: every eligible source is queried despite early fan-fiction matches; a
// late exact title is retained with source identity even if another source fails.
{
  const sources = makeSources(7);
  sources.push({ sourceId: 'disabled', name: '停用', enabled: false });
  sources.push({ sourceId: 'audio', name: '音频', enabled: true, category: 'audio' });
  const owner = fakeOwner({ sources, failFor: id => id === 'source-2',
    delayForSource: id => id === 'source-6' ? 25 : 2,
    resultsFor: id => [{ bookId: `/${id}`, title: id === 'source-6' ? '诡秘之主' : '诡秘之主同人',
      author: id === 'source-6' ? '爱潜水的乌贼' : '同人作者' }] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner); search.open(); search.search('诡秘之主');
  await settle(owner.state, 7);
  assert.deepEqual(owner.state.calls.map(c => c.sourceId).sort(), makeSources(7).map(s => s.sourceId));
  const final = last(presentations);
  assert.equal(final.kind, 'results'); assert.equal(final.searching, false);
  assert.equal(final.failedSourceCount, 1);
  const exact = final.results.find(b => b.title === '诡秘之主');
  assert.ok(exact); assert.equal(exact.sourceId, 'source-6'); assert.equal(exact.bookId, '/source-6');
  assert.ok(exact.searchRequestId); assert.equal(final.results.length, 6);
  search.close();
}

console.log('search orchestrator bounded concurrency and retained lifecycle: PASS');

// PH65: cache enrichment must become visible while later sources keep landing.
{
  let finish;
  let reads = 0;
  const gate = new Promise(resolve => { finish = resolve; });
  const emitted = [];
  const orches = new SearchOrchestrator(p => emitted.push(p), () => {}, () => true, {});
  const a = { sourceId: 'a', bookId: '/a', title: '旧名', author: '作者', sourceRuleVersion: 'v1', searchRequestId: 's' };
  const b = { ...a, sourceId: 'b', bookId: '/b', title: '稍后返回' };
  const old = { kind: 'results', keyword: '书', results: [a], searching: true,
    totalSourceCount: 40, completedSourceCount: 1, failedSourceCount: 0 };
  Object.assign(orches, { sessionOpen: true, presentation: old, gateway: { resetBookProjection() {}, refreshBooks() {
    reads++; return reads === 1 ? gate : new Promise(() => {});
  } } });
  const pending = orches.refreshSharedBooks();
  // A newly published source is not permission to discard completed metadata for A.
  orches.presentation = { ...old, results: [a, b], completedSourceCount: 2 };
  finish([{ ...a, title: '已证实详情书名', groupKey: 'canonical' }]);
  await pending;
  assert.equal(orches.presentation.results[0].title, '已证实详情书名');
  assert.equal(orches.presentation.results[1], b, 'later source payload remains intact');
  assert.equal(orches.presentation.completedSourceCount, 2);
  assert.equal(orches.presentation.searching, true, 'merge is visible before all remaining sources finish');
  assert.equal(emitted.length, 1, 'one completed projection is published, not discarded and restarted');
  orches.close();
}
console.log('PH65 in-flight canonical merge becomes visible before sweep completion PASS');

// PH65: the same merge must not overwrite a later payload or leak into a new keyword.
for (const superseded of [false, true]) {
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const emitted = [];
  const o = new SearchOrchestrator(p => emitted.push(p), () => {}, () => true, {});
  const oldBook = { sourceId: 'a', bookId: '/a', title: '旧', author: '作者', sourceRuleVersion: 'v1', searchRequestId: 's' };
  const initial = { kind: 'results', keyword: '书', results: [oldBook], searching: true,
    totalSourceCount: 10, completedSourceCount: 1, failedSourceCount: 0 };
  Object.assign(o, { sessionOpen: true, presentation: initial, gateway: { resetBookProjection() {}, refreshBooks: () => gate } });
  const pending = o.refreshSharedBooks();
  const newer = { ...oldBook, title: '较新请求正文', sourceRuleVersion: 'v2' };
  o.presentation = { ...initial, keyword: superseded ? '其他书' : '书', results: [newer], completedSourceCount: 3 };
  if (superseded) { o.work++; o.resultGeneration++; }
  // Follow-up projection remains pending so this assertion observes the old read's own completion.
  o.gateway = { resetBookProjection() {}, refreshBooks: () => new Promise(() => {}) };
  finish([{ ...oldBook, title: '旧请求详情' }]); await pending;
  assert.equal(o.presentation.results[0], newer);
  assert.equal(o.presentation.completedSourceCount, 3);
  if (superseded) assert.equal(emitted.length, 0);
  o.close();
}
{
  let reads = 0;
  const o = new SearchOrchestrator(() => {}, () => {}, () => true, {});
  Object.assign(o, { sessionOpen: true, unsubscribeBooks: () => {},
    gateway: { resetBookProjection() {}, refreshBooks() { reads++; return new Promise(() => {}); } } });
  const book = { sourceId: 'a', bookId: '/a', title: '旧', author: '作者', sourceRuleVersion: 'v1', searchRequestId: 's', groupKey: 'old' };
  const raw = [book];
  const p = { kind: 'results', keyword: '书', results: raw, searching: true,
    totalSourceCount: 40, completedSourceCount: 1, failedSourceCount: 0 };
  o.present(p);
  const cardData = o.presentation.results;
  for (let completed = 2; completed <= 40; completed++) o.present({ ...p, results: raw,
    searching: completed < 40, completedSourceCount: completed, failedSourceCount: completed - 1 });
  assert.equal(reads, 1, '39 counter updates do not re-read the whole cache');
  assert.equal(o.presentation.results, cardData, '39 counter updates do not rebuild card grouping input');
  const canonical = { ...book, groupKey: 'canonical' };
  o.present({ ...p, results: [canonical] }, false);
  o.present({ ...p, results: [book, { ...book, sourceId: 'b', bookId: '/b' }] });
  assert.equal(o.presentation.results[0], canonical, 'later raw source batch retains established canonical grouping even without acquisition');
  o.close();
}
console.log('PH65 stale metadata/work guards, 39 counter updates and canonical grouping retention PASS');

// PH68: a failed incremental read is retained until a later event; unrelated
// changes must not permanently lose the earlier book's update or spin retries.
{
  let visible=true,fail=true;const deltas=[];
  const a={sourceId:'a',bookId:'/a',title:'鸣龙',author:'关关公子'};
  const o=new SearchOrchestrator(()=>{},()=>{},()=>visible,{});
  Object.assign(o,{sessionOpen:true,presentation:{kind:'results',keyword:'鸣龙',results:[a],searching:false},
    gateway:{resetBookProjection(){},async refreshBooks(books,delta){
      deltas.push(structuredClone(delta));if(fail)throw Error('transient cache failure');return books;
    }}});
  await o.refreshSharedBooks({reset:false,identities:[{sourceId:'a',bookId:'/a'}]});
  await sleep(10);assert.equal(deltas.length,1,'no automatic retry loop after a failure');
  fail=false;
  await o.refreshSharedBooks({reset:false,identities:[{sourceId:'b',bookId:'/b'}]});
  assert.deepEqual(deltas[1],{reset:false,identities:[{sourceId:'a',bookId:'/a'},{sourceId:'b',bookId:'/b'}]});
  visible=false;
  await o.refreshSharedBooks({reset:false,identities:[{sourceId:'c',bookId:'/c'}]});
  await o.refreshSharedBooks({reset:true,identities:[]});
  assert.equal(deltas.length,2,'hidden route retains changes without IO');
  visible=true;o.visibilityChanged();await sleep(10);
  assert.deepEqual(deltas[2],{reset:true,identities:[{sourceId:'c',bookId:'/c'}]});o.close();
}
// PH68: busy reads union multiple delta notifications into one following pass.
{
  let finish;const gate=new Promise(r=>{finish=r;});const deltas=[];
  const a={sourceId:'a',bookId:'/a',title:'鸣龙',author:'关关公子'};
  const o=new SearchOrchestrator(()=>{},()=>{},()=>true,{});
  Object.assign(o,{sessionOpen:true,presentation:{kind:'results',keyword:'鸣龙',results:[a],searching:false},
    gateway:{resetBookProjection(){},async refreshBooks(books,delta){deltas.push(structuredClone(delta));
      if(deltas.length===1)await gate;return books;}}});
  const first=o.refreshSharedBooks({reset:false,identities:[{sourceId:'a',bookId:'/a'}]});
  await o.refreshSharedBooks({reset:false,identities:[{sourceId:'b',bookId:'/b'}]});
  await o.refreshSharedBooks({reset:false,identities:[{sourceId:'c',bookId:'/c'},{sourceId:'b',bookId:'/b'}]});
  finish();await first;await sleep(10);
  assert.equal(deltas.length,2);assert.deepEqual(deltas[1],{reset:false,identities:[{sourceId:'b',bookId:'/b'},{sourceId:'c',bookId:'/c'}]});
  o.close();
}
console.log('PH68 incremental deltas: failure retention without retry loop, hidden IO pause/resume, and busy union PASS');

// PH68: stop halts source dispatch, but retains this query and its outstanding
// metadata projection. A late success must enrich the stopped visible results.
{
  let finish;const gate=new Promise(r=>{finish=r;});
  const a={sourceId:'a',bookId:'/a',title:'旧标题',author:'关关公子'};
  const o=new SearchOrchestrator(()=>{},()=>{},()=>true,{});
  Object.assign(o,{sessionOpen:true,presentation:{kind:'results',keyword:'鸣龙',results:[a],searching:true,
    totalSourceCount:10,completedSourceCount:2,failedSourceCount:0},
    gateway:{resetBookProjection(){},refreshBooks:()=>gate}});
  const pending=o.refreshSharedBooks({reset:false,identities:[{sourceId:'a',bookId:'/a'}]});
  o.stop();finish([{...a,title:'已确认标题'}]);await pending;
  assert.equal(o.presentation.stopped,true);assert.equal(o.presentation.searching,false);
  assert.equal(o.presentation.results[0].title,'已确认标题');o.close();
}
console.log('PH68 stopped query retains completed metadata without restarting source search PASS');

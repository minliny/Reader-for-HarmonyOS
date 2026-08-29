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
const gatewaySource = read('entry/src/main/ets/features/search/SearchGateway.ts')
  .replace(errorMessageImport, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '');
const orchestratorSource = read('entry/src/main/ets/features/search/SearchOrchestrator.ets')
  .replace(/^import \{[\s\S]*?from '\.\/SearchGateway';\n/m, '')
  .replace(errorMessageImport, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '')
  .replace(/^import \{ hilog \} from ['"]@kit\.PerformanceAnalysisKit['"];\n/m, '');
const combined = stripTypeScriptTypes(`${errorMessageModule}\n${gatewaySource}\n${orchestratorSource}`);
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
  const state = { inFlight: 0, maxInFlight: 0, calls: [], failList: false };
  return {
    state,
    request: async (command, params, options) => {
      if (command === 'source.list') {
        if (state.failList) {
          throw new Error('source list unavailable');
        }
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
}

// 6. P0 add-source flow: a fresh entry with zero sources lands on
// sourceRequired(noSources), not the generic network error.
{
  const owner = fakeOwner({ sources: [], resultsFor: () => [] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired');

  const present = last(presentations);
  assert.equal(present.kind, 'sourceRequired', 'zero sources is a configuration gap, not an error');
  assert.equal(present.reason, 'noSources', 'zero sources reports noSources');
}

// 7. P0 add-source flow: a fresh entry whose sources are all disabled lands on
// sourceRequired(allDisabled); searching from there re-derives the same state.
{
  const sources = makeSources(2).map((source) => ({ ...source, enabled: false }));
  const owner = fakeOwner({ sources, resultsFor: () => [] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired');
  assert.equal(last(presentations).reason, 'allDisabled', 'disabled-only list reports allDisabled');

  search.search('关键字');
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired');
  assert.equal(last(presentations).reason, 'allDisabled',
    'a search attempt over a disabled-only list stays on sourceRequired(allDisabled)');
  assert.equal(owner.state.calls.length, 0, 'no book.search fires without enabled sources');
}

// 8. P0 add-source flow: a failed source.list lands on sourceLoadError and
// retry() recovers to the Initial surface once the list is available again.
{
  const owner = fakeOwner({ sources: makeSources(2), resultsFor: () => [] });
  owner.state.failList = true;
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceLoadError');
  assert.equal(last(presentations).kind, 'sourceLoadError', 'list failure is its own surface');

  owner.state.failList = false;
  search.retry();
  await waitUntil(owner.state, () => last(presentations).kind === 'initial');
  assert.equal(last(presentations).kind, 'initial', 'recovered list re-enters the Initial surface');
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
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired');
  assert.equal(last(presentations).reason, 'allDisabled');

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
  assert.deepEqual(emits[0].results.map((r) => r.bookId), ['/b-source-1'],
    'only the healthy source contributes books');
  assert.equal(last(presentations).searching, false, 'the sweep settles to closed');
}

// 13. Leaving mid-sweep cancels the sweep and drops its terminal publish;
// resumeStaleSweep on route restore re-runs the keyword instead of leaving a
// searching:true spinner residue behind.
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
  await sleep(120); // the cancelled request unwinds; the sweep dies unpublished
  const callsBeforeResume = owner.state.calls.length;
  const presentationsBeforeResume = presentations.length;
  routeIsSearch = true;
  search.resumeStaleSweep();

  await waitUntil(owner.state, () => owner.state.calls.length > callsBeforeResume);
  assert.ok(
    presentations.slice(presentationsBeforeResume).some((p) => p.kind === 'loading'),
    'the searching:true residue re-enters as a fresh sweep');
  await settle(owner.state, callsBeforeResume + 2);
  const final = last(presentations);
  assert.equal(final.kind, 'results');
  assert.equal(final.searching, false, 'the re-run sweep settles to a closed slot');
  assert.equal(final.completedSourceCount, 2);
}

// 14. A sweep that is still alive when the route returns keeps its course:
// resumeStaleSweep must not restart it, and it settles on its own.
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
  search.resumeStaleSweep();
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
  search.resumeStaleSweep();
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
  search.resumeStaleSweep();
  assert.equal(presentations.length, presentationsBefore,
    'a user-stopped sweep is not resurrected by resumeStaleSweep');
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

console.log('search orchestrator bounded concurrency: PASS');

import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
  "history-retry": {
    "description": "history: history-retry actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "history-clear-late": {
    "description": "history: history-clear-late actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "history-recovery-owner": {
    "description": "history: history-recovery-owner actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "history-active-query": {
    "description": "history: history-active-query actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "history-reopen-clear": {
    "description": "history: history-reopen-clear actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "worker-concurrency-dedup": {
    "description": "worker-lifecycle: worker-concurrency-dedup actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-health-admission": {
    "description": "source-health: source-health-admission actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-cooldown-retry": {
    "description": "source-health: source-cooldown-retry actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "page-retry-admission": {
    "description": "source-health: page-retry-admission actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof; selected actual SDK/AST page consumer",
    "resources": []
  },
  "source-failure-isolation": {
    "description": "source-health: source-failure-isolation actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "all-source-failure": {
    "description": "worker-lifecycle: all-source-failure actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "all-source-empty": {
    "description": "worker-lifecycle: all-source-empty actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "superseded-query": {
    "description": "worker-lifecycle: superseded-query actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-no-source": {
    "description": "worker-lifecycle: local-no-source actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-gap-entry": {
    "description": "source-health: source-gap-entry actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-history-arrival": {
    "description": "source-health: source-history-arrival actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-list-recovery": {
    "description": "source-health: source-list-recovery actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "all-disabled-entry": {
    "description": "source-health: all-disabled-entry actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-list-error-entry": {
    "description": "source-health: source-list-error-entry actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-refresh-retained": {
    "description": "source-health: source-refresh-retained actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-refresh-resolved": {
    "description": "source-health: source-refresh-resolved actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-refresh-removed": {
    "description": "source-health: source-refresh-removed actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-refresh-stale": {
    "description": "source-health: source-refresh-stale actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-refresh-failure": {
    "description": "source-health: source-refresh-failure actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "streaming-results": {
    "description": "worker-lifecycle: streaming-results actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "streaming-failure": {
    "description": "worker-lifecycle: streaming-failure actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "route-retained-work": {
    "description": "worker-lifecycle: route-retained-work actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "route-live-return": {
    "description": "worker-lifecycle: route-live-return actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "route-settled-return": {
    "description": "worker-lifecycle: route-settled-return actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "stop-loading": {
    "description": "worker-lifecycle: stop-loading actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "stop-streaming": {
    "description": "worker-lifecycle: stop-streaming actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "explicit-source-scope": {
    "description": "worker-lifecycle: explicit-source-scope actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "empty-source-scope": {
    "description": "worker-lifecycle: empty-source-scope actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "stop-settled": {
    "description": "worker-lifecycle: stop-settled actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "retry-source-scope": {
    "description": "worker-lifecycle: retry-source-scope actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "log-privacy": {
    "description": "worker-lifecycle: log-privacy actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-online-merge": {
    "description": "worker-lifecycle: local-online-merge actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "foreground-paused-cursor": {
    "description": "worker-lifecycle: foreground-paused-cursor actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "foreground-release": {
    "description": "worker-lifecycle: foreground-release actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "delta-snapshot-overlap": {
    "description": "metadata-delta: delta-snapshot-overlap actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "eligible-late-title": {
    "description": "worker-lifecycle: eligible-late-title actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "delta-live-merge": {
    "description": "metadata-delta: delta-live-merge actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "delta-superseded": {
    "description": "metadata-delta: delta-superseded actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "delta-counter-update": {
    "description": "metadata-delta: delta-counter-update actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "delta-failure-hidden": {
    "description": "metadata-delta: delta-failure-hidden actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "delta-busy-union": {
    "description": "metadata-delta: delta-busy-union actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "delta-stopped-query": {
    "description": "metadata-delta: delta-stopped-query actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "independent-branches": {
    "description": "worker-lifecycle: independent-branches actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "stop-flush-pending": {
    "description": "worker-lifecycle: stop-flush-pending actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "retry-failed-source": {
    "description": "worker-lifecycle: retry-failed-source actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "retry-failed-local": {
    "description": "worker-lifecycle: retry-failed-local actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "empty-source-sdk-publication": {
    "description": "worker-lifecycle: empty-source-sdk-publication actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof; selected actual SDK/AST page consumer",
    "resources": []
  },
  "branch-failure-recovery": {
    "description": "worker-lifecycle: branch-failure-recovery actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "branch-failure-stale": {
    "description": "worker-lifecycle: branch-failure-stale actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "source-failure-association": {
    "description": "source-health: source-failure-association actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-dense-pages": {
    "description": "local-scan: local-dense-pages actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-unicode": {
    "description": "local-scan: local-unicode actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-sparse-hydration": {
    "description": "local-scan: local-sparse-hydration actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-density-switch": {
    "description": "local-scan: local-density-switch actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-hydration-revision": {
    "description": "local-scan: local-hydration-revision actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-page-revision": {
    "description": "local-scan: local-page-revision actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-full-revision": {
    "description": "local-scan: local-full-revision actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-unstable-retry": {
    "description": "local-scan: local-unstable-retry actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-legacy-core": {
    "description": "local-scan: local-legacy-core actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  },
  "local-cancelled-pages": {
    "description": "local-scan: local-cancelled-pages actual SearchGateway/Orchestrator with controlled Core and virtual time; local shelf is an explicit port model, not SQLite proof",
    "resources": []
  }
};
async function runCase(id){
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { registerHooks, stripTypeScriptTypes } = await import('node:module');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; } } });
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(repo, rel), 'utf8');
const authorMetadataModule = read('entry/src/main/ets/features/common/BookAuthorMetadata.ts');

// SearchOrchestrator imports SearchGateway by value and ReaderRuntimeOwner /
// hilog from Harmony-only modules. Strip the runtime imports, concatenate the
// two sources into one module, and stub hilog globally so the real orchestrator
// (including its bounded-concurrency loop) runs on plain Node. The error
// message helper is inlined once because data-URL loads cannot resolve
// relative specifiers like '../../app/ErrorMessage'.
const errorMessageModule = stripTypeScriptTypes(read('entry/src/main/ets/app/ErrorMessage.ts'))
  .replace('export function errorMessageOf', 'function errorMessageOf');
const errorMessageImport =
  /^import \{[^\n]*errorMessageOf[^\n]*\} from ['"][^'"]*ErrorMessage(\.ts)?['"];\n/m;
const sourceCategoryModule = stripTypeScriptTypes(
  read('entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
).replace(/^export /gm, '');
const sourceCategoryImport =
  /^import \{\n(?:  [^\n]+\n)+\} from ['"][^'"]*ReaderSourceCategory['"];\n/m;
const sourceCategorySingleImport =
  /^import \{ readerSourceCategoryIsReadable \} from ['"][^'"]*ReaderSourceCategory['"];\n/m;
const operationFactsModule = stripTypeScriptTypes(
  read('entry/src/main/ets/app/ReaderOperationFacts.ts'),
).replace(/^export /gm, '');
const operationFactsImport =
  /^import \{ projectOperationFacts \} from ['"][^'"]*ReaderOperationFacts['"];\n/m;
const gatewaySource = read('entry/src/main/ets/features/search/SearchGateway.ts')
  .replace(/^import \{ readBookSearchTiming \} from .*;$/m, () =>
    read('entry/src/main/ets/features/common/BookSearchTiming.ts'))
  .replace(/^import \{ SearchBookProjection, type SearchBookPatch \} from .*;$/m, () =>
      readFileSync(resolve(repo, 'entry/src/main/ets/features/search/SearchBookProjection.ts'), 'utf8'))
  .replace(errorMessageImport, '')
  .replace(sourceCategoryImport, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '');
const orchestratorSource = read('entry/src/main/ets/features/search/SearchOrchestrator.ets')
  .replace(/^import \{ runBookSourceWorkers \} from .*;$/m, () => read('entry/src/main/ets/app/BookRequestScheduler.ts'))
  .replace(/^import \{[\s\S]*?from '\.\/SearchGateway';\n/m, '')
  .replace(errorMessageImport, '')
  .replace(sourceCategorySingleImport, '')
  .replace(operationFactsImport, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '')
  .replace(/^import \{ hilog \} from ['"]@kit\.PerformanceAnalysisKit['"];\n/m, '');
const combined = stripTypeScriptTypes(
  `${authorMetadataModule}\n${sourceCategoryModule}\n${errorMessageModule}\n${operationFactsModule}\n${gatewaySource}\n${orchestratorSource}`
    .replace(/^import \{[^\n]+\} from ['"][^'"]*BookAuthorMetadata(?:\.ts)?['"];?\n/gm, ''),
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(combined).toString('base64')}`;

globalThis.hilog = {
  warn() {}, error() {}, info() {}, debug() {}, fatal() {},
};

const { SearchGateway, SearchOrchestrator: ProductionSearchOrchestrator } = await import(moduleUrl);
const ownedSearches=new Set();
class SearchOrchestrator extends ProductionSearchOrchestrator {constructor(...args){super(...args);ownedSearches.add(this);}}

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
  const state = { inFlight: 0, maxInFlight: 0, calls: [], historyWrites: 0, sourceLoads: 0,
    failList: false, localBooks: [], historyKeywords: [] };
  return {
    state,
    supportsCoreCapability: (capability) => capability === 'source.check.report.v2',
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
        return { data: { keywords: state.historyKeywords.slice(), count: state.historyKeywords.length } };
      }
      if (command === 'search.history.clear') {
        state.historyKeywords = [];
        return { data: {} };
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
      // Give the actual worker promise continuation its own controlled turn.
      await sleep(0);
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

function localShelfOwner(initialRows, mutate) {
  let rows = initialRows;
  let revision = 1;
  const calls = [];
  const owner = {
    calls,
    supportsCoreCapability: (name) => name === 'bookshelf.pageProjection.v1',
    request: async (method, params) => {
      calls.push({ method, ...params });
      if (method === 'bookshelf.get') {
        assert.equal(params.sourceId, 'local');
        const book = rows.find(row => row.sourceId === params.sourceId && row.bookId === params.bookId) ?? null;
        const data = { book };
        if (mutate !== undefined) {
          const next = mutate({ method, params, revision, rows });
          if (next !== undefined) { rows = next; revision += 1; }
        }
        return { data };
      }
      assert.equal(method, 'bookshelf.list');
      assert.equal(params.sourceKind, 'local');
      let selected = rows.filter(row => row.sourceId === 'local');
      if (params.keyword !== undefined) {
        // SQLite lower() folds only ASCII; its keyword also matches bookId.
        const needle = params.keyword.toLowerCase();
        selected = selected.filter(row => [row.title, row.author, row.bookId]
          .some(value => value.replace(/[A-Z]/g, c => c.toLowerCase()).includes(needle)));
      }
      if (params.pageProjection) {
        assert.equal(params.membershipOnly, true);
        assert.ok(params.limit > 0 && params.limit <= 128);
        if (params.projectionRevision !== undefined && params.projectionRevision !== `local/${revision}`) {
          return { data: { books: [], total: 0, offset: params.offset,
            projectionRevision: `local/${revision}`, changed: true } };
        }
        const data = { books: selected.slice(params.offset, params.offset + params.limit).map(({sourceId,bookId,title,author}) =>
          ({sourceId,bookId,title,author})), total: selected.length,
          offset: params.offset, projectionRevision: `local/${revision}`, changed: false };
        if (mutate !== undefined) {
          const next = mutate({ method, params, revision, rows });
          if (next !== undefined) { rows = next; revision += 1; }
        }
        return { data };
      }
      assert.ok(params.limit > 0 && params.limit <= 128);
      const data = { books: selected.slice(params.offset, params.offset + params.limit), total: selected.length };
      if (mutate !== undefined) {
        const next = mutate({ method, params, revision, rows });
        if (next !== undefined) { rows = next; revision += 1; }
      }
      return { data };
    },
  };
  return owner;
}

try {switch(id){
case "history-retry": for (const sources of [[], makeSources(1), [{ ...makeSources(1)[0], enabled: false }]]) {
  const owner = fakeOwner({ sources, resultsFor: () => [] });
  const request = owner.request;
  let failHistory = true, reads = 0;
  owner.request = async (method, params, options) => {
    if (method === 'search.history.list') {
      reads += 1;
      if (failHistory) throw Error('history fixture failed https://private.invalid/token');
    }
    return request(method, params, options);
  };
  owner.state.historyKeywords = ['保留的历史'];
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  await sleep(20);
  assert.equal(last(presentations).historyStatus, 'loadFailed');
  assert.ok(!JSON.stringify(last(presentations)).includes('private.invalid'));
  search.retryHistory();
  await sleep(20);
  assert.equal(last(presentations).historyStatus, 'loadFailed');
  failHistory = false;
  const sourceReads = owner.state.sourceLoads, work = search.work;
  search.retryHistory(); search.retryHistory();
  await sleep(20);
  assert.equal(reads, 3, 'repeated retry joins the pending read');
  assert.equal(last(presentations).historyStatus, 'ready');
  assert.deepEqual(last(presentations).history, ['保留的历史']);
  assert.equal(owner.state.sourceLoads, sourceReads);
  assert.equal(owner.state.historyWrites, 0);
  assert.equal(search.work, work);
  search.close();
};break;
case "history-clear-late": {
  const owner = fakeOwner({ sources: [], resultsFor: () => [] });
  const request = owner.request;
  let releaseOld, reads = 0;
  owner.request = async (method, params, options) => {
    if (method === 'search.history.list' && ++reads === 1)
      return new Promise(resolve => { releaseOld = resolve; });
    return request(method, params, options);
  };
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open(); await sleep(10);
  search.clearHistory(); await sleep(10);
  assert.equal(last(presentations).historyStatus, 'ready');
  releaseOld({ data: { keywords: ['已清除的旧记录'], count: 1 } });
  await sleep(10);
  assert.deepEqual(last(presentations).history, [], 'a pre-clear response must never resurrect cleared history');
  search.close();
};break;
case "history-recovery-owner": {
  const owner = fakeOwner({ sources: [], resultsFor: () => [] });
  const request = owner.request;
  let releaseOld, reads = 0, clears = 0, failClear = true, failRead = false;
  owner.state.historyKeywords = ['历史'];
  owner.request = async (method, params, options) => {
    if (method === 'search.history.list') {
      if (++reads === 1) return new Promise(resolve => { releaseOld = resolve; });
      if (failRead) throw Error('read failed');
    }
    if (method === 'search.history.clear') {
      clears += 1;
      if (failClear) throw Error('clear failed');
    }
    return request(method, params, options);
  };
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open(); search.close(); search.open(); await sleep(20);
  releaseOld({ data: { keywords: ['旧会话'], count: 1 } }); await sleep(10);
  assert.deepEqual(last(presentations).history, ['历史']);
  search.clearHistory(); search.clearHistory(); await sleep(10);
  assert.equal(clears, 1);
  assert.equal(last(presentations).historyStatus, 'clearFailed');
  assert.deepEqual(last(presentations).history, ['历史']);
  failClear = false; failRead = true;
  search.retryHistory(); await sleep(10);
  assert.equal(last(presentations).historyStatus, 'loadFailed', 'successful clear is not repeated after a read failure');
  assert.deepEqual(last(presentations).history, []);
  failRead = false; search.retryHistory(); await sleep(10);
  assert.equal(last(presentations).historyStatus, 'ready');
  assert.equal(clears, 2);
  search.close();
  const count = presentations.length;
  search.retryHistory(); search.clearHistory(); await sleep(10);
  assert.equal(presentations.length, count, 'closed entry cannot issue recovery work');
};break;
case "history-active-query": {
  const owner = fakeOwner({ sources: makeSources(1), resultsFor: () => [], delayForSource: () => 50 });
  const request = owner.request;
  let failed = true;
  owner.request = async (method, params, options) => {
    if (method === 'search.history.list' && failed) throw Error('history unavailable');
    return request(method, params, options);
  };
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open(); await sleep(10); search.search('正在搜索', ['source-0']); await sleep(10);
  const run = search.run, work = search.work, calls = owner.state.calls.length;
  failed = false; search.retryHistory(); await sleep(10);
  assert.equal(search.run, run); assert.equal(search.work, work);
  assert.equal(owner.state.calls.length, calls); assert.equal(owner.state.historyWrites, 1);
  assert.equal(last(presentations).kind, 'loading', 'history recovery cannot replace an active query');
  await settle(owner.state, 1); search.close();
};break;
case "history-reopen-clear": {
  const owner = fakeOwner({ sources: [], resultsFor: () => [] });
  owner.state.historyKeywords = ['清空前'];
  const request = owner.request;
  let releaseClear, reads = 0, clears = 0;
  owner.request = async (method, params, options) => {
    if (method === 'search.history.list') reads += 1;
    if (method === 'search.history.clear') {
      clears += 1;
      await new Promise(resolve => { releaseClear = resolve; });
    }
    return request(method, params, options);
  };
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open(); await sleep(10); search.clearHistory(); search.close(); search.open(); await sleep(10);
  assert.equal(reads, 1, 'reopened entry waits for the pending durable clear before reading');
  releaseClear(); await sleep(10);
  assert.equal(clears, 1); assert.equal(reads, 2);
  assert.equal(last(presentations).historyStatus, 'ready');
  assert.deepEqual(last(presentations).history, []);
  search.close();
};break;
case "worker-concurrency-dedup": {
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
  assert.equal(present.operation.fact, 'current');
  assert.equal(present.operation.value.resultCount, present.results.length);
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
};break;
case "source-health-admission": {
  const now = Date.now();
  const checkedFailure = (sourceVersion) => ({ checkedAtMs: now, stale: false, report: {
    mode: 'search', ruleDigest: sourceVersion,
    steps: [{ level: 'L1', requested: true, status: 'fail' }, { level: 'L2', requested: true, status: 'fail' }],
  } });
  const sources = [
    { ...makeSources(1)[0], sourceId: 'known-failed', baseUrl: 'https://failed.example', sourceVersion: 'v-known', checkReports: [checkedFailure('v-known')] },
    { ...makeSources(1)[0], sourceId: 'unknown', sourceVersion: 'v-unknown' },
  ];
  const owner = fakeOwner({ sources, resultsFor: (sourceId) => [{ bookId: `/${sourceId}`, title: '可用书', author: '作者' }] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner); search.open(); search.search('健康筛选'); await settle(owner.state, 1);
  assert.deepEqual(owner.state.calls.map((call) => call.sourceId), ['unknown']);
  assert.equal(last(presentations).totalSourceCount, 2);
  assert.equal(last(presentations).skippedSourceCount, 1);
  assert.deepEqual(last(presentations).skippedSources, [{ sourceId: 'known-failed', baseUrl: 'https://failed.example', reason: 'healthFailed' }]);
  search.retry(); await settle(owner.state, 2);
  assert.deepEqual(owner.state.calls.map((call) => call.sourceId), ['unknown', 'known-failed'],
    'explicit retry bypasses health admission');
  search.close();
};break;
case "source-cooldown-retry": {
  let shouldFail = true;
  const owner = fakeOwner({ sources: makeSources(1), failFor: () => shouldFail, resultsFor: () => [] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner); search.open(); search.search('冷却一'); await settle(owner.state, 1);
  shouldFail = false; search.search('冷却二'); await sleep(30);
  assert.equal(owner.state.calls.length, 1, 'a failed source is cooled down for the next query');
  assert.equal(last(presentations).skippedSourceCount, 1);
  search.retry(); await settle(owner.state, 2);
  assert.equal(owner.state.calls.length, 2, 'manual retry bypasses the cooldown');
  search.close();
};break;
case "page-retry-admission": {
  const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
  const Retry=selectedProductionMethods(new URL('../entry/src/main/ets/features/search/SearchPage.ets',import.meta.url),'SearchPage',['retryOperation']);const retryPage=Retry.prototype.retryOperation;
  for (const reason of ['healthFailed', 'cooldown']) {
    const checkedAtMs = Date.now();
    const sources = makeSources(2).map((source) => ({ ...source, sourceVersion: `v-${source.sourceId}`,
      ...(reason === 'healthFailed' ? { checkReports: [{ checkedAtMs, stale: false, report: {
        mode: 'search', ruleDigest: `v-${source.sourceId}`,
        steps: [{ level: 'L1', requested: true, status: 'fail' }, { level: 'L2', requested: true, status: 'fail' }],
      } }] } : {}) }));
    let shouldFail = reason === 'cooldown';
    const owner = fakeOwner({ sources, failFor: () => shouldFail,
      resultsFor: (sourceId) => [{ bookId: `/${sourceId}`, title: '大明望族', author: '雁九' }] });
    const { orchestrator, presentations } = capture();
    const search = orchestrator(owner); search.open();
    let priorCalls = 0;
    if (reason === 'cooldown') {
      search.search('旧关键词');
      await waitUntil(owner.state, () => last(presentations).kind === 'error');
      priorCalls = owner.state.calls.length;
      assert.equal(priorCalls, 2);
      shouldFail = false;
    }
    search.search('大明望族');
    await waitUntil(owner.state, () => last(presentations).kind === 'empty');
    const skipped = last(presentations);
    assert.equal(owner.state.calls.length, priorCalls, 'skipped sources issue no live request');
    assert.equal(skipped.searchedSourceCount, 0);
    assert.equal(skipped.failedSourceCount, 0, 'a skip must not fabricate a failed live request');
    assert.equal(skipped.localSearchFailed, false);
    assert.equal(skipped.skippedSourceCount, 2);
    assert.ok(skipped.skippedSources.every((source) => source.reason === reason));
    assert.equal(skipped.operation.fact, 'empty');
    assert.equal(skipped.operation.canRetry, true);
    let invocations = 0;
    const page = { operation: () => last(presentations).operation,
      onRetry: () => { invocations += 1; search.retry(); } };
    retryPage.call(page);
    assert.equal(invocations, 1, 'the mounted page must reach explicit retry');
    assert.equal(last(presentations).operation.canRetry, false, 'running retry cannot be duplicated');
    retryPage.call(page);
    assert.equal(invocations, 1);
    await waitUntil(owner.state, () => last(presentations).kind === 'results' && !last(presentations).searching);
    assert.equal(owner.state.calls.length, priorCalls + 2, 'explicit retry dispatches each skipped source once');
    assert.equal(last(presentations).skippedSourceCount, undefined);
    assert.equal(last(presentations).operation.canRetry, false, 'healthy success does not claim failure recovery');
    assert.equal(last(presentations).results.length, 2);
    search.close();
  }
};break;
case "source-failure-isolation": {
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
  assert.equal(present.operation.fact, 'partial');
  assert.equal(present.operation.canRetry, true);
  assert.equal(owner.state.calls.length, 4, 'a broken source must not cancel later sources');
  assert.deepEqual(
    present.results.map((result) => result.sourceId),
    ['source-0', 'source-1', 'source-3'],
    'only the failed source is absent and healthy-source order stays stable');
};break;
case "all-source-failure": {
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
  assert.equal(last(presentations).operation.fact, 'failed');
  assert.equal(last(presentations).operation.canRetry, true);
  assert.equal(owner.state.calls.length, 4, 'every enabled source is attempted before the error surface');
  assert.ok(
    !presentations.some((p) => p.kind === 'results'),
    'a sweep with zero successful sources never shows partial results');
};break;
case "all-source-empty": {
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
  assert.equal(last(presentations).operation.fact, 'empty');
  assert.ok(
    !presentations.some((p) => p.kind === 'results'),
    'a zero-result sweep keeps the loading surface until the sweep completes');
};break;
case "superseded-query": {
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
};break;
case "local-no-source": for (const failList of [false, true]) {
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
};break;
case "source-gap-entry": for (const [sources, reason] of [
  [[], 'noSources'],
  [makeSources(2).map((source) => ({ ...source, enabled: false })), 'allDisabled'],
  [[{ sourceId: 'music', name: '音乐', enabled: true, bookSource: { bookSourceType: 1 } }], 'allDisabled'],
]) {
  const owner = fakeOwner({ sources, resultsFor: () => [] });
  owner.state.localBooks = [{ sourceId: 'local', bookId: 'import-one', title: '关键字', author: '作者' }];
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired');
  assert.equal(last(presentations).reason, reason);
  search.search('关键字');
  await waitUntil(owner.state, () => last(presentations).kind === 'results' && !last(presentations).searching);
  assert.deepEqual(last(presentations).results.map((book) => book.bookId), ['import-one']);
  assert.equal(owner.state.calls.length, 0, 'no ineligible online source receives book.search');
  search.close();
};break;
case "source-history-arrival": for (const delayed of ['history', 'sources']) {
  const owner = fakeOwner({ sources: [], resultsFor: () => [] });
  owner.state.historyKeywords = ['本地书', '旧关键词'];
  const request = owner.request;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  owner.request = async (command, ...args) => {
    if ((delayed === 'history' && command === 'search.history.list') ||
      (delayed === 'sources' && command === 'source.list')) await gate;
    return request(command, ...args);
  };
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  if (delayed === 'history') {
    await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired');
    assert.deepEqual(last(presentations).history, []);
  } else {
    await waitUntil(owner.state, () => last(presentations).kind === 'initial' &&
      last(presentations).history.length === 2);
  }
  release();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired' &&
    last(presentations).history.length === 2);
  assert.deepEqual(last(presentations).history, ['本地书', '旧关键词']);
  search.clearHistory();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired' &&
    last(presentations).history.length === 0);
  assert.equal(last(presentations).reason, 'noSources');
  search.close();
};break;
case "source-list-recovery": {
  const sources = makeSources(1);
  const owner = fakeOwner({ sources, resultsFor: () => [] });
  owner.state.failList = true;
  owner.state.historyKeywords = ['本地书'];
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceLoadError' &&
    last(presentations).history.length === 1);
  assert.deepEqual(last(presentations).history, ['本地书']);
  owner.state.failList = false;
  search.retry();
  await waitUntil(owner.state, () => last(presentations).kind === 'initial' && owner.state.sourceLoads >= 2);
  assert.equal(last(presentations).kind, 'initial');
  search.close();
};break;
case "all-disabled-entry": {
  const owner = fakeOwner({ sources: makeSources(2).map(source => ({...source, enabled:false})), resultsFor: () => [] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner); search.open(); search.search('missing');
  await waitUntil(owner.state, () => last(presentations).kind === 'empty');
  assert.equal(owner.state.calls.length, 0);
};break;
case "source-list-error-entry": {
  const owner = fakeOwner({ sources: makeSources(2), resultsFor: () => [] });
  owner.state.failList = true;
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner); search.open(); search.search('missing');
  await waitUntil(owner.state, () => last(presentations).kind === 'error');
  owner.state.failList = false; search.retry();
  await waitUntil(owner.state, () => last(presentations).kind === 'empty');
};break;
case "source-refresh-retained": {
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
};break;
case "source-refresh-resolved": {
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
  await waitUntil(owner.state, () => last(presentations).kind === 'initial' &&
    sourcesSnapshots[sourcesSnapshots.length - 1]?.length === 2);

  assert.equal(last(presentations).kind, 'initial', 'usable list after allDisabled re-enters Initial');
  assert.equal(sourcesSnapshots[sourcesSnapshots.length - 1].length, 2, 'refreshed sources are projected');
};break;
case "source-refresh-removed": {
  const sources = makeSources(2);
  const owner = fakeOwner({ sources, resultsFor: () => [] });
  owner.state.historyKeywords = ['本地书'];
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  await waitUntil(owner.state, () => last(presentations).kind === 'initial' &&
    last(presentations).history.length === 1);

  sources.forEach((source) => { source.enabled = false; });
  search.refreshSources();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired');
  assert.equal(last(presentations).reason, 'allDisabled');
  assert.deepEqual(last(presentations).history, ['本地书']);

  sources.length = 0;
  search.refreshSources();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired' &&
    last(presentations).reason === 'noSources');
  assert.deepEqual(last(presentations).history, ['本地书']);
  search.close();
};break;
case "source-refresh-stale": {
  const owner = fakeOwner({ sources: makeSources(1), resultsFor: () => [] });
  const originalRequest = owner.request;
  let rejectOldLoad;
  const oldLoad = new Promise((_resolve, reject) => { rejectOldLoad = reject; });
  let sourceCalls = 0;
  owner.request = async (command, ...args) => {
    if (command === 'source.list' && ++sourceCalls === 1) return await oldLoad;
    return originalRequest(command, ...args);
  };
  const { orchestrator, presentations, sourcesSnapshots } = capture();
  const search = orchestrator(owner);
  search.open();
  search.refreshSources();
  await waitUntil(owner.state, () => sourcesSnapshots.at(-1)?.length === 1);
  rejectOldLoad(new Error('source registry changed while loading'));
  await sleep(20);
  assert.equal(last(presentations).kind, 'initial', 'stale source failure cannot replace newer entry');
  assert.equal(sourcesSnapshots.at(-1).length, 1, 'stale source failure cannot clear current chips');
  search.close();
};break;
case "source-refresh-failure": {
  const owner = fakeOwner({ sources: [], resultsFor: () => [] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner);
  search.open();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired');
  owner.state.failList = true;
  search.refreshSources();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceLoadError');
  owner.state.failList = false;
  search.retry();
  await waitUntil(owner.state, () => last(presentations).kind === 'sourceRequired');
  assert.equal(last(presentations).reason, 'noSources');
  search.close();
};break;
case "streaming-results": {
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
  assert.equal(partial.operation.fact, 'partial');
  assert.equal(partial.operation.hasValue, true);
  assert.equal(partial.operation.canCancel, true);
  assert.deepEqual(partial.results.map((r) => r.bookId), ['/b-source-0'],
    'partial results already carry the first source books');
  assert.equal(last(presentations).kind, 'results', 'no empty/error clobbers a running sweep');

  await settle(owner.state, 2);
  const final = last(presentations);
  assert.equal(final.kind, 'results');
  assert.equal(final.searching, false, 'the sweep settles to a closed streaming slot');
  assert.equal(final.completedSourceCount, 2);
  assert.equal(final.operation.fact, 'current');
  assert.equal(final.operation.canCancel, false);
  assert.equal(final.results.length, 2, 'late books join the final list');
};break;
case "streaming-failure": {
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
  assert.equal(emits[0].operation.fact, 'partial');
  assert.deepEqual(emits[0].results.map((r) => r.bookId), ['/b-source-1'],
    'only the healthy source contributes books');
  assert.equal(last(presentations).searching, false, 'the sweep settles to closed');
  assert.equal(last(presentations).operation.fact, 'partial');
};break;
case "route-retained-work": {
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
};break;
case "route-live-return": {
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
};break;
case "route-settled-return": {
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
};break;
case "stop-loading": {
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
  assert.equal(stopped.operation.fact, 'cancelled');
  assert.equal(stopped.operation.canRetry, true);

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
  assert.equal(last(presentations).operation.fact, 'empty');
};break;
case "stop-streaming": {
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
  assert.equal(stopped.operation.fact, 'cancelled');
  assert.equal(stopped.operation.hasValue, true);
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
};break;
case "explicit-source-scope": {
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
};break;
case "empty-source-scope": {
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
};break;
case "stop-settled": {
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
};break;
case "retry-source-scope": {
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
};break;
case "log-privacy": {
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
};break;
case "local-online-merge": {
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
};break;
case "foreground-paused-cursor": {
  let visible = true;
  const owner = fakeOwner({ sources: makeSources(9), delayForSource: () => 60,
    resultsFor: (sourceId) => [{ bookId: `/book-${sourceId}`, title: sourceId, author: '作者' }] });
  const { orchestrator, presentations } = capture();
  const search = orchestrator(owner, () => visible);
  search.open(); search.search('原查询');
  await waitUntil(owner.state, () => owner.state.calls.length === 4);
  visible = false; search.visibilityChanged();
  const sourceLoads = owner.state.sourceLoads;
  await settle(owner.state, 4);
  await waitUntil(owner.state, () => last(presentations).completedSourceCount === 4);
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
};break;
case "foreground-release": for (const action of ['resume', 'close', 'stop']) {
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
};break;
case "delta-snapshot-overlap": {
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
    if (method !== 'search-book.batch.get') return originalRequest(method, ...args);
    readCount += 1;
    const snapshot = title;
    if (readCount === 1) await firstRead;
    return { data: { books: [{ origin: 'source-0', bookUrl: '/book', name: snapshot, author: '作者',
      relationKey: 'canonical', relationRevision: '1',
      acquisition: { schemaVersion: 1, sourceVersion: 'v1', detailAt: readCount } }],
      missing: [], complete: true, snapshotRevision: 'snapshot', sourceVersions: [{ sourceId: 'source-0', sourceVersion: 'v1', enabled: true }] } };
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
};break;
case "eligible-late-title": {
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
};break;
case "delta-live-merge": {
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
};break;
case "delta-superseded": for (const superseded of [false, true]) {
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
};break;
case "delta-counter-update": {
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
};break;
case "delta-failure-hidden": {
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
};break;
case "delta-busy-union": {
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
};break;
case "delta-stopped-query": {
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
};break;
case "independent-branches": {
  const deferred=()=>{let release;const promise=new Promise(r=>{release=r;});return {promise,release};};
  for(const blocked of ['bookshelf.list','source.list']) {
    const gate=deferred();const owner=fakeOwner({sources:makeSources(1),resultsFor:()=>[{bookId:'/remote',title:'目标',author:'作者'}]});
    owner.state.localBooks=[{sourceId:'local',bookId:'local-book',title:'目标',author:'作者'}];
    const request=owner.request;owner.request=async(method,...args)=>{if(method===blocked)await gate.promise;return request(method,...args);};
    const {orchestrator,presentations}=capture();const search=orchestrator(owner);search.open();search.search('目标');
    await waitUntil(owner.state,()=>last(presentations).kind==='results');
    const early=last(presentations);assert.equal(early.searching,true);
    assert.deepEqual(early.results.map(b=>b.sourceId),blocked==='bookshelf.list'?['source-0']:['local']);
    gate.release();await waitUntil(owner.state,()=>last(presentations).kind==='results'&&!last(presentations).searching);
    assert.equal(last(presentations).results.length,2);search.close();
  }
};break;
case "stop-flush-pending": {
  const gates=Array.from({length:3},()=>{let release;const promise=new Promise(r=>{release=r;});return {promise,release};});
  const owner=fakeOwner({sources:makeSources(3),resultsFor:id=>[{bookId:'/'+id,title:id,author:'作者'}]});
  const request=owner.request;owner.request=async(method,params,...rest)=>{
    if(method==='book.search')await gates[Number(params.sourceId.slice(7))].promise;
    if(method==='bookshelf.list')throw Error('local read unavailable');
    return request(method,params,...rest);
  };
  const {orchestrator,presentations}=capture();const search=orchestrator(owner);search.open();search.search('书');
  gates[0].release();await waitUntil(owner.state,()=>last(presentations).kind==='results');
  gates[1].release();await waitUntil(owner.state,()=>search.run.completed.size===2);
  assert.equal(last(presentations).results.length,1,'second response remains in the batching window');
  search.stop();assert.equal(last(presentations).results.length,2);assert.equal(last(presentations).completedSourceCount,2);
  assert.equal(last(presentations).localSearchFailed,true);assert.equal(last(presentations).stopped,true);
  assert.equal(search.run.localFailureReason,'local read unavailable');
  assert.equal(last(presentations).localFailureMessage,'读取未完成，请稍后重试');
  gates[2].release();await sleep(130);assert.equal(last(presentations).results.length,2);search.close();
};break;
case "retry-failed-source": {
  let failing=true;let localReads=0;
  const owner=fakeOwner({sources:makeSources(2),failFor:id=>failing&&id==='source-1',resultsFor:id=>[{bookId:'/'+id,title:'书',author:'作者'}]});
  const request=owner.request;owner.request=async(method,...args)=>{if(method==='bookshelf.list'){localReads++;if(failing)throw Error('local read unavailable');}return request(method,...args);};
  const {orchestrator,presentations}=capture();const search=orchestrator(owner);search.open();search.search('书');
  await waitUntil(owner.state,()=>last(presentations).kind==='results'&&!last(presentations).searching);
  const first=last(presentations).results[0], query=first.searchRequestId;
  assert.equal(last(presentations).localSearchFailed,true);assert.equal(last(presentations).failedSourceCount,1);
  failing=false;search.retry();
  assert.equal(last(presentations).operation.fact, 'refreshing');
  assert.equal(last(presentations).operation.canCancel, true);
  assert.equal(search.run.localFailureReason,'local read unavailable','retry keeps the last cause until this branch succeeds');
  await waitUntil(owner.state,()=>last(presentations).kind==='results'&&!last(presentations).searching);
  assert.equal(search.run.localFailureReason,undefined);assert.equal(last(presentations).localFailureMessage,undefined);
  assert.equal(last(presentations).localSearchFailed,false);assert.equal(last(presentations).failedSourceCount,0);
  assert.equal(owner.state.calls.filter(c=>c.sourceId==='source-0').length,1);
  assert.equal(owner.state.calls.filter(c=>c.sourceId==='source-1').length,2);
  assert.equal(localReads,2);assert.equal(owner.state.historyWrites,1);
  assert.ok(last(presentations).results.every(b=>b.searchRequestId===query));search.close();
};break;
case "retry-failed-local": {
  let release;const gate=new Promise(r=>release=r);let localReads=0;
  const owner=fakeOwner({sources:makeSources(1),resultsFor:()=>[{bookId:'/remote',title:'书',author:'作者'}]});
  owner.state.localBooks=[{sourceId:'local',bookId:'local',title:'书',author:'作者'}];
  const request=owner.request;owner.request=async(method,...args)=>{
    if(method==='book.search')await gate;
    if(method==='bookshelf.list'&&++localReads===1)throw Error('local unavailable');
    return request(method,...args);
  };
  const {orchestrator,presentations}=capture();const search=orchestrator(owner);search.open();search.search('书');
  await waitUntil(owner.state,()=>search.run.localStatus==='failed');const work=search.work;
  search.retry();search.retry();await waitUntil(owner.state,()=>last(presentations).kind==='results');
  assert.equal(localReads,2);assert.equal(last(presentations).searching,true);assert.equal(search.sweepAlive,true);
  assert.equal(search.work,work,'retry does not supersede the still-running healthy branch');
  release();await waitUntil(owner.state,()=>last(presentations).kind==='results'&&!last(presentations).searching);
  assert.equal(last(presentations).results.length,2);assert.equal(owner.state.calls.length,1);search.close();
};break;
case "empty-source-sdk-publication": {
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const execute = source => import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
  const pageSource = read('entry/src/main/ets/features/search/SearchPage.ets');
  const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');const {ts}=installedEtsCompiler();const tree=ts.createSourceFile('SearchPage.ets',pageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS);
  const classes=tree.statements.filter(n=>ts.isClassDeclaration(n)&&['SearchBookGroup','SearchResultDataSource'].includes(n.name?.text)).map(n=>n.getText(tree).replace('@Observed','')).join('\n');assert.equal(tree.statements.filter(n=>ts.isClassDeclaration(n)&&['SearchBookGroup','SearchResultDataSource'].includes(n.name?.text)).length,2);
  const {SearchBookGroup,SearchResultDataSource,SearchViewState}=await execute(`const DataOperationType={ADD:'add',DELETE:'delete',CHANGE:'change',RELOAD:'reload',MOVE:'move'};${authorMetadataModule}\n${read('entry/src/main/ets/features/search/SearchViewState.ts')}\n${classes}\nexport {SearchBookGroup,SearchResultDataSource};`);
  const { SearchResultProjection } = await import('../entry/src/main/ets/features/search/SearchResultProjection.ts');
  let counting = false;let groupBuilds = 0;let rowUpdates = 0;let notices = 0;let flattenRows = 0;let identityLookups = 0;
  class CountedGroup extends SearchBookGroup { constructor(...args){super(...args);if(counting)groupBuilds++;} }
  const Page = productionMotionMethods(resolve(repo,'entry/src/main/ets/features/search/SearchPage.ets'),['groupResults'],
    {SearchBookGroup:CountedGroup,SearchResultProjection});
  const page = Object.assign(new Page(),{shelfBooks:[],selectedGroupName:'全部',viewState:new SearchViewState()});
  const ds = new SearchResultDataSource();ds.registerDataChangeListener({onDatasetChange(){if(counting)notices++;}});
  const update = ds.update.bind(ds);ds.update=(...args)=>{if(counting)rowUpdates++;return update(...args);};
  let release;const gate=new Promise(resolve=>release=resolve);
  const owner=fakeOwner({sources:makeSources(2),resultsFor:id=>id==='source-0'
    ?Array.from({length:1000},(_,i)=>({bookId:'/book-'+i,title:'书'+i,author:'作者'})):[]});
  const request=owner.request;owner.request=async(method,params,...args)=>{
    if(method==='book.search'&&params.sourceId==='source-1')await gate;
    return request(method,params,...args);
  };
  const search=new SearchOrchestrator(presentation=>{
    if(presentation.kind!=='results')return;
    page.presentation=presentation;const groups=page.groupResults(presentation.results);ds.replace(groups,page.changedGroupKeys);
  },()=>{},()=>true,owner);
  search.open();search.search('书');await waitUntil(owner.state,()=>search.presentation.kind==='results');
  const before=search.presentation;const run=search.run;const revision=run.revision;
  const results=run.results.bind(run);run.results=()=>{
    const changed=run.flattenedRevision!==run.revision;const rows=results();if(counting&&changed)flattenRows+=rows.length;return rows;
  };
  const get=search.resultIndex.get.bind(search.resultIndex);search.resultIndex.get=key=>{if(counting)identityLookups++;return get(key);};
  counting=true;release();await waitUntil(owner.state,()=>search.presentation.kind==='results'&&!search.presentation.searching);counting=false;
  assert.equal(search.presentation.completedSourceCount,2);assert.equal(search.presentation.failedSourceCount,0);
  assert.equal(search.presentation.results,before.results);assert.equal(search.presentation.delta,before.delta);assert.equal(run.revision,revision);
  assert.deepEqual({groupBuilds,rowUpdates,notices,flattenRows,identityLookups},
    {groupBuilds:0,rowUpdates:0,notices:0,flattenRows:0,identityLookups:0});
  assert.equal(ds.totalCount(),1000);
  // Empty replacement of a previously populated bucket is a real deletion,
  // and must not be mistaken for the no-entity-change completion fast path.
  const previous=run.sourceResults.get('source-0');run.sourceResults.set('source-0',run.admit([],previous));
  assert.equal(run.revision,revision+1);assert.equal(run.results().length,0);
  search.publishRun(run);assert.equal(search.presentation.kind,'empty');search.close();
};break;
case "branch-failure-recovery": {
  let releaseLocal;const localGate=new Promise(r=>releaseLocal=r);let failSources=true;
  const cause={message:'SQLITE_BUSY https://private.example/read?token=secret-response'};
  const owner=fakeOwner({sources:makeSources(1),resultsFor:()=>[{bookId:'/book',title:'书',author:'作者'}]});
  const request=owner.request;owner.request=async(method,...args)=>{
    if(method==='bookshelf.list')await localGate;
    if(method==='source.list'&&failSources)throw cause;
    return request(method,...args);
  };
  const {orchestrator,presentations}=capture();const search=orchestrator(owner);search.open();search.search('书');
  await waitUntil(owner.state,()=>search.run.sourceListFailed);
  search.stop();const stopped=last(presentations);
  assert.equal(stopped.kind,'empty');assert.equal(stopped.stopped,true);
  assert.equal(search.run.sourceListFailureReason,cause.message);
  assert.equal(stopped.sourceListFailureMessage,'本地数据暂时无法读取，请稍后重试');
  assert.ok(!JSON.stringify(stopped).includes('secret-response'),'presentation never exposes raw error response');
  failSources=false;search.retry();releaseLocal();
  await waitUntil(owner.state,()=>last(presentations).kind==='results'&&!last(presentations).searching);
  assert.equal(search.run.sourceListFailureReason,undefined);
  assert.equal(last(presentations).sourceListFailureMessage,undefined);search.close();
};break;
case "branch-failure-stale": {
  let rejectOld;const oldGate=new Promise((_r,reject)=>rejectOld=reject);let localReads=0;
  const owner=fakeOwner({sources:makeSources(1),resultsFor:(_s,k)=>[{bookId:'/book-'+k,title:k,author:'作者'}]});
  const request=owner.request;owner.request=async(method,...args)=>{
    if(method==='bookshelf.list'&&++localReads===1)await oldGate;
    return request(method,...args);
  };
  const {orchestrator,presentations}=capture();const search=orchestrator(owner);search.open();search.search('旧');
  await waitUntil(owner.state,()=>localReads===1);search.search('新');
  await waitUntil(owner.state,()=>last(presentations).kind==='results'&&!last(presentations).searching);
  const current=search.run;rejectOld(Error('network private old response'));await sleep(20);
  assert.equal(search.run,current);assert.equal(current.localFailureReason,undefined);
  assert.equal(last(presentations).keyword,'新');assert.equal(last(presentations).localFailureMessage,undefined);
  assert.equal(search.branchFailureMessage('TIMEOUT token=secret'),'读取超时，请重试');
  assert.equal(search.branchFailureMessage('NETWORK_ERROR cookie=secret'),'连接暂时不可用，请稍后重试');
  assert.equal(search.branchFailureMessage('runtime closed'),'读取已中断，可重试');search.close();
};break;
case "source-failure-association": {
 const sources=makeSources(2),owner=fakeOwner({sources,delayForSource:()=>5,
  resultsFor:sourceId=>[{bookId:`/b-${sourceId}`,title:'鸣龙',author:'关关公子',variables:{}}]});
 const original=owner.request;
 const core=Object.assign(new Error('Internal error'),{event:{requestId:881,error:{code:'INTERNAL',message:'Internal error',retryable:false,
  details:{category:'SOURCE_HTTP_FAILED',cause:{category:'SOURCE_HTTP_FAILED',phase:'transport',stage:'request.dispatch',
   transient:false,platformCode:2300060,requestId:881,elapsedMs:32,url:'PRIVATE_URL',body:'PRIVATE_BODY'},
   host:{operationId:882,requestId:881,capability:'http.execute'}}}}});
 owner.request=async(command,params,options)=>{const result=await original(command,params,options);
  if(command==='book.search'&&params.sourceId==='source-0')throw core;return result;};
 const {orchestrator,presentations}=capture(),search=orchestrator(owner),safeLogs=[],priorWarn=hilog.warn;
 hilog.warn=(...values)=>safeLogs.push(values);
 try {
  search.open();search.search('鸣龙');await settle(owner.state,2);
  await waitUntil(owner.state,()=>search.run?.failures.size===1);
  assert.equal(search.run.failures.get('source-0').error,'Internal error');
  assert.equal(search.run.failures.get('source-0').diagnostic.platformCode,2300060);
  assert.equal(search.run.failures.get('source-0').diagnostic.requestId,881);
  const log=safeLogs.find(values=>values.includes('Search source %{private}s failed: %{private}s transport=%{public}s'));
  assert.ok(log);const summary=JSON.parse(log.at(-1));assert.equal(summary.operationId,882);
  assert.ok(!JSON.stringify(summary).includes('PRIVATE_'));assert.equal(last(presentations).failedSourceCount,1);
  assert.equal(last(presentations).results[0].sourceId,'source-1');
 } finally {hilog.warn=priorWarn;search.close();}
};break;
case "local-dense-pages": {
  const rows = Array.from({length: 260}, (_, i) => ({sourceId:'local',bookId:`id-${i}`,
    title:`目标书${i}`,author:'作者',intro:`简介${i}`}));
  rows.push({sourceId:'local',bookId:'目标书-id',title:'其他作品',author:'另一作者',intro:'不可展示'});
  rows.push({sourceId:'online',bookId:'remote',title:'目标书',author:'作者',intro:'远端'});
  const owner=localShelfOwner(rows);
  const found=await new SearchGateway(owner).searchLocalBooks('目标书','query-1');
  assert.equal(found.length,260);assert.equal(found[259].intro,'简介259');
  assert.deepEqual(owner.calls.filter(call=>!call.pageProjection).map(call=>call.offset),[0,128,256]);
  assert.equal(owner.calls.filter(call=>call.pageProjection).length,2);
  assert.ok(owner.calls.every(call=>call.keyword==='目标书'));
  assert.ok(found.every(book=>book.sourceId==='local'&&book.searchRequestId==='query-1'));
};break;
case "local-unicode": {
  const rows=Array.from({length:130},(_,i)=>({sourceId:'local',bookId:`id-${i}`,
    title:`other ${i}`,author:'作者',intro:`简介${i}`}));
  rows[129]={sourceId:'local',bookId:'kelvin',title:'汉Kelvin',author:'作者',intro:'Unicode 简介'};
  const owner=localShelfOwner(rows);
  const plain=await new SearchGateway(owner).searchLocalBooks('kelvin','unicode-1');
  assert.deepEqual(plain.map(book=>book.bookId),['kelvin']);
  assert.ok(owner.calls.every(call=>call.keyword===undefined),
    'SQLite ASCII lower() must not reject a Unicode-to-ASCII lowercase match');
  owner.calls.length=0;
  const mixed=await new SearchGateway(owner).searchLocalBooks('汉kelvin','unicode-2');
  assert.deepEqual(mixed.map(book=>book.bookId),['kelvin']);
  assert.ok(owner.calls.every(call=>call.keyword==='汉'),
    'a case-invariant Han substring is safe to push down');
};break;
case "local-sparse-hydration": {
  const rows=Array.from({length:513},(_,i)=>({sourceId:'local',bookId:`id-${i}`,
    title:`unrelated ${i}`,author:'作者',intro:`简介${i}`}));
  rows[4]={...rows[4],author:'KELVIN 作者'};
  rows[500]={sourceId:'local',bookId:'unicode-match',title:'Kelvin 手册',author:'作者',intro:'精确简介'};
  rows[501]={...rows[501],bookId:'kelvin-id-only'};
  rows.push({sourceId:'online',bookId:'remote',title:'Kelvin',author:'作者',intro:'远端'});
  const owner=localShelfOwner(rows);
  const found=await new SearchGateway(owner).searchLocalBooks('kelvin','sparse');
  assert.deepEqual(found.map(book=>book.bookId),['id-4','unicode-match'],
    'Host title/author semantics and shelf order exclude a bookId-only hit');
  assert.equal(found[1].intro,'精确简介');
  assert.deepEqual(owner.calls.filter(call=>call.pageProjection&&call.limit===128).map(call=>call.offset),
    [0,128,256,384,512], 'large sparse search scans bounded lightweight local pages');
  assert.deepEqual(owner.calls.filter(call=>call.method==='bookshelf.get').map(call=>call.bookId),
    ['id-4','unicode-match'], 'only exact title/author matches receive Full DTOs');
  assert.equal(owner.calls.filter(call=>call.method==='bookshelf.list'&&!call.pageProjection).length,0,
    'nonmatches and remote rows never receive Full DTOs');
};break;
case "local-density-switch": {
  const rows=Array.from({length:260},(_,i)=>({sourceId:'local',bookId:`id-${i}`,
    title:i<40||i===259?`needle ${i}`:`unrelated ${i}`,author:'作者',intro:`简介${i}`}));
  const owner=localShelfOwner(rows);
  const found=await new SearchGateway(owner).searchLocalBooks('needle','dense');
  assert.deepEqual(found.map(book=>book.bookId),[...Array.from({length:40},(_,i)=>`id-${i}`),'id-259']);
  assert.equal(found[0].intro,'简介0');assert.equal(found.at(-1).intro,'简介259');
  assert.deepEqual(owner.calls.filter(call=>call.method==='bookshelf.list'&&!call.pageProjection)
    .map(call=>call.offset),[0], 'a high-hit page uses one bounded Full DTO page');
  assert.deepEqual(owner.calls.filter(call=>call.method==='bookshelf.get').map(call=>call.bookId),
    ['id-259'], 'a sparse page still hydrates only its match');
};break;
case "local-hydration-revision": {
  const rows=Array.from({length:130},(_,i)=>({sourceId:'local',bookId:`id-${i}`,
    title:i===0?'Kelvin':'unrelated',author:'作者',intro:'旧简介'}));
  let mutated=false;
  const owner=localShelfOwner(rows,({method,params,rows:current})=>{
    if (!mutated&&method==='bookshelf.get'&&params.bookId==='id-0') {
      mutated=true;return current.map((book,i)=>i===0?{...book,intro:'新简介'}:book);
    }
  });
  const found=await new SearchGateway(owner).searchLocalBooks('kelvin','exact-revision');
  assert.deepEqual(found.map(book=>book.bookId),['id-0']);
  assert.equal(found[0].intro,'新简介', 'mutation during exact hydration restarts the whole scan');
  assert.equal(owner.calls.filter(call=>call.method==='bookshelf.get').length,2);
};break;
case "local-page-revision": {
  const rows=Array.from({length:130},(_,i)=>({sourceId:'local',bookId:`id-${i}`,
    title:i===129?'Kelvin':'unrelated',author:'作者',intro:'旧简介'}));
  let mutated=false;
  const owner=localShelfOwner(rows,({method,params,rows:current})=>{
    if (!mutated&&method==='bookshelf.list'&&params.pageProjection&&params.limit===128&&params.offset===0) {
      mutated=true;return current.map((book,i)=>i===129?{...book,intro:'新简介'}:book);
    }
  });
  const found=await new SearchGateway(owner).searchLocalBooks('kelvin','page-revision');
  assert.deepEqual(found.map(book=>book.bookId),['id-129']);
  assert.equal(found[0].intro,'新简介');
  assert.equal(owner.calls.filter(call=>call.pageProjection&&call.limit===128&&call.offset===0).length,2,
    'a changed lightweight page restarts the whole revision-bound scan');
  assert.equal(owner.calls.filter(call=>call.method==='bookshelf.get').length,1,
    'stale page candidates are never hydrated');
};break;
case "local-full-revision": {
  const rows=Array.from({length:130},(_,i)=>({sourceId:'local',bookId:`id-${i}`,
    title:`目标书${i}`,author:'作者',intro:`旧简介${i}`}));
  let mutated=false;
  const owner=localShelfOwner(rows,({params,revision,rows:current})=>{
    if (!mutated&&revision===1&&params.offset===128) {
      mutated=true;return current.map((book,i)=>i===0?{...book,intro:'新简介'}:book);
    }
  });
  const found=await new SearchGateway(owner).searchLocalBooks('目标书','revision');
  assert.equal(found.length,130);assert.equal(found[0].intro,'新简介');
  assert.equal(owner.calls.filter(call=>!call.pageProjection&&call.offset===0).length,2,
    'a changed revision must restart at the first page');
};break;
case "local-unstable-retry": {
  const rows=[{sourceId:'local',bookId:'one',title:'目标书',author:'作者',intro:'简介'}];
  const owner=localShelfOwner(rows,({rows:current})=>current.slice());
  await assert.rejects(new SearchGateway(owner).searchLocalBooks('目标书','unstable'),
    /shelf changed while reading/);
  assert.equal(owner.calls.filter(call=>!call.pageProjection).length,2,
    'an unstable shelf gets a bounded retry, not partial publication or an endless loop');
};break;
case "local-legacy-core": {
  const calls=[];
  const owner={request:async(method,params)=>{
    calls.push({method,params});
    return {data:{books:[
      {sourceId:'local',bookId:'local',title:'Kelvin',author:'作者',intro:'旧版简介'},
      {sourceId:'online',bookId:'remote',title:'Kelvin',author:'作者',intro:'远端'},
    ],total:2}};
  }};
  const found=await new SearchGateway(owner).searchLocalBooks('kelvin','legacy');
  assert.deepEqual(calls,[{method:'bookshelf.list',params:{}}],
    'legacy Core receives the original request without unsupported filters');
  assert.deepEqual(found.map(book=>book.bookId),['local']);
  assert.equal(found[0].intro,'旧版简介');
};break;
case "local-cancelled-pages": {
  const rows=Array.from({length:300},(_,i)=>({sourceId:'local',bookId:`id-${i}`,
    title:i===0?'新书':'unrelated',author:'作者',intro:`简介${i}`}));
  const shelf=localShelfOwner(rows);
  let releasePage;
  const pageGate=new Promise(resolve=>{releasePage=resolve;});
  let entered=false;
  let firstPage=true;
  let cancelledAtBoundary=false;
  const owner={
    supportsCoreCapability:shelf.supportsCoreCapability,
    request:async(method,params,options)=>{
      if (method==='source.list') return {data:{sources:[]}};
      if (method==='search.history.list') return {data:{keywords:[],count:0}};
      if (method==='search.history.add') return {data:{}};
      if (method==='bookshelf.list'&&params.pageProjection&&params.limit===128&&firstPage) {
        firstPage=false;entered=true;
        await pageGate;
        cancelledAtBoundary=options?.shouldCancel?.()===true;
      }
      return shelf.request(method,params,options);
    },
  };
  const {orchestrator,presentations}=capture();
  const search=orchestrator(owner);
  search.open();search.search('kelvin');
  await waitUntil(null,()=>entered);
  search.stop();releasePage();
  await sleep(20);
  assert.equal(cancelledAtBoundary,true,'stop marks the in-flight local Core request as cancelled');
  assert.equal(shelf.calls.filter(call=>call.pageProjection&&call.limit===128).length,1,
    'stopped search does not fetch a second page or hydrate stale candidates');
  search.search('新');
  await waitUntil(null,()=>last(presentations).kind==='results'&&!last(presentations).searching);
  assert.deepEqual(last(presentations).results.map(book=>book.bookId),['id-0']);
  assert.equal(shelf.calls.filter(call=>call.pageProjection&&call.limit===128).length,1,
    'new Han query leaves the cancelled ASCII page scan stopped');
  search.close();
};break;
default:throw Error('unknown case');}}finally{for(const search of ownedSearches)search.close();}
}
// Controlled upstream Node MockTimers drive both production timers and fixture
// waits. Wall time is only a deadlock diagnostic, never a performance oracle.
async function execute(id){
 const {mock}=await import('node:test');const {setImmediate:realImmediate}=await import('node:timers');
 const {performance}=await import('node:perf_hooks');const prior=globalThis.hilog;
 mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:1750000000000});
 let settled=false,failure;const started=performance.now();
 const work=runCase(id).then(()=>{settled=true;},error=>{failure=error;settled=true;});
 try{let ticks=0;while(!settled){await new Promise(realImmediate);mock.timers.tick(1);if(++ticks>20000||performance.now()-started>30000)throw Error('selected virtual search case failed to settle: '+id);}await work;if(failure)throw failure;}
 finally{mock.timers.reset();if(prior===undefined)delete globalThis.hilog;else globalThis.hilog=prior;}
}
for(const id of selectContractCases(definitions)){await execute(id);recordContractCasePass(id);}

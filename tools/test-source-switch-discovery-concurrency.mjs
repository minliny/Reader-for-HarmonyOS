import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { recordContractCasePass, selectContractCases } from './lib/contract-case-selection.mjs';

const cases = selectContractCases({
  'discovery-concurrency': 'Actual Gateway and scheduler: bounded per-source discovery, stable results and complete eligible-source sweep receipts.',
});

async function loadGateway() {
  const app = new URL('../entry/src/main/ets/', import.meta.url);
  const sdk = new URL('../entry/vendor/core-harmony/sdk/reader_core.ts', import.meta.url);
  const gateway = 'features/source/application/SourceSwitchGateway.ts';
  const runtimeSeam = 'data:text/javascript,export class ReaderRuntimeOwner {}';
  const modules = new Set([
    'app/BookRequestScheduler.ts',
    'app/ErrorMessage.ts',
    'app/library/BookAcquisitionPresentation.ts',
    'app/library/BookAuthorMetadata.ts',
    'app/library/BookSearchPageProgress.ts',
    'app/library/BookSearchTiming.ts',
    'features/reading/application/ReaderDirectoryDisplayMetadata.ts',
    'features/search/application/SearchBookProjection.ts',
    'features/search/application/SearchGateway.ts',
    'features/source/application/ReaderSourceCategory.ts',
    'features/source/application/SourceSwitchProviderFamily.ts',
  ].map(path => new URL(path, app).href));
  const runtime = new URL('app/ReaderRuntimeOwner', app).href;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (!context.parentURL?.startsWith(app.href)) return nextResolve(specifier, context);
      if (specifier === '@reader/core-harmony') return nextResolve(sdk.href, context);
      assert.ok(specifier.startsWith('.'), `unexpected Gateway dependency: ${specifier}`);
      const path = new URL(specifier, context.parentURL).href;
      // The case injects its RPC endpoint, so accessing the ambient runtime
      // owner would fail here rather than opening a real application runtime.
      if (path === runtime) return nextResolve(runtimeSeam, context);
      const source = path.endsWith('.ts') ? path : `${path}.ts`;
      assert.ok(modules.has(source), `unreviewed Gateway dependency: ${source}`);
      return nextResolve(source, context);
    },
  });
  try {
    return (await import(new URL(gateway, app).href)).SourceSwitchGateway;
  } finally {
    hooks.deregister();
  }
}

for (const id of cases) {
  const SourceSwitchGateway = await loadGateway();
  const eligible = Array.from({ length: 10 }, (_, index) => `candidate-${index}`);
  const discoveryCalls = [];
  const sweepReceipts = [];
  let active = 0;
  let maxActive = 0;
  const discoveryRuntime = {
    async request(method, params) {
      if (method === 'source.list') {
        assert.equal(params.enabledOnly, true);
        return { data: { sources: [
          ...eligible.map(sourceId => ({ sourceId, enabled: true })),
          { sourceId: 'disabled-source', enabled: false },
          { sourceId: 'comic-source', enabled: true, bookSource: { bookSourceType: 2 } },
        ] } };
      }
      assert.equal(method, 'book.search');
      assert.equal(params.keyword, 'Current Book');
      assert.equal(params.page, 1);
      assert.equal(params.sourceIds, undefined, 'each RPC owns one source timeout and failure boundary');
      const sourceId = params.sourceId;
      discoveryCalls.push(sourceId);
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        await new Promise(setImmediate);
        if (sourceId === 'candidate-3') throw new Error('one source timed out');
        return { data: { sourceId, books: [{ bookId: `/book/${sourceId}`, title: 'Current Book' }] } };
      } finally {
        active -= 1;
      }
    },
  };

  const gateway = new SourceSwitchGateway(discoveryRuntime);
  const result = await gateway.discoverCandidates(
    'current-source', 'current-book', 'Current Book', () => true, 'text', undefined, undefined,
    receipt => sweepReceipts.push(receipt),
  );
  assert.equal(result.kind, 'sources');
  assert.deepEqual([...discoveryCalls].sort(), eligible, 'every eligible source is dispatched once');
  assert.equal(maxActive, 8, 'discovery must be concurrent and bounded');
  assert.deepEqual(sweepReceipts, eligible.map((_, checked) => ({ checked, total: 10 })).concat({ checked: 10, total: 10 }),
    'the initial and terminal receipts count eligible sources, including each failure exactly once');
  assert.deepEqual(result.candidates.map(candidate => candidate.sourceId),
    eligible.filter(sourceId => sourceId !== 'candidate-3'), 'a failed source is skipped and registry order is kept');
  recordContractCasePass(id);
}

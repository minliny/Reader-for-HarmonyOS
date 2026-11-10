import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { registerHooks } from 'node:module';

async function catalogSeam() {
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const { sourceSwitchCatalogCurrentOwners } = await import('./lib/source-switch-catalog-current-owner-probe.mjs');
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/features/reading/application/BookAcquisitionCoordinator.ts');
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/application/ReadingSessionFlowGateway.ts');
const file = path => new URL(`../entry/src/main/ets/${path}`, import.meta.url);
const Source = selectedProductionMethods(file('features/source/application/SourceSwitchGateway.ts'), 'SourceSwitchGateway', ['fetchTargetToc', 'assertNonBlankString']);
const baseline = process.argv.includes('--baseline');
const settle = async () => { for (let n = 0; n < 300; n++) await Promise.resolve(); };
const sourceId = 'new', bookId = 'https://new.invalid/book', sourceVersion = 'v8';

function fixture(size) {
  const calls = [];
  const entries = Array.from({ length: size }, (_, index) => ({ index, title: `第${index + 1}章`,
    url: `https://new.invalid/${index}`, variables: {} }));
  const coordinator = new BookAcquisitionCoordinator(async (method, params, options) => {
    if (options?.shouldCancel?.()) throw Error('cancelled');
    calls.push({ method, params });
    if (method === 'source.list') return { data: { sources: [{ sourceId, sourceVersion, enabled: true }] } };
    if (method === 'search-book.get') return { data: { book: null } };
    if (method === 'cache.book.status') return { data: { sourceId, bookId, tocAvailable: false } };
    if (method === 'book.detail') return { data: { sourceId, sourceVersion,
      book: { bookId, title: '终宋', author: '作者' }, tocUrl: 'https://new.invalid/toc', variables: {} } };
    if (method === 'book.toc') return { data: { sourceId, bookId, sourceVersion, catalogVersion: 'new',
      contextVersion: 'context', catalogAt: Date.now(), toc: entries } };
    throw Error(`unexpected ${method}`);
  });
  const runtime = { bookAcquisitions: () => coordinator, request: (...args) => coordinator.request(...args) };
  const owners = sourceSwitchCatalogCurrentOwners(runtime);
  return { coordinator, runtime, owners, calls,
    source: Object.assign(new Source(), { runtimeOwner: runtime }),
    count: method => calls.filter(call => call.method === method).length };
}

const scenarios = [];
for (const size of [20, 990, 1370]) {
  const f = fixture(size);
  try {
    const toc = await f.source.fetchTargetToc(sourceId, bookId, () => true,
      { sourceId, bookUrl: bookId, bookName: '终宋', author: '作者', sourceVersion });
    assert.equal(f.count('book.toc'), 1);
    assert.equal(f.count('book.detail'), 1);
    f.owners.switchJourney.commit({ sourceId, bookId, title: '终宋', author: '作者' }, toc.readingSession, 17);
    await settle();
    const expected = baseline && size === 990 ? 2 : 1;
    assert.equal(f.count('book.toc'), expected,
      'an old source index near the new catalog end must not trigger another catalog request');
    assert.equal(f.count('book.detail'), expected);
    assert.equal(f.owners.entry.requestedChapterIndex, 17);
    assert.equal(f.owners.entry.directoryCurrentChapterIndex, -1);
    assert.equal(f.owners.entry.directoryChapterTitle, '');
    scenarios.push({ targetSize: size, oldDisplayedIndex: 988, matchedIndex: 17,
      detailCallsAfterSeam: f.count('book.detail'), tocCallsAfterSeam: f.count('book.toc') });
    if (baseline) continue;

    // The mounted reader receives the already admitted session. Opening its
    // gateway and catalog neither reacquires the book nor downloads a body.
    const gateway = await ReadingSessionFlowGateway.open({ sourceId, bookId,
      remoteSession: f.owners.entry.session, sourceSwitchTransactionId: 'tx', isCurrent: () => true,
      onRemoteSessionReady: session => f.owners.actions.acceptReaderSession(session),
      resolveSourceSwitchTransactionId: async () => 'tx' }, f.runtime);
    const loaded = await gateway.loadToc(bookId, () => true);
    assert.equal(loaded.entries.length, size);
    assert.equal(f.count('book.toc'), 1);
    assert.equal(f.count('book.detail'), 1);
    assert.equal(f.count('chapter.content'), 0);

    // Late callbacks from another identity cannot install a session, update
    // the admitted directory or trigger catalog work for the new source.
    const admitted = f.owners.entry.session, directory = f.owners.entry.toc;
    f.owners.actions.acceptReaderSession({ ...admitted, identity: { sourceId: 'old', bookId } });
    f.owners.commits.accept({ sourceId: 'old', bookId, chapterIndex: size - 1 });
    await settle();
    assert.equal(f.owners.entry.session, admitted);
    assert.equal(f.owners.entry.toc, directory);
    assert.equal(f.count('book.toc'), 1);

    // Real target chapter/commit callbacks still trigger the existing refresh
    // policy near the end. A successful refresh must not recursively reload.
    f.owners.entry.commitDirectoryChapter(f.runtime, size - 1, `第${size}章`, () => {});
    f.owners.commits.accept({ sourceId, bookId, chapterIndex: size - 1 });
    f.owners.commits.accept({ sourceId, bookId, chapterIndex: size - 1 });
    await settle();
    assert.equal(f.count('book.toc'), 2);
    assert.equal(f.count('book.detail'), 2);
    assert.equal(f.owners.entry.directoryCurrentChapterIndex, size - 1);
    assert.equal(f.owners.prefetch.refreshInFlight.size, 0);
    f.owners.actions.acceptReaderSession(f.owners.entry.session);
    f.owners.commits.accept({ sourceId, bookId, chapterIndex: size - 1 });
    await settle();
    assert.equal(f.count('book.toc'), 2, 'freshness and singleflight prevent a ready/refresh callback loop');
    assert.deepEqual(f.owners.diagnostics, [], 'the current catalog owner must accept the response without swallowed failures');
  } finally { f.owners.close(); f.coordinator.close(); }
}
console.log(JSON.stringify({ status: baseline ? 'BASELINE_REPRODUCED' : 'PASS', scenarios,
  boundary: 'Production acquisition/Coordinator, current ReaderSourceSwitchJourney/ReadingEntryPresentation/Host, Actions, ReadingCommitPresentation and ReadingPrefetchHost near-end refresh; rolling-body prefetch remains the original controlled outbound port. No HTTP/Core CLI/native/device claim.' }));

}
const definitions = {
  'catalog-seam': 'Actual source target acquisition, current committed-source entry, wrong-identity callbacks and 20/990/1370 catalog singleflight; controlled Core transport only',
};
for (const id of selectContractCases(definitions, { argv: process.argv.slice(2).filter(value => value !== '--baseline') })) {
  await catalogSeam();
  recordContractCasePass(id);
}

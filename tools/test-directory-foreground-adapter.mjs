import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'callback-contract': {
    description: 'The current SDK detail scene and directory retain original callback DTOs while deferring recovery actors. Explicit finite intent delivery keeps original generation and current opening guards.',
    resources: [],
  },
});

for (const id of selected) {
  const { fixture, cleanupDurableFixtures, book, session } = await import('./lib/reading-operation-durable-probe.mjs');
  const { makeIndex } = await import('./lib/reading-directory-sdk-consumer.mjs');
  const { projectPersistedReceipt } = await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
  let calls = 0;
  const f = await fixture(true, undefined, { domain: 'directory', transport: async () => {
    calls += 1;
    assert.fail('The SDK adapter case must not enter RPC or Core');
  } });
  let samples = 0;
  try {
    for (const leafName of ['ReaderFullDirectory', 'BookDirectoryPage']) {
      const x = makeIndex(f, { remote: true });
      const expectedBook = { ...book, sourceId: session.identity.sourceId };
      x.idx.directoryOperation = { action: 'createPosition', book: expectedBook, generation: 8,
        requestedCount: 1, confirmedCount: 0, completion: 'unknown', canContinueOriginal: true,
        projection: projectPersistedReceipt({ confirmation: 'unknown', readback: 'failed', generation: 8, canRetry: true }) };
      x.idx.offlineOperation = { action: 'clear', sourceId: expectedBook.sourceId, bookId: expectedBook.bookId,
        generation: 9, materialization: 'idle', canContinueOriginal: true,
        projection: projectPersistedReceipt({ confirmation: 'unknown', readback: 'failed', generation: 9, canRetry: true }) };
      const delivered = [];
      x.idx.directoryJourney.operations.reconcileBookmarks = (...args) => delivered.push(['bookmarks', ...args]);
      x.idx.directoryJourney.operations.reconcileOffline = (...args) => delivered.push(['offline', ...args]);
      const leaf = x.render(leafName);
      assert.deepEqual(x.actions(leaf), []);
      const recovery = leaf.directoryRecovery;
      for (const family of ['bookmarks', 'offline']) for (const continuing of [false, true]) {
        const submit = x.originalIntent(leaf, family, continuing);
        submit();
        assert.deepEqual(delivered.at(-1), [family, recovery[family].generation, recovery.presentationId, continuing]);
        samples += 1;
      }
      const retained = x.originalIntent(leaf, 'bookmarks', true);
      const count = delivered.length;
      x.idx.route = 'reading'; retained();
      assert.equal(delivered.length, count, 'the actual destination opening rejects a departed directory');
      x.idx.route = 'directory'; x.idx.directoryPresentationGeneration += 1; retained();
      assert.equal(delivered.length, count, 'an old opening cannot borrow a successor original callback');
      assert.equal(calls, 0);
    }
    const ordinary = makeIndex(f, { domain: 'bookmark' });
    const ordinaryCalls = [];
    ordinary.idx.directoryJourney.operations.reconcileBookmarks = (...args) => ordinaryCalls.push(args);
    ordinary.idx.reconcileDirectoryOperation(8, 'retained-original', true);
    assert.deepEqual(ordinaryCalls, [[8, 'retained-original', true]],
      'the ordinary legacy entry delegates to the actual current operation owner');
    assert.equal(calls, 0);
    samples += 1;
  } finally {
    await cleanupDurableFixtures();
  }
  console.log(JSON.stringify({ kind: 'directory-foreground-adapter', samples,
    boundary: 'Actual SDK Index/Scene/Destination DTO and callback construction with explicit finite operation method ports. No recovery buttons are created, and no RPC, Core, physical hit or original VM record is used.' }));
  recordContractCasePass(id);
}

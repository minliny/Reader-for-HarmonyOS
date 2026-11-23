import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'exact-next': {
    description: 'The two production intent stores retain the original DTO and only offer continuation for the exact next Core sequence when no receipt exists.',
    resources: [],
  },
});

for (const id of selected) {
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const source = readFileSync(new URL('../entry/src/main/ets/features/reading/application/ReadingOperationIntents.ts', import.meta.url), 'utf8');
  const uuid = '12345678-1234-4234-8123-123456789abc';
  const otherUuid = '87654321-4321-4321-8321-cba987654321';
  const context = { sourceId: 'source', bookId: 'book', title: 'Book', author: 'Author' };
  const fingerprint = '1'.repeat(64);
  const binding = (sequence, operationUuid = uuid) => ({ operationId: `${operationUuid}/${sequence}`, sequence, payloadFingerprint: fingerprint });

  function fixture(domain, scenario, code = source) {
    const sequence = scenario.sequence;
    const params = domain === 'bookmark' ? { operationId: `${uuid}/${sequence}`, sequence,
      bookName: 'Book', bookAuthor: 'Author', chapterIndex: 0, chapterPos: 0,
      chapterName: 'Chapter', bookText: 'body', content: 'note' } :
      { operationId: `${uuid}/${sequence}`, sequence, scope: 'book', sourceId: 'source', bookId: 'book' };
    const intent = { version: 1, method: domain === 'bookmark' ? 'bookmark.create' : 'cache.clear',
      params, context, phase: scenario.confirmed ? 'confirmed' : 'pending',
      ...(scenario.confirmed ? { binding: binding(sequence), result: {} } : {}) };
    const raw = JSON.stringify(intent);
    const calls = [], writes = [];
    const runtime = { getUIAbilityContext: () => ({ filesDir: '/finite-original-intent' }),
      async request(method, supplied) {
        calls.push({ method, params: structuredClone(supplied) });
        assert.equal(method, domain === 'bookmark' ? 'bookmark.operation.query' : 'cache.clear.operation.query');
        assert.equal(supplied.operationId, intent.params.operationId);
        assert.deepEqual(supplied.expected, domain === 'bookmark' ? { action: 'create', params } : params);
        const head = scenario.head === undefined ? null : binding(scenario.head);
        const receiptBinding = binding(sequence, otherUuid);
        const receipt = scenario.collision ? { binding: receiptBinding, phase: 'committed',
          ...(domain === 'bookmark' ? { outcome: { action: 'create', result: {} } } : { result: {} }) } : null;
        return { data: { head: scenario.collision ? receiptBinding : head, receipt } };
      } };
    class UnusedRequestError extends Error {}
    const types = pureModuleProbe(code, 'ReadingOperationIntents.ts', {
      fileIo: { async readText() { return raw; } },
      util: { generateRandomUUID() { assert.fail('recovery must retain the original operation ID'); } },
      ReaderRuntimeOwner: { isCurrent: owner => owner === runtime },
      replaceReaderAtomicSnapshot: async (_path, _directory, value) => { writes.push(value); },
      ReaderCoreRequestError: UnusedRequestError,
      isReaderCoreTransactionPendingError: () => false,
    }, ['BookmarkOperationIntentStore', 'CacheClearOperationIntentStore', 'ReadingOperationPendingError']);
    const Store = domain === 'bookmark' ? types.BookmarkOperationIntentStore : types.CacheClearOperationIntentStore;
    return { store: new Store(runtime, () => true), calls, writes, raw, params, types };
  }

  async function assertRecovery(domain, scenario, code = source) {
    const f = fixture(domain, scenario, code);
    await assert.rejects(f.store.reconcile(context, value => value, () => true), error => {
      assert.ok(error instanceof f.types.ReadingOperationPendingError);
      assert.equal(error.blocked, scenario.blocked, `${domain} ${scenario.name}: exact-next continuation admission`);
      assert.deepEqual(error.intent.params, f.params);
      return true;
    });
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.writes, [], 'pure reconciliation never rewrites, clears or renumbers the original intent');
    if (scenario.gap) {
      await assert.rejects(f.store.continueOriginal(context, value => value, undefined, () => true), error => error.blocked === true);
      assert.equal(f.calls.length, 2, 'an ineligible explicit continuation stops after its exact pure query');
      assert.deepEqual(f.writes, [], 'the impossible sequence never reaches intent rewrite or mutation dispatch');
    }
  }

  const scenarios = [
    { name: 'empty-head-gap', sequence: 2, blocked: true, gap: true },
    { name: 'retained-head-gap', head: 1, sequence: 3, blocked: true, gap: true },
    { name: 'empty-head-next', sequence: 1, blocked: false },
    { name: 'retained-head-next', head: 1, sequence: 2, blocked: false },
    { name: 'already-passed', head: 1, sequence: 1, blocked: true },
    { name: 'confirmed-receipt-missing', sequence: 1, confirmed: true, blocked: true },
    { name: 'receipt-identity-collision', sequence: 1, collision: true, blocked: true },
  ];
  for (const domain of ['bookmark', 'cacheClear']) {
    for (const scenario of scenarios) await assertRecovery(domain, scenario);
  }

  const gapGuard = /\n      if \(intent\.params\['sequence'\] !== \(head\?\.sequence \?\? 0\) \+ 1\)\n        throw new ReadingOperationPendingError\('[^']+', intent, true\);/;
  const previous = source.replace(gapGuard, '');
  assert.notEqual(previous, source, 'the old gap-admission mutation must change the exact new production guard');
  for (const domain of ['bookmark', 'cacheClear'])
    await assert.rejects(assertRecovery(domain, scenarios[0], previous), /exact-next continuation admission/);
  console.log(JSON.stringify({ kind: 'reading-intent-sequence-admission', scenarios: 14,
    explicitContinuationRejections: 4, oldGuardNegatives: 2,
    boundary: 'Actual SDK-emitted complete production intent store with finite journal reads and RPC response ports. No Core executable, durable filesystem write, Native interaction or original VM record was used.' }));
  recordContractCasePass(id);
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');
const factsSource = read('entry/src/main/ets/app/ReaderOperationFacts.ts');
const projectionSource = read('entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts')
  .replace(/^import \{[\s\S]*?\} from ['"]\.\/ReaderOperationFacts['"];\n/m, '');
assert.doesNotMatch(factsSource, /^import /m, 'operation facts must remain a pure leaf');
assert.match(projectionSource, /projectPersistedReceipt/);
const executable = stripTypeScriptTypes(`${factsSource}\n${projectionSource}`);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`;
const {
  projectOperationFacts,
  projectPersistedReceipt,
} = await import(moduleUrl);

// Existing data plus a failed refresh is still usable and retryable. It is
// not the same fact as a first-load failure.
{
  const facts = projectOperationFacts({ phase: 'failed', value: ['cached'], canRetry: true, generation: 4 });
  assert.equal(facts.fact, 'refreshFailed');
  assert.equal(facts.hasValue, true);
  assert.equal(facts.stale, true);
  assert.equal(facts.canRetry, true);
  assert.equal(facts.blocked, false);
  assert.equal(facts.generation, 4);

  const firstLoad = projectOperationFacts({ phase: 'failed', canRetry: true });
  assert.equal(firstLoad.fact, 'failed');
  assert.equal(firstLoad.hasValue, false);
  assert.equal(firstLoad.stale, false);
}

// Loading with an admitted value is a refresh, while loading without one is
// an initial load. The owner still decides whether cancellation is allowed.
{
  const refresh = projectOperationFacts({ phase: 'loading', value: { id: 1 }, canCancel: true });
  assert.equal(refresh.fact, 'refreshing');
  assert.equal(refresh.canCancel, true);
  const load = projectOperationFacts({ phase: 'loading' });
  assert.equal(load.fact, 'loading');
  assert.equal(load.hasValue, false);
}

// Cancellation preserves an admitted value but marks it stale so a page can
// offer the owner-provided retry/read action without pretending the value is
// current.
{
  const cancelled = projectOperationFacts({ phase: 'cancelled', value: { id: 2 } });
  assert.equal(cancelled.fact, 'cancelled');
  assert.equal(cancelled.hasValue, true);
  assert.equal(cancelled.stale, true);
}

// Stale and capability-blocked are explicit facts. A blocked operation is not
// silently converted to a transport failure and can retain cached content.
{
  const stale = projectOperationFacts({ phase: 'idle', value: ['old'], stale: true });
  assert.equal(stale.fact, 'stale');
  assert.equal(stale.stale, true);

  const blocked = projectOperationFacts({
    phase: 'refreshing', value: ['old'], blockedReason: 'TTS capability unavailable', canRetry: true,
  });
  assert.equal(blocked.fact, 'blocked');
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.hasValue, true);
  assert.equal(blocked.canRetry, true);
  assert.equal(blocked.blockedReason, 'TTS capability unavailable');
}

// The durable write/read-back projection preserves the existing commit fact
// table and keeps the refresh failure separate from the confirmed receipt.
{
  const failedRefresh = projectPersistedReceipt({
    confirmation: 'confirmed', readback: 'failed', value: { count: 3 },
    refreshError: 'source.list unavailable', canRetry: true, generation: 8,
  });
  assert.equal(failedRefresh.receipt.fact, 'confirmedRefreshFailed');
  assert.equal(failedRefresh.facts.fact, 'refreshFailed');
  assert.equal(failedRefresh.facts.hasValue, true);
  assert.equal(failedRefresh.facts.stale, true);
  assert.equal(failedRefresh.refreshError, 'source.list unavailable');
  assert.equal(failedRefresh.facts.canRetry, true);
  assert.equal(failedRefresh.facts.generation, 8);

  const failedWithoutRetainedValue = projectPersistedReceipt({
    confirmation: 'confirmed', readback: 'failed', refreshError: 'read-back unavailable', canRetry: true,
  });
  assert.equal(failedWithoutRetainedValue.facts.fact, 'refreshFailed',
    'confirmed write plus failed read-back stays distinct even without a payload');
  assert.equal(failedWithoutRetainedValue.facts.hasValue, false);
  assert.equal(failedWithoutRetainedValue.facts.canRetry, true);

  const pending = projectPersistedReceipt({
    confirmation: 'unknown', readback: 'succeeded', value: { count: 3 },
  });
  assert.equal(pending.receipt.fact, 'pendingReconciliation');
  assert.equal(pending.facts.fact, 'pendingReconciliation');
  assert.equal(pending.facts.stale, true);
  assert.equal(pending.facts.blocked, false);

  const notDispatched = projectPersistedReceipt({
    confirmation: 'undispatched', readback: 'failed', value: undefined,
  });
  assert.equal(notDispatched.receipt.fact, 'notDispatched');
  assert.equal(notDispatched.facts.fact, 'notDispatched');
  assert.equal(notDispatched.facts.hasValue, false);
}

// A blocked capability remains blocked even when the receipt is unknown; the
// adapter must not guess that the write failed or succeeded.
{
  const blocked = projectPersistedReceipt({
    confirmation: 'unknown', readback: 'idle', value: ['cached'],
    blockedReason: 'reconciliation unavailable',
  });
  assert.equal(blocked.receipt.fact, 'pendingReconciliation');
  assert.equal(blocked.facts.fact, 'blocked');
  assert.equal(blocked.facts.blocked, true);
  assert.equal(blocked.facts.stale, false);
}

console.log('operation facts and persisted receipt projection: PASS');

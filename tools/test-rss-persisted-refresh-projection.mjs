import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../entry/src/main/ets/features/rss/RssOrchestrator.ets', import.meta.url), 'utf8');

// RSS management mutates durable Core state and then reads the list back. The
// two phases must be represented by the shared receipt projection instead of
// silently dropping a confirmed write when the list read fails.
assert.match(source, /projectPersistedReceipt/);
assert.match(source, /type PersistedReceiptProjection/);
assert.match(source, /export interface RssManagementOperationProjection/);
assert.match(source, /private lastSubscriptions: RssSubscription\[\] = \[\]/);
assert.match(source, /this\.publishOperation\(action, subscriptionId, session, 'reading', undefined, undefined, confirmation\)/);
assert.match(source, /this\.publishOperation\(action, subscriptionId, session, 'failed', refreshError, undefined, confirmation\)/);
assert.match(source, /value: value \?\? \(this\.hasSubscriptions \? this\.lastSubscriptions : undefined\)/);
assert.match(source, /stale: readback === 'failed'/);
assert.match(source, /canRetry: confirmation !== 'undispatched' && readback !== 'reading'/);
assert.match(source, /this\.publishOperation\(action, subscriptionId, session, 'succeeded', undefined, subscriptions, confirmation\)/);
assert.match(source, /this\.latestOperation = operation/);

console.log('RSS persisted-write/read-back projection contract: PASS');

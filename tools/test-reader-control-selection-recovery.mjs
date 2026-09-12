import assert from 'node:assert/strict';
import * as selection from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';
const ticket = { sourceId: 'local', bookId: 'book', lifecycleToken: 1, selectionToken: 2,
  controlOpenRevision: 3, targetChapterIndex: 10 };
const owner = { ...ticket, mounted: true, exitRequested: false, controlVisible: true, controlClosing: false };
assert.equal(selection.readerControlSelectionMayRecover(ticket, owner, true, 'unverified'), false,
  'a prior display alone cannot authorize rollback when the Core write result is uncertain');
const { reconcileReaderControlSelectionProgress, readerControlSelectionRecoveryAction } = selection;

const origin = { chapterIndex: 2, pageStartScalar: 0, visibleScalar: 450,
  scalarCount: 2000, continuous: true };
const target = { chapterIndex: 10, pageStartScalar: 120, visibleScalar: 120,
  scalarCount: 3000, continuous: false };
const stored = { bookId: 'book', chapterIndex: 10, chapterOffset: 120,
  chapterProgress: 0.04, updatedAt: 1, locationRevision: 'new' };
let current = true;
let core = stored;
const order = [];
let releaseWrite;
const dispatchedWrite = new Promise(resolve => { releaseWrite = resolve; });
const operation = reconcileReaderControlSelectionProgress({
  isCurrent: () => current,
  runSerial: async action => { await dispatchedWrite; order.push('serial'); await action(); },
  readProgress: async () => { order.push('read'); return core; },
});
assert.deepEqual(order, [], 'reconciliation waits behind dispatched writes');
// The write succeeded, but its caller received a timeout/invalid result. Only
// the subsequently read Core row, not that exception, decides what to display.
releaseWrite();
const verified = await operation;
assert.equal(verified.kind, 'verified');
assert.equal(readerControlSelectionRecoveryAction(verified, origin, target), 'target');
assert.deepEqual(order, ['serial', 'read']);

core = { ...stored, chapterIndex: 2, chapterOffset: 450, chapterProgress: 0.225 };
const continuous = await reconcileReaderControlSelectionProgress({
  isCurrent: () => true, runSerial: async action => action(), readProgress: async () => core,
});
assert.equal(readerControlSelectionRecoveryAction(continuous, origin, target), 'origin',
  'continuous committed offset is not incorrectly compared with the paged start scalar');
assert.equal(readerControlSelectionRecoveryAction(continuous, origin,
  { ...origin, pageStartScalar: 800, visibleScalar: 800 }), 'origin',
  'a failed same-chapter continuous jump is not mistaken for its uncommitted target');
assert.equal(readerControlSelectionRecoveryAction(continuous, { ...origin, continuous: false }, target), 'blocked',
  'a paged origin cannot pretend to display a different committed scalar');
for (const unavailable of [undefined, { ...stored, chapterOffset: NaN }]) {
  const result = await reconcileReaderControlSelectionProgress({
    isCurrent: () => true, runSerial: async action => action(), readProgress: async () => unavailable,
  });
  assert.equal(result.kind, 'unavailable');
  assert.equal(readerControlSelectionRecoveryAction(result, origin, target), 'blocked',
    'uncertain persistence must not authorize an old-display rollback');
}
const failed = await reconcileReaderControlSelectionProgress({
  isCurrent: () => true, runSerial: async action => action(), readProgress: async () => { throw new Error('offline'); },
});
assert.equal(failed.kind, 'unavailable');
assert.equal(failed.errorCode, 'offline');
current = false;
let staleReadCount = 0;
const stale = await reconcileReaderControlSelectionProgress({
  isCurrent: () => current, runSerial: async action => action(),
  readProgress: async () => { staleReadCount += 1; return stored; },
});
assert.equal(stale.kind, 'obsolete');
assert.equal(staleReadCount, 0);
current = true;
const superseded = await reconcileReaderControlSelectionProgress({
  isCurrent: () => current, runSerial: async action => action(),
  readProgress: async () => { current = false; return stored; },
});
assert.equal(superseded.kind, 'obsolete', 'new selection invalidates a read that was already running');
assert.equal(readerControlSelectionRecoveryAction(superseded, origin, target), 'obsolete');
console.log('reader control selection production reconciliation: PASS');

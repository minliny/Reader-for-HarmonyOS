import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  readerControlSelectionMayClose,
  readerControlSelectionMayRecover,
  readerControlSelectionOwnsReading,
} from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';

const ticket = {
  sourceId: 'local', bookId: 'book-A', lifecycleToken: 4, selectionToken: 20,
  controlOpenRevision: 6, targetChapterIndex: 10,
};
const owner = {
  sourceId: 'local', bookId: 'book-A', lifecycleToken: 4, selectionToken: 20,
  controlOpenRevision: 6, mounted: true, exitRequested: false,
  controlVisible: true, controlClosing: false,
};
const committed = {
  phaseReady: true, materializedSelectionToken: 20, visibleSelectionToken: 20,
  visibleChapterIndex: 10, visiblePageStartScalar: 123,
  storedChapterIndex: 10, storedChapterOffset: 123,
};
assert.equal(readerControlSelectionMayClose(ticket, owner, committed), true);
assert.equal(readerControlSelectionMayClose({ ...ticket, closeOnCommit: false }, owner, committed), false);
assert.equal(readerControlSelectionOwnsReading({ ...ticket, closeOnCommit: false }, owner), true,
  'keeping the panel open does not remove reading transaction/recovery ownership');
assert.equal(readerControlSelectionMayClose(ticket, owner, { ...committed, phaseReady: false }), false,
  'downloaded/measuring content is not a completed reading jump');
for (const changed of [
  { storedChapterIndex: 11 }, { storedChapterOffset: 0 }, { visibleChapterIndex: 11 },
  { materializedSelectionToken: 19 }, { visibleSelectionToken: 19 },
  { visiblePageStartScalar: -1, storedChapterOffset: -1 },
  { visiblePageStartScalar: NaN, storedChapterOffset: NaN },
]) {
  assert.equal(readerControlSelectionMayClose(ticket, owner, { ...committed, ...changed }), false,
    `uncommitted/mismatched actual page cannot close: ${JSON.stringify(changed)}`);
}
for (const changed of [
  { sourceId: 'remote' }, { bookId: 'book-B' }, { lifecycleToken: 5 }, { selectionToken: 21 },
  { mounted: false }, { exitRequested: true },
]) {
  const next = { ...owner, ...changed };
  assert.equal(readerControlSelectionOwnsReading(ticket, next), false);
  assert.equal(readerControlSelectionMayClose(ticket, next, committed), false);
  assert.equal(readerControlSelectionMayRecover(ticket, next, true, 'origin-confirmed'), false,
    'old reading work cannot restore a different current transaction');
}
for (const changed of [
  { controlOpenRevision: 7 }, { controlVisible: false }, { controlClosing: true },
]) {
  const next = { ...owner, ...changed };
  assert.equal(readerControlSelectionOwnsReading(ticket, next), true,
    'UI closing/reopening does not undo a still-valid reading choice');
  assert.equal(readerControlSelectionMayClose(ticket, next, committed), false,
    'an old choice cannot close a newer opening or issue a second closing command');
  assert.equal(readerControlSelectionMayRecover(ticket, next, true, 'origin-confirmed'), true,
    'failed reading work can restore its origin without reopening or closing UI');
}
assert.equal(readerControlSelectionMayRecover(ticket, owner, false, 'origin-confirmed'), false,
  'no fabricated origin is admitted when there is no previously committed page');
const snapshot = structuredClone({ ticket, owner, committed });
readerControlSelectionMayClose(ticket, owner, committed);
readerControlSelectionMayRecover(ticket, owner, true);
assert.deepEqual({ ticket, owner, committed }, snapshot,
  'transaction policy decisions must not mutate business progress or UI ownership');

// Additional wiring checks: they do not substitute for the production policy
// execution above, an ArkTS compile, or real asynchronous UI integration.
const host = fs.readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url), 'utf8');
const select = host.match(/private selectChapterAnchor\(([\s\S]*?)\n  private controlSelectionOwner/)?.[1];
assert.ok(select);
assert.doesNotMatch(select, /this\.hideControl\(/, 'chapter loading must not close controls');
assert.match(select, /controlOwnerRevision: number = -2/,
  'deferred selection carries its original UI ownership instead of borrowing a reopened panel');
assert.match(host, /this\.admitCommittedProgress\(stored\);\s*this\.completeControlSelectionAfterCommit\(stored, visiblePage, selectionToken, lifecycleToken\);/,
  'closing is evaluated after the actual stored page anchor is admitted');
const recovery = host.match(/private recoverControlSelectionFailure\(([\s\S]*?)\n  private captureMaterializedChapterContext/)?.[1];
assert.ok(recovery);
assert.match(recovery, /reconcileReaderControlSelectionProgress/);
assert.match(recovery, /this\.restoreMaterializedChapterContext\(display\.context, true\)/);
assert.match(recovery, /this\.chapterSelectionToken \+= 1;/);
assert.match(recovery, /this\.resetForChapterSelection\(\);/,
  'timeout recovery invalidates the failed load before restoring its committed origin');
assert.match(recovery, /this\.phase = 'ready'/);
assert.match(recovery, /showAlertDialog\(/, 'recoverable failure must remain visible to the user');
assert.doesNotMatch(recovery, /this\.onReadingFailure\(|this\.beginExit\(|this\.hideControl\(|resolveAndUpdateProgress\(/,
  'recoverable failure restores the display without external exit, hiding, or rolling back Core');
assert.match(host, /if \(this\.recoverControlSelectionFailure\(error, lifecycleToken\)\) return;/);
console.log('reader control selection transaction: production ownership/commit policy passed');

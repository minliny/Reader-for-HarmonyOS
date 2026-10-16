import assert from 'node:assert/strict';
import fs from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
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
assert.match(select, /if \(closeControlOnCommit && selectionControlRevision === this\.controlOpenRevision &&\s*this\.controlVisible\(\) && !this\.controlShellExitArmed\(\)\)\s*this\.hideControl\(\);/,
  'discrete selection exposes loading immediately, preserving the original control owner and slider policy');
assert.match(select, /controlOwnerRevision: number = -2/,
  'deferred selection carries its original UI ownership instead of borrowing a reopened panel');
assert.match(host, /this\.admitCommittedProgress\(stored\);\s*this\.completeControlSelectionAfterCommit\(stored, visiblePage, selectionToken, lifecycleToken\);/,
  'a reading ticket completes only after the actual stored page anchor is admitted');
const recovery = host.match(/private recoverControlSelectionFailure\(([\s\S]*?)\n  private captureMaterializedChapterContext/)?.[1];
assert.ok(recovery);
assert.match(recovery, /reconcileReaderControlSelectionProgress/);
assert.match(recovery, /this\.restoreMaterializedChapterContext\(display\.context, true\)/);
assert.match(recovery, /this\.chapterSelectionToken \+= 1;/);
assert.match(recovery, /this\.resetForChapterSelection\(\);/,
  'timeout recovery invalidates the failed load before restoring its committed origin');
assert.match(recovery, /this\.phase = 'ready'/);
assert.match(recovery, /this\.showReaderRecovery\(/, 'recoverable failure is projected through the inline recovery state');
assert.doesNotMatch(recovery, /this\.showReaderAlert\(|showAlertDialog\(/,
  'automatic selection recovery cannot claim a modal dialog');
assert.doesNotMatch(recovery, /this\.onReadingFailure\(|this\.beginExit\(|this\.hideControl\(|resolveAndUpdateProgress\(/,
  'recoverable failure restores the display without external exit, hiding, or rolling back Core');
assert.match(host, /if \(this\.recoverControlSelectionFailure\(error, lifecycleToken\)\) return;/);

const FeedbackHost = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['showControlSelectionFailure', 'showReaderRecovery'], { readerControlSelectionOwnsReading, hilog: { error() {} } });
for (const changed of [{}, {bookId:'book-B'}, {sourceId:'remote'}, {lifecycleToken:5},
  {selectionToken:21}, {mounted:false}, {exitRequested:true}]) {
  const current={...owner,...changed}, selections=[];
  const retry={chapterIndex:10,chapterOffset:123,requireChapterStart:false,stopTts:true,
    requestedProgress:.2,controlOwnerRevision:6,closeControlOnCommit:true,refreshContent:false,
    positionContext:{bodyVersion:'body',processingVersion:'rules',anchors:[{id:'requested',offset:123}]}};
  const previousProgress={chapterIndex:2,chapterOffset:80};
  const feedback=Object.assign(new FeedbackHost(),{
    phase:'ready',lastCommittedProgress:previousProgress,pendingControlSelectionRetry:retry,
    errorMessage:error=>error.message,finishPageTurnPerf(){},controlSelectionOwner:()=>current,
    selectChapterAnchor:(...args)=>selections.push(args),
    getUIContext(){assert.fail('automatic failure must never open a modal');},
  });
  feedback.showControlSelectionFailure(ticket,Error('timeout'),'origin is confirmed');
  assert.equal(feedback.readerRecoveryView.visible,true);assert.equal(feedback.readerRecoveryView.canRetry,true);
  assert.equal(feedback.readerRecoveryActionLabel,'重试');
  assert.equal(feedback.lastCommittedProgress,previousProgress,'feedback cannot rewrite durable or displayed progress');
  assert.equal(feedback.phase,'ready','an inline notice cannot replace the confirmed reading page');
  feedback.readerRecoveryAction();
  assert.equal(selections.length,Object.keys(changed).length===0?1:0,
    'an optional retry remains bound to its original reading transaction');
  if(selections.length) {
    assert.deepEqual(selections[0].slice(0,3),[10,123,false]);
    assert.equal(selections[0][5],6,'retry cannot borrow a newer control opening');
    assert.equal(selections[0][8],retry.positionContext,'retry preserves original body and processing proof');
  }
}
console.log('reader control selection transaction: production ownership/commit policy passed');

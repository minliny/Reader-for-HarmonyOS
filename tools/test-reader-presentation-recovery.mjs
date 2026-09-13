import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
class Frame { constructor(callback) { this.callback = callback; } }
const Host = productionMotionMethods(file,
  ['scheduleBookTurnSurfaceRelease', 'confirmBookTurnPresented'], { ReaderUIFrameCallback: Frame });
function host() {
  const frames = [], calls = [];
  const value = Object.assign(new Host(), { mounted: true, exitRequested: false,
    pageTurnSettlementGeneration: 4, bookTurnSurfaceGeneration: 4, pageTurnRenderRevision: 9,
    bookTurnArkUIContentRevision: 8, bookTurnArkUIReadyRevision: 8,
    bookTurnSurfaceOpacity: 1, pageTurnPresentationPhase: 'logicalPromoted',
    bookTurnAwaitingSlotCommit: false, usesBookTurnSimulation: () => true,
    getUIContext: () => ({ postFrameCallback: f => frames.push(f) }),
    bookTurnSession: { releaseTerminalFrame: g => { calls.push(['release', g]); return true; },
      clearSurface: g => calls.push(['clear', g]) },
  });
  return { value, calls, drain() { while (frames.length) frames.shift().callback(); } };
}
{
  const h = host(); h.value.scheduleBookTurnSurfaceRelease(4); h.drain();
  assert.equal(h.value.bookTurnSurfaceOpacity, 1, 'two scheduled callbacks cannot admit an old content revision');
  assert.deepEqual(h.calls, []);
  h.value.confirmBookTurnPresented(4); h.drain();
  assert.deepEqual(h.calls, [], 'direct confirmation also requires current ready revision');
  h.value.bookTurnArkUIReadyRevision = 9; h.value.bookTurnArkUIContentRevision = 9;
  h.value.scheduleBookTurnSurfaceRelease(4); h.drain();
  assert.equal(h.value.bookTurnSurfaceOpacity, 0); assert.deepEqual(h.calls, [['release', 4], ['clear', 4]]);
}
{
  const h = host(); h.value.bookTurnArkUIReadyRevision = 9; h.value.bookTurnArkUIContentRevision = 9;
  h.value.scheduleBookTurnSurfaceRelease(4); h.value.bookTurnSurfaceGeneration = 5; h.drain();
  assert.deepEqual(h.calls, [], 'an old release cannot clear a replacement generation');
}
console.log('production target-revision and stale-generation release guards: PASS');

let deadline;
const Recovery = productionMotionMethods(file, ['requestBookTurn2DFallback', 'completeBookTurn2DFallback',
  'onBookTurnArkUIContentReady', 'armPageTurnSettlementDeadline'], {
  setTimeout: callback => { deadline = callback; return 1; },
  PAGE_TURN_SETTLEMENT_DEADLINE_MS: 2000, hilog: { warn() {} },
});
function recovery(ready) {
  const calls = [];
  const value = Object.assign(new Recovery(), { mounted: true, exitRequested: false, pageTurnSettlementActive: true,
    pageTurnSettlementGeneration: 4, bookTurnSurfaceGeneration: 4, pageTurnRenderRevision: 9,
    bookTurnArkUIReadyRevision: ready ? 9 : 8, bookTurnSurfaceOpacity: 1, bookTurnAwaitingSlotCommit: true,
    pageTurnCommitSucceeded: true, pageTurnSettlingPrepared: undefined,
    bookTurnSession: { completedTerminalGeneration: () => 0, committedSlotsGeneration: () => 0,
      releaseTerminalFrame: () => calls.push('release'), clearSurface: () => calls.push('clear') },
    clearBookTurnCapturedIdentities() {}, cancelPageTurnSettlementDeadline() {},
    finishSuccessfulPageTurnPresentation() { calls.push('durable-2d'); this.pageTurnSettlementActive = false; },
    finishPageTurnRollback() { calls.push('rollback'); }, getUIContext: () => ({ showAlertDialog: () => calls.push('retry-ui') }) });
  return { value, calls };
}
{
  const h = recovery(true); h.value.armPageTurnSettlementDeadline(4); deadline();
  assert.deepEqual(h.calls, ['release', 'clear', 'durable-2d'], 'lost slot ACK uses admitted opaque target instead of infinite native retries');
  assert.equal(h.value.bookTurnRuntimeFailed, true); assert.equal(h.value.pageTurnSettlementActive, false);
}
{
  const h = recovery(false); h.value.armPageTurnSettlementDeadline(4); deadline();
  assert.deepEqual(h.calls, ['retry-ui']); assert.equal(h.value.bookTurnSurfaceOpacity, 1);
  assert.equal(h.value.pageTurnRenderRevision, 10);
  h.value.onBookTurnArkUIContentReady(9); assert.deepEqual(h.calls, ['retry-ui']);
  h.value.onBookTurnArkUIContentReady(10); assert.deepEqual(h.calls, ['retry-ui', 'release', 'clear', 'durable-2d']);
}
console.log('production dropped-native-ACK, unadmitted revision and stable 2D recovery: PASS');

import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { observeReaderProgressOperation, reconcileReaderControlSelectionProgress } from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';
const observe = operation => observeReaderProgressOperation(operation, 5);
let release;
const pending = new Promise(resolve => { release = resolve; });
assert.equal(await observe(pending), 'unknown', 'a never-returning operation cannot make UI await forever');
let reads = 0;
const unavailable = await reconcileReaderControlSelectionProgress({ isCurrent: () => true,
  runSerial: async action => { await pending; await action(); }, readProgress: async () => { reads++; }, observationTimeoutMs: 5 });
assert.equal(unavailable.errorCode, 'READING_PROGRESS_RECONCILIATION_UNKNOWN');
release(); await new Promise(r => setImmediate(r));
assert.equal(reads, 0, 'an expired queued query is inert without releasing or overtaking the actual write');

const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const Page = productionMotionMethods(file, ['beginPreparedPageTurnPersistence', 'admitPageTurnPersistenceOutcome'],
  { observeReaderProgressOperation: observe });
let completeWrite, completed = 0, dialogs = 0, current = true;
const write = new Promise(resolve => { completeWrite = resolve; });
const page = Object.assign(new Page(), { pageTurnSettlementGeneration: 7, pageTurnCommitStarted: false,
  persistPreparedPageTurn: () => write, isPreparedPageTurnCommitCurrent: () => current,
  cancelPageTurnSettlementDeadline() {}, getUIContext: () => ({ showAlertDialog: () => dialogs++ }),
  finishPreparedPageTurnSettlement() { completed++; current = false; } });
page.beginPreparedPageTurnPersistence({}, 1, 7);
await new Promise(r => setTimeout(r, 12));
assert.equal(page.pageTurnPersistenceState, 'unknown'); assert.equal(dialogs, 1); assert.equal(completed, 0);
completeWrite(true); await new Promise(r => setImmediate(r));
assert.equal(completed, 1); assert.equal(page.pageTurnPersistenceState, 'durable');
page.admitPageTurnPersistenceOutcome({}, 1, 7, true); assert.equal(completed, 1);

class Anchor { constructor(chapterIndex, chapterOffset, chapterProgress) { Object.assign(this, { chapterIndex, chapterOffset, chapterProgress }); } }
const Continuous = productionMotionMethods(file, ['commitContinuousProgress', 'drainContinuousProgress',
  'persistContinuousProgress', 'reconcileContinuousUnknownProgress'],
  { CoreReadingAnchor: Anchor, hilog: { error() {} }, observeReaderProgressOperation: observe, reconcileReaderControlSelectionProgress });
function continuous(gateway) {
  return Object.assign(new Continuous(), { phase: 'ready', chapter: { chapterIndex: 2, chapterTitle: 'two' },
    chapterLayoutMap: { scalarCount: () => 100 }, chapterSelectionToken: 1, materializedChapterSelectionToken: 1,
    sourceId: 's', bookId: 'b', readerSettingsSnapshot: { navigationMode: 'continuous' }, continuousFragments: [{}],
    continuousVisibleScalar: 10, continuousProgressRevision: 1, continuousCommitPending: false,
    isMountedToken: () => true, coreLayout: () => ({}), onAutoPagePageCommitted() {}, drainRapidPageTurn() {},
    admitCommittedProgress(value) { this.lastCommittedProgress = value; }, errorMessage: e => e.message,
    activeGateway: () => gateway });
}
{
  let releaseWrite, writes = 0;
  const realWrite = new Promise(resolve => { releaseWrite = resolve; });
  const c = continuous({ runProgressCommitSerial: op => op(), resolveAndUpdateProgress: async (_b, _t, anchor) => {
    writes++; await realWrite; return { ...anchor, sourceId: 's', bookId: 'b' };
  } });
  await assert.rejects(c.commitContinuousProgress(1), /UNKNOWN/);
  assert.equal(c.continuousCommitInFlight, true, 'deadline retains the actual single drain');
  c.continuousVisibleScalar = 60; c.continuousProgressRevision++;
  await assert.rejects(c.commitContinuousProgress(1), /UNKNOWN/); assert.equal(writes, 1);
  releaseWrite(); await new Promise(r => setImmediate(r));
  assert.equal(writes, 2); assert.equal(c.lastCommittedProgress.chapterOffset, 60);
  assert.equal(c.continuousCommitInFlight, false);
}
for (const mode of ['unavailable', 'foreign']) {
  let writes = 0, reads = 0;
  const c = continuous({ runProgressCommitSerial: op => op(), resolveAndUpdateProgress: async () => { writes++; throw Error('reply lost'); },
    loadProgress: async () => { reads++; if (mode === 'unavailable') throw Error('read failed');
      return { kind: 'restored', progress: { bookId: 'b', chapterIndex: 8, chapterOffset: 90, updatedAt: 2 } }; } });
  await assert.rejects(c.commitContinuousProgress(1), /UNKNOWN|FOREIGN/);
  await assert.rejects(c.commitContinuousProgress(1), /UNKNOWN|FOREIGN/);
  assert.equal(writes, 1, 'retry reads authority instead of repeating the unknown write'); assert.equal(reads, 2);
}
console.log('production finite unknown observation, queued query expiry, late durable and continuous single drain: PASS');

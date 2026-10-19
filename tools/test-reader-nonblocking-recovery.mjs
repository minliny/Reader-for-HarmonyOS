import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "render-recovery": {
    "description": "Actual unknown receipt/render fallback releases input and preserves user notice; modal getter throws",
    "resources": []
  },
  "continuous-progress-retry": {
    "description": "Actual continuous failure stays silent and following commit succeeds",
    "resources": []
  },
  "exit-during-persistence": {
    "description": "Actual Back interrupts waiting receipt and old finally cannot release newer generation",
    "resources": []
  }
};

async function case_render_recovery() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const path = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const Reader = productionMotionMethods(path, ['showReaderRecovery', 'reconcileReaderRecovery',
  'admitPageTurnPersistenceOutcome', 'releasePageTurnRecoveryInput', 'requestBookTurn2DFallback']);
const events = [];
const prepared = {};
const reader = Object.assign(new Reader(), { mounted: true, exitRequested: false, pageTurnSettlementActive: true,
  pageTurnSettlementGeneration: 3, pageTurnSettlingPrepared: prepared,
  readerRecoveryView: { message: '', visible: false, canRetry: false, generation: 0 },
  isPreparedPageTurnCommitCurrent(candidate, life, generation) { return candidate === prepared && generation === this.pageTurnSettlementGeneration; },
  activeGateway: () => ({ handoffPendingProgress() { events.push('handoff'); } }),
  invalidatePageTurnRuntime(restore) { assert.equal(restore, true); events.push('resident'); this.pageTurnSettlementActive = false; this.pageTurnInputOwned = false; this.pageTurnSettlementGeneration++; },
  resumeDeferredPageTurnWork() { events.push('resume'); },
  getUIContext() { throw Error('automatic recovery must not create a modal'); },
});
reader.admitPageTurnPersistenceOutcome(prepared, 1, 3, undefined);
assert.deepEqual(events, ['handoff', 'resident', 'resume']);
assert.equal(reader.pageTurnInputOwned, false); assert.equal(reader.pageTurnSettlementActive, false);
assert.equal(reader.bookTurnRuntimeFailed, true);
assert.deepEqual(reader.readerRecoveryView, { message: '', visible: false, canRetry: false, generation: 0 },
  'background bookkeeping must remain silent without creating a notice');
reader.admitPageTurnPersistenceOutcome(prepared, 1, 3, true);
assert.deepEqual(events, ['handoff', 'resident', 'resume'], 'late ACK cannot promote a retired candidate');
reader.pageTurnSettlementActive = true;
reader.completeBookTurn2DFallback = () => false;
const generalNotice = { message: '用户主动操作尚未完成', visible: true, canRetry: true, generation: 8 };
reader.readerRecoveryView = generalNotice;
reader.requestBookTurn2DFallback(4);
assert.deepEqual(events.slice(3), ['handoff', 'resident', 'resume'], 'lost render acknowledgement releases controls and Back');
assert.equal(reader.readerRecoveryView, generalNotice, 'automatic rendering recovery cannot replace an existing user-operation notice');

}

async function case_continuous_progress_retry() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const path = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const Continuous = productionMotionMethods(path, ['onContinuousScrollStopped']);
let attempts = 0, notifications = 0, completed = 0;
const continuous = Object.assign(new Continuous(), { mounted: true, exitRequested: false,
  rapidPageTurnState: { inFlightDirection: 'next' }, lifecycleToken: 1,
  chapterSelectionToken: 2, pageTurnTransactionSerial: 3,
  commitContinuousProgress: async () => { attempts++; throw Error('save remains pending'); },
  getUIContext() { notifications++; throw Error('automatic save cannot request feedback'); },
  isMountedToken: () => true, completeRapidPageTurnTransaction() { completed++; }, drainRapidPageTurn() {},
});
continuous.onContinuousScrollStopped();
await new Promise(resolve => setImmediate(resolve));
assert.equal(attempts, 1); assert.equal(notifications, 0); assert.equal(completed, 0);
continuous.commitContinuousProgress = async () => { attempts++; };
continuous.onContinuousScrollStopped();
await new Promise(resolve => setImmediate(resolve));
assert.equal(attempts, 2); assert.equal(completed, 1, 'silent presentation does not disable the next real progress commit');

}

async function case_exit_during_persistence() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const path = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const Exit = productionMotionMethods(path, ['beginExit'], { cancelReaderRapidPageTurn: state => state });
const exitEvents = [];
const exitOwner = Object.assign(new Exit(), { lifecycleToken: 1, mounted: true, exitRequested: false,
  pageTurnSettlementActive: true, pageTurnCommitStarted: true, pageTurnCommitFinished: false,
  autoPageCoordinator: { cancelPendingTurn() {}, dispose() {} },
  activeGateway: () => ({ handoffPendingProgress() { exitEvents.push('handoff'); } }),
  isSessionActive: () => true,
  pageTurnInputPhase() { return this.pageTurnSettlementActive ? 'settling' : 'idle'; },
  releasePageTurnRecoveryInput() { exitEvents.push('release'); this.pageTurnSettlementActive = false; },
  stopReaderTtsAudition() {}, captureReadingRecordElapsed() {}, finishSessionCapsuleMorph() {},
  clearReadingRecordTimer() {}, clearAutoPageTimer() {}, clearAutoPageSessionTimer() {}, cancelFirstPageReadyDeadline() {},
  finishExit() { exitEvents.push('exit'); },
});
exitOwner.beginExit();
assert.deepEqual(exitEvents, ['handoff', 'release', 'exit'], 'Back immediately interrupts receipt waiting, retaining the write owner');

let releaseWrite;
const delayedWrite = new Promise(resolve => { releaseWrite = resolve; });
const Persistence = productionMotionMethods(path, ['persistPreparedPageTurn', 'releasePageTurnRecoveryInput'], {
  CoreReadingAnchor: class { constructor(index, offset) { this.chapterIndex = index; this.chapterOffset = offset; } },
});
const page = { context: { chapter: { chapterIndex: 1 }, layoutMap: { scalarCount: () => 100 } }, page: { startScalar: 5 } };
const saving = Object.assign(new Persistence(), { mounted: true, progressCommitGeneration: 0, bookId: 'book',
  isPreparedPageTurnCommitCurrent: () => true, coreLayout: () => ({}),
  persistMeasuredCanonicalProgress: () => delayedWrite,
  isMountedToken: () => true, invalidatePageTurnRuntime() {}, resumeDeferredPageTurnWork() {},
});
const old = saving.persistPreparedPageTurn(page, 1, 1);
assert.equal(saving.commitInFlight, true);
saving.releasePageTurnRecoveryInput();
assert.equal(saving.commitInFlight, false);
saving.progressCommitGeneration++; saving.commitInFlight = true;
releaseWrite({ chapterIndex: 1, chapterOffset: 5 }); await old;
assert.equal(saving.commitInFlight, true, 'old completion cannot release a newer write owner');

}

const implementations = {'render-recovery':case_render_recovery,'continuous-progress-retry':case_continuous_progress_retry,'exit-during-persistence':case_exit_during_persistence};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}

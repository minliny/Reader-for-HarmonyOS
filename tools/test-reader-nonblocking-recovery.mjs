import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
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
const source = readFileSync(path, 'utf8');
assert.equal((source.match(/this\.showReaderAlert\(/g) ?? []).length, 1, 'only the explicit replace-preview remains modal');
assert.match(source, /ForEach\(\[this\.readerRecoveryView\.generation\]/, 'native inline action captures the original presentation ticket');
assert.doesNotMatch(source, /title: '阅读时长尚未确认'|title: '阅读进度尚未保存'|title: '正在恢复页面'/);
console.log('PASS nonblocking reader recovery: unknown receipts and missing render callbacks retain admitted content, release input and fence late callbacks; automatic native dialogs absent');

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
console.log('PASS immediate Back during pending persistence and generation-fenced old finally');

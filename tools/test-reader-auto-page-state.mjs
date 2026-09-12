import assert from 'node:assert/strict';

import {
  commitReaderAutoPageTurn,
  createReaderAutoPageState,
  endReaderAutoPageAtBookEnd,
  invalidateReaderAutoPageState,
  isReaderAutoPageTurnDue,
  pauseReaderAutoPage,
  retryReaderAutoPageTurn,
  resumeReaderAutoPage,
  setReaderAutoPageSpeed,
  startReaderAutoPage,
  stopReaderAutoPage,
  tickReaderAutoPage,
} from '../entry/src/main/ets/features/reading/ReaderAutoPageState.ts';

let state = createReaderAutoPageState(8);
assert.deepEqual(state, {
  status: 'stopped',
  speedSeconds: 8,
  remainingSeconds: 8,
  generation: 0,
  awaitingPageCommit: false,
  pauseReason: undefined,
  stopReason: undefined,
});
assert.throws(() => createReaderAutoPageState(0), /positive safe integer/);
assert.throws(() => createReaderAutoPageState(1.5), /positive safe integer/);

state = startReaderAutoPage(state);
assert.equal(state.status, 'running');
assert.equal(state.generation, 1);

const staleStartTick = tickReaderAutoPage(state, 0, 3);
assert.strictEqual(staleStartTick, state, 'a stale generation must be an identity no-op');

state = tickReaderAutoPage(state, 1, 3);
assert.equal(state.remainingSeconds, 5);
assert.equal(isReaderAutoPageTurnDue(state), false);

state = pauseReaderAutoPage(state, 'background');
assert.equal(state.status, 'paused');
assert.equal(state.pauseReason, 'background');
assert.equal(state.remainingSeconds, 5);
assert.equal(state.generation, 2);
assert.strictEqual(tickReaderAutoPage(state, 1), state, 'a pre-background timer must be invalidated');

state = resumeReaderAutoPage(state);
assert.equal(state.status, 'running');
assert.equal(state.remainingSeconds, 5);
assert.equal(state.generation, 3);

state = tickReaderAutoPage(state, 3, 5);
assert.equal(state.remainingSeconds, 0);
assert.equal(state.awaitingPageCommit, true);
assert.equal(isReaderAutoPageTurnDue(state), true);
assert.strictEqual(tickReaderAutoPage(state, 3), state, 'countdown cannot re-enter while a page commit is pending');

state = pauseReaderAutoPage(state, 'background');
assert.equal(state.status, 'paused');
assert.equal(state.generation, 3, 'an in-flight page commit retains its admitted generation');

const restartedPendingState = startReaderAutoPage(state);
assert.equal(restartedPendingState.status, 'running');
assert.equal(restartedPendingState.generation, 3,
  'starting a paused pending turn must behave like resume and keep its commit token');
state = pauseReaderAutoPage(restartedPendingState, 'background');

state = setReaderAutoPageSpeed(state, 12);
assert.equal(state.speedSeconds, 12);
assert.equal(state.remainingSeconds, 0);
assert.equal(state.generation, 3, 'changing the next interval must not orphan an in-flight commit');

state = commitReaderAutoPageTurn(state, 3);
assert.equal(state.status, 'paused');
assert.equal(state.awaitingPageCommit, false);
assert.equal(state.remainingSeconds, 12);
assert.equal(state.generation, 4);
assert.equal(state.pauseReason, 'background');

state = resumeReaderAutoPage(state);
assert.equal(state.status, 'running');
assert.equal(state.generation, 5);
state = tickReaderAutoPage(state, 5, 2);
assert.equal(state.remainingSeconds, 10);

state = pauseReaderAutoPage(state, 'touch');
assert.equal(state.status, 'paused');
assert.equal(state.pauseReason, 'touch');
assert.equal(state.generation, 6);
assert.strictEqual(tickReaderAutoPage(state, 5), state, 'a pre-touch timer must be invalidated');

state = setReaderAutoPageSpeed(state, 6);
assert.equal(state.speedSeconds, 6);
assert.equal(state.remainingSeconds, 6);
assert.equal(state.generation, 7);
state = resumeReaderAutoPage(state);
assert.equal(state.generation, 8);

const staleBookEnd = endReaderAutoPageAtBookEnd(state, 7);
assert.strictEqual(staleBookEnd, state, 'a stale EOF result cannot stop a newer generation');
state = endReaderAutoPageAtBookEnd(state, 8);
assert.equal(state.status, 'stopped');
assert.equal(state.stopReason, 'bookEnd');
assert.equal(state.remainingSeconds, 6);
assert.equal(state.generation, 9);

state = startReaderAutoPage(state);
assert.equal(state.status, 'running');
assert.equal(state.generation, 10);
state = stopReaderAutoPage(state);
assert.equal(state.status, 'stopped');
assert.equal(state.stopReason, 'manual');
assert.equal(state.generation, 11);

state = startReaderAutoPage(state);
const detachedGeneration = state.generation;
state = invalidateReaderAutoPageState(state);
assert.equal(state.status, 'stopped');
assert.equal(state.stopReason, 'lifecycle');
assert.equal(state.awaitingPageCommit, false);
assert.notEqual(state.generation, detachedGeneration);
assert.strictEqual(tickReaderAutoPage(state, detachedGeneration), state,
  'a detached component cannot be revived by its old timer');

assert.throws(() => tickReaderAutoPage(state, state.generation, 0), /positive safe integer/);
assert.throws(() => setReaderAutoPageSpeed(state, Number.NaN), /positive safe integer/);

let failedCommitState = startReaderAutoPage(createReaderAutoPageState(9));
failedCommitState = tickReaderAutoPage(failedCommitState, 1, 9);
assert.equal(failedCommitState.awaitingPageCommit, true);
assert.strictEqual(retryReaderAutoPageTurn(failedCommitState, 0), failedCommitState,
  'a stale prepared-turn failure cannot reset the admitted generation');

const retriedRunningState = retryReaderAutoPageTurn(failedCommitState, 1);
assert.equal(retriedRunningState.status, 'running');
assert.equal(retriedRunningState.remainingSeconds, 9);
assert.equal(retriedRunningState.awaitingPageCommit, false);
assert.equal(retriedRunningState.generation, 2);
assert.strictEqual(commitReaderAutoPageTurn(retriedRunningState, 1), retriedRunningState,
  'the failed prepared-turn token must be invalid after retry');

const pausedFailedCommitState = pauseReaderAutoPage(failedCommitState, 'background');
assert.equal(pausedFailedCommitState.generation, 1);
const retriedPausedState = retryReaderAutoPageTurn(pausedFailedCommitState, 1);
assert.equal(retriedPausedState.status, 'paused');
assert.equal(retriedPausedState.pauseReason, 'background');
assert.equal(retriedPausedState.remainingSeconds, 9);
assert.equal(retriedPausedState.awaitingPageCommit, false);
assert.equal(retriedPausedState.generation, 2);

console.log('reader auto-page pure state: PASS');


// Wall-clock corrections must not advance, freeze or reverse an active duration.
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
let monotonicMs = 10000;
const deadlines = [];
const ClockOwner = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['armAutoPageTimer', 'captureAutoPageRemaining', 'onAutoPageTimer', 'captureAutoPageSessionRemaining', 'armAutoPageSessionTimer'],
  { readerMotionNowMs: () => monotonicMs, Date: { now() { throw Error('elapsed timers must not read calendar time'); } },
    tickReaderAutoPage, isReaderAutoPageTurnDue, stopReaderAutoPage,
    readerAutoPageFullTimerDurationSeconds: () => 60, setTimeout: (fn, ms) => { deadlines.push({ fn, ms }); return deadlines.length; } });
const timed = Object.assign(new ClockOwner(), { mounted:true, appForeground:true, exitRequested:false, phase:'ready',
  autoPageState: startReaderAutoPage(createReaderAutoPageState(8)), autoPageDeadlineMs:0,
  autoPageSessionDeadlineMs:0, autoPageSessionRemainingSeconds:60, autoPageSessionTimerGeneration:1,
  clearAutoPageTimer(){}, clearAutoPageSessionTimer(){}, requestAutoPageTurn(){ this.due = true; }, onAutoPageSessionTimer(){} });
timed.armAutoPageTimer(true); timed.armAutoPageSessionTimer(true);
assert.equal(timed.autoPageDeadlineMs,18000); assert.equal(timed.autoPageSessionDeadlineMs,70000);
monotonicMs += 3000; timed.captureAutoPageRemaining(); timed.captureAutoPageSessionRemaining();
assert.equal(timed.autoPageState.remainingSeconds,5); assert.equal(timed.autoPageSessionRemainingSeconds,57);
monotonicMs += 5000; timed.onAutoPageTimer(timed.autoPageState.generation);
assert.equal(timed.due,true); assert.equal(timed.autoPageState.remainingSeconds,0);
console.log('production automatic turn and stop durations use monotonic time; calendar access rejected: PASS');

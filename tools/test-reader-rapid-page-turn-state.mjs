import assert from 'node:assert/strict';

import {
  beginReaderRapidPageTurn,
  cancelReaderRapidPageTurn,
  completeReaderRapidPageTurn,
  createReaderRapidPageTurnState,
  enqueueReaderRapidPageTurn,
  reachReaderRapidPageBoundary,
  readerRapidPageTurnDirection,
  readerRapidPageTurnRetryExhausted,
  requestReaderRapidPageControl,
  retryReaderRapidPageTurn,
} from '../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts';

function enqueue(state, direction, count) {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    next = enqueueReaderRapidPageTurn(next, direction);
  }
  return next;
}

let state = enqueue(createReaderRapidPageTurnState(), 'next', 1000);
assert.equal(state.pendingDelta, 1000, 'the dynamic target must not stop at 16 or another product cap');
assert.equal(readerRapidPageTurnDirection(state), 'next');

state = beginReaderRapidPageTurn(state, 'next');
assert.equal(state.inFlightDirection, 'next');
state = enqueue(state, 'previous', 7);
assert.equal(state.pendingDelta, 993, 'opposite input must cancel the outstanding net target');
state = completeReaderRapidPageTurn(state, 'next');
assert.equal(state.pendingDelta, 992);
assert.equal(state.inFlightDirection, undefined);

state = beginReaderRapidPageTurn(state, 'next');
const failed = retryReaderRapidPageTurn(state, 'next');
assert.equal(failed.pendingDelta, 992, 'a failed page transaction must not consume user input');
assert.equal(failed.inFlightDirection, undefined);
assert.equal(failed.retryCount, 1);

let repeatedlyFailed = failed;
for (let attempt = 1; attempt < 3; attempt += 1) {
  repeatedlyFailed = beginReaderRapidPageTurn(repeatedlyFailed, 'next');
  repeatedlyFailed = retryReaderRapidPageTurn(repeatedlyFailed, 'next');
}
assert.equal(readerRapidPageTurnRetryExhausted(repeatedlyFailed), true,
  'single-page retries must be bounded independently of the target distance');

let cancelledFailure = enqueueReaderRapidPageTurn(failed, 'previous');
assert.equal(cancelledFailure.pendingDelta, 991);
cancelledFailure = enqueue(cancelledFailure, 'previous', 991);
assert.equal(cancelledFailure.pendingDelta, 0);
assert.equal(cancelledFailure.retryCount, 0,
  'cancelling the failed target must not charge a later independent request');

state = beginReaderRapidPageTurn(failed, 'next');
state = requestReaderRapidPageControl(state);
assert.equal(state.pendingDelta, 1, 'control keeps only the admitted non-interruptible page');
assert.equal(state.controlRequested, true);
state = completeReaderRapidPageTurn(state, 'next');
assert.equal(state.pendingDelta, 0);
assert.equal(state.controlRequested, true);
assert.equal(enqueueReaderRapidPageTurn(state, 'next'), state,
  'control priority rejects later directional input until the shell opens');

state = enqueue(createReaderRapidPageTurnState(), 'next', 30);
state = reachReaderRapidPageBoundary(state, 'next');
assert.equal(state.pendingDelta, 0, 'book end clears only impossible forward work');

state = enqueue(createReaderRapidPageTurnState(), 'previous', 5);
state = reachReaderRapidPageBoundary(state, 'next');
assert.equal(state.pendingDelta, -5, 'a forward boundary must preserve a reversed target');

state = enqueue(createReaderRapidPageTurnState(), 'next', 50);
const generation = state.generation;
state = cancelReaderRapidPageTurn(state);
assert.equal(state.pendingDelta, 0);
assert.equal(state.inFlightDirection, undefined);
assert.equal(state.retryCount, 0);
assert.equal(state.controlRequested, false);
assert.notEqual(state.generation, generation);

console.log('reader rapid page-turn dynamic target: PASS');

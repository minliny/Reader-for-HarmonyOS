import assert from 'node:assert/strict';

import {
  beginReaderTtsSession,
  beginStoppingReaderTts,
  createReaderTtsState,
  failReaderTtsUtterance,
  finishStoppingReaderTts,
  invalidateReaderTtsContent,
  isReaderTtsTimerDue,
  isReaderTtsUtteranceCurrent,
  markReaderTtsStarted,
  pauseReaderTtsSession,
  prepareReaderTtsUtterance,
  readerTtsUtteranceToken,
  resumeReaderTtsSession,
  scheduleReaderTtsTimer,
  setReaderTtsAvailability,
} from '../entry/src/main/ets/features/reading/ReaderTtsState.ts';

let state = createReaderTtsState();
assert.equal(state.status, 'uninitialized');
state = setReaderTtsAvailability(state, true);
assert.equal(state.status, 'idle');

state = beginReaderTtsSession(state, ['local', 'book-1', '0'].join('\0'), 0, 4, 1);
state = prepareReaderTtsUtterance(state, 1, 3, 8, 16);
const first = readerTtsUtteranceToken(state);
assert.match(first.requestId, /^tts-s\d+-u\d+-c0-i1$/);
state = markReaderTtsStarted(state, first);
assert.equal(state.status, 'playing');

state = pauseReaderTtsSession(state, 'user');
assert.equal(state.status, 'paused');
assert.equal(isReaderTtsUtteranceCurrent(state, first), false);
assert.strictEqual(markReaderTtsStarted(state, first), state, 'late start must be an identity no-op');

state = resumeReaderTtsSession(state);
state = prepareReaderTtsUtterance(state, 1, 3, 8, 16, 'resuming');
const resumed = readerTtsUtteranceToken(state);
assert.notEqual(resumed.requestId, first.requestId);
assert.equal(markReaderTtsStarted(state, resumed).status, 'playing');

const staleFailure = failReaderTtsUtterance(state, first, 'late');
assert.strictEqual(staleFailure, state);
state = failReaderTtsUtterance(state, resumed, 'engine failure');
assert.equal(state.status, 'error');
assert.equal(state.consecutiveFailures, 1);
assert.equal(state.audioStarted, false);

state = scheduleReaderTtsTimer(state, 1000, 60_000);
assert.equal(isReaderTtsTimerDue(state, 60_999), false);
assert.equal(isReaderTtsTimerDue(state, 61_000), true);

const priorSession = state.sessionGeneration;
state = invalidateReaderTtsContent(state, 5);
assert.equal(state.status, 'stopping');
assert.equal(state.contentVersion, 5);
assert.ok(state.sessionGeneration > priorSession);
state = finishStoppingReaderTts(state);
assert.equal(state.status, 'idle');

state = invalidateReaderTtsContent(state, 'content-sha-2');
assert.equal(state.contentVersion, 'content-sha-2');
state = finishStoppingReaderTts(state);

state = beginStoppingReaderTts(state, 'lifecycle');
assert.equal(state.stopReason, 'lifecycle');
assert.throws(() => prepareReaderTtsUtterance(state, 0, 0, 0, 1), /without a chapter identity/);
state = beginReaderTtsSession(state, ['local', 'book-1', '0'].join('\0'), 0, 5, 1);
assert.throws(() => prepareReaderTtsUtterance(state, 0, 0, 0, 1), /positive safe integer/);
assert.throws(() => beginReaderTtsSession(state, '', 0, 0, 1), /non-blank/);

console.log('reader TTS pure state: PASS');

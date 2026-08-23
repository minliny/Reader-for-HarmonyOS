import assert from 'node:assert/strict';

import {
  cancelReaderPagePan,
  createReaderPageGestureState,
  finishReaderPagePan,
  readerPageTapIntent,
  startReaderPagePan,
  updateReaderPagePan,
} from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';

let state = createReaderPageGestureState();
assert.deepEqual(state, {
  active: false,
  consumed: false,
  direction: undefined,
  currentOffsetX: 0,
  lastOffsetX: 0,
  reversed: false,
});

state = startReaderPagePan(-12);
state = updateReaderPagePan(state, -42);
let decision = finishReaderPagePan(state, -58);
assert.equal(decision.direction, 'next', 'a left pan must request next exactly once');
assert.equal(decision.state.active, false);
assert.equal(decision.state.consumed, true);
assert.equal(finishReaderPagePan(decision.state, -58).direction, undefined,
  'an ended pan cannot emit a second page turn');

state = startReaderPagePan(12);
state = updateReaderPagePan(state, 36);
decision = finishReaderPagePan(state, 54);
assert.equal(decision.direction, 'previous', 'a right pan must request previous');

state = startReaderPagePan(-12);
state = updateReaderPagePan(state, -60);
decision = finishReaderPagePan(state, -45);
assert.equal(decision.direction, undefined, 'a left pan that reverses before release must cancel');

state = startReaderPagePan(-12);
state = updateReaderPagePan(state, -60);
state = updateReaderPagePan(state, -45);
state = updateReaderPagePan(state, -80);
decision = finishReaderPagePan(state, -95);
assert.equal(decision.direction, 'next', 'only the final non-zero segment decides reversal');

state = startReaderPagePan(12);
state = updateReaderPagePan(state, 60);
decision = finishReaderPagePan(state, 45);
assert.equal(decision.direction, undefined, 'a right pan that reverses before release must cancel');

state = startReaderPagePan(-12);
state = cancelReaderPagePan(state);
assert.equal(state.active, false);
assert.equal(finishReaderPagePan(state, -60).direction, undefined, 'a cancelled pan must not turn');

state = startReaderPagePan(0);
decision = finishReaderPagePan(state, 0);
assert.equal(decision.direction, undefined, 'a pan without a horizontal direction must not turn');

state = startReaderPagePan(-12);
state = updateReaderPagePan(state, Number.NaN);
assert.equal(state.currentOffsetX, -12, 'a non-finite update must not poison gesture state');

state = startReaderPagePan(-12);
decision = finishReaderPagePan(state, -30);
assert.equal(decision.direction, 'next');
state = startReaderPagePan(12);
assert.equal(state.direction, 'previous', 'a new pan must not inherit the prior direction');
assert.equal(state.consumed, false, 'a new pan must clear the prior consumed flag');

// A busy outcome is intentionally not part of gesture state. Once the intent
// has been emitted, no queued/replayable state remains in this reducer.
decision = finishReaderPagePan(updateReaderPagePan(state, 36), 48);
assert.equal(decision.direction, 'previous');
assert.equal(decision.state.active, false);
assert.equal(decision.state.direction, undefined);

assert.equal(readerPageTapIntent(10, 300), 'previous');
assert.equal(readerPageTapIntent(150, 300), 'control');
assert.equal(readerPageTapIntent(290, 300), 'next');
assert.equal(readerPageTapIntent(-1, 300), undefined);
assert.equal(readerPageTapIntent(150, 0), undefined);

console.log('reader page-gesture pure state: PASS');

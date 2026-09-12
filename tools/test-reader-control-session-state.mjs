import assert from 'node:assert/strict';
import {
  advanceReaderControlSession,
  backReaderControlSession,
  collapseReaderControlSession,
  createReaderControlSessionState,
  dismissReaderControlSession,
  enterReaderControlModule,
  expandReaderControlSession,
  holdReaderControlSession,
  openReaderControlSession,
  readerControlContentLocation,
  readerControlTargetLocation,
  retargetReaderControlTransition,
  sampleReaderControlSession,
  setReaderControlDirectoryTab,
  toggleReaderControlSession,
  trackReaderControlTransition,
} from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';

const duration = 400; // Deterministic test clock, not a product animation token.
const modules = ['directory', 'tts', 'appearance', 'settings', 'search', 'autoPage', 'replace'];
function finish(initial) {
  let state = initial;
  for (let count = 0; count < 8 && state.transition !== undefined; count += 1) {
    state = advanceReaderControlSession(state, 10000, state.epoch);
  }
  assert.equal(state.transition, undefined, 'the unheld transition must reach its endpoint');
  return state;
}
function home() {
  return finish(openReaderControlSession(createReaderControlSessionState(), duration));
}
function quick(module, tab = 'directory') {
  return finish(enterReaderControlModule(home(), module, duration, tab));
}

let state = createReaderControlSessionState();
assert.equal(state.location.level, 'hidden');
assert.equal(backReaderControlSession(state, duration).consumed, false);
assert.strictEqual(expandReaderControlSession(state, duration), state);
state = home();
assert.equal(state.location.level, 'home');
assert.strictEqual(expandReaderControlSession(state, duration), state, 'initial home cannot expand');
assert.strictEqual(toggleReaderControlSession(state, duration), state, 'home handle has no toggle');

for (const module of modules) {
  const original = quick(module);
  const snapshot = structuredClone(original);
  let current = expandReaderControlSession(original, duration);
  assert.deepEqual(original, snapshot, 'commands never mutate owner state');
  assert.equal(current.transition.kind, 'morph');
  assert.equal(current.transition.toLocation.module, module);
  assert.deepEqual(sampleReaderControlSession(current), { expansionProgress: 0, visibilityProgress: 1 });
  current = advanceReaderControlSession(current, duration / 4, current.epoch);
  assert.deepEqual(sampleReaderControlSession(current), { expansionProgress: 0.25, visibilityProgress: 1 });
  current = finish(current);
  assert.equal(current.location.form, 'full');
  assert.equal(current.location.module, module);
  current = finish(backReaderControlSession(current, duration).state);
  assert.equal(current.location.form, 'quick');
  assert.equal(current.location.module, module);
  current = finish(backReaderControlSession(current, duration).state);
  assert.equal(current.location.level, 'home');
  current = finish(backReaderControlSession(current, duration).state);
  assert.equal(current.location.level, 'hidden');
  assert.equal(current.closeRevision, 1);
  current = finish(openReaderControlSession(current, duration));
  assert.equal(current.location.level, 'home');
}

// A bookmark tab is part of directory, not a route or additional Back level.
state = setReaderControlDirectoryTab(quick('directory'), 'bookmarks');
state = finish(expandReaderControlSession(state, duration));
assert.equal(state.location.module, 'directory');
assert.equal(state.location.directoryTab, 'bookmarks');
state = finish(collapseReaderControlSession(state, duration));
assert.equal(state.location.directoryTab, 'bookmarks');
state = finish(backReaderControlSession(state, duration).state);
assert.equal(state.location.level, 'home');

// Back cancels a forward command from its source irrespective of visual progress.
for (const fraction of [0.1, 0.9]) {
  state = expandReaderControlSession(quick('directory', 'bookmarks'), duration);
  state = advanceReaderControlSession(state, duration * fraction, state.epoch);
  const before = sampleReaderControlSession(state);
  state = backReaderControlSession(state, duration).state;
  assert.deepEqual(sampleReaderControlSession(state), before, 'Back cannot jump the current frame');
  assert.equal(readerControlTargetLocation(state).form, 'quick');
  assert.equal(readerControlTargetLocation(state).directoryTab, 'bookmarks');
  state = backReaderControlSession(state, duration).state;
  assert.equal(readerControlTargetLocation(state).level, 'home', 'second Back continues one level');
  state = backReaderControlSession(state, duration).state;
  assert.equal(state.transition.kind, 'dismiss');
  const again = backReaderControlSession(state, duration);
  assert.equal(again.consumed, true, 'Back during close must not escape the reader');
  assert.equal(readerControlTargetLocation(again.state).level, 'hidden');
}
state = openReaderControlSession(createReaderControlSessionState(), duration);
state = advanceReaderControlSession(state, 80, state.epoch);
state = finish(backReaderControlSession(state, duration).state);
assert.equal(state.location.level, 'hidden');
state = enterReaderControlModule(home(), 'settings', duration);
state = finish(backReaderControlSession(state, duration).state);
assert.equal(state.location.level, 'home');

// Dismiss is not collapse: expansion remains frozen, so Quick-only actors stay absent.
state = finish(expandReaderControlSession(quick('directory', 'bookmarks'), duration));
state = dismissReaderControlSession(state, duration);
state = advanceReaderControlSession(state, duration / 2, state.epoch);
assert.deepEqual(sampleReaderControlSession(state), { expansionProgress: 1, visibilityProgress: 0.5 });
const captured = sampleReaderControlSession(state);
const previousEpoch = state.epoch;
state = holdReaderControlSession(state, 7);
assert.deepEqual(sampleReaderControlSession(state), captured);
assert.strictEqual(advanceReaderControlSession(state, 9999, previousEpoch), state);
assert.strictEqual(advanceReaderControlSession(state, 9999, state.epoch), state, 'DOWN pauses the clock');
state = trackReaderControlTransition(state, 1, state.epoch);
assert.equal(sampleReaderControlSession(state).visibilityProgress, 0);
assert.equal(state.closeRevision, 0, 'invisible while held is not committed close');
assert.equal(readerControlContentLocation(state).directoryTab, 'bookmarks');
state = trackReaderControlTransition(state, 0.7, state.epoch);
assert.ok(sampleReaderControlSession(state).visibilityProgress > 0);
state = finish(retargetReaderControlTransition(state, 0, duration));
assert.equal(state.location.form, 'full');
assert.equal(state.location.directoryTab, 'bookmarks');
assert.equal(state.closeRevision, 0);
state = dismissReaderControlSession(state, duration);
state = holdReaderControlSession(state, 8);
state = trackReaderControlTransition(state, 1, state.epoch);
state = retargetReaderControlTransition(state, 1, duration);
assert.equal(state.location.level, 'hidden', 'UP at the valid close endpoint commits immediately');
assert.equal(state.closeRevision, 1);

// Capturing an interrupted morph for closing does not reset expansion to an endpoint.
state = expandReaderControlSession(quick('appearance'), duration);
state = advanceReaderControlSession(state, duration * 0.4, state.epoch);
state = dismissReaderControlSession(state, duration);
assert.equal(sampleReaderControlSession(state).expansionProgress, 0.4);
state = advanceReaderControlSession(state, duration / 2, state.epoch);
state = retargetReaderControlTransition(state, 0, duration);
state = advanceReaderControlSession(state, duration, state.epoch);
assert.deepEqual(sampleReaderControlSession(state), { expansionProgress: 0.4, visibilityProgress: 1 },
  'undo reaches the captured frame without snapping to full');
state = finish(state);
assert.equal(state.location.form, 'full', 'the pre-close forward target then resumes');

// Frame epochs, explicit command takeover and injected clock curves are independent of pointer mapping.
state = expandReaderControlSession(quick('search'), duration);
const staleEpoch = state.epoch;
state = advanceReaderControlSession(state, duration / 2, state.epoch, (fraction) => fraction * fraction);
assert.equal(sampleReaderControlSession(state).expansionProgress, 0.25);
state = holdReaderControlSession(state, 9);
state = dismissReaderControlSession(state, duration);
assert.equal(state.heldPointerId, -1);
assert.strictEqual(advanceReaderControlSession(state, duration, staleEpoch), state);
assert.strictEqual(trackReaderControlTransition(state, 0, staleEpoch), state);
assert.deepEqual(Object.keys(state).sort(),
  ['closeRevision', 'epoch', 'heldPointerId', 'location', 'transition'], 'business state is not owned by motion');

console.log('reader control session production state behavior: PASS');

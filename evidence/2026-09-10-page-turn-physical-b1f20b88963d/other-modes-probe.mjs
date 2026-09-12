import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as gesture from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPageGestureState.ts';
import * as rapid from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts';

const base = '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/';
function extract(source, name) {
  let start = source.indexOf(`  private ${name}(`);
  if (start < 0) start = source.indexOf(`  private async ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  private ', start + 10);
  return source.slice(start, end < 0 ? source.lastIndexOf('\n}') : end);
}
function makeClass(file, methods, bindings) {
  const source = readFileSync(base + file, 'utf8');
  const compiled = stripTypeScriptTypes(`class Probe {\n${methods.map(name => extract(source, name)).join('\n')}\n}`, { mode: 'strip' });
  return new Function(...Object.keys(bindings), `${compiled}\nreturn Probe;`)(...Object.values(bindings));
}
const Dispatcher = makeClass('LocalReadingExperience.ets', [
  'requestPageTurn', 'drainRapidPageTurn', 'queuePageTurnPreparation', 'drainPageTurnPreparationQueue',
], { ...rapid, readerPageTransitionUsesPreparedPages: () => true });
const dispatcher = new Dispatcher();
let performCalls = 0;
Object.assign(dispatcher, {
  mounted: true, exitRequested: false, interactionBlocked: false, controlObscured: false,
  controlVisible: () => false, rapidPageTurnState: rapid.createReaderRapidPageTurnState(),
  readerSettingsSnapshot: { navigationMode: 'paged' }, canTurnPage: () => true,
  usesNoAnimationPageTurnRuntime: () => false,
  preparedPageTurn: direction => direction === 'previous' ? {} : undefined,
  pageTurnPreparationQueue: [], pageTurnGestureState: { phase: 'idle' },
  adjacentPageTurnTarget: () => undefined,
  knownPageTurnBoundary: () => ({ kind: 'boundary', edge: 'end' }),
  scheduleBookTurnTextureRefresh: () => {},
  performPageTurn: () => { performCalls++; return { kind: 'started' }; },
});
const boundaryResult = dispatcher.requestPageTurn('next');
const pendingAtBoundary = dispatcher.rapidPageTurnState.pendingDelta;
const reverseResult = dispatcher.requestPageTurn('previous');
assert.equal(boundaryResult.kind, 'preparing');
assert.equal(pendingAtBoundary, 1);
assert.equal(reverseResult.kind, 'busy');
assert.equal(performCalls, 0);
console.log(JSON.stringify({ probe: 'known book end then reverse', boundaryResult, pendingAtBoundary, reverseResult, performCalls }));

const Pointer = makeClass('ReaderPageInteractionLayer.ets', ['finishRawPointer'], gesture);
const pointer = new Pointer();
const down = gesture.startReaderPagePan(390, 300, 200, 0, 800);
const actual = [];
Object.assign(pointer, {
  gestureState: down, tapOnlyPointer: false, pointerRejected: false,
  pageLocalX: (_event, point) => point.x, pageLocalY: (_event, point) => point.y,
  pageViewportWidth: () => 390, eventTimeMs: event => event.time,
  updateVelocity: () => {}, velocityX: 0, velocityY: 0,
  onGestureStateChange: () => {}, resetRawPointer: () => {},
  handleRawTap: (x, width) => actual.push(gesture.readerPageTapIntent(x, width)),
  onGestureDecision: value => value, ownPointer: () => {}, onTurn: d => actual.push(d),
});
const expected = gesture.finishReaderPagePan(down, -200, 0, 0, 100, 200, 0, 60).direction;
pointer.finishRawPointer({ time: 60 }, { x: 100, y: 200 });
assert.equal(expected, 'next');
assert.deepEqual(actual, ['previous']);
console.log(JSON.stringify({ probe: 'DOWN right then final UP left without threshold MOVE', reducerDirection: expected, inputLayerIntent: actual[0] }));

const FlatOwner = makeClass('LocalReadingExperience.ets', ['onReaderPageGestureStateChanged'], {
  ...gesture, readerPageTransitionUsesPreparedPages: () => false,
});
for (const scenario of ['return-UP', 'system-CANCEL']) {
  const state = gesture.updateReaderPagePan(gesture.startReaderPagePan(390, 300, 200, 0, 800), -100, 0, 0, 200, 200, 0, 40);
  const ended = scenario === 'return-UP' ? gesture.finishReaderPagePan(state, -2, 0, 0, 298, 200, 0, 100).state : gesture.cancelReaderPagePan(state);
  const owner = new FlatOwner();
  Object.assign(owner, {
    pageTurnGestureState: state, pageTurnSessionCapsuleFrozen: true,
    usesBookTurnSimulation: () => false, usesNoAnimationPageTurnRuntime: () => true,
    flushDeferredPageChromeState: () => {},
  });
  owner.onReaderPageGestureStateChanged(ended);
  assert.equal(owner.pageTurnGestureState.phase, 'settling');
  assert.equal(owner.pageTurnInputOwned, true);
  console.log(JSON.stringify({ probe: `none ${scenario}`, phase: owner.pageTurnGestureState.phase, target: owner.pageTurnGestureState.settleTarget, inputOwned: owner.pageTurnInputOwned }));
}

const ExitOwner = makeClass('LocalReadingExperience.ets', ['finishExit', 'commitContinuousProgress'], {});
const exitOwner = new ExitOwner();
let exited = false;
Object.assign(exitOwner, {
  isMountedToken: () => true, phase: 'ready', exitDelivered: false,
  readerSettingsSnapshot: { navigationMode: 'continuous' },
  chapter: {}, chapterLayoutMap: {}, continuousFragments: [{}],
  continuousCommitInFlight: true, continuousCommitPending: false,
  flushReadingRecordForExit: async () => {}, onExit: () => { exited = true; },
});
await exitOwner.finishExit(1);
assert.equal(exited, true);
assert.equal(exitOwner.continuousCommitInFlight, true);
assert.equal(exitOwner.continuousCommitPending, true);
console.log(JSON.stringify({ probe: 'scroll exit during in-flight save', exited, saveStillInFlight: exitOwner.continuousCommitInFlight, trailingSaveOnlyFlag: exitOwner.continuousCommitPending }));

await import('./other-modes-extra-probe.mjs');

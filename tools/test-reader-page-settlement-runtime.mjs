import assert from 'node:assert/strict';
import { ReaderPageSettlementTimeline } from '../entry/src/main/ets/features/reading/ReaderPageSettlementTimeline.ts';
import { resumeReaderPagePan, updateReaderPagePanInPlace, finishReaderPagePan } from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderRapidPageTurnState, enqueueReaderRapidPageTurn, beginReaderRapidPageTurn, completeReaderRapidPageTurn } from '../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts';
const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const Host = productionMotionMethods(file, ['regrabPageTurn', 'completeRapidPageTurnTransaction'], { resumeReaderPagePan, completeReaderRapidPageTurn });
for (const direction of ['next', 'previous']) {
  const sign = direction === 'next' ? -1 : 1;
  const timeline = new ReaderPageSettlementTimeline(sign * 40, sign * 390, 390, sign * 2000, 1000);
  const before = timeline.position(1050);
  assert.equal(timeline.position(1000), sign * 40);
  assert.equal(timeline.position(5000), sign * 390);
  const host = Object.assign(new Host(), { pageTurnSettlementActive: true, pageTurnCommitStarted: false,
    pageTurnAnimationFinished: false, pageTurnSlideTimeline: timeline, pageTurnDirection: direction,
    pageTurnOffsetX: before, pageTurnSettlementGeneration: 1,
    usesBookTurnSimulation: () => false, cancelPageTurnSettlementDeadline() {},
    rapidPageTurnState: beginReaderRapidPageTurn(enqueueReaderRapidPageTurn(enqueueReaderRapidPageTurn(createReaderRapidPageTurnState(), direction), direction), direction),
  });
  let state = host.regrabPageTurn(390, 800, 200, 400, 1050);
  assert.equal(state.currentOffsetX, before, 'the new pointer starts at the published intermediate frame');
  assert.equal(host.pageTurnSlideTimeline, undefined, 'old clock cannot keep moving a held page');
  assert.equal(host.pageTurnSettlementGeneration, 2);
  assert.equal(Math.abs(host.rapidPageTurnState.pendingDelta), 1, 'only the replaced release intent is removed');
  state = updateReaderPagePanInPlace(state, before + sign * 20, 0, 0, 200 + sign * 20, 400, 0, 1080);
  assert.equal(state.currentOffsetX, before + sign * 20);
  assert.equal(finishReaderPagePan(state, state.currentOffsetX).direction, direction);
  host.pageTurnCommitStarted = true; host.pageTurnSlideTimeline = timeline;
  assert.equal(host.regrabPageTurn(390, 800, 200, 400, 1090), undefined, 'a durable write is not visually cancellable');
  const retreat = new ReaderPageSettlementTimeline(before, 0, 390, -sign * 1000, 1100);
  assert.equal(retreat.position(1100), before); assert.equal(retreat.position(2000), 0);
}
assert.equal(new ReaderPageSettlementTimeline(0, 0, 390, 0, 0).durationMs, 0, 'endpoint does not linger');
console.log('production flat settle/regrab continuity and transaction boundary: PASS');

// Exercise the production Native callback with a real mode/Reduce Motion
// predicate: expected unmount must not poison the later settings re-entry.
const nativeEvents = Object.fromEntries([
  'SURFACE_READY', 'TEXTURE_READY', 'VISUAL_COMMIT_ENDPOINT', 'ROLLBACK_COMPLETE',
  'SURFACE_LOST', 'RENDER_FAILURE', 'SLOTS_COMMITTED', 'TERMINAL_RELEASED', 'FRAME_PRESENTED',
].map((name, i) => [`BOOK_TURN_EVENT_${name}`, i + 1]));
const NativeLifecycle = productionMotionMethods(file,
  ['shouldMountBookTurnSurface', 'onBookTurnNativeEvent', 'recoverBookTurnSurfaceIfIdle'], nativeEvents);
const lifecycle = Object.assign(new NativeLifecycle(), {
  mounted: true, reduceMotion: false, bookTurnRuntimeFailed: false,
  readerSettingsSnapshot: { navigationMode: 'paged', pageTransition: 'simulation' },
  bookTurnSession: { configure() {} }, scheduleBookTurnTextureRefresh() {},
  failBookTurnRuntime() { this.bookTurnRuntimeFailed = true; },
});
for (const event of [nativeEvents.BOOK_TURN_EVENT_SURFACE_LOST, nativeEvents.BOOK_TURN_EVENT_RENDER_FAILURE]) {
  for (const pageTransition of ['slide', 'cover', 'none']) {
    lifecycle.bookTurnRuntimeFailed = false;
    lifecycle.readerSettingsSnapshot.pageTransition = pageTransition;
    lifecycle.onBookTurnNativeEvent({ event });
    assert.equal(lifecycle.bookTurnRuntimeFailed, false, `${pageTransition}: expected teardown keeps simulation available`);
  }
  lifecycle.readerSettingsSnapshot.pageTransition = 'simulation';
  lifecycle.reduceMotion = true;
  lifecycle.onBookTurnNativeEvent({ event });
  assert.equal(lifecycle.bookTurnRuntimeFailed, false, 'Reduce Motion also intentionally unmounts Native');
  lifecycle.reduceMotion = false;
  lifecycle.onBookTurnNativeEvent({ event });
  assert.equal(lifecycle.bookTurnRuntimeFailed, true, 'an unexpected loss in active simulation retains the safe fallback');
  lifecycle.onBookTurnNativeEvent({ event: nativeEvents.BOOK_TURN_EVENT_SURFACE_READY });
  assert.equal(lifecycle.bookTurnRuntimeFailed, false, 'a new ready surface re-establishes capability');
}
console.log('production simulation mode-switch teardown and capability recovery: PASS');

for (const sign of [-1, 1]) {
  const queued = new ReaderPageSettlementTimeline(0, sign * 390, 390, 0, 1000, true);
  assert.equal(queued.position(1000), 0);
  assert.ok(Math.abs(queued.position(1015)) > 0 && Math.abs(queued.position(1015)) < 390);
  assert.equal(queued.position(1030), sign * 390);
  assert.equal(queued.finished(1029), false);
  assert.equal(queued.finished(1030), true);
  const slowRelease = new ReaderPageSettlementTimeline(0, sign * 390, 390, 0, 1000);
  const fastRelease = new ReaderPageSettlementTimeline(0, sign * 390, 390, sign * 100000, 1000);
  assert.equal(slowRelease.durationMs, 320);
  assert.equal(fastRelease.durationMs, 80);
}
console.log('queued tap cue and physical velocity settlement use independent durations: PASS');

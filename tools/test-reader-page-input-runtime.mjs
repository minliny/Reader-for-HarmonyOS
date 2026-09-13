import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as gesture from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';
import { ReaderPageInputClock } from '../entry/src/main/ets/features/reading/ReaderPageInputClock.ts';

// Execute production decisions; only ArkUI coordinates, timers and external
// callbacks are supplied by this harness. No copied implementation assertions.
const source = file => readFileSync(new URL(`../entry/src/main/ets/features/reading/${file}`, import.meta.url), 'utf8');
function production(file, names, bindings = {}) {
  const text = source(file);
  const methods = names.map(name => {
    const start = text.indexOf(`  private ${name}(`);
    assert.ok(start >= 0, name);
    const end = text.indexOf('\n  private ', start + 10);
    return text.slice(start, end < 0 ? text.lastIndexOf('\n}') : end);
  });
  return new Function(...Object.keys(bindings), stripTypeScriptTypes(`class Subject {\n${methods.join('\n')}\n}`, { mode: 'strip' }) + '\nreturn Subject;')(...Object.values(bindings));
}
let now = 1000;
let timers = [];
const Pointer = production('ReaderPageInteractionLayer.ets', [
  'startRawPointer', 'updateRawPointer', 'finishRawPointer', 'updateVelocity', 'eventTimeMs',
  'resetRawPointer', 'reportManualInteraction', 'isPageOwner', 'resolveDeferredSegment',
  'onReadinessChanged', 'armPointerWatchdog', 'schedulePointerWatchdog', 'clearPointerWatchdog', 'cancelPan', 'handleRawTap',
  'onInteractionModeChanged', 'tapOnlyNow',
], { ...gesture, ReaderPageInputClock, readerMotionNowMs: () => now,
  READER_PAGE_POINTER_STALL_TIMEOUT_MS: 15000,
  setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimeout: () => {} });
function pointer({ ready = true, deferred = false } = {}) {
  const log = [], p = Object.assign(new Pointer(), {
    gestureState: gesture.createReaderPageGestureState(), activePointerId: -1,
    inputClock: new ReaderPageInputClock(), pointerWatchdogTimer: -1,
    deferredSegmentReserved: false, interactionEnabled: true, tapOnly: deferred,
    manualInteractionReported: false, lastSampleTimeMs: 0,
    onRegrab: () => undefined,
    onPointerStart: id => { log.push(['down', id]); return true; },
    onPreparationNeeded: direction => log.push(['prepare', direction]),
    viewportWidth: 390, viewportHeight: 800,
    onPointerEnd: id => log.push(['up', id]),
    pageLocalX: (_e, p) => p.x, pageLocalY: (_e, p) => p.y,
    pageViewportWidth: () => 390, pageViewportHeight: () => 800,
    systemOwnsPointer: () => false, armLongPressTimer: () => {}, clearLongPressTimer: () => {},
    onDeferredSegmentStart: () => true, onDeferredSegmentResolve: intent => log.push(['deferred', intent]),
    onDeferredSegmentPromote: () => log.push(['promote']),
    canStartTurn: direction => { log.push(['admission', direction]); return ready; },
    canStartBookmark: () => true, onManualInteraction: () => log.push(['manual']),
    ownPointer: () => {}, onBookmarkStateChange: () => {}, onBookmarkRelease: () => {},
    onOpenControl: () => log.push(['control']),
    onTurn: direction => { log.push(['turn', direction]); return { kind: 'started' }; },
    onGestureDecision: decision => decision,
    onGestureStateChange: state => log.push(['state', state.phase, state.currentOffsetX]),
  });
  return { p, log };
}
const event = (x, ms, id = 7) => ({ timestamp: ms * 1e6, changedTouches: [{ id, x, y: 200 }], touches: [] });

for (const settling of [true, false]) {
  const { p, log } = pointer({ deferred: !settling });
  p.currentTapOnly = () => settling;
  now=1000; p.startRawPointer(event(300, now));
  assert.equal(p.tapOnlyPointer, settling, 'new DOWN reads owner transaction state even when Prop delivery lags');
  // Deliver the old Prop value while the physical segment is still down.
  p.onInteractionModeChanged();
  assert.equal(p.activePointerId, 7, 'late settlement notification cannot cancel the next accepted pointer');
  now+=20; p.finishRawPointer(event(300, now), { id: 7, x: 300, y: 200 });
  assert.equal(log.filter(x => x[0] === (settling ? 'deferred' : 'turn') && x[1] === 'next').length, 1);
}

// The next tap during an interruptible settle is an additional request. It
// must not become an immediate regrab and replace the already accepted turn.
for (const direction of ['next', 'previous']) {
  const x = direction === 'next' ? 300 : 50;
  const { p, log } = pointer({ deferred: true });
  let regrabs = 0;
  p.onRegrab = (_w, _h, lx, ly, t) => {
    regrabs++;
    return gesture.resumeReaderPagePan(direction, direction === 'next' ? -190 : 190, 390, 800, lx, ly, t);
  };
  for (let i = 0; i < 20; i++) {
    now = 1000 + i * 150; p.startRawPointer(event(x, now));
    now += 20; p.finishRawPointer(event(x, now), { id: 7, x, y: 200 });
  }
  assert.equal(regrabs, 0, 'stationary rapid DOWN/UP never replaces an existing release intent');
  assert.equal(log.filter(x => x[0] === 'deferred' && x[1] === direction).length, 20);
  assert.equal(log.filter(x => x[0] === 'up').length, 20);
}
{
  const { p, log } = pointer({ deferred: true });
  let regrabs = 0;
  p.onRegrab = (_w, _h, x, y, t) => { regrabs++; return gesture.resumeReaderPagePan('next', -140, 390, 800, x, y, t); };
  now = 1000; p.startRawPointer(event(300, now));
  now += 16; p.updateRawPointer(event(297, now), { id: 7, x: 297, y: 200 });
  assert.equal(regrabs, 0, 'sub-slop movement is still a possible tap');
  now += 16; p.updateRawPointer(event(260, now), { id: 7, x: 260, y: 200 });
  assert.equal(regrabs, 1); assert.equal(p.tapOnlyPointer, false);
  assert.equal(p.gestureState.currentOffsetX, -140, 'first claimed MOVE adopts the actual current pose without replay');
  now += 16; p.updateRawPointer(event(250, now), { id: 7, x: 250, y: 200 });
  assert.equal(regrabs, 1); assert.equal(p.gestureState.currentOffsetX, -150, 'subsequent MOVE follows finger displacement');
  assert.equal(log.filter(x => x[0] === 'promote').length, 1);
  p.cancelPan(); p.resolveDeferredSegment(undefined); p.resetRawPointer();
  assert.equal(log.filter(x => x[0] === 'deferred').length, 0, 'promoted drag does not also enqueue its old tap reservation');
  assert.equal(log.filter(x => x[0] === 'up').length, 1);
}

for (const deferred of [false, true]) {
  const { p, log } = pointer({ deferred });
  p.startRawPointer(event(300, 1000));
  now = 1050;
  p.finishRawPointer(event(50, 1050), { id: 7, x: 50, y: 200 });
  assert.ok(log.some(x => x[0] === (deferred ? 'deferred' : 'turn') && x[1] === 'next'));
  assert.ok(!log.some(x => x[0] === 'turn' && x[1] === 'previous'), 'final UP must not become a left-zone tap');
  assert.equal(p.activePointerId, -1);
  assert.equal(log.filter(x => x[0] === 'up').length, 1);
}
{
  timers = [];
  const { p, log } = pointer();
  p.startRawPointer(event(300, 2000));
  for (let i = 1; i <= 120; i++) {
    now += 8;
    p.updateRawPointer(event(300-i, 2000+i*8), { id: 7, x: 300-i, y: 200 });
  }
  assert.equal(log.filter(x => x[0] === 'admission').length, 1, 'full admission only when ownership is granted');
  assert.equal(timers.length, 1, 'MOVE updates activity without replacing the timer');
  p.finishRawPointer(event(80, 3100), { id: 7, x: 80, y: 200 });
  const lastDrag = log.filter(x => x[0] === 'state' && x[1] === 'dragging').at(-1);
  assert.equal(lastDrag[2], -220, 'final posture is published before settlement');
  assert.ok(log.findIndex(x => x[0] === 'up') < log.findIndex(x => x[0] === 'turn'));
}
{
  const clock = new ReaderPageInputClock();
  assert.equal(clock.sample(1e9, 1000), 1000);
  assert.equal(clock.sample(Number.NaN, 1016), 1016);
  assert.equal(clock.resetVelocity, true);
  assert.equal(clock.sample(1.032e9, 1032), 1032);
  assert.equal(clock.sample(1.048e9, 1048), 1048);
  assert.equal(clock.resetVelocity, false, 'valid samples recover after missing timestamp');
  const reset = clock.sample(1e6, 1064);
  assert.ok(reset >= 1048);
  assert.equal(clock.resetVelocity, true);
  const cold = new ReaderPageInputClock();
  cold.sample(Number.NaN, 8000);
  assert.equal(cold.sample(16e6, 8016), 8016);
  assert.equal(cold.sample(32e6, 8032), 8032);
}
const Owner = production('LocalReadingExperience.ets', ['drainRapidPageTurn', 'performPageTurn'], {});
for (const direction of ['next', 'previous']) {
  const o = Object.assign(new Owner(), { mounted: true, exitRequested: false,
    controlVisible: () => false, controlObscured: false, interactionBlocked: false,
    activePagePointerId: 7, pendingPointerSegmentReserved: false });
  assert.equal(o.drainRapidPageTurn().kind, 'busy', 'old preparation/rapid drain respects physical DOWN');
  assert.equal(o.performPageTurn(direction).kind, 'busy', 'direct producers including Auto Page respect DOWN');
}
console.log('reader page input production sequence regressions: PASS');

{
  const { p, log } = pointer({ ready: false });
  p.startRawPointer(event(300, 4000));
  p.updateRawPointer(event(180, 4040), { id: 7, x: 180, y: 200 });
  assert.equal(p.pointerRejected, true);
  assert.deepEqual(log.filter(x => x[0] === 'prepare'), [['prepare', 'next']]);
  p.canStartTurn = () => true;
  p.onReadinessChanged();
  assert.equal(p.gestureState.startLocalX, 300,
    'readiness preserves the original DOWN origin');
  assert.equal(p.gestureState.currentOffsetX, -120,
    'readiness replays the held displacement immediately');
  p.finishRawPointer(event(180, 4050), { id: 7, x: 180, y: 200 });
  assert.ok(log.some(x => x[0] === 'turn'), 'held displacement commits as a page turn on UP');
  assert.ok(!log.some(x => x[0] === 'control'), 'held displacement does not become a tap');
}

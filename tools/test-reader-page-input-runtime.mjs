import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as gesture from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';
import { ReaderPageInputClock } from '../entry/src/main/ets/features/reading/ReaderPageInputClock.ts';
import { createDefaultReaderSettingsSnapshot, setReaderPageTurnStyle } from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';

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
  'handleTouch', 'pointerForEvent', 'changedPointerForEvent', 'ownPointer',
  'eventViewportWidth', 'eventViewportHeight', 'pageViewportWidth', 'pageViewportHeight',
  'pageLocalX', 'pageLocalY', 'systemOwnsPointer', 'finiteInset',
  'eventTargetPosition', 'freezePointerGeometry', 'pointerGeometryMatches', 'onPointerGeometryChanged',
  'reportBookmarkUnavailable', 'onInputRevisionChanged', 'onInteractionEnabledChanged',
], { ...gesture, ReaderPageInputClock, readerMotionNowMs: () => now,
  TouchType: { Down: 'down', Move: 'move', Up: 'up', Cancel: 'cancel' },
  READER_PAGE_POINTER_STALL_TIMEOUT_MS: 15000,
  setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimeout: () => {} });
function pointer({ ready = true, deferred = false, bookmarkReady = true } = {}) {
  const log = [], p = Object.assign(new Pointer(), {
    gestureState: gesture.createReaderPageGestureState(), activePointerId: -1,
    inputClock: new ReaderPageInputClock(), pointerWatchdogTimer: -1,
    deferredSegmentReserved: false, interactionEnabled: true, tapOnly: deferred,
    manualInteractionReported: false, lastSampleTimeMs: 0,
    pointerGeometryFrozen: false, bookmarkUnavailableReported: false,
    systemGestureLeftInset: 0, systemGestureRightInset: 0, systemGestureBottomInset: 0,
    onRegrab: () => undefined,
    onPointerStart: id => { log.push(['down', id]); return true; },
    onPreparationNeeded: direction => log.push(['prepare', direction]),
    viewportWidth: 390, viewportHeight: 800,
    onPointerEnd: id => log.push(['up', id]),
    armLongPressTimer: () => {}, clearLongPressTimer: () => {},
    onDeferredSegmentStart: () => true, onDeferredSegmentResolve: intent => log.push(['deferred', intent]),
    onDeferredSegmentPromote: () => log.push(['promote']),
    canStartTurn: direction => { log.push(['admission', direction]); return ready; },
    canStartBookmark: () => { log.push(['bookmark-admission']); return bookmarkReady; }, onManualInteraction: () => log.push(['manual']),
    onBookmarkStateChange: state => log.push(['bookmark-state', state.phase, state.bookmarkPreviewChanged, state.bookmarkOffsetY]),
    onBookmarkRelease: changed => log.push(['bookmark-release', changed]),
    onBookmarkUnavailable: reason => log.push(['bookmark-unavailable', reason]),
    onOpenControl: () => log.push(['control']),
    onTurn: direction => { log.push(['turn', direction]); return { kind: 'started' }; },
    onGestureDecision: decision => decision,
    onGestureStateChange: state => log.push(['state', state.phase, state.currentOffsetX]),
  });
  return { p, log };
}
const event = (x, ms, id = 7, y = 200, area = {}) => ({ timestamp: ms * 1e6,
  target: { area: { width: 390, height: 800, globalPosition: { x: 0, y: 0 }, ...area } },
  changedTouches: [{ id, x, y }], touches: [], stopped: false, prevented: false,
  stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } });

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

const outcomes = log => log.filter(row => ['turn', 'bookmark-release', 'control', 'deferred'].includes(row[0]));
function touch(p, type, x, y, ms, area = {}) {
  now = ms;
  const e = event(x, ms, 7, y, area); e.type = type; p.handleTouch(e); return e;
}
function replay(points, { deferred = false, bookmarkReady = true, x = 195, y = 200,
  area = {}, stageWidth = 390, stageHeight = 800, insets = [0, 0, 0] } = {}) {
  const f = pointer({ deferred, bookmarkReady });
  Object.assign(f.p, { viewportWidth: stageWidth, viewportHeight: stageHeight,
    systemGestureLeftInset: insets[0], systemGestureRightInset: insets[1], systemGestureBottomInset: insets[2] });
  touch(f.p, 'down', x, y, 1000, area);
  points.forEach(([dx, dy], index) => touch(f.p, index === points.length - 1 ? 'up' : 'move',
    x + dx, y + dy, 1016 + index * 16, area));
  return f;
}

// Real raw coordinates, not normalized stage displacement, choose the owner.
// Replaying a near-vertical line with fewer platform samples has the same UP.
let trajectoryCases = 0;
for (const points of [
  [[0, 20], [0, 48], [0, 120]],
  [[2, 20], [4, 40], [6, 60], [8, 80], [12, 120]], [[12, 120]],
  [[2, 10], [4, 20], [6, 30], [8, 40], [24, 120]], [[24, 120]],
  [[9, 2], [6, 20], [5, 60], [10, 120]],
  [[-9, 2], [-6, 20], [-5, 60], [-10, 120]],
]) for (const geometry of [
  {}, { stageWidth: 800, stageHeight: 1200, insets: [16, 16, 24] },
  { area: { width: '780vp', height: '1200vp' }, stageWidth: 320, stageHeight: 600, insets: [24, 30, 34] },
]) {
  const { p, log } = replay(points, geometry);
  assert.deepEqual(outcomes(log), [['bookmark-release', true]], 'downward raw intent cannot become a page turn or tap');
  assert.equal(log.filter(row => row[0] === 'bookmark-admission').length, 1);
  assert.equal(p.activePointerId, -1); assert.equal(log.filter(row => row[0] === 'up').length, 1);
  trajectoryCases++;
}
for (const direction of [-1, 1]) for (const distance of [8, 12, 15.9])
for (const dense of [false, true]) for (const deferred of [false, true]) {
  const points = dense ? [[direction * distance / 2, 0], [direction * distance, 0]] : [[direction * distance, 0]];
  const { log } = replay(points, { deferred, stageWidth: 800, insets: [16, 16, 24] });
  assert.deepEqual(outcomes(log), [[deferred ? 'deferred' : 'turn', direction < 0 ? 'next' : 'previous']],
    'UP admits a real 8–16vp sweep once before tap/settlement routing');
  assert.equal(log.filter(row => row[0] === 'promote').length, 0, 'UP cannot re-grab or promote an old settlement');
  trajectoryCases++;
}
for (const y of [0, 47.9, 48, 48.1]) {
  const { log } = replay([[0, y]], { stageWidth: 800, stageHeight: 1200, insets: [16, 16, 24] });
  assert.deepEqual(outcomes(log), y === 0 ? [['control']] : y >= 48 ? [['bookmark-release', true]] : [],
    'stage scaling cannot change the physical bookmark commit threshold');
}
assert.deepEqual(outcomes(replay([[0, 20], [0, 47.9]]).log), [['bookmark-release', false]],
  'a preview admitted by MOVE rolls back below the commit threshold');

// Tap zones retain the measured stage mapping; system bands are checked first.
for (const [x, intent] of [[40, 'previous'], [195, 'control'], [350, 'next']]) {
  const { log } = replay([[0, 0]], { x, stageWidth: 800, insets: [16, 16, 24] });
  assert.deepEqual(outcomes(log), intent === 'control' ? [['control']] : [['turn', intent]]);
}
for (const [x, y, systemOwned] of [[15, 200, true], [16, 200, false], [374, 200, false],
  [375, 200, true], [195, 776, false], [195, 777, true], [195, 0, false]]) {
  const { p, log } = pointer(); Object.assign(p, { systemGestureLeftInset: 16, systemGestureRightInset: 16, systemGestureBottomInset: 24 });
  const e = touch(p, 'down', x, y, 1000);
  assert.equal(p.activePointerId >= 0, !systemOwned);
  assert.equal(e.stopped, false); assert.equal(e.prevented, false, 'DOWN never steals the system stream');
  if (systemOwned) assert.deepEqual(log, []);
  p.cancelPan(); p.resolveDeferredSegment(undefined); p.resetRawPointer();
}
for (const [x, y] of [[30, 40], [195, 40], [360, 40], [30, 400], [195, 400], [360, 400], [195, 650]]) {
  const { log } = replay([[9, 2], [6, 20], [10, 120]], { x, y, insets: [16, 16, 24] });
  assert.deepEqual(outcomes(log), [['bookmark-release', true]], 'inner-page origin cannot change the downward intent');
}

// A changed physical target or page mapping invalidates this entire segment;
// a later UP must not classify the changed coordinates as a fresh tap/turn.
for (const change of ['target-width', 'target-height', 'target-position', 'stage-width', 'stage-height', 'inset']) {
  const { p, log } = pointer();
  touch(p, 'down', 195, 200, 1000); touch(p, 'move', 197, 220, 1016);
  let area = {};
  if (change === 'target-width') area.width = 420;
  if (change === 'target-height') area.height = 900;
  if (change === 'target-position') area.globalPosition = { x: 0, y: 30 };
  if (change === 'stage-width') p.viewportWidth = 800;
  if (change === 'stage-height') p.viewportHeight = 1200;
  if (change === 'inset') p.systemGestureLeftInset = 20;
  touch(p, 'up', 200, 320, 1032, area);
  assert.deepEqual(outcomes(log), [['bookmark-release', false]], change + ': geometry changes cancel the preview without committing');
  assert.equal(p.activePointerId, -1); assert.equal(log.filter(row => row[0] === 'up').length, 1);
}
{
  const { p, log } = pointer(); touch(p, 'down', 195, 200, 1000); touch(p, 'move', 195, 260, 1016);
  p.viewportWidth = 800; p.onPointerGeometryChanged();
  touch(p, 'up', 195, 320, 1032);
  assert.deepEqual(outcomes(log), [['bookmark-release', false]], 'the actual Prop watch releases before another event arrives');
  assert.equal(log.filter(row => row[0] === 'up').length, 1);
}

// Unavailable/pending context and non-interruptible settlement stay silent
// until a full bookmark pull, and report only once for this physical pointer.
for (const deferred of [false, true]) {
  const { p, log } = pointer({ deferred, bookmarkReady: false });
  touch(p, 'down', 195, 200, 1000); touch(p, 'move', 195, 220, 1016);
  assert.deepEqual(log.filter(row => row[0] === 'bookmark-unavailable'), []);
  for (let i = 0; i < 5; i++) touch(p, 'move', 197, 260 + i * 10, 1032 + i * 16);
  touch(p, 'up', 200, 320, 1128);
  assert.deepEqual(log.filter(row => row[0] === 'bookmark-unavailable'), [['bookmark-unavailable', deferred ? 'busy' : 'unavailable']]);
  assert.deepEqual(outcomes(log), deferred ? [['deferred', undefined]] : [], 'blocked pull cannot enqueue a page or a late bookmark');
  assert.equal(p.activePointerId, -1);
}
for (const finish of ['cancel', 'disabled', 'watchdog']) {
  const { p, log } = pointer(); timers = [];
  touch(p, 'down', 195, 200, 1000); touch(p, 'move', 195, 280, 1016);
  if (finish === 'cancel') { touch(p, 'cancel', 195, 280, 1032); touch(p, 'cancel', 195, 280, 1048); }
  if (finish === 'disabled') { p.interactionEnabled = false; p.onInteractionEnabledChanged(); }
  if (finish === 'watchdog') { now = 17000; timers[0].fn(); }
  assert.deepEqual(outcomes(log), [['bookmark-release', false]], finish + ': rollback once, never a mutation');
  assert.equal(p.activePointerId, -1); assert.equal(log.filter(row => row[0] === 'up').length, 1);
}
{
  const { p, log } = pointer({ deferred: true });
  touch(p, 'down', 195, 200, 1000); touch(p, 'move', 195, 280, 1016);
  const states = log.filter(row => row[0] === 'state').length;
  touch(p, 'cancel', 195, 280, 1032);
  assert.deepEqual(outcomes(log), [['deferred', undefined]]);
  assert.equal(log.filter(row => row[0] === 'state').length, states, 'cancel of silent tapOnly input cannot roll back the existing page settlement');
}
{
  const { p, log } = pointer({ deferred: true });
  touch(p, 'down', 195, 200, 1000); touch(p, 'move', 205, 280, 1016);
  p.tapOnly = false; p.onInteractionModeChanged();
  assert.equal(p.gestureState.owner, 'undecided'); assert.equal(p.gestureState.inputOffsetY, 0);
  touch(p, 'up', 205, 280, 1032);
  assert.deepEqual(outcomes(log), [], 'mode completion clears the old pull without turning it into a tap or late bookmark');
  assert.equal(log.filter(row => row[0] === 'promote').length, 1);
  touch(p, 'down', 205, 280, 1048); touch(p, 'up', 205, 340, 1064);
  assert.deepEqual(outcomes(log), [['bookmark-release', true]], 'the same owner accepts a fresh physical segment without stale candidate state');
}

// Re-grab preserves a real visible stage pose and its inverse-mapped raw pose.
{
  const { p, log } = pointer({ deferred: true }); Object.assign(p, { viewportWidth: 800, systemGestureLeftInset: 16, systemGestureRightInset: 16 });
  let regrabs = 0;
  p.onRegrab = (w, h, x, y, time) => { regrabs++; return gesture.resumeReaderPagePan('next', -200, w, h, x, y, time); };
  touch(p, 'down', 300, 200, 1000); touch(p, 'move', 280, 200, 1016);
  assert.equal(p.gestureState.currentOffsetX, -200);
  assert.equal(p.gestureState.inputOffsetX, -200 * 358 / 800);
  touch(p, 'move', 290, 200, 1032);
  assert.ok(Math.abs(p.gestureState.currentOffsetX - (-200 + 10 * 800 / 358)) < 1e-9);
  assert.ok(Math.abs(p.gestureState.inputOffsetX - (-200 * 358 / 800 + 10)) < 1e-9);
  touch(p, 'up', 290, 200, 1048);
  assert.deepEqual(outcomes(log), [['turn', 'next']]); assert.equal(regrabs, 1);
  assert.equal(log.filter(row => row[0] === 'promote').length, 1);
}

// Exercise the real parent gate: all paged styles share this arena; a mounted
// continuous body retains scrolling, while its admitted page fallback uses it.
const rawLayer = source('LocalReadingExperience.ets').split('ReaderPageInteractionLayer({')[1];
const enabledExpression = rawLayer.match(/interactionEnabled: ([\s\S]+?),\s*tapOnly:/)?.[1]; assert.ok(enabledExpression);
const admittedArena = new Function('return function(){return ' + enabledExpression + ';}')();
for (const style of ['simulation', 'cover', 'slide', 'none', 'scroll']) for (const continuous of [false, true]) {
  const snapshot = setReaderPageTurnStyle(createDefaultReaderSettingsSnapshot(), style);
  const enabled = admittedArena.call({ phase: 'ready', sourceSwitchFailureMessage: '', readerSettingsSnapshot: snapshot,
    hasContinuousRenderContent: () => continuous, isReaderPageInteractionEnabled: () => true });
  assert.equal(enabled, style !== 'scroll' || !continuous);
  const { p, log } = pointer(); p.interactionEnabled = enabled;
  touch(p, 'down', 195, 200, 1000); touch(p, 'up', 219, 320, 1016);
  assert.deepEqual(outcomes(log), enabled ? [['bookmark-release', true]] : [], style + ': actual parent admission is authoritative');
}
console.log(`PASS raw 2D input: ${trajectoryCases} dense/sparse/final-UP physical trajectories, actual coordinate/edge/geometry gates, bookmark admission/feedback/cancel, silent settlement, re-grab continuity and real five-mode parent gate`);

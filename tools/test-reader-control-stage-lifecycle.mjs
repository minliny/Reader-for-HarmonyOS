import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as sessionPolicy from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import * as gesturePolicy from '../entry/src/main/ets/features/reading/ReaderControlGestureDriver.ts';
import * as geometryPolicy from '../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts';
import * as layoutPolicy from '../entry/src/main/ets/features/reading/ReaderControlLayoutRebase.ts';

// Execute the actual ArkTS adapter methods, not a mirrored state machine. Only
// ArkUI syntax, decorators, and render DSL are removed. The fake UI context
// controls posted callback delivery, while semantic prop writes notify the
// real watcher. The harness exposes `session` as a compatibility alias for
// the Stage's local visual snapshot so behavior assertions remain focused on
// the production reducer samples.
// This is a deterministic adapter test, not evidence of native frame scheduling.
const stageSource = readFileSync(new URL(
  '../entry/src/main/ets/features/reading/ReaderControlMotionStage.ets', import.meta.url), 'utf8');
const dependencies = { ...sessionPolicy, ...gesturePolicy, ...geometryPolicy, ...layoutPolicy,
  FrameCallback: class {}, TouchType: { Down: 0, Up: 1, Move: 2, Cancel: 3 } };
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8,
  `${message}: ${actual} != ${expected}`);

function loadStage(source = stageSource, overrides = {}) {
  assert.equal(source.split('\n  build() {').length, 2, 'one render body extraction boundary');
  const methods = `${source.split('\n  build() {')[0]}\n}`
    .replace(/^import[\s\S]*?;\s*/gm, '')
    .replace(/@(?:Component|Link|Prop|State|BuilderParam|Builder)\b\s*/g, '')
    .replace(/@Watch\('[^']+'\)\s*/g, '')
    .replace('export struct ReaderControlMotionStage', 'class ReaderControlMotionStage');
  const executable = stripTypeScriptTypes(methods);
  const globals = { ...dependencies, ...overrides };
  return new Function(...Object.keys(globals), `${executable}\nreturn ReaderControlMotionStage;`)(
    ...Object.values(globals));
}

const quick = () => sessionPolicy.enterReaderControlModule(
  sessionPolicy.openReaderControlSession(sessionPolicy.createReaderControlSessionState(), 0),
  'directory', 0, 'toc');
const expanding = () => sessionPolicy.expandReaderControlSession(quick(), 1150);

function harness(Stage = loadStage(), initial = expanding(), enabled = true) {
  const stage = new Stage();
  const callbacks = [];
  const geometry = [];
  stage.semanticSession = initial;
  stage.visualSession = structuredClone(initial);
  stage.inputEnabled = enabled;
  stage.settleDurationMs = 1150;
  stage.getUIContext = () => ({ postFrameCallback: callback => callbacks.push(callback) });
  stage.onDockGeometryChange = (rect, ready) => geometry.push({ rect, ready });
  Object.defineProperty(stage, 'session', { configurable: true,
    get: () => stage.visualSession,
    set: value => {
      stage.semanticSession = value;
      stage.onSemanticSessionChanged();
    },
  });
  stage.aboutToAppear();
  return { stage, callbacks, geometry,
    frame(timeMs) {
      assert.ok(callbacks.length > 0, 'an actual frame callback must have been posted');
      callbacks.shift().onFrame(timeMs * 1_000_000);
    },
    setInput(value) { stage.inputEnabled = value; stage.onInputEnabledChanged(); },
  };
}

function checkPauseAndResume(Stage) {
  const h = harness(Stage);
  h.frame(1000);
  h.frame(1100);
  near(h.stage.session.transition.elapsedMs, 100, 'foreground elapsed time');
  const paused = structuredClone(h.stage.session);
  h.setInput(false);
  h.frame(1_000_000); // A callback already queued before backgrounding can arrive.
  assert.deepEqual(h.stage.session, paused, 'disabled automatic animation cannot advance');
  assert.equal(h.callbacks.length, 0, 'disabled callback cannot post another frame');
  h.stage.scheduleFrame();
  assert.equal(h.callbacks.length, 0, 'direct scheduling while disabled is blocked');
  h.setInput(true);
  h.frame(2_000_000);
  assert.deepEqual(h.stage.session, paused, 'resume first frame is a fresh timestamp baseline');
  h.frame(2_000_050);
  near(h.stage.session.transition.elapsedMs, 150, 'resume retains only foreground elapsed time');
  h.frame(2_001_050);
  assert.equal(h.stage.session.transition, undefined, 'exact original remaining duration completes');
  assert.equal(h.stage.session.location.form, 'full');
  assert.equal(h.callbacks.length, 0, 'settled operation stops its clock');
}

function checkStaleCallbackOwnership(Stage) {
  const h = harness(Stage);
  h.frame(1000);
  const revoked = h.callbacks.shift();
  h.setInput(false);
  h.setInput(true);
  assert.equal(h.callbacks.length, 1, 'reenabling posts one new lifecycle callback');
  const paused = structuredClone(h.stage.session);
  revoked.onFrame(10_000_000_000);
  assert.equal(h.stage.pendingFrame, true, 'old callback cannot clear the new lifecycle pending flag');
  assert.equal(h.callbacks.length, 1, 'old callback cannot duplicate the new lifecycle queue');
  assert.deepEqual(h.stage.session, paused, 'old lifecycle callback cannot advance the session');
  h.stage.scheduleFrame();
  assert.equal(h.callbacks.length, 1, 'pending ownership prevents duplicate scheduling');
  h.frame(20000);
  near(h.stage.session.transition.elapsedMs, 0, 'new lifecycle establishes its own baseline');
  h.frame(20016);
  near(h.stage.session.transition.elapsedMs, 16, 'only one current callback advances time');

  const fromPreviousMount = h.callbacks.shift();
  h.stage.aboutToDisappear();
  h.stage.aboutToAppear();
  fromPreviousMount.onFrame(30_000_000_000);
  assert.equal(h.stage.pendingFrame, true, 'unmounted callback cannot steal remount ownership');
  assert.equal(h.callbacks.length, 1);
  h.frame(40000);
  near(h.stage.session.transition.elapsedMs, 16, 'remount does not count absent wall time');
}

function checkInitialDisableAndCommands(Stage) {
  const h = harness(Stage, expanding(), false);
  assert.equal(h.callbacks.length, 0, 'initially disabled mount cannot run');
  h.stage.session = sessionPolicy.dismissReaderControlSession(h.stage.session, 360);
  assert.equal(h.callbacks.length, 0, 'explicit host command while disabled remains paused');
  const commanded = structuredClone(h.stage.session);
  h.setInput(true);
  h.frame(500000);
  assert.deepEqual(h.stage.session, commanded, 'reenable cannot fast-forward an explicit background command');
  h.frame(500090);
  near(h.stage.session.transition.elapsedMs, 90, 'latest command resumes, not revoked expansion');
}

function checkRepeatedSemanticDoesNotResetVisual(Stage) {
  const h = harness(Stage);
  h.frame(1000);
  h.frame(1100);
  const before = structuredClone(h.stage.visualSession);
  // A parent rebuild may redeliver the same semantic transition while the
  // local clock is already part-way through it. The visual sample must remain
  // untouched and must not acquire a second frame baseline.
  h.stage.semanticSession = structuredClone(h.stage.semanticSession);
  h.stage.onSemanticSessionChanged();
  assert.deepEqual(h.stage.visualSession, before,
    'repeated semantic prop delivery cannot reset the local visual clock');
  assert.equal(h.callbacks.length, 1, 'duplicate semantic delivery cannot queue an extra frame');
}

function checkHeldPointerRevocation(Stage) {
  const h = harness(Stage);
  h.frame(1000);
  h.frame(1100);
  const interrupted = structuredClone(h.stage.session.transition);
  const y = gesturePolicy.readerControlGrabberScreenY(
    sessionPolicy.sampleReaderControlSession(h.stage.session), h.stage.gestureConfig().axis);
  h.stage.acceptTouch(gesturePolicy.beginReaderControlGesture(h.stage.session,
    h.stage.pointerState, 7, y, 1100));
  assert.equal(h.stage.session.heldPointerId, 7);
  h.setInput(false);
  assert.equal(h.stage.session.heldPointerId, -1, 'background revokes the held input owner');
  assert.equal(h.stage.pointerState.pointerId, -1);
  assert.deepEqual(h.stage.session.transition, interrupted,
    'stationary cancellation retains the interrupted operation and its remaining phase');
  h.frame(200000);
  assert.equal(h.callbacks.length, 0, 'revoked input cannot wake a background clock');
  h.setInput(true);
  h.frame(300000);
  assert.deepEqual(h.stage.session.transition, interrupted, 'resume after pointer cancellation starts without a jump');
  h.frame(300020);
  near(h.stage.session.transition.elapsedMs, 120, 'canceled pointer resumes only the original operation');
}

function checkCompensationPause(Stage) {
  const h = harness(Stage);
  // Adopt the same revision before the queued callback begins, as an admitted
  // layout update can invalidate that first callback.
  h.stage.layoutCompensation = { offsetY: 40, startOffsetY: 40, elapsedMs: 0,
    durationMs: 500, running: true, revision: 1 };
  h.frame(1000); // stale layout revision: schedules the admitted revision.
  h.frame(1000);
  h.frame(1100);
  near(h.stage.layoutCompensation.offsetY, 32, 'compensation uses foreground frame delta');
  const paused = structuredClone(h.stage.layoutCompensation);
  h.setInput(false);
  h.frame(100000);
  assert.deepEqual(h.stage.layoutCompensation, paused, 'background pauses the complete composition');
  h.setInput(true);
  h.frame(200000);
  assert.deepEqual(h.stage.layoutCompensation, paused, 'compensation also gets a fresh resume baseline');
  h.frame(200050);
  near(h.stage.layoutCompensation.offsetY, 28, 'compensation and session resume on the same delta');
  near(h.stage.session.transition.elapsedMs, 150, 'session shares compensation clock');
}

function checkDockGeometry(Stage) {
  const initial = expanding();
  const sampled = sessionPolicy.advanceReaderControlSession(initial, 431.25, initial.epoch);
  const hidden = sessionPolicy.dismissReaderControlSession(sampled, 360);
  const h = harness(Stage, sessionPolicy.advanceReaderControlSession(hidden, 90, hidden.epoch));
  h.stage.stageScreenX = 37;
  h.stage.stageScreenY = 64;
  h.stage.layoutCompensation.offsetY = -17;
  h.stage.reportDockGeometry();
  assert.equal(h.geometry.at(-1).ready, false, 'unmeasured geometry is explicitly not ready');
  h.stage.axisMeasured = true;
  h.stage.reportDockGeometry();
  const { rect, ready } = h.geometry.at(-1);
  assert.equal(ready, true);
  near(rect.x, 37, 'dock screen x');
  near(rect.y, 64 + 406 * (1 - 0.375) - 17 + 18 * 0.25,
    'dock rect includes stage origin, shape, layout compensation, and parent visibility displacement');
  near(rect.width, 364, 'dock width');
  near(rect.height, 330 + 406 * 0.375, 'dock actual morph height');
  h.stage.mounted = false;
  h.stage.reportDockGeometry();
  assert.equal(h.geometry.at(-1).ready, false, 'unmounted reported geometry is not ready');
}

function checkGeometryLifecycle(Stage) {
  const h = harness(Stage, quick());
  h.stage.stageScreenY = 64;
  h.stage.axisMeasured = true;
  h.stage.layoutCompensation = { offsetY: 40, startOffsetY: 40, elapsedMs: 0,
    durationMs: 500, running: true, revision: 1 };
  h.stage.reportDockGeometry();
  near(h.geometry.at(-1).rect.y, 64 + 406 + 40, 'starting compensated geometry');
  h.stage.scheduleFrame();
  h.frame(1000);
  h.frame(1100);
  assert.equal(h.stage.session.transition, undefined, 'this is compensation-only, no session change');
  near(h.stage.layoutCompensation.offsetY, 32, 'the compensation really moved');
  near(h.geometry.at(-1).rect.y, 64 + 406 + 32,
    'compensation-only frame must notify Host even without a session Watch');
  h.stage.aboutToDisappear();
  assert.equal(h.geometry.at(-1).ready, false, 'unmount must invalidate the last Host rect explicitly');
}

// Use native-shaped TouchEvent payloads through the actual Stage touch method.
// changedTouches is a delta set, not a replacement owner; timestamps are ns and
// positions are window vp. This remains an adapter replay, not native injection.
function touch(h, type, timeMs, changedTouches = [], touches = changedTouches) {
  let stopped = 0;
  h.stage.touch({ type, timestamp: timeMs * 1_000_000, changedTouches, touches,
    stopPropagation() { stopped += 1; },
    preventDefault() { assert.fail('Stack has no preventable native default action'); } });
  return stopped;
}
const point = (id, windowY) => ({ id, windowY });
const visual = h => sessionPolicy.sampleReaderControlSession(h.stage.session);
const grabberY = h => h.stage.stageScreenY + h.stage.frame().grabber.y + h.stage.frame().dock.translateY;
function touchHarness(Stage, initial) {
  const h = harness(Stage, initial);
  h.stage.tapMaxDurationMs = 350;
  h.stage.directionSlopVp = 2;
  h.stage.showDurationMs = 420;
  h.stage.dismissDurationMs = 360;
  h.stage.admitLayout(0);
  return h;
}
const bookmarks = () => sessionPolicy.enterReaderControlModule(
  sessionPolicy.openReaderControlSession(sessionPolicy.createReaderControlSessionState(), 0),
  'directory', 0, 'bookmarks');

function checkTouchOwnerAndFinalUp(Stage) {
  const h = touchHarness(Stage, bookmarks());
  const y = grabberY(h);
  assert.equal(touch(h, 0, 1000, [point(7, y)]), 1, 'DOWN is owned and propagation stopped');
  const held = h.stage.session;
  assert.equal(touch(h, 0, 1005, [point(8, y + 50)], [point(7, y), point(8, y + 50)]), 1,
    'secondary DOWN is consumed by the owner grabber');
  assert.strictEqual(h.stage.session, held, 'second DOWN cannot replace the pointer owner');
  assert.equal(touch(h, 2, 1010, [point(8, y - 200)], [point(7, y), point(8, y - 200)]), 1,
    'secondary MOVE cannot leak to the reader');
  assert.strictEqual(h.stage.session, held, 'second-only MOVE cannot move the composition');
  assert.equal(touch(h, 1, 1015, [point(8, y - 200)], [point(7, y)]), 1,
    'secondary UP cannot leak to the reader');
  assert.strictEqual(h.stage.session, held, 'second UP cannot end the primary touch');
  assert.equal(h.stage.session.heldPointerId, 7);

  touch(h, 2, 1020, [point(8, y - 200), point(7, y - 40)]);
  near(grabberY(h), y - 40, 'owner MOVE works even when not first in changedTouches');
  touch(h, 2, 1025, [], [point(8, y - 200), point(7, y - 50)]);
  near(grabberY(h), y - 50, 'empty changedTouches falls back to matching active owner');
  touch(h, 1, 1040, [point(7, y - 80)], []);
  near(grabberY(h), y - 80, 'UP-only final displacement is applied exactly once before release');
  assert.equal(h.stage.session.heldPointerId, -1);
  assert.equal(h.stage.pointerState.pointerId, -1);
  assert.equal(sessionPolicy.readerControlTargetLocation(h.stage.session).form, 'full',
    'short up motion settles forward without requiring half travel');
  assert.equal(sessionPolicy.readerControlContentLocation(h.stage.session).directoryTab, 'bookmarks');
  const released = h.stage.session;
  touch(h, 1, 1050, [point(7, y - 100)], []);
  assert.strictEqual(h.stage.session, released, 'duplicate UP cannot retarget or apply movement again');
}

function checkTouchHoldResumeAndRegrab(Stage) {
  const h = touchHarness(Stage, expanding());
  h.frame(1000);
  h.frame(1200);
  const operation = structuredClone(h.stage.session.transition);
  const heldFrame = visual(h);
  touch(h, 0, 1200, [point(7, grabberY(h))]);
  h.frame(100000); // A pre-DOWN frame was posted but has a revoked epoch.
  assert.deepEqual(visual(h), heldFrame, 'posted frame cannot move held visual state');
  assert.equal(h.callbacks.length, 0, 'held touch stops the common frame loop');
  touch(h, 2, 100100, [point(7, grabberY(h))]);
  assert.deepEqual(h.stage.session.transition, operation, 'stationary MOVE preserves original curve phase');
  touch(h, 1, 100200, [point(7, grabberY(h))], []);
  assert.deepEqual(h.stage.session.transition, operation, 'long UP resumes the original operation');
  h.frame(100200);
  assert.deepEqual(h.stage.session.transition, operation, 'resume frame starts with fresh timestamp, not hold duration');
  h.frame(100250);
  near(h.stage.session.transition.elapsedMs, 250, 'only foreground 50ms advances after the pause');

  const y = grabberY(h);
  touch(h, 0, 100250, [point(9, y)]);
  touch(h, 2, 100270, [point(9, y + 12)]);
  near(grabberY(h), y + 12, 're-grab reverse movement follows the finger immediately');
  touch(h, 2, 100280, [point(9, y - 18)]);
  near(grabberY(h), y - 18, 'second reversal remains the same spatial process');
  assert.equal(touch(h, 3, 100290, [], []), 1,
    'owned empty CANCEL is consumed by the grabber');
  assert.equal(h.stage.session.heldPointerId, -1, 'empty CANCEL releases active pointer, not a tap');
  assert.equal(sessionPolicy.readerControlTargetLocation(h.stage.session).form, 'full',
    'CANCEL resumes the goal captured on the latest DOWN');
}

function checkOwnerPropagationBoundary(Stage) {
  const h = touchHarness(Stage, bookmarks());
  const y = grabberY(h);
  assert.equal(touch(h, 3, 1000, [], []), 0, 'CANCEL with no owner preserves background propagation');
  assert.equal(touch(h, 0, 1010, [point(3, y)]), 1);
  assert.equal(touch(h, 3, 1020, [], []), 1, 'owned CANCEL is consumed once and releases the gesture');
  assert.equal(h.stage.pointerState.pointerId, -1);
  assert.equal(touch(h, 2, 1030, [point(8, y - 20)], []), 0,
    'after release, a new no-owner malformed MOVE is not globally swallowed');
}

function checkStableTouchHoldAndHome(Stage) {
  const home = sessionPolicy.openReaderControlSession(sessionPolicy.createReaderControlSessionState(), 0);
  for (const initial of [home, bookmarks(), sessionPolicy.expandReaderControlSession(bookmarks(), 0)]) {
    const h = touchHarness(Stage, initial);
    const before = visual(h);
    const location = structuredClone(h.stage.session.location);
    touch(h, 0, 1000, [point(1, grabberY(h))]);
    touch(h, 1, 3000, [point(1, grabberY(h))], []);
    assert.deepEqual(visual(h), before, 'stable long hold cannot initiate a form change');
    assert.deepEqual(h.stage.session.location, location);
    assert.equal(h.stage.session.transition, undefined);
    assert.equal(h.callbacks.length, 0, 'stable long hold cannot create an unnecessary clock');
  }
  for (const finalDelta of [0, -80]) {
    const h = touchHarness(Stage, home);
    const y = grabberY(h);
    touch(h, 0, 1000, [point(1, y)]);
    touch(h, 1, 1040, [point(1, y + finalDelta)], []);
    assert.equal(h.stage.session.transition, undefined, 'Home click/up-fling does not expand');
    assert.equal(h.stage.session.location.level, 'home');
    near(visual(h).expansionProgress, 0, 'Home has no Full composition');
  }
}

function checkHiddenHoldResizeReverse(Stage) {
  const h = touchHarness(Stage, sessionPolicy.expandReaderControlSession(bookmarks(), 0));
  const y = grabberY(h);
  touch(h, 0, 1000, [point(1, y)]);
  touch(h, 2, 1100, [point(1, y + 18)]);
  near(visual(h).visibilityProgress, 0, 'finger can reach the fully hidden geometry');
  near(visual(h).expansionProgress, 1, 'Full direct close freezes Full composition');
  assert.equal(h.stage.session.closeRevision, 0, 'held hidden endpoint must not commit close');
  assert.equal(sessionPolicy.readerControlContentLocation(h.stage.session).directoryTab, 'bookmarks');

  const oldY = grabberY(h);
  h.stage.availableWidth = 420;
  h.stage.fullHeight = 900;
  h.stage.admitLayout(400);
  near(grabberY(h), oldY, 'resize preserves held hidden screen anchor through shared compensation');
  assert.equal(h.stage.session.heldPointerId, 1);
  assert.equal(h.stage.session.closeRevision, 0);
  const unchanged = structuredClone({ session: h.stage.session, compensation: h.stage.layoutCompensation });
  h.stage.admitLayout(400);
  assert.deepEqual({ session: h.stage.session, compensation: h.stage.layoutCompensation }, unchanged,
    'duplicate layout cannot manufacture progress or restart compensation');
  touch(h, 2, 1200, [point(1, y + 12)]);
  near(grabberY(h), oldY - 6, 'same held touch reverses back from hidden after resize');
  assert.ok(visual(h).visibilityProgress > 0);
  near(visual(h).expansionProgress, 1, 'reverse does not flash a Quick composition');
  touch(h, 1, 1300, [point(1, y + 12)], []);
  assert.equal(sessionPolicy.readerControlTargetLocation(h.stage.session).form, 'full');
  assert.equal(sessionPolicy.readerControlTargetLocation(h.stage.session).directoryTab, 'bookmarks');
  assert.equal(h.stage.session.closeRevision, 0);
}

function checkTouchBackAndDismissTakeover(Stage) {
  const h = touchHarness(Stage, bookmarks());
  const y = grabberY(h);
  touch(h, 0, 1000, [point(7, y)]);
  touch(h, 2, 1020, [point(7, y - 90)]);
  const before = visual(h);
  h.stage.session = sessionPolicy.backReaderControlSession(h.stage.session, 1150).state;
  assert.deepEqual(visual(h), before, 'Back takeover preserves current picture');
  assert.equal(h.stage.pointerState.pointerId, -1, 'Watch discards revoked gesture');
  const backed = h.stage.session;
  for (const type of [2, 1, 3]) touch(h, type, 1050, [point(7, y - 200)], []);
  assert.strictEqual(h.stage.session, backed, 'late MOVE/UP/CANCEL cannot overwrite Back');
  assert.equal(sessionPolicy.readerControlTargetLocation(h.stage.session).form, 'quick');

  h.stage.session = sessionPolicy.dismissReaderControlSession(h.stage.session, 360);
  const closingExpansion = visual(h).expansionProgress;
  for (let count = 0; count < 8 && h.callbacks.length && h.stage.frameEpoch !== h.stage.session.epoch; count += 1) {
    h.frame(2000);
  }
  assert.equal(h.stage.frameEpoch, h.stage.session.epoch, 'new close epoch acquires a bounded frame queue');
  h.frame(2090);
  near(visual(h).expansionProgress, closingExpansion, 'close timer freezes the captured intermediate morph');
  assert.ok(visual(h).visibilityProgress < 1);
  const duringClose = visual(h);
  const secondBack = sessionPolicy.backReaderControlSession(h.stage.session, 360);
  assert.equal(secondBack.consumed, true, 'Back in close is consumed, not reader exit');
  h.stage.session = secondBack.state;
  assert.deepEqual(visual(h), duringClose, 'second Back takes over without an endpoint jump');
  assert.equal(sessionPolicy.readerControlTargetLocation(h.stage.session).level, 'hidden');
}

const Stage = loadStage();
assert.match(stageSource, /@Prop @Watch\('onSemanticSessionChanged'\) semanticSession:/);
assert.match(stageSource, /@State private visualSession:/);
assert.doesNotMatch(stageSource, /@Link[^\n]*session/,
  'the Stage must not own a writable session link to the Panel/Host');
assert.match(stageSource, /lastSemanticSession/,
  'semantic prop delivery is deduplicated while the local visual clock runs');
checkPauseAndResume(Stage);
checkStaleCallbackOwnership(Stage);
checkInitialDisableAndCommands(Stage);
checkRepeatedSemanticDoesNotResetVisual(Stage);
checkHeldPointerRevocation(Stage);
checkCompensationPause(Stage);
checkDockGeometry(Stage);
checkGeometryLifecycle(Stage);
checkTouchOwnerAndFinalUp(Stage);
checkTouchHoldResumeAndRegrab(Stage);
checkStableTouchHoldAndHome(Stage);
checkHiddenHoldResizeReverse(Stage);
checkTouchBackAndDismissTakeover(Stage);
checkOwnerPropagationBoundary(Stage);

// Teardown can race ArkUI Watch/Area/touch delivery.  Every mutating adapter
// entry must reject that stale lifecycle before it reaches @Link/@State or
// the semantic endpoint callback.
for (const method of ['onSemanticSessionChanged', 'admitLayout', 'acceptTouch', 'cancelTouch', 'touch']) {
  const start = stageSource.indexOf(`  private ${method}`);
  const next = stageSource.indexOf('\n  private ', start + 1);
  const end = next >= 0 ? next : stageSource.indexOf('\n  @Builder', start);
  assert.ok(start >= 0 && end > start, `${method} source boundary exists`);
  assert.match(stageSource.slice(start, end), /if \(!this\.mounted\) return;/,
    `${method} ignores callbacks after stage teardown`);
}

// Geometry-only compensation frames no longer assign the host session directly:
// the production Stage funnels the local write through setVisualSession, while
// the explicit geometry callback still runs after that write.  Keep this as a
// source-level contract because the fake @Link setter below would otherwise
// invoke onSemanticSessionChanged and mask a missing explicit notification.
function checkExplicitGeometryNotification(source) {
  const start = source.indexOf('  private scheduleFrame(): void {');
  const end = source.indexOf('\n  private eventTime(', start);
  assert.ok(start >= 0 && end > start, 'scheduleFrame source boundary exists');
  const body = source.slice(start, end);
  assert.match(body,
    /this\.setVisualSession\(next,[\s\S]*?\);[\s\S]*?this\.reportDockGeometry\(\);/,
    'each local frame explicitly reports geometry after visual-session publication');
}
checkExplicitGeometryNotification(stageSource);

// Debug observations execute the production sampler but must never advance or
// replace the session/gesture/compensation or expose reading/search content.
{
  const logs = [];
  let now = 1000;
  const TracedStage = loadStage(stageSource, { console: { info: value => logs.push(value) }, Date: { now: () => now } });
  const h = touchHarness(TracedStage, bookmarks());
  h.stage.traceFrame('disabled');
  assert.equal(logs.length, 0);
  h.stage.traceMotion = true;
  const before = { session: h.stage.session, pointer: h.stage.pointerState, layout: h.stage.layoutCompensation };
  const event = { type: 0, timestamp: 123000000, changedTouches: [point(7, 415)] };
  h.stage.traceFrame('touch', event);
  const observed = JSON.parse(logs[0].replace('ReaderControlMotionProbe ', ''));
  assert.equal(observed.eventType, 0); assert.equal(observed.eventTime, 123000000);
  assert.deepEqual(observed.changedIds, [7]); assert.deepEqual(observed.changedY, [415]);
  assert.equal(observed.p, 0); assert.equal(observed.v, 1); assert.equal(observed.tab, 'bookmarks');
  for (const [key, value] of Object.entries(before)) {
    assert.strictEqual(key === 'session' ? h.stage.session : key === 'pointer' ? h.stage.pointerState : h.stage.layoutCompensation, value);
  }
  assert.doesNotMatch(logs[0], /chapterTitle|query|excerpt|bookTitle|textContent/);
  h.stage.traceFrame('frame'); assert.equal(logs.length, 1, 'routine observations throttled');
  h.stage.traceFrame('touch', { ...event, type: 3, changedTouches: [] });
  assert.equal(logs.length, 2, 'same-time CANCEL observation never dropped');
  now += 40; h.stage.traceFrame('frame'); assert.equal(logs.length, 3);
  h.stage.mounted = false; h.stage.traceFrame('touch', event); assert.equal(logs.length, 3);
}

// Prove these behavior assertions reject representative production regressions.
assert.throws(() => checkInitialDisableAndCommands(loadStage(stageSource.replace(
  '!this.mounted || !this.inputEnabled || this.pendingFrame', '!this.mounted || this.pendingFrame'))),
  'missing disabled scheduler gate is detected');
assert.throws(() => checkPauseAndResume(loadStage(stageSource.replace(
  /this\.pendingFrame = false;\n    this\.lastFrameTime = -1;\n    if \(!this\.inputEnabled\)/,
  'this.pendingFrame = false;\n    if (!this.inputEnabled)'))), 'resume timestamp reuse is detected');
assert.throws(() => checkStaleCallbackOwnership(loadStage(stageSource.replace(
  'if (lifecycle !== this.lifecycleRevision) return;\n      this.pendingFrame = false;',
  'this.pendingFrame = false;\n      if (lifecycle !== this.lifecycleRevision) return;'))),
  'stale callback stealing new pending state is detected');
assert.throws(() => checkDockGeometry(loadStage(stageSource.replace(
  'this.axisScreenTop() + frame.shell.y + frame.dock.translateY', 'this.axisScreenTop() + frame.shell.y'))),
  'omitting parent visibility translation from backdrop exclusion is detected');
assert.throws(() => checkDockGeometry(loadStage(stageSource.replace(
  'frame.shell.y += offset;', 'frame.shell.y += 0;'))),
  'omitting layout compensation from backdrop exclusion is detected');
assert.throws(() => checkExplicitGeometryNotification(stageSource.replace(
  /this\.setVisualSession\(next, previous\.transition !== undefined && next\.transition === undefined\);\n\s*\/\/ Layout compensation can move without changing the session object,[\s\S]*?this\.reportDockGeometry\(\);/,
  'this.setVisualSession(next, previous.transition !== undefined && next.transition === undefined);\n      // Layout compensation can move without changing the session object,')),
  'missing geometry-only frame notification is detected');
assert.throws(() => checkGeometryLifecycle(loadStage(stageSource.replace(
  'this.pointerState = createReaderControlGestureState(this.gestureConfig());\n    this.reportDockGeometry();',
  'this.pointerState = createReaderControlGestureState(this.gestureConfig());'))),
  'missing unmount geometry invalidation is detected');
assert.throws(() => checkTouchOwnerAndFinalUp(loadStage(stageSource.replace(
  'if (pointer.id !== this.pointerState.pointerId) continue;',
  'if (false) continue;'))), 'wrong changedTouches pointer ownership is detected');
assert.throws(() => checkTouchOwnerAndFinalUp(loadStage(stageSource.replace(
  'if (pointer.windowY !== this.pointerState.lastPointerScreenY) {', 'if (false) {'))),
  'dropping the final UP displacement is detected');
const secondaryDownStop = 'if (this.pointerState.pointerId >= 0) { event.stopPropagation(); return; }';
assert.ok(stageSource.includes(secondaryDownStop), 'secondary DOWN propagation boundary exists');
assert.throws(() => checkTouchOwnerAndFinalUp(loadStage(stageSource.replace(
  secondaryDownStop, 'if (this.pointerState.pointerId >= 0) { return; }'))),
  'secondary DOWN propagation must remain owned');
const secondaryDeltaStop = `    // A secondary pointer's delta set may not contain our owner. While the
    // primary pointer is held, consume that event at the grabber so it cannot
    // bubble to an ancestor recognizer; no-owner events remain untouched.
    if (this.pointerState.pointerId >= 0) event.stopPropagation();`;
assert.ok(stageSource.includes(secondaryDeltaStop), 'secondary delta propagation boundary exists');
assert.throws(() => checkTouchOwnerAndFinalUp(loadStage(stageSource.replace(
  secondaryDeltaStop, `${secondaryDeltaStop.replace(
    'if (this.pointerState.pointerId >= 0) event.stopPropagation();', 'if (false) event.stopPropagation();')}`))),
  'secondary MOVE/UP propagation must remain owned');
const cancelHandler = `if (event.type === TouchType.Cancel) {
      // Once the grabber owns a pointer, cancellation belongs to this gesture
      // surface; do not let an ancestor recognizer observe the same
      // cancellation. With no owner, preserve normal background propagation.
      if (this.pointerState.pointerId >= 0) event.stopPropagation();
      this.cancelTouch(); return;
    }`;
assert.ok(stageSource.includes(cancelHandler), 'cancel handler mutation boundary exists');
assert.throws(() => checkOwnerPropagationBoundary(loadStage(stageSource.replace(
  cancelHandler,
  cancelHandler.replace('if (this.pointerState.pointerId >= 0) event.stopPropagation();',
    'if (false) event.stopPropagation();')))),
  'owned CANCEL propagation must remain isolated');
assert.throws(() => checkTouchHoldResumeAndRegrab(loadStage(stageSource.replace(
  cancelHandler,
  `if (event.type === TouchType.Cancel) {
      if (this.pointerState.pointerId >= 0) event.stopPropagation();
      return;
    }`))),
  'empty native CANCEL must not strand the pointer owner');

console.log('reader control Stage lifecycle: production adapter methods passed (mock frame queue; not native/touch/visual acceptance)');

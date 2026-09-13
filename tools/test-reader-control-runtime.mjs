import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as sessionPolicy from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import { ReaderControlRuntime } from '../entry/src/main/ets/features/reading/ReaderControlRuntime.ts';
import { ReaderPageInputClock } from '../entry/src/main/ets/features/reading/ReaderPageInputClock.ts';
import { createReaderControlSessionState, openReaderControlSession, enterReaderControlModule,
  expandReaderControlSession, dismissReaderControlSession, sampleReaderControlSession,
  backReaderControlSession, setReaderControlDirectoryTab }
  from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';

const config = { axis: { quickGrabberScreenY: 415, fullGrabberScreenY: 9, hiddenGrabberScreenY: 433 },
  settleDurationMs: 100, showDurationMs: 100, dismissDurationMs: 100,
  tapMaxDurationMs: 500, directionSlopVp: 8 };
const linear = x => x;
const home = openReaderControlSession(createReaderControlSessionState(), 0);
const modules = ['directory', 'search', 'settings', 'appearance', 'tts', 'autoPage', 'replace'];
for (const module of modules) {
  const runtime = new ReaderControlRuntime(config);
  let state = enterReaderControlModule(home, module, 0);
  runtime.start(state);
  const command = expandReaderControlSession(state, 100);
  runtime.command(command);
  const ticket = runtime.ticket();
  runtime.frame(0, ticket, linear);
  let frame = runtime.frame(50, ticket, linear);
  assert.equal(sampleReaderControlSession(frame.session).expansionProgress, 0.5);
  assert.equal(frame.endpoint, undefined, 'visual samples cannot commit to reading/business state');
  frame = runtime.command(command);
  assert.equal(sampleReaderControlSession(frame.session).expansionProgress, 0.5,
    'an unchanged host command must not reset the local clock');
  const held = runtime.down(7, 212, 60);
  assert.deepEqual(sampleReaderControlSession(held.session), sampleReaderControlSession(frame.session));
  assert.equal(runtime.frame(10000, ticket, linear), undefined, 'old frame ticket revoked on regrab');
  assert.equal(runtime.needsFrame(), false);
  assert.equal(runtime.down(8, 100, 65).session.heldPointerId, 7, 'second pointer never takes ownership');
  assert.equal(runtime.up(8, 100, 70).session.heldPointerId, 7);
  const moved = runtime.move(7, 110, 80);
  assert.ok(sampleReaderControlSession(moved.session).expansionProgress > 0.5);
  const up = runtime.up(7, 100, 90);
  assert.equal(up.session.heldPointerId, -1);
  const current = runtime.ticket();
  runtime.frame(100, current, linear);
  frame = runtime.frame(10000, current, linear);
  assert.equal(frame.session.location.form, 'full');
  assert.equal(frame.session.location.module, module);
  assert.ok(frame.endpoint, 'publish one semantic endpoint');
  assert.equal(runtime.frame(11000, current, linear), undefined, 'no duplicate endpoint');
  runtime.command(dismissReaderControlSession(frame.session, 100));
  let closeTicket = runtime.ticket();
  runtime.frame(0, closeTicket, linear);
  frame = runtime.frame(50, closeTicket, linear);
  assert.deepEqual(sampleReaderControlSession(frame.session), { expansionProgress: 1, visibilityProgress: 0.5 },
    'direct close does not restore quick controls');
  const back = backReaderControlSession(frame.session, 100).state;
  runtime.command(back);
  assert.equal(runtime.frame(60, closeTicket, linear), undefined, 'new command revokes queued close frame');
  const pausedTicket = runtime.ticket();
  runtime.setEnabled(false);
  assert.equal(runtime.frame(100000, pausedTicket, linear), undefined);
  frame = runtime.setEnabled(true);
  const before = sampleReaderControlSession(frame.session);
  frame = runtime.frame(200000, runtime.ticket(), linear);
  assert.deepEqual(sampleReaderControlSession(frame.session), before, 'background time does not advance animation');
  runtime.stop();
  assert.equal(runtime.frame(300000, runtime.ticket(), linear), undefined, 'teardown cannot publish');
}

// Home tap/upward movement has no expansion; long hold is not a click.
const runtime = new ReaderControlRuntime(config);
runtime.start(home); runtime.down(1, 415, 0);
assert.equal(runtime.up(1, 415, 50).session.location.level, 'home');
runtime.down(1, 415, 100); runtime.move(1, 300, 150);
assert.equal(sampleReaderControlSession(runtime.up(1, 300, 180).session).expansionProgress, 0);
let book = setReaderControlDirectoryTab(enterReaderControlModule(home, 'directory', 0), 'bookmarks');
runtime.command(book); runtime.down(2, 415, 500);
assert.equal(runtime.up(2, 415, 1500).session.location.form, 'quick');

// This suite executes the production runtime; these additional checks only
// enforce integration boundaries and do not pretend to execute native pixels.
const panel = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url), 'utf8');
assert.match(panel, /new ReaderControlRuntime\(this\.runtimeConfig\(\), readerMotionNowMs\)/);
assert.doesNotMatch(panel, /@State private visualSession:/);
assert.match(panel, /@State private visualExpansionProgress:/);
assert.match(panel, /@State private visualVisibilityProgress:/);
assert.match(panel, /@State private lastVisibleContentLocation:/);
assert.doesNotMatch(panel, /ReaderControlMotionStage\(\{|@BuilderParam|contentSlotActive|secondaryModuleActive/);
assert.match(panel, /runtime\.frame\(readerMotionNowMs\(\), ticket/);
assert.match(panel, /update\.endpoint !== undefined.*commitVisualSession/);
assert.match(panel, /ReaderControlDirectoryContent\(\{/);
console.log('Production control runtime: seven modules, frame revocation, regrab, close, lifecycle PASS');

// A terminal event with a reset/missing timestamp still owns the physical
// pointer. Exercise the actual Panel adapter and runtime: it must release the
// hold and settle from its current progress, never remain frozen at 20%.
let receivedAt = 0;
const TouchType = { Down: 0, Move: 1, Up: 2, Cancel: 3 };
const InputPanel = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url),
  ['handleControlTouch'], { TouchType, ReaderPageInputClock, readerMotionNowMs: () => receivedAt, DEBUG: false });
for (const terminalTimestamp of [4990e6, NaN, -1, 0]) {
  const r = new ReaderControlRuntime(config);
  r.start(enterReaderControlModule(home, 'settings', 0));
  const p = Object.assign(new InputPanel(), { runtime: r, runtimeMounted: true,
    inputEnabled: true, controlObscured: false, temporaryLayerActive: false,
    inputClock: new ReaderPageInputClock(), acceptRuntime: () => {} });
  const send = (type, id, y, timestamp, received) => {
    receivedAt = received;
    p.handleControlTouch({ type, timestamp, changedTouches: [{ id, windowY: y }],
      touches: [{ id, windowY: y }], stopPropagation() {} });
  };
  send(TouchType.Down, 7, 415, 5000e6, 10000);
  send(TouchType.Move, 7, 334, 5010e6, 10010);
  assert.equal(r.owner(), 7);
  send(TouchType.Up, 8, 334, -1, 10020);
  assert.equal(r.owner(), 7, 'another pointer cannot reset the active input clock or release it');
  send(TouchType.Up, 7, 334, terminalTimestamp, 13010);
  assert.equal(r.owner(), -1, 'reset/missing UP timestamp must release the current physical pointer');
  assert.equal(r.needsFrame(), true);
  r.frame(0, r.ticket(), linear);
  const final = r.frame(1000, r.ticket(), linear);
  assert.equal(final.session.location.form, 'full');
  assert.equal(final.session.heldPointerId, -1);
}

// Exercise the real Panel projection with the real runtime clock. A module's
// routing object must stay identical across 100 visual updates, while actor
// geometry and input admission continue to follow every runtime sample.
const Panel = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url),
  ['acceptRuntime', 'rememberVisibleContentLocation', 'contentLocation', 'frame', 'contentInputEnabled', 'controlPanelHeight', 'confirmLaunchSourceReady'], sessionPolicy);
for (const module of modules) {
  const owner = Object.assign(new Panel(), {
    runtimeMounted: true, visualSession: createReaderControlSessionState(),
    lastVisibleContentLocation: {level:'home',module:'directory',directoryTab:'directory',form:'quick'},
    inputEnabled: true, controlObscured: false,
    layout: {fullPanelWidth:390,fullPanelHeight:750,dockBottomGap:20},
    isExpanded: () => false, controlQuickHeight: () => 330, dockLeft: () => 0, dockTop: () => 0,
    rootScreenX: 0, rootScreenY: 0, onVisualSessionChange() {}, commitVisualSession() {},
    dockRect: {x:0,y:0,width:0,height:0}, backdropRegions: [],
    reportBackdropRegions() {}, scheduleRuntimeFrame() {},
    motionFrameCache: {sample: (visibility,progress) => ({visibility,progress,content:{width:286 + 52 * progress,height:190 + 476 * progress},shell:{y:0,width:390,height:750},dock:{translateY:0}})},
  });
  const runtime = new ReaderControlRuntime(config);
  runtime.start(enterReaderControlModule(home, module, 0));
  runtime.command(expandReaderControlSession(enterReaderControlModule(home,module,0),100));
  const ticket = runtime.ticket();
  let route;
  for (let t=0;t<=100;t++) {
    const update=runtime.frame(t,ticket,linear); assert.ok(update);
    owner.acceptRuntime(update);
    const expected=sampleReaderControlSession(update.session);
    assert.equal(owner.frame().progress,expected.expansionProgress);
    assert.equal(owner.frame().visibility,expected.visibilityProgress);
    assert.equal(owner.contentMotionProgress,expected.expansionProgress);
    assert.equal(owner.contentMotionWidth,owner.frame().content.width);
    assert.equal(owner.contentMotionHeight,owner.frame().content.height);
    assert.equal(owner.contentInputEnabled(),update.session.transition===undefined);
    if (route) assert.strictEqual(owner.contentLocation(),route,'progress never republishes the route');
    route=owner.contentLocation();assert.equal(route.module,module);assert.equal(route.form,'full');
  }
  owner.acceptRuntime(runtime.down(7,9,110));
  assert.equal(owner.visualHeldPointerId,7);assert.equal(owner.contentInputEnabled(),false);
  owner.acceptRuntime(runtime.up(7,9,120));
  route=owner.contentLocation();
  // Hidden content retains its last route and becomes noninteractive.
  const hidden=createReaderControlSessionState();
  owner.acceptRuntime({session:hidden,offsetY:0});
  assert.strictEqual(owner.contentLocation(),route);assert.equal(owner.contentInputEnabled(),false);
}
console.log('Production Panel scalar projection: seven modules x 101 frames retain route identity and current input state PASS');

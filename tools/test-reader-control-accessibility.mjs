import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as session from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import * as hostPolicy from '../entry/src/main/ets/features/reading/ReaderControlHostSession.ts';
import * as keyboard from '../entry/src/main/ets/features/reading/ReaderControlHostKeyboard.ts';
import * as gesture from '../entry/src/main/ets/features/reading/ReaderControlGestureDriver.ts';
import * as productTiming from '../entry/src/main/ets/features/common/ProductMotionTiming.ts';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

const read = name => readFileSync(new URL(`../entry/src/main/ets/features/reading/${name}.ets`, import.meta.url), 'utf8');
const hostSource = read('LocalReadingExperience'), stageSource = read('ReaderControlMotionStage');
const panelSource = read('ReaderControlPanel');
function method(source, name) {
  const start = source.indexOf(`  private ${name}(`);
  if (start < 0) return '';
  const end = source.indexOf('\n  }', start) + 4;
  assert.ok(end > start); return source.slice(start, end);
}
let metrics = { ready: true, keyboardInsets: { left: 0, top: 0, right: 0, bottom: 0 } };
const deps = { ...session, ...hostPolicy, ...keyboard, ...gesture, ...productTiming,
  ReaderWindowCoordinator: { metrics: () => metrics }, motionSpecGet: () => undefined };
const load = (name, methods) => new Function(...Object.keys(deps),
  `${stripTypeScriptTypes(`class ${name} { ${methods} }`)}; return ${name};`)(...Object.values(deps));
const Host = load('Host', ['hideControl', 'controlVisible', 'controlTiming', 'dismissControlTemporaryLayers',
  'controlMotionSession', 'controlMotionVisible', 'controlMotionPage', 'requestExit'
].map(name => method(hostSource, name)).join('\n'));
const Stage = load('Stage', ['setVisualSession', 'onSemanticSessionChanged', 'toggleFromAccessibility', 'closeFromAccessibility', 'accessibilityToggleLabel',
  'accessibilityToggleEnabled'].map(name => method(stageSource, name)).join('\n'));
const makeHome = () => session.openReaderControlSession(session.createReaderControlSessionState(), 0);
const makeQuick = module => session.enterReaderControlModule(makeHome(), module, 0);
const finish = state => { let next = state; for (let i = 0; i < 6 && next.transition; i++) {
  next = session.advanceReaderControlSession(next, 10000, next.epoch); } return next; };
function harness(state, reduced = false) {
  const h = new Host(); let hides = 0, exits = 0, invalidations = 0;
  let semanticSession = state;
  Object.assign(h, { latestControlVisualSession: session.copyReaderControlSessionState(state), reduceMotion: reduced, controlTemporaryLayer: false,
    dismissControlTemporaryRevision: 0, invalidateControlBackdrop: () => invalidations++,
    controlKeyboardHost: () => ({ hideTextInput: async () => { hides++; }, onFailure() {} }),
    isControlInputEnabled: () => true, beginExit: () => exits++ });
  Object.defineProperty(h, 'controlSession', { configurable: true,
    get: () => semanticSession,
    set: value => {
      semanticSession = value;
      h.latestControlVisualSession = session.copyReaderControlSessionState(value);
    } });
  const s = new Stage();
  Object.assign(s, { mounted: true, inputEnabled: true, temporaryLayerActive: false,
    visualSession: session.copyReaderControlSessionState(state),
    semanticSession: session.copyReaderControlSessionState(state),
    onVisualSessionChange: () => {}, onSessionCommit: () => {},
    onDismiss: () => h.hideControl(), gestureConfig: () => ({ axis: {
      quickGrabberScreenY: 415, fullGrabberScreenY: 9, hiddenGrabberScreenY: 433 },
      settleDurationMs: reduced ? 0 : 1150, dismissDurationMs: reduced ? 0 : 360,
      showDurationMs: reduced ? 0 : 420 }) });
  Object.defineProperty(s, 'session', { get: () => s.visualSession, set: v => {
    s.semanticSession = v;
    s.onSemanticSessionChanged();
  } });
  return { h, s, hides: () => hides, exits: () => exits, invalidations: () => invalidations };
}

// Before P-04, the real handle exposed only this accessibility CLICK->toggle.
// Execute that existing public action in RED, not an imagined close command.
const invokeClose = s => {
  if (s.closeFromAccessibility) return s.closeFromAccessibility();
  const callback = stageSource.match(/\.onAccessibilityActionIntercept\((\(action:[\s\S]*?)\n        \}\)/)?.[1];
  assert.ok(callback, 'existing accessibility action must be found');
  const fn = new Function('AccessibilityAction', 'AccessibilityActionInterceptResult',
    `return ${stripTypeScriptTypes(callback + '\n        }')};`)(
    { ACCESSIBILITY_CLICK: 1 }, { ACTION_INTERCEPT: 0, ACTION_CONTINUE: 1 });
  fn.call(s, 1);
};
for (const reduced of [false, true]) {
  for (const state of [makeHome(), ...['directory', 'tts', 'appearance', 'settings', 'search', 'autoPage', 'replace']
    .flatMap(module => { const q = makeQuick(module); return [q, session.expandReaderControlSession(q, 0)]; })]) {
    const x = harness(state, reduced);
    x.h.controlTemporaryLayer = true; x.s.temporaryLayerActive = true;
    // The production close path now asks the IME to hide only when the
    // current window snapshot proves that a keyboard surface is visible.
    // Exercise that owned case explicitly; ordinary directory closes with a
    // zero inset must not issue a detached-controller request.
    metrics = { ready: true, keyboardInsets: { left: 0, top: 0, right: 0, bottom: 280 } };
    invokeClose(x.s);
    assert.equal(session.readerControlTargetLocation(x.h.controlSession).level, 'hidden',
      'explicit non-touch close must dismiss Home/Quick/Full directly, never toggle/collapse');
    assert.equal(x.h.controlTemporaryLayer, false, 'complete close clears temporary layers');
    assert.equal(x.h.dismissControlTemporaryRevision, 1);
    assert.equal(x.hides(), 1, 'complete close also requests IME hide');
    assert.equal(x.exits(), 0, 'close returns to reading, not outside the book');
    if (!reduced) assert.equal(session.sampleReaderControlSession(x.h.controlSession).expansionProgress,
      session.sampleReaderControlSession(state).expansionProgress, 'dismiss freezes current shape');
    x.h.controlSession = finish(x.h.controlSession);
    metrics = { ready: true, keyboardInsets: { left: 0, top: 0, right: 0, bottom: 0 } };
    assert.equal(x.h.controlSession.closeRevision, 1);
    x.s.closeFromAccessibility(); assert.equal(x.hides(), 1, 'hidden stale action is ignored');
  }
}

assert.match(stageSource, /\.accessibilityVirtualNode\(this\.accessibleControlActions\)/);
assert.match(stageSource, /\.accessibilityLevel\('no'\)\s*\.accessibilityVirtualNode/,
  'the touch-only grabber parent is not exposed as a dead standalone accessibility button');
assert.doesNotMatch(stageSource, /\.onAccessibilityActionIntercept\(/,
  'old parent click interceptor must not swallow virtual child close actions');
assert.match(panelSource, /\.onClick\(\(\): void => this\.onDismiss\(\)\)/);
assert.match(panelSource, /\.accessibilityText\('退出阅读，返回上一页'\)\s*\.onClick\(\(\): void => this\.onExitReading\(\)\)/);
const exitBinding = hostSource.match(/onExitReading: \(\): void => (this\.\w+\(\)),/);
assert.ok(exitBinding, 'the top arrow has an explicit reading-exit binding');
const clickTopBack = new Function(`return function () { ${exitBinding[1]}; };`)();
for (const state of [makeHome(), makeQuick('directory'), session.expandReaderControlSession(makeQuick('search'), 0)]) {
  const x = harness(state);
  const original = x.h.controlSession;
  clickTopBack.call(x.h);
  assert.equal(x.exits(), 1, 'top arrow enters durable reading exit immediately');
  assert.strictEqual(x.h.controlSession, original, 'top arrow does not navigate/collapse control layers');
}
assert.match(hostSource, /onExitRequestHandler\(\(\): void => this\.requestExit\(\)\)/,
  'system Back retains its separate layered command');
assert.match(panelSource, /@Prop temporaryLayerActive: boolean = false/);
assert.match(panelSource, /this\.contentInputEnabled\(\) && !this\.temporaryLayerActive/,
  'the production render owner gates accessibility actions while a temporary layer is active');
assert.doesNotMatch(panelSource, /temporaryLayerActive: this\.controlTemporaryLayer/,
  'Panel must not reference a removed Host-only temporary-layer field');
assert.match(hostSource, /temporaryLayerActive: this\.controlTemporaryLayer/,
  'Host forwards its own temporary-layer state into Panel');

// Real SDK observer closures: virtual nodes mount once and use live state,
// without adding a visible paint tree. Platform screen-reader focus is separate.
for (const initial of [makeHome(), makeQuick('directory')]) {
  const x = harness(initial);
  const stageComponentSource = stageSource.slice(stageSource.indexOf('@Component\nexport struct ReaderControlMotionStage'));
  const probe = createReaderBuilderProbe(stageComponentSource,
    ['setVisualSession', 'onSemanticSessionChanged', 'rememberVisibleContentModule', 'accessibleControlActions', 'accessibilityToggleLabel', 'accessibilityToggleEnabled',
      'toggleFromAccessibility', 'closeFromAccessibility'], { ...deps,
      AccessibilityRoleType: { BUTTON: 'button' } });
  const owner = probe.owner;
  Object.assign(owner, { mounted: true, inputEnabled: true, temporaryLayerActive: false,
    onVisualSessionChange: () => {}, onSessionCommit: () => {},
    onDismiss: () => x.h.hideControl(), gestureConfig: x.s.gestureConfig });
  Object.assign(owner, { visualSession: session.copyReaderControlSessionState(initial),
    semanticSession: session.copyReaderControlSessionState(initial) });
  Object.defineProperty(owner, 'session', { get: () => owner.visualSession, set: v => {
    owner.semanticSession = v;
    owner.onSemanticSessionChanged();
  } });
  owner.accessibleControlActions();
  const close = [...owner.nodes.values()].find(n => n.create === '关闭控制栏并返回阅读');
  assert.ok(close); assert.equal(close.accessibilityRole, 'button');
  if (initial.location.level === 'home') {
    assert.equal([...owner.nodes.values()].filter(n => /展开|收回/.test(n.accessibilityText ?? '')).length, 0,
      'Home exposes close, never expansion');
  } else {
    const toggle = [...owner.nodes.values()].find(n => n.create === '展开完整控制栏');
    assert.ok(toggle); assert.equal(toggle.enabled, true);
    toggle.onClick(); x.h.controlSession = finish(x.h.controlSession); owner.replay();
    assert.equal([...owner.nodes.values()].some(n => n.create === '收回快捷控制栏'), true);
    owner.temporaryLayerActive = true; owner.replay();
    assert.equal(toggle.enabled, false, 'temporary layer blocks shape changes, not explicit full close');
    const before = x.h.controlSession; toggle.onClick(); assert.strictEqual(x.h.controlSession, before);
  }
  close.onClick(); assert.equal(session.readerControlTargetLocation(x.h.controlSession).level, 'hidden');
  owner.inputEnabled = false; owner.replay(); assert.equal(close.enabled, false);
  const before = x.h.controlSession; close.onClick(); assert.strictEqual(x.h.controlSession, before);
}

// System Back still dismisses keyboard/temporary layers and navigates control
// levels. It is a different action from the top arrow's explicit reading exit.
for (const reduced of [false, true]) {
  const x = harness(session.expandReaderControlSession(makeQuick('directory'), 0), reduced);
  metrics.keyboardInsets.bottom = 300;
  const original = x.h.controlSession; x.h.requestExit(); assert.strictEqual(x.h.controlSession, original);
  metrics.keyboardInsets.bottom = 0; x.h.controlTemporaryLayer = true;
  x.h.requestExit(); assert.strictEqual(x.h.controlSession, original);
  assert.equal(x.h.controlTemporaryLayer, false);
  x.h.requestExit();
  assert.equal(session.readerControlTargetLocation(x.h.controlSession).level, 'secondary');
  assert.equal(session.readerControlTargetLocation(x.h.controlSession).form, 'quick');
  x.h.requestExit();
  assert.equal(session.readerControlTargetLocation(x.h.controlSession).level, 'home');
  x.h.requestExit();
  assert.equal(session.readerControlTargetLocation(x.h.controlSession).level, 'hidden');
  if (!reduced) {
    x.h.requestExit(); assert.equal(x.exits(), 0, 'repeated Back while closing is consumed');
  }
  x.h.controlSession = finish(x.h.controlSession);
  x.h.requestExit();
  assert.equal(x.exits(), 1, 'system Back exits only after the control is closed');
}
console.log('Control accessibility: actual Host close/Back + SDK virtual-node mounted observers PASS; NOT native screen-reader acceptance');

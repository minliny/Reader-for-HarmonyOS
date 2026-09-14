import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as motion from '../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts';
import * as session from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import * as metrics from '../entry/src/main/ets/features/reading/ReaderControlGeometry.ts';
import { ReaderControlRuntime } from '../entry/src/main/ets/features/reading/ReaderControlRuntime.ts';
import { ReaderPageInputClock } from '../entry/src/main/ets/features/reading/ReaderPageInputClock.ts';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const hostPolicy = await import('../entry/src/main/ets/features/reading/ReaderControlHostSession.ts');
const Host = productionMotionMethods(
  new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['isControlInputEnabled'], hostPolicy);

const file = new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const require = createRequire(import.meta.url);
const sdk = '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`), syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const children = ['topBar', 'controlContent', 'controlHeader', 'brightnessRail', 'moduleNavBar', 'readerMoreMenu', 'launchSourceContent'];
const TouchType = { Down: 0, Move: 1, Up: 2, Cancel: 3 };
let receivedAt = 0;
const names = ['handleControlTouch', 'acceptRuntime', 'rememberVisibleContentLocation', 'contentLocation',
  'commitVisualSession', 'confirmLaunchSourceReady'];
const Panel = productionMotionMethods(file, names, { ...session, TouchType, ReaderPageInputClock,
  readerMotionNowMs: () => receivedAt, DEBUG: false });
function mount(text, module = 'settings', full = false, width = 364, height = 736, quick = 330) {
  // Only unrelated business children are replaced; the production root Builder,
  // grabber, painted bar, parents and enabled/hit-test expressions stay intact.
  const tree = ts.createSourceFile('Panel.ets', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS);
  const type = tree.statements.find(n => n.members?.some(m => m.name?.getText(tree) === 'build'));
  for (const n of type.members.filter(n => children.includes(n.name?.getText(tree))).sort((a, b) => b.pos - a.pos)) {
    text = text.slice(0, n.body.pos) + ' { Column() {} }' + text.slice(n.body.end);
  }
  syntax.componentCollection.customComponents.add('ReaderSessionLaunchStage');
  // Each probe is a fresh component compile; do not retain the SDK's global
  // id registry from an earlier source mutation at a different line/column.
  require(`${sdk}/lib/component_map.js`).ID_ATTRS.clear();
  const { owner } = createReaderBuilderProbe(text, ['build', ...children], {
    ...motion, AccessibilityRoleType: { BUTTON: 'button' },
  });
  for (const name of names) owner[name] = Panel.prototype[name];
  const home = session.openReaderControlSession(session.createReaderControlSessionState(), 0);
  const entered = session.enterReaderControlModule(home, module, 0);
  const current = full ? session.expandReaderControlSession(entered, 0) : entered;
  const bounds = motion.readerControlMotionBounds(width, height, 19, quick), top = 89;
  const config = { axis: motion.readerControlMotionAxis(bounds, top), tapMaxDurationMs: 500,
    directionSlopVp: 8, settleDurationMs: 100, showDurationMs: 100, dismissDurationMs: 100 };
  const runtime = new ReaderControlRuntime(config);
  Object.assign(owner, { runtime, runtimeMounted: true, inputEnabled: true, controlObscured: false,
    temporaryLayerActive: false, appScheme: 'day', launchSample: undefined, moreMenuVisible: false,
    visualHeldPointerId: -1, visualExpansionProgress: full ? 1 : 0, visualVisibilityProgress: 1,
    lastVisibleContentLocation: current.location, controlSession: current, visualSession: current,
    layout: { viewportWidth: width + 26, viewportHeight: height + 108, fullPanelWidth: width,
      topBarWidth: width, topBarTop: 19 }, rootScreenX: 0, rootScreenY: 0,
    dockRect: {}, backdropRegions: [], onVisualSessionChange() {}, reportBackdropRegions() {},
    scheduleRuntimeFrame() {}, contentInputEnabled: () => true, controlPanelHeight: () => height,
    dockTop: () => top, dockLeft: () => 13,
    frame() { return motion.sampleReaderControlMotionComposition({ expansionProgress: this.visualExpansionProgress,
      visibilityProgress: this.visualVisibilityProgress }, bounds); },
    accessibleControlActions() {},
  });
  owner.acceptRuntime(runtime.start(current)); owner.initialRender();
  const node = id => [...owner.nodes.values()].find(n => n.id === id);
  const send = (type, y, id = 7, ms = 10) => {
    receivedAt += ms;
    // This is the *production SDK-emitted* ancestor gate, not a fake runtime
    // admission flag. Disabled parents do not forward touch events to children.
    if (node('reader-control-motion-dock').enabled) node('reader-control-motion-grabber').onTouch({
      type, timestamp: receivedAt * 1e6, changedTouches: [{ id, windowY: y }], touches: [{ id, windowY: y }],
      stopPropagation() {},
    });
    owner.replay();
  };
  return { owner, runtime, config, send, node };
}

function assertPaintedActor(text) {
  const f = mount(text);
  for (const p of [0, .1, .5, 1, .6, 0]) {
    f.owner.visualExpansionProgress = p; f.owner.replay();
    const frame = f.owner.frame(), hit = f.node('reader-control-motion-grabber'), bar = f.node('reader-control-motion-grabber-bar');
    assert.ok(bar.position, 'visible grabber consumes the authoritative actor position');
    assert.equal(hit.position.y + bar.position.y, frame.grabber.y);
    assert.equal(hit.position.x + bar.position.x, frame.grabber.x);
    assert.equal(bar.position.y, 9, 'retains the authored 8.99/9vp inset rather than inventing a new height');
    assert.equal(bar.width, 42); assert.equal(bar.height, 4); assert.equal(hit.height, 28);
    assert.equal(hit.width, 72); assert.equal(hit.zIndex, 3);
  }
}
assertPaintedActor(source);
const implicit = source.replace(/\.position\(\{ x: this\.frame\(\)\.grabber\.x - \(this\.layout\.fullPanelWidth - 72\) \/ 2,\s*y: this\.frame\(\)\.grabber\.y - this\.frame\(\)\.shell\.y \}\)/, '.margin({ top: 9 })');
assert.notEqual(implicit, source);
assert.throws(() => assertPaintedActor(implicit), /visible grabber consumes/);

function checkHeldAtHidden(text, module, full) {
  const f = mount(text, module, full), y = full ? f.config.axis.fullGrabberScreenY : f.config.axis.quickGrabberScreenY;
  f.send(TouchType.Down, y); f.send(TouchType.Move, y + 22);
  assert.equal(f.runtime.owner(), 7); assert.equal(f.owner.frame().visibility, 0);
  assert.equal(f.node('reader-control-motion-dock').enabled, true,
    'a held pointer at hidden must keep its native ancestor enabled until UP/CANCEL');
  const host = Object.assign(new Host(), { mounted: true, exitRequested: false,
    appForeground: true, windowChromeActive: true, interactionBlocked: false, controlObscured: false,
    controlSession: f.owner.visualSession });
  assert.equal(host.isControlInputEnabled(), true, 'real LRE admission does not revoke a held invisible frame');
  assert.equal(hostPolicy.readerControlHostVisible(host.controlSession), true,
    'a held invisible sample is still the same visible logical control session');
  host.controlObscured = true; assert.equal(host.isControlInputEnabled(), false,
    'preserve real route/window/overlay ownership; holding is not a global admission bypass');
  // It remains the same pointer after it moves outside the small hit target.
  f.send(TouchType.Move, y + 12); assert.ok(f.owner.frame().visibility > 0);
  f.send(TouchType.Move, y + 25); f.send(TouchType.Up, y + 25);
  assert.equal(f.runtime.owner(), -1); assert.equal(f.owner.controlSession.location.level, 'hidden',
    JSON.stringify({module,full,visual:f.owner.visualSession,host:f.owner.controlSession}));
  assert.equal(f.node('reader-control-motion-dock').enabled, false, 'released hidden descendants become inert');
}
for (const module of ['directory', 'search', 'settings', 'appearance', 'tts', 'autoPage', 'replace']) {
  checkHeldAtHidden(source, module, false); checkHeldAtHidden(source, module, true);
  for (const full of [false, true]) {
    for (const terminal of [TouchType.Up, TouchType.Cancel]) {
      const f = mount(source, module, full), y = full ? f.config.axis.fullGrabberScreenY : f.config.axis.quickGrabberScreenY;
      f.send(TouchType.Down, y); f.send(TouchType.Move, y + 25);
      f.send(TouchType.Move, y + 25, 7, 2000);
      assert.equal(f.runtime.owner(), 7, 'two-second stationary hold cannot settle or lose the pointer');
      assert.equal(f.owner.frame().visibility, 0); assert.equal(f.owner.controlSession.closeRevision, 0);
      assert.equal(f.node('reader-control-motion-dock').enabled, true);
      f.send(terminal, y + 25, 7, 1000);
      assert.equal(f.runtime.owner(), -1, 'terminal still arrives after the long hidden hold');
      const ticket = f.runtime.ticket();
      for (const time of [0, 10000]) {
        const update = f.runtime.frame(time, ticket, p => p); if (update) f.owner.acceptRuntime(update);
      }
      assert.equal(f.owner.controlSession.location.level, terminal === TouchType.Up ? 'hidden' : 'secondary');
      assert.equal(f.owner.controlSession.closeRevision, terminal === TouchType.Up ? 1 : 0);
      if (terminal === TouchType.Cancel) assert.equal(f.owner.controlSession.location.form, full ? 'full' : 'quick');
    }
  }
}
const oldGate = source.replaceAll('(this.frame().visibility > 0 || this.visualHeldPointerId >= 0)', 'this.frame().visibility > 0');
assert.notEqual(oldGate, source);
assert.throws(() => checkHeldAtHidden(oldGate, 'settings', true), /held pointer at hidden/,
  'reintroducing the installed parent gate reproduces the lost terminal delivery');

// The spatial sampler already covers these visibility values, but crossing
// the *driver* boundary is a distinct policy: a partial source must be reached
// exactly before the same MOVE's residue can continue into expansion.
for (const visibility of [.2, .7, 1]) {
  const f = mount(source), quick = f.owner.controlSession;
  const closing = session.dismissReaderControlSession(quick, 100);
  const partial = session.advanceReaderControlSession(closing, (1 - visibility) * 100, closing.epoch);
  const goal = session.expandReaderControlSession(quick, 0).location;
  const restoring = session.resumeReaderControlSessionTarget(partial, goal, 100);
  f.owner.acceptRuntime(f.runtime.start(restoring)); f.owner.replay();
  const captured = session.sampleReaderControlSession(restoring).visibilityProgress;
  const y = f.config.axis.quickGrabberScreenY + 18 * (1 - captured), travel = 18 * captured;
  f.send(TouchType.Down, y); f.send(TouchType.Move, y + travel / 2);
  assert.equal(f.owner.visualSession.transition.kind, 'dismiss');
  assert.equal(f.owner.visualSession.transition.from.visibilityProgress, captured);
  f.send(TouchType.Move, y + travel / 4);
  assert.equal(f.owner.visualSession.transition.kind, 'dismiss', 'undo stays on its captured MR1 path');
  assert.ok(f.owner.frame().visibility < captured);
  f.send(TouchType.Move, y - 10);
  assert.equal(f.owner.visualSession.transition.kind, 'morph', 'residue crosses only after reaching the captured source');
  assert.equal(f.owner.visualSession.transition.from.visibilityProgress, captured);
  assert.ok(f.owner.frame().progress > 0);
  f.send(TouchType.Cancel, y - 10);
  const ticket = f.runtime.ticket();
  for (const time of [0, 10000]) {
    const update = f.runtime.frame(time, ticket, p => p); if (update) f.owner.acceptRuntime(update);
  }
  assert.equal(f.owner.controlSession.location.form, 'full', 'CANCEL retains the pre-hold logical restoration goal');
  assert.equal(f.owner.controlSession.closeRevision, 0);
}

for (const terminal of ['tap', 'cancel']) {
  const f = mount(source, 'settings', true), y = f.config.axis.fullGrabberScreenY;
  f.send(TouchType.Down, y);
  if (terminal === 'cancel') { f.send(TouchType.Move, y + 25); f.send(TouchType.Cancel, y + 25); }
  else f.send(TouchType.Up, y);
  assert.equal(f.runtime.owner(), -1);
  const ticket = f.runtime.ticket();
  const first = f.runtime.frame(0, ticket, p => p); if (first) f.owner.acceptRuntime(first);
  const last = f.runtime.frame(10000, ticket, p => p); if (last) f.owner.acceptRuntime(last);
  assert.equal(f.owner.visualSession.location.form, terminal === 'tap' ? 'quick' : 'full');
  assert.equal(f.owner.visualSession.location.level, 'secondary');
}

// The actual native Slider observer owns continuous pointer previews and emits
// only committed End/Click values; a second interaction needs no module reopen.
const { owner: slider } = createReaderBuilderProbe(source,
  ['progressRow', 'effectiveProgressPercent', 'clampPercent'], metrics);
const values = [];
Object.assign(slider, { appScheme: 'day', progressPreviewPercent: -1, progressPercent: 10,
  totalChapters: 30, onProgressChange: p => values.push(p) });
slider.progressRow(); const track = [...slider.nodes.values()].find(n => n.accessibilityText === '阅读进度');
track.onChange(25, 'SliderChangeMode.Moving'); assert.deepEqual(values, []);
track.onChange(25, 'SliderChangeMode.End'); track.onChange(75, 'SliderChangeMode.End');
track.onChange(40, 'SliderChangeMode.Click');
assert.deepEqual(values, [25, 75, 40]);
console.log('PH48/49/55 PASS: authoritative grabber actor, actual Host/native-parent admission, 7 modules x Quick/Full reversal, 28 hidden-hold UP/CANCEL paths, .2/.7/1 captured-visibility driver crossings, tap, actual Slider End/Click; two negative mutations rejected. Native compositor/physical touch remains separate.');

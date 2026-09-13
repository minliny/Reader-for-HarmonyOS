import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderControlRuntime } from '../entry/src/main/ets/features/reading/ReaderControlRuntime.ts';
import * as session from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerControlHeaderFrame } from '../entry/src/main/ets/features/reading/ReaderControlHeaderGeometry.ts';
import { readerControlMotionBounds, sampleReaderControlMotionComposition }
  from '../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const { sampleReaderControlReplaceHeader } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url), 'utf8');
const shell = source.slice(source.indexOf(".id('reader-control-motion-shell')"),
  source.indexOf(".id('reader-control-full-content-surface')"));
assert.match(shell, /\.hitTestBehavior\(HitTestMode\.None\)/,
  'visual shell is inert and cannot steal pointer hits');
assert.doesNotMatch(shell, /HitTestMode\.Block/,
  'visual shell must not be a full-size blocking hit target');

assert.match(source,
  /\.id\('reader-control-collapse'\)[\s\S]*?\.hitTestBehavior\(HitTestMode\.Block\)[\s\S]*?\.onClick\(\(\): void => this\.collapseControl\(\)\)/,
  'collapse action has an explicit blocking target and production callback');

const Panel = productionMotionMethods(
  new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url),
  ['collapseControl', 'applySemanticSession'], {
    collapseReaderControlSession: session.collapseReaderControlSession,
    READER_CONTROL_EXPAND_MS: 320,
    readerControlSessionStateEquals: session.readerControlSessionStateEquals,
  });
const config = {
  axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 },
  tapMaxDurationMs: 500, directionSlopVp: 8, settleDurationMs: 320,
  showDurationMs: 220, dismissDurationMs: 200, coordinatedMotion: true,
};
const runtime = new ReaderControlRuntime(config, () => 0);
const home = session.openReaderControlSession(session.createReaderControlSessionState(), 0);
const secondary = session.enterReaderControlModule(home, 'directory', 0);
const full = session.expandReaderControlSession(secondary, 320);
runtime.start(full);
const updates = [];
const panel = Object.assign(new Panel(), {
  visualSession: full,
  controlSession: full,
  reduceMotion: false,
  runtime,
  runtimeMounted: true,
  onInputActivity() {},
  releaseHeldPointer() {},
  acceptRuntime(update) { updates.push(update); },
});
panel.collapseControl();
assert.equal(panel.controlSession.location.form, 'quick', 'collapse changes semantic form');
assert.equal(updates.length, 1, 'collapse submits one runtime command');
assert.equal(updates[0].session.transition?.toLocation.form, 'quick',
  'collapse runtime target is the quick form');
assert.equal(updates[0].session.transition?.durationMs, 320,
  'collapse keeps the coordinated morph duration');

// Compile the unchanged production Header ancestor together with its actual
// child Builders. Merely finding onClick or invoking collapseControl skipped
// this ancestor in the old test: Block prevents ALL its children from being
// hit-tested (installed SDK component/enums.d.ts, HitTestMode.Block).
const headerStart = source.indexOf('        Stack({ alignContent: Alignment.TopStart }) { this.controlHeader(); }');
const headerEnd = source.indexOf('        Stack({ alignContent: Alignment.TopStart }) { this.brightnessRail(); }', headerStart);
assert.ok(headerStart >= 0 && headerEnd > headerStart, 'one production Header ancestor');
const headerActor = source.slice(headerStart, headerEnd);
const probeSource = source.slice(0, source.lastIndexOf('}')) +
  '\n @Builder private probeHeaderActor() {\n' + headerActor + '\n }\n}';
const probeMembers = ['probeHeaderActor', 'controlHeader', 'replaceHeader', 'headerFrame', 'replaceHeaderFrame',
  'headerIcon', 'headerInter', 'contentTitle', 'contentLocation', 'collapseControl', 'applySemanticSession',
  'acceptRuntime', 'rememberVisibleContentLocation', 'commitVisualSession', 'onControlSessionChanged'];
for (const module of ['autoPage', 'tts', 'directory', 'appearance', 'settings', 'search', 'replace']) {
  for (const reduced of [false, true]) {
    const { owner } = createReaderBuilderProbe(probeSource, probeMembers, {
      ...session, readerControlHeaderFrame, sampleReaderControlReplaceHeader, READER_CONTROL_EXPAND_MS: 320,
    });
    const quick = session.enterReaderControlModule(home, module, 0);
    const settledFull = session.expandReaderControlSession(quick, 0);
    const controlRuntime = new ReaderControlRuntime({ ...config, settleDurationMs: reduced ? 0 : 320 }, () => 0);
    let semantic = settledFull, activities = 0, writes = 0;
    Object.assign(owner, {
      runtime: controlRuntime, runtimeMounted: true, reduceMotion: reduced, inputEnabled: true,
      visualSession: settledFull, visualHeldPointerId: -1, lastVisibleContentLocation: settledFull.location,
      appScheme: 'day', rootScreenX: 0, rootScreenY: 0, dockRect: {},
      onInputActivity: () => activities++, onVisualSessionChange() {}, setAppearanceFontReorderActivity() {},
      reportBackdropRegions() {}, confirmLaunchSourceReady() {}, scheduleRuntimeFrame() {},
      dockLeft: () => 0, dockTop: () => 0,
      frame: () => sampleReaderControlMotionComposition(session.sampleReaderControlSession(owner.visualSession),
        readerControlMotionBounds(364, 736, 19)),
    });
    Object.defineProperty(owner, 'controlSession', { get: () => semantic, set: value => {
      semantic = value; writes++; owner.onControlSessionChanged();
    } });
    owner.acceptRuntime(controlRuntime.start(settledFull));
    owner.probeHeaderActor();
    const ancestor = owner.nodes.get(0);
    assert.equal(ancestor.zIndex, 2, `${module}: header remains above content`);
    assert.equal(ancestor.hitTestBehavior, 'HitTestMode.Default',
      `${module}: production Header ancestor must admit its child button; Block suppresses descendants`);
    assert.equal(ancestor.enabled, true);
    const button = [...owner.nodes.values()].find(node => typeof node.onClick === 'function');
    assert.ok(button, `${module}: actual SDK emitted the collapse callback`);
    if (module !== 'replace') {
      assert.equal(button.id, 'reader-control-collapse');
      assert.equal(button.width, 40); assert.equal(button.height, 26);
      assert.equal(button.borderRadius, 8, 'Figma appearance is unchanged');
      assert.equal(button.hitTestBehavior, 'HitTestMode.Block', 'leaf owns its target without a child action');
    }
    const ids = [...owner.nodes.keys()];
    button.onClick();
    assert.equal(activities, 1, `${module}: one actual click performs one action`);
    assert.equal(session.readerControlTargetLocation(semantic).form, 'quick');
    assert.equal(semantic.location.module, module, 'collapse retains the active module');
    assert.equal(semantic.location.level, 'secondary', 'collapse does not dismiss to reading');
    assert.equal(writes, 1, 'synchronous Link watcher does not duplicate semantic commands');
    for (const time of [0, 10000]) {
      const update = controlRuntime.frame(time, controlRuntime.ticket(), p => p);
      if (update) owner.acceptRuntime(update);
    }
    assert.equal(owner.visualSession.transition, undefined, 'collapse settles');
    assert.equal(semantic.location.form, 'quick', 'settled Quick endpoint is committed to the Host');
    assert.equal(session.sampleReaderControlSession(owner.visualSession).expansionProgress, 0);
    owner.replay();
    assert.deepEqual([...owner.nodes.keys()], ids, 'same mounted Header survives full-to-quick');
    owner.inputEnabled = false; owner.replay(); assert.equal(ancestor.enabled, false);
    owner.inputEnabled = true; owner.visualHeldPointerId = 9; owner.replay(); assert.equal(ancestor.enabled, false);
  }
}
console.log('Reader control input routing: PASS (actual SDK Header ancestor/child callback, 7 modules, runtime + Link delivery; native touch remains VM evidence)');

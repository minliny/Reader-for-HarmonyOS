import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderControlRuntime } from '../entry/src/main/ets/features/reading/ReaderControlRuntime.ts';
import * as session from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url), 'utf8');
const shell = source.slice(source.indexOf(".id('reader-control-motion-shell')"),
  source.indexOf(".id('reader-control-full-content-surface')"));
assert.match(shell, /\.hitTestBehavior\(HitTestMode\.None\)/,
  'visual shell is inert and cannot steal pointer hits');
assert.doesNotMatch(shell, /HitTestMode\.Block/,
  'visual shell must not be a full-size blocking hit target');

const header = source.slice(source.indexOf('this.controlHeader();'),
  source.indexOf('this.brightnessRail();'));
assert.match(header, /\.zIndex\(2\)\s*\.hitTestBehavior\(HitTestMode\.Block\)/,
  'header controls are above content and own their hit region');
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
console.log('Reader control input routing and collapse command: PASS (structure/runtime; native touch remains device evidence)');

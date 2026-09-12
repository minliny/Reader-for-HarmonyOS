import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as layoutPolicy from '../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';
import {
  ReaderInsetsVp, ReaderRectVp, ReaderWindowMetricsSnapshot,
} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {
  readerControlMotionBounds, sampleReaderControlMotionComposition,
} from '../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts';
import {
  createReaderControlSessionState, enterReaderControlModule, holdReaderControlSession,
  openReaderControlSession,
} from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import {
  consumeReaderControlKeyboardBack, hideReaderControlKeyboard, readerControlKeyboardVisible,
} from '../entry/src/main/ets/features/reading/ReaderControlHostKeyboard.ts';

const hidden = { ready: true, keyboardInsets: { left: 0, top: 0, right: 0, bottom: 0 } };
const visible = { ready: true, keyboardInsets: { left: 0, top: 0, right: 0, bottom: 280 } };
assert.equal(readerControlKeyboardVisible(hidden), false);
assert.equal(readerControlKeyboardVisible(visible), true);
assert.equal(readerControlKeyboardVisible({ ...visible, ready: false }), false);
for (const side of ['left', 'top', 'right', 'bottom']) {
  assert.equal(readerControlKeyboardVisible({ ready: true, keyboardInsets: {
    ...hidden.keyboardInsets, [side]: 1,
  } }), true);
}
for (const value of [-1, NaN, Infinity, -Infinity]) {
  assert.equal(readerControlKeyboardVisible({ ready: true, keyboardInsets: {
    left: value, top: value, right: value, bottom: value,
  } }), false);
}

let requests = 0;
const failures = [];
const host = { hideTextInput: async () => { requests++; }, onFailure: error => failures.push(error) };
const session = Object.freeze({ page: 'fullSearch', query: 'retained', closeRevision: 7 });
assert.equal(consumeReaderControlKeyboardBack(visible, host), true);
assert.equal(requests, 1);
// Input focus can remain; the next actual zero-inset snapshot admits route Back.
assert.equal(consumeReaderControlKeyboardBack(hidden, host), false);
assert.equal(requests, 1);
assert.deepEqual(session, { page: 'fullSearch', query: 'retained', closeRevision: 7 });
hideReaderControlKeyboard(host);
assert.equal(requests, 2, 'complete close requests IME hide even without a visible-inset snapshot');

const synchronous = new Error('controller unavailable');
assert.equal(consumeReaderControlKeyboardBack(visible, {
  hideTextInput: () => { throw synchronous; }, onFailure: error => failures.push(error),
}), true);
assert.strictEqual(failures[0], synchronous);
const asynchronous = new Error('client detached');
assert.equal(consumeReaderControlKeyboardBack(visible, {
  hideTextInput: async () => { throw asynchronous; }, onFailure: error => failures.push(error),
}), true);
await Promise.resolve();
await Promise.resolve();
assert.strictEqual(failures[1], asynchronous);
assert.equal(consumeReaderControlKeyboardBack(hidden, host), false,
  'a failed request cannot latch a permanent focus-based Back lock');

// Structural wiring only; platform IME interaction remains a device gate.
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url), 'utf8');
const back = source.slice(source.indexOf('  private requestExit(): void {'), source.indexOf('  private beginExit(): void {'));
assert.ok(back.indexOf('consumeReaderControlKeyboardBack') < back.indexOf('this.controlTemporaryLayer'));
assert.ok(back.indexOf('consumeReaderControlKeyboardBack') < back.indexOf('backReaderControlHostSession'));
assert.match(back, /ReaderWindowCoordinator\.metrics\(\), this\.controlKeyboardHost\(\)/);
const closeStart = source.indexOf('  private hideControl(): void {');
const closeEnd = source.indexOf('  private controlVisible(): boolean {');
assert.ok(closeStart >= 0 && closeEnd > closeStart, 'close method boundaries must exist in order');
const close = source.slice(closeStart, closeEnd);
assert.match(close, /hideReaderControlKeyboard\(this\.controlKeyboardHost\(\)\)/);
const commit = source.slice(source.indexOf('  private onControlSessionChanged(): void {'),
  source.indexOf('  private expandControlDirectory(): void {'));
assert.match(commit, /readerControlHostCloseCommitted[\s\S]*readerControlKeyboardVisible\(ReaderWindowCoordinator\.metrics\(\)\)[\s\S]*hideReaderControlKeyboard/);
assert.match(source, /inputMethod\.getController\(\)\.hideTextInput\(\)/);
assert.doesNotMatch(source, /\.hideSoftKeyboard\(/);

// Execute the real Host methods and its actual Panel layout expression. The
// dependency harness records reads during that binding, like partial-update
// dependency collection; it is not an ArkUI renderer or an IME simulation.
function productionMethod(name) {
  const start = source.indexOf(`  private ${name}(`);
  assert.ok(start >= 0, `production ${name} method exists`);
  let end = source.indexOf('{', start) + 1;
  let depth = 1;
  while (depth > 0 && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return source.slice(start, end);
}
const layoutMethods = ['effectiveViewportWidth', 'effectiveViewportHeight', 'readingLayout',
  'controlLayout', 'windowMetricsLayoutKey', 'onWindowMetricsRevisionChanged',
  'reflowAfterWindowGeometryChange'].map(productionMethod).join('\n');
const makeMetrics = keyboardBottom => new ReaderWindowMetricsSnapshot(
  new ReaderRectVp(0, 0, 1320 / 3.5, 816), new ReaderRectVp(0, 0, 1320 / 3.5, 816),
  new ReaderInsetsVp(), new ReaderInsetsVp(), new ReaderInsetsVp(),
  new ReaderInsetsVp(0, 0, 0, 28), new ReaderInsetsVp(0, 0, 0, keyboardBottom),
  3.5, 1, keyboardBottom > 0 ? 1 : 2, true);
let currentMetrics = makeMetrics(314);
const deps = { ...layoutPolicy, ReaderWindowCoordinator: { metrics: () => currentMetrics } };
const LayoutHost = new Function(...Object.keys(deps),
  `${stripTypeScriptTypes(`class LayoutHost { ${layoutMethods} }`)}; return LayoutHost;`)(...Object.values(deps));
const panelStart = source.indexOf('      ReaderControlPanel({');
assert.ok(panelStart >= 0);
const binding = source.slice(panelStart).match(/\blayout: ([^\n]+),/);
assert.ok(binding, 'actual Panel layout binding exists');
const readBinding = new Function(`return function() { return ${binding[1]}; };`)();
const layoutHost = new LayoutHost();
Object.assign(layoutHost, {
  mounted: true, viewportWidth: 1320 / 3.5, viewportHeight: 816, isTablet: false,
  readerSettingsSnapshot: { extendIntoCutout: false }, pageTurnSettlementLayout: undefined,
  pageTurnInputPhase: () => 'idle', chromeCalls: 0,
  applyWindowChrome() { this.chromeCalls++; },
  invalidatePageTurnRuntime() { assert.fail('keyboard-only change must not repaginate reading text'); },
  controlSession: holdReaderControlSession(enterReaderControlModule(
    openReaderControlSession(createReaderControlSessionState(), 0), 'search', 0), 9),
  quickSearchQuery: '他', quickSearchState: { kind: 'ready', results: ['retained'] },
});
let revisionWasRead = false;
Object.defineProperty(layoutHost, 'readerWindowMetricsRevision', {
  get() { revisionWasRead = true; return currentMetrics.revision; },
});
const keyboardLayout = readBinding.call(layoutHost);
assert.equal(keyboardLayout.fullPanelHeight, 414);
assert.equal(revisionWasRead, true,
  'Panel binding must subscribe to metrics revision even when reading viewport/key stays unchanged');
layoutHost.lastWindowMetricsLayoutKey = layoutHost.windowMetricsLayoutKey();
const previousReadingKey = layoutHost.lastWindowMetricsLayoutKey;
const heldIdentity = layoutHost.controlSession;
currentMetrics = makeMetrics(0);
layoutHost.onWindowMetricsRevisionChanged();
assert.equal(layoutHost.windowMetricsLayoutKey(), previousReadingKey,
  'IME is an interactive inset, not a reading-pagination change');
assert.equal(layoutHost.chromeCalls, 1);
const restoredLayout = readBinding.call(layoutHost);
assert.equal(restoredLayout.fullPanelHeight, 700, 'same binding restores the full viewport budget');
assert.strictEqual(layoutHost.controlSession, heldIdentity, 'layout refresh cannot reset session/held ownership');
assert.equal(layoutHost.controlSession.heldPointerId, 9);
assert.equal(layoutHost.quickSearchQuery, '他');
assert.deepEqual(layoutHost.quickSearchState.results, ['retained']);
function quickContentScreenPx(layout) {
  const frame = sampleReaderControlMotionComposition({ expansionProgress: 0, visibilityProgress: 1 },
    readerControlMotionBounds(layout.fullPanelWidth, layout.fullPanelHeight, layout.dockBottomGap));
  return (layout.viewportHeight - layout.dockBottomGap - layout.fullPanelHeight + frame.content.y) * 3.5;
}
assert.equal(quickContentScreenPx(keyboardLayout), 703.5);
assert.equal(quickContentScreenPx(restoredLayout), 1704.5,
  'production geometry restores Quick to the bottom without a close/reopen or a new session');
console.log('Reader control keyboard: production visibility/Back/hide failure cases PASS; structural Host wiring PASS (not native IME acceptance)');
console.log('Reader control keyboard layout: actual Host methods/binding dependency and 414→700vp budget PASS (not native IME acceptance)');

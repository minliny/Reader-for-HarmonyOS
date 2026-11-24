import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as gesture from '../entry/src/main/ets/features/reading/ui/ReaderPageGestureState.ts';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { selectedProductionValues } from './lib/selected-production-methods.mjs';

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderPageInteractionLayer.ets', import.meta.url), 'utf8');
const { READER_ACTION_MIN_TARGET } = selectedProductionValues(
  new URL('../entry/src/main/ets/ui/controls/ReaderActionAccessibility.ets', import.meta.url), ['READER_ACTION_MIN_TARGET']);
assert.match(source, /\.accessibilityVirtualNode\(this\.accessiblePageActions\)/,
  'the existing touch arena exposes actionable accessibility children');
const { owner } = createReaderBuilderProbe(source,
  ['accessiblePageActions', 'accessiblePageAction', 'accessibleActionHeight', 'accessibleActionTop',
    'accessibleActionsAvailable', 'activatePageFromAccessibility', 'acceptCurrentInput', 'tapOnlyNow'], {
    ...gesture, READER_ACTION_MIN_TARGET, Direction: { Ltr: 'ltr' },
    AccessibilityRoleType: { BUTTON: 'button' },
  });
const trace = [];
Object.assign(owner, {
  interactionEnabled: true,
  tapOnly: false,
  viewportWidth: 330,
  viewportHeight: 700,
  inputRevision: 7,
  inputCurrent: revision => revision === 7,
  gestureState: { phase: 'idle' },
  activePointerId: -1,
  onInputLost: revision => trace.push(['input-retired', revision]),
  onInputRevisionChanged: () => {},
  onTurn: direction => trace.push(['turn', direction]),
  onManualInteraction: () => trace.push(['manual']),
  onOpenControl: () => trace.push(['control']),
});
owner.accessiblePageActions();
const controls = [...owner.nodes.values()].filter(node => node.accessibilityRole === 'button');
assert.deepEqual(controls.map(node => node.create), ['上一页', '打开阅读控制栏', '下一页'],
  'screen reader traversal follows the existing left-to-right turn actions');
const ids = ['previous', 'control', 'next'].map(intent => `reader-paged-action-${intent}`);
assert.deepEqual(controls.map(node => node.id), ids, 'actions provide stable IDs for native focus');
assert.deepEqual(controls.map(node => node.width), [110, 110, 110]);
assert.ok(controls.every(node => node.height >= READER_ACTION_MIN_TARGET));
const row = [...owner.nodes.values()].find(node => node.type === 'Row');
assert.deepEqual(row.position, { x: 0, y: 328 });
assert.equal(row.direction, 'ltr');
for (const [width, height] of [[132, 44], [780, 422], [120, 40]]) {
  Object.assign(owner, { viewportWidth: width, viewportHeight: height });
  owner.replay();
  assert.deepEqual(controls.map(node => node.id), ids, 'resizing preserves native focus identity');
  assert.deepEqual(controls.map(node => node.width), [width / 3, width / 3, width / 3]);
  assert.deepEqual(controls.map(node => node.height), new Array(3).fill(Math.min(height, READER_ACTION_MIN_TARGET)));
  assert.deepEqual(row.position, { x: 0, y: (height - row.height) / 2 });
  assert.deepEqual(controls.map((node, index) => gesture.readerPageTapIntent(node.width * (index + 0.5), width)),
    ['previous', 'control', 'next']);
}
owner.viewportWidth = 0;
owner.replay();
assert.ok(controls.every(node => node.accessibilityLevel === 'no' && !node.enabled),
  'unmeasured viewport exposes no zero-sized focus targets');
owner.viewportWidth = 330;
owner.replay();
for (const node of controls) {
  assert.equal(node.accessibilityLevel, 'yes');
  assert.equal(node.accessibilityText, node.create);
  node.onClick();
}
assert.deepEqual(trace, [['manual'], ['turn', 'previous'], ['control'], ['manual'], ['turn', 'next']]);

owner.tapOnly = true;
controls[2].onClick();
owner.tapOnly = false;
owner.activePointerId = 99;
controls[0].onClick();
owner.activePointerId = -1;
assert.equal(trace.length, 5, 'a settling or pointer-owned arena cannot additionally turn by accessibility');
owner.interactionEnabled = false;
owner.replay();
for (const node of controls) {
  assert.equal(node.accessibilityLevel, 'no');
  node.onClick();
}
assert.equal(trace.length, 5, 'covered reader is outside accessibility traversal and cannot dispatch stale actions');
owner.interactionEnabled = true;
owner.inputRevision = 8;
controls[1].onClick();
assert.deepEqual(trace.at(-1), ['input-retired', 8]);
console.log('PASS SDK virtual page actions are ordered and use existing reading ownership, with no live arena or retired-route dispatch');

const continuousSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderContinuousReadingStage.ets', import.meta.url), 'utf8');
assert.match(continuousSource, /this\.accessibleOpenControlCarrier\(\);/,
  'the continuous reading stage exposes an independent controls entry');
assert.equal((continuousSource.match(/\.accessibilityVirtualNode\(/g) ?? []).length, 1,
  'the scrolling List and its paragraph descendants keep their own accessibility tree');
const { owner: continuous } = createReaderBuilderProbe(continuousSource,
  ['accessibleOpenControlCarrier', 'accessibleOpenControl', 'accessibleControlOffset', 'accessibleControlAvailable', 'activateControlFromAccessibility',
    'acceptCurrentInput', 'onInputRevisionChanged'], {
    READER_ACTION_MIN_TARGET, AccessibilityRoleType: { BUTTON: 'button' }, HitTestMode: { None: 'none' },
  });
const continuousTrace = [];
Object.assign(continuous, {
  mounted: true, interactionEnabled: true, touchActive: false, inputRevision: 1,
  layout: { viewportWidth: 320, viewportHeight: 600 },
  inputCurrent: revision => revision === 1,
  onInputLost: revision => continuousTrace.push(['retired', revision]),
  onOpenControl: () => continuousTrace.push(['control']),
});
continuous.accessibleOpenControlCarrier();
continuous.accessibleOpenControl();
const carrier = [...continuous.nodes.values()].find(node => node.type === 'Row');
const action = [...continuous.nodes.values()].find(node => node.id === 'reader-continuous-action-control');
assert.equal(carrier.hitTestBehavior, 'none', 'the carrier leaves List gestures and touch exploration outside its bounds alone');
assert.deepEqual(carrier.position, { x: 138, y: 278 });
assert.deepEqual([action.width, action.height], [44, 44]);
assert.equal(action.accessibilityText, '打开阅读控制栏');
assert.equal(action.accessibilityRole, 'button');
action.onClick();
continuous.touchActive = true; action.onClick();
continuous.touchActive = false; continuous.interactionEnabled = false; continuous.replay();
assert.equal(action.accessibilityLevel, 'no');
action.onClick();
continuous.interactionEnabled = true; continuous.mounted = false; action.onClick();
assert.deepEqual(continuousTrace, [['control']], 'covered, detached and pointer-owned stages cannot dispatch');
continuous.mounted = true; continuous.layout = { viewportWidth: 780, viewportHeight: 430 }; continuous.replay();
assert.deepEqual(carrier.position, { x: 368, y: 193 });
assert.equal(action.id, 'reader-continuous-action-control');
continuous.inputRevision = 2; action.onClick();
assert.deepEqual(continuousTrace.at(-1), ['retired', 2]);
console.log('PASS continuous SDK virtual controls entry retains the List owner and guards focus geometry, pointer and retired route');

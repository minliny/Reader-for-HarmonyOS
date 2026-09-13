import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const url = new URL('../entry/src/main/ets/features/reading/ReaderTtsConfigOverlay.ets', import.meta.url);
const Overlay = productionMotionMethods(url, ['compactManager', 'managerOuterPadding', 'panelHeight']);
for (const usable of [0, 30, 44, 64, 96, 120, 140, 160, 166, 167, 240, 844]) {
  const p = Object.assign(new Overlay(), { manager: true, modalUsableHeight: usable });
  assert.ok(p.panelHeight() >= 0);
  assert.ok(p.panelHeight() + 2 * p.managerOuterPadding() <= usable);
  assert.equal(p.compactManager(), usable <= 166);
  if (!p.compactManager()) assert.ok(p.panelHeight() >= 134, 'fixed header/footer only when entire budget fits');
  else if (usable >= 44) assert.ok(p.panelHeight() >= 44, 'scroll viewport retains complete action height');
}
const source = readFileSync(url, 'utf8');
assert.match(source, /if \(this\.compactManager\(\)\) \{[\s\S]*?Scroll\(\) \{[\s\S]*?this\.configurationHeader\(\);[\s\S]*?this\.managerForm\(\);[\s\S]*?this\.managerFooter\(\);[\s\S]*?\.height\(this\.panelHeight\(\)\)/,
  'short mode scrolls header, form and footer as one document');
const { owner } = createReaderBuilderProbe(source, ['managerFooter']);
let save = 0, cancel = 0;
Object.assign(owner, { appThemeScheme: 'day', busy: false, canSubmit: () => true,
  submit: () => save++, close: () => cancel++ });
owner.managerFooter();
const actions = [...owner.nodes.values()].filter(node => typeof node.onClick === 'function');
assert.equal(actions.length, 2);
for (const action of actions) { assert.equal(action.height, 44); assert.equal(action.enabled, true); action.onClick(); }
assert.equal(save, 1); assert.equal(cancel, 1);
console.log('PASS TTS short window: 0–844vp budgets, whole-form scroll fallback, unchanged 44vp Save/Cancel SDK actions');

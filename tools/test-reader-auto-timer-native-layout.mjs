import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import * as actors from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import * as auto from '../entry/src/main/ets/features/reading/ReaderAutoPageFullState.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets', import.meta.url), 'utf8');
const wheelSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlTimerWheel.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('ReaderControlTimerWheel');
syntax.propCollection.set('ReaderControlTimerWheel', new Set([...wheelSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
class TimerWheelChild { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const candidates = ['p', 'frame', 'contentWidth', 'sectionInnerWidth', 'timerWheelWidth', 'timerWheel', 'timerSection',
  'currentTimerValue', 'adjacentTimerValue', 'commitTimerStep'];
function probe(text) {
  const { owner } = createReaderBuilderProbe(text, candidates.filter(n => text.includes(`private ${n}(`)),
    { ...geometry, ...actors, ...auto, ReaderControlTimerWheel: TimerWheelChild });
  Object.assign(owner, { motionProgress: 1, availableWidth: 313.714285714, cachedProgress: -1, cachedWidth: -1,
    timerMinutes: 15, timerSeconds: 0, timerSummaryText: '15:00', appScheme: 'day', sourceOnly: 'none',
    fullInput: () => owner.p() === 1 && owner.sourceOnly === 'none',
    presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), fullOnlyScrollTranslation: () => 0 });
  owner.timerSection();
  return owner;
}
function sample(owner) {
  const nodes = [...owner.nodes.values()], children = [...owner.children.values()];
  const card = nodes.find(n => n.type === 'Stack' && n.borderRadius === 10);
  const group = nodes.find(n => n.type === 'Stack' && n.height === 114);
  const colon = nodes.find(n => n.type === 'Text' && n.create === ':');
  const placements = nodes.filter(n => n.type === '__Common__').map(n => n.position);
  const minute = children.find(c => c.params.unit === '分'), second = children.find(c => c.params.unit === '秒');
  assert.ok(card && group && colon && minute && second, 'actual SDK emits the card, group, colon and both shared children');
  return { width: owner.availableWidth, p: owner.p(), card, group, colon, placements,
    minute: minute.params, second: second.params };
}
function validate(owner) {
  const s = sample(owner);
  assert.ok(s.group.position.x + s.group.width <= s.card.width + .001,
    `timer picker exceeds its actual card: ${s.group.position.x + s.group.width} > ${s.card.width}`);
  assert.equal(s.group.position.x, 115, 'label end99 plus16 gap is preserved');
  assert.ok(Math.abs(s.card.width - s.group.position.x - s.group.width - 15) < .001, 'original right padding15');
  assert.equal(s.minute.wheelWidth, s.second.wheelWidth);
  assert.ok(s.minute.wheelWidth >= 36, '3-digit minutes retain a readable slot at covered phone widths');
  assert.equal(s.placements[0].x, 0);
  assert.equal(s.colon.position.x, s.minute.wheelWidth + 8);
  assert.equal(s.placements[1].x, s.minute.wheelWidth + 24);
  assert.equal(s.placements[1].x + s.second.wheelWidth, s.group.width);
  assert.equal(s.minute.selectedSize, 17); assert.equal(s.minute.neighbourSize, 11);
  assert.equal(s.minute.rowHeight, 34); assert.equal(s.group.height, 114); assert.equal(s.card.height, 138);
  return s;
}
const owner = probe(source);
const initial = sample(owner);
const record = process.argv.indexOf('--record');
if (record >= 0) writeFileSync(process.argv[record + 1], JSON.stringify({ initial }, null, 2) + '\n');
validate(owner);
const samples = [];
for (const delta of [-24.285714286, 0, 120]) for (const scheme of ['day', 'night']) {
  for (const p of [0, .2, .5, 1, .5, .2, 0]) {
    Object.assign(owner, { motionProgress: p, availableWidth: 286 + 52 * p + delta, appScheme: scheme });
    owner.replay(); samples.push(validate(owner));
  }
}
owner.motionProgress = 1; owner.availableWidth = 338; owner.replay();
const baseline = validate(owner);
assert.equal(baseline.card.width, 306); assert.equal(baseline.group.width, 176);
assert.equal(baseline.minute.wheelWidth, 76); assert.equal(baseline.colon.position.x, 84); assert.equal(baseline.placements[1].x, 100);
const changes = []; owner.onTimerChange = (m, s) => changes.push([m, s]);
baseline.minute.onStep(1); baseline.second.onStep(1); assert.deepEqual(changes, [[16, 0], [15, 1]]);

// Execute the actual shared child's Builder too: every text/divider/unit must
// consume the changed Prop, rather than letting only a bounding wrapper shrink.
const wheelBuilderSource = wheelSource.replace('  build() {',
  '  build() { Column() {} }\n  @Builder private paintWheel() {');
const wheel = createReaderBuilderProbe(wheelBuilderSource, ['offsets', 'valid', 'label', 'step', 'paintWheel']).owner;
Object.assign(wheel, { value: 15, minimum: 0, maximum: 180, wheelWidth: 76, rowHeight: 34, neighbours: 1,
  selectedSize: 17, neighbourSize: 11, unit: '分', interactionEnabled: true, appThemeScheme: 'day' });
wheel.paintWheel();
for (const s of samples) {
  wheel.wheelWidth = s.minute.wheelWidth; wheel.replay();
  for (const n of wheel.nodes.values()) if (['Text', 'Row', 'Column', 'Stack'].includes(n.type)) {
    assert.equal(n.width, s.minute.wheelWidth, `actual ${n.type} paint width follows child Prop`);
  }
}
const oldSource = source.replace('wheelWidth: this.timerWheelWidth()', 'wheelWidth: 76')
  .replace('minutes ? 0 : this.timerWheelWidth() + 24', 'minutes ? 0 : 100')
  .replace('x: this.timerWheelWidth() + 8, y: 40.5', 'x: 84, y: 40.5')
  .replace('.width(this.timerWheelWidth() * 2 + 24)', '.width(176)');
assert.notEqual(oldSource, source);
assert.throws(() => validate(probe(oldSource)), /exceeds its actual card/, 'original fixed child geometry reproduces the VM failure');
if (record >= 0) writeFileSync(process.argv[record + 1], JSON.stringify({ initial, baseline, samples,
  evidenceLayer: 'real SDK-emitted Builder observers and child Prop payloads; not native pixel rendering' }, null, 2) + '\n');
console.log('Auto Full timer actual SDK Builder parent/child width budget, original306 baseline, 42 retained reversible poses, wheel paint Prop and mutation PASS');

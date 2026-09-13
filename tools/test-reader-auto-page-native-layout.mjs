import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import * as actors from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import * as auto from '../entry/src/main/ets/features/reading/ReaderAutoPageFullState.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets', import.meta.url), 'utf8');
const candidates = ['p', 'frame', 'effectiveSpeedSeconds', 'speedRow', 'speedControlsWidth', 'speedControlsHeight',
  'speedControlsX', 'speedControlsY', 'speedSliderWidth', 'speedSliderX', 'speedMinusX', 'speedMaxLabelX',
  'speedPlusX', 'speedLabelY', 'speedActor', 'speedActorId', 'speedStepButton', 'changeSpeedStep'];
const members = candidates.filter(name => source.includes(`private ${name}(`));
const { owner } = createReaderBuilderProbe(source, members, { ...geometry, ...actors, ...auto });
Object.assign(owner, { motionProgress: 0, availableWidth: 261.714285714, cachedProgress: -1, cachedWidth: -1,
  speedSeconds: 8, speedPreviewSeconds: -1, appScheme: 'day', sourceOnly: 'none', sharedInput: () => true, fullInput: () => owner.p() === 1,
  presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), sharedScrollTranslation: () => 0,
  sharedClip: () => ({ path: 'test-only-no-native-renderer' }) });
owner.speedRow();
const snapshot = () => ({ progress: owner.p(), viewportWidth: owner.availableWidth, frame: owner.frame(),
  emittedNodes: [...owner.nodes.values()] });
const first = snapshot();
const output = process.argv.indexOf('--record');
if (output >= 0) writeFileSync(process.argv[output + 1], JSON.stringify(first, null, 2) + '\n');

// Actual VM geometry grounds the failure: px coordinates /3.5 exactly match
// the production Quick parent excess. This probe executes real emitted Builder
// closures; it does not claim to execute ArkUI's native text/layout engine.
const vm = JSON.parse(readFileSync(new URL('./fixtures/reader-auto-quick-native-layout-20260913.json', import.meta.url), 'utf8'));
const actual = vm.nodes;
const playback = actual.find(n => n.id === 'reader-control-auto-page-playback');
assert.equal(playback.origBounds, '[134,1821][1148,2186]');
assert.equal(playback.bounds, '[134,1821][1008,2186]');
assert.equal(actual.filter(n => n.text === '8 秒').length, 2, 'recorded failed native tree contains duplicate live value');

assert.ok(first.frame.content.x + first.frame.control.width <= first.viewportWidth,
  `Quick playback card exceeds viewport: ${first.frame.content.x + first.frame.control.width} > ${first.viewportWidth}`);
assert.equal(first.emittedNodes.filter(n => n.type === 'Text' && n.create === '8 秒').length, 1,
  'the current speed is one persistent Text actor, never a duplicate range minimum');

const samples = [];
for (const delta of [-24.285714286, 0, 120]) for (const value of [2, 8, 10, 20]) {
  for (const p of [0, .25, .5, 1, .5, .25, 0]) {
    Object.assign(owner, { motionProgress: p, availableWidth: 286 + 52 * p + delta, speedSeconds: value });
    owner.replay();
    const frame = owner.frame(), nodes = [...owner.nodes.values()];
    assert.ok(frame.content.x + frame.control.width <= owner.availableWidth + .0001, 'actual parent width remains inside viewport');
    assert.equal(nodes.filter(n => n.type === 'Text' && n.id === 'reader-auto-speed-current').length, 1);
    const visible = nodes.filter(n => n.type === 'Text' && n.id?.startsWith?.('reader-auto-speed-') && (n.opacity ?? 1) > .999);
    for (const n of visible) {
      assert.ok(n.position.x >= 0 && n.position.x + n.width <= frame.speed.width + .001, `${n.id} fits its actual speed parent`);
    }
    const text = id => nodes.find(n => n.id === `reader-auto-speed-${id}`);
    const current = text('current');
    assert.equal(current.create, `${value} 秒`);
    assert.ok(current.width >= 25, '2-digit value and CJK unit retain sufficient fixed text width');
    if (p === 0) {
      assert.equal(text('minimum').opacity, 0); assert.equal(text('maximum').opacity, 0);
      assert.ok(text('title').position.x + text('title').width <= owner.speedActor('minus').x);
      assert.ok(owner.speedActor('minus').x + 24 <= current.position.x);
      assert.ok(current.position.x + current.width <= owner.speedActor('plus').x);
    } else if (p === 1) {
      assert.equal(text('minimum').create, '2 秒'); assert.equal(text('maximum').create, '20 秒');
      assert.ok(current.position.x + current.width <= text('minimum').position.x);
      const slider = nodes.find(n => n.type === 'Slider');
      assert.equal(slider.opacity, 1); assert.ok(slider.width >= 80, 'native range has a usable responsive rail');
      assert.ok(slider.position.x + slider.width <= text('maximum').position.x);
    }
    samples.push({ p, width: owner.availableWidth, speed: value, layout: frame.speedContent });
  }
}
const changed = []; owner.onSpeedChange = value => changed.push(value);
owner.motionProgress = 0; owner.speedSeconds = 8; owner.replay();
owner.changeSpeedStep(false); owner.changeSpeedStep(true);
assert.deepEqual(changed, [7, 9], 'native Quick buttons route existing business commands');
owner.motionProgress = 1; owner.replay(); const slider = [...owner.nodes.values()].find(n => n.type === 'Slider');
slider.onChange(13, 'SliderChangeMode.Moving'); assert.equal(owner.effectiveSpeedSeconds(), 13);
slider.onChange(13, 'SliderChangeMode.End'); assert.equal(changed.at(-1), 13);
owner.appScheme = 'night'; owner.replay();
for (const n of owner.nodes.values()) for (const key of ['backgroundColor', 'fontColor', 'trackColor', 'selectedColor', 'blockColor']) {
  if (Object.hasOwn(n, key)) assert.match(n[key], /^#[\da-fA-F]{8}$/, `Night ${n.type}.${key} resolves a registry color`);
}
owner.sourceOnly = 'quick'; owner.motionProgress = 0; owner.replay();
assert.ok([...owner.nodes.values()].every(n => typeof n.id !== 'string' || n.id === ''),
  'retained source projections never publish duplicate production actor IDs');
owner.sourceOnly = 'none'; owner.replay();
if (output >= 0) writeFileSync(process.argv[output + 1], JSON.stringify({ ...snapshot(), samples }, null, 2) + '\n');
console.log(`AutoPage actual SDK Builder bounds, single current value, Quick +/- and Full range, ${samples.length} reversible samples PASS`);

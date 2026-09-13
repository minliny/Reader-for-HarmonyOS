import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import * as actors from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import * as paint from '../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
import * as tts from '../entry/src/main/ets/features/reading/ReaderTtsState.ts';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

const inside = (rects, x, y) => rects.some(r => x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height);
const intersection = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
let crossed = false, clippedSpeed = false;
// Real source/target clip unions at different scroll anchors. An invisible
// Speed actor must never punch a hole through Timer during reverse/re-grab.
for (const delta of [-24, 0, 120]) for (const offset of [0, 300, 565, 1200]) {
  for (let step = 0; step <= 100; step++) {
    const p = step / 100, width = 286 + 52 * p + delta;
    const current = geometry.sampleReaderControlTts(p, width);
    const full = geometry.sampleReaderControlTts(1, width), quick = geometry.sampleReaderControlTts(0, width);
    const clips = kind => paint.readerControlMotionClipRects(p, full[kind], current[kind], quick[kind], 666, offset);
    const timer = clips('timer'), speed = clips('speed');
    const mapped = speed.map(r => ({ ...r, x: r.x + current.speed.x - current.timer.x, y: r.y + current.speed.y - current.timer.y }));
    const visible = geometry.readerControlTtsTimerVisibleRects(timer, current, speed);
    assert.deepEqual(geometry.readerControlTtsTimerVisibleRects(timer, current, speed), visible, 'sampling is reversible and stateless');
    for (const a of visible) for (const b of mapped) assert.ok(intersection(a, b) < 1e-7, 'no translucent Timer/Speed double painting');
    for (let x = 2.3; x < current.timer.width; x += 19.7) for (let y = 1.7; y < current.timer.height; y += 11.3) {
      assert.equal(inside(visible, x, y), inside(timer, x, y) && !inside(mapped, x, y), 'only actually painted Speed pixels occlude Timer');
    }
    crossed ||= timer.some(a => mapped.some(b => intersection(a, b) > 1));
    if (speed.every(r => r.height === 0)) {
      clippedSpeed = true; assert.deepEqual(visible, timer, 'fully clipped Speed makes no ghost hole');
    }
    if (p === 0 || p === 1) assert.deepEqual(visible, timer, 'both reference endpoints remain uncut');
    if (p === 0) assert.ok(current.quickPlaybackLabel.x + current.quickPlaybackLabel.width < current.previous.x,
      'Quick status and transport do not collide at the smaller host width');
  }
}
assert.ok(crossed && clippedSpeed, 'test covers both real crossing and invisible occluders');

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlTtsContent.ets', import.meta.url), 'utf8');
const methods = ['p', 'fullInput', 'sharedInput', 'effectiveRate', 'timerSummary', 'timerCaption', 'twoDigits',
  'timerPresetSelected', 'timerPresetLabel', 'timerPresetIsSelected', 'chooseTimerPreset', 'timerPreset',
  'cycleQuickTimer', 'timerStepper', 'timerStepButton', 'stepTimer',
  'ratePresets', 'ratePresetWidth', 'chooseRatePreset', 'ratePreset'];
const { owner } = createReaderBuilderProbe(source, methods, { ...geometry, ...actors, ...tts });
Object.assign(owner, { motionProgress: 1, interactionEnabled: true, state: { rate: 1 }, ratePreview: -1,
  timerMode: 'duration', timerMinutes: 25, timerSeconds: 0,
  frame: () => ({ speedPresets: { width: 280 } }) });
for (const minutes of [0, 15, 30, 45, 60, 'chapterEnd']) owner.timerPreset(minutes);
owner.timerStepper(true); owner.timerStepper(false);
owner.ratePresets().forEach(rate => owner.ratePreset(rate));
const mountedCount = owner.observers.length, commands = [];
owner.onTimerChange = (m, s, mode = 'duration') => {
  commands.push(['timer', m, s, mode]); owner.timerMode = mode;
  owner.timerMinutes = m; owner.timerSeconds = s;
};
owner.onRateChange = rate => { commands.push(['rate', rate]); owner.state = { rate }; };
const button = label => [...owner.nodes.values()].find(n => n.accessibilityText === label);
for (const p of [0, .2, 1, .8, 1]) {
  owner.motionProgress = p; owner.replay();
  for (const label of ['定时30分钟', '增加五分钟', '语速1.25倍']) {
    const before = commands.length; button(label).onClick();
    assert.equal(commands.length - before, p === 1 ? 1 : 0, 'new controls respect the same input lock during morph');
  }
}
owner.motionProgress = 1; owner.timerMode = 'duration'; owner.timerMinutes = 180; owner.timerSeconds = 59; owner.replay();
assert.equal(button('增加五分钟').enabled, false); assert.equal(button('增加一秒').enabled, false);
owner.timerMinutes = 0; owner.timerSeconds = 0; owner.replay();
assert.equal(button('减少五分钟').enabled, false); assert.equal(button('减少一秒').enabled, false);
button('朗读到本章结束停止').onClick(); owner.replay();
assert.equal(owner.timerCaption(), '本章结束'); assert.equal(owner.timerMode, 'chapterEnd');
owner.motionProgress = 0; owner.cycleQuickTimer(); assert.equal(owner.timerMode, 'off');
owner.cycleQuickTimer(); assert.equal(owner.timerMinutes, 15); assert.equal(owner.timerMode, 'duration');
owner.cycleQuickTimer(); assert.equal(owner.timerMinutes, 30);
owner.cycleQuickTimer(); assert.equal(owner.timerMinutes, 60);
owner.cycleQuickTimer(); assert.equal(owner.timerMode, 'chapterEnd');
owner.motionProgress = 1; owner.replay();
button('关闭定时停止').onClick(); owner.replay(); assert.equal(owner.timerCaption(), '不开启');
owner.interactionEnabled = false; owner.replay();
const before = commands.length; button('语速1.25倍').onClick(); assert.equal(commands.length, before);
assert.equal(owner.observers.length, mountedCount, 'business changes never remount preset or stepper actors');
for (const [kind, a, b] of commands) {
  if (kind === 'timer') assert.ok(a >= 0 && a <= 180 && b >= 0 && b <= 59);
  else assert.ok(a >= .5 && a <= 2 && Math.abs(a * 20 - Math.round(a * 20)) < 1e-8);
}
console.log('PASS Make TTS: scroll-aware crossing occlusion, reverse poses, narrow layout, explicit timer modes, five-minute range and precise speed callbacks');

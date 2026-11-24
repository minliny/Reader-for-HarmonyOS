import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createReaderTtsWaveformSample, READER_TTS_WAVEFORM_HEIGHTS, ReaderTtsWaveformMotion, ReaderTtsWaveformClock } from '../entry/src/main/ets/features/reading/ui/ReaderTtsWaveformModel.ts';
import { createReaderBuilderProbe, productionReaderMotionSdk } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { readerProbeCubicBezierProgress as bezier } from './lib/reader-motion-curve-fixture.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const ease = p => bezier(p, .25, .1, .25, 1), easeInOut = p => bezier(p, .42, 0, .58, 1);
const curves = { ease, easeInOut };
const reference = readFileSync(new URL('./fixtures/design/tts-waveform-reference.tsx', import.meta.url), 'utf8');
const heights = reference.match(/function EqualiserBar[\s\S]*?const bars = \[([^\]]+)\]/)[1].split(',').map(Number);
assert.deepEqual(READER_TTS_WAVEFORM_HEIGHTS, heights);
assert.match(reference, /width: 2\.5/); assert.match(reference, /h-\[26px\]/);
assert.match(reference, /0\.65 \+ \(i % 5\) \* 0\.11/); assert.match(reference, /i \* 0\.03/);
assert.match(reference, /ease-in-out[^`]+infinite alternate/);
assert.match(reference, /height 0\.3s ease, background 0\.35s ease/);
assert.match(reference, /scaleY\(0\.4\)/); assert.match(reference, /scaleY\(1\.15\)/);
const motion = new ReaderTtsWaveformMotion(curves);
assert.deepEqual(motion.sample(0).heights, Array(24).fill(4));
motion.setPlaying(true, 100);
// Actual Make formula, sampled across delay, forward, reverse and repeat epochs.
for (const elapsed of [0, 1, 29, 30, 100, 299, 300, 350, 650, 690, 760, 1300, 1450, 3700]) {
  const s = motion.sample(100 + elapsed);
  for (let i = 0; i < 24; i++) {
    const local = elapsed - i * 30, duration = (0.65 + (i % 5) * .11) * 1000;
    const iteration = local < 0 ? 0 : Math.floor(local / duration);
    const fraction = local < 0 ? 0 : (local % duration) / duration;
    const expected = local < 0 ? 1 : .4 + .75 * easeInOut(iteration % 2 === 0 ? fraction : 1 - fraction);
    assert.ok(Math.abs(s.scales[i] - expected) < 1e-8, `bar ${i} t=${elapsed}`);
    assert.ok(Math.abs(s.heights[i] - (4 + (heights[i] - 4) * ease(Math.min(1, elapsed / 300)))) < 1e-8);
    assert.equal(s.opacities[i], .75 + (i % 3) * .12);
  }
  assert.equal(s.colorProgress, ease(Math.min(1, elapsed / 350)));
}
motion.setPlaying(false, 4000);
assert.deepEqual(motion.sample(4000).scales, Array(24).fill(1), 'CSS removes the scale animation at pause');
assert.deepEqual(motion.sample(4300).heights, Array(24).fill(4));
assert.equal(motion.sample(4350).colorProgress, 0); assert.equal(motion.active(4350), false);
motion.setPlaying(true, 4400); assert.deepEqual(motion.sample(4400, true).scales, Array(24).fill(1));

let now = 0; const scheduled = [], samplesA = [], samplesB = [];
const clock = new ReaderTtsWaveformClock(curves, () => now);
const a = clock.subscribe(true, false, s => samplesA.push(s), f => scheduled.push(f));
const b = clock.subscribe(true, false, s => samplesB.push(s), f => scheduled.push(f));
assert.equal(scheduled.length, 1, 'quick and full use one frame callback sequence');
now = 450; scheduled.shift()(); assert.equal(samplesA.at(-1), samplesB.at(-1));
const frozen = clock.snapshot(), frozenCopy = structuredClone(frozen);
now = 457; assert.equal(clock.snapshot(), frozen, 'click capture cannot advance beyond the actually published source pose');
now = 650; scheduled.shift()(); assert.deepEqual(frozen, frozenCopy, 'sharp/blur shared snapshot is immutable');
const oldFrame = scheduled.shift(); clock.unsubscribe(a);
const delivered = samplesB.length; oldFrame(); assert.equal(samplesB.length, delivered, 'late departed owner cannot publish');
assert.equal(scheduled.length, 1, 'remaining live owner takes over one frame lane');
clock.update(b, false, false); now = 1100; scheduled.shift()(); assert.equal(scheduled.length, 0);
clock.update(b, true, true); assert.equal(scheduled.length, 0, 'reduce motion stops the repeating clock');
clock.unsubscribe(b);
let subscribed = 0, unsubscribed = 0;
const View = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ui/ReaderTtsWaveform.ets', import.meta.url),
  ['onPlaybackChanged'], { createReaderTtsWaveformSample, WAVEFORM_CLOCK: { unsubscribe() { unsubscribed++; }, subscribe() { return ++subscribed; } } });
const view = Object.assign(new View(), { mounted: true, playing:true, foreground:true, reduceMotion:false, active: true, frozen: true, subscription: -1 });
view.onPlaybackChanged(); assert.equal(subscribed, 0, 'frozen source view never starts a competing clock');
view.frozen = false; view.visible = false; view.onPlaybackChanged();
assert.equal(subscribed, 0, 'hidden live views do not keep a repeating UI workload');
view.visible = true; view.active = false; view.subscription = 42;
const beforeInactive = unsubscribed;
view.onPlaybackChanged();
assert.equal(unsubscribed, beforeInactive + 1);
assert.equal(view.subscription, -1); assert.equal(subscribed, 0, 'retained controls with no visible frame explicitly release their subscriber');
view.active=true;view.onPlaybackChanged();assert.equal(view.subscription,1);
for(const gate of ['playing','foreground','active','visible','reduceMotion']){
  view[gate]=gate==='reduceMotion';view.onPlaybackChanged();
  assert.equal(view.subscription,-1,`${gate} closes live waveform subscription immediately`);
  assert.deepEqual(view.liveSample,createReaderTtsWaveformSample());
  view[gate]=gate!=='reduceMotion';view.onPlaybackChanged();assert.ok(view.subscription>0);
}
let hiddenNow = 0; const hiddenFrames = [];
const hiddenClock = new ReaderTtsWaveformClock(curves, () => hiddenNow);
const hiddenId = hiddenClock.subscribe(true, false, () => {}, f => hiddenFrames.push(f));
assert.equal(hiddenFrames.length, 1);
hiddenClock.unsubscribe(hiddenId); hiddenNow = 100; hiddenFrames.shift()();
assert.equal(hiddenFrames.length, 0, 'last hidden subscriber leaves no continuing postFrame chain');
const panel = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets', import.meta.url), 'utf8');
const content = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlTtsContent.ets', import.meta.url), 'utf8');
assert.match(panel, /this\.launchWaveformSample = readerTtsWaveformSnapshot\(\)/);
assert.match(panel, /frozenWaveformSample: this\.launchWaveformSample/);
assert.match(content, /frozen: this\.sourceOnly !== 'none', frozenSample: this\.frozenWaveformSample/);
assert.match(panel, /waveformActive: this\.frame\(\)\.visibility > 0 && !this\.launchOwnsControls && !this\.controlObscured/);
assert.match(content, /playing: this\.state\.status === 'playing'/);
assert.match(content, /active: this\.waveformActive && this\.currentInputEnabled\(\) && !this\.sourceDetached/);
assert.match(content, /\.opacity\(this\.frame\(\)\.waveform\.opacity\)/);
assert.doesNotMatch(content, /waveformHeights\(|waveform\.opacity \* 0\.7/);

const auto=readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlAutoPageContent.ets',import.meta.url),'utf8');
const native=[];
const properties=createArkUIPropertyRuntimeProbe();
const pulse=createReaderBuilderProbe(auto,['moduleHeader','syncRunningPulse','runningPulseHigh','runningPulseVisible'],{
  ...properties.sdk,...productionReaderMotionSdk(),PlayMode:{Alternate:'alternate'},
  uiContext:{animateTo:(timing,commit)=>{native.push(timing);commit();}},
},properties.hooks).owner;
let allowed=true;
Object.assign(pulse,{appScheme:'day',status:'running',foreground:true,reducedMotion:false,minimumMounted:true,sourceOnly:'none',sourceDetached:false,
  currentInputEnabled:()=>allowed,headerActor:()=>({width:280,height:24,x:0,y:0,opacity:1}),headerMeta:()=> '进行中',
  fullOnlyScrollTranslation:()=>0,presentation:()=>({contentOpacity:1,contentBlur:0})});
pulse.moduleHeader('control');
const dot=[...pulse.nodes.values()].find(node=>node.type==='Circle');
assert.equal(dot.width,6);assert.equal(native.length,0);
dot.onVisibleAreaChange[1](true,1);pulse.replay();
assert.deepEqual(native.at(-1),{duration:650,curve:'Curve.EaseInOut',iterations:-1,playMode:'alternate'});
assert.equal(dot.scale.x,1.05);
for(const [field,inactive] of [['status','paused'],['foreground',false],['reducedMotion',true],['sourceDetached',true],['minimumMounted',false]]){
  const starting=pulse[field];pulse[field]=inactive;pulse.syncRunningPulse();
  assert.deepEqual(native.at(-1),{duration:0},`${field} synchronously stops repeating compositor work`);
  pulse[field]=starting;pulse.syncRunningPulse();assert.equal(native.at(-1).iterations,-1);
}
allowed=false;pulse.syncRunningPulse();assert.deepEqual(native.at(-1),{duration:0});
allowed=true;pulse.syncRunningPulse();dot.onVisibleAreaChange[1](false,0);
assert.deepEqual(native.at(-1),{duration:0});
console.log('Retained TTS waveform clock and AutoPage dot visibility, loop cessation, reduced motion and cap: PASS');

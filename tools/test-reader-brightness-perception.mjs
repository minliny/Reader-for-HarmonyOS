import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import * as curve from '../entry/src/main/ets/features/reading/ReaderBrightnessCurve.ts';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlGeometry.ts';

const {readerBrightnessWindowValue: windowValue, readerBrightnessControlPercent: controlPercent} = curve;
assert.equal(windowValue(1), .01); assert.equal(windowValue(100), 1);
assert.ok(Math.abs(windowValue(50.5) - .0925) < 1e-9, 'AOSP HLG midpoint lies at one twelfth of the usable window range');
assert.ok(windowValue(75) < .28, 'three quarters of the control is reserved for the low-setting region');
let last = 0;
for (let i = 0; i <= 990; i++) {
  const p = 1 + i / 10, value = windowValue(p);
  assert.ok(value >= last && value <= 1); last = value;
  assert.ok(Math.abs(controlPercent(value) - p) < .00002, 'restore/control readback must not move the rail');
}
for (const invalid of ['', 'bad', '-1', '256', 'Infinity']) assert.equal(curve.readerBrightnessSystemValue(invalid), undefined);
assert.equal(curve.readerBrightnessSystemValue('51'), .2);

const source = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const deferred = () => {let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let reads = [], writes = [], windowSetting = -1;
const Host = productionMotionMethods(source, ['refreshReaderBrightness','readSystemBrightnessValue', 'refreshSystemBrightness', 'setReaderBrightness',
  'setReaderAutomaticBrightness', 'enqueueReaderBrightness', 'admitReaderBrightness'], {
  ...curve, settings: {display:{SCREEN_BRIGHTNESS_STATUS:'brightness'},getValue(){const d=deferred();reads.push(d);return d.promise;}},
  ReaderWindowCoordinator:{brightness:()=>({read:async()=>({applied:true,value:windowSetting}), request(owner,value){const d=deferred();writes.push({owner,value,...d,resolve(result){if(result.applied)windowSetting=result.value;d.resolve(result);}});return d.promise;}})},
  hilog:{error(){}},
});
const fresh = () => { windowSetting=-1; return Object.assign(new Host(), {mounted:true,brightnessAutomatic:true,brightnessPercent:50,
  brightnessRequestGeneration:1,brightnessRevision:0,claimReaderBrightness:()=>1,
  getUIContext:()=>({getHostContext:()=>({})}),}); };
const flush = async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
{
  const h=fresh(); h.refreshSystemBrightness(1); reads.at(-1).resolve('51'); await flush();
  assert.ok(Math.abs(h.brightnessPercent-controlPercent(.2))<1e-9);
  h.setReaderAutomaticBrightness(); reads.at(-1).resolve('51'); await flush();
  assert.ok(Math.abs(writes.at(-1).value-.2)<1e-9);
  h.setReaderAutomaticBrightness(); assert.equal(writes.at(-1).value,-1, 'rapid second tap reverses pending manual intent');
  const newest=writes.at(-1); newest.resolve({applied:true,value:-1}); await h.brightnessMutationQueue;
  assert.equal(h.brightnessAutomatic,true); assert.equal(h.brightnessAutomaticIntent,undefined);
  h.setReaderBrightness(75); const request=writes.at(-1); assert.ok(request.value<.28);
  reads.at(-1).resolve('255'); await flush();
  assert.ok(h.brightnessPercent<100, 'late automatic read cannot override a newer manual drag');
  request.resolve({applied:true,value:request.value}); await h.brightnessMutationQueue;
  assert.equal(h.brightnessAutomatic,false); assert.ok(Math.abs(h.brightnessPercent-75)<.00002);
  h.setReaderAutomaticBrightness(); writes.at(-1).reject(Error('native failure')); await h.brightnessMutationQueue;
  assert.equal(h.brightnessAutomatic,false); assert.equal(h.brightnessAutomaticIntent,undefined);
}
{
  const h=fresh();h.refreshSystemBrightness(1);h.mounted=false;reads.at(-1).resolve('255');await flush();
  assert.equal(h.brightnessPercent,50, 'unmounted observer cannot publish');
}

// Entering Auto with its initial read pending must not use the default rail.
{
  const h=fresh(); const before=writes.length;
  h.refreshSystemBrightness(1); const observation=reads.at(-1), readCount=reads.length;
  h.setReaderAutomaticBrightness(); assert.equal(reads.length,readCount,'reuse the in-flight system sample');
  assert.equal(writes.length,before,'never apply the unobserved default');
  observation.resolve('204'); await flush();
  assert.equal(writes.at(-1).value,.8,'manual begins at the observed system setting');
}
{
  const h=fresh(); h.refreshSystemBrightness(1); const observation=reads.at(-1);
  h.setReaderAutomaticBrightness(); h.setReaderAutomaticBrightness();
  const before=writes.length;assert.equal(writes.at(-1).value,-1);
  observation.resolve('204');await flush();assert.equal(writes.length,before,'second tap cancels an awaiting manual intent');
}
{
  const h=fresh(); h.setReaderAutomaticBrightness(); reads.at(-1).reject(Error('Settings unavailable'));await flush();
  assert.equal(writes.at(-1).value,windowValue(50),'failed observation uses the last valid control level');
}

{
  const h=fresh(); h.setReaderAutomaticBrightness(); const sample=reads.at(-1), revision=h.brightnessRequestGeneration;
  h.refreshReaderBrightness(); await flush();
  assert.equal(h.brightnessRequestGeneration,revision,'reopening controls only observes, without cancelling user intent');
  sample.resolve('204');await flush();assert.equal(writes.at(-1).value,.8);
  const requested=writes.at(-1);requested.resolve({applied:true,value:.8});await h.brightnessMutationQueue;
  assert.equal(h.brightnessAutomatic,false);assert.equal(h.brightnessAutomaticIntent,undefined);
}

// Real SDK paint calls: 24vp input surface surrounds one clipped 8vp track;
// the low fill has no independent radius that can protrude beyond that track.
const native=new Proxy({}, {get:()=>()=>{}});
const {owner}=createReaderBuilderProbe(readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets',import.meta.url),'utf8'),
  ['brightnessRail'],{...geometry,Gesture:native,GestureGroup:native,PanGesture:native,TapGesture:native,
    GesturePriority:{Low:0},GestureMode:{Exclusive:1},PanDirection:{Vertical:1}});
Object.assign(owner,{appScheme:'day',brightnessAutomatic:true,effectiveBrightnessPercent:()=>1});
const oldGesture=globalThis.Gesture;
globalThis.Gesture=native;
try {owner.brightnessRail();} finally {if(oldGesture===undefined)delete globalThis.Gesture;else globalThis.Gesture=oldGesture;}
const clip=[...owner.nodes.values()].find(n=>n.type==='Stack'&&n.width===8&&n.clip===true);
assert.ok(clip);assert.equal(clip.borderRadius,4);
const fill=[...owner.nodes.values()].find(n=>n.type==='Row'&&n.height==='1%');
assert.ok(fill);assert.equal(fill.borderRadius,undefined);
assert.ok([...owner.nodes.values()].some(n=>n.width===24&&n.height===92));
console.log('PASS brightness: HLG low-range allocation, 991 inverse samples, two-way pending toggle, system observation races, and SDK shared track clip');

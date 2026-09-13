import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildReaderSessionLaunchGeometry, readerSessionLaunchDesign, sampleReaderSessionLaunch } from '../entry/src/main/ets/features/reading/ReaderSessionLaunchPresentation.ts';
import { ReaderSessionLaunchController } from '../entry/src/main/ets/features/reading/ReaderSessionLaunchController.ts';
import { ReaderSessionMorphSourceMeasurement } from '../entry/src/main/ets/features/reading/ReaderSessionMorphState.ts';
import { readerAppearanceCubicBezierProgress as bezier } from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts';

const curves = { flight:p=>bezier(p,.4,0,.2,1), expand:p=>bezier(p,.2,0,0,1),
  easeIn:p=>bezier(p,.42,0,1,1), easeOut:p=>bezier(p,0,0,.58,1), easeInOut:p=>bezier(p,.42,0,.58,1) };
const archive = JSON.parse(await readFile(new URL('../evidence/2026-09-13-current-gap-register/capsule-figma-live.json', import.meta.url), 'utf8'));
const kinds = ['quickAutoPage','quickTts','fullAutoPagePlayback','fullTtsPlayback'];

// Test-only reader for the archived CSS output, independent of the production
// sampler. Compare every authored actor/property, not a hand-copied timing table.
function tracks(actor) {
  const result = new Map();
  for (const match of actor.codeSnippets.css.matchAll(/@keyframes (\w+) \{ ((?:\s*[\d.]+% \{[^}]*\}\s*)+)\}/g)) {
    const property = match[1].match(/_(height|width|opacity|translate|scale)_0$/)[1];
    result.set(property, [...match[2].matchAll(/([\d.]+)% \{([^}]*)\}/g)].map(frame => {
      const raw = frame[2].match(new RegExp(`(?:^|;)\\s*${property}: ([^;]+);`))[1];
      return { time:Math.round(Number(frame[1])*35), values:raw.split(' ').map(parseFloat),
        easing:frame[2].match(/animation-timing-function: ([^;]+);/)?.[1] ?? 'linear' };
    }));
  }
  assert.ok(result.size > 0, `CSS keyframes missing for ${actor.nodeId}`);
  return result;
}
function ease(progress, name) {
  if (name==='linear') return progress;
  if (name==='step-end') return progress>=1?1:0;
  if (name==='ease-in') return curves.easeIn(progress);
  if (name==='ease-out') return curves.easeOut(progress);
  if (name==='ease-in-out') return curves.easeInOut(progress);
  const match=name.match(/cubic-bezier\(([^)]+)\)/);assert.ok(match,name);
  return bezier(progress,...match[1].split(',').map(Number));
}
function cssSample(frames,time) {
  if(time<=frames[0].time)return frames[0].values;
  for(let i=1;i<frames.length;i++){
    if(time>frames[i].time)continue;
    const a=frames[i-1],b=frames[i],p=ease((time-a.time)/(b.time-a.time),a.easing);
    return a.values.map((v,k)=>v+(b.values[k]-v)*p);
  }
  return frames.at(-1).values;
}
function projected(actor,s) {
  const n=actor.nodeName;
  if(n.startsWith('ImmersiveInfo'))return {opacity:[s.immersiveOpacity]};
  if(n.startsWith('PageLabel'))return {opacity:[s.footerOpacity],translate:[s.footerTranslateX,0]};
  if(n.startsWith('TopBar'))return {translate:[0,s.topBarOffsetY]};
  if(n.startsWith('DockShell')||n.startsWith('FullPanel'))return {translate:[0,s.dockOffsetY]};
  if(n.startsWith('TriggerMorphProxy'))return {width:[s.proxyWidth],height:[s.proxyHeight],translate:[s.proxyLeft,s.proxyTop]};
  if(n.startsWith('MorphSurface'))return {width:[s.proxyWidth],height:[s.proxyHeight],opacity:[s.canonicalSurfaceOpacity]};
  if(n.startsWith('SourceRegion'))return {width:[s.proxyWidth],height:[s.proxyHeight],opacity:[s.sourceSurfaceOpacity]};
  if(n.startsWith('CapsuleContent'))return {width:[s.proxyWidth],height:[s.proxyHeight]};
  if(n.startsWith('CapsuleTransitionContent'))return {opacity:[s.leadingOpacity],translate:[s.leadingOffsetX,0]};
  if(n.startsWith('CircleState'))return {opacity:[s.pauseOpacity],translate:[s.pauseX-4,0]};
  return {opacity:[n.includes('blurred')?s.blurOpacity:s.sharpOpacity],
    scale:[s.sourceContentScale,s.sourceContentScale],translate:[s.sourceContentTranslateX,s.sourceContentTranslateY]};
}
let comparisons=0,actors=0;
const geometries=[];
for (const [i,scene] of archive.nodes.entries()) {
  const nodes=JSON.parse(scene.motionContext.content[0].text).nodes.filter(n=>!n.nodeName.startsWith('Review'));
  assert.equal(nodes.length,12);actors+=nodes.length;
  const proxy=tracks(nodes.find(n=>n.nodeName.startsWith('TriggerMorphProxy')));
  const source=new ReaderSessionMorphSourceMeasurement(kinds[i],`source-${i}`,0,0,
    proxy.get('width')[0].values[0],proxy.get('height')[0].values[0],1);
  const target=proxy.get('translate').at(-1).values;
  const top=tracks(nodes.find(n=>n.nodeName.startsWith('TopBar'))).get('translate').at(-1).values[1];
  const dock=tracks(nodes.find(n=>n.nodeName.startsWith('DockShell')||n.nodeName.startsWith('FullPanel'))).get('translate').at(-1).values[1];
  const geometry=buildReaderSessionLaunchGeometry({source,targetLeft:target[0],targetTop:target[1],topBarExitDistance:-top,dockExitDistance:dock});
  assert.ok(geometry);geometries.push(geometry);
  const times=new Set(Array.from({length:351},(_,i)=>i*10));
  for(const t of [0,100,200,500,600,700,900,1100,1200,1400,1700,2300,3500])for(const d of [-1,0,1])if(t+d>=0&&t+d<=3500)times.add(t+d);
  for(const actor of nodes){
    const authored=tracks(actor);
    for(const time of times){
      const actual=projected(actor,sampleReaderSessionLaunch(time,geometry,curves));
      for(const [property,frames]of authored){
        const expected=cssSample(frames,time);
        // PH10 user override: keep the archived timeline, constrain the footer
        // to the left of the shell where both occupy the bottom information lane.
        if(actor.nodeName.startsWith('PageLabel') && property==='translate' && time>=1400)
          expected[0]=Math.min(expected[0],sampleReaderSessionLaunch(time,geometry,curves).proxyLeft-geometry.targetLeft);
        assert.equal(actual[property]?.length,expected.length);
        expected.forEach((v,k)=>{assert.ok(Math.abs(actual[property][k]-v)<.00001,
          `${scene.nodeId}/${actor.nodeId} ${property}[${k}] at ${time}: ${actual[property][k]} != ${v}`);comparisons++;});
      }
    }
  }
  // Right edge and independent pause stay fixed through the complete expansion.
  for(let t=1400;t<=3500;t+=7){const s=sampleReaderSessionLaunch(t,geometry,curves);
    assert.ok(Math.abs(s.proxyLeft+s.proxyWidth-target[0]-geometry.capsuleWidth)<1e-9);
    assert.ok(Math.abs(s.proxyLeft+s.pauseX-(target[0]+geometry.capsuleWidth-20))<1e-9);
  }
  const dot=sampleReaderSessionLaunch(1500,geometry,curves);assert.equal(dot.pauseOpacity,1);assert.equal(dot.leadingOpacity,0);
  assert.equal(sampleReaderSessionLaunch(1700,geometry,curves).leadingOpacity,1);
  assert.deepEqual(sampleReaderSessionLaunch(1,geometry,curves,true),sampleReaderSessionLaunch(3500,geometry,curves));
}
assert.equal(actors,48);

const g=geometries[0];
const identity={lifecycle:1,bookIdentity:'book-a',moduleVisit:2,viewportRevision:1,scrollRevision:2,
  layoutRevision:3,paletteRevision:4,fontRevision:5,sourceRevision:g.sourceRevision,sourceActorId:g.sourceActorId};
for(const delay of [0,100,1000]){
  const c=new ReaderSessionLaunchController(curves,1);const t=c.begin(identity,g,10000);
  assert.equal(t.businessStatus,'preparing');assert.equal(t.sample.sharpOpacity,1);assert.equal(t.sample.proxyWidth,g.sourceWidth);
  assert.equal(c.begin(identity,g,10001),t,'duplicate click is idempotent');
  c.advance(t.generation,10000+delay);const pose=c.snapshot().sample;
  c.acknowledgeBusiness(t.generation,'playing');assert.equal(c.snapshot().sample,pose,'business ACK cannot replay motion');
  c.advance(t.generation,10000);assert.equal(c.snapshot().sample.timeMs,delay,'clock cannot run backwards');
}
const c=new ReaderSessionLaunchController(curves,1);let t=c.begin(identity,g,0);
c.setDesiredPlaying(t.generation,false);assert.equal(c.mayStartBusiness(t.generation),false);
assert.equal(c.snapshot().businessStatus,'preparing');assert.equal(c.acknowledgeBusiness(t.generation,'playing'),false);
assert.equal(c.acknowledgeBusiness(t.generation,'paused'),true);
c.setDesiredPlaying(t.generation,true);assert.equal(c.mayStartBusiness(t.generation),true);
let releases=0;const resource=()=>({release:()=>releases++});
assert.equal(c.admitPreparedResource(t.generation,identity,resource(),286,196,286*196),true);
c.advance(t.generation,1300);const frozen=c.cancel('openControl');
assert.equal(frozen.ownership,'handoffPending');assert.equal(releases,0,'source retained until new owner is ready');
assert.equal(c.acknowledgeBusiness(t.generation,'playing'),false);
c.advance(t.generation,3500);assert.equal(c.snapshot().sample,frozen.sample,'handoff never jumps to endpoint');
assert.equal(c.confirmHandoffReady(t.generation),true);assert.equal(releases,0);
assert.equal(c.snapshot().ownership,'exitPending');
assert.equal(c.finishExit(t.generation),true);assert.equal(releases,1);
assert.equal(c.finishExit(t.generation),false);assert.equal(releases,1);
assert.equal(c.confirmHandoffReady(t.generation),false);assert.equal(releases,1);
assert.equal(c.admitPreparedResource(t.generation,identity,resource(),286,196,286*196),false);assert.equal(releases,2);
t=c.begin(identity,g,4000);assert.equal(c.admitPreparedResource(t.generation,{...identity,fontRevision:999},resource(),1,1,1),false);
assert.equal(c.admitPreparedResource(t.generation,identity,resource(),0,1,1),false);
assert.equal(c.admitPreparedResource(t.generation,identity,resource(),10,10,99),false);
assert.equal(c.admitPreparedResource(t.generation,identity,resource(),10,10,100),true);
const before=releases;c.advance(t.generation,5400);assert.equal(releases,before+1);
c.advance(t.generation,7500);c.dispose();assert.equal(releases,before+1,'terminal cleanup cannot double release');
for(const reason of ['stop','failure','stopBarrierFailure','background','leave','bookChanged','sourceChanged']){
 const r=new ReaderSessionLaunchController(curves,1),old=r.begin(identity,g,0);r.advance(old.generation,800);
 const cancelled=r.cancel(reason);assert.equal(r.mayStartBusiness(old.generation),false);
 assert.equal(r.acknowledgeBusiness(old.generation,'playing'),false);assert.equal(cancelled.sample.timeMs,800);
 const next=r.begin({...identity,moduleVisit:3},g,1000);assert.notEqual(old.generation,next.generation);
 assert.equal(r.acknowledgeBusiness(old.generation,'playing'),false,'late success cannot revive old generation');
}
const reduce=new ReaderSessionLaunchController(curves,1);const reduced=reduce.begin(identity,g,0);
reduce.advance(reduced.generation,500);reduce.setReduceMotion(true);assert.equal(reduce.snapshot().sample.timeMs,3500);
reduce.setReduceMotion(false);reduce.advance(reduced.generation,700);assert.equal(reduce.snapshot().sample.timeMs,3500);
// Invalid measurement or changed source actor cannot silently fly from stale geometry.
assert.equal(reduce.begin({...identity,sourceRevision:99},g,1000),undefined);
assert.equal(buildReaderSessionLaunchGeometry({source:new ReaderSessionMorphSourceMeasurement('quickAutoPage','x',0,0,0,20,1),targetLeft:1,targetTop:1,topBarExitDistance:73,dockExitDistance:350}),undefined);
for(const kind of kinds){const d=readerSessionLaunchDesign(kind);
 const responsive=buildReaderSessionLaunchGeometry({source:new ReaderSessionMorphSourceMeasurement(kind,'r',10,20,d.width*1.25,d.height,1),targetLeft:500,targetTop:900,capsuleWidth:d.capsuleWidth+20,topBarExitDistance:91,dockExitDistance:501});
 const sample=sampleReaderSessionLaunch(3500,responsive,curves);assert.equal(sample.proxyWidth,d.capsuleWidth+20);
 assert.ok(Math.abs(sample.sourceContentScale-d.contentScale/1.25)<1e-10);
 assert.equal(sample.topBarOffsetY,-91);assert.equal(sample.dockOffsetY,501);
}
console.log(`reader session launch: PASS (${actors} archived Figma actors, ${comparisons} property comparisons; ownership/ACK/release/Reduce Motion)`);

// A source partly outside its retained Scroll viewport must not reveal clipped
// lines/borders at first takeover. Empty/stale clip data never creates a proxy.
{
 const source = new ReaderSessionMorphSourceMeasurement('fullTtsPlayback','clip',12,40,312,128,3,0,24,300,128,14);
 const g=buildReaderSessionLaunchGeometry({source,targetLeft:240,targetTop:760,topBarExitDistance:80,dockExitDistance:700});
 assert.ok(g);
 const first=sampleReaderSessionLaunch(0,g,curves),last=sampleReaderSessionLaunch(1400,g,curves);
 assert.equal(first.sourceClipTop,24);assert.equal(first.sourceClipRightInset,12);assert.equal(first.sourceRadius,14);
 assert.equal(last.sourceClipTop,0);assert.equal(last.sourceClipRightInset,0);
 const bad=new ReaderSessionMorphSourceMeasurement('fullTtsPlayback','clip',12,40,312,128,3,0,130,312,128);
 assert.equal(buildReaderSessionLaunchGeometry({source:bad,targetLeft:240,targetTop:760,topBarExitDistance:80,dockExitDistance:700}),undefined);
}

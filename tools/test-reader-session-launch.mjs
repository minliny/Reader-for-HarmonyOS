import assert from 'node:assert/strict';
import { buildReaderSessionLaunchGeometry, readerSessionLaunchDesign, sampleReaderSessionLaunch } from '../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts';
import { ReaderSessionLaunchController } from '../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchController.ts';
import { ReaderSessionMorphSourceMeasurement } from '../entry/src/main/ets/features/reading/ui/ReaderSessionMorphState.ts';
import { readerProbeCubicBezierProgress as bezier } from './lib/reader-motion-curve-fixture.mjs';

const standard = p => bezier(p, .2, 0, 0, 1);
const curves = { flight: standard, expand: standard, easeOut: p => bezier(p, 0, 0, .58, 1) };
const kinds = ['quickAutoPage', 'quickTts', 'fullAutoPagePlayback', 'fullTtsPlayback'];
const geometries = [];
for (const kind of kinds) {
  const design = readerSessionLaunchDesign(kind);
  const source = new ReaderSessionMorphSourceMeasurement(kind, 'source-' + kind, 18, 420,
    design.width, design.height, 1);
  const geometry = buildReaderSessionLaunchGeometry({ source, targetLeft: 246, targetTop: 760,
    topBarExitDistance: 80, dockExitDistance: design.dockExitDistance });
  assert.ok(geometry);
  geometries.push(geometry);

  const sampleAt = time => sampleReaderSessionLaunch(time, geometry, curves);
  const first = sampleAt(0);
  assert.deepEqual([first.proxyLeft, first.proxyTop, first.proxyWidth, first.proxyHeight],
    [source.left, source.top, source.width, source.height]);
  assert.equal(first.phase, 'flight');
  assert.equal(first.sourceSurfaceOpacity, 1);
  assert.equal(first.canonicalSurfaceOpacity, 0);
  assert.equal(first.pauseOpacity, 0);
  assert.equal(sampleAt(80).flight > 0, true, 'flight starts immediately');

  const expansionStart = sampleAt(160);
  assert.equal(expansionStart.phase, 'overlap');
  assert.equal(expansionStart.expansion, 0);
  const overlap = sampleAt(190);
  assert.ok(overlap.flight > 0 && overlap.flight < 1);
  assert.ok(overlap.expansion > 0 && overlap.expansion < 1);
  assert.ok(overlap.leadingOpacity > 0);
  assert.equal('blurRadius' in overlap, false);

  const arrival = sampleAt(220);
  assert.equal(arrival.phase, 'expand');
  assert.equal(arrival.flight, 1);
  assert.ok(arrival.expansion > 0 && arrival.expansion < 1);
  assert.equal(arrival.controlsPresented, false);
  assert.equal(arrival.sourceNeeded, false);
  for (let time = 220; time < 380; time += 7) {
    const frame = sampleAt(time);
    assert.ok(Math.abs(frame.proxyLeft + frame.proxyWidth - 246 - design.capsuleWidth) < 1e-9);
    assert.ok(Math.abs(frame.proxyLeft + frame.pauseX - (246 + design.capsuleWidth - 20)) < 1e-9);
    assert.ok(frame.footerTranslateX <= frame.proxyLeft - 246 + 1e-9);
  }

  assert.equal(sampleAt(379).finished, false);
  const final = sampleAt(380);
  assert.equal(final.phase, 'settled');
  assert.equal(final.finished, true);
  assert.deepEqual([final.proxyLeft, final.proxyTop, final.proxyWidth, final.proxyHeight],
    [246, 760, design.capsuleWidth, 24]);
  assert.deepEqual(sampleReaderSessionLaunch(0, geometry, curves, true), final,
    'reduced motion starts from static capsule geometry');
}

const g=geometries[0];
const identity={lifecycle:1,bookIdentity:'book-a',moduleVisit:2,viewportRevision:1,scrollRevision:2,
  layoutRevision:3,paletteRevision:4,fontRevision:5,sourceRevision:g.sourceRevision,sourceActorId:g.sourceActorId};
for(const delay of [0,100,300]){
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
c.advance(t.generation,190);const frozen=c.cancel('openControl');
assert.equal(frozen.ownership,'handoffPending');assert.equal(releases,0,'source retained until new owner is ready');
assert.equal(c.acknowledgeBusiness(t.generation,'playing'),false);
c.advance(t.generation,380);assert.equal(c.snapshot().sample,frozen.sample,'handoff never jumps to endpoint');
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
const before=releases;c.advance(t.generation,4220);assert.equal(releases,before+1);
c.advance(t.generation,4380);c.dispose();assert.equal(releases,before+1,'terminal cleanup cannot double release');
for(const reason of ['stop','failure','stopBarrierFailure','background','leave','bookChanged','sourceChanged']){
 const r=new ReaderSessionLaunchController(curves,1),old=r.begin(identity,g,0);r.advance(old.generation,180);
 const cancelled=r.cancel(reason);assert.equal(r.mayStartBusiness(old.generation),false);
 assert.equal(r.acknowledgeBusiness(old.generation,'playing'),false);assert.equal(cancelled.sample.timeMs,180);
 const next=r.begin({...identity,moduleVisit:3},g,1000);assert.notEqual(old.generation,next.generation);
 assert.equal(r.acknowledgeBusiness(old.generation,'playing'),false,'late success cannot revive old generation');
}
const reduce=new ReaderSessionLaunchController(curves,1);const reduced=reduce.begin(identity,g,0);
reduce.advance(reduced.generation,140);reduce.setReduceMotion(true);assert.equal(reduce.snapshot().sample.timeMs,380);
reduce.setReduceMotion(false);reduce.advance(reduced.generation,700);assert.equal(reduce.snapshot().sample.timeMs,380);
// Invalid measurement or changed source actor cannot silently fly from stale geometry.
assert.equal(reduce.begin({...identity,sourceRevision:99},g,1000),undefined);
assert.equal(buildReaderSessionLaunchGeometry({source:new ReaderSessionMorphSourceMeasurement('quickAutoPage','x',0,0,0,20,1),targetLeft:1,targetTop:1,topBarExitDistance:73,dockExitDistance:350}),undefined);
for(const kind of kinds){const d=readerSessionLaunchDesign(kind);
 const responsive=buildReaderSessionLaunchGeometry({source:new ReaderSessionMorphSourceMeasurement(kind,'r',10,20,d.width*1.25,d.height,1),targetLeft:500,targetTop:900,capsuleWidth:d.capsuleWidth+20,topBarExitDistance:91,dockExitDistance:501});
 const sample=sampleReaderSessionLaunch(380,responsive,curves);assert.equal(sample.proxyWidth,d.capsuleWidth+20);
 assert.ok(Math.abs(sample.sourceContentScale-d.contentScale/1.25)<1e-10);
 assert.equal(sample.topBarOffsetY,-91);assert.equal(sample.dockOffsetY,501);
}
console.log(`reader session launch: PASS (four 380ms source paths; native geometry, ownership, ACK, release, reduced-motion endpoints)`);

// A source partly outside its retained Scroll viewport must not reveal clipped
// lines/borders at first takeover. Empty/stale clip data never creates a proxy.
{
 const source = new ReaderSessionMorphSourceMeasurement('fullTtsPlayback','clip',12,40,312,128,3,0,24,300,128,14);
 const g=buildReaderSessionLaunchGeometry({source,targetLeft:240,targetTop:760,topBarExitDistance:80,dockExitDistance:700});
 assert.ok(g);
 const first=sampleReaderSessionLaunch(0,g,curves),last=sampleReaderSessionLaunch(220,g,curves);
 assert.equal(first.sourceClipTop,24);assert.equal(first.sourceClipRightInset,12);assert.equal(first.sourceRadius,14);
 assert.equal(last.sourceClipTop,0);assert.equal(last.sourceClipRightInset,0);
 const bad=new ReaderSessionMorphSourceMeasurement('fullTtsPlayback','clip',12,40,312,128,3,0,130,312,128);
 assert.equal(buildReaderSessionLaunchGeometry({source:bad,targetLeft:240,targetTop:760,topBarExitDistance:80,dockExitDistance:700}),undefined);
}

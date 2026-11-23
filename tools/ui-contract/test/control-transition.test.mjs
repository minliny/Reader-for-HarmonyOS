import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { jsonDigest } from '../lib/evidence.mjs';
import { evaluateMotion } from '../lib/motion.mjs';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { easedFraction, sampledRebaseAxis } from '../lib/control-transition.mjs';

test('ArkUI control ease reproduces the sampled first rebase pose', () => {
  // The native runtime published this progress at elapsed 16 ms / 220 ms.
  assert.equal(easedFraction(16 / 220), 0.07191753387451172);
  assert.equal(easedFraction(0), 0);
  assert.equal(easedFraction(1), 1);
});

const caseDefinition = JSON.parse(readFileSync(new URL('../cases/reading.control-search-morph-back.json', import.meta.url), 'utf8'));
const contract = caseDefinition.assertions.find(assertion => assertion.id.endsWith('.expand'));
const readingId = 'reading-1';
const transitionId = 'morph-2';
const instanceId = 'public-fixture-instance';
const idMatrix = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const root = { uniqueId: 101, clipToFrame: false };
const dock = { uniqueId: 102, parentUniqueId: 101, clipToFrame: false };
const clip = { uniqueId: 105, parentUniqueId: 102, clipToFrame: true, measuredSizeVp: { x:13, y:240, width:300, height:255 } };
const intermediary = { uniqueId: 107, parentUniqueId: 105, clipToFrame: false };
const content = { uniqueId: 106, parentUniqueId: 107, clipToFrame: false };
const layoutInputs = { dockLeftVp: 10, dockTopVp: 20, widthVp: 364, fullHeightVp: 740, quickHeightVp: 330,
  quickContentHeightVp: 190, fullContentHeightVp: 670, fullContentTopVp: 57 };

function nativeActor(id, uniqueId, rect, ancestors, { clipToFrame = false, radius, zIndex = 0 } = {}) {
  const [x,y,width,height] = rect;
  return { id, uniqueId, mounted:true, parentUniqueId:ancestors[0].uniqueId, layoutRectVp:{ x,y,width,height },
    windowOriginVp:{ x,y }, translateVp:{ x:0,y:0,z:0 },
    scale:{ x:1,y:1,z:1,centerX:0,centerY:0 }, rotation:{ x:0,y:0,z:1,centerX:0,centerY:0,angle:0 },
    matrix:[...idMatrix], opacity:1, clipToFrame, borderRadiusVp:radius, zIndex, ancestors,
    ancestorChainComplete:true, inspectorSource:'FrameNode.getInspectorInfo' };
}

function motionFrame(index, elapsedMs, tickMs, options = {}) {
  const { durationMs = 320, from = 0, to = 1, epoch = 5, ticket = 10, endpoint = index === 3,
    frameTimeNs = 1e6 * (index + 1) * 100, contentLocation = contract.expected.target, dockTopVp = 20,
    runtimeLayoutOffsetVp = 0 } = options;
  const t = Math.min(1, elapsedMs / durationMs);
  const p = from + (to - from) * t * t * (3 - 2 * t);
  const y = dockTopVp + 410 * (1 - p) + runtimeLayoutOffsetVp;
  const body = [23, y + 29 + 28 * p, 286 + 52 * p, 190 + 480 * p];
  const contentClip = nativeActor('reader-control-motion-content-clip', 105, body, [dock,root],
    { clipToFrame:true, radius:8 + 4 * p });
  return {
    index, phase:index === 0 ? 'start' : endpoint ? 'endpoint' : 'progress',
    frameTimeNs, captureStartMs:tickMs, captureEndMs:tickMs + 1,
    runtimeTickMs:tickMs, runtimeElapsedMs:elapsedMs, runtimeDurationMs:durationMs, runtimeEpoch:epoch, runtimeTicket:ticket,
    runtimeLayoutOffsetVp, density:1, expansionProgress:p, visibilityProgress:1, layoutInputs:{...layoutInputs,dockTopVp},
    content:contentLocation, contentClip,
    mountedContent:nativeActor('reader-control-module-search', 108, body, [content,intermediary,clip,dock,root]),
    actors:[
      nativeActor('reader-control-motion-dock', 102, [10,dockTopVp,364,740], [root]),
      nativeActor('reader-control-motion-shell', 103, [10,y,364,330 + 410 * p], [dock,root]),
      nativeActor('reader-control-motion-grabber', 104, [156,y,72,28], [dock,root], { zIndex:3 }),
      nativeActor('reader-control-content-host', 106, body, [intermediary,clip,dock,root]),
    ],
  };
}

function sample(sequence, full) {
  const node = { visible:true, opacity:1, enabled:true };
  const whole = { left:0, top:0, width:390, height:840 };
  return {
    instanceId, beforeSeq:sequence, afterSeq:sequence, window:{ id:'same-window', density:1, rectPx:whole },
    nodes:[
      { ...node, id:'reader-reading-stage', rectPx:whole },
      { ...node, id:'reader-control-motion-dock' },
      { ...node, id:'reader-control-module-search' },
      { ...node, id:'reader-control-collapse', enabled:full },
    ],
  };
}

function makeFixture() {
  const event = (eventSeq, kind, payload, channel = 'business') =>
    ({ eventSeq, kind, channel, instanceId, payload:{ readingId, ...payload } });
  const { source, target } = contract.expected;
  const state = { epoch:5, heldPointerId:-1, transition:'', openRevision:1, closeRevision:0 };
  const blocks = [
    motionFrame(0,0,100), motionFrame(1,100,200), motionFrame(2,200,320), motionFrame(3,320,320),
  ].map((frame, i) => event(30 + i, 'reading.control-motion', {
    transitionId, direction:'morph', origin:'grabber-release', epoch:5, blockIndex:i, blockCount:4, finalBlock:i === 3,
    frameStart:i, frameEnd:i, endReason:'completed', droppedSamples:0, frames:[frame], target,
  }, 'motion'));
  const request = event(21, 'reading.control-transition-requested', {
    transitionId, origin:'grabber-release', direction:'morph', source, target, durationMs:320,
    accepted:{ ...state, transition:'morph' }, before:{ ...state, epoch:4, heldPointerId:6 },
    transition:{ kind:'morph', from:{ expansionProgress:0, visibilityProgress:1 },
      to:{ expansionProgress:1, visibilityProgress:1 }, progress:0, startProgress:0, targetProgress:1, durationMs:320 },
  });
  const context = {
    actions:{ 'enter-reading':{ beforeSeq:4, afterSeq:12 },
      expand:{ instanceId, beforeSeq:20, afterSeq:40, actionId:'observed-expand', op:'click' } },
    samples:{ 'enter-search-state':sample(19, false), 'expand-state':sample(41, true) },
    candidate:{ ownerSources:Object.fromEntries(caseDefinition.ownerSources.map(path => [path,'a'.repeat(64)])) },
    events:[
      event(8, 'reading.ready', { mode:'paged', localBook:true, reduceMotion:false }),
      request,
      event(27, 'reading.control-transition-committed', { transitionId, state, target }),
      ...blocks,
    ],
  };
  return { context, blocks };
}

test('normal expand recomputes geometry and native mounting from the multi-frame controls', () => {
  const { context } = makeFixture();
  const result = evaluateMotion(contract, context);
  assert.equal(result.verdict, 'PASS', JSON.stringify(result.actual));
  assert.equal(result.observationsComplete, true);
});

test('partial transition observations produce JSON-safe missing diagnostics', () => {
  const { context } = makeFixture();
  const commit = context.events.find(event => event.kind === 'reading.control-transition-committed');
  delete commit.payload.state.closeRevision;
  const result = evaluateMotion(contract, context);
  assert.notEqual(result.verdict, 'PASS');
  assert.equal(typeof jsonDigest(result.actual), 'string');
});

function makeRebaseFixture(elapsedAtRebase = 60) {
  const { context } = makeFixture();
  const request = context.events[1];
  context.actions.expand.afterSeq = 100;
  context.samples['expand-state'] = sample(101,true);
  request.deviceMonoMs = 100;

  const axis = dockTop => ({
    fullGrabberScreenY:dockTop + 9, quickGrabberScreenY:dockTop + 419, hiddenGrabberScreenY:dockTop + 437,
  });
  const transition = request.payload.transition;
  const elapsedFraction = elapsedAtRebase / 320;
  const beforeProgress = (3 - 2 * elapsedFraction) * elapsedFraction ** 2;
  const anchor = axis(20).quickGrabberScreenY - 410 * beforeProgress;
  const afterProgress = (axis(30).quickGrabberScreenY - anchor) / 410;
  const durationMs = 320 - elapsedAtRebase;
  const stopped = {offsetY:0,startOffsetY:0,elapsedMs:0,durationMs:0,running:false,revision:0};
  const event = {
    ...request,eventSeq:26,kind:'reading.control-rebased',channel:'motion',deviceMonoMs:166,
    payload:{
      readingId,transitionId,direction:'morph',epoch:5,source:'ReaderControlRuntime.configure',
      fromTicket:10,toTicket:11,beforeTickMs:160,ticketStartTickMs:165,
      rebaseReason:'projected',anchorPreserved:true,
      before:{axis:axis(20),transition:{...transition,elapsedMs:elapsedAtRebase,progress:beforeProgress},
        compensation:stopped,compensatedGrabberScreenY:anchor},
      after:{axis:axis(30),transition:{...transition,progress:afterProgress,startProgress:afterProgress,elapsedMs:0,durationMs},
        compensation:{...stopped,revision:1},compensatedGrabberScreenY:anchor},
    },
  };
  const frames = [
    motionFrame(0,0,120,{endpoint:false}), motionFrame(1,20,160,{endpoint:false}),
  ];
  let elapsed = 0;
  let previousTick = 165;
  for (let tick = 185; elapsed < durationMs; tick += 40) {
    frames.push(motionFrame(frames.length,elapsed,tick,{durationMs,from:afterProgress,ticket:11,dockTopVp:30,endpoint:false}));
    elapsed += tick - previousTick;
    previousTick = tick;
  }
  frames.push(motionFrame(frames.length,elapsed,previousTick,
    {durationMs,from:afterProgress,ticket:11,dockTopVp:30,endpoint:true}));
  const blocks = frames.map((frame,index) => ({
    ...request,eventSeq:30 + index,kind:'reading.control-motion',channel:'motion',
    payload:{readingId,transitionId,direction:'morph',origin:'grabber-release',epoch:5,blockIndex:index,
      blockCount:frames.length,finalBlock:index === frames.length - 1,frameStart:index,frameEnd:index,
      endReason:'completed',droppedSamples:0,target:request.payload.target,frames:[frame]},
  }));
  context.events = [...context.events.slice(0,2),event,...context.events.slice(2,3),...blocks];
  return {context,frames,event,request};
}

test('a Phase 1 rebase detects a coherently forged predecessor position and successor curve', () => {
  assert.equal(evaluateMotion(contract,makeRebaseFixture().context).verdict,'PASS');
  const forged = evaluateMotion(contract,makeRebaseFixture(100).context);
  assert.equal(forged.verdict,'FAIL');
  assert.ok(forged.actual.deviations.some(item => item.field === 'rebase-predecessor-clock'));
});

test('a Phase 1 rebase distinguishes native geometry, a rejected anchor and missing clock evidence', () => {
  const shifted = makeRebaseFixture();
  for (const snapshot of [shifted.event.payload.before,shifted.event.payload.after]) {
    for (const key of Object.keys(snapshot.axis)) snapshot.axis[key] += 64;
    snapshot.compensatedGrabberScreenY += 64;
  }
  const wrongAxis = evaluateMotion(contract,shifted.context);
  assert.equal(wrongAxis.verdict,'FAIL');
  for (const suffix of ['before','after']) {
    assert.ok(wrongAxis.actual.deviations.some(item => item.field === 'rebase-native-axis-' + suffix));
  }
  const rejected = makeRebaseFixture();
  rejected.event.payload.anchorPreserved = false;
  const wrongAnchor = evaluateMotion(contract,rejected.context);
  assert.equal(wrongAnchor.verdict,'FAIL');
  assert.ok(wrongAnchor.actual.deviations.some(item => item.field === 'rebase-spatial-projection'));

  for (const index of [0,2]) {
    const partial = makeRebaseFixture();
    delete partial.frames[index].runtimeTickMs;
    const absentClock = evaluateMotion(contract,partial.context);
    assert.equal(absentClock.verdict,'NOT_RUN',JSON.stringify({index,deviations:absentClock.actual.deviations}));
    assert.ok(absentClock.actual.missing.some(item => item.field === 'rebase-predecessor-clock'));
  }
});

test('a Phase 1 rebase admits the actual runtime projection from previously published ticks', async () => {
  const hooks = registerHooks({resolve(specifier, context, next) {
    return next(specifier.endsWith('/ReaderMotionDurationPolicy') ? specifier + '.ts' : specifier, context);
  }});
  try {
    const base = '../../../entry/src/main/ets/features/reading/ui/';
    const { ReaderControlRuntime } = await import(base + 'ReaderControlRuntime.ts');
    const { createReaderControlSessionState, openReaderControlSession, enterReaderControlModule,
      expandReaderControlSession } = await import(base + 'ReaderControlSessionState.ts');
    const fixture = makeRebaseFixture();
    const config = { axis:fixture.event.payload.before.axis,
      settleDurationMs:320, showDurationMs:220, dismissDurationMs:200, tapMaxDurationMs:500,
      directionSlopVp:8, coordinatedMotion:true };
    let now = 100;
    const runtime = new ReaderControlRuntime(config,() => now);
    const quick = enterReaderControlModule(openReaderControlSession(createReaderControlSessionState(),0),'search',0);
    runtime.start(quick);
    runtime.command(expandReaderControlSession(quick,320));
    for (const tick of [120,160]) runtime.frame(tick,runtime.ticket(),fraction => (3 - 2 * fraction) * fraction ** 2);
    now = 165;
    const projected = runtime.configure({...config,axis:fixture.event.payload.after.axis},true).layoutRebase;
    assert.ok(projected);
    const oldTicket = projected.fromTicket;
    const newTicket = projected.toTicket;
    for (const frame of fixture.frames) frame.runtimeTicket = frame.runtimeTicket === 10 ? oldTicket : newTicket;
    Object.assign(fixture.event.payload,projected,{epoch:fixture.request.payload.accepted.epoch});
    const assessed = evaluateMotion(contract,fixture.context);
    assert.equal(assessed.verdict,'PASS',JSON.stringify(assessed.actual));
  } finally {
    hooks.deregister();
  }
});

test('a Phase 1 rebase uses the transition request clock when its first frame has no predecessor sample', () => {
  const fixture = makeRebaseFixture();
  fixture.frames[0].runtimeTickMs = 160;
  const admitted = evaluateMotion(contract, fixture.context);
  assert.equal(admitted.actual.missing.some(item => item.field === 'rebase-predecessor-clock'), false);

  const rejected = makeRebaseFixture();
  rejected.frames[0].runtimeTickMs = 160;
  rejected.request.deviceMonoMs += 1;
  const denied = evaluateMotion(contract, rejected.context);
  assert.ok(denied.actual.deviations.some(item => item.field === 'rebase-predecessor-clock'));
});

test('a Phase 1 rebase admits integer scheduling between request and first runtime tick', () => {
  const fixture = makeRebaseFixture(5);
  fixture.request.deviceMonoMs = 100;
  fixture.event.deviceMonoMs = 112;
  fixture.event.payload.beforeTickMs = 106;
  fixture.event.payload.ticketStartTickMs = 107;
  const start = fixture.frames[0];
  start.runtimeTickMs = 106;
  start.captureStartMs = 106;
  start.captureEndMs = 107;
  start.actors = start.actors.map(actor => ({ ...actor, mounted:false }));
  start.contentClip = { ...start.contentClip, mounted:false };
  const after = fixture.event.payload.after.transition;
  Object.assign(fixture.frames[1], motionFrame(1, 0, 160, {
    ticket:11, durationMs:after.durationMs, from:after.startProgress, dockTopVp:30, endpoint:false,
  }));
  const admitted = evaluateMotion(contract, fixture.context);
  assert.equal(admitted.actual.deviations.some(item => item.field === 'rebase-predecessor-clock'), false);
  assert.equal(admitted.actual.missing.some(item => item.field === 'rebase-predecessor-clock'), false);

  const forged = makeRebaseFixture(7);
  forged.request.deviceMonoMs = 100;
  forged.event.deviceMonoMs = 112;
  forged.event.payload.beforeTickMs = 106;
  forged.event.payload.ticketStartTickMs = 107;
  const forgedStart = forged.frames[0];
  forgedStart.runtimeTickMs = 106;
  forgedStart.captureStartMs = 106;
  forgedStart.captureEndMs = 107;
  forgedStart.actors = forgedStart.actors.map(actor => ({ ...actor, mounted:false }));
  forgedStart.contentClip = { ...forgedStart.contentClip, mounted:false };
  const forgedAfter = forged.event.payload.after.transition;
  Object.assign(forged.frames[1], motionFrame(1, 0, 160, {
    ticket:11, durationMs:forgedAfter.durationMs, from:forgedAfter.startProgress, dockTopVp:30, endpoint:false,
  }));
  const denied = evaluateMotion(contract, forged.context);
  assert.equal(denied.verdict, 'FAIL');
  assert.ok(denied.actual.deviations.some(item => item.field === 'rebase-predecessor-clock'));
});

test('a Phase 1 rebase derives the first axis from measured layout before its dock mounts', () => {
  const frame = motionFrame(0, 0, 100);
  frame.actors = frame.actors.map(actor => ({ ...actor, mounted:false }));
  assert.deepEqual(sampledRebaseAxis(frame, 18),
    { fullGrabberScreenY:29, quickGrabberScreenY:439, hiddenGrabberScreenY:457 });

  const shifted = { ...frame, layoutInputs:{ ...frame.layoutInputs, quickHeightVp:332 } };
  assert.notDeepEqual(sampledRebaseAxis(shifted, 18), sampledRebaseAxis(frame, 18));

  const later = { ...frame, index:1 };
  assert.equal(sampledRebaseAxis(later, 18), null);
  const notStart = { ...frame, phase:'progress' };
  assert.equal(sampledRebaseAxis(notStart, 18), null);

  const absent = { ...frame };
  delete absent.layoutInputs;
  assert.equal(sampledRebaseAxis(absent, 18), null);
});

const grabberCase = JSON.parse(readFileSync(new URL('../cases/reading.control-grabber-drag.json', import.meta.url), 'utf8'));
const grabberRelease = grabberCase.assertions.find(assertion => assertion.id.endsWith('expand-drag.release'));

function makeReleaseFixture() {
  const { context } = makeFixture();
  const {source, target} = grabberRelease.expected;
  const event = (eventSeq, kind, payload, channel = 'business') =>
    ({ eventSeq, kind, channel, instanceId, payload: { readingId, ...payload } });
  const predecessorId = 'held-4';
  const predecessorState = { epoch:4, heldPointerId:6, transition:'morph', openRevision:1, closeRevision:0 };
  const successorState = { ...predecessorState, epoch:5, heldPointerId:-1 };
  const point = (ticket, expansionProgress, pointerWindowYVp, grabberScreenYVp) => ({
    epoch:4, ticket, heldPointerId:6, expansionProgress, visibilityProgress:1, pointerWindowYVp, grabberScreenYVp,
  });
  const boundary = {
    pointerId:6, upWindowYVp:297.5, before:point(8, .2, 318, 357), held:point(9, .25, 297.5, 336.5),
    released:{ ...point(10, .25, 297.5, 336.5), heldPointerId:-1, epoch:5 },
  };
  const request = event(24, 'reading.control-transition-requested', {
    transitionId, origin:'grabber-release', direction:'morph', source, target, durationMs:240,
    accepted:successorState, before:predecessorState,
    transition:{ kind:'morph', from:{ expansionProgress:0, visibilityProgress:1 },
      to:{ expansionProgress:1, visibilityProgress:1 }, progress:.25, startProgress:.25, targetProgress:1, durationMs:240 },
    releaseMotion:{ travelVp:410, velocityYVpPerSecond:0, boundary },
  });
  request.deviceMonoMs = 88;
  const pointerFrame = motionFrame(7, 0, 75, { from:.2, epoch:4, ticket:8, endpoint:false });
  pointerFrame.phase = 'pointer';
  pointerFrame.heldPointerId = 6;
  const blocks = [0,40,80,120,160,200,240].map((elapsed, i, times) => {
    const endpoint = i === times.length - 1;
    const frame = motionFrame(i, elapsed, endpoint ? 300 : 100 + elapsed,
      { from:.25, durationMs:240, endpoint, frameTimeNs:(100 + elapsed) * 1e6 });
    frame.observationPhase = endpoint ? 'after-endpoint-publication' : 'before-runtime-publication';
    return event(30 + i, 'reading.control-motion', {
      transitionId, direction:'morph', origin:'grabber-release', epoch:5, blockIndex:i, blockCount:times.length,
      finalBlock:endpoint, frameStart:i, frameEnd:i, endReason:'completed', droppedSamples:0, frames:[frame], target,
    }, 'motion');
  });
  context.actions[grabberRelease.action] = { ...context.actions.expand, op:'drag' };
  context.samples[grabberRelease.sample] = context.samples['expand-state'];
  context.candidate.ownerSources = Object.fromEntries(grabberCase.ownerSources.map(path => [path, 'a'.repeat(64)]));
  context.events = [
    context.events[0],
    event(21, 'reading.control-transition-requested', {
      transitionId:predecessorId, origin:'grabber-move', accepted:predecessorState,
    }),
    event(22, 'reading.control-transition-interrupted', {
      transitionId:predecessorId, origin:'grabber-release', epoch:4, successorEpoch:5, successorTarget:target, heldPointerId:-1,
    }),
    request,
    event(26, 'reading.control-motion', {
      transitionId:predecessorId, finalBlock:true, endReason:'interrupted', frames:[pointerFrame],
    }, 'motion'),
    event(27, 'reading.control-transition-committed', {
      transitionId, state:{ ...successorState, transition:'' }, target,
    }),
    ...blocks,
  ];
  return {context, request, boundary, pointerFrame, blocks};
}

const grabberDismissCase = JSON.parse(readFileSync(new URL('../cases/reading.control-grabber-dismiss.json', import.meta.url), 'utf8'));
const dismissFinger = grabberDismissCase.assertions.find(assertion => assertion.id.endsWith('dismiss-drag.finger'));
const dismissRelease = grabberDismissCase.assertions.find(assertion => assertion.id.endsWith('dismiss-drag.release'));

function makeGrabberDismissFixture() {
  const {context} = makeFixture();
  const {source,target} = dismissRelease.expected;
  const event = (eventSeq, kind, payload, channel = 'business') =>
    ({eventSeq,kind,channel,instanceId,payload:{readingId,...payload}});
  const heldId = 'dismiss-held';
  const releaseId = 'dismiss-release';
  const durationMs = 200 * (1 - 10 / 18);
  const transition = {kind:'dismiss',from:{visibilityProgress:1,expansionProgress:0},
    to:{visibilityProgress:0,expansionProgress:0},targetProgress:1};
  const heldState = {epoch:4,heldPointerId:6,transition:'dismiss',openRevision:1,closeRevision:0};
  const releaseState = {...heldState,epoch:5,heldPointerId:-1};
  const makeFrame = (index,tick,visibility,options) => {
    const frame = motionFrame(index,options.elapsed ?? 0,tick,{
      from:0,to:0,epoch:options.held ? 4 : 5,ticket:options.ticket,
      durationMs:options.held ? 320 : durationMs,endpoint:options.endpoint ?? false,
      frameTimeNs:tick*1e6,contentLocation:source,
    });
    frame.visibilityProgress = visibility;
    for (const node of [...frame.actors,frame.contentClip,frame.mountedContent]) {
      node.windowOriginVp.y += 18 * (1-visibility);
    }
    frame.actors[0].opacity = visibility;
    frame.actors[0].translateVp.y = 18 * (1-visibility);
    return frame;
  };
  const point = (ticket,move) => ({epoch:4,ticket,heldPointerId:6,pointerWindowYVp:419+move,
    expansionProgress:0,visibilityProgress:1-move/18,grabberScreenYVp:439+move});
  const boundary = {pointerId:6,upWindowYVp:429,before:point(8,9),held:point(9,10),
    released:{...point(10,10),epoch:5,heldPointerId:-1}};
  const predecessor = event(21,'reading.control-transition-requested',{
    transitionId:heldId,origin:'grabber-move',direction:'dismiss',source,target,durationMs:320,
    before:{...heldState,epoch:3,transition:''},accepted:heldState,
    transition:{...transition,durationMs:320,startProgress:0},
  });
  const request = event(24,'reading.control-transition-requested',{
    transitionId:releaseId,origin:'grabber-release',direction:'dismiss',source,target,durationMs,
    before:heldState,accepted:releaseState,
    transition:{...transition,durationMs,progress:10/18,startProgress:10/18},
    releaseMotion:{travelVp:18,velocityYVpPerSecond:0,boundary},
  });
  request.deviceMonoMs = 95;
  const heldFrames = [5,9].map((movement,index) => Object.assign(
    makeFrame(index,65+index*15,1-movement/18,{held:true,ticket:7+index}), {
      phase:'pointer',observationPhase:'after-pointer-publication',heldPointerId:6,
      pointerStartWindowYVp:419,pointerWindowYVp:419+movement,runtimeProgress:movement/18,
    }));
  const releaseFrames = [0,.25,.5,.75,1].map((fraction,index) => {
    const elapsed = durationMs*fraction;
    const visibility = (1-10/18)*(1-fraction**2*(3-2*fraction));
    const endpoint = fraction === 1;
    return Object.assign(makeFrame(index,100+elapsed,visibility,{ticket:10,elapsed,endpoint}), {
      heldPointerId:-1,continuationSlope:0,
      observationPhase:endpoint ? 'after-endpoint-publication' : 'before-runtime-publication',
    });
  });
  const blocks = (frames,start,sourceRequest,endReason) => frames.map((frame,index) =>
    event(start+index,'reading.control-motion',{
      transitionId:sourceRequest.payload.transitionId,direction:'dismiss',origin:sourceRequest.payload.origin,
      epoch:sourceRequest.payload.accepted.epoch,target,blockIndex:index,blockCount:frames.length,
      finalBlock:index+1 === frames.length,frameStart:index,frameEnd:index,endReason,droppedSamples:0,frames:[frame],
    },'motion'));
  context.actions[dismissRelease.action] = {...context.actions.expand,op:'drag',targetId:'reader-control-motion-grabber'};
  const after = sample(41,false);
  after.nodes.find(node => node.id === 'reader-control-motion-dock').opacity = 0;
  context.samples[dismissRelease.sample] = after;
  context.candidate.ownerSources = Object.fromEntries(grabberDismissCase.ownerSources.map(path => [path,'a'.repeat(64)]));
  context.events = [
    context.events[0],predecessor,
    event(22,'reading.control-transition-interrupted',{transitionId:heldId,origin:'grabber-release',
      epoch:4,successorEpoch:5,successorTarget:target,heldPointerId:-1}),
    request,...blocks(heldFrames,25,predecessor,'interrupted'),
    event(29,'reading.control-transition-committed',{transitionId:releaseId,target,
      state:{...releaseState,transition:'',closeRevision:1}}),
    ...blocks(releaseFrames,30,request,'completed'),
  ];
  return {context,predecessor,pointerFrame:heldFrames.at(-1),boundary,request};
}

test('grabber dismiss receipt proves held Quick visibility and one continuous native release to Hidden', () => {
  const {context} = makeGrabberDismissFixture();
  for (const assertion of [dismissFinger,dismissRelease]) {
    const result = evaluateMotion(assertion,context);
    assert.equal(result.verdict,'PASS',JSON.stringify({missing:result.actual.missing,deviations:result.actual.deviations}));
    assert.equal(result.observationsComplete,true);
  }
});

test('grabber dismiss preserves the pre-publication pointer pose before release rendering', () => {
  const {context,pointerFrame,request} = makeGrabberDismissFixture();
  const release = context.events.find(event => event.payload?.transitionId === request.payload.transitionId &&
    event.kind === 'reading.control-motion');
  const frame = release.payload.frames[0];
  const pointerVisibility = pointerFrame.actors.find(actor => actor.id === 'reader-control-motion-dock').opacity;
  const releaseVisibility = request.payload.releaseMotion.boundary.released.visibilityProgress;
  const pendingVisibility = (pointerVisibility + releaseVisibility) / 2;
  const deltaY = 18 * (frame.visibilityProgress - pendingVisibility);
  for (const node of [...frame.actors,frame.contentClip,frame.mountedContent]) {
    if (node?.windowOriginVp) node.windowOriginVp.y += deltaY;
  }
  const dock = frame.actors.find(actor => actor.id === 'reader-control-motion-dock');
  dock.opacity = pendingVisibility;
  dock.translateVp.y = 18 * (1 - pendingVisibility);

  const result = evaluateMotion(dismissRelease,context);
  assert.equal(result.verdict,'PASS',JSON.stringify({missing:result.actual.missing,deviations:result.actual.deviations}));
  assert.equal(result.actual.trace.releaseBoundary.nativePublication.pending,true);
});

test('grabber dismiss rejects an out-of-order or inconsistent pre-publication pose', () => {
  const setPendingPose = ({context,pointerFrame,request}) => {
    const frame = context.events.find(event => event.payload?.transitionId === request.payload.transitionId &&
      event.kind === 'reading.control-motion').payload.frames[0];
    const pointerVisibility = pointerFrame.actors.find(actor => actor.id === 'reader-control-motion-dock').opacity;
    const releaseVisibility = request.payload.releaseMotion.boundary.released.visibilityProgress;
    const pendingVisibility = (pointerVisibility + releaseVisibility) / 2;
    const deltaY = 18 * (frame.visibilityProgress - pendingVisibility);
    for (const node of [...frame.actors,frame.contentClip,frame.mountedContent]) {
      if (node?.windowOriginVp) node.windowOriginVp.y += deltaY;
    }
    const dock = frame.actors.find(actor => actor.id === 'reader-control-motion-dock');
    dock.opacity = pendingVisibility;
    dock.translateVp.y = 18 * (1 - pendingVisibility);
    return {frame,dock,pendingVisibility};
  };
  for (const mutate of [
    ({context,pointerFrame,request}) => {
      const frame = context.events.find(event => event.payload?.transitionId === request.payload.transitionId &&
        event.kind === 'reading.control-motion').payload.frames[0];
      const pointerVisibility = pointerFrame.actors.find(actor => actor.id === 'reader-control-motion-dock').opacity;
      const releaseVisibility = request.payload.releaseMotion.boundary.released.visibilityProgress;
      const invalid = Math.min(pointerVisibility,releaseVisibility) - .05;
      const deltaY = 18 * (frame.visibilityProgress - invalid);
      for (const node of [...frame.actors,frame.contentClip,frame.mountedContent]) {
        if (node?.windowOriginVp) node.windowOriginVp.y += deltaY;
      }
      const dock = frame.actors.find(actor => actor.id === 'reader-control-motion-dock');
      dock.opacity = invalid;
      dock.translateVp.y = 18 * (1 - invalid);
    },
    state => {
      const {dock} = setPendingPose(state);
      dock.translateVp.y += dismissRelease.expected.trajectory.layoutToleranceVp + .1;
    },
    state => {
      const {frame} = setPendingPose(state);
      frame.frameTimeNs = state.pointerFrame.frameTimeNs;
    },
  ]) {
    const state = makeGrabberDismissFixture();
    mutate(state);
    const result = evaluateMotion(dismissRelease,state.context);
    assert.equal(result.verdict,'FAIL',JSON.stringify({missing:result.actual.missing,deviations:result.actual.deviations}));
  }
});

test('grabber dismiss receipt separates definite wrong paths and missing native observations', () => {
  const missing = makeGrabberDismissFixture();
  delete missing.pointerFrame.pointerStartWindowYVp;
  const gap = evaluateMotion(dismissRelease,missing.context);
  assert.equal(gap.verdict,'NOT_RUN');
  assert.ok(gap.actual.missing.some(item => item.field === 'release-dismiss-pointer-path'));
  const wrongArc = makeGrabberDismissFixture();
  wrongArc.predecessor.payload.transition.to.expansionProgress = 1;
  const wrong = evaluateMotion(dismissRelease,wrongArc.context);
  assert.equal(wrong.verdict,'FAIL');
  assert.ok(wrong.actual.deviations.some(item => item.field === 'release-dismiss-arc'));
  const late = makeGrabberDismissFixture();
  late.pointerFrame.captureEndMs = late.request.deviceMonoMs + 1;
  const timing = evaluateMotion(dismissRelease,late.context);
  assert.equal(timing.verdict,'FAIL');
  assert.ok(timing.actual.deviations.some(item => item.field === 'release-dismiss-pointer-before-up'));
});

const crossoverCase = JSON.parse(readFileSync(new URL('../cases/reading.control-grabber-crossover.json', import.meta.url), 'utf8'));
const crossoverRelease = crossoverCase.assertions.find(assertion => assertion.expected.gestureCrossover);

function makeGrabberCrossoverFixture() {
  const {context,predecessor:dismiss,request:release,boundary} = makeGrabberDismissFixture();
  const {source,nativeSource,target} = crossoverRelease.expected;
  const event = (eventSeq,deviceMonoMs,kind,payload,channel = 'business') =>
    ({eventSeq,deviceMonoMs,kind,channel,instanceId,payload:{readingId,...payload}});
  const h1 = {...dismiss.payload.before,transition:'morph'};
  const morph = event(21,20,'reading.control-transition-requested',{
    transitionId:'crossover-morph', origin:'grabber-move', direction:'morph', source:nativeSource,target:source,durationMs:320,
    before:{...h1,epoch:h1.epoch-1,transition:''},accepted:h1,
    transition:{kind:'morph',from:{expansionProgress:1,visibilityProgress:1},to:{expansionProgress:0,visibilityProgress:1},
      targetProgress:1,durationMs:320},
  });
  const cross = event(22,59,'reading.control-transition-interrupted',{
    transitionId:morph.payload.transitionId,origin:'grabber-move',epoch:h1.epoch,
    successorEpoch:dismiss.payload.accepted.epoch,successorTarget:target,heldPointerId:h1.heldPointerId,
  });
  const closeRetirement = context.events.find(event => event.kind === 'reading.control-transition-interrupted');
  const commit = context.events.find(event => event.kind === 'reading.control-transition-committed');
  Object.assign(dismiss,{eventSeq:23,deviceMonoMs:60});
  dismiss.payload.before = h1;
  Object.assign(closeRetirement,{eventSeq:24,deviceMonoMs:94});
  release.eventSeq = 25;
  commit.eventSeq = 36;
  commit.payload.origin = 'grabber-release';
  const morphFrames = [.5,.8].map((progress,index) => {
    const tick = 30 + 15*index;
    return Object.assign(motionFrame(index,0,tick,{
      from:1-progress,to:0,epoch:h1.epoch,ticket:5+index,endpoint:false,frameTimeNs:tick*1e6,contentLocation:source,
    }),{phase:'pointer',observationPhase:'after-pointer-publication',heldPointerId:h1.heldPointerId,
      pointerStartWindowYVp:9,pointerWindowYVp:9+410*progress,runtimeProgress:progress});
  });
  const morphBlocks = morphFrames.map((frame,index) => event(27 + index,104 + index,'reading.control-motion',{
    transitionId:morph.payload.transitionId,origin:'grabber-move',direction:'morph',epoch:h1.epoch,target:source,
    blockIndex:index,blockCount:morphFrames.length,finalBlock:index+1===morphFrames.length,
    frameStart:index,frameEnd:index,endReason:'interrupted',droppedSamples:0,frames:[frame],
  },'motion'));
  const dismissBlocks = context.events.filter(event => event.kind === 'reading.control-motion' &&
    event.payload.transitionId === dismiss.payload.transitionId);
  dismissBlocks.forEach((event,index) => {
    event.eventSeq = 29+index;
    event.payload.frames[0].pointerStartWindowYVp = 9;
  });
  const releaseBlocks = context.events.filter(event => event.kind === 'reading.control-motion' &&
    event.payload.transitionId === release.payload.transitionId);
  releaseBlocks.forEach((event,index) => { event.eventSeq = 37+index; });
  context.actions[crossoverRelease.action] = {...context.actions[dismissRelease.action],afterSeq:42,
    crossoverDrag:{calibrationSample:'calibrate-quick-state',fromWindowYVp:9,quickWindowYVp:419,toWindowYVp:429}};
  context.samples[crossoverRelease.baseline] = sample(19,true);
  context.samples[crossoverRelease.sample] = {...context.samples[dismissRelease.sample],beforeSeq:43,afterSeq:43};
  context.candidate.ownerSources = Object.fromEntries(crossoverCase.ownerSources.map(path => [path,'a'.repeat(64)]));
  context.events = [context.events[0],morph,cross,dismiss,closeRetirement,release,
    ...morphBlocks,...dismissBlocks,commit,...releaseBlocks];
  return {context,morph,cross,dismiss,closeRetirement,boundary,dismissBlocks,commit};
}

test('grabber crossover receipt proves both held segments and a unique native Hidden commit', () => {
  const {context} = makeGrabberCrossoverFixture();
  const result = evaluateMotion(crossoverRelease,context);
  assert.equal(result.verdict,'PASS',JSON.stringify({missing:result.actual.missing,deviations:result.actual.deviations}));
  assert.equal(result.observationsComplete,true);
  assert.equal(result.actual.trace.crossover.morphTravelVp,410);
  assert.deepEqual(result.actual.trace.crossover.heldTrajectories.map(trajectory => trajectory.frameCount),[2,2]);
  assert.equal(result.actual.trace.releaseBoundary.pointerId,6);
});

test('grabber crossover receipt distinguishes incomplete input from definite crossover deviations', () => {
  const read = fixture => evaluateMotion(crossoverRelease,fixture.context);
  const upOnly = makeGrabberCrossoverFixture();
  const removed = new Set([upOnly.cross,upOnly.dismiss,...upOnly.dismissBlocks]);
  upOnly.context.events = upOnly.context.events.filter(event => !removed.has(event));
  const gap = read(upOnly);
  assert.equal(gap.verdict,'NOT_RUN');
  assert.ok(gap.actual.missing.some(item => item.field === 'crossover-held-requests'));
  const noMotion = makeGrabberCrossoverFixture();
  noMotion.context.events = noMotion.context.events.filter(event => !noMotion.dismissBlocks.includes(event));
  const absent = read(noMotion);
  assert.equal(absent.verdict,'NOT_RUN');
  assert.ok(absent.actual.missing.some(item => item.field === 'crossover-native-move'));
  const earlyCapture = makeGrabberCrossoverFixture();
  earlyCapture.dismissBlocks[0].payload.frames[0].captureStartMs = earlyCapture.dismiss.deviceMonoMs-1;
  const stale = read(earlyCapture);
  assert.equal(stale.verdict,'NOT_RUN');
  assert.ok(stale.actual.missing.some(item => item.field === 'crossover-native-clock-grabber-move'));
  const noDispatch = makeGrabberCrossoverFixture();
  delete noDispatch.context.actions[crossoverRelease.action].crossoverDrag;
  const missingPath = read(noDispatch);
  assert.equal(missingPath.verdict,'NOT_RUN');
  assert.ok(missingPath.actual.missing.some(item => item.field === 'crossover-calibrated-pointer-path'));
  const wrongPointer = makeGrabberCrossoverFixture();
  wrongPointer.cross.payload.heldPointerId = 41;
  const pointer = read(wrongPointer);
  assert.equal(pointer.verdict,'FAIL');
  assert.ok(pointer.actual.deviations.some(item => item.field === 'crossover-retirement-grabber-move'));
  const resetCoordinates = makeGrabberCrossoverFixture();
  resetCoordinates.dismissBlocks.forEach(event => { event.payload.frames[0].pointerStartWindowYVp = 419; });
  const reset = read(resetCoordinates);
  assert.equal(reset.verdict,'FAIL');
  assert.ok(reset.actual.deviations.some(item => item.field === 'held-dismiss-physical-pointer-path'));
  const wrongShell = makeGrabberCrossoverFixture();
  wrongShell.dismissBlocks.forEach(event => {
    event.payload.frames[0].actors.find(actor => actor.id === 'reader-control-motion-shell').uniqueId = 701;
  });
  const shell = read(wrongShell);
  assert.equal(shell.verdict,'FAIL');
  assert.ok(shell.actual.deviations.some(item => item.actor === 'shell' && item.field === 'crossover-native-identity-grabber-move'));
  const additionalOperation = makeGrabberCrossoverFixture();
  additionalOperation.context.events.push({...additionalOperation.morph,eventSeq:26,
    payload:{...additionalOperation.morph.payload,origin:'runtime-resume',transitionId:'other-operation'}});
  const interruption = read(additionalOperation);
  assert.equal(interruption.verdict,'FAIL');
  assert.ok(interruption.actual.deviations.some(item => item.field === 'crossover-intervening-request'));
  const duplicate = makeGrabberCrossoverFixture();
  duplicate.context.events.push({...duplicate.commit,eventSeq:42});
  const extraCommit = read(duplicate);
  assert.equal(extraCommit.verdict,'FAIL');
  assert.ok(extraCommit.actual.deviations.some(item => item.field === 'crossover-unique-hidden-commit'));
});

test('grabber release runtime captures final UP without changing its motion', async () => {
  const hooks = registerHooks({resolve(specifier, context, next) {
    return next(specifier.endsWith('/ReaderMotionDurationPolicy') ? specifier + '.ts' : specifier, context);
  }});
  try {
    const base = '../../../entry/src/main/ets/features/reading/ui/';
    const { ReaderControlRuntime } = await import(base + 'ReaderControlRuntime.ts');
    const { createReaderControlSessionState, openReaderControlSession, enterReaderControlModule,
      expandReaderControlSession } = await import(base + 'ReaderControlSessionState.ts');
    const config = { axis:{ quickGrabberScreenY:419, fullGrabberScreenY:9, hiddenGrabberScreenY:437 },
      settleDurationMs:320, showDurationMs:220, dismissDurationMs:200, tapMaxDurationMs:500,
      directionSlopVp:8, coordinatedMotion:true };
    const quick = enterReaderControlModule(openReaderControlSession(createReaderControlSessionState(), 0), 'search', 0);
    for (const expand of [true, false]) {
      const end = expand ? -1 : 1;
      const initial = expand ? quick : expandReaderControlSession(quick, 0);
      const startY = expand ? 419 : 9;
      const runRelease = (observeRelease, upDelta = 10) => {
        const runtime = new ReaderControlRuntime(config);
        runtime.start(initial);
        runtime.down(6, startY, 10);
        runtime.move(6, startY + end * 82, 200);
        return runtime.up(6, startY + end * (82 + upDelta), 250, observeRelease);
      };
      const result = runRelease(true);
      const { releaseMotion, ...ordinary } = result;
      assert.deepEqual(ordinary, runRelease(false));
      const { before, held, released, pointerId, upWindowYVp } = releaseMotion.boundary;
      assert.equal(pointerId, 6);
      assert.equal(upWindowYVp, startY + end * 92);
      assert.equal(before.pointerWindowYVp, startY + end * 82);
      assert.equal(held.pointerWindowYVp, upWindowYVp);
      assert.ok(Math.abs(held.grabberScreenYVp - before.grabberScreenYVp - end * 10) < .001);
      assert.equal(held.ticket, before.ticket + 1);
      assert.equal(released.ticket, held.ticket + 1);
      assert.equal(released.heldPointerId, -1);
      assert.equal(held.grabberScreenYVp, released.grabberScreenYVp);
      const stationary = runRelease(true, 0).releaseMotion.boundary;
      assert.deepEqual(stationary.before, stationary.held);
    }
    const runtime = new ReaderControlRuntime(config);
    runtime.start(quick);
    runtime.down(6,419,10);
    const held = runtime.move(6,428,200).session;
    assert.equal(held.transition.kind,'dismiss');
    assert.equal(held.heldPointerId,6);
    assert.equal(held.closeRevision,quick.closeRevision);
    const released = runtime.up(6,429,250,true);
    const {boundary,travelVp,velocityYVpPerSecond} = released.releaseMotion;
    assert.equal(travelVp,18);
    assert.equal(boundary.held.expansionProgress,0);
    assert.ok(Math.abs(boundary.held.visibilityProgress - (1-10/18)) < .001);
    assert.ok(Math.abs(boundary.held.grabberScreenYVp - boundary.before.grabberScreenYVp - 1) < .001);
    assert.equal(boundary.released.grabberScreenYVp,boundary.held.grabberScreenYVp);
    assert.equal(boundary.released.heldPointerId,-1);
    const duration = 200*(1-10/18)/(1+Math.abs(velocityYVpPerSecond)*200/(1000*travelVp));
    assert.ok(Math.abs(released.session.transition.durationMs-duration) < .001);
    assert.equal(released.session.closeRevision,quick.closeRevision);
    runtime.frame(300,runtime.ticket(),fraction => fraction);
    const endpoint = runtime.frame(300+duration+1,runtime.ticket(),fraction => fraction).endpoint;
    assert.equal(endpoint.location.level,'hidden');
    assert.equal(endpoint.closeRevision,quick.closeRevision+1);
  } finally {
    hooks.deregister();
  }
});

test('grabber release receipt proves UP continuity and strictly sampled native motion', () => {
  const {context} = makeReleaseFixture();
  const result = evaluateMotion(grabberRelease, context);
  assert.equal(result.verdict, 'PASS', JSON.stringify(result.actual));
  assert.equal(result.actual.trace.releaseBoundary.lastPointer.nativeId, result.actual.trace.releaseBoundary.first.nativeId);
  assert.equal(result.actual.trace.releaseBoundary.first.delayMs, 12);
});

function applyRenderedExpansion(frame, expansionProgress) {
  const native = motionFrame(frame.index, 0, frame.runtimeTickMs, { from:expansionProgress, endpoint:false });
  frame.actors = native.actors;
  frame.contentClip = native.contentClip;
  frame.mountedContent = native.mountedContent;
}

function makeUnpublishedMorphFixture() {
  const fixture = makeReleaseFixture();
  const { context, request, pointerFrame, blocks } = fixture;
  const predecessor = context.events.find(event => event.payload.origin === 'grabber-move').payload;
  Object.assign(predecessor,{ direction:'morph',target:request.payload.target });
  Object.assign(pointerFrame,{ index:1,observationPhase:'after-pointer-publication',frameTimeNs:75e6 });
  const heldBlockIndex = context.events.findIndex(event => event.payload.frames?.[0] === pointerFrame);
  const heldBlock = context.events[heldBlockIndex];
  Object.assign(heldBlock.payload,{
    blockIndex:1,blockCount:2,frameStart:1,frameEnd:1,epoch:4,direction:'morph',origin:'grabber-move',
    target:request.payload.target,droppedSamples:0,
  });
  const early = motionFrame(0,0,60,{ from:.18,epoch:4,ticket:7,endpoint:false,frameTimeNs:60e6 });
  Object.assign(early,{ phase:'pointer',observationPhase:'after-pointer-publication',heldPointerId:6 });
  const firstHeldBlock = {
    ...heldBlock,eventSeq:25,
    payload:{ ...heldBlock.payload,blockIndex:0,frameStart:0,frameEnd:0,finalBlock:false,frames:[early] },
  };
  context.events.splice(heldBlockIndex,0,firstHeldBlock);
  const first = blocks[0].payload.frames[0];
  first.heldPointerId = -1;
  applyRenderedExpansion(first,.225);
  return { ...fixture,first,firstHeldBlock,heldBlock };
}

test('grabber morph release checks the bounded native expansion before publication', () => {
  const {context} = makeUnpublishedMorphFixture();
  const result = evaluateMotion(grabberRelease,context);
  assert.equal(result.verdict,'PASS',JSON.stringify(result.actual));
  assert.equal(result.observationsComplete,true);
  const publication = result.actual.trace.releaseBoundary.nativePublication;
  assert.equal(publication.pending,true);
  assert.ok(Math.abs(publication.nativeExpansion-.225) < .000001);
  assert.ok(Math.abs(publication.pointerExpansion-.2) < .000001);
  assert.equal(publication.pointerGapMs,24);
});

test('grabber morph release rejects incomplete or distant pointer publication evidence', () => {
  for (const invalidate of [
    ({context,firstHeldBlock}) => { context.events = context.events.filter(event => event !== firstHeldBlock); },
    ({heldBlock}) => { heldBlock.payload.droppedSamples = 1; },
    ({firstHeldBlock,pointerFrame}) => {
      for (const frame of [firstHeldBlock.payload.frames[0],pointerFrame]) {
        frame.captureStartMs -= 60;
        frame.captureEndMs -= 60;
      }
    },
    ({first,pointerFrame}) => { first.frameTimeNs = pointerFrame.frameTimeNs; },
    ({pointerFrame}) => { pointerFrame.layoutInputs.dockTopVp += 2; },
  ]) {
    const fixture = makeUnpublishedMorphFixture();
    invalidate(fixture);
    const result = evaluateMotion(grabberRelease,fixture.context);
    assert.equal(result.verdict,'FAIL',JSON.stringify(result.actual));
    assert.equal(result.actual.trace.releaseBoundary.nativePublication.pending,false);
    assert.ok(result.actual.deviations.some(item => item.actor === 'shell' && item.field === 'layout-rect-vp'));
  }
});

test('grabber morph release preserves out-of-range, actor and later-frame deviations', () => {
  for (const [change,role,index] of [
    [({first}) => applyRenderedExpansion(first,.18),'shell',0],
    [({first}) => { first.actors.find(actor => actor.id.endsWith('-grabber')).layoutRectVp.y += 2; },'grabber',0],
    [({first}) => { first.contentClip.layoutRectVp.height -= 2; },'clip',0],
    [({blocks}) => applyRenderedExpansion(blocks[1].payload.frames[0],.225),'shell',1],
  ]) {
    const fixture = makeUnpublishedMorphFixture();
    change(fixture);
    const result = evaluateMotion(grabberRelease,fixture.context);
    assert.equal(result.verdict,'FAIL',JSON.stringify(result.actual));
    assert.ok(result.actual.deviations.some(item => item.actor === role &&
      item.field === 'layout-rect-vp' && item.frame === index));
  }
});

test('grabber release receipt refuses missing observations and uniformly slow frames', () => {
  const missing = makeReleaseFixture();
  delete missing.request.payload.releaseMotion.boundary;
  const absent = evaluateMotion(grabberRelease, missing.context);
  assert.equal(absent.verdict, 'NOT_RUN');
  assert.ok(absent.actual.missing.some(item => item.field === 'release-observation'));

  const unknownPointer = makeReleaseFixture();
  delete unknownPointer.pointerFrame.heldPointerId;
  const unknownPointerResult = evaluateMotion(grabberRelease, unknownPointer.context);
  assert.equal(unknownPointerResult.verdict, 'NOT_RUN');
  assert.ok(unknownPointerResult.actual.missing.some(item => item.field === 'release-native-pointer-owner'));

  const slow = makeReleaseFixture();
  for (const [i, block] of slow.blocks.entries()) block.payload.frames[0].frameTimeNs = (100 + i * 108) * 1e6;
  const slowResult = evaluateMotion(grabberRelease, slow.context);
  assert.equal(slowResult.verdict, 'NOT_RUN');
  assert.ok(slowResult.actual.missing.some(item => item.field === 'frame-cadence-ms' && item.expected === 50));

  const sparse = makeReleaseFixture();
  const removed = new Set(sparse.blocks.slice(3, 6));
  sparse.context.events = sparse.context.events.filter(event => !removed.has(event));
  const sparseResult = evaluateMotion(grabberRelease, sparse.context);
  assert.equal(sparseResult.verdict, 'NOT_RUN');
  assert.ok(sparseResult.actual.missing.some(item => item.field === 'sampled-interior'));
});

test('grabber release receipt preserves native and owner deviations alongside cadence gaps', () => {
  const {context, boundary, pointerFrame, blocks} = makeReleaseFixture();
  boundary.held.pointerWindowYVp += 2;
  pointerFrame.actors[1].uniqueId = 999;
  pointerFrame.heldPointerId = 9;
  for (const [i, block] of blocks.entries()) block.payload.frames[0].frameTimeNs = (100 + i * 108) * 1e6;
  blocks[0].payload.frames[0].actors[1].layoutRectVp.y += 2;
  const result = evaluateMotion(grabberRelease, context);
  assert.equal(result.verdict, 'FAIL');
  for (const field of ['observed-up-position', 'release-native-continuity', 'release-native-pointer-owner', 'layout-rect-vp']) {
    assert.ok(result.actual.deviations.some(item => item.field === field));
  }
  assert.ok(result.actual.missing.some(item => item.field === 'frame-cadence-ms'));

  const held = makeReleaseFixture();
  const predecessor = held.context.events[1].payload;
  Object.assign(predecessor, {
    direction:'morph', durationMs:320, source:held.request.payload.source, target:held.request.payload.target,
    before:{...predecessor.accepted,epoch:3}, transition:{...held.request.payload.transition,durationMs:320},
  });
  Object.assign(held.pointerFrame,{index:0,heldPointerId:9});
  const pointerBlock = held.context.events.find(item => item.payload.frames?.[0] === held.pointerFrame).payload;
  Object.assign(pointerBlock,{
    epoch:4, blockIndex:0, blockCount:1, frameStart:0, frameEnd:0, droppedSamples:0,
    target:predecessor.target, direction:'morph', origin:'grabber-move',
  });
  const finger = grabberCase.assertions.find(assertion => assertion.id.endsWith('expand-drag.finger'));
  const heldResult = evaluateMotion(finger,held.context);
  assert.equal(heldResult.verdict,'FAIL');
  assert.ok(heldResult.actual.deviations.some(item => item.field === 'held-pointer-owner' && item.frame === 0));
});

const cancelCase = JSON.parse(readFileSync(new URL('../cases/reading.control-grabber-cancel.json', import.meta.url), 'utf8'));
const grabberCancel = cancelCase.assertions.find(assertion => assertion.expected.requireCancelObservation);

function makeCancelFixture({up = false} = {}) {
  const { context, request, boundary, pointerFrame } = makeReleaseFixture();
  const action = context.actions[grabberRelease.action];
  context.actions[grabberCancel.action] = {...action,targetId:'reader-control-motion-grabber'};
  context.samples[grabberCancel.sample] = {...sample(41,up),captureComplete:true};
  context.candidate.ownerSources = Object.fromEntries(cancelCase.ownerSources.map(path => [path,'a'.repeat(64)]));
  const [,move,retired,,priorMotion,commit] = context.events;
  Object.assign(move.payload,{direction:'morph',source:grabberCancel.expected.nativeSource,target:grabberCancel.expected.source});
  Object.assign(pointerFrame,{pointerStartWindowYVp:400,pointerWindowYVp:318});
  commit.payload.origin = 'grabber-release';
  if (up) return {context,request,commit};

  const { target } = grabberCancel.expected;
  const { payload } = request;
  const held = boundary.held;
  const cancelled = {...held, ticket:10, epoch:5, heldPointerId:-1};
  const cancelMotion = {priorTarget:{...target},held,cancelled};
  delete payload.releaseMotion;
  Object.assign(payload,{origin:'grabber-cancel',target,cancelMotion,durationMs:260,
    transition:{...payload.transition,from:{expansionProgress:held.expansionProgress,visibilityProgress:1},
      to:{expansionProgress:0,visibilityProgress:1},progress:0,startProgress:0,durationMs:260}});
  const window = {id:'42',revision:7};
  Object.assign(context.samples[grabberCancel.baseline].window,window);
  Object.assign(context.samples[grabberCancel.sample].window,window);
  request.windowRevision = window.revision;
  retired.eventSeq = 23;
  const dispatch = {instanceId,eventSeq:22,windowRevision:window.revision,kind:'reading.control-grabber-platform-cancel',
    channel:'probe',payload:{readingId,windowId:42,windowRevision:window.revision,pointerId:6,epoch:4,accepted:true,
      transport:'arkui-send-touch-event'}};
  Object.assign(retired.payload,{origin:'grabber-cancel',successorTarget:target});
  Object.assign(priorMotion.payload,{epoch:4,origin:'grabber-move',direction:'morph',target:grabberCancel.expected.source,
    blockIndex:7,blockCount:8,frameStart:7,frameEnd:7,droppedSamples:0});
  Object.assign(commit.payload,{origin:'grabber-cancel',target});
  const blocks = [0,40,80,120,160,200,240,280].map((elapsed,i,times) => {
    const last = i === times.length - 1;
    const tick = 100 + (last ? times[i-1] : elapsed);
    const frame = motionFrame(i,elapsed,tick,{from:held.expansionProgress,to:0,durationMs:260,
      endpoint:last,frameTimeNs:(100+elapsed)*1e6,contentLocation:target});
    frame.observationPhase = last ? 'after-endpoint-publication' : 'before-runtime-publication';
    frame.heldPointerId = -1;
    return {instanceId,eventSeq:30+i,kind:'reading.control-motion',channel:'motion',payload:{
      readingId,transitionId,target,origin:'grabber-cancel',direction:'morph',epoch:5,blockIndex:i,
      blockCount:times.length,finalBlock:last,frameStart:i,frameEnd:i,endReason:'completed',droppedSamples:0,frames:[frame],
    }};
  });
  context.events = [...context.events.slice(0,2),dispatch,...context.events.slice(2,6),...blocks];
  return {context,request,retired,commit,move,pointerFrame,cancelMotion,blocks,dispatch};
}

function assessCancel(context) {
  const result = evaluateMotion(grabberCancel,context);
  const condition = conditionApplicability(grabberCancel,context,result,cancelCase);
  return {...result,condition};
}

test('grabber Cancel receipt binds the held pointer, native motion and prior goal', () => {
  const {context,request} = makeCancelFixture();
  context.events.splice(4,0,{...request,eventSeq:25,payload:{...request.payload,readingId:'other-reading'}});
  const result = assessCancel(context);
  assert.equal(result.verdict,'PASS',JSON.stringify(result.actual));
  assert.equal(result.condition.status,'APPLIES');
  assert.equal(result.condition.required,true);
  const {cancelBoundary,trace} = result.actual;
  assert.equal(cancelBoundary.lastPointer.nativeId,cancelBoundary.first.nativeId);
  assert.equal(cancelBoundary.cancelled.heldPointerId,-1);
  assert.equal(cancelBoundary.priorTarget.form,'quick');
  assert.equal(trace.frameCount,8);
});

test('grabber Cancel receipt requires an accepted same-window dispatch before the actual held callback', () => {
  const missing = makeCancelFixture();
  missing.context.events = missing.context.events.filter(event => event !== missing.dispatch);
  const unknown = assessCancel(missing.context);
  assert.equal(unknown.verdict,'NOT_RUN');
  assert.equal(unknown.condition.status,'APPLIES');
  assert.ok(unknown.actual.missing.some(item=>item.field === 'platform-cancel-dispatch'));

  for (const change of [
    ({dispatch})=>{dispatch.payload.windowId=43;},
    ({dispatch})=>{dispatch.payload.pointerId++;},
    ({dispatch})=>{dispatch.payload.epoch++;},
    ({dispatch})=>{dispatch.payload.accepted=false;},
    ({dispatch,request})=>{dispatch.eventSeq=request.eventSeq+1;},
    ({dispatch,context})=>{context.events.push({...dispatch,eventSeq:25});},
  ]) {
    const fixture = makeCancelFixture();
    change(fixture);
    const result = assessCancel(fixture.context);
    assert.equal(result.verdict,'FAIL');
    assert.ok(result.actual.deviations.some(item=>item.field === 'platform-cancel-dispatch'));
  }
  const ackOnly = makeCancelFixture();
  ackOnly.context.events = ackOnly.context.events.filter(event=>event !== ackOnly.request && event !== ackOnly.retired);
  const result = assessCancel(ackOnly.context);
  assert.equal(result.verdict,'NOT_RUN');
  assert.equal(result.condition.status,'UNKNOWN');
});

test('grabber Cancel receipt separates a proved UP from an unobserved cancellation', () => {
  const up = makeCancelFixture({up:true});
  const released = assessCancel(up.context);
  assert.equal(released.verdict,'NOT_RUN');
  assert.equal(released.condition.status,'DOES_NOT_APPLY');
  assert.equal(released.condition.required,false);
  delete up.request.payload.releaseMotion;
  assert.equal(assessCancel(up.context).condition.status,'UNKNOWN');

  const noSample = makeCancelFixture({up:true});
  delete noSample.context.samples[grabberCancel.sample];
  assert.equal(assessCancel(noSample.context).condition.status,'UNKNOWN');
  const logGap = makeCancelFixture({up:true});
  logGap.context.problems = ['Lost app events'];
  assert.equal(assessCancel(logGap.context).condition.status,'UNKNOWN');

  const withBack = makeCancelFixture();
  withBack.request.payload.origin = 'system-back';
  withBack.retired.payload.origin = 'system-back';
  assert.equal(assessCancel(withBack.context).condition.status,'UNKNOWN');

  for (const mask of [
    event => { event.instanceId = 'retired-instance'; },
    event => { event.payload.readingId = 'retired-reading'; },
    event => { event.eventSeq += 19; },
  ]) {
    const {context,request,retired} = makeCancelFixture();
    mask(request);
    mask(retired);
    const missing = assessCancel(context);
    assert.equal(missing.condition.status,'UNKNOWN');
    assert.equal(missing.verdict,'NOT_RUN');
  }

  const retiredOnly = makeCancelFixture();
  retiredOnly.context.events = retiredOnly.context.events.filter(event => event !== retiredOnly.request);
  const missing = assessCancel(retiredOnly.context);
  assert.equal(missing.condition.status,'APPLIES');
  assert.equal(missing.verdict,'NOT_RUN');
});

test('grabber Cancel receipt retains proved deviations when observations are incomplete', () => {
  const missingPointer = makeCancelFixture();
  delete missingPointer.pointerFrame.heldPointerId;
  delete missingPointer.move.payload.source;
  const incomplete = assessCancel(missingPointer.context);
  assert.equal(incomplete.condition.status,'APPLIES');
  assert.equal(incomplete.verdict,'NOT_RUN');
  assert.ok(incomplete.actual.missing.some(item => item.field === 'cancel-native-pointer-owner'));
  assert.ok(incomplete.actual.missing.some(item => item.field === 'cancel-held-morph'));

  const wrongPath = makeCancelFixture();
  wrongPath.move.payload.direction = 'navigate';
  wrongPath.pointerFrame.pointerWindowYVp = wrongPath.pointerFrame.pointerStartWindowYVp + 1;
  wrongPath.cancelMotion.held.expansionProgress = 0;
  const offPath = assessCancel(wrongPath.context);
  assert.equal(offPath.verdict,'FAIL');
  for (const field of ['cancel-held-morph','cancel-held-expansion','cancel-native-upward-path']) {
    assert.ok(offPath.actual.deviations.some(item => item.field === field));
  }

  const oldSlope = makeCancelFixture();
  oldSlope.blocks[0].payload.frames[0].continuationSlope = 0;
  const staleCurve = assessCancel(oldSlope.context);
  assert.equal(staleCurve.verdict,'FAIL');
  assert.ok(staleCurve.actual.deviations.some(item => item.field === 'cancel-no-release-slope'));

  const {context,request,commit,cancelMotion,blocks,move,pointerFrame} = makeCancelFixture();
  cancelMotion.priorTarget.form = 'full';
  cancelMotion.cancelled.grabberScreenYVp += 4;
  cancelMotion.cancelled.ticket = cancelMotion.held.ticket;
  request.payload.releaseMotion = {travelVp:410};
  pointerFrame.heldPointerId = 9;
  pointerFrame.captureEndMs = request.deviceMonoMs + 1;
  commit.payload.target = grabberCancel.expected.source;
  context.events.splice(6,0,{...commit,eventSeq:28,payload:{...commit.payload,transitionId:move.payload.transitionId}});
  context.events = context.events.filter(event => event !== blocks[0]);
  delete context.samples[grabberCancel.sample];
  const failed = assessCancel(context);
  assert.equal(failed.condition.status,'APPLIES');
  assert.equal(failed.verdict,'FAIL');
  assert.equal(failed.observationsComplete,false);
  for (const field of ['cancel-prior-target','cancel-retarget-continuity','cancel-ticket-handoff',
    'cancel-no-up','cancel-native-pointer-owner','cancel-native-pointer-before-request','cancel-obsolete-commit','cancel-commit-target']) {
    assert.ok(failed.actual.deviations.some(item => item.field === field),JSON.stringify(failed.actual));
  }
  assert.ok(failed.actual.missing.some(item => item.field === 'first-cancel-observation'));
});

const reversalCase = JSON.parse(readFileSync(new URL('../cases/reading.control-grabber-reversal.json', import.meta.url), 'utf8'));
const grabberReversal = reversalCase.assertions.find(assertion => assertion.expected.requireReversalObservation);
const reversalRunId = '9a9dbbcb-60ac-4a0e-8557-a0cae6e036ea';

function makeReversalFixture() {
  const {context,request,boundary} = makeReleaseFixture();
  const [,move,retired,,,commit] = context.events;
  const assertion = grabberReversal;
  const {source:full,nativeSource:quick} = assertion.expected;
  context.runId = reversalRunId;
  context.actions[assertion.action] = {
    ...context.actions[grabberRelease.action],
    actionId:`${reversalRunId}:${assertion.action}`, op:'grabberReversal', targetId:'reader-control-motion-grabber',
    beforeLog:20, dispatch:{probeSeq:21,runId:reversalRunId,baselineSha256:'b'.repeat(64),
      runnerHapSha256:'c'.repeat(64),state:'SDK_ACCEPTED'},
  };
  context.actions['enter-reading'].instanceId = instanceId;
  context.samples['calibrate-full-state'] = {...sample(16,true),captureComplete:true};
  context.samples[assertion.baseline] = {...sample(19,false),captureComplete:true};
  context.samples[assertion.sample] = {...sample(41,false),captureComplete:true};
  for (const [id,top] of [['calibrate-full-state',20],[assertion.baseline,430]]) {
    context.samples[id].nodes.push({id:'reader-control-motion-grabber',visible:true,opacity:1,
      rectPx:{left:156,top,width:72,height:28}});
  }
  context.candidate.ownerSources = Object.fromEntries(reversalCase.ownerSources.map(path => [path,'a'.repeat(64)]));
  const downY = 430;
  const travel = 410;
  const progress = .65;
  const durationMs = 260*progress;
  const yAt = p => downY - travel*p;
  const frameTransition = {kind:'morph',from:{expansionProgress:0,visibilityProgress:1},to:{expansionProgress:1,visibilityProgress:1}};
  Object.assign(move.payload,{direction:'morph',source:quick,target:full,before:{...move.payload.accepted,epoch:3},
    durationMs:320,transition:{...frameTransition,startProgress:0,targetProgress:1,durationMs:320}});
  move.deviceMonoMs = 101;
  retired.payload.successorTarget = quick;
  const point = {epoch:4,ticket:10,heldPointerId:6,expansionProgress:progress,visibilityProgress:1,
    pointerWindowYVp:yAt(progress),grabberScreenYVp:yAt(progress)+9};
  Object.assign(boundary,{upWindowYVp:yAt(progress),before:point,held:{...point},released:{...point,epoch:5,ticket:11,heldPointerId:-1}});
  Object.assign(request.payload,{source:full,target:quick,durationMs,
    transition:{...frameTransition,progress,startProgress:progress,targetProgress:0,durationMs}});
  request.deviceMonoMs = 188;
  Object.assign(commit,{eventSeq:28});
  Object.assign(commit.payload,{target:quick,origin:'grabber-release'});

  const heldBlocks = [.55,.78,progress].map((p,index,all) => {
    const tick = 115+30*index;
    const frame = motionFrame(index,0,tick,{from:p,epoch:4,ticket:8+index,endpoint:false,frameTimeNs:tick*1e6});
    Object.assign(frame,{phase:'pointer',observationPhase:'after-pointer-publication',heldPointerId:6,runtimeProgress:p,
      pointerStartWindowYVp:downY,pointerWindowYVp:yAt(p)});
    return {instanceId,eventSeq:25+index,kind:'reading.control-motion',channel:'motion',payload:{
      readingId,transitionId:move.payload.transitionId,target:full,origin:'grabber-move',direction:'morph',epoch:4,
      blockIndex:index,blockCount:all.length,finalBlock:index===all.length-1,frameStart:index,frameEnd:index,
      endReason:'interrupted',droppedSamples:0,frames:[frame],
    }};
  });
  const releaseBlocks = [0,34,68,102,136,170].map((elapsed,index,all) => {
    const endpoint = index === all.length-1;
    const tick = 200+(endpoint ? all[index-1] : elapsed);
    const frame = motionFrame(index,elapsed,tick,{from:progress,to:0,durationMs,ticket:11,endpoint,
      frameTimeNs:(200+elapsed)*1e6,contentLocation:quick});
    frame.observationPhase = endpoint ? 'after-endpoint-publication' : 'before-runtime-publication';
    frame.heldPointerId = -1;
    return {instanceId,eventSeq:30+index,kind:'reading.control-motion',channel:'motion',payload:{
      readingId,transitionId,target:quick,origin:'grabber-release',direction:'morph',epoch:5,blockIndex:index,
      blockCount:all.length,finalBlock:endpoint,frameStart:index,frameEnd:index,endReason:'completed',droppedSamples:0,frames:[frame],
    }};
  });
  context.events = [...context.events.slice(0,4),...heldBlocks,commit,...releaseBlocks];
  return {assertion,context,heldBlocks,releaseBlocks,request,move,commit};
}

test('grabber reversal receipt proves a single pointer and native retreat before UP', () => {
  const {assertion,context} = makeReversalFixture();
  const result = evaluateMotion(assertion,context);
  assert.equal(result.verdict,'PASS',JSON.stringify(result.actual));
  assert.equal(result.actual.reversalInputWitnessed,true);
  assert.equal(conditionApplicability(assertion,context,result,reversalCase).status,'APPLIES');
  assert.deepEqual(result.actual.landmarks.map(frame => frame.pointer),[6,6,6]);
  assert.deepEqual(result.actual.landmarks.map(frame => frame.epoch),[4,4,4]);
  assert.equal(result.actual.release.nativeAfter.collapseEnabled,false);
});

test('grabber reversal receipt keeps unwitnessed input and missing observations unverified', () => {
  const monotone = makeReversalFixture();
  monotone.heldBlocks[2].payload.frames[0].pointerWindowYVp = monotone.heldBlocks[1].payload.frames[0].pointerWindowYVp-20;
  const noReverse = evaluateMotion(monotone.assertion,monotone.context);
  assert.equal(noReverse.verdict,'NOT_RUN');
  assert.equal(noReverse.actual.verifiedAction,true);
  assert.equal(noReverse.actual.reversalInputWitnessed,false,'the owner changing direction at UP cannot qualify as a held reversal');
  const unobserved = conditionApplicability(monotone.assertion,monotone.context,noReverse,reversalCase);
  assert.equal(unobserved.status,'UNKNOWN');
  assert.equal(unobserved.required,true);

  const otherDispatch = makeReversalFixture();
  otherDispatch.context.actions[otherDispatch.assertion.action].op = 'drag';
  const straightDrag = evaluateMotion(otherDispatch.assertion,otherDispatch.context);
  assert.equal(straightDrag.verdict,'NOT_RUN');
  assert.equal(straightDrag.actual.verifiedAction,false);

  const noAction = makeReversalFixture();
  delete noAction.context.actions[noAction.assertion.action];
  assert.equal(evaluateMotion(noAction.assertion,noAction.context).verdict,'NOT_RUN');

  const absentDispatch = makeReversalFixture();
  delete absentDispatch.context.actions[absentDispatch.assertion.action].dispatch;
  const missingReceipt = evaluateMotion(absentDispatch.assertion,absentDispatch.context);
  assert.equal(missingReceipt.verdict,'NOT_RUN','a complete physical trajectory cannot replace the Runner receipt');
  assert.equal(missingReceipt.actual.verifiedAction,false);
  assert.equal(conditionApplicability(absentDispatch.assertion,absentDispatch.context,missingReceipt,reversalCase).status,'UNKNOWN');

  const foreignRun = makeReversalFixture();
  const foreignAction = foreignRun.context.actions[foreignRun.assertion.action];
  foreignAction.dispatch.runId = '343fb7c1-e582-46de-9287-a1e95fa05748';
  foreignAction.actionId = `${foreignAction.dispatch.runId}:${foreignRun.assertion.action}`;
  assert.equal(evaluateMotion(foreignRun.assertion,foreignRun.context).verdict,'NOT_RUN',
    'the receipt and action label cannot be borrowed together from another sealed run');

  const foreignCommand = makeReversalFixture();
  foreignCommand.context.actions[foreignCommand.assertion.action].dispatch.probeSeq -= 1;
  assert.equal(evaluateMotion(foreignCommand.assertion,foreignCommand.context).verdict,'NOT_RUN',
    'the receipt cannot come from a different command in the same run');

  const foreignActionId = makeReversalFixture();
  foreignActionId.context.actions[foreignActionId.assertion.action].actionId = `${reversalRunId}:calibrate-full`;
  assert.equal(evaluateMotion(foreignActionId.assertion,foreignActionId.context).verdict,'NOT_RUN',
    'the action identity must name the exact reversal step');

  for (const invalid of [{state:'DRY_READY'}, {baselineSha256:''}, {runnerHapSha256:''}]) {
    const fixture = makeReversalFixture();
    Object.assign(fixture.context.actions[fixture.assertion.action].dispatch,invalid);
    assert.equal(evaluateMotion(fixture.assertion,fixture.context).verdict,'NOT_RUN');
  }

  const regrab = makeReversalFixture();
  regrab.context.events.splice(3,0,{...regrab.move,eventSeq:23,payload:{...regrab.move.payload,transitionId:'regrab'}});
  assert.equal(evaluateMotion(regrab.assertion,regrab.context).verdict,'NOT_RUN');

  const gap = makeReversalFixture();
  delete gap.heldBlocks[2].payload.frames[0].heldPointerId;
  const incomplete = evaluateMotion(gap.assertion,gap.context);
  assert.equal(incomplete.verdict,'NOT_RUN');
  assert.ok(incomplete.actual.missing.some(item => item.field === 'reversal-single-pointer'));

  const shallow = makeReversalFixture();
  shallow.heldBlocks[2].payload.frames[0].pointerWindowYVp = 250;
  assert.equal(evaluateMotion(shallow.assertion,shallow.context).verdict,'NOT_RUN');

  const calibration = makeReversalFixture();
  delete calibration.context.samples['calibrate-full-state'];
  const calibrationGap = evaluateMotion(calibration.assertion,calibration.context);
  assert.equal(calibrationGap.verdict,'NOT_RUN');
  assert.equal(conditionApplicability(calibration.assertion,calibration.context,calibrationGap,reversalCase).status,'APPLIES');

  const noAnchor = makeReversalFixture();
  noAnchor.context.samples['calibrate-full-state'].nodes.pop();
  const unmeasured = evaluateMotion(noAnchor.assertion,noAnchor.context);
  assert.equal(unmeasured.verdict,'NOT_RUN');
  assert.ok(unmeasured.actual.missing.some(item => item.field === 'reversal-calibration-positions'));

  const finalDirection = makeReversalFixture();
  const finalBoundary = finalDirection.request.payload.releaseMotion.boundary;
  finalBoundary.before.pointerWindowYVp -= 6;
  finalBoundary.held.pointerWindowYVp -= 12;
  const changedDirection = evaluateMotion(finalDirection.assertion,finalDirection.context);
  assert.equal(changedDirection.verdict,'NOT_RUN');
  assert.equal(conditionApplicability(finalDirection.assertion,finalDirection.context,changedDirection,reversalCase).status,'UNKNOWN');
});

test('grabber reversal receipt preserves proved native and terminal violations', () => {
  const {assertion,context,heldBlocks,releaseBlocks,commit} = makeReversalFixture();
  const [,peak,retreat] = heldBlocks.map(block => block.payload.frames[0]);
  retreat.actors[2].windowOriginVp.y = peak.actors[2].windowOriginVp.y;
  commit.payload.target = assertion.expected.source;
  context.events = context.events.filter(event => event !== releaseBlocks.at(-1));
  const result = evaluateMotion(assertion,context);
  assert.equal(result.verdict,'FAIL');
  assert.equal(conditionApplicability(assertion,context,result,reversalCase).status,'APPLIES');
  assert.equal(result.observationsComplete,false);
  for (const field of ['reversal-native-displacement','committed-state','reversal-commit-target']) {
    assert.ok(result.actual.deviations.some(item => item.field === field),JSON.stringify(result.actual));
  }
  assert.ok(result.actual.missing.some(item => item.field === 'complete-blocks'));

  delete context.samples[assertion.sample];
  const lostEndpoint = evaluateMotion(assertion,context);
  assert.equal(lostEndpoint.verdict,'FAIL');
  assert.ok(lostEndpoint.actual.deviations.some(item => item.field === 'reversal-commit-target'));

  const swapped = makeReversalFixture();
  swapped.heldBlocks[2].payload.frames[0].heldPointerId = 9;
  const wrongOwner = evaluateMotion(swapped.assertion,swapped.context);
  assert.equal(wrongOwner.verdict,'FAIL');
  assert.ok(wrongOwner.actual.deviations.some(item => item.field === 'reversal-single-pointer'));
  assert.equal(conditionApplicability(swapped.assertion,swapped.context,wrongOwner,reversalCase).status,'UNKNOWN');

  const foreignUp = makeReversalFixture();
  foreignUp.request.payload.releaseMotion.boundary.pointerId = 9;
  const unrelatedUp = evaluateMotion(foreignUp.assertion,foreignUp.context);
  assert.equal(unrelatedUp.verdict,'FAIL');
  assert.ok(unrelatedUp.actual.deviations.some(item => item.field === 'reversal-up-owner'));
  assert.equal(conditionApplicability(foreignUp.assertion,foreignUp.context,unrelatedUp,reversalCase).status,'UNKNOWN');
});

test('wrong native actor matrix is a failure even when a later required frame is missing', () => {
  const { context, blocks } = makeFixture();
  blocks[1].payload.frames[0].actors[1].matrix[4] = 0.3;
  context.events = context.events.filter(event => event !== blocks[2]);
  const result = evaluateMotion(contract, context);
  assert.equal(result.verdict, 'FAIL', JSON.stringify(result.actual));
  assert.equal(result.observationsComplete, false);
  assert.equal(result.actual.deviations[0].field, 'transform-matrix');
  assert.equal(result.actual.deviations[0].frame, 1);
  assert.equal(result.actual.missing[0].field, 'complete-blocks');
});

test('wrong native module identity is a failure even when owner declares the right module', () => {
  const { context, blocks } = makeFixture();
  blocks[2].payload.frames[0].mountedContent.id = 'reader-control-module-settings';
  const result = evaluateMotion(contract, context);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.actual.deviations[0].field, 'native-content');
  assert.equal(result.actual.deviations[0].frame, 2);
});

test('a trace with a gap and no observed deviation is NOT_RUN', () => {
  const { context, blocks } = makeFixture();
  context.events = context.events.filter(event => event !== blocks[2]);
  const result = evaluateMotion(contract, context);
  assert.equal(result.verdict, 'NOT_RUN', JSON.stringify(result.actual));
  assert.equal(result.observationsComplete, false);
});

test('native window shift cannot replace the independently measured stage anchor', () => {
  const { context, blocks } = makeFixture();
  const frame = blocks[1].payload.frames[0];
  for (const node of [...frame.actors, frame.contentClip]) {
    node.layoutRectVp.x += 14;
    node.windowOriginVp.x += 14;
  }
  const result = evaluateMotion(contract, context);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.actual.deviations[0].field, 'layout-rect-vp');
  assert.equal(result.actual.deviations[0].frame, 1);
});

test('a clipped content host and native z-order are assessed independently', () => {
  const { context, blocks } = makeFixture();
  const frame = blocks[2].payload.frames[0];
  frame.contentClip.clipToFrame = false;
  frame.actors[2].zIndex = 2;
  const result = evaluateMotion(contract, context);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.actual.deviations.find(deviation => deviation.actor === 'clip').field, 'clip');
  assert.equal(result.actual.deviations.find(deviation => deviation.actor === 'grabber').field, 'stacking');
});

const interruptionCase = JSON.parse(readFileSync(new URL('../cases/reading.control-search-interrupted-back.json', import.meta.url), 'utf8'));
const interruptionAssertion = interruptionCase.assertions[0];

function makeInterruptionFixture() {
  const { context } = makeFixture();
  const { source:quick, target:full } = contract.expected;
  const event = (eventSeq, kind, payload, channel = 'business') =>
    ({ eventSeq, kind:'reading.control-' + kind, channel, instanceId, payload:{ readingId, ...payload } });
  const action = {
    instanceId, beforeSeq:20, afterSeq:50, actionId:'measured-search-click-and-back', op:'clickThenBack',
    dispatch:{ dispatchGapMs:220, probeSeq:90 },
  };
  context.actions[interruptionAssertion.action] = action;
  context.samples[interruptionAssertion.sample] = sample(51, false);
  const old = context.events[1];
  old.payload.intent = 'forward';
  const successorId = 'morph-3';
  const back = event(23, 'back-consumer', { consumer:'panel-session', epoch:5, location:full });
  const interrupted = event(24, 'transition-interrupted', {
    transitionId, origin:'system-back', epoch:5, successorEpoch:6, successorTarget:quick, heldPointerId:-1,
  });
  const next = event(25, 'transition-requested', {
    transitionId:successorId, origin:'system-back', direction:'morph', intent:'back',
    source:full, target:quick, durationMs:320, before:old.payload.accepted,
    accepted:{ ...old.payload.accepted, epoch:6 },
    transition:{ kind:'morph', from:{ expansionProgress:.5, visibilityProgress:1 },
      to:{ expansionProgress:0, visibilityProgress:1 }, progress:0, startProgress:0, targetProgress:1, durationMs:320 },
  });
  const completed = event(44, 'transition-committed', {
    transitionId:successorId, target:quick, state:{ ...next.payload.accepted, transition:'' },
  });
  const toBlocks = (frames, seq, reason, id, epoch, origin, target) =>
    frames.map((frame, i) => event(seq + i, 'motion', {
      transitionId:id, epoch, origin, target, direction:'morph',
      blockIndex:i, blockCount:frames.length, frames:[frame], finalBlock:i === frames.length - 1,
      frameStart:i, frameEnd:i, endReason:reason, droppedSamples:0,
    }, 'motion'));
  const oldFrames = [0,40,80,120].map((elapsed, i) => motionFrame(i, elapsed, 40 + elapsed, { endpoint:false }));
  const oldBlocks = toBlocks(oldFrames, 26, 'interrupted', transitionId, 5, 'grabber-release', full);
  const runtimeTicks = [200,240,290,290];
  const newFrames = [0,40,80,130].map((elapsed, i) =>
    motionFrame(i, elapsed, runtimeTicks[i], {
      from:.5, to:0, durationMs:130, epoch:6, ticket:11,
      frameTimeNs:(5 + i) * 1e8, contentLocation:quick,
    }));
  const newBlocks = toBlocks(newFrames, 45, 'completed', successorId, 6, 'system-back', quick);
  context.events = [context.events[0], old, back, interrupted, next, ...oldBlocks, completed, ...newBlocks];
  return { context, back, interrupted, old, next, oldBlocks, newBlocks };
}

test('paired normal Back recomputes the published cut, both motion edges and the exclusive successor commit', () => {
  const { context } = makeInterruptionFixture();
  const result = evaluateMotion(interruptionAssertion, context);
  assert.equal(result.verdict, 'PASS', JSON.stringify(result.actual));
  assert.equal(result.observationsComplete, true);
  assert.equal(result.actual.cut.reconstructed.expansionProgress, .5);
  assert.equal(result.actual.cut.durationMs, 130);
});

test('an interruption cannot revoke a different successor epoch', () => {
  const { context, interrupted } = makeInterruptionFixture();
  interrupted.payload.successorEpoch = 8;
  const result = evaluateMotion(interruptionAssertion, context);
  assert.equal(result.verdict, 'FAIL');
  assert.match(result.reason, /revocation/);
});

test('late normal Back leaves the overlap unobserved', () => {
  const { context, interrupted, old, next } = makeInterruptionFixture();
  next.payload.before = { ...next.payload.before, transition:'' };
  context.events = context.events.filter(event => event !== interrupted);
  context.events.push({ ...old, kind:'reading.control-transition-committed', eventSeq:22 });
  const result = evaluateMotion(interruptionAssertion, context);
  assert.equal(result.verdict, 'NOT_RUN');
  assert.match(result.reason, /already committed/);
});

test('successor frame loss cannot promote an owner-only interruption', () => {
  const { context, newBlocks } = makeInterruptionFixture();
  context.events = context.events.filter(event => event !== newBlocks[1]);
  const result = evaluateMotion(interruptionAssertion, context);
  assert.equal(result.verdict, 'NOT_RUN', JSON.stringify(result.actual));
  assert.equal(result.observationsComplete, false);
});

test('an obsolete predecessor commit after a valid revocation is a failure', () => {
  const { context, old } = makeInterruptionFixture();
  context.events.push({ ...old, kind:'reading.control-transition-committed', eventSeq:49 });
  const result = evaluateMotion(interruptionAssertion, context);
  assert.equal(result.verdict, 'FAIL');
  assert.match(result.reason, /commit ordering/);
});

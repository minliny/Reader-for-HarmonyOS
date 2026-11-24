import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { sha256, jsonDigest } from '../lib/evidence.mjs';
import { capsuleModelInputs, systemSpeechApplicability } from '../lib/control-capsule.mjs';
import { evaluateMotion } from '../lib/motion.mjs';
import { sampleReadiness } from '../collectors/harmonyos/records.mjs';

const caseDefinition = JSON.parse(readFileSync(new URL('../cases/reading.control-autopage-launch-quick.json', import.meta.url), 'utf8'));
const launch = caseDefinition.assertions.find(assertion => assertion.action === 'playback-launch');
const instanceId = 'capsule-fixture-instance';
const readingId = 'reading-1';
const sourceId = 'reader-session-morph-quickAutoPage';
const stageId = 'reader-reading-stage';
const matrix = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

function fixture() {
  const e = (eventSeq, kind, payload) => ({ eventSeq, kind, instanceId, payload:{readingId,...payload} });
  const event = (eventSeq, phase, facts) => e(eventSeq, 'reading.control-effect', {kind:'capsule-launch', phase, facts});
  const window = { id:'window', rectPx:{ left:0, top:0, width:400, height:800 }, density:1 };
  const node = (id, rectPx) => ({id, rectPx, visible:true, opacity:1});
  const stage = node(stageId, {left:0, top:0, width:400, height:800});
  const source = node(sourceId, {left:40, top:500, width:286, height:196});
  const proxy = { id:'reader-session-launch-proxy', mounted:true, uniqueId:1,
    windowOriginVp:{x:40,y:500}, layoutRectVp:{x:40,y:500,width:286,height:196},
    matrix:[...matrix], rotation:{angle:0}, zIndex:0, inspectorSource:'FrameNode.getInspectorInfo' };
  const frame = { index:0, frameTimeNs:1e6, publishedTickMs:100, timeMs:0, phase:'flight',
    controlsPresented:true, sourceNeeded:true, actors:[proxy, {id:'reader-session-launch-blur',mounted:false}] };
  const admission = { generation:3, type:'autoPage', kind:'quickAutoPage', source:{level:'secondary',module:'autoPage',form:'quick'},
    sourceActorId:sourceId, startTimeMs:100, reducedMotion:false, geometry:{ kind:'quickAutoPage',type:'autoPage',
      sourceLeft:40, sourceTop:500, sourceWidth:286, sourceHeight:196, dotLeft:280, targetLeft:210, targetTop:760,
      capsuleWidth:96, capsuleHeight:24, sourceRadius:8, sourceClipLeft:0, sourceClipTop:0, sourceClipRightInset:0,
      sourceClipBottomInset:0, contentBaseOffset:-1, contentFinalScale:.084, contentFinalTranslateX:-131,
      contentFinalTranslateY:-86, topBarExitDistance:30, dockExitDistance:400, footerStart:101.45, footerDot:72, footerEnd:0 },
  };
  const context = {
    actions:{ 'enter-reading':{beforeSeq:3, afterSeq:9}, 'playback-launch':{
      instanceId, actionId:'normal-play', op:'click', beforeSeq:14, afterSeq:32 } },
    samples:{ [launch.baseline]:{instanceId, window, afterSeq:13, nodes:[stage,source]},
      [launch.sample]:{instanceId, window, beforeSeq:33, nodes:[stage]} },
    candidate:{ ownerSources:Object.fromEntries(caseDefinition.ownerSources.map(path => [path,
      sha256(readFileSync(new URL('../../../' + path, import.meta.url)))])) },
    events:[
      e(7,'reading.ready',{localBook:true, mode:'paged', reducedMotion:false}),
      event(18,'admitted',admission),
      event(22,'frame-block',{generation:3, blockIndex:0, blockCount:2, finalBlock:false,
        droppedSamples:0, endReason:'visual-settled', frames:[frame] }),
    ],
  };
  return { context, proxy };
}

test('an exact production capsule sampler can assess a recorded actor with missing later blocks', () => {
  const { context } = fixture();
  const result = evaluateMotion(launch, context);
  assert.equal(result.verdict, 'NOT_RUN');
  assert.ok(!result.actual.findings.some(item => item.field === 'deployed-timeline-identity'));
  assert.doesNotThrow(() => jsonDigest(result));
});

test('the Full capsule flight compares captured ArkUI geometry without changing its tolerance', () => {
  const fullCase = JSON.parse(readFileSync(new URL('../cases/reading.control-autopage-launch-full.json', import.meta.url), 'utf8'));
  const fullLaunch = fullCase.assertions.find(assertion => assertion.action === 'playback-launch');
  const { context, proxy } = fixture();
  const admission = context.events[1].payload.facts;
  const kind = 'fullAutoPagePlayback';
  const sourceActorId = 'reader-session-morph-fullAutoPagePlayback';
  const geometry = { ...admission.geometry, kind, sourceActorId, sourceLeft:37.142857142857146,
    sourceTop:179.85714285714286, sourceWidth:291.42855398995533, sourceHeight:104.39099993024554,
    targetLeft:244.71428571428572, targetTop:747.1428571428571, dotLeft:316.7142857142857, dockExitDistance:698.2857142857143 };
  Object.assign(admission, {kind, sourceActorId, geometry, source:{...admission.source, form:'full'}});
  const baseline = context.samples[launch.baseline];
  context.samples[fullLaunch.baseline] = {...baseline, nodes:[baseline.nodes[0], {
    ...baseline.nodes[1], id:sourceActorId, rectPx:{left:geometry.sourceLeft,top:geometry.sourceTop,
      width:geometry.sourceWidth,height:geometry.sourceHeight},
  }]};
  const dock = {...proxy, id:'reader-control-motion-dock', uniqueId:2, translateVp:{x:0,y:694.36,z:0}};
  // Independently calculated 0, 80 and 140ms points for the final cubic over the measured source.
  const points = [
    [0,37.143,179.857,291.429,104.391],
    [80,251.398,614.608,86.479,42.782],
    [140,300.841,714.933,39.184,28.564],
  ];
  const block = context.events[2].payload.facts;
  const initial = block.frames[0];
  block.frames = points.map(([timeMs,x,y,width,height], index) => ({
    ...initial, index, timeMs, phase:'flight', frameTimeNs:(index + 1) * 15e6, publishedTickMs:100 + timeMs,
    actors:[{...proxy, windowOriginVp:{x,y}, layoutRectVp:{x,y,width,height}},
      initial.actors[1], ...(index === 2 ? [dock] : [])],
  }));
  const compare = () => evaluateMotion(fullLaunch, context).actual.findings.filter(item =>
    item.field === 'proxy-window-geometry' || item.field === 'dock-translation');
  assert.deepEqual(compare(), []);
  block.frames[0].actors[0].windowOriginVp.y += 1.25;
  dock.translateVp.y += 1.25;
  assert.deepEqual(compare().map(item => item.field), ['proxy-window-geometry','dock-translation']);
});

test('a mounted obsolete blur actor violates the new capsule flight', () => {
  const { context } = fixture();
  context.events[2].payload.facts.frames[0].actors[1].mounted = true;
  const result = evaluateMotion(launch, context);
  assert.equal(result.verdict, 'FAIL');
  assert.ok(result.actual.findings.some(item => item.field === 'no-obsolete-blur-actor' && !item.missing));
});

test('a capsule transform violation is retained despite later missing blocks', () => {
  const { context, proxy } = fixture();
  proxy.matrix[4] = .2;
  const result = evaluateMotion(launch, context);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.reason, 'proxy-matrix observed deviation');
  assert.equal(result.observationsComplete, false);
});

test('a capsule timeline from another source digest cannot supply the expectation', () => {
  const timelineDependency = 'entry/src/main/ets/ui/foundation/MotionTimeline.ts';
  for (const path of [capsuleModelInputs[0], timelineDependency]) {
    const { context, proxy } = fixture();
    proxy.matrix[4] = .2;
    assert.ok(context.candidate.ownerSources[path]);
    context.candidate.ownerSources[path] = '0'.repeat(64);
    const result = evaluateMotion(launch, context);
    assert.equal(result.verdict, 'NOT_RUN');
    assert.equal(result.reason, 'deployed-timeline-identity lacks comparable evidence');
  }
});

test('a missing stable capsule endpoint retains verifiable in-action native deviations', () => {
  const { context, proxy } = fixture();
  delete context.samples[launch.sample];
  proxy.matrix[4] = .2;
  const result = evaluateMotion(launch, context);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.reason, 'proxy-matrix observed deviation');
  assert.equal(result.observationsComplete, false);
  assert.ok(result.actual.findings.some(item => item.field === 'stable-capsule-endpoint' && item.missing));
});

test('a missing endpoint cannot attach capsule events emitted outside the bound action', () => {
  const { context, proxy } = fixture();
  delete context.samples[launch.sample];
  proxy.matrix[4] = .2;
  context.events[2].eventSeq = 35;
  const result = evaluateMotion(launch, context);
  assert.equal(result.verdict, 'NOT_RUN');
  assert.ok(result.actual.findings.every(item => item.missing));
});

test('private actor read durations explain what was measured without subtracting from frame cadence', () => {
  const { context } = fixture();
  const logged = context.events[2].payload.facts.frames[0];
  const frames = [
    { ...logged, captureStartMs:101, captureEndMs:103 },
    { ...logged, index:1, frameTimeNs:16e6, captureStartMs:116, captureEndMs:119 },
    { ...logged, index:2, frameTimeNs:31e6, captureStartMs:131, captureEndMs:149 },
    { ...logged, index:3, frameTimeNs:181e6, previousHostUpdateMs:150, callbackQueuedMs:152,
      callbackEnteredMs:281, nextAdvanceTickMs:284, captureStartMs:285 },
    { ...logged, index:4, frameTimeNs:331e6 },
    { ...logged, index:5, frameTimeNs:346e6 },
  ];
  context.events[2].payload.facts.frames = frames.slice(0, 2);
  context.events.push({
    ...context.events[2], eventSeq:23, payload:{ ...context.events[2].payload,
      facts:{ ...context.events[2].payload.facts, blockIndex:1, finalBlock:true, frames:frames.slice(2) } },
  });
  const result = evaluateMotion(launch, context);
  assert.equal(result.verdict, 'NOT_RUN');
  assert.deepEqual(result.actual.probeRead, {
    measuredFrames:3, opaqueFrames:3, maximumReadMs:18,
    firstExcessGap:{from:2,to:3,intervalMs:150,precedingReadMs:18},
    excessGaps:[
      {from:2,to:3,intervalMs:150,precedingReadMs:18,precedingDesignMs:0,followingDesignMs:0,
        previousReadToHostUpdateMs:1,hostUpdateToQueueMs:2,callbackQueueWaitMs:129,callbackEntryToAdvanceMs:3,advanceToReadMs:1},
      {from:3,to:4,intervalMs:150,precedingReadMs:null,precedingDesignMs:0,followingDesignMs:0,
        previousReadToHostUpdateMs:null,hostUpdateToQueueMs:null,callbackQueueWaitMs:null,callbackEntryToAdvanceMs:null,advanceToReadMs:null},
    ],
  });
  const cadence = result.actual.findings.find(item => item.field === 'capsule-frame-cadence');
  assert.equal(cadence.actual, 150);
  assert.deepEqual(cadence.expected, {maximum:45,gapFrame:3});
});

test('the TTS flight and pause are both required after current system playback starts', () => {
  const def = JSON.parse(readFileSync(new URL('../cases/reading.control-tts-launch-quick.json', import.meta.url), 'utf8'));
  const flight = def.assertions.find(assertion => assertion.action === 'playback-launch');
  const pause = def.assertions.find(assertion => assertion.action === 'pause-playback');
  const timeline = (eventSeq, phase, facts) => ({ eventSeq, instanceId, channel:'business', kind:'reading.control-effect',
    payload:{ readingId, kind:'capsule-launch', phase, facts } });
  const ready = { eventSeq:7, instanceId, channel:'business', kind:'reading.ready', payload:{ readingId, localBook:true } };
  const availability = timeline(18, 'tts-availability', { engine:'system', resolved:true, status:'unavailable' });
  const admitted = timeline(19, 'admitted', { generation:3, type:'tts' });
  const playing = timeline(20, 'business-ack', { generation:3, type:'tts', status:'playing' });
  const failed = timeline(21, 'cancel-request', { generation:3, type:'tts', cancelReason:'failure' });
  const context = {
    actions:{ 'enter-reading':{ beforeSeq:2, afterSeq:9 },
      'playback-launch':{ instanceId, beforeSeq:10, afterSeq:30 } },
    events:[ready, availability, admitted, playing],
  };
  for (const assertion of [flight,pause]) {
    assert.deepEqual(systemSpeechApplicability(assertion,context),
      { required:true, status:'SYSTEM_PLAYING', availabilitySeq:18, playingSeq:20, failureSeq:null });
    context.events = [ready, availability, admitted, { ...playing, instanceId:'wrong-reading' }, failed];
    assert.deepEqual(systemSpeechApplicability(assertion,context),
      { required:false, status:'SYSTEM_UNAVAILABLE', availabilitySeq:18, playingSeq:null, failureSeq:21 });
    context.events = [ready, availability, admitted, { ...failed, payload:{ ...failed.payload,
      facts:{ ...failed.payload.facts, generation:999 } } }];
    assert.equal(systemSpeechApplicability(assertion,context).status,'UNVERIFIED');
    assert.equal(systemSpeechApplicability(assertion,context).required,true);
    context.events = [ready, availability, admitted, playing];
  }
  assert.equal(systemSpeechApplicability(launch,context),null);
});

test('capsule pause requires actual playing and the same playback generation and native toggle', () => {
  const pause = caseDefinition.assertions.find(assertion => assertion.action === 'pause-playback');
  const {context} = fixture();
  const baseline = context.samples[pause.baseline];
  baseline.afterSeq = 35;
  const toggle = {id:'reader-session-launch-toggle',key:'1287',visible:true,opacity:1};
  baseline.nodes.push(toggle);
  context.samples[pause.sample] = {...baseline,beforeSeq:45,afterSeq:45,nodes:[{...toggle}]};
  context.actions[pause.action] = {instanceId,op:'click',beforeSeq:36,afterSeq:42};
  const admission = context.events[1];
  admission.channel = 'business';
  function playback(seq, phase, status, overrides = {}) {
    return {...admission,eventSeq:seq,payload:{...admission.payload,phase,
      facts:{type:'autoPage',generation:3,status,...overrides}}};
  }
  const playing = playback(20,'business-ack','playing');
  const paused = playback(40,'business-paused','paused');
  const history = context.events.slice();
  const validate = (events = [playing,paused]) => {
    context.events = [...history,...events];
    return evaluateMotion(pause,context);
  };
  assert.equal(validate().verdict,'PASS');
  assert.equal(validate([playing,paused,playback(41,'business-ack','paused')]).verdict,'PASS');
  assert.equal(validate([paused]).verdict,'NOT_RUN');
  assert.equal(validate([playing,playback(40,'business-ack','paused',{type:'tts'})]).verdict,'FAIL');
  assert.equal(validate([playing,playback(40,'business-paused','paused',{generation:4})]).verdict,'FAIL');
  context.samples[pause.sample].nodes[0].key = '1299';
  assert.equal(validate().reason,'paused-capsule-native-mount observed deviation');
  delete context.samples[pause.sample].nodes[0].key;
  assert.equal(validate().verdict,'NOT_RUN');
});

const handoffCase = JSON.parse(readFileSync(new URL('../cases/reading.control-autopage-capsule-handoff.json', import.meta.url), 'utf8'));
const quickHandoff = handoffCase.assertions.find(assertion => assertion.action === 'return-from-capsule');
const handoff = structuredClone(quickHandoff);
delete handoff.expected.requireAutoPagePauseRetention;

function handoffFixture() {
  const {context} = fixture();
  const host = 'reader-reading-interaction-host-paged';
  const toggle = 'reader-session-launch-toggle';
  const window = context.samples[launch.baseline].window;
  const node = (id,path,parentPath,properties = {}) => ({id,path,parentPath,visible:true,opacity:1,...properties});
  context.candidate.ownerSources = Object.fromEntries(handoffCase.ownerSources.map(path =>
    [path,sha256(readFileSync(new URL('../../../' + path,import.meta.url)))]));
  context.actions['pause-playback'] = {instanceId,op:'click',targetId:toggle,beforeSeq:35,afterSeq:41};
  context.actions['return-from-capsule'] = {instanceId,op:'click',targetId:host,from:'capsule-paused',beforeSeq:47,afterSeq:51};
  context.samples['capsule-paused'] = {instanceId,window,beforeSeq:43,afterSeq:44,captureComplete:true,
    nodes:[node(stageId,'0'),node(host,'0/1','0'),node(toggle,'0/2','0')]};
  context.samples['capsule-returned'] = {instanceId,window,beforeSeq:58,afterSeq:59,captureComplete:true,
    nodes:[node(stageId,'0'),node('reader-control-module-autoPage','0/1','0'),
      node('reader-control-autopage-transport-toggle','0/1/1','0/1',{enabled:true})]};
  const admission = context.events[1];
  admission.channel = 'business';
  const event = (eventSeq, phase, facts) => ({
    eventSeq, instanceId, kind:'reading.control-effect', channel:'business',
    payload:{readingId,kind:'capsule-launch',phase,facts:{type:'autoPage',kind:'quickAutoPage',generation:3,...facts}},
  });
  const returned = (eventSeq, phase, ownership) =>
    event(eventSeq,phase,{ownership,status:'playing',desiredPlaying:false,cancelReason:'openControl',timeMs:380});
  const fadeFrame = (elapsed, opacity) => ({observedMs:4000 + elapsed,stageId:42,quickId:57,opacity,quickVisible:true});
  const fade = event(54,'handoff-fade',{
    source:'FrameNode.getOpacity',frameLimitReached:false,start:fadeFrame(0,1),endpoint:fadeFrame(200,0),
    frames:[0.86,0.71,0.57,0.45,0.34,0.25,0.17,0.10,0.05,0.02,0.01].map((opacity,index) => {
      const elapsed = (index + 1) * 16;
      return {...fadeFrame(elapsed,opacity),frameTimeNs:(4000 + elapsed) * 1e6};
    }),
  });
  fade.channel = 'motion';
  context.events.push(
    event(21,'business-ack',{status:'playing'}),
    event(30,'timeline-finished',{timeMs:380}),
    event(40,'business-paused',{status:'paused'}),
    returned(50,'cancel-request','handoffPending'),
    returned(53,'handoff-ready','exitPending'),
    fade,
    returned(55,'retired','released'),
  );
  const phase = phase => context.events.find(event => event.payload.phase === phase);
  return {context, phase, evaluate:() => evaluateMotion(handoff,context), node};
}

const interruptedLaunchCase = JSON.parse(readFileSync(new URL('../cases/reading.control-autopage-launch-interrupted.json',import.meta.url),'utf8'));
const interruptedLaunch = interruptedLaunchCase.assertions.find(assertion => assertion.action === 'interrupt-launch');

function interruptedLaunchFixture() {
  const {context,phase,node} = handoffFixture();
  context.candidate.ownerSources = Object.fromEntries(interruptedLaunchCase.ownerSources.map(path =>
    [path,sha256(readFileSync(new URL('../../../' + path,import.meta.url)))]));
  context.samples[interruptedLaunch.baseline] = context.samples[launch.baseline];
  const final = context.samples['capsule-returned'];
  context.samples[interruptedLaunch.sample] = final;
  Object.assign(final.nodes[1], {path:'0/1/0',parentPath:'0/1'});
  Object.assign(final.nodes[2], {path:'0/1/0/1',parentPath:'0/1/0'});
  final.nodes.push(node(sourceId,'0/1','0'),node('reader-control-collapse','0/2','0',{enabled:false}));
  context.actions[interruptedLaunch.action] = {instanceId,op:'clickThenReaderCenter',
    targetId:'reader-control-autopage-transport-toggle',beforeSeq:14,afterSeq:56,
    dispatch:{dispatchGapMs:240,probeSeq:71}};
  context.events = context.events.filter(event => !['business-paused','timeline-finished'].includes(event.payload.phase));
  const admission = phase('admitted');
  const play = phase('business-ack');
  const hidden = {...play,eventSeq:30,payload:{...play.payload,phase:'panel-hidden',
    facts:{...play.payload.facts,timeMs:162,controlsPresented:false}}};
  context.events.push(hidden);
  for (const name of ['cancel-request','handoff-ready','retired']) {
    Object.assign(phase(name).payload.facts,{timeMs:255,autoPageStatus:'running',desiredPlaying:true});
  }
  const block = phase('frame-block');
  block.channel = 'motion';
  block.eventSeq = 56;
  Object.assign(block.payload.facts,{blockCount:1,finalBlock:true,endReason:'openControl',
    frames:[192,208,224,240].map((timeMs,index) => ({index,timeMs,frameTimeNs:(index+1)*16e6,actors:[{
      id:'reader-session-launch-proxy',mounted:true,uniqueId:50,
      windowOriginVp:{x:175 + index,y:400 + index},layoutRectVp:{width:60 - index,height:30 - index},
    }]})),
  });
  const fade = phase('handoff-fade').payload.facts;
  fade.quickActorId = 'reader-control-module-autoPage';
  fade.receiverActorId = sourceId;
  for (const frame of [fade.start,...fade.frames,fade.endpoint]) {
    Object.assign(frame,{receiverId:60,receiverVisible:true});
  }
  return {context,phase,hidden,admission,block,fade,final,evaluate:() => evaluateMotion(interruptedLaunch,context)};
}

test('an AutoPage initiation interruption proves the in-flight cut and an independently running playback owner', () => {
  assert.equal(interruptedLaunchFixture().evaluate().verdict,'PASS');
  for (const [mutate,verdict,reason] of [
    [({phase}) => { phase('cancel-request').payload.facts.cancelReason = 'stop'; },
      'FAIL','launch-interruption-cancel-request observed deviation'],
    [({phase}) => { phase('retired').payload.facts.autoPageStatus = 'paused'; },
      'FAIL','launch-interruption-retired observed deviation'],
    [({context,phase}) => {
      const late = phase('retired');
      context.events.push({...late,eventSeq:57,payload:{...late.payload,phase:'timeline-finished'}});
    },'FAIL','launch-interruption-obsolete-timeline observed deviation'],
    [({context,hidden}) => {context.events = context.events.filter(event => event !== hidden);},
      'NOT_RUN','launch-interruption-in-flight-cut lacks comparable evidence'],
    [({phase}) => {
      for (const name of ['cancel-request','handoff-ready','retired']) phase(name).payload.facts.timeMs = 380;
    },'NOT_RUN','launch-interruption-in-flight-cut lacks comparable evidence'],
    [({block}) => { block.payload.facts.endReason = 'visual-settled'; },
      'NOT_RUN','launch-interruption-native-flight lacks comparable evidence'],
    [({block}) => { block.payload.facts.frames[3].actors[0].uniqueId++; },
      'FAIL','launch-interruption-native-flight observed deviation'],
    [({fade}) => { fade.frames[3].receiverId++; },
      'FAIL','capsule-handoff-native-fade observed deviation'],
    [({final}) => { final.nodes[3].id = 'reader-session-morph-fullAutoPagePlayback'; },
      'FAIL','launch-interruption-native-endpoint observed deviation'],
  ]) {
    const fixture = interruptedLaunchFixture();
    mutate(fixture);
    const result = fixture.evaluate();
    assert.equal(result.verdict,verdict,JSON.stringify(result.actual));
    assert.equal(result.reason,reason);
  }
});

const ttsInterruptionCase = JSON.parse(readFileSync(new URL('../cases/reading.control-tts-launch-interrupted.json',import.meta.url),'utf8'));
const ttsInterruption = ttsInterruptionCase.assertions.find(assertion=>assertion.action === 'interrupt-launch');

function addPendingSystemSpeech(fixture, offset, speechChanges = {}) {
  const pending = structuredClone(fixture.phase('business-ack'));
  pending.eventSeq += offset;
  Object.assign(pending.payload.facts.tts,{audioStarted:false,...speechChanges});
  fixture.context.events.push(pending);
}

function ttsInterruptionFixture() {
  const {context,phase,hidden,admission,block,fade,final} = interruptedLaunchFixture();
  const actorId = 'reader-session-morph-quickTts';
  const moduleId = 'reader-control-module-tts';
  const transport = 'reader-control-tts-transport-toggle';
  const identity = {type:'tts',kind:'quickTts'};
  const audio = {engine:'system',sessionGeneration:9,status:'playing',audioStarted:true,audioSession:'active'};
  context.candidate.ownerSources = Object.fromEntries(ttsInterruptionCase.ownerSources.map(path =>
    [path,sha256(readFileSync(new URL('../../../' + path,import.meta.url)))]));
  context.actions[ttsInterruption.action].targetId = transport;
  context.samples[ttsInterruption.baseline] = context.samples[interruptedLaunch.baseline];
  context.events.find(event=>event.kind === 'reading.ready').channel = 'business';
  for (const event of context.events) {
    if (event.payload.facts?.type === 'autoPage') Object.assign(event.payload.facts,identity);
  }
  admission.payload.facts.source.module = 'tts';
  admission.payload.facts.sourceActorId = actorId;
  const playing = phase('business-ack');
  for (const name of ['business-ack','cancel-request','handoff-ready','retired']) phase(name).payload.facts.tts = {...audio};
  const availability = {...playing,eventSeq:16,payload:{...playing.payload,phase:'tts-availability',
    facts:{engine:'system',resolved:true,status:'idle'}}};
  context.events.push(availability);
  fade.quickActorId = moduleId;
  fade.receiverActorId = actorId;
  const [,module,button,actor] = final.nodes;
  Object.assign(actor,{id:actorId,type:'Stack',visibleRectPx:{left:20,top:512,width:360,height:224}});
  Object.assign(module,{id:moduleId,type:'Scroll',visibleRectPx:actor.visibleRectPx});
  Object.assign(button,{id:transport,type:'Button',enabled:true,clickable:true,
    hitTestMode:'HitTestMode.Default',visibleRectPx:{left:180,top:569,width:40,height:40}});
  final.window.visibleRectPx = final.window.rectPx;
  final.window.keyboard = {visible:false};
  return {context,phase,hidden,admission,availability,playing,block,fade,actor,button,
    evaluate:()=>evaluateMotion(ttsInterruption,context)};
}

test('a Quick TTS launch interruption binds the same active system speech through the native return', () => {
  const current = ttsInterruptionFixture();
  assert.equal(current.evaluate().verdict,'PASS');
  assert.equal(systemSpeechApplicability(ttsInterruption,current.context,ttsInterruptionCase).status,'SYSTEM_PLAYING');
  current.playing.eventSeq = 31;
  assert.equal(current.evaluate().verdict,'PASS','audio may start after the panel hides and before the cut');
  addPendingSystemSpeech(current,-2);
  assert.equal(current.evaluate().verdict,'PASS','the same session may publish playing before its native onStart');

  const unavailable = ttsInterruptionFixture();
  unavailable.availability.payload.facts.status = 'unavailable';
  unavailable.context.events = unavailable.context.events.filter(event=>event !== unavailable.playing);
  const failure = unavailable.phase('cancel-request').payload.facts;
  failure.cancelReason = 'failure';
  Object.assign(failure.tts,{status:'unavailable',audioStarted:false,audioSession:'inactive'});
  assert.equal(systemSpeechApplicability(ttsInterruption,unavailable.context,ttsInterruptionCase).status,'SYSTEM_UNAVAILABLE');
  failure.tts.audioStarted = true;
  assert.equal(systemSpeechApplicability(ttsInterruption,unavailable.context,ttsInterruptionCase).status,'UNVERIFIED');
});

test('a Quick TTS launch interruption rejects changed audio, stale visuals and unproven overlap', () => {
  for (const [mutate,verdict,reason] of [
    [({playing})=>{ playing.payload.facts.tts.engine = 'http'; },
      'FAIL','launch-interruption-system-speech observed deviation'],
    [fixture=>{
      addPendingSystemSpeech(fixture,-1);
      fixture.playing.eventSeq = fixture.phase('cancel-request').eventSeq+1;
    },
      'NOT_RUN','launch-interruption-system-speech lacks comparable evidence'],
    [fixture=>addPendingSystemSpeech(fixture,-1,{sessionGeneration:10}),
      'FAIL','launch-interruption-system-speech observed deviation'],
    [fixture=>addPendingSystemSpeech(fixture,1),
      'FAIL','launch-interruption-system-speech observed deviation'],
    [({phase})=>{ phase('cancel-request').payload.facts.tts.status = 'paused'; },
      'FAIL','launch-interruption-cancel-request observed deviation'],
    [({phase})=>{ phase('handoff-ready').payload.facts.tts.sessionGeneration++; },
      'FAIL','launch-interruption-handoff-ready observed deviation'],
    [({phase})=>{ phase('retired').payload.facts.tts.audioSession = 'inactive'; },
      'FAIL','launch-interruption-retired observed deviation'],
    [({context,admission})=>{
      const duplicate = structuredClone(admission);
      duplicate.eventSeq++;
      duplicate.payload.facts.generation++;
      context.events.push(duplicate);
    },'FAIL','launch-interruption-admission observed deviation'],
    [({context,hidden})=>{ context.events = context.events.filter(event=>event !== hidden); },
      'NOT_RUN','launch-interruption-in-flight-cut lacks comparable evidence'],
    [({context,phase})=>{
      const late = phase('retired');
      context.events.push({...late,eventSeq:57,payload:{...late.payload,phase:'timeline-finished'}});
    },'FAIL','launch-interruption-obsolete-timeline observed deviation'],
    [({actor})=>{ actor.opacity = 0; },'FAIL','launch-interruption-native-endpoint observed deviation'],
    [({button})=>{ button.clickable = false; },'FAIL','capsule-handoff-native-quick-tts-transport observed deviation'],
    [({fade})=>{ fade.frames[2].receiverId++; },'FAIL','capsule-handoff-native-fade observed deviation'],
  ]) {
    const fixture = ttsInterruptionFixture();
    mutate(fixture);
    const result = fixture.evaluate();
    assert.equal(result.verdict,verdict,JSON.stringify(result.actual));
    assert.equal(result.reason,reason);
  }
});

test('a capsule handoff requires the paused launch, actual center tap and restored native Quick controls', () => {
  const {context,evaluate,phase,node} = handoffFixture();
  assert.equal(evaluate().verdict,'PASS');
  context.actions[handoff.action].targetId = 'reader-session-launch-toggle';
  assert.equal(evaluate().reason,'capsule-handoff-input observed deviation');
  context.actions[handoff.action].targetId = 'reader-reading-interaction-host-paged';
  phase('business-paused').payload.facts.generation += 1;
  assert.equal(evaluate().reason,'capsule-handoff-paused-origin observed deviation');
  phase('business-paused').payload.facts.generation -= 1;
  const after = context.samples[handoff.sample];
  after.nodes.push(node('reader-session-launch-proxy','0/4','0'));
  assert.equal(evaluate().reason,'capsule-handoff-native-endpoint observed deviation');
  after.nodes.pop();
  after.nodes[2].parentPath = '0';
  assert.equal(evaluate().reason,'capsule-handoff-native-endpoint observed deviation');
  after.nodes[2].parentPath = '0/1';
  delete after.nodes[2].enabled;
  assert.equal(evaluate().verdict,'NOT_RUN');
});

test('a capsule handoff rejects measured fade reversal, remount and restored Quick disappearance', () => {
  for (const mutate of [
    trace => { trace.frames[5].opacity = 0.8; },
    trace => {
      trace.frames[4].opacity = 0.43;
      trace.frames[5].opacity = 0.45;
      trace.frames[6].opacity = 0.47;
    },
    trace => { trace.frames[5].stageId += 1; },
    trace => { trace.frames[5].quickId += 1; },
    trace => { trace.frames[5].quickVisible = false; },
    trace => { trace.endpoint.opacity = 0.17; },
  ]) {
    const {phase,evaluate} = handoffFixture();
    mutate(phase('handoff-fade').payload.facts);
    const result = evaluate();
    assert.equal(result.verdict,'FAIL');
    assert.equal(result.reason,'capsule-handoff-native-fade observed deviation');
  }
});

test('a capsule handoff leaves stale, cancelled, unmeasured and unbounded fade evidence incomplete', () => {
  for (const mutate of [
    ({context,phase}) => { context.events = context.events.filter(event => event !== phase('handoff-fade')); },
    ({phase}) => { phase('handoff-fade').payload.facts.generation += 1; },
    ({phase}) => { phase('handoff-fade').payload.readingId = 'superseded-reading'; },
    ({phase}) => { phase('handoff-fade').eventSeq = 49; },
    ({phase}) => { phase('handoff-fade').eventSeq = 56; },
    ({phase}) => { phase('handoff-fade').payload.facts.frameLimitReached = true; },
    ({phase}) => { delete phase('handoff-fade').payload.facts.frames[5].opacity; },
    ({phase}) => { phase('handoff-fade').payload.facts.frames.forEach(frame => { frame.opacity = 0; }); },
    ({phase}) => {
      const frames = phase('handoff-fade').payload.facts.frames;
      frames.splice(3,4);
    },
  ]) {
    const current = handoffFixture();
    mutate(current);
    const result = current.evaluate();
    assert.equal(result.verdict,'NOT_RUN');
    assert.equal(result.reason,'capsule-handoff-native-fade lacks comparable evidence');
    assert.doesNotThrow(() => jsonDigest(result));
  }
});

test('a capsule handoff preserves wrong generation, order or pose and keeps a missing endpoint incomplete', () => {
  for (const [mutate, verdict, reason] of [
    [({phase}) => { phase('cancel-request').payload.facts.generation = 7; }, 'FAIL',
      'capsule-handoff-cancel-request observed deviation'],
    [({phase}) => { phase('handoff-ready').eventSeq = 49; }, 'FAIL','capsule-handoff-event-order observed deviation'],
    [({phase}) => { phase('retired').payload.facts.ownership = 'exitPending'; }, 'FAIL',
      'capsule-handoff-retired observed deviation'],
    [({phase}) => { phase('retired').payload.facts.timeMs = 3501; }, 'FAIL','capsule-handoff-frozen-clock observed deviation'],
    [({phase}) => { phase('handoff-ready').instanceId = 'another-reader'; }, 'NOT_RUN',
      'capsule-handoff-handoff-ready lacks comparable evidence'],
    [({phase}) => { phase('retired').eventSeq = 60; }, 'NOT_RUN','capsule-handoff-retired lacks comparable evidence'],
    [({context}) => { delete context.samples[handoff.sample]; }, 'NOT_RUN','stable-capsule-endpoint lacks comparable evidence'],
    [({context,phase}) => {
      delete context.samples[handoff.sample];
      phase('cancel-request').payload.facts.cancelReason = 'stop';
    }, 'FAIL','capsule-handoff-cancel-request observed deviation'],
  ]) {
    const current = handoffFixture();
    mutate(current);
    const result = current.evaluate();
    assert.equal(result.verdict,verdict);
    assert.equal(result.reason,reason);
    assert.doesNotThrow(() => jsonDigest(result));
  }
});

test('an AutoPage Quick capsule handoff requires the actual timer to remain manually paused', () => {
  const {context,phase} = handoffFixture();
  const result = () => evaluateMotion(quickHandoff,context);
  const returnPhases = ['cancel-request','handoff-ready','retired'];
  const launchAction = context.actions[quickHandoff.expected.openAction];
  launchAction.targetId = 'reader-control-autopage-transport-toggle';
  const paused = phase('business-paused').payload.facts;
  Object.assign(paused,{reason:'manual',desiredPlaying:false});
  for (const name of returnPhases) phase(name).payload.facts.autoPageStatus = 'paused';
  const fade = phase('handoff-fade').payload.facts;
  fade.quickActorId = 'reader-control-module-autoPage';
  assert.equal(result().verdict,'PASS');

  for (const name of returnPhases) {
    const facts = phase(name).payload.facts;
    facts.autoPageStatus = 'running';
    assert.equal(evaluateMotion(handoff,context).verdict,'PASS','v2 preserves its original pause-intent scope');
    assert.equal(result().reason,'capsule-handoff-autopage-remains-paused observed deviation');
    delete facts.autoPageStatus;
    assert.equal(result().verdict,'NOT_RUN');
    facts.autoPageStatus = 'paused';
  }
  paused.reason = 'touch';
  assert.equal(result().reason,'capsule-handoff-paused-origin observed deviation');
  paused.reason = 'manual';
  paused.desiredPlaying = true;
  assert.equal(result().reason,'capsule-handoff-paused-origin observed deviation');
  paused.desiredPlaying = false;
  delete paused.kind;
  assert.equal(result().verdict,'NOT_RUN');
  paused.kind = 'quickAutoPage';

  launchAction.targetId = 'reader-session-launch-toggle';
  assert.equal(result().reason,'capsule-handoff-source-transport observed deviation');
  launchAction.targetId = 'reader-control-autopage-transport-toggle';
  fade.quickActorId = 'reader-control-module-tts';
  assert.equal(result().reason,'capsule-handoff-native-fade observed deviation');
  fade.quickActorId = 'reader-control-module-autoPage';
  const step = handoffCase.steps.find(item => item.id === quickHandoff.sample);
  const endpoint = context.samples[quickHandoff.sample];
  endpoint.window = {...endpoint.window,keyboard:{visible:false}};
  endpoint.nodes.length = 1;
  assert.equal(sampleReadiness(step,endpoint,handoffCase.fixture.bookTitle),null,'the actual collector preserves a complete wrong endpoint');
  assert.equal(result().reason,'capsule-handoff-native-endpoint observed deviation');
});

const fullHandoffCase = JSON.parse(readFileSync(new URL('../cases/reading.control-autopage-capsule-handoff-full.json', import.meta.url), 'utf8'));
const fullHandoff = fullHandoffCase.assertions.find(assertion => assertion.action === 'return-from-capsule');

function fullHandoffFixture() {
  const {context,phase,node} = handoffFixture();
  context.candidate.ownerSources = Object.fromEntries(fullHandoffCase.ownerSources.map(path =>
    [path,sha256(readFileSync(new URL('../../../' + path,import.meta.url)))]));
  context.actions['playback-launch'].targetId = 'reader-control-autopage-transport-toggle';
  const fullActor = 'reader-session-morph-fullAutoPagePlayback';
  const admission = phase('admitted').payload.facts;
  admission.source.form = 'full';
  admission.sourceActorId = fullActor;
  for (const event of context.events) {
    if (event.payload.facts?.type === 'autoPage') event.payload.facts.kind = 'fullAutoPagePlayback';
  }
  Object.assign(phase('business-paused').payload.facts,{reason:'manual',desiredPlaying:false});
  for (const name of ['cancel-request','handoff-ready','retired']) {
    phase(name).payload.facts.autoPageStatus = 'paused';
  }
  const fade = phase('handoff-fade').payload.facts;
  fade.quickActorId = 'reader-control-module-autoPage';
  fade.receiverActorId = fullActor;
  for (const frame of [fade.start,...fade.frames,fade.endpoint]) {
    Object.assign(frame,{receiverId:60,receiverVisible:true});
  }
  const after = context.samples['capsule-returned'];
  Object.assign(after.nodes[2],{path:'0/1/0/1',parentPath:'0/1/0'});
  after.nodes.push(node(fullActor,'0/1/0','0/1'),
    node('reader-control-collapse','0/2','0',{enabled:true}));
  return {context,phase,fade,after,evaluate:() => evaluateMotion(fullHandoff,context)};
}

test('an AutoPage Full capsule handoff requires the manual press, real release and one stable Full playback actor', () => {
  assert.equal(fullHandoffFixture().evaluate().verdict,'PASS');
  for (const [mutate,verdict,reason] of [
    [({phase}) => { phase('business-paused').payload.facts.reason = 'touch'; },
      'FAIL','capsule-handoff-paused-origin observed deviation'],
    [({phase}) => { phase('retired').payload.facts.ownership = 'exitPending'; },
      'FAIL','capsule-handoff-retired observed deviation'],
    [({phase}) => { phase('retired').payload.facts.autoPageStatus = 'running'; },
      'FAIL','capsule-handoff-autopage-remains-paused observed deviation'],
    [({phase}) => { phase('admitted').payload.facts.sourceActorId = 'reader-session-morph-quickAutoPage'; },
      'FAIL','capsule-handoff-full-source observed deviation'],
    [({after}) => {
      after.nodes[3].id = 'reader-session-morph-quickAutoPage';
      after.nodes[4].enabled = false;
    },'FAIL','capsule-handoff-native-full-endpoint observed deviation'],
    [({after}) => { after.nodes[2].parentPath = '0/1'; },
      'FAIL','capsule-handoff-native-full-endpoint observed deviation'],
    [({fade}) => { fade.receiverActorId = 'reader-session-morph-quickAutoPage'; },
      'FAIL','capsule-handoff-native-fade observed deviation'],
    [({fade}) => { fade.frames[5].receiverId++; },
      'FAIL','capsule-handoff-native-fade observed deviation'],
    [({fade}) => { fade.frames[5].opacity = 0.8; },
      'FAIL','capsule-handoff-native-fade observed deviation'],
    [({fade}) => { fade.generation++; },
      'NOT_RUN','capsule-handoff-native-fade lacks comparable evidence'],
    [({fade}) => { delete fade.frames[5].receiverVisible; },
      'NOT_RUN','capsule-handoff-native-fade lacks comparable evidence'],
    [({fade}) => {
      fade.frames = fade.frames.filter((_frame,index) => index % 3 === 0).map((frame,index) => {
        const observedMs = 4000 + (index + 1) * 54;
        return {...frame,observedMs,frameTimeNs:observedMs * 1e6};
      });
      fade.endpoint.observedMs = 4220;
    },'NOT_RUN','capsule-handoff-native-fade lacks comparable evidence'],
  ]) {
    const fixture = fullHandoffFixture();
    mutate(fixture);
    const assessed = fixture.evaluate();
    assert.equal(assessed.verdict,verdict);
    assert.equal(assessed.reason,reason);
  }
});

const ttsHandoffCase = JSON.parse(readFileSync(new URL('../cases/reading.control-tts-capsule-handoff.json', import.meta.url), 'utf8'));
const ttsQuickV2Handoff = ttsHandoffCase.assertions.find(assertion => assertion.action === 'return-from-capsule');
const ttsHandoff = structuredClone(ttsQuickV2Handoff);
delete ttsHandoff.expected.requireQuickTtsNativeTransport;
const ttsFullHandoffCase = JSON.parse(readFileSync(new URL('../cases/reading.control-tts-capsule-handoff-full.json', import.meta.url), 'utf8'));
const ttsFullHandoff = ttsFullHandoffCase.assertions.find(assertion => assertion.action === 'return-from-capsule');

function ttsHandoffFixture(full = false) {
  const {context,phase,node} = handoffFixture();
  const contract = full ? ttsFullHandoffCase : ttsHandoffCase;
  context.candidate.ownerSources = Object.fromEntries(contract.ownerSources.map(path =>
    [path,sha256(readFileSync(new URL('../../../' + path,import.meta.url)))]));
  context.actions['playback-launch'].targetId = 'reader-control-tts-transport-toggle';
  context.events.find(event => event.kind === 'reading.ready').channel = 'business';
  const returned = context.samples['capsule-returned'];
  returned.nodes[1].id = 'reader-control-module-tts';
  returned.nodes[2].id = 'reader-control-tts-transport-toggle';
  const ttsIdentity = {type:'tts',kind:full ? 'fullTtsPlayback' : 'quickTts'};
  for (const event of context.events) {
    if (event.payload.facts?.type === 'autoPage') Object.assign(event.payload.facts,ttsIdentity);
  }
  const admission = phase('admitted').payload.facts;
  admission.source.module = 'tts';
  const fade = phase('handoff-fade').payload.facts;
  fade.quickActorId = 'reader-control-module-tts';
  if (full) {
    const actor = 'reader-session-morph-fullTtsPlayback';
    admission.source.form = 'full';
    admission.sourceActorId = actor;
    fade.receiverActorId = actor;
    for (const frame of [fade.start,...fade.frames,fade.endpoint]) {
      Object.assign(frame,{receiverId:60,receiverVisible:true});
    }
    Object.assign(returned.nodes[2],{path:'0/1/0/1',parentPath:'0/1/0'});
    returned.nodes.push(node(actor,'0/1/0','0/1'),
      node('reader-control-collapse','0/2','0',{enabled:true}));
  }
  const speech = {engine:'system',sessionGeneration:9,audioStarted:true};
  const userPause = {...speech,status:'paused',pauseReason:'user',audioSession:'inactive'};
  phase('business-ack').payload.facts.tts = {...speech,status:'playing',audioSession:'active'};
  for (const name of ['cancel-request','handoff-ready','retired']) {
    Object.assign(phase(name).payload.facts,{status:'paused',tts:{...userPause}});
  }
  const pauseAck = phase('business-paused');
  pauseAck.payload.phase = 'business-ack';
  pauseAck.eventSeq = 38;
  Object.assign(pauseAck.payload.facts,{desiredPlaying:false,tts:{...userPause}});
  context.events.push(
    {...pauseAck,eventSeq:39},
    {...pauseAck,eventSeq:40,payload:{...pauseAck.payload,phase:'tts-pause-confirmed',
      facts:{...pauseAck.payload.facts,tts:{...userPause}}}},
    {...pauseAck,eventSeq:16,payload:{...pauseAck.payload,phase:'tts-availability',
      facts:{engine:'system',resolved:true,status:'idle'}}},
  );
  context.events.sort((left,right) => left.eventSeq - right.eventSeq);
  return {context,phase,fade,returned,evaluate:() => evaluateMotion(full ? ttsFullHandoff : ttsHandoff,context)};
}

test('a TTS capsule handoff requires the real system pause and restores its original Quick controls', () => {
  const current = ttsHandoffFixture();
  addPendingSystemSpeech(current,-1);
  assert.equal(current.evaluate().verdict,'PASS');
  assert.equal(systemSpeechApplicability(ttsHandoff,current.context).status,'SYSTEM_PLAYING');
  for (const [mutate,verdict,reason] of [
    [({phase}) => { phase('business-ack').payload.facts.tts.engine = 'http'; },
      'FAIL','capsule-handoff-system-speech observed deviation'],
    [({phase}) => { delete phase('business-ack').payload.facts.tts; },
      'NOT_RUN','capsule-handoff-system-speech lacks comparable evidence'],
    [({phase}) => { phase('business-ack').payload.facts.tts.audioStarted = false; },
      'NOT_RUN','capsule-handoff-system-speech lacks comparable evidence'],
    [fixture=>addPendingSystemSpeech(fixture,1),
      'FAIL','capsule-handoff-system-speech observed deviation'],
    [({phase}) => { phase('tts-pause-confirmed').payload.facts.tts.sessionGeneration++; },
      'FAIL','capsule-handoff-paused-origin observed deviation'],
    [({phase}) => { phase('tts-pause-confirmed').payload.facts.tts.status = 'interrupted'; },
      'FAIL','capsule-handoff-paused-origin observed deviation'],
    [({phase}) => { phase('tts-pause-confirmed').payload.facts.tts.audioSession = 'active'; },
      'FAIL','capsule-handoff-paused-origin observed deviation'],
    [({phase}) => { phase('tts-pause-confirmed').eventSeq = 42; },
      'NOT_RUN','capsule-handoff-paused-origin lacks comparable evidence'],
    [({phase}) => { phase('retired').payload.facts.tts.status = 'playing'; },
      'FAIL','capsule-handoff-tts-remains-paused observed deviation'],
    [({context}) => { context.samples['capsule-returned'].nodes[2].id = 'reader-control-autopage-transport-toggle'; },
      'FAIL','capsule-handoff-native-endpoint observed deviation'],
    [({phase}) => { phase('handoff-fade').payload.facts.quickActorId = 'reader-control-module-autoPage'; },
      'FAIL','capsule-handoff-native-fade observed deviation'],
    [({phase}) => { phase('handoff-fade').payload.facts.frames = []; },
      'NOT_RUN','capsule-handoff-native-fade lacks comparable evidence'],
  ]) {
    const fixture = ttsHandoffFixture();
    mutate(fixture);
    const assessed = fixture.evaluate();
    assert.equal(assessed.verdict,verdict);
    assert.equal(assessed.reason,reason);
  }
});

test('TTS Quick handoff requires the painted Quick owner and an operable returned transport', () => {
  assert.equal(ttsHandoffCase.version,3);
  assert.equal(ttsQuickV2Handoff.expected.requireQuickTtsNativeTransport,true);
  const {context,returned,evaluate:legacy} = ttsHandoffFixture();
  const [stage,module,button] = returned.nodes;
  const actor = {id:'reader-session-morph-quickTts',path:'0/1',parentPath:'0',type:'Stack',visible:true,opacity:1,
    visibleRectPx:{left:20,top:512,width:360,height:224}};
  Object.assign(module,{path:'0/1/0',parentPath:'0/1',type:'Scroll',visibleRectPx:actor.visibleRectPx});
  Object.assign(button,{path:'0/1/0/0',parentPath:'0/1/0',type:'Button',enabled:true,clickable:true,
    hitTestMode:'HitTestMode.Default',visibleRectPx:{left:180,top:569,width:40,height:40}});
  returned.nodes.push(actor);
  const window = returned.window;
  window.visibleRectPx = window.rectPx;
  window.keyboard = {visible:false};
  const result = () => evaluateMotion(ttsQuickV2Handoff,context);
  assert.equal(result().verdict,'PASS');

  actor.opacity = 0;
  button.clickable = false;
  assert.equal(legacy().verdict,'PASS','old motion accepted locally visible children of a transparent Quick actor');
  assert.deepEqual([result().verdict,result().reason],
    ['FAIL','capsule-handoff-native-quick-tts-actor observed deviation']);
  actor.opacity = 1;
  assert.equal(legacy().verdict,'PASS','old motion only required the returned transport to be enabled');
  assert.deepEqual([result().verdict,result().reason],
    ['FAIL','capsule-handoff-native-quick-tts-transport observed deviation']);
  button.clickable = true;

  for (const [target,field,value,wanted] of [
    [actor,'id','reader-session-morph-fullTtsPlayback','FAIL'],
    [actor,'opacity',undefined,'NOT_RUN'],
    [module,'parentPath','0','FAIL'],
    [module,'opacity',0,'FAIL'],
    [button,'type','Row','FAIL'],
    [button,'hitTestMode','HitTestMode.None','FAIL'],
    [button,'hitTestMode',undefined,'NOT_RUN'],
    [button,'clickable',undefined,'NOT_RUN'],
    [button,'visibleRectPx',{left:180,top:450,width:40,height:40},'FAIL'],
    [button,'visibleRectPx',{left:420,top:569,width:40,height:40},'FAIL'],
    [button,'visibleRectPx',undefined,'NOT_RUN'],
    [returned,'captureComplete',false,'NOT_RUN'],
  ]) {
    const old = target[field];
    target[field] = value;
    assert.equal(result().verdict,wanted,field);
    target[field] = old;
  }
  const endpoint = ttsHandoffCase.steps.find(step => step.id === ttsQuickV2Handoff.sample);
  returned.nodes = [stage];
  assert.equal(sampleReadiness(endpoint,returned,ttsHandoffCase.fixture.bookTitle),null);
  assert.equal(result().verdict,'FAIL');
});

test('a TTS capsule handoff excludes only a verified unavailable built-in engine on that launch', () => {
  for (const full of [false,true]) {
    const contract = full ? ttsFullHandoffCase : ttsHandoffCase;
    const handoff = full ? ttsFullHandoff : ttsHandoff;
    const {context,phase} = ttsHandoffFixture(full);
    const clauses = contract.assertions.filter(item => item.condition);
    const applicability = () => clauses.map(item => systemSpeechApplicability(item,context,contract).status);
    assert.deepEqual(applicability(),['SYSTEM_PLAYING','SYSTEM_PLAYING','SYSTEM_PLAYING']);
    const availability = phase('tts-availability').payload.facts;
    availability.status = 'unavailable';
    const stop = phase('timeline-finished');
    stop.payload.phase = 'cancel-request';
    stop.payload.facts.cancelReason = 'failure';
    stop.payload.facts.tts = {engine:'system',status:'unavailable',audioStarted:false};
    const playing = phase('business-ack');
    context.events = context.events.filter(event => event !== playing);
    assert.deepEqual(applicability(),['SYSTEM_UNAVAILABLE','SYSTEM_UNAVAILABLE','SYSTEM_UNAVAILABLE']);
    stop.payload.facts.generation++;
    assert.equal(systemSpeechApplicability(handoff,context).status,'UNVERIFIED');
    stop.payload.facts.generation--;
    stop.payload.facts.tts.engine = 'http';
    assert.equal(systemSpeechApplicability(handoff,context).status,'UNVERIFIED');
    stop.payload.facts.tts.engine = 'system';
    context.events.push(playing);
    assert.equal(systemSpeechApplicability(handoff,context).status,'SYSTEM_PLAYING');
  }
});

test('a TTS Full capsule handoff verifies the same paused speech and Full playback actor throughout the exit', () => {
  assert.equal(ttsHandoffFixture(true).evaluate().verdict,'PASS');
  for (const [mutate,verdict,reason] of [
    [({phase}) => { phase('admitted').payload.facts.sourceActorId = 'reader-session-morph-quickTts'; },
      'FAIL','capsule-handoff-full-source observed deviation'],
    [({phase}) => { phase('tts-pause-confirmed').payload.facts.kind = 'quickTts'; },
      'FAIL','capsule-handoff-paused-origin observed deviation'],
    [({phase}) => { phase('handoff-ready').payload.facts.tts.audioSession = 'active'; },
      'FAIL','capsule-handoff-tts-remains-paused observed deviation'],
    [({phase}) => { phase('retired').payload.facts.tts.sessionGeneration++; },
      'FAIL','capsule-handoff-tts-remains-paused observed deviation'],
    [({returned}) => {
      const [, , transport, playback, collapse] = returned.nodes;
      playback.id = 'reader-session-morph-quickTts';
      transport.parentPath = '0/1';
      collapse.enabled = false;
    },'FAIL','capsule-handoff-native-full-endpoint observed deviation'],
    [({fade}) => { fade.frames[3].receiverId++; },
      'FAIL','capsule-handoff-native-fade observed deviation'],
    [({fade}) => { fade.endpoint.receiverVisible = false; },
      'FAIL','capsule-handoff-native-fade observed deviation'],
    [({fade}) => { fade.frames = fade.frames.slice(0,3); },
      'NOT_RUN','capsule-handoff-native-fade lacks comparable evidence'],
    [({fade}) => {
      fade.frames = fade.frames.filter((_frame,index) => index % 3 === 0).map((frame,index) => {
        const observedMs = 4000 + (index + 1) * 51;
        return {...frame,observedMs,frameTimeNs:observedMs * 1e6};
      });
      fade.endpoint.observedMs = 4208;
    },'NOT_RUN','capsule-handoff-native-fade lacks comparable evidence'],
  ]) {
    const fixture = ttsHandoffFixture(true);
    mutate(fixture);
    const assessed = fixture.evaluate();
    assert.equal(assessed.verdict,verdict);
    assert.equal(assessed.reason,reason);
  }
});

test('a TTS Full capsule handoff samples its exact native playback receiver on the production observation path', async () => {
  const {selectedProductionClasses,selectedProductionValues} = await import('../../lib/selected-production-methods.mjs');
  const source = new URL('../../../entry/src/main/ets/features/reading/ui/ReaderControlCapsuleVerification.ets',import.meta.url);
  const constants = selectedProductionValues(source,['HANDOFF_FADE_MAX_FRAMES','HANDOFF_FADE_MAX_ANCESTORS']);
  let now = 20;
  let faded = 1;
  let readingId = 'reading-public';
  const {ReaderControlCapsuleVerification} = selectedProductionClasses(source,['ReaderControlCapsuleVerification'],
    {...constants,readerMotionNowMs:() => now});
  const events = [];
  const owner = {observing:() => true,observationIdentity:() => readingId,effect:(...args) => events.push(args)};
  const probe = new ReaderControlCapsuleVerification(owner);
  const receiver = 'reader-session-morph-fullTtsPlayback';
  const stage = 'reader-session-launch-fade-owner';
  const module = 'reader-control-module-tts';
  const dock = 'reader-control-motion-dock';
  const clip = 'reader-control-motion-content-clip';
  const playbackParent = 'playback-parent';
  const quickTts = 'reader-session-morph-quickTts';
  const quickAutoPage = 'reader-session-morph-quickAutoPage';
  const autoPageModule = 'reader-control-module-autoPage';
  const parents = new Map([[receiver,playbackParent],[playbackParent,module],[module,clip],[clip,dock]]);
  let clipOpacity = 1;
  let clipVisible = true;
  let clipAttached = true;
  const attached = new Map([stage,module,dock,receiver,clip,playbackParent,quickTts,quickAutoPage,autoPageModule].map((id,index) => [id,{
    isDisposed:() => false,
    isAttached:() => id !== clip || clipAttached,
    isVisible:() => id !== clip || clipVisible,
    getUniqueId:() => index + 10,
    getOpacity:() => id === stage ? faded : id === clip ? clipOpacity : 1,
    getParent:() => attached.get(parents.get(id)) ?? null,
  }]));
  const context = {getAttachedFrameNodeById:id => attached.get(id) ?? null};
  const launch = {geometry:{type:'tts',kind:'fullTtsPlayback',sourceActorId:receiver},
    generation:3,cancelReason:'openControl',ownership:'exitPending'};
  assert.equal(probe.beginHandoffFade(context,{...launch,ownership:'handoffPending'}),false);
  assert.equal(probe.beginHandoffFade(context,launch),true);
  assert.equal(probe.readHandoffFade(context,4,36e6),false);
  now = 36;
  faded = .8;
  assert.equal(probe.readHandoffFade(context,3,36e6),true);
  const read = () => {
    now += 16;
    assert.equal(probe.readHandoffFade(context,3,now * 1e6),true);
  };
  clipOpacity = 0;
  read();
  clipOpacity = NaN;
  read();
  clipOpacity = 1;
  clipVisible = false;
  read();
  clipVisible = true;
  parents.set(receiver,clip);
  read();
  parents.set(receiver,playbackParent);
  clipAttached = false;
  read();
  clipAttached = true;
  now += 16;
  faded = 0;
  probe.finishHandoffFade(context,3);
  assert.equal(events.length,1);
  const [effect,phase,trace,channel] = events[0];
  assert.deepEqual([effect,phase,channel],['capsule-launch','handoff-fade','motion']);
  assert.deepEqual([trace.quickActorId,trace.receiverActorId],[module,receiver]);
  assert.equal(trace.start.opacity,1);
  assert.equal(trace.endpoint.opacity,0);
  assert.deepEqual([trace.start,...trace.frames,trace.endpoint]
    .map(frame => [frame.receiverId,frame.quickVisible,frame.receiverVisible]),
    [[13,true,true],[13,true,true],[13,false,false],[13,undefined,undefined],
      [13,false,false],[13,true,undefined],[13,undefined,undefined],[13,true,true]]);
  assert.equal(probe.beginHandoffFade(context,launch),true);
  readingId = 'replacement-reading';
  probe.finishHandoffFade(context,3);
  assert.equal(events.length,1);

  for (const [type,kind,actor,region] of [
    ['tts','quickTts',quickTts,module], ['autoPage','quickAutoPage',quickAutoPage,autoPageModule],
  ]) {
    parents.set(region,actor);
    parents.set(actor,clip);
    const interrupted = {...launch,geometry:{type,kind,sourceActorId:actor},sample:{settled:false}};
    assert.equal(probe.beginHandoffFade(context,interrupted),true);
    read();
    parents.set(actor,dock);
    read();
    parents.set(actor,clip);
    probe.finishHandoffFade(context,3);
    const [, , interruptedTrace] = events.at(-1);
    assert.equal(interruptedTrace.receiverActorId,actor);
    assert.deepEqual([interruptedTrace.start,...interruptedTrace.frames,interruptedTrace.endpoint]
      .map(frame => [frame.receiverId,frame.receiverVisible,frame.opacity]),
    [true,true,undefined,true].map(visible => [attached.get(actor).getUniqueId(),visible,0]));

    assert.equal(probe.beginHandoffFade(context,{...interrupted,sample:{settled:true}}),true);
    probe.finishHandoffFade(context,3);
    const [, , settledTrace] = events.at(-1);
    assert.equal(settledTrace.receiverActorId,undefined);
    assert.equal(settledTrace.start.quickVisible,true);
    assert.equal(settledTrace.start.receiverId,undefined);
  }
});

test('a TTS capsule handoff publishes pause proof only after current Core and Host acknowledgement', async () => {
  const {selectedProductionMethods} = await import('../../lib/selected-production-methods.mjs');
  const readerRoot = new URL('../../../entry/src/main/ets/features/reading/',import.meta.url);
  const Coordinator = selectedProductionMethods(new URL('application/ReaderTtsSessionCoordinator.ts',readerRoot),
    'ReaderTtsSessionCoordinator',['hasConfirmedUserPause','getTransportState']);
  const Reading = selectedProductionMethods(new URL('ui/LocalReadingExperience.ets',readerRoot),
    'ReadingExperience',['toggleTts','sessionLaunchSpeechFacts']);
  for (const [kind,result] of ['quickTts','fullTtsPlayback'].flatMap(kind =>
    ['confirmed','local-only','superseded','host-error'].map(result => [kind,result]))) {
    const events = [];
    const errors = [];
    const playing = {status:'playing',sessionGeneration:9,audioStarted:true};
    const paused = {...playing,status:'paused',pauseReason:'user'};
    const launch = {geometry:{type:'tts',kind},generation:3,ownership:'stage',desiredPlaying:false};
    const transport = {engine:'system',sessionGeneration:9,audioSession:'active',focus:'held',currentRequestId:'real-audio'};
    const coordinator = Object.assign(new Coordinator(),{active:{identity:{sessionGeneration:9}},
      state:playing,transport,coreSnapshot:{state:'playing'}});
    const reader = Object.assign(new Reading(),{
      readerInputIsCurrent:() => true, ttsAvailabilityResolved:true, ttsState:playing,
      ttsCoordinator:coordinator, sessionLaunch:launch, createTtsPlayIntent:() => ({generation:1}),
      isTtsPlayIntentCurrent:() => true,cancelPendingAutoPageStart() {},
      controlVerification:{observing:() => true},capsuleVerification:{ownerState:(...event) => events.push(event)},
      logTtsFailure:(...error) => errors.push(error),
    });
    let complete;
    let fail;
    coordinator.pause = () => {
      coordinator.state = paused;
      reader.ttsState = paused;
      return new Promise((resolve,reject) => { complete = resolve; fail = reject; });
    };
    reader.toggleTts();
    assert.deepEqual(events,[]);
    if (result === 'host-error') fail(new Error('Controlled host stop failure'));
    else {
      if (result !== 'local-only') {
        coordinator.coreSnapshot = {state:'paused'};
        coordinator.transport = {...transport,audioSession:'inactive',focus:'none',currentRequestId:undefined};
      }
      if (result === 'superseded') reader.sessionLaunch = {...launch,generation:4};
      complete();
    }
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(errors.length,result === 'host-error' ? 1 : 0);
    assert.deepEqual(events,result === 'confirmed' ? [
      ['tts-pause-confirmed',launch,{engine:'system',sessionGeneration:9,status:'paused',
        audioStarted:true,audioSession:'inactive',pauseReason:'user'}],
    ] : []);
  }
});

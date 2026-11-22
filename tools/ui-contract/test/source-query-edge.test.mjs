import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {requestedOperation, requireActionDispatch} from '../collectors/harmonyos/records.mjs';
import {publicAssertionDefinition} from '../lib/assertion-contract.mjs';
import {evaluateSource} from '../lib/source.mjs';
import {measureSourceQueryEdge, measureSourceQueryTouch, sourceQueryEdgeCase, sourceQueryEdgeFixture,
  sourceQueryEditor} from '../lib/source-query-edge.mjs';

const definition = JSON.parse(readFileSync(new URL('../cases/' + sourceQueryEdgeCase + '.json',import.meta.url)));
const instanceId = 'public-source-window';
const owner = {mounting:1,generation:3};
const box = (left,top,width,height) => ({left,top,width,height});
const action = (op,from,beforeSeq,afterSeq) => ({op,from,beforeSeq,afterSeq,instanceId});
const event = (eventSeq,kind,payload) => ({eventSeq,kind,payload,channel:'business',instanceId});
const projection = {state:'rows',readFact:'current',owner,status:'all',category:'all',allGroups:true,groupIndex:0,
  count:18,projected:18,queryLength:0,readGeneration:2,filterRevision:1,firstAnchor:1};

function node(path,id,type,rectPx) {
  return {path,parentPath:path.slice(0,path.lastIndexOf('/')),id,type,rectPx,visibleRectPx:{...rectPx},
    visible:true,enabled:true,clickable:['TextInput','Button'].includes(type),opacity:1,source:'native-tree'};
}

function sample(sampleId,beforeSeq,focused = false,keyboard = false) {
  const full = box(0,0,1280,keyboard ? 1940 : 2832);
  const field = box(67,367,965,154);
  return {
    sampleId,instanceId,beforeSeq,afterSeq:beforeSeq+2,captureComplete:true,
    evidenceRefs:[{path:'raw/' + sampleId + '.png'},{path:'raw/' + sampleId + '.json'}],
    window:{id:'42',revision:keyboard ? 3 : 2,density:3.5,source:'window-metrics',visibleRectPx:full,keyboard:{visible:keyboard}},
    nodes:[
      node('0',null,'Stack',full),
      node('0/0','reader-source-back','Button',box(0,137,154,154)),
      node('0/1','reader-source-list','List',box(0,326,1280,keyboard ? 1200 : 2000)),
      node('0/1/0','reader-source-search','Row',box(67,367,1147,154)),
      node('0/1/0/0',null,'Row',field),
      node('0/1/0/0/0',null,'Stack',field),
      node('0/1/0/0/0/0',null,'Row',field),
      {...node('0/1/0/0/0/0/0',sourceQueryEditor,'TextInput',box(186,371,802,147)),focused},
    ],
  };
}

function currentCase(edge,legacy=false) {
  const native = definition.assertions.find(item => item.id === 'source.query.'+edge+(edge === 'center' ? '-touch' : '-touch-edge'));
  const check = legacy ? {...native,kind:'source-query-edge',expected:{target:sourceQueryEditor,tapEdge:edge}} : native;
  const back = definition.assertions.find(item => item.id === 'source.query.'+edge+'-ime-back');
  const step = definition.steps.find(item => item.id === check.action);
  return {check,back,step};
}

function evaluate(assertion,context) {
  return evaluateSource({...assertion,acceptedSources:assertion.sources},context);
}

test('Source query edges dispatch the real upper and lower outside-paint pixels',()=>{
  for (const [edge,y] of [['top',369],['bottom',519]]) {
    const {check,back,step} = currentCase(edge);
    publicAssertionDefinition(check);
    publicAssertionDefinition(back);
    const baseline = sample(step.from,20);
    const measured = measureSourceQueryEdge(baseline,edge);
    assert.equal(measured.verdict,'PASS');
    assert.deepEqual(measured.actual.declared,box(186,367.5,802,154));
    assert.deepEqual(measured.actual.point,{x:587,y});
    const operation = requestedOperation(step,{[step.from]:baseline},definition.fixture);
    assert.deepEqual(operation,{op:'click',x:587,y});
    assert.deepEqual(requestedOperation(step,{[step.from]:baseline},{id:sourceQueryEdgeFixture}),operation);
    const command = {event:'command',seq:1,ok:true,args:['shell','uitest','uiInput','click','587',String(y)]};
    assert.equal(requireActionDispatch([command],1,operation),command);
    command.args[5] = '444';
    assert.throws(()=>requireActionDispatch([command],1,operation),/Unexpected command/u);
  }
});

test('Source query edges reject clipped, ambiguous, focused and uncalibrated baselines',()=>{
  const baseline = () => sample('source-ready',20);
  const clipped = baseline();
  clipped.nodes.at(-2).visibleRectPx.height -= 4;
  assert.equal(measureSourceQueryEdge(clipped,'bottom').verdict,'FAIL');
  const narrow = baseline();
  narrow.nodes.at(-1).rectPx.width = narrow.nodes.at(-1).visibleRectPx.width = 140;
  assert.equal(measureSourceQueryEdge(narrow,'top').verdict,'FAIL');
  const ambiguous = baseline();
  ambiguous.nodes.push({...ambiguous.nodes.at(-1),path:'0/1/0/0/0/0/1'});
  assert.equal(measureSourceQueryEdge(ambiguous,'top').verdict,'NOT_RUN');
  const enlargedFont = baseline();
  for (const frame of enlargedFont.nodes.slice(3,-1)) {
    frame.rectPx = {...frame.rectPx,height:175};
    frame.visibleRectPx.height = 175;
  }
  enlargedFont.nodes.at(-1).rectPx.height = enlargedFont.nodes.at(-1).visibleRectPx.height = 168;
  assert.equal(measureSourceQueryEdge(enlargedFont,'bottom').verdict,'NOT_RUN');
  const alreadyFocused = baseline();
  alreadyFocused.nodes.at(-1).focused = true;
  assert.equal(measureSourceQueryEdge(alreadyFocused,'top').verdict,'NOT_RUN');
});

function sizedQuery(sample,scale) {
  const {density} = sample.window;
  const field = Math.ceil(44 + 18*(scale-1));
  for (const frame of sample.nodes.slice(3,-1)) {
    frame.rectPx = {...frame.rectPx,height:Math.round(field*density)};
    frame.visibleRectPx.height = frame.rectPx.height;
  }
  sample.nodes.at(-1).rectPx.height = sample.nodes.at(-1).visibleRectPx.height = Math.round((field-2)*density);
  sample.window.fontScale = scale;
  return sample;
}

function proof(edge,{legacy=false,scale=1,retainedFocus=false}={}) {
  const {check,back} = currentCase(edge,legacy);
  const baseline = sample(check.baseline,21);
  const endpoint = sample(check.sample,35,true,true);
  const returned = sample(back.sample,50);
  for (const current of [baseline,endpoint,returned]) sizedQuery(current,scale);
  baseline.nodes.at(-1).focused = retainedFocus;
  const {point} = (legacy ? measureSourceQueryEdge : measureSourceQueryTouch)(baseline,edge).actual;
  const tap = {...point,probeSeq:17,...(legacy ? {edge} : {position:edge})};
  const context = {
    samples:{[check.baseline]:baseline,[check.sample]:endpoint,[back.sample]:returned},
    actions:{
      'open-sources':{...action('click','settings',7,13),targetId:'reader-settings-source-management'},
      [check.action]:{...action('click',check.baseline,25,33),targetId:sourceQueryEditor,
        [legacy ? 'edgeTap' : 'queryTouch']:tap},
      [back.action]:{...action('keyEvent',check.sample,40,46),key:'Back'},
    },
    events:[
      event(9,'source.route',{action:'open',from:'settings',to:'source',...owner,previousGeneration:2}),
      event(17,'source.projection',projection),
    ],
  };
  return {check,back,context};
}

test('Source query outside taps require native focus and first Back keeps their opening',()=>{
  for (const edge of ['top','bottom']) {
    const {check,back,context} = proof(edge);
    assert.equal(evaluate(check,context).verdict,'PASS');
    assert.equal(evaluate(back,context).verdict,'PASS');
    const actual = context.samples[check.sample];
    context.samples[check.sample] = sizedQuery(sample(check.sample,35),1);
    assert.equal(evaluate(check,context).verdict,'FAIL');
    context.samples[check.sample] = actual;
    const current = context.actions[check.action].queryTouch;
    current.y = 444;
    assert.equal(evaluate(check,context).verdict,'FAIL');
    current.y = edge === 'top' ? 369 : 519;
    context.events.push(event(29,'source.projection',{...projection,queryLength:1,filterRevision:2}));
    assert.equal(evaluate(check,context).verdict,'FAIL');
    context.events.pop();
    context.events.push(event(43,'source.route',{action:'close',from:'source',to:'settings'}));
    assert.equal(evaluate(back,context).verdict,'FAIL');
    context.events.pop();
    delete actual.window.keyboard;
    assert.equal(evaluate(check,context).verdict,'NOT_RUN');
  }
  const {check,context} = proof('top');
  context.events.push(event(29,'source.route',{action:'close',from:'source',to:'settings'}));
  context.samples[check.sample].nodes = [];
  assert.equal(evaluate(check,context).verdict,'FAIL');
});

test('Source query center and enlarged-font edges use the actual painted response and real IME',()=>{
  for (const scale of [1.3,1.6,2]) {
    for (const position of ['center','top','bottom']) {
      const {check,back,context} = proof(position,{scale,retainedFocus:position !== 'center'});
      const baseline = context.samples[check.baseline];
      const measurements = measureSourceQueryTouch(baseline,position);
      assert.equal(measurements.verdict,'PASS');
      const {bounds,painted,point,extendsPaint} = measurements.actual;
      assert.equal(extendsPaint,false);
      assert.deepEqual(bounds,painted);
      assert.ok(point.y >= painted.top && point.y < painted.top+painted.height);
      const {step} = currentCase(position);
      const requested = requestedOperation(step,context.samples,definition.fixture);
      assert.deepEqual(requested,{op:'click',...point});
      const result = evaluate(check,context);
      assert.equal(result.verdict,'PASS',result.reason);
      assert.equal(result.actual.keyboardVisible,true);
      assert.equal(result.actual.nativeInteraction.position,position);
      assert.equal(result.actual.nativeInteraction.baselineSampleId,check.baseline);
      assert.equal(evaluate(back,context).verdict,'PASS');
      context.samples[check.sample].window.keyboard.visible = false;
      assert.equal(evaluate(check,context).verdict,'FAIL');
    }
  }
  const legacy = proof('top',{legacy:true});
  assert.equal(evaluate(legacy.check,legacy.context).verdict,'PASS');
  assert.equal(evaluate(legacy.check,legacy.context).actual.nativeInteraction,undefined);
});

test('Source query current 44vp paint uses the three physical points inside its matching Row',()=>{
  for (const [position,y] of [['top',368],['center',444],['bottom',519]]) {
    const current = sample('source-ready',20);
    const editor = current.nodes.at(-1);
    editor.rectPx = {left:186,top:367,width:802,height:154};
    editor.visibleRectPx = {...editor.rectPx};
    const measurement = measureSourceQueryTouch(current,position);
    assert.equal(measurement.verdict,'PASS',measurement.reason);
    assert.equal(measurement.actual.extendsPaint,false);
    assert.deepEqual(measurement.actual.point,{x:587,y});
    assert.deepEqual(measurement.actual.bounds,editor.rectPx);
    const {step} = currentCase(position);
    assert.deepEqual(requestedOperation(step,{[step.from]:current},definition.fixture),{op:'click',x:587,y});

    editor.rectPx.top += 3;
    editor.visibleRectPx.top += 3;
    assert.equal(measureSourceQueryTouch(current,position).verdict,'FAIL');
  }
});

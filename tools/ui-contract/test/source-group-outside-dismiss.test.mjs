import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {assertCurrentActionState, requestedOperation, requireActionDispatch} from '../collectors/harmonyos/records.mjs';
import {publicAssertionDefinition} from '../lib/assertion-contract.mjs';
import {normalizeHarmonyLayout, selectLayoutNode} from '../lib/layout.mjs';
import {evaluateSource} from '../lib/source.mjs';
import {
  measureSourceGroupOutside, sourceGroupBackdrop, sourceGroupOutsideCase, sourceGroupPanel, sourceGroupTrigger,
} from '../lib/source-group-outside.mjs';

const definition = JSON.parse(readFileSync(new URL('../cases/' + sourceGroupOutsideCase + '.json',import.meta.url)));
const assertion = definition.assertions.find(item => item.kind === 'group-outside-dismiss');
const step = definition.steps.find(item => item.id === assertion.action);
const open = definition.steps.find(item => item.id === assertion.openAction);
const selectionId = 'source-group:8';
const owner = {mounting:1,generation:3};
const instanceId = 'source-instance';
const windowId = '42';
const screen = '[0,0][1280,2832]';
const overlayFrame = '[0,137][1280,2832]';
const panelFrame = '[56,823][1224,1978]';
const projection = {
  owner,trigger:'owner-update',filterRevision:1,category:'all',status:'all',allGroups:true,groupIndex:0,
  readGeneration:7,readFact:'current',state:'rows',count:18,projected:18,queryLength:0,firstAnchor:1,
};

function native(type,id,bounds,children = [],attributes = {}) {
  return {attributes:{type,id,bounds,origBounds:bounds,hostWindowId:windowId,
    visible:'true',opacity:'1',enabled:'true',...attributes},children};
}

function backdrop() {
  return native('Row',sourceGroupBackdrop + ':' + selectionId,overlayFrame,[],
    {origBounds:'[0,136][1280,2832]',clickable:'true',hitTestBehavior:'HitTestMode.Default'});
}

function panel() {
  const selected = native('Button',selectionId + ':focus:selected','[59,826][1221,980]');
  const scroll = native('Scroll','','[59,826][1221,1975]',[selected]);
  const painted = native('Column','',panelFrame,[scroll],{clip:'true',zIndex:'10'});
  const positioned = native('Column','',panelFrame,[painted],{zIndex:'10'});
  return native('__Common__',sourceGroupPanel,'[0,137][1168,1291]',[positioned]);
}

function sample(sampleId,beforeSeq,overlay = []) {
  const body = [
    native('Button','reader-source-back','[0,137][154,291]'),
    native('List','reader-source-list','[0,300][1280,2600]'),
    native('Button',sourceGroupTrigger,'[56,823][1224,977]'),
    native('Stack','',overlayFrame,overlay,{origBounds:'[0,136][1280,2832]',zIndex:'30'}),
  ];
  const root = native('root','',screen,body,{bundleName:'io.reader.minliny',pagePath:'pages/Index',abilityName:'EntryAbility'});
  const report = {windowId,vpPixels:3.5,metrics:{ready:true,revision:1,densityPixels:3.5,
    windowRect:{left:0,top:0,width:1280/3.5,height:2832/3.5},
    globalRect:{left:0,top:0,width:1280/3.5,height:2832/3.5},
    keyboardArea:{available:true,visible:false,rects:[]},keyboardInsets:{left:0,top:0,right:0,bottom:0}}};
  const evidenceRefs = [{path:'raw/' + sampleId + '.png'},{path:'raw/' + sampleId + '.json'}];
  return {...normalizeHarmonyLayout({tree:{attributes:{bounds:screen},children:[root]},report,sampleId,instanceId,evidenceRefs}),
    beforeSeq,afterSeq:beforeSeq+2,semanticSeq:1,captureComplete:true};
}

const event = (eventSeq,kind,payload) => ({eventSeq,kind,payload,channel:'business',instanceId});
const group = (seq,phase,change = {}) => event(seq,'source.overlay',{owner,overlay:'group',phase,selectionId,...change});

function proof() {
  const baseline = sample(assertion.baseline,20,[backdrop(),panel()]);
  const outsideTap = {...measureSourceGroupOutside(baseline).point,probeSeq:15};
  return {
    samples:{
      [open.from]:sample(open.from,5),
      [assertion.baseline]:baseline,
      [assertion.sample]:sample(assertion.sample,37),
    },
    actions:{
      [assertion.openAction]:{op:'click',targetId:sourceGroupTrigger,from:open.from,instanceId,beforeSeq:9,afterSeq:14},
      [assertion.action]:{op:'click',targetId:sourceGroupBackdrop,from:baseline.sampleId,instanceId,
        beforeSeq:25,afterSeq:33,outsideTap},
    },
    events:[event(8,'source.projection',projection),group(12,'open'),group(27,'outside'),group(30,'dismiss')],
  };
}

function evaluate(context) {
  return evaluateSource({...assertion,acceptedSources:assertion.sources},context);
}

test('source group outside click uses the painted panel and exact raw command',()=>{
  publicAssertionDefinition(assertion);
  const baseline = sample(step.from,20,[backdrop(),panel()]);
  const carrier = selectLayoutNode(baseline,sourceGroupBackdrop);
  assert.equal(carrier.id,sourceGroupBackdrop + ':' + selectionId);
  const measured = measureSourceGroupOutside(baseline);
  assert.equal(measured.selectionId,selectionId);
  assert.deepEqual(measured.panelRectPx,{left:56,top:823,width:1168,height:1155});
  assert.deepEqual(measured.point,{x:640,y:2405});
  const operation = requestedOperation(step,{[step.from]:baseline},definition.fixture);
  assert.deepEqual(operation,{op:'click',x:640,y:2405});
  const command = {event:'command',ok:true,seq:1,args:['shell','uitest','uiInput','click','640','2405']};
  assert.equal(requireActionDispatch([command],1,operation),command);
  command.args[5] = '1500';
  assert.throws(()=>requireActionDispatch([command],1,operation),/Unexpected command/u);
});

test('source group outside click rejects clipped, ambiguous and stale carriers before dispatch',()=>{
  const clipped = panel();
  clipped.children[0].children[0].attributes.bounds = '[56,823][1224,1910]';
  for (const overlay of [[backdrop(),clipped],[backdrop(),backdrop(),panel()],[panel()],[
    backdrop(),panel(),native('Column','reader-other-overlay',overlayFrame),
  ]]) {
    const baseline = sample(step.from,20,overlay);
    assert.equal(measureSourceGroupOutside(baseline),undefined);
    assert.throws(()=>requestedOperation(step,{[step.from]:baseline},definition.fixture),/No verified native click point/u);
  }
  const baseline = sample(step.from,20,[backdrop(),panel()]);
  const mark = {instanceId,windowRevision:1,semanticSeq:1,eventSeq:25,payload:{windowId}};
  assert.doesNotThrow(()=>assertCurrentActionState(step,baseline,mark,[group(12,'open')]));
  assert.throws(()=>assertCurrentActionState(step,baseline,mark,[
    group(12,'open'),group(24,'open',{selectionId:'source-group:9'}),
  ]),/not the current Source group opening/u);
});

test('source group outside dismissal requires one accepted same-opening close and the unchanged endpoint',()=>{
  const accepted = proof();
  assert.equal(evaluate(accepted).verdict,'PASS');
  for (const change of [
    context=>{ context.actions[assertion.action].outsideTap.y = 1500; },
    context=>{ context.events[3] = group(30,'dismiss',{selectionId:'source-group:9'}); },
    context=>{ context.events[3] = group(30,'dismiss',{owner:{...owner,generation:4}}); },
    context=>{ context.events.splice(3,0,group(28,'outside')); },
    context=>{ context.events.splice(3,0,event(28,'source.route',{from:'source',to:'settings'})); },
    context=>{ context.events.splice(3,0,event(28,'source.projection',{...projection,trigger:'group'})); },
    context=>{ context.events.splice(3,0,event(28,'source.projection',{...projection,filterRevision:2})); },
    context=>{ context.samples[assertion.sample] = sample(assertion.sample,37,[backdrop(),panel()]); },
  ]) {
    const context = proof();
    change(context);
    assert.equal(evaluate(context).verdict,'FAIL');
  }
  const noCallback = proof();
  noCallback.events.splice(2,2);
  assert.equal(evaluate(noCallback).verdict,'NOT_RUN');
  noCallback.samples[assertion.sample] = sample(assertion.sample,37,[backdrop(),panel()]);
  assert.equal(evaluate(noCallback).verdict,'FAIL');
  const absentOpening = proof();
  absentOpening.events.splice(1,1);
  assert.equal(evaluate(absentOpening).verdict,'NOT_RUN');
  const noDispatch = proof();
  delete noDispatch.actions[assertion.action].outsideTap;
  assert.equal(evaluate(noDispatch).verdict,'NOT_RUN');
});

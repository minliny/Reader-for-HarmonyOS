import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {requestedOperation, requireActionDispatch} from '../collectors/harmonyos/records.mjs';
import {evaluateSource} from '../lib/source.mjs';
import {measureSourceFilterCarrier,sourceFilterEdgeTap,sourceFilterNativeAssertion,
  sourceFilterNativeDispatch} from '../lib/source-filter-edge.mjs';

const definition = JSON.parse(readFileSync(new URL('../cases/source-management.group-option-touch-edges.json',import.meta.url)));
const selectionCase = JSON.parse(readFileSync(new URL('../cases/source-management.filter-selections.json',import.meta.url)));
const selected = 'reader-source-group-selected';
const alternative = 'reader-source-group-option-1';
const panel = 'reader-source-group-panel';
const trigger = 'reader-source-group-trigger';
const back = 'reader-source-back';
const instanceId = 'source-group-window';
const owner = {mounting:1,generation:3};
const selectionId = 'source-group:42';
const window = {
  id:'1',revision:2,source:'window-metrics',density:3.5,visibleRectPx:{left:0,top:0,width:1280,height:2832},keyboard:{visible:false},
};
const node = (path,id,type,rectPx) => ({
  path,parentPath:path.slice(0,path.lastIndexOf('/')),id,type,rectPx,visibleRectPx:{...rectPx},
  visible:true,enabled:true,clickable:type === 'Button',opacity:1,
});
const steps = new Map(definition.steps.map(step => [step.id,step]));
const box = (left,top,width,height) => ({left,top,width,height});
const evidence = id => [{path:`raw/${id}.png`},{path:`raw/${id}.json`}];

function sample(sampleId, beforeSeq, nodes) {
  return {sampleId,instanceId,beforeSeq,afterSeq:beforeSeq+2,window,captureComplete:true,nodes,evidenceRefs:evidence(sampleId)};
}

function menu(sampleId = 'selected-open') {
  return sample(sampleId,20,[
    node('0/0',panel,null,box(0,137,1168,663)),
    node('0/0/0',null,'Column',box(56,823,1168,332)),
    node('0/0/0/0',null,'Scroll',box(59,826,1162,326)),
    {...node('0/0/0/0/0',null,'Button',box(59,826,1162,154)),alias:selected},
    {...node('0/0/0/0/1',null,'Button',box(59,980,1162,154)),alias:alternative},
  ]);
}

function edgeProof(role) {
  const assertion = definition.assertions.find(item => item.id === 'source.group.' + role + '-touch-edge');
  const step = steps.get(assertion.action);
  const opening = steps.get(assertion.openAction);
  const baseline = menu(assertion.baseline);
  const edge = sourceFilterEdgeTap(baseline,step.target,step.tapEdge,step);
  const base = {
    owner,trigger:'owner-update',filterRevision:1,category:'all',status:'all',allGroups:true,groupIndex:0,
    readGeneration:7,readFact:'current',state:'rows',count:18,projected:18,queryLength:0,firstAnchor:1,
  };
  const changed = role === 'alternative';
  const edited = {...base,trigger:'group',filterRevision:changed ? 2 : 1,allGroups:!changed,
    groupIndex:changed ? 1 : 0, projected:changed ? 9 : 18};
  const event = (eventSeq,kind,payload) => ({eventSeq,kind,payload,channel:'business',instanceId});
  const rows = [node('0/1',back,'Button',box(1,5,150,150)),node('0/2',trigger,'Button',box(59,826,1162,154))];
  const context = {
    samples:{[opening.from]:sample(opening.from,5,rows),[assertion.baseline]:baseline,[assertion.sample]:sample(assertion.sample,37,rows)},
    actions:{
      [assertion.openAction]:{op:'click',targetId:trigger,from:opening.from,instanceId,beforeSeq:9,afterSeq:14},
      [assertion.action]:{op:'click',targetId:step.target,from:baseline.sampleId,instanceId,beforeSeq:25,afterSeq:33,
        edgeTap:{edge:step.tapEdge,...edge.point,probeSeq:6,requireFullContainment:step.requireFullContainment},
        filterTouch:sourceFilterNativeDispatch(definition,step,{op:'click',...edge.point},6)},
    },
    events:[
      event(8,'source.projection',base),
      event(12,'source.overlay',{owner,overlay:'group',phase:'open',selectionId}),
      event(27,'source.projection',edited),
      event(30,'source.overlay',{owner,overlay:'group',phase:'dismiss',selectionId}),
    ],
  };
  return {assertion,context,evaluate:()=>evaluateSource({...assertion,acceptedSources:assertion.sources},context)};
}

test('source group option edge resolves the real Scroll and rechecks both native commands',()=>{
  const capture = menu();
  for (const [id,target,edge,y] of [['tap-selected-bottom',selected,'bottom',978],['tap-alternative-top',alternative,'top',981]]) {
    const step = steps.get(id);
    const witnessed = sourceFilterEdgeTap(capture,target,edge,step);
    assert.equal(witnessed.heightVp,44);
    assert.deepEqual(witnessed.point,{x:640,y});
    const operation = requestedOperation(step,{[step.from]:capture},{});
    const journal = [{event:'command',ok:true,seq:1,args:['shell','uitest','uiInput','click','640',String(y)]}];
    assert.equal(requireActionDispatch(journal,1,operation).seq,1);
    journal[0].args[5] = String(y+1);
    assert.throws(()=>requireActionDispatch(journal,1,operation),/Unexpected command/u);
  }
});

test('source group option edge rejects a 42vp inner Button, a clipped row and ambiguous ancestry',()=>{
  const undersized = menu();
  undersized.nodes[1].rectPx.width = 154;
  undersized.nodes[1].visibleRectPx.width = 154;
  undersized.nodes[2].rectPx.width = 147;
  undersized.nodes[2].visibleRectPx.width = 147;
  undersized.nodes[3].rectPx.width = 147;
  undersized.nodes[3].visibleRectPx.width = 147;
  assert.equal(measureSourceFilterCarrier(undersized,selected).verdict,'FAIL');
  assert.throws(()=>sourceFilterEdgeTap(undersized,selected,'bottom'),/undersized/u);
  const clipped = menu();
  clipped.nodes[2].visibleRectPx.height = 200;
  assert.equal(measureSourceFilterCarrier(clipped,alternative).verdict,'FAIL');
  const foreign = menu();
  foreign.nodes[2].type = 'List';
  assert.equal(measureSourceFilterCarrier(foreign,alternative).verdict,'NOT_RUN');
  const ambiguous = menu();
  ambiguous.nodes[1].type = 'Scroll';
  assert.equal(measureSourceFilterCarrier(ambiguous,alternative).verdict,'NOT_RUN');
  const windowClipped = menu();
  windowClipped.window = {...window,visibleRectPx:{...window.visibleRectPx,left:75}};
  const command = steps.get('tap-selected-bottom');
  assert.equal(measureSourceFilterCarrier(windowClipped,selected).verdict,'PASS');
  assert.equal(measureSourceFilterCarrier(windowClipped,selected,command).verdict,'FAIL');
  assert.throws(()=>requestedOperation(command,{[command.from]:windowClipped},{}),/clipped/u);
  const missingWindow = menu();
  missingWindow.window = {...window,visibleRectPx:undefined};
  assert.equal(measureSourceFilterCarrier(missingWindow,selected,command).verdict,'NOT_RUN');
});

test('source group option edge distinguishes selecting the current row from changing group',()=>{
  for (const role of ['selected','alternative']) {
    const proof = edgeProof(role);
    const result = proof.evaluate();
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.after.groupIndex,role === 'selected' ? 0 : 1);
    const {nativeInteraction} = result.actual;
    assert.equal(nativeInteraction.subject,role === 'selected' ? 'group-selected-option' : 'group-other-option');
    assert.equal(nativeInteraction.position,role === 'selected' ? 'bottom' : 'top');
    assert.equal(nativeInteraction.baselineSampleId,proof.assertion.baseline);
    assert.deepEqual(nativeInteraction.dispatch,{...result.actual.edge.point,probeSeq:6});
  }
  const stale = edgeProof('alternative');
  stale.context.events[2].payload.owner = {...owner,generation:owner.generation+1};
  assert.equal(stale.evaluate().verdict,'FAIL');
  const prior = edgeProof('selected');
  prior.context.events[2].payload.filterRevision++;
  assert.equal(prior.evaluate().verdict,'FAIL');
  const otherPanel = edgeProof('alternative');
  otherPanel.context.events[3].payload.selectionId = 'source-group:43';
  assert.equal(otherPanel.evaluate().verdict,'PASS');
  assert.equal(otherPanel.evaluate().actual.nativeInteraction,undefined);
});

test('source group option center requires its scoped native command and releases the exact live panel', () => {
  const {context} = edgeProof('alternative');
  const definition = selectionCase.assertions.find(item => item.id === 'source.filter.group');
  const step = selectionCase.steps.find(item => item.id === definition.action);
  const baseline = {...context.samples['alternative-open'],sampleId:definition.baseline};
  context.samples = {[definition.baseline]:baseline,
    [definition.sample]:{...context.samples['alternative-dismissed'],sampleId:definition.sample}};
  const operation = requestedOperation(step,context.samples,selectionCase.fixture);
  assert.deepEqual(operation,{op:'click',x:640,y:1057});
  const command = requireActionDispatch([{event:'command',ok:true,seq:1,
    args:['shell','uitest','uiInput','click','640','1057']}],1,operation);
  context.actions = {[step.id]:{op:'click',targetId:alternative,from:definition.baseline,instanceId,beforeSeq:25,afterSeq:33,
    filterTouch:sourceFilterNativeDispatch(selectionCase,step,operation,command.seq)}};
  const evaluate = () => evaluateSource({...definition,acceptedSources:definition.sources},context);
  const identity = {subject:'group-other-option',target:alternative,position:'center'};
  assert.deepEqual(sourceFilterNativeAssertion(selectionCase,definition),identity);
  assert.equal(sourceFilterNativeAssertion({...selectionCase,steps:selectionCase.steps.map(item=>item === step ?
    {...item,target:{id:alternative,ancestors:['another-panel']}} : item)},definition),undefined);
  const result = evaluate();
  assert.equal(result.verdict,'PASS',result.reason);
  assert.deepEqual(result.actual.nativeInteraction,{
    ...identity,carrierPath:'0/0/0/0/1',bounds:box(59,980,1162,154),visible:true,clipped:false,enabled:true,accepted:true,
    actionId:step.id,baselineSampleId:definition.baseline,dispatch:{x:640,y:1057,probeSeq:1},
  });
  context.events[3].payload.selectionId = 'source-group:43';
  assert.equal(evaluate().verdict,'PASS');
  assert.equal(evaluate().actual.nativeInteraction,undefined);
});

test('source group option edge records ignored and stuck actions but rejects fabricated clicks',()=>{
  const ignored = edgeProof('selected');
  ignored.context.events.splice(2);
  assert.equal(ignored.evaluate().verdict,'FAIL');
  const stuck = edgeProof('alternative');
  stuck.context.samples[stuck.assertion.sample].nodes.push(node('0/0',panel,null,box(0,137,1168,663)));
  assert.equal(stuck.evaluate().verdict,'FAIL');
  const falseClick = edgeProof('alternative');
  falseClick.context.actions[falseClick.assertion.action].edgeTap.y++;
  assert.equal(falseClick.evaluate().verdict,'NOT_RUN');
  const clipped = edgeProof('alternative');
  clipped.context.samples[clipped.assertion.baseline].window = {...window,visibleRectPx:{...window.visibleRectPx,left:75}};
  assert.equal(clipped.evaluate().verdict,'NOT_RUN');
});

function nativeGroupCenterJourney() {
  const triggerRect = box(59,826,1162,154);
  const hostRect = window.visibleRectPx;
  const trail = [
    node('0/1',back,'Button',box(1,5,150,150)),
    node('0/2','reader-source-content','Column',hostRect),
    node('0/2/0','reader-source-group-filter','Row',box(10,826,1230,154)),
    node('0/2/0/0',trigger,'__Common__',triggerRect),
    node('0/2/0/0/0','source-back:3:group-trigger','Button',triggerRect),
  ];
  const panelRect = box(56,826,1168,308);
  const viewport = box(59,826,1162,308);
  const opened = [
    node('0/0',panel,'__Common__',panelRect),
    {...node('0/0/0',null,'Column',panelRect),zIndex:10},
    {...node('0/0/0/0',null,'Column',panelRect),zIndex:10,clip:true},
    node('0/0/0/0/0',null,'Scroll',viewport),
    {...node('0/0/0/0/0/0',null,'Button',triggerRect),alias:selected,selected:true},
    {...node('0/3',`reader-source-group-backdrop:${selectionId}`,'Row',hostRect),alias:'reader-source-group-backdrop'},
    ...trail,
  ];
  const samples = {
    'source-ready':sample('source-ready',5,trail),
    'selected-center-open':sample('selected-center-open',20,opened),
    'selected-center-dismissed':sample('selected-center-dismissed',37,trail),
  };
  const event = (eventSeq,kind,payload) => ({eventSeq,kind,payload,channel:'business',instanceId});
  const initial = {
    owner,trigger:'owner-update',filterRevision:1,category:'all',status:'all',allGroups:true,groupIndex:0,
    readGeneration:7,readFact:'current',state:'rows',count:18,projected:18,queryLength:0,firstAnchor:1,
  };
  const geometry = {owner,groupHostTopVp:0,groupHostBottomVp:hostRect.height/window.density,
    groupHostLeftVp:0,groupHostRightVp:hostRect.width/window.density};
  const actions = Object.fromEntries([['open-selected-center',9,14],['tap-selected-center',25,33]].map(([id,beforeSeq,afterSeq])=>{
    const step = steps.get(id);
    const operation = requestedOperation(step,samples,definition.fixture);
    const command = requireActionDispatch([{event:'command',ok:true,seq:1,args:[
      'shell','uitest','uiInput','click',String(operation.x),String(operation.y),
    ]}],1,operation);
    return [id,{op:'click',from:step.from,targetId:step.target,instanceId,beforeSeq,afterSeq,
      filterTouch:sourceFilterNativeDispatch(definition,step,operation,command.seq)}];
  }));
  const events = [
    event(4,'source.projection',initial),
    event(12,'source.overlay',{owner,overlay:'group',phase:'open',selectionId}),
    event(14,'source.geometry',geometry),
    event(27,'source.projection',{...initial,trigger:'group'}),
    event(30,'source.overlay',{owner,overlay:'group',phase:'dismiss',selectionId}),
  ];
  const context = {samples,actions,events};
  const evaluate = id => {
    const assertion = definition.assertions.find(item=>item.id === id);
    return evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  };
  return {context,evaluate,trail};
}

test('source group trigger edge opens exactly one anchored native panel in the unchanged Source projection',()=>{
  const {context,evaluate,trail} = nativeGroupCenterJourney();
  const id = 'source.group.trigger-touch-edge';
  const result = evaluate(id);
  assert.equal(result.verdict,'PASS',result.reason);
  assert.equal(result.actual.sampleId,'selected-center-open');
  assert.equal(result.actual.nativeInteraction.carrierPath,'0/2/0/0/0');
  assert.deepEqual(result.actual.nativeInteraction.dispatch,{x:640,y:827,probeSeq:1});
  assert.equal(result.actual.nativeInteraction.position,'top');
  const step = steps.get('open-selected-center');
  assert.throws(()=>requestedOperation(step,context.samples,{id:'other'}),/exact public case/u);
  const native = context.samples['selected-center-open'].nodes;
  context.samples['selected-center-open'].nodes = trail;
  assert.equal(evaluate(id).verdict,'FAIL','the stable window does not display the accepted panel');
  context.samples['selected-center-open'].nodes = native;
  context.actions[step.id].filterTouch.y++;
  assert.equal(evaluate(id).verdict,'NOT_RUN','the command journal coordinates must reproduce the measured edge');
});

test('source group option current center closes the exact live panel once while preserving scope and list',()=>{
  const {context,evaluate} = nativeGroupCenterJourney();
  const id = 'source.group.selected-touch-center';
  const result = evaluate(id);
  assert.equal(result.verdict,'PASS',result.reason);
  assert.equal(result.actual.sampleId,'selected-center-dismissed');
  assert.equal(result.actual.nativeInteraction.carrierPath,'0/0/0/0/0/0');
  assert.deepEqual(result.actual.nativeInteraction.dispatch,{x:640,y:903,probeSeq:1});
  assert.equal(result.actual.nativeInteraction.position,'center');
  assert.equal(result.actual.after.filterRevision,result.actual.before.filterRevision);
  const step = steps.get('tap-selected-center');
  assert.throws(()=>requestedOperation(step,context.samples,{id:'other'}),/public fixture/u);
  const backdrop = context.samples['selected-center-open'].nodes.find(node=>node.alias === 'reader-source-group-backdrop');
  backdrop.id = 'reader-source-group-backdrop:source-group:99';
  assert.equal(evaluate(id).verdict,'FAIL');
  backdrop.id = `reader-source-group-backdrop:${selectionId}`;
  context.events[4].payload.selectionId = 'source-group:99';
  assert.equal(evaluate(id).verdict,'FAIL');
  context.events[4].payload.selectionId = selectionId;
  context.events[3].payload.firstAnchor = 2;
  assert.equal(evaluate(id).verdict,'FAIL','retapping the current group must retain the first projected row');
  context.events[3].payload.firstAnchor = 1;
  Object.assign(context.events[3].payload,{groupIndex:1,allGroups:false,filterRevision:2,projected:9});
  assert.equal(evaluate(id).verdict,'FAIL');
});

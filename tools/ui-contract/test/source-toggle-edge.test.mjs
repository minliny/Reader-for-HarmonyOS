import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireActionDispatch, requestedOperation } from '../collectors/harmonyos/records.mjs';
import { summarizeAcceptance } from '../lib/receipt.mjs';
import { evaluateSource } from '../lib/source.mjs';
import { assertSourceToggleEdgeState, sourceToggleEdgeTarget, sourceToggleTouchCaseValid,
  sourceToggleTouchStep } from '../lib/source-toggle-edge.mjs';

const area = {left:0,top:0,width:1120,height:2400};
const envelope = {left:80,top:240,width:154,height:154};
const painted = {left:80,top:275,width:154,height:84};
const owner = {mounting:1,generation:4};
const anchor = 7;
const instanceId = 'current';
const evidenceRefs = [{path:'raw/layout.json'},{path:'raw/screen.png'}];
const window = {id:'reader',revision:3,density:3.5,source:'window-metrics',visibleRectPx:area,keyboard:{visible:false}};
const top = {x:157,y:241};
const bottom = {x:157,y:392};

function fixtureSample(sampleId, beforeSeq, afterSeq) {
  const node = (id,type,path,parentPath,box,clickable = false) => ({id,type,path,parentPath,rectPx:{...box},
    visibleRectPx:{...box},visible:true,opacity:1,enabled:true,clickable});
  return {sampleId,beforeSeq,afterSeq,captureComplete:true,evidenceRefs,instanceId,window:{...window},nodes:[
    node('reader-source-list','List','0',null,area),
    node('reader-source-row-7','Column','0/0','0',{left:20,top:200,width:1000,height:240}),
    node(sourceToggleEdgeTarget,null,'0/0/0','0/0',envelope),
    node(null,'Stack','0/0/0/0','0/0/0',envelope),
    node(null,'Toggle','0/0/0/0/0','0/0/0/0',painted,true),
  ]};
}

const ready = fixtureSample('ready',5,6);
const step = {id:'enable-source',op:'click',target:sourceToggleEdgeTarget,tapEdge:'top',from:'ready'};
const event = (eventSeq,kind,payload) => ({instanceId,channel:'business',kind,eventSeq,evidenceRefs,payload:{owner,...payload}});
const projection = (seq, readGeneration, overrides = {}) => event(seq,'source.projection',{readGeneration,filterRevision:5,
  state:'rows',readFact:'current',count:1,projected:1,firstAnchor:anchor,
  status:'all',category:'all',queryLength:0,groupIndex:0,allGroups:true,...overrides});
const toggle = (seq, phase, payload) => event(seq,'source.toggle',{phase,anchor,...payload});
const read = (seq, readGeneration, enabled) => toggle(seq,'ready',{readGeneration,filterRevision:5,enabled});

test('source row toggle emits the exact outer coordinates only for a visible matched row', () => {
  const operation = requestedOperation(step,{ready},{});
  assert.deepEqual(operation,{op:'click',...top});
  assert.deepEqual(requestedOperation({...step,tapEdge:'bottom'},{ready},{}),{op:'click',...bottom});
  const journal = [{event:'command',ok:true,seq:1,args:['shell','uitest','uiInput','click','157','241']}];
  assert.equal(requireActionDispatch(journal,1,operation).seq,1);
  assert.throws(() => requireActionDispatch(journal,1,{...operation,y:242}), /Unexpected command/u);
  const mark = {eventSeq:7};
  assert.doesNotThrow(() => assertSourceToggleEdgeState(step,ready,mark,[projection(3,1),read(4,1,false)]));
  for (const events of [
    [projection(3,1,{count:2}),read(4,1,false)],
    [projection(3,1),read(4,1,true)],
    [projection(3,1),read(4,1,false),projection(7,2)],
    [projection(3,1),{...read(4,1,false),payload:{...read(4,1,false).payload,anchor:8}}],
  ]) assert.throws(() => assertSourceToggleEdgeState(step,ready,mark,events),/stale/u);
  for (const change of [
    sample => { sample.nodes[4].visibleRectPx.height--; },
    sample => { sample.nodes[3].rectPx.height--; },
    sample => { sample.nodes[1].visibleRectPx.top = 243; },
    sample => { sample.nodes.push({...sample.nodes[4],path:'0/0/0/0/1'}); },
    sample => { sample.window.keyboard = {visible:true}; },
  ]) {
    const sample = fixtureSample('ready',5,6);
    change(sample);
    assert.throws(() => requestedOperation(step,{ready:sample},{}));
  }
});

test('source row toggle keeps a measured bad envelope as FAIL before dispatch', () => {
  const entry = {op:'click', targetId:'reader-settings-source-management', instanceId, beforeSeq:1, afterSeq:2, evidenceRefs};
  const route = event(2,'source.route',{action:'open',from:'settings',to:'source',...owner,previousGeneration:3});
  const events = [route,projection(3,1),read(4,1,false)];
  const acceptedSources = ['native-tree','window-metrics','app-owner'];
  const target = {kind:'toggle-touch-target',action:'open-sources',sample:'ready',expected:{},acceptedSources};
  const write = {kind:'toggle-touch-edge',action:'enable-source',baseline:'ready',sample:'enabled',
    expected:{tapEdge:'top',requestedEnabled:true},acceptedSources};
  const context = sample => ({samples:{[sample.sampleId]:sample},actions:{'open-sources':entry},events});
  const measured = sample => evaluateSource({...target,sample:sample.sampleId},context(sample));
  assert.equal(measured(ready).verdict,'PASS');
  for (const [mutate, reason] of [
    [sample => { sample.nodes[3].rectPx.height -= 10; sample.nodes[3].visibleRectPx.height -= 10; }, /smaller than 44vp/u],
    [sample => { sample.nodes[3].visibleRectPx.height -= 10; }, /clipped/u],
    [sample => { sample.nodes[1].visibleRectPx.top += 50; }, /clipped/u],
    [sample => { sample.nodes[4].visibleRectPx.height = 0; }, /clipped/u],
  ]) {
    const sample = fixtureSample('ready',5,6);
    mutate(sample);
    assert.throws(() => requestedOperation(step,{ready:sample},{}),reason);
    const assessment = measured(sample);
    assert.equal(assessment.verdict,'FAIL');
    assert.match(assessment.reason,reason);
    const undispatched = evaluateSource(write,context(sample));
    assert.equal(undispatched.verdict,'NOT_RUN');
    assert.deepEqual(summarizeAcceptance({assertions:[assessment,undispatched],observationsComplete:false}),
      {observations:'INCOMPLETE',behavior:'FAIL',execution:'INCOMPLETE'});
  }
  for (const mutate of [
    sample => { delete sample.nodes[3].visibleRectPx; },
    sample => { sample.nodes.push({...sample.nodes[4],path:'duplicate'}); },
    sample => { sample.nodes[3].rectPx.height += 10; },
    sample => { sample.captureComplete = false; },
  ]) {
    const sample = fixtureSample('ready',5,6);
    mutate(sample);
    assert.throws(() => requestedOperation(step,{ready:sample},{}));
    assert.equal(measured(sample).verdict,'NOT_RUN');
  }
  const enabled = fixtureSample('enabled',15,16);
  enabled.nodes[3].visibleRectPx.height -= 10;
  assert.equal(evaluateSource({...target,sample:'enabled'}, {...context(enabled),events:[...events,projection(10,2),read(11,2,true)]}).verdict,'FAIL');
  const stale = {...context(enabled),events:[...events,projection(10,2,{owner:{...owner,generation:5}})]};
  assert.equal(evaluateSource({...target,sample:'enabled'},stale).verdict,'NOT_RUN');
  assert.equal(evaluateSource(target,{...context(ready),actions:{}}).verdict,'NOT_RUN');
});

test('source row toggle requires a uniquely admitted write and fresh readback to enable and restore', () => {
  const action = (from,edge,point,probeSeq,beforeSeq,afterSeq) => ({from,edgeTap:{edge,...point,probeSeq},beforeSeq,afterSeq,
    targetId:sourceToggleEdgeTarget,op:'click',instanceId,evidenceRefs});
  const enabled = fixtureSample('enabled',15,16);
  const restored = fixtureSample('restored',25,26);
  const enable = action('ready','top',top,8,7,13);
  const restore = action('enabled','bottom',bottom,18,17,23);
  const admitted = (seq,toggleSeq,requestedEnabled) => toggle(seq,'admitted',{toggleSeq,requestedEnabled});
  const settled = (seq,toggleSeq,requestedEnabled,overrides = {}) => toggle(seq,'settled',{toggleSeq,requestedEnabled,
    confirmation:'confirmed',readback:'succeeded',observedEnabled:requestedEnabled,...overrides});
  const events = [projection(3,1),read(4,1,false),admitted(8,1,true),projection(10,1),read(11,1,true),settled(12,1,true),
    admitted(18,2,false),projection(20,1),read(21,1,false),settled(22,2,false)];
  const context = {samples:{ready,enabled,restored},actions:{enable,restore},events};
  const specification = (action,baseline,sample,tapEdge,requestedEnabled) => ({kind:'toggle-touch-edge',action,baseline,sample,
    expected:{tapEdge,requestedEnabled},acceptedSources:['native-tree','window-metrics','app-owner']});
  const enabling = specification('enable','ready','enabled','top',true);
  const restoring = specification('restore','enabled','restored','bottom',false);
  const enableProof = evaluateSource(enabling,context);
  const restoreProof = evaluateSource(restoring,context);
  assert.equal(enableProof.verdict,'PASS');
  assert.equal(restoreProof.verdict,'PASS');
  assert.equal(restoreProof.actual.observedEnabled,false);
  assert.doesNotMatch(JSON.stringify([enableProof.actual,restoreProof.actual]),/https?:\/\//u);
  const restoreStep = {...step,id:'restore-source',from:'enabled',tapEdge:'bottom'};
  assert.doesNotThrow(() => assertSourceToggleEdgeState(restoreStep,enabled,{eventSeq:17},events));
  assert.throws(() => assertSourceToggleEdgeState(restoreStep,enabled,{eventSeq:17},
    events.map(item => item.eventSeq === 12 ? settled(12,1,true,{confirmation:'unknown'}) : item)),/confirmed enable/u);

  const unchanged = {...context,events:events.slice(0,2)};
  assert.equal(evaluateSource(enabling,unchanged).verdict,'FAIL');
  const wrongSequence = {...context,events:events.map(item => item.eventSeq === 22 ? settled(22,7,false) : item)};
  assert.equal(evaluateSource(restoring,wrongSequence).verdict,'FAIL');
  const unknown = {...context,events:events.map(item => item.eventSeq === 22 ?
    settled(22,2,false,{confirmation:'unknown',readback:'failed',observedEnabled:undefined}) : item)};
  assert.equal(evaluateSource(restoring,unknown).verdict,'NOT_RUN');
  const wrongPoint = {...context,actions:{...context.actions,restore:{...restore,edgeTap:{...restore.edgeTap,y:359}}}};
  assert.equal(evaluateSource(restoring,wrongPoint).verdict,'NOT_RUN');
});

const contract = JSON.parse(readFileSync(new URL('../cases/source-management.row-toggle-touch-edge.json',import.meta.url)));
const touchActions = contract.steps.filter(step=>step.target === sourceToggleEdgeTarget);
const center = {x:157,y:317};

function canonicalToggleCycle() {
  const samples = {'source-ready':fixtureSample('source-ready',5,6)};
  samples['source-ready'].nodes[4].sourcePublicToggleChecked = false;
  const events = [projection(3,1),read(4,1,false)];
  const actions = {};
  for (const [index,step] of touchActions.entries()) {
    const {position,requestedEnabled,sample} = sourceToggleTouchStep(step);
    const beforeSeq = 7 + index*10, afterSeq = beforeSeq+6, toggleSeq = index+1;
    const readGeneration = index+2;
    samples[sample] = fixtureSample(sample,beforeSeq+8,beforeSeq+9);
    samples[sample].nodes[4].sourcePublicToggleChecked = requestedEnabled;
    events.push(toggle(beforeSeq+1,'admitted',{toggleSeq,requestedEnabled}),projection(beforeSeq+3,readGeneration),
      read(beforeSeq+4,readGeneration,requestedEnabled),toggle(beforeSeq+5,'settled',{
        toggleSeq,requestedEnabled,confirmation:'confirmed',readback:'succeeded',observedEnabled:requestedEnabled,
      }));
    actions[step.id] = {op:'click',targetId:step.target,from:step.from,beforeSeq,afterSeq,instanceId,evidenceRefs,
      toggleTap:{position,...{top,bottom,center}[position],probeSeq:beforeSeq+1}};
  }
  return {samples,events,actions};
}

test('source row toggle canonical touches use proven top, bottom and center commands and restore disabled after each pair',()=>{
  const current = canonicalToggleCycle();
  assert.equal(sourceToggleTouchCaseValid(contract),true);
  const missingRestore = {...contract,steps:contract.steps.filter(step=>step.id !== 'restore-source-center')};
  assert.equal(sourceToggleTouchCaseValid(missingRestore),false);
  for (const step of touchActions) {
    const proof = sourceToggleTouchStep(step);
    const {position,requestedEnabled,sample} = proof;
    const action = current.actions[step.id];
    const {probeSeq,...click} = action.toggleTap;
    const {x,y} = click;
    const sampleBefore = current.samples[step.from];
    assert.doesNotThrow(()=>assertSourceToggleEdgeState(step,sampleBefore,{eventSeq:action.beforeSeq},current.events));
    const operation = requestedOperation(step,current.samples,contract.fixture);
    assert.deepEqual(operation,{op:'click',x,y});
    const journal = [{event:'command',ok:true,seq:1,args:['shell','uitest','uiInput','click',String(x),String(y)]}];
    assert.equal(requireActionDispatch(journal,1,operation).seq,1);
    const rule = contract.assertions.find(check=>check.action === step.id);
    const result = evaluateSource({...rule,acceptedSources:rule.sources},current);
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.observedEnabled,requestedEnabled);
    assert.equal(result.actual.sampleId,sample);
    assert.equal(result.actual.nativeCheckedAfter,requestedEnabled);
    assert.deepEqual(result.actual.nativeInteraction,{
      subject:'row-toggle',target:sourceToggleEdgeTarget,carrierPath:'0/0/0/0/0',bounds:envelope,painted,
      visible:true,clipped:false,enabled:true,accepted:true,position,
      actionId:step.id,baselineSampleId:step.from,dispatch:action.toggleTap,
    });
    assert(probeSeq > 0);
  }
  const final = current.events.at(-1);
  assert.equal(final.payload.confirmation,'confirmed');
  assert.equal(final.payload.observedEnabled,false);
});

test('source row toggle center cannot follow an ambiguous or replayed mutation or reach any nonpublic fixture',()=>{
  const current = canonicalToggleCycle();
  const [,,enable,restore] = touchActions;
  const attempt = (step,events) => assertSourceToggleEdgeState(step,current.samples[step.from],
    {eventSeq:current.actions[step.id].beforeSeq},events);
  assert.throws(()=>requestedOperation(enable,current.samples,{id:'another-catalog'}),/exact public/u);
  for (const broken of [
    current.events.filter(event=>!(event.kind === 'source.toggle' && event.payload.phase === 'settled' && event.payload.toggleSeq === 2)),
    current.events.map(event=>event.kind === 'source.toggle' && event.payload.toggleSeq === 2 ?
      {...event,payload:{...event.payload,toggleSeq:1}} : event),
    current.events.map(event=>event.kind === 'source.toggle' && event.payload.phase === 'settled' && event.payload.toggleSeq === 2 ?
      {...event,payload:{...event.payload,confirmation:'unknown'}} : event),
  ]) assert.throws(()=>attempt(enable,broken),/confirmed write sequence/u);
  const unconfirmed = current.events.find(event=>event.kind === 'source.toggle' &&
    event.payload.phase === 'settled' && event.payload.toggleSeq === 3);
  unconfirmed.payload.readback = 'failed';
  assert.throws(()=>attempt(restore,current.events),/confirmed write sequence/u);
  const rule = contract.assertions.find(check=>check.action === enable.id);
  const evaluate = () => evaluateSource({...rule,acceptedSources:rule.sources},current);
  const pending = evaluate();
  assert.equal(pending.verdict,'NOT_RUN');
  assert.equal(pending.actual.nativeInteraction,undefined);
  unconfirmed.payload.readback = 'succeeded';
  current.actions[enable.id].toggleTap.y = top.y;
  assert.equal(evaluate().verdict,'NOT_RUN');
});

test('source row toggle stale native checked state blocks another click and fails a confirmed restoration', () => {
  const current = canonicalToggleCycle();
  const [, restore, enableCenter] = touchActions;
  const rule = contract.assertions.find(check=>check.action === restore.id);
  const restored = current.samples['source-restored'].nodes[4];
  const evaluate = () => evaluateSource({...rule,acceptedSources:rule.sources},current);

  restored.sourcePublicToggleChecked = true;
  const contradicted = evaluate();
  assert.equal(contradicted.verdict,'FAIL');
  assert.match(contradicted.reason,/disagrees/u);
  assert.equal(contradicted.actual.observedEnabled,false);
  assert.equal(contradicted.actual.nativeCheckedAfter,true);
  assert.equal(contradicted.actual.nativeInteraction,undefined);
  assert.throws(()=>requestedOperation(enableCenter,current.samples,contract.fixture),/checked state/u);

  delete restored.sourcePublicToggleChecked;
  assert.equal(evaluate().verdict,'NOT_RUN');
  assert.throws(()=>requestedOperation(enableCenter,current.samples,contract.fixture),/checked state/u);
});

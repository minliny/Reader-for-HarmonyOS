import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCase } from '../lib/cases.mjs';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { assessStructure } from '../lib/receipt-structure.mjs';
import { loadStructureDefinition } from '../lib/structure-contract.mjs';
import { evaluateSource } from '../lib/source.mjs';

const contract = loadCase('source-management.read-loading');
const definition = loadStructureDefinition();
const [assertion] = contract.assertions;
const owner = {mounting:1,generation:5};
const revision = 3;
const instanceId = 'reader';
const windowId = '2';
const proofRef = {path:'raw/original-command-log.jsonl'};
const bounds = {left:0,top:0,width:360,height:800};

function event(eventSeq, kind, payload, channel = 'business') {
  return {instanceId, eventSeq, semanticSeq:eventSeq, deviceMonoMs:eventSeq * 10,
    windowRevision:revision, kind, channel, payload, evidenceRefs:[proofRef]};
}

function actor(id, uniqueId, ancestorIds, type, rectVp = bounds) {
  return {id:`reader-source-${id}`,uniqueId,ancestorIds,type,visible:true,opacity:1,rectVp};
}

function prepare() {
  const actors = [
    actor('content',1,[90,99],'Column'),
    actor('back',2,[83,90,99],'Row'),
    actor('list',3,[1,90,99],'List'),
    actor('footer',4,[84,90,99],'Column'),
    actor('loading-progress',5,[28,3,1,90,99],'LoadingProgress',{left:30,top:200,width:32,height:32}),
  ];
  const loading = {owner,state:'loading',readFact:'loading',readGeneration:5,count:0,projected:0};
  const frame = event(14,'source.read-loading-frame',{
    owner, readGeneration:5, windowId, density:3, widthVp:360, heightVp:800,
    keyboardHidden:true, progressVisibleRatio:1, actors, failureTitle:null,
  },'probe');
  const sample = {instanceId,sampleId:'source-read',beforeSeq:22,hostBeginMs:50,captureComplete:true,
    window:{id:windowId,source:'window-metrics',revision,density:3,keyboard:{visible:false,revision},
      rectPx:{left:0,top:0,width:1080,height:2400}},
    // The later HDC sample binds the normal window and does not show a loader.
    nodes:[...actors.slice(0,4).map(item => ({id:item.id,path:String(item.uniqueId),
      parentPath:item.type === 'List' ? '1' : null,visible:true,opacity:1,visibleRectPx:{...bounds}}))],
    evidenceRefs:[{path:'raw/settled.png'},{path:'raw/settled.json'}]};
  const context = {actions:{'open-sources':{instanceId,op:'click',targetId:'reader-settings-source-management',
    from:'settings',beforeSeq:10,afterSeq:17,hostEndMs:40,outcomeSettled:true}},samples:{'source-read':sample},
    events:[event(11,'source.route',{action:'open',from:'settings',to:'source',...owner,previousGeneration:4}),
      event(12,'source.projection',loading),frame,
      event(18,'source.projection',{...loading,state:'empty',readFact:'current',readGeneration:6})]};
  return {context,frame,sample};
}

function assess(context) {
  const result = evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  const condition = conditionApplicability(assertion,context,result,contract);
  const structure = assessStructure(contract,context,definition,{conditions:{[assertion.id]:condition}});
  return {result,condition,structure};
}

test('Source read-loading v2 accepts only a same-open attached ArkUI loading frame', () => {
  const {context} = prepare();
  const {result,condition,structure} = assess(context);
  assert.equal(contract.version,2);
  assert.equal(result.verdict,'PASS');
  assert.equal(result.actual.nativeObservation,'ArkUI.FrameNode');
  assert.equal(result.actual.nativeFrameEventSeq,14);
  assert.equal(condition.sampleApplies,true);
  assert.equal(structure.behavior,'PASS');
  assert.equal(structure.observations,'COMPLETE');
  const checks = structure.states[0].checks;
  assert.deepEqual(checks.map(item=>item.ruleId),['source.scaffold','source.catalog','source.read-loading']);
  assert.ok(checks.every(item=>item.evidenceRefs.some(ref=>ref.path === proofRef.path)));
  assert.ok(checks.every(item=>!item.evidenceRefs.some(ref=>ref.path.endsWith('.png'))));
});

test('Source read-loading v2 rejects stale, hidden, corrupt or missing native evidence', () => {
  for (const change of [
    ({context}) => context.events.splice(2,1),
    ({context,frame}) => context.events.push({...frame,eventSeq:15}),
    ({frame}) => { frame.instanceId = 'different'; },
    ({frame}) => { frame.payload.owner = {...owner,generation:4}; },
    ({frame}) => { frame.payload.readGeneration++; },
    ({frame}) => { frame.windowRevision++; },
    ({frame}) => { frame.payload.windowId = '3'; },
    ({frame}) => { frame.payload.widthVp++; },
    ({frame}) => { frame.payload.keyboardHidden = false; },
    ({frame}) => { frame.payload.progressVisibleRatio = 0; },
    ({frame}) => { delete frame.payload.failureTitle; },
    ({frame}) => { frame.payload.actors[4].type = 'Text'; },
    ({frame}) => { frame.payload.actors[4].ancestorIds = [3,1,83,99]; },
    ({frame,context}) => { frame.eventSeq = 19; context.events.splice(2,1); context.events.push(frame); },
  ]) {
    const fixture = prepare();
    change(fixture);
    const {result,condition,structure} = assess(fixture.context);
    assert.equal(result.verdict,'NOT_RUN');
    assert.equal(condition.status,'APPLIES');
    assert.equal(condition.sampleApplies,false);
    assert.equal(structure.behavior,'NOT_RUN');
  }
});

test('Source read-loading v2 still enforces native clipping, ancestry and failure-title exclusion', () => {
  for (const change of [
    ({frame}) => { frame.payload.actors[4].ancestorIds = [84,90,99]; },
    ({frame}) => { frame.payload.actors[4].rectVp = {left:500,top:0,width:32,height:32}; },
    ({frame}) => { frame.payload.actors[4].opacity = 0; },
    ({frame}) => { frame.payload.failureTitle = actor('read-failure-title',6,[29,3,1,90,99],'Text'); },
  ]) {
    const fixture = prepare();
    change(fixture);
    const {structure,condition} = assess(fixture.context);
    assert.equal(condition.sampleApplies,true);
    assert.equal(structure.behavior,'FAIL');
  }
});

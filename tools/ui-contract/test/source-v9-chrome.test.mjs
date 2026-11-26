import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { requestedOperation, requireActionDispatch } from '../collectors/harmonyos/records.mjs';
import { publicAssertionDefinition } from '../lib/assertion-contract.mjs';
import { validate } from '../lib/evidence.mjs';
import { evaluateSource } from '../lib/source.mjs';
import { sourceV9ChromeActions, sourceV9ChromeCase, sourceV9ChromeDispatch, sourceV9ChromeEntry,
  validateSourceV9ChromeCase } from '../lib/source-v9-chrome.mjs';

const definition = validate('case',JSON.parse(readFileSync(new URL(`../cases/${sourceV9ChromeCase}.json`,import.meta.url))));
const instanceId = 'source-v9-chrome';
const full = {left:0,top:0,width:400,height:800};
const rect = (left,top,width,height)=>({left,top,width,height});
const controls = new Map(sourceV9ChromeActions.map(policy=>[policy.action,policy]));

function node(path,id,type,rectPx,extra = {}) {
  return {path,parentPath:path.includes('/') ? path.slice(0,path.lastIndexOf('/')) : null,id,type,rectPx,
    visibleRectPx:{...rectPx},source:'native-tree',opacity:1,visible:true,enabled:true,clickable:type === 'Button',...extra};
}

function nativeNodes(view,generation) {
  const root = node('0',null,'root',full);
  if (view === 'settings') return [root,node('0/0','reader-settings-source-management','Row',rect(15,120,370,50))];
  if (view === 'footer-import') return [
    root,node('0/0','reader-source-v9-import','Stack',full),
    node('0/0/0','reader-source-v9-import-file','Button',rect(15,130,370,60)),
  ];
  const list = node('0/0','reader-source-list','List',rect(0,84,400,630));
  const footer = node('0/1','reader-source-footer','Column',rect(0,714,400,86));
  const head = node('0/2','reader-native-slot:1','Row',rect(0,28,400,48));
  if (view === 'footer-batch') {
    return [root,list,footer,head,node('0/1/0','reader-source-v9-batch-dock','Row',rect(8,727,384,48)),
      ...['enable','disable','move','detect','delete'].map((name,index)=>
        node(`0/1/0/${index}`,`reader-source-batch-${name}`,'Button',rect(10+index*75,727,72,48),{enabled:false}))];
  }
  const nodes = [root,list,footer,head,
    node('0/2/0','reader-source-back','Button',rect(14,30,44,44)),
    node('0/2/1','reader-source-header-tools','Row',rect(335,29,50,46)),
    node('0/2/1/0',`source-back:${generation}:tools:header`,'Button',rect(337,30,44,44)),
    node('0/1/0',`source-back:${generation}:tools:footer`,'Button',rect(16,727,112,44)),
    node('0/1/1',`source-back:${generation}:import:footer`,'Button',rect(140,727,244,44)),
  ];
  if (view === 'header-more') {
    nodes.push(node('0/3','reader-source-v9-more-menu','Column',rect(218,72,166,160)),
      ...['subscriptions','groups','detect','export'].map((name,index)=>
        node(`0/3/${index}`,`reader-source-v9-open-${name}`,'Button',rect(225,78+index*36,150,36))));
  }
  return nodes;
}

function proof() {
  const context = {samples:{},actions:{},events:[]};
  let seq = 0;
  let generation = 2;
  const mounting = 1;
  let view = 'settings';
  const owner = ()=>({mounting,generation});
  const event = (kind,payload)=>context.events.push({kind,payload,instanceId,eventSeq:++seq,channel:'business'});
  const route = (action,from,to)=> {
    const previousGeneration = generation++;
    event('source.route',{action,from,to,mounting,previousGeneration,generation});
  };
  const project = ()=>event('source.projection',{owner:owner(),state:'rows',readFact:'current',count:8,projected:8,
    firstAnchor:22,readGeneration:2,filterRevision:1,status:'all',category:'all',groupIndex:0,queryLength:0,allGroups:true});
  for (const step of definition.steps) {
    if (step.kind !== 'action') {
      context.samples[step.id] = {sampleId:step.id,instanceId,beforeSeq:++seq,afterSeq:++seq,
        window:{id:'33',density:1,source:'window-metrics',visibleRectPx:full,keyboard:{visible:false}},
        captureComplete:step.kind === 'sample',evidenceRefs:[{path:`raw/${step.id}.png`},{path:`raw/${step.id}.json`}],
        nodes:nativeNodes(view,generation)};
      continue;
    }
    const policy = controls.get(step.id);
    const action = {op:step.op,from:step.from,instanceId,targetId:step.target,key:step.key,beforeSeq:++seq,outcomeSettled:true};
    if (step.id.startsWith('open-v9-sources-')) {
      route('open','settings','source');
      project();
      view = 'source';
    } else if (policy) {
      const operation = requestedOperation(step,context.samples,definition.fixture);
      const command = {event:'command',seq:1,ok:true,
        args:['shell','uitest','uiInput','click',String(operation.x),String(operation.y)]};
      const dispatch = requireActionDispatch([command],1,operation);
      action.v9ChromeTap = {x:operation.x,y:operation.y,probeSeq:dispatch.seq};
      view = policy.name === 'header-back' ? 'settings' : policy.name;
      if (policy.name === 'header-back') route('close','source','settings');
      if (policy.name === 'footer-batch') event('source.v9-list-transition',{owner:owner(),view:'batch',phase:'enter',revision:1});
    } else if (step.op === 'keyEvent') {
      if (view === 'footer-batch') {
        event('source.v9-list-transition',{owner:owner(),view:'batch',phase:'return',revision:1,filterMatchesDeparture:true});
        project();
      }
      view = 'source';
    }
    action.afterSeq = ++seq;
    context.actions[step.id] = action;
  }
  return context;
}

const byId = id=>definition.assertions.find(assertion=>assertion.id === `source.v9-chrome.${id}`);
const evaluate = (assertion,context)=>evaluateSource({...assertion,acceptedSources:assertion.sources},context);

test('v9 chrome definition keeps all four native geometries and eight exact touch/return chains',()=>{
  assert.equal(validateSourceV9ChromeCase(definition),true);
  assert.equal(definition.steps.length,35);
  assert.equal(definition.assertions.length,12);
  for(const assertion of definition.assertions) assert.doesNotThrow(()=>publicAssertionDefinition(assertion));
  for(const alter of [
    contract=>{contract.fixture.id = 'public-source-chrome-touch-v1';},
    contract=>{contract.steps.find(step=>step.id === 'tap-v9-footer-import-top').tapEdge = 'bottom';},
    contract=>{contract.steps.find(step=>step.id === 'back-v9-header-more-center').from = 'source-ready-center';},
    contract=>{contract.steps.find(step=>step.id === 'settings-returned-top').afterAction = 'tap-v9-header-back-center';},
    contract=>{contract.assertions.pop();},
  ]) {
    const invalid = structuredClone(definition);
    alter(invalid);
    assert.equal(validateSourceV9ChromeCase(invalid),false);
  }
});

test('center and upper-edge commands hit the actual scoped native Buttons and show their v9 surfaces',()=>{
  const context = proof();
  const centers = {'header-more':[359,52],'footer-batch':[72,749],'footer-import':[262,749],'header-back':[36,52]};
  for(const assertion of definition.assertions){
    const value = evaluate(assertion,context);
    assert.equal(value.verdict,'PASS',`${assertion.id} ${value.reason}`);
    if (assertion.kind === sourceV9ChromeDispatch) {
      const policy = controls.get(assertion.action);
      const [x,centerY] = centers[policy.name];
      const y = policy.position === 'center' ? centerY : centerY-21;
      const interaction = value.actual.nativeInteraction;
      assert.deepEqual(interaction.dispatch,{x,y,probeSeq:1});
      assert.equal(interaction.position,policy.position);
      assert.equal(interaction.subject,policy.name);
      assert.equal(interaction.accepted,true);
    } else {
      assert.ok(value.actual.widthVp >= 44);
      assert.ok(value.actual.heightVp >= 44);
    }
  }
});

test('v9 native witness rejects incorrect commands, retired surfaces, and unexpected writes',()=>{
  const wrongPhysicalPoint = proof();
  wrongPhysicalPoint.actions['tap-v9-footer-import-top'].v9ChromeTap.y++;
  assert.equal(evaluate(byId('footer-import.top'),wrongPhysicalPoint).verdict,'NOT_RUN');

  const falseCarrier = proof();
  const sample = falseCarrier.samples['source-ready-center'];
  const button = sample.nodes.find(item=>item.id?.endsWith(':tools:header'));
  button.id = 'artificial-more';
  button.alias = 'reader-source-header-tools-button';
  assert.equal(evaluate(byId('header-more.geometry'),falseCarrier).verdict,'NOT_RUN');

  const clipped = proof();
  clipped.samples['returned-footer-batch-center'].nodes.find(item=>item.id?.endsWith(':import:footer')).visibleRectPx.height--;
  assert.equal(evaluate(byId('footer-import.geometry'),clipped).verdict,'FAIL');

  const firstBackMissing = proof();
  delete firstBackMissing.actions['back-v9-header-more-center'];
  assert.equal(evaluate(byId('header-more.center'),firstBackMissing).verdict,'NOT_RUN');

  const oldDialog = proof();
  oldDialog.samples['opened-footer-import-center'].nodes[1].id = 'reader-json-import:1';
  assert.equal(evaluate(byId('footer-import.center'),oldDialog).verdict,'FAIL');

  const selectedBatch = proof();
  selectedBatch.samples['opened-footer-batch-center'].nodes.find(item=>item.id === 'reader-source-batch-delete').enabled = true;
  assert.equal(evaluate(byId('footer-batch.center'),selectedBatch).verdict,'FAIL');

  const unexpectedWrite = proof();
  unexpectedWrite.events.push({instanceId,channel:'business',kind:'source.toggle',
    eventSeq:unexpectedWrite.actions['tap-v9-footer-import-center'].beforeSeq+1,payload:{phase:'admitted'}});
  assert.equal(evaluate(byId('footer-import.center'),unexpectedWrite).verdict,'FAIL');

  const staleReopening = proof();
  const top = staleReopening.actions[sourceV9ChromeEntry('top').action];
  staleReopening.events.find(event=>event.kind === 'source.route' && event.eventSeq > top.beforeSeq)
    .payload.previousGeneration--;
  assert.equal(evaluate(byId('header-more.top'),staleReopening).verdict,'NOT_RUN');
});

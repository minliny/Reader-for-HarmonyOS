import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {requestedOperation,requireActionDispatch} from '../collectors/harmonyos/records.mjs';
import {publicAssertionDefinition} from '../lib/assertion-contract.mjs';
import {evaluateSource} from '../lib/source.mjs';
import {sourceFilterClearAction,sourceFilterClearAssertion,sourceFilterClearCase,sourceFilterClearTarget} from '../lib/source-filter-clear-edge.mjs';

const definition = JSON.parse(readFileSync(new URL('../cases/'+sourceFilterClearCase+'.json',import.meta.url)));
const step = definition.steps.find(step=>step.id === sourceFilterClearAction);
const assertion = definition.assertions.find(assertion=>assertion.id === sourceFilterClearAssertion);
const instanceId = 'filter-clear-public-source';
const owner = {generation:3,mounting:2};
const rect = (left,top,width,height)=>({left,top,width,height});
const bounds = rect(100,350,120,48);
const visibleRectPx = rect(0,0,400,800);
const node = (path,parentPath,id,type,rectPx)=>({path,parentPath,id,type,rectPx,visibleRectPx:{...rectPx},
  source:'native-tree',visible:true,enabled:true,clickable:type === 'Button',opacity:1});

function sample(sampleId,beforeSeq,{empty = false,anchor = 23,revision = 4} = {}) {
  const nodes = [
    node('0',null,null,'root',visibleRectPx),
    node('0/0','0','reader-source-list','List',rect(0,52,400,695)),
    node('0/1','0','reader-source-back','Button',rect(19,2,44,44)),
  ];
  if (empty) nodes.push(
    node('0/0/0','0/0','reader-source-filtered-empty','ListItem',rect(24,240,352,210)),
    node('0/0/0/0','0/0/0',sourceFilterClearTarget,'Button',bounds),
  );
  else nodes.push(node('0/0/0','0/0','reader-source-row-'+anchor,'Column',rect(24,338,352,67)));
  return {sampleId,beforeSeq,afterSeq:beforeSeq+2,instanceId,nodes,captureComplete:true,
    window:{id:'48',source:'window-metrics',revision,density:1,keyboard:{visible:false},visibleRectPx},
    evidenceRefs:[{path:`raw/${sampleId}.png`},{path:`raw/${sampleId}.json`}]};
}

const event = (eventSeq,kind,payload)=>({eventSeq,kind,payload,channel:'business',instanceId,evidenceRefs:[{path:'raw/owner.json'}]});
const action = (from,beforeSeq,afterSeq,targetId,extra)=>({from,beforeSeq,afterSeq,targetId,op:'click',instanceId,
  ...extra,evidenceRefs:[{path:'raw/journal.json'}]});
const initial = {owner,trigger:'read',state:'rows',readFact:'current',readGeneration:6,filterRevision:2,
  count:3,projected:3,firstAnchor:23,groupIndex:0,status:'all',category:'all',allGroups:true,queryLength:0};
const prior = {...initial,trigger:'edit',state:'filteredEmpty',projected:0,firstAnchor:0,queryLength:18,filterRevision:3};
const cleared = {...initial,trigger:'clear',filterRevision:4};

function proof() {
  const samples = {
    'source-ready':sample('source-ready',12,{revision:2}),
    'zero-match':sample('zero-match',36,{empty:true}),
    cleared:sample('cleared',51),
  };
  const operation = requestedOperation(step,samples,definition.fixture);
  const command = {event:'command',seq:1,ok:true,args:['shell','uitest','uiInput','click','160','351']};
  const dispatch = requireActionDispatch([command],1,operation);
  return {
    samples,
    actions:{
      'open-sources':action('settings',5,11,'reader-settings-source-management'),
      [step.id]:action(step.from,40,47,step.target,{edgeTap:{edge:'top',x:operation.x,y:operation.y,probeSeq:dispatch.seq}}),
    },
    events:[
      event(8,'source.route',{...owner,previousGeneration:2,action:'open',from:'settings',to:'source'}),
      event(10,'source.projection',{...initial}),event(31,'source.projection',{...prior}),event(45,'source.projection',{...cleared}),
    ],
  };
}

const evaluate = context=>evaluateSource({...assertion,acceptedSources:assertion.sources},context);

test('source clear upper edge uses only the full scoped native Button and actual command',()=>{
  const samples = { 'zero-match':sample('zero-match',36,{empty:true}) };
  const operation = requestedOperation(step,samples,definition.fixture);
  assert.deepEqual(operation,{op:'click',x:160,y:351});
  const command = {event:'command',seq:1,ok:true,args:['shell','uitest','uiInput','click','160','374']};
  assert.throws(()=>requireActionDispatch([command],1,operation),/Unexpected command/u);
  assert.throws(()=>requestedOperation(step,samples,{...definition.fixture,id:'another-fixture'}),/exact public/u);
  const button = samples['zero-match'].nodes.at(-1);
  button.visibleRectPx = rect(100,351,120,47);
  assert.throws(()=>requestedOperation(step,samples,definition.fixture),/clipped/u);
  button.visibleRectPx = button.rectPx;
  button.parentPath = '0/0';
  assert.throws(()=>requestedOperation(step,samples,definition.fixture),/missing or ambiguous/u);
});

test('source clear upper edge proves one accepted reset and the original public first row',()=>{
  publicAssertionDefinition(assertion);
  const context = proof();
  const result = evaluate(context);
  assert.equal(result.verdict,'PASS',result.reason);
  assert.equal(result.actual.sampleId,'cleared');
  assert.equal(result.actual.clearAcceptances,1);
  assert.deepEqual(result.actual.nativeInteraction,{
    subject:'filter-empty-clear',target:sourceFilterClearTarget,carrierPath:'0/0/0/0',bounds,
    visible:true,enabled:true,clipped:false,position:'top',accepted:true,actionId:step.id,baselineSampleId:'zero-match',
    dispatch:{x:160,y:351,probeSeq:1},
  });
  assert.ok(['raw/source-ready.png','raw/zero-match.json','raw/cleared.png','raw/journal.json','raw/owner.json']
    .every(path=>result.evidenceRefs.some(ref=>ref.path === path)));
  context.events.at(-1).payload.firstAnchor = 26;
  context.samples.cleared = sample('cleared',51,{anchor:26});
  const wrongRow = evaluate(context);
  assert.equal(wrongRow.verdict,'FAIL');
  assert.equal(wrongRow.actual.nativeInteraction,undefined);
});

test('source clear upper edge withholds proof for stale dispatch or prior owner and fails a credible unchanged empty view',()=>{
  const center = proof();
  center.actions[step.id].edgeTap.y = 374;
  assert.equal(evaluate(center).verdict,'NOT_RUN');
  const stale = proof();
  stale.events[2].payload.owner = {...owner,generation:4};
  assert.equal(evaluate(stale).verdict,'NOT_RUN');
  const missing = proof();
  missing.events.pop();
  assert.equal(evaluate(missing).verdict,'NOT_RUN');
  missing.samples.cleared = sample('cleared',51,{empty:true});
  assert.equal(evaluate(missing).verdict,'FAIL');
  const duplicate = proof();
  duplicate.events.push(event(46,'source.projection',{...cleared}));
  assert.equal(evaluate(duplicate).verdict,'FAIL');
  const retained = proof();
  const filtered = retained.samples['zero-match'].nodes.at(-2);
  retained.samples.cleared.nodes.push({...filtered,path:'0/0/1'}, {...filtered,path:'0/0/2'});
  assert.equal(evaluate(retained).verdict,'FAIL');
  const replaced = proof();
  for (const earlier of [replaced.samples['source-ready'],replaced.actions['open-sources'],...replaced.events.slice(0,2)]) {
    earlier.instanceId = 'older-public-source';
  }
  assert.equal(evaluate(replaced).verdict,'NOT_RUN');
  const left = proof();
  left.events.push(event(49,'source.route',{...owner,generation:4,previousGeneration:3,action:'close',from:'source',to:'settings'}));
  assert.equal(evaluate(left).verdict,'FAIL');
});

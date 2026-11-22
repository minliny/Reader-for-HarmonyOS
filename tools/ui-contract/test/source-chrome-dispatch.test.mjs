import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {requestedOperation,requireActionDispatch} from '../collectors/harmonyos/records.mjs';
import {publicAssertionDefinition} from '../lib/assertion-contract.mjs';
import {sourceChromeActions,sourceChromeCase,sourceChromeTopActions,sourceChromeTopEntry} from '../lib/source-chrome-dispatch.mjs';
import {evaluateSource} from '../lib/source.mjs';

const definition = JSON.parse(readFileSync(new URL('../cases/'+sourceChromeCase+'.json',import.meta.url)));
const instanceId = 'chrome-native';
const rect = (left,top,width,height) => ({left,top,width,height});
const display = rect(0,0,400,800);
const targets = {
  'header-tools': {path:'0/2/0',point:{x:358,y:58},topY:37},
  'footer-manage': {path:'0/4/0',point:{x:98,y:744},topY:721},
  'footer-add': {path:'0/4/1',point:{x:301,y:744},topY:721},
  'header-back': {path:'0/1/0',point:{x:43,y:58},topY:37},
};

function node(path,id,type,rectPx) {
  const parentPath = path.includes('/') ? path.slice(0,path.lastIndexOf('/')) : null;
  return {path,parentPath,id,type,rectPx,visibleRectPx:{...rectPx},source:'native-tree',
    visible:true,enabled:true,opacity:1,clickable:type === 'Button'};
}

function sample(sampleId,beforeSeq,view,identity) {
  const nodes = [node('0',null,'root',display)];
  if (view === 'settings') nodes.push(node('0/1','reader-settings-source-management','Row',rect(25,440,350,52)));
  if (view === 'tools') nodes.push(node('0/1','reader-source-tools-back','Button',rect(21,36,44,44)));
  if (view === 'source' || view === 'add') {
    nodes.push(
      node('0/1','reader-native-slot:3','Row',rect(0,20,400,72)),
      node('0/1/0','reader-source-back','Button',rect(21,36,44,44)),
      node('0/2','reader-source-header-tools','Row',rect(330,30,56,56)),
      node('0/2/0',`source-back:${identity}:tools:header`,'Button',rect(336,36,44,44)),
      node('0/3','reader-source-list','List',rect(9,93,382,607)),
      node('0/4','reader-source-footer','Column',rect(0,711,400,89)),
      node('0/4/0',`source-back:${identity}:tools:footer`,'Button',rect(18,720,160,48)),
      node('0/4/1',`source-back:${identity}:import:footer`,'Button',rect(221,720,160,48)),
    );
  }
  if (view === 'add') {
    nodes.push(
      {...node('0/5','reader-json-import:1','Stack',display),alias:'reader-source-inline-import-dialog'},
      {...node('0/5/0',null,'Text',rect(30,340,340,44)),sourceInlineImportDialogTitle:true},
      node('0/5/1','reader-json-import:1:local','Button',rect(30,401,340,44)),
    );
  }
  return {sampleId,instanceId,beforeSeq,afterSeq:beforeSeq+2,nodes,captureComplete:true,
    sourceInlineImportDialogObserved:true, window:{source:'window-metrics',id:'72',density:1,visibleRectPx:display,
      keyboard:{visible:false}},evidenceRefs:[{path:`raw/${sampleId}.json`},{path:`raw/${sampleId}.png`}]};
}

const input = (op,from,beforeSeq,afterSeq,extra) => ({op,from,beforeSeq,afterSeq,instanceId,...extra,
  evidenceRefs:[{path:'raw/commands.json'}]});
const event = (eventSeq,kind,payload) => ({eventSeq,kind,payload,channel:'business',instanceId,
  evidenceRefs:[{path:'raw/owner.json'}]});
const route = (seq,action,from,to,previousGeneration,generation) =>
  event(seq,'source.route',{action,from,to,previousGeneration,generation,mounting:2});
const projection = (seq,generation,readGeneration) => event(seq,'source.projection',{
  owner:{generation,mounting:2},state:'rows',readFact:'current',readGeneration,count:4,projected:4,
  firstAnchor:13,filterRevision:1,status:'all',category:'all',groupIndex:0,queryLength:0,allGroups:true,
});

function verifiedClick(step,samples,{x,y}) {
  const operation = requestedOperation(step,samples,definition.fixture);
  assert.deepEqual(operation,{op:'click',x,y});
  const command = {event:'command',seq:1,ok:true,args:['shell','uitest','uiInput','click',String(x),String(y)]};
  const dispatch = requireActionDispatch([command],1,operation);
  assert.throws(()=>requireActionDispatch([{...command,args:command.args.with(4,String(x+1))}],1,operation),
    /Unexpected command/u);
  return {x,y,probeSeq:dispatch.seq};
}

function proof() {
  const samples = Object.fromEntries([
    ['settings',10,'settings'],['source-ready',25,'source',1],
    ['header-tools-open',40,'tools'],['header-tools-returned',55,'source',2],
    ['footer-tools-open',70,'tools'],['footer-tools-returned',85,'source',3],
    ['footer-add-dialog',100,'add',3],['footer-add-returned',115,'source',3],
    ['settings-returned',130,'settings'],
  ].map(args=>[args[0],sample(...args)]));
  const actions = {
    'open-sources':input('click','settings',14,23,{targetId:'reader-settings-source-management'}),
    'back-header-tools':input('keyEvent','header-tools-open',44,53,{key:'Back'}),
    'back-footer-tools':input('keyEvent','footer-tools-open',74,83,{key:'Back'}),
    'back-footer-add':input('keyEvent','footer-add-dialog',104,113,{key:'Back'}),
  };
  sourceChromeActions.forEach((policy,index)=>{
    const step = definition.steps.find(item=>item.id === policy.action);
    const chromeTap = verifiedClick(step,samples,targets[policy.name].point);
    actions[policy.action] = input('click',step.from,29+index*30,38+index*30,
      {targetId:step.target,chromeTap});
  });
  return {samples,actions,events:[
    route(17,'open','settings','source',2,3),projection(22,3,4),
    route(32,'tools','source','sourceTools',3,4),route(47,'tools-back','sourceTools','source',4,5),projection(52,5,5),
    route(62,'tools','source','sourceTools',5,6),route(77,'tools-back','sourceTools','source',6,7),projection(82,7,6),
    route(122,'close','source','settings',7,8),
  ]};
}

function topProof() {
  const context = proof();
  const {samples,actions,events} = context;
  const points = [
    [sourceChromeTopEntry.sample,145,'source',4],
    ['header-tools-open-top',160,'tools'],['header-tools-returned-top',175,'source',5],
    ['footer-tools-open-top',190,'tools'],['footer-tools-returned-top',205,'source',6],
    ['footer-add-dialog-top',220,'add',6],['footer-add-returned-top',235,'source',6],
    ['settings-returned-top',250,'settings'],
  ];
  for (const args of points) samples[args[0]] = sample(...args);
  actions[sourceChromeTopEntry.action] = input('click',sourceChromeTopEntry.parent,134,143,{targetId:'reader-settings-source-management'});
  sourceChromeTopActions.forEach((policy,index)=>{
    const step = definition.steps.find(item=>item.id === policy.action);
    const {point,topY} = targets[policy.name];
    const chromeTap = verifiedClick(step,samples,{x:point.x,y:topY});
    actions[policy.action] = input('click',step.from,149+index*30,158+index*30,{targetId:step.target,chromeTap});
    if (policy.returnAction)
      actions[policy.returnAction] = input('keyEvent',policy.opened,164+index*30,173+index*30,{key:'Back'});
  });
  events.push(
    route(137,'open','settings','source',8,9),projection(142,9,7),
    route(152,'tools','source','sourceTools',9,10),route(167,'tools-back','sourceTools','source',10,11),projection(172,11,8),
    route(182,'tools','source','sourceTools',11,12),route(197,'tools-back','sourceTools','source',12,13),projection(202,13,9),
    route(242,'close','source','settings',13,14),
  );
  return context;
}

function evaluate(context,name,kind = 'dispatch') {
  const assertion = definition.assertions.find(item=>item.id === `source.chrome.${name}.${kind}`);
  publicAssertionDefinition(assertion);
  return evaluateSource({...assertion,acceptedSources:assertion.sources},context);
}

test('source chrome each native carrier reaches its own ordinary safe endpoint',()=>{
  const context = proof();
  for (const policy of sourceChromeActions) {
    const geometry = evaluate(context,policy.name,'geometry');
    assert.equal(geometry.verdict,'PASS',geometry.reason);
    assert.equal(geometry.actual.sampleId,policy.baseline);
    const delivery = evaluate(context,policy.name);
    assert.equal(delivery.verdict,'PASS',delivery.reason);
    assert.equal(delivery.actual.sampleId,policy.sample);
    const bounds = context.samples[policy.baseline].nodes.find(node=>node.path === targets[policy.name].path).visibleRectPx;
    const native = {subject:policy.name,target:policy.target,carrierPath:targets[policy.name].path,bounds,
      visible:true,clipped:false,enabled:true};
    assert.deepEqual(geometry.actual.nativeInteraction,native);
    assert.deepEqual(delivery.actual.nativeInteraction,{...native,position:'center',accepted:true,
      actionId:policy.action,baselineSampleId:policy.baseline,dispatch:context.actions[policy.action].chromeTap});
    assert.ok(delivery.evidenceRefs.some(ref=>ref.path === `raw/${policy.opened ?? policy.sample}.png`));
    assert.ok(delivery.evidenceRefs.some(ref=>ref.path === 'raw/commands.json'));
    assert.ok(delivery.evidenceRefs.some(ref=>ref.path === 'raw/owner.json'));
  }
});

test('source chrome 44vp, clipping and enabled state remain independent of exact dispatch',()=>{
  const context = proof();
  const header = context.samples['source-ready'].nodes.find(node=>node.path === targets['header-tools'].path);
  header.rectPx = header.visibleRectPx = rect(339,36,38,44);
  const geometry = evaluate(context,'header-tools','geometry');
  assert.equal(geometry.verdict,'FAIL');
  assert.equal(geometry.actual.nativeInteraction,undefined);
  assert.equal(evaluate(context,'header-tools').verdict,'PASS');
  header.visibleRectPx = rect(341,36,36,44);
  assert.equal(evaluate(context,'header-tools','geometry').verdict,'FAIL');
  assert.equal(evaluate(context,'header-tools').verdict,'NOT_RUN');
  header.visibleRectPx = header.rectPx;
  context.samples['source-ready'].nodes.find(node=>node.path === header.parentPath).enabled = false;
  assert.equal(evaluate(context,'header-tools','geometry').verdict,'FAIL');
  context.samples['source-ready'].nodes.find(node=>node.path === header.parentPath).enabled = true;
  header.type = 'Row';
  assert.equal(evaluate(context,'header-tools','geometry').verdict,'NOT_RUN');
  assert.equal(evaluate(context,'header-tools').verdict,'NOT_RUN');
});

test('source chrome preserves credible wrong openings even when safe Back cannot run',()=>{
  const wrongTools = proof();
  wrongTools.samples['header-tools-open'] = sample('header-tools-open',40,'source',1);
  delete wrongTools.actions['back-header-tools'];
  const rejected = evaluate(wrongTools,'header-tools');
  assert.equal(rejected.verdict,'FAIL');
  assert.equal(rejected.actual.nativeInteraction,undefined);
  const wrongDialog = proof();
  wrongDialog.samples['footer-add-dialog'].nodes.find(node=>node.sourceInlineImportDialogTitle).sourceInlineImportDialogTitle = false;
  delete wrongDialog.actions['back-footer-add'];
  assert.equal(evaluate(wrongDialog,'footer-add').verdict,'FAIL');
  const wrongParent = proof();
  wrongParent.samples['settings-returned'] = sample('settings-returned',130,'tools');
  assert.equal(evaluate(wrongParent,'header-back').verdict,'FAIL');
});

test('source chrome binds the exact owner, projection and command; missing evidence stays open',()=>{
  const staleOwner = proof();
  staleOwner.events.find(event=>event.eventSeq === 62).payload.previousGeneration = 3;
  assert.equal(evaluate(staleOwner,'footer-manage').verdict,'FAIL');
  const changedCatalogue = proof();
  changedCatalogue.events.find(event=>event.eventSeq === 82).payload.firstAnchor += 1;
  assert.equal(evaluate(changedCatalogue,'footer-manage').verdict,'FAIL');
  const unexpectedImport = proof();
  unexpectedImport.events.push(event(107,'source.import-status-action',{phase:'ready'}));
  assert.equal(evaluate(unexpectedImport,'footer-add').verdict,'FAIL');
  const staleCarrier = proof();
  staleCarrier.actions['tap-footer-add'].chromeTap.x += 1;
  assert.equal(evaluate(staleCarrier,'footer-add').verdict,'NOT_RUN');
  const partialDialog = proof();
  partialDialog.samples['footer-add-dialog'].captureComplete = false;
  assert.equal(evaluate(partialDialog,'footer-add').verdict,'NOT_RUN');
  const noBack = proof();
  delete noBack.actions['back-footer-add'];
  assert.equal(evaluate(noBack,'footer-add').verdict,'NOT_RUN');
  const noStart = proof();
  delete noStart.samples['footer-add-returned'];
  assert.equal(evaluate(noStart,'header-back').verdict,'NOT_RUN');
  const missingParent = proof();
  delete missingParent.samples.settings;
  assert.equal(evaluate(missingParent,'header-back').verdict,'NOT_RUN');
  for (const [name,seq] of [['header-tools',32],['footer-manage',82],['header-back',122]]) {
    const noOwner = proof();
    noOwner.events = noOwner.events.filter(event=>event.eventSeq !== seq);
    assert.equal(evaluate(noOwner,name).verdict,'NOT_RUN');
  }
});

test('source chrome top contacts use each current Button and normal endpoint after reopening Settings',()=>{
  const context = topProof();
  for (const policy of sourceChromeTopActions) {
    const result = evaluate(context,policy.name,'top');
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.sampleId,policy.sample);
    assert.ok(result.actual.originGeneration >= 9);
    const bounds = context.samples[policy.baseline].nodes.find(node=>node.path === targets[policy.name].path).visibleRectPx;
    const {x,y} = context.actions[policy.action].chromeTap;
    assert.equal(x,bounds.left+Math.floor(bounds.width/2));
    assert.equal(y,bounds.top+1);
    assert.deepEqual(result.actual.nativeInteraction,{
      subject:policy.name,target:policy.target,carrierPath:targets[policy.name].path,bounds,
      visible:true,clipped:false,enabled:true,position:'top',accepted:true,
      actionId:policy.action,baselineSampleId:policy.baseline,dispatch:{x,y,probeSeq:1},
    });
    assert.ok(result.evidenceRefs.some(ref=>ref.path === 'raw/settings-returned.png'));
    assert.ok(result.evidenceRefs.some(ref=>ref.path === `raw/${policy.opened ?? policy.sample}.png`));
    assert.equal(evaluate(context,policy.name).actual.nativeInteraction.position,'center');
  }
});

test('source chrome top contacts reject a clipped edge, center reuse, and the wrong reopened owner',()=>{
  const context = topProof();
  const step = definition.steps.find(item=>item.id === 'tap-header-tools-top');
  const header = context.samples[step.from].nodes.find(node=>node.path === targets['header-tools'].path);
  header.visibleRectPx = {...header.rectPx,top:header.rectPx.top+1,height:header.rectPx.height-1};
  assert.throws(()=>requestedOperation(step,context.samples,definition.fixture),/clipped/u);
  assert.equal(evaluate(context,'header-tools','top').verdict,'NOT_RUN');
  const original = header.rectPx;
  header.rectPx = header.visibleRectPx = {...original,top:original.top+4};
  assert.deepEqual(requestedOperation(step,context.samples,definition.fixture),{op:'click',x:358,y:41});
  assert.equal(evaluate(context,'header-tools','top').verdict,'NOT_RUN');
  header.rectPx = header.visibleRectPx = original;
  assert.throws(()=>requestedOperation({...step,tapEdge:undefined},context.samples,definition.fixture),/position/u);
  assert.throws(()=>requestedOperation(step,context.samples,{id:'unrelated'}),/fixture/u);
  context.actions[step.id].chromeTap.y = targets['header-tools'].point.y;
  assert.equal(evaluate(context,'header-tools','top').verdict,'NOT_RUN');
  context.actions[step.id].chromeTap.y = targets['header-tools'].topY;
  context.events.find(event=>event.eventSeq === 137).payload.previousGeneration = 7;
  assert.equal(evaluate(context,'header-tools','top').verdict,'NOT_RUN');

  const wrongDialog = topProof();
  wrongDialog.samples['footer-add-dialog-top'] = sample('footer-add-dialog-top',220,'source',6);
  delete wrongDialog.actions['back-footer-add-top'];
  const failed = evaluate(wrongDialog,'footer-add','top');
  assert.equal(failed.verdict,'FAIL');
  assert.equal(failed.actual.nativeInteraction,undefined);
});

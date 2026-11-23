import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { evaluateSource } from '../lib/source.mjs';
import {
  sourceControlTouchAssertion,
  sourceControlTouchCases,
  sourceControlTouchPoint,
  sourceControlTouchPolicy,
  sourceControlTouchStep,
  sourceControlTouchWitness,
} from '../lib/source-control-touch.mjs';
import { requestedOperation, sourceRowActionsSample } from '../collectors/harmonyos/records.mjs';
import { actualSourceManagementTypes } from '../../lib/source-management-owner-probe.mjs';
import * as sourceVerification from '../../../entry/src/main/ets/features/source/ui/SourceManagementVerification.ts';

const {
  sourceVerificationRecoveryControl,
  sourceVerificationRowActions,
  sourceVerificationRowLoginControl,
} = sourceVerification;

const owner = {mounting:2,generation:4};
const instanceId = 'source-control-owner';
const ownerRoute = {mounting:owner.mounting,generation:owner.generation,previousGeneration:3};
const readCase = id => JSON.parse(readFileSync(new URL(`../cases/${id}.json`,import.meta.url),'utf8'));
const cases = new Map(sourceControlTouchCases.map(id=>[id,readCase(id)]));
const [rowFixture] = JSON.parse(readFileSync(new URL(
  '../fixtures/source-row-actions/public-source.json',import.meta.url),'utf8'));

const rect = (left,top,width,height) => ({left,top,width,height});
const add = (value,dx,dy) => ({...value,left:value.left+dx,top:value.top+dy});
const sourceNode = (path,parentPath,id,type,box,{alias,source = 'native-tree'} = {}) => ({
  path,parentPath,id,type,rectPx:box,visibleRectPx:{...box},visible:true,opacity:1,
  enabled:true,clickable:type === 'Button',source,alias,
});

function baseWindow(dx = 0,dy = 0) {
  return {id:'81',revision:3,source:'window-metrics',density:2,
    visibleRectPx:rect(dx,dy,800,1600),
    keyboard:{visible:false,revision:3}};
}

function recoverySample(target,branch,{dx = 0,dy = 0} = {}) {
  const content = rect(dx,dy,800,1600);
  const overlay = add(rect(40,200,720,240),dx,dy);
  const host = add(rect(52,212,696,260),dx,dy);
  const button = add(rect(480,330,100,100),dx,dy);
  return {
    sampleId:'recovery-baseline',instanceId,beforeSeq:20,afterSeq:21,captureComplete:true,
    window:baseWindow(dx,dy),evidenceRefs:[
      {path:'raw/recovery-baseline.json'},{path:'raw/recovery-baseline.png'},
    ],
    nodes:[
      sourceNode('0',null,null,'root',content,{source:'native-tree'}),
      sourceNode('0/0','0','reader-source-pending-recovery','Scroll',overlay),
      sourceNode('0/0/0','0/0',`reader-source-${branch}-recovery`,'Stack',host),
      sourceNode('0/0/0/0','0/0/0',target,'Button',button),
    ],
  };
}

function rowSample({dx = 0,dy = 0,nodeId = null} = {}) {
  const content = rect(dx,dy,800,1600);
  const list = add(rect(20,100,760,1400),dx,dy);
  const row = add(rect(40,180,720,240),dx,dy);
  const login = add(rect(560,260,100,100),dx,dy);
  return {
    sampleId:'row-baseline',instanceId,beforeSeq:20,afterSeq:21,captureComplete:true,
    window:baseWindow(dx,dy),evidenceRefs:[
      {path:'raw/row-baseline.json'},{path:'raw/row-baseline.png'},
    ],
    nodes:[
      sourceNode('0',null,null,'root',content),
      sourceNode('0/0','0','reader-source-list','List',list),
      sourceNode('0/0/0','0/0','reader-source-row-7','Column',row),
      sourceNode('0/0/0/0','0/0/0',nodeId,'Button',login,{alias:'reader-source-row-login-control'}),
    ],
  };
}

function sampleFor(contract) {
  const expected = contract.assertions[1].expected;
  return expected.branch === 'row' ? rowSample() : recoverySample(expected.target,expected.branch);
}

function nodeFor(sample,target) {
  return sample.nodes.find(node=>node.id === target || node.alias === target);
}

function contextFor(contract,{sample = sampleFor(contract),events} = {}) {
  const touch = contract.assertions[1];
  const target = contract.assertions[0];
  const step = contract.steps.find(item=>item.id === touch.action);
  const operation = requestedOperation(step,{[touch.baseline]:sample},contract.fixture);
  const witness = sourceControlTouchWitness(step,sample,contract.fixture,operation,17);
  const generation = touch.expected.branch === 'row' ? 0 : 7;
  const projected = touch.expected.branch === 'row' ? {
    owner,state:'rows',readFact:'current',readGeneration:7,count:1,projected:1,firstAnchor:7,
    rowActions:{anchor:7,checkState:'unchecked'},status:'all',category:'all',groupIndex:0,
    queryLength:0,allGroups:true,textProjectionRevision:3,filterRevision:1,
  } : {
    owner,state:'recovery',readFact:'current',readGeneration:7,count:0,projected:0,firstAnchor:0,
    recovery:{branch:touch.expected.branch,generation:7,busy:false,canReconcile:true,canContinue:true},
    status:'all',category:'all',groupIndex:0,queryLength:0,allGroups:true,textProjectionRevision:3,filterRevision:1,
  };
  const app = (eventSeq,kind,payload)=>({eventSeq,kind,payload,channel:'business',instanceId,
    windowRevision:3,evidenceRefs:[{path:`${kind}.${eventSeq}.json`}]});
  const defaultEvents = [
    app(2,'source.route',{action:'open',from:'settings',to:'source',...ownerRoute}),
    app(4,'source.projection',projected),
    app(25,'source.control-action',{phase:'admitted',owner,branch:touch.expected.branch,
      control:touch.expected.control,generation,sequence:1,...(touch.expected.branch === 'row' ?
        {sourceAnchor:7,loginEligible:true,blocked:false,canContinue:false} :
        {blocked:touch.expected.branch === 'original',canContinue:touch.expected.branch === 'original'})}),
  ];
  const action = {actionId:`run:${touch.action}`,instanceId,op:'click',targetId:touch.expected.target,
    beforeSeq:22,afterSeq:30,from:touch.baseline,outcomeSettled:true,...witness};
  return {
    samples:{[touch.baseline]:sample},
    actions:{'open-sources':{instanceId,op:'click',targetId:'reader-settings-source-management',
      beforeSeq:1,afterSeq:3,evidenceRefs:[{path:'open.json'}]},[touch.action]:action},
    events:events ?? defaultEvents,
    target,
    touch,
    operation,
  };
}

function assessContext(contract,context) {
  const target = evaluateSource({...context.target,acceptedSources:context.target.sources},context);
  const targetCondition = conditionApplicability(context.target,context,target,contract);
  const touch = evaluateSource({...context.touch,acceptedSources:context.touch.sources},context);
  const condition = conditionApplicability(context.touch,context,touch,contract,undefined,
    {[context.target.id]:targetCondition});
  return {context,target,targetCondition,touch,condition};
}

function assess(contract,options = {}) {
  return assessContext(contract,contextFor(contract,options));
}

test('Source control cases keep one exact center or top dispatch and never synthesize a post-click sample',()=>{
  assert.deepEqual(sourceControlTouchCases,[
    'source-management.original-reconcile-touch-center',
    'source-management.original-reconcile-touch-edge',
    'source-management.original-continue-touch-center',
    'source-management.original-continue-touch-edge',
    'source-management.unknown-reconcile-touch-center',
    'source-management.unknown-reconcile-touch-edge',
    'source-management.row-login-touch-center',
    'source-management.row-login-touch-edge',
  ]);
  for (const [id,contract] of cases) {
    const touch = contract.assertions[1];
    const target = contract.assertions[0];
    assert.equal(sourceControlTouchAssertion(contract,touch)?.position,touch.expected.position,id);
    assert.equal(contract.steps.at(-1).id,touch.action,id);
    assert.equal(contract.steps.filter(step=>sourceControlTouchStep(step,contract.fixture)).length,1,id);
    assert.equal(contract.assertions.length,2,id);
    assert.equal(touch.sample,touch.baseline,id);
    assert.equal(touch.expected.conditionAssertion,target.id,id);
    const sample = sampleFor(contract);
    const point = sourceControlTouchPoint(sample,sourceControlTouchPolicy(touch.expected));
    const box = nodeFor(sample,touch.expected.target).visibleRectPx;
    assert.deepEqual(point,{
      x:box.left+Math.floor(box.width/2),
      y:touch.expected.position === 'top' ? box.top+1 : box.top+Math.floor(box.height/2),
    },id);
    const operation = requestedOperation(contract.steps.at(-1),{[touch.baseline]:sample},contract.fixture);
    assert.deepEqual(operation,{op:'click',...point},id);
    assert.equal('edgeTap' in operation,false,id);
    const witness = sourceControlTouchWitness(contract.steps.at(-1),sample,contract.fixture,operation,23);
    assert.deepEqual(Object.keys(witness),['sourceControlTap'],id);
    assert.deepEqual(witness.sourceControlTap,{x:point.x,y:point.y,position:touch.expected.position,probeSeq:23});
    assert.throws(()=>sourceControlTouchWitness(contract.steps.at(-1),sample,contract.fixture,
      {...operation,x:operation.x+1},23),/exact Source control tap/u);
    assert.throws(()=>sourceControlTouchWitness(contract.steps.at(-1),sample,contract.fixture,operation,0),
      /exact Source control tap/u);
  }
  const collector = readFileSync(new URL('../collectors/harmonyos/records.mjs',import.meta.url),'utf8');
  assert.match(collector,/const sourceControl = sourceControlTouchStep\(step,contract\.fixture\)/u);
  assert.match(collector,/sourceControlTouchWitness\(step,target,contract\.fixture,operation,dispatch\.seq\)/u);
  assert.match(collector,/step\.tapEdge === undefined \|\| chrome \|\| sourceControl \? \{\}/u);
});

test('Source control owner admission binds the exact native point, branch, control, owner and generation',()=>{
  for (const [id,contract] of cases) {
    const {target,touch,condition} = assess(contract);
    assert.equal(target.verdict,'PASS',`${id}: ${target.reason}`);
    assert.equal(touch.verdict,'PASS',`${id}: ${touch.reason}`);
    assert.equal(condition.status,'APPLIES',id);
    assert.equal(touch.actual.applicability,'APPLIES',id);
    assert.equal(touch.actual.nativeInteraction.position,touch.expected.position,id);
    assert.equal(touch.actual.dispatch.position,touch.expected.position,id);
  }
});

test('Source control evidence rejects static, stale, foreign and duplicated probes without rewriting the condition',()=>{
  const contract = cases.get('source-management.original-continue-touch-center');
  const {context,touch,condition} = assess(contract);
  assert.equal(touch.verdict,'PASS');
  assert.equal(condition.status,'APPLIES');
  const boot = assess(contract,{events:context.events.filter(event=>event.kind !== 'source.control-action')});
  assert.equal(boot.touch.verdict,'NOT_RUN');
  assert.equal(boot.condition.status,'APPLIES');
  assert.equal(boot.condition.sampleApplies,false);
  for (const [change,verdict] of [
    [ctx=>{ctx.events.find(event=>event.kind === 'source.control-action').payload.branch = 'unknown';},'FAIL'],
    [ctx=>{ctx.events.find(event=>event.kind === 'source.control-action').payload.control = 'reconcile';},'FAIL'],
    [ctx=>{ctx.events.find(event=>event.kind === 'source.control-action').payload.generation = 6;},'FAIL'],
    [ctx=>{ctx.events.find(event=>event.kind === 'source.control-action').payload.owner =
      {mounting:2,generation:5};},'FAIL'],
    [ctx=>{ctx.events.find(event=>event.kind === 'source.control-action').payload.sequence = 0;},'FAIL'],
    [ctx=>{ctx.events.push({...ctx.events.find(event=>event.kind === 'source.control-action'),eventSeq:26,
      evidenceRefs:[{path:'duplicate.json'}]});},'FAIL'],
    [ctx=>{ctx.actions['continue-original-center'].targetId = 'reader-source-original-reconcile';},'NOT_RUN'],
    [ctx=>{ctx.actions['continue-original-center'].from = 'other';},'NOT_RUN'],
    [ctx=>{ctx.actions['continue-original-center'].sourceControlTap.x += 1;},'NOT_RUN'],
    [ctx=>{delete ctx.actions['continue-original-center'].sourceControlTap;},'NOT_RUN'],
    [ctx=>{ctx.actions['continue-original-center'].afterSeq = ctx.actions['continue-original-center'].beforeSeq;},'NOT_RUN'],
  ]) {
    const copy = structuredClone(context);
    change(copy);
    const result = evaluateSource({...copy.touch,acceptedSources:copy.touch.sources},copy);
    assert.equal(result.verdict,verdict,result.reason);
  }
  const translatedContract = cases.get('source-management.original-continue-touch-edge');
  const translatedSample = recoverySample('reader-source-original-continue','original',{dx:40,dy:30});
  const translated = assess(translatedContract,{sample:translatedSample});
  assert.equal(translated.touch.verdict,'PASS',translated.touch.reason);
});

test('Source control conditions distinguish unknown, inapplicable and applicable-but-undispatched states',()=>{
  const contract = cases.get('source-management.original-reconcile-touch-center');
  assert.equal(assess(contract,{events:[]}).condition.status,'UNKNOWN');
  const absentSample = recoverySample('reader-source-original-reconcile','original');
  absentSample.nodes = absentSample.nodes.filter(node=>node.id !== 'reader-source-original-reconcile');
  const inapplicableContext = contextFor(contract,{events:[
    {eventSeq:2,kind:'source.route',payload:{action:'open',from:'settings',to:'source',...ownerRoute},
      channel:'business',instanceId,windowRevision:3,evidenceRefs:[{path:'route.json'}]},
    {eventSeq:4,kind:'source.projection',payload:{owner,state:'rows',readFact:'current',readGeneration:7,
      count:1,projected:1,firstAnchor:1,status:'all',category:'all',groupIndex:0,queryLength:0,allGroups:true,
      textProjectionRevision:3,filterRevision:1},channel:'business',instanceId,windowRevision:3,
      evidenceRefs:[{path:'rows.json'}]},
  ]});
  inapplicableContext.samples[inapplicableContext.touch.baseline] = absentSample;
  const inapplicable = assessContext(contract,inapplicableContext);
  assert.notEqual(inapplicable.condition.status,'UNKNOWN');
  assert.equal(inapplicable.condition.status,'DOES_NOT_APPLY');
});

test('Source Login accepts stable aliases across legal native id and geometry changes but rejects a visible IME',()=>{
  const contract = cases.get('source-management.row-login-touch-center');
  for (const sample of [
    rowSample({nodeId:null}),
    rowSample({nodeId:'native-login-id-changed',dx:18,dy:12}),
  ]) {
    const {touch} = assess(contract,{sample});
    assert.equal(touch.verdict,'PASS',touch.reason);
  }
  const keyboard = rowSample();
  keyboard.window.keyboard.visible = true;
  const context = contextFor(contract);
  context.samples[context.touch.baseline] = keyboard;
  const result = evaluateSource({...context.touch,acceptedSources:context.touch.sources},context);
  assert.equal(result.verdict,'NOT_RUN');
});

test('Source Login requests native aliases at its exact row baseline in both touch cases',()=>{
  for (const id of ['source-management.row-action-targets','source-management.row-login-touch-center',
    'source-management.row-login-touch-edge']) {
    const contract = readCase(id);
    const sample = contract.steps.find(step=>step.kind === 'sample');
    assert.ok(sourceRowActionsSample(id,contract.fixture,sample),id);
    assert.equal(sourceRowActionsSample(id,contract.fixture,{...sample,id:'foreign-sample'}),false);
    assert.equal(sourceRowActionsSample(id,contract.fixture,{...sample,anchors:[]}),false);
    assert.equal(sourceRowActionsSample('source-management.layout-filter',contract.fixture,sample),false);
    assert.equal(sourceRowActionsSample(id,{...contract.fixture,id:'other-fixture'},sample),false);
  }
});

test('Source recovery owner admission requires one exact original or unknown receipt generation',()=>{
  const original = {blocked:true,generation:7,operationId:'operation-7',canRetryOriginal:true,busy:false};
  const unknown = {confirmation:'unknown',generation:8,canRetry:true};
  assert.deepEqual(sourceVerificationRecoveryControl('reconcile',7,original,undefined),
    {branch:'original',control:'reconcile',generation:7,blocked:true,canContinue:true});
  assert.deepEqual(sourceVerificationRecoveryControl('continue',7,original,undefined),
    {branch:'original',control:'continue',generation:7,blocked:true,canContinue:true});
  assert.deepEqual(sourceVerificationRecoveryControl('reconcile',8,undefined,unknown),
    {branch:'unknown',control:'reconcile',generation:8,blocked:false,canContinue:false});
  for (const [control,generation,nextOriginal,nextUnknown] of [
    ['reconcile',6,original,undefined],
    ['continue',7,{...original,canRetryOriginal:false},undefined],
    ['reconcile',7,{...original,busy:true},undefined],
    ['reconcile',7,{...original,operationId:''},undefined],
    ['reconcile',7,undefined,{...unknown,canRetry:false}],
    ['reconcile',7,undefined,{...unknown,confirmation:'confirmed'}],
    ['continue',8,undefined,unknown],
  ]) assert.equal(sourceVerificationRecoveryControl(control,generation,nextOriginal,nextUnknown),undefined);
});

function sourceForRow() {
  return {
    sourceId:rowFixture.bookSourceUrl,
    sourceVersion:'a'.repeat(64),
    name:rowFixture.bookSourceName,
    baseUrl:rowFixture.bookSourceUrl,
    enabled:false,
    enabledExplore:false,
    group:rowFixture.bookSourceGroup,
    category:'novel',
    loginUrl:rowFixture.loginUrl,
    checkState:'unchecked',
  };
}

function ownerRuntime(enabled,events) {
  const runtime = {
    openSourceLogin:async()=>{events.push({kind:'open-source-login'});},
  };
  const {SourceOrchestrator} = actualSourceManagementTypes({
    ...sourceVerification,
    ReaderRuntimeOwner:{isCurrent:tester=>tester === runtime},
    ReaderUIVerificationProbe:{enabled:()=>enabled,emit:(kind,channel,payload)=>events.push({kind,channel,payload})},
    hilog:{info(){},warn(){},error(){}},
  });
  const orchestrator = SourceOrchestrator.forRuntime(runtime);
  const identity = JSON.stringify([0,owner.mounting,owner.generation,'source']);
  Object.assign(orchestrator,{presentationIdentity:identity,session:1,isCurrent:()=>true,operationChain:Promise.resolve()});
  return {runtime,orchestrator};
}

test('Actual Source owner emits one read-only admission on each normal recovery and Login path',async()=>{
  const events = [];
  const {runtime,orchestrator} = ownerRuntime(true,events);
  const operations = [];
  const original = {blocked:true,generation:7,operationId:'operation-7',canRetryOriginal:true,busy:false};
  orchestrator.gateway.originalMutationSnapshot = ()=>original;
  orchestrator.gateway.recoverOriginalSource = async()=>{operations.push('recover');};
  orchestrator.loadList = async()=>{operations.push('load');};
  orchestrator.latestProjection = {action:'load',sourceId:'',original};
  orchestrator.reconcile(7);
  await orchestrator.operationChain;
  orchestrator.operationChain = Promise.resolve();
  orchestrator.latestProjection = {action:'load',sourceId:'',original};
  orchestrator.continueOriginal(7);
  await orchestrator.operationChain;
  assert.deepEqual(operations,['recover','load','recover','load']);
  const admitted = events.filter(event=>event.kind === 'source.control-action').map(event=>event.payload);
  assert.deepEqual(admitted.map(event=>[event.branch,event.control,event.generation,event.owner.mounting,event.owner.generation]),[
    ['original','reconcile',7,owner.mounting,owner.generation],
    ['original','continue',7,owner.mounting,owner.generation],
  ]);
  assert(admitted.every(event=>event.phase === 'admitted' && event.sequence > 0));

  const beforeDisabled = operations.slice();
  const disabled = ownerRuntime(false,events);
  disabled.orchestrator.gateway.originalMutationSnapshot = ()=>original;
  disabled.orchestrator.gateway.recoverOriginalSource = async()=>{operations.push('recover-disabled');};
  disabled.orchestrator.loadList = async()=>{operations.push('load-disabled');};
  disabled.orchestrator.latestProjection = {action:'load',sourceId:'',original};
  disabled.orchestrator.reconcile(7);
  await disabled.orchestrator.operationChain;
  assert.equal(events.filter(event=>event.kind === 'source.control-action').length,2);
  assert.deepEqual(operations.slice(beforeDisabled.length),['recover-disabled','load-disabled']);

  const unknownEvents = [];
  const unknownOwner = ownerRuntime(true,unknownEvents);
  const unknownReceipt = {
    action:'toggle',sourceId:'fixture',
    receipt:{confirmation:'unknown',message:''},
    facts:{generation:8,canRetry:true,fact:'pendingReconciliation'},
  };
  Object.assign(unknownOwner.orchestrator,{latestProjection:{action:'toggle',sourceId:'fixture',receipt:unknownReceipt}});
  unknownOwner.orchestrator.gateway.originalMutationSnapshot = ()=>undefined;
  unknownOwner.orchestrator.loadList = async()=>{};
  unknownOwner.orchestrator.reconcile(8);
  await unknownOwner.orchestrator.operationChain;
  const unknownAdmission = unknownEvents.find(event=>event.kind === 'source.control-action')?.payload;
  assert.equal(unknownAdmission.branch,'unknown');
  assert.equal(unknownAdmission.control,'reconcile');
  assert.equal(unknownAdmission.generation,8);

  const loginEvents = [];
  const login = ownerRuntime(true,loginEvents);
  const source = sourceForRow();
  const order = [];
  Object.assign(login.orchestrator,{
    sources:[source],
    latestProjection:{action:'load',sourceId:'',},
    setCheckProjection:()=>{},
    validateSourceCheck:async()=>({identity:'row-definition'}),
    applySourceCheckOutcome:()=>{order.push('apply');},
  });
  login.orchestrator.gateway.originalMutationSnapshot = ()=>undefined;
  login.orchestrator.gateway.checkSource = async()=>{order.push('check');return {};};
  login.runtime.openSourceLogin = async()=>{order.push('open');};
  const originalEmit = loginEvents;
  loginEvents.push = function(value) {
    if (value.kind === 'source.control-action') order.push('event');
    return Array.prototype.push.call(this,value);
  };
  const rowActions = sourceVerificationRowActions(source);
  const loginControl = sourceVerificationRowLoginControl(source,source.loginUrl,false,undefined);
  assert.equal(loginControl.sourceAnchor,rowActions.anchor);
  login.orchestrator.loginSource(source.sourceId,source.loginUrl);
  await login.orchestrator.operationChain;
  assert.deepEqual(order,['event','open','check','apply']);
  const loginAdmission = originalEmit.find(event=>event.kind === 'source.control-action')?.payload;
  assert.equal(loginAdmission.branch,'row');
  assert.equal(loginAdmission.control,'login');
  assert.equal(loginAdmission.generation,0);
  assert.equal(loginAdmission.sourceAnchor,rowActions.anchor);
  assert.equal(loginAdmission.loginEligible,true);
  assert.equal(JSON.stringify(loginAdmission).includes(source.loginUrl),false);
  assert.equal(JSON.stringify(loginAdmission).includes(source.name),false);

  const disabledLogin = ownerRuntime(false,[]);
  const disabledSource = sourceForRow();
  const disabledOrder = [];
  Object.assign(disabledLogin.orchestrator,{
    sources:[disabledSource],
    latestProjection:{action:'load',sourceId:'',},
    setCheckProjection:()=>{},
    validateSourceCheck:async()=>({identity:'row-definition'}),
    applySourceCheckOutcome:()=>{disabledOrder.push('apply');},
  });
  disabledLogin.orchestrator.gateway.originalMutationSnapshot = ()=>undefined;
  disabledLogin.orchestrator.gateway.checkSource = async()=>{disabledOrder.push('check');return {};};
  disabledLogin.runtime.openSourceLogin = async()=>{disabledOrder.push('open');};
  disabledLogin.orchestrator.loginSource(disabledSource.sourceId,disabledSource.loginUrl);
  await disabledLogin.orchestrator.operationChain;
  assert.deepEqual(disabledOrder,['open','check','apply']);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evaluateSourceRetainedReadFailure, sourceRetainedReadCondition } from '../lib/source-retained-read.mjs';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { evaluateSource } from '../lib/source.mjs';
import { sourceReadRetryTouchAssertion } from '../lib/source-read-retry-touch.mjs';
import { requestedOperation, requireActionDispatch } from '../collectors/harmonyos/records.mjs';

const contract = JSON.parse(readFileSync(new URL('../cases/source-management.retained-read-failure.json', import.meta.url), 'utf8'));
const [assertion] = contract.assertions;
const instanceId = 'one-normal-source-instance';
const reference = path => ({path,bytes:100,sha256:'a'.repeat(64)});
const journal = reference('session/commands.jsonl');
const priorOwner = {mounting:2,generation:17};
const currentOwner = {mounting:2,generation:19};
const ready = {
  owner:priorOwner, state:'rows', readFact:'current', readGeneration:12,
  count:18, projected:18, firstAnchor:7, queryLength:0, status:'all', category:'all', allGroups:true, groupIndex:0,
};
const retainedFailure = {...ready,owner:currentOwner,readFact:'refreshFailed',readGeneration:14};
const event = (eventSeq, kind, payload) => ({instanceId,eventSeq,kind,payload,channel:'business',evidenceRefs:[journal]});
const route = (eventSeq,action,from,to,owner,previousGeneration) =>
  event(eventSeq,'source.route',{action,from,to,...owner,previousGeneration});
const open = (beforeSeq,afterSeq,from) => ({
  instanceId,op:'click',targetId:'reader-settings-source-management',from,beforeSeq,afterSeq,outcomeSettled:true,evidenceRefs:[journal],
});
const row = anchor => ({id:`reader-source-row-${anchor}`,visible:true,opacity:1,visibleRectPx:{width:200,height:40}});
const sample = (sampleId,beforeSeq,afterSeq) => ({
  sampleId, beforeSeq, afterSeq, instanceId, captureComplete:true, window:{keyboard:{visible:false}},
  nodes:[row(ready.firstAnchor)], evidenceRefs:[reference(`raw/${sampleId}.png`),reference(`raw/${sampleId}.json`)],
});

function contextFor(reopened = retainedFailure) {
  const failedSample = sample('retained-failure',39,42);
  const viewport = {left:0,top:0,width:360,height:800};
  const filter = {left:8,top:12,width:344,height:144};
  const button = {left:12,top:70,width:100,height:44};
  const append = (id,parentPath,type,rectPx) => failedSample.nodes.push({
    id,path:id,parentPath,type,rectPx,visibleRectPx:rectPx,visible:true,opacity:1,
    enabled:true,clickable:type === 'Button',source:'native-tree',
  });
  Object.assign(failedSample.window,{source:'window-metrics',density:1,visibleRectPx:viewport});
  append('reader-source-list',null,'List',viewport);
  append('reader-source-filter-block','reader-source-list','Column',filter);
  append('reader-source-retained-read-retry','reader-source-filter-block','Button',button);
  return {
    actions:{
      'open-sources':open(10,14,'settings'),
      'return-settings':{instanceId,op:'keyEvent',key:'Back',from:'retained-before',beforeSeq:22,afterSeq:25,
        outcomeSettled:true,evidenceRefs:[journal]},
      'reopen-sources':open(30,35,'settings-return'),
    },
    samples:{
      'retained-before':sample('retained-before',18,20),
      'retained-failure':failedSample,
    },
    events:[
      route(12,'open','settings','source',priorOwner,16),
      event(16,'source.projection',ready),
      route(23,'close','source','settings',{mounting:2,generation:18},17),
      route(32,'open','settings','source',currentOwner,18),
      event(36,'source.projection',reopened),
    ],
    problems:[],
  };
}

test('source retained read failure binds the fresh read and the exact prior native first row', () => {
  const context = contextFor();
  const result = evaluateSourceRetainedReadFailure(assertion,context);
  assert.equal(result.verdict,'PASS');
  assert.equal(result.actual.prior.firstAnchor,7);
  assert.equal(result.actual.current.firstAnchor,7);
  assert.equal(result.actual.current.generation,14);
  assert.ok(result.evidenceRefs.some(ref => ref.path === 'raw/retained-before.png'));
  assert.ok(result.evidenceRefs.some(ref => ref.path === 'raw/retained-failure.json'));
  assert.ok(result.evidenceRefs.some(ref => ref.path === journal.path));
  assert.deepEqual(sourceRetainedReadCondition(assertion,context), {
    status:'APPLIES',required:true,sampleApplies:true,
    reason:'The new source opening completed a failed read after a populated read',
  });
  for (const bad of [
    {firstAnchor:8},
    {projected:17},
    {count:20,projected:20},
    {state:'readFailure',readFact:'failed',count:0,projected:0,firstAnchor:0},
  ]) {
    const broken = contextFor({...retainedFailure,...bad});
    assert.equal(sourceRetainedReadCondition(assertion,broken).status,'APPLIES');
    assert.equal(evaluateSourceRetainedReadFailure(assertion,broken).verdict,'FAIL');
  }
  context.samples['retained-failure'].nodes = [row(8)];
  assert.equal(evaluateSourceRetainedReadFailure(assertion,context).verdict,'FAIL');
  context.samples['retained-failure'].nodes = [row(7),row(7)];
  assert.equal(evaluateSourceRetainedReadFailure(assertion,context).verdict,'NOT_RUN');
});

test('source retained read failure measures the refresh control only on the eligible retained opening', () => {
  assert.equal(assertion.expected.requireNativeTouchTarget,true);
  const context = contextFor();
  const healthy = evaluateSourceRetainedReadFailure(assertion,context);
  assert.equal(healthy.verdict,'PASS');
  assert.equal(healthy.actual.nativeTouchTarget.heightVp,44);
  const target = context.samples['retained-failure'].nodes.at(-1);
  target.visibleRectPx = {...target.rectPx,height:40};
  const clipped = evaluateSourceRetainedReadFailure(assertion,context);
  assert.equal(clipped.verdict,'FAIL');
  assert.equal(clipped.actual.current.previousFirstRowVisible,true);
  const legacy = {...assertion,expected:{readFact:assertion.expected.readFact}};
  assert.equal(evaluateSourceRetainedReadFailure(legacy,context).verdict,'PASS');
  context.samples['retained-failure'].nodes.pop();
  assert.equal(evaluateSourceRetainedReadFailure(assertion,context).verdict,'NOT_RUN');
  const successful = contextFor({...retainedFailure,readFact:'current'});
  successful.samples['retained-failure'].nodes.at(-1).enabled = false;
  assert.equal(sourceRetainedReadCondition(assertion,successful).status,'DOES_NOT_APPLY');
  assert.equal(evaluateSourceRetainedReadFailure(assertion,successful).verdict,'NOT_RUN');
});

test('source retained read failure rejects an obsolete projection or broken reopening route', () => {
  const stale = [
    contextFor({...retainedFailure,readGeneration:12}),
    contextFor({...retainedFailure,owner:priorOwner}),
    contextFor({...retainedFailure,owner:{...currentOwner,mounting:1}}),
  ];
  const wrongReturn = contextFor();
  wrongReturn.events[2] = route(23,'close','source','settings',{mounting:2,generation:18},16);
  const reopenedFromWrongGeneration = contextFor();
  reopenedFromWrongGeneration.events[3] = route(32,'open','settings','source',currentOwner,17);
  const wrongKey = contextFor();
  wrongKey.actions['return-settings'].key = 'Enter';
  for (const context of [...stale,wrongReturn,reopenedFromWrongGeneration,wrongKey]) {
    assert.equal(sourceRetainedReadCondition(assertion,context).status,'UNKNOWN');
    assert.equal(evaluateSourceRetainedReadFailure(assertion,context).verdict,'NOT_RUN');
  }
});

test('source retained read failure separates confirmed absence from a failure lost before capture', () => {
  const successful = {...retainedFailure,readFact:'current'};
  const absence = contextFor(successful);
  assert.equal(sourceRetainedReadCondition(assertion,absence).status,'DOES_NOT_APPLY');
  assert.equal(evaluateSourceRetainedReadFailure(assertion,absence).verdict,'NOT_RUN');
  absence.samples['retained-before'].nodes = [row(8)];
  assert.equal(sourceRetainedReadCondition(assertion,absence).status,'UNKNOWN');

  const badSuccess = contextFor({...successful,state:'readFailure'});
  assert.equal(sourceRetainedReadCondition(assertion,badSuccess).status,'UNKNOWN');
  const oldSuccess = contextFor({...successful,readGeneration:12});
  assert.equal(sourceRetainedReadCondition(assertion,oldSuccess).status,'UNKNOWN');

  const transient = contextFor();
  transient.events.push(event(37,'source.projection',{...successful,readGeneration:16}));
  const applicability = sourceRetainedReadCondition(assertion,transient);
  assert.equal(applicability.status,'APPLIES');
  assert.equal(applicability.sampleApplies,false);
  assert.equal(evaluateSourceRetainedReadFailure(assertion,transient).verdict,'NOT_RUN');

  const noNativeCapture = contextFor();
  noNativeCapture.samples['retained-failure'].captureComplete = false;
  const incomplete = sourceRetainedReadCondition(assertion,noNativeCapture);
  assert.equal(incomplete.status,'APPLIES');
  assert.equal(incomplete.sampleApplies,false);
});

test('source retained refresh positions require an independent reopened failure and exact new retry generation', () => {
  const target = 'reader-source-retained-read-retry';
  for (const [suffix,position,y] of [['center','center',92],['edge','top',71]]) {
    const definition = JSON.parse(readFileSync(new URL(`../cases/source-management.retained-read-retry-${suffix}.json`,import.meta.url)));
    const [base,retry] = definition.assertions;
    const tap = definition.steps.find(step=>step.id === retry.action);
    assert.deepEqual(sourceReadRetryTouchAssertion(definition,retry),{subject:'read-refresh',target,position});
    const malformed = {...definition,steps:definition.steps.map(step=>step === tap ? {...step,beforeEvent:[]} : step)};
    assert.equal(sourceReadRetryTouchAssertion(malformed,retry),undefined);
    const context = contextFor();
    const failure = context.samples[retry.baseline];
    Object.assign(failure.window,{id:'window',revision:1});
    const terminal = {...sample(retry.sample,50,51),window:{...failure.window}};
    const rowAtEnd = terminal.nodes[0];
    rowAtEnd.path = '0/0';
    rowAtEnd.parentPath = '0';
    const listAtEnd = {...failure.nodes.find(node=>node.id === 'reader-source-list'),path:'0'};
    terminal.nodes.push(listAtEnd);
    context.samples[retry.sample] = terminal;
    const op = requestedOperation(tap,context.samples,definition.fixture);
    assert.deepEqual(op,{op:'click',x:62,y});
    const recorded = requireActionDispatch([{event:'command',ok:true,seq:1,
      args:['shell','uitest','uiInput','click','62',String(y)]}],1,op);
    const command = {instanceId,op:'click',targetId:target,from:retry.baseline,beforeSeq:44,afterSeq:46,
      sourceReadRetryTap:{x:op.x,y:op.y,probeSeq:recorded.seq},evidenceRefs:[journal]};
    context.actions[retry.action] = command;
    const start = event(45,'source.read-retry',{phase:'started',failedReadGeneration:14,startedReadGeneration:15,
      readGeneration:15,readFact:'refreshing',count:18});
    const done = event(48,'source.read-retry',{...start.payload,phase:'settled',readGeneration:16,readFact:'current'});
    const settled = event(49,'source.projection',{...ready,owner:currentOwner,readGeneration:16});
    context.events.push(start,done,settled);
    const evaluate = () => evaluateSource({...retry,acceptedSources:retry.sources},context);
    const condition = (baseline=sourceRetainedReadCondition(base,context)) =>
      conditionApplicability(retry,context,evaluate(),definition,undefined,{[base.id]:baseline});
    const result = evaluate();
    assert.equal(result.verdict,'PASS',result.reason);
    assert.deepEqual(result.actual.nativeInteraction,{
      subject:'read-refresh',target,position,bounds:{left:12,top:70,width:100,height:44},
      carrierPath:target,visible:true,clipped:false,enabled:true,accepted:true,actionId:retry.action,
      baselineSampleId:retry.baseline,dispatch:command.sourceReadRetryTap,
    });
    assert.equal(result.actual.sampleId,retry.sample);
    assert.equal(condition().sampleApplies,true);
    const previous = context.samples[base.baseline].nodes[0];
    previous.id = 'reader-source-row-8';
    assert.equal(evaluateSourceRetainedReadFailure(base,context).verdict,'FAIL');
    assert.equal(evaluate().verdict,'NOT_RUN');
    assert.equal(condition().status,'APPLIES','Missing prior row does not turn a real failure into an exclusion');
    assert.equal(condition().sampleApplies,false);
    previous.id = 'reader-source-row-7';
    command.sourceReadRetryTap.y++;
    assert.equal(evaluate().verdict,'NOT_RUN');
    assert.equal(condition().sampleApplies,false);
    command.sourceReadRetryTap.y--;
    done.payload.startedReadGeneration++;
    assert.equal(evaluate().verdict,'NOT_RUN');
    done.payload.startedReadGeneration--;
    settled.payload.owner = priorOwner;
    assert.equal(evaluate().verdict,'NOT_RUN');
    settled.payload.owner = currentOwner;
    done.payload.readFact = 'refreshFailed';
    settled.payload.readFact = 'refreshFailed';
    assert.equal(evaluate().verdict,'FAIL','A repeated failure still must render its own refresh control');
    terminal.nodes.push({...failure.nodes.find(node=>node.id === target)});
    assert.equal(evaluate().verdict,'FAIL','A refresh Button must remain inside the actual retained filter surface');
    terminal.nodes.push({...failure.nodes.find(node=>node.id === 'reader-source-filter-block'),parentPath:listAtEnd.path});
    assert.equal(evaluate().verdict,'PASS','An actual repeated read failure can still prove the control accepted the input');
    settled.payload.count--;
    assert.equal(evaluate().verdict,'FAIL','Repeated failure must retain the original rows');
    const absent = sourceRetainedReadCondition(base,contextFor({...retainedFailure,readFact:'current'}));
    assert.equal(condition(absent).status,'DOES_NOT_APPLY');
    assert.equal(conditionApplicability(retry,context,result,definition).status,'UNKNOWN');
  }
});

const measureWindow = {left:0,top:0,width:366,height:809};
const textBox = {left:30,top:200,width:125,height:26};
const glyphs = {
  'read-empty': ['read/empty-title','read/empty-message','footer/add'],
  'read-failed': ['read/failure-title','read/failure-message','read/retry'],
  'retained-read-failed': ['read/retained-retry'],
};
const nativeNode = (id,path,type,rectPx=textBox,parentPath=null)=>({
  id,path,type,parentPath,rectPx,visibleRectPx:rectPx,visible:true,opacity:1,source:'native-tree',
});

function glyphSample(sample, projection, scope, eventSeq) {
  Object.assign(sample.window,{
    revision:5,rectPx:measureWindow,visibleRectPx:measureWindow,density:1,source:'window-metrics',fontScale:1.3,
    keyboard:{visible:false,revision:5},nativeFont:{followsSystemFontScale:true,fpPixels:1.3,vpPixels:1,effectiveScale:1.3,maxFontScale:2},
  });
  const labels = glyphs[scope].map((role,idx)=>{
    const length = [4,12,4][idx];
    return {role,utf16Length:length,startUtf16:0,endUtf16:length,complete:true,
      lines:[{start:0,end:length,leftPx:1,topPx:2,widthPx:43,heightPx:20,baselinePx:17}],
      rangeRects:[{leftPx:1,topPx:2,rightPx:44,bottomPx:22}],
      tailRects:[{leftPx:36,topPx:2,rightPx:44,bottomPx:22}]};
  });
  return {...event(eventSeq,'source.surface-text-layout',{
    scope,owner:projection.owner,readGeneration:projection.readGeneration,filterRevision:projection.filterRevision,
    textProjectionRevision:projection.textProjectionRevision,windowRevision:5,widthVp:366,heightVp:809,density:1,
    systemFontScale:1.3,fontScale:1.3,labels,
  }),windowRevision:5};
}

function coldContext(scope) {
  const empty = scope === 'read-empty';
  const definition = JSON.parse(readFileSync(new URL(`../cases/source-management.${empty ? 'empty-library' : 'read-failure'}.json`,import.meta.url)));
  const assertion = definition.assertions.find(item=>item.kind === 'surface-text');
  const current = sample(assertion.sample,21,23);
  current.nodes = [
    nativeNode('reader-source-empty-state','0/0','ListItem',measureWindow),
    nativeNode('reader-source-text-read-title','0/0/0','Text'),
    nativeNode('reader-source-text-read-message','0/0/1','Text'),
    ...(empty ? [
      nativeNode('reader-source-footer','0/1','Column'),
      nativeNode('reader-source-text-footer-add','0/1/0','Button'),
      nativeNode(null,'0/1/0/0','Text'),
    ] : [
      nativeNode('reader-source-read-retry','0/0/2','Button'),
      nativeNode(null,'0/0/2/0','Text'),
    ]),
  ];
  const projection = {...ready,state:empty ? 'empty' : 'readFailure',readFact:empty ? 'current' : 'failed',
    count:0,projected:0,firstAnchor:0,filterRevision:3,textProjectionRevision:4};
  const text = glyphSample(current,projection,scope,19);
  const context = {actions:{'open-sources':open(10,14,'settings')},samples:{[assertion.sample]:current},events:[
    route(12,'open','settings','source',priorOwner,16),event(16,'source.projection',projection),text,
  ]};
  const evaluate = ()=>evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  return {definition,assertion,current,projection,text,context,evaluate};
}

test('source read surface glyphs bind empty library and footer ranges to one current native window', ()=>{
  const {current,text,evaluate} = coldContext('read-empty');
  const proof = evaluate();
  assert.equal(proof.verdict,'PASS',proof.reason);
  assert.equal(proof.actual.textScope,'read-empty');
  assert.equal(proof.actual.sampleId,'source-ready');
  assert.deepEqual(Object.keys(proof.actual.roles),glyphs['read-empty']);
  const last = current.nodes.at(-1);
  last.visibleRectPx = {...last.rectPx,width:35};
  assert.equal(evaluate().verdict,'FAIL');
  assert.match(evaluate().reason,/footer\/add.*clipped/u);
  text.payload.textProjectionRevision -= 1;
  assert.equal(evaluate().verdict,'NOT_RUN');
});

test('source read surface glyphs keep a real cold read failure required when text is missing', ()=>{
  const state = coldContext('read-failed');
  const {definition,assertion,current,text,context,evaluate} = state;
  const conditionSource = definition.assertions.find(item=>item.id === assertion.expected.conditionAssertion);
  assert.equal(conditionSource.kind,'read-surface');
  assert.equal(conditionSource.sample,assertion.sample);
  assert.equal(conditionSource.action,assertion.action);
  const condition = ()=>{
    const independent = conditionApplicability(conditionSource,context,undefined,definition);
    const inherited = conditionApplicability(assertion,context,evaluate(),definition,undefined,{[conditionSource.id]:independent});
    assert.deepEqual(inherited,independent);
    return inherited;
  };
  assert.equal(conditionApplicability(assertion,context,evaluate(),definition).status,'UNKNOWN');
  assert.equal(evaluate().verdict,'PASS');
  assert.equal(condition().status,'APPLIES');
  assert.ok(condition().sampleApplies);
  context.events.pop();
  assert.equal(evaluate().verdict,'NOT_RUN');
  assert.equal(condition().status,'APPLIES');
  context.events.push(text);
  current.nodes.splice(current.nodes.findIndex(node=>node.id === 'reader-source-text-read-message'),1);
  assert.equal(evaluate().verdict,'FAIL');
  delete context.samples[assertion.sample];
  assert.equal(evaluate().verdict,'NOT_RUN');
  assert.equal(condition().status,'UNKNOWN');
  context.actions['open-sources'].afterSeq = 17;
  assert.equal(condition().status,'APPLIES','Recorded failure remains applicable without a native capture');
  assert.equal(condition().sampleApplies,false);
});

test('source read surface glyphs measure retained refresh on its original verified failed opening', ()=>{
  const currentGlyph = contract.assertions.find(item=>item.id === 'source.read.retained-failure.text');
  assert.equal(currentGlyph.expected.requireTransientStatus,true);
  const {scope,conditionAssertion} = currentGlyph.expected;
  const glyphAssertion = {...currentGlyph,expected:{scope,conditionAssertion}};
  const projection = {...retainedFailure,filterRevision:3,textProjectionRevision:6};
  const context = contextFor(projection);
  const current = context.samples[assertion.sample];
  const filter = current.nodes.find(node=>node.id === 'reader-source-filter-block');
  filter.path = '0/1';
  const refresh = current.nodes.find(node=>node.id === 'reader-source-retained-read-retry');
  Object.assign(refresh,{path:'0/1/0',parentPath:filter.path});
  current.nodes.push(nativeNode(null,'0/1/0/0','Text',{left:16,top:75,width:82,height:26},refresh.path));
  const text = glyphSample(current,projection,'retained-read-failed',38);
  context.events.push(text);
  const evaluate = ()=>evaluateSource({...glyphAssertion,acceptedSources:glyphAssertion.sources},context);
  const proof = evaluate();
  assert.equal(proof.verdict,'PASS',proof.reason);
  assert.deepEqual(Object.keys(proof.actual.roles),glyphs['retained-read-failed']);
  assert.equal(evaluateSourceRetainedReadFailure(assertion,context).actual.current.previousFirstRowVisible,true);
  assert.equal(proof.actual.roles['read/retained-retry'].actual.tailCount,1);
  text.payload.owner = priorOwner;
  assert.equal(evaluate().verdict,'NOT_RUN');
  const retainedCondition = sourceRetainedReadCondition(assertion,context);
  assert.equal(retainedCondition.status,'APPLIES');
  assert.deepEqual(conditionApplicability(glyphAssertion,context,evaluate(),contract,undefined,{[assertion.id]:retainedCondition}),
    retainedCondition);
});

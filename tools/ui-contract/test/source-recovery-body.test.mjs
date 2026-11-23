import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { requestedOperation, requireActionDispatch } from '../collectors/harmonyos/records.mjs';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';
import { assertSourceRecoveryExpandEdgeState, evaluateSourceRecoveryBody,
  sourceRecoveryExpandEdgeAssertion } from '../lib/source-recovery-body.mjs';
import { sourceUnknownExpandScope, sourceUnknownExpandTrigger, sourceUnknownToggle } from '../lib/source-unknown-expand.mjs';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { selectedProductionMethods } from '../../lib/selected-production-methods.mjs';

const plans = new Map(['original','unknown'].flatMap(branch=>['','-fits'].map(suffix=>{
  const file = `../cases/source-management.${branch}-recovery-body${suffix}.json`;
  return [branch+suffix,JSON.parse(readFileSync(new URL(file,import.meta.url),'utf8'))];
})));
const owner = {mounting:4,generation:5};
const frame = {left:0,top:0,width:400,height:800};
const rect = (id,bounds,type,children=[]) => ({
  attributes:{id,bounds,origBounds:bounds,type,hostWindowId:'42',visible:'true',opacity:'1',
    enabled:'true',clickable:type === 'Button' ? 'true' : 'false'},children,
});

function sample(id, branch, beforeSeq, clipped = false) {
  const text = rect('reader-source-recovery-message','[30,130][344,258]','Text');
  const control = rect(`reader-source-${branch}-expand`,'[280,264][344,308]','Button');
  const notice = rect(`reader-source-${branch}-recovery`,'[20,110][362,336]','Stack',clipped ? [text,control] : [text]);
  const overlay = rect('reader-source-pending-recovery','[12,100][388,350]','Scroll',[notice]);
  const root = rect('','[0,0][400,800]','root',[overlay]);
  Object.assign(root.attributes,{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'});
  const tree = rect('','[0,0][400,800]','Window',[root]);
  const layout = normalizeHarmonyLayout({tree,report:{windowId:'42',vpPixels:1,metrics:{
    ready:true,revision:2,densityPixels:1,systemFontScale:1,windowRect:frame,globalRect:frame,
    keyboardArea:{available:true,visible:false,rects:[],revision:2},keyboardInsets:{left:0,top:0,right:0,bottom:0},
  }},sampleId:id,instanceId:'current',evidenceRefs:[{path:`${id}.json`},{path:`${id}.png`}]});
  Object.assign(layout.window,{fontScale:1,nativeFont:{followsSystemFontScale:true,effectiveScale:1,fpPixels:1,vpPixels:1,maxFontScale:2}});
  return {...layout,beforeSeq,afterSeq:beforeSeq+1,captureComplete:true};
}

const event = (kind,eventSeq,payload) => ({kind,eventSeq,payload,channel:'business',instanceId:'current',
  windowRevision:2,evidenceRefs:[{path:kind+'.json'}]});

function scenario(branch,{fitCase=false,noticeFits=fitCase}={}) {
  const plan = plans.get(branch+(fitCase ? '-fits' : ''));
  const assertion = plan.assertions.at(-1);
  const baseline = fitCase ? assertion.sample : assertion.baseline;
  const before = sample(baseline,branch,10,!noticeFits);
  const samples = {[baseline]:before};
  const actions = {'open-sources':{op:'click',targetId:'reader-settings-source-management',beforeSeq:1,afterSeq:3,
    instanceId:'current',outcomeSettled:true}};
  const recovery = {branch,generation:7,busy:false,canContinue:branch === 'original',canReconcile:true};
  const projection = {owner,textProjectionRevision:3,readGeneration:2,filterRevision:1,readFact:'current',state:'recovery',recovery};
  const events = [
    event('source.route',2,{action:'open',from:'settings',to:'source',...owner,previousGeneration:4}),
    event('source.projection',4,projection),
    event('source.recovery-title',6,{owner,branch,generation:7,title:noticeFits ? 'fits' : 'clipped'}),
  ];
  const count = noticeFits ? 3 : 5;
  const box = (index,tail=false) => ({leftPx:tail ? 75 : 0,topPx:index*20,rightPx:96,bottomPx:index*20+18});
  const lines = Array.from({length:count},(_,i)=>({start:i*4,end:(i+1)*4,leftPx:0,topPx:i*20,widthPx:96,heightPx:18,baselinePx:i*20+14}));
  const label = {role:`recovery/${branch}/message`,utf16Length:count*4,startUtf16:0,endUtf16:count*4,
    complete:true,lines,rangeRects:lines.map((_,index)=>box(index)),tailRects:[box(count-1,true)]};
  const snapshot = {owner,scope:'operation-recovery-body',branch,generation:7,windowRevision:2,
    textProjectionRevision:3,readGeneration:2,filterRevision:1,widthVp:400,heightVp:800,
    density:1,systemFontScale:1,fontScale:1,labels:[label]};
  if (noticeFits) events.push(event('source.surface-text-layout',8,{...snapshot,presentation:'fits'}));
  if (!fitCase && !noticeFits) {
    samples[assertion.sample] = sample(assertion.sample,branch,20);
    actions[assertion.action] = {op:'click',from:baseline,targetId:`reader-source-${branch}-expand`,
      beforeSeq:12,afterSeq:16,instanceId:'current',outcomeSettled:true,sourceCenterTap:{x:312,y:286,probeSeq:12}};
    events.push(event('source.recovery-body-state',14,{owner,branch,generation:7,phase:'expanded',expansionRevision:1}));
    events.push(event('source.surface-text-layout',18,{...snapshot,presentation:'expanded',expansionRevision:1}));
  }
  return {assertion,context:{samples,actions,events},label};
}

test('Source recovery body proves the ordinary original and unknown notice, fitted or really expanded',()=>{
  for (const branch of ['original','unknown']) {
    for (const fitCase of [false,true]) {
      const {assertion,context} = scenario(branch,{fitCase});
      const result = evaluateSourceRecoveryBody(assertion,context);
      assert.equal(result.verdict,'PASS',result.reason);
      assert.equal(result.actual.applicability,'APPLIES');
      assert.equal(result.actual.sampleApplies,true);
      assert.equal(result.actual.sampleId,assertion.sample);
      assert.equal(result.actual.textScope,'operation-recovery');
      assert.equal(result.actual.roles[`recovery/${branch}/message`].actual.lineCount,fitCase ? 3 : 5);
      assert.equal(result.actual.roles[`recovery/${branch}/message`].actual.tailCount,1);
      assert.equal(result.actual.nativeInteraction?.subject,fitCase ? undefined : `${branch}-expand-collapse`);
    }
  }
});

test('Source recovery body distinguishes fitted and folded conditions and retains clipping failures',()=>{
  for (const [fitCase,noticeFits] of [[false,true],[true,false]]) {
    const {assertion,context} = scenario('original',{fitCase,noticeFits});
    const result = evaluateSourceRecoveryBody(assertion,context);
    assert.equal(result.verdict,'NOT_RUN');
    assert.equal(result.actual.applicability,'DOES_NOT_APPLY',result.reason);
  }
  const noFitProof = scenario('original',{noticeFits:true});
  noFitProof.context.events.pop();
  assert.equal(evaluateSourceRecoveryBody(noFitProof.assertion,noFitProof.context).actual.applicability,'UNKNOWN');
  const cropped = scenario('unknown');
  cropped.label.tailRects[0].rightPx=318;
  const result = evaluateSourceRecoveryBody(cropped.assertion,cropped.context);
  assert.equal(result.verdict,'FAIL',result.reason);
  assert.equal(result.actual.sampleApplies,true);
});

test('Source recovery body rejects unverified expand, changed owner and stale glyph data',()=>{
  for (const change of [
    context=>{delete context.actions['expand-recovery'];},
    context=>{context.events.find(item=>item.kind === 'source.recovery-body-state').payload.generation++;},
    context=>{context.events.find(item=>item.kind === 'source.recovery-body-state').payload.phase='collapsed';},
    context=>{context.events.at(-1).payload.expansionRevision++;},
    context=>{context.events.at(-1).payload.textProjectionRevision--;},
    context=>{context.samples['recovery-expanded'].window.revision++;},
  ]) {
    const {assertion,context} = scenario('unknown');
    change(context);
    const result = evaluateSourceRecoveryBody(assertion,context);
    assert.equal(result.verdict,'NOT_RUN',result.reason);
    assert.equal(result.actual.applicability,'APPLIES');
  }
  const missingBody = scenario('original');
  missingBody.context.samples['recovery-expanded'].nodes.pop();
  const actual = evaluateSourceRecoveryBody(missingBody.assertion,missingBody.context);
  assert.equal(actual.verdict,'FAIL',actual.reason);
});

test('Source recovery body producer retires the rich Text controller when the generation or expansion changes',()=>{
  const source = new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url);
  const events = [];
  const schedules = [];
  class Metrics {
    track(role,prefix,isPrefix) { return {role,prefix,isPrefix,controller:this}; }
  }
  const Page = selectedProductionMethods(source,'SourceManagementPage',[
    'verificationRecoveryBodyFact','scheduleVerificationRecoveryBody','recoveryBodyGlyphOptions','recoveryBodyExpansionObserver',
    'verificationRecoveryBodyRevision','verificationRecoveryBodyKey','verificationRecoveryBodyExpanded',
    'verificationRecoveryBodyAttachment','verificationSurfaceTextKey','verificationSurfaceTextMetrics','verificationSurfaceTextFrameKeys',
  ],{
    ReaderSourceTextMetrics:Metrics,sourceVerificationOpening:()=>owner,
    ReaderUIVerificationProbe:{emit:(kind,_channel,payload)=>events.push({kind,payload})},
  });
  let current = {scope:'operation-recovery',branch:'original',generation:7};
  const page = Object.assign(new Page(),{
    verificationOperationTextFact:()=>current,
    scheduleVerificationSurfaceText:(read,count)=>schedules.push({read,count}),
  });
  const text = page.recoveryBodyGlyphOptions('original');
  const expand = page.recoveryBodyExpansionObserver('original');
  const prefix = ' 待处理   保留原操作';
  const folded = text(7,'collapsed',prefix);
  assert.equal(schedules.length,0,'folded Text is attached without claiming full expanded content');
  const fitted = text(7,'fits',prefix);
  assert.equal(fitted.isPrefix,true);
  assert.equal(fitted.role,'recovery/original/message');
  const fittedRead = schedules.at(-1).read;
  expand(6,true);
  assert.equal(events.length,0);
  expand(7,true);
  assert.deepEqual(events.at(-1),{kind:'source.recovery-body-state',payload:{
    owner,branch:'original',generation:7,phase:'expanded',expansionRevision:1,
  }});
  assert.equal(fittedRead(),undefined);
  const expanded = text(7,'expanded',prefix);
  assert.equal(expanded.controller,fitted.controller);
  assert.equal(expanded.controller,folded.controller,'real unfold uses the same mounted Text controller');
  const expandedRead = schedules.at(-1).read;
  assert.equal(expandedRead().expansionRevision,1);
  expand(7,false);
  assert.equal(expandedRead(),undefined);
  current = {scope:'operation-recovery',branch:'unknown',generation:8};
  assert.equal(text(7,'fits',prefix),undefined);
  const unknown = page.recoveryBodyGlyphOptions('unknown')(8,'fits',prefix);
  assert.equal(unknown.role,'recovery/unknown/message');
  assert.notEqual(unknown.controller,expanded.controller);
});

function expandEdgeScenario(branch,{noticeFits = false} = {}) {
  const plan = JSON.parse(readFileSync(new URL(
    `../cases/source-management.${branch}-recovery-expand-touch-edge.json`,import.meta.url)));
  const assertion = plan.assertions.at(-1);
  const step = plan.steps.find(item=>item.id === assertion.action);
  const {context} = scenario(branch,{noticeFits});
  context.events = context.events.filter(item=>item.kind !== 'source.surface-text-layout');
  const firstOpening = branch === 'unknown';
  let actionBefore = 12;
  if (firstOpening) {
    context.sourceUnknownExpand = true;
    actionBefore = 30;
    const center = context.actions['expand-recovery'];
    context.actions['collapse-recovery'] = {...center,from:'recovery-expanded',beforeSeq:23,afterSeq:25};
    context.samples[assertion.baseline] = sample(assertion.baseline,branch,27,true);
    context.samples[assertion.sample] = sample(assertion.sample,branch,38);
    context.events.push(event('source.recovery-body-state',24,{owner,branch,generation:7,phase:'collapsed',expansionRevision:2}));
    context.events.push(event('source.recovery-body-state',32,{owner,branch,generation:7,phase:'expanded',expansionRevision:3}));
  }
  const before = context.samples[assertion.baseline];
  const after = context.samples[assertion.sample];
  delete before.window.nativeFont;
  if (after) {
    delete after.window.nativeFont;
    const mounted = after.nodes.find(node=>node.id === 'reader-source-recovery-message');
    mounted.rectPx.height += 55;
    mounted.visibleRectPx.height += 55;
    assertSourceRecoveryExpandEdgeState(step,before,{eventSeq:actionBefore},context.events);
    const command = requestedOperation(step,context.samples,plan.fixture);
    assert.deepEqual(command,{op:'click',x:312,y:265});
    const dispatch = requireActionDispatch([{event:'command',ok:true,seq:1,
      args:['shell','uitest','uiInput','click','312','265']}],1,command);
    const legacy = context.actions['expand-recovery'];
    context.actions[step.id] = {...legacy,from:assertion.baseline,beforeSeq:actionBefore,afterSeq:actionBefore+4,
      recoveryExpandEdgeTap:{x:command.x,y:command.y,probeSeq:dispatch.seq}};
    if (!firstOpening) delete context.actions['expand-recovery'];
  }
  const evaluate = () => evaluateSourceRecoveryBody(assertion,context);
  return {assertion,step,plan,context,before,after,evaluate};
}

test('Source recovery Expand edge proves the original and unknown native touches and their current local expansion',()=>{
  for (const branch of ['original','unknown']) {
    const {assertion,step,plan,context,evaluate} = expandEdgeScenario(branch);
    const subject = `${branch}-expand-collapse`;
    const target = `reader-source-${branch}-expand`;
    const actualTouch = {subject,target,position:'top'};
    assert.deepEqual(sourceRecoveryExpandEdgeAssertion(plan,assertion),actualTouch);
    const result = evaluate();
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(conditionApplicability(assertion,context,result,plan).sampleApplies,true);
    assert.deepEqual(result.actual.nativeInteraction,{
      ...actualTouch,carrierPath:'0/0/0/1',bounds:{left:280,top:264,width:64,height:44},visible:true,clipped:false,
      enabled:true,accepted:true,actionId:step.id,baselineSampleId:step.from,dispatch:{x:312,y:265,probeSeq:1},
    });
    assert.throws(()=>requestedOperation(step,context.samples,{id:'private-fixture',publicSources:true}),/exact public Source/u);
  }
});

test('Source recovery Expand edge keeps the folded condition pending when the observed endpoint is missing',()=>{
  const fitting = expandEdgeScenario('original',{noticeFits:true});
  const fits = fitting.evaluate();
  assert.equal(fits.verdict,'NOT_RUN');
  assert.equal(conditionApplicability(fitting.assertion,fitting.context,fits,fitting.plan).status,'DOES_NOT_APPLY');
  assert.throws(()=>assertSourceRecoveryExpandEdgeState(fitting.step,fitting.before,{eventSeq:12},fitting.context.events),
    /same folded notice/u);
  const pending = expandEdgeScenario('unknown');
  pending.context.events.pop();
  const result = pending.evaluate();
  assert.equal(result.verdict,'NOT_RUN');
  assert.deepEqual(conditionApplicability(pending.assertion,pending.context,result,pending.plan),{
    status:'APPLIES',required:true,reason:'The current native recovery notice exposes its applicable folded presentation',
    sampleApplies:false,
  });
  assert.equal(result.actual.nativeInteraction,undefined);
});

test('Source recovery Expand edge rejects stale notices, wrong commands and a reply without native body expansion',()=>{
  for (const branch of ['original','unknown']) {
    const wrongPoint = expandEdgeScenario(branch);
    wrongPoint.context.actions[wrongPoint.step.id].recoveryExpandEdgeTap.y++;
    assert.equal(wrongPoint.evaluate().verdict,'NOT_RUN');
    const stale = expandEdgeScenario(branch);
    stale.context.events.push(event('source.recovery-body-state',stale.before.beforeSeq,{owner,branch,generation:7,
      phase:'expanded',expansionRevision:4}));
    const edgeBefore = stale.context.actions[stale.step.id].beforeSeq;
    assert.throws(()=>assertSourceRecoveryExpandEdgeState(stale.step,stale.before,{eventSeq:edgeBefore},stale.context.events),
      /same folded notice/u);
    assert.equal(stale.evaluate().verdict,'NOT_RUN');
    const wrongExtent = expandEdgeScenario(branch);
    wrongExtent.after.nodes.find(node=>node.id === 'reader-source-recovery-message').rectPx.height -= 55;
    assert.equal(wrongExtent.evaluate().verdict,'FAIL');
    const wrongOperation = expandEdgeScenario(branch);
    const prior = wrongOperation.context.events.find(item=>item.kind === 'source.projection');
    wrongOperation.context.events.push(event('source.projection',wrongOperation.after.beforeSeq-1,{...prior.payload,readGeneration:3}));
    assert.equal(wrongOperation.evaluate().verdict,'FAIL');
  }
});

test('First-opening unknown recovery accepts one current actual lost acknowledgement after the native toggle',()=>{
  const context = {
    actions:{
      'open-sources':{op:'click',targetId:'reader-settings-source-management',instanceId:'current',beforeSeq:1,afterSeq:3},
      'enable-for-unknown':{op:'click',targetId:sourceUnknownToggle,from:'source-ready',outcomeSettled:true,
        instanceId:'current',beforeSeq:7,afterSeq:10},
    },
    samples:{'source-ready':sample('source-ready','unknown',5),'recovery-collapsed':sample('recovery-collapsed','unknown',12,true)},
    events:[
      event('source.route',2,{action:'open',from:'settings',to:'source',...owner,previousGeneration:4}),
      event('source.projection',4,{owner,state:'rows',count:1,projected:1}),
      {...event('source.fixture-write-unknown',8,{scope:sourceUnknownExpandScope,beforeReadRequestId:43,requestId:44,
        afterReadRequestId:45,dispatched:true,sdkDeliveryAcknowledged:true,beforeEnabled:false,observedEnabled:true,
        afterVersionMatched:true}),channel:'probe'},
      event('source.projection',9,{owner,state:'recovery',recovery:{branch:'unknown',generation:7,busy:false,
        canContinue:false,canReconcile:true}}),
    ],
  };
  assert(sourceUnknownExpandTrigger(context)?.evidenceRefs.some(ref=>ref.path === 'source.fixture-write-unknown.json'));
  for (const change of [
    replay=>{replay.events[2].eventSeq=6;},
    replay=>{replay.events[2].windowRevision++;},
    replay=>{replay.events[2].payload.observedEnabled=false;},
    replay=>{replay.events[2].payload.afterReadRequestId=43;},
    replay=>{replay.events.push({...replay.events[2],eventSeq:11});},
    replay=>{replay.events.push({...replay.events[0],eventSeq:11});},
    replay=>{replay.events[3].payload.owner.generation++;},
  ]) {
    const replay = structuredClone(context);
    change(replay);
    assert.equal(sourceUnknownExpandTrigger(replay),undefined);
  }
});

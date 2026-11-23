import assert from 'node:assert/strict';
import test from 'node:test';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';
import { evaluateSourceSurfaceText } from '../lib/source-surface-text.mjs';
import { sourceTransientStatusCases,sourceTransientStatusGuard,sourceTransientStatusStep } from '../lib/source-transient-status-text.mjs';
import { assertCurrentActionState,sourceTransientWindowStable,stableNativeFontReadback,windowStable } from '../collectors/harmonyos/records.mjs';

const refs = [{path:'raw/source.png'},{path:'raw/source.json'}];
const owner = {mounting:2,generation:8};
const currentWindow = {left:0,top:0,width:360,height:780};
const report = {vpPixels:1,fpPixels:1,followsSystemFontScale:true,maxFontScale:2,
  metrics:{ready:true,revision:4,densityPixels:1,windowRect:currentWindow,globalRect:currentWindow,
    keyboardArea:{available:true,visible:false,rects:[],revision:4},
    keyboardInsets:{left:0,top:0,right:0,bottom:0},systemFontScale:1}};
const event = (kind,eventSeq,deviceMonoMs,payload,channel='business',semanticSeq=eventSeq)=>({
  instanceId:'source',kind,channel,eventSeq,semanticSeq,windowRevision:4,deviceMonoMs,payload,evidenceRefs:refs,
});
const heartbeat = (seq,time,semanticSeq)=>event('window-stable',seq,time,{report,windowId:'42',orientation:'portrait'},'probe',semanticSeq);
const glyph = (role,length)=>({role,utf16Length:length,startUtf16:0,endUtf16:length,complete:true,
  lines:[{start:0,end:length,leftPx:0,topPx:1,widthPx:98,heightPx:19,baselinePx:15}],
  rangeRects:[{leftPx:2,topPx:2,rightPx:98,bottomPx:19}],
  tailRects:[{leftPx:81,topPx:2,rightPx:98,bottomPx:19}]});

function raw(type,id,rect,attrs={},children=[]) {
  const bounds = `[${rect.slice(0,2)}][${rect.slice(2)}]`;
  return {attributes:{type,id,bounds,origBounds:bounds,visible:'true',opacity:'1',enabled:'true',hostWindowId:'42',...attrs},children};
}

function fixture(scope, options={}) {
  const isImport = scope === 'operation-status';
  const policy = Object.values(sourceTransientStatusCases).find(item=>item.scope === scope);
  const sampleId = policy.sample;
  const actionId = policy.action;
  const branch = isImport ? {branch:'import',generation:37} : {};
  const revisions = isImport ? {...branch,statusRevision:4} : {};
  const role = policy.role;
  const persistentRole = isImport ? 'operation/action' : 'read/retained-retry';
  const persistentId = isImport ? 'reader-source-status-action' : 'reader-source-retained-read-retry';
  const policyFixture = {id:policy.fixture};
  const body = options.body ?? (isImport ? '书源导入完成：1 条' : '书源刷新失败，已保留现有列表');
  const nativeRoot = raw('root','',[0,0,360,780],{
    bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index',
  },[
    raw('Column','reader-source-filter-block',[20,100,340,400],{},[
      raw('Button',persistentId,[24,150,210,194],{},[raw('Text','',[29,155,200,179])]),
    ]),
    ...(options.rawToast === false ? [] : [raw('Row','reader-transient-feedback-61',[18,640,342,707],{},[
      raw('Text',`reader-transient-feedback-text-${options.rawGeneration ?? 61}`,[50,650,320,options.toastTextBottom ?? 675],{text:body}),
    ])]),
  ]);
  const normalized = normalizeHarmonyLayout({tree:{attributes:{bounds:nativeRoot.attributes.bounds},children:[nativeRoot]},report,
    instanceId:'source',windowId:'42',sampleId,evidenceRefs:refs,observeSourceTransientStatus:scope});
  const sample = {...normalized,captureComplete:true,beforeSeq:20,afterSeq:23,semanticSeq:18,
    sourceTransientStatusCapture:{scope,before:heartbeat(20,1200,18),after:heartbeat(23,1500,18)}};
  sample.window.nativeFont = stableNativeFontReadback(report,report);
  sample.window.fontScale = 1;
  if (!sample.window.keyboard.revision) sample.window.keyboard.revision = 4;
  const state = {owner,state:'rows',readFact:isImport ? 'current' : 'refreshFailed',readGeneration:3,
    filterRevision:5,textProjectionRevision:7,firstAnchor:41,count:isImport ? 1 : 17,projected:isImport ? 1 : 17};
  const status = {owner,phase:'ready',confirmation:'confirmed',readback:'succeeded',confirmedParts:1,
    fixturePresent:true,count:1,receiptGeneration:37,statusRevision:4};
  const textFacts = {scope,owner,readGeneration:3,filterRevision:5,textProjectionRevision:7,windowRevision:4,
    density:1,widthVp:360,heightVp:780,systemFontScale:1,fontScale:1};
  const publication = {scope,owner,readGeneration:3,...branch,phase:'published',toastGeneration:61,durationMs:2200};
  const toast = {...textFacts,...revisions,toastGeneration:61,durationMs:2200,hostId:2,labels:[glyph(role,body.length)]};
  const events = [
    ...(isImport ? [] : [event('source.route',11,900,{action:'open',from:'settings',to:'source',previousGeneration:7,...owner})]),
    event('source.projection',13,950,state),
    event('source.transient-feedback',14,1000,publication),
    ...(isImport ? [event('source.import-status-action',15,1020,status)] : []),
    event('source.surface-text-layout',17,1060,{...textFacts,...revisions,labels:[glyph(persistentRole,4)]}),
    event('source.transient-text-layout',18,1100,toast),
  ];
  const context = {events,samples:{[sampleId]:sample},actions:{[actionId]:{
    id:actionId,op:'click',targetId:isImport ? 'reader-source-picker-file' : 'reader-settings-source-management',
    instanceId:'source',beforeSeq:10,afterSeq:16,outcomeSettled:true,evidenceRefs:refs,
  }}};
  const assertion = {id:policy.assertion,evaluator:'source',kind:'surface-text',sample:sampleId,action:actionId,
    ...(isImport ? {required:true} : {required:false,condition:'A true retained read fails'}),
    expected:{scope,requireTransientStatus:true,...(isImport ? {} : {conditionAssertion:'source.load.retainedReadFailure'})}};
  return {context,sample,assertion,publication,toast,policyFixture,
    evaluate:()=>evaluateSourceSurfaceText(assertion,context)};
}

test('source transient status binds actual visible glyphs to current import and retained failure',()=>{
  for (const [scope,role,persistent] of [['operation-status','operation/status','operation/action'],
    ['retained-read-failed','read/retained-status','read/retained-retry']]) {
    const {sample,evaluate} = fixture(scope);
    const result = evaluate();
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.roles[persistent].verdict,'PASS');
    assert.equal(result.actual.roles[role].actual.toastGeneration,61);
    assert.equal(result.actual.roles[role].actual.sampleId,sample.sampleId);
    assert.equal(result.actual.roles[role].actual.tailCount,1);
    assert.equal(result.actual.roles[role].actual.hostId,2);
    assert.ok(!JSON.stringify(sample.nodes).includes('书源刷新失败'));
  }
});

test('source transient status preserves persistent glyphs when Toast is expired, absent, or borrowed',()=>{
  const missing = fixture('operation-status',{rawToast:false});
  assert.equal(missing.evaluate().actual.roles['operation/action'].verdict,'PASS');
  assert.equal(missing.evaluate().verdict,'NOT_RUN');
  const wrongNativeGeneration = fixture('operation-status',{rawGeneration:62});
  assert.equal(wrongNativeGeneration.evaluate().verdict,'NOT_RUN');
  const expired = fixture('retained-read-failed');
  expired.context.events.push(event('source.transient-feedback',22,1450,{...expired.publication,phase:'retired'}));
  const result = expired.evaluate();
  assert.equal(result.verdict,'NOT_RUN');
  assert.equal(result.actual.roles['read/retained-retry'].verdict,'PASS');
  const proof = conditionApplicability(expired.assertion,expired.context,result,{},undefined,{
    'source.load.retainedReadFailure':{status:'APPLIES',required:true,sampleApplies:true},
  });
  assert.equal(proof.status,'APPLIES');
  assert.equal(proof.required,true);
  const late = fixture('retained-read-failed');
  late.sample.sourceTransientStatusCapture.after.deviceMonoMs = 3201;
  assert.equal(late.evaluate().verdict,'NOT_RUN');
  const borrowed = fixture('operation-status');
  borrowed.toast.statusRevision = 5;
  assert.equal(borrowed.evaluate().verdict,'NOT_RUN');
  borrowed.toast.statusRevision = 4;
  borrowed.toast.readGeneration = 2;
  assert.equal(borrowed.evaluate().verdict,'NOT_RUN');
});

test('source transient status preserves proved glyph clipping and refuses a synthetic lifetime',()=>{
  const cropped = fixture('operation-status');
  cropped.toast.labels[0].tailRects[0].rightPx = 272;
  assert.equal(cropped.evaluate().verdict,'FAIL');
  assert.match(cropped.evaluate().reason,/clipped/u);
  cropped.context.events.find(item=>item.kind === 'source.surface-text-layout').payload.textProjectionRevision = 1;
  assert.equal(cropped.evaluate().verdict,'FAIL');
  assert.equal(cropped.evaluate().observationsComplete,false);
  const hidden = fixture('retained-read-failed');
  hidden.sample.nodes.find(node=>node.id === 'reader-transient-feedback-text-61').visibleRectPx.width = 0;
  assert.equal(hidden.evaluate().verdict,'FAIL');
  assert.match(hidden.evaluate().reason,/fully clipped/u);
  const extended = fixture('operation-status');
  extended.publication.durationMs = 5000;
  extended.toast.durationMs = 5000;
  assert.equal(extended.evaluate().verdict,'NOT_RUN');
});

test('source transient capture permits only its measured lifecycle through capture and persistent research',()=>{
  const context = fixture('operation-status');
  const scope = 'operation-status';
  const before = heartbeat(20,1200,18);
  const after = heartbeat(23,1500,22);
  const gap = heartbeat(21,1300,18);
  const retired = event('source.transient-feedback',22,1450,{...context.publication,phase:'retired'});
  assert.equal(windowStable(before,after),false);
  assert.equal(sourceTransientWindowStable(before,after,[gap,retired,after],scope),true);
  const projection = event('source.projection',22,1450,{owner});
  assert.equal(sourceTransientWindowStable(before,after,[gap,projection,after],scope),false);
  assert.equal(sourceTransientWindowStable(before,after,[retired,after],scope),false);
  assert.equal(sourceTransientWindowStable(before,after,[gap,retired,after],'retained-read-failed'),false);
  const replacement = event('source.transient-feedback',21,1300,{...context.publication,toastGeneration:62});
  assert.equal(sourceTransientWindowStable(before,after,[replacement,retired,after],scope),false);
  const capture = context.sample.sourceTransientStatusCapture;
  capture.after = before;
  context.sample.afterSeq = before.eventSeq;
  const step = {id:'press-research',op:'click',from:'source-imported',target:'reader-source-status-action'};
  assert.doesNotThrow(()=>assertCurrentActionState(step,context.sample,after,[...context.context.events,gap,retired,after]));
  assert.throws(()=>assertCurrentActionState(step,context.sample,after,[...context.context.events,gap,projection,after]),/stale/u);
  const substituted = {...retired,payload:{...retired.payload,toastGeneration:86}};
  assert.throws(()=>assertCurrentActionState(step,context.sample,after,[...context.context.events,gap,substituted,after]),/stale/u);
  const scoped = {id:'source-imported',kind:'sample',afterAction:'select-source-file',captureGuard:sourceTransientStatusGuard};
  assert.equal(sourceTransientStatusStep(context.policyFixture,scoped).scope,scope);
  assert.ok(!sourceTransientStatusStep({id:'any-other-fixture'},scoped));
});

function importedRowMaterializesDuringToast() {
  const current = fixture('operation-status');
  const events = current.context.events;
  const oldProjection = events.find(event=>event.kind === 'source.projection');
  const oldStatusLayout = events.find(event=>event.kind === 'source.surface-text-layout');
  Object.assign(oldProjection.payload,{trigger:'owner-update',state:'filteredEmpty',projected:0,firstAnchor:0,
    status:'all',category:'all',allGroups:true,groupIndex:0,queryLength:0});
  current.toast.rowAnchor = 0;
  const projection = event('source.projection',20,1200,{...oldProjection.payload,state:'rows',projected:1,
    textProjectionRevision:8,firstAnchor:41});
  const layout = event('source.surface-text-layout',21,1250,{...oldStatusLayout.payload,textProjectionRevision:8,rowAnchor:41});
  const before = heartbeat(22,1300,21), after = heartbeat(25,1550,21);
  events.push(heartbeat(19,1150,18),projection,layout,before);
  current.sample.beforeSeq = before.eventSeq;
  current.sample.afterSeq = after.eventSeq;
  current.sample.sourceTransientStatusCapture = {scope:'operation-status',before,after};
  return {...current,projection,layout};
}

test('Source import toast remains current across exactly one deferred first-row materialization',()=>{
  const current = importedRowMaterializesDuringToast();
  const result = current.evaluate();
  assert.equal(result.verdict,'PASS',result.reason);
  assert.deepEqual(result.actual.roles['operation/status'].actual.rowMaterialization,
    {beforeProjectionSeq:13,afterProjectionSeq:20});
  assert.equal(result.actual.roles['operation/status'].actual.textSeq,18);

  for (const mutate of [
    proof=>{ proof.projection.payload.filterRevision += 1; },
    proof=>{ proof.projection.payload.textProjectionRevision += 1; },
    proof=>{ proof.projection.payload.readGeneration += 1; },
    proof=>{ proof.projection.payload.firstAnchor = 0; },
    proof=>{ proof.layout.payload.statusRevision += 1; },
    proof=>{ proof.layout.windowRevision += 1; },
    proof=>{ proof.context.events.find(event=>event.eventSeq === 19).payload.windowId = '55'; },
    proof=>{ proof.context.events = proof.context.events.filter(event=>event.eventSeq !== 19); },
    proof=>{ proof.context.events.splice(-1,0,event('source.transient-feedback',21,1260,
      {...proof.publication,toastGeneration:62})); },
  ]) {
    const changed = importedRowMaterializesDuringToast();
    mutate(changed);
    assert.equal(changed.evaluate().actual.roles['operation/status'].verdict,'NOT_RUN');
  }
});

test('Source toast vertical ink obeys the sealed native clipping chain and painted toast',()=>{
  function visibleInk(scope = 'operation-status') {
    const proof = fixture(scope);
    const text = proof.sample.nodes.find(node=>node.id === 'reader-transient-feedback-text-61');
    const host = proof.sample.nodes.find(node=>node.id === 'reader-transient-feedback-61');
    const parent = {...text,id:'',type:'Column'};
    text.path += '/0';
    text.parentPath = parent.path;
    proof.sample.nodes.push(parent);
    for (const item of proof.sample.nodes) item.clip = false;
    proof.toast.labels[0].rangeRects[0].topPx = -2;
    return {...proof,text,host,parent};
  }
  const painted = visibleInk();
  const accepted = painted.evaluate();
  assert.equal(accepted.verdict,'PASS',accepted.reason);
  assert.deepEqual(accepted.actual.roles['operation/status'].actual.clipAncestors,
    [{path:painted.host.path,clip:false,rectPx:painted.host.visibleRectPx}]);

  for (const mutate of [
    proof=>{ proof.text.clip = true; },
    proof=>{ proof.parent.clip = true; },
    proof=>{ proof.parent.clip = null; },
    proof=>{ proof.text.visibleRectPx.top += 1; },
    proof=>{ proof.parent.parentPath = 'missing'; },
    proof=>{ proof.sample.clipShapes.push({shape:'rounded-rect',path:proof.host.path}); },
    proof=>{ proof.toast.labels[0].rangeRects[0].leftPx = -2; },
    proof=>{ proof.host.visibleRectPx.top = proof.text.rectPx.top; },
  ]) {
    const binding = visibleInk();
    mutate(binding);
    assert.notEqual(binding.evaluate().verdict,'PASS');
  }
  const retained = visibleInk('retained-read-failed');
  assert.equal(retained.evaluate().verdict,'PASS');
  retained.host.visibleRectPx.top = retained.text.rectPx.top;
  assert.equal(retained.evaluate().verdict,'FAIL');
});

test('Source retained toast admits real spaces at a native soft wrap with complete glyph ink',()=>{
  function wrapped(scope = 'retained-read-failed',body = '书源列表读取失败：storage operation failed') {
    const proof = fixture(scope,{body,toastTextBottom:690});
    for (const item of proof.sample.nodes) item.clip = false;
    const label = proof.toast.labels[0];
    Object.assign(label,{complete:false,
      lines:[
        {start:0,end:16,leftPx:0,topPx:0,widthPx:155,heightPx:20,baselinePx:15},
        {start:17,end:33,leftPx:0,topPx:20,widthPx:90,heightPx:20,baselinePx:35},
      ],
      rangeRects:[
        {leftPx:0,topPx:-2,rightPx:160,bottomPx:20},
        {leftPx:0,topPx:18,rightPx:90,bottomPx:40.4},
      ],
      tailRects:[{leftPx:81,topPx:18,rightPx:90,bottomPx:40.4}],
    });
    return {...proof,label};
  }

  const proof = wrapped();
  const node = proof.sample.nodes.find(item => item.id === 'reader-transient-feedback-text-61');
  assert.deepEqual(node.sourceTransientAsciiSpaceIndexes,[16,26]);
  assert.ok(!JSON.stringify(proof.sample.nodes).includes('operation failed'));
  const result = proof.evaluate();
  assert.equal(result.verdict,'PASS',result.reason);
  assert.deepEqual(result.actual.roles['read/retained-status'].actual.wrappedSpaceIndexes,[16]);

  assert.equal(wrapped('retained-read-failed','书源列表读取失败：storage-operation failed').evaluate().verdict,'FAIL');
  assert.equal(wrapped('retained-read-failed','书源列表读取失败：storage\u00a0operation failed').evaluate().verdict,'FAIL');
  assert.equal(wrapped('operation-status').evaluate().verdict,'FAIL');
  const overlap = wrapped();
  overlap.label.lines[1].start = 15;
  assert.equal(overlap.evaluate().verdict,'FAIL');
  const missing = wrapped();
  missing.label.rangeRects.pop();
  assert.equal(missing.evaluate().verdict,'NOT_RUN');
  const wrongTail = wrapped();
  wrongTail.label.tailRects = [wrongTail.label.rangeRects[0]];
  assert.equal(wrongTail.evaluate().verdict,'NOT_RUN');
});

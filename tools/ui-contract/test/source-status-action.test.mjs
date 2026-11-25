import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { evaluateSourceImportResearchStatusAction, sourceStatusActionEdgePostToastSample,
  sourceStatusActionEdgeToastRetired, sourceStatusActionEdgeWaitForRetirement } from '../lib/source-status-action.mjs';
import { evaluateSourceSurfaceText } from '../lib/source-surface-text.mjs';
import { requestedOperation, requireActionDispatch } from '../collectors/harmonyos/records.mjs';
import { sourceV9ImportEntry, sourceV9ImportScope, sourceV9ImportStages,
  sourceV9LocalImportButton } from '../lib/source-document-picker.mjs';
import { selectedProductionMethods } from '../../lib/selected-production-methods.mjs';

const contract = JSON.parse(readFileSync(new URL('../cases/source-management.import-research-status-action.json',import.meta.url),'utf8'));
const [assertion] = contract.assertions;
const target = assertion.expected.target;
const instanceId = 'current';
const owner = {mounting:4,generation:6};
const frame = {left:0,top:0,width:420,height:880};
const buttonRect = {left:10,top:96,width:88,height:44};
const node = (id,path,parentPath,type,rectPx) => ({
  id,path,parentPath,type,rectPx,visibleRectPx:{...rectPx}, source:'native-tree',
  opacity:1,visible:true,enabled:true,clickable:type === 'Button',
});
const sample = (beforeSeq,nodes=[]) => ({
  instanceId,nodes,beforeSeq,afterSeq:beforeSeq+1,captureComplete:true,
  window:{id:'28',source:'window-metrics',density:1,keyboard:{visible:false},visibleRectPx:frame},
  evidenceRefs:[{path:'sample.png'},{path:'sample.json'}],
});
const action = (from,targetId,beforeSeq,afterSeq,extra={}) => ({
  instanceId,from,targetId,beforeSeq,afterSeq,op:'click',...extra,
});
const event = (eventSeq,kind,payload) => ({instanceId,eventSeq,kind,payload,channel:'business'});
function scenario(legacy = false) {
  const readyAt = legacy ? 27 : 38;
  const importAt = legacy ? 32 : 41;
  const pressAt = legacy ? 34 : 43;
  const searchAt = legacy ? 41 : 51;
  const sourceFact = {owner,statusRevision:2,receiptGeneration:37,confirmation:'confirmed',
    readback:'succeeded',confirmedParts:1,fixturePresent:true,count:1};
  const actions = {
    'focus-editor':action('search-entry','reader-book-search-input',1,2),
    'type-query':action('ime-ready','reader-book-search-input',2,6,{op:'inputText',inputRole:'a',inputLength:6}),
    'manage-sources':action('search-draft','reader-search-source-recovery-primary',9,12),
    'open-import-dialog':action('source-before-import','reader-source-footer-add-button',16,17),
    'open-picker':action(legacy ? 'import-dialog' : sourceV9ImportEntry,'reader-source-import-local-file',18,19),
    'press-research':action('source-imported',target,pressAt,searchAt-1,{sourceCenterTap:{x:54,y:118,probeSeq:12}}),
  };
  for (const [index,[id,role]] of [['browse-files','browse'],['open-phone-storage','phone'],
    ['open-downloads','downloads'],['select-source-file','file']].entries()) {
    const start = 20 + 2*index;
    actions[id] = action(`picker-${role}`,`reader-source-picker-${role}`,start,index === 3 ? 31 : start+1,{
      pickerTap:{operation:role,carrierPath:'0/0/2',probeSeq:6+index,x:40,y:80},
    });
  }
  const nodes = [
    node('reader-source-list','0',null,'List',frame),
    node('reader-source-filter-block','0/0','0','Column',frame),
    node(target,'0/0/0','0/0','Button',buttonRect),
  ];
  const viewportId = 'reader-search-result-list:8:5';
  const search = [
    node(viewportId,'0',null,'List',frame),
    {...node(null,'0/0','0','Button',buttonRect),alias:'reader-search-public-local-result',localSearchResult:true},
  ];
  const samples = {'search-draft':sample(7),'source-before-import':sample(14),
    'source-imported':{...sample(importAt,nodes),sampleId:'source-imported'},'search-returned':sample(searchAt,search)};
  if (!legacy) {
    const locator = (before,actionId,stage) => sample(before,[
      node(sourceV9ImportScope,'0',null,'Stack',frame),
      node(actionId,'0/0','0','Button',buttonRect),
      ...(stage ? [node(stage,'0/1','0','Column',frame)] : []),
    ]);
    samples[sourceV9ImportEntry] = locator(17,sourceV9LocalImportButton);
    const times = [[31,32,33],[33,34,36],[36,37,40]];
    for (const [index,step] of sourceV9ImportStages.entries()) {
      const [start,before,after] = times[index];
      samples[step.sample] = locator(start,step.target,step.stage);
      actions[step.action] = action(step.sample,step.target,before,after);
    }
  }
  return {
    actions,samples,
    events:[
      event(5,'search-draft-accepted',{length:6,queryRevision:4}),
      event(11,'source.route',{action:'open',from:'search',to:'source',previousGeneration:5,...owner}),
      event(13,'source.projection',{owner,state:'empty',readFact:'current',count:0}),
      event(readyAt,'source.import-status-action',{phase:'ready',...sourceFact}),
      event(readyAt+1,'source.projection',{owner,state:'rows',readFact:'current',count:1}),
      event(pressAt+1,'source.import-status-action',{phase:'accepted',...sourceFact}),
      event(pressAt+2,'source.route',{action:'close',from:'source',to:'search',mounting:4,previousGeneration:6,generation:7}),
      event(pressAt+3,'source.import-search-return',{mounting:4,sourceGeneration:6,navigation:7,keywordLength:6,
        previousQueryRevision:4,queryRevision:5,previousSearchGeneration:3,searchGeneration:4,draftMatches:true}),
      event(pressAt+5,'search-page-projection',{projection:'results',searchActive:false,queryRevision:5,page:8,viewportId}),
    ],
  };
}

test('source status action binds real picker dispatch, confirmed readback, native geometry and exactly one retained-query search', () => {
  const verdict = context => evaluateSourceImportResearchStatusAction(assertion,context);
  const positive = verdict(scenario());
  assert.equal(positive.verdict,'PASS',positive.reason);
  assert.equal(positive.actual.nativeTouchTarget.heightVp,44);
  assert.equal(positive.actual.searchQueryRevision,5);
  assert.equal(positive.actual.nativeResult.viewportId,'reader-search-result-list:8:5');
  assert.equal(positive.actual.nativeInteraction.subject,'status-action');
  assert.equal(positive.actual.nativeInteraction.baselineSampleId,'source-imported');
  const offsetTap = scenario();
  offsetTap.actions['press-research'].sourceCenterTap.x++;
  assert.equal(verdict(offsetTap).actual.nativeInteraction,undefined);

  const differentInput = scenario();
  differentInput.actions['type-query'].inputLength = 5;
  assert.equal(verdict(differentInput).verdict,'NOT_RUN');

  const noPicker = scenario();
  delete noPicker.actions['select-source-file'].pickerTap;
  assert.equal(verdict(noPicker).verdict,'NOT_RUN');

  const failedReadback = scenario();
  failedReadback.events[3].payload.readback = 'failed';
  assert.equal(verdict(failedReadback).verdict,'NOT_RUN');

  const wrongOwner = scenario();
  wrongOwner.events[5].payload.owner = {...owner,generation:9};
  assert.equal(verdict(wrongOwner).verdict,'FAIL');

  const clipped = scenario();
  clipped.samples['source-imported'].nodes.at(-1).visibleRectPx.height -= 1;
  delete clipped.actions['press-research'];
  assert.equal(verdict(clipped).verdict,'FAIL','imported native clipping survives a stopped dispatch');

  const missing = scenario();
  missing.samples['source-imported'].nodes.pop();
  assert.equal(verdict(missing).verdict,'FAIL');

  const staleQuery = scenario();
  staleQuery.events[7].payload.previousQueryRevision -= 1;
  assert.equal(verdict(staleQuery).verdict,'FAIL');

  const extraRestart = scenario();
  extraRestart.events.splice(8,0,{...extraRestart.events[7],eventSeq:extraRestart.events[7].eventSeq+1});
  assert.equal(verdict(extraRestart).verdict,'FAIL');

  const noReturnedResult = scenario();
  delete noReturnedResult.samples['search-returned'];
  assert.equal(verdict(noReturnedResult).verdict,'NOT_RUN');

  const wrongOriginal = scenario();
  wrongOriginal.events[7].payload.draftMatches = false;
  wrongOriginal.events.pop();
  delete wrongOriginal.samples['search-returned'];
  const wrongQuery = verdict(wrongOriginal);
  assert.equal(wrongQuery.verdict,'FAIL','the wrong retained word stays a failure without a result-page sample');
  assert.equal(wrongQuery.actual.draftMatches,false);

  const staleNativeResults = scenario();
  staleNativeResults.samples['search-returned'].nodes[0].id = 'reader-search-result-list:8:4';
  assert.equal(verdict(staleNativeResults).verdict,'FAIL');

  const wrongResultOwner = scenario();
  wrongResultOwner.samples['search-returned'].nodes.at(-1).parentPath = null;
  assert.equal(verdict(wrongResultOwner).verdict,'FAIL');
});

test('v9 Re-search requires actual parse, commit, and result return with no premature success', () => {
  const evaluate = context => evaluateSourceImportResearchStatusAction(assertion,context);
  for (const stage of sourceV9ImportStages) {
    const missingClick = scenario();
    delete missingClick.actions[stage.action];
    assert.equal(evaluate(missingClick).verdict,'NOT_RUN');

    const wrongNativeOwner = scenario();
    wrongNativeOwner.samples[stage.sample].nodes.find(item=>item.id === stage.target).parentPath = null;
    assert.equal(evaluate(wrongNativeOwner).verdict,'NOT_RUN');
  }
  const premature = scenario();
  premature.events.splice(3,0,{...premature.events[3],eventSeq:32});
  assert.equal(evaluate(premature).verdict,'FAIL');
  const noExplicitImport = scenario(true);
  assert.equal(evaluate(noExplicitImport).verdict,'NOT_RUN');
  const oldAssertion = {...assertion,expected:{target,keywordLength:6}};
  assert.equal(evaluateSourceImportResearchStatusAction(oldAssertion,noExplicitImport).verdict,'PASS');
});

test('source Re-search upper edge preserves the confirmed import and exactly one retained-query return',()=>{
  const edge = JSON.parse(readFileSync(new URL('../cases/source-management.import-research-status-action-edge.json',import.meta.url)));
  const [proof] = edge.assertions;
  const step = edge.steps.find(item=>item.id === proof.action);
  const baseline = edge.steps.find(item=>item.id === proof.baseline);
  assert.equal(edge.version,3);
  assert.equal(sourceStatusActionEdgePostToastSample(edge,baseline),true);
  assert.equal(sourceStatusActionEdgePostToastSample({...edge,version:2},baseline),true);
  assert.equal(sourceStatusActionEdgePostToastSample({...edge,version:1},baseline),false);
  assert(baseline.waitFor.some(value=>JSON.stringify(value) === JSON.stringify(sourceStatusActionEdgeWaitForRetirement)));
  assert.equal(baseline.quietMs,500);
  const context = scenario();
  const confirmed = {...context.events.find(item=>item.kind === 'source.import-status-action' &&
    item.payload.phase === 'ready'),windowRevision:3};
  const toast = (eventSeq,phase,patch = {}) => ({...event(eventSeq,'source.transient-feedback',{
    owner, scope:'operation-status',branch:'import',durationMs:2200,readGeneration:1,
    generation:confirmed.payload.receiptGeneration,toastGeneration:1,phase,...patch,
  }),windowRevision:3});
  const published = toast(confirmed.eventSeq - 1,'published');
  const retired = toast(confirmed.eventSeq + 1,'retired');
  assert.equal(sourceStatusActionEdgeToastRetired([published,confirmed,retired]),true);
  for (const lifecycle of [
    [published,confirmed],
    [confirmed,retired],
    [published,confirmed,toast(retired.eventSeq,'retired',{owner:{...owner,generation:owner.generation+1}})],
    [published,confirmed,toast(retired.eventSeq,'retired',{generation:confirmed.payload.receiptGeneration+1})],
    [published,confirmed,toast(retired.eventSeq,'retired',{toastGeneration:2})],
    [published,confirmed,retired,toast(retired.eventSeq+1,'published',{toastGeneration:2})],
    [published,confirmed,{...retired,windowRevision:4}],
  ]) assert.equal(sourceStatusActionEdgeToastRetired(lifecycle),false);
  const press = context.actions['press-research'];
  context.actions[proof.action] = press;
  delete context.actions['press-research'];
  const operation = requestedOperation(step,context.samples,edge.fixture);
  assert.deepEqual(operation,{op:'click',x:54,y:97});
  const command = {event:'command',seq:1,ok:true,args:['shell','uitest','uiInput','click','54','97']};
  assert.equal(requireActionDispatch([command],1,operation),command);
  press.statusTopTap = {x:54,y:97,probeSeq:1};
  const accepted = evaluateSourceImportResearchStatusAction(proof,context);
  assert.equal(accepted.verdict,'PASS',accepted.reason);
  assert.equal(accepted.actual.sampleId,'search-returned');
  assert.equal(accepted.actual.nativeInteraction.position,'top');
  press.statusTopTap.y = 118;
  assert.equal(evaluateSourceImportResearchStatusAction(proof,context).verdict,'NOT_RUN');
  press.statusTopTap.y = 97;
  context.events.find(item=>item.kind === 'source.import-search-return').payload.queryRevision++;
  const unrelated = evaluateSourceImportResearchStatusAction(proof,context);
  assert.equal(unrelated.verdict,'FAIL');
  assert.equal(unrelated.actual.nativeInteraction,undefined);
  const carrier = context.samples['source-imported'].nodes.at(-1);
  carrier.visibleRectPx = {...carrier.visibleRectPx,height:43};
  assert.throws(()=>requestedOperation(step,context.samples,edge.fixture),/clipped/u);
});

test('Source import Re-search glyph requires current ready receipt and uncut native Text', () => {
  const currentAssertion = contract.assertions.find(item=>item.id === 'source.import-research-status-glyph');
  const glyphAssertion = {...currentAssertion,expected:{scope:currentAssertion.expected.scope}};
  assert.equal(contract.version,4);
  assert.equal(currentAssertion.expected.requireTransientStatus,true);
  function glyphScenario() {
    const context = scenario();
    const current = context.samples['source-imported'];
    const projection = context.events.find(item=>item.kind === 'source.projection' && item.payload.state === 'rows');
    Object.assign(projection.payload,{textProjectionRevision:3,readGeneration:2,filterRevision:1,projected:1});
    Object.assign(current.window,{revision:2,fontScale:1,rectPx:frame,keyboard:{visible:false,revision:2},
      nativeFont:{followsSystemFontScale:true,effectiveScale:1,fpPixels:1,vpPixels:1,maxFontScale:2}});
    current.nodes.push(node('','0/0/0/0','0/0/0','Text',{left:16,top:109,width:75,height:18}));
    context.actions[currentAssertion.action].outcomeSettled = true;
    const label = {role:'operation/action',utf16Length:4,startUtf16:0,endUtf16:4,complete:true,
      lines:[{start:0,end:4,leftPx:0,topPx:0,widthPx:60,heightPx:18,baselinePx:14}],
      rangeRects:[{leftPx:0,topPx:0,rightPx:60,bottomPx:18}],
      tailRects:[{leftPx:44,topPx:0,rightPx:60,bottomPx:18}]};
    const text = {...event(40,'source.surface-text-layout',{
      scope:'operation-status',owner,branch:'import',generation:37,statusRevision:2,windowRevision:2,
      textProjectionRevision:3,readGeneration:2,filterRevision:1,widthVp:420,heightVp:880,
      density:1,systemFontScale:1,fontScale:1,labels:[label],
    }),windowRevision:2,evidenceRefs:[{path:'source.surface-text-layout.json'}]};
    context.events.splice(5,0,text);
    return {context,text,label,current};
  }
  const positive = evaluateSourceSurfaceText(glyphAssertion,glyphScenario().context);
  assert.equal(positive.verdict,'PASS',positive.reason);
  assert.equal(positive.actual.sampleId,'source-imported');
  assert.equal(positive.actual.roles['operation/action'].actual.tailCount,1);
  for (const change of [
    ({text})=>{text.payload.generation++;},
    ({text})=>{text.payload.statusRevision++;},
    ({text})=>{text.payload.textProjectionRevision--;},
    ({context})=>{context.events.find(item=>item.kind === 'source.import-status-action').payload.fixturePresent=false;},
  ]) {
    const input = glyphScenario();
    change(input);
    assert.equal(evaluateSourceSurfaceText(glyphAssertion,input.context).verdict,'NOT_RUN');
  }
  for (const change of [
    ({label})=>{label.tailRects[0].rightPx=80;},
    ({current})=>{current.nodes.pop();},
  ]) {
    const input = glyphScenario();
    change(input);
    assert.equal(evaluateSourceSurfaceText(glyphAssertion,input.context).verdict,'FAIL');
  }
});

test('Source operation glyph producer retires status, original and unknown generation callbacks', () => {
  const Page = selectedProductionMethods(new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url),
    'SourceManagementPage', ['verificationOperationTextFact','scheduleVerificationOperationText',
      'prepareOperationGlyphs','operationGlyphOptions','statusGlyphOptions','recoveryGlyphOptions',
      'verificationOperationTextRoles','verificationOperationTextKey','verificationSurfaceTextKey',
      'verificationSurfaceTextMetrics','verificationSurfaceTextFrameKeys','scheduleVerificationRecoveryBody'],
    {ReaderUIVerificationProbe:{enabled:()=>true}});
  const calls = [];
  const schedules = [];
  let active = true;
  let recovery;
  const page = Object.assign(new Page(), {
    verificationTextMetrics:{},
    managementOpeningIsCurrent:()=>active,
    verificationRecoveryFacts:()=>recovery,
    recoveryOverlayVisible:()=>recovery !== undefined,
    hasPendingSourceRecovery:()=>recovery !== undefined,
    sourceListLoading:()=>false,
    statusActionLabel:'重新搜索',
    statusActionGeneration:4,
    sources:[{}],
    operation:{action:'import',receipt:{facts:{generation:37},receipt:{confirmation:'confirmed',readback:'succeeded'}}},
    verificationSurfaceTextOptions:(scope,role,label,branch)=>{const fact={scope,role,label,branch}; calls.push(fact); return fact;},
    scheduleVerificationSurfaceText:(current,expectedRoles)=>schedules.push({current,expectedRoles}),
  });
  assert.equal(page.statusGlyphOptions(3),undefined);
  assert.deepEqual(page.statusGlyphOptions(4),{scope:'operation-status',role:'operation/action',label:'重新搜索',branch:'import'});
  assert.deepEqual(schedules.at(-1).current(),{scope:'operation-status',branch:'import',generation:37,statusRevision:4});
  page.operation.receipt.receipt.readback = 'pending';
  assert.equal(page.statusGlyphOptions(4),undefined);
  assert.equal(schedules.at(-1).current(),undefined);
  recovery = {branch:'original',generation:41};
  const original = page.recoveryGlyphOptions('original',41);
  assert.equal(original('reconcile','核对').role,'recovery/original/reconcile');
  assert.equal(original('expand','展开').role,'recovery/original/expand');
  assert.equal(schedules.at(-1).expectedRoles,2);
  recovery = {branch:'unknown',generation:42};
  assert.equal(original('continue','继续'),undefined);
  const unknown = page.recoveryGlyphOptions('unknown',42);
  const unknownBucket = page.verificationSurfaceTextKey('operation-recovery','unknown');
  page.verificationSurfaceTextMetrics.set(unknownBucket,{retired:true});
  page.verificationSurfaceTextFrameKeys.set(unknownBucket,'retired');
  assert.equal(unknown('reconcile','核对').role,'recovery/unknown/reconcile');
  assert.equal(page.verificationSurfaceTextMetrics.has(unknownBucket),false);
  assert.equal(page.verificationSurfaceTextFrameKeys.has(unknownBucket),false);
  assert.equal(schedules.at(-1).expectedRoles,1);
  active = false;
  assert.equal(unknown('expand','展开'),undefined);
  assert.equal(schedules.at(-1).current(),undefined);
  assert.equal(calls.length,4);
});

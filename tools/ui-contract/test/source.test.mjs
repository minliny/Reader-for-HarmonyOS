import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { assertCombinedFilterResetAction, evaluateSource } from '../lib/source.mjs';
import { sourceFilterNativeAssertion, sourceFilterNativeDispatch } from '../lib/source-filter-edge.mjs';
import { sourceReadRetryTouchAssertion } from '../lib/source-read-retry-touch.mjs';
import { requestedOperation, requireActionDispatch } from '../collectors/harmonyos/records.mjs';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { structureBindingSha256 } from '../lib/receipt-structure.mjs';
import { resolveStructureBindings, structureRuleOrder } from '../lib/structure-contract.mjs';
import { exportReplayTool } from '../export-replay.mjs';
import { admitReplayedRule, checkContractReceipt, verifyFrozenTool } from '../../page-structure/receipt-evidence.mjs';
import { checkNormalPageEvidence } from '../../page-structure/normal-page-evidence.mjs';
import { digest } from '../../page-structure/lib.mjs';

const read = url => JSON.parse(readFileSync(new URL(url, import.meta.url), 'utf8'));
const contract = read('../cases/source-management.layout-filter.json');
const combinedResetContract = read('../cases/source-management.combined-filter-reset.json');
const combinedResetAssertion = combinedResetContract.assertions.find(item => item.kind === 'combined-filter-reset');
const legacyCombinedReset = {
  ...combinedResetAssertion,
  expected:{status:'unchecked',category:'novel',groupIndex:1,queryLength:18,count:18,projectedBeforeEdit:16},
};
const model = read('../../page-structure/model.json');
const page = read('../../page-structure/register.json').pages.find(item => item.pageId === 'source-management');
const sha = 'a'.repeat(64);
const ref = path => ({path, bytes:27, sha256:sha});
const capture = id => [ref(`raw/${id}.png`), ref(`raw/${id}.json`)];
const owner = {mounting:2,generation:17};
const completeState = {
  owner, filterRevision:1, trigger:'owner-update', category:'all', status:'all', allGroups:true, groupIndex:0,
  readGeneration:9, readFact:'current', state:'rows', count:18, projected:18, queryLength:0, firstAnchor:1,
};
const miss = {
  ...completeState, trigger:'edit', filterRevision:2, queryLength:17, projected:0, state:'filteredEmpty', firstAnchor:0,
};
const reset = {...completeState, trigger:'clear', filterRevision:3};
const instanceId = 'one-normal-app-instance';
const makeNode = id => {
  const rect = {left:10,top:14,width:20,height:21};
  return {id,path:id,parentPath:null,rectPx:rect,visibleRectPx:rect,visible:true,opacity:1};
};
const sample = (sampleId, beforeSeq, nodes, visible = false) => ({
  sampleId, beforeSeq, instanceId, window:{id:'1',keyboard:{visible}}, nodes:nodes.map(makeNode), evidenceRefs:capture(sampleId),
});

function addSourceActionBounds(capture, scopeId, targetId) {
  const listId = 'reader-source-list';
  const viewport = {left:0,top:0,width:360,height:800};
  const surface = {left:8,top:12,width:344,height:144};
  const button = {left:12,top:70,width:100,height:44};
  const upsert = (id,parentPath,type,rect) => {
    const node = capture.nodes.find(point => point.id === id) ?? makeNode(id);
    if (!capture.nodes.includes(node)) capture.nodes.push(node);
    Object.assign(node,{source:'native-tree',parentPath,type,rectPx:rect,visibleRectPx:rect,
      enabled:true,clickable:type === 'Button'});
  };
  Object.assign(capture.window,{source:'window-metrics',visibleRectPx:viewport,density:1});
  upsert(listId,null,'List',viewport);
  upsert(scopeId,listId,'ListItem',surface);
  upsert(targetId,scopeId,'Button',button);
}

const action = (beforeSeq, op, inputLength) => ({ beforeSeq, instanceId, op, inputLength, evidenceRefs:[ref('session/commands.jsonl')] });
const event = (eventSeq, kind, payload) => ({eventSeq,kind,payload,instanceId,channel:'business',evidenceRefs:[ref('session/commands.jsonl')]});
const evaluate = (id, context) => {
  const assertion = contract.assertions.find(item => item.id === id);
  return evaluateSource({...assertion, acceptedSources:assertion.sources}, context);
};

function evaluationFixture() {
  return {
    actions: {'edit-zero-match':action(20,'inputText',17),'clear-filters':action(40,'click')},
    samples: {
      'source-ready':sample('source-ready',17,['reader-source-row-1']),
      'filtered-ime':sample('filtered-ime',27,['reader-source-editor'],true),
      'zero-match':sample('zero-match',39,['reader-source-filtered-empty','reader-source-clear-filters']),
      cleared:sample('cleared',56,['reader-source-row-1']),
    },
    events: [
      event(12,'source.route',{...owner,action:'open',from:'settings',to:'source'}),
      event(14,'source.projection',completeState),
      event(21,'source.projection',miss),
      event(42,'source.projection',reset),
    ],
  };
}

function combinedResetFixture() {
  const filtered = {
    ...completeState,trigger:'group',filterRevision:4,status:'unchecked',category:'novel',
    allGroups:false,groupIndex:1,projected:16,
  };
  const zero = {...filtered,trigger:'edit',filterRevision:5,queryLength:18,state:'filteredEmpty',projected:0,firstAnchor:0};
  const cleared = {...reset,filterRevision:6};
  const captures = [
    sample('source-ready',17,['reader-source-row-1']),
    sample('combined-active',29,['reader-source-row-1']),
    sample('filtered-ime',41,['reader-source-editor'],true),
    sample('zero-match',49,['reader-source-filtered-empty','reader-source-clear-filters']),
    sample('cleared',60,['reader-source-row-1']),
  ];
  const clearButton = captures[3].nodes[1];
  Object.assign(clearButton,{parentPath:'reader-source-filtered-empty',type:'Button',enabled:true,clickable:true});
  return {
    actions:{
      'edit-zero-match':action(35,'inputText',18),
      'clear-filters':{...action(52,'click'),afterSeq:56,from:'zero-match',targetId:'reader-source-clear-filters'},
    },
    samples:Object.fromEntries(captures.map(point => [point.sampleId,{
      ...point,afterSeq:point.beforeSeq+2,captureComplete:true,
    }])),
    events:[
      event(12,'source.route',{...owner,action:'open',from:'settings',to:'source'}),
      event(14,'source.projection',completeState),
      event(25,'source.projection',filtered),
      event(38,'source.projection',zero),
      event(54,'source.projection',cleared),
    ],
  };
}

function capturedCombinedResetFixture() {
  const list = 'reader-source-list';
  const row = 'reader-source-row-23';
  const editor = 'reader-source-editor';
  const clear = 'reader-source-clear-filters';
  const empty = 'reader-source-filtered-empty';
  const panel = 'reader-source-group-panel';
  const groupOption = 'reader-source-group-option-1';
  const selectionId = 'source-group:5';
  const backdrop = `reader-source-group-backdrop:${selectionId}`;
  const start = {...completeState,count:1007,projected:1007,firstAnchor:23};
  const unchecked = {...start,trigger:'status',status:'unchecked',filterRevision:2};
  const novel = {...unchecked,trigger:'category',category:'novel',projected:807,filterRevision:3};
  const grouped = {...novel,trigger:'group',allGroups:false,groupIndex:1,projected:142,filterRevision:4};
  const zero = {...grouped,trigger:'edit',queryLength:18,state:'filteredEmpty',projected:0,firstAnchor:0,filterRevision:5};
  const cleared = {...start,trigger:'clear',filterRevision:6};
  const captures = [
    sample('source-ready',17,[list,row]),
    sample('unchecked',27,['source-category-novel']),
    sample('novel',37,['reader-source-group-trigger']),
    sample('group-open',47,[panel,'reader-source-group-selected',groupOption,backdrop]),
    sample('combined-active',60,[list,row]),
    sample('source-ime',70,[editor],true),
    sample('filtered-ime',81,[editor],true),
    sample('zero-match',91,[editor,empty,clear]),
    sample('cleared',101,[list,row]),
  ];
  for (const point of captures) {
    Object.assign(point,{afterSeq:point.beforeSeq+2,captureComplete:!['unchecked','novel'].includes(point.sampleId)});
    if (!point.captureComplete) point.evidenceRefs = point.evidenceRefs.filter(reference=>reference.path.endsWith('.json'));
    point.window.source = 'window-metrics';
    const first = point.nodes.find(node=>node.id === row);
    if (first) Object.assign(first,{source:'native-tree',parentPath:list});
  }
  const group = captures[3];
  group.nodes.find(node=>node.id === groupOption).parentPath = panel;
  group.nodes.find(node=>node.id === backdrop).alias = 'reader-source-group-backdrop';
  addSourceActionBounds(captures[7],empty,clear);
  const dispatch = (beforeSeq,afterSeq,op,from,targetId,more = {}) =>
    ({...action(beforeSeq,op),afterSeq,from,targetId,outcomeSettled:true,...more});
  return {
    samples:Object.fromEntries(captures.map(point=>[point.sampleId,point])),
    actions:{
      'open-sources':dispatch(10,15,'click','settings','reader-settings-source-management'),
      'select-unchecked':dispatch(20,25,'click','source-ready','reader-source-status-unchecked'),
      'select-novel':dispatch(30,35,'click','unchecked','source-category-novel'),
      'open-group':dispatch(40,45,'click','novel','reader-source-group-trigger'),
      'select-group':dispatch(50,58,'click','group-open',groupOption),
      'focus-editor':dispatch(63,68,'click','combined-active',editor),
      'edit-zero-match':dispatch(74,79,'inputText','source-ime',editor,{inputRole:'zero-match',inputLength:18}),
      'ime-back':dispatch(84,89,'keyEvent','filtered-ime',undefined,{key:'Back'}),
      'clear-filters':dispatch(94,99,'click','zero-match',clear,{sourceCenterTap:{x:62,y:92,probeSeq:18}}),
    },
    events:[
      event(12,'source.route',{...owner,previousGeneration:owner.generation-1,action:'open',from:'settings',to:'source'}),
      event(14,'source.projection',start),
      event(23,'source.projection',unchecked),
      event(33,'source.projection',novel),
      event(43,'source.overlay',{owner,overlay:'group',phase:'open',selectionId}),
      event(53,'source.projection',grouped),
      event(57,'source.overlay',{owner,overlay:'group',phase:'dismiss',selectionId}),
      event(77,'source.projection',zero),
      event(97,'source.projection',cleared),
    ],
  };
}

test('source filter selection requires the expected native radio selection', () => {
  const contract = read('../cases/source-management.filter-selections.json');
  const assertion = contract.assertions.find(item => item.id === 'source.filter.status.enabled');
  const observed = {...assertion,acceptedSources:assertion.sources,expected:{...assertion.expected,nativeSelection:true}};
  const targetId = 'reader-source-status-enabled';
  const oldId = 'reader-source-status-all';
  const frame = '[0,0][360,800]';
  const bounds = {top:0,left:0,width:360,height:800};
  const rawNode = (id, rect, type, children = [], attrs = {}) => ({
    attributes:{id,bounds:rect,origBounds:rect,type,visible:'true',enabled:'true',opacity:'1',
      clickable:type === 'Button' ? 'true' : 'false',hostWindowId:'1',...attrs},children,
  });
  const radio = (id, box, selected) => rawNode(id,box,'Row',[
    rawNode(null,box,'Button',[],selected === null ? {} : {selected:String(selected)}),
  ]);
  const captureRadio = (sampleId,beforeSeq,targetSelected,oldSelected) => {
    const lane = rawNode('reader-source-status-filter','[0,250][350,298]','Scroll',[
      radio(oldId,'[10,250][84,298]',oldSelected),
      radio(targetId,'[92,250][166,298]',targetSelected),
    ]);
    const root = rawNode(null,frame,'root',[lane],{
      bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index',
    });
    const content = normalizeHarmonyLayout({
      tree:rawNode(null,frame,'Stack',[root]),sampleId,instanceId,windowId:'1',evidenceRefs:capture(sampleId),
      report:{vpPixels:1,windowId:'1',metrics:{ready:true,revision:14,windowRect:bounds,globalRect:bounds,densityPixels:1,
        keyboardArea:{available:true,visible:false,rects:[]},keyboardInsets:{left:0,top:0,right:0,bottom:0}}},
    });
    return {...content,beforeSeq,afterSeq:beforeSeq+2,captureComplete:true};
  };
  const accepted = {...completeState,trigger:'status',status:'enabled',filterRevision:2,projected:4};
  const makeContext = (targetSelected,oldSelected) => ({
    samples:{
      'source-ready':captureRadio('source-ready',15,false,true),
      enabled:captureRadio('enabled',28,targetSelected,oldSelected),
    },
    actions:{'select-enabled':{...action(20,'click'),afterSeq:24,from:'source-ready',targetId}},
    events:[event(12,'source.projection',completeState),event(22,'source.projection',accepted)],
  });
  const evaluateRadio = (targetSelected,oldSelected) => evaluateSource(observed,makeContext(targetSelected,oldSelected));
  assert.equal(evaluateRadio(false,false).verdict,'FAIL','an owner commit cannot substitute for an unselected native target');
  assert.equal(evaluateRadio(true,false).verdict,'PASS');
  assert.equal(evaluateRadio(true,true).verdict,'FAIL','another visible radio in the same lane is still selected');
  assert.equal(evaluateRadio(null,false).verdict,'NOT_RUN','unavailable native selection is missing evidence');
  assert.equal(evaluateRadio(true,null).verdict,'NOT_RUN','the visible peer needs a trustworthy state');
  const wrongBusiness = makeContext(null,false);
  wrongBusiness.events[1] = event(22,'source.projection',{...accepted,status:'error'});
  assert.equal(evaluateSource(observed,wrongBusiness).verdict,'FAIL','an observed invalid owner commit retains its failure');
  const legacy = {...assertion,expected:{trigger:'status',field:'status',value:'enabled'},acceptedSources:assertion.sources};
  assert.equal(evaluateSource(legacy,makeContext(false,false)).verdict,'PASS');
  const required = contract.assertions.filter(item=>item.kind==='filter-selection' && ['status','category'].includes(item.expected.trigger));
  assert.equal(required.length,4);
  assert.ok(required.every(item=>item.expected.nativeSelection===true));
});

test('source owner filters and clears in one settled page', () => {
  const context = evaluationFixture();
  const empty = evaluate('source.filteredEmpty',context);
  const clear = evaluate('source.clearFilters',context);
  assert.equal(empty.verdict,'PASS');
  assert.equal(empty.actual.sampleId,'zero-match');
  assert.equal(clear.verdict,'PASS');
  assert.equal(clear.actual.sampleId,'cleared');
  assert.ok(clear.evidenceRefs.some(item => item.path === 'raw/cleared.png'));
});

test('source evidence rejects stale owner, load, absent reset, and clipped native control', () => {
  const context = evaluationFixture();
  context.events[2] = event(21,'source.projection',{...miss,owner:{...owner,generation:owner.generation+1}});
  assert.equal(evaluate('source.filteredEmpty',context).verdict,'FAIL');
  context.events[2] = event(21,'source.projection',{...miss,state:'loading',readFact:'loading'});
  assert.equal(evaluate('source.filteredEmpty',context).verdict,'FAIL');
  context.events[2] = event(21,'source.projection',miss);
  context.events.pop();
  assert.equal(evaluate('source.clearFilters',context).verdict,'NOT_RUN');
  context.samples['zero-match'].nodes[1].visibleRectPx = {left:10,top:14,width:19,height:21};
  assert.equal(evaluate('source.filteredEmpty',context).verdict,'FAIL');
});

test('source combined filter reset adds native dimensions alongside exact owner acceptance', () => {
  const geometry = combinedResetContract.assertions.find(item => item.id === 'source.e2.clear-filter-target');
  assert.equal(geometry.required,true);
  const reset = legacyCombinedReset;
  const context = combinedResetFixture();
  const before = context.samples['zero-match'];
  const target = 'reader-source-clear-filters';
  addSourceActionBounds(before,'reader-source-filtered-empty',target);
  context.actions['open-sources'] = {...action(10,'click'),targetId:'reader-settings-source-management',afterSeq:15};
  context.actions['clear-filters'].sourceCenterTap = {x:62,y:92,probeSeq:18};
  context.events[0].payload.previousGeneration = owner.generation-1;
  const assess = assertion => evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  assert.equal(assess(geometry).actual.sampleId,'zero-match');
  const accepted = assess(reset);
  assert.equal(accepted.verdict,'PASS');
  assert.equal(accepted.actual.nativeInteraction.subject,'filter-empty-clear');
  const button = before.nodes.find(point => point.id === target);
  button.rectPx = {...button.rectPx,height:40};
  button.visibleRectPx = button.rectPx;
  assert.equal(assess(geometry).verdict,'FAIL');
  assert.equal(assess(reset).verdict,'PASS');
  assert.equal(assess(reset).actual.nativeInteraction,undefined);
});

test('source combined filter reset requires all four active filters before native clear', () => {
  const assertion = legacyCombinedReset;
  const empty = combinedResetContract.assertions.find(item => item.id === 'source.filteredEmpty');
  const evaluateCombined = context => evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  assert.equal(evaluate('source.clearFilters',evaluationFixture()).verdict,'PASS','legacy query-only scope still passes');
  const valid = combinedResetFixture();
  const result = evaluateCombined(valid);
  assert.equal(result.verdict,'PASS');
  assert.equal(evaluateSource({...empty,acceptedSources:empty.sources},valid).verdict,'PASS');
  assert.ok(result.evidenceRefs.some(item => item.path === 'raw/combined-active.json'));

  for (const inactive of [
    {status:'all'}, {category:'all'}, {groupIndex:0,allGroups:true}, {queryLength:0},
    {status:'all',category:'all',groupIndex:0,allGroups:true},
  ]) {
    const context = combinedResetFixture();
    Object.assign(context.events[3].payload,inactive);
    assert.equal(evaluateCombined(context).verdict,'FAIL',JSON.stringify(inactive));
  }
  for (const retained of [
    {status:'unchecked'}, {category:'novel'}, {groupIndex:1,allGroups:false}, {queryLength:18},
    {owner:{...owner,generation:owner.generation+1}}, {filterRevision:5}, {firstAnchor:9},
  ]) {
    const context = combinedResetFixture();
    Object.assign(context.events[4].payload,retained);
    assert.equal(evaluateCombined(context).verdict,'FAIL',JSON.stringify(retained));
  }
  const noClear = combinedResetFixture();
  noClear.events.pop();
  noClear.samples.cleared.nodes = noClear.samples['zero-match'].nodes;
  assert.equal(evaluateCombined(noClear).verdict,'FAIL','same current surface remains after the real button dispatch');
  const wrapper = combinedResetFixture();
  wrapper.samples['zero-match'].nodes[1].type = 'Column';
  assert.equal(evaluateCombined(wrapper).verdict,'FAIL','an ID-bearing wrapper cannot stand in for the native clear button');
  const missingCapture = combinedResetFixture();
  missingCapture.samples['combined-active'].captureComplete = false;
  assert.equal(evaluateCombined(missingCapture).verdict,'NOT_RUN');
});

test('source combined filter reset v3 gates every next input on the captured current catalogue', () => {
  const gate = (context,id) => {
    const step = combinedResetContract.steps.find(item=>item.id === id);
    const eventSeq = context.actions[id].beforeSeq;
    assertCombinedFilterResetAction(combinedResetContract,step,{
      ...context,events:context.events.filter(event=>event.eventSeq <= eventSeq),
    },{instanceId,eventSeq});
  };
  const context = capturedCombinedResetFixture();
  for (const id of Object.keys(context.actions)) assert.doesNotThrow(()=>gate(context,id));
  const missingRow = capturedCombinedResetFixture();
  missingRow.samples['source-ready'].nodes[1].parentPath = null;
  assert.throws(()=>gate(missingRow,'select-unchecked'),/exact native first row/u);
  const changedDefault = capturedCombinedResetFixture();
  changedDefault.events[1].payload.status = 'error';
  assert.throws(()=>gate(changedDefault,'select-unchecked'),/default Source catalogue/u);
  const drift = capturedCombinedResetFixture();
  drift.events.splice(3,0,event(28,'source.projection',{...drift.events[2].payload,readGeneration:10}));
  assert.throws(()=>gate(drift,'select-novel'),/catalogue or native group scope changed/u);
  const wrongSelection = capturedCombinedResetFixture();
  wrongSelection.samples['group-open'].nodes.find(node=>node.alias === 'reader-source-group-backdrop').id += '1';
  assert.throws(()=>gate(wrongSelection,'select-group'),/catalogue or native group scope changed/u);
});

test('source combined filter reset v3 proves individual commits, IME Back and one measured restoration', () => {
  const assess = context => evaluateSource({...combinedResetAssertion,acceptedSources:combinedResetAssertion.sources},context);
  const valid = assess(capturedCombinedResetFixture());
  assert.equal(valid.verdict,'PASS',valid.reason);
  assert.deepEqual(valid.actual.completed.map(point=>point.projected),[1007,807,142,0,0]);
  assert.equal(valid.actual.after.firstAnchor,23);
  assert.equal(valid.actual.nativeInteraction.subject,'filter-empty-clear');
  for (const [change,reason] of [
    [context=>context.events.splice(3,0,event(26,'source.projection',context.events[2].payload)), /one matching.*select-unchecked/u],
    [context=>context.events[3].payload.status = 'all', /one matching.*select-novel/u],
    [context=>context.events[5].payload.projected = 808, /one matching.*select-group/u],
    [context=>context.events[6].payload.selectionId = 'source-group:7', /own Source group opening/u],
    [context=>context.actions['edit-zero-match'].inputLength = 17, /one matching.*edit-zero-match/u],
    [context=>context.samples['zero-match'].window.keyboard.visible = true, /Back did not exclusively hide/u],
    [context=>context.events.splice(8,0,event(86,'source.route',{...owner,action:'back',from:'source',to:'settings'})),
      /Back left the Source opening/u],
    [context=>context.actions['clear-filters'].sourceCenterTap.x += 1, /restore the captured catalogue/u],
    [context=>context.events.push(event(100,'source.projection',context.events.at(-1).payload)), /exactly once/u],
    [context=>context.events.at(-1).payload.firstAnchor += 1, /restore the captured catalogue/u],
  ]) {
    const context = capturedCombinedResetFixture();
    change(context);
    const result = assess(context);
    assert.equal(result.verdict,'FAIL',result.reason);
    assert.match(result.reason,reason);
  }
});

test('source combined filter retains the other active filters and cannot widen the same catalog', () => {
  const selections = read('../cases/source-management.filter-selections.json');
  const assertion = selections.assertions.find(value => value.id === 'source.filter.group');
  const before = {...completeState,status:'error',category:'external',projected:3,filterRevision:9};
  const after = {...before,trigger:'group',allGroups:false,groupIndex:1,projected:1,filterRevision:10};
  const context = {
    actions:{'select-group':action(20,'click')},
    samples:{'group-options':sample('group-options',19,['reader-source-group-panel']),
      'group-selected':sample('group-selected',30,['reader-source-back','reader-source-stats'])},
    events:[event(12,'source.projection',before), event(21,'source.projection',after)],
  };
  const evaluateGroup = () => evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  assert.equal(evaluateGroup().verdict,'PASS');

  context.events[1] = event(21,'source.projection',{...after,status:'all'});
  const lostStatus = evaluateGroup();
  assert.equal(lostStatus.verdict,'FAIL');
  assert.deepEqual(lostStatus.actual.changedOtherFilters,['status']);

  context.events[1] = event(21,'source.projection',{...after,projected:4});
  assert.equal(evaluateGroup().verdict,'FAIL');
  context.events[1] = event(21,'source.projection',{...after,count:19,readGeneration:10});
  assert.equal(evaluateGroup().verdict,'NOT_RUN');

  context.events[1] = event(21,'source.projection',after);
  context.events.push(event(24,'source.projection',after));
  assert.equal(evaluateGroup().verdict,'FAIL');
});

test('source group Back requires the observed opening and leaves the same source owner mounted', () => {
  const selections = read('../cases/source-management.filter-selections.json');
  const assertion = selections.assertions.find(value => value.id === 'source.overlay.group-back');
  const opened = sample('group-open',16,['reader-source-back','reader-source-group-panel']);
  const closed = sample('group-back',28,['reader-source-back']);
  const key = {...action(20,'keyEvent'), afterSeq:25, key:'Back', from:'group-open'};
  const groupEvent = (seq, phase, opening = owner) =>
    event(seq,'source.overlay',{owner:opening,phase,overlay:'group'});
  const stale = {...owner,generation:owner.generation - 1};
  const run = ({back = key, after = closed, trace = [groupEvent(22,'back'),groupEvent(24,'dismiss')]} = {}) =>
    evaluateSource({...assertion, acceptedSources:assertion.sources},{
      actions:{'back-group':back}, samples:{'group-open':{...opened,afterSeq:18},'group-back':after},
      events:[event(10,'source.projection',completeState),groupEvent(15,'open'), ...trace],
    }).verdict;
  assert.equal(run(),'PASS');
  assert.equal(run({back:{...key,key:'Enter'}}),'NOT_RUN');
  assert.equal(run({after:{...closed,evidenceRefs:[ref('raw/group-back.json')]}}),'NOT_RUN');
  assert.equal(run({trace:[groupEvent(24,'dismiss')]}),'NOT_RUN');
  assert.equal(run({trace:[groupEvent(22,'back',stale),groupEvent(24,'dismiss',stale)]}),'FAIL');
  assert.equal(run({trace:[groupEvent(22,'back'),groupEvent(23,'back'),groupEvent(24,'dismiss')]}),'FAIL');
  assert.equal(run({trace:[groupEvent(22,'back'),groupEvent(24,'dismiss'),
    event(26,'source.projection',{...completeState,owner:stale})]}),'FAIL');
  assert.equal(run({trace:[event(26,'source.route',{action:'back',from:'source',to:'settings'})]}),'FAIL');
  assert.equal(run({after:{...closed,nodes:opened.nodes}}),'FAIL');
});

test('source route from the no-source Search button returns only to its captured Search opening', () => {
  const definition = read('../cases/bookshelf.search-no-sources-management-return.json');
  const src = 'source-ready', restored = 'search-returned';
  const initial = {action:'open',from:'search',to:'source',...owner,previousGeneration:16};
  const closed = {action:'close',from:'source',to:'search',...owner,generation:18,previousGeneration:17};
  const context = {
    actions:{
      'manage-sources':{...action(10,'click'),afterSeq:13,targetId:'reader-search-source-recovery-primary'},
      'back-to-search':{...action(21,'keyEvent'),afterSeq:23,key:'Back',from:src},
    },
    samples:{
      [src]:{...sample(src,16,['reader-source-back','reader-source-empty-state']),afterSeq:17},
      [restored]:{...sample(restored,28,['reader-book-search-input']),afterSeq:29},
    },
    events:[
      event(12,'source.route',initial),
      event(15,'source.projection',{...completeState,state:'empty',count:0,projected:0,firstAnchor:0}),
      event(22,'source.route',closed),
    ],
  };
  const route = (id, extra = context) => {
    const assertion = definition.assertions.find(value => value.id === id);
    return evaluateSource({...assertion,acceptedSources:assertion.sources},extra);
  };
  assert.equal(route('source.route.search-management').verdict,'PASS');
  assert.equal(route('source.route.restore-search').verdict,'PASS');
  const changed = payload => ({...context,events:[...context.events.slice(0,2),event(22,'source.route',payload)]});
  assert.equal(route('source.route.restore-search',changed({...closed,to:'settings'})).verdict,'FAIL');
  assert.equal(route('source.route.restore-search',changed({...closed,previousGeneration:16})).verdict,'FAIL');
  assert.equal(route('source.route.search-management',{...context,
    events:[...context.events,event(13,'source.route',initial)]}).verdict,'FAIL');
  assert.equal(route('source.route.restore-search',{...context,samples:{...context.samples,
    [restored]:{...context.samples[restored],evidenceRefs:[]}}}).verdict,'NOT_RUN');
});

function temporaryBackFixture() {
  const definition = read('../cases/source-management.temporary-back-return.json');
  const editor = ['reader-source-back','reader-source-editor'];
  const settings = ['reader-settings-source-management'];
  const windowSample = (id, seq, nodes, keyboard = false) => ({
    ...sample(id,seq,nodes,keyboard), afterSeq:seq+1,
  });
  const key = (beforeSeq, from) => ({
    ...action(beforeSeq,'keyEvent'), afterSeq:beforeSeq+3, key:'Back', from,
  });
  const entry = event(12,'source.route',{action:'open',from:'settings',to:'source',
    ...owner,previousGeneration:owner.generation-1});
  const exit = event(60,'source.route',{action:'close',from:'source',to:'settings',
    ...owner,generation:owner.generation+1,previousGeneration:owner.generation});
  const context = {
    actions:{
      'open-sources':action(10,'click'),
      'ime-back':key(28,'source-ime'),
      'back-group':key(48,'group-open'),
      'return-settings':key(58,'group-back'),
    },
    samples:{
      'source-ready':windowSample('source-ready',16,editor),
      'source-ime':windowSample('source-ime',24,editor,true),
      'ime-hidden':windowSample('ime-hidden',34,editor),
      'group-open':windowSample('group-open',44,[...editor,'reader-source-group-panel']),
      'group-back':windowSample('group-back',54,editor),
      'settings-return':windowSample('settings-return',64,settings),
    },
    events:[
      entry, event(14,'source.projection',completeState),
      event(40,'source.overlay',{overlay:'group',phase:'open',owner}),
      event(49,'source.overlay',{overlay:'group',phase:'back',owner}),
      event(50,'source.overlay',{overlay:'group',phase:'dismiss',owner}), exit,
    ],
  };
  return {definition,context};
}

test('source temporary Back path exits only the opening whose IME and group Back were observed', () => {
  const {definition,context:base} = temporaryBackFixture();
  const ime = 'source.overlay.ime-back';
  const route = 'source.route.settings-return';
  const verdict = (id, change = () => {}) => {
    const assertion = definition.assertions.find(assertion => assertion.id === id);
    const context = structuredClone(base);
    change(context);
    return evaluateSource({...assertion, acceptedSources:assertion.sources},context).verdict;
  };
  for (const {id} of definition.assertions) assert.equal(verdict(id),'PASS',id);
  assert.equal(verdict(ime, context => { context.actions['ime-back'].key = 'Enter'; }),'NOT_RUN');
  assert.equal(verdict(ime, context => {
    context.events.splice(2,0,event(29,'source.overlay',{overlay:'ime',phase:'back',
      owner:{...owner,generation:owner.generation-1}}));
  }),'FAIL');
  assert.equal(verdict(route, context => { context.actions['return-settings'].from = 'source-ready'; }),'NOT_RUN');
  assert.equal(verdict(route, context => { context.samples['settings-return'].evidenceRefs.shift(); }),'NOT_RUN');
  assert.equal(verdict(route, context => {
    context.events.at(-1).payload.previousGeneration -= 1;
  }),'FAIL');
  assert.equal(verdict(route, context => {
    context.events.splice(5,0,event(52,'source.route',{...context.events[0].payload,generation:owner.generation+1}));
  }),'FAIL');
  assert.equal(verdict(route, context => {
    context.events.pop();
    context.samples['settings-return'].nodes = context.samples['source-ready'].nodes;
  }),'FAIL');
  assert.equal(verdict(route, context => { context.events.pop(); }),'NOT_RUN');
});

test('source read surfaces distinguish current owner, transient loading and receipt recovery', () => {
  const check = (name, projections, modify = () => {}) => {
    const definition = read(`../cases/source-management.${name}.json`);
    const [assertion] = definition.assertions;
    // The frozen v1 read-loading evaluator continues to use an in-state HDC sample.
    if (name === 'read-loading') delete assertion.expected.nativeFrame;
    const entry = event(12,'source.route',{action:'open',from:'settings',to:'source',
      ...owner,previousGeneration:owner.generation-1});
    const context = {
      actions:{'open-sources':{...action(10,'click'), targetId:'reader-settings-source-management', afterSeq:15}},
      samples:{'source-read':{...sample('source-read',25,['reader-source-back']),captureComplete:true}},
      events:[entry,...projections.map((payload,index) => event(16+index,'source.projection',payload))],
    };
    modify(context);
    const result = evaluateSource({...assertion, acceptedSources:assertion.sources},context);
    return [result.verdict,conditionApplicability(assertion,context,result,definition).status];
  };
  const loading = {...completeState,state:'loading',readFact:'loading'};
  const coldFailure = {...completeState,state:'readFailure',readFact:'failed',count:0,projected:0};
  const recovery = {...completeState,state:'recovery',readFact:'current'};
  assert.deepEqual(check('read-loading',[loading]),['PASS','APPLIES']);
  assert.deepEqual(check('read-loading',[loading,completeState]),['NOT_RUN','APPLIES']);
  assert.deepEqual(check('read-loading',[completeState]),['NOT_RUN','DOES_NOT_APPLY']);
  assert.deepEqual(check('read-loading',[{...loading,owner:{...owner,generation:owner.generation-1}}]),['NOT_RUN','UNKNOWN']);
  assert.deepEqual(check('read-failure',[coldFailure]),['PASS','APPLIES']);
  assert.deepEqual(check('read-failure',[{...coldFailure,readFact:'current'}]),['FAIL','APPLIES']);
  assert.deepEqual(check('read-failure',[{...coldFailure,count:12}]),['FAIL','APPLIES']);
  assert.deepEqual(check('pending-recovery',[recovery]),['PASS','APPLIES']);
  assert.deepEqual(check('pending-recovery',[{...completeState,readFact:'pendingReconciliation'}]),['NOT_RUN','DOES_NOT_APPLY']);
  assert.deepEqual(check('pending-recovery',[recovery],context => { delete context.samples['source-read']; }),['NOT_RUN','UNKNOWN']);
  assert.deepEqual(check('pending-recovery',[recovery],context => { context.samples['source-read'].captureComplete = false; }),
    ['NOT_RUN','APPLIES']);
});

test('source read retry requires a causal native click, a new read and its matching terminal surface', () => {
  const definition = read('../cases/source-management.read-retry.json');
  const assertion = definition.assertions.find(value => value.kind === 'read-retry');
  const retryTarget = 'reader-source-read-retry';
  const sourceList = 'reader-source-list';
  function fixture(state = 'rows', fact = 'current') {
    const failure = {...completeState,state:'readFailure',readFact:'failed',count:0,projected:0,firstAnchor:0};
    const after = {...completeState,state,readFact:fact,readGeneration:14,
      count:state === 'rows' ? 18 : 0,projected:state === 'rows' ? 18 : 0,firstAnchor:state === 'rows' ? 1 : 0};
    function nativeSample(id, seq) {
      const value = {...sample(id,seq,[sourceList,'reader-source-empty-state']),captureComplete:true,afterSeq:seq+1};
      if (id === 'source-read' || state === 'readFailure') {
        for (const child of [retryTarget,'reader-source-read-failure-title']) {
          value.nodes.push({...makeNode(child),parentPath:'reader-source-empty-state',enabled:true,clickable:true});
        }
        addSourceActionBounds(value,'reader-source-empty-state',retryTarget);
      } else if (state === 'rows') {
        value.nodes.push({...makeNode('reader-source-row-1'),parentPath:sourceList});
      } else {
        value.nodes.push({...makeNode('reader-source-empty-library-title'),parentPath:'reader-source-empty-state'});
      }
      return value;
    }
    return {
      actions:{
        'open-sources':{...action(10,'click'),targetId:'reader-settings-source-management',afterSeq:15},
        'retry-read':{...action(33,'click'),targetId:retryTarget,from:'source-read',afterSeq:35,
          sourceCenterTap:{x:62,y:92,probeSeq:12}},
      },
      samples:{'source-read':nativeSample('source-read',30),'retry-settled':nativeSample('retry-settled',42)},
      events:[
        event(12,'source.route',{...owner,previousGeneration:owner.generation-1,action:'open',from:'settings',to:'source'}),
        event(20,'source.projection',failure),
        event(34,'source.read-retry',{phase:'started',failedReadGeneration:9,startedReadGeneration:12,
          readGeneration:12,readFact:'loading',count:0}),
        event(36,'source.projection',{...failure,state:'empty',readGeneration:12,readFact:'loading'}),
        event(38,'source.read-retry',{phase:'settled',failedReadGeneration:9,startedReadGeneration:12,
          readGeneration:14,readFact:fact,count:after.count}),
        event(39,'source.projection',after),
      ],
    };
  }
  const check = context => {
    const result = evaluateSource({...assertion,acceptedSources:assertion.sources},context);
    const condition = conditionApplicability(assertion,context,result,definition);
    return [result.verdict,condition.status,condition.sampleApplies];
  };
  for (const [state, fact] of [['rows','current'],['empty','current'],['readFailure','failed']]) {
    assert.deepEqual(check(fixture(state,fact)),['PASS','APPLIES',true]);
  }
  const observed = evaluateSource({...assertion,acceptedSources:assertion.sources},fixture());
  assert.equal(observed.actual.nativeInteraction.subject,'empty-read-retry');
  assert.equal(observed.actual.nativeInteraction.baselineSampleId,'source-read');
  for (const removeProof of [
    context => { context.events.splice(4,1); },
    context => { context.events[4].payload.startedReadGeneration = 13; },
    context => { context.events[5].payload.owner = {...owner,generation:owner.generation+1}; },
    context => { context.events[5].payload.readGeneration = 9; },
    context => { context.events.push(event(40,'source.route',{...owner,action:'close'})); },
    context => { context.actions['retry-read'].targetId = 'reader-unrelated'; },
    context => { context.samples['retry-settled'].captureComplete = false; },
  ]) {
    const context = fixture();
    removeProof(context);
    assert.deepEqual(check(context),['NOT_RUN','APPLIES',false]);
  }
  const wrongSurface = fixture('empty');
  wrongSurface.samples['retry-settled'].nodes.pop();
  assert.deepEqual(check(wrongSurface),['FAIL','APPLIES',true]);
  const noFailure = fixture();
  noFailure.events[1].payload = completeState;
  delete noFailure.actions['retry-read'];
  delete noFailure.samples['retry-settled'];
  assert.deepEqual(check(noFailure),['NOT_RUN','DOES_NOT_APPLY',undefined]);
  const undersized = fixture();
  const before = undersized.samples['source-read'];
  const retry = before.nodes.find(node => node.id === retryTarget);
  retry.rectPx = {...retry.rectPx,height:40};
  retry.visibleRectPx = retry.rectPx;
  delete undersized.actions['retry-read'];
  delete undersized.samples['retry-settled'];
  assert.deepEqual(check(undersized),['FAIL','APPLIES',false]);
  const measuredFailure = evaluateSource({...assertion,acceptedSources:assertion.sources},undersized);
  assert.equal(measuredFailure.observationsComplete,false);
  assert.equal(measuredFailure.actual.nativeTouchTarget.heightVp,40);
  const missingDimensions = fixture();
  delete missingDimensions.samples['source-read'].nodes.find(node => node.id === retryTarget).rectPx;
  assert.deepEqual(check(missingDimensions),['NOT_RUN','APPLIES',true]);

  const edgeCase = read('../cases/source-management.read-retry-edge.json');
  const edge = edgeCase.assertions.find(item=>item.kind === 'read-retry');
  const edgeStep = edgeCase.steps.find(step=>step.id === edge.action);
  assert.deepEqual(sourceReadRetryTouchAssertion(edgeCase,edge),{subject:'empty-read-retry',target:retryTarget,position:'top'});
  const edgeContext = fixture();
  const edgeBaseline = edgeContext.samples[edge.baseline];
  edgeContext.samples[edge.sample].window = {...edgeBaseline.window};
  const op = requestedOperation(edgeStep,edgeContext.samples,edgeCase.fixture);
  assert.deepEqual(op,{op:'click',x:62,y:71});
  const logged = requireActionDispatch([{event:'command',ok:true,seq:1,args:['shell','uitest','uiInput','click','62','71']}],1,op);
  edgeContext.actions[edge.action] = {...edgeContext.actions['retry-read'],sourceReadRetryTap:{x:op.x,y:op.y,probeSeq:logged.seq}};
  delete edgeContext.actions['retry-read'];
  const readEdge = () => evaluateSource({...edge,acceptedSources:edge.sources},edgeContext);
  const edgeResult = readEdge();
  assert.equal(edgeResult.verdict,'PASS',edgeResult.reason);
  assert.equal(edgeResult.actual.nativeInteraction.position,'top');
  assert.equal(conditionApplicability(edge,edgeContext,edgeResult,edgeCase).sampleApplies,true);
  edgeContext.actions[edge.action].sourceReadRetryTap.y++;
  assert.equal(readEdge().verdict,'NOT_RUN');
  assert.equal(conditionApplicability(edge,edgeContext,readEdge(),edgeCase).sampleApplies,false);
});

test('source retry owner emits only the admitted read generation and its own terminal outcome', async () => {
  const {selectedProductionMethods} = await import('../../lib/selected-production-methods.mjs');
  const {projectOperationFacts} = await import('../../../entry/src/main/ets/app/ReaderOperationFacts.ts');
  const {sourceVerificationOpening,sourceVerificationRecoveryControl} =
    await import('../../../entry/src/main/ets/features/source/ui/SourceManagementVerification.ts');
  const production = new URL('../../../entry/src/main/ets/features/source/application/SourceOrchestrator.ets',import.meta.url);
  function fixture(load) {
    const events = [];
    const Source = selectedProductionMethods(production,'SourceOrchestrator',
      ['reconcile','observeRecoveryControl','observeReadRetry','publishRead','loadList','isCurrentSession','publishStatus'], {
        ReaderRuntimeOwner:{isCurrent:() => true}, sourceProjectionGeneration:10,projectOperationFacts,DOMAIN:0,
        sourceVerificationOpening,sourceVerificationRecoveryControl,
        hilog:{error() {}}, ReaderUIVerificationProbe:{enabled:() => true,emit:(...event) => events.push(event)},
      });
    const owner = Object.assign(new Source(),{
      session:7, presentationIdentity:'opening', isCurrent:() => true, operationChain:Promise.resolve(), sources:[],
      latestProjection:{action:'load',sourceId:'',readFacts:projectOperationFacts({phase:'failed',canRetry:true,generation:10})},
      gateway:{originalMutationSnapshot:() => undefined}, emitProjection() {}, emitStatus() {}, async recoverOriginal() {},
      loadSourcesWithRetry: load, presentSources(sources) { this.sources = sources; },
    });
    return {owner,events};
  }
  for (const fact of ['current','failed']) {
    let calls = 0;
    const {owner,events} = fixture(async () => {
      calls++;
      if (fact === 'failed') throw new Error('Controlled read failure');
      return [{sourceId:'fixture'}];
    });
    owner.reconcile(9);
    await owner.operationChain;
    assert.deepEqual(events,[]);
    assert.equal(calls,0);
    owner.reconcile(10);
    await owner.operationChain;
    assert.equal(calls,1);
    assert.deepEqual(events,[
      ['source.read-retry','business',{phase:'started',failedReadGeneration:10,startedReadGeneration:11,
        readGeneration:11,readFact:'loading',count:0}],
      ['source.read-retry','business',{phase:'settled',failedReadGeneration:10,startedReadGeneration:11,
        readGeneration:12,readFact:fact,count:fact === 'current' ? 1 : 0}],
    ]);
  }
  let admit;
  const loading = new Promise(resolve => { admit = resolve; });
  let release;
  const {owner,events} = fixture(() => {
    admit();
    return new Promise(resolve => { release = resolve; });
  });
  owner.reconcile(10);
  await loading;
  owner.session++;
  release([]);
  await owner.operationChain;
  assert.deepEqual(events.map(([, , value]) => value.phase),['started']);
});

test('source toggle owner binds only the public fixture intent to its fresh confirmed readback', async () => {
  const {registerHooks} = await import('node:module');
  const {selectedProductionMethods} = await import('../../lib/selected-production-methods.mjs');
  const {ReaderWriteEvidence} = await import('../../../entry/src/main/ets/app/ReaderWriteEvidence.ts');
  const {projectSourceV9Check} = await import('../../../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts');
  const verification = await import('../../../entry/src/main/ets/features/source/ui/SourceManagementVerification.ts');
  const receiptModule = new URL('../../../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts',import.meta.url);
  const hook = registerHooks({resolve(specifier, context, next) {
    if (specifier === './ReaderOperationFacts' && context.parentURL === receiptModule.href) {
      return next(new URL('./ReaderOperationFacts.ts',receiptModule).href,context);
    }
    return next(specifier,context);
  }});
  let projectPersistedReceipt;
  try { ({projectPersistedReceipt} = await import(receiptModule.href)); }
  finally { hook.deregister(); }

  const production = new URL('../../../entry/src/main/ets/features/source/application/SourceOrchestrator.ets',import.meta.url);
  const entry = read('../fixtures/Reader Phase 1 public sources.json')[0];
  const publicSource = {sourceId:entry.bookSourceUrl,baseUrl:entry.bookSourceUrl,name:entry.bookSourceName,
    group:entry.bookSourceGroup,category:'novel',enabled:entry.enabled,enabledExplore:entry.enabledExplore};
  const anchor = verification.sourceVerificationToggleAnchor(publicSource);
  assert.ok(anchor > 0);
  function fixture({source = publicSource, write = 'confirmed', readback} = {}) {
    const events = [];
    const counts = {writes:0,reads:0};
    let observedWrite;
    const Source = selectedProductionMethods(production,'SourceOrchestrator',
      ['toggleSource','observeToggleAdmission','applyToggle','publishToggleReceipt','publishReceipt','publishStatus',
        'isCurrentSession','originalBlocked','updateSourceWithRetry','presentSources','sourceCheckSignature'], {
        ...verification, ReaderWriteEvidence, projectPersistedReceipt, projectSourceV9Check,
        ReaderRuntimeOwner:{isCurrent:() => true},
        sourceProjectionGeneration:10,isPendingTransactionError:() => false,DOMAIN:0,hilog:{error() {},warn() {}},
        ReaderUIVerificationProbe:{enabled:() => true,emit:(kind, channel, payload) => {
          assert.equal(kind,'source.toggle');
          assert.equal(channel,'business');
          events.push(payload);
        }},
      });
    const current = Object.assign(new Source(),{
      session:7,presentationIdentity:JSON.stringify(['fixture-route',owner.mounting,owner.generation,'source']),
      isCurrent:() => true,toggleSeq:0,operationChain:Promise.resolve(),sources:[source],hasRead:true,
      latestProjection:{action:'load',sourceId:''},checkingSourceIds:new Map(),checkResults:new Map(),
      reportClearTimes:new Map(),importedReports:new Map(),verifiedLoginSources:new Map(),deniedLoginReports:new Map(),
      emit() {},emitProjection() {},emitStatus() {},
      gateway:{
        observeWrites(next) { observedWrite = next; },
        originalMutationSnapshot:() => undefined,
        async updateSource(id, patch, isCurrent) {
          counts.writes++;
          assert.equal(id,source.sourceId);
          assert.deepEqual(patch,{enabled:true});
          assert.equal(isCurrent(),true);
          observedWrite.dispatched();
          if (write === 'unknown') throw new Error('Controlled missing ACK');
          observedWrite.confirmed();
        },
        async loadSources(_group, _reports, isCurrent) {
          counts.reads++;
          assert.equal(isCurrent(),true);
          return readback ? readback() : [{...source,enabled:true}];
        },
      },
    });
    current.toggleSource(source.sourceId,true);
    return {current,events,counts};
  }

  const identity = {owner,anchor,toggleSeq:1,requestedEnabled:true};
  for (const [options, confirmation, readback, observedEnabled, reads] of [
    [{},'confirmed','succeeded',true,1],
    [{readback:() => [{...publicSource,enabled:false}]},'confirmed','succeeded',false,1],
    [{readback:() => []},'confirmed','succeeded',undefined,1],
    [{write:'unknown'},'unknown','failed',undefined,0],
    [{readback:() => { throw new Error('Controlled fresh-list failure'); }},'confirmed','failed',undefined,1],
  ]) {
    const {current,events,counts} = fixture(options);
    await current.operationChain;
    assert.deepEqual(counts,{writes:1,reads});
    assert.deepEqual(events,[{phase:'admitted',...identity},
      {phase:'settled',...identity,confirmation,readback,observedEnabled}]);
  }

  const unmanaged = fixture({source:{...publicSource,sourceId:'https://other-fixture.invalid/'}});
  await unmanaged.current.operationChain;
  assert.deepEqual(unmanaged.counts,{writes:1,reads:1});
  assert.deepEqual(unmanaged.events,[]);

  let startRead;
  let releaseRead;
  const reading = new Promise(resolve => { startRead = resolve; });
  const stale = fixture({readback:() => {
    startRead();
    return new Promise(resolve => { releaseRead = resolve; });
  }});
  await reading;
  stale.current.session++;
  releaseRead([{...publicSource,enabled:true}]);
  await stale.current.operationChain;
  assert.deepEqual(stale.events,[{phase:'admitted',...identity}]);
});

test('source group geometry measures the clipped paint node at the actual trigger', () => {
  const contract = read('../cases/source-management.filter-selections.json');
  const assertion = contract.assertions.find(value => value.id === 'source.layout.group-panel');
  const nativeNode = (id,type,path,left,top,width,height) => {
    const rect = {left,top,width,height};
    return {id,type,path,parentPath:path.slice(0,path.lastIndexOf('/')),rectPx:rect,visibleRectPx:rect,visible:true,opacity:1};
  };
  const before = sample('external',20,[]);
  const after = sample('group-open',35,[]);
  for (const value of [before,after]) {
    value.window = {...value.window,density:3.5,revision:1,source:'window-metrics',
      visibleRectPx:{left:0,top:0,width:1280,height:2832}};
    Object.assign(value,{afterSeq:value.beforeSeq+1,captureComplete:true});
  }
  const groupTrigger = 'reader-source-group-trigger';
  before.nodes = [nativeNode('reader-source-content','Column','0/1',0,136,1280,2696),
    nativeNode('reader-source-group-filter','Row','0/1/0',333,823,881,154),
    {...nativeNode(groupTrigger,'__Common__','0/1/0/0',333,823,881,154),enabled:true},
    {...nativeNode(null,'Button','0/1/0/0/0',333,823,881,154),enabled:true,clickable:true}];
  const wrapper = nativeNode('reader-source-group-panel',null,'0/2',0,136,1168,1155);
  wrapper.visibleRectPx = {...wrapper.rectPx,top:137,height:1154};
  const positioned = {...nativeNode(null,'Column','0/2/0',56,823,1168,1155),zIndex:10};
  const painted = {...nativeNode(null,'Column','0/2/0/0',56,823,1168,1155),zIndex:10,clip:true};
  const scroll = nativeNode(null,'Scroll','0/2/0/0/0',59,826,1162,1149);
  const selected = nativeNode(null,'Button','0/2/0/0/0/0/0',59,826,1162,154);
  selected.alias = 'reader-source-group-selected';
  after.nodes = [wrapper,positioned,painted,scroll,selected];
  const samples = {external:before,'group-open':after};
  const step = contract.steps.find(item=>item.id === assertion.action);
  const operation = requestedOperation(step,samples,contract.fixture);
  const dispatch = requireActionDispatch([{event:'command',ok:true,seq:1,
    args:['shell','uitest','uiInput','click','773','900']}],1,operation);
  const context = {actions:{'open-group':{...action(22,'click'),targetId:groupTrigger,from:'external',afterSeq:30,
    filterTouch:sourceFilterNativeDispatch(contract,step,operation,dispatch.seq)}},samples,events:[
    event(12,'source.geometry',{owner,groupHostLeftVp:0,groupHostRightVp:1280/3.5,groupHostTopVp:0,groupHostBottomVp:2598/3.5}),
    event(17,'source.projection',completeState),
    event(27,'source.overlay',{owner,phase:'open',overlay:'group',selectionId:'source-group:9'}),
  ]};
  const evaluateGroup = () => evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  const result = evaluateGroup();
  assert.equal(result.verdict,'PASS');
  assert.deepEqual(result.actual.panelVp,{left:16,top:687/3.5,width:1168/3.5,height:330});
  const proof = {subject:'group-trigger',target:groupTrigger,position:'center'};
  assert.deepEqual(sourceFilterNativeAssertion(contract,assertion),proof);
  assert.deepEqual(result.actual.nativeInteraction,{
    ...proof,carrierPath:'0/1/0/0/0',bounds:before.nodes[3].rectPx,visible:true,clipped:false,enabled:true,accepted:true,
    actionId:'open-group',baselineSampleId:'external',dispatch:{x:773,y:900,probeSeq:1},
  });

  context.events.push(event(28,'source.overlay',{owner,phase:'open',overlay:'group',selectionId:'source-group:10'}));
  assert.equal(evaluateGroup().verdict,'PASS');
  assert.equal(evaluateGroup().actual.nativeInteraction,undefined);
  context.events.pop();

  positioned.rectPx = positioned.visibleRectPx = {...positioned.rectPx,top:830};
  painted.rectPx = painted.visibleRectPx = {...painted.rectPx,top:830};
  assert.equal(evaluateGroup().verdict,'FAIL');
  after.nodes = [wrapper,positioned,scroll,selected];
  assert.equal(evaluateGroup().verdict,'NOT_RUN');
});

test('source font adaptation requires the current window and geometry owner to agree', () => {
  const contract = read('../cases/source-management.layout-font-intermediate.json');
  const assertion = contract.assertions.find(value => value.id === 'source.layout.font-intermediate');
  const ready = sample('source-ready',25,['reader-source-row-1','reader-source-footer','reader-source-footer-row']);
  ready.window = {...ready.window,density:3.5,revision:5,fontScale:1.3,rectPx:{width:1280}};
  for (const path of ['reader-source-row-1','reader-source-footer']) {
    for (const index of [0,1]) {
      const rect = {left:index * 155,top:0,width:154,height:154};
      ready.nodes.push({path:path + '/' + index,rectPx:rect,visibleRectPx:rect,visible:true,opacity:1,clickable:true,enabled:true});
    }
  }
  const geometry = {...event(10,'source.geometry',{owner,fontScale:1.3,footerStacked:false}),windowRevision:5};
  const context = {actions:{},samples:{'source-ready':ready},events:[geometry,event(13,'source.projection',completeState)]};
  const evaluateFont = () => evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  const measured = evaluateFont();
  assert.equal(measured.verdict,'PASS');
  assert.equal(measured.actual.sampleId,'source-ready');

  ready.window.fontScale = 1.45;
  assert.equal(evaluateFont().verdict,'NOT_RUN');
  ready.window.fontScale = 1.3;
  geometry.windowRevision = 4;
  assert.equal(evaluateFont().verdict,'NOT_RUN');
});

const scrollContract = read('../cases/source-management.scroll-return.json');

function scrollSample(id, seq, filterTop, lastRowBottom) {
  const nodes = [];
  function node(id, type, path, top, height) {
    const rect = {left:0,top,width:1280,height};
    nodes.push({id,type,path,rectPx:rect,visibleRectPx:rect,visible:true,opacity:1});
  }
  node('reader-source-list','List','0/0',136,2696);
  node('reader-native-slot:29','Column','0/1',136,203);
  node('reader-source-back','Button','0/1/0',161,154);
  node('reader-native-slot:28','Column','0/2',2524,308);
  node('reader-source-footer','Column','0/2/0',2524,308);
  if (filterTop !== undefined) node('reader-source-filter-block','Column','0/0/0',filterTop,855);
  if (lastRowBottom !== undefined) node('reader-source-row-14','Column','0/0/1',lastRowBottom - 266,266);
  return {...sample(id,seq,[]),window:{id:'1',revision:5,density:3.5,source:'window-metrics',keyboard:{visible:false}},nodes};
}

function scrollFixture() {
  const geometry = {owner,headerTopVp:0,headerHeightVp:58,footerTopVp:2388/3.5,
    footerHeightVp:88,listStartInsetVp:58,listEndInsetVp:88};
  const afterCategory = {...completeState,category:'novel',filterRevision:2,trigger:'category'};
  return {
    actions:{'scroll-shallow':{...action(12,'swipe'),from:'fixture-sources-ready',afterSeq:14,
      targetId:'reader-source-list',sourceListSwipe:{fromX:614,fromY:1214,toX:614,toY:998,velocity:200,probeSeq:31}},
    'select-novel':action(22,'click')},
    samples:{
      'fixture-sources-ready':{...scrollSample('fixture-sources-ready',10,339),afterSeq:11,captureComplete:true},
      shallow:{...scrollSample('shallow',20,140),afterSeq:21,captureComplete:true},
      'filter-reset':scrollSample('filter-reset',30,339),
      'list-tail':scrollSample('list-tail',50,undefined,2524),
    },
    events:[
      event(3,'source.geometry',geometry),
      event(4,'source.projection',completeState),
      event(15,'source.scroll',{owner,trigger:'settled',filterRevision:1,offsetVp:-4/3.5}),
      event(24,'source.projection',afterCategory),
      event(45,'source.scroll',{owner,trigger:'settled',filterRevision:2,atEnd:true,lastAnchor:14}),
    ],
  };
}

function evaluateScroll(id, context) {
  const assertion = scrollContract.assertions.find(item => item.id === id);
  return evaluateSource({...assertion,acceptedSources:assertion.sources},context);
}

test('S5 last row requires a fresh native List end and the row in that List', () => {
  const definition = scrollContract.assertions.find(item => item.id === 'source.layout.footer-last-row');
  const legacy = {...definition,acceptedSources:definition.sources,expected:{...definition.expected}};
  delete legacy.expected.requireFreshEnd;
  const assertion = {...legacy,expected:{...legacy.expected,requireFreshEnd:true}};
  function fixture(withFreshEnd = true) {
    const context = scrollFixture();
    context.actions['scroll-tail-3'] = {...action(46,'swipe'),from:'tail-2',targetId:'reader-source-list',
      afterSeq:47,hostBeginMs:46,hostEndMs:47};
    context.samples['tail-2'] = {...scrollSample('tail-2',45),afterSeq:46,hostBeginMs:44,hostEndMs:46,
      captureComplete:false,evidenceRefs:[ref('raw/tail-2.json')]};
    Object.assign(context.samples['list-tail'],{afterSeq:51,hostBeginMs:50,hostEndMs:51,captureComplete:true});
    for (const point of [context.samples['tail-2'],context.samples['list-tail']]) {
      const rect = {left:0,top:136,width:1280,height:2696};
      Object.assign(point.window,{rectPx:rect,visibleRectPx:rect,source:'window-metrics'});
      for (const node of point.nodes) Object.assign(node,{parentPath:node.path.slice(0,node.path.lastIndexOf('/')),
        source:'native-tree',clip:false});
    }
    if (withFreshEnd) context.events.push(event(48,'source.scroll',{...context.events.at(-1).payload}));
    return context;
  }
  const stale = fixture(false);
  assert.equal(evaluateSource(legacy,stale).verdict,'PASS','historical compatibility retains the old terminal relation');
  assert.equal(evaluateSource(assertion,stale).verdict,'NOT_RUN','an earlier end cannot prove the requested last swipe');
  assert.equal(definition.expected.requireFreshEnd,true,'the current case requires the new action binding');

  const run = context => evaluateSource(assertion,context);
  const passed = run(fixture());
  assert.equal(passed.verdict,'PASS',passed.reason);
  assert.equal(passed.actual.settledSeq,48,'the settled event may arrive after dispatch but before the native sample');
  const wrongOwner = fixture();
  wrongOwner.events.at(-1).payload.owner = {...owner,generation:18};
  assert.equal(run(wrongOwner).verdict,'FAIL');
  const wrongFilter = fixture();
  wrongFilter.events.at(-1).payload.filterRevision = 3;
  assert.equal(run(wrongFilter).verdict,'FAIL');
  const notAtEnd = fixture();
  notAtEnd.events.at(-1).payload.atEnd = false;
  assert.equal(run(notAtEnd).verdict,'FAIL');
  const detachedRow = fixture();
  const row = detachedRow.samples['list-tail'].nodes.find(node => node.id === 'reader-source-row-14');
  Object.assign(row,{path:'0/2/1',parentPath:'0/2'});
  assert.equal(run(detachedRow).verdict,'FAIL');
  const missing = fixture();
  missing.samples['list-tail'].nodes = missing.samples['list-tail'].nodes.filter(node => node.id !== row.id);
  assert.equal(run(missing).verdict,'NOT_RUN');
  const wrongAction = fixture();
  wrongAction.actions['scroll-tail-3'].op = 'keyEvent';
  assert.equal(run(wrongAction).verdict,'NOT_RUN');
});

test('source fixed inset and reset use native displacement with a negative raw scroll offset', () => {
  const context = scrollFixture();
  const fixed = evaluateScroll('source.layout.footer-fixed',context);
  assert.equal(fixed.verdict,'PASS');
  assert.equal(fixed.actual.filterDeltaPx,-199);
  assert.equal(fixed.actual.offsetVp,-4/3.5);
  assert.equal(fixed.actual.gestureId,'main-list');
  assert.equal(fixed.actual.gestureSampleId,'shallow');
  assert.equal(fixed.actual.baselineSampleId,'fixture-sources-ready');
  assert.equal(fixed.actual.actionId,'scroll-shallow');
  assert.equal(fixed.actual.dispatch.probeSeq,31);
  assert.equal(fixed.actual.distancePx,199);
  const unrelated = scrollFixture();
  unrelated.actions['scroll-shallow'].targetId = 'reader-source-status-filter';
  assert.equal(evaluateScroll('source.layout.footer-fixed',unrelated).verdict,'NOT_RUN');
  const missingSwipe = scrollFixture();
  delete missingSwipe.actions['scroll-shallow'].sourceListSwipe;
  assert.equal(evaluateScroll('source.layout.footer-fixed',missingSwipe).verdict,'NOT_RUN');
  const viewportMoved = scrollFixture();
  const viewport = viewportMoved.samples.shallow.nodes.find(node=>node.id === 'reader-source-list');
  viewport.visibleRectPx = {...viewport.visibleRectPx,top:137};
  assert.equal(evaluateScroll('source.layout.footer-fixed',viewportMoved).verdict,'FAIL');
  const reset = evaluateScroll('source.scroll.filter-reset',context);
  assert.equal(reset.verdict,'PASS');
  assert.equal(reset.actual.preResetDisplacementPx,199);
  const block = context.samples['filter-reset'].nodes.find(node => node.id === 'reader-source-filter-block');
  block.rectPx = {...block.rectPx,top:335};
  assert.equal(evaluateScroll('source.scroll.filter-reset',context).verdict,'FAIL');
});

test('source fixed inset requires native carriers and the raw list end gap', () => {
  const context = scrollFixture();
  const id = 'source.layout.fixed-insets';
  const passed = evaluateScroll(id,context);
  assert.equal(passed.verdict,'PASS');
  assert.equal(passed.actual.sampleId,'list-tail');
  assert.equal(passed.actual['fixture-sources-ready'].nativeStartGapPx,203);
  assert.equal(passed.actual.shallow.filterDeltaPx,-199);
  assert.equal(passed.actual['list-tail'].nativeEndGapPx,308);
  assert.ok(passed.evidenceRefs.some(item => item.path === 'raw/shallow.png'));

  // An unchanged Back button can't stand in for its moving header envelope.
  const header = context.samples.shallow.nodes.find(node => node.id === 'reader-native-slot:29');
  header.rectPx = {...header.rectPx,height:215};
  assert.equal(evaluateScroll('source.layout.footer-fixed',context).verdict,'PASS');
  assert.equal(evaluateScroll(id,context).reason,'shallow: fixed-header-envelope');
  delete context.samples['list-tail'];
  const failed = evaluateScroll(id,context);
  assert.equal(failed.verdict,'FAIL');
  assert.equal(failed.observationsComplete,false);

  const clipped = scrollFixture();
  const lastRow = clipped.samples['list-tail'].nodes.find(node => node.id === 'reader-source-row-14');
  lastRow.rectPx = lastRow.visibleRectPx = {...lastRow.rectPx,top:lastRow.rectPx.top + 2};
  assert.equal(evaluateScroll(id,clipped).reason,'list-tail: native-list-end-inset');

  const missing = scrollFixture();
  missing.samples.shallow.nodes = missing.samples.shallow.nodes.filter(node => node.id !== 'reader-native-slot:29');
  assert.equal(evaluateScroll(id,missing).verdict,'NOT_RUN');
});

const v9ScrollContract = read('../cases/source-management.v9-scroll-return.json');

function v9ScrollFixture() {
  const context = scrollFixture();
  const catalogue = context.events.find(item=>item.payload.trigger === 'category').payload;
  context.events = context.events.filter(item=>item.payload.atEnd !== true);
  const node = (id,path,type = 'Column',fields = {})=>({ ...makeNode(id),path,type,
    parentPath:path.slice(0,path.lastIndexOf('/')),enabled:true,clickable:type === 'Button',...fields });
  const build = (id,seq,filterTop,lastRowBottom)=>{
    const result = scrollSample(id,seq,filterTop,lastRowBottom);
    Object.assign(result,{afterSeq:seq+1,hostBeginMs:seq,hostEndMs:seq+1,captureComplete:true});
    const rect = {left:0,top:136,width:1280,height:2696};
    Object.assign(result.window,{rectPx:rect,visibleRectPx:rect});
    for (const item of result.nodes) Object.assign(item,{source:'native-tree',clip:false,
      parentPath:item.path.slice(0,item.path.lastIndexOf('/'))});
    return result;
  };
  const more = node('source-back:3:tools:header','0/1/1/0','Button',{alias:'reader-source-header-tools-button'});
  const addHeader = sample=>{
    sample.nodes.push(node('reader-source-header-tools','0/1/1'),{...more});
    return sample;
  };
  context.samples['filter-reset'] = build('filter-reset',30,339);
  context.samples.scrolled = addHeader(build('scrolled',39,undefined,1600));
  context.samples['more-open'] = build('more-open',47);
  context.samples['more-open'].nodes.push(node('reader-source-v9-more-menu','0/3'),node('reader-source-v9-open-groups','0/3/0','Button'));
  context.samples.groups = build('groups',55);
  context.samples.groups.nodes = [node('reader-source-v9-groups','0/0')];
  context.samples.restored = addHeader(build('restored',65,undefined,1600));
  context.samples['tail-2'] = build('tail-2',70);
  context.samples['before-final-tail'] = build('before-final-tail',78);
  context.samples['before-final-tail'].evidenceRefs = [ref('raw/before-final-tail.json')];
  context.samples['before-final-tail'].captureComplete = false;
  context.samples['list-tail'] = build('list-tail',87,undefined,2524);
  const dispatched = (from,seq,op,payload)=>({...action(seq,op),from,op,outcomeSettled:true,
    afterSeq:seq+3,hostBeginMs:seq,hostEndMs:seq+3,...payload});
  Object.assign(context.actions,{
    'scroll-list':dispatched('filter-reset',32,'swipe',{targetId:'reader-source-list'}),
    'open-more':dispatched('scrolled',42,'click',{targetId:more.alias}),
    'open-groups':dispatched('more-open',50,'click',{targetId:'reader-source-v9-open-groups'}),
    'groups-back':dispatched('groups',58,'keyEvent',{key:'Back'}),
    'scroll-away-from-tail':dispatched('tail-2',72,'swipe',{targetId:'reader-source-list'}),
    'scroll-tail-3':dispatched('before-final-tail',81,'swipe',{targetId:'reader-source-list'}),
  });
  const position = {owner,filterRevision:2,anchor:14,itemIndex:9,itemYVp:224,offsetVp:440,lastAnchor:14,
    viewportWidthVp:366,viewportHeightVp:770};
  const group = {owner,view:'groups',revision:1};
  context.events.push(event(34,'source.scroll',{...position,trigger:'settled'}),
    event(51,'source.scroll',{...position,trigger:'v9-list-enter'}),
    event(52,'source.v9-list-transition',{...group,phase:'enter'}),
    event(59,'source.v9-list-transition',{...group,phase:'return',filterMatchesDeparture:true}),
    event(60,'source.projection',{...catalogue,trigger:'v9-return'}),
    event(61,'source.scroll',{...position,trigger:'v9-list-return',layoutMatchesSaved:true,filterMatchesSaved:true}),
    event(73,'source.scroll',{...position,trigger:'settled',atEnd:false}),
    event(85,'source.scroll',{...position,trigger:'settled',atEnd:true}));
  return context;
}

const evaluateV9Scroll = (id, context) => {
  const assertion = v9ScrollContract.assertions.find(item=>item.id === id);
  return evaluateSource({...assertion,acceptedSources:assertion.sources},context);
};

test('v9 fixed inset scroll retains native movement, the real Groups visit and a fresh last row',()=>{
  const context = v9ScrollFixture();
  for (const id of ['source.layout.footer-fixed','source.scroll.filter-reset','source.v9.scroll.group-return',
    'source.layout.fixed-insets','source.layout.footer-last-row']) {
    const result = evaluateV9Scroll(id,context);
    assert.equal(result.verdict,'PASS',`${id}: ${result.reason}`);
  }
  const result = evaluateV9Scroll('source.layout.fixed-insets',context);
  assert.equal(result.actual['fixture-sources-ready'].nativeStartGapPx,203);
  assert.equal(result.actual.shallow.filterDeltaPx,-199);
  assert.equal(result.actual['list-tail'].nativeEndGapPx,308);
  assert.ok(result.actual.restored);
  assert.ok(result.evidenceRefs.some(item=>item.path === 'raw/groups.png'));
});

test('v9 fixed inset and tail reject shifted restored chrome, clipping, stale end, and fake Tools handoff',()=>{
  const shifted = v9ScrollFixture();
  const header = shifted.samples.restored.nodes.find(item=>item.id === 'reader-native-slot:29');
  header.rectPx = {...header.rectPx,height:header.rectPx.height + 2};
  assert.equal(evaluateV9Scroll('source.layout.fixed-insets',shifted).reason,'restored: fixed-header-envelope');
  const {payload:geometry} = shifted.events.find(item=>item.kind === 'source.geometry');
  shifted.events.splice(10,0,event(62,'source.geometry',{...geometry,headerHeightVp:205/3.5,listStartInsetVp:205/3.5}));
  assert.equal(evaluateV9Scroll('source.layout.fixed-insets',shifted).reason,'restored: fixed-carriers-across-group-return');
  const clipped = v9ScrollFixture();
  const row = clipped.samples['list-tail'].nodes.find(item=>item.id === 'reader-source-row-14');
  row.rectPx = row.visibleRectPx = {...row.rectPx,top:row.rectPx.top + 2};
  assert.equal(evaluateV9Scroll('source.layout.fixed-insets',clipped).verdict,'FAIL');
  assert.equal(evaluateV9Scroll('source.layout.footer-last-row',clipped).verdict,'FAIL');
  const stale = v9ScrollFixture();
  stale.events.at(-1).eventSeq = 80;
  for (const id of ['source.layout.fixed-insets','source.layout.footer-last-row'])
    assert.equal(evaluateV9Scroll(id,stale).verdict,'NOT_RUN');
  const noRearm = v9ScrollFixture();
  noRearm.events.find(item=>item.eventSeq === 73).payload.atEnd = true;
  assert.equal(evaluateV9Scroll('source.layout.fixed-insets',noRearm).verdict,'NOT_RUN');
  const fake = v9ScrollFixture();
  fake.events.splice(7,0,event(53,'source.route',{...owner,action:'tools',from:'source',to:'sourceTools'}));
  assert.equal(evaluateV9Scroll('source.v9.scroll.group-return',fake).verdict,'FAIL');
  assert.equal(evaluateV9Scroll('source.layout.fixed-insets',fake).verdict,'NOT_RUN');
});

function replayedFixture({definition = contract, context = evaluationFixture(), claim = 'invariants.B3',
  samples = ['source-ready','source-ime','filtered-ime','zero-match','cleared'], assess = assertion =>
    evaluateSource({...assertion,acceptedSources:assertion.sources},context)} = {}) {
  const currentMapping = model.receiptAdmissions.find(item => item.pageId === page.pageId && item.claim === claim);
  // The query-only fixture still exercises the historical single-case adapter.
  const mapping = claim === 'invariants.B3' && definition.id === contract.id ? {
    ...currentMapping,caseId:contract.id,
    assertions:[{id:'source.filteredEmpty',sampleId:'zero-match'},{id:'source.clearFilters',sampleId:'cleared'}],
    ownerSources:currentMapping.ownerSources.filter(path=>contract.ownerSources.includes(path)),
  } : currentMapping;
  const admissionModel = mapping === currentMapping ? model : {
    ...model,receiptAdmissions:model.receiptAdmissions.map(item=>item === currentMapping ? mapping : item),
  };
  const ownerPaths = new Set([page.source.path,...mapping.ownerSources]);
  const currentHash = input => ownerPaths.has(input.path) ? {...input,sha256:digest(input.path)} : input;
  // This synthetic receipt models a new candidate; it cannot inherit a historical register hash.
  const currentPage = {...page,source:currentHash(page.source),sourceInputs:page.sourceInputs.map(currentHash)};
  const sessionRef = ref('session.json');
  const commands = ref('session/commands.jsonl');
  const results = mapping.assertions.map(({id}) => {
    const assertion = definition.assertions.find(item => item.id === id);
    const result = assess(assertion);
    return {id,...result,evidenceRefs:[...result.evidenceRefs,sessionRef,commands]};
  });
  const rules = new Map(model.structureRules.map(rule => [rule.id, rule]));
  const structure = {
    bindingSha256:structureBindingSha256(definition, model),
    states:resolveStructureBindings(definition, model).filter(binding => samples.includes(binding.sampleId))
      .map(({role, rule, sampleId, actionId}) => ({
        role, ruleId:rule.id, sampleId, actionId, verdict:'PASS', observationsComplete:true,
        checks:structureRuleOrder(rule.id, rules).map(required => ({
          ruleId:required.id, requiredRuleIds:required.requires, verdict:'PASS', observationsComplete:true,
          evidenceRefs:[...capture(sampleId),sessionRef,commands],
        })),
      })),
  };
  const identity = {appBuildId:'0.2.0.DEV.0123456789ab',targetRef:'0123456789ab',hapSha256:sha,sourceFingerprint:sha};
  const receipt = {
    caseId:definition.id, page:{id:page.pageId,registration:'REGISTERED_PAGE'}, candidate:{identity}, session:sessionRef,
    assertions:results, structure, measurement:{sampleWindows:Object.fromEntries(samples.map(id => [id,{}]))},
  };
  const session = {commands,chain:samples.map(id => {
    const [screenshot,layout] = capture(id);
    return {entry:{kind:'sample',id,screenshot,layout}};
  })};
  return structuredClone({
    page:currentPage,claim,mapping,contract:definition,currentCase:structuredClone(definition),model:admissionModel,receipt,session,
    evidence:{candidate:{...identity}},frozenPage:structuredClone(currentPage),
    snapshot:{files:[currentPage.source,...currentPage.sourceInputs]},
  });
}

test('source register admits current B3 only after the four-way reset with its causal native samples', () => {
  const definition = read('../cases/source-management.combined-filter-reset.json');
  const context = capturedCombinedResetFixture();
  const make = () => replayedFixture({definition,context,samples:Object.values(definition.structure)});
  const complete = make();
  assert.deepEqual(complete.mapping.assertions,[
    {id:'source.filteredEmpty',sampleId:'zero-match'},
    {id:'source.clearFilters.combined',sampleId:'cleared'},
  ]);
  assert.ok(complete.mapping.ownerSources.includes('entry/src/main/ets/ui/controls/ReaderSelectPanel.ets'));
  assert.equal(complete.page.invariants.B3.result,'NOT_RUN');
  admitReplayedRule(complete);

  const former = replayedFixture();
  assert.throws(() => admitReplayedRule({...former,mapping:complete.mapping,model,currentCase:definition}),/exact page/u);
  const missingGroup = make();
  missingGroup.receipt.structure.states = missingGroup.receipt.structure.states.filter(state=>state.sampleId !== 'group-open');
  assert.throws(() => admitReplayedRule(missingGroup),/group-open/u);
  const missingClear = make();
  missingClear.session.chain = missingClear.session.chain.filter(link=>link.entry.id !== 'cleared');
  assert.throws(() => admitReplayedRule(missingClear),/raw native capture for cleared/u);
  const reset = context.events.find(event=>event.payload.trigger === 'clear');
  Object.assign(reset.payload,{allGroups:false,groupIndex:1});
  assert.throws(() => admitReplayedRule(make()),/source.clearFilters.combined/u);
});

test('source register admits only the matching B3 rule and both full samples', () => {
  const fixture = replayedFixture();
  admitReplayedRule(fixture);
  assert.equal(page.invariants.B3.result,'NOT_RUN');
  assert.equal(page.invariants.E2.result,'FAIL');
  assert.equal(page.invariants.E3.result,'FAIL');
  for (const [alter,error] of [
    [x=>x.receipt.assertions.pop(), /source.clearFilters/u],
    [x=>x.receipt.assertions[0].id = 'source.unrelated', /source.filteredEmpty/u],
    [x=>x.receipt.assertions[1].actual.sampleId = 'zero-match', /raw native capture/u],
    [x=>x.receipt.assertions[1].evidenceRefs = x.receipt.assertions[1].evidenceRefs.filter(ref => ref.path !== 'raw/cleared.png'), /raw native capture/u],
    [x=>x.receipt.structure.states.find(state => state.sampleId === 'source-ready').verdict = 'FAIL', /source-ready/u],
    [x=>x.currentCase.steps.find(step => step.id === 'source-ready').quietMs += 1, /causal sample source-ready/u],
    [x=>x.currentCase.steps.find(step => step.id === 'ime-back').key = 'Enter', /causal action ime-back/u],
    [x=>x.receipt.caseId = 'source-management.scroll-return', /exact page/u],
    [x=>x.receipt.page.id = 'bookshelf', /exact page/u],
    [x=>x.claim = 'layers.query', /exact page/u],
    [x=>x.page.routeContractRef = 'nav.sourceTools', /exact page/u],
    [x=>x.receipt.candidate.identity.hapSha256 = '1'.repeat(64), /candidate differs/u],
    [x=>x.frozenPage.source = {...x.frozenPage.source, sha256:'1'.repeat(64)}, /live register/u],
    [x=>x.snapshot.files = x.snapshot.files.filter(input => input.path !== x.page.source.path), /deployed and live/u],
  ]) {
    const mutated = replayedFixture();
    alter(mutated);
    assert.throws(() => admitReplayedRule(mutated),error);
  }
  const attempted = structuredClone(page);
  attempted.invariants.B3 = {result:'PASS',evidence:[{kind:'device',symbol:'normal-page',path:'legacy.json',result:'PASS'}]};
  assert.equal(checkNormalPageEvidence(attempted,model).find(item=>item.field === 'invariants.B3').result,'FAIL');
  assert.throws(() => checkContractReceipt(page,model,'layers.query',{claims:['layers.query']}), /owner mapping/u);
});

test('source register follows each causal action and sample to the original fixture', () => {
  const samePath = replayedFixture();
  admitReplayedRule(samePath);

  const changedEntry = replayedFixture();
  changedEntry.currentCase.steps.find(step => step.id === 'open-settings').target = 'another-settings-entry';
  assert.throws(() => admitReplayedRule(changedEntry), /causal action open-settings/u);

  const changedLocator = replayedFixture();
  changedLocator.currentCase.steps.find(step => step.id === 'settings').anchors = ['another-settings-host'];
  assert.throws(() => admitReplayedRule(changedLocator), /causal sample settings/u);

  const missingEditor = replayedFixture();
  missingEditor.receipt.structure.states = missingEditor.receipt.structure.states.filter(state => state.sampleId !== 'source-ime');
  assert.throws(() => admitReplayedRule(missingEditor), /source-ime/u);

  const changedPublicInput = replayedFixture();
  const role = changedPublicInput.currentCase.steps.find(step => step.id === 'edit-zero-match').inputRole;
  changedPublicInput.currentCase.fixture.inputs[role] = 'OtherPublicQuery';
  assert.throws(() => admitReplayedRule(changedPublicInput), /fixture/u);

  const independent = replayedFixture();
  independent.currentCase.fixture.description = 'Description edited for the same public fixture.';
  independent.currentCase.steps.find(step => step.id === 'return-settings').key = 'Enter';
  admitReplayedRule(independent);
});

test('source register admits S3 only with the declared avoidance and paired native scroll proof', () => {
  const claim = 'invariants.S3';
  const make = () => replayedFixture({definition:scrollContract,claim,samples:Object.values(scrollContract.structure),
    assess:({sample:sampleId}) => ({verdict:'PASS',actual:{sampleId},evidenceRefs:capture(sampleId)})});
  const complete = make();
  assert.deepEqual(complete.mapping.assertions, [
    {id:'source.route.entry',sampleId:'source-ready'},
    {id:'source.layout.compensation',sampleId:'source-ready'},
    {id:'source.layout.fixed-insets',sampleId:'list-tail'},
  ]);
  assert.equal(page.invariants.S3.result,'NOT_RUN');
  admitReplayedRule(complete);
  for (const register of ['page','frozenPage']) {
    for (const change of [
      entry => { entry.layers.scroll.facts.underlap = true; },
      entry => { entry.layers.scroll.facts.obscurationCompensation = 12; },
      entry => { entry.layers.scroll.facts.obscurationCompensationSource = {path:'other.ets',symbol:'other'}; },
      entry => { entry.layers.header.facts.presentation = 'Floating'; },
    ]) {
      const fixture = make();
      change(fixture[register]);
      assert.throws(() => admitReplayedRule(fixture), /Source S3 requires the same fixed header/u);
    }
  }
  for (const sampleId of ['source-ready','fixture-sources-ready','shallow','list-tail']) {
    const fixture = make();
    fixture.receipt.structure.states = fixture.receipt.structure.states.filter(state => state.sampleId !== sampleId);
    assert.throws(() => admitReplayedRule(fixture),error => error.message.includes(sampleId));
  }
  const withoutLayers = make();
  withoutLayers.receipt.structure.states.find(state => state.sampleId === 'shallow')
    .checks.find(check => check.ruleId === 'source.fixed-carriers-over-list').verdict = 'NOT_RUN';
  assert.throws(() => admitReplayedRule(withoutLayers), /shallow/u);
  const wrongShallowTree = make();
  const shallow = wrongShallowTree.receipt.structure.states.find(state => state.sampleId === 'shallow');
  shallow.checks.at(-1).evidenceRefs = shallow.checks.at(-1).evidenceRefs.filter(ref => !ref.path.endsWith('/shallow.json'));
  assert.throws(() => admitReplayedRule(wrongShallowTree), /raw native capture for shallow/u);
  const noEntry = make();
  noEntry.receipt.assertions = noEntry.receipt.assertions.filter(record => record.id !== 'source.route.entry');
  assert.throws(() => admitReplayedRule(noEntry), /source.route.entry/u);
  const oldOwner = make();
  oldOwner.snapshot.files = oldOwner.snapshot.files.map(file => file.path.endsWith('/SourceManagementVerification.ts') ?
    {...file,sha256:'0'.repeat(64)} : file);
  assert.throws(() => admitReplayedRule(oldOwner), /SourceManagementVerification.ts/u);
  const generic = make();
  generic.page.invariants.S3 = {result:'PASS',evidence:[
    {kind:'device',symbol:'normal-page',result:'PASS',path:'do-not-open-generic-claim.json'},
  ]};
  const rejected = checkNormalPageEvidence(generic.page,generic.model).find(record => record.field === claim);
  assert.equal(rejected?.result, 'FAIL');
  assert.equal(rejected?.message, 'PASS requires same-scene full screenshot, native tree and Developer Mode parameters');
});

test('source register admits S4 only with entry and same-opening IME, group and settings return proofs', () => {
  const {definition,context} = temporaryBackFixture();
  const make = () => replayedFixture({definition,context,claim:'invariants.S4',samples:Object.keys(context.samples)});
  const expected = [
    {id:'source.route.entry',sampleId:'source-ready'},
    {id:'source.overlay.ime-back',sampleId:'ime-hidden'},
    {id:'source.overlay.group-back',sampleId:'group-back'},
    {id:'source.route.settings-return',sampleId:'settings-return'},
  ];
  const complete = make();
  assert.deepEqual(complete.mapping.assertions,expected);
  assert.ok(definition.ownerSources.includes('entry/src/main/ets/ui/foundation/ReaderKeyboardBack.ts'));
  admitReplayedRule(complete);
  assert.equal(page.invariants.S4.result,'NOT_RUN');
  assert.equal(page.invariants.E2.result,'FAIL');
  assert.equal(page.invariants.E3.result,'FAIL');

  for (const {id} of expected) {
    const missing = make();
    missing.receipt.assertions = missing.receipt.assertions.filter(record => record.id !== id);
    assert.throws(() => admitReplayedRule(missing),error => error.message.includes(id));
  }
  const missingGroup = make();
  missingGroup.receipt.structure.states = missingGroup.receipt.structure.states.filter(state => state.sampleId !== 'group-open');
  assert.throws(() => admitReplayedRule(missingGroup), /group-open/u);
  const changedBack = make();
  changedBack.currentCase.steps.find(step => step.id === 'back-group').key = 'Enter';
  assert.throws(() => admitReplayedRule(changedBack), /back-group/u);
  const staleOwner = make();
  staleOwner.snapshot.files = staleOwner.snapshot.files.filter(input => !input.path.endsWith('/ReaderSelectPanel.ets'));
  assert.throws(() => admitReplayedRule(staleOwner), /ReaderSelectPanel.ets/u);
  const rawTree = make();
  rawTree.receipt.assertions.find(record => record.id === 'source.route.settings-return').evidenceRefs =
    rawTree.receipt.assertions.find(record => record.id === 'source.route.settings-return').evidenceRefs
      .filter(ref => ref.path !== 'raw/settings-return.json');
  assert.throws(() => admitReplayedRule(rawTree), /raw native capture/u);
});

test('source register rejects historical local PASS when its current structural obligation is missing', () => {
  const fixture = replayedFixture();
  assert.ok(fixture.receipt.assertions.every(record => record.verdict === 'PASS'));
  const missingProof = {...fixture,receipt:{...fixture.receipt,structure:undefined}};
  assert.throws(() => admitReplayedRule(missingProof), /necessary structure evidence/u);
  const missingObligation = {...fixture.model,
    scenarioObligations:fixture.model.scenarioObligations.filter(obligation => obligation.caseId !== contract.id)};
  assert.throws(() => admitReplayedRule({...fixture,model:missingObligation}), /no necessary structure obligation/u);
  assert.throws(() => checkContractReceipt(page,missingObligation,fixture.claim,fixture.evidence),
    /no necessary structure obligation/u);
});

test('source register admits S8 only with the full Tools round trip and current native return proofs', () => {
  const definition = read('../cases/source-management.tool-return-filters.json');
  const make = () => replayedFixture({definition,claim:'invariants.S8',samples:Object.values(definition.structure),
    assess:({sample:sampleId}) => ({verdict:'PASS',actual:{sampleId},evidenceRefs:capture(sampleId)})});
  const complete = make();
  assert.deepEqual(complete.mapping.assertions, [
    {id:'source.route.entry',sampleId:'source-ready'},
    {id:'source.filter.group',sampleId:'filtered'},
    {id:'source.route.open-tools',sampleId:'tools'},
    {id:'source.route.tools-return',sampleId:'restored'},
    {id:'source.scroll.tool-return-filters',sampleId:'restored'},
    {id:'source.focus.tools-return',sampleId:'restored'},
  ]);
  admitReplayedRule(complete);
  assert.equal(page.invariants.S8.result,'NOT_RUN');
  assert.equal(page.invariants.E6.result,'NOT_RUN');
  for (const sampleId of Object.values(definition.structure)) {
    const missing = make();
    missing.receipt.structure.states = missing.receipt.structure.states.filter(state => state.sampleId !== sampleId);
    assert.throws(() => admitReplayedRule(missing),error => error.message.includes(sampleId));
  }
  for (const {id} of complete.mapping.assertions) {
    const missing = make();
    missing.receipt.assertions = missing.receipt.assertions.filter(record => record.id !== id);
    assert.throws(() => admitReplayedRule(missing),error => error.message.includes(id));
  }
  const wrongReturnTree = make();
  wrongReturnTree.receipt.assertions.find(record => record.id === 'source.focus.tools-return').actual.sampleId = 'scrolled';
  assert.throws(() => admitReplayedRule(wrongReturnTree), /raw native capture for restored/u);
  const oldToolBack = make();
  oldToolBack.currentCase.steps.find(step => step.id === 'tools-back').key = 'Enter';
  assert.throws(() => admitReplayedRule(oldToolBack), /tools-back/u);
  const oldOwner = make();
  oldOwner.snapshot.files = oldOwner.snapshot.files.filter(input => !input.path.endsWith('/SourceManagementScrollState.ts'));
  assert.throws(() => admitReplayedRule(oldOwner), /SourceManagementScrollState.ts/u);
});

test('source register admits S6 only when both captured parents have current full evidence', () => {
  const definition = read('../cases/source-management.captured-parent-roundtrip.json');
  const make = () => replayedFixture({definition,claim:'invariants.S6',samples:Object.values(definition.structure),
    assess:({sample:sampleId}) => ({verdict:'PASS',actual:{sampleId},evidenceRefs:capture(sampleId)})});
  const complete = make();
  assert.deepEqual(complete.mapping.assertions, [
    {id:'source.route.search-parent-after-tools',sampleId:'search-returned'},
    {id:'source.route.settings-parent-after-tools',sampleId:'settings-returned'},
  ]);
  assert.equal(page.invariants.S6.result,'NOT_RUN');
  admitReplayedRule(complete);
  for (const [index, assertion] of complete.mapping.assertions.entries()) {
    const missing = make();
    missing.receipt.assertions.splice(index,1);
    assert.throws(() => admitReplayedRule(missing),error => error.message.includes(assertion.id));
    const wrongNativeSample = make();
    wrongNativeSample.receipt.assertions[index].actual.sampleId = complete.mapping.assertions[1-index].sampleId;
    assert.throws(() => admitReplayedRule(wrongNativeSample), /raw native capture/u);
  }
  const incomplete = make();
  incomplete.receipt.structure.states = incomplete.receipt.structure.states.filter(state => state.sampleId !== 'search-tools');
  assert.throws(() => admitReplayedRule(incomplete), /search-tools/u);
  const changedPath = make();
  changedPath.currentCase.steps.find(step => step.id === 'back-to-shelf').key = 'Enter';
  assert.throws(() => admitReplayedRule(changedPath), /back-to-shelf/u);
});


test('source register verifies all independently frozen tool bytes before replay', () => {
  const temp = mkdtempSync(join(tmpdir(),'reader-source-replay-tool.'));
  try {
    const exportRoot = join(temp,'exported');
    const identity = exportReplayTool(exportRoot);
    verifyFrozenTool(exportRoot,identity.sha256);
    assert.throws(() => verifyFrozenTool(exportRoot,'0'.repeat(64)), /registered identity/u);
    appendFileSync(join(exportRoot,'tools/page-structure/register.json'),'\n');
    assert.throws(() => verifyFrozenTool(exportRoot,identity.sha256), /files changed/u);
  } finally {
    rmSync(temp,{recursive:true,force:true});
  }
});

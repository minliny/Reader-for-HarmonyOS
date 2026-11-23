import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireActionDispatch, requestedOperation } from '../collectors/harmonyos/records.mjs';
import { evaluateSource } from '../lib/source.mjs';
import { measureSourceFilterCarrier, sourceFilterEdgeTap, sourceFilterNativeAssertion,
  sourceFilterNativeDispatch, sourceCategoryNativeChecksValid, sourceStatusNativeChecksValid } from '../lib/source-filter-edge.mjs';

const status = 'reader-source-status-enabled';
const category = 'source-category-novel';
const extent = {left:20,top:20,width:160,height:154};
const frame = {left:0,top:0,width:1120,height:2478};
const owner = {generation:3,mounting:1};
const point = {x:100,y:21};
const evidenceRefs = [{path:'native.png'},{path:'native.json'}];
const window = {id:'window',revision:2,source:'window-metrics',density:3.5,visibleRectPx:frame,keyboard:{visible:false}};
const box = (id,path,parentPath,rect=extent,properties={}) => ({
  id,path,parentPath,rectPx:{...rect},visibleRectPx:{...rect},enabled:true,clickable:false,visible:true,opacity:1,...properties,
});

function sample(target = status) {
  const lane = target.startsWith('source-category-') ? 'reader-source-category-filter' : 'reader-source-status-filter';
  return {sampleId:'before',instanceId:'current',beforeSeq:5,afterSeq:6,captureComplete:true,window:{...window},evidenceRefs,
    nodes:[
      box(lane,'0/0','0',{left:0,top:20,width:1120,height:154},{type:'Scroll'}),
      box(target,'0/0/0','0/0'),
      box('', '0/0/0/0','0/0/0',extent,{type:'Button',clickable:true}),
    ]};
}

const step = {id:'edge',kind:'action',op:'click',from:'before',target:status,tapEdge:'top'};

test('source filter selection binds native carriers for current radios, the disabled placeholder and the group trigger', () => {
  const custom = 'reader-source-status-custom';
  const group = 'reader-source-group-trigger';
  const expected = {requireFullContainment:true,requireLocatorCenter:true};
  const entry = {op:'click',targetId:'reader-settings-source-management',instanceId:'current',beforeSeq:1,afterSeq:2};
  const project = (eventSeq,kind,payload) => ({eventSeq,instanceId:'current',kind,channel:'business',payload});
  const events = [
    project(2,'source.route',{action:'open',from:'settings',to:'source',...owner,previousGeneration:2}),
    project(3,'source.projection',{owner,readFact:'current',state:'filteredEmpty',status:'error',category:'external',
      groupIndex:0,allGroups:true,readGeneration:1,filterRevision:3,count:18,projected:0,queryLength:0}),
  ];
  const evaluate = (capture,target,options = expected) => evaluateSource({
    kind:'filter-touch-target',action:'open',sample:'before',expected:{target,...options},
    acceptedSources:['native-tree','window-metrics','app-owner'],
  },{samples:{before:capture},actions:{open:entry},events});

  for (const target of ['reader-source-status-unchecked','reader-source-status-error','source-category-external',group]) {
    const capture = sample(target);
    if (target === group) Object.assign(capture.nodes[0],{id:'reader-source-group-filter',type:'Row'});
    const result = evaluate(capture,target);
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.carrierPath,'0/0/0/0');
    assert.equal(result.actual.heightVp,44);
    const operation = requestedOperation({id:'normal-click',op:'click',gesture:true,from:'before',target},{before:capture},{});
    assert.deepEqual(operation,{op:'click',...result.actual.locatorPoint});
    const args = ['shell','uitest','uiInput','click',String(operation.x),String(operation.y)];
    assert.equal(requireActionDispatch([{event:'command',ok:true,seq:1,args}],1,operation).seq,1);

    capture.nodes[2].rectPx.left = capture.nodes[2].visibleRectPx.left = operation.x + 1;
    assert.equal(evaluate(capture,target).verdict,'FAIL');
    capture.nodes[2].rectPx.left = capture.nodes[2].visibleRectPx.left = extent.left;
    capture.nodes[0].visibleRectPx.left = extent.left + 1;
    assert.equal(evaluate(capture,target).verdict,'FAIL');
  }

  const disabled = sample(custom);
  const [,,button] = disabled.nodes;
  const geometry = {requireFullContainment:true};
  Object.assign(button,{enabled:false,clickable:false});
  assert.equal(evaluate(disabled,custom,geometry).verdict,'PASS');
  assert.equal(disabled.nodes[1].enabled,true,'the wrapper input state must not prove the native Button state');
  button.clickable = true;
  assert.equal(evaluate(disabled,custom,geometry).verdict,'FAIL');
  button.clickable = false;
  button.enabled = null;
  assert.equal(evaluate(disabled,custom,geometry).verdict,'NOT_RUN');
  disabled.nodes.pop();
  assert.equal(evaluate(disabled,custom,geometry).verdict,'FAIL');
});

test('source filter edge uses opposite ends of the real native Button and rechecks the click journal', () => {
  const start = sample();
  const top = sourceFilterEdgeTap(start,status,'top');
  const bottom = sourceFilterEdgeTap(start,status,'bottom');
  assert.deepEqual(top.point,point);
  assert.deepEqual(bottom.point,{x:100,y:172});
  assert.equal(top.heightVp,44);
  assert.equal(top.carrierPath,'0/0/0/0');
  assert.deepEqual(sourceFilterEdgeTap(sample(category),category,'top').point,point);
  const operation = requestedOperation(step,{before:start},{});
  assert.deepEqual(operation,{op:'click',...point});
  const journal = [{event:'command',ok:true,seq:1,args:['shell','uitest','uiInput','click','100','21']}];
  assert.equal(requireActionDispatch(journal,1,operation).seq,1);
  journal[0].args[5] = '97';
  assert.throws(() => requireActionDispatch(journal,1,operation),/Unexpected command/u);
});

test('source filter edge rejects clipped, ambiguous, disabled and foreign lane targets before dispatch', () => {
  for (const change of [
    capture => { capture.nodes[2].visibleRectPx.height--; },
    capture => { capture.nodes[2].visibleRectPx.height = 90; capture.nodes[2].rectPx.height = 90; },
    capture => { capture.nodes[2].enabled = false; },
    capture => { capture.nodes.push({...capture.nodes[2],path:'0/0/0/1'}); },
    capture => { capture.nodes[2].parentPath = '0/1'; },
    capture => { capture.nodes[0].visibleRectPx = {...capture.nodes[0].visibleRectPx,top:23}; },
    capture => { capture.window.keyboard = {visible:true}; },
    capture => { capture.captureComplete = false; },
  ]) {
    const capture = sample();
    change(capture);
    assert.throws(() => requestedOperation(step,{before:capture},{}));
  }
  assert.throws(() => requestedOperation({...step,target:'reader-source-status-custom'},{before:sample()},{}),
    /Unsupported source filter/u);
  const clipped = sample();
  clipped.nodes[2].visibleRectPx.height--;
  assert.equal(measureSourceFilterCarrier(clipped,status).verdict,'FAIL');
  const missing = sample();
  missing.nodes.pop();
  assert.equal(measureSourceFilterCarrier(missing,status).verdict,'FAIL');
  const unknown = sample();
  unknown.nodes[2].enabled = null;
  assert.equal(measureSourceFilterCarrier(unknown,status).verdict,'NOT_RUN');
});

test('source filter edge requires the whole native Button inside its viewport and window', () => {
  const requireFullContainment = true;
  const whole = {requireFullContainment};
  const entry = {op:'click',targetId:'reader-settings-source-management',instanceId:'current',beforeSeq:1,afterSeq:2};
  const checkpoint = (eventSeq,kind,payload) => ({eventSeq,instanceId:'current',kind,channel:'business',payload});
  const events = [checkpoint(2,'source.route',{
    action:'open',from:'settings',to:'source',...owner,previousGeneration:2,
  }),checkpoint(3,'source.projection',{
    owner,state:'rows',readFact:'current',status:'all',category:'all',groupIndex:0,allGroups:true,
    readGeneration:1,filterRevision:1,count:18,projected:18,queryLength:0,firstAnchor:1,
  })];
  const evaluate = (capture,target) => evaluateSource({kind:'filter-touch-target',action:'open',sample:'before',
    expected:{target,requireFullContainment},acceptedSources:['native-tree','window-metrics','app-owner']},
  {samples:{before:capture},actions:{open:entry},events});
  for (const target of [status,category]) {
    const capture = sample(target);
    assert.equal(evaluate(capture,target).verdict,'PASS');
    assert.deepEqual(requestedOperation({...step,target,...whole},{before:capture},{}),{op:'click',...point});
    for (const clip of [
      partial => { partial.nodes[0].visibleRectPx = {...partial.nodes[0].visibleRectPx,left:30,width:100}; },
      partial => { partial.nodes[0].visibleRectPx = {...partial.nodes[0].visibleRectPx,top:23}; },
      partial => { partial.window.visibleRectPx = {...partial.window.visibleRectPx,left:30,width:100}; },
    ]) {
      const partial = sample(target);
      clip(partial);
      assert.equal(measureSourceFilterCarrier(partial,target).verdict,'PASS');
      assert.equal(measureSourceFilterCarrier(partial,target,whole).verdict,'FAIL');
      assert.equal(evaluate(partial,target).verdict,'FAIL');
      for (const tapEdge of ['top','bottom']) {
        assert.throws(() => requestedOperation({...step,target,tapEdge,...whole},{before:partial},{}),/clipped/u);
      }
    }
    for (const obscure of [
      unknown => { delete unknown.nodes[0].visibleRectPx; },
      unknown => { unknown.nodes[0].type = 'Column'; },
      unknown => { delete unknown.window.visibleRectPx; },
    ]) {
      const unknown = sample(target);
      obscure(unknown);
      assert.equal(evaluate(unknown,target).verdict,'NOT_RUN');
      assert.throws(() => requestedOperation({...step,target,...whole},{before:unknown},{}));
    }
  }
  const sideClipped = sample();
  sideClipped.nodes[0].visibleRectPx = {...sideClipped.nodes[0].visibleRectPx,left:30,width:100};
  assert.deepEqual(requestedOperation(step,{before:sideClipped},{}),{op:'click',...point});
});

test('source filter edge requires the exact owner dispatch and retains a proved unaccepted click', () => {
  const definition = {kind:'filter-selection',action:'edge',baseline:'before',sample:'after',
    acceptedSources:['native-tree','window-metrics','app-owner'],
    expected:{trigger:'status',field:'status',value:'enabled',tapEdge:'top'}};
  const project = (eventSeq,payload) => ({kind:'source.projection',channel:'business',instanceId:'current',
    eventSeq,payload,evidenceRefs});
  const prior = {owner,readFact:'current',state:'rows',readGeneration:6,filterRevision:8,
    count:18,projected:18,category:'all',groupIndex:0,queryLength:0,allGroups:true,status:'all'};
  function context() {
    return {
      actions:{edge:{op:'click',from:'before',targetId:status,instanceId:'current',beforeSeq:7,afterSeq:10,
        edgeTap:{edge:'top',...point,probeSeq:3},evidenceRefs}},
      samples:{before:sample(),after:{...sample(),sampleId:'after',beforeSeq:12,afterSeq:13}},
      events:[project(4,prior),project(8,{...prior,trigger:'status',status:'enabled',filterRevision:9,projected:4})],
    };
  }
  const evaluate = fixture => evaluateSource(definition,fixture);
  const verified = evaluate(context());
  assert.equal(verified.verdict,'PASS');
  assert.deepEqual(verified.actual.edge.point,point);

  const ignored = context();
  ignored.events.pop();
  const failed = evaluate(ignored);
  assert.equal(failed.verdict,'FAIL');
  assert.match(failed.reason,/not accepted/u);

  const wrong = context();
  wrong.events[1].payload.status = 'error';
  assert.equal(evaluate(wrong).verdict,'FAIL');
  const unrelated = context();
  unrelated.events[1].payload.owner = {...owner,generation:4};
  assert.equal(evaluate(unrelated).verdict,'FAIL');
  const substitution = context();
  substitution.actions.edge.edgeTap.y++;
  assert.equal(evaluate(substitution).verdict,'NOT_RUN');
  const missingNative = context();
  missingNative.samples.after.captureComplete = false;
  assert.equal(evaluate(missingNative).verdict,'NOT_RUN');
  const sideClipped = context();
  sideClipped.samples.before.nodes[0].visibleRectPx = {...sideClipped.samples.before.nodes[0].visibleRectPx,left:30,width:100};
  assert.equal(evaluate(sideClipped).verdict,'PASS');
  sideClipped.actions.edge.edgeTap.requireFullContainment = true;
  assert.equal(evaluate(sideClipped).verdict,'NOT_RUN');
});

test('source category tail and head bind four real upper edge taps and their selected owner', () => {
  const contract = JSON.parse(readFileSync(new URL('../cases/source-management.category-touch-edges.json',import.meta.url),'utf8'));
  const targets = [
    {value:'comic',start:'source-ready',left:524,width:162},
    {value:'music',start:'comic-selected',left:714,width:254},
    {value:'download',start:'category-tail',left:319,width:254},
    {value:'other',start:'download-selected',left:960,width:254},
  ];
  const swipe = contract.steps.find(step => step.id === 'scroll-categories');
  assert.deepEqual([swipe.op,swipe.from,swipe.target],['swipe','music-selected','reader-source-category-filter']);
  assert.ok(swipe.path.from[0] > swipe.path.to[0]);
  const sourceEvent = (eventSeq,kind,payload) => ({eventSeq,kind,payload,instanceId:'current',channel:'business'});
  const entry = {op:'click',targetId:'reader-settings-source-management',instanceId:'current',beforeSeq:1,afterSeq:2};
  const lane = {left:67,top:1005,width:1147,height:154};
  const nativeWindow = {left:0,top:0,width:1280,height:2832};
  for (const [index,{value,start,left,width}] of targets.entries()) {
    const id = 'source-category-' + value;
    const outcome = value + '-selected';
    const step = contract.steps.find(item => item.id === 'tap-' + value);
    const carrier = contract.assertions.find(item => item.id === 'source.filter.carrier.category-' + value);
    const selection = contract.assertions.find(item => item.id === 'source.filter.edge.category-' + value);
    assert.deepEqual([step.from,step.target,step.tapEdge,step.requireFullContainment],[start,id,'top',true]);
    assert.equal(carrier.sample,start);
    assert.deepEqual([selection.baseline,selection.sample,selection.expected.nativeSelection],[start,outcome,true]);
    const bounds = {left,top:lane.top,width,height:lane.height};
    const before = sample(id);
    before.sampleId = start;
    before.window.visibleRectPx = nativeWindow;
    Object.assign(before.nodes[0],{rectPx:lane,visibleRectPx:lane});
    for (const node of before.nodes.slice(1)) Object.assign(node,{rectPx:{...bounds},visibleRectPx:{...bounds}});
    before.nodes[2].selected = false;
    const after = structuredClone(before);
    Object.assign(after,{sampleId:outcome,beforeSeq:12,afterSeq:13});
    after.nodes[2].selected = true;
    const operation = requestedOperation(step,{[start]:before},contract.fixture);
    assert.deepEqual(operation,{op:'click',x:left + Math.floor(width / 2),y:lane.top + 1});
    const journal = [{event:'command',ok:true,seq:1,args:['shell','uitest','uiInput','click',String(operation.x),String(operation.y)]}];
    const command = requireActionDispatch(journal,1,operation);
    const click = {op:'click',targetId:id,from:start,beforeSeq:7,afterSeq:10,instanceId:'current',evidenceRefs,
      edgeTap:{edge:'top',x:operation.x,y:operation.y,probeSeq:command.seq,requireFullContainment:true},
      filterTouch:sourceFilterNativeDispatch(contract,step,operation,command.seq)};
    const prior = {owner,readFact:'current',state:'rows',status:'all',category:targets[index - 1]?.value ?? 'all',
      groupIndex:0,allGroups:true,readGeneration:1,filterRevision:3,count:18,projected:18,queryLength:0};
    const accepted = {...prior,trigger:'category',category:value,projected:0,state:'filteredEmpty',filterRevision:4};
    const context = {samples:{[start]:before,[outcome]:after},actions:{'open-sources':entry,[step.id]:click},events:[
      sourceEvent(2,'source.route',{action:'open',from:'settings',to:'source',...owner,previousGeneration:2}),
      sourceEvent(4,'source.projection',prior),
      sourceEvent(8,'source.projection',accepted),
    ]};
    const evaluate = item => evaluateSource({...item,acceptedSources:item.sources},context);
    for (const item of [carrier,selection]) {
      const actual = evaluate(item);
      assert.equal(actual.verdict,'PASS',actual.reason);
    }
    assert.deepEqual(evaluate(selection).actual.nativeInteraction,{
      subject:'category-' + value,target:id,position:'top',carrierPath:'0/0/0/0',bounds,
      visible:true,clipped:false,enabled:true,accepted:true,actionId:step.id,baselineSampleId:start,
      dispatch:{x:operation.x,y:operation.y,probeSeq:command.seq},
    });
    after.nodes[2].selected = false;
    assert.equal(evaluate(selection).verdict,'FAIL');
    after.nodes[2].selected = true;
    accepted.owner = {...owner,generation:9};
    assert.equal(evaluate(selection).verdict,'FAIL');
    before.nodes[2].visibleRectPx.width--;
    assert.equal(evaluate(carrier).verdict,'FAIL');
    assert.throws(() => requestedOperation(step,{[start]:before},contract.fixture),/clipped/u);
  }
});

test('source filter normal center requires the accepted current radio and the actual native carrier center', () => {
  const contract = JSON.parse(readFileSync(new URL('../cases/source-management.filter-selections.json',import.meta.url),'utf8'));
  const definition = contract.assertions.find(item => item.id === 'source.filter.status.enabled');
  const step = contract.steps.find(item => item.id === definition.action);
  const before = sample();
  const after = structuredClone(before);
  Object.assign(before,{sampleId:definition.baseline});
  Object.assign(after,{sampleId:definition.sample,beforeSeq:12,afterSeq:13});
  after.nodes[2].selected = true;
  const samples = {[definition.baseline]:before,[definition.sample]:after};
  const operation = requestedOperation(step,samples,contract.fixture);
  const journal = [{event:'command',ok:true,seq:1,args:['shell','uitest','uiInput','click','100','97']}];
  const dispatch = requireActionDispatch(journal,1,operation);
  const action = {op:'click',targetId:status,from:definition.baseline,instanceId:'current',beforeSeq:7,afterSeq:10,
    filterTouch:sourceFilterNativeDispatch(contract,step,operation,dispatch.seq)};
  const project = (eventSeq,payload) => ({kind:'source.projection',channel:'business',instanceId:'current',eventSeq,payload});
  const prior = {owner,readFact:'current',state:'rows',readGeneration:6,filterRevision:8,count:18,projected:18,
    category:'all',groupIndex:0,queryLength:0,allGroups:true,status:'all'};
  const accepted = {...prior,trigger:'status',status:'enabled',filterRevision:9,projected:4};
  const context = {samples,actions:{[step.id]:action},events:[project(4,prior),project(8,accepted)]};
  const evaluate = () => evaluateSource({...definition,acceptedSources:definition.sources},context);
  const identity = {subject:'status-enabled',target:status,position:'center'};
  assert.deepEqual(sourceFilterNativeAssertion(contract,definition),identity);
  assert.equal(sourceFilterNativeAssertion({...contract,version:5},definition),undefined);
  assert.equal(sourceFilterNativeAssertion(contract,{...definition,expected:{...definition.expected,value:'error'}}),undefined);
  assert.equal(sourceFilterNativeAssertion(contract,{...definition,sample:'source-ready'}),undefined);
  const result = evaluate();
  assert.equal(result.verdict,'PASS',result.reason);
  assert.deepEqual(result.actual.nativeInteraction,{
    ...identity,carrierPath:'0/0/0/0',bounds:extent,visible:true,clipped:false,enabled:true,accepted:true,
    actionId:step.id,baselineSampleId:definition.baseline,dispatch:{x:100,y:97,probeSeq:1},
  });

  before.nodes[2].rectPx.left = before.nodes[2].visibleRectPx.left = 22;
  assert.equal(evaluate().verdict,'PASS');
  assert.equal(evaluate().actual.nativeInteraction,undefined);
  before.nodes[2].rectPx.left = before.nodes[2].visibleRectPx.left = 20;
  action.filterTouch.y++;
  assert.equal(evaluate().actual.nativeInteraction,undefined);
  action.filterTouch.y--;
  after.nodes[2].selected = false;
  assert.equal(evaluate().verdict,'FAIL');
  assert.equal(evaluate().actual.nativeInteraction,undefined);
});

test('source category v2 measures four distinct native centers and the All and External edges', () => {
  const contract = JSON.parse(readFileSync(new URL('../cases/source-management.category-touch-edges.json',import.meta.url),'utf8'));
  assert.equal(contract.version,2);
  assert.equal(sourceCategoryNativeChecksValid(contract),true);
  assert.equal(sourceCategoryNativeChecksValid({...contract,assertions:contract.assertions.filter(item =>
    !['source.filter.center.category-music','source.filter.edge.category-other'].includes(item.id))}),false);
  const clicks = [
    ['download','center','other-selected','download-center-selected','other',319,254],
    ['other','center','download-center-selected','other-center-selected','download',960,254],
    ['external','top','other-center-selected','external-edge-selected','other',601,331],
    ['all','top','category-head','all-edge-selected','external',67,239],
    ['comic','center','all-edge-selected','comic-center-selected','all',524,162],
    ['music','center','comic-center-selected','music-center-selected','comic',714,254],
  ];
  const head = contract.steps.find(step=>step.id === 'scroll-categories-head');
  const tail = contract.steps.find(step=>step.id === 'scroll-categories');
  assert.equal(head.from,'external-edge-selected');
  assert.equal(head.target,tail.target);
  assert.deepEqual(head.path,{from:tail.path.to,to:tail.path.from,speed:tail.path.speed});
  for (const [value,position,baselineId,sampleId,previousCategory,left,width] of clicks) {
    const kind = position === 'center' ? 'center' : 'edge';
    const selected = contract.assertions.find(item=>item.id === 'source.filter.'+kind+'.category-'+value);
    const step = contract.steps.find(item=>item.id === selected.action);
    const target = 'source-category-'+value;
    assert.deepEqual([selected.baseline,selected.sample,step.id],[baselineId,sampleId,'tap-'+value+'-'+kind]);
    assert.deepEqual(sourceFilterNativeAssertion(contract,selected),{subject:'category-'+value,target,position});
    const bounds = {left,top:1005,width,height:154};
    const viewport = {left:67,top:1005,width:1147,height:154};
    const before = sample(target);
    Object.assign(before,{sampleId:baselineId});
    before.window.visibleRectPx = {left:0,top:0,width:1280,height:2832};
    Object.assign(before.nodes[0],{rectPx:viewport,visibleRectPx:viewport});
    // An ID wrapper offset from the painted Button must not determine the click.
    Object.assign(before.nodes[1],{rectPx:{...bounds,left:left+8},visibleRectPx:{...bounds,left:left+8}});
    Object.assign(before.nodes[2],{rectPx:{...bounds},visibleRectPx:{...bounds},selected:false});
    const after = structuredClone(before);
    Object.assign(after,{sampleId,beforeSeq:12,afterSeq:13});
    after.nodes[2].selected = true;
    const samples = {[baselineId]:before,[sampleId]:after};
    const operation = requestedOperation(step,samples,contract.fixture);
    assert.deepEqual(operation,{op:'click',x:left+Math.floor(width/2),y:position === 'center' ? 1082 : 1006});
    const journal = [{event:'command',ok:true,seq:1,
      args:['shell','uitest','uiInput','click',String(operation.x),String(operation.y)]}];
    const command = requireActionDispatch(journal,1,operation);
    const action = {op:'click',targetId:target,from:baselineId,instanceId:'current',beforeSeq:7,afterSeq:10,
      filterTouch:sourceFilterNativeDispatch(contract,step,operation,command.seq),
      ...(position === 'top' ? {edgeTap:{edge:'top',x:operation.x,y:operation.y,probeSeq:command.seq,requireFullContainment:true}} : {})};
    const prior = {owner,readFact:'current',state:'rows',readGeneration:4,filterRevision:9,count:18,
      projected:previousCategory === 'all' ? 18 : 1,category:previousCategory,
      groupIndex:0,queryLength:0,allGroups:true,status:'all'};
    const next = {...prior,trigger:'category',category:value,filterRevision:10,
      projected:value === 'all' ? 18 : 0,state:value === 'all' ? 'rows' : 'filteredEmpty'};
    const event = (eventSeq,projection) => ({kind:'source.projection',channel:'business',instanceId:'current',eventSeq,payload:projection});
    const context = {samples,actions:{[step.id]:action},events:[event(4,prior),event(8,next)]};
    const evaluate = () => evaluateSource({...selected,acceptedSources:selected.sources},context);
    const result = evaluate();
    assert.equal(result.verdict,'PASS',result.reason);
    assert.deepEqual(result.actual.nativeInteraction.dispatch,{x:operation.x,y:operation.y,probeSeq:command.seq});
    action.filterTouch.x++;
    assert.equal(evaluate().verdict,'NOT_RUN');
    action.filterTouch.x--;
    context.events.pop();
    assert.match(evaluate().reason,/was not accepted/u);
    assert.equal(evaluate().verdict,'FAIL');
    const clipped = structuredClone(before);
    clipped.nodes[2].visibleRectPx.width--;
    assert.throws(()=>requestedOperation(step,{[baselineId]:clipped},contract.fixture),/clipped/u);
  }
});

test('source status v3 binds three independently accepted native upper edges before and after the lane swipe', () => {
  const contract = JSON.parse(readFileSync(new URL('../cases/source-management.filter-touch-edges.json',import.meta.url),'utf8'));
  const previous = JSON.parse(readFileSync(new URL('../cases/source-management.filter-selections.json',import.meta.url),'utf8'));
  const swipe = contract.steps.find(step=>step.id === 'scroll-status-tail');
  const calibratedSwipe = previous.steps.find(step=>step.id === 'scroll-status');
  assert.deepEqual(swipe,{...calibratedSwipe,id:'scroll-status-tail',from:'status-unchecked-top'});
  assert.equal(sourceStatusNativeChecksValid(contract),true);
  assert.equal(sourceStatusNativeChecksValid({...contract,assertions:contract.assertions.filter(item =>
    item.id !== 'source.filter.edge.status-error-top')}),false);
  const oldCenter = contract.assertions.find(check=>check.id === 'source.filter.edge.status-all');
  assert.equal(sourceFilterNativeAssertion(contract,oldCenter)?.position,'center');
  const clicks = [
    ['all','category-novel-bottom','enabled',67,203],
    ['unchecked','status-all-top','all',760,252],
    ['error','status-tail','unchecked',451,203],
  ];
  for (const [value,baselineId,priorStatus,left,width] of clicks) {
    const sampleId = 'status-'+value+'-top';
    const selected = contract.assertions.find(item=>item.id === 'source.filter.edge.'+sampleId);
    const carrier = contract.assertions.find(item=>item.id === 'source.filter.carrier.'+sampleId);
    const step = contract.steps.find(item=>item.id === selected.action);
    const target = 'reader-source-status-'+value;
    assert.deepEqual([carrier.sample,selected.baseline,selected.sample,step.id],[
      baselineId,baselineId,sampleId,'select-'+sampleId,
    ]);
    assert.deepEqual(sourceFilterNativeAssertion(contract,selected),{subject:'status-'+value,target,position:'top'});
    const bounds = {left,top:641,width,height:154};
    const viewport = {left:67,top:641,width:1147,height:154};
    const before = sample(target);
    before.sampleId = baselineId;
    before.window.visibleRectPx = {left:0,top:0,width:1280,height:2832};
    Object.assign(before.nodes[0],{rectPx:viewport,visibleRectPx:viewport});
    Object.assign(before.nodes[1],{rectPx:bounds,visibleRectPx:bounds});
    Object.assign(before.nodes[2],{rectPx:bounds,visibleRectPx:bounds,selected:false});
    const after = structuredClone(before);
    Object.assign(after,{sampleId,beforeSeq:12,afterSeq:13});
    after.nodes[2].selected = true;
    const samples = {[baselineId]:before,[sampleId]:after};
    const operation = requestedOperation(step,samples,contract.fixture);
    assert.deepEqual(operation,{op:'click',x:left+Math.floor(width/2),y:642});
    const command = requireActionDispatch([{event:'command',ok:true,seq:1,
      args:['shell','uitest','uiInput','click',String(operation.x),String(operation.y)]}],1,operation);
    const action = {op:'click',targetId:target,from:baselineId,instanceId:'current',beforeSeq:7,afterSeq:10,
      edgeTap:{edge:'top',x:operation.x,y:operation.y,probeSeq:command.seq,requireFullContainment:true},
      filterTouch:sourceFilterNativeDispatch(contract,step,operation,command.seq)};
    const prior = {owner,readFact:'current',state:'rows',readGeneration:4,filterRevision:9,count:18,
      projected:priorStatus === 'all' ? 13 : 3,category:'novel',groupIndex:0,queryLength:0,allGroups:true,status:priorStatus};
    const current = {...prior,trigger:'status',status:value,filterRevision:10,projected:value === 'all' ? 13 : 2};
    const event = (eventSeq,payload) => ({kind:'source.projection',channel:'business',instanceId:'current',eventSeq,payload});
    const context = {samples,actions:{[step.id]:action},events:[event(4,prior),event(8,current)]};
    const evaluate = () => evaluateSource({...selected,acceptedSources:selected.sources},context);
    const result = evaluate();
    assert.equal(result.verdict,'PASS',result.reason);
    assert.deepEqual(result.actual.nativeInteraction.dispatch,{x:operation.x,y:operation.y,probeSeq:command.seq});
    after.nodes[2].selected = false;
    assert.equal(evaluate().verdict,'FAIL');
    after.nodes[2].selected = true;
    current.category = 'all';
    assert.equal(evaluate().verdict,'FAIL');
    current.category = 'novel';
    action.filterTouch.x += 3;
    assert.equal(evaluate().verdict,'NOT_RUN');
    action.filterTouch.x -= 3;
    context.events.pop();
    assert.equal(evaluate().verdict,'FAIL');
    const clipped = structuredClone(before);
    clipped.nodes[0].visibleRectPx.left = bounds.left+1;
    assert.throws(()=>requestedOperation(step,{[baselineId]:clipped},contract.fixture),/clipped/u);
  }
});

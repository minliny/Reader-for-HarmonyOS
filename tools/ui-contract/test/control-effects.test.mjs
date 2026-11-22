import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evaluateMotion } from '../lib/motion.mjs';
import { jsonDigest } from '../lib/evidence.mjs';
import { sampleReadiness } from '../collectors/harmonyos/records.mjs';

const instanceId = 'native-instance';
const readingId = 'reading-1';
function caseDefinition(id) {
  const file = new URL('../cases/' + id + '.json', import.meta.url);
  return JSON.parse(readFileSync(file, 'utf8'));
}

function contract(id, actionId) {
  return caseDefinition(id).assertions.find(item => item.action === actionId);
}

function event(eventSeq, kind, payload) {
  return { eventSeq, kind, instanceId, payload:{ readingId, ...payload } };
}

function fixture(assertion) {
  const expected = assertion.expected;
  const sample = (seq, visible) => ({
    instanceId,
    beforeSeq:seq,
    afterSeq:seq,
    window:{ id:'native-window', keyboard:{ visible } },
    nodes:[{ id:expected.nativeId, visible:true, opacity:1 }],
  });
  const ready = event(7,'reading.ready',{ localBook:true });
  const context = {
    actions:{ 'enter-reading':{ beforeSeq:4, afterSeq:10 },
      [assertion.action]:{ actionId:'normal-device-action', op:expected.op, instanceId, beforeSeq:14, afterSeq:30 } },
    samples:{ [assertion.baseline]:sample(13, true), [assertion.sample]:sample(32, false) },
    events:[ready],
    candidate:{ ownerSources:Object.fromEntries([...expected.ownerSources, assertion.source.split('#')[0]]
      .map(path => [path,'a'.repeat(64)])) },
  };
  return context;
}

function quickSearchResultFixture() {
  const nativeId = 'reader-control-module-search';
  const source = 'entry/src/main/ets/features/reading/ui/ReaderControlSearchContent.ets';
  const assertion = {kind:'control-effect',source:`${source}#selectCurrentResult`,action:'select-first-result',
    baseline:'results-ime-hidden',sample:'selected-reading',expected:{effect:'search-results',op:'click',nativeId,
      ownerSources:[source],submitAction:'submit-quick-search',backAction:'hide-results-ime'}};
  const context = fixture(assertion);
  const scope = 3, epoch = 12;
  const bounds = (left,top,width,height) => ({left,top,width,height});
  const native = (id,type,path,parentPath,rect,extra = {}) => ({id,type,path,parentPath,key:path,visible:true,enabled:true,opacity:1,
    visibleRectPx:rect,rectPx:rect,...extra});
  const stage = () => native('reader-reading-stage','Stack','0/0','0',bounds(0,0,600,1000));
  function sample(seq, keyboard, content) {
    const nodes = [stage()];
    if (content) {
      nodes.push(native(nativeId,'Stack','0/1','0',bounds(30,120,520,520)),
        native('reader-control-search-field','Row','0/1/0','0/1',bounds(45,130,390,50)),
        native('reader-content-search-input-4','TextInput','0/1/0/0','0/1/0',bounds(50,133,380,44),
          {alias:'reader-control-search-editor',focused:keyboard}),
        native('reader-control-search-submit','Button','0/1/1','0/1',bounds(444,130,62,50),{clickable:true}));
    }
    if (content === 'results') {
      nodes.push(native('reader-control-search-results','List','0/1/2','0/1',bounds(30,190,520,420)),
        native(`reader-control-search-result:${scope}:0`,'Button','0/1/2/0','0/1/2',bounds(30,194,520,60),
          {alias:'reader-control-search-first-result',visible:!keyboard,clickable:true}));
    }
    return {instanceId,beforeSeq:seq,afterSeq:seq+1,captureComplete:true,nodes,
      window:{id:'native-window',source:'window-metrics',visibleRectPx:bounds(0,0,600,1000),keyboard:{visible:keyboard}}};
  }
  const action = (op,from,beforeSeq,afterSeq,fields) => ({op,from,instanceId,beforeSeq,afterSeq,...fields});
  Object.assign(context.actions,{
    'enter-reading':action('click','bookshelf',4,10,{}),
    'submit-quick-search':action('click','query-ready',18,25,{targetId:'reader-control-search-submit'}),
    'refocus-with-results':action('click','results-ready',29,31,{targetId:'reader-control-search-field'}),
    'hide-results-ime':action('keyEvent','results-ime',37,40,{key:'Back'}),
    'select-first-result':action('click','results-ime-hidden',46,50,{targetId:'reader-control-search-first-result'}),
  });
  Object.assign(context.samples,{
    'query-ready':sample(16,false,'query'),
    'results-ready':sample(27,false,'results'),
    'results-ime':sample(35,true,'results'),
    'results-ime-hidden':sample(43,false,'results'),
    'selected-reading':sample(58,false,null),
  });
  const business = (seq,kind,payload) => ({...event(seq,kind,payload),channel:'business',evidenceRefs:[{path:`commands/${seq}.json`}]});
  const effect = (seq,phase,facts) => business(seq,'reading.control-effect',{kind:'search-results',phase,
    facts:{scope,form:'quick',epoch,...facts}});
  const publication = effect(22,'published',{rowCount:1});
  const admitted = effect(48,'selection-admitted',{ordinal:0});
  const committed = effect(55,'selection-committed',{ordinal:0,matchingChapter:true,containsTarget:true});
  const consumer = business(38,'reading.control-back-consumer',{consumer:'keyboard',epoch,
    location:{level:'secondary',module:'search',form:'quick'}});
  context.events = [business(7,'reading.ready',{localBook:true}),publication,admitted,committed];
  return {context,publication,admitted,committed,consumer,evaluate:()=>evaluateMotion(assertion,context)};
}

test('Quick Search result effect keeps the current usable row through system Back and commits its real click', () => {
  const proof = quickSearchResultFixture();
  const result = proof.evaluate();
  assert.equal(result.verdict,'PASS');
  assert.deepEqual(result.evidenceRefs.map(ref => ref.path).sort(),
    ['commands/22.json','commands/48.json','commands/55.json','commands/7.json']);
  proof.context.events.splice(2,0,proof.consumer);
  assert.equal(proof.evaluate().verdict,'PASS');
  const imeList = proof.context.samples['results-ime'].nodes.find(node => node.type === 'List');
  imeList.visible = false;
  imeList.visibleRectPx = {...imeList.visibleRectPx,height:0};
  assert.equal(proof.evaluate().verdict,'PASS','IME coverage need not expose the full List or result tap point');
});

test('Quick Search result effect accepts retention only under the hidden inactive dock', () => {
  const proof = quickSearchResultFixture();
  const sample = proof.context.samples['selected-reading'];
  const dock = {id:'reader-control-motion-dock',path:'0/0/1',parentPath:'0/0',visible:true,opacity:0.000680,
    enabled:false,hitTestMode:'HitTestMode.None'};
  const panel = {id:'reader-control-module-search',path:'0/0/1/0',parentPath:dock.path,visible:true,opacity:1};
  sample.nodes.push(dock,panel);
  assert.equal(proof.evaluate().verdict,'PASS');

  for (const [field,value,verdict] of [
    ['opacity',0.03,'FAIL'],
    ['enabled',true,'FAIL'],
    ['hitTestMode','HitTestMode.Default','FAIL'],
    ['opacity',null,'NOT_RUN'],
    ['enabled',null,'NOT_RUN'],
    ['hitTestMode',null,'NOT_RUN'],
  ]) {
    const original = dock[field];
    dock[field] = value;
    const result = proof.evaluate();
    assert.equal(result.verdict,verdict,JSON.stringify(result.actual.findings));
    assert(result.actual.findings.some(finding=>finding.field === 'quick-search-reader-return'));
    dock[field] = original;
  }
  panel.path = '0/0/2';
  panel.parentPath = '0/0';
  assert.equal(proof.evaluate().verdict,'FAIL');
});

test('Quick Search result effect rejects known violations and preserves missing evidence', () => {
  for (const mutate of [
    ({publication}) => { publication.payload.facts.rowCount = 0; },
    ({admitted}) => { admitted.payload.facts.scope++; },
    ({committed}) => { committed.payload.facts.matchingChapter = false; },
    ({committed}) => { committed.payload.facts.containsTarget = false; },
    ({context}) => { context.samples['results-ime-hidden'].nodes.find(node => node.type === 'List').key = 'replaced'; },
    ({context}) => { context.samples['results-ime-hidden'].nodes.find(node => node.type === 'TextInput').key = 'replaced'; },
    ({context}) => { context.samples['results-ime-hidden'].nodes.find(node => node.type === 'TextInput').enabled = false; },
    ({context}) => { context.samples['results-ime-hidden'].nodes.at(-1).id = 'reader-control-search-result:99:0'; },
    ({context}) => {
      const {nodes} = context.samples['results-ime-hidden'];
      nodes.push({...nodes.at(-1),path:'0/1/2/1',id:'reader-control-search-result:3:1',alias:null});
    },
    ({context}) => { context.samples['results-ime-hidden'].nodes.at(-1).clickable = false; },
    ({context}) => { context.samples['results-ime-hidden'].nodes.at(-1).type = 'Row'; },
    ({context}) => { context.samples['results-ime-hidden'].nodes.pop(); },
    ({context}) => { context.samples['results-ime-hidden'].nodes.at(-1).visibleRectPx.top = 900; },
    ({context}) => { context.samples['results-ime-hidden'].window.keyboard.visible = true; },
    ({context}) => { context.samples['selected-reading'].nodes = context.samples['results-ime-hidden'].nodes; },
    ({context,consumer}) => { consumer.payload.consumer = 'panel'; context.events.splice(2,0,consumer); },
    ({context,admitted}) => { context.events.splice(3,0,{...admitted,eventSeq:53}); },
    ({context}) => { context.samples['selected-reading'].window.keyboard.visible = true; },
    ({context}) => { context.actions['select-first-result'].targetId = 'another-row'; },
    ({context}) => {
      delete context.actions['select-first-result'];
      delete context.samples['selected-reading'];
      context.samples['results-ime-hidden'].nodes.length = 1;
    },
  ]) {
    const state = quickSearchResultFixture();
    mutate(state);
    const receipt = state.evaluate();
    assert.equal(receipt.verdict,'FAIL',receipt.reason);
  }
  for (const mutate of [
    ({context,publication}) => { context.events.splice(context.events.indexOf(publication),1); },
    ({context,admitted}) => { context.events.splice(context.events.indexOf(admitted),1); },
    ({committed}) => { delete committed.payload.facts.containsTarget; },
    ({context,consumer}) => { delete consumer.payload.location; context.events.splice(2,0,consumer); },
    ({context}) => { delete context.samples['results-ime-hidden'].nodes.at(-1).clickable; },
    ({context}) => { delete context.samples['results-ime-hidden'].nodes.at(-1).type; },
    ({context}) => { delete context.samples['results-ime-hidden'].nodes.find(node=>node.type === 'List').key; },
    ({context}) => { context.samples['results-ime-hidden'].captureComplete = false; },
    ({context}) => { delete context.actions['select-first-result']; delete context.samples['selected-reading']; },
  ]) {
    const state = quickSearchResultFixture();
    mutate(state);
    const receipt = state.evaluate();
    assert.equal(receipt.verdict,'NOT_RUN',receipt.reason);
  }
});

function directoryScrollFixture() {
  const assertion = contract('reading.control-directory-scroll', 'scroll-chapters');
  const context = fixture(assertion);
  const action = context.actions[assertion.action];
  action.from = assertion.baseline;
  action.targetId = assertion.expected.nativeId;
  const rows = [];
  for (const [index,sample] of Object.values(context.samples).entries()) {
    sample.captureComplete = true;
    sample.window.density = 2;
    Object.assign(sample.nodes[0], { key:'2541', path:'0' });
    const list = { type:'List', key:'2594', path:'0/0', parentPath:'0', visible:true,
      rectPx:{left:93,top:1000,width:915,height:485} };
    const row = { type:'ListItem',key:'2613',path:'0/0/1',parentPath:'0/0',visible:true,
      rectPx:{left:149,top:1200 - index * 84,width:803,height:112},
      visibleRectPx:{left:149,top:1200 - index * 84,width:803,height:112} };
    sample.nodes.push(list,row);
    rows.push(row);
  }
  const directoryEffect = (seq, phase, facts) => ({
    ...event(seq,'reading.control-effect',{ kind:'directory-scroll', phase, facts }), channel:'business',
  });
  const presentation = { tab:'directory', presentation:1 };
  const started = directoryEffect(17,'started',{ ...presentation, offsetVp:0 });
  const settled = directoryEffect(22,'settled',{ ...presentation, beforeOffsetVp:0, offsetVp:42 });
  const ready = context.events[0];
  const assess = (trace = [started, settled]) => {
    context.events = [ready, ...trace];
    return evaluateMotion(assertion,context);
  };
  return {assertion,context,action,started,settled,rows,assess,verdict:trace => assess(trace).verdict};
}

test('directory case requires an ordered swipe trace and movement in the same native List', () => {
  const {assertion,context,action,started,settled,verdict} = directoryScrollFixture();
  assert.equal(verdict(), 'PASS');
  assert.equal(verdict([settled,{...started,eventSeq:24}]), 'FAIL');
  assert.equal(verdict([started,{...started,eventSeq:19},settled]), 'FAIL');
  assert.equal(verdict([started,{...settled,eventSeq:31}]), 'NOT_RUN');
  assert.equal(verdict([started,{...settled,channel:'motion'}]), 'NOT_RUN');

  settled.payload.facts.presentation = 2;
  assert.equal(verdict(), 'NOT_RUN');
  delete settled.payload.facts.presentation;
  delete started.payload.facts.presentation;
  assert.equal(verdict(), 'NOT_RUN');
  settled.payload.facts.presentation = started.payload.facts.presentation = 1;

  const finalList = context.samples[assertion.sample].nodes[1];
  finalList.key = '3039';
  assert.equal(verdict(), 'FAIL');
  finalList.key = null;
  assert.equal(verdict(), 'NOT_RUN');
  finalList.key = '2594';
  action.from = assertion.sample;
  assert.equal(verdict(), 'FAIL');
  action.from = assertion.baseline;
  settled.payload.facts.offsetVp = -3;
  assert.equal(verdict(), 'FAIL');
});

test('directory scroll binds the owner offset to independently moved native chapter rows', () => {
  const {assertion,context,rows,assess,verdict} = directoryScrollFixture();
  assert.equal(verdict(),'PASS');
  const after = context.samples[assertion.sample];
  const row = rows[1];
  const verdictAndReason = () => {
    const result = assess();
    return [result.verdict,result.reason];
  };
  for (const top of [rows[0].rectPx.top,rows[0].rectPx.top + 84,rows[0].rectPx.top - 20]) {
    row.rectPx.top = row.visibleRectPx.top = top;
    assert.deepEqual(verdictAndReason(),['FAIL','native-directory-row-displacement observed deviation']);
  }
  row.rectPx.top = row.visibleRectPx.top = rows[0].rectPx.top - 84;
  row.key = 'replacement';
  assert.deepEqual(verdictAndReason(),['NOT_RUN','native-directory-row-displacement lacks comparable evidence']);
  row.key = rows[0].key;
  row.visibleRectPx.height = 0;
  assert.equal(verdict(),'NOT_RUN');
  row.visibleRectPx.height = row.rectPx.height;
  after.nodes[1].rectPx.top += 84;
  assert.deepEqual(verdictAndReason(),['FAIL','native-directory-scroll-viewport observed deviation']);
});

test('keyboard Back only passes with a native system IME hide, an owner receipt and a retained module', () => {
  const assertion = contract('reading.control-search-editor-back','keyboard-back');
  delete assertion.expected.inlineSearchEditor;
  const context = fixture(assertion);
  assert.equal(evaluateMotion(assertion,context).verdict,'PASS');
  const beforeKeyboard = context.samples[assertion.baseline].window.keyboard.visible;
  context.samples[assertion.baseline].window.keyboard.visible = false;
  assert.equal(evaluateMotion(assertion,context).verdict,'FAIL');
  context.samples[assertion.baseline].window.keyboard.visible = beforeKeyboard;
  context.events.push(event(18,'reading.control-back-consumer',{ consumer:'keyboard' }));
  assert.equal(evaluateMotion(assertion,context).verdict,'PASS');
  context.events.push(event(19,'reading.control-transition-requested',{ direction:'morph' }));
  const wrong = evaluateMotion(assertion,context);
  assert.equal(wrong.verdict,'FAIL');
  assert.equal(wrong.reason,'panel-request observed deviation');
});

test('Search IME Back preserves the same Full inline editor and its owner', () => {
  const assertion = contract('reading.control-search-editor-back','keyboard-back');
  const context = fixture(assertion);
  const field = 'reader-control-search-field';
  const input = 'reader-content-search-input-2';
  const before = context.samples[assertion.baseline];
  const after = context.samples[assertion.sample];
  for (const sample of [before,after]) {
    sample.captureComplete = true;
    Object.assign(sample.nodes[0],{path:'0',key:'2144',type:'Stack'});
    sample.nodes.push({id:field,path:'0/0',parentPath:'0',key:'2196',type:'Row',visible:true});
    sample.nodes.push({id:input,path:'0/0/0',parentPath:'0/0',key:'2207',type:'TextInput',visible:true,enabled:true,
      focused:true,rectPx:{left:165,top:658,width:823,height:51},visibleRectPx:{left:165,top:658,width:823,height:51}});
  }
  context.actions['focus-editor'] = {op:'click',instanceId,targetId:field,from:'expand-state',beforeSeq:10,afterSeq:11};
  Object.assign(context.actions[assertion.action],{from:assertion.baseline,key:'Back'});
  const location = {level:'secondary',module:'search',form:'full',directoryTab:'directory'};
  const layer = (seq,active,generation = 2) => ({...event(seq,'reading.control-layer',{
    origin:'search',inputKind:'inlineEditor',active,generation,epoch:5,location,
  }),channel:'business'});
  const admission = layer(12,true);
  const consumer = {...event(18,'reading.control-back-consumer',{consumer:'keyboard',epoch:5,location}),channel:'business'};
  context.events.push(admission,consumer);
  const verdict = () => {
    const result = evaluateMotion(assertion,context);
    return [result.verdict,result.reason];
  };
  assert.deepEqual(verdict(),['PASS',null]);

  const retained = after.nodes.pop();
  const v1 = structuredClone(assertion);
  delete v1.expected.inlineSearchEditor;
  assert.equal(evaluateMotion(v1,context).verdict,'PASS');
  assert.deepEqual(verdict(),['FAIL','search-inline-editor-continuity observed deviation']);
  after.captureComplete = false;
  assert.equal(verdict()[0],'NOT_RUN');
  after.captureComplete = true;
  after.nodes.push(retained);
  retained.key = '9999';
  assert.deepEqual(verdict(),['FAIL','search-inline-editor-continuity observed deviation']);
  retained.key = '2207';
  retained.id = 'reader-content-search-input-3';
  assert.deepEqual(verdict(),['FAIL','search-inline-editor-continuity observed deviation']);
  retained.id = input;
  retained.parentPath = '0';
  assert.deepEqual(verdict(),['FAIL','search-inline-editor-continuity observed deviation']);
  retained.parentPath = '0/0';
  after.nodes[0].key = '8844';
  assert.deepEqual(verdict(),['FAIL','search-inline-editor-continuity observed deviation']);
  after.nodes[0].key = '2144';
  after.window.id = 'different-window';
  assert.deepEqual(verdict(),['FAIL','search-editor-window-continuity observed deviation']);
  after.window.id = before.window.id;

  const released = layer(20,false);
  retained.focused = false;
  assert.equal(verdict()[0],'NOT_RUN');
  context.events.push(released);
  assert.deepEqual(verdict(),['PASS',null]);
  context.events = context.events.filter(item => item !== consumer);
  assert.deepEqual(verdict(),['PASS',null],'system IME may own the Back before the App handler');
  after.window.keyboard.visible = true;
  assert.equal(verdict()[0],'FAIL','retained IME contradicts the verified system consumption');
  after.window.keyboard.visible = false;
  context.events.push(consumer);
  retained.focused = true;
  assert.deepEqual(verdict(),['PASS',null],'native focus may remain after business editing retires');
  released.payload.generation = 3;
  assert.deepEqual(verdict(),['FAIL','search-inline-editor-owner observed deviation']);
  released.payload.generation = 2;
  consumer.payload.epoch = 6;
  assert.deepEqual(verdict(),['FAIL','search-inline-editor-owner observed deviation']);
  consumer.payload.epoch = 5;
  context.events.push(layer(22,true,3));
  assert.deepEqual(verdict(),['FAIL','search-inline-editor-owner observed deviation']);
  context.events.pop();
  context.events = context.events.filter(item => item !== admission);
  assert.equal(verdict()[0],'NOT_RUN');
});

test('missing effect fields produce serializable missing diagnostics', () => {
  const assertion = contract('reading.control-font-reorder','reorder-font');
  const context = fixture(assertion);
  const result = evaluateMotion(assertion,context);
  assert.equal(result.verdict,'NOT_RUN');
  assert.equal(typeof jsonDigest(result),'string');
});

test('font reorder requires independent native slot exchange and restoration', () => {
  const reorder = contract('reading.control-font-reorder','reorder-font');
  const restore = contract('reading.control-font-reorder','restore-font-order');
  const historicalScope = structuredClone(reorder);
  delete historicalScope.expected.fontSwap;
  const context = fixture(reorder);
  const [initial,swapped] = [['system','serif','sans'],['serif','system','sans']];
  const {nativeId} = reorder.expected;
  const {gridId,targetId} = reorder.expected.fontSwap;
  assert.deepEqual(restore.expected.fontSwap,reorder.expected.fontSwap);
  const initialId = reorder.baseline;
  const movedId = reorder.sample;
  const restoredId = restore.sample;
  // Calibrated from the normal .2fad Full Appearance native tree. The scroll viewport clips the grid, not these slots.
  const box = (left,top,width,height) => ({left,top,width,height});
  const slot = (id,key,path,left) => ({id,key,path,parentPath:'0',visible:true,opacity:1,
    rectPx:box(left,1477,236,105),visibleRectPx:box(left,1477,236,105)});
  const sample = (seq,exchanged,path) => ({
    instanceId,beforeSeq:seq,afterSeq:seq,captureComplete:true,
    window:{id:'native-window',density:3.5},evidenceRefs:[{path}],
    nodes:[{id:gridId,key:'3131',type:'Stack',path:'0',visible:true,opacity:1,
      rectPx:box(89,588,1104,2422),visibleRectPx:box(89,588,1104,2101)},
    slot(nativeId,'3199','0/23',exchanged ? 391 : 128),slot(targetId,'3203','0/24',exchanged ? 128 : 391)],
  });
  context.samples = {
    [initialId]:sample(13,false,'raw/font-initial.json'),
    [movedId]:sample(32,true,'raw/font-exchanged.json'),
    [restoredId]:sample(51,false,'raw/font-restored.json'),
  };
  Object.assign(context.actions[reorder.action],{from:initialId,targetId:nativeId});
  context.actions[restore.action] = {...context.actions[reorder.action],actionId:'reverse-device-action',
    beforeSeq:34,afterSeq:49,from:movedId};
  const effect = (seq,phase,facts,channel = 'business') => ({
    ...event(seq,'reading.control-effect',{kind:'font-reorder',phase,facts}),channel,
  });
  const trace = (seq,type,durationMs,order,generation) => {
    const id = type === 'shift' ? targetId : nativeId;
    const anchor = {mounted:true,uniqueId:3131,windowOriginVp:{x:0,y:0}};
    const frames = [0,.5,1].map((fraction,index) => ({index,tickMs:100 + fraction * durationMs,grid:anchor,
      slots:[{id,mounted:true,parentUniqueId:3131,windowOriginVp:{x:[0,68,100][index],y:0}}]}));
    return effect(seq,'trace',{reason:type === 'shift' ? 'interrupted' : 'completed',run:{type,durationMs,
      order:[...order],generation,fromTickMs:100,omitted:0,frames,tracks:[{id,from:{x:0,y:0},to:{x:100,y:0}}]}},'motion');
  };
  const activity = (seq,original,order) => [
    effect(seq,'drag-started',{font:'system',order:original,generation:seq}),
    trace(seq + 1,'shift',120,order,seq + 1),
    effect(seq + 2,'drag-released',{commit:true,changed:true,order}),
    effect(seq + 3,'order-admitted',{requested:order,order}),
    trace(seq + 4,'settle',160,order,seq + 3),
  ];
  context.events.push(...activity(17,initial,swapped),...activity(37,swapped,initial));
  const assess = assertion => evaluateMotion(assertion,context);
  const verdict = assertion => {
    const result = assess(assertion);
    return [result.verdict,result.reason];
  };
  const success = ['PASS',null];
  assert.deepEqual(verdict(reorder),success);
  assert.deepEqual(verdict(restore),success);
  const [firstShift,firstSettle] = [18,21].map(seq => context.events.find(item => item.eventSeq === seq).payload.facts.run);
  for (const [run,wrong,diagnostic] of [
    [firstShift,nativeId,'shift-font-actor'],
    [firstSettle,targetId,'settle-font-actor'],
  ]) {
    const right = run.tracks[0].id;
    run.tracks[0].id = wrong;
    for (const frame of run.frames) frame.slots[0].id = wrong;
    assert.deepEqual(verdict(reorder),['FAIL',`${diagnostic} observed deviation`]);
    assert.equal(evaluateMotion(historicalScope,context).verdict,'PASS');
    run.tracks[0].id = right;
    for (const frame of run.frames) frame.slots[0].id = right;
  }
  const generation = firstShift.generation;
  firstShift.generation = 16;
  assert.deepEqual(verdict(reorder),['FAIL','font-trace-causal-owner observed deviation']);
  delete firstShift.generation;
  assert.deepEqual(verdict(reorder),['NOT_RUN','font-trace-causal-owner lacks comparable evidence']);
  firstShift.generation = generation;
  const order = firstSettle.order;
  firstSettle.order = initial;
  assert.deepEqual(verdict(reorder),['FAIL','font-trace-causal-owner observed deviation']);
  firstSettle.order = order;

  const moved = context.samples[movedId];
  context.samples[movedId] = sample(32,false,'raw/font-stationary.json');
  assert.equal(evaluateMotion(historicalScope,context).verdict,'PASS');
  assert.deepEqual(verdict(reorder),['FAIL','native-font-slot-exchange observed deviation']);
  context.samples[movedId] = moved;

  const target = moved.nodes[2];
  target.parentPath = null;
  assert.deepEqual(verdict(reorder),['FAIL','native-font-grid-ownership observed deviation']);
  target.parentPath = '0';
  target.visibleRectPx.height -= 12;
  assert.deepEqual(verdict(reorder),['NOT_RUN','native-font-slot-exchange lacks comparable evidence']);
  target.visibleRectPx.height += 12;
  moved.nodes.push({...target,path:'0/26'});
  assert.equal(assess(reorder).verdict,'NOT_RUN');
  moved.nodes.pop();
  moved.captureComplete = false;
  assert.equal(assess(reorder).verdict,'NOT_RUN');
  moved.captureComplete = true;
  moved.window.density = 4;
  assert.equal(assess(reorder).verdict,'NOT_RUN');
  moved.window.density = 3.5;

  const truthfulEvents = context.events;
  context.events = [context.events[0],...activity(17,initial,['serif','sans','system']),...context.events.slice(6)];
  assert.deepEqual(verdict(reorder),['FAIL','font-order-adjacent-swap observed deviation']);
  context.events = truthfulEvents;
  context.events.push(effect(23,'order-admitted',{requested:swapped,order:swapped}));
  assert.deepEqual(verdict(reorder),['FAIL','font-drag-admission-sequence observed deviation']);
  context.events.pop();

  const initialSample = context.samples[initialId];
  delete context.samples[initialId];
  assert.deepEqual(verdict(restore),['NOT_RUN','native-font-slot-restoration lacks comparable evidence']);
  context.samples[initialId] = initialSample;
  assert.ok(assess(restore).evidenceRefs.some(ref => ref.path === 'raw/font-initial.json'));
  initialSample.nodes[1].rectPx.left -= 17;
  initialSample.nodes[1].visibleRectPx.left -= 17;
  assert.deepEqual(verdict(restore),['FAIL','native-font-slot-restoration observed deviation']);
});

test('font reorder landed drag stays inside the adjacent real slot and leaves measurable release motion', async () => {
  const { readerControlAppearanceFontDropIndex } =
    await import('../../../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceGeometry.ts');
  const { requestedOperation } = await import('../collectors/harmonyos/records.mjs');
  const definition = JSON.parse(readFileSync(new URL('../cases/reading.control-font-reorder.json',import.meta.url),'utf8'));
  const density = 3.5, widthPx = 236;
  const windowX = 89, windowY = 588;
  const yPx = 1477;
  const frame = { sectionWidth:widthPx / density * 4 + 24,themeExtraRows:0 };
  const native = (id,left) => ({
    id,path:left === 128 ? '0/23' : '0/24',source:'native-tree',visible:true,enabled:true,opacity:1,
    visibleRectPx:{left,top:yPx,width:widthPx,height:105},
  });
  for (const [actionId,fromX,toX,slot] of [['reorder-font',128,391,1],['restore-font-order',391,128,0]]) {
    const action = definition.steps.find(step => step.id === actionId);
    const system = native('reader-control-font-system',fromX);
    const serif = native('reader-control-font-serif',toX);
    const captured = {nodes:[system,serif]};
    const drag = requestedOperation(action,{[action.from]:captured},definition.fixture);
    assert.equal(drag.op,'drag');
    assert.equal(drag.fromY,drag.toY);
    assert.ok(drag.toX > toX && drag.toX < toX + widthPx);
    const dx = (drag.toX - drag.fromX) / density;
    const originX = (fromX - windowX) / density;
    const originY = (yPx - windowY) / density;
    assert.equal(readerControlAppearanceFontDropIndex(frame,originX,originY,dx,0,9),slot);
    const releaseDelta = originX + dx - (toX - windowX) / density;
    assert.ok(releaseDelta > 8 && releaseDelta < 12);
  }
});

test('font release starts one settle toward the requested order while Host admission is pending', async () => {
  const {selectedProductionMethods} = await import('../../lib/selected-production-methods.mjs');
  const source = new URL('../../../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceContent.ets',import.meta.url);
  const TouchType = { Down:0, Move:1, Up:2, Cancel:3 };
  class MotionPointTrack {
    constructor(from,to) { this.from=from; this.to=to; }
    sample() { return this.from; }
  }
  class ReaderControlFontVerificationTrack {
    constructor(id,fromX,fromY,toX,toY) {
      Object.assign(this,{id,from:{x:fromX,y:fromY},to:{x:toX,y:toY}});
    }
  }
  const Appearance = selectedProductionMethods(source,'ReaderControlAppearanceContent',[
    'fontTouch','settleFontDrag','cancelFontDrag','animateFontPositions','fontIds','fontActor','fontActorAt',
    'fontCellPosition','captureFontPositions','retireFontOrderPresentation','observeFontOrderPresentation',
  ],{
    TouchType,MotionPointTrack,ReaderControlFontVerificationTrack,readerMotionNowMs:() => 100,
    normalizeReaderAppearanceFontOrder:order => order.slice(),
    motionSpecGet:() => ({durationMs:160}),
    readerControlAppearanceFontActor:(_frame,_quickIndex,fullIndex) => ({x:fullIndex*40,y:0}),
  });
  const setup = () => {
    const snapshot = {fontOrder:['system','serif']};
    const starts = [];
    const requests = [];
    const callbacks = [];
    const owner = Object.assign(new Appearance(),{
      draggedFontId:'system',fontPointerId:7,fontOriginalIndex:0,fontMotionGeneration:4,previewFontOrder:['serif','system'],
      fontOrigin:{x:0,y:0},draggedFontOffsetX:36,draggedFontOffsetY:0,fontDownX:20,fontDownY:30,
      fontTracks:new Map(),frame:() => ({}),actorPosition:actor => actor,fontOrderKey:'',
      displaySnapshot:() => snapshot,displayedFacts:() => undefined,fullInput:() => true,fontInput:() => true,
      updateFontDrag() {},onFontReorderActivityChange() {},
      onFontOrderChange(order) {
        requests.push(order);
        return {displayed:new Promise(() => {}),current:() => true,retire() {}};
      },
      scheduleFontFrame:generation => callbacks.push(generation),
      verificationSession:{observing:() => true,effect() {}},
      fontVerification:{finish() {},begin:(_owner,generation,type,_tick,_duration,order,tracks) =>
        starts.push({generation,type,order,tracks})},
    });
    return {owner,starts,requests,callbacks,snapshot};
  };
  const current = setup();
  const up = {type:TouchType.Up,changedTouches:[{id:7,windowX:56,windowY:30}],stopPropagation() {}};
  current.owner.fontTouch('system',up);
  assert.deepEqual(current.requests,[['serif','system']]);
  assert.equal(current.owner.fontPointerId,-1);
  assert.equal(current.starts.length,1,'this UP queues exactly one settle');
  assert.deepEqual(current.callbacks,[current.starts[0].generation]);
  assert.deepEqual(current.starts[0].order,['serif','system']);
  assert.deepEqual(current.starts[0].tracks.map(track => [track.id,track.to.x]),
    [['reader-control-font-serif',0],['reader-control-font-system',40]]);
  assert.deepEqual(current.snapshot.fontOrder,['system','serif']);
  assert.deepEqual(current.owner.fontIds(),['system','serif'],'only the Host admits the displayed order after the settle');
  current.owner.fontTouch('system',up);
  assert.equal(current.starts.length,1);

  const cancelled = setup();
  cancelled.owner.fontTouch('system',{...up,type:TouchType.Cancel});
  assert.deepEqual(cancelled.requests,[]);
  assert.deepEqual(cancelled.starts.map(start => start.order),[['system','serif']]);
  assert.deepEqual(cancelled.starts[0].tracks.map(track => [track.id,track.to.x]),
    [['reader-control-font-system',0],['reader-control-font-serif',40]]);
});

test('Directory keyboard Back binds its admitted inline editor to the same Full module epoch', () => {
  const assertion = contract('reading.control-directory-editor-back', 'directory-editor-back');
  const context = fixture(assertion);
  const expected = assertion.expected;
  context.actions[expected.restoreAction] = { beforeSeq:10, afterSeq:12 };
  for (const sample of Object.values(context.samples)) {
    sample.nodes[0].path = '0';
    sample.nodes.push(
      { id:expected.editorId, key:'7844', path:'0.0', parentPath:'0', enabled:true, visible:true,
        focused:sample === context.samples[assertion.baseline] },
      { id:'reader-control-collapse', path:'0.1', parentPath:'0', visible:true,
        enabled:sample !== context.samples[assertion.baseline] },
    );
  }
  const location = { level:'secondary', module:'directory', form:'full', directoryTab:'directory' };
  context.events.push({
    ...event(11,'reading.control-layer',{ origin:'directory', inputKind:'inlineEditor', active:true, generation:2, epoch:10, location }),
    channel:'business',
  });
  const handled = event(18,'reading.control-back-consumer',{ consumer:'keyboard', epoch:10, location });
  context.events.push(handled);
  const pass = evaluateMotion(assertion,context);
  assert.equal(pass.verdict,'PASS', JSON.stringify(pass.actual.findings));
  handled.payload.location = { ...location, directoryTab:'bookmarks' };
  const wrongTab = evaluateMotion(assertion,context);
  assert.equal(wrongTab.verdict,'FAIL');
  assert.equal(wrongTab.reason,'directory-inline-editor-owner observed deviation');

  context.events = context.events.filter(event => event !== handled);
  assert.equal(evaluateMotion(assertion,context).verdict,'NOT_RUN');
  const released = {
    ...event(19,'reading.control-layer',{ origin:'directory', inputKind:'inlineEditor', active:false,
      generation:2, epoch:10, location }),
    channel:'business',
  };
  context.events.push(released);
  const systemIme = evaluateMotion(assertion,context);
  assert.equal(systemIme.verdict,'PASS', JSON.stringify(systemIme.actual.findings));
  assert.notEqual(systemIme.actual.findings.find(item => item.field === 'back-consumer')?.missing,true);
  assert.notEqual(systemIme.actual.findings.find(item => item.field === 'directory-inline-editor-owner')?.missing,true);
  released.payload.epoch += 1;
  const wrongSystemOwner = evaluateMotion(assertion,context);
  assert.equal(wrongSystemOwner.verdict,'FAIL');
  assert.equal(wrongSystemOwner.reason,'directory-inline-editor-owner observed deviation');
  released.payload.epoch -= 1;
  const release = contract('reading.control-directory-editor-release-back', 'directory-editor-back');
  delete release.expected.requireSelectableDirectoryRow;
  for (const path of release.expected.ownerSources) context.candidate.ownerSources[path] ??= 'a'.repeat(64);
  const sameGeneration = evaluateMotion(release,context);
  assert.equal(sameGeneration.verdict,'PASS', JSON.stringify(sameGeneration.actual.findings));
  released.payload.generation += 1;
  const wrongGeneration = evaluateMotion(release,context);
  assert.equal(wrongGeneration.verdict,'FAIL');
  assert.equal(wrongGeneration.reason,'directory-editor-layer-release observed deviation');

  const soft = contract('reading.control-directory-soft-ime-hide', 'directory-soft-ime-hide');
  delete soft.expected.requireSelectableDirectoryRow;
  for (const path of soft.expected.ownerSources) context.candidate.ownerSources[path] ??= 'a'.repeat(64);
  context.actions[soft.action] = { ...context.actions[assertion.action], op:'tapImeHide' };
  context.samples[soft.baseline].imeHideKey = { keyId:'KeyHideKbd' };
  const editorAfter = context.samples[soft.sample].nodes[1];
  context.events = context.events.filter(event => event !== released);
  editorAfter.focused = true;
  assert.equal(evaluateMotion(soft,context).verdict,'PASS');
  editorAfter.focused = false;
  assert.equal(evaluateMotion(soft,context).verdict,'NOT_RUN');
  released.payload.generation = 2;
  context.events.push(released);
  assert.equal(evaluateMotion(soft,context).verdict,'PASS');
});

test('Directory IME hide restores an enabled native chapter row in the retained list', () => {
  for (const [caseId,actionId] of [
    ['reading.control-directory-soft-ime-hide','directory-soft-ime-hide'],
    ['reading.control-directory-editor-release-back','directory-editor-back'],
  ]) {
    const definition = caseDefinition(caseId);
    const assertion = definition.assertions.find(item => item.action === actionId);
    const context = fixture(assertion);
    const { editorId, restoreAction, softImeHide } = assertion.expected;
    const before = context.samples[assertion.baseline];
    const after = context.samples[assertion.sample];
    const box = (left,top,width,height) => ({left,top,width,height});
    const rowBounds = box(128,935,936,140);
    for (const [index,sample] of [before,after].entries()) {
      sample.captureComplete = true;
      sample.window.visibleRectPx = box(0,0,1280,2734);
      Object.assign(sample.nodes[0],{ path:'0/0', parentPath:'0', type:'Stack', key:'18046' });
      sample.nodes.push(
        { id:'reader-reading-stage', path:'0', visible:true, opacity:1 },
        { id:editorId, path:'0/0/0', parentPath:'0/0', type:'TextInput', key:'18118', visible:true, enabled:true, opacity:1,
          focused:index === 0 || softImeHide === true },
        { path:'0/0/1', parentPath:'0/0', type:'List', key:'18127', visible:true,
          visibleRectPx:box(93,935,1097,index === 0 ? 628 : 1583) },
        { path:'0/0/1/0', parentPath:'0/0/1', type:'ListItem', key:'18132', visible:true },
        { path:'0/0/1/0/0', parentPath:'0/0/1/0', type:'Row', key:'18136', visible:true, clickable:false },
        { path:'0/0/1/0/0/0', parentPath:'0/0/1/0/0', type:'Row', key:'18137', visible:true, enabled:true,
          clickable:true, opacity:1, visibleRectPx:rowBounds },
        { path:'0/0/1/0/0/1', parentPath:'0/0/1/0/0', type:'Button', key:'18143', visible:true, enabled:true,
          clickable:true, opacity:1, visibleRectPx:box(1064,960,91,91) },
      );
    }
    const location = {level:'secondary',module:'directory',form:'full',directoryTab:'directory'};
    const layer = (seq,active) => ({...event(seq,'reading.control-layer',{
      origin:'directory',inputKind:'inlineEditor',active,generation:2,epoch:10,location,
    }),channel:'business'});
    context.actions[restoreAction] = { beforeSeq:10, afterSeq:12 };
    context.events.push(layer(11,true));
    if (softImeHide) before.imeHideKey = { keyId:'KeyHideKbd' };
    else context.events.push(layer(19,false));
    const result = () => evaluateMotion(assertion,context);
    assert.equal(result().verdict,'PASS',caseId);

    const v1 = structuredClone(assertion);
    delete v1.expected.requireSelectableDirectoryRow;
    const row = after.nodes.splice(6,1)[0];
    assert.equal(evaluateMotion(v1,context).verdict,'PASS','the original v1 did not test the chapter action');
    assert.equal(result().reason,'native-directory-selectable-chapter-row observed deviation',caseId);
    assert.equal(result().verdict,'FAIL',caseId);
    const endpoint = definition.steps.find(step => step.id === assertion.sample);
    assert.equal(sampleReadiness(endpoint,after,definition.fixture.bookTitle),null,'a complete tree without a chapter row is retained');
    after.captureComplete = false;
    assert.equal(result().verdict,'NOT_RUN',caseId);
    after.captureComplete = true;
    after.nodes.push(row);
    row.enabled = false;
    assert.equal(result().verdict,'FAIL',caseId);
    row.enabled = true;
    row.clickable = false;
    assert.equal(result().verdict,'FAIL',caseId);
    row.clickable = true;
    row.visibleRectPx = box(128,2518,936,140);
    assert.equal(result().verdict,'FAIL','row has no visible tap point in the List viewport');
    row.visibleRectPx = undefined;
    assert.equal(result().verdict,'NOT_RUN','bounds for a known candidate row are unavailable');
    row.visibleRectPx = rowBounds;
    const list = after.nodes.find(item => item.type === 'List');
    list.key = '9999';
    assert.equal(result().reason,'native-directory-ime-list-continuity observed deviation');
    list.key = undefined;
    assert.equal(result().verdict,'NOT_RUN','the matched List mount key is unavailable');
    list.key = '18127';
    const stageAndEditor = after.nodes.slice(0,3);
    const retained = after.nodes;
    after.nodes = stageAndEditor;
    assert.equal(result().reason,'native-directory-ime-list-continuity observed deviation');
    if (softImeHide) {
      after.nodes = [stageAndEditor[1]];
      assert.equal(sampleReadiness(endpoint,after,definition.fixture.bookTitle),null,'the stage remains when Directory is lost');
      assert.equal(result().verdict,'FAIL');
    }
    after.nodes = retained;
    assert.equal(result().verdict,'PASS','the same list may expand vertically after IME hides');
  }
});

function popupProof(assertion) {
  const context = fixture(assertion);
  const { expected } = assertion;
  const trigger = expected.triggers[0];
  context.samples[assertion.baseline].nodes.push({ id:trigger, visible:true, rectPx:{left:1,top:1,width:44,height:44} });
  const menu = { id:expected.nativeId, uniqueId:321, mounted:true, ancestors:[{uniqueId:22}],
    opacity:1, windowOriginVp:{x:160,y:118}, clipToFrame:true, inspectorSource:'FrameNode.getInspectorInfo' };
  const owner = { status:'measured', type:'Popup', relation:'scroll-ancestor', uniqueId:22, scrollUniqueId:321,
    windowOriginVp:{x:0,y:0}, parentOriginVp:{x:0,y:0}, widthVp:360, heightVp:800,
    clipToFrame:false, zIndex:0 };
  const frames = [.1,.3,.6,.85,1].map((opacity,i) => ({
    frameTimeNs:(i + 1) * 16e6,
    menu:{...menu}, popupOwner:{...owner, opacity}, mountedActions:expected.actions,
    ...(i === 0 ? {trigger:{id:trigger, mounted:true}} : {}),
  }));
  function trace(seq, visible, values) {
    return { ...event(seq,'reading.control-effect',{ kind:'more-popup', phase:'trace',
      facts:{generation:1, visible, layout:trigger, frames:values} }), channel:'motion' };
  }
  function current(values) {
    context.events.push(
      event(17,'reading.control-layer',{origin:'more',active:expected.visible,generation:1}),
      event(18,'reading.control-effect',{kind:'more-popup',phase:'native-state',facts:{visible:expected.visible,generation:1}}),
      trace(23,expected.visible,values),
    );
  }
  return { context, frames, trace, current };
}

function legacyPopupPath(assertion) {
  const copy = structuredClone(assertion);
  delete copy.expected.requireStablePopupProjection;
  return copy;
}

test('Popup opening requires a continuous path of the bound native host', () => {
  const assertion = legacyPopupPath(contract('reading.control-more-popup','open-more'));
  const { context, frames, current } = popupProof(assertion);
  current(frames);
  assert.equal(evaluateMotion(assertion,context).verdict,'PASS');
  frames[1].popupOwner.zIndex = undefined;
  assert.equal(evaluateMotion(assertion,context).reason,'popup-frame-coverage lacks comparable evidence');
  frames[1].popupOwner.zIndex = 0;
  for (const frame of frames.slice(2)) frame.frameTimeNs += 320e6;
  const sparse = evaluateMotion(assertion,context);
  assert.equal(sparse.verdict,'NOT_RUN');
  assert.equal(sparse.reason,'popup-frame-coverage lacks comparable evidence');
  for (const frame of frames.slice(2)) frame.frameTimeNs -= 320e6;
  frames[3].popupOwner.opacity = .4;
  assert.equal(evaluateMotion(assertion,context).verdict,'FAIL');
  for (const [i,frame] of frames.entries()) {
    delete frame.popupOwner;
    frame.menu.opacity = (i + 1) / frames.length;
  }
  assert.equal(evaluateMotion(assertion,context).verdict,'NOT_RUN');
});

test('Popup close native path is bound to the exact platform host previously reached from the Scroll', () => {
  const assertion = legacyPopupPath(contract('reading.control-more-popup','close-more'));
  const { context, frames, trace, current } = popupProof(assertion);
  const opening = frames.map(frame => ({...frame, menu:{...frame.menu}, popupOwner:{...frame.popupOwner}}));
  context.actions['open-more'] = {beforeSeq:10, afterSeq:12};
  context.events.push(trace(11,true,opening));
  context.samples[assertion.sample].nodes = [];
  for (const [i,frame] of frames.entries()) {
    frame.popupOwner.relation = 'known-host';
    frame.popupOwner.opacity = 1 - i / (frames.length - 1);
    frame.menu.mounted = false;
  }
  current(frames);
  assert.equal(evaluateMotion(assertion,context).verdict,'PASS');
  const detached = {frameTimeNs:96e6, menu:{mounted:false}, popupOwner:{status:'known-owner-unavailable'}};
  frames.push(detached);
  assert.equal(evaluateMotion(assertion,context).verdict,'PASS');
  for (const frame of frames.slice(0,-1)) frame.popupOwner.opacity = .5;
  assert.equal(evaluateMotion(assertion,context).reason,'popup-native-path lacks comparable evidence');
  frames[1].popupOwner.uniqueId = 99;
  assert.equal(evaluateMotion(assertion,context).reason,'popup-frame-coverage lacks comparable evidence');
});

test('Popup requires a native stable projection across its owner path and Back', () => {
  const open = contract('reading.control-more-popup','open-more');
  const close = contract('reading.control-more-popup','close-more');
  const trigger = open.expected.triggers[0];
  const menu = open.expected.nativeId;
  const home = 'reader-control-module-home';
  const box = (left,top,width,height) => ({left,top,width,height});
  const native = (id,type,key,path,parentPath,rectPx,opacity = 1) => ({id,type,key,path,parentPath,
    rectPx,visibleRectPx:{...rectPx},visible:true,opacity});
  const sample = (seq,visible) => ({instanceId,afterSeq:seq,beforeSeq:seq,captureComplete:true,
    window:{id:'native-window',density:3.5,rectPx:box(0,0,1280,2832)},
    nodes:[native(trigger,'Button','24642','0/0','0',box(1026,189,154,154)),
      native(home,'Scroll','24645','0/1','0',box(89,1689,922,657)),
      ...(visible ? [native(null,'Popup','24753','0/2','0',box(0,0,1280,2832)),
        native(menu,'Scroll','24758','0/2/0','0/2',box(564,413,616,525)),
        ...open.expected.actions.map((name,index) => native(`${menu}-item-${name}`,'Button',
          String(24762 + index * 8),`0/2/0/${index}`,'0/2/0',box(564,413 + index * 175,616,175),index === 2 ? .45 : 1))] : [])],
  });
  const setup = assertion => {
    const {context,frames,trace,current} = popupProof(assertion);
    const visible = assertion.expected.visible;
    context.samples = {[assertion.baseline]:sample(13,!visible),[assertion.sample]:sample(32,visible)};
    const action = context.actions[assertion.action];
    Object.assign(action,{from:assertion.baseline,...(visible ? {targetId:trigger} : {key:'Back'})});
    for (const frame of frames) {
      frame.menu.uniqueId = 24329;
      frame.menu.windowOriginVp = {x:564/3.5,y:118};
      frame.menu.layoutRectVp = {x:564/3.5,y:118,width:176,height:150};
      frame.popupOwner.scrollUniqueId = 24329;
    }
    if (!visible) {
      context.actions['open-more'] = {beforeSeq:10,afterSeq:12,instanceId,op:'click',targetId:trigger,from:open.baseline};
      context.events.push(trace(11,true,structuredClone(frames)));
      for (const [index,frame] of frames.entries()) {
        frame.menu.mounted = false;
        frame.popupOwner.relation = 'known-host';
        frame.popupOwner.opacity = 1 - index / (frames.length - 1);
      }
    }
    current(frames);
    const verdict = () => {
      const result = evaluateMotion(assertion,context);
      return [result.verdict,result.reason];
    };
    return {context,action,frames,verdict};
  };

  const opened = setup(open);
  assert.deepEqual(opened.verdict(),['PASS',null]);
  const stableMenu = opened.context.samples[open.sample].nodes.find(item => item.id === menu);
  stableMenu.parentPath = '0';
  assert.equal(evaluateMotion(legacyPopupPath(open),opened.context).verdict,'PASS');
  assert.deepEqual(opened.verdict(),['FAIL','popup-stable-open-projection observed deviation']);
  stableMenu.parentPath = '0/2';
  stableMenu.rectPx.left += 21;
  stableMenu.visibleRectPx.left += 21;
  assert.deepEqual(opened.verdict(),['FAIL','popup-stable-layout-binding observed deviation']);
  stableMenu.rectPx.left -= 21;
  stableMenu.visibleRectPx.left -= 21;
  const download = opened.context.samples[open.sample].nodes.find(item => item.id === `${menu}-item-download`);
  download.opacity = 0;
  assert.deepEqual(opened.verdict(),['FAIL','popup-stable-open-projection observed deviation']);
  download.opacity = .45;
  opened.action.targetId = open.expected.triggers[1];
  assert.deepEqual(opened.verdict(),['FAIL','popup-stable-trigger-dispatch observed deviation']);
  opened.action.targetId = trigger;
  for (const frame of opened.frames) frame.popupOwner.opacity = 1;
  assert.deepEqual(opened.verdict(),['NOT_RUN','popup-native-path lacks comparable evidence']);

  const closed = setup(close);
  assert.deepEqual(closed.verdict(),['PASS',null]);
  const closeTree = closed.context.samples[close.sample];
  closeTree.nodes.push(...[3,4].map(index => native(menu,'Scroll',String(index),`0/${index}`,'0',box(564,413,616,525))));
  assert.equal(evaluateMotion(legacyPopupPath(close),closed.context).verdict,'PASS');
  assert.deepEqual(closed.verdict(),['FAIL','popup-stable-close-projection observed deviation']);
  closeTree.nodes.splice(2);
  closeTree.nodes.find(item => item.id === home).key = 'replacement';
  assert.deepEqual(closed.verdict(),['FAIL','popup-stable-parent-retention observed deviation']);
  closeTree.nodes.find(item => item.id === home).key = '24645';
  closeTree.captureComplete = false;
  assert.equal(closed.verdict()[0],'NOT_RUN');
});

test('Replace editor IME Back retains its original native draft and modal generation', () => {
  const assertion = contract('reading.control-replace-editor-ime-back', 'replace-editor-ime-back');
  const context = fixture(assertion);
  const { field, overlay } = assertion.expected.modalEditor;
  context.actions['open-layer'] = { beforeSeq:9, afterSeq:12 };
  for (const [name, sample] of Object.entries(context.samples)) {
    sample.nodes.push(
      { id:overlay, path:'0/1', key:'109', visible:true },
      { id:field, path:'0/1/0', parentPath:'0/1', key:'110', focused:name === assertion.baseline, visible:true, enabled:true },
    );
  }
  const modal = (active, seq) => ({
    ...event(seq,'reading.control-layer',{ origin:'replace', inputKind:'modal', active, generation:3, epoch:5,
      location:{level:'secondary',module:'replace',form:'full',directoryTab:'directory'} }),
    channel:'business',
  });
  context.events.push(modal(true,11));
  assert.equal(evaluateMotion(assertion,context).verdict,'PASS');
  context.samples[assertion.sample].nodes[2].key = '111';
  assert.equal(evaluateMotion(assertion,context).reason,'modal-editor-mount observed deviation');
  context.samples[assertion.sample].nodes[2].key = '110';
  context.events.push(modal(false,23));
  assert.equal(evaluateMotion(assertion,context).reason,'modal-editor-kept-open observed deviation');
});

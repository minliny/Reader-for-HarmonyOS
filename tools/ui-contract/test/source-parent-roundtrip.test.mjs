import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {ReaderNavigation} from '../../../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import {evaluateSource} from '../lib/source.mjs';

const definition = JSON.parse(readFileSync(new URL('../cases/source-management.captured-parent-roundtrip.json',import.meta.url)));
const instanceId = 'source-parent-session';
const ref = path => ({path,bytes:1,sha256:'a'.repeat(64)});
const commands = ref('raw/commands.jsonl');
const selectors = {
  search:{input:'reader-search-source-recovery-primary',returned:'reader-book-search-input'},
  settings:{input:'reader-settings-source-management',returned:'reader-settings-source-management'},
};
const sourceBack = 'reader-source-back';
const toolsBack = 'reader-source-tools-back';
const toolsHeader = 'reader-source-header-tools';

function proof(parent, floor, generation) {
  const assertion = definition.assertions.find(item => item.expected.parent === parent);
  const action = (from, sequence, op, field) =>
    ({instanceId,from,beforeSeq:floor+sequence,afterSeq:floor+sequence+4,op,...field,evidenceRefs:[commands]});
  const sample = (sampleId, sequence, ...ids) => ({
    sampleId, instanceId,beforeSeq:floor+sequence,afterSeq:floor+sequence+2, captureComplete:true,
    window:{id:'123',keyboard:{visible:false}},nodes:ids.map((id,index)=>({id,path:`0/${index}`,visible:true})),
    evidenceRefs:[ref(`raw/${sampleId}.json`),ref(`raw/${sampleId}.png`)],
  });
  const event = (sequence, kind, payload) => ({
    eventSeq:floor+sequence, instanceId, kind, channel:'business',payload,evidenceRefs:[commands],
  });
  const route = (sequence, step, from, to, previousGeneration) => event(sequence,'source.route',
    {action:step,from,to,mounting:2,generation:previousGeneration+1,previousGeneration});
  const projection = (sequence, generation) => event(sequence,'source.projection',{owner:{mounting:2,generation}});
  const {input,returned} = selectors[parent];
  return {
    samples:{
      [assertion.parentSample]:sample(assertion.parentSample,3,input),
      [assertion.entrySample]:sample(assertion.entrySample,17,sourceBack,toolsHeader),
      [assertion.toolsSample]:sample(assertion.toolsSample,29,toolsBack),
      [assertion.baseline]:sample(assertion.baseline,41,sourceBack,toolsHeader),
      [assertion.sample]:sample(assertion.sample,56,returned),
    },
    actions:{
      [assertion.entryAction]:action(assertion.parentSample,8,'click',{targetId:input}),
      [assertion.departAction]:action(assertion.entrySample,20,'click',{targetId:toolsHeader}),
      [assertion.returnAction]:action(assertion.toolsSample,32,'keyEvent',{key:'Back'}),
      [assertion.action]:action(assertion.baseline,46,'keyEvent',{key:'Back'}),
    },
    events:[
      route(10,'open',parent,'source',generation),
      projection(13,generation+1),
      route(22,'tools','source','sourceTools',generation+1),
      route(34,'tools-back','sourceTools','source',generation+2),
      projection(38,generation+3),
      route(48,'close','source',parent,generation+3),
    ],
  };
}

function verify(parent, context) {
  const assertion = definition.assertions.find(item => item.expected.parent === parent);
  return evaluateSource({...assertion, acceptedSources:assertion.sources},context);
}

test('source captured parent follows the production Navigation owner through both Tools visits', () => {
  const nav = new ReaderNavigation();
  const advance = () => nav.advance();
  assert.equal(nav.openLibrarySearch(advance,()=>true)?.route,'search');
  assert.equal(nav.openSourceManagement('settings','stale',advance),undefined);
  for (const parent of ['search','settings']) {
    const keyword = parent === 'search' ? 'ReaderPhase1Public' : '';
    const opening = nav.openSourceManagement(parent,keyword,advance);
    assert.equal(opening?.route,'source');
    const captured = nav.returns.sourceOrigin();
    assert.deepEqual(captured,{target:parent,keyword});
    assert.equal(nav.openSourceTools(advance)?.route,'sourceTools');
    assert.equal(nav.backFromSourceTools(advance)?.route,'source');
    assert.equal(nav.returns.sourceOrigin(),captured);
    const closed = nav.closeSourceManagement(false,advance);
    assert.equal(closed?.snapshot.route,parent);
    assert.equal(closed.snapshot.generation,opening.generation+3);
    assert.equal(closed.keyword,undefined);
    assert.notEqual(nav.returns.sourceOrigin(),captured);
    assert.equal(nav.closeSourceManagement(false,advance),undefined);
    if (parent === 'search') {
      nav.returnToBookshelf(undefined,advance);
      nav.openSettingsHome();
    }
  }
  assert.equal(nav.openSourceManagement('settings','',advance)?.route,'source');
  assert.equal(nav.closeSourceManagement(false,()=>{
    advance();
    nav.returns.setSourceOrigin('search','later-state');
  }),undefined);
  assert.equal(nav.snapshot().route,'source');
  assert.deepEqual(nav.returns.sourceOrigin(),{target:'search',keyword:'later-state'});
});

test('source captured parent admits both native routes in one session with separate owners', () => {
  const search = proof('search',0,7);
  const settings = proof('settings',70,13);
  const shared = {
    samples:{...search.samples,...settings.samples},
    actions:{...search.actions,...settings.actions},
    events:[...search.events,...settings.events],
  };
  for (const parent of ['search','settings']) {
    const result = verify(parent,shared);
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.closed.to,parent);
    for (const sample of [`${parent}-source-ready`,`${parent}-tools`,`${parent}-source-restored`,`${parent}-returned`]) {
      assert.ok(result.evidenceRefs.some(item=>item.path===`raw/${sample}.png`));
    }
  }
});

test('source captured parent rejects wrong route, stale owner and duplicate accepted Back', () => {
  const wrongParent = proof('search',0,7);
  wrongParent.events.at(-1).payload.to = 'settings';
  assert.equal(verify('search',wrongParent).verdict,'FAIL');
  const stale = proof('settings',0,7);
  stale.events.at(-2).payload.owner.generation -= 2;
  assert.equal(verify('settings',stale).verdict,'FAIL');
  const duplicate = proof('search',0,7);
  duplicate.events.push({...duplicate.events.at(-1),eventSeq:49});
  assert.equal(verify('search',duplicate).verdict,'FAIL');
});

test('source captured parent separates missing proof from trusted Source staying after Back', () => {
  const absent = proof('search',0,7);
  absent.events.pop();
  assert.equal(verify('search',absent).verdict,'NOT_RUN');
  absent.samples['search-returned'].nodes = [{id:sourceBack,path:'0/0',visible:true}];
  assert.equal(verify('search',absent).verdict,'FAIL');
  const wrongAction = proof('settings',0,7);
  wrongAction.actions['settings-tools-back'].key = 'Enter';
  assert.equal(verify('settings',wrongAction).verdict,'NOT_RUN');
});

const v9Definition = JSON.parse(readFileSync(new URL('../cases/source-management.v9-captured-parent-roundtrip.json',import.meta.url)));

function v9Proof(parent, floor, generation) {
  const assertion = v9Definition.assertions.find(item=>item.expected.parent === parent);
  const owner = {mounting:2,generation};
  const {input,returned} = selectors[parent];
  const rect = {left:0,top:0,width:100,height:44};
  const node = (id,path,type = 'Column',fields = {})=>({id,path,parentPath:path.slice(0,path.lastIndexOf('/')),type,visible:true,opacity:1,
    rectPx:rect,visibleRectPx:rect,...fields});
  const more = node(`source-back:${generation}:tools:header`,'0/0/0','Button',{
    alias:'reader-source-header-tools-button',enabled:true,clickable:true,
  });
  const catalogue = [node(toolsHeader,'0/0'),more,node(sourceBack,'0/1','Button'),node('reader-source-list','0/2','List')];
  const sample = (sampleId, sequence, ...nodes)=>({sampleId,instanceId,nodes,captureComplete:true,
    beforeSeq:floor+sequence,afterSeq:floor+sequence+2,
    window:{id:'1',revision:4,density:3.5,keyboard:{visible:false}},
    evidenceRefs:[ref(`raw/${sampleId}.json`),ref(`raw/${sampleId}.png`)],
  });
  const action = (from,sequence,op,fields)=>({from,instanceId,op,...fields,outcomeSettled:true,
    beforeSeq:floor+sequence,afterSeq:floor+sequence+3,evidenceRefs:[commands]});
  const event = (sequence,kind,payload)=>({eventSeq:floor+sequence,kind,payload,instanceId,
    channel:'business',evidenceRefs:[commands]});
  const projection = {owner,state:'empty',readFact:'current',readGeneration:5,filterRevision:1,count:0,projected:0,
    queryLength:0,status:'all',category:'all',groupIndex:0,allGroups:true};
  return {
    samples:{
      [assertion.parentSample]:sample(assertion.parentSample,3,node(input,'0/0','Button')),
      [assertion.entrySample]:sample(assertion.entrySample,15,...catalogue),
      [assertion.menuSample]:sample(assertion.menuSample,23,node('reader-source-v9-more-menu','0/3'),
        node('reader-source-v9-open-groups','0/3/0','Button',{enabled:true,clickable:true})),
      [assertion.toolsSample]:sample(assertion.toolsSample,31,node('reader-source-v9-groups','0/0')),
      [assertion.baseline]:sample(assertion.baseline,42,...catalogue),
      [assertion.sample]:sample(assertion.sample,55,node(returned,'0/0','Button')),
    },
    actions:{
      [assertion.entryAction]:action(assertion.parentSample,6,'click',{targetId:input}),
      [assertion.openAction]:action(assertion.entrySample,18,'click',{targetId:'reader-source-header-tools-button'}),
      [assertion.departAction]:action(assertion.menuSample,26,'click',{targetId:'reader-source-v9-open-groups'}),
      [assertion.returnAction]:action(assertion.toolsSample,35,'keyEvent',{key:'Back'}),
      [assertion.action]:action(assertion.baseline,46,'keyEvent',{key:'Back'}),
    },
    events:[
      event(8,'source.route',{...owner,previousGeneration:generation-1,action:'open',from:parent,to:'source'}),
      event(11,'source.projection',{...projection,trigger:'owner-update'}),
      event(28,'source.v9-list-transition',{owner,view:'groups',revision:1,phase:'enter'}),
      event(37,'source.v9-list-transition',{owner,view:'groups',revision:1,phase:'return',filterMatchesDeparture:true}),
      event(39,'source.projection',{...projection,trigger:'v9-return'}),
      event(48,'source.route',{mounting:2,generation:generation+1,previousGeneration:generation,action:'close',from:'source',to:parent}),
    ],
  };
}

const evaluateV9Parent = (parent, context) => {
  const assertion = v9Definition.assertions.find(item=>item.expected.parent === parent);
  return evaluateSource({...assertion,acceptedSources:assertion.sources},context);
};

test('v9 captured parents remain independent after real same-opening Groups Back',()=>{
  const search = v9Proof('search',0,17), settings = v9Proof('settings',70,19);
  const combined = {samples:{...search.samples,...settings.samples},actions:{...search.actions,...settings.actions},
    events:[...search.events,...settings.events]};
  for (const parent of ['search','settings']) {
    const result = evaluateV9Parent(parent,combined);
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.closed.previousGeneration,result.actual.opened.generation);
    assert.ok(result.evidenceRefs.some(item=>item.path === `raw/${parent}-more-open.png`));
    assert.ok(result.evidenceRefs.some(item=>item.path === `raw/${parent}-groups.png`));
  }
});

test('v9 captured parent rejects a wrong outer route, stale group owner and duplicate Back',()=>{
  for (const mutate of [
    proof=>{proof.events.at(-1).payload.to = 'settings';},
    proof=>{proof.events[3].payload.owner = {mounting:2,generation:18};},
    proof=>{proof.events.push({...proof.events.at(-1),eventSeq:49});},
    proof=>{proof.events[4].payload.readGeneration += 1;},
    proof=>{proof.samples['search-returned'].nodes = [{id:'reader-source-back',path:'0/0',visible:true}];},
  ]) {
    const proof = v9Proof('search',0,17);
    mutate(proof);
    assert.equal(evaluateV9Parent('search',proof).verdict,'FAIL');
  }
  const missing = v9Proof('search',0,17);
  missing.events.pop();
  assert.equal(evaluateV9Parent('search',missing).verdict,'NOT_RUN');
});

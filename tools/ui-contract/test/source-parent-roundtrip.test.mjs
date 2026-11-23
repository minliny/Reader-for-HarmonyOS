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

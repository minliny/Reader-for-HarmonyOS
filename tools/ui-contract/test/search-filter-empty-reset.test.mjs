import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';
import { evaluateSearch } from '../lib/search.mjs';

const definition = JSON.parse(readFileSync(new URL('../cases/bookshelf.search-filter-empty-reset.json',import.meta.url)));
const [assertion] = definition.assertions;
const publicTitle = definition.fixture.bookTitle;
const appInstance = 'search-owned-window';
const owner = {owner:8,page:9,queryRevision:4};
const viewportId = 'reader-search-result-list:9:4';
const triggerId = 'reader-search-filter-trigger';
const onlineId = 'reader-search-filter-online';
const resetId = 'reader-search-filter-reset';
const emptyId = 'reader-search-filtered-empty';

const frame = [0,0,420,800];
const node = (type,id,rect,props={},children=[]) => {
  const bounds = `[${rect.slice(0,2)}][${rect.slice(2)}]`;
  return {attributes:{id,bounds,origBounds:bounds,type,hostWindowId:'42',visible:'true',opacity:'1',
    enabled:'true',clickable:type === 'Button' ? 'true' : 'false',...props},children};
};
const localRow = identity => node('Button',`reader-search-result:${JSON.stringify([9,4,identity])}`,[20,110,400,240],{},[
  node('Text','',[35,125,360,168],{text:publicTitle}),
]);
const sheet = (controlId, attrs={}) => node('SheetWrapper','',[0,380,420,800],{},[
  node('SheetPage','',[0,390,420,800],{},[
    node('Text','',[20,413,130,457],{text:'筛选'}),
    node('Button',controlId,[24,495,157,539],attrs),
  ]),
]);
const normalSample = (beforeSeq,children) => {
  const root = node('root','',frame,{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'},children);
  const rect = {left:0,top:0,width:420,height:800};
  const report = {windowId:'42',vpPixels:1,metrics:{ready:true,revision:7,densityPixels:1,windowRect:rect,
    globalRect:rect,keyboardArea:{available:true,visible:false,rects:[],revision:7},
    keyboardInsets:{left:0,top:0,right:0,bottom:0}}};
  return {...normalizeHarmonyLayout({tree:{attributes:{bounds:root.attributes.bounds},children:[root]},
    report,sampleId:'public-filter',instanceId:appInstance,publicBookTitle:publicTitle,
    evidenceRefs:[{path:'sample.png'},{path:'sample.json'}]}),captureComplete:true,beforeSeq,afterSeq:beforeSeq+1};
};
const results = (beforeSeq, identity = 'local:public-a', listId = viewportId) => normalSample(beforeSeq,[
  node('List',listId,[0,90,420,800],{},[
    identity === null ? node('Column',emptyId,[20,110,400,240]) : localRow(identity),
  ]),
]);
const event = (eventSeq,kind,fields) => ({eventSeq,kind,channel:'business',instanceId:appInstance,payload:{...owner,...fields}});
const action = (from,beforeSeq,afterSeq,targetId) => ({instanceId:appInstance,from,beforeSeq,afterSeq,
  op:targetId ? 'click' : 'keyEvent',targetId,...(!targetId ? {key:'Back'} : {})});
const press = (eventSeq,phase,patch={}) => event(eventSeq,'search-filter-applied',{
  action:phase,scope:phase === 'scope' ? 'online' : 'all',content:'all',workGeneration:12,
  panelGeneration:phase === 'scope' ? 1 : 2,viewportId,resultCount:1,visibleCount:phase === 'scope' ? 0 : 1,...patch,
});
function scenario() {
  return {
    samples:{
      'unfiltered-results':results(6),'filter-open':normalSample(11,[sheet(onlineId)]),
      'filtered-empty':results(21,null),'reset-open':normalSample(26,[sheet(resetId)]),
      'restored-results':results(36),
    },
    actions:{
      'submit-a':action('submit-ready',1,4,'reader-bookshelf-search-submit'),
      'open-filter':action('unfiltered-results',8,10,triggerId),
      'select-online':action('filter-open',13,15,onlineId),'hide-filter':action('selected-online',17,20),
      'reopen-filter':action('filtered-empty',23,25,triggerId),
      'reset-filter':action('reset-open',28,30,resetId),'close-reset':action('reset-applied',32,35),
    },
    events:[
      event(3,'search-submit-accepted',{writeLease:{generation:12}}),
      event(5,'search-page-projection',{projection:'results',operation:'current',searchActive:false,
        resultCount:1,visibleCount:1,operationGeneration:12,viewportId}),
      event(9,'search-page-action',{action:'panel-open',panel:'filter'}),
      press(14,'scope'),
      event(19,'search-page-action',{action:'panel-dismiss',panel:'filter'}),
      event(24,'search-page-action',{action:'panel-open',panel:'filter'}),
      press(29,'reset'),
      event(34,'search-page-action',{action:'panel-dismiss',panel:'filter'}),
    ],
  };
}

test('Phase 1 search filter empty and reset preserve the same public result and query work', () => {
  const evaluate = context => evaluateSearch({...assertion,acceptedSources:assertion.sources},context);
  const correct = evaluate(scenario());
  assert.equal(correct.verdict,'PASS',correct.reason);
  assert.equal(correct.actual.sameBook,true);

  const differentBook = scenario();
  differentBook.samples['restored-results'] = results(36,'local:public-b');
  assert.equal(evaluate(differentBook).verdict,'FAIL','same title with a different local identity is rejected');

  const foreignViewport = scenario();
  foreignViewport.samples['filtered-empty'] = results(21,null,'reader-search-result-list:10:4');
  assert.equal(evaluate(foreignViewport).verdict,'FAIL');

  const notActuallyEmpty = scenario();
  notActuallyEmpty.samples['filtered-empty'] = results(21);
  delete notActuallyEmpty.samples['restored-results'];
  assert.equal(evaluate(notActuallyEmpty).verdict,'FAIL','confirmed wrong native filtered state survives an incomplete later reset');

  const restartedQuery = scenario();
  restartedQuery.events.splice(6,0,event(27,'search-submit-accepted',{writeLease:{generation:13},queryRevision:5}));
  assert.equal(evaluate(restartedQuery).verdict,'FAIL');

  const wrongWork = scenario();
  wrongWork.events[3].payload.workGeneration = 13;
  assert.equal(evaluate(wrongWork).verdict,'FAIL');

  const stalePanel = scenario();
  stalePanel.events[6].payload.panelGeneration = 1;
  assert.equal(evaluate(stalePanel).verdict,'FAIL');

  const badResetControl = scenario();
  badResetControl.samples['reset-open'] = normalSample(26,[sheet(resetId,{enabled:'false'})]);
  assert.equal(evaluate(badResetControl).verdict,'FAIL');

  const missingNative = scenario();
  delete missingNative.samples['restored-results'];
  assert.equal(evaluate(missingNative).verdict,'NOT_RUN');
});

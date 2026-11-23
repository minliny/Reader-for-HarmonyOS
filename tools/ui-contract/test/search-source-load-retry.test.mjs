import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { gatewayTypes, searchTypes } from '../../lib/book-search-page-probe.mjs';
import { selectedProductionComponentCallback, selectedProductionMethods } from '../../lib/selected-production-methods.mjs';
import { requestedOperation } from '../collectors/harmonyos/records.mjs';
import { loadCase } from '../lib/cases.mjs';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { assessStructure } from '../lib/receipt-structure.mjs';
import { evaluateSearch } from '../lib/search.mjs';
import { assertSearchSourceRetryOpening, canOmitSearchSourceRetry, searchEntrySourceRead } from '../lib/search-entry-source-read.mjs';

const id = 'bookshelf.search-source-load-retry';
const SOURCE = 'reader-search-source-recovery-primary';
const ERROR = 'reader-bookshelf-search-sourceLoadError';
const REQUIRED = 'reader-bookshelf-search-sourceRequired';
const TITLE = {sourceId:'public-catalog',name:'Public catalog',enabled:true};
const file = name => new URL(`../../../entry/src/main/ets/features/search/${name}`,import.meta.url);

function pending() {
  let resolve, reject;
  const promise = new Promise((yes,no) => { resolve = yes; reject = no; });
  return {promise,resolve,reject};
}

function realSearch() {
  const reads = [], presentations = [], observed = [], sourceLists = [], methods = [];
  const runtime = {
    bookAcquisitions:() => ({subscribe:() => () => {},sourceRegistryRevision:() => 3}),
    async request(method) {
      methods.push(method);
      if (method === 'search.history.list') return {data:{keywords:['public bookmark'],count:1}};
      assert.equal(method,'source.list');
      const read = pending();
      reads.push(read);
      return read.promise;
    },
  };
  const owner = new searchTypes.SearchOrchestrator(
    presentation => presentations.push(presentation), sources => sourceLists.push(sources), () => true, runtime);
  owner.observeSourceRetry(observation => observed.push(observation));
  return {owner,reads,presentations,observed,sourceLists,methods,runtime};
}

async function failedOpening(probe) {
  probe.owner.open();
  probe.reads.at(-1).reject(new Error('fixture source.list read failed'));
  await setImmediate();
  assert.equal(probe.presentations.at(-1).kind,'sourceLoadError');
  assert.deepEqual(probe.presentations.at(-1).history,['public bookmark']);
}

test('search source list retry publishes one fresh read on the same opening and preserves history', async () => {
  const probe = realSearch();
  await failedOpening(probe);
  const {owner,reads,presentations,observed,methods,sourceLists} = probe;
  const lease = owner.observeWriteLease();
  owner.retry();
  owner.retry();
  assert.equal(reads.length,2);
  reads[1].resolve({data:{sources:[TITLE]}});
  await setImmediate();
  assert.equal(reads.length,2,'successful recovery cannot restart the whole search entry');
  assert.deepEqual(owner.observeWriteLease(),lease);
  assert.equal(presentations.at(-1).kind,'initial');
  assert.deepEqual(presentations.at(-1).history,['public bookmark']);
  assert.deepEqual(sourceLists.at(-1).map(source => source.sourceId),[TITLE.sourceId]);
  assert.deepEqual(methods,['source.list','search.history.list','source.list']);
  assert.deepEqual(observed,[
    {phase:'started',session:lease.session,attempt:1},
    {phase:'settled',session:lease.session,attempt:1,outcome:'ready',sourceCount:1},
  ]);
});

test('search source list retry publishes known empty and disabled separately from a repeated failure', async () => {
  for (const [outcome,rows] of [['failed',undefined],['noSources',[]],['allDisabled',[{...TITLE,enabled:false}]]]) {
    const probe = realSearch();
    await failedOpening(probe);
    probe.owner.retry();
    if (rows === undefined) probe.reads[1].reject(new Error('repeat source.list failure'));
    else probe.reads[1].resolve({data:{sources:rows}});
    await setImmediate();
    const projection = probe.presentations.at(-1);
    assert.equal(projection.kind,outcome === 'failed' ? 'sourceLoadError' : 'sourceRequired');
    assert.equal(projection.reason,outcome === 'failed' ? undefined : outcome);
    assert.equal(probe.observed.at(-1).outcome,outcome);
    assert.equal(probe.observed.at(-1).sourceCount,rows?.length);
    if (rows === undefined) {
      probe.owner.retry();
      assert.equal(probe.reads.length,3,'a genuinely settled failure can be retried again');
      probe.reads[2].resolve({data:{sources:[]}});
      await setImmediate();
      assert.equal(probe.observed.at(-1).attempt,2);
    }
  }
});

test('search source list retry rejects closed and query-superseded completions', async () => {
  for (const supersede of ['close','query']) {
    const probe = realSearch();
    await failedOpening(probe);
    probe.owner.retry();
    if (supersede === 'close') {
      probe.owner.close();
      probe.owner.retry();
      assert.equal(probe.reads.length,2,'closed entry cannot admit a retry');
    } else {
      // The newly submitted query owner is real. Its network sweep is outside
      // the source-list completion regression.
      probe.owner.performSearch = async () => {};
      probe.owner.search('public query');
      assert.equal(probe.presentations.at(-1).kind,'loading');
    }
    const count = probe.presentations.length;
    probe.reads[1].resolve({data:{sources:[TITLE]}});
    await setImmediate();
    assert.equal(probe.presentations.length,count);
    assert.deepEqual(probe.observed.map(item => item.phase),['started']);
  }
});

test('search source list retry forces source.list beyond the cache and prevents a late older read from republishing it', async () => {
  const {reads,runtime} = realSearch();
  const gateway = new gatewayTypes.SearchGateway(runtime);
  const older = gateway.loadSources();
  const fresh = gateway.loadSources(true);
  assert.equal(reads.length,2);
  reads[1].resolve({data:{sources:[TITLE]}});
  await fresh;
  reads[0].resolve({data:{sources:[{...TITLE,enabled:false}]}});
  await older;
  assert.equal((await gateway.loadSources())[0].enabled,true);
  assert.equal(reads.length,2);
  const cachedRetry = gateway.loadSources(true);
  assert.equal(reads.length,3);
  reads[2].resolve({data:{sources:[]}});
  await cachedRetry;
  assert.deepEqual(await gateway.loadSources(),[]);
});

test('search source list retry uses the actual page action without opening acquisition or accepting retired controls', () => {
  const calls = [];
  let kind = 'sourceLoadError', visible = true;
  const onRetry = selectedProductionComponentCallback(file('ui/LibrarySearchResults.ets'),
    'SearchPage','onRetry',{inputCurrent:() => visible,coordinator:{beginSearch:() => calls.push('acquisition')},
      presentation:{host:{presentation:() => ({kind}),retry:() => calls.push('owner-read')}}});
  const Page = selectedProductionMethods(file('ui/SearchPage.ets'),'SearchPage',['retryOperation','operation']);
  const page = Object.assign(new Page(),{pageInputCurrent:() => visible,presentation:{kind},onRetry,
    observePageAction:event => calls.push(event)});
  page.retryOperation();
  assert.deepEqual(calls,['retry-source-load','owner-read']);
  visible = false;
  page.retryOperation();
  assert.deepEqual(calls,['retry-source-load','owner-read']);
  visible = true;
  kind = 'error';
  page.presentation = {kind,operation:{canRetry:true}};
  page.retryOperation();
  assert.deepEqual(calls,['retry-source-load','owner-read','retry','acquisition','owner-read']);
});

test('search source list retry qualifies the actual diagnostic owner only for the current input publication', () => {
  const Presentation = selectedProductionMethods(file('presentation/LibrarySearchPresentation.ets'),
    'LibrarySearchPresentation',['observeSourceRetry']);
  const emitted = [];
  const owner = Object.assign(new Presentation(),{mode:'input',publicationRevision:13,
    model:{interactive:true,currentOwner:() => 7,verification:{enabled:() => true,emit:(...event) => emitted.push(event)}},
    host:{observeWriteLease:() => ({session:2}),viewState:{pageRevision:9,revision:8}}});
  const settled = {phase:'settled',session:2,attempt:1,outcome:'ready',sourceCount:1};
  owner.observeSourceRetry({...settled,session:1});
  owner.model.interactive = false;
  owner.observeSourceRetry(settled);
  owner.model.interactive = true;
  owner.mode = 'results';
  owner.observeSourceRetry(settled);
  assert.deepEqual(emitted,[]);
  owner.mode = 'input';
  owner.observeSourceRetry(settled);
  assert.deepEqual(emitted,[['search-source-list-retry','business',{
    ...settled,owner:7,page:9,queryRevision:8,publicationRevision:13,
  }]]);
});

const scope = {identity:4,navigation:5,mounting:6,owner:7,queryRevision:8,page:9};
const rect = (left,top,width,height) => ({left,top,width,height});
const box = rect(0,0,360,600);
const event = (eventSeq,kind,payload) => ({instanceId:'a',eventSeq,channel:'business',kind,payload,evidenceRefs:[kind]});
const step = (target,from,beforeSeq,afterSeq,hostBeginMs,hostEndMs) =>
  ({actionId:target,instanceId:'a',op:'click',targetId:target,from,beforeSeq,afterSeq,hostBeginMs,hostEndMs});
const node = (id,path,parentPath,bounds = rect(20,50,140,50)) =>
  ({id,path,parentPath,source:'native-tree',rectPx:bounds,visibleRectPx:bounds,clip:false,
    visible:true,opacity:1,enabled:true,clickable:true});

function sample(beforeSeq,afterSeq,hostBeginMs,hostEndMs,marker,keyboardVisible) {
  const nodes = [
    node('reader-bookshelf-search-bar','0/1','0'),
    node('reader-bookshelf-search-field','0/1/1','0/1'),
    node('reader-book-search-input','0/1/1/1','0/1/1'),
    node('reader-library-search-back','0/1/2','0/1'),
  ];
  if (marker) nodes.push(node(marker,'0/2','0'),node(SOURCE,'0/2/1','0/2',rect(20,240,140,50)));
  return {instanceId:'a',captureComplete:true,beforeSeq,afterSeq,hostBeginMs,hostEndMs,nodes,
    window:{revision:1,density:1,rectPx:box,visibleRectPx:box,
      keyboard:{source:'window-metrics',revision:1,visible:keyboardVisible,
        rectsVp:keyboardVisible ? [rect(0,420,360,180)] : []}}};
}

function capture(outcome,keyboardVisible = false) {
  const terminal = outcome === 'failed' ? 'sourceLoadError' : outcome === 'ready' ? 'initial' : 'sourceRequired';
  const count = outcome === 'failed' ? undefined : outcome === 'noSources' ? 0 : 2;
  const projection = (revision, value, reason) => ({...scope,publicationRevision:revision,projection:value,
    searchActive:false,resultCount:0,sourceRequiredReason:reason});
  return {
    actions:{'open-search':step('reader-bookshelf-search-entry','before',1,4,2,5),
      'retry-source-list':step(SOURCE,'entry-projection',9,15,15,17)},
    samples:{'entry-projection':sample(7,8,10,13,ERROR,keyboardVisible),
      'retry-settled':sample(22,23,20,25,terminal === 'initial' ? undefined : terminal === 'sourceLoadError' ? ERROR : REQUIRED,false)},
    events:[
      event(3,'search-open-accepted',scope),
      event(5,'search-surface-settled',{...scope,mode:'input'}),
      event(6,'search-page-projection',{...projection(10,'sourceLoadError'),entrySourceRead:{session:2,outcome:'failed'}}),
      event(10,'search-page-action',{...scope,action:'retry-source-load'}),
      event(11,'search-source-list-retry',{...scope,phase:'started',session:2,attempt:1,publicationRevision:10}),
      event(19,'search-source-list-retry',{...scope,phase:'settled',session:2,attempt:1,publicationRevision:12,outcome,sourceCount:count}),
      event(20,'search-page-projection',projection(12,terminal,terminal === 'sourceRequired' ? outcome : undefined)),
    ],
  };
}

test('search source list retry evaluates all four owner-backed native endpoints and preserves measured keyboard state', () => {
  const contract = loadCase(id);
  const assertion = contract.assertions[1];
  for (const outcome of ['ready','failed','noSources','allDisabled']) {
    const context = capture(outcome,true);
    const result = evaluateSearch(assertion,context);
    assert.equal(result.verdict,'PASS',result.reason);
    assert.equal(result.actual.outcome,outcome);
    assert.equal(result.actual.keyboardBefore,true);
    assert.equal(result.actual.keyboardAfter,false);
    assert.equal(conditionApplicability(assertion,context,result,contract).status,'APPLIES');
  }
});

function opening(outcome = 'ready') {
  const context = capture('ready');
  delete context.actions['retry-source-list'];
  delete context.samples['retry-settled'];
  context.events = context.events.slice(0,3);
  const projection = context.events[2];
  const ready = outcome === 'ready';
  const failed = outcome === 'failed';
  const marker = ready ? undefined : failed ? ERROR : REQUIRED;
  context.samples['entry-projection'] = sample(9,10,10,13,marker,false);
  projection.eventSeq = 7;
  projection.payload = {...projection.payload,projection:ready ? 'initial' : failed ? 'sourceLoadError' : 'sourceRequired',
    entrySourceRead:{session:2,outcome,...(failed ? {} : {sourceCount:outcome === 'noSources' ? 0 : 2})}};
  if (marker === REQUIRED) projection.payload.sourceRequiredReason = outcome;
  context.events.splice(2,0,event(6,'search-page-projection',{...scope,publicationRevision:9,projection:'initial'}));
  return context;
}

test('search source load v3 admits actual healthy entry only with the current read, native input and no Retry', () => {
  const retry = loadCase(id);
  const error = loadCase('bookshelf.search-source-load-error');
  const healthy = opening();
  const read = context => searchEntrySourceRead(context.events,context.actions['open-search'],9);
  const omit = context => canOmitSearchSourceRetry(retry,context.events,context.actions['open-search'],
    context.samples['entry-projection']);
  const statuses = (contract, context) => contract.assertions.map(assertion =>
    conditionApplicability(assertion,context,null,contract).status);
  assert.equal(retry.version,3);
  assert.equal(error.version,3);
  assert.deepEqual(read(healthy),{session:2,outcome:'ready',sourceCount:2});
  assert.equal(omit(healthy),true);
  assert.deepEqual(statuses(error,healthy),['DOES_NOT_APPLY']);
  assert.deepEqual(statuses(retry,healthy),['DOES_NOT_APPLY','DOES_NOT_APPLY']);
  const conditions = Object.fromEntries(retry.assertions.map(assertion =>
    [assertion.id,conditionApplicability(assertion,healthy,null,retry)]));
  const structure = assessStructure(retry,healthy,undefined,{conditions});
  const recovery = structure.states.find(state => state.role === 'retry-settled');
  assert.equal(recovery.conditionId,'search.entry.retry-source-list');
  assert.equal(recovery.observationsComplete,true);
  assert.ok(recovery.checks.every(check => check.verdict === 'NOT_RUN'));
  const entry = structure.states.find(state => state.role === 'entry-projection');
  assert.ok(entry.checks.some(check => check.ruleId === 'search.input-over-books'));
  assert.notEqual(entry.verdict,'PASS','healthy entry still needs the actual bookshelf and overlay structure');
  const legacy = assessStructure({...retry,version:2},healthy,undefined,{conditions});
  assert.equal(legacy.states.find(state => state.role === 'retry-settled').observationsComplete,false);
  const retryStep = retry.steps.find(step => step.id === 'retry-source-list');
  assert.throws(() => assertSearchSourceRetryOpening(retry,retryStep,healthy.events,healthy.actions['open-search'],8),
    /failure required for Retry/u);
  const actualError = opening('failed');
  assert.deepEqual(statuses(retry,actualError),['APPLIES','APPLIES']);
  assert.doesNotThrow(() =>
    assertSearchSourceRetryOpening(retry,retryStep,actualError.events,actualError.actions['open-search'],8));
  for (const outcome of ['noSources','allDisabled']) {
    const context = opening(outcome);
    assert.equal(read(context).outcome,outcome);
    assert.equal(omit(context),false);
    assert.deepEqual(statuses(error,context),['DOES_NOT_APPLY']);
    assert.deepEqual(statuses(retry,context),['DOES_NOT_APPLY','DOES_NOT_APPLY']);
  }
  healthy.samples['entry-projection'].nodes.push(node(ERROR,'0/2','0'));
  assert.equal(omit(healthy),false);
  assert.deepEqual(statuses(retry,healthy),['UNKNOWN','UNKNOWN']);
});

test('search source load v3 treats provisional, stale, malformed and contradictory evidence as unknown', () => {
  const contract = loadCase(id);
  const samples = [
    context => delete context.events.at(-1).payload.entrySourceRead,
    context => context.events.at(-1).payload.entrySourceRead.sourceCount = 0,
    context => context.events.at(-1).payload.entrySourceRead.session = -1,
    context => context.events.at(-1).payload.searchActive = true,
    context => context.events.at(-1).payload.owner++,
    context => context.events.at(-1).payload.queryRevision++,
    context => context.events.at(-1).payload.page++,
    context => context.events.push(event(8,'search-page-owner-released',scope)),
    context => context.events.push(event(8,'search-submit-accepted',scope)),
    context => context.events.push(event(8,'search-open-accepted',scope)),
    context => context.events.push(event(8,'search-page-projection',{...context.events.at(-1).payload,
      entrySourceRead:{session:3,outcome:'ready',sourceCount:2}})),
    context => context.samples['entry-projection'].captureComplete = false,
  ];
  for (const mutate of samples) {
    const context = opening();
    mutate(context);
    assert.ok(contract.assertions.every(assertion => conditionApplicability(assertion,context,null,contract).status === 'UNKNOWN'));
    assert.equal(canOmitSearchSourceRetry(contract,context.events,context.actions['open-search'],
      context.samples['entry-projection']),false);
  }
});

test('search source list retry refuses stale transactions, an unrelated query and incomplete recovery evidence', () => {
  const contract = loadCase(id), assertion = contract.assertions[1];
  for (const [mutation,verdict] of [
    [c => c.events[5].payload.attempt++, 'FAIL'],
    [c => c.events[5].payload.owner++, 'FAIL'],
    [c => c.events.push(event(21,'search-submit-accepted',scope)), 'FAIL'],
    [c => c.events[3].payload.action = 'retry', 'FAIL'],
    [c => c.events[6].payload.publicationRevision = 10, 'NOT_RUN'],
    [c => c.samples['retry-settled'].captureComplete = false, 'NOT_RUN'],
    [c => c.samples['retry-settled'].nodes = c.samples['retry-settled'].nodes.filter(item => item.id !== SOURCE), 'FAIL'],
    [c => c.samples['retry-settled'].nodes.find(item => item.id === SOURCE).path = '0/3', 'FAIL'],
    [c => c.samples['entry-projection'].nodes.find(item => item.id === ERROR).id = REQUIRED, 'FAIL'],
  ]) {
    const context = capture('failed');
    mutation(context);
    assert.equal(evaluateSearch(assertion,context).verdict,verdict);
  }
  const unchanged = capture('ready');
  unchanged.events[2].payload.projection = 'initial';
  for (const current of contract.assertions) assert.equal(conditionApplicability(current,unchanged,null,contract).status,'UNKNOWN');
});

test('search source list retry will not dispatch on native occlusion or the other recovery branch', () => {
  const contract = loadCase(id);
  const action = contract.steps.find(step => step.id === 'retry-source-list');
  const context = capture('failed',true);
  const baseline = context.samples['entry-projection'];
  assert.deepEqual(requestedOperation(action,context.samples,contract.fixture),{op:'click',x:90,y:265});
  baseline.window.keyboard.rectsVp = [rect(0,240,360,360)];
  assert.throws(() => requestedOperation(action,context.samples,contract.fixture),/hit area clear of the IME/);
  assert.equal(evaluateSearch(contract.assertions[1],context).verdict,'FAIL');
  baseline.window.keyboard.rectsVp = [];
  baseline.window.keyboard.visible = false;
  baseline.nodes.find(item => item.id === ERROR).id = REQUIRED;
  assert.throws(() => requestedOperation(action,context.samples,contract.fixture),/missing/);
});

test('search source list retry rejects extra reads and unusable recovery after the native tap', () => {
  const definition = loadCase(id).assertions[1];
  assert.equal(definition.expected.exclusiveRead, true);
  const assertion = {...definition,acceptedSources:definition.sources};
  const check = context => evaluateSearch(assertion,context);
  const duplicate = capture('ready');
  duplicate.events.splice(5,0,event(16,'search-source-list-retry',{...duplicate.events[4].payload,attempt:2}));
  assert.equal(check(duplicate).verdict,'FAIL','a second read after native dispatch must invalidate the first recovery');

  for (const outcome of ['failed','noSources','allDisabled']) {
    const context = capture(outcome,true);
    const result = context.samples['retry-settled'];
    result.window.keyboard.visible = true;
    result.window.keyboard.rectsVp = [rect(0,420,360,180)];
    assert.equal(check(context).verdict,'PASS','a visible IME alone does not cover the actionable recovery');
    result.window.keyboard.rectsVp = [rect(0,240,360,360)];
    assert.equal(check(context).verdict,'FAIL','the IME covers the terminal recovery action');
  }
  const ready = capture('ready');
  ready.samples['retry-settled'].window.keyboard.visible = true;
  ready.samples['retry-settled'].window.keyboard.rectsVp = [rect(0,240,360,360)];
  assert.equal(check(ready).verdict,'PASS','ready input has no recovery button to measure');
});

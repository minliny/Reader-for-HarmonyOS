import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesPredicates, requestedOperation } from '../collectors/harmonyos/records.mjs';
import { loadCase } from '../lib/cases.mjs';
import { jsonDigest } from '../lib/evidence.mjs';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { evaluateSearch, searchResultEndpoint } from '../lib/search.mjs';

const INSTANCE = 'instance-1';
const BAR = 'reader-bookshelf-search-bar';
const FIELD = 'reader-bookshelf-search-field';
const ENTRY = 'reader-bookshelf-search-entry';
const EDITOR = 'reader-book-search-input';
const SUBMIT = 'reader-bookshelf-search-submit';
const SEARCH = Object.freeze({ identity: 1, navigation: 2, mounting: 1 });
const ACTIVE_EDITOR = Object.freeze({ ...SEARCH, owner: 3, editorId: '[1,2,1,3]' });
const CASE_SOURCES = ['native-tree', 'window-metrics', 'app-input', 'app-owner'];

function action(op, targetId, beforeSeq, afterSeq, hostBeginMs, hostEndMs) {
  return { instanceId: INSTANCE, actionId: targetId, op, targetId, beforeSeq, afterSeq, hostBeginMs, hostEndMs,
    evidenceRefs: ['actions'] };
}

function event(eventSeq, channel, kind, payload) {
  return { instanceId: INSTANCE, eventSeq, channel, kind, payload, evidenceRefs: [`event-${eventSeq}`] };
}

function node(id, path, parentPath) {
  return { id, path, parentPath, source: 'native-tree', visible: true, visibleRectPx: { width: 20, height: 20 },
    enabled: true, clickable: true, focused: true };
}

function sample(state, beforeSeq, afterSeq, hostBeginMs, hostEndMs, visible, nodes) {
  const rectsVp = visible ? [{ left: 0, top: 490, width: 300, height: 100 }] : [];
  return { sampleId: state, state, instanceId: INSTANCE, beforeSeq, afterSeq, hostBeginMs, hostEndMs, nodes,
    evidenceRefs: [state], window: { revision: 1, keyboard: { visible, rectsVp, revision: 1, source: 'window-metrics' } } };
}

test('search source load error v2 requires a terminal projection from the uniquely opened owner', () => {
  const contract = {...loadCase('bookshelf.search-source-load-error'),version:2};
  const [assertion] = contract.assertions;
  const contextFor = (projection, keyboardVisible = false) => ({
    actions:{'open-search':action('click',ENTRY,4,8,10,20)},
    samples:{'entry-projection':{
      ...sample('entry-projection',15,16,30,44,keyboardVisible,[]),captureComplete:true,
    }},
    events:[
      event(6,'business','search-open-accepted',{...SEARCH,queryRevision:3}),
      event(9,'business','search-surface-settled',{...ACTIVE_EDITOR,mode:'input',queryRevision:3}),
      event(10,'business','search-page-projection',{owner:ACTIVE_EDITOR.owner,queryRevision:3,projection:'initial'}),
      ...(projection ? [event(14,'business','search-page-projection',{
        owner:ACTIVE_EDITOR.owner,queryRevision:3,...projection,
      })] : []),
    ],
  });
  const status = context => conditionApplicability(assertion,context,null,contract).status;
  const realError = {projection:'sourceLoadError'};
  assert.equal(status(contextFor(realError,false)),'APPLIES');
  assert.equal(status(contextFor(realError,true)),'APPLIES');
  assert.equal(status(contextFor()),'UNKNOWN');
  assert.equal(status(contextFor({...realError,owner:97})),'UNKNOWN');
  assert.equal(status(contextFor({...realError,queryRevision:4})),'UNKNOWN');

  const duplicate = contextFor(realError);
  duplicate.events.splice(1,0,event(7,'business','search-open-accepted',{...SEARCH,queryRevision:3}));
  assert.equal(status(duplicate),'UNKNOWN');
  const wrongSettlement = contextFor(realError);
  wrongSettlement.events[1].payload.mode = 'results';
  assert.equal(status(wrongSettlement),'UNKNOWN');

  const confirmed = contextFor({projection:'sourceRequired',sourceRequiredReason:'noSources'});
  assert.equal(status(confirmed),'DOES_NOT_APPLY');
  confirmed.samples['entry-projection'].captureComplete = false;
  assert.equal(status(confirmed),'UNKNOWN');
  assert.equal(status(contextFor({projection:'sourceRequired'})),'UNKNOWN');
});

function capture(state = 'empty') {
  const marker = `reader-bookshelf-search-${state}`;
  const viewportId = 'reader-search-result-list:2:7';
  return {
    actions: {
      'open-search': action('click', ENTRY, 2, 4, 3, 6),
      'input-search': action('inputText', EDITOR, 8, 11, 10, 12),
      'submit-search': action('click', SUBMIT, 12, 16, 14, 16),
    },
    samples: {
      before: sample('before', 1, 2, 1, 2, false, [node(BAR, '0/0', '0'), node(ENTRY, '0/0/0', '0/0')]),
      'ime-ready': sample('ime-ready', 6, 8, 7, 9, true, [
        node(BAR, '0/0', '0'), node(FIELD, '0/0/0', '0/0'), node(EDITOR, '0/0/0/0', '0/0/0'),
      ]),
      'results-settled': sample('results-settled', 22, 24, 21, 22, false, [
        node(marker, '0/0', '0'), node(viewportId, '0/0/0', '0/0'),
      ]),
    },
    events: [
      event(3, 'business', 'search-open-accepted', { ...SEARCH, queryRevision: 6 }),
      event(5, 'input', 'search-editor-focus', { ...ACTIVE_EDITOR, focused: true, length: 0 }),
      event(9, 'input', 'search-editor-edit', { ...ACTIVE_EDITOR, focused: true, beforeLength: 0, length: 6 }),
      event(10, 'input', 'search-editor-selection', { ...ACTIVE_EDITOR, focused: true, length: 6, start: 6, end: 6 }),
      event(13, 'input', 'search-button-intent', { ...ACTIVE_EDITOR, enabled: true, semantic: 'search' }),
      event(14, 'business', 'search-submit-accepted', { ...SEARCH, navigation: 3, previousNavigation: 2,
        previousOwner: 3, previousQueryRevision: 6, queryRevision: 7, length: 6 }),
      event(17, 'business', 'search-surface-settled', { ...SEARCH, navigation: 3, queryRevision: 7, mode: 'results', owner: 4 }),
      event(19, 'business', 'search-result-projection', { queryRevision: 7, owner: 4, page: 2, state, viewportId }),
    ],
  };
}

function change(context, seq, update) {
  const record = context.events.find(event => event.eventSeq === seq);
  Object.assign(record.payload, update);
}

const evaluate = (kind, context, allowedSources = CASE_SOURCES) =>
  evaluateSearch({ kind, expected: { length: 6 }, acceptedSources: allowedSources }, context);

test('same-session search with current IME, selection, submit and either resolved native results shape', () => {
  for (const state of ['empty', 'results']) {
    const context = capture(state);
    for (const kind of ['entry', 'focus', 'ime-before-input', 'edit-selection', 'submit', 'results-settled']) {
      const result = evaluate(kind, context);
      assert.equal(result.verdict, 'PASS', kind + ': ' + result.reason);
      assert.ok(result.evidenceRefs.length >= 2);
    }
    assert.equal(evaluate('results-settled', context).actual.state, state);
  }
});

test('a real IME sample taken after input cannot prove that the IME was observed beforehand', () => {
  const context = capture();
  context.samples['ime-ready'].hostEndMs = 11;
  const result = evaluate('ime-before-input', context);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.actual.beforeInput, false);
});

test('IME metrics from an old window revision are rejected', () => {
  const context = capture();
  context.samples['ime-ready'].window.revision += 1;
  const result = evaluate('ime-before-input', context);
  assert.equal(result.verdict, 'NOT_RUN');
  assert.match(result.reason, /revision/u);
});

test('an edit from the previous search mounting cannot settle the current native editor', () => {
  const context = capture();
  change(context, 9, { ...ACTIVE_EDITOR, mounting: 0, editorId: '[1,2,0,3]' });
  assert.equal(evaluate('edit-selection', context).verdict, 'NOT_RUN');
});

test('a credible native selection that remains expanded is a product failure', () => {
  const context = capture();
  change(context, 10, { start: 3 });
  const result = evaluate('edit-selection', context);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.actual.start, 3);
});

test('the accepted submit fails the focus expectation when the current editor blurred before the tap', () => {
  const context = capture();
  context.events.splice(4, 0, event(12, 'input', 'search-editor-focus', { ...ACTIVE_EDITOR, focused: false, length: 6 }));
  const result = evaluate('submit', context);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.actual.focusedAtTapStart, false);
});

test('seals valid submit evidence independently of a pending result and matches later settlement', () => {
  const contract = loadCase('bookshelf.search-input-ime');
  const submit = contract.steps.find(step => step.id === 'submit-search');
  const context = capture();
  const { beforeSeq, afterSeq } = context.actions[submit.id];
  const pendingEvents = context.events.filter(event => event.eventSeq <= afterSeq);
  const duringSubmit = pendingEvents.filter(event => event.eventSeq > beforeSeq);
  assert.deepEqual(submit.wait, duringSubmit.map(event => event.kind));
  const pending = {...context, events:pendingEvents, samples:{...context.samples, 'results-settled':undefined}};
  assert.equal(evaluate('submit', pending).verdict, 'PASS');
  assert.equal(evaluate('results-settled', pending).verdict, 'NOT_RUN');
  assert.equal(searchResultEndpoint(pendingEvents, beforeSeq, afterSeq), undefined);
  assert.equal(searchResultEndpoint(context.events, beforeSeq, afterSeq).projected.eventSeq, 19);
});

test('an old onSettled endpoint cannot occupy the current accepted submit interval', () => {
  const context = capture();
  change(context, 17, { navigation: 2, queryRevision: 6 });
  const result = evaluate('results-settled', context);
  assert.equal(result.verdict, 'NOT_RUN');
  assert.match(result.reason, /onSettled/u);
});

test('a delayed projection for the old query is ignored and a missing current viewport blocks the result', () => {
  const context = capture('results');
  context.events.push(event(20, 'business', 'search-result-projection',
    { queryRevision: 6, owner: 3, page: 1, state: 'empty', viewportId: 'reader-search-result-list:1:6' }));
  assert.equal(evaluate('results-settled', context).verdict, 'PASS');
  context.samples['results-settled'].nodes[1].id = 'reader-search-result-list:1:6';
  assert.equal(evaluate('results-settled', context).verdict, 'NOT_RUN');
});

test('a stable matched native result can be visible while the online sweep remains active', () => {
  const context = capture('results');
  change(context, 19, {searchActive:true, publicationRevision:12});
  const result = evaluate('results-settled', context);
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.actual.searchActive, true);
  assert.equal(result.actual.publicationRevision, 12);
  context.samples['results-settled'].nodes[0].id = 'reader-bookshelf-search-loading';
  assert.equal(evaluate('results-settled', context).verdict, 'NOT_RUN');
});

test('native-only assertions do not silently accept a business or input event source', () => {
  const result = evaluate('focus', capture(), ['native-tree']);
  assert.equal(result.verdict, 'NOT_RUN');
  assert.match(result.reason, /app-owner/u);
});

function phase1Capture() {
  const result = 'reader-bookshelf-search-empty';
  const next = { ...SEARCH, navigation: 4, mounting: 1, queryRevision: 8 };
  const lease = (generation, active = true) => ({ generation, session: 2, active });
  const context = capture();
  context.actions['submit-a'] = context.actions['submit-search'];
  context.actions['submit-b'] = action('click', SUBMIT, 25, 30, 25, 29);
  context.samples['results-b'] = sample('results-b', 39, 40, 40, 42, false, [
    node(result, '0/0', '0'), node('reader-search-result-list:3:8', '0/0/0', '0/0'),
  ]);
  change(context, 14, { writeLease: lease(21) });
  context.events.push(
    event(26, 'input', 'search-button-intent', { ...SEARCH, navigation: 3, owner: 4, editorId: '[1,3,1,4]',
      enabled: true, semantic: 'search' }),
    event(27, 'business', 'search-submit-accepted', { ...next, previousNavigation: 3, previousOwner: 4,
      previousQueryRevision: 7, length: 21, writeLease: lease(22) }),
    event(32, 'business', 'search-surface-settled', { ...next, mode: 'results', owner: 5 }),
    event(37, 'business', 'search-page-projection', { queryRevision: 8, owner: 5, page: 3, publicationRevision: 13,
      projection: 'empty', operation: 'empty', operationGeneration: 22, searchActive: false, resultCount: 0,
      incompleteCount: 0, failedCount: 0, skippedCount: 0, stopped: false, localFailed: false, sourceListFailed: false,
      viewportId: 'reader-search-result-list:3:8' }),
  );
  return context;
}

test('Phase 1 search detects duplicate or crossed submissions independently of a missing result sample', () => {
  const context = phase1Capture();
  const assertion = { kind: 'phase-submit', action: 'submit-b', priorAction: 'submit-a', acceptedSources: CASE_SOURCES,
    expected: { source: 'button', length: 21 } };
  assert.equal(evaluateSearch(assertion, context).verdict, 'PASS');
  change(context, 27, { previousQueryRevision: 6 });
  assert.equal(evaluateSearch(assertion, context).verdict, 'FAIL');
  context.samples['results-b'] = undefined;
  context.events.splice(10, 0, event(28, 'business', 'search-submit-accepted', { length: 21, queryRevision: 9 }));
  const duplicate = evaluateSearch(assertion, context);
  assert.equal(duplicate.verdict, 'FAIL');
  assert.equal(duplicate.actual.accepted, 2);
});

test('Phase 1 search requires the sampled soft Search key and actual IME intent in its action bracket', () => {
  const context = phase1Capture();
  context.actions['submit-b'] = {...context.actions['submit-b'],
    op:'tapImeSearch', targetId:EDITOR, from:'typed-ime-ready'};
  context.samples['typed-ime-ready'] = {...context.samples['ime-ready'],imeSearchKey:{x:1169,y:2580}};
  const assertion = {kind:'phase-submit',action:'submit-b',priorAction:'submit-a',acceptedSources:CASE_SOURCES,
    expected:{source:'ime',length:21}};
  assert.equal(evaluateSearch(assertion,context).verdict, 'NOT_RUN');
  const input = context.events.find(event => event.eventSeq === 26);
  input.kind = 'search-ime-intent';
  const directlyAccepted = evaluateSearch(assertion,context);
  assert.equal(directlyAccepted.verdict, 'PASS');
  assert.deepEqual(directlyAccepted.actual.imeSearchKey, {x:1169,y:2580});
  delete context.samples['typed-ime-ready'].imeSearchKey;
  assert.equal(evaluateSearch(assertion,context).verdict, 'NOT_RUN');
});

test('Phase 1 search rejects the old query publication and stale native viewport and separates an unobserved projection', () => {
  const context = phase1Capture();
  const assertion = { kind: 'phase-projection', action: 'submit-b', sample: 'results-b', acceptedSources: CASE_SOURCES,
    expected: { mode: 'results', source: 'button', projections: ['empty'], confirmedEmpty: true, searchActive: false } };
  assert.equal(evaluateSearch(assertion, context).verdict, 'PASS');
  change(context, 37, { queryRevision: 7 });
  const mixed = evaluateSearch(assertion, context);
  assert.equal(mixed.verdict, 'FAIL');
  assert.equal(mixed.actual.acceptedQueryRevision, 8);
  change(context, 37, { queryRevision: 8 });
  context.samples['results-b'].nodes[1].id = 'reader-search-result-list:2:7';
  assert.match(evaluateSearch(assertion, context).reason, /native results viewport displays a different/u);
  context.events = context.events.filter(event => event.eventSeq !== 37);
  assert.equal(evaluateSearch(assertion, context).verdict, 'NOT_RUN');
});

test('Phase 1 search confirmed empty rejects retained native rows and preserves heading evidence', () => {
  const definition = loadCase('bookshelf.search-confirmed-empty').assertions.find(item => item.id === 'search.projection.b');
  const legacy = {...definition,acceptedSources:definition.sources,expected:{...definition.expected}};
  delete legacy.expected.nativeConfirmedEmpty;
  const strict = {...legacy,expected:{...legacy.expected,nativeConfirmedEmpty:true}};
  const viewport = 'reader-search-result-list:3:8';
  const box = {left:0,top:0,width:200,height:400};
  const attrs = {hostWindowId:'42',bounds:'[0,0][200,400]',origBounds:'[0,0][200,400]',visible:'true',opacity:'1'};
  function native(type,id,children = [],extra = {}) {
    return {attributes:{...attrs,type,id,...extra},children};
  }
  function contextFor({heading = 'inside', headingState, rows = [], hiddenAncestor = false, differentList = false, observe = true} = {}) {
    const context = phase1Capture();
    const title = native('Text','',[],{text:'没有找到相关书籍',...headingState});
    const cards = rows.map(({id, ...state}) => native('Button',id,[],state));
    const cardNodes = hiddenAncestor ? [native('Column','',cards,{opacity:'0'})] : cards;
    const content = [native('List',viewport,[...(heading === 'inside' ? [title] : []),...cardNodes])];
    if (heading === 'duplicate') {
      content[0].children.push(title);
      content.push(title);
    }
    if (differentList) content.push(native('List',differentList === 'same' ? viewport : 'reader-search-result-list:2:7',
      [],differentList === 'unknown' ? {visible:undefined} : {}));
    const surface = native('Stack','reader-library-search-surface',[native('Stack','reader-bookshelf-search-empty',content)]);
    const tree = {attributes:{bounds:attrs.bounds},children:[
      native('root','',[surface],{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'}),
    ]};
    const old = context.samples['results-b'];
    const observed = normalizeHarmonyLayout({tree,windowId:'42',sampleId:'results-b',state:'results-b',instanceId:INSTANCE,
      report:{windowId:'42',vpPixels:1,metrics:{ready:true,revision:1,densityPixels:1,windowRect:box,globalRect:box,
        keyboardArea:{available:true,visible:false,rects:[],revision:1},keyboardInsets:{left:0,top:0,right:0,bottom:0}}},
      observeSearchConfirmedEmpty:observe,publicBookTitle:'Public fixture book',evidenceRefs:['native-results']});
    context.samples['results-b'] = {...old,...observed,captureComplete:true};
    return context;
  }
  const local = 'reader-search-result:[3,8,"local:opaque-fixture"]';
  const online = 'reader-search-result:[2,7,"online:other-fixture"]';
  const retained = contextFor({rows:[{id:local}]});
  assert.equal(evaluateSearch(legacy,retained).verdict,'PASS','the v2 relationship only checked the wrapper and current viewport');
  assert.equal(evaluateSearch(strict,retained).verdict,'FAIL','an actual retained result must contradict confirmed empty');
  assert.equal(definition.expected.nativeConfirmedEmpty,true,'the current case requires the stricter evidence');
  const check = context => evaluateSearch(strict,context);
  const normal = check(contextFor());
  assert.equal(normal.verdict,'PASS',normal.reason);
  assert.equal(check(contextFor({rows:[{id:online}]})).verdict,'FAIL','an earlier online result is still a visible search card');
  assert.equal(check(contextFor({rows:[{id:online,visible:'false'}]})).verdict,'PASS','native offscreen retention is not a visible result');
  assert.equal(check(contextFor({rows:[{id:online}],hiddenAncestor:true})).verdict,'PASS',
    'a native card under a fully transparent ancestor is not a visible result');
  assert.equal(check(contextFor({differentList:true})).verdict,'FAIL','a different visible native List must not share the empty surface');
  assert.equal(check(contextFor({rows:[{id:online}],differentList:'unknown'})).verdict,'FAIL',
    'a verified retained card remains a violation when another List lacks visibility facts');
  for (const options of [
    {differentList:'same'}, {differentList:'unknown'}, {observe:false},
    {rows:[{id:'reader-search-result:bad-private-shape'}]},
    {rows:[{id:online,opacity:undefined}]},
  ]) assert.equal(check(contextFor(options)).verdict,'NOT_RUN','ambiguous native evidence cannot prove an empty result');
  const headings = context => context.samples['results-b'].nodes
    .filter(node => node.alias === 'reader-search-confirmed-empty-heading');
  assert.equal(headings(contextFor({observe:false})).length,0);
  assert.equal(headings(contextFor({heading:'missing'})).length,0);
  assert.equal(headings(contextFor({heading:'duplicate'})).length,2);
  const [uncertainHeading] = headings(contextFor({headingState:{visible:undefined,opacity:undefined}}));
  assert.equal(uncertainHeading.visible,null);
  assert.equal(uncertainHeading.opacity,null);
  const normalized = contextFor({rows:[{id:online}]}).samples['results-b'];
  assert.ok(!JSON.stringify(normalized).includes('other-fixture'));
  assert.ok(!JSON.stringify(normalized).includes('没有找到相关书籍'));
  assert.ok(!JSON.stringify(contextFor({rows:[{id:'reader-search-result:bad-private-shape'}]}).samples['results-b'])
    .includes('bad-private-shape'));
});

test('Phase 1 search confirmed empty rerun needs the actual button and a fresh work generation in the same results owner', () => {
  const contract = loadCase('bookshelf.search-confirmed-empty');
  const scenario = contract.assertions.find(item => item.id === 'search.rerun.confirmed-empty');
  const assertion = {...scenario,acceptedSources:scenario.sources};
  const rerun = contract.steps.find(step => step.id === 'rerun-empty');
  const viewport = 'reader-search-result-list:3:8';
  const empty = 'reader-bookshelf-search-empty';
  const buttonId = 'reader-search-retry';
  const bounds = {left:0,top:0,width:200,height:400};
  function native(type,id,children = [],extra = {}) {
    return {attributes:{hostWindowId:'42',bounds:'[0,0][200,400]',origBounds:'[0,0][200,400]',
      type,id,visible:'true',opacity:'1',...extra},children};
  }
  function sampleFor(state, boundsInTime, placement = 'correct') {
    const button = native('Button',buttonId,[],{enabled:'true',clickable:'true',bounds:'[20,180][100,220]'});
    const title = native('Text','',[],{text:'没有找到相关书籍'});
    const list = native('List',viewport,[title,...(placement === 'correct' ? [button] : [])]);
    const surface = native('Stack','reader-library-search-surface',
      [native('Stack',empty,[list]),...(placement === 'outside' ? [button] : [])]);
    const tree = {attributes:{bounds:'[0,0][200,400]'},children:[
      native('root','',[surface],{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'}),
    ]};
    const observed = normalizeHarmonyLayout({tree,windowId:'42',sampleId:state,state,instanceId:INSTANCE,
      report:{windowId:'42',vpPixels:1,metrics:{ready:true,revision:1,densityPixels:1,windowRect:bounds,globalRect:bounds,
        keyboardArea:{available:true,visible:false,rects:[],revision:1},keyboardInsets:{left:0,top:0,right:0,bottom:0}}},
      observeSearchConfirmedEmpty:true,publicBookTitle:'Public fixture book',evidenceRefs:[state]});
    return {...sample(state,...boundsInTime,false,[]),...observed,captureComplete:true};
  }
  function contextFor(placement = 'correct') {
    const context = phase1Capture();
    const initial = context.events.find(event => event.eventSeq === 37).payload;
    context.samples['results-b'] = sampleFor('results-b',[39,40,40,42],placement);
    context.samples['rerun-settled'] = sampleFor('rerun-settled',[55,56,53,55]);
    context.actions['rerun-empty'] = {...action('click',buttonId,43,49,44,50),from:'results-b',outcomeSettled:true};
    const admission = {owner:5,page:3,queryRevision:8,operationGeneration:22,resultCount:0,action:'retry'};
    context.events.push(event(44,'business','search-page-action',admission),
      event(46,'business','search-page-projection',{...initial,projection:'loading',operation:'loading',
        publicationRevision:14,operationGeneration:23,searchActive:true}),
      event(50,'business','search-page-projection',{...initial,publicationRevision:15,operationGeneration:23}));
    return context;
  }
  const check = context => evaluateSearch(assertion,context);
  const normal = contextFor();
  assert.deepEqual(requestedOperation(rerun,normal.samples,contract.fixture),{op:'click',x:60,y:200});
  assert.equal(check(normal).verdict,'PASS',check(normal).reason);
  const outside = contextFor('outside');
  assert.throws(() => requestedOperation(rerun,outside.samples,contract.fixture),/current native result list/u);
  assert.equal(check(outside).verdict,'NOT_RUN');

  for (const [sequence,payload] of [[44,{owner:9}],[46,{queryRevision:9}],[46,{operationGeneration:22}],[50,{operationGeneration:22}],
    [50,{operationGeneration:24}],[50,{skippedCount:1}]]) {
    const wrong = contextFor();
    change(wrong,sequence,payload);
    assert.equal(check(wrong).verdict,'FAIL');
  }
  const duplicate = contextFor();
  duplicate.events.push(event(47,'business','search-page-action',{action:'retry'}));
  assert.equal(check(duplicate).verdict,'FAIL');
  const submittedAgain = contextFor();
  submittedAgain.events.push(event(47,'business','search-submit-accepted',{queryRevision:9}));
  assert.equal(check(submittedAgain).verdict,'FAIL');
  const ignored = contextFor();
  ignored.actions['rerun-empty'].outcomeSettled = false;
  ignored.events = ignored.events.filter(event => event.eventSeq < 43);
  assert.equal(check(ignored).verdict,'NOT_RUN','a complete empty screenshot cannot supply the missing action acceptance');
  delete ignored.samples['rerun-settled'];
  assert.equal(check(ignored).verdict,'NOT_RUN');
  const fast = contextFor();
  fast.events = fast.events.filter(event => event.eventSeq !== 46);
  assert.equal(check(fast).verdict,'PASS','a fast sweep can publish its new terminal without an intermediate UI loading sample');
  const incomplete = contextFor();
  incomplete.events = incomplete.events.filter(event => event.eventSeq !== 50);
  assert.equal(check(incomplete).verdict,'NOT_RUN');
  const retrograde = contextFor();
  const settled = retrograde.events.find(event => event.eventSeq === 50).payload;
  retrograde.events.splice(retrograde.events.length - 2, 0, event(45,'business','search-page-projection',settled));
  assert.equal(check(retrograde).verdict,'FAIL','loading cannot begin after the newly admitted work is already terminal');
});

test('Phase 1 search loading needs both the matched running lease and the native pending viewport', () => {
  const context = phase1Capture();
  const marker = 'reader-bookshelf-search-pending';
  const assertion = {kind:'phase-projection',action:'submit-b',sample:'results-b',acceptedSources:CASE_SOURCES,
    expected:{mode:'results',source:'button',projections:['loading'],operation:'loading',
      searchActive:true,resultCount:0,node:marker}};
  const [host, viewport] = context.samples['results-b'].nodes;
  host.id = marker;
  change(context, 37, {projection:'loading',operation:'loading',searchActive:true});
  assert.equal(evaluateSearch(assertion,context).verdict, 'PASS');
  viewport.parentPath = '0';
  assert.equal(evaluateSearch(assertion,context).verdict, 'NOT_RUN');
  viewport.parentPath = host.path;
  change(context, 37, {operationGeneration:21});
  assert.equal(evaluateSearch(assertion,context).verdict, 'FAIL');
});

test('Phase 1 search initial loading requires a live first online worker across the native sample', () => {
  const contract = loadCase('bookshelf.search-running-initial');
  const spec = contract.assertions.find(check => check.id === 'search.projection.loading');
  assert.equal(spec.expected.requirePendingFirstAttempt,true);
  assert.equal(contract.version,3);
  const predicate = contract.steps.find(step => step.id === spec.sample).waitFor
    .find(wait => wait.kind === 'search-online-attempt');
  assert.equal(predicate.match,'latest');
  const [started,settled] = onlineAttemptEvents(31,42);
  assert.equal(matchesPredicates([started],[predicate]),true);
  assert.equal(matchesPredicates([started,settled],[predicate]),false);

  const check = (attempts,captureComplete = true) => {
    const context = phase1Capture();
    const sample = context.samples['results-b'];
    sample.nodes[0].id = 'reader-bookshelf-search-pending';
    sample.captureComplete = captureComplete;
    change(context,37,{projection:'loading',operation:'loading',searchActive:true});
    context.events.push(...attempts);
    return evaluateSearch({...spec,acceptedSources:spec.sources},context);
  };
  const active = check([started]);
  assert.equal(active.verdict,'PASS',active.reason);
  assert.equal(active.actual.onlineAttempt.startedSeq,31);
  assert.equal(active.actual.onlineAttempt.observedThroughSeq,40);
  assert.equal(check([started,settled]).verdict,'PASS','Settlement after the bracket leaves its evidence intact');
  for (const observations of [[], [{...started,payload:{...started.payload,generation:21}}],
    [{...started,payload:{...started.payload,sourceCount:2}}], [{...started,eventSeq:40}],
    [started,{...settled,eventSeq:34}], [started,{...settled,eventSeq:40}]]) {
    assert.equal(check(observations).verdict,'NOT_RUN','No live single first request spans the full sample');
  }
  assert.equal(check([started],false).verdict,'NOT_RUN');
  assert.equal(check([started,{...started,eventSeq:33}]).verdict,'FAIL','A duplicate start of the same source and page is observable');
});

function onlineAttemptEvents(first, last, facts, httpStatus = 503) {
  const scope = {generation:22,session:2,queryRevision:8,sourceCount:1,sourceOrdinal:0,requestedPage:1,
    trigger:'initial', ...facts};
  return [
    event(first,'business','search-online-attempt',{...scope,stage:'started'}),
    event(last,'business','search-online-attempt',{...scope,stage:'settled',outcome:'failed',httpStatus}),
  ];
}

test('Phase 1 search terminal 503 fixtures require the exact failure count and no skipped or unknown sources', () => {
  for (const branch of ['all-failed','partial']) {
    const context = phase1Capture();
    const assertion = loadCase(`bookshelf.search-${branch}`).assertions.find(check => check.kind === 'phase-projection');
    const expected = assertion.expected;
    assert.equal(expected.httpResponseStatus,503);
    context.actions[assertion.action] = context.actions['submit-b'];
    context.samples[assertion.sample] = context.samples['results-b'];
    const [host, viewport] = context.samples[assertion.sample].nodes;
    host.id = expected.node;
    if (expected.publicResult) context.samples[assertion.sample].nodes.push(
      node('reader-search-public-local-result', `${viewport.path}/0`, viewport.path));
    change(context, 37, {...expected,projection:expected.projections[0]});
    const run = () => evaluateSearch({...assertion,expected,acceptedSources:assertion.sources}, context).verdict;
    assert.equal(run(), 'NOT_RUN', 'a failure count does not prove the fixed HTTP response');
    context.events.push(...onlineAttemptEvents(31,36));
    context.events.sort((a,b) => a.eventSeq - b.eventSeq);
    assert.equal(run(), 'PASS', branch);
    change(context,36,{httpStatus:404});
    assert.equal(run(),'FAIL');
    change(context,36,{httpStatus:undefined});
    assert.equal(run(),'NOT_RUN');
    change(context,36,{httpStatus:503,generation:21});
    assert.equal(run(),'NOT_RUN','a settled response from another work lease is not reusable');
    change(context,36,{generation:22});
    change(context, 37, {skippedCount:1});
    assert.equal(run(), 'FAIL');
    change(context, 37, {skippedCount:0,incompleteCount:1});
    assert.equal(run(), 'FAIL');
    change(context, 37, {incompleteCount:0,failedCount:2});
    assert.equal(run(), 'FAIL');
    change(context, 37, {failedCount:1,operationGeneration:21});
    assert.equal(run(), 'FAIL');
  }
});

test('Phase 1 search unconfirmed empty requires the pending viewport and exactly one unconfirmed source', () => {
  const contract = loadCase('bookshelf.search-unconfirmed-empty');
  const definition = contract.assertions.find(value => value.id === 'search.projection.unconfirmed-empty');
  const assertion = {...definition,expected:{...definition.expected}};
  delete assertion.expected.nativeUnconfirmedEmpty;
  const context = phase1Capture();
  const [host,viewport] = context.samples['results-b'].nodes;
  host.id = 'reader-bookshelf-search-pending';
  const expected = {projection:'error',operation:'partial',incompleteCount:1};
  change(context,37,expected);
  const verdict = () => evaluateSearch({...assertion,acceptedSources:assertion.sources},context).verdict;
  assert.equal(verdict(),'PASS');
  for (const terminal of [{projection:'empty',operation:'empty',incompleteCount:0}, {incompleteCount:2},
    {failedCount:1}, {skippedCount:1}, {searchActive:true}, {stopped:true}]) {
    change(context,37,{...expected,failedCount:0,skippedCount:0,searchActive:false,stopped:false,...terminal});
    assert.equal(verdict(),'FAIL');
  }
  change(context,37,{...expected,stopped:false});
  viewport.parentPath = '0';
  assert.equal(verdict(),'NOT_RUN');
});

test('Phase 1 search unconfirmed empty requires the current negotiated receipt and the native status', () => {
  const contract = loadCase('bookshelf.search-unconfirmed-empty');
  const spec = contract.assertions.find(value => value.id === 'search.projection.unconfirmed-empty');
  assert.equal(spec.expected.nativeUnconfirmedEmpty,true);
  assert.equal(contract.version,3);
  const assertion = {...spec,acceptedSources:spec.sources};
  const scope = {trigger:'initial',generation:22,session:2,queryRevision:8,sourceCount:1,sourceOrdinal:0,requestedPage:1};
  const receipt = {...scope,stage:'settled',outcome:'completed',capability:'book.search.page-receipt.v1',
    receiptState:'unknown',receiptReason:'unverifiedEmpty',progressState:'unknown',addedResultCount:0};
  const viewport = 'reader-search-result-list:3:8';
  const box = {left:0,top:0,width:200,height:400};
  const attrs = {hostWindowId:'42',bounds:'[0,0][200,400]',origBounds:'[0,0][200,400]',visible:'true',opacity:'1'};
  const native = (type,id,children = [],extra = {}) => ({attributes:{...attrs,type,id,...extra},children});
  function contextFor({terminal=receipt,started=true,heading='搜索结果未确认',outside=false,duplicate=false,
    observe=true,retained=false} = {}) {
    const context = phase1Capture();
    change(context,37,{projection:'error',operation:'partial',incompleteCount:1});
    if (started) context.events.push(event(28,'business','search-online-attempt',{...scope,stage:'started'}));
    if (terminal) context.events.push(event(34,'business','search-online-attempt',terminal));
    const title = heading && native('Text','',[],{originalText:heading});
    const insideList = [!outside && title,duplicate && title,
      retained && native('Button','reader-search-result:[3,8,"online:private-fixture-row"]')].filter(Boolean);
    const pending = native('Stack','reader-bookshelf-search-pending',[
      native('List',viewport,insideList),...(outside ? [title] : []),
    ]);
    const tree = {attributes:{bounds:attrs.bounds},children:[
      native('root','',[native('Stack','reader-library-search-surface',[pending])],
        {bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'}),
    ]};
    const normalized = normalizeHarmonyLayout({tree,windowId:'42',sampleId:'results-b',state:'results-b',instanceId:INSTANCE,
      report:{windowId:'42',vpPixels:1,metrics:{ready:true,revision:1,densityPixels:1,windowRect:box,globalRect:box,
        keyboardArea:{available:true,visible:false,rects:[],revision:1},keyboardInsets:{left:0,top:0,right:0,bottom:0}}},
      observeSearchUnconfirmedEmpty:observe,publicBookTitle:'Public fixture book',evidenceRefs:['native-results']});
    context.samples['results-b'] = {...context.samples['results-b'],...normalized,captureComplete:true};
    return context;
  }
  const check = context => evaluateSearch(assertion,context);
  const correct = check(contextFor());
  assert.equal(correct.verdict,'PASS',correct.reason);
  for (const options of [{terminal:{...receipt,generation:21}},{terminal:null},{started:false},
    {terminal:{...scope,stage:'settled',outcome:'completed'}},{heading:null},{outside:true},{duplicate:true},{observe:false}]) {
    assert.equal(check(contextFor(options)).verdict,'NOT_RUN');
  }
  for (const options of [{terminal:{...receipt,receiptState:'end',progressState:'end'}},
    {terminal:{...receipt,receiptReason:'urlGuard'}},{terminal:{...receipt,requestedPage:2}},
    {heading:'书源搜索失败'},{heading:'没有找到相关书籍'},{retained:true}]) {
    assert.equal(check(contextFor(options)).verdict,'FAIL');
  }
  const repeated = contextFor();
  repeated.events.push(event(35,'business','search-online-attempt',receipt));
  assert.equal(check(repeated).verdict,'FAIL');
  assert.equal(check(contextFor({terminal:null,heading:'书源搜索失败'})).verdict,'FAIL',
    'A proved native error survives missing attempt evidence');
  const normalized = JSON.stringify(contextFor({retained:true}).samples['results-b']);
  assert.ok(!normalized.includes('private-fixture-row') && !normalized.includes('搜索结果未确认'));
});

test('Phase 1 search append requires adjacent admitted Core pages, their merged rows and the current native viewport', () => {
  const contract = loadCase('bookshelf.search-append');
  const [append, back] = contract.assertions;
  const assertion = {...append,action:'submit-b',sample:'results-b',acceptedSources:append.sources};
  const {requirePageThreeEnd,requirePageThreeDemand,requireFirstPageReceipt,...v2Expected} = append.expected;
  assert.equal(contract.version,5);
  assert.equal(requirePageThreeEnd,true);
  assert.equal(requirePageThreeDemand,true);
  assert.equal(requireFirstPageReceipt,true);
  const v3Expected = {...v2Expected,requirePageThreeEnd:true};
  const v4Expected = {...v3Expected,requirePageThreeDemand:true};
  const evaluateV3 = context => evaluateSearch({...assertion,expected:v3Expected},context);
  const evaluateV4 = context => evaluateSearch({...assertion,expected:v4Expected},context);
  const scope = {owner:5,page:3,queryRevision:8,operationGeneration:22};
  const viewportId = 'reader-search-result-list:3:8';
  const continuation = 'search-continuation-page';
  const page = {owner:5,page:3,queryRevision:8,generation:22,session:2,sourceOrdinal:0,requestedPage:2,
    previousPage:1,capability:'book.search.page-receipt.v1',trigger:'viewport'};
  const state = {...scope, viewportId, projection:'results', operation:'partial', searchActive:false,
    moreSources:true, stopped:false, localFailed:false, resultCount:2, publicationRevision:13};
  const activeContext = () => {
    const context = phase1Capture();
    context.events = context.events.filter(item => item.eventSeq !== 37);
    const sample = context.samples['results-b'];
    sample.captureComplete = true;
    sample.beforeSeq = 50;
    sample.afterSeq = 51;
    sample.nodes[0].id = 'reader-bookshelf-search-results';
    sample.nodes.push(node('reader-search-public-local-result','0/0/0/0','0/0/0'));
    context.events.push(
      event(33,'business','search-page-projection',{...state}),
      event(34,'business','search-page-action',{...scope,action:'need-more',resultCount:2}),
      event(35,'business','search-page-projection',{...state,searchActive:true,publicationRevision:14}),
      event(36,'business',continuation,{...page,stage:'admitted'}),
      event(37,'business',continuation,{...page,stage:'settled',outcome:'receipt',addedResultCount:1,
        receiptState:'next',progressState:'ready',nextPage:3}),
      event(38,'business','search-page-projection',{...state,resultCount:3,publicationRevision:15}),
    );
    return context;
  };
  const evaluateV2 = (context = activeContext()) => evaluateSearch({...assertion,expected:v2Expected},context);
  const evaluate = evaluateV4;
  const applicability = (context, assessed, version = 4) =>
    [append,back].map(assertion => conditionApplicability(assertion,context,assessed,{...contract,version}).status);
  const valid = activeContext();
  const passed = evaluateV2(valid);
  assert.equal(passed.verdict,'PASS');
  assert.equal(passed.actual.viewportPath,'0/0/0');
  assert.equal(passed.actual.retainedPublicResultPath,'0/0/0/0');
  assert.equal(passed.actual.added,1);
  assert.deepEqual(passed.actual.pages.map(({requestedPage,admittedSeq,settledSeq}) =>
    [requestedPage,admittedSeq,settledSeq]), [[2,36,37]]);
  assert.deepEqual(applicability(valid,passed),['APPLIES','APPLIES']);
  const partial = evaluate(valid);
  assert.equal(partial.verdict,'NOT_RUN');
  assert.deepEqual(applicability(valid,partial),['APPLIES','APPLIES']);
  const chained = activeContext();
  chained.events = chained.events.filter(item => item.eventSeq !== 35);
  const finalPage = {...page,requestedPage:3,previousPage:2};
  chained.events.push(
    event(39,'business','search-page-action',{...scope,action:'need-more',resultCount:3}),
    event(40,'business',continuation,{...finalPage,stage:'admitted'}),
    event(41,'business',continuation,{...finalPage,stage:'settled',outcome:'receipt',addedResultCount:0,
      receiptState:'end',progressState:'end'}),
    event(42,'business','search-page-projection',{...state,resultCount:3,moreSources:false,operation:'current',
      failedCount:0,skippedCount:0,incompleteCount:0,sourceListFailed:false,publicationRevision:16}),
  );
  const nativeRows = chained.samples['results-b'].nodes;
  const mount = {page:3,queryRevision:8,kind:'online'};
  nativeRows.at(-1).searchResultMount = {...mount,kind:'local'};
  for (const [index,role] of ['cedar','maple'].entries()) {
    nativeRows.push({...node(`reader-search-public-online-result-${role}`,`0/0/0/${index + 1}`,'0/0/0'),
      alias:`reader-search-public-online-result-${role}`,searchResultMount:mount,
      searchTitleObserved:true,publicOnlineRoles:[role]});
  }
  const exhausted = evaluate(chained);
  assert.equal(exhausted.verdict,'PASS');
  const evaluateV5 = context => evaluateSearch(assertion,context);
  const withoutFirst = evaluateV5(chained);
  assert.equal(withoutFirst.verdict,'NOT_RUN','later continuation does not establish the real first-page receipt');
  assert.deepEqual(applicability(chained,withoutFirst,5),['UNKNOWN','UNKNOWN']);
  const firstPage = {queryRevision:8,generation:22,session:2,sourceCount:1,sourceOrdinal:0,
    stage:'settled',trigger:'initial',outcome:'completed',requestedPage:1,capability:'book.search.page-receipt.v1',
    receiptState:'next',progressState:'ready',nextPage:2,addedResultCount:1};
  const initial = event(31,'business','search-online-attempt',firstPage);
  const proven = structuredClone(chained);
  proven.events.splice(proven.events.findIndex(item => item.eventSeq === 32),0,initial);
  const proved = evaluateV5(proven);
  assert.equal(proved.verdict,'PASS');
  assert.equal(proved.actual.firstPage.settledSeq,31);
  assert.deepEqual(applicability(proven,proved,5),['APPLIES','APPLIES']);
  const stoppedAfterFirst = structuredClone(proven);
  stoppedAfterFirst.events = stoppedAfterFirst.events.filter(item => item.eventSeq <= 33);
  const waiting = evaluateV5(stoppedAfterFirst);
  assert.equal(waiting.verdict,'NOT_RUN');
  assert.deepEqual(applicability(stoppedAfterFirst,waiting,5),['APPLIES','APPLIES'],
    'an admitted second page is no longer needed to establish applicability');
  change(stoppedAfterFirst,33,{moreSources:false});
  const discarded = evaluateV5(stoppedAfterFirst);
  assert.equal(discarded.verdict,'FAIL','the scoped native endpoint explicitly lost the proved continuation');
  assert.equal(discarded.observationsComplete,false);
  const noSurface = structuredClone(stoppedAfterFirst);
  noSurface.events = noSurface.events.filter(item => item.eventSeq !== 32);
  assert.deepEqual(applicability(noSurface,evaluateV5(noSurface),5),['APPLIES','APPLIES']);
  const wrongTrigger = structuredClone(proven);
  change(wrongTrigger,36,{trigger:'empty'});
  assert.equal(evaluateV5(wrongTrigger).verdict,'FAIL');
  for (const bad of [{generation:21},{queryRevision:7},{sourceCount:2},{nextPage:3},{addedResultCount:0}]) {
    const wrong = structuredClone(proven);
    change(wrong,31,bad);
    const result = evaluateV5(wrong);
    assert.equal(result.verdict,'NOT_RUN');
    assert.deepEqual(applicability(wrong,result,5),['UNKNOWN','UNKNOWN']);
  }
  const outOfOrderFirst = structuredClone(chained);
  outOfOrderFirst.events.splice(outOfOrderFirst.events.findIndex(item => item.eventSeq === 36),0,{...initial,eventSeq:35});
  assert.equal(evaluateV5(outOfOrderFirst).verdict,'FAIL','the first-page receipt arrived after the purported merged baseline');
  const duplicateFirst = structuredClone(proven);
  duplicateFirst.events.splice(duplicateFirst.events.findIndex(item => item.eventSeq === 36),0,{...initial,eventSeq:35});
  assert.equal(evaluateV5(duplicateFirst).verdict,'FAIL','a fixed single-source run may not observe page one twice');
  const noThirdDemand = structuredClone(chained);
  noThirdDemand.events = noThirdDemand.events.filter(item => item.eventSeq !== 39);
  assert.equal(evaluateV3(noThirdDemand).verdict,'PASS','v3 used only the first viewport demand');
  assert.equal(evaluateV4(noThirdDemand).verdict,'NOT_RUN','page three has no fresh viewport demand');
  const noSettledSecondProjection = structuredClone(chained);
  noSettledSecondProjection.events = noSettledSecondProjection.events.filter(item => item.eventSeq !== 38);
  assert.equal(evaluateV4(noSettledSecondProjection).verdict,'NOT_RUN');
  const wrongThirdDemand = structuredClone(chained);
  change(wrongThirdDemand,39,{resultCount:2});
  assert.equal(evaluateV4(wrongThirdDemand).verdict,'FAIL');
  const premature = structuredClone(chained);
  premature.events.splice(premature.events.findIndex(item => item.eventSeq === 36),0,
    event(35,'business','search-page-projection',{...state,resultCount:3,searchActive:true,publicationRevision:14}));
  assert.equal(evaluateV4(premature).verdict,'FAIL','the second result cannot be published before its page settles');
  assert.deepEqual(evaluateV4(chained).actual.thirdViewportDemand,{demandSeq:39,priorProjectionSeq:38});
  assert.deepEqual(exhausted.actual.pages.map(({requestedPage,addedResultCount}) => [requestedPage,addedResultCount]),
    [[2,1],[3,0]]);
  assert.match(jsonDigest(exhausted.actual),/^[a-f0-9]{64}$/u);
  assert.deepEqual(exhausted.actual.nativeResults.onlineRows.map(item => [item.role,item.matched.length]),
    [['cedar',1],['maple',1]]);
  const omitted = structuredClone(chained);
  omitted.samples['results-b'].nodes.pop();
  assert.equal(evaluate(omitted).verdict,'NOT_RUN','two visible rows need not cover all virtualized results');
  const wrongVisible = structuredClone(chained);
  const wrongRow = wrongVisible.samples['results-b'].nodes.at(-1);
  delete wrongRow.alias;
  delete wrongRow.publicOnlineRoles;
  assert.equal(evaluate(wrongVisible).verdict,'FAIL','all three visible results expose a missing fixed row');
  delete wrongRow.searchTitleObserved;
  assert.equal(evaluate(wrongVisible).verdict,'NOT_RUN','mounted rows without readable titles are incomplete');
  for (const changeRow of [
    row => { row.searchResultMount.kind = 'local'; },
    row => { row.searchResultMount.page = 2; },
    row => { row.parentPath = '0'; },
    row => { row.publicOnlineRoles.push('cedar'); },
  ]) {
    const wrong = structuredClone(chained);
    const r = wrong.samples['results-b'].nodes.at(-1);
    r.searchResultMount = {...r.searchResultMount};
    changeRow(r);
    assert.equal(evaluate(wrong).verdict,'FAIL');
  }
  const duplicate = structuredClone(chained);
  const duplicatedRows = duplicate.samples['results-b'].nodes;
  duplicatedRows.push({...duplicatedRows.at(-1),path:'0/0/0/3'});
  assert.equal(evaluate(duplicate).verdict,'FAIL');
  for (const [field,value] of [
    ['moreSources',true],['operation','partial'],['failedCount',1],['skippedCount',1],
    ['incompleteCount',1],['localFailed',true],['sourceListFailed',true],['resultCount',4],
  ]) {
    const wrong = structuredClone(chained);
    change(wrong,42,{[field]:value});
    assert.equal(evaluate(wrong).verdict,'FAIL',field);
  }
  const wrongPageThree = structuredClone(chained);
  change(wrongPageThree,41,{addedResultCount:1});
  assert.equal(evaluate(wrongPageThree).verdict,'FAIL');
  const pageThreeOnly = structuredClone(chained);
  pageThreeOnly.events = pageThreeOnly.events.filter(event => ![36,37].includes(event.eventSeq));
  assert.equal(evaluateV2(pageThreeOnly).verdict,'FAIL','no contributed second page');
  assert.equal(evaluate(pageThreeOnly).verdict,'FAIL','cannot begin the fixture with page three');
  const missingTerminalFact = structuredClone(chained);
  delete missingTerminalFact.events.find(event => event.eventSeq === 42).payload.moreSources;
  assert.equal(evaluate(missingTerminalFact).verdict,'NOT_RUN');
  const prematureEnd = structuredClone(valid);
  change(prematureEnd,37,{receiptState:'end',progressState:'end',nextPage:undefined});
  delete prematureEnd.samples['results-b'];
  assert.equal(evaluate(prematureEnd).verdict,'FAIL','known early exhaustion survives missing capture');
  change(chained,40,{requestedPage:4,previousPage:3});
  change(chained,41,{requestedPage:4,previousPage:3});
  assert.equal(evaluate(chained).verdict,'FAIL');

  const variations = [
    [context => context.events = context.events.filter(item => item.eventSeq !== 26), 'NOT_RUN','UNKNOWN'],
    [context => change(context,26,{enabled:false}), 'FAIL','UNKNOWN'],
    [context => context.events.splice(context.events.findIndex(item => item.eventSeq === 32),0,
      event(28,'business','search-submit-accepted',{...SEARCH,queryRevision:9})), 'FAIL','UNKNOWN'],
    [context => context.events = context.events.filter(item => item.kind !== continuation), 'NOT_RUN','UNKNOWN'],
    [context => change(context,36,{queryRevision:7}), 'NOT_RUN','UNKNOWN'],
    [context => change(context,36,{owner:4}), 'NOT_RUN','UNKNOWN'],
    [context => change(context,36,{generation:23}), 'NOT_RUN','UNKNOWN'],
    [context => change(context,36,{session:1}), 'NOT_RUN','UNKNOWN'],
    [context => change(context,36,{requestedPage:1,previousPage:0}), 'NOT_RUN','UNKNOWN'],
    [context => change(context,36,{previousPage:0}), 'NOT_RUN','UNKNOWN'],
    [context => change(context,36,{trigger:'empty'}), 'NOT_RUN','UNKNOWN'],
    [context => change(context,36,{capability:'legacy'}), 'NOT_RUN','UNKNOWN'],
    [context => change(context,34,{queryRevision:7}), 'NOT_RUN','APPLIES'],
    [context => change(context,33,{searchActive:true}), 'FAIL','APPLIES'],
    [context => change(context,33,{moreSources:false}), 'FAIL','APPLIES'],
    [context => change(context,33,{stopped:true}), 'FAIL','APPLIES'],
    [context => change(context,33,{localFailed:true}), 'FAIL','APPLIES'],
    [context => change(context,34,{operationGeneration:23}), 'FAIL','APPLIES'],
    [context => change(context,37,{session:1}), 'NOT_RUN','APPLIES'],
    [context => change(context,37,{sourceOrdinal:1}), 'FAIL','APPLIES'],
    [context => change(context,37,{page:4}), 'FAIL','APPLIES'],
    [context => change(context,37,{nextPage:4}), 'FAIL','APPLIES'],
    [context => change(context,37,{outcome:'failed',addedResultCount:0}), 'FAIL','APPLIES'],
    [context => change(context,37,{outcome:'missing-receipt'}), 'FAIL','APPLIES'],
    [context => change(context,37,{receiptState:'unknown',progressState:'unknown',nextPage:undefined}), 'FAIL','APPLIES'],
    [context => change(context,37,{progressState:'unknown'}), 'FAIL','APPLIES'],
    [context => change(context,37,{addedResultCount:0}), 'FAIL','APPLIES'],
    [context => change(context,38,{operationGeneration:23}), 'FAIL','APPLIES'],
    [context => change(context,35,{resultCount:1}), 'FAIL','APPLIES'],
    [context => change(context,38,{resultCount:2}), 'FAIL','APPLIES'],
    [context => change(context,38,{resultCount:4}), 'FAIL','APPLIES'],
    [context => context.samples['results-b'].nodes[1].id = 'reader-search-result-list:2:7', 'FAIL','APPLIES'],
    [context => context.samples['results-b'].nodes.splice(1,1), 'FAIL','APPLIES'],
    [context => context.samples['results-b'].nodes.pop(), 'FAIL','APPLIES'],
    [context => context.samples['results-b'].nodes[1].parentPath = '0', 'NOT_RUN','APPLIES'],
    [context => context.events.push(event(39,'business','search-submit-accepted',{...SEARCH,queryRevision:9})),
      'FAIL','APPLIES'],
    [context => delete context.samples['results-b'], 'NOT_RUN','APPLIES'],
    [context => { delete context.samples['results-b']; change(context,37,{outcome:'failed'}); }, 'FAIL','APPLIES'],
    [context => context.events.pop(), 'NOT_RUN','APPLIES'],
  ];
  for (const [index,[mutate,verdict,status]] of variations.entries()) {
    const context = activeContext();
    mutate(context);
    const result = evaluateV2(context);
    assert.equal(result.verdict,verdict,`Case ${index + 1}: ${result.reason}`);
    assert.deepEqual(applicability(context,result),[status,status],`Condition applicability for case ${index + 1}`);
  }
});

test('Phase 1 search append advances the public three-page sequence through ordinary viewport demand', async () => {
  const { searchTypes } = await import('../../lib/book-search-page-probe.mjs');
  const { selectedProductionMethods, selectedProductionComponentCallback } =
    await import('../../lib/selected-production-methods.mjs');
  const { setImmediate } = await import('node:timers/promises');
  const source = name => new URL(`../../../entry/src/main/ets/features/search/${name}`,import.meta.url);
  const Page = selectedProductionMethods(source('ui/SearchPage.ets'),'SearchPage',
    ['moreResultsQueued','scheduleMoreResults','requestMoreResults','resultNativeIndex']);
  const Host = selectedProductionMethods(source('application/SearchHost.ets'),'SearchHost',
    ['needMoreResults','getOrchestrator']);
  const fixture = loadCase('bookshelf.search-append').fixture;
  const sourceId = 'public-three-page-source';
  const sourceVersion = jsonDigest(sourceId);
  const pageRows = [
    [{bookId:'cedar',title:'Reader Phase 1 Online Cedar',author:'Public Fixture'}],
    [{bookId:'maple',title:'Reader Phase 1 Online Maple',author:'Public Fixture'}],
    [],
  ];
  const requests = [], observations = [], initialPages = [], publications = [], demandTimeline = [];
  const runtime = {
    supportsCoreCapability:capability => capability === 'book.search.page-receipt.v1',
    async request(method,params) {
      if (method === 'source.list') return {data:{sources:[{sourceId,sourceVersion,
        name:'Reader public three pages',enabled:true,category:'novel'}]}};
      if (method === 'bookshelf.list') return {data:{books:[
        {sourceId:'local',bookId:'public-local',title:fixture.bookTitle,author:'Public Fixture'},
      ]}};
      if (method === 'search.history.list') return {data:{keywords:[],count:0}};
      if (method === 'search.history.add') return {data:{}};
      assert.equal(method,'book.search');
      requests.push(params);
      const {page,keyword} = params, books = pageRows[page - 1];
      assert.ok(books);
      const pageReceipt = {sourceId,sourceVersion,query:keyword,requestedPage:page,
        state:books.length > 0 ? 'next' : 'end',...(books.length > 0 ? {nextPage:page + 1} : {}),
        requestFingerprint:jsonDigest({page}),responseFingerprint:jsonDigest({books}),
        candidateFingerprint:jsonDigest(books.map(book => book.bookId))};
      return {data:{sourceId,sourceVersion,contentKind:'text',books,pageReceipt}};
    },
  };
  const page = Object.assign(new Page(),{viewState:{revision:1},visibleGroups:[],visibleStart:0,visibleEnd:-1,
    ownsPageQuery:() => true,ownsList:() => true,isPresentationVisible:() => true,
    observePageAction:action => demandTimeline.push({action, count:page.presentation.results.length, searching:page.presentation.searching}),
    resultViewportId:() => 'reader-search-result-list:1:1',resultScroller:{getItemRect:index => ({y:index * 130,height:130})},
    getUIContext:() => ({px2vp:value => value,getComponentUtils:() => ({getRectangleById:() => ({size:{height:710}})})})});
  const owner = new searchTypes.SearchOrchestrator(presentation => {
    publications.push(presentation);
    page.presentation = presentation;
    page.visibleGroups = presentation.kind === 'results' ? presentation.results : [];
    page.scheduleMoreResults();
  },() => {},() => true,runtime);
  owner.observeContinuation({
    enabled:() => true,
    observe:observation => {
      observations.push(observation);
      demandTimeline.push({stage:observation.stage,page:observation.requestedPage});
    },
    observeAttempt:observation => {
      if (observation.stage !== 'settled' || observation.receiptState !== 'next') return;
      initialPages.push(observation);
      demandTimeline.push({stage:'first-page',page:observation.requestedPage});
    },
  });
  const host = Object.assign(new Host(),{orchestrator:owner});
  page.onNeedMore = selectedProductionComponentCallback(source('ui/LibrarySearchResults.ets'),
    'SearchPage','onNeedMore',{inputCurrent:() => true,presentation:{host}});
  owner.open();
  await setImmediate();
  owner.search(fixture.inputs.a);
  for (let attempt = 0; attempt < 12 && publications.at(-1)?.operation?.fact !== 'current'; attempt++) {
    await setImmediate();
  }
  const terminal = publications.at(-1);
  assert.deepEqual(requests.map(params => [params.page,params.expectedSourceVersion,params.pageReceipt]),
    [1,2,3].map(number => [number,sourceVersion,true]));
  assert.deepEqual(initialPages.map(item => [
    item.sourceCount,item.sourceOrdinal,item.outcome,item.requestedPage,item.receiptState,item.progressState,item.nextPage,item.addedResultCount,
  ]),[[1,0,'completed',1,'next','ready',2,1]]);
  const firstPage = demandTimeline.findIndex(item => item.stage === 'first-page');
  const secondDemand = demandTimeline.findIndex(item => item.action === 'need-more' && item.count === 2 && !item.searching);
  assert.ok(firstPage >= 0 && secondDemand > firstPage);
  assert.deepEqual(observations.filter(item => item.stage === 'settled').map(item =>
    [item.trigger,item.sourceOrdinal,item.requestedPage,item.receiptState,item.addedResultCount]),
  [['viewport',0,2,'next',1],['viewport',0,3,'end',0]]);
  const secondSettled = demandTimeline.findIndex(item => item.stage === 'settled' && item.page === 2);
  const thirdAdmitted = demandTimeline.findIndex(item => item.stage === 'admitted' && item.page === 3);
  assert.ok(secondSettled >= 0 && thirdAdmitted > secondSettled);
  assert.ok(demandTimeline.slice(secondSettled + 1,thirdAdmitted).some(item =>
    item.action === 'need-more' && item.count === 3 && item.searching === false));
  assert.equal(terminal.operation.fact,'current');
  assert.equal(terminal.hasMoreSources,false);
  assert.equal(terminal.incompleteSourceCount,0);
  assert.deepEqual(terminal.results.map(book => book.title),
    [fixture.bookTitle,pageRows[0][0].title,pageRows[1][0].title]);
  owner.close();
});

function taskRetryCapture() {
  const context = phase1Capture();
  const scope = {owner:5,page:3,queryRevision:8};
  const viewportId = 'reader-search-result-list:3:8';
  const terminal = {...scope, viewportId, projection:'results', operation:'partial', resultCount:1,
    failedCount:1,skippedCount:0,incompleteCount:0,searchActive:false,stopped:false,localFailed:false,sourceListFailed:false};
  const makeNodes = () => [node('reader-bookshelf-search-results','0/0','0'),node(viewportId,'0/0/0','0/0'),
    node('reader-search-public-local-result','0/0/0/0','0/0/0')];
  context.actions['submit-a'] = context.actions['submit-b'];
  context.actions['open-task'] = action('click','reader-search-task-trigger',42,44,43,44);
  context.actions.retry = {...action('click','reader-search-task-retry',47,51,47,51),from:'task-ready'};
  context.samples['results-a'] = sample('results-a',39,41,40,42,false,makeNodes());
  context.samples['task-ready'] = sample('task-ready',45,46,45,46,false,[node('reader-search-task-retry','0/1','0')]);
  context.samples.retried = {...sample('retried',55,56,56,57,false,makeNodes()),captureComplete:true};
  change(context,37,{...terminal,operationGeneration:22});
  context.events.push(
    event(43,'business','search-page-action',{...scope,action:'panel-open',panel:'task',operationGeneration:22,resultCount:1}),
    event(48,'business','search-page-action',{...scope,action:'retry',operationGeneration:22,resultCount:1}),
    event(49,'business','search-page-projection',{...terminal,operation:'refreshing',operationGeneration:23,searchActive:true}),
    event(52,'business','search-page-projection',{...terminal,operationGeneration:23}),
  );
  return context;
}

test('Phase 1 search Task retry requires one new work generation, the same query, and retained local result', () => {
  const context = taskRetryCapture();
  const definition = loadCase('bookshelf.search-retry').assertions.find(check => check.kind === 'phase-task-retry');
  const {requireSamePublicBook,...v5Expected} = definition.expected;
  const assertion = {...definition,expected:v5Expected};
  assert.equal(assertion.expected.requireRetainedWhileRefreshing,true);
  const strict = assertion;
  assert.equal(strict.expected.httpResponseStatus,503);
  const {requireRetainedWhileRefreshing,httpResponseStatus,...legacy} = strict.expected;
  const run = (check = {...assertion,expected:legacy}) => evaluateSearch({...check,acceptedSources:check.sources},context);
  assert.equal(run(strict).verdict,'NOT_RUN','retained counters alone do not prove retry reached the source again');
  context.events.push(...onlineAttemptEvents(31,36),...onlineAttemptEvents(50,51,{
    generation:23,trigger:'retry',sameFailedSource:true,
  }));
  context.events.sort((a,b) => a.eventSeq - b.eventSeq);
  assert.equal(run(strict).verdict,'PASS');
  assert.equal(run(strict).actual.terminalGeneration,23);
  change(context,51,{httpStatus:404});
  assert.equal(run(strict).verdict,'FAIL');
  change(context,51,{httpStatus:503,sameFailedSource:false});
  assert.equal(run(strict).verdict,'FAIL');
  change(context,51,{sameFailedSource:undefined});
  assert.equal(run(strict).verdict,'NOT_RUN');
  change(context,51,{sameFailedSource:true});
  context.events.push(event(50,'business','search-online-attempt',{...context.events.find(item => item.eventSeq === 50).payload}));
  assert.equal(run(strict).verdict,'FAIL');
  context.events.pop();
  change(context,49,{projection:'loading',resultCount:0});
  assert.equal(run().verdict,'PASS','the old verdict only checked retained endpoint rows');
  assert.equal(run(strict).verdict,'FAIL','a verified mid-retry result reset must fail');
  const post = context.samples.retried;
  delete context.samples.retried;
  const partial = run(strict);
  assert.equal(partial.verdict,'FAIL','the retry action journal already proves the result reset');
  assert.equal(partial.observationsComplete,false);
  change(context,49,{projection:'results',resultCount:1});
  assert.equal(run(strict).verdict,'NOT_RUN','pass still requires the final capture');
  context.samples.retried = post;
  delete context.events.find(item => item.eventSeq === 49).payload.resultCount;
  assert.equal(run(strict).verdict,'NOT_RUN','missing retention observations cannot pass');
  change(context,49,{resultCount:1,operationGeneration:22});
  assert.equal(run(strict).verdict,'FAIL');
  change(context,49,{operationGeneration:23});
  change(context,52,{queryRevision:9});
  assert.equal(run(strict).verdict,'FAIL');
  change(context,52,{queryRevision:8,incompleteCount:1});
  assert.equal(run(strict).verdict,'FAIL');
  change(context,52,{incompleteCount:0,skippedCount:1});
  assert.equal(run(strict).verdict,'FAIL');
  change(context,52,{skippedCount:0});
  context.samples.retried.nodes.pop();
  assert.equal(run(strict).verdict,'NOT_RUN');
});

function taskRetryNativeRows(context, contract, sampleId, book, {page=3,query=8,complete=true,online=[]} = {}) {
  const box = {left:0,top:0,width:200,height:400};
  const bounds = '[0,0][200,400]';
  const props = {hostWindowId:'42',bounds,origBounds:bounds,visible:'true',opacity:'1',enabled:'true',clickable:'true'};
  const native = (type,id,children = [],extra = {}) => ({attributes:{...props,type,id,...extra},children});
  const title = contract.fixture.bookTitle;
  const publicOnlineResultTitles = contract.fixture.onlineResultTitles;
  const local = native('Button',`reader-search-result:${JSON.stringify([page,query,`local:${book}`])}`,
    [native('Text','',[],{text:title})]);
  const recovered = online.map(({identity,page:onlinePage=3,query:onlineQuery=8,title:onlineTitle=publicOnlineResultTitles.recovery}) =>
    native('Button',`reader-search-result:${JSON.stringify([onlinePage,onlineQuery,`online:${identity}`])}`,[
      native('Row','',[native('Column','',[native('Column','',[
        native('Text','',[],{text:onlineTitle}),
      ])])]),
    ]));
  const tree = {attributes:{bounds},children:[
    native('root','',[native('Stack','reader-bookshelf-search-results',[
      native('List','reader-search-result-list:3:8',[local,...recovered]),
    ])],{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'}),
  ]};
  const normalized = normalizeHarmonyLayout({tree,windowId:'42',sampleId,state:sampleId,instanceId:INSTANCE,
    report:{windowId:'42',vpPixels:1,metrics:{ready:true,revision:1,densityPixels:1,windowRect:box,globalRect:box}},
    publicBookTitle:title,publicOnlineResultTitles,evidenceRefs:[sampleId]});
  context.samples[sampleId] = {...context.samples[sampleId],...normalized,captureComplete:complete};
}

test('Phase 1 search Task retry keeps the same native public book across fixed 503', () => {
  const contract = loadCase('bookshelf.search-retry');
  const spec = contract.assertions.find(check => check.kind === 'phase-task-retry');
  assert.equal(contract.version,7);
  assert.equal(spec.expected.requireSamePublicBook,true);
  const strict = {...spec,acceptedSources:spec.sources};
  const {requireSamePublicBook,...previousExpected} = spec.expected;
  const v5 = {...strict,expected:previousExpected};
  const context = taskRetryCapture();
  context.events.push(...onlineAttemptEvents(31,36),...onlineAttemptEvents(50,51,{
    generation:23,trigger:'retry',sameFailedSource:true,
  }));
  context.events.sort((a,b) => a.eventSeq-b.eventSeq);
  const setRow = (...args) => taskRetryNativeRows(context,contract,...args);
  const run = (assertion=strict) => evaluateSearch(assertion,context);
  setRow('results-a','opaque-original');
  setRow('retried','opaque-original');
  const same = run();
  assert.equal(same.verdict,'PASS',same.reason);
  assert.deepEqual(same.actual.publicResultContinuity,{beforePage:3,beforeQuery:8,afterPage:3,afterQuery:8,sameBook:true});
  assert.equal(same.actual.originalOnlineAttempt.httpStatus,503);
  assert.equal(same.actual.retriedOnlineAttempt.sameFailedSource,true);
  assert.ok(!JSON.stringify(same).includes('opaque-original'));

  setRow('retried','opaque-replacement');
  assert.equal(run(v5).verdict,'PASS','the historical v5 evaluator accepted the same title and count');
  const swapped = run();
  assert.equal(swapped.verdict,'FAIL',swapped.reason);
  assert.equal(swapped.actual.publicResultContinuity.sameBook,false);
  assert.ok(!JSON.stringify(swapped).includes('opaque-replacement'));
  setRow('retried','opaque-original',{query:7});
  assert.equal(run().verdict,'FAIL','a retained-looking row from a prior query is wrong');
  setRow('retried','opaque-original',{page:2});
  assert.equal(run().verdict,'FAIL','a retained-looking row from a prior native page is wrong');

  setRow('retried','opaque-original');
  const rows = context.samples.retried.nodes;
  const index = rows.findIndex(item => item.alias === 'reader-search-public-local-result');
  rows[index] = {...rows[index]};
  assert.equal(run().verdict,'NOT_RUN','the public title and list do not substitute for an unobserved identity');
  change(context,51,{httpStatus:404});
  assert.equal(run().verdict,'FAIL','missing row identity does not hide contradictory HTTP evidence');
  change(context,51,{httpStatus:503});
  change(context,49,{projection:'loading',resultCount:0});
  assert.equal(run().verdict,'FAIL','missing row identity does not hide a visible result reset');
});

test('Phase 1 search Task retry proves recovery of the same failed source and new online result', () => {
  const contract = loadCase('bookshelf.search-retry-success');
  const spec = contract.assertions.find(check => check.kind === 'phase-task-retry');
  assert.equal(contract.version,2);
  assert.equal(spec.expected.recoveredResult,'recovery');
  assert.equal(spec.expected.httpResponseStatus,503);
  const strict = {...spec,acceptedSources:spec.sources};
  const scope = {owner:5,page:3,queryRevision:8,operationGeneration:23};
  const viewportId = 'reader-search-result-list:3:8';
  const next = {outcome:'completed',capability:'book.search.page-receipt.v1',receiptState:'next',
    progressState:'ready',nextPage:2,addedResultCount:1};
  const continuation = {owner:5,page:3,queryRevision:8,generation:23,session:2,trigger:'viewport',
    capability:'book.search.page-receipt.v1',sourceOrdinal:0,requestedPage:2,previousPage:1};
  const terminal = {...scope,viewportId,operation:'current',projection:'results',resultCount:2,failedCount:0,
    skippedCount:0,incompleteCount:0,searchActive:false,stopped:false,localFailed:false,sourceListFailed:false,moreSources:false};
  const recoveredBook = {identity:'opaque-online-recovered-book'};
  const make = ({before=[],after=[recoveredBook],local='opaque-original'} = {}) => {
    const context = taskRetryCapture();
    const [start] = onlineAttemptEvents(50,51,{generation:23,trigger:'retry',sameFailedSource:true});
    context.events.push(...onlineAttemptEvents(31,36),start,
      event(51,'business','search-online-attempt',{...start.payload,...next,stage:'settled'}),
      event(53,'business','search-continuation-page',{...continuation,stage:'admitted'}),
      event(54,'business','search-continuation-page',{...continuation,stage:'settled',outcome:'receipt',
        receiptState:'end',progressState:'end',addedResultCount:0}),
      event(55,'business','search-page-projection',{...terminal}));
    context.events.sort((a,b) => a.eventSeq-b.eventSeq);
    change(context,52,{resultCount:2,failedCount:0,moreSources:true});
    Object.assign(context.samples.retried,{beforeSeq:57,afterSeq:58});
    taskRetryNativeRows(context,contract,'results-a','opaque-original',{online:before});
    taskRetryNativeRows(context,contract,'retried',local,{online:after});
    return context;
  };
  const check = context => evaluateSearch(strict,context);
  const normal = check(make());
  assert.equal(normal.verdict,'PASS',normal.reason);
  assert.equal(normal.actual.originalOnlineAttempt.httpStatus,503);
  assert.equal(normal.actual.publicResultContinuity.sameBook,true);
  assert.deepEqual(normal.actual.retriedOnlineAttempt,{startedSeq:50,settledSeq:51,continuationAdmittedSeq:53,continuationSettledSeq:54});
  assert.equal(normal.actual.recoveryResultPaths.length,1);
  assert.ok(!JSON.stringify(normal).includes('opaque-online-recovered-book'));
  for (const bad of [
    {options:{before:[recoveredBook]}},
    {options:{after:[{...recoveredBook,query:7}]}},
    {options:{after:[{...recoveredBook,page:2}]}},
    {options:{after:[recoveredBook,{identity:'another-online-book'}]}},
    {options:{after:[{...recoveredBook,title:'Other public title'}]}},
    {options:{local:'same-title-replacement'}},
    {mutate:context => change(context,50,{sameFailedSource:false})},
    {mutate:context => change(context,51,{outcome:'failed'})},
    {mutate:context => change(context,51,{addedResultCount:0})},
    {mutate:context => change(context,51,{httpStatus:503})},
    {mutate:context => change(context,54,{progressState:'unknown'})},
    {mutate:context => change(context,54,{sourceOrdinal:1})},
    {mutate:context => change(context,55,{moreSources:true})},
    {mutate:context => change(context,49,{projection:'loading',resultCount:0})},
  ]) {
    const context = make(bad.options);
    bad.mutate?.(context);
    const result = check(context);
    assert.equal(result.verdict,'FAIL',result.reason);
  }
  for (const missing of [
    {options:{after:[]}},
    {options:{after:[{...recoveredBook,title:''}]}},
    {mutate:context => change(context,51,{receiptState:undefined})},
    {mutate:context => change(context,54,{generation:22})},
    {mutate:context => { context.events = context.events.filter(item => item.eventSeq !== 54); }},
    {mutate:context => { context.events = context.events.filter(item => item.eventSeq !== 36); }},
    {mutate:context => change(context,55,{moreSources:undefined})},
  ]) {
    const context = make(missing.options);
    missing.mutate?.(context);
    const result = check(context);
    assert.equal(result.verdict,'NOT_RUN',result.reason);
  }
  const contradicted = make({after:[]});
  contradicted.events = contradicted.events.filter(item => item.eventSeq !== 36);
  change(contradicted,54,{receiptState:'unknown'});
  assert.equal(check(contradicted).verdict,'FAIL','a proved bad continuation survives missing initial and native evidence');
  const interrupted = make();
  delete interrupted.samples.retried;
  change(interrupted,51,{outcome:'failed'});
  const failedBeforeCapture = check(interrupted);
  assert.equal(failedBeforeCapture.verdict,'FAIL','a proved retry failure survives an interrupted final capture');
  assert.equal(failedBeforeCapture.observationsComplete,false);
});

test('Phase 1 search temporary panel Back binds the actual sheet and both current result endpoints', () => {
  const title = 'Public fixture book';
  const viewport = 'reader-search-result-list:7:7';
  const scope = {owner:7,page:7,queryRevision:7,operationGeneration:1,resultCount:234};
  const projection = {...scope,publicationRevision:12,projection:'results',operation:'cancelled',searchActive:false,
    viewportId:viewport};
  const rect = {left:0,top:0,width:100,height:200};
  function leaf(type,id,children = [],extra = {}) {
    return {attributes:{type,id,hostWindowId:'42',bounds:'[0,0][100,200]',origBounds:'[0,0][100,200]',
      visible:'true',opacity:'1',enabled:'true',clickable:'true',...extra},children};
  }
  function nativeSample(state,first,last,showSheet,{panel = 'filter',row = 'fixture',wrongSheet = false,
    sheetHost, wrongRoot = false, listId = viewport, keyboard = false} = {}) {
    const trigger = leaf('Button', `reader-search-${panel}:7:7`);
    const result = leaf('Button', `reader-search-result:[7,7,"local:${row}"]`,
      [leaf('Text','',[],{text:title})]);
    const content = [leaf('List',listId,[trigger,result])];
    if (showSheet) {
      const titleNode = leaf('Text','',[],{text:(panel === 'task') !== wrongSheet ? '搜索进度' : '筛选'});
      if (sheetHost) {
        const frame = wrongRoot ? (panel === 'task' ? 'filter' : 'task') : panel;
        content.push(leaf('Stack','',[leaf('Column',`reader-search-sheet:${frame}`,[titleNode])]));
      } else {
        content.push(leaf('SheetWrapper','',[leaf('SheetPage','',[titleNode])]));
      }
    }
    const tree = {attributes:{bounds:'[0,0][100,200]'},children:[
      leaf('root','',content,{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'}),
    ]};
    return {...normalizeHarmonyLayout({tree,report:{windowId:'42',vpPixels:1,metrics:{
      ready:true,revision:1,densityPixels:1,windowRect:rect,globalRect:rect,
      keyboardArea:{available:true,visible:keyboard,rects:keyboard ? [{left:0,top:170,width:100,height:30}] : [],revision:1},
      keyboardInsets:{left:0,top:0,right:0,bottom:keyboard ? 30 : 0},
    }},sampleId:state,state,instanceId:INSTANCE,publicBookTitle:title,evidenceRefs:[state]}),
      beforeSeq:first,afterSeq:last,hostBeginMs:first,hostEndMs:last,captureComplete:true};
  }
  function fixture(panel = 'filter', retry = false, sheetHost) {
    const returnGeneration = retry ? 2 : 1;
    const before = nativeSample('results-a',4,5,false,{panel});
    const opened = nativeSample('panel-open',20,21,true,{panel,sheetHost});
    const backSource = retry ? 'task-retry-settled' : 'panel-open';
    return {actions:{
      'open-panel':{...action('click',`reader-search-${panel}-trigger`,6,13,6,13),from:'results-a'},
      'panel-back':{...action('keyEvent',undefined,24,30,24,30),key:'Back',from:backSource},
      ...(retry ? {retry:{...action('click','reader-search-task-retry',21,22,21,22),from:'panel-open'}} : {}),
    },samples:{
      'results-a':before,'panel-open':opened,
      'panel-closed':nativeSample('panel-closed',31,34,false,{panel}),
      ...(retry ? {'task-retry-settled':nativeSample('task-retry-settled',23,23,true,{panel,sheetHost})} : {}),
    },events:[
      event(3,'business','search-page-projection',projection),
      event(11,'business','search-page-action',{...scope,action:'panel-open',panel}),
      ...(retry ? [
        event(22,'business','search-page-action',{...scope,action:'retry'}),
        event(23,'business','search-page-projection',{...projection,publicationRevision:13,
          operationGeneration:returnGeneration,operation:'partial'}),
      ] : []),
      event(27,'business','search-page-action',{...scope,operationGeneration:returnGeneration,action:'panel-dismiss',panel}),
    ]};
  }
  function run(context, panel = 'filter', retry = false, sheetHost) {
    return evaluateSearch({kind:'phase-panel',expected:{panel,nativeReturn:true,...(sheetHost ? {sheetHost} : {})},
      ...(retry ? {retryAction:'retry'} : {}),
      baseline:'results-a',action:'open-panel',returnAction:'panel-back',sample:'panel-closed',
      acceptedSources:CASE_SOURCES},context);
  }
  const late = fixture();
  late.events[1].eventSeq = 17;
  assert.equal(run(late).verdict,'FAIL','a late opening between the click and native sample cannot be borrowed');
  const wrongSheet = fixture();
  wrongSheet.samples['panel-open'] = nativeSample('panel-open',20,21,true,{wrongSheet:true});
  assert.equal(run(wrongSheet).verdict,'FAIL','the Back source shows a different native sheet');
  const normal = run(fixture());
  assert.equal(normal.verdict,'PASS', normal.reason ?? 'the native sheet may consume Back without an app Back event');
  assert.equal(run(fixture('task',true),'task',true).verdict,'PASS','one Task retry may advance work while the panel stays open');
  assert.equal(run(fixture('task',true),'task').verdict,'FAIL','an unadmitted work transition is not the ordinary panel return');
  const host = 'reader-bottom-sheet';
  assert.equal(run(fixture('task',true,host),'task',true,host).verdict,'PASS');
  assert.equal(run(fixture(),'filter',false,host).verdict,'FAIL','a historical SheetPage cannot satisfy the new host contract');
  const wrongRoot = fixture('filter',false,host);
  wrongRoot.samples['panel-open'] = nativeSample('panel-open',20,21,true,{sheetHost:host,wrongRoot:true});
  assert.equal(run(wrongRoot,'filter',false,host).verdict,'FAIL','the expected title must be inside the expected frame ID');
  const stillCovered = fixture('filter',false,host);
  stillCovered.samples['panel-closed'] = nativeSample('panel-closed',31,34,true,{sheetHost:host});
  assert.equal(run(stillCovered,'filter',false,host).verdict,'FAIL','a lingering frame cannot satisfy the restored endpoint');
  const duplicate = fixture();
  duplicate.events.splice(2,0,event(12,'business','search-page-action',{...scope,action:'panel-open',panel:'filter'}));
  assert.equal(run(duplicate).verdict,'FAIL');
  const wrongOwner = fixture();
  change(wrongOwner,27,{owner:8});
  assert.equal(run(wrongOwner).verdict,'FAIL');
  const crossed = fixture();
  crossed.events.splice(2,0,event(19,'business','search-page-projection',{...projection,owner:8}),
    event(20,'business','search-page-projection',projection));
  assert.equal(run(crossed).verdict,'FAIL','a later matching snapshot cannot hide a crossed owner publication');
  const retainedWrongBook = fixture();
  retainedWrongBook.samples['panel-closed'] = nativeSample('panel-closed',31,34,false,{row:'other'});
  assert.equal(run(retainedWrongBook).verdict,'FAIL');
  const unknown = fixture();
  unknown.samples['panel-open'] = nativeSample('panel-open',20,21,false);
  assert.equal(run(unknown).verdict,'NOT_RUN');
  const timedOut = fixture();
  delete timedOut.samples['panel-closed'];
  assert.equal(run(timedOut).verdict,'NOT_RUN','a genuine Back still needs its native result endpoint');
  timedOut.events.push(event(28,'business','search-route-released',{...scope,route:'bookshelf'}));
  const leftSearch = run(timedOut);
  assert.equal(leftSearch.verdict,'FAIL','a verified wrong route is not erased by a missing native result endpoint');
  assert.equal(leftSearch.observationsComplete,false);
});

test('Phase 1 search separates native IME Back from a premature search route exit', () => {
  const assertion = { kind: 'phase-back', action: 'back-ime', baseline: 'ime-ready', sample: 'ime-hidden',
    acceptedSources: CASE_SOURCES, expected: { consumer: 'keyboard', requireSameNativeEditor: true } };
  const fixture = () => {
    const context = capture();
    change(context, 5, { mode: 'input' });
    context.actions['back-ime'] = { ...action('keyEvent', undefined, 8, 12, 10, 13), key: 'Back' };
    const earlier = context.samples['ime-ready'];
    const rect = { left: 32, top: 64, width: 200, height: 48 };
    earlier.nodes.forEach(item => Object.assign(item, {opacity:1,visibleRectPx:rect}));
    Object.assign(earlier.nodes[2], {type:'TextInput',key:'31'});
    const later = sample('ime-hidden', 13, 14, 14, 17, false, structuredClone(earlier.nodes));
    later.nodes.push({...node('reader-library-search-back','0/0/1','0/0'),opacity:1,visibleRectPx:rect});
    Object.assign(later.nodes[2], {focused:false,visibleRectPx:{...rect,top:68}});
    for (const capture of [earlier,later]) {
      capture.captureComplete = true;
      capture.window.id = '72';
    }
    context.samples['ime-hidden'] = later;
    return context;
  };
  const results = (update = () => {}) => {
    const context = fixture();
    update(context, context.samples['ime-hidden']);
    return evaluateSearch(assertion, context);
  };
  const consume = (context, facts) => context.events.splice(4, 0, event(11, 'business', 'search-back-consumed', {
    ...SEARCH, owner:3, queryRevision:6, consumer:'keyboard', route:'search', mode:'input', ...facts,
  }));
  const native = results();
  assert.equal(native.verdict,'PASS','the actual editor may blur and reflow as the IME hides');
  assert.equal(native.actual.consumer,'native-ime');
  const retireBefore = (context, facts) =>
    context.events.splice(2,0,event(7,'input','search-editor-unmounted',facts));
  assert.equal(results(context => retireBefore(context,{...ACTIVE_EDITOR, owner:2, editorId:'[1,2,1,2]'})).verdict,'PASS',
    'an older native editor can retire after the current one focused');
  assert.equal(results(context => retireBefore(context,ACTIVE_EDITOR)).verdict,'NOT_RUN');
  assert.equal(results((_context,later) => { later.nodes[2].key = '32'; }).verdict,'FAIL',
    'reusing the same declarative ID does not preserve the native editor');
  assert.equal(results((_context,later) => { later.window.id = '73'; }).verdict,'FAIL');
  assert.equal(results((_context,later) => { later.nodes[2].enabled = false; }).verdict,'FAIL');
  assert.equal(results((_context,later) => { later.nodes[1].opacity = 0; }).verdict,'FAIL');
  assert.equal(results((_context,later) => { later.nodes.splice(2,1); }).verdict,'FAIL');
  assert.equal(results((_context,later) => { later.nodes[2].key = null; }).verdict,'NOT_RUN');
  assert.equal(results((_context,later) => { delete later.window.id; }).verdict,'NOT_RUN');
  assert.equal(results((_context,later) => { later.captureComplete = false; }).verdict,'NOT_RUN');
  assert.equal(results(context => consume(context,{})).verdict,'PASS');
  assert.equal(results(context => consume(context,{owner:undefined})).verdict,'NOT_RUN');
  for (const wrong of [{consumer:'route'},{owner:9},{navigation:1},{mode:'results'},{route:'bookshelf'}]) {
    const verdict = results(context => {
      consume(context,wrong);
      delete context.samples['ime-hidden'];
    });
    assert.equal(verdict.verdict,'FAIL','a confirmed wrong consumer survives a missing native endpoint');
    assert.equal(verdict.observationsComplete,false);
  }
  const retired = results(context => {
    context.events.splice(4,0,event(11,'input','search-editor-unmounted',ACTIVE_EDITOR));
    delete context.samples['ime-hidden'];
  });
  assert.equal(retired.verdict,'FAIL');
  assert.equal(retired.observationsComplete,false);
});

test('Phase 1 search only credits a late A response after an audited discard within query B', () => {
  const context = phase1Capture();
  const assertion = { kind: 'phase-obsolete', action: 'submit-b', priorAction: 'submit-a', sample: 'results-b',
    acceptedSources: CASE_SOURCES, expected: { discarded: true } };
  assert.equal(evaluateSearch(assertion, context).verdict, 'NOT_RUN');
  context.events.push(event(34, 'business', 'search-obsolete-work-discarded', {
    generation: 21, session: 2, currentGeneration: 22, currentSession: 2, queryRevision: 8,
  }));
  assert.equal(evaluateSearch(assertion, context).verdict, 'NOT_RUN');
  context.samples['results-b'].captureComplete = true;
  context.events.sort((a,b) => a.eventSeq - b.eventSeq);
  assert.equal(evaluateSearch(assertion, context).verdict, 'PASS');
  change(context, 37, { operationGeneration: 21 });
  assert.equal(evaluateSearch(assertion, context).verdict, 'FAIL');
});

test('Phase 1 search late A result evidence distinguishes received books from an ordinary worker end', () => {
  const contract = loadCase('bookshelf.search-edit-resubmit-back');
  const check = contract.assertions.find(assertion => assertion.kind === 'phase-obsolete');
  assert.equal(check.expected.requireResultBatch,true);
  const assertion = {...check,acceptedSources:check.sources};
  const context = phase1Capture();
  context.samples['results-b'].captureComplete = true;
  const discarded = event(34,'business','search-obsolete-work-discarded',{
    generation:21,session:2,currentGeneration:22,currentSession:2,queryRevision:8,
  });
  context.events.splice(context.events.findIndex(item=>item.eventSeq === 37),0,discarded);
  const run = completion => {
    discarded.payload.completion = completion;
    const result = evaluateSearch(assertion,context);
    return [result.verdict,conditionApplicability(assertion,context,result,contract).status];
  };
  assert.deepEqual(run('other'),['NOT_RUN','DOES_NOT_APPLY']);
  assert.deepEqual(run(undefined),['NOT_RUN','UNKNOWN']);
  assert.deepEqual(run('unverified'),['NOT_RUN','UNKNOWN']);
  assert.deepEqual(run('received-results'),['PASS','APPLIES']);
  assert.deepEqual(run('decoded-results'),['PASS','APPLIES']);
  change(context,37,{operationGeneration:21});
  assert.deepEqual(run('other'),['FAIL','APPLIES'],'a witnessed stale publication still fails without a classified return');
});

test('Phase 1 search late A condition starts at B acceptance and detects an earlier stale publication', () => {
  const contract = loadCase('bookshelf.search-edit-resubmit-back');
  const check = contract.assertions.find(assertion => assertion.kind === 'phase-obsolete');
  const assertion = {...check,acceptedSources:check.sources};
  const discard = {generation:21,session:2,currentGeneration:22,currentSession:2,queryRevision:8,completion:'decoded-results'};
  const context = phase1Capture();
  context.samples['results-b'].captureComplete = true;
  const evaluate = () => {
    context.events.sort((a,b) => a.eventSeq - b.eventSeq);
    const result = evaluateSearch(assertion,context);
    const condition = conditionApplicability(assertion,context,result,contract);
    return [result.verdict,condition.status];
  };
  const beforeAccept = event(26,'business','search-obsolete-work-discarded',discard);
  context.events.push(beforeAccept);
  assert.deepEqual(evaluate(), ['NOT_RUN','DOES_NOT_APPLY']);
  context.events = context.events.filter(item => item !== beforeAccept);
  context.problems = ['The capture missed one sequence range'];
  assert.deepEqual(evaluate(), ['NOT_RUN','UNKNOWN']);
  delete context.problems;
  context.events.push(event(34,'business','search-obsolete-work-discarded',discard));
  assert.deepEqual(evaluate(), ['PASS','APPLIES']);
  context.events.push(event(33,'business','search-page-projection',{
    queryRevision:7,owner:4,page:2,operationGeneration:21,
  }));
  assert.deepEqual(evaluate(), ['FAIL','APPLIES']);
  context.events = context.events.filter(item => item.kind !== 'search-obsolete-work-discarded');
  assert.deepEqual(evaluate(), ['FAIL','APPLIES']);
  context.events = context.events.filter(item => item.eventSeq !== 33);
  context.events.push(
    event(35,'business','search-page-action',{action:'stop',queryRevision:8,owner:5,page:3,operationGeneration:22}),
    event(38,'business','search-obsolete-work-discarded',{...discard,currentGeneration:23}),
  );
  change(context,37,{operation:'cancelled',stopped:true,searchActive:false});
  assert.deepEqual(evaluate(), ['PASS','APPLIES']);
  change(context,37,{operationGeneration:23});
  assert.deepEqual(evaluate(), ['PASS','APPLIES']);
  change(context,35,{owner:4});
  assert.deepEqual(evaluate(), ['FAIL','APPLIES']);
  context.events.push(event(28,'business','search-submit-accepted',{...SEARCH,queryRevision:9}));
  assert.deepEqual(evaluate(), ['NOT_RUN','UNKNOWN']);

  const timedOut = phase1Capture();
  delete timedOut.samples['results-b'];
  timedOut.problems = ['results-b: native capture did not complete'];
  const assessPartial = () => {
    const result = evaluateSearch(assertion,timedOut);
    const condition = conditionApplicability(assertion,timedOut,result,contract);
    return [result.verdict,condition.status,result.observationsComplete];
  };
  assert.deepEqual(assessPartial(), ['NOT_RUN','UNKNOWN',undefined]);
  timedOut.events.push(event(38,'business','search-page-projection',{
    queryRevision:7,owner:4,page:2,operationGeneration:21,
  }));
  assert.deepEqual(assessPartial(), ['FAIL','APPLIES',false]);
  timedOut.events.splice(timedOut.events.length - 1,0,
    event(36,'business','search-route-released',{route:'bookshelf'}));
  assert.deepEqual(assessPartial(), ['NOT_RUN','UNKNOWN',undefined]);
});

test('Phase 1 search credits only a uniquely accepted Stop for the right query retaining its public row', () => {
  const context = phase1Capture();
  const viewport = 'reader-search-result-list:3:8';
  const alias = 'reader-search-public-local-result-b';
  const readyNodes = [{...node(SUBMIT,'0/2','0'),searchSemantic:'stop'},
    node(viewport,'0/0','0'),{...node(null,'0/0/0','0/0'),alias}];
  const prior = context.events.find(item => item.kind === 'search-page-projection').payload;
  Object.assign(prior,{projection:'results',operation:'partial',searchActive:true,resultCount:3});
  context.actions['stop-b'] = {...action('click',SUBMIT,40,45,43,46),from:'running-b'};
  context.samples['running-b'] = sample('running-b',37,39,40,42,false,readyNodes);
  context.samples['results-b'] = sample('results-b',52,54,47,49,false,readyNodes);
  context.events.push(
    event(41,'input','search-stop-intent',{...SEARCH,navigation:4,owner:5,editorId:'[1,4,1,5]',semantic:'stop',enabled:true}),
    event(42,'business','search-page-action',{action:'stop',owner:5,page:3,queryRevision:8,operationGeneration:22,resultCount:3}),
    event(48,'business','search-page-projection',{...prior,operation:'cancelled',stopped:true,searchActive:false,resultCount:4}),
  );
  const expected = {action:'stop',publicResult:'b'};
  const rule = {kind:'phase-operation',action:'stop-b',priorAction:'submit-b',sample:'results-b',expected,acceptedSources:CASE_SOURCES};
  const accepted = evaluateSearch(rule,context);
  assert.equal(accepted.verdict,'PASS',accepted.reason);
  assert.deepEqual(accepted.actual.resultCounts,[3,3,4]);

  const beforeCapture = context.samples['running-b'];
  const afterCapture = context.samples['results-b'];
  const rect = {left:0,top:0,width:300,height:480};
  const publicTitle = 'Reader public Stop fixture B';
  const originalBook = 'local:opaque-stop-original';
  const otherBook = 'local:opaque-stop-replacement';
  function native(type,id,children = [],attributes = {}) {
    return {attributes:{type,id,hostWindowId:'8',bounds:'[0,0][300,480]',origBounds:'[0,0][300,480]',
      visible:'true',opacity:'1',enabled:'true',clickable:'true',...attributes},children};
  }
  const resultTree = book => ({attributes:{bounds:'[0,0][300,480]'},children:[
    native('root','',[
      native('Button',SUBMIT,[native('Text','',[],{text:'停止搜索'})]),
      native('List',viewport,[
        native('Button',`reader-search-result:${JSON.stringify([3,8,book])}`,[
          native('Text','',[],{originalText:publicTitle}),
        ]),
      ]),
    ],{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'}),
  ]});
  const normalized = book => normalizeHarmonyLayout({tree:resultTree(book),windowId:'8',instanceId:INSTANCE,
    report:{windowId:'8',vpPixels:1,metrics:{ready:true,revision:1,densityPixels:1,windowRect:rect,globalRect:rect,
      keyboardArea:{available:true,visible:false,rects:[],revision:1},keyboardInsets:{left:0,top:0,right:0,bottom:0}}},
    publicBookTitle:'Reader public Stop fixture A',publicBookTitles:{b:publicTitle}});
  const setResult = (id, original, book) => {
    const observation = normalized(book);
    context.samples[id] = {...original,nodes:observation.nodes,captureComplete:true};
    return observation.nodes.find(item => item.alias === alias);
  };
  const beforeBook = setResult('running-b',beforeCapture,originalBook);
  setResult('results-b',afterCapture,otherBook);
  const strict = {...rule,expected:{...expected,requireSamePublicBook:true}};
  assert.equal(evaluateSearch(rule,context).verdict,'PASS','the old rule recognized a matching title only');
  assert.equal(evaluateSearch(strict,context).verdict,'FAIL','a same-title replacement must fail');
  setResult('results-b',afterCapture,originalBook);
  const verified = evaluateSearch(strict,context);
  assert.equal(verified.verdict,'PASS',verified.reason);
  assert.equal(verified.actual.publicResultContinuity.sameBook,true);
  assert.ok(!JSON.stringify(verified).includes(originalBook));
  const submit = context.events.findLast(item => item.kind === 'search-submit-accepted');
  const guard = {acceptedSeq:submit.eventSeq,checkpoint:{eventSeq:40,instanceId:INSTANCE},
    pillPath:'0/0',publicResultId:alias,publicResultPath:beforeBook.path,viewportPath:'0/1',
    publicResultNode:beforeBook,projection:prior};
  context.actions['stop-b'].stopLocator = guard;
  delete context.samples['running-b'];
  assert.equal(evaluateSearch(strict,context).verdict,'PASS','the tree-only locator has the same private identity');
  setResult('results-b',afterCapture,otherBook);
  assert.equal(evaluateSearch(strict,context).verdict,'FAIL');
  delete guard.publicResultNode;
  assert.equal(evaluateSearch(strict,context).verdict,'NOT_RUN','a locator label cannot substitute for missing identity');
  delete context.actions['stop-b'].stopLocator;
  context.samples['running-b'] = beforeCapture;
  context.samples['results-b'] = afterCapture;

  change(context,48,{queryRevision:7});
  assert.equal(evaluateSearch(rule,context).verdict,'FAIL');
  change(context,48,{queryRevision:8,operationGeneration:99});
  assert.equal(evaluateSearch(rule,context).verdict,'FAIL');
  context.events.push(event(44,'business','search-page-action',{action:'stop'}));
  assert.match(evaluateSearch(rule,context).reason,/more than once/u);
});

test('Phase 1 search Back accepts the actual returned public book anchor and verifies owner release', () => {
  const context = capture();
  const route = {...SEARCH,navigation:3,owner:4,queryRevision:7,mode:'results',route:'search'};
  const title = 'Authorized public book';
  const shelfNodes = [node(BAR,'0/0','0'),node(ENTRY,'0/0/0','0/0'),
    {...node(null,'0/1','0'),localBookAction:true},
    {...node(null,'0/1/0','0/1'),fixtureTitle:true}];
  context.actions['back-to-shelf'] = {...action('keyEvent',undefined,24,27,24,27),key:'Back'};
  context.samples['bookshelf-again'] = {...sample('bookshelf-again',31,33,31,33,false,shelfNodes),publicBookTitle:title};
  context.events.push(
    event(25,'business','search-back-consumed',{...route,consumer:'route'}),
    event(28,'business','search-route-released',{...route,navigation:4,previousNavigation:3,previousOwner:4,
      route:'bookshelf',mode:'idle',writeLease:{generation:3,session:1,active:false}}),
    event(29,'business','search-page-owner-released',{owner:4,page:2,queryRevision:7,released:true}),
  );
  const rule = {kind:'phase-back',action:'back-to-shelf',baseline:'results-settled',sample:'bookshelf-again',acceptedSources:CASE_SOURCES,
    expected:{consumer:'route',previousMode:'results',publicBook:true}};
  const verified = evaluateSearch(rule,context);
  assert.equal(verified.verdict,'PASS',verified.reason);
  assert.equal(verified.actual.bookshelfAnchorPath,'0/1');
  assert.equal(verified.actual.releaseSeq,29);
  context.samples['bookshelf-again'].nodes = shelfNodes.slice(0,2);
  assert.match(evaluateSearch(rule,context).reason,/public fixture is missing/u);
});

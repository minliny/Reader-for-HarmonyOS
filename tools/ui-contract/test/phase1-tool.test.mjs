import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertCompatibleRuns, groupCoverage } from '../coverage.mjs';
import { loadCase, searchSubmissionSource } from '../lib/cases.mjs';
import { validate } from '../lib/evidence.mjs';
import { actionArgs, activeStopLocatorState, assertCurrentActionState, assertInstalled, followsSemanticSequence, matchesPredicates, requestedOperation } from '../collectors/harmonyos/records.mjs';
import { assertLiveCollectionTarget, fixtureAdmission, loadCandidate } from '../collectors/harmonyos/run.mjs';
import { pngSize, sha256 } from '../../lib/native-ui-evidence.mjs';

test('Phase 1 selects the exact public role and journals input length', () => {
  const contract = loadCase('bookshelf.search-edit-resubmit-back');
  const editor = {id:'reader-book-search-input', focused:true, enabled:true, visible:true,
    opacity:1, visibleRectPx:{left:100,top:50,width:180,height:60}};
  const sample = {nodes:[editor], window:{keyboard:{visible:true}}};
  const actions = contract.steps.filter(step => step.op === 'inputText');
  assert.equal(actions.length, 2);
  const args = actions.map(step => actionArgs(requestedOperation(step, {[step.from]:sample}, contract.fixture)));
  const lengths = actions.map(step => contract.fixture.inputs[step.inputRole].length);
  assert.notEqual(lengths[0], lengths[1]);
  assert.deepEqual(args.map(values => values.slice(4)), lengths.map(length => ['190','80',`[length:${length}]`]));
});

test('Phase 1 search permits only bounded source-backed result polling', () => {
  const contract = loadCase('bookshelf.search-edit-resubmit-back');
  const extended = contract.steps.filter(step => step.stateWaitMs);
  assert.deepEqual(extended.map(step => [step.id,step.quietMs,step.stateWaitMs]),
    [['running-a',1000,45000],['results-a',3000,30000],['running-b',1000,45000],['results-b',3000,30000]]);
  for (const step of extended) {
    assert.ok(contract.ownerSources.includes(step.stateWaitSource.split('#')[0]));
  }
  extended[0].stateWaitMs = 120001;
  assert.throws(() => validate('case', contract), /Malformed case/);
});

test('Phase 1 search dispatches Stop only from the actual native Stop pill', () => {
  const contract = loadCase('bookshelf.search-edit-resubmit-back');
  const step = contract.steps.find(step => step.id === 'stop-a');
  const button = {id:step.target, enabled:true, visible:true, opacity:1, clickable:true,
    visibleRectPx:{left:100,top:50,width:180,height:60},searchSemantic:'stop'};
  assert.deepEqual(actionArgs(requestedOperation(step, {[step.from]:{nodes:[button]}},contract.fixture)),
    ['shell','uitest','uiInput','click','190','80']);
  assert.throws(() => requestedOperation(step, {[step.from]:{nodes:[{...button,searchSemantic:'search'}]}},contract.fixture),
    /no enabled stop semantics/);
});

test('Phase 1 search dispatches soft IME Search only from the current verified key sample', () => {
  const contract = loadCase('bookshelf.search-ime-submit');
  const step = contract.steps.find(item => item.op === 'tapImeSearch');
  const state = contract.steps.find(item => item.id === step.from);
  assert.equal(searchSubmissionSource(step), 'ime');
  assert.equal(state.kind, 'sample');
  assert.equal(state.focus, 'reader-book-search-input');
  const mark = {kind:'window-stable', instanceId:'app', windowRevision:3, semanticSeq:12, eventSeq:14, deviceMonoMs:500,
    payload:{windowId:'vm',orientation:'portrait',report:{metrics:{revision:3,keyboardArea:{visible:true}}}}};
  const target = {instanceId:'app', window:{id:'vm',revision:3}, semanticSeq:12, afterSeq:14};
  assert.throws(() => assertCurrentActionState(step,target,mark), /screenshot is stale/);
  assert.throws(() => requestedOperation(step,{[step.from]:target},contract.fixture), /no verified same-sample key/);
  const sample = {...target,imeSearchKey:{x:1169,y:2580},imeSearchCheckpoint:mark};
  assertCurrentActionState(step, sample, mark);
  assert.deepEqual(actionArgs(requestedOperation(step,{[step.from]:sample},contract.fixture)),
    ['shell','uitest','uiInput','click','1169','2580']);
  assert.throws(() => assertCurrentActionState(step,sample,{...mark,deviceMonoMs:3001}), /screenshot is stale/);
  assert.throws(() => assertCurrentActionState(step,sample,{...mark,semanticSeq:13}), /native target is stale/);
});

test('Phase 1 search action-only Stop locator tolerates same active viewport telemetry and refuses stale scope', () => {
  const fixture = {instanceId:'app', windowRevision:3};
  const event = (eventSeq,kind,payload,channel='business',semanticSeq=eventSeq) =>
    ({...fixture, eventSeq, kind, payload, channel, semanticSeq, deviceMonoMs:eventSeq*100});
  const report = {revision:3,keyboardArea:{available:true,visible:false}};
  const windowEvent = (seq,semantic,metrics=report) =>
    event(seq,'window-stable',{windowId:'vm',orientation:'portrait',report:{metrics}},'probe',semantic);
  const route = {identity:1,navigation:3,mounting:2,queryRevision:5};
  const owner = {queryRevision:5,owner:6,page:7,viewportId:'reader-search-result-list:7:5'};
  const submitted = event(2,'search-submit-accepted',{...route,previousOwner:5,previousNavigation:2,
    writeLease:{generation:8,session:4,active:true}});
  const settled = event(3,'search-surface-settled',{...route,owner:6,mode:'results'});
  const projection = {...owner,projection:'results',operation:'partial',operationGeneration:8,resultCount:25,visibleCount:4,
    publicationRevision:9,searchActive:true,stopped:false,incompleteCount:0,failedCount:0,skippedCount:0,historyCount:1,
    localFailed:false,sourceListFailed:false,moreSources:true};
  const anchor = {...owner,action:'anchor-restored',anchorIndex:0,anchorOffset:-12,anchorItemY:0,
    anchorAtStart:true,anchorMatchesRestore:false};
  const before = windowEvent(6,5), after = windowEvent(12,11);
  const current = {...projection,publicationRevision:10,resultCount:40,visibleCount:6};
  const phase = event(7,'search-page-projection',current);
  const attemptScope = {trigger:'initial',generation:8,session:4,sourceCount:4,sourceOrdinal:0,requestedPage:1,queryRevision:5};
  const started = event(8,'search-online-attempt',{...attemptScope,stage:'started'});
  const finished = event(9,'search-online-attempt',{...attemptScope,stage:'settled',outcome:'failed',httpStatus:404});
  const legacy = event(10,'search-result-projection',{...owner,state:'results',publicationRevision:10,searchActive:true});
  const retained = event(11,'search-page-anchor',anchor);
  const prefix = [submitted,settled,event(4,'search-page-projection',projection),event(5,'search-page-anchor',anchor),before];
  const submit = {op:'click',targetId:'reader-bookshelf-search-submit',beforeSeq:0,afterSeq:2};
  const intent = source => event(1,`search-${source}-intent`,{...route,navigation:2,owner:5,semantic:'search',enabled:true},'input');
  const advance = (...entries) => activeStopLocatorState([intent('button'),...prefix,...entries,after],submit,before,after);
  const stopLocator = advance(phase,started,finished,legacy,retained);
  assert.equal(stopLocator.projection.resultCount,40);
  const rejectAttempt = patch => assert.throws(() => advance(phase,
    {...started,payload:{...started.payload,...patch}},finished,legacy,retained),/outside the current operation scope/);
  rejectAttempt({queryRevision:4});
  rejectAttempt({generation:9});
  rejectAttempt({session:5});
  rejectAttempt({trigger:'retry'});
  rejectAttempt({requestedPage:2});
  rejectAttempt({stage:'admitted'});
  assert.throws(() => advance(phase,{...started,channel:'input'},finished,legacy,retained),/outside the current operation scope/);
  assert.throws(() => advance({...phase,payload:{...current,operationGeneration:9}},started,finished,legacy,retained),/different search owner/);
  assert.throws(() => advance(phase,started,finished,{...legacy,payload:{...legacy.payload,publicationRevision:9}},retained),/stale or mismatched/);
  assert.throws(() => advance(phase,started,finished,legacy,{...retained,payload:{...anchor,anchorOffset:-11}}),/anchor moved/);
  assert.throws(() => advance(phase,started,finished,retained),/ordered owner evidence/);
  const action = {id:'stop-a',op:'click',target:submit.targetId,buttonSemantic:'stop'};
  const step = assertCurrentActionState(action,{stopLocator},windowEvent(13,11),[windowEvent(13,11)]);
  assert.equal(step.projection.queryRevision,5);
  const routeExit = event(13,'search-route-released',route);
  assert.throws(() => assertCurrentActionState(action,{stopLocator},windowEvent(14,13),[routeExit,windowEvent(14,13)]),/Unexpected search-route-released/);
  const ime = windowEvent(13,11,{...report,keyboardArea:{available:true,visible:true}});
  assert.throws(() => assertCurrentActionState(action,{stopLocator},ime,[ime]),/window, keyboard/);
  assert.throws(() => assertCurrentActionState({...action,buttonSemantic:'search'},{stopLocator},after,[]),/incompatible Stop locator/);
  for (const [source,action] of [
    ['ime',{...submit,op:'keyEvent',key:'Enter',targetId:undefined}],
    ['history',{...submit,targetId:'reader-search-history-public-item-0'}],
  ]) {
    const collect = origin => activeStopLocatorState([intent(origin),...prefix,phase,started,finished,legacy,retained,after],action,before,after);
    assert.equal(collect(source).projection.queryRevision,5);
    assert.throws(() => collect('button'),/no uniquely accepted active submit/);
  }
});

test('Phase 1 matches owner predicates within the selected event list', () => {
  const need = [{kind:'projected', fields:{'payload.owner.revision':7, 'payload.active':false}}];
  const events = [
    {kind:'projected', payload:{owner:{revision:6}, active:false}},
    {kind:'projected', payload:{owner:{revision:7}, active:true}},
  ];
  assert.equal(matchesPredicates(events, need), false);
  assert.equal(matchesPredicates([...events, {kind:'settled', payload:{owner:{revision:7}, active:false}}], need), false);
  assert.equal(matchesPredicates([...events, {kind:'projected', payload:{owner:{revision:7}, active:false}}], need), true);
});

test('Phase 1 state predicate rejects superseded owner state while occurrence remains observable', () => {
  const old = {kind:'projection', channel:'business', payload:{mode:'results'}, eventSeq:21};
  const current = {kind:'projection', channel:'business', payload:{mode:'loading'}, eventSeq:22};
  const unrelated = {kind:'projection', channel:'probe', payload:{mode:'results'}, eventSeq:23};
  const predicate = {kind:'projection', channel:'business', fields:{'payload.mode':'results'}};
  assert.equal(matchesPredicates([old, current, unrelated], [predicate]), true);
  assert.equal(matchesPredicates([old, current, unrelated], [{...predicate, match:'latest'}]), false);
  assert.equal(matchesPredicates([old, unrelated], [{...predicate, match:'latest'}]), true);
});

test('Phase 1 quiet heartbeat must account for the latest semantic event', () => {
  const prior = {kind:'window-stable', eventSeq:11, semanticSeq:10, deviceMonoMs:100};
  const projection = {kind:'projection', eventSeq:12, semanticSeq:12, deviceMonoMs:200};
  const tail = {kind:'window-stable', eventSeq:13, semanticSeq:12, deviceMonoMs:1900};
  assert.equal(followsSemanticSequence(prior, [projection, tail]), true);
  assert.equal(followsSemanticSequence(prior, [projection, {...tail, semanticSeq:10}]), false);
  assert.equal(followsSemanticSequence(prior, [projection, {...tail, deviceMonoMs:150}]), false);
});

test('Phase 1 ties both swipe endpoints to the measured native window', () => {
  const node = (id, visibleRectPx) => ({id, visibleRectPx, visible:true, enabled:true, opacity:1});
  const sample = {nodes:[
    node('handle', {left:150,top:110,width:50,height:20}),
    node('stage', {left:20,top:20,width:300,height:400}),
  ]};
  const step = {id:'drag-panel', op:'drag', from:'quick', target:'handle',
    path:{from:[.5,.5],to:[.5,.15],endTarget:'stage',speed:600}};
  assert.deepEqual(actionArgs(requestedOperation(step, {quick:sample}, {})),
    ['shell','uitest','uiInput','drag','175','120','170','80','600']);
  assert.throws(() => requestedOperation(step, {quick:{nodes:[sample.nodes[0]]}}, {}), /stage is missing/);
});

function run(id, options = {}) {
  const caseId = 'source-management.layout-filter';
  const identity = {appBuildId:'candidate', hapSha256:'a'.repeat(64), hdcServer:'127.0.0.1:8710',
    targetRef:'0123456789ab', targetKind:'vm', ...options.identity};
  const entry = {widthPx:1200, heightPx:2800, density:3, orientation:'portrait', fontScale:1, ...options.entry};
  return {rootSha256:id.repeat(64), receipt:{runId:id, caseId, candidate:{identity}, coverage:{[caseId]:{}},
    observations:'COMPLETE', execution:'PASS', measurement:{deviceLeaseMs:10, commandJournalSha256:sha256(id),
      initialWindowSampleId:'entry', sampleWindowOrder:['entry'], sampleWindows:{entry}}}};
}

test('Phase 1 coverage rejects different candidates, targets, and layout configurations', () => {
  const original = run('a').receipt;
  assert.equal(assertCompatibleRuns([original, run('b').receipt]).fontScale, 1);
  assert.throws(() => assertCompatibleRuns([original, run('b', {identity:{hapSha256:'b'.repeat(64)}}).receipt]),
    /same candidate/);
  assert.throws(() => assertCompatibleRuns([original, run('b', {identity:{targetRef:'1123456789ab'}}).receipt]),
    /same HDC server and target/);
  assert.throws(() => assertCompatibleRuns([original, run('b', {entry:{fontScale:1.3}}).receipt]),
    /window configurations/);
});

test('Phase 1 coverage rejects a repeated sealed run across groups', () => {
  const one = run('a');
  const two = run('b');
  const result = groupCoverage([{id:'first', runs:[one,two]}], value => value);
  assert.deepEqual(result[0].cases.map(item => item.runId), ['a','b']);
  assert.throws(() => groupCoverage([{id:'first', runs:[one]}, {id:'second', runs:[one]}], value => value),
    /reuse the same sealed run/);
  two.receipt.measurement.commandJournalSha256 = one.receipt.measurement.commandJournalSha256;
  assert.throws(() => groupCoverage([{id:'first', runs:[one,two]}], value => value), /underlying command journal/);
});

test('Phase 1 coverage uses the planned first window and records layout changes or missing configuration', () => {
  const one = run('a'), two = run('b'), three = run('c');
  const measurement = one.receipt.measurement;
  const entry = measurement.sampleWindows.entry;
  measurement.sampleWindows = {alphabeticallyFirst:{...entry, orientation:'landscape', widthPx:2800, heightPx:1200}, entry};
  measurement.sampleWindowOrder.push('alphabeticallyFirst');
  three.receipt.measurement.sampleWindows = {later:entry};
  const [group] = groupCoverage([{id:'verified', runs:[one,two]}], value => value);
  assert.equal(group.window.orientation, 'portrait');
  assert.equal(group.initialWindowStatus, 'VERIFIED');
  assert.equal(group.inSessionWindowChanges[0].changes[0].to.orientation, 'landscape');
  const [incomplete] = groupCoverage([{id:'diagnostic', runs:[one,three]}], value => value);
  assert.deepEqual(incomplete.missingInitialWindowRunIds, ['c']);
  assert.equal(incomplete.selectedObservationStatus, 'INCOMPLETE');
});

const appVersion = {schema:'reader-app-build-v1', versionName:'0.2.0', versionCode:1000000, channel:'DEV',
  contentId:'a'.repeat(12), appContentHash:'a'.repeat(64), appBuildId:'0.2.0.DEV.aaaaaaaaaaaa'};
const postInstall = {bundlePresent:true, bundleName:'io.reader.minliny', updateTime:123456789, cpuAbi:'arm64-v8a',
  appProvisionType:'debug', appIdSha256:'a'.repeat(64), appIdentifierSha256:'b'.repeat(64), appVersion};

test('Phase 1 installed identity requires positive fields and matches signed certificate/profile/application', () => {
  assertInstalled({installed:postInstall}, {postInstall,expectedVersion:appVersion});
  const incomplete = {bundlePresent:true,bundleName:'io.reader.minliny',appVersion};
  assert.throws(() => assertInstalled({installed:incomplete}, {postInstall:incomplete,expectedVersion:appVersion}), /complete bundle/);
  assert.throws(() => assertInstalled({installed:{...postInstall,updateTime:postInstall.updateTime+1}},
    {postInstall,expectedVersion:appVersion}), /changed after deployment/);
  const artifact = {kind:'signed',sha256:'c'.repeat(64),signature:{verified:true,status:'signed',profileType:'debug',
    certificateSha256:'3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4',
    appIdSha256:postInstall.appIdSha256,appIdentifierSha256:postInstall.appIdentifierSha256}};
  const manifest = {schemaVersion:2,expectedVersion:appVersion,abi:postInstall.cpuAbi,runId:'build',artifacts:[artifact],
    source:{buildInputs:{snapshot:'source-snapshot.json',fileCount:0,fingerprint:sha256('')}}};
  const deployment = {runId:'build',postInstall,artifact,install:'PASS',launch:'PASS',appVersionCheck:'PASS',
    targetRef:'0123456789ab',targetKind:'vm',hdcServer:'127.0.0.1:8710',dataPolicy:'preserve',completedAt:'2026-11-19T00:00:00Z'};
  const originals = {manifest,deployment,snapshot:{files:[]}};
  const recipes = {manifest:'manifest',deployment:'deployment',snapshot:'snapshot',ownerSources:{}};
  const contract = {phase:1,ownerSources:[]};
  const store = {json:key => originals[key]};
  assert.equal(loadCandidate(store, recipes, contract).hapSha256, artifact.sha256);
  const originalCertificate = artifact.signature.certificateSha256;
  artifact.signature.certificateSha256 = 'e'.repeat(64);
  assert.throws(() => loadCandidate(store, recipes, contract), /different certificate/);
  artifact.signature.certificateSha256 = originalCertificate;
  artifact.signature.appIdentifierSha256 = 'e'.repeat(64);
  assert.throws(() => loadCandidate(store, recipes, contract), /application identity/);
});

test('Phase 1 fixture admission rejects extra copied private fields and nested route fields', () => {
  const contract = loadCase('bookshelf.search-edit-resubmit-back');
  const candidate = {targetRef:'0123456789ab',targetKind:'vm',hdcServer:'127.0.0.1:8710'};
  const route = {direct:true,routeObservation:'loopback',socketObservation:'connected local socket'};
  const fixture = {schema:'reader-ui-public-fixture-v1',caseId:contract.id,fixtureId:contract.fixture.id,
    targetRef:candidate.targetRef,hdcServer:candidate.hdcServer,vmName:'Public fixture VM',checkedAt:'2026-11-19T00:00:00Z',
    noPersonalData:true,developerMode:true,publicBooks:true,publicInputs:true,publicHistory:true,publicImeCandidates:true,
    publicSources:true,publicBookTitleConfirmed:true,publicBookTitlesConfirmed:true,directRoute:{clientToServer:route,serverToTarget:route}};
  assert.equal(fixtureAdmission(fixture, contract, candidate), Date.parse(fixture.checkedAt));
  assert.throws(() => fixtureAdmission({...fixture,clipboard:'synthetic disallowed field'}, contract, candidate), /outside the documented/);
  const nested = {...fixture,directRoute:{...fixture.directRoute,serverToTarget:{...route,query:'synthetic disallowed field'}}};
  assert.throws(() => fixtureAdmission(nested, contract, candidate), /outside the documented/);
});

test('Phase 1 second original recovery scope authorizes only the exact Continue edge case', () => {
  const candidate = {targetRef:'0123456789ab',targetKind:'vm',hdcServer:'127.0.0.1:8710'};
  const route = {direct:true,routeObservation:'loopback',socketObservation:'connected local socket'};
  const edge = loadCase('source-management.original-continue-touch-edge');
  const center = loadCase('source-management.original-continue-touch-center');
  const fixture = {schema:'reader-ui-public-fixture-v1',caseId:edge.id,fixtureId:edge.fixture.id,
    targetRef:candidate.targetRef,hdcServer:candidate.hdcServer,vmName:'Public fixture VM',checkedAt:'2026-11-19T00:00:00Z',
    noPersonalData:true,developerMode:true,publicBooks:true,publicHistory:true,publicImeCandidates:true,
    publicSources:true,directRoute:{clientToServer:route,serverToTarget:route},
    publicFixtureScope:'source-original-interrupted-edge'};
  assert.equal(fixtureAdmission(fixture, edge, candidate), Date.parse(fixture.checkedAt));
  assert.throws(() => fixtureAdmission({...fixture,caseId:center.id,fixtureId:center.fixture.id}, center, candidate),
    /scope is unavailable/);
  const original = {...fixture,caseId:center.id,fixtureId:center.fixture.id,publicFixtureScope:'source-original-interrupted'};
  assert.equal(fixtureAdmission(original, center, candidate), Date.parse(original.checkedAt));
});

test('Phase 1 live UI collection rejects remote VM servers', () => {
  const local = {hdcServer:'127.0.0.1:8710',targetKind:'vm'};
  assert.doesNotThrow(() => assertLiveCollectionTarget({server:local.hdcServer,deployment:local}));
  assert.throws(() => assertLiveCollectionTarget({server:'192.168.1.10:8710',
    deployment:{...local,hdcServer:'192.168.1.10:8710'}}), /remote VM collection is not permitted/);
  assert.throws(() => assertLiveCollectionTarget({server:'127.0.0.1:8710',
    deployment:{...local,hdcServer:'192.168.1.10:8710'}}), /remote VM collection is not permitted/);
});

test('Phase 1 native PNG validates complete chunk structure rather than trusting the header', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg+M/wHwAEAQH/cetH5QAAAABJRU5ErkJggg==', 'base64');
  assert.deepEqual(pngSize(png), {width:1,height:1});
  assert.throws(() => pngSize(png.subarray(0, 33)), /no complete PNG end/);
  assert.throws(() => pngSize(Buffer.concat([png, Buffer.from('unexpected bytes')])), /trailing bytes/);
  const altered = Buffer.from(png);
  altered[42] ^= 1;
  assert.throws(() => pngSize(altered), /checksum/);
});

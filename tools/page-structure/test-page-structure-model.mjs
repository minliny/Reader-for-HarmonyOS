import assert from 'node:assert/strict';
import { loadInputs, readJSON } from './lib.mjs';
import { deriveStructure } from './derive-structure.mjs';
import { validateModel } from './validate-model.mjs';
import { evaluatePage, checkRegister } from './check-register.mjs';
import { checkContractRefs } from './check-contract-refs.mjs';
import { inventoryMessageEntrypoints, compareMessageEntrypoints } from '../check-message-entrypoints.mjs';

// Explicit, bounded framework tests. This entry imports no business test suites
// and launches no child processes, compiler builds, devices or network calls.
const inputs = loadInputs(), page = inputs.register.pages[0], fixture = readJSON('tools/page-structure/fixtures/grammar.json');
const cases = [];
const test = (name, action) => { action(); cases.push(name); };
const change = (object, edits) => {
  const result = structuredClone(object);
  for (const [path, value] of edits) {
    const parts = path.split('.'), last = parts.pop();
    const target = parts.reduce((o, key) => { assert.ok(o && Object.hasOwn(o, key), `Fixture path ${path}`); return o[key]; }, result);
    assert.ok(Object.hasOwn(target, last), `Existing fixture field ${path}`); target[last] = value;
  }
  return result;
};
test('all-seven-schemas', () => assert.deepEqual(validateModel(inputs).diagnostics, []));
test('real-reference-closure', () => assert.deepEqual(checkContractRefs(inputs), []));
test('selected-message-entry-integrity', () => {
  const inventory=inventoryMessageEntrypoints({files:[page.source.path]});
  assert.ok(inventory.entries.every(e=>e.file===page.source.path));
  const requiredRetainedScopes = inputs.messages.retainedScopes
    .filter(row => row.authority === page.source.path).map(row => row.scope);
  assert.ok(requiredRetainedScopes.length, 'the retired legacy banner remains explicitly accounted for');
  assert.equal(compareMessageEntrypoints(inventory,inputs.messages,{requiredRetainedScopes}).status,'PASS');
  const missing=structuredClone(inputs.messages);missing.entries=missing.entries.filter(e=>e.id!==page.messageSurfaces[0].entryId);
  assert.equal(compareMessageEntrypoints(inventory,missing,{requiredRetainedScopes}).status,'FAIL');
  const missingRetained = structuredClone(inputs.messages);
  missingRetained.retainedScopes = missingRetained.retainedScopes.filter(row=>!requiredRetainedScopes.includes(row.scope));
  const retainedResult = compareMessageEntrypoints(inventory,missingRetained,{requiredRetainedScopes});
  assert.ok(retainedResult.failures.some(row=>row.kind==='missing-retained-scope'));
  assert.throws(()=>inventoryMessageEntrypoints({files:[]}),/nonempty/);
  assert.throws(()=>inventoryMessageEntrypoints({files:['../VERSION_POLICY.md']}),/Invalid selected/);
});
test('real-page-detects-known-gaps', () => {
  const { diagnostics } = checkRegister(inputs);
  for (const ruleId of ['E2', 'E3']) assert.ok(diagnostics.some(d => d.ruleId === ruleId && d.result === 'FAIL'),
    'current SDK evidence preserves the remaining native acceptance failures');
  assert.ok(!diagnostics.some(d => d.ruleId === 'SOURCE_DRIFT'));
});
test('six-prototype-oracles', () => {
  const b = page.brief, infer = patch => deriveStructure({ ...b, ...patch }, inputs.model);
  for (const [patch, expected] of [
    [{purpose:'read',role:'reader',content:'canvas',navigationPersistence:'none',alternateNavigation:true,queryPriority:'none'}, 'ReaderPage'],
    [{role:'root'}, 'RootTabPage'], [{purpose:'select',selectionMode:'multi'}, 'SelectionPage'],
    [{purpose:'search',queryPriority:'primary'}, 'CompoundSearchPage'],
    [{purpose:'inspect',content:'document',queryPriority:'none'}, 'SecondaryDetailPage'], [{}, 'SecondaryCollectionPage'],
  ]) assert.equal(infer(patch).prototype, expected);
  assert.equal(infer({purpose:'browse',queryPriority:'primary'}).prototype, 'SecondaryCollectionPage', 'chapter search stays a browse page');
});
test('header-branch-oracles', () => {
  const infer = patch => deriveStructure({...page.brief,...patch},inputs.model).header;
  assert.equal(infer({navigationPersistence:'required',contentImmersive:true,titleCanExit:true}), 'Fixed');
  assert.equal(infer({navigationPersistence:'optional',contentImmersive:true,titleCanExit:true}), 'ScrollAway');
  assert.equal(infer({navigationPersistence:'optional',contentImmersive:true,titleCanExit:false}), 'Floating');
  assert.equal(infer({navigationPersistence:'optional',contentImmersive:false}), 'Fixed');
  assert.equal(infer({navigationPersistence:'none',alternateNavigation:true}), 'None');
});
test('determinism-no-input-mutation', () => {
  const before = JSON.stringify(inputs.model), originalBrief = JSON.stringify(page.brief);
  for (const navigationPersistence of ['required','optional','none']) for (const contentImmersive of [false,true]) for (const titleCanExit of [false,true]) for (const queryPriority of ['none','secondary','primary','complex']) {
    const brief = {...page.brief,navigationPersistence,contentImmersive,titleCanExit,queryPriority};
    assert.deepEqual(deriveStructure(brief,inputs.model),deriveStructure(structuredClone(brief),structuredClone(inputs.model)));
  }
  assert.equal(JSON.stringify(inputs.model), before); assert.equal(JSON.stringify(page.brief), originalBrief);
  assert.throws(()=>deriveStructure({...page.brief,purpose:'form',content:'form'},inputs.model), /no supported prototype/);
  assert.throws(()=>deriveStructure({...page.brief,navigationPersistence:'UNRESOLVED'},inputs.model), /unresolved/);
  assert.throws(()=>deriveStructure({...page.brief,purpose:'select',content:'document'},inputs.model), /selection requires/);
  assert.throws(()=>deriveStructure({...page.brief,purpose:'search',queryPriority:'none'},inputs.model), /compound search requires/);
  assert.throws(()=>deriveStructure({...page.brief,purpose:'read',role:'reader',content:'canvas'},inputs.model), /reader requires/);
  assert.throws(()=>deriveStructure({...page.brief,purpose:'search',queryPriority:'primary',navigationPersistence:'optional',contentImmersive:true},inputs.model), /GRAMMAR/);
  assert.throws(()=>deriveStructure({...page.brief,purpose:'inspect',content:'document',queryPriority:'none',navigationPersistence:'optional',contentImmersive:true,titleCanExit:true},inputs.model), /GRAMMAR/);
});
test('sixteen-layers-and-facts-required', () => {
  for (const layer of inputs.model.layers) {
    const missing = structuredClone(inputs); delete missing.register.pages[0].layers[layer.id];
    // Schema fails before semantic checks; direct Ajv is used to avoid reading absent layer facts.
    assert.ok(validateModel(missing).diagnostics.some(d=>d.ruleId==='SCHEMA'), `missing layer ${layer.id}`);
    const empty = structuredClone(inputs); empty.register.pages[0].layers[layer.id].facts={};
    assert.ok(validateModel(empty).diagnostics.some(d=>d.ruleId==='SCHEMA'), `empty facts ${layer.id}`);
  }
});
const positive = change(page, fixture.positive);
test('synthetic-positive', () => assert.deepEqual(evaluatePage(positive,inputs.model), []));
test('explicit-not-applicable-layer', () => {
  const altered = structuredClone(inputs), synthetic = structuredClone(positive);
  synthetic.brief.queryPriority='none';
  synthetic.layers.query={applicability:'not_applicable',reason:'Synthetic page without query',owner:'test',facts:{},result:'NOT_RUN',evidence:[]};
  altered.register.pages=[synthetic];
  assert.deepEqual(validateModel(altered).diagnostics, []);
  assert.deepEqual(evaluatePage(synthetic,inputs.model), []);
});
for (const item of fixture.negative) test(`negative-${item.rule}`, () => {
  const diagnostics = item.target === 'inputs' ? checkContractRefs(change(inputs,item.changes)) : evaluatePage(change(positive,item.changes),inputs.model);
  assert.ok(diagnostics.some(d=>d.ruleId===item.rule && d.result==='FAIL'), `${item.rule}: ${JSON.stringify(diagnostics)}`);
});
for (const [name, mutate, expected] of [
  ['dangling-control', i=>i.register.pages[0].controlRefs.push('missing-control'),'REFERENCE'],
  ['duplicate-owner', i=>i.controls.controls.push({...i.controls.controls[0],owner:'another-owner'}),'DUPLICATE_OWNER'],
  ['missing-operation-symbol', i=>i.register.pages[0].operationRefs[0].factSource.symbol='missingSymbol','REFERENCE'],
  ['stale-registry-revision', i=>i.register.pages[0].registryRevisions.control=999,'REFERENCE'],
  ['missing-platform-host', i=>i.platform.hosts=[],'REFERENCE'],
  ['route-field-conflict', i=>i.register.pages[0].layers.route.facts.parentRoutes=['bookshelf'],'REFERENCE'],
  ['dangling-action-state-control', i=>i.register.pages[0].layers.interaction.facts.actionStates[0].controlRef='missing-control','REFERENCE'],
  ['platform-business-owner-conflict', i=>i.register.pages[0].platformHosts[0].businessOwner='WrongOwner','REFERENCE'],
  ['platform-result-policy-conflict', i=>i.register.pages[0].platformHosts[0].resultPolicy=['completed'],'REFERENCE'],
  ['retention-basis-conflict', i=>i.register.pages[0].layers.route.facts.retention.basis=i.register.pages[0].layers.route.facts.retention.basis==='observed'?'declared':'observed','REFERENCE'],
  ['removed-retained-scope', i=>{
    const retained = i.messages.retainedScopes.find(r=>r.authority===i.register.pages[0].source.path);
    assert.ok(retained);
    i.register.pages[0].retainedScopeRefs=[retained.scope];
    i.messages.retainedScopes=i.messages.retainedScopes.filter(r=>r.scope!==retained.scope);
  },'REFERENCE'],
]) test(name,()=>{const altered=structuredClone(inputs);mutate(altered);assert.ok(checkContractRefs(altered).some(d=>d.ruleId===expected));});
for (const [name, mutate] of [
  ['unknown-policy-enum', i=>i.register.pages[0].operationRefs[0].unknownPolicy='arbitrary-policy'],
  ['not-exposed-requires-partial', i=>{
    i.register.pages[0].operationRefs[1].unknownPolicy='not-exposed';
    i.register.pages[0].operationRefs[1].bindingStatus='bound';
  }],
  ['not-exposed-requires-known-gap', i=>delete i.register.pages[0].operationRefs[1].knownGap],
  ['refresh-policy-enum', i=>i.register.pages[0].operationRefs[0].refreshPolicy='replay-write'],
  ['platform-result-enum', i=>i.register.pages[0].platformHosts[0].resultPolicy=['unknown']],
  ['platform-upstream-result-enum', i=>i.platform.hosts[0].resultPolicy=['unknown']],
  ['platform-business-owner-required', i=>delete i.register.pages[0].platformHosts[0].businessOwner],
  ['retention-basis-required', i=>delete i.register.pages[0].layers.route.facts.retention.basis],
  ['retained-scope-refs-required', i=>delete i.register.pages[0].retainedScopeRefs],
  ['failure-follow-up-owner-required', i=>delete i.register.pages[0].invariants.E2.followUp.owner],
]) test(name,()=>{
  const altered=structuredClone(inputs);mutate(altered);
  assert.ok(validateModel(altered).diagnostics.some(d=>d.ruleId==='SCHEMA'));
});
test('manual-failure-cannot-be-hidden',()=>{
  const altered=structuredClone(inputs);altered.register.pages[0].invariants.E3.result='FAIL';
  assert.ok(checkRegister(altered,{bindSource:false}).diagnostics.some(d=>d.ruleId==='E3' && d.result==='FAIL'));
});
test('PASS-requires-evidence',()=>{
  const altered=structuredClone(inputs);altered.register.pages[0].invariants.B6={result:'PASS',reason:'synthetic invalid assertion',evidence:[]};
  assert.ok(validateModel(altered).diagnostics.some(d=>d.ruleId==='EVIDENCE'));
});
for (const [name, edits] of [
  ['missing-global-footer',[['layers.footer.facts.presence',false]]],
  ['scaffold-prototype-conflict',[['layers.scaffold.facts.prototype','ReaderPage']]],
  ['missing-required-region',[['layers.scaffold.facts.regions',['header','content','footer']]]],
]) test(name,()=>{const altered=structuredClone(inputs);altered.register.pages[0]=change(page,edits);assert.ok(checkRegister(altered,{bindSource:false}).diagnostics.some(d=>['DERIVE','GRAMMAR'].includes(d.ruleId)));});
for (const [id, deadline, expected] of [['B6','2099-01-01','EXCEPTION_FORBIDDEN'],['E2','2020-01-01','EXCEPTION_EXPIRED']]) test(`exception-${expected}`,()=>{
  const altered=structuredClone(inputs), record={id:'EX-TEST',pageId:page.pageId,invariantId:id,owner:'test',reason:'synthetic',compensatingControl:'synthetic current control',sinceVersion:'0.2.0',expiresAtOrReviewTrigger:deadline,evidence:[{kind:'test',path:'tools/page-structure/test-page-structure-model.mjs',result:'PASS'}]};
  altered.exceptions.exceptions.push(record);altered.register.pages[0].invariants[id].result='EXCEPTION';altered.register.pages[0].exceptions.push(record.id);
  assert.ok(validateModel(altered,{asOf:'2026-11-02'}).diagnostics.some(d=>d.ruleId===expected));
});
test('B6-and-S7-independent', () => {
  assert.equal(page.invariants.S7.result,'NOT_RUN');
  assert.ok(!/Back.*未实测|Back.*顺序/.test(page.invariants.B6.reason),'Identity result cannot be justified by Back order');
});
console.log(JSON.stringify({check:'test-page-structure-model',result:'PASS',cases, count:cases.length,boundary:'Framework inference, schema, declaration/reference integrity; no production/device acceptance.'},null,2));

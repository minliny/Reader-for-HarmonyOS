import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { normalizeContractRegistry, normalizeCatalogIdentities, normalizeResourceReviewIdentities, publishExecutionRuntime, publishHelperTransition, EXECUTION_RUNTIME_PATHS, contractView, readContractView } from './lib/contract-registry.mjs';
import { contractSelection } from './run-contract-tests.mjs';

const definitions = {
  'helper-version-transition': { description: 'Exact old/current generic helper transition preserves historical snapshots; unknown/transitive/business/test/proof changes and unqualified dispatch reject', resources: [] },
  'execution-runtime-owner': { description: 'One reviewed dispatcher identity with unchanged historical check snapshots; changed runtime/business and malformed authority still stop exact dispatch', resources: [] },
  'resource-review-identities': { description: 'One reviewed resource fingerprint, unchanged complete views and distinct historical overrides', resources: [] },
  'catalog-identities': { description: 'Lossless normalized family/case identities, shared current facts and historical overrides; actual dispatch remains exact', resources: [] },
  'review-preservation': { description: 'Preserve old SHA variants, qualifications, exact order and unpublished claims', resources: [] },
  'identity-rejection': { description: 'Reject missing/changed reviewed references and cross-case substitution', resources: [] },
  'data-only-loader': { description: 'Read canonical and legacy fixture views without importing a test or SDK', resources: [] },
  'proposal-separation': { description: 'Actual exact runner dispatch ignores missing/malformed historical proposals and never expands selection', resources: [] },
  'pending-admission': { description: 'Inventory pending files explicitly without admitting them to scopes or dispatch', resources: [] },
};
function sample() {
  const input = { path: 'tools/helper.mjs', sha256: 'a'.repeat(64) };
  return {
    catalog: { schemaVersion: 1,
      entries: [{ id: 'H-one', file: 'tools/test-one.mjs', qualification: 'NAVIGATION', definitionInputs: [input] }],
      caseEntries: [
        { id: 'H-one#ready', file: 'tools/test-one.mjs', caseId: 'ready', qualification: 'QUALIFIED', resourceNeeds: [], definitionInputs: [input] },
        { id: 'H-one#pending', file: 'tools/test-one.mjs', caseId: 'pending', qualification: 'NEEDS_EVIDENCE', resourceNeeds: ['native-build'], definitionInputs: [{ ...input, sha256: 'b'.repeat(64) }] },
        { id: 'H-one#unpublished', file: 'tools/test-one.mjs', caseId: 'unpublished', qualification: 'QUALIFIED', resourceNeeds: [], definitionInputs: [input] },
      ] },
    tiers: { schemaVersion: 1, source: ['test-one.mjs'], integration: [], scopes: { one: ['test-one.mjs'] } },
    cases: { schemaVersion: 1, files: { 'test-one.mjs': { sourceSha256: 'c'.repeat(64), cases: {
      ready: { resources: [], qualification: 'QUALIFIED' },
      pending: { resources: ['native-build'], qualification: 'NEEDS_EVIDENCE' },
    } } }, legacy: {} },
  };
}
for (const id of selectContractCases(definitions)) {
  const previous = sample(), registry = normalizeContractRegistry(previous);
  if (id === 'helper-version-transition') {
    const root = mkdtempSync(join(tmpdir(), 'reader-helper-transition-'));
    try {
      mkdirSync(join(root, 'tools/lib'), { recursive: true });
      mkdirSync(join(root, 'tools/fixtures'));
      const digest = bytes => createHash('sha256').update(bytes).digest('hex');
      const input = (path, bytes) => ({ path, sha256: digest(bytes) });
      const intern = (value, record) => { const ref = digest(JSON.stringify(record)); value.inputs[ref] = record; return ref; };
      for (const file of ['gate-index.mjs', 'run-contract-tests.mjs', 'lib/contract-registry.mjs', 'lib/contract-case-selection.mjs'])
        writeFileSync(join(root, 'tools', file), readFileSync(new URL(file, import.meta.url)));
      writeFileSync(join(root, 'tools/retired-contract-tests.json'), JSON.stringify({ schemaVersion: 1, entries: [] }));
      const helperPath = 'tools/lib/ets-pure-module-probe.mjs';
      const before = input(helperPath, 'export const value = 41;\n');
      const helperBytes = 'export const value = 41;\nexport const added = true;\n';
      const current = input(helperPath, helperBytes);
      const proofPath = 'tools/fixtures/ets-helper-transition-proof.mjs', proofBytes = '// Synthetic proof identity; this metadata case checks admission only.\n';
      const proof = input(proofPath, proofBytes);
      writeFileSync(join(root, helperPath), helperBytes); writeFileSync(join(root, proofPath), proofBytes);
      const selected = "import {writeFileSync} from 'node:fs'; import {value} from './lib/ets-pure-module-probe.mjs'; if(value !== 41) throw Error('wrong helper'); writeFileSync(new URL('../child-marker',import.meta.url), 'EXACT_HELPER_CHILD');\n";
      writeFileSync(join(root, 'tools/test-selected.mjs'), selected);
      writeFileSync(join(root, 'tools/test-other.mjs'), "throw Error('unselected child');\n");
      const old = { schemaVersion: 2, tests: { 'test-selected.mjs': { tier: 'source', catalogId: 'H-selected', legacy: { resources: [] } }, 'test-other.mjs': { tier: 'integration' } },
        tiers: { schemaVersion: 1 }, catalog: { schemaVersion: 1, reviewedDefinitionsFrozen: true, entries: [] },
        caseDefinitions: {}, catalogCases: {}, inputs: {}, inputSets: {} };
      const refs = [before, input('tools/test-selected.mjs', selected)].map(record => intern(old, record));
      const set = digest(JSON.stringify(refs)); old.inputSets[set] = refs;
      old.catalog.entries.push({ testRef: 'test-selected.mjs', qualification: 'QUALIFIED', definitionSet: set, necessityReason: 'Exact helper transition fixture' });
      const runtime = publishExecutionRuntime(old, { inputs: EXECUTION_RUNTIME_PATHS.map(path => input(path, readFileSync(join(root, path)))), reviewEvidence: 'Synthetic current dispatcher' });
      const publication = { from: before, to: current, proofInputs: [current, proof], reviewEvidence: 'Synthetic exact helper compatibility' };
      const reviewed = publishHelperTransition(runtime, publication);
      for (const [key, value] of Object.entries(runtime.inputs)) assert.deepEqual(reviewed.inputs[key], value);
      for (const [key, value] of Object.entries(runtime.inputSets)) assert.deepEqual(reviewed.inputSets[key], value);
      for (const view of ['cases', 'tiers']) assert.deepEqual(contractView(reviewed, view), contractView(runtime, view));
      const { helperTransitions, ...catalog } = contractView(reviewed, 'catalog');
      assert.deepEqual(catalog, contractView(runtime, 'catalog'), 'all old catalog facts and qualification remain unchanged');
      assert.deepEqual(helperTransitions[0].from, before);
      assert.throws(() => publishHelperTransition(reviewed, publication), /duplicate helper transition/);
      assert.throws(() => publishHelperTransition(reviewed, { ...publication, from: current, to: { ...current, sha256: 'f'.repeat(64) }, proofInputs: [{ ...current, sha256: 'f'.repeat(64) }, proof] }), /transitive/);
      assert.throws(() => publishHelperTransition(runtime, { ...publication, from: { ...before, sha256: '0'.repeat(64) } }), /existing reviewed input/);
      for (const path of ['entry/business.ts', 'tools/test-selected.mjs', 'tools/lib/reader-control-builder-probe.mjs']) {
        const foreign = structuredClone(runtime), from = { ...before, path }; intern(foreign, from);
        assert.throws(() => publishHelperTransition(foreign, { ...publication, from, to: { ...current, path } }), /same approved generic path/);
      }
      for (const proofInputs of [[current], [current, proof, proof], [current, { ...proof, path: '../outside.mjs' }],
        [current, proof, { ...current, path: 'tools/lib//ets-pure-module-probe.mjs' }],
        [current, { ...proof, path: 'tools/fixtures/./ets-helper-transition-proof.mjs' }]])
        assert.throws(() => publishHelperTransition(runtime, { ...publication, proofInputs }), /proof/);
      assert.throws(() => publishHelperTransition(runtime, { ...publication, reviewEvidence: '' }), /review evidence/);
      const missing = structuredClone(reviewed); delete missing.inputSets[Object.values(missing.helperTransitions)[0].proofSet];
      assert.throws(() => contractView(missing, 'catalog'), /missing definition set/);
      const missingPrevious = structuredClone(reviewed); delete missingPrevious.inputs[refs[0]];
      assert.throws(() => contractView(missingPrevious, 'catalog'), /requires reviewed input references/);
      const corrupted = structuredClone(reviewed); corrupted.inputs[Object.values(corrupted.helperTransitions)[0].to].sha256 = 'e'.repeat(64);
      assert.throws(() => contractView(corrupted, 'catalog'), /changed current helper identity/);
      for (const [view, file] of [['catalog', 'gate-index.json'], ['tiers', 'contract-test-tiers.json'], ['cases', 'contract-case-manifest.json']])
        writeFileSync(join(root, 'tools', file), JSON.stringify({ schemaVersion: 2, registry: 'contract-registry.json', view }));
      const publish = value => writeFileSync(join(root, 'tools/contract-registry.json'), JSON.stringify(value));
      const marker = join(root, 'child-marker');
      const run = () => { rmSync(marker, { force: true }); return spawnSync(process.execPath, [join(root, 'tools/gate-index.mjs'), '--id', 'H-selected', '--run', '--change', 'Exact helper transition admission'], { encoding: 'utf8', cwd: root }); };
      publish(runtime); const strict = run(); assert.notEqual(strict.status, 0); assert.match(strict.stderr, /REVIEW_NEEDED/);
      assert.equal(existsSync(marker), false);
      publish(reviewed); const passed = run(); assert.equal(passed.status, 0, passed.stderr); assert.equal(readFileSync(marker, 'utf8'), 'EXACT_HELPER_CHILD'); assert.match(passed.stdout, /test-selected\.mjs: PASS/); assert.match(passed.stdout, /full suite NOT_RUN/); assert.doesNotMatch(passed.stdout, /test-other.*PASS/);
      const receipt = passed.stdout.split('\n').flatMap(line => { try { const row = JSON.parse(line); return row.stage === 'explicitGateSelection' ? [row] : []; } catch { return []; } })[0];
      assert.deepEqual(receipt.helperVersionTransitions, [{ path: helperPath, from: before.sha256, to: current.sha256, reviewEvidence: publication.reviewEvidence }]);
      for (const [path, bytes] of [[proofPath, proofBytes], [helperPath, helperBytes], ['tools/test-selected.mjs', selected]]) {
        writeFileSync(join(root, path), bytes + '// changed input\n'); const refused = run();
        assert.notEqual(refused.status, 0); assert.match(refused.stderr, /REVIEW_NEEDED/); assert.equal(existsSync(marker), false);
        writeFileSync(join(root, path), bytes);
      }
      const unknown = structuredClone(reviewed), unknownInput = { ...before, sha256: 'd'.repeat(64) };
      const unknownRefs = [intern(unknown, unknownInput), refs[1]], unknownSet = digest(JSON.stringify(unknownRefs));
      unknown.inputSets[unknownSet] = unknownRefs; unknown.catalog.entries[0].definitionSet = unknownSet; publish(unknown);
      const refusedVersion = run(); assert.notEqual(refusedVersion.status, 0); assert.match(refusedVersion.stderr, /H-selected: REVIEW_NEEDED/); assert.equal(existsSync(marker), false);
      const unqualified = structuredClone(reviewed); unqualified.catalog.entries[0].qualification = 'NEEDS_EVIDENCE'; publish(unqualified);
      const refusedQualification = run(); assert.notEqual(refusedQualification.status, 0); assert.match(refusedQualification.stderr, /NEEDS_EVIDENCE/); assert.equal(existsSync(marker), false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  } else if (id === 'execution-runtime-owner') {
    const root = mkdtempSync(join(tmpdir(), 'reader-execution-runtime-'));
    try {
      mkdirSync(join(root,'tools/lib'),{recursive:true});
      const digest = bytes => createHash('sha256').update(bytes).digest('hex');
      for (const file of ['gate-index.mjs','run-contract-tests.mjs','lib/contract-registry.mjs','lib/contract-case-selection.mjs'])
        writeFileSync(join(root,'tools',file),readFileSync(new URL(file,import.meta.url)));
      writeFileSync(join(root,'tools/retired-contract-tests.json'),JSON.stringify({schemaVersion:1,entries:[]}));
      const selected="console.log('CURRENT_SELECTED_ONLY');\n";
      writeFileSync(join(root,'tools/test-selected.mjs'),selected);
      writeFileSync(join(root,'tools/test-other.mjs'),"throw Error('unselected child must never execute');\n");
      const oldInput={path:'tools/gate-index.mjs',sha256:'0'.repeat(64)},businessInput={path:'tools/test-selected.mjs',sha256:digest(selected)};
      const refs=[oldInput,businessInput].map(input=>digest(JSON.stringify(input))),set=digest(JSON.stringify(refs));
      const old={schemaVersion:2,tests:{'test-selected.mjs':{tier:'source',catalogId:'H-selected',legacy:{resources:[]}},'test-other.mjs':{tier:'integration'}},
        tiers:{schemaVersion:1},catalog:{schemaVersion:1,reviewedDefinitionsFrozen:true,entries:[{testRef:'test-selected.mjs',qualification:'QUALIFIED',definitionSet:set,necessityReason:'Exact runtime-owner fixture'}]},
        caseDefinitions:{},catalogCases:{},inputs:{[refs[0]]:oldInput,[refs[1]]:businessInput},inputSets:{[set]:refs}};
      const inputs=EXECUTION_RUNTIME_PATHS.map(path=>({path,sha256:digest(readFileSync(join(root,path)))}));
      const current=publishExecutionRuntime(old,{inputs,reviewEvidence:'Explicit isolated runtime-owner fixture'});
      assert.deepEqual(old.inputSets,current.inputSets[set] ? {[set]:current.inputSets[set]} : {},'old ordered definition set remains immutable');
      for(const [key,value]of Object.entries(old.inputs))assert.deepEqual(current.inputs[key],value);
      for(const view of ['tiers','cases'])assert.deepEqual(contractView(current,view),contractView(old,view));
      const {executionRuntime,executionRuntimeRequired,...catalog}=contractView(current,'catalog');
      assert.equal(executionRuntimeRequired,true);assert.equal(executionRuntime.definitionSet,current.executionRuntime.definitionSet);
      assert.deepEqual(catalog,contractView(old,'catalog'),'complete old catalog facts remain unchanged outside the new runtime authority');
      assert.equal(catalog.entries[0].definitionInputs[0].sha256,'0'.repeat(64),'old dispatcher review snapshot is not refreshed');
      assert.throws(()=>publishExecutionRuntime(old,{inputs:[...inputs,inputs[0]],reviewEvidence:'invalid'}),/exact unique/);
      assert.throws(()=>publishExecutionRuntime(old,{inputs:inputs.slice(1),reviewEvidence:'invalid'}),/exact unique/);
      assert.throws(()=>publishExecutionRuntime(old,{inputs:[{...inputs[0],path:'entry/business.ts'},...inputs.slice(1)],reviewEvidence:'invalid'}),/exact unique/);
      const missing=structuredClone(current);delete missing.executionRuntime;
      assert.throws(()=>contractView(missing,'catalog'),/execution runtime is required/);
      const missingSet=structuredClone(current);delete missingSet.inputSets[current.executionRuntime.definitionSet];
      assert.throws(()=>contractView(missingSet,'catalog'),/missing definition set/);
      for(const [view,file]of [['catalog','gate-index.json'],['tiers','contract-test-tiers.json'],['cases','contract-case-manifest.json']])
        writeFileSync(join(root,'tools',file),JSON.stringify({schemaVersion:2,registry:'contract-registry.json',view}));
      const publish=value=>writeFileSync(join(root,'tools/contract-registry.json'),JSON.stringify(value));
      const run=()=>spawnSync(process.execPath,[join(root,'tools/gate-index.mjs'),'--id','H-selected','--run','--change','Exact execution-runtime identity fixture'],{encoding:'utf8',cwd:root});
      publish(current);const passed=run();assert.equal(passed.status,0,passed.stderr);
      assert.match(passed.stdout,/test-selected\.mjs: PASS/);assert.match(passed.stdout,/full suite NOT_RUN/);assert.doesNotMatch(passed.stdout,/test-other.*PASS/);
      const gate=join(root,'tools/gate-index.mjs'),gateBytes=readFileSync(gate);
      writeFileSync(gate,Buffer.concat([gateBytes,Buffer.from('\n// changed current runtime\n')]));
      const changedRuntime=run();assert.notEqual(changedRuntime.status,0);assert.match(changedRuntime.stderr,/EXECUTION_RUNTIME: REVIEW_NEEDED/);assert.doesNotMatch(changedRuntime.stdout,/CURRENT_SELECTED_ONLY/);
      writeFileSync(gate,gateBytes);writeFileSync(join(root,'tools/test-selected.mjs'),selected+'// changed check definition\n');
      const changedBusiness=run();assert.notEqual(changedBusiness.status,0);assert.match(changedBusiness.stderr,/H-selected: REVIEW_NEEDED.*test-selected/);assert.doesNotMatch(changedBusiness.stdout,/CURRENT_SELECTED_ONLY/);
      writeFileSync(join(root,'tools/test-selected.mjs'),selected);const unqualified=structuredClone(current);unqualified.catalog.entries[0].qualification='NEEDS_EVIDENCE';publish(unqualified);
      const refused=run();assert.notEqual(refused.status,0);assert.match(refused.stderr,/NEEDS_EVIDENCE/);assert.doesNotMatch(refused.stdout,/CURRENT_SELECTED_ONLY/);
    } finally { rmSync(root,{recursive:true,force:true}); }
  } else if (id === 'resource-review-identities') {
    const normalized = { schemaVersion: 2, tests: { 'test-one.mjs': { tier: 'source', catalogId: 'H-one', focused: { sourceSha256: 'c'.repeat(64) } } },
      tiers: { schemaVersion: 1 }, catalog: { schemaVersion: 1, entries: [{ testRef: 'test-one.mjs' }] },
      catalogCases: { 'test-one.mjs#ready': { publishedDeclaration: true, resourceDefinitionSha256: 'a'.repeat(64) },
        'test-one.mjs#pending': { publishedDeclaration: true, resourceDefinitionSha256: 'a'.repeat(64) },
        'test-one.mjs#unpublished': { resourceDefinitionSha256: 'b'.repeat(64) } },
      caseDefinitions: registry.caseDefinitions, inputs: {}, inputSets: {} };
    const result = normalizeResourceReviewIdentities(normalized);
    for (const view of ['catalog','tiers','cases']) assert.deepEqual(contractView(result,view),contractView(normalized,view));
    assert.equal(result.tests['test-one.mjs'].focused.resourceDefinitionSha256,'a'.repeat(64));
    assert.equal(result.catalogCases['test-one.mjs#ready'].resourceDefinitionSha256,undefined);
    const historical=structuredClone(normalized);
    historical.catalogCases['test-one.mjs#pending'].resourceDefinitionSha256='b'.repeat(64);
    const retained=normalizeResourceReviewIdentities(historical);
    assert.equal(retained.tests['test-one.mjs'].focused.resourceDefinitionSha256,undefined);
    assert.equal(retained.catalogCases['test-one.mjs#pending'].resourceDefinitionSha256,'b'.repeat(64),'differing published historical identities remain explicit');
    result.tests['test-one.mjs'].focused.resourceDefinitionSha256='d'.repeat(64);
    const rows=contractView(result,'catalog').caseEntries;
    assert.ok(rows.slice(0,2).every(row=>row.resourceDefinitionSha256==='d'.repeat(64)));
    assert.equal(rows[2].resourceDefinitionSha256,'b'.repeat(64),'unpublished/differing historical identity is not merged');
    assert.equal(contractView(result,'cases').files['test-one.mjs'].resourceDefinitionSha256,undefined,'expected identity is not part of its own hash input');
    const missing=structuredClone(result);delete missing.tests['test-one.mjs'].focused.resourceDefinitionSha256;
    assert.throws(()=>contractView(missing,'catalog'),/missing reviewed resource identity/);
    const duplicate=structuredClone(result);duplicate.catalogCases['test-one.mjs#ready'].resourceDefinitionSha256='f'.repeat(64);
    assert.throws(()=>contractView(duplicate,'catalog'),/duplicate reviewed resource identity/);
  } else if (id === 'catalog-identities') {
    const complete = structuredClone(registry);
    const parent = complete.catalog.entries[0];
    Object.assign(parent, { tests: ['test-one.mjs'], reviewedSourceSha256: 'c'.repeat(64),
      focusedEntries: complete.catalog.caseEntries.map(row => row.id), needs: ['original-owner'] });
    for (const row of complete.catalog.caseEntries) Object.assign(row, { parentId: parent.id,
      tests: ['test-one.mjs'], caseSelection: { 'test-one.mjs': [row.caseId] }, needs: ['original-owner'] });
    const normalized = normalizeCatalogIdentities(complete);
    for (const view of ['catalog', 'tiers', 'cases']) assert.deepEqual(contractView(normalized, view), contractView(complete, view));
    assert.equal(normalized.catalog.caseEntries, undefined);
    assert.equal(normalized.tests['test-one.mjs'].focused.cases, undefined);
    normalized.tests['test-one.mjs'].catalogId = 'H-renamed';
    normalized.tests['test-one.mjs'].focused.sourceSha256 = 'e'.repeat(64);
    normalized.catalog.entries[0].needs = ['current-owner'];
    const current = contractView(normalized, 'catalog');
    assert.equal(current.entries[0].id, 'H-renamed');
    assert.equal(current.entries[0].reviewedSourceSha256, 'e'.repeat(64));
    assert.deepEqual(current.entries[0].focusedEntries, ['H-renamed#ready','H-renamed#pending','H-renamed#unpublished']);
    assert.ok(current.caseEntries.every(row => row.parentId === 'H-renamed' && row.id === `H-renamed#${row.caseId}`));
    assert.ok(current.caseEntries.every(row => row.needs[0] === 'current-owner'));
    assert.equal(current.caseEntries[1].definitionInputs[0].sha256, 'b'.repeat(64), 'differing historical definition stays explicit');
    assert.equal(contractView(normalized,'cases').files['test-one.mjs'].cases.unpublished,undefined,'catalog claim never publishes a case');
    const duplicate = structuredClone(normalized); duplicate.catalogCases['test-one.mjs#ready'].needs = ['second authority'];
    assert.throws(() => contractView(duplicate, 'catalog'), /duplicate inherited needs/);
    const missing = structuredClone(normalized); delete missing.tests['test-one.mjs'].catalogId;
    assert.throws(() => contractView(missing, 'catalog'), /missing catalog identity/);
    normalized.caseDefinitions['test-one.mjs#ready'].qualification = 'NEEDS_EVIDENCE';
    assert.equal(contractView(normalized,'catalog').caseEntries[0].qualification,'NEEDS_EVIDENCE');
    const template = { schemaVersion: 2, tests: { 'test-one.mjs': { tier: 'source', catalogId: 'H-one' } },
      catalog: { schemaVersion: 1, entries: [{ testRef: 'test-one.mjs' }] }, tiers: { schemaVersion: 1 },
      caseDefinitions: {}, inputs: {}, inputSets: {},
      catalogCases: { 'test-one.mjs#a': { note: 'shared', local: 1 }, 'test-one.mjs#b': { local: 2 } },
      catalogCaseTemplates: { 'test-one.mjs': { order: ['note','local'], defaults: { note: 'shared' } } } };
    const expanded = contractView(template, 'catalog').caseEntries;
    assert.deepEqual(expanded.map(row => [row.note, row.local]), [['shared', 1], ['shared', 2]], 'family defaults materialize in template order');
    const structuralDefault = structuredClone(template);
    structuralDefault.catalogCaseTemplates['test-one.mjs'].order.push('parentId');
    structuralDefault.catalogCaseTemplates['test-one.mjs'].defaults.parentId = 'H-one';
    assert.throws(() => contractView(structuralDefault, 'catalog'), /structural field parentId/);
    const reordered = structuredClone(template); reordered.catalogCases['test-one.mjs#a'] = { local: 1, note: 'local' };
    assert.throws(() => contractView(reordered, 'catalog'), /template order/);
    const missingField = structuredClone(template); delete missingField.catalogCases['test-one.mjs#b'].local;
    assert.throws(() => contractView(missingField, 'catalog'), /missing templated local/);
    const unknownFamily = structuredClone(template); unknownFamily.catalogCaseTemplates['test-other.mjs'] = unknownFamily.catalogCaseTemplates['test-one.mjs'];
    assert.throws(() => contractView(unknownFamily, 'catalog'), /catalog family/);
  } else if (id === 'review-preservation') {
    for (const view of ['catalog', 'tiers', 'cases']) assert.deepEqual(contractView(registry, view), previous[view]);
    assert.equal(Object.keys(registry.inputs).length, 2, 'same path with a different reviewed SHA is a distinct input');
    assert.equal(Object.keys(registry.caseDefinitions).length, 2, 'an unpublished claim does not publish a case');
    assert.equal(contractView(registry, 'catalog').caseEntries[1].qualification, 'NEEDS_EVIDENCE');
    registry.derivedCatalogSummaries = true;
    const summary = contractView(registry, 'catalog');
    assert.deepEqual(summary.qualificationCounts, { NAVIGATION: 1 });
    assert.deepEqual(summary.caseQualificationCounts, { QUALIFIED: 2, NEEDS_EVIDENCE: 1 });
    assert.equal(summary.inventoryFiles, 1);
    registry.caseDefinitions['test-one.mjs#ready'].qualification = 'NEEDS_EVIDENCE';
    assert.deepEqual(contractView(registry, 'catalog').caseQualificationCounts, { NEEDS_EVIDENCE: 2, QUALIFIED: 1 },
      'one canonical qualification edit changes the derived count without editing a cached summary');

  } else if (id === 'identity-rejection') {
    const missing = structuredClone(registry); delete missing.inputs[Object.keys(missing.inputs)[0]];
    assert.throws(() => contractView(missing, 'catalog'), /missing reviewed input/);
    const changed = structuredClone(registry); changed.inputs[Object.keys(changed.inputs)[0]].sha256 = 'd'.repeat(64);
    assert.throws(() => contractView(changed, 'catalog'), /changed reviewed input identity/);
    const substituted = structuredClone(registry); substituted.catalog.caseEntries[0].declarationRef = 'test-one.mjs#pending';
    assert.throws(() => contractView(substituted, 'catalog'), /case declaration identity mismatch/);
  } else if (id === 'pending-admission') {
    const manifest = { schemaVersion: 1, source: ['test-ready.mjs'], integration: [], pending: ['test-pending.mjs'] };
    const discovered = ['test-pending.mjs', 'test-ready.mjs'];
    const result = contractSelection(manifest, discovered, 'full');
    assert.deepEqual(result.selected, ['test-ready.mjs']);
    assert.deepEqual(result.omitted, ['test-pending.mjs']);
    const scoped = { ...manifest, scopes: { unsafe: ['test-pending.mjs'] } };
    assert.throws(() => contractSelection(scoped, discovered, 'full', 'unsafe'), /pending review/);
    assert.throws(() => contractSelection(manifest, [...discovered, 'test-unknown.mjs'], 'full'), /every discovered test/);
  } else if (id === 'proposal-separation') {
    const root = mkdtempSync(join(tmpdir(), 'reader-proposal-separation-'));
    try {
      mkdirSync(join(root, 'tools/lib'), { recursive: true });
      for (const file of ['gate-index.mjs', 'run-contract-tests.mjs', 'lib/contract-registry.mjs'])
        writeFileSync(join(root, 'tools', file), readFileSync(new URL(file, import.meta.url)));
      const selected = "console.log('SELECTED_ONLY');\n", other = "throw Error('Unselected test must not execute');\n";
      writeFileSync(join(root, 'tools/test-selected.mjs'), selected);
      writeFileSync(join(root, 'tools/test-other.mjs'), other);
      writeFileSync(join(root, 'tools/retired-contract-tests.json'), JSON.stringify({ schemaVersion: 1, entries: [] }));
      writeFileSync(join(root, 'tools/contract-test-tiers.json'), JSON.stringify({ schemaVersion: 1, source: ['test-selected.mjs'], integration: ['test-other.mjs'] }));
      writeFileSync(join(root, 'tools/contract-case-manifest.json'), JSON.stringify({ schemaVersion: 1, files: {}, legacy: { 'test-selected.mjs': { resources: [] } } }));
      writeFileSync(join(root, 'tools/gate-index.json'), JSON.stringify({ schemaVersion: 1, reviewedDefinitionsFrozen: true,
        optimizationPlanFile: 'tools/gate-optimization-plan.json', entries: [{ id: 'H-selected', file: 'tools/test-selected.mjs',
          qualification: 'QUALIFIED', tests: ['test-selected.mjs'], necessityReason: 'Finite proposal-separation fixture',
          definitionInputs: [{ path: 'tools/test-selected.mjs', sha256: createHash('sha256').update(selected).digest('hex') }] }] }));
      for (const malformed of [false, true]) {
        if (malformed) writeFileSync(join(root, 'tools/gate-optimization-plan.json'), '{invalid historical proposal');
        const run = spawnSync(process.execPath, [join(root, 'tools/gate-index.mjs'), '--id', 'H-selected', '--run', '--change', 'Exact proposal-isolation fixture'], { encoding: 'utf8', cwd: root });
        assert.equal(run.status, 0, run.stderr);
        assert.match(run.stdout, /test-selected\.mjs: PASS/);
        assert.match(run.stdout, /full suite NOT_RUN/);
        assert.doesNotMatch(run.stdout, /test-other.*PASS/);
      }
      const annotation = spawnSync(process.execPath, [join(root, 'tools/gate-index.mjs'), '--id', 'H-selected', '--include-proposals'], { encoding: 'utf8', cwd: root });
      assert.notEqual(annotation.status, 0, 'explicit annotation lookup still diagnoses malformed proposal');
      const mixed = spawnSync(process.execPath, [join(root, 'tools/gate-index.mjs'), '--id', 'H-selected', '--run', '--include-proposals', '--change', 'invalid mix'], { encoding: 'utf8', cwd: root });
      assert.notEqual(mixed.status, 0);
      assert.match(mixed.stderr, /lookup annotations only/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  } else {
    const root = mkdtempSync(join(tmpdir(), 'reader-registry-'));
    try {
      mkdirSync(join(root, 'tools'));
      const file = join(root, 'tools/contract-test-tiers.json');
      writeFileSync(file, JSON.stringify(previous.tiers));
      assert.deepEqual(readContractView(root, 'tiers'), previous.tiers);
      writeFileSync(join(root, 'tools/contract-registry.json'), JSON.stringify(registry));
      writeFileSync(file, JSON.stringify({ schemaVersion: 2, registry: 'contract-registry.json', view: 'tiers' }));
      assert.deepEqual(readContractView(root, 'tiers'), previous.tiers);
      const untouched = readFileSync(join(root, 'tools/contract-registry.json'), 'utf8');
      writeFileSync(file, JSON.stringify({ schemaVersion: 2, registry: '../outside.json', view: 'tiers' }));
      assert.throws(() => readContractView(root, 'tiers'), /unsupported contract registry path/);
      assert.equal(readFileSync(join(root, 'tools/contract-registry.json'), 'utf8'), untouched);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  recordContractCasePass(id);
}

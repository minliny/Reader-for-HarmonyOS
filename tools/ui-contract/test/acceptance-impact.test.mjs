import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { parseImpactArguments } from '../../gate-index-impact.mjs';
import { createImpactView, diffImpactViews } from '../../lib/gate-index-impact.mjs';
import { gateResourceDefinitionSha256 } from '../../lib/gate-resource-definition.mjs';

const modelFile = 'tools/page-structure/model.json';
const searchPath = 'entry/src/main/ets/features/search/ui/SearchPage.ets';
const renamedPath = 'entry/src/main/ets/features/search/ui/SearchResults.ets';
const layoutPath = 'tools/ui-contract/lib/layout.mjs';
const ids = Array.from({ length: 9 }, (_, index) => `bookshelf.search-branch-${index + 1}`);
const localCase = id => `tools/ui-contract/cases/${id}.json`;
const findGap = (view, kind, extra = {}) => view.unresolved.find(gap =>
  gap.kind === kind && Object.entries(extra).every(([key, value]) => gap[key] === value));

test('the impact CLI accepts grouped and repeated affected paths in argument order', () => {
  const parsed = parseImpactArguments([
    '--affected', searchPath, renamedPath, '--compare', 'previous.json', '--affected', modelFile, layoutPath,
  ]);
  assert.deepEqual(parsed.affected, [searchPath, renamedPath, modelFile, layoutPath]);
  assert.equal(parsed.compare, 'previous.json');
  assert.throws(() => parseImpactArguments(['--deps', 'ui-case:book', searchPath]), /Unexpected positional argument/);
  assert.throws(() => parseImpactArguments([searchPath, '--affected', layoutPath]), /Unexpected positional argument/);
});

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'reader-acceptance-impact-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (relative, content) => {
    const location = join(root, relative);
    mkdirSync(dirname(location), { recursive: true });
    writeFileSync(location, typeof content === 'string' ? content : JSON.stringify(content));
  };
  const model = {
    layers: [{ id: 'content' }, { id: 'overlay' }],
    invariants: [{ id: 'B3', layer: 'content' }],
    structureSelectors: { searchInput: { ids: ['reader-search-input'] } },
    structureRules: [
      { id: 'bookshelf', layer: 'content', requires: [], checks: [] },
      { id: 'input', layer: 'overlay', requires: ['bookshelf'], checks: [{ kind: 'present', node: 'searchInput' }] },
      { id: 'bad', layer: 'content', requires: ['removed'], checks: [] },
      { id: 'unrelated', layer: 'content', requires: [], checks: [] },
    ],
    structureFoundations: { input: ['bookshelf'] },
    scenarioObligations: ids.map(caseId => ({ caseId, states: { opened: 'input' }, actions: { opened: null } })),
    receiptAdmissions: [{
      caseId: ids[0], pageId: 'bookshelf', routeContractRef: 'nav.bookshelf', claim: 'invariants.B3',
      assertions: [{ id: 'input', sampleId: 'opened' }],
    }],
  };
  const reviewed = { schemaVersion: 1, reviewedDefinitionsFrozen: true, entries: [
    { id: 'H-legacy', file: 'tools/test-search.mjs', qualification: 'NEEDS_EVIDENCE',
      productionBinding: 'Scope text names SearchPage.ets and SearchResults.ets.',
      coverageAdoption: [{file:'tools/test-search.mjs',cases:['scope']}, 'Older free-form coverage note'],
      definitionInputs: [{ path: 'tools/test-search.mjs', sha256: 'a'.repeat(64) }] },
    { id: 'H-consumer', qualification: 'NAVIGATION', coverageAdoption: [{target:'H-legacy'}] },
  ], caseEntries: [{id:'H-legacy#scope',caseId:'scope',file:'tools/test-search.mjs',qualification:'NEEDS_EVIDENCE'}] };
  write(modelFile, model);
  write('tools/page-structure/register.json', { pages: [{ pageId: 'bookshelf', routeContractRef: 'nav.bookshelf' }] });
  write('tools/gate-index.json', reviewed);
  write('tools/contract-case-manifest.json', { schemaVersion: 1, files: {}, legacy: {} });
  write('tools/retired-contract-tests.json', { schemaVersion: 1, entries: [{ id: 'H-retired', file: 'test-retired.mjs' }] });
  write('tools/ui-contract-impact-bindings.json', { schemaVersion: 1, cases: {} });
  write('tools/ui-contract/cases/phase-0.registry.json', ['bookshelf.search-input-ime']);
  write('tools/ui-contract/cases/phase-1.registry.json', [...ids, 'reading.independent']);
  write('tools/ui-contract/cases/phase-2.registry.json', []);
  write('tools/ui-contract/lib/cases.mjs', "throw new Error('index must read the declaration without loading the case runtime');");
  write(localCase('bookshelf.search-input-ime'), { id: 'bookshelf.search-input-ime', pageId: 'bookshelf', steps: [], assertions: [] });
  write(renamedPath, 'export const moved = 1;\n');
  for (const [index, id] of ids.entries()) {
    const assertions = [{ id: 'input', evaluator: 'layout', sample: 'opened', source: `${searchPath}#projection` }];
    write(localCase(id), { id, version: 1, phase: 1, pageId: 'bookshelf', steps: [{ id: 'opened', kind: 'sample' }],
      structure: { opened: 'opened' }, assertions, ownerSources: [index === 0 ? renamedPath : searchPath] });
  }
  model.scenarioObligations.push({ caseId: 'reading.independent', states: { shown: 'unrelated' }, actions: { shown: null } });
  write(modelFile, model);
  write(localCase('reading.independent'), { id: 'reading.independent', version: 1, phase: 1, pageId: 'reading',
    steps: [{ id: 'shown', kind: 'sample' }], structure: { shown: 'shown' }, assertions: [] });
  write(layoutPath, `import { sample } from './photo.mjs';\nthrow new Error('must never import or execute a checked module');`);
  write('tools/ui-contract/lib/photo.mjs', `export { sample } from './layout.mjs';\nconst path = chosenByDevice();\nawait import(path);`);
  for (const path of [
    'tools/ui-contract/lib/structure.mjs', 'tools/ui-contract/lib/structure-contract.mjs',
    'tools/ui-contract/coverage.mjs', 'tools/page-structure/check-register.mjs',
    'tools/page-structure/receipt-evidence.mjs',
    'tools/ui-contract/schema/evidence.json', 'tools/ui-contract/export-replay.mjs',
    'tools/ui-contract/lib/receipt-structure.mjs', 'tools/ui-contract/reassess-structure.mjs',
  ]) write(path, 'throw new Error("must never import or execute a checked module");');
  write('tools/ui-contract/cli.mjs', "await import('./lib/receipt-structure.mjs');\nthrow new Error('must not execute');");
  return { root, write, model };
}

test('registration coverage indexes exact scoped receipts without granting whole-rule admission', t => {
  const {root,write,model} = fixture(t);
  const inventory = 'tools/page-structure/source-interaction-inventory.json';
  const matrix = 'tools/page-structure/source-layout-evidence.json';
  const prefix = 'registration-coverage:bookshelf/invariants.';
  const e2 = prefix + 'E2';
  const e3 = prefix + 'E3';
  const localSupport = 'tools/ui-contract-impact-bindings.json';
  const checkPath = 'tools/ui-contract/test/acceptance-impact.test.mjs';
  const checkName = 'registration coverage indexes exact scoped receipts without granting whole-rule admission';
  const checkId = `ui-local-check:${checkPath}#${checkName}`;
  const [tapCase,textCase,surfaceCase] = ids;
  const page = {pageId:'bookshelf',routeContractRef:'nav.bookshelf'};
  const pairs = [{id:'input',sampleId:'opened'}];
  const scope = 'Only the selected sample in its observed window.';
  const text = {requireNativeFontReadback:true,requireCurrentTextProjection:true,
    minWidthVp:319,maxWidthVp:321,minFontScale:1,maxFontScale:1.01};
  const expanded = {minWidthVp:366,maxWidthVp:366,minFontScale:1,maxFontScale:2};
  write('tools/ui-contract/lib/source.mjs', "throw new Error('must not execute');");
  write(searchPath, 'export const mounted = true;');
  function writeCase(id,kind,expected) {
    write(localCase(id),{id,phase:1,pageId:page.pageId,steps:[{id:'opened',kind:'sample'}],
      structure:{opened:'opened'},ownerSources:[searchPath],
      assertions:[{id:'input',evaluator:'source',kind,sample:'opened',required:true,expected}]});
  }
  writeCase(tapCase,'filter-target',{});
  writeCase(textCase,'adaptation-text',text);
  writeCase(surfaceCase,'adaptation-surface',expanded);
  model.invariants.push({id:'E2',layer:'content'},{id:'E3',layer:'content'});
  write('tools/page-structure/register.json',{pages:[{...page,
    invariants:{B3:{result:'NOT_RUN'},E2:{result:'FAIL'},E3:{result:'FAIL'}}}]});
  write(inventory,{pageId:page.pageId,targets:[{id:'sampled'},{id:'unsampled'}]});
  write(matrix,{pageId:page.pageId,widths:[320,366],fontScales:[1,2]});
  write(checkPath,readFileSync(new URL(import.meta.url),'utf8'));
  const checks = [{path:checkPath,name:checkName}];
  write(localSupport,{schemaVersion:1,cases:{},registrationCoverage:{[e2]:{checks},[e3]:{checks}}});
  model.receiptCoverageReferences = [{
    ...page,claim:'invariants.E2',basisInput:{kind:'target-inventory',path:inventory},
    cases:[{caseId:tapCase,assertions:pairs,scope,ownerSources:[searchPath],targetIds:['sampled']}],
    remaining:['Whole-page target, variant and input coverage.'],
  },{
    ...page,claim:'invariants.E3',basisInput:{kind:'layout-matrix',path:matrix},
    cases:[{caseId:textCase,assertions:pairs,scope,ownerSources:[searchPath]},
      {caseId:surfaceCase,assertions:pairs,scope,ownerSources:[searchPath]}],
    remaining:['Complete native text across layout cells and page states.'],
  }];
  write(modelFile,model);
  const view = createImpactView({root,deps:[e2,e3]});
  assert.ok(view.completeKnownRelations, JSON.stringify(view.unresolved));
  const scoped2 = view.nodes.find(node => node.id === e2);
  const scoped3 = view.nodes.find(node => node.id === e3);
  assert.deepEqual(scoped2.coverage.inventoryTargetsWithoutReferences,['unsampled']);
  assert.deepEqual(scoped3.coverage.fontWindowsWithoutTextReferences,[
    {widthVp:320,fontScale:2},{widthVp:366,fontScale:1},{widthVp:366,fontScale:2},
  ]);
  assert.equal(scoped2.qualification,'LOOKUP_ONLY');
  assert.equal(scoped2.execution,'NOT_RUN');
  assert.equal(scoped3.execution,'NOT_RUN');
  const foundCheck = view.nodes.find(node => node.id === checkId);
  assert.equal(foundCheck.entry,`node --test --test-name-pattern '^${checkName}$' ${checkPath}`);
  assert.equal(foundCheck.qualification,'LOOKUP_ONLY');
  assert.equal(foundCheck.execution,'NOT_RUN');
  const checkImpact = createImpactView({root,affected:[checkPath]});
  assert.ok([e2,e3].every(id => checkImpact.references.includes(id)));
  assert.ok(view.prerequisites.includes('structure-rule:bookshelf'));
  assert.ok(!view.nodes.some(node => /^registration:bookshelf\/invariants\.E[23]$/u.test(node.id)));
  assert.ok(view.relationships.some(edge => edge.consumer === e2 && edge.dependency === `ui-case:${tapCase}` &&
    edge.kind === 'scoped-receipt-reference' && edge.scope === scope &&
    edge.assertions[0].sampleId === 'opened'));
  assert.ok(createImpactView({root,affected:[inventory]}).references.includes(e2));
  assert.ok(createImpactView({root,affected:[matrix]}).references.includes(e3));
  const codeImpact = createImpactView({root,affected:[searchPath,localCase(tapCase)]});
  assert.ok(codeImpact.direct.includes(e2));
  assert.ok(codeImpact.references.includes('registration:bookshelf/invariants.B3'));

  const [touch] = model.receiptCoverageReferences;
  touch.routeContractRef = 'nav.obsolete';
  touch.cases[0].assertions = [{id:'input',sampleId:'other'}];
  touch.cases[0].ownerSources = [renamedPath];
  touch.cases[0].targetIds = ['removed'];
  touch.cases.push({caseId:'bookshelf.missing',assertions:pairs,scope,ownerSources:[searchPath]});
  write(modelFile,model);
  const broken = createImpactView({root,deps:[e2]});
  for (const kind of ['CLAIM','CASE','OWNER','ASSERTION','TARGET']) {
    assert.ok(findGap(broken,`REGISTRATION_COVERAGE_${kind}_UNRESOLVED`,{id:e2}));
  }
  const brokenScope = broken.nodes.find(node => node.id === e2);
  assert.deepEqual(brokenScope.coverage.inventoryTargetsWithoutReferences,['sampled','unsampled']);
  assert.equal(brokenScope.execution,'NOT_RUN');
  write(inventory,{pageId:'other-page',targets:[{id:'sampled'},{id:'sampled'}]});
  write(matrix,{pageId:page.pageId,widths:[320,320,366],fontScales:[1,2]});
  writeCase(textCase,'adaptation-text',{...text,minFontScale:2,maxFontScale:1});
  const brokenBasis = createImpactView({root,deps:[e2,e3]});
  assert.ok(findGap(brokenBasis,'REGISTRATION_COVERAGE_BASIS_UNRESOLVED',{id:e2}));
  assert.ok(findGap(brokenBasis,'REGISTRATION_COVERAGE_BASIS_UNRESOLVED',{id:e3}));
  assert.ok(findGap(brokenBasis,'REGISTRATION_COVERAGE_TEXT_WINDOW_UNRESOLVED',{id:e3}));
  assert.equal(brokenBasis.nodes.find(node => node.id === e2).coverage.inventoryTargetsWithoutReferences,null);
  assert.equal(brokenBasis.nodes.find(node => node.id === e3).coverage.fontWindowsWithoutTextReferences,null);
});

test('registration coverage requires each Source gesture to reference its bound native swipe', t => {
  const {root,write,model} = fixture(t);
  const pageId = 'source-management', routeContractRef = 'nav.source';
  const inventory = 'tools/page-structure/source-interaction-inventory.json';
  const caseId = 'source-management.scroll-return';
  const id = `registration-coverage:${pageId}/invariants.E2`;
  const owner = 'entry/src/main/ets/features/source/ui/SourceManagementPage.ets';
  const assertion = {id:'source.layout.footer-fixed',evaluator:'source',kind:'fixed-scroll',required:true,
    baseline:'fixture-sources-ready',action:'scroll-shallow',sample:'shallow',expected:{requireNativeSwipe:true}};
  const steps = [
    {id:'fixture-sources-ready',kind:'sample'},
    {id:'scroll-shallow',kind:'action',op:'swipe',target:'reader-source-list',from:'fixture-sources-ready'},
    {id:'shallow',kind:'sample',afterAction:'scroll-shallow'},
  ];
  const contract = {id:caseId,pageId,phase:1,ownerSources:[owner],steps,assertions:[assertion],
    structure:{before:'fixture-sources-ready',moved:'shallow'}};
  write(owner,'export const sourceList = true;');
  write('tools/ui-contract/lib/source.mjs','throw new Error("the index only reads definitions");');
  write('tools/ui-contract/cases/phase-1.registry.json',[...ids,'reading.independent',caseId]);
  write('tools/page-structure/register.json',{pages:[{pageId,routeContractRef,invariants:{E2:{result:'FAIL'}}}]});
  write(inventory,{pageId,targets:[{id:'query-input'}],gestures:[{id:'main-list'},{id:'status-scroll'}]});
  model.invariants.push({id:'E2',layer:'content'});
  model.scenarioObligations.push({caseId,states:{before:'input',moved:'input'},actions:{before:null,moved:'scroll-shallow'}});
  const part = {caseId,assertions:[{id:assertion.id,sampleId:assertion.sample}],
    scope:'Observed main-list swipe',ownerSources:[owner],gestureIds:['main-list']};
  model.receiptCoverageReferences = [{pageId,routeContractRef,claim:'invariants.E2',
    basisInput:{kind:'target-inventory',path:inventory},cases:[part],remaining:['Other current native interactions']}];
  write(modelFile,model);
  write(localCase(caseId),contract);

  const recorded = createImpactView({root,deps:[id]});
  const node = recorded.nodes.find(node=>node.id === id);
  assert.deepEqual(node.coverage.inventoryGesturesWithoutReferences,['status-scroll']);
  assert.equal(node.qualification,'LOOKUP_ONLY');
  assert.equal(node.execution,'NOT_RUN');
  assert.deepEqual(recorded.relationships.find(edge=>edge.consumer === id && edge.dependency === `ui-case:${caseId}`).gestureIds,
    ['main-list']);
  assert.ok(createImpactView({root,affected:[owner]}).direct.includes(id));

  steps[1].target = 'reader-source-status-filter';
  write(localCase(caseId),contract);
  part.gestureIds.push('unlisted');
  write(modelFile,model);
  const broken = createImpactView({root,deps:[id]});
  for (const gestureId of part.gestureIds) {
    assert.ok(findGap(broken,'REGISTRATION_COVERAGE_GESTURE_UNRESOLVED',{id,gestureId}));
  }
  assert.deepEqual(broken.nodes.find(node=>node.id === id).coverage.inventoryGesturesWithoutReferences,
    ['main-list','status-scroll']);
});

test('registration coverage indexes a Source target only with its actual conditional obligation', t => {
  const {root,write,model} = fixture(t);
  const caseId = ids[0];
  const scopeId = 'registration-coverage:bookshelf/invariants.E2';
  const inventory = 'tools/page-structure/source-interaction-inventory.json';
  const page = {pageId:'bookshelf',routeContractRef:'nav.bookshelf'};
  model.invariants.push({id:'E2',layer:'content'});
  model.receiptAdmissions = [];
  model.scenarioObligations[0].conditions = {opened:'retry'};
  model.receiptCoverageReferences = [{
    ...page,claim:'invariants.E2',basisInput:{kind:'target-inventory',path:inventory},
    cases:[{caseId,assertions:[{id:'retry',sampleId:'opened'}],ownerSources:[renamedPath],
      targetIds:['retry-button'],scope:'Only after source read actually failed'}],
    remaining:['Whole-page hit coverage'],
  }];
  write(modelFile,model);
  write('tools/page-structure/register.json',{pages:[{...page,invariants:{B3:{result:'NOT_RUN'},E2:{result:'FAIL'}}}]});
  write(inventory,{pageId:page.pageId,targets:[{id:'retry-button'}]});
  write('tools/ui-contract/lib/source.mjs','throw new Error("must not run Source evaluator during lookup");');
  write(localCase(caseId),{id:caseId,phase:1,pageId:page.pageId,steps:[{id:'opened',kind:'sample'}],
    structure:{opened:'opened'},ownerSources:[renamedPath],
    assertions:[{id:'retry',kind:'read-retry',evaluator:'source',required:false,condition:'Actual cold read failed',
      expected:{requireNativeTouchTarget:true},sample:'opened'}]});
  const query = () => createImpactView({root,deps:[scopeId]});
  const current = query();
  assert.deepEqual(current.unresolved,[]);
  assert.deepEqual(current.nodes.find(node=>node.id===scopeId).coverage.inventoryTargetsWithoutReferences,[]);
  assert.equal(current.nodes.find(node=>node.id===scopeId).execution,'NOT_RUN');
  delete model.scenarioObligations[0].conditions;
  write(modelFile,model);
  const broken = query();
  assert.ok(findGap(broken,'REGISTRATION_COVERAGE_ASSERTION_UNRESOLVED',{id:scopeId}));
  assert.deepEqual(broken.nodes.find(node=>node.id===scopeId).coverage.inventoryTargetsWithoutReferences,['retry-button']);
  model.scenarioObligations[0].conditions = {opened:'retry'};
  model.scenarioObligations[0].actions = {opened:'different-action'};
  write(modelFile,model);
  assert.ok(findGap(query(),'REGISTRATION_COVERAGE_ASSERTION_UNRESOLVED',{id:scopeId}));

  model.scenarioObligations[0].actions = {opened:null};
  write(modelFile,model);
  write(inventory,{pageId:page.pageId,targets:[{id:'retry-button',controlRef:'source-original-continue'}]});
  const writeRecovery = target => write(localCase(caseId),{id:caseId,phase:1,pageId:page.pageId,
    steps:[{id:'opened',kind:'sample'}],structure:{opened:'opened'},ownerSources:[renamedPath],
    assertions:[{id:'retry',kind:'recovery-native-control',evaluator:'source',required:false,
      condition:'The current original operation allows continuing',expected:{target,requireNativeTouchTarget:true},
      sample:'opened'}]});
  writeRecovery('reader-source-original-continue');
  assert.deepEqual(query().unresolved,[]);
  writeRecovery('reader-source-unknown-reconcile');
  const wrongBranch = query();
  assert.ok(findGap(wrongBranch,'REGISTRATION_COVERAGE_ASSERTION_UNRESOLVED',{id:scopeId}));
  assert.deepEqual(wrongBranch.nodes.find(node=>node.id===scopeId).coverage.inventoryTargetsWithoutReferences,['retry-button']);
});

test('V4 impact distinguishes executable module references from comments and string examples', t => {
  const {root,write} = fixture(t);
  const id = `file:${layoutPath}`;
  const helper = 'tools/ui-contract/lib/actual.mjs';
  write(helper, 'export const sample = 1;');
  const source = [
    "import {sample} from './actual.mjs';",
    "const check = 'const dependency = require(packageRoot);';",
    "// import('./comment.mjs');",
    "/*",
    "import './block-comment.mjs';",
    "*/",
    "const example = \"new URL('example.json', guessedBase)\";",
  ].join('\n');
  const query = () => createImpactView({root,deps:[id]});
  write(layoutPath,source);
  const result = query();
  assert.ok(!findGap(result,'DYNAMIC_REFERENCE',{id}));
  assert.deepEqual(result.relationships.filter(edge => edge.consumer === id).map(edge => edge.dependency),[
    `file:${helper}`,
  ]);
  assert.ok(createImpactView({root,affected:[helper]}).references.includes(id));
  write(layoutPath, source + '\nconst loaded = require(pickModule());');
  assert.ok(findGap(query(),'DYNAMIC_REFERENCE',{id}));
  write(layoutPath, source + '\nconst result = `value: ${await import(pickModule())}`;');
  assert.ok(findGap(query(),'DYNAMIC_REFERENCE',{id}));
  write(layoutPath, "const loaded = import ('./actual.mjs');");
  assert.ok(createImpactView({root,affected:[helper]}).references.includes(id));
  write(layoutPath, 'const loaded = import (pickModule());');
  assert.ok(findGap(query(), 'DYNAMIC_REFERENCE', { id }));
});

test('impact registry uses all phases and reports invalid registrations without running cases', t => {
  const { root, write } = fixture(t);
  const id = 'bookshelf.public-book-reading';
  const node = `ui-case:${id}`;
  const phase2 = 'tools/ui-contract/cases/phase-2.registry.json';
  const path = localCase(id);
  const contract = { id, phase: 2, version: 1, pageId: 'bookshelf', steps: [], assertions: [] };
  write(path, contract);
  const query = () => createImpactView({root, deps:[node]});
  assert.ok(findGap(query(), 'UNREGISTERED_CASE', { id: node }));
  write(phase2, [id]);
  assert.equal(query().nodes.find(candidate => candidate.id === node).qualification, 'EXPLICIT_CASE');
  assert.ok(createImpactView({root, affected:[phase2]}).direct.includes(node));
  write(path, { ...contract, phase: 1 });
  assert.equal(query().nodes.find(candidate => candidate.id === node).entry, null);
  assert.ok(findGap(query(), 'INVALID_CASE_REGISTRATION', { id: node, path }));
  write(path, contract);
  write(phase2, [id, id]);
  assert.equal(query().nodes.find(candidate => candidate.id === node).entry, null);
  assert.ok(findGap(query(), 'INVALID_CASE_REGISTRATION', { id: node, path: phase2 }));
  write('tools/ui-contract/cases/phase-1.registry.json', [...ids, 'reading.independent', id]);
  write(phase2, [id]);
  const conflict = createImpactView({root, affected:[phase2]});
  assert.ok(conflict.direct.includes(node));
  assert.ok(findGap(conflict, 'INVALID_CASE_REGISTRATION', { id: node, path: phase2 }));
});

test('impact preserves missing evaluator references and fingerprints linked schema files', t => {
  const { root, write } = fixture(t);
  const schema = 'tools/ui-contract/schema/evidence.json';
  const schemaQuery = {root, deps:[`ui-case:${ids[0]}`]};
  const beforeSchema = createImpactView(schemaQuery);
  write(schema, { title: 'Adjusted evidence schema' });
  const diff = diffImpactViews(beforeSchema, createImpactView(schemaQuery));
  assert.ok(diff.changedDefinitions.includes(`file:${schema}`));
  assert.ok(diff.referencesToChangedDefinitions.includes(`ui-case:${ids[0]}`));

  rmSync(join(root, layoutPath));
  const missing = createImpactView({root, affected:[layoutPath]});
  assert.ok(missing.references.includes(`ui-case:${ids[0]}`));
  assert.ok(findGap(missing, 'CHANGED_PATH_ABSENT', { path: layoutPath }));
  assert.ok(findGap(missing, 'STALE_ID_REFERENCE', { id: `ui-case:${ids[0]}`, dependency: `file:${layoutPath}` }));
  assert.ok(!findGap(missing, 'UNMAPPED_PATH', { path: layoutPath }));
});

test('impact maps resource declarations and compares reviewed gate execution definitions', t => {
  const { root, write } = fixture(t);
  const catalog = 'tools/gate-index.json';
  const manifest = 'tools/contract-case-manifest.json';
  const entry = { id:'H-legacy', file:'tools/test-search.mjs', qualification:'QUALIFIED',
    tests:['test-search.mjs'], definitionInputs:[{ path:'tools/test-search.mjs', sha256:'a'.repeat(64) }] };
  const resource = { schemaVersion:1, legacy:{ 'test-search.mjs':{ resources:[] }, 'test-unrelated.mjs':{ resources:[] } }, files:{} };
  entry.resourceDefinitionSha256 = gateResourceDefinitionSha256(resource, entry);
  const writeCatalog = () => write(catalog, { schemaVersion:1, reviewedDefinitionsFrozen:true, entries:[entry] });
  writeCatalog();
  write(manifest, resource);
  const query = {root, affected:[manifest]};
  const initial = createImpactView(query);
  const gate = 'gate:H-legacy';
  const node = view => view.nodes.find(candidate => candidate.id === gate);
  assert.ok(initial.direct.includes(gate));
  assert.ok(initial.definitionIdentities[manifest]);
  assert.deepEqual(node(initial).resourceDefinition, {path:manifest, expected:entry.resourceDefinitionSha256,
    actual:entry.resourceDefinitionSha256});
  resource.legacy['test-unrelated.mjs'].resources = ['build'];
  write(manifest, resource);
  assert.deepEqual(diffImpactViews(initial, createImpactView(query)).changedDefinitions, []);
  resource.legacy['test-search.mjs'].resources = ['build'];
  write(manifest, resource);
  const manifestChanged = createImpactView(query);
  assert.deepEqual(diffImpactViews(initial, manifestChanged).changedDefinitions, [gate]);
  assert.notEqual(node(manifestChanged).resourceDefinition.expected, node(manifestChanged).resourceDefinition.actual);

  entry.resourceDefinitionSha256 = 'b'.repeat(64);
  writeCatalog();
  const reviewChanged = createImpactView(query);
  assert.deepEqual(diffImpactViews(manifestChanged, reviewChanged).changedDefinitions, [gate]);
  entry.executionEnvUnset = ['READER_TEST_FIXTURE_SWITCH'];
  writeCatalog();
  assert.deepEqual(diffImpactViews(reviewChanged, createImpactView(query)).changedDefinitions, [gate]);
});

test('malformed case elements are reported without aborting unrelated queries', t => {
  const { root, write } = fixture(t);
  const id = 'bookshelf.malformed-case';
  const path = localCase(id);
  write(path, {id, version:1, phase:1, pageId:'bookshelf', steps:[null], assertions:[]});
  const unrelated = createImpactView({root, deps:['gate:H-legacy']});
  assert.ok(unrelated.direct.includes('gate:H-legacy'));
  assert.ok(unrelated.otherDefinitionGaps.some(gap => gap.kind === 'INVALID_CASE_DISPATCH_INPUT' && gap.path === path));
  assert.ok(findGap(createImpactView({root, affected:[path]}), 'INVALID_CASE_DISPATCH_INPUT', {path}));
});

test('V4 impact maps the pinned schema validator without resolving the SDK', t => {
  const { root, write } = fixture(t);
  const library = 'tools/page-structure/lib.mjs';
  const validator = 'tools/page-structure/validate-model.mjs';
  const register = 'tools/page-structure/check-register.mjs';
  const layoutEvidence = 'tools/page-structure/layout-evidence.mjs';
  const layoutSchema = 'tools/page-structure/schema/layout-evidence.schema.json';
  const runtime = 'runtime:deveco-ets/ajv@8.17.1';
  const source = readFileSync(new URL('../../page-structure/lib.mjs', import.meta.url), 'utf8');
  const layoutSource = readFileSync(new URL('../../page-structure/layout-evidence.mjs',import.meta.url),'utf8');
  write(library, `${source}\nthrow new Error('the lookup must never resolve the SDK');`);
  const invocation = "import { schemaValidator } from './lib.mjs';\nconst { ajv, dependency } = schemaValidator();\nthrow new Error('the lookup must never run the validator');";
  write(validator,invocation);
  write(register,"import { digest } from './lib.mjs';\nimport { checkLayoutEvidence } from './layout-evidence.mjs';\nthrow new Error('the lookup must never run the register');");
  write(layoutSchema,{});
  const layoutInvocation = `${layoutSource}\nthrow new Error('the lookup must never run the layout validator');`;
  write(layoutEvidence,layoutInvocation);
  const view = createImpactView({root, affected:[library]});
  assert.ok(!findGap(view,'DYNAMIC_REFERENCE',{path:library}));
  assert.equal(view.nodes.find(node=>node.id===runtime)?.execution,'NOT_RUN');
  assert.ok(view.relationships.some(edge=>edge.consumer===`file:${validator}` && edge.dependency===runtime));
  assert.ok(createImpactView({root,deps:[`file:${validator}`]}).nodes.some(node=>node.id===runtime));
  const runtimeView = createImpactView({root,deps:[runtime]});
  assert.ok(runtimeView.references.includes(`file:${validator}`));
  assert.ok(!runtimeView.relationships.some(edge => edge.consumer === `file:${register}` && edge.dependency === runtime));

  const dependencies = () => createImpactView({root,deps:[`file:${layoutEvidence}`]});
  const layoutRuntime = view => view.relationships.some(edge => edge.consumer === `file:${layoutEvidence}` && edge.dependency === runtime);
  const hasSchema = view => view.relationships.some(edge => edge.consumer === `file:${layoutEvidence}` && edge.dependency === `file:${layoutSchema}`);
  const layoutView = dependencies();
  assert.ok(layoutRuntime(layoutView));
  assert.ok(hasSchema(layoutView));
  assert.ok(!findGap(layoutView,'DYNAMIC_REFERENCE',{path:layoutEvidence}));
  assert.ok(createImpactView({root,affected:[layoutSchema]}).references.includes(`file:${layoutEvidence}`));

  const literalReader = `readJSON('${layoutSchema}')`;
  const computedCompiler = 'const computed = schemaValidator().ajv.compile(readJSON(chosenPath()));';
  const decoy = `\n/*\nconst fake = schemaValidator().ajv.compile(${literalReader});\n*/\n`;
  write(layoutEvidence,layoutInvocation.replaceAll(literalReader,'readJSON(chosenPath())') + decoy);
  const unbound = dependencies();
  assert.ok(!layoutRuntime(unbound));
  assert.ok(!hasSchema(unbound));
  assert.ok(findGap(unbound,'DYNAMIC_REFERENCE',{path:layoutEvidence}));
  write(layoutEvidence,`${layoutInvocation}\n${computedCompiler}`);
  const mixed = dependencies();
  assert.ok(layoutRuntime(mixed));
  assert.ok(hasSchema(mixed));
  assert.ok(findGap(mixed,'DYNAMIC_REFERENCE',{path:layoutEvidence}));
  write(layoutEvidence,layoutInvocation);

  write(validator,invocation.replace('= schemaValidator()', '= pickValidator(schemaValidator)()'));
  assert.ok(findGap(createImpactView({root,deps:[`file:${validator}`]}),'DYNAMIC_REFERENCE',{path:validator}));
  write(validator,invocation);

  for (const changed of [source.replace('node_modules/ajv','node_modules/unreviewed-validator'),
    source.replace("if (metadata.version !== '8.17.1')",'if (false)'),
    `${source}\nasync function anotherPackage(path) { return import(path); }`]) {
    write(library,changed);
    assert.ok(findGap(createImpactView({root,affected:[library]}),'DYNAMIC_REFERENCE',{path:library}));
  }
});

test('V4 impact keeps full rename bindings, reverse references, eligibility and gaps', t => {
  const { root, write, model } = fixture(t);
  const view = createImpactView({ root, affected: [searchPath, renamedPath, 'entry/unmapped.ets', 'tools/test-retired.mjs'] });
  assert.equal(view.status, 'NOT_RUN');
  for (const id of ids) assert.ok(view.direct.includes(`ui-case:${id}`));
  assert.ok(view.directMatches.find(item => item.path === renamedPath).matches.some(item => item.id === `ui-case:${ids[0]}`));
  assert.ok(view.directMatches.find(item => item.path === searchPath).matches.length > 6);
  assert.equal(view.directMatches.find(item => item.path === searchPath).disposition, 'REVIEW_MAPPING');
  assert.equal(view.directMatches.find(item => item.path === renamedPath).disposition, 'VERIFY_IF_NEEDED');
  assert.equal(view.directMatches.find(item => item.path === 'entry/unmapped.ets').disposition, 'UNKNOWN');
  assert.ok(view.references.includes('registration:bookshelf/invariants.B3'));
  assert.ok(view.references.includes('file:tools/ui-contract/coverage.mjs'));
  assert.ok(view.references.includes('file:tools/ui-contract/export-replay.mjs'));
  assert.ok(view.references.includes('file:tools/ui-contract/reassess-structure.mjs'));
  assert.ok(view.references.includes('file:tools/ui-contract/lib/receipt-structure.mjs'));
  assert.deepEqual(view.prerequisites.filter(id => id.startsWith('structure-rule:')), ['structure-rule:bookshelf', 'structure-rule:input']);
  assert.ok(findGap(view, 'UNMAPPED_PATH', { path: 'entry/unmapped.ets' }));
  assert.ok(findGap(view, 'CHANGED_PATH_ABSENT', { path: searchPath }));
  assert.equal(view.nodes.find(node => node.id === 'gate:H-legacy').entry, null);
  assert.equal(view.nodes.find(node => node.id === 'gate:H-retired').qualification, 'RETIRED');
  assert.ok(findGap(view, 'STALE_PATH_REFERENCE', { id: 'gate:H-legacy', path: 'tools/test-search.mjs' }));
  assert.ok(view.references.includes('gate:H-consumer'));
  assert.ok(view.relationships.some(edge => edge.consumer === 'gate:H-legacy' && edge.dependency === 'gate:H-legacy#scope'));
  assert.ok(findGap(view, 'UNRESOLVED_COVERAGE_REFERENCE', { id: 'gate:H-legacy', reason: 'Older free-form coverage note' }));
  assert.ok(view.relationships.every(edge => edge.dependency !== 'gate:undefined'));
  assert.ok(view.nodes.every(node => node.execution === 'NOT_RUN'));
  const broken = createImpactView({ root, deps: ['structure-rule:bad', 'ui-case:unknown'] });
  assert.ok(findGap(broken, 'STALE_ID_REFERENCE', { dependency: 'structure-rule:removed' }));
  assert.ok(findGap(broken, 'UNKNOWN_ID', { id: 'ui-case:unknown' }));
  const legacy = createImpactView({ root, deps: ['ui-case:bookshelf.search-input-ime'] });
  assert.equal(legacy.nodes.find(node => node.id === 'ui-case:bookshelf.search-input-ime').qualification, 'EXPLICIT_CASE');
  const register = createImpactView({ root, affected: ['tools/page-structure/receipt-evidence.mjs'] });
  assert.ok(register.references.includes('registration:bookshelf/invariants.B3'));
  assert.ok(register.references.includes('registered-page:bookshelf'));
  assert.deepEqual(register.nodes.filter(node => node.type === 'ui-case').map(node => node.id), [`ui-case:${ids[0]}`]);

  const shared = createImpactView({ root, affected: [layoutPath] });
  assert.deepEqual(shared.references.filter(id => id.startsWith('ui-case:')), ids.map(id => `ui-case:${id}`));
  assert.ok(findGap(shared, 'DYNAMIC_REFERENCE', { id: 'file:tools/ui-contract/lib/photo.mjs' }));
  assert.equal(shared.nodes.find(node => node.id === 'file:tools/ui-contract/lib/photo.mjs').disposition, 'UNKNOWN');
  assert.ok(shared.relationships.some(edge => edge.consumer === `file:${layoutPath}` &&
    edge.dependency === 'file:tools/ui-contract/lib/photo.mjs'));
  const structure = createImpactView({ root, affected: ['tools/ui-contract/lib/structure.mjs'] });
  assert.ok(structure.references.includes('structure-rule:bookshelf'));
  assert.ok(structure.prerequisites.includes('structure-rule:bookshelf'));
  const edge = structure.relationships.find(edge => edge.consumer === `scenario:${ids[0]}` && edge.role === 'opened');
  assert.deepEqual([edge.sampleId, edge.actionId], ['opened', null]);
  assert.throws(() => createImpactView({ root, affected: ['../external'] }), /repository-relative/u);

  const definition = model.scenarioObligations[0];
  definition.states.reused = 'input';
  definition.actions.stray = 'action';
  const path = localCase(ids[0]);
  const modifiedCase = JSON.parse(readFileSync(join(root, path), 'utf8'));
  modifiedCase.steps.push({ id: 'unbound', kind: 'sample' });
  modifiedCase.structure.reused = 'opened';
  modifiedCase.assertions[0].evaluator = 'never-registered';
  model.receiptAdmissions[0].routeContractRef = 'nav.stale';
  write(path, modifiedCase);
  write(modelFile, model);
  const brokenRoles = createImpactView({ root, deps: [`ui-case:${ids[0]}`] });
  assert.ok(findGap(brokenRoles, 'MISSING_OR_WRONG_ROLE_BINDING', { role: 'reused' }));
  assert.ok(findGap(brokenRoles, 'DUPLICATE_ROLE_SAMPLE', { role: 'reused' }));
  assert.ok(findGap(brokenRoles, 'UNMAPPED_FULL_SAMPLE', { sample: 'unbound' }));
  assert.ok(findGap(brokenRoles, 'UNDECLARED_ACTION_ROLE', { role: 'stray' }));
  const caseNode = brokenRoles.nodes.find(node => node.id === `ui-case:${ids[0]}`);
  assert.equal(caseNode.disposition, 'REVIEW_MAPPING');
  assert.ok(caseNode.dispositionReasons.includes('UNRESOLVED_EVALUATOR'));
  const registration = brokenRoles.nodes.find(node => node.id === 'registration:bookshelf/invariants.B3');
  assert.equal(registration.disposition, 'REVIEW_MAPPING');
  assert.deepEqual(registration.dispositionReasons, ['REGISTRATION_ROUTE_UNRESOLVED']);

  const orphan = model.scenarioObligations.pop();
  write(modelFile, model);
  const missingObligation = createImpactView({ root, deps: [`ui-case:${orphan.caseId}`] });
  const orphanedCase = missingObligation.nodes.find(node => node.id === `ui-case:${orphan.caseId}`);
  assert.equal(orphanedCase.disposition, 'REVIEW_MAPPING');
  assert.ok(orphanedCase.dispositionReasons.includes('SCENARIO_OBLIGATION_UNMAPPED'));
});

test('V4 impact traces declared fixture and exact local checks without execution', t => {
  const { root, write } = fixture(t);
  const mapping = 'tools/ui-contract-impact-bindings.json';
  const fixturePath = 'tools/ui-contract/fixtures/Public Source.json';
  const publicBook = 'tools/ui-contract/fixtures/public-books/移窗样本 01.txt';
  const packagedBook = 'entry/src/main/resources/rawfile/reader-public-fixture-scroll-book-01-v1.txt';
  const privateRawfile = 'entry/src/main/resources/rawfile/ordinary-book.txt';
  const testPath = 'tools/ui-contract/test/source.test.mjs';
  const name = 'local [row] with an exact test name';
  const id = 'ui-case:' + ids[0];
  const checkId = 'ui-local-check:' + testPath + '#' + name;
  const support = { fixtures:[fixturePath,publicBook,packagedBook], checks:[{path:testPath, name}] };
  write(mapping, {schemaVersion:1,cases:{[ids[0]]:support}});
  write(fixturePath, [{enabled:false}]);
  write(publicBook, '移窗样本\n本地公开测试正文');
  write(packagedBook, '移窗样本\n随应用打包的同一份公开正文');
  write(privateRawfile, '普通资源');
  write(testPath, "import test from 'node:test';\ntest('" + name + "', () => {});\nthrow new Error('index executed a local check');\n");
  const usage = createImpactView({root,affected:[fixturePath,testPath]});
  assert.equal(usage.status, 'NOT_RUN');
  assert.ok(usage.references.includes(id));
  assert.ok(usage.prerequisites.includes('structure-rule:bookshelf'));
  assert.ok(usage.relationships.some(edge => edge.consumer === id && edge.dependency === 'file:' + fixturePath &&
    edge.kind === 'fixture-input'));
  const check = usage.nodes.find(node => node.id === checkId);
  assert.equal(check.qualification, 'LOOKUP_ONLY');
  assert.equal(check.entry, "node --test --test-name-pattern '^local \\[row\\] with an exact test name$' " + testPath);
  const deps = createImpactView({root,deps:[id]});
  assert.ok(deps.nodes.some(node => node.id === checkId));
  assert.ok(deps.nodes.some(node => node.id === 'file:' + fixturePath));
  assert.ok(deps.nodes.some(node => node.id === 'file:' + publicBook));
  assert.ok(deps.nodes.some(node => node.id === 'file:' + packagedBook));
  const bookChange = createImpactView({root,affected:[publicBook,packagedBook]});
  assert.ok(bookChange.references.includes(id));
  assert.equal(bookChange.nodes.find(node => node.id === 'file:' + publicBook).type,'fixture-input');
  assert.equal(bookChange.nodes.find(node => node.id === 'file:' + packagedBook).type,'fixture-input');
  assert.ok(bookChange.relationships.some(edge => edge.consumer === id &&
    edge.dependency === 'file:' + packagedBook && edge.kind === 'fixture-input'));
  assert.ok(!deps.prerequisites.includes(checkId));
  assert.ok(deps.relationships.some(edge => edge.consumer === id && edge.dependency === checkId &&
    edge.kind === 'supporting-check'));

  write(fixturePath, [{enabled:true}]);
  const diff = diffImpactViews(usage, createImpactView({root,affected:[fixturePath,testPath]}));
  assert.ok(diff.changedDefinitions.includes('file:' + fixturePath));
  assert.ok(diff.referencesToChangedDefinitions.includes(id));

  const commented = "test('" + name + "', () => {});";
  write(testPath, "import test from 'node:test';\n/*\n" + commented + "\n*/\nconst text = `\n" + commented + "\n`;");
  write(mapping, {schemaVersion:1,cases:{
    [ids[0]]:{...support, fixtures:[fixturePath,privateRawfile,'tools/ui-contract/fixtures/Missing.json','../private.json',
      'tools/ui-contract/fixtures/public-books/../private.txt']},
    'source-management.missing':support,
  }});
  const missing = createImpactView({root,affected:[mapping]});
  assert.equal(missing.nodes.find(node => node.id === checkId).entry, null);
  assert.ok(findGap(missing, 'UNRESOLVED_LOCAL_CHECK', {id:checkId}));
  assert.ok(findGap(missing, 'STALE_PATH_REFERENCE', {path:'tools/ui-contract/fixtures/Missing.json'}));
  assert.ok(findGap(missing, 'INVALID_LOCAL_SUPPORT', {fixturePath:privateRawfile}));
  assert.ok(!missing.nodes.some(node => node.id === 'file:' + privateRawfile));
  assert.ok(findGap(missing, 'INVALID_LOCAL_SUPPORT'));
  assert.ok(findGap(missing, 'UNRESOLVED_LOCAL_SUPPORT_CASE', {id:'ui-case:source-management.missing'}));
  assert.ok(missing.nodes.every(node => node.execution === 'NOT_RUN'));
  write(mapping, '{');
  assert.ok(findGap(createImpactView({root,deps:[id]}), 'INVALID_DEFINITION', {path:mapping}));
  write(mapping, {schemaVersion:2,cases:{}});
  assert.ok(findGap(createImpactView({root,deps:[id]}), 'INVALID_LOCAL_SUPPORT', {path:mapping}));
  rmSync(join(root,mapping));
  assert.equal(createImpactView({root,deps:[id]}).completeKnownRelations, false);
  assert.ok(findGap(createImpactView({root,deps:[id]}), 'MISSING_DEFINITION', {path:mapping}));
});

test('V4 impact traces exact contract case selections without executing their runner', t => {
  const {root,write} = fixture(t);
  const mapping = 'tools/ui-contract-impact-bindings.json';
  const path = 'tools/test-font-prepared.mjs';
  const runner = 'tools/lib/contract-case-selection.mjs';
  const name = 'font-reorder-delayed-prepared-display';
  const checkId = `ui-local-contract-case:${path}#${name}`;
  const caseNode = 'ui-case:' + ids[0];
  const row = `  ['${name}', 'Actual source contract description.'],\n`;
  const trustedImport = "import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';\n";
  const writeRunner = (rows, prefix = trustedImport, selection = 'selectContractCases(definitions)') => write(path,
    prefix + 'const definitions = Object.fromEntries([\n' + rows +
      '].map(([id, description]) => [id, { description, resources: [] }]));\n' +
      `const selected = ${selection};\nthrow new Error('Index executed a package or case');\n`);
  const runnerSource = readFileSync(new URL('../../lib/contract-case-selection.mjs',import.meta.url),'utf8');
  write(runner, runnerSource + "\nthrow new Error('Index executed the canonical case selector');");
  write(mapping,{schemaVersion:1,cases:{[ids[0]]:{contractCases:[{path,name}]}}});
  writeRunner(row + "  ['another-static-case', \"A different description.\"],\n");
  const fromCase = createImpactView({root,deps:[caseNode]});
  const fromPath = createImpactView({root,affected:[path]});
  const local = fromCase.nodes.find(node => node.id === checkId);
  assert.equal(local?.entry,`node ${path} --case ${name}`);
  assert.equal(local.qualification,'LOOKUP_ONLY');
  assert.equal(local.execution,'NOT_RUN');
  assert.ok(fromPath.references.includes(caseNode));
  assert.ok(fromCase.relationships.some(edge =>
    edge.consumer === caseNode && edge.dependency === checkId && edge.kind === 'supporting-check'));
  assert.ok(!fromCase.prerequisites.includes(checkId));
  const fromHelper = createImpactView({root,affected:[runner]});
  assert.ok(fromHelper.references.includes(caseNode));

  for (const variant of [
    () => writeRunner(row + row),
    () => writeRunner(row.replace(',\n','\n') + "  ['indexed', 'Instead of a separate entry'],\n"),
    () => writeRunner(row + '  ...descriptions(),\n'),
    () => writeRunner(row,trustedImport,'selectContractCases({...definitions})'),
    () => writeRunner(row,trustedImport.replace('contract-case-selection.mjs','arbitrary-case-selection.mjs')),
    () => writeRunner('  /* ' + row + '  */\n'),
    () => write(path,"const preview = `\n" + trustedImport + 'const definitions = Object.fromEntries([\n' + row +
      '].map(([id, description]) => [id, { description, resources: [] }]));\n' +
      'const selected = selectContractCases(definitions);\n`;\n'),
  ]) {
    variant();
    const invalid = createImpactView({root,deps:[caseNode]});
    assert.equal(invalid.nodes.find(node=>node.id===checkId)?.entry,null);
    assert.ok(findGap(invalid,'UNRESOLVED_LOCAL_CONTRACT_CASE',{id:checkId}));
  }
  writeRunner(row);
  write(runner,'export function selectContractCases() { return []; }');
  const replaced = createImpactView({root,deps:[caseNode]});
  assert.equal(replaced.nodes.find(node=>node.id===checkId)?.entry,null);
  assert.ok(findGap(replaced,'UNRESOLVED_LOCAL_CONTRACT_CASE',{id:checkId}));
  write(runner,runnerSource);
  write(mapping,{schemaVersion:1,cases:{[ids[0]]:{contractCases:[
    {path:'tools/../test-font-prepared.mjs',name},
    {path:'tools/test-missing.mjs',name},
    {path,name:'font; arbitrary'},
  ]}}});
  const invalidBindings = createImpactView({root,deps:[caseNode]});
  assert.ok(findGap(invalidBindings,'INVALID_LOCAL_SUPPORT'));
  assert.ok(findGap(invalidBindings,'STALE_PATH_REFERENCE',{path:'tools/test-missing.mjs'}));
  assert.ok(invalidBindings.nodes.every(node=>node.execution==='NOT_RUN'));
});

test('V7 impact diff propagates one model change and exposes removed dependencies and cases', t => {
  const { root, write, model } = fixture(t);
  const narrow = { root, deps: ['structure-rule:input'] };
  const query = { root, affected: ['tools/ui-contract/lib/structure.mjs'] };
  model.structureSelectors.base = { ids: ['base-content'] };
  model.structureRules = model.structureRules.filter(rule => rule.id !== 'bad').map(rule => ({
    ...rule, basis: 'Product structure',
    checks: rule.checks.length ? rule.checks : [{ kind: 'present', node: 'base' }],
  }));
  model.structureRules[2].id = 'reading:independent';
  model.scenarioObligations.at(-1).states.shown = 'reading:independent';
  write(modelFile, model);
  const selected = { root, deps: [`ui-case:${ids[0]}`, `scenario:${ids[0]}`], checkDeps: true };
  const checked = createImpactView(selected);
  assert.equal(checked.status, 'NOT_RUN');
  assert.equal(checked.dependencyCheck.status, 'PASS');
  assert.deepEqual(checked.dependencyCheck.scope.cases, [ids[0]]);
  assert.ok(checked.relationships.some(edge => edge.consumer === `ui-case:${ids[0]}` &&
    edge.dependency === 'structure-rule:input' && edge.scope === 'scenario-full-sample' &&
    edge.role === 'opened' && edge.sampleId === 'opened' && edge.actionId === null));
  assert.ok(checked.relationships.some(edge => edge.consumer === 'structure-rule:input' &&
    edge.dependency === 'structure-rule:bookshelf' && edge.kind === 'required' && edge.scope === 'same-full-sample'));
  const check = (id = narrow.deps[0]) => createImpactView({ root, deps: [id], checkDeps: true }).dependencyCheck;
  assert.equal(check('structure-rule:reading:independent').status, 'PASS');
  assert.equal(check('input').status, 'FAIL');
  assert.equal(check('structure-rule:removed').status, 'FAIL');
  assert.throws(() => createImpactView({ ...query, checkDeps: true }), /requires at least one --deps/u);

  const path = localCase(ids[0]);
  const contract = JSON.parse(readFileSync(join(root, path), 'utf8'));
  const {version, ...withoutVersion} = contract;
  write(path, withoutVersion);
  const missingVersion = createImpactView(selected).dependencyCheck;
  assert.equal(missingVersion.status, 'FAIL');
  assert.match(missingVersion.errors[0].reason, /positive case version/u);
  const endpoint = { id: 'search.retry.endpoint', evaluator: 'layout', required:false,
    condition:'Retry settled', sample:'opened' };
  const conditional = { ...contract, assertions: [endpoint] };
  model.scenarioObligations[0].conditionalEndpoints = { opened:{ version, assertion:endpoint.id } };
  write(modelFile, model);
  write(path, conditional);
  const endpointView = createImpactView(selected);
  assert.equal(endpointView.dependencyCheck.status, 'PASS');
  assert.ok(endpointView.relationships.some(edge => edge.consumer === `ui-case:${ids[0]}` &&
    edge.kind === 'condition-applicability' && edge.conditionalEndpoint && edge.assertionId === endpoint.id));
  write(path, { ...conditional, version: version + 1 });
  const mismatchedVersion = createImpactView(selected);
  assert.equal(mismatchedVersion.dependencyCheck.status, 'PASS');
  assert.ok(!mismatchedVersion.relationships.some(edge => edge.assertionId === endpoint.id));
  delete model.scenarioObligations[0].conditionalEndpoints;
  const postAction = { ...contract, steps: [
    { kind: 'action', id: 'open-search' }, { kind: 'sample', id: 'opened', afterAction: 'open-search' },
  ] };
  model.scenarioObligations[0].actions.opened = 'open-search';
  write(modelFile, model);
  write(path, postAction);
  const actionView = createImpactView(selected);
  assert.equal(actionView.dependencyCheck.status, 'PASS');
  assert.ok(actionView.relationships.some(edge => edge.consumer === `scenario:${ids[0]}` &&
    edge.scope === 'scenario-full-sample' && edge.sampleId === 'opened' && edge.actionId === 'open-search'));
  for (const steps of [postAction.steps.slice(1), [...postAction.steps].reverse()]) {
    write(path, { ...postAction, steps });
    const result = createImpactView(selected).dependencyCheck;
    assert.equal(result.status, 'FAIL');
    assert.ok(result.errors.some(error => error.kind === 'MISSING_OR_WRONG_ROLE_BINDING'));
  }
  assert.equal(check().status, 'PASS', 'a rule-only check does not validate reverse-reference case samples');
  model.scenarioObligations[0].actions.opened = null;
  write(path, contract);
  model.structureRules[1].requires = ['removed'];
  write(modelFile, model);
  assert.match(check().errors[0].reason, /unknown necessary rule removed/u);
  model.structureRules[1].requires = ['bookshelf'];
  write(modelFile, model);

  const narrowBefore = createImpactView(narrow);
  assert.deepEqual(narrowBefore.dependencyCheck, { status: 'NOT_RUN' });
  assert.ok(narrowBefore.references.includes('file:tools/ui-contract/cli.mjs'));
  assert.ok(!narrowBefore.nodes.some(node => node.id === 'ui-case:reading.independent'));
  const before = createImpactView(query);
  assert.ok(before.nodes.some(node => node.id === 'ui-case:reading.independent'));
  const catalog = readFileSync(join(root, 'tools/gate-index.json'), 'utf8');
  model.structureRules[1] = { ...model.structureRules[1], requires: [], basis: ['updated product reference'] };
  write(modelFile, model);
  const after = createImpactView(query);
  const diff = diffImpactViews(before, after);
  assert.deepEqual(diff.changedDefinitions, ['structure-rule:input']);
  assert.ok(ids.every(id => diff.referencesToChangedDefinitions.includes(`ui-case:${id}`)));
  assert.ok(diff.referencesToChangedDefinitions.includes('registration:bookshelf/invariants.B3'));
  assert.ok(diff.referencesToChangedDefinitions.includes('file:tools/ui-contract/cli.mjs'));
  assert.ok(!diff.referencesToChangedDefinitions.includes('ui-case:reading.independent'));
  assert.ok(diff.removedRelationships.some(edge => edge.consumer === 'structure-rule:input' &&
    edge.dependency === 'structure-rule:bookshelf' && edge.kind === 'required'));
  assert.ok(after.relationships.some(edge => edge.consumer === 'structure-rule:input' &&
    edge.dependency === 'structure-rule:bookshelf' && edge.kind === 'required-foundation'));
  assert.ok(findGap(after, 'FOUNDATION_NOT_IN_REQUIRED_CLOSURE', { id: 'structure-rule:input', dependency: 'structure-rule:bookshelf' }));
  assert.equal(readFileSync(join(root, 'tools/gate-index.json'), 'utf8'), catalog);
  assert.ok(after.nodes.every(node => node.execution === 'NOT_RUN'));

  model.structureSelectors.searchInput.ids = ['reader-refactored-search-input'];
  write(modelFile, model);
  const remapped = diffImpactViews(after, createImpactView(query));
  assert.deepEqual(remapped.changedDefinitions, ['structure-selector:searchInput']);
  assert.ok(remapped.referencesToChangedDefinitions.includes('structure-rule:input'));
  assert.ok(ids.every(id => remapped.referencesToChangedDefinitions.includes(`ui-case:${id}`)));
  assert.ok(!remapped.referencesToChangedDefinitions.includes('ui-case:reading.independent'));

  rmSync(join(root, localCase(ids[0])));
  const withoutCase = createImpactView(query);
  assert.ok(findGap(withoutCase, 'MISSING_REGISTERED_CASE', { id: `ui-case:${ids[0]}` }));
  assert.ok(withoutCase.references.includes(`scenario:${ids[0]}`));
  assert.ok(withoutCase.references.includes('file:tools/ui-contract/coverage.mjs'));
  assert.equal(withoutCase.nodes.find(node => node.id === `ui-case:${ids[0]}`).type, 'missing-definition');
  assert.ok(createImpactView(selected).dependencyCheck.errors.some(error => error.id === `ui-case:${ids[0]}` &&
    /existing registered case/u.test(error.reason)));

  model.structureRules[1].basis = 'Product structure';
  model.structureRules[1].requires = ['bookshelf'];
  model.structureRules[0].requires = ['input'];
  write(modelFile, model);
  assert.ok(findGap(createImpactView(query), 'REQUIRED_DEPENDENCY_CYCLE'));
  assert.match(check().errors[0].reason, /circular necessary dependency/u);
});

test('source read impact exposes condition bindings, gaps and relationship changes', t => {
  const { root, write, model } = fixture(t);
  const caseName = 'source-management.read-loading';
  const id = `ui-case:${caseName}`;
  const role = 'source-read';
  const assertionId = 'source.load.loading';
  const sampleId = 'opening';
  const actionId = 'open-sources';
  const obligation = { caseId: caseName, states: { [role]: 'input' }, actions: { [role]: actionId },
    conditions: { [role]: assertionId } };
  const assertion = { id: assertionId, evaluator: 'source', kind: 'read-surface', required: false,
    condition: 'This source opening reports loading', sample: sampleId, action: actionId,
    expected: { state: 'loading' } };
  const contract = { id: caseName, phase: 1, version: 1, pageId: 'source-management', structure: { [role]: sampleId },
    steps: [{ id: actionId, kind: 'action' }, { id: sampleId, kind: 'sample', afterAction: actionId }],
    assertions: [assertion] };
  model.scenarioObligations.push(obligation);
  write('tools/ui-contract/cases/phase-1.registry.json', [...ids, 'reading.independent', caseName]);
  write('tools/ui-contract/lib/source.mjs', 'throw new Error("the index must not execute case code");');
  const query = { root, deps: [id] };
  const update = () => {
    write(modelFile, model);
    write(localCase(caseName), contract);
    return createImpactView(query);
  };
  const conditionEdges = relationships => relationships.filter(edge => edge.kind === 'condition-applicability');
  const before = update();
  assert.equal(before.completeKnownRelations, true);
  assert.ok(before.prerequisites.includes('structure-rule:bookshelf'));
  assert.ok(before.references.includes('file:tools/ui-contract/reassess-structure.mjs'));
  assert.deepEqual(conditionEdges(before.relationships).map(edge => ({
    consumer: edge.consumer, dependency: edge.dependency, role: edge.role,
    assertionId: edge.assertionId, sampleId: edge.sampleId, actionId: edge.actionId,
  })), [`scenario:${caseName}`, id].map(consumer => ({
    consumer, dependency: 'structure-rule:input', role, assertionId, sampleId, actionId,
  })));

  delete obligation.conditions;
  const missing = update();
  assert.ok(findGap(missing, 'MISSING_CONDITION_BINDING', { id, assertionId, sample: sampleId, expectedAction: actionId }));
  assert.equal(missing.nodes.find(node => node.id === id).disposition, 'REVIEW_MAPPING');
  assert.equal(conditionEdges(missing.relationships).length, 0);
  assert.ok(missing.prerequisites.includes('structure-rule:bookshelf'));

  obligation.conditions = [];
  assert.ok(findGap(update(), 'INVALID_CONDITION_MAP', { id }));
  obligation.conditions = {};
  assert.ok(findGap(update(), 'INVALID_CONDITION_MAP', { id }));
  obligation.conditions = { [role]: assertionId, duplicate: assertionId };
  assert.ok(findGap(update(), 'INVALID_CONDITION_MAP', { id }));
  obligation.conditions = { stray: assertionId };
  assert.ok(findGap(update(), 'UNDECLARED_CONDITION_ROLE', { id, role: 'stray' }));
  obligation.conditions = { [role]: 42 };
  assert.ok(findGap(update(), 'INVALID_CONDITION_ASSERTION_ID', { id, role }));
  obligation.conditions = { [role]: 'source.load.unknown' };
  assert.ok(findGap(update(), 'UNRESOLVED_CONDITION_BINDING', { id, role, assertionId: 'source.load.unknown' }));

  obligation.conditions = { [role]: assertionId };
  for (const wrong of [{ sample: 'different-sample' }, { action: 'different-action' }, { required: true }, { condition: '' }]) {
    contract.assertions = [{ ...assertion, ...wrong }];
    const invalid = update();
    assert.ok(findGap(invalid, 'UNRESOLVED_CONDITION_BINDING', { id, role, assertionId }));
    assert.equal(conditionEdges(invalid.relationships).length, 0);
  }

  const updatedId = 'source.load.visible';
  contract.assertions = [{ ...assertion, id: updatedId }];
  obligation.conditions[role] = updatedId;
  const diff = diffImpactViews(before, update());
  assert.deepEqual(conditionEdges(diff.removedRelationships).map(edge => edge.assertionId), [assertionId, assertionId]);
  assert.deepEqual(conditionEdges(diff.addedRelationships).map(edge => edge.assertionId), [updatedId, updatedId]);
});

test('impact index maps its own entry and keeps unresolved input gaps', t => {
  const { root, write } = fixture(t);
  const entry = 'tools/gate-index-impact.mjs';
  const reader = 'tools/lib/gate-index-impact.mjs';
  const outside = 'sdk/external-input.mjs';
  const importOutside = "import '../../sdk/external-input.mjs';";
  const readerSource = readFileSync(new URL('../../lib/gate-index-impact.mjs', import.meta.url), 'utf8');
  write(entry, "import { createImpactView } from './lib/gate-index-impact.mjs';\nthrow new Error('no execution');");
  write(reader, `${importOutside}\n${readerSource}`);
  write('tools/ui-contract/lib/capsule-model-inputs.mjs', 'throw new Error("no execution");');
  write(outside, "await import('./sdk-internals.mjs');");
  write('sdk/sdk-internals.mjs', 'export const sdk = true;');
  const query = { root, affected: [reader] };
  const indexed = createImpactView(query);
  assert.deepEqual(indexed.direct, [`file:${reader}`]);
  assert.ok(indexed.references.includes(`file:${entry}`));
  assert.ok(indexed.relationships.some(edge => edge.consumer === `file:${entry}` &&
    edge.dependency === `file:${reader}` && edge.kind === 'implementation-use'));
  assert.equal(indexed.nodes.find(node => node.id === `file:${entry}`).entry, `node ${entry} --affected <path>`);
  assert.ok(!findGap(indexed, 'UNMAPPED_PATH', { path: reader }));
  assert.ok(!findGap(indexed, 'DYNAMIC_REFERENCE', { path: reader }));
  assert.ok(indexed.nodes.some(node => node.id === `file:${outside}`));
  assert.ok(!indexed.nodes.some(node => node.id === 'file:sdk/sdk-internals.mjs'));

  write(reader, `${importOutside}\n${readerSource}\nawait import(selectedPath());`);
  assert.ok(findGap(createImpactView(query), 'DYNAMIC_REFERENCE', { id: `file:${reader}`, path: reader }));
});

test('V4 impact distinguishes scoped reading assertions from shared module loading', t => {
  const { root, write } = fixture(t);
  const motion = 'tools/ui-contract/lib/motion.mjs';
  const effects = 'tools/ui-contract/lib/control-effects.mjs';
  const capsule = 'tools/ui-contract/lib/control-capsule.mjs';
  const handoff = 'tools/ui-contract/lib/control-capsule-handoff.mjs';
  const controlInput = 'tools/ui-contract/lib/control-input.mjs';
  const receipt = 'tools/ui-contract/lib/receipt.mjs';
  const declarationPath = 'tools/ui-contract/lib/capsule-model-inputs.json';
  const readerPath = 'tools/ui-contract/lib/capsule-model-inputs.mjs';
  const casesPath = 'tools/ui-contract/lib/cases.mjs';
  const exporter = 'tools/ui-contract/export-replay.mjs';
  const replayLock = 'tools/ui-contract/package-lock.json';
  const coverage = 'tools/ui-contract/coverage.mjs';
  const reseal = 'tools/ui-contract/reseal.mjs';
  const currentSource = file => readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
  const declaration = JSON.parse(currentSource(declarationPath));
  const [support] = declaration.support;
  for (const file of [motion, effects, capsule, handoff, controlInput, receipt, declarationPath, readerPath, casesPath, exporter, replayLock, coverage, reseal,
    declaration.presentation, declaration.timeline, declaration.controller, ...declaration.support,
    localCase('reading.control-open-motion')]) write(file, currentSource(file));
  const initialRegistry = 'tools/ui-contract/cases/phase-0.registry.json';
  write(initialRegistry, currentSource(initialRegistry));
  write('tools/ui-contract/cli.mjs', "import './lib/receipt.mjs';\nthrow new Error('must not execute');");
  const registry = 'tools/ui-contract/cases/phase-1.registry.json';
  const auto = 'reading.auto';
  const interrupted = 'reading.interrupted';
  const interruptedSpeech = 'reading.interrupted-speech';
  const speech = 'reading.speech';
  const popup = 'reading.popup';
  const transition = 'reading.transition';
  write(registry, [...ids, 'reading.independent', auto, interrupted, interruptedSpeech, speech, popup, transition]);
  function reading(id, kind, expected, conditional = false) {
    return { id, phase:1, pageId:'reading', steps:[],
      assertions:[{ id:'action', evaluator:'motion', kind, expected, required:!conditional,
        ...(conditional ? {condition:'System speech engine starts'} : {}) }] };
  }
  write(localCase(auto), reading(auto, 'control-effect', {effect:'capsule-launch',type:'autoPage'}));
  write(localCase(interrupted), reading(interrupted, 'control-effect',
    {effect:'capsule-launch',type:'autoPage',op:'clickThenReaderCenter'}));
  write(localCase(interruptedSpeech), reading(interruptedSpeech, 'control-effect',
    {effect:'capsule-launch',type:'tts',op:'clickThenReaderCenter',requiresSystemSpeech:true}, true));
  write(localCase(speech), reading(speech, 'control-effect', {effect:'capsule-launch',type:'tts'}, true));
  write(localCase(popup), reading(popup, 'control-effect', {effect:'more-popup'}));
  write(localCase(transition), reading(transition, 'control-transition', {}));
  const query = { root, affected:[capsule] };
  const caseRefs = view => view.references.filter(id => id.startsWith('ui-case:'));
  const narrow = createImpactView(query);
  const capsuleCases = [auto,interrupted,interruptedSpeech,speech].map(id => `ui-case:${id}`);
  assert.deepEqual(caseRefs(narrow), capsuleCases);
  for (const file of [receipt, motion, effects, 'tools/ui-contract/cli.mjs', 'tools/ui-contract/coverage.mjs',
    'tools/ui-contract/export-replay.mjs']) assert.ok(narrow.references.includes(`file:${file}`));
  assert.ok(narrow.relationships.some(edge => edge.consumer === `file:${receipt}` &&
    edge.dependency === `file:${capsule}` && edge.kind === 'scoped-module-use'));
  assert.ok(narrow.relationships.some(edge => edge.consumer === `ui-case:${speech}` &&
    edge.dependency === `file:${capsule}` && edge.reason === 'conditional system speech dispatch for action'));
  assert.deepEqual(caseRefs(createImpactView({ root, affected:[effects] })),
    [auto,interrupted,interruptedSpeech,popup,speech].map(id => `ui-case:${id}`));
  const handoffOnly = createImpactView({root,affected:[handoff]});
  assert.deepEqual(caseRefs(handoffOnly), [interrupted,interruptedSpeech].map(id => `ui-case:${id}`));
  assert.ok(!findGap(handoffOnly,'UNVERIFIED_SCOPED_DISPATCH',{path:effects}));
  const common = createImpactView({ root, affected:[capsule,receipt] });
  assert.ok(caseRefs(common).includes(`ui-case:${ids[0]}`));

  assert.ok(!findGap(narrow, 'DYNAMIC_REFERENCE', { path:capsule }));
  const modelImpact = path => createImpactView({ root, affected:[path] });
  for (const path of [declarationPath, support]) {
    const view = modelImpact(path);
    assert.deepEqual(caseRefs(view), capsuleCases);
    assert.ok(view.references.includes(`file:${exporter}`));
    assert.ok(view.relationships.some(edge => edge.consumer === `file:${casesPath}` &&
      edge.dependency === `file:${path}` && edge.kind === 'replay-tool-input'));
  }
  const lockView = modelImpact(replayLock);
  assert.equal(lockView.status, 'NOT_RUN');
  assert.deepEqual(caseRefs(lockView), []);
  for (const file of [casesPath, receipt, exporter, coverage, reseal, 'tools/ui-contract/cli.mjs']) {
    assert.ok(lockView.references.includes(`file:${file}`));
  }
  const lockEdge = edge => edge.consumer === `file:${casesPath}` &&
    edge.dependency === `file:${replayLock}` && edge.kind === 'replay-tool-input';
  assert.ok(lockView.relationships.some(lockEdge));
  assert.ok(!findGap(lockView, 'DYNAMIC_REFERENCE', { path:casesPath }));
  const exportDeps = createImpactView({ root, deps:[`file:${exporter}`] });
  assert.ok(exportDeps.relationships.some(lockEdge));

  write(replayLock, `${currentSource(replayLock)}\n`);
  const lockChange = diffImpactViews(lockView, modelImpact(replayLock));
  assert.deepEqual(lockChange.changedDefinitions, [`file:${replayLock}`]);
  assert.ok(lockChange.referencesToChangedDefinitions.includes(`file:${exporter}`));
  rmSync(join(root, replayLock));
  const missingLock = modelImpact(replayLock);
  assert.ok(findGap(missingLock, 'MISSING_DEFINITION', { path:replayLock }));
  assert.ok(missingLock.relationships.some(lockEdge));
  write(replayLock, currentSource(replayLock));

  const casesSource = currentSource(casesPath);
  write(casesPath, `${casesSource}\nconst extraUrl = new URL('package-lock.json', root);`);
  const extraUrl = modelImpact(replayLock);
  assert.ok(findGap(extraUrl, 'DYNAMIC_REFERENCE', { path:casesPath }));
  assert.ok(extraUrl.relationships.some(lockEdge));
  write(casesPath, casesSource.replace('replayToolFiles(root = toolRoot)', 'replayToolFiles(root = otherRoot)'));
  const driftedRoot = modelImpact(casesPath);
  assert.ok(findGap(driftedRoot, 'DYNAMIC_REFERENCE', { path:casesPath }));
  assert.ok(!driftedRoot.relationships.some(lockEdge));
  write(casesPath, casesSource);

  assert.ok(narrow.relationships.some(edge => edge.consumer === `file:${declaration.presentation}` &&
    edge.dependency === `file:${support}` && edge.kind === 'model-input'));
  assert.ok(!findGap(narrow, 'UNDECLARED_CAPSULE_MODEL_IMPORT'));

  const extra = join(dirname(support), 'UnpinnedMotion.ts');
  write(extra, 'export const sample = 1;');
  write(support, `${currentSource(support)}\nimport './UnpinnedMotion.ts';`);
  const unpinned = modelImpact(extra);
  assert.deepEqual(caseRefs(unpinned), capsuleCases);
  assert.ok(findGap(unpinned, 'UNDECLARED_CAPSULE_MODEL_IMPORT', { path:support, dependency:`file:${extra}` }));
  assert.ok(!unpinned.relationships.some(edge => edge.dependency === `file:${extra}` && edge.kind === 'replay-tool-input'));

  rmSync(join(root,support));
  const missingInput = modelImpact(support);
  assert.deepEqual(caseRefs(missingInput), capsuleCases);
  assert.ok(findGap(missingInput, 'MISSING_CAPSULE_MODEL_INPUT', { path:support }));
  write(support, currentSource(support));

  write(declarationPath, { ...declaration, support:[null] });
  assert.ok(findGap(modelImpact(declarationPath), 'INVALID_CAPSULE_MODEL_INPUTS', { path:declarationPath }));
  write(declarationPath, declaration);

  write(capsule, `${currentSource(capsule)}\nconst otherModel = path => require(path);`);
  assert.ok(findGap(createImpactView(query), 'DYNAMIC_REFERENCE', { path:capsule }));
  write(capsule, `${currentSource(capsule)}\n// A change within the capsule evaluator.`);
  write(declarationPath, currentSource(declarationPath));
  const revised = createImpactView(query);
  const implementationDiff = diffImpactViews(narrow, revised);
  assert.deepEqual(implementationDiff.changedDefinitions, [`file:${capsule}`]);
  assert.deepEqual(implementationDiff.referencesToChangedDefinitions.filter(id => id.startsWith('ui-case:')),
    capsuleCases);
  write(localCase(auto), reading(auto, 'control-effect', {effect:'more-popup'}));
  const definitionDiff = diffImpactViews(revised, createImpactView(query));
  assert.ok(definitionDiff.removedRelationships.some(edge => edge.consumer === `ui-case:${auto}` &&
    edge.dependency === `file:${capsule}`));
  assert.ok(definitionDiff.removedNodes.includes(`ui-case:${auto}`));

  rmSync(join(root, localCase(speech)));
  const missing = createImpactView(query);
  assert.ok(findGap(missing, 'MISSING_REGISTERED_CASE', { id:`ui-case:${speech}` }));
  assert.equal(missing.nodes.find(node => node.id === `ui-case:${speech}`).disposition, 'UNKNOWN');
  write(localCase(speech), { ...reading(speech, 'control-effect', {effect:'capsule-launch'}, true), assertions:{} });
  const invalid = createImpactView(query);
  assert.ok(findGap(invalid, 'INVALID_CASE_DISPATCH_INPUT', { id:`ui-case:${speech}` }));
  assert.equal(invalid.nodes.find(node => node.id === `ui-case:${speech}`).disposition, 'UNKNOWN');
  write(localCase(speech), reading(speech, 'control-effect', {effect:'capsule-launch',type:'tts'}, true));

  write(capsule, currentSource(capsule).replace(" || expected.type !== 'tts') return null;", ') return null;'));
  const broadenedGuard = createImpactView(query);
  assert.ok(findGap(broadenedGuard, 'UNVERIFIED_SCOPED_DISPATCH', { id:`file:${capsule}`, path:receipt }));
  assert.ok(caseRefs(broadenedGuard).includes(`ui-case:${ids[0]}`));
  write(capsule, currentSource(capsule));

  write(motion, currentSource(motion).replace("if (assertion.kind === 'control-effect') return evaluateControlEffect",
    'if (hasControlEffect(assertion)) return evaluateControlEffect'));
  const outerDrift = createImpactView(query);
  assert.ok(findGap(outerDrift, 'UNVERIFIED_SCOPED_DISPATCH', { id:`file:${capsule}`, path:effects }));
  assert.ok(caseRefs(outerDrift).includes(`ui-case:${transition}`));
  write(motion, currentSource(motion));

  write(receipt, currentSource(receipt).replace('systemSpeechApplicability(assertion, context, contract)',
    'systemSpeechApplicability(speechAssertion(assertion), context, contract)'));
  const drifted = createImpactView(query);
  assert.ok(findGap(drifted, 'UNVERIFIED_SCOPED_DISPATCH', { id:`file:${capsule}`, path:receipt }));
  assert.ok(caseRefs(drifted).includes(`ui-case:${ids[0]}`));
  assert.ok(drifted.relationships.some(edge => edge.consumer === `file:${receipt}` &&
    edge.dependency === `file:${capsule}` && edge.kind === 'implementation-use'));
  rmSync(join(root,capsule));
  const absentModule = createImpactView(query);
  assert.ok(findGap(absentModule, 'CHANGED_PATH_ABSENT', { path:capsule }));
  assert.ok(findGap(absentModule, 'UNVERIFIED_SCOPED_DISPATCH', { id:`file:${capsule}`, path:effects }));
  assert.ok(caseRefs(absentModule).includes(`ui-case:${speech}`));
});

test('impact recognizes local literal object contracts wired to the actual case loop', t => {
  const { root, write } = fixture(t);
  const path = 'tools/test-object-selection.mjs';
  const runner = 'tools/lib/contract-case-selection.mjs';
  const caseId = `ui-case:${ids[0]}`;
  const checkId = name => `ui-local-contract-case:${path}#${name}`;
  const runnerSource = readFileSync(new URL('../../lib/contract-case-selection.mjs', import.meta.url), 'utf8');
  write(runner, runnerSource + "throw Error('must not execute the selector');");
  write('tools/ui-contract-impact-bindings.json', {
    schemaVersion: 1,
    cases: { [ids[0]]: { contractCases: ['content-filter', 'orchestrator'].map(name => ({ path, name })) } },
  });
  const imports = "import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';\n";
  const before = 'const earlier = () => ({ details: [1, 2] });\n';
  const entries = `"content-filter": { "description": "Actual search filter", "resources": ["sdk"] },
    orchestrator: 'Actual page owner',`;
  const loop = 'for (const id of selectContractCases(defs)) { recordContractCasePass(id); }\n';
  const query = () => createImpactView({ root, deps: [caseId] });
  const putSource = (rows, dispatch = loop, prefix = before) => write(path,
    imports + prefix + 'const defs = {' + rows + '};\n' + dispatch + "throw Error('must not execute the contract');");
  putSource(entries);
  const view = query();
  for (const name of ['content-filter', 'orchestrator']) {
    const node = view.nodes.find(item => item.id === checkId(name));
    assert.equal(node?.entry, `node ${path} --case ${name}`);
    assert.equal(node.execution, 'NOT_RUN');
    assert.ok(!findGap(view, 'UNRESOLVED_LOCAL_CONTRACT_CASE', { id: checkId(name) }));
  }
  assert.ok(createImpactView({ root, affected: [runner] }).references.includes(caseId));

  for (const writeInvalid of [
    () => putSource(entries + " 'content-filter': 'Duplicate registration',"),
    () => putSource(entries + ' ...computed,'),
    () => putSource(entries + " ['advertised']: 'Computed key',"),
    () => putSource(entries, loop.replace('selectContractCases(defs)', 'selectContractCases({ ...defs })')),
    () => putSource(entries, loop + '}\n', 'function nested() {\n'),
    () => putSource(entries, '// ' + loop),
  ]) {
    writeInvalid();
    const invalid = query();
    assert.equal(invalid.nodes.find(item => item.id === checkId('content-filter'))?.entry, null);
    assert.ok(findGap(invalid, 'UNRESOLVED_LOCAL_CONTRACT_CASE', { id: checkId('content-filter') }));
  }
});

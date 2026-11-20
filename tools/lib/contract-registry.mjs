import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, posix } from 'node:path';

const identity = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone = value => structuredClone(value);
export const CONTRACT_VIEWS = ['catalog', 'tiers', 'cases'];
export const CONTRACT_VIEW_FILES = {
  catalog: 'gate-index.json', tiers: 'contract-test-tiers.json', cases: 'contract-case-manifest.json',
};
// These files always own the current indexed dispatcher. Their historical
// copies in per-check snapshots remain evidence, not separate current owners.
export const EXECUTION_RUNTIME_PATHS = [
  'tools/gate-index.mjs', 'tools/run-contract-tests.mjs', 'tools/lib/contract-registry.mjs',
  'tools/lib/contract-case-selection.mjs', 'tools/retired-contract-tests.json',
];
// Only these generic adapters have a reviewed version-transition contract.
// Business fixture assembly and production/test source never use this path.
export const COMPATIBLE_HELPER_PATHS = [
  'tools/lib/ets-compiler-runtime.mjs', 'tools/lib/ets-pure-module-probe.mjs',
  'tools/lib/selected-production-methods.mjs', 'tools/lib/reader-motion-method-probe.mjs',
];

function reviewedInputs(registry, set, owner) {
  const refs = registry.inputSets[set];
  assert.ok(Array.isArray(refs), `${owner}: missing definition set`);
  assert.equal(identity(refs), set, `${owner}: changed definition set identity`);
  return refs.map(ref => {
    assert.ok(registry.inputs[ref], `${owner}: missing reviewed input`);
    assert.equal(identity(registry.inputs[ref]), ref, `${owner}: changed reviewed input identity`);
    return clone(registry.inputs[ref]);
  });
}

function helperTransitions(registry) {
  assert.ok(!registry.catalog.helperTransitions, 'helper transitions have one canonical owner');
  const records = registry.helperTransitions ?? {};
  assert.ok(records && !Array.isArray(records) && typeof records === 'object', 'invalid helper transition owner');
  const targets = new Set(Object.values(records).map(record => record.to));
  return Object.entries(records).map(([from, record]) => {
    const previous = registry.inputs[from], current = registry.inputs[record.to];
    assert.ok(previous && current, 'helper transition requires reviewed input references');
    assert.equal(identity(previous), from, 'changed previous helper identity');
    assert.equal(identity(current), record.to, 'changed current helper identity');
    assert.ok(COMPATIBLE_HELPER_PATHS.includes(previous.path) && previous.path === current.path,
      'helper transition requires the same approved generic path');
    for (const input of [previous, current]) assert.match(input.sha256, /^[a-f0-9]{64}$/, 'reviewed helper SHA required');
    assert.notEqual(from, record.to, 'helper transition must change version');
    assert.ok(!targets.has(from), 'transitive helper transitions are forbidden');
    assert.ok(typeof record.reviewEvidence === 'string' && record.reviewEvidence.trim(), 'helper review evidence required');
    const proofInputs = reviewedInputs(registry, record.proofSet, previous.path);
    assert.ok(proofInputs.length >= 2 && new Set(proofInputs.map(input => input.path)).size === proofInputs.length,
      'helper proof requires unique inputs');
    for (const input of proofInputs) {
      assert.match(input.path, /^tools\/(?:lib|fixtures)\/[A-Za-z0-9_./-]+\.mjs$/, 'helper proof requires tooling inputs');
      assert.ok(!input.path.split('/').includes('..'), 'helper proof cannot escape tooling');
      assert.equal(input.path, posix.normalize(input.path), 'helper proof requires canonical tooling paths');
      assert.match(input.sha256, /^[a-f0-9]{64}$/, 'reviewed helper proof SHA required');
    }
    assert.ok(proofInputs.some(input => identity(input) === record.to), 'helper proof must bind current helper');
    assert.ok(proofInputs.some(input => input.path === 'tools/fixtures/ets-helper-transition-proof.mjs'),
      'helper transition requires the explicit compatibility proof');
    return { from: clone(previous), to: clone(current), proofInputs, reviewEvidence: record.reviewEvidence };
  });
}

/** Publish only an explicit, already reviewed old -> current helper version.
 * No source reads, requalification, wildcard, transitive acceptance or rewrite
 * of a check's immutable definition snapshot occurs here. */
export function publishHelperTransition(registry, { from, to, proofInputs, reviewEvidence }) {
  assert.equal(registry.schemaVersion, 2);
  const result = clone(registry), previousRef = identity(from), currentRef = identity(to);
  assert.deepEqual(result.inputs[previousRef], from, 'previous helper must be an existing reviewed input');
  result.helperTransitions ??= {};
  assert.ok(!Object.hasOwn(result.helperTransitions, previousRef), 'duplicate helper transition');
  const refs = proofInputs.map(input => {
    const ref = identity(input); result.inputs[ref] ??= clone(input); return ref;
  });
  result.inputs[currentRef] ??= clone(to);
  const proofSet = identity(refs); result.inputSets[proofSet] ??= refs;
  result.helperTransitions[previousRef] = { to: currentRef, proofSet, reviewEvidence };
  helperTransitions(result);
  return result;
}

/** Explicit publication after runtime review. Inputs are supplied by the
 * reviewer; this function never reads current source or approves a check. */
export function publishExecutionRuntime(registry, { inputs, reviewEvidence }) {
  assert.equal(registry.schemaVersion, 2);
  assert.ok(typeof reviewEvidence === 'string' && reviewEvidence.trim(), 'runtime review evidence required');
  assert.deepEqual(inputs.map(input => input.path).sort(), [...EXECUTION_RUNTIME_PATHS].sort(),
    'runtime inputs must be the exact unique indexed-dispatcher paths');
  const result = clone(registry);
  const refs = inputs.map(input => {
    assert.match(input.sha256, /^[a-f0-9]{64}$/, 'reviewed runtime SHA required');
    const ref = identity(input); result.inputs[ref] ??= clone(input); return ref;
  });
  const set = identity(refs); result.inputSets[set] ??= refs;
  result.executionRuntime = { definitionSet: set, reviewEvidence };
  result.catalog.executionRuntimeRequired = true;
  return result;
}

/** Lossless storage migration. Never rehash production/test inputs or approve a case. */
export function normalizeContractRegistry({ catalog, tiers, cases }) {
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(tiers.schemaVersion, 1);
  assert.equal(cases.schemaVersion, 1);
  const registry = { schemaVersion: 1, catalog: clone(catalog), tiers: clone(tiers),
    casePolicy: cases.policy, tests: {}, caseDefinitions: {}, inputs: {}, inputSets: {} };
  const test = file => registry.tests[file] ??= {};
  for (const tier of ['source', 'integration', 'pending']) for (const file of tiers[tier] ?? []) {
    assert.ok(!test(file).tier, 'duplicate test classification');
    test(file).tier = tier;
  }
  delete registry.tiers.source; delete registry.tiers.integration; delete registry.tiers.pending;
  for (const [file, declaration] of Object.entries(cases.files)) {
    const { cases: declarations, ...properties } = clone(declaration);
    test(file).focused = { ...properties, cases: Object.keys(declarations) };
    for (const [id, definition] of Object.entries(declarations)) registry.caseDefinitions[`${file}#${id}`] = definition;
  }
  for (const [file, declaration] of Object.entries(cases.legacy)) test(file).legacy = clone(declaration);
  for (const entry of [...registry.catalog.entries, ...(registry.catalog.caseEntries ?? [])]) {
    if (entry.definitionInputs) {
      const refs = entry.definitionInputs.map(input => {
        const ref = identity(input); registry.inputs[ref] ??= input; return ref;
      });
      const ref = identity(refs); registry.inputSets[ref] ??= refs;
      entry.definitionSet = ref; delete entry.definitionInputs;
    }
    if (!entry.caseId) continue;
    const ref = `${entry.file.split('/').at(-1)}#${entry.caseId}`;
    const declaration = registry.caseDefinitions[ref];
    if (declaration && entry.qualification === declaration.qualification &&
        JSON.stringify(entry.resourceNeeds) === JSON.stringify(declaration.resources)) {
      entry.declarationRef = ref;
      delete entry.qualification; delete entry.resourceNeeds;
    }
    // Conflicting/unpublished historical claims stay explicit until reviewed.
    // They never manufacture a published case or a new expected source hash.
  }
  return registry;
}

export function contractView(registry, view) {
  if (registry.schemaVersion === 2) registry = expandCatalogIdentities(registry);
  assert.equal(registry.schemaVersion, 1, 'unsupported contract registry');
  assert.ok(CONTRACT_VIEWS.includes(view), 'unknown contract metadata view');
  if (view === 'tiers') {
    const result = clone(registry.tiers);
    for (const tier of ['source', 'integration', 'pending']) {
      const files = Object.entries(registry.tests).filter(([, test]) => test.tier === tier).map(([file]) => file);
      if (tier !== 'pending' || files.length) result[tier] = files;
    }
    return result;
  }
  if (view === 'cases') {
    const result = { schemaVersion: 1, ...(registry.casePolicy === undefined ? {} : { policy: registry.casePolicy }), files: {}, legacy: {} };
    for (const [file, test] of Object.entries(registry.tests)) {
      if (test.focused) {
        const { cases, resourceDefinitionSha256: _reviewedResourceIdentity, ...properties } = clone(test.focused);
        result.files[file] = { ...properties, cases: Object.fromEntries(cases.map(id => {
          const definition = registry.caseDefinitions[`${file}#${id}`];
          assert.ok(definition, `${file}#${id}: missing canonical case declaration`);
          return [id, clone(definition)];
        })) };
      }
      if (test.legacy) result.legacy[file] = clone(test.legacy);
    }
    return result;
  }
  const catalog = clone(registry.catalog);
  const transitions = helperTransitions(registry);
  if (transitions.length) catalog.helperTransitions = transitions;
  assert.ok(!catalog.executionRuntime, 'execution runtime has one canonical owner');
  assert.ok(!catalog.executionRuntimeRequired || registry.executionRuntime, 'published execution runtime is required');
  if (registry.executionRuntime) {
    const inputs = reviewedInputs(registry, registry.executionRuntime.definitionSet, 'EXECUTION_RUNTIME');
    assert.deepEqual(inputs.map(input => input.path).sort(), [...EXECUTION_RUNTIME_PATHS].sort(),
      'runtime inputs must be the exact unique indexed-dispatcher paths');
    assert.ok(typeof registry.executionRuntime.reviewEvidence === 'string' && registry.executionRuntime.reviewEvidence.trim(),
      'runtime review evidence required');
    catalog.executionRuntime = { ...clone(registry.executionRuntime), definitionInputs: inputs };
  }
  for (const entry of [...catalog.entries, ...(catalog.caseEntries ?? [])]) {
    if (entry.definitionSet) {
      entry.definitionInputs = reviewedInputs(registry, entry.definitionSet, entry.id);
      delete entry.definitionSet;
    }
    if (entry.declarationRef) {
      assert.equal(entry.declarationRef, `${entry.file.split('/').at(-1)}#${entry.caseId}`, `${entry.id}: case declaration identity mismatch`);
      const declaration = registry.caseDefinitions[entry.declarationRef];
      assert.ok(declaration, `${entry.id}: missing canonical case declaration`);
      entry.qualification = declaration.qualification;
      entry.resourceNeeds = clone(declaration.resources);
      delete entry.declarationRef;
    }
  }
  if (registry.derivedCatalogSummaries === true) {
    const counts = entries => entries.reduce((result, entry) => {
      result[entry.qualification] = (result[entry.qualification] ?? 0) + 1;
      return result;
    }, {});
    // These are projections, never a second editable authority. Historical
    // auditBaseline/baselineQualificationCounts keep their original meaning.
    catalog.qualificationCounts = counts(catalog.entries);
    catalog.caseQualificationCounts = counts(catalog.caseEntries ?? []);
    catalog.inventoryFiles = Object.values(registry.tests).filter(test => test.tier !== undefined).length;
  }
  return catalog;
}

/** Normalize shared current facts without merging differing historical claims.
 * Case keys are references to test identities, not additional editable IDs.
 * An explicit inherited field follows its family owner; distinct values stay
 * local, including old source hashes, review states and unpublished claims. */
export function normalizeCatalogIdentities(previous) {
  assert.equal(previous.schemaVersion, 1);
  const registry = clone(previous);
  registry.schemaVersion = 2;
  const parents = new Map();
  for (const entry of registry.catalog.entries) {
    const file = entry.file.split('/').at(-1), test = registry.tests[file];
    assert.ok(test, `${entry.id}: missing test identity`);
    assert.equal(entry.file, `tools/${file}`);
    assert.deepEqual(entry.tests, [file]);
    assert.ok(!test.catalogId, `${file}: duplicate catalog owner`);
    test.catalogId = entry.id;
    parents.set(entry.id, { entry, file });
    entry.testRef = file;
    delete entry.id; delete entry.file; delete entry.tests;
    if (entry.focusedEntries) {
      const expected = previous.catalog.caseEntries.filter(row => row.parentId === test.catalogId).map(row => row.id);
      assert.deepEqual(entry.focusedEntries, expected, `${test.catalogId}: focused identities drift`);
      entry.deriveFocusedEntries = true; delete entry.focusedEntries;
    }
    if (test.focused && entry.reviewedSourceSha256 === test.focused.sourceSha256) {
      entry.reviewedSourceRef = true; delete entry.reviewedSourceSha256;
    }
  }
  registry.catalogCases = {};
  for (const original of previous.catalog.caseEntries) {
    const entry = clone(original), parent = parents.get(entry.parentId);
    assert.ok(parent, `${entry.id}: missing catalog family`);
    const { file } = parent, caseId = entry.caseId, ref = `${file}#${caseId}`;
    assert.equal(entry.id, `${registry.tests[file].catalogId}#${caseId}`);
    assert.equal(entry.file, `tools/${file}`);
    assert.deepEqual(entry.tests, [file]);
    assert.deepEqual(entry.caseSelection, { [file]: [caseId] });
    assert.ok(!registry.catalogCases[ref], `${ref}: duplicate catalog case`);
    delete entry.id; delete entry.parentId; delete entry.caseId;
    delete entry.file; delete entry.tests; delete entry.caseSelection;
    const parentView = previous.catalog.entries.find(row => row.id === original.parentId);
    const inherited = ['needs', 'productionBinding', 'overlap', 'necessityReason',
      'reviewedSourceSha256', 'definitionSet', 'definitionIdentityPurpose', 'defaultExecution', 'execution']
      .filter(field => Object.hasOwn(entry, field) && Object.hasOwn(parentView, field) &&
        JSON.stringify(entry[field]) === JSON.stringify(parentView[field]));
    for (const field of inherited) delete entry[field];
    if (inherited.length) entry.inheritedParentFields = inherited;
    if (entry.declarationRef) {
      assert.equal(entry.declarationRef, ref);
      entry.publishedDeclaration = true; delete entry.declarationRef;
    }
    registry.catalogCases[ref] = entry;
  }
  delete registry.catalog.caseEntries;
  for (const [file, test] of Object.entries(registry.tests)) if (test.focused) {
    const published = Object.keys(registry.caseDefinitions).filter(key => key.startsWith(`${file}#`)).map(key => key.slice(file.length + 1));
    assert.deepEqual(test.focused.cases, published, `${file}: published case order differs`);
    delete test.focused.cases;
  }
  for (const view of CONTRACT_VIEWS) assert.deepEqual(contractView(registry, view), contractView(previous, view), `${view}: identity normalization changed facts`);
  return registry;
}

/** One reviewed file/resource snapshot is shared by its published cases. This
 * moves existing expected bytes only; differing historical claims stay local. */
export function normalizeResourceReviewIdentities(previous) {
  assert.equal(previous.schemaVersion, 2);
  const registry = clone(previous);
  for (const [file, test] of Object.entries(registry.tests)) if (test.focused) {
    const rows = Object.entries(registry.catalogCases).filter(([ref, row]) =>
      ref.startsWith(`${file}#`) && row.publishedDeclaration === true).map(([, row]) => row);
    const values = new Set(rows.map(row => row.resourceDefinitionSha256).filter(Boolean));
    if (values.size !== 1 || !rows.every(row => row.resourceDefinitionSha256)) continue;
    const fingerprint = [...values][0];
    assert.match(fingerprint, /^[a-f0-9]{64}$/, `${file}: reviewed resource fingerprint`);
    assert.ok(!test.focused.resourceDefinitionSha256 || test.focused.resourceDefinitionSha256 === fingerprint,
      `${file}: conflicting reviewed resource owner`);
    test.focused.resourceDefinitionSha256 = fingerprint;
    for (const row of rows) { row.resourceDefinitionRef = true; delete row.resourceDefinitionSha256; }
  }
  for (const view of CONTRACT_VIEWS) assert.deepEqual(contractView(registry, view), contractView(previous, view), `${view}: resource review normalization changed facts`);
  return registry;
}

function expandCatalogIdentities(normalized) {
  const registry = clone(normalized); registry.schemaVersion = 1;
  const structural = new Set(['id', 'file', 'tests', 'parentId', 'caseId', 'caseSelection', 'declarationRef',
    'publishedDeclaration', 'resourceDefinitionRef', 'inheritedParentFields', 'qualification', 'resourceNeeds',
    'definitionSet', 'definitionInputs']);
  const plain = value => JSON.stringify(JSON.parse(JSON.stringify(value))) === JSON.stringify(value);
  for (const [file, template] of Object.entries(normalized.catalogCaseTemplates ?? {})) {
    const test = registry.tests[file];
    assert.ok(test?.catalogId, `${file}: case template requires a catalog family`);
    assert.ok(template && typeof template === 'object' && !Array.isArray(template), `${file}: invalid case template`);
    const { order, defaults } = template;
    assert.ok(Array.isArray(order) && order.length > 0 && new Set(order).size === order.length,
      `${file}: case template requires a unique field order`);
    assert.ok(defaults && typeof defaults === 'object' && !Array.isArray(defaults), `${file}: invalid case defaults`);
    for (const [field, value] of Object.entries(defaults)) {
      assert.ok(order.includes(field), `${file}: case default ${field} is not in the field order`);
      assert.ok(!structural.has(field), `${file}: structural field ${field} cannot be a case default`);
      assert.ok(plain(value), `${file}: case default ${field} is not plain JSON`);
    }
    const refs = Object.keys(registry.catalogCases).filter(ref => ref.startsWith(`${file}#`));
    assert.ok(refs.length > 0, `${file}: case template requires published cases`);
    for (const ref of refs) {
      const entry = registry.catalogCases[ref];
      const local = Object.keys(entry);
      assert.deepEqual(local, order.filter(field => Object.hasOwn(entry, field)),
        `${ref}: case fields do not follow the family template order`);
      const rebuilt = {};
      for (const field of order) {
        if (Object.hasOwn(entry, field)) rebuilt[field] = entry[field];
        else {
          assert.ok(Object.hasOwn(defaults, field), `${ref}: missing templated ${field}`);
          rebuilt[field] = clone(defaults[field]);
        }
      }
      registry.catalogCases[ref] = rebuilt;
    }
  }
  for (const [file, test] of Object.entries(registry.tests)) if (test.focused)
    test.focused.cases = Object.keys(registry.caseDefinitions).filter(key => key.startsWith(`${file}#`)).map(key => key.slice(file.length + 1));
  const parents = new Map();
  for (const entry of registry.catalog.entries) {
    const file = entry.testRef, test = registry.tests[file];
    assert.ok(test?.catalogId, `${file}: missing catalog identity`);
    entry.id = test.catalogId; entry.file = `tools/${file}`; entry.tests = [file];
    assert.ok(!parents.has(file), `${file}: duplicate catalog owner`);
    parents.set(file, entry); delete entry.testRef;
    if (entry.reviewedSourceRef) {
      assert.ok(test.focused?.sourceSha256, `${file}: missing reviewed source identity`);
      entry.reviewedSourceSha256 = test.focused.sourceSha256; delete entry.reviewedSourceRef;
    }
  }
  registry.catalog.caseEntries = Object.entries(registry.catalogCases).map(([ref, entry]) => {
    const separator = ref.lastIndexOf('#'), file = ref.slice(0, separator), caseId = ref.slice(separator + 1), parent = parents.get(file);
    assert.ok(separator > 0 && caseId && parent, `${ref}: missing case/family identity`);
    entry.id = `${parent.id}#${caseId}`; entry.parentId = parent.id; entry.caseId = caseId;
    entry.file = parent.file; entry.tests = [file]; entry.caseSelection = { [file]: [caseId] };
    for (const field of entry.inheritedParentFields ?? []) {
      assert.ok(!Object.hasOwn(entry, field), `${ref}: duplicate inherited ${field}`);
      assert.ok(Object.hasOwn(parent, field), `${ref}: missing parent ${field}`);
      entry[field] = clone(parent[field]);
    }
    delete entry.inheritedParentFields;
    if (entry.resourceDefinitionRef) {
      assert.ok(!Object.hasOwn(entry, 'resourceDefinitionSha256'), `${ref}: duplicate reviewed resource identity`);
      const fingerprint = registry.tests[file]?.focused?.resourceDefinitionSha256;
      assert.match(fingerprint ?? '', /^[a-f0-9]{64}$/, `${ref}: missing reviewed resource identity`);
      entry.resourceDefinitionSha256 = fingerprint; delete entry.resourceDefinitionRef;
    }
    if (entry.publishedDeclaration) { entry.declarationRef = ref; delete entry.publishedDeclaration; }
    return entry;
  });
  for (const entry of registry.catalog.entries) if (entry.deriveFocusedEntries) {
    entry.focusedEntries = registry.catalog.caseEntries.filter(row => row.parentId === entry.id).map(row => row.id);
    delete entry.deriveFocusedEntries;
  }
  return registry;
}

/** Reads pure data only. Legacy synthetic fixture roots retain their schema-1 views. */
export function readContractView(root, view) {
  assert.ok(CONTRACT_VIEWS.includes(view), 'unknown contract metadata view');
  const descriptor = JSON.parse(readFileSync(resolve(root, 'tools', CONTRACT_VIEW_FILES[view]), 'utf8'));
  if (descriptor.schemaVersion !== 2) return descriptor;
  assert.equal(descriptor.registry, 'contract-registry.json', 'unsupported contract registry path');
  assert.equal(descriptor.view, view, 'contract view identity mismatch');
  return contractView(JSON.parse(readFileSync(resolve(root, 'tools', descriptor.registry), 'utf8')), view);
}

#!/usr/bin/env node
// Reader gate lookup/admission only. Execution remains with the existing runner.
import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const definitionRoots = [root, resolve(root, '../Reader-Core'), resolve(root, '../Reader-UI')];
// These switches select alternate sources, mutants or skip a reviewed layer.
// The indexed command always runs the reviewed default variant. Toolchain,
// Core SDK/CLI and build-lease configuration remain explicit prerequisites.
const variantEnvironment = [
  'READER_SHELF_SEARCH_INDEX_SOURCE', 'READER_UPDATE_INDEX', 'READER_BASELINE_CONTROLLER',
  'READER_DETAIL_PROJECTION_SOURCE', 'READER_MANGA_SCROLL_SURFACE', 'READER_MANGA_SCROLL_PROJECTION',
  'READER_MANGA_MOTION_SURFACE', 'READER_MANGA_VIEWPORT_SOURCE', 'READER_CAPSULE_BASELINE',
  'READER_CAPSULE_SOURCE', 'READER_CAPSULE_STAGE_SOURCE', 'READER_CAPSULE_STATIC_SOURCE',
  'READER_DOWNLOAD_FEEDBACK_INDEX', 'READER_CONTROLS_BASELINE', 'READER_PREDECESSOR_PROBE_ROOT',
  'READER_LRE_SOURCE', 'READER_TRIAL_RETURN_INDEX_SOURCE', 'READER_SEARCH_PAGE_SOURCE',
  'READER_FEEDBACK_SOURCE_ROOT', 'READER_SEARCH_RELEVANCE_SOURCE', 'READER_SEARCH_SCALE_SOURCE_ROOT',
  'READER_READING_OWNER_SDK', 'READER_SKIP_PROBE_SDK_CHECK', 'READER_MANGA_ATOMIC_READ_MUTANT',
  'READER_NATIVE_ENCODER',
];
const usage = `Gate index (no tests run by default):
  node tools/gate-index.mjs --need "source-switch"
  node tools/gate-index.mjs --id H-reader-book-turn-motion
  node tools/gate-index.mjs --id H-reader-book-turn-motion --run --change "Changed raw MOVE sample admission"
  node tools/gate-index.mjs --release-plan

--need only searches the reviewed catalog. --run requires exact --id and the
current change. Unqualified or changed test definitions stop that selection;
they never fall back to a scope/full suite. --release-plan is planning only.
Ordinary feature/bug-fix builds do not run full gates. Formal release testing
and a user-requested whole-product acceptance have their own explicit plans.`;

const { values } = parseArgs({ options: {
  need: { type: 'string' }, id: { type: 'string', multiple: true },
  run: { type: 'boolean', default: false }, change: { type: 'string' },
  'release-plan': { type: 'boolean', default: false },
  'include-unqualified': { type: 'boolean', default: false },
  limit: { type: 'string', default: '6' }, help: { type: 'boolean', default: false },
}, allowPositionals: false });

function stop(message) { throw new Error(message); }
let optimizationPlans = new Map();
function readCatalog() {
  let catalog;
  try { catalog = JSON.parse(readFileSync(resolve(root, 'tools/gate-index.json'), 'utf8')); }
  catch { stop('The reviewed catalog is not published yet. Do not use the invalidated old inventory as execution approval.'); }
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.entries)) stop('Invalid gate index schema.');
  const parents = new Set(catalog.entries.map(entry => entry.id));
  for (const entry of catalog.caseEntries ?? []) {
    if (!parents.has(entry.parentId) || entry.id !== `${entry.parentId}#${entry.caseId}` ||
        !entry.caseSelection || Object.values(entry.caseSelection).flat().join(',') !== entry.caseId) stop('Invalid focused case identity.');
  }
  catalog.allEntries = [...catalog.entries, ...(catalog.caseEntries ?? []), ...(catalog.externalEntries ?? [])];
  if (new Set(catalog.allEntries.map(entry => entry.id)).size !== catalog.allEntries.length) stop('Duplicate gate IDs.');
  const retired = JSON.parse(readFileSync(resolve(root, 'tools/retired-contract-tests.json'), 'utf8'));
  if (retired.schemaVersion !== 1 || !Array.isArray(retired.entries)) stop('Invalid retirement registry.');
  if (new Set(retired.entries.map(entry => entry.id)).size !== retired.entries.length ||
      new Set(retired.entries.map(entry => entry.file)).size !== retired.entries.length) stop('Duplicate retirement identity.');
  for (const entry of retired.entries) {
    if (!/^H-[A-Za-z0-9._-]+$/.test(entry.id) || !/^test-[A-Za-z0-9._-]+\.mjs$/.test(entry.file)) stop('Invalid retired gate identity.');
    if (catalog.allEntries.some(active => active.id === entry.id || active.file === `tools/${entry.file}` || active.tests?.includes(entry.file))) stop('Retired gate cannot appear in the active index.');
  }
  catalog.retired = retired.entries;
  if (catalog.optimizationPlanFile) {
    if (catalog.optimizationPlanFile !== 'tools/gate-optimization-plan.json') stop('Invalid optimization plan path.');
    const plan = JSON.parse(readFileSync(resolve(root, catalog.optimizationPlanFile), 'utf8'));
    if (plan.schemaVersion !== 1 || !['PLAN_ONLY', 'IMPLEMENTING', 'IMPLEMENTED'].includes(plan.status) || !Array.isArray(plan.entries)) stop('Invalid optimization proposal.');
    optimizationPlans = new Map(plan.entries.map(entry => [entry.id, entry]));
    if (optimizationPlans.size !== plan.entries.length || plan.entries.some(entry =>
      !['PLAN_ONLY', 'IMPLEMENTING', 'IMPLEMENTED'].includes(entry.status) || !catalog.entries.some(active => active.id === entry.id))) stop('Invalid optimization proposal identity.');
  }
  return catalog;
}
function view(entry) {
  const plan = optimizationPlans.get(entry.id);
  const proposal = plan && (values.id ? {
    status: plan.status, implementation: plan.implementation,
    definitionReviewPrerequisite: plan.definitionReviewPrerequisite,
    currentOrientationEvidence: plan.currentOrientationEvidence,
    changes: plan.changes, proposedEntries: plan.proposedEntries,
    retainCoverage: plan.retainCoverage, minimumFutureValidation: plan.minimumFutureValidation,
    completionCriteria: plan.completionCriteria, dependencyOrder: plan.dependencyOrder,
    dependencies: plan.dependencies, coverageAdoption: plan.coverageAdoption,
  } : { status: plan.status, changes: plan.changes,
    completionCriteria: plan.completionCriteria, details: `node tools/gate-index.mjs --id ${entry.id}` });
  return { id: entry.id, parentId: entry.parentId, caseId: entry.caseId, file: entry.file, qualification: entry.qualification,
    ...(entry.caseSelection ? {caseSelection: entry.caseSelection} : {}),
    ...(entry.focusedEntries ? {focusedEntries: entry.focusedEntries} : {}),
    ...(entry.coverageAdoption ? {coverageAdoption: entry.coverageAdoption} : {}),
    execution: 'NOT_RUN', defaultExecution: 'OFF',
    ...(entry.resourceNeeds ? {resourceNeeds:entry.resourceNeeds} : {}),
    ...(entry.entryPoint ? {entryPoint: entry.entryPoint, selector: entry.selector, resourceNeeds: entry.resourceNeeds} : {}),
    needs: entry.needs, protects: entry.protectedBehavior, when: entry.minimumTrigger,
    reason: entry.necessityReason, costType: entry.estimatedCostType,
    prerequisites: entry.prerequisites, tests: entry.tests,
    nestedActions: entry.nestedActions ?? [], nestedCalls: entry.nestedCalls ?? [],
    evidenceBoundary: entry.evidenceBoundary,
    command: entry.entryPoint ? entry.entryPoint : entry.qualification === 'QUALIFIED' ?
      `node tools/gate-index.mjs --id ${entry.id} --run --change "<actual change>"` : 'BLOCKED until the stated repair/review',
    environmentPolicy: entry.entryPoint ? 'Lookup only; use the displayed exact Core/action entry and prerequisites.' : 'Reviewed default variant; source-override, mutant and skip switches are removed only from the child environment.',
    fixtureRootConstraints: entry.executionEnvRoots,
    definitionIdentity: entry.entryPoint ? 'The actual Core/action runner owns its input evidence; this lookup executes nothing.' : 'Checked only on an explicit --run; changes require review of this entry only.',
    repairAction: entry.repairAction, repair: entry.repair,
    ...(entry.implementation ? { implementation: entry.implementation } : {}),
    ...(proposal ? { optimizationPlan: proposal } : {}),
    limits: entry.limitations,
    ...(values.id ? { evidence: { mechanism: entry.mechanism, productionBinding: entry.productionBinding,
      caughtOrMissedExample: entry.failureExample, overlap: entry.overlap,
      reviewedSourceSha256: entry.reviewedSourceSha256 } } :
      { details: `node tools/gate-index.mjs --id ${entry.id}` }) };
}
function stableJSON(value) { return JSON.stringify(value, (_key,item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item); }
function verifyDefinitions(entries) {
  const checked = new Map();
  const resources=JSON.parse(readFileSync(resolve(root,'tools/contract-case-manifest.json'),'utf8'));
  for (const entry of entries) {
    if (entry.qualification !== 'QUALIFIED') stop(`${entry.id}: ${entry.qualification}; ${entry.repairAction}: ${entry.repair}`);
    const resourceDefinition=entry.caseSelection ? resources.files?.[entry.file.split('/').at(-1)] : resources.legacy?.[entry.file.split('/').at(-1)];
    if (entry.resourceDefinitionSha256 && createHash('sha256').update(stableJSON(resourceDefinition)).digest('hex') !== entry.resourceDefinitionSha256) stop(`${entry.id}: REVIEW_NEEDED for changed resource/case declaration; no broader fallback.`);
    if (!Array.isArray(entry.definitionInputs) || !entry.definitionInputs.length) stop(`${entry.id}: missing reviewed test-definition identity.`);
    for (const input of entry.definitionInputs) {
      const path = resolve(root, input.path);
      const boundary = definitionRoots.find(base => path.startsWith(base + sep) || path === base);
      if (!boundary || relative(boundary, path).split(/[\\/]/).some(part => ['.reader-local', '.git'].includes(part))) stop('Invalid gate-definition path.');
      for (let current = path; ; current = dirname(current)) {
        const stat = lstatSync(current);
        if (stat.isSymbolicLink()) stop(`${entry.id}: symlink definition input requires review: ${input.path}`);
        if (current === path && !stat.isFile()) stop(`${entry.id}: definition input must be a regular file: ${input.path}`);
        if (current === boundary) break;
      }
      if (!checked.has(path)) checked.set(path, createHash('sha256').update(readFileSync(path)).digest('hex'));
      if (checked.get(path) !== input.sha256) {
        stop(`${entry.id}: REVIEW_NEEDED for changed definition ${input.path}. Review this affected item; do not run a broader suite.`);
      }
    }
    for (const [name, expected] of Object.entries(entry.executionEnvRoots ?? {})) {
      if (process.env[name] !== undefined && resolve(root, process.env[name]) !== resolve(root, expected)) {
        stop(`${entry.id}: ${name} selects a different fixture root; review that entry/input variant before execution. No full-suite fallback.`);
      }
    }
  }
}

if (values.help) { console.log(usage); }
else if (!values.need && !values.id && !values['release-plan']) {
  if (values.run || values.change) stop('--run requires exact --id and --change.');
  console.log(usage);
} else {
  const catalog = readCatalog();
  if (values['release-plan']) {
    if (values.run || values.id || values.need || values.change) stop('--release-plan cannot execute tests or be combined with a selection.');
    console.log(JSON.stringify({ status: 'PLAN_ONLY', completeReview: catalog.completeReview,
      scope: 'Harmony check library; no version/platform feature scope has been selected and no release matrix is claimed.',
      candidateRequired: true, testedInThisTask: false, selected: [],
      qualifiedAvailable: catalog.allEntries.filter(entry => entry.qualification === 'QUALIFIED').length,
      qualificationCounts: catalog.qualificationCounts, retiredFiles: catalog.retired.length,
      catalog: 'tools/gate-index.json',
      optimizationPlan: catalog.optimizationPlanFile,
      relevantUnqualifiedLookup: 'node tools/gate-index.mjs --need "<released feature>" --include-unqualified',
      requiredPlanFields: ['candidate content identity', 'target platform and released features',
        'exact qualified check IDs and necessity', 'reuse or invalidate prior evidence by actual inputs',
        'resolve/close relevant unqualified items and state coverage gaps', 'separate Core/Host/package/device evidence'],
      guidance: 'QUALIFIED does not mean required for every release. Build the explicit candidate plan from the relevant checks. No automatic full gate is dispatched.' }, null, 2));
  } else {
    if (values.id && values.need) stop('Use exact --id selection or a --need lookup. Lookup never executes tests.');
    let selected;
    if (values.id) {
      if (new Set(values.id).size !== values.id.length) stop('Duplicate selected gate IDs.');
      selected = values.id.map(id => {
        if (catalog.retired.some(entry => entry.id === id)) stop(`${id}: RETIRED by user decision. Removed from executable sources and every supported selection route; historical evidence does not authorize restoration.`);
        return catalog.allEntries.find(entry => entry.id === id) ?? stop(`Unknown gate ${id}.`);
      });
    } else {
      if (values.run || values.change) stop('--need is lookup only. Choose the exact reviewed --id before execution.');
      const query = values.need.trim().toLocaleLowerCase();
      if (!query) stop('A nonempty need is required.');
      const terms = query.split(/\s+/);
      selected = catalog.allEntries.filter(entry =>
        (values['include-unqualified'] || ['QUALIFIED','EXACT_ENTRY'].includes(entry.qualification)) &&
        terms.every(term => [entry.id, entry.file, ...(entry.needs ?? []), entry.protectedBehavior, entry.minimumTrigger,
          optimizationPlans.has(entry.id) ? JSON.stringify(optimizationPlans.get(entry.id)) : '']
          .some(value => String(value).toLocaleLowerCase().includes(term))));
      const score=entry=>terms.reduce((sum,term)=>sum+((entry.caseId??'').toLocaleLowerCase().includes(term)?20:0)+(entry.id.toLocaleLowerCase().includes(term)?10:0)+((entry.protectedBehavior??'').toLocaleLowerCase().includes(term)?5:0),entry.caseId?2:0);
      selected.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
    }
    if (values.run) {
      if (selected.some(entry => entry.entryPoint)) stop('This Core/action entry requires its exact selector and action inputs; use the displayed entryPoint. No Host suite is substituted.');
      if (catalog.reviewedDefinitionsFrozen !== true) stop('Reviewed definition identities are not finalized; no execution is admitted and no broader suite is substituted.');
      if (!values.change?.trim()) stop('Provide --change with this actual change; the catalog supplies the reviewed necessity evidence.');
      verifyDefinitions(selected);
      const tests = [...new Set(selected.flatMap(entry => entry.tests ?? []))];
      if (!tests.length || tests.some(name => !/^test-[A-Za-z0-9._-]+\.mjs$/.test(name))) stop('Invalid reviewed test selection.');
      const rationale = `Change: ${values.change.trim()}\n` + selected.map(entry => `${entry.id}: ${entry.necessityReason}`).join('\n');
      const selections = new Map();
      for (const entry of selected) for (const [file, ids] of Object.entries(entry.caseSelection ?? {})) {
        const cases = selections.get(file) ?? new Set(); ids.forEach(id => cases.add(id)); selections.set(file, cases);
      }
      // Never widen a case to all siblings. Whole-file and case requests for the
      // same test conflict because the whole-file scope would be ambiguous.
      if (selected.some(entry => !entry.caseSelection && (entry.tests ?? []).some(file => selections.has(file)))) stop('Select exact cases only for a focused file.');
      const args = [resolve(root, 'tools/run-contract-tests.mjs'), '--tests', tests.join(','), '--rationale', rationale];
      if (selections.size) args.push('--cases', [...selections].flatMap(([file, ids]) => [...ids].map(id => `${file}#${id}`)).join(','));
      console.log(JSON.stringify({ stage: 'explicitGateSelection', ids: selected.map(entry => entry.id), tests, rationale,
        fullSuiteRequested: false, caseSelection: Object.fromEntries([...selections].map(([file,ids])=>[file,[...ids]])), qualification: 'QUALIFIED' }));
      const environment = { ...process.env };
      const unset = [...new Set([...variantEnvironment, ...selected.flatMap(entry => entry.executionEnvUnset ?? [])])];
      if (unset.some(name => !/^READER_[A-Z0-9_]+$/.test(name))) stop('Invalid reviewed variant environment name.');
      const removedVariantSwitches = unset.filter(name => Object.hasOwn(environment, name));
      for (const name of unset) delete environment[name];
      if (removedVariantSwitches.length) console.log(JSON.stringify({ removedVariantSwitches, reason: 'Use reviewed default variant' }));
      const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', shell: false, env: environment });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    } else {
      const limit = Number(values.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) stop('--limit must be 1..1000.');
      console.log(JSON.stringify({ status: 'NOT_RUN', completeReview: catalog.completeReview,
        reviewedFiles: catalog.reviewedFiles, auditBaselineFiles: catalog.auditBaselineFiles,
        inventoryFiles: catalog.inventoryFiles, retiredFiles: catalog.retired.length,
        qualificationCounts: catalog.qualificationCounts,
        matched: selected.length, shown: Math.min(limit, selected.length), entries: selected.slice(0, limit).map(view),
        guidance: 'Read the item scope/limitations, then use exact --id --run --change only if this check is needed. No full-suite fallback.' }, null, 2));
    }
  }
}

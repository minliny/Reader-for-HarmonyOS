#!/usr/bin/env node
// Reader gate lookup/admission only. Execution remains with the existing runner.
import { readFileSync, lstatSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { contractExecutionPlan } from './run-contract-tests.mjs';
import { gateResourceDefinitionSha256 } from './lib/gate-resource-definition.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const definitionRoots = [root, resolve(root, '../Reader-Core'), resolve(root, '../Reader-UI')];
const reviewedTestName = /^test-[A-Za-z0-9._-]+\.mjs$/;
const fixtureEnvName = /^READER_[A-Z0-9_]+$/;
const coreFixtureVariables = ['READER_CORE_ROOT', 'READER_SOURCE_SWITCH_CORE_ROOT'];
const coreSdkInput = 'bindings/harmony/sdk/reader_core.ts';
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
current change. Each ID has its own admission and receipt. --release-plan is
planning only.
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
  const cases = (catalog.caseEntries ?? []).map(entry => {
    const valid = parents.has(entry.parentId) && entry.id === `${entry.parentId}#${entry.caseId}` &&
      entry.caseSelection && Object.values(entry.caseSelection).flat().join(',') === entry.caseId;
    return valid ? entry : { ...entry, unavailable: 'Invalid focused case identity' };
  });
  catalog.allEntries = [...catalog.entries, ...cases, ...(catalog.externalEntries ?? [])];
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
function view(entry, catalog, checks) {
  const admission = reviewedAdmission(entry, catalog, checks);
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
    execution: 'NOT_RUN', defaultExecution: 'OFF', admission,
    ...(entry.resourceNeeds ? {resourceNeeds:entry.resourceNeeds} : {}),
    ...(entry.entryPoint ? {entryPoint: entry.entryPoint, selector: entry.selector, resourceNeeds: entry.resourceNeeds} : {}),
    needs: entry.needs, protects: entry.protectedBehavior, when: entry.minimumTrigger,
    reason: entry.necessityReason, costType: entry.estimatedCostType,
    prerequisites: entry.prerequisites, tests: entry.tests,
    nestedActions: entry.nestedActions ?? [], nestedCalls: entry.nestedCalls ?? [],
    evidenceBoundary: entry.evidenceBoundary,
    command: entry.entryPoint ? entry.entryPoint : admission.status === 'READY' ?
      `node tools/gate-index.mjs --id ${entry.id} --run --change "<actual change>"` : 'BLOCKED until the stated repair/review',
    environmentPolicy: entry.entryPoint ? 'Lookup only; use the displayed exact Core/action entry and prerequisites.' : 'Reviewed default variant; source-override, mutant and skip switches are removed only from the child environment.',
    fixtureRootConstraints: entry.executionEnvRoots,
    definitionIdentity: entry.entryPoint ? 'The actual Core/action runner owns its input evidence; this lookup executes nothing.' : 'Current input admission is read-only until the same ID is explicitly executed.',
    repairAction: entry.repairAction, repair: entry.repair,
    ...(entry.implementation ? { implementation: entry.implementation } : {}),
    ...(proposal ? { optimizationPlan: proposal } : {}),
    limits: entry.limitations,
    ...(values.id ? { evidence: { mechanism: entry.mechanism, productionBinding: entry.productionBinding,
      caughtOrMissedExample: entry.failureExample, overlap: entry.overlap,
      reviewedSourceSha256: entry.reviewedSourceSha256 } } :
      { details: `node tools/gate-index.mjs --id ${entry.id}` }) };
}

function inputCheck() {
  const digests = new Map();
  let manifest;
  return {
    resources(entry) {
      manifest ??= JSON.parse(readFileSync(resolve(root, 'tools/contract-case-manifest.json'), 'utf8'));
      return gateResourceDefinitionSha256(manifest, entry);
    },
    digest(path, boundary, name) {
      if (!digests.has(path)) {
        for (let current = path; ; current = dirname(current)) {
          const stat = lstatSync(current);
          if (stat.isSymbolicLink()) stop('symlink definition input requires review: ' + name);
          if (current === path && !stat.isFile()) stop('definition input must be a regular file: ' + name);
          if (current === boundary) break;
        }
        digests.set(path, createHash('sha256').update(readFileSync(path)).digest('hex'));
      }
      return digests.get(path);
    },
  };
}

function verifyDefinitions(entry, checks) {
  if (entry.resourceDefinitionSha256 && checks.resources(entry) !== entry.resourceDefinitionSha256) {
    stop('REVIEW_NEEDED for changed resource/case declaration');
  }
  if (!Array.isArray(entry.definitionInputs) || !entry.definitionInputs.length) stop('missing reviewed test-definition identity');
  for (const input of entry.definitionInputs) {
    const path = resolve(root, input.path);
    const boundary = definitionRoots.find(base => path.startsWith(base + sep) || path === base);
    if (!boundary || relative(boundary, path).split(/[\\/]/).some(part => ['.reader-local', '.git'].includes(part))) stop('Invalid gate-definition path');
    if (checks.digest(path, boundary, input.path) !== input.sha256) stop('REVIEW_NEEDED for changed definition ' + input.path);
  }
}

function reviewedEnvironment(entry, tests) {
  const roots = new Map(Object.entries(entry.executionEnvRoots ?? {}));
  const unset = new Set([...variantEnvironment, ...(entry.executionEnvUnset ?? [])]);
  if ([...roots.keys(), ...unset].some(name => !fixtureEnvName.test(name))) stop('Invalid reviewed variant environment name');
  for (const [name, expected] of roots) {
    if (process.env[name] !== undefined && resolve(root, process.env[name]) !== resolve(root, expected)) {
      stop(name + ' selects a different fixture root; review that entry/input variant before execution');
    }
  }
  const sources = tests.map(test => readFileSync(resolve(root, 'tools', test), 'utf8'));
  for (const name of coreFixtureVariables) {
    const consumers = sources.filter(source => new RegExp('\\bprocess\\.env\\.' + name + '\\b').test(source));
    if (!consumers.length) continue;
    const fixture = roots.get(name);
    const fixtureRoot = fixture && resolve(root, fixture);
    const reviewedInputs = entry.definitionInputs.map(input => resolve(root, input.path));
    if (!fixtureRoot || !reviewedInputs.some(input => input.startsWith(fixtureRoot + sep))) {
      stop('REVIEW_NEEDED for unbound Core fixture ' + name + ' and definition inputs');
    }
    if (consumers.some(source => source.includes(coreSdkInput)) &&
        !reviewedInputs.includes(resolve(fixtureRoot, coreSdkInput))) {
      stop('REVIEW_NEEDED for unbound Core SDK definition used by ' + name);
    }
  }
  const environment = { ...process.env };
  const removed = [...unset].filter(name => Object.hasOwn(environment, name) && !roots.has(name));
  for (const name of unset) delete environment[name];
  for (const [name, expected] of roots) environment[name] = resolve(root, expected);
  return { environment, removed };
}

function admit(entry, catalog, checks) {
  if (entry.unavailable) stop(entry.unavailable);
  if (entry.entryPoint) stop('Use the displayed exact Core/action entry and prerequisites');
  if (entry.qualification !== 'QUALIFIED') stop(entry.qualification + '; ' + entry.repairAction + ': ' + entry.repair);
  if (catalog.reviewedDefinitionsFrozen !== true) stop('Reviewed definition identities are not finalized');
  const tests = entry.tests;
  if (!Array.isArray(tests) || !tests.length || tests.some(name => !reviewedTestName.test(name))) stop('Invalid reviewed test selection');
  const plan = contractExecutionPlan(root, 'full', { tests, cases: entry.caseSelection });
  verifyDefinitions(entry, checks);
  return { tests, cases: plan.caseSelection.selections, ...reviewedEnvironment(entry, tests) };
}

function reviewedAdmission(entry, catalog, checks) {
  if (entry.unavailable) return { status: 'BLOCKED', reason: entry.unavailable };
  if (entry.entryPoint) return { status: 'EXTERNAL_ENTRY' };
  if (entry.qualification !== 'QUALIFIED') return { status: 'BLOCKED', reason: entry.qualification };
  try {
    admit(entry, catalog, checks);
    return { status: 'READY' };
  } catch (error) {
    return { status: 'BLOCKED', reason: error.message };
  }
}

function launchRunner(args, environment, onStart) {
  return new Promise(resolveResult => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', shell: false, env: environment });
    onStart(child);
    let error;
    child.once('error', failure => { error = failure.message; });
    child.once('close', (exitCode, signal) => resolveResult({ exitCode, signal, ...(error ? { error } : {}) }));
  });
}

function readRunnerReceipt(path, tests, cases) {
  try {
    const receipt = JSON.parse(readFileSync(path, 'utf8'));
    if (receipt.schemaVersion === 1 && receipt.name === 'reader-harmony-contract-results' &&
        receipt.scope === 'custom' && JSON.stringify(receipt.selected) === JSON.stringify(tests) &&
        JSON.stringify(receipt.caseSelection) === JSON.stringify(cases)) return receipt;
  } catch { /* The runner can fail its own admission before writing a receipt. */ }
  return undefined;
}

async function runSelectedGates(entries, catalog, change) {
  const results = [];
  let cancellation, active, receiptRoot, unsettled;
  const cancel = signal => {
    if (cancellation) return;
    cancellation = signal;
    active?.kill(signal);
  };
  const onTerm = () => cancel('SIGTERM');
  const onInt = () => cancel('SIGINT');
  process.on('SIGTERM', onTerm);
  process.on('SIGINT', onInt);
  const record = result => {
    results.push(result);
    console.log(JSON.stringify({ stage: 'explicitGateResult', ...result }));
  };
  try {
    for (const entry of entries) {
      const id = entry.id;
      if (cancellation || unsettled) {
        record({ id, status: 'NOT_RUN', reason: cancellation ? 'batch cancelled' : 'previous runner process tree unsettled' });
        continue;
      }
      let admitted;
      try { admitted = admit(entry, catalog, inputCheck()); }
      catch (error) {
        console.error(id + ': ' + error.message);
        record({ id, status: 'BLOCKED', reason: error.message });
        continue;
      }
      const { tests, cases, environment, removed } = admitted;
      const rationale = 'Change: ' + change + '\n' + id + ': ' + entry.necessityReason;
      const args = [resolve(root, 'tools/run-contract-tests.mjs'), '--tests', tests.join(','), '--rationale', rationale];
      const selectors = Object.entries(cases).flatMap(([file, ids]) => ids.map(caseId => file + '#' + caseId));
      if (selectors.length) args.push('--cases', selectors.join(','));
      let runnerReceipt;
      if (entries.length === 1 && environment.READER_CONTRACT_RESULTS_FILE) {
        runnerReceipt = resolve(root, environment.READER_CONTRACT_RESULTS_FILE);
        if (lstatSync(runnerReceipt, { throwIfNoEntry: false })) {
          const reason = 'requested runner receipt already exists';
          console.error(id + ': ' + reason);
          record({ id, status: 'BLOCKED', reason });
          continue;
        }
      } else {
        receiptRoot ??= mkdtempSync(resolve(tmpdir(), 'reader-gate-run-'));
        runnerReceipt = resolve(receiptRoot, results.length + '.json');
      }
      args.push('--results-file', runnerReceipt);
      console.log(JSON.stringify({ stage: 'explicitGateSelection', ids: [id], tests, rationale,
        fullSuiteRequested: false, caseSelection: cases, qualification: 'QUALIFIED' }));
      if (removed.length) console.log(JSON.stringify({ removedVariantSwitches: removed, reason: 'Use reviewed default variant' }));
      const exit = await launchRunner(args, environment, child => { active = child; });
      active = undefined;
      const receipt = readRunnerReceipt(runnerReceipt, tests, cases);
      unsettled = receipt?.treeSettled === false || !receipt && Boolean(exit.signal) && !cancellation;
      const passed = exit.exitCode === 0 && receipt?.selectedStatus === 'PASS' && !unsettled;
      const status = cancellation || receipt?.cancelled ? 'CANCELLED' : passed ? 'PASS' : 'FAIL';
      record({ id, status, ...exit, ...(receipt ?
        { runnerReceipt, treeSettled: receipt.treeSettled, testsStarted: receipt.results.length } :
        { testsStarted: null, reason: 'runner did not return a receipt for this exact selection' }) });
    }
  } finally {
    process.removeListener('SIGTERM', onTerm);
    process.removeListener('SIGINT', onInt);
  }
  console.log(JSON.stringify({ stage: 'explicitGateBatchResult', selected: entries.map(entry => entry.id), results,
    status: cancellation ? 'CANCELLED' : results.every(result => result.status === 'PASS') ? 'PASS' : 'FAIL' }));
  return cancellation === 'SIGTERM' ? 143 : cancellation === 'SIGINT' ? 130 :
    results.every(result => result.status === 'PASS') ? 0 : 1;
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
        const entry = catalog.allEntries.find(item => item.id === id);
        if (entry) return entry;
        const unavailable = catalog.retired.some(item => item.id === id) ? 'RETIRED by user decision' : 'Unknown gate';
        if (!values.run) process.exitCode = 1;
        return { id, unavailable };
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
      if (!values.change?.trim()) stop('Provide --change with this actual change; the catalog supplies the reviewed necessity evidence.');
      process.exitCode = await runSelectedGates(selected, catalog, values.change.trim());
    } else {
      const checks = inputCheck();
      const limit = Number(values.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) stop('--limit must be 1..1000.');
      const shown = values.id ? selected : selected.slice(0, limit);
      console.log(JSON.stringify({ status: 'NOT_RUN', completeReview: catalog.completeReview,
        reviewedFiles: catalog.reviewedFiles, auditBaselineFiles: catalog.auditBaselineFiles,
        inventoryFiles: catalog.inventoryFiles, retiredFiles: catalog.retired.length,
        qualificationCounts: catalog.qualificationCounts,
        matched: selected.length, shown: shown.length, entries: shown.map(entry => view(entry, catalog, checks)),
        guidance: 'Read the item scope/limitations, then use exact --id --run --change only if this check is needed. No full-suite fallback.' }, null, 2));
    }
  }
}

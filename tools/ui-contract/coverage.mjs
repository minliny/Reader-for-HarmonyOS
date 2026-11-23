#!/usr/bin/env node
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { equalJson, loadCase, phase0CaseIds, phase1CaseIds, toolRoot } from './lib/cases.mjs';
import { jsonDigest, requireEvidence } from './lib/evidence.mjs';
import { replayReceipt } from './lib/receipt.mjs';
import { structureBindingSha256 } from './lib/receipt-structure.mjs';
import { loadStructureDefinition, resolveStructureBindings } from './lib/structure-contract.mjs';

const digest = /^[0-9a-f]{64}$/u;
const targetFields = ['hdcServer', 'targetRef', 'targetKind'];
const productFields = ['appBuildId', 'appContentHash', 'hapSha256', 'sourceFingerprint', 'buildRunId'];
const dimensions = ({widthPx, heightPx, density, orientation, fontScale}) =>
  ({widthPx, heightPx, density, orientation, fontScale});

function measuredWindow(window) {
  return window && ['portrait', 'landscape'].includes(window.orientation) &&
    ['widthPx','heightPx','density','fontScale'].every(key => Number.isFinite(window[key]) && window[key] > 0) ?
    dimensions(window) : null;
}

function initialWindow(receipt) {
  const { initialWindowSampleId, sampleWindows } = receipt.measurement;
  return initialWindowSampleId ? measuredWindow(sampleWindows?.[initialWindowSampleId]) : null;
}

function measuredChanges(receipt) {
  const { sampleWindowOrder, sampleWindows } = receipt.measurement;
  const changes = [];
  for (const [index, sampleId] of (sampleWindowOrder ?? []).entries()) {
    if (index === 0) continue;
    const previousSampleId = sampleWindowOrder[index - 1];
    const from = measuredWindow(sampleWindows?.[previousSampleId]);
    const to = measuredWindow(sampleWindows?.[sampleId]);
    if (from && to && !equalJson(from, to)) changes.push({ previousSampleId, sampleId, from, to });
  }
  return changes;
}

function hasFields(value, fields) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    equalJson(Object.keys(value).sort(), [...fields].sort());
}

export function assertCompatibleRuns(receipts) {
  const first = receipts[0].candidate.identity;
  for (const receipt of receipts.slice(1)) {
    const identity = receipt.candidate.identity;
    requireEvidence(targetFields.every(field => first[field] === identity[field]),
      'One coverage group must bind runs to the same HDC server and target');
    requireEvidence(equalJson(first, identity),
      'One coverage group must bind all runs to the same candidate build, signed HAP and source snapshot');
  }
  const windows = receipts.map(initialWindow).filter(Boolean);
  const configuration = windows[0] ?? null;
  requireEvidence(windows.every(window => equalJson(window, configuration)),
    'Different measured window configurations require their own coverage groups');
  return configuration;
}

export function readSelection(selectionPath) {
  const path = resolve(selectionPath);
  const selection = JSON.parse(readFileSync(path, 'utf8'));
  requireEvidence(hasFields(selection, ['groups']) && Array.isArray(selection.groups) && selection.groups.length,
    'Coverage selection must explicitly name at least one group');
  const groups = new Set();
  return selection.groups.map(group => {
    requireEvidence(hasFields(group, ['id','runs']) && typeof group.id === 'string' &&
      /^[A-Za-z0-9._-]{1,80}$/u.test(group.id) && !groups.has(group.id) && Array.isArray(group.runs) && group.runs.length,
    'Each coverage group needs a unique ID and one or more explicit receipt selections');
    groups.add(group.id);
    return {
      id:group.id,
      runs:group.runs.map(run => {
        requireEvidence(hasFields(run, ['case','receipt','expectedRoot']) && phase1CaseIds.includes(run.case) &&
          typeof run.receipt === 'string' && run.receipt.length && typeof run.expectedRoot === 'string' && digest.test(run.expectedRoot),
        'Each selected run requires one registered Phase 1 case, receipt path, and independent SHA-256');
        return { contract:loadCase(run.case), receiptPath:resolve(dirname(path), run.receipt), expectedRoot:run.expectedRoot };
      }),
    };
  });
}

function summary(run) {
  const {receipt, rootSha256} = run;
  return {
    ...receipt.coverage[receipt.caseId], case:receipt.caseId, caseVersion:receipt.caseVersion, runId:receipt.runId, rootSha256,
    candidate:receipt.candidate.identity, toolSha256:receipt.tool?.sha256,
    execution:receipt.execution, behavior:receipt.behavior,
    diagnostics:receipt.diagnostics, measurement:receipt.measurement,
    ...(receipt.structure ? {structure:receipt.structure} : {}),
    ...(receipt.conditions ? {conditions:receipt.conditions} : {}),
  };
}

function currentContract(id) {
  return lstatSync(new URL(`cases/${id}.json`, toolRoot), {throwIfNoEntry:false})?.isFile() ? loadCase(id) : null;
}

function coverageOutcome(failed, complete, passed) {
  return {
    observations:complete ? 'COMPLETE' : 'INCOMPLETE',
    behavior:failed ? 'FAIL' : passed && complete ? 'PASS' : 'NOT_RUN',
  };
}

/** Count committed roles even when their case was removed or left unselected. */
export function scenarioCoverage(runs, definition = loadStructureDefinition(), registered = phase1CaseIds,
  readCase = currentContract, {eligible = () => true} = {}) {
  const definitionSha256 = jsonDigest(definition);
  const scenarios = definition.scenarioObligations.map(obligation => {
    const {caseId} = obligation;
    const matching = runs.filter(({receipt}) => receipt.caseId === caseId);
    const contract = registered.includes(caseId) ? readCase(caseId) : null;
    const caseSha256 = contract && jsonDigest(contract);
    const bindingSha256 = contract && structureBindingSha256(contract, definition);
    const exactCaseRuns = matching.filter(({receipt}) => contract && receipt.caseSha256 === caseSha256);
    const replayed = exactCaseRuns.filter(({receipt}) => receipt.structure?.bindingSha256 === bindingSha256);
    const eligibleRuns = new Set(replayed.filter(eligible).map(({receipt}) => receipt.runId));
    const boundConditions = contract ? Object.fromEntries(resolveStructureBindings(contract, definition)
      .filter(binding => binding.conditionId).map(({role, conditionId}) => [role, conditionId])) : obligation.conditions ?? {};
    const conditionIds = new Set([
      ...Object.values(boundConditions),
      ...(contract?.assertions ?? []).filter(assertion => assertion.condition).map(assertion => assertion.id),
    ]);
    const applies = (receipt, id) => receipt.conditions?.[id]?.status === 'APPLIES';
    const appliedConditions = new Set([...conditionIds].filter(id =>
      replayed.some(({receipt}) => applies(receipt,id))));
    const matchesRole = (state, role, ruleId) => state.role === role && state.ruleId === ruleId &&
      state.sampleId === contract.structure[role] && state.actionId === obligation.actions[role] &&
      state.conditionId === boundConditions[role];
    const allStatesObserved = ({receipt}) => receipt.structure.observations === 'COMPLETE' &&
      Object.entries(obligation.states).every(([role, ruleId]) => receipt.structure.states.some(state =>
        matchesRole(state, role, ruleId) && state.observationsComplete === true &&
        (!appliedConditions.has(state.conditionId) || receipt.conditions?.[state.conditionId]?.status === 'APPLIES')));
    const structurallyComplete = replayed.filter(run => eligibleRuns.has(run.receipt.runId) && allStatesObserved(run));
    const complete = structurallyComplete.length > 0;
    const states = Object.entries(obligation.states).map(([role, ruleId]) => {
      const conditionId = boundConditions[role];
      const assessments = replayed.flatMap(({receipt, rootSha256}) => receipt.structure.states
        .filter(state => matchesRole(state, role, ruleId)).map(state => ({
          sampleId:state.sampleId, actionId:state.actionId, verdict:state.verdict,
          observationsComplete:state.observationsComplete, runId:receipt.runId, rootSha256,
          ...(conditionId ? {applicability:receipt.conditions?.[conditionId]?.status ?? 'UNKNOWN'} : {}),
        })));
      const passed = assessments.filter(item => eligibleRuns.has(item.runId) && item.verdict === 'PASS' && item.observationsComplete);
      return {
        role, ruleId, ...(conditionId ? {conditionId} : {}),
        status:!contract ? 'MISSING_DEFINITION' : !matching.length ? 'NOT_RUN' :
          assessments.some(item => item.verdict === 'FAIL') ? 'FAIL' :
            passed.some(item => !conditionId || item.applicability === 'APPLIES') ? 'PASS' :
              !appliedConditions.has(conditionId) && passed.some(item => item.applicability === 'DOES_NOT_APPLY') ?
                'DOES_NOT_APPLY' : 'INCOMPLETE',
        assessments,
      };
    });
    const structure = coverageOutcome(states.some(state => state.status === 'FAIL'), complete,
      states.every(state => ['PASS','DOES_NOT_APPLY'].includes(state.status)));
    const completeReceipts = structurallyComplete.filter(({receipt}) => receipt.observations === 'COMPLETE');
    const passingReceipts = completeReceipts.filter(({receipt}) => receipt.execution === 'PASS');
    const missingApplicableAssertions = [...appliedConditions].filter(id =>
      !completeReceipts.some(({receipt}) => applies(receipt,id)));
    const scenario = coverageOutcome(
      structure.behavior === 'FAIL' || replayed.some(({receipt}) => receipt.behavior === 'FAIL') ||
        exactCaseRuns.some(({receipt}) => receipt.assertions?.some(assertion => assertion.verdict === 'FAIL')),
      completeReceipts.length > 0 && !missingApplicableAssertions.length,
      structure.behavior === 'PASS' && passingReceipts.length > 0 &&
        [...appliedConditions].every(id => passingReceipts.some(({receipt}) => applies(receipt,id))),
    );
    return {
      caseId, states, structure, ...scenario, missingApplicableAssertions,
      staleRunIds:matching.filter(run => !replayed.includes(run)).map(({receipt}) => receipt.runId),
    };
  });
  const states = scenarios.flatMap(scenario => scenario.states);
  const missingObligationCaseIds = registered.filter(caseId => !scenarios.some(scenario => scenario.caseId === caseId));
  return {
    definitionSha256, obligatedStates:states.length,
    counts:Object.fromEntries(['PASS','FAIL','INCOMPLETE','NOT_RUN','DOES_NOT_APPLY','MISSING_DEFINITION'].map(status =>
      [status, states.filter(state => state.status === status).length])),
    structure:coverageOutcome(scenarios.some(scenario => scenario.structure.behavior === 'FAIL'),
      !missingObligationCaseIds.length && scenarios.every(scenario => scenario.structure.observations === 'COMPLETE'),
      scenarios.every(scenario => scenario.structure.behavior === 'PASS')),
    ...coverageOutcome(scenarios.some(scenario => scenario.behavior === 'FAIL'),
      !missingObligationCaseIds.length && scenarios.every(scenario => scenario.observations === 'COMPLETE'),
      scenarios.every(scenario => scenario.behavior === 'PASS')),
    missingObligationCaseIds, scenarios,
  };
}

export function groupExecution(coverage, receipts, initialWindowVerified) {
  const complete = initialWindowVerified && coverage.observations === 'COMPLETE' &&
    receipts.every(receipt => receipt.observations === 'COMPLETE');
  const failed = coverage.behavior === 'FAIL' || receipts.some(receipt => receipt.behavior === 'FAIL');
  const passed = coverage.behavior === 'PASS' && receipts.every(receipt => receipt.execution === 'PASS');
  const result = coverageOutcome(failed, complete, passed);
  return {...result, execution:complete && result.behavior !== 'NOT_RUN' ? result.behavior : 'INCOMPLETE'};
}

export function groupCoverage(selection, replay = replayReceipt, onVerifiedGroup = () => {}) {
  const runIds = new Set();
  const roots = new Set();
  const journals = new Set();
  return selection.map(({id, runs}) => {
    const verified = runs.map(run => replay(run));
    const receipts = verified.map(run => run.receipt);
    for (const {receipt, rootSha256} of verified) {
      requireEvidence(!runIds.has(receipt.runId) && !roots.has(rootSha256), 'Coverage cannot reuse the same sealed run');
      runIds.add(receipt.runId);
      roots.add(rootSha256);
      if (receipt.measurement.deviceLeaseMs !== null) {
        const journal = receipt.measurement.commandJournalSha256;
        requireEvidence(typeof journal === 'string' && digest.test(journal) && !journals.has(journal),
          'Coverage cannot reuse or omit the same underlying command journal');
        journals.add(journal);
      }
    }
    const window = assertCompatibleRuns(receipts);
    onVerifiedGroup(id, verified);
    const missingInitialWindowRunIds = receipts.filter(receipt => !initialWindow(receipt)).map(receipt => receipt.runId);
    const inSessionWindowChanges = receipts.map(receipt => ({runId:receipt.runId, changes:measuredChanges(receipt)}))
      .filter(item => item.changes.length);
    const unselected = phase1CaseIds.filter(caseId => receipts.every(receipt => receipt.caseId !== caseId));
    const coverage = scenarioCoverage(verified);
    return {
      id, candidate:receipts[0].candidate.identity, window,
      initialWindowStatus:missingInitialWindowRunIds.length ? 'INCOMPLETE' : 'VERIFIED',
      missingInitialWindowRunIds, inSessionWindowChanges,
      selectedObservationStatus:!missingInitialWindowRunIds.length && receipts.every(receipt => receipt.observations === 'COMPLETE') ?
        'COMPLETE' : 'INCOMPLETE',
      unselectedCaseIds:unselected,
      cases:verified.map(summary),
      ...groupExecution(coverage, receipts, !missingInitialWindowRunIds.length),
      structure:coverage,
    };
  });
}

/** Combine complete case receipts for one signed candidate across exact layout groups. */
export function candidateCoverage(groups, definition = loadStructureDefinition(), registered = phase1CaseIds, readCase = currentContract) {
  const buckets = new Map();
  for (const {id, runs} of groups) {
    for (const run of runs) {
      const { receipt } = run;
      const {hdcServer,targetRef,targetKind,...candidate} = receipt.candidate.identity;
      const toolSha256 = receipt.tool?.sha256;
      requireEvidence(digest.test(toolSha256 ?? ''), 'Candidate coverage needs the verified replay tool identity');
      const identity = jsonDigest({candidate, toolSha256, targetKind});
      if (!buckets.has(identity)) buckets.set(identity, {candidate, toolSha256, targetKind, runs:[]});
      buckets.get(identity).runs.push({groupId:id, hdcServer, targetRef, window:initialWindow(receipt), ...run});
    }
  }
  const byCase = new Map(registered.map(id => [id,readCase(id)]));
  return [...buckets.values()].map(({candidate,toolSha256,targetKind,runs}) => {
    const coverage = scenarioCoverage(runs,definition,registered,id => byCase.get(id),{eligible:run => Boolean(run.window)});
    const unconditional = [];
    const conditional = [];
    for (const scenario of coverage.scenarios) {
      const {caseId} = scenario;
      const assertions = byCase.get(caseId)?.assertions;
      const conditionIds = assertions?.filter(assertion => assertion.condition).map(assertion => assertion.id) ?? [];
      if (!assertions?.length || conditionIds.length !== assertions.length) {
        unconditional.push(scenario);
        continue;
      }
      const selected = runs.filter(({receipt}) => receipt.caseId === caseId && !scenario.staleRunIds.includes(receipt.runId));
      const applicability = selected.map(({receipt,window}) => ({
        runId:receipt.runId, window, conditions:receipt.conditions ?? {},
      }));
      const applies = applicability.some(run => conditionIds.some(id => run.conditions[id]?.status === 'APPLIES'));
      const unresolved = applicability.some(run => !run.window || conditionIds.some(id =>
        !['DOES_NOT_APPLY','APPLIES'].includes(run.conditions[id]?.status)));
      const status = !selected.length ? 'UNEXERCISED' :
        unresolved ? 'UNKNOWN' : applies ? 'APPLIES' : 'DOES_NOT_APPLY';
      const structureBound = scenario.states.some(state => state.conditionId);
      const exclusionVerified = status === 'DOES_NOT_APPLY' && scenario.structure.behavior === 'PASS' &&
        (!structureBound || scenario.observations === 'COMPLETE');
      conditional.push({caseId,status,applicability,observations:scenario.observations,behavior:scenario.behavior,
        exclusionVerified});
    }
    const required = coverageOutcome(unconditional.some(item => item.behavior === 'FAIL'),
      !coverage.missingObligationCaseIds.length && unconditional.every(item => item.observations === 'COMPLETE'),
      unconditional.length > 0 && unconditional.every(item => item.behavior === 'PASS'));
    const conditionalComplete = conditional.every(item => item.exclusionVerified ||
      item.status === 'APPLIES' && item.observations === 'COMPLETE');
    const behavior = coverageOutcome(
      required.behavior === 'FAIL' || conditional.some(item => item.behavior === 'FAIL') ||
        runs.some(({receipt}) => receipt.behavior === 'FAIL'),
      required.observations === 'COMPLETE' && conditionalComplete,
      required.behavior === 'PASS' && conditional.every(item =>
        item.exclusionVerified || item.status === 'APPLIES' && item.behavior === 'PASS'),
    );
    return {
      candidate, toolSha256, targetKind,
      runs:runs.map(({groupId,hdcServer,targetRef,window,receipt,rootSha256}) => ({
        groupId, hdcServer, targetRef, window, caseId:receipt.caseId, runId:receipt.runId, rootSha256,
      })),
      required:{...required, caseIds:unconditional.map(item => item.caseId)},
      conditional, coverage, ...behavior,
      execution:behavior.observations === 'COMPLETE' && behavior.behavior !== 'NOT_RUN' ? behavior.behavior : 'INCOMPLETE',
    };
  });
}

function legacyCoverage(values, tokens) {
  requireEvidence(tokens.length === 4 && new Set(tokens.map(token => token.name)).size === 4 &&
    ['search','reading'].every(key => values[key] && digest.test(values[`${key}-root`] ?? '')),
  'Phase 0 coverage requires both receipt paths and their separate handoff SHA-256 values');
  const runs = ['search','reading'].map((key, index) => replayReceipt({
    receiptPath:values[key], expectedRoot:values[`${key}-root`], contract:loadCase(phase0CaseIds[index]),
  }));
  const receipts = runs.map(run => run.receipt);
  requireEvidence(receipts[0].runId !== receipts[1].runId, 'Phase 0 handoff requires two distinct runs');
  assertCompatibleRuns(receipts);
  return {
    report:{
      observationStatus:receipts.every(receipt => receipt.observations === 'COMPLETE') ? 'COMPLETE' : 'INCOMPLETE',
      capabilities:receipts[0].capabilities, cases:runs.map(summary),
    },
    pass:receipts.every(receipt => receipt.execution === 'PASS'),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, tokens } = parseArgs({ options: {
      selection: {type:'string'}, search: {type:'string'}, 'search-root': {type:'string'},
      reading: {type:'string'}, 'reading-root': {type:'string'},
    }, tokens:true, strict:true, allowPositionals:false });
    let result;
    if (values.selection) {
      requireEvidence(tokens.length === 1, 'Supply only one explicit Phase 1 coverage selection file');
      const verified = [];
      const groups = groupCoverage(readSelection(values.selection), replayReceipt, (id, runs) => verified.push({id,runs}));
      const candidates = candidateCoverage(verified);
      result = {report:{groups,candidates}, pass:candidates.every(candidate => candidate.execution === 'PASS')};
    } else result = legacyCoverage(values, tokens);
    console.log(JSON.stringify(result.report, null, 2));
    if (!result.pass) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({execution:'INCOMPLETE', reason:error.message}));
    process.exitCode = 1;
  }
}

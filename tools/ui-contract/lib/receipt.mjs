import { dirname, basename, resolve } from 'node:path';
import { EvidenceError } from '../../lib/native-ui-evidence.mjs';
import { evidenceStore, jsonBytes, jsonDigest, requireEvidence, validate, verifyChain } from './evidence.mjs';
import { caseIds, equalJson, loadCase, pageStatus, platformCapabilities, toolIdentity } from './cases.mjs';
import { sourceUnknownExpandTrigger, usesSourceUnknownExpand } from './source-unknown-expand.mjs';
import { evaluateLayout } from './layout.mjs';
import { evaluateSearch } from './search.mjs';
import { evaluateMotion } from './motion.mjs';
import { systemSpeechApplicability } from './control-capsule.mjs';
import { evaluateSource } from './source.mjs';
import { conditionApplicability } from './receipt-conditions.mjs';
import { conditionBoundSourceKinds } from './source-read.mjs';
import { searchEntrySourceSample, usesSearchEntrySourceRead } from './search-entry-source-read.mjs';
import { isReservedTypographyCase } from './source-reserved-typography.mjs';
import { assessStructure } from './receipt-structure.mjs';
import { loadStructureDefinition } from './structure-contract.mjs';
import { fixtureAdmission, loadCandidate } from '../collectors/harmonyos/run.mjs';
import { sessionContext } from '../collectors/harmonyos/records.mjs';

export { assessStructure };

function publicIdentity(candidate) {
  const { appBuildId, appContentHash, hapSha256, sourceFingerprint, buildRunId, hdcServer, targetRef, targetKind } = candidate;
  return { appBuildId, appContentHash, hapSha256, sourceFingerprint, buildRunId, hdcServer, targetRef, targetKind };
}

function evaluate(assertion, context) {
  const selected = { ...assertion, acceptedSources: assertion.sources };
  if (assertion.evaluator === 'layout') return evaluateLayout(selected, context.samples);
  if (assertion.evaluator === 'search') return evaluateSearch(selected, context);
  if (assertion.evaluator === 'source') return evaluateSource(selected, context);
  if (assertion.evaluator === 'motion') return evaluateMotion(selected, context);
  throw new Error(`Unknown assertion evaluator ${assertion.evaluator}`);
}

function mergeRefs(refs) {
  const merged = new Map();
  for (const ref of refs) {
    const previous = merged.get(ref.path);
    requireEvidence(!previous || equalJson(ref, previous), 'One evidence path has conflicting identities');
    merged.set(ref.path, ref);
  }
  return [...merged.values()];
}

function attachReadingClip(context, open) {
  const sample = context.samples['control-open'];
  const action = context.actions.open;
  if (!sample || !action || open?.verdict !== 'PASS') return;
  const succeeded = context.events.filter(event => event.kind === 'reading.control-committed' &&
    event.channel === 'business' && event.instanceId === sample.instanceId &&
    event.eventSeq > action.beforeSeq && event.eventSeq <= sample.beforeSeq && event.payload.direction === 'open');
  if (succeeded.length !== 1) return;
  const transitionId = succeeded[0].payload.transitionId;
  const matches = context.events.filter(event => event.kind === 'reading.control-motion' &&
    event.channel === 'motion' && event.instanceId === sample.instanceId && event.eventSeq <= sample.beforeSeq &&
    event.payload.transitionId === transitionId && event.payload.direction === 'open' &&
    event.payload.blockIndex === event.payload.blockCount - 1 && event.payload.endReason === 'completed');
  sample.transitionId = transitionId;
  if (matches.length !== 1) return;
  const clip = matches[0].payload.frames?.at(-1)?.contentClip;
  if (clip?.id === 'reader-control-motion-content-clip' && clip.mounted === true && clip.clipToFrame === true &&
    Number.isFinite(clip.borderRadiusVp) && clip.inspectorSource === 'FrameNode.getInspectorInfo') {
    const shape = { id:clip.id, shape:'roundedRect', radiusVp:clip.borderRadiusVp, source:'debug-frame' };
    if (!sample.clipShapes.some(existing => equalJson(existing, shape))) sample.clipShapes.push(shape);
    sample.evidenceRefs = mergeRefs([...sample.evidenceRefs, ...matches[0].evidenceRefs]);
  }
}

function assertionResults(contract, context, store, candidateRefs) {
  const results = new Map();
  const verifiedRefs = new Map();
  const requiredWithPartialFailure = [];
  const requiredIds = new Set();
  const conditions = {};
  const append = contract.id === 'bookshelf.search-append' ?
    contract.assertions.find(assertion => assertion.kind === 'phase-operation' && assertion.expected.action === 'need-more') : undefined;
  const appendAssessment = append && !context.fatal ? evaluate(append, context) : undefined;
  const firstOpening = usesSourceUnknownExpand(contract);
  const trigger = firstOpening && sourceUnknownExpandTrigger(context);
  for (const assertion of contract.assertions) {
    const sourceCondition = assertion.evaluator === 'source' && ['surface-text','retained-read-retry'].includes(assertion.kind)
      ? assertion.expected.conditionAssertion : undefined;
    let supported = !context.fatal && (!firstOpening || Boolean(trigger));
    if (supported && contract.phase === undefined && assertion.kind === 'clip') attachReadingClip(context, results.get('reading.control-open'));
    if (contract.phase === undefined && assertion.kind === 'relativeDelta') {
      supported &&= results.get('search.results-settled')?.verdict === 'PASS' &&
        results.get('search.ime-before-input')?.verdict === 'PASS';
      if (supported) {
        const continuityId = context.actions['open-search'].actionId;
        for (const state of [assertion.sample, assertion.baseline]) context.samples[state].continuityId = continuityId;
      }
    }
    if (sourceCondition) supported &&= results.get(sourceCondition)?.verdict === 'PASS' &&
      conditions[sourceCondition]?.status === 'APPLIES' && conditions[sourceCondition]?.sampleApplies === true;
    let assessed = supported ? (assertion === append ? appendAssessment : evaluate(assertion, context)) : {
      verdict: 'NOT_RUN', reason: context.fatal ?? (firstOpening && !trigger ?
        'No uniquely verified committed write with a withheld receipt from the current Source opening' : sourceCondition
        ? (assertion.kind === 'surface-text' ? 'No applicable native Source state for the text assertion' :
          'No passing native retained failure for the Refresh list assertion')
        : 'No verified editor continuity across the two native samples'),
    };
    const tts = systemSpeechApplicability(assertion, context, contract);
    const condition = conditionApplicability(assertion, context, appendAssessment ?? assessed, contract, tts, conditions);
    if (condition) conditions[assertion.id] = condition;
    if (condition?.status === 'DOES_NOT_APPLY') {
      assessed = {...assessed, actual:null, verdict:'NOT_RUN', reason:condition.reason};
    }
    const required = condition?.required ?? assertion.required !== false;
    if (required) requiredIds.add(assertion.id);
    if (required && assessed.verdict === 'FAIL' && assessed.observationsComplete === false) {
      requiredWithPartialFailure.push(assertion.id);
    }
    const verifiedSearchEntry = condition && condition.status !== 'UNKNOWN' && usesSearchEntrySourceRead(contract);
    const verifiedReadCondition = condition && condition.status !== 'UNKNOWN' &&
      (assertion.evaluator === 'source' && conditionBoundSourceKinds.includes(assertion.kind) ||
        assertion.evaluator === 'search' && assertion.kind === 'phase-history-loading' || verifiedSearchEntry);
    const ownerEvidence = supported && assertion.sources.includes('app-owner') &&
      (assessed.verdict !== 'NOT_RUN' || verifiedReadCondition) ?
      [candidateRefs.manifest, candidateRefs.deployment, candidateRefs.snapshot,
        ...(contract.phase !== undefined ? contract.ownerSources.map(path => candidateRefs.ownerSources[path]) : [])] : [];
    const entryEvidence = verifiedSearchEntry ? context.samples?.[searchEntrySourceSample]?.evidenceRefs ?? [] : [];
    const refs = mergeRefs([...assessed.evidenceRefs ?? [], ...trigger?.evidenceRefs ?? [], ...entryEvidence, ...ownerEvidence]);
    for (const ref of refs) {
      const previous = verifiedRefs.get(ref.path);
      if (previous) requireEvidence(equalJson(ref, previous), 'One evidence path has conflicting identities');
      else {
        store.bytes(ref);
        verifiedRefs.set(ref.path, ref);
      }
    }
    const actual = tts ? { ...assessed.actual, systemSpeechApplicability:tts } : assessed.actual ?? null;
    results.set(assertion.id, { id: assertion.id, actual,
      expected: assessed.expected ?? assertion.expected, verdict: assessed.verdict,
      reason: assessed.reason ?? '', evidenceRefs: refs });
  }
  return { assertions: [...results.values()], requiredIds, requiredWithPartialFailure, conditions };
}

function coverage(contract, results) {
  const selected = new Map(results.map(result => [result.id, result.verdict]));
  const available = isReservedTypographyCase(contract.id) ? [...caseIds, contract.id] : caseIds;
  return Object.fromEntries(available.map(id => {
    const item = id === contract.id ? contract : loadCase(id);
    return [id, {page:pageStatus(item.pageId), selected:id === contract.id,
      assertions:Object.fromEntries(item.assertions.map(assertion => [assertion.id,
        id === contract.id ? selected.get(assertion.id) ?? 'NOT_RUN' : 'NOT_RUN']))}];
  }));
}

function openSession({store, contract, refs, session, sessionRef}) {
  const candidate = loadCandidate(store, refs, contract);
  const fixture = store.json(session.fixture);
  const observedFixture = fixtureAdmission(fixture, contract, candidate);
  const chainTail = verifyChain(session.chain);
  let context;
  try {
    context = sessionContext({store, session, sessionRef, candidate, contract, publicFixtureScope:fixture.publicFixtureScope});
    if (context.records.length) {
      const began = Date.parse(context.records[0].recordedAt);
      requireEvidence(observedFixture <= began && began - observedFixture <= 10 * 60 * 1000,
        'Fixture observation did not cover the start of the collected session');
    }
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    context = {fatal:error.message, problems:[error.message]};
  }
  return {candidate, chainTail, context};
}

function unresolvedReadiness(context, structure, conditions) {
  const adjudicated = new Set((structure?.states ?? []).filter(state =>
    state.observationsComplete && (state.verdict === 'FAIL' ||
      state.conditionId && conditions?.[state.conditionId]?.status === 'DOES_NOT_APPLY')).map(state => state.sampleId));
  return Object.entries(context.sampleReadiness ?? {}).filter(([id]) => !adjudicated.has(id))
    .map(([id, issue]) => `${id}: ${issue}`);
}

function verifyStructureReferences(store, structure) {
  const refs = mergeRefs((structure?.states ?? []).flatMap(state => state.checks.flatMap(check => check.evidenceRefs)));
  for (const ref of refs) store.bytes(ref);
}

function hasVerifiedStructureExclusions(structure, conditions, contract) {
  const inherited = new Map(contract.assertions.filter(assertion => assertion.evaluator === 'source' &&
    assertion.kind === 'surface-text' && assertion.expected.conditionAssertion)
    .map(assertion => [assertion.id,assertion.expected.conditionAssertion]));
  const ids = Object.keys(conditions ?? {});
  return ids.length > 0 && ids.every(id => conditions[id].status === 'DOES_NOT_APPLY' &&
    structure?.states.some(state => state.conditionId === (inherited.get(id) ?? id) && state.observationsComplete));
}

export function summarizeAcceptance({assertions, structure, observationsComplete, excluded = false}) {
  const complete = observationsComplete && (!structure || structure.observations === 'COMPLETE');
  const observations = complete ? 'COMPLETE' : 'INCOMPLETE';
  const behavior = structure?.behavior === 'FAIL' || assertions.some(assertion => assertion.verdict === 'FAIL') ? 'FAIL' :
    complete && !excluded ? 'PASS' : 'NOT_RUN';
  return {observations, behavior, execution:complete && behavior !== 'NOT_RUN' ? behavior : 'INCOMPLETE'};
}

function recompute({store, contractRef, contract, refs, session, sessionRef}) {
  const {candidate, chainTail, context} = openSession({store, contract, refs, session, sessionRef});
  const { assertions, requiredIds, requiredWithPartialFailure, conditions } = assertionResults(contract, context, store, refs);
  const structure = assessStructure(contract, context, undefined, {conditions});
  verifyStructureReferences(store, structure);
  const readiness = unresolvedReadiness(context, structure, conditions);
  const commands = context.records ?? [];
  const elapsedMs = Date.parse(commands.at(-1)?.recordedAt) - Date.parse(commands[0]?.recordedAt);
  const measurement = {
    deviceLeaseMs: Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : null,
    stableSamples: Object.entries(context.samples ?? {}).filter(([id]) =>
      contract.steps.some(step => step.id === id && step.kind === 'sample')).length,
    screenshotCommands: commands.filter(record => record.ok === true &&
      record.args?.slice(0,3).join(' ') === 'shell uitest screenCap').length,
    treeCommands: commands.filter(record => record.ok === true &&
      record.args?.slice(0,3).join(' ') === 'shell uitest dumpLayout').length,
    motionBlockPayloadBytes: (context.events ?? []).filter(event => event.kind === 'reading.control-motion')
      .reduce((bytes, event) => bytes + jsonBytes(event.payload).length, 0),
  };
  if (contract.phase !== undefined) {
    measurement.initialWindowSampleId = contract.steps.find(step => step.kind !== 'action')?.id ?? null;
    measurement.sampleWindowOrder = Object.keys(context.samples ?? {});
    measurement.commandJournalSha256 = session.commands.sha256;
    measurement.sampleWindows = Object.fromEntries(Object.entries(context.samples ?? {}).map(([id, { window, branch }]) =>
      [id, { widthPx:window.rectPx.width, heightPx:window.rectPx.height, density:window.density,
        orientation:window.orientation, fontScale:window.fontScale ?? null, branch }]));
  }
  const noApplicableAssertion = Object.keys(conditions).length > 0 && requiredIds.size === 0;
  const excluded = noApplicableAssertion && hasVerifiedStructureExclusions(structure, conditions, contract);
  const observationsComplete = session.result === 'COMPLETED' && !context.problems.length && !readiness.length &&
    !requiredWithPartialFailure.length && !Object.values(conditions).some(condition => condition.status === 'UNKNOWN') &&
    (!noApplicableAssertion || excluded) &&
    !assertions.some(assertion => assertion.verdict === 'NOT_RUN' && requiredIds.has(assertion.id));
  const acceptance = summarizeAcceptance({assertions, structure, observationsComplete, excluded});
  return validate('receipt', {
    schema:'reader-ui-receipt-v1', runId:session.runId, case:contractRef, caseId:contract.id, caseVersion:contract.version,
    caseSha256:jsonDigest(contract), tool:toolIdentity(), candidate:{...refs, identity:publicIdentity(candidate)},
    session:sessionRef, chainTail, assertions, ...acceptance, page:pageStatus(contract.pageId),
    ...(structure ? {structure} : {}),
    ...(Object.keys(conditions).length ? {conditions} : {}),
    capabilities:Object.fromEntries(['harmonyos','android','ios'].map(platform => [platform, platformCapabilities(platform)])),
    coverage:coverage(contract, assertions), measurement,
    diagnostics:[session.reason, ...context.problems, ...readiness,
      noApplicableAssertion ? 'No functional assertion applied to the observed conditional scenario' : null,
      ...requiredWithPartialFailure.map(id => `${id}: observed deviation and missing required evidence`)].filter(Boolean),
  });
}

export function sealReceipt(run, contract) {
  const contractRef = run.store.writeJson('case.json', contract);
  const receipt = recompute({...run, contract, contractRef});
  const ref = run.store.writeJson('receipt.json', receipt);
  run.store.write('receipt.sha256', `${ref.sha256}\n`);
  return {receipt, rootSha256:ref.sha256};
}

function readSealedReceipt(receiptPath, expectedRoot) {
  const absolute = resolve(receiptPath);
  const store = evidenceStore(dirname(absolute));
  const ref = store.reference(basename(absolute));
  requireEvidence(ref.sha256 === expectedRoot, 'Receipt SHA-256 differs from the sealed handoff root');
  const supplied = validate('receipt', store.json(ref));
  return {store, ref, supplied};
}

export function replayReceipt({receiptPath, expectedRoot, contract}) {
  const started = performance.now();
  const {store, ref, supplied} = readSealedReceipt(receiptPath, expectedRoot);
  requireEvidence(supplied.caseId === contract.id && supplied.caseVersion === contract.version &&
    supplied.caseSha256 === jsonDigest(contract) && equalJson(supplied.tool, toolIdentity()) &&
    equalJson(store.json(supplied.case), contract), 'Receipt case or trusted tool version mismatch');
  const session = validate('session', store.json(supplied.session));
  const derived = recompute({store, contract, contractRef:supplied.case, refs:supplied.candidate,
    session, sessionRef:supplied.session});
  requireEvidence(equalJson(supplied, derived), 'Sealed receipt differs from independently recomputed assertions or coverage');
  return {receipt:derived, rootSha256:ref.sha256, replayMs:performance.now() - started};
}

/** Reassess a pinned historical capture, retaining its raw case and local verdicts. */
export function reassessOriginalStructure({receiptPath, expectedRoot, historicalDefinition}) {
  const {store, ref, supplied} = readSealedReceipt(receiptPath, expectedRoot);
  const {caseId, caseSha256, states, samples} = historicalDefinition;
  const contract = validate('case', store.json(supplied.case));
  requireEvidence(supplied.caseId === caseId && contract.id === caseId && supplied.caseVersion === contract.version &&
    supplied.caseSha256 === caseSha256 && supplied.case.sha256 === caseSha256 &&
    jsonDigest(contract) === caseSha256, 'The historical state mapping requires the exact original case bytes');
  const session = validate('session', store.json(supplied.session));
  const {candidate, chainTail, context} = openSession({
    store, contract, refs:supplied.candidate, session, sessionRef:supplied.session,
  });
  requireEvidence(session.runId === supplied.runId && chainTail === supplied.chainTail &&
    equalJson(publicIdentity(candidate), supplied.candidate.identity),
  'The historical session or candidate differs from the independent original root');
  const definition = loadStructureDefinition();
  const current = definition.scenarioObligations.find(item => item.caseId === caseId);
  requireEvidence(current && states && samples &&
    Object.entries(current.states).every(([role, rule]) => states[role] === rule) &&
    Object.values(states).every(rule => Object.values(current.states).includes(rule)),
  'The historical mapping must retain the current scenario obligations and may reuse its rules for historical samples');
  const actions = historicalDefinition.actions ?? Object.fromEntries(Object.entries(samples).map(([role, sampleId]) =>
    [role, contract.steps.find(step => step.id === sampleId)?.afterAction ?? null]));
  const revised = {...definition, scenarioObligations:definition.scenarioObligations.map(item =>
    item.caseId === caseId ? {...item, states, actions} : item)};
  const conditions = supplied.conditions;
  const structure = assessStructure({...contract, structure:samples}, context, revised, {historical:true, conditions});
  structure.definitionSha256 = jsonDigest(definition);
  verifyStructureReferences(store, structure);
  for (const evidence of mergeRefs(supplied.assertions.flatMap(assertion => assertion.evidenceRefs))) store.bytes(evidence);
  const assertions = supplied.assertions.map(({id, verdict, reason, evidenceRefs}) => {
    return {id, verdict, reason, evidenceRefs};
  });
  const readiness = unresolvedReadiness(context, structure, conditions);
  const observationsComplete = supplied.observations === 'COMPLETE' && session.result === 'COMPLETED' &&
    !context.problems.length && !readiness.length;
  const excluded = supplied.behavior === 'NOT_RUN' && hasVerifiedStructureExclusions(structure, conditions, contract);
  return {
    source:{rootSha256:ref.sha256, caseId, caseVersion:contract.version, caseSha256, tool:supplied.tool,
      candidate:supplied.candidate.identity, session:supplied.session, chainTail},
    structure, assertions, ...summarizeAcceptance({assertions, structure, observationsComplete, excluded}),
    diagnostics:[session.reason, ...context.problems, ...readiness].filter(Boolean),
  };
}

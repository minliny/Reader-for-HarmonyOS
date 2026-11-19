import { dirname, basename, resolve } from 'node:path';
import { evidenceStore, jsonBytes, jsonDigest, requireEvidence, validate, verifyChain } from './evidence.mjs';
import { caseIds, equalJson, loadCase, pageStatus, platformCapabilities, toolIdentity } from './cases.mjs';
import { evaluateLayout } from './layout.mjs';
import { evaluateSearch } from './search.mjs';
import { evaluateMotion } from './motion.mjs';
import { fixtureAdmission, loadCandidate } from '../collectors/harmonyos/run.mjs';
import { sessionContext } from '../collectors/harmonyos/records.mjs';

function publicIdentity(candidate) {
  const { appBuildId, appContentHash, hapSha256, sourceFingerprint, buildRunId, hdcServer, targetRef, targetKind } = candidate;
  return { appBuildId, appContentHash, hapSha256, sourceFingerprint, buildRunId, hdcServer, targetRef, targetKind };
}

function evaluate(assertion, context) {
  const selected = { ...assertion, acceptedSources: assertion.sources };
  if (assertion.evaluator === 'layout') return evaluateLayout(selected, context.samples);
  if (assertion.evaluator === 'search') return evaluateSearch(selected, context);
  return evaluateMotion(selected, context);
}

function mergeRefs(refs) {
  return [...new Map(refs.map(ref => [ref.path, ref])).values()];
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
  for (const assertion of contract.assertions) {
    let supported = !context.fatal;
    if (supported && assertion.kind === 'clip') attachReadingClip(context, results.get('reading.control-open'));
    if (assertion.kind === 'relativeDelta') {
      supported &&= results.get('search.results-settled')?.verdict === 'PASS' &&
        results.get('search.ime-before-input')?.verdict === 'PASS';
      if (supported) {
        const continuityId = context.actions['open-search'].actionId;
        for (const state of [assertion.sample, assertion.baseline]) context.samples[state].continuityId = continuityId;
      }
    }
    const assessed = supported ? evaluate(assertion, context) : {
      verdict: 'NOT_RUN', reason: context.fatal ?? 'No verified editor continuity across the two native samples',
    };
    const ownerEvidence = supported && assertion.sources.includes('app-owner') && assessed.verdict !== 'NOT_RUN' ?
      [candidateRefs.manifest, candidateRefs.deployment, candidateRefs.snapshot] : [];
    const refs = mergeRefs([...assessed.evidenceRefs ?? [], ...ownerEvidence]);
    for (const ref of refs) {
      const previous = verifiedRefs.get(ref.path);
      if (previous) requireEvidence(equalJson(ref, previous), 'One evidence path has conflicting identities');
      else {
        store.bytes(ref);
        verifiedRefs.set(ref.path, ref);
      }
    }
    results.set(assertion.id, { id: assertion.id, actual: assessed.actual ?? null,
      expected: assessed.expected ?? assertion.expected, verdict: assessed.verdict,
      reason: assessed.reason ?? '', evidenceRefs: refs });
  }
  return [...results.values()];
}

function coverage(contract, results) {
  const selected = new Map(results.map(result => [result.id, result.verdict]));
  return Object.fromEntries(caseIds.map(id => {
    const item = id === contract.id ? contract : loadCase(id);
    return [id, {page:pageStatus(item.pageId), selected:id === contract.id,
      assertions:Object.fromEntries(item.assertions.map(assertion => [assertion.id, selected.get(assertion.id) ?? 'NOT_RUN']))}];
  }));
}

function recompute({store, contractRef, contract, refs, session, sessionRef}) {
  const candidate = loadCandidate(store, refs, contract);
  const observedFixture = fixtureAdmission(store.json(session.fixture), contract, candidate);
  const chainTail = verifyChain(session.chain);
  let context;
  try {
    context = sessionContext({store, session, sessionRef, candidate, contract});
    if (context.records.length) {
      const began = Date.parse(context.records[0].recordedAt);
      requireEvidence(observedFixture <= began && began - observedFixture <= 10 * 60 * 1000,
        'Fixture observation did not cover the start of the collected session');
    }
  } catch (error) {
    context = {fatal:error.message, problems:[error.message]};
  }
  const assertions = assertionResults(contract, context, store, refs);
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
  const observations = session.result === 'COMPLETED' && !context.problems.length &&
    !assertions.some((assertion, i) => assertion.verdict === 'NOT_RUN' && contract.assertions[i].required !== false) ? 'COMPLETE' : 'INCOMPLETE';
  const behavior = assertions.some(assertion => assertion.verdict === 'FAIL') ? 'FAIL' :
    observations === 'COMPLETE' ? 'PASS' : 'NOT_RUN';
  return validate('receipt', {
    schema:'reader-ui-receipt-v1', runId:session.runId, case:contractRef, caseId:contract.id, caseVersion:contract.version,
    caseSha256:jsonDigest(contract), tool:toolIdentity(), candidate:{...refs, identity:publicIdentity(candidate)},
    session:sessionRef, chainTail, assertions, observations, behavior,
    execution:observations === 'INCOMPLETE' ? 'INCOMPLETE' : behavior, page:pageStatus(contract.pageId),
    capabilities:Object.fromEntries(['harmonyos','android','ios'].map(platform => [platform, platformCapabilities(platform)])),
    coverage:coverage(contract, assertions), measurement,
    diagnostics:[session.reason, ...context.problems].filter(Boolean),
  });
}

export function sealReceipt(run, contract) {
  const contractRef = run.store.writeJson('case.json', contract);
  const receipt = recompute({...run, contract, contractRef});
  const ref = run.store.writeJson('receipt.json', receipt);
  run.store.write('receipt.sha256', `${ref.sha256}\n`);
  return {receipt, rootSha256:ref.sha256};
}

export function replayReceipt({receiptPath, expectedRoot, contract}) {
  const started = performance.now();
  const absolute = resolve(receiptPath);
  const store = evidenceStore(dirname(absolute));
  const ref = store.reference(basename(absolute));
  requireEvidence(ref.sha256 === expectedRoot, 'Receipt SHA-256 differs from the sealed handoff root');
  const supplied = validate('receipt', store.json(ref));
  requireEvidence(supplied.caseId === contract.id && supplied.caseVersion === contract.version &&
    supplied.caseSha256 === jsonDigest(contract) && equalJson(supplied.tool, toolIdentity()) &&
    equalJson(store.json(supplied.case), contract), 'Receipt case or trusted tool version mismatch');
  const session = validate('session', store.json(supplied.session));
  const derived = recompute({store, contract, contractRef:supplied.case, refs:supplied.candidate,
    session, sessionRef:supplied.session});
  requireEvidence(equalJson(supplied, derived), 'Sealed receipt differs from independently recomputed assertions or coverage');
  return {receipt:derived, rootSha256:ref.sha256, replayMs:performance.now() - started};
}

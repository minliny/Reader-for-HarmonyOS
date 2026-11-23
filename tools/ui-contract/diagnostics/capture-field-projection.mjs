import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { verifyFrozenTool } from '../../page-structure/receipt-evidence.mjs';
import { evidenceStore, requireEvidence } from '../lib/evidence.mjs';

const auditedSample = {
  caseId: 'source-management.empty-library',
  sampleId: 'source-ready',
  assertionId: 'source.layout.footer-empty-library',
  rootSha256: 'b77ccd8020d426a7fa0e32bed92c199419de3cc44734c119837da3057f454d17',
  toolSha256: '71689ff1c09d38fa2c20ddd98bc13a08aa162b49a72dcb15438724ad86d78122',
};
const nodeFields = new Set(['id', 'alias', 'key', 'path', 'parentPath', 'type', 'source',
  'rectPx', 'visibleRectPx', 'visible', 'opacity', 'enabled', 'clickable', 'focused']);

/** 仅对审计过的原始封存样本做诊断；不改变采集计划，也不执行动作或用例。 */
export async function compareAuditedCaptureFields({receiptPath, frozenToolRoot} = {}) {
  const {caseId, sampleId, assertionId, rootSha256, toolSha256} = auditedSample;
  const report = {diagnosticOnly:true, caseId, sampleId, assertionId, collection:'UNCHANGED',
    actionReplay:'NOT_RUN', caseReplay:'NOT_RUN'};
  const fallback = (reason, proofValidation = 'NOT_VERIFIED', comparison = 'NOT_RUN') => ({
    ...report, mode:'FULL_CAPTURE', proofValidation, comparison, fallbackReasons:[reason],
  });
  try {
    const path = resolve(receiptPath);
    const store = evidenceStore(dirname(path));
    const receiptRef = store.reference(basename(path));
    requireEvidence(receiptRef.sha256 === rootSha256, 'Receipt differs from the independently audited root');

    const tool = resolve(frozenToolRoot);
    verifyFrozenTool(tool, toolSha256);
    const load = name => import(pathToFileURL(resolve(tool, 'tools/ui-contract', name)).href);
    const [{loadCase}, {replayReceipt}, {loadCandidate}, {sessionContext}, {evaluateLayout}] = await Promise.all([
      load('lib/cases.mjs'), load('lib/receipt.mjs'), load('collectors/harmonyos/run.mjs'),
      load('collectors/harmonyos/records.mjs'), load('lib/layout.mjs'),
    ]);
    const contract = loadCase(caseId);
    // 先完整验证原用例、真实前置和原证明；投影阶段不构造裁剪版用例。
    const {receipt} = replayReceipt({receiptPath:path, expectedRoot:rootSha256, contract});
    const original = receipt.assertions.find(item => item.id === assertionId);
    requireEvidence(receipt.execution === 'PASS' && receipt.observations === 'COMPLETE' && original?.verdict === 'PASS',
      'Original session or selected assertion is not verified complete');
    store.bytes(receiptRef);
    const session = store.json(receipt.session);
    const candidate = loadCandidate(store, receipt.candidate, contract);
    const context = sessionContext({store, session, sessionRef:receipt.session, candidate, contract});
    const sample = context.samples[sampleId];
    const step = contract.steps.find(item => item.id === sampleId && item.kind === 'sample');
    const actionStep = contract.steps.find(item => item.id === step?.afterAction && item.kind === 'action');
    const action = context.actions[actionStep?.id];
    const assertion = contract.assertions.find(item => item.id === assertionId);
    const sampleLink = session.chain.find(({entry}) => entry.id === sampleId && entry.kind === 'sample');
    const actionLink = session.chain.find(({entry}) => entry.id === actionStep?.id && entry.kind === 'action');
    requireEvidence(!context.problems.length && session.runId === receipt.runId && sample?.sampleId === sampleId &&
      sampleLink && actionLink &&
      action && action.instanceId === sample.instanceId && sample.instanceId === session.instanceId &&
      assertion?.sample === sampleId && assertion.evaluator === 'layout' && assertion.kind === 'nonOverlap' &&
      assertion.baseline === undefined && assertion.action === undefined,
    'Selected assertion is not bound to the original verified sample and causal action');

    const omittedFields = [];
    const nodes = sample.nodes.map(node => {
      const fields = Object.keys(node).filter(key => !nodeFields.has(key)).sort();
      if (fields.length) omittedFields.push({path:node.path, fields});
      return Object.fromEntries(Object.entries(node).filter(([key]) => nodeFields.has(key)));
    });
    if (!omittedFields.length) return fallback('pilot:no-fields-omitted', 'VERIFIED');
    const projection = {...sample, nodes};
    const evaluate = value => ({id:assertionId, ...evaluateLayout({...assertion, acceptedSources:assertion.sources},
      {[sampleId]:value})});
    const full = evaluate(sample);
    const projected = evaluate(projection);
    if (!isDeepStrictEqual(full, original) || !isDeepStrictEqual(projected, full)) {
      return fallback('pilot:evaluator-results-differ', 'VERIFIED', 'MISMATCH');
    }
    const fullBytes = Buffer.byteLength(JSON.stringify(sample), 'utf8');
    const projectedBytes = Buffer.byteLength(JSON.stringify(projection), 'utf8');
    return {...report, mode:'POST_VALIDATION_FIELD_PROJECTION', proofValidation:'VERIFIED', comparison:'MATCH',
      sizeComparison:{scope:'HOST_NORMALIZED_SAMPLE_JSON', fullBytes, projectedBytes,
        savedBytes:fullBytes - projectedBytes, nodeCount:nodes.length},
      fallbackReasons:[], rootSha256, tool:receipt.tool,
      caseBinding:{id:caseId, version:receipt.caseVersion, sha256:receipt.caseSha256, ref:receipt.case},
      sourceSession:{runId:session.runId, instanceId:session.instanceId, platform:session.platform, ref:receipt.session,
        chainTail:receipt.chainTail, commandJournal:session.commands},
      sourceSample:{id:sampleId, chainRef:{index:sampleLink.index, sha256:sampleLink.sha256},
        windowMetrics:receipt.measurement.sampleWindows[sampleId]},
      waitActionContext:{mode:'READ_ONLY', actionStepId:actionStep.id, action,
        actionChainRef:{index:actionLink.index, sha256:actionLink.sha256}, actionWaitFor:actionStep.waitFor,
        sampleWaitFor:step.waitFor, quietMs:step.quietMs},
      projection, omittedFields, full, projected,
    };
  } catch (error) {
    return fallback(error.message);
  }
}

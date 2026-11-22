import { measureSourceNativeControl } from './source-native-control.mjs';

const policies = new Map([
  ['source-management.combined-filter-reset',{
    id:'source.clearFilters.combined',kind:'combined-filter-reset',action:'clear-filters',
    subject:'filter-empty-clear',target:'reader-source-clear-filters',
  }],
  ['source-management.read-retry',{
    id:'source.load.retryRead',kind:'read-retry',action:'retry-read',
    subject:'empty-read-retry',target:'reader-source-read-retry',
  }],
  ['source-management.row-detect-offline',{
    id:'source.row.detect.offline-dispatch',kind:'source-offline-detect',action:'detect-source',
    subject:'row-detect',target:'reader-source-row-detect-control',
  }],
  ['source-management.import-research-status-action',{
    id:'source.import-research-status-action',kind:'import-research-status-action',action:'press-research',
    subject:'status-action',target:'reader-source-status-action',
  }],
  ['source-management.original-recovery-body',{
    id:'source.recovery.original.body',kind:'recovery-body-text',action:'expand-recovery',
    subject:'original-expand-collapse',target:'reader-source-original-expand',
  }],
  ['source-management.unknown-recovery-body',{
    id:'source.recovery.unknown.body',kind:'recovery-body-text',action:'expand-recovery',
    subject:'unknown-expand-collapse',target:'reader-source-unknown-expand',
  }],
]);

const byAssertion = new Map([...policies.values()].map(policy=>[policy.id,policy]));
const targetId = selector => typeof selector === 'string' ? selector : selector?.id;

export function sourceNativeCenterStep(caseId, step) {
  const policy = policies.get(caseId);
  return Boolean(policy && step?.id === policy.action && step.kind === 'action' && step.op === 'click' &&
    !step.gesture && !step.tapEdge && targetId(step.target) === policy.target);
}

export function sourceNativeCenterAssertion(contract, assertion) {
  const policy = policies.get(contract?.id);
  if (policy && assertion?.id === policy.id && assertion.kind === policy.kind && assertion.action === policy.action &&
      contract.steps.some(step=>step.from === assertion.baseline && sourceNativeCenterStep(contract.id,step))) {
    return {subject:policy.subject,target:policy.target,position:'center'};
  }
}

export function sourceNativeCenterInteraction(assertion, sample, action, dispatch = action?.sourceCenterTap) {
  const policy = byAssertion.get(assertion.id);
  if (!policy || assertion.kind !== policy.kind || assertion.action !== policy.action ||
      action?.op !== 'click' || action.targetId !== policy.target || action.from !== assertion.baseline ||
      sample?.sampleId !== assertion.baseline || action.instanceId !== sample.instanceId ||
      !Number.isSafeInteger(dispatch?.probeSeq) || dispatch.probeSeq <= 0) return;
  const measured = measureSourceNativeControl(sample,policy.target);
  if (measured.verdict !== 'PASS') return;
  const {bounds,carrierPath} = measured.actual;
  if (dispatch.x !== Math.floor(bounds.left+bounds.width/2) || dispatch.y !== Math.floor(bounds.top+bounds.height/2)) return;
  return {subject:policy.subject,target:policy.target,bounds,carrierPath,visible:true,clipped:false,enabled:true,
    accepted:true,position:'center',actionId:assertion.action,baselineSampleId:assertion.baseline,dispatch};
}

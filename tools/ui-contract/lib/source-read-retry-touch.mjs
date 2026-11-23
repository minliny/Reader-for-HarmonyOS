import { requireEvidence } from '../../lib/native-ui-evidence.mjs';
import { measureSourceNativeControl } from './source-native-control.mjs';

const coldBaseline = 'source-read';
const retainedBaseline = 'retained-failure';
const retainedTarget = 'reader-source-retained-read-retry';
const retainedCondition = 'source.load.retainedReadFailure';
const policies = [
  {caseId:'source-management.read-retry-edge',assertionId:'source.load.retryRead.edge',kind:'read-retry',
    fixture:'public-source-read-v1',subject:'empty-read-retry',target:'reader-source-read-retry',
    action:'retry-read-edge',baseline:coldBaseline,terminal:'retry-settled',position:'top'},
  ...[['center','center'],['edge','top']].map(([suffix,position])=>({
    caseId:'source-management.retained-read-retry-'+suffix,assertionId:'source.load.retainedReadRetry.'+suffix,
    kind:'retained-read-retry',fixture:'public-source-retained-read-v1',subject:'read-refresh',target:retainedTarget,
    action:'refresh-read-'+suffix,baseline:retainedBaseline,terminal:'refresh-settled',position,
  })),
];

const byCase = new Map(policies.map(policy=>[policy.caseId,policy]));
const byAssertion = new Map(policies.map(policy=>[policy.assertionId,policy]));
export const sourceReadRetryTouchCase = id => byCase.has(id);
const cold = policy => policy.kind === 'read-retry';
const touchPosition = step => step?.tapEdge ?? 'center';

export function sourceReadRetryTouchStep(step,fixture) {
  const policy = policies.find(item=>item.action === step?.id && item.fixture === fixture?.id);
  if (!policy || !fixture.publicSources || step.kind !== 'action' || step.op !== 'click' || step.gesture === true ||
      step.from !== policy.baseline || step.target !== policy.target || touchPosition(step) !== policy.position ||
      (policy.position === 'top' ? step.requireFullContainment !== true : step.requireFullContainment !== undefined)) return;
  return policy;
}

function exactCondition(assertion,policy) {
  const expected = assertion.expected;
  return assertion.evaluator === 'source' && assertion.kind === policy.kind && assertion.condition &&
    assertion.required === false && assertion.action === policy.action && assertion.baseline === policy.baseline &&
    assertion.sample === policy.terminal && expected?.position === policy.position &&
    (cold(policy) ? assertion.entryAction === 'open-sources' && expected.state === 'readFailure' &&
      expected.requireNativeTouchTarget === true : expected.target === policy.target && expected.conditionAssertion === retainedCondition);
}

export function sourceReadRetryTouchAssertion(contract,assertion) {
  const policy = byCase.get(contract?.id);
  if (!policy || contract.pageId !== 'source-management' || contract.version !== 1 || assertion?.id !== policy.assertionId ||
      !exactCondition(assertion,policy) || !Array.isArray(contract.steps)) return;
  const tap = contract.steps.find(step=>step?.id === policy.action);
  const before = contract.steps.find(step=>step?.id === policy.baseline);
  const terminal = contract.steps.find(step=>step?.id === policy.terminal);
  const status = predicate => predicate?.kind === 'source.projection' && predicate.channel === 'business' &&
    predicate.match === 'latest' && predicate.fields?.['payload.state'] === (cold(policy) ? 'readFailure' : 'rows') &&
    (cold(policy) || predicate.fields['payload.readFact'] === 'refreshFailed');
  const receipt = (predicate,phase) => predicate?.kind === 'source.read-retry' && predicate.channel === 'business' &&
    predicate.fields?.['payload.phase'] === phase && (phase !== 'settled' || predicate.match === 'latest');
  if (sourceReadRetryTouchStep(tap,contract.fixture) !== policy ||
      before?.kind !== 'sample' || before.keyboard !== false || before.afterAction !== (cold(policy) ? 'open-sources' : 'reopen-sources') ||
      !before.anchors?.includes(policy.target) || !before.waitFor?.some(status) ||
      !tap.beforeEvent?.some(status) || !tap.waitFor?.some(item=>receipt(item,'started')) ||
      terminal?.kind !== 'sample' || terminal.keyboard !== false || terminal.afterAction !== policy.action ||
      !terminal.waitFor?.some(item=>receipt(item,'settled'))) return;
  return {subject:policy.subject,target:policy.target,position:policy.position};
}

function measuredPoint(bounds,position) {
  return {x:bounds.left+Math.floor(bounds.width/2),
    y:position === 'top' ? bounds.top+1 : bounds.top+Math.floor(bounds.height/2)};
}

export function sourceReadRetryTouchPoint(sample,policy) {
  requireEvidence(sample.sampleId === policy.baseline,'The Source read touch lacks its exact current failure sample');
  const measured = measureSourceNativeControl(sample,policy.target);
  requireEvidence(measured.verdict === 'PASS',measured.reason);
  return measuredPoint(measured.actual.bounds,policy.position);
}

export function sourceReadRetryNativeInteraction(assertion,sample,action) {
  const policy = byAssertion.get(assertion.id);
  const raw = action?.sourceReadRetryTap;
  if (!policy || !exactCondition(assertion,policy) || action?.op !== 'click' ||
      action.targetId !== policy.target || action.from !== policy.baseline || sample?.sampleId !== policy.baseline ||
      action.instanceId !== sample.instanceId || !Number.isSafeInteger(raw?.probeSeq) || raw.probeSeq <= 0) return;
  const measured = measureSourceNativeControl(sample,policy.target);
  if (measured.verdict !== 'PASS') return;
  const {bounds,carrierPath} = measured.actual;
  const point = measuredPoint(bounds,policy.position);
  if (raw.x !== point.x || raw.y !== point.y) return;
  return {subject:policy.subject,target:policy.target,position:policy.position,bounds,carrierPath,
    visible:true,clipped:false,enabled:true,accepted:true,actionId:assertion.action,baselineSampleId:assertion.baseline,dispatch:raw};
}

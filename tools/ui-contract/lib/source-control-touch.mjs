import { requireEvidence } from '../../lib/native-ui-evidence.mjs';
import { measureSourceNativeControl } from './source-native-control.mjs';
import { sourceReadObservation } from './source-read.mjs';
import { evaluateSourceRecoveryControl, sourceRecoveryControl } from './source-recovery-control.mjs';

const recoveryFixture = 'public-source-read-v1';
const rowFixture = 'public-source-row-action-targets-v1';

const policies = [
  {
    caseId:'source-management.original-reconcile-touch-center',
    id:'source.control.original.reconcile.center', targetId:'source.control.original.reconcile.target',
    targetKind:'recovery-native-control', subject:'original-reconcile',
    target:'reader-source-original-reconcile', branch:'original', control:'reconcile',
    action:'reconcile-original-center', baseline:'recovery-baseline', position:'center',
    fixture:recoveryFixture,
  },
  {
    caseId:'source-management.original-reconcile-touch-edge',
    id:'source.control.original.reconcile.edge', targetId:'source.control.original.reconcile.target',
    targetKind:'recovery-native-control', subject:'original-reconcile',
    target:'reader-source-original-reconcile', branch:'original', control:'reconcile',
    action:'reconcile-original-top', baseline:'recovery-baseline', position:'top',
    fixture:recoveryFixture,
  },
  {
    caseId:'source-management.original-continue-touch-center',
    id:'source.control.original.continue.center', targetId:'source.control.original.continue.target',
    targetKind:'recovery-native-control', subject:'original-continue',
    target:'reader-source-original-continue', branch:'original', control:'continue',
    action:'continue-original-center', baseline:'recovery-baseline', position:'center',
    fixture:recoveryFixture,
  },
  {
    caseId:'source-management.original-continue-touch-edge',
    id:'source.control.original.continue.edge', targetId:'source.control.original.continue.target',
    targetKind:'recovery-native-control', subject:'original-continue',
    target:'reader-source-original-continue', branch:'original', control:'continue',
    action:'continue-original-top', baseline:'recovery-baseline', position:'top',
    fixture:recoveryFixture,
  },
  {
    caseId:'source-management.unknown-reconcile-touch-center',
    id:'source.control.unknown.reconcile.center', targetId:'source.control.unknown.reconcile.target',
    targetKind:'recovery-native-control', subject:'unknown-reconcile',
    target:'reader-source-unknown-reconcile', branch:'unknown', control:'reconcile',
    action:'reconcile-unknown-center', baseline:'recovery-baseline', position:'center',
    fixture:recoveryFixture,
  },
  {
    caseId:'source-management.unknown-reconcile-touch-edge',
    id:'source.control.unknown.reconcile.edge', targetId:'source.control.unknown.reconcile.target',
    targetKind:'recovery-native-control', subject:'unknown-reconcile',
    target:'reader-source-unknown-reconcile', branch:'unknown', control:'reconcile',
    action:'reconcile-unknown-top', baseline:'recovery-baseline', position:'top',
    fixture:recoveryFixture,
  },
  {
    caseId:'source-management.row-login-touch-center',
    id:'source.control.row.login.center', targetId:'source.control.row.login.target',
    targetKind:'native-control-target', subject:'row-login',
    target:'reader-source-row-login-control', branch:'row', control:'login',
    action:'login-row-center', baseline:'row-baseline', position:'center',
    fixture:rowFixture,
  },
  {
    caseId:'source-management.row-login-touch-edge',
    id:'source.control.row.login.edge', targetId:'source.control.row.login.target',
    targetKind:'native-control-target', subject:'row-login',
    target:'reader-source-row-login-control', branch:'row', control:'login',
    action:'login-row-top', baseline:'row-baseline', position:'top',
    fixture:rowFixture,
  },
];

const byCase = new Map(policies.map(policy => [policy.caseId,policy]));
const byAssertion = new Map(policies.map(policy => [policy.id,policy]));
const targetId = target => typeof target === 'string' ? target : target?.id;
const positive = value => Number.isSafeInteger(value) && value > 0;
const sequence = value => Number.isSafeInteger(value) && value >= 0;
const sameOwner = (left,right) => sequence(left?.mounting) && positive(left?.generation) &&
  left.mounting === right?.mounting && left.generation === right?.generation;

export const sourceControlTouchCases = Object.freeze(policies.map(policy => policy.caseId));

export function sourceControlTouchCase(id) {
  return byCase.has(id);
}

export function sourceControlTouchPolicy(expected) {
  return policies.find(policy => policy.target === expected?.target && policy.branch === expected.branch &&
    policy.control === expected.control && policy.position === expected.position);
}

export function sourceControlTouchStep(step,fixture) {
  const policy = policies.find(item => item.action === step?.id);
  if (!policy || fixture?.id !== policy.fixture || fixture.publicSources !== true ||
      step.kind !== 'action' || step.op !== 'click' || step.from !== policy.baseline ||
      targetId(step.target) !== policy.target || step.gesture === true ||
      (policy.position === 'center' ? step.tapEdge !== undefined || step.requireFullContainment !== undefined :
        step.tapEdge !== 'top' || step.requireFullContainment !== true)) return;
  return policy;
}

export function sourceControlTouchAssertion(contract,assertion) {
  const policy = byCase.get(contract?.id);
  if (!policy || contract.version !== 1 || contract.pageId !== 'source-management' ||
      contract.fixture?.id !== policy.fixture || contract.fixture.publicSources !== true ||
      assertion?.id !== policy.id || assertion.evaluator !== 'source' || assertion.kind !== 'source-control-action' ||
      assertion.required !== false || !assertion.condition || assertion.action !== policy.action ||
      assertion.baseline !== policy.baseline || assertion.sample !== policy.baseline ||
      !sourceControlTouchPolicy(assertion.expected) || assertion.expected.conditionAssertion !== policy.targetId ||
      !Array.isArray(contract.steps)) return;
  const baseline = contract.steps.find(step=>step.id === policy.baseline && step.kind === 'sample' &&
    step.afterAction === 'open-sources' && step.keyboard === false);
  const action = contract.steps.find(step=>step.id === policy.action);
  const target = contract.assertions.find(item=>item.id === policy.targetId);
  const recovery = policy.branch !== 'row';
  const targetCondition = recovery ?
    target?.required === false && Boolean(target.condition) :
    target?.required === true && target.condition === undefined;
  if (!baseline || sourceControlTouchStep(action,contract.fixture) !== policy ||
      target?.evaluator !== 'source' || target.kind !== policy.targetKind || target.action !== 'open-sources' ||
      target.sample !== policy.baseline || target.expected?.target !== policy.target ||
      !targetCondition) return;
  return {subject:policy.subject,target:policy.target,position:policy.position};
}

export function sourceControlTouchPoint(sample,policy) {
  requireEvidence(sample?.sampleId === policy.baseline,'The Source control tap lacks its exact baseline sample');
  const measured = measureSourceNativeControl(sample,policy.target);
  requireEvidence(measured.verdict === 'PASS',measured.reason);
  const {left,top,width,height} = measured.actual.bounds;
  return {x:left+Math.floor(width/2),y:policy.position === 'top' ? top+1 : top+Math.floor(height/2)};
}

export function sourceControlTouchWitness(step,sample,fixture,operation,probeSeq) {
  const policy = sourceControlTouchStep(step,fixture);
  if (!policy) return undefined;
  const point = sourceControlTouchPoint(sample,policy);
  requireEvidence(operation?.op === 'click' && positive(probeSeq) &&
    operation.x === point.x && operation.y === point.y,
  'The accepted command has no exact Source control tap witness');
  return {sourceControlTap:{x:point.x,y:point.y,position:policy.position,probeSeq}};
}

function recoveryApplication(assertion,context) {
  const observed = evaluateSourceRecoveryControl({
    expected:{target:assertion.expected.target},
    action:'open-sources',
    sample:assertion.baseline,
  },context);
  const opening = sourceReadObservation({
    action:'open-sources',sample:assertion.baseline,expected:{state:'recovery'},
  },context);
  return {observed,opening,applicability:observed.actual?.applicability ?? 'UNKNOWN'};
}

function rowApplication(assertion,context) {
  const opening = sourceReadObservation({
    action:'open-sources',sample:assertion.baseline,expected:{state:'rows'},
  },context);
  const projection = opening?.current?.payload;
  const sample = context.samples?.[assertion.baseline];
  if (!sample?.captureComplete || sample.window?.source !== 'window-metrics' ||
      sample.window.keyboard?.visible !== false || !opening?.triggered || projection?.state !== 'rows' ||
      projection.readFact !== 'current' || projection.count !== 1 || projection.projected !== 1 ||
      !positive(projection.rowActions?.anchor) || projection.rowActions?.checkState !== 'unchecked') {
    return {applicability:'UNKNOWN',opening};
  }
  const measured = measureSourceNativeControl(sample,assertion.expected.target);
  return {applicability:'APPLIES',opening,measured};
}

export function evaluateSourceControlAction(assertion,context) {
  const policy = byAssertion.get(assertion.id);
  const baseline = context.samples?.[assertion.baseline];
  const action = context.actions?.[assertion.action];
  const refs = [...baseline?.evidenceRefs ?? [],...action?.evidenceRefs ?? []];
  const report = (verdict,reason,applicability,actual = {},events = []) => ({
    verdict,reason,expected:assertion.expected,
    actual:{applicability,branch:policy?.branch,control:policy?.control,...actual},
    evidenceRefs:[...refs,...events.flatMap(event=>event?.evidenceRefs ?? [])],
  });
  if (!policy || assertion.kind !== 'source-control-action' ||
      !sourceControlTouchPolicy(assertion.expected) || assertion.expected.conditionAssertion !== policy.targetId) {
    return report('NOT_RUN','The Source control action lacks its exact case, target, branch and position','UNKNOWN');
  }
  const recovery = policy.branch !== 'row';
  const application = recovery ? recoveryApplication(assertion,context) : rowApplication(assertion,context);
  const opening = application.opening ?? application.observed;
  if (application.applicability !== 'APPLIES' || !opening) {
    return report('NOT_RUN',recovery ?
      'The current Source recovery does not expose this exact control' :
      'No complete current public row exposes its exact Login Button','UNKNOWN',{},[
      ...(opening?.evidenceRefs ? [{evidenceRefs:opening.evidenceRefs}] : []),
    ]);
  }
  if (recovery && application.observed?.verdict === 'FAIL') {
    return report('FAIL',application.observed.reason,'APPLIES',{},opening.evidenceRefs ? [{evidenceRefs:opening.evidenceRefs}] : []);
  }
  if (!recovery && application.measured?.verdict !== 'PASS') {
    return report(application.measured?.verdict ?? 'NOT_RUN',application.measured?.reason ??
      'The current public Login Button is unavailable','APPLIES',application.measured?.actual ?? {});
  }
  const measured = recovery ? application.observed.actual?.nativeTouchTarget :
    application.measured?.actual;
  const facts = opening.current?.payload?.recovery;
  const rowFacts = opening.current?.payload?.rowActions;
  if (!measured || !Number.isSafeInteger(action?.beforeSeq) || !Number.isSafeInteger(action?.afterSeq) ||
      action.afterSeq <= action.beforeSeq || action.op !== 'click' || action.targetId !== policy.target ||
      action.from !== assertion.baseline || action.instanceId !== baseline?.instanceId ||
      action.outcomeSettled !== true) {
    return report('NOT_RUN','No completed native click from this exact baseline owner','APPLIES',{});
  }
  const dispatch = action.sourceControlTap;
  const point = sourceControlTouchPoint(baseline,policy);
  if (!positive(dispatch?.probeSeq) || dispatch.position !== policy.position ||
      dispatch.x !== point.x || dispatch.y !== point.y) {
    return report('NOT_RUN','The accepted command has no exact Source control tap witness','APPLIES',{dispatch});
  }
  const events = (context.events ?? []).filter(event=>event.instanceId === baseline.instanceId &&
    event.channel === 'business' && event.eventSeq > action.beforeSeq && event.eventSeq <= action.afterSeq &&
    event.kind === 'source.control-action');
  const admitted = events.filter(event=>event.payload?.phase === 'admitted');
  if (!admitted.length) {
    return report('NOT_RUN','The Source control owner has no admitted observation for this click','APPLIES',{dispatch},events);
  }
  if (admitted.length !== 1 || events.some(event=>event.payload?.phase !== 'admitted')) {
    return report('FAIL','The Source control click produced duplicated or unexpected owner observations','APPLIES',
      {dispatch,phases:events.map(event=>event.payload?.phase)},events);
  }
  const [event] = admitted;
  const payload = event.payload;
  const exact = payload.branch === policy.branch && payload.control === policy.control &&
    sameOwner(payload.owner,opening.entry?.payload ?? opening.current?.payload?.owner) && positive(payload.sequence) &&
    (recovery ? payload.generation === facts?.generation && payload.sourceAnchor === undefined :
      payload.generation === 0 && payload.sourceAnchor === rowFacts?.anchor && payload.loginEligible === true);
  if (!exact) {
    return report('FAIL','A different Source branch, control, owner, generation or row was admitted','APPLIES',
      {dispatch,admitted:payload},events);
  }
  const nativeInteraction = {
    subject:policy.subject,target:policy.target,carrierPath:measured.carrierPath,bounds:measured.bounds,
    visible:true,clipped:false,enabled:true,accepted:true,position:policy.position,
    actionId:assertion.action,baselineSampleId:assertion.baseline,dispatch,
  };
  return report('PASS','','APPLIES',{
    sampleId:baseline.sampleId,dispatch,generation:payload.generation,
    ...(recovery ? {branch:facts?.branch,control:policy.control} :
      {sourceAnchor:rowFacts?.anchor,loginEligible:true}),
    nativeInteraction,
  },events);
}

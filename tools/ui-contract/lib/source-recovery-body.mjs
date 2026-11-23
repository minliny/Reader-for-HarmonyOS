import { requireEvidence } from '../../lib/native-ui-evidence.mjs';
import { nativeSourceText, sourceTextPlacement } from './source-adaptation.mjs';
import { sourceReadObservation } from './source-read.mjs';
import { evaluateSourceRecoveryControl } from './source-recovery-control.mjs';
import { sourceNativeCenterInteraction } from './source-native-center.mjs';
import { usesSourceUnknownExpand } from './source-unknown-expand.mjs';
import { measureSourceNativeControl } from './source-native-control.mjs';

const bodyScope = 'operation-recovery-body';
const messageId = 'reader-source-recovery-message';
const positive = value => Number.isSafeInteger(value) && value > 0;
const sequence = value => Number.isSafeInteger(value) && value >= 0;
const near = (value, expected, tolerance) =>
  Number.isFinite(value) && Number.isFinite(expected) && Math.abs(value - expected) <= tolerance;
const sameOwner = (left, right) => sequence(left?.mounting) && positive(left.generation) &&
  left.mounting === right?.mounting && left.generation === right?.generation;
const recoveryTarget = branch => `reader-source-${branch}-expand`;
const edgeBranches = ['original','unknown'];
const edgeKind = 'recovery-expand-edge';
const edgeAction = 'expand-recovery-edge';
const foldedSample = 'recovery-collapsed';
const expandedSample = 'recovery-expanded';

export function sourceRecoveryExpandEdgeStep(step) {
  if (step?.id === edgeAction && step.kind === 'action' && step.op === 'click' &&
      step.from === 'recovery-refolded' && step.target === recoveryTarget('unknown') &&
      step.tapEdge === 'top' && !step.gesture && !step.requireFullContainment) return 'unknown';
  return step?.id === edgeAction && step.kind === 'action' && step.op === 'click' && step.from === foldedSample &&
    step.tapEdge === 'top' && !step.gesture && !step.requireFullContainment ?
    edgeBranches.find(branch=>step.target === recoveryTarget(branch)) : undefined;
}

export function sourceRecoveryExpandEdgeAssertion(contract,assertion) {
  const {branch,target,tapEdge} = assertion?.expected ?? {};
  const firstOpening = usesSourceUnknownExpand(contract);
  const baseline = firstOpening ? 'recovery-refolded' : foldedSample;
  const sample = firstOpening ? 'recovery-expanded-edge' : expandedSample;
  if (contract?.id !== `source-management.${branch}-recovery-expand-touch-edge` ||
      (!firstOpening && (contract.version !== 1 || contract.pageId !== 'source-management' ||
        contract.fixture?.id !== 'public-source-read-v1' || contract.fixture.publicSources !== true)) ||
      !edgeBranches.includes(branch) || assertion.id !== `source.recovery.${branch}.expand-top-edge` ||
      assertion.evaluator !== 'source' || assertion.kind !== edgeKind || assertion.required !== false || !assertion.condition ||
      assertion.entryAction !== 'open-sources' || assertion.action !== edgeAction || assertion.baseline !== baseline ||
      assertion.sample !== sample || target !== recoveryTarget(branch) || tapEdge !== 'top' ||
      !contract.steps?.some(step=>sourceRecoveryExpandEdgeStep(step) === branch)) return undefined;
  return {subject:`${branch}-expand-collapse`,target,position:'top'};
}

function measuredEdge(sample,target) {
  const measured = measureSourceNativeControl(sample,target);
  if (measured.verdict !== 'PASS') return undefined;
  const {bounds,carrierPath} = measured.actual;
  return {bounds,carrierPath,point:{x:bounds.left+Math.floor(bounds.width/2),y:bounds.top+1}};
}

export function sourceRecoveryExpandEdgePoint(sample,target) {
  const current = measuredEdge(sample,target);
  requireEvidence(current,'No unclipped native recovery Expand Button for the edge tap');
  return current.point;
}

function fullWindow(sample, requireFontReadback = true) {
  const window = sample?.window;
  return sample?.captureComplete === true && Array.isArray(sample.nodes) && sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) &&
    sample.evidenceRefs.some(ref=>ref.path.endsWith('.json')) && window?.source === 'window-metrics' &&
    window.keyboard?.visible === false && window.keyboard.revision === window.revision &&
    window.density > 0 && window.rectPx?.width > 0 && window.rectPx.height > 0 &&
    (!requireFontReadback || window.nativeFont?.followsSystemFontScale === true &&
      near(window.nativeFont.effectiveScale,window.fontScale,.01));
}

function sameWindow(before, after) {
  const left = before.window, right = after.window;
  return before.instanceId === after.instanceId && left.id === right.id && left.revision === right.revision &&
    left.orientation === right.orientation && left.fontScale === right.fontScale && left.density === right.density &&
    ['left','top','width','height'].every(key=>left.rectPx[key] === right.rectPx[key]);
}

function isRecovery(projection, notice, branch) {
  const recovery = projection?.recovery;
  return projection?.state === 'recovery' && recovery?.branch === branch &&
    sameOwner(projection.owner,notice.owner) && recovery.generation === notice.generation;
}

function measuredRecoveryBody(sample,branch) {
  const native = {...sample,nodes:sample.nodes.filter(node=>node.source === 'native-tree')};
  const {node} = nativeSourceText(native,`recovery/${branch}/message`,
    {id:messageId,hostId:`reader-source-${branch}-recovery`});
  return node?.visible === true && node.opacity > 0 && node.rectPx?.height > 0 && node.rectPx?.width > 0 ?
    {path:node.path,heightPx:node.rectPx.height,widthPx:node.rectPx.width} : undefined;
}

const isNoticeEvent = (event,notice,kind) => event.kind === kind && sameOwner(event.payload.owner,notice.owner) &&
  event.payload.branch === notice.branch && event.payload.generation === notice.generation;

export function assertSourceRecoveryExpandEdgeState(step,sample,mark,events) {
  const branch = sourceRecoveryExpandEdgeStep(step);
  if (!branch) return;
  const at = upper => events.filter(event=>event.instanceId === sample.instanceId && event.channel === 'business' && event.eventSeq <= upper);
  const native = at(sample.beforeSeq);
  const current = at(mark.eventSeq);
  const observed = values => values.findLast(event=>event.kind === 'source.projection')?.payload;
  const prior = observed(native);
  const notice = {owner:prior?.owner,branch,generation:prior?.recovery?.generation};
  const stillFolded = values => {
    const title = values.findLast(event=>event.kind === 'source.recovery-title');
    const body = values.findLast(event=>isNoticeEvent(event,notice,'source.recovery-body-state'));
    return title && isNoticeEvent(title,notice,'source.recovery-title') &&
      title.windowRevision === sample.window.revision && title.payload.title === 'clipped' &&
      (step.from === 'recovery-refolded' ?
        body?.payload.phase === 'collapsed' && body.windowRevision === sample.window.revision &&
          positive(body.payload.expansionRevision) :
        body?.payload.phase !== 'expanded');
  };
  requireEvidence(positive(notice.generation) && isRecovery(prior,notice,branch) &&
    isRecovery(observed(current),notice,branch) && stillFolded(native) && stillFolded(current) &&
    measuredRecoveryBody(sample,branch),
  'The current native Source recovery notice is not the same folded notice before the Expand edge');
}

function textEvidence({sample, projection, notice, presentation, expansion, events, refs}) {
  const window = sample.window;
  const {branch, generation} = notice;
  const role = `recovery/${branch}/message`;
  const selector = {id:messageId,hostId:`reader-source-${branch}-recovery`};
  const observed = events.findLast(event=>event.kind === 'source.surface-text-layout' &&
    event.eventSeq <= sample.beforeSeq && event.payload?.scope === bodyScope);
  const data = observed?.payload;
  const state = projection.payload;
  const widthVp = window.rectPx.width / window.density;
  const heightVp = window.rectPx.height / window.density;
  const expansionRevision = expansion?.payload.expansionRevision;
  refs.push(sample,projection,observed);
  const actual = {sampleId:sample.sampleId,textScope:'operation-recovery',widthVp,scale:window.fontScale,
    nativeFont:window.nativeFont,textProjectionRevision:state.textProjectionRevision,presentation,roles:{}};
  if (!data || !positive(state.textProjectionRevision) || !sequence(state.filterRevision) || !sequence(state.readGeneration) ||
    observed.eventSeq <= Math.max(projection.eventSeq,expansion?.eventSeq ?? 0) ||
    observed.windowRevision !== window.revision || data.windowRevision !== window.revision ||
    !sameOwner(data.owner,state.owner) || data.branch !== branch || data.generation !== generation ||
    data.presentation !== presentation || data.expansionRevision !== expansionRevision ||
    data.textProjectionRevision !== state.textProjectionRevision || data.filterRevision !== state.filterRevision ||
    data.readGeneration !== state.readGeneration || !near(data.density,window.density,.01) ||
    !near(data.widthVp,widthVp,1/window.density) || !near(data.heightVp,heightVp,1/window.density) ||
    !near(data.systemFontScale,window.fontScale,.01) || !near(data.fontScale,window.fontScale,.01) ||
    !Array.isArray(data.labels) || data.labels.length !== 1 || data.labels[0]?.role !== role) {
    return {verdict:'NOT_RUN',reason:'No fresh rich Text character ranges for the current recovery notice',actual};
  }
  const native = {...sample,nodes:sample.nodes.filter(node=>node.source === 'native-tree')};
  const carrier = nativeSourceText(native,role,selector,true);
  const proof = carrier.node ? sourceTextPlacement(role,data.labels[0],carrier.node,window,{tolerancePx:1,lineLimit:12}) : carrier;
  actual.roles[role] = proof;
  return {verdict:proof.verdict,reason:proof.reason,actual,
    observationsComplete:proof.verdict !== 'NOT_RUN' && proof.observationsComplete !== false};
}

export function evaluateSourceRecoveryBody(assertion, context) {
  const edge = assertion.kind === edgeKind;
  const {branch, presentation = 'expanded'} = assertion.expected;
  const expanding = presentation === 'expanded';
  const baseline = expanding ? assertion.baseline : assertion.sample;
  const entryAction = expanding ? assertion.entryAction : assertion.action;
  const opening = sourceReadObservation({action:entryAction,sample:baseline,expected:{state:'recovery'}},context);
  const before = opening?.sample;
  const state = opening?.current?.payload;
  const notice = {owner:state?.owner,branch,generation:state?.recovery?.generation};
  const refs = [before,opening?.entry,opening?.current,context.actions?.[entryAction]];
  function report(verdict, reason, applicability, sampleApplies = false, actual = {}, observationsComplete = verdict !== 'NOT_RUN') {
    return {verdict,reason,actual:{...actual,applicability,sampleApplies},expected:assertion.expected,observationsComplete,
      evidenceRefs:refs.flatMap(item=>item?.evidenceRefs ?? [])};
  }
  const events = (context.events ?? []).filter(event=>event.instanceId === before?.instanceId && event.channel === 'business' &&
    event.eventSeq > opening?.entry?.eventSeq);
  const title = events.findLast(event=>event.kind === 'source.recovery-title' && event.eventSeq <= before?.beforeSeq);
  refs.push(title);
  if (!fullWindow(before,!edge) || !isRecovery(state,notice,branch) || !positive(notice.generation) ||
    title?.windowRevision !== before.window.revision || !sameOwner(title.payload.owner,notice.owner) ||
    title.payload.branch !== branch || title.payload.generation !== notice.generation ||
    !['fits','clipped'].includes(title.payload.title) || context.problems?.length) {
    return report('NOT_RUN','No complete current original or unknown recovery with native folding evidence','UNKNOWN');
  }

  const target = recoveryTarget(branch);
  const beforeBody = edge ? measuredRecoveryBody(before,branch) : undefined;
  if (edge && !beforeBody) return report('NOT_RUN','No mounted native recovery body in this window and ownership','UNKNOWN');
  if (title.payload.title === 'fits') {
    if (before.nodes.some(node=>node.source === 'native-tree' && node.id === target))
      return report('FAIL','An Expand control was present for the current fitting recovery notice','APPLIES',true);
    if (edge) return report('NOT_RUN','The mounted recovery notice fits and no Expand control applies','DOES_NOT_APPLY');
    const proof = textEvidence({sample:before,projection:opening.current,notice,presentation:'fits',events,refs});
    if (!expanding)
      return report(proof.verdict,proof.reason,'APPLIES',true,proof.actual,proof.observationsComplete);
    if (proof.verdict === 'PASS')
      return report('NOT_RUN','The current recovery notice fits without expanding','DOES_NOT_APPLY');
    return report(proof.verdict,proof.reason,'UNKNOWN',false,proof.actual,proof.observationsComplete);
  }

  const usable = evaluateSourceRecoveryControl({expected:{target},sample:baseline,action:entryAction},context);
  refs.push(usable);
  if (usable.verdict !== 'PASS')
    return report(usable.verdict,usable.reason,usable.verdict === 'FAIL' ? 'APPLIES' : 'UNKNOWN',usable.verdict === 'FAIL');
  if (!expanding) return report('NOT_RUN','The current recovery notice requires its real Expand action','DOES_NOT_APPLY');

  const after = context.samples?.[assertion.sample];
  const action = context.actions?.[assertion.action];
  refs.push(after,action);
  if (action?.op !== 'click' || action.from !== baseline || action.targetId !== target ||
      !edge && action.outcomeSettled !== true || action.instanceId !== before.instanceId ||
    !sequence(action.beforeSeq) || !sequence(action.afterSeq) || action.beforeSeq < before.afterSeq ||
      action.afterSeq <= action.beforeSeq || !fullWindow(after,!edge) || action.afterSeq > after.beforeSeq || !sameWindow(before,after)) {
    return report('NOT_RUN','No complete expanded sample from the real Expand click in this window','APPLIES');
  }
  const scopedEvents = events.filter(event=>event.eventSeq <= after.beforeSeq);
  if (edge && context.sourceUnknownExpand) {
    const collapse = context.actions?.['collapse-recovery'];
    const center = context.actions?.['expand-recovery'];
    const changes = scopedEvents.filter(event=>event.kind === 'source.recovery-body-state' &&
      event.eventSeq > (center?.beforeSeq ?? Number.MAX_SAFE_INTEGER) && event.eventSeq <= before.beforeSeq);
    const [opened,folded] = changes;
    if (!collapse?.outcomeSettled || !center?.outcomeSettled || changes.length !== 2 ||
        !isNoticeEvent(opened,notice,'source.recovery-body-state') || opened.payload.phase !== 'expanded' ||
        !isNoticeEvent(folded,notice,'source.recovery-body-state') || folded.payload.phase !== 'collapsed' ||
        opened.eventSeq > center.afterSeq || folded.eventSeq <= collapse.beforeSeq || folded.eventSeq > collapse.afterSeq ||
        [opened,folded].some(event=>event.windowRevision !== before.window.revision) ||
        !positive(opened.payload.expansionRevision) || folded.payload.expansionRevision <= opened.payload.expansionRevision) {
      return report('NOT_RUN','No verified same-notice local center expansion and collapse before the top-edge tap','APPLIES');
    }
    refs.push(center,collapse,opened,folded);
  }
  const changes = scopedEvents.filter(event=>event.kind === 'source.recovery-body-state' && event.eventSeq > action.beforeSeq);
  const [expansion] = changes;
  const current = scopedEvents.findLast(event=>event.kind === 'source.projection');
  refs.push(expansion,current);
  if (edge) {
    const hit = measuredEdge(before,target);
    const dispatch = action.recoveryExpandEdgeTap;
    const earlier = events.findLast(event=>event.eventSeq <= before.beforeSeq &&
      isNoticeEvent(event,notice,'source.recovery-body-state'));
    if (!hit || !positive(dispatch?.probeSeq) || dispatch.x !== hit.point.x || dispatch.y !== hit.point.y ||
        earlier?.payload.phase === 'expanded') {
      return report('NOT_RUN','No verified native edge dispatch on the folded recovery Button','APPLIES');
    }
    const afterBody = measuredRecoveryBody(after,branch);
    const terminal = {sampleId:after.sampleId,nativeBodyBefore:beforeBody,nativeBodyAfter:afterBody ?? null};
    const unchanged = isRecovery(current?.payload,notice,branch) &&
      ['readFact','readGeneration','filterRevision','count','projected','firstAnchor'].every(key=>current.payload[key] === state[key]) &&
      ['busy','canContinue','canReconcile'].every(key=>current.payload.recovery[key] === state.recovery[key]);
    if (!unchanged || scopedEvents.some(event=>event.kind === 'source.route' && event.eventSeq > action.beforeSeq)) {
      return report('FAIL','The native Expand edge did not retain the same recovery operation and Source route','APPLIES',true,terminal);
    }
    if (expansion && (!isNoticeEvent(expansion,notice,'source.recovery-body-state') || expansion.payload.phase !== 'expanded' ||
        changes.length !== 1)) {
      return report('FAIL','The native edge did not expand exactly the current folded notice','APPLIES',true,terminal);
    }
    if (!afterBody || !expansion || expansion.eventSeq > action.afterSeq || expansion.windowRevision !== after.window.revision ||
        !positive(expansion.payload.expansionRevision)) {
      return report('NOT_RUN','No complete native endpoint and current accepted local expansion','APPLIES',false,terminal);
    }
    if (afterBody.heightPx <= beforeBody.heightPx) {
      return report('FAIL','The accepted local expansion did not increase the mounted native body extent','APPLIES',true,terminal);
    }
    return report('PASS','','APPLIES',true,{...terminal,expansionRevision:expansion.payload.expansionRevision,
      nativeInteraction:{subject:`${branch}-expand-collapse`,target,position:'top',bounds:hit.bounds,carrierPath:hit.carrierPath,
        visible:true,clipped:false,enabled:true,accepted:true,actionId:assertion.action,baselineSampleId:baseline,dispatch}});
  }
  if (scopedEvents.some(event=>event.kind === 'source.route' && event.eventSeq > before.beforeSeq) ||
    !isRecovery(current?.payload,notice,branch) || !expansion || expansion.eventSeq > action.afterSeq ||
    expansion.windowRevision !== after.window.revision || changes.length !== 1 ||
    !sameOwner(expansion.payload.owner,notice.owner) || expansion.payload.branch !== branch ||
    expansion.payload.generation !== notice.generation || expansion.payload.phase !== 'expanded' ||
    !positive(expansion.payload.expansionRevision)) {
    return report('NOT_RUN','No unique accepted expansion retaining the original recovery owner and generation','APPLIES');
  }
  const proof = textEvidence({sample:after,projection:current,notice,presentation,expansion,events:scopedEvents,refs});
  const nativeInteraction = proof.verdict === 'PASS' && sourceNativeCenterInteraction(assertion,before,action);
  if (context.sourceUnknownExpand && proof.verdict === 'PASS' && !nativeInteraction) {
    return report('NOT_RUN','The expanded body lacks its verified normal native center dispatch','APPLIES');
  }
  return report(proof.verdict,proof.reason,'APPLIES',true,
    {...proof.actual,sampleId:assertion.sample,expansionRevision:expansion.payload.expansionRevision,
      ...(nativeInteraction ? {nativeInteraction} : {})},proof.observationsComplete);
}

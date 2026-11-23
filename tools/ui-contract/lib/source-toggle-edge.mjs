import { EvidenceError, requireEvidence } from '../../lib/native-ui-evidence.mjs';
import { ancestorsOf, selectLayoutNode } from './layout.mjs';

export const sourceToggleEdgeCase = 'source-management.row-toggle-touch-edge';
export const sourceToggleEdgeFixture = 'public-source-row-toggle-touch-edge-v1';
export const sourceToggleTouchFixture = 'public-source-row-toggle-touch-v3';
export const sourceToggleEdgeTarget = 'reader-source-public-toggle-fixture';

const touchSequence = [
  {id:'enable-source',from:'source-ready',sample:'source-enabled',position:'top',requestedEnabled:true},
  {id:'restore-source',from:'source-enabled',sample:'source-restored',position:'bottom',requestedEnabled:false},
  {id:'enable-source-center',from:'source-restored',sample:'source-center-enabled',position:'center',requestedEnabled:true},
  {id:'restore-source-center',from:'source-center-enabled',sample:'source-center-restored',position:'center',requestedEnabled:false},
];

const coordinates = ['left', 'top', 'width', 'height'];
const listId = 'reader-source-list';
const right = rect => rect.left + rect.width;
const bottom = rect => rect.top + rect.height;
const knownRect = rect => coordinates.every(key => Number.isInteger(rect?.[key])) && rect.width >= 0 && rect.height >= 0;
const knownBox = rect => knownRect(rect) && rect.width > 0 && rect.height > 0;
const contains = (outer, inner) => knownBox(outer) && knownBox(inner) && outer.left <= inner.left &&
  outer.top <= inner.top && right(outer) >= right(inner) && bottom(outer) >= bottom(inner);
const inside = (rect, {x, y}) => x >= rect.left && x < right(rect) && y >= rect.top && y < bottom(rect);
const positive = value => Number.isSafeInteger(value) && value > 0;

export function sourceToggleEdgeAllowed(target, edge) {
  return target === sourceToggleEdgeTarget && (edge === 'top' || edge === 'bottom');
}

export function sourceToggleTouchStep(step) {
  if (step?.op !== 'click' || step.target !== sourceToggleEdgeTarget || step.gesture || step.requireFullContainment) return undefined;
  return touchSequence.find(({id,from,position})=>step.id === id && step.from === from &&
    step.tapEdge === (position === 'center' ? undefined : position));
}

export function sourceToggleTouchCaseValid(contract) {
  const touches = contract.steps.filter(step=>step.target === sourceToggleEdgeTarget);
  const rules = contract.assertions.filter(assertion=>assertion.kind === 'toggle-touch');
  const initial = contract.steps.find(step=>step.id === 'source-ready');
  const opening = contract.steps.find(step=>step.id === 'open-sources');
  return contract.id === sourceToggleEdgeCase && contract.version === 3 && contract.pageId === 'source-management' &&
    contract.fixture.id === sourceToggleTouchFixture && contract.fixture.publicSources === true &&
    touches.length === touchSequence.length && rules.length === touches.length &&
    opening?.op === 'click' && opening.target === 'reader-settings-source-management' && initial?.afterAction === opening.id &&
    touchSequence.every((policy,index)=>{
      const step = touches[index];
      const prior = contract.steps.find(item=>item.id === policy.from);
      const after = contract.steps.find(item=>item.id === policy.sample);
      const [rule,...duplicates] = rules.filter(item=>item.action === step.id);
      return sourceToggleTouchStep(step) === policy &&
        [prior,after].every(item=>item?.kind === 'sample' && item.keyboard === false &&
          item.anchors.includes(sourceToggleEdgeTarget)) &&
        after.afterAction === step.id && duplicates.length === 0 && rule?.evaluator === 'source' &&
        rule.baseline === prior.id && rule.sample === after.id && rule.required === true && !rule.condition &&
        rule.expected.target === sourceToggleEdgeTarget && rule.expected.position === policy.position &&
        rule.expected.requestedEnabled === policy.requestedEnabled;
    });
}

export function sourceToggleSameOwner(a, b) {
  return positive(a?.generation) && Number.isSafeInteger(a?.mounting) && a.mounting >= 0 &&
    a.generation === b?.generation && a.mounting === b?.mounting;
}

function fixtureRow(sample) {
  requireEvidence(sample?.nodes?.filter(node => node.id === sourceToggleEdgeTarget).length === 1,
    'The current Reader window does not identify one public source Toggle wrapper');
  const wrapper = selectLayoutNode(sample, {id:sourceToggleEdgeTarget, ancestors:[listId]});
  const ancestors = ancestorsOf(sample, wrapper);
  const rows = ancestors.filter(node => /^reader-source-row-[1-9]\d*$/u.test(node.id ?? ''));
  const [row] = rows;
  const list = selectLayoutNode(sample, listId);
  const anchor = Number(row?.id.slice('reader-source-row-'.length));
  requireEvidence(rows.length === 1 && positive(anchor) && ancestors.includes(list) && ancestors.indexOf(row) < ancestors.indexOf(list),
    'The public Toggle is not inside the current source row and viewport');
  return {wrapper, row, list, anchor};
}

export function measureSourceToggleCarrier(sample) {
  const report = (verdict, reason, actual = null) => ({verdict, reason, actual});
  const window = sample?.window;
  const density = window?.density;
  if (sample?.captureComplete !== true || window?.source !== 'window-metrics' || window.keyboard?.visible !== false ||
      !knownBox(window.visibleRectPx) || !Number.isFinite(density) || density <= 0) {
    return report('NOT_RUN','Source Toggle measurement requires a complete current native window without IME');
  }
  let fixture;
  try { fixture = fixtureRow(sample); }
  catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return report('NOT_RUN',error.message);
  }
  const {wrapper, row, list, anchor} = fixture;
  const toggles = sample.nodes.filter(node => node.type === 'Toggle' && ancestorsOf(sample, node).includes(wrapper));
  if (list.type !== 'List' || toggles.length !== 1)
    return report('NOT_RUN','The current native Source List does not identify one public Toggle');
  const [toggle] = toggles;
  const envelope = sample.nodes.find(node => node.path === toggle.parentPath);
  const painted = toggle.rectPx;
  const hitBox = envelope?.rectPx;
  if (envelope?.type !== 'Stack' || (envelope !== wrapper && !ancestorsOf(sample, envelope).includes(wrapper)))
    return report('NOT_RUN','The public Toggle has no identifiable native response envelope');
  const clipBounds = [wrapper.visibleRectPx, row.visibleRectPx, list.visibleRectPx, window.visibleRectPx];
  if (!knownBox(painted) || !knownBox(hitBox) ||
      ![envelope.visibleRectPx, toggle.visibleRectPx, ...clipBounds].every(knownRect))
    return report('NOT_RUN','The public Toggle geometry is incomplete');
  const actual = {anchor, painted, envelope:hitBox, togglePath:toggle.path,
    ...(Object.hasOwn(toggle,'sourcePublicToggleChecked') ? {nativeChecked:toggle.sourcePublicToggleChecked} : {})};
  if (hitBox.width + 1 < 44 * density || hitBox.height + 1 < 44 * density)
    return report('FAIL','The measured public Toggle envelope is smaller than 44vp',actual);
  if (hitBox.width - 1 > 44 * density || hitBox.height - 1 > 44 * density)
    return report('NOT_RUN','The measured parent does not identify the 44vp public Toggle envelope',actual);
  if (!contains(hitBox, painted) || !contains(envelope.visibleRectPx, hitBox) || !contains(hitBox, envelope.visibleRectPx) ||
      !contains(toggle.visibleRectPx, painted) || !contains(painted, toggle.visibleRectPx) ||
      !clipBounds.every(rect => contains(rect, hitBox)))
    return report('FAIL','The measured public Toggle or its envelope is clipped',actual);
  if (envelope.visible !== true || toggle.visible !== true || ![envelope.opacity,toggle.opacity].every(value =>
    Number.isFinite(value) && value > 0) || toggle.enabled !== true || toggle.clickable !== true)
    return report('NOT_RUN','The measured public Toggle is not verified as a visible, actionable target',actual);
  return report('PASS','',actual);
}

export function sourceToggleEdgeTap(sample, target, edge) {
  requireEvidence(sourceToggleEdgeAllowed(target, edge), 'Unsupported public source Toggle edge');
  const {position, ...measured} = sourceToggleTouchTap(sample,edge);
  return {...measured,edge:position};
}

export function sourceToggleTouchTap(sample, position) {
  requireEvidence(['top','bottom','center'].includes(position), 'Unsupported public source Toggle position');
  const measured = measureSourceToggleCarrier(sample);
  requireEvidence(measured.verdict === 'PASS',measured.reason);
  const {painted, envelope:hitBox} = measured.actual;
  const {density} = sample.window;
  requireEvidence(Math.abs(painted.width - 44 * density) <= 1 && Math.abs(painted.height - 24 * density) <= 1 &&
    Math.abs((painted.top - hitBox.top) - (bottom(hitBox) - bottom(painted))) <= 1,
  'The current public Toggle lacks a fully visible and centered 44vp response envelope');
  const point = {x:Math.floor(painted.left + painted.width / 2),
    y:position === 'top' ? hitBox.top + 1 : position === 'bottom' ? bottom(hitBox) - 2 :
      Math.floor(painted.top + painted.height / 2)};
  requireEvidence(inside(hitBox,point) && inside(painted,point) === (position === 'center'),
    'The source Toggle test point does not match the current paint and response envelope');
  return {...measured.actual,position,point};
}

export function sourceToggleIsConfirmed(payload) {
  return payload?.confirmation === 'confirmed' && payload.readback === 'succeeded' &&
    typeof payload.requestedEnabled === 'boolean' && payload.observedEnabled === payload.requestedEnabled;
}

export function publicToggleProjection(projection) {
  return projection?.state === 'rows' && projection.readFact === 'current' && projection.count === 1 &&
    projection.projected === 1 && projection.status === 'all' && projection.category === 'all' &&
    projection.groupIndex === 0 && projection.queryLength === 0 && projection.allGroups === true;
}

export function sourceToggleReadyAt(sample, events, upperSeq = sample?.beforeSeq) {
  if (!sample || !Number.isSafeInteger(upperSeq)) return null;
  const visible = event => event.instanceId === sample.instanceId && event.channel === 'business' && event.eventSeq <= upperSeq;
  const ready = events.findLast(event => visible(event) && event.kind === 'source.toggle' && event.payload.phase === 'ready');
  const projection = events.findLast(event => visible(event) && event.kind === 'source.projection');
  try {
    const row = fixtureRow(sample);
    const facts = ready?.payload;
    if (facts?.anchor === row.anchor && typeof facts.enabled === 'boolean' && publicToggleProjection(projection?.payload) &&
        projection.payload.firstAnchor === row.anchor &&
        sourceToggleSameOwner(facts.owner, projection.payload.owner) && positive(facts.filterRevision) &&
        positive(facts.readGeneration) && facts.filterRevision === projection.payload.filterRevision &&
        facts.readGeneration === projection.payload.readGeneration) return ready;
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
  }
  return null;
}

export function assertSourceToggleEdgeState(step, sample, mark, events) {
  const policy = sourceToggleTouchStep(step);
  const center = policy?.position === 'center';
  if (!center && !sourceToggleEdgeAllowed(step.target, step.tapEdge)) return;
  const sampledReady = sourceToggleReadyAt(sample, events);
  const sampled = sampledReady?.payload;
  const current = sourceToggleReadyAt(sample, events, mark.eventSeq)?.payload;
  requireEvidence(sampled && current && sampled.anchor === current.anchor && sourceToggleSameOwner(sampled.owner, current.owner) &&
    sampled.enabled === current.enabled && current.enabled === (center ? !policy.requestedEnabled : step.tapEdge === 'bottom') &&
    sampled.filterRevision === current.filterRevision && sampled.readGeneration === current.readGeneration,
  `The exact public Toggle row or its read state is stale before ${step.id}`);
  if (center) {
    // All earlier writes must be paired and confirmed before another state change.
    const previous = touchSequence.slice(0,touchSequence.indexOf(policy));
    const writes = events.filter(event => event.instanceId === sample.instanceId && event.channel === 'business' &&
      event.kind === 'source.toggle' && ['admitted','settled'].includes(event.payload.phase) && event.eventSeq <= mark.eventSeq);
    requireEvidence(writes.length === previous.length * 2 && previous.every((item,index)=>{
      const admission = writes[index*2], settlement = writes[index*2+1];
      return admission.payload.phase === 'admitted' && settlement.payload.phase === 'settled' &&
        admission.eventSeq < settlement.eventSeq && settlement.eventSeq <= sample.beforeSeq &&
        admission.eventSeq < sampledReady.eventSeq && positive(admission.payload.toggleSeq) &&
        admission.payload.toggleSeq === settlement.payload.toggleSeq &&
        (index === 0 || writes[index*2-1].payload.toggleSeq < admission.payload.toggleSeq) &&
        [admission,settlement].every(event => sourceToggleSameOwner(event.payload.owner,current.owner) &&
          event.payload.anchor === current.anchor && event.payload.requestedEnabled === item.requestedEnabled) &&
        sourceToggleIsConfirmed(settlement.payload);
    }), 'No complete confirmed write sequence for the current public Toggle center action');
    return;
  }
  const admitted = events.findLast(event => event.instanceId === sample.instanceId && event.channel === 'business' &&
    event.kind === 'source.toggle' && event.payload.phase === 'admitted' && event.eventSeq <= mark.eventSeq);
  if (step.tapEdge === 'top') {
    requireEvidence(!admitted, 'The public source Toggle has already been used in this session');
    return;
  }
  const settled = events.findLast(event => event.instanceId === sample.instanceId && event.channel === 'business' &&
    event.kind === 'source.toggle' && event.payload.phase === 'settled' && event.eventSeq <= sample.beforeSeq);
  requireEvidence(admitted && settled && admitted.eventSeq < settled.eventSeq && admitted.eventSeq < sampledReady.eventSeq &&
    positive(settled.payload.toggleSeq) && admitted.payload.toggleSeq === settled.payload.toggleSeq &&
    admitted.payload.anchor === current.anchor && settled.payload.anchor === current.anchor &&
    sourceToggleSameOwner(current.owner, admitted.payload.owner) && admitted.payload.requestedEnabled === true &&
    sourceToggleSameOwner(current.owner, settled.payload.owner) && settled.payload.requestedEnabled === true &&
    sourceToggleIsConfirmed(settled.payload), 'No confirmed enable to restore on the current public source row');
}

export function readSourceToggleEdge(sample, action, edge) {
  if (action?.op !== 'click' || action.targetId !== sourceToggleEdgeTarget || action.edgeTap?.edge !== edge ||
      !positive(action.edgeTap.probeSeq)) return null;
  try {
    const witness = sourceToggleEdgeTap(sample, action.targetId, edge);
    return witness.point.x === action.edgeTap.x && witness.point.y === action.edgeTap.y ? witness : null;
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return null;
  }
}

export function readSourceToggleTouch(sample,action,position) {
  const dispatch = action?.toggleTap;
  if (action?.op !== 'click' || action.targetId !== sourceToggleEdgeTarget ||
      dispatch?.position !== position || !positive(dispatch.probeSeq)) return null;
  try {
    const witness = sourceToggleTouchTap(sample,position);
    return witness.point.x === dispatch.x && witness.point.y === dispatch.y ? witness : null;
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return null;
  }
}

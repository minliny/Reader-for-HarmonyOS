import { EvidenceError, requireEvidence } from '../../lib/native-ui-evidence.mjs';
import { ancestorsOf, layoutTapPoint, selectLayoutNode } from './layout.mjs';

const upperLower = ['top', 'bottom'];
const extent = 44;
const fields = ['left', 'top', 'width', 'height'];
const filters = {
  status:{prefix:'reader-source-status-',lane:'reader-source-status-filter',values:['all','enabled','error','unchecked']},
  category:{prefix:'source-category-',lane:'reader-source-category-filter',
    values:['all','novel','comic','music','download','external','other']},
};
const laneByTarget = new Map(Object.values(filters).flatMap(({prefix,lane,values}) =>
  values.map(value => [prefix + value,lane])));
const groupPanel = 'reader-source-group-panel';
export const sourceFilterEdgeCase = 'source-management.filter-touch-edges';
export const sourceStatusTouchFixture = 'public-source-filter-touch-edges-v3';
export const sourceCategoryTouchEdgeCase = 'source-management.category-touch-edges';
export const sourceCategoryTouchFixture = 'public-source-category-touch-edges-v2';
export const sourceGroupOptionEdgeCase = 'source-management.group-option-touch-edges';
export const sourceGroupOptionEdgeFixture = 'public-source-group-options-v1';
const groupOptions = ['reader-source-group-selected','reader-source-group-option-1'];
for (const option of groupOptions) laneByTarget.set(option,groupPanel);
const disabledStatus = 'reader-source-status-custom';
const groupTrigger = 'reader-source-group-trigger';
const groupRow = 'reader-source-group-filter';
const laneForCarrier = target => laneByTarget.get(target) ??
  ({[disabledStatus]:filters.status.lane,[groupTrigger]:groupRow})[target];

export function sourceGroupOptionEdgeTarget(target) {
  return groupOptions.includes(target);
}

export function sourceGroupSelectedCenterTap(sample) {
  const measured = measureSourceFilterCarrier(sample,groupOptions[0],{requireFullContainment:true,requireLocatorCenter:true});
  requireEvidence(measured.verdict === 'PASS',measured.reason);
  return measured.actual.locatorPoint;
}

export function sourceFilterEdgeTarget(trigger, value) {
  const filter = Object.hasOwn(filters,trigger) ? filters[trigger] : undefined;
  return filter?.values.includes(value) ? filter.prefix + value : null;
}

export function sourceFilterEdgeAllowed(target, edge) {
  return laneByTarget.has(target) && upperLower.includes(edge) || target === groupTrigger && edge === 'top';
}

const categoryCenters = ['comic','music','download','other'];
const categoryEdgeValues = ['all','external'];
const statusEdgeValues = ['all','unchecked','error'];

export function sourceCategoryCenterTarget(step, fixture) {
  if (fixture?.id !== sourceCategoryTouchFixture || fixture.publicSources !== true || step?.kind !== 'action' ||
      step.op !== 'click' || step.gesture === true || step.tapEdge !== undefined || step.requireFullContainment !== undefined) {
    return undefined;
  }
  const category = categoryCenters.find(value => step.id === `tap-${value}-center` && step.target === sourceFilterEdgeTarget('category',value));
  return category && step.target;
}

export function sourceFilterCarrierAllowed(target, locatorCenter) {
  return typeof laneForCarrier(target) === 'string' && (!locatorCenter || target !== disabledStatus);
}

function containsPoint(rect, {x,y}) {
  return Boolean(rect && x >= rect.left && x < rect.left + rect.width &&
    y >= rect.top && y < rect.top + rect.height);
}

function containsRect(outer, inner) {
  return containsPoint(outer,{x:inner.left,y:inner.top}) &&
    containsPoint(outer,{x:inner.left + inner.width - 1,y:inner.top + inner.height - 1});
}

function measuredFilterLane(sample, button, lane) {
  const viewports = ancestorsOf(sample,button).filter(node => node.id === lane || node.alias === lane);
  const [viewport] = viewports;
  const type = lane === groupRow ? 'Row' : 'Scroll';
  return viewports.length === 1 && viewport.type === type && viewport.visible === true ? viewport.visibleRectPx : undefined;
}

function measuredGroupScroll(sample, button, lane) {
  const chain = ancestorsOf(sample,button);
  const panelIndex = chain.findIndex(node => node.id === lane || node.alias === lane);
  const viewports = chain.slice(0,Math.max(0,panelIndex)).filter(node => node.type === 'Scroll' && node.visible === true);
  return viewports.length === 1 ? viewports[0].visibleRectPx : undefined;
}

/** Locate the real Button inside the ID wrapper; the wrapper is only an anchor. */
export function measureSourceFilterCarrier(sample, target, {requireFullContainment = false, requireLocatorCenter = false} = {}) {
  const report = (verdict, reason, actual = null) => ({verdict,reason,actual});
  if (!sourceFilterCarrierAllowed(target,requireLocatorCenter)) throw new Error('Unsupported source filter carrier');
  const lane = laneForCarrier(target);
  const window = sample?.window;
  const density = window?.density;
  if (sample?.captureComplete !== true || window?.keyboard?.visible !== false || !Number.isFinite(density) || density <= 0) {
    return report('NOT_RUN','Source filter geometry requires a complete current native window without IME');
  }
  let scope;
  try { scope = selectLayoutNode(sample, {id:target,ancestors:[lane]}); }
  catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return report('NOT_RUN',error.message);
  }
  const buttons = sample.nodes.filter(node => node.type === 'Button' &&
    (node === scope || ancestorsOf(sample,node).includes(scope)));
  if (!buttons.length) return report('FAIL','Source filter anchor has no native Button carrier');
  if (buttons.length !== 1) return report('NOT_RUN','Source filter anchor has multiple native Button carriers');
  const [button] = buttons;
  const native = button.rectPx;
  const visible = button.visibleRectPx;
  if (!native || !visible || !fields.every(key => Number.isInteger(native[key]) && Number.isInteger(visible[key])) ||
      ![button.visible,button.enabled,button.clickable].every(value => typeof value === 'boolean') ||
      !Number.isFinite(button.opacity)) return report('NOT_RUN','Native source Button bounds or input state is unavailable');
  const groupViewport = lane === groupPanel ? measuredGroupScroll(sample,button,lane) : undefined;
  if (lane === groupPanel && (!groupViewport || !fields.every(key => Number.isInteger(groupViewport[key]))))
    return report('NOT_RUN','No unique measured native Scroll inside the current group panel');
  const laneViewport = requireFullContainment && lane !== groupPanel ? measuredFilterLane(sample,button,lane) : undefined;
  const viewport = groupViewport ?? laneViewport;
  const windowViewport = window.visibleRectPx;
  if (requireFullContainment && (window.source !== 'window-metrics' ||
      ![viewport,windowViewport].every(box => fields.every(key => Number.isInteger(box?.[key])) && box.width >= 0 && box.height >= 0))) {
    return report('NOT_RUN','The exact native lane or current window has no verified visible bounds');
  }
  let locatorPoint;
  if (requireLocatorCenter) {
    try { locatorPoint = layoutTapPoint(scope,{requireClickable:false}); }
    catch (error) {
      if (!(error instanceof EvidenceError)) throw error;
      return report('NOT_RUN',error.message);
    }
  }
  const insideViewport = !viewport || containsRect(viewport,visible);
  const insideWindow = !requireFullContainment || containsRect(windowViewport,visible);
  const actual = {target,lane,carrierPath:button.path,bounds:visible,
    widthVp:native.width / density,heightVp:native.height / density,
    ...(groupViewport ? {groupViewport} : {}), ...(laneViewport ? {laneViewport} : {}),
    ...(locatorPoint ? {locatorPoint} : {})};
  const actionable = target === disabledStatus ? !button.enabled && !button.clickable : button.enabled && button.clickable;
  const valid = button.visible && actionable && button.opacity > 0 &&
    insideViewport && insideWindow && fields.every(key => native[key] === visible[key]) && native.width + 1 >= extent * density &&
    native.height + 1 >= extent * density && native.width >= 2 && native.height >= 4 &&
    (!locatorPoint || containsPoint(visible,locatorPoint));
  return report(valid ? 'PASS' : 'FAIL',valid ? '' : 'Source filter Button is clipped, undersized, in the wrong input state, or misses the locator center',actual);
}

export function sourceFilterEdgeTap(sample, target, edge, options) {
  requireEvidence(sourceFilterEdgeAllowed(target, edge), 'Unsupported source filter edge target');
  const assessed = measureSourceFilterCarrier(sample,target,options);
  requireEvidence(assessed.verdict === 'PASS',assessed.reason);
  const {lane,bounds,laneViewport,...carrier} = assessed.actual;
  const point = {x:Math.floor(bounds.left + bounds.width / 2),
    y:edge === 'top' ? bounds.top + 1 : bounds.top + bounds.height - 2};
  // The Group anchor is an accessibility wrapper. Only its real internal
  // Scroll owns the clip box for the native option buttons.
  const laneBounds = assessed.actual.groupViewport ?? laneViewport ?? selectLayoutNode(sample,lane).visibleRectPx;
  const window = sample.window;
  requireEvidence(containsPoint(window.visibleRectPx,point) && containsPoint(laneBounds,point),
    'Source filter edge is outside its native lane or current Reader window');
  return {edge,point,bounds,...carrier};
}

export function sourceCategoryCenterTap(sample,target) {
  requireEvidence(categoryCenters.some(value => sourceFilterEdgeTarget('category',value) === target),
    'Unsupported Source category center');
  const measured = measureSourceFilterCarrier(sample,target,{requireFullContainment:true});
  requireEvidence(measured.verdict === 'PASS',measured.reason);
  const {left,top,width,height} = measured.actual.bounds;
  return {x:left+Math.floor(width/2),y:top+Math.floor(height/2)};
}

export function readSourceFilterEdge(sample, action, expected, target = sourceFilterEdgeTarget(expected.trigger, expected.value)) {
  if (!action || action.op !== 'click' || action.targetId !== target ||
      action.edgeTap?.edge !== expected.tapEdge) return null;
  try {
    const witness = sourceFilterEdgeTap(sample,target,expected.tapEdge,action.edgeTap);
    return action.edgeTap.x === witness.point.x && action.edgeTap.y === witness.point.y &&
      Number.isSafeInteger(action.edgeTap.probeSeq) && action.edgeTap.probeSeq > 0 ? witness : null;
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return null;
  }
}

const nativeCases = {
  [sourceFilterEdgeCase]: [2,'public-source-filter-touch-edges-v1','filter-selection'],
  [sourceGroupOptionEdgeCase]: [2,sourceGroupOptionEdgeFixture,'group-option-touch-edge'],
  [sourceCategoryTouchEdgeCase]: [1,'public-source-category-touch-edges-v1','filter-selection'],
  'source-management.filter-selections': [6,'public-source-catalog-v1','filter-selection','group-geometry'],
  'source-management.footer-tools-return': [1,'public-source-footer-tools-v1','filter-selection'],
};

function nativeFilterSubject(assertion) {
  const expected = assertion?.expected;
  if (!expected) return undefined;
  if (assertion.kind === 'group-geometry' && expected.withinHost === true && expected.anchored === true)
    return {subject:'group-trigger',target:groupTrigger,position:expected.tapEdge ?? 'center'};
  if (assertion.kind === 'group-option-touch-center' && expected.target === groupOptions[0] &&
      expected.position === 'center' && expected.groupIndex === 0)
    return {subject:'group-selected-option',target:groupOptions[0],position:'center'};
  if (assertion.kind === 'group-option-touch-edge') {
    const {target,tapEdge,groupIndex} = expected;
    if (target === groupOptions[0] && groupIndex === 0 && tapEdge === 'bottom')
      return {subject:'group-selected-option',target,position:tapEdge};
    if (target === groupOptions[1] && groupIndex === 1 && tapEdge === 'top')
      return {subject:'group-other-option',target,position:tapEdge};
    return undefined;
  }
  if (assertion.kind !== 'filter-selection') return undefined;
  const {trigger,field,value,tapEdge} = expected;
  if (trigger === 'group' && field === 'groupIndex' && value === 1 && tapEdge === undefined)
    return {subject:'group-other-option',target:groupOptions[1],position:'center'};
  const target = sourceFilterEdgeTarget(trigger,value);
  if (target && field === trigger && (tapEdge === undefined || sourceFilterEdgeAllowed(target,tapEdge)))
    return {subject:`${trigger}-${value}`,target,position:tapEdge ?? 'center'};
  return undefined;
}

/** Only the released Source contracts with full before/after action samples supply these proofs. */
export function sourceFilterNativeAssertion(contract, assertion) {
  const categoryV2 = contract?.id === sourceCategoryTouchEdgeCase && contract.version === 2;
  const statusV3 = contract?.id === sourceFilterEdgeCase && contract.version === 3;
  const groupV3 = contract?.id === sourceGroupOptionEdgeCase && contract.version === 3;
  const footerV2 = contract?.id === 'source-management.footer-tools-return' && contract.version === 2;
  const policy = groupV3 ? [3,sourceGroupOptionEdgeFixture,'group-option-touch-edge','group-option-touch-center','group-geometry'] :
    categoryV2 ? [2,sourceCategoryTouchFixture,'filter-selection'] :
    statusV3 ? [3,sourceStatusTouchFixture,'filter-selection'] :
    footerV2 ? [2,'public-source-footer-tools-v2','filter-selection'] :
    Object.hasOwn(nativeCases,contract?.id) && nativeCases[contract.id];
  if (!policy || contract.pageId !== 'source-management' || contract.fixture?.publicSources !== true ||
      contract.version !== policy[0] || contract.fixture.id !== policy[1] || !policy.slice(2).includes(assertion?.kind) ||
      assertion.evaluator !== 'source' || assertion.required !== true || assertion.condition ||
      ![assertion.id,assertion.action,assertion.baseline,assertion.sample].every(value => typeof value === 'string' && value) ||
      !Array.isArray(contract.steps)) return undefined;
  const proof = nativeFilterSubject(assertion);
  if (!proof) return undefined;
  const {target,position} = proof;
  const step = contract.steps.find(item => item?.id === assertion.action);
  const origin = contract.steps.find(item => item?.id === assertion.baseline);
  const terminal = contract.steps.find(item => item?.id === assertion.sample);
  const groupCenter = target === groupOptions[1] && position === 'center';
  const selected = groupCenter ? step?.target?.id === target && Array.isArray(step.target.ancestors) && step.target.ancestors.length === 1 &&
    step.target.ancestors[0] === groupPanel && Object.keys(step.target).length === 2 : step?.target === target;
  if (!selected || step.kind !== 'action' || step.op !== 'click' || step.from !== assertion.baseline ||
      origin?.kind !== 'sample' || origin.keyboard !== false || terminal?.kind !== 'sample' ||
      terminal.afterAction !== step.id || terminal.keyboard !== false ||
      (position === 'center' ? step.tapEdge !== undefined :
        step.tapEdge !== position || step.gesture === true || step.requireFullContainment !== true)) return undefined;
  if (assertion.expected.requireNativeTouch === true) {
    const {trigger,value,nativeSelection} = assertion.expected;
    const categoryTouch = categoryV2 && trigger === 'category' && (position === 'center' ?
      sourceCategoryCenterTarget(step,contract.fixture) === target : position === 'top' && categoryEdgeValues.includes(value));
    const statusTouch = statusV3 && trigger === 'status' && position === 'top' && statusEdgeValues.includes(value);
    if (!(categoryTouch || statusTouch) || nativeSelection !== true ||
        !origin.anchors?.includes(target) || !terminal.anchors?.includes(target)) return undefined;
  }
  return proof;
}

export function sourceCategoryNativeChecksValid(contract) {
  if (contract.id !== sourceCategoryTouchEdgeCase || contract.version !== 2 || contract.fixture?.id !== sourceCategoryTouchFixture) return false;
  const selected = contract.assertions.filter(check => check.expected?.requireNativeTouch === true);
  const originalEdges = categoryCenters.every(value => contract.assertions.some(check =>
    check.id === `source.filter.edge.category-${value}` && check.expected?.value === value &&
    check.expected.nativeSelection === true && sourceFilterNativeAssertion(contract,check)?.position === 'top'));
  const values = [...categoryCenters,...categoryEdgeValues];
  return originalEdges && selected.length === values.length && values.every(value => selected.filter(check =>
    check.expected.value === value && sourceFilterNativeAssertion(contract,check)?.position ===
      (categoryCenters.includes(value) ? 'center' : 'top')).length === 1);
}

export function sourceStatusNativeChecksValid(contract) {
  if (contract.id !== sourceFilterEdgeCase || contract.version !== 3 || contract.fixture?.id !== sourceStatusTouchFixture) return false;
  const selected = contract.assertions.filter(check => check.expected?.requireNativeTouch === true);
  return selected.length === statusEdgeValues.length && statusEdgeValues.every(value => selected.filter(check =>
    check.expected.value === value && sourceFilterNativeAssertion(contract,check)?.position === 'top').length === 1);
}

export function sourceFilterNativeDispatch(contract, step, operation, probeSeq) {
  if (!Object.hasOwn(nativeCases,contract.id) || operation.op !== 'click' || !Number.isSafeInteger(probeSeq) || probeSeq <= 0 ||
      ![operation.x,operation.y].every(Number.isSafeInteger)) return undefined;
  const assertions = contract.assertions.filter(assertion => assertion.action === step.id &&
    sourceFilterNativeAssertion(contract,assertion));
  if (assertions.length !== 1) return undefined;
  return {assertionId:assertions[0].id,x:operation.x,y:operation.y,probeSeq};
}

export function readSourceFilterNativeInteraction(sample, action, assertion) {
  const proof = nativeFilterSubject(assertion);
  const raw = action?.filterTouch;
  if (!proof || !raw || raw.assertionId !== assertion.id || action.op !== 'click' || action.targetId !== proof.target ||
      action.from !== assertion.baseline || ![raw.x,raw.y,raw.probeSeq].every(Number.isSafeInteger) || raw.probeSeq <= 0) {
    return undefined;
  }
  const center = proof.position === 'center';
  const locatorCenter = center && assertion.expected.requireNativeTouch !== true;
  const options = {requireFullContainment:true,requireLocatorCenter:locatorCenter};
  const measured = measureSourceFilterCarrier(sample,proof.target,options);
  if (measured.verdict !== 'PASS') return undefined;
  const {bounds,carrierPath,locatorPoint} = measured.actual;
  const {left,top,width,height} = bounds;
  const {x,y,probeSeq} = raw;
  const exactX = left+Math.floor(width/2);
  const exactY = center ? top+Math.floor(height/2) : proof.position === 'top' ? top+1 : top+height-2;
  if (locatorCenter ? x !== locatorPoint.x || y !== locatorPoint.y || Math.abs(x-exactX) > 1 || Math.abs(y-exactY) > 1 :
      x !== exactX || y !== exactY) return undefined;
  return {...proof,carrierPath,bounds,visible:true,clipped:false,enabled:true,accepted:true,
    actionId:assertion.action,baselineSampleId:assertion.baseline,dispatch:{x,y,probeSeq}};
}

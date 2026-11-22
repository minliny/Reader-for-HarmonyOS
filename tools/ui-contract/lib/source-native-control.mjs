import { ancestorsOf } from './layout.mjs';
import { effectiveAppearance } from './structure.mjs';

const list = 'reader-source-list';
const search = 'reader-source-search';
const footer = 'reader-source-footer';
const targets = new Map([
  ['reader-source-back', {scope:[/^reader-native-slot:[1-9]\d*$/u]}],
  ['reader-source-header-tools-button', {id:/^source-back:\d+:tools:header$/u,scope:['reader-source-header-tools']}],
  ['reader-source-editor', {type:'TextInput',scope:[search,list],extended:true}],
  ['reader-source-search-import-button', {id:/^source-back:\d+:import:header$/u,scope:[search,list],extended:true}],
  ['reader-source-footer-tools-button', {id:/^source-back:\d+:tools:footer$/u,scope:[footer]}],
  ['reader-source-footer-add-button', {id:/^source-back:\d+:import:footer$/u,scope:[footer]}],
  ['reader-source-clear-filters', {scope:['reader-source-filtered-empty',list]}],
  ['reader-source-read-retry', {scope:['reader-source-empty-state',list]}],
  ['reader-source-retained-read-retry', {scope:['reader-source-filter-block',list]}],
  ['reader-source-status-action', {scope:['reader-source-filter-block',list]}],
  ['reader-source-original-reconcile', {scope:['reader-source-original-recovery','reader-source-pending-recovery']}],
  ['reader-source-original-continue', {scope:['reader-source-original-recovery','reader-source-pending-recovery']}],
  ['reader-source-original-expand', {scope:['reader-source-original-recovery','reader-source-pending-recovery']}],
  ['reader-source-unknown-reconcile', {scope:['reader-source-unknown-recovery','reader-source-pending-recovery']}],
  ['reader-source-unknown-expand', {scope:['reader-source-unknown-recovery','reader-source-pending-recovery']}],
  ['reader-source-row-detect-control', {scope:[/^reader-source-row-[1-9]\d*$/u,list]}],
  ['reader-source-row-login-control', {scope:[/^reader-source-row-[1-9]\d*$/u,list]}],
]);

export function sourceNativeControlAllowed(target) {
  return targets.has(target);
}

const fields = ['left','top','width','height'];
const measured = rect => fields.every(key => Number.isSafeInteger(rect?.[key])) &&
  rect.width >= 0 && rect.height >= 0;
const contains = (outer,inner) => inner.left >= outer.left && inner.top >= outer.top &&
  inner.left + inner.width <= outer.left + outer.width && inner.top + inner.height <= outer.top + outer.height;
const matches = (pattern,id) => typeof pattern === 'string' ? pattern === id : pattern.test(id ?? '');

function scopedControl(sample,target,policy) {
  const candidates = sample?.nodes?.flatMap(node => {
    if (node.source !== 'native-tree' || node.type !== (policy.type ?? 'Button') ||
        !(matches(policy.id ?? target,node.id) || node.alias === target)) return [];
    const ancestors = ancestorsOf(sample,node);
    const scope = policy.scope.map(pattern => ancestors.filter(parent => matches(pattern,parent.id)));
    return scope.every(nodes => nodes.length === 1) && scope.every(([parent],index) =>
      index === 0 || ancestors.indexOf(parent) > ancestors.indexOf(scope[index-1][0])) ?
      [{node,scope:scope.map(([parent]) => parent)}] : [];
  });
  return candidates?.length === 1 ? candidates[0] : undefined;
}

export function readSourceQueryEditor(sample) {
  const target = 'reader-source-editor';
  return scopedControl(sample,target,targets.get(target))?.node;
}

export function measureSourceNativeControl(sample,target,{verifyMinimum = true} = {}) {
  const report = (verdict,reason = '',actual = null) => ({verdict,reason,actual});
  const policy = targets.get(target);
  if (!policy) throw new Error('Unsupported native source control');
  const window = sample?.window;
  if (sample?.captureComplete !== true || window?.source !== 'window-metrics' ||
      window.keyboard?.visible !== false || !Number.isFinite(window.density) || window.density <= 0 ||
      !measured(window.visibleRectPx)) {
    return report('NOT_RUN','No complete current source window with measured bounds and IME hidden');
  }
  const control = scopedControl(sample,target,policy);
  if (!control) return report('NOT_RUN','The scoped native Source control is missing or ambiguous');
  const {node,scope} = control;
  const appearance = effectiveAppearance(sample,node);
  if (![node.rectPx,node.visibleRectPx,...scope.map(parent=>parent.visibleRectPx)].every(measured) ||
      appearance.visible === null || typeof node.enabled !== 'boolean' || typeof node.clickable !== 'boolean') {
    return report('NOT_RUN','Native bounds, effective visibility or interactivity are unavailable');
  }
  const {rectPx,visibleRectPx} = node;
  const {density} = window;
  const actual = {target,carrierPath:node.path,bounds:visibleRectPx,widthVp:rectPx.width/density,heightVp:rectPx.height/density};
  if (!appearance.visible || !node.enabled || !node.clickable || visibleRectPx.width <= 0 || visibleRectPx.height <= 0 ||
      !fields.every(key => rectPx[key] === visibleRectPx[key]) ||
      ![window.visibleRectPx,...scope.map(parent=>parent.visibleRectPx)].every(outer=>contains(outer,visibleRectPx))) {
    return report('FAIL','The actual native control is clipped, hidden, disabled, or leaves its owning region',actual);
  }
  const minimumVp = 44;
  if (verifyMinimum && (rectPx.width+1 < minimumVp*density || rectPx.height+1 < minimumVp*density)) {
    return policy.extended ?
      report('NOT_RUN','The native paint box is smaller than 44vp; the extended response area needs actual dispatch evidence',actual) :
      report('FAIL','The actual native control is smaller than 44vp',actual);
  }
  return report('PASS','',actual);
}

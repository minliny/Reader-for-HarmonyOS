import { effectiveAppearance } from './structure.mjs';

export const sourceFilterScrollCase = 'source-management.filter-selections';
export const sourceFilterScrollLanes = {
  status:{viewport:'reader-source-status-filter',baseline:'unchecked',action:'scroll-status',sample:'status-tail',
    prefix:'reader-source-status-',chips:['all','enabled','error','unchecked','custom'],tail:'custom'},
  category:{viewport:'reader-source-category-filter',baseline:'failed-filter',action:'scroll-categories',sample:'category-tail',
    prefix:'source-category-',chips:['all','novel','comic','music','download','external','other'],tail:'other'},
};

const coordinates = ['left','top','width','height'];
const measured = rect => coordinates.every(key=>Number.isSafeInteger(rect?.[key])) && rect.width > 0 && rect.height > 0;
const equalRect = (left,right) => measured(left) && measured(right) && coordinates.every(key=>left[key] === right[key]);
const right = rect => rect.left + rect.width;
const contains = (outer,inner) => measured(outer) && measured(inner) && outer.left <= inner.left &&
  right(outer) >= right(inner) && outer.top <= inner.top && outer.top + outer.height >= inner.top + inner.height;
const inside = (rect,x,y) => Number.isSafeInteger(x) && Number.isSafeInteger(y) &&
  x >= rect.left && x < right(rect) && y >= rect.top && y < rect.top + rect.height;
const sameHeightAndSize = (before,after) => ['top','width','height'].every(key=>before[key] === after[key]);

export function sourceFilterScrollFrame(sample,policy) {
  const scopes = sample.nodes.filter(node=>node.id === policy.viewport || node.alias === policy.viewport);
  const [viewport] = scopes;
  if (scopes.length !== 1 || viewport.type !== 'Scroll' || !viewport.key || viewport.clip !== true ||
      effectiveAppearance(sample,viewport).visible !== true || !equalRect(viewport.rectPx,viewport.visibleRectPx) ||
      !contains(sample.window.visibleRectPx,viewport.rectPx)) return null;
  const [row,...otherRows] = sample.nodes.filter(node=>node.parentPath === viewport.path && node.type === 'Row');
  if (!row?.key || otherRows.length || !measured(row.rectPx) || effectiveAppearance(sample,row).visible !== true) return null;
  const nodes = sample.nodes.filter(node=>node.path.startsWith(row.path + '/'));
  const chips = {};
  for (const chip of policy.chips) {
    const [anchor,...otherAnchors] = nodes.filter(node=>node.id === policy.prefix + chip);
    if (!anchor) continue;
    const carriers = nodes.filter(node=>node.type === 'Button' && (node === anchor || node.path.startsWith(anchor.path + '/')));
    if (otherAnchors.length || carriers.length !== 1 || !carriers[0].key || !measured(carriers[0].rectPx)) return null;
    chips[chip] = carriers[0];
  }
  return {viewport,row,chips};
}

export function sourceFilterSwipeDispatch(step,operation,probeSeq) {
  if (operation.op !== 'swipe' || !Object.values(sourceFilterScrollLanes).some(lane=>lane.viewport === step.target)) return null;
  const {fromX,fromY,toX,toY,velocity} = operation;
  return {fromX,fromY,toX,toY,velocity,probeSeq};
}

export function measureSourceFilterScroll(before,after,dispatch,lane) {
  const report = (verdict,reason,actual = null) => ({verdict,reason,actual});
  const policy = sourceFilterScrollLanes[lane];
  const other = sourceFilterScrollLanes[lane === 'status' ? 'category' : 'status'];
  const head = sourceFilterScrollFrame(before,policy);
  const end = sourceFilterScrollFrame(after,policy);
  const otherHead = sourceFilterScrollFrame(before,other);
  const otherEnd = sourceFilterScrollFrame(after,other);
  if (!head || !end || !otherHead || !otherEnd) {
    return report('NOT_RUN','Both scoped native filter Scrolls and their content Rows must be measurable before and after the swipe');
  }
  const viewport = head.viewport.rectPx;
  const {fromX,fromY,toX,toY,velocity,probeSeq} = dispatch ?? {};
  if (!Number.isSafeInteger(probeSeq) || probeSeq < 1 || !Number.isSafeInteger(velocity) || velocity < 1 ||
      fromX <= toX || fromY !== toY || !inside(viewport,fromX,fromY) || !inside(viewport,toX,toY)) {
    return report('NOT_RUN','There is no verified native leftward swipe inside the current filter Scroll');
  }
  const overflowBeforePx = right(head.row.rectPx) - right(viewport);
  const initialTail = head.chips[policy.tail];
  if (overflowBeforePx <= 1 || initialTail && contains(viewport,initialTail.rectPx)) {
    return report('NOT_RUN','The current filter lane had no demonstrably clipped tail before the swipe');
  }

  const distancePx = head.row.rectPx.left - end.row.rectPx.left;
  const matchingChips = policy.chips.filter(chip=>head.chips[chip] && end.chips[chip]);
  const tail = end.chips[policy.tail];
  const actual = {lane:policy.viewport,viewport,dispatch,overflowBeforePx,distancePx,distanceVp:distancePx / before.window.density,
    matchingChips:matchingChips.map(chip=>({id:policy.prefix + chip,before:head.chips[chip].rectPx,after:end.chips[chip].rectPx})),
    tail:tail ? {id:policy.prefix + policy.tail, before:initialTail?.rectPx ?? null, after:tail.rectPx, visible:tail.visibleRectPx} : null};
  const stableLane = (first,last) => first.viewport.key === last.viewport.key && first.row.key === last.row.key &&
    equalRect(first.viewport.rectPx,last.viewport.rectPx);
  if (!stableLane(head,end) || !stableLane(otherHead,otherEnd) || !equalRect(otherHead.row.rectPx,otherEnd.row.rectPx) ||
      !sameHeightAndSize(head.row.rectPx,end.row.rectPx) || distancePx <= 1 || distancePx > overflowBeforePx + 1) {
    return report('FAIL','The swipe failed to advance only the intended content Row inside its existing viewport',actual);
  }
  if (!matchingChips.length) return report('NOT_RUN','No common native filter Button can corroborate the content Row displacement',actual);
  const chipsMoved = matchingChips.every(chip=>{
    const left = head.chips[chip];
    const right = end.chips[chip];
    return left.key === right.key && sameHeightAndSize(left.rectPx,right.rectPx) &&
      Math.abs(left.rectPx.left - right.rectPx.left - distancePx) <= 1;
  });
  if (!chipsMoved) return report('FAIL','The corresponding native filter Buttons did not translate with their original content Row',actual);
  if (!tail || effectiveAppearance(after,tail).visible !== true || !equalRect(tail.rectPx,tail.visibleRectPx) ||
      !contains(viewport,tail.rectPx) || right(tail.rectPx) + distancePx <= right(viewport) + 1) {
    return report('FAIL','The swipe did not fully reveal the previously clipped native tail Button',actual);
  }
  return report('PASS','',actual);
}

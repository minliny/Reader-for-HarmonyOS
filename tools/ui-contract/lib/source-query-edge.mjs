import { requireEvidence } from './evidence.mjs';
import { ancestorsOf } from './layout.mjs';
import { measureSourceNativeControl, readSourceQueryEditor } from './source-native-control.mjs';

export const sourceQueryEdgeCase = 'source-management.query-editor-touch-edges';
export const sourceQueryEdgeFixture = 'public-source-query-editor-touch-edges-v1';
export const sourceQueryTouchFixture = 'public-source-query-editor-touch-edges-v2';
export const sourceQueryEditor = 'reader-source-editor';
export const sourceQueryPositions = ['center','top','bottom'];

export function sourceQueryEdgeAllowed(target,edge) {
  return target === sourceQueryEditor && (edge === 'top' || edge === 'bottom');
}

export function sourceQueryTouchPosition(step,fixture) {
  if (fixture?.id !== sourceQueryTouchFixture || step?.target !== sourceQueryEditor || step.op !== 'click') return;
  if (step.id === 'tap-query-center' && step.tapEdge === undefined) return 'center';
  if (sourceQueryEdgeAllowed(step.target,step.tapEdge) && step.id === `tap-query-${step.tapEdge}`) return step.tapEdge;
}

const rectFields = ['left','top','width','height'];
const box = rect => rectFields.every(field => Number.isSafeInteger(rect?.[field])) && rect.width > 0 && rect.height > 0;
const right = rect => rect.left + rect.width;
const bottom = rect => rect.top + rect.height;
const visible = node => node.visible === true && node.opacity > 0 && box(node.rectPx) && box(node.visibleRectPx);
const missing = reason => ({verdict:'NOT_RUN',reason});

function readSourceQueryCarrier(sample, legacy) {
  const carrier = measureSourceNativeControl(sample,sourceQueryEditor,{verifyMinimum:legacy});
  if (carrier.verdict === 'FAIL' || !carrier.actual) return carrier;
  const editor = readSourceQueryEditor(sample);
  if (typeof editor.focused !== 'boolean' || legacy && editor.focused !== false)
    return missing('The current native Source editor focus state is unavailable for this input');
  const {density} = sample.window;
  const painted = editor.rectPx;
  const allAncestors = ancestorsOf(sample,editor);
  const [field,frame] = allAncestors;
  const search = allAncestors.findIndex(parent => parent.id === 'reader-source-search');
  const list = allAncestors.findIndex(parent => parent.id === 'reader-source-list');
  if (field?.type !== 'Row' || frame?.type !== 'Stack' || search <= 1 || list <= search ||
      allAncestors[list].type !== 'List') {
    return missing('The current query input has no identifiable native field and Source List');
  }
  const targetHeight = 44 * density;
  if (painted.width + 1 < targetHeight) return {
    verdict:'FAIL',reason:'The native query width is below 44vp and its response region uses 100% of that width',actual:carrier.actual,
  };
  if (!visible(field) || !visible(frame)) return missing('The native query field and frame are not both measurable');
  const masks = [...allAncestors.slice(0,list+1).map(node => node.visibleRectPx),sample.window.visibleRectPx];
  if (!masks.every(box)) return missing('The native query response lane cannot be verified across its visible ancestors');
  return {verdict:'PASS',actual:{carried:carrier.actual,painted,field,density,masks}};
}

export function measureSourceQueryEdge(sample,edge) {
  const measured = readSourceQueryCarrier(sample,true);
  if (measured.verdict !== 'PASS') return measured;
  const {carried,painted,density,field,masks} = measured.actual;
  const targetHeight = 44 * density;
  // The default Source field is 44vp and the 1vp borders leave 42vp of
  // TextInput paint. ReaderActionTouchRegion vertically centers its 44vp
  // response on this paint and leaves the horizontal span unchanged.
  if (Math.abs(field.rectPx.height - targetHeight) > 1 ||
      Math.abs(painted.height - 42 * density) > 1) {
    return missing('The captured query field has no calibrated 42vp paint inside a 44vp response lane');
  }
  const center = painted.top + painted.height/2;
  const declared = {left:painted.left,top:center-targetHeight/2,width:painted.width,height:targetHeight};
  const fits = masks.every(rect => rect.left <= declared.left && right(rect) >= right(declared) &&
    rect.top <= declared.top + 1 && bottom(rect) >= bottom(declared) - 1);
  if (!fits) return {
    verdict:'FAIL',reason:'The declared query response region leaves its visible native field or viewport',
    actual:{...carried,painted,declared},
  };
  const top = Math.max(declared.top,...masks.map(rect=>rect.top));
  const end = Math.min(bottom(declared),...masks.map(bottom));
  const point = {x:Math.floor(painted.left + painted.width/2),y:edge === 'top' ? Math.ceil(top)+1 : Math.floor(end)-2};
  if (point.y < top || point.y >= end || (edge === 'top' ? point.y >= painted.top : point.y < bottom(painted))) {
    return missing('No distinct unclipped native pixel remains inside the declared response region and outside the query paint');
  }
  return {verdict:'PASS',reason:'',actual:{painted,declared,point}};
}

export function measureSourceQueryTouch(sample,position) {
  if (!sourceQueryPositions.includes(position)) return missing('Unknown Source query touch position');
  const measured = readSourceQueryCarrier(sample,false);
  if (measured.verdict !== 'PASS') return measured;
  const {carried,painted,field,density,masks} = measured.actual;
  const minimum = 44*density;
  const borderedPaint = Math.abs(field.rectPx.height-painted.height-2*density) <= 2;
  // The current Source input floors its painted height at 44vp. In the
  // compact default field, that can occupy the entire bordered Row.
  const fillsMinimumLane = Math.abs(painted.height-minimum) <= 1 &&
    Math.abs(painted.top-field.rectPx.top) <= 1 &&
    Math.abs(bottom(painted)-bottom(field.rectPx)) <= 1;
  if (field.rectPx.height+1 < minimum || !(borderedPaint || fillsMinimumLane))
    return missing('The real native Source editor and bordered field do not identify the current response lane');
  const extendsPaint = painted.height+1 < minimum;
  const declared = extendsPaint ? {...painted,top:painted.top+(painted.height-minimum)/2,height:minimum} : {...painted};
  const left = Math.ceil(Math.max(declared.left,...masks.map(rect=>rect.left)));
  const top = Math.ceil(Math.max(declared.top,...masks.map(rect=>rect.top)));
  const endX = Math.floor(Math.min(right(declared),...masks.map(right)));
  const endY = Math.floor(Math.min(bottom(declared),...masks.map(bottom)));
  const bounds = {left,top,width:endX-left,height:endY-top};
  const clipped = masks.some(rect=>rect.left > declared.left || right(rect) < right(declared) ||
    rect.top > declared.top+1 || bottom(rect) < bottom(declared)-1);
  if (clipped || bounds.width+1 < minimum || bounds.height+1 < minimum) return {
    verdict:'FAIL',reason:'The actual Source query response area is below 44vp or clipped by its native ancestors',
    actual:{...carried,painted,declared,bounds},
  };
  const point = {x:painted.left+Math.floor(painted.width/2),y:
    position === 'top' ? top+1 : position === 'bottom' ? endY-2 : painted.top+Math.floor(painted.height/2)};
  const insidePaint = point.y >= painted.top && point.y < bottom(painted);
  if (point.y < top || point.y >= endY || insidePaint !== (position === 'center' || !extendsPaint))
    return missing('No physical pixel proves the current query center or its corresponding response edge');
  return {verdict:'PASS',reason:'',actual:{...carried,painted,declared,bounds,point,extendsPaint}};
}

export function sourceQueryTouchTap(sample,position) {
  const measurement = measureSourceQueryTouch(sample,position);
  requireEvidence(measurement.verdict === 'PASS',measurement.reason);
  return measurement.actual;
}

export function sourceQueryEdgeTap(sample,target,edge) {
  requireEvidence(sourceQueryEdgeAllowed(target,edge),'Unsupported Source query edge');
  const measurement = measureSourceQueryEdge(sample,edge);
  requireEvidence(measurement.verdict === 'PASS',measurement.reason);
  return measurement.actual;
}

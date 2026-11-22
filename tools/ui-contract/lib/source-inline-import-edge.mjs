import { requireEvidence } from './evidence.mjs';
import { ancestorsOf } from './layout.mjs';
import { measureSourceNativeControl } from './source-native-control.mjs';
import { sourceReadObservation } from './source-read.mjs';

export const sourceInlineImportEdgeCase = 'source-management.inline-import-touch-edges';
export const sourceInlineImportEdgeFixture = 'public-source-inline-import-touch-edges-v1';
export const sourceInlineImportButton = 'reader-source-search-import-button';
export const sourceInlineImportDialog = 'reader-source-inline-import-dialog';
export const sourceInlineImportEdges = Object.freeze(['top','bottom','left','right']);
export const sourceInlineImportCenterAction = 'tap-inline-import-center';
export const sourceInlineImportCenterKind = 'source-inline-import-center';
export const sourceInlineImportAreaKind = 'source-inline-import-area';

const buttonId = /^source-back:[1-9]\d*:import:header$/u;
const dialogId = /^reader-json-import:[1-9]\d*$/u;
const fields = ['left','top','width','height'];
const box = rect => fields.every(field => Number.isSafeInteger(rect?.[field])) &&
  rect.width > 0 && rect.height > 0;
const right = rect => rect.left + rect.width;
const bottom = rect => rect.top + rect.height;
const inside = (rect,{x,y}) => x >= rect.left && x < right(rect) && y >= rect.top && y < bottom(rect);
const center = rect => ({x:rect.left + rect.width / 2,y:rect.top + rect.height / 2});
const contains = (outer,inner,tolerance = 0) => outer.left <= inner.left + tolerance &&
  outer.top <= inner.top + tolerance && right(outer) >= right(inner) - tolerance &&
  bottom(outer) >= bottom(inner) - tolerance;
const visible = node => node?.visible === true && node.opacity > 0 && box(node.visibleRectPx);
const fullyVisible = node => visible(node) && box(node.rectPx) &&
  fields.every(field => node.rectPx[field] === node.visibleRectPx[field]);
const missing = reason => ({verdict:'NOT_RUN',reason});
const fail = (reason,actual) => ({verdict:'FAIL',reason,actual});
const pass = actual => ({verdict:'PASS',reason:'',actual});

export function sourceInlineImportEdgeAllowed(target,edge) {
  return target === sourceInlineImportButton && sourceInlineImportEdges.includes(edge);
}

export function sourceInlineImportCenterStep(step,fixture) {
  return fixture?.id === sourceInlineImportEdgeFixture && step.id === sourceInlineImportCenterAction &&
    step.from === 'inline-import-returned-right' && step.target === sourceInlineImportButton &&
    step.op === 'click' && !step.gesture && step.tapEdge === undefined;
}

function measureSourceInlineImportArea(sample) {
  const button = measureSourceNativeControl(sample,sourceInlineImportButton);
  if (button.verdict === 'FAIL' || !button.actual) return button;
  const node = sample.nodes.find(item => item.path === button.actual.carrierPath);
  if (!buttonId.test(node?.id ?? '')) return missing('No current native inline import Button');
  const ancestors = ancestorsOf(sample,node);
  const [lane,search] = ancestors;
  const listIndex = ancestors.findIndex(item => item.type === 'List' && item.id === 'reader-source-list');
  if (lane?.type !== 'Stack' || search?.type !== 'Row' || search.id !== 'reader-source-search' || listIndex < 2) {
    return missing('No unique inline import Button under the measured query lane and Source list');
  }
  if (ancestors.some(item=>item.enabled === false))
    return missing('An ancestor suspends input for the current native inline import Button');
  const {density} = sample.window;
  const painted = node.rectPx;
  const paintedSize = 40 * density;
  const targetSize = 44 * density;
  const masks = [...ancestors.slice(0,listIndex+1).map(item=>item.visibleRectPx),sample.window.visibleRectPx];
  if (!box(lane.rectPx) || !masks.every(box) || typeof lane.visible !== 'boolean' ||
      !Number.isFinite(lane.opacity)) return missing('The native inline import response lane cannot be measured');
  if (Math.abs(painted.width-paintedSize) > 1 || Math.abs(painted.height-paintedSize) > 1) {
    return missing('The inline import instance does not have the calibrated 40vp Button paint');
  }
  const pointCenter = center(painted);
  const declared = {left:pointCenter.x-targetSize/2,top:pointCenter.y-targetSize/2,width:targetSize,height:targetSize};
  const bounds = lane.rectPx;
  const actual = {carrierId:node.id,carrierPath:node.path,painted,declared,lane:bounds,bounds};
  if (!fullyVisible(lane) || bounds.width + 1 < targetSize || bounds.height + 1 < targetSize ||
      !masks.every(rect=>contains(rect,bounds) && contains(rect,declared,1))) {
    return fail('The inline import response is clipped or leaves its native 44vp lane',actual);
  }
  const laneCenter = center(bounds);
  if (Math.abs(bounds.width-targetSize) > 1 || Math.abs(bounds.height-targetSize) > 1 ||
      Math.abs(laneCenter.x-pointCenter.x) > 1 || Math.abs(laneCenter.y-pointCenter.y) > 1) {
    return missing('The native Stack does not identify the centered 44vp inline import response lane');
  }
  return pass(actual);
}

export function measureSourceInlineImportEdge(sample,position) {
  const isCenter = position === 'center';
  if (!isCenter && !sourceInlineImportEdges.includes(position)) return missing('Unsupported inline import touch position');
  const area = measureSourceInlineImportArea(sample);
  if (area.verdict !== 'PASS') return area;
  const {painted,declared,bounds} = area.actual;
  const pointCenter = center(painted);
  const point = {x:Math.floor(pointCenter.x),y:Math.floor(pointCenter.y)};
  if (position === 'left') point.x = bounds.left + 1;
  if (position === 'right') point.x = right(bounds) - 2;
  if (position === 'top') point.y = bounds.top + 1;
  if (position === 'bottom') point.y = bottom(bounds) - 2;
  if (inside(painted,point) !== isCenter || ![declared,bounds].every(rect=>inside(rect,point))) {
    return missing('No distinct native pixel for the selected position in the full inline import response');
  }
  return pass({...area.actual,point});
}

export function sourceInlineImportEdgeTap(sample,target,edge) {
  requireEvidence(sourceInlineImportEdgeAllowed(target,edge) || target === sourceInlineImportButton && edge === 'center',
    'Unsupported inline import touch position');
  const dialog = readSourceInlineImportDialog(sample);
  requireEvidence(dialog.verdict === 'PASS' && dialog.actual.state === 'absent',
    'Inline import requires the current native Source opening without an existing JSON import dialog');
  const measured = measureSourceInlineImportEdge(sample,edge);
  requireEvidence(measured.verdict === 'PASS',measured.reason);
  return measured.actual;
}

export function readSourceInlineImportDialog(sample) {
  if (sample?.captureComplete !== true || sample.sourceInlineImportDialogObserved !== true)
    return missing('No complete current native observation of the Source import dialog');
  const scopes = sample.nodes.filter(node=>node.source === 'native-tree' && dialogId.test(node.id ?? ''));
  if (scopes.some(node=>typeof node.visible !== 'boolean'))
    return missing('The native import dialog scope has no visible state');
  const active = scopes.filter(node=>node.visible);
  if (!active.length) return pass({state:'absent'});
  if (active.length > 1) return fail('More than one native JSON import dialog is visible',{dialogIds:active.map(node=>node.id)});
  const [scope] = active;
  const titles = sample.nodes.filter(node=>node.source === 'native-tree' && node.sourceInlineImportDialogTitle === true &&
    node.type === 'Text' && ancestorsOf(sample,node).includes(scope));
  const buttons = sample.nodes.filter(node=>node.source === 'native-tree' && node.id === scope.id + ':local' &&
    node.type === 'Button' && ancestorsOf(sample,node).includes(scope));
  const [title] = titles;
  const [local] = buttons;
  const actual = {dialogId:scope.id,dialogPath:scope.path,localPath:local?.path ?? null};
  if (scope.type !== 'Stack' || titles.length !== 1 || buttons.length !== 1) {
    return fail('The visible dialog does not identify the one book-source title and its own local file button',actual);
  }
  if (![scope,title,local].every(node=>typeof node.visible === 'boolean' && Number.isFinite(node.opacity) &&
      box(node.rectPx) && box(node.visibleRectPx)) || typeof local.enabled !== 'boolean' || typeof local.clickable !== 'boolean') {
    return missing('The book-source dialog title or local control lacks native bounds or interactivity');
  }
  if (![scope,title,local].every(visible) || !fullyVisible(local) || !local.enabled || !local.clickable) {
    return fail('The actual book-source dialog title or local file button is hidden, clipped or disabled',actual);
  }
  return pass({...actual,state:'present'});
}

const fullSample = sample => sample?.captureComplete === true && sample.window?.source === 'window-metrics' &&
  sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) && sample.evidenceRefs.some(ref=>ref.path.endsWith('.json'));
const sameOwner = (left,right) => Number.isSafeInteger(left?.generation) && left.generation > 0 &&
  Number.isSafeInteger(left.mounting) && left.mounting >= 0 && left.generation === right?.generation && left.mounting === right?.mounting;
const sameProjection = (a,b) => sameOwner(a.owner,b?.owner) &&
  ['readFact','readGeneration','state','status','category','groupIndex','queryLength','allGroups','projected','count','filterRevision','firstAnchor']
    .every(key=>a[key] === b[key]);
const paired = (action,before,after) => action?.from === before.sampleId && action?.instanceId === before.instanceId &&
  action.instanceId === after.instanceId && before.window.id === after.window.id &&
  before.window.density === after.window.density &&
  [before.afterSeq,action.beforeSeq,action.afterSeq,after.beforeSeq].every(Number.isSafeInteger) &&
  before.afterSeq <= action.beforeSeq && action.beforeSeq < action.afterSeq && action.afterSeq <= after.beforeSeq;
const positiveInt = value => Number.isSafeInteger(value) && value > 0;

export function evaluateSourceInlineImportEdge(assertion,context) {
  const {actions,samples,events} = context;
  const expected = assertion.expected;
  const area = assertion.kind === sourceInlineImportAreaKind;
  const position = assertion.kind === sourceInlineImportCenterKind ? 'center' : expected.tapEdge;
  const startId = area ? assertion.sample : assertion.baseline;
  const start = samples[startId];
  const dialog = samples[assertion.dialogSample];
  const returned = samples[assertion.sample];
  const click = actions[assertion.action];
  const back = actions[assertion.returnAction];
  const observations = [start,dialog,returned,click,back];
  const report = (verdict,reason,actual=null) => ({verdict,reason,actual,expected,
    evidenceRefs:observations.flatMap(observation=>observation?.evidenceRefs ?? []),
  });
  const opening = sourceReadObservation({action:area ? assertion.action : assertion.entryAction,sample:startId,expected:{state:'rows'}},context);
  const before = opening?.current.payload;
  if (!fullSample(start) || !opening?.triggered || before.readFact !== 'current' || before.state !== 'rows' ||
      !positiveInt(before.readGeneration) || !positiveInt(before.filterRevision) || !positiveInt(before.count)) {
    return report('NOT_RUN','No complete current normal Source opening before the inline import touch');
  }
  observations.push(opening.entry,opening.current);
  const beforeDialog = readSourceInlineImportDialog(start);
  if (beforeDialog.verdict !== 'PASS' || beforeDialog.actual.state !== 'absent') {
    return report('NOT_RUN','The starting native Source window is not verified to be free of an existing import dialog');
  }
  const geometry = area ? measureSourceInlineImportArea(start) : measureSourceInlineImportEdge(start,position);
  if (geometry.verdict !== 'PASS') return report(geometry.verdict,geometry.reason,geometry.actual);
  const {carrierPath,bounds,painted} = geometry.actual;
  const nativeInteraction = {subject:'search-import',target:sourceInlineImportButton,carrierPath,bounds,painted,
    visible:true,clipped:false,enabled:true};
  if (area) return report('PASS','',{...geometry.actual,sampleId:assertion.sample,nativeInteraction});
  const dispatch = position === 'center' ? click?.inlineImportTap : click?.edgeTap;
  if (!fullSample(dialog) || !paired(click,start,dialog) || click.op !== 'click' ||
      click.targetId !== sourceInlineImportButton || !positiveInt(dispatch?.probeSeq) ||
      position !== 'center' && dispatch.edge !== position) {
    return report('NOT_RUN','No verified native inline import click and dialog endpoint');
  }
  const intervening = (sample,afterSeq,kind) => events.filter(event=>event.instanceId === start.instanceId &&
    event.channel === 'business' && event.kind === kind && event.eventSeq > afterSeq && event.eventSeq <= sample.beforeSeq);
  const openingRoutes = intervening(dialog,click.beforeSeq,'source.route');
  const openingProjections = intervening(dialog,click.beforeSeq,'source.projection');
  observations.push(...openingRoutes,...openingProjections);
  const afterDialog = readSourceInlineImportDialog(dialog);
  const actual = {...geometry.actual,dispatch,dialog:afterDialog.actual ?? null};
  if (dispatch.x !== geometry.actual.point.x || dispatch.y !== geometry.actual.point.y ||
      openingRoutes.length || openingProjections.some(event=>!sameProjection(before,event.payload)) ||
      dialog.window.keyboard?.visible === true || afterDialog.verdict === 'FAIL' ||
      afterDialog.verdict === 'PASS' && afterDialog.actual.state === 'absent') {
    return report('FAIL','The verified click did not open the book-source import dialog in the same Source state',actual);
  }
  if (afterDialog.verdict !== 'PASS' || dialog.window.keyboard?.visible !== false ||
      !fullSample(returned) || !paired(back,dialog,returned) || back.op !== 'keyEvent' || back.key !== 'Back') {
    return report('NOT_RUN','Missing the native import dialog or its first verified system Back endpoint',actual);
  }
  const closingRoutes = intervening(returned,dialog.beforeSeq,'source.route');
  const closingProjections = intervening(returned,dialog.beforeSeq,'source.projection');
  observations.push(...closingRoutes,...closingProjections);
  const released = readSourceInlineImportDialog(returned);
  const retained = measureSourceInlineImportEdge(returned,position);
  const endpoint = {...actual,returned:released.actual ?? null};
  if (closingRoutes.length || closingProjections.some(event=>!sameProjection(before,event.payload)) ||
      returned.window.keyboard?.visible === true || released.verdict === 'FAIL' ||
      released.verdict === 'PASS' && released.actual.state !== 'absent' || retained.verdict === 'FAIL' ||
      retained.verdict === 'PASS' && retained.actual.carrierId !== geometry.actual.carrierId) {
    return report('FAIL','System Back did not clear the import dialog and return to the same untouched Source opening',endpoint);
  }
  if (released.verdict !== 'PASS' || retained.verdict !== 'PASS' || returned.window.keyboard?.visible !== false)
    return report('NOT_RUN','The returned native Source opening or its import control remains unverified',endpoint);
  return report('PASS','',{...endpoint,sampleId:assertion.sample,nativeInteraction:{...nativeInteraction,position,
    accepted:true,actionId:assertion.action,baselineSampleId:assertion.baseline,
    dispatch:{x:dispatch.x,y:dispatch.y,probeSeq:dispatch.probeSeq}}});
}

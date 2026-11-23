import { EvidenceError, requireEvidence } from '../../lib/native-ui-evidence.mjs';
import { ancestorsOf, layoutTapPoint, selectLayoutNode, sourceGroupOptionsReference, sourceGroupOptionsScroll,
  sourceGroupOptionsTail } from './layout.mjs';
import { sourceGroupBackdrop, sourceGroupPanel, sourceGroupPanelFrame, sourceGroupTrigger } from './source-group-outside.mjs';
import { effectiveAppearance } from './structure.mjs';

export const sourceGroupOptionsScrollCase = 'source-management.group-options-scroll';
export const sourceGroupOptionsScrollFixture = 'public-source-group-options-scroll-v1';
export const sourceGroupOptionsScrollFixturePath = 'fixtures/source-group-options-scroll/public-sources.json';
export const sourceGroupOptionsSwipePath = {from:[0.5,0.94],to:[0.5,0.06],speed:900};

const rectKeys = ['left','top','width','height'];
const positive = value => Number.isSafeInteger(value) && value > 0;
const measured = rect => rectKeys.every(key=>Number.isSafeInteger(rect?.[key])) && rect.width > 0 && rect.height > 0;
const sameRect = (first,second) => measured(first) && measured(second) && rectKeys.every(key=>first[key] === second[key]);
const right = rect => rect.left + rect.width;
const bottom = rect => rect.top + rect.height;
const contains = (outer,inner) => measured(outer) && measured(inner) &&
  outer.left <= inner.left && outer.top <= inner.top && right(outer) >= right(inner) && bottom(outer) >= bottom(inner);
const intersects = (first,second) => measured(first) && measured(second) &&
  Math.max(first.left,second.left) < Math.min(right(first),right(second)) &&
  Math.max(first.top,second.top) < Math.min(bottom(first),bottom(second));
const complete = sample => sample?.captureComplete === true && sample.window?.source === 'window-metrics' &&
  sample.window.keyboard?.visible === false && Number.isFinite(sample.window.density) && sample.window.density > 0 &&
  sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) && sample.evidenceRefs.some(ref=>ref.path.endsWith('.json'));

export function sourceGroupScrollFrame(sample) {
  if (!complete(sample)) return null;
  const frame = sourceGroupPanelFrame(sample,sourceGroupOptionsReference);
  const {painted,scroll} = frame ?? {};
  if (scroll?.alias !== sourceGroupOptionsScroll || effectiveAppearance(sample,painted).visible !== true ||
      effectiveAppearance(sample,scroll).visible !== true || !sameRect(painted.rectPx,painted.visibleRectPx) ||
      !sameRect(scroll.rectPx,scroll.visibleRectPx) || !contains(painted.visibleRectPx,scroll.visibleRectPx) ||
      !contains(sample.window.visibleRectPx,scroll.visibleRectPx)) return null;
  let reference;
  try { reference = selectLayoutNode(sample,sourceGroupOptionsReference); }
  catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return null;
  }
  if (effectiveAppearance(sample,reference).visible !== true || !positive(reference.groupSelectionGeneration) ||
      !measured(reference.rectPx) || !intersects(scroll.visibleRectPx,reference.visibleRectPx)) return null;
  const selectionId = `source-group:${reference.groupSelectionGeneration}`;
  const backdrops = sample.nodes.filter(node=>node.alias === sourceGroupBackdrop &&
    node.id === `reader-source-group-backdrop:${selectionId}` && node.parentPath === frame.scope.parentPath);
  if (backdrops.length !== 1 || effectiveAppearance(sample,backdrops[0]).visible !== true) return null;
  const targets = sample.nodes.filter(node=>node.alias === sourceGroupOptionsTail);
  if (targets.length > 1 || targets.some(node=>node.groupSelectionGeneration !== reference.groupSelectionGeneration ||
      !ancestorsOf(sample,node).includes(scroll))) return null;
  return {painted,scroll,reference,selectionId,tail:targets[0]};
}

function tailVisibility(sample,frame) {
  if (!frame.tail) return false;
  const appearance = effectiveAppearance(sample,frame.tail);
  return appearance.visible === null ? null : appearance.visible &&
    intersects(frame.scroll.visibleRectPx,frame.tail.visibleRectPx);
}

export function requestSourceGroupOptionsSwipe(sample) {
  const frame = sourceGroupScrollFrame(sample);
  requireEvidence(frame && tailVisibility(sample,frame) === false,
    'The current native group Scroll does not have a hidden public tail and a measured reference');
  const rect = frame.scroll.visibleRectPx;
  const {from,to,speed:velocity} = sourceGroupOptionsSwipePath;
  const at = ([x,y]) => [Math.floor(rect.left + rect.width*x),Math.floor(rect.top + rect.height*y)];
  const [fromX,fromY] = at(from);
  const [toX,toY] = at(to);
  requireEvidence(fromY > toY && [fromX,fromY,toX,toY].every(value=>Number.isSafeInteger(value) && value >= 0 && value <= 16384),
    'The measured upward group-scroll gesture is outside the native target range');
  return {op:'swipe',fromX,fromY,toX,toY,velocity};
}

export function requestSourceGroupOptionsTailTap(sample) {
  const frame = sourceGroupScrollFrame(sample);
  const tail = frame?.tail;
  requireEvidence(tail?.type === 'Button' && tailVisibility(sample,frame) === true &&
    sameRect(tail.rectPx,tail.visibleRectPx) && contains(frame.scroll.visibleRectPx,tail.visibleRectPx) &&
    tail.rectPx.height+1 >= 44*sample.window.density && tail.rectPx.width+1 >= 44*sample.window.density,
  'The current public group tail is not a fully usable native option inside its Scroll');
  return {op:'click',...layoutTapPoint(tail,{requireClickable:true})};
}

export function requireSourceGroupOptionsCurrent(sample,events) {
  const frame = sourceGroupScrollFrame(sample);
  const latest = events.findLast(event=>event.channel === 'business' && event.instanceId === sample?.instanceId &&
    event.kind === 'source.overlay' && event.payload.overlay === 'group');
  requireEvidence(frame && latest?.payload.phase === 'open' && latest.payload.selectionId === frame.selectionId,
    'The measured Scroll no longer owns the current source group panel');
}

const matchesDispatch = (dispatch,operation) => positive(dispatch?.probeSeq) &&
  Object.entries(operation).every(([name,value])=>name === 'op' || dispatch[name] === value);
const order = (sample,next) => Number.isSafeInteger(sample?.afterSeq) &&
  Number.isSafeInteger(next?.beforeSeq) && sample.afterSeq <= next.beforeSeq;
const sameOwner = (left,right) => positive(left?.mounting) && positive(left?.generation) &&
  left.mounting === right?.mounting && left.generation === right?.generation;

export function evaluateSourceGroupOptionsScroll(assertion, context) {
  const {actions = {},samples = {},events = []} = context;
  const source = samples['source-ready'];
  const before = samples[assertion.baseline], after = samples['panel-tail'], selected = samples[assertion.sample];
  const entry = actions[assertion.entryAction], open = actions[assertion.openAction];
  const scroll = actions[assertion.scrollAction], tap = actions[assertion.action];
  const instance = source?.instanceId;
  const trace = events.filter(event=>event.channel === 'business' && event.instanceId === instance);
  const at = (kind,first,last) => trace.filter(event=>event.kind === kind && event.eventSeq > first && event.eventSeq <= last);
  const used = [source,before,after,selected,entry,open,scroll,tap];
  const report = (verdict,reason,actual=null) => ({verdict,reason,actual,expected:assertion.expected,
    evidenceRefs:used.flatMap(item=>item?.evidenceRefs ?? [])});
  const missing = reason => report('NOT_RUN',reason);
  const action = (record,op,from,target) => record?.instanceId === instance && record.op === op &&
    record.from === from && record.targetId === target && positive(record.beforeSeq) && record.afterSeq > record.beforeSeq;
  const sameWindow = sample => complete(sample) && sample.instanceId === instance &&
    sample.window.id === source.window.id && sample.window.density === source.window.density;

  if (!complete(source) || !action(entry,'click','settings','reader-settings-source-management') || !order(entry,source) ||
      !action(open,'click','source-ready',sourceGroupTrigger) || !order(source,open) || !sameWindow(before) || !order(open,before)) {
    return missing('No complete normal Source Management and current group-menu opening');
  }
  const routes = at('source.route',entry.beforeSeq,source.beforeSeq);
  const [entered] = routes;
  const initial = at('source.projection',entry.beforeSeq,source.beforeSeq).at(-1);
  const opens = at('source.overlay',open.beforeSeq,before.beforeSeq).filter(event=>
    event.payload.phase === 'open' && event.payload.overlay === 'group');
  const [opened] = opens;
  used.push(entered,initial,opened);
  const catalogue = initial?.payload;
  const count = assertion.expected.sourceCount;
  if (routes.length !== 1 || entered.payload.action !== 'open' || entered.payload.from !== 'settings' ||
      entered.payload.to !== 'source' || !sameOwner(catalogue?.owner,entered.payload) ||
      catalogue.state !== 'rows' || catalogue.readFact !== 'current' || !positive(catalogue.readGeneration) ||
      catalogue.allGroups !== true || catalogue.groupIndex !== 0 || catalogue.queryLength !== 0 ||
      catalogue.count !== count || catalogue.projected !== count || opens.length !== 1 ||
      !sameOwner(opened.payload.owner,catalogue.owner)) return missing('The current group panel does not own the intended unfiltered public catalogue');

  const head = sourceGroupScrollFrame(before);
  if (!head || head.selectionId !== opened.payload.selectionId) return missing('No measured native Scroll of the same group panel');
  if (tailVisibility(before,head) === true) return report('FAIL','The purported offscreen tail was already visible before the group Scroll');
  if (!action(scroll,'swipe',assertion.baseline,sourceGroupOptionsScroll) || !order(before,scroll)) {
    return missing('No bound native upward swipe from the measured group Scroll');
  }
  try {
    if (!matchesDispatch(scroll.groupOptionsSwipe,requestSourceGroupOptionsSwipe(before))) {
      return missing('No exact verified native Scroll swipe coordinates');
    }
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return missing(error.message);
  }
  if (!sameWindow(after) || !order(scroll,after)) return missing('No complete same-window group tail sample after the swipe');
  const end = sourceGroupScrollFrame(after);
  if (!end) return missing('No current native Scroll and corresponding reference after the swipe');
  const distancePx = (head.reference.rectPx.top-head.scroll.rectPx.top) -
    (end.reference.rectPx.top-end.scroll.rectPx.top);
  const movement = {selectionId:head.selectionId,scrollDistancePx:distancePx,
    scrollDistanceVp:distancePx/source.window.density,groupIndex:assertion.expected.groupIndex,
    gestureId:'group-options-scroll',sampleId:assertion.sample,gestureSampleId:'panel-tail',
    baselineSampleId:assertion.baseline,actionId:assertion.scrollAction,dispatch:scroll.groupOptionsSwipe,distancePx};
  if (end.selectionId !== head.selectionId || !sameRect(head.scroll.visibleRectPx,end.scroll.visibleRectPx) ||
      !sameRect(head.painted.visibleRectPx,end.painted.visibleRectPx) ||
      head.reference.rectPx.width !== end.reference.rectPx.width || head.reference.rectPx.height !== end.reference.rectPx.height) {
    return report('FAIL','The panel moved or changed ownership instead of scrolling within its original viewport',movement);
  }
  const between = at('source.overlay',opened.eventSeq,after.beforeSeq).filter(event=>event.payload.overlay === 'group');
  used.push(...between);
  if (between.length || distancePx <= 1)
    return report('FAIL','The exact Scroll swipe did not advance the original open group options',movement);
  if (tailVisibility(after,end) === false) return report('FAIL','The public tail did not become visible in the current Scroll',movement);
  let operation;
  try { operation = requestSourceGroupOptionsTailTap(after); }
  catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return tailVisibility(after,end) === true ? report('FAIL',error.message,movement) : missing(error.message);
  }
  if (!action(tap,'click','panel-tail',sourceGroupOptionsTail) || !order(after,tap) ||
      !matchesDispatch(tap.groupOptionsTap,operation) || !sameWindow(selected) || !order(tap,selected)) {
    return missing('No complete exact public tail dispatch and selected endpoint');
  }
  const choices = at('source.projection',tap.beforeSeq,selected.beforeSeq).filter(event=>event.payload.trigger === 'group');
  const dismissals = at('source.overlay',tap.beforeSeq,selected.beforeSeq).filter(event=>event.payload.overlay === 'group');
  const reopens = at('source.route',entered.eventSeq,selected.beforeSeq);
  const current = at('source.projection',tap.beforeSeq,selected.beforeSeq).at(-1);
  const [choice] = choices, [closed] = dismissals;
  used.push(...choices,...dismissals,...reopens,current);
  if (!choice || !closed || !current) return missing('No verified current owner selection and group-panel dismissal');
  const facts = current.payload;
  const agrees = field => choices[0].payload[field] === facts[field];
  const finalGroup = facts.state === 'rows' && facts.readFact === 'current' && facts.readGeneration === catalogue.readGeneration &&
    facts.count === count && facts.projected === 1 && facts.queryLength === 0 && facts.allGroups === false &&
    facts.groupIndex === assertion.expected.groupIndex && ['groupIndex','projected','firstAnchor','filterRevision'].every(agrees) &&
    sameOwner(facts.owner,catalogue.owner) && sameOwner(choice.payload.owner,catalogue.owner) &&
    positive(facts.firstAnchor) && facts.filterRevision === catalogue.filterRevision+1;
  const panelStillUp = selected.nodes.some(node=>[sourceGroupPanel,sourceGroupBackdrop].includes(node.alias ?? node.id) &&
    effectiveAppearance(selected,node).visible === true);
  const sourceRestored = ['reader-source-list','reader-source-back',sourceGroupTrigger].every(id=>
    selected.nodes.filter(node=>(node.id === id || node.alias === id) &&
      effectiveAppearance(selected,node).visible === true).length === 1);
  const valid = choices.length === 1 && dismissals.length === 1 && reopens.length === 0 &&
    closed.payload.phase === 'dismiss' && closed.payload.selectionId === head.selectionId &&
    sameOwner(closed.payload.owner,catalogue.owner) && choice.eventSeq < closed.eventSeq &&
    finalGroup && sourceRestored && !panelStillUp;
  return report(valid ? 'PASS' : 'FAIL',valid ? '' :
    'The exact tail choice did not dismiss once into the expected retained Source opening and projection',
    {...movement,projected:facts.projected});
}

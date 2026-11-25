import { requireEvidence } from './evidence.mjs';
import { ancestorsOf, layoutTapPoint } from './layout.mjs';
import { measureSourceNativeControl } from './source-native-control.mjs';
import { sourceReadObservation } from './source-read.mjs';
import { effectiveAppearance } from './structure.mjs';
import { sourceV9ImportScope, sourceV9LocalImportButton } from './source-document-picker.mjs';

export const sourceV9ChromeCase = 'source-management.v9-chrome-touch-delivery';
export const sourceV9ChromeFixture = 'public-source-v9-chrome-touch-v1';
export const sourceV9ChromeGeometry = 'v9-source-chrome-geometry';
export const sourceV9ChromeDispatch = 'v9-source-chrome-dispatch';
export const sourceV9ChromeSettings = 'reader-settings-source-management';

const list = 'reader-source-list';
const more = 'reader-source-v9-more-menu';
const batch = 'reader-source-v9-batch-dock';
const v9Overlays = [more,batch,sourceV9ImportScope,'reader-source-group-panel','reader-source-pending-recovery'];
const controls = [
  {name:'header-more',target:'reader-source-header-tools-button',nativeId:/^source-back:[1-9]\d*:tools:header$/u,
    view:more,member:'backBar'},
  {name:'footer-batch',target:'reader-source-footer-tools-button',nativeId:/^source-back:[1-9]\d*:tools:footer$/u,
    view:batch,member:'bottomActionBar'},
  {name:'footer-import',target:'reader-source-footer-add-button',nativeId:/^source-back:[1-9]\d*:import:footer$/u,
    view:sourceV9ImportScope,member:'bottomActionBar'},
  {name:'header-back',target:'reader-source-back',nativeId:/^reader-source-back$/u,member:'backBar'},
];

export function sourceV9ChromeEntry(position) {
  return {parent:position === 'center' ? 'settings' : 'settings-returned-center',
    action:`open-v9-sources-${position}`,sample:`source-ready-${position}`};
}

export const sourceV9ChromeActions = ['center','top'].flatMap(position=>controls.map((control,index)=>{
  const scope = `${control.name}-${position}`;
  const previous = controls[index-1]?.name;
  const baseline = previous ? `returned-${previous}-${position}` : sourceV9ChromeEntry(position).sample;
  return {...control,position,baseline,action:`tap-v9-${scope}`,
    beforeAction:previous ? `back-v9-${previous}-${position}` : sourceV9ChromeEntry(position).action,
    opened:control.view ? `opened-${scope}` : `settings-returned-${position}`,
    sample:control.view ? `returned-${scope}` : `settings-returned-${position}`,
    back:control.view ? `back-v9-${scope}` : undefined};
}));

export const sourceV9ChromeStep = step=>sourceV9ChromeActions.find(policy=>policy.action === step?.id);

export function validSourceV9ChromeTap(step,fixture) {
  const policy = sourceV9ChromeStep(step);
  return policy && fixture?.id === sourceV9ChromeFixture && fixture.publicSources === true &&
    step.kind === 'action' && step.op === 'click' && step.target === policy.target && step.from === policy.baseline &&
    !step.gesture && !step.requireFullContainment && step.tapEdge === (policy.position === 'top' ? 'top' : undefined) ? policy : undefined;
}

export function sourceV9ChromeAssertionPolicy(assertion) {
  const geometry = assertion.kind === sourceV9ChromeGeometry;
  if (!geometry && assertion.kind !== sourceV9ChromeDispatch) return undefined;
  const policy = sourceV9ChromeActions.find(item=>item.target === assertion.expected.target &&
    item.position === (geometry ? 'center' : assertion.expected.position));
  if (!policy || assertion.id !== `source.v9-chrome.${policy.name}.${geometry ? 'geometry' : policy.position}` ||
      assertion.action !== (geometry ? policy.beforeAction : policy.action) ||
      assertion.sample !== (geometry ? policy.baseline : policy.sample) ||
      assertion.baseline !== (geometry ? undefined : policy.baseline) ||
      assertion.required !== true || assertion.condition ||
      !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source))) return undefined;
  return policy;
}

export function validateSourceV9ChromeCase(contract) {
  if (contract.id !== sourceV9ChromeCase || contract.version !== 1 || contract.phase !== 1 ||
      contract.pageId !== 'source-management' || contract.fixture?.id !== sourceV9ChromeFixture ||
      contract.fixture.publicSources !== true || contract.assertions.length !== 12) return false;
  const steps = new Map(contract.steps.map(step=>[step.id,step]));
  const ordered = (entry,next)=>contract.steps.indexOf(entry)+1 === contract.steps.indexOf(next);
  const exactSample = (id,after,anchors)=> {
    const item = steps.get(id);
    return item?.kind === 'sample' && item.afterAction === after && item.keyboard === false &&
      anchors.every(anchor=>item.anchors.includes(anchor));
  };
  for (const position of ['center','top']) {
    const entry = sourceV9ChromeEntry(position);
    const opening = steps.get(entry.action);
    if (opening?.op !== 'click' || opening.from !== entry.parent || opening.target !== sourceV9ChromeSettings ||
        !exactSample(entry.sample,entry.action,[list,'reader-source-back']) ||
        !ordered(opening,steps.get(entry.sample))) return false;
  }
  for (const policy of sourceV9ChromeActions) {
    const tap = steps.get(policy.action);
    const opened = steps.get(policy.opened);
    const baseline = steps.get(policy.baseline);
    const child = policy.view ?? sourceV9ChromeSettings;
    if (!validSourceV9ChromeTap(tap,contract.fixture) || !baseline?.anchors.includes(policy.target) ||
        !ordered(baseline,tap) || !ordered(tap,opened) || !exactSample(policy.opened,policy.action,[child])) return false;
    if (policy.back) {
      const back = steps.get(policy.back);
      if (back?.op !== 'keyEvent' || back.key !== 'Back' || back.from !== policy.opened ||
          !ordered(opened,back) || !ordered(back,steps.get(policy.sample)) ||
          !exactSample(policy.sample,policy.back,[list,'reader-source-back'])) return false;
    }
    if (contract.assertions.filter(assertion=>assertion.kind === sourceV9ChromeDispatch &&
      sourceV9ChromeAssertionPolicy(assertion) === policy).length !== 1) return false;
    if (policy.position === 'center' && contract.assertions.filter(assertion=>assertion.kind === sourceV9ChromeGeometry &&
      sourceV9ChromeAssertionPolicy(assertion) === policy).length !== 1) return false;
  }
  const prefix = ['open-settings',sourceV9ChromeEntry('center').action,sourceV9ChromeEntry('top').action];
  const allowed = new Set([...prefix,...sourceV9ChromeActions.flatMap(policy=>[policy.action,policy.back]).filter(Boolean)]);
  const interactions = contract.steps.filter(step=>step.kind === 'action');
  return interactions.length === allowed.size && interactions.every(step=>allowed.has(step.id));
}

const positive = value=>Number.isSafeInteger(value) && value > 0;
const sameOwner = (a,b)=>positive(a?.generation) && a.generation === b?.generation &&
  Number.isSafeInteger(a.mounting) && a.mounting >= 0 && a.mounting === b?.mounting;
const complete = sample=>sample?.captureComplete === true && sample.window?.source === 'window-metrics' &&
  sample.window.keyboard?.visible === false && sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) &&
  sample.evidenceRefs.some(ref=>ref.path.endsWith('.json'));
const sameWindow = (a,b)=>complete(a) && complete(b) && a.instanceId === b.instanceId &&
  a.window.id === b.window.id && a.window.density === b.window.density;
function visibleNodes(sample,id) {
  return (sample.nodes ?? []).filter(node=>node.id === id && node.source === 'native-tree' &&
    effectiveAppearance(sample,node).visible === true);
}
const unobstructed = sample=>v9Overlays.every(id=>visibleNodes(sample,id).length === 0) &&
  !(sample.nodes ?? []).some(node=>/^reader-json-import:[1-9]\d*$/u.test(node.id ?? '') &&
    node.source === 'native-tree' && effectiveAppearance(sample,node).visible === true);
const canonicalProjection = state=>state?.state === 'rows' && state.readFact === 'current' &&
  positive(state.count) && state.projected === state.count && positive(state.firstAnchor) &&
  positive(state.filterRevision) && positive(state.readGeneration) &&
  state.status === 'all' && state.category === 'all' && state.groupIndex === 0 && state.queryLength === 0 && state.allGroups === true;
const sameProjection = (left,right)=>sameOwner(left.owner,right?.owner) && canonicalProjection(right) &&
  ['count','projected','firstAnchor','filterRevision','readGeneration'].every(key=>left[key] === right[key]);
const paired = (action,before,after,op,target)=>sameWindow(before,after) && action?.op === op &&
  action.instanceId === before.instanceId && action.from === before.sampleId && action.outcomeSettled !== false &&
  (op === 'click' ? action.targetId === target : action.key === 'Back') &&
  [before.afterSeq,action.beforeSeq,action.afterSeq,after.beforeSeq].every(Number.isSafeInteger) &&
  before.afterSeq <= action.beforeSeq && action.beforeSeq < action.afterSeq && action.afterSeq <= after.beforeSeq;

function measure(sample,policy) {
  const geometry = measureSourceNativeControl(sample,policy.target);
  if (geometry.verdict !== 'PASS') return geometry;
  const button = sample.nodes.find(node=>node.path === geometry.actual.carrierPath);
  if (!policy.nativeId.test(button?.id ?? ''))
    return {verdict:'NOT_RUN',reason:'No exact native v9 Chrome Button carrier'};
  if (ancestorsOf(sample,button).some(node=>node.enabled === false))
    return {...geometry,verdict:'FAIL',reason:'The v9 Chrome Button has a disabled native ancestor'};
  const point = layoutTapPoint(button);
  if (policy.position === 'top') point.y = geometry.actual.bounds.top + 1;
  return {...geometry,actual:{...geometry.actual,carrierId:button.id,point}};
}

export function sourceV9ChromeTapPoint(sample,policy) {
  requireEvidence(complete(sample) && unobstructed(sample),'No current unobstructed native v9 Source list');
  const geometry = measure(sample,policy);
  requireEvidence(geometry.verdict === 'PASS',geometry.reason);
  return geometry.actual.point;
}

function childOpened(sample,policy) {
  const nodes = visibleNodes(sample,policy.view);
  if (nodes.length !== 1) return false;
  const [host] = nodes;
  const ownedButton = id=>visibleNodes(sample,id).filter(node=>node.type === 'Button' && ancestorsOf(sample,node).includes(host));
  if (policy.view === more) {
    return visibleNodes(sample,list).length === 1 && ['subscriptions','groups','detect','export'].every(action=>{
      const items = ownedButton(`reader-source-v9-open-${action}`);
      return items.length === 1 && items[0].enabled === true && items[0].clickable === true;
    });
  }
  if (policy.view === batch) {
    return visibleNodes(sample,list).length === 1 && ['enable','disable','move','detect','delete'].every(action=>{
      const items = ownedButton(`reader-source-batch-${action}`);
      return items.length === 1 && items[0].enabled === false;
    });
  }
  const file = ownedButton(sourceV9LocalImportButton);
  return host.type === 'Stack' && file.length === 1 && file[0].enabled === true && file[0].clickable === true &&
    ['reader-source-v9-import-review','reader-source-v9-import-result'].every(id=>visibleNodes(sample,id).length === 0);
}

export function evaluateSourceV9Chrome(assertion,context) {
  const policy = sourceV9ChromeAssertionPolicy(assertion);
  if (!policy) throw new Error('Invalid v9 Source Chrome assertion');
  const geometry = assertion.kind === sourceV9ChromeGeometry;
  const start = context.samples[policy.baseline];
  const used = [start];
  const result = (verdict,reason = '',actual = null)=>({verdict,reason,actual,expected:assertion.expected,
    evidenceRefs:used.flatMap(item=>item?.evidenceRefs ?? [])});
  const entry = sourceV9ChromeEntry(policy.position);
  const initial = sourceReadObservation({...entry,expected:{state:'rows'}},context);
  const parent = context.samples[entry.parent];
  const opening = context.actions[entry.action];
  if (!initial?.triggered || !paired(opening,parent,initial.sample,'click',sourceV9ChromeSettings) ||
      !sameWindow(initial.sample,start) || !unobstructed(start) || visibleNodes(start,list).length !== 1)
    return result('NOT_RUN','No same-window Settings entry and unobstructed v9 Source catalog');
  used.push(parent,opening,initial.entry,initial.current);
  const events = context.events.filter(event=>event.instanceId === start.instanceId && event.channel === 'business');
  const through = (after,end)=>events.filter(event=>event.eventSeq > after && event.eventSeq <= end);
  const sinceOpening = through(initial.entry.eventSeq,start.beforeSeq);
  const state = sinceOpening.findLast(event=>event.kind === 'source.projection')?.payload;
  if (!canonicalProjection(initial.current.payload) || !sameProjection(initial.current.payload,state) ||
      sinceOpening.some(event=>event.kind === 'source.route')) return result('NOT_RUN','No current same-owner native Source projection');
  if (policy.position === 'top') {
    const previous = sourceV9ChromeActions.find(item=>item.name === 'header-back' && item.position === 'center');
    const leave = context.actions[previous.action];
    const [closed,...others] = through(leave?.beforeSeq,parent.beforeSeq).filter(event=>event.kind === 'source.route');
    if (!paired(leave,context.samples[previous.baseline],parent,'click',previous.target) ||
        others.length || closed?.payload.action !== 'close' || closed.payload.from !== 'source' || closed.payload.to !== 'settings' ||
        closed.payload.generation !== initial.entry.payload.previousGeneration ||
        closed.payload.mounting !== initial.entry.payload.mounting) return result('NOT_RUN','No distinct Source reopening for the upper-edge clicks');
    used.push(closed);
  }
  const measured = measure(start,policy);
  if (measured.verdict !== 'PASS') return result(measured.verdict,measured.reason,measured.actual);
  const native = {target:policy.target,subject:policy.name,carrierPath:measured.actual.carrierPath,
    bounds:measured.actual.bounds,visible:true,clipped:false,enabled:true};
  if (geometry) return result('PASS','',{sampleId:assertion.sample,...measured.actual,nativeInteraction:native});
  const click = context.actions[policy.action];
  const opened = context.samples[policy.opened];
  const dispatch = click?.v9ChromeTap;
  used.push(click,opened);
  if (!paired(click,start,opened,'click',policy.target) || !positive(dispatch?.probeSeq) ||
      dispatch.x !== measured.actual.point.x || dispatch.y !== measured.actual.point.y) {
    return result('NOT_RUN','The sealed command does not prove the measured native v9 Chrome click');
  }

  const outcome = (valid,reason,detail)=>result(valid ? 'PASS' : 'FAIL',valid ? '' : reason,
    {sampleId:assertion.sample,dispatch,...detail,...(valid ? {nativeInteraction:{...native,
      position:policy.position,accepted:true,actionId:policy.action,baselineSampleId:policy.baseline,dispatch}} : {})});
  const openEvents = through(click.beforeSeq,opened.beforeSeq);
  const routes = openEvents.filter(event=>event.kind === 'source.route');
  used.push(...openEvents);
  if (!policy.view) {
    const [closed] = routes;
    if (!closed) return result('NOT_RUN','No app-owner route result for native header Back');
    const route = closed.payload;
    const valid = routes.length === 1 && route.action === 'close' && route.from === 'source' && route.to === 'settings' &&
      sameOwner(state.owner,{mounting:route.mounting,generation:route.previousGeneration}) &&
      positive(route.generation) && route.generation > route.previousGeneration &&
      visibleNodes(opened,sourceV9ChromeSettings).length === 1 && visibleNodes(opened,list).length === 0 &&
      unobstructed(opened);
    return outcome(valid,'The v9 header Back did not release exactly this Source opening to Settings',{closed:route});
  }
  if (routes.length || !childOpened(opened,policy))
    return outcome(false,'The measured click did not open the one expected v9 control surface',{view:policy.name});
  const back = context.actions[policy.back];
  const end = context.samples[policy.sample];
  used.push(back,end);
  if (!paired(back,opened,end,'keyEvent'))
    return result('NOT_RUN','No verified first system Back from the native v9 surface');
  const activity = through(click.beforeSeq,end.beforeSeq);
  used.push(...activity);
  const mutations = activity.filter(event=>['source.route','source.import-status-action','source.import-search-return',
    'source.row-detect','source.control-action'].includes(event.kind) ||
    event.kind === 'source.toggle' && event.payload.phase === 'admitted' ||
    event.kind === 'source.projection' && !sameProjection(state,event.payload));
  if (mutations.length || !unobstructed(end) || visibleNodes(end,list).length !== 1)
    return outcome(false,'Closing v9 Chrome changed the Source opening, catalogue or native layer',{view:policy.name});
  const restored = measure(end,policy);
  if (restored.verdict !== 'PASS' || restored.actual.carrierId !== measured.actual.carrierId)
    return outcome(false,'First Back did not restore the original usable native Chrome control',{view:policy.name});
  const transitions = activity.filter(event=>event.kind === 'source.v9-list-transition');
  if (policy.view === batch) {
    const [entered,left] = transitions;
    if (!entered || !left) return result('NOT_RUN','No same-opening owner batch enter and return');
    const a = entered.payload;
    const b = left.payload;
    const valid = transitions.length === 2 && a.view === 'batch' && b.view === 'batch' &&
      a.phase === 'enter' && b.phase === 'return' && sameOwner(state.owner,a.owner) && sameOwner(a.owner,b.owner) &&
      positive(a.revision) && a.revision === b.revision && b.filterMatchesDeparture === true &&
      entered.eventSeq <= opened.beforeSeq && left.eventSeq > back.beforeSeq;
    return outcome(valid,'Batch controls did not enter and return on the same owner revision',{view:policy.name});
  }
  return outcome(!transitions.length,'A different v9 transition was admitted by the Chrome click',{view:policy.name});
}

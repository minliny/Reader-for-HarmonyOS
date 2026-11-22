import { EvidenceError, requireEvidence } from './evidence.mjs';
import { ancestorsOf, layoutTapPoint } from './layout.mjs';
import { effectiveAppearance } from './structure.mjs';
import { readSourceInlineImportDialog } from './source-inline-import-edge.mjs';
import { measureSourceNativeControl } from './source-native-control.mjs';
import { sourceReadObservation } from './source-read.mjs';

export const sourceChromeCase = 'source-management.chrome-touch-delivery';
export const sourceChromeFixture = 'public-source-chrome-touch-v1';
export const sourceChromeGeometry = 'source-chrome-geometry';
export const sourceChromeDispatch = 'source-chrome-dispatch';
export const sourceChromeActions = [
  {name:'header-tools',target:'reader-source-header-tools-button',nativeId:/^source-back:[1-9]\d*:tools:header$/u,action:'tap-header-tools',baseline:'source-ready',
    beforeAction:'open-sources',opened:'header-tools-open',returnAction:'back-header-tools',sample:'header-tools-returned',kind:'tools'},
  {name:'footer-manage',target:'reader-source-footer-tools-button',nativeId:/^source-back:[1-9]\d*:tools:footer$/u,action:'tap-footer-manage',baseline:'header-tools-returned',
    beforeAction:'back-header-tools',opened:'footer-tools-open',returnAction:'back-footer-tools',sample:'footer-tools-returned',kind:'tools'},
  {name:'footer-add',target:'reader-source-footer-add-button',nativeId:/^source-back:[1-9]\d*:import:footer$/u,action:'tap-footer-add',baseline:'footer-tools-returned',
    beforeAction:'back-footer-tools',opened:'footer-add-dialog',returnAction:'back-footer-add',sample:'footer-add-returned',kind:'dialog'},
  {name:'header-back',target:'reader-source-back',nativeId:/^reader-source-back$/u,action:'tap-header-back',baseline:'footer-add-returned',
    beforeAction:'back-footer-add',sample:'settings-returned',kind:'back'},
];
const sourceChromeCenterEntry = {parent:'settings',action:'open-sources',sample:'source-ready'};
export const sourceChromeTopEntry = {parent:'settings-returned',action:'open-sources-top',sample:'source-ready-top'};
export const sourceChromeTopActions = sourceChromeActions.map(policy=>({
  ...policy,
  action:`${policy.action}-top`,baseline:`${policy.baseline}-top`,sample:`${policy.sample}-top`,
  ...(policy.opened ? {opened:`${policy.opened}-top`,returnAction:`${policy.returnAction}-top`} : {}),
  position:'top',
}));
const sourceBack = 'reader-source-back';
const settings = 'reader-settings-source-management';
const toolsBack = 'reader-source-tools-back';
const groupPanel = 'reader-source-group-panel';
const pending = 'reader-source-pending-recovery';
const positive = value=>Number.isSafeInteger(value) && value > 0;
const nonnegative = value=>Number.isSafeInteger(value) && value >= 0;
const sameOwner = (a,b)=>positive(a?.generation) && nonnegative(a?.mounting) &&
  a.generation === b?.generation && a.mounting === b?.mounting;

export function sourceChromePolicy(target,position = 'center') {
  const policies = position === 'center' ? sourceChromeActions : position === 'top' ? sourceChromeTopActions : [];
  return policies.find(policy=>policy.target === target);
}

export const sourceChromeStep = step=>[...sourceChromeActions,...sourceChromeTopActions].find(policy=>policy.action === step?.id);

function visible(sample,id,type) {
  const nodes = sample.nodes.filter(node=>node.source === 'native-tree' &&
    (node.id === id || node.alias === id) && (!type || node.type === type));
  return nodes.length === 1 && effectiveAppearance(sample,nodes[0]).visible === true;
}

function unobstructed(sample) {
  const dialog = readSourceInlineImportDialog(sample);
  return dialog.verdict === 'PASS' && dialog.actual.state === 'absent' &&
    !sample.nodes.some(node=>[groupPanel,pending].some(id=>node.id === id || node.alias === id) &&
      effectiveAppearance(sample,node).visible !== false);
}

function chromeMeasure(sample,policy,options) {
  const measured = measureSourceNativeControl(sample,policy.target,options);
  if (!measured.actual) return measured;
  const button = sample.nodes.find(node=>node.path === measured.actual.carrierPath);
  if (!policy.nativeId.test(button?.id ?? ''))
    return {verdict:'NOT_RUN',reason:'The Source chrome alias lacks its exact native Button identity'};
  if (ancestorsOf(sample,button).some(node=>node.enabled === false))
    return {...measured,button,verdict:'FAIL',reason:'The Source chrome Button has a disabled native ancestor'};
  return {...measured,button};
}

export function sourceChromeTapPoint(sample,target,position) {
  const policy = sourceChromePolicy(target,position);
  requireEvidence(policy && unobstructed(sample),'No unobstructed native Source window for the selected chrome tap');
  // Geometry has its own 44vp assertion. The sampled native carrier also
  // supplies the independent coordinates for the actual touch.
  const measured = chromeMeasure(sample,policy,{verifyMinimum:false});
  requireEvidence(measured.verdict === 'PASS',measured.reason);
  const {button} = measured;
  const {bounds} = measured.actual;
  const point = layoutTapPoint(button);
  if (policy.position === 'top') {
    requireEvidence(bounds.height > 1,'No inner pixel at the top of the actual Source chrome Button');
    point.y = bounds.top + 1;
  }
  return {point,carrierId:button.id,carrierPath:button.path,bounds};
}

function complete(sample) {
  return sample?.captureComplete === true && sample.window?.source === 'window-metrics' &&
    sample.window.keyboard?.visible === false && Number.isFinite(sample.window.density) && sample.window.density > 0 &&
    sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) && sample.evidenceRefs.some(ref=>ref.path.endsWith('.json'));
}

function sameWindow(a,b) {
  return complete(a) && complete(b) && a.instanceId === b.instanceId && a.window.id === b.window.id &&
    a.window.density === b.window.density;
}

function paired(action,before,after,op,target) {
  return action?.op === op && action.from === before?.sampleId && action.instanceId === before?.instanceId &&
    action.outcomeSettled !== false && (op === 'keyEvent' ? action.key === 'Back' : action.targetId === target) &&
    sameWindow(before,after) && [before.afterSeq,action.beforeSeq,action.afterSeq,after.beforeSeq].every(nonnegative) &&
    before.afterSeq <= action.beforeSeq && action.beforeSeq < action.afterSeq && action.afterSeq <= after.beforeSeq;
}

const publicCatalogue = state=>state?.state === 'rows' && state.readFact === 'current' &&
  positive(state.readGeneration) && positive(state.count) && state.projected === state.count && positive(state.firstAnchor) &&
  positive(state.filterRevision) && state.status === 'all' && state.category === 'all' && state.groupIndex === 0 &&
  state.queryLength === 0 && state.allGroups === true;
const sameCatalogue = (before,after)=>publicCatalogue(after) &&
  ['count','projected','firstAnchor','status','category','groupIndex','queryLength','allGroups'].every(key=>before[key] === after[key]);
const routesBetween = (events,action,sample)=>events.filter(event=>event.kind === 'source.route' &&
  event.eventSeq > action.beforeSeq && event.eventSeq <= sample.beforeSeq);
const projectionAt = (events,sample)=>events.findLast(event=>event.kind === 'source.projection' && event.eventSeq <= sample.beforeSeq);
const routeIs = (event,owner,action,from,to)=>event?.payload.action === action && event.payload.from === from &&
  event.payload.to === to && sameOwner(owner,{mounting:event.payload.mounting,generation:event.payload.previousGeneration}) &&
  positive(event.payload.generation) && event.payload.generation > event.payload.previousGeneration;

function currentSource(context,sample,position) {
  const entry = position === 'top' ? sourceChromeTopEntry : sourceChromeCenterEntry;
  const initial = sourceReadObservation({...entry,expected:{state:'rows'}},context);
  if (!initial || !sameWindow(initial.sample,sample) || !publicCatalogue(initial.current.payload) ||
      !visible(sample,'reader-source-list','List') || !unobstructed(sample)) return null;
  const events = context.events.filter(event=>event.channel === 'business' && event.instanceId === sample.instanceId);
  const openingEvidence = [];
  if (position === 'top') {
    const parent = context.samples[entry.parent];
    const previousTap = context.actions['tap-header-back'];
    const reopen = context.actions[entry.action];
    if (!paired(previousTap,context.samples['footer-add-returned'],parent,'click',sourceBack) ||
        !visible(parent,settings) || !paired(reopen,parent,initial.sample,'click',settings)) return null;
    const [closed,...other] = routesBetween(events,previousTap,parent);
    if (other.length || closed?.payload.action !== 'close' || closed.payload.from !== 'source' ||
        closed.payload.to !== 'settings' || !routeIs(initial.entry,closed.payload,'open','settings','source')) return null;
    openingEvidence.push(parent,previousTap,closed,reopen,initial.sample);
  }
  const routes = events.filter(event=>event.kind === 'source.route' && event.eventSeq >= initial.entry.eventSeq &&
    event.eventSeq <= sample.beforeSeq);
  let current = initial.entry;
  for (const [index,route] of routes.slice(1).entries()) {
    const away = index % 2 === 0;
    if (!routeIs(route,current.payload,away ? 'tools' : 'tools-back',
          away ? 'source' : 'sourceTools',away ? 'sourceTools' : 'source')) return null;
    current = route;
  }
  const projected = projectionAt(events,sample);
  const state = projected?.payload;
  if (current.payload.to !== 'source' || !projected || projected.eventSeq <= current.eventSeq ||
      !sameOwner(current.payload,state.owner) || !sameCatalogue(initial.current.payload,state)) return null;
  return {entry,initial,events,projection:projected,route:current,state,openingEvidence};
}

export function evaluateSourceChrome(assertion,context) {
  const {target} = assertion.expected;
  const position = assertion.expected.position ?? 'center';
  const policy = sourceChromePolicy(target,position);
  const geometry = assertion.kind === sourceChromeGeometry;
  const start = context.samples[geometry ? assertion.sample : assertion.baseline];
  const used = [start];
  const interaction = ({carrierPath,bounds}) => ({subject:policy.name,target,carrierPath,bounds,
    visible:true,clipped:false,enabled:true});
  const result = (verdict,reason,actual = null) => ({verdict,reason,actual,expected:assertion.expected,
    evidenceRefs:used.flatMap(value=>value?.evidenceRefs ?? [])});
  const missing = reason=>result('NOT_RUN',reason);
  const source = currentSource(context,start,position);
  if (!source) return missing('No complete unobstructed current Source opening and public catalogue');
  used.push(...source.openingEvidence,source.initial.entry,source.route,source.projection);

  if (geometry) {
    const measured = chromeMeasure(start,policy);
    return result(measured.verdict,measured.reason,{sampleId:assertion.sample,...measured.actual,
      ...(measured.verdict === 'PASS' ? {nativeInteraction:interaction(measured.actual)} : {})});
  }
  const tap = context.actions[assertion.action];
  const finish = context.samples[assertion.sample];
  const opened = policy.opened ? context.samples[policy.opened] : finish;
  const back = policy.returnAction ? context.actions[policy.returnAction] : null;
  used.push(tap,opened,back,finish);
  if (!paired(tap,start,opened,'click',target))
    return missing('No verified native click and its complete, ordered opening endpoint');
  let carrier;
  try { carrier = sourceChromeTapPoint(start,target,position); }
  catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return missing(error.message);
  }
  const dispatch = tap.chromeTap;
  if (!positive(dispatch?.probeSeq) || carrier.point.x !== dispatch.x || carrier.point.y !== dispatch.y)
    return missing(`The actual command journal does not establish the ${position} click on the current native Button`);
  const actual = {sampleId:policy.opened ?? assertion.sample,target,dispatch,carrierId:carrier.carrierId,carrierPath:carrier.carrierPath,
    originGeneration:source.state.owner.generation};
  const observed = (okay,reason,detail) => result(okay ? 'PASS' : 'FAIL',okay ? '' : reason,{
    ...actual,...detail,
    ...(okay ? {sampleId:assertion.sample,nativeInteraction:{...interaction(carrier),position,accepted:true,
      actionId:assertion.action,baselineSampleId:assertion.baseline,dispatch}} : {}),
  });
  const {events,state} = source;
  const openingRoutes = routesBetween(events,tap,opened);
  used.push(...openingRoutes);

  if (policy.kind === 'back') {
    const parent = context.samples[source.entry.parent];
    used.push(parent);
    if (!sameWindow(parent,finish) || !visible(parent,settings)) return missing('No captured original Settings parent');
    const closed = openingRoutes[0];
    const returnedToSettings = visible(finish,settings) && !visible(finish,sourceBack) && !visible(finish,toolsBack);
    if (returnedToSettings && !openingRoutes.length) return missing('No current owner confirmation of the native Settings return');
    const okay = returnedToSettings && openingRoutes.length === 1 && routeIs(closed,state.owner,'close','source','settings');
    return observed(okay,'The verified header Back click did not release this Source opening to Settings',
      {closed:closed?.payload ?? null});
  }

  if (policy.kind === 'tools') {
    const [away] = openingRoutes;
    const nativeTools = visible(opened,toolsBack,'Button') && !visible(opened,sourceBack);
    if (nativeTools && !openingRoutes.length) return missing('No current owner confirmation of the native Tools opening');
    const entered = openingRoutes.length === 1 && routeIs(away,state.owner,'tools','source','sourceTools') &&
      nativeTools;
    if (!entered) return result('FAIL','The verified native click did not open Tools from this Source owner',
      {...actual,away:away?.payload ?? null});
    if (!paired(back,opened,finish,'keyEvent'))
      return missing('No verified ordinary Back and complete Source return sample');
    const returningRoutes = routesBetween(events,back,finish);
    const endProjection = projectionAt(events,finish);
    used.push(...returningRoutes,endProjection);
    const [home] = returningRoutes;
    const nativeSource = visible(finish,sourceBack,'Button') && visible(finish,'reader-source-list','List') &&
      !visible(finish,toolsBack) && unobstructed(finish);
    if (nativeSource && (!returningRoutes.length || returningRoutes.length === 1 &&
        routeIs(home,away.payload,'tools-back','sourceTools','source') && !(endProjection?.eventSeq > home.eventSeq))) {
      return missing('No current owner or catalogue projection for the native Tools return');
    }
    const okay = nativeSource && returningRoutes.length === 1 && routeIs(home,away.payload,'tools-back','sourceTools','source') &&
      endProjection?.eventSeq > home.eventSeq && sameOwner(home.payload,endProjection.payload.owner) &&
      endProjection.payload.readGeneration >= state.readGeneration && sameCatalogue(state,endProjection.payload);
    return observed(okay,'Tools Back did not return to the same catalogue projection',
      {sampleId:assertion.sample,away:away.payload,returned:home?.payload ?? null});
  }

  const dialog = readSourceInlineImportDialog(opened);
  if (dialog.verdict === 'NOT_RUN') return missing(dialog.reason);
  if (dialog.verdict !== 'PASS' || dialog.actual.state !== 'present' || openingRoutes.length ||
      !visible(opened,sourceBack,'Button') || !visible(opened,'reader-source-list','List')) {
    return result('FAIL','The verified footer Add click did not open the real book-source JSON dialog above Source',
      {...actual,dialog:dialog.actual ?? null});
  }
  if (!paired(back,opened,finish,'keyEvent')) return missing('No verified ordinary Back and complete dialog return sample');
  const released = readSourceInlineImportDialog(finish);
  if (released.verdict === 'NOT_RUN') return missing(released.reason);
  const mutations = events.filter(event=>event.eventSeq > start.beforeSeq && event.eventSeq <= finish.beforeSeq &&
    (['source.route','source.import-status-action','source.import-search-return'].includes(event.kind) ||
      event.kind === 'source.toggle' && event.payload.phase === 'admitted' ||
      event.kind === 'source.projection' && (!sameOwner(state.owner,event.payload.owner) ||
        !sameCatalogue(state,event.payload) || state.readGeneration !== event.payload.readGeneration ||
        state.filterRevision !== event.payload.filterRevision)));
  used.push(...mutations);
  const okay = released.verdict === 'PASS' && released.actual.state === 'absent' && !mutations.length &&
    visible(finish,sourceBack,'Button') && visible(finish,'reader-source-list','List') && unobstructed(finish);
  return observed(okay,'The verified footer Add click and Back did not open and release the real JSON dialog without a write',
    {sampleId:assertion.sample,dialog:dialog.actual,returned:released.actual ?? null});
}

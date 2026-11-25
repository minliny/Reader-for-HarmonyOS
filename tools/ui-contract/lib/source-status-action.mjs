import { measureSourceNativeControl } from './source-native-control.mjs';
import { sourceNativeCenterInteraction } from './source-native-center.mjs';
import { ancestorsOf } from './layout.mjs';
import { effectiveAppearance } from './structure.mjs';
import { requireEvidence } from './evidence.mjs';
import { sourceV9ImportEntry, sourceV9ImportScope, sourceV9ImportStages,
  sourceV9LocalImportButton } from './source-document-picker.mjs';
import { matchingSourceTransientRetirement, sourceTransientStatusEvent,
  sourceTransientStatusLifecycle } from './source-transient-status-text.mjs';

export const sourceStatusActionEdgeCase = 'source-management.import-research-status-action-edge';
const actionTarget = 'reader-source-status-action';
const statusEvent = 'source.import-status-action';
const returnEvent = 'source.import-search-return';
const pickerActions = [
  ['browse-files','picker-browse','browse'],
  ['open-phone-storage','picker-phone','phone'],
  ['open-downloads','picker-downloads','downloads'],
  ['select-source-file','picker-file','file'],
];

const fullNativeSample = sample => sample?.captureComplete === true &&
  sample.window?.source === 'window-metrics' && sample.window.keyboard?.visible === false &&
  Array.isArray(sample.nodes) && sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) &&
  sample.evidenceRefs.some(ref=>ref.path.endsWith('.json'));
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const sameOwner = (left,right) => positiveInteger(left?.mounting) && positiveInteger(left?.generation) &&
  left.mounting === right?.mounting && left.generation === right.generation;
const sameWindow = (left,right) => left.instanceId === right.instanceId && left.window.id === right.window.id;
const precedes = (record,next) => Number.isSafeInteger(record?.afterSeq) &&
  Number.isSafeInteger(next?.beforeSeq) && record.afterSeq <= next.beforeSeq;
const actionMatches = (action,instance,from,target,op='click') => action?.instanceId === instance &&
  action.from === from && action.targetId === target && action.op === op &&
  positiveInteger(action.beforeSeq) && action.afterSeq > action.beforeSeq;
const receives = (event,first,last) => event.eventSeq > first && event.eventSeq <= last;

export function sourceStatusActionEdgeStep(step) {
  return step?.id === 'press-research-top' && step.kind === 'action' && step.op === 'click' &&
    step.from === 'source-imported' && step.target === actionTarget && !step.gesture && !step.tapEdge;
}

export const sourceStatusActionEdgeWaitForRetirement = {
  kind: sourceTransientStatusLifecycle,
  fields: { 'payload.phase':'retired', 'payload.scope':'operation-status', 'payload.branch':'import', 'payload.durationMs':2200 },
  match:'latest', channel:'business',
};

export function sourceStatusActionEdgePostToastSample(contract, step) {
  return contract.id === sourceStatusActionEdgeCase && [2,3].includes(contract.version) &&
    step.id === 'source-imported' && step.kind === 'sample';
}

export function sourceStatusActionEdgeToastRetired(events) {
  const ready = events.findLast(event=>event.kind === statusEvent && event.channel === 'business');
  const data = ready?.payload;
  if (data?.phase !== 'ready' || data.confirmation !== 'confirmed' || data.readback !== 'succeeded' ||
      data.fixturePresent !== true || data.confirmedParts !== 1 || data.count !== 1) return false;
  const lifecycle = events.filter(event=>event.instanceId === ready.instanceId &&
    event.windowRevision === ready.windowRevision && event.kind === sourceTransientStatusLifecycle &&
    sourceTransientStatusEvent(event,'operation-status'));
  const retired = lifecycle.at(-1);
  return retired?.payload.branch === 'import' && retired.payload.generation === data.receiptGeneration &&
    retired.eventSeq > ready.eventSeq && sameOwner(retired.payload.owner,data.owner) &&
    matchingSourceTransientRetirement(retired,lifecycle,'operation-status');
}

const upperPoint = ({left,top,width}) => ({x:Math.floor(left+width/2),y:top+1});

export function sourceStatusActionEdgePoint(sample) {
  const geometry = measureSourceNativeControl(sample,actionTarget);
  requireEvidence(geometry.verdict === 'PASS',geometry.reason);
  return upperPoint(geometry.actual.bounds);
}

function returnedLocalResult(sample, projection, queryRevision) {
  if (!positiveInteger(projection.page)) return {verdict:'NOT_RUN'};
  const viewportId = `reader-search-result-list:${projection.page}:${queryRevision}`;
  const viewports = sample.nodes.filter(node=>node.source === 'native-tree' && node.type === 'List' &&
    /^reader-search-result-list:\d+:\d+$/u.test(node.id ?? ''));
  const rows = sample.nodes.filter(node=>node.source === 'native-tree' &&
    node.alias === 'reader-search-public-local-result' && node.localSearchResult === true);
  const visible = node => effectiveAppearance(sample,node).visible;
  if ([...viewports,...rows].some(node=>visible(node) === null)) return {verdict:'NOT_RUN',viewportId};
  const lists = viewports.filter(node=>visible(node) === true);
  const publicRows = rows.filter(node=>visible(node) === true);
  const [list] = lists;
  const [row] = publicRows;
  const matches = lists.length === 1 && list.id === viewportId && projection.viewportId === viewportId &&
    publicRows.length === 1 && ancestorsOf(sample,row).includes(list);
  return {verdict:matches ? 'PASS' : 'FAIL',viewportId,
    observedViewportIds:lists.map(node=>node.id),publicRowPath:matches ? row.path : null};
}

function transferLocator(sample, origin, target, stage) {
  if (!sample || !sameWindow(sample,origin) || sample.window.source !== 'window-metrics' ||
      sample.window.keyboard?.visible !== false || !sample.evidenceRefs?.some(ref=>ref.path.endsWith('.json'))) return false;
  const visible = node=>node.source === 'native-tree' && node.visible === true && node.opacity > 0;
  const scopes = sample.nodes.filter(node=>node.id === sourceV9ImportScope && node.type === 'Stack' && visible(node));
  if (scopes.length !== 1) return false;
  const [scope] = scopes;
  const scopedMatches = id=>sample.nodes.filter(node=>node.id === id && visible(node) && ancestorsOf(sample,node).includes(scope));
  const buttons = scopedMatches(target);
  return buttons.length === 1 && buttons[0].type === 'Button' && buttons[0].enabled === true && buttons[0].clickable === true &&
    (stage === undefined || scopedMatches(stage).length === 1);
}

function v9ImportChain(actions,samples,origin,opened,picked,imported,observations) {
  const entry = samples[sourceV9ImportEntry];
  const picker = actions['open-picker'];
  observations.push(entry);
  if (!transferLocator(entry,origin,sourceV9LocalImportButton) || !precedes(opened,entry) || !precedes(entry,picker)) return false;
  let previous = picked;
  for (const stage of sourceV9ImportStages) {
    const point = samples[stage.sample];
    const click = actions[stage.action];
    observations.push(point,click);
    if (!transferLocator(point,origin,stage.target,stage.stage) || !precedes(previous,point) ||
        !actionMatches(click,origin.instanceId,stage.sample,stage.target) || !precedes(point,click)) return false;
    previous = click;
  }
  return precedes(previous,imported) && imported.nodes.every(node=>node.id !== sourceV9ImportScope || node.visible !== true);
}

export function evaluateSourceImportResearchStatusAction(assertion, context) {
  const {actions = {}, samples = {}, events = []} = context;
  const imported = samples[assertion.baseline];
  const draft = samples['search-draft'];
  const empty = samples['source-before-import'];
  const returned = samples[assertion.sample];
  const focus = actions['focus-editor'];
  const typed = actions['type-query'];
  const entry = actions[assertion.entryAction];
  const add = actions['open-import-dialog'];
  const open = actions['open-picker'];
  const picked = actions['select-source-file'];
  const v9 = assertion.expected.importWorkflow === 'v9';
  const commit = v9 ? actions['commit-source-import'] : picked;
  const press = actions[assertion.action];
  const instance = imported?.instanceId;
  const trace = events.filter(event=>event.instanceId === instance && event.channel === 'business');
  const at = (kind, first, last) => trace.filter(event=>event.kind === kind && receives(event,first,last));
  const observations = [draft,empty,imported,returned,focus,typed,entry,add,open,press];
  for (const [id] of pickerActions) observations.push(actions[id]);
  const report = (verdict,reason,actual=null) => ({
    verdict,reason,actual,expected:assertion.expected,
    evidenceRefs:observations.flatMap(observation=>observation?.evidenceRefs ?? []),
  });
  const incomplete = reason => report('NOT_RUN',reason);
  if (![draft,empty,imported].every(fullNativeSample) || !sameWindow(draft,empty) || !sameWindow(empty,imported)) {
    return incomplete('No complete same-window Search draft and source catalog samples');
  }

  const pickerBound = pickerActions.every(([id,from,role],index)=>{
    const action = actions[id];
    const previous = index === 0 ? open : actions[pickerActions[index-1][0]];
    return actionMatches(action,instance,from,`reader-source-picker-${role}`) && precedes(previous,action) &&
      action.pickerTap?.operation === role && positiveInteger(action.pickerTap.probeSeq) &&
      Number.isSafeInteger(action.pickerTap.x) && Number.isSafeInteger(action.pickerTap.y) &&
      typeof action.pickerTap.carrierPath === 'string';
  });
  if (!actionMatches(focus,instance,'search-entry','reader-book-search-input') || !precedes(focus,typed) ||
      !actionMatches(typed,instance,'ime-ready','reader-book-search-input','inputText') || typed.inputRole !== 'a' ||
      typed.inputLength !== assertion.expected.keywordLength ||
      !actionMatches(entry,instance,'search-draft','reader-search-source-recovery-primary') ||
      !actionMatches(add,instance,'source-before-import','reader-source-footer-add-button') ||
      !actionMatches(open,instance,v9 ? sourceV9ImportEntry : 'import-dialog','reader-source-import-local-file') || !pickerBound ||
      !precedes(typed,draft) || !precedes(draft,entry) || !precedes(entry,empty) || !precedes(empty,add) ||
      !precedes(add,open) || !precedes(picked,imported)) {
    return incomplete('No verified native action chain through normal Search, Source Management, and the exact public picker carriers');
  }
  if (v9 && !v9ImportChain(actions,samples,empty,add,picked,imported,observations)) {
    return incomplete('No current native parse, review, grouped import and result-return chain');
  }
  if (v9 && at(statusEvent,picked.beforeSeq,commit.beforeSeq).some(event=>event.payload.phase === 'ready')) {
    return report('FAIL','An import was reported ready before the explicit v9 apply action');
  }

  const drafts = at('search-draft-accepted',typed.beforeSeq,entry.beforeSeq);
  const draftFact = drafts.at(-1);
  const routes = at('source.route',entry.beforeSeq,empty.beforeSeq);
  const opened = routes[0];
  const initial = at('source.projection',opened?.eventSeq,empty.beforeSeq).at(-1);
  const ready = at(statusEvent,commit.beforeSeq,imported.beforeSeq).filter(event=>event.payload.phase === 'ready');
  const readyFact = ready.at(-1);
  const source = readyFact?.payload;
  const rowProjection = at('source.projection',commit.beforeSeq,imported.beforeSeq).at(-1);
  observations.push(draftFact,opened,initial,readyFact,rowProjection);
  if (!draftFact || draftFact.payload.length !== assertion.expected.keywordLength ||
      !positiveInteger(draftFact.payload.queryRevision) || routes.length !== 1 || opened.payload.action !== 'open' ||
      opened.payload.from !== 'search' || opened.payload.to !== 'source' ||
      !sameOwner(initial?.payload.owner,opened.payload) || initial.payload.state !== 'empty' ||
      initial.payload.readFact !== 'current' || initial.payload.count !== 0) {
    return incomplete('The public draft and genuine empty search-origin Source Management opening were not established');
  }
  if (!source || !sameOwner(source.owner,opened.payload) || !sameOwner(rowProjection?.payload.owner,source.owner) ||
      source.confirmation !== 'confirmed' || source.readback !== 'succeeded' ||
      !positiveInteger(source.statusRevision) || !positiveInteger(source.receiptGeneration) ||
      source.confirmedParts !== 1 || source.fixturePresent !== true || source.count !== 1 ||
      rowProjection.payload.state !== 'rows' || rowProjection.payload.count !== 1) {
    return incomplete('No current confirmed Core import and authoritative public fixture readback in the original Source opening');
  }

  const target = assertion.expected.target;
  const geometry = measureSourceNativeControl(imported,target);
  const actual = {owner:source.owner,statusRevision:source.statusRevision,
    receiptGeneration:source.receiptGeneration,nativeTouchTarget:geometry.actual};
  if (!imported.nodes.some(node=>node.id === target)) {
    return report('FAIL','The confirmed import did not display its required native Re-search control',actual);
  }
  if (geometry.verdict === 'FAIL') return report('FAIL',geometry.reason,actual);
  if (geometry.verdict !== 'PASS') return incomplete(geometry.reason);
  if (!actionMatches(press,instance,assertion.baseline,target) || !precedes(imported,press)) {
    return incomplete('The valid touch target has no verified native press');
  }
  const edge = assertion.expected.position === 'top';
  const dispatch = press.statusTopTap;
  if (edge) {
    const point = upperPoint(geometry.actual.bounds);
    if (!positiveInteger(dispatch?.probeSeq) || dispatch.x !== point.x || dispatch.y !== point.y) {
      return incomplete('No actual native command at the measured upper edge of the Re-search Button');
    }
  }

  const returnedCurrent = fullNativeSample(returned) && sameWindow(imported,returned) && precedes(press,returned);
  const end = returnedCurrent ? returned.beforeSeq : press.afterSeq;
  const outcomes = at(statusEvent,press.beforeSeq,end);
  const accepts = outcomes.filter(event=>event.payload.phase === 'accepted');
  const closures = at('source.route',press.beforeSeq,end);
  const searches = at(returnEvent,press.beforeSeq,end);
  const [accepted] = accepts;
  const [closed] = closures;
  const [searched] = searches;
  observations.push(accepted,closed,searched);
  if (!accepted || !closed || !searched)
    return incomplete('No complete owner observation of one accepted status action, source close, and restart');
  const current = searched.payload;
  const closesSource = closed.payload.action === 'close' && closed.payload.from === 'source' &&
    closed.payload.to === 'search' && closed.payload.mounting === source.owner.mounting &&
    closed.payload.previousGeneration === source.owner.generation && closed.payload.generation > source.owner.generation;
  const restartsSearch = current.mounting === source.owner.mounting &&
    current.sourceGeneration === source.owner.generation && current.navigation === closed.payload.generation &&
    current.keywordLength === assertion.expected.keywordLength && current.previousQueryRevision === draftFact.payload.queryRevision &&
    current.queryRevision === current.previousQueryRevision+1 && positiveInteger(current.searchGeneration) &&
    current.searchGeneration === current.previousSearchGeneration+1 && current.draftMatches === true;
  const result = {...actual,searchNavigation:current.navigation,searchQueryRevision:current.queryRevision,
    searchGeneration:current.searchGeneration,keywordLength:current.keywordLength,draftMatches:current.draftMatches};
  if (accepts.length !== 1 || closures.length !== 1 || searches.length !== 1 ||
      !sameOwner(accepted.payload.owner,source.owner) || accepted.payload.statusRevision !== source.statusRevision ||
      accepted.payload.receiptGeneration !== source.receiptGeneration || !closesSource || !restartsSearch ||
      accepted.eventSeq >= closed.eventSeq || closed.eventSeq >= searched.eventSeq) {
    return report('FAIL','The native press did not return the original source opening to exactly one search using the retained draft',result);
  }
  if (!returnedCurrent)
    return report('NOT_RUN','No complete same-window native Search result sample',result);
  const projection = at('search-page-projection',searched.eventSeq,returned.beforeSeq).at(-1);
  observations.push(projection);
  if (!projection) return report('NOT_RUN','No current Search result projection',result);
  if (projection.payload.projection !== 'results' || projection.payload.searchActive !== false ||
      projection.payload.queryRevision !== current.queryRevision)
    return report('FAIL','The returned Search projection does not show the settled current query results',result);
  const nativeResult = returnedLocalResult(returned,projection.payload,current.queryRevision);
  const withNative = {...result,nativeResult};
  if (nativeResult.verdict === 'FAIL')
    return report('FAIL','The returned public local book is not visible in the current query revision’s native result list',withNative);
  if (nativeResult.verdict !== 'PASS') return report('NOT_RUN','No trustworthy current native result carrier',withNative);
  const nativeInteraction = edge ? {subject:'status-action',target,
    bounds:geometry.actual.bounds,carrierPath:geometry.actual.carrierPath,
    visible:true,clipped:false,enabled:true,accepted:true,position:'top',
    actionId:assertion.action,baselineSampleId:assertion.baseline,dispatch} :
    sourceNativeCenterInteraction(assertion,imported,press);
  return report('PASS','',{...withNative,sampleId:assertion.sample,...(nativeInteraction ? {nativeInteraction} : {})});
}

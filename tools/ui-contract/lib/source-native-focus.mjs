import { ancestorsOf } from './layout.mjs';
import { sourceGroupPanel, sourceGroupPanelFrame, sourceGroupSelected, sourceGroupTrigger } from './source-group-outside.mjs';
import { readSourceQueryEditor } from './source-native-control.mjs';
import { sourceReadObservation } from './source-read.mjs';

export const sourceNativeFocusCase = 'source-management.native-focus-and-semantics';
export const sourceNativeFocusFixture = 'public-source-native-focus-and-semantics-v1';
export const sourceGroupTriggerButton = 'reader-source-group-trigger-button';
const editor = 'reader-source-editor';

const focusStages = new Map([
  ['query', {baseline:'source-ready', action:'focus-query', sample:'query-ime', op:'click', target:editor}],
  ['group-selected', {baseline:'query-back', action:'open-group', sample:'group-open', op:'click', target:sourceGroupTriggerButton}],
  ['group-restored', {baseline:'group-open', action:'close-group', sample:'group-restored', op:'keyEvent', key:'Back'}],
  ['group-enter', {baseline:'group-restored', action:'reopen-group-key', sample:'group-key-open', op:'keyEvent', key:'Enter'}],
]);
const semanticsStages = new Map([
  ['group-selected','group-selected'],
  ['group-expanded','group-selected'],
  ['group-collapsed','group-restored'],
]);
const pathFields = ['baseline','action','sample'];
const sequence = value => Number.isSafeInteger(value) && value > 0;
const selection = value => /^source-group:[1-9]\d*$/u.test(value ?? '');
const fullNative = sample => sample?.captureComplete === true && sample.window?.source === 'window-metrics' &&
  typeof sample.window.keyboard?.visible === 'boolean';
const visible = node => node?.source === 'native-tree' && node.visible === true && node.opacity > 0 &&
  node.visibleRectPx?.width > 0 && node.visibleRectPx?.height > 0;
const one = candidates => candidates.length === 1 ? candidates[0] : undefined;
const currentOwner = (owner, other) => sequence(owner?.generation) &&
  Number.isSafeInteger(owner?.mounting) && owner.mounting >= 0 &&
  owner.generation === other?.generation && owner.mounting === other.mounting;

export function isSourceNativeFocusAssertion(assertion) {
  const {kind,expected,entryAction,required} = assertion;
  const semantics = kind === 'source-native-semantics';
  const stage = focusStages.get(semantics ? semanticsStages.get(expected.stage) : expected.stage);
  return Boolean(stage && entryAction === 'open-sources' && required === true && !assertion.condition &&
    pathFields.every(key => assertion[key] === stage[key]));
}

export function sourceNativeFocusSteps(steps, assertions) {
  const selected = assertions.filter(item => ['source-native-focus','source-native-semantics'].includes(item.kind));
  const fullScope = selected.length === focusStages.size + semanticsStages.size &&
    new Set(selected.map(item=>item.kind + ':' + item.expected.stage)).size === selected.length &&
    selected.every(isSourceNativeFocusAssertion);
  const entry = steps.find(step => step.id === 'open-sources');
  const closed = steps.find(step => step.id === 'group-key-closed');
  const close = steps.find(step => step.id === 'close-key-group');
  const operations = [...focusStages.values(),
    {baseline:'query-ime',action:'hide-query-keyboard',sample:'query-back',op:'keyEvent',key:'Back'}];
  return fullScope && entry?.op === 'click' && entry.target === 'reader-settings-source-management' &&
    steps.find(step => step.id === 'source-ready')?.afterAction === entry.id &&
    operations.every(({baseline,action,sample,op,target,key}) => {
      const input = steps.find(step => step.id === action);
      const after = steps.find(step => step.id === sample);
      return input?.op === op && input.from === baseline && input.target === target && input.key === key &&
        after?.kind === 'sample' && after.afterAction === action;
    }) && close?.op === 'keyEvent' && close.key === 'Back' && close.from === 'group-key-open' &&
    closed?.kind === 'sample' && closed.afterAction === close.id;
}

function groupTriggerControl(sample) {
  return one(sample.nodes.filter(node => node.alias === sourceGroupTriggerButton && node.type === 'Button' &&
    ancestorsOf(sample,node).some(parent => parent.id === sourceGroupTrigger)));
}

function groupSelectedControl(sample) {
  const frame = sourceGroupPanelFrame(sample);
  if (!frame) return undefined;
  return one(sample.nodes.filter(node => node.alias === sourceGroupSelected && node.type === 'Button' &&
    ancestorsOf(sample,node).includes(frame.scroll)));
}

function groupPresent(sample) {
  return sample.nodes.some(node => node.id === sourceGroupPanel && visible(node));
}

function uniqueFocus(sample, control) {
  return control?.focused === true && !sample.nodes.some(node=>node !== control &&
    visible(node) && node.focused === true && node.enabled === true && ['Button','TextInput'].includes(node.type));
}

export function sourceNativeFocusKeyReady(step, sample) {
  if (!fullNative(sample) || sample.window.keyboard.visible) return false;
  if (step.id === 'close-key-group') return step.from === 'group-key-open' && step.key === 'Back' && groupPresent(sample);
  if (step.id !== 'reopen-group-key' || step.from !== 'group-restored' || step.key !== 'Enter' || groupPresent(sample)) return false;
  const control = groupTriggerControl(sample);
  return visible(control) && control.enabled === true && control.clickable === true && uniqueFocus(sample,control);
}

function sameWindow(action, before, after, policy) {
  return fullNative(before) && fullNative(after) && action?.from === policy.baseline && action.op === policy.op &&
    action.targetId === policy.target && action.key === policy.key &&
    action.instanceId === before.instanceId && action.instanceId === after.instanceId &&
    before.window.id === after.window.id && before.window.density === after.window.density &&
    before.window.orientation === after.window.orientation && before.window.rectPx && after.window.rectPx &&
    ['left','top','width','height'].every(key=>before.window.rectPx[key] === after.window.rectPx[key]) &&
    [before.afterSeq,action.beforeSeq,action.afterSeq,after.beforeSeq].every(sequence) &&
    before.afterSeq <= action.beforeSeq && action.beforeSeq < action.afterSeq && action.afterSeq <= after.beforeSeq;
}

const projectionFields = ['readGeneration','filterRevision','count','projected','groupIndex','queryLength','status','category'];
function projectionReady(payload) {
  return payload?.state === 'rows' && payload.readFact === 'current' &&
    ['readGeneration','filterRevision','count','projected'].every(field => sequence(payload[field])) &&
    payload.groupIndex === 0 && payload.queryLength === 0 && payload.status === 'all' && payload.category === 'all';
}

function evidence(context, assertion, policy) {
  const before = context.samples?.[policy.baseline];
  const after = context.samples?.[policy.sample];
  const action = context.actions?.[policy.action];
  if (!sameWindow(action,before,after,policy)) return null;
  const entry = sourceReadObservation({action:assertion.entryAction,sample:'source-ready',expected:{state:'rows'}},context);
  if (!entry?.triggered || entry.sample.window?.id !== before.window.id ||
      entry.sample.instanceId !== before.instanceId || !projectionReady(entry.current.payload)) return null;
  const events = (context.events ?? []).filter(event => event.instanceId === before.instanceId &&
    event.channel === 'business' && event.eventSeq > entry.entry.eventSeq && event.eventSeq <= after.beforeSeq);
  const prior = events.findLast(event => event.kind === 'source.projection' && event.eventSeq <= before.beforeSeq);
  const current = events.findLast(event => event.kind === 'source.projection');
  const owner = entry.current.payload.owner;
  if (![prior,current].every(event=>projectionReady(event?.payload))) return null;
  const overlays = events.filter(event => event.kind === 'source.overlay' && event.payload.overlay === 'group');
  const actionOverlays = overlays.filter(event => event.eventSeq > action.beforeSeq);
  const priorOverlay = overlays.findLast(event => event.eventSeq <= before.beforeSeq);
  const sameProjection = [prior,current].every(event => currentOwner(event.payload.owner, owner) &&
    projectionFields.every(field => event.payload[field] === entry.current.payload[field]));
  const routes = events.filter(event => event.kind === 'source.route');
  const refs = [entry.entry,entry.current,before,action,after,prior,current,priorOverlay,...actionOverlays,...routes];
  return {before,after,action,owner,priorOverlay,actionOverlays,routes,sameProjection,refs};
}

function groupTransition(stage, observed) {
  const {priorOverlay,actionOverlays,owner,after} = observed;
  if (stage === 'query') return true;
  if (stage === 'group-restored') {
    const identity = priorOverlay?.payload.selectionId;
    const [back,dismissed] = actionOverlays.map(event=>event.payload);
    // The normal Source back bridge records the consumer, and the subsequent
    // dismissal carries the active selection identity.
    return priorOverlay?.payload.phase === 'open' && currentOwner(priorOverlay.payload.owner,owner) &&
      selection(identity) && actionOverlays.length === 2 && back.phase === 'back' &&
      (back.selectionId === undefined || back.selectionId === identity) && currentOwner(back.owner,owner) &&
      dismissed.phase === 'dismiss' && dismissed.selectionId === identity &&
      currentOwner(dismissed.owner,owner) && !groupPresent(after);
  }
  const opened = actionOverlays[0]?.payload;
  const control = groupSelectedControl(after);
  return actionOverlays.length === 1 && opened.phase === 'open' && currentOwner(opened.owner,owner) &&
    selection(opened.selectionId) && opened.selectionId === control?.sourceFocusSelection &&
    (stage !== 'group-enter' || priorOverlay?.payload.phase === 'dismiss' &&
      selection(priorOverlay.payload.selectionId) && currentOwner(priorOverlay.payload.owner,owner) &&
      opened.selectionId !== priorOverlay.payload.selectionId);
}

export function evaluateSourceNativeFocus(assertion,context) {
  const semantics = assertion.kind === 'source-native-semantics';
  const stage = semantics ? semanticsStages.get(assertion.expected.stage) : assertion.expected.stage;
  const policy = focusStages.get(stage);
  const observed = policy && evidence(context,assertion,policy);
  const report = (verdict,reason = '',actual = null) => ({verdict,reason,actual,
    evidenceRefs:(observed?.refs ?? []).flatMap(item => item?.evidenceRefs ?? []),
    observationsComplete:verdict !== 'NOT_RUN'});
  if (!observed) return report('NOT_RUN','No same-window native action and current Source opening evidence');
  const {before,after,owner,routes,sameProjection} = observed;
  const actual = {sampleId:assertion.sample,stage:assertion.expected.stage,owner,screenReaderUtterance:'NOT_RUN'};
  if (routes.length || !sameProjection) return report('FAIL','The action changed the retained Source opening or projection',actual);
  if (!groupTransition(stage,observed)) {
    if (stage === 'group-enter' && sourceNativeFocusKeyReady({id:policy.action,from:policy.baseline,key:'Enter'},before) &&
        !groupPresent(after) && observed.actionOverlays.length === 0)
      return report('FAIL','Native Enter from the focused group trigger did not reopen the group panel',actual);
    return report('NOT_RUN','Missing the exact current Source group selection and overlay lifecycle',actual);
  }
  if (semantics) {
    const [node,field,expected] = {
      'group-selected':[groupSelectedControl(after),'selected',true],
      'group-expanded':[groupTriggerControl(after),'sourceFocusExpansion','expanded'],
      'group-collapsed':[groupTriggerControl(after),'sourceFocusExpansion','collapsed'],
    }[assertion.expected.stage];
    if (!node || node[field] == null) return report('NOT_RUN','The native tree did not expose the requested accessibility property',actual);
    const property = node[field];
    return report(property === expected ? 'PASS' : 'FAIL',property === expected ? '' :
      'The native accessibility property does not match the current control state',
      {...actual,carrierPath:node.path,declaredProperty:property});
  }
  const node = stage === 'query' ? readSourceQueryEditor(after) :
    stage === 'group-restored' ? groupTriggerControl(after) : groupSelectedControl(after);
  if (!node || typeof node.focused !== 'boolean' || typeof node.enabled !== 'boolean')
    return report('NOT_RUN','The current native control or its actual focus state is unavailable',actual);
  if (stage === 'query' && readSourceQueryEditor(before)?.focused !== false ||
      stage === 'group-enter' && !sourceNativeFocusKeyReady({id:policy.action,from:policy.baseline,key:'Enter'},before))
    return report('NOT_RUN','The native action did not begin from its independently verified focus state',actual);
  const result = {...actual,carrierPath:node.path,focused:node.focused,keyboardVisible:after.window.keyboard.visible,
    nativeKey:policy.key ?? null,
    ...(stage === 'query' ? {nativeDeclaredName: typeof node.sourceFocusQueryName !== 'boolean' ? 'NOT_RUN' :
      node.sourceFocusQueryName ? 'PASS' : 'FAIL'} : {})};
  const valid = visible(node) && node.enabled && uniqueFocus(after,node) &&
    before.window.keyboard.visible === false && after.window.keyboard.visible === (stage === 'query');
  return report(valid ? 'PASS' : 'FAIL', valid ? '' : 'The expected native control did not receive unique usable focus',result);
}

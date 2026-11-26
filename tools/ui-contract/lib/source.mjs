import { EvidenceError } from '../../lib/native-ui-evidence.mjs';
import { evaluateLayout, layoutTapPoint, selectLayoutNode, sourceFooterToolsButton, sourceHeaderToolsButton } from './layout.mjs';
import { sourceReadLoadingFrame, sourceReadLoadingNativeFrame, sourceReadObservation } from './source-read.mjs';
import { measureSourceNativeControl, readSourceQueryEditor } from './source-native-control.mjs';
import { sourceNativeCenterInteraction } from './source-native-center.mjs';
import { sourceReadRetryNativeInteraction } from './source-read-retry-touch.mjs';
import { measureSourceFilterCarrier, readSourceFilterEdge, readSourceFilterNativeInteraction,
  sourceFilterEdgeTarget } from './source-filter-edge.mjs';
import { measureSourceFilterScroll, sourceFilterScrollLanes } from './source-filter-scroll.mjs';
import { evaluateSourceFilterTailText } from './source-filter-tail-text.mjs';
import { measureSourceToggleCarrier, readSourceToggleEdge, readSourceToggleTouch,
  sourceToggleIsConfirmed, sourceToggleReadyAt, sourceToggleSameOwner } from './source-toggle-edge.mjs';
import { evaluateSourceAdaptationSurface, evaluateSourceAdaptationText, evaluateSourceRowStatusBadge } from './source-adaptation.mjs';
import { evaluateSourceRetainedReadFailure } from './source-retained-read.mjs';
import { evaluateSourceRecoveryControl } from './source-recovery-control.mjs';
import { evaluateSourceControlAction } from './source-control-touch.mjs';
import { evaluateSourceRecoveryBody } from './source-recovery-body.mjs';
import { measureSourceGroupOutside, sourceGroupBackdrop, sourceGroupPanelFrame, sourceGroupTrigger } from './source-group-outside.mjs';
import { evaluateSourceGroupOptionsScroll } from './source-group-options-scroll.mjs';
import { evaluateSourceGroupOptionsText } from './source-group-options-text.mjs';
import { evaluateSourceSurfaceText } from './source-surface-text.mjs';
import { measureSourceQueryEdge, measureSourceQueryTouch } from './source-query-edge.mjs';
import { evaluateSourceImportResearchStatusAction } from './source-status-action.mjs';
import { evaluateSourceInlineImportEdge } from './source-inline-import-edge.mjs';
import { evaluateSourceChrome } from './source-chrome-dispatch.mjs';
import { evaluateSourceV9Chrome, sourceV9ChromeDispatch, sourceV9ChromeGeometry } from './source-v9-chrome.mjs';
import { evaluateSourceOfflineDetect } from './source-offline-detect.mjs';
import { evaluateSourceNativeFocus } from './source-native-focus.mjs';
import { sourceFilterClearKind, sourceFilterClearPoint, sourceFilterClearQuery, sourceFilterClearTarget } from './source-filter-clear-edge.mjs';

const editor = 'reader-source-editor';
const empty = 'reader-source-filtered-empty';
const positiveRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const clear = 'reader-source-clear-filters';
const footer = 'reader-source-footer';
const list = 'reader-source-list';
const back = 'reader-source-back';
const filterBlock = 'reader-source-filter-block';
const groupPanel = 'reader-source-group-panel';
const toolsHeader = 'reader-source-header-tools';
const toolsBack = 'reader-source-tools-back';
const sourceParentControls = {
  search:{entry:'reader-search-source-recovery-primary',returned:'reader-book-search-input'},
  settings:{entry:'reader-settings-source-management',returned:'reader-settings-source-management'},
};
const readRetry = 'reader-source-read-retry';
const readFailureTitle = 'reader-source-read-failure-title';
const sourceEmptyTitle = 'reader-source-empty-library-title';
const positiveInt = value => Number.isSafeInteger(value) && value > 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
const sourceFilterDefaults = { status:'all', category:'all', groupIndex:0, queryLength:0 };
const sourceFilterKeys = [...Object.keys(sourceFilterDefaults),'allGroups'];

function settledFilterProjection(projection) {
  return projection?.readFact === 'current' && positiveInt(projection.readGeneration) &&
    positiveInt(projection.count) && count(projection.projected) && projection.projected <= projection.count &&
    positiveInt(projection.filterRevision) && count(projection.groupIndex) && count(projection.queryLength) &&
    typeof projection.status === 'string' && typeof projection.category === 'string' &&
    projection.allGroups === (projection.groupIndex === 0) &&
    projection.state === (projection.projected ? 'rows' : 'filteredEmpty');
}

function sameOwner(a, b) {
  return positiveInt(a?.generation) && count(a?.mounting) && a.generation === b?.generation && a.mounting === b?.mounting;
}

function oneNode(sample, selector, includeClipped = false) {
  if (!sample) return undefined;
  try { return selectLayoutNode(sample, selector, {visibleOnly: !includeClipped}); }
  catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return undefined;
  }
}

function retryButtonUsable(sample) {
  const button = oneNode(sample, {id:readRetry,ancestors:['reader-source-empty-state']});
  try { return Boolean(layoutTapPoint(button)); }
  catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return false;
  }
}

function fullyVisible(node) {
  return node?.visible === true && node.opacity > 0 && node.rectPx?.width > 0 && node.rectPx?.height > 0 &&
    ['left', 'top', 'width', 'height'].every(key => node.rectPx[key] === node.visibleRectPx?.[key]);
}

function owningNativeSlot(sample, child) {
  if (!child?.path) return undefined;
  const slots = sample.nodes.filter(node => node.type === 'Column' &&
    /^reader-native-slot:[1-9][0-9]*$/u.test(node.id ?? '') && child.path.startsWith(node.path + '/'));
  return slots.length === 1 ? slots[0] : undefined;
}

const rectFields = ['left','top','width','height'];
const rectPresent = box => box && rectFields.every(key => Number.isFinite(box[key])) && box.width > 0 && box.height > 0;
const bottom = box => box.top + box.height;

function footerRoundingAtWindowBottom(carrier, body, windowRect, actions, tolerancePx) {
  const {rectPx: authored, visibleRectPx: visible} = carrier;
  const inside = (outer, inner) => inner.left >= outer.left && inner.top >= outer.top &&
    inner.left + inner.width <= outer.left + outer.width && bottom(inner) <= bottom(outer);
  if (carrier.type !== 'Column' || carrier.visible !== true || !(carrier.opacity > 0) ||
      carrier.clip !== false || carrier.backgroundAlpha !== 0 || carrier.clickable !== false ||
      carrier.hitTestMode !== 'HitTestMode.Default' || !rectPresent(authored) ||
      !rectPresent(visible) || !rectPresent(windowRect) || !fullyVisible(body) ||
      body.parentPath !== carrier.path || !inside(visible, body.visibleRectPx) ||
      !actions.every(action => fullyVisible(action) && inside(body.visibleRectPx, action.visibleRectPx))) return false;
  const trim = bottom(authored) - bottom(visible);
  return Number.isFinite(tolerancePx) && trim > 0 && trim <= Math.min(1, tolerancePx) &&
    authored.left === visible.left && authored.top === visible.top && authored.width === visible.width &&
    bottom(visible) === bottom(windowRect) && inside(windowRect, visible);
}

const sameWindowLayout = (a,b) => a?.instanceId === b?.instanceId && a?.window?.id === b?.window?.id &&
  a?.window?.revision === b?.window?.revision && a?.window?.density === b?.window?.density;
const filterTopPx = sample => {
  const filter = oneNode(sample,filterBlock,true)?.rectPx;
  const viewport = oneNode(sample,list)?.rectPx;
  return rectPresent(filter) && rectPresent(viewport) ? filter.top - viewport.top : undefined;
};

function readSourceInsetsFrame(context, sample) {
  if (!fullSample(sample) || sample.window.keyboard?.visible !== false ||
      !Number.isFinite(sample.window.density) || sample.window.density <= 0) return undefined;
  const geometry = latestAt(context,sample,'source.geometry');
  const projection = latestAt(context,sample,'source.projection');
  if (!geometry || !projection || !sameOwner(geometry.payload.owner,projection.payload.owner)) return undefined;
  const header = owningNativeSlot(sample, oneNode(sample,back))?.rectPx;
  const dock = owningNativeSlot(sample, oneNode(sample,footer))?.rectPx;
  const viewport = oneNode(sample,list)?.rectPx;
  if (![header,dock,viewport].every(rectPresent)) return undefined;
  return {sample,geometry,projection,header,dock,viewport,density:sample.window.density};
}

function eventsAt(context, action, sample, kind) {
  if (!sample || action?.instanceId !== sample.instanceId || !Number.isSafeInteger(action.beforeSeq) ||
      !Number.isSafeInteger(sample.beforeSeq) || action.beforeSeq >= sample.beforeSeq) return [];
  return context.events.filter(event => event.instanceId === action.instanceId && event.channel === 'business' &&
    event.kind === kind && event.eventSeq > action.beforeSeq && event.eventSeq <= sample.beforeSeq);
}

const latestAt = (context, sample, kind, predicate = () => true) => context.events.findLast(event =>
  event.instanceId === sample?.instanceId && event.eventSeq <= sample?.beforeSeq && event.channel === 'business' &&
  event.kind === kind && predicate(event.payload));

function fullSample(sample) {
  return sample?.window && sample.evidenceRefs.some(reference => reference.path.endsWith('.png')) &&
    sample.evidenceRefs.some(reference => reference.path.endsWith('.json'));
}

function pairedNativeEndpoint(action, baseline, sample, baselineId) {
  if (action?.from !== baselineId ||
      !fullSample(baseline) || !fullSample(sample) || action.instanceId !== baseline.instanceId ||
      action.instanceId !== sample.instanceId || baseline.window.id !== sample.window.id) return false;
  const { beforeSeq, afterSeq } = action;
  return [baseline.afterSeq, beforeSeq, afterSeq, sample.beforeSeq].every(Number.isSafeInteger) &&
    baseline.afterSeq <= beforeSeq && beforeSeq < afterSeq && afterSeq <= sample.beforeSeq;
}

function pairedNativeBack(action, baseline, sample, baselineId) {
  return action?.op === 'keyEvent' && action.key === 'Back' && pairedNativeEndpoint(action,baseline,sample,baselineId);
}

function sourceReadRetryReceipt(context,action,baseline,sample,initial) {
  const interval = context.events.filter(event => event.instanceId === action.instanceId &&
    event.channel === 'business' && event.eventSeq > baseline.beforeSeq && event.eventSeq <= sample.beforeSeq);
  const current = interval.findLast(event => event.kind === 'source.projection');
  const between = interval.findLast(event => event.kind === 'source.projection' && event.eventSeq <= action.beforeSeq);
  const retries = interval.filter(event => event.kind === 'source.read-retry' && event.eventSeq > action.beforeSeq);
  const [start,end] = retries;
  const started = start?.payload;
  const settled = end?.payload;
  const verified = !interval.some(event => event.kind === 'source.route') && (!between ||
    sameOwner(between.payload.owner,initial.owner) && between.payload.readGeneration === initial.readGeneration &&
    between.payload.state === initial.state && (!initial.count || between.payload.readFact === initial.readFact)) &&
    retries.length === 2 && current && sameOwner(current.payload.owner,initial.owner) && started.phase === 'started' &&
    start.eventSeq <= action.afterSeq && settled.phase === 'settled' && end.eventSeq > start.eventSeq &&
    started.failedReadGeneration === initial.readGeneration && settled.failedReadGeneration === initial.readGeneration &&
    positiveInt(started.readGeneration) && started.readGeneration > initial.readGeneration &&
    started.startedReadGeneration === started.readGeneration && settled.startedReadGeneration === started.readGeneration &&
    positiveInt(settled.readGeneration) && settled.readGeneration > started.readGeneration &&
    (initial.count ? started.readFact === 'refreshing' : ['loading','refreshing'].includes(started.readFact)) &&
    started.count === initial.count;
  return {current,started,settled,verified,observations:[between,...retries,current]};
}

function sourceFilterNativeInteraction(assertion, action, baseline, sample) {
  if (!action?.filterTouch || !pairedNativeEndpoint(action,baseline,sample,assertion.baseline) ||
      !sameWindowLayout(baseline,sample) || [baseline,sample].some(point => point.captureComplete !== true ||
        point.window.source !== 'window-metrics' || point.window.keyboard?.visible !== false)) return undefined;
  return readSourceFilterNativeInteraction(baseline,action,assertion);
}

const sourceGroupSelection = observation => /^source-group:[1-9][0-9]*$/u.test(observation?.payload.selectionId ?? '');
const hasVisibleGroupPanel = sample => sample.nodes.some(node => node.visible === true &&
  (node.id === groupPanel || node.alias === groupPanel));
const hasNativeGroupSelection = (sample,observation) => sourceGroupSelection(observation) &&
  oneNode(sample,sourceGroupBackdrop)?.id === `reader-source-group-backdrop:${observation.payload.selectionId}`;

const combinedActionPlans = [
  {id:'select-unchecked',from:'source-ready',to:'unchecked',op:'click',target:'reader-source-status-unchecked',
    trigger:'status',changes:{status:'unchecked'}},
  {id:'select-novel',from:'unchecked',to:'novel',op:'click',target:'source-category-novel',
    trigger:'category',changes:{category:'novel'}},
  {id:'select-group',from:'group-open',to:'combined-active',op:'click',target:'reader-source-group-option-1',
    trigger:'group',changes:{groupIndex:1,allGroups:false}},
  {id:'edit-zero-match',from:'source-ime',to:'filtered-ime',op:'inputText',target:editor,trigger:'edit'},
  {id:'ime-back',from:'filtered-ime',to:'zero-match',op:'keyEvent'},
];
const combinedActionsBefore = new Map([
  ['select-unchecked',0],['select-novel',1],['open-group',2],['select-group',2],
  ['focus-editor',3],['edit-zero-match',3],['ime-back',4],['clear-filters',5],
]);
const sameCatalogue = (a,b) => settledFilterProjection(a) && settledFilterProjection(b) &&
  sameOwner(a.owner,b.owner) && a.readGeneration === b.readGeneration && a.count === b.count;
const sameFilterState = (a,b) => sameCatalogue(a,b) &&
  [...sourceFilterKeys,'filterRevision','state','projected','firstAnchor'].every(key=>a[key] === b[key]);
const defaultSourceFilters = value => value.allGroups === true &&
  Object.entries(sourceFilterDefaults).every(([key,expected])=>value[key] === expected);
function scopedSourceFirstRow(sample,anchor) {
  const row = positiveInt(anchor) && oneNode(sample,{id:`reader-source-row-${anchor}`,ancestors:[list]});
  return row?.source === 'native-tree' && fullyVisible(row);
}

function combinedFilterProgress(context, completed, expected) {
  const {samples,actions} = context;
  const opening = sourceReadObservation({action:'open-sources',sample:'source-ready',expected:{state:'rows'}},context);
  const initialSample = opening?.sample;
  const initial = opening?.current?.payload;
  const refs = [initialSample,opening?.entry,opening?.current];
  const result = (verdict,reason,actual = {}) => ({verdict,reason,actual,refs});
  if (!settledFilterProjection(initial) || !defaultSourceFilters(initial) ||
      initial.projected !== initial.count || !fullSample(initialSample) || initialSample.captureComplete !== true ||
      initialSample.window.source !== 'window-metrics' || initialSample.window.keyboard?.visible !== false ||
      !scopedSourceFirstRow(initialSample,initial.firstAnchor)) {
    return result('NOT_RUN','No complete default Source catalogue with its exact native first row');
  }
  let previous = initial;
  const reached = [];
  for (const plan of combinedActionPlans.slice(0,completed)) {
    const from = samples[plan.from];
    const to = samples[plan.to];
    const input = actions[plan.id];
    const snapshot = latestAt(context,from,'source.projection');
    const endpoint = latestAt(context,to,'source.projection');
    refs.push(from,to,input,snapshot,endpoint);
    if (!from || !to || !input || !snapshot || !endpoint || input.outcomeSettled !== true ||
        input.op !== plan.op || input.from !== plan.from || input.targetId !== plan.target ||
        input.instanceId !== initialSample.instanceId || to.instanceId !== initialSample.instanceId ||
        from.window.id !== initialSample.window.id || to.window.id !== initialSample.window.id ||
        ![from.afterSeq,input.beforeSeq,input.afterSeq,to.beforeSeq].every(count) ||
        !(from.afterSeq <= input.beforeSeq && input.beforeSeq < input.afterSeq && input.afterSeq <= to.beforeSeq)) {
      return result('NOT_RUN',`Missing the native dispatch or current owner endpoints for ${plan.id}`);
    }
    const next = endpoint.payload;
    const routes = eventsAt(context,input,to,'source.route');
    const observations = eventsAt(context,input,to,'source.projection');
    const reported = {initial,step:plan.id,before:snapshot.payload,after:next,completed:reached};
    refs.push(...routes,...observations);
    if (!plan.trigger && routes.length) {
      return result('FAIL','Back left the Source opening instead of exclusively hiding the IME',reported);
    }
    if (!sameFilterState(previous,snapshot.payload) || !sameCatalogue(initial,next) || routes.length ||
        observations.some(event=>!sameCatalogue(initial,event.payload))) {
      return result('NOT_RUN',`The Source opening or catalogue changed during ${plan.id}`,reported);
    }
    if (!plan.trigger) {
      const ime = sourceCheck({kind:'ime-back',action:plan.id,baseline:plan.from,sample:plan.to,expected:{staysOnPage:true}},context);
      if (ime.verdict !== 'PASS' || !sameFilterState(previous,next) ||
          observations.some(event=>!sameFilterState(previous,event.payload))) {
        return result(ime.verdict === 'NOT_RUN' ? 'NOT_RUN' : 'FAIL',
          'Back did not exclusively hide the IME and retain all four Source filters',reported);
      }
    } else {
      const changes = plan.trigger === 'edit' ? {queryLength:expected.queryLength} : plan.changes;
      const comparisonFields = sourceFilterKeys.filter(key=>!Object.hasOwn(changes,key));
      const matches = state => Object.entries(changes).every(([key,value])=>state[key] === value) &&
        comparisonFields.every(key=>state[key] === previous[key]);
      const commits = observations.filter(event=>event.payload.trigger === plan.trigger);
      const accepted = commits.filter(event=>matches(event.payload));
      const projectedAsExpected = plan.trigger === 'edit' ?
        input.inputRole === 'zero-match' && input.inputLength === expected.queryLength &&
          from.window.keyboard?.visible === true && to.window.keyboard?.visible === true &&
          next.projected === 0 && next.firstAnchor === 0 :
        next.projected > 0 && next.projected <= previous.projected;
      const matchedOwnerCommit = accepted.length === 1 && accepted[0].eventSeq <= input.afterSeq &&
        commits.every(event=>comparisonFields.every(
        key=>event.payload[key] === previous[key])) &&
        (plan.trigger === 'edit' || commits.length === 1) &&
        sameFilterState(accepted[0]?.payload,next) && next.filterRevision > previous.filterRevision &&
        Object.entries(changes).every(([key,value])=>previous[key] !== value);
      if (!matchedOwnerCommit || !projectedAsExpected) {
        return result('FAIL',`The native input did not produce one matching same-owner Source transition for ${plan.id}`,reported);
      }
      if (plan.trigger === 'group') {
        const opened = latestAt(context,from,'source.overlay',payload=>payload.overlay === 'group');
        const dismissed = eventsAt(context,input,to,'source.overlay').filter(event=>event.payload.overlay === 'group');
        refs.push(opened,...dismissed);
        if (!currentCombinedGroup(context,from) || dismissed.length !== 1 ||
            dismissed[0].payload.phase !== 'dismiss' || !sameOwner(initial.owner,dismissed[0].payload.owner) ||
            dismissed[0].payload.selectionId !== opened?.payload.selectionId || hasVisibleGroupPanel(to)) {
          return result('FAIL','The measured selection did not dismiss its own Source group opening',reported);
        }
      }
    }
    reached.push({action:plan.id,filterRevision:next.filterRevision,projected:next.projected});
    previous = next;
  }
  return result('PASS','',{initial,previous,completed:reached});
}

function currentCombinedGroup(context, sample, option = 'reader-source-group-option-1') {
  const before = context.samples.novel;
  const projection = latestAt(context,sample,'source.projection');
  const opened = latestAt(context,sample,'source.overlay',payload=>payload.overlay === 'group');
  const input = context.actions['open-group'];
  const openings = eventsAt(context,input,sample,'source.overlay').filter(event=>event.payload.overlay === 'group');
  return input?.op === 'click' && input.targetId === sourceGroupTrigger && input.from === 'novel' &&
    input.outcomeSettled === true && before?.instanceId === input.instanceId && sample?.instanceId === input.instanceId &&
    sample.window.id === before.window.id && before.afterSeq <= input.beforeSeq &&
    input.beforeSeq < input.afterSeq && input.afterSeq <= sample.beforeSeq &&
    openings.length === 1 && opened === openings[0] &&
    opened.eventSeq <= input.afterSeq && opened.payload.phase === 'open' &&
    sameOwner(projection?.payload.owner,opened.payload.owner) && hasNativeGroupSelection(sample,opened) &&
    Boolean(oneNode(sample,'reader-source-group-selected') &&
      oneNode(sample,{id:option,ancestors:[groupPanel]}));
}

export function assertCombinedFilterResetAction(contract,step,context,mark) {
  if (contract.id !== 'source-management.combined-filter-reset' || contract.version !== 3 ||
      !combinedActionsBefore.has(step.id)) return;
  const expected = contract.assertions.find(assertion=>assertion.kind === 'combined-filter-reset').expected;
  const progress = combinedFilterProgress(context,combinedActionsBefore.get(step.id),expected);
  if (progress.verdict !== 'PASS') throw new EvidenceError(progress.reason);
  const sample = context.samples[step.from];
  const current = latestAt(context,{instanceId:mark.instanceId,beforeSeq:mark.eventSeq},'source.projection');
  const route = latestAt(context,{instanceId:mark.instanceId,beforeSeq:mark.eventSeq},'source.route');
  const withinScope = sameFilterState(progress.actual.previous,current?.payload) &&
    route?.payload.action === 'open' && route.payload.to === 'source' &&
    sameOwner(progress.actual.initial.owner,route.payload);
  if (!withinScope || step.id === 'select-group' && !currentCombinedGroup(context,sample))
    throw new EvidenceError(`The verified Source catalogue or native group scope changed before ${step.id}`);
}

function sourceToolsFilterProgress(context, expected) {
  const {samples,actions} = context;
  const opening = sourceReadObservation({action:'open-sources',sample:'source-ready',expected:{state:'rows'}},context);
  const initial = opening?.current?.payload;
  const refs = [opening?.sample,opening?.entry,opening?.current];
  const completed = [];
  const result = (verdict,reason,previous) => ({verdict,reason,previous,refs,completed});
  if (!settledFilterProjection(initial) || !defaultSourceFilters(initial) || initial.projected !== initial.count ||
      opening.sample?.captureComplete !== true || !scopedSourceFirstRow(opening.sample,initial.firstAnchor))
    return result('NOT_RUN','No complete default public Source catalogue for the Tools round trip');
  const v9Groups = expected.view === 'groups';
  const status = v9Groups ? 'disabled' : 'unchecked';
  const plans = [
    {id:'select-public-fixture',from:'fixture-query-ime',to:'fixture-query-edited',
      op:'inputText',target:editor,trigger:'edit',changes:{queryLength:expected.queryLength}},
    {id:'leave-fixture-ime',from:'fixture-query-edited',to:'query-ready',op:'keyEvent'},
    {id:`select-${status}`,from:'query-ready',to:status,op:'click',target:`reader-source-status-${status}`,
      trigger:'status',changes:{status:expected.status}},
    {id:'select-novel',from:status,to:'novel',op:'click',target:'source-category-novel',
      trigger:'category',changes:{category:expected.category}},
    {id:'select-group',from:'group-open',to:'filtered',op:'click',target:`reader-source-group-option-${expected.groupIndex}`,
      trigger:'group',changes:{groupIndex:expected.groupIndex,allGroups:false}},
  ];
  let previous = initial;
  for (const plan of plans) {
    const from = samples[plan.from];
    const to = samples[plan.to];
    const input = actions[plan.id];
    const prior = latestAt(context,from,'source.projection');
    const current = latestAt(context,to,'source.projection');
    refs.push(from,to,input,prior,current);
    if (!from?.window || !to?.window || !prior || !current || input?.outcomeSettled !== true ||
        input.op !== plan.op || input.targetId !== plan.target || input.from !== plan.from ||
        [from,to,input].some(point => point.instanceId !== opening.sample.instanceId) ||
        [from,to].some(point => point.window.id !== opening.sample.window.id) ||
        ![from.afterSeq,input.beforeSeq,input.afterSeq,to.beforeSeq].every(count) ||
        from.afterSeq > input.beforeSeq || input.beforeSeq >= input.afterSeq || input.afterSeq > to.beforeSeq)
      return result('NOT_RUN',`Missing the native dispatch or Source endpoints for ${plan.id}`);
    const routes = eventsAt(context,input,to,'source.route');
    const changes = eventsAt(context,input,to,'source.projection').filter(event=>event.payload.trigger === plan.trigger);
    const next = current.payload;
    refs.push(...routes,...changes);
    if (!sameFilterState(previous,prior.payload) || !sameCatalogue(initial,next) || routes.length ||
        changes.some(event=>!sameCatalogue(initial,event.payload)))
      return result('NOT_RUN',`The Source opening or catalogue changed during ${plan.id}`);
    if (plan.op === 'keyEvent') {
      if (input.key !== 'Back' || from.window.keyboard?.visible !== true || to.window.keyboard?.visible !== false ||
          !sameFilterState(previous,next) || oneNode(to,editor)?.publicSourceToolsQueryMatches !== true)
        return result('FAIL','The normal Back did not hide only the IME and retain the public query');
      continue;
    }
    const edited = plan.op === 'inputText';
    const untouched = sourceFilterKeys.filter(key=>!Object.hasOwn(plan.changes,key));
    const accepted = changes.filter(({payload})=>Object.entries(plan.changes).every(([key,value])=>payload[key] === value));
    const validCommit = accepted.length === 1 && accepted[0].eventSeq <= input.afterSeq &&
      sameFilterState(accepted[0].payload,next) && next.filterRevision > previous.filterRevision &&
      Object.keys(plan.changes).every(key=>next[key] !== previous[key]) &&
      changes.every(({payload})=>untouched.every(key=>payload[key] === previous[key])) &&
      next.projected > 0 && next.projected <= previous.projected;
    const correctInput = edited ? input.inputRole === 'public-source-prefix' && input.inputLength === expected.queryLength &&
      from.window.keyboard?.visible === true && to.window.keyboard?.visible === true &&
      oneNode(from,editor)?.focused === true && oneNode(to,editor)?.publicSourceToolsQueryMatches === true &&
      next.projected < previous.projected : changes.length === 1 &&
      from.window.keyboard?.visible === false && to.window.keyboard?.visible === false;
    if (!validCommit || !correctInput)
      return result('FAIL',`The native input did not commit one matching Source transition for ${plan.id}`);
    if (plan.trigger === 'group') {
      const opened = latestAt(context,from,'source.overlay',payload=>payload.overlay === 'group');
      const dismissed = eventsAt(context,input,to,'source.overlay').filter(event=>event.payload.overlay === 'group');
      const option = oneNode(from,{id:plan.target,ancestors:[groupPanel]});
      const label = option && from.nodes.some(node=>node.publicGroupOptionText === true && node.path.startsWith(option.path + '/'));
      refs.push(opened,...dismissed);
      if (!currentCombinedGroup(context,from,plan.target) || !label || dismissed.length !== 1 ||
          dismissed[0].payload.phase !== 'dismiss' || !sameOwner(initial.owner,dismissed[0].payload.owner) ||
          dismissed[0].payload.selectionId !== opened?.payload.selectionId || hasVisibleGroupPanel(to))
        return result('FAIL','The selected native novel group did not dismiss its own Source group opening');
    }
    completed.push({action:plan.id,filterRevision:next.filterRevision,projected:next.projected});
    previous = next;
  }
  if (previous.projected < expected.minimumProjected || !scopedSourceFirstRow(samples.filtered,previous.firstAnchor))
    return result('NOT_RUN','The live filtered Source catalogue has no sufficient stable rows for an anchor round trip');
  return result('PASS','',previous);
}

export function assertSourceToolsReturnAction(contract,step,context,mark) {
  const v9Groups = contract.id === 'source-management.v9-group-return' && contract.version === 1;
  const legacy = contract.id === 'source-management.tool-return-filters' && contract.version === 2;
  const open = v9Groups ? 'open-groups' : 'open-tools';
  if ((!v9Groups && !legacy) || !['scroll-list',open].includes(step.id)) return;
  const expected = contract.assertions.find(assertion=>assertion.kind === (v9Groups ? 'v9-list-return' : 'tool-return-filters')).expected;
  const progress = sourceToolsFilterProgress(context,expected);
  if (progress.verdict !== 'PASS') throw new EvidenceError(progress.reason);
  const point = {instanceId:mark.instanceId,beforeSeq:mark.eventSeq};
  const current = latestAt(context,point,'source.projection');
  if (!sameFilterState(progress.previous,current?.payload))
    throw new EvidenceError(`The verified filtered Source catalogue changed before ${step.id}`);
  if (step.id === open) {
    const scroll = latestAt(context,point,'source.scroll')?.payload;
    if (scroll?.trigger !== 'settled' || !sameOwner(progress.previous.owner,scroll.owner) ||
        scroll.filterRevision !== progress.previous.filterRevision || !(scroll.offsetVp > 0) ||
        !positiveInt(scroll.itemIndex) || !oneNode(context.samples.scrolled,{id:`reader-source-row-${scroll.anchor}`,ancestors:[list]}))
      throw new EvidenceError('No settled and visibly anchored Source scroll before opening the child view');
  }
}

function sourceToolsHandoff(assertion, context, baseline, sample, action) {
  const depart = context.actions[assertion.departAction];
  const tools = context.samples[assertion.toolsSample];
  const entry = assertion.expected.entry ?? 'header';
  const nativeEntry = assertion.expected.entry !== undefined;
  const target = entry === 'footer' ? sourceFooterToolsButton : nativeEntry ? sourceHeaderToolsButton : {id:toolsHeader};
  if (depart?.op !== 'click' || depart.targetId !== target.id ||
      !pairedNativeEndpoint(depart,baseline,tools,assertion.baseline) ||
      !pairedNativeBack(action,tools,sample,assertion.toolsSample) ||
      [baseline,tools,sample].some(point => point.captureComplete !== true || point.window.keyboard?.visible !== false)) return undefined;
  const departures = eventsAt(context,depart,tools,'source.route');
  const returns = eventsAt(context,action,sample,'source.route');
  if (departures.length === 0) return undefined;
  const away = departures[0].payload;
  const home = returns[0]?.payload ?? null;
  const toolsVisible = Boolean(oneNode(tools,toolsBack) && !oneNode(tools,back));
  const stillInTools = toolsVisible && Boolean(oneNode(sample,toolsBack) && !oneNode(sample,back));
  if (!home && !stillInTools) return undefined;
  const routes = departures.length === 1 && returns.length === 1 &&
    away.action === 'tools' && away.from === 'source' && away.to === 'sourceTools' &&
    home.action === 'tools-back' && home.from === 'sourceTools' && home.to === 'source' &&
    count(away.previousGeneration) && positiveInt(away.generation) && positiveInt(home.generation) &&
    away.previousGeneration < away.generation && away.generation < home.generation &&
    sameOwner(away,{mounting:home.mounting,generation:home.previousGeneration});
  const groupReleased = [baseline,tools,sample].every(point =>
    !point.nodes.some(node => node.visible === true && (node.id === groupPanel || node.alias === groupPanel)));
  const origin = oneNode(baseline,target);
  const originUsable = nativeEntry ? origin?.type === 'Button' && origin.enabled === true && origin.clickable === true : Boolean(origin);
  const nativeEndpoints = Boolean(groupReleased && originUsable && toolsVisible &&
    oneNode(sample,back) && !oneNode(sample,toolsBack));
  return {depart,tools,away,home,routes,nativeEndpoints,entry,target,nativeEntry,refs:[depart,tools,...departures,...returns]};
}

function retainedRowDelta(beforeNode, afterNode) {
  const before = beforeNode?.rectPx?.top;
  const after = afterNode?.rectPx?.top;
  return Number.isFinite(before) && Number.isFinite(after) ? after - before : null;
}

function sourceV9ListHandoff(assertion, context, viewName) {
  const { actions, samples } = context;
  const groups = viewName === 'groups';
  const target = groups ? sourceHeaderToolsButton : sourceFooterToolsButton;
  const baseline = samples[assertion.baseline];
  const sample = samples[assertion.sample];
  const action = actions[assertion.action];
  const view = samples[assertion.toolsSample];
  const departure = actions[assertion.departAction];
  const origin = groups ? samples[assertion.entrySample] : baseline;
  const openMore = actions[assertion.openAction];
  const paneId = groups ? 'reader-source-v9-groups' : 'reader-source-v9-batch-dock';
  const departureTarget = groups ? 'reader-source-v9-open-groups' : target.id;
  if (departure?.op !== 'click' || departure.targetId !== departureTarget || departure.outcomeSettled !== true ||
      action?.outcomeSettled !== true || !pairedNativeEndpoint(departure,baseline,view,assertion.baseline) ||
      !pairedNativeBack(action,view,sample,assertion.toolsSample) ||
      ![origin,baseline,view,sample].every(point => point?.captureComplete === true &&
        point.window?.keyboard?.visible === false && sameWindowLayout(point,sample))) return undefined;
  if (groups && (openMore?.op !== 'click' || openMore.targetId !== target.id || openMore.outcomeSettled !== true ||
      !pairedNativeEndpoint(openMore,origin,baseline,assertion.entrySample))) return undefined;
  const enter = eventsAt(context,departure,view,'source.v9-list-transition');
  const leave = eventsAt(context,action,sample,'source.v9-list-transition');
  const routeChanges = eventsAt(context,groups ? openMore : departure,sample,'source.route');
  if (!enter.length && !oneNode(view,paneId)) return undefined;
  const previous = latestAt(context,origin,'source.projection');
  const current = latestAt(context,sample,'source.projection',payload=>payload.trigger === 'v9-return');
  const refs = [origin,baseline,view,sample,openMore,departure,action,previous,current,...enter,...leave,...routeChanges];
  const called = oneNode(origin,target);
  const returned = oneNode(sample,target);
  const transition = enter[0]?.payload;
  const terminal = leave[0]?.payload;
  const routeBound = enter.length === 1 && leave.length === 1 && routeChanges.length === 0 &&
    transition?.view === viewName && terminal?.view === viewName && transition.phase === 'enter' &&
    terminal.phase === 'return' && positiveInt(transition.revision) && transition.revision === terminal.revision &&
    sameOwner(transition.owner,terminal.owner);
  const canDispatch = node=>node?.type === 'Button' && node.clickable === true && node.enabled === true && fullyVisible(node);
  const nativeEntry = !groups || Boolean(oneNode(baseline,'reader-source-v9-more-menu') &&
    canDispatch(oneNode(baseline,{id:departureTarget,ancestors:['reader-source-v9-more-menu']})));
  const nativeId = groups ? /^source-back:[1-9]\d*:tools:header$/u : /^source-back:[1-9]\d*:tools:footer$/u;
  const nativeBound = Boolean(nativeEntry && oneNode(view,paneId) && !oneNode(sample,paneId) &&
    oneNode(sample,list) && canDispatch(called) && nativeId.test(called.id ?? '') && canDispatch(returned) &&
    returned.id === called.id && (!groups || !oneNode(view,list)));
  return {origin,view,departure,returned,transition,terminal,enter:enter[0],leave:leave[0],previous,current,
    routeBound,nativeBound,refs};
}

function sourceFilterRadioSelection(sample,target) {
  const carrier = measureSourceFilterCarrier(sample,target);
  if (!carrier.actual) return carrier;
  const {lane,carrierPath} = carrier.actual;
  const viewport = oneNode(sample,lane);
  const radios = sample.nodes.filter(node => node.type === 'Button' && node.visible === true && node.opacity > 0 &&
    rectPresent(node.visibleRectPx) && viewport?.path && node.path.startsWith(viewport.path + '/'));
  const selectedTarget = radios.find(node => node.path === carrierPath);
  const otherSelected = radios.filter(node => node !== selectedTarget && node.selected === true).length;
  const actual = {target,lane,carrierPath,selected:selectedTarget?.selected ?? null,otherSelected,visibleRadios:radios.length};
  if (selectedTarget && (selectedTarget.selected === false || otherSelected > 0)) {
    return {verdict:'FAIL',reason:'The native filter lane did not select only the accepted radio',actual};
  }
  if (!selectedTarget || radios.some(node => typeof node.selected !== 'boolean')) {
    return {verdict:'NOT_RUN',reason:'Native selected state is incomplete for the visible filter lane',actual};
  }
  return {verdict:'PASS',reason:'',actual};
}

function sourceCheck(assertion, context) {
  const { actions, samples } = context;
  const sample = samples[assertion.sample];
  const baseline = samples[assertion.baseline];
  const action = actions[assertion.action];
  const expected = assertion.expected;
  const refs = [...sample?.evidenceRefs ?? [], ...baseline?.evidenceRefs ?? [], ...action?.evidenceRefs ?? []];
  const report = (verdict, reason, actual = null, observation = [], observationsComplete = true) => ({
    verdict, reason, actual, expected, evidenceRefs: [...refs, ...observation.flatMap(event => event?.evidenceRefs ?? [])],
    ...(observationsComplete ? {} : {observationsComplete:false}),
  });
  const incomplete = reason => report('NOT_RUN', reason);
  const conclude = (okay, reason, actual, observation, complete = true) =>
    report(okay && !complete ? 'NOT_RUN' : okay ? 'PASS' : 'FAIL', reason, {...actual, sampleId:sample?.sampleId}, observation, complete);

  switch (assertion.kind) {
    case 'v9-list-return': {
      const handoff = sourceV9ListHandoff(assertion,context,expected.view);
      if (!handoff) return incomplete('Missing a current native child opening, System Back or complete same-layout Source samples');
      const {origin,view,departure,returned,transition,terminal,leave,previous,current,routeBound,nativeBound,refs:observations} = handoff;
      if (!routeBound || !nativeBound)
        return conclude(false,'The native child did not return to the same Source opening and original control',
          {view:expected.view,routeBound,nativeBound},observations);
      if (!settledFilterProjection(previous?.payload) || !settledFilterProjection(current?.payload) ||
          current.eventSeq <= leave.eventSeq)
        return incomplete('Missing the current retained catalogue projection');
      if (terminal.filterMatchesDeparture !== true || !sameOwner(transition.owner,previous.payload.owner) ||
          !sameFilterState(previous.payload,current.payload))
        return conclude(false,'The child round trip changed the Source opening or current filters',
          {before:previous.payload,after:current.payload},observations);
      if (expected.minimumProjected !== undefined) {
        const filters = sourceToolsFilterProgress(context,expected);
        if (filters.verdict !== 'PASS') return report(filters.verdict,filters.reason,{commits:filters.completed},filters.refs);
        if (!sameFilterState(filters.previous,previous.payload))
          return conclude(false,'The filtered group round trip changed the proven public query or another filter',
            {view:expected.view},[...observations,...filters.refs]);
      }
      if (expected.proof === 'focus') {
        if (typeof returned.focused !== 'boolean') return incomplete('The returned native button has no focus readback');
        return conclude(returned.focused,returned.focused ? '' : 'The original native button did not regain focus',
          {view:expected.view,focused:returned.focused},observations);
      }
      const prior = actions[assertion.priorAction];
      const filtered = samples[assertion.filteredSample];
      if (assertion.priorAction && (prior?.op !== 'swipe' || prior.targetId !== list || prior.outcomeSettled !== true ||
          !pairedNativeEndpoint(prior,filtered,origin,assertion.filteredSample) || !sameWindowLayout(filtered,origin)))
        return incomplete('Missing the native catalogue swipe before Group management');
      const scrolled = prior ? eventsAt(context,prior,origin,'source.scroll').findLast(event=>event.payload.trigger === 'settled') :
        latestAt(context,origin,'source.scroll',payload=>payload.trigger === 'settled');
      const saved = eventsAt(context,departure,view,'source.scroll').findLast(event=>event.payload.trigger === 'v9-list-enter');
      const restored = eventsAt(context,action,sample,'source.scroll').findLast(event=>event.payload.trigger === 'v9-list-return');
      if (!scrolled || !saved || !restored) return incomplete('Missing retained native scroll measurements');
      const a = saved.payload, b = restored.payload;
      const anchor = {id:`reader-source-row-${a.anchor}`,ancestors:[list]};
      const beforeRow = oneNode(origin,anchor);
      const afterRow = oneNode(sample,anchor);
      const density = sample.window.density;
      if (!(density > 0) || !positiveInt(a.anchor) || !positiveInt(a.itemIndex) || !(a.offsetVp > 0) ||
          !rectPresent(beforeRow?.visibleRectPx) || b.layoutMatchesSaved !== true ||
          a.viewportWidthVp !== b.viewportWidthVp || a.viewportHeightVp !== b.viewportHeightVp)
        return incomplete('The selected fixture lacks a visibly anchored scroll in the same list layout');
      const delta = retainedRowDelta(beforeRow,afterRow);
      const positionMatches = (left,right) => left.anchor === right.anchor && left.itemIndex === right.itemIndex &&
        left.lastAnchor === right.lastAnchor && Math.abs(left.itemYVp - right.itemYVp) * density <= expected.tolerancePx &&
        Math.abs(left.offsetVp - right.offsetVp) * density <= expected.tolerancePx;
      const valid = [a,b,scrolled.payload].every(value=>sameOwner(value.owner,transition.owner) &&
        value.filterRevision === previous.payload.filterRevision) && b.filterMatchesSaved === true &&
        positionMatches(scrolled.payload,a) && positionMatches(a,b) && delta !== null && Math.abs(delta) <= expected.tolerancePx;
      return conclude(valid,valid ? '' : 'The same-opening Source row anchor or offset changed on return',
        {view:expected.view,saved:a,restored:b,nativeAnchorDeltaPx:delta},[...observations,prior,filtered,scrolled,saved,restored]);
    }
    case 'route-parent-after-v9-groups': {
      const controls = sourceParentControls[expected.parent];
      const parent = samples[assertion.parentSample];
      const initial = samples[assertion.entrySample];
      const enter = actions[assertion.entryAction];
      const handoff = sourceV9ListHandoff({...assertion, baseline:assertion.menuSample,
        sample:assertion.baseline, action:assertion.returnAction},context,'groups');
      if (!handoff || enter?.op !== 'click' || enter.targetId !== controls.entry || enter.outcomeSettled !== true ||
          action?.outcomeSettled !== true || !pairedNativeEndpoint(enter,parent,initial,assertion.parentSample) ||
          !pairedNativeBack(action,baseline,sample,assertion.baseline) ||
          ![parent,sample].every(point=>point.captureComplete === true && point.window.keyboard?.visible === false))
        return incomplete('Missing the native parent entry or final System Back from the returned v9 list');
      const openings = eventsAt(context,enter,initial,'source.route');
      const closings = eventsAt(context,action,sample,'source.route');
      const open = openings[0]?.payload;
      const close = closings[0]?.payload;
      const {previous,current,transition,terminal,leave,routeBound,nativeBound,refs:handoffRefs} = handoff;
      const observations = [parent,initial,enter,...openings,...closings,...handoffRefs];
      const actual = {opened:open,groups:transition,restoredSource:terminal,closed:close};
      if (!open || (!close && !oneNode(sample,back))) return incomplete('Missing the parent owner route before or after the v9 visit');
      const routes = routeBound && openings.length === 1 && closings.length === 1 &&
        open.action === 'open' && open.from === expected.parent && open.to === 'source' &&
        count(open.previousGeneration) && open.previousGeneration < open.generation && sameOwner(open,transition.owner) &&
        close.action === 'close' && close.from === 'source' && close.to === expected.parent &&
        close.previousGeneration === open.generation && open.generation < close.generation &&
        open.mounting === close.mounting;
      const native = nativeBound && Boolean(oneNode(parent,controls.entry) && oneNode(initial,back) &&
        oneNode(baseline,back) && oneNode(sample,controls.returned) && !oneNode(sample,list) &&
        !oneNode(sample,back) && !oneNode(sample,'reader-source-v9-groups'));
      if (!routes || !native) return conclude(false,'The group visit lost the original Source opening or its captured parent',actual,observations);
      const emptyCatalogue = fact => fact?.state === 'empty' && fact.readFact === 'current' &&
        positiveInt(fact.readGeneration) && fact.count === 0 && fact.projected === 0 && defaultSourceFilters(fact);
      if (!previous || !current || previous.eventSeq <= openings[0].eventSeq || current.eventSeq <= leave.eventSeq)
        return incomplete('Missing the initial or returned empty Source projection');
      const bound = [previous,current].every(event=>emptyCatalogue(event.payload) && sameOwner(event.payload.owner,open)) &&
        terminal.filterMatchesDeparture === true && previous.payload.readGeneration === current.payload.readGeneration &&
        previous.payload.filterRevision === current.payload.filterRevision;
      return conclude(bound,bound ? '' : 'The empty catalogue or same-opening projection changed during Group management',actual,observations);
    }
    case 'route-parent-after-tools': {
      const controls = sourceParentControls[expected.parent];
      const parent = samples[assertion.parentSample];
      const entered = samples[assertion.entrySample];
      const enter = actions[assertion.entryAction];
      const resume = actions[assertion.returnAction];
      const handoff = sourceToolsHandoff({...assertion,baseline:assertion.entrySample},context,entered,baseline,resume);
      if (!handoff || enter?.op !== 'click' || enter.targetId !== controls.entry ||
          !pairedNativeEndpoint(enter,parent,entered,assertion.parentSample) ||
          !pairedNativeBack(action,baseline,sample,assertion.baseline) ||
          parent.captureComplete !== true || sample.captureComplete !== true ||
          parent.window.keyboard?.visible !== false || sample.window.keyboard?.visible !== false)
        return incomplete('Missing a verified parent entry or system Back on the returned Source opening');
      const openings = eventsAt(context,enter,entered,'source.route');
      const closings = eventsAt(context,action,sample,'source.route');
      const open = openings[0]?.payload;
      const close = closings[0]?.payload ?? null;
      if (!open || (!close && !oneNode(sample,back)))
        return incomplete('No current owner route proof for the original entry and final Back');
      const before = latestAt(context,entered,'source.projection');
      const after = latestAt(context,baseline,'source.projection');
      const {away,home} = handoff;
      const refs = [parent,entered,enter,resume,...handoff.refs,...openings,...closings,before,after];
      const actual = {opened:open,tools:away,restoredSource:home,closed:close};
      const routes = handoff.routes && openings.length === 1 && closings.length === 1 &&
        open.action === 'open' && open.from === expected.parent && open.to === 'source' &&
        count(open.previousGeneration) && open.previousGeneration < open.generation &&
        sameOwner(open,{mounting:away.mounting,generation:away.previousGeneration}) &&
        close.action === 'close' && close.from === 'source' && close.to === expected.parent &&
        positiveInt(close.generation) && home.generation < close.generation &&
        sameOwner(home,{mounting:close.mounting,generation:close.previousGeneration});
      const native = handoff.nativeEndpoints && Boolean(oneNode(parent,controls.entry) &&
        oneNode(sample,controls.returned) && !oneNode(sample,back) && !oneNode(sample,toolsBack));
      if (!routes || !native)
        return conclude(false,'Source Tools round trip did not release the current opening to its captured parent',actual,refs);
      if (!before || !after || before.eventSeq <= enter.beforeSeq || after.eventSeq <= resume.beforeSeq)
        return incomplete('Missing the Source projection from the initial or freshly returned opening');
      const sameOpenings = sameOwner(before.payload.owner,open) && sameOwner(after.payload.owner,home);
      return conclude(sameOpenings,sameOpenings ? '' : 'The native Source endpoints belong to a different opening',actual,refs);
    }
    case 'route': {
      if (!sample || !action) return incomplete('The normal route action or sample is missing');
      const directBack = Boolean(assertion.baseline);
      const projection = directBack ? latestAt(context, baseline, 'source.projection') : undefined;
      const opening = directBack ? eventsAt(context, actions[assertion.entryAction], baseline, 'source.route') : [];
      if (directBack && (!pairedNativeBack(action,baseline,sample,assertion.baseline) || !projection ||
          opening.length === 0 || baseline.window.keyboard?.visible !== false ||
          !oneNode(baseline, back) || oneNode(baseline, groupPanel)))
        return incomplete('Missing a normal route Back from the unobstructed source opening');
      const events = eventsAt(context, action, sample, 'source.route');
      if (events.length === 0) {
        const current = directBack && latestAt(context, sample, 'source.projection');
        if (current && sample.window.keyboard?.visible === false && oneNode(sample, back) &&
            !oneNode(sample, expected.anchor) && sameOwner(projection.payload.owner,current.payload.owner)) {
          return conclude(false, 'Back left the same source opening on screen', {
            owner:current.payload.owner, routeAcceptances:0,
          }, [...opening,projection,current]);
        }
        return incomplete('No admitted source route event after the native action');
      }
      const accepted = events[0].payload;
      const actual = {...accepted, routeAcceptances:events.length};
      const node = oneNode(sample, expected.anchor);
      if (!node && !directBack) return incomplete('The target route has no native anchor');
      const entry = opening[0]?.payload;
      const sameOpening = !directBack || (opening.length === 1 && entry.action === 'open' &&
        entry.from === expected.to && entry.to === expected.from && sameOwner(entry,projection.payload.owner) &&
        sameOwner(projection.payload.owner,{generation:accepted.previousGeneration,mounting:accepted.mounting}));
      const sourceReleased = !directBack || (!oneNode(sample, back) && !oneNode(sample, groupPanel));
      const valid = events.length === 1 && accepted.action === expected.action && accepted.from === expected.from &&
        accepted.to === expected.to && positiveInt(accepted.generation) && count(accepted.previousGeneration) &&
        accepted.generation > accepted.previousGeneration && count(accepted.mounting) && sameOpening && sourceReleased && Boolean(node);
      const deviation = directBack ? 'The accepted route, native endpoint, opening or action cardinality differs' :
        'The accepted route, navigation generation or action cardinality differs';
      return conclude(valid, valid ? '' : deviation,
        directBack ? {...actual, sameOpening, sourceReleased, nativeDestination:Boolean(node)} : actual,
        directBack ? [...opening,projection,...events] : events);
    }
    case 'filtered-empty': {
      if (!baseline || !action || !sample) return incomplete('Missing the normal initial, edit, or zero-match sample');
      const initialEvent = latestAt(context, baseline, 'source.projection');
      const editSample = samples[assertion.editSample];
      const editEvent = eventsAt(context, action, editSample, 'source.projection').findLast(event => event.payload.trigger === 'edit');
      const afterEvent = latestAt(context, sample, 'source.projection');
      const initial = initialEvent?.payload;
      const edited = editEvent?.payload;
      const after = afterEvent?.payload;
      if (!initial || !edited || !after || !positiveInt(action.inputLength) || !fullSample(baseline) || !fullSample(sample))
        return incomplete('Missing full native samples or the underlying source projection');
      const route = latestAt(context, baseline, 'source.route', value => value.action === 'open' && value.from === 'settings' && value.to === 'source');
      if (!route) return incomplete('The initial projection is missing the normal source-entry route');
      const nativeEmpty = Boolean(oneNode(sample, empty));
      const nativeClear = fullyVisible(oneNode(sample, clear));
      const evidence = [route, initialEvent, editEvent, afterEvent, ...editSample.evidenceRefs.map(reference => ({evidenceRefs:[reference]}))];
      const actual = {initial, edited, after, nativeEmpty, nativeClear, initialSampleId:baseline.sampleId, editSampleId:editSample.sampleId};
      const valid = sameOwner(route.payload, initial.owner) && sameOwner(initial.owner, edited.owner) && sameOwner(edited.owner, after.owner) &&
        initial.count > 0 && initial.projected > 0 && initial.state === 'rows' && initial.readFact === 'current' &&
        after.count === initial.count && positiveInt(after.readGeneration) && after.readGeneration === initial.readGeneration &&
        edited.filterRevision > initial.filterRevision && after.filterRevision === edited.filterRevision &&
        after.state === 'filteredEmpty' && after.readFact === 'current' && after.projected === 0 &&
        edited.queryLength === action.inputLength && after.queryLength === edited.queryLength && nativeEmpty && nativeClear &&
        sample.window.keyboard?.visible === false && editSample.window.keyboard?.visible === true;
      return conclude(valid, valid ? '' : 'The native zero-match surface or its settled nonempty source-owner facts differ', actual, evidence);
    }
    case sourceFilterClearKind: {
      const origin = sourceReadObservation({action:'open-sources',sample:'source-ready',expected:{state:'rows'}},context);
      if (!origin?.sample || !pairedNativeEndpoint(action,baseline,sample,assertion.baseline) ||
          !sameWindowLayout(baseline,sample) || action.op !== 'click' || action.targetId !== sourceFilterClearTarget ||
          action.outcomeSettled === false || [origin.sample,baseline,sample].some(point =>
            point.captureComplete !== true || point.window?.source !== 'window-metrics' || point.window.keyboard?.visible !== false) ||
          origin.sample.instanceId !== baseline.instanceId || origin.sample.window.id !== baseline.window.id)
        return incomplete('Missing the normal source opening and paired full Clear Filters touch samples');
      const ready = origin.current.payload;
      const priorEvent = latestAt(context,baseline,'source.projection');
      const prior = priorEvent?.payload;
      const defaults = point => point.allGroups === true && Object.entries(sourceFilterDefaults).every(([key,value])=>point[key] === value);
      const sameCollection = point => settledFilterProjection(point) && sameOwner(ready.owner,point.owner) &&
        ready.count === point.count && ready.readGeneration === point.readGeneration;
      if (!settledFilterProjection(ready) || !defaults(ready) || ready.projected !== ready.count ||
          !positiveInt(ready.firstAnchor) || !sameCollection(prior) || prior.state !== 'filteredEmpty' ||
          priorEvent.eventSeq <= origin.sample.beforeSeq ||
          prior.filterRevision <= ready.filterRevision ||
          prior.queryLength !== sourceFilterClearQuery.length ||
          sourceFilterKeys.some(key=>key !== 'queryLength' && prior[key] !== ready[key]) ||
          latestAt(context,{...baseline,beforeSeq:action.beforeSeq},'source.projection') !== priorEvent)
        return incomplete('No current query-only zero-match projection for the original public collection');
      let measured;
      try { measured = sourceFilterClearPoint(baseline); }
      catch (error) {
        if (!(error instanceof EvidenceError)) throw error;
        return incomplete(error.message);
      }
      const {bounds,carrierPath,point} = measured;
      const touch = action.edgeTap;
      if (touch?.edge !== 'top' || !positiveInt(touch.probeSeq) || point.x !== touch.x || point.y !== touch.y)
        return incomplete('No verified native command at the upper edge of the current Clear Filters Button');
      const accepted = eventsAt(context,action,sample,'source.projection').filter(event=>event.payload.trigger === 'clear');
      const final = latestAt(context,sample,'source.projection');
      const changes = eventsAt(context,{...action,beforeSeq:origin.sample.beforeSeq},sample,'source.route');
      const observations = [origin.sample,origin.entry,origin.current,priorEvent,...accepted,final,...changes];
      const stillFiltered = sample.nodes.some(node=>node.source === 'native-tree' && node.visible === true &&
        (node.id === empty || node.alias === empty));
      if (changes.length || stillFiltered)
        return conclude(false,'The verified upper-edge click did not clear the filters within the same Source opening',null,observations);
      const reset = sourceCheck({...assertion,kind:'clear-filters'},context);
      if (reset.verdict !== 'PASS') return {...reset,evidenceRefs:[...reset.evidenceRefs,...observations.flatMap(x=>x?.evidenceRefs ?? [])]};
      const exact = [accepted[0]?.payload,final?.payload].every(value=>sameCollection(value) && defaults(value) &&
        value.state === 'rows' && value.projected === ready.count && value.firstAnchor === ready.firstAnchor);
      if (!exact)
        return conclude(false,'Clear Filters did not restore the original native catalogue and first row',reset.actual,observations);
      const dispatch = {x:touch.x,y:touch.y,probeSeq:touch.probeSeq};
      return conclude(true,'',{...reset.actual,nativeInteraction:{subject:'filter-empty-clear',target:sourceFilterClearTarget,
        carrierPath,bounds,visible:true,enabled:true,clipped:false,position:'top',accepted:true,
        actionId:assertion.action,baselineSampleId:assertion.baseline,dispatch}},observations);
    }
    case 'clear-filters':
    case 'combined-filter-reset': {
      const progress = expected.capturedCatalogue === true ?
        combinedFilterProgress(context,combinedActionPlans.length,expected) : undefined;
      if (progress && progress.verdict !== 'PASS') {
        return report(progress.verdict,progress.reason,progress.actual,progress.refs,progress.verdict === 'FAIL');
      }
      if (!sample || !baseline || !action || !fullSample(baseline) || !fullSample(sample))
        return incomplete('Missing complete zero-match or reset samples');
      const beforeEvent = latestAt(context, baseline, 'source.projection');
      const clearEvents = eventsAt(context, action, sample, 'source.projection').filter(event => event.payload.trigger === 'clear');
      const combined = assertion.kind === 'combined-filter-reset';
      const afterEvent = latestAt(context, sample, 'source.projection');
      if (combined) {
        const initialSample = samples[assertion.entrySample];
        const filteredSample = samples[assertion.filteredSample];
        const initialEvent = latestAt(context,initialSample,'source.projection');
        const filteredEvent = latestAt(context,filteredSample,'source.projection');
        if (action.op !== 'click' || action.targetId !== clear ||
            !pairedNativeEndpoint(action,baseline,sample,assertion.baseline) ||
            ![initialSample,filteredSample,baseline,sample].every(point => fullSample(point) &&
              point.captureComplete === true && point.instanceId === sample.instanceId &&
              point.window.id === sample.window.id && point.window.keyboard?.visible === false) ||
            !(initialSample.beforeSeq < filteredSample.beforeSeq && filteredSample.beforeSeq < baseline.beforeSeq)) {
          return incomplete('Missing the complete source captures and native Clear Filters command in one opening');
        }
        const initial = initialEvent?.payload;
        const filtered = filteredEvent?.payload;
        const before = beforeEvent?.payload;
        const after = afterEvent?.payload;
        if (![initial,filtered,before,after].every(settledFilterProjection)) {
          return incomplete('Missing a current source projection at one of the combined reset endpoints');
        }
        const clearButton = oneNode(baseline,{id:clear,ancestors:[empty]});
        const nativeClear = clearButton?.type === 'Button' && clearButton.clickable === true &&
          clearButton.enabled === true && fullyVisible(clearButton);
        const nativeFirstRow = progress ? scopedSourceFirstRow(sample,after.firstAnchor) : positiveInt(after.firstAnchor) &&
          fullyVisible(oneNode(sample,'reader-source-row-' + after.firstAnchor));
        const actual = {initial,filtered,before,after,nativeClear,nativeFirstRow,clearAcceptances:clearEvents.length};
        const observations = [initialSample,filteredSample,initialEvent,filteredEvent,beforeEvent,...clearEvents,afterEvent];
        const defaults = progress ? defaultSourceFilters :
          point => Object.entries(sourceFilterDefaults).every(([key,value]) => point[key] === value);
        const matchesActive = point => point.status === expected.status && point.category === expected.category &&
          point.groupIndex === expected.groupIndex && point.allGroups === false;
        const catalogueCount = progress ? progress.actual.initial.count : expected.count;
        const projectedBeforeEdit = progress ? progress.actual.completed[2].projected : expected.projectedBeforeEdit;
        const validBefore = defaults(initial) && initial.projected === catalogueCount &&
          [filtered,before,after].every(point => sameOwner(initial.owner,point.owner) &&
            point.readGeneration === initial.readGeneration && point.count === catalogueCount) &&
          initial.count === catalogueCount && filtered.filterRevision > initial.filterRevision &&
          before.filterRevision > filtered.filterRevision && expected.status !== 'all' && expected.category !== 'all' &&
          positiveInt(expected.groupIndex) && positiveInt(expected.queryLength) &&
          matchesActive(filtered) && filtered.queryLength === 0 && filtered.projected === projectedBeforeEdit &&
          matchesActive(before) && before.queryLength === expected.queryLength && before.projected === 0;
        if (!validBefore || !nativeClear || !oneNode(baseline,empty)) {
          return conclude(false,'The current native clear action did not start from all four active filters and a zero projection',actual,observations);
        }
        const accepted = clearEvents[0]?.payload;
        const validAfter = clearEvents.length === 1 && settledFilterProjection(accepted) && sameOwner(accepted.owner,after.owner) &&
          accepted.filterRevision === after.filterRevision && after.filterRevision > before.filterRevision &&
          defaults(accepted) && defaults(after) && accepted.count === after.count &&
          accepted.readGeneration === after.readGeneration && accepted.projected === after.projected &&
          after.projected === after.count &&
          after.firstAnchor === initial.firstAnchor && nativeFirstRow && !oneNode(sample,empty);
        const nativeInteraction = validAfter && sourceNativeCenterInteraction(assertion,baseline,action);
        if (progress) {
          const route = eventsAt(context,action,sample,'source.route');
          const projections = eventsAt(context,action,sample,'source.projection');
          const sameOpening = sameFilterState(progress.actual.previous,before) && route.length === 0 &&
            projections.every(event=>sameFilterState(after,event.payload));
          const checked = validAfter && Boolean(nativeInteraction) && sameOpening &&
            action.outcomeSettled === true && clearEvents[0].eventSeq <= action.afterSeq;
          return conclude(checked,checked ? '' : 'Native Clear did not restore the captured catalogue and four defaults exactly once',
            {...actual,completed:progress.actual.completed,...(nativeInteraction ? {nativeInteraction} : {})},
            [...observations,...progress.refs,...route,...projections]);
        }
        if (nativeInteraction) actual.nativeInteraction = nativeInteraction;
        return conclude(validAfter,
          validAfter ? '' : 'Native Clear Filters did not restore the same unfiltered collection exactly once',actual,observations);
      }
      if (!beforeEvent || clearEvents.length === 0) return incomplete('No verified initial projection or owner clear action');
      const before = beforeEvent.payload;
      const after = afterEvent?.payload;
      if (!after) return incomplete('No committed source-list projection after clear');
      const row = positiveInt(after.firstAnchor) && fullyVisible(oneNode(sample, 'reader-source-row-' + after.firstAnchor));
      const actual = {before, after, nativeFirstRow:row, clearAcceptances:clearEvents.length, emptySampleId:baseline.sampleId};
      const valid = sameOwner(before.owner, after.owner) && sameOwner(clearEvents[0].payload.owner, after.owner) &&
        clearEvents.length === 1 && clearEvents[0].payload.filterRevision === after.filterRevision &&
        before.state === 'filteredEmpty' && before.projected === 0 && before.count > 0 && after.filterRevision > before.filterRevision &&
        before.readFact === 'current' && after.readFact === 'current' && after.readGeneration === before.readGeneration &&
        after.state === 'rows' && after.count === before.count && after.projected === after.count &&
        after.queryLength === 0 && after.status === 'all' && after.category === 'all' && after.allGroups === true &&
        Boolean(oneNode(baseline, empty)) && fullyVisible(oneNode(baseline, clear)) && !oneNode(sample, empty) && row;
      return conclude(valid, valid ? '' : 'Clear did not restore the current owner’s unfiltered native collection exactly once', actual,
        [beforeEvent, ...clearEvents, afterEvent]);
    }
    case 'footer-end': {
      if (!sample || !action) return incomplete('Missing end-of-list action or native sample');
      const projection = latestAt(context,sample,'source.projection');
      let event;
      const contextRefs = [];
      const freshEnd = expected.requireFreshEnd === true;
      if (freshEnd) {
        const origin = samples[action.from];
        const before = latestAt(context,origin,'source.projection');
        if (action.op !== 'swipe' || action.targetId !== list || !origin || !fullSample(sample) ||
            sample.captureComplete !== true || action.instanceId !== sample.instanceId || !sameWindowLayout(origin,sample) ||
            oneNode(origin,list)?.type !== 'List' ||
            ![origin.afterSeq,action.beforeSeq,action.afterSeq,sample.beforeSeq].every(Number.isSafeInteger) ||
            origin.afterSeq > action.beforeSeq || action.beforeSeq >= action.afterSeq || action.afterSeq > sample.beforeSeq ||
            ![origin.hostEndMs,action.hostBeginMs,action.hostEndMs,sample.hostBeginMs].every(Number.isFinite) ||
            origin.hostEndMs > action.hostBeginMs || action.hostBeginMs > action.hostEndMs || action.hostEndMs > sample.hostBeginMs) {
          return incomplete('Missing the final native List swipe and its ordered locator and result window');
        }
        contextRefs.push(origin,before,projection);
        const routes = eventsAt(context,action,sample,'source.route');
        if (routes.length) return conclude(false,'The final List swipe changed the Source route',{routeEvents:routes.length},routes);
        event = eventsAt(context,action,sample,'source.scroll').findLast(item => item.payload.trigger === 'settled');
        if (!event || !before || !projection ||
            ![before.payload,projection.payload,event.payload].every(fact =>
              positiveInt(fact.owner?.generation) && count(fact.owner?.mounting) && count(fact.filterRevision)) ||
            typeof event.payload.atEnd !== 'boolean') {
          return incomplete('No fresh settled List end fact belongs to the final native swipe');
        }
        const sameListOwner = sameOwner(before.payload.owner,projection.payload.owner) &&
          sameOwner(event.payload.owner,projection.payload.owner) && before.payload.filterRevision === projection.payload.filterRevision &&
          event.payload.filterRevision === projection.payload.filterRevision;
        if (!sameListOwner || !event.payload.atEnd) {
          return conclude(false,'The final native swipe did not settle at the end of the same current filtered list',
            {end:event.payload,settledSeq:event.eventSeq},[event,...contextRefs]);
        }
      } else {
        event = latestAt(context,sample,'source.scroll', facts => sameOwner(facts.owner,projection?.payload.owner) &&
          facts.filterRevision === projection.payload.filterRevision);
      }
      if (!event || !positiveInt(event.payload.lastAnchor) || event.payload.atEnd !== true ||
          action.instanceId !== sample.instanceId)
        return incomplete('The regular source List owner did not confirm its end and last row');
      const rowId = 'reader-source-row-' + event.payload.lastAnchor;
      const row = freshEnd ? {id:rowId,ancestors:[list]} : rowId;
      if (freshEnd) {
        const viewport = oneNode(sample,list);
        const visibleRow = oneNode(sample,rowId);
        if (viewport?.type !== 'List' || !rectPresent(viewport.visibleRectPx) || !visibleRow) {
          return incomplete('The current native List or its unique visible last row is not observed');
        }
        if (!oneNode(sample,row)) {
          return conclude(false,'The observed last row is outside the current native List',
            {end:event.payload,settledSeq:event.eventSeq,listPath:viewport.path,rowPath:visibleRow.path},[event,...contextRefs]);
        }
      }
      const base = {sample:assertion.sample, a:row, acceptedSources:assertion.acceptedSources};
      const overlap = evaluateLayout({...base, b:footer, kind:'nonOverlap', expected:{maxOverlapAreaVp2:0}}, samples);
      const visible = evaluateLayout({...base, kind:'visibleFraction', expected:{minFraction:1}, basis:'rectangular'}, samples);
      const actual = {end:event.payload, overlap:overlap.actual, visible:visible.actual,
        ...(freshEnd ? {settledSeq:event.eventSeq} : {})};
      if ([overlap, visible].some(item => item.verdict === 'FAIL')) return conclude(false,
        'The last row overlaps the fixed footer or is clipped at the verified list end', actual, [event,...contextRefs],
        overlap.verdict !== 'NOT_RUN' && visible.verdict !== 'NOT_RUN');
      if ([overlap, visible].some(item => item.verdict === 'NOT_RUN')) return incomplete('A required last-row or footer box is unavailable');
      return conclude(true, '', actual, [event,...contextRefs]);
    }
    case 'compensation': {
      if (!sample) return incomplete('The native initial source page is missing');
      const event = latestAt(context, sample, 'source.geometry');
      const listNode = oneNode(sample, list);
      const firstNode = oneNode(sample, filterBlock);
      const footerNode = oneNode(sample, footer);
      if (!event || !listNode?.rectPx || !firstNode?.rectPx || !footerNode?.rectPx || !fullSample(sample))
        return incomplete('Native viewport, filter/foot boxes, or the production compensation are unavailable');
      const geometry = event.payload;
      const actual = {
        nativeListStartInsetVp: (firstNode.rectPx.top - listNode.rectPx.top) / sample.window.density,
        nativeFooterHeightVp: footerNode.rectPx.height / sample.window.density,
        geometry,
      };
      const px = 1 / sample.window.density;
      const valid = geometry.headerHeightVp > 0 && geometry.footerHeightVp > 0 &&
        geometry.listStartInsetVp > 0 && geometry.listEndInsetVp > 0 &&
        Math.abs(actual.nativeListStartInsetVp - geometry.listStartInsetVp) <= px &&
        Math.abs(actual.nativeFooterHeightVp - geometry.listEndInsetVp) <= px;
      return conclude(valid, valid ? '' : 'Native start/footer geometry differs from the actual List offsets', actual, [event]);
    }
    case 'fixed-insets': {
      const moving = samples[assertion.movingSample];
      const startFrame = readSourceInsetsFrame(context,baseline);
      const movedFrame = readSourceInsetsFrame(context,moving);
      const tailFrame = readSourceInsetsFrame(context,sample);
      const restored = expected.v9GroupRoundTrip === true ? samples[assertion.restoreSample] : undefined;
      const restoredFrame = restored ? readSourceInsetsFrame(context,restored) : undefined;
      const checks = {};
      const extra = [];
      if (moving) extra.push({evidenceRefs:moving.evidenceRefs});
      const state = [startFrame,movedFrame,restoredFrame,tailFrame].filter(Boolean);
      const near = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= expected.tolerancePx;
      for (const frame of state) {
        const {header,dock,viewport,geometry,density} = frame;
        const owner = geometry.payload;
        const current = checks[frame.sample.sampleId] = {
          headerPx:header, footerPx:dock, listPx:viewport, declaredStartInsetVp:owner.listStartInsetVp,
          declaredEndInsetVp:owner.listEndInsetVp, problems:[],
        };
        extra.push(geometry,frame.projection);
        if (bottom(header) > dock.top) current.problems.push('fixed-carrier-overlap');
        if (!near(header.left,viewport.left) || !near(header.width,viewport.width) ||
            !near(header.height, owner.headerHeightVp * density) ||
            !near(header.top - viewport.top, owner.headerTopVp * density) ||
            !near(bottom(header) - viewport.top, owner.listStartInsetVp * density)) {
          current.problems.push('fixed-header-envelope');
        }
        if (!near(dock.left,viewport.left) || !near(dock.width,viewport.width) ||
            !near(dock.height, owner.footerHeightVp * density) ||
            !near(dock.top - viewport.top, owner.footerTopVp * density) ||
            !near(bottom(viewport) - dock.top, owner.listEndInsetVp * density)) {
          current.problems.push('fixed-footer-envelope');
        }
      }
      const startBlock = oneNode(baseline,filterBlock)?.rectPx;
      const movedBlock = oneNode(moving,filterBlock,true)?.rectPx;
      const first = rectPresent(startBlock) && startFrame ? checks[baseline.sampleId] : undefined;
      if (first) {
        first.nativeStartGapPx = startBlock.top - startFrame.viewport.top;
        if (!near(startBlock.top,bottom(startFrame.header)) ||
            !near(first.nativeStartGapPx,startFrame.geometry.payload.listStartInsetVp * startFrame.density)) {
          first.problems.push('native-list-start-inset');
        }
      }
      const sameViewport = (a,b) => a?.sample.instanceId === b?.sample.instanceId &&
        a?.sample.window.id === b?.sample.window.id && a?.density === b?.density &&
        rectFields.every(key => near(a?.viewport[key],b?.viewport[key]));
      if (startFrame && restoredFrame && tailFrame) for (const frame of [restoredFrame,tailFrame]) {
        if (!['header','dock'].every(key=>rectFields.every(field=>near(startFrame[key][field],frame[key][field]))))
          checks[frame.sample.sampleId].problems.push('fixed-carriers-across-group-return');
      }
      const motionEvent = eventsAt(context,action,moving,'source.scroll').findLast(event =>
        event.payload.trigger === 'settled' && sameOwner(event.payload.owner,movedFrame?.projection.payload.owner) &&
        event.payload.filterRevision === movedFrame.projection.payload.filterRevision);
      const motion = first && movedFrame && rectPresent(movedBlock) && sameViewport(startFrame,movedFrame) &&
        sameOwner(startFrame.projection.payload.owner,movedFrame.projection.payload.owner) &&
        motionEvent?.eventSeq > baseline.beforeSeq ? checks[moving.sampleId] : undefined;
      if (motion) {
        extra.push(motionEvent);
        motion.filterDeltaPx = movedBlock.top - startBlock.top;
        if (motion.filterDeltaPx >= 0 || !['header','dock'].every(key =>
          rectFields.every(field => near(startFrame[key][field],movedFrame[key][field])))) {
          motion.problems.push('fixed-carriers-while-list-scrolls');
        }
      }
      const sameTail = event=>sameOwner(event.owner,tailFrame?.projection.payload.owner) &&
        event.filterRevision === tailFrame.projection.payload.filterRevision;
      const tailAction = actions[assertion.tailAction];
      const end = expected.v9GroupRoundTrip === true ?
        eventsAt(context,tailAction,sample,'source.scroll').findLast(event=>event.payload.trigger === 'settled' && sameTail(event.payload)) :
        latestAt(context,sample,'source.scroll',sameTail);
      const lastItem = end?.payload.atEnd === true && positiveInt(end.payload.lastAnchor) ?
        oneNode(sample,'reader-source-row-' + end.payload.lastAnchor,true) : undefined;
      const tail = tailFrame && rectPresent(lastItem?.rectPx) ? checks[sample.sampleId] : undefined;
      if (tail) {
        extra.push(end);
        tail.nativeEndGapPx = bottom(tailFrame.viewport) - bottom(lastItem.rectPx);
        if (!near(tail.nativeEndGapPx,tailFrame.geometry.payload.listEndInsetVp * tailFrame.density) ||
            !near(bottom(lastItem.rectPx),tailFrame.dock.top) || !fullyVisible(lastItem)) {
          tail.problems.push('native-list-end-inset');
        }
      }
      const opening = startFrame?.projection.payload.owner;
      const tailOpening = tailFrame?.projection.payload.owner;
      let tailContinuity = sameOwner(opening,tailOpening);
      if (expected.v9GroupRoundTrip === true) {
        const handoff = sourceV9ListHandoff({...assertion, baseline:assertion.menuSample,
          sample:assertion.restoreSample,action:assertion.returnAction},context,'groups');
        if (handoff) extra.push(...handoff.refs);
        const tailOrigin = samples[tailAction?.from];
        const rearm = actions['scroll-away-from-tail'];
        const rearmOrigin = samples[rearm?.from];
        const armed = eventsAt(context,rearm,tailOrigin,'source.scroll').findLast(event=>event.payload.trigger === 'settled');
        // The final locator is deliberately tree-only. Its invoking action and
        // fresh full tail capture are paired by the required footer-end check.
        tailContinuity = Boolean(tailContinuity && handoff?.routeBound && handoff?.nativeBound &&
          handoff.terminal.filterMatchesDeparture === true && sameOwner(opening,handoff.transition.owner) &&
          motionEvent?.eventSeq < handoff.enter.eventSeq && restoredFrame && sameViewport(startFrame,restoredFrame) &&
          handoff.current?.eventSeq > handoff.leave.eventSeq &&
          sameFilterState(handoff.previous?.payload,handoff.current.payload) &&
          sameFilterState(handoff.current.payload,tailFrame?.projection.payload) &&
          tailAction?.op === 'swipe' && tailAction.targetId === list && tailAction.outcomeSettled === true &&
          sameWindowLayout(tailOrigin,sample) && restored.afterSeq < tailAction.beforeSeq &&
          rearm?.op === 'swipe' && rearm.targetId === list && rearm.outcomeSettled === true &&
          sameWindowLayout(rearmOrigin,tailOrigin) && oneNode(rearmOrigin,list)?.type === 'List' &&
          rearmOrigin.afterSeq <= rearm.beforeSeq && rearm.afterSeq <= tailOrigin.beforeSeq &&
          armed?.payload.atEnd === false && sameTail(armed.payload) &&
          handoff.leave.eventSeq < armed.eventSeq && armed.eventSeq < tailAction.beforeSeq &&
          tailAction.beforeSeq < end?.eventSeq && eventsAt(context,actions[assertion.returnAction],sample,'source.route').length === 0);
        if (tailContinuity) extra.push(rearmOrigin,rearm,armed,tailOrigin,tailAction);
      } else if (opening && tailOpening && !tailContinuity) {
        const tools = samples[assertion.toolsSample];
        const restored = samples[assertion.restoreSample];
        const depart = eventsAt(context,actions[assertion.departAction],tools,'source.route').find(event =>
          event.payload.action === 'tools' && event.payload.from === 'source' && event.payload.to === 'sourceTools' &&
          event.payload.mounting === opening.mounting && event.payload.previousGeneration === opening.generation);
        const returned = eventsAt(context,actions[assertion.returnAction],restored,'source.route').find(event =>
          event.payload.action === 'tools-back' && event.payload.from === 'sourceTools' && event.payload.to === 'source' &&
          sameOwner(event.payload,tailOpening) && event.payload.previousGeneration === depart?.payload.generation);
        tailContinuity = Boolean(fullSample(tools) && fullSample(restored) && depart && returned &&
          motionEvent?.eventSeq < depart.eventSeq && depart.eventSeq < returned.eventSeq && returned.eventSeq < end?.eventSeq);
        if (tailContinuity) extra.push(depart,returned,{evidenceRefs:tools.evidenceRefs},{evidenceRefs:restored.evidenceRefs});
      }
      const complete = Boolean(first && motion && tail && tailContinuity && sameViewport(startFrame,tailFrame));
      const violation = Object.entries(checks).find(([,current]) => current.problems.length);
      if (violation) return conclude(false,violation[0] + ': ' + violation[1].problems[0],checks,extra,complete);
      if (!complete) return incomplete('Expected full normal native static, while-scroll, and true-tail inset observations');
      return conclude(true,'',checks,extra);
    }
    case 'group-geometry': {
      const groupEvents = eventsAt(context,action,sample,'source.overlay').filter(event => event.payload.overlay === 'group');
      const opened = groupEvents.findLast(event => event.payload.phase === 'open');
      const layout = latestAt(context, sample, 'source.geometry');
      const panel = sourceGroupPanelFrame(sample)?.painted;
      const trigger = oneNode(baseline, 'reader-source-group-trigger');
      const strictEdge = expected.tapEdge !== undefined;
      const native = sourceFilterNativeInteraction(assertion,action,baseline,sample);
      const before = native ? latestAt(context,baseline,'source.projection') : undefined;
      const after = native ? latestAt(context,sample,'source.projection') : undefined;
      const routes = native ? eventsAt(context,action,sample,'source.route') : [];
      const sameProjection = settledFilterProjection(before?.payload) && settledFilterProjection(after?.payload) &&
        sameOwner(before.payload.owner,after.payload.owner) &&
        [...sourceFilterKeys,'readGeneration','filterRevision','count','projected','firstAnchor','state']
          .every(field => before.payload[field] === after.payload[field]);
      if (strictEdge) {
        if (!native || !settledFilterProjection(before?.payload) || !settledFilterProjection(after?.payload))
          return incomplete('No current scoped native trigger edge, dispatch journal and Source projection');
        if (!sameProjection || routes.length || hasVisibleGroupPanel(baseline) ||
            !hasVisibleGroupPanel(sample) || groupEvents.length !== 1 || !hasNativeGroupSelection(sample,opened) ||
            !sameOwner(before.payload.owner,opened.payload.owner)) {
          return conclude(false,'The native group trigger edge did not open one current panel without changing the Source projection',
            {sampleId:sample.sampleId,openEvents:groupEvents.length,panelOpen:hasVisibleGroupPanel(sample)},[before,after,...groupEvents,...routes]);
        }
      }
      if (!opened || !layout || !rectPresent(panel?.rectPx) || !rectPresent(trigger?.rectPx) || !fullSample(sample) || !fullSample(baseline))
        return incomplete('The painted group panel, anchor or usable viewport is missing');
      if (!sameOwner(opened.payload.owner,layout.payload.owner) || !sameWindowLayout(baseline,sample))
        return incomplete('The panel and trigger are not in the same normal window and owner');
      const geometry = layout.payload;
      const {density} = sample.window;
      const host = oneNode(baseline, 'reader-source-content');
      const {groupHostTopVp:hostTop,groupHostBottomVp:hostBottom,groupHostLeftVp:hostLeft,groupHostRightVp:hostRight} = geometry;
      if (!rectPresent(host?.rectPx) || ![density,hostTop,hostBottom,hostLeft,hostRight].every(Number.isFinite) ||
          density <= 0 || hostRight <= hostLeft || hostBottom <= hostTop)
        return incomplete('The native source overlay coordinate host is missing');
      const panelVp = { left: (panel.rectPx.left - host.rectPx.left) / density,
        top: (panel.rectPx.top - host.rectPx.top) / density, width: panel.rectPx.width / density, height: panel.rectPx.height / density };
      const triggerVp = { left: (trigger.rectPx.left - host.rectPx.left) / density,
        top: (trigger.rectPx.top - host.rectPx.top) / density, width: trigger.rectPx.width / density, height: trigger.rectPx.height / density };
      const px = 1 / density;
      // SourceManagementPage passes the measured trigger origin to the
      // leading-aligned overlay. ReaderSelectPanel.panelX/panelY own the clamp.
      const leading = Math.min(hostRight,hostLeft + 16);
      const trailing = Math.max(leading,hostRight - 16);
      const requestedTop = hostBottom - triggerVp.top >= panelVp.height ? triggerVp.top : triggerVp.top - panelVp.height;
      const anchorVp = {
        left:Math.max(leading,Math.min(triggerVp.left,trailing - panelVp.width)),
        top:Math.max(hostTop,Math.min(requestedTop,hostBottom - panelVp.height)),
      };
      const valid = fullyVisible(panel) && panelVp.left >= hostLeft - px && panelVp.top >= hostTop - px &&
        panelVp.left + panelVp.width <= hostRight + px && panelVp.top + panelVp.height <= hostBottom + px &&
        Math.abs(panelVp.left-anchorVp.left) <= px && Math.abs(panelVp.top-anchorVp.top) <= px &&
        Math.min(panelVp.left + panelVp.width,triggerVp.left + triggerVp.width) > Math.max(panelVp.left,triggerVp.left);
      const actual = {panelVp,triggerVp,anchorVp,geometry};
      const observations = [opened,layout];
      if (valid && native && sameProjection && sameOwner(before.payload.owner,opened.payload.owner) &&
          groupEvents.length === 1 && sourceGroupSelection(opened) && !hasVisibleGroupPanel(baseline) && !routes.length) {
        actual.nativeInteraction = native;
        if (strictEdge) actual.sampleId = sample.sampleId;
        observations.push(before,after);
      }
      return conclude(valid,valid ? '' : 'The painted group panel is clipped, outside its safe host or displaced from the clamped trigger',
        actual,observations);
    }
    case 'group-options-scroll': return evaluateSourceGroupOptionsScroll(assertion,context);
    case 'group-options-text': return evaluateSourceGroupOptionsText(assertion,context);
    case 'group-outside-dismiss': {
      const open = actions[assertion.openAction];
      const origin = samples[open?.from];
      const measured = measureSourceGroupOutside(baseline);
      if (!measured || !positiveInt(action?.outsideTap?.probeSeq) ||
          action.op !== 'click' || action.targetId !== sourceGroupBackdrop ||
          open?.op !== 'click' || open.targetId !== sourceGroupTrigger ||
          !pairedNativeEndpoint(open,origin,baseline,open.from) ||
          !pairedNativeEndpoint(action,baseline,sample,assertion.baseline) ||
          !sameWindowLayout(origin,baseline) || !sameWindowLayout(baseline,sample) ||
          [origin,sample].some(point => point.captureComplete !== true || point.window.keyboard?.visible !== false)) {
        return incomplete('Missing the verified native outside click and complete stable group endpoints');
      }
      const {point,selectionId} = measured;
      const groupEvents = (cause,endpoint) => eventsAt(context,cause,endpoint,'source.overlay')
        .filter(event => event.payload.overlay === 'group');
      const openings = groupEvents(open,baseline);
      const [opening] = openings;
      const latest = latestAt(context,baseline,'source.overlay',payload => payload.overlay === 'group');
      const before = latestAt(context,baseline,'source.projection');
      const after = latestAt(context,sample,'source.projection');
      if (!opening || !settledFilterProjection(before?.payload) || !settledFilterProjection(after?.payload)) {
        return incomplete('Missing the group opening or a current Source projection');
      }
      const closure = groupEvents(action,sample);
      const [accepted,dismissed] = closure;
      const routes = eventsAt(context,action,sample,'source.route');
      const commits = eventsAt(context,action,sample,'source.projection').filter(event => event.payload.trigger === 'group');
      const visible = (endpoint,ids) => endpoint.nodes.some(node => node.visible === true &&
        ids.some(id => node.id === id || node.alias === id));
      const released = !visible(sample,[groupPanel,sourceGroupBackdrop]);
      const {owner} = before.payload;
      const belongs = event => event.payload.selectionId === selectionId && sameOwner(event.payload.owner,owner);
      const stableProjection = sameOwner(owner,after.payload.owner) &&
        [...sourceFilterKeys,'readGeneration','filterRevision','count','projected','firstAnchor']
          .every(field => before.payload[field] === after.payload[field]);
      const actual = { ...measured, dispatch:action.outsideTap, phases:closure.map(event => event.payload.phase),
        openingSeq:opening.eventSeq, released, stableProjection, routeChanges:routes.length, groupCommits:commits.length };
      const observations = [open,origin,before,after,...openings,...closure,...routes,...commits];
      const valid = action.outsideTap.x === point.x && action.outsideTap.y === point.y &&
        openings.length === 1 && latest === opening && opening.payload.phase === 'open' && belongs(opening) &&
        !visible(origin,[groupPanel,sourceGroupBackdrop]) &&
        released && Boolean(oneNode(sample,back) && oneNode(sample,list) && oneNode(sample,sourceGroupTrigger)) &&
        stableProjection && routes.length === 0 && commits.length === 0 &&
        closure.length <= 2 && closure.every(belongs) &&
        (!accepted || ['outside','dismiss'].includes(accepted.payload.phase)) &&
        (!dismissed || accepted.payload.phase === 'outside' && dismissed.payload.phase === 'dismiss' &&
          accepted.eventSeq < dismissed.eventSeq);
      const complete = closure.length === 2;
      return conclude(valid,valid ? (complete ? '' : 'The exact group owner did not record both outside acceptance and dismissal') :
        'The outside click did not uniquely dismiss the measured group opening in the same Source state',
      actual,observations,complete);
    }
    case 'group-back': {
      if (!pairedNativeBack(action,baseline,sample,assertion.baseline) || !sameWindowLayout(baseline,sample) ||
          !oneNode(baseline, groupPanel)) return incomplete('Missing same-window native group-panel Back or its endpoints');
      const opened = latestAt(context, baseline, 'source.overlay', payload => payload.overlay === 'group');
      const before = latestAt(context, baseline, 'source.projection');
      const after = latestAt(context, sample, 'source.projection');
      if (opened?.payload.phase !== 'open' || !before || !after)
        return incomplete('Missing the opened group panel or the source page owner at the Back endpoints');
      const group = eventsAt(context, action, sample, 'source.overlay').filter(event => event.payload.overlay === 'group');
      const routes = eventsAt(context, action, sample, 'source.route');
      const liveOwner = before.payload.owner;
      const panelClosed = !oneNode(sample, groupPanel);
      const stayed = routes.length === 0 && Boolean(oneNode(sample, back)) && sameOwner(liveOwner,after.payload.owner);
      const sameOpening = sameOwner(liveOwner, opened.payload.owner) && group.every(event => sameOwner(liveOwner,event.payload.owner));
      if (stayed && panelClosed && sameOpening && group.length < 2)
        return incomplete('The current group owner did not record both temporary Back and dismissal');
      const [consumer,dismissed] = group;
      const valid = stayed && panelClosed && sameOpening && group.length === 2 && consumer.payload.phase === 'back' &&
        dismissed.payload.phase === 'dismiss' && consumer.eventSeq < dismissed.eventSeq;
      return conclude(valid, valid ? '' : 'Back did not close the group overlay within the current source route',
        {phases:group.map(event => event.payload.phase), routeAcceptances:routes.length, owner:liveOwner,
          openSeq:opened.eventSeq, sameOpening, panelClosed}, [opened, before, after, ...group, ...routes]);
    }
    case 'ime-back': {
      if (!pairedNativeBack(action,baseline,sample,assertion.baseline)) return incomplete('Missing native IME Back action or endpoints');
      const routes = eventsAt(context, action, sample, 'source.route');
      const appIme = eventsAt(context, action, sample, 'source.overlay').filter(event => event.payload.overlay === 'ime' && event.payload.phase === 'back');
      const before = latestAt(context, baseline, 'source.projection');
      const after = latestAt(context, sample, 'source.projection');
      if (!before || !after || !baseline.window.keyboard || !sample.window.keyboard)
        return incomplete('Missing native keyboard geometry or same-owner projection');
      const valid = baseline.window.keyboard?.visible === true && sample.window.keyboard?.visible === false &&
        routes.length === 0 && appIme.length <= 1 && sameOwner(before.payload.owner, after.payload.owner) &&
        appIme.every(event => sameOwner(before.payload.owner,event.payload.owner)) &&
        before.payload.filterRevision === after.payload.filterRevision && Boolean(oneNode(sample, editor));
      return conclude(valid, valid ? '' : 'Native Back left the source page, changed its projection or retained the keyboard',
        {imeVisibleBefore:baseline.window.keyboard?.visible, imeVisibleAfter:sample.window.keyboard?.visible,
          consumer:appIme.length ? 'source-ime-bridge' : 'system-ime-before-route', routes:routes.length}, [...routes, ...appIme, before, after]);
    }
    case 'source-inline-import-edge':
    case 'source-inline-import-center':
    case 'source-inline-import-area':
      return evaluateSourceInlineImportEdge(assertion,context);
    case sourceV9ChromeGeometry:
    case sourceV9ChromeDispatch:
      return evaluateSourceV9Chrome(assertion,context);
    case 'source-chrome-geometry':
    case 'source-chrome-dispatch':
      return evaluateSourceChrome(assertion,context);
    case 'source-offline-detect':
      return evaluateSourceOfflineDetect(assertion,context);
    case 'source-native-focus':
    case 'source-native-semantics':
      return evaluateSourceNativeFocus(assertion,context);
    case 'source-query-edge':
    case 'source-query-touch': {
      const legacy = assertion.kind === 'source-query-edge';
      const position = legacy ? expected.tapEdge : expected.position;
      const opening = sourceReadObservation({action:assertion.entryAction,sample:assertion.baseline,expected:{state:'rows'}},context);
      const before = opening?.current;
      if (!fullSample(baseline) || !opening?.triggered || !settledFilterProjection(before?.payload) || before.payload.state !== 'rows') {
        return incomplete('Missing the normal Source opening and current native query baseline');
      }
      const geometry = legacy ? measureSourceQueryEdge(baseline,position) : measureSourceQueryTouch(baseline,position);
      if (geometry.verdict !== 'PASS') return report(geometry.verdict,geometry.reason,geometry.actual,[opening.entry,before]);
      const {point} = geometry.actual;
      const dispatched = legacy ? action?.edgeTap : action?.queryTouch;
      if (action?.op !== 'click' || action.targetId !== editor || !positiveInt(dispatched?.probeSeq) ||
          (legacy ? dispatched.edge : dispatched.position) !== position || dispatched.requireFullContainment ||
          !pairedNativeEndpoint(action,baseline,sample,assertion.baseline) || sample.captureComplete !== true ||
          sample.window.source !== 'window-metrics' || baseline.window.density !== sample.window.density ||
          !legacy && (baseline.window.id !== sample.window.id || baseline.window.orientation !== sample.window.orientation ||
            baseline.window.fontScale !== sample.window.fontScale)) {
        return incomplete('No verified native query click with complete current-window endpoints');
      }
      const route = eventsAt(context,action,sample,'source.route');
      const projections = eventsAt(context,action,sample,'source.projection');
      const after = latestAt(context,sample,'source.projection');
      const input = readSourceQueryEditor(sample);
      const keyboard = sample.window.keyboard?.visible;
      const actual = {...geometry.actual,dispatch:dispatched,focused:input?.focused ?? null,keyboardVisible:keyboard ?? null,
        routeChanges:route.length};
      const observations = [opening.entry,before,...route,...projections,after];
      if (dispatched.x !== point.x || dispatched.y !== point.y || route.length) {
        return conclude(false,'The native query click was displaced or changed the Source route',actual,observations);
      }
      if (!settledFilterProjection(after?.payload) || typeof input?.focused !== 'boolean' || typeof keyboard !== 'boolean') {
        return report('NOT_RUN','Missing the current native query focus, IME state, or Source projection',actual,observations);
      }
      const projectionUnchanged = [after,...projections].every(event => sameOwner(before.payload.owner,event.payload.owner) &&
        [...sourceFilterKeys,'readGeneration','filterRevision','count','projected','firstAnchor','readFact','state']
          .every(field => event.payload[field] === before.payload[field]));
      const valid = input.focused && input.enabled === true && fullyVisible(input) && keyboard && projectionUnchanged &&
        Boolean(oneNode(sample,back) && oneNode(sample,list));
      if (valid && !legacy) {
        const {carrierPath,bounds,painted} = geometry.actual;
        actual.nativeInteraction = {subject:'query-input',target:editor,carrierPath,bounds,painted,
          visible:true,clipped:false,enabled:true,accepted:true,position,
          actionId:assertion.action,baselineSampleId:assertion.baseline,dispatch:dispatched};
      }
      return conclude(valid,valid ? '' : 'The native query click did not focus the current editor and reveal the IME in the same Source state',
        actual,observations);
    }
    case 'native-control-target': {
      const opening = sourceReadObservation({...assertion,expected:{state:'rows'}},context);
      const current = opening?.current.payload;
      if (!fullSample(sample) || !opening || !settledFilterProjection(current)) {
        return incomplete('No complete current Source collection sample for the native control');
      }
      const measured = measureSourceNativeControl(sample,expected.target);
      return report(measured.verdict,measured.reason,measured.actual && {...measured.actual,sampleId:sample.sampleId},
        [opening.entry,opening.current]);
    }
    case 'filter-touch-target': {
      const opening = sourceReadObservation({...assertion,expected:{state:'rows'}},context);
      if (!fullSample(sample) || !opening || !settledFilterProjection(opening.current.payload)) {
        return incomplete('No complete, current source filter target sample');
      }
      const measured = measureSourceFilterCarrier(sample,expected.target,expected);
      const disabled = measured.verdict === 'PASS' && expected.target === 'reader-source-status-custom';
      return report(measured.verdict,measured.reason,measured.actual && {...measured.actual,sampleId:sample.sampleId,
        ...(disabled ? {enabled:false,clickable:false} : {})},[opening.entry,opening.current]);
    }
    case 'group-option-touch-edge':
    case 'group-option-touch-center': {
      const center = assertion.kind === 'group-option-touch-center';
      const open = actions[assertion.openAction];
      const native = sourceFilterNativeInteraction(assertion,action,baseline,sample);
      const edge = center ? undefined : readSourceFilterEdge(baseline,action,expected,expected.target);
      if (!(center ? native : edge) || open?.op !== 'click' || open.targetId !== 'reader-source-group-trigger' ||
          !pairedNativeEndpoint(open,samples[open.from],baseline,open.from) ||
          !pairedNativeEndpoint(action,baseline,sample,assertion.baseline) || !sameWindowLayout(baseline,sample) ||
          sample.captureComplete !== true || sample.window.keyboard?.visible !== false)
        return incomplete('No verified group open and actual native option command between current full samples');
      const groupEvents = (cause,point) => eventsAt(context,cause,point,'source.overlay')
        .filter(event => event.payload.overlay === 'group');
      const opening = groupEvents(open,baseline);
      const closure = groupEvents(action,sample);
      const [opened] = opening;
      const [dismissed] = closure;
      const before = latestAt(context,baseline,'source.projection');
      const after = latestAt(context,sample,'source.projection');
      const prior = before?.payload;
      const current = after?.payload;
      if (!opened || !settledFilterProjection(prior) || !settledFilterProjection(current) ||
          prior.groupIndex !== 0 || prior.projected !== prior.count)
        return incomplete('No current public all-groups projection and live group-panel opening');
      const selected = center && oneNode(baseline,'reader-source-group-selected')?.selected;
      if (center && typeof selected !== 'boolean') return incomplete('No native selected-state reading for the current group option');
      const commits = eventsAt(context,action,sample,'source.projection')
        .filter(event => event.payload.trigger === 'group');
      const [accepted] = commits;
      const next = accepted?.payload;
      const owner = prior.owner;
      const routes = eventsAt(context,action,sample,'source.route');
      const stableFilter = value => sameOwner(value?.owner,owner) && value.readGeneration === prior.readGeneration &&
        ['status','category','queryLength','count'].every(field => value[field] === prior[field]);
      const changed = expected.groupIndex > 0;
      const correctFilter = value => settledFilterProjection(value) && stableFilter(value) &&
        value.groupIndex === expected.groupIndex &&
        (changed ? value.filterRevision > prior.filterRevision && value.projected > 0 && value.projected < prior.projected :
          value.filterRevision === prior.filterRevision && value.projected === prior.projected);
      const panelReleased = !hasVisibleGroupPanel(sample);
      const sameSelection = sourceGroupSelection(opened) && opened.payload.selectionId === dismissed?.payload.selectionId;
      const valid = opening.length === 1 && opened.payload.phase === 'open' && sameOwner(opened.payload.owner,owner) &&
        commits.length === 1 && closure.length === 1 && dismissed.payload.phase === 'dismiss' &&
        sameOwner(dismissed.payload.owner,owner) && accepted.eventSeq < dismissed.eventSeq &&
        correctFilter(next) && correctFilter(current) && current.filterRevision === next.filterRevision &&
        current.projected === next.projected && current.firstAnchor === next.firstAnchor &&
        routes.length === 0 && panelReleased && Boolean(oneNode(sample,back)) &&
        (!center || selected && sameSelection && hasNativeGroupSelection(baseline,opened) &&
          current.firstAnchor === prior.firstAnchor);
      const nativeInteraction = valid && sameSelection && native;
      return conclude(valid,valid ? '' : 'The measured native option did not commit the expected group and release the same panel',
        {...(edge ? {edge} : {}),before:prior,after:current,commits:commits.length,panelReleased,
          ...(nativeInteraction ? {sampleId:sample.sampleId,nativeInteraction} : {})},
        [open,before,after,...opening,...commits,...closure,...routes]);
    }
    case 'toggle-touch-target': {
      const opening = sourceReadObservation({...assertion,expected:{state:'rows'}},context);
      const ready = sourceToggleReadyAt(sample,context.events);
      if (!fullSample(sample) || !opening || !ready || ready.eventSeq <= opening.entry.eventSeq ||
          !sourceToggleSameOwner(ready.payload.owner,opening.current.payload.owner))
        return incomplete('No complete native sample of the exact public Toggle in its current normal opening');
      const measured = measureSourceToggleCarrier(sample);
      return report(measured.verdict,measured.reason,
        measured.actual && {...measured.actual,sampleId:sample.sampleId},[opening.entry,opening.current,ready]);
    }
    case 'toggle-touch-edge':
    case 'toggle-touch': {
      const legacy = assertion.kind === 'toggle-touch-edge';
      const edge = legacy ? readSourceToggleEdge(baseline,action,expected.tapEdge) :
        readSourceToggleTouch(baseline,action,expected.position);
      if (!edge || action.from !== assertion.baseline || !fullSample(baseline) || !fullSample(sample) ||
          sample.captureComplete !== true || sample.window.keyboard?.visible !== false || !sameWindowLayout(baseline,sample) ||
          action.instanceId !== sample.instanceId || ![baseline.afterSeq,action.beforeSeq,action.afterSeq,sample.beforeSeq].every(count) ||
          baseline.afterSeq > action.beforeSeq || action.beforeSeq >= action.afterSeq || action.afterSeq > sample.beforeSeq) {
        return incomplete(legacy ? 'No verified native outside-box Toggle command between complete current samples' :
          'No verified native Toggle command between complete current samples');
      }
      const before = sourceToggleReadyAt(baseline, context.events);
      const current = sourceToggleReadyAt(baseline, context.events, action.beforeSeq);
      const after = sourceToggleReadyAt(sample, context.events);
      const ready = before?.payload;
      if (!ready || ready.anchor !== edge.anchor || ready.enabled === expected.requestedEnabled ||
          !sourceToggleSameOwner(ready.owner,current?.payload.owner) || current.payload.anchor !== ready.anchor ||
          current.payload.enabled !== ready.enabled || current.payload.filterRevision !== ready.filterRevision ||
          current.payload.readGeneration !== ready.readGeneration) return incomplete('The action lacked its exact ready source row and read epoch');
      const events = eventsAt(context,action,sample,'source.toggle');
      const admissions = events.filter(event => event.payload.phase === 'admitted');
      const settlements = events.filter(event => event.payload.phase === 'settled');
      const [admission] = admissions;
      const [settlement] = settlements;
      const active = event => sourceToggleSameOwner(event?.payload.owner,ready.owner) && event.payload.anchor === ready.anchor;
      const observations = [before,current,...admissions,...settlements,after];
      const actual = {edge,beforeEnabled:ready.enabled,requestedEnabled:expected.requestedEnabled,
        admissions:admissions.length,settlements:settlements.length};
      if (!admission) {
        if (active(after) && after.payload.enabled === ready.enabled && after.payload.readGeneration === ready.readGeneration &&
            after.payload.filterRevision === ready.filterRevision) {
          return conclude(false,legacy ? 'The verified outside-box click was not admitted by the current source Toggle' :
            'The verified native click was not admitted by the current source Toggle',actual,observations);
        }
        return incomplete('No admitted source Toggle event or authoritative unchanged endpoint');
      }
      const sequence = admission.payload.toggleSeq;
      if (admissions.length !== 1 || settlements.length > 1 || !active(admission) || !positiveInt(sequence) ||
          admission.eventSeq > action.afterSeq || admission.payload.requestedEnabled !== expected.requestedEnabled) {
        return conclude(false,legacy ? 'The outside-box click did not admit exactly one requested action for the current source' :
          'The native click did not admit exactly one requested action for the current source',actual,observations);
      }
      if (!settlement) return incomplete('The admitted public source Toggle has no settled outcome');
      if (!active(settlement) || settlement.payload.toggleSeq !== sequence || admission.eventSeq >= settlement.eventSeq ||
          settlement.eventSeq > action.afterSeq || settlement.payload.requestedEnabled !== expected.requestedEnabled) {
        return conclude(false,'The source Toggle settled for the wrong operation or owner',actual,observations);
      }
      const result = {...actual,toggleSeq:sequence,confirmation:settlement.payload.confirmation,
        readback:settlement.payload.readback,observedEnabled:settlement.payload.observedEnabled};
      if (!sourceToggleIsConfirmed(settlement.payload)) {
        if (settlement.payload.readback === 'succeeded' && typeof settlement.payload.observedEnabled === 'boolean' &&
            settlement.payload.observedEnabled !== expected.requestedEnabled) {
          return conclude(false,'The fresh source readback did not show the requested Toggle value',result,observations);
        }
        return report('NOT_RUN','The source Toggle mutation or its fresh readback is unconfirmed',result,observations);
      }
      if (!active(after) || after.eventSeq <= admission.eventSeq || after.payload.filterRevision !== ready.filterRevision ||
          after.payload.readGeneration < ready.readGeneration) {
        return report('NOT_RUN','No current native endpoint with a fresh read of the exact source',result,observations);
      }
      const observed = {...result,readGeneration:after.payload.readGeneration};
      if (after.payload.enabled !== expected.requestedEnabled) {
        return conclude(false,'The current source row does not show the freshly read Toggle value',observed,observations);
      }
      if (!legacy) {
        const routes = eventsAt(context,action,sample,'source.route');
        if (routes.length) return conclude(false,'A Toggle click changed the current Source route',observed,[...observations,...routes]);
        const measured = measureSourceToggleCarrier(sample);
        if (measured.verdict !== 'PASS')
          return report(measured.verdict,measured.reason,observed,observations);
        if (typeof edge.nativeChecked !== 'boolean' || typeof measured.actual.nativeChecked !== 'boolean')
          return report('NOT_RUN','The native public Toggle checked state is unavailable',observed,observations);
        observed.nativeCheckedAfter = measured.actual.nativeChecked;
        if (edge.nativeChecked !== ready.enabled || observed.nativeCheckedAfter !== after.payload.enabled)
          return conclude(false,'The native public Toggle checked state disagrees with the authoritative source value',observed,observations);
        observed.sampleId = sample.sampleId;
        observed.nativeInteraction = {
          subject:'row-toggle',target:action.targetId,carrierPath:edge.togglePath,bounds:edge.envelope,painted:edge.painted,
          visible:true,clipped:false,enabled:true,accepted:true,position:expected.position,
          actionId:assertion.action,baselineSampleId:assertion.baseline,dispatch:action.toggleTap,
        };
      }
      return conclude(true,'',observed,observations);
    }
    case 'filter-tail-text': return evaluateSourceFilterTailText(assertion,context);
    case 'filter-scroll': {
      const {viewport} = sourceFilterScrollLanes[expected.lane];
      if (action?.op !== 'swipe' || action.targetId !== viewport || !action.filterLaneSwipe ||
          !pairedNativeEndpoint(action,baseline,sample,assertion.baseline) || !sameWindowLayout(baseline,sample) ||
          [baseline,sample].some(point=>point.captureComplete !== true || point.window.source !== 'window-metrics' ||
            point.window.keyboard?.visible !== false || !positiveRange(point.window.density, Number.MIN_VALUE, Number.MAX_VALUE))) {
        return incomplete('No verified native swipe between complete current Source samples in the same window');
      }
      const before = latestAt(context,baseline,'source.projection');
      const after = latestAt(context,sample,'source.projection');
      const original = before?.payload;
      const current = after?.payload;
      if (![original,current].every(settledFilterProjection) || current.readGeneration !== original.readGeneration ||
          current.count !== original.count) {
        return incomplete('No stable current catalogue read on both sides of the Source filter swipe');
      }
      const projections = eventsAt(context,{instanceId:baseline.instanceId,beforeSeq:baseline.beforeSeq},sample,'source.projection');
      const routeChanges = eventsAt(context,{instanceId:baseline.instanceId,beforeSeq:baseline.beforeSeq},sample,'source.route');
      const overlays = eventsAt(context,{instanceId:baseline.instanceId,beforeSeq:baseline.beforeSeq},sample,'source.overlay');
      const unchanged = [current,...projections.map(event=>event.payload)].every(next=>sameOwner(original.owner,next.owner) &&
        ['state','readFact','readGeneration','count','projected','firstAnchor','filterRevision',...sourceFilterKeys]
          .every(key=>original[key] === next[key]));
      const observations = [before,after,...projections,...routeChanges,...overlays];
      if (!unchanged || routeChanges.length || overlays.length) {
        return report('FAIL','The measured lane swipe changed the current Source opening, overlay, or filter projection',
          {before:original,after:current},observations);
      }
      const geometry = measureSourceFilterScroll(baseline,sample,action.filterLaneSwipe,expected.lane);
      const actual = geometry.actual && {...geometry.actual,gestureId:`${expected.lane}-scroll`,
        sampleId:assertion.sample,gestureSampleId:assertion.sample,baselineSampleId:assertion.baseline,actionId:assertion.action};
      return report(geometry.verdict,geometry.reason,actual,observations);
    }
    case 'filter-selection': {
      const editing = expected.trigger === 'edit' && ['queryLength','projected'].includes(expected.field);
      if (!editing && !Object.hasOwn(sourceFilterDefaults,expected.field)) {
        throw new Error(`Unsupported source filter-selection field ${expected.field} for ${expected.trigger}`);
      }
      // The public-list fixture uses a trusted tree-only action locator for
      // the focused editor. Its result is still a full native capture.
      const baselineReady = editing ? Boolean(baseline?.window && oneNode(baseline, editor)?.focused === true) : fullSample(baseline);
      if (!fullSample(sample) || !baselineReady || !action || editing && action.op !== 'inputText')
        return incomplete('Missing a normal filter action or its full native endpoint');
      const edge = expected.tapEdge && readSourceFilterEdge(baseline,action,expected);
      if (expected.tapEdge && (!edge || action.from !== assertion.baseline || !sameWindowLayout(baseline,sample) ||
          action.instanceId !== sample.instanceId || baseline.captureComplete !== true || sample.captureComplete !== true ||
          sample.window.keyboard?.visible !== false || ![baseline.afterSeq,action.beforeSeq,action.afterSeq,sample.beforeSeq].every(count) ||
          baseline.afterSeq > action.beforeSeq || action.beforeSeq >= action.afterSeq || action.afterSeq > sample.beforeSeq)) {
        return incomplete('No matching native edge command between the two stable source samples');
      }
      const nativeTarget = expected.nativeSelection === true && sourceFilterEdgeTarget(expected.trigger,expected.value);
      if (nativeTarget && (action.op !== 'click' || action.targetId !== nativeTarget ||
          !pairedNativeEndpoint(action,baseline,sample,assertion.baseline) || !sameWindowLayout(baseline,sample) ||
          baseline.captureComplete !== true || sample.captureComplete !== true || sample.window.keyboard?.visible !== false)) {
        return incomplete('The expected native radio was not dispatched between the current full filter samples');
      }
      const requiredTouch = expected.requireNativeTouch === true;
      const measuredTouch = requiredTouch ? sourceFilterNativeInteraction(assertion,action,baseline,sample) : undefined;
      if (requiredTouch && !measuredTouch)
        return incomplete('No exact native filter touch between complete current window samples');
      const before = latestAt(context,baseline,'source.projection');
      const acceptances = eventsAt(context,action,sample,'source.projection').filter(event =>
        event.payload.trigger === expected.trigger && (!edge || event.eventSeq <= action.afterSeq));
      const acceptance = acceptances.at(-1);
      const after = latestAt(context,sample,'source.projection');
      const original = before?.payload;
      const accepted = acceptance?.payload;
      const current = after?.payload;
      if ((edge || measuredTouch) && settledFilterProjection(original) && settledFilterProjection(current) &&
          sameOwner(original.owner,current.owner) && current.readGeneration === original.readGeneration &&
          current.count === original.count && original[expected.field] !== expected.value && acceptances.length === 0) {
        return conclude(false,edge ? 'The verified edge input was not accepted by the current source filter' :
          'The verified native center was not accepted by the current source filter',
          {...(edge ? {edge} : {}),before:original,after:current,acceptances:0},[before,after]);
      }
      if (![original,accepted,current].every(settledFilterProjection))
        return incomplete('No complete current source projection at the selection endpoints');
      if ([accepted,current].some(value => value.readGeneration !== original.readGeneration || value.count !== original.count))
        return incomplete('The current source catalog changed during the selected filter action');
      const editable = editing ? ['queryLength'] : expected.field === 'groupIndex' ? ['groupIndex','allGroups'] : [expected.field];
      const changedOtherFilters = sourceFilterKeys.filter(key => !editable.includes(key) && current[key] !== original[key]);
      const selectedField = editing ? 'queryLength' : expected.field;
      const alreadySelected = original[selectedField] === current[selectedField];
      const narrowed = !alreadySelected && original[selectedField] === sourceFilterDefaults[selectedField];
      const valid = sameOwner(original.owner,current.owner) && sameOwner(accepted.owner,current.owner) &&
        (!edge || !alreadySelected) &&
        (expected.trigger === 'edit' || acceptances.length === 1) &&
        sourceFilterKeys.every(key => accepted[key] === current[key]) && accepted.projected === current.projected &&
        current[expected.field] === expected.value && changedOtherFilters.length === 0 &&
        current.filterRevision === accepted.filterRevision &&
        (alreadySelected ? current.filterRevision === original.filterRevision : current.filterRevision > original.filterRevision) &&
        (!narrowed || current.projected <= original.projected);
      const actual = {before:original,after:current,changedOtherFilters,narrowed,acceptances:acceptances.length,
        ...(edge ? {edge} : {})};
      const observations = [before,...acceptances,after];
      if (!valid) {
        return conclude(false,'The selection changed another filter, settled the wrong revision, or expanded a narrower projection',
          actual,observations);
      }
      if (nativeTarget) {
        const native = sourceFilterRadioSelection(sample,nativeTarget);
        actual.nativeSelection = native.actual;
        if (native.verdict === 'NOT_RUN') return report('NOT_RUN',native.reason,actual,observations);
        if (native.verdict !== 'PASS') return conclude(false,native.reason,actual,observations);
      }
      if (action.filterTouch && !alreadySelected && acceptances.length === 1 &&
          acceptance.eventSeq <= action.afterSeq && !eventsAt(context,action,sample,'source.route').length) {
        const nativeInteraction = measuredTouch ?? sourceFilterNativeInteraction(assertion,action,baseline,sample);
        if (nativeInteraction && expected.trigger !== 'group') actual.nativeInteraction = nativeInteraction;
        if (nativeInteraction && expected.trigger === 'group') {
          const opening = latestAt(context,baseline,'source.overlay',payload => payload.overlay === 'group');
          const closure = eventsAt(context,action,sample,'source.overlay').filter(event => event.payload.overlay === 'group');
          const [dismissed] = closure;
          if (opening?.payload.phase === 'open' && sourceGroupSelection(opening) && sameOwner(opening.payload.owner,original.owner) &&
              closure.length === 1 && dismissed.payload.phase === 'dismiss' && sameOwner(dismissed.payload.owner,current.owner) &&
              opening.payload.selectionId === dismissed.payload.selectionId &&
              acceptance.eventSeq < dismissed.eventSeq && current.allGroups === false && !hasVisibleGroupPanel(sample)) {
            actual.nativeInteraction = nativeInteraction;
            observations.push(opening,dismissed);
          }
        }
      }
      if (requiredTouch && !actual.nativeInteraction)
        return conclude(false,'The native filter touch failed to change the current filter exactly once',actual,observations);
      return conclude(true,'',actual,observations);
    }
    case 'filter-layout': {
      const geometry = latestAt(context, sample, 'source.geometry');
      if (!sample || !geometry || typeof geometry.payload.expanded !== 'boolean') return incomplete('The actual filter layout branch is missing');
      const {rectPx,density} = sample.window ?? {};
      if (expected.minWidthVp !== undefined &&
          !positiveRange(rectPx?.width / density,expected.minWidthVp,Number.POSITIVE_INFINITY)) {
        return incomplete('Native window width does not establish the selected filter layout scope');
      }
      const expanded = geometry.payload.expanded;
      const check = {sample:assertion.sample, a:'reader-source-status-filter', b:'reader-source-group-filter',
        acceptedSources:assertion.acceptedSources, tolerancePx:expected.tolerancePx};
      const gap = evaluateLayout({...check, kind:'gap', axis:expanded ? 'x' : 'y',
        expected:expanded ? expected.expandedGapVp : expected.compactGapVp}, samples);
      const a = oneNode(sample, check.a)?.rectPx;
      const b = oneNode(sample, check.b)?.rectPx;
      const alignment = (a && b) ? b[expanded ? 'top' : 'left'] - a[expanded ? 'top' : 'left'] : null;
      const actual = {expanded, fontScale:geometry.payload.fontScale, gap:gap.actual, startAlignmentPx:alignment};
      if (expanded !== expected.expanded) return incomplete('Sample used another width class than the selected scenario');
      if (gap.verdict === 'FAIL' || (alignment !== null && Math.abs(alignment) > expected.tolerancePx))
        return conclude(false, 'Status and group filters differ from the branch gap or alignment', actual, [geometry],
          gap.verdict !== 'NOT_RUN' && alignment !== null);
      if (gap.verdict === 'NOT_RUN' || alignment === null) return incomplete('Both filter lanes and geometry are required');
      return conclude(true, '', actual, [geometry]);
    }
    case 'fixed-scroll': {
      if (!fullSample(sample) || !fullSample(baseline) || !action || !sameWindowLayout(sample,baseline))
        return incomplete('Same-layout before/after native scroll samples are missing');
      let gesture = null;
      if (expected.requireNativeSwipe === true) {
        const before = oneNode(baseline,list);
        const after = oneNode(sample,list);
        const dispatch = action.sourceListSwipe;
        const {fromX,fromY,toX,toY,velocity,probeSeq} = dispatch ?? {};
        const viewport = before?.visibleRectPx;
        const inside = (x,y) => Number.isSafeInteger(x) && Number.isSafeInteger(y) &&
          x >= viewport.left && x < viewport.left + viewport.width && y >= viewport.top && y < viewport.top + viewport.height;
        if (action.op !== 'swipe' || action.targetId !== list ||
            !pairedNativeEndpoint(action,baseline,sample,assertion.baseline) ||
            [baseline,sample].some(point=>point.captureComplete !== true || point.window.source !== 'window-metrics' ||
              point.window.keyboard?.visible !== false) ||
            [before,after].some(node=>node?.type !== 'List' || !rectPresent(node.visibleRectPx)) ||
            !positiveInt(probeSeq) || !positiveInt(velocity) || fromX !== toX || fromY <= toY ||
            !inside(fromX,fromY) || !inside(toX,toY)) {
          return incomplete('No exact native upward swipe inside the current Source List and paired captures');
        }
        if ([baseline,sample].some((point,index)=>!oneNode(point,filterBlock)?.path?.startsWith(
          (index === 0 ? before.path : after.path) + '/'))) {
          return incomplete('The moving filter block is not observed inside the actual Source List');
        }
        gesture = {gestureId:'main-list',sampleId:assertion.sample,gestureSampleId:assertion.sample,
          baselineSampleId:assertion.baseline,actionId:assertion.action,dispatch,
          fixedViewport:rectFields.every(key=>before.visibleRectPx[key] === after.visibleRectPx[key])};
      }
      const event = eventsAt(context, action, sample, 'source.scroll').findLast(item => item.payload.trigger === 'settled');
      const oldOwner = latestAt(context, baseline, 'source.projection');
      const projection = latestAt(context, sample, 'source.projection');
      if (!event || !sameOwner(event.payload.owner,oldOwner?.payload.owner) ||
          !sameOwner(event.payload.owner,projection?.payload.owner) ||
          event.payload.filterRevision !== oldOwner.payload.filterRevision ||
          event.payload.filterRevision !== projection.payload.filterRevision)
        return incomplete('Cannot bind both scroll samples to the settled Source owner and projection');
      const beforeTop = filterTopPx(baseline);
      const afterTop = filterTopPx(sample);
      const pairs = [back,footer].map(id => [oneNode(baseline,id)?.rectPx,oneNode(sample,id)?.rectPx]);
      if (![beforeTop,afterTop].every(Number.isFinite) || pairs.some(pair => !pair.every(rectPresent)))
        return incomplete('The fixed header/footer or list filter block is missing from the paired tree');
      const delta = afterTop - beforeTop;
      const px = expected.tolerancePx;
      const stable = pairs.every(([before,after]) => rectFields.every(key => Math.abs(before[key]-after[key]) <= px));
      // Scroller.currentOffset includes the native List start inset and is signed.
      const valid = stable && delta < -px && (gesture === null || gesture.fixedViewport);
      return conclude(valid, valid ? '' : 'The list filters failed to scroll, or fixed header/footer changed position',
        {fixed:stable, filterDeltaPx:delta, offsetVp:event.payload.offsetVp,
          ...(gesture && {...gesture,distancePx:-delta})}, [event,oldOwner,projection]);
    }
    case 'tool-return': {
      if (!sample || !baseline || !action || !actions[assertion.departAction] || !samples[assertion.toolsSample])
        return incomplete('The visible source → tools → source endpoints or actions are incomplete');
      const departAction = actions[assertion.departAction];
      const tools = samples[assertion.toolsSample];
      const before = eventsAt(context, departAction, tools, 'source.scroll').find(event => event.payload.trigger === 'tools');
      const departed = eventsAt(context, departAction, tools, 'source.route').find(event => event.payload.action === 'tools');
      const returned = eventsAt(context, action, sample, 'source.route').find(event => event.payload.action === 'tools-back');
      const restored = eventsAt(context, action, sample, 'source.scroll').findLast(event => event.payload.trigger === 'restored');
      if (!before || !restored || !departed || !returned || !oneNode(tools, 'reader-source-tools-back'))
        return incomplete('The full retained-scroll owner handoff did not settle');
      const a = before.payload;
      const b = restored.payload;
      if (!positiveInt(a.anchor) || !positiveInt(a.itemIndex) || !(a.offsetVp > 0))
        return incomplete('The selected fixture did not scroll far enough to create a restorable entity anchor');
      const anchorId = 'reader-source-row-' + a.anchor;
      const anchorBefore = oneNode(baseline, anchorId);
      const anchorAfter = oneNode(sample, anchorId);
      const px = expected.tolerancePx;
      const sameLayout = b.layoutMatchesSaved === true && baseline.window.density === sample.window.density &&
        b.viewportWidthVp === a.viewportWidthVp && b.viewportHeightVp === a.viewportHeightVp;
      if (!sameLayout) return incomplete('The same-layout restore claim is outside the observed viewport branch');
      const delta = retainedRowDelta(anchorBefore,anchorAfter);
      const bound = departed.payload.from === 'source' && departed.payload.to === 'sourceTools' &&
        returned.payload.from === 'sourceTools' && returned.payload.to === 'source' &&
        departed.payload.previousGeneration === a.owner.generation && departed.payload.generation === returned.payload.previousGeneration &&
        returned.payload.generation === b.owner.generation && a.owner.mounting === b.owner.mounting;
      const valid = bound && b.filterMatchesSaved === true && b.anchor === a.anchor && b.itemIndex === a.itemIndex &&
        Math.abs(b.itemYVp - a.itemYVp) * sample.window.density <= px && Math.abs(b.offsetVp - a.offsetVp) * sample.window.density <= px &&
        delta !== null && Math.abs(delta) <= px;
      return conclude(valid, valid ? '' : 'Native anchor, offset, filter or navigation generation failed to restore',
        {departed:departed.payload, returned:returned.payload, before:a, after:b, nativeAnchorDeltaPx:delta},
        [before, departed, returned, restored]);
    }
    case 'tool-return-filters': {
      const handoff = sourceToolsHandoff(assertion,context,baseline,sample,action);
      const filtered = samples[assertion.filteredSample];
      const swipe = actions[assertion.priorAction];
      if (!handoff || swipe?.op !== 'swipe' || swipe.targetId !== list || filtered?.captureComplete !== true ||
          !pairedNativeEndpoint(swipe,filtered,baseline,assertion.filteredSample) || !sameWindowLayout(filtered,baseline))
        return incomplete('Missing the measured filtered list, swipe or exact Source → Tools → Source handoff');
      const {depart,tools,away,home,routes,nativeEndpoints,refs:handoffRefs} = handoff;
      if (!routes || !nativeEndpoints)
        return conclude(false,'The Tools round trip did not return to the source page on the expected route chain',
          {departed:away,returned:home,nativeEndpoints},handoffRefs);
      const starting = latestAt(context,filtered,'source.projection');
      const prior = latestAt(context,baseline,'source.projection');
      const after = latestAt(context,sample,'source.projection');
      const scrolled = eventsAt(context,swipe,baseline,'source.scroll').findLast(event => event.payload.trigger === 'settled');
      const saved = eventsAt(context,depart,tools,'source.scroll').findLast(event => event.payload.trigger === 'tools');
      const restored = eventsAt(context,action,sample,'source.scroll').findLast(event => event.payload.trigger === 'restored');
      const initial = starting?.payload;
      const pre = prior?.payload;
      const post = after?.payload;
      const currentEmpty = post?.readFact === 'current' && positiveInt(post.readGeneration) &&
        post.state === 'empty' && post.count === 0 && post.projected === 0;
      if (!settledFilterProjection(initial) || !settledFilterProjection(pre) ||
          !(settledFilterProjection(post) || currentEmpty) || after.eventSeq <= action.beforeSeq || !scrolled || !saved)
        return incomplete('Missing complete current projections, native settled offset or captured departure scroll');
      const a = saved.payload;
      const b = restored?.payload;
      const liveCatalogue = expected.minimumProjected !== undefined;
      const progress = liveCatalogue ? sourceToolsFilterProgress(context,expected) : undefined;
      if (progress && progress.verdict !== 'PASS')
        return report(progress.verdict,progress.reason,{completed:progress.completed},progress.refs);
      const positiveFilters = ['status','category','groupIndex','queryLength'];
      const expectedProjected = progress?.previous.projected ?? expected.projected;
      const expectedProjection = projection => projection.projected === expectedProjected &&
        positiveFilters.every(key => projection[key] === expected[key]);
      const priorOwner = {mounting:away.mounting,generation:away.previousGeneration};
      const bound = sameOwner(initial.owner,priorOwner) && sameOwner(pre.owner,priorOwner) &&
        sameOwner(scrolled.payload.owner,priorOwner) && sameOwner(a.owner,priorOwner) &&
        sameOwner(post.owner,home) &&
        initial.filterRevision === pre.filterRevision &&
        scrolled.payload.filterRevision === pre.filterRevision && a.filterRevision === pre.filterRevision;
      const beforeAnchor = {id:'reader-source-row-' + a.anchor,ancestors:[list]};
      const anchorBefore = oneNode(baseline,beforeAnchor);
      const anchorAfter = oneNode(sample,beforeAnchor);
      const density = sample.window.density;
      const px = expected.tolerancePx;
      const delta = retainedRowDelta(anchorBefore,anchorAfter);
      const sameViewport = Number.isFinite(density) && density > 0 && baseline.window.density === density &&
        rectPresent(baseline.window.rectPx) && rectPresent(sample.window.rectPx) &&
        rectFields.every(key => baseline.window.rectPx[key] === sample.window.rectPx[key]);
      const samePosition = (first,second) => first.anchor === second.anchor && first.itemIndex === second.itemIndex &&
        Math.abs(first.itemYVp - second.itemYVp) * density <= px && Math.abs(first.offsetVp - second.offsetVp) * density <= px;
      const observations = [...(progress?.refs ?? []),...handoffRefs, filtered, swipe, starting, prior, after, scrolled, saved, restored];
      const result = {before:pre,after:post,saved:a,restored:b ?? null,nativeAnchorDeltaPx:delta,
        ...(progress ? {commits:progress.completed} : {})};
      if (!bound || (progress && !sameFilterState(progress.previous,pre)))
        return conclude(false,'The filtered list was not restored on the same runtime and accepted tool-opening chain',result,observations);
      if (!expectedProjection(initial))
        return incomplete('The public fixture did not establish all four non-default filters before scrolling');
      if (!sameViewport || !positiveInt(a.anchor) || !positiveInt(a.itemIndex) || !(a.offsetVp > 0) ||
          !rectPresent(anchorBefore?.visibleRectPx) || !samePosition(scrolled.payload,a))
        return incomplete('The selected list did not establish a stable, visible entity at a restorable offset');
      if (!expectedProjection(pre) || !expectedProjection(post) || post.count !== pre.count ||
          post.firstAnchor !== pre.firstAnchor || delta === null || Math.abs(delta) > px)
        return conclude(false,'The current source filters, first result or visible scroll anchor changed on the Tools round trip',result,observations);
      if (!b) return incomplete('Visible anchor returned, but the same-opening owner did not measure the restored offset');
      if (b.layoutMatchesSaved !== true || b.viewportWidthVp !== a.viewportWidthVp || b.viewportHeightVp !== a.viewportHeightVp)
        return incomplete('The return owner did not observe the same scroll layout');
      const valid = sameOwner(b.owner,home) && b.filterRevision === post.filterRevision && b.filterMatchesSaved === true &&
        b.lastAnchor === a.lastAnchor && samePosition(a,b);
      return conclude(valid, valid ? '' : 'The retained filters or exact list offset did not match the original captured state',result,observations);
    }
    case 'tools-return-focus': {
      const handoff = sourceToolsHandoff(assertion,context,baseline,sample,action);
      if (!handoff) return incomplete('Missing the current native Tools exit and matching source re-entry');
      const control = oneNode(sample,handoff.target);
      const buttons = handoff.nativeEntry ? (control?.type === 'Button' ? [control] : []) :
        control?.path ? sample.nodes.filter(node => node.type === 'Button' &&
          node.path.startsWith(control.path + '/') && node.visible === true) : [];
      const button = buttons[0];
      const actual = {route:handoff.home, buttonCount:buttons.length, focused:button?.focused ?? null};
      if (!handoff.routes || !handoff.nativeEndpoints || buttons.length !== 1 ||
          !fullyVisible(button) || button.enabled !== true || (handoff.nativeEntry && button.clickable !== true))
        return conclude(false,`The same visible native ${handoff.entry} Tools button did not return on the active source page`,actual,handoff.refs);
      if (typeof button.focused !== 'boolean') return incomplete('Native focus is unavailable for the returned Tools button');
      return conclude(button.focused === expected.focused,button.focused === expected.focused ? '' :
        `The original ${handoff.entry} Tools button did not regain native focus`,actual,handoff.refs);
    }
    case 'reset-scroll': {
      if (!fullSample(sample) || !fullSample(baseline) || !action || !sameWindowLayout(sample,baseline))
        return incomplete('Missing a normal scrolled source sample and filter endpoint in one layout');
      const before = latestAt(context,baseline,'source.scroll');
      const priorProjection = latestAt(context,baseline,'source.projection');
      const after = eventsAt(context,action,sample,'source.projection').findLast(event => event.payload.trigger === expected.trigger);
      const current = latestAt(context,sample,'source.projection');
      const beforeGeometry = latestAt(context,baseline,'source.geometry');
      const geometry = latestAt(context,sample,'source.geometry');
      const beforeTop = filterTopPx(baseline);
      const afterTop = filterTopPx(sample);
      const beforeInset = beforeGeometry?.payload.listStartInsetVp * baseline.window.density;
      const currentInset = geometry?.payload.listStartInsetVp * sample.window.density;
      if (!before || before.payload.trigger !== 'settled' || !priorProjection || !after || !current ||
          ![beforeTop,afterTop,beforeInset,currentInset].every(Number.isFinite) ||
          beforeInset - beforeTop <= expected.tolerancePx ||
          !sameOwner(before.payload.owner,beforeGeometry.payload.owner) ||
          !sameOwner(before.payload.owner,priorProjection.payload.owner) ||
          before.payload.filterRevision !== priorProjection.payload.filterRevision)
        return incomplete('Missing a scrolled precondition or the filter block’s reset geometry');
      const delta = afterTop - currentInset;
      const valid = sameOwner(before.payload.owner,after.payload.owner) &&
        sameOwner(after.payload.owner,current.payload.owner) && sameOwner(after.payload.owner,geometry.payload.owner) &&
        after.payload.filterRevision === current.payload.filterRevision &&
        after.payload.filterRevision > priorProjection.payload.filterRevision && Math.abs(delta) <= expected.tolerancePx;
      return conclude(valid, valid ? '' : 'Changing the active filter did not reset the native list to its current top inset',
        {offsetVpBefore:before.payload.offsetVp, preResetDisplacementPx:beforeInset-beforeTop, deltaPx:delta, projection:current.payload},
        [before,priorProjection,after,current,beforeGeometry,geometry]);
    }
    case 'adaptation': {
      const facts = latestAt(context, sample, 'source.geometry');
      const projection = latestAt(context, sample, 'source.projection');
      const state = projection?.payload;
      if (!sample || !facts || !state || !fullSample(sample) || !positiveInt(state.firstAnchor))
        return incomplete('The native row or actual font and viewport dimensions are missing');
      const geometry = facts.payload;
      const {density,fontScale:windowFontScale,revision,rectPx} = sample.window;
      const windowWidth = rectPx?.width / density;
      const scaleInRange = scale => positiveRange(scale,expected.minFontScale,expected.maxFontScale);
      if (!positiveRange(windowWidth,expected.minWidthVp,expected.maxWidthVp) ||
          !scaleInRange(windowFontScale) || !scaleInRange(geometry.fontScale) ||
          Math.abs(windowFontScale - geometry.fontScale) > .01 || facts.windowRevision !== revision)
        return incomplete('The current window and source layout owner do not prove the same selected width and font condition');
      const row = oneNode(sample, 'reader-source-row-' + state.firstAnchor);
      const actualFooter = oneNode(sample, footer);
      if (!row || !actualFooter || !sameOwner(geometry.owner,state.owner))
        return incomplete('Native first row and footer must belong to the recorded layout owner');
      const footerForm = geometry.footerStacked ? 'stacked' : 'row';
      const body = oneNode(sample, 'reader-source-footer-' + footerForm);
      if (!body) return incomplete('The expected normal branch has no corresponding native footer node');
      function nativeActions(host) {
        const options = sample.nodes.filter(node => node.clickable === true && node.enabled === true &&
          typeof node.path === 'string' && node.path.startsWith(host.path + '/'));
        return options.filter(node => !options.some(other => other !== node && other.path.startsWith(node.path + '/')));
      }
      const rowActions = nativeActions(row);
      const footerActions = nativeActions(actualFooter);
      if (rowActions.length < expected.rowActions || footerActions.length !== expected.footerActions)
        return incomplete('One or more normal row/footer action boxes are absent in the native capture');
      const rowBoxes = rowActions.map(node => ({sizeVp:{width:node.rectPx?.width / density, height:node.rectPx?.height / density},
        visible:fullyVisible(node)}));
      const footerBoxes = footerActions.map(node => ({sizeVp:{width:node.rectPx?.width / density, height:node.rectPx?.height / density},
        visible:fullyVisible(node)}));
      const footerRoundsToWindow = footerRoundingAtWindowBottom(actualFooter, body, sample.window.visibleRectPx,
        footerActions, expected.tolerancePx);
      const valid = (fullyVisible(actualFooter) || footerRoundsToWindow) && fullyVisible(row) &&
        [...rowBoxes,...footerBoxes].every(box => box.visible) &&
        footerBoxes.every(box => box.sizeVp.height + expected.tolerancePx / density >= expected.minimumFooterHeightVp);
      return conclude(valid,valid ? '' : 'A row/footer action in the selected native width and font condition is clipped or undersized',
        {sampleId:assertion.sample,windowWidthVp:windowWidth,windowFontScale,
          fontScale:geometry.fontScale,footerForm,rowBoxes,footerBoxes,
          ...(footerRoundsToWindow ? {footerCarrierBottomExcessPx:bottom(actualFooter.rectPx) - bottom(actualFooter.visibleRectPx)} : {})},
        [facts,projection]);
    }
    case 'adaptation-surface': return evaluateSourceAdaptationSurface(assertion,context);
    case 'adaptation-text':
    case 'reserved-row-typography': return evaluateSourceAdaptationText(assertion,context);
    case 'row-status-badge': return evaluateSourceRowStatusBadge(assertion,context);
    case 'read-surface': {
      const observation = sourceReadObservation(assertion, context);
      if (!observation) return incomplete('No verified normal source opening and current projection');
      const {entry,current,triggered} = observation;
      if (expected.nativeFrame === sourceReadLoadingFrame) {
        const native = sourceReadLoadingNativeFrame(assertion,context,observation);
        if (!fullSample(sample) || !native) return report('NOT_RUN',
          'No attached and visible ArkUI loading frame for the verified read generation', null,[entry,triggered,current]);
        const state = native.loading.payload;
        const valid = count(state.count) && count(state.projected) && state.projected <= state.count;
        return conclude(valid,valid ? '' : 'The read projection has inconsistent source counts',
          {state:state.state,readFact:state.readFact,readGeneration:state.readGeneration,count:state.count,
            projected:state.projected,owner:state.owner,nativeObservation:native.sample.nativeObservation,
            nativeFrameEventSeq:native.frame.eventSeq,progressVisibleRatio:native.frame.payload.progressVisibleRatio},
          [entry,native.loading,native.frame]);
      }
      if (!fullSample(sample) || sample.captureComplete !== true ||
          sample.window.keyboard?.visible !== false || current.payload.state !== expected.state) {
        return report('NOT_RUN','The selected source state did not have a stable native window in the current opening',
          null, [entry,triggered,current]);
      }
      const state = current.payload;
      if (!count(state.count) || !count(state.projected) || !count(state.readGeneration) ||
          typeof state.readFact !== 'string' || !state.readFact) {
        return incomplete('The current source projection is missing its read facts or counts');
      }
      const coldFailure = expected.state === 'readFailure';
      const valid = state.projected <= state.count && (!coldFailure || (state.count === 0 &&
        ['failed','refreshFailed'].includes(state.readFact) && positiveInt(state.readGeneration)));
      return conclude(valid, valid ? '' : 'The current source projection contradicts the selected read state',
        {state:state.state, readFact:state.readFact, readGeneration:state.readGeneration,
          count:state.count, projected:state.projected, owner:state.owner}, [entry,current]);
    }
    case 'read-retry': {
      const opening = sourceReadObservation({...assertion,action:assertion.entryAction,sample:assertion.baseline},context);
      const failure = opening?.current;
      const initial = failure?.payload;
      if (!initial || initial.state !== 'readFailure' || !['failed','refreshFailed'].includes(initial.readFact) ||
          initial.count !== 0 || initial.projected !== 0 || !positiveInt(initial.readGeneration) || !fullSample(baseline) ||
          baseline.captureComplete !== true || baseline.window.keyboard?.visible !== false) {
        return report('NOT_RUN','No stable failed read and usable retry button in the current source opening',
          null,[opening?.entry,failure]);
      }
      const touchTarget = expected.requireNativeTouchTarget === true ?
        measureSourceNativeControl(baseline,readRetry) : undefined;
      if (touchTarget?.verdict === 'FAIL') {
        return report('FAIL',touchTarget.reason,{terminalObserved:false,nativeTouchTarget:touchTarget.actual},
          [opening.entry,failure],false);
      }
      if (!retryButtonUsable(baseline)) {
        return report('NOT_RUN','No stable failed read and usable retry button in the current source opening',
          null,[opening.entry,failure]);
      }
      if (!action || action.op !== 'click' || action.targetId !== readRetry || action.from !== assertion.baseline ||
          !fullSample(sample) || sample.captureComplete !== true || sample.window.keyboard?.visible !== false ||
          action.instanceId !== baseline.instanceId || action.instanceId !== sample.instanceId ||
          sample.window.id !== baseline.window.id || !count(baseline.afterSeq) || !count(action.beforeSeq) ||
          !count(action.afterSeq) || !count(sample.beforeSeq) ||
          baseline.afterSeq > action.beforeSeq || action.beforeSeq >= action.afterSeq || action.afterSeq > sample.beforeSeq) {
        return report('NOT_RUN','The new native sample does not follow the observed retry click',null,[opening.entry,failure]);
      }
      const edge = expected.position === 'top';
      const physicalEdge = edge && baseline.window.source === 'window-metrics' && sample.window.source === 'window-metrics' &&
        sameWindowLayout(baseline,sample) && sourceReadRetryNativeInteraction(assertion,baseline,action);
      if (edge && !physicalEdge) return report('NOT_RUN','No verified upper-edge command in the current native retry window',
        null,[opening.entry,failure]);
      const {current,started,settled,verified,observations} = sourceReadRetryReceipt(context,action,baseline,sample,initial);
      const proof = [opening.entry,failure,...observations];
      if (!verified) {
        return report('NOT_RUN','No unique retry owner receipt bound to the exact failed and new read generations',
          null,proof);
      }
      const terminal = current.payload;
      if (terminal.readGeneration !== settled.readGeneration || terminal.state === 'recovery') {
        return report('NOT_RUN','The admitted retry lacks its own stable terminal projection',null,proof);
      }
      if (!count(settled.count) || !count(terminal.count) || !count(terminal.projected) || !count(terminal.firstAnchor) ||
          !['current','failed','refreshFailed'].includes(settled.readFact)) {
        return report('NOT_RUN','The retry terminal projection lacks its measured owner facts',null,proof);
      }
      const nativeFailure = Boolean(oneNode(sample,readFailureTitle)) && retryButtonUsable(sample);
      const nativeEmpty = Boolean(oneNode(sample,sourceEmptyTitle));
      const nativeFirstRow = terminal.firstAnchor > 0 &&
        Boolean(oneNode(sample,{id:`reader-source-row-${terminal.firstAnchor}`,ancestors:[list]}));
      const repeatedFailure = settled.readFact !== 'current';
      const expectedState = repeatedFailure ? 'readFailure' : settled.count === 0 ? 'empty' : 'rows';
      const nativeMatches = expectedState === 'readFailure' ? nativeFailure && !nativeEmpty :
        expectedState === 'empty' ? nativeEmpty && !oneNode(sample,readRetry) :
          nativeFirstRow && !nativeEmpty && !oneNode(sample,readRetry);
      const valid = terminal.readFact === settled.readFact && terminal.count === settled.count &&
        terminal.state === expectedState && terminal.projected === terminal.count && (!repeatedFailure || terminal.count === 0) &&
        nativeMatches;
      const actual = {terminalObserved:true,failedReadGeneration:initial.readGeneration,startedReadGeneration:started.readGeneration,
        readGeneration:settled.readGeneration,expectedState,nativeFailure,nativeEmpty,nativeFirstRow,
        state:terminal.state,readFact:terminal.readFact,count:terminal.count,projected:terminal.projected,owner:terminal.owner,
        ...(touchTarget ? {nativeTouchTarget:touchTarget.actual} : {})};
      if (valid && touchTarget?.verdict === 'NOT_RUN') return report('NOT_RUN',touchTarget.reason,actual,proof);
      const nativeInteraction = valid && (physicalEdge || sourceNativeCenterInteraction(assertion,baseline,action));
      if (nativeInteraction) actual.nativeInteraction = nativeInteraction;
      return conclude(valid,valid ? '' : 'The bound retry owner and its native terminal surface disagree',actual,proof);
    }
    case 'retained-read-retry': {
      const base = {entryAction:'open-sources',returnAction:'return-settings',action:'reopen-sources',
        baseline:'retained-before',sample:assertion.baseline,expected:{readFact:'refreshFailed',requireNativeTouchTarget:true}};
      const retained = evaluateSourceRetainedReadFailure(base,context);
      const inherited = [{evidenceRefs:retained.evidenceRefs}];
      if (retained.verdict !== 'PASS') return report('NOT_RUN','No verified retained list and refresh control in the reopened failure',
        null,inherited);
      const initial = sourceReadObservation(base,context).current.payload;
      const nativeInteraction = sourceReadRetryNativeInteraction(assertion,baseline,action);
      if (!nativeInteraction || !pairedNativeEndpoint(action,baseline,sample,assertion.baseline) ||
          !sameWindowLayout(baseline,sample) || sample.captureComplete !== true ||
          sample.window.source !== 'window-metrics' || sample.window.keyboard?.visible !== false) {
        return report('NOT_RUN','No exact Refresh list tap between complete current native samples',null,inherited);
      }
      const {current,started,settled,verified,observations} = sourceReadRetryReceipt(context,action,baseline,sample,initial);
      const terminal = current?.payload;
      const proof = [...inherited,...observations];
      if (!verified || terminal.readGeneration !== settled.readGeneration || terminal.state === 'recovery' ||
          !['current','refreshFailed','failed'].includes(settled.readFact) ||
          ![settled.count,terminal.count,terminal.projected,terminal.firstAnchor].every(count)) {
        return report('NOT_RUN','No unique retained refresh receipt and stable terminal from the measured click',null,proof);
      }
      const repeatedFailure = settled.readFact !== 'current';
      const terminalState = repeatedFailure || settled.count > 0 ? 'rows' : 'empty';
      const nativeFirstRow = positiveInt(terminal.firstAnchor) &&
        Boolean(oneNode(sample,{id:`reader-source-row-${terminal.firstAnchor}`,ancestors:[list]}));
      const nativeEmpty = Boolean(oneNode(sample,sourceEmptyTitle));
      const refresh = sample.nodes.some(node=>node.visible === true && (node.id === expected.target || node.alias === expected.target));
      const retainedRefresh = repeatedFailure && measureSourceNativeControl(sample,expected.target).verdict === 'PASS';
      const nativeMatches = terminalState === 'rows' ? nativeFirstRow && !nativeEmpty &&
        (repeatedFailure ? retainedRefresh : !refresh) :
        nativeEmpty && !refresh && !nativeFirstRow && terminal.firstAnchor === 0;
      const valid = terminal.state === terminalState && terminal.count === settled.count && terminal.projected === terminal.count &&
        terminal.readFact === settled.readFact && sourceFilterKeys.every(key=>terminal[key] === initial[key]) &&
        (!repeatedFailure || settled.readFact === 'refreshFailed' && terminal.count === initial.count &&
          terminal.firstAnchor === initial.firstAnchor) && nativeMatches;
      return conclude(valid,valid ? '' : 'The admitted refresh did not reach its corresponding current retained-list or library surface',
        {terminalObserved:true,failedReadGeneration:initial.readGeneration,startedReadGeneration:started.readGeneration,
          readGeneration:settled.readGeneration,state:terminal.state,readFact:terminal.readFact,count:terminal.count,
          projected:terminal.projected,firstAnchor:terminal.firstAnchor,owner:terminal.owner,
          ...(valid ? {nativeInteraction} : {})},proof);
    }
    case 'retained-read-failure': return evaluateSourceRetainedReadFailure(assertion, context);
    case 'recovery-native-control': return evaluateSourceRecoveryControl(assertion, context);
    case 'source-control-action': return evaluateSourceControlAction(assertion, context);
    case 'recovery-body-text':
    case 'recovery-expand-edge': return evaluateSourceRecoveryBody(assertion,context);
    case 'import-research-status-action': return evaluateSourceImportResearchStatusAction(assertion, context);
    case 'surface-text': return evaluateSourceSurfaceText(assertion,context);
    case 'observed-load-branch': {
      if (!sample || !action) return incomplete('No stable native scenario for the conditional source read branch');
      const observed = eventsAt(context, action, sample, 'source.projection').at(-1);
      if (observed?.payload.state !== expected.state) return incomplete('The required external read/recovery condition did not occur');
      if (!expected.anchors.some(anchor => oneNode(sample, anchor)))
        return incomplete('The runtime read/recovery condition was seen without a complete corresponding native state sample');
      const state = observed.payload;
      const valid = expected.readFacts.includes(state.readFact);
      return conclude(valid,valid ? '' : 'The native branch does not match the qualified source-lookup outcome',
        {...state},[observed]);
    }
    case 'load-state': {
      if (!sample || !action || !fullSample(sample)) return incomplete('Missing a full normal entry sample for the source database state');
      const observed = eventsAt(context, action, sample, 'source.projection').at(-1);
      if (!observed) return incomplete('No verified source database owner observation');
      const native = Boolean(oneNode(sample, expected.anchor));
      const actual = {...observed.payload, native};
      const valid = observed.payload.state === expected.state && observed.payload.readFact === expected.readFact &&
        observed.payload.count === 0 && observed.payload.projected === 0 && native;
      return conclude(valid, valid ? '' : 'The native source-load surface differs from the specified owner state', actual, [observed]);
    }
    default: throw new Error(`Unknown source-management assertion ${assertion.kind}`);
  }
}

export function evaluateSource(assertion, context) {
  if (!assertion.acceptedSources.includes('native-tree') || !assertion.acceptedSources.includes('app-owner'))
    return { verdict:'NOT_RUN', reason:'Source relations require native geometry and the actual owner' };
  return sourceCheck(assertion, context);
}

import { ancestorsOf, evaluateLayout } from './layout.mjs';
import { effectiveAppearance } from './structure.mjs';

export const searchHistoryLoadingCase = 'bookshelf.search-entry-history-loading';
export const searchHistoryLoadingFixture = 'public-search-entry-history-loading-v1';
export const searchHistoryLoadingSample = 'history-loading';
export const searchHistoryStateEvent = 'search-entry-history-state';
export const searchHistoryEntryTarget = 'reader-bookshelf-search-entry';

const editorId = 'reader-book-search-input';
const viewportId = 'reader-search-history-viewport';
const feedbackId = 'reader-search-history-loading';
const openingId = 'search-open-accepted';
const projectionId = 'search-page-projection';
const routeFields = ['identity','navigation','mounting'];
const terminalHistory = new Set(['ready','loadFailed','clearFailed']);
const seq = value => Number.isSafeInteger(value) && value >= 0;
const sameRoute = (left,right) => routeFields.every(key=>left[key] === right[key]);
const eligible = ({payload}) => payload.historyStatus === 'loading' && payload.feedbackEligible === true;

function historyOpening(events, action, through) {
  if (action?.op !== 'click' || action.targetId !== searchHistoryEntryTarget || action.outcomeSettled === false ||
      !seq(action.beforeSeq) || !seq(action.afterSeq) || action.beforeSeq >= action.afterSeq) return null;
  const interval = events.filter(evt=>evt.channel === 'business' && evt.instanceId === action.instanceId &&
    evt.eventSeq > action.beforeSeq && evt.eventSeq <= through);
  const openings = interval.filter(evt=>evt.kind === openingId);
  const [opened] = openings;
  if (openings.length !== 1 || opened.eventSeq > action.afterSeq ||
      ![...routeFields,'queryRevision'].every(key=>seq(opened.payload[key]))) return null;
  const current = interval.filter(evt=>evt.eventSeq > opened.eventSeq);
  const settled = current.find(evt=>evt.kind === 'search-surface-settled' && evt.payload.mode === 'input' &&
    sameRoute(evt.payload,opened.payload) && evt.payload.queryRevision === opened.payload.queryRevision &&
    seq(evt.payload.owner) && evt.payload.owner > 0);
  if (!settled) return null;
  const scope = settled.payload;
  const editor = JSON.stringify([...routeFields.map(key=>scope[key]),scope.owner]);
  const projections = current.filter(evt=>evt.kind === projectionId && evt.payload.owner === scope.owner &&
    seq(evt.payload.page) && evt.payload.queryRevision === scope.queryRevision);
  const states = current.filter(evt=>evt.kind === searchHistoryStateEvent && evt.eventSeq > settled.eventSeq &&
    sameRoute(evt.payload,scope) && evt.payload.mode === 'input' && evt.payload.owner === scope.owner &&
    evt.payload.editorId === editor && ['opening-end','viewport'].includes(evt.payload.stage));
  const first = states[0];
  const projection = projections.at(-1);
  const superseded = current.some(evt=>evt.kind === 'search-submit-accepted' || evt.kind === 'search-route-released' ||
    evt.kind === 'search-page-owner-released' && evt.payload.owner === scope.owner ||
    evt.kind === 'search-surface-settled' && evt.eventSeq > settled.eventSeq &&
      (!sameRoute(evt.payload,scope) || evt.payload.mode !== 'input' || evt.payload.owner !== scope.owner ||
        evt.payload.queryRevision !== scope.queryRevision));
  const readyBeforePresentation = first?.payload.stage === 'opening-end' && first.payload.historyStatus === 'ready' &&
    first.payload.feedbackEligible === false && projections.findLast(evt=>evt.eventSeq <= first.eventSeq)?.payload.historyStatus === 'ready' &&
    !states.some(eligible);
  return {opened,settled,scope,states,projection,superseded,readyBeforePresentation};
}

export function searchHistoryLoadingWatchEnded(events, action) {
  const opening = historyOpening(events,action,Infinity);
  return opening?.states.length > 0 && terminalHistory.has(opening.projection?.payload.historyStatus);
}

function completeSample(sample, instanceId) {
  return sample?.captureComplete === true && sample.instanceId === instanceId && sample.window?.source === 'window-metrics' &&
    [sample.beforeSeq,sample.afterSeq].every(seq) && sample.beforeSeq < sample.afterSeq &&
    sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) && sample.evidenceRefs.some(ref=>ref.path.endsWith('.json'));
}

function visibleNodes(sample, predicate) {
  const relevant = sample.nodes.filter(node=>node.source === 'native-tree' && predicate(node))
    .map(node=>({node,visible:effectiveAppearance(sample,node).visible}));
  if (relevant.some(candidate=>candidate.visible === null)) return null;
  return relevant.filter(candidate=>candidate.visible).map(candidate=>candidate.node);
}

function historyLayout(assertion, sample) {
  const editor = visibleNodes(sample,node=>node.id === editorId && node.type === 'TextInput');
  const viewport = visibleNodes(sample,node=>node.id === viewportId);
  const feedback = visibleNodes(sample,node=>node.id === feedbackId);
  if (!editor || !viewport || !feedback) return 'NOT_RUN';
  if (editor.length !== 1 || viewport.length !== 1 || feedback.length !== 1) return 'FAIL';
  const spinners = visibleNodes(sample,node=>node.type === 'LoadingProgress' && ancestorsOf(sample,node).includes(feedback[0]));
  const labels = visibleNodes(sample,node=>node.type === 'Text' && ancestorsOf(sample,node).includes(feedback[0]));
  if (!spinners || !labels) return 'NOT_RUN';
  if (spinners.length !== 1 || !ancestorsOf(sample,feedback[0]).includes(viewport[0]) ||
      editor[0].enabled === false || viewport[0].clip === false) return 'FAIL';
  if (labels.some(label=>typeof label.searchHistoryLoadingLabel !== 'boolean')) return 'NOT_RUN';
  if (labels.filter(label=>label.searchHistoryLoadingLabel).length !== 1) return 'FAIL';
  if (editor[0].enabled !== true || viewport[0].clip !== true) return 'NOT_RUN';
  const samples = {[assertion.sample]:sample};
  const measure = (kind,a,b,expected) => evaluateLayout({kind,a,b,expected,sample:assertion.sample,
    sources:assertion.acceptedSources,tolerancePx:1}, samples).verdict;
  const checks = [
    measure('contain',feedbackId,viewportId,{maxOverflowVp:0}),
    measure('nonOverlap',feedbackId,editorId,{maxOverlapAreaVp2:0}),
  ];
  const keyboard = sample.window.keyboard;
  if (!keyboard || keyboard.revision !== sample.window.revision || typeof keyboard.visible !== 'boolean') return 'NOT_RUN';
  if (keyboard.visible) checks.push(measure('keyboardAvoidance',feedbackId,undefined,{maxOverlapAreaVp2:0}));
  return checks.includes('FAIL') ? 'FAIL' : checks.includes('NOT_RUN') ? 'NOT_RUN' : 'PASS';
}

export function evaluateSearchHistoryLoading(assertion, context) {
  const {actions = {},samples = {},events = []} = context;
  const baseline = samples[assertion.baseline], sample = samples[assertion.sample], action = actions[assertion.action];
  const current = historyOpening(events,action,sample?.afterSeq ?? Infinity);
  const {states = [],opened,settled,projection} = current ?? {};
  const applies = states.some(eligible);
  const actual = {applicability:applies ? 'APPLIES' : 'UNKNOWN'};
  const report = (verdict,reason) => ({verdict,reason,actual,expected:assertion.expected,
    evidenceRefs:[baseline,action,sample,opened,settled,projection,...states].flatMap(item=>item?.evidenceRefs ?? [])});
  const missing = reason=>report('NOT_RUN',reason);
  if (!current || !completeSample(baseline, action?.instanceId) || baseline.afterSeq > action.beforeSeq) {
    return missing('The normal public bookshelf opening and its same-instance Search input owner are unverified');
  }
  const captured = completeSample(sample,action.instanceId) && action.afterSeq <= sample.beforeSeq &&
    baseline.window.id === sample.window.id && !context.problems?.length && !current.superseded;
  if (!captured) return missing('No complete same-owner native sample covers this Search opening');
  if (current.readyBeforePresentation && projection?.payload.historyStatus === 'ready' &&
      projection.payload.projection === 'initial' && projection.payload.searchActive === false) {
    actual.applicability = 'DOES_NOT_APPLY';
    return missing('The current history read was already ready before the opening reached its interactive input viewport');
  }
  const viewport = states.at(-1);
  if (!viewport || !eligible(viewport) || viewport.eventSeq > sample.beforeSeq || projection?.eventSeq > sample.beforeSeq ||
      projection?.payload.projection !== 'initial' || projection.payload.searchActive !== false ||
      projection.payload.historyStatus !== 'loading') {
    return missing('No same-window native sample is bracketed by the current pending history viewport');
  }
  actual.currentNativeSample = true;
  actual.draftLength = viewport.payload.length;
  if (!seq(actual.draftLength)) return missing('The current input owner did not report the draft length');
  actual.nativeFeedback = historyLayout(assertion, sample);
  if (actual.draftLength !== assertion.expected.length || actual.nativeFeedback === 'FAIL') {
    return report('FAIL','The eligible Search opening changed its draft or did not keep loading feedback inside the current history viewport');
  }
  if (actual.nativeFeedback !== 'PASS') return missing('Native owner, feedback or window geometry is unverified');
  return report('PASS',null);
}

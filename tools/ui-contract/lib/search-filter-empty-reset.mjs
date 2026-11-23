import { ancestorsOf, publicSearchResultContinuity } from './layout.mjs';
import { effectiveAppearance } from './structure.mjs';

const filterEvent = 'search-filter-applied';
const filterTrigger = 'reader-search-filter-trigger';
const online = 'reader-search-filter-online';
const reset = 'reader-search-filter-reset';
const emptyMarker = 'reader-search-filtered-empty';
const publicResult = 'reader-search-public-local-result';
const positive = value => Number.isSafeInteger(value) && value > 0;
const complete = (sample,instanceId) => sample?.captureComplete === true && sample.instanceId === instanceId &&
  sample.window?.source === 'window-metrics' && sample.window.keyboard?.visible === false &&
  sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) && sample.evidenceRefs.some(ref=>ref.path.endsWith('.json'));
const within = (event,action) => event.eventSeq > action.beforeSeq && event.eventSeq <= action.afterSeq;
const follows = (first,next) => Number.isSafeInteger(first?.afterSeq) && Number.isSafeInteger(next?.beforeSeq) &&
  first.afterSeq <= next.beforeSeq;
const sameQuery = (event,query) => ['owner','page','queryRevision'].every(key=>event?.payload[key] === query[key]);

function nativeNode(sample, predicate) {
  const candidates = sample.nodes.filter(node=>node.source === 'native-tree' && predicate(node));
  const observed = candidates.map(node=>({node,visible:effectiveAppearance(sample,node).visible}));
  if (observed.some(item=>item.visible === null)) return {available:false};
  const matches = observed.filter(item=>item.visible === true);
  return {available:true,count:matches.length,node:matches.length === 1 ? matches[0].node : undefined};
}

function visibleButtonInFilter(sample, id) {
  const sheet = nativeNode(sample,node=>node.type === 'SheetPage' && node.sheetTitle === '筛选');
  const control = nativeNode(sample,node=>node.id === id && node.type === 'Button');
  if (!sheet.available || !control.available) return 'NOT_RUN';
  const button = control.node;
  if (!sheet.node || !button || button.enabled === false || button.clickable === false ||
      !ancestorsOf(sample,button).includes(sheet.node)) return 'FAIL';
  return button.enabled === true && button.clickable === true ? 'PASS' : 'NOT_RUN';
}

function resultView(sample, viewportId, filtered) {
  const list = nativeNode(sample,node=>node.type === 'List' && /^reader-search-result-list:\d+:\d+$/u.test(node.id ?? ''));
  const book = nativeNode(sample,node=>node.type === 'Button' && node.alias === publicResult && node.localSearchResult === true);
  const marker = nativeNode(sample,node=>node.id === emptyMarker);
  const sheet = nativeNode(sample,node=>node.type === 'SheetPage' && (node.sheetTitle === '筛选' || node.sheetTitle === '搜索进度'));
  if (![list,book,marker,sheet].every(entry=>entry.available)) return {verdict:'NOT_RUN'};
  const desired = filtered ? marker : book;
  const hidden = filtered ? book : marker;
  const matches = sheet.count === 0 && list.node?.id === viewportId && desired.node &&
    hidden.count === 0 && ancestorsOf(sample,desired.node).includes(list.node);
  return {verdict:matches ? 'PASS' : 'FAIL',book:book.node,observedViewport:list.node?.id ?? null,
    visiblePublicResults:book.count,visibleEmptyMarkers:marker.count};
}

export function evaluateSearchFilterEmptyReset(assertion, context) {
  const {actions = {},samples = {},events = []} = context;
  const before = samples[assertion.baseline], restored = samples[assertion.sample];
  const filtered = samples['filtered-empty'], firstPanel = samples['filter-open'], secondPanel = samples['reset-open'];
  const submit = actions[assertion.priorAction], choose = actions[assertion.action];
  const open = actions['open-filter'], hide = actions['hide-filter'], reopen = actions['reopen-filter'];
  const clear = actions['reset-filter'], close = actions['close-reset'];
  const used = [before,restored,filtered,firstPanel,secondPanel,submit,choose,open,hide,reopen,clear,close];
  const instance = before?.instanceId;
  const business = events.filter(event=>event.instanceId === instance && event.channel === 'business');
  const matching = (kind,first,last,predicate=()=>true) => business.filter(event=>event.kind === kind &&
    event.eventSeq > first && event.eventSeq <= last && predicate(event));
  const inAction = (kind,action,predicate=()=>true) => matching(kind,action.beforeSeq,action.afterSeq,predicate);
  const report = (verdict,reason,actual=null) => ({verdict,reason,actual,expected:assertion.expected,
    evidenceRefs:used.flatMap(item=>item?.evidenceRefs ?? [])});
  const incomplete = reason => report('NOT_RUN',reason);
  const actionMatches = (action,op,from,target) => action?.instanceId === instance && action.op === op &&
    action.from === from && (op === 'keyEvent' ? action.key === 'Back' : action.targetId === target) &&
    positive(action.beforeSeq) && action.afterSeq > action.beforeSeq;
  const currentWindow = sample => complete(sample,instance) && sample.window.id === before.window.id;
  if (!complete(before,instance) || !actionMatches(submit,'click','submit-ready','reader-bookshelf-search-submit') ||
      !follows(submit,before)) return incomplete('No complete normal Search submission and unfiltered native result');
  const submitted = inAction('search-submit-accepted',submit);
  const projections = matching('search-page-projection',submit.beforeSeq,before.beforeSeq);
  const baseline = projections.at(-1);
  const query = baseline?.payload;
  used.push(...submitted,baseline);
  if (submitted.length !== 1 || !query || query.projection !== 'results' || query.operation !== 'current' ||
      query.searchActive !== false || query.resultCount !== assertion.expected.resultCount ||
      query.visibleCount !== assertion.expected.resultCount || !positive(query.owner) || !positive(query.page) ||
      !positive(query.queryRevision) || !positive(query.operationGeneration) ||
      submitted[0].payload.queryRevision !== query.queryRevision ||
      submitted[0].payload.writeLease?.generation !== query.operationGeneration) {
    return incomplete('The public local fixture has no one settled unfiltered query and work generation');
  }
  const viewportId = `reader-search-result-list:${query.page}:${query.queryRevision}`;
  if (query.viewportId !== viewportId) return incomplete('The unfiltered projection does not own its native viewport');
  const anchor = resultView(before,viewportId,false);
  if (anchor.verdict !== 'PASS') return report(anchor.verdict,'The current unfiltered List must show the public local result');

  const selectReady = actionMatches(open,'click',assertion.baseline,filterTrigger) && follows(before,open) &&
    currentWindow(firstPanel) && follows(open,firstPanel);
  if (!selectReady) return incomplete('No complete native filter opening for the original query');
  const firstOpening = inAction('search-page-action',open,event=>event.payload.action === 'panel-open' && event.payload.panel === 'filter');
  used.push(...firstOpening);
  if (firstOpening.length !== 1 || !sameQuery(firstOpening[0],query)) return incomplete('No unique current Filter Sheet owner');
  const selectionControl = visibleButtonInFilter(firstPanel,online);
  if (selectionControl !== 'PASS') return report(selectionControl,'No usable Online button in the current native filter Sheet');
  if (!actionMatches(choose,'click','filter-open',online) || !follows(firstPanel,choose)) {
    return incomplete('No native Online selection from the measured filter');
  }

  const selected = inAction(filterEvent,choose);
  used.push(...selected);
  if (!selected.length) return incomplete('The native Online selection has no current owner observation');
  const filteredFact = selected[0].payload;
  const expectedResultCount = assertion.expected.resultCount;
  const projectionMatches = (event,action,scope,visibleCount) => sameQuery(event,query) &&
    event.payload.action === action && event.payload.scope === scope && event.payload.content === 'all' &&
    event.payload.resultCount === expectedResultCount && event.payload.visibleCount === visibleCount &&
    event.payload.viewportId === viewportId && event.payload.workGeneration === query.operationGeneration &&
    positive(event.payload.panelGeneration);
  const filterResult = {queryRevision:query.queryRevision,workGeneration:query.operationGeneration,
    viewportId,filteredCount:filteredFact.visibleCount};
  if (selected.length !== 1 || !projectionMatches(selected[0],'scope','online',0)) {
    return report('FAIL','The Online filter did not project zero rows while preserving the settled query and its retained result',filterResult);
  }
  if (!actionMatches(hide,'keyEvent','selected-online') || !follows(choose,hide) ||
      !currentWindow(filtered) || !follows(hide,filtered)) return incomplete('No complete native filtered-empty endpoint after the first Sheet closes');
  const firstClose = inAction('search-page-action',hide,event=>event.payload.action === 'panel-dismiss' && event.payload.panel === 'filter');
  used.push(...firstClose);
  if (firstClose.length !== 1 || !sameQuery(firstClose[0],query)) return incomplete('No same-query Filter Sheet dismissal');
  const filteredView = resultView(filtered,viewportId,true);
  if (filteredView.verdict !== 'PASS')
    return report(filteredView.verdict,'The native filtered List did not replace the local row with the filtered-empty state',filterResult);

  if (!actionMatches(reopen,'click','filtered-empty',filterTrigger) || !follows(filtered,reopen) ||
      !currentWindow(secondPanel) || !follows(reopen,secondPanel))
    return incomplete('No complete second native filter opening');
  const secondOpening = inAction('search-page-action',reopen,event=>event.payload.action === 'panel-open' && event.payload.panel === 'filter');
  used.push(...secondOpening);
  if (secondOpening.length !== 1 || !sameQuery(secondOpening[0],query)) return incomplete('No unique reopened Filter Sheet owner');
  const resetControl = visibleButtonInFilter(secondPanel,reset);
  if (resetControl !== 'PASS') return report(resetControl,'No usable Reset button in the reopened native filter Sheet');
  if (!actionMatches(clear,'click','reset-open',reset) || !follows(secondPanel,clear)) return incomplete('No native Reset press');
  const applied = inAction(filterEvent,clear);
  used.push(...applied);
  if (!applied.length) return incomplete('The native Reset press has no current owner observation');
  if (applied.length !== 1 || !projectionMatches(applied[0],'reset','all',expectedResultCount) ||
      applied[0].payload.panelGeneration !== filteredFact.panelGeneration+1) {
    return report('FAIL','Reset did not restore the default projection on the reopened owner and original work',filterResult);
  }
  if (!actionMatches(close,'keyEvent','reset-applied') || !follows(clear,close) ||
      !currentWindow(restored) || !follows(close,restored)) return incomplete('No complete restored native results after the second Sheet closes');
  const secondClose = inAction('search-page-action',close,event=>event.payload.action === 'panel-dismiss' && event.payload.panel === 'filter');
  used.push(...secondClose);
  if (secondClose.length !== 1 || !sameQuery(secondClose[0],query)) return incomplete('No same-query dismissal after Reset');
  const repeats = matching('search-submit-accepted',before.beforeSeq,restored.beforeSeq);
  const releases = matching('search-route-released',before.beforeSeq,restored.beforeSeq);
  const changed = matching('search-page-projection',before.beforeSeq,restored.beforeSeq,event=>
    !sameQuery(event,query) || event.payload.operationGeneration !== query.operationGeneration);
  used.push(...repeats,...releases,...changed);
  if (repeats.length || releases.length || changed.length)
    return report('FAIL','Filtering changed the query, Search route, or active work generation',filterResult);
  const restoredView = resultView(restored,viewportId,false);
  if (restoredView.verdict !== 'PASS')
    return report(restoredView.verdict,'The current Reset List did not restore its visible public local result',filterResult);
  const continuity = publicSearchResultContinuity(anchor.book,restoredView.book);
  if (!continuity) return incomplete('No trustworthy private-to-the-replay identity for the retained public local book');
  const matchBook = continuity.sameBook && continuity.beforePage === query.page &&
    continuity.afterPage === query.page && continuity.beforeQuery === query.queryRevision &&
    continuity.afterQuery === query.queryRevision;
  return report(matchBook ? 'PASS' : 'FAIL',matchBook ? '' : 'Reset restored a different book or query owner',
    {...filterResult,restoredCount:applied[0].payload.visibleCount,sameBook:continuity.sameBook});
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectedProductionMethods, selectedProductionClasses, selectedProductionComponentCallback } from './lib/selected-production-methods.mjs';
import { tailControls, compileTailConsumer } from './lib/foundation-tail-consumer-probe.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'list-touch-receipts': 'Accepted List Up/Cancel releases the original query after live input loss and applies its deferred publication, while new and stale-query input stays rejected.',
  'native-panel-receipts': 'Actual filter/task native dismissal clears original expanded and input ownership after live input loss, preserving new-action and stale-query rejection.',
});
const root = new URL('../entry/src/main/ets/', import.meta.url);
const file = name => new URL(name, root);
const TouchType = { Down: 0, Up: 1, Cancel: 2 };
const ScrollSource = { DRAG: 0, FLING: 1, OTHER_USER_INPUT: 2, SCROLL_BAR: 3, SCROLL_BAR_FLING: 4 };

function setup() {
  const storage = new Map([['readerAppForeground', true]]);
  const nativePorts = { TouchType, ScrollSource,
    AppStorage: { get: key => storage.get(key), setOrCreate: (key, value) => storage.set(key, value) },
    ReaderWindowCoordinator: { reapplyChrome() {}, reapplyWindowPolicy() {}, requestAppChrome() {} },
    ReaderDocumentPickerActivity: { setForeground() {} },
  };
  const Ability = selectedProductionMethods(file('entryability/EntryAbility.ets'), 'EntryAbility',
    ['onBackground', 'onForeground'], nativePorts);
  const ability = Object.assign(new Ability(), { coreCopyOnly: false, runtimeOwner: undefined });
  const index = { route: 'search', arkWebCapturesInput: false };
  Object.defineProperty(index, 'searchAppForeground', { get: () => storage.get('readerAppForeground') });
  const visible = selectedProductionComponentCallback(file('pages/Index.ets'), 'LibrarySearchResults', 'isVisible', index);
  const Publication = selectedProductionClasses(file('features/search/presentation/SearchPublication.ts'), ['SearchPublication']).SearchPublication;
  const publication = new Publication();
  const frames = [];
  const replacements = [];
  const controls = tailControls();
  const methods = ['resultsContent', 'onListTouch', 'onListScrollStop', 'onListWillScroll', 'ownsList', 'ownsPageQuery',
    'pageInputCurrent', 'acceptPublication', 'refreshVisibleResults', 'scheduleDeferredResults',
    'filterPresentationIdentity', 'taskStatusIdentity', 'acceptsFilter', 'acceptsTaskStatus',
    'dismissSearchFilters', 'dismissTaskStatus', 'searchPanelOwnsInput', 'publishSurfacePanelInput',
    'ownsSurface', 'finishNativePanel', 'releaseNativePanelChrome', 'publishSurface'];
  const { owner: page } = compileTailConsumer(readFileSync(file('features/search/ui/SearchPage.ets'), 'utf8'), methods,
    { ...controls.dependencies, ...nativePorts, readerAppColor: () => '#fff',
      readerScrollStartOffset: () => 0, readerScrollEndOffset: () => 0, KeyType: { Down: 0 },
      SearchLayoutFrame: class { constructor(_context, action) { this.action = action; } },
    }, { ...controls.hooks, componentName: 'SearchPage' });
  const model = { owner: 11, interactive: true, owns(value) { return value === this.owner; } };
  Object.assign(page, { pageMounted: true, listMounted: true, pageEpoch: 4, queryAtMount: 8,
    viewState: { pageRevision: 4, revision: 8, anchorAtStart: false }, viewStateRevision: 8,
    isPresentationCurrent: () => true, isPresentationVisible: visible,
    presentation: { kind: 'results', results: [] }, publication, publicationRevision: 2,
    visibleGroups: [], resultScroller: {}, resultDataSource: { totalCount: () => 0,
      replace(groups) { replacements.push(groups); return false; } },
    retainedViewportPending: false, userInteracting: false, userScrolling: false, resultsDeferred: false,
    resultFlushEpoch: 0, displayIdleRevision: 0, surfaceModel: undefined, surfaceOwner: 11,
    filtersExpanded: false, taskStatusExpanded: false, filterGeneration: 2, taskStatusGeneration: 3,
    cancelSearchFocusRestore() {}, cancelScrollRestoreForUser() {}, saveScrollAnchor() {},
    mainSearchNotices() {}, searchOuterInset: () => 0, scrollLayout: () => ({}), resultViewportId: () => 'results',
    restoreClosedPanelFocus() {}, acceptResultNoticeFacts() {}, publishVisibleGroups() {},
    groupResults: rows => rows, scheduleScrollRestore() {},
    getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
  });
  page.resultsContent();
  const list = [...page.nodes.values()].find(node => typeof node.onTouch === 'function' && typeof node.onScrollStop === 'function');
  assert.ok(list, 'actual SDK List callbacks');
  return { page, list, ability, publication, model, replacements, frames,
    flushFrames() { for (const frame of frames.splice(0)) frame.action(); } };
}

function listTouchReceipts() {
  const reports = [];
  for (const tail of ['Up', 'Cancel']) {
    const { page, list, ability, publication, replacements, flushFrames } = setup();
    list.onTouch({ type: TouchType.Down });
    assert.equal(page.userInteracting, true);
    const latest = { kind: 'results', results: [{ bookId: `latest-${tail}` }] };
    publication.publish(latest); page.acceptPublication();
    assert.equal(page.resultsDeferred, true);
    assert.equal(replacements.length, 0);
    ability.onBackground();
    assert.equal(page.pageInputCurrent(), false); assert.equal(page.ownsList(), true);
    list.onTouch({ type: TouchType[tail] });
    assert.equal(page.userInteracting, false);
    assert.equal(page.displayIdleRevision, 1);
    assert.equal(replacements.length, 0, 'pressed native row stays until the queued frame');
    ability.onForeground(); flushFrames();
    assert.equal(page.resultsDeferred, false);
    assert.equal(page.visibleGroups, latest.results);
    assert.deepEqual(replacements, [latest.results]);
    reports.push({ tail, deferredPublicationApplied: true });
  }
  {
    const { page, list, ability } = setup();
    ability.onBackground(); list.onTouch({ type: TouchType.Down });
    assert.equal(page.userInteracting, false); assert.equal(page.resultFlushEpoch, 0);
    list.onWillScroll(10, 0, ScrollSource.DRAG);
    assert.equal(page.userScrolling, false);
    ability.onForeground(); list.onTouch({ type: TouchType.Down });
    assert.equal(page.userInteracting, true);
    page.viewState.revision += 1;
    list.onTouch({ type: TouchType.Up });
    assert.equal(page.userInteracting, true, 'old mounted query cannot clean a replacement query');
    assert.equal(page.displayIdleRevision, 0);
    reports.push({ lostNewDownRejected: true, recoveredDownAccepted: true, staleQueryTailRejected: true });
  }
  {
    const { page, list, ability } = setup();
    list.onWillScroll(10, 0, ScrollSource.DRAG);
    assert.equal(page.userScrolling, true);
    ability.onBackground(); list.onScrollStop();
    assert.equal(page.userScrolling, false);
    reports.push({ acceptedScrollStopReleased: true });
  }
  return reports;
}

function nativePanelReceipts() {
  const Binding = selectedProductionClasses(file('features/search/ui/SearchResultSheetBinding.ets'),
    ['SearchResultSheetBinding'], { readerAppColor: () => '#fff', readerSurfaceElevation: () => ({}),
      SheetSize: { FIT_CONTENT: 1 }, SheetType: { BOTTOM: 1 }, DismissReason: { PRESS_BACK: 1 },
    }).SearchResultSheetBinding;
  const reports = [];
  for (const kind of ['filter', 'task']) {
    for (const staleQuery of [false, true]) {
      const { page, model, ability } = setup();
      page.surfaceModel = model;
      const expandedField = kind === 'filter' ? 'filtersExpanded' : 'taskStatusExpanded';
      page[expandedField] = true;
      const id = kind === 'filter' ? page.filterPresentationIdentity() : page.taskStatusIdentity();
      page.nativePanel = { kind, identity: id, chromeClaimed: false };
      const component = kind === 'filter' ? 'ReaderSearchFilterPanel' : 'ReaderSearchTaskPanel';
      const Panel = selectedProductionMethods(file(`features/search/ui/${component}.ets`), component,
        ['accepts', 'sheetOptions'], { resolveSheetSpec: () => ({}) });
      const panel = Object.assign(new Panel(), { mounted: true, expanded: true, presentationIdentity: id,
        nativeSheet: new Binding(), scheme: 'day', sheetSpec: () => ({}), sheetWidth: () => 300,
        onNativeOpening() {},
      });
      for (const property of ['onNativeClosing', 'onDismiss', 'onClosed']) {
        panel[property] = selectedProductionComponentCallback(file('features/search/ui/SearchPage.ets'), component, property, page);
      }
      const options = panel.sheetOptions(id);
      options.onWillAppear(); options.onAppear();
      ability.onBackground();
      assert.equal(page.acceptsFilter(id), false); assert.equal(page.acceptsTaskStatus(id), false);
      if (staleQuery) {
        page.viewState.revision += 1;
        const replacementId = kind === 'filter' ? page.filterPresentationIdentity() : page.taskStatusIdentity();
        page.nativePanel = { kind, identity: replacementId, chromeClaimed: false };
        model.panelOwnsInput = true;
      }
      options.onDisappear();
      ability.onForeground(); page.publishSurfacePanelInput();
      assert.equal(page[expandedField], staleQuery);
      assert.equal(model.panelOwnsInput, staleQuery);
      assert.equal(page.nativePanel === undefined, !staleQuery);
      reports.push({ kind, staleQuery, originalDismissalCompleted: !staleQuery, replacementPreserved: staleQuery });
    }
  }
  return reports;
}

for (const id of selected) {
  const result = { 'list-touch-receipts': listTouchReceipts, 'native-panel-receipts': nativePanelReceipts }[id]();
  console.log(JSON.stringify({ case: id, result, scope: 'Actual source methods and SDK List callbacks. Native storage/window IO, frame scheduling, result projection and geometry/focus are finite ports. Native event ordering is NOT_RUN.' }));
  recordContractCasePass(id);
}

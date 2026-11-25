import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectedProductionMethods, selectedProductionComponentCallback, selectedProductionValues } from './lib/selected-production-methods.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { readerDirectoryBookState } from '../entry/src/main/ets/features/reading/presentation/ReaderDirectorySessionState.ts';
import { sameReaderDirectoryData } from '../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'sheet-token-recovery': 'Actual book/More leaf rejects live-retired token before one-shot state and accepts a fresh same-opening token after input returns.',
  'source-choice-recovery': 'Actual Source option does not first collapse while live-retired and the same panel can accept after input returns.',
  'shelf-local-admission': 'Actual More icon, book tokens, More tokens and book selection consume original live input.',
  'source-filter-admission': 'Actual category/status/group inputs and clear consume the existing live management owner.',
  'directory-consumer-admission': 'All semantic/flat directory consumers forward original live input to first local fold/retry/clear and tools.',
});

function shelfLocalAdmission() {
const root = new URL('../entry/src/main/ets/', import.meta.url);
const source = path => new URL(path, root);
const chrome = [];
const Page = selectedProductionMethods(source('features/bookshelf/ui/BookshelfPage.ets'), 'BookshelfPage', [
  'bookActionPresentationHandler', 'bookActionFocusKey', 'isShelfPresentationCurrent', 'presentBookActionSheet',
  'isCurrentBookActionSheet', 'claimBookActionChrome',
  'performBookAction', 'finishBookActionSheet', 'bookSelectionHandler',
], {
  ReaderWindowCoordinator: { requestOverlayChrome: style => chrome.push(style), requestAppChrome() {} },
  readerAppColor: role => role, readerScrimmedOpaqueColor: (paper, mask) => `${paper}/${mask}`,
  ReaderWindowChromeStyle: class { constructor(paper, mode, ink) { Object.assign(this, { paper, mode, ink }); } },
});
const Scene = selectedProductionMethods(source('features/bookshelf/ui/BookshelfScene.ets'), 'BookshelfScene', ['isCurrent', 'isInteractive']);
const Journey = selectedProductionMethods(source('app/composition/ReaderLibraryJourney.ets'), 'ReaderLibraryJourney', ['isCurrentBookshelf', 'isInteractiveBookshelf']);
const Index = selectedProductionMethods(source('pages/Index.ets'), 'Index', ['bookshelfContentAcceptsInput']);
const SheetList = selectedProductionMethods(source('features/bookshelf/ui/ReaderSheetActionList.ets'), 'ReaderSheetActionList',
  ['dispatchToken', 'dispatch', 'presentationFromToken', 'actionId']);
const Shell = selectedProductionMethods(source('features/bookshelf/ui/BookshelfShell.ets'), 'BookshelfShell',
  ['isCurrentMoreSheet', 'moreIntentAction', 'dismissMoreMenu', 'finishMoreSheet']);

function sample(foregroundLost) {
  const runtime = {}, book = { sourceId: 'local', bookId: 'retained-book', title: 'Existing book' };
  const index = Object.assign(new Index(), { route: 'bookshelf', arkWebCapturesInput: false,
    readingEntryActions: { shelfPreparing: false }, readingEntry: { sessionActive: false },
    bookshelfModalVisible: () => false, sourceSwitchPresentation: { isSurfacePresented: () => false },
    mangaSourceSwitch: { selectionVisible: false }, searchAppForeground: true });
  const journey = Object.assign(new Journey(), {
    navigation: { snapshot: () => ({ route: index.route, generation: 9 }) },
    ports: { scope: () => ({ owner: runtime, mounting: 3, retired: false }),
      ownsRuntime: value => value === runtime, acquisition: () => ({ currentOwner: () => runtime }),
      bookshelfInputAllowed: () => index.searchAppForeground && index.bookshelfContentAcceptsInput() },
  });
  const scene = Object.assign(new Scene(), { ports: {
    isCurrent: navigation => journey.isCurrentBookshelf(navigation, runtime, 3),
    isInteractive: navigation => journey.isInteractiveBookshelf(navigation, runtime, 3),
  } });
  const page = Object.assign(new Page(), { mounted: true, navigationGeneration: 9, books: [book],
    actionBook: undefined, actionSheetRevision: 0, actionSheetId: '', bookActionSheetVisible: false,
    isCurrentShelfInput: navigation => scene.isInteractive(navigation),
    currentVisibleBook: selection => selection === book ? book : undefined,
    isCurrentChromeHost: navigation => scene.isCurrent(navigation),
    restoreBookActionFocus() {},
    bookActionSheetSpec: () => ({ hostMaskRole: 'mask', hostBackgroundRole: 'surface' }), appThemeScheme: 'day' });
  const controls = iconButtonControls();
  const icon = controls.icon.owner;
  Object.assign(icon, { icon: {}, specId: 'toolbar-wide', accessibilityLabel: 'Existing book更多操作',
    onTap: page.bookActionPresentationHandler(book, true) });
  icon.aboutToAppear(); icon.initialRender();
  const native = controls.nodes(icon).find(node => node.type === 'Button');
  assert.ok(native?.onClick);
  const retainedNativeCallback = native.onClick;
  if (foregroundLost) index.searchAppForeground = false;
  const inputAllowedBefore = page.isCurrentShelfInput(9);
  retainedNativeCallback();
  const chromeBefore = chrome.length;
  if (page.bookActionSheetVisible) page.claimBookActionChrome(page.actionSheetId, book);
  const opening = { foregroundLost, inputAllowedBefore, nativeEnabledAtCapture: native.enabled,
    sheetVisible: page.bookActionSheetVisible, actionSheetId: page.actionSheetId,
    overlayChromeRequests: chrome.length - chromeBefore };
  // A separate ordinary case starts with a legitimately open sheet, then loses
  // admission before its already captured action token is delivered.
  index.searchAppForeground = true;
  page.actionBook = undefined; page.bookActionSheetVisible = false;
  page.bookActionPresentationHandler(book, true)();
  let acceptedBookActions = 0;
  const list = Object.assign(new SheetList(), { mounted: true, presentationId: page.actionSheetId, dispatchedId: '',
    isCurrent: identity => page.isCurrentBookActionSheet(identity, book),
    onBookInfo: () => page.performBookAction(page.actionSheetId, book, () => {
      if (scene.isInteractive(9)) acceptedBookActions += 1;
    }) });
  // Exact token received by the normal shared action renderer. All four actions
  // share this admission method and the Page's pending-action boundary.
  if (foregroundLost) index.searchAppForeground = false;
  const bookActionInputAllowedBefore = scene.isInteractive(9);
  list.dispatchToken(`${page.actionSheetId}::book-info`);
  const pendingBookActionWhileUnavailable = typeof page.pendingBookAction === 'function';
  index.searchAppForeground = false;
  assert.equal(typeof page.pendingBookAction, foregroundLost ? 'undefined' : 'function');
  index.searchAppForeground = true;
  page.finishBookActionSheet(page.actionSheetId, book);
  let acceptedImports = 0;
  const shell = Object.assign(new Shell(), { mounted: true, navigationGeneration: 9,
    moreMenuVisible: true, moreSelectionId: 'more-1', moreSheetCurrentId: 'more-1', moreSheetNavigation: 9,
    temporaryBackIdentity: 'shelf-back', releaseMoreSheetChrome() {},
    isCurrentShelfInput: selectedProductionComponentCallback(source('features/bookshelf/ui/BookshelfScene.ets'), 'BookshelfShell', 'isCurrentShelfInput', scene),
    onImportRequested: () => { if (scene.isInteractive(9)) acceptedImports += 1; } });
  const importAction = selectedProductionComponentCallback(source('features/bookshelf/ui/BookshelfShell.ets'),
    'BookshelfMoreActionSheet', 'onLocalImport', shell, { presentationId: 'more-1' });
  if (foregroundLost) index.searchAppForeground = false;
  const moreInputAllowedBefore = scene.isInteractive(9);
  importAction();
  const pendingImportWhileUnavailable = typeof shell.afterMoreClose === 'function';
  index.searchAppForeground = true;
  shell.finishMoreSheet('more-1');
  let viewportSaves = 0;
  const selections = [];
  page.saveShelfViewport = () => viewportSaves++;
  page.measureBookOrigin = () => assert.fail('book selection must skip cover measurement');
  page.onBookSelected = (...args) => selections.push(args);
  const read = page.bookSelectionHandler(() => book, true);
  if (foregroundLost) index.searchAppForeground = false;
  read();
  assert.equal(viewportSaves, foregroundLost ? 0 : 1);
  assert.deepEqual(selections, foregroundLost ? [] : [[book, 9]]);
  return { ...opening, viewportSaves, selections: selections.length, bookAction: { inputAllowedBefore: bookActionInputAllowedBefore,
    pendingWhileUnavailable: pendingBookActionWhileUnavailable, deliveredAfterForegroundReturn: acceptedBookActions },
    moreImportAction: { inputAllowedBefore: moreInputAllowedBefore, pendingWhileUnavailable: pendingImportWhileUnavailable,
      deliveredAfterForegroundReturn: acceptedImports } };
}

const current = sample(false), foregroundLost = sample(true);
assert.equal(current.sheetVisible, true);
assert.equal(current.overlayChromeRequests, 1);
assert.equal(current.bookAction.deliveredAfterForegroundReturn, 1);
assert.equal(current.moreImportAction.deliveredAfterForegroundReturn, 1);
assert.equal(foregroundLost.inputAllowedBefore, false);
assert.equal(foregroundLost.sheetVisible, false);
assert.equal(foregroundLost.overlayChromeRequests, 0);
assert.equal(foregroundLost.bookAction.pendingWhileUnavailable, false);
assert.equal(foregroundLost.bookAction.deliveredAfterForegroundReturn, 0);
assert.equal(foregroundLost.moreImportAction.pendingWhileUnavailable, false);
assert.equal(foregroundLost.moreImportAction.deliveredAfterForegroundReturn, 0);
return { current, foregroundLost };
}

function sourceFilterAdmission() {
const root = new URL('../entry/src/main/ets/', import.meta.url);
const file = path => new URL(path, root);
const Surface = selectedProductionMethods(file('features/source/ui/SourceJourneySurface.ets'), 'SourceJourneySurface', ['managementInputIsCurrent']);
const pageSource = readFileSync(file('features/source/ui/SourceManagementPage.ets'), 'utf8');
const methods = ['managementOpeningIsCurrent', 'managementInputIsCurrent', 'toggleGroupSelection', 'ownsGroupSelection',
  'commitGroupSelection', 'clearFilters', 'groupCloseAction', 'dismissGroupSelection', 'retireGroupSelection', 'chip', 'categoryFilter'];
function sample(lost) {
  let live = true, projections = 0;
  const surface = Object.assign(new Surface(), { mounted: true, identity: 'current', isInputAllowed: () => live,
    presentation: { isManagementCurrent: id => id === 'current' } });
  const controls = foundationControls();
  const page = createReaderBuilderProbe(pageSource, methods, { ...controls.dependencies, ScrollDirection: { Horizontal: 0 }, sourceTemporaryGeneration: 0,
    readerSourceCategoryLabel: category => category }, controls.hooks).owner;
  Object.assign(page, { mounted: true, appForeground: true, isOpeningCurrent: () => surface.presentation.isManagementCurrent(surface.identity),
    isInputAllowed: () => surface.managementInputIsCurrent(), groupOpen: false, groupClosing: false, groupSelectionId: '',
    groupValue: '全部分组', statusValue: '全部', categoryValue: 'all', searchQuery: '', appThemeScheme: 'day',
    requestGroupClose: () => false, groupOptions: () => ['全部分组', '当前分组'], cancelGroupFocus() {}, cancelToolsReturnFocus() {},
    rebuildSourceProjection: () => projections++, toolsFocusId: () => 'tools', groupTriggerFocusId: () => 'group', scheduleGroupFocus() {},
    filterControlWidth: () => 280, contentFrame: () => ({ width: 280 }), layoutBudget: () => ({ filterHeight: 44 }) });
  const trigger = createReaderBuilderProbe(readFileSync(file('ui/controls/ReaderSelect.ets'), 'utf8'), ['phoneTrigger', 'triggerEnabled']).owner;
  Object.assign(trigger, { mounted: true, actionEnabled: true, variant: 'sourceGroup', focusId: 'group', options: page.groupOptions(),
    value: page.groupValue, isOpen: false, trigger() {}, triggerHeight: () => 44, onToggle: () => page.toggleGroupSelection() });
  trigger.phoneTrigger();
  const nativeTrigger = [...trigger.nodes.values()].find(node => node.type === 'Button');
  page.chip('启用', 58, true); page.categoryFilter();
  const nativeChip = controls.nodes(page).find(node => node.type === 'Button' && node.accessibilityText === '书源状态，启用');
  const nativeCategory = controls.nodes(page).find(node => node.type === 'Button' && node.accessibilityText === '书源类型，comic');
  assert.ok(nativeChip && nativeCategory);
  if (lost) { live = false; page.appForeground = false; }
  nativeChip.onClick(); nativeCategory.onClick(); nativeTrigger.onClick();
  assert.equal(page.groupOpen, !lost);
  assert.equal(page.statusValue, lost ? '全部' : '启用');
  assert.equal(page.categoryValue, lost ? 'all' : 'comic');
  if (lost) {
    live = true; page.appForeground = true; nativeTrigger.onClick(); live = false; page.appForeground = false;
  }
  page.commitGroupSelection('当前分组', page.groupSelectionId);
  assert.equal(page.groupValue, lost ? '全部分组' : '当前分组');
  const close = page.groupCloseAction(page.groupSelectionId); close();
  assert.equal(page.groupClosing, false, 'finite close receiver is not the cleanup owner');
  page.dismissGroupSelection(page.groupSelectionId);
  assert.equal(page.groupOpen, false, 'native dismissal completes while live input is unavailable');
  page.searchQuery = 'existing'; page.categoryValue = 'comic'; page.statusValue = '启用';
  page.clearFilters();
  assert.equal(page.searchQuery, lost ? 'existing' : '');
  assert.equal(page.categoryValue, lost ? 'comic' : 'all');
  assert.equal(projections, lost ? 0 : 4);
  return { lost, projections, query: page.searchQuery, nativeCleanupCompleted: true };
}
return [sample(false), sample(true)];
}

function directoryConsumerAdmission() {
const root = new URL('../', import.meta.url);
const source = path => readFileSync(new URL(`entry/src/main/ets/${path}`, root), 'utf8');
const file = path => new URL(`entry/src/main/ets/${path}`, root);
const session = pureModuleProbe(source('features/reading/presentation/ReaderDirectoryNavigationSession.ts'),
  'ReaderDirectoryNavigationSession.ts', { readerDirectoryBookState },
  ['readerDirectoryToggleCollapsed', 'readerDirectoryCollapsedIds', 'readerDirectoryAdmitRevision']);
const Surface = selectedProductionMethods(file('features/reading/ui/ReaderDirectoryNavigationSurface.ets'),
  'ReaderDirectoryNavigationSurface', ['toggle', 'directoryInputCurrent', 'currentInputOwnerKey', 'currentReadInputKey', 'recoveryInputCurrent', 'retryInputCurrent', 'retryCurrent', 'retryOpen', 'clearInputCurrent', 'clearCurrent'], {
    readerDirectoryToggleCollapsed: session.readerDirectoryToggleCollapsed,
    readerDirectoryScopeKey: (sourceId, bookId) => `${sourceId}:${bookId}`,
  });
const List = selectedProductionMethods(file('features/reading/ui/ReaderDirectoryNavigationList.ets'),
  'ReaderDirectoryNavigationList', ['toggleNode', 'directoryInputCurrent']);
function Carrier(owner, params) { Object.assign(this, { owner, params }); }

function sample(catalog, lost) {
  const live = { current: true };
  const manga = createReaderBuilderProbe(source('features/manga/ui/MangaReadingSurface.ets'),
    ['directoryBody', 'directoryContentInputCurrent', 'directorySheetInputCurrent', 'directoryOuterIdentity', 'readerPanelForeground'],
    { ReaderDirectoryNavigationSurface: Carrier },
    { childSources: { ReaderDirectoryNavigationSurface: source('features/reading/ui/ReaderDirectoryNavigationSurface.ets') } }).owner;
  Object.assign(manga, {
    mounted: true, exiting: false, appForeground: true, windowChromeActive: true,
    windowChromeOverlayActive: false, interactionBlocked: false,
    isReaderIdentityCurrent: () => true, inputCurrent: () => live.current,
    sourceId: 'manga-source', bookId: `round05-${catalog}-${lost}`, directoryOpenRevision: 1,
    panel: catalog ? '' : 'directory', panelPhase: catalog ? 'closed' : 'open',
    directoryQuery: '', directoryAscending: true, directoryRevision: 1,
    publishedManifestVersion: 'manifest-v1', stageWidth: 1024, viewportWidth: 760,
    backgroundPreference: 'paper', downloadEnabled: true,
    directoryCurrentIndex: () => 0, directoryInitialWidth: () => catalog ? 258 : 300,
    directoryCurrentOpenInset: () => 50, directoryEntries: () => [],
    widePanel: () => true, panelWidth: () => 300,
  });
  manga.directoryBody(catalog);
  const params = [...manga.children.values()][0].params;
  const surface = Object.create(Surface.prototype);
  const reads = [];
  Object.assign(surface, params, { mounted: true, awaitingRulesRefresh: false, view: { navigationRevision: 'revision-v1' },
    cancelQueryTimer() {}, openTree: (first, reason) => reads.push({ first, reason }) });
  surface.inputOwnerKey = surface.currentInputOwnerKey();
  const list = Object.create(List.prototype);
  Object.assign(list, {
    mounted: true, interactionEnabled: params.interactionEnabled,
    // The unchanged Surface.build expression supplies this closure. Its optional
    // parent inputCurrent is the exact SDK-produced Manga child field above.
    inputCurrent: selectedProductionComponentCallback(file('features/reading/ui/ReaderDirectoryNavigationSurface.ets'), 'ReaderDirectoryNavigationList', 'inputCurrent', surface),
    captureViewportAnchor() {}, onToggleNode: node => surface.toggle(node),
  });
  const scope = `${manga.sourceId}:${manga.bookId}`;
  if (lost) live.current = false;
  const before = { rootInputCurrent: live.current, mangaInputCurrent: manga.readerPanelForeground(),
    snapshotInteractionEnabled: params.interactionEnabled, parentCallbackPresent: typeof params.inputCurrent === 'function' };
  list.toggleNode({ nodeId: 'group-A', hasChildren: true, kind: 'group' });
  const folds = reads.length;
  Object.assign(surface, { generation: 7, showLoadStatus: true, loadFailed: true, loadPending: false,
    lastQuery: surface.query, lastAscending: surface.ascending, lastChapterIndex: surface.currentChapterIndex, navigationPortFactory: () => ({}),
    onClearSearch: () => reads.push({ reason: 'clear' }) });
  surface.openedInputKey = surface.currentReadInputKey();
  surface.retryCurrent(7);
  const retries = reads.length - folds;
  surface.query = 'query'; surface.lastQuery = surface.query; surface.clearCurrent(7);
  assert.equal(retries, lost ? 0 : 1);
  assert.equal(reads.length - folds - retries, lost ? 0 : 1);
  return { catalog, lost, before, collapsedIds: session.readerDirectoryCollapsedIds(scope), reads };
}

const samples = [sample(true, false), sample(true, true), sample(false, false), sample(false, true)];
for (const sample of samples) {
  assert.equal(sample.before.parentCallbackPresent, true);
  assert.deepEqual(sample.collapsedIds, sample.lost ? [] : ['group-A']);
  assert.equal(sample.reads.length, sample.lost ? 0 : 3);
}
let live = true;
const Full = selectedProductionMethods(file('features/reading/ui/ReaderFullDirectory.ets'), 'ReaderFullDirectory', ['directoryInputCurrent']);
const full = Object.assign(new Full(), { mounted: true, interactive: true, exitRequested: false,
  temporaryBackIdentity: 'opening', bookId: 'book', directoryRulesVisible: false, isOpeningCurrent: () => live });
const panelInput = selectedProductionComponentCallback(file('features/reading/ui/ReaderFullDirectory.ets'), 'FullDirectoryPanel', 'inputCurrent', full, { identity: 'opening', bookId: 'book' });
const Panel = selectedProductionMethods(file('features/reading/ui/FullDirectoryPanel.ets'), 'FullDirectoryPanel',
  ['panelInputCurrent', 'choosePanelTab', 'switchTab', 'handleControl']);
let projections = 0;
const panel = Object.assign(new Panel(), { inputCurrent: panelInput, positioningMounted: true, chapterActionsEnabled: true,
  motionActive: false, activeTab: 'directory', ascending: true, searchQuery: '', rebuildProjection: () => projections++,
  beginListPositioning() {}, onTabChange() {}, applySearch: () => projections++ });
const navInput = selectedProductionComponentCallback(file('features/reading/ui/FullDirectoryPanel.ets'), 'ReaderDirectoryNavigationSurface', 'inputCurrent', panel);
assert.equal(navInput(), true); panel.choosePanelTab('bookmarks'); assert.equal(projections, 1);
live = false; assert.equal(navInput(), false); panel.choosePanelTab('directory'); panel.handleControl('search');
assert.equal(projections, 1); assert.equal(panel.activeTab, 'bookmarks');
const Book = selectedProductionMethods(file('features/reading/ui/BookDirectoryPage.ets'), 'BookDirectoryPage', ['directoryInputIsCurrent', 'identity']);
const book = Object.assign(new Book(), { mounted: true, interactive: true, sourceId: 'source', bookId: 'book', selectionBusy: false, isOpeningCurrent: () => live });
book.admittedIdentity = book.identity();
const bookInput = selectedProductionComponentCallback(file('features/reading/ui/BookDirectoryPage.ets'), 'ReaderDirectoryNavigationSurface', 'inputCurrent', book, { identity: book.admittedIdentity });
assert.equal(bookInput(), false); live = true; assert.equal(bookInput(), true);
const Fallback = selectedProductionMethods(file('features/manga/ui/MangaReadingDirectoryFallback.ets'), 'MangaReadingDirectoryFallback',
  ['currentInputEnabled', 'toggleBranch', 'identity'], { sameReaderDirectoryData });
const group = { index: 1, title: '分组', navigable: false };
const fallback = Object.assign(new Fallback(), { mounted: true, sourceId: 'source', bookId: 'fallback', inputCurrent: () => live,
  query: '', entries: [group], admittedEntries: [group], projectedEntries: [group], collapsedGroups: [],
  rowPresentation: () => ({ hasChildren: true }), onUserScrollIntent() {}, publishProjection: () => projections++ });
fallback.admittedIdentity = fallback.identity();
fallback.toggleBranch(group, fallback.admittedIdentity); assert.deepEqual(fallback.collapsedGroups, [1]);
live = false; fallback.toggleBranch(group, fallback.admittedIdentity); assert.deepEqual(fallback.collapsedGroups, [1]);
return { samples, fullOriginalOpeningForwarded: true, bookOriginalOpeningForwarded: true, flatBranchRetirement: true };
}

function sheetTokenRecovery() {
const base = new URL('../entry/src/main/ets/', import.meta.url);
const source = path => new URL(path, base);
const pageFile = source('features/bookshelf/ui/BookshelfPage.ets');
const wrapperFile = source('features/bookshelf/ui/BookshelfBookActionSheet.ets');
const leafFile = source('features/bookshelf/ui/ReaderSheetActionList.ets');
const shellFile = source('features/bookshelf/ui/BookshelfShell.ets');
const moreFile = source('features/bookshelf/ui/BookshelfMoreActionSheet.ets');
const Page = selectedProductionMethods(pageFile, 'BookshelfPage', ['isCurrentBookActionSheet', 'performBookAction']);
const Leaf = selectedProductionMethods(leafFile, 'ReaderSheetActionList', ['dispatch', 'dispatchToken', 'actionId', 'presentationFromToken']);
const Shell = selectedProductionMethods(shellFile, 'BookshelfShell', ['isCurrentMoreSheet', 'moreIntentAction']);
const More = selectedProductionMethods(moreFile, 'BookshelfMoreActionSheet', ['dispatchToken']);
function bookSample(lostBeforeFirstToken) {
  let live = true;
  const book = { sourceId: 'local', bookId: 'retained-book' }, id = 'book-opening';
  const page = Object.assign(new Page(), { mounted: true, navigationGeneration: 9, actionSheetNavigation: 9,
    actionSheetId: id, actionBook: book, bookActionSheetVisible: true, books: [book],
    isCurrentShelfInput: () => live, currentVisibleBook: selection => selection === book ? book : undefined,
    onBookMultiSelectRequested() {} });
  const pageIsCurrent = selectedProductionComponentCallback(pageFile, 'BookshelfBookActionSheet', 'isCurrent', page,
    { presentationId: id, book });
  const pageAction = selectedProductionComponentCallback(pageFile, 'BookshelfBookActionSheet', 'onMultiSelect', page,
    { presentationId: id, book });
  const wrapper = { isCurrent: pageIsCurrent };
  const leafIsCurrent = selectedProductionComponentCallback(wrapperFile, 'ReaderSheetActionList', 'isCurrent', wrapper);
  const leaf = Object.assign(new Leaf(), { mounted: true, presentationId: id, dispatchedId: '',
    isCurrent: leafIsCurrent, onMultiSelect: pageAction });
  const nativeIntent = selectedProductionComponentCallback(leafFile, 'ReaderActionMenuSurface', 'onAction', leaf);
  live = !lostBeforeFirstToken;
  const before = { live, openingCurrent: pageIsCurrent(id), leafDispatchedId: leaf.dispatchedId };
  nativeIntent(id + '::multi-select');
  const afterFirst = { live, leafDispatchedId: leaf.dispatchedId, parentPending: typeof page.pendingBookAction,
    sheetVisible: page.bookActionSheetVisible, openingCurrent: pageIsCurrent(id) };
  live = true;
  nativeIntent(id + '::multi-select');
  const afterResume = { live, leafDispatchedId: leaf.dispatchedId, parentPending: typeof page.pendingBookAction,
    sheetVisible: page.bookActionSheetVisible, openingCurrent: pageIsCurrent(id) };
  if (lostBeforeFirstToken) {
    assert.equal(afterFirst.parentPending, 'undefined');
    assert.equal(afterFirst.sheetVisible, true);
    assert.equal(afterFirst.leafDispatchedId, '');
    assert.equal(afterResume.parentPending, 'function');
    assert.equal(afterResume.leafDispatchedId, id);
    assert.equal(afterResume.sheetVisible, false);
  } else {
    assert.equal(afterFirst.parentPending, 'function');
    assert.equal(afterFirst.sheetVisible, false);
  }
  return { lostBeforeFirstToken, before, afterFirst, afterResume };
}
function moreSample(lostBeforeFirstToken) {
  let live = true;
  const id = 'more-opening';
  const shell = Object.assign(new Shell(), { mounted: true, navigationGeneration: 9, moreSheetNavigation: 9,
    moreSheetCurrentId: id, moreSelectionId: id, moreMenuVisible: true,
    isCurrentShelfInput: () => live, dismissMoreMenu() { this.moreMenuVisible = false; } });
  const moreIsCurrent = selectedProductionComponentCallback(shellFile, 'BookshelfMoreActionSheet', 'isCurrent', shell);
  const moreAction = selectedProductionComponentCallback(shellFile, 'BookshelfMoreActionSheet', 'onLocalImport', shell,
    { presentationId: id });
  const leaf = Object.assign(new More(), { mounted: true, presentationId: id, dispatchedId: '',
    isCurrent: moreIsCurrent, onLocalImport: moreAction });
  const nativeIntent = selectedProductionComponentCallback(moreFile, 'ReaderActionMenuSurface', 'onAction', leaf);
  live = !lostBeforeFirstToken;
  const before = { live, openingCurrent: moreIsCurrent(id), leafDispatchedId: leaf.dispatchedId };
  nativeIntent(id + '::import');
  const afterFirst = { live, leafDispatchedId: leaf.dispatchedId, pendingImport: typeof shell.afterMoreClose === 'function',
    sheetVisible: shell.moreMenuVisible, openingCurrent: moreIsCurrent(id) };
  live = true;
  nativeIntent(id + '::import');
  const afterResume = { live, leafDispatchedId: leaf.dispatchedId, pendingImport: typeof shell.afterMoreClose === 'function',
    sheetVisible: shell.moreMenuVisible, openingCurrent: moreIsCurrent(id) };
  if (lostBeforeFirstToken) {
    assert.equal(afterFirst.pendingImport, false);
    assert.equal(afterFirst.sheetVisible, true);
    assert.equal(afterFirst.leafDispatchedId, '');
    assert.equal(afterResume.pendingImport, true);
    assert.equal(afterResume.leafDispatchedId, id);
    assert.equal(afterResume.sheetVisible, false);
  } else {
    assert.equal(afterFirst.pendingImport, true);
    assert.equal(afterFirst.sheetVisible, false);
  }
  return { lostBeforeFirstToken, before, afterFirst, afterResume };
}
return { book: [bookSample(false), bookSample(true)], more: [moreSample(false), moreSample(true)] };
}

function sourceChoiceRecovery() {
const base = new URL('../entry/src/main/ets/', import.meta.url);
const source = path => new URL(path, base);
const panelFile = source('ui/controls/ReaderSelectPanel.ets');
const pageFile = source('features/source/ui/SourceManagementPage.ets');
const surfaceFile = source('features/source/ui/SourceJourneySurface.ets');
function exactOptionCallback(owner) {
  const { ts, options } = installedEtsCompiler();
  const text = readFileSync(panelFile, 'utf8');
  const tree = ts.createSourceFile(String(panelFile), text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  const structure = tree.statements.find(node => node.name?.text === 'ReaderSelectPanel');
  const method = structure.members.find(node => node.name?.getText(tree) === 'optionRow');
  const expressions = [];
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'ReaderChoiceRow') {
      const property = node.arguments[0].properties.find(value => value.name?.getText(tree) === 'onChoose');
      expressions.push(property.initializer.getText(tree));
    }
    ts.forEachChild(node, visit);
  };
  visit(method);
  assert.equal(expressions.length, 1);
  const emitted = ts.transpileModule('const callback = ' + expressions[0] + ';', {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
  });
  assert.deepEqual(emitted.diagnostics, []);
  return new Function(emitted.outputText + '\nreturn callback;').call(owner);
}
const Surface = selectedProductionMethods(surfaceFile, 'SourceJourneySurface', ['managementInputIsCurrent']);
const Page = selectedProductionMethods(pageFile, 'SourceManagementPage', [
  'managementOpeningIsCurrent', 'managementInputIsCurrent', 'ownsGroupSelection', 'commitGroupSelection',
  'dismissGroupSelection', 'retireGroupSelection',
]);
const Panel = selectedProductionMethods(panelFile, 'ReaderSelectPanel', [
  'selectAndCollapse', 'collapsePanel', 'finishCollapse',
], { ...selectedProductionValues(panelFile, ['OPTION_H']), motionAnimateParam: (_id, onFinish) => ({ onFinish }) });
function sample(lostBeforeChoice) {
  let live = true, projectionCount = 0, nativeFinish;
  const id = 'original-group-opening';
  const surface = Object.assign(new Surface(), { mounted: true, identity: 'management-opening',
    isInputAllowed: () => live, presentation: { isManagementCurrent: value => value === 'management-opening' } });
  const page = Object.assign(new Page(), { mounted: true, appForeground: true,
    isOpeningCurrent: () => surface.presentation.isManagementCurrent(surface.identity),
    isInputAllowed: () => surface.managementInputIsCurrent(), groupOpen: true, groupClosing: false,
    groupSelectionId: id, groupValue: '全部分组', groupOptions: () => ['全部分组', '当前分组'],
    cancelGroupFocus() {}, rebuildSourceProjection() { projectionCount += 1; },
    toolsFocusId: () => 'tools', groupTriggerFocusId: () => 'group', scheduleGroupFocus() {},
  });
  const panel = Object.assign(new Panel(), { mounted: true, closeInFlight: false, selectionId: id,
    inputCurrent: selectedProductionComponentCallback(pageFile, 'ReaderSelectPanel', 'inputCurrent', page),
    generation: 1, value: page.groupValue, options: page.groupOptions(), reduceMotion: false,
    onCommit: selectedProductionComponentCallback(pageFile, 'ReaderSelectPanel', 'onCommit', page),
    onDismiss: selectedProductionComponentCallback(pageFile, 'ReaderSelectPanel', 'onDismiss', page),
    getUIContext: () => ({ animateTo(options, change) { change(); nativeFinish = options.onFinish; } }),
  });
  const actualOption = exactOptionCallback(panel);
  if (lostBeforeChoice) { live = false; page.appForeground = false; }
  const before = { liveInput: page.managementInputIsCurrent(), openingCurrent: page.ownsGroupSelection(id),
    groupOpen: page.groupOpen, groupValue: page.groupValue, closeInFlight: panel.closeInFlight };
  actualOption('当前分组');
  const afterChoice = { groupOpen: page.groupOpen, groupValue: page.groupValue,
    closeInFlight: panel.closeInFlight, projectionCount, nativeFinishAvailable: typeof nativeFinish === 'function' };
  if (lostBeforeChoice) {
    assert.equal(afterChoice.closeInFlight, false);
    assert.equal(afterChoice.nativeFinishAvailable, false);
    assert.equal(afterChoice.groupOpen, true);
    assert.equal(afterChoice.projectionCount, 0);
    live = true; page.appForeground = true;
    actualOption('当前分组');
    assert.equal(panel.closeInFlight, true);
    assert.equal(page.groupValue, '当前分组');
  }
  live = false; page.appForeground = false;
  assert.equal(typeof nativeFinish, 'function'); nativeFinish();
  const afterCollapseWhileUnavailable = { groupOpen: page.groupOpen, groupValue: page.groupValue, projectionCount };
  live = true; page.appForeground = true;
  const afterResume = { groupOpen: page.groupOpen, groupValue: page.groupValue, projectionCount };
  assert.equal(projectionCount, 1);
  assert.equal(afterResume.groupOpen, false);
  assert.equal(afterResume.groupValue, '当前分组');
  return { lostBeforeChoice, before, afterChoice, afterCollapseWhileUnavailable, afterResume };
}
return [sample(false), sample(true)];
}

for (const id of selected) {
  const result = await ({ 'sheet-token-recovery': sheetTokenRecovery, 'source-choice-recovery': sourceChoiceRecovery,
    'shelf-local-admission': shelfLocalAdmission,
    'source-filter-admission': sourceFilterAdmission, 'directory-consumer-admission': directoryConsumerAdmission }[id])();
  console.log(JSON.stringify({ case: id, result, boundary: 'Current production methods and SDK callbacks with finite owner/native/Core ports. No device action.' }));
  recordContractCasePass(id);
}

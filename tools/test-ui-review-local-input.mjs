import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectedProductionMethods, selectedProductionComponentCallback } from './lib/selected-production-methods.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { readerDirectoryBookState } from '../entry/src/main/ets/features/reading/presentation/ReaderDirectorySessionState.ts';
import { sameReaderDirectoryData } from '../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'shelf-local-admission': 'Actual More icon, book tokens, More tokens and first-read local state consume original live input.',
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
  const importAction = shell.moreIntentAction('more-1', () => {
    shell.moreImportSheetId = 'more-1'; shell.dismissMoreMenu();
  });
  if (foregroundLost) index.searchAppForeground = false;
  const moreInputAllowedBefore = scene.isInteractive(9);
  importAction();
  const pendingImportWhileUnavailable = shell.moreImportSheetId === 'more-1';
  index.searchAppForeground = true;
  shell.finishMoreSheet('more-1');
  let captures = 0, selections = 0;
  page.viewState = { openedBookKey: '' };
  page.saveShelfViewport = () => captures++;
  page.measureBookOrigin = () => { captures++; return {}; };
  page.onBookSelected = () => selections++;
  const read = page.bookSelectionHandler(() => book, true);
  if (foregroundLost) index.searchAppForeground = false;
  read();
  assert.equal(captures, foregroundLost ? 0 : 2);
  assert.equal(selections, foregroundLost ? 0 : 1);
  assert.equal(page.viewState.openedBookKey, foregroundLost ? '' : JSON.stringify([book.sourceId, book.bookId]));
  return { ...opening, captures, selections, bookAction: { inputAllowedBefore: bookActionInputAllowedBefore,
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

for (const id of selected) {
  const result = await ({ 'shelf-local-admission': shelfLocalAdmission,
    'source-filter-admission': sourceFilterAdmission, 'directory-consumer-admission': directoryConsumerAdmission }[id])();
  console.log(JSON.stringify({ case: id, result, boundary: 'Current production methods and SDK callbacks with finite owner/native/Core ports. No device action.' }));
  recordContractCasePass(id);
}

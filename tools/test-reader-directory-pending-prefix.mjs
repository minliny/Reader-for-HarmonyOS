import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); } catch (error) {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
  throw error;
} } });
const selected = selectContractCases({
  'pending-prefix': { description: 'Actual SDK directory first-row and readonly actors without embedded pending recovery, global write admission and state-driven floating recovery yield', resources: [] },
  'flat-row-updates': { description: 'Actual flat-list SDK key generator changes for bookmark/download values while unrelated rows retain keys; real chapter actor dispatch follows current row values. Native engine remains separately verified.', resources: [] },
});
const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
const ui = name => read('features/reading/ui/' + name + '.ets');
const state = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
const host = await import('../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts');
const model = await import('../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryModel.ts');
const hierarchy = await import('../entry/src/main/ets/features/reading/ui/ReaderDirectoryHierarchy.ts');
const { sameReaderDirectoryData } = await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts');
const marker = await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryMarkerState.ts');
const bookmarkGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlBookmarkGeometry.ts');
const { EMPTY_READING_DIRECTORY_RECOVERY } = await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
const contentSource = ui('ReaderControlDirectoryContent');
const recovery = { ...EMPTY_READING_DIRECTORY_RECOVERY, presentationId: 'book-a-opening', bookmarkWriteEnabled: false,
  bookmarks: { visible: true, canRetry: true, generation: 8, message: '同一原操作等待核对' },
  bookmarksKind: 'pending', bookmarksBusy: false, canContinueBookmarks: true };
const chapter = marks => ({ index: 0, title: 'Chapter 0', downloadState: 'missing', bookmarks: marks });
const mark = { time: 7, chapterIndex: 0, chapterOffset: 12, content: 'saved' };
class ChildPort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
function childOf(owner) { const child = [...owner.children.values()].at(-1); assert.ok(child); return child; }

function listFixture(source = contentSource, short = false, tab = 'directory', progress = 0) {
  const sdk = boundedSurfaceSdk();
  sdk.hooks.childSources.ReaderBookmarkRow = ui('ReaderBookmarkRow');
  sdk.deps.ReaderBookmarkRow = createReaderBuilderProbe(ui('ReaderBookmarkRow'), boundedMembers(ui('ReaderBookmarkRow')),
    { ...sdk.deps, ...bookmarkGeometry, BOOKMARK_PENDING_LABEL: '待确认', BOOKMARK_ROW_HEIGHT: 74 }, sdk.hooks).Component;
  const prelude = source.slice(source.indexOf('class ControlDirectoryDataSource'), source.indexOf('/** Control-only'));
  const classes = pureModuleProbe(prelude, 'DirectoryListPrelude.ets', { FrameCallback: class {} }, ['ControlDirectoryDataSource', 'ControlDirectoryFrame']);
  const calls = [], frames = [], firstRows = [];
  const dataSource = new classes.ControlDirectoryDataSource();
  // An explicit one-row virtual range. This does not estimate native layout or
  // materialize the entire projection to manufacture a first-visible result.
  const LazyForEach = { create(_id, _owner, data, generate) { generate(data.getData(0), 0); }, pop() {} };
  let materializing = false, itemId = 100000;
  const ListItem = new Proxy({}, { get(_target, member) { return (...args) => {
    if (member === 'create' && typeof args[0] === 'function' && !materializing) {
      materializing = true; try { args[0](itemId++, true); } finally { materializing = false; }
    }
  }; } });
  const owner = sdk.consumer(source, ['flatList', 'headerCount', 'prefixHeight', 'onPrefixArea', 'currentContent',
    'currentInputEnabled', 'flatBookmarkIsCurrent', 'bookmarkWriteEnabled', 'queuePosition', 'displaySnapshot', 'displayedFacts'], {
    ...classes, readerPageAreaLength: Number, LazyForEach, ListItem, ReaderBookmarkRow: sdk.deps.ReaderBookmarkRow, ScrollAlign: { CENTER: 'center' },
    ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
  });
  const entries = Array.from({ length: 100 }, (_, index) => ({ ...chapter(tab === 'bookmarks' ? [{ ...mark, chapterIndex: index, time: index + 1, chapterTitle: 'Chapter ' + index }] : []), index, title: 'Chapter ' + index }));
  const snapshot = model.readerControlDirectorySnapshot(entries, tab, '', true, 0);
  dataSource.replace(snapshot.rows);
  const placement = new model.ReaderControlDirectoryPosition(); placement.open('opening');
  let prefixes = 0;
  Object.assign(owner, { mounted: true, lifecycle: 1, layoutPresentation: 3, interactionEnabled: true,
    inputCurrent: () => true, bookmarkRecovery: recovery, shortContent: short, tab, progress, snapshot, dataSource, placement,
    navigationActive: false, availableWidth: 288, availableHeight: 190, prefixMeasuredHeight: 0, prefixRevealRevision: 4,
    leadingRow: 0, leadingKey: 'chapter:0', positionQueued: false,
    shortHeaderHeight: () => 140, rowWidth: () => 286, listHeight: () => 190, rowHeight: () => 44, rowPadding: () => 0,
    shortHeader: () => prefixes++, localState: () => false, chapterRow: entry => firstRows.push(entry.index),
    bookmarkNaturalSize: () => undefined, onSelectBookmark: (_id, index) => firstRows.push(index),
    scroller: { scrollToIndex: index => calls.push(index) },
    getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }) });
  owner.flatList(); sdk.properties.flush();
  if (tab === 'bookmarks') {
    const row = sdk.walk(owner).find(child => child instanceof sdk.deps.ReaderBookmarkRow);
    assert.ok(row, 'actual first bookmark child is mounted through the real flat-list Builder');
    const actor = [...row.nodes.values()].find(node => node.type === 'Stack' && node.onClick);
    assert.ok(actor); actor.onClick();
  }
  assert.deepEqual(firstRows, [0], 'the actual lazy item starts with the first chapter or exact bookmark read actor');
  assert.equal(prefixes, short ? 1 : 0, 'only the authored short-window header precedes the first chapter');
  assert.equal(sdk.nodes(owner).filter(node => node.type === 'Scroll').length, 0);
  assert.equal(sdk.nodes(owner).filter(node => node.type === 'List').length, 1);
  owner.queuePosition(); frames.shift().onFrame();
  return { owner, calls, sdk, prefixes };
}
function assertNoPendingObstruction(source) {
  for (const [short, progress] of [[false, 0], [false, 1], [true, 1]]) for (const tab of ['directory', 'bookmarks']) {
    const { owner, calls } = listFixture(source, short, tab, progress);
    assert.equal(owner.headerCount(), short ? 1 : 0);
    assert.deepEqual(calls, [short ? 1 : 0], 'initial scroll targets the first real chapter, with only the genuine short header');
    const stable = [owner.headerCount(), owner.prefixHeight(), owner.prefixRevealRevision, owner.leadingKey];
    owner.bookmarkRecovery = { ...recovery, bookmarksBusy: true, bookmarks: { ...recovery.bookmarks, message: 'changed '.repeat(500) } };
    assert.deepEqual([owner.headerCount(), owner.prefixHeight(), owner.prefixRevealRevision, owner.leadingKey], stable);
    owner.onPrefixArea(3, { width: 286, height: 900 });
    assert.equal(owner.prefixMeasuredHeight, 0, 'pending-message height cannot become a list prefix measurement');
    owner.onPrefixArea(2, { width: 286, height: 140 }); assert.equal(owner.prefixMeasuredHeight, 0);
    owner.onPrefixArea(3, { width: 286, height: 140 });
    assert.equal(owner.prefixMeasuredHeight, short ? 140 : 0);
  }
  assert.doesNotMatch(source, /ReaderRecoveryNotice|ReaderDirectoryRecoverySurface|directoryPrefix|onBookmarkRecoveryChanged/);
}
function assertRowActors() {
  let writes = 0, reads = 0, downloads = 0;
  for (const marks of [[], [mark]]) {
    const sdk = boundedSurfaceSdk();
    const owner = sdk.consumer(ui('ReaderDirectoryChapterRow'), undefined, { ...hierarchy, ...marker });
    Object.assign(owner, { appThemeScheme: 'day', entry: chapter(marks), rowHeight: 44, variant: 'control',
      chapterDownloadEnabled: true, chapterStartBookmarkCreationEnabled: true, bookmarkActionsEnabled: false,
      onSelectChapter: () => reads++, onDownloadChapter: () => downloads++, onDeleteBookmarks: () => writes++, onCreateChapterStartBookmark: () => writes++ });
    owner.initialRender(); sdk.properties.flush();
    const nodes = [...owner.nodes.values()];
    const bookmark = nodes.find(node => node.type === 'Button' && /书签/.test(node.accessibilityText));
    const download = nodes.find(node => node.type === 'Button' && /下载/.test(node.accessibilityText));
    const title = nodes.find(node => node.type === 'Row' && node.onClick);
    assert.equal(bookmark.enabled, false); bookmark.onClick(); assert.equal(writes, 0);
    title.onClick(); download.onClick();
    owner.bookmarkActionsEnabled = true; sdk.properties.flush();
    assert.equal(bookmark.enabled, true); bookmark.onClick(); assert.equal(writes, 1);
    owner.bookmarkActionsEnabled = false; bookmark.onClick(); assert.equal(writes, 1);
    writes = 0;
  }
  assert.equal(reads, 2); assert.equal(downloads, 2, 'read and independent download actions remain usable');
}
async function assertTreeActors() {
  const sdk = boundedSurfaceSdk();
  const owner = sdk.consumer(ui('ReaderDirectoryNavigationList'), ['row', 'bookmarkActionEnabled', 'marker', 'selectTarget'], { ...marker });
  const calls = [], entry = chapter([mark]);
  Object.assign(owner, { appThemeScheme: 'day', rowHeight: 44, interactionEnabled: true, bookmarkActionsEnabled: false,
    chapterStartBookmarkCreationEnabled: true, chapterDownloadEnabled: false, mangaDisplay: false, mangaQuickDisplay: false,
    chapterByIndex: new Map([[0, entry]]), bookId: 'book-a', mounted: true, generation: 1, selectionGeneration: 0,
    view: { viewId: 'view-a', currentAncestorNodeId: '' }, isCurrentNode: () => false, displayLevel: () => 1,
    onDeleteBookmarks: () => calls.push('delete'), onCreateChapterStartBookmark: () => calls.push('create'),
    gateway: { resolveTarget: async (_book, _view, _node, current) => { assert.equal(current(), true); return { chapterIndex: 0, chapterOffsetScalar: 0 }; } },
    onSelectTarget: () => calls.push('read'), onInvalidated: () => assert.fail('current target unexpectedly invalidated') });
  owner.row({ index: 0, node: { nodeId: 'chapter-0', kind: 'target', title: 'Chapter 0', chapterIndex: 0, hasChildren: false } });
  const nodes = [...owner.nodes.values()], bookmark = nodes.find(node => node.type === 'Button' && /书签/.test(node.accessibilityText));
  assert.equal(bookmark.enabled, false); bookmark.onClick(); assert.deepEqual(calls, []);
  nodes.find(node => node.type === 'Text' && node.onClick).onClick(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(calls, ['read']);
  owner.bookmarkActionsEnabled = true; bookmark.onClick(); assert.deepEqual(calls, ['read', 'delete']);
  owner.bookmarkActionsEnabled = false; bookmark.onClick(); assert.deepEqual(calls, ['read', 'delete']);
}
function assertParentLivePorts() {
  const source = contentSource, sdk = boundedSurfaceSdk();
  sdk.hooks.childSources.ReaderDirectoryChapterRow = ui('ReaderDirectoryChapterRow');
  const owner = sdk.consumer(source, ['chapterRow', 'bookmarkWriteEnabled', 'flatChapterIsCurrent', 'currentContent', 'currentInputEnabled'], { ReaderDirectoryChapterRow: ChildPort, sameReaderDirectoryData });
  const calls = [];
  Object.assign(owner, { mounted: true, layoutPresentation: 1, interactionEnabled: true, preparedMinimumRequired: false,
    tab: 'directory', navigationActive: false, entries: [chapter([mark])], bookmarkRecovery: { ...recovery, bookmarkWriteEnabled: true }, chapterStartBookmarkCreationEnabled: true,
    chapterDownloadEnabled: true, rowHeight: () => 44, currentChapterIndex: 0,
    onSelectChapter: () => calls.push('read'), onDownloadChapter: () => calls.push('download'),
    onDeleteBookmarks: () => calls.push('delete'), onCreateChapterStartBookmark: () => calls.push('create') });
  owner.chapterRow(chapter([mark]), 1); const old = childOf(owner).params;
  assert.equal(old.bookmarkActionsEnabled, true);
  owner.bookmarkRecovery = { ...recovery, bookmarks: { ...recovery.bookmarks, visible: false } };
  assert.equal(old.bookmarkActionsEnabled, true, 'retain physical child parameters before native Prop delivery');
  old.onDeleteBookmarks([7]); old.onCreateChapterStartBookmark({ chapterIndex: 0, chapterTitle: 'Chapter' });
  old.onSelectChapter(0); old.onDownloadChapter(0);
  assert.deepEqual(calls, ['read', 'download'], 'the actual parent ports reject stale write actors without gating reads');
}
function assertAllCallerBindings() {
  const { ts, options } = installedEtsCompiler();
  const paths = ['features/reading/ui/ReaderControlDirectoryContent.ets', 'features/reading/ui/FullDirectoryPanel.ets',
    'features/reading/ui/ReaderDirectoryNavigationSurface.ets', 'features/reading/ui/ReaderFullDirectory.ets',
    'features/reading/ui/BookDirectoryPage.ets', 'features/manga/ui/MangaReadingSurface.ets',
    'features/reading/ui/LocalBookDetail.ets'];
  const found = [];
  for (const path of paths) {
    const tree = ts.createSourceFile('ActualDirectoryCaller.ets', read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.equal(tree.parseDiagnostics.length, 0);
    const visit = node => {
      if ((ts.isEtsComponentExpression(node) || ts.isCallExpression(node)) && ['ReaderDirectoryChapterRow', 'ReaderDirectoryNavigationSurface', 'ReaderDirectoryNavigationList', 'FullDirectoryPanel'].includes(node.expression.getText(tree))) {
        const property = node.arguments[0]?.properties?.find(prop => prop.name?.getText(tree) === 'bookmarkActionsEnabled');
        assert.ok(property, path + ' explicitly binds global write admission or readonly role');
        found.push([path, property.initializer.getText(tree)]);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  assert.equal(found.length, 9, 'all actual app row/tree/full-panel constructors are covered');
  assert.equal(found.filter(([, value]) => value === 'false').length, 3, 'detail preview and two manga readonly hosts remain explicit');
}
function floatingFixture(source) {
  const sdk = boundedSurfaceSdk(), calls = [];
  const recoverySource = ui('ReaderDirectoryRecoverySurface');
  sdk.hooks.childSources.ReaderDirectoryRecoverySurface = recoverySource;
  sdk.deps.ReaderDirectoryRecoverySurface = createReaderBuilderProbe(recoverySource, boundedMembers(recoverySource),
    { ...sdk.deps, EMPTY_READING_DIRECTORY_RECOVERY }, sdk.hooks).Component;
  const owner = sdk.consumer(source, ['controlSession', 'latestControlVisualSession', 'onControlSessionChanged',
    'controlVisible', 'controlMotionSession', 'controlMotionVisible', 'controlPage', 'readerRecoveryInputCurrent', 'readerRecoveryRequestCurrent',
    'readerRecoveryContent', 'readerRecoveryItems', 'readerBookmarkRecoveryContent', 'readerBookmarkPending', 'hasReaderPendingGroup',
    'hasReaderRecoveryContent', 'bookmarkRecoveryIdentity', 'reconcileBookmarkRecovery'],
    { ...state, ...host, EMPTY_READING_DIRECTORY_RECOVERY });
  const empty = { visible: false, canRetry: false, generation: 0, message: '' };
  Object.assign(owner, { mounted: true, exitRequested: false, lifecycleToken: 1, sourceId: 'local', bookId: 'book-a',
    sourceSwitchPresentationVisible: false, readerRecoveryView: empty, readerSettingsRecovery: empty, ttsPreferencesRecovery: empty,
    ttsConfigurationRecovery: empty, replaceRecovery: empty, bookmarkRecovery: recovery,
    viewportWidth: 366, readerWindowMetricsRevision: 0, controlLayout: () => ({ topBarWidth: 334 }),
    readerRecoveryViewportHeight: () => 180, readerRecoveryTop: () => 100, readerRecoveryOverlayId: () => 'recovery-test',
    readerRecoveryRequested: true, readerRecoveryRequestIdentity: 'recovery-test',
    isSessionActive: () => true, isControlInputEnabled: () => true,
    admitSessionControlClosing() {}, applyWindowPolicyForChromeOwner() {}, suspendAdjacentMeasurement() {},
    prepareControlPage() {}, controlModuleVisitRevision: 0, onReconcileBookmarks: (generation, presentation) => calls.push([generation, presentation]),
    onContinueBookmarks: () => assert.fail('this regression never continues a business write') });
  const setSession = next => {
    // Keep unrelated query/IME/page-turn side effects outside this finite port.
    // Visibility, the @State setter, Watch copy and observer subscriptions are actual.
    owner.observedControlPage = host.readerControlHostPage(next);
    const location = state.readerControlContentLocation(next);
    owner.observedControlModule = location.level === 'secondary' ? location.module : 'home';
    owner.observedControlCloseRevision = next.closeRevision;
    owner.controlSession = next; sdk.properties.flush();
  };
  owner.readerRecoveryContent(); sdk.properties.flush();
  const scroll = [...owner.nodes.values()].find(node => node.type === 'Scroll'); assert.ok(scroll);
  const action = sdk.walk(owner).find(child => child instanceof sdk.deps.ReaderRecoveryAction && child.label === '重新载入核对书签');
  assert.ok(action); const query = [...action.nodes.values()].find(node => node.type === 'Button' && node.onClick);
  return { sdk, owner, scroll, query, calls, setSession };
}
function assertReactiveYield(source) {
  const fixture = floatingFixture(source), { owner, scroll, query, calls, setSession } = fixture;
  assert.equal(scroll.opacity, 1); query.onClick(); assert.deepEqual(calls, [[8, 'book-a-opening']]);
  const open = state.enterReaderControlModule(state.openReaderControlSession(state.createReaderControlSessionState(), 0), 'directory', 0);
  setSession(open);
  assert.equal(owner.controlVisible(), true); assert.equal(owner.controlMotionVisible(), true);
  assert.equal(scroll.opacity, 0, 'actual @State update withdraws paint without manual observer replay');
  assert.equal(scroll.enabled, false); assert.equal(scroll.accessibilityLevel, 'no-hide-descendants');
  assert.equal(scroll.hitTestBehavior, 'HitTestMode.None'); query.onClick(); assert.equal(calls.length, 1);
  setSession(state.dismissReaderControlSession(open, 0));
  assert.equal(scroll.opacity, 1); assert.equal(scroll.enabled, true); assert.equal(scroll.accessibilityLevel, 'auto');
  query.onClick(); assert.equal(calls.length, 2, 'closing controls restores the same original readback action');
  assert.equal(scroll.onAreaChange, undefined, 'floating notice cannot change body or control layout');
  owner.bookmarkRecovery = { ...recovery, bookmarksBusy: true }; query.onClick(); assert.equal(calls.length, 2);
  owner.bookmarkRecovery = { ...recovery, presentationId: 'successor' }; query.onClick(); assert.equal(calls.length, 2);
  return fixture;
}
function assertGestureAdmission() {
  const sdk = boundedSurfaceSdk();
  const owner = sdk.consumer(ui('LocalReadingExperience'), ['bookmarkWriteEnabled', 'canStartReaderBookmarkGesture', 'toggleCurrentPageBookmark']);
  const calls = [];
  Object.assign(owner, { mounted: true, layoutPresentation: 1, interactionEnabled: true, preparedMinimumRequired: false,
    tab: 'directory', navigationActive: false, entries: [chapter([mark])], bookmarkRecovery: recovery, bookmarkMutationGeneration: 7, bookmarkPendingTarget: '',
    onReaderBookmarkGestureUnavailable: reason => calls.push(reason), onTogglePageBookmark: () => assert.fail('disabled gesture dispatched') });
  assert.equal(owner.canStartReaderBookmarkGesture(), false); owner.toggleCurrentPageBookmark();
  assert.deepEqual(calls, ['unavailable']); assert.equal(owner.bookmarkMutationGeneration, 7); assert.equal(owner.bookmarkPendingTarget, '');
}
function assertFlatRowUpdates(source) {
  const sdk = boundedSurfaceSdk();
  sdk.hooks.childSources.ReaderBookmarkRow = ui('ReaderBookmarkRow');
  sdk.deps.ReaderBookmarkRow = ChildPort;
  const classes = pureModuleProbe(source.slice(source.indexOf('class ControlDirectoryDataSource'), source.indexOf('/** Control-only')),
    'DirectoryListPrelude.ets', { FrameCallback: class {} }, ['ControlDirectoryDataSource', 'ControlDirectoryFrame']);
  const data = new classes.ControlDirectoryDataSource();
  let nativePort;
  const LazyForEach = { create(_id, _owner, currentData, generate, key) {
    nativePort = { data: currentData, generate, key };
  }, pop() {} };
  let materializing = false;
  let itemId = 100000;
  const ListItem = new Proxy({}, { get(_target, member) { return (...args) => {
    if (member !== 'create' || typeof args[0] !== 'function' || materializing) return;
    materializing = true;
    try { args[0](itemId++, true); } finally { materializing = false; }
  }; } });
  const owner = sdk.consumer(source, ['flatList'], { ...classes, LazyForEach, ListItem, ReaderBookmarkRow: ChildPort,
    ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} } });
  const Chapter = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryChapterRow.ets', import.meta.url),
    'ReaderDirectoryChapterRow', ['marker', 'bookmarkActionEnabled', 'downloadActionEnabled'], marker);
  let currentActor;
  const actions = [];
  Object.assign(owner, { dataSource: data, scroller: {}, shortContent: false, availableWidth: 286,
    headerCount: () => 0, rowHeight: () => 40, rowPadding: () => 10, currentInputEnabled: () => true,
    chapterRow(entry) {
      currentActor = Object.assign(new Chapter(), { entry, bookmarkActionsEnabled: true,
        chapterStartBookmarkCreationEnabled: true, chapterDownloadEnabled: true,
        onDeleteBookmarks: times => actions.push(['delete', times]),
        onCreateChapterStartBookmark: request => actions.push(['create', request.chapterIndex]) });
    } });
  let entries = [chapter([mark]), { ...chapter([]), index: 1, title: 'Chapter 1' }];
  const rows = () => model.readerControlDirectorySnapshot(entries, 'directory', '', true, 0).rows;
  data.replace(rows());
  owner.flatList();
  assert.equal(nativePort.data, data, 'SDK LazyForEach receives the actual current data source');
  const firstKey = nativePort.key(data.getData(0));
  const otherKey = nativePort.key(data.getData(1));
  nativePort.generate(data.getData(0), 0);
  currentActor.marker();
  assert.deepEqual(actions, [['delete', [7]]]);
  const changes = [];
  data.registerDataChangeListener({ onDataReloaded() { assert.fail('value-only update cannot reload the entire list'); },
    onDataChange(index) { changes.push(index); } });
  entries = [{ ...entries[0], bookmarks: [] }, entries[1]];
  data.replace(rows());
  assert.deepEqual(changes, [0]);
  const emptyKey = nativePort.key(data.getData(0));
  assert.notEqual(emptyKey, firstKey, 'actual SDK key must replace the deleted bookmark row');
  assert.equal(nativePort.key(data.getData(1)), otherKey, 'unaffected row retains its native key');
  nativePort.generate(data.getData(0), 0);
  currentActor.marker();
  assert.deepEqual(actions, [['delete', [7]], ['create', 0]], 'real actor reads the replacement entry');
  entries = [{ ...entries[0], downloadState: 'queued' }, entries[1]];
  data.replace(rows());
  assert.notEqual(nativePort.key(data.getData(0)), emptyKey, 'download status also invalidates its native row');
  nativePort.generate(data.getData(0), 0);
  assert.equal(currentActor.downloadActionEnabled(), false, 'queued download loses its current action admission');
  const unchanged = changes.length;
  data.replace(rows());
  assert.equal(changes.length, unchanged, 'equal value projection sends no native update');
}

for (const id of selected) {
  if (id === 'flat-row-updates') {
    assertFlatRowUpdates(contentSource);
    const stale = contentSource.replace('`${row.key}:${JSON.stringify(row)}`', 'row.key');
    assert.notEqual(stale, contentSource);
    assert.throws(() => assertFlatRowUpdates(stale), /actual SDK key must replace/);
    console.log('PASS flat-row-updates: actual SDK keys, real delete/create actors, download admission and unchanged-row retention; no native execution');
    recordContractCasePass(id);
    continue;
  }
  assertNoPendingObstruction(contentSource);
  assertRowActors(); await assertTreeActors(); assertParentLivePorts(); assertAllCallerBindings();
  assertReactiveYield(ui('LocalReadingExperience')); assertGestureAdmission();
  const obstructed = contentSource.replace('private headerCount(): number { return this.shortContent ? 1 : 0; }',
    'private headerCount(): number { return this.shortContent || this.bookmarkRecovery.bookmarks.visible ? 1 : 0; }');
  assert.notEqual(obstructed, contentSource); assert.throws(() => assertNoPendingObstruction(obstructed));
  const nonreactive = ui('LocalReadingExperience').replace('!this.controlVisible() && !this.controlMotionVisible()', '!this.controlMotionVisible()');
  assert.notEqual(nonreactive, ui('LocalReadingExperience'));
  assert.throws(() => assertReactiveYield(nonreactive), /actual @State update/);
  console.log('PASS pending-prefix withdrawal: actual first chapter, short-only prefix, row/tree read-write actors, nine callers and state-driven floating yield; no native execution');
  recordContractCasePass(id);
}

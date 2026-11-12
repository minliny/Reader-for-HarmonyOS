import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {
  projection: {description: '实际3000 canonical目录过滤/排序/identity/scroll意图', resources: []},
  'sdk-callbacks': {description: '实际目录Builder→tree/flat→row current/retired业务回调', resources: []},
  'measured-frame': {description: '实际public host vp-string面积与header delta保目录actor', resources: []},
  'manga-header': {description: '实际漫画目录header asymmetric safe-frame', resources: []},
  'rules-eligibility': {description: '实际持久format/capability准入及identity撤销', resources: []},
};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}

async function runSelectedCase(selectedCase) {
  const {default: assert} = await import('node:assert/strict');
  const {readFileSync} = await import('node:fs');
  const {createRequire, registerHooks} = await import('node:module');
  const {resolveEtsLoaderRoot} = await import('./lib/tool-environment.mjs');
  const {boundedMembers, boundedSurfaceSdk} = await import('./lib/bounded-surface-sdk-probe.mjs');
  const {runtimeOwnerIdentityProbe} = await import('./lib/reader-runtime-admission-probe.mjs');
  registerHooks({resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier+'.ts', context);
      throw error;
    }
  }});
  const base = new URL('../entry/src/main/ets/', import.meta.url);
  const read = path => readFileSync(new URL(path, base), 'utf8');
  const load = path => import(new URL(path, base));
  const [positioning, markers, snapshots, hierarchy, bookmarkProjection, geometry, frame, scroll,
    measurements, metricsApi, horizontal, widthClass, directoryProjection, navigation,
    bookmarkGeometry, recovery, mangaState, mangaVisual, mangaDisplay, mangaLayout, mangaProjection] =
    await Promise.all([
      load('features/reading/ui/ReaderControlListPositioning.ts'), load('features/reading/presentation/ReaderDirectoryMarkerState.ts'),
      load('features/reading/presentation/ReaderDirectoryDataSnapshot.ts'), load('features/reading/ui/ReaderDirectoryHierarchy.ts'),
      load('features/reading/presentation/ReaderBookmarkProjection.ts'), load('ui/layout/ReaderPageGeometry.ts'),
      load('ui/layout/ReaderFrameStyle.ts'), load('ui/layout/ReaderScrollLayout.ts'), load('ui/layout/ReaderMeasurements.ts'),
      load('ui/foundation/ReaderWindowMetrics.ts'), load('ui/layout/SurfaceHorizontalGeometry.ts'),
      load('ui/foundation/ReaderWidthClass.ts'), load('features/reading/presentation/ReaderDirectoryProjection.ts'),
      load('features/reading/application/ReaderDirectoryNavigation.ts'), load('features/reading/ui/ReaderControlBookmarkGeometry.ts'),
      load('features/reading/presentation/ReadingDirectoryRecovery.ts'), load('features/manga/ui/MangaDirectoryState.ts'),
      load('features/manga/ui/MangaDirectoryVisual.ts'), load('features/manga/ui/MangaDirectoryDisplay.ts'),
      load('features/manga/ui/MangaDirectoryLayout.ts'), load('features/manga/presentation/MangaDirectoryPresentation.ts'),
    ]);

  const fullSource = read('features/reading/ui/ReaderFullDirectory.ets');
  const panelSource = read('features/reading/ui/FullDirectoryPanel.ets');
  const mangaSource = read('features/reading/ui/BookDirectoryPage.ets');
  const destinationSource = read('features/reading/ui/ReaderDirectoryDestination.ets');
  const pending = [], scrollIntents = [], scrollCommands = [];
  const Edge = {Top: 'top', Bottom: 'bottom'};
  const metrics = metricsApi.createDefaultReaderWindowMetrics();
  metrics.windowRect.width = 390;
  metrics.windowRect.height = 844;
  metrics.systemInsets = new metricsApi.ReaderInsetsVp(32, 48, 24, 34);
  const entries = Array.from({length: 3000}, (_, ordinal) => ({
    index: ordinal * 2 + 1, title: 'Chapter ' + (ordinal + 1), navigable: ordinal !== 2,
    downloadState: 'missing', bookmarks: ordinal === 1 ? [{time: 10}] : [],
  }));
  class Port {
    constructor(owner, params, _storage, id) {
      Object.assign(this, {owner, params, id, nodes: new Map(), children: new Map()});
    }
    updateStateVars(params) { Object.assign(this.params, params); }
  }
  class FullPort extends Port {}
  class MangaPort extends Port {}
  class Scroller {
    constructor() { this.commands = []; }
    scrollEdge(edge) { this.commands.push(edge); }
    scrollTo(target) { this.commands.push(target); }
    currentOffset() { return {xOffset: 0, yOffset: 0}; }
  }
  const testRuntime = {supportsCoreCapability: () => false};
  const deps = {
    ...positioning, ...markers, ...snapshots, ...hierarchy, ...bookmarkProjection,
    ...geometry, ...frame, ...scroll, ...measurements, ...metricsApi, ...horizontal, ...widthClass,
    ...directoryProjection, ...navigation, ...bookmarkGeometry, ...recovery,
    ...mangaState, ...mangaVisual, ...mangaDisplay, ...mangaLayout, ...mangaProjection,
    visual: mangaVisual.MANGA_DIRECTORY_VISUAL, Edge, Scroller,
    ReaderWindowCoordinator: {metrics: () => metrics},
    ReaderRuntimeOwner: runtimeOwnerIdentityProbe(() => testRuntime),
    registerReaderFonts() {}, prepareReaderFontFamily: async () => {}, prepareMangaSheetFonts: async () => true,
    LengthMetrics: {vp: value => ({value})}, ScrollAlign: {START: 'start'},
    BOOKMARK_ROW_HEIGHT: Number(read('features/reading/ui/ReaderBookmarkRow.ets').match(/BOOKMARK_ROW_HEIGHT = (\d+)/)[1]),
    readerDirectorySignalScrollIntent: identity => scrollIntents.push(identity),
    readerDirectorySignalScrollCommand: identity => scrollCommands.push(identity),
    setTimeout(action) { const timer = {action, cancelled: false}; pending.push(timer); return timer; },
    clearTimeout(timer) { if (timer && typeof timer === 'object') timer.cancelled = true; },
    fullDirectoryBackGeneration: 0, bookDirectoryBackGeneration: 0,
    DirectoryRulesFocusFrame: class { constructor(action) { this.action = action; } },
    uiContext: {getFont: () => ({}), postFrameCallback: frame => pending.push({action: frame.action})},
    consumeReaderControlKeyboardBack: () => false, hilog: {warn() {}, error() {}}, inputMethod: {},
    ReaderDirectoryDestination: Port, ReaderFullDirectory: FullPort, BookDirectoryPage: MangaPort,
    ReaderDirectoryNavigationSurface: Port, ReaderDirectoryList: Port, ReaderDirectoryToolbar: Port,
    FullDirectoryPanel: Port, ReaderDirectoryRules: Port, ReaderDirectoryRecoverySurface: Port,
    PageBackBar: Port, MangaDirectoryCurrentFooter: Port, MangaDirectoryEntryRow: Port, ReaderMangaDownloadPopup: Port,
  };
  const sdk = boundedSurfaceSdk({allowEmptyBranchAdmission: true});
  for (const [name, path] of Object.entries({
    ReaderDirectoryDestination: 'features/reading/ui/ReaderDirectoryDestination.ets',
    ReaderFullDirectory: 'features/reading/ui/ReaderFullDirectory.ets',
    BookDirectoryPage: 'features/reading/ui/BookDirectoryPage.ets',
    FullDirectoryPanel: 'features/reading/ui/FullDirectoryPanel.ets',
    ReaderDirectoryNavigationSurface: 'features/reading/ui/ReaderDirectoryNavigationSurface.ets',
    ReaderDirectoryList: 'features/reading/ui/ReaderDirectoryList.ets',
    ReaderDirectoryToolbar: 'features/reading/ui/ReaderDirectoryToolbar.ets',
    ReaderDirectoryChapterRow: 'features/reading/ui/ReaderDirectoryChapterRow.ets',
    ReaderBookmarkErrorState: 'features/reading/ui/ReaderBookmarkErrorState.ets',
    ReaderBookmarkLoadingState: 'features/reading/ui/ReaderBookmarkLoadingState.ets',
    ReaderBookmarkEmptyState: 'features/reading/ui/ReaderBookmarkEmptyState.ets',
    ReaderBookmarkList: 'features/reading/ui/ReaderBookmarkList.ets',
    ReaderDirectoryRules: 'features/reading/ui/ReaderDirectoryRules.ets',
    ReaderDirectoryRecoverySurface: 'features/reading/ui/ReaderDirectoryRecoverySurface.ets',
    PageBackBar: 'ui/chrome/PageBackBar.ets',
    MangaDirectoryCurrentFooter: 'features/manga/ui/MangaDirectoryCurrentFooter.ets',
    MangaDirectoryEntryRow: 'features/manga/ui/MangaDirectoryEntryRow.ets',
    ReaderMangaDownloadPopup: 'features/manga/ui/ReaderMangaDownloadPopup.ets',
  })) sdk.hooks.childSources[name] = read(path);
  const syntax = createRequire(import.meta.url)(resolveEtsLoaderRoot()+'/lib/validate_ui_syntax.js');
  syntax.builderParamObjectCollection.set('ReaderDirectoryNavigationSurface', new Set(['fallbackBuilder']));
  syntax.builderParamObjectCollection.set('ReaderDirectoryList', new Set(['rowBuilder']));
  if (selectedCase === 'sdk-callbacks') {
    const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
    const chapterSource = read('features/reading/ui/ReaderDirectoryChapterRow.ets');
    deps.ReaderDirectoryChapterRow = createReaderBuilderProbe(chapterSource, boundedMembers(chapterSource),
      {...sdk.deps, ...deps}, sdk.hooks).Component;
  }

  function flush() {
    let turns = 0;
    while (pending.length > 0) {
      assert.ok(++turns < 200, 'actual deferred callbacks settle');
      const timer = pending.shift();
      if (!timer.cancelled) timer.action();
      sdk.properties.flush();
    }
  }
  function component(source, params, extra = {}) {
    return sdk.consumer(source, boundedMembers(source), {...deps, ...extra}, params);
  }
  function panel(params = {}) {
    const owner = component(panelSource, {
      entries, currentChapterIndex: -1, allowUnanchoredBrowse: true,
      panelWidthOverride: 352, panelHeightOverride: 600, ...params,
    });
    owner.aboutToAppear();
    return owner;
  }
  function full(params = {}, extra = {}) {
    const owner = component(fullSource, {
      sourceId: 'source-a', bookId: 'book', catalogContext: 'detail',
      entries, currentChapterIndex: -1, ...params,
    }, extra);
    owner.aboutToAppear();
    return owner;
  }
  function manga(params = {}) {
    const owner = component(mangaSource, {
      sourceId: 'source-a', bookId: 'manga', bookTitle: '漫画',
      entries: entries.slice(0, 40), currentChapterIndex: -1, ...params,
    });
    owner.aboutToAppear();
    return owner;
  }

  if (selectedCase === 'projection') {
    const p = panel();
    assert.equal(p.projectedEntries.length, 3000, 'complete catalog is not the detail preview');
    assert.equal(p.projectedEntries[2].navigable, false);
    assert.equal(p.initialListPositionReady, true, 'detail browsing does not manufacture a reading anchor');
    p.searchDraft = ' chapter 30 '; p.handleControl('search'); flush();
    assert.equal(p.projectedEntries[0].index, 59, 'filter keeps Core index, not result ordinal');
    const ascending = p.projectedEntries.map(entry => entry.index);
    p.handleControl('sort'); flush();
    assert.deepEqual(p.projectedEntries.map(entry => entry.index), ascending.toReversed());
    p.handleControl('bottom'); assert.equal(p.listScroller.commands.at(-1), Edge.Bottom);
    p.searchDraft = 'not present'; p.handleControl('search');
    assert.equal(p.projectedEntries.length, 0);
    assert.equal(p.catalogEmptyMessage(), '没有匹配的章节');
    p.searchDraft = ''; p.handleControl('search');
    assert.equal(p.projectedEntries.length, 3000);
    assert.equal(entries[0].index, 1, 'sort does not mutate host catalog');
    p.catalogMessage = '目录读取失败，请返回详情重试'; p.entries = [];
    assert.equal(p.catalogEmptyMessage(), p.catalogMessage);
    const beforeExit = p.listScroller.commands.length;
    p.aboutToDisappear(); flush();
    assert.equal(p.listScroller.commands.length, beforeExit, 'late sort and search scrolls are retired');

    const m = manga();
    const oldIdentity = m.identity(), [first] = snapshots.snapshotReaderDirectoryData([m.projectedEntries[0]]);
    flush();
    assert.equal(m.listScroller.commands.length, 0, 'manga timer cannot assume a native List is bound');
    m.onListFirstLayout(oldIdentity);
    assert.equal(m.listScroller.commands.at(-1), Edge.Top);
    assert.equal(m.rowIsCurrent(first, oldIdentity), true);
    m.searchDraft = 'no match'; m.applySearch();
    assert.equal(m.rowIsCurrent(first, oldIdentity), false, 'filtered-out manga row loses action admission');
    m.searchDraft = ''; m.applySearch(); flush();
    assert.equal(m.rowIsCurrent(first, oldIdentity), true);
    m.sourceId = 'source-b'; flush();
    assert.equal(m.rowIsCurrent(first, oldIdentity), false, 'equal row index in a different source cannot borrow an old handler');
    const [current] = snapshots.snapshotReaderDirectoryData([m.projectedEntries[0]]);
    assert.equal(m.rowIsCurrent(current, m.identity()), true);
    m.entries[0].navigable = false;
    assert.equal(m.rowIsCurrent(current, m.identity()), false, 'in-place Core fact change invalidates the old manga row before refresh');
    m.aboutToDisappear(); flush();
  }

  if (selectedCase === 'sdk-callbacks') {
    let opening = 8, directoryForeground = true, exits = 0;
    const actions = [];
    const destination = component(destinationSource, {
      opening, catalogContext: 'detail', contentKind: 'text', sourceId: 'source-a', bookId: 'book',
      entries, bookmarkIdentity: {sourceId: 'source-a', bookId: 'book'}, chapterStartBookmarkCreationEnabled: true,
      isOpeningCurrent: value => directoryForeground && value === opening,
      onSelectChapter: index => actions.push(['chapter', index]),
      onSelectNavigationTarget: (index, offset) => actions.push(['tree', index, offset]),
      onDownloadChapter: index => actions.push(['download', index]),
      onDeleteBookmarks: times => actions.push(['delete', times]),
      onCreateChapterStartBookmark: request => actions.push(['create', request]),
      onBack: () => { exits += 1; },
    });
    destination.aboutToAppear(); destination.initialRender();
    const route = [...destination.children.values()].find(child => child instanceof FullPort);
    assert.ok(route, 'the actual text route mounts ReaderFullDirectory');
    assert.ok(![...destination.children.values()].some(child => child instanceof MangaPort));
    const host = full(route.params); host.directoryContent();
    const child = [...host.children.values()].find(actor => actor.params?.allowUnanchoredBrowse);
    assert.ok(child, 'the actual Full Directory mounts its existing body and detail context');
    const p = panel(child.params);
    p.searchControls(); p.chapterList();
    const toolbar = [...p.children.values()].find(actor => actor.params?.showChapterTools);
    const tree = [...p.children.values()].find(actor => actor.params?.chapterEntries);
    assert.ok(toolbar && tree);
    assert.equal(tree.params.sourceId, 'source-a');
    assert.equal(tree.params.chapterEntries.length, 3000);
    assert.equal(tree.params.chapterDownloadEnabled, true);
    tree.params.onDownloadChapter(7);
    tree.params.onSelectTarget(17, 2);
    tree.params.fallbackBuilder();
    const list = [...p.children.values()].find(actor => actor.params?.entries);
    assert.equal(list.params.entries.length, 3000);
    const [first, second] = snapshots.snapshotReaderDirectoryData(list.params.entries.slice(0, 2));
    list.params.rowBuilder({item: first, index: 0});
    list.params.rowBuilder({item: second, index: 1});
    const nodes = sdk.nodes(p);
    const row = nodes.find(node => node.onClick && node.accessibilityText === hierarchy.readerDirectoryAccessibilityText(first));
    const download = nodes.find(node => node.onClick && node.accessibilityText === '未下载，点按下载');
    const create = nodes.find(node => node.onClick && node.accessibilityText === '添加本章章首书签');
    const remove = nodes.find(node => node.onClick && node.accessibilityText === '删除本章已有书签');
    assert.ok(row && download && create && remove, 'actual native fallback rows expose the chapter and marker actions');
    row.onClick(); download.onClick(); create.onClick(); remove.onClick();
    assert.deepEqual(actions, [['download', 7], ['tree', 17, 2], ['chapter', 1], ['download', 1],
      ['create', {chapterIndex: 1, chapterTitle: first.title}], ['delete', [10]]]);
    toolbar.params.onTextChange('no match'); toolbar.params.onSearch();
    p.replayOnly([list.id]); assert.equal(list.params.entries.length, 0);
    row.onClick(); download.onClick(); create.onClick(); remove.onClick();
    assert.equal(actions.length, 6, 'a filtered-out text row cannot act through a retained native callback');
    toolbar.params.onTextChange(''); toolbar.params.onSearch();
    p.replayOnly([list.id]); assert.equal(p.children.get(list.id), list); assert.equal(list.params.entries.length, 3000);
    row.onClick();
    assert.deepEqual(actions.at(-1), ['chapter', 1], 'the retained cloned row works when its exact facts are visible again');
    toolbar.params.onTextChange('Chapter 3000'); toolbar.params.onSearch();
    assert.equal(p.projectedEntries[0].index, 5999);
    toolbar.params.onToggleSort(); assert.equal(p.ascending, false);
    toolbar.params.onTop(); toolbar.params.onBottom(); flush();
    assert.equal(p.listScroller.commands.at(-1), Edge.Bottom);
    assert.ok(scrollIntents.length > 0 && scrollCommands.length > 0);
    assert.equal(scrollIntents.at(-1), scrollCommands.at(-1), 'actual edge control completes the canonical scroll intent');
    directoryForeground = false;
    child.params.onExit();
    assert.equal(host.exitRequested, false, 'a covered opening cannot request exit through its retained callback');
    directoryForeground = true;
    host.interactive = false;
    child.params.onExit();
    assert.equal(host.exitRequested, false, 'a disabled catalog leaves the current exit unconsumed');
    assert.equal(exits, 0);
    host.interactive = true;
    child.params.onExit();
    assert.equal(exits, 1, 'the same catalog can still return after foreground restores');
    assert.equal(host.exitRequested, true, 'the actual detail close is admitted synchronously');
    child.params.onExit();
    assert.equal(exits, 1, 'the same physical directory can request its synchronous exit only once');
    opening += 1;
    row.onClick(); download.onClick(); tree.params.onDownloadChapter(7); create.onClick();
    assert.equal(actions.length, 7, 'retired route rejects native fallback and tree callbacks');
    p.aboutToDisappear(); host.aboutToDisappear(); destination.aboutToDisappear();
  }

  if (selectedCase === 'measured-frame') {
    const bookTitle = '测量目录书名';
    const chapterTitle = '测量目录章节';
    const owner = full({bookTitle, chapterTitle});
    owner.initialRender();
    const frameActor = sdk.walk(owner).find(actor => actor.frameStyle !== undefined && actor.geometry !== undefined &&
      actor !== owner);
    const hostArea = [...owner.nodes.values()].find(node => node.onAreaChange);
    assert.ok(frameActor && hostArea, 'actual Full Directory mounts the shared measured page host');
    const topBars = () => sdk.walk(owner).filter(actor => actor.params?.variant === 'directory' &&
      actor.params?.bookTitle === bookTitle);
    assert.equal(topBars().length, 1, 'Full Directory delegates its titles to one actual ReaderReadingTopBar');
    const [topBar] = topBars();
    const topBarNodes = [...topBar.nodes.values()];
    const topBarFrame = topBarNodes.find(node => node.type === 'Row' && node.borderRadius === 24);
    assert.equal(topBarFrame?.height, 54, 'the shared top bar paints the directory card at its authored height');
    for (const [label, height, role] of [
      [bookTitle, 22, sdk.deps.TYPE_READER_DIRECTORY_BOOK_TITLE],
      [chapterTitle, 17, sdk.deps.TYPE_READER_DIRECTORY_CHAPTER],
    ]) {
      const text = topBarNodes.find(node => node.type === 'Text' && node.create === label);
      assert.equal(text?.height, height, 'the shared directory title keeps its text box height');
      assert.equal(text.maxLines, 1);
      assert.equal(text.fontSize, role.fontSizeFp, 'the shared title uses the matching directory role');
    }
    const child = sdk.walk(owner).find(actor => actor.params?.allowUnanchoredBrowse);
    const targets = child.params.entries;
    hostArea.onAreaChange({}, {width: '365vp', height: '600vp'}); sdk.properties.flush();
    assert.equal(owner.containerWidth, 365);
    assert.equal(owner.panelViewportHeight(), owner.fullPanelHeight(), 'the actual detail directory uses its full endpoint');
    assert.equal(owner.panelTop(), owner.fullPanelTop(), 'the actual detail directory uses its original measured top');
    assert.ok(owner.panelWidth() > 0 && owner.panelLeft() + owner.panelWidth() <= 365,
      'measured content follows the host, including its safe margins');
    const header = sdk.walk(frameActor).find(actor => typeof actor.onHeightChange === 'function' && actor.style !== undefined);
    assert.ok(header, 'shared fixed-header actor carries the measurement');
    const area = [...header.nodes.values()].find(node => node.type === 'Column' && node.onAreaChange);
    assert.ok(area, 'actual native header area is observable');
    area.onAreaChange({}, {height: '62vp'}); sdk.properties.flush();
    const start = owner.fullPanelTop();
    area.onAreaChange({}, {height: '91vp'}); sdk.properties.flush();
    assert.equal(owner.fullPanelTop() - start, 29, 'header measurement changes the retained body offset exactly once');
    for (const width of ['invalid', 0, -1, NaN, Infinity]) hostArea.onAreaChange({}, {width, height: '600vp'});
    sdk.properties.flush();
    assert.equal(owner.containerWidth, 365, 'invalid Area values preserve the last admitted host width');
    assert.equal(topBars().length, 1);
    assert.equal(topBars()[0], topBar, 'measurement keeps the same shared title actor');
    assert.equal(sdk.walk(owner).find(actor => actor.params?.allowUnanchoredBrowse), child);
    assert.equal(child.params.entries, targets, 'header measurement cannot replace canonical targets');
    owner.aboutToDisappear();
  }

  if (selectedCase === 'manga-header') {
    const owner = manga();
    for (let turn = 0; turn < 12; turn++) await Promise.resolve();
    assert.equal(owner.mangaFontsReady, true, 'actual page font owner admits the loaded fonts');
    owner.initialRender();
    const headerRows = sdk.nodes(owner).filter(node => node.type === 'Column' && node.zIndex === 10 && node.padding);
    assert.equal(headerRows.length, 1, 'one actual scaffold owns the floating title placement');
    const header = headerRows[0];
    assert.equal(header.padding.left, owner.headerFrame().left);
    assert.equal(header.padding.right, owner.headerFrame().right);
    const visual = mangaVisual.MANGA_DIRECTORY_VISUAL;
    const insideEdge = visual.headerPadding + visual.borderWidth;
    assert.ok(header.padding.left + insideEdge >= metricsApi.readerInteractiveSafeLeft(metrics));
    assert.ok(header.padding.right + insideEdge >= metricsApi.readerInteractiveSafeRight(metrics));
    owner.aboutToDisappear(); flush();
  }

  if (selectedCase === 'rules-eligibility') {
    for (const [sourceId, bookKind, capability, expected] of [
      ['local', 'EPUB', true, false], ['local', 'MOBI', true, false], ['local', 'KF8', true, false],
      ['local', 'AZW3', true, false], ['local', 'PDF', true, false], ['local', '', true, false],
      ['local', 'novel.txt', true, false], ['remote', 'TXT', true, false], ['local', 'TXT', false, false],
      ['local', 'TXT', true, true], ['local', 'txt', true, true], ['local', 'local', true, true],
    ]) {
      const owner = full({sourceId, bookKind, bookId: 'misleading.txt'}, {
        ReaderRuntimeOwner: {current: () => ({supportsCoreCapability: () => capability})},
      });
      owner.topBar();
      const trigger = [...owner.nodes.values()].find(node => node.accessibilityText === '本书目录层级规则');
      assert.equal(trigger !== undefined, expected, `actual editor eligibility: ${sourceId}/${bookKind}/${capability}`);
      if (trigger) trigger.onClick();
      owner.directoryContent();
      const editor = [...owner.children.values()].find(actor => typeof actor.params?.onApplied === 'function');
      assert.equal(editor !== undefined, expected, 'only the admitted text directory opens its rules editor');
      if (editor) {
        assert.equal(editor.params.bookId, 'misleading.txt');
        editor.params.onApplied(); assert.equal(owner.directoryRulesRevision, 1);
        owner.bookId = 'another-txt';
        assert.equal(owner.directoryRulesVisible, false);
        assert.equal(owner.directoryRulesRevision, 0);
        editor.params.onApplied(); assert.equal(owner.directoryRulesRevision, 0, 'old editor cannot publish into a different book');
        owner.showDirectoryRules(owner.temporaryBackIdentity, owner.bookId, true);
        assert.equal(owner.directoryRulesVisible, true);
        owner.bookKind = 'EPUB';
        assert.equal(owner.directoryRulesVisible, false);
        assert.equal(owner.directoryRulesAvailable(), false);
        owner.bookKind = 'TXT';
        assert.equal(owner.directoryRulesAvailable(), true);
        assert.equal(owner.directoryRulesVisible, false, 'restoring eligibility does not reopen the retired editor');
        owner.showDirectoryRules(owner.temporaryBackIdentity, owner.bookId, true);
        owner.sourceId = 'remote';
        assert.equal(owner.directoryRulesVisible, false);
      }
      owner.aboutToDisappear(); flush();
    }
    const unavailable = full({sourceId: 'local', bookKind: 'TXT'}, {
      ReaderRuntimeOwner: {current() { throw Error('ReaderRuntimeOwner must be installed by EntryAbility'); }},
    });
    assert.equal(unavailable.directoryRulesAvailable(), false);
    unavailable.aboutToDisappear();
    const broken = full({sourceId: 'local', bookKind: 'TXT'}, {
      ReaderRuntimeOwner: {current: () => ({supportsCoreCapability() { throw Error('provider failure'); }})},
    });
    assert.throws(() => broken.directoryRulesAvailable(), /provider failure/);
    broken.aboutToDisappear();
  }
}

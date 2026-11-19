import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { MANGA_DIRECTORY_VISUAL } from '../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts';
import { ReaderScrollLayout, readerScrollStartOffset, readerScrollEndOffset } from '../entry/src/main/ets/ui/layout/ReaderScrollLayout.ts';

const definitions = {
  'rules-refresh-retry': {
    description: 'Actual rules refresh Prop Watch keeps stale rows blocked while same-opening native recovery retries unavailable/rejected reads and retains input/generation fences.',
    resources: [],
  },
  'short-query-scroll': { description: 'Actual Book applySearch preserves its inline query viewport and cancels pending old scroll work. Full overlay retains existing scroll-to-top entry.', resources: [] },
  'empty-prefix-transition': {
    description: 'Actual manga Surface keeps the existing prefix consumer through confirmed-empty to current pending/failed query input. Finite public child renderer and font/navigation ports, no native Grid or Core filter simulation.',
    resources: [],
  },
  'retained-surface': {
    description: 'Actual SDK nested directory Surface keeps retained content in one fixed slot and uses current generation receivers',
    resources: [],
  },
};
const read = name => readFileSync(new URL('../entry/src/main/ets/features/reading/ui/' + name + '.ets', import.meta.url), 'utf8');
const source = read('ReaderDirectoryNavigationSurface');
const entries = [{ index: 0, title: 'Chapter One', navigable: true }];

class ChildPort {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
  updateStateVars(params) { this.params = params; }
}
class Trace {
  step() {}
  isEnabled() { return false; }
}
const settle = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
function materializeItems(owner) {
  const rendered = new Set();
  for (;;) {
    const item = [...owner.nodes.values()].find(node => node.type === 'ListItem' && !rendered.has(node.id));
    if (item === undefined) return;
    rendered.add(item.id);
    if (typeof item.create?.[0] === 'function') item.create[0](item.id, true);
  }
}

function fixture({ retained = true, prefix = false, query = '', render = 'build', injected = false, tree = false, manga = false, implementation = source } = {}) {
  const sdk = boundedSurfaceSdk();
  sdk.hooks.childSources.ReaderDirectoryNavigationList = read('ReaderDirectoryNavigationList');
  const requests = [], timers = [], feedback = [];
  const runtime = {};
  let runtimeCurrent = runtime, clears = 0;
  const deps = {
    ReaderDirectoryNavigationList: ChildPort,
    ReaderDirectoryTrace: Trace,
    ReaderDirectoryTraceFrame: class { constructor(action) { this.onFrame = action; } },
    ReaderTransientFeedback: class { reset() {} show(_context, value) { feedback.push(value); } },
    ReaderRuntimeOwner: { current: () => runtime, isCurrent: owner => owner === runtimeCurrent },
    ReaderDirectoryNavigationGateway: class {},
    ReaderScrollLayout,
    prepareMangaSheetFonts: async () => true,
    readerScrollStartOffset, readerScrollEndOffset,
    ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
    readerDirectoryScopeKey: (sourceId, bookId) => sourceId + ':' + bookId,
    readerDirectoryObserveScrollIntent: () => () => {},
    readerDirectoryViewportAnchor: () => undefined,
    projectReaderDirectoryEntries: data => data,
    openReaderDirectoryNavigation(_gateway, input, current) {
      let resolve, reject;
      const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
      requests.push({ input, current, resolve, reject });
      return promise;
    },
    setTimeout(action) { const timer = { action }; timers.push(timer); return timer; },
    clearTimeout(timer) { timer.cancelled = true; },
    uiContext: { postFrameCallback() {} },
  };
  const nativeList = createReaderBuilderProbe(read('ReaderDirectoryNavigationList'),
    ['build', 'emptyPrefix', 'nativeHeaderCount', 'prefixBuilder', 'emptyBuilder', 'headerCount'],
    { ...sdk.deps, ...deps }, sdk.hooks).Component;
  class MountedListPort extends ChildPort {
    constructor(...args) { super(...args); this.children = new Map(); this.nodes = new Map(); }
    initialRender() {
      this.list = new nativeList(this, {});
      Object.assign(this.list, this.params, { dataSource: { totalCount: () => 0 },
        mangaDisplay: false, prefixEverMounted: false, mounted: true });
      this.children.set('native-list', this.list);
      this.list.initialRender();
    }
    updateStateVars(params) {
      super.updateStateVars(params);
      Object.assign(this.list, params, { mangaDisplay: false });
      this.list.replay();
    }
  }
  deps.ReaderDirectoryNavigationList = MountedListPort;
  const owner = sdk.consumer(implementation, boundedMembers(implementation), deps, {
    sourceId: 'local', bookId: 'book-a', openRevision: 'open-a', query,
    chapterEntries: retained ? entries : [], headerCount: prefix ? 1 : 0,
    mangaDisplay: manga,
    ...(injected ? { navigationPortFactory: () => ({}) } : {}),
  });
  Object.assign(owner, { fallbackBuilder() {}, prefixBuilder() {}, onClearSearch: () => { clears++; } });
  owner.aboutToAppear();
  if (tree) owner.view = { viewId: 'retained-view', navigationRevision: 'nav', visibleTotal: 1, nodes: [] };
  if (render === 'build') { owner.initialRender(); materializeItems(owner); }
  else if (render === 'empty') owner.treeEmptyState();
  const setProps = updates => { for (const [name, value] of Object.entries(updates)) owner[name] = value; };
  return { sdk, owner, requests, feedback, timers, clears: () => clears,
    setProps,
    retireRuntime() { runtimeCurrent = {}; },
    async fail() { requests.at(-1).resolve(undefined); await settle(); sdk.properties.flush(); },
    nextQuery(value) { setProps({ query: value }); },
  };
}

function actualAction(f) {
  const actions = f.sdk.walk(f.owner).filter(child => child instanceof f.sdk.deps.ReaderRecoveryAction);
  assert.ok(actions.length > 0, 'actual shared RecoveryAction is mounted');
  const child = actions.at(-1);
  const buttons = [...child.nodes.values()].filter(node => node.type === 'Button' && typeof node.onClick === 'function');
  const button = buttons.at(-1);
  assert.ok(button, 'actual shared native Button callback exists');
  return { child, button, callback: button.onClick,
    nativeId: [...child.nodes.entries()].find(([, node]) => node === button)[0] };
}

function fixedRetainedSlot(f = fixture()) {
  const [rootId, root] = [...f.owner.nodes.entries()].find(([, node]) => node.type === 'Stack');
  const [slotId, slot] = [...f.owner.nodes.entries()].find(([id, node]) => id !== rootId && node.type === 'Stack');
  assert.equal(root.create.alignContent, 'Alignment.BottomEnd');
  assert.equal(root.width, '100%'); assert.equal(root.height, '100%');
  assert.equal(slot.width, '100%'); assert.equal(slot.height, '100%');
  assert.equal(slot.layoutWeight, undefined);
  assert.equal(f.sdk.nodes(f.owner).some(node => node.text === '正在加载目录'), false,
    'automatic refresh adds no flow status line above retained content');
  return { f, rootId, slotId, root, slot };
}

async function retainedFailure(implementation = source) {
  fixedRetainedSlot();
  const f = fixture({ render: 'defer', tree: true, implementation });
  await f.fail();
  f.owner.initialRender();
  materializeItems(f.owner);
  const { rootId, slotId, root, slot } = fixedRetainedSlot(f);
  const listOwner = f.sdk.walk(f.owner).find(child => [...child.nodes.values()].some(node => node.type === 'List'));
  const [nativeListId, nativeList] = [...listOwner.nodes.entries()].find(([, node]) => node.type === 'List');
  assert.equal(nativeList.width, '100%'); assert.equal(nativeList.height, '100%');
  assert.equal(nativeList.enableScrollInteraction, true);
  const action = actualAction(f);
  assert.equal(f.owner.nodes.get(rootId), root);
  assert.equal(f.owner.nodes.get(slotId), slot);
  assert.equal(slot.width, '100%'); assert.equal(slot.height, '100%');
  const overlay = [...f.owner.nodes.values()].find(node => node.type === 'Row' && node.zIndex === 1);
  assert.ok(overlay, 'retry lives in the existing local content Stack overlay');
  assert.equal(overlay.width, undefined, 'overlay does not own a full-width hit region');
  assert.equal(overlay.height, undefined, 'overlay does not own a full-height hit region');
  assert.equal(overlay.hitTestBehavior, 'HitTestMode.Default');
  assert.deepEqual(overlay.margin, { right: 8, bottom: 8 });
  assert.equal(overlay.padding, undefined, 'outside gap does not enlarge the retry hit box');
  let propagationStops = 0;
  overlay.onTouch({ stopPropagation: () => { propagationStops++; } });
  assert.equal(propagationStops, 1, 'retry touch stops basic touch event bubbling');
  assert.ok(action.button.constraintSize.minHeight >= 44);
  assert.equal(action.button.enabled, true);
  assert.equal(f.feedback.length, 1, 'failure retains its original transient feedback category');
  const before = f.requests.length;
  action.callback();
  assert.equal(f.requests.length, before + 1, 'current native retry reaches original read operation');
  assert.equal(f.owner.loadPending, true);
  assert.equal(f.owner.loadFailed, false);
  action.callback();
  assert.equal(f.requests.length, before + 1, 'retired retry cannot repeat while successor read is pending');
  f.sdk.properties.flush();
  assert.equal(f.owner.nodes.get(slotId), slot);
  assert.equal(slot.height, '100%', 'retry cannot resize the retained content slot');
  assert.equal(listOwner.nodes.get(nativeListId), nativeList, 'actual production native List id survives the read-state handoff');
  assert.equal(nativeList.enableScrollInteraction, true, 'local retry does not disable the underlying List outside its own box');
  return f;
}

async function retainedReceivers(prefix, implementation = source) {
  const pending = fixture({ retained: false, prefix });
  const pendingState = pending.sdk.walk(pending.owner).find(child => child instanceof pending.sdk.deps.ReaderPageState);
  assert.ok(pendingState); assert.equal(pendingState.loading, true);
  const f = fixture({ retained: false, prefix, render: 'defer', implementation });
  await f.fail();
  f.owner.initialRender();
  materializeItems(f.owner);
  const state = f.sdk.walk(f.owner).find(child => child instanceof f.sdk.deps.ReaderPageState);
  assert.ok(state); assert.equal(state.loading, false);
  const first = actualAction(f), receiver = first.child.onReconcile;
  first.callback();
  const count = f.requests.length;
  await f.fail();
  const next = actualAction(f);
  assert.equal(next.child, first.child, 'loading/failure updates retain the actual shared action child');
  assert.equal(next.child.onReconcile, receiver, 'ordinary receiver remains the same constructor field');
  assert.notEqual(next.nativeId, first.nativeId, 'the new request generation owns a new physical action');
  first.callback(); assert.equal(f.requests.length, count, 'old native generation is rejected');
  next.callback(); assert.equal(f.requests.length, count + 1, 'retained receiver accepts the new current generation');
  return f;
}

async function clearDuringDebounce(implementation = source) {
  const f = fixture({ retained: false, query: 'first', render: 'defer', implementation });
  f.requests[0].resolve({ viewId: 'confirmed-empty', navigationRevision: 'nav', visibleTotal: 0, nodes: [],
    identity: { sourceId: 'local', bookId: 'book-a', catalogRevision: 'catalog', structureRevision: 'structure' } });
  await settle();
  f.owner.treeEmptyState();
  const first = actualAction(f), receiver = first.child.onReconcile;
  first.callback(); assert.equal(f.clears(), 1);
  f.nextQuery('successor');
  first.callback(); assert.equal(f.clears(), 1, 'actual query Prop/Watch handoff rejects old input');
  f.sdk.properties.flush();
  assert.notEqual(f.owner.openedInputKey, f.owner.currentReadInputKey(), 'new query read remains debounced');
  const next = actualAction(f);
  assert.equal(next.child, first.child); assert.equal(next.child.onReconcile, receiver);
  first.callback(); assert.equal(f.clears(), 1);
  next.callback(); assert.equal(f.clears(), 2, 'current clear targets current query during its debounce window');
  for (const [key, value] of [['sourceId', 'remote'], ['bookId', 'book-b'], ['openRevision', 'open-b']]) {
    f.setProps({ [key]: value });
    next.callback(); assert.equal(f.clears(), 2, key + ' actual identity handoff rejects previous action');
    f.sdk.properties.flush();
  }
  const current = actualAction(f), before = f.clears();
  f.retireRuntime(); current.callback(); assert.equal(f.clears(), before, 'retired runtime rejects native action');
  f.owner.aboutToDisappear(); current.callback(); assert.equal(f.clears(), before, 'unmounted action cannot clear successor state');
}

function consumerAssembly() {
  const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  for (const name of ['ReaderDirectoryNavigationSurface', 'FullDirectoryPanel',
    'ReaderBookmarkErrorState', 'ReaderBookmarkLoadingState', 'ReaderBookmarkEmptyState']) {
    sdk.hooks.childSources[name] = read(name);
  }
  const make = (name, method, params, args = [], implementation = read(name)) => {
    const owner = sdk.consumer(implementation, [method], { ReaderDirectoryNavigationSurface: ChildPort,
      FullDirectoryPanel: ChildPort, visual: { gridHeight: 58, gridGap: 6, narrowWidth: 340 },
      isReaderLocalTxtFormat: () => false });
    Object.assign(owner, params); owner[method](...args);
    const child = [...owner.children.values()].find(child => child instanceof ChildPort);
    assert.ok(child, name + ' real production Builder reaches the shared directory slot');
    return { owner, child };
  };
  const control = make('ReaderControlDirectoryContent', 'listBody', {
    tab: 'directory', shortContent: false, navigationActive: false, bookmarkIdentity: { sourceId: 'local', bookId: 'book-a' },
    displaySnapshot: () => ({ loading: false, rows: entries }), displayCatalogComplete: () => true,
    headerCount: () => 0, prefixHeight: () => 0, rowHeight: () => 32, rowPadding: () => 0,
    currentInputEnabled: () => true, bookmarkWriteEnabled: () => true, sessionKey: 'open-control', entries,
  });
  assert.equal(control.child.params.showLoadStatus, true);
  assert.equal(control.child.params.headerCount, 0);
  for (const hasRows of [false, true]) {
    const full = make('FullDirectoryPanel', 'chapterList', {
      bookmarkIdentity: { sourceId: 'local', bookId: 'book-a' }, projectedEntries: hasRows ? entries : [],
      admittedEntries: entries, navigationActive: false, listSessionKey: 'open-full', activeTab: 'directory',
      chapterActionsEnabled: true, motionActive: false, initialListPositionReady: true,
      standaloneShort: () => true, standalonePrefixHeight: () => 60, fontScale: () => 1, innerWidth: () => 300,
      directoryListRowHeight: () => 40, directoryListPaddingX: () => 10,
      directoryListWidth: () => 300, directoryListViewportHeight: () => 400, chapterListHeight: () => 400,
    });
    assert.equal(full.child.params.showLoadStatus, hasRows, 'Full caller retains its original visibility policy');
    assert.equal(full.child.params.headerCount, 1);
  }
  const book = make('BookDirectoryPage', 'mangaContent', {
    admittedIdentity: 'book-open', sourceId: 'local', bookId: 'book-a', admittedEntries: entries,
    geometry: { content: { frame: { left: 10, right: 10 } } }, viewportWidth: 320,
    mangaVisibleTopInset: () => 0, mangaNarrow: () => true, directoryScrollLayout: () => ({}),
    mangaToolbar() {}, mangaFlowFooter: () => false,
  });
  assert.equal(book.child.params.mangaDisplay, true);
  assert.equal(book.child.params.openRevision, 'book-open');
  const mangaSource = readFileSync(new URL('../entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets', import.meta.url), 'utf8');
  for (const catalog of [false, true]) {
    const manga = make('MangaReadingSurface', 'directoryBody', {
      sourceId: 'local', bookId: 'book-a', directoryQuery: 'query', directoryAscending: true, publishedManifestVersion: 'manifest',
      directoryOpenRevision: 2, stageWidth: 320, viewportWidth: 320, backgroundPreference: 'paper', panelPhase: 'closed',
      directoryOuterIdentity: () => 'manga-open', directoryCurrentIndex: () => 0, directoryInitialWidth: () => 320,
      directoryCurrentOpenInset: () => 0, widePanel: () => false, directorySheetInputCurrent: () => true,
      directoryEntries: () => entries, directoryQuickHeight: () => 200,
    }, [catalog], mangaSource);
    assert.equal(manga.child.params.mangaDisplay, true);
    assert.equal(manga.child.params.mangaQuickDisplay, !catalog);
    assert.equal(manga.child.params.interactionEnabled, true);
  }
  const wrapper = make('ReaderFullDirectory', 'directoryContent', {
    sourceId: 'local', bookId: 'book-a', entries, catalogContext: 'detail', temporaryBackIdentity: 'full-open',
    directoryRecovery: {}, interactive: true, directoryRulesVisible: false, directoryRulesOpened: false,
    usesExpandedLayout: () => false, panelWidth: () => 300, fullPanelHeight: () => 500,
    panelViewportHeight: () => 500, panelLeft: () => 0, panelTop: () => 0,
    headerLayoutReady: () => true, bookmarkWriteEnabled: () => true,
  });
  assert.equal(wrapper.child.params.allowUnanchoredBrowse, true);
  assert.equal(wrapper.child.params.panelWidthOverride, 300);
  assert.equal(wrapper.child.params.panelHeightOverride, 500);
}

async function rulesRefreshRetry(implementation = source) {
  const results = [];
  for (const failure of ['unavailable', 'rejected']) {
    const f = fixture({ retained: true, render: 'defer', implementation });
    let input = true;
    f.owner.inputCurrent = () => input;
    const ready = viewId => ({ viewId, navigationRevision: 'nav', visibleTotal: 0, nodes: [],
      identity: { sourceId: 'local', bookId: 'book-a', catalogRevision: 'catalog', structureRevision: 'structure' } });
    f.requests[0].resolve(ready('original-view'));
    await settle();
    assert.equal(f.owner.view.viewId, 'original-view');
    f.setProps({ refreshRevision: 1 });
    assert.equal(f.owner.awaitingRulesRefresh, true);
    assert.equal(f.owner.directoryInputCurrent(), false, 'previous tree rows are blocked during rules refresh');
    assert.equal(f.requests.length, 2, 'actual refreshRevision Watch starts original read');
    if (failure === 'unavailable') f.requests[1].resolve(undefined);
    else f.requests[1].reject(new Error('directory transport failed'));
    await settle();
    assert.equal(f.owner.loadFailed, true); assert.equal(f.owner.loadPending, false);
    assert.equal(f.owner.awaitingRulesRefresh, true, 'failed refresh still owns stale-tree protection');
    assert.equal(f.owner.retryInputCurrent(), true, 'same-opening rules failure exposes retry');
    assert.equal(f.owner.directoryInputCurrent(), false);
    f.owner.treeEmptyState();
    const action = actualAction(f);
    assert.equal(action.button.enabled, true, 'actual recovery native Button is enabled');
    const count = f.requests.length;
    input = false; action.callback();
    assert.equal(f.requests.length, count, 'instantaneous input loss rejects native recovery');
    input = true; action.callback();
    assert.equal(f.requests.length, count + 1, 'native retry reaches same opening original read');
    action.callback(); assert.equal(f.requests.length, count + 1, 'pending and retired generation reject duplicate retry');
    assert.equal(f.owner.directoryInputCurrent(), false, 'retry keeps old-tree rejection until current ready');
    f.requests.at(-1).resolve(ready('replacement-view'));
    await settle();
    assert.equal(f.owner.awaitingRulesRefresh, false);
    assert.equal(f.owner.directoryInputCurrent(), true);
    assert.equal(f.owner.view.viewId, 'replacement-view');
    f.owner.aboutToDisappear(); action.callback();
    assert.equal(f.requests.length, count + 1, 'retired native action cannot restart a successor');
    results.push(failure);
  }
  return results;
}

for (const id of selectContractCases(definitions)) {
  if (id === 'rules-refresh-retry') {
    const result = await rulesRefreshRetry();
    const old = source.replace('return this.openingInputCurrent() && expected === this.generation',
      'return this.directoryInputCurrent() && expected === this.generation');
    assert.notEqual(old, source);
    await assert.rejects(() => rulesRefreshRetry(old), /same-opening rules failure exposes retry/);
    console.log(JSON.stringify({ case: id, result, negativeControlRejected: true,
      boundary: 'Actual Surface Prop Watch/openTree and SDK RecoveryAction native callback. Navigation RPC and native layout are finite ports.' }));
    recordContractCasePass(id);
    continue;
  }
  if (id === 'short-query-scroll') {
    const pageSource = read('BookDirectoryPage');
    const run = (short, implementation = pageSource) => {
      const timers = [], calls = [], projections = [];
      const owner = createReaderBuilderProbe(implementation,
        ['applySearch', 'scheduleTopScroll', 'onListUserScroll', 'flushPendingScroll'], {
          projectReaderDirectoryEntries: entries => entries,
          mangaDirectoryContextEntries: entries => entries,
          setTimeout: action => { timers.push(action); }, Edge: { Top: 'Top' },
        }).owner;
      Object.assign(owner, { searchDraft: 'MissingA', admittedEntries: entries,
        projectedEntries: entries, scrollGeneration: 0, pendingMangaCurrentScroll: true,
        mounted: true, listReady: true, navigationActive: true,
        mangaFlowFooter: () => short, publishProjection: value => projections.push(value),
        listScroller: { scrollEdge: edge => calls.push(edge) } });
      owner.scheduleTopScroll();
      owner.applySearch();
      for (const timer of timers) timer();
      assert.equal(owner.searchQuery, 'MissingA'); assert.equal(projections.length, 1);
      if (short) {
        assert.deepEqual(calls, [], 'typing in the inline prefix cannot scroll its query field offscreen');
        assert.equal(owner.pendingScrollEdge, undefined);
        assert.equal(owner.pendingMangaCurrentScroll, false);
        assert.equal(owner.navigationInteracted, true);
      } else assert.deepEqual(calls, ['Top'], 'full overlay retains current scroll-to-top semantics');
    };
    run(true); run(false);
    const legacy = pageSource.replace(
      'if (this.mangaFlowFooter()) this.onListUserScroll();\n    else this.scheduleTopScroll();', 'this.scheduleTopScroll();');
    assert.notEqual(legacy, pageSource);
    assert.throws(() => run(true, legacy), /offscreen/);
    recordContractCasePass(id);
    continue;
  }
  if (id === 'empty-prefix-transition') {
    const f = fixture({ retained: true, prefix: true, manga: true, query: 'missing-a', render: 'defer' });
    await settle();
    assert.equal(f.requests.length, 1);
    f.requests[0].resolve({ viewId: 'confirmed-empty', navigationRevision: 'nav', visibleTotal: 0, nodes: [],
      identity: { sourceId: 'local', bookId: 'book-a', catalogRevision: 'catalog', structureRevision: 'structure' } });
    await settle();
    f.owner.initialRender(); materializeItems(f.owner);
    const renderCurrentState = (implementation = source) => {
      const sdk = boundedSurfaceSdk();
      const childSources = { ReaderDirectoryNavigationList: read('ReaderDirectoryNavigationList'),
        ReaderPageState: readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderPageState.ets', import.meta.url), 'utf8'),
        ReaderRecoveryAction: readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderRecoveryAction.ets', import.meta.url), 'utf8') };
      const owner = createReaderBuilderProbe(implementation, ['build', 'hasPrefix', 'hasRetainedContent', 'treeEmptyState'], {
        ...sdk.deps, ReaderDirectoryNavigationList: ChildPort, ReaderPageState: ChildPort, ReaderRecoveryAction: ChildPort,
      }, { ...sdk.hooks, childSources }).owner;
      Object.assign(owner, { mangaDisplay: true, mangaFontsReady: true, headerCount: 1, showLoadStatus: true,
        view: f.owner.view, loadPending: f.owner.loadPending, loadFailed: f.owner.loadFailed,
        query: f.owner.query, chapterEntries: entries, prefixBuilder() {}, fallbackBuilder() {},
        retryInputCurrent: () => f.owner.retryInputCurrent(), clearInputCurrent: () => f.owner.clearInputCurrent(),
        retryCurrent: expected => f.owner.retryCurrent(expected), clearCurrent: expected => f.owner.clearCurrent(expected),
        generation: f.owner.generation, mangaVisibleTopInset: 98, interactionEnabled: true,
      });
      owner.initialRender();
      const child = [...owner.children.values()].find(child => child.params?.view !== undefined);
      return { owner, child, state() {
        assert.ok(child, 'current state keeps the actual prefix consumer slot');
        child.params.emptyBuilder();
        return [...owner.children.values()].find(value => value.params?.message !== undefined);
      } };
    };
    const ready = renderCurrentState();
    assert.ok(ready.child, 'confirmed empty state renders the actual prefix consumer slot');
    assert.equal(ready.child.params.emptyReadStateVisible, false);
    assert.equal(ready.state().params.actionLabel, '清除搜索');
    f.nextQuery('missing-b');
    f.timers.filter(timer => !timer.cancelled).at(-1).action();
    await settle(); f.sdk.properties.flush();
    assert.equal(f.owner.loadPending, true);
    const pending = renderCurrentState();
    assert.ok(pending.child, 'current pending query must keep rendering its prefix consumer slot');
    assert.equal(pending.child.params.emptyReadStateVisible, true);
    assert.equal(pending.state().params.loading, true);
    assert.equal(pending.state().params.actionLabel, '');
    await f.fail();
    assert.equal(f.owner.loadFailed, true);
    const failed = renderCurrentState(), retry = failed.state().params;
    assert.equal(failed.child.params.emptyReadStateVisible, true);
    assert.equal(retry.message, '目录加载失败'); assert.equal(retry.actionLabel, '重试加载目录');
    assert.equal(retry.actionEnabled, true);
    const count = f.requests.length;
    retry.onAction(retry.actionGeneration); await settle();
    assert.equal(f.requests.length, count + 1, 'current empty-view retry reaches the original reader');
    retry.onAction(retry.actionGeneration); await settle();
    assert.equal(f.requests.length, count + 1, 'current repeated retry is coalesced while pending');
    await f.fail();
    const currentRetry = renderCurrentState().state().params;
    assert.notEqual(currentRetry.actionGeneration, retry.actionGeneration);
    retry.onAction(retry.actionGeneration); await settle();
    assert.equal(f.requests.length, count + 1, 'old request generation remains rejected');
    const renderGridEmpty = (visible, implementation = read('ReaderDirectoryNavigationList')) => {
      const sdk = boundedSurfaceSdk();
      const owner = createReaderBuilderProbe(implementation,
        ['mangaEmptyState', 'emptyReadStateVisible', 'emptyBuilder', 'emptyPrefix'],
        { ...sdk.deps, MANGA_DIRECTORY_VISUAL, ReaderPageState: ChildPort },
        { ...sdk.hooks, childSources: { ReaderPageState: readFileSync(new URL(
          '../entry/src/main/ets/ui/feedback/ReaderPageState.ets', import.meta.url), 'utf8') } }).owner;
      let builderCalls = 0;
      Object.assign(owner, { emptyReadStateVisible: visible, emptyBuilder: () => { builderCalls++; },
        view: f.owner.view, mangaSearchActive: true, mangaColor: () => '#777777', mangaEmptyActions() {} });
      owner.mangaEmptyState();
      return { builderCalls, owner };
    };
    assert.equal(renderGridEmpty(true).builderCalls, 1,
      'actual native Grid empty-item Builder delegates the current loading/failure state');
    const quiet = renderGridEmpty(false);
    assert.equal(quiet.builderCalls, 0);
    assert.equal([...quiet.owner.children.values()].at(-1).params.message, '没有匹配的章节',
      'ordinary confirmed-empty manga presentation keeps its original recipe');
    const discardedState = read('ReaderDirectoryNavigationList').replace(
      'if (this.emptyReadStateVisible) {', 'if (false) {');
    assert.equal(renderGridEmpty(true, discardedState).builderCalls, 0,
      'negative detects the original Grid path discarding the shared read-state Builder');
    const legacy = source.replace('!(this.view !== undefined && this.headerCount === 1) &&', '');
    assert.notEqual(legacy, source);
    assert.equal(renderCurrentState(legacy).child, undefined, 'historical empty read branch removes the prefix slot');
    f.owner.aboutToDisappear();
    currentRetry.onAction(currentRetry.actionGeneration); await settle();
    assert.equal(f.requests.length, count + 1, 'retired owner cannot retry a successor');
    recordContractCasePass(id);
    continue;
  }
  if (id !== 'retained-surface') continue;
  await retainedFailure();
  await retainedReceivers(false);
  await retainedReceivers(true);
  await clearDuringDebounce();
  consumerAssembly();
  const transparent = source.replace('.hitTestBehavior(HitTestMode.Default)\n          .onTouch',
    '.hitTestBehavior(HitTestMode.Transparent)\n          .onTouch');
  assert.notEqual(transparent, source);
  await assert.rejects(() => retainedFailure(transparent), /HitTestMode/,
    'transparent retry would also allow the lower sibling to receive the same touch');
  const capturedRetry = source.replace(/onAction: \(expected: number\): void => this.retryCurrent\(expected\)/g,
    'onAction: this.legacyCapturedRetry()').replace('  private currentInputOwnerKey(): string {', `
  private legacyCapturedRetry(): () => void {
    const generation = this.generation, sourceId = this.sourceId, bookId = this.bookId;
    return (): void => {
      if (this.mounted && this.interactionEnabled && generation === this.generation &&
        sourceId === this.sourceId && bookId === this.bookId) this.retryOpen();
    };
  }
  private currentInputOwnerKey(): string {`);
  await assert.rejects(() => retainedReceivers(true, capturedRetry), /current generation/,
    'the previous captured ordinary receiver locks the retained PageState after a new read generation');
  const capturedClear = source.replace('onAction: (expected: number): void => this.clearCurrent(expected)',
    'onAction: this.legacyCapturedClear()').replace('  private currentInputOwnerKey(): string {', `
  private legacyCapturedClear(): () => void {
    const generation = this.generation, sourceId = this.sourceId, bookId = this.bookId;
    return (): void => {
      if (this.mounted && this.interactionEnabled && generation === this.generation &&
        sourceId === this.sourceId && bookId === this.bookId) this.onClearSearch();
    };
  }
  private currentInputOwnerKey(): string {`);
  await assert.rejects(() => clearDuringDebounce(capturedClear), /current clear targets current query/);
  console.log(JSON.stringify({ kind: 'retained-directory-surface', sharedCallers: 4, upstreamWrapper: 1,
    proof: 'SDK emitted Surface root and actual shared PageState/RecoveryAction retained updateStateVars',
    nativeLayoutAndTouch: 'NOT_RUN' }));
  recordContractCasePass(id);
}

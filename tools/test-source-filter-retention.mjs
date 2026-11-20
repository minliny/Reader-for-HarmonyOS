import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'filter-roundtrip': 'Actual Index route methods and SDK Source props retain four same-owner filters across Tools; actual Source projection uses latest data; fresh entry and stale ownership are checked. No native scroll or business ACK claim.',
  'scroll-roundtrip': 'Actual Source/Index scroll capture and bounded two-frame restoration, stable entity, geometry/filter identity and cancellation; native pixels and pointer behavior are not simulated.',
});
if (selected.length) {
  const { defaultSourceManagementFilters, copySourceManagementFilters, sourceManagementFilterKey, copySourceManagementScroll } = await import('../entry/src/main/ets/features/source/SourceManagementPresentation.ts');
  const {readerScrollStartOffset,readerScrollEndOffset}=await import('../entry/src/main/ets/features/common/ReaderScrollLayout.ts');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { installedEtsCompiler,emitSdkProbe } = await import('./lib/ets-compiler-runtime.mjs');
  const { createReaderComponentProbe:createReaderBuilderProbe } = await import('./lib/reader-component-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { runtimeOwnerIdentityProbe } = await import('./lib/reader-runtime-admission-probe.mjs');
  const indexFile = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
  const pageFile = new URL('../entry/src/main/ets/features/source/SourceManagementPage.ets', import.meta.url);
  const indexSource = readFileSync(indexFile, 'utf8'), pageSource = readFileSync(pageFile, 'utf8');
  let installed;
  const Runtime = runtimeOwnerIdentityProbe(() => installed);
  // Source child is a finite SDK initializer capture. The page's production
  // restore/publish/projection methods below run separately on the same props.
  class SourceChild {
    constructor(owner, params, _store, id) { Object.assign(this, { owner, params, id }); }
    updateStateVars(params) { Object.assign(this.params, params); }
  }
  function hostPort() {
    let attachedOwner, attachedIdentity = '';
    return {
      opens: 0, lease: true,
      bindPresentation(owner, identity) { attachedOwner = owner; attachedIdentity = identity; return true; },
      detachPresentation(identity) { if (identity === attachedIdentity) attachedIdentity = ''; },
      isPresentationCurrent(owner, identity) { return this.lease && owner === attachedOwner && identity === attachedIdentity; },
      open() { this.opens++; },
    };
  }
  function fixture() {
    const properties=createArkUIPropertyRuntimeProbe();
    installed = { setDownloadReadingProtection() {} };
    const runtime = installed, host = hostPort(), toolsEntries = [];
    const names = ['sourceManagementSurface', 'sourceManagementInitialFilters', 'sourceManagementInitialScroll', 'sourceManagementFilters',
      'sourceManagementFiltersOwner', 'openSourceManagement', 'openSourceTools', 'returnToSourceManagement',
      'nextNavigationGeneration', 'isCurrentSourceManagement', 'isCurrentRuntime', 'bindSourceManagement',
      'retireSourceManagementPresentation'];
    const index = createReaderBuilderProbe(indexSource, names, {
      ...properties.sdk, defaultSourceManagementFilters, copySourceManagementFilters, sourceManagementFilterKey, copySourceManagementScroll,
      ReaderRuntimeOwner: Runtime, SourceManagementPage: SourceChild,
    }, { ...properties.hooks, childSources: { SourceManagementPage: pageSource } }).owner;
    Object.assign(index, { mountedRuntimeOwner: runtime, sourceHost: host, sourceSources: [], sourceOperation: {},
      route: 'settings', navigationGeneration: 1, detailShelfAdmissionMount: 1, rssInstanceIdentity: 99,
      shelfReceiptRetired: false, sourcePresentationIdentity: '', settingsSnapshot: { reduceMotion: false },
      expandedLayout: () => false, transientFeedback: { reset() {} }, nativeAlertOwner: { retire() {} },
      bookshelfHost: { detachManagementPresentation() {} }, clearShelfNavigationMotion() {}, clearIndexRecoveryNotice() {},
      retireSettingsPresentation() {}, retireSourceSwitchPresentation() {}, retireRssEditorPresentation() {},
      retireRssPresentation() {}, retireReadingEntryPresentation() {}, retireBookshelfCatalogPresentation() {},
      getSourceToolsOrchestrator: () => ({ open: sources => toolsEntries.push(sources) }),
    });
    const props = () => {
      index.sourceManagementSurface(index.navigationGeneration, index.mountedRuntimeOwner,
        index.detailShelfAdmissionMount, index.sourceHost, index.sourcePresentationIdentity);
      const child = [...index.children.values()].findLast(value => value instanceof SourceChild);
      assert.ok(child, 'actual SDK initializer creates the current Source child');
      // Keep old callbacks independent of SDK in-place property updates.
      return { ...child.params, initialFilters: copySourceManagementFilters(child.params.initialFilters) };
    };
    return { index, runtime, host, props, toolsEntries };
  }
  const Page = selectedProductionMethods(pageFile, 'SourceManagementPage', [
    'restoreInitialFilters', 'publishFilters', 'rebuildSourceProjection', 'filteredSources',
    'normalizedSourceGroup', 'matchesStatus', 'clearFilters', 'currentFilterKey', 'lastProjectionFilterKey',
    'queueScrollRestore', 'cancelScrollRestore', 'scrollRestoreEpoch', 'scrollLayoutKey',
  ], { copySourceManagementFilters, sourceManagementFilterKey, readerScrollStartOffset, Edge:{Top:'Edge.Top'} });
  function pageFor(params, sources) {
    const page = new Page();
    let projected;
    Object.assign(page, { initialFilters: params.initialFilters, onFiltersChange: params.onFiltersChange,
      mounted: true, temporaryBackIdentity: 'current-source-page', sources,
      contentFrame: () => ({ width: 350 }), fontScale: () => 1, onScrollChange: params.onScrollChange,
      scrollLayout:()=>({startInset:58,endInset:91,mode:'contentOffset'}),
      sourceDataSource: { replace(value) { projected = value; } } });
    page.restoreInitialFilters();
    page.rebuildSourceProjection();
    return { page, ids: () => projected.map(source => source.sourceId) };
  }
  const source = (id, category = 'music', group = '旧分组') => ({
    sourceId: id, name: 'Alpha', baseUrl: `https://${id}.test`, category, group, enabled: true, checkState: 'unchecked',
  });
  function filterRoundtrip() {
  for (const categoryValue of ['all', 'novel', 'comic', 'music', 'download', 'external', 'other']) {
    assert.equal(copySourceManagementFilters({ ...defaultSourceManagementFilters(), categoryValue }).categoryValue, categoryValue);
  }
  for (const statusValue of ['全部', '启用', '异常', '未检测']) {
    assert.equal(copySourceManagementFilters({ ...defaultSourceManagementFilters(), statusValue }).statusValue, statusValue);
  }
  assert.equal(copySourceManagementFilters({ ...defaultSourceManagementFilters(), categoryValue: 'invalid' }).categoryValue, 'all');
  assert.equal(copySourceManagementFilters({ ...defaultSourceManagementFilters(), statusValue: '自定义' }).statusValue, '全部');
  const { index, runtime, host, props, toolsEntries } = fixture();
  index.sourceSources = [source('old')];
  index.openSourceManagement('search', '原搜索页关键词');
  const entry = props();
  assert.deepEqual(entry.initialFilters, defaultSourceManagementFilters());
  const first = pageFor(entry, entry.sources);
  const chosen = { searchQuery: '  Alpha  ', statusValue: '未检测', categoryValue: 'music', groupValue: '旧分组' };
  Object.assign(first.page, chosen); first.page.rebuildSourceProjection();
  assert.deepEqual(first.ids(), ['old']);
  assert.deepEqual(index.sourceManagementFilters, chosen, 'actual page publishes its four conditions to Index');
  const originalPayload = { ...chosen }; entry.onFiltersChange(originalPayload); originalPayload.groupValue = 'payload-mutated';
  assert.equal(index.sourceManagementFilters.groupValue, '旧分组', 'Index owns its own copy, not caller mutation');
  entry.onOpenTools();
  assert.equal(index.route, 'sourceTools');
  assert.equal(toolsEntries[0], entry.sources, 'Tools receives current source records, not a frozen filtered list');
  entry.onFiltersChange({ ...chosen, searchQuery: 'stale-while-tools' });
  assert.deepEqual(index.sourceManagementFilters, chosen, 'source callbacks are retired while Tools owns route');
  index.sourceSources = [source('new'), source('novel', 'novel'), source('other-group', 'music', '新分组')];
  index.returnToSourceManagement();
  const restored = props();
  assert.deepEqual(restored.initialFilters, chosen);
  assert.equal(index.sourceManagementSearchKeyword, '原搜索页关键词', 'origin search query remains a distinct owner');
  assert.equal(index.sourceManagementReturnTarget, 'search');
  const current = pageFor(restored, restored.sources);
  assert.deepEqual(current.ids(), ['new'], 'restored conditions evaluate latest source data rather than old rows');
  current.page.sources = [source('different-group', 'music', '新分组')];
  current.page.rebuildSourceProjection();
  assert.deepEqual(current.ids(), []);
  assert.equal(index.sourceManagementFilters.groupValue, '旧分组', 'missing group name remains selected; no silent all-group fallback');
  const retained = { ...index.sourceManagementFilters };
  for (const kind of ['generation', 'mount', 'runtime', 'host', 'lease', 'identity', 'retired']) {
    const saved = { navigationGeneration: index.navigationGeneration, detailShelfAdmissionMount: index.detailShelfAdmissionMount,
      mountedRuntimeOwner: index.mountedRuntimeOwner, sourceHost: index.sourceHost,
      sourcePresentationIdentity: index.sourcePresentationIdentity, shelfReceiptRetired: index.shelfReceiptRetired };
    if (kind === 'generation') index.navigationGeneration++;
    if (kind === 'mount') index.detailShelfAdmissionMount++;
    if (kind === 'runtime') { installed = {}; index.mountedRuntimeOwner = installed; }
    if (kind === 'host') index.sourceHost = hostPort();
    if (kind === 'lease') host.lease = false;
    if (kind === 'identity') index.sourcePresentationIdentity = 'successor';
    if (kind === 'retired') index.shelfReceiptRetired = true;
    restored.onFiltersChange({ ...chosen, searchQuery: `stale-${kind}` });
    assert.deepEqual(index.sourceManagementFilters, retained, `actual Index guard rejects stale ${kind}`);
    Object.assign(index, saved); installed = runtime; host.lease = true;
  }
  first.page.mounted = false;
  first.page.searchQuery = 'unmounted'; first.page.rebuildSourceProjection();
  assert.deepEqual(index.sourceManagementFilters, retained, 'unmounted page cannot publish');
  current.page.clearFilters();
  assert.deepEqual(index.sourceManagementFilters, defaultSourceManagementFilters(), 'clear four filters updates the owning snapshot');
  restored.onFiltersChange(chosen);
  index.openSourceManagement('settings');
  const fresh = props();
  assert.deepEqual(fresh.initialFilters, defaultSourceManagementFilters(), 'a fresh Source entry resets view conditions');
  assert.equal(index.sourceManagementSearchKeyword, '');
  restored.onFiltersChange({ ...chosen, searchQuery: 'late-prior-entry' });
  assert.deepEqual(index.sourceManagementFilters, defaultSourceManagementFilters(), 'old source generation cannot modify fresh entry');
  fresh.onFiltersChange(chosen);
  installed = {}; index.mountedRuntimeOwner = installed;
  assert.deepEqual(index.sourceManagementInitialFilters(), defaultSourceManagementFilters(), 'views never cross Runtime owners');
  console.log('Verified 4 filters; 7 categories; 4 statuses; current/fresh/latest-data/missing-group/clone; 7 stale-ownership paths. Scroll, Tools drafts, native rendering and business ACK are NOT_RUN.');
  recordContractCasePass('filter-roundtrip');
  }

  function scrollRoundtrip() {
    const { ts, options } = installedEtsCompiler();
    const tree = ts.createSourceFile('SourceManagementPage.ets', pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const declaration = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'SourceManagementLayoutFrame');
    assert(declaration);
    const output=emitSdkProbe(declaration.getText(tree),{fileName:'module.ts',parseSource:pageSource,scriptKind:'ETS',compilerOptions:{target:ts.ScriptTarget.ES2021}});
    const SourceManagementLayoutFrame = new Function('FrameCallback', output + ';return SourceManagementLayoutFrame;')(class {});
    const ScrollPage = selectedProductionMethods(pageFile, 'SourceManagementPage', [
      'currentFilterKey', 'scrollLayoutKey', 'captureScroll', 'openTools', 'queueScrollRestore', 'cancelScrollRestore',
      'scrollRestoreEpoch', 'restoringScroll',
      'rebuildSourceProjection','publishFilters','clearFilters',
    ], { sourceManagementFilterKey,copySourceManagementFilters, SourceManagementLayoutFrame, ScrollAlign: { START: 'start' }, readerScrollStartOffset,Edge:{Top:'Edge.Top'} });
    const { index, props } = fixture();
    index.openSourceManagement();
    const firstProps = props(), filters = defaultSourceManagementFilters();
    const key = sourceManagementFilterKey(filters);
    const frames = [], commands = [];
    let width = 350,fontScale=1,nativeOffset=205,nativeItemY=40;
    const page = new ScrollPage();
    Object.assign(page, filters, { mounted: true, sourceListMounted: true, temporaryBackIdentity: 'old',
      firstVisibleListIndex: 3, readerWindowMetricsRevision: 1, pendingScroll: undefined,
      projectedSources: [source('a'), source('b'), source('c')], sources: [source('a'), source('b'), source('c')],
      statusKind: 'idle', onScrollChange: firstProps.onScrollChange, onOpenTools: firstProps.onOpenTools,
      contentFrame: () => ({ width }), fontScale: () => fontScale, scrollLayout: () => ({startInset:58,endInset:91,mode:'contentOffset'}),
      getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
      sourceScroller: { currentOffset: () => ({yOffset:nativeOffset}), getItemRect: () => ({y:nativeItemY,height:76}),
        scrollTo: opts => commands.push(['offset',opts.yOffset,opts.animation]), scrollEdge:edge=>commands.push(['edge',edge]), scrollToIndex: idx => commands.push(['index',idx]),
        scrollBy: (_x,y) => commands.push(['delta',y]) } });
    page.firstVisibleListIndex=0;
    for(const offset of[-58,-30,0,205]){nativeOffset=offset;page.captureScroll();assert.equal(index.sourceManagementScroll.offset,offset,'capture/DTO/Index retain signed native header offset');assert.equal(index.sourceManagementScroll.anchorId,'');}
    const captured=index.sourceManagementScroll;
    for(const offset of[NaN,Infinity,-Infinity]){nativeOffset=offset;page.captureScroll();assert.equal(index.sourceManagementScroll,captured,'invalid offset cannot replace an atomic capture');}
    nativeOffset=205;page.firstVisibleListIndex=3;nativeItemY=NaN;page.captureScroll();assert.equal(index.sourceManagementScroll,captured);nativeItemY=40;
    page.openTools();
    assert.equal(index.route, 'sourceTools');
    assert.equal(index.sourceManagementScroll.anchorId, 'c');
    index.returnToSourceManagement();
    const currentProps = props();
    const snapshot = currentProps.initialScroll;
    assert.equal(snapshot.filterKey, key);
    Object.assign(page, { temporaryBackIdentity: 'current', onScrollChange: currentProps.onScrollChange,
      pendingScroll: copySourceManagementScroll(snapshot), projectedSources: [source('c'),source('b')] });
    page.queueScrollRestore(); frames.shift().onIdle(0); frames.shift().onIdle(0);
    assert.deepEqual(commands, [['index',1],['delta',0]], 'current identity, not old ordinal, restores the anchor');
    commands.length = 0;
    page.pendingScroll = copySourceManagementScroll(snapshot); width = 500;
    page.queueScrollRestore(); frames.shift().onIdle(0); frames.shift().onIdle(0);
    assert.deepEqual(commands, [['index',1],['delta',-18]], 'new geometry uses current header inset rather than stale item pixels');
    commands.length = 0;
    page.pendingScroll = copySourceManagementScroll(snapshot); page.projectedSources = [source('a'),source('b'),source('c')];
    page.queueScrollRestore(); frames.shift().onIdle(0);
    page.projectedSources = [source('c'),source('b'),source('a')]; frames.shift().onIdle(0);
    assert.deepEqual(commands,[['index',3],['index',1]],'reorder between native frames must not correct the wrong entity pixels');
    commands.length = 0; page.pendingScroll = copySourceManagementScroll(snapshot);
    page.queueScrollRestore(); frames.shift().onIdle(0); page.projectedSources = []; frames.shift().onIdle(0);
    assert.deepEqual(commands,[['index',1],['edge','Edge.Top']],'empty replacement between frames returns to native Top including clearance');
    page.projectedSources = [source('c'),source('b')];
    for (const retired of ['touch','presentation','unmount','filter']) {
      commands.length = 0; page.mounted = true; page.searchQuery = ''; page.temporaryBackIdentity = 'current';
      page.pendingScroll = copySourceManagementScroll(snapshot); page.queueScrollRestore();
      if (retired === 'touch') page.cancelScrollRestore();
      if (retired === 'presentation') page.temporaryBackIdentity = 'successor';
      if (retired === 'unmount') page.mounted = false;
      if (retired === 'filter') page.searchQuery = 'changed';
      frames.shift().onIdle(0);
      assert.deepEqual(commands, [], `${retired} invalidates the captured restoration`);
      page.cancelScrollRestore();
    }
    page.mounted = true; page.searchQuery = ''; page.temporaryBackIdentity = 'current';
    page.projectedSources = [source('a'),source('b')]; page.pendingScroll = copySourceManagementScroll(snapshot);
    page.queueScrollRestore(); frames.shift().onIdle(0); frames.shift().onIdle(0);
    assert.equal(commands[0][1], 2, 'deleted anchor falls back to the nearest current ordinal');
    commands.length=0;
    for(const offset of[-58,-30,0,205]){
      page.pendingScroll={...snapshot,anchorId:'',firstIndex:0,itemY:0,offset,layoutKey:page.scrollLayoutKey()};
      page.queueScrollRestore();frames.shift().onIdle(0);
      assert.deepEqual(commands.splice(0),[['offset',offset,false]],'matching-layout captured header restores exact signed raw coordinate without animation');
    }
    for(const changed of['width','font','empty']){
      page.pendingScroll={...snapshot,anchorId:'',offset:-30,layoutKey:page.scrollLayoutKey()};
      if(changed==='width')width+=1;if(changed==='font')fontScale=1.45;if(changed==='empty')page.projectedSources=[];
      page.queueScrollRestore();frames.shift().onIdle(0);assert.deepEqual(commands.splice(0),[['edge','Edge.Top']],changed+' header fallback uses true native top');
      page.projectedSources=[source('a'),source('b')];
    }
    Object.assign(page,{onFiltersChange:currentProps.onFiltersChange,sourceDataSource:{replace(){}},filteredSources:()=>page.sources});
    page.lastProjectionFilterKey=page.currentFilterKey();page.statusValue='启用';page.rebuildSourceProjection();
    assert.deepEqual(commands.splice(0),[['edge','Edge.Top']]);assert.equal(index.sourceManagementScroll.offset,-58);assert.equal(index.sourceManagementScroll.firstIndex,0);
    page.clearFilters();assert.deepEqual(commands.splice(0),[['edge','Edge.Top']]);assert.equal(index.sourceManagementScroll.offset,-58,'clear/reset publishes known native top rather than offset0');
    const listProperties=createArkUIPropertyRuntimeProbe();let queueCalls=0;const headerCalls=[];
    class UnexpectedMessagePort{constructor(){assert.fail('nonempty event-only List fixture must not mount a message');}}
    const childSources=Object.fromEntries(['ReaderPageState','ReaderRecoveryAction'].map(name=>[name,readFileSync(new URL('../entry/src/main/ets/features/common/'+name+'.ets',import.meta.url),'utf8')]));
    const listOwner=createReaderBuilderProbe(pageSource,['sourceList'],{...listProperties.sdk,
      ReaderPageState:UnexpectedMessagePort,ReaderRecoveryAction:UnexpectedMessagePort,
      readerScrollStartOffset,readerScrollEndOffset,Edge:{Top:'Edge.Top'},TouchType:{Down:'down'},ViewStackProcessor:{StartGetAccessRecordingFor(){},StopGetAccessRecording(){}}},
      {...listProperties.hooks,childSources}).owner;
    Object.assign(listOwner,{sourceScroller:page.sourceScroller,sources:[source('a')],projectedSources:[source('a')],sourceDataSource:{totalCount:()=>0},operation:{},statusKind:'idle',contentFrame:()=>({left:19,right:19}),scrollLayout:page.scrollLayout,pendingScroll:undefined,
      queueScrollRestore(){queueCalls++;},captureScroll(){},cancelScrollRestore:()=>page.cancelScrollRestore(),
      ...Object.fromEntries(['searchField','statsRow','statusAction','filterArea','categoryFilter'].map(name=>[name,()=>headerCalls.push(name)])),
      recovery:()=>({canRetry:false}),sourceRow(){assert.fail('no rows requested in event-only List fixture');},sourceRenderKey:item=>item.sourceId});
    listOwner.sourceList();const list=[...listOwner.nodes.values()].find(n=>n.type==='List');assert.equal(list.contentStartOffset,58);
    // The recorder does not instantiate virtual ListItem bodies. Header
    // content is an explicit port and is outside this List-event proof.
    console.log(JSON.stringify({listEventHeaderPortCalls:headerCalls.slice(),headerContent:'NOT_EXECUTED'}));
    list.onAppear();assert.deepEqual(commands.splice(0),[['edge','Edge.Top']],'fresh actual SDK List event keeps start clearance');assert.equal(queueCalls,0);
    list.onAreaChange();assert.equal(queueCalls,1);assert.deepEqual(commands,[],'Area with no pending snapshot never repeats fresh reset');
    listOwner.pendingScroll=snapshot;list.onAppear();assert.equal(queueCalls,2);assert.deepEqual(commands,[],'saved snapshot is handed to existing restore queue');
    page.pendingScroll=copySourceManagementScroll(snapshot);page.queueScrollRestore();list.onTouch({type:'down'});frames.shift().onIdle(0);assert.deepEqual(commands,[],'actual SDK touch cancels the queued restore');
    const kept = index.sourceManagementScroll;
    firstProps.onScrollChange({ ...snapshot, offset:999 });
    assert.equal(index.sourceManagementScroll, kept, 'retired Index callback cannot publish scroll');
    currentProps.onScrollChange({ ...snapshot, filterKey:'wrong' });
    assert.equal(index.sourceManagementScroll, kept, 'mismatched filters cannot publish scroll');
    index.openSourceManagement(); assert.equal(props().initialScroll, undefined, 'fresh entry starts at top');
    for(const offset of[NaN,Infinity,-Infinity])assert.equal(copySourceManagementScroll({...snapshot,offset}),undefined);
    for(const offset of[-58,-30,0,205])assert.equal(copySourceManagementScroll({...snapshot,offset}).offset,offset);
    recordContractCasePass('scroll-roundtrip');
  }
  if (selected.includes('filter-roundtrip')) filterRoundtrip();
  if (selected.includes('scroll-roundtrip')) scrollRoundtrip();
}

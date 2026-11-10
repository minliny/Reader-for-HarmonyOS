import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"rows": {"description": "实际DataSource保留ObjectLink元数据、候选与结构增删移动", "resources": []}, "stream-batch": {"description": "4000→8000→2500实际行无locale/indexOf扫描及legacy alias", "resources": []}, "navigation": {"description": "实际SearchViewState首次顺序/草稿/anchor/reset", "resources": []}, "relevance": {"description": "实际SearchPage relevance/同组代表/本地在线scope/cache", "resources": []}, "progressive-anchor": {"description": "进度插入保留相同row与实测anchor/重挂恢复key", "resources": []}, "incremental-row": {"description": "4000行一变一新增只结构ADD，重复发布无通知", "resources": []}, "bounded-normalization": {"description": "实际grouping只新payload做locale，shelf title identity分离", "resources": []}, "locale-remount": {"description": "原平台Unicode/tr/az/lt ranks与8000variant/400title查询归属缓存", "resources": []}, "candidate-version": {"description": "当前sourceVersion目录证明胜过失败/旧版/stale", "resources": []}, "query-delta": {"description": "实际1000query delta只触1行且无结构通知/排序/locale", "resources": []}, "native-batch": {"description": "实际SDK batch旧index语义与单group MOVE不重复CHANGE", "resources": []}, "broad-reorder": {"description": "4000任意重排委托一次native keyed reload而非重复扫描", "resources": []}, "layout-restoration": {"description": "受控frame+key/neighbor/signed offset/query/page/user失效", "resources": []}, "candidate-facts": {"description": "实际schema2 whole-book rank与章节/刷新失败事实边界", "resources": []}, "safe-failure-text": {"description": "实际分类消息保留安全文本而不泄露原query错误", "resources": []}, "media-identity": {"description": "实际同名小说/漫画分组和shelf/virtual identity分离", "resources": []}, "content-filter": {"description": "实际SDK type chip→当前projection本地在线组合/late/resume/reset，不重搜", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const {selectedProductionMethods,selectedProductionClasses,selectedProductionValues} = await import('./lib/selected-production-methods.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { registerHooks, stripTypeScriptTypes } = await import('node:module');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');


registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; } } });
const { searchCandidateRank } = await import('../entry/src/main/ets/features/search/presentation/SearchCandidatePolicy.ts');
const { searchResultRelevance, SearchResultRelevance } = await import('../entry/src/main/ets/features/search/presentation/SearchResultRelevance.ts');
const authorMetadata = await import('../entry/src/main/ets/app/library/BookAuthorMetadata.ts');
const mediaIdentity = await import('../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(repo, path), 'utf8');
const page=read('entry/src/main/ets/features/search/ui/SearchPage.ets');const {SearchViewState}=await import('../entry/src/main/ets/features/search/presentation/SearchViewState.ts');
const {SearchBookGroup,SearchResultDataSource}=selectedProductionClasses(new URL('../entry/src/main/ets/features/search/ui/SearchPage.ets',import.meta.url),['SearchBookGroup','SearchResultDataSource'],{...authorMetadata,...mediaIdentity,DataOperationType:{ADD:'add',DELETE:'delete',CHANGE:'change',RELOAD:'reload',MOVE:'move'}});
// Keep the production module graph intact, including bookshelf identity and
// candidate policy. Stripping every import hides new real dependencies.
const { SearchResultProjection } = await import('../entry/src/main/ets/features/search/presentation/SearchResultProjection.ts');
function listen(ds, listener) {
  ds.registerDataChangeListener({ ...listener, onDatasetChange(operations) {
    for (const op of operations) {
      if (op.type === 'reload') listener.onDataReloaded?.();
      else if (op.type === 'change') listener.onDataChange?.(op.index);
      else for (let i = 0; i < (op.count ?? 1); i++) {
        if (op.type === 'add') listener.onDataAdd?.(op.index + i);
        else listener.onDataDelete?.(op.index);
      }
    }
  } });
}
const group = (key, title = key) => new SearchBookGroup({ sourceId: 'source-a', bookId: key,
  title, author: '作者', groupKey: key }, 1, false);

const originalLower=String.prototype.toLocaleLowerCase,originalIndexOf=Array.prototype.indexOf;

if(!['rows', 'stream-batch', 'navigation', 'incremental-row', 'native-batch', 'broad-reorder', 'media-identity'].includes(selectedCase)){
const {actualReaderPageShell}=await import('./lib/reader-page-shell-runtime-probe.mjs');
const { SearchPublication } = await import('../entry/src/main/ets/features/search/presentation/SearchPublication.ts');
const modelFile = new URL('../entry/src/main/ets/features/search/presentation/ReaderLibrarySearchModel.ets', import.meta.url);
const { ReaderLibrarySearchModel } = selectedProductionClasses(modelFile, ['ReaderLibrarySearchModel']);
const { READER_LIBRARY_SEARCH_BACK_FOCUS_ID } = selectedProductionValues(modelFile, ['READER_LIBRARY_SEARCH_BACK_FOCUS_ID']);
let restoredAppChrome = 0;
const Page=selectedProductionMethods(new URL('../entry/src/main/ets/features/search/ui/SearchPage.ets',import.meta.url),'SearchPage',
  ['aboutToAppear', 'aboutToDisappear', 'acceptPublication', 'bindSurface', 'publishSurface', 'ownsSurface', 'hasSearchSession', 'canSubmit',
    'ownsPageQuery', 'ownsList', 'searchFontScale', 'submitSearch', 'selectContentType', 'selectGroup', 'filteredEmptyMessage', 'groupResults', 'resultGroupKey', 'normalizedBookKey', 'saveScrollAnchor', 'refreshVisibleResults', 'publishVisibleGroups', 'scheduleScrollRestore', 'finishScrollRestore', 'restoreMeasuredAnchor', 'resultNativeIndex', 'rememberAnchorNeighbors', 'cancelScrollRestoreForUser', 'onResultScrollIndex',
    'retirePanelScope', 'publishSurfacePanelInput', 'cancelSearchFocusRestore', 'pendingResultFocus', 'resetFilteredResults', 'releaseNativePanelChrome',
    'filterPresentationIdentity', 'taskStatusIdentity', 'acceptsFilter', 'acceptsTaskStatus', 'dismissSearchFilters', 'dismissTaskStatus', 'searchPanelOwnsInput',
    'onListTouch', 'scheduleDeferredResults', 'restoreResultFocus', 'resultFocusId', 'resultViewportId',
    'acceptResultNoticeFacts', 'captureSearchNoticeFacts', 'searchProgressText', 'searchStopped', 'isSweeping', 'operation',
    'partialSearchFailure', 'onCardDisplayFactsChange'],
  {...actualReaderPageShell(),...authorMetadata,...mediaIdentity,
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }), requestAppChrome: () => { restoredAppChrome++; } },
    nextSearchSurfaceOwner: 0, READER_LIBRARY_SEARCH_BACK_FOCUS_ID,
    SEARCH_LOCAL_SCOPE: '本地', SearchBookGroup, searchResultRelevance, searchCandidateRank, SearchResultProjection,
    SearchLayoutFrame: class { constructor(action) { this.action = action; } onIdle() { this.action(); } },
    ScrollAlign: { START: 0 }, Edge: { Top: 'top' }, TouchType: { Down: 'down', Up: 'up', Cancel: 'cancel' }, registerReaderFonts() {} });
const p = Object.assign(new Page(), { presentation: { kind: 'results', keyword: '诡秘之主' },
  viewState: new SearchViewState(), shelfBooks: [], selectedGroupName: '全部' });
const book = (id, title, author = '作者', extra = {}) => ({ sourceId: id, bookId: `/${id}`, title, author, ...extra });
const early = [book('fan1', '诡秘之主同人'), book('fan2', '我在诡秘之主'), book('other', '随笔')];
const exact=book('original','诡秘之主','爱潜水的乌贼');const late=[...early,exact,book('other-copy','诡秘之主','爱潜水的乌贼')];const aliases=[book('alias','诡秘之主小说','爱潜水的乌贼',{groupKey:'canonical-original'}),book('alias-exact','诡秘之主','爱潜水的乌贼',{groupKey:'canonical-original'})];
if(selectedCase==='relevance'){
assert.deepEqual(p.groupResults(early).map(g => g.book.sourceId), ['fan1', 'fan2', 'other']);
const ranked = p.groupResults(late);
assert.equal(ranked[0].book, exact, 'late exact title moves before first-arriving fan fiction');
assert.equal(ranked[0].sourceCount, 2); assert.equal(ranked[0].variants.length, 2);
assert.deepEqual(ranked.slice(1).map(g => g.book.sourceId), ['fan1', 'fan2', 'other']);
assert.equal(p.groupResults(late), ranked, 'unchanged projection remains cached');
p.presentation = { kind: 'results', keyword: '随笔' };
assert.equal(p.groupResults(late)[0].book.sourceId, 'other', 'query participates in projection cache identity');
p.presentation = { kind: 'results', keyword: '诡秘之主' };
const local = book('local', '诡秘之主', '爱潜水的乌贼');
p.selectedGroupName = '本地'; assert.deepEqual(p.groupResults([...late, local]).map(g => g.book.sourceId), ['local']);
p.selectedGroupName = '在线'; assert.ok(p.groupResults([...late, local]).every(g => g.book.sourceId !== 'local'));
p.selectedGroupName = '全部';
assert.equal(p.groupResults(aliases)[0].book.sourceId, 'alias-exact', 'best matching variant represents a merged canonical group');
assert.equal(p.groupResults(aliases)[0].variants.length, 2);



}
if(selectedCase==='progressive-anchor'){
// A scrolled result keeps the displayed order while new results and source
// counts arrive. The relevance case separately verifies ranking at the top.
const frames = [], scrollMoves = [];
const t = Object.assign(new Page(), { presentation: { kind: 'results', keyword: '诡秘之主' },
  viewState: new SearchViewState(), shelfBooks: [], selectedGroupName: '全部',
  pageMounted: true, pageEpoch: 0, queryAtMount: 0, isPresentationCurrent: () => true,
  listMounted: true, listEpoch: 0, restoreEpoch: 0, resultFlushEpoch: 0, scrollRestored: true,
  searchContentStartInset: () => 54, getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
  visibleStart: 0, visibleEnd: 0, warmupGroups: [], onVisibleGroups(groups) { this.publishedGroups = groups; },
  resultDataSource: new SearchResultDataSource() });
const tieA = book('tie-a', '诡秘之主·甲');
const tieB = book('tie-b', '诡秘之主·乙');
const ordered = t.groupResults([tieA, tieB]);
t.visibleGroups = ordered;
t.resultDataSource.replace(ordered);
const retainedB = t.resultDataSource.getData(1);
t.viewState.anchorIndex = 1; t.viewState.anchorKey = t.resultGroupKey(tieB);
t.resultScroller = { currentOffset: () => ({ yOffset: 137 }),
  getItemRect: index => index === 0 ? { y: -137, height: 35 } : { y: -23, height: 100 },
  scrollBy: (_x, delta) => scrollMoves.push(delta) };
t.saveScrollAnchor();
assert.equal(t.viewState.anchorOffset, 137); assert.equal(t.viewState.anchorItemY, -23);
const anchorBefore = [t.viewState.anchorKey, t.viewState.anchorOffset, t.viewState.anchorItemY];
const tieBCopy = { ...tieB, sourceId: 'tie-b-copy', bookId: '/tie-b-copy' };
t.presentation = { kind: 'results', keyword: '诡秘之主', results: [tieB, tieA, tieBCopy, exact] };
t.viewStateRevision = t.viewState.revision;
t.scrollRestored = true;
t.refreshVisibleResults();
assert.deepEqual(t.publishedGroups, [t.visibleGroups[0].variants], 'actual refresh publishes the current visible candidate group');
assert.deepEqual(t.visibleGroups.map(g => g.book.sourceId), ['tie-a', 'tie-b', 'original']);
assert.equal(t.resultDataSource.getData(1), retainedB, 'streaming insertion retains the observed anchored row');
assert.equal(retainedB.sourceCount, 2, 'source enrichment keeps the same first-seen tie');
assert.deepEqual([t.viewState.anchorKey, t.viewState.anchorOffset, t.viewState.anchorItemY], anchorBefore);
assert.equal(frames.length, 1, 'the retained list remeasures after streamed metadata');
frames.shift().onIdle();
assert.deepEqual(scrollMoves, [], 'an already realized anchor needs no corrective scroll');
assert.equal(t.scrollRestored, true);

const publication = new SearchPublication();
publication.publish(t.presentation);
t.aboutToDisappear();
const remounted = Object.assign(new Page(), { viewState: t.viewState, publication, publicationRevision: 1,
  viewStateRevision: -1, listMounted: false, isPresentationCurrent: () => true,
  getUIContext: () => ({ getFont() {} }), visibleStart: 0, visibleEnd: 0, warmupGroups: [], onVisibleGroups() {},
  resultDataSource: new SearchResultDataSource() });
remounted.aboutToAppear();
assert.deepEqual([remounted.restoreKey, remounted.restoreOffset, remounted.restoreItemY], anchorBefore);
assert.equal(remounted.retainedViewportPending, true);
assert.equal(remounted.scrollRestored, false);



}
if(selectedCase==='bounded-normalization'){
// PH65: locale/relevance work is limited to new identity payloads, not all retained cards.
{
  const owner = Object.assign(new Page(), { presentation: { kind: 'results', keyword: '书' },
    viewState: new SearchViewState(), shelfBooks: [], selectedGroupName: '全部' });
  const old = Array.from({ length: 4000 }, (_, i) => book(`source-${i}`, `书${i}`));
  owner.groupResults(old);
  let lowerCalls = 0;
  String.prototype.toLocaleLowerCase = function (...args) { lowerCalls++; return originalLower.apply(this, args); };
  try {
    const newer = [...old, book('new', '书新')];
    owner.groupResults(newer);
    assert.ok(lowerCalls <= 5, `one new result normalizes only its own fields: ${lowerCalls}`);
    lowerCalls = 0; owner.groupResults(newer); assert.equal(lowerCalls, 0, 'count-only publication reuses all projection facts');
  } finally { String.prototype.toLocaleLowerCase = originalLower; }
}
// A canonical navigation key is not the shelf title/author matching key.
p.shelfBooks = [book('shelf-other-source', '诡秘之主', '爱潜水的乌贼')];
p.presentation = { kind: 'results', keyword: '诡秘之主' }; p.selectedGroupName = '全部';
assert.equal(p.groupResults(aliases)[0].inBookshelf, true);



}
if(selectedCase==='locale-remount'){
// The actual final50 appfreeze was a Detail→Search cold remount repeatedly
// normalizing the same query in ICU. Count production calls instead of using
// a host-speed deadline, and preserve the original locale/Unicode policy.
{
  const oracle = (title, author, keyword, proof, sourceVersion, locale) => {
    const lower = value => originalLower.call(value, locale);
    const query = lower(keyword.trim());
    if (!query) return 0;
    const name = lower(title.trim());
    const by = authorMetadata.bookAuthorIdentity(author, proof, sourceVersion);
    return name === query ? 0 : by === query ? 1 : name.startsWith(query) ? 2 :
      name.includes(query) ? 3 : by.includes(query) ? 4 : 5;
  };
  const proof = {schemaVersion:1,sourceVersion:'v1',field:'search',raw:'@İPEK',label:'İPEK',rule:'author-nickname-at-v1'};
  const cases = [
    [' 三体 ', '刘慈欣', '三体'], ['ABC', '作者：某人', 'abc'],
    ['I', '其他', 'ı'], ['İSTANBUL', '其他', 'istanbul'], ['I\u0307', '其他', 'i'],
    ['ΟΣ', '其他', 'ος'], ['ΣΟΣ', '其他', 'σος'], ['𐐀𐐁', '其他', '𐐨'],
    ['Straße', '其他', 'STRASSE'], ['前缀三体后缀', '其他', '三体'],
    ['不同', '作者：关关公子', '关关公子'], ['不同', '@İPEK', 'i', proof, 'v1'],
    ['不同', '@İPEK', 'i', proof, 'wrong-version'], ['不同', '作者', '\u2003 '],
  ];
  for (const locale of [undefined, 'tr', 'az', 'lt']) {
    String.prototype.toLocaleLowerCase = function (...args) {
      return originalLower.call(this, args[0] ?? locale);
    };
    try {
      for (const [title, author, query, authorProof, version] of cases) {
        const expected = oracle(title, author, query, authorProof, version, locale);
        const scorer = new SearchResultRelevance(query);
        assert.equal(scorer.score(title, author, authorProof, version), expected);
        assert.equal(scorer.score(title, author, authorProof, version), expected, 'exact-title reuse preserves locale mapping');
        assert.equal(searchResultRelevance(title, author, query, authorProof, version), expected, 'existing public function keeps all ranks');
      }
    } finally { String.prototype.toLocaleLowerCase = originalLower; }
  }

  const state = new SearchViewState(), shelf = [];
  const results = Array.from({length:8000}, (_, i) => book(`cold-${i}`, `书${i % 400}`, '作者',
    {groupKey:`cold-work-${i % 400}`,admittedOrder:i}));
  let localeCalls = 0;
  String.prototype.toLocaleLowerCase = function (...args) {
    localeCalls++; return originalLower.apply(this, args);
  };
  try {
    const projection = new SearchResultProjection();
    const first = projection.update(results, shelf, '书', state);
    assert.equal(localeCalls, 401, '8000 variants use one query and 400 exact-title locale normalizations');
    const before = first.orderedKeys.map(key => first.rows.get(key));
    const rowData = new SearchResultDataSource();
    const groups = update => update.orderedKeys.map(key => {
      const row = update.rows.get(key), group = new SearchBookGroup(row.variants[0], 1, row.inBookshelf);
      for (const variant of row.variants.slice(1)) group.admit(variant, row.inBookshelf);
      group.book = row.book; return group;
    });
    rowData.replace(groups(first));
    const observed = rowData.getData(123);
    state.anchorKey = before[123].key; state.anchorIndex = 123; state.anchorOffset = 15; state.anchorItemY = -27;
    state.anchorNeighbors = [before[122].key, before[124].key];
    const anchor = [state.anchorKey,state.anchorIndex,state.anchorOffset,state.anchorItemY,...state.anchorNeighbors];
    localeCalls = 0;
    const remount = new SearchResultProjection().update(results, shelf, '书', state);
    assert.equal(localeCalls, 0, 'a new Page/projection over this retained query does zero ICU locale initialization');
    assert.deepEqual(remount.orderedKeys, first.orderedKeys);
    for (const [i,key] of remount.orderedKeys.entries()) {
      const row = remount.rows.get(key);
      assert.equal(row.book, before[i].book);
      assert.equal(row.score, before[i].score); assert.equal(row.order, before[i].order);
      assert.deepEqual(row.variants, before[i].variants, 'raw source variant identity and order stay intact');
    }
    rowData.replace(groups(remount));
    assert.equal(rowData.getData(123), observed, 'actual data source keeps its retained observed row');
    assert.deepEqual([state.anchorKey,state.anchorIndex,state.anchorOffset,state.anchorItemY,...state.anchorNeighbors],anchor);
    const uniqueState = new SearchViewState();
    const unique = Array.from({length:800}, (_,i) => book(`unique-${i}`, `独特标题${i}`, '作者', {admittedOrder:i}));
    localeCalls = 0;
    const uniqueBefore = new SearchResultProjection().update(unique, shelf, '独特', uniqueState);
    assert.equal(localeCalls, 801, 'first admission of 800 distinct titles performs the required Unicode work once each');
    localeCalls = 0;
    const uniqueReturn = new SearchResultProjection().update(unique, shelf, '独特', uniqueState);
    assert.equal(localeCalls, 0, 'cold return does zero locale work even without any repeated title');
    assert.deepEqual(uniqueReturn.orderedKeys, uniqueBefore.orderedKeys);
    localeCalls = 0;
    const different = new SearchResultProjection().update(results, shelf, '书1', state);
    assert.equal(localeCalls, 401, 'different query cannot reuse the old scorer');
    assert.equal(different.rows.get(different.orderedKeys[0]).book.title, '书1');
    state.reset('书1'); localeCalls = 0;
    new SearchResultProjection().update(results, shelf, '书1', state);
    assert.equal(localeCalls, 401, 'even same-keyword resubmit/reset discards all previous title normalization');
    const separate = new SearchViewState(); localeCalls = 0;
    new SearchResultProjection().update(results, shelf, '书1', separate);
    assert.equal(localeCalls, 401, 'independent query owner cannot share normalization');
  } finally { String.prototype.toLocaleLowerCase = originalLower; }
}



}
if(selectedCase==='candidate-version'){
// Same relevance/group: only current rule-version admission facts can promote a candidate.
{
  const now = Date.now();
  const candidate = (id, acquisition) => book(id, '鸣龙', '关关公子', {
    sourceRuleVersion: 'current', groupKey: 'minglong', acquisition,
  });
  const failed = candidate('failed', { sourceVersion: 'current', failure: { at: now } });
  const catalog = candidate('catalog', { sourceVersion: 'current', catalogAt: now - 1000, catalogCount: 20 });
  const unknown = candidate('unknown', undefined);
  const stale = candidate('stale', { sourceVersion: 'current', catalogAt: now - 1000, catalogCount: 20, stale: true });
  const oldVersion = candidate('old-version', { sourceVersion: 'previous', catalogAt: now - 1000, catalogCount: 20 });
  const owner = Object.assign(new Page(), { presentation: { kind: 'results', keyword: '鸣龙' },
    viewState: new SearchViewState(), shelfBooks: [], selectedGroupName: '全部' });
  assert.equal(owner.groupResults([failed, catalog])[0].book, catalog,
    'a current verified catalog represents the group instead of a recently failed source');
  assert.equal(owner.groupResults([unknown, stale])[0].book, unknown, 'stale facts do not outrank unverified candidates');
  assert.equal(owner.groupResults([unknown, oldVersion])[0].book, unknown, 'other source versions do not outrank unverified candidates');
  assert.equal(owner.groupResults([stale, oldVersion, catalog])[0].book, catalog);
}



}
if(selectedCase==='query-delta'){
// End-to-end query delta reaches one row. Pure counters reuse all projection objects.
{
  const owner=Object.assign(new Page(),{presentation:{kind:'results',keyword:'书'},viewState:new SearchViewState(),
    shelfBooks:[],selectedGroupName:'全部'});
  const results=Array.from({length:1000},(_,i)=>book(`s${i}`,`书${i}`,'作者',{groupKey:`g${i}`,admittedOrder:i}));
  owner.presentation.delta={baseRevision:0,revision:1,reset:true,upserted:results,removedKeys:[]};
  const groups=owner.groupResults(results);const before=new Map(owner.projectedGroups);
  const data=new SearchResultDataSource();data.replace(groups,owner.changedGroupKeys);
  const notices=[];data.registerDataChangeListener({onDatasetChange:ops=>notices.push(ops)});
  let touched=0;const update=data.update.bind(data);data.update=(...args)=>{touched++;return update(...args);};
  const changed={...results[500],intro:'更新'};const next=results.slice();next[500]=changed;
  owner.presentation.delta={baseRevision:1,revision:2,reset:false,upserted:[changed],removedKeys:[]};
  const oldOrder=owner.resultProjection.ordered;
  let lower=0;String.prototype.toLocaleLowerCase=function(...args){lower++;return originalLower.apply(this,args);};
  try {
    const updated=owner.groupResults(next);assert.equal(updated,groups);
    assert.equal(owner.resultProjection.ordered,oldOrder,'metadata does not sort group order');
    assert.equal(owner.changedGroupKeys.size,1);
    assert.equal([...owner.projectedGroups].filter(([key,row])=>row!==before.get(key)).length,1);
    data.replace(updated,owner.changedGroupKeys);
    assert.equal(touched,1);assert.deepEqual(notices,[]);assert.equal(data.getData(500).book.intro,'更新');assert.equal(lower,0);
    notices.length=0;touched=0;
    owner.groupResults(next);data.replace(groups,owner.changedGroupKeys);
    assert.equal(owner.changedGroupKeys.size,0);assert.equal(touched,0);assert.equal(notices.length,0);assert.equal(lower,0);
  } finally {String.prototype.toLocaleLowerCase=originalLower;}
  
}

}
if (selectedCase === 'layout-restoration') {
  function restoration({ anchored = true, measured = false, focusKey = '', focusNodePresent = true } = {}) {
    const frames = [], moves = [], focusRequests = [], warmups = [];
    const state = new SearchViewState(), publication = new SearchPublication(), model = new ReaderLibrarySearchModel();
    publication.publish({ kind: 'results', keyword: '', results: ['a', 'b', 'c'].map(key => group(key).book), history: [],
      totalSourceCount: 1, completedSourceCount: 1, searching: false });
    state.anchorAtStart = !anchored;
    if (anchored) {
      state.anchorKey = 'online:b';
      state.anchorItemY = -23;
      state.anchorOffset = 137;
    }
    if (focusKey.length > 0) { state.rememberDetailResult(focusKey); state.returnFromDetail(); }
    const p = Object.assign(new Page(), { viewState: state, publication, surfaceModel: model, publicationRevision: 1,
      listEpoch: 0, restoreEpoch: 0, viewStateRevision: -1, resultFlushEpoch: 0, taskStatusGeneration: 0,
      visibleStart: 0, visibleEnd: 0, warmupGroups: [], resultDataSource: new SearchResultDataSource(),
      listMounted: false, headerAnchorPending: false, isPresentationCurrent: () => true, isPresentationVisible: () => true,
      searchContentStartInset: () => 54, searchContentEndInset: () => 28, onVisibleGroups: groups => warmups.push(groups),
      getUIContext: () => ({
        getFont() {}, postFrameCallback: frame => frames.push(frame), px2vp: value => value / 2,
        getFrameNodeById: id => focusNodePresent && id === p.resultFocusId(state.resolveKey(focusKey)) ? {} : null,
        getComponentUtils: () => ({ getRectangleById(id) {
          assert.equal(id, p.resultViewportId()); return { size: { height: 1200 } };
        } }),
        getFocusController: () => ({ requestFocus: id => focusRequests.push(id) }),
      }) });
    let y = 0, height = measured ? 100 : 0, offset = 0;
    p.resultScroller = {
      scrollToIndex: index => { moves.push(['index', index]); y = 0; },
      scrollTo: target => { moves.push(['offset', target.yOffset]); offset = target.yOffset; },
      scrollBy: (_x, delta) => { moves.push(['by', delta]); y -= delta; offset += delta; },
      getItemRect: () => ({ y, height }), currentOffset: () => ({ yOffset: offset }),
    };
    p.aboutToAppear();
    p.listMounted = true;
    return { p, model, frames, moves, focusRequests, warmups, setHeight: value => { height = value; },
      tick() { const frame = frames.shift(); assert.ok(frame, 'expected layout callback'); frame.onIdle(); } };
  }

  {
    const f = restoration();
    assert.equal(f.p.retainedViewportPending, true, 'a remounted scrolled result starts behind the surface mask');
    f.p.scheduleScrollRestore();
    f.p.visibleGroups = [group('x'), ...f.p.visibleGroups];
    f.p.listEpoch++; f.p.restoreEpoch++; f.p.restoreScheduled = false;
    f.p.scheduleScrollRestore();
    f.tick();
    assert.deepEqual(f.moves, [], 'old list frame is inert');
    f.tick();
    assert.deepEqual(f.moves, [['index', 3]], 'native notice prefix is included in the target index');
    f.p.onResultScrollIndex(3, 3);
    assert.equal(f.p.restoreCancelled, false, 'programmatic scrolling does not cancel the restoration');
    f.setHeight(100);
    f.tick();
    assert.deepEqual(f.moves, [['index', 3], ['by', 23]]);
    assert.equal(f.p.retainedViewportPending, true, 'a scroll command does not publish an unsettled viewport');
    assert.equal(f.p.scrollRestored, false);
    f.tick();
    assert.equal(f.p.retainedViewportPending, false);
    assert.equal(f.p.scrollRestored, true);
    assert.equal(f.p.viewState.anchorIndex, 2);
    assert.equal(f.p.viewState.anchorItemY, -23);
  }

  for (const boundary of ['query', 'page', 'user']) {
    const f = restoration({ measured: true });
    f.p.scheduleScrollRestore(); f.tick();
    assert.equal(f.p.retainedViewportPending, true);
    if (boundary === 'query') f.p.viewState.reset('new query');
    if (boundary === 'page') f.p.aboutToDisappear();
    if (boundary === 'user') f.p.onListTouch('down');
    const before = [f.p.viewState.anchorKey, f.p.viewState.anchorIndex, f.p.viewState.anchorItemY];
    f.tick();
    assert.deepEqual(f.moves, [['by', 23]], boundary + ' retires the pending reveal');
    assert.deepEqual([f.p.viewState.anchorKey, f.p.viewState.anchorIndex, f.p.viewState.anchorItemY], before);
    assert.equal(f.p.retainedViewportPending, boundary === 'query');
  }

  for (const [key, neighbors, target] of [
    ['online:merged', [], 'online:b'], ['online:removed', ['online:gone', 'online:c'], 'online:c'],
  ]) {
    const f = restoration({ measured: true });
    f.p.restoreKey = key;
    f.p.viewState.redirects.set('online:merged', 'online:b');
    f.p.viewState.anchorNeighbors = neighbors;
    f.p.scheduleScrollRestore(); f.tick(); f.tick();
    assert.equal(f.p.viewState.anchorKey, target);
    assert.equal(f.p.retainedViewportPending, false);
  }

  for (const offset of [0, -30, -80.5, 137]) {
    const f = restoration({ anchored: offset !== 0 });
    f.p.restoreKey = '';
    f.p.restoreOffset = offset;
    f.p.scheduleScrollRestore(); f.tick();
    assert.deepEqual(f.moves, offset !== 0 ? [['offset', offset]] : [['index', 0]]);
    if (offset !== 0) {
      assert.equal(f.p.retainedViewportPending, true);
      f.tick();
    }
    assert.equal(f.p.retainedViewportPending, false);
    assert.equal(f.p.scrollRestored, true);
  }

  const missing = restoration();
  missing.p.restoreKey = 'online:removed';
  missing.p.scheduleScrollRestore(); missing.tick(); missing.tick();
  assert.deepEqual(missing.moves, [['index', 0]], 'a removed key without surviving neighbors opens at the native start');
  const unrealized = restoration();
  unrealized.p.scheduleScrollRestore();
  unrealized.tick(); unrealized.tick(); unrealized.tick();
  assert.equal(unrealized.p.retainedViewportPending, true);
  unrealized.tick();
  assert.equal(unrealized.p.retainedViewportPending, false, 'bounded native attempts cannot hide the page indefinitely');

  for (const target of ['realized', 'missing', 'foreground-lost', 'retired']) {
    const f = restoration({ measured: true, focusKey: 'online:b', focusNodePresent: target !== 'missing' });
    assert.equal(f.model.interactive, true);
    f.p.scheduleScrollRestore(); f.tick(); f.tick();
    assert.deepEqual(f.focusRequests, [], 'focus waits for the restored viewport frame');
    if (target === 'foreground-lost') f.p.isPresentationVisible = () => false;
    if (target === 'retired') {
      f.p.nativePanel = { kind: 'filter', identity: 'filter-before-exit', chromeClaimed: true };
      f.p.publishSurfacePanelInput();
      const chrome = restoredAppChrome;
      f.p.aboutToDisappear();
      assert.equal(restoredAppChrome, chrome + 1, 'retirement releases the current native panel chrome');
      assert.equal(f.model.currentOwner(), 0);
      assert.equal(f.model.panelOwnsInput, false);
      assert.deepEqual(f.warmups.at(-1), [], 'retirement releases visible candidate warming');
    }
    f.tick();
    assert.deepEqual(f.focusRequests, target === 'realized' ? [f.p.resultFocusId('online:b')] :
      target === 'missing' ? [READER_LIBRARY_SEARCH_BACK_FOCUS_ID] : [], target);
  }
}

if(selectedCase==='candidate-facts'){
// Legacy timestamps and chapter/refresh failures cannot alter whole-book availability.
{
  const now=Date.now();const facts={schemaVersion:2,sourceVersion:'v2',catalogAt:now-100,catalogCount:8,readableAt:now-50};
  const candidate=acquisition=>book('verified','鸣龙','作者',{sourceRuleVersion:'v2',acquisition});
  assert.equal(searchCandidateRank(candidate({...facts,schemaVersion:1,verificationCurrent:true}),now),1);
  assert.equal(searchCandidateRank(candidate({...facts,verificationCurrent:false}),now),1);
  assert.equal(searchCandidateRank(candidate({...facts,verificationCurrent:true}),now),0);
  assert.equal(searchCandidateRank(candidate({...facts,verificationCurrent:true,catalogAt:now+1}),now),2);
  assert.equal(searchCandidateRank(candidate({...facts,verificationCurrent:true,catalogCount:0}),now),2);
  for(const failureStage of ['chapter','refresh','detail','catalog']) {
    const failed={...facts,verificationCurrent:false,failureCurrent:true,failureConfirmed:true,failure:{schemaVersion:2,sourceVersion:'v2',
      stage:'failed',failureStage,failureCategory:'SOURCE_RULE_FAILED',checkedAt:now,chapterIndex:5,chapterUrl:'/5'}};
    assert.equal(searchCandidateRank(candidate(failed),now),failureStage==='detail'||failureStage==='catalog'?3:1);
    assert.equal(searchCandidateRank(candidate({...failed,failureCurrent:false}),now),1);
    assert.equal(searchCandidateRank(candidate({...failed,failureConfirmed:false}),now),1);
    const legacy=structuredClone(failed);delete legacy.failure.failureCategory;delete legacy.failureConfirmed;
    assert.equal(searchCandidateRank(candidate(legacy),now),1,'untyped legacy failure cannot downgrade a successful catalog');
  }
}



}
if(selectedCase==='safe-failure-text'){
// R3 safe branch explanations are rendered on both partial and stopped-empty
// surfaces; raw query-owned errors are never rendered by these methods.
{
  const FailurePage=selectedProductionMethods(new URL('../entry/src/main/ets/features/search/ui/SearchPage.ets',import.meta.url),'SearchPage',
    ['partialSearchFailure','searchFailureMessage'],{});
  for(const kind of ['results','empty','error']) {
    const owner=Object.assign(new FailurePage(),{presentation:{kind,localSearchFailed:true,sourceListFailed:true,
      localFailureMessage:'读取超时，请重试',sourceListFailureMessage:'本地数据暂时无法读取，请稍后重试',
      localFailureReason:'secret raw response',sourceListFailureReason:'https://private.example/token'}});
    const text=owner.partialSearchFailure();assert.ok(text.includes('本地检索：读取超时'));
    assert.ok(text.includes('书源列表：本地数据暂时无法读取'));assert.ok(!text.includes('secret')&&!text.includes('private.example'));
    if(kind==='error')assert.equal(owner.searchFailureMessage(),text);
  }
  
}



}
if(selectedCase==='content-filter'){
// H1: same-session content filtering consumes already admitted category facts.
const filterState = new SearchViewState();
filterState.reset('一人之下');
const remoteNovel = book('novel-a', '一人之下', '作者', { category: 'novel' });
const remoteManga = book('manga-a', '一人之下', '作者', { category: 'comic' });
const remoteMangaVariant = book('manga-b', '一人之下', '作者', { category: 'comic' });
const localNovel = book('local', '一人之下', '作者'); // Legacy local defaults to text.
const unsupported = book('other-a', '漫画一人之下', '作者', { category: 'other', kind: '漫画' });
const allBooks = [remoteNovel, remoteManga, remoteMangaVariant, localNovel, unsupported];
const queryPresentation = { kind: 'results', keyword: '一人之下', results: allBooks,
  searching: true, completedSourceCount: 4, totalSourceCount: 6 };
const searches = [];
let retries = 0, warmups = 0, scrollResets = 0;
const filtered = Object.assign(new Page(), {
  presentation: queryPresentation, viewState: filterState, shelfBooks: [], selectedGroupName: '全部',
  selectedContentType: '全部类型', keyword: '一人之下',
  pageMounted: true, pageEpoch: filterState.pageRevision, queryAtMount: filterState.revision,
  isPresentationCurrent: () => true,
  visibleStart: 0, visibleEnd: 5, warmupGroups: [], resultDataSource: new SearchResultDataSource(),
  resultScroller: { scrollTo() { scrollResets++; }, scrollEdge() { scrollResets++; } },
  onVisibleGroups() { warmups++; }, onSearch(keyword) { searches.push(keyword); }, onRetry() { retries++; },
});
filtered.refreshVisibleResults();
const originalOrder = filtered.visibleGroups.map(group => filtered.resultGroupKey(group.book));
assert.equal(originalOrder.length, 4, 'same-title novel and manga retain separate existing groups');
const mangaGroup = filtered.visibleGroups.find(group => group.book.category === 'comic');
assert.deepEqual(mangaGroup.variants, [remoteManga, remoteMangaVariant]);
const projection = filtered.resultProjection;
const queryRevision = filterState.revision;
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const controls = foundationControls();
const filterPanel = read('entry/src/main/ets/features/search/ui/ReaderSearchFilterPanel.ets');
const { owner: chips } = createReaderBuilderProbe(filterPanel,
  ['scheme', 'selectedType', 'presentationIdentity', 'expanded', 'mounted', 'onType', 'accepts', 'typeChip'],
  controls.dependencies, controls.hooks);
const sheetIdentity = 'content-filter';
Object.assign(chips, { mounted: true, expanded: true, presentationIdentity: sheetIdentity,
  onType(label, identity) {
    assert.equal(identity, sheetIdentity);
    filtered.selectContentType(label);
    this.selectedType = filtered.selectedContentType;
  } });
// Exercise the current trigger actors as well as the existing real chip path.
// Native sheet lifecycle remains the production binding, not reconstructed callbacks.
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const sheetSurfaces = boundedSurfaceSdk();
const surfaceGeometry = await import('../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts');
const windowMetrics = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const resultGeometry = await import('../entry/src/main/ets/features/search/ui/SearchResultGeometry.ts');
const sheetDeps = { ...sheetSurfaces.deps, ...surfaceGeometry, ...windowMetrics, ...resultGeometry,
  SheetSize: { FIT_CONTENT: 'fit' }, SheetType: { BOTTOM: 'bottom' }, DismissReason: { PRESS_BACK: 'back' } };
const { SearchResultSheetBinding } = pureModuleProbe(read('entry/src/main/ets/features/search/ui/SearchResultSheetBinding.ets'),
  'SearchResultSheetBinding.ets', sheetDeps, ['SearchResultSheetBinding']);
const { owner: filterTrigger } = createReaderBuilderProbe(filterPanel,
  ['build', 'active', 'toggleAction', 'sheetContent', 'sheetOptions', 'sheetSpec', 'sheetWidth', 'accepts', 'nativeSheet'],
  { ...sheetDeps, SearchResultSheetBinding }, sheetSurfaces.hooks);
const triggerEvents = [];
Object.assign(filterTrigger, { mounted: true, expanded: false, scheme: 'day', selectedType: '漫画', selectedGroup: '全部',
  presentationIdentity: 'filter-trigger', triggerFocusId: 'filter-return',
  onToggle: (identity, expanded) => triggerEvents.push(['toggle', identity, expanded]),
  onNativeOpening: identity => triggerEvents.push(['opening', identity]),
  onNativeClosing() {}, onDismiss() {}, onClosed() {} });
filterTrigger.initialRender();
const physicalFilter = [...filterTrigger.nodes.values()].find(node => node.type === 'Button' && node.onClick);
assert.ok(physicalFilter, 'actual filter trigger is a native Button');
assert.equal(physicalFilter.id, 'filter-return');
assert.equal(physicalFilter.width, resultGeometry.SEARCH_RESULT_GEOMETRY.filterActionSize);
assert.ok(Array.isArray(physicalFilter.bindSheet), 'native sheet stays attached to the same filter actor');
physicalFilter.onClick();
physicalFilter.bindSheet[2].onWillAppear();
assert.deepEqual(triggerEvents, [['toggle', 'filter-trigger', false], ['opening', 'filter-trigger']]);
filterTrigger.mounted = false;
physicalFilter.onClick(); physicalFilter.bindSheet[2].onWillAppear();
assert.equal(triggerEvents.length, 2, 'retired trigger and native opening cannot dispatch');
assert.ok(![...filterTrigger.nodes.values()].some(node => node.type === 'Stack' && node.onClick),
  'filter visual Stack has no duplicate toggle');

const historySource = read('entry/src/main/ets/features/search/ui/ReaderSearchHistoryPanel.ets');
const historyGeometry = await import('../entry/src/main/ets/features/search/ui/SearchHistoryGeometry.ts');
let clears = 0;
const { owner: history } = createReaderBuilderProbe(historySource,
  ['build', 'actionsEnabled', 'projectedRows', 'measuredControlWidth', 'measuredWidths', 'measuredRevision', 'metricsRevision'],
  { ...controls.dependencies, ...historyGeometry }, controls.hooks);
Object.assign(history, { appThemeScheme: 'day', history: ['已保留关键词'], status: undefined,
  geometry: new historyGeometry.SearchHistoryGeometry(350, 180, 1, false),
  onClear: () => clears++, onSelect() {}, getUIContext: () => ({ px2vp: value => value,
    getMeasureUtils: () => ({ measureText: () => 80 }) }) });
history.initialRender();
const clearHistory = [...history.nodes.values()].find(node => node.type === 'Button' && node.accessibilityText === '清空搜索历史');
assert.ok(clearHistory, 'actual history clear is one native Button');
assert.equal(clearHistory.height, history.geometry.headingHeight);
clearHistory.onClick(); assert.equal(clears, 1);
history.status = 'loading'; clearHistory.onClick(); assert.equal(clears, 1, 'busy history rejects a retained native callback');
assert.ok(![...history.nodes.values()].some(node => node.type === 'Row' && node.onClick),
  'history visual Row cannot clear twice');
const typeLabels = ['全部类型', '小说', '漫画'];
const geometry = { choiceWidths: [64, 64, 64], choiceHeight: 44 };
typeLabels.forEach((label, index) => chips.typeChip(label, index, sheetIdentity, geometry));
const chip = label => controls.nodes(chips).find(node => node.onClick &&
  [`当前内容:${label}`, `筛选内容:${label}`].includes(node.accessibilityText));
assert.deepEqual(typeLabels.map(label => Boolean(chip(label))), [true, true, true]);
chip('漫画').onClick(); controls.flush(chips);
assert.deepEqual(filtered.visibleGroups, [mangaGroup], 'actual SDK chip dispatch filters real projection without regrouping');
assert.equal(chip('漫画').accessibilityText, '当前内容:漫画');
assert.equal(filterState.contentType, '漫画');
assert.equal(filtered.resultProjection, projection);
assert.equal(filtered.presentation, queryPresentation);
assert.equal(filtered.presentation.results, allBooks);
assert.equal(filterState.revision, queryRevision);
assert.deepEqual(filtered.visibleGroups[0].variants, [remoteManga, remoteMangaVariant], 'filter keeps all same-type source candidates');
filtered.selectGroup('本地');
assert.equal(filtered.visibleGroups.length, 0);
assert.match(filtered.filteredEmptyMessage(), /本地 · 漫画.*搜索仍在继续/);
filtered.presentation = { ...queryPresentation, searching: false, stopped: true };
assert.match(filtered.filteredEmptyMessage(), /搜索已停止.*已返回的结果/);
filtered.presentation = { ...queryPresentation, searching: false, stopped: false };
assert.match(filtered.filteredEmptyMessage(), /已返回的结果.*可切换范围或内容类型/);
chip('小说').onClick(); controls.flush(chips);
assert.deepEqual(filtered.visibleGroups.map(group => group.book), [localNovel]);
filtered.selectGroup('在线');
assert.deepEqual(filtered.visibleGroups.map(group => group.book), [remoteNovel]);
chip('全部类型').onClick(); controls.flush(chips);
assert.ok(filtered.visibleGroups.some(group => group.book === unsupported), 'All retains existing unknown-type admission without relabeling');
filtered.selectGroup('全部');
assert.deepEqual(filtered.visibleGroups.map(group => filtered.resultGroupKey(group.book)), originalOrder, 'existing ordering is restored exactly');
assert.deepEqual(searches, []); assert.equal(retries, 0); assert.equal(filterState.revision, queryRevision);
assert.ok(warmups > 0, 'existing visible-item warmup lifecycle remains active; zero total HTTP is not asserted');
assert.ok(scrollResets > 0);
chip('漫画').onClick();
const lateManga = book('manga-c', '一人之下番外', '作者', { category: 'comic' });
filtered.presentation = { ...queryPresentation, results: [...allBooks, lateManga] };
filtered.refreshVisibleResults();
assert.deepEqual(filtered.visibleGroups.map(group => group.book), [remoteManga, lateManga], 'streamed arrivals honor the selected type');
const cachedFiltered = filtered.visibleGroups;
filtered.presentation = { ...filtered.presentation, completedSourceCount: 5 };
filtered.refreshVisibleResults();
assert.equal(filtered.visibleGroups, cachedFiltered, 'progress-only publications preserve filtered array identity');
// A remounted search reads the navigation-owned preference, not a new run.
filtered.viewStateRevision = -1;
filtered.selectedContentType = '全部类型';
filtered.refreshVisibleResults();
assert.equal(filtered.selectedContentType, '漫画');
assert.deepEqual(filtered.visibleGroups.map(group => group.book), [remoteManga, lateManga]);
filtered.presentation = { ...filtered.presentation, searching: false };
filtered.selectGroup('在线');
filterState.anchorKey = filtered.resultGroupKey(remoteManga);
const retainedAnchor = filterState.anchorKey;
filtered.submitSearch('   ');
assert.deepEqual(searches, [], 'blank input never dispatches');
filtered.submitSearch('  一人之下  ');
assert.deepEqual(searches, ['一人之下'], 'the page dispatches the trimmed intent only');
assert.equal(filterState.contentType, '漫画');
assert.equal(filterState.category, '在线');
assert.equal(filterState.anchorKey, retainedAnchor);
assert.equal(filterState.revision, queryRevision, 'an intent without admission preserves the current query');

const SearchHost = selectedProductionMethods(new URL('../entry/src/main/ets/features/search/application/SearchHost.ets', import.meta.url),
  'SearchHost', ['search']);
const accepted = [];
const host = Object.assign(new SearchHost(), { viewState: filterState,
  getOrchestrator: () => ({ search: (keyword, scope) => accepted.push([keyword, scope]) }) });
filtered.onSearch = keyword => host.search(keyword);
filtered.submitSearch();
filtered.submitSearch();
assert.deepEqual(accepted, [['一人之下', undefined]], 'same-keyword submit starts one all-source query and retires the old page lease');
assert.equal(filterState.revision, queryRevision + 1);
assert.equal(filterState.anchorKey, '');
assert.equal(filterState.contentType, '全部类型');
filtered.queryAtMount = filterState.revision;
filtered.refreshVisibleResults();
assert.equal(filtered.selectedContentType, '全部类型');
assert.equal(filterState.category, '全部');
// A fixed canonical group whose admitted metadata changes must enter/leave
// the derived view even when its order and key remain unchanged.
const changing = Object.assign(new Page(), { presentation: { kind: 'results', keyword: '' },
  viewState: new SearchViewState(), shelfBooks: [], selectedGroupName: '全部', selectedContentType: '小说' });
const unknownFact = book('metadata', '漫画不是类型证据', '作者', { groupKey: 'unchanged-key', category: 'other' });
assert.equal(changing.groupResults([unknownFact]).length, 0);
const textFact = { ...unknownFact, category: 'novel' };
assert.equal(changing.groupResults([textFact])[0].book, textFact);
assert.equal(changing.groupResults([unknownFact]).length, 0);
assert.equal(retries, 0);


}
}
if(selectedCase==='rows'){
const ds = new SearchResultDataSource();
const events = [];
listen(ds, { onDataChange: i => events.push(['change', i]),
  onDataDelete: i => events.push(['delete', i]), onDataAdd: i => events.push(['add', i]),
  onDataReloaded: () => events.push(['reload']) });
ds.replace([group('a'), group('b'), group('c')]);
const visibleBook = ds.getData(1);
events.length = 0;
const enriched = group('b', '详情中的新书名');
enriched.admit({ sourceId: 'source-b', bookId: 'b2', title: '详情中的新书名', author: '作者' }, true);
ds.replace([group('a'), enriched, group('c'), group('d')]);
assert.equal(ds.getData(1), visibleBook, 'metadata updates retain the visible observed row');
assert.equal(visibleBook.book.title, '详情中的新书名');
assert.equal(visibleBook.sourceCount, 2);
assert.equal(visibleBook.variants[1].sourceId, 'source-b', 'clicks receive the new candidate too');
assert.equal(visibleBook.inBookshelf, true);
assert.deepEqual(events, [['add', 3]], 'only structural additions notify; ObjectLink carries metadata');
ds.replace([group('b'), group('d')]);
assert.deepEqual(Array.from({ length: ds.totalCount() }, (_, i) => ds.getData(i).book.bookId), ['b', 'd']);
assert.equal(ds.getData(0), visibleBook, 'removing earlier rows preserves the retained observed row');
ds.replace([group('d'), group('b')]);
assert.equal(ds.getData(1), visibleBook, 'an actual move also reuses the observed row');


}
if(selectedCase==='stream-batch'){
// Reproduce the VM's large streaming batch without timing-sensitive limits:
// stable remote keys must not touch locale normalization, and absent keys
// must not scan the existing list on every insertion.
const large = new SearchResultDataSource();
let normalizations = 0;
let indexScans = 0;


String.prototype.toLocaleLowerCase = function (...args) {
  normalizations += 1; return originalLower.apply(this, args);
};
Array.prototype.indexOf = function (...args) {
  indexScans += this.length; return originalIndexOf.apply(this, args);
};
try {
  large.replace(Array.from({ length: 4000 }, (_, i) => group(`result-${i}`)));
  const firstVisible = large.getData(0);
  large.replace(Array.from({ length: 8000 }, (_, i) => group(`result-${i}`)));
  assert.equal(large.totalCount(), 8000);
  assert.equal(large.getData(0), firstVisible);
  const retainedAfterDeletion = large.getData(3000);
  large.replace(Array.from({ length: 8000 }, (_, i) => group(`result-${i}`)).filter((_, i) => i >= 3000 && i % 2 === 0));
  assert.equal(large.totalCount(), 2500);
  assert.equal(large.getData(0), retainedAfterDeletion);
  assert.equal(normalizations, 0);
  assert.equal(indexScans, 0, 'new result batches must use membership lookup, not repeated linear scans');
} finally {
  String.prototype.toLocaleLowerCase = originalLower;
  Array.prototype.indexOf = originalIndexOf;
}
const fallback = new SearchResultDataSource();
fallback.replace([new SearchBookGroup({ sourceId: 'x', bookId: '1', title: ' A ', author: ' B ' }, 1, false)]);
const fallbackRow = fallback.getData(0);
fallback.replace([new SearchBookGroup({ sourceId: 'y', bookId: '2', title: 'a', author: 'b' }, 1, false)]);
assert.equal(fallback.getData(0), fallbackRow, 'legacy aliases retain their normalization semantics');


}
if(selectedCase==='navigation'){
const navigation = new SearchViewState();
assert.deepEqual(['b', 'a', 'c'].map(key => navigation.rank(key)), [0, 1, 2]);
assert.equal(navigation.rank('b'), 0, 'late source counts do not change first-seen order');
navigation.category = '在线'; navigation.keywordDraft = '草稿';
navigation.anchorKey = 'b'; navigation.anchorIndex = 1; navigation.anchorItemY = -23;
const remountedPageState = navigation;
assert.equal(remountedPageState.anchorItemY, -23);
assert.equal(remountedPageState.category, '在线');
navigation.reset('下一次查询');
assert.equal(navigation.anchorKey, ''); assert.equal(navigation.anchorItemY, 0);
assert.equal(navigation.keywordDraft, '下一次查询'); assert.equal(navigation.rank('c'), 0);






}
if(selectedCase==='incremental-row'){
// PH65: only one changed card in a broad unchanged projection can invalidate a lazy row.
const incremental = new SearchResultDataSource();
let changedRows = 0, addedRows = 0;
listen(incremental, { onDataChange() { changedRows++; }, onDataAdd() { addedRows++; },
  onDataDelete() {}, onDataReloaded() { assert.fail('no full reload'); } });
incremental.replace(Array.from({ length: 4000 }, (_, i) => group(`book-${i}`)));
changedRows = 0; addedRows = 0;
const batch = Array.from({ length: 4001 }, (_, i) => group(`book-${i}`));
batch[211].sourceCount = 2;
incremental.replace(batch);
assert.equal(changedRows, 0); assert.equal(addedRows, 1);
assert.equal(incremental.getData(211).sourceCount, 2, 'retained row enriched without native replacement');
changedRows = 0; addedRows = 0;
incremental.replace(batch);
assert.equal(changedRows, 0); assert.equal(addedRows, 0);



}
if(selectedCase==='native-batch'){
// Native batch indices use the original array. Structural and change events
// at the same index must not conflict (the retained ObjectLink carries fields).
{
  const data=new SearchResultDataSource();const notices=[];
  data.registerDataChangeListener({onDatasetChange:ops=>notices.push(ops)});
  data.replace(['a','b','c','d','e'].map(k=>group(k)));notices.length=0;
  const retainedC=data.getData(2),retainedD=data.getData(3);
  data.replace([group('x'),group('b'),group('c','new C'),group('y'),group('d','new D')],new Set(['online:c','online:d']));
  assert.deepEqual(notices,[[{type:'delete',index:4,count:1},{type:'delete',index:0,count:1},
    {type:'add',index:1,count:1,key:['online:x']},{type:'add',index:3,count:1,key:['online:y']}]],'structural edits reference old positions; observed metadata needs no CHANGE');
  assert.equal(data.getData(2),retainedC);assert.equal(data.getData(4),retainedD);assert.equal(retainedD.book.title,'new D');
  notices.length=0;
  data.replace([group('d','most relevant'),group('x'),group('b'),group('c','new C'),group('y')],new Set(['online:d']));
  assert.deepEqual(notices,[[{type:'move',index:{from:4,to:0}}]],'one known relevance change uses MOVE without duplicate CHANGE at its index');
  assert.equal(data.getData(0),retainedD);assert.equal(retainedD.book.title,'most relevant');
}

}
if(selectedCase==='broad-reorder'){
// Broad arbitrary reorders are one explicitly counted native keyed reload,
// with no Reader repeated array scanning or shifting.
{
  const data=new SearchResultDataSource();const notices=[];
  data.registerDataChangeListener({onDatasetChange:ops=>notices.push(ops)});
  const rows=Array.from({length:4000},(_,i)=>group(`reverse${i}`));data.replace(rows);notices.length=0;
  let scans=0,shifts=0;const splice=Array.prototype.splice;
  Array.prototype.indexOf=function(...args){scans+=this.length;return originalIndexOf.apply(this,args);};
  Array.prototype.splice=function(...args){shifts+=this.length;return splice.apply(this,args);};
  try {data.replace(rows.slice().reverse(),new Set());} finally {Array.prototype.indexOf=originalIndexOf;Array.prototype.splice=splice;}
  assert.deepEqual(notices,[[{type:'reload'}]]);assert.equal(scans,0);assert.equal(shifts,0);
  assert.equal(data.getData(3999),rows[0]);
}

}
if(selectedCase==='media-identity'){
{
 const projection=new SearchResultProjection(), navigation=new SearchViewState();
 const text=book('novel','同名作品','同作者',{category:'novel'});
 const manga=book('comic','同名作品','同作者',{category:'comic'});
 const results=[text,manga];
 const shelf=[{sourceId:'another-text-source',bookId:'saved',title:'同名作品',author:'同作者'}];
 const before=projection.update(results,shelf,'同名作品',navigation);
 assert.equal(before.rows.size,2,'same-name manga and novel remain separate without an explicit group key');
 const rows=[...before.rows.values()];
 assert.equal(rows.find(r=>r.book===text).inBookshelf,true);
 assert.equal(rows.find(r=>r.book===manga).inBookshelf,false,'a novel shelf row must not label a comic already added');
 const after=projection.update(results,[...shelf,{...shelf[0],sourceId:'another-comic-source',contentKind:'manga'}],'同名作品',navigation);
 assert.equal([...after.rows.values()].find(r=>r.book===manga).inBookshelf,true);
 const list=new SearchResultDataSource();list.replace(rows.map(r=>new SearchBookGroup(r.book,1,r.inBookshelf)));
 assert.equal(list.totalCount(),2,'virtual row fallback identity also separates media');
}



}
}

import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import {registerReaderTypeScriptImports} from './lib/reader-typescript-imports.mjs';
const definitions={"visible-source-count": {"description": "实际SDK可见卡片3→7实时发现数且冻结正文/封面/选择及旧query回调安全", "resources": []}, "rows": {"description": "实际DataSource保留ObjectLink元数据、候选与结构增删移动", "resources": []}, "stream-batch": {"description": "4000→8000→2500实际行无locale/indexOf扫描及legacy alias", "resources": []}, "navigation": {"description": "实际SearchViewState首次顺序/草稿/anchor/reset", "resources": []}, "relevance": {"description": "实际SearchPage relevance/同组代表/本地在线scope/cache", "resources": []}, "progressive-anchor": {"description": "进度插入保留相同row与实测anchor/重挂恢复key", "resources": []}, "incremental-row": {"description": "4000行一变一新增只结构ADD，重复发布无通知", "resources": []}, "bounded-normalization": {"description": "实际grouping只新payload做locale，shelf title identity分离", "resources": []}, "locale-remount": {"description": "原平台Unicode/tr/az/lt ranks与8000variant/400title查询归属缓存", "resources": []}, "candidate-version": {"description": "当前sourceVersion目录证明胜过失败/旧版/stale", "resources": []}, "query-delta": {"description": "实际1000query delta只触1行且无结构通知/排序/locale", "resources": []}, "native-batch": {"description": "实际SDK batch旧index语义与单group MOVE不重复CHANGE", "resources": []}, "broad-reorder": {"description": "4000任意重排委托一次native keyed reload而非重复扫描", "resources": []}, "layout-restoration": {"description": "受控frame+key/neighbor/signed offset/query/page/user失效", "resources": []}, "candidate-facts": {"description": "实际schema2 whole-book rank与章节/刷新失败事实边界", "resources": []}, "safe-failure-text": {"description": "实际分类消息保留安全文本而不泄露原query错误", "resources": []}, "media-identity": {"description": "实际同名小说/漫画分组和shelf/virtual identity分离", "resources": []}, "content-filter": {"description": "实际SDK type chip→当前projection本地在线组合/late/resume/reset，不重搜", "resources": []}};
const selected=selectContractCases(definitions);
if(selected.length){
 const imports=registerReaderTypeScriptImports();
 try{for(const id of selected){await runSelectedCase(id);recordContractCasePass(id);}}
 finally{imports.deregister();}
}
async function runSelectedCase(selectedCase){
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const {selectedProductionMethods,selectedProductionClasses} = await import('./lib/selected-production-methods.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const { searchCandidateRank } = await import('../entry/src/main/ets/features/search/SearchCandidatePolicy.ts');
const { searchResultRelevance, SearchResultRelevance } = await import('../entry/src/main/ets/features/search/SearchResultRelevance.ts');
const authorMetadata = await import('../entry/src/main/ets/features/common/BookAuthorMetadata.ts');
const mediaIdentity = await import('../entry/src/main/ets/features/source/ReaderSourceCategory.ts');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(repo, path), 'utf8');
const page=read('entry/src/main/ets/features/search/SearchPage.ets');const {SearchViewState}=await import('../entry/src/main/ets/features/search/SearchViewState.ts');
const {SearchBookGroup,SearchResultDataSource}=selectedProductionClasses(new URL('../entry/src/main/ets/features/search/SearchPage.ets',import.meta.url),['SearchBookGroup','SearchResultDataSource'],{...authorMetadata,...mediaIdentity,DataOperationType:{ADD:'add',DELETE:'delete',CHANGE:'change',RELOAD:'reload',MOVE:'move'}});
// Keep the production module graph intact, including bookshelf identity and
// candidate policy. Stripping every import hides new real dependencies.
const { SearchResultProjection } = await import('../entry/src/main/ets/features/search/SearchResultProjection.ts');
const { ALL_SEARCH_SOURCE_GROUP, SearchSourceGroupDirectory, SearchResultFilter, searchSourceGroupKey } = await import('../entry/src/main/ets/features/search/SearchSourceGroups.ts');
const { EMPTY_SOURCE_GROUP_CATALOG } = await import('../entry/src/main/ets/features/source/SourceGroupTypes.ts');
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
const book = (id, title, author = '作者', extra = {}) => ({ sourceId: id, bookId: `/${id}`, title, author, ...extra });

const originalLower=String.prototype.toLocaleLowerCase,originalIndexOf=Array.prototype.indexOf;

if(['relevance','progressive-anchor','bounded-normalization','locale-remount','candidate-version','query-delta','layout-restoration','candidate-facts','safe-failure-text','content-filter'].includes(selectedCase)){
const pageFile=new URL('../entry/src/main/ets/features/search/SearchPage.ets',import.meta.url);
const grouping=['groupResults','sourceGroupDirectory'];
const restoration=['ownsPageQuery','ownsList','scheduleScrollRestore','restoreMeasuredAnchor','resultNativeIndex',
  'saveScrollAnchor','searchContentStartInset','resultGroupKey','normalizedBookKey'];
const publication=['refreshVisibleResults','rememberAnchorNeighbors','publishVisibleGroups'];
const pageMethods={
  relevance:grouping,'bounded-normalization':grouping,'candidate-version':grouping,'query-delta':grouping,
  'progressive-anchor':[...grouping,...restoration,...publication],
  'layout-restoration':[...restoration,'cancelScrollRestoreForUser','onResultScrollIndex'],
  'content-filter':[...grouping,...restoration,...publication,'submitSearch','applySearchFilters','acceptsFilterAction',
    'filterActionIdentity','filterPresentationIdentity','resetFilteredResults','filteredEmptyMessage','publishSurface'],
}[selectedCase];
const Page=pageMethods&&selectedProductionMethods(pageFile,'SearchPage',pageMethods,{
  ...authorMetadata,...mediaIdentity,SearchBookGroup,SearchResultProjection,SearchSourceGroupDirectory,SearchResultFilter,
  ALL_SEARCH_SOURCE_GROUP,searchSourceGroupKey,
  SearchLayoutFrame:class{constructor(action){this.action=action;}onIdle(){this.action();}},
  ScrollAlign:{START:0},Edge:{Top:'top'},
});
function searchOwner(overrides={}){
  const state=overrides.viewState??new SearchViewState();
  return Object.assign(new Page(),{
    presentation:{kind:'results',keyword:'诡秘之主'},viewState:state,shelfBooks:[],selectedGroupName:'全部',selectedContentType:'全部类型',
    sourceGroupCatalog:EMPTY_SOURCE_GROUP_CATALOG,selectedSourceGroup:ALL_SEARCH_SOURCE_GROUP,visibleGroups:[],
    pageMounted:true,isPresentationCurrent:()=>true,pageEpoch:state.pageRevision,queryAtMount:state.revision,
    resultFlushEpoch:0,restoreEpoch:0,listEpoch:0,startPositionedQuery:-1,headerAnchorPending:false,
    filterGeneration:0,filterStepGeneration:0,filterStep:'filter',taskStatusGeneration:0,restoreKey:'',
    // These cases exercise the result owner with the notice lane absent and
    // a known native start inset. Notice and header measurement have their own probes.
    acceptResultNoticeFacts(){},scrollLayout:()=>({startInset:0}),getUIContext:()=>({getFocusController:()=>({clearFocus(){}})}),
  },overrides);
}
const early = [book('fan1', '诡秘之主同人'), book('fan2', '我在诡秘之主'), book('other', '随笔')];
const exact=book('original','诡秘之主','爱潜水的乌贼');const late=[...early,exact,book('other-copy','诡秘之主','爱潜水的乌贼')];const aliases=[book('alias','诡秘之主小说','爱潜水的乌贼',{groupKey:'canonical-original'}),book('alias-exact','诡秘之主','爱潜水的乌贼',{groupKey:'canonical-original'})];
if(selectedCase==='relevance'){
const p=searchOwner();
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
// The precise old progressive-order guarantee applies within equal relevance.
// Reversed later source buckets and enriched source counts must not shuffle ties.
const frames=[],moves=[];
const t = searchOwner({listMounted:true,scrollRestored:true,
  visibleStart: 0, visibleEnd: 0, warmupGroups: [], onVisibleGroups(groups) { this.publishedGroups = groups; },
  resultDataSource:new SearchResultDataSource(),getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)})});
const tieA = book('tie-a', '诡秘之主·甲');
const tieB = book('tie-b', '诡秘之主·乙');
const ordered = t.groupResults([tieA, tieB]);
t.resultDataSource.replace(ordered);
t.visibleGroups=ordered;t.acceptedVisibleGroups=ordered;
const retainedB = t.resultDataSource.getData(1);
t.viewState.anchorIndex = 1; t.viewState.anchorKey = t.resultGroupKey(tieB);
t.resultScroller = { currentOffset: () => ({ yOffset: 137 }),
  getItemRect:index=>({y:index===0?0:-23,height:index===0?0:100}),
  scrollToIndex:index=>moves.push(['index',index]),scrollBy:(_x,y)=>moves.push(['by',y]) };
t.saveScrollAnchor();
assert.equal(t.viewState.anchorOffset, 137); assert.equal(t.viewState.anchorItemY, -23);
const anchorBefore = [t.viewState.anchorKey, t.viewState.anchorOffset, t.viewState.anchorItemY];
const tieBCopy = { ...tieB, sourceId: 'tie-b-copy', bookId: '/tie-b-copy' };
t.presentation = { kind: 'results', keyword: '诡秘之主', results: [tieB, tieA, tieBCopy, exact] };
t.viewStateRevision = t.viewState.revision;
t.scrollRestored = true;
t.refreshVisibleResults();
assert.deepEqual(t.publishedGroups, [t.visibleGroups[0].variants], 'actual refresh publishes the current visible candidate group');
assert.deepEqual(t.visibleGroups.map(g => g.book.sourceId), ['original', 'tie-a', 'tie-b']);
assert.equal(t.resultDataSource.getData(2), retainedB, 'rank insertion retains the observed anchored row');
assert.equal(retainedB.sourceCount, 2, 'source enrichment keeps the same first-seen tie');
assert.deepEqual([t.viewState.anchorKey, t.viewState.anchorOffset, t.viewState.anchorItemY], anchorBefore);
assert.equal(frames.length,1,'streaming refresh verifies the retained anchor geometry once');
frames.shift().onIdle();
assert.deepEqual(moves,[],'an already measured anchor at the saved offset needs no jump or correction');
assert.equal(t.viewState.anchorIndex,2);
assert.equal(t.scrollRestored,true);
// A genuine remount/revision applies the saved key plus actual item offset;
// it does not substitute the old numerical index after relevance reordered rows.
t.viewStateRevision = -1; t.refreshVisibleResults();
assert.equal(t.restoreKey, anchorBefore[0]); assert.equal(t.restoreOffset, 137); assert.equal(t.restoreItemY, -23);
assert.equal(t.scrollRestored, false);



}
if(selectedCase==='bounded-normalization'){
// PH65: locale/relevance work is limited to new identity payloads, not all retained cards.
{
  const owner=searchOwner({presentation:{kind:'results',keyword:'书'}});
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
const p=searchOwner();
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
  const owner=searchOwner({presentation:{kind:'results',keyword:'鸣龙'}});
  assert.equal(owner.groupResults([failed, catalog])[0].book, catalog,
    'a current verified catalog represents the group instead of a recently failed source');
  assert.equal(owner.groupResults([unknown, stale])[0].book, unknown, 'stale facts do not outrank unverified candidates');
  assert.equal(owner.groupResults([unknown, oldVersion])[0].book, unknown, 'other source versions do not outrank unverified candidates');
  assert.equal(owner.groupResults([stale, oldVersion, catalog])[0].book, catalog);
  const discovered = Array.from({length:7}, (_, index) => candidate(`discovered-${index}`,
    index < 4 ? { schemaVersion:2,sourceVersion:'current',failureCurrent:true,failureConfirmed:true,
      failure:{schemaVersion:2,sourceVersion:'current',stage:'failed',failureStage:'catalog',
        failureCategory:'SOURCE_TOC_EMPTY',checkedAt:now} } : undefined));
  // The failed exact title is a stronger relevance match than this admitted
  // same-work alias. Availability still owns the representative selection.
  for (const row of discovered.slice(4)) row.title = '鸣龙小说';
  const discoveredGroup = owner.groupResults(discovered)[0];
  assert.equal(discoveredGroup.sourceCount, 7, 'the card counts every distinct discovered source, including failed attempts');
  assert.equal(discoveredGroup.variants.length, 7, 'explicit retry/source selection keeps all discovered identities');
  assert.equal(discoveredGroup.variants[0], discovered[0], 'candidate arrival order is not replaced by health sorting');
  assert.equal(discoveredGroup.book, discovered[4], 'actual SearchPage forwards the healthy representative instead of variants[0]');
  assert.equal(discoveredGroup.variants.filter(row => row.acquisition?.failureCurrent === true).length, 4,
    'retaining discovery never manufactures healthy acquisition facts');
}



}
if(selectedCase==='query-delta'){
// End-to-end query delta reaches one row. Pure counters reuse all projection objects.
{
  const owner=searchOwner({presentation:{kind:'results',keyword:'书'}});
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
if(selectedCase==='layout-restoration'){
function restoration() {
  const frames=[],moves=[];const state=new SearchViewState();state.pageRevision=1;state.anchorKey='online:b';state.anchorItemY=-23;
  const p=searchOwner({viewState:state,listEpoch:1,listMounted:true,
    presentation:{kind:'results'},
    restoreCancelled:false,restoreScheduled:false,scrollRestored:false,restoreKey:state.anchorKey,restoreOffset:137,restoreItemY:-23,
    visibleGroups:['a','b','c'].map(k=>group(k)),getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)}),publishVisibleGroups(){}});
  let y=0,height=100,offset=0;
  p.resultScroller={scrollToIndex:i=>{moves.push(['index',i]);y=0;},scrollTo:target=>{offset=target.yOffset;moves.push(['offset',offset]);},
    scrollBy:(_x,distance)=>{moves.push(['by',distance]);y-=distance;},getItemRect:i=>i===0?{y:-100,height:40}:{y,height},
    currentOffset:()=>({yOffset:offset})};
  return {p,frames,moves,setHeight:v=>height=v,tick(){const f=frames.shift();assert.ok(f,'expected layout callback');f.onIdle();}};
}
{
  const f=restoration();f.setHeight(0);f.p.scheduleScrollRestore();assert.equal(f.moves.length,0);
  f.p.visibleGroups=[group('x'),...f.p.visibleGroups];f.p.listEpoch++;f.p.restoreEpoch++;f.p.restoreScheduled=false;f.p.scheduleScrollRestore();
  f.tick();assert.equal(f.moves.length,0,'old list frame is inert');f.tick();assert.deepEqual(f.moves,[['index',3]]);
  f.p.onResultScrollIndex(3,3);assert.equal(f.p.restoreCancelled,false,'programmatic scroll does not masquerade as user input');
  f.setHeight(100);f.tick();assert.deepEqual(f.moves,[['index',3],['by',23]]);assert.equal(f.p.viewState.anchorIndex,2);assert.equal(f.p.viewState.anchorItemY,-23);
}
for(const boundary of ['query','page','user']) {
  const f=restoration();f.setHeight(0);f.p.scheduleScrollRestore();f.tick();f.setHeight(100);
  if(boundary==='query')f.p.viewState.reset('new query');
  if(boundary==='page'){f.p.pageMounted=false;f.p.viewState.pageRevision++;}
  if(boundary==='user')f.p.cancelScrollRestoreForUser();
  const before=[f.p.viewState.anchorKey,f.p.viewState.anchorIndex,f.p.viewState.anchorItemY];
  f.tick();assert.equal(f.moves.length,1,`${boundary} invalidates the correction frame`);
  assert.deepEqual([f.p.viewState.anchorKey,f.p.viewState.anchorIndex,f.p.viewState.anchorItemY],before);
}
{
  const f=restoration();f.p.restoreKey='online:merged';f.p.viewState.redirects.set('online:merged','online:b');f.p.scheduleScrollRestore();f.tick();
  assert.deepEqual(f.moves,[['by',23]],'already measured anchor needs no jump to native START');
  assert.equal(f.p.viewState.anchorKey,'online:b');
  const neighbor=restoration();neighbor.p.restoreKey='online:removed';neighbor.p.viewState.anchorNeighbors=['online:gone','online:c','online:a'];
  neighbor.p.scheduleScrollRestore();neighbor.tick();assert.equal(neighbor.p.viewState.anchorKey,'online:c');
  const late=restoration();late.setHeight(0);late.p.scheduleScrollRestore();late.tick();late.tick();
  assert.equal(late.p.scrollRestored,false);late.setHeight(100);late.tick();assert.equal(late.p.scrollRestored,true);
  assert.deepEqual(late.moves,[['index',2],['by',23]],'retry frames do not repeat the offscreen reveal');
}
for (const offset of [0, -30, -80.5, 137]) {
  const f=restoration();f.p.restoreKey='';f.p.viewState.anchorKey='';f.p.viewState.anchorAtStart=offset===0;
  f.p.restoreOffset=offset;f.p.scheduleScrollRestore();f.tick();
  assert.deepEqual(f.moves,offset!==0?[['offset',offset]]:[['index',0]],
    'fresh zero restores native top clearance, while saved signed offsets retain their position within the clearance');
  assert.equal(f.p.scrollRestored,true);
}
{
  const removed=restoration();removed.p.restoreKey='online:removed';removed.p.scheduleScrollRestore();removed.tick();
  assert.deepEqual(removed.moves,[['index',0]], 'a removed key without surviving neighbors resets to the native top edge');
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
// One notice owns the safe explanation across results, empty, and error.
{
  const FailurePage=selectedProductionMethods(new URL('../entry/src/main/ets/features/search/SearchPage.ets',import.meta.url),'SearchPage',
    ['partialSearchFailure','searchFailureMessage','hasAnySearchNotice','hasDisplayedSearchNotice','displayedSearchNoticeFacts',
      'captureSearchNoticeFacts','searchNoticeText','searchProgressText','searchStopped','isSweeping','operation']);
  for(const kind of ['results','empty','error']) {
    const owner=Object.assign(new FailurePage(),{viewState:new SearchViewState(),presentation:{kind,localSearchFailed:true,sourceListFailed:true,
      localFailureMessage:'读取超时，请重试',sourceListFailureMessage:'本地数据暂时无法读取，请稍后重试',
      localFailureReason:'secret raw response',sourceListFailureReason:'https://private.example/token'}});
    const text=owner.partialSearchFailure();assert.ok(text.includes('本地检索：读取超时'));
    assert.ok(text.includes('书源列表：本地数据暂时无法读取'));assert.ok(!text.includes('secret')&&!text.includes('private.example'));
    assert.equal(owner.hasAnySearchNotice(),true);
    assert.equal(owner.searchNoticeText('partial'),text);
    if(kind==='error')assert.equal(owner.searchFailureMessage(),'','page state does not repeat its notice explanation');
  }
  
}



}
if(selectedCase==='content-filter'){
// Atomic owner rules and the actual sheet Apply share this published scope.
{
const state = new SearchViewState();
const group = { kind: 'group', groupId: 'stable-group', name: '甲组' };
const revision = state.filterRevision, query = state.revision;
assert.equal(state.applyResultFilters('在线', '漫画', group), true);
assert.equal(state.filterRevision, revision + 1, 'three facts commit in one filter revision');
assert.equal(state.revision, query, 'result filtering preserves the running query');
assert.deepEqual([state.category, state.contentType, state.sourceGroup], ['在线', '漫画', group]);
assert.equal(state.applyResultFilters('在线', '漫画', { ...group, name: '已重命名' }), false,
  'stable group key, rather than reference or label, determines semantic equality');
assert.equal(state.filterRevision, revision + 1);
assert.equal(state.applyResultFilters('本地', '漫画', group), true);
assert.equal(state.sourceGroup.kind, 'all'); assert.equal(state.filterRevision, revision + 2);
assert.equal(state.applyResultFilters('本地', '漫画', { ...group }), false);
assert.equal(state.filterRevision, revision + 2, 'local normalization precedes the no-op comparison');
assert.equal(state.applyResultFilters('全部', '全部类型', { kind: 'all', groupId: '', name: '全部分组' }), true);
assert.equal(state.filterRevision, revision + 3);
}

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
let searches = 0, retries = 0, warmups = 0, scrollResets = 0;
const filtered = searchOwner({
  presentation: queryPresentation, viewState: filterState, shelfBooks: [], selectedGroupName: '全部',
  selectedContentType: '全部类型', keyword: '一人之下',
  visibleStart: 0, visibleEnd: 5, warmupGroups: [], resultDataSource: new SearchResultDataSource(),
  resultScroller: { scrollTo() { scrollResets++; }, scrollEdge() { scrollResets++; } },
  onVisibleGroups() { warmups++; }, onSearch() { searches++; }, onRetry() { retries++; },
});
filtered.refreshVisibleResults();
const originalOrder = filtered.visibleGroups.map(group => filtered.resultGroupKey(group.book));
assert.equal(originalOrder.length, 4, 'same-title novel and manga retain separate existing groups');
assert.deepEqual(filtered.visibleGroups.find(group => group.book.category === 'comic').variants, [remoteManga, remoteMangaVariant]);
const projection = filtered.resultProjection;
const queryRevision = filterState.revision;
const {foundationControls}=await import('./lib/reader-foundation-control-probe.mjs');
const {createReaderComponentProbe}=await import('./lib/reader-component-probe.mjs');
const {searchFilterSdkDeclarations}=await import('./lib/search-sheet-sdk-probe.mjs');
const options=foundationControls();
const filterSource=read('entry/src/main/ets/features/search/ReaderSearchFilterPanel.ets');
const {Component:Filter}=createReaderComponentProbe(filterSource,[
  'expanded','presentationIdentity','actionIdentity','step','appliedGroup','appliedType','appliedSourceGroup',
  'draftPresentationIdentity','draftGroup','draftType','draftSourceGroup','draftValid','applyingDraft','mounted',
  'beginDraft','validateDraft','accepts','acceptsAction','acceptsDraftAction','selectDraftType','selectDraftGroup','applyDraft',
  'onApply','choiceRows','scheme',
],{...options.dependencies,...searchFilterSdkDeclarations(filterSource),ALL_SEARCH_SOURCE_GROUP,searchSourceGroupKey},
  {...options.hooks,allowEmptyBranchAdmission:true});
function openFilter(){
  filtered.filterGeneration++;filtered.filtersExpanded=true;
  const opening=filtered.filterPresentationIdentity(),action=filtered.filterActionIdentity();
  const panel=new Filter(undefined,{expanded:true,presentationIdentity:opening,actionIdentity:action,step:'filter',
    appliedGroup:filtered.selectedGroupName,appliedType:filtered.selectedContentType,appliedSourceGroup:filtered.selectedSourceGroup,
    onApply:(...proposal)=>filtered.applySearchFilters(...proposal)});
  panel.mounted=true;panel.beginDraft(opening);
  panel.choiceRows(true,action);panel.choiceRows(false,action);options.properties.flush();
  const buttons=[...panel.children.values()].filter(child=>child instanceof options.button.Component);
  assert.deepEqual(buttons.map(button=>button.label),['全部','小说','漫画','全部','本地','在线']);
  const option=(label,lane)=>options.nodes(buttons.slice(lane*3,lane*3+3).find(button=>button.label===label))
    .find(node=>node.create===label&&typeof node.onClick==='function');
  return{panel,choose(label,lane){
    const node=option(label,lane);
    assert.ok(node,'actual SDK filter option');
    node.onClick();options.properties.flush();
    assert.equal(node.accessibilitySelected,true);
  },apply:()=>panel.applyDraft(action)};
}
function applyType(label){const draft=openFilter();draft.choose(label,0);draft.apply();}
function applyOrigin(label){const draft=openFilter();draft.choose(label,1);draft.apply();}
const firstDraft=openFilter();
firstDraft.choose('漫画',0);
assert.equal(filterState.contentType,'全部类型','draft does not change the owner projection');
firstDraft.apply();
assert.deepEqual(filtered.visibleGroups.map(group=>group.book),[remoteManga],'actual SDK option and Apply filter the retained query');
const afterApply=filterState.filterRevision;
firstDraft.apply();assert.equal(filterState.filterRevision,afterApply,'closed option callback cannot reapply the same action');
assert.equal(filterState.contentType, '漫画');
assert.equal(filtered.resultProjection, projection);
assert.equal(filtered.presentation, queryPresentation);
assert.equal(filtered.presentation.results, allBooks);
assert.equal(filterState.revision, queryRevision);
assert.deepEqual(filtered.visibleGroups[0].variants, [remoteManga, remoteMangaVariant], 'filter keeps all same-type source candidates');
applyOrigin('本地');
assert.equal(filtered.visibleGroups.length, 0);
assert.match(filtered.filteredEmptyMessage(), /本地 · 漫画.*搜索仍在继续/);
filtered.presentation = { ...queryPresentation, searching: false, stopped: true };
assert.match(filtered.filteredEmptyMessage(), /搜索已停止.*已返回的结果/);
filtered.presentation = { ...queryPresentation, searching: false, stopped: false };
assert.match(filtered.filteredEmptyMessage(), /已返回的结果.*可切换范围或内容类型/);
applyType('小说');
assert.deepEqual(filtered.visibleGroups.map(group => group.book), [localNovel]);
applyOrigin('在线');
assert.deepEqual(filtered.visibleGroups.map(group => group.book), [remoteNovel]);
applyType('全部');
assert.ok(filtered.visibleGroups.some(group => group.book === unsupported), 'All retains existing unknown-type admission without relabeling');
applyOrigin('全部');
assert.deepEqual(filtered.visibleGroups.map(group => filtered.resultGroupKey(group.book)), originalOrder, 'existing ordering is restored exactly');
assert.equal(searches, 0); assert.equal(retries, 0); assert.equal(filterState.revision, queryRevision);
assert.ok(warmups > 0, 'existing visible-item warmup lifecycle remains active; zero total HTTP is not asserted');
assert.ok(scrollResets > 0);
applyType('漫画');
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
filtered.submitSearch();
assert.equal(searches, 1, 'only explicit submit starts another query');
assert.equal(filterState.contentType, '全部类型');
assert.equal(filtered.selectedContentType, '全部类型');
assert.equal(filterState.category, '全部');
// A fixed canonical group whose admitted metadata changes must enter/leave
// the derived view even when its order and key remain unchanged.
const changing = searchOwner({presentation:{kind:'results',keyword:''},selectedContentType:'小说'});
const unknownFact = book('metadata', '漫画不是类型证据', '作者', { groupKey: 'unchanged-key', category: 'other' });
assert.equal(changing.groupResults([unknownFact]).length, 0);
const textFact = { ...unknownFact, category: 'novel' };
assert.equal(changing.groupResults([textFact])[0].book, textFact);
assert.equal(changing.groupResults([unknownFact]).length, 0);
assert.equal(searches, 1); assert.equal(retries, 0);


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
if(selectedCase==='visible-source-count'){
 const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
 const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
 const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
 const { builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
 const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
 const { readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
 const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
 const { SEARCH_RESULT_GEOMETRY } = await import('../entry/src/main/ets/features/search/SearchResultGeometry.ts');
 const { bookIntroText } = await import('../entry/src/main/ets/features/common/BookIntroText.ts');
 const { searchBookSnapshot } = await import('../entry/src/main/ets/features/search/SearchBookSnapshot.ts');
 const runtime=createArkUIPropertyRuntimeProbe();
 const {ts,options,root:sdkRoot,require}=installedEtsCompiler();
 const searchTree=ts.createSourceFile('SearchPage.ets',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 assert.deepEqual(searchTree.parseDiagnostics,[]);
 const groupDeclaration=searchTree.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='SearchBookGroup');
 assert.ok(groupDeclaration&&ts.getAllDecorators(groupDeclaration).some(decorator=>
   ts.isIdentifier(decorator.expression)&&decorator.expression.text==='Observed'));
 const observedClasses=require(sdkRoot+'/lib/validate_ui_syntax.js').observedClassCollection;
 const rows=Array.from({length:7},(_,i)=>({sourceId:`source-${i}`,bookId:`/book-${i}`,groupKey:'same-book',
  sourceName:`源${i}`,title:'原书名',author:'作者',intro:'原简介',category:'novel',
  coverUrl:`https://example.invalid/${i}.jpg`,searchRequestId:'query-1',variables:[]}));
 const viewState=new SearchViewState();viewState.reset('原书名');
 const grouped=(variants,representative=variants[0])=>{
  const group=new SearchBookGroup(variants[0],1,false);
  for(const variant of variants.slice(1))group.admit(variant,false);
  group.book=representative;group.displayRevision=viewState.filterRevision;return group;
 };
 const observed=runtime.sdk.ObservedObject.createNew(grouped(rows.slice(0,3)),undefined);
 const data=new SearchResultDataSource();data.replace([observed]);
 const changes=[];data.registerDataChangeListener({onDatasetChange:ops=>changes.push(ops)});
 const frames=[];let layoutInvalidations=0,selected;
 const wasRegistered=observedClasses.has(groupDeclaration.name.text);
 let owner;
 observedClasses.add(groupDeclaration.name.text);
 try{
  ({owner}=createReaderComponentProbe(page,builderComponentMembers(page,'SearchResultCard'),{
   ...runtime.sdk,SynchedPropertyNesedObjectPU:runtime.sdk.SynchedPropertyNestedObjectPU,SearchViewState,
   ...readerTypographyRoles,...readerFoundationTokens,readerAppColor,SEARCH_RESULT_GEOMETRY,
   ImageFit:{Cover:'Cover'},LengthMetrics:{vp:value=>value},ReaderWindowCoordinator:{metrics:()=>({systemFontScale:1})},
   searchBookSnapshot,bookIntroText,...authorMetadata,TouchType:{Down:0,Up:1,Cancel:3},SourceType:{TouchScreen:0},
   SearchLayoutFrame:class{constructor(action){this.action=action;}onFrame(){this.action();}},
  },{...runtime.hooks,componentName:'SearchResultCard'}));
 }finally{if(!wasRegistered)observedClasses.delete(groupDeclaration.name.text);}
 Object.assign(owner,{viewState,queryRevision:viewState.revision,displayRevision:viewState.filterRevision,cardWidth:390,expandedLayout:false,
  canRefreshDisplay:()=>true,onDisplayFactsChange:()=>layoutInvalidations++,
  onSelectResult:(chosen,variants,coverUrl)=>{selected={chosen,variants,coverUrl};},
  getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)})});
 owner.updateStateVars({group:observed});owner.aboutToAppear();owner.initialRender();
 const root=[...owner.nodes.values()].find(node=>node.type==='Row'&&node.onClick);
 const image=[...owner.nodes.values()].find(node=>node.type==='Image');
 const counter=[...owner.nodes.values()].find(node=>node.type==='Text'&&node.create==='发现 3 个来源');
 assert.ok(root&&image&&counter,'actual Card Builder has native row, image and source count Text');
 const originalNodes=new Map(owner.nodes),originalDisplay=owner.displayBook(),originalCover=image.create;
 const originalGeometry={coverWidth:image.width,coverHeight:image.height,rowWidth:root.width,rowPadding:root.padding,
  columns:[...owner.nodes.values()].filter(node=>node.type==='Column').map(node=>({constraintSize:node.constraintSize,width:node.width}))};
 const oldVisibility=root.onVisibleAreaChange[1],oldCoverError=image.onError;
 assert.equal(typeof oldVisibility,'function');
 oldVisibility(true,1);assert.equal(owner.displayVisible,true);
 owner.onCardTouch(0);
 const enriched={...rows[4],title:'补全后的不同标题',intro:'后到的超长简介'.repeat(100)};
 const updatedGroup=grouped(rows,enriched);updatedGroup.inBookshelf=true;
 data.replace([updatedGroup],new Set(['online:same-book']));runtime.flush();
 assert.equal(observed.sourceCount,7);
 assert.equal(counter.create,'发现 7 个来源','a visible card reports newly discovered sources without scrolling away');
 assert.equal(owner.displayBook(),originalDisplay,'book metadata remains frozen while the card is visible');
 assert.equal(owner.displayIntro(),'原简介');assert.equal(image.create,originalCover);
 assert.equal(owner.displayInBookshelf(),false,'source discovery alone does not unfreeze the admitted shelf label');
 for(const count of [6,7,6,7]){
  const update=grouped(rows.slice(0,count),enriched);update.inBookshelf=true;
  data.replace([update],new Set(['online:same-book']));runtime.flush();
  assert.equal(counter.create,`发现 ${count} 个来源`,'repeated ObjectLink publications update the same native Text actor while visible');
 }
 assert.equal(owner.nodes.size,originalNodes.size);
 for(const[id,node]of originalNodes)assert.equal(owner.nodes.get(id),node,'enrichment retains every native actor');
 assert.deepEqual({coverWidth:image.width,coverHeight:image.height,rowWidth:root.width,rowPadding:root.padding,
  columns:[...owner.nodes.values()].filter(node=>node.type==='Column').map(node=>({constraintSize:node.constraintSize,width:node.width}))},originalGeometry,
  'count changes preserve authored cover/row geometry; native pixel height remains device evidence');
 assert.equal(layoutInvalidations,0,'live count cannot request the metadata/row-height refresh owner');
 assert.deepEqual(changes,[],'same-query enrichment does not replace or reorder the lazy row');
 owner.onCardTouch(1);const oldUpFrame=frames.at(-1);owner.selectResult(0);
 assert.equal(selected.chosen.sourceId,'source-0');assert.equal(selected.variants.length,3,
  'an already pressed result retains its admitted identity and variants despite the live count');
 const nextRows=rows.slice(0,3).map(row=>({...row,searchRequestId:'query-2'}));
 viewState.reset('原书名');owner.updateStateVars({group:observed,queryRevision:viewState.revision,displayRevision:viewState.filterRevision});
 data.replace([grouped(nextRows)],new Set(['online:same-book']));runtime.flush();
 const epoch=owner.visibilityEpoch,visibility=owner.displayVisible;
 oldVisibility(false,0);assert.equal(owner.visibilityEpoch,epoch);assert.equal(owner.displayVisible,visibility,
  'old-query visibility callbacks cannot retire current display facts');
 const currentCover=observed.coverUrl;oldCoverError({});runtime.flush();assert.equal(observed.coverUrl,currentCover,
  'old-query image failures cannot reject the current cover');
 owner.onCardTouch(0);const pressed=owner.pressedSelection;oldUpFrame.onFrame();
 assert.equal(owner.pressedSelection,pressed,'a prior Up frame cannot clear a new-query press');
 owner.aboutToDisappear();oldVisibility(true,1);assert.equal(owner.displayedFacts,undefined);
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

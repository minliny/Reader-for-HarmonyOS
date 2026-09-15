import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; } } });
const { searchCandidateRank } = await import('../entry/src/main/ets/features/search/SearchCandidatePolicy.ts');
const { searchResultRelevance } = await import('../entry/src/main/ets/features/search/SearchResultRelevance.ts');
const authorMetadata = await import('../entry/src/main/ets/features/common/BookAuthorMetadata.ts');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(repo, path), 'utf8');
const authorMetadataModule = read('entry/src/main/ets/features/common/BookAuthorMetadata.ts');
const page = read('entry/src/main/ets/features/search/SearchPage.ets');
const classes = page.slice(page.indexOf('@Observed\nclass SearchBookGroup'), page.indexOf('/**\n * Figma-backed Book Search'))
  .replace('@Observed\n', '');
const source = stripTypeScriptTypes(`const DataOperationType = { ADD: "add", DELETE: "delete", CHANGE: "change", RELOAD: "reload", MOVE: "move" };\n${authorMetadataModule}\n${read('entry/src/main/ets/features/search/SearchViewState.ts')}\n${classes}\nexport { SearchBookGroup, SearchResultDataSource };`);
const { SearchBookGroup, SearchResultDataSource, SearchViewState } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const projectionSource = stripTypeScriptTypes(
  authorMetadataModule + '\n' +
  read('entry/src/main/ets/features/search/SearchResultProjection.ts').replace(/^import \{[^\n]+\} from .*;$/gm, '') + '\n' +
  read('entry/src/main/ets/features/search/SearchResultRelevance.ts').replace(/^import \{[^\n]+\} from .*;$/gm, '') + '\n' +
  read('entry/src/main/ets/features/common/BookAcquisitionPresentation.ts') + '\n' +
  read('entry/src/main/ets/features/search/SearchCandidatePolicy.ts').replace(/^import \{[^\n]+\} from .*;$/gm, ''));
const { SearchResultProjection } = await import(`data:text/javascript;base64,${Buffer.from(projectionSource).toString('base64')}`);
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

// Reproduce the VM's large streaming batch without timing-sensitive limits:
// stable remote keys must not touch locale normalization, and absent keys
// must not scan the existing list on every insertion.
const large = new SearchResultDataSource();
let normalizations = 0;
let indexScans = 0;
const originalLower = String.prototype.toLocaleLowerCase;
const originalIndexOf = Array.prototype.indexOf;
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
assert.match(page, /@ObjectLink group: SearchBookGroup/);
assert.match(page, /maintainVisibleContentPosition\(true\)/);
assert.doesNotMatch(page, /setTimeout\(.*scroll/, 'scroll restoration is layout-owned');
console.log('search stable rows, enrichment and navigation state: PASS');

// PH25: execute the real page grouping method over progressively arriving sources.
const Page = productionMotionMethods(process.env.READER_SEARCH_RELEVANCE_SOURCE ?? new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url),
  ['groupResults', 'resultGroupKey', 'normalizedBookKey', 'saveScrollAnchor', 'refreshVisibleResults', 'publishVisibleGroups', 'scheduleScrollRestore', 'rememberAnchorNeighbors', 'cancelScrollRestoreForUser', 'onResultScrollIndex'],
  { ...authorMetadata, SearchBookGroup, searchResultRelevance, searchCandidateRank, SearchResultProjection,
    SearchLayoutFrame: class { constructor(action) { this.action = action; } onIdle() { this.action(); } }, ScrollAlign: { START: 0 } });
const p = Object.assign(new Page(), { presentation: { kind: 'results', keyword: '诡秘之主' },
  viewState: new SearchViewState(), shelfBooks: [], selectedGroupName: '全部' });
const book = (id, title, author = '作者', extra = {}) => ({ sourceId: id, bookId: `/${id}`, title, author, ...extra });
const early = [book('fan1', '诡秘之主同人'), book('fan2', '我在诡秘之主'), book('other', '随笔')];
assert.deepEqual(p.groupResults(early).map(g => g.book.sourceId), ['fan1', 'fan2', 'other']);
const exact = book('original', '诡秘之主', '爱潜水的乌贼');
const late = [...early, exact, book('other-copy', '诡秘之主', '爱潜水的乌贼')];
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
const aliases = [book('alias', '诡秘之主小说', '爱潜水的乌贼', { groupKey: 'canonical-original' }),
  book('alias-exact', '诡秘之主', '爱潜水的乌贼', { groupKey: 'canonical-original' })];
assert.equal(p.groupResults(aliases)[0].book.sourceId, 'alias-exact', 'best matching variant represents a merged canonical group');
assert.equal(p.groupResults(aliases)[0].variants.length, 2);
console.log('search relevance: late exact title, stable ties, canonical variants, category scope, keyword cache PASS');

// The precise old progressive-order guarantee applies within equal relevance.
// Reversed later source buckets and enriched source counts must not shuffle ties.
const t = Object.assign(new Page(), { presentation: { kind: 'results', keyword: '诡秘之主' },
  viewState: new SearchViewState(), shelfBooks: [], selectedGroupName: '全部',
  visibleStart: 0, visibleEnd: 0, warmupGroups: [], onVisibleGroups(groups) { this.publishedGroups = groups; },
  resultDataSource: new SearchResultDataSource() });
const tieA = book('tie-a', '诡秘之主·甲');
const tieB = book('tie-b', '诡秘之主·乙');
const ordered = t.groupResults([tieA, tieB]);
t.resultDataSource.replace(ordered);
const retainedB = t.resultDataSource.getData(1);
t.viewState.anchorIndex = 1; t.viewState.anchorKey = t.resultGroupKey(tieB);
t.resultScroller = { currentOffset: () => ({ yOffset: 137 }), getItemRect: () => ({ y: -23 }) };
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
assert.equal(t.scrollRestored, true, 'streaming refresh does not restart navigation restoration');
// A genuine remount/revision applies the saved key plus actual item offset;
// it does not substitute the old numerical index after relevance reordered rows.
t.viewStateRevision = -1; t.refreshVisibleResults();
assert.equal(t.restoreKey, anchorBefore[0]); assert.equal(t.restoreOffset, 137); assert.equal(t.restoreItemY, -23);
assert.equal(t.scrollRestored, false);
console.log('progressive relevance ties, retained row identity, measured anchor and remount restoration PASS');

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
console.log('PH65 4000 retained rows + 1 changed + 1 added; repeated publication 0 changes PASS');

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
console.log('PH65 4000 retained grouping facts + one new row bounded normalization; canonical shelf label PASS');

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
console.log('current-version catalog group representative; stale and other-version facts are not verified PASS');

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
  console.log('R6 query=1000 single metadata: newGroups=1 rowUpdates=1 structuralNotifications=0 normalize=0 groupSort=0; progress all=0 PASS');
}
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
  assert.equal(data.getData(3999),rows[0]);console.log('R6 4000 reversed rows: native batch=1 reload=1 Reader index scans=0 splice shifts=0 PASS');
}
function restoration() {
  const frames=[],moves=[];const state=new SearchViewState();state.pageRevision=1;state.anchorKey='online:b';state.anchorItemY=-23;
  const p=Object.assign(new Page(),{viewState:state,pageEpoch:1,listEpoch:1,restoreEpoch:0,pageMounted:true,listMounted:true,
    restoreCancelled:false,restoreScheduled:false,scrollRestored:false,restoreKey:state.anchorKey,restoreOffset:137,restoreItemY:-23,
    visibleGroups:['a','b','c'].map(k=>group(k)),getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)}),publishVisibleGroups(){}});
  let y=0,height=100;
  p.resultScroller={scrollToIndex:i=>{moves.push(['index',i]);y=0;},scrollTo:offset=>moves.push(['offset',offset.yOffset]),
    scrollBy:(_x,offset)=>{moves.push(['by',offset]);y-=offset;},getItemRect:()=>({y,height}),currentOffset:()=>({yOffset:137})};
  return {p,frames,moves,setHeight:v=>height=v,tick(){const f=frames.shift();assert.ok(f,'expected layout callback');f.onIdle();}};
}
{
  const f=restoration();f.p.scheduleScrollRestore();assert.equal(f.moves.length,0);
  f.p.visibleGroups=[group('x'),...f.p.visibleGroups];f.p.listEpoch++;f.p.restoreEpoch++;f.p.restoreScheduled=false;f.p.scheduleScrollRestore();
  f.tick();assert.equal(f.moves.length,0,'old list frame is inert');f.tick();assert.deepEqual(f.moves,[['index',2]]);
  f.p.onResultScrollIndex(2,2);assert.equal(f.p.restoreCancelled,false,'programmatic scroll does not masquerade as user input');
  f.tick();assert.deepEqual(f.moves,[['index',2],['by',23]]);assert.equal(f.p.viewState.anchorIndex,2);assert.equal(f.p.viewState.anchorItemY,-23);
}
for(const boundary of ['query','page','user']) {
  const f=restoration();f.p.scheduleScrollRestore();f.tick();
  if(boundary==='query')f.p.viewState.reset('new query');
  if(boundary==='page'){f.p.pageMounted=false;f.p.viewState.pageRevision++;}
  if(boundary==='user')f.p.cancelScrollRestoreForUser();
  const before=[f.p.viewState.anchorKey,f.p.viewState.anchorIndex,f.p.viewState.anchorItemY];
  f.tick();assert.equal(f.moves.length,1,`${boundary} invalidates the correction frame`);
  assert.deepEqual([f.p.viewState.anchorKey,f.p.viewState.anchorIndex,f.p.viewState.anchorItemY],before);
}
{
  const f=restoration();f.p.restoreKey='online:merged';f.p.viewState.redirects.set('online:merged','online:b');f.p.scheduleScrollRestore();f.tick();f.tick();
  assert.equal(f.p.viewState.anchorKey,'online:b');
  const neighbor=restoration();neighbor.p.restoreKey='online:removed';neighbor.p.viewState.anchorNeighbors=['online:gone','online:c','online:a'];
  neighbor.p.scheduleScrollRestore();neighbor.tick();neighbor.tick();assert.equal(neighbor.p.viewState.anchorKey,'online:c');
  const late=restoration();late.setHeight(0);late.p.scheduleScrollRestore();late.tick();late.tick();
  assert.equal(late.p.scrollRestored,false);late.setHeight(100);late.tick();late.tick();assert.equal(late.p.scrollRestored,true);
}
console.log('R7 layout-key resolution, mid-layout list changes, query/page guards, user cancellation, programmatic callbacks, merge/neighbors and late layout PASS');

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
console.log('R1 display rank: schema2 current verification only; stale/v1/target-only/storage-refresh facts never grant or revoke whole-book readability PASS');

// R3 safe branch explanations are rendered on both partial and stopped-empty
// surfaces; raw query-owned errors are never rendered by these methods.
{
  const FailurePage=productionMotionMethods(new URL('../entry/src/main/ets/features/search/SearchPage.ets',import.meta.url),
    ['partialSearchFailure','searchFailureMessage'],{});
  for(const kind of ['results','empty','error']) {
    const owner=Object.assign(new FailurePage(),{presentation:{kind,localSearchFailed:true,sourceListFailed:true,
      localFailureMessage:'读取超时，请重试',sourceListFailureMessage:'本地数据暂时无法读取，请稍后重试',
      localFailureReason:'secret raw response',sourceListFailureReason:'https://private.example/token'}});
    const text=owner.partialSearchFailure();assert.ok(text.includes('本地检索：读取超时'));
    assert.ok(text.includes('书源列表：本地数据暂时无法读取'));assert.ok(!text.includes('secret')&&!text.includes('private.example'));
    if(kind==='error')assert.equal(owner.searchFailureMessage(),text);
  }
  assert.match(page,/\.onDisAppear\(\(\): void => \{ this\.listMounted = false/,'use the declared ArkUI List lifecycle callback');
}
console.log('R3 partial/stopped-empty/error safe classified messages and SDK disappearance hook PASS');

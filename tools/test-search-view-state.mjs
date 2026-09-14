import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { searchResultRelevance } from '../entry/src/main/ets/features/search/SearchResultRelevance.ts';
import { searchCandidateRank } from '../entry/src/main/ets/features/search/SearchCandidatePolicy.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(repo, path), 'utf8');
const page = read('entry/src/main/ets/features/search/SearchPage.ets');
const classes = page.slice(page.indexOf('@Observed\nclass SearchBookGroup'), page.indexOf('/**\n * Figma-backed Book Search'))
  .replace('@Observed\n', '');
const source = stripTypeScriptTypes(`${read('entry/src/main/ets/features/search/SearchViewState.ts')}\n${classes}\nexport { SearchBookGroup, SearchResultDataSource };`);
const { SearchBookGroup, SearchResultDataSource, SearchViewState } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const group = (key, title = key) => new SearchBookGroup({ sourceId: 'source-a', bookId: key,
  title, author: '作者', groupKey: key }, 1, false);
const ds = new SearchResultDataSource();
const events = [];
ds.registerDataChangeListener({ onDataChange: i => events.push(['change', i]),
  onDataDelete: i => events.push(['delete', i]), onDataAdd: i => events.push(['add', i]),
  onDataReloaded: () => assert.fail('streaming metadata must not reload the list') });
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
assert.deepEqual(events, [['change', 1], ['add', 3]]);
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
navigation.category = '在线'; navigation.keywordDraft = '草稿'; navigation.historyExpanded = true;
navigation.anchorKey = 'b'; navigation.anchorIndex = 1; navigation.anchorItemY = -23;
const remountedPageState = navigation;
assert.equal(remountedPageState.anchorItemY, -23);
assert.equal(remountedPageState.category, '在线');
navigation.reset('下一次查询');
assert.equal(navigation.anchorKey, ''); assert.equal(navigation.anchorItemY, 0);
assert.equal(navigation.keywordDraft, '下一次查询'); assert.equal(navigation.rank('c'), 0);
assert.match(page, /@Prop group: SearchBookGroup/);
assert.match(page, /maintainVisibleContentPosition\(true\)/);
assert.match(page, /currentY - this\.restoreItemY/);
console.log('search stable rows, enrichment and navigation state: PASS');

// PH25: execute the real page grouping method over progressively arriving sources.
const Page = productionMotionMethods(process.env.READER_SEARCH_RELEVANCE_SOURCE ?? new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url),
  ['groupResults', 'resultGroupKey', 'normalizedBookKey', 'saveScrollAnchor', 'refreshVisibleResults', 'publishVisibleGroups'],
  { SearchBookGroup, searchResultRelevance, searchCandidateRank });
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
  resultDataSource: new SearchResultDataSource(), measureHistory() {} });
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
incremental.registerDataChangeListener({ onDataChange() { changedRows++; }, onDataAdd() { addedRows++; },
  onDataDelete() {}, onDataReloaded() { assert.fail('no full reload'); } });
incremental.replace(Array.from({ length: 4000 }, (_, i) => group(`book-${i}`)));
changedRows = 0; addedRows = 0;
const batch = Array.from({ length: 4001 }, (_, i) => group(`book-${i}`));
batch[211].sourceCount = 2;
incremental.replace(batch);
assert.equal(changedRows, 1); assert.equal(addedRows, 1);
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

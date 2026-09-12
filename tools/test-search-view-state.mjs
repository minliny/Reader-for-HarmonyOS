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
assert.deepEqual(events, [['change', 0], ['change', 1], ['change', 2], ['add', 3]]);
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

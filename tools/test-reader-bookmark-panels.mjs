import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

async function fullProjectionCase() {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { projectReaderDirectoryEntries } = await import('../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts');
  const { projectReaderBookmarkRows, readerBookmarkLoadState } = await import('../entry/src/main/ets/features/reading/ReaderBookmarkProjection.ts');
  const Full = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/FullDirectoryPanel.ets', import.meta.url),
    'FullDirectoryPanel', ['switchTab', 'rebuildProjection', 'applySearch', 'handleControl', 'selectBookmark'],
    { projectReaderDirectoryEntries, projectReaderBookmarkRows, readerBookmarkLoadState });
  const entries = [
    { index: 1, title: 'first', bookmarks: [{ time: 1, chapterIndex: 1, chapterOffset: 23, chapterTitle: 'first', content: 'needle' }] },
    { index: 7, title: 'last', bookmarks: [{ time: 2, chapterIndex: 7, chapterOffset: 89, chapterTitle: 'last', content: 'other' }] },
  ];
  const owner = Object.assign(new Full(), { admittedEntries: entries, mangaSearch: false, ascending: true,
    searchQuery: 'needle', beginListPositioning() {}, onTabChange() {}, scheduleProjectionTopScroll() {}, navigationActive: true });
  let writtenTab;
  Object.defineProperty(owner, 'activeTab', { configurable: true, get: () => 'directory', set: value => { writtenTab = value; } });
  owner.switchTab('bookmarks');
  assert.equal(writtenTab, 'bookmarks'); assert.equal(owner.navigationActive, false);
  assert.deepEqual(owner.projectedEntries, []);
  assert.deepEqual(owner.projectedBookmarks.map(row => row.chapterOffset), [23], 'projection uses the explicit new tab despite stale reactive read');
  assert.equal(owner.bookmarkTabLoading, false);

  Object.defineProperty(owner, 'activeTab', { configurable: true, value: 'bookmarks' });
  let writtenQuery;
  Object.defineProperty(owner, 'searchQuery', { configurable: true, get: () => 'other', set: value => { writtenQuery = value; } });
  owner.searchDraft = '  needle  '; owner.applySearch();
  assert.equal(writtenQuery, 'needle'); assert.deepEqual(owner.projectedBookmarks.map(row => row.chapterOffset), [23], 'new trimmed search query is used before reactive publication');

  Object.defineProperty(owner, 'activeTab', { configurable: true, value: 'directory' });
  Object.defineProperty(owner, 'searchQuery', { configurable: true, value: '' });
  let writtenAscending;
  Object.defineProperty(owner, 'ascending', { configurable: true, get: () => true, set: value => { writtenAscending = value; } });
  owner.handleControl('sort');
  assert.equal(writtenAscending, false); assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [7, 1], 'new sort value is explicit rather than reread from old state');

  const selected = [], fallback = [], scope = { sourceId: 'remote', bookId: 'book', chapterIndex: 7, version: 'v1' };
  owner.onSelectBookmark = (...args) => selected.push(args); owner.onSelectChapter = index => fallback.push(index);
  owner.selectBookmark('bookmark-7', 7, 89, scope);
  assert.deepEqual(selected, [['bookmark-7', 7, 89, scope]]); assert.deepEqual(fallback, []);
  owner.onSelectBookmark = undefined; owner.selectBookmark('bookmark-7', 7, 89, scope);
  assert.deepEqual(fallback, [7], 'only an unwired legacy owner uses chapter fallback');
}

const cases = { 'full-projection': fullProjectionCase };
for (const id of selectContractCases({
  'full-projection': { description: 'Actual reachable FullDirectoryPanel tab/query/sort projection under stale reactive reads and exact selection', resources: [] },
})) { await cases[id](); recordContractCasePass(id); }

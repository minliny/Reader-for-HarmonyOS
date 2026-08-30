import assert from 'node:assert/strict';

import {
  projectReaderDirectoryEntries,
} from '../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts';

const entries = Array.from({ length: 25 }, (_unused, index) => ({
  index,
  title: `第 ${index + 1} 章`,
  bookmarks: index === 10 ? [{
    time: 1011,
    chapterIndex: index,
    chapterOffset: 8,
    chapterTitle: `第 ${index + 1} 章`,
    content: '第十一章书签正文',
  }] : [],
}));

const originalOrder = entries.map((entry) => entry.index);
const ascending = projectReaderDirectoryEntries(entries, '', true);
const descending = projectReaderDirectoryEntries(entries, '', false);

assert.deepEqual(ascending.map((entry) => entry.index), originalOrder,
  'ascending must keep the complete 25-chapter order');
assert.deepEqual(descending.map((entry) => entry.index), [...originalOrder].reverse(),
  'descending must reverse every chapter, not only the first visible pool');
assert.equal(descending[6].index, 18, 'chapter 19 must move with the full projection');
assert.equal(descending[14].index, 10, 'chapter 11 must move with the full projection');
assert.equal(descending.at(-1).index, 0, 'chapter 1 must become the final row');
assert.deepEqual(entries.map((entry) => entry.index), originalOrder,
  'projection must not mutate the owner-provided TOC');

assert.deepEqual(projectReaderDirectoryEntries(entries, '第 19 章', false).map((entry) => entry.index), [18]);
// Bookmark-row projection (including excerpt search) moved to
// test-reader-bookmark-projection.mjs against ReaderBookmarkProjection.ts.

console.log('reader directory projection behavior: PASS');

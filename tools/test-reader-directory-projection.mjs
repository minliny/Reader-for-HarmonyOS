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

{
  const original = [
    { index: 7, title: '✿・１００（上）', displayTitle: '１００（上）', contextTitle: '第一部 / 第二卷' },
    { index: 13, title: '100 · 真正副标题', contextTitle: '第三卷' },
  ];
  for (const query of ['100', '１００', '✿', '第二卷']) {
    const actual = projectReaderDirectoryEntries(original, query, true, true);
    assert.ok(actual.includes(original[0]), `${query} searches manga raw/display/path through platform Unicode normalization`);
    assert.equal(actual[0], original[0], 'query projection retains exact canonical objects');
  }
  assert.deepEqual(projectReaderDirectoryEntries(original, '100', true).map(entry => entry.index), [13],
    'legacy novel query semantics remain unchanged');
  assert.equal(original[0].title, '✿・１００（上）');
}

console.log('reader directory projection behavior: PASS');

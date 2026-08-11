import assert from 'node:assert/strict';

import { ReadingChapterWindow } from
  '../entry/src/main/ets/features/reading/ReadingChapterWindow.ts';

function chapter(chapterIndex, contentVersion = `body-${chapterIndex}`) {
  return {
    sourceId: 'local',
    bookId: 'book-1',
    chapterIndex,
    chapterTitle: `Chapter ${chapterIndex}`,
    chapterUrl: undefined,
    content: `Body ${chapterIndex}`,
    images: [],
    contentVersion,
    extractionVia: 'local',
  };
}

const window = new ReadingChapterWindow();
window.configure('local', 'book-1', [10, 20, 30, 40, 50]);
window.setCurrent(chapter(30));
assert.equal(window.admitNeighbour(chapter(20)), true);
assert.equal(window.admitNeighbour(chapter(40)), true);
assert.equal(window.admitNeighbour(chapter(50)), false,
  'the reading session must reject a body outside previous/current/next');
assert.deepEqual(window.retainedChapterIndexes().sort((a, b) => a - b), [20, 30, 40]);

window.setCurrent(chapter(20));
assert.deepEqual(window.retainedChapterIndexes().sort((a, b) => a - b), [20, 30],
  'moving backward must reuse the old current as next and evict the distant chapter');
assert.equal(window.next()?.chapterIndex, 30);
assert.equal(window.previous(), undefined);
window.admitNeighbour(chapter(10));
assert.equal(window.previous()?.chapterIndex, 10);

const returned = window.get(20);
assert.ok(returned);
returned.chapterTitle = 'mutated outside';
assert.equal(window.get(20)?.chapterTitle, 'Chapter 20',
  'the window must own defensive copies of materialized bodies');

assert.throws(() => window.admitNeighbour({ ...chapter(10), bookId: 'other' }), /configured session/);
assert.throws(() => window.configure('local', 'book-1', [1, 1]), /duplicate/);

console.log('reading chapter window: PASS');

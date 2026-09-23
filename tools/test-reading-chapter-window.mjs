import assert from 'node:assert/strict';

import { ReadingChapterWindow } from
  '../entry/src/main/ets/features/reading/ReadingChapterWindow.ts';
import { readingChapterLayoutMap } from '../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';

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
window.configure('local', 'book-1', [0, 10, 20, 30, 40, 50, 60, 70]);
assert.equal(window.position(30), 3);
assert.equal(window.contains(40), true);
assert.equal(window.contains(99), false);
assert.equal(window.adjacentChapterIndex(30, -1), 20);
assert.equal(window.adjacentChapterIndex(30, 1), 40);
assert.equal(window.adjacentChapterIndex(70, 1), undefined);
window.setCurrent(chapter(30));
assert.equal(window.admitNeighbour(chapter(20)), true);
assert.equal(window.admitNeighbour(chapter(40)), true);
assert.equal(window.admitNeighbour(chapter(50)), true);
assert.equal(window.admitNeighbour(chapter(60)), true);
assert.equal(window.admitNeighbour(chapter(70)), false,
  'the reading session must reject a body more than three TOC neighbours away');
assert.deepEqual(window.retainedChapterIndexes().sort((a, b) => a - b), [20, 30, 40, 50, 60]);

window.setCurrent(chapter(20));
assert.deepEqual(window.retainedChapterIndexes().sort((a, b) => a - b), [20, 30, 40, 50],
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
assert.equal(readingChapterLayoutMap(returned), readingChapterLayoutMap(window.get(20)),
  'defensive chapter copies share one text boundary map without sharing mutable DTOs');
const changedBody = { ...returned, content: 'replacement 😀' };
assert.notEqual(readingChapterLayoutMap(changedBody), readingChapterLayoutMap(returned),
  'a replaced body must never reuse a stale inherited text identity');

assert.throws(() => window.admitNeighbour({ ...chapter(10), bookId: 'other' }), /configured session/);
assert.throws(() => window.configure('local', 'book-1', [1, 1]), /duplicate/);

// Budget pressure retains the actual page and nearest bodies; count alone
// cannot authorize retaining seven arbitrarily large chapters.
const bounded = new ReadingChapterWindow(800);
bounded.configure('local', 'book-1', [10, 20, 30, 40, 50]);
bounded.setCurrent({...chapter(30), content: 'x'.repeat(5000)});
assert.equal(bounded.admitNeighbour(chapter(50)), true);
assert.equal(bounded.admitNeighbour(chapter(20)), true);
assert.equal(bounded.admitNeighbour(chapter(40)), true);
assert.deepEqual(bounded.retainedChapterIndexes().sort((a,b)=>a-b), [20,30,40]);
assert.equal(bounded.admitNeighbour({...chapter(10),content:'x'.repeat(1000)}), false);
assert.ok(bounded.get(30), 'optional budget never evicts the actual page');

console.log('reading chapter window: PASS');

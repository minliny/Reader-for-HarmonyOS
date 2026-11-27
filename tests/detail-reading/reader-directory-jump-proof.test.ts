import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderDirectoryJumpProof } from '../../entry/src/main/ets/features/reading/application/ReaderDirectoryJumpProof.ts';
import { ReadingChapterWindow, type ReadingSessionChapter } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import type { ReaderDirectoryTargetProof } from '../../entry/src/main/ets/features/reading/application/ReaderDirectoryTargetProof.ts';

const target: ReaderDirectoryTargetProof = {
  sourceId: 'source', bookId: 'book', chapterIndex: 3, nodeId: 'node-3',
  catalogRevision: 'catalog-1', structureRevision: 'structure-1', url: 'https://example.test/chapter-3',
};
const chapter: ReadingSessionChapter = {
  sourceId: target.sourceId, bookId: target.bookId, chapterIndex: target.chapterIndex,
  chapterTitle: 'Chapter 3', chapterUrl: target.url, content: 'Text.', contentVersion: 'body-1',
  bodyVersion: 'body-1', processingVersion: 'rules-1', images: [], extractionVia: 'rule',
  directoryTargetProof: target,
};

test('a directory proof authorizes the first progress write and expires on the matching chapter receipt', () => {
  const owner = new ReaderDirectoryJumpProof();
  const admitted = owner.admit(chapter, 5, target);
  assert.strictEqual(owner.forProgress(admitted, 5), target);
  owner.acknowledge(5, target, 'book', 3);
  assert.equal(owner.forProgress(admitted, 5), undefined);
});

test('a missing or unrelated receipt preserves the pending first-write proof', () => {
  const owner = new ReaderDirectoryJumpProof();
  const admitted = owner.admit(chapter, 6, target);
  owner.acknowledge(5, target, 'book', 3);
  owner.acknowledge(6, { ...target, catalogRevision: 'prior-catalog' }, 'book', 3);
  owner.acknowledge(6, target, 'other-book', 3);
  owner.acknowledge(6, target, 'book', 4);
  assert.strictEqual(owner.forProgress(admitted, 6), target);
  assert.equal(owner.forProgress(admitted, 5), undefined);
});

test('a cached chapter body cannot replay the directory selection proof after a catalog change', () => {
  const owner = new ReaderDirectoryJumpProof();
  const admitted = owner.admit(chapter, 6, target);
  const window = new ReadingChapterWindow();
  window.configure('source', 'book', [1, 2, 3, 4]);
  window.setCurrent(admitted);
  owner.acknowledge(6, target, 'book', 3);
  assert.equal(window.get(3)?.directoryTargetProof, undefined);
  assert.strictEqual(chapter.directoryTargetProof, target);
});

test('an ordinary chapter load ignores a stale proof carried by the loaded body', () => {
  const owner = new ReaderDirectoryJumpProof();
  const cachedBody = owner.admit(chapter, 7, undefined);
  assert.equal(owner.forProgress(cachedBody, 7), undefined);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readingChapterRetainedBytes, type ReadingSessionChapter, type ReadingSessionImage }
  from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';

test('a ready file-backed illustration contributes its scaled display pixels to chapter retention', () => {
  const chapter: ReadingSessionChapter = { sourceId: 'source', bookId: 'book', chapterIndex: 0, chapterTitle: '',
    chapterUrl: undefined, content: '', contentVersion: 'version', images: [], extractionVia: 'rule' };
  const image: ReadingSessionImage = { source: 'image', baseUrl: undefined, startScalar: 0, endScalar: 1,
    state: 'ready', pixelMap: undefined, fileUri: 'file:///display.png',
    intrinsicWidth: 2000, intrinsicHeight: 1600, displayWidth: 1000, displayHeight: 800, revision: 'image-v1' };
  const ready = readingChapterRetainedBytes({ ...chapter, images: [image] });
  const pending = readingChapterRetainedBytes({ ...chapter, images: [{ ...image, state: 'pending' }] });
  assert.equal(ready - pending, 3_200_000);
});

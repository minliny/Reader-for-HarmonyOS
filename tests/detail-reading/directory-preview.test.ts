import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detailChapterPreview } from '../../entry/src/main/ets/features/reading/presentation/DetailChapterPreview.ts';

test('detail shows the current readable chapter with canonical neighbours, skipping unproven targets', () => {
  const toc = Array.from({ length: 14 }, (_, ordinal) => ({ index: ordinal * 10, title: `章节 ${ordinal}`,
    navigable: ordinal === 8 ? false : ordinal === 9 ? undefined : true }));
  assert.deepEqual(detailChapterPreview(toc, 100, true).map(row => row.index), [60, 70, 100, 110, 120, 130]);
  assert.deepEqual(detailChapterPreview(toc, 71, false).map(row => row.index), [60, 70, 90, 100, 110, 120]);
  assert.deepEqual(detailChapterPreview(toc.slice(0, 3), 100, false).map(row => row.index), [0, 10, 20]);
});

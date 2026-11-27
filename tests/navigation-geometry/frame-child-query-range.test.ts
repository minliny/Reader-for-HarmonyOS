import assert from 'node:assert/strict';
import test from 'node:test';
import { readerFrameChildQueryRange } from '../../entry/src/main/ets/ui/layout/ReaderFrameChildQueryRange.ts';

test('frame child queries classify signed and unsigned empty endpoints as no children', () => {
  assert.equal(readerFrameChildQueryRange(-1, -1, 2048), undefined);
  assert.equal(readerFrameChildQueryRange(0xffffffff, 0xffffffff, 2048), undefined);
  assert.equal(readerFrameChildQueryRange(-1, 0xffffffff, 2048), undefined);
});

test('frame child queries retain the ordinary reported span including the budget boundary', () => {
  assert.deepEqual(readerFrameChildQueryRange(7, 14, 8), { first: 7, last: 14, byMountedIndex: false });
});

test('frame child queries use mounted indices for an absent endpoint or oversized expanded span', () => {
  const mounted = { first: 0, last: -1, byMountedIndex: true };
  assert.deepEqual(readerFrameChildQueryRange(3, 0xffffffff, 2048), mounted);
  assert.deepEqual(readerFrameChildQueryRange(0xffffffff, 16, 2048), mounted);
  assert.deepEqual(readerFrameChildQueryRange(0, 2048, 2048), mounted);
  assert.deepEqual(readerFrameChildQueryRange(7, 6, 2048), mounted);
  assert.deepEqual(readerFrameChildQueryRange(0, 0, 0), mounted);
});

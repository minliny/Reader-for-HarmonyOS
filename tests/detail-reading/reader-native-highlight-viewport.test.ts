import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readerLocalHighlightProjection,
  type ReaderDynamicHighlightRect,
} from '../../entry/src/main/ets/features/reading/ui/ReaderDynamicHighlight.ts';

function ink(top: number, bottom: number): ReaderDynamicHighlightRect {
  return { left: 26, top, right: 54, bottom, color: '#111111', multiply: false };
}

test('a split reader paints the underline at the real viewport bottom', () => {
  assert.deepEqual(readerLocalHighlightProjection([ink(531, 536), ink(552, 556)], 511, 200, 348),
    { rects: [ink(531, 536)], top: 20, height: 5 });
});

test('a clipped mark uses the paragraph-local Canvas offset and visible pixel height', () => {
  assert.deepEqual(readerLocalHighlightProjection([ink(191, 208), ink(542, 555)], 174, 200, 348),
    { rects: [ink(200, 208), ink(542, 548)], top: 26, height: 348 });
});

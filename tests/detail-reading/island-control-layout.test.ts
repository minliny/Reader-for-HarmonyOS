import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readerIslandControlPaint } from '../../entry/src/main/ets/ui/foundation/ReaderIslandControlPaint.ts';
import { readerIslandPlaybackLayout } from '../../entry/src/main/ets/features/reading/ui/ReaderIslandPlaybackLayout.ts';
import {
  readerControlIslandFontAutoScrollDelta,
} from '../../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceGeometry.ts';

test('unavailable island controls have independent paint in every action tone', () => {
  const disabled = readerIslandControlPaint(false);
  for (const tone of ['normal', 'selected', 'stop', 'marked'] as const) {
    const enabled = readerIslandControlPaint(true, tone);
    assert.notEqual(enabled.surface, disabled.surface);
    assert.notEqual(enabled.border, disabled.border);
    assert.notEqual(enabled.ink, disabled.ink);
    assert.deepEqual(readerIslandControlPaint(false, tone), disabled);
  }
});

test('island transport wraps before the icon and three-character label exceed the native target', () => {
  const fonts = { actionSize: 12, actionLineHeight: 18, statusLineHeight: 18 };
  assert.deepEqual(readerIslandPlaybackLayout(320, 1, 3, fonts),
    { columns: 4, rowHeight: 44, statusHeight: 22, height: 84 });
  assert.deepEqual(readerIslandPlaybackLayout(280, 2, 3, fonts),
    { columns: 2, rowHeight: 44, statusHeight: 36, height: 144 });
  assert.deepEqual(readerIslandPlaybackLayout(168, 2, 3, fonts),
    { columns: 1, rowHeight: 44, statusHeight: 36, height: 244 });
});

test('holding or reordering a font horizontally at either edge does not scroll', () => {
  const height = (2388 - 1772) / 3.5;
  const bottomEdgeFont = (2309 - 1772) / 3.5;
  assert.equal(readerControlIslandFontAutoScrollDelta(bottomEdgeFont, height, 0), 0);
  assert.equal(readerControlIslandFontAutoScrollDelta(bottomEdgeFont + 1, height, 1), 0);
  assert.equal(readerControlIslandFontAutoScrollDelta(bottomEdgeFont - 5, height, -5), 0);
  assert.equal(readerControlIslandFontAutoScrollDelta(19, height, 0), 0);
  assert.equal(readerControlIslandFontAutoScrollDelta(24, height, 5), 0);
});

test('an outward vertical font drag still auto-scrolls at the matching edge', () => {
  assert.equal(readerControlIslandFontAutoScrollDelta(176, 176, 8), 10);
  assert.equal(readerControlIslandFontAutoScrollDelta(0, 176, -8), -10);
  assert.equal(readerControlIslandFontAutoScrollDelta(88, 176, 8), 0);
  assert.equal(readerControlIslandFontAutoScrollDelta(88, 176, -8), 0);
});

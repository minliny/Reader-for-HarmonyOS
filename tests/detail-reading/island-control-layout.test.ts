import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readerIslandControlPaint } from '../../entry/src/main/ets/ui/foundation/ReaderIslandControlPaint.ts';
import { readerIslandPlaybackLayout } from '../../entry/src/main/ets/features/reading/ui/ReaderIslandPlaybackLayout.ts';

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

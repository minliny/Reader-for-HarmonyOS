import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  READER_BOOKMARK_WELL_BLEED_VP,
  READER_BOOKMARK_WELL_FADE_RANGE_VP,
  READER_BOOKMARK_WELL_TINT_DAY,
  READER_BOOKMARK_WELL_TINT_NIGHT,
  readerBookmarkWellHeight,
  readerBookmarkWellOpacity,
  readerBookmarkWellTint,
} from '../../entry/src/main/ets/features/reading/presentation/ReaderBookmarkWellPaint.ts';

test('bookmark well tint matches day and night reading schemes', () => {
  assert.equal(readerBookmarkWellTint(true), READER_BOOKMARK_WELL_TINT_DAY);
  assert.equal(readerBookmarkWellTint(false), READER_BOOKMARK_WELL_TINT_NIGHT);
});

test('bookmark well opacity ramps linearly over pull offset and clamps safely', () => {
  assert.equal(readerBookmarkWellOpacity(0), 0);
  assert.equal(readerBookmarkWellOpacity(-4), 0);
  assert.equal(readerBookmarkWellOpacity(Number.NaN), 0);
  assert.equal(readerBookmarkWellOpacity(READER_BOOKMARK_WELL_FADE_RANGE_VP / 2), 0.5);
  assert.equal(readerBookmarkWellOpacity(READER_BOOKMARK_WELL_FADE_RANGE_VP), 1);
  assert.equal(readerBookmarkWellOpacity(READER_BOOKMARK_WELL_FADE_RANGE_VP * 4), 1);
});

test('bookmark well spans from y=0 across status bar, pull offset, and corner bleed', () => {
  assert.equal(readerBookmarkWellHeight(38, 0), 38 + READER_BOOKMARK_WELL_BLEED_VP);
  assert.equal(readerBookmarkWellHeight(38, 24), 38 + 24 + READER_BOOKMARK_WELL_BLEED_VP);
  assert.equal(readerBookmarkWellHeight(-10, -5), READER_BOOKMARK_WELL_BLEED_VP);
});

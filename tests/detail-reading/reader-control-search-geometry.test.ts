import assert from 'node:assert/strict';
import { test } from 'node:test';
import { READER_CONTROL_SEARCH_COMPACT_PLACEHOLDER, READER_CONTROL_SEARCH_PLACEHOLDER,
  readerControlSearchFieldChrome, sampleReaderControlSearch,
  type ReaderControlSearchNaturalSize } from '../../entry/src/main/ets/features/reading/ui/ReaderControlSearchGeometry.ts';
import { readerControlCandidateWidths } from '../../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts';
import { ReaderInsetsVp, ReaderRectVp, ReaderWindowMetricsSnapshot } from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

function near(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-6, `expected ${expected}, received ${actual}`);
}

test('the 32/36vp query capsules retain the Quick to Full query and first-result anchors', () => {
  for (const progress of [0, .25, .5, .75, 1]) {
    const frame = sampleReaderControlSearch(progress, 286 + 52 * progress, 190 + 476 * progress);
    near(frame.field.x, 66.102 + (12 - 66.102) * progress);
    near(frame.field.y, 12.993 + (11 - 12.993) * progress);
    near(frame.field.height, 32 + 4 * progress);
    near(frame.action.height, frame.field.height);
    near(frame.action.x - frame.field.x - frame.field.width, 8);
    near(frame.action.x + frame.action.width, 274.102 + (326 - 274.102) * progress);
    near(frame.results.y, frame.queryDivider.y + 1);
    assert.ok(frame.firstResult.y >= 0);
    near(frame.results.y + frame.firstResult.y, 50.993 + (58 - 50.993) * progress);
  }
  assert.equal(sampleReaderControlSearch(0, 286, 190).actionLabelOpacity, 0);
  assert.equal(sampleReaderControlSearch(1, 338, 666).actionLabelOpacity, 1);
});

test('the 320vp width candidates can fit scaled search chrome and the Quick return action', () => {
  const viewport = new ReaderRectVp(0, 0, 320, 680);
  const metrics = new ReaderWindowMetricsSnapshot(viewport, viewport, new ReaderInsetsVp(0, 0, 0, 0));
  const widths = readerControlCandidateWidths(320, 680, false, metrics);
  assert.ok(widths.length > 0);
  const quickNatural: ReaderControlSearchNaturalSize = {
    fieldHeightVp: 38, actionWidthVp: 36, placeholderWidthVp: 156, inputHeightVp: 36,
    titleHeightVp: 27, snippetHeightVp: 56, rowHeightVp: 96,
    loadMoreHeightVp: 0, loadMoreWidthVp: 0, statusHeightVp: 36, backHeightVp: 38, backWidthVp: 63,
  };
  const fullNatural: ReaderControlSearchNaturalSize = { ...quickNatural, fieldHeightVp: 40, actionWidthVp: 84, rowHeightVp: 114 };
  const viable = widths.find((width) => {
    const quick = sampleReaderControlSearch(0, width.quickContentWidthVp, 190, quickNatural);
    return quick.field.width - readerControlSearchFieldChrome(true) >= 26 &&
      quick.field.width - readerControlSearchFieldChrome(false) >= 52;
  });
  assert.ok(viable, 'reserve one 2× input glyph and both glyphs of the compact placeholder');
  const quick = sampleReaderControlSearch(0, viable.quickContentWidthVp, 190, quickNatural);
  const full = sampleReaderControlSearch(1, viable.fullContentWidthVp, 666, fullNatural);
  assert.ok(quick.field.x >= quick.back.x + quick.back.width + 4);
  assert.equal(quick.placeholder, READER_CONTROL_SEARCH_COMPACT_PLACEHOLDER);
  assert.equal(full.placeholder, READER_CONTROL_SEARCH_COMPACT_PLACEHOLDER);
  assert.equal(sampleReaderControlSearch(1, 338, 666, fullNatural).placeholder, READER_CONTROL_SEARCH_PLACEHOLDER);
  assert.equal(full.action.width, 84);
  assert.equal(full.action.height, 40);
  assert.ok(full.field.width - readerControlSearchFieldChrome(true) >= 26);
  assert.ok(full.results.y > sampleReaderControlSearch(1, viable.fullContentWidthVp, 666).results.y);
});

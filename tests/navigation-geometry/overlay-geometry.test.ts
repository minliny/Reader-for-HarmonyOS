import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderInsetsVp, ReaderKeyboardAreaVp, ReaderRectVp, ReaderWindowMetricsSnapshot }
  from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { readerOverlayChoiceRowHeight, readerOverlayListHeight, readerOverlayPanel, readerOverlayViewport }
  from '../../entry/src/main/ets/ui/layout/ReaderOverlayGeometry.ts';

test('a 320vp portrait overlay uses the window safe edges on its first frame', () => {
  const window = new ReaderRectVp(80, 50, 320, 742);
  const metrics = new ReaderWindowMetricsSnapshot(window, window, new ReaderInsetsVp(0, 32, 0, 0),
    new ReaderInsetsVp(18, 0, 0, 0), new ReaderInsetsVp(0, 0, 11, 24));
  const viewport = readerOverlayViewport(metrics, undefined, new ReaderInsetsVp(8, 8, 8, 8));
  assert.deepEqual(viewport, new ReaderRectVp(26, 40, 275, 670));
  assert.deepEqual(readerOverlayPanel(viewport, 350, 130, 'bottom'), new ReaderRectVp(26, 580, 275, 130));
});

test('a resized host intersects window bounds and does not subtract the keyboard or safe area twice', () => {
  const window = new ReaderRectVp(0, 0, 768, 420);
  const metrics = new ReaderWindowMetricsSnapshot(window, window, new ReaderInsetsVp(0, 24, 0, 0),
    new ReaderInsetsVp(22, 0, 35, 0), new ReaderInsetsVp(0, 0, 0, 20));
  metrics.ready = true;
  metrics.keyboardArea = new ReaderKeyboardAreaVp(true, true, [new ReaderRectVp(0, 270, 768, 150)]);
  const host = new ReaderRectVp(24, 32, 704, 238);
  assert.deepEqual(readerOverlayViewport(metrics, host), host);
  assert.deepEqual(readerOverlayViewport(metrics), new ReaderRectVp(22, 24, 711, 246));
});

test('an anchor beside a floating keyboard keeps its vertical budget', () => {
  const window = new ReaderRectVp(0, 0, 768, 420);
  const metrics = new ReaderWindowMetricsSnapshot(window, window);
  metrics.ready = true;
  metrics.keyboardArea = new ReaderKeyboardAreaVp(true, true, [new ReaderRectVp(410, 160, 320, 190)]);
  assert.equal(readerOverlayViewport(metrics, undefined, undefined, new ReaderRectVp(60, 130, 140, 44)).height, 420);
  assert.equal(readerOverlayViewport(metrics).height, 160);
});

test('anchored panels flip above the trigger or scroll next to it when neither lane can show the full list', () => {
  const viewport = new ReaderRectVp(12, 40, 290, 210);
  assert.deepEqual(readerOverlayPanel(viewport, 130, 80, 'anchor-end', new ReaderRectVp(200, 182, 130, 40), 5),
    new ReaderRectVp(172, 97, 130, 80));
  assert.deepEqual(readerOverlayPanel(viewport, 180, 220, 'anchor-start', new ReaderRectVp(18, 105, 36, 44), 5),
    new ReaderRectVp(18, 154, 180, 96));
  assert.deepEqual(readerOverlayPanel(viewport, 140, 80, 'anchor-overlap-start', new ReaderRectVp(18, 100, 140, 44)),
    new ReaderRectVp(18, 100, 140, 80));
});

test('intrinsic list height includes top and bottom padding, two borders and gaps only between rows', () => {
  assert.equal(readerOverlayListHeight(44, 42, 1, 6, 8, 10, 1, 24), 130);
  assert.equal(readerOverlayListHeight(44, 53, 2, 6, 8, 10, 1, 24), 200);
  assert.equal(readerOverlayListHeight(44, 61, 5, 6, 8, 10, 1, 24), 417);
  assert.equal(readerOverlayListHeight(44, 42, 0, 6, 8, 10, 1, 24), 88);
});

test('1.6× and 2× short settings menus budget the actual scaled row boxes and their dividers', () => {
  const popupRow = readerOverlayChoiceRowHeight(44, 18, 1.6);
  assert.equal(readerOverlayListHeight(0, popupRow, 1, 0, 0, 0, 1, 0), 57);
  const largePopupRow = readerOverlayChoiceRowHeight(44, 18, 2);
  assert.equal(readerOverlayListHeight(0, largePopupRow, 2, 0, 0, 0, 1, 0), 126);
  const tabletRow = readerOverlayChoiceRowHeight(44, 20, 1.6, 10);
  assert.equal(readerOverlayListHeight(0, tabletRow, 2, 1, 0, 0, 1, 0), 115);
  const largeTabletRow = readerOverlayChoiceRowHeight(44, 20, 2, 10);
  assert.equal(readerOverlayListHeight(0, largeTabletRow, 2, 1, 0, 0, 1, 0), 131);
});

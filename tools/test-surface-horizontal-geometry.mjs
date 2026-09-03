import assert from 'node:assert/strict';

import {
  ReaderInsetsVp,
  ReaderRectVp,
  ReaderWindowMetricsSnapshot,
  readerContentSafeHorizontal,
  readerContentSafeTop,
  readerInteractiveSafeBottom,
  readerInteractiveSafeInsets,
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
  readerVisualSafeBottom,
  readerVisualSafeInsets,
} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';

const VIEWPORT_WIDTHS = [320, 360, 365.71, 390, 500, 599, 600, 720, 760, 840];
const EPSILON = 0.000001;

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= EPSILON, `${message}: ${actual} !== ${expected}`);
}

function assertFrame(width, safeLeft, safeRight, spec, frame) {
  const leftBoundary = Math.min(width, Math.max(safeLeft, spec.leftGap));
  const rightBoundary = Math.max(
    leftBoundary,
    width - Math.max(safeRight, spec.rightGap),
  );
  assert.ok(Number.isFinite(frame.left));
  assert.ok(Number.isFinite(frame.right));
  assert.ok(Number.isFinite(frame.width));
  assert.ok(frame.width >= 0);
  assert.ok(frame.left + EPSILON >= leftBoundary);
  assert.ok(frame.left + frame.width <= rightBoundary + EPSILON);
  close(frame.left + frame.width + frame.right, width, 'frame fills its container equation');
}

for (const width of VIEWPORT_WIDTHS) {
  const centered = new SurfaceWidthSpec(364, 13, 13, 'center');
  assertFrame(width, 0, 0, centered, resolveHorizontalFrame(width, 0, 0, centered));

  for (const alignment of ['center', 'left', 'right']) {
    const asymmetric = new SurfaceWidthSpec(720, 26, 14, alignment);
    const frame = resolveHorizontalFrame(width, 37.25, 9.5, asymmetric);
    assertFrame(width, 37.25, 9.5, asymmetric, frame);
  }
}

const narrowReference = resolveHorizontalFrame(
  320,
  0,
  0,
  new SurfaceWidthSpec(720, 0, 0, 'center'),
);
assert.equal(narrowReference.width, 320, 'reference width is a cap, not a viewport fallback');

const narrowWithGaps = resolveHorizontalFrame(
  320,
  0,
  0,
  new SurfaceWidthSpec(720, 13, 13, 'center'),
);
assert.equal(narrowWithGaps.width, 294);

const leftFrame = resolveHorizontalFrame(
  760,
  40,
  10,
  new SurfaceWidthSpec(340, 0, 25, 'left'),
);
const centerFrame = resolveHorizontalFrame(
  760,
  40,
  10,
  new SurfaceWidthSpec(340, 0, 25, 'center'),
);
const rightFrame = resolveHorizontalFrame(
  760,
  40,
  10,
  new SurfaceWidthSpec(340, 0, 25, 'right'),
);
close(leftFrame.left, 40, 'left alignment');
close(centerFrame.left, 217.5, 'center alignment');
close(rightFrame.left, 395, 'right alignment');

const malformedFrame = resolveHorizontalFrame(
  Number.NaN,
  Number.POSITIVE_INFINITY,
  -12,
  new SurfaceWidthSpec(Number.POSITIVE_INFINITY, Number.NaN, -4, 'center'),
);
assert.deepEqual({ ...malformedFrame }, { left: 0, right: 0, width: 0 });

const metrics = new ReaderWindowMetricsSnapshot(
  new ReaderRectVp(),
  new ReaderRectVp(),
  new ReaderInsetsVp(4, 12, 6, 8),
  new ReaderInsetsVp(20, 10, 3, 24),
  new ReaderInsetsVp(30, 2, 40, 32),
  new ReaderInsetsVp(1, 0, 2, 16),
  new ReaderInsetsVp(5, 0, 7, 50),
);

assert.deepEqual({ ...readerVisualSafeInsets(metrics) }, {
  left: 20,
  top: 12,
  right: 6,
  bottom: 24,
});
assert.equal(readerVisualSafeBottom(metrics), 24, 'visual bottom includes the cutout');
assert.equal(readerContentSafeTop(metrics), 12, 'legacy top helper remains compatible');
assert.equal(readerContentSafeHorizontal(metrics), 20, 'legacy horizontal helper stays symmetric');
assert.equal(readerInteractiveSafeLeft(metrics), 30, 'interactive left includes gestures');
assert.equal(readerInteractiveSafeRight(metrics), 40, 'interactive right includes gestures');
assert.deepEqual({ ...readerInteractiveSafeInsets(metrics) }, {
  left: 30,
  top: 12,
  right: 40,
  bottom: 32,
});
assert.deepEqual({ ...readerInteractiveSafeInsets(metrics, true) }, {
  left: 30,
  top: 12,
  right: 40,
  bottom: 50,
});
assert.equal(readerInteractiveSafeBottom(metrics), 32);
assert.equal(readerInteractiveSafeBottom(metrics, true), 50);

const bottomCutoutMetrics = new ReaderWindowMetricsSnapshot(
  new ReaderRectVp(),
  new ReaderRectVp(),
  new ReaderInsetsVp(0, 0, 0, 8),
  new ReaderInsetsVp(0, 0, 0, 48),
  new ReaderInsetsVp(0, 0, 0, 12),
  new ReaderInsetsVp(0, 0, 0, 16),
);
assert.equal(
  readerInteractiveSafeBottom(bottomCutoutMetrics),
  48,
  'interactive bottom includes a dominant cutout',
);

console.log(`surface horizontal geometry: PASS (${VIEWPORT_WIDTHS.length} viewport widths)`);

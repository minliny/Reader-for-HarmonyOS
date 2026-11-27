import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderBottomSafeAreaMeasurement }
  from '../../entry/src/main/ets/app/ReaderBottomSafeAreaMeasurement.ts';
import { ReaderInsetsVp, ReaderRectVp, ReaderWindowMetricsSnapshot, readerInteractiveSafeBottom,
  readerStableInteractiveSafeBottom, readerStableVisualSafeBottom, readerVisualSafeBottom }
  from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

const empty = { system: 0, cutout: 0, gesture: 0, navigation: 0 };
const app = { system: 18, cutout: 0, gesture: 20, navigation: 24 };

test('immersive hide and the zero and partial avoid-area reports during app reveal preserve the bottom baseline', () => {
  const measurement = new ReaderBottomSafeAreaMeasurement();
  const base = measurement.observe('display-portrait', false, app, 'stable');
  assert.deepEqual(base, { visual: 18, interactive: 24, restored: true });
  for (const sample of [empty, { ...empty, gesture: 20 }]) {
    for (const phase of ['hidden', 'revealing'] as const) {
      assert.deepEqual(measurement.observe('display-portrait', false, sample, phase),
        { visual: 18, interactive: 24, restored: false });
    }
  }
  assert.deepEqual(measurement.observe('display-portrait', false, app, 'revealing'), base);
});

test('a settled app zero replaces the baseline while failed reads preserve the last supported value', () => {
  const measurement = new ReaderBottomSafeAreaMeasurement();
  measurement.observe('floating', false, app, 'stable');
  assert.deepEqual(measurement.observe('floating', false, { system: 0 }, 'stable'),
    { visual: 0, interactive: 24, restored: true });
  assert.deepEqual(measurement.observe('floating', false, empty, 'stable'),
    { visual: 0, interactive: 0, restored: true });
  assert.deepEqual(measurement.observe('floating', false, empty, 'hidden', { navigation: 20 }),
    { visual: 0, interactive: 0, restored: false });
  assert.deepEqual(measurement.observe('floating', false, empty, 'revealing', { navigation: 20 }),
    { visual: 0, interactive: 0, restored: true });
});

test('a new geometry never inherits a foreign bottom band but can seed its own from hidden-area readback', () => {
  const measurement = new ReaderBottomSafeAreaMeasurement();
  measurement.observe('same-display-portrait', false, app, 'stable');
  assert.deepEqual(measurement.observe('same-display-landscape', true, empty, 'hidden'),
    { visual: 0, interactive: 0, restored: false });
  assert.deepEqual(measurement.observe('same-display-landscape', true, empty, 'hidden', { navigation: 14 }),
    { visual: 0, interactive: 14, restored: false });
  assert.deepEqual(measurement.observe('same-display-portrait', false, empty, 'hidden'),
    { visual: 18, interactive: 24, restored: false });
  measurement.reset();
  assert.deepEqual(measurement.observe('same-display-portrait', false, empty, 'hidden'),
    { visual: 0, interactive: 0, restored: false });
});

test('normal layout can use the stable band without changing raw immersive or keyboard geometry', () => {
  const rect = new ReaderRectVp(0, 0, 390, 844);
  const metrics = new ReaderWindowMetricsSnapshot(rect, rect);
  metrics.stableSafeBottom = 24;
  metrics.stableVisualSafeBottom = 18;
  metrics.keyboardInsets = new ReaderInsetsVp(0, 0, 0, 240);
  assert.equal(readerVisualSafeBottom(metrics), 0);
  assert.equal(readerInteractiveSafeBottom(metrics), 0);
  assert.equal(readerStableVisualSafeBottom(metrics), 18);
  assert.equal(readerStableInteractiveSafeBottom(metrics), 24);
  assert.equal(readerStableInteractiveSafeBottom(metrics, true), 240);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderTopSafeAreaMeasurement }
  from '../../entry/src/main/ets/app/ReaderTopSafeAreaMeasurement.ts';
import { ReaderInsetsVp, ReaderRectVp, ReaderWindowMetricsSnapshot, readerContentSafeTop,
  readerInteractiveSafeTop, readerStableContentSafeTop, readerStableInteractiveSafeTop,
  readerStableVisualSafeTop, readerVisualSafeTop }
  from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

const empty = { system: 0, cutout: 0, gesture: 0, navigation: 0 };
const app = { system: 42, cutout: 18, gesture: 0, navigation: 0 };

test('immersive hide and the zero and partial avoid-area reports during app reveal preserve the top baseline', () => {
  const measurement = new ReaderTopSafeAreaMeasurement();
  const base = measurement.observe('display-portrait', false, app, 'stable');
  assert.deepEqual(base, { visual: 42, interactive: 42, restored: true });
  for (const sample of [empty, { ...empty, cutout: 18 }, { ...empty, system: 24, cutout: 18 }]) {
    for (const phase of ['hidden', 'revealing'] as const) {
      assert.deepEqual(measurement.observe('display-portrait', false, sample, phase),
        { visual: 42, interactive: 42, restored: false });
    }
  }
  assert.deepEqual(measurement.observe('display-portrait', false, app, 'revealing'), base);
});

test('a settled app zero replaces the top baseline while failed reads preserve the last supported value', () => {
  const measurement = new ReaderTopSafeAreaMeasurement();
  measurement.observe('floating', false, app, 'stable');
  assert.deepEqual(measurement.observe('floating', false, { system: 0 }, 'stable'),
    { visual: 18, interactive: 18, restored: true });
  assert.deepEqual(measurement.observe('floating', false, empty, 'stable'),
    { visual: 0, interactive: 0, restored: true });
  assert.deepEqual(measurement.observe('floating', false, empty, 'hidden', { system: 42 }),
    { visual: 0, interactive: 0, restored: false });
  assert.deepEqual(measurement.observe('floating', false, empty, 'revealing', { system: 42 }),
    { visual: 0, interactive: 0, restored: true });
});

test('a new geometry never inherits a foreign top band but can seed its own from hidden-area readback', () => {
  const measurement = new ReaderTopSafeAreaMeasurement();
  measurement.observe('same-display-portrait', false, app, 'stable');
  assert.deepEqual(measurement.observe('same-display-landscape', true, empty, 'hidden'),
    { visual: 0, interactive: 0, restored: false });
  assert.deepEqual(measurement.observe('same-display-landscape', true, empty, 'hidden', { system: 28 }),
    { visual: 28, interactive: 28, restored: false });
  assert.deepEqual(measurement.observe('same-display-portrait', false, empty, 'hidden'),
    { visual: 42, interactive: 42, restored: false });
  measurement.reset();
  assert.deepEqual(measurement.observe('same-display-portrait', false, empty, 'hidden'),
    { visual: 0, interactive: 0, restored: false });
});

test('normal top layout can use the stable band without changing raw immersive or keyboard geometry', () => {
  const rect = new ReaderRectVp(0, 0, 390, 844);
  const metrics = new ReaderWindowMetricsSnapshot(rect, rect);
  metrics.stableSafeTop = 44;
  metrics.stableVisualSafeTop = 42;
  metrics.keyboardInsets = new ReaderInsetsVp(0, 80, 0, 0);
  assert.equal(readerVisualSafeTop(metrics), 0);
  assert.equal(readerContentSafeTop(metrics), 0);
  assert.equal(readerInteractiveSafeTop(metrics), 0);
  assert.equal(readerStableVisualSafeTop(metrics), 42);
  assert.equal(readerStableContentSafeTop(metrics), 42);
  assert.equal(readerStableInteractiveSafeTop(metrics), 44);
  assert.equal(readerStableInteractiveSafeTop(metrics, true), 80);
});

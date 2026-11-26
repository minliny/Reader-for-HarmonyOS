import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createDefaultReaderAppearanceSnapshot,
  ReaderCustomFontDescriptor,
  stepReaderAppearanceMetric,
} from '../../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts';
import { createCoreReadingLayout } from '../../entry/src/main/ets/features/reading/application/ReadingMeasurementFacts.ts';
import { createNativeReadingPaginationLayoutSignature } from '../../entry/src/main/ets/features/reading/ui/ReaderAppearanceRenderStyle.ts';
import {
  createReaderWindowMetricsLayoutKey,
  ReaderReadingLayoutSnapshot,
} from '../../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts';

test('appearance steps preserve the five interaction bounds', () => {
  const appearance = createDefaultReaderAppearanceSnapshot();
  assert.equal(stepReaderAppearanceMetric({ ...appearance, fontSize: 13 }, 'fontSize', -1).fontSize, 12);
  assert.equal(stepReaderAppearanceMetric({ ...appearance, fontSize: 39 }, 'fontSize', 1).fontSize, 40);
  assert.equal(stepReaderAppearanceMetric(
    { ...appearance, lineHeightMultiplier: 1.23 }, 'lineHeightMultiplier', -1,
  ).lineHeightMultiplier, 1.2);
  assert.equal(stepReaderAppearanceMetric(
    { ...appearance, lineHeightMultiplier: 2.77 }, 'lineHeightMultiplier', 1,
  ).lineHeightMultiplier, 2.8);
  assert.equal(stepReaderAppearanceMetric(
    { ...appearance, paragraphSpacing: 0 }, 'paragraphSpacing', -1,
  ).paragraphSpacing, 0);
  assert.equal(stepReaderAppearanceMetric(
    { ...appearance, paragraphSpacing: 31 }, 'paragraphSpacing', 1,
  ).paragraphSpacing, 32);
  assert.equal(stepReaderAppearanceMetric({ ...appearance, letterSpacing: -1.75 }, 'letterSpacing', -1).letterSpacing, -2);
  assert.equal(stepReaderAppearanceMetric({ ...appearance, letterSpacing: 3.75 }, 'letterSpacing', 1).letterSpacing, 4);
  assert.equal(stepReaderAppearanceMetric(
    { ...appearance, pageMarginOffset: -11 }, 'pageMarginOffset', -1,
  ).pageMarginOffset, -12);
  assert.equal(stepReaderAppearanceMetric(
    { ...appearance, pageMarginOffset: 23 }, 'pageMarginOffset', 1,
  ).pageMarginOffset, 24);
});

test('appearance steps preserve rounding, missing margin defaults, and invalid-value handling', () => {
  const appearance = createDefaultReaderAppearanceSnapshot();
  assert.equal(stepReaderAppearanceMetric(appearance, 'fontSize', 1).fontSize, 20);
  assert.equal(stepReaderAppearanceMetric(appearance, 'paragraphSpacing', -1).paragraphSpacing, 14);
  assert.equal(stepReaderAppearanceMetric(appearance, 'lineHeightMultiplier', 1).lineHeightMultiplier, 2.04);
  assert.equal(stepReaderAppearanceMetric(
    { ...appearance, letterSpacing: 0.123 }, 'letterSpacing', -1,
  ).letterSpacing, -0.38);
  assert.equal(stepReaderAppearanceMetric(appearance, 'pageMarginOffset', 1).pageMarginOffset, 2);
  assert.equal(stepReaderAppearanceMetric(appearance, 'pageMarginOffset', -1).pageMarginOffset, -2);
  assert.equal(appearance.pageMarginOffset, undefined);
  assert.equal(stepReaderAppearanceMetric({ ...appearance, fontSize: Infinity }, 'fontSize', 1).fontSize, 40);
  assert.throws(
    () => stepReaderAppearanceMetric({ ...appearance, letterSpacing: NaN }, 'letterSpacing', 1),
    { name: 'RangeError', message: 'letterSpacing must be a finite number' },
  );
});

test('Core rounds viewport axes while native pagination retains the original measurements', () => {
  const layout = new ReaderReadingLayoutSnapshot('expanded', 760.25, 960.75, 28, 11, 35, 12, 1.5);
  const appearance = {
    ...createDefaultReaderAppearanceSnapshot(),
    font: 'custom' as const,
    customFont: new ReaderCustomFontDescriptor('Example', 'ExampleFamily', '/private/example.otf', 'fixture'),
    lineHeightMultiplier: 2,
    paragraphSpacing: 9,
    indent: 'firstLine' as const,
    letterSpacing: -0.5,
    alignment: 'start' as const,
  };
  const core = createCoreReadingLayout(layout.viewportWidth, layout.viewportHeight, 1.5, 36);
  assert.deepEqual([core.viewportWidth, core.viewportHeight, core.fontScale, core.lineHeight], [760, 961, 1.5, 36]);
  const minimum = createCoreReadingLayout(0, 0.25, 1, 18);
  assert.deepEqual([minimum.viewportWidth, minimum.viewportHeight], [1, 1]);
  assert.equal(createNativeReadingPaginationLayoutSignature(layout, appearance),
    'native-paragraph-v3|reader-layout-v2|device=tablet|viewport=760.25x960.75|font=ExampleFamily|' +
    'weight=regular|size=18|scale=1.5|line=36|insets=28,11,35,12|title=28.75,18|paragraph=9,36|' +
    'letter=-0.5|align=start|writing=horizontal-tb');
  assert.throws(
    () => createNativeReadingPaginationLayoutSignature(
      new ReaderReadingLayoutSnapshot('compact', 0, 843.75, 28, 11, 35, 12, 1.5), appearance,
    ),
    { name: 'RangeError', message: 'viewportWidth must be a positive finite number' },
  );
});

test('window layout keys include current settings and preserve asymmetric insets', () => {
  const layout = new ReaderReadingLayoutSnapshot('compact', 390.25, 843.75, 28, 11, 35, 12, 1.5);
  assert.equal(createReaderWindowMetricsLayoutKey(layout, true, false),
    'compact|390.25|843.75|28|11|35|12|0|61.125|1.5|true|false');
  assert.equal(createReaderWindowMetricsLayoutKey(layout, false, true),
    'compact|390.25|843.75|28|11|35|12|0|61.125|1.5|false|true');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { READER_THEME_DEFINITIONS, readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { evaluateReaderIslandContrast, readerIslandContrastPalette, readerIslandContrastRatio }
  from '../../entry/src/main/ets/ui/layout/ReaderIslandContrastEvaluator.ts';
import { readerSurfaceOutlinePaint } from '../../entry/src/main/ets/ui/surfaces/ReaderReadingPanelPaint.ts';

test('runtime palette evaluates only the selected reading paper under the current application appearance', () => {
  const paper = readerThemeDefinition('greenNight');
  const checks = evaluateReaderIslandContrast(readerIslandContrastPalette('day'), [paper]);
  assert.deepEqual(checks.filter(check => check.id.startsWith('paper-outline:')).map(check => check.id),
    ['paper-outline:greenNight:start', 'paper-outline:greenNight:end']);
});

test('shared native surface outlines keep hairline separation against day and night paper surfaces', () => {
  for (const scheme of ['day', 'night']) {
    const outline = readerSurfaceOutlinePaint(scheme);
    assert.equal(outline.width, 1);
    assert.ok(readerIslandContrastRatio(outline.color, readerAppColor('TOK_PAPER', scheme)) >= 1.05);
  }
});

test('day and night control islands pass the outline, card and action contrast checks', () => {
  for (const scheme of ['day', 'night']) {
    const checks = evaluateReaderIslandContrast(readerIslandContrastPalette(scheme));
    assert.equal(checks.filter(check => check.id.startsWith('paper-outline:')).length, 2 * READER_THEME_DEFINITIONS.length);
    for (const check of checks) {
      assert.ok(check.actual >= check.minimum, `${scheme} ${check.id}: ${check.actual} < ${check.minimum}`);
    }
  }
});

test('contrast calculations composite transparent paint over the actual background', () => {
  assert.equal(readerIslandContrastRatio('#00000000', '#FFF0E5D6'), 1);
  assert.equal(readerIslandContrastRatio('#FF000000', '#FFFFFFFF'), 21);
  assert.ok(Math.abs(readerIslandContrastRatio('#80FFFFFF', '#FF000000') - 5.31721) < 0.00001);
});

test('collapsed native paint and visually identical action states fail the guard', () => {
  const day = readerIslandContrastPalette('day');
  const failures = evaluateReaderIslandContrast({ ...day, card: day.shell, nativeOutlineWidth: 0,
    nativeShadow: false, disabled: day.enabled }).filter(check => check.actual < check.minimum);
  assert.ok(failures.some(check => check.id.startsWith('shell-to-card-luminance:')));
  for (const id of ['native-outline-width', 'native-edge-paint', 'enabled-vs-disabled-fill',
    'enabled-vs-disabled-border', 'enabled-vs-disabled-ink']) {
    assert.ok(failures.some(check => check.id === id), id);
  }
});

test('strengthened island outlines preserve the existing divider palette', () => {
  assert.equal(readerAppColor('TOK_ROW_DIVIDER', 'day'), '#1A5C4F3F');
  assert.equal(readerAppColor('TOK_CHAPTER_DIVIDER', 'night'), '#17ECE8E0');
  assert.equal(readerAppColor('app.border.menuDivider', 'day'), '#1A5C4F3F');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { MANGA_DIRECTORY_VISUAL, mangaDirectoryColor, mangaDirectoryScale } from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSearchField.ets', import.meta.url), 'utf8');
const reference = readFileSync(new URL('../../evidence/manga-directory-20261006/reference/src/prototype.css', import.meta.url), 'utf8');
assert.match(reference, /\.search-field \{ min-height:44px;[^}]*gap:9px; padding:0 11px; border-radius:12px; border:1px/);
assert.match(reference, /font:400 13px\/20px 'Reader Sans'/);
assert.match(reference, /input::placeholder \{ color:var\(--faint\)/);

const names = ['build', 'nativeInputBackground', 'nativeFieldBackground', 'fixedLineHeightField', 'mangaLineHeightField', 'autoLineHeightField', 'passiveField',
  'submit', 'textStyle', 'searchIcon', 'fieldHeight', 'inputHeight', 'iconSize', 'iconGap', 'horizontalPadding',
  'fieldBackgroundColor', 'fieldBorderWidth', 'fieldBorderColor', 'cornerRadius', 'inputColor', 'caretColor',
  'placeholderColor', 'resolvedAccessibilityLabel', 'mangaTextHeightGrowth', 'mangaFontScale', 'readerWindowMetricsRevision',
  'appThemeScheme', 'variant', 'mode', 'text', 'placeholder', 'accessibilityLabel', 'isTablet', 'clearable',
  'submitEnabled', 'onTextChange', 'onSubmit'];
const palettes = {
  day: { surface: '#FFFCF8', line: '#E7E0D5', ink: '#1F1B17', faint: '#A39C90', muted: '#756F69', accent: '#425D45' },
  night: { surface: '#282C25', line: '#3B4036', ink: '#EAE7DE', faint: '#767D71', muted: '#ABA99F', accent: '#B9CEB1' },
};
function fixture(candidate = source, scheme = 'day', scale = 1, clearable = false, variant = 'mangaDirectory') {
  const properties = createArkUIPropertyRuntimeProbe();
  const metrics = { systemFontScale: scale };
  const { owner } = createReaderBuilderProbe(candidate, names, { ...properties.sdk, MANGA_DIRECTORY_VISUAL,
    mangaDirectoryColor, mangaDirectoryScale, ReaderWindowCoordinator: { metrics: () => metrics } }, properties.hooks);
  const changes = [], submits = [];
  Object.assign(owner, { appThemeScheme: scheme, readerWindowMetricsRevision: 0, variant, mode: 'live', text: '48',
    placeholder: '搜索章名或序号', clearable, onTextChange: value => changes.push(value), onSubmit: () => submits.push('submit') });
  owner.initialRender();
  const nodes = () => [...owner.nodes.values()];
  return { owner, metrics, properties, changes, submits, nodes,
    outer: () => nodes().find(node => node.type === 'Row'),
    input: () => nodes().find(node => node.type === 'TextInput') };
}
function check(candidate = source) {
  for (const scheme of ['day', 'night']) for (const scale of [1, 1.3, 1.75, 2, 3.2]) {
    const f = fixture(candidate, scheme, scale, true);
    const palette = palettes[scheme];
    assert.equal(f.outer().height, 44 + 20 * (scale - 1), 'outer frame grows by the actual fp line-box increase');
    assert.equal(f.input().height, 42 + 20 * (scale - 1));
    assert.equal(f.outer().borderRadius, 12);
    assert.deepEqual(f.outer().border, { width: 1, color: palette.line });
    assert.deepEqual(f.outer().padding, { left: 11, right: 11 });
    assert.equal(f.outer().create.space, 9);
    assert.equal(f.outer().backgroundColor, palette.surface);
    assert.equal(f.input().lineHeight, 20, 'the actual TextInput consumes the demo line-height rather than AUTO');
    assert.equal(f.input().halfLeading, true);
    assert.equal(f.input().minFontScale, 1); assert.equal(f.input().maxFontScale, scale);
    assert.deepEqual(f.input().padding, { top: 11, bottom: 11, left: 0, right: 0 });
    assert.equal(f.input().fontSize, 13); assert.equal(f.input().fontWeight, 400);
    assert.equal(f.input().fontFamily, 'ReaderNotoSansSCUIRegular');
    assert.equal(f.input().fontColor, palette.ink);
    assert.equal(f.input().backgroundColor, 'Color.Transparent', 'shared input Styles preserve the authored clear input paint');
    assert.equal(f.input().placeholderColor, palette.faint);
    const expectedFocus = { strokeWidth: { value: 2, unit: 'vp' },
      strokeColor: { color: palette.accent }, margin: { value: 3, unit: 'vp' } };
    assert.deepEqual(f.input().focusBox, expectedFocus, 'the real TextInput receives the demo keyboard focus box');
    assert.equal(f.input().opacity, undefined, 'the demo button press alpha never applies to the editable input');
    assert.equal(f.nodes().find(node => node.type === 'Image').width, 17);
    const clearImage = f.nodes().find(node => node.type === 'Image' && String(node.create).includes('manga_directory_clear'));
    assert.ok(clearImage, 'the clear actor uses the same Radix Cross2 outlines as the demo');
    assert.equal(clearImage.width, 18); assert.equal(clearImage.height, 18);
    assert.equal(clearImage.create, `app.media.manga_directory_clear${scheme === 'night' ? '_theme_night' : ''}`);
    assert.equal(clearImage.fillColor, undefined, 'the clear actor uses a fixed ink asset without runtime tint');
    const clearSvg = readFileSync(new URL(`../entry/src/main/resources/base/media/manga_directory_clear${scheme === 'night' ? '_theme_night' : ''}.svg`, import.meta.url), 'utf8');
    assert.ok(clearSvg.includes(`fill="${palette.ink}"`), 'the actual fixed clear SVG carries the exact demo ink');
    const clearButton = f.nodes().find(node => node.accessibilityText === '清除目录搜索');
    assert.equal(clearButton.width, 26); assert.equal(clearButton.height, 36);
    assert.equal(clearButton.opacity, 1);
    assert.equal(clearButton.focusable, true);
    assert.deepEqual(clearButton.focusBox, expectedFocus,
      'the actual clear actor consumes the current scheme keyboard focus definition');
    f.input().onChange('第48话'); f.input().onSubmit();
    f.nodes().find(node => node.accessibilityText === '清除目录搜索').onClick();
    assert.deepEqual(f.changes, ['第48话', '']); assert.deepEqual(f.submits, ['submit']);
  }
  const retained = fixture(candidate);
  const inputActor = retained.input(); const outerActor = retained.outer();
  retained.metrics.systemFontScale = 1.75;
  retained.owner.readerWindowMetricsRevision = 1;
  retained.properties.flush();
  assert.equal(retained.input(), inputActor); assert.equal(retained.outer(), outerActor);
  assert.equal(retained.input().height, 57, 'published font-scale changes grow the retained input');
  assert.equal(retained.outer().height, 59);
  retained.owner.appThemeScheme = 'night'; retained.properties.flush();
  assert.equal(retained.outer().backgroundColor, '#282C25');
  assert.equal(retained.input().placeholderColor, '#767D71');
  assert.deepEqual(retained.input().focusBox.strokeColor, { color: '#B9CEB1' });
  assert.equal(retained.nodes().find(node => node.type === 'Image').create, 'app.media.manga_sheet_search_theme_night');
}
check();
for (const [label, candidate] of [
  ['AUTO input line height', source.replace('.lineHeight(TYPE_SEARCH_MANGA_DIRECTORY_INPUT.lineHeightFp as number)', '')],
  ['generic placeholder color', source.replace("mangaDirectoryColor('faint', this.appThemeScheme)", "mangaDirectoryColor('muted', this.appThemeScheme)")],
  ['fixed height under large type', source.replace('return MANGA_DIRECTORY_VISUAL.searchLineHeight * Math.max(0, this.mangaFontScale() - 1);', 'return 0;')],
  ['unbalanced native leading', source.replace('.halfLeading(true)', '.halfLeading(false)')],
  ['generic circle clear glyph', source.replaceAll('app.media.manga_directory_clear', 'app.media.search_clear')],
  ['stale clear actor focus theme', source.replace('new MangaDirectoryPressFeedback(true, true, this.appThemeScheme)', "new MangaDirectoryPressFeedback(true, true, 'day')")],
  ['missing input keyboard focus style', source.replace(/\.focusBox\(\{[^}]+\}\)/, '')],
  ['wrong input keyboard focus color', source.replace("mangaDirectoryColor('accent', this.appThemeScheme)", "mangaDirectoryColor('muted', this.appThemeScheme)")],
]) {
  assert.notEqual(candidate, source, label);
  assert.throws(() => check(candidate), assert.AssertionError, `reject ${label}`);
}
for (const [variant, height, inputHeight, lineHeight] of [
  ['bookPage', 36, 36, 21], ['sourceManagement', 44, 42, undefined],
  ['readerDirectory', 32, 24, undefined], ['readerQuick', 24, 22, undefined],
]) {
  const f = fixture(source, 'day', 2, false, variant);
  assert.equal(f.outer().height, height); assert.equal(f.input().height, inputHeight);
  assert.equal(f.input().backgroundColor, 'Color.Transparent');
  assert.equal(f.input().lineHeight, lineHeight, `${variant} retains its independent audited typography`);
  assert.equal(f.input().focusBox, undefined, `${variant} retains its existing native focus presentation`);
}
assert.equal(readerTypographyRoles.TYPE_SEARCH_MANGA_DIRECTORY_INPUT.lineHeightFp, 20);
console.log('PASS actual SDK manga search: demo 13/20 balanced line box, exact day/night geometry and palette, actual input and Radix clear actor current-theme focus boxes, retained font-scale/theme updates, change/clear/submit; eight old-rule negative controls rejected; other search variants retained. Native keyboard/pixels require target evidence.');

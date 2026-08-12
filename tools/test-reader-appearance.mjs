import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  copyReaderAppearanceSnapshot,
  createDefaultReaderAppearanceSnapshot,
  normalizeReaderAppearanceSnapshot,
  setReaderAppearanceAlignment,
  setReaderAppearanceDayTheme,
  setReaderAppearanceFont,
  setReaderAppearanceIndent,
  setReaderAppearanceMetric,
  setReaderAppearanceNightTheme,
  setReaderAppearanceTheme,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import {
  readerAppearanceFontFamily,
  readerAppearanceLineHeight,
  readerAppearanceParagraphIndent,
  readerAppearanceThemeStyle,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';

const initial = createDefaultReaderAppearanceSnapshot();
assert.deepEqual(initial, {
  version: 1,
  activeTheme: 'paper',
  dayTheme: 'paper',
  nightTheme: 'paperNight',
  font: 'serif',
  fontSize: 18,
  lineHeightMultiplier: 1.96,
  paragraphSpacing: 16,
  letterSpacing: 0,
  indent: 'none',
  alignment: 'justify',
  pageTurn: 'none',
});

const normalized = normalizeReaderAppearanceSnapshot({
  ...initial,
  activeTheme: 'missing',
  dayTheme: 'green',
  font: 'import',
  fontSize: Number.NaN,
  pageTurn: 'slide',
});
assert.equal(normalized.activeTheme, 'paper');
assert.equal(normalized.dayTheme, 'green');
assert.equal(normalized.font, 'serif', 'unbundled fonts must fail closed to the bundled Serif slot');
assert.equal(normalized.fontSize, 18);
assert.equal(normalized.pageTurn, 'none', 'non-none page turn must fail closed');

let next = setReaderAppearanceTheme(initial, 'greenNight');
assert.equal(next.activeTheme, 'greenNight');
assert.equal(initial.activeTheme, 'paper', 'pure transitions must not mutate their input');
next = setReaderAppearanceDayTheme(next, 'warm');
next = setReaderAppearanceNightTheme(next, 'night');
next = setReaderAppearanceFont(next, 'sans');
next = setReaderAppearanceIndent(next, 'single');
next = setReaderAppearanceAlignment(next, 'start');
next = setReaderAppearanceMetric(next, 'fontSize', 20);
next = setReaderAppearanceMetric(next, 'lineHeightMultiplier', 2.04);
next = setReaderAppearanceMetric(next, 'paragraphSpacing', 18);
next = setReaderAppearanceMetric(next, 'letterSpacing', 0.5);
assert.deepEqual({
  activeTheme: next.activeTheme,
  dayTheme: next.dayTheme,
  nightTheme: next.nightTheme,
  font: next.font,
  indent: next.indent,
  alignment: next.alignment,
  fontSize: next.fontSize,
  lineHeightMultiplier: next.lineHeightMultiplier,
  paragraphSpacing: next.paragraphSpacing,
  letterSpacing: next.letterSpacing,
}, {
  activeTheme: 'greenNight',
  dayTheme: 'warm',
  nightTheme: 'night',
  font: 'sans',
  indent: 'single',
  alignment: 'start',
  fontSize: 20,
  lineHeightMultiplier: 2.04,
  paragraphSpacing: 18,
  letterSpacing: 0.5,
});
assert.notStrictEqual(copyReaderAppearanceSnapshot(next), next);
assert.throws(() => setReaderAppearanceMetric(next, 'fontSize', 0), /positive finite number/);
assert.throws(() => setReaderAppearanceMetric(next, 'paragraphSpacing', -1), /non-negative finite number/);
assert.throws(() => setReaderAppearanceMetric(next, 'letterSpacing', Number.NaN), /finite number/);
assert.deepEqual(readerAppearanceThemeStyle('paper'), {
  paperStart: '#FBF4E9',
  paperEnd: '#EFE2D0',
  ink: '#2B241D',
  paperTexture: true,
  sourcePaperLighting: true,
});
assert.deepEqual(readerAppearanceThemeStyle('paperNight'), {
  paperStart: '#302B26',
  paperEnd: '#211F1C',
  ink: '#E9DECE',
  paperTexture: true,
  sourcePaperLighting: false,
});
assert.equal(readerAppearanceLineHeight(initial), 35.28);
assert.equal(readerAppearanceFontFamily('system'), '');
assert.equal(readerAppearanceFontFamily('serif'), 'ReaderNotoSerifSCRegular');
assert.equal(readerAppearanceFontFamily('sans'), 'ReaderNotoSansSC');
assert.equal(readerAppearanceFontFamily('lxgwWenKai'), 'ReaderLXGWWenKaiLite');
assert.equal(setReaderAppearanceFont(initial, 'lxgwWenKai').font, 'lxgwWenKai');
assert.equal(readerAppearanceParagraphIndent(18, 'single'), 18);
assert.equal(readerAppearanceParagraphIndent(18, 'firstLine'), 36);

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const quickPanel = await readFile(new URL('ReaderAppearanceModulePanel.ets', readingDir), 'utf8');
const fullPanel = await readFile(new URL('ReaderAppearanceFullPanel.ets', readingDir), 'utf8');
const gateway = await readFile(new URL('ReaderAppearanceGateway.ts', readingDir), 'utf8');
const conversionGateway = await readFile(new URL('ReaderChineseConversionGateway.ts', readingDir), 'utf8');
const controlPanel = await readFile(new URL('ReaderControlPanel.ets', readingDir), 'utf8');
const readingSurface = await readFile(new URL('ReadingSurface.ets', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');

assert.match(quickPanel, /Phone `942:66`, Tablet `942:68`/);
assert.match(quickPanel, /return this\.isTablet \? 262 : 286/);
assert.match(quickPanel, /return this\.isTablet \? 238 : 262/);
assert.match(quickPanel, /return this\.isTablet \? 56\.5 : 62\.5/);
assert.match(quickPanel, /'day', 'warm', 'night', 'warmNight', 'paper', 'green', 'paperNight', 'greenNight'/);
assert.match(quickPanel, /this\.isSelectableFont\(fontId\)/);
assert.match(quickPanel, /fontId === 'lxgwWenKai'/);
assert.match(quickPanel, /ReaderLXGWWenKaiLite/);

assert.match(fullPanel, /Phone `942:82`, Tablet `942:84`/);
assert.match(fullPanel, /return this\.isTablet \? 720 : 364/);
assert.match(fullPanel, /return this\.isTablet \? 852 : 840/);
assert.match(fullPanel, /return this\.isTablet \? 834 : 772/);
assert.match(fullPanel, /this\.themeLibrary\(\);\s*this\.typographyLibrary\(\);\s*this\.fontLibrary\(\);/);
assert.match(fullPanel, /Text\('主题库'\)/);
assert.match(fullPanel, /Text\('字体库'\)/);
assert.match(fullPanel, /Text\('排版库'\)/);
assert.match(fullPanel, /return '平移'/);
assert.match(fullPanel, /kind === 'alignment' \|\| kind === 'language'/,
  'Chinese conversion must use the admitted Core-owned selector');
assert.match(fullPanel, /this\.chineseConversionMode === 'none' \? 't2s'/);
assert.match(fullPanel, /return '原文'/);
assert.match(fullPanel, /this\.isSelectableFont\(fontId\)/,
  'every bundled font slot must be selectable');
assert.match(fullPanel, /fontId === 'lxgwWenKai'/);
assert.match(fullPanel, /ReaderLXGWWenKaiLite/);
assert.match(fullPanel, /this\.indentOption\('单字缩进', 'single'\)/);
assert.doesNotMatch(fullPanel, /enabled\(value !== 'single'\)/,
  'single-character indentation must be selectable');

assert.match(gateway, /ReaderRuntimeOwner/);
assert.match(gateway, /getUIAbilityContext\(\)/);
assert.match(gateway, /reader_appearance_v1/);
assert.doesNotMatch(gateway, /\.request\(/,
  'appearance settings must not misuse the fixed Reader Core persistence snapshot');
assert.match(conversionGateway, /reader\.chinese-conversion\.get/);
assert.match(conversionGateway, /reader\.chinese-conversion\.put/);
assert.doesNotMatch(conversionGateway, /ReaderAppearanceGateway|reader_appearance_v1/,
  'Chinese conversion must not be persisted as a Harmony-only appearance preference');

assert.match(controlPanel, /moduleAppearance/);
assert.match(controlPanel, /fullAppearance/);
assert.match(controlPanel, /ReaderAppearanceModulePanel\(\{/);
assert.match(controlPanel, /ReaderAppearanceFullPanel\(\{/);
assert.doesNotMatch(controlPanel, /module === 'appearance' && this\.isTablet/,
  'Phone and Tablet must share one responsive Appearance state machine');
assert.match(controlPanel, /ReaderAppearanceModulePanel\(\{\s*isTablet: this\.isTablet/);
assert.match(controlPanel, /ReaderAppearanceFullPanel\(\{\s*isTablet: this\.isTablet/);

assert.match(readingSurface, /@Prop appearance: ReaderAppearanceSnapshot/);
assert.match(readingSurface, /readerAppearanceThemeStyle\(this\.appearance\.activeTheme\)/);
assert.match(readingSurface, /\.fontSize\(this\.appearance\.fontSize\)/);
assert.match(readingSurface, /\.lineHeight\(readerAppearanceLineHeight\(this\.appearance\)\)/);
assert.match(readingSurface, /\.letterSpacing\(this\.appearance\.letterSpacing\)/);
assert.match(readingSurface, /\.textIndent\(fragment\.isParagraphStart \?[\s\S]*?readerAppearanceParagraphIndent/);

assert.match(experience, /void this\.loadAppearanceSnapshot\(lifecycleToken\)/);
assert.match(experience, /void this\.loadChineseConversionMode\(lifecycleToken\)/);
assert.match(experience, /reloadCurrentChapterAfterContentProjectionChange/);
assert.match(experience, /this\.appearanceGateway\.update\(snapshot\)/);
assert.match(experience, /currentVisibleAnchor[\s\S]*?this\.visiblePage\.startScalar/);
assert.match(experience, /letterSpacing: this\.appearanceSnapshot\.letterSpacing/);
assert.match(experience, /textAlignment: this\.appearanceSnapshot\.alignment/);

console.log('reader appearance pure/static contract: PASS');

import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

import {
  copyReaderAppearanceSnapshot,
  createDefaultReaderAppearanceSnapshot,
  normalizeReaderAppearanceSnapshot,
  ReaderCustomFontDescriptor,
  readerAppearanceCanStep,
  setReaderAppearanceAlignment,
  setReaderAppearanceCustomFont,
  setReaderAppearanceDayTheme,
  setReaderAppearanceFont,
  setReaderAppearanceIndent,
  setReaderAppearanceMetric,
  setReaderAppearanceNightTheme,
  setReaderAppearanceTheme,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import {
  readerAppearanceFontFamily,
  readerAppearanceSnapshotFontFamily,
  readerAppearanceLineHeight,
  readerAppearanceParagraphIndent,
  readerAppearanceThemeStyle,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import {
  createReadingPaginationLayoutSignature,
} from '../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';

const initial = createDefaultReaderAppearanceSnapshot();
assert.deepEqual(initial, {
  version: 2,
  activeTheme: 'paper',
  dayTheme: 'paper',
  nightTheme: 'paperNight',
  font: 'serif',
  customFont: undefined,
  fontSize: 18,
  lineHeightMultiplier: 1.96,
  paragraphSpacing: 16,
  letterSpacing: 0,
  indent: 'none',
  alignment: 'justify',
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
assert.equal(normalized.pageTurn, undefined,
  'appearance must discard legacy page-turn state now owned by Reader Settings');

const customDescriptor = new ReaderCustomFontDescriptor(
  '我的字体',
  'ReaderCustom_0123456789abcdef',
  '/data/storage/el2/base/files/reader-fonts/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.ttf',
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
);
const customSnapshot = setReaderAppearanceCustomFont(initial, customDescriptor);
assert.equal(customSnapshot.font, 'custom');
assert.equal(customSnapshot.customFont?.displayName, '我的字体');
assert.equal(readerAppearanceSnapshotFontFamily(customSnapshot), 'ReaderCustom_0123456789abcdef');
assert.equal(normalizeReaderAppearanceSnapshot({ ...customSnapshot, customFont: undefined }).font, 'serif',
  'a custom font choice without a Host-validated descriptor must fail closed');

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
assert.equal(setReaderAppearanceMetric(next, 'fontSize', 999).fontSize, 40,
  'reader font size must stop at the admitted paging-safe maximum');
assert.equal(setReaderAppearanceMetric(next, 'lineHeightMultiplier', 99).lineHeightMultiplier, 2.8);
assert.equal(setReaderAppearanceMetric(next, 'paragraphSpacing', 999).paragraphSpacing, 32);
assert.equal(setReaderAppearanceMetric(next, 'letterSpacing', -99).letterSpacing, -2);
assert.equal(readerAppearanceCanStep({ ...initial, fontSize: 12 }, 'fontSize', -1), false);
assert.equal(readerAppearanceCanStep({ ...initial, fontSize: 40 }, 'fontSize', 1), false);
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
assert.equal(readerAppearanceFontFamily('system'), 'HarmonyOS Sans');
assert.equal(readerAppearanceFontFamily('serif'), 'ReaderNotoSerifSCRegular');
assert.equal(readerAppearanceFontFamily('sans'), 'ReaderNotoSansSC');
assert.equal(readerAppearanceFontFamily('kai'), 'ReaderBpmfZihiKaiStd');
assert.equal(readerAppearanceFontFamily('fangSong'), 'ReaderZhuqueFangsong');
assert.equal(readerAppearanceFontFamily('mono'), 'ReaderSarasaMonoSC');
assert.equal(readerAppearanceFontFamily('sourceHanSerif'), 'ReaderNotoSerifSCRegular');
assert.equal(readerAppearanceFontFamily('lxgwWenKai'), 'ReaderLXGWWenKaiLite');
assert.equal(readerAppearanceFontFamily('custom'), 'ReaderNotoSerifSCRegular',
  'enum-only preview resolution must not invent a custom family');
assert.equal(new Set([
  readerAppearanceFontFamily('system'),
  readerAppearanceFontFamily('serif'),
  readerAppearanceFontFamily('sans'),
  readerAppearanceFontFamily('kai'),
  readerAppearanceFontFamily('fangSong'),
  readerAppearanceFontFamily('mono'),
  readerAppearanceFontFamily('lxgwWenKai'),
]).size, 7, 'every physical built-in font must resolve to a distinct render family');
assert.match(createReadingPaginationLayoutSignature({
  deviceForm: 'phone',
  viewportWidth: 390,
  viewportHeight: 844,
  fontFamily: readerAppearanceFontFamily('system'),
  fontWeight: '400',
  fontSize: 18,
  fontScale: 1,
  lineHeight: 35.28,
  topInset: 72,
  bottomInset: 47.99,
  leftInset: 32,
  rightInset: 32,
  titleLineHeight: 28.75,
  titleToBodySpacing: 18,
  paragraphSpacing: 16,
  paragraphIndent: 0,
  letterSpacing: 0,
  textAlignment: 'justify',
  writingMode: 'horizontal-tb',
}), /font=HarmonyOS Sans/, 'the system font must remain valid in the pagination signature');
for (const font of ['system', 'serif', 'sans', 'kai', 'fangSong', 'mono', 'sourceHanSerif', 'lxgwWenKai']) {
  assert.equal(setReaderAppearanceFont(initial, font).font, font, `${font} must be a writable built-in font`);
}
assert.equal(readerAppearanceParagraphIndent(18, 'single'), 18);
assert.equal(readerAppearanceParagraphIndent(18, 'firstLine'), 36);

const rawfileDir = new URL('../entry/src/main/resources/rawfile/', import.meta.url);
for (const [name, minimumBytes] of [
  ['BpmfZihiKaiStd-Regular.ttf', 17_000_000],
  ['ZhuqueFangsong-Regular.ttf', 8_000_000],
  ['SarasaMonoSC-Regular.ttf', 25_000_000],
]) {
  const metadata = await stat(new URL(name, rawfileDir));
  assert.ok(metadata.size >= minimumBytes, `${name} must be the complete upstream font, not a placeholder`);
}

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const quickPanel = await readFile(new URL('ReaderAppearanceModulePanel.ets', readingDir), 'utf8');
const fullPanel = await readFile(new URL('ReaderAppearanceFullPanel.ets', readingDir), 'utf8');
const gateway = await readFile(new URL('ReaderAppearanceGateway.ts', readingDir), 'utf8');
const customFontHost = await readFile(new URL('../../app/ReaderCustomFontHost.ts', readingDir), 'utf8');
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
assert.match(quickPanel, /return isReaderAppearanceFont\(fontId\)/,
  'all eight Figma built-in font slots must be selectable');
assert.match(quickPanel, /readerAppearanceFontFamily\(fontId\)/,
  'font previews and reading content must share the same family mapping');

assert.match(fullPanel, /Phone `942:82`, Tablet `942:84`/);
assert.match(fullPanel, /@Prop availableWidth: number = 0/);
assert.match(fullPanel, /@Prop availableHeight: number = 0/);
assert.match(fullPanel,
  /const designWidth = this\.isTablet \? READER_FULL_PANEL_MAX_WIDTH_TABLET :[\s\S]*READER_FULL_PANEL_MAX_WIDTH_PHONE;[\s\S]*Math\.min\(designWidth, this\.availableWidth\)/,
  'appearance sheet must preserve Figma width as a maximum and shrink to the live viewport');
assert.match(fullPanel,
  /const designHeight = this\.isTablet \? READER_FULL_PANEL_HEIGHT_TABLET :[\s\S]*READER_APPEARANCE_FULL_PANEL_HEIGHT_PHONE;[\s\S]*Math\.min\(designHeight, this\.availableHeight\)/,
  'appearance sheet must clamp its own Figma height to the shared live budget');
assert.match(fullPanel, /return Math\.max\(0, this\.sheetHeight\(\) - 68\)/);
assert.match(fullPanel, /return Math\.max\(0, this\.sheetWidth\(\) - 26\)/);
assert.match(fullPanel, /return Math\.max\(0, \(this\.sectionInnerWidth\(\) - 18\) \/ 4\)/,
  'four-column appearance cards must reflow inside a narrowed sheet');
assert.match(fullPanel, /this\.themeLibrary\(\);\s*this\.typographyLibrary\(\);\s*this\.fontLibrary\(\);/);
assert.match(fullPanel, /Scroll\(\)[\s\S]*this\.themeLibrary\(\);[\s\S]*\.height\(this\.viewportHeight\(\)\)/,
  'the full appearance content must scroll inside the live height budget');
assert.match(fullPanel, /Text\('主题库'\)/);
assert.match(fullPanel, /Text\('字体库'\)/);
assert.match(fullPanel, /Text\('排版库'\)/);
assert.match(fullPanel, /return this\.pageTurnStyle === 'none' \? '无动画' : '平移'/);
assert.match(fullPanel, /kind === 'alignment' \|\| kind === 'language'/,
  'Chinese conversion must use the admitted Core-owned selector');
assert.match(fullPanel, /ReaderSelect\(\{/);
assert.match(fullPanel, /ReaderSelectPanel\(\{/);
assert.equal((fullPanel.match(/variant: 'appearanceCompact'/g) ?? []).length, 2,
  'appearance trigger and overlay must share the page-specific Figma variant');
assert.match(fullPanel, /readerAppearanceCanStep\(this\.snapshot, metric, direction\)/,
  'metric controls must expose and enforce their admitted boundary');
assert.match(fullPanel, /private selectControlWidth\(kind: string\): number \{\s*return 56;/,
  'the final Phone and Tablet appearance pages use 56vp dropdown actors');
assert.match(fullPanel,
  /Text\(this\.selectLabel\(kind\)\)[\s\S]*?\.width\(this\.selectLabelWidth\(kind\)\)[\s\S]*?TextOverflow\.Ellipsis/,
  'live-width typography labels must not overlap their selector actors');
assert.match(fullPanel,
  /private selectLabelWidth\(kind: string\): number \{\s*const controlX = this\.selectRowWidth\(\) - this\.selectControlWidth\(kind\) - 8;\s*return Math\.max\(0, controlX - 13\);/,
  'the label constraint must derive from the live control position');
assert.match(fullPanel, /return \['原文', '繁转简', '简转繁'\]/);
assert.match(fullPanel, /return \['开启', '关闭'\]/);
assert.doesNotMatch(fullPanel, /handleSelectRequest/,
  'selector taps must open a visible menu instead of silently cycling values');
assert.match(fullPanel, /return '原文'/);
assert.match(fullPanel, /this\.isSelectableFont\(fontId\)/,
  'every bundled font slot must be selectable');
assert.match(fullPanel, /fontId === 'import' \|\| \(isReaderAppearanceFont\(fontId\)/,
  'the full panel must enable both every built-in font and the Host-owned import actor');
assert.match(fullPanel, /this\.onCustomFontImport\(\)/,
  'the Figma Import cell must invoke the custom-font Host flow');
assert.match(fullPanel, /readerAppearanceFontFamily\(fontId\)/);
assert.match(fullPanel, /return '霞鹜文楷'/,
  'the bundled LXGW slot must keep the exact Figma-facing label');
assert.match(fullPanel, /this\.indentOption\('单字缩进', 'single'\)/);
assert.doesNotMatch(fullPanel, /enabled\(value !== 'single'\)/,
  'single-character indentation must be selectable');

assert.match(gateway, /ReaderRuntimeOwner/);
assert.match(gateway, /getUIAbilityContext\(\)/);
assert.match(gateway, /reader_appearance_v1/);
assert.match(gateway, /ReaderCustomFontHost/);
assert.match(gateway, /registerCustomFont/);
assert.match(customFontHost, /DocumentViewPicker/);
assert.match(customFontHost, /\.ttf,\.otf/);
assert.match(customFontHost, /MaximumFontBytes = 32 \* 1024 \* 1024/);
assert.match(customFontHost, /isSupportedSfntHeader/);
assert.match(customFontHost, /ReaderCustom_/);
assert.match(customFontHost, /font\.registerFont/);
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
assert.match(controlPanel, /ReaderAppearanceModulePanel\(\{\s*isTablet: this\.isExpanded\(\)/);
assert.match(controlPanel, /ReaderAppearanceFullPanel\(\{\s*isTablet: this\.isExpanded\(\)/);
assert.match(controlPanel, /availableHeight: this\.layout\.fullPanelHeight/);

assert.match(readingSurface, /@Prop appearance: ReaderAppearanceSnapshot/);
assert.match(readingSurface, /readerAppearanceSnapshotFontFamily\(this\.appearance\)/,
  'visible reading text must consume the persisted custom family');
assert.match(readingSurface, /readerAppearanceThemeStyle\(this\.appearance\.activeTheme\)/);
assert.match(readingSurface, /\.fontSize\(this\.appearance\.fontSize\)/);
assert.match(readingSurface, /\.lineHeight\(readerAppearanceLineHeight\(this\.appearance\)\)/);
assert.match(readingSurface, /\.letterSpacing\(this\.appearance\.letterSpacing\)/);
assert.match(experience, /await this\.loadAppearanceSnapshot\(lifecycleToken\)/,
  'layout-affecting appearance must settle before initial pagination');
assert.match(experience, /page === 'moduleAppearance' \|\| page === 'fullAppearance'[\s\S]*?loadChineseConversionMode/,
  'conversion controls may load only when the user enters Appearance');
assert.match(experience, /reloadCurrentChapterAfterContentProjectionChange/);
assert.match(experience, /this\.appearanceGateway\.update\(snapshot\)/);
assert.match(experience, /this\.appearanceGateway\.registerCustomFont/);
assert.match(experience, /setReaderAppearanceCustomFont/);
assert.match(experience, /fontFamily: readerAppearanceSnapshotFontFamily\(this\.appearanceSnapshot\)/,
  'pagination signatures must use the exact custom family used by visible and measurement text');
assert.match(experience, /readerAppearanceChromeTone\(this\.appearanceSnapshot\.activeTheme\)/,
  'the same admitted reading theme must drive system-bar content tone');
assert.match(experience, /currentVisibleAnchor[\s\S]*?this\.visiblePage\.startScalar/);
assert.match(experience, /letterSpacing: this\.appearanceSnapshot\.letterSpacing/);
assert.match(experience, /textAlignment: this\.appearanceSnapshot\.alignment/);

console.log('reader appearance pure/static contract: PASS');

import { themeDayDesignSource } from './lib/reader-theme-design-source.mjs';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

import {
  copyReaderAppearanceSnapshot,
  createDefaultReaderAppearanceSnapshot,
  moveReaderAppearanceFontSlot,
  normalizeReaderAppearanceFontOrder,
  normalizeReaderAppearanceSnapshot,
  ReaderCustomFontDescriptor,
  readerAppearanceCanStep,
  setReaderAppearanceAlignment,
  setReaderAppearanceCustomFont,
  setReaderAppearanceDayTheme,
  setReaderAppearanceFont,
  setReaderAppearanceFontOrder,
  setReaderAppearanceIndent,
  setReaderAppearanceMetric,
  setReaderAppearanceNightTheme,
  setReaderAppearanceTheme,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import {
  readerAppearanceFontFamily,
  readerAppearanceFontSlotFamily,
  readerAppearanceFontSlotLabel,
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
  version: 4,
  appThemeMode: 'system',
  activeTheme: 'day',
  dayTheme: 'day',
  nightTheme: 'night',
  font: 'serif',
  customFont: undefined,
  fontOrder: ['system', 'serif', 'sans', 'kai', 'fangSong', 'mono', 'sourceHanSerif', 'lxgwWenKai', 'import'],
  fontSize: 18,
  lineHeightMultiplier: 1.96,
  paragraphSpacing: 16,
  letterSpacing: 0,
  indent: 'none',
  alignment: 'justify',
});

const { fontOrder: _legacyFontOrder, ...legacyAppearance } = initial;
assert.deepEqual(
  normalizeReaderAppearanceSnapshot({ ...legacyAppearance, version: 2 }).fontOrder,
  initial.fontOrder,
  'v2 preferences must migrate to the complete Figma font-library order',
);
assert.deepEqual(
  normalizeReaderAppearanceFontOrder(['serif', 'serif', 'import', 'missing']),
  ['serif', 'import', 'system', 'sans', 'kai', 'fangSong', 'mono', 'sourceHanSerif', 'lxgwWenKai'],
  'persisted order normalization must discard duplicates/unknown slots and append missing slots',
);
const movedFontOrder = moveReaderAppearanceFontSlot(initial.fontOrder, 0, 7);
assert.deepEqual(movedFontOrder,
  ['serif', 'sans', 'kai', 'fangSong', 'mono', 'sourceHanSerif', 'lxgwWenKai', 'system', 'import']);
assert.deepEqual(setReaderAppearanceFontOrder(initial, movedFontOrder).fontOrder, movedFontOrder);
assert.deepEqual(initial.fontOrder,
  ['system', 'serif', 'sans', 'kai', 'fangSong', 'mono', 'sourceHanSerif', 'lxgwWenKai', 'import'],
  'font-order transitions must not mutate the admitted snapshot');

const normalized = normalizeReaderAppearanceSnapshot({
  ...initial,
  activeTheme: 'missing',
  dayTheme: 'green',
  font: 'import',
  fontSize: Number.NaN,
  pageTurn: 'slide',
});
assert.equal(normalized.activeTheme, 'green', 'unknown active ID returns to the configured matching default');
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
assert.equal(readerAppearanceFontSlotLabel(initial, 'lxgwWenKai'), '霞鹜文楷');
assert.equal(readerAppearanceFontSlotLabel(customSnapshot, 'import'), '我的字体');
assert.equal(readerAppearanceFontSlotFamily(customSnapshot, 'import'), 'ReaderCustom_0123456789abcdef');
assert.equal(normalizeReaderAppearanceSnapshot({ ...customSnapshot, customFont: undefined }).font, 'serif',
  'a custom font choice without a Host-validated descriptor must fail closed');

let next = setReaderAppearanceTheme(initial, 'greenNight');
assert.equal(next.activeTheme, 'greenNight');
assert.equal(initial.activeTheme, 'day', 'pure transitions must not mutate their input');
next = setReaderAppearanceTheme(next, 'warm');
next = setReaderAppearanceDayTheme(next, 'warm');
next = setReaderAppearanceTheme(next, 'night');
next = setReaderAppearanceNightTheme(next, 'night');
next = setReaderAppearanceTheme(next, 'greenNight');
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
  paperStart: '#FFEEE4D0',
  paperEnd: '#FFEEE4D0',
  ink: '#FF2B241D',
  paperTexture: true,
  sourcePaperLighting: true,
});
assert.deepEqual(readerAppearanceThemeStyle('paperNight'), {
  paperStart: '#FF26313F',
  paperEnd: '#FF26313F',
  ink: '#FFE9DECE',
  paperTexture: true,
  sourcePaperLighting: false,
});
assert.equal(readerAppearanceLineHeight(initial), 35.28);
assert.equal(readerAppearanceFontFamily('system'), 'HarmonyOS Sans');
assert.equal(readerAppearanceFontFamily('serif'), 'ReaderNotoSerifSCRegular');
assert.equal(readerAppearanceFontFamily('sans'), 'ReaderNotoSansSC');
assert.equal(readerAppearanceFontFamily('kai'), 'ReaderLXGWWenKaiGBLite');
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
  ['LXGWWenKaiGBLite-Regular.ttf', 13_000_000],
  ['ZhuqueFangsong-Regular.ttf', 8_000_000],
  ['SarasaMonoSC-Regular.ttf', 25_000_000],
]) {
  const metadata = await stat(new URL(name, rawfileDir));
  assert.ok(metadata.size >= minimumBytes, `${name} must be the complete upstream font, not a placeholder`);
}

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const quickPanel = themeDayDesignSource(await readFile(new URL('ReaderAppearanceModulePanel.ets', readingDir), 'utf8'));
const fullPanel = themeDayDesignSource(await readFile(new URL('ReaderAppearanceFullPanel.ets', readingDir), 'utf8'));
const gateway = themeDayDesignSource(await readFile(new URL('ReaderAppearanceGateway.ts', readingDir), 'utf8'));
const customFontHost = themeDayDesignSource(await readFile(new URL('../../app/ReaderCustomFontHost.ts', readingDir), 'utf8'));
const conversionGateway = themeDayDesignSource(await readFile(new URL('ReaderChineseConversionGateway.ts', readingDir), 'utf8'));
const controlPanel = themeDayDesignSource(await readFile(new URL('ReaderControlPanel.ets', readingDir), 'utf8'));
const readingSurface = themeDayDesignSource(await readFile(new URL('ReadingSurface.ets', readingDir), 'utf8'));
const experience = themeDayDesignSource(await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8'));
const motion = themeDayDesignSource(await readFile(new URL('../common/MotionSpec.ets', readingDir), 'utf8'));

assert.match(quickPanel, /Phone `942:66`, Tablet `942:68`/);
assert.match(quickPanel, /return this\.isTablet \? 262 : 286/);
assert.match(quickPanel, /return this\.isTablet \? 238 : 262/);
assert.match(quickPanel, /return this\.isTablet \? 56\.5 : 62\.5/);
assert.match(quickPanel, /'day', 'warm', 'night', 'warmNight', 'paper', 'green', 'paperNight', 'greenNight'/);
assert.match(quickPanel, /this\.isSelectableFont\(fontId\)/);
assert.match(quickPanel, /return isReaderAppearanceFont\(fontId\)/,
  'all eight Figma built-in font slots must be selectable');
assert.match(quickPanel, /readerAppearanceFontSlotFamily\(this\.snapshot, fontId\)/,
  'quick font previews must use the shared product-facing slot mapping');
assert.match(quickPanel, /readerAppearanceFontSlotLabel\(this\.snapshot, fontId\)/,
  'quick and full grids must not duplicate or rename the Figma labels');
assert.match(quickPanel, /TOK_PRIMARY_SOFT : Color\.Transparent/,
  'the selected quick font slot must use the Figma green soft fill instead of the blue theme state');
assert.match(quickPanel, /\.height\(27\)[\s\S]*\.border\(\{ width: \{ top: TOK_BORDER_W \}, color: TOK_LINE \}\)/,
  'the quick font state belongs to the complete 62.5x27 slot');
assert.doesNotMatch(quickPanel, /fontPillWidth|borderRadius\(11\)|'#FFFAF4'/,
  'the rejected nested font-pill treatment must not return');
assert.match(quickPanel, /this\.snapshot\.fontOrder\.filter/,
  'the quick font library must project the same persisted order while excluding only the full-page import actor');

assert.match(fullPanel, /Phone `942:82`, Tablet `942:84`/);
assert.match(fullPanel, /@Prop availableWidth: number = 0/);
assert.match(fullPanel, /@Prop availableHeight: number = 0/);
assert.match(fullPanel,
  /const designWidth = this\.isTablet \? READER_FULL_PANEL_MAX_WIDTH_TABLET :[\s\S]*READER_FULL_PANEL_MAX_WIDTH_PHONE;[\s\S]*Math\.min\(designWidth, this\.availableWidth\)/,
  'appearance sheet must preserve Figma width as a maximum and shrink to the live viewport');
assert.match(fullPanel,
  /const designHeight = this\.isTablet \? READER_FULL_PANEL_HEIGHT_TABLET :[\s\S]*READER_APPEARANCE_FULL_PANEL_HEIGHT_PHONE;[\s\S]*return designHeight;/,
  'the Phone appearance sheet must retain the authored 840vp frame and clip at the screen like the final Figma page');
assert.match(fullPanel, /return Math\.max\(0, this\.sheetHeight\(\) - 68\)/);
assert.match(fullPanel,
  /private scrollViewportHeight\(\): number[\s\S]*Math\.min\(this\.viewportHeight\(\), this\.availableHeight - 68\)/,
  'the interaction viewport must still shrink to the live window without visually shortening the authored sheet');
assert.match(fullPanel, /return Math\.max\(0, this\.sheetWidth\(\) - 26\)/);
assert.match(fullPanel, /return Math\.max\(0, \(this\.sectionInnerWidth\(\) - 18\) \/ 4\)/,
  'four-column appearance cards must reflow inside a narrowed sheet');
assert.match(fullPanel, /this\.themeLibrary\(\);\s*this\.typographyLibrary\(\);\s*this\.fontLibrary\(\);/);
assert.match(fullPanel, /Scroll\(this\.contentScroller\)[\s\S]*this\.themeLibrary\(\);[\s\S]*\.height\(this\.scrollViewportHeight\(\)\)/,
  'the full appearance content must scroll inside the live height budget');
assert.match(fullPanel, /Text\('主题库'\)/);
assert.match(fullPanel, /Text\('字体库'\)/);
assert.match(fullPanel, /Text\('排版库'\)/);
assert.match(quickPanel,
  /backgroundColor\(this\.snapshot\.activeTheme === theme \? TOK_READ_ACTIVE_SOFT[\s\S]*isNightTheme\(theme\) \? TOK_READ_DISABLED_BG[\s\S]*opacity\(this\.snapshot\.activeTheme === theme \? 1 : 0\.8\)/,
  'quick theme cells must use the complete Figma state layer instead of outlining the swatch');
assert.match(fullPanel,
  /backgroundColor\(this\.snapshot\.activeTheme === theme \? TOK_READ_ACTIVE_SOFT : TOK_READ_DISABLED_BG\)[\s\S]*opacity\(this\.snapshot\.activeTheme === theme \? 1 : 0\.8\)/,
  'full theme cells must preserve the authored selected fill and inactive opacity');
assert.match(fullPanel,
  /backgroundColor\(this\.isActiveFont\(fontId\) \? TOK_PRIMARY_SOFT : Color\.Transparent\)[\s\S]*color: this\.isActiveFont\(fontId\) \? TOK_READ_PRIMARY : TOK_LINE/,
  'full font cells must use transparent weak-border defaults and the green selected fill');
assert.match(fullPanel,
  /Text\('即时应用'\)[\s\S]*\.width\(70\)[\s\S]*\.fontWeight\(FontWeight\.Medium\)[\s\S]*\.fontSize\(10\)/,
  'the typography helper must occupy the authored 70vp header column');
assert.match(fullPanel,
  /\.width\(this\.stepperPanelWidth\(\)\)\s*\.height\(140\)\s*\.borderRadius\(8\)/,
  'the metric rows must not invent an enclosing fill or border absent from Figma');
assert.match(fullPanel, /app\.media\.reader_appearance_header/,
  'the full page must use its dark Figma-derived header icon, not the blue quick-navigation asset');
assert.match(fullPanel, /return this\.pageTurnStyle === 'none' \? '无动画' : '平移'/);
assert.match(fullPanel, /kind === 'alignment' \|\| kind === 'language'/,
  'Chinese conversion must use the admitted Core-owned selector');
assert.match(fullPanel, /ReaderSelect\(\{/);
assert.match(fullPanel, /ReaderSelectPanel\(\{/);
assert.equal((fullPanel.match(/variant: 'appearanceCompact'/g) ?? []).length, 2,
  'appearance trigger and overlay must share the page-specific Figma variant');
assert.match(fullPanel,
  /private indentRow[\s\S]*?TOK_SURFACE_FIELD[\s\S]*?TOK_BORDER[\s\S]*?this\.indentOption\('不缩进', 'none'\)[\s\S]*?this\.indentOption\('双字缩进', 'firstLine'\)/,
  'the indent segmented field must keep one clean field surface and three interactive options');
assert.doesNotMatch(fullPanel, /indentPortGradient|linearGradient\(\{[\s\S]*?Color\.Transparent[\s\S]*?'#41484C'/,
  'the dropdown chevron artwork must not be stretched across the indent segmented field');
assert.match(fullPanel, /readerAppearanceCanStep\(this\.snapshot, metric, direction\)/,
  'metric controls must expose and enforce their admitted boundary');
assert.match(fullPanel,
  /private selectControlWidth\(kind: string\): number \{\s*const narrowDelta = Math\.max\(0, READER_FULL_PANEL_MAX_WIDTH_PHONE - this\.sheetWidth\(\)\);\s*return Math\.max\(52, 56 - narrowDelta \/ 3\);/,
  'selectors must keep 56vp at the Figma width and release label space on narrower phones');
assert.match(fullPanel,
  /Text\(this\.selectLabel\(kind\)\)[\s\S]*?\.width\(this\.selectLabelWidth\(kind\)\)[\s\S]*?TextOverflow\.Ellipsis/,
  'live-width typography labels must not overlap their selector actors');
assert.match(fullPanel,
  /private selectLabelWidth\(kind: string\): number \{\s*const controlX = this\.selectRowWidth\(\) - this\.selectControlWidth\(kind\) - 8;\s*return Math\.max\(0, controlX - 9\);/,
  'the label constraint must preserve the complete Figma label while deriving from the live control position');
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
assert.match(fullPanel,
  /\.onTouch\(\(event: TouchEvent\): void => this\.handleFontTouch\(fontId, event\)\)[\s\S]*LongPressGesture\([\s\S]*READER_FONT_REORDER_HOLD_MS/,
  'font reordering must arm on an intentional hold while raw touch MOVE remains available for direct following');
assert.doesNotMatch(fullPanel, /GestureMode\.Sequence/,
  'a sequential long-press/pan group cannot hand off while the same finger remains down');
assert.match(fullPanel,
  /event\.type === TouchType\.Move[\s\S]*event\.stopPropagation\(\)[\s\S]*this\.updateFontDrag\([\s\S]*this\.fontTouchCurrentX - this\.fontTouchStartX/,
  'after the hold wins, the same touch stream must drive the lifted card and stop parent scrolling');
assert.match(fullPanel,
  /enableScrollInteraction\(this\.interactionEnabled && this\.draggedFontId === '' && !this\.fontDragSettling\)/,
  'the parent Scroll must stop for either motion ownership or a font reorder gesture');
assert.match(fullPanel, /this\.fontDragPlaceholder\(\)/,
  'dragging must expose an insertion target instead of leaving an unexplained hole');
assert.match(fullPanel,
  /this\.draggedFontHoverIndex = targetIndex;[\s\S]*this\.previewFontOrder = nextOrder/,
  'neighbouring cards must project the hover order before persistence');
assert.match(fullPanel, /moveReaderAppearanceFontSlot\([\s\S]*this\.onFontOrderChange\(nextOrder\)/,
  'font order must be normalized and committed only after the drag settles');
assert.match(fullPanel, /return this\.snapshot\.fontOrder\.slice\(\)/,
  'the complete font library must render the persisted shared order');
assert.match(fullPanel, /readerAppearanceFontSlotFamily\(this\.snapshot, fontId\)/);
assert.match(fullPanel, /readerAppearanceFontSlotLabel\(this\.snapshot, fontId\)/);
assert.match(motion, /reader\.font\.reorder\.shift', durationMs: 120, curve: Curve\.EaseOut/);
assert.match(motion, /reader\.font\.reorder\.settle', durationMs: 160, curve: Curve\.EaseOut/);
assert.match(fullPanel, /this\.indentOption\('单字缩进', 'single'\)/);
assert.doesNotMatch(fullPanel, /enabled\(value !== 'single'\)/,
  'single-character indentation must be selectable');

assert.match(gateway, /ReaderRuntimeOwner/);
assert.match(gateway, /getUIAbilityContext\(\)/);
assert.match(gateway, /runtimeOwner\.getAppearanceStore\(\)/);
const appearancePreferences = themeDayDesignSource(await readFile(new URL('../../app/ReaderAppearancePreferences.ts', readingDir), 'utf8'));
assert.match(appearancePreferences, /reader_appearance_v1/);
assert.match(appearancePreferences, /store\.put\('snapshot'/);
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

// Production binding: one shared Appearance content consumes the Host session.
// The legacy standalone panel/source checks above are not production parity.
assert.match(controlPanel, /moduleAppearance/);
assert.equal((controlPanel.match(/ReaderControlAppearanceContent\(\{/g) ?? []).length, 1);
assert.doesNotMatch(controlPanel, /ReaderAppearance(?:ModulePanel|FullPanel|MotionStage)\(\{/);
assert.match(controlPanel, /ReaderControlAppearanceContent\(\{\s*isTablet: this\.isExpanded\(\)/);
assert.match(controlPanel, /motionProgress: this\.contentMotionProgress/);
assert.match(controlPanel, /availableHeight: this\.contentMotionHeight/);
for (const callback of ['onAppearanceThemeChange', 'onAppearanceFontChange',
  'onAppearanceFontOrderChange', 'onAppearanceCustomFontImport', 'onChineseConversionChange',
  'onAppearanceMetricStep', 'onAppearanceIndentRequest', 'onAppearanceAlignmentRequest']) {
  assert.match(controlPanel, new RegExp(`this\\.${callback}\\(`),
    `shared Appearance must retain actual business callback ${callback}`);
}
assert.match(controlPanel, /dismissTemporaryRevision: this\.dismissTemporaryRevision/);

assert.match(readingSurface, /@Prop appearance: ReaderAppearanceSnapshot/);
assert.match(readingSurface, /readerAppearanceSnapshotFontFamily\(this\.appearance\)/,
  'visible reading text must consume the persisted custom family');
assert.match(readingSurface, /readerAppearanceThemeStyle\(this\.appearance\.activeTheme\)/);
assert.match(readingSurface, /\.fontSize\(this\.appearance\.fontSize\)/);
assert.match(readingSurface, /\.lineHeight\(readerAppearanceLineHeight\(this\.appearance\)\)/);
assert.match(readingSurface, /\.letterSpacing\(this\.appearance\.letterSpacing\)/);
assert.match(experience,
  /const layoutReady = Promise\.all\(\[[\s\S]*?this\.loadAppearanceSnapshot\(lifecycleToken\)[\s\S]*?\]\)[\s\S]*?this\.loadInitialChapter\(lifecycleToken, layoutReady\)[\s\S]*?await layoutReady;[\s\S]*?await this\.openChapter/,
  'layout-affecting appearance must settle at the pagination barrier while TOC and progress load concurrently');
assert.match(experience, /private prepareControlPage\(page: ReaderControlPage\)[\s\S]*?page === 'moduleAppearance' \|\| page === 'fullAppearance'[\s\S]*?loadChineseConversionMode/,
  'conversion controls load through the derived Appearance business-page entry');
assert.match(experience, /if \(module !== this\.observedControlModule\) \{\s*this\.controlModuleVisitRevision \+= 1;\s*this\.observedControlModule = module;\s*this\.prepareControlPage\(page\);/,
  'only a new module visit increments presentation ownership and loads entry data; Quick/Full frames do neither');
assert.match(experience, /reloadCurrentChapterAfterContentProjectionChange/);
assert.match(experience, /this\.appearanceGateway\.update\(change,/);
assert.match(experience, /setReaderAppearanceFontOrder\(current, requestedOrder\)/,
  'dragged font order must enter the existing versioned appearance persistence path');
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

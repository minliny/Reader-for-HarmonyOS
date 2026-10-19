import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
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


async function stateCase() {
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
assert.ok(customSnapshot.fontOrder.includes('custom'));
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
for (const font of ['system', 'serif', 'sans', 'kai', 'fangSong', 'mono', 'sourceHanSerif', 'lxgwWenKai']) {
  assert.equal(setReaderAppearanceFont(initial, font).font, font, `${font} must be a writable built-in font`);
}

}
async function renderStyleCase() {
const initial = createDefaultReaderAppearanceSnapshot();
const customDescriptor = new ReaderCustomFontDescriptor(
  '我的字体',
  'ReaderCustom_0123456789abcdef',
  '/data/storage/el2/base/files/reader-fonts/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.ttf',
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
);
const customSnapshot = setReaderAppearanceCustomFont(initial, customDescriptor);
assert.equal(readerAppearanceSnapshotFontFamily(customSnapshot), 'ReaderCustom_0123456789abcdef');
assert.equal(readerAppearanceFontSlotLabel(initial, 'lxgwWenKai'), '霞鹜文楷');
assert.equal(readerAppearanceFontSlotLabel(customSnapshot, 'custom'), '我的字体');
assert.equal(readerAppearanceFontSlotFamily(customSnapshot, 'custom'), 'ReaderCustom_0123456789abcdef');
assert.equal(readerAppearanceFontSlotLabel(customSnapshot, 'import'), '导入');
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
assert.equal(readerAppearanceParagraphIndent(18, 'single'), 18);
assert.equal(readerAppearanceParagraphIndent(18, 'firstLine'), 36);


}
async function sharedContentCase() {
  const { readFile } = await import('node:fs/promises');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { readerPageTurnStyle, createDefaultReaderSettingsSnapshot } = await import('../entry/src/main/ets/features/reading/ReaderSettingsState.ts');
  const source = await readFile(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url), 'utf8');
  const childSource = await readFile(new URL('../entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets', import.meta.url), 'utf8');
  let captured;
  class ContentBoundary {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); captured = this; }
  }
  const { owner } = createReaderBuilderProbe(source, ['appearanceContent'], {
    ReaderControlAppearanceContent: ContentBoundary, readerPageTurnStyle,
  }, { childSources: { ReaderControlAppearanceContent: childSource } });
  const calls = [];
  const callbacks = {
    onThemeChange: ['onAppearanceThemeChange', 'greenNight'],
    onSetDayTheme: ['onAppearanceDayThemeChange', 'paper'],
    onSetNightTheme: ['onAppearanceNightThemeChange', 'paperNight'],
    onFontChange: ['onAppearanceFontChange', 'sans'],
    onFontOrderChange: ['onAppearanceFontOrderChange', ['sans', 'serif']],
    onCustomFontImport: ['onAppearanceCustomFontImport'],
    onIndentRequest: ['onAppearanceIndentRequest', 'single'],
    onAlignmentRequest: ['onAppearanceAlignmentRequest', 'start'],
    onMetricStep: ['onAppearanceMetricStep', 'fontSize', 1],
    onChineseConversionChange: ['onChineseConversionChange', 's2t', 'current-identity'],
  };
  Object.assign(owner, { isExpanded: () => true, contentMotionWidth: 360, contentMotionHeight: 700,
    contentEndpointHeight: () => 700, contentInputEnabled: () => true,
    dismissTemporaryRevision: 3, reduceMotion: false, contentMotionProgress: .7,
    appearanceSnapshot: createDefaultReaderAppearanceSnapshot(), settingsSnapshot: createDefaultReaderSettingsSnapshot(),
    chineseConversionMode: 'original', chineseConversionIdentity: 'current-identity',
    pageTurnSimulationAvailable: true, onTemporaryLayerChange() {}, collapseControl() {},
    setAppearanceFontReorderActivity() {}, onPageTurnStyleChange() {},
  });
  for (const [target] of Object.values(callbacks)) owner[target] = (...args) => calls.push([target, ...args]);
  owner.appearanceContent();
  assert.ok(captured, 'the actual shared Appearance child is mounted by its production Builder');
  assert.strictEqual(captured.params.snapshot, owner.appearanceSnapshot);
  assert.equal(captured.params.availableWidth, 360); assert.equal(captured.params.availableHeight, 700);
  assert.equal(captured.params.interactionEnabled, true); assert.equal(captured.params.dismissTemporaryRevision, 3);
  for (const [prop, [target, ...args]] of Object.entries(callbacks)) {
    assert.equal(typeof captured.params[prop], 'function', `actual callback ${prop}`);
    captured.params[prop](...args); assert.deepEqual(calls.at(-1), [target, ...args]);
  }
}
const cases = { 'state': stateCase, 'render-style': renderStyleCase, 'shared-content': sharedContentCase };
for (const id of selectContractCases({
  'state': { description: 'Production appearance snapshot migration, immutable updates and admitted bounds', resources: [] },
  'render-style': { description: 'Production font/theme/indent mapping and pagination signature', resources: [] },
  'shared-content': { description: 'SDK-emitted actual Appearance Builder child parameters and callbacks', resources: [] },
})) { await cases[id](); recordContractCasePass(id); }

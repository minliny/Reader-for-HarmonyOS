import type { UIContext } from '@ohos.arkui.UIContext';
import {
  ReaderTextStyle, TYPE_SELECT_LIBRARY_VALUE,
  TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR, TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED,
  TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL,
  TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META,
  TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL_SECONDARY,
  TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META_SECONDARY,
  TYPE_READER_APPEARANCE_RETAINED_THEME_SHELL_VALUE,
  TYPE_READER_APPEARANCE_RETAINED_THEME_ACTION_VALUE,
  TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL,
  TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_SECONDARY,
  TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_TERTIARY,
  TYPE_READER_APPEARANCE_RETAINED_FONT_CELL_PREVIEW,
  TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL,
  TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL_SECONDARY,
  TYPE_READER_APPEARANCE_RETAINED_SELECT_FIELD_VALUE,
  TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE,
  TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE_SECONDARY,
  TYPE_READER_APPEARANCE_RETAINED_STEP_BUTTON_VALUE,
} from '../../../ui/foundation/ReaderTypography';
import { measureReaderControlText, type ReaderControlTextExtent } from './ReaderControlTextMeasurement';
import { sampleReaderControlAppearance, type ReaderControlAppearanceMinimumProfile } from './ReaderControlAppearanceGeometry';
import type { ReaderControlCandidateWidths, ReaderControlModuleMinimum } from './ReaderLayoutGeometry';

export interface ReaderControlAppearanceFontMinimumInput { label: string; family: string; }
export interface ReaderControlAppearanceMinimumInput {
  themes: string[];
  themeSummary: string;
  themeActions: string[];
  fonts: ReaderControlAppearanceFontMinimumInput[];
  indentValue: string;
  languageValue: string;
  indentOptions: string[];
  languageOptions: string[];
  metricLabels: string[];
  metricValues: string[];
}
export interface ReaderControlAppearanceMeasuredMinimum {
  profile: ReaderControlAppearanceMinimumProfile;
  minimum: ReaderControlModuleMinimum;
}

interface ReaderControlAppearanceThemeMinimum {
  heightVp: number;
  minimumLabelWidthVp: number;
}

/** Theme names keep their one-line ellipsis policy. A long name is not a
 * requirement to show the entire string or to reserve a reference motion root. */
function measureThemeLabels(context: UIContext, names: string[], width: number): ReaderControlAppearanceThemeMinimum | undefined {
  const style = TYPE_READER_APPEARANCE_RETAINED_THEME_SHELL_VALUE;
  let height = 0;
  let minimumLabelWidth = 0;
  for (const name of names) {
    const actual = measureReaderControlText(context, name, style, width);
    if (actual === undefined) return undefined;
    const point = name.codePointAt(0);
    const first = point === undefined ? '字' : String.fromCodePoint(point);
    const readable = name === first ? actual : measureReaderControlText(context, `${first}…`, style, width);
    if (readable === undefined) return undefined;
    height = Math.max(height, actual.heightVp);
    minimumLabelWidth = Math.max(minimumLabelWidth, Math.min(actual.singleLineWidthVp, readable.singleLineWidthVp));
  }
  return height > 0 ? { heightVp: height, minimumLabelWidthVp: minimumLabelWidth } : undefined;
}

function measureMany(context: UIContext, values: string[], style: ReaderTextStyle, width: number,
  wrap: boolean = false): ReaderControlTextExtent | undefined {
  let result: ReaderControlTextExtent = { widthVp: 0, heightVp: 0, singleLineWidthVp: 0, fitsWidth: true };
  for (const value of values) {
    const measured = measureReaderControlText(context, value, style, width, wrap ? 'wrap' : 'singleLine');
    if (measured === undefined) return undefined;
    result = { widthVp: Math.max(result.widthVp, measured.widthVp),
      heightVp: Math.max(result.heightVp, measured.heightVp),
      singleLineWidthVp: Math.max(result.singleLineWidthVp, measured.singleLineWidthVp),
      fitsWidth: result.fitsWidth && measured.fitsWidth };
  }
  return result.heightVp > 0 ? result : undefined;
}

/** Same existing appearance ChoiceRow recipe: panel inset4, padding9, selected icon11+gap10,
 * natural wrapped text + top/bottom6, min44; the original panel bounds its Scroll to330. */
function measureMenu(context: UIContext, options: string[], selected: string): number | undefined {
  let height = 8;
  for (const option of options) {
    const active = option === selected;
    const text = measureReaderControlText(context, option, active ?
      TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED : TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR,
      104 - 8 - 18 - (active ? 21 : 0), 'wrap');
    if (text === undefined) return undefined;
    height += Math.max(44, Math.ceil(text.heightVp) + 12);
  }
  return Math.min(330, height);
}

function columns(width: number, minimumCell: number, gap: number): number {
  return Math.max(1, Math.min(4, Math.floor((Math.max(0, width) + gap) / (minimumCell + gap))));
}

/** Measures the actual module labels/faces at the exact two candidate content widths.
 * No component tree, font acquisition, setting mutation or media/Host command is created. */
export function measureReaderControlAppearanceMinimum(context: UIContext, widths: ReaderControlCandidateWidths,
  input: ReaderControlAppearanceMinimumInput): ReaderControlAppearanceMeasuredMinimum | undefined {
  const quick = widths.quickContentWidthVp;
  const full = widths.fullContentWidthVp;
  if (!Number.isFinite(quick) || !Number.isFinite(full) || quick <= 36 || full <= 50) return undefined;
  const section = full - 22;
  const qHeader = measureMany(context, ['主题库'], TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL, quick - 120, true);
  const qMeta = measureMany(context, [input.themeSummary], TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META, 88);
  const fHeader = measureMany(context, ['主题库'], TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL_SECONDARY, section - 152, true);
  const fMeta = measureMany(context, [input.themeSummary], TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META_SECONDARY, 140);
  const qFontHeader = measureMany(context, ['字体库'], TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL, quick - 24, true);
  const fFontHeader = measureMany(context, ['字体库'], TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_SECONDARY, section / 2, true);
  const fFontMeta = measureMany(context, ['可拖动调整位置'], TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_TERTIARY, section / 2, true);
  // Start with the original four-column cell and its existing label inset5+5.
  const themeWidth = Math.max(0, (section - 22) / 4);
  const theme = measureThemeLabels(context, input.themes, Math.max(1, themeWidth - 10));
  const action = measureMany(context, input.themeActions, TYPE_READER_APPEARANCE_RETAINED_THEME_ACTION_VALUE, 74, true);
  const layoutHeader = measureMany(context, ['排版库'], TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL, (section - 8) / 2, true);
  const layoutMeta = measureMany(context, ['即时应用'], TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL_SECONDARY, (section - 8) / 2, true);
  const selectLabel = measureMany(context, ['缩进', '简繁'], TYPE_READER_APPEARANCE_RETAINED_SELECT_FIELD_VALUE, section - 28);
  const indent = measureMany(context, [input.indentValue], TYPE_SELECT_LIBRARY_VALUE, section - 66);
  const language = measureMany(context, [input.languageValue], TYPE_SELECT_LIBRARY_VALUE, section - 66);
  const metricLabel = measureMany(context, input.metricLabels, TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE, section - 28);
  const metricValue = measureMany(context, input.metricValues, TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE_SECONDARY, section - 28);
  const stepButton = measureMany(context, ['−', '+'], TYPE_READER_APPEARANCE_RETAINED_STEP_BUTTON_VALUE, section - 28);
  const indentMenuHeight = measureMenu(context, input.indentOptions, input.indentValue);
  const languageMenuHeight = measureMenu(context, input.languageOptions, input.languageValue);
  if (qHeader === undefined || qMeta === undefined || fHeader === undefined || fMeta === undefined ||
    qFontHeader === undefined || fFontHeader === undefined || fFontMeta === undefined || theme === undefined ||
    action === undefined || layoutHeader === undefined || layoutMeta === undefined || selectLabel === undefined ||
    indent === undefined || language === undefined || metricLabel === undefined || metricValue === undefined ||
    stepButton === undefined || indentMenuHeight === undefined || languageMenuHeight === undefined) return undefined;
  // Full's existing hit region is the cell itself, separated by6vp. Its
  // minimum contains the actual46vp paint, a usable native hit, and readable
  // ellipsized metadata; the transparent62.5 root/72.5 reference is not a min.
  const fullThemeColumns = columns(section - 4, Math.max(46, 44, theme.minimumLabelWidthVp + 10), 6);
  const quickFontColumns = columns(quick - 24, 44, 4);
  const fullFontColumns = columns(section, 44, 8);
  const fontWidth = Math.min((quick - 24 - (quickFontColumns - 1) * 4) / quickFontColumns,
    (section - (fullFontColumns - 1) * 8) / fullFontColumns);
  let fontHeight = 0;
  for (const font of input.fonts) {
    const style = TYPE_READER_APPEARANCE_RETAINED_FONT_CELL_PREVIEW;
    const measured = measureReaderControlText(context, font.label,
      new ReaderTextStyle(font.family, style.fontWeight ?? 400, style.fontSizeFp,
        style.lineHeightFp, style.letterSpacingFp, style.scalePolicy, style.source), fontWidth);
    if (measured === undefined) return undefined;
    fontHeight = Math.max(fontHeight, Math.ceil(measured.heightVp));
  }
  const triggerHeight = Math.max(30, Math.ceil(Math.max(indent.heightVp, language.heightVp)) + 15);
  const triggerWidth = Math.ceil(Math.max(indent.singleLineWidthVp, language.singleLineWidthVp)) + 38;
  const selectStacked = selectLabel.singleLineWidthVp + triggerWidth + 28 > section;
  const buttonWidth = Math.max(44, Math.ceil(stepButton.singleLineWidthVp) + 18);
  const valueWidth = Math.max(44, Math.ceil(metricValue.singleLineWidthVp) + 8);
  const glyphWidth = Math.max(26, Math.ceil(stepButton.singleLineWidthVp));
  const stepperWidth = buttonWidth * 2 + valueWidth - (buttonWidth - glyphWidth);
  const stepperStacked = metricLabel.singleLineWidthVp + stepperWidth + 26 > section;
  const rowMinimum = Math.max(42, Math.ceil(metricLabel.heightVp) + 24,
    Math.ceil(metricValue.heightVp) + 17, Math.ceil(stepButton.heightVp) + 17);
  // Quick paints only the 46vp swatch; the 62.5vp transparent motion root is
  // not a minimum column cell. Keep the original root centers and 4vp gap,
  // then partition native hit regions around those centers without overlap.
  // 40.5 = 2 * (root-left12 + swatch-inset8.25); 86.5 = 2 * 12 + root62.5.
  const quickThemeColumns = columns(quick - 40.5, 46, 4);
  const quickThemeStride = quickThemeColumns > 1 ? (quick - 86.5) / (quickThemeColumns - 1) : 62.5;
  const quickThemeHitWidth = quickThemeColumns > 1 ? Math.max(46, Math.min(62.5, quickThemeStride - 4)) : 62.5;
  const profile: ReaderControlAppearanceMinimumProfile = {
    quickThemeColumns, quickThemeHitWidth, fullThemeColumns,
    quickFontColumns, fullFontColumns,
    quickThemeHeaderHeight: Math.max(15.898, qHeader.heightVp, qMeta.heightVp + 3.95),
    fullThemeHeaderHeight: Math.max(20, fHeader.heightVp + 1, fMeta.heightVp + 3),
    quickFontHeaderHeight: Math.max(10, qFontHeader.heightVp),
    fullFontHeaderHeight: Math.max(16, fFontHeader.heightVp, fFontMeta.heightVp),
    themeLabelHeight: Math.max(13, Math.ceil(theme.heightVp)),
    themeActionHeight: Math.max(28, Math.ceil(action.heightVp) + 15),
    quickFontCellHeight: Math.max(27, fontHeight + 10), fullFontCellHeight: Math.max(30, fontHeight + 10),
    layoutHeaderHeight: Math.max(17, layoutHeader.heightVp, layoutMeta.heightVp),
    selectLabelHeight: Math.max(18, Math.ceil(selectLabel.heightVp)), selectTriggerHeight: triggerHeight,
    selectRowHeight: selectStacked ? Math.max(18, Math.ceil(selectLabel.heightVp)) + triggerHeight + 18 :
      Math.max(42, triggerHeight + 12, Math.ceil(selectLabel.heightVp) + 24),
    selectStacked, indentTriggerWidth: Math.ceil(indent.singleLineWidthVp) + 38,
    languageTriggerWidth: Math.ceil(language.singleLineWidthVp) + 38, indentMenuHeight, languageMenuHeight,
    stepperLabelHeight: Math.max(18, Math.ceil(metricLabel.heightVp)),
    stepperValueHeight: Math.max(25, Math.ceil(metricValue.heightVp)), stepperValueWidth: valueWidth,
    stepButtonTextHeight: Math.max(25, Math.ceil(stepButton.heightVp)), stepButtonTextWidth: glyphWidth,
    stepButtonWidth: buttonWidth, stepperRowHeight: stepperStacked ? rowMinimum +
      Math.max(18, Math.ceil(metricLabel.heightVp)) + 6 : rowMinimum, stepperStacked,
  };
  // Extra registered rows already use the original shared Scroll. Measure the
  // baseline eight theme/font choices as the viewport minimum, not the entire extent.
  const frame = sampleReaderControlAppearance(0, quick, 0, Math.min(8, input.themes.length),
    Math.min(8, input.fonts.length - 1), profile);
  const minFullWidth = Math.max(176, theme.minimumLabelWidthVp + 36,
    triggerWidth + 50, stepperWidth + 36, metricLabel.singleLineWidthVp + 50);
  const minimum: ReaderControlModuleMinimum = {
    module: 'appearance',
    quick: { heightVp: frame.quickContentHeight, minWidthVp: 86.5, fits: quick >= 86.5 },
    // One complete native row/header remains usable; the existing Full Scroll owns the full collection.
    full: { heightVp: Math.max(120, profile.fullThemeHeaderHeight + profile.themeLabelHeight + 75.8,
      profile.fullFontHeaderHeight + profile.fullFontCellHeight + 28,
      profile.layoutHeaderHeight + Math.max(profile.selectRowHeight, profile.stepperRowHeight) + 24),
      minWidthVp: minFullWidth, fits: full >= minFullWidth },
  };
  return { profile, minimum };
}

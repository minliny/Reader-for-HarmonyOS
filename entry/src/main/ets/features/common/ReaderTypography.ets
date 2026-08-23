import {
  READER_FONT_INTER,
  READER_FONT_NOTO_SANS_SC,
  READER_FONT_NOTO_SERIF_SC_BOLD,
  READER_FONT_NOTO_SERIF_SC_REGULAR,
} from './ReaderFontFamilies.ts';

/** The owner of a text size: app/system scaling or the reader appearance snapshot. */
export type ReaderFontScalePolicy = 'system' | 'readerAppearance';

/** Evidence carried with a role so a later audit can distinguish design facts from calibration. */
export type ReaderTypographySource =
  | 'figmaVariable'
  | 'figmaNode'
  | 'platformCalibration'
  | 'runtimeAppearance';

/**
 * Complete typography contract for a semantic role.
 *
 * `lineHeightFp === undefined` deliberately means ArkUI AUTO. This matters for
 * compact search inputs: replacing AUTO with a guessed numeric line height was
 * the defect that originally collapsed two independent values into one local
 * hard-coded pair.
 */
export class ReaderTextStyle {
  readonly fontFamily: string;
  readonly fontWeight: number;
  readonly fontSizeFp: number;
  readonly lineHeightFp: number | undefined;
  readonly letterSpacingFp: number | undefined;
  readonly scalePolicy: ReaderFontScalePolicy;
  readonly source: ReaderTypographySource;

  constructor(
    fontFamily: string,
    fontWeight: number,
    fontSizeFp: number,
    lineHeightFp: number | undefined,
    letterSpacingFp: number | undefined,
    scalePolicy: ReaderFontScalePolicy,
    source: ReaderTypographySource,
  ) {
    this.fontFamily = fontFamily;
    this.fontWeight = fontWeight;
    this.fontSizeFp = fontSizeFp;
    this.lineHeightFp = lineHeightFp;
    this.letterSpacingFp = letterSpacingFp;
    this.scalePolicy = scalePolicy;
    this.source = source;
  }
}

// Global semantic roles. Values intentionally preserve the audited Figma node
// geometry while callers stop owning the physical font tuple.
export const TYPE_APP_HOME_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 29, 38, undefined, 'system', 'figmaNode');
export const TYPE_PAGE_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 24, 33, undefined, 'system', 'figmaNode');
export const TYPE_SECTION_HEADING = new ReaderTextStyle(
  READER_FONT_INTER, 900, 13, 15.6, undefined, 'system', 'figmaNode');
export const TYPE_MAIN_TAB_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 11, 18, undefined, 'system', 'figmaNode');

// Shared-select variants. Similar controls retain independent roles whenever
// their Figma nodes differ; sharing the component never implies identical text.
export const TYPE_SELECT_APPEARANCE_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, 14.4, undefined, 'system', 'figmaNode');
export const TYPE_SELECT_SETTINGS_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 13, 15.6, undefined, 'system', 'figmaNode');
export const TYPE_SELECT_SOURCE_GROUP_VALUE = new ReaderTextStyle(
  READER_FONT_INTER, 400, 12, 14.52, undefined, 'system', 'figmaNode');
export const TYPE_SELECT_DEFAULT_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SELECT_OPTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 12, undefined, undefined, 'system', 'figmaNode');

// Search-field variants share input behavior but not geometry or typography.
export const TYPE_SEARCH_BOOK_INPUT = new ReaderTextStyle(
  READER_FONT_INTER, 400, 14, 21, undefined, 'system', 'figmaNode');
export const TYPE_SEARCH_SOURCE_INPUT = new ReaderTextStyle(
  READER_FONT_INTER, 400, 12, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SEARCH_DIRECTORY_INPUT = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 10, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SEARCH_READER_QUICK_INPUT = new ReaderTextStyle(
  READER_FONT_INTER, 400, 10, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SEARCH_RSS_HINT = new ReaderTextStyle(
  READER_FONT_INTER, 400, 14, undefined, undefined, 'system', 'figmaNode');

// The chapter title is a reading-surface role, but it is not user body text.
// Its line height remains owned by the responsive ReadingSurface layout map.
export const TYPE_READER_CHAPTER_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 23, undefined, undefined, 'system', 'figmaNode');
export const TYPE_READER_CONTROL_BOOK_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 16, undefined, undefined, 'system', 'figmaNode');
export const TYPE_READER_CONTROL_CHAPTER_SOURCE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_REGULAR, 400, 12, undefined, undefined, 'system', 'figmaNode');
export const TYPE_READER_CONTROL_SOURCE_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, undefined, undefined, 'system', 'figmaNode');

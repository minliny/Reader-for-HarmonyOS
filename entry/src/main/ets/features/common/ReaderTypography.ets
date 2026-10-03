import {
  READER_FONT_INTER,
  READER_FONT_NOTO_SANS_SC,
  READER_FONT_NOTO_SANS_SC_UI_REGULAR,
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

// SettingsSelectOverlay keeps separate phone and tablet option contracts.
// These roles preserve the audited tuples while removing their ownership from
// the overlay consumer; selected state may still raise only the weight.
export const TYPE_SETTINGS_SELECT_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 12, 14.4, 0.48, 'system', 'figmaNode');
export const TYPE_SETTINGS_SELECT_PHONE_OPTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 15, 18, undefined, 'system', 'figmaNode');
export const TYPE_SETTINGS_SELECT_PHONE_CANCEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 15, 18, undefined, 'system', 'figmaNode');
export const TYPE_SETTINGS_SELECT_TABLET_OPTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 14, 16.8, undefined, 'system', 'figmaNode');

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
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 16, 19.2, 0, 'system', 'figmaNode');
export const TYPE_READER_CONTROL_CHAPTER_SOURCE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_REGULAR, 400, 12, 14.4, 0, 'system', 'figmaNode');
export const TYPE_READER_CONTROL_SOURCE_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, 14.4, 0, 'system', 'figmaNode');
// The chapter switch row is a compact control role, separate from the
// top-bar chapter/source metadata. Its explicit line box prevents ArkUI from
// choosing a different auto baseline when the retained control tree is
// translated during the open/close morph.
export const TYPE_READER_CONTROL_CHAPTER_TITLE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 13, 16.25, 0, 'system', 'figmaNode');

// Bookshelf metadata stays on fixed physical families and explicit line boxes.
// These roles preserve the current Cover/List baseline while preventing the
// retained projection's opacity/translate transition from inheriting ArkUI's
// variable-font auto baseline for small author/chapter labels.
export const TYPE_SHELF_LIST_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 15, 18.3, 0, 'system', 'figmaNode');
export const TYPE_SHELF_LIST_AUTHOR = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, 15, 0, 'system', 'figmaNode');
export const TYPE_SHELF_LIST_CHAPTER = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 11, 13.75, 0, 'system', 'figmaNode');
export const TYPE_SHELF_LIST_STATUS = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 10, 12, 0, 'system', 'figmaNode');
export const TYPE_SHELF_CONTINUE_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 20, 24, 0, 'system', 'figmaNode');
export const TYPE_SHELF_CONTINUE_AUTHOR = new ReaderTextStyle(
  READER_FONT_INTER, 400, 14, 16.8, 0, 'system', 'figmaNode');
export const TYPE_SHELF_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 800, 13, 15.6, 0, 'system', 'figmaNode');

// Immersive page chrome. These roles currently share the Figma
// `Reader/ImmersiveMeta` tuple, but remain separate semantic contracts so a
// later design change to time, progress, or page ordinal does not couple the
// other corners by accident.
export const TYPE_READER_IMMERSIVE_TIME = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 12, 14.4, 0, 'system', 'figmaNode');
export const TYPE_READER_IMMERSIVE_PROGRESS = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 12, 14.4, 0, 'system', 'figmaNode');
export const TYPE_READER_IMMERSIVE_PAGE_ORDINAL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 12, 14.4, 0, 'system', 'figmaNode');
export const TYPE_READER_SESSION_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 10, 12.5, 0, 'system', 'figmaNode');
export const TYPE_READER_SESSION_COUNTDOWN = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 900, 8, 8, 0, 'system', 'figmaNode');

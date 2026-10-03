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
  | 'appBaseline'
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

/** A role may explicitly retain ArkUI's inherited family or default weight.
 * Consumers must omit undefined modifiers, rather than inventing a font tuple
 * during architecture migration. Existing fully specified roles stay strict. */
export class ReaderInheritedTextStyle {
  readonly fontFamily: string | undefined;
  readonly fontWeight: number | undefined;
  readonly fontSizeFp: number;
  readonly lineHeightFp: number | undefined;
  readonly letterSpacingFp: number | undefined;
  readonly scalePolicy: ReaderFontScalePolicy;
  readonly source: ReaderTypographySource;

  constructor(
    fontFamily: string | undefined,
    fontWeight: number | undefined,
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

// Search result rows keep their current card geometry while moving all of the
// cover, metadata and tag text tuples into named semantic roles. These roles
// intentionally preserve the existing values; the later visual pass can tune
// the whole result surface without leaving page-local font literals behind.
export const TYPE_SEARCH_RESULT_COVER_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 9, 11.7, undefined, 'system', 'figmaNode');
export const TYPE_SEARCH_RESULT_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 15, 19.5, undefined, 'system', 'figmaNode');
export const TYPE_SEARCH_RESULT_AUTHOR = new ReaderTextStyle(
  READER_FONT_INTER, 400, 12, 12, undefined, 'system', 'figmaNode');
export const TYPE_SEARCH_RESULT_CHAPTER = new ReaderTextStyle(
  READER_FONT_INTER, 400, 11, 11, undefined, 'system', 'figmaNode');
export const TYPE_SEARCH_RESULT_INTRO = new ReaderTextStyle(
  READER_FONT_INTER, 400, 12, 18, undefined, 'system', 'figmaNode');
export const TYPE_SEARCH_RESULT_TAG = new ReaderTextStyle(
  READER_FONT_INTER, 700, 10, 15, undefined, 'system', 'figmaNode');

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

// Source-switch candidates keep their compact Figma text tuples separate so
// the shared typography owner can change the row as one unit without changing
// its latency/chapter column geometry or state-specific colors.
export const TYPE_SOURCE_SWITCH_NAME = new ReaderTextStyle(
  READER_FONT_INTER, 500, 10, 12, undefined, 'system', 'figmaNode');
export const TYPE_SOURCE_SWITCH_LATENCY = new ReaderTextStyle(
  READER_FONT_INTER, 400, 9, 10, undefined, 'system', 'figmaNode');
export const TYPE_SOURCE_SWITCH_CHAPTER = new ReaderTextStyle(
  READER_FONT_INTER, 500, 9, 10, undefined, 'system', 'figmaNode');

// Source-management rows use one compact metadata tuple for category, URL and
// the optional latest-check summary. They remain a single role so those three
// fields cannot drift while the primary source title keeps its own role.
export const TYPE_SOURCE_MANAGEMENT_META = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 10, 12.5, undefined, 'system', 'figmaNode');

// Source-tools is migrated as one complete text family. AUTO is deliberate:
// default weights, inherited list metadata and natural line boxes preserve the
// current application baseline alongside explicitly authored bold controls.
export const TYPE_SOURCE_TOOLS_HEADING = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 14, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_COMPACT_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_BODY = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_HINT = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_CAPTION = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_NOTE = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 10, 16, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_DESCRIPTION = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 11, 17, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_STATUS = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 12, 18, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_URL = new ReaderInheritedTextStyle(
  READER_FONT_INTER, undefined, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_DEBUG_ID = new ReaderInheritedTextStyle(
  READER_FONT_INTER, undefined, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_CODE_INPUT = new ReaderInheritedTextStyle(
  'monospace', undefined, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_DEBUG_LOG = new ReaderInheritedTextStyle(
  'monospace', undefined, 10, 16, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_TOOLS_INHERITED_META = new ReaderInheritedTextStyle(
  undefined, undefined, 10, undefined, undefined, 'system', 'appBaseline');

// RulesManagementPage keeps its current compact editor geometry while moving
// the three repeated text tuples into named semantic roles. These values are
// deliberately identical to the existing page-local tuples; this slice only
// changes ownership so a later visual pass can update the rules surface from
// one place without changing its current baseline.
export const TYPE_RULES_MANAGEMENT_HEADING = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 14, undefined, undefined, 'system', 'figmaNode');
export const TYPE_RULES_MANAGEMENT_INPUT = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 12, undefined, undefined, 'system', 'figmaNode');
export const TYPE_RULES_MANAGEMENT_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, undefined, undefined, 'system', 'figmaNode');

// The bookshelf-management surface is a real product page rather than a
// diagnostic view. Keep its existing tuples in named roles so the page no
// longer owns a second set of physical font literals. Roles remain separate
// where the current line box, family or weight differs; introducing this
// contract must not change the baseline UI before the later visual pass.
export const TYPE_SHELF_MANAGEMENT_NOTE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 10, 16, undefined, 'system', 'figmaNode');
export const TYPE_SHELF_MANAGEMENT_STATUS = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 12, 18, undefined, 'system', 'figmaNode');
export const TYPE_SHELF_MANAGEMENT_BODY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 12, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SHELF_MANAGEMENT_BODY_MUTED = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 11, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SHELF_MANAGEMENT_META = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 10, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SHELF_MANAGEMENT_GROUP_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 13, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SHELF_MANAGEMENT_ROW_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 11, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SHELF_MANAGEMENT_BOOK_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SHELF_MANAGEMENT_HEADING = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 16, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SHELF_MANAGEMENT_BUTTON = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, undefined, undefined, 'system', 'figmaNode');
export const TYPE_SHELF_MANAGEMENT_SMALL_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 10, undefined, undefined, 'system', 'figmaNode');

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

// Complete conventional application families. The finite role catalogue keeps
// the current app baseline, including inherited family/weight and AUTO line
// boxes; pages retain business state, responsive choice and geometry only.
export const TYPE_FORM_BODY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 13, undefined, undefined, 'system', 'appBaseline');
export const TYPE_FORM_LABEL_ACTION = TYPE_SHELF_MANAGEMENT_GROUP_TITLE;
export const TYPE_FORM_STATE_BODY = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 14, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SHELF_EMPTY_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 19, undefined, undefined, 'system', 'appBaseline');
export const TYPE_APP_SECTION_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 700, 15, 18, undefined, 'system', 'appBaseline');
export const TYPE_APP_INHERITED_BODY = new ReaderInheritedTextStyle(
  undefined, undefined, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_APP_FILTER_OPTION = new ReaderTextStyle(
  READER_FONT_INTER, 500, 12, 18, undefined, 'system', 'appBaseline');
export const TYPE_SHELF_SELECTION_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 13, 15.6, undefined, 'system', 'appBaseline');
export const TYPE_SHELF_SELECTION_HEADING = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 24, 34.49, undefined, 'system', 'appBaseline');
export const TYPE_SHELF_SELECTION_CHECK = new ReaderTextStyle(
  READER_FONT_INTER, 700, 14, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SHELF_SELECTION_REMOVE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 11, 13.31, undefined, 'system', 'appBaseline');
export const TYPE_APP_INHERITED_STATE = new ReaderInheritedTextStyle(
  undefined, undefined, 14, undefined, undefined, 'system', 'appBaseline');
export const TYPE_APP_COMPACT_BADGE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_APP_INHERITED_LABEL = new ReaderInheritedTextStyle(
  undefined, undefined, 15, undefined, undefined, 'system', 'appBaseline');
export const TYPE_APP_INHERITED_OPTION = new ReaderInheritedTextStyle(
  undefined, undefined, 13, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SHELF_STATE_TITLE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 17, 25.5, undefined, 'system', 'appBaseline');
export const TYPE_APP_BODY = new ReaderTextStyle(
  READER_FONT_INTER, 400, 13, 19.5, undefined, 'system', 'appBaseline');
export const TYPE_APP_PRIMARY_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 800, 13, 13, undefined, 'system', 'appBaseline');
export const TYPE_BOOK_DETAIL_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 22, 25.96, undefined, 'system', 'appBaseline');
export const TYPE_BOOK_DETAIL_AUTHOR = new ReaderTextStyle(
  READER_FONT_INTER, 400, 13, 17.55, undefined, 'system', 'appBaseline');
export const TYPE_BOOK_DETAIL_META = new ReaderTextStyle(
  READER_FONT_INTER, 700, 12, 15, undefined, 'system', 'appBaseline');
export const TYPE_BOOK_DETAIL_SOURCE_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 900, 9, 12, undefined, 'system', 'appBaseline');
export const TYPE_BOOK_DETAIL_DESCRIPTION = new ReaderTextStyle(
  READER_FONT_INTER, 400, 13, 21.45, undefined, 'system', 'appBaseline');
export const TYPE_APP_COMPACT_PRIMARY_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 900, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_BOOK_DETAIL_EMPTY = new ReaderInheritedTextStyle(
  READER_FONT_INTER, undefined, 13, 21.45, undefined, 'system', 'appBaseline');
export const TYPE_BOOK_DIRECTORY_ENTRY = TYPE_SEARCH_RSS_HINT;
export const TYPE_BOOK_DETAIL_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 900, 13, 14.3, undefined, 'system', 'appBaseline');
export const TYPE_FILE_IMPORT_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 18, 24.75, undefined, 'system', 'appBaseline');
export const TYPE_FILE_IMPORT_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 700, 13, 19.5, -0.0762, 'system', 'appBaseline');
export const TYPE_FILE_IMPORT_HINT = new ReaderTextStyle(
  READER_FONT_INTER, 400, 11, 16.5, 0.0645, 'system', 'appBaseline');
export const TYPE_FILE_IMPORT_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 800, 13, 19.5, -0.0762, 'system', 'appBaseline');
export const TYPE_FILE_IMPORT_CANCEL = new ReaderTextStyle(
  READER_FONT_INTER, 600, 13, 19.5, -0.0762, 'system', 'appBaseline');
export const TYPE_FILE_IMPORT_PROGRESS = new ReaderTextStyle(
  READER_FONT_INTER, 600, 14, 21, undefined, 'system', 'appBaseline');
export const TYPE_FILE_IMPORT_WAIT = new ReaderTextStyle(
  READER_FONT_INTER, 400, 11, 16.5, undefined, 'system', 'appBaseline');
export const TYPE_FILE_IMPORT_NAME = new ReaderTextStyle(
  READER_FONT_INTER, 600, 12, 18, undefined, 'system', 'appBaseline');
export const TYPE_APP_INHERITED_HINT = new ReaderInheritedTextStyle(
  undefined, undefined, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_FILE_IMPORT_BADGE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 10, 15, 0.3672, 'system', 'appBaseline');
export const TYPE_JSON_IMPORT_DESCRIPTION = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 12, 19, undefined, 'system', 'appBaseline');
export const TYPE_FORM_ACTION = TYPE_SHELF_MANAGEMENT_BUTTON;
export const TYPE_FORM_URL_INPUT = new ReaderInheritedTextStyle(
  READER_FONT_INTER, undefined, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_FORM_NOTE = TYPE_SOURCE_TOOLS_NOTE;
export const TYPE_DIALOG_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 13, 16, undefined, 'system', 'appBaseline');
export const TYPE_APP_SEGMENT_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 700, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SELECT_LIBRARY_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 11, 15, undefined, 'system', 'appBaseline');
export const TYPE_DISCOVER_SOURCE_META = new ReaderTextStyle(
  READER_FONT_INTER, 600, 11, 13.2, undefined, 'system', 'appBaseline');
export const TYPE_DISCOVER_CATEGORY = new ReaderTextStyle(
  READER_FONT_INTER, 800, 12, 15.6, undefined, 'system', 'appBaseline');
export const TYPE_DISCOVER_FILTER_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 900, 12, 15.6, undefined, 'system', 'appBaseline');
export const TYPE_DISCOVER_FILTER_VALUE = new ReaderTextStyle(
  READER_FONT_INTER, 800, 11, 15.56, undefined, 'system', 'appBaseline');
export const TYPE_DISCOVER_RANK_TITLE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 15, 18.75, undefined, 'system', 'appBaseline');
export const TYPE_DISCOVER_STATE_TITLE = new ReaderTextStyle(
  READER_FONT_INTER, 800, 14, 18, undefined, 'system', 'appBaseline');
export const TYPE_DISCOVER_STATUS = new ReaderTextStyle(
  READER_FONT_INTER, 400, 12, 15, undefined, 'system', 'appBaseline');
export const TYPE_APP_SMALL_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 700, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_DISCOVER_AUTHOR = new ReaderTextStyle(
  READER_FONT_INTER, 700, 11, 15.56, undefined, 'system', 'appBaseline');
export const TYPE_DISCOVER_INTRO = new ReaderTextStyle(
  READER_FONT_INTER, 400, 12, 17.4, undefined, 'system', 'appBaseline');
export const TYPE_RSS_SOURCE_TITLE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 13, undefined, undefined, 'system', 'appBaseline');
export const TYPE_RSS_META = TYPE_SEARCH_READER_QUICK_INPUT;
export const TYPE_RSS_LINK_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 900, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_RSS_ARTICLE_TITLE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 20, 26, undefined, 'system', 'appBaseline');
export const TYPE_APP_SMALL_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 800, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_RSS_ARTICLE_BODY = new ReaderTextStyle(
  READER_FONT_INTER, 400, 15, 26, undefined, 'system', 'appBaseline');
export const TYPE_RSS_BOTTOM_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 900, 13, undefined, undefined, 'system', 'appBaseline');
export const TYPE_RSS_HOME_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 29, 41, undefined, 'system', 'appBaseline');
export const TYPE_RSS_REFRESH_STATUS = new ReaderTextStyle(
  READER_FONT_INTER, 800, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_RSS_SECTION_HEADING = new ReaderTextStyle(
  READER_FONT_INTER, 700, 15, undefined, undefined, 'system', 'appBaseline');
export const TYPE_RSS_UNREAD_COUNT = new ReaderTextStyle(
  READER_FONT_INTER, 900, 16, undefined, undefined, 'system', 'appBaseline');
export const TYPE_RSS_ENTRY_TITLE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 13, 16.25, undefined, 'system', 'appBaseline');
export const TYPE_RSS_ENTRY_DESCRIPTION = new ReaderTextStyle(
  READER_FONT_INTER, 400, 11, 15.95, undefined, 'system', 'appBaseline');
export const TYPE_RSS_STATE_TITLE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 17, 21.25, undefined, 'system', 'appBaseline');
export const TYPE_RSS_STATE_BODY = new ReaderTextStyle(
  READER_FONT_INTER, 400, 12, 18.6, undefined, 'system', 'appBaseline');
export const TYPE_RSS_ERROR_REASON = new ReaderTextStyle(
  READER_FONT_INTER, 400, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_RSS_STATE_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 800, 13, undefined, undefined, 'system', 'appBaseline');
export const TYPE_FORM_STATUS = TYPE_SOURCE_TOOLS_STATUS;
export const TYPE_FORM_HINT = TYPE_SOURCE_TOOLS_HINT;
export const TYPE_FORM_SECTION_HEADING = TYPE_RULES_MANAGEMENT_HEADING;
export const TYPE_FORM_INPUT = TYPE_SOURCE_TOOLS_BODY;
export const TYPE_SEARCH_HISTORY_STATUS = new ReaderInheritedTextStyle(
  READER_FONT_INTER, undefined, 13, 20, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_HISTORY_HEADING = new ReaderTextStyle(
  READER_FONT_INTER, 700, 13, 19.5, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_HISTORY_KEYWORD = new ReaderTextStyle(
  READER_FONT_INTER, 500, 13, 19.5, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_PROGRESS_META = TYPE_FILE_IMPORT_WAIT;
export const TYPE_SEARCH_RESULT_COUNT = new ReaderTextStyle(
  READER_FONT_INTER, 700, 11, 16.5, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_STATE_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 17, 25.5, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_STATE_DESCRIPTION = new ReaderTextStyle(
  READER_FONT_INTER, 400, 13, 21.125, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_SUGGESTION_HEADING = new ReaderTextStyle(
  READER_FONT_INTER, 700, 12, 18, undefined, 'system', 'appBaseline');
export const TYPE_APP_SECONDARY_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 700, 13, 13, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_SUGGESTION_BODY = new ReaderTextStyle(
  READER_FONT_INTER, 400, 12, 19.5, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_RETRY_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 800, 14, 14, undefined, 'system', 'appBaseline');
export const TYPE_APP_ROW_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 800, 13, 15.34, undefined, 'system', 'appBaseline');
export const TYPE_RULES_INHERITED_DESCRIPTION = new ReaderInheritedTextStyle(
  undefined, undefined, 11, 17, undefined, 'system', 'appBaseline');
export const TYPE_RULES_INHERITED_NOTE = new ReaderInheritedTextStyle(
  undefined, undefined, 10, 16, undefined, 'system', 'appBaseline');
export const TYPE_RULES_ENTITY_TITLE = new ReaderInheritedTextStyle(
  undefined, 700, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_APP_INHERITED_CAPTION = TYPE_SOURCE_TOOLS_INHERITED_META;
export const TYPE_RULES_COMPACT_ACTION = new ReaderInheritedTextStyle(
  undefined, 700, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SETTINGS_CACHE_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 800, 11, 16, undefined, 'system', 'appBaseline');
export const TYPE_SETTINGS_DANGER_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 400, 16, 19.2, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_MANAGEMENT_COUNT = new ReaderTextStyle(
  READER_FONT_INTER, 400, 10, 12.5, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_MANAGEMENT_STATUS = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 11, 16, undefined, 'system', 'appBaseline');
export const TYPE_FORM_COMPACT_ACTION = TYPE_SOURCE_TOOLS_COMPACT_ACTION;
export const TYPE_SOURCE_STATE_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 15, 22, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_MANAGEMENT_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 13, 15.34, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_HEADING = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_REGULAR, 500, 11, 12.32, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_SORT = new ReaderTextStyle(
  READER_FONT_INTER, 400, 9, 12, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_COLUMN = new ReaderTextStyle(
  READER_FONT_INTER, 400, 8, undefined, undefined, 'system', 'appBaseline');
export const TYPE_APP_LOADING_BODY = new ReaderTextStyle(
  READER_FONT_INTER, 400, 13, 20, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_MESSAGE = new ReaderTextStyle(
  READER_FONT_INTER, 400, 11, 16, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_RECOVERY = new ReaderTextStyle(
  READER_FONT_INTER, 700, 12, 12, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_FOOTER = new ReaderTextStyle(
  READER_FONT_INTER, 400, 8, 12, undefined, 'system', 'appBaseline');
export const TYPE_SYNC_MUTED_HEADING = new ReaderTextStyle(
  READER_FONT_INTER, 900, 11, undefined, 1.1, 'system', 'appBaseline');
export const TYPE_SYNC_INPUT = new ReaderTextStyle(
  READER_FONT_INTER, 600, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SYNC_CONFLICT_META = new ReaderInheritedTextStyle(
  READER_FONT_INTER, undefined, 11, 17, undefined, 'system', 'appBaseline');
export const TYPE_SYNC_ROW_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 600, 13, undefined, undefined, 'system', 'appBaseline');
export const TYPE_SYNC_BACKUP_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 700, 13, 16, undefined, 'system', 'appBaseline');
export const TYPE_SYNC_HISTORY_STATUS = TYPE_SEARCH_SOURCE_INPUT;
export const TYPE_SHELF_SELECTION_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 13, 16, undefined, 'system', 'appBaseline');
export const TYPE_SHELF_SELECTION_TITLE_WIDE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 16, 19.5, undefined, 'system', 'appBaseline');
export const TYPE_SHELF_SELECTION_AUTHOR = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 11, 13.5, undefined, 'system', 'appBaseline');
export const TYPE_SHELF_SELECTION_AUTHOR_WIDE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 13, 16, undefined, 'system', 'appBaseline');
export const TYPE_SHELF_COVER_PLACEHOLDER = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 15, 18.3, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_FIELD_ACTION = TYPE_APP_PRIMARY_ACTION;
export const TYPE_SEARCH_FIELD_ACTION_WIDE = TYPE_SEARCH_RETRY_ACTION;
export const TYPE_SEARCH_SCOPE_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 500, 12, 12, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_SCOPE_SELECTED = TYPE_SOURCE_SWITCH_RECOVERY;

// The appearance library uses physical static faces in both retained states.
// The consumer still owns selected-state choice and native variable-font options.
export const TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 11, 13, undefined, 'system', 'appBaseline');
export const TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 11, 13, undefined, 'system', 'appBaseline');

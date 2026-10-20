import {
  READER_FONT_INTER,
  READER_FONT_NOTO_SANS_SC,
  READER_FONT_NOTO_SANS_SC_UI_REGULAR,
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_600,
  READER_FONT_NOTO_SANS_SC_UI_BOLD,
  READER_FONT_NOTO_SERIF_SC_BOLD,
  READER_FONT_NOTO_SERIF_SC_REGULAR,
} from './ReaderFontFamilies.ts';
import { DOWNLOAD_VISUAL } from './SharedDownloadVisualSpec.ts';
import { MANGA_DIRECTORY_VISUAL } from '../manga/MangaDirectoryVisual';

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
  READER_FONT_NOTO_SANS_SC_UI_BOLD, 700, 11, 18, undefined, 'system', 'figmaNode');

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
// The frozen complex-directory demo specifies an explicit 13/20 line box.
export const TYPE_SEARCH_MANGA_DIRECTORY_INPUT = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, MANGA_DIRECTORY_VISUAL.searchFontSize,
  MANGA_DIRECTORY_VISUAL.searchLineHeight, undefined, 'system', 'appBaseline');
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
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 15, 18, 0, 'system', 'figmaNode');
export const TYPE_SHELF_LIST_AUTHOR = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 11, 14, 0, 'system', 'figmaNode');
export const TYPE_SHELF_LIST_CHAPTER = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 11, 14, 0, 'system', 'figmaNode');
export const TYPE_SHELF_LIST_STATUS = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 11, 14, 0, 'system', 'figmaNode');
// Approved compact shelf design: content/origin tags remain independent of
// chapter progress, with the same fixed face used by adjacent metadata.
export const TYPE_SHELF_METADATA_TAG = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 9, 16, 0, 'system', 'figmaNode');
export const TYPE_SHELF_CONTINUE_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 500, 11, 18, 0, 'system', 'figmaNode');
export const TYPE_SHELF_CONTINUE_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 16, 23, 0, 'system', 'figmaNode');
export const TYPE_SHELF_CONTINUE_AUTHOR = new ReaderTextStyle(
  READER_FONT_INTER, 400, 11, 15, 0, 'system', 'figmaNode');
export const TYPE_SHELF_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 700, 12, 16, 0, 'system', 'figmaNode');

// Source-switch candidates keep their compact Figma text tuples separate so
// the shared typography owner can change the row as one unit without changing
// its latency/chapter column geometry or state-specific colors.
export const TYPE_SOURCE_SWITCH_NAME = new ReaderTextStyle(
  READER_FONT_INTER, 500, 10, 12, undefined, 'system', 'figmaNode');
export const TYPE_SOURCE_SWITCH_LATENCY = new ReaderTextStyle(
  READER_FONT_INTER, 400, 9, 10, undefined, 'system', 'figmaNode');
export const TYPE_SOURCE_SWITCH_CHAPTER = new ReaderTextStyle(
  READER_FONT_INTER, 500, 9, 10, undefined, 'system', 'figmaNode');

// Selected 2026-10-06 novel source drawer.
// Generated from Reader-UI/design/source-switch/source-switch.visual.json. Do not edit.
// SHA256 205de7f89121243e6ef4490f4863c6f4874e928a7eb5a66f52b41f0275c8d977
// Historical compact-popup and manga roles above are unchanged. Static UI
// Regular/Medium faces and Inter axes 400/500 are shared with the generated reference.
export const TYPE_SOURCE_SWITCH_NOVEL_HEADING = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 24, 32.4, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_BOOK_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 18, 25.2, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_METADATA = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 13, 19.5, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_CAPTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, 19.2, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_CURRENT_SOURCE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 500, 12, 19.2, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_COLUMN = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 11, 16.5, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 500, 13, 20, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, 20, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_COUNT = new ReaderTextStyle(
  READER_FONT_INTER, 500, 14, 20, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_PHASE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 11, 16.5, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_NAME = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 500, 14, 20, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_CHAPTER = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, 18, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_LATENCY = new ReaderTextStyle(
  READER_FONT_INTER, 400, 13, 20, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_LATENCY_UNIT = new ReaderTextStyle(
  READER_FONT_INTER, 400, 11, 20, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_FOOTER = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, 18, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_EMPTY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 13, 22.1, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_TOAST = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, 19.8, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_SWITCH_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, 700, 20, 30, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_SWITCH_SOURCE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 500, 15, 24, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_SWITCH_STATUS = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 13, 22.1, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_SWITCH_CAPTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, 20.4, undefined, 'system', 'appBaseline');
export const TYPE_SOURCE_SWITCH_NOVEL_ACTION_COMPACT = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 500, 12, 20, undefined, 'system', 'appBaseline');

export const TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS_NARROW = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 11, 20, undefined, 'system', 'appBaseline');

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
// Search/stop labels share a row with the native loading indicator. Keep the
// original face, weight and size, but admit the CJK fallback line metrics.
export const TYPE_SEARCH_FIELD_ACTION = new ReaderTextStyle(
  READER_FONT_INTER, 800, 13, 20, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_FIELD_ACTION_WIDE = new ReaderTextStyle(
  READER_FONT_INTER, 800, 14, 22, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_SCOPE_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 500, 12, 12, undefined, 'system', 'appBaseline');
export const TYPE_SEARCH_SCOPE_SELECTED = TYPE_SOURCE_SWITCH_RECOVERY;

// The appearance library uses physical static faces in both retained states.
// The consumer still owns selected-state choice and native variable-font options.
export const TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 11, 13, undefined, 'system', 'appBaseline');
export const TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 11, 13, undefined, 'system', 'appBaseline');

// Directory/bookmark chrome uses finite shared roles in both retained and
// compatibility panels. Content, state, hierarchy and motion remain untouched.
export const TYPE_READER_DIRECTORY_HEADING = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 14, 20, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_COLLAPSE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 10, 14, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_TAB = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 600, 11, 16, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_TITLE_INTER = new ReaderTextStyle(
  READER_FONT_INTER, 500, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_CURRENT_TITLE = TYPE_SOURCE_TOOLS_COMPACT_ACTION;
export const TYPE_READER_DIRECTORY_POSITION_INTER = new ReaderTextStyle(
  READER_FONT_INTER, 400, 9, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_BOOKMARK_EMPTY_TITLE = TYPE_DIALOG_ACTION;
export const TYPE_READER_BOOKMARK_BODY = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 10, 14, undefined, 'system', 'appBaseline');
export const TYPE_READER_BOOKMARK_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_BOOKMARK_LOADING = TYPE_SOURCE_TOOLS_CAPTION;
export const TYPE_READER_BOOKMARK_CHAPTER = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 11, 14, undefined, 'system', 'appBaseline');
export const TYPE_READER_BOOKMARK_META = new ReaderInheritedTextStyle(
  READER_FONT_INTER, undefined, 9, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_BOOKMARK_PENDING = new ReaderInheritedTextStyle(
  undefined, undefined, 8, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_BOOKMARK_PENDING_LEGACY = new ReaderInheritedTextStyle(
  READER_FONT_INTER, undefined, 8, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_BOOKMARK_EXCERPT = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_REGULAR, 400, 9, 14, undefined, 'system', 'appBaseline');
export const TYPE_READER_BOOKMARK_EXCERPT_LEGACY = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_REGULAR, 400, 9, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_TAB_COMPACT = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 11, 16, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_POSITION = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 9, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_TAB_LEGACY = new ReaderTextStyle(
  READER_FONT_INTER, 500, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_TITLE_LEGACY = new ReaderTextStyle(
  READER_FONT_INTER, 500, 11, 12.32, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_DISCLOSURE = new ReaderInheritedTextStyle(
  undefined, undefined, 18, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_RULE_HEADING = new ReaderInheritedTextStyle(
  undefined, 700, 14, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_BOOK_TITLE = TYPE_SHELF_MANAGEMENT_HEADING;
export const TYPE_READER_DIRECTORY_CHAPTER = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_REGULAR, 400, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_DIRECTORY_SOURCE_ACTION = TYPE_RSS_REFRESH_STATUS;
export const TYPE_READER_DIRECTORY_OFFLINE_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 13, undefined, undefined, 'system', 'appBaseline');

// Remaining panel chrome keeps the retained and compatibility contracts
// together. Finite role aliases reuse identical physical contracts; live
// preview faces and motion expressions remain with their existing owner.
export const TYPE_READER_APPEARANCE_FULL_COMPAT_HEADER_LABEL = TYPE_READER_DIRECTORY_HEADING;
export const TYPE_READER_APPEARANCE_FULL_COMPAT_HEADER_COLLAPSE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 10, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_FULL_COMPAT_THEME_LIBRARY_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, 17, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_FULL_COMPAT_THEME_LIBRARY_META = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 10, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_FULL_COMPAT_FULL_THEME_CARD_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 9, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_FULL_COMPAT_THEME_ACTION_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 9, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_FULL_COMPAT_FONT_LIBRARY_LABEL = TYPE_SELECT_APPEARANCE_VALUE;
export const TYPE_READER_APPEARANCE_FULL_COMPAT_FONT_LIBRARY_LABEL_SECONDARY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_FULL_COMPAT_FULL_FONT_CELL_PREVIEW = new ReaderInheritedTextStyle(
  undefined, 400, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_FULL_COMPAT_TYPOGRAPHY_LIBRARY_LABEL = TYPE_READER_APPEARANCE_FULL_COMPAT_THEME_LIBRARY_LABEL;
export const TYPE_READER_APPEARANCE_FULL_COMPAT_TYPOGRAPHY_LIBRARY_LABEL_SECONDARY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 10, 14, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_FULL_COMPAT_INDENT_ROW_LABEL = TYPE_READER_DIRECTORY_COLLAPSE;
export const TYPE_READER_APPEARANCE_FULL_COMPAT_INDENT_OPTION_LABEL = TYPE_READER_DIRECTORY_POSITION;
export const TYPE_READER_APPEARANCE_FULL_COMPAT_SELECT_FIELD_VALUE = TYPE_READER_DIRECTORY_COLLAPSE;
export const TYPE_READER_APPEARANCE_FULL_COMPAT_SELECT_FIELD_VALUE_SECONDARY = TYPE_READER_BOOKMARK_ACTION;
export const TYPE_READER_APPEARANCE_FULL_COMPAT_STEPPER_ROW_VALUE = TYPE_READER_DIRECTORY_TAB_COMPACT;
export const TYPE_READER_APPEARANCE_FULL_COMPAT_STEPPER_ROW_VALUE_SECONDARY = TYPE_APP_SMALL_LABEL;
export const TYPE_READER_APPEARANCE_FULL_COMPAT_STEP_BUTTON_VALUE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 10, 14, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_QUICK_COMPAT_THEME_SECTION_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 9, 9.9, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_QUICK_COMPAT_FONT_SECTION_LABEL = TYPE_READER_APPEARANCE_QUICK_COMPAT_THEME_SECTION_LABEL;
export const TYPE_READER_APPEARANCE_QUICK_COMPAT_COMPACT_FONT_CELL_PREVIEW = new ReaderInheritedTextStyle(
  undefined, 400, 8, 10, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_SHARED_COMPAT_SHARED_THEME_HEADER_LABEL = TYPE_READER_APPEARANCE_QUICK_COMPAT_THEME_SECTION_LABEL;
export const TYPE_READER_APPEARANCE_SHARED_COMPAT_SHARED_THEME_HEADER_META = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 7.5, 8, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_SHARED_COMPAT_SHARED_FONT_HEADER_LABEL = TYPE_READER_APPEARANCE_QUICK_COMPAT_THEME_SECTION_LABEL;
export const TYPE_READER_APPEARANCE_SHARED_COMPAT_SHARED_FONT_CELL_PREVIEW = TYPE_READER_APPEARANCE_QUICK_COMPAT_COMPACT_FONT_CELL_PREVIEW;
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_HEADER_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 700, 14, 16.8, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_HEADER_COLLAPSE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 10, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_COLLAPSED_BACK_ACTOR_BACK = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 10, 10, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_CONTROL_SECTION_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 700, 12, 14.4, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_CONTROL_SECTION_LABEL_SECONDARY = TYPE_SOURCE_SWITCH_NAME;
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_CHAPTER_BUTTON_VALUE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 9, 9, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_RUNNING_BUTTON_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 800, 9, 9, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_STOP_BUTTON_LABEL = TYPE_READER_AUTO_PAGE_FULL_COMPAT_CHAPTER_BUTTON_VALUE;
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_TIMER_SECTION_LABEL = TYPE_READER_AUTO_PAGE_FULL_COMPAT_CONTROL_SECTION_LABEL;
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_TIMER_SECTION_META = TYPE_SOURCE_SWITCH_NAME;
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_TIMER_SECTION_LABEL_SECONDARY = new ReaderTextStyle(
  READER_FONT_INTER, 700, 11, 11, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_TIMER_SECTION_LABEL_TERTIARY = new ReaderTextStyle(
  READER_FONT_INTER, 800, 18, 22, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_TIMER_WHEEL_VALUE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 8, 8, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_DETAILS_SECTION_LABEL = TYPE_READER_AUTO_PAGE_FULL_COMPAT_CONTROL_SECTION_LABEL;
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_DETAILS_SECTION_LABEL_SECONDARY = TYPE_SOURCE_SWITCH_NAME;
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_SPEED_ROW_LABEL = TYPE_READER_AUTO_PAGE_FULL_COMPAT_HEADER_COLLAPSE;
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_SPEED_ROW_LABEL_SECONDARY = new ReaderTextStyle(
  READER_FONT_INTER, 400, 10, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_SPEED_ROW_LABEL_TERTIARY = new ReaderTextStyle(
  READER_FONT_INTER, 400, 9, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_FULL_COMPAT_FOLLOW_HIGHLIGHT_ROW_LABEL = TYPE_READER_AUTO_PAGE_FULL_COMPAT_HEADER_COLLAPSE;
export const TYPE_READER_AUTO_PAGE_QUICK_COMPAT_HEADER_BACK = TYPE_READER_AUTO_PAGE_FULL_COMPAT_COLLAPSED_BACK_ACTOR_BACK;
export const TYPE_READER_AUTO_PAGE_QUICK_COMPAT_CHAPTER_CONTROL_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 9, 9, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_QUICK_COMPAT_RUNNING_CONTROL_LABEL = TYPE_READER_AUTO_PAGE_QUICK_COMPAT_CHAPTER_CONTROL_VALUE;
export const TYPE_READER_AUTO_PAGE_QUICK_COMPAT_STOP_CONTROL_LABEL = TYPE_READER_AUTO_PAGE_QUICK_COMPAT_CHAPTER_CONTROL_VALUE;
export const TYPE_READER_AUTO_PAGE_QUICK_COMPAT_SPEED_CONTROL_LABEL = TYPE_SOURCE_TOOLS_COMPACT_ACTION;
export const TYPE_READER_AUTO_PAGE_QUICK_COMPAT_SPEED_CONTROL_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 900, 11, 11, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_QUICK_COMPAT_SPEED_BUTTON_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 800, 18, 18, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 9, 9.9, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 7.5, 8, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL_SECONDARY = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 12, 17, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META_SECONDARY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 9, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_THEME_SHELL_VALUE = TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META_SECONDARY;
export const TYPE_READER_APPEARANCE_RETAINED_THEME_ACTION_VALUE = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 9, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL = TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL;
export const TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_SECONDARY = new ReaderTextStyle(
  'ReaderNotoSansSCUIMedium', 500, 13, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_TERTIARY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_FONT_CELL_PREVIEW = new ReaderInheritedTextStyle(
  undefined, 400, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL = new ReaderTextStyle(
  'ReaderNotoSansSCUIMedium', 500, 13, 17, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL_SECONDARY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 10, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_SELECT_FIELD_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, 18, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE = TYPE_READER_APPEARANCE_RETAINED_SELECT_FIELD_VALUE;
export const TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE_SECONDARY = new ReaderTextStyle(
  'ReaderNotoSansSCUIMedium', 500, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_APPEARANCE_RETAINED_STEP_BUTTON_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 15, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_RETAINED_QUICK_HEADER_LABEL = TYPE_APP_SMALL_LABEL;
export const TYPE_READER_AUTO_PAGE_RETAINED_QUICK_HEADER_META = TYPE_SOURCE_TOOLS_URL;
export const TYPE_READER_AUTO_PAGE_RETAINED_QUICK_BACK_BACK = TYPE_READER_BOOKMARK_ACTION;
export const TYPE_READER_AUTO_PAGE_RETAINED_MODULE_HEADER_VALUE = TYPE_APP_SEGMENT_LABEL;
export const TYPE_READER_AUTO_PAGE_RETAINED_MODULE_HEADER_META = TYPE_SOURCE_TOOLS_URL;
export const TYPE_READER_AUTO_PAGE_RETAINED_CHAPTER_BUTTON_VALUE = TYPE_READER_AUTO_PAGE_FULL_COMPAT_CHAPTER_BUTTON_VALUE;
export const TYPE_READER_AUTO_PAGE_RETAINED_RUNNING_BUTTON_LABEL = TYPE_READER_AUTO_PAGE_FULL_COMPAT_RUNNING_BUTTON_LABEL;
export const TYPE_READER_AUTO_PAGE_RETAINED_STOP_BUTTON_LABEL = TYPE_READER_AUTO_PAGE_FULL_COMPAT_CHAPTER_BUTTON_VALUE;
export const TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_LABEL = TYPE_READER_AUTO_PAGE_FULL_COMPAT_CONTROL_SECTION_LABEL;
export const TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_META = TYPE_SOURCE_SWITCH_NAME;
export const TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_LABEL_SECONDARY = TYPE_READER_AUTO_PAGE_FULL_COMPAT_TIMER_SECTION_LABEL_SECONDARY;
export const TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_LABEL_TERTIARY = TYPE_READER_AUTO_PAGE_FULL_COMPAT_TIMER_SECTION_LABEL_TERTIARY;
export const TYPE_READER_AUTO_PAGE_RETAINED_SPEED_STEP_BUTTON_VALUE = new ReaderInheritedTextStyle(
  READER_FONT_INTER, undefined, 18, 18, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_RETAINED_SPEED_ROW_LABEL = new ReaderInheritedTextStyle(
  READER_FONT_INTER, undefined, 9, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_PAGE_RETAINED_FOLLOW_HIGHLIGHT_ROW_LABEL = TYPE_READER_AUTO_PAGE_FULL_COMPAT_HEADER_COLLAPSE;
export const TYPE_READER_CONTROLS_RETAINED_CONTROL_HEADER_VALUE = TYPE_READER_DIRECTORY_RULE_HEADING;
export const TYPE_READER_CONTROLS_RETAINED_CONTROL_HEADER_COLLAPSE = new ReaderInheritedTextStyle(
  undefined, 700, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 14, 16.8, undefined, 'system', 'appBaseline');
export const TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL_SECONDARY = TYPE_READER_BOOKMARK_ACTION;
export const TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 800, 11, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 400, 9, 9, undefined, 'system', 'appBaseline');
export const TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 500, 13, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 10, 15, undefined, 'system', 'appBaseline');
export const TYPE_READER_REPLACE_RETAINED_QUICK_BACK_BACK = TYPE_READER_BOOKMARK_ACTION;
export const TYPE_READER_REPLACE_RETAINED_TOOLBAR_BUTTON_LABEL = TYPE_SOURCE_TOOLS_COMPACT_ACTION;
export const TYPE_READER_REPLACE_RETAINED_RULE_ROW_PATTERN = TYPE_READER_DIRECTORY_POSITION;
export const TYPE_READER_REPLACE_RETAINED_RULE_ROW_META = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 8, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_REPLACE_RETAINED_STATUS_CONTENT_STATUS = TYPE_SOURCE_TOOLS_CAPTION;
export const TYPE_READER_REPLACE_RETAINED_TEXT_ACTION_LABEL = TYPE_SOURCE_TOOLS_HINT;
export const TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_BACK = TYPE_SOURCE_TOOLS_HINT;
export const TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_VALUE = TYPE_SHELF_MANAGEMENT_GROUP_TITLE;
export const TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_TITLE = TYPE_SOURCE_TOOLS_BODY;
export const TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_LABEL = TYPE_SOURCE_TOOLS_BODY;
export const TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_STATUS = TYPE_SOURCE_TOOLS_HINT;
export const TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_LABEL_SECONDARY = TYPE_SOURCE_TOOLS_HINT;
export const TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_CANCEL = TYPE_SOURCE_TOOLS_HINT;
export const TYPE_READER_REPLACE_RETAINED_EDITOR_ACTIONS_SAVE = TYPE_SOURCE_TOOLS_HINT;
export const TYPE_READER_REPLACE_RETAINED_EDITOR_FIELDS_LABEL = TYPE_SOURCE_TOOLS_CAPTION;
export const TYPE_READER_REPLACE_RETAINED_EDITOR_TEXT_LABEL = TYPE_SOURCE_TOOLS_CAPTION;
export const TYPE_READER_REPLACE_RETAINED_EDITOR_TEXT_INPUT = TYPE_SOURCE_TOOLS_HINT;
export const TYPE_READER_REPLACE_RETAINED_EDITOR_FLAG_LABEL = TYPE_SOURCE_TOOLS_BODY;
export const TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_TITLE = TYPE_SOURCE_TOOLS_BODY;
export const TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL = TYPE_SOURCE_TOOLS_CAPTION;
export const TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL_SECONDARY = TYPE_SOURCE_TOOLS_COMPACT_ACTION;
export const TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_VALUE = TYPE_SOURCE_TOOLS_BODY;
export const TYPE_READER_SEARCH_RETAINED_SEARCH_FIELD_INPUT = TYPE_SHELF_MANAGEMENT_SMALL_ACTION;
export const TYPE_READER_SEARCH_RETAINED_QUICK_BACK_BACK = TYPE_APP_COMPACT_BADGE;
export const TYPE_READER_SEARCH_RETAINED_RESULTS_BODY_STATUS = TYPE_SOURCE_TOOLS_HINT;
export const TYPE_READER_SEARCH_RETAINED_LOAD_MORE_ACTION_STATUS = TYPE_READER_DIRECTORY_POSITION;
export const TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 11, 13.2, undefined, 'system', 'appBaseline');
export const TYPE_READER_SEARCH_RETAINED_RESULT_SNIPPET_SNIPPET = new ReaderInheritedTextStyle(
  READER_FONT_NOTO_SANS_SC, undefined, 9, 13.95, undefined, 'system', 'appBaseline');
export const TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 11, 16, undefined, 'system', 'appBaseline');
export const TYPE_READER_SETTINGS_RETAINED_SEGMENT_ROW_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 9, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_SETTINGS_RETAINED_ADDED_GROUP_LABEL = TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL;
export const TYPE_READER_SETTINGS_RETAINED_TOGGLE_ROW_LABEL = TYPE_READER_DIRECTORY_TAB_COMPACT;
export const TYPE_READER_SETTINGS_RETAINED_JUSTIFY_TOGGLE_ROW_LABEL = TYPE_READER_DIRECTORY_TAB_COMPACT;
export const TYPE_READER_TIMER_RETAINED_BUILD_VALUE = new ReaderTextStyle(
  READER_FONT_INTER, 700, 8, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_RETAINED_MODULE_HEADER_VALUE = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_RETAINED_QUICK_LABEL_VALUE = TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_TERTIARY;
export const TYPE_READER_TTS_RETAINED_PLAYBACK_LABEL = TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE_SECONDARY;
export const TYPE_READER_TTS_RETAINED_PLAYBACK_STATUS = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 10, 12, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_RETAINED_ROUND_CONTROL_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_RETAINED_TIMER_META = TYPE_READER_TTS_RETAINED_ROUND_CONTROL_LABEL;
export const TYPE_READER_TTS_RETAINED_TIMER_LABEL = new ReaderTextStyle(
  'ReaderNotoSansSCUIMedium', 500, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 9, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_RETAINED_TIMER_PRESET_VALUE = TYPE_READER_TTS_RETAINED_TIMER_LABEL;
export const TYPE_READER_TTS_RETAINED_TIMER_STEPPER_VALUE = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 14, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_RETAINED_SPEED_VALUE = TYPE_FORM_URL_INPUT;
export const TYPE_READER_TTS_RETAINED_SPEED_VALUE_SECONDARY = TYPE_READER_BOOKMARK_META;
export const TYPE_READER_TTS_RETAINED_RATE_PRESET_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE = TYPE_READER_TTS_RETAINED_MODULE_HEADER_VALUE;
export const TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE_SECONDARY = TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_TERTIARY;
export const TYPE_READER_TTS_RETAINED_TTS_CLOSED_CONFIG_ROW_VALUE = TYPE_READER_TTS_RETAINED_RATE_PRESET_VALUE;
export const TYPE_READER_TTS_RETAINED_SECTION_HEADER_LABEL = TYPE_READER_TTS_RETAINED_MODULE_HEADER_VALUE;
export const TYPE_READER_TTS_RETAINED_SECTION_HEADER_META = TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_TERTIARY;
export const TYPE_READER_TTS_RETAINED_VOICE_SELECTOR_ROW_LABEL = TYPE_READER_TTS_RETAINED_TIMER_LABEL;
export const TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY = TYPE_READER_TTS_RETAINED_RATE_PRESET_VALUE;
export const TYPE_READER_TTS_RETAINED_TOGGLE_ROW_VALUE = TYPE_READER_TTS_RETAINED_TIMER_LABEL;
export const TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_LABEL = TYPE_READER_TTS_RETAINED_TIMER_LABEL;
export const TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_VALUE = TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE_SECONDARY;
export const TYPE_READER_SEARCH_QUICK_COMPAT_SEARCH_HEADER_BACK = new ReaderTextStyle(
  READER_FONT_INTER, 600, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_SEARCH_QUICK_COMPAT_SEARCH_HEADER_LABEL = TYPE_APP_COMPACT_BADGE;
export const TYPE_READER_SEARCH_QUICK_COMPAT_RESULTS_BODY_STATUS = TYPE_SEARCH_READER_QUICK_INPUT;
export const TYPE_READER_SEARCH_QUICK_COMPAT_RESULT_ROW_TITLE = TYPE_APP_COMPACT_BADGE;
export const TYPE_READER_SEARCH_QUICK_COMPAT_RESULT_SNIPPET_SNIPPET = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 8, 10, undefined, 'system', 'appBaseline');
export const TYPE_READER_REPLACE_QUICK_COMPAT_HEADER_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 13, 14.04, undefined, 'system', 'appBaseline');
export const TYPE_READER_REPLACE_QUICK_COMPAT_RULE_BODY_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 9, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_REPLACE_QUICK_COMPAT_RULE_ROW_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 9, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_REPLACE_QUICK_COMPAT_FOOTER_BUTTON_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 8, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_SEARCH_FULL_COMPAT_HEADER_LABEL = TYPE_RULES_MANAGEMENT_HEADING;
export const TYPE_READER_SEARCH_FULL_COMPAT_HEADER_COLLAPSE = TYPE_READER_BOOKMARK_ACTION;
export const TYPE_READER_SEARCH_FULL_COMPAT_RESULTS_BODY_STATUS = TYPE_SHELF_MANAGEMENT_BODY;
export const TYPE_READER_SEARCH_FULL_COMPAT_RESULT_ROW_TITLE = TYPE_SHELF_MANAGEMENT_BUTTON;
export const TYPE_READER_SEARCH_FULL_COMPAT_RESULT_SNIPPET_SNIPPET = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 400, 10, 14, undefined, 'system', 'appBaseline');
export const TYPE_READER_SETTINGS_FULL_COMPAT_HEADER_LABEL = TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL;
export const TYPE_READER_SETTINGS_FULL_COMPAT_HEADER_COLLAPSE = TYPE_READER_BOOKMARK_ACTION;
export const TYPE_READER_SETTINGS_FULL_COMPAT_FULL_SEGMENT_ROW_VALUE = TYPE_READER_DIRECTORY_TITLE;
export const TYPE_READER_SETTINGS_FULL_COMPAT_FULL_SEGMENT_OPTION_VALUE = TYPE_READER_SETTINGS_RETAINED_SEGMENT_ROW_VALUE;
export const TYPE_READER_SETTINGS_FULL_COMPAT_SECTION_TITLE_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, 14.4, 0.48, 'system', 'appBaseline');
export const TYPE_READER_SETTINGS_FULL_COMPAT_TOGGLE_ROW_LABEL = TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE;
export const TYPE_READER_SETTINGS_FULL_COMPAT_JUSTIFY_TOGGLE_ROW_LABEL = TYPE_READER_SEARCH_RETAINED_RESULT_ROW_TITLE;
export const TYPE_READER_SETTINGS_QUICK_COMPAT_SEGMENT_ROW_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 500, 10, 12, undefined, 'system', 'appBaseline');
export const TYPE_READER_SETTINGS_QUICK_COMPAT_SEGMENT_OPTION_VALUE = TYPE_READER_DIRECTORY_POSITION;
export const TYPE_READER_TTS_CONFIG_BUILD_STATUS = TYPE_READER_TTS_RETAINED_RATE_PRESET_VALUE;
export const TYPE_READER_TTS_CONFIG_BUILD_LABEL = TYPE_READER_TTS_RETAINED_TIMER_LABEL;
export const TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE = TYPE_READER_TTS_RETAINED_TIMER_STEPPER_VALUE;
export const TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 10, 14, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_TERTIARY = TYPE_APP_INHERITED_HINT;
export const TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL = TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE_SECONDARY;
export const TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 13, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT_SECONDARY = new ReaderInheritedTextStyle(
  READER_FONT_INTER, undefined, 13, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_CONFIG_MANAGER_FORM_VALUE = new ReaderTextStyle(
  'ReaderNotoSansSCUIMedium', 500, 10, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_CONFIG_MANAGER_FORM_STATUS = TYPE_READER_TTS_RETAINED_ROUND_CONTROL_LABEL;
export const TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL = TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_SECONDARY;
export const TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 13, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL = TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE_SECONDARY;
export const TYPE_READER_TTS_FULL_COMPAT_HEADER_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 700, 14, 17, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_FULL_COMPAT_HEADER_COLLAPSE = TYPE_READER_AUTO_PAGE_FULL_COMPAT_HEADER_COLLAPSE;
export const TYPE_READER_TTS_FULL_COMPAT_PLAYBACK_SECTION_LABEL = TYPE_APP_SEGMENT_LABEL;
export const TYPE_READER_TTS_FULL_COMPAT_PLAYBACK_SECTION_STATUS = TYPE_READER_DIRECTORY_TAB_LEGACY;
export const TYPE_READER_TTS_FULL_COMPAT_PLAYBACK_SECTION_STATUS_SECONDARY = TYPE_SOURCE_TOOLS_CAPTION;
export const TYPE_READER_TTS_FULL_COMPAT_TIMER_SECTION_LABEL = TYPE_APP_SEGMENT_LABEL;
export const TYPE_READER_TTS_FULL_COMPAT_TIMER_SECTION_META = TYPE_READER_DIRECTORY_TAB_LEGACY;
export const TYPE_READER_TTS_FULL_COMPAT_TIMER_SUMMARY_BLOCK_LABEL = TYPE_SOURCE_TOOLS_URL;
export const TYPE_READER_TTS_FULL_COMPAT_TIMER_SUMMARY_BLOCK_META = new ReaderTextStyle(
  READER_FONT_INTER, 800, 20, 22, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_FULL_COMPAT_TIMER_WHEELS_LABEL = new ReaderTextStyle(
  READER_FONT_INTER, 800, 18, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_FULL_COMPAT_TIMER_WHEEL_VALUE = new ReaderTextStyle(
  READER_FONT_INTER, 500, 12, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_FULL_COMPAT_TIMER_WHEEL_VALUE_SECONDARY = new ReaderTextStyle(
  READER_FONT_INTER, 800, 17, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_FULL_COMPAT_TIMER_WHEEL_VALUE_TERTIARY = new ReaderTextStyle(
  READER_FONT_INTER, 700, 9, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_FULL_COMPAT_RATE_SECTION_LABEL = TYPE_APP_SEGMENT_LABEL;
export const TYPE_READER_TTS_FULL_COMPAT_RATE_SECTION_VALUE = TYPE_SOURCE_TOOLS_URL;
export const TYPE_READER_TTS_FULL_COMPAT_RATE_SECTION_VALUE_SECONDARY = TYPE_READER_BOOKMARK_META;
export const TYPE_READER_TTS_FULL_COMPAT_TTS_CONFIG_HEADER_LABEL = TYPE_APP_SEGMENT_LABEL;
export const TYPE_READER_TTS_FULL_COMPAT_TTS_CONFIG_HEADER_LABEL_SECONDARY = TYPE_SOURCE_TOOLS_URL;
export const TYPE_READER_TTS_FULL_COMPAT_TTS_SERVICE_TYPE_TAB_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 900, 12, 15.6, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_FULL_COMPAT_TTS_SERVICE_TYPE_TAB_VALUE_SECONDARY = TYPE_READER_APPEARANCE_FULL_COMPAT_HEADER_COLLAPSE;
export const TYPE_READER_TTS_FULL_COMPAT_TTS_CLOSED_CONFIG_ROW_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, 15.6, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_FULL_COMPAT_SECTION_HEADER_LABEL = TYPE_APP_SEGMENT_LABEL;
export const TYPE_READER_TTS_FULL_COMPAT_SECTION_HEADER_META = TYPE_SOURCE_TOOLS_URL;
export const TYPE_READER_TTS_FULL_COMPAT_SELECTOR_ROW_LABEL = TYPE_SHELF_MANAGEMENT_BUTTON;
export const TYPE_READER_TTS_FULL_COMPAT_TTS_SELECT_VALUE_FIELD_VALUE = TYPE_SELECT_APPEARANCE_VALUE;
export const TYPE_READER_TTS_FULL_COMPAT_TOGGLE_ROW_LABEL = TYPE_SOURCE_TOOLS_COMPACT_ACTION;
export const TYPE_READER_TTS_QUICK_COMPAT_PLAYBACK_ROW_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC, 700, 12, 12, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_QUICK_COMPAT_TIMER_ROW_LABEL = TYPE_READER_TTS_QUICK_COMPAT_PLAYBACK_ROW_VALUE;
export const TYPE_READER_TTS_QUICK_COMPAT_TIMER_ROW_VALUE = TYPE_APP_SEGMENT_LABEL;
export const TYPE_READER_TTS_QUICK_COMPAT_RATE_ROW_LABEL = TYPE_READER_TTS_QUICK_COMPAT_PLAYBACK_ROW_VALUE;
export const TYPE_READER_TTS_QUICK_COMPAT_RATE_ROW_VALUE = TYPE_SOURCE_SWITCH_RECOVERY;

/** Inline emphasis inherits the snippet parent's shared font size and line box.
 * This partial contract cannot invent a dummy size or override body layout. */
export class ReaderInlineTextStyle {
  readonly fontFamily: string | undefined;
  readonly fontWeight: number;
  constructor(fontFamily: string | undefined, fontWeight: number) {
    this.fontFamily = fontFamily; this.fontWeight = fontWeight;
  }
}

// Reading control finite variants and bounded morph endpoints. Timing and
// geometry remain in their original persistent owners.
export const TYPE_READER_THEME_SUMMARY_PHONE = TYPE_READER_APPEARANCE_SHARED_COMPAT_SHARED_THEME_HEADER_META;
export const TYPE_READER_THEME_SUMMARY_TABLET = new ReaderTextStyle(
  'ReaderNotoSansSC', 500, 8, 8, undefined, 'system', 'appBaseline');
export const TYPE_READER_TIMER_WHEEL_SELECTED = new ReaderTextStyle(
  'ReaderInter', 800, 17, 17, undefined, 'system', 'appBaseline');
export const TYPE_READER_TIMER_WHEEL_NEIGHBOUR = new ReaderTextStyle(
  'ReaderInter', 600, 11, 11, undefined, 'system', 'appBaseline');
export const TYPE_READER_TIMER_WHEEL_RETAINED_SELECTED = TYPE_READER_TTS_FULL_COMPAT_TIMER_WHEEL_VALUE_SECONDARY;
export const TYPE_READER_TIMER_WHEEL_RETAINED_NEIGHBOUR = new ReaderTextStyle(
  'ReaderInter', 600, 11, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_SPEED_LABEL_QUICK = new ReaderTextStyle(
  'ReaderInter', 700, 11, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_SPEED_LABEL_FULL = TYPE_READER_TTS_FULL_COMPAT_HEADER_COLLAPSE;
export const TYPE_READER_AUTO_SPEED_VALUE_QUICK = new ReaderTextStyle(
  'ReaderInter', 900, 11, 13, undefined, 'system', 'appBaseline');
export const TYPE_READER_AUTO_SPEED_VALUE_FULL = TYPE_READER_AUTO_PAGE_FULL_COMPAT_SPEED_ROW_LABEL_SECONDARY;
export const TYPE_READER_CONTROL_HEADER_INTER = TYPE_READER_AUTO_PAGE_FULL_COMPAT_HEADER_LABEL;
export const TYPE_READER_CONTROL_HEADER_UI = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 14, 20, undefined, 'system', 'appBaseline');
export const TYPE_READER_CONTROL_COLLAPSE_INTER = new ReaderTextStyle(
  'ReaderInter', 700, 10, 12, undefined, 'system', 'appBaseline');
export const TYPE_READER_CONTROL_COLLAPSE_UI = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 10, 14, undefined, 'system', 'appBaseline');
export const TYPE_READER_REPLACE_RULE_NAME = TYPE_SOURCE_TOOLS_ACTION;
export const TYPE_READER_SETTINGS_SEGMENT_LABEL_QUICK = TYPE_READER_SETTINGS_FULL_COMPAT_HEADER_COLLAPSE;
export const TYPE_READER_SETTINGS_SEGMENT_LABEL_FULL = TYPE_READER_TTS_FULL_COMPAT_TOGGLE_ROW_LABEL;
export const TYPE_READER_TTS_SECTION_SPEED_META = new ReaderTextStyle(
  'ReaderInter', 500, 11, 14, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_SECTION_META = new ReaderTextStyle(
  'ReaderNotoSansSCUIMedium', 500, 10, 14, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_QUICK_PLAYBACK_LABEL = TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE;
export const TYPE_READER_TTS_QUICK_SETTING_LABEL = TYPE_READER_TTS_RETAINED_SECTION_HEADER_LABEL;
export const TYPE_READER_TTS_MANAGER_TITLE = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 15, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_CONFIGURATION_TITLE = TYPE_READER_TTS_QUICK_SETTING_LABEL;
export const TYPE_READER_TTS_CHOICE_REGULAR = new ReaderTextStyle(
  'ReaderNotoSansSCUIMedium', 500, 12, 17, undefined, 'system', 'appBaseline');
export const TYPE_READER_TTS_CHOICE_SELECTED = TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL_SECONDARY;
export const TYPE_READER_TTS_VOICE_REGULAR = TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL;
export const TYPE_READER_TTS_VOICE_SELECTED = new ReaderTextStyle(
  'ReaderNotoSansSCUIBold', 700, 13, 17, undefined, 'system', 'appBaseline');
export const TYPE_READER_INDENT_OPTION_REGULAR = TYPE_READER_SETTINGS_FULL_COMPAT_FULL_SEGMENT_OPTION_VALUE;
export const TYPE_READER_INDENT_OPTION_SELECTED = new ReaderTextStyle(
  'ReaderNotoSansSC', 700, 9, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_SETTINGS_OPTION_REGULAR = TYPE_READER_INDENT_OPTION_REGULAR;
export const TYPE_READER_SETTINGS_OPTION_SELECTED = TYPE_READER_INDENT_OPTION_SELECTED;
export const TYPE_READER_SNIPPET_INLINE_REGULAR = new ReaderInlineTextStyle(undefined, 400);
export const TYPE_READER_SNIPPET_INLINE_MATCH = new ReaderInlineTextStyle(undefined, 700);
export const TYPE_READER_SNIPPET_NOTO_REGULAR = new ReaderInlineTextStyle('ReaderNotoSansSC', 400);
export const TYPE_READER_SNIPPET_NOTO_MATCH = new ReaderInlineTextStyle('ReaderNotoSansSC', 700);

// Failure text deliberately keeps ArkUI's inherited family and AUTO line box.
export const TYPE_READER_READING_FAILURE_TITLE = new ReaderInheritedTextStyle(
  undefined, 500, 20, undefined, undefined, 'system', 'appBaseline');
export const TYPE_READER_READING_FAILURE_DETAIL = new ReaderInheritedTextStyle(
  undefined, undefined, 16, undefined, undefined, 'system', 'appBaseline');

// The current content-search placeholder is Noto10 with native weight/line AUTO.
export const TYPE_READER_SEARCH_RETAINED_SEARCH_FIELD_PLACEHOLDER = TYPE_SOURCE_TOOLS_CAPTION;

// The download demo's resolved CSS owns these complete text tuples. Its font
// shorthand fixes a 21px line box even when a child changes only font-size;
// those inherited line heights must not silently become ArkUI AUTO. Existing
// historical roles above are independent and retain their original tuples.
// Static instances select the same 400/500/600/700 glyph outlines before first
// text admission; the 600 face already used by manga is shared without copying.
export const TYPE_DOWNLOAD_CONTROL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.controlFontSize, DOWNLOAD_VISUAL.controlLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_META = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.metaFontSize, DOWNLOAD_VISUAL.metaLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_BODY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.bodyFontSize, DOWNLOAD_VISUAL.bodyLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_QUICK_SELECT = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.chapterQuickFontSize, DOWNLOAD_VISUAL.chapterQuickLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_TAG = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.tagFontSize, DOWNLOAD_VISUAL.tagLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_BOOK_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, DOWNLOAD_VISUAL.fontBoldWeight,
  DOWNLOAD_VISUAL.bookTitleFontSize, DOWNLOAD_VISUAL.bookTitleLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_SECTION_LABEL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.bodyFontSize, DOWNLOAD_VISUAL.bodyLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_SHEET_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, DOWNLOAD_VISUAL.fontBoldWeight,
  DOWNLOAD_VISUAL.sheetTitleFontSize, DOWNLOAD_VISUAL.sheetTitleLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_EMPTY_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM, DOWNLOAD_VISUAL.fontMediumWeight,
  DOWNLOAD_VISUAL.emptyTitleFontSize, DOWNLOAD_VISUAL.emptyTitleLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_CONFIRM_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_600, DOWNLOAD_VISUAL.fontSemiboldWeight,
  DOWNLOAD_VISUAL.confirmTitleFontSize, DOWNLOAD_VISUAL.confirmTitleLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_META_LINE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.sourceFontSize, DOWNLOAD_VISUAL.sourceLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_STORAGE_META = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.storageFontSize, DOWNLOAD_VISUAL.storageLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_STORAGE_TOTAL = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM, DOWNLOAD_VISUAL.storageTotalWeight,
  DOWNLOAD_VISUAL.storageTotalFontSize, DOWNLOAD_VISUAL.storageTotalLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_STORAGE_VALUE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM, DOWNLOAD_VISUAL.storageValueWeight,
  DOWNLOAD_VISUAL.storageValueFontSize, DOWNLOAD_VISUAL.storageValueLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_STATUS_BODY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.bodyFontSize, DOWNLOAD_VISUAL.bodyLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_CONFIRM_BODY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.confirmBodyFontSize, DOWNLOAD_VISUAL.confirmBodyLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_READ_BODY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.settingsHintFontSize, DOWNLOAD_VISUAL.settingsHintLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_IDENTITY_META = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.settingsHintFontSize, DOWNLOAD_VISUAL.settingsHintLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_HEADER_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, DOWNLOAD_VISUAL.fontBoldWeight,
  DOWNLOAD_VISUAL.headerTitleFontSize, DOWNLOAD_VISUAL.headerTitleLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_COVER = new ReaderTextStyle(
  READER_FONT_NOTO_SERIF_SC_BOLD, DOWNLOAD_VISUAL.fontBoldWeight,
  DOWNLOAD_VISUAL.coverFontSize, DOWNLOAD_VISUAL.coverLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_TAB = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.tabFontSize, DOWNLOAD_VISUAL.tabLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_TAB_SELECTED = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM, DOWNLOAD_VISUAL.fontMediumWeight,
  DOWNLOAD_VISUAL.tabFontSize, DOWNLOAD_VISUAL.tabLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_SEARCH = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.searchFontSize, DOWNLOAD_VISUAL.searchLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_LIST_TOOLS = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.listToolsFontSize, DOWNLOAD_VISUAL.listToolsLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_SOURCE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.sourceFontSize, DOWNLOAD_VISUAL.sourceLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_SETTINGS_HINT = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.settingsHintFontSize, DOWNLOAD_VISUAL.settingsHintLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_RANGE_HINT = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.rangeHintFontSize, DOWNLOAD_VISUAL.rangeHintLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_CHAPTER_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.controlFontSize, DOWNLOAD_VISUAL.controlLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_READ_BOOK_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_BOLD, DOWNLOAD_VISUAL.fontBoldWeight,
  DOWNLOAD_VISUAL.bodyFontSize, DOWNLOAD_VISUAL.bodyLineHeight, undefined, 'system', 'appBaseline');

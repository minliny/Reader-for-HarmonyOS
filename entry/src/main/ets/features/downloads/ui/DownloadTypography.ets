import { ReaderTextStyle } from '../../../ui/foundation/ReaderTypography';
import {
  READER_FONT_NOTO_SANS_SC_UI_REGULAR,
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_600,
  READER_FONT_NOTO_SANS_SC_UI_BOLD,
  READER_FONT_NOTO_SERIF_SC_BOLD,
} from '../../../ui/foundation/ReaderFontFamilies';
import { DOWNLOAD_VISUAL } from './SharedDownloadVisualSpec';

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
export const TYPE_DOWNLOAD_RANGE_HINT = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.rangeHintFontSize, DOWNLOAD_VISUAL.rangeHintLineHeight, undefined, 'system', 'appBaseline');
export const TYPE_DOWNLOAD_CHAPTER_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, DOWNLOAD_VISUAL.fontRegularWeight,
  DOWNLOAD_VISUAL.controlFontSize, DOWNLOAD_VISUAL.controlLineHeight, undefined, 'system', 'appBaseline');

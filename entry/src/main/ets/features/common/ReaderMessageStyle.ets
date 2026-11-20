import { ReaderTextStyle } from './ReaderTypography';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_600 } from './ReaderFontFamilies';

// User-reviewed message family (2026-10-19). These roles are deliberately
// scoped to feedback; metadata, progress marks and ordinary page chrome keep
// their existing typography and palette.
// Reuse the checked, full-CJK static faces. The custom VF has a 100 default
// axis; ordinary fontWeight calls omit ArkUI's variable-weight opt-in, and
// some message bodies also inherit the default weight. A physical face
// carries the reviewed weight for every consumer, including native measure.
export const MESSAGE_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_600, 600, 17, 24, undefined, 'system', 'appBaseline');
export const MESSAGE_BODY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 13, 21, undefined, 'system', 'appBaseline');
// Quiet list-empty rhythm from the audited search demo (.list-empty):
// title 14/1.7 muted, detail 12/1.8 faint. App-only search states keep
// ReaderPageState as their message host but adopt this tone.
export const MESSAGE_LIST_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 14, 23.8, undefined, 'system', 'appBaseline');
export const MESSAGE_LIST_BODY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, 21.6, undefined, 'system', 'appBaseline');
export const MESSAGE_ACTION = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 500, 13, 20, undefined, 'system', 'appBaseline');
export const MESSAGE_META = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, 18, undefined, 'system', 'appBaseline');
export const MESSAGE_NOTICE_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 14, 22, undefined, 'system', 'appBaseline');
export const MESSAGE_GESTURE_ICON = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 16, 22, undefined, 'system', 'appBaseline');

// Short-feedback Toast/Snackbar hierarchy from the reviewed message surface:
// a compact title and a quieter body share one near-full-width rounded bar.
export const MESSAGE_TOAST_TITLE = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_600, 600, 12, 17, undefined, 'system', 'appBaseline');
export const MESSAGE_TOAST_BODY = new ReaderTextStyle(
  READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 10, 14, undefined, 'system', 'appBaseline');

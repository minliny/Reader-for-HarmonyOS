/** Shared native search controls; the field, its parent lane and actions use
 * these resolved dimensions rather than growing only the TextInput. */
export const SEARCH_CONTROL_MIN_TARGET = 44;
export const SEARCH_CONTROL_CLEAR_SLOT = 32;
export const SEARCH_CONTROL_CLEAR_ICON_SIZE = 18;
export const SEARCH_CONTROL_CLEAR_END_INSET = 6;
export const SEARCH_CONTROL_COMPACT_CLEAR_SLOT = 28;
export const SEARCH_CONTROL_COMPACT_CLEAR_END_INSET = 4;
export const SEARCH_CAPSULE_HEIGHT = 36;
export const SEARCH_CAPSULE_HORIZONTAL_INSET = 12;
export const SEARCH_CAPSULE_ICON_GAP = 7;
export const SEARCH_BOOK_PANEL_ICON_SIZE = 14;
export const SEARCH_CAPSULE_EMPTY_CHROME = 2 * SEARCH_CAPSULE_HORIZONTAL_INSET;
export const SEARCH_HISTORY_FONT_SIZE = 13;
export const SEARCH_HISTORY_LINE_HEIGHT = 18;
export const SEARCH_HISTORY_ROW_HEIGHT = 40;
export const SEARCH_HISTORY_MAX_ROWS = 6;
// Kept as a named recipe input for older callers. The capsule no longer adds
// vertical padding on top of its fixed 32vp paint height.
export const SEARCH_HISTORY_VERTICAL_PADDING = 0;
export const SEARCH_HISTORY_HORIZONTAL_PADDING = 12;
export const SEARCH_HISTORY_VISUAL_HEIGHT = 32;
export const SEARCH_HISTORY_GAP = 8;

/** Paint the nominal border box until the full scaled line needs more room. */
export function readerCompactSearchHeight(baseHeight: number, lineHeight: number, fontScale: number): number {
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  return Math.max(baseHeight, Math.ceil(lineHeight * scale + 2));
}

export function readerSearchActionWidth(expandedLayout: boolean, fontScale: number): number {
  return (expandedLayout ? 66 : 58) + 26 * Math.max(0, fontScale - 1);
}
export function readerSearchControlHeight(fontScale: number): number {
  return SEARCH_CONTROL_MIN_TARGET + 24 * Math.max(0, fontScale - 1);
}

/** Visible capsule height inside the interaction frame. */
export function readerSearchControlVisualHeight(fontScale: number): number {
  return Math.max(0, readerSearchControlHeight(fontScale) - 8);
}
export function readerSearchHistoryControlHeight(fontScale: number): number {
  return Math.ceil(SEARCH_HISTORY_VISUAL_HEIGHT + SEARCH_HISTORY_LINE_HEIGHT * Math.max(0, fontScale - 1));
}
export function readerSearchHistoryRowHeight(fontScale: number): number {
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  return Math.ceil(SEARCH_HISTORY_ROW_HEIGHT + SEARCH_HISTORY_LINE_HEIGHT * Math.max(0, scale - 1));
}

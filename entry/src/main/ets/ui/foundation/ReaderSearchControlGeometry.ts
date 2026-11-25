/** Shared native search controls; the field, its parent lane and actions use
 * these resolved dimensions rather than growing only the TextInput. */
export const SEARCH_CONTROL_MIN_TARGET = 44;
export const SEARCH_CONTROL_CLEAR_SLOT = 32;
export const SEARCH_CONTROL_CLEAR_ICON_SIZE = 18;
export const SEARCH_CONTROL_CLEAR_END_INSET = 6;
export const SEARCH_HISTORY_FONT_SIZE = 12;
export const SEARCH_HISTORY_LINE_HEIGHT = 16;
// Kept as a named recipe input for older callers. The capsule no longer adds
// vertical padding on top of its fixed 32vp paint height.
export const SEARCH_HISTORY_VERTICAL_PADDING = 0;
export const SEARCH_HISTORY_HORIZONTAL_PADDING = 12;
export const SEARCH_HISTORY_VISUAL_HEIGHT = 32;
export const SEARCH_HISTORY_GAP = 8;

export function readerSearchActionWidth(expandedLayout: boolean, fontScale: number): number {
  return (expandedLayout ? 66 : 58) + 26 * Math.max(0, fontScale - 1);
}
export function readerSearchControlHeight(fontScale: number): number {
  return SEARCH_CONTROL_MIN_TARGET + 24 * Math.max(0, fontScale - 1);
}

/** Visible capsule height inside the 44vp interaction frame. */
export function readerSearchControlVisualHeight(fontScale: number): number {
  return Math.max(0, readerSearchControlHeight(fontScale) - 4);
}
export function readerSearchHistoryControlHeight(fontScale: number): number {
  return Math.ceil(SEARCH_HISTORY_VISUAL_HEIGHT + SEARCH_HISTORY_LINE_HEIGHT * Math.max(0, fontScale - 1));
}

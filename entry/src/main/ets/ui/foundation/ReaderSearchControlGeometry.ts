/** Shared native search controls; the field, its parent lane and actions use
 * these resolved dimensions rather than growing only the TextInput. */
export const SEARCH_HISTORY_FONT_SIZE = 12;
export const SEARCH_HISTORY_LINE_HEIGHT = 16;
export const SEARCH_HISTORY_VERTICAL_PADDING = 6;
export const SEARCH_HISTORY_HORIZONTAL_PADDING = 8;

export function readerSearchActionWidth(expandedLayout: boolean, fontScale: number): number {
  return (expandedLayout ? 66 : 58) + 26 * Math.max(0, fontScale - 1);
}
export function readerSearchControlHeight(fontScale: number): number {
  return 36 + 24 * Math.max(0, fontScale - 1);
}
export function readerSearchHistoryControlHeight(fontScale: number): number {
  return Math.max(32, SEARCH_HISTORY_LINE_HEIGHT * Math.max(1, fontScale) +
    SEARCH_HISTORY_VERTICAL_PADDING * 2 + 2);
}

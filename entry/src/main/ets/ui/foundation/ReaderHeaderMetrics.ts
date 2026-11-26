/** App header bar heights. Shared by the measured host and the bar
 * itself; pages must not re-declare either value next to their own inset. */
export const APP_FLOATING_HEADER_BAR_HEIGHT = 52;
export const APP_HEADER_BAR_HEIGHT = 58;
/** App-owned gap between the safe-area top and a floating header bar. */
export const APP_FLOATING_HEADER_TOP_GAP = 8;
export const BOOKSHELF_HEADER_TITLE_LINE_HEIGHT = 28;
export const BOOKSHELF_HEADER_CONTENT_GAP = 8;
export const SEARCH_HEADER_BAR_VERTICAL_PADDING = 3;
export const SEARCH_HEADER_FIELD_GAP = 6;

export interface SearchHeaderFieldGeometry {
  width: number;
  stacked: boolean;
  shortPlaceholder: boolean;
}

export function resolveSearchHeaderField(laneWidth: number, actionWidth: number,
  inputChromeWidth: number, scaledGlyphWidth: number): SearchHeaderFieldGeometry {
  const inlineWidth = laneWidth - actionWidth - SEARCH_HEADER_FIELD_GAP;
  // Width budget for five full-width glyphs in the short prompt and eight in the long prompt.
  const stacked = inlineWidth < inputChromeWidth + 5 * scaledGlyphWidth;
  const width = stacked ? laneWidth : inlineWidth;
  return { width, stacked, shortPlaceholder: width < inputChromeWidth + 8 * scaledGlyphWidth };
}

/** Download list, chapter and management modes share this header recipe. */
export const DOWNLOAD_HEADER_HEIGHT = 52;
export const DOWNLOAD_HEADER_ACTION_WIDTH = 40;
export const DOWNLOAD_HEADER_ACTION_HEIGHT = 44;

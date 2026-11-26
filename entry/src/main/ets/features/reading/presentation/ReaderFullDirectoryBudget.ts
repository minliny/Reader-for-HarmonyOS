import { SEARCH_CONTROL_COMPACT_CLEAR_SLOT, SEARCH_CONTROL_COMPACT_CLEAR_END_INSET, SEARCH_CONTROL_MIN_TARGET } from '../../../ui/foundation/ReaderSearchControlGeometry';

export const DIRECTORY_TOOL_SIZE = 36;
export const DIRECTORY_TOOL_TARGET = SEARCH_CONTROL_MIN_TARGET;
export const DIRECTORY_TOOL_GAP = DIRECTORY_TOOL_TARGET - DIRECTORY_TOOL_SIZE;
export const DIRECTORY_TOOL_OUTSET = DIRECTORY_TOOL_GAP / 2;
export const DIRECTORY_TOOL_SIDE_INSET = 10;

export interface ReaderFullDirectoryHeights {
  panel: number;
  content: number;
  body: number;
  chapterList: number;
  bookmarkList: number;
}

export interface ReaderDirectoryToolbarBudget {
  stacked: boolean;
  height: number;
  fieldMinimumWidth: number;
  actionsWidth: number;
}

export function readerDirectoryFieldChromeWidth(readingPalette: boolean): number {
  const leading = readingPalette ? 10 + 14 + 6 : 12 + 15 + 7;
  const trailing = SEARCH_CONTROL_COMPACT_CLEAR_SLOT + SEARCH_CONTROL_COMPACT_CLEAR_END_INSET;
  return leading + trailing + 2;
}

/** An 8vp gap leaves room for each 36vp action's 4vp response outset. */
export function readerDirectoryToolbarBudget(width: number, chapterTools: boolean,
  fieldHeight: number, editableMinimum: number, naturalHeight: number = 0,
  catalog: boolean = false): ReaderDirectoryToolbarBudget {
  const field = Math.max(DIRECTORY_TOOL_SIZE, Number.isFinite(fieldHeight) ? fieldHeight : DIRECTORY_TOOL_SIZE);
  const text = Math.max(44, Number.isFinite(editableMinimum) ? editableMinimum : 60);
  const fieldMinimumWidth = readerDirectoryFieldChromeWidth(!catalog) + text;
  const actions = catalog ? 2 : chapterTools ? 3 : 0;
  const actionsWidth = actions * DIRECTORY_TOOL_SIZE + Math.max(0, actions - 1) * DIRECTORY_TOOL_GAP;
  const gutter = (catalog ? 0 : 2 * DIRECTORY_TOOL_SIDE_INSET) + DIRECTORY_TOOL_GAP;
  const stacked = actions > 0 && Number.isFinite(width) && width > 0 && width - gutter - actionsWidth < fieldMinimumWidth;
  const row = Math.max(DIRECTORY_TOOL_TARGET, field);
  return { stacked, height: Math.max(Number.isFinite(naturalHeight) ? naturalHeight : 0,
    stacked ? field + DIRECTORY_TOOL_SIZE + DIRECTORY_TOOL_GAP + 2 * DIRECTORY_TOOL_OUTSET : row),
    fieldMinimumWidth, actionsWidth };
}

/** All standalone allocations consume the same admitted viewport. */
export function readerFullDirectoryHeights(panelHeight: number): ReaderFullDirectoryHeights {
  const panel = Number.isFinite(panelHeight) ? Math.max(0, panelHeight) : 0;
  const content = Math.max(0, panel - 32);
  const body = Math.max(0, content - 38);
  return { panel, content, body,
    chapterList: Math.max(0, body - 143),
    bookmarkList: Math.max(0, body - 93) };
}

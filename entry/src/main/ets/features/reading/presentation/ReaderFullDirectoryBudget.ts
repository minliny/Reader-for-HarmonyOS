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

/** The field pays for its icon/insets as well as useful editable text.
 * Each of the four tools owns one non-overlapping 44vp carrier. */
export function readerDirectoryToolbarBudget(width: number, chapterTools: boolean,
  fieldHeight: number, editableMinimum: number, naturalHeight: number = 0): ReaderDirectoryToolbarBudget {
  const field = Math.max(44, Number.isFinite(fieldHeight) ? fieldHeight : 44);
  const text = Math.max(44, Number.isFinite(editableMinimum) ? editableMinimum : 60);
  const fieldMinimumWidth = 39 + text;
  const actionsWidth = chapterTools ? 176 : 44;
  const stacked = Number.isFinite(width) && width > 0 && width - 20 - 8 - actionsWidth < fieldMinimumWidth;
  const row = field + 6;
  return { stacked, height: Math.max(Number.isFinite(naturalHeight) ? naturalHeight : 0,
    stacked ? row * 2 + 8 : row), fieldMinimumWidth, actionsWidth };
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

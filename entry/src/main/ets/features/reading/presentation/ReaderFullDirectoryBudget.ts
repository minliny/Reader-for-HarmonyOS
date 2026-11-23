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
 * The authored32vp tools keep their five-vp gaps. Touch payment is independent. */
export function readerDirectoryToolbarBudget(width: number, chapterTools: boolean,
  fieldHeight: number, editableMinimum: number, naturalHeight: number = 0): ReaderDirectoryToolbarBudget {
  const field = Math.max(32, Number.isFinite(fieldHeight) ? fieldHeight : 32);
  const text = Math.max(44, Number.isFinite(editableMinimum) ? editableMinimum : 60);
  const fieldMinimumWidth = 39 + text;
  const actionsWidth = chapterTools ? 143 : 32;
  const stacked = Number.isFinite(width) && width > 0 && width - 20 - 5 - actionsWidth < fieldMinimumWidth;
  const row = field + 18;
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

/**
 * Scroll geometry owned by the directory component.
 *
 * These values are shared only because the directory layout and its scroll
 * calculation express the same geometry. They do not belong to the reader
 * control composition, even when a value happens to equal another component.
 */
// Current Reader Final (`23 · Pages · Final`) owns a 142vp directory viewport.
// Row centering, overflow clamping and edge fades all derive from this source.
export const READER_DIRECTORY_VIEWPORT_HEIGHT = 142;
export const READER_DIRECTORY_LIST_PADDING_Y = 3;
export const READER_DIRECTORY_ROW_HEIGHT = 29;
export const READER_DIRECTORY_EDGE_FADE_HEIGHT = 18;

export function readerDirectoryContentHeight(entryCount: number): number {
  return Math.max(0, entryCount) * READER_DIRECTORY_ROW_HEIGHT +
    READER_DIRECTORY_LIST_PADDING_Y * 2;
}

export function readerDirectoryIsScrollable(entryCount: number): boolean {
  return readerDirectoryContentHeight(entryCount) > READER_DIRECTORY_VIEWPORT_HEIGHT;
}

export function readerDirectoryScrollY(
  entryCount: number,
  currentPosition: number,
): number {
  if (entryCount <= 0 || currentPosition < 0 || currentPosition >= entryCount) {
    return 0;
  }

  const centeredScrollY = currentPosition * READER_DIRECTORY_ROW_HEIGHT -
    READER_DIRECTORY_VIEWPORT_HEIGHT / 2 + READER_DIRECTORY_ROW_HEIGHT / 2;
  const contentHeight = readerDirectoryContentHeight(entryCount);
  const maxScrollY = Math.max(0, contentHeight - READER_DIRECTORY_VIEWPORT_HEIGHT);
  return Math.max(0, Math.min(maxScrollY, centeredScrollY));
}

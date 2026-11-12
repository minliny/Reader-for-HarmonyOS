export interface ReaderFullDirectoryHeights {
  panel: number;
  content: number;
  body: number;
  chapterList: number;
  bookmarkList: number;
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

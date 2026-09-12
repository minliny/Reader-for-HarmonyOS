import type { LocalReadingTocEntry, LocalReadingBookmark } from './LocalReadingFlowGateway';

/** Independent values, not retained aliases: detect same-reference in-place edits too. */
export function snapshotReaderDirectoryData(entries: LocalReadingTocEntry[]): LocalReadingTocEntry[] {
  return entries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
    index: entry.index, title: entry.title, downloadState: entry.downloadState,
    bookmarks: entry.bookmarks === undefined ? undefined :
      entry.bookmarks.map((bookmark: LocalReadingBookmark): LocalReadingBookmark => ({
        time: bookmark.time, chapterIndex: bookmark.chapterIndex, chapterOffset: bookmark.chapterOffset,
        chapterTitle: bookmark.chapterTitle, content: bookmark.content,
      })),
  }));
}

/** Animation prop refresh is not a business projection change. */
export function sameReaderDirectoryData(previous: LocalReadingTocEntry[], next: LocalReadingTocEntry[]): boolean {
  if (previous.length !== next.length) return false;
  for (let i = 0; i < next.length; i += 1) {
    const a = previous[i];
    const b = next[i];
    if (a.index !== b.index || a.title !== b.title || a.downloadState !== b.downloadState) return false;
    if (a.bookmarks === undefined || b.bookmarks === undefined) {
      if (a.bookmarks !== undefined || b.bookmarks !== undefined) return false;
      continue;
    }
    if (a.bookmarks.length !== b.bookmarks.length) return false;
    for (let j = 0; j < b.bookmarks.length; j += 1) {
      const left = a.bookmarks[j];
      const right = b.bookmarks[j];
      if (left.time !== right.time || left.chapterIndex !== right.chapterIndex ||
        left.chapterOffset !== right.chapterOffset || left.chapterTitle !== right.chapterTitle ||
        left.content !== right.content) return false;
    }
  }
  return true;
}

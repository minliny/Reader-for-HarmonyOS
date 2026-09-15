import type { LocalReadingTocEntry, LocalReadingBookmark } from './LocalReadingFlowGateway';

/** Independent values, not retained aliases: detect same-reference in-place edits too. */
export function snapshotReaderDirectoryData(entries: LocalReadingTocEntry[]): LocalReadingTocEntry[] {
  return entries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
    index: entry.index, title: entry.title, downloadState: entry.downloadState, navigable: entry.navigable,
    bookmarks: entry.bookmarks === undefined ? undefined :
      entry.bookmarks.map((bookmark: LocalReadingBookmark): LocalReadingBookmark => ({
        time: bookmark.time, chapterIndex: bookmark.chapterIndex, chapterOffset: bookmark.chapterOffset,
        chapterTitle: bookmark.chapterTitle, content: bookmark.content, bookText: bookmark.bookText,
        positionScope: bookmark.positionScope === undefined ? undefined : {
          sourceId: bookmark.positionScope.sourceId, bookId: bookmark.positionScope.bookId,
          chapterIndex: bookmark.positionScope.chapterIndex, bodyVersion: bookmark.positionScope.bodyVersion,
          processingVersion: bookmark.positionScope.processingVersion,
        },
      })),
  }));
}

/** Animation prop refresh is not a business projection change. */
export function sameReaderDirectoryData(previous: LocalReadingTocEntry[], next: LocalReadingTocEntry[]): boolean {
  if (previous.length !== next.length) return false;
  for (let i = 0; i < next.length; i += 1) {
    const a = previous[i];
    const b = next[i];
    if (a.index !== b.index || a.title !== b.title || a.downloadState !== b.downloadState || a.navigable !== b.navigable) return false;
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
        left.content !== right.content || left.bookText !== right.bookText) return false;
      const leftScope = left.positionScope;
      const rightScope = right.positionScope;
      if (leftScope === undefined || rightScope === undefined) {
        if (leftScope !== rightScope) return false;
      } else if (leftScope.sourceId !== rightScope.sourceId || leftScope.bookId !== rightScope.bookId ||
        leftScope.chapterIndex !== rightScope.chapterIndex || leftScope.bodyVersion !== rightScope.bodyVersion ||
        leftScope.processingVersion !== rightScope.processingVersion) return false;
    }
  }
  return true;
}

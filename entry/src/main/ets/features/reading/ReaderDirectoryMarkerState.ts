import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';

/** Exact chapter-start anchor emitted by an empty directory bookmark marker. */
export type ReaderDirectoryChapterStartBookmarkRequest = {
  chapterIndex: number;
  chapterTitle: string;
};

/**
 * The three states a chapter-level bookmark marker can prove from the
 * Core-backed directory projection. `unknown` is deliberately not actionable.
 */
export type ReaderDirectoryBookmarkMarkerState =
  | { kind: 'unknown' }
  | { kind: 'empty'; createRequest: ReaderDirectoryChapterStartBookmarkRequest }
  | { kind: 'bookmarked'; bookmarkTimes: number[] };

export function readerDirectoryBookmarkMarkerState(
  entry: LocalReadingTocEntry,
): ReaderDirectoryBookmarkMarkerState {
  if (entry.bookmarks === undefined) {
    return { kind: 'unknown' };
  }
  if (entry.bookmarks.length === 0) {
    return {
      kind: 'empty',
      createRequest: {
        chapterIndex: entry.index,
        chapterTitle: entry.title,
      },
    };
  }
  const bookmarkTimes: number[] = [];
  for (const bookmark of entry.bookmarks) {
    bookmarkTimes.push(bookmark.time);
  }
  return { kind: 'bookmarked', bookmarkTimes };
}

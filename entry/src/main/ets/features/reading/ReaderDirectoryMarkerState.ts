import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';

/** Exact chapter-start anchor emitted by an empty directory bookmark marker. */
export type ReaderDirectoryChapterStartBookmarkRequest = {
  chapterIndex: number;
  chapterTitle: string;
};

/**
 * One physical-page bookmark toggle emitted by the reading gesture layer.
 * Existing bookmarks are identified only by Core-owned primary keys; an empty
 * list means the page-start scalar anchor must be created.
 */
export type ReaderPageBookmarkToggleRequest = {
  positionScope?: RemoteReadingPositionScope;
  chapterIndex: number;
  chapterOffset: number;
  chapterTitle: string;
  bookmarkTimes: number[];
  /** Captured original text from this exact visible page; never a user note. */
  bookText?: string;
  /** Host-only acknowledgment of a confirmed write; projection failure remains separately unknown. */
  onSettled?: (success: boolean) => void;
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

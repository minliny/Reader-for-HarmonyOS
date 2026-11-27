import type { LocalReadingTocEntry, LocalReadingBookmark } from '../application/LocalReadingFlowGateway';

/** One value snapshot per actual directory change. Only a numeric revision
 * crosses ArkUI @Prop; motion, scrolling and IME updates never recursively
 * clone the directory through every retained component. Readers do not mutate
 * the published snapshot and keep their existing business-owner checks. */
export class ReaderDirectoryDataPublication {
  private entries: LocalReadingTocEntry[] = [];
  private byIndex: Map<number, LocalReadingTocEntry> = new Map<number, LocalReadingTocEntry>();
  private readableRanks: Map<number, number> = new Map<number, number>();
  private readableCount: number = 0;
  private revision: number = 0;
  private lastSourceRef: LocalReadingTocEntry[] | undefined;
  private lastSourceRevision: number | undefined;

  publish(entries: LocalReadingTocEntry[], sourceRevision?: number): number {
    // An explicit owner's revision covers in-place changes. Legacy callers
    // without that guarantee still compare values even on the same array.
    if (sourceRevision !== undefined && entries === this.lastSourceRef &&
      sourceRevision === this.lastSourceRevision) return this.revision;
    if (!sameReaderDirectoryData(this.entries, entries)) {
      this.entries = snapshotReaderDirectoryData(entries);
      this.byIndex.clear();
      this.readableRanks.clear();
      this.readableCount = 0;
      for (const entry of this.entries) {
        this.byIndex.set(entry.index, entry);
        if (entry.navigable !== false) this.readableRanks.set(entry.index, this.readableCount++);
      }
      this.revision += 1;
    }
    this.lastSourceRef = sourceRevision === undefined ? undefined : entries;
    this.lastSourceRevision = sourceRevision;
    return this.revision;
  }
  entriesAt(_revision: number): LocalReadingTocEntry[] { return this.entries; }
  entryAt(_revision: number, index: number): LocalReadingTocEntry | undefined { return this.byIndex.get(index); }
  readableRankAt(_revision: number, index: number): number | undefined { return this.readableRanks.get(index); }
  readableCountAt(_revision: number): number { return this.readableCount; }
}

/** Independent values, not retained aliases: detect same-reference in-place edits too. */
export function snapshotReaderDirectoryData(entries: LocalReadingTocEntry[]): LocalReadingTocEntry[] {
  return entries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
    index: entry.index, title: entry.title, level: entry.level,
    displayTitle: entry.displayTitle, isVip: entry.isVip, isPay: entry.isPay, contextTitle: entry.contextTitle,
    downloadState: entry.downloadState, navigable: entry.navigable,
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
    if (a.index !== b.index || a.title !== b.title || a.level !== b.level ||
      a.displayTitle !== b.displayTitle || a.isVip !== b.isVip || a.isPay !== b.isPay || a.contextTitle !== b.contextTitle ||
      a.downloadState !== b.downloadState || a.navigable !== b.navigable) return false;
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

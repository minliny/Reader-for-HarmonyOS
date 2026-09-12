import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import { projectReaderDirectoryEntries } from './ReaderDirectoryProjection.ts';
import { projectReaderBookmarkRows, readerBookmarkLoadState,
  type ReaderBookIdentity, type ReaderBookmarkRowModel } from './ReaderBookmarkProjection.ts';
import { readerControlNearestBookmarkRow, readerControlCenteredListOffset } from './ReaderControlListPositioning.ts';

export interface ReaderControlDirectoryRow {
  key: string;
  chapter: LocalReadingTocEntry | undefined;
  bookmark: ReaderBookmarkRowModel | undefined;
}

export interface ReaderControlDirectorySnapshot {
  rows: ReaderControlDirectoryRow[];
  loading: boolean;
  currentTitle: string;
  currentPosition: string;
  targetRow: number;
}

export function readerControlDirectorySnapshot(entries: LocalReadingTocEntry[], tab: string,
  query: string, ascending: boolean, currentChapter: number,
  identity?: ReaderBookIdentity): ReaderControlDirectorySnapshot {
  const currentOrdinal = entries.findIndex((entry: LocalReadingTocEntry): boolean => entry.index === currentChapter);
  const rows: ReaderControlDirectoryRow[] = [];
  let targetRow = -1;
  if (tab === 'bookmarks') {
    const bookmarks = projectReaderBookmarkRows(entries, query, identity);
    for (const bookmark of bookmarks) rows.push({ key: `bookmark:${bookmark.bookmarkId}`,
      chapter: undefined, bookmark: bookmark });
    const ordinals = new Map<number, number>();
    entries.forEach((entry: LocalReadingTocEntry, ordinal: number): void => { ordinals.set(entry.index, ordinal); });
    const positions = bookmarks.map((bookmark: ReaderBookmarkRowModel) => ({
      chapterOrdinal: ordinals.get(bookmark.chapterIndex) ?? -1,
      chapterOffset: bookmark.chapterOffset,
    }));
    targetRow = readerControlNearestBookmarkRow(positions, currentOrdinal) ?? -1;
  } else {
    for (const entry of projectReaderDirectoryEntries(entries, query, ascending)) {
      if (entry.index === currentChapter) targetRow = rows.length;
      rows.push({ key: `chapter:${entry.index}`, chapter: entry, bookmark: undefined });
    }
  }
  return { rows: rows, loading: entries.length === 0 ||
    (tab === 'bookmarks' && readerBookmarkLoadState(entries) === 'loading'), targetRow: targetRow,
    currentTitle: currentOrdinal < 0 ? '' : entries[currentOrdinal].title,
    currentPosition: currentOrdinal < 0 ? '' : `${currentOrdinal + 1} / ${entries.length}` };
}

/** One placement request per actual list opening. Data arriving late can fulfill
 * it; data refresh and Quick/Full geometry changes cannot create another request.
 * User scrolling cancels a pending request before it can seize the viewport.
 */
export class ReaderControlDirectoryPosition {
  private key: string = '';
  private pending: boolean = true;
  private revision: number = 0;
  open(key: string): void {
    if (key === this.key) return;
    this.key = key; this.pending = true; this.revision += 1;
  }
  userScroll(): void { this.pending = false; this.revision += 1; }
  ticket(): number { return this.revision; }
  offset(snapshot: ReaderControlDirectorySnapshot, height: number, rowHeight: number,
    ticket: number): number | undefined {
    if (!this.pending || ticket !== this.revision || snapshot.loading || snapshot.targetRow < 0) return undefined;
    return readerControlCenteredListOffset({ viewportHeight: height,
      contentHeight: snapshot.rows.length * rowHeight, targetTop: snapshot.targetRow * rowHeight,
      targetHeight: rowHeight });
  }
  commit(ticket: number): void { if (ticket === this.revision) this.pending = false; }
}

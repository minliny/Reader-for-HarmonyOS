import type { LocalReadingTocEntry } from '../application/LocalReadingFlowTypes';
import type { ReadingEntryNavigation, ReadingEntryNavigationItem } from '../application/ReadingEntrySnapshot';

export interface ReaderDirectoryProjectionBookmark {
  time: number;
  chapterIndex: number;
  chapterOffset: number;
  chapterTitle: string;
  content: string;
}

export interface ReaderDirectoryProjectionEntry {
  index: number;
  title: string;
  displayTitle?: string;
  contextTitle?: string;
  bookmarks?: ReaderDirectoryProjectionBookmark[];
}

export function projectReaderDirectoryEntries<T extends ReaderDirectoryProjectionEntry>(
  entries: T[],
  query: string,
  ascending: boolean,
  mangaSearch: boolean = false,
): T[] {
  const searchable = (text: string): string => (mangaSearch ? text.normalize('NFKC') : text).toLocaleLowerCase();
  const normalizedQuery = searchable(query);
  const visible: T[] = [];
  for (const entry of entries) {
    if (normalizedQuery.length > 0 && (mangaSearch ? [entry.title, entry.displayTitle ?? '', entry.contextTitle ?? ''] : [entry.title])
        .every((text: string): boolean => searchable(text).indexOf(normalizedQuery) < 0)) {
      continue;
    }
    visible.push(entry);
  }
  if (!ascending) {
    visible.reverse();
  }
  return visible;
}

/** While a refresh completes, the session owns titles and the parent owns markers and offline state. */
export function projectReaderControlDirectoryTitles(
  parentEntries: LocalReadingTocEntry[],
  sessionEntries: LocalReadingTocEntry[],
): LocalReadingTocEntry[] {
  const projectedByChapter = new Map<number, LocalReadingTocEntry>();
  for (const projected of sessionEntries) {
    projectedByChapter.set(projected.index, projected);
  }
  return parentEntries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => {
    const projected = projectedByChapter.get(entry.index);
    return projected === undefined ? entry : {
      index: entry.index,
      title: projected.title,
      displayTitle: entry.displayTitle, isVip: entry.isVip, isPay: entry.isPay, contextTitle: entry.contextTitle,
      level: projected.level ?? entry.level,
      downloadState: entry.downloadState,
      navigable: entry.navigable,
      bookmarks: entry.bookmarks,
    };
  });
}

export function readableReaderDirectoryEntries(entries: LocalReadingTocEntry[]): LocalReadingTocEntry[] {
  return entries.filter((entry: LocalReadingTocEntry): boolean => entry.navigable !== false);
}

export function readerDirectoryEntryRanks(entries: LocalReadingTocEntry[]): Map<number, number> {
  const ranks = new Map<number, number>();
  entries.forEach((entry: LocalReadingTocEntry, position: number): void => { ranks.set(entry.index, position); });
  return ranks;
}

export function readerEntryNavigationItem(
  window: ReadingEntryNavigation | undefined,
  chapterIndex: number,
): ReadingEntryNavigationItem | undefined {
  if (window === undefined) return undefined;
  return [...window.before, window.current, ...window.after]
    .find((entry: ReadingEntryNavigationItem): boolean => entry.index === chapterIndex);
}

export interface ReaderDirectoryProgressTarget {
  position: number;
  chapterProgress: number;
}

/** A seek on a catalog without exact scalar metrics distributes entries evenly. */
export function readerDirectoryProgressTarget(
  count: number,
  percent: number,
): ReaderDirectoryProgressTarget | undefined {
  if (count === 0) return undefined;
  const normalized = Math.max(0, Math.min(1, percent / 100));
  const scaled = normalized >= 1 ? count : normalized * count;
  const position = Math.min(count - 1, Math.floor(scaled));
  const chapterProgress = normalized >= 1 ? 1 : scaled - position;
  return { position, chapterProgress };
}

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


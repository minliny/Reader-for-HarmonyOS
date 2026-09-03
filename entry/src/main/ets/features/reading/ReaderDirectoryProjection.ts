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
  bookmarks?: ReaderDirectoryProjectionBookmark[];
}

export function projectReaderDirectoryEntries<T extends ReaderDirectoryProjectionEntry>(
  entries: T[],
  query: string,
  ascending: boolean,
): T[] {
  const normalizedQuery = query.toLocaleLowerCase();
  const visible: T[] = [];
  for (const entry of entries) {
    if (normalizedQuery.length > 0 && entry.title.toLocaleLowerCase().indexOf(normalizedQuery) < 0) {
      continue;
    }
    visible.push(entry);
  }
  if (!ascending) {
    visible.reverse();
  }
  return visible;
}

